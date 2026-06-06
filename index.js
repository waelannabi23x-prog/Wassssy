'use strict';

require('dotenv').config();
require('./utils/validateEnv').validateEnv();

const { Telegraf }    = require('telegraf');
const express         = require('express');
const compression     = require('compression');
const helmet = require('helmet');
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
const { handleNewMember, handleMemberLeft, showAllMembers, tagAll, muteAll, unmuteAll, showGroupStats, warnMember, banMember, unbanMember, muteMember, unmuteMember, checkAntiSpam } = require("./handlers/group_admin");
const { setupGroupCommands, handleSettingsCallback } = require("./handlers/group_commands");
const { migrateGroupTables } = require("./database/group_db");
const groupBroadcast = require("./utils/groupBroadcast");
const { btn: kbBtn, build: kbBuild } = require('./utils/keyboard');
const { eos } = require('./utils/helpers');

// ── Globals ──
global.maintenanceMode = false;

// ── Cluster-safe maintenance: يقرأ من cache كل 30s ──
setInterval(async () => {
  try {
    const { cacheGet, cacheSet } = require('./utils/cache');
    const { getSetting } = require('./database/db');
    let val = cacheGet('_maint_mode');
    if (val === null) {
      val = (await getSetting('maintenance')) === 'true';
      cacheSet('_maint_mode', val, 30000);
    }
    global.maintenanceMode = !!val;
  } catch(_) {}
}, 30000).unref();

// ── Config ──
const TOKEN        = process.env.BOT_TOKEN;
if (!TOKEN) { logger.error('FATAL: BOT_TOKEN missing'); process.exit(1); }
const WEBHOOK_URL    = process.env.WEBHOOK_URL || '';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const PORT           = parseInt(process.env.PORT) || 3000;
const safeInt = v => { const n = parseInt(v); return isNaN(n) ? 0 : n; };

// ── Express ──
const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'", 'telegram.org', '*.telegram.org'], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:', 'https:'], connectSrc: ["'self'", 'https://api.telegram.org'] } } }));
app.use(compression({ level: 6, threshold: 512 }));

// ── Cache Headers للـ API ──
app.use('/api', (req, res, next) => {
  if (req.method === 'GET') {
    res.set('Cache-Control', 'private, max-age=10');
    res.set('Vary', 'Accept-Encoding');
  }
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(express.static(require('path').join(__dirname, 'public'), { etag: false, maxAge: 0, setHeaders: (res) => { res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate'); } }));
app.set('trust proxy', 1);
app.get('/', (_r, res) => res.send('OK'));

// ── Bot ──
const bot = new Telegraf(TOKEN, {
  handlerTimeout: 90000,
  telegram: { apiRoot: process.env.TELEGRAM_API_ROOT || undefined }
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
  // الأدمن والأونر بدون حد
  if (ctx.isOwner || ctx.isAdmin) return next();
  const now = Date.now();
  let u = _floodMap.get(uid);
  if (!u || now - u.t > 2000) {
    _floodMap.set(uid, { c: 1, t: now });
    return next();
  }
  u.c++;
  // حد 4 ضغطات كل 2 ثانية
  if (u.c > 4) {
    if (u.c === 5 && ctx.callbackQuery) ctx.answerCbQuery('⚠️ إبطاء قليلاً...', { show_alert: false }).catch(() => {});
    return; // تجاهل بدون رد
  }
  return next();
};

// ── Middleware ──
bot.use(async (ctx, next) => {
  if (ctx.chat?.type !== 'private') {
    if (ctx.callbackQuery) return next();
    // ✅ لا نمسح أي رسالة من المستخدمين — البوت مش فلتر رسائل
    // المسح يصير فقط عبر anti-spam أو أوامر الأدمن يدوياً
    return next();
  }
  return next();
});
bot.use(rateLimit);

// ── خمن وcallbacks اللعبة قبل auth ──

bot.use(async (ctx, next) => {
  const txt = (ctx.message?.text || '').trim();
  if (ctx.chat?.type !== 'private' && /^خمن$/i.test(txt)) {
    return guessGame.startInvite(ctx).catch(()=>{});
  }
  return next();
});

// ── تخمين: guess قبل auth ──
bot.use(async (ctx, next) => {
  const txt = (ctx.message?.text || '').trim();
  if (ctx.chat?.type !== 'private' && /^تخمين[:\s:]+/i.test(txt)) {
    const handled = await guessGame.handleGuessMsg(ctx).catch(() => false);
    if (handled) return;
  }
  return next();
});

// ── انا: انضمام للعبة خمن قبل auth ──
bot.use(async (ctx, next) => {
  const txt = (ctx.message?.text || '').trim();
  if (ctx.chat?.type !== 'private' && /^[أاآ]نا$/i.test(txt)) {
    return guessGame.handleJoin(ctx).catch(e => { ctx.telegram.sendMessage(ctx.chat.id, "❌ join err: " + e.message).catch(()=>{}); return next(); });
  }
  return next();
});
// ── PV اللعبة قبل auth ──
bot.use(async (ctx, next) => {
  if (ctx.chat?.type !== 'private') return next();
  const uid = String(ctx.from?.id || '');
  if (guessGame.hasPvState(uid)) {
    return guessGame.handlePvDirect(ctx).catch(e => {
    require('./utils/logger').error('[GuessGame PV]', e.message);
    return next();
  });
  }
  return next();
});
bot.use(authMiddleware);
bot.catch((err, ctx) => {
  if (!err.message.includes('is not modified'))
    logger.error(`[BotErr] ${err.message}`, { uid: ctx.from?.id, type: ctx.updateType });
  if (!ctx.callbackQuery && ctx.chat?.type === 'private') ctx.reply('⚠️ حدث خطأ. حاول مجدداً.').catch(() => {});
});

// ── تسجيل الأوامر ──
require('./bot/commands')(bot, {
  startHandler, manage, userH, million, tools, browse, bank,
  contentDb, usersDb, bundlesDb, dbAll, cacheClear,
  logger, OWNER_ID, kbBtn, kbBuild, eos, resetChat,
  millionaire, tagAll, muteAll, unmuteAll, showAllMembers,
});

// ── Callbacks ──
// ══ Middleware حماية القروبات ══
const { all: _dbAll, get: _dbGet } = require('./database/db');
const { cacheGet: _cGet, cacheSet: _cSet } = require('./utils/cache');
const _spamProtect = new Map();
setInterval(() => { const cut=Date.now()-10000; for(const[k,v] of _spamProtect) if(v.last<cut) _spamProtect.delete(k); }, 10000).unref();

bot.use(async (ctx, next) => {
  if (ctx.chat?.type === 'private' || !ctx.message || !ctx.from) return next();

  const uid = ctx.from.id;
  const cid = ctx.chat.id;
  const txt = ctx.message?.text || ctx.message?.caption || '';
  const now = Date.now();

  // 🤖 Auto-Reply — يشتغل للجميع حتى الأدمنز
  // تجاهل أوامر اللعبة
  const _isGameMsg = /^(تخمين[:\s]|خمن$|خمن |انا$)/i.test(txt.trim()) || txt.trim() === 'خمن';
  if (txt && txt.length > 0 && !_isGameMsg) {
    const arKey = 'auto_replies_all';
    let arList = _cGet(arKey);
    if (!arList) {
      arList = await _dbAll('SELECT * FROM auto_replies WHERE is_active=1').catch(()=>[]);
      _cSet(arKey, arList, 120000);
    }
    // Rotation — رد واحد فقط على الجملة (أول trigger يطابق)
    if (!global._arCounters) global._arCounters = new Map();

    // ابحث عن أول trigger يطابق الجملة
    const triggersFound = [];
    for (const ar of arList) {
      const t = ar.trigger.toLowerCase();
      let matched = ar.match_type === 'exact'
        ? txt.trim().toLowerCase() === t
        : txt.toLowerCase().includes(t);
      if (matched && !triggersFound.includes(t)) triggersFound.push(t);
    }

    if (triggersFound.length > 0) {
      // اختر trigger واحد بـ rotation بين الـ triggers المطابقة
      const tKey = cid + '_triggers';
      const tIdx = (global._arCounters.get(tKey) || 0) % triggersFound.length;
      global._arCounters.set(tKey, tIdx + 1);
      const chosenTrigger = triggersFound[tIdx];

      // من الـ trigger المختار — rotation على الردود
      const responses = arList.filter(ar => ar.trigger.toLowerCase() === chosenTrigger);
      const rKey = cid + '_' + chosenTrigger;
      const rIdx = (global._arCounters.get(rKey) || 0) % responses.length;
      global._arCounters.set(rKey, rIdx + 1);
      ctx.reply(responses[rIdx].response, { reply_to_message_id: ctx.message.message_id }).catch(()=>{});
    }
  }

  // باقي الحماية للمستخدمين العاديين فقط
  if (ctx.isAdmin || ctx.isOwner) return next();

  // جلب إعدادات القروب
  const sk = 'grp_s_' + cid;
  let gs = _cGet(sk);
  if (!gs) {
    gs = await _dbGet('SELECT anti_spam,anti_link,anti_flood FROM group_chats WHERE chat_id=$1',[cid]).catch(()=>null) || {};
    _cSet(sk, gs, 60000);
  }

  // Anti-Flood
  if (gs.anti_flood) {
    const key = uid+'_'+cid;
    const sp = _spamProtect.get(key) || {c:0,t:now};
    if (now - sp.t < 3000) sp.c++; else { sp.c=1; sp.t=now; }
    _spamProtect.set(key, sp);
    if (sp.c > 5) {
      ctx.deleteMessage().catch(()=>{});
      if (sp.c === 6) require('./handlers/group_admin').warnMember(ctx,cid,uid,'فلود').catch(()=>{});
      return;
    }
  }

  // Anti-Link
  if (gs.anti_link && txt && !txt.startsWith('/')) {
    if (/https?:\/\/|t\.me\/|telegram\.me\//i.test(txt)) {
      ctx.deleteMessage().catch(()=>{});
      const m = await ctx.reply('🔗 ' + (ctx.from.first_name||'') + ' الروابط ممنوعة!').catch(()=>null);
      if (m) setTimeout(()=>ctx.telegram.deleteMessage(cid,m.message_id).catch(()=>{}),5000);
      return;
    }
  }

  // Anti-Spam (رسائل متكررة)
  if (gs.anti_spam && txt && txt.length > 5 && !txt.startsWith('/')) {
    const sk2 = 'sp_'+uid+'_'+cid;
    if (_cGet(sk2) === txt) { ctx.deleteMessage().catch(()=>{}); return; }
    _cSet(sk2, txt, 10000);
  }

  return next();
});

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

// ── Launch ──
async function loadMaintenance() {
  try { global.maintenanceMode = (await getSetting('maintenance')) === 'true'; } catch(_) {}
}

async function launch() {
  logger.info('🚀 Study Bot — Starting...');
  try {
    await initSchema();
    await migrateGroupTables().catch(() => {});
    require("./utils/cache").clearAllSubCache();
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
      const mu = process.memoryUsage();
      const heapMB = Math.round(mu.heapUsed / 1048576);
      let dbOk = false;
      try { await dbAll('SELECT 1'); dbOk = true; } catch(_) {}
      res.json({
        status: dbOk && heapMB < 450 ? 'ok' : 'degraded',
        uptime: Math.floor(process.uptime()),
        heap: heapMB + 'MB',
        rss: Math.round(mu.rss / 1048576) + 'MB',
        db: dbOk ? 'ok' : 'error',
        region: process.env.RAILWAY_REGION || 'local',
        ts: Date.now(),
      });
    });

  // ══════════════════════════════════════════
  // 📥 تسجيل القروب تلقائياً عند إضافة البوت
  // ══════════════════════════════════════════
  bot.on('my_chat_member', async ctx => {
    // ⚡ لما يُضاف البوت لقروب — أرسل DM للأدمن الذي أضافه
    try {
      const upd    = ctx.update?.my_chat_member;
      const newM   = upd?.new_chat_member;
      const addedBy = upd?.from;
      const chat   = upd?.chat;
      if (newM?.user?.is_bot &&
          (newM?.status === 'member' || newM?.status === 'administrator') &&
          addedBy?.id &&
          chat?.type !== 'private') {
        const me = ctx.botInfo || await ctx.telegram.getMe().catch(() => ({}));
        const un = me.username || '';
        const chatId = chat.id;
        const title  = chat.title || 'القروب';
        setTimeout(async () => {
          try {
            // تحقق إذا البوت ادمين
            const botMember = await ctx.telegram.getChatMember(chatId, ctx.botInfo?.id || (await ctx.telegram.getMe()).id).catch(() => null);
            const isAdmin = botMember?.status === 'administrator';
            if (isAdmin) {
              // البوت ادمين — رسالة ترحيب وإعداد
              await ctx.telegram.sendMessage(addedBy.id,
                '✅ تم إضافتي في *' + title + '* كـ ادمين!\n\nيمكنك إعداد القروب والتحكم فيه من هنا:',
                {
                  parse_mode: 'Markdown',
                  reply_markup: { inline_keyboard: [
                    [{ text: '⚙️ إعداد القروب', url: 'https://t.me/' + un + '?start=setup_' + chatId }]
                  ]}
                }
              );
            } else {
              // البوت مش ادمين — رسالة تنبيه وخروج
              await ctx.telegram.sendMessage(addedBy.id,
                '⚠️ شكراً على الإضافة في *' + title + '*!\n\n' +
                'لكن لاحظت أنك لم تمنحني صلاحيات *ادمين*، ولن أتمكن من العمل بشكل صحيح.\n\n' +
                '📌 *كيف تصلح ذلك؟*\n' +
                '1\. اذهب لإعدادات القروب\n' +
                '2\. ادمنز ← أضف ادمن\n' +
                '3\. اخترني وفعّل الصلاحيات\n\n' +
                'سأخرج الآن وأعود عند إضافتي كادمين 👋',
                { parse_mode: 'Markdown' }
              ).catch(() => {});
              await ctx.telegram.leaveChat(chatId).catch(() => {});
            }
          } catch(_) {}
        }, 2000);
      }
    } catch(_) {}
    try {
      const update = ctx.myChatMember;
      const chat   = update?.chat;
      const member = update?.new_chat_member;
      if (!chat || !['group','supergroup'].includes(chat.type)) return;

      if (['member','administrator'].includes(member?.status)) {
        // تحقق إذا البوت ادمين
        if (member?.status !== 'administrator') {
          // مش ادمين — بعث رسالة لمن أضافه وخرج
          const addedBy2 = ctx.update?.my_chat_member?.from;
          if (addedBy2?.id) {
            await ctx.telegram.sendMessage(addedBy2.id,
              '⚠️ تم إضافتي في *' + (chat.title||'القروب') + '* لكن بدون صلاحيات ادمين!\n\n' +
              '📌 لكي أعمل بشكل كامل، يرجى ترقيتي لـ *ادمين* ثم أضفني مجدداً.',
              { parse_mode: 'Markdown' }
            ).catch(() => {});
          }
          await ctx.telegram.leaveChat(chat.id).catch(() => {});
          logger.info('[GroupReg] ⚠️ خرج البوت (مش ادمين) من: ' + (chat.title||chat.id));
          return;
        }
        // البوت أُضيف للقروب كادمين
        await dbRun(
          `INSERT INTO group_chats(chat_id, title, specialty_id, welcome_enabled, goodbye_enabled, notify_new_files)
           VALUES($1,$2,0,1,0,1)
           ON CONFLICT(chat_id) DO UPDATE SET title=$2`,
          [chat.id, chat.title || '']
        ).catch(() => {});
        logger.info('[GroupReg] ✅ أُضيف البوت لـ: ' + (chat.title||chat.id));

      } else if (['left','kicked'].includes(member?.status)) {
        // البوت أُزيل من القروب
        await dbRun(
          'UPDATE group_chats SET is_active=0 WHERE chat_id=$1',
          [chat.id]
        ).catch(() => {});
        logger.info('[GroupReg] 🚪 خرج البوت من: ' + (chat.title||chat.id));
      }
    } catch(e) {
      logger.error('[my_chat_member]', e.message);
    }
  });

  // ══════════════════════════════════════════
  // 📝 تسجيل رسائل القروب + تسجيل الأعضاء
  // ══════════════════════════════════════════
  bot.on('message', async (ctx, next) => {
    try {
      const chat = ctx.chat;
      if (!['group','supergroup'].includes(chat?.type)) return next();

      // تسجيل القروب إذا ما موجود
      dbRun(
        `INSERT INTO group_chats(chat_id, title) VALUES($1,$2)
         ON CONFLICT(chat_id) DO UPDATE SET title=$2`,
        [chat.id, chat.title || '']
      ).catch(() => {});

      // تسجيل العضو
      const u = ctx.from;
      if (u && !u.is_bot) {
        dbRun(
          `INSERT INTO group_members(chat_id,user_id,username,first_name,updated_at)
           VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP)
           ON CONFLICT(chat_id,user_id) DO UPDATE SET updated_at=CURRENT_TIMESTAMP`,
          [chat.id, u.id, u.username||'', u.first_name||'']
        ).catch(() => {});
      }
    } catch(_) {}

    // ── كومندز البنك في القروب ──
    try {
      const txt = (ctx.message?.text || '').trim();
      const bank = require('./handlers/bank');
      if (/^انشاء حساب$/i.test(txt)) { await bank.createAccount(ctx); return; }
      if (/^فلوسي$/i.test(txt)) { await bank.showBalance(ctx); return; }
      if (/^فارسي/i.test(txt)) { await bank.transfer(ctx); return; }
      if (/^rip /i.test(txt)) { await bank.loan(ctx); return; }
    } catch(_) {}

    return next();
  });
const apiRoutes = require('./routes/api');
    app.use('/api', apiRoutes);

// ── Global Express Error Handler ──
app.use((err, req, res, _next) => {
  logger.error('[API Error] ' + err.message, { path: req.path, uid: req.tgUser?.id });
  res.status(err.status || 500).json({ error: 'حدث خطأ، حاول مجددًا.' });
});

    app.listen(PORT, () => logger.info('✅ Express :' + PORT));

      
// ── Share + Summarize ────────────────────────────────────────────
const { handleShare, handleSummarize } = require('./handlers/share_summary');

// share_ callbacks handled in bot/callbacks.js

// commands: /لخص أو /summarize
bot.command(['لخص', 'summarize', 'sum'], handleSummarize);

// deep link: /start file_{fileId}
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
            caption: `📄 *${file.title}*\n\n🔽 اضغط للتحميل المباشر`,
            parse_mode: 'Markdown'
          });
          return;
        }
      } catch(_) {}
    }
  }
  return next();
});


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

    guessGame.register(bot);
    millionaire.register(bot);
    global.__bot = bot;
    require('./utils/logger').info('[Launch] ✅ Games registered');

// ── BullMQ Workers — بعد ما يكون bot جاهز ──
setImmediate(() => {
  try { require('./workers/broadcast.worker'); } catch(e) { logger.warn('[Worker] broadcast:', e.message); }
  try { require('./workers/notify.worker');    } catch(e) { logger.warn('[Worker] notify:',    e.message); }
});
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
