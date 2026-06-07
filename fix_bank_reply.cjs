const fs = require('fs');
const bankPath = process.env.HOME + '/study-bot-backup-20260407_011636/handlers/bank.js';
let bank = fs.readFileSync(bankPath, 'utf8');

// كل ctx.reply يصبح مع reply_to_message_id
bank = bank.replace(
  /ctx\.reply\(([\s\S]*?)\)\.catch\(\(\) => \{\}\)/g,
  (match, args) => {
    if (match.includes('reply_to_message_id')) return match;
    // أضف reply_to_message_id
    if (args.includes('{ parse_mode:')) {
      return match.replace(
        "{ parse_mode: 'Markdown' }",
        "{ parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }"
      );
    }
    return match;
  }
);

fs.writeFileSync(bankPath, bank);
console.log('✅ Done');
