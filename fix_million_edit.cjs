const fs = require('fs');
const mPath = process.env.HOME + '/study-bot-backup-20260407_011636/handlers/millionaire.js';
let m = fs.readFileSync(mPath, 'utf8');

const old = `  const resultMsg = await telegram.sendMessage(chatId, txt, { parse_mode: 'Markdown' }).catch(() => null);
  // احذف رسالة النتيجة بعد 5 ثواني
  if (resultMsg) setTimeout(() => telegram.deleteMessage(chatId, resultMsg.message_id).catch(() => {}), 7000);`;

const neww = `  // عدّل رسالة السؤال بنتيجة الجولة
  if (game.msgId) {
    await telegram.editMessageText(chatId, game.msgId, null, txt, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [] }
    }).catch(() => {});
  } else {
    const resultMsg = await telegram.sendMessage(chatId, txt, { parse_mode: 'Markdown' }).catch(() => null);
    if (resultMsg) {
      game.msgId = resultMsg.message_id;
      setTimeout(() => telegram.deleteMessage(chatId, resultMsg.message_id).catch(() => {}), 7000);
    }
  }`;

if (m.includes(old)) {
  m = m.replace(old, neww);
  fs.writeFileSync(mPath, m);
  console.log('✅ Done');
} else {
  console.log('❌ not found');
}
