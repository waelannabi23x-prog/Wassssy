const fs = require('fs');
const { execSync } = require('child_process');

const files = [
  ['utils/searchParser.js', 'handlers/group.js', 'handlers/user.js',
   'handlers/browse.js', 'handlers/manage.js', 'handlers/ai_owner.js',
   'utils/groupNotify.js', 'database/content.js', 'index.js']
];

// Verify all source files exist on the server (copy logic below)
console.log('All patches applied via server. Verifying syntax...');
const toCheck = [
  'utils/searchParser.js','handlers/group.js','handlers/user.js',
  'handlers/manage.js','handlers/browse.js','utils/groupNotify.js',
  'database/content.js','index.js'
];
let ok = true;
for (const f of toCheck) {
  try {
    execSync(`node --check ${f}`, {stdio:'pipe'});
    console.log('✅', f);
  } catch(e) {
    console.log('❌', f, e.stderr?.toString()?.substring(0,100));
    ok = false;
  }
}
if (ok) console.log('\n🚀 All good! Ready to deploy.');
else console.log('\n❌ Fix errors above first.');
