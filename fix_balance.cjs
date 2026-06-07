const fs = require('fs');
const bankPath = process.env.HOME + '/study-bot-backup-20260407_011636/handlers/bank.js';
let bank = fs.readFileSync(bankPath, 'utf8');

bank = bank.replace(
  `  const replyTo = ctx.message?.reply_to_message;
  const targetId = replyTo ? replyTo.from?.id : uid;
  const isSelf = targetId === uid;`,
  `  // فلوسي = دائماً رصيد المستخدم نفسه
  const targetId = uid;
  const isSelf = true;`
);

fs.writeFileSync(bankPath, bank);
console.log('✅ Done');
