'use strict';
const { get, all, run } = require('../database/db');
const { cacheGet, cacheSet, cacheClear } = require('./cache');

// ── جلب القنوات المطلوبة ─────────────────────────
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
  cacheSet('required_channels', channels, 300000); // 5 دقائق
  return channels;
}

// ── التحقق من اشتراك مستخدم في قناة ─────────────
async function checkChannel(bot, userId, channelId) {
  try {
    const member = await bot.telegram.getChatMember(channelId, userId);
    return ['member','administrator','creator'].includes(member?.status);
  } catch(e) {
    return false;
  }
}

// ── التحقق من كل القنوات ─────────────────────────
async function checkAllChannels(bot, userId) {
  // Cache 10 دقائق عشان ما يتحقق كل ضغطة
  const cacheKey = 'sub_ok_' + userId;
  const cached = cacheGet(cacheKey);
  if (cached === true) return { ok: true, missing: [] };
  const channels = await getChannels();
  if (!channels.length) return { ok: true, missing: [] };
  
  const results = await Promise.all(
    channels.map(async ch => {
      const subscribed = await checkChannel(bot, userId, ch.channel_id);
      // جلب اسم حقيقي لو الاسم المحفوظ هو ID
      let realName = ch.channel_name;
      if (!realName || realName.startsWith('-') || /^-?\d+$/.test(realName)) {
        realName = await getChannelInfo(bot, ch.channel_id).catch(()=>null) || ch.channel_name;
      }
      return { ...ch, channel_name: realName, subscribed };
    })
  );
  
  const missing = results.filter(ch => !ch.subscribed);
  const ok = missing.length === 0;
  if (ok) cacheSet('sub_ok_' + userId, true, 600000); // 10 دقائق
  return { ok, missing };
}

// ── إضافة قناة ───────────────────────────────────
async function addChannel(channelId, channelName, channelUrl) {
  await run(
    'INSERT INTO required_channels(channel_id, channel_name, channel_url) VALUES($1,$2,$3) ON CONFLICT(channel_id) DO UPDATE SET channel_name=$2, channel_url=$3, is_active=1',
    [channelId, channelName, channelUrl]
  );
  cacheClear('required_channels');
}

// ── حذف قناة ─────────────────────────────────────
async function removeChannel(id) {
  await run('UPDATE required_channels SET is_active=0 WHERE id=$1', [id]);
  cacheClear('required_channels');
}

// ── بناء رسالة الاشتراك ──────────────────────────
function buildSubscribeMessage(missingChannels, userName) {
  const name = userName || 'صديقي';
  let text = '👋 *أهلاً ' + name + '!*\n\n';
  text += '━━━━━━━━━━━━━━━━\n';
  text += '🔐 *للدخول للبوت اشترك في:*\n\n';

  missingChannels.forEach((ch, i) => {
    const chName = ch.channel_name && !ch.channel_name.startsWith('-') ? ch.channel_name : 'القناة';
    text += (i + 1) + '. 📣 *' + chName + '*\n';
  });

  text += '\n━━━━━━━━━━━━━━━━\n';
  text += '_اشترك ثم اضغط تحقق ✅_';

  const buttons = missingChannels.map(ch => {
    const chName = ch.channel_name && !ch.channel_name.startsWith('-') ? ch.channel_name : 'اشترك الآن 📣';
    return [{ text: '📣 ' + chName, url: ch.channel_url }];
  });

  buttons.push([{ text: '✅ تحققت من الاشتراك', callback_data: 'check_subscription' }]);

  return { text, buttons };
}

function clearSubCache(userId) {
  const { cacheClear } = require('./cache');
  cacheClear('sub_ok_' + userId);
}

module.exports = { getChannels, checkAllChannels, addChannel, removeChannel, buildSubscribeMessage, clearSubCache };
