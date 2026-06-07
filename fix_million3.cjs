const fs = require('fs');
const indexPath = process.env.HOME + '/study-bot-backup-20260407_011636/index.js';
let idx = fs.readFileSync(indexPath, 'utf8');

const old = `      if (/^مليون$/i.test(txt)) {
        try { require('./handlers/millionaire').register; } catch(_) {}
        // يشغل اللعبة عبر hears مسجّل في register
        return next();
      }
      if (/^مليون$/i.test(txt)) {
        try {
          const { startJoinPhase } = require('./handlers/millionaire');
          await startJoinPhase(ctx);
        } catch(e) { require('./utils/logger').error('[Million]', e.message); }
        return;
      }`;

const neww = `      if (/^مليون$/i.test(txt)) {
        try {
          const { startJoinPhase } = require('./handlers/millionaire');
          await startJoinPhase(ctx);
        } catch(e) { require('./utils/logger').error('[Million]', e.message); }
        return;
      }`;

idx = idx.replace(old, neww);
fs.writeFileSync(indexPath, idx);
console.log('✅ Done');
