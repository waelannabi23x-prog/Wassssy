const fs=require('fs');
const browse=fs.readFileSync('handlers/browse.js','utf8');
const inter=fs.readFileSync('database/interactions.js','utf8');
const db=fs.readFileSync('database/db.js','utf8');

console.log('=== فحص دقيق ===');

// شوف كم await في showPreview
const previewFn=browse.substring(browse.indexOf('async function showPreview'),browse.indexOf('async function showReportMenu'));
const awaitCount=(previewFn.match(/await /g)||[]).length;
console.log('awaits في showPreview:',awaitCount,'(المثالي: 2)');

// شوف كم await في showFiles
const filesFn=browse.substring(browse.indexOf('async function showFiles'),browse.indexOf('async function showPreview'));
const awaitCount2=(filesFn.match(/await /g)||[]).length;
console.log('awaits في showFiles:',awaitCount2,'(المثالي: 1-2)');

// شوف كم await في sendFile
const sendFn=browse.substring(browse.indexOf('async function sendFile'),browse.indexOf('async function showBundle'));
const awaitCount3=(sendFn.match(/await /g)||[]).length;
console.log('awaits في sendFile:',awaitCount3,'(المثالي: 2-3)');

// شوف الـ pool size
const poolMatch=db.match(/max:\s*(\d+)/);
console.log('DB pool size:',poolMatch?poolMatch[1]:'غير موجود');

// شوف TTL values
const ttls=browse.match(/cacheSet\([^,]+,[^,]+,(\d+)\)/g)||[];
console.log('Cache TTLs في browse:',ttls.map(t=>t.match(/,(\d+)\)/)[1]/1000+'s'));
