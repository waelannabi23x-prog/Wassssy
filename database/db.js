'use strict';
const path   = require('path');
const logger = require('../utils/logger');

const USE_PG = !!process.env.DATABASE_URL;
let pgPool   = null;

// ── PostgreSQL Pool ──
function getPg() {
  if (pgPool) return pgPool;
  if (!USE_PG) return null;
  try {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString:            process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
      max:                         20,   // كان 8 — رفعناه لـ 20
      min:                         2,    // دائماً connection جاهزة
      idleTimeoutMillis:           20000,
      connectionTimeoutMillis:     3000,
      statement_timeout:           20000,
      keepAlive:                   true,
      keepAliveInitialDelayMillis: 10000,
    });

    pgPool.on('error', err => {
      // ✅ نسجّل الخطأ فقط — لا نحذف الـ pool لأن ذلك يسبب connection leak
      // الـ pool يعيد الاتصال تلقائياً
      logger.error('[DB] pool error (auto-recovering): ' + err.message);
    });

    // Keepalive ping كل 25 ثانية
    const _kpTimer = setInterval(() => {
      if (!pgPool) { clearInterval(_kpTimer); return; }
      pgPool.query('SELECT 1').catch(e => {
        // لا نحذف الـ pool — هو يعيد الاتصال تلقائياً
        require('./logger').warn('[DB] keepalive failed (auto-recovering):', e.message);
      });
    }, 25000);
    _kpTimer.unref();

    logger.info('✅ PG Pool جاهز (max:20)');
    return pgPool;
  } catch(e) {
    logger.error('[DB] pool init error: ' + e.message);
    return null;
  }
}

// ── SQLite Fallback ──

async function getSQLite() {
  // SQLite disabled on Railway — PostgreSQL only
  return null;
}


// ── Public API ──
async function get(sql, params = []) {
  if (USE_PG) {
    const pool = getPg();
    if (!pool) throw new Error('No PG pool');
    try { const r = await pool.query(sql, params); return r.rows[0] || null; }
    catch(e) { logger.error('[DB] get: ' + e.message); throw e; }
  }
  const w = await getSQLite();
  if (!w) throw new Error('No SQLite');
  return sGet(w, sql, params);
}

async function all(sql, params = []) {
  if (USE_PG) {
    const pool = getPg();
    if (!pool) throw new Error('No PG pool');
    try { const r = await pool.query(sql, params); return r.rows; }
    catch(e) { logger.error('[DB] all: ' + e.message); throw e; }
  }
  const w = await getSQLite();
  if (!w) throw new Error('No SQLite');
  return sAll(w, sql, params);
}

async function run(sql, params = []) {
  // ⚡ Intercept download counter → batch بدل write مباشر
  if (
    sql.includes('downloads') &&
    (sql.includes('+ 1') || sql.includes('+1') || sql.includes('downloads+1') || sql.includes('downloads + 1')) &&
    sql.toLowerCase().includes('files')
  ) {
    const fid = params?.[0] ?? params?.[1];
    if (fid) { batchDownload(parseInt(fid)); return { changes: 1, lastID: 0 }; }
  }
  if (USE_PG) {
    const pool = getPg();
    if (!pool) throw new Error('No PG pool');
    try { await pool.query(sql, params); }
    catch(e) { logger.error('[DB] run: ' + e.message); throw e; }
    return;
  }
  const w = await getSQLite();
  if (!w) throw new Error('No SQLite');
  sRun(w, sql, params);
}

async function transaction(queries) {
  if (USE_PG) {
    const pool   = getPg();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const { sql, params } of queries) await client.query(sql, params || []);
      await client.query('COMMIT');
    } catch(e) {
      await client.query('ROLLBACK').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      throw e;
    } finally { client.release(); }
    return;
  }
  const w = await getSQLite();
  if (!w) throw new Error('No SQLite');
  if (w.type === 'better') {
    const t = w.db.transaction(() => { for (const { sql, params } of queries) sRun(w, sql, params || []); });
    t();
  } else {
    for (const { sql, params } of queries) sRun(w, sql, params || []);
  }
}

// ── Schema ──
async function initSchema() {
  const pg = getPg();

  const TABLES = [
    "CREATE TABLE IF NOT EXISTS required_channels(id SERIAL PRIMARY KEY,channel_id TEXT NOT NULL UNIQUE,channel_name TEXT,channel_url TEXT,added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,is_active INTEGER DEFAULT 1)",
    "CREATE TABLE IF NOT EXISTS users(id BIGINT PRIMARY KEY,first_name TEXT,last_name TEXT,username TEXT,is_banned INTEGER DEFAULT 0,joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS admins(user_id BIGINT PRIMARY KEY,added_by BIGINT,permissions TEXT DEFAULT 'upload,add_content',specialty_id INTEGER DEFAULT 0,added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS specialties(id SERIAL PRIMARY KEY,name TEXT NOT NULL UNIQUE,is_deleted INTEGER DEFAULT 0)",
    "CREATE TABLE IF NOT EXISTS years(id SERIAL PRIMARY KEY,specialty_id INTEGER NOT NULL,name TEXT NOT NULL,is_deleted INTEGER DEFAULT 0)",
    "CREATE TABLE IF NOT EXISTS semesters(id SERIAL PRIMARY KEY,year_id INTEGER NOT NULL,name TEXT NOT NULL,is_deleted INTEGER DEFAULT 0)",
    "CREATE TABLE IF NOT EXISTS subjects(id SERIAL PRIMARY KEY,semester_id INTEGER NOT NULL,name TEXT NOT NULL,is_deleted INTEGER DEFAULT 0)",
    "CREATE TABLE IF NOT EXISTS categories(id SERIAL PRIMARY KEY,subject_id INTEGER NOT NULL,name TEXT NOT NULL,is_deleted INTEGER DEFAULT 0)",
    "CREATE TABLE IF NOT EXISTS files(id SERIAL PRIMARY KEY,category_id INTEGER NOT NULL,title TEXT NOT NULL,description TEXT DEFAULT '',file_id TEXT NOT NULL,file_type TEXT DEFAULT 'document',downloads INTEGER DEFAULT 0,uploaded_by BIGINT DEFAULT 0,is_deleted INTEGER DEFAULT 0,uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS favorites(user_id BIGINT,file_id INTEGER,PRIMARY KEY(user_id,file_id))",
    "CREATE TABLE IF NOT EXISTS history(id SERIAL PRIMARY KEY,user_id BIGINT,file_id INTEGER,viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS ratings(user_id BIGINT,file_id INTEGER,rating INTEGER,PRIMARY KEY(user_id,file_id))",
    "CREATE TABLE IF NOT EXISTS user_specialties(user_id BIGINT PRIMARY KEY,specialty_id INTEGER,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT)",
    "CREATE TABLE IF NOT EXISTS bundles(id SERIAL PRIMARY KEY,category_id INTEGER NOT NULL,title TEXT NOT NULL,description TEXT DEFAULT '',downloads INTEGER DEFAULT 0,uploaded_by BIGINT DEFAULT 0,is_deleted INTEGER DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS bundle_files(id SERIAL PRIMARY KEY,bundle_id INTEGER NOT NULL,file_id TEXT NOT NULL,file_type TEXT DEFAULT 'document',title TEXT DEFAULT '')",
        "CREATE TABLE IF NOT EXISTS million_questions(id SERIAL PRIMARY KEY,question TEXT NOT NULL,option_a TEXT,option_b TEXT,option_c TEXT,option_d TEXT,correct_answer TEXT,difficulty INTEGER DEFAULT 1,category TEXT DEFAULT 'general',used_count INTEGER DEFAULT 0,is_active INTEGER DEFAULT 1,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS user_states(user_id BIGINT PRIMARY KEY,state TEXT NOT NULL,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS group_chats(chat_id BIGINT PRIMARY KEY,title TEXT,specialty_id INTEGER DEFAULT 0,notify_new_files INTEGER DEFAULT 1,joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS polls(id SERIAL PRIMARY KEY,chat_id BIGINT NOT NULL,created_by BIGINT,question TEXT,media_file_id TEXT,media_type TEXT,message_id BIGINT,is_closed INTEGER DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS poll_options(id SERIAL PRIMARY KEY,poll_id INTEGER NOT NULL,option_text TEXT NOT NULL,emoji TEXT DEFAULT '🔵',votes INTEGER DEFAULT 0,position INTEGER DEFAULT 1)",
    "CREATE TABLE IF NOT EXISTS poll_votes(poll_id INTEGER NOT NULL,option_id INTEGER NOT NULL,user_id BIGINT NOT NULL,voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(poll_id,user_id))",
    "CREATE TABLE IF NOT EXISTS ai_history(id SERIAL PRIMARY KEY,user_id BIGINT NOT NULL,role TEXT NOT NULL,content TEXT NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS comments(id SERIAL PRIMARY KEY,file_id INTEGER NOT NULL,user_id BIGINT NOT NULL,text TEXT NOT NULL,is_deleted INTEGER DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS reports(id SERIAL PRIMARY KEY,file_id INTEGER NOT NULL,user_id BIGINT NOT NULL,reason TEXT,status TEXT DEFAULT 'pending',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS user_points(user_id BIGINT PRIMARY KEY,total_points INTEGER DEFAULT 0,downloads_count INTEGER DEFAULT 0,ratings_count INTEGER DEFAULT 0,comments_count INTEGER DEFAULT 0,streak_days INTEGER DEFAULT 0,last_activity_date DATE,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS group_members(chat_id BIGINT,user_id BIGINT,username TEXT,first_name TEXT,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(chat_id,user_id))",
    "CREATE TABLE IF NOT EXISTS group_notify_log(id SERIAL PRIMARY KEY,file_id INTEGER NOT NULL,chat_id BIGINT NOT NULL,sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE(file_id,chat_id))",
    "CREATE TABLE IF NOT EXISTS logs(id SERIAL PRIMARY KEY,user_id BIGINT,action TEXT,details TEXT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS message_templates(id SERIAL PRIMARY KEY,name TEXT NOT NULL UNIQUE,type TEXT DEFAULT 'text',content TEXT DEFAULT '',file_id TEXT DEFAULT '',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS scheduled_messages(id SERIAL PRIMARY KEY,template_id INTEGER,target TEXT DEFAULT 'all',specialty_id INTEGER DEFAULT 0,send_at TEXT,sent INTEGER DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS group_bot_msgs(id SERIAL PRIMARY KEY,chat_id BIGINT NOT NULL,message_id BIGINT NOT NULL,sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS group_welcome(chat_id BIGINT PRIMARY KEY,image_file_id TEXT,message TEXT,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS cache_store(key TEXT PRIMARY KEY,value TEXT,expires_at BIGINT)",
    "CREATE TABLE IF NOT EXISTS ads(id SERIAL PRIMARY KEY,title TEXT NOT NULL,body TEXT,icon TEXT DEFAULT '📌',link TEXT,specialty_id INTEGER,is_pinned INTEGER DEFAULT 0,is_deleted INTEGER DEFAULT 0,image_url TEXT,video_url TEXT,created_by BIGINT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS channels(id SERIAL PRIMARY KEY,name TEXT NOT NULL,description TEXT,link TEXT,icon TEXT DEFAULT '📺',members_count INTEGER,sort_order INTEGER DEFAULT 0,is_deleted INTEGER DEFAULT 0,created_by BIGINT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS comment_likes(user_id BIGINT NOT NULL,comment_id INTEGER NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,comment_id))",
    "CREATE TABLE IF NOT EXISTS downloads(id SERIAL PRIMARY KEY,user_id BIGINT NOT NULL,file_id INTEGER NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
  ];

  for (const sql of TABLES) {
    try {
      if (pg) await pg.query(sql);
      else { const w = await getSQLite(); if (w) sRun(w, sql.replace(/SERIAL/g, 'INTEGER').replace(/BIGINT/g, 'INTEGER'), []); }
    } catch(err) { require('../utils/logger').debug('[catch]', err.message); }
  }

  // ── Indexes — الأصليين + الجدد المحسّنين ──
  if (pg) {
    const IDX = [
      "CREATE INDEX IF NOT EXISTS idx_files_category   ON files(category_id)",
      "CREATE INDEX IF NOT EXISTS idx_files_cat_del    ON files(category_id,is_deleted)",
      "CREATE INDEX IF NOT EXISTS idx_files_deleted    ON files(is_deleted)",
      "CREATE INDEX IF NOT EXISTS idx_files_downloads  ON files(downloads DESC)",
      "CREATE INDEX IF NOT EXISTS idx_files_uploader   ON files(uploaded_by)",
      "CREATE INDEX IF NOT EXISTS idx_history_user     ON history(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_history_time     ON history(user_id,viewed_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_favorites_user   ON favorites(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_favorites_file   ON favorites(file_id)",
      "CREATE INDEX IF NOT EXISTS idx_ratings_file     ON ratings(file_id)",
      "CREATE INDEX IF NOT EXISTS idx_ratings_avg      ON ratings(file_id,rating)",
      "CREATE INDEX IF NOT EXISTS idx_comments_file    ON comments(file_id)",
      "CREATE INDEX IF NOT EXISTS idx_user_points      ON user_points(total_points DESC)",
      "CREATE INDEX IF NOT EXISTS idx_users_active     ON users(last_active)",
      "CREATE INDEX IF NOT EXISTS idx_cats_subject     ON categories(subject_id,is_deleted)",
      "CREATE INDEX IF NOT EXISTS idx_subs_sem         ON subjects(semester_id,is_deleted)",
      "CREATE INDEX IF NOT EXISTS idx_sems_year        ON semesters(year_id,is_deleted)",
      "CREATE INDEX IF NOT EXISTS idx_years_spec       ON years(specialty_id,is_deleted)",
      "CREATE INDEX IF NOT EXISTS idx_bundle_files     ON bundle_files(bundle_id)",

      // ✅ جدد — تسرّع أكثر الـ queries استخداماً
      "CREATE INDEX IF NOT EXISTS idx_files_uploaded   ON files(uploaded_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_reports_status   ON reports(status,created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_files_search     ON files USING gin(to_tsvector('simple', title))",
      "CREATE INDEX IF NOT EXISTS idx_group_chats_spec ON group_chats(specialty_id)",
      "CREATE INDEX IF NOT EXISTS idx_users_banned     ON users(is_banned,joined_at DESC)",               // latest files
      // REMOVED duplicate: idx_users_banned simple (composite one above covers it)
      "CREATE INDEX IF NOT EXISTS idx_history_file     ON history(file_id)",                      // file stats
      "CREATE INDEX IF NOT EXISTS idx_comments_del     ON comments(file_id, is_deleted)",         // comments query
      "CREATE INDEX IF NOT EXISTS idx_ai_history_user  ON ai_history(user_id, created_at DESC)",  // AI chat history
      "CREATE INDEX IF NOT EXISTS idx_user_states_upd  ON user_states(updated_at)",               // cleanup
      "CREATE INDEX IF NOT EXISTS idx_gnl_chat         ON group_notify_log(chat_id)",             // group notify
      "CREATE INDEX IF NOT EXISTS idx_sched_sent       ON scheduled_messages(sent, send_at)",     // scheduler
      "CREATE INDEX IF NOT EXISTS idx_ads_deleted      ON ads(is_deleted,created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_channels_sort    ON channels(sort_order ASC,id DESC)",
      "CREATE INDEX IF NOT EXISTS idx_downloads_user   ON downloads(user_id,created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_downloads_file   ON downloads(file_id)",               // bundle files
    ];
    for (const idx of IDX) {
      try { await pg.query(idx); } catch(err) { require('../utils/logger').debug('[catch]', err.message); }
    }
    

      logger.info('✅ Indexes جاهزة (' + IDX.length + ')');
  }

  // Migration: history unique constraint
  try { if(pg) await pg.query('ALTER TABLE history ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE'); } catch(err) { require('../utils/logger').debug('[catch]', err.message); }
  try { if(pg) await pg.query('DELETE FROM history h1 USING history h2 WHERE h1.id > h2.id AND h1.user_id = h2.user_id AND h1.file_id = h2.file_id'); } catch(err) { require('../utils/logger').debug('[catch]', err.message); }
  try { if(pg) await pg.query('ALTER TABLE history ADD CONSTRAINT IF NOT EXISTS hist_user_file_unique UNIQUE (user_id, file_id)'); } catch(err) { require('../utils/logger').debug('[catch]', err.message); }

  // Migration: history unique constraint
  try { if(pg) await pg.query('ALTER TABLE history ADD CONSTRAINT hist_user_file_unique UNIQUE (user_id, file_id)'); } catch(err) { require('../utils/logger').debug('[catch]', err.message); }

  // Migration: used_count
  try { if(pg) await pg.query('ALTER TABLE million_questions ADD COLUMN IF NOT EXISTS used_count INTEGER DEFAULT 0'); } catch(err) { require('../utils/logger').debug('[catch]', err.message); }
  try { if(pg) await pg.query('CREATE INDEX IF NOT EXISTS idx_mq_used ON million_questions(used_count) WHERE is_active=1'); } catch(err) { require('../utils/logger').debug('[catch]', err.message); }

  // ── Migrations: pg_trgm + search indexes ──
  try { if(pg) await pg.query('CREATE EXTENSION IF NOT EXISTS pg_trgm'); } catch(err) { require('../utils/logger').debug('[catch]', err.message); }
  try { if(pg) await pg.query("CREATE INDEX IF NOT EXISTS idx_files_fts ON files USING GIN(to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'')))"); } catch(err) { require('../utils/logger').debug('[catch]', err.message); }
  try { if(pg) await pg.query('CREATE INDEX IF NOT EXISTS idx_files_title_trgm ON files USING GIN(title gin_trgm_ops)'); } catch(err) { require('../utils/logger').debug('[catch]', err.message); }
  try { if(pg) await pg.query('CREATE INDEX IF NOT EXISTS idx_files_desc_trgm  ON files USING GIN(description gin_trgm_ops)'); } catch(err) { require('../utils/logger').debug('[catch]', err.message); }
  try { if(pg) await pg.query('CREATE INDEX IF NOT EXISTS idx_users_name_trgm  ON users USING GIN(first_name gin_trgm_ops)'); } catch(err) { require('../utils/logger').debug('[catch]', err.message); }

// ── Migrations: جداول bundle_files.sort_order + bio ──
  try { if(pg) await pg.query('ALTER TABLE bundle_files ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0'); } catch(err) { require('../utils/logger').debug('[catch]', err.message); }
  try { if(pg) await pg.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT NULL'); } catch(err) { require('../utils/logger').debug('[catch]', err.message); }
  try { if(pg) await pg.query('ALTER TABLE comments ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0'); } catch(err) { require('../utils/logger').debug('[catch]', err.message); }

  logger.info('✅ Schema ready');
}

async function getSetting(k) {
  const r = await get('SELECT value FROM settings WHERE key=$1', [k]);
  return r ? r.value : null;
}

async function setSetting(k, v) {
  await run('INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value', [k, v]);
}

function saveDB() {}

// ── Batch Download Counter ──────────────────────────────────────
const _dlBatch = new Map();

function batchDownload(fileId) {
  const id = parseInt(fileId);
  if (!id) return;
  _dlBatch.set(id, (_dlBatch.get(id) || 0) + 1);
}

async function _flushDlBatch() {
  if (!_dlBatch.size) return;
  const pg = getPg();
  if (!pg) return;
  const entries = [..._dlBatch];
  _dlBatch.clear();
  await Promise.all(
    entries.map(([fid, cnt]) =>
      pg.query('UPDATE files SET downloads = downloads + $1 WHERE id = $2', [cnt, fid]).catch(e => logger.error('[DL]', e.message))
    )
  );
}

setInterval(_flushDlBatch, 30000).unref(); // flush كل 30 ثانية


// ── Prepared Statements — تُعدَّل مرة واحدة لكل connection ──────
const PREPARED = {
  getFile:    { name: 'get_file',     text: 'SELECT * FROM files WHERE id=$1 AND is_deleted=0' },
  getUser:    { name: 'get_user',     text: 'SELECT * FROM users WHERE id=$1' },
  addHistory: { name: 'add_hist',     text: 'INSERT INTO history(user_id,file_id,viewed_at) VALUES($1,$2,NOW()) ON CONFLICT DO NOTHING' },
  getCats:    { name: 'get_cats',     text: 'SELECT * FROM categories WHERE subject_id=$1 AND is_deleted=0 ORDER BY name ASC' },
  getFav:     { name: 'get_fav',      text: 'SELECT 1 FROM favorites WHERE user_id=$1 AND file_id=$2' },
  getAdm:     { name: 'get_adm',      text: 'SELECT permissions FROM admins WHERE user_id=$1' },
  getBan:     { name: 'get_ban',      text: 'SELECT is_banned FROM users WHERE id=$1' },
};

async function queryP(name, values) {
  const pg = await getPg();
  if (!pg) return null;
  const stmt = PREPARED[name];
  if (!stmt) throw new Error('Unknown prepared statement: ' + name);
  const r = await pg.query({ name: stmt.name, text: stmt.text, values });
  return r.rows;
}

async function getP(name, values) {
  const rows = await queryP(name, values);
  return rows?.[0] || null;
}

module.exports = { batchDownload, queryP, getP, get, all, run, transaction, getPg, initSchema, getSetting, setSetting, saveDB };
// هذا السطر ما يضاف هنا — شغّل الكومند التالي مباشرة على DB
