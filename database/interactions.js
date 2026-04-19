'use strict';
var safeInt = function(v) { var n = parseInt(v); return isNaN(n) ? 0 : n; };
const { all, get, run } = require('./db');
const { cacheGet, cacheSet, cacheClear } = require('../utils/cache');
const J = 'SELECT f.*,c.name as cat_name,s.name as sub_name FROM files f JOIN categories c ON f.category_id=c.id JOIN subjects s ON c.subject_id=s.id';

const getFavs = function(uid) { return all(J + ' JOIN favorites fv ON fv.file_id=f.id WHERE fv.user_id=$1 AND f.is_deleted=0 ORDER BY fv.file_id DESC', [uid]); };

const isFav = async function(uid, fid) {
  fid = safeInt(fid);
  var k = 'fav_' + uid + '_' + fid; var cv = cacheGet(k); if (cv !== null) return cv;
  var r = !!(await get('SELECT 1 FROM favorites WHERE user_id=$1 AND file_id=$2', [uid, fid]));
  cacheSet(k, r, 1800000); return r;
};

const addFav = function(uid, fid) {
  fid = safeInt(fid);
  cacheClear('fav_' + uid + '_' + fid); cacheClear('favcnt_' + fid);
  return run('INSERT INTO favorites(user_id,file_id) VALUES($1,$2) ON CONFLICT(user_id,file_id) DO NOTHING', [uid, fid]);
};

const removeFav = function(uid, fid) {
  fid = safeInt(fid);
  cacheClear('fav_' + uid + '_' + fid); cacheClear('favcnt_' + fid);
  return run('DELETE FROM favorites WHERE user_id=$1 AND file_id=$2', [uid, fid]);
};

const favCount = async function(fid) {
  fid = safeInt(fid);
  var k = 'favcnt_' + fid; var cv = cacheGet(k); if (cv !== null) return cv;
  var r = await get('SELECT COUNT(*) as c FROM favorites WHERE file_id=$1', [fid]); var cnt = r ? r.c : 0;
  cacheSet(k, cnt, 3600000); return cnt;
};

// Idempotent: منع تكرار التحميل خلال 5 ثواني
var _histDedup = new Map();
const addHistory = function(uid, fid) {
  fid = safeInt(fid);
  var k = uid + '_' + fid; var now = Date.now(); var last = _histDedup.get(k) || 0;
  if (now - last < 5000) return Promise.resolve();
  _histDedup.set(k, now);
  if (_histDedup.size > 5000) { var old = now - 5000; for (var kk in _histDedup) { if (_histDedup[kk] < old) delete _histDedup[kk]; } }
  return run('INSERT INTO history(user_id,file_id) VALUES($1,$2)', [uid, fid]);
};

const getHistory = function(uid, n) { n = n || 15; return all(J + ' JOIN history h ON h.file_id=f.id WHERE h.user_id=$1 AND f.is_deleted=0 ORDER BY h.viewed_at DESC LIMIT $2', [uid, n]); };

const getLastFile = async function(uid) {
  var k = 'lastfile_' + uid; var cv = cacheGet(k); if (cv !== undefined) return cv || null;
  var r = (await all(J + ' JOIN history h ON h.file_id=f.id WHERE h.user_id=$1 AND f.is_deleted=0 ORDER BY h.viewed_at DESC LIMIT 1', [uid]))[0] || null;
  cacheSet(k, r, 600000); return r;
};
const invalidateLastFile = function(uid) { cacheClear('lastfile_' + uid); };

// Idempotent: منع تكرار التحميل خلال 10 ثواني
var _dlDedup = new Map();
const getUserDownloadCount = async function(uid) {
  uid = safeInt(uid);
  var k = 'dlcnt_' + uid; var cv = cacheGet(k); if (cv !== null) return cv;
  var r = await get('SELECT COUNT(DISTINCT file_id) as c FROM history WHERE user_id=$1', [uid]); var cnt = r ? r.c : 0;
  cacheSet(k, cnt, 300000); return cnt;
};

async function getRecommended(uid, limit) {
  limit = limit || 8;
  var k = 'rec_' + uid; var cv = cacheGet(k); if (cv) return cv;
  var cats = (await all('SELECT c.id FROM history h JOIN files f ON h.file_id=f.id JOIN categories c ON f.category_id=c.id WHERE h.user_id=$1 GROUP BY c.id ORDER BY MAX(h.viewed_at) DESC LIMIT 5', [uid])).map(function(r) { return r.id; });
  var result;
  if (!cats.length) { result = await all(J + ' WHERE f.is_deleted=0 ORDER BY f.downloads DESC LIMIT $1', [limit]); }
  else { var ph = cats.map(function(_, i) { return '$' + (i + 1); }).join(','); result = await all(J + ' WHERE f.category_id IN (' + ph + ') AND f.is_deleted=0 AND f.id NOT IN (SELECT file_id FROM history WHERE user_id=$' + (cats.length + 1) + ') ORDER BY f.downloads DESC LIMIT $' + (cats.length + 2), cats.concat([uid, limit])); }
  cacheSet(k, result, 300000); return result;
}

async function getSimilar(fileId, limit) {
  fileId = safeInt(fileId); limit = limit || 4;
  var k = 'similar_' + fileId; var cv = cacheGet(k); if (cv) return cv;
  var f = await get('SELECT f.id,f.category_id,c.subject_id FROM files f JOIN categories c ON f.category_id=c.id WHERE f.id=$1', [fileId]);
  if (!f) return [];
  var results = await all(J + ' WHERE f.id!=$1 AND f.is_deleted=0 AND f.category_id=$2 ORDER BY f.downloads DESC LIMIT $3', [fileId, f.category_id, limit]);
  if (results.length >= limit) { cacheSet(k, results, 7200000); return results; }
  var ids = [parseInt(fileId)].concat(results.map(function(r) { return r.id; }));
  var ph = ids.map(function(_, i) { return '$' + (i + 1); }).join(',');
  var more = await all(J + ' JOIN categories c2 ON f.category_id=c2.id WHERE c2.subject_id=$' + (ids.length + 1) + ' AND f.id NOT IN (' + ph + ') AND f.is_deleted=0 ORDER BY f.downloads DESC LIMIT $' + (ids.length + 2), ids.concat([f.subject_id, limit - results.length]));
  var final = results.concat(more).slice(0, limit); cacheSet(k, final, 7200000); return final;
}

const addLog = function(uid, action, details) { run('INSERT INTO logs(user_id,action,details) VALUES($1,$2,$3)', [uid, action, details || '']).catch(function(){}); };
const getLogs = function(n) { n = n || 20; return all('SELECT l.*,u.first_name FROM logs l LEFT JOIN users u ON l.user_id=u.id ORDER BY l.created_at DESC LIMIT $1', [n]); };

const getActiveUsers = async function(days) {
  days = days || 7;
  var k = 'active_users_' + days; var cv = cacheGet(k); if (cv) return cv;
  var rows = await all("SELECT id FROM users WHERE is_banned=0 AND last_active::timestamp >= NOW() - ($1::integer * INTERVAL '1 day')", [days]);
  cacheSet(k, rows.map(function(r) { return r.id; }), 600000); return rows;
};

const addRating = function(uid, fid, rating) {
  fid = safeInt(fid);
  cacheClear('urating_' + uid + '_' + fid); cacheClear('avg_' + fid); cacheClear('prev_static_' + fid);
  return run('INSERT INTO ratings(user_id,file_id,rating) VALUES($1,$2,$3) ON CONFLICT(user_id,file_id) DO UPDATE SET rating=EXCLUDED.rating', [uid, fid, rating]);
};

const getUserRating = async function(uid, fid) {
  fid = safeInt(fid);
  var k = 'urating_' + uid + '_' + fid; var cv = cacheGet(k); if (cv !== null) return cv;
  var r = await get('SELECT rating FROM ratings WHERE user_id=$1 AND file_id=$2', [uid, fid]); var rt = r ? r.rating : 0;
  cacheSet(k, rt, 1800000); return rt;
};

const getAvgRating = async function(fid) {
  fid = safeInt(fid);
  var k = 'avg_' + fid; var cv = cacheGet(k); if (cv) return cv;
  var r = await get('SELECT ROUND(AVG(rating),1) as avg, COUNT(*) as cnt FROM ratings WHERE file_id=$1', [fid]);
  var result = { avg: parseFloat(r ? r.avg : 0), cnt: parseInt(r ? r.cnt : 0) };
  cacheSet(k, result, 3600000); return result;
};

const getFavBatch = async function(uid, fileIds) {
  if (!fileIds.length) return {};
  var k = 'favbatch_' + uid + '_' + fileIds.join('_'); var cv = cacheGet(k); if (cv) return cv;
  var ph = fileIds.map(function(_, i) { return '$' + (i + 2); }).join(',');
  var rows = await all('SELECT file_id FROM favorites WHERE user_id=$1 AND file_id IN (' + ph + ')', [uid].concat(fileIds));
  var set = new Set(rows.map(function(r) { return String(r.file_id); }));
  var result = {}; for (var i = 0; i < fileIds.length; i++) result[fileIds[i]] = set.has(String(fileIds[i]));
  cacheSet(k, result, 600000); return result;
};

const getRatingBatch = async function(fileIds) {
  if (!fileIds.length) return {};
  var k = 'ratingbatch_' + fileIds.join('_'); var cv = cacheGet(k); if (cv) return cv;
  var ph = fileIds.map(function(_, i) { return '$' + (i + 1); }).join(',');
  var rows = await all('SELECT file_id, ROUND(AVG(rating),1) as avg FROM ratings WHERE file_id IN (' + ph + ') GROUP BY file_id', fileIds);
  var result = {}; for (var i = 0; i < rows.length; i++) result[rows[i].file_id] = parseFloat(rows[i].avg || 0);
  cacheSet(k, result, 1800000); return result;
};

const getPreviewPersonal = async function(uid, fid) {
  fid = safeInt(fid);
  var fk = 'fav_' + uid + '_' + fid, rk = 'urating_' + uid + '_' + fid, pk = 'report_' + uid + '_' + fid;
  var cf = cacheGet(fk), cr = cacheGet(rk), cp = cacheGet(pk);
  if (cf !== null && cr !== null && cp !== null) return { fav: cf, userRating: cr, alreadyReported: cp };
  var results = await Promise.all([
    cf === null ? get('SELECT 1 FROM favorites WHERE user_id=$1 AND file_id=$2', [uid, fid]) : Promise.resolve(cf ? { 1: 1 } : null),
    cr === null ? get('SELECT rating FROM ratings WHERE user_id=$1 AND file_id=$2', [uid, fid]) : Promise.resolve({ rating: cr }),
    cp === null ? get("SELECT 1 FROM reports WHERE user_id=$1 AND file_id=$2 AND status!='dismissed'", [uid, fid]) : Promise.resolve(cp ? { 1: 1 } : null),
  ]);
  var fav = !!results[0], userRating = results[1] ? results[1].rating : 0, alreadyReported = !!results[2];
  cacheSet(fk, fav, 1800000); cacheSet(rk, userRating, 1800000); cacheSet(pk, alreadyReported, 1800000);
  return { fav: fav, userRating: userRating, alreadyReported: alreadyReported };
};

module.exports = { getFavs, isFav, addFav, removeFav, favCount, addHistory, invalidateLastFile, getHistory, getLastFile, getUserDownloadCount, getRecommended, getSimilar, addLog, getLogs, getActiveUsers, addRating, getUserRating, getAvgRating, getFavBatch, getRatingBatch, getPreviewPersonal };
