'use strict';
const { get, all, run } = require('../database/db');
const { cacheGet, cacheSet, cacheClear } = require('./cache');

// ── جلب القنوات المطلوبة ─────────────────────────
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
  const channels = await getChannels();
  if (!channels.length) return { ok: true, missing: [] };
  
  const results = await Promise.all(
    channels.map(async ch => ({
      ...ch,
      subscribed: await checkChannel(bot, userId, ch.channel_id)
    }))
  );
  
  const missing = results.filter(ch => !ch.subscribed);
  return { ok: missing.length === 0, missing };
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
  let text = `👋 *أهلاً ${name}!*\n\n`;
  text += `🔐 *للوصول للبوت يجب الاشتراك في:*\n\n`;
  
  missingChannels.forEach((ch, i) => {
    text += `${i + 1}. 📢 *${ch.channel_name || 'القناة'}*\n`;
  });
  
  text += `\n✅ بعد الاشتراك اضغط **تحقق من الاشتراك**`;
  
  const buttons = missingChannels.map(ch => ([{
    text: `📢 ${ch.channel_name || 'اشترك الآن'}`,
    url: ch.channel_url
  }]));
  
  buttons.push([{
    text: '✅ تحقق من الاشتراك',
    callback_data: 'check_subscription'
  }]);
  
  return { text, buttons };
}

module.exports = { getChannels, checkAllChannels, addChannel, removeChannel, buildSubscribeMessage };
