const fs = require('fs');
const mPath = process.env.HOME + '/study-bot-backup-20260407_011636/handlers/millionaire.js';
let m = fs.readFileSync(mPath, 'utf8');

const old = `  const q       = game.currentQ;
  const correct = q.correct || q.correct_answer || 'a';`;

const neww = `  const q = game.currentQ;
  if (!q) {
    await endGame(telegram || ctx?.telegram, chatId, 'error');
    return;
  }
  const correct = q.correct || q.correct_answer || 'a';`;

if (m.includes(old)) {
  m = m.replace(old, neww);
  fs.writeFileSync(mPath, m);
  console.log('✅ Done');
} else {
  console.log('❌ not found');
}
