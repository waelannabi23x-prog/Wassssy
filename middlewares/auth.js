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

  // 🔐 تحقق من الاشتراك في القنوات المطلوبة (الخاص فقط)
  try {
    const chatType = ctx.chat?.type;
    if (!ctx.isOwner && !ctx.isAdmin && chatType === 'private') {
      const cbData = ctx.callbackQuery?.data;
      // عند الضغط على تحقق — امسح cache وتحقق من جديد
      // زر تحقق — تحقق مباشرة
      if (cbData === 'check_subscription') {
        const { clearSubCache, checkAllChannels, buildSubscribeMessage } = require('../utils/channelGuard');
        clearSubCache(uid);
        ctx.answerCbQuery('').catch(()=>{});
        const { ok, missing } = await checkAllChannels({ telegram: ctx.telegram }, uid);
        if (ok) {
          // ✅ مشترك — احذف رسالة التحقق وابعث الترحيب
          await ctx.deleteMessage().catch(()=>{});
          const uName = ctx.from?.first_name || 'Student';
          await ctx.telegram.sendMessage(uid,
            '\u2705 *\u062a\u0645 \u0627\u0644\u062a\u062d\u0642\u0642 \u0628\u0646\u062c\u0627\u062d!*\n\n\ud83d\udc4b \u0623\u0647\u0644\u0627\u064b ' + uName + '\u060c \u0645\u0631\u062d\u0628\u0627\u064b \u0628\u0643!\n\n\u0627\u0636\u063a\u0637 \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0644\u0644\u0628\u062f\u0621 \ud83d\udc47',
            { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🏠 ابدأ الآن', callback_data: 'main_menu' }]] } }
          ).catch(()=>{});
          return;
        }
        // ❌ لم يشترك بعد
        ctx.answerCbQuery('❌ لم تشترك بعد!', { show_alert: true }).catch(()=>{});
        const { text, buttons } = buildSubscribeMessage(missing, ctx.from?.first_name);
        return ctx.editMessageText(text, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: buttons }
        }).catch(() => ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }).catch(()=>{}));
      }

      // باقي الطلبات — تحقق من الاشتراك
      if (!cbData?.startsWith('del_channel_')) {
        const cached = require('../utils/cache').cacheGet('sub_ok_' + uid);
        if (!cached) {
          const { checkAllChannels, buildSubscribeMessage } = require('../utils/channelGuard');
          const { ok, missing } = await checkAllChannels({ telegram: ctx.telegram }, uid);
          if (!ok) {
            const { text, buttons } = buildSubscribeMessage(missing, ctx.from?.first_name);
            if (cbData) {
              ctx.answerCbQuery('').catch(()=>{});
              return ctx.editMessageText(text, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: buttons }
              }).catch(() => ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }).catch(()=>{}));
            }
            return ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }).catch(()=>{});
          }
        }
      }
    }
  } catch(_) {}

  // 🎮 Daily login bonus (+1 نقطة)
  try { const {checkDailyLogin}=require('../database/points'); checkDailyLogin(uid).catch(()=>{}); } catch(_){}
  return next();
}

module.exports = { authMiddleware, isOwner, OWNER_ID };
