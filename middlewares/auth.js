const { get, run } = require('../database/db');

const OWNER_ID = parseInt(process.env.OWNER_ID || '5534474259');
const isOwner = uid => parseInt(uid) === OWNER_ID;

// ═══════════════════════════════════════════════════════
// 🛡️ Smart User Buffer (تخفيف الضغط عن DB بنسبة 99%)
// ═══════════════════════════════════════════════════════
const _userBuffer = new Map();

function bufferUser(uid, firstName, lastName, username) {
  _userBuffer.set(uid, { id: uid, first_name: firstName||'', last_name: lastName||'', username: username||'' });
  if (_userBuffer.size >= 500) flushUserBuffer();
}

async function flushUserBuffer() {
  if (!_userBuffer.size) return;
  const entries = [..._userBuffer.values()];
  _userBuffer.clear();
  if (!entries.length) return;
  
  const rows = entries.map((_, i) => `($${i*4+1}, $${i*4+2}, $${i*4+3}, $${i*4+4}, CURRENT_TIMESTAMP)`).join(',');
  const params = entries.flatMap(e => [e.id, e.first_name, e.last_name, e.username]);
  
  try {
    await run(
      `INSERT INTO users(id, first_name, last_name, username, last_active) VALUES ${rows} 
       ON CONFLICT(id) DO UPDATE SET 
       first_name=EXCLUDED.first_name, 
       last_name=EXCLUDED.last_name, 
       username=EXCLUDED.username, 
       last_active=CURRENT_TIMESTAMP`,
      params
    );
  } catch(e) {}
}

setInterval(flushUserBuffer, 10000);

// ═══════════════════════════════════════════════════════
const _adminCache = new Map();
const ADMIN_TTL = 300000;

async function getAdminInfo(uid) {
  const now = Date.now();
  const cached = _adminCache.get(uid);
  if(cached && now - cached.ts < ADMIN_TTL) return cached.data;
  const row = await get('SELECT * FROM admins WHERE user_id=$1', [uid]);
  const data = row
    ? { isAdmin: true, perms: (row.permissions||'').split(',').map(p=>p.trim()) }
    : { isAdmin: false, perms: [] };
  _adminCache.set(uid, { data, ts: now });
  return data;
}

global.invalidateAdmin = uid => _adminCache.delete(uid);

const BAN_CACHE = new Map();
const BAN_TTL = 300000;

function getBanCache(uid) {
  const c = BAN_CACHE.get(uid);
  if(!c) return undefined;
  if(Date.now() > c.exp) { BAN_CACHE.delete(uid); return undefined; }
  return c.val;
}

function setBanCache(uid, val) {
  BAN_CACHE.set(uid, { val, exp: Date.now() + BAN_TTL });
}

global.invalidateBan = uid => BAN_CACHE.delete(uid);

setInterval(() => {
  const now = Date.now();
  for(const [k,v] of BAN_CACHE) if(now > v.exp) BAN_CACHE.delete(k);
}, 300000);

// ═══════════════════════════════════════════════════════
async function authMiddleware(ctx, next) {
  const uid = ctx.from?.id;
  if(!uid) return next();

  ctx.uid = uid;
  ctx.isOwner = isOwner(uid);

  // 🛡️ تحديث البيانات في الذاكرة فوراً (0.001 ثانية)
  const f = ctx.from;
  bufferUser(uid, f.first_name, f.last_name, f.username);

  if(ctx.isOwner) {
    ctx.isAdmin = true;
    ctx.adminPerms = ['full'];
  } else {
    const info = await getAdminInfo(uid);
    ctx.isAdmin = info.isAdmin;
    ctx.adminPerms = info.perms;
  }

  if(!ctx.isOwner && !ctx.isAdmin) {
    let banned = getBanCache(uid);
    if(banned === undefined) {
      const u = await get('SELECT is_banned FROM users WHERE id=$1', [uid]);
      banned = u?.is_banned ? 1 : 0;
      setBanCache(uid, banned);
    }
    if(banned === 1) {
      return ctx.reply('🚫 أنت محظور من استخدام البوت.').catch(()=>{});
    }
  }

  if(global.maintenanceMode && !ctx.isOwner && !ctx.isAdmin) {
    return ctx.reply('🔧 ' + global.maintenanceMsg).catch(()=>{});
  }

  return next();
}

module.exports = { authMiddleware, isOwner, OWNER_ID };
