const admins = require('../database/admins');
const users = require('../database/users');
const { getSetting } = require('../database/db');
const OWNER_ID = 5534474259;
const isOwner=id=>id===OWNER_ID;
const rateLimits={};
// Cleanup old rate limit entries every 5 minutes
setInterval(()=>{ const now=Date.now(); for(const uid in rateLimits){ if(now>rateLimits[uid].reset) delete rateLimits[uid]; } },300000);
function checkRateLimit(uid){
  const now=Date.now();
  if(!rateLimits[uid]) rateLimits[uid]={count:0,reset:now+10000};
  if(now>rateLimits[uid].reset) rateLimits[uid]={count:0,reset:now+10000};
  rateLimits[uid].count++;
  return rateLimits[uid].count>15;
}
async function isAdmin(id){ return isOwner(id)||await admins.isAdmin(id); }
async function authMiddleware(ctx,next){
  if(!ctx.from) return next();
  const uid=ctx.from.id;
  await users.upsert(uid,ctx.from.first_name,ctx.from.last_name,ctx.from.username);
  if(checkRateLimit(uid)&&!isOwner(uid)) return ctx.answerCbQuery?.('⏳ Too many requests!').catch(()=>{});
  if(await users.isBanned(uid)&&!isOwner(uid)) return ctx.reply('🚫 You are banned.');
  const maintenance = await getSetting('maintenance');
  if(maintenance==='true'&&!await isAdmin(uid)) return ctx.reply('🔧 *'+(global.maintenanceMsg||'Bot under maintenance')+'*\n\nPlease wait! 🙏',{parse_mode:'Markdown'});
  ctx.isOwner=isOwner(uid); ctx.isAdmin=await isAdmin(uid); ctx.uid=uid;
  return next();
}
module.exports={authMiddleware,isOwner,isAdmin,OWNER_ID};
