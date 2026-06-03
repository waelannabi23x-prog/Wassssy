const fs = require('fs');
let c = fs.readFileSync('routes/api.js', 'utf8');

// استبدل كل admin checks المكررة بـ _checkAdmin
const adminChecks = [
  // pattern → replacement
  [`  const adm = await get('SELECT permissions FROM admins WHERE user_id=$1', [uid]);
  const [dlCount, favCount, cmtCount, ratingCount, spRow] = await Promise.all([`,
   `  const [isAdm, dlCount, favCount, cmtCount, ratingCount, spRow] = await Promise.all([
    _checkAdmin(uid),`],
];

// استبدل كل occurrences مباشرة
let count = 0;
const patterns = [
  `const adm = await get('SELECT * FROM admins WHERE user_id=\\$1', [uid]);\\n  if (uid !== OWNER_ID && !adm)`,
];

// نهج أبسط — استبدل الـ 6 admin checks المتشابهة
c = c.replace(
  /const adm = await get\('SELECT \* FROM admins WHERE user_id=\$1', \[uid\]\);\s*\n\s*if \(uid !== OWNER_ID && !adm\) return res\.status\(403\)\.json\(\{ error: 'forbidden' \}\);/g,
  `if (!await _checkAdmin(uid) && uid !== OWNER_ID) return res.status(403).json({ error: 'forbidden' });`
);

count = (c.match(/_checkAdmin/g) || []).length;
console.log('_checkAdmin references:', count);
fs.writeFileSync('routes/api.js', c);
