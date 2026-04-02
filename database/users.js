const { all, get, run } = require('./db');
const upsert = (id,fn,ln,un) => run(`INSERT OR REPLACE INTO users(id,first_name,last_name,username,last_active) VALUES(?,?,?,?,datetime('now'))`,[id,fn||'',ln||'',un||'']);
const getAll = (page=0,limit=20) => all('SELECT * FROM users ORDER BY last_active DESC LIMIT ? OFFSET ?',[limit,page*limit]);
const count = async () => (await get('SELECT COUNT(*) as c FROM users'))?.c || 0;
const activeToday = async () => (await get(`SELECT COUNT(*) as c FROM users WHERE last_active >= datetime('now', '-1 day')`))?.c || 0;
const allIds = async () => (await all('SELECT id FROM users WHERE is_banned=FALSE')).map(r=>r.id);
const ban = id => run('UPDATE users SET is_banned=1 WHERE id=?',[id]);
const unban = id => run('UPDATE users SET is_banned=0 WHERE id=?',[id]);
const isBanned = async id => !!(await get('SELECT is_banned FROM users WHERE id=?',[id]))?.is_banned;
const getById = id => get('SELECT * FROM users WHERE id=?',[id]);
const searchUsers = q => { const w='%'+q+'%'; return all('SELECT * FROM users WHERE first_name LIKE ? OR username LIKE ? OR CAST(id AS TEXT) LIKE ? LIMIT 20',[w,w,w]); };
module.exports = { upsert,getAll,count,activeToday,allIds,ban,unban,isBanned,getById,searchUsers };

const setSpecialty = (uid, spId) => run('INSERT OR REPLACE INTO user_specialties(user_id,specialty_id) VALUES(?,?)',[uid,spId]);
const getSpecialty = uid => get('SELECT specialty_id FROM user_specialties WHERE user_id=?',[uid]);
const getUsersBySpecialty = async spId => (await all('SELECT id FROM users WHERE is_banned=0 AND id IN (SELECT user_id FROM user_specialties WHERE specialty_id=?)',[spId])).map(r=>r.id);
Object.assign(module.exports, {setSpecialty, getSpecialty, getUsersBySpecialty});
