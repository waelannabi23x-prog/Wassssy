'use strict';

const { cacheGet, cacheSet, cacheClear } = require('../utils/cache');
const { get, run } = require('../database/db');

// ✅ OWNER_ID إجباري من .env — لا fallback hardcoded
const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
if (!OWNER_ID || isNaN(OWNER_ID)) {
  console.error('FATAL: OWNER_ID missing in .env');
  process.exit(1);
}
const isOwner = uid => parseInt(uid) === OWNER_ID;

const _userBuf = new Map();

function bufferUser(uid, firstName, lastName, username) {
  _userBuf.set(uid, { id: uid, first_name: firstName || '', last_name: lastName || '', username: username || '' });
  if (_userBuf.size >= 500) flushUsers();
}

async function flushUsers() {
  if (!_userBuf.size) return;
  const entries = [..._userBuf.values()];
  _userBuf.clear();
  if (!entries.length) return;
  const ph = entries.map((_, i) => `($${i * 4 + 1},$${i * 4 + 2},$${i * 4 + 3},$${i * 4 + 4},CURRENT_TIMESTAMP)`).join(',');
  const params = entries.flatMap(e => [e.id, e.first_name, e.last_name, e.username]);
  try {
    await run(
      `INSERT INTO users(id,first_name,last_name,username,last_active) VALUES ${ph}
       ON CONFLICT(id) DO UPDATE SET first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,username=EXCLUDED.username,last_active=CURRENT_TIMESTAMP`,
      params
    );
  } catch (_) {}
}

const _bufT = setInterval(flushUsers, 10000);
_bufT.unref();

const _admCache = new Map();
const ADM_TTL = 900000; // 15 min

async function getAdminInfo(uid) {
  const now = Date.now();
  const c = _admCache.get(uid);
  if (c && now - c.ts < ADM_TTL) return c.data;
  const row = await get('SELECT * FROM admins WHERE user_id=$1', [uid]);
  const data = row
    ? { isAdmin: true, perms: (row.permissions || '').split(',').map(p => p.trim()) }
    : { isAdmin: false, perms: [] };
  _admCache.set(uid, { data, ts: now });
  return data;
}

global.invalidateAdmin = uid => _admCache.delete(uid);
global.invalidateBan   = uid => cacheClear('ban_' + uid);

async function authMiddleware(ctx, next) {
  const uid = ctx.from?.id;
  if (!uid) return next();

  ctx.uid     = uid;
  ctx.isOwner = isOwner(uid);
  bufferUser(uid, ctx.from.first_name, ctx.from.last_name, ctx.from.username);

  if (ctx.isOwner) {
    ctx.isAdmin    = true;
    ctx.adminPerms = ['full'];
  } else {
    const info     = await getAdminInfo(uid);
    ctx.isAdmin    = info.isAdmin;
    ctx.adminPerms = info.perms;
  }

  if (!ctx.isOwner && !ctx.isAdmin) {
    let banned = cacheGet('ban_' + uid);
    if (banned === undefined) {
      const u = await get('SELECT is_banned FROM users WHERE id=$1', [uid]);
      banned = u?.is_banned ? 1 : 0;
      cacheSet('ban_' + uid, banned, 300000);
    }
    if (banned === 1) {
      return ctx.reply('🚫 أنت محظور من استخدام البوت.').catch(() => {});
    }
  }

  if (global.maintenanceMode && !ctx.isOwner && !ctx.isAdmin) {
    // ✅ كاش 60 ثانية لتجنب DB query على كل طلب
    if (!global._maintMsgCache || Date.now() - global._maintMsgCache.ts > 60000) {
      const { getSetting } = require('../database/db');
      const endTime = await getSetting('maintenance_end').catch(() => null);
      let msg = global.maintenanceMsg || '🔧 البوت تحت الصيانة حالياً لتحسين الخدمة.';
      if (endTime) msg += `\n\n⏱ الوقت المتوقع للعودة: ${endTime}`;
      msg += '\n\nنعتذر عن الإزعاج 🙏';
      global._maintMsgCache = { msg, ts: Date.now() };
    }
    return ctx.reply(global._maintMsgCache.msg).catch(() => {});
  }

  // 🔐 تحقق من الاشتراك في القنوات المطلوبة
  try {
    // الأدمن والأونر معفيون
    if (!ctx.isOwner && !ctx.isAdmin) {
      const cbData = ctx.callbackQuery?.data;
      // عند الضغط على تحقق — امسح cache وتحقق من جديد
      if (cbData === 'check_subscription') {
        const { clearSubCache } = require('../utils/channelGuard');
        clearSubCache(uid);
      }
      // استثن فقط del_channel_ من الأدمن
      if (!cbData?.startsWith('del_channel_')) {
        const { checkAllChannels, buildSubscribeMessage } = require('../utils/channelGuard');
        const { ok, missing } = await checkAllChannels({ telegram: ctx.telegram }, uid);
        if (!ok) {
          const name = ctx.from?.first_name || 'صديقي';
          const { text, buttons } = buildSubscribeMessage(missing, name);
          if (cbData) {
            // callback — عدّل الرسالة أو رد
            ctx.answerCbQuery('').catch(()=>{});
            return ctx.editMessageText(text, {
              parse_mode: 'Markdown',
              reply_markup: { inline_keyboard: buttons }
            }).catch(() => ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }).catch(()=>{}));
          }
          return ctx.reply(text, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: buttons }
          }).catch(()=>{});
        }
        // مشترك — لو كان callback تحقق، افتح البوت
        if (cbData === 'check_subscription') {
          ctx.answerCbQuery('✅ مرحباً بك! 🎉').catch(()=>{});
          await ctx.deleteMessage().catch(()=>{});
          // استدعي startHandler مباشرة
          try {
            const startHandler = require('../handlers/start');
            return await startHandler(ctx);
          } catch(e) {
            await ctx.reply('مرحباً! اكتب /start للبدء').catch(()=>{});
          }
          return;
        }
      }
    }
  } catch(_) {}

  // 🎮 Daily login bonus (+1 نقطة)
  try { const {checkDailyLogin}=require('../database/points'); checkDailyLogin(uid).catch(()=>{}); } catch(_){}
  return next();
}

module.exports = { authMiddleware, isOwner, OWNER_ID };
