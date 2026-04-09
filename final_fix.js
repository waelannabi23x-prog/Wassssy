const fs=require('fs');

// 1. إصلاح الـ 4 queries بدل ?
let inter=fs.readFileSync('database/interactions.js','utf8');
inter=inter.replace(
  "await all(J+' JOIN history h ON h.file_id=f.id WHERE h.user_id=? AND f.is_deleted=0 ORDER BY h.viewed_at DESC LIMIT ?',[uid,n])",
  "await all(J+' JOIN history h ON h.file_id=f.id WHERE h.user_id=$1 AND f.is_deleted=0 ORDER BY h.viewed_at DESC LIMIT $2',[uid,n])"
);
inter=inter.replace(
  "await all(J+' WHERE f.is_deleted=0 ORDER BY f.downloads DESC LIMIT ?',[limit])",
  "await all(J+' WHERE f.is_deleted=0 ORDER BY f.downloads DESC LIMIT $1',[limit])"
);
inter=inter.replace(
  "await all(J+' WHERE f.id!=? AND f.is_deleted=0 AND f.category_id=? ORDER BY f.downloads DESC LIMIT ?',[fileId,f.category_id,limit])",
  "await all(J+' WHERE f.id!=$1 AND f.is_deleted=0 AND f.category_id=$2 ORDER BY f.downloads DESC LIMIT $3',[fileId,f.category_id,limit])"
);
inter=inter.replace(
  "await get('SELECT ROUND(AVG(rating),1) as avg, COUNT(*) as cnt FROM ratings WHERE file_id=?',[fid])",
  "await get('SELECT ROUND(AVG(rating),1) as avg, COUNT(*) as cnt FROM ratings WHERE file_id=$1',[fid])"
);
fs.writeFileSync('database/interactions.js',inter);
console.log('✅ queries fixed');

// 2. كاش getSpecialty في users.js
let users=fs.readFileSync('database/users.js','utf8');
if(!users.includes('cacheGet')){
  users="const { cacheGet, cacheSet } = require('../utils/cache');\n"+users;
  users=users.replace(
    /const getSpecialty\s*=\s*(?:async\s*)?\(?uid\)?\s*=>\s*(?:await\s*)?get\([^;]+;/,
    `const getSpecialty = async uid => {
  const k='sp_'+uid;
  const c=cacheGet(k);
  if(c!==null) return c;
  const r=await get('SELECT specialty_id FROM user_specialties WHERE user_id=$1',[uid]);
  cacheSet(k,r,600000);
  return r;
};`
  );
  fs.writeFileSync('database/users.js',users);
  console.log('✅ users getSpecialty cached');
} else console.log('✅ users already cached');

// 3. PG timeouts
let db=fs.readFileSync('database/db.js','utf8');
db=db.replace(
  'connectionTimeoutMillis: 10000,',
  'connectionTimeoutMillis: 5000,\n      statement_timeout: 10000,\n      query_timeout: 10000,'
);
fs.writeFileSync('database/db.js',db);
console.log('✅ PG timeouts added');

