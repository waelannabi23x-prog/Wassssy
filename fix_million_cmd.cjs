const fs = require('fs');
const BASE = process.env.HOME + '/study-bot-backup-20260407_011636';
const mPath = BASE + '/handlers/millionaire.js';
let m = fs.readFileSync(mPath, 'utf8');

// 1. إضافة كومند مليون بالعربي + hears
const oldCmd = `  bot.command('million', async ctx => {
    if (ctx.chat?.type === 'private') return ctx.reply('⚠️ هذه اللعبة للقروبات فقط!').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    return startJoinPhase(ctx);
  });`;

const newCmd = `  bot.command('million', async ctx => {
    if (ctx.chat?.type === 'private') return ctx.reply('⚠️ هذه اللعبة للقروبات فقط!').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    return startJoinPhase(ctx);
  });

  bot.hears(/^مليون$/i, async ctx => {
    if (ctx.chat?.type === 'private') return ctx.reply('⚠️ هذه اللعبة للقروبات فقط!').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    return startJoinPhase(ctx);
  });`;

m = m.replace(oldCmd, newCmd);
console.log('✅ added مليون hears');

// 2. خليها تقبل لاعب واحد — ابدأ فوراً بعد الانضمام الأول
const oldJoinEnd = `  if (game.joinTimer) { clearTimeout(game.joinTimer); game.joinTimer = null; }
  await ctx.answerCbQuery('▶️ بدأت اللعبة!').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  return beginGame(ctx.telegram, ctx.chat.id);`;

// شوف joinGame function
const joinEnd = m.indexOf('  // Update join message');
console.log('joinEnd at:', joinEnd);

// نضيف في index.js hears مليون بديلة
const indexPath = BASE + '/index.js';
let idx = fs.readFileSync(indexPath, 'utf8');

// إضافة في القروب hears للمليون
const oldBank = `      if (/^انشاء حساب$|^فلوسي$|^فارسي|^rip /i.test(txt)) {`;
const newBank = `      if (/^مليون$/i.test(txt)) {
        try { require('./handlers/millionaire').register; } catch(_) {}
        // يشغل اللعبة عبر hears مسجّل في register
        return next();
      }
      if (/^انشاء حساب$|^فلوسي$|^فارسي|^rip /i.test(txt)) {`;

idx = idx.replace(oldBank, newBank);
fs.writeFileSync(indexPath, idx);
console.log('✅ index.js updated');

fs.writeFileSync(mPath, m);
console.log('🏁 Done');
