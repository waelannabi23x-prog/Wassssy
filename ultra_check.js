const fs=require('fs');
const idx=fs.readFileSync('index.js','utf8');
const browse=fs.readFileSync('handlers/browse.js','utf8');
const inter=fs.readFileSync('database/interactions.js','utf8');
const db=fs.readFileSync('database/db.js','utf8');
const auth=fs.readFileSync('middlewares/auth.js','utf8');
const start=fs.readFileSync('handlers/start.js','utf8');

console.log('=== فحص متقدم ===');

// 1. callback_query handler - كم if فيه
const cbSection=idx.substring(idx.indexOf('callback_query'),idx.indexOf('Media groups'));
const ifCount=(cbSection.match(/if \(data/g)||[]).length;
console.log('1. callback_query ifs:',ifCount,'(كثير = بطيء)');

// 2. هل start.js عنده كاش
console.log('2. start cache:', start.includes('cacheGet')?'✅':'❌');

// 3. هل answerCbQuery فوري
console.log('3. answerCbQuery فوري:', idx.includes("answerCbQuery().catch")?'✅':'❌');

// 4. هل فيه unnecessary DB في auth
const authAwaits=(auth.match(/await get\|await all/g)||[]).length;
console.log('4. DB calls في auth:', authAwaits);

// 5. هل getSpecs مكاش في start
console.log('5. precomp في start:', start.includes('precomp')||start.includes('cacheGet')?'✅':'❌');

// 6. هل showMainMenu سريع
const mainMenuAwaits=(start.match(/await /g)||[]).length;
console.log('6. awaits في start.js:', mainMenuAwaits);

// 7. connection pool
const poolMax=db.match(/max:\s*(\d+)/)?.[1];
const poolMin=db.match(/min:\s*(\d+)/)?.[1];
console.log('7. PG pool:', poolMax+'/'+poolMin);

// 8. هل فيه index على DB
console.log('8. DB indexes:', db.includes('CREATE INDEX')?'✅':'❌');

// 9. هل callback handler مرتب (الأكثر استخداماً أول)
const firstCb=cbSection.substring(0,200);
console.log('9. preview أول في CB:', firstCb.includes('preview_')?'✅':'❌');
