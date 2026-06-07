const fs = require('fs');
const indexPath = process.env.HOME + '/study-bot-backup-20260407_011636/index.js';
let idx = fs.readFileSync(indexPath, 'utf8');

// أضف مليون في bank handler قبل auth
const oldBank = `      if (/^انشاء حساب$|^فلوسي$|^فارسي|^rip /i.test(txt)) {`;
const newBank = `      if (/^مليون$/i.test(txt)) {
        try { 
          const mil = require('./handlers/millionaire');
          const fakeCtx = Object.assign({}, ctx);
          await mil.register; // already registered
          // trigger manually
          if (ctx.chat?.type !== 'private') {
            const { startJoinPhase } = require('./handlers/millionaire');
            if (startJoinPhase) await startJoinPhase(ctx).catch(() => {});
          }
        } catch(e) { require('./utils/logger').error('[Million]', e.message); }
        return;
      }
      if (/^انشاء حساب$|^فلوسي$|^فارسي|^rip /i.test(txt)) {`;

idx = idx.replace(oldBank, newBank);
fs.writeFileSync(indexPath, idx);
console.log('✅ Done');
