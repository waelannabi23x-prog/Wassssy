const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, '..', 'study_bot.db');
const logger = require('../utils/logger');

let pgPool = null;
function getPg() {
  if (pgPool) return pgPool;
  if (!process.env.DATABASE_URL) return null;
  try {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 20, min: 5,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000,
      query_timeout: 10000,
      allowExitOnIdle: false,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000
    });
    pgPool.on('error', err => logger.error('PG pool:', err.message));
    logger.info('✅ PostgreSQL');
    return pgPool;
  } catch (e) { logger.error('PG init:', e.message); return null; }
}

let sqliteDb = null, sqlJs = null, dirty = false, saveTimer = null;

function scheduleSave() {
  dirty = true;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (!dirty) return;
    dirty = false;
    try { fs.writeFile(DB_PATH, Buffer.from(sqlJs.export()), err => { if (err) logger.error('Save:', err.message); }); } catch (e) { logger.error('Save:', e.message); }
  }, 500);
  if (saveTimer.unref) saveTimer.unref();
}

function saveDB() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  dirty = false;
  if (sqliteDb) { try { sqliteDb.pragma('journal_mode = WAL'); } catch(_) {} return; }
  if (sqlJs) try { fs.writeFile(DB_PATH, Buffer.from(sqlJs.export()), err => { if (err) logger.error('SaveDB:', err.message); }); } catch (e) { logger.error('SaveDB:', e.message); }
}

function getSqlite() {
  if (sqliteDb) return sqliteDb;
  try {
    const Database = require('better-sqlite3');
    sqliteDb = new Database(DB_PATH);
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.pragma('cache_size = 10000');
    sqliteDb.pragma('synchronous = NORMAL');
    sqliteDb.pragma('temp_store = MEMORY');
    logger.info('✅ SQLite (better-sqlite3)');
    return sqliteDb;
  } catch (e) { logger.warn('⚠️ better-sqlite3 unavailable'); return null; }
}

const pgCache = new Map();
function toPgCached(sql) {
  if (pgCache.has(sql)) { const v = pgCache.get(sql); pgCache.delete(sql); pgCache.set(sql, v); return v; }
  const r = toPg(sql); pgCache.set(sql, r);
  if (pgCache.size > 500) { const k = pgCache.keys().next().value; pgCache.delete(k); }
  return r;
}

// toPg: يحوّل صيغة SQLite لـ PostgreSQL
// مهم: لا نحذف ::type لأن PG يحتاجها للتحويل الصريح
function toPg(sql) {
  if (!sql || typeof sql !== "string") return sql || "";
  let i = 0;
  sql = sql
    .replace(/datetime\('now'\)/g, 'NOW()')
    .replace(/datetime\('now',\s*'([^']+)'\)/g, function(_, p1) {
      var p = p1.match(/([+-]\d+)\s+(\w+)/);
      return p ? "NOW() + INTERVAL '" + p[1] + " " + p[2] + "'" : 'NOW()';
    })
    .replace(/strftime\('%H',\s*([^)]+)\)/g, "EXTRACT(HOUR FROM $1)")
    .replace(/INSERT OR REPLACE INTO (\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/gi, function(_, t1, t2, t3) {
      var cols = t2.split(',').map(function(c) { return c.trim(); });
      return 'INSERT INTO ' + t1 + '(' + t2 + ') VALUES(' + t3 + ') ON CONFLICT(' + cols[0] + ') DO UPDATE SET ' + cols.slice(1).map(function(c) { return c + '=EXCLUDED.' + c; }).join(',');
    })
    .replace(/LIKE \?/gi, 'ILIKE ?')
    // نحافظ على ::type للـ PG — لا نحذفها!
    .replace(/__BIGSERIAL__/gi, "BIGSERIAL")
    .replace(/BIGSERIAL/gi, "__BIGSERIAL__")
    .replace(/SERIAL/gi, "INTEGER")
    .replace(/__BIGSERIAL__/gi, "BIGSERIAL")
    .replace(/\?/g, function() { return '$' + (++i); });
  return sql;
}

// toSqlite: يحوّل صيغة PostgreSQL لـ SQLite
// هنا نحذف ::type لأن SQLite لا يدعمها
function toSqlite(sql) {
  if (!sql || typeof sql !== "string") return sql || "";
  return sql
    .replace(/NOW\(\)/gi, "CURRENT_TIMESTAMP")
    .replace(/CURRENT_TIMESTAMP\s*-\s*INTERVAL\s*'(\d+)\s*(\w+)'/g, "datetime('now', '-$1 $2')")
    .replace(/NOW\(\)\s*-\s*INTERVAL\s*'(\d+)\s*(\w+)'/g, "datetime('now', '-$1 $2')")
    .replace(/EXTRACT\(HOUR FROM ([^)]+)\)/gi, "strftime('%H', $1)")
    .replace(/similarity\(([^,]+),\s*([^)]+)\)/gi, "1.0")
    .replace(/::timestamp/gi, "")
    .replace(/::interval/gi, "")
    .replace(/::smallint/gi, "")
    .replace(/::integer/gi, "")
    .replace(/::bigint/gi, "")
    .replace(/::numeric/gi, "")
    .replace(/::float/gi, "")
    .replace(/::real/gi, "")
    .replace(/::double\s+precision/gi, "")
    .replace(/::boolean/gi, "")
    .replace(/::text/gi, "")
    .replace(/::character\s+varying\([^)]+\)/gi, "")
    .replace(/::character\([^)]+\)/gi, "")
    .replace(/::date/gi, "")
    .replace(/::time/gi, "")
    .replace(/::json/gi, "")
    .replace(/::jsonb/gi, "")
    .replace(/::uuid/gi, "")
    .replace(/__BIGSERIAL__/gi, "INTEGER")
    .replace(/BIGSERIAL/gi, "__BIGSERIAL__")
    .replace(/SERIAL/gi, "INTEGER")
    .replace(/__BIGSERIAL__/gi, "INTEGER")
    .replace(/BIGINT/gi, "INTEGER")
    .replace(/ILIKE/gi, "LIKE")
    .replace(/\?/g, '?');
}

async function withRetry(fn, label) {
  for (var ii = 0; ii < 3; ii++) {
    try { return await fn(); }
    catch (e) {
      var msg = e.message || '';
      if ((msg.includes('timeout') || msg.includes('terminated') || msg.includes('ECONNRESET')) && ii < 2) {
        logger.warn('DB ' + (label || 'query') + ' retry ' + (ii + 1) + '/3');
        await new Promise(function(r) { setTimeout(r, 500 * Math.pow(2, ii)); });
      } else { throw e; }
    }
  }
}

async function all(sql, params) {
  params = params || [];
  var pg = getPg();
  if (pg) {
    return withRetry(function () {
      return pg.query(toPgCached(sql), params).then(function (r) { return r.rows; });
    }, 'all').catch(function (e) {
      logger.error('DB all:', e.message.substring(0, 120));
      return [];
    });
  }
  try {
    var db = getSqlite();
    if (db) return db.prepare(toSqlite(sql)).all(...params);
    if (sqlJs) {
      var stmt = sqlJs.prepare(toSqlite(sql));
      stmt.bind(params);
      var rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    }
  } catch (e) { logger.error('DB all error:', e.message); return []; }
  return [];
}

function get(sql, params) {
  return all(sql, params).then(function (r) { return r[0] || null; });
}

async function run(sql, params) {
  params = params || [];
  var pg = getPg();
  if (pg) {
    return withRetry(function () {
      return pg.query(toPgCached(sql), params);
    }, 'run').catch(function (e) {
      logger.error('DB run:', e.message.substring(0, 120));
      throw e;
    });
  }
  try {
    var db = getSqlite();
    if (db) { db.prepare(toSqlite(sql)).run(...params); return; }
    if (sqlJs) { sqlJs.run(toSqlite(sql), params); scheduleSave(); }
  } catch (e) { logger.error('DB run error:', e.message); throw e; }
}

async function initSchema() {
  var pg = getPg();
  if (!pg) {
    var db = getSqlite();
    if (!db) {
      try {
        var initSqlJs = require('sql.js');
        var SQL = await initSqlJs();
        sqlJs = new SQL.Database();
        logger.info('✅ sql.js fallback');
      } catch (e) { logger.error('No DB engine:', e.message); return; }
    }
  }

  var tables = [
    "CREATE TABLE IF NOT EXISTS users (id BIGINT PRIMARY KEY, first_name TEXT, last_name TEXT, username TEXT, is_banned INTEGER DEFAULT 0, joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS admins (user_id BIGINT PRIMARY KEY, added_by BIGINT, permissions TEXT DEFAULT 'upload,add_content', specialty_id INTEGER DEFAULT 0, added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS specialties (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, is_deleted INTEGER DEFAULT 0)",
    "CREATE TABLE IF NOT EXISTS years (id SERIAL PRIMARY KEY, specialty_id INTEGER NOT NULL, name TEXT NOT NULL, is_deleted INTEGER DEFAULT 0)",
    "CREATE TABLE IF NOT EXISTS semesters (id SERIAL PRIMARY KEY, year_id INTEGER NOT NULL, name TEXT NOT NULL, is_deleted INTEGER DEFAULT 0)",
    "CREATE TABLE IF NOT EXISTS subjects (id SERIAL PRIMARY KEY, semester_id INTEGER NOT NULL, name TEXT NOT NULL, is_deleted INTEGER DEFAULT 0)",
    "CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, subject_id INTEGER NOT NULL, name TEXT NOT NULL, is_deleted INTEGER DEFAULT 0)",
    "CREATE TABLE IF NOT EXISTS files (id SERIAL PRIMARY KEY, category_id INTEGER NOT NULL, title TEXT NOT NULL, description TEXT DEFAULT '', file_id TEXT NOT NULL, file_type TEXT DEFAULT 'document', downloads INTEGER DEFAULT 0, uploaded_by BIGINT DEFAULT 0, is_deleted INTEGER DEFAULT 0, uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS favorites (user_id BIGINT, file_id INTEGER, PRIMARY KEY(user_id, file_id))",
    "CREATE TABLE IF NOT EXISTS history (id SERIAL PRIMARY KEY, user_id BIGINT, file_id INTEGER, viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, user_id BIGINT, action TEXT, details TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS ratings (user_id BIGINT, file_id INTEGER, rating INTEGER, PRIMARY KEY(user_id, file_id))",
    "CREATE TABLE IF NOT EXISTS user_specialties (user_id BIGINT PRIMARY KEY, specialty_id INTEGER, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)",
    "CREATE TABLE IF NOT EXISTS bundles (id SERIAL PRIMARY KEY, category_id INTEGER NOT NULL, title TEXT NOT NULL, description TEXT DEFAULT '', downloads INTEGER DEFAULT 0, uploaded_by BIGINT DEFAULT 0, is_deleted INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS bundle_files (id SERIAL PRIMARY KEY, bundle_id INTEGER NOT NULL, file_id TEXT NOT NULL, file_type TEXT DEFAULT 'document', title TEXT DEFAULT '')",
    "CREATE TABLE IF NOT EXISTS message_templates (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, type TEXT DEFAULT 'text', content TEXT DEFAULT '', file_id TEXT DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS scheduled_messages (id SERIAL PRIMARY KEY, template_id INTEGER, target TEXT DEFAULT 'all', specialty_id INTEGER DEFAULT 0, send_at TEXT, sent INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS user_states (user_id BIGINT PRIMARY KEY, state TEXT NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS ai_history (id SERIAL PRIMARY KEY, user_id BIGINT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS group_chats (chat_id BIGINT PRIMARY KEY, title TEXT, specialty_id INTEGER DEFAULT 0, notify_new_files INTEGER DEFAULT 1, joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS cache_store (key TEXT PRIMARY KEY, value TEXT, expires_at BIGINT)",
    "CREATE TABLE IF NOT EXISTS group_bot_msgs (id SERIAL PRIMARY KEY, chat_id BIGINT NOT NULL, message_id BIGINT NOT NULL, sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS group_members (chat_id BIGINT, user_id BIGINT, username TEXT, first_name TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(chat_id, user_id))",
    "CREATE TABLE IF NOT EXISTS reports (id SERIAL PRIMARY KEY, file_id INTEGER NOT NULL, user_id BIGINT NOT NULL, reason TEXT, status TEXT DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS comments (id SERIAL PRIMARY KEY, file_id INTEGER NOT NULL, user_id BIGINT NOT NULL, text TEXT NOT NULL, is_deleted INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS group_notify_log (id SERIAL PRIMARY KEY, file_id INTEGER NOT NULL, chat_id BIGINT NOT NULL, sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(file_id, chat_id))",
  ];

  for (var ti = 0; ti < tables.length; ti++) {
    try {
      if (pg) await pg.query(tables[ti].replace(/SERIAL/g, 'BIGSERIAL'));
      else if (getSqlite()) getSqlite().exec(tables[ti].replace(/SERIAL/g, 'INTEGER').replace(/BIGINT/g, 'INTEGER').replace(/BIGSERIAL/g, 'INTEGER'));
      else if (sqlJs) sqlJs.run(tables[ti].replace(/SERIAL/g, 'INTEGER').replace(/BIGINT/g, 'INTEGER').replace(/BIGSERIAL/g, 'INTEGER'));
    } catch (e) { logger.error('Table:', e.message.substring(0, 80)); }
  }

  if (pg) {
    try {
      await pg.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
      await pg.query("CREATE INDEX IF NOT EXISTS idx_files_title_trgm ON files USING GIN(title gin_trgm_ops)");
      await pg.query("CREATE INDEX IF NOT EXISTS idx_files_desc_trgm ON files USING GIN(description gin_trgm_ops)");
      await pg.query("CREATE INDEX IF NOT EXISTS idx_subjects_name_trgm ON subjects USING GIN(name gin_trgm_ops)");
      logger.info('✅ pg_trgm ready');
    } catch (e) { logger.warn('⚠️ pg_trgm:', e.message.substring(0, 80)); }
  }

  var indexes = [
    "CREATE INDEX IF NOT EXISTS idx_ai_history_user ON ai_history(user_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_files_category ON files(category_id)",
    "CREATE INDEX IF NOT EXISTS idx_files_deleted ON files(is_deleted)",
    "CREATE INDEX IF NOT EXISTS idx_files_downloads ON files(downloads DESC)",
    "CREATE INDEX IF NOT EXISTS idx_files_uploaded ON files(uploaded_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_history_file ON history(file_id)",
    "CREATE INDEX IF NOT EXISTS idx_history_viewed ON history(viewed_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_favorites_file ON favorites(file_id)",
    "CREATE INDEX IF NOT EXISTS idx_users_active ON users(last_active)",
    "CREATE INDEX IF NOT EXISTS idx_users_banned ON users(is_banned)",
    "CREATE INDEX IF NOT EXISTS idx_ratings_file ON ratings(file_id)",
    "CREATE INDEX IF NOT EXISTS idx_comments_file ON comments(file_id)",
    "CREATE INDEX IF NOT EXISTS idx_categories_subject ON categories(subject_id)",
    "CREATE INDEX IF NOT EXISTS idx_subjects_semester ON subjects(semester_id)",
    "CREATE INDEX IF NOT EXISTS idx_semesters_year ON semesters(year_id)",
    "CREATE INDEX IF NOT EXISTS idx_years_specialty ON years(specialty_id)",
    "CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at)",
    "CREATE INDEX IF NOT EXISTS idx_user_specialties ON user_specialties(specialty_id)",
    "CREATE INDEX IF NOT EXISTS idx_user_states_updated_at ON user_states(updated_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_scheduled_messages_send_at ON scheduled_messages(send_at)",
    "CREATE INDEX IF NOT EXISTS idx_cache_store_expires_at ON cache_store(expires_at)",
    "CREATE INDEX IF NOT EXISTS idx_gnl_file ON group_notify_log(file_id)",
  ];

  for (var ii = 0; ii < indexes.length; ii++) {
    try {
      if (pg) await pg.query(indexes[ii]);
      else if (getSqlite()) getSqlite().exec(indexes[ii]);
      else if (sqlJs) sqlJs.run(indexes[ii]);
    } catch (e) {}
  }

  if (!pg && !getSqlite() && sqlJs) saveDB();

  // إضافة أعمدة مفقودة
  var alterCols = [
    ["files", "is_deleted", "INTEGER DEFAULT 0"],
    ["files", "description", "TEXT DEFAULT ''"],
    ["files", "file_type", "TEXT DEFAULT 'document'"],
    ["files", "downloads", "INTEGER DEFAULT 0"],
    ["files", "uploaded_by", "BIGINT DEFAULT 0"],
    ["users", "is_banned", "INTEGER DEFAULT 0"],
    ["bundles", "uploaded_by", "BIGINT DEFAULT 0"],
    ["bundles", "is_deleted", "INTEGER DEFAULT 0"],
    ["bundles", "description", "TEXT DEFAULT ''"],
    ["bundles", "downloads", "INTEGER DEFAULT 0"],
  ];

  for (var ai = 0; ai < alterCols.length; ai++) {
    var tbl = alterCols[ai][0], col = alterCols[ai][1], typ = alterCols[ai][2];
    try {
      if (pg) {
        var ex = await pg.query("SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2", [tbl, col]);
        if (!ex.rows.length) await pg.query("ALTER TABLE " + tbl + " ADD COLUMN " + col + " " + typ);
      } else {
        var target = getSqlite() || sqlJs;
        if (target) { try { (target.exec || target.run.bind(target))("ALTER TABLE " + tbl + " ADD COLUMN " + col + " " + typ); } catch (e) {} }
      }
    } catch (e) {}
  }

  // إصلاح أنواع الأعمدة TIMESTAMP في PostgreSQL
  if (pg) {
    var tsCols = [
      ["users", "joined_at"], ["users", "last_active"],
      ["admins", "added_at"],
      ["files", "uploaded_at"],
      ["history", "viewed_at"],
      ["logs", "created_at"],
      ["user_specialties", "updated_at"],
      ["bundles", "created_at"],
      ["message_templates", "created_at"],
      ["scheduled_messages", "created_at"],
      ["user_states", "updated_at"],
      ["ai_history", "created_at"],
      ["group_chats", "joined_at"],
      ["group_bot_msgs", "sent_at"],
      ["group_members", "updated_at"],
      ["reports", "created_at"],
      ["comments", "created_at"],
      ["group_notify_log", "sent_at"],
    ];
    for (var tc = 0; tc < tsCols.length; tc++) {
      var tTbl = tsCols[tc][0], tCol = tsCols[tc][1];
      try {
        await pg.query("ALTER TABLE " + tTbl + " ALTER COLUMN " + tCol + " TYPE TIMESTAMP USING " + tCol + "::timestamp");
      } catch (e) { /* عمود غير موجود أو النوع صحيح — تجاهل */ }
    }
    logger.info('✅ Timestamp columns verified');
  }

  logger.info('✅ DB schema ready');
}

async function getSetting(key) {
  var r = await get('SELECT value FROM settings WHERE key=$1', [key]);
  return r ? r.value : null;
}

async function setSetting(key, value) {
  await run('INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value', [key, value]);
}

module.exports = { all, get, run, initSchema, getSetting, setSetting, saveDB, DB_PATH, getPg };
