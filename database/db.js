const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, '..', 'study_bot.db');
const logger = require('../utils/logger');

// يحول '123' لـ 123 فقط — لا يمس النصوص
function sanitizeParams(params) {
  var out = [];
  for (var i = 0; i < params.length; i++) {
    var p = params[i];
    // فقط أرقام صغيرة (< 10 خانات) — IDs تيليجرام BIGINT لا نلمسها
    if (typeof p === 'string' && /^\d+$/.test(p) && p.length <= 9) {
      out.push(parseInt(p, 10));
    } else {
      out.push(p);
    }
  }
  return out;
}

let pgPool = null;
function getPg() {
  if (pgPool) return pgPool;
  if (!process.env.DATABASE_URL) return null;
  try {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 15, min: 2,  // Railway-safe (PostgreSQL max ~25 connections)
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000,
      query_timeout: 10000,
      allowExitOnIdle: false,
      keepAlive: true,
      keepAliveInitialDelayMillis: 5000,
    });
    pgPool.on('error', function(err) { logger.error('PG pool error:', err.message); });
    pgPool.on('connect', function() {});
    pgPool.on('remove',  function() {});
    setTimeout(async function() { try { await Promise.all(Array.from({length:3}, () => pgPool.query('SELECT 1'))); } catch(_) {} }, 1000);

    // Pool monitoring — alert if pool exhausted
    setInterval(function() {
      if (!pgPool) return;
      const total = pgPool.totalCount, idle = pgPool.idleCount, waiting = pgPool.waitingCount;
      if (waiting > 5)  logger.warn('[Pool] waiting=' + waiting + ' total=' + total + ' idle=' + idle);
      if (waiting > 15) logger.error('[Pool] CRITICAL pool exhausted! waiting=' + waiting);
      if (total >= 18)  logger.warn('[Pool] near limit: ' + total + '/20 connections');
    }, 30000).unref();

    logger.info('✅ PostgreSQL (pool max=' + pgPool.options.max + ')');
    return pgPool;
  } catch (e) { return null; }
}

let sqliteDb = null, sqlJs = null, dirty = false, saveTimer = null;

function scheduleSave() {
  dirty = true;
  if (saveTimer) return;
  saveTimer = setTimeout(function() {
    saveTimer = null; if (!dirty) return; dirty = false;
    try { fs.writeFile(DB_PATH, Buffer.from(sqlJs.export()), function() {}); } catch (e) {}
  }, 500);
  if (saveTimer.unref) saveTimer.unref();
}

function saveDB() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  dirty = false;
  if (sqliteDb) return;
  if (sqlJs) try { fs.writeFile(DB_PATH, Buffer.from(sqlJs.export()), function() {}); } catch (e) {}
}

function getSqlite() {
  return null; // PostgreSQL only — SQLite disabled
}

const pgCache = new Map();
function toPgCached(sql) {
  if (pgCache.has(sql)) { var v = pgCache.get(sql); pgCache.delete(sql); pgCache.set(sql, v); return v; }
  var r = toPg(sql); pgCache.set(sql, r);
  if (pgCache.size > 500) { var k = pgCache.keys().next().value; pgCache.delete(k); }
  return r;
}

function toPg(sql) {
  if (!sql || typeof sql !== "string") return sql || "";
  var i = 0;
  return sql
    .replace(/datetime\('now'\)/g, 'NOW()')
    .replace(/datetime\('now',\s*'([^']+)'\)/g, function(_, p) {
      var m = p.match(/([+-]\d+)\s+(\w+)/);
      return m ? "NOW() + INTERVAL '" + m[1] + " " + m[2] + "'" : 'NOW()';
    })
    .replace(/strftime\('%H',\s*([^)]+)\)/g, "EXTRACT(HOUR FROM $1)")
    .replace(/INSERT OR REPLACE INTO (\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/gi, function(_, t, c, v) {
      var cols = c.split(',').map(function(x) { return x.trim(); });
      return 'INSERT INTO ' + t + '(' + c + ') VALUES(' + v + ') ON CONFLICT(' + cols[0] + ') DO UPDATE SET ' + cols.slice(1).map(function(x) { return x + '=EXCLUDED.' + x; }).join(',');
    })
    .replace(/LIKE \?/gi, 'ILIKE ?')
    .replace(/__BS__/gi, "BIGSERIAL").replace(/BIGSERIAL/gi, "__BS__")
    .replace(/SERIAL/gi, "INTEGER").replace(/__BS__/gi, "BIGSERIAL")
    .replace(/\?/g, function() { return '$' + (++i); });
}

function toSqlite(sql) {
  if (!sql || typeof sql !== "string") return sql || "";
  return sql
    .replace(/NOW\(\)/gi, "CURRENT_TIMESTAMP")
    .replace(/CURRENT_TIMESTAMP\s*-\s*INTERVAL\s*'(\d+)\s*(\w+)'/g, "datetime('now', '-$1 $2')")
    .replace(/EXTRACT\(HOUR FROM ([^)]+)\)/gi, "strftime('%H', $1)")
    .replace(/similarity\([^,]+,[^)]+\)/gi, "1.0")
    .replace(/::timestamp/gi, "").replace(/::interval/gi, "").replace(/::smallint/gi, "")
    .replace(/::integer/gi, "").replace(/::bigint/gi, "").replace(/::numeric/gi, "")
    .replace(/::float/gi, "").replace(/::real/gi, "").replace(/::double\s+precision/gi, "")
    .replace(/::boolean/gi, "").replace(/::text/gi, "")
    .replace(/::character\s+varying\([^)]+\)/gi, "").replace(/::character\([^)]+\)/gi, "")
    .replace(/::date/gi, "").replace(/::time/gi, "").replace(/::json/gi, "")
    .replace(/::jsonb/gi, "").replace(/::uuid/gi, "")
    .replace(/__BS__/gi, "INTEGER").replace(/BIGSERIAL/gi, "__BS__")
    .replace(/SERIAL/gi, "INTEGER").replace(/__BS__/gi, "INTEGER")
    .replace(/BIGINT/gi, "INTEGER").replace(/ILIKE/gi, "LIKE")
    .replace(/\$\d+/g, '?');
}

async function withRetry(fn) {
  for (var i = 0; i < 3; i++) {
    try { return await fn(); }
    catch (e) {
      var m = e.message || '';
      if ((m.includes('timeout') || m.includes('ECONNRESET')) && i < 2) {
        await new Promise(function(r) { setTimeout(r, 500 * Math.pow(2, i)); });
      } else { throw e; }
    }
  }
}

async function all(sql, params) {
  params = params || [];
  var pg = getPg();
  if (pg) {
    return withRetry(function() {
      return pg.query(sql, sanitizeParams(params)).then(function(r) { return r.rows; });
    }).catch(function(e){if(e&&e.message)logger.error('[DB]',e.message.substring(0,80));return[];});
  }
  try {
    var db = getSqlite();
    if (db) return db.prepare(toSqlite(sql)).all.apply(db, params);
    if (sqlJs) {
      var stmt = sqlJs.prepare(toSqlite(sql)); stmt.bind(params);
      var rows = []; while (stmt.step()) rows.push(stmt.getAsObject()); stmt.free();
      return rows;
    }
  } catch (e) { return []; }
  return [];
}

function get(sql, params) {
  return all(sql, params).then(function(r) { return r[0] || null; });
}

async function run(sql, params) {
  params = params || [];
  var pg = getPg();
  if (pg) {
    return withRetry(function() {
      return pg.query(sql, sanitizeParams(params));
    });
  }
  try {
    var db = getSqlite();
    if (db) { db.prepare(toSqlite(sql)).run.apply(db, params); return; }
    if (sqlJs) { sqlJs.run(toSqlite(sql), params); scheduleSave(); }
  } catch (e) { throw e; }
}

async function initSchema() {
  var pg = getPg();
  if (!pg) {
    var db = getSqlite();
    if (!db) {
      try { var initSqlJs = require('sql.js'); var SQL = await initSqlJs(); sqlJs = new SQL.Database(); } catch (e) { return; }
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
    "CREATE TABLE IF NOT EXISTS group_welcome(chat_id BIGINT PRIMARY KEY, image_file_id TEXT, message TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS polls (id SERIAL PRIMARY KEY, chat_id BIGINT NOT NULL, created_by BIGINT, question TEXT NOT NULL, media_file_id TEXT, media_type TEXT, message_id BIGINT, is_closed INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS poll_options (id SERIAL PRIMARY KEY, poll_id INTEGER NOT NULL, option_text TEXT NOT NULL, emoji TEXT DEFAULT '🔵', votes INTEGER DEFAULT 0, position INTEGER DEFAULT 1)",
    "CREATE TABLE IF NOT EXISTS poll_votes (poll_id INTEGER NOT NULL, option_id INTEGER NOT NULL, user_id BIGINT NOT NULL, voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(poll_id, user_id))",
    "CREATE TABLE IF NOT EXISTS ai_history (id SERIAL PRIMARY KEY, user_id BIGINT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS group_chats (chat_id BIGINT PRIMARY KEY, title TEXT, specialty_id INTEGER DEFAULT 0, notify_new_files INTEGER DEFAULT 1, joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS cache_store (key TEXT PRIMARY KEY, value TEXT, expires_at BIGINT)",
    "CREATE TABLE IF NOT EXISTS group_bot_msgs (id SERIAL PRIMARY KEY, chat_id BIGINT NOT NULL, message_id BIGINT NOT NULL, sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS group_members (chat_id BIGINT, user_id BIGINT, username TEXT, first_name TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(chat_id, user_id))",
    "CREATE TABLE IF NOT EXISTS reports (id SERIAL PRIMARY KEY, file_id INTEGER NOT NULL, user_id BIGINT NOT NULL, reason TEXT, status TEXT DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS comments (id SERIAL PRIMARY KEY, file_id INTEGER NOT NULL, user_id BIGINT NOT NULL, text TEXT NOT NULL, is_deleted INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS user_points (user_id BIGINT PRIMARY KEY, total_points INTEGER DEFAULT 0, downloads_count INTEGER DEFAULT 0, ratings_count INTEGER DEFAULT 0, comments_count INTEGER DEFAULT 0, streak_days INTEGER DEFAULT 0, last_activity_date DATE, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS group_notify_log (id SERIAL PRIMARY KEY, file_id INTEGER NOT NULL, chat_id BIGINT NOT NULL, sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(file_id, chat_id))",
  ];

  for (var ti = 0; ti < tables.length; ti++) {
    try {
      if (pg) await pg.query(tables[ti].replace(/SERIAL/g, 'BIGSERIAL'));
      else { var t = getSqlite() || sqlJs; if (t) { var fn = t.exec || t.run.bind(t); fn(tables[ti].replace(/SERIAL/g, 'INTEGER').replace(/BIGINT/g, 'INTEGER').replace(/BIGSERIAL/g, 'INTEGER')); } }
    } catch (e) {}
  }

  if (pg) {
    try {
      await pg.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
      await pg.query("CREATE INDEX IF NOT EXISTS idx_files_title_trgm ON files USING GIN(title gin_trgm_ops)");
      await pg.query("CREATE INDEX IF NOT EXISTS idx_subjects_name_trgm ON subjects USING GIN(name gin_trgm_ops)");
    } catch (e) {}
  }

  var indexes = [
    "CREATE INDEX IF NOT EXISTS idx_ai_history_user ON ai_history(user_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_files_category ON files(category_id)",
    "CREATE INDEX IF NOT EXISTS idx_files_deleted ON files(is_deleted)",
    "CREATE INDEX IF NOT EXISTS idx_files_downloads ON files(downloads DESC)",
    "CREATE INDEX IF NOT EXISTS idx_files_uploaded ON files(uploaded_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_users_active ON users(last_active)",
    "CREATE INDEX IF NOT EXISTS idx_ratings_file ON ratings(file_id)",
    "CREATE INDEX IF NOT EXISTS idx_comments_file ON comments(file_id)",
    "CREATE INDEX IF NOT EXISTS idx_categories_subject ON categories(subject_id)",
    "CREATE INDEX IF NOT EXISTS idx_subjects_semester ON subjects(semester_id)",
    "CREATE INDEX IF NOT EXISTS idx_semesters_year ON semesters(year_id)",
    "CREATE INDEX IF NOT EXISTS idx_years_specialty ON years(specialty_id)",
    "CREATE INDEX IF NOT EXISTS idx_user_states_updated_at ON user_states(updated_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_cache_store_expires_at ON cache_store(expires_at)",
    "CREATE INDEX IF NOT EXISTS idx_gnl_file ON group_notify_log(file_id)",
    "CREATE INDEX IF NOT EXISTS idx_user_points_total ON user_points(total_points DESC)",
    "CREATE INDEX IF NOT EXISTS idx_users_banned ON users(is_banned) WHERE is_banned=1",
    "CREATE INDEX IF NOT EXISTS idx_sched_msgs_send_at ON scheduled_messages(send_at) WHERE sent=0",
    "CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_option ON poll_votes(poll_id, option_id)",
    "CREATE INDEX IF NOT EXISTS idx_group_chats_specialty ON group_chats(specialty_id)",
    "CREATE INDEX IF NOT EXISTS idx_files_downloads_cat ON files(category_id, downloads DESC) WHERE is_deleted=0",
    "CREATE INDEX IF NOT EXISTS idx_files_uploaded_cat ON files(category_id, uploaded_at DESC) WHERE is_deleted=0",
    "CREATE INDEX IF NOT EXISTS idx_subjects_semester_id ON subjects(semester_id, id) WHERE is_deleted=0",
    "CREATE INDEX IF NOT EXISTS idx_semesters_year_id ON semesters(year_id, id) WHERE is_deleted=0",
    "CREATE INDEX IF NOT EXISTS idx_years_specialty_id ON years(specialty_id, id) WHERE is_deleted=0",
    "CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_history_user_file ON history(user_id, file_id)",
    "CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status)",
    "CREATE INDEX IF NOT EXISTS idx_group_members_chat ON group_members(chat_id)",
    "CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options(poll_id)",
    "CREATE INDEX IF NOT EXISTS idx_poll_votes_option ON poll_votes(option_id)",
  ];

  for (var ii = 0; ii < indexes.length; ii++) {
    try {
      if (pg) await pg.query(indexes[ii]);
      else { var t2 = getSqlite() || sqlJs; if (t2) { var fn2 = t2.exec || t2.run.bind(t2); fn2(indexes[ii]); } }
    } catch (e) {}
  }

  if (!pg && !getSqlite() && sqlJs) saveDB();

  if (pg) {
    var tsCols = [
      ["users","joined_at"],["users","last_active"],["admins","added_at"],
      ["files","uploaded_at"],["history","viewed_at"],["logs","created_at"],
      ["user_specialties","updated_at"],["bundles","created_at"],
      ["message_templates","created_at"],["scheduled_messages","created_at"],
      ["user_states","updated_at"],["ai_history","created_at"],
      ["group_chats","joined_at"],["group_bot_msgs","sent_at"],
      ["group_members","updated_at"],["reports","created_at"],
      ["comments","created_at"],["group_notify_log","sent_at"],
    ];
    for (var tc = 0; tc < tsCols.length; tc++) {
      try { await pg.query("ALTER TABLE " + tsCols[tc][0] + " ALTER COLUMN " + tsCols[tc][1] + " TYPE TIMESTAMP USING " + tsCols[tc][1] + "::timestamp"); } catch(e) {}
    }
  }

  logger.info('✅ Schema ready');
}

async function getSetting(key) {
  var r = await get('SELECT value FROM settings WHERE key=$1', [key]);
  return r ? r.value : null;
}

async function setSetting(key, value) {
  await run('INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value', [key, value]);
}

module.exports = { all: all, get: get, run: run, initSchema: initSchema, getSetting: getSetting, setSetting: setSetting, saveDB: saveDB, DB_PATH: DB_PATH, getPg: getPg };
