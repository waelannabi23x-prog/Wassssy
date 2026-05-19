'use strict';
const { connection: _conn } = require('../utils/queues');
if (!_conn) {
  console.warn('[BroadcastWorker] No Redis connection — worker disabled');
  module.exports = null;
} else {
  const { Worker } = require('bullmq');

  const broadcastWorker = new Worker('broadcast', async (job) => {
    const { userIds, message, parseMode = 'Markdown', fromUid } = job.data;
    const bot = global.__bot;
    if (!bot) throw new Error('Bot not ready');

    let sent = 0, failed = 0;
    for (let i = 0; i < userIds.length; i++) {
      try {
        await bot.telegram.sendMessage(userIds[i], message, { parse_mode: parseMode });
        sent++;
      } catch(_) { failed++; }
      if ((i + 1) % 25 === 0) await new Promise(r => setTimeout(r, 1000));
    }
    if (fromUid) {
      await bot.telegram.sendMessage(
        fromUid,
        `✅ اكتمل\n📤 *${sent}* نجح | ❌ *${failed}* فشل`,
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }
    return { sent, failed };
  }, { connection: _conn, concurrency: 1 });

  broadcastWorker.on('failed', (job, err) => {
    console.error('[BroadcastWorker] failed:', err.message);
  });

  module.exports = broadcastWorker;
}
