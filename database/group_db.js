'use strict';
/**
 * 🗄️ database/group_db.js — دوال قاعدة البيانات الخاصة بالقروبات
 * ──────────────────────────────────────────────────────────────
 * تحتاج إنشاء هذه الجداول في db.js :
 *
 *  CREATE TABLE IF NOT EXISTS group_warns (
 *    id         SERIAL PRIMARY KEY,
 *    chat_id    BIGINT NOT NULL,
 *    user_id    BIGINT NOT NULL,
 *    warned_by  BIGINT,
 *    reason     TEXT,
 *    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 *  );
 *
 *  CREATE TABLE IF NOT EXISTS group_bans (
 *    id         SERIAL PRIMARY KEY,
 *    chat_id    BIGINT NOT NULL,
 *    user_id    BIGINT NOT NULL,
 *    banned_by  BIGINT,
 *    reason     TEXT,
 *    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *    updated_at TIMESTAMP,
 *    UNIQUE(chat_id, user_id)
 *  );
 *
 *  ALTER TABLE group_chats ADD COLUMN IF NOT EXISTS rules TEXT;
 *  ALTER TABLE group_chats ADD COLUMN IF NOT EXISTS goodbye_enabled INTEGER DEFAULT 0;
 */

const { run, all, get } = require('./db');

// ══════════════════════════════════════════════════════════
// ⚠️ نظام التحذيرات
// ══════════════════════════════════════════════════════════
const warns = {
  add: (chatId, userId, warnedBy, reason) =>
    run(
      `INSERT INTO group_warns(chat_id, user_id, warned_by, reason, created_at)
       VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP)`,
      [chatId, userId, warnedBy, reason || '']
    ),

  count: async (chatId, userId) => {
    const r = await get(
      'SELECT COUNT(*) AS cnt FROM group_warns WHERE chat_id=$1 AND user_id=$2',
      [chatId, userId]
    );
    return parseInt(r?.cnt || 0);
  },

  list: (chatId, userId) =>
    all(
      'SELECT * FROM group_warns WHERE chat_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 10',
      [chatId, userId]
    ),

  clear: (chatId, userId) =>
    run('DELETE FROM group_warns WHERE chat_id=$1 AND user_id=$2', [chatId, userId]),

  clearAll: chatId =>
    run('DELETE FROM group_warns WHERE chat_id=$1', [chatId]),
};

// ══════════════════════════════════════════════════════════
// 🚫 نظام الحظر
// ══════════════════════════════════════════════════════════
const bans = {
  add: (chatId, userId, bannedBy, reason) =>
    run(
      `INSERT INTO group_bans(chat_id, user_id, banned_by, reason, created_at)
       VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP)
       ON CONFLICT(chat_id, user_id) DO UPDATE
         SET reason=$4, updated_at=CURRENT_TIMESTAMP`,
      [chatId, userId, bannedBy, reason || '']
    ),

  remove: (chatId, userId) =>
    run('DELETE FROM group_bans WHERE chat_id=$1 AND user_id=$2', [chatId, userId]),

  isBanned: async (chatId, userId) => {
    const r = await get('SELECT 1 FROM group_bans WHERE chat_id=$1 AND user_id=$2', [chatId, userId]);
    return !!r;
  },

  list: chatId =>
    all('SELECT * FROM group_bans WHERE chat_id=$1 ORDER BY created_at DESC', [chatId]),
};

// ══════════════════════════════════════════════════════════
// 📜 قواعد القروب
// ══════════════════════════════════════════════════════════
const rules = {
  get: async chatId => {
    const r = await get('SELECT rules FROM group_chats WHERE chat_id=$1', [chatId]);
    return r?.rules || null;
  },

  set: (chatId, text) =>
    run('UPDATE group_chats SET rules=$1 WHERE chat_id=$2', [text, chatId]),
};

// ══════════════════════════════════════════════════════════
// 👥 الأعضاء
// ══════════════════════════════════════════════════════════
const members = {
  add: (chatId, userId, username, firstName) =>
    run(
      `INSERT INTO group_members(chat_id, user_id, username, first_name, updated_at)
       VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP)
       ON CONFLICT(chat_id, user_id) DO UPDATE
         SET first_name=EXCLUDED.first_name, updated_at=CURRENT_TIMESTAMP`,
      [chatId, userId, username || '', firstName || '']
    ),

  remove: (chatId, userId) =>
    run('DELETE FROM group_members WHERE chat_id=$1 AND user_id=$2', [chatId, userId]),

  list: (chatId, limit = 200) =>
    all(
      'SELECT * FROM group_members WHERE chat_id=$1 ORDER BY updated_at DESC LIMIT $2',
      [chatId, limit]
    ),

  count: async chatId => {
    const r = await get('SELECT COUNT(*) AS cnt FROM group_members WHERE chat_id=$1', [chatId]);
    return parseInt(r?.cnt || 0);
  },
};

// ══════════════════════════════════════════════════════════
// ⚙️ إعدادات القروب
// ══════════════════════════════════════════════════════════
const settings = {
  get: chatId =>
    get('SELECT * FROM group_chats WHERE chat_id=$1', [chatId]),

  setSpecialty: (chatId, specialtyId) =>
    run('UPDATE group_chats SET specialty_id=$1 WHERE chat_id=$2', [specialtyId, chatId]),

  setNotify: (chatId, enabled) =>
    run('UPDATE group_chats SET notify_new_files=$1 WHERE chat_id=$2', [enabled ? 1 : 0, chatId]),

  setGoodbye: (chatId, enabled) =>
    run('UPDATE group_chats SET goodbye_enabled=$1 WHERE chat_id=$2', [enabled ? 1 : 0, chatId]),

  listAll: () =>
    all('SELECT * FROM group_chats ORDER BY title'),

  listActive: () =>
    all('SELECT * FROM group_chats WHERE notify_new_files=1 ORDER BY title'),
};

// ══════════════════════════════════════════════════════════
// 🏗️ migration — إنشاء الجداول الجديدة إن لم تكن موجودة
// ══════════════════════════════════════════════════════════
async function migrateGroupTables() {
  const queries = [
    // جدول التحذيرات
    `CREATE TABLE IF NOT EXISTS group_warns (
       id         SERIAL PRIMARY KEY,
       chat_id    BIGINT NOT NULL,
       user_id    BIGINT NOT NULL,
       warned_by  BIGINT,
       reason     TEXT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE INDEX IF NOT EXISTS idx_group_warns_user ON group_warns(chat_id, user_id)`,

    // جدول الحظر
    `CREATE TABLE IF NOT EXISTS group_bans (
       id         SERIAL PRIMARY KEY,
       chat_id    BIGINT NOT NULL,
       user_id    BIGINT NOT NULL,
       banned_by  BIGINT,
       reason     TEXT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP,
       UNIQUE(chat_id, user_id)
     )`,
    `CREATE INDEX IF NOT EXISTS idx_group_bans_user ON group_bans(chat_id, user_id)`,

    // أعمدة جديدة في group_chats
    `ALTER TABLE group_chats ADD COLUMN IF NOT EXISTS rules           TEXT`,
    `ALTER TABLE group_chats ADD COLUMN IF NOT EXISTS goodbye_enabled INTEGER DEFAULT 0`,
  ];

  for (const q of queries) {
    await run(q, []).catch(e => {
      // تجاهل أخطاء "already exists"
      if (!e.message?.includes('already exists') && !e.message?.includes('duplicate')) {
        console.error('[GroupDB Migration]', e.message);
      }
    });
  }

  console.log('✅ [GroupDB] Migration complete');
}

module.exports = { warns, bans, rules, members, settings, migrateGroupTables };
