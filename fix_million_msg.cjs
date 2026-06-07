const fs = require('fs');
const mPath = process.env.HOME + '/study-bot-backup-20260407_011636/handlers/millionaire.js';
let m = fs.readFileSync(mPath, 'utf8');

const oldSend = `  const msg = await telegram.sendMessage(chatId, txt, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard },
  }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });

  if (msg) game.msgId = msg.message_id;`;

const newSend = `  // احذف رسالة السؤال القديمة
  if (game.msgId) {
    await telegram.deleteMessage(chatId, game.msgId).catch(() => {});
    game.msgId = null;
  }

  const msg = await telegram.sendMessage(chatId, txt, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard },
  }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });

  if (msg) game.msgId = msg.message_id;`;

if (m.includes(oldSend)) {
  m = m.replace(oldSend, newSend);
  fs.writeFileSync(mPath, m);
  console.log('✅ Done');
} else {
  console.log('❌ pattern not found');
}
