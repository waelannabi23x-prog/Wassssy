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
    pgPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
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
  // Replace ? with $1, $2, ... but not inside ON CONFLICT(...)
  let i = 0;
  sql = sql
    .replace(/datetime\('now'\)/g, 'NOW()')
    .replace(/datetime\('now',\s*'([^']+)'\)/g, (_, interval) => {
      const m = interval.match(/([+-]\d+)\s+(\w+)/);
      if(m) return `NOW() + INTERVAL '${m[1]} ${m[2]}'`;
      return 'NOW()';
    })
    .replace(/INSERT OR REPLACE/g, 'INSERT')
    .replace(/INSERT OR IGNORE/g, 'INSERT')
    .replace(/LIKE \?/gi, 'ILIKE ?');
  // Now replace ? with $N
  sql = sql.replace(/\?/g, () => '$' + (++i));
  return sql;
}

async function all(sql, params=[]) {
  const pg = getPg();
  if(pg) {
    try {
      const converted = toPg(sql);
      const res = await pg.query(converted, params);
      return res.rows;
    } catch(e) { console.error('DB all error:', e.message, '| SQL:', toPg(sql).substring(0,80)); return []; }
  }
  // SQLite
  try {
    const db = getSqlite();
    if(db) {
      const stmt = db.prepare(sql);
      return Promise.resolve(stmt.all(...params));
    }
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
    try {
      await pg.query(toPg(sql), params);
      return;
    } catch(e) { console.error('DB run error:', e.message); throw e; }
  }
  // SQLite
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
    'CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_users_active ON users(last_active)',
    'CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at)',
  ];
  for(const idx of indexes) {
    try {
      if(pg) await pg.query(idx);
      else if(getSqlite()) getSqlite().exec(idx);
      else sqlJs.run(idx);
    } catch(e) {}
  }

  if(!pg) saveDB();
  console.log('✅ DB schema ready');
}

async function getSetting(key) {
  const r = await get('SELECT value FROM settings WHERE key=?', [key]);
  return r ? r.value : null;
}

async function setSetting(key, value) {
  await run('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)', [key, value]);
}

module.exports = { all, get, run, initSchema, getSetting, setSetting, saveDB, DB_PATH };
