'use strict';
// ══════════════════════════════════════════════════════════════
//  🎮 أكسيو أو فيريتي — قاعدة البيانات
//  إحصائيات دائمة + إعدادات لكل قروب + حفظ الجلسة لدعم إعادة التشغيل
// ══════════════════════════════════════════════════════════════

const { get, all, run, getPg } = require('../../database/db');
const logger = require('../../utils/logger');
const CFG = require('./config');

async function migrate() {
  const pg = getPg();
  if (!pg) return;
  const queries = [
    `CREATE TABLE IF NOT EXISTS tod_stats (
      user_id BIGINT PRIMARY KEY,
      first_name TEXT DEFAULT '',
      username TEXT DEFAULT '',
      games_played INTEGER DEFAULT 0,
      asked_count INTEGER DEFAULT 0,
      answered_count INTEGER DEFAULT 0,
      dare_completed INTEGER DEFAULT 0,
      truth_completed INTEGER DEFAULT 0,
      timeouts INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS tod_achievements (
      user_id BIGINT NOT NULL,
      achievement_key TEXT NOT NULL,
      earned_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY(user_id, achievement_key)
    )`,
    `CREATE TABLE IF NOT EXISTS tod_settings (
      chat_id BIGINT PRIMARY KEY,
      reg_timeout INTEGER DEFAULT ${CFG.DEFAULT_TIMERS.REGISTRATION},
      choice_timeout INTEGER DEFAULT ${CFG.DEFAULT_TIMERS.CHOICE},
      submit_timeout INTEGER DEFAULT ${CFG.DEFAULT_TIMERS.SUBMIT},
      answer_timeout INTEGER DEFAULT ${CFG.DEFAULT_TIMERS.ANSWER},
      banter_timeout INTEGER DEFAULT ${CFG.DEFAULT_TIMERS.BANTER},
      min_players INTEGER DEFAULT ${CFG.MIN_PLAYERS},
      delete_offtopic BOOLEAN DEFAULT TRUE,
      fairness_enabled BOOLEAN DEFAULT TRUE,
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS tod_global_defaults (
      id INTEGER PRIMARY KEY DEFAULT 1,
      submit_timeout INTEGER DEFAULT ${CFG.DEFAULT_TIMERS.SUBMIT},
      answer_timeout INTEGER DEFAULT ${CFG.DEFAULT_TIMERS.ANSWER},
      banter_timeout INTEGER DEFAULT ${CFG.DEFAULT_TIMERS.BANTER},
      updated_at TIMESTAMP DEFAULT NOW(),
      CHECK (id = 1)
    )`,
    `INSERT INTO tod_global_defaults(id) VALUES (1) ON CONFLICT(id) DO NOTHING`,
    `CREATE TABLE IF NOT EXISTS tod_sessions (
      chat_id BIGINT PRIMARY KEY,
      owner_id BIGINT NOT NULL,
      status TEXT NOT NULL,
      snapshot JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
  ];
  for (const q of queries) {
    await pg.query(q).catch(e => logger.error('[ToD Migration] ' + e.message));
  }
  logger.info('✅ [ToD] Schema ready');
}

// ── الإعدادات الافتراضية العامة (يتحكم بها الأونر من لوحة الألعاب) ──
async function getGlobalDefaults() {
  const row = await get('SELECT * FROM tod_global_defaults WHERE id=1').catch(() => null);
  return row || {
    submit_timeout: CFG.DEFAULT_TIMERS.SUBMIT,
    answer_timeout: CFG.DEFAULT_TIMERS.ANSWER,
    banter_timeout: CFG.DEFAULT_TIMERS.BANTER,
  };
}

async function updateGlobalDefault(field, value) {
  const allowed = ['submit_timeout', 'answer_timeout', 'banter_timeout'];
  if (!allowed.includes(field)) return false;
  await run(
    `INSERT INTO tod_global_defaults(id, ${field}) VALUES(1, $1)
     ON CONFLICT(id) DO UPDATE SET ${field}=$1, updated_at=NOW()`,
    [value]
  ).catch(() => {});
  return true;
}

// ── إعدادات القروب ─────────────────────────────────────────
async function getSettings(chatId) {
  const defaults = await getGlobalDefaults();
  await run(
    `INSERT INTO tod_settings(chat_id, submit_timeout, answer_timeout, banter_timeout)
     VALUES($1, $2, $3, $4) ON CONFLICT(chat_id) DO NOTHING`,
    [chatId, defaults.submit_timeout, defaults.answer_timeout, defaults.banter_timeout]
  ).catch(() => {});
  const row = await get('SELECT * FROM tod_settings WHERE chat_id=$1', [chatId]).catch(() => null);
  if (!row) {
    return {
      reg_timeout: CFG.DEFAULT_TIMERS.REGISTRATION, choice_timeout: CFG.DEFAULT_TIMERS.CHOICE,
      submit_timeout: defaults.submit_timeout, answer_timeout: defaults.answer_timeout,
      banter_timeout: defaults.banter_timeout, min_players: CFG.MIN_PLAYERS,
      delete_offtopic: true, fairness_enabled: true,
    };
  }
  return row;
}

async function updateSetting(chatId, field, value) {
  const allowed = ['reg_timeout','choice_timeout','submit_timeout','answer_timeout','banter_timeout','min_players','delete_offtopic','fairness_enabled'];
  if (!allowed.includes(field)) return false;
  await getSettings(chatId); // تأكيد وجود الصف
  await run(`UPDATE tod_settings SET ${field}=$2, updated_at=NOW() WHERE chat_id=$1`, [chatId, value]).catch(() => {});
  return true;
}

// ── الإحصائيات الدائمة ──────────────────────────────────────
async function ensureStatsRow(userId, firstName, username) {
  await run(
    `INSERT INTO tod_stats(user_id, first_name, username) VALUES($1,$2,$3)
     ON CONFLICT(user_id) DO UPDATE SET first_name=$2, username=$3`,
    [userId, firstName || '', username || '']
  ).catch(() => {});
}

async function getStatsForUser(userId) {
  await ensureStatsRow(userId, '', '');
  return await get('SELECT * FROM tod_stats WHERE user_id=$1', [userId]);
}

// p = {userId, firstName, username, asked, answered, dareDone, truthDone, timedOut}
async function applyRoundStats(p) {
  await ensureStatsRow(p.userId, p.firstName, p.username);
  const row = await get(
    `UPDATE tod_stats SET
       asked_count = asked_count + $2,
       answered_count = answered_count + $3,
       dare_completed = dare_completed + $4,
       truth_completed = truth_completed + $5,
       timeouts = timeouts + $6,
       updated_at = NOW()
     WHERE user_id=$1 RETURNING *`,
    [p.userId, p.asked ? 1 : 0, p.answered ? 1 : 0, p.dareDone ? 1 : 0, p.truthDone ? 1 : 0, p.timedOut ? 1 : 0]
  ).catch(() => null);
  return row;
}

async function markGamePlayed(userIds) {
  for (const uid of userIds) {
    await run('UPDATE tod_stats SET games_played = games_played + 1 WHERE user_id=$1', [uid]).catch(() => {});
  }
}

async function getEarnedKeys(userId) {
  const rows = await all('SELECT achievement_key FROM tod_achievements WHERE user_id=$1', [userId]).catch(() => []);
  return new Set(rows.map(r => r.achievement_key));
}

async function checkNewAchievements(userId, statsRow) {
  if (!statsRow) return [];
  const earned = await getEarnedKeys(userId);
  const fresh = [];
  for (const a of CFG.ACHIEVEMENTS) {
    if (earned.has(a.key)) continue;
    try { if (a.check(statsRow)) fresh.push(a); } catch (_) {}
  }
  for (const a of fresh) {
    await run('INSERT INTO tod_achievements(user_id, achievement_key) VALUES($1,$2) ON CONFLICT DO NOTHING', [userId, a.key]).catch(() => {});
  }
  return fresh;
}

// ── حفظ/استعادة الجلسة (دعم إعادة التشغيل) ──────────────────
function serializeSession(session) {
  return {
    chatId: session.chatId, chatTitle: session.chatTitle, ownerId: session.ownerId,
    status: session.status,
    players: [...session.players.values()],
    playerOrder: session.playerOrder,
    round: session.round,
  };
}

async function saveSessionSnapshot(session) {
  const snap = serializeSession(session);
  await run(
    `INSERT INTO tod_sessions(chat_id, owner_id, status, snapshot, updated_at) VALUES($1,$2,$3,$4,NOW())
     ON CONFLICT(chat_id) DO UPDATE SET owner_id=$2, status=$3, snapshot=$4, updated_at=NOW()`,
    [session.chatId, session.ownerId, session.status, JSON.stringify(snap)]
  ).catch(e => logger.error('[ToD] saveSnapshot: ' + e.message));
}

async function deleteSessionSnapshot(chatId) {
  await run('DELETE FROM tod_sessions WHERE chat_id=$1', [chatId]).catch(() => {});
}

async function loadAllSnapshots() {
  const rows = await all('SELECT * FROM tod_sessions').catch(() => []);
  return rows;
}

module.exports = {
  migrate, getSettings, updateSetting, getGlobalDefaults, updateGlobalDefault,
  getStatsForUser, applyRoundStats, markGamePlayed, checkNewAchievements,
  saveSessionSnapshot, deleteSessionSnapshot, loadAllSnapshots,
};
