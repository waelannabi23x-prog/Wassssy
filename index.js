'use strict';

require('dotenv').config();
require('./utils/validateEnv').validateEnv();

const { Telegraf }    = require('telegraf');
const express         = require('express');
const compression     = require('compression');
const helmet          = require('helmet');
const logger          = require('./utils/logger');
const { res: cbRes }  = require('./utils/cbRegistry');
const { initSchema, getSetting, run: dbRun, all: dbAll, get: dbGet, getPg } = require('./database/db');
const { authMiddleware, OWNER_ID } = require('./middlewares/auth');
const { loadAllStates }   = require('./utils/redis');
const { cacheWarmup, cacheClear, cacheClearPrefix } = require('./utils/cache');
const { startScheduler }  = require('./utils/scheduler');
const { initPersistentStates } = require('./utils/stateManager');
const { CBDedup, GrpBuf, GrpMsgs } = require('./bot/services');

// ── Handlers ──
const startHandler  = require('./handlers/start');
const manage        = require('./handlers/manage');
const browse        = require('./handlers/browse');
const userH         = require('./handlers/user');
const million       = require('./handlers/million');
const millionaire   = require('./handlers/millionaire');
const guessGame     = require('./handlers/guess_game');
const tools         = require('./handlers/owner_tools');
const bank          = require('./handlers/bank');
const groupPro      = require('./handlers/group_pro');
const bankPro       = require('./handlers/bank_pro');
const ownerH        = require('./handlers/owner');
const contentDb     = require('./database/content');
const usersDb       = require('./database/users');
const bundlesDb     = require('./database/bundles');
const commentsDb    = require('./database/comments');
const interactions  = require('./database/interactions');
const adminsDb      = require('./database/admins');
const filesDb       = require('./database/files');
const { handleAiChat, resetChat } = require('./handlers/ai_chat');
const { handleOwnerAI }           = require('./handlers/ai_owner');
const { smartSearch }             = require('./handlers/group');
const { handleNewMember, handleMemberLeft, showAllMembers, tagAll, muteAll, unmuteAll, showGroupStats, warnMember, banMember, unbanMember, muteMember, unmuteMember, checkAntiSpam } = require('./handlers/group_admin');
const { setupGroupCommands, handleSettingsCallback } = require('./handlers/group_commands');
const { migrateGroupTables } = require('./database/group_db');
const groupBroadcast = require('./utils/groupBroadcast');
const { btn: kbBtn, build: kbBuild } = require('./utils/keyboard');
const { eos } = require('./utils/helpers');

// ── Config ──
const TOKEN          = process.env.BOT_TOKEN;
if (!TOKEN) { logger.error('FATAL: BOT_TOKEN missing'); process.exit(1); }
const WEBHOOK_URL    = process.env.WEBHOOK_URL || '';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const PORT           = parseInt(process.env.PORT) || 3000;
const safeInt = v => { const n = parseInt(v); return isNaN(n) ? 0 : n; };

// ── maintenanceMode — module-level (لا global) ──
let maintenanceMode = false;
setInterval(async () => {
  try {
    const { cacheGet, cacheSet } = require('./utils/cache');
    let val = cacheGet('_maint_mode');
    if (val === null) {
      val = (await getSetting('maintenance')) === 'true';
      cacheSet('_maint_mode', val, 30000);
    }
    maintenanceMode = !!val;
  } catch(_) {}
}, 30000).unref();

// expose للـ middlewares التي تحتاجه
Object.defineProperty(global, 'maintenanceMode', {
  get: () => maintenanceMode,
  set: v => { maintenanceMode = !!v; },
  configurable: true,
});

// ── Express ──
const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"],
  scriptSrc:  ["'self'", "'unsafe-inline'", 'telegram.org', '*.telegram.org'],
  styleSrc:   ["'self'", "'unsafe-inline'"],
  imgSrc:     ["'self'", 'data:', 'https:'],
  connectSrc: ["'self'", 'https://api.telegram.org'],
}}}));
app.use(compression({ level: 6, threshold: 512 }));
app.use('/api', (req, res, next) => {
  if (req.method === 'GET') {
    res.set('Cache-Control', 'private, max-age=10');
    res.set('Vary', 'Accept-Encoding');
  }
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(express.static(require('path').join(__dirname, 'public'), {
  etag: false, maxAge: 0,
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate'),
}));
app.set('trust proxy', 1);
app.get('/', (_r, res) => res.send('OK'));

// ── Bot ──
const bot = new Telegraf(TOKEN, {
  handlerTimeout: 90000,
  telegram: { apiRoot: process.env.TELEGRAM_API_ROOT || undefined },
});

// ── Rate Limiter ──
const _floodMap = new Map();
setInterval(() => {
  const cut = Date.now() - 60000;
  for (const [k, v] of _floodMap) if (v.t < cut) _floodMap.delete(k);
}, 60000).unref();

const rateLimit = (ctx, next) => {
  const uid = ctx.from?.id;
  if (!uid) return next();
  if (ctx.isOwner || ctx.isAdmin) return next();
  const now = Date.now();
  let u = _floodMap.get(uid);
  if (!u || now - u.t > 2000) {
    _floodMap.set(uid, { c: 1, t: now });
    return next();
  }
  u.c++;
  if (u.c > 4) {
    if (u.c === 5 && ctx.callbackQuery)
      ctx.answerCbQuery('⚠️ إبطاء قليلاً...', { show_alert: false }).catch(() => {});
    return;
  }
  return next();
};

// ══════════════════════════════════════════
// FIX 1: تحقق هل البوت أدمن — middleware مستقل على المستوى الأعلى
// (كان متداخل داخل bot.use آخر = memory leak + double processing)
// ══════════════════════════════════════════
const botAdminCheck = async (ctx, next) => {
  if (!['group', 'supergroup'].includes(ctx.chat?.type)) return next();
  if (!ctx.message?.text?.startsWith('/')) return next();
  try {
    const me = await ctx.telegram.getChatMember(ctx.chat.id, ctx.botInfo.id);
    logger.info('[BOTADMIN_DEBUG] status=' + me.status + ' chat=' + ctx.chat.id + ' txt=' + ctx.message?.text);
    if (me.status === 'administrator' || me.status === 'creator') return next();
    const botUn = ctx.botInfo?.username || '';
    await ctx.reply(
      '⚠️ أنا لست مشرفاً في هذا القروب!\n\nلكي تعمل الأوامر بشكل صحيح، يرجى إضافتي كمشرف 👇',
      {
        reply_to_message_id: ctx.message?.message_id,
        reply_markup: { inline_keyboard: [[
          { text: '➕ أضفني كمشرف', url: 'https://t.me/' + botUn + '?startgroup=admin' },
        ]]},
      }
    ).catch(() => {});
    return;
  } catch(_) { return next(); }
};

// ── Spam/Flood state ──
const _spamProtect = new Map();
setInterval(() => {
  const cut = Date.now() - 10000;
  for (const [k, v] of _spamProtect) if (v.last < cut) _spamProtect.delete(k);
}, 10000).unref();

const { all: _dbAll, get: _dbGet } = require('./database/db');
const { cacheGet: _cGet, cacheSet: _cSet } = require('./utils/cache');

// ══════════════════════════════════════════
// FIX 2: Auto-Reply + حماية القروب — middleware مستقل (لا nested bot.use)
// ══════════════════════════════════════════
const groupProtectionMiddleware = async (ctx, next) => {
  if (ctx.chat?.type === 'private' || !ctx.message || !ctx.from) return next();

  const uid = ctx.from.id;
  const cid = ctx.chat.id;
  const txt = ctx.message?.text || ctx.message?.caption || '';
  const now = Date.now();

  // 🤖 Auto-Reply
  const _isGameMsg = /^(تخمين[:\s]|خمن$|خمن |انا$|مليون$)/i.test(txt.trim())
    || txt.trim() === 'خمن' || txt.trim() === 'مليون';
  const _uid4ar  = ctx.from?.id;
  const _state4ar = _uid4ar ? require('./utils/stateManager').getState(_uid4ar) : null;
  const _inArMode = _state4ar?.type?.startsWith('mg_ar') || _state4ar?.type?.startsWith('mg_awaiting');

  if (txt && txt.length > 0 && !_isGameMsg && !_inArMode) {
    const arKey = 'auto_replies_all';
    let arList = _cGet(arKey);
    if (!arList) {
      arList = await _dbAll('SELECT * FROM auto_replies WHERE is_active=1').catch(() => []);
      _cSet(arKey, arList, 120000);
    }
    const matched = [];
    for (const ar of arList) {
      try {
        let isMatch = false;
        if (ar.match_type === 'regex') {
          isMatch = new RegExp(ar.trigger, 'i').test(txt);
        } else if (ar.match_type === 'exact') {
          isMatch = txt.toLowerCase() === ar.trigger.toLowerCase();
        } else {
          isMatch = txt.toLowerCase().includes(ar.trigger.toLowerCase());
        }
        if (isMatch) matched.push(ar);
      } catch(_) {
        if (txt.toLowerCase().includes(ar.trigger.toLowerCase())) matched.push(ar);
      }
    }
    if (matched.length > 0) {
      const pick   = matched[Math.floor(Math.random() * matched.length)];
      const _rtype = pick.resp_type || 'text';
      const _fid   = pick.file_id;
      const _opts  = { reply_to_message_id: ctx.message.message_id };
      if      (_rtype === 'sticker'   && _fid) ctx.telegram.sendSticker(ctx.chat.id, _fid, _opts).catch(() => {});
      else if (_rtype === 'photo'     && _fid) ctx.telegram.sendPhoto(ctx.chat.id, _fid, { ..._opts, caption: pick.response || undefined, parse_mode: 'Markdown' }).catch(() => {});
      else if (_rtype === 'video'     && _fid) ctx.telegram.sendVideo(ctx.chat.id, _fid, { ..._opts, caption: pick.response || undefined, parse_mode: 'Markdown' }).catch(() => {});
      else if (_rtype === 'voice'     && _fid) ctx.telegram.sendVoice(ctx.chat.id, _fid, { ..._opts, caption: pick.response || undefined }).catch(() => {});
      else if (_rtype === 'animation' && _fid) ctx.telegram.sendAnimation(ctx.chat.id, _fid, { ..._opts, caption: pick.response || undefined, parse_mode: 'Markdown' }).catch(() => {});
      else if (_rtype === 'document'  && _fid) ctx.telegram.sendDocument(ctx.chat.id, _fid, { ..._opts, caption: pick.response || undefined, parse_mode: 'Markdown' }).catch(() => {});
      else ctx.reply(pick.response, { reply_to_message_id: ctx.message.message_id, parse_mode: 'Markdown' }).catch(() => {});
    }
  }

  // حماية الأدمنز من الفلتر
  if (ctx.isAdmin || ctx.isOwner) return next();

  // إعدادات القروب
  const sk = 'grp_s_' + cid;
  let gs = _cGet(sk);
  if (!gs) {
    gs = await _dbGet('SELECT anti_spam,anti_link,anti_flood FROM group_chats WHERE chat_id=$1', [cid]).catch(() => null) || {};
    _cSet(sk, gs, 60000);
  }

  // Anti-Flood
  if (gs.anti_flood) {
    const key = uid + '_' + cid;
    const sp  = _spamProtect.get(key) || { c: 0, t: now };
    if (now - sp.t < 3000) sp.c++; else { sp.c = 1; sp.t = now; }
    _spamProtect.set(key, sp);
    if (sp.c > 5) {
      ctx.deleteMessage().catch(() => {});
      if (sp.c === 6) require('./handlers/group_admin').warnMember(ctx, cid, uid, 'فلود').catch(() => {});
      return;
    }
  }

  // Anti-Link
  if (gs.anti_link && txt && !txt.startsWith('/')) {
    if (/https?:\/\/|t\.me\/|telegram\.me\//i.test(txt)) {
      ctx.deleteMessage().catch(() => {});
      const m = await ctx.reply('🔗 ' + (ctx.from.first_name || '') + ' الروابط ممنوعة!').catch(() => null);
      if (m) setTimeout(() => ctx.telegram.deleteMessage(cid, m.message_id).catch(() => {}), 5000);
      return;
    }
  }

  // Anti-Spam
  if (gs.anti_spam && txt && txt.length > 5 && !txt.startsWith('/')) {
    const sk2 = 'sp_' + uid + '_' + cid;
    if (_cGet(sk2) === txt) { ctx.deleteMessage().catch(() => {}); return; }
    _cSet(sk2, txt, 10000);
  }

  return next();
};

// ══════════════════════════════════════════
// FIX 3: Middleware الألعاب والبنك — trigger واحد فقط لكل أمر
// (حذف النسخ المكررة من bot.on('message') لاحقاً)
// ══════════════════════════════════════════
const gameAndBankMiddleware = async (ctx, next) => {
  const isGroup = ['group', 'supergroup'].includes(ctx.chat?.type);
  const txt     = (ctx.message?.text || '').trim();

  if (isGroup && ctx.message) {
    if (/^خمن$/i.test(txt))           return guessGame.startInvite(ctx).catch(() => next());
    if (/^(العاب|الالعاب)$/i.test(txt)) {
      try { await require('./handlers/group_commands').showGamesMenu(ctx); return; } catch(_) {}
    }
    if (/^تخمين[:\s:]+/i.test(txt)) {
      const handled = await guessGame.handleGuessMsg(ctx).catch(() => false);
      if (handled) return;
    }
    if (/^[أاآ]نا$/i.test(txt))       return guessGame.handleJoin(ctx).catch(() => next());

    // FIX: مليون — trigger واحد فقط هنا، محذوف من bot.on('message')
    if (/^مليون$/i.test(txt)) {
      try { await millionaire.startJoinPhase(ctx); return; }
      catch(e) { logger.error('[Million]', e.message); }
    }

    // البنك
    // bank.js القديم محذوف — استخدم bank_pro.js

    // gpq_quick_panel_trigger — لوحة الإدارة السريعة (رد على عضو + "ادارة")
    if (/^(ادارة|إدارة)$/i.test(txt) && ctx.message?.reply_to_message) {
      const target = ctx.message.reply_to_message.from;
      if (target && !target.is_bot) {
        const allowed = await groupPro.hasPermission(ctx, ctx.chat.id, ctx.from.id, 'manage_protection')
          .catch(() => false);
        if (allowed || ctx.isAdmin || ctx.isOwner) {
          const { txt: pTxt, kb: pKb } = await groupPro.buildQuickPanel(ctx, target);
          return ctx.reply(pTxt, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: pKb } }).catch(() => next());
        }
      }
    }

    // 🏦 Taline Bank
    if (/^بنك$/i.test(txt))                       return bankPro.openAccount(ctx).catch(() => next());
    if (/^محفظتي$/i.test(txt))                    return bankPro.showWallet(ctx).catch(() => next());
    if (/^بطاقتي$/i.test(txt))                    return bankPro.showCard(ctx).catch(() => next());
    if (/^كشف$/i.test(txt))                       return bankPro.showStatement(ctx).catch(() => next());
    if (/^تحويل\s+\d/i.test(txt))                return bankPro.transfer(ctx).catch(() => next());
    if (/^قرض(\s+\d.*)?$/i.test(txt))            return bankPro.requestLoan(ctx).catch(() => next());
    if (/^ديوني$/i.test(txt))                     return bankPro.showLoans(ctx).catch(() => next());
    if (/^سداد$/i.test(txt))                      return bankPro.repayLoan(ctx).catch(() => next());
    if (/^استثمار(\s+\d.*)?$/i.test(txt))        return bankPro.invest(ctx).catch(() => next());
    if (/^سحب استثمار$/i.test(txt))               return bankPro.withdrawInvest(ctx).catch(() => next());
    if (/^(الاثرياء|أثرياء|اثرياء)$/i.test(txt)) return bankPro.richList(ctx).catch(() => next());
  }

  // PV لعبة خمن
  if (!isGroup && ctx.chat?.type === 'private') {
    const uid = String(ctx.from?.id || '');
    if (guessGame.hasPvState(uid)) {
      return guessGame.handlePvDirect(ctx).catch(e => {
        logger.error('[GuessGame PV]', e.message);
        return next();
      });
    }
  }

  return next();
};

// ── تسجيل middleware بالترتيب الصحيح ──
bot.use(rateLimit);
bot.use(gameAndBankMiddleware);   // الألعاب والبنك قبل auth

// 🛡️ نظام الحماية الاحترافي (group_pro) — مسجّل بالفعل في bot/messages.js، لا تكرار هنا

// 🛡️ مكافحة التعديل
bot.on('edited_message', async (ctx, next) => {
  if (!['group','supergroup'].includes(ctx.chat?.type)) return next();
  return groupPro.protectEdit(bot, ctx, next);
});

// 🛡️ فحص الأعضاء الجدد (بوتات/حسابات جديدة)
bot.use(async (ctx, next) => {
  if (ctx.message?.new_chat_members) {
    return groupPro.checkNewMember(bot, ctx, next);
  }
  return next();
});
bot.use(authMiddleware);
bot.use(botAdminCheck);           // FIX: مستوى أعلى — لا nested
bot.use(groupProtectionMiddleware); // auto-reply + flood/spam/link

bot.catch((err, ctx) => {
  if (!err.message.includes('is not modified'))
    logger.error('[BotErr] ' + err.message, { uid: ctx.from?.id, type: ctx.updateType });
  if (!ctx.callbackQuery && ctx.chat?.type === 'private')
    ctx.reply('⚠️ حدث خطأ. حاول مجدداً.').catch(() => {});
});

// ── تسجيل الأوامر ──
require('./bot/commands')(bot, {
  startHandler, manage, userH, million, tools, browse, bank,
  contentDb, usersDb, bundlesDb, dbAll, cacheClear,
  logger, OWNER_ID, kbBtn, kbBuild, eos, resetChat,
  millionaire, tagAll, muteAll, unmuteAll, showAllMembers,
});

// ── Callbacks ──
const { registerCallbacks } = require('./bot/callbacks');
registerCallbacks(bot, {
  CBDedup, cbRes, startHandler, manage, browse, userH,
  bundlesDb, contentDb, usersDb, interactions, commentsDb,
  cacheClear, cacheClearPrefix, kbBtn, kbBuild, eos, logger,
  safeInt, tagAll, muteAll, unmuteAll,
});

// ── Messages ──
setupGroupCommands(bot);

const { registerMessages } = require('./bot/messages');
registerMessages(bot, {
  ownerH, GrpBuf, GrpMsgs, handleAiChat, handleOwnerAI,
  manage, browse, userH, bundlesDb, filesDb, adminsDb,
  logger, OWNER_ID, safeInt,
});

// ── deep link: /start file_{fileId} ──
const { handleSummarize } = require('./handlers/share_summary');
bot.command(['لخص', 'summarize', 'sum'], handleSummarize);

bot.start(async (ctx, next) => {
  const payload = ctx.startPayload;
  if (payload?.startsWith('file_')) {
    const fid = parseInt(payload.replace('file_', ''));
    if (fid) {
      try {
        const file = await dbGet('SELECT * FROM files WHERE id=$1 AND is_deleted=0', [fid]);
        if (file) {
          const type = file.file_type === 'photo' ? 'sendPhoto' : 'sendDocument';
          await ctx.telegram[type](ctx.chat.id, file.file_id, {
            caption: '📄 *' + file.title + '*\n\n🔽 اضغط للتحميل المباشر',
            parse_mode: 'Markdown',
          });
          return;
        }
      } catch(_) {}
    }
  }
  return next();
});

// ── Launch ──
async function loadMaintenance() {
  try { maintenanceMode = (await getSetting('maintenance')) === 'true'; } catch(_) {}
}

// FIX: _launched guard — يمنع تسجيل handlers مرتين عند retry
let _launched = false;

async function launch() {
  logger.info('🚀 Study Bot — Starting...');
  try {
    await initSchema();
    await migrateGroupTables().catch(() => {});
    const { migrateGroupPro } = require('./database/db');
    await migrateGroupPro().catch(() => {});
    require('./utils/cache').clearAllSubCache();
    await require('./handlers/group_panel').migrateGroupPanel().catch(() => {});
    await require('./database/db').initBankTables().catch(() => {});
    await initPersistentStates();
    logger.info('✅ DB ready');

    await Promise.all([loadMaintenance(), loadAllStates().catch(() => {})]);
    await cacheWarmup();
    logger.info('✅ Cache warm');

    // Preload ban status
    try {
      const { cacheSet: _cs } = require('./utils/cache');
      const [banned, active] = await Promise.all([
        dbAll("SELECT id FROM users WHERE is_banned=1 LIMIT 5000"),
        dbAll("SELECT id FROM users WHERE is_banned=0 AND last_active > NOW() - INTERVAL '3 days' LIMIT 10000"),
      ]);
      banned.forEach(u => _cs('ban_' + u.id, 1, 86400000));
      active.forEach(u => _cs('ban_' + u.id, 0, 3600000));
      logger.info('⚡ Preloaded ban status: ' + (banned.length + active.length) + ' users');
    } catch(_) {}

    startScheduler(bot, [OWNER_ID]);
    GrpBuf.start();
    logger.info('✅ Services started');

    app.use(bot.webhookCallback('/webhook/' + TOKEN, { secretToken: WEBHOOK_SECRET || undefined }));

    app.get('/health', async (_r, res) => {
      res.setHeader('Cache-Control', 'no-store');
      const mu    = process.memoryUsage();
      const heapMB = Math.round(mu.heapUsed / 1048576);
      let dbOk = false;
      try { await dbAll('SELECT 1'); dbOk = true; } catch(_) {}
      res.json({
        status: dbOk && heapMB < 450 ? 'ok' : 'degraded',
        uptime: Math.floor(process.uptime()),
        heap:   heapMB + 'MB',
        rss:    Math.round(mu.rss / 1048576) + 'MB',
        db:     dbOk ? 'ok' : 'error',
        region: process.env.RAILWAY_REGION || 'local',
        ts:     Date.now(),
      });
    });

    // ── API Routes ──
    const apiRoutes = require('./routes/api');
    app.use('/api', apiRoutes);

    // ── Global Express Error Handler ──
    app.use((err, req, res, _next) => {
      logger.error('[API Error] ' + err.message, { path: req.path, uid: req.tgUser?.id });
      res.status(err.status || 500).json({ error: 'حدث خطأ، حاول مجددًا.' });
    });

    app.listen(PORT, () => logger.info('✅ Express :' + PORT));

    // FIX: _launched guard — تسجيل handlers مرة واحدة فقط
    if (!_launched) {
      _launched = true;

      // ══════════════════════════════════════════
      // FIX: bot.on handlers خارج launch — لا يتراكموا عند retry
      // ══════════════════════════════════════════

      // تسجيل القروب تلقائياً
      bot.on('my_chat_member', async ctx => {
        try {
          const upd     = ctx.update?.my_chat_member;
          const newM    = upd?.new_chat_member;
          const addedBy = upd?.from;
          const chat    = upd?.chat;
          if (newM?.user?.is_bot &&
              (newM?.status === 'member' || newM?.status === 'administrator') &&
              addedBy?.id && chat?.type !== 'private') {
            const me    = ctx.botInfo || await ctx.telegram.getMe().catch(() => ({}));
            const un    = me.username || '';
            const chatId = chat.id;
            const title  = chat.title || 'القروب';
            setTimeout(async () => {
              try {
                const botMember = await ctx.telegram.getChatMember(chatId, ctx.botInfo?.id || me.id).catch(() => null);
                const isAdmin   = botMember?.status === 'administrator';
                if (isAdmin) {
                  await ctx.telegram.sendMessage(addedBy.id,
                    '✅ تم إضافتي في *' + title + '* كـ ادمين!\n\nيمكنك إعداد القروب والتحكم فيه من هنا:',
                    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
                      { text: '⚙️ إعداد القروب', url: 'https://t.me/' + un + '?start=setup_' + chatId },
                    ]]}},
                  );
                } else {
                  const _kb = { inline_keyboard: [[
                    { text: '👑 أضفني كـ مشرف 🛡️', url: 'https://t.me/' + un + '?startgroup=true&admin=delete_messages+restrict_members+pin_messages+invite_users+manage_chat' },
                  ]]};
                  await ctx.telegram.sendMessage(chatId,
                    '👋 مرحباً! أنا *' + (un || 'البوت') + '*\n\n❌ تم إضافتي بدون صلاحيات ادمين.\n\n👇 اضغط لإعادة إضافتي كمشرف:',
                    { parse_mode: 'Markdown', reply_markup: _kb }
                  ).catch(() => {});
                  await ctx.telegram.sendMessage(addedBy.id,
                    '⚠️ أضفتني في *' + title + '* بدون صلاحيات ادمين!\n\n👇 اضغط لإعادة إضافتي كمشرف:',
                    { parse_mode: 'Markdown', reply_markup: _kb }
                  ).catch(() => {});
                }
              } catch(_) {}
            }, 2000);
          }
        } catch(_) {}

        try {
          const update = ctx.myChatMember;
          const chat   = update?.chat;
          const member = update?.new_chat_member;
          if (!chat || !['group', 'supergroup'].includes(chat.type)) return;
          if (['member', 'administrator'].includes(member?.status)) {
            await dbRun(
              `INSERT INTO group_chats(chat_id, title, specialty_id, welcome_enabled, goodbye_enabled, notify_new_files, added_by)
               VALUES($1,$2,0,1,0,1,$3)
               ON CONFLICT(chat_id) DO UPDATE SET title=$2, added_by=COALESCE(group_chats.added_by,$3)`,
              [chat.id, chat.title || '', update?.from?.id || null]
            ).catch(() => {});
            logger.info('[GroupReg] ✅ أُضيف البوت لـ: ' + (chat.title || chat.id));
          } else if (['left', 'kicked'].includes(member?.status)) {
            await dbRun('UPDATE group_chats SET is_active=false WHERE chat_id=$1', [chat.id]).catch(() => {});
            logger.info('[GroupReg] 🚪 خرج البوت من: ' + (chat.title || chat.id));
          }
        } catch(e) { logger.error('[my_chat_member]', e.message); }
      });

      // تسجيل رسائل القروب + تسجيل الأعضاء
      // FIX: لا يوجد trigger مليون/بنك هنا — موجود في gameAndBankMiddleware فقط
      bot.on('message', async (ctx, next) => {
        try {
          const chat = ctx.chat;
          if (!['group', 'supergroup'].includes(chat?.type)) return next();

          dbRun(
            `INSERT INTO group_chats(chat_id, title) VALUES($1,$2)
             ON CONFLICT(chat_id) DO UPDATE SET title=$2`,
            [chat.id, chat.title || '']
          ).catch(() => {});

          const u = ctx.from;
          if (u && !u.is_bot) {
            dbRun(
              `INSERT INTO group_members(chat_id,user_id,username,first_name,updated_at)
               VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP)
               ON CONFLICT(chat_id,user_id) DO UPDATE SET updated_at=CURRENT_TIMESTAMP`,
              [chat.id, u.id, u.username || '', u.first_name || '']
            ).catch(() => {});
          }
        } catch(_) {}
        return next();
      });

      // Games — register مرة واحدة
      guessGame.register(bot);
      millionaire.register(bot);
      logger.info('[Launch] ✅ Games registered');

      // BullMQ Workers
      setImmediate(() => {
        try { require('./workers/broadcast.worker'); } catch(e) { logger.warn('[Worker] broadcast:', e.message); }
        try { require('./workers/notify.worker');    } catch(e) { logger.warn('[Worker] notify:', e.message); }
      });
    }

    if (WEBHOOK_URL) {
      await bot.telegram.setWebhook(WEBHOOK_URL + '/webhook/' + TOKEN, {
        allowed_updates: ['message', 'callback_query', 'my_chat_member', 'chat_member', 'inline_query'],
        drop_pending_updates: true,
        max_connections: 40,
        ...(WEBHOOK_SECRET && { secret_token: WEBHOOK_SECRET }),
      });
      logger.info('✅ Webhook: ' + WEBHOOK_URL);
    } else {
      logger.warn('⚠️ No WEBHOOK_URL — polling mode');
      bot.launch({ drop_pending_updates: true });
    }

    logger.info('🚀 Ready!');
  } catch(e) {
    logger.error('[Launch]', e.message);
    setTimeout(launch, 10000);
  }
}

async function shutdown(sig) {
  logger.info('[Shutdown] ' + sig);
  try {
    bot.stop(sig);
    await GrpBuf.stop();
    const pg = getPg();
    if (pg) await pg.end();
    process.exit(0);
  } catch(_) { process.exit(1); }
}

process.once('SIGINT',  () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

launch();
