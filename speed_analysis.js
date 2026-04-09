const fs=require('fs');
const browse=fs.readFileSync('handlers/browse.js','utf8');

// showFiles كامل
const sfStart=browse.indexOf('async function showFiles');
const sfEnd=browse.indexOf('async function showPreview');
const sf=browse.substring(sfStart,sfEnd);
console.log('=== showFiles ===');
console.log('awaits:',(sf.match(/await /g)||[]).length);
console.log('DB calls:',(sf.match(/await (get|all)/g)||[]).length);
console.log('cache hits:',(sf.match(/cacheGet/g)||[]).length);
console.log('cache sets:',(sf.match(/cacheSet/g)||[]).length);
console.log(sf.substring(0,1000));
