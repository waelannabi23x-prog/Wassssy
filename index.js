require("dotenv").config();
const { Telegraf } = require('telegraf');
const { initSchema, getSetting, run: dbRun, all: dbAll } = require("./database/db");
const { authMiddleware, isOwner, OWNER_ID } = require('./middlewares/auth');
const interactions = require('./database/interactions');
const startHandler = require('./handlers/start');
const browse = require('./handlers/browse');
const commentsDb = require('./database/comments');
const userH = require('./handlers/user');
const manage = require('./handlers/manage');
const { startScheduler } = require('./utils/scheduler');
const adminsDb = require('./database/admins');
const usersDb = require('./database/users');
const filesDb = require('./database/files');
const contentDb = require('./database/content');
const bundlesDb = require('./database/bundles');
const { btn: kbBtn, build: kbBuild } = require('./utils/keyboard');
const { cacheWarmup } = require('./utils/cache');
const { precomputeAll } = require('./utils/precompute');
const { setLang } = require('./utils/i18n');
const path = require('path');
const fs = require('fs');

const TOKEN = process.env.BOT_TOKEN;
const express = require('express');
try { const compression=require('compression'); app.use(compression()); } catch(e) {}
const app = express();
app.use(express.json({ limit: '1mb' }));


global.userStates = {};
global.maintenanceMode = false;
global.maintenanceMsg = 'البوت تحت الصيانة. يرجى الانتظار!';

async function loadMaintenance() {
  try {
    const val = await getSetting('maintenance');
    global.maintenanceMode = val === 'true';
    console.log('🔧 Maintenance mode:', global.maintenanceMode);
  } catch(e) {}
}

async function loadStates() {
  try {
    const rows = await dbAll('SELECT user_id, state FROM user_states');
    for(const r of rows) {
      try { global.userStates[r.user_id] = JSON.parse(r.state); } catch {}
    }
    console.log('✅ States loaded:', rows.length);
  } catch(e) { console.error('States load error:', e.message); }
}

const _stateDirty = new Set();
let _stateTimer = null;
function _scheduleStateFlush() {
  if(_stateTimer) return;
  _stateTimer = setTimeout(async () => {
    _stateTimer = null;
    const uids = [..._stateDirty]; _stateDirty.clear();
    for(const uid of uids) {
      const state = global.userStates[uid];
      try {
        if(state) await dbRun('INSERT INTO user_states(user_id,state,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET state=EXCLUDED.state,updated_at=CURRENT_TIMESTAMP',[uid,JSON.stringify(state)]);
        else await dbRun('DELETE FROM user_states WHERE user_id=?',[uid]);
      } catch(e) {}
    }
  }, 2000);
}

global.setState = async function(uid, state) {
  global.userStates[uid] = state;
  _stateDirty.add(uid);
  _scheduleStateFlush();
};

global.delState = async function(uid) {
  delete global.userStates[uid];
  _stateDirty.add(uid);
  _scheduleStateFlush();
};

setInterval(async () => {
  try {
    await dbRun(`DELETE FROM user_states WHERE updated_at < CURRENT_TIMESTAMP - INTERVAL '1 hour'`);
    const now = Date.now();
    for(const uid in global.userStates){
      if(global.userStates[uid]?._ts && now - global.userStates[uid]._ts > 3600000) global.delState(uid);
    }
  } catch(e) {}
}, 3600000);

const bot = new Telegraf(TOKEN);

// Rate Limiting
const _rl=new Map();
function checkRL(uid){
  const now=Date.now();
  const d=_rl.get(uid)||{count:0,reset:now+10000};
  if(now>d.reset){d.count=1;d.reset=now+10000;}
  else d.count++;
  _rl.set(uid,d);
  if(d.count>20){return false;}
  return true;
}
setInterval(()=>{ const now=Date.now(); for(const [k,v] of _rl) if(now>v.reset+5000) _rl.delete(k); },30000);

bot.use(authMiddleware);
bot.use(async(ctx,next)=>{ if(ctx.from&&!checkRL(ctx.from.id)){ return ctx.answerCbQuery&&ctx.answerCbQuery("⏳ بطيء قليلاً!",{show_alert:false}).catch(()=>{}); } return next(); });

bot.catch((err, ctx) => {
  console.error('Bot error:', err.message);
  ctx.reply?.('⚠️ حدث خطأ. يرجى المحاولة مجدداً.').catch(()=>{});
});

bot.command('start', startHandler);
bot.command(['admin','owner','manage'], ctx => {
  if (!ctx.isAdmin) return ctx.reply('🚫 ليس لديك صلاحية.');
  manage.mainMenu(ctx);
});
bot.command('search', ctx => {
  const q = ctx.message.text.replace('/search','').trim();
  if (q) return userH.handleSearch(ctx, q);
  global.setState(ctx.uid, { type: 'search' });
  ctx.reply('🔍 اكتب كلمة البحث:');
});
bot.command('profile', ctx => userH.showProfile(ctx));
bot.command('stats', ctx => userH.showStats(ctx));
bot.command('done', async ctx => {
  const uid = ctx.uid;
  const state = global.userStates?.[uid];
  if(state?.type === 'mg_bundle_files'){
    global.delState(uid);
    return ctx.reply('تم حفظ الحزمة بـ '+(state.fileCount||0)+' ملف');
  }
});
bot.command('leaveall', async ctx => {
  if(!ctx.isOwner) return ctx.reply('🚫 ليس لديك صلاحية.');
  const chats = await dbAll('SELECT chat_id FROM group_chats');
  let left = 0;
  for(const ch of chats){
    try { await ctx.telegram.leaveChat(ch.chat_id); left++; } catch(e) {}
  }
  ctx.reply('✅ خرجت من '+left+' قروب.');
});
bot.command('cancel', ctx => {
  if (global.userStates?.[ctx.uid]) { global.delState(ctx.uid); ctx.reply('❌ تم الإلغاء.'); }
});
bot.command('users', async ctx => {
  if(!ctx.isOwner && !ctx.isAdmin) return ctx.reply('🚫 ليس لديك صلاحية.');
  if(ctx.isAdmin && !ctx.isOwner){
    const perms = await adminsDb.getPerms(ctx.uid);
    if(!perms.includes('full') && !perms.includes('view_users')) return ctx.reply('🚫 ليس لديك صلاحية.');
  }
  return manage.showUsers(ctx);
});
bot.command('help', ctx => ctx.reply(
  '📚 *أوامر البوت*\n\n/start — القائمة الرئيسية\n/search — البحث\n/profile — ملفك الشخصي\n/stats — الإحصائيات\n/cancel — إلغاء العملية الحالية\n\n👑 للمشرفين:\n/admin — لوحة الإدارة',
  { parse_mode: 'Markdown' }
));

// ── Callback Query Handler ──
bot.on('callback_query', async ctx => {
  const data = ctx.callbackQuery.data;
  try {
    ctx.answerCbQuery('').catch(()=>{});
    if (data === 'noop') return;

    // Browse - الأكثر استخداماً أول
    if (data.startsWith('preview_')) { const p=data.split('_'); return browse.showPreview(ctx,p[1],p[2],p[3],p[4],p[5],p[6]); }
    if (data.startsWith('fl_')) { const p=data.split('_'); return browse.sendFile(ctx,p[1],p[2],p[3],p[4],p[5],p[6]); }
    if (data.startsWith('ct_page_')) { const p=data.replace('ct_page_','').split('_'); return browse.showFiles(ctx,p[0],p[1],p[2],p[3],p[4],parseInt(p[5])); }
    if (data.startsWith('ct_')) { const p=data.split('_'); return browse.showFiles(ctx,p[1],p[2],p[3],p[4],p[5]); }
    if (data.startsWith('bundle_')) { const p=data.split('_'); return browse.showBundle(ctx,p[1],p[2],p[3],p[4],p[5],p[6]); }
    if (data.startsWith('bdl_')) { const p=data.split('_'); return browse.sendBundle(ctx,p[1],p[2],p[3],p[4],p[5],p[6]); }

    // Favorites
    if (data.startsWith('unfav_')) return userH.toggleFav(ctx, data.replace('unfav_',''), true);
    if (data.startsWith('fav_')) return userH.toggleFav(ctx, data.replace('fav_',''));

    // Navigation
    if (data === 'main_menu') return startHandler(ctx);
    if (data === 'browse') return browse.showSpecs(ctx);

    // Specialty
    if (data.startsWith('set_sp_')) {
      const spId = data.replace('set_sp_','');
      await usersDb.setSpecialty(ctx.uid, spId);
      await ctx.answerCbQuery('تم حفظ تخصصك').catch(()=>{});
      return startHandler.showMainMenu(ctx);
    }
    if (data === 'skip_sp') { await usersDb.setSpecialty(ctx.uid, 0); return startHandler.showMainMenu(ctx); }
    if (data === 'change_sp') {
      const specs = await contentDb.getSpecs();
      const rows = specs.map(s => [kbBtn('🎓 ' + s.name, 'set_sp_' + s.id)]);
      return ctx.reply('🎓 اختر تخصصك:', {parse_mode:'Markdown', ...kbBuild(rows)});
    }

    // User sections
    if (data === 'latest') return userH.showLatest(ctx);
    if (data === 'new_in_sp') return userH.showNewInSpecialty(ctx);
    if (data === 'recommended') return userH.showRecommended(ctx);
    if (data === 'favorites') return userH.showFavorites(ctx);
    if (data === 'history') return userH.showHistory(ctx);
    if (data === 'profile') return userH.showProfile(ctx);
    if (data === 'stats') return userH.showStats(ctx);
    if (data === 'progress') return userH.showProgress(ctx);
    if (data === 'search_prompt') { global.setState(ctx.uid, {type:'search'}); return ctx.reply('🔍 اكتب كلمة البحث:'); }
    if (data.startsWith('lang_')) { setLang(ctx.uid, data.replace('lang_','')); return userH.showProfile(ctx); }

    // Browse tree
    if (data.startsWith('sp_')) return browse.showYears(ctx, data.replace('sp_',''));
    if (data.startsWith('yr_page_')) { const p=data.replace('yr_page_','').split('_'); return browse.showYears(ctx,p[0],parseInt(p[1])); }
    if (data.startsWith('yr_')) { const p=data.split('_'); return browse.showSemesters(ctx,p[1],p[2]); }
    if (data.startsWith('sms_')) { const p=data.replace('sms_','').split('_'); return browse.showSemesters(ctx,p[0],p[1]); }
    if (data.startsWith('sm_')) { const p=data.split('_'); return browse.showSubjects(ctx,p[1],p[2],p[3]); }
    if (data.startsWith('sb_page_')) { const p=data.replace('sb_page_','').split('_'); return browse.showSubjects(ctx,p[0],p[1],p[2],parseInt(p[3])); }
    if (data.startsWith('sbs_')) { const p=data.replace('sbs_','').split('_'); return browse.showSubjects(ctx,p[0],p[1],p[2]); }
    if (data.startsWith('sb_')) { const p=data.split('_'); return browse.showCategories(ctx,p[1],p[2],p[3],p[4]); }
    if (data.startsWith('yrs_')) { const p=data.replace('yrs_','').split('_'); return browse.showYears(ctx,p[0]); }

    // Ratings
    if (data.startsWith('rate_')) {
      const p=data.replace('rate_','').split('_');
      await interactions.addRating(ctx.uid,p[0],parseInt(p[1]));
      await ctx.answerCbQuery('⭐ تم تقييم الملف بـ '+p[1]+'/5!').catch(()=>{});
      return browse.showPreview(ctx,p[0],p[2],p[3],p[4],p[5],p[6]);
    }

    // Reports
    if (data.startsWith('do_report_')) {
      const p=data.replace('do_report_','').split('_');
      return browse.doReport(ctx,p[0],p[1],p[2],p[3],p[4],p[5],p[6]);
    }
    if (data.startsWith('report_')) {
      const p=data.replace('report_','').split('_');
      return browse.showReportMenu(ctx,p[0],p[1],p[2],p[3],p[4],p[5]);
    }

    // Comments
    if (data.startsWith('cmt_pg_')) { const p=data.replace('cmt_pg_','').split('_'); return browse.showComments(ctx,p[0],p[1],p[2],p[3],p[4],p[5],p[6],parseInt(p[7])); }
    if (data.startsWith('cmt_')) { const p=data.replace('cmt_','').split('_'); return browse.showComments(ctx,p[0],p[1],p[2],p[3],p[4],p[5],p[6]); }
    if (data.startsWith('add_cmt_')) {
      const p=data.replace('add_cmt_','').split('_');
      await global.setState(ctx.uid, {type:'add_comment',fid:p[0],spId:p[1],yrId:p[2],smId:p[3],sbId:p[4],catId:p[5]});
      return ctx.reply('✍️ اكتب تعليقك:\n_(أو /cancel)_',{parse_mode:'Markdown'});
    }
    if (data.startsWith('dcmt_')) {
      const p=data.replace('dcmt_','').split('_');
      await commentsDb.deleteCommentAdmin(p[0]);
      await ctx.answerCbQuery('✅ تم الحذف').catch(()=>{});
      return browse.showComments(ctx,p[1],p[2],p[3],p[4],p[5],p[6],p[7]);
    }

    // Search delete
    if (data.startsWith('search_del_')) {
      if (!ctx.isAdmin) return ctx.answerCbQuery('ليس لديك صلاحية', {show_alert:true});
      const parts = data.replace('search_del_','').split('|');
      const fid = parts[0];
      const query = decodeURIComponent(parts[1]||'');
      await filesDb.softDelete(fid);
      await ctx.answerCbQuery('تم الحذف').catch(()=>{});
      return userH.handleSearch(ctx, query);
    }

    // Template type
    if(data.startsWith('mg_ttype_')){
      const firstUnderscore=data.indexOf('_',9);
      const ttype=data.substring(9,firstUnderscore);
      const name=decodeURIComponent(data.substring(firstUnderscore+1));
      if(ttype==='text'){
        global.setState(ctx.uid, {type:'mg_tpl_content',name,tplType:'text',fileId:''});
        return ctx.reply('اكتب محتوى الرسالة:');
      } else if(ttype==='link'){
        global.setState(ctx.uid, {type:'mg_tpl_content',name,tplType:'link',fileId:''});
        return ctx.reply('اكتب الرابط:');
      } else {
        global.setState(ctx.uid, {type:'mg_tpl_file',name,tplType:ttype,fileId:''});
        return ctx.reply('ابعث الملف او الصورة:');
      }
    }

    // Admin manage - آخر شي لأنها الأكثر تعقيداً
    if (data.startsWith('mg_')) {
      if (!ctx.isAdmin) return ctx.answerCbQuery('🚫 ليس لديك صلاحية.', { show_alert:true });
      return manage.handleCallback(ctx, data);
    }

  } catch(e) {
    console.error('CB error:', e.message, 'data:', data);
    ctx.reply('⚠️ خطأ. يرجى المحاولة مجدداً.').catch(()=>{});
  }
});
const mediaGroups = {};
bot.on('message', async (ctx, next) => {
  const uid = ctx.uid;
  const state = global.userStates?.[uid];
  if(state?.type !== 'mg_bundle_files') return next();
  const msg = ctx.message;
  const mgId = msg.media_group_id;
  if(!mgId) return next();
  if(!mediaGroups[mgId]) { mediaGroups[mgId] = []; setTimeout(async()=>{ delete mediaGroups[mgId]; },3000); }
  mediaGroups[mgId].push(msg);
  if(mediaGroups[mgId].length===1){
    setTimeout(async()=>{
      const msgs = mediaGroups[mgId]||[];
      let count=0;
      for(const m of msgs){
        let fid,ftype,title='';
        if(m.document){fid=m.document.file_id;ftype='document';title=m.document.file_name||'';}
        else if(m.photo){fid=m.photo[m.photo.length-1].file_id;ftype='photo';}
        else if(m.video){fid=m.video.file_id;ftype='document';}
        else continue;
        await bundlesDb.addBundleFile(state.bundleId,fid,ftype,title);
        count++;
      }
      state.fileCount=(state.fileCount||0)+count;
      await ctx.reply(count+' ملف تم الحفظ. المجموع: '+state.fileCount+'. ابعث المزيد أو /done');
    },1500);
  }
});

bot.on('document', async ctx => {
  if (!ctx.isAdmin && !ctx.isOwner) return;
  const state = global.userStates?.[ctx.uid];
  if (state?.type === 'mg_tpl_file') {
    const fid = ctx.message.document.file_id;
    global.setState(ctx.uid, {...state, type:'mg_tpl_content', fileId:fid});
    return ctx.reply('اكتب نص الرسالة مع الملف (او skip):');
  }
  if (state?.type === 'mg_awaiting_restore' && ctx.isOwner) {
    global.delState(ctx.uid);
    try {
      const link = await ctx.telegram.getFileLink(ctx.message.document.file_id);
      const https = require('https');
      const dest = path.join(__dirname, 'study_bot.db');
      const file = fs.createWriteStream(dest);
      https.get(link.href, res => { res.pipe(file); file.on('finish', () => { file.close(); ctx.reply('✅ تمت الاستعادة!'); }); });
    } catch(e) { ctx.reply('❌ فشلت الاستعادة: '+e.message); }
    return;
  }
  if (state?.type === 'mg_file') return manage.handleFileUpload(ctx);
});

bot.on(['photo','video','audio','voice'], async ctx => {
  if (!ctx.isAdmin && !ctx.isOwner) return;
  const state = global.userStates?.[ctx.uid];
  if (state?.type === 'mg_file') return manage.handleFileUpload(ctx);
  if (state?.type === 'mg_tpl_content') return manage.handleText(ctx, state);
});

bot.on('text', async ctx => {
  if (ctx.message.text.startsWith('/')) return;
  const uid = ctx.uid;
  const state = global.userStates?.[uid];
  if (!state) return;
  if (state.type === 'mg_file') return manage.handleFileUpload(ctx);
  if (state.type === 'mg_tpl_link') {
    const url = ctx.message.text.trim();
    global.setState(ctx.uid, {...state, type:'mg_tpl_content', fileId:url});
    return ctx.reply('اكتب نص الرسالة مع الرابط (او skip):');
  }
  if (state.type === 'search') return userH.handleSearch(ctx, ctx.message.text.trim());
  if (state.type === 'add_comment') {
    const text = ctx.message.text?.trim();
    if (!text || text === '/cancel') { await global.delState(ctx.uid); return ctx.reply('❌ تم الإلغاء.'); }
    if (text.length > 500) return ctx.reply('⚠️ التعليق طويل جداً. الحد 500 حرف.');
    await commentsDb.addComment(state.fid, ctx.uid, text);
    await global.delState(ctx.uid);
    await ctx.reply('✅ تم إضافة تعليقك!');
    return browse.showComments(ctx, state.fid, state.spId, state.yrId, state.smId, state.sbId, state.catId);
  }
  if (state.type?.startsWith('mg_') && ctx.isAdmin) return manage.handleText(ctx, state);
});

// Auto-leave groups
bot.on('my_chat_member', async ctx => {
  const chat = ctx.myChatMember.chat;
  if(chat.type !== 'private') {
    try {
      await dbRun('INSERT INTO group_chats(chat_id,title) VALUES(?,?) ON CONFLICT(chat_id) DO NOTHING', [chat.id, chat.title||'']);
      await ctx.telegram.leaveChat(chat.id);
    } catch(e) {}
  }
});

bot.on('message', async ctx => {
  if(ctx.chat?.type !== 'private') {
    try { await ctx.telegram.leaveChat(ctx.chat.id); } catch(e) {}
    return;
  }
});

async function launch() {
  try {
    await initSchema();
    await Promise.all([loadMaintenance(), loadStates()]);
    await cacheWarmup();
    await precomputeAll();
    console.log('✅ Database ready');
    startScheduler(bot, [OWNER_ID]);

    const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://lwss-production.up.railway.app';
    const PORT = process.env.PORT || 3000;

    // Express health check
    app.get('/', (req,res) => res.send('OK'));
    app.use(bot.webhookCallback("/webhook/"+TOKEN));
    app.listen(PORT, () => console.log('✅ Express on port '+PORT));

    await bot.telegram.setWebhook(WEBHOOK_URL+"/webhook/"+TOKEN, { allowed_updates:["message","callback_query"], drop_pending_updates:true });

    console.log('🚀 Study Bot Pro v3.1 is running!');
  } catch(e) {
    console.error('Launch error:', e.message);
    setTimeout(launch, 10000);
  }
}

launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
process.on('uncaughtException', err => console.error('Uncaught:', err.message));
process.on('unhandledRejection', err => console.error('Unhandled:', err?.message||err));

setInterval(() => {
  const mem = process.memoryUsage().heapUsed / 1024 / 1024;
  if(mem > 400) { console.error('Memory too high:', mem.toFixed(0)+'MB'); process.exit(1); }
}, 60000);
