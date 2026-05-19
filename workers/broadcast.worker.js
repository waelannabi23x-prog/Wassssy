'use strict';
const { connection: _conn } = require('../utils/queues');
if (!_conn) { console.warn('[BroadcastWorker] disabled — no Redis'); module.exports = null; }
else {
const { connection } = require('../utils/queues');
if (!connection) { console.warn('[BroadcastWorker] No Redis — worker disabled'); module.exports = null; return; }

const { Worker } = require('bullmq');
const { connection } = require('../utils/queues');

function getBot() { return global.__bot; }

const broadcastWorker = new Worker('broadcast', async (job) => {
  const { userIds, message, parseMode = 'Markdown', fromUid } = job.data;
  const bot = getBot();
  if (!bot) throw new Error('Bot not ready');

  let sent = 0, failed = 0;
  const BATCH = 25; // 25 رسائل ثم نستنى 1s (Telegram: 30/sec)

  for (let i = 0; i < userIds.length; i++) {
    try {
      await bot.telegram.sendMessage(userIds[i], message, { parse_mode: parseMode });
      sent++;
    } catch(_) { failed++; }

    if ((i + 1) % BATCH === 0) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // إشعار المرسِل بالنتيجة
  if (fromUid) {
    await bot.telegram.sendMessage(fromUid,
      `✅ اكتمل الإرسال\n📤 *${sent}* نجح | ❌ *${failed}* فشل`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }

  return { sent, failed };
}, {
  connection,
  concurrency: 1,  // broadcast واحد في نفس الوقت
  limiter: { max: 25, duration: 1000 }
});

broadcastWorker.on('failed', (job, err) => {
  console.error('[BroadcastWorker] Job failed:', job?.id, err.message);
});

module.exports = broadcastWorker;

}