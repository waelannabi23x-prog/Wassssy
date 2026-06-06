const fs = require('fs');
const BASE = process.env.HOME + '/study-bot-backup-20260407_011636';
const gamePath = BASE + '/handlers/guess_game.js';
let game = fs.readFileSync(gamePath, 'utf8');

// 1. تحسين رسالة الدعوة الأولى (خمن)
const oldInvite = "  const m = await ctx.telegram.sendMessage(chatId,\n" +
"    `🎮 *تحدي خمن الصورة\\!*\\n` +\n" +
"    `━━━━━━━━━━━━━━━\\n` +\n" +
"    `👤 *${esc(uname(user))}* يتحدى الجميع\\!\\n\\n` +\n" +
"    `📸 *طريقة اللعب:*\\n` +\n" +
"    `1️⃣ اكتب *انا* للانضمام\\n` +\n" +
"    `2️⃣ افتح البوت وأرسل صورة سرية\\n` +\n" +
"    `3️⃣ تحدّث مع منافسك بحرية\\n` +\n" +
"    `4️⃣ أول من يخمن صورة خصمه يفوز\\! 🏆\\n\\n` +\n" +
"    `⏳ *60 ثانية* للانضمام`,\n" +
"    { parse_mode: 'MarkdownV2' }\n" +
"  ).catch(() => null);";

const _bu_fetch = `
  const _botInfo = await ctx.telegram.getMe().catch(() => ({ username: '' }));
  const _botLink = _botInfo.username ? \`https://t.me/\${_botInfo.username}\` : '';
`;

const newInvite = _bu_fetch + 
"  const m = await ctx.telegram.sendMessage(chatId,\n" +
"    `🎮 *تحدي خمن الصورة!*\\n` +\n" +
"    `━━━━━━━━━━━━━━━━━━━━\\n` +\n" +
"    `👤 ${mention(user)} يتحدى الجميع!\\n\\n` +\n" +
"    `📌 *كيف تلعب؟*\\n` +\n" +
"    `1️⃣ اضغط زر *انضمام للعبة* أدناه\\n` +\n" +
"    `2️⃣ افتح البوت وأرسل صورة سرية\\n` +\n" +
"    `3️⃣ تحدّث مع منافسك بحرية\\n` +\n" +
"    `4️⃣ أول من يخمن صورة خصمه يفوز 🏆\\n\\n` +\n" +
"    `⏳ *60 ثانية* للانضمام`,\n" +
"    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🎮 انضمام للعبة', url: _botLink + '?start=join_' + chatId }]] } }\n" +
"  ).catch(() => null);";

// 2. تحسين رسالة اكتمال المباراة
const oldReady = "  const m = await ctx.telegram.sendMessage(chatId,\n" +
"    `✅ *اكتملت المباراة!*\\n` +\n" +
"    `┄┄┄┄┄┄┄┄┄┄\\n` +\n" +
"    `🔴 ${mention(game.p1)}\\n` +\n" +
"    `🔵 ${mention(game.p2)}\\n\\n` +\n" +
"    `📲 *تحقق من رسائلك الخاصة مع البوت*\\n` +\n" +
"    `⏳ عندكم *5 دقائق* لإرسال الصور`,\n" +
"    { parse_mode: 'Markdown' }\n" +
"  ).catch(() => null);";

const newReady = "  const _bu2 = await ctx.telegram.getMe().catch(() => ({ username: '' }));\n" +
"  const _bl2 = _bu2.username ? `https://t.me/${_bu2.username}` : '';\n" +
"  const m = await ctx.telegram.sendMessage(chatId,\n" +
"    `🎯 *المباراة بدأت!*\\n` +\n" +
"    `━━━━━━━━━━━━━━━━━━━━\\n` +\n" +
"    `🔴 ${mention(game.p1)}\\n` +\n" +
"    `🔵 ${mention(game.p2)}\\n\\n` +\n" +
"    `⏳ عندكم *5 دقائق* لإرسال الصور السرية\\n` +\n" +
"    `📲 افتح البوت وأرسل صورتك الآن!`,\n" +
"    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [\n" +
"      [{ text: '📸 أرسل صورتك للبوت', url: _bl2 }]\n" +
"    ]}}\n" +
"  ).catch(() => null);";

if (game.includes(oldInvite.substring(0, 50))) {
  game = game.replace(oldInvite, newInvite);
  console.log('✅ invite msg updated');
} else {
  console.log('⚠️ invite msg pattern not exact — skipping');
}

if (game.includes(oldReady.substring(0, 50))) {
  game = game.replace(oldReady, newReady);
  console.log('✅ ready msg updated');
} else {
  console.log('⚠️ ready msg pattern not exact — skipping');
}

fs.writeFileSync(gamePath, game);
console.log('🏁 Done');
