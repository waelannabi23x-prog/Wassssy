'use strict';
const { all, get, run } = require('./db');
const { cacheGet, cacheSet, cacheClear } = require('../utils/cache');

const safeInt = v => { const n = parseInt(v); return isNaN(n) ? 0 : n; };
const J = 'SELECT f.*,c.name as cat_name,s.name as sub_name FROM files f JOIN categories c ON f.category_id=c.id JOIN subjects s ON c.subject_id=s.id';

// ─── Favorites ───────────────────────────────────────────────────────────────
const getFavs = uid => all(J + ' JOIN favorites fv ON fv.file_id=f.id WHERE fv.user_id=$1 AND f.is_deleted=0 ORDER BY fv.file_id DESC', [uid]);

const isFav = async (uid, fid) => {
  fid = safeInt(fid);
  const k = 'fav_' + uid + '_' + fid, cv = cacheGet(k);
  if (cv !== null) return cv;
  const r = !!(await get('SELECT 1 FROM favorites WHERE user_id=$1 AND file_id=$2', [uid, fid]));
  cacheSet(k, r, 1800000); return r;
};

const addFav = (uid, fid) => {
  fid = safeInt(fid);
  cacheClear('fav_' + uid + '_' + fid); cacheClear('favcnt_' + fid);
  return run('INSERT INTO favorites(user_id,file_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [uid, fid]);
};

const removeFav = (uid, fid) => {
  fid = safeInt(fid);
  cacheClear('fav_' + uid + '_' + fid); cacheClear('favcnt_' + fid);
  return run('DELETE FROM favorites WHERE user_id=$1 AND file_id=$2', [uid, fid]);
};

const favCount = async fid => {
  fid = safeInt(fid);
  const k = 'favcnt_' + fid, cv = cacheGet(k);
  if (cv !== null) return cv;
  const r = await get('SELECT COUNT(*) as c FROM favorites WHERE file_id=$1', [fid]);
  const cnt = r ? parseInt(r.c) : 0;
  cacheSet(k, cnt, 3600000); return cnt;
};

// ─── History ─────────────────────────────────────────────────────────────────
// FIXED: was using for..in on Map (broken) → now uses Map.forEach correctly
const _histDedup = new Map();
const addHistory = (uid, fid) => {
  fid = safeInt(fid);
  const k = uid + '_' + fid, now = Date.now(), last = _histDedup.get(k) || 0;
  if (now - last < 5000) return Promise.resolve();
  _histDedup.set(k, now);
  // Cleanup: remove entries older than 10s
  if (_histDedup.size > 5000) {
    const cut = now - 10000;
    for (const [kk, ts] of _histDedup) if (ts < cut) _histDedup.delete(kk);
  }
  const _p = run('INSERT INTO history(user_id,file_id,viewed_at) VALUES($1,$2,NOW()) ON CONFLICT(user_id,file_id) DO UPDATE SET viewed_at=NOW()', [uid, fid]);
  try { const {awardPoints}=require('./points'); awardPoints(uid,'download').catch(err => { require('../utils/logger').debug("[silent]", err.message); }); } catch(_){}
  return _p;
};

const getHistory = (uid, n = 15) => all(J + ' JOIN history h ON h.file_id=f.id WHERE h.user_id=$1 AND f.is_deleted=0 ORDER BY h.viewed_at DESC LIMIT $2', [uid, n]);

const getLastFile = async uid => {
  const k = 'lastfile_' + uid, cv = cacheGet(k);
  if (cv !== null) return cv;
  const r = (await all(J + ' JOIN history h ON h.file_id=f.id WHERE h.user_id=$1 AND f.is_deleted=0 ORDER BY h.viewed_at DESC LIMIT 1', [uid]))[0] || null;
  cacheSet(k, r, 600000); return r;
};
const invalidateLastFile = uid => cacheClear('lastfile_' + uid);

const getUserDownloadCount = async uid => {
  uid = safeInt(uid);
  const k = 'dlcnt_' + uid, cv = cacheGet(k);
  if (cv !== null) return cv;
  const r = await get('SELECT COUNT(DISTINCT file_id) as c FROM history WHERE user_id=$1', [uid]);
  const cnt = r ? parseInt(r.c) : 0;
  cacheSet(k, cnt, 300000); return cnt;
};

// ─── Recommended — single optimised query ────────────────────────────────────
async function getRecommended(uid, limit = 8) {
  const k = 'rec_' + uid, cv = cacheGet(k);
  if (cv) return cv;

  // Get user's top categories and recommended files in ONE query
  const result = await all(`
    WITH user_cats AS (
      SELECT c.id
      FROM   history h
      JOIN   files f ON h.file_id = f.id
      JOIN   categories c ON f.category_id = c.id
      WHERE  h.user_id = $1
      GROUP  BY c.id
      ORDER  BY MAX(h.viewed_at) DESC
      LIMIT  5
    )
    SELECT DISTINCT f.*, c.name as cat_name, s.name as sub_name
    FROM   files f
    JOIN   categories c ON f.category_id = c.id
    JOIN   subjects s   ON c.subject_id  = s.id
    JOIN   user_cats uc ON f.category_id = uc.id
    WHERE  f.is_deleted = 0
      AND  f.id NOT IN (SELECT file_id FROM history WHERE user_id = $1)
    ORDER  BY f.downloads DESC
    LIMIT  $2
  `, [uid, limit]).catch(() => []);

  const final = result.length
    ? result
    : await all(J + ' WHERE f.is_deleted=0 ORDER BY f.downloads DESC LIMIT $1', [limit]);

  cacheSet(k, final, 300000); return final;
}

// ─── Similar files ───────────────────────────────────────────────────────────
async function getSimilar(fileId, limit = 4) {
  fileId = safeInt(fileId);
  const k = 'similar_' + fileId, cv = cacheGet(k);
  if (cv) return cv;

  // Single query: same category first, then same subject, ranked by downloads
  const results = await all(`
    SELECT DISTINCT f.*, cc.name as cat_name, s.name as sub_name,
           CASE WHEN f.category_id = (SELECT category_id FROM files WHERE id=$1) THEN 0 ELSE 1 END as _rank
    FROM   categories c2
    JOIN   files f   ON f.category_id = c2.id
    JOIN   categories cc ON cc.id     = f.category_id
    JOIN   subjects s    ON s.id      = cc.subject_id
    WHERE  c2.subject_id = (SELECT c3.subject_id FROM files fi JOIN categories c3 ON fi.category_id=c3.id WHERE fi.id=$1)
      AND  f.id != $1
      AND  f.is_deleted = 0
    ORDER  BY _rank, f.downloads DESC
    LIMIT  $2
  `, [fileId, limit]).catch(() => []);

  // لا تخزن نتائج فارغة — يرجع للـ DB كل مرة
  if (results.length) cacheSet(k, results, 1800000);
  return results;
}

// ─── Logs ─────────────────────────────────────────────────────────────────────
const addLog = (uid, action, details) =>
  run('INSERT INTO logs(user_id,action,details) VALUES($1,$2,$3)', [uid, action, details || '']).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
const getLogs = (n = 20) =>
  all('SELECT l.*,u.first_name FROM logs l LEFT JOIN users u ON l.user_id=u.id ORDER BY l.created_at DESC LIMIT $1', [n]);

// ─── Active users ─────────────────────────────────────────────────────────────
const getActiveUsers = async (days = 7) => {
  const k = 'active_users_' + days, cv = cacheGet(k);
  if (cv) return cv;
  const rows = await all(
    "SELECT id FROM users WHERE is_banned=0 AND last_active >= NOW() - ($1 * INTERVAL '1 day')",
    [days]
  );
  const _ids = rows.map(r => r.id);
  cacheSet(k, _ids, 600000); return _ids;
};

// ─── Ratings ──────────────────────────────────────────────────────────────────
const addRating = (uid, fid, rating) => {
  fid = safeInt(fid);
  cacheClear('urating_' + uid + '_' + fid); cacheClear('avg_' + fid); cacheClear('prev_static_' + fid);
  return run('INSERT INTO ratings(user_id,file_id,rating) VALUES($1,$2,$3) ON CONFLICT(user_id,file_id) DO UPDATE SET rating=EXCLUDED.rating', [uid, fid, rating]);
};

const getUserRating = async (uid, fid) => {
  fid = safeInt(fid);
  const k = 'urating_' + uid + '_' + fid, cv = cacheGet(k);
  if (cv !== null) return cv;
  const r = await get('SELECT rating FROM ratings WHERE user_id=$1 AND file_id=$2', [uid, fid]);
  const rt = r ? r.rating : 0;
  cacheSet(k, rt, 1800000); return rt;
};

const getAvgRating = async fid => {
  fid = safeInt(fid);
  const k = 'avg_' + fid, cv = cacheGet(k);
  if (cv) return cv;
  const r = await get('SELECT ROUND(AVG(rating),1) as avg, COUNT(*) as cnt FROM ratings WHERE file_id=$1', [fid]);
  const result = { avg: parseFloat(r?.avg || 0), cnt: parseInt(r?.cnt || 0) };
  cacheSet(k, result, 3600000); return result;
};

// ─── Batch helpers (single query each) ───────────────────────────────────────
const getFavBatch = async (uid, fileIds) => {
  if (!fileIds.length) return {};
  const k = 'favbatch_' + uid + '_' + fileIds.slice().sort().join(''), cv = cacheGet(k);
  if (cv) return cv;
  const ph = fileIds.map((_, i) => '$' + (i + 2)).join(',');
  const rows = await all('SELECT file_id FROM favorites WHERE user_id=$1 AND file_id IN (' + ph + ')', [uid, ...fileIds]);
  const set = new Set(rows.map(r => String(r.file_id)));
  const result = Object.fromEntries(fileIds.map(id => [id, set.has(String(id))]));
  cacheSet(k, result, 600000); return result;
};

const getRatingBatch = async fileIds => {
  if (!fileIds.length) return {};
  const k = 'ratingbatch_' + fileIds.join('_'), cv = cacheGet(k);
  if (cv) return cv;
  const ph = fileIds.map((_, i) => '$' + (i + 1)).join(',');
  const rows = await all('SELECT file_id, ROUND(AVG(rating),1) as avg FROM ratings WHERE file_id IN (' + ph + ') GROUP BY file_id', fileIds);
  const result = Object.fromEntries(rows.map(r => [r.file_id, parseFloat(r.avg || 0)]));
  cacheSet(k, result, 1800000); return result;
};

// ─── Preview personal — 3 queries → 1 ────────────────────────────────────────
const getPreviewPersonal = async (uid, fid) => {
  fid = safeInt(fid);
  const fk = 'fav_' + uid + '_' + fid, rk = 'urating_' + uid + '_' + fid, pk = 'report_' + uid + '_' + fid;
  const cf = cacheGet(fk), cr = cacheGet(rk), cp = cacheGet(pk);
  if (cf !== null && cr !== null && cp !== null) return { fav: cf, userRating: cr, alreadyReported: cp };

  // Single combined query
  const row = await get(`
    SELECT
      EXISTS(SELECT 1 FROM favorites WHERE user_id=$1 AND file_id=$2)        AS fav,
      COALESCE((SELECT rating FROM ratings WHERE user_id=$1 AND file_id=$2), 0) AS rating,
      EXISTS(SELECT 1 FROM reports WHERE user_id=$1 AND file_id=$2 AND status!='dismissed') AS reported
  `, [uid, fid]);

  const fav = !!row?.fav, userRating = parseInt(row?.rating || 0), alreadyReported = !!row?.reported;
  cacheSet(fk, fav, 1800000); cacheSet(rk, userRating, 1800000); cacheSet(pk, alreadyReported, 1800000);
  return { fav, userRating, alreadyReported };
};

module.exports = {
  getFavs, isFav, addFav, removeFav, favCount,
  addHistory, invalidateLastFile, getHistory, getLastFile, getUserDownloadCount,
  getRecommended, getSimilar,
  addLog, getLogs, getActiveUsers,
  addRating, getUserRating, getAvgRating,
  getFavBatch, getRatingBatch, getPreviewPersonal,
};
