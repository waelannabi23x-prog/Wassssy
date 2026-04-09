const { all, get, run } = require('./db');
const { cacheGet, cacheSet, cacheClear } = require('../utils/cache');

const J = `SELECT f.*,c.name as cat_name,s.name as sub_name FROM files f JOIN categories c ON f.category_id=c.id JOIN subjects s ON c.subject_id=s.id`;

const getFavs = uid => all(J+' JOIN favorites fv ON fv.file_id=f.id WHERE fv.user_id=? AND f.is_deleted=0 ORDER BY fv.file_id DESC',[uid]);

const isFav = async (uid,fid) => {
  const key='fav_'+uid+'_'+fid;
  const cached=cacheGet(key);
  if(cached!==null) return cached;
  const r=!!(await get('SELECT 1 FROM favorites WHERE user_id=$1 AND file_id=$2',[uid,fid]));
  cacheSet(key,r,600000);
  return r;
};

// جلب كل البيانات الشخصية لـ preview في query واحدة
const getPreviewPersonal = async (uid,fid) => {
  const favKey='fav_'+uid+'_'+fid;
  const ratingKey='urating_'+uid+'_'+fid;
  const reportKey='report_'+uid+'_'+fid;
  const cachedFav=cacheGet(favKey);
  const cachedRating=cacheGet(ratingKey);
  const cachedReport=cacheGet(reportKey);
  if(cachedFav!==null && cachedRating!==null && cachedReport!==null)
    return { fav:cachedFav, userRating:cachedRating, alreadyReported:cachedReport };
  const [favRow,ratingRow,reportRow]=await Promise.all([
    cachedFav===null ? get('SELECT 1 FROM favorites WHERE user_id=$1 AND file_id=$2',[uid,fid]) : Promise.resolve(cachedFav?{1:1}:null),
    cachedRating===null ? get('SELECT rating FROM ratings WHERE user_id=$1 AND file_id=$2',[uid,fid]) : Promise.resolve({rating:cachedRating}),
    cachedReport===null ? get('SELECT 1 FROM reports WHERE user_id=$1 AND file_id=$2 AND status!=\'dismissed\'',[uid,fid]) : Promise.resolve(cachedReport?{1:1}:null),
  ]);
  const fav=!!favRow; const userRating=ratingRow?.rating||0; const alreadyReported=!!reportRow;
  cacheSet(favKey,fav,1800000); cacheSet(ratingKey,userRating,1800000); cacheSet(reportKey,alreadyReported,1800000);
  return { fav, userRating, alreadyReported };
};

const addFav = (uid,fid) => {
  cacheClear('fav_'+uid+'_'+fid);
  cacheClear('favcnt_'+fid);
  return run('INSERT INTO favorites(user_id,file_id) VALUES(?,?) ON CONFLICT(user_id,file_id) DO NOTHING',[uid,fid]);
};
const removeFav = (uid,fid) => {
  cacheClear('fav_'+uid+'_'+fid);
  cacheClear('favcnt_'+fid);
  return run('DELETE FROM favorites WHERE user_id=? AND file_id=?',[uid,fid]);
};

const favCount = async fid => {
  const key='favcnt_'+fid;
  const cached=cacheGet(key);
  if(cached!==null) return cached;
  const r=(await get('SELECT COUNT(*) as c FROM favorites WHERE file_id=?',[fid]))?.c||0;
  cacheSet(key,r,600000);
  return r;
};

// History مع deduplication - ما يكتب نفس الملف مرتين في 10 دقائق
const _historyRecent = new Map();
const addHistory = (uid,fid) => {
  const key=uid+'_'+fid;
  const now=Date.now();
  const last=_historyRecent.get(key)||0;
  if(now-last < 600000) return Promise.resolve();
  _historyRecent.set(key,now);
  if(_historyRecent.size>5000) {
    const old=now-600000;
    for(const [k,v] of _historyRecent) if(v<old) _historyRecent.delete(k);
  }
  return run('INSERT INTO history(user_id,file_id) VALUES(?,?)',[uid,fid]);
};

const getHistory = (uid,n=15) => all(J+' JOIN history h ON h.file_id=f.id WHERE h.user_id=? AND f.is_deleted=0 ORDER BY h.viewed_at DESC LIMIT ?',[uid,n]);

// cache getLastFile لكل مستخدم - 3 دقائق
const getLastFile = async uid => {
  const key='lastfile_'+uid;
  const cached=cacheGet(key);
  if(cached!==undefined) return cached||null;
  const r=(await all(J+' JOIN history h ON h.file_id=f.id WHERE h.user_id=? AND f.is_deleted=0 ORDER BY h.viewed_at DESC LIMIT 1',[uid]))[0]||null;
  cacheSet(key,r,600000);
  return r;
};

// invalidate lastfile cache عند التحميل
const invalidateLastFile = uid => cacheClear('lastfile_'+uid);

const getUserDownloadCount = async uid => {
  const key='dlcnt_'+uid;
  const cached=cacheGet(key);
  if(cached!==null) return cached;
  const r=(await get('SELECT COUNT(*) as c FROM history WHERE user_id=?',[uid]))?.c||0;
  cacheSet(key,r,300000);
  return r;
};

async function getRecommended(uid,limit=8) {
  const key='rec_'+uid;
  const cached=cacheGet(key);
  if(cached) return cached;
  const cats=(await all(
    `SELECT c.id FROM history h JOIN files f ON h.file_id=f.id JOIN categories c ON f.category_id=c.id WHERE h.user_id=? GROUP BY c.id ORDER BY MAX(h.viewed_at) DESC LIMIT 5`,
    [uid]
  )).map(r=>r.id);
  let result;
  if(!cats.length) {
    result=await all(J+' WHERE f.is_deleted=0 ORDER BY f.downloads DESC LIMIT ?',[limit]);
  } else {
    const ph=cats.map(()=>'?').join(',');
    result=await all(
      J+` WHERE f.category_id IN (${ph}) AND f.is_deleted=0 AND f.id NOT IN (SELECT file_id FROM history WHERE user_id=?) ORDER BY f.downloads DESC LIMIT ?`,
      [...cats,uid,limit]
    );
  }
  cacheSet(key,result,300000);
  return result;
}

async function getSimilar(fileId,limit=4) {
  const ckey='similar_'+fileId;
  const cc=cacheGet(ckey);
  if(cc) return cc;
  const f=await get('SELECT f.id,f.category_id,c.subject_id FROM files f JOIN categories c ON f.category_id=c.id WHERE f.id=?',[fileId]);
  if(!f) return [];
  const results=await all(J+' WHERE f.id!=? AND f.is_deleted=0 AND f.category_id=? ORDER BY f.downloads DESC LIMIT ?',[fileId,f.category_id,limit]);
  if(results.length>=limit) { cacheSet(ckey,results,7200000); return results; }
  const ids=[parseInt(fileId),...results.map(r=>r.id)];
  const ph=ids.map(()=>'?').join(',');
  const more=await all(
    J+' JOIN categories c2 ON f.category_id=c2.id WHERE c2.subject_id=? AND f.id NOT IN ('+ph+') AND f.is_deleted=0 ORDER BY f.downloads DESC LIMIT ?',
    [f.subject_id,...ids,limit-results.length]
  );
  const final=[...results,...more].slice(0,limit);
  cacheSet(ckey,final,7200000);
  return final;
}

// Logs - fire and forget بدون await
const addLog = (uid,action,details) => {
  run('INSERT INTO logs(user_id,action,details) VALUES(?,?,?)',[uid,action,details||'']).catch(()=>{});
};
const getLogs = (n=20) => all('SELECT l.*,u.first_name FROM logs l LEFT JOIN users u ON l.user_id=u.id ORDER BY l.created_at DESC LIMIT ?',[n]);

// cache getActiveUsers - 10 دقائق
const getActiveUsers = async (days=7) => {
  const key='active_users_'+days;
  const cached=cacheGet(key);
  if(cached) return cached;
  const rows=await all(`SELECT id FROM users WHERE is_banned=0 AND last_active >= NOW() - INTERVAL '${parseInt(days)} days'`);
  const ids=rows.map(r=>r.id);
  cacheSet(key,ids,600000);
  return ids;
};

const addRating = (uid,fid,rating) => {
  cacheClear('urating_'+uid+'_'+fid);
  cacheClear('avg_'+fid);
  cacheClear('prev_static_'+fid);
  return run('INSERT INTO ratings(user_id,file_id,rating) VALUES(?,?,?) ON CONFLICT(user_id,file_id) DO UPDATE SET rating=excluded.rating',[uid,fid,rating]);
};

const getUserRating = async (uid,fid) => {
  const key='urating_'+uid+'_'+fid;
  const cached=cacheGet(key);
  if(cached!==null) return cached;
  const r=(await get('SELECT rating FROM ratings WHERE user_id=$1 AND file_id=$2',[uid,fid]))?.rating||0;
  cacheSet(key,r,600000);
  return r;
};

const getAvgRating = async fid => {
  const key='avg_'+fid;
  const cached=cacheGet(key);
  if(cached) return cached;
  const r=await get('SELECT ROUND(AVG(rating),1) as avg, COUNT(*) as cnt FROM ratings WHERE file_id=?',[fid]);
  const result={avg:parseFloat(r?.avg||0),cnt:parseInt(r?.cnt||0)};
  cacheSet(key,result,600000);
  return result;
};

const getFavBatch = async (uid,fileIds) => {
  if(!fileIds.length) return {};
  const ph=fileIds.map(()=>'?').join(',');
  const rows=await all('SELECT file_id FROM favorites WHERE user_id=$1 AND file_id IN ('+ph+')',[uid,...fileIds]);
  const set=new Set(rows.map(r=>String(r.file_id)));
  return Object.fromEntries(fileIds.map(id=>[id,set.has(String(id))]));
};

const getRatingBatch = async fileIds => {
  if(!fileIds.length) return {};
  const ph=fileIds.map(()=>'?').join(',');
  const rows=await all('SELECT file_id, ROUND(AVG(rating),1) as avg FROM ratings WHERE file_id IN ('+ph+') GROUP BY file_id',[...fileIds]);
  return Object.fromEntries(rows.map(r=>[r.file_id,parseFloat(r.avg||0)]));
};

module.exports = {
  getPreviewPersonal,
  getFavs,isFav,addFav,removeFav,favCount,
  addHistory,invalidateLastFile,getHistory,getLastFile,getUserDownloadCount,
  getRecommended,getSimilar,
  addLog,getLogs,getActiveUsers,
  addRating,getUserRating,getAvgRating,
  getFavBatch,getRatingBatch
};
