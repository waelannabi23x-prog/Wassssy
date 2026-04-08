const { all, get, run } = require('./db');

const cache = new Map();
const CACHE_TTL = 600000;

const _get = (k) => { const c=cache.get(k); return (c && Date.now()<c.exp) ? c.val : null; };
const _set = (k,v) => cache.set(k,{val:v,exp:Date.now()+CACHE_TTL});
const _del = k => cache.delete(k);

setInterval(()=>{ const now=Date.now(); for(const [k,v] of cache) if(now>v.exp) cache.delete(k); },600000);

const getAll = () => all('SELECT a.*,u.first_name,u.username FROM admins a LEFT JOIN users u ON a.user_id=u.id');
const setSpecialty = (uid,spId) => { _del('sp_'+uid); return run('UPDATE admins SET specialty_id=? WHERE user_id=?',[spId,uid]); };

const getAdminSpecialty = async uid => {
  const c=_get('sp_'+uid);
  if(c!==null) return c;
  const r=(await get('SELECT specialty_id FROM admins WHERE user_id=?',[uid]))?.specialty_id||0;
  _set('sp_'+uid,r);
  return r;
};

const add = (uid,by,perms='upload,add_content') => { _del('ia_'+uid); _del(String(uid)); return run('INSERT INTO admins(user_id,added_by,permissions) VALUES(?,?,?) ON CONFLICT(user_id) DO NOTHING',[uid,by,perms]); };
const remove = uid => { _del('ia_'+uid); _del(String(uid)); _del('sp_'+uid); return run('DELETE FROM admins WHERE user_id=?',[uid]); };

const isAdmin = async uid => {
  const c=_get('ia_'+uid);
  if(c!==null) return c;
  const r=!!(await get('SELECT 1 FROM admins WHERE user_id=?',[uid]));
  _set('ia_'+uid,r);
  return r;
};

const getPerms = async uid => {
  const c=_get(String(uid));
  if(c!==null) return c;
  const r=await get('SELECT permissions FROM admins WHERE user_id=?',[uid]);
  const val=r ? r.permissions.split(',') : [];
  _set(String(uid),val);
  return val;
};

const updatePerms = (uid,perms) => { _del(String(uid)); return run('UPDATE admins SET permissions=? WHERE user_id=?',[perms,uid]); };
const hasPerm = async (uid,perm) => { if(require('../middlewares/auth').isOwner(uid)) return true; const p=await getPerms(uid); return p.includes('full')||p.includes(perm); };

const clearCache = uid => { _del('ia_'+uid); _del(String(uid)); _del('sp_'+uid); };
module.exports = { getAll,add,remove,isAdmin,getPerms,updatePerms,hasPerm,setSpecialty,getAdminSpecialty,clearCache };
