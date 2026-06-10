const fs = require('fs');
const mPath = process.env.HOME + '/study-bot-backup-20260407_011636/handlers/millionaire.js';
let m = fs.readFileSync(mPath, 'utf8');

// 1. صلح "سجلنا إجابتك" — أضف النص مع الحرف
m = m.replace(
  "await ctx.answerCbQuery(`✅ سجلنا إجابتك: ${LETTERS['abcd'.indexOf(letter)]}`)",
  "await ctx.answerCbQuery(`✅ سجلنا إجابتك: ${LETTERS['abcd'.indexOf(letter)]}) ${game.currentQ?.['option_'+letter] || ''}`)"
);

// 2. صلح hint — أضف النص مع الحرف
m = m.replace(
  "const hint = LETTERS['abcd'.indexOf(q.correct)];\n    const hintText = `_(للمشرف فقط: الجواب ${hint})_`",
  "const hint = LETTERS['abcd'.indexOf(q.correct)];\n    const hintOpt = q['option_' + q.correct] || '';\n    const hintText = `_(للمشرف فقط: الجواب ${hint}) ${hintOpt}_`"
);

// إذا ما وجد النمط الثاني جرب بدونه
if (!m.includes('hintOpt')) {
  m = m.replace(
    "const hint = LETTERS['abcd'.indexOf(q.correct)];",
    "const hint = LETTERS['abcd'.indexOf(q.correct)];\n    const hintOpt = q['option_' + q.correct] || '';"
  );
  m = m.replace(
    "`_(للمشرف فقط: الجواب ${hint})_`",
    "`_(للمشرف فقط: الجواب ${hint}) ${hintOpt}_`"
  );
}

fs.writeFileSync(mPath, m);
console.log('✅ Done');
