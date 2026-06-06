const fs = require('fs');
const BASE = process.env.HOME + '/study-bot-backup-20260407_011636';

// ══════════════════════════════════════════
// 1. ربط البنك بلعبة مليون
// ══════════════════════════════════════════
const millionPath = BASE + '/handlers/million_battle.js';
let million = fs.readFileSync(millionPath, 'utf8');

const oldWinner = "    try { const { awardPoints } = require('../database/points'); await awardPoints(winner.id, 'rating').catch(err => { require('../utils/logger').debug(\"[silent]\", err.message); }); } catch (_) {}";

const newWinner = "    try { const { awardPoints } = require('../database/points'); await awardPoints(winner.id, 'rating').catch(err => { require('../utils/logger').debug(\"[silent]\", err.message); }); } catch (_) {}\n    // ── إضافة الجائزة للبنك ──\n    try {\n      const bank = require('./bank');\n      await bank.addWinnings(winner.id, winner.first_name, winner.username, finalPrize, 'جائزة لعبة مليون');\n      await ctx.telegram.sendMessage(winner.id,\n        '💰 *ربحت ' + finalPrize + ' $ في لعبة مليون!*\\n💳 تم إضافة الجائزة لحسابك البنكي.',\n        { parse_mode: 'Markdown' }\n      ).catch(() => {});\n    } catch(_) {}";

if (million.includes(oldWinner)) {
  million = million.replace(oldWinner, newWinner);
  fs.writeFileSync(millionPath, million);
  console.log('✅ million_battle.js updated');
} else {
  console.log('⚠️ million pattern not exact');
}

// ══════════════════════════════════════════
// 2. ربط البنك بلعبة خمن
// ══════════════════════════════════════════
const guessPath = BASE + '/handlers/guess_game.js';
let guess = fs.readFileSync(guessPath, 'utf8');

const oldGuessWin = "  for (const p of [winner, { id: loser.id }]) {\n    const msg = s(p.id) === s(winner.id)\n      ? `🏆 *فزت!* أحسنت، خمّنت صورة منافسك! 💪🎊`\n      : `😔 *خسرت هذه الجولة*\\nمنافسك كان أسرع! حظاً أوفر المرة القادمة 🍀`;\n    await telegram.sendMessage(p.id, msg, { parse_mode: 'Markdown' }).catch(() => {});\n  }";

const GUESS_PRIZE = 500;
const newGuessWin = "  // ── إضافة جائزة لعبة خمن للبنك ──\n  try {\n    const bank = require('./bank');\n    await bank.addWinnings(winner.id, winner.first_name, winner.username, " + GUESS_PRIZE + ", 'جائزة لعبة خمن');\n  } catch(_) {}\n\n  for (const p of [winner, { id: loser.id }]) {\n    const isWinner = s(p.id) === s(winner.id);\n    const msg = isWinner\n      ? '🏆 *فزت!* أحسنت، خمّنت صورة منافسك! 💪🎊\\n\\n💰 *ربحت " + GUESS_PRIZE + " $* تم إضافتها لحسابك البنكي!'\n      : '😔 *خسرت هذه الجولة*\\nمنافسك كان أسرع! حظاً أوفر المرة القادمة 🍀';\n    await telegram.sendMessage(p.id, msg, { parse_mode: 'Markdown' }).catch(() => {});\n  }";

if (guess.includes("for (const p of [winner, { id: loser.id }])")) {
  guess = guess.replace(oldGuessWin, newGuessWin);
  fs.writeFileSync(guessPath, guess);
  console.log('✅ guess_game.js updated');
} else {
  console.log('⚠️ guess pattern not exact — trying simple insert');
  guess = guess.replace(
    "  for (const p of [winner, { id: loser.id }]) {",
    "  // ── جائزة البنك ──\n  try { const bank = require('./bank'); await bank.addWinnings(winner.id, winner.first_name, winner.username, " + GUESS_PRIZE + ", 'جائزة لعبة خمن'); } catch(_) {}\n\n  for (const p of [winner, { id: loser.id }]) {"
  );
  fs.writeFileSync(guessPath, guess);
  console.log('✅ guess_game.js updated (simple)');
}

console.log('🏁 Done');
