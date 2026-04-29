'use strict';
const { run, get, all } = require('./db');
const { cacheGet, cacheSet, cacheClear } = require('../utils/cache');

const POINTS = { download: 5, rating: 3, comment: 2, favorite: 1, daily_login: 1 };

async function ensureUser(uid) {
  await run(
    'INSERT INTO user_points(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING', [uid]
  ).catch(() => {});
}

async function awardPoints(uid, type) {
  const pts = POINTS[type];
  if (!pts || !uid) return;
  await ensureUser(uid);
  const colMap = { download: 'downloads_count', rating: 'ratings_count', comment: 'comments_count' };
  const col = colMap[type];
  const extra = col ? `, ${col} = ${col} + 1` : '';
  await run(
    `UPDATE user_points SET total_points = total_points + $1${extra}, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
    [pts, uid]
  ).catch(() => {});
  cacheClear('pts_' + uid);
  cacheClear('leaderboard_v1');
}

async function getPoints(uid) {
  const k = 'pts_' + uid;
  const cv = cacheGet(k);
  if (cv !== null) return cv;
  await ensureUser(uid);
  const r = await get('SELECT * FROM user_points WHERE user_id=$1', [uid]);
  const result = r || { total_points: 0, downloads_count: 0, ratings_count: 0, comments_count: 0, streak_days: 0 };
  cacheSet(k, result, 300000);
  return result;
}

async function getLeaderboard(limit = 10) {
  const k = 'leaderboard_v1';
  const cv = cacheGet(k);
  if (cv) return cv;
  const rows = await all(
    `SELECT up.user_id, up.total_points, up.downloads_count, up.ratings_count,
            u.first_name, u.username
     FROM user_points up
     JOIN users u ON u.id = up.user_id
     WHERE up.total_points > 0
     ORDER BY up.total_points DESC
     LIMIT $1`,
    [limit]
  );
  cacheSet(k, rows, 300000);
  return rows;
}

async function getUserRank(uid) {
  const myPts = await get('SELECT COALESCE(total_points,0) as p FROM user_points WHERE user_id=$1', [uid]);
  const pts = myPts ? parseInt(myPts.p) : 0;
  const r = await get('SELECT COUNT(*)+1 as rank FROM user_points WHERE total_points > $1', [pts]);
  return r ? parseInt(r.rank) : 999;
}

async function checkDailyLogin(uid) {
  if (!uid) return false;
  const today = new Date().toISOString().slice(0, 10);
  await ensureUser(uid);
  const r = await get('SELECT last_activity_date FROM user_points WHERE user_id=$1', [uid]).catch(() => null);
  if (!r || String(r.last_activity_date || '').slice(0, 10) !== today) {
    await run(
      `UPDATE user_points SET last_activity_date = CURRENT_DATE,
       total_points = total_points + 1, streak_days = streak_days + 1,
       updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
      [uid]
    ).catch(() => {});
    cacheClear('pts_' + uid);
    return true;
  }
  return false;
}

module.exports = { awardPoints, getPoints, getLeaderboard, getUserRank, checkDailyLogin, POINTS };
