'use strict';
const { connection: _conn } = require('../utils/queues');
if (!_conn) {
  console.warn('[NotifyWorker] No Redis connection — worker disabled');
  module.exports = null;
} else {
  const { Worker } = require('bullmq');

  const notifyWorker = new Worker('notify', async (job) => {
    const { groups, message, fileId, fileType } = job.data;
    const bot = global.__bot;
    if (!bot) throw new Error('Bot not ready');

    for (const g of groups) {
      try {
        if (fileType === 'photo') {
          await bot.telegram.sendPhoto(g.chat_id, fileId, { caption: message, parse_mode: 'Markdown' });
        } else {
          await bot.telegram.sendDocument(g.chat_id, fileId, { caption: message, parse_mode: 'Markdown' });
        }
      } catch(_) {}
      await new Promise(r => setTimeout(r, 200));
    }
  }, { connection: _conn, concurrency: 2 });

  module.exports = notifyWorker;
}
