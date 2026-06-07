const fs = require('fs');
const mPath = process.env.HOME + '/study-bot-backup-20260407_011636/handlers/millionaire.js';
let m = fs.readFileSync(mPath, 'utf8');

const old = `async function beginGame(telegram, chatId) {
  const game = getGame(chatId);
  if (!game) return;
  if (game.joinTimer) { clearTimeout(game.joinTimer); game.joinTimer = null; }

  if (game.players.size === 0) {
    await telegram.sendMessage(chatId, '😕 لم ينضم أحد للعبة. تم الإلغاء.').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    delGame(chatId);
    return;
  }

  game.status = 'playing';`;

const neww = `async function beginGame(telegram, chatId) {
  const game = getGame(chatId);
  if (!game) return;
  if (game.joinTimer) { clearTimeout(game.joinTimer); game.joinTimer = null; }

  // حذف رسالة الانضمام
  if (game.joinMsgId) {
    await telegram.deleteMessage(chatId, game.joinMsgId).catch(() => {});
    game.joinMsgId = null;
  }

  if (game.players.size === 0) {
    await telegram.sendMessage(chatId, '😕 لم ينضم أحد للعبة. تم الإلغاء.').catch(() => {});
    delGame(chatId);
    return;
  }

  game.status = 'playing';`;

if (m.includes(old)) {
  m = m.replace(old, neww);
  fs.writeFileSync(mPath, m);
  console.log('✅ Done');
} else {
  console.log('❌ not found');
}
