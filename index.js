require("dotenv").config();
const { Telegraf } = require('telegraf');
const { initSchema, getSetting } = require("./database/db");
const { authMiddleware, isOwner, OWNER_ID } = require('./middlewares/auth');
const interactions = require('./database/interactions');
const startHandler = require('./handlers/start');
const browse = require('./handlers/browse');
const commentsDb = require('./database/comments');
const userH = require('./handlers/user');
const manage = require('./handlers/manage');
const { startScheduler } = require('./utils/scheduler');
const { setLang } = require('./utils/i18n');
const path = require('path');
const fs = require('fs');

const TOKEN = process.env.BOT_TOKEN;
global.userStates = {};
global.maintenanceMode = false;
// Load maintenance mode from DB
async function loadMaintenance() {
  try {
    const { getSetting } = require('./database/db');
    const val = await getSetting('maintenance');
    global.maintenanceMode = val === 'true';
    console.log('🔧 Maintenance mode:', global.maintenanceMode);
  } catch(e) {}
}

// Load states from DB
async function loadStates() {
  try {
    const { all } = require('./database/db');
    const rows = await all('SELECT user_id, state FROM user_states');
    for(const r of rows) {
      try { global.userStates[r.user_id] = JSON.parse(r.state); } catch {}
    }
    console.log('✅ States loaded:', rows.length);
  } catch(e) { console.error('States load error:', e.message); }
}

// Save state to DB
global.setState = async function(uid, state) {
  global.userStates[uid] = state;
  try {
    const { run } = require('./database/db');
    await run('INSERT INTO user_states(user_id,state,updated_at) VALUES(?,?,NOW()) ON CONFLICT(user_id) DO UPDATE SET state=EXCLUDED.state,updated_at=NOW()', [uid, JSON.stringify(state)]);
  } catch(e) {}
};

// Delete state from DB
global.delState = async function(uid) {
  delete global.userStates[uid];
  try {
    const { run } = require('./database/db');
    await run('DELETE FROM user_states WHERE user_id=?', [uid]);
  } catch(e) {}
};

// Cleanup old states every hour
setInterval(async () => {
  try {
    const { run } = require('./database/db');
    await run(`DELETE FROM user_states WHERE updated_at < NOW() - INTERVAL '1 hour'`);
    const now = Date.now();
    for(const uid in global.userStates){
      if(global.userStates[uid]?._ts && now - global.userStates[uid]._ts > 3600000) global.delState(uid);
    }
  } catch(e) {}
}, 3600000);
global.maintenanceMsg = 'البوت تحت الصيانة. يرجى الانتظار!';

const bot = new Telegraf(TOKEN);
bot.use(authMiddleware);

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
  const { all } = require('./database/db');
  const chats = await all('SELECT chat_id FROM group_chats');
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
    const perms = await require('./database/admins').getPerms(ctx.uid);
    if(!perms.includes('full') && !perms.includes('view_users')) return ctx.reply('🚫 ليس لديك صلاحية.');
  }
  return manage.showUsers(ctx);
});

bot.command('help', ctx => ctx.reply(
  '📚 *أوامر البوت*\n\n/start — القائمة الرئيسية\n/search — البحث\n/profile — ملفك الشخصي\n/stats — الإحصائيات\n/cancel — إلغاء العملية الحالية\n\n👑 للمشرفين:\n/admin — لوحة الإدارة',
  { parse_mode: 'Markdown' }
));

bot.on('callback_query', async ctx => {
  const data = ctx.callbackQuery.data;
  try {
    await ctx.answerCbQuery().catch(()=>{});
    if (data === 'noop') return;
    if (data === 'main_menu') return startHandler(ctx);
    if (data === 'browse') return browse.showSpecs(ctx);
    if (data.startsWith('set_sp_')) {
      const spId = data.replace('set_sp_','');
      await require('./database/users').setSpecialty(ctx.uid, spId);
      await ctx.answerCbQuery('تم حفظ تخصصك').catch(()=>{});
      return require('./handlers/start').showMainMenu(ctx);
    }
    if (data === 'skip_sp') {
      await require('./database/users').setSpecialty(ctx.uid, 0);
      return require('./handlers/start').showMainMenu(ctx);
    }
    if (data === 'change_sp') {
      const specs = await require('./database/content').getSpecs();
      const rows = specs.map(s => [require('./utils/keyboard').btn('🎓 ' + s.name, 'set_sp_' + s.id)]);
      return ctx.reply('🎓 اختر تخصصك:', {parse_mode:'Markdown', ...require('./utils/keyboard').build(rows)});
    }
    if (data === 'latest') return userH.showLatest(ctx);
    if (data === 'new_in_sp') return userH.showNewInSpecialty(ctx);
    if (data === 'recommended') return userH.showRecommended(ctx);
    if (data === 'favorites') return userH.showFavorites(ctx);
    if (data === 'history') return userH.showHistory(ctx);
    if (data === 'profile') return userH.showProfile(ctx);
    if (data === 'stats') return userH.showStats(ctx);
    if (data === 'search_prompt') { global.setState(ctx.uid, {type:'search'}); return ctx.reply('🔍 اكتب كلمة البحث:'); }
    if (data.startsWith('lang_')) { setLang(ctx.uid, data.replace('lang_','')); return userH.showProfile(ctx); }
    if (data.startsWith('sp_')) return browse.showYears(ctx, data.replace('sp_',''));
    if (data.startsWith('yrs_')) { const p=data.replace('yrs_','').split('_'); return browse.showYears(ctx,p[0]); }
    if (data.startsWith('yr_page_')) { const p=data.replace('yr_page_','').split('_'); return browse.showYears(ctx,p[0],parseInt(p[1])); }
    if (data.startsWith('yr_')) { const p=data.split('_'); return browse.showSemesters(ctx,p[1],p[2]); }
    if (data.startsWith('sms_')) { const p=data.replace('sms_','').split('_'); return browse.showSemesters(ctx,p[0],p[1]); }
    if (data.startsWith('sm_')) { const p=data.split('_'); return browse.showSubjects(ctx,p[1],p[2],p[3]); }
    if (data.startsWith('sb_page_')) { const p=data.replace('sb_page_','').split('_'); return browse.showSubjects(ctx,p[0],p[1],p[2],parseInt(p[3])); }
    if (data.startsWith('sbs_')) { const p=data.replace('sbs_','').split('_'); return browse.showSubjects(ctx,p[0],p[1],p[2]); }
    if (data.startsWith('sb_')) { const p=data.split('_'); return browse.showCategories(ctx,p[1],p[2],p[3],p[4]); }
    if (data.startsWith('ct_page_')) { const p=data.replace('ct_page_','').split('_'); return browse.showFiles(ctx,p[0],p[1],p[2],p[3],p[4],parseInt(p[5])); }
    if (data.startsWith('ct_')) { const p=data.split('_'); return browse.showFiles(ctx,p[1],p[2],p[3],p[4],p[5]); }
    if (data.startsWith('bundle_')) { const p=data.split('_'); return browse.showBundle(ctx,p[1],p[2],p[3],p[4],p[5],p[6]); }
    if (data.startsWith('bdl_')) { const p=data.split('_'); return browse.sendBundle(ctx,p[1],p[2],p[3],p[4],p[5],p[6]); }
    if (data.startsWith('preview_')) { const p=data.split('_'); return browse.showPreview(ctx,p[1],p[2],p[3],p[4],p[5],p[6]); }
    if (data.startsWith('fl_')) { const p=data.split('_'); return browse.sendFile(ctx,p[1],p[2],p[3],p[4],p[5],p[6]); }
    if (data.startsWith('rate_')) {
      const p=data.replace('rate_','').split('_');
      const fid=p[0]; const rating=parseInt(p[1]);
      const spId=p[2]; const yrId=p[3]; const smId=p[4]; const sbId=p[5]; const catId=p[6];
      await interactions.addRating(ctx.uid,fid,rating);
      await ctx.answerCbQuery('⭐ تم تقييم الملف بـ '+rating+'/5!');
      return browse.showPreview(ctx,fid,spId,yrId,smId,sbId,catId);
    }
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
    if (data.startsWith('search_del_')) {
      if (!ctx.isAdmin) return ctx.answerCbQuery('ليس لديك صلاحية', {show_alert:true});
      const parts = data.replace('search_del_','').split('_');
      const fid = parts[0];
      const query = decodeURIComponent(parts.slice(1).join('_'));
      await require('./database/files').softDelete(fid);
      await ctx.answerCbQuery('تم الحذف').catch(()=>{});
      return userH.handleSearch(ctx, query);
    }
    if (data === 'progress') return userH.showProgress(ctx);
    if (data.startsWith('fav_')) return userH.toggleFav(ctx, data.replace('fav_',''));

    // ── COMMENTS ──
    if (data.startsWith('cmt_') && !data.startsWith('cmt_pg_')) {
      const p=data.replace('cmt_','').split('_');
      return browse.showComments(ctx,p[0],p[1],p[2],p[3],p[4],p[5],p[6]);
    }
    if (data.startsWith('cmt_pg_')) {
      const p=data.replace('cmt_pg_','').split('_');
      return browse.showComments(ctx,p[0],p[1],p[2],p[3],p[4],p[5],p[6],parseInt(p[7]));
    }
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
    if (data.startsWith('unfav_')) return userH.toggleFav(ctx, data.replace('unfav_',''), true);
    if (data.startsWith('mg_')) {
      if (!ctx.isAdmin) return ctx.answerCbQuery('🚫 ليس لديك صلاحية.', { show_alert:true });
      return manage.handleCallback(ctx, data);
    }
  } catch(e) {
    console.error('CB error:', e.message, 'data:', data);
    ctx.reply('⚠️ خطأ. يرجى المحاولة مجدداً.').catch(()=>{});
  }
});

// Handle media groups (multiple files at once)
const mediaGroups = {};
bot.on('message', async (ctx, next) => {
  const uid = ctx.uid;
  const state = global.userStates?.[uid];
  if(state?.type !== 'mg_bundle_files') return next();
  const msg = ctx.message;
  const mgId = msg.media_group_id;
  if(!mgId) return next();
  // Collect media group files
  if(!mediaGroups[mgId]) { mediaGroups[mgId] = []; setTimeout(async()=>{ delete mediaGroups[mgId]; },3000); }
  mediaGroups[mgId].push(msg);
  if(mediaGroups[mgId].length===1){
    setTimeout(async()=>{
      const msgs = mediaGroups[mgId]||[];
      const bundlesDb = require('./database/bundles');
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
      https.get(link.href, res => { res.pipe(file); file.on('finish', () => { file.close(); ctx.reply('✅ تمت الاستعادة!', {parse_mode:'Markdown'}); }); });
    } catch(e) { ctx.reply('❌ فشلت الاستعادة: '+e.message); }
    return;
  }
  if (state?.type === 'mg_file') return manage.handleFileUpload(ctx);
});

bot.on('photo', async ctx => {
  if (!ctx.isAdmin && !ctx.isOwner) return;
  if (global.userStates?.[ctx.uid]?.type === 'mg_file') return manage.handleFileUpload(ctx);
});

bot.on('video', async ctx => {
  if (!ctx.isAdmin && !ctx.isOwner) return;
  if (global.userStates?.[ctx.uid]?.type === 'mg_file') return manage.handleFileUpload(ctx);
});

bot.on('audio', async ctx => {
  if (!ctx.isAdmin && !ctx.isOwner) return;
  if (global.userStates?.[ctx.uid]?.type === 'mg_file') return manage.handleFileUpload(ctx);
});

bot.on('voice', async ctx => {
  if (!ctx.isAdmin && !ctx.isOwner) return;
  if (global.userStates?.[ctx.uid]?.type === 'mg_file') return manage.handleFileUpload(ctx);
});

bot.on('text', async ctx => {
  if (ctx.message.text.startsWith('/')) return;
  const uid = ctx.uid; const state = global.userStates?.[uid]; if (!state) return;
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

async function launch() {
  try {
    await initSchema();
    await loadMaintenance();
    await loadStates();
    const { cacheWarmup } = require('./utils/cache');
    await cacheWarmup();
    const m = await getSetting('maintenance');
    if (m === 'true') global.maintenanceMode = true;
    console.log('✅ Database ready');
    startScheduler(bot, [OWNER_ID]);
    await bot.launch({
      allowedUpdates: ['message', 'callback_query'],
      dropPendingUpdates: true,
    });
    console.log('🚀 Study Bot Pro v3.0 is running!');
  } catch(e) {
    console.error('Launch error:', e.message);
    console.log('Retrying in 10 seconds...');
    setTimeout(launch, 10000);
  }
}

launch();
// Auto-leave any group/channel
bot.on('my_chat_member', async ctx => {
  const chat = ctx.myChatMember.chat;
  if(chat.type !== 'private') {
    try {
      const { run } = require('./database/db');
      await run('INSERT OR IGNORE INTO group_chats(chat_id,title) VALUES(?,?)', [chat.id, chat.title||'']);
      await ctx.telegram.leaveChat(chat.id);
      console.log('Left chat:', chat.id, chat.title||'');
    } catch(e) {}
  }
});

bot.on('message', async ctx => {
  if(ctx.chat?.type !== 'private') {
    try { await ctx.telegram.leaveChat(ctx.chat.id); } catch(e) {}
    return;
  }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err?.message||err);
});

// Auto restart on memory leak (>200MB)
setInterval(() => {
  const mem = process.memoryUsage().heapUsed / 1024 / 1024;
  if(mem > 200) {
    console.error('Memory too high:', mem.toFixed(0)+'MB - restarting');
    process.exit(1);
  }
}, 60000);
