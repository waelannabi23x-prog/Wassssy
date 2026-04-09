const fs=require('fs');
const browse=fs.readFileSync('handlers/browse.js','utf8');
const inter=fs.readFileSync('database/interactions.js','utf8');
const content=fs.readFileSync('database/content.js','utf8');
const files=fs.readFileSync('database/files.js','utf8');

// شوف كم await في كل function رئيسية
function countAwaits(code, fnName, endFn) {
  const start=code.indexOf('async function '+fnName);
  const end=endFn?code.indexOf('async function '+endFn):code.indexOf('module.exports');
  if(start===-1) return '❓';
  const fn=code.substring(start,end);
  return (fn.match(/await /g)||[]).length;
}

console.log('=== عدد awaits في كل function ===');
console.log('showSpecs:', countAwaits(browse,'showSpecs','showYears'));
console.log('showYears:', countAwaits(browse,'showYears','showSemesters'));
console.log('showSemesters:', countAwaits(browse,'showSemesters','showSubjects'));
console.log('showSubjects:', countAwaits(browse,'showSubjects','showCategories'));
console.log('showCategories:', countAwaits(browse,'showCategories','showFiles'));
console.log('showFiles:', countAwaits(browse,'showFiles','showPreview'));
console.log('showPreview:', countAwaits(browse,'showPreview','showReportMenu'));
console.log('sendFile:', countAwaits(browse,'sendFile','showBundle'));

console.log('\n=== فحص الكاش ===');
console.log('getSpecs TTL 1hr:', content.includes('TTL')&&content.includes('3600000')?'✅':'❌');
console.log('getFiles TTL 5min:', files.includes('300000')?'✅':'❌');
console.log('showFiles static 900s:', browse.includes('900000')?'✅':'❌');
console.log('showPreview static 1800s:', browse.includes('1800000')?'✅':'❌');
console.log('per-user 120s:', browse.includes('120000')?'✅':'❌');

console.log('\n=== Promise.all usage ===');
const allCount=(browse.match(/Promise\.all/g)||[]).length;
console.log('Promise.all في browse:', allCount,'مرة');
