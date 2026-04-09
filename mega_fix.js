const fs=require('fs');

// 1. رفع كل TTLs في browse
let browse=fs.readFileSync('handlers/browse.js','utf8');
browse=browse.replace(/cacheSet\(key, result, 600000\)/g,'cacheSet(key, result, 3600000)');
browse=browse.replace(/cacheSet\(ckey,yd,600000\)/g,'cacheSet(ckey,yd,3600000)');
browse=browse.replace(/cacheSet\(ckey,sd,600000\)/g,'cacheSet(ckey,sd,3600000)');
browse=browse.replace(/cacheSet\(ckey,subd,600000\)/g,'cacheSet(ckey,subd,3600000)');
browse=browse.replace(/cacheSet\(ckey,catd,600000\)/g,'cacheSet(ckey,catd,3600000)');
browse=browse.replace('cacheSet(userKey,{text,extra},120000)','cacheSet(userKey,{text,extra},300000)');
fs.writeFileSync('handlers/browse.js',browse);
console.log('✅ browse TTLs fixed');

// 2. إصلاح queries تستخدم ? بدل $1 في interactions
let inter=fs.readFileSync('database/interactions.js','utf8');
inter=inter.replace(
  "await get('SELECT 1 FROM favorites WHERE user_id=$1 AND file_id=$2',[uid,fid])",
  "await get('SELECT 1 FROM favorites WHERE user_id=$1 AND file_id=$2',[uid,fid])"
);
inter=inter.replace(
  "await get('SELECT rating FROM ratings WHERE user_id=? AND file_id=?',[uid,fid])",
  "await get('SELECT rating FROM ratings WHERE user_id=$1 AND file_id=$2',[uid,fid])"
);
inter=inter.replace(
  "'SELECT file_id FROM favorites WHERE user_id=? AND file_id IN ('+ph+')',[uid,...fileIds]",
  "'SELECT file_id FROM favorites WHERE user_id=$1 AND file_id IN ('+ph+')',[uid,...fileIds]"
);
inter=inter.replace(
  "'SELECT file_id, ROUND(AVG(rating),1) as avg FROM ratings WHERE file_id IN ('+ph+') GROUP BY file_id',[...fileIds]",
  "'SELECT file_id, ROUND(AVG(rating),1) as avg FROM ratings WHERE file_id IN ('+ph+') GROUP BY file_id',[...fileIds]"
);
// getLastFile cache رفعه لـ 10 دقائق
inter=inter.replace('cacheSet(key,r,180000)','cacheSet(key,r,600000)');
// isFav cache رفعه
inter=inter.replace(/cacheSet\(key,r,600000\);\n  return r;\n\};\n\nconst addFav/,'cacheSet(key,r,1800000);\n  return r;\n};\n\nconst addFav');
// favCount cache
inter=inter.replace(/cacheSet\(key,r,600000\);\n  return r;\n\};\n\nconst addHistory/,'cacheSet(key,r,3600000);\n  return r;\n};\n\nconst addHistory');
fs.writeFileSync('database/interactions.js',inter);
console.log('✅ interactions queries + TTLs fixed');

// 3. رفع getFiles TTL من 300s لـ 600s
let files=fs.readFileSync('database/files.js','utf8');
files=files.replace('cacheSet(k,r,300000)','cacheSet(k,r,600000)');
fs.writeFileSync('database/files.js',files);
console.log('✅ files TTL fixed');

// 4. رفع analytics cache
let manage=fs.readFileSync('handlers/manage.js','utf8');
manage=manage.replace('cacheSet(_ckey,{text,rows},300000)','cacheSet(_ckey,{text,rows},600000)');
fs.writeFileSync('handlers/manage.js',manage);
console.log('✅ analytics cache fixed');

console.log('\n✅ كل شي جاهز');
