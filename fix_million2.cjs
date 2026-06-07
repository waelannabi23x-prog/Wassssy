const fs = require('fs');
const indexPath = process.env.HOME + '/study-bot-backup-20260407_011636/index.js';
let idx = fs.readFileSync(indexPath, 'utf8');

// استبدل الكود الخاطئ
const oldMillion = `      if (/^مليون$/i.test(txt)) {
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
      }`;

const newMillion = `      if (/^مليون$/i.test(txt)) {
        try {
          const { startJoinPhase } = require('./handlers/millionaire');
          await startJoinPhase(ctx);
        } catch(e) { require('./utils/logger').error('[Million]', e.message); }
        return;
      }`;

if (idx.includes(oldMillion.substring(0, 40))) {
  idx = idx.replace(oldMillion, newMillion);
  fs.writeFileSync(indexPath, idx);
  console.log('✅ Done');
} else {
  // بحث جزئي
  const start = idx.indexOf("if (/^مليون$/i.test(txt))");
  const end = idx.indexOf("return;\n      }", start) + "return;\n      }".length;
  if (start !== -1) {
    idx = idx.slice(0, start) + `if (/^مليون$/i.test(txt)) {
        try {
          const { startJoinPhase } = require('./handlers/millionaire');
          await startJoinPhase(ctx);
        } catch(e) { require('./utils/logger').error('[Million]', e.message); }
        return;
      }` + idx.slice(end);
    fs.writeFileSync(indexPath, idx);
    console.log('✅ Done (partial match)');
  } else {
    console.log('❌ not found');
  }
}
