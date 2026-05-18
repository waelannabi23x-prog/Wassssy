'use strict';

require('dotenv').config();
require('./utils/validateEnv').validateEnv();

const { Telegraf }    = require('telegraf');
const express         = require('express');
const compression     = require('compression');
const logger          = require('./utils/logger');
const { res: cbRes }  = require('./utils/cbRegistry');
const { initSchema, getSetting, run: dbRun, all: dbAll, getPg } = require('./database/db');
const { authMiddleware, OWNER_ID } = require('./middlewares/auth');
const { loadAllStates }   = require('./utils/redis');
const { cacheWarmup, cacheClear, cacheClearPrefix } = require('./utils/cache');
const { startScheduler }  = require('./utils/scheduler');
const { initPersistentStates } = require('./utils/stateManager');
const { setState: _setState, delState: _delState, getState: _getState } = require('./utils/redis');
const { CBDedup, GrpBuf, GrpMsgs } = require('./bot/services');
const notesH = require('./handlers/notes');

// ── Handlers ──
const startHandler  = require('./handlers/start');
const manage        = require('./handlers/manage');
const browse        = require('./handlers/browse');
const userH         = require('./handlers/user');
const million       = require('./handlers/million');
const millionaire   = require('./handlers/millionaire');
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
const { handleNewMember, showAllMembers, tagMembers, tagAll, muteAll, unmuteAll } = require('./handlers/group_admin');
const { btn: kbBtn, build: kbBuild } = require('./utils/keyboard');
const { eos } = require('./utils/helpers');

// ── Globals ──
global.setState  = _setState;
global.delState  = _delState;
global.getState  = _getState;
global.maintenanceMode = false;

// ── Config ──
const TOKEN        = process.env.BOT_TOKEN;
if (!TOKEN) { logger.error('FATAL: BOT_TOKEN missing'); process.exit(1); }
const WEBHOOK_URL    = process.env.WEBHOOK_URL || '';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const PORT           = parseInt(process.env.PORT) || 3000;
const safeInt = v => { const n = parseInt(v); return isNaN(n) ? 0 : n; };

// ── Express ──
const app = express();
app.use(compression({ level: 6, threshold: 512 }));
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
  const now = Date.now();
  let u = _floodMap.get(uid);
  if (!u || now - u.t > 1000) { u = { c: 1, t: now }; _floodMap.set(uid, u); }
  else {
    u.c++;
    if (u.c > 6) {
      if (u.c === 7) return ctx.reply('⚠️ إبطاء قليلاً...').catch(() => {});
      return;
    }
  }
  return next();
};

// ── Middleware ──
bot.use(async (ctx, next) => {
  if (ctx.chat?.type !== 'private') {
    if (ctx.callbackQuery) return next();
    const t = ctx.message?.text || '';
    if (ctx.message && !['/search', '/setsp', '/dlt', '/done', '/cancel', '/new', '/top'].some(p => t.startsWith(p)))
      return ctx.deleteMessage().catch(() => {});
  }
  return next();
});
bot.use(rateLimit);
bot.use(authMiddleware);
bot.catch((err, ctx) => {
  if (!err.message.includes('is not modified'))
    logger.error(`[BotErr] ${err.message}`, { uid: ctx.from?.id, type: ctx.updateType });
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
  CBDedup, cbRes, startHandler, manage, browse, userH, notesH,
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
    await notesH.initNotes().catch(()=>{});
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

    const apiRoutes = require('./routes/api');
    app.use('/api', apiRoutes);

    app.listen(PORT, () => logger.info('✅ Express :' + PORT));

    if (WEBHOOK_URL) {
      await bot.telegram.setWebhook(WEBHOOK_URL + '/webhook/' + TOKEN, {
        allowed_updates: ['message', 'callback_query', 'my_chat_member'],
        drop_pending_updates: true,
        max_connections: 40,
        ...(WEBHOOK_SECRET && { secret_token: WEBHOOK_SECRET }),
      });
      logger.info('✅ Webhook: ' + WEBHOOK_URL);
    } else {
      logger.warn('⚠️ No WEBHOOK_URL — polling mode');
      bot.launch({ drop_pending_updates: true });
    }

    millionaire.register(bot);
    global.__bot = bot;
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
