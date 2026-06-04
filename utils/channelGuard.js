'use strict';
const { all, run }                   = require('../database/db');
const { cacheGet, cacheSet, cacheClear } = require('./cache');

// ─────────────────────────────────────────────────────────────
//  INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────

/** جلب اسم القناة من Telegram مع cache 24h */
async function getChannelInfo(bot, channelId) {
  try {
    const chat = await bot.telegram.getChat(channelId);
    return chat.title || chat.username || String(channelId);
  } catch (_) { return null; }
}

/** مسح sub_ok لكل المستخدمين من الذاكرة */
function _clearAllSubCache() {
  try {
    const { getCacheKeys, cacheClear: cc } = require('./cache');
    getCacheKeys().filter(k => k.startsWith('sub_ok_')).forEach(k => cc(k));
  } catch (_) {}
}

/** مسح sub_ok من Redis/Upstash */
async function _clearSubCacheRedis(userId) {
  try {
    const { getRedisClient } = require('./redisClient');
    const r = getRedisClient();
    if (r) await r.del('sub_ok_' + userId);
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────
//  PUBLIC: جلب القنوات المطلوبة
// ─────────────────────────────────────────────────────────────
async function getChannels() {
  const hit = cacheGet('required_channels');
  if (hit) return hit;
  const rows = await all(
    'SELECT * FROM required_channels WHERE is_active=1 ORDER BY id'
  ).catch(() => []);
  cacheSet('required_channels', rows, 180_000); // 3 دقائق
  return rows;
}

// ─────────────────────────────────────────────────────────────
//  PUBLIC: تحقق إذا البوت ادمن في قناة معينة
// ─────────────────────────────────────────────────────────────
async function validateBotInChannel(bot, channelId) {
  try {
    const me  = await bot.telegram.getMe();
    const mbr = await bot.telegram.getChatMember(channelId, me.id);
    const ok  = ['administrator', 'creator'].includes(mbr?.status);
    return { ok, status: mbr?.status };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ─────────────────────────────────────────────────────────────
//  INTERNAL: تحقق من اشتراك مستخدم في قناة واحدة
// ─────────────────────────────────────────────────────────────
async function _checkChannel(bot, userId, channelId) {
  try {
    const mbr    = await bot.telegram.getChatMember(channelId, userId);
    const status = mbr?.status;

    if (['member', 'administrator', 'creator'].includes(status)) return true;
    if (['left', 'kicked', 'banned'].includes(status))           return false;
    return true; // restricted = مشترك
  } catch (e) {
    const msg = e?.message || '';

    // ════ البوت مش ادمن / مكيكد ════
    // ❌ كان يرجع true قبل = الخطأ الجذري
    // ✅ الآن: false = يجبر المستخدم على الضغط على رابط القناة
    if (msg.includes('bot is not a member') || msg.includes('bot was kicked')) {
      console.warn('[ChannelGuard] ⚠️  البوت مش ادمن في:', channelId,
        '— أضفه كادمن وإلا الفحص ما يشتغل');
      return false;
    }

    // القناة محذوفة / خاصة = خطأ إعداد، لا نعاقب المستخدم
    if (msg.includes('CHANNEL_PRIVATE') ||
        msg.includes('chat not found')  ||
        msg.includes('Invalid peer')) {
      console.warn('[ChannelGuard] ⚠️  قناة غير موجودة أو خاصة:', channelId);
      return true;
    }

    // Rate-limit: انتظر وأعد المحاولة مرة وحدة
    if (msg.includes('Too Many Requests') ||
        msg.includes('FLOOD_WAIT')        ||
        msg.includes('retry')) {
      await new Promise(r => setTimeout(r, 1500));
      try {
        const retry = await bot.telegram.getChatMember(channelId, userId);
        return ['member', 'administrator', 'creator'].includes(retry?.status);
      } catch (_) { return true; }
    }

    // أخطاء شبكة مؤقتة = نفتح
    if (msg.includes('ETIMEOUT') || msg.includes('ECONNRESET') ||
        msg.includes('network')  || msg.includes('timeout')) {
      return true;
    }

    // المستخدم مش موجود في القناة = مش مشترك
    if (msg.includes('user not found') || msg.includes('participant not found')) {
      return false;
    }

    console.warn('[ChannelGuard] Unknown error — uid:', userId, 'ch:', channelId, msg);
    return true;
  }
}

// ─────────────────────────────────────────────────────────────
//  PUBLIC: تحقق من كل القنوات
// ─────────────────────────────────────────────────────────────
async function checkAllChannels(bot, userId) {
  const cacheKey = 'sub_ok_' + userId;
  if (cacheGet(cacheKey) === true) return { ok: true, missing: [] };

  const channels = await getChannels();
  if (!channels.length) return { ok: true, missing: [] };

  // فحص متوازي لكل القنوات مع timeout 6 ثواني لكل قناة
  const results = await Promise.all(
    channels.map(async ch => {
      // جلب اسم القناة مع cache
      const nameKey = 'chname_' + ch.channel_id;
      let name = cacheGet(nameKey);
      if (!name) {
        name = ch.channel_name;
        if (!name || name.startsWith('-') || /^-?\d+$/.test(name)) {
          name = await getChannelInfo(bot, ch.channel_id).catch(() => null)
                 || ch.channel_name
                 || ('قناة ' + (ch.id || ''));
        }
        cacheSet(nameKey, name, 86_400_000); // 24 ساعة
      }

      const subscribed = await Promise.race([
        _checkChannel(bot, userId, ch.channel_id),
        new Promise(res => setTimeout(() => res(true), 6000)) // timeout = نفتح
      ]);

      return { ...ch, channel_name: name, subscribed };
    })
  );

  const missing = results.filter(ch => !ch.subscribed);
  const ok      = missing.length === 0;

  // ✅ cache إيجابي 30 ثانية فقط (حتى يبقى الفحص حساس)
  if (ok) cacheSet(cacheKey, true, 30_000);

  return { ok, missing };
}

// ─────────────────────────────────────────────────────────────
//  PUBLIC: إضافة قناة
// ─────────────────────────────────────────────────────────────
async function addChannel(channelId, channelName, channelUrl, bot) {
  // تحقق إذا البوت ادمن (إذا مررنا bot)
  let warning = null;
  if (bot) {
    const v = await validateBotInChannel(bot, channelId).catch(() => ({ ok: false }));
    if (!v.ok) {
      warning = `⚠️ البوت مش ادمن في القناة (${channelId})\nأضفه كادمن وإلا الفحص ما يشتغل!`;
      console.warn('[ChannelGuard]', warning);
    }
  }

  await run(
    `INSERT INTO required_channels(channel_id, channel_name, channel_url)
     VALUES($1,$2,$3)
     ON CONFLICT(channel_id) DO UPDATE
     SET channel_name=$2, channel_url=$3, is_active=1`,
    [channelId, channelName, channelUrl]
  );

  // ✅ مسح كاش القنوات + كاش اشتراك كل المستخدمين
  cacheClear('required_channels');
  cacheClear('chname_' + channelId);
  _clearAllSubCache(); // يجبر الكل على إعادة التحقق

  console.log('[ChannelGuard] ✅ أُضيفت القناة:', channelId, channelName);
  return { warning };
}

// ─────────────────────────────────────────────────────────────
//  PUBLIC: حذف قناة
// ─────────────────────────────────────────────────────────────
async function removeChannel(id) {
  const sid = String(id);
  const col = (sid.startsWith('-') || sid.startsWith('@')) ? 'channel_id' : 'id';
  await run('UPDATE required_channels SET is_active=0 WHERE ' + col + '=$1', [sid]);
  cacheClear('required_channels');
  _clearAllSubCache(); // ✅ مسح كاش الكل عند حذف قناة
  console.log('[ChannelGuard] 🗑 حُذفت القناة:', sid);
}

// ─────────────────────────────────────────────────────────────
//  PUBLIC: بناء رسالة الاشتراك
// ─────────────────────────────────────────────────────────────
function buildSubscribeMessage(missingChannels, userName) {
  const name  = userName || 'صديقي';
  const total = missingChannels.length;

  let text = '🔐 *' + name + '، مرحباً!*\n\n';
  text += '━━━━━━━━━━━━━━━━\n';
  text += '📋 *يجب الاشتراك في ';
  text += (total === 1 ? 'هذه القناة' : 'هذه القنوات الـ' + total) + ':*\n\n';

  missingChannels.forEach((ch, i) => {
    const label = (ch.channel_name && !/^-?\d+$/.test(ch.channel_name))
      ? ch.channel_name : 'القناة ' + (i + 1);
    text += (i + 1) + '. 📣 *' + label + '*\n';
  });

  text += '\n━━━━━━━━━━━━━━━━\n';
  text += '1️⃣ اضغط على القناة واشترك\n';
  text += '2️⃣ ارجع وأضغط ✅ تحقق';

  const buttons = missingChannels.map(ch => {
    const label = (ch.channel_name && !/^-?\d+$/.test(ch.channel_name))
      ? ch.channel_name : 'اشترك الآن 📣';
    return [{ text: '📣 ' + label, url: ch.channel_url }];
  });
  buttons.push([{ text: '✅ اشتركت — تحقق الآن', callback_data: 'check_subscription' }]);

  return { text, buttons };
}

// ─────────────────────────────────────────────────────────────
//  PUBLIC: مسح cache مستخدم معين (ذاكرة + Redis)
// ─────────────────────────────────────────────────────────────
async function clearSubCache(userId) {
  cacheClear('sub_ok_' + userId);       // ذاكرة
  await _clearSubCacheRedis(userId);    // ✅ Upstash/Redis
}

// ─────────────────────────────────────────────────────────────
module.exports = {
  getChannels,
  checkAllChannels,
  addChannel,
  removeChannel,
  buildSubscribeMessage,
  clearSubCache,
  validateBotInChannel,
};
