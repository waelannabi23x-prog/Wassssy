const fs = require('fs');
const mPath = process.env.HOME + '/study-bot-backup-20260407_011636/handlers/millionaire.js';
let m = fs.readFileSync(mPath, 'utf8');

// 1. صلح "هذه ليست لعبتك" — خلي الاعب يشارك حتى لو ما انضم قبل
const oldNotPlayer = `  const player = game.players.get(uid);
  if (!player) {
    return ctx.answerCbQuery('🚫 هذه ليست لعبتك!', { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  }`;

const newNotPlayer = `  let player = game.players.get(uid);
  // إذا ما انضم قبل — أضفه تلقائياً
  if (!player && game.status === 'playing') {
    player = {
      id: uid, name: ctx.from?.first_name || 'لاعب',
      username: ctx.from?.username || '',
      alive: true, prize: 0,
      lifelines: { fifty: true, audience: true, call: true, skip: true },
      answers: [], joinedAt: Date.now()
    };
    game.players.set(uid, player);
  }
  if (!player) {
    return ctx.answerCbQuery('🚫 هذه ليست لعبتك!', { show_alert: true }).catch(() => {});
  }`;

if (m.includes(oldNotPlayer)) {
  m = m.replace(oldNotPlayer, newNotPlayer);
  console.log('✅ player fix done');
} else {
  console.log('⚠️ player pattern not found');
}

// 2. صلح رسالة "اللعبة تبدأ الآن" — نحذفها بعد 3 ثواني
const oldBeginMsg = `  await telegram.sendMessage(
    chatId,
    \`🚀 *اللعبة تبدأ الآن!*\\n\\n\${playerList}\\n\\n⚡ استعدوا للسؤال الأول...\`,
    { parse_mode: 'Markdown' }
  ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });`;

const newBeginMsg = `  const beginMsg = await telegram.sendMessage(
    chatId,
    \`🚀 *اللعبة تبدأ الآن!*\\n\\n\${playerList}\\n\\n⚡ استعدوا للسؤال الأول...\`,
    { parse_mode: 'Markdown' }
  ).catch(() => null);
  if (beginMsg) setTimeout(() => telegram.deleteMessage(chatId, beginMsg.message_id).catch(() => {}), 3000);`;

if (m.includes(oldBeginMsg)) {
  m = m.replace(oldBeginMsg, newBeginMsg);
  console.log('✅ begin message fix done');
} else {
  console.log('⚠️ begin message pattern not found');
}

fs.writeFileSync(mPath, m);
console.log('🏁 Done');
