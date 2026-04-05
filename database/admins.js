const { all, get, run } = require('./db');

const permsCache = new Map();
const CACHE_TTL = 300000;

const getAll = () => all('SELECT a.*,u.first_name,u.username FROM admins a LEFT JOIN users u ON a.user_id=u.id');
const setSpecialty = (uid,spId) => run('UPDATE admins SET specialty_id=? WHERE user_id=?',[spId,uid]);
const getAdminSpecialty = async uid => (await get('SELECT specialty_id FROM admins WHERE user_id=?',[uid]))?.specialty_id||0;
const add = (uid,by,perms='upload,add_content') => { permsCache.delete(uid); return run('INSERT INTO admins(user_id,added_by,permissions) VALUES(?,?,?) ON CONFLICT(user_id) DO NOTHING',[uid,by,perms]); };
const remove = uid => { permsCache.delete(uid); return run('DELETE FROM admins WHERE user_id=?',[uid]); };
const isAdmin = async uid => !!(await get('SELECT 1 FROM admins WHERE user_id=?',[uid]));

const getPerms = async uid => {
  const cached = permsCache.get(uid);
  if(cached && Date.now() < cached.exp) return cached.val;
  const r = await get('SELECT permissions FROM admins WHERE user_id=?',[uid]);
  const val = r ? r.permissions.split(',') : [];
  permsCache.set(uid, {val, exp: Date.now()+CACHE_TTL});
  return val;
};

const updatePerms = (uid,perms) => { permsCache.delete(uid); return run('UPDATE admins SET permissions=? WHERE user_id=?',[perms,uid]); };
const hasPerm = async (uid,perm) => { if(require('../middlewares/auth').isOwner(uid)) return true; const p=await getPerms(uid); return p.includes('full')||p.includes(perm); };

module.exports = { getAll,add,remove,isAdmin,getPerms,updatePerms,hasPerm,setSpecialty,getAdminSpecialty };
