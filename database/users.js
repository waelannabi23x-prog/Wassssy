const { cacheGet, cacheSet, cacheClear } = require('../utils/cache');
const { all, get, run } = require('./db');

const updateLastActive = id => run('UPDATE users SET last_active=CURRENT_TIMESTAMP WHERE id=$1',[id]);
const upsert = (id,fn,ln,un) => run('INSERT INTO users(id,first_name,last_name,username,joined_at,last_active) VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,username=EXCLUDED.username,last_active=CURRENT_TIMESTAMP',[id,fn||'',ln||'',un||'']);
const getAll = (page=0,limit=20) => all("SELECT * FROM users WHERE last_active >= NOW() - INTERVAL '7 days' ORDER BY last_active DESC LIMIT $1 OFFSET $2",[limit,page*limit]);
const countActive = async () => (await get("SELECT COUNT(*) as c FROM users WHERE last_active >= NOW() - INTERVAL '7 days'"))?.c||0;
const cleanOldUsers = () => run("DELETE FROM users WHERE last_active < NOW() - INTERVAL '365 days' AND is_banned=0");
const count = async () => (await get('SELECT COUNT(*) as c FROM users'))?.c||0;
const activeToday = async () => (await get("SELECT COUNT(*) as c FROM users WHERE last_active::timestamp >= NOW() - INTERVAL '1 day'"))?.c||0;
const allIds = async () => (await all('SELECT id FROM users WHERE is_banned=0')).map(r=>r.id);
const ban = id => { cacheClear('ban_'+id); return run('UPDATE users SET is_banned=1 WHERE id=$1',[id]); };
const unban = id => { cacheClear('ban_'+id); return run('UPDATE users SET is_banned=0 WHERE id=$1',[id]); };
const isBanned = async id => !!(await get('SELECT is_banned FROM users WHERE id=$1',[id]))?.is_banned;
const getById = id => get('SELECT * FROM users WHERE id=$1',[id]);
const searchUsers = q => { const w='%'+q+'%'; return all('SELECT * FROM users WHERE first_name ILIKE $1 OR username ILIKE $2 OR CAST(id AS TEXT) LIKE $3 LIMIT 20',[w,w,w]); };
const setSpecialty = (uid,spId) => { cacheClear('usp_'+uid); return run('INSERT INTO user_specialties(user_id,specialty_id) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET specialty_id=EXCLUDED.specialty_id',[uid,spId]); };
const getSpecialty = async uid => { const c = cacheGet('usp_'+uid); if(c) return c; const r = await get('SELECT specialty_id FROM user_specialties WHERE user_id=$1',[uid]); if(r) cacheSet('usp_'+uid,r,1800000); return r; };
const getUsersBySpecialty = async spId => (await all('SELECT user_id as id FROM user_specialties WHERE specialty_id=$1',[spId])).map(r=>r.id);

module.exports = { upsert,updateLastActive,getAll,countActive,cleanOldUsers,count,activeToday,allIds,ban,unban,isBanned,getById,searchUsers,setSpecialty,getSpecialty,getUsersBySpecialty };
