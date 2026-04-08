const { all, get, run } = require('./db');
const J = `SELECT f.*,c.name as cat_name,s.name as sub_name FROM files f JOIN categories c ON f.category_id=c.id JOIN subjects s ON c.subject_id=s.id`;
const getFavs = uid => all(J+' JOIN favorites fv ON fv.file_id=f.id WHERE fv.user_id=? AND f.is_deleted=0 ORDER BY fv.file_id DESC',[uid]);
const { cacheGet, cacheSet, cacheClear } = require('../utils/cache');
const isFav = async (uid,fid) => {
  const key='fav_'+uid+'_'+fid;
  const cached=cacheGet(key);
  if(cached!==null) return cached;
  const r=!!(await get('SELECT 1 FROM favorites WHERE user_id=? AND file_id=?',[uid,fid]));
  cacheSet(key,r,300000);
  return r;
};
const addFav = (uid,fid) => { cacheClear('fav_'+uid+'_'+fid); return run('INSERT INTO favorites(user_id,file_id) VALUES(?,?) ON CONFLICT(user_id,file_id) DO NOTHING',[uid,fid]); };
const removeFav = (uid,fid) => { cacheClear('fav_'+uid+'_'+fid); return run('DELETE FROM favorites WHERE user_id=? AND file_id=?',[uid,fid]); };
const favCount = async fid => {
  const key='favcnt_'+fid;
  const cached=cacheGet(key);
  if(cached!==null) return cached;
  const r=(await get('SELECT COUNT(*) as c FROM favorites WHERE file_id=?',[fid]))?.c || 0;
  cacheSet(key,r,300000);
  return r;
};
const addHistory = (uid,fid) => run('INSERT INTO history(user_id,file_id) VALUES(?,?)',[uid,fid]);
const getHistory = (uid,n=15) => all(J+' JOIN history h ON h.file_id=f.id WHERE h.user_id=? AND f.is_deleted=0 ORDER BY h.viewed_at DESC LIMIT ?',[uid,n]);
const getLastFile = async uid => (await all(J+' JOIN history h ON h.file_id=f.id WHERE h.user_id=? AND f.is_deleted=0 ORDER BY h.viewed_at DESC LIMIT 1',[uid]))[0];
const getUserDownloadCount = async uid => (await get('SELECT COUNT(*) as c FROM history WHERE user_id=?',[uid]))?.c || 0;
async function getRecommended(uid,limit=8){ const cats=(await all(`SELECT c.id FROM history h JOIN files f ON h.file_id=f.id JOIN categories c ON f.category_id=c.id WHERE h.user_id=? GROUP BY c.id ORDER BY MAX(h.viewed_at) DESC LIMIT 5`,[uid])).map(r=>r.id); if(!cats.length) return all(J+' WHERE f.is_deleted=0 ORDER BY f.downloads DESC LIMIT ?',[limit]); const ph=cats.map(()=>'?').join(','); return all(J+` WHERE f.category_id IN (${ph}) AND f.is_deleted=0 AND f.id NOT IN (SELECT file_id FROM history WHERE user_id=?) ORDER BY f.downloads DESC LIMIT ?`,[...cats,uid,limit]); }
async function getSimilar(fileId,limit=4){
  const f=await get('SELECT f.id,f.category_id,c.subject_id,s.semester_id FROM files f JOIN categories c ON f.category_id=c.id JOIN subjects s ON c.subject_id=s.id WHERE f.id=?',[fileId]);
  if(!f) return [];
  const results=await all(J+' WHERE f.id!=? AND f.is_deleted=0 AND f.category_id=? ORDER BY f.downloads DESC LIMIT ?',[fileId,f.category_id,limit]);
  if(results.length>=limit) return results;
  const ids=[parseInt(fileId),...results.map(r=>r.id)];
  const ph=ids.map(()=>'?').join(',');
  const more=await all(J+' JOIN categories c2 ON f.category_id=c2.id WHERE c2.subject_id=? AND f.id NOT IN ('+ph+') AND f.is_deleted=0 ORDER BY f.downloads DESC LIMIT ?',[f.subject_id,...ids,limit-results.length]);
  return [...results,...more].slice(0,limit);
}
const addLog = (uid,action,details) => run('INSERT INTO logs(user_id,action,details) VALUES(?,?,?)',[uid,action,details||'']);
const getLogs = (n=20) => all('SELECT l.*,u.first_name FROM logs l LEFT JOIN users u ON l.user_id=u.id ORDER BY l.created_at DESC LIMIT ?',[n]);
const clearOldLogs = () => run(`DELETE FROM logs WHERE created_at < NOW() - INTERVAL '30 days'`);
const getActiveUsers = async (days=7) => (await all(`SELECT id FROM users WHERE is_banned=0 AND last_active >= NOW() - ($1 || ' days')::INTERVAL`,[days])).map(r=>r.id);

const addRating = (uid,fid,rating) => {
  cacheClear('urating_'+uid+'_'+fid);
  cacheClear('avg_'+fid);
  return run('INSERT INTO ratings(user_id,file_id,rating) VALUES(?,?,?) ON CONFLICT(user_id,file_id) DO UPDATE SET rating=excluded.rating',[uid,fid,rating]);
};
const getUserRating = async (uid,fid) => {
  const key='urating_'+uid+'_'+fid;
  const cached=cacheGet(key);
  if(cached!==null) return cached;
  const r=(await get('SELECT rating FROM ratings WHERE user_id=? AND file_id=?',[uid,fid]))?.rating || 0;
  cacheSet(key,r,300000);
  return r;
};
const getAvgRating = async fid => {
  const key='avg_'+fid;
  const cached=cacheGet(key);
  if(cached) return cached;
  const r=await get('SELECT ROUND(AVG(rating),1) as avg, COUNT(*) as cnt FROM ratings WHERE file_id=?',[fid]);
  const result={avg:parseFloat(r?.avg||0), cnt:parseInt(r?.cnt||0)};
  cacheSet(key,result,600000);
  return result;
};

// Batch queries - أسرع بكثير
const getFavBatch = async (uid, fileIds) => {
  if(!fileIds.length) return {};
  const ph = fileIds.map(()=>'?').join(',');
  const rows = await all('SELECT file_id FROM favorites WHERE user_id=? AND file_id IN ('+ph+')', [uid,...fileIds]);
  const set = new Set(rows.map(r=>r.file_id));
  return Object.fromEntries(fileIds.map(id=>[id, set.has(id)]));
};

const getRatingBatch = async (fileIds) => {
  if(!fileIds.length) return {};
  const ph = fileIds.map(()=>'?').join(',');
  const rows = await all('SELECT file_id, ROUND(AVG(rating),1) as avg FROM ratings WHERE file_id IN ('+ph+') GROUP BY file_id', [...fileIds]);
  return Object.fromEntries(rows.map(r=>[r.file_id, parseFloat(r.avg||0)]));
};

module.exports = { getFavs,isFav,addFav,removeFav,favCount,addHistory,getHistory,getLastFile,getUserDownloadCount,getRecommended,getSimilar,addLog,getLogs,clearOldLogs,getActiveUsers,addRating,getUserRating,getAvgRating,getFavBatch,getRatingBatch };
