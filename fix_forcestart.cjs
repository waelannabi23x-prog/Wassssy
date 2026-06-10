const fs = require('fs');
const mPath = process.env.HOME + '/study-bot-backup-20260407_011636/handlers/millionaire.js';
let m = fs.readFileSync(mPath, 'utf8');

// أضف forceStart قبل register function
const target = 'function register(bot) {';

const forceStartFn = `async function forceStart(ctx) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  if (!ctx.isAdmin && !ctx.isOwner) {
    return ctx.answerCbQuery('🚫 للأدمن فقط.', { show_alert: true }).catch(() => {});
  }
  const game = getGame(chatId);
  if (!game || game.status !== 'waiting') {
    return ctx.answerCbQuery('⚠️ لا توجد لعبة في انتظار.', { show_alert: true }).catch(() => {});
  }
  if (game.joinTimer) { clearTimeout(game.joinTimer); game.joinTimer = null; }
  await ctx.answerCbQuery('▶️ بدأت اللعبة!').catch(() => {});
  return beginGame(ctx.telegram, chatId);
}

`;

if (!m.includes('async function forceStart')) {
  m = m.replace(target, forceStartFn + target);
  fs.writeFileSync(mPath, m);
  console.log('✅ forceStart added');
} else {
  console.log('⏭️ already exists');
}
