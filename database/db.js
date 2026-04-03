let db;
const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, '..', 'study_bot.db');

function getDb() {
  if(db) return db;
  try {
    const Database = require('better-sqlite3');
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('cache_size = 10000');
    db.pragma('synchronous = NORMAL');
    db.pragma('temp_store = MEMORY');
    return db;
  } catch(e) {
    // Fallback to sql.js if better-sqlite3 not available (Termux)
    console.log('better-sqlite3 not available, using sql.js');
    return null;
  }
}

// sql.js fallback
const initSqlJs = require('sql.js');
let sqlDb;
let dirty = false;
let saveTimer = null;

function scheduleSave() {
  dirty = true;
  if(saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if(!dirty) return;
    dirty = false;
    try { fs.writeFileSync(DB_PATH, Buffer.from(sqlDb.export())); } catch(e) { console.error('DB save error:', e.message); }
  }, 500);
}

function saveDB() {
  if(saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  dirty = false;
  if(sqlDb) try { fs.writeFileSync(DB_PATH, Buffer.from(sqlDb.export())); } catch(e) {}
}

function all(sql, params=[]) {
  try {
    const d = getDb();
    if(d) {
      const stmt = d.prepare(sql);
      return Promise.resolve(stmt.all(...params));
    }
    const stmt = sqlDb.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while(stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return Promise.resolve(rows);
  } catch(e) { console.error('DB all error:', e.message); return Promise.resolve([]); }
}

function get(sql, params=[]) {
  return all(sql, params).then(r => r[0] || null);
}

function run(sql, params=[]) {
  try {
    const d = getDb();
    if(d) {
      const stmt = d.prepare(sql);
      stmt.run(...params);
      return Promise.resolve();
    }
    sqlDb.run(sql, params);
    scheduleSave();
    return Promise.resolve();
  } catch(e) { console.error('DB run error:', e.message); return Promise.reject(e); }
}

async function initSchema() {
  const bsq = getDb();
  if(!bsq) {
    const SQL = await initSqlJs();
    sqlDb = fs.existsSync(DB_PATH) ? new SQL.Database(fs.readFileSync(DB_PATH)) : new SQL.Database();
    sqlDb.run('PRAGMA journal_mode=WAL');
    sqlDb.run('PRAGMA cache_size=10000');
    sqlDb.run('PRAGMA synchronous=NORMAL');
    sqlDb.run('PRAGMA temp_store=MEMORY');
  }
  const exec = (sql) => { try { bsq ? bsq.exec(sql) : sqlDb.run(sql); } catch(e) {} };
  exec(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT, username TEXT, is_banned INTEGER DEFAULT 0, joined_at TEXT DEFAULT (datetime('now')), last_active TEXT DEFAULT (datetime('now')))`);
  exec(`CREATE TABLE IF NOT EXISTS admins (user_id INTEGER PRIMARY KEY, added_by INTEGER, permissions TEXT DEFAULT 'upload,add_content', specialty_id INTEGER DEFAULT 0, added_at TEXT DEFAULT (datetime('now')))`);
  try{ bsq ? bsq.exec('ALTER TABLE admins ADD COLUMN specialty_id INTEGER DEFAULT 0') : sqlDb.run('ALTER TABLE admins ADD COLUMN specialty_id INTEGER DEFAULT 0'); }catch(e){}
  exec(`CREATE TABLE IF NOT EXISTS specialties (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, is_deleted INTEGER DEFAULT 0)`);
  exec(`CREATE TABLE IF NOT EXISTS years (id INTEGER PRIMARY KEY AUTOINCREMENT, specialty_id INTEGER NOT NULL, name TEXT NOT NULL, is_deleted INTEGER DEFAULT 0)`);
  exec(`CREATE TABLE IF NOT EXISTS semesters (id INTEGER PRIMARY KEY AUTOINCREMENT, year_id INTEGER NOT NULL, name TEXT NOT NULL, is_deleted INTEGER DEFAULT 0)`);
  exec(`CREATE TABLE IF NOT EXISTS subjects (id INTEGER PRIMARY KEY AUTOINCREMENT, semester_id INTEGER NOT NULL, name TEXT NOT NULL, is_deleted INTEGER DEFAULT 0)`);
  exec(`CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, subject_id INTEGER NOT NULL, name TEXT NOT NULL, is_deleted INTEGER DEFAULT 0)`);
  exec(`CREATE TABLE IF NOT EXISTS files (id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER NOT NULL, title TEXT NOT NULL, description TEXT DEFAULT '', file_id TEXT NOT NULL, file_type TEXT DEFAULT 'document', downloads INTEGER DEFAULT 0, uploaded_by INTEGER, is_deleted INTEGER DEFAULT 0, uploaded_at TEXT DEFAULT (datetime('now')))`);
  exec(`CREATE TABLE IF NOT EXISTS favorites (user_id INTEGER, file_id INTEGER, PRIMARY KEY(user_id, file_id))`);
  exec(`CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, file_id INTEGER, viewed_at TEXT DEFAULT (datetime('now')))`);
  exec(`CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, action TEXT, details TEXT, created_at TEXT DEFAULT (datetime('now')))`);
  exec(`CREATE TABLE IF NOT EXISTS ratings (user_id INTEGER, file_id INTEGER, rating INTEGER, PRIMARY KEY(user_id, file_id))`);
  exec(`CREATE TABLE IF NOT EXISTS user_specialties (user_id INTEGER PRIMARY KEY, specialty_id INTEGER, updated_at TEXT DEFAULT (datetime('now')))`);
  exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);
  exec(`CREATE TABLE IF NOT EXISTS bundles (id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER NOT NULL, title TEXT NOT NULL, description TEXT DEFAULT '', downloads INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`);
  exec(`CREATE TABLE IF NOT EXISTS bundle_files (id INTEGER PRIMARY KEY AUTOINCREMENT, bundle_id INTEGER NOT NULL, file_id TEXT NOT NULL, file_type TEXT DEFAULT 'document', title TEXT DEFAULT '')`);
  exec(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, type TEXT, content TEXT, file_id TEXT, target TEXT DEFAULT 'all', specialty_id INTEGER DEFAULT 0, sent INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`);
  exec(`CREATE TABLE IF NOT EXISTS user_states (user_id INTEGER PRIMARY KEY, state TEXT NOT NULL, updated_at TEXT DEFAULT (datetime('now')))`);
  exec(`CREATE TABLE IF NOT EXISTS group_chats (chat_id INTEGER PRIMARY KEY, title TEXT, joined_at TEXT DEFAULT (datetime('now')))`);
  exec('CREATE INDEX IF NOT EXISTS idx_files_category ON files(category_id)');
  exec('CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id)');
  exec('CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id)');
  exec('CREATE INDEX IF NOT EXISTS idx_users_active ON users(last_active)');
  exec('CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at)');
  if(!bsq) saveDB();
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
