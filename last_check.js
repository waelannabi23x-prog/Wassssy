const fs=require('fs');
const idx=fs.readFileSync('index.js','utf8');
const db=fs.readFileSync('database/db.js','utf8');
const browse=fs.readFileSync('handlers/browse.js','utf8');

console.log('=== آخر فحص ===');

// هل فيه error handling محسّن
console.log('1. global error handler:', idx.includes('uncaughtException')?'✅':'❌');
console.log('2. unhandledRejection:', idx.includes('unhandledRejection')?'✅':'❌');

// هل فيه memory monitor
console.log('3. memory monitor:', idx.includes('heapUsed')?'✅':'❌');

// هل PG عنده retry
console.log('4. PG retry on error:', db.includes('retry')||db.includes('reconnect')?'✅':'❌');

// هل فيه graceful shutdown
console.log('5. graceful shutdown:', idx.includes('SIGTERM')?'✅':'❌');

// هل فيه health check endpoint
console.log('6. health check:', idx.includes("'/'")||idx.includes('health')?'✅':'❌');

// هل cache يتمسح بانتظام
console.log('7. cache cleanup:', fs.readFileSync('utils/cache.js','utf8').includes('unref')?'✅':'❌');

// هل فيه rate limiting
console.log('8. rate limiting:', idx.includes('checkRL')?'✅':'❌');

// هل فيه compression
console.log('9. compression:', idx.includes('compression')?'✅':'❌');

// حجم الكود
const files=['index.js','handlers/browse.js','handlers/manage.js','database/interactions.js'];
console.log('\n=== حجم الملفات ===');
files.forEach(f=>{ try{console.log(f+':',fs.readFileSync(f,'utf8').split('\n').length,'سطر');}catch{} });
