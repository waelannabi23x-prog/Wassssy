'use strict';
const { all, get, run } = require('./db');
const { cacheGet, cacheSet, cacheClear } = require('../utils/cache');
const J = `SELECT f.*,c.name as cat_name,s.name as sub_name FROM files f JOIN categories c ON f.category_id=c.id JOIN subjects s ON c.subject_id=s.id`;

const getFavs = uid => all(J+' JOIN favorites fv ON fv.file_id=f.id WHERE fv.user_id=$1 AND f.is_deleted=0 ORDER BY fv.file_id DESC',[uid]);
const isFav = async (uid,fid) => { const k='fav_'+uid+'_'+fid; const c=cacheGet(k); if(c!==null) return c; const r=!!(await get('SELECT 1 FROM favorites WHERE user_id=$1 AND file_id=$2',[uid,fid])); cacheSet(k,r,1800000); return r; };
const addFav = (uid,fid) => { cacheClear('fav_'+uid+'_'+fid); cacheClear('favcnt_'+fid); return run('INSERT INTO favorites(user_id,file_id) VALUES($1,$2) ON CONFLICT(user_id,file_id) DO NOTHING',[uid,fid]); };
const removeFav = (uid,fid) => { cacheClear('fav_'+uid+'_'+fid); cacheClear('favcnt_'+fid); return run('DELETE FROM favorites WHERE user_id=$1 AND file_id=$2',[uid,fid]); };
const favCount = async fid => { const k='favcnt_'+fid; const c=cacheGet(k); if(c!==null) return c; const r=(await get('SELECT COUNT(*) as c FROM favorites WHERE file_id=$1',[fid]))?.c||0; cacheSet(k,r,3600000); return r; };

const _histDedup = new Map();
const addHistory = (uid,fid) => {
  const k=uid+'_'+fid; const now=Date.now(); const last=_histDedup.get(k)||0;
  if(now-last<600000) return Promise.resolve();
  _histDedup.set(k,now);
  if(_histDedup.size>5000) { const old=now-600000; for(const [kk,v] of _histDedup) if(v<old) _histDedup.delete(kk); }
  return run('INSERT INTO history(user_id,file_id) VALUES($1,$2)',[uid,fid]);
};
const getHistory = (uid,n=15) => all(J+' JOIN history h ON h.file_id=f.id WHERE h.user_id=$1 AND f.is_deleted=0 ORDER BY h.viewed_at DESC LIMIT $2',[uid,n]);
const getLastFile = async uid => { const k='lastfile_'+uid; const c=cacheGet(k); if(c!==undefined) return c||null; const r=(await all(J+' JOIN history h ON h.file_id=f.id WHERE h.user_id=$1 AND f.is_deleted=0 ORDER BY h.viewed_at DESC LIMIT 1',[uid]))[0]||null; cacheSet(k,r,600000); return r; };
const invalidateLastFile = uid => cacheClear('lastfile_'+uid);
const getUserDownloadCount = async uid => { const k='dlcnt_'+uid; const c=cacheGet(k); if(c!==null) return c; const r=(await get('SELECT COUNT(*) as c FROM history WHERE user_id=$1',[uid]))?.c||0; cacheSet(k,r,300000); return r; };

async function getRecommended(uid,limit=8) {
  const k='rec_'+uid; const c=cacheGet(k); if(c) return c;
  const cats=(await all(`SELECT c.id FROM history h JOIN files f ON h.file_id=f.id JOIN categories c ON f.category_id=c.id WHERE h.user_id=$1 GROUP BY c.id ORDER BY MAX(h.viewed_at) DESC LIMIT 5`,[uid])).map(r=>r.id);
  let result;
  if(!cats.length) { result=await all(J+' WHERE f.is_deleted=0 ORDER BY f.downloads DESC LIMIT $1',[limit]); }
  else { const ph=cats.map((_,i)=>'$'+(i+1)).join(','); result=await all(J+` WHERE f.category_id IN (${ph}) AND f.is_deleted=0 AND f.id NOT IN (SELECT file_id FROM history WHERE user_id=$${cats.length+1}) ORDER BY f.downloads DESC LIMIT $${cats.length+2}`,[...cats,uid,limit]); }
  cacheSet(k,result,300000); return result;
}

async function getSimilar(fileId,limit=4) {
  const k='similar_'+fileId; const c=cacheGet(k); if(c) return c;
  const f=await get('SELECT f.id,f.category_id,c.subject_id FROM files f JOIN categories c ON f.category_id=c.id WHERE f.id=$1',[fileId]);
  if(!f) return [];
  const results=await all(J+' WHERE f.id!=$1 AND f.is_deleted=0 AND f.category_id=$2 ORDER BY f.downloads DESC LIMIT $3',[fileId,f.category_id,limit]);
  if(results.length>=limit) { cacheSet(k,results,7200000); return results; }
  const ids=[parseInt(fileId),...results.map(r=>r.id)]; const ph=ids.map((_,i)=>'$'+(i+1)).join(',');
  const more=await all(J+' JOIN categories c2 ON f.category_id=c2.id WHERE c2.subject_id=$'+(ids.length+1)+' AND f.id NOT IN ('+ph+') AND f.is_deleted=0 ORDER BY f.downloads DESC LIMIT $'+(ids.length+2),[...ids,f.subject_id,limit-results.length]);
  const final=[...results,...more].slice(0,limit); cacheSet(k,final,7200000); return final;
}

const addLog = (uid,action,details) => run('INSERT INTO logs(user_id,action,details) VALUES($1,$2,$3)',[uid,action,details||'']).catch(()=>{});
const getLogs = (n=20) => all('SELECT l.*,u.first_name FROM logs l LEFT JOIN users u ON l.user_id=u.id ORDER BY l.created_at DESC LIMIT $1',[n]);
const getActiveUsers = async (days=7) => { const k='active_users_'+days; const c=cacheGet(k); if(c) return c; const rows=await all(`SELECT id FROM users WHERE is_banned=0 AND last_active >= NOW() - ($1::integer * INTERVAL '1 day')`,[days]); const ids=rows.map(r=>r.id); cacheSet(k,ids,600000); return ids; };

const addRating = (uid,fid,rating) => { cacheClear('urating_'+uid+'_'+fid); cacheClear('avg_'+fid); cacheClear('prev_static_'+fid); return run('INSERT INTO ratings(user_id,file_id,rating) VALUES($1,$2,$3) ON CONFLICT(user_id,file_id) DO UPDATE SET rating=EXCLUDED.rating',[uid,fid,rating]); };
const getUserRating = async (uid,fid) => { const k='urating_'+uid+'_'+fid; const c=cacheGet(k); if(c!==null) return c; const r=(await get('SELECT rating FROM ratings WHERE user_id=$1 AND file_id=$2',[uid,fid]))?.rating||0; cacheSet(k,r,1800000); return r; };
const getAvgRating = async fid => { const k='avg_'+fid; const c=cacheGet(k); if(c) return c; const r=await get('SELECT ROUND(AVG(rating),1) as avg, COUNT(*) as cnt FROM ratings WHERE file_id=$1',[fid]); const result={avg:parseFloat(r?.avg||0),cnt:parseInt(r?.cnt||0)}; cacheSet(k,result,3600000); return result; };

const getFavBatch = async (uid,fileIds) => {
  if(!fileIds.length) return {};
  const k='favbatch_'+uid+'_'+fileIds.join('_'); const c=cacheGet(k); if(c) return c;
  const ph=fileIds.map((_,i)=>'$'+(i+2)).join(',');
  const rows=await all('SELECT file_id FROM favorites WHERE user_id=$1 AND file_id IN ('+ph+')',[uid,...fileIds]);
  const set=new Set(rows.map(r=>String(r.file_id)));
  const result=Object.fromEntries(fileIds.map(id=>[id,set.has(String(id))]));
  cacheSet(k,result,600000); return result;
};
const getRatingBatch = async fileIds => {
  if(!fileIds.length) return {};
  const k='ratingbatch_'+fileIds.join('_'); const c=cacheGet(k); if(c) return c;
  const ph=fileIds.map((_,i)=>'$'+(i+1)).join(',');
  const rows=await all('SELECT file_id, ROUND(AVG(rating),1) as avg FROM ratings WHERE file_id IN ('+ph+') GROUP BY file_id',[...fileIds]);
  const result=Object.fromEntries(rows.map(r=>[r.file_id,parseFloat(r.avg||0)]));
  cacheSet(k,result,1800000); return result;
};

const getPreviewPersonal = async (uid,fid) => {
  const fk='fav_'+uid+'_'+fid, rk='urating_'+uid+'_'+fid, pk='report_'+uid+'_'+fid;
  const cf=cacheGet(fk), cr=cacheGet(rk), cp=cacheGet(pk);
  if(cf!==null && cr!==null && cp!==null) return { fav:cf, userRating:cr, alreadyReported:cp };
  const [favRow,ratingRow,reportRow]=await Promise.all([
    cf===null ? get('SELECT 1 FROM favorites WHERE user_id=$1 AND file_id=$2',[uid,fid]) : Promise.resolve(cf?{1:1}:null),
    cr===null ? get('SELECT rating FROM ratings WHERE user_id=$1 AND file_id=$2',[uid,fid]) : Promise.resolve({rating:cr}),
    cp===null ? get("SELECT 1 FROM reports WHERE user_id=$1 AND file_id=$2 AND status!='dismissed'",[uid,fid]) : Promise.resolve(cp?{1:1}:null),
  ]);
  const fav=!!favRow, userRating=ratingRow?.rating||0, alreadyReported=!!reportRow;
  cacheSet(fk,fav,1800000); cacheSet(rk,userRating,1800000); cacheSet(pk,alreadyReported,1800000);
  return { fav, userRating, alreadyReported };
};

module.exports = { getFavs,isFav,addFav,removeFav,favCount,addHistory,invalidateLastFile,getHistory,getLastFile,getUserDownloadCount,getRecommended,getSimilar,addLog,getLogs,getActiveUsers,addRating,getUserRating,getAvgRating,getFavBatch,getRatingBatch,getPreviewPersonal };
