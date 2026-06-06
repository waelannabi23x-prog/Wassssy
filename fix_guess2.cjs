const fs = require('fs');
const gamePath = process.env.HOME + '/study-bot-backup-20260407_011636/handlers/guess_game.js';
let game = fs.readFileSync(gamePath, 'utf8');

// 1. حذف زر انضمام من رسالة الدعوة
game = game.replace(
  "{ parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🎮 انضمام للعبة', url: _botLink + '?start=join_' + chatId }]] } }",
  "{ parse_mode: 'Markdown' }"
);

// 2. تحسين رسالة "افتح البوت" في القروب
game = game.replace(
  "`📌 ${mention(user)} افتح البوت وأرسل صورتك السرية\\!`",
  "`📌 ${mention(user)} أرسل صورتك السرية للبوت!`"
);

fs.writeFileSync(gamePath, game);
console.log('✅ Done');
