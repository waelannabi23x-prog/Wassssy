const fs = require('fs');
const mPath = process.env.HOME + '/study-bot-backup-20260407_011636/handlers/millionaire.js';
let m = fs.readFileSync(mPath, 'utf8');

// استبدل handleLifeline بـ useLifeline
m = m.replace(
  "if (d.startsWith('mlr_'))    return handleLifeline(ctx, d);",
  "if (d.startsWith('mlr_')) {\n      const type = d.substring(4); // mlr_fifty → fifty\n      if (['fifty','audience','call','skip'].includes(type)) return useLifeline(ctx, type);\n      return ctx.answerCbQuery().catch(() => {});\n    }"
);

fs.writeFileSync(mPath, m);
console.log('✅ Done');
