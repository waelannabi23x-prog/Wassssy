const admins = require('../database/admins');
const users = require('../database/users');
const OWNER_ID = 5534474259;
const isOwner = id => id === OWNER_ID;

const adminCache = new Map();
const bannedCache = new Map();
const lastUpsert = new Map();
const rateLimits = new Map();
const CACHE_TTL = 600000; // 10 دقائق بدل 5

setInterval(() => {
  const now = Date.now();
  for(const [uid,v] of rateLimits) if(now > v.reset) rateLimits.delete(uid);
  for(const [uid,v] of adminCache) if(now > v.exp) adminCache.delete(uid);
  for(const [uid,v] of bannedCache) if(now > v.exp) bannedCache.delete(uid);
}, 600000);

function checkRateLimit(uid) {
  const now = Date.now();
  let r = rateLimits.get(uid);
  if(!r || now > r.reset) { r = {count:0, reset:now+10000}; rateLimits.set(uid,r); }
  return ++r.count > 20;
}

async function isAdmin(id) {
  if(isOwner(id)) return true;
  const cached = adminCache.get(id);
  if(cached && Date.now() < cached.exp) return cached.val;
  const val = await admins.isAdmin(id);
  adminCache.set(id, {val, exp: Date.now()+CACHE_TTL});
  return val;
}

async function isBanned(id) {
  const cached = bannedCache.get(id);
  if(cached && Date.now() < cached.exp) return cached.val;
  const val = await users.isBanned(id);
  bannedCache.set(id, {val, exp: Date.now()+CACHE_TTL});
  return val;
}

function deferredUpsert(uid, fn, ln, un) {
  const now = Date.now();
  if(now - (lastUpsert.get(uid)||0) < 300000) return;
  lastUpsert.set(uid, now);
  users.upsert(uid, fn, ln, un).catch(()=>{});
}

async function authMiddleware(ctx, next) {
  if(!ctx.from) return next();
  const uid = ctx.from.id;
  deferredUpsert(uid, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
  if(checkRateLimit(uid) && !isOwner(uid)) {
    return ctx.answerCbQuery?.('⏳ بطيء شوي!').catch(()=>{});
  }
  // فحص واحد بالتوازي بدل اثنين بالتسلسل
  const [banned, adminVal] = await Promise.all([
    isOwner(uid) ? Promise.resolve(false) : isBanned(uid),
    isAdmin(uid)
  ]);
  if(banned) return ctx.reply('🚫 You are banned.');
  if(global.maintenanceMode === true && !adminVal) {
    return ctx.reply('🔧 *'+(global.maintenanceMsg||'Bot under maintenance')+'*\n\nPlease wait! 🙏', {parse_mode:'Markdown'});
  }
  ctx.isOwner = isOwner(uid);
  ctx.isAdmin = adminVal;
  ctx.uid = uid;
  return next();
}

module.exports = {authMiddleware, isOwner, isAdmin, OWNER_ID};
