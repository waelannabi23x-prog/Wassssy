const { get, run } = require('../database/db');
const { cacheGet, cacheSet, cacheClear } = require('../utils/cache');

const OWNER_ID = parseInt(process.env.OWNER_ID || '5534474259');

const isOwner = uid => parseInt(uid) === OWNER_ID;

const _adminCache = new Map();
const ADMIN_TTL = 300000;

async function getAdminInfo(uid) {
  const now = Date.now();
  const cached = _adminCache.get(uid);
  if(cached && now - cached.ts < ADMIN_TTL) return cached.data;
  const row = await get('SELECT * FROM admins WHERE user_id=?',[uid]);
  const data = row ? { isAdmin:true, perms:(row.permissions||'').split(',').map(p=>p.trim()) } : { isAdmin:false, perms:[] };
  _adminCache.set(uid, { data, ts:now });
  return data;
}

global.invalidateAdmin = uid => _adminCache.delete(uid);

async function authMiddleware(ctx, next) {
  const uid = ctx.from?.id;
  if(!uid) return next();

  ctx.uid = uid;
  ctx.isOwner = isOwner(uid);

  // تحديث بيانات المستخدم fire and forget
  const f = ctx.from;
  run('INSERT INTO users(id,first_name,last_name,username,last_active) VALUES(?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,username=EXCLUDED.username,last_active=CURRENT_TIMESTAMP',
    [uid,f.first_name||'',f.last_name||'',f.username||'']).catch(()=>{});

  // صلاحيات
  if(ctx.isOwner) {
    ctx.isAdmin = true;
    ctx.adminPerms = ['full'];
  } else {
    const info = await getAdminInfo(uid);
    ctx.isAdmin = info.isAdmin;
    ctx.adminPerms = info.perms;
  }

  // حظر
  if(!ctx.isOwner && !ctx.isAdmin) {
    const banned = cacheGet('ban_'+uid);
    if(banned === null) {
      const u = await get('SELECT is_banned FROM users WHERE id=?',[uid]);
      cacheSet('ban_'+uid, u?.is_banned||0, 300000);
      if(u?.is_banned) return ctx.reply('🚫 أنت محظور من استخدام البوت.').catch(()=>{});
    } else if(banned) {
      return ctx.reply('🚫 أنت محظور من استخدام البوت.').catch(()=>{});
    }
  }

  // صيانة
  if(global.maintenanceMode && !ctx.isOwner && !ctx.isAdmin) {
    return ctx.reply('🔧 '+global.maintenanceMsg).catch(()=>{});
  }

  return next();
}

module.exports = { authMiddleware, isOwner, OWNER_ID };
