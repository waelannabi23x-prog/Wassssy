'use strict';

const { cacheGet, cacheSet, cacheClear } = require('../utils/cache');
const { getSetting, get: dbGet } = require('../database/db');
const { get, run, getP } = require('../database/db');

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
const ADM_TTL = 7200000; // 2 ساعة

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
    return next();
  }

  // ⚡ CALLBACK FAST PATH — كل شيء من الكاش بدون await
  if (ctx.callbackQuery) {
    const cachedAdmin = _admCache.get(uid);
    const cachedBan   = cacheGet('ban_' + uid);
    const cachedSub   = cacheGet('sub_ok_' + uid);
    if (cachedAdmin && cachedBan !== undefined && (cachedSub === true || ctx.chat?.type !== 'private')) {
      ctx.isAdmin    = cachedAdmin.data.isAdmin;
      ctx.adminPerms = cachedAdmin.data.perms;
      if (!ctx.isAdmin && cachedBan === 1) return ctx.answerCbQuery('🚫 أنت محظور').catch(()=>{});
      return next();
    }
  }

  const banCached = cacheGet('ban_' + uid);
  const [info, banRow] = await Promise.all([
    getAdminInfo(uid),
    banCached === undefined ? getP('getBan', [uid]) : Promise.resolve(null),
  ]);
  ctx.isAdmin    = info.isAdmin;
  ctx.adminPerms = info.perms;

  if (!ctx.isAdmin) {
    let banned = banCached;
    if (banned === undefined) {
      banned = banRow?.is_banned ? 1 : 0;
      cacheSet('ban_' + uid, banned, 3600000); // 30min
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

  // 🔐 تحقق من الاشتراك في القنوات المطلوبة (الخاص فقط)
  try {
    const chatType = ctx.chat?.type;
    if (!ctx.isOwner && !ctx.isAdmin && chatType === 'private') {
      const cbData = ctx.callbackQuery?.data;
      
      if (cbData === 'check_subscription') {
        // ⚡ أجب فوراً + امسح الكاش + افحص من جديد
        ctx.answerCbQuery('🔄 جاري التحقق...').catch(()=>{});
        guard.clearSubCache(uid);
        const res = await guard.checkAllChannels({ telegram: ctx.telegram }, uid);
        if (res.ok) {
          ctx.answerCbQuery('✅ مرحباً بك!').catch(() => {});
          ctx.deleteMessage().catch(() => {});
          const name = ctx.from?.first_name || 'Student';
          // نبني الواجهة ونرسلها كرسالة جديدة
          const fakeCtx = Object.assign({}, ctx, {
            message: { text: '/start', chat: ctx.chat, from: ctx.from, message_id: 0 },
            reply: (text, extra) => ctx.telegram.sendMessage(ctx.chat.id, text, extra),
            replyWithPhoto: (fid, extra) => ctx.telegram.sendPhoto(ctx.chat.id, fid, extra),
          });
          return startHandler.showMainMenu(fakeCtx, name);
        }
        // لم يشترك بعد
        ctx.answerCbQuery('❌ لم تشترك بعد! اشترك أولاً ثم تحقق', { show_alert: true }).catch(() => {});
        const { text, buttons } = guard.buildSubscribeMessage(res.missing, ctx.from?.first_name);
        return ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } })
          .catch(() => ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }).catch(()=>{}));
      }

      if (!cbData || !cbData.startsWith('del_channel_')) {
          // ✅ لا نتجاوز subscription check للـ callbacks
        const subCached = require('../utils/cache').cacheGet('sub_ok_' + uid);
        if (!subCached) {
          const res2 = await guard.checkAllChannels({ telegram: ctx.telegram }, uid);
          if (!res2.ok) {
            const { text, buttons } = guard.buildSubscribeMessage(res2.missing, ctx.from && ctx.from.first_name);
            if (cbData) ctx.answerCbQuery('').catch(()=>{});
            if (cbData) {
              return ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } })
                .catch(() => ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }).catch(()=>{}));
            }
            return ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }).catch(()=>{});
          }
        }
      }
    }
  } catch(_) {}

  // 🎮 Daily login — مرة واحدة فقط بالذاكرة
  if (!global._dlCache) global._dlCache = new Map();
  const today = new Date().toISOString().slice(0,10);
  const dlKey = uid + '_' + today;
  if (!global._dlCache.has(dlKey)) {
    global._dlCache.set(dlKey, 1);
    if (global._dlCache.size > 50000) {
      // احذف أقدم 10000 مدخل بدل مسح الكل
      const arr = [...global._dlCache.keys()].slice(0, 10000);
      arr.forEach(k => global._dlCache.delete(k));
    }
    try { const {checkDailyLogin}=require('../database/points'); checkDailyLogin(uid).catch(()=>{}); } catch(_){}
  }
  return next();
}

module.exports = { authMiddleware, isOwner, OWNER_ID };
