const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, '..', 'study_bot.db');

// ── PostgreSQL ──
let pgPool = null;
function getPg() {
  if(pgPool) return pgPool;
  if(!process.env.DATABASE_URL) return null;
  try {
    const { Pool } = require('pg');
    pgPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 20, min: 3, idleTimeoutMillis: 600000, connectionTimeoutMillis: 10000, allowExitOnIdle: false, keepAlive: true, keepAliveInitialDelayMillis: 10000 });
    console.log('✅ Using PostgreSQL');
    return pgPool;
  } catch(e) { console.error('PG error:', e.message); return null; }
}

// ── SQLite (better-sqlite3 or sql.js fallback) ──
let sqliteDb = null;
let sqlJs = null;
let dirty = false;
let saveTimer = null;

function scheduleSave() {
  dirty = true;
  if(saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if(!dirty) return;
    dirty = false;
    try { fs.writeFileSync(DB_PATH, Buffer.from(sqlJs.export())); } catch(e) {}
  }, 500);
}

function saveDB() {
  if(saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  if(sqlJs) try { fs.writeFileSync(DB_PATH, Buffer.from(sqlJs.export())); } catch(e) {}
}

function getSqlite() {
  if(sqliteDb) return sqliteDb;
  try {
    const Database = require('better-sqlite3');
    sqliteDb = new Database(DB_PATH);
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.pragma('cache_size = 10000');
    sqliteDb.pragma('synchronous = NORMAL');
    sqliteDb.pragma('temp_store = MEMORY');
    console.log('✅ Using better-sqlite3');
    return sqliteDb;
  } catch(e) {
    console.log('⚠️ Using sql.js fallback');
    return null;
  }
}

// ── Convert SQLite query to PostgreSQL ──
function toPg(sql) {
  if(!sql || typeof sql !== "string") return sql || "";
  // Replace ? with $1, $2, ... but not inside ON CONFLICT(...)
  let i = 0;
  sql = sql
    .replace(/datetime\('now'\)/g, 'NOW()')
    .replace(/datetime\('now',\s*'([^']+)'\)/g, (_, interval) => {
      const m = interval.match(/([+-]\d+)\s+(\w+)/);
      if(m) return `NOW() + INTERVAL '${m[1]} ${m[2]}'`;
      return 'NOW()';
    })
    .replace(/INSERT OR REPLACE INTO (\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/gi, (_, table, cols, vals) => { const colList = cols.split(',').map(c => c.trim()); const pk = colList[0]; const updates = colList.slice(1).map(c => c+'=EXCLUDED.'+c).join(','); return 'INSERT INTO '+table+'('+cols+') VALUES('+vals+') ON CONFLICT('+pk+') DO UPDATE SET '+updates; })
    .replace(/LIKE \?/gi, 'ILIKE ?');
  // Now replace ? with $N
  sql = sql.replace(/\?/g, () => '$' + (++i));
  return sql;
}

// cache للـ toPg لتجنب تحويل نفس الـ query مرتين
const pgSqlCache = new Map();
function toPgCached(sql) {
  if(pgSqlCache.has(sql)) return pgSqlCache.get(sql);
  const converted = toPg(sql);
  if(pgSqlCache.size > 500) pgSqlCache.clear();
  pgSqlCache.set(sql, converted);
  return converted;
}

async function all(sql, params=[]) {
  const pg = getPg();
  if(pg) {
    const converted = toPgCached(sql);
    try {
      const res = await pg.query(converted, params);
      return res.rows;
    } catch(e) { console.error('DB all error:', e.message, '| SQL:', converted.substring(0,80)); return []; }
  }
  try {
    const db = getSqlite();
    if(db) return Promise.resolve(db.prepare(sql).all(...params));
    const stmt = sqlJs.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while(stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return Promise.resolve(rows);
  } catch(e) { console.error('DB all error:', e.message); return []; }
}

function get(sql, params=[]) {
  return all(sql, params).then(r => r[0] || null);
}

async function run(sql, params=[]) {
  const pg = getPg();
  if(pg) {
    const converted = toPgCached(sql);
    try {
      await pg.query(converted, params);
      return;
    } catch(e) { console.error('DB run error:', e.message); throw e; }
  }
  try {
    const db = getSqlite();
    if(db) { db.prepare(sql).run(...params); return; }
    sqlJs.run(sql, params);
    scheduleSave();
  } catch(e) { console.error('DB run error:', e.message); throw e; }
}

async function initSchema() {
  const pg = getPg();
  if(!pg) {
    const db = getSqlite();
    if(!db) {
      const initSqlJs = require('sql.js');
      const SQL = await initSqlJs();
      sqlJs = fs.existsSync(DB_PATH) ? new SQL.Database(fs.readFileSync(DB_PATH)) : new SQL.Database();
      sqlJs.run('PRAGMA journal_mode=WAL');
      sqlJs.run('PRAGMA cache_size=10000');
    }
  }

  const tables = [
    `CREATE TABLE IF NOT EXISTS users (id BIGINT PRIMARY KEY, first_name TEXT, last_name TEXT, username TEXT, is_banned INTEGER DEFAULT 0, joined_at TEXT DEFAULT (CURRENT_TIMESTAMP), last_active TEXT DEFAULT (CURRENT_TIMESTAMP))`,
    `CREATE TABLE IF NOT EXISTS admins (user_id BIGINT PRIMARY KEY, added_by BIGINT, permissions TEXT DEFAULT 'upload,add_content', specialty_id INTEGER DEFAULT 0, added_at TEXT DEFAULT (CURRENT_TIMESTAMP))`,
    `CREATE TABLE IF NOT EXISTS specialties (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, is_deleted INTEGER DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS years (id SERIAL PRIMARY KEY, specialty_id INTEGER NOT NULL, name TEXT NOT NULL, is_deleted INTEGER DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS semesters (id SERIAL PRIMARY KEY, year_id INTEGER NOT NULL, name TEXT NOT NULL, is_deleted INTEGER DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS subjects (id SERIAL PRIMARY KEY, semester_id INTEGER NOT NULL, name TEXT NOT NULL, is_deleted INTEGER DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, subject_id INTEGER NOT NULL, name TEXT NOT NULL, is_deleted INTEGER DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS files (id SERIAL PRIMARY KEY, category_id INTEGER NOT NULL, title TEXT NOT NULL, description TEXT DEFAULT '', file_id TEXT NOT NULL, file_type TEXT DEFAULT 'document', downloads INTEGER DEFAULT 0, uploaded_by BIGINT, is_deleted INTEGER DEFAULT 0, uploaded_at TEXT DEFAULT (CURRENT_TIMESTAMP))`,
    `CREATE TABLE IF NOT EXISTS favorites (user_id BIGINT, file_id INTEGER, PRIMARY KEY(user_id, file_id))`,
    `CREATE TABLE IF NOT EXISTS history (id SERIAL PRIMARY KEY, user_id BIGINT, file_id INTEGER, viewed_at TEXT DEFAULT (CURRENT_TIMESTAMP))`,
    `CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, user_id BIGINT, action TEXT, details TEXT, created_at TEXT DEFAULT (CURRENT_TIMESTAMP))`,
    `CREATE TABLE IF NOT EXISTS ratings (user_id BIGINT, file_id INTEGER, rating INTEGER, PRIMARY KEY(user_id, file_id))`,
    `CREATE TABLE IF NOT EXISTS user_specialties (user_id BIGINT PRIMARY KEY, specialty_id INTEGER, updated_at TEXT DEFAULT (CURRENT_TIMESTAMP))`,
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`,
    `CREATE TABLE IF NOT EXISTS bundles (id SERIAL PRIMARY KEY, category_id INTEGER NOT NULL, title TEXT NOT NULL, description TEXT DEFAULT '', downloads INTEGER DEFAULT 0, created_at TEXT DEFAULT (CURRENT_TIMESTAMP))`,
    `CREATE TABLE IF NOT EXISTS bundle_files (id SERIAL PRIMARY KEY, bundle_id INTEGER NOT NULL, file_id TEXT NOT NULL, file_type TEXT DEFAULT 'document', title TEXT DEFAULT '')`,
    `CREATE TABLE IF NOT EXISTS message_templates (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, type TEXT DEFAULT 'text', content TEXT DEFAULT '', file_id TEXT DEFAULT '', created_at TEXT DEFAULT (CURRENT_TIMESTAMP))`,
    `CREATE TABLE IF NOT EXISTS scheduled_messages (id SERIAL PRIMARY KEY, template_id INTEGER, target TEXT DEFAULT 'all', specialty_id INTEGER DEFAULT 0, send_at TEXT, sent INTEGER DEFAULT 0, created_at TEXT DEFAULT (CURRENT_TIMESTAMP))`,
    `CREATE TABLE IF NOT EXISTS user_states (user_id BIGINT PRIMARY KEY, state TEXT NOT NULL, updated_at TEXT DEFAULT (CURRENT_TIMESTAMP))`,
    `CREATE TABLE IF NOT EXISTS group_chats (chat_id BIGINT PRIMARY KEY, title TEXT, joined_at TEXT DEFAULT (CURRENT_TIMESTAMP))`,
    `CREATE TABLE IF NOT EXISTS cache_store (key TEXT PRIMARY KEY, value TEXT, expires_at BIGINT)`,
    `CREATE TABLE IF NOT EXISTS reports (id SERIAL PRIMARY KEY, file_id INTEGER NOT NULL, user_id BIGINT NOT NULL, reason TEXT, status TEXT DEFAULT 'pending', created_at TEXT DEFAULT (CURRENT_TIMESTAMP))`,
    `CREATE TABLE IF NOT EXISTS comments (id SERIAL PRIMARY KEY, file_id INTEGER NOT NULL, user_id BIGINT NOT NULL, text TEXT NOT NULL, is_deleted INTEGER DEFAULT 0, created_at TEXT DEFAULT (CURRENT_TIMESTAMP))`,
  ];

  for(const sql of tables) {
    try {
      if(pg) await pg.query(sql.replace(/SERIAL/g,'BIGSERIAL').replace(/INTEGER DEFAULT 0\)/g,'INTEGER DEFAULT 0)'));
      else if(getSqlite()) getSqlite().exec(sql.replace(/SERIAL/g,'INTEGER').replace(/BIGINT/g,'INTEGER').replace(/BIGSERIAL/g,'INTEGER'));
      else sqlJs.run(sql.replace(/SERIAL/g,'INTEGER').replace(/BIGINT/g,'INTEGER').replace(/BIGSERIAL/g,'INTEGER'));
    } catch(e) { console.error('Table error:', e.message.substring(0,60)); }
  }

  // Indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_files_category ON files(category_id)',
    'CREATE INDEX IF NOT EXISTS idx_files_deleted ON files(is_deleted)',
    'CREATE INDEX IF NOT EXISTS idx_files_downloads ON files(downloads DESC)',
    'CREATE INDEX IF NOT EXISTS idx_files_uploaded ON files(uploaded_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_history_file ON history(file_id)',
    'CREATE INDEX IF NOT EXISTS idx_history_viewed ON history(viewed_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_favorites_file ON favorites(file_id)',
    'CREATE INDEX IF NOT EXISTS idx_users_active ON users(last_active)',
    'CREATE INDEX IF NOT EXISTS idx_users_banned ON users(is_banned)',
    'CREATE INDEX IF NOT EXISTS idx_ratings_file ON ratings(file_id)',
    'CREATE INDEX IF NOT EXISTS idx_comments_file ON comments(file_id)',
    'CREATE INDEX IF NOT EXISTS idx_categories_subject ON categories(subject_id)',
    'CREATE INDEX IF NOT EXISTS idx_subjects_semester ON subjects(semester_id)',
    'CREATE INDEX IF NOT EXISTS idx_semesters_year ON semesters(year_id)',
    'CREATE INDEX IF NOT EXISTS idx_years_specialty ON years(specialty_id)',
    'CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_user_specialties ON user_specialties(specialty_id)',
  ];
  for(const idx of indexes) {
    try {
      if(pg) await pg.query(idx);
      else if(getSqlite()) getSqlite().exec(idx);
      else sqlJs.run(idx);
    } catch(e) {}
  }

  if(!pg) saveDB();
  // Add missing columns if not exist
  const alterCols = [
    "ALTER TABLE files ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0",
    "ALTER TABLE files ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''",
    "ALTER TABLE files ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'document'",
    "ALTER TABLE files ADD COLUMN IF NOT EXISTS downloads INTEGER DEFAULT 0",
    "ALTER TABLE files ADD COLUMN IF NOT EXISTS uploaded_by BIGINT DEFAULT 0",
    "ALTER TABLE files ADD COLUMN IF NOT EXISTS uploaded_at TEXT DEFAULT (CURRENT_TIMESTAMP)",
    "ALTER TABLE specialties ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0",
    "ALTER TABLE years ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0",
    "ALTER TABLE semesters ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0",
    "ALTER TABLE subjects ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0",
    "ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned INTEGER DEFAULT 0",
    "ALTER TABLE bundles ADD COLUMN IF NOT EXISTS uploaded_by BIGINT DEFAULT 0",
    "ALTER TABLE bundles ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0",
    "ALTER TABLE bundles ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''",
    "ALTER TABLE bundles ADD COLUMN IF NOT EXISTS downloads INTEGER DEFAULT 0",
    "ALTER TABLE bundles ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0",
  ];
  for(const sql of alterCols){
    try {
      if(pg) {
        // PostgreSQL safe column add
        const match = sql.match(/ALTER TABLE (\w+) ADD COLUMN IF NOT EXISTS (\w+) (.+)/);
        if(match) {
          const [,table,col,type] = match;
          const exists = await pg.query(`SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`,[table,col]);
          if(!exists.rows.length) await pg.query(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
        } else {
          await pg.query(sql);
        }
      } else if(getSqlite()) getSqlite().exec(sql.replace(/IF NOT EXISTS/g,''));
    } catch(e) { console.error('Alter error:', e.message.substring(0,60)); }
  }
  console.log('✅ DB schema ready');
}

async function getSetting(key) {
  const r = await get('SELECT value FROM settings WHERE key=?', [key]);
  return r ? r.value : null;
}

async function setSetting(key, value) {
  await run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value', [key, value]);
}

module.exports = { all, get, run, initSchema, getSetting, setSetting, saveDB, DB_PATH };
