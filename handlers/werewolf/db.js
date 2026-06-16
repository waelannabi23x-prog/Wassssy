'use strict';
// ══════════════════════════════════════════════════════════════
//  🐺 Loup-Garou — قاعدة البيانات: إحصائيات / إنجازات / رتب / مواسم
// ══════════════════════════════════════════════════════════════

const { get, all, run, getPg } = require('../../database/db');
const logger = require('../../utils/logger');
const CFG = require('./config');

// ── Schema ──────────────────────────────────────────────────
async function migrate() {
  const pg = getPg();
  if (!pg) return;
  const queries = [
    `CREATE TABLE IF NOT EXISTS ww_stats (
      user_id BIGINT PRIMARY KEY,
      first_name TEXT DEFAULT '',
      username TEXT DEFAULT '',
      games_played INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      wolf_wins INTEGER DEFAULT 0,
      village_wins INTEGER DEFAULT 0,
      sk_wins INTEGER DEFAULT 0,
      vampire_wins INTEGER DEFAULT 0,
      jester_wins INTEGER DEFAULT 0,
      role_counts JSONB DEFAULT '{}'::jsonb,
      seer_investigations INTEGER DEFAULT 0,
      seer_correct INTEGER DEFAULT 0,
      witch_saves INTEGER DEFAULT 0,
      guardian_saves INTEGER DEFAULT 0,
      correct_executions INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ww_season_stats (
      season TEXT NOT NULL,
      user_id BIGINT NOT NULL,
      first_name TEXT DEFAULT '',
      username TEXT DEFAULT '',
      games_played INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      wolf_wins INTEGER DEFAULT 0,
      village_wins INTEGER DEFAULT 0,
      seer_correct INTEGER DEFAULT 0,
      PRIMARY KEY(season, user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS ww_achievements (
      user_id BIGINT NOT NULL,
      achievement_key TEXT NOT NULL,
      earned_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY(user_id, achievement_key)
    )`,
    `CREATE TABLE IF NOT EXISTS ww_games (
      id SERIAL PRIMARY KEY,
      chat_id BIGINT NOT NULL,
      status TEXT DEFAULT 'running',
      player_count INTEGER DEFAULT 0,
      rounds INTEGER DEFAULT 0,
      winner_team TEXT,
      started_at TIMESTAMP DEFAULT NOW(),
      ended_at TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS ww_game_events (
      id SERIAL PRIMARY KEY,
      game_id INTEGER,
      round INTEGER DEFAULT 0,
      event TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ww_events_game ON ww_game_events(game_id, id)`,
    `CREATE INDEX IF NOT EXISTS idx_ww_season_wins ON ww_season_stats(season, wins DESC)`,
  ];
  for (const q of queries) {
    await pg.query(q).catch(e => logger.error('[Werewolf Migration] ' + e.message));
  }
  logger.info('✅ [Werewolf] Schema ready');
}

// ── أدوات مساعدة ────────────────────────────────────────────
function getSeasonKey(d = new Date()) {
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
}

function seasonLabel(seasonKey) {
  const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const [y, m] = seasonKey.split('-');
  return 'موسم ' + (months[parseInt(m, 10) - 1] || m) + ' ' + y;
}

function getRank(wins) {
  for (const r of CFG.RANKS) if (wins >= r.minWins) return r;
  return CFG.RANKS[CFG.RANKS.length - 1];
}

// ── ضمان وجود صفّ إحصائيات ──────────────────────────────────
async function ensureStatsRow(userId, firstName, username) {
  await run(
    `INSERT INTO ww_stats(user_id, first_name, username) VALUES($1,$2,$3)
     ON CONFLICT(user_id) DO UPDATE SET first_name=$2, username=$3`,
    [userId, firstName || '', username || '']
  ).catch(e => logger.error('[Werewolf] ensureStatsRow: ' + e.message));
}

async function ensureSeasonRow(season, userId, firstName, username) {
  await run(
    `INSERT INTO ww_season_stats(season, user_id, first_name, username) VALUES($1,$2,$3,$4)
     ON CONFLICT(season, user_id) DO UPDATE SET first_name=$3, username=$4`,
    [season, userId, firstName || '', username || '']
  ).catch(e => logger.error('[Werewolf] ensureSeasonRow: ' + e.message));
}

async function getStatsForUser(userId) {
  await ensureStatsRow(userId, '', '');
  const row = await get('SELECT * FROM ww_stats WHERE user_id=$1', [userId]);
  return row;
}

// ── سجلّ مباراة ─────────────────────────────────────────────
async function recordGameStart(chatId, playerCount) {
  const row = await get(
    `INSERT INTO ww_games(chat_id, player_count) VALUES($1,$2) RETURNING id`,
    [chatId, playerCount]
  ).catch(() => null);
  return row?.id || null;
}

async function recordGameEnd(gameRowId, winnerTeam, rounds) {
  if (!gameRowId) return;
  await run(
    `UPDATE ww_games SET status='ended', winner_team=$1, rounds=$2, ended_at=NOW() WHERE id=$3`,
    [winnerTeam, rounds, gameRowId]
  ).catch(() => {});
}

async function logEvent(gameRowId, round, text) {
  if (!gameRowId) return;
  await run(
    `INSERT INTO ww_game_events(game_id, round, event) VALUES($1,$2,$3)`,
    [gameRowId, round, text]
  ).catch(() => {});
}

// ── تحديث الإحصائيات بعد انتهاء اللعبة لكل لاعب ─────────────
// p = {
//   userId, firstName, username, role, team,
//   won, isWolfWin, isVillageWin, isSkWin, isVampireWin, isJesterWin,
//   seerInvestigations, seerCorrect, witchSaves, guardianSaves, correctExecutions
// }
async function applyPlayerResult(p) {
  const season = getSeasonKey();
  await Promise.all([
    ensureStatsRow(p.userId, p.firstName, p.username),
    ensureSeasonRow(season, p.userId, p.firstName, p.username),
  ]);

  const winInc        = p.won ? 1 : 0;
  const lossInc       = p.won ? 0 : 1;
  const wolfWinInc    = p.isWolfWin ? 1 : 0;
  const villageWinInc = p.isVillageWin ? 1 : 0;
  const skWinInc      = p.isSkWin ? 1 : 0;
  const vampWinInc    = p.isVampireWin ? 1 : 0;
  const jesterWinInc  = p.isJesterWin ? 1 : 0;

  const row = await get(
    `UPDATE ww_stats SET
       games_played = games_played + 1,
       wins = wins + $2,
       losses = losses + $3,
       wolf_wins = wolf_wins + $4,
       village_wins = village_wins + $5,
       sk_wins = sk_wins + $6,
       vampire_wins = vampire_wins + $7,
       jester_wins = jester_wins + $8,
       seer_investigations = seer_investigations + $9,
       seer_correct = seer_correct + $10,
       witch_saves = witch_saves + $11,
       guardian_saves = guardian_saves + $12,
       correct_executions = correct_executions + $13,
       role_counts = jsonb_set(
         COALESCE(role_counts,'{}'::jsonb),
         ARRAY[$14],
         (COALESCE((role_counts->>$14)::int,0) + 1)::text::jsonb
       ),
       updated_at = NOW()
     WHERE user_id=$1
     RETURNING *`,
    [
      p.userId, winInc, lossInc, wolfWinInc, villageWinInc, skWinInc, vampWinInc, jesterWinInc,
      p.seerInvestigations || 0, p.seerCorrect || 0, p.witchSaves || 0, p.guardianSaves || 0,
      p.correctExecutions || 0, p.role,
    ]
  ).catch(e => { logger.error('[Werewolf] applyPlayerResult: ' + e.message); return null; });

  await run(
    `UPDATE ww_season_stats SET
       games_played = games_played + 1,
       wins = wins + $2,
       wolf_wins = wolf_wins + $3,
       village_wins = village_wins + $4,
       seer_correct = seer_correct + $5
     WHERE season=$6 AND user_id=$1`,
    [p.userId, winInc, wolfWinInc, villageWinInc, p.seerCorrect || 0, season]
  ).catch(() => {});

  return row;
}

// ── الإنجازات ───────────────────────────────────────────────
async function getEarnedKeys(userId) {
  const rows = await all('SELECT achievement_key FROM ww_achievements WHERE user_id=$1', [userId]).catch(() => []);
  return new Set(rows.map(r => r.achievement_key));
}

// statsRow: صفّ ww_stats بعد التحديث — يعيد قائمة الإنجازات الجديدة فقط
async function checkNewAchievements(userId, statsRow) {
  if (!statsRow) return [];
  const earned = await getEarnedKeys(userId);
  const fresh = [];
  for (const a of CFG.ACHIEVEMENTS) {
    if (earned.has(a.key)) continue;
    try {
      if (a.check(statsRow)) fresh.push(a);
    } catch (_) {}
  }
  if (fresh.length) {
    for (const a of fresh) {
      await run(
        `INSERT INTO ww_achievements(user_id, achievement_key) VALUES($1,$2) ON CONFLICT DO NOTHING`,
        [userId, a.key]
      ).catch(() => {});
    }
  }
  return fresh;
}

async function getUserAchievements(userId) {
  const rows = await all(
    'SELECT achievement_key, earned_at FROM ww_achievements WHERE user_id=$1 ORDER BY earned_at ASC',
    [userId]
  ).catch(() => []);
  return rows.map(r => ({ ...CFG.ACHIEVEMENTS.find(a => a.key === r.achievement_key), earned_at: r.earned_at }))
    .filter(a => a && a.key);
}

// ── لوحة الموسم ─────────────────────────────────────────────
async function getSeasonLeaderboard(season) {
  const [bestPlayer, bestWolf, bestSeer, bestRate] = await Promise.all([
    get(`SELECT first_name, username, wins FROM ww_season_stats WHERE season=$1 AND wins>0 ORDER BY wins DESC LIMIT 1`, [season]),
    get(`SELECT first_name, username, wolf_wins FROM ww_season_stats WHERE season=$1 AND wolf_wins>0 ORDER BY wolf_wins DESC LIMIT 1`, [season]),
    get(`SELECT first_name, username, seer_correct FROM ww_season_stats WHERE season=$1 AND seer_correct>0 ORDER BY seer_correct DESC LIMIT 1`, [season]),
    get(`SELECT first_name, username, wins, games_played, (wins::float/games_played) AS rate FROM ww_season_stats WHERE season=$1 AND games_played>=3 ORDER BY rate DESC LIMIT 1`, [season]),
  ]).catch(() => [null, null, null, null]);
  return { bestPlayer, bestWolf, bestSeer, bestRate };
}

// ── الاقتصاد (يربط بالبنك Pro) ──────────────────────────────
async function awardCoins(userId, firstName, username, amount, note) {
  if (!amount || amount <= 0) return false;
  try {
    const bankPro = require('../bank_pro');
    return await bankPro.addWinnings(userId, firstName || '', username || '', amount, note || '🐺 لعبة الذئب');
  } catch (e) {
    logger.error('[Werewolf] awardCoins: ' + e.message);
    return false;
  }
}

module.exports = {
  migrate, getSeasonKey, seasonLabel, getRank,
  getStatsForUser, applyPlayerResult,
  recordGameStart, recordGameEnd, logEvent,
  checkNewAchievements, getUserAchievements,
  getSeasonLeaderboard, awardCoins,
};
