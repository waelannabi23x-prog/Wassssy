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
    if (u.c === 5) ctx.answerCbQuery('⚠️ إبطاء قليلاً...', { show_alert: false }).catch(() => {});
    return; // تجاهل بدون رد
  }
  return next();
};

// ── Middleware ──
bot.use(async (ctx, next) => {
  if (ctx.chat?.type !== 'private') {
    if (ctx.callbackQuery) return next();
    const t = ctx.message?.text || '';
    const _isGame = t && (/^خمن$/.test(t.trim()) || /^تخمين[:\s]+/.test(t.trim()) || /^[أاآ]نا$/.test(t.trim()));
    const _gameOn = guessGame.isGameActive(ctx.chat?.id);
    if (ctx.message && !_isGame && !_gameOn && !['/search', '/setsp', '/dlt', '/done', '/cancel', '/new', '/top'].some(p => t.startsWith(p)))
      return ctx.deleteMessage().catch(() => {});
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
    logger.error(`[BotErr] \${err.message}`, { uid: ctx.from?.id, type: ctx.updateType });
  if (!ctx.callbackQuery) ctx.reply('⚠️ حدث خطأ. حاول مجدداً.').catch(() => {});
});

// ── تسجيل الأوامر ──
require('./bot/commands')(bot, {
  startHandler, manage, userH, million, tools, browse,
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

    setupGroupCommands(bot);
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

// callback: share_{fileId}
bot.action(/^share_(\d+)$/, handleShare);

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
        allowed_updates: ['message', 'callback_query', 'my_chat_member', 'chat_member'],
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
