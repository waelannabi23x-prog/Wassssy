const fs = require('fs');
let idx = fs.readFileSync('index.js', 'utf8');

// 1. نضيف endpoint لعرض الأخطاء بالتفصيل
idx = idx.replace(
  "app.get('/health', (req, res) => {",
  `app.get('/debug-query', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ dbType: process.env.DATABASE_URL ? 'pg' : 'sqlite', git: require('child_process').execSync('git log --oneline -1').substring(0, 40) });
  });

  app.get('/health', (req, res) => {`
);

// 2. نحسط toSqlite - نضيف كل الـ Type Casts المفقودة
const toSqliteOld = `replace(/NOW\\\\(\\\\)/gi, "CURRENT_TIMESTAMP")
.replace(/CURRENT_TIMESTAMP\\\\s*\\\\-\\\\s*INTERVAL '(\\\\d+)\\\\s+(\\\\w+)'/gi, "datetime('now', '-$1 $2')")
.replace(/NOW\\\\(\\\\)\\\\s*\\\\-\\\\s*INTERVAL '(\\\\d+)\\\\s+(\\\\w+)'/gi, "datetime('now', '-$1 $2')")
.replace(/EXTRACT\\\\(HOUR FROM ([^)]+)\\\\)/gi, "strftime('%H', $1)")
.replace(/CURRENT_TIMESTAMP - INTERVAL '(\\\\d+) (\\\\w+)'/gi, "CURRENT_TIMESTAMP - INTERVAL '$1 $2'")
.replace(/similarity\\\\(([^,]+),\\\\s*([^)]+)\\\\)/gi, "1.0")
.replace(/([a-z0-9._]+)\\\\s+%\\\\s+([$a-z0-9?]+)/gi, "$1 LIKE '%' || $2 || '%'")
.replace(/::timestamp/gi, "")
.replace(/::interval/gi, "")
.replace(/::integer/gi, "")
.replace(/::bigint/gi, "")
.replace(/::boolean/gi, "")
.replace(/::text/gi, "")
.replace(/::numeric/gi, "")
.replace(/::float/gi, "")
.replace(/::real/gi, "")
.replace(/::double precision/gi, "")
.replace(/::character varying/gi, "")
.replace(/BIGSERIAL/gi, "INTEGER")
.replace(/SERIAL/gi, "INTEGER")
.replace(/BIGINT/gi, "INTEGER")
.replace(/ILIKE/gi, "LIKE")`;

const toSqliteNew = `replace(/NOW\\(\\)/gi, "CURRENT_TIMESTAMP")
.replace(/CURRENT_TIMESTAMP\\s*-\\s*INTERVAL '(\\d+)\\s+(\\w+)'/gi, "CURRENT_TIMESTAMP - INTERVAL '$1 $2'")
.replace(/NOW\\(\\)\\s*-\\s*INTERVAL '(\\d+)\\s+(\\w+)'/gi, "CURRENT_TIMESTAMP - INTERVAL '$1 $2'")
.replace(/EXTRACT\\(HOUR FROM ([^)]+)\\)/gi, "strftime('%H', $1)")
.replace(/CURRENT_TIMESTAMP - INTERVAL '(\\d+) (\\w+)'/gi, "CURRENT_TIMESTAMP - INTERVAL '$1 $2'")
.replace(/similarity\\(([^,]+),\\s*([^)]+)\\)/gi, "1.0")
.replace(/([a-z0-9._]+)\\s+%\\s+([$a-z0-9?]+)/gi, "$1 LIKE '%' || $2 || '%'")
.replace(/::timestamp/gi, "")
.replace(/::interval/gi, "")
.replace(/::integer/gi, "")
.replace(/::bigint/gi, "")
.replace(/::boolean/gi, "")
.replace(/::text/gi, "")
.replace(/::numeric/gi, "")
.replace(/::float/gi, "")
.replace(/::real/gi, "")
.replace(/::double precision/gi, "")
.replace(/::character varying/gi, "")
.replace(/BIGSERIAL/gi, "INTEGER")
.replace(/SERIAL/gi, "INTEGER")
.replace(/BIGINT/gi, "INTEGER")
.replace(/ILIKE/gi, "LIKE")`;

// الآن نستبدل القديم بالجديد
const oldPattern = 'replace(/NOW\\\\(\\\\)/gi, "CURRENT_TIMESTAMP")';
const idxOld = 'replace(/CURRENT_TIMESTAMP\\\\s*-\\\\s*INTERVAL';
const idxNew = 'CURRENT_TIMESTAMP - INTERVAL';
const startMarker = "const toSqlite = sql => {";
const endMarker = "function toPg(sql) {";

const startIdx = idx.indexOf(startMarker);
const endIdx = idx.indexOf(endMarker);
if (startIdx === -1 || endIdx === -1) { console.log('❌ Could not find toSqlite function'); process.exit(1); }

const funcBody = idx.substring(startIdx, endIdx);
const newBody = funcBody.replace(toSqliteOld, toSqliteNew);
idx = idx.substring(0, startIdx) + newBody + idx.substring(endIdx);

// 3. نحصل initSchema - نلف الـ pg_trgm بـ try/catch محسّن
idx = idx.replace(
  `try {
      await pg.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
      await pg.query("CREATE INDEX IF NOT EXISTS idx_files_title_trgm ON files USING GIN(title gin_trgm_ops)");
      await pg.query("CREATE INDEX IF NOT EXISTS idx_files_desc_trgm ON files USING GIN(description gin_trgm_ops)");
      await pg.query("CREATE INDEX IF NOT EXISTS idx_subjects_name_trgm ON subjects USING GIN(name gin_trgm_ops)");
      logger.info('✅ pg_trgm indexes ready');
    } catch(e) { logger.warn('⚠️ pg_trgm skipped:', e.message); }`,
  `try {
      await pg.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
      await pg.query("CREATE INDEX IF NOT EXISTS idx_files_title_trgm ON files USING GIN(title gin_trgm_ops)");
      await pg.query("CREATE INDEX IF NOT EXISTS idx_files_desc_trgm ON files USING GIN(description gin_trgm_ops)");
      await pg.query("CREATE INDEX IF NOT EXISTS idx_subjects_name_trgm ON subjects USING GIN(name gin_trgm_ops)");
      logger.info('✅ pg_trgm indexes ready');
    } catch(e) { logger.warn('⚠️ pg_trgm skipped:', e.message); }`
);

// 4. نضيف logging مفصّل للأخطاء الـ DB
idx = idx.replace(
  '.catch(e => { logger.error("DB all FAILED:", e.message, "| SQL:", converted.substring(0, 80)); return []; });',
  `.catch(e => { const sql = e.message?.match(/SQL: ([^|]+)\|/)?.[1]?.substring(0, 200) || e.message; logger.error("DB all FAILED:", e.message, "| SQL:", sql); return []; });`
);

idx = idx.replace(
  `.catch(e => { logger.error("DB run FAILED:", e.message); throw e; });`,
  `.catch(e => { const sql = e.message?.match(/SQL: ([^|]+)\|/)?.[1]?.substring(0, 200) || e.message; logger.error("DB run FAILED:", e.message, "| SQL:", sql); throw e; });`
);

fs.writeFileSync('index.js', idx);
console.log('✅ تم التحديث بنجاح');

// تحقق
const verify = fs.readFileSync('index.js', 'utf8');
console.log('Has ::text:', verify.includes('::text') ? '✅' : '❌');
console.log('Has ::numeric:', verify.includes('::numeric') ? '✅' : '❌');
console.log('Has ::boolean:', verify.includes('::boolean') ? '✅' : '❌');
console.log('Has better error log:', verify.includes('SQL:') ? '✅' : '❌');
console.log('Has guarded pg_trgm:', verify.includes('try {') && verify.includes('pg_trgm skipped') ? '✅' : '❌');
console.log('Has extra tables:', verify.includes('group_notify_log') ? '✅' : '❌');
console.log('Has webhook guard:', verify.includes('if (WEBHOOK_URL)') ? '✅' : '❌');
