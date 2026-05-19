'use strict';
const { Worker } = require('bullmq');
const { connection } = require('../utils/queues');

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
}, { connection, concurrency: 2 });

module.exports = notifyWorker;
