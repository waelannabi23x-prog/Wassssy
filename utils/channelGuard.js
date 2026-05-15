'use strict';
const { get, all, run } = require('../database/db');
const { cacheGet, cacheSet, cacheClear } = require('./cache');

// ── جلب اسم القناة من Telegram ───────────────────
async function getChannelInfo(bot, channelId) {
  try {
    const chat = await bot.telegram.getChat(channelId);
    return chat.title || chat.username || channelId;
  } catch(e) { return null; }
}

// ── جلب القنوات المطلوبة (مع cache) ─────────────
async function getChannels() {
  const cached = cacheGet('required_channels');
  if (cached) return cached;
  const channels = await all('SELECT * FROM required_channels WHERE is_active=1 ORDER BY id').catch(() => []);
  cacheSet('required_channels', channels, 180000); // 3 دقائق
  return channels;
}

// ── ✅ التحقق المحسّن من اشتراك مستخدم ──────────
async function checkChannel(bot, userId, channelId) {
  try {
    const member = await bot.telegram.getChatMember(channelId, userId);
    const status = member?.status;

    // مشترك أو ادمن أو مالك
    if (['member', 'administrator', 'creator'].includes(status)) return true;

    // غادر أو كيكد أو باند = مش مشترك
    if (['left', 'kicked', 'banned'].includes(status)) return false;

    // أي حالة ثانية = اعتبره مشترك (restricted مثلاً)
    return true;

  } catch(e) {
    const errMsg = e?.message || '';

    // ── الحالات اللي نعتبر فيها المستخدم مشترك ──
    // Bot ما عندهاش صلاحية تحقق = نفتح البوت
    if (errMsg.includes('bot is not a member') ||
        errMsg.includes('CHANNEL_PRIVATE') ||
        errMsg.includes('chat not found') ||
        errMsg.includes('bot was kicked')) {
      return true; // القناة غلط / البوت مش فيها = اعتبر الكل مشترك
    }

    // ── Rate limit = نعطيه فائدة الشك ──
    if (errMsg.includes('Too Many Requests') ||
        errMsg.includes('retry') ||
        errMsg.includes('FLOOD_WAIT')) {
      // ننتظر ثانية ونعيد المحاولة مرة وحدة
      await new Promise(r => setTimeout(r, 1200));
      try {
        const retry = await bot.telegram.getChatMember(channelId, userId);
        return ['member', 'administrator', 'creator'].includes(retry?.status);
      } catch(e2) {
        // فشلت المحاولة الثانية = نفتح (نحسن الظن بالمستخدم)
        return true;
      }
    }

    // ── أي خطأ شبكة آخر = نفتح ──
    if (errMsg.includes('ETIMEOUT') ||
        errMsg.includes('ECONNRESET') ||
        errMsg.includes('network') ||
        errMsg.includes('timeout')) {
      return true;
    }

    // المستخدم ما موجود في القناة
    if (errMsg.includes('user not found') ||
        errMsg.includes('participant not found')) {
      return false;
    }

    // ── افتراضي عند خطأ غير معروف = نفتح ──
    console.warn('[ChannelGuard] Unknown error for', userId, 'in', channelId, ':', errMsg);
    return true;
  }
}

// ── التحقق من كل القنوات ─────────────────────────
async function checkAllChannels(bot, userId) {
  // ✅ Cache إيجابي: مشترك بالفعل
  const cacheKey = 'sub_ok_' + userId;
  const cached = cacheGet(cacheKey);
  if (cached === true) return { ok: true, missing: [] };

  const channels = await getChannels();
  if (!channels.length) return { ok: true, missing: [] };

  // ✅ فحص متوازي مع timeout لكل قناة
  const results = await Promise.all(
    channels.map(async ch => {
      // اسم القناة
      const nameKey = 'chname_' + ch.channel_id;
      let realName = cacheGet(nameKey);
      if (!realName) {
        realName = ch.channel_name;
        if (!realName || realName.startsWith('-') || /^-?\d+$/.test(realName)) {
          realName = await getChannelInfo(bot, ch.channel_id).catch(() => null)
            || ch.channel_name
            || ('قناة ' + (ch.id || ''));
        }
        cacheSet(nameKey, realName, 86400000); // 24 ساعة
      }

      // ✅ Timeout: 6 ثواني للتحقق من كل قناة
      const subscribed = await Promise.race([
        checkChannel(bot, userId, ch.channel_id),
        new Promise(resolve => setTimeout(() => resolve(true), 6000)) // timeout = نفتح
      ]);

      return { ...ch, channel_name: realName, subscribed };
    })
  );

  const missing = results.filter(ch => !ch.subscribed);
  const ok = missing.length === 0;

  if (ok) cacheSet(cacheKey, true, 3600000); // ✅ 60 دقائق cache إيجابي

  return { ok, missing };
}

// ── إضافة قناة ───────────────────────────────────
async function addChannel(channelId, channelName, channelUrl) {
  await run(
    `INSERT INTO required_channels(channel_id, channel_name, channel_url)
     VALUES($1,$2,$3)
     ON CONFLICT(channel_id) DO UPDATE
     SET channel_name=$2, channel_url=$3, is_active=1`,
    [channelId, channelName, channelUrl]
  );
  cacheClear('required_channels');
  console.log('[ChannelGuard] Added channel:', channelId, channelName);
}

// ── حذف قناة ─────────────────────────────────────
async function removeChannel(id) {
  await run('UPDATE required_channels SET is_active=0 WHERE id=$1', [id]);
  cacheClear('required_channels');
}

// ── بناء رسالة الاشتراك ──────────────────────────
function buildSubscribeMessage(missingChannels, userName) {
  const name = userName || 'صديقي';
  const total = missingChannels.length;
  let text = '🔐 *' + name + '، مرحباً!*\n\n';
  text += '━━━━━━━━━━━━━━━━\n';
  text += '📋 *يجب الاشتراك في ' + (total === 1 ? 'هذه القناة' : 'هذه القنوات الـ' + total) + ':*\n\n';

  missingChannels.forEach((ch, i) => {
    const chName = ch.channel_name &&
      !ch.channel_name.startsWith('-') &&
      !/^-?\d+$/.test(ch.channel_name)
      ? ch.channel_name : 'القناة ' + (i + 1);
    text += (i + 1) + '. 📣 *' + chName + '*\n';
  });

  text += '\n━━━━━━━━━━━━━━━━\n';
  text += '1️⃣ اضغط على القناة واشترك\n';
  text += '2️⃣ ارجع وأضغط ✅ تحقق';

  const buttons = missingChannels.map(ch => {
    const chName = ch.channel_name &&
      !ch.channel_name.startsWith('-') &&
      !/^-?\d+$/.test(ch.channel_name)
      ? ch.channel_name : 'اشترك الآن 📣';
    return [{ text: '📣 ' + chName, url: ch.channel_url }];
  });

  buttons.push([{ text: '✅ اشتركت — تحقق الآن', callback_data: 'check_subscription' }]);

  return { text, buttons };
}

// ── مسح cache مستخدم معين ──────────────────────
function clearSubCache(userId) {
  cacheClear('sub_ok_' + userId);
}

module.exports = {
  getChannels,
  checkAllChannels,
  addChannel,
  removeChannel,
  buildSubscribeMessage,
  clearSubCache,
};
