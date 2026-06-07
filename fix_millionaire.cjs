const fs = require('fs');
const path = require('path');
const BASE = process.env.HOME + '/study-bot-backup-20260407_011636';
const mPath = path.join(BASE, 'handlers/millionaire.js');
let m = fs.readFileSync(mPath, 'utf8');

// 1. ربط البنك بجائزة الفائز
const oldWinner = `  const winner = sorted[0];
  if (winner && winner.prize > 0) {
    txt += \`\\n🎊 *المبروك \${winner.name}!*\\n🏆 جائزتك: \${fmtPrize(winner.prize)}\`;
  }

  await telegram.sendMessage(chatId, txt, { parse_mode: 'Markdown' }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });`;

const newWinner = `  const winner = sorted[0];
  if (winner && winner.prize > 0) {
    txt += \`\\n🎊 *المبروك \${winner.name}!*\\n🏆 جائزتك: \${fmtPrize(winner.prize)}\`;
    // ── إضافة الجائزة للبنك ──
    try {
      const bank = require('./bank');
      await bank.addWinnings(winner.id, winner.name, winner.username, winner.prize, 'جائزة من سيربح المليون');
      await telegram.sendMessage(winner.id,
        '🏆 *مبروك! ربحت ' + fmtPrize(winner.prize) + ' في لعبة المليون!*\\n💰 تم إضافة الجائزة لحسابك البنكي!\\n\\nاكتب *فلوسي* لعرض رصيدك.',
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    } catch(_) {}
  }

  await telegram.sendMessage(chatId, txt, { parse_mode: 'Markdown' }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });`;

if (m.includes(oldWinner)) {
  m = m.replace(oldWinner, newWinner);
  console.log('✅ bank winnings added');
} else {
  console.log('⚠️ winner pattern not found');
}

// 2. حذف رسالة السؤال القديمة عند الانتقال للسؤال الجديد
const oldEdit = `    await ctx.telegram.editMessageText(`;
const newEdit = `    // حذف الرسالة القديمة وإرسال جديدة
    try { await ctx.telegram.deleteMessage(chatId, game.msgId).catch(() => {}); } catch(_) {}
    await ctx.telegram.editMessageText(`;

// نبحث عن editMessageText في sendQuestion
const sendQSection = m.indexOf('const txt = buildQuestionMsg(game, q);');
if (sendQSection !== -1) {
  console.log('✅ found sendQuestion section');
}

fs.writeFileSync(mPath, m);
console.log('🏁 Done');
