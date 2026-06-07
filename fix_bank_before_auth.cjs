const fs = require('fs');
const indexPath = process.env.HOME + '/study-bot-backup-20260407_011636/index.js';
let idx = fs.readFileSync(indexPath, 'utf8');

// أضف bank handler قبل authMiddleware
const oldAuth = 'bot.use(authMiddleware);';

const newAuth = `// ── كومندز البنك في القروب (قبل auth) ──
bot.use(async (ctx, next) => {
  if (!ctx.message || !['group','supergroup'].includes(ctx.chat?.type)) return next();
  const txt = (ctx.message?.text || '').trim();
  if (/^انشاء حساب$|^فلوسي$|^فارسي|^rip /i.test(txt)) {
    try {
      const bank = require('./handlers/bank');
      if (/^انشاء حساب$/i.test(txt)) return bank.createAccount(ctx);
      if (/^فلوسي$/i.test(txt)) return bank.showBalance(ctx);
      if (/^فارسي/i.test(txt)) return bank.transfer(ctx);
      if (/^rip /i.test(txt)) return bank.loan(ctx);
    } catch(e) { require('./utils/logger').error('[Bank]', e.message); }
  }
  return next();
});

bot.use(authMiddleware);`;

idx = idx.replace(oldAuth, newAuth);
fs.writeFileSync(indexPath, idx);
console.log('✅ Done');
