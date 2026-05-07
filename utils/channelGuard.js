'use strict';
const { get, all, run } = require('../database/db');
const { cacheGet, cacheSet, cacheClear } = require('./cache');

async function getChannelInfo(bot, channelId) {
  try {
    const chat = await bot.telegram.getChat(channelId);
    return chat.title || chat.username || channelId;
  } catch(e) { return null; }
}

async function getChannels() {
  const cached = cacheGet('required_channels');
  if (cached) return cached;
  const channels = await all('SELECT * FROM required_channels WHERE is_active=1 ORDER BY id').catch(() => []);
  cacheSet('required_channels', channels, 30000); // ✅ دقيقة فقط
  return channels;
}

// ✅ مع retry للتعامل مع أخطاء الشبكة المؤقتة
async function checkChannel(bot, userId, channelId) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const member = await bot.telegram.getChatMember(channelId, userId);
      const status = member?.status;
      // ✅ kicked أو left = مو مشترك، غير ذلك = مشترك
      if (status === 'kicked' || status === 'left' || status === 'restricted') return false;
      if (['member','administrator','creator'].includes(status)) return true;
      return false;
    } catch(e) {
      const msg = e?.message || '';
      // ✅ إذا البوت مكيك من القناة أو القناة ما موجودة = تجاهل هذه القناة (لا تحجب المستخدم)
      if (msg.includes('bot was kicked') || msg.includes('chat not found') || msg.includes('CHANNEL_PRIVATE')) {
        console.warn('[Guard] تحذير: البوت غير قادر على التحقق من قناة', channelId, '-', msg);
        return true; // ✅ إذا البوت مكيك، افترض المستخدم مشترك
      }
      // ✅ خطأ مؤقت - retry
      if (msg.includes('FLOOD_WAIT') || msg.includes('Too Many Requests') || msg.includes('ECONNRESET')) {
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      // ✅ user not found في القناة = مو مشترك
      if (msg.includes('user not found') || msg.includes('USER_NOT_PARTICIPANT')) return false;
      // ✅ أي خطأ آخر مجهول = لا تحجب المستخدم
      console.error('[Guard] خطأ غير متوقع للقناة', channelId, ':', msg);
      return true;
    }
  }
  return true; // ✅ بعد كل المحاولات، افترض مشترك
}

async function checkAllChannels(bot, userId) {
  const cacheKey = 'sub_ok_' + userId;
  const cached = cacheGet(cacheKey);
  if (cached === true) return { ok: true, missing: [] };

  const channels = await getChannels();
  if (!channels.length) return { ok: true, missing: [] };

  // ✅ تحقق من القنوات بشكل منفصل بدل Promise.all حتى لا تتأثر ببعض
  const results = [];
  for (const ch of channels) {
    const nameKey = 'chname_' + ch.channel_id;
    let realName = cacheGet(nameKey);
    if (!realName) {
      realName = ch.channel_name;
      if (!realName || realName.startsWith('-') || /^-?[0-9]+$/.test(realName)) {
        realName = await getChannelInfo(bot, ch.channel_id).catch(() => null) || ('قناة ' + ch.id);
      }
      cacheSet(nameKey, realName, 86400000);
    }
    const subscribed = await checkChannel(bot, userId, ch.channel_id);
    results.push({ ...ch, channel_name: realName, subscribed });
  }

  const missing = results.filter(ch => !ch.subscribed);
  const ok = missing.length === 0;

  // ✅ كاش أقصر: 90 ثانية فقط بدل 5 دقائق
  if (ok) cacheSet(cacheKey, true, 30000);
  return { ok, missing };
}

async function addChannel(channelId, channelName, channelUrl) {
  await run(
    'INSERT INTO required_channels(channel_id, channel_name, channel_url) VALUES($1,$2,$3) ON CONFLICT(channel_id) DO UPDATE SET channel_name=$2, channel_url=$3, is_active=1',
    [channelId, channelName, channelUrl]
  );
  cacheClear('required_channels');
}

async function removeChannel(id) {
  await run('UPDATE required_channels SET is_active=0 WHERE id=$1', [id]);
  cacheClear('required_channels');
}

function buildSubscribeMessage(missingChannels, userName) {
  const name = userName || 'صديقي';
  const total = missingChannels.length;
  let text = '🔐 *' + name + '، مرحباً!*\n\n';
  text += '━━━━━━━━━━━━━━━━\n';
  text += '📋 *يجب الاشتراك في ' + (total === 1 ? 'هذه القناة' : 'هذه القنوات الـ' + total) + ':*\n\n';

  missingChannels.forEach((ch, i) => {
    const chName = ch.channel_name && !ch.channel_name.startsWith('-') && !/^-?\d+$/.test(ch.channel_name)
      ? ch.channel_name : 'القناة ' + (i + 1);
    text += (i + 1) + '. 📣 *' + chName + '*\n';
  });

  text += '\n━━━━━━━━━━━━━━━━\n';
  text += '1️⃣ اضغط على القناة واشترك\n';
  text += '2️⃣ ارجع وأضغط ✅ تحقق';

  const buttons = missingChannels
    .filter(ch => ch.channel_url) // ✅ تجاهل القنوات بدون رابط
    .map(ch => {
      const chName = ch.channel_name && !ch.channel_name.startsWith('-') && !/^-?\d+$/.test(ch.channel_name)
        ? ch.channel_name : 'اشترك الآن 📣';
      return [{ text: '📣 ' + chName, url: ch.channel_url }];
    });

  // ✅ إذا ما في روابط، أضف رسالة
  if (!buttons.length && missingChannels.length) {
    text += '\n\n⚠️ تواصل مع الأدمن للحصول على روابط القنوات.';
  }

  buttons.push([{ text: '✅ تحققت — اضغط هنا', callback_data: 'check_subscription' }]);

  return { text, buttons };
}

function clearSubCache(userId) {
  cacheClear('sub_ok_' + userId);
}

module.exports = { getChannels, checkAllChannels, addChannel, removeChannel, buildSubscribeMessage, clearSubCache };
