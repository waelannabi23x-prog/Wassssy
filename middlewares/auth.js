const admins = require('../database/admins');
const users = require('../database/users');
const OWNER_ID = 5534474259;
const isOwner = id => id === OWNER_ID;

// Cache للأدمن والباند
const adminCache = new Map();
const bannedCache = new Map();
const upsertCache = new Set();
const CACHE_TTL = 300000; // 5 دقائق

// Rate limit
const rateLimits = {};
setInterval(() => {
  const now = Date.now();
  for(const uid in rateLimits) if(now > rateLimits[uid].reset) delete rateLimits[uid];
}, 300000);

function checkRateLimit(uid) {
  const now = Date.now();
  if(!rateLimits[uid]) rateLimits[uid] = {count:0, reset:now+10000};
  if(now > rateLimits[uid].reset) rateLimits[uid] = {count:0, reset:now+10000};
  rateLimits[uid].count++;
  return rateLimits[uid].count > 15;
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

// upsert بشكل deferred - مرة كل 5 دقائق للمستخدم
const lastUpsert = new Map();
async function deferredUpsert(uid, fn, ln, un) {
  const now = Date.now();
  const last = lastUpsert.get(uid) || 0;
  if(now - last < 300000) return; // ما نكتب إلا كل 5 دقائق
  lastUpsert.set(uid, now);
  users.upsert(uid, fn, ln, un).catch(()=>{});
}

async function authMiddleware(ctx, next) {
  if(!ctx.from) return next();
  const uid = ctx.from.id;

  // upsert deferred
  deferredUpsert(uid, ctx.from.first_name, ctx.from.last_name, ctx.from.username);

  if(checkRateLimit(uid) && !isOwner(uid)) return ctx.answerCbQuery?.('⏳ Too many requests!').catch(()=>{});
  if(await isBanned(uid) && !isOwner(uid)) return ctx.reply('🚫 You are banned.');
  if(global.maintenanceMode === true && !await isAdmin(uid)) return ctx.reply('🔧 *'+(global.maintenanceMsg||'Bot under maintenance')+'*\n\nPlease wait! 🙏', {parse_mode:'Markdown'});

  ctx.isOwner = isOwner(uid);
  ctx.isAdmin = await isAdmin(uid);
  ctx.uid = uid;
  return next();
}

module.exports = {authMiddleware, isOwner, isAdmin, OWNER_ID};
