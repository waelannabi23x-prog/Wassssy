const fs = require('fs');
const gpPath = process.env.HOME + '/study-bot-backup-20260407_011636/handlers/games_panel.js';
let gp = fs.readFileSync(gpPath, 'utf8');

const old = `    const answerMap = { 'أ': optA, 'ب': optB, 'ج': optC, 'د': optD };
    const correct = answerMap[answerLine] || answerLine;

    await run(
      'INSERT INTO million_questions(text, option_a, option_b, option_c, option_d, correct, difficulty, is_active) VALUES($1,$2,$3,$4,$5,$6,$7,1)',
      [question, optA, optB, optC, optD, correct, 'medium']
    ).catch(() => {});
    await delState(uid);
    await ctx.reply('✅ *تم إضافة السؤال!*\\n\\n❓ ' + question + '\\n✅ الإجابة: ' + correct, { parse_mode: 'Markdown' }).catch(() => {});`;

const neww = `    // حوّل الإجابة لحرف a/b/c/d
    const answerLetterMap = { 'أ': 'a', 'ب': 'b', 'ج': 'c', 'د': 'd', 'a': 'a', 'b': 'b', 'c': 'c', 'd': 'd' };
    const correctLetter = answerLetterMap[answerLine] || 'a';
    const correctText = { 'a': optA, 'b': optB, 'c': optC, 'd': optD }[correctLetter];

    await run(
      'INSERT INTO million_questions(text, option_a, option_b, option_c, option_d, correct, difficulty, is_active) VALUES($1,$2,$3,$4,$5,$6,$7,1)',
      [question, optA, optB, optC, optD, correctLetter, 'medium']
    ).catch(() => {});
    await delState(uid);
    await ctx.reply('✅ *تم إضافة السؤال!*\\n\\n❓ ' + question + '\\n✅ الإجابة: ' + correctText, { parse_mode: 'Markdown' }).catch(() => {});`;

if (gp.includes(old)) {
  gp = gp.replace(old, neww);
  fs.writeFileSync(gpPath, gp);
  console.log('✅ Done');
} else {
  console.log('❌ not found');
}
