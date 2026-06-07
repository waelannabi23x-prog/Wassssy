const fs = require('fs');
const indexPath = process.env.HOME + '/study-bot-backup-20260407_011636/index.js';
let idx = fs.readFileSync(indexPath, 'utf8');

const oldNext = `    } catch(_) {}
    return next();
  });
const apiRoutes = require('./routes/api');`;

const newNext = `    } catch(_) {}

    // ── كومندز البنك في القروب ──
    try {
      const txt = (ctx.message?.text || '').trim();
      const bank = require('./handlers/bank');
      if (/^انشاء حساب$/i.test(txt)) { await bank.createAccount(ctx); return; }
      if (/^فلوسي$/i.test(txt)) { await bank.showBalance(ctx); return; }
      if (/^فارسي/i.test(txt)) { await bank.transfer(ctx); return; }
      if (/^rip /i.test(txt)) { await bank.loan(ctx); return; }
    } catch(_) {}

    return next();
  });
const apiRoutes = require('./routes/api');`;

if (idx.includes(oldNext)) {
  idx = idx.replace(oldNext, newNext);
  fs.writeFileSync(indexPath, idx);
  console.log('✅ Done');
} else {
  console.log('❌ pattern not found');
}
