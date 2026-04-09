const fs=require('fs');
const browse=fs.readFileSync('handlers/browse.js','utf8');
const inter=fs.readFileSync('database/interactions.js','utf8');
const db=fs.readFileSync('database/db.js','utf8');
const files=fs.readFileSync('database/files.js','utf8');
const start=fs.readFileSync('handlers/start.js','utf8');
const idx=fs.readFileSync('index.js','utf8');

console.log('=== فحص نهائي شامل ===\n');

// Cache TTLs
const ttls=browse.match(/cacheSet\([^,]+,[^,]+,(\d+)\)/g)||[];
console.log('Browse TTLs:');
ttls.forEach(t=>{ const ms=parseInt(t.match(/,(\d+)\)$/)[1]); console.log(' ',ms/1000+'s',t.substring(0,50)); });

// Queries بدون conversion
const badQ=(inter.match(/await (get|all)\('[^']*\?/g)||[]).length;
console.log('\n❌ Queries تستخدم ? بدل $:', badQ);

// Missing caches
console.log('\n=== Missing optimizations ===');
console.log('getSpecialty cache:', inter.includes('getSpecialty')||files.includes('getSpecialty')?'يحتاج فحص':'✅ مو موجود');
console.log('showBundle cache:', browse.includes('cacheGet')&&browse.includes('showBundle')?'✅':'❌ ناقص');
console.log('comments cache:', browse.includes('countComments')&&inter.includes('countComments')?'❌ بدون كاش':'✅');
console.log('start menu cache:', start.includes('menu_data_')?'✅':'❌');
console.log('usersDb.getSpecialty cache:', fs.readFileSync('database/users.js','utf8').includes('cacheGet')?'✅':'❌');

// PG settings
console.log('\n=== PG Settings ===');
console.log('statement_timeout:', db.includes('statement_timeout')?'✅':'❌ ناقص');
console.log('query_timeout:', db.includes('query_timeout')?'✅':'❌ ناقص');
