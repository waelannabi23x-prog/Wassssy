require("dotenv").config();
const logger = require('./utils/logger');
const https = require('https');
const path = require('path');
const fs = require('fs');
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
const { eos } = require('./utils/helpers');
const { handleAiChat, resetChat } = require('./handlers/ai_chat');
const tools = require('./handlers/owner_tools');
const { handleOwnerAI } = require('./handlers/ai_owner');
const { cacheWarmup } = require('./utils/cache');
const { setLang } = require('./utils/i18n');
const { startSmartWarmup } = require('./utils/smartWarmup');
const { smartSearch } = require('./handlers/group'); // 🛡️ إزالة التكرار - مصدر وحيد للبحث

const TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://lwss-production.up.railway.app';
const PORT = process.env.PORT || 3000;

// ── Express Setup ──
const express = require('express');
const app = express();
try { app.use(require('compression')({ level: 6, threshold: 512 })); } catch(e) {}
app.use(express.json({ limit: '1mb' }));

// ── Global State ──
global.userStates = {};
global.maintenanceMode = false;
global.maintenanceMsg = 'البوت تحت الصيانة. يرجى الانتظار!';

async function loadMaintenance() {
  try { global.maintenanceMode = (await getSetting('maintenance')) === 'true'; } catch(e) {}
}

async function loadStates() {
  try {
    const { loadAllStates } = require('./utils/redis');
    await loadAllStates();
  } catch(e) {}
}

// ── State Persistence (Redis + Memory + DB Fallback) ──
const { setState: redisSetState, delState: redisDelState } = require('./utils/redis');

global.setState = async (uid, state) => {
  global.userStates[uid] = state;
  await redisSetState(uid, state);
};

global.delState = async (uid) => {
  delete global.userStates[uid];
  await redisDelState(uid);
};

// ── Group Members Smart Buffering (تخفيف الضغط عن DB بنسبة 99%) ──
const _grpMemBuffer = new Map();
function bufferGroupMember(chatId, userId, username, firstName) {
  _grpMemBuffer.set(`${chatId}_${userId}`, { chatId, userId, username: username||'', firstName: firstName||'' });
  if (_grpMemBuffer.size > 1000) flushGroupMembers();
}

async function flushGroupMembers() {
  if (!_grpMemBuffer.size) return;
  const entries = [..._grpMemBuffer.values()];
  _grpMemBuffer.clear();
  // 🛡️ إرسال 1000 عضو في استعلام واحد فقط!
  const ph = entries.map((_, i) => `($${i*4+1}, $${i*4+2}, $${i*4+3}, $${i*4+4}, CURRENT_TIMESTAMP)`).join(',');
  try {
    await dbRun(
      `INSERT INTO group_members(chat_id, user_id, username, first_name, updated_at) VALUES ${ph} 
       ON CONFLICT(chat_id, user_id) DO UPDATE SET username=EXCLUDED.username, first_name=EXCLUDED.first_name, updated_at=CURRENT_TIMESTAMP`,
      entries.flatMap(e => [e.chatId, e.userId, e.username, e.firstName])
    );
  } catch(e) {}
}
setInterval(flushGroupMembers, 15000); // تصريف كل 15 ثانية فقط

// ── Rate Limiter & Dedup Guards ──
const _rl = new Map();
function checkRL(uid) {
  const now = Date.now(), d = _rl.get(uid) || { count: 0, reset: now + 10000 };
  if (now > d.reset) { d.count = 1; d.reset = now + 10000; } else d.count++;
  _rl.set(uid, d); return d.count <= 20;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of _rl) if (now > v.reset + 5000) _rl.delete(k); }, 30000);

const _cbSeen = new Map();
function isDupeCB(cbId) {
  if (_cbSeen.has(cbId)) return true;
  _cbSeen.set(cbId, Date.now());
  if (_cbSeen.size > 200) { const cutoff = Date.now() - 15000; for (const [k, v] of _cbSeen) if (v < cutoff) _cbSeen.delete(k); }
  return false;
}

const _inFlight = new Map();
function dedupRequest(uid, key, fn) {
  const k = uid+'_'+key;
  if (_inFlight.has(k)) return _inFlight.get(k);
  const p = fn().finally(() => _inFlight.delete(k));
  _inFlight.set(k, p); return p;
}
global.dedupRequest = dedupRequest;

// ── Bot Init ──
const bot = new Telegraf(TOKEN, { handlerTimeout: 90000 });

// ── Middlewares ──
bot.use(async (ctx, next) => {
  if(ctx.chat?.type !== 'private') {
    if(ctx.callbackQuery) return next();
    const text = ctx.message?.text || '';
    if(ctx.message && !text.startsWith('/search') && !text.startsWith('/setsp') && !text.startsWith('/dlt')) {
      return ctx.deleteMessage().catch(()=>{});
    }
  }
  return next();
});

bot.use(authMiddleware);
bot.use(async (ctx, next) => {
  if (ctx.from && !checkRL(ctx.from.id)) {
    return ctx.callbackQuery ? ctx.answerCbQuery("⏳ بطيء قليلاً!", { show_alert: false }).catch(() => {}) : ctx.reply("⏳ بطيء قليلاً!").catch(() => {});
  }
  return next();
});

bot.catch((err, ctx) => { logger.error('Bot error:', err.message); ctx.reply?.('⚠️ حدث خطأ.').catch(() => {}); });

// ── Commands ──
bot.command('start', async ctx => { if(startHandler.clearAiMode) await startHandler.clearAiMode(ctx.uid); return startHandler(ctx); });
bot.command(['admin', 'owner', 'manage'], ctx => { if (!ctx.isAdmin) return ctx.reply('🚫 ليس لديك صلاحية.'); return manage.mainMenu(ctx); });

bot.command('setsp', async ctx => {
  if(ctx.chat?.type === 'private') return ctx.reply('هذا الأمر للقروبات فقط');
  if(!ctx.isOwner && !ctx.isAdmin) return ctx.deleteMessage().catch(()=>{});
  ctx.deleteMessage().catch(()=>{});
  const specs = await dbAll('SELECT id,name FROM specialties WHERE is_deleted=0 ORDER BY id');
  return ctx.reply('اختر تخصص القروب:', {reply_markup:{inline_keyboard: specs.map(s=>[{text:'🎓 '+s.name, callback_data:'grp_sp_'+ctx.chat.id+'_'+s.id}])}});
});

bot.command('search', async ctx => {
  const isGroup = ctx.chat?.type !== 'private';
  const raw = ctx.message.text.replace('/search','').replace(/@\w+/g,'').trim();

  if(isGroup) {
    ctx.deleteMessage().catch(()=>{});
    if(!raw || raw.length < 2) { const m = await ctx.reply('🔍 مثال: /search algo serie 1'); return setTimeout(()=>ctx.deleteMessage(m.message_id).catch(()=>{}), 6000); }
    const results = await smartSearch(raw, 10);
    if(!results.length) { const m = await ctx.reply('❌ لا نتائج لـ "'+raw+'"'); return setTimeout(()=>ctx.deleteMessage(m.message_id).catch(()=>{}), 8000); }
    
    let botUsername = global._cachedBotUsername;
    if(!botUsername) { const me = await ctx.telegram.getMe(); botUsername = me.username; global._cachedBotUsername = botUsername; }
    
    const rows = results.map(f => {
      const label = '📄 '+f.title.substring(0,32)+' · '+f.sub_name;
      return ctx.isOwner ? [{ text: label, callback_data: 'grp_dl_'+f.id }] : [{ text: label, url: 'https://t.me/'+botUsername+'?start=file_'+f.id }];
    });
    if(!ctx.isOwner) rows.push([{text:'🤖 فتح البوت', url:'https://t.me/'+botUsername}]);

    const m = await ctx.reply('🔍 "'+raw+'" — '+results.length+' نتيجة\nاضغط للتحميل في الخاص 👇', {reply_markup:{inline_keyboard:rows}});
    if(!global._botMsgs) global._botMsgs = {};
    if(!global._botMsgs[ctx.chat.id]) global._botMsgs[ctx.chat.id] = [];
    global._botMsgs[ctx.chat.id].push(m.message_id);
    if(global._botMsgs[ctx.chat.id].length > 50) global._botMsgs[ctx.chat.id].shift();
    return setTimeout(()=>ctx.deleteMessage(m.message_id).catch(()=>{}), 60000);
  }
  if(raw) return userH.handleSearch(ctx, raw);
  global.setState(ctx.uid, {type:'search'});
  return ctx.reply('🔍 اكتب كلمة البحث:');
});

bot.command('profile', ctx => userH.showProfile(ctx));
bot.command('stats', ctx => userH.showStats(ctx));
bot.command('done', async ctx => {
  const state = global.userStates?.[ctx.uid]; if (!state) return;
  if (state.type === 'mg_bundle_files') { global.delState(ctx.uid); return ctx.reply('تم حفظ الحزمة بـ ' + (state.fileCount || 0) + ' ملف'); }
  if (state.type === 'mg_bulk_files') {
    const uploaded = state.uploaded||[], failed = state.failed||[];
    global.delState(ctx.uid);
    const {cacheClearPrefix} = require('./utils/cache'); cacheClearPrefix('files_cat_'+state.catId); cacheClearPrefix('showfiles_'+state.catId);
    let msg = 'تم الرفع: '+uploaded.length+' ملف'; if(failed.length) msg += ' | فشل: '+failed.length;
    if(uploaded.length) msg += '\n' + uploaded.map(t=>'+ '+t).join('\n');
    if(failed.length) msg += '\n' + failed.map(t=>'x '+t).join('\n');
    return ctx.reply(msg, {...kbBuild([[kbBtn('عرض الملفات','mg_fls_'+state.spId+'_'+state.yrId+'_'+state.smId+'_'+state.sbId+'_'+state.catId)]])});
  }
});
bot.command('mygroups', tools.listGroups);
bot.command('leavegroup', tools.leaveGroup);
bot.command('leaveall', async ctx => { if (!ctx.isOwner) return ctx.reply('🚫 ليس لديك صلاحية.'); const chats = await dbAll('SELECT chat_id FROM group_chats'); let left = 0; for (const ch of chats) { try { await ctx.telegram.leaveChat(ch.chat_id); left++; } catch(e) {} } return ctx.reply('✅ خرجت من ' + left + ' قروب.'); });
bot.command('dlt', async ctx => {
  if(!ctx.isOwner) return ctx.deleteMessage().catch(()=>{});
  if(ctx.chat?.type === 'private') return ctx.reply('هذا الأمر للقروبات فقط');
  ctx.deleteMessage().catch(()=>{});
  const dbMsgs = await dbAll('SELECT message_id FROM group_bot_msgs WHERE chat_id=$1 ORDER BY sent_at DESC LIMIT 200',[ctx.chat.id]);
  const allIds = [...new Set([...dbMsgs.map(r => r.message_id), ...(global._botMsgs?.[ctx.chat.id] || [])])];
  let deleted = 0; for(const msgId of allIds) try { await ctx.telegram.deleteMessage(ctx.chat.id, msgId); deleted++; } catch(e) {}
  if(global._botMsgs) global._botMsgs[ctx.chat.id] = [];
  dbRun('DELETE FROM group_bot_msgs WHERE chat_id=$1',[ctx.chat.id]).catch(()=>{});
  const m = await ctx.reply('✅ حُذف '+deleted+' رسالة'); return setTimeout(()=>ctx.deleteMessage(m.message_id).catch(()=>{}), 3000);
});
bot.command('ai', async ctx => { await global.setState(ctx.uid, { type: 'ai_mode' }); return ctx.reply('🤖 وضع المساعد الذكي مفعل!\n\nاكتب أي سؤال وسأجاوبك.\nاكتب /start للرجوع للقائمة الرئيسية.'); });
bot.command('reset', ctx => { resetChat(ctx.uid); return ctx.reply('🔄 تم مسح سياق المحادثة.'); });
bot.command('promote', tools.batchPromote);
bot.command('cancel', ctx => { if (global.userStates?.[ctx.uid]) { global.delState(ctx.uid); return ctx.reply('❌ تم الإلغاء.'); } });
bot.command('users', async ctx => { if (!ctx.isOwner && !ctx.isAdmin) return ctx.reply('🚫 ليس لديك صلاحية.'); if (ctx.isAdmin && !ctx.isOwner) { const perms = await adminsDb.getPerms(ctx.uid); if (!perms.includes('full') && !perms.includes('view_users')) return ctx.reply('🚫 ليس لديك صلاحية.'); } return manage.showUsers(ctx); });
bot.command('help', ctx => ctx.reply('📚 *أوامر البوت*\n\n/start — القائمة الرئيسية\n/search — البحث\n/profile — ملفك الشخصي\n/stats — الإحصائيات\n/cancel — إلغاء العملية الحالية\n\n👑 للمشرفين:\n/admin — لوحة الإدارة', { parse_mode: 'Markdown' }));

// ── Enterprise Callback Router (O(1) Routing) ──
const exactCbRoutes = new Map([
  ['noop', () => {}],
  ['main_menu', (ctx) => startHandler(ctx)],
  ['browse', (ctx) => browse.showSpecs(ctx)],
  ['skip_sp', async (ctx) => { await usersDb.setSpecialty(ctx.uid, 0); return startHandler.showMainMenu(ctx); }],
  ['change_sp', async (ctx) => { const specs = await contentDb.getSpecs(); return eos(ctx, '🎓 *اختر تخصصك:*', { parse_mode: 'Markdown', ...kbBuild(specs.map(s => [kbBtn('🎓 ' + s.name, 'set_sp_' + s.id)])) }); }],
  ['latest', (ctx) => userH.showLatest(ctx)],
  ['new_in_sp', (ctx) => userH.showNewInSpecialty(ctx)],
  ['recommended', (ctx) => userH.showRecommended(ctx)],
  ['favorites', (ctx) => userH.showFavorites(ctx)],
  ['history', (ctx) => userH.showHistory(ctx)],
  ['profile', (ctx) => userH.showProfile(ctx)],
  ['stats', (ctx) => userH.showStats(ctx)],
  ['progress', (ctx) => userH.showProgress(ctx)],
  ['search_prompt', (ctx) => { global.setState(ctx.uid, { type: 'search' }); return ctx.reply('🔍 اكتب كلمة البحث:'); }],
  ['ai_prompt', (ctx) => { global.setState(ctx.uid, { type: 'ai_mode' }); return ctx.reply('🤖 المساعد الذكي مفعل!\n\nاكتب سؤالك وسأجاوبك:'); }],
]);

const prefixCbRoutes = [
  { p: 'grp_sp_', fn: async (ctx, d) => {
    if (!ctx.isOwner) return ctx.answerCbQuery('🚫 للمالك فقط', {show_alert:true}).catch(()=>{});
    const raw = d.substring(7); const i = raw.lastIndexOf('_'); const chatId = parseInt(raw.substring(0, i)); const specId = parseInt(raw.substring(i + 1));
    try {
      await dbRun('INSERT INTO group_chats(chat_id,specialty_id) VALUES($1,$2) ON CONFLICT(chat_id) DO UPDATE SET specialty_id=$2',[chatId,specId]);
      const specs = await dbAll('SELECT name FROM specialties WHERE id=$1',[specId]);
      await ctx.answerCbQuery('✅ ' + (specs[0]?.name||specId), {show_alert:false}).catch(()=>{});
      await ctx.telegram.editMessageText(chatId, ctx.callbackQuery.message.message_id, null, '✅ تخصص القروب: 🎓 ' + (specs[0]?.name||specId)).catch(()=>{});
    } catch(e) { await ctx.answerCbQuery('❌ ' + e.message, {show_alert:true}).catch(()=>{}); }
  }},
  { p: 'grp_dl_', fn: async (ctx, d) => {
    if (!ctx.isOwner) return ctx.answerCbQuery('🚫').catch(()=>{});
    const f = await filesDb.getFile(d.substring(7));
    if (!f) return ctx.answerCbQuery('❌ الملف غير موجود').catch(()=>{});
    try {
      const cap = '📄 '+f.title+(f.sub_name?'\n📚 '+f.sub_name:'');
      let sentMsg = f.file_type === 'photo' ? await ctx.telegram.sendPhoto(ctx.chat.id, f.file_id, {caption:cap}) : f.file_type === 'link' ? await ctx.telegram.sendMessage(ctx.chat.id, cap+'\n🔗 '+f.file_id) : await ctx.telegram.sendDocument(ctx.chat.id, f.file_id, {caption:cap});
      if(sentMsg?.message_id) {
        if(!global._botMsgs) global._botMsgs = {}; if(!global._botMsgs[ctx.chat.id]) global._botMsgs[ctx.chat.id] = [];
        global._botMsgs[ctx.chat.id].push(sentMsg.message_id); if(global._botMsgs[ctx.chat.id].length > 500) global._botMsgs[ctx.chat.id].shift();
        dbRun('INSERT INTO group_bot_msgs(chat_id,message_id) VALUES($1,$2)',[ctx.chat.id, sentMsg.message_id]).catch(()=>{});
      }
      await ctx.answerCbQuery('✅ تم الإرسال').catch(()=>{});
    } catch(e) { await ctx.answerCbQuery('❌ '+e.message,{show_alert:true}).catch(()=>{}); }
  }},
  { p: 'preview_', fn: (ctx, d) => { const p = d.split('_'); return browse.showPreview(ctx, p[1], p[2], p[3], p[4], p[5], p[6]); } },
  { p: 'fl_', fn: (ctx, d) => { const p = d.split('_'); return browse.sendFile(ctx, p[1], p[2], p[3], p[4], p[5], p[6]); } },
  { p: 'ct_page_', fn: (ctx, d) => { const p = d.substring(8).split('_'); return browse.showFiles(ctx, p[0], p[1], p[2], p[3], p[4], parseInt(p[5])); } },
  { p: 'ct_', fn: (ctx, d) => { const p = d.split('_'); return browse.showFiles(ctx, p[1], p[2], p[3], p[4], p[5]); } },
  { p: 'bundle_', fn: (ctx, d) => { const p = d.split('_'); return browse.showBundle(ctx, p[1], p[2], p[3], p[4], p[5], p[6]); } },
  { p: 'bdl_', fn: (ctx, d) => { const p = d.split('_'); return browse.sendBundle(ctx, p[1], p[2], p[3], p[4], p[5], p[6]); } },
  { p: 'unfav_', fn: (ctx, d) => userH.toggleFav(ctx, d.substring(6), true) },
  { p: 'fav_', fn: (ctx, d) => userH.toggleFav(ctx, d.substring(4), false) },
  { p: 'set_sp_', fn: async (ctx, d) => { await usersDb.setSpecialty(ctx.uid, d.substring(7)); await ctx.answerCbQuery('تم حفظ تخصصك').catch(() => {}); return startHandler.showMainMenu(ctx); } },
  { p: 'lang_', fn: (ctx, d) => { setLang(ctx.uid, d.substring(5)); return userH.showProfile(ctx); } },
  { p: 'sp_', fn: (ctx, d) => browse.showYears(ctx, d.substring(3)) },
  { p: 'yr_page_', fn: (ctx, d) => { const p = d.substring(8).split('_'); return browse.showYears(ctx, p[0], parseInt(p[1])); } },
  { p: 'yr_', fn: (ctx, d) => { const p = d.split('_'); return browse.showSemesters(ctx, p[1], p[2]); } },
  { p: 'sms_', fn: (ctx, d) => { const p = d.substring(4).split('_'); return browse.showSemesters(ctx, p[0], p[1]); } },
  { p: 'sm_', fn: (ctx, d) => { const p = d.split('_'); return browse.showSubjects(ctx, p[1], p[2], p[3]); } },
  { p: 'sb_page_', fn: (ctx, d) => { const p = d.substring(8).split('_'); return browse.showSubjects(ctx, p[0], p[1], p[2], parseInt(p[3])); } },
  { p: 'sbs_', fn: (ctx, d) => { const p = d.substring(4).split('_'); return browse.showSubjects(ctx, p[0], p[1], p[2]); } },
  { p: 'sb_', fn: (ctx, d) => { const p = d.split('_'); return browse.showCategories(ctx, p[1], p[2], p[3], p[4]); } },
  { p: 'yrs_', fn: (ctx, d) => { const p = d.substring(4).split('_'); return browse.showYears(ctx, p[0]); } },
  { p: 'rate_', fn: async (ctx, d) => { const p = d.substring(5).split('_'); await interactions.addRating(ctx.uid, p[0], parseInt(p[1])); await ctx.answerCbQuery('⭐ تم التقييم!').catch(() => {}); return browse.showPreview(ctx, p[0], p[2], p[3], p[4], p[5], p[6]); } },
  { p: 'do_report_', fn: (ctx, d) => { const p = d.substring(10).split('_'); return browse.doReport(ctx, p[0], p[1], p[2], p[3], p[4], p[5], p[6]); } },
  { p: 'report_', fn: (ctx, d) => { const p = d.substring(7).split('_'); return browse.showReportMenu(ctx, p[0], p[1], p[2], p[3], p[4], p[5]); } },
  { p: 'cmt_pg_', fn: (ctx, d) => { const p = d.substring(7).split('_'); return browse.showComments(ctx, p[0], p[1], p[2], p[3], p[4], p[5], p[6], parseInt(p[7])); } },
  { p: 'cmt_', fn: (ctx, d) => { const p = d.substring(4).split('_'); return browse.showComments(ctx, p[0], p[1], p[2], p[3], p[4], p[5], p[6]); } },
  { p: 'add_cmt_', fn: async (ctx, d) => { const p = d.substring(9).split('_'); await global.setState(ctx.uid, { type: 'add_comment', fid: p[0], spId: p[1], yrId: p[2], smId: p[3], sbId: p[4], catId: p[5] }); return ctx.reply('✍️ اكتب تعليقك:\n_(أو /cancel)_', { parse_mode: 'Markdown' }); } },
  { p: 'dcmt_', fn: async (ctx, d) => { const p = d.substring(5).split('_'); await commentsDb.deleteCommentAdmin(p[0]); await ctx.answerCbQuery('✅ تم الحذف').catch(() => {}); return browse.showComments(ctx, p[1], p[2], p[3], p[4], p[5], p[6], p[7]); } },
  { p: 'search_del_', fn: async (ctx, d) => {
    if (!ctx.isAdmin) return ctx.answerCbQuery('ليس لديك صلاحية', { show_alert: true });
    const parts = d.substring(11).split('|'); const fid = parts[0]; const query = decodeURIComponent(parts[1] || '');
    await filesDb.softDelete(fid); const {cacheClearPrefix} = require('./utils/cache'); cacheClearPrefix('search_'); if(global._clearSearchCache) global._clearSearchCache();
    await ctx.answerCbQuery('✅ تم الحذف').catch(() => {}); return userH.handleSearch(ctx, query);
  }},
  { p: 'mg_ttype_', fn: async (ctx, d) => {
    const i = d.indexOf('_', 9); const ttype = d.substring(9, i); const name = decodeURIComponent(d.substring(i + 1));
    if (ttype === 'text' || ttype === 'link') { global.setState(ctx.uid, { type: 'mg_tpl_content', name, tplType: ttype, fileId: '' }); return ctx.reply(ttype === 'link' ? 'اكتب الرابط:' : 'اكتب محتوى الرسالة:'); }
    global.setState(ctx.uid, { type: 'mg_tpl_file', name, tplType: ttype, fileId: '' }); return ctx.reply('ابعث الملف او الصورة:');
  }},
  { p: 'mg_', fn: async (ctx, d) => { if (!ctx.isAdmin) return ctx.answerCbQuery('🚫 ليس لديك صلاحية.', { show_alert: true }); return manage.handleCallback(ctx, d); }}
];

bot.on('callback_query', async ctx => {
  const data = ctx.callbackQuery?.data, cbId = ctx.callbackQuery?.id;
  if (!data || isDupeCB(cbId)) return;
  if (data.length > 64) return;

  try {
    if (!data.startsWith('grp_')) ctx.answerCbQuery('', { show_alert: false }).catch(() => {});
    if(ctx.chat?.type !== 'private' && !data.startsWith('grp_')) return ctx.answerCbQuery('استخدم البوت في الخاص للتصفح 👇').catch(()=>{});

    // 1. مطابقة تامة O(1) - أسرع شيء في العالم
    if (exactCbRoutes.has(data)) return exactCbRoutes.get(data)(ctx);

    // 2. مطابقة البادئات - ذكية ومنظمة
    for (const route of prefixCbRoutes) {
      if (data.startsWith(route.p)) return route.fn(ctx, data);
    }
  } catch(e) {
    logger.error('CB error:', e.message, 'data:', data);
    ctx.reply('⚠️ خطأ. يرجى المحاولة مجدداً.').catch(() => {});
  }
});

// ── Media Groups Handler ──
const mediaGroups = {};
setInterval(() => { const now = Date.now(); for (const k in mediaGroups) { if (mediaGroups[k]._ts && now - mediaGroups[k]._ts > 10000) delete mediaGroups[k]; } }, 30000);

bot.on('message', async (ctx, next) => {
  if(ctx.chat?.type !== 'private') {
    if(ctx.from && !ctx.from.is_bot) bufferGroupMember(ctx.chat.id, ctx.from.id, ctx.from.username, ctx.from.first_name); // 🛡️ Buffering
    const state = global.userStates?.[ctx.uid];
    if (state?.type === 'mg_bundle_files' && ctx.message.media_group_id) {
      const mgId = ctx.message.media_group_id;
      if (!mediaGroups[mgId]) {
        mediaGroups[mgId] = [];
        setTimeout(async () => {
          const msgs = mediaGroups[mgId] || []; delete mediaGroups[mgId]; let count = 0;
          for (const m of msgs) {
            let fid, ftype, title = '';
            if (m.document) { fid = m.document.file_id; ftype = 'document'; title = m.document.file_name || ''; }
            else if (m.photo) { fid = m.photo[m.photo.length - 1].file_id; ftype = 'photo'; }
            else if (m.video) { fid = m.video.file_id; ftype = 'document'; }
            else continue;
            await bundlesDb.addBundleFile(state.bundleId, fid, ftype, title); count++;
          }
          state.fileCount = (state.fileCount || 0) + count;
          await ctx.reply(count + ' ملف تم الحفظ. المجموع: ' + state.fileCount + '. ابعث المزيد أو /done');
        }, 1500);
      }
      mediaGroups[mgId].push(ctx.message);
      return;
    }
    return next();
  }
  return next();
});

// ── Document & Media Handlers ──
bot.on('document', async ctx => {
  if (!ctx.isAdmin && !ctx.isOwner) return;
  const state = global.userStates?.[ctx.uid];
  if (await tools.trySmartUpload(ctx)) return;
  if (state?.type === 'mg_bundle_files') return manage.handleBundleFileUpload(ctx);
  if (state?.type === 'mg_bulk_files') return manage.handleBulkUpload(ctx);
  if (state?.type === 'mg_bundle_files') return manage.handleBundleFileUpload(ctx);
  if (state?.type === 'mg_tpl_file') { global.setState(ctx.uid, { ...state, type: 'mg_tpl_content', fileId: ctx.message.document.file_id }); return ctx.reply('اكتب نص الرسالة مع الملف (او skip):'); }
  if (state?.type === 'mg_awaiting_restore' && ctx.isOwner) {
    global.delState(ctx.uid);
    try { const link = await ctx.telegram.getFileLink(ctx.message.document.file_id); const file = fs.createWriteStream(path.join(__dirname, 'study_bot.db')); https.get(link.href, res => { res.pipe(file); file.on('finish', () => { file.close(); ctx.reply('✅ تمت الاستعادة!'); }); }); } catch(e) { ctx.reply('❌ فشلت الاستعادة: ' + e.message); }
    return;
  }
  if (state?.type === 'mg_file') return manage.handleFileUpload(ctx);
});

bot.on(['photo', 'video', 'audio', 'voice'], async ctx => {
  if (!ctx.isAdmin && !ctx.isOwner) return;
  const state = global.userStates?.[ctx.uid];
  if (state?.type === 'mg_bulk_files') return manage.handleBulkUpload(ctx);
  if (state?.type === 'mg_bundle_files') return manage.handleBundleFileUpload(ctx);
  if (state?.type === 'mg_file') return manage.handleFileUpload(ctx);
  if (state?.type === 'mg_tpl_content') return manage.handleText(ctx, state);
});

// ── Text Handler ──
bot.on('text', async ctx => {
  if (ctx.message.text.startsWith('/')) return;
  const uid = ctx.uid, state = global.userStates?.[uid];
  if (!state) return;

  if (state.type === 'ai_mode' && ctx.chat?.type === 'private') {
    if (ctx.message.text.length > 1000) return ctx.reply('⚠️ الرسالة طويلة جداً.');
    if(ctx.isOwner && await handleOwnerAI(ctx, ctx.message.text.trim(), null, null)) return;
    if(await handleAiChat(ctx, ctx.message.text.trim())) return;
  }
  if (state.type === 'mg_file') return manage.handleFileUpload(ctx);
  if ((state.type === 'mg_bulk_prefix' || state.type === 'mg_bulk_files') && ctx.message.text?.trim() !== '/done') {
    if (state.type === 'mg_bulk_prefix') return manage.handleText(ctx, state);
  }
  if (state.type === 'mg_tpl_link') { global.setState(ctx.uid, { ...state, type: 'mg_tpl_content', fileId: ctx.message.text.trim() }); return ctx.reply('اكتب نص الرسالة مع الرابط (او skip):'); }
  if (state.type === 'search') return userH.handleSearch(ctx, ctx.message.text.trim());
  if (state.type === 'add_comment') {
    const text = ctx.message.text?.trim();
    if (!text || text === '/cancel') { await global.delState(ctx.uid); return ctx.reply('❌ تم الإلغاء.'); }
    if (text.length > 500) return ctx.reply('⚠️ التعليق طويل جداً.');
    await commentsDb.addComment(state.fid, ctx.uid, text); await global.delState(ctx.uid);
    const {cacheClear}=require('./utils/cache'); cacheClear('cmts_'+state.fid+'_0'); cacheClear('cmts_'+state.fid+'_1');
    await ctx.reply('✅ تم إضافة تعليقك!'); return browse.showComments(ctx, state.fid, state.spId, state.yrId, state.smId, state.sbId, state.catId);
  }
  if (state.type?.startsWith('mg_') && ctx.isAdmin) return manage.handleText(ctx, state);
});

// ── Auto-leave Groups ──
bot.on('my_chat_member', async ctx => {
  const chat = ctx.myChatMember?.chat, member = ctx.myChatMember?.new_chat_member;
  if(!chat || chat.type === 'private') return;
  if(!global._cachedBotId) global._cachedBotId = (await ctx.telegram.getMe()).id;
  if(member?.user?.id !== global._cachedBotId) return;
  if(['member','administrator'].includes(member?.status)) {
    try {
      await dbRun('INSERT INTO group_chats(chat_id,title) VALUES($1,$2) ON CONFLICT(chat_id) DO UPDATE SET title=EXCLUDED.title', [chat.id, chat.title||'']);
      const specs = await dbAll('SELECT id,name FROM specialties WHERE is_deleted=0 ORDER BY id');
      await ctx.telegram.sendMessage(chat.id, 'مرحباً! أنا بوت الدراسة\n\nاختر تخصص هذا القروب:', {reply_markup:{inline_keyboard: specs.map(s=>[{text:'🎓 '+s.name, callback_data:'grp_sp_'+chat.id+'_'+s.id}])}});
    } catch(e) { logger.error('Group join:', e.message); }
  } else if(['left','kicked'].includes(member?.status)) {
    dbRun('DELETE FROM group_chats WHERE chat_id=$1',[chat.id]).catch(()=>{});
    dbRun('DELETE FROM group_members WHERE chat_id=$1',[chat.id]).catch(()=>{});
  }
});

// ── Launch ──
async function launch() {
  try {
    await initSchema();
    await Promise.all([loadMaintenance(), loadStates()]);
    await cacheWarmup();
    logger.info('✅ Database ready');
    startScheduler(bot, [OWNER_ID]);

    app.get('/', (req, res) => res.send('OK'));
    app.get('/health', (req, res) => {
      res.setHeader('Cache-Control','no-cache');
      res.json({ status: 'ok', uptime: process.uptime(), memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB', region: process.env.RAILWAY_REGION || 'unknown' });
    });
    
    app.use(bot.webhookCallback('/webhook/' + TOKEN));
    app.listen(PORT, () => logger.info('✅ Express on port ' + PORT));
    await bot.telegram.setWebhook(WEBHOOK_URL + '/webhook/' + TOKEN, { allowed_updates: ['message', 'callback_query', 'my_chat_member'], drop_pending_updates: true, max_connections: 40 });
    global.__bot = bot;
    startSmartWarmup();
    logger.info('🚀 Study Bot v4.0 — Enterprise Architecture');
  } catch(e) { logger.error('Launch error:', e.message); setTimeout(launch, 10000); }
}
launch();

// ── Global Smart Cleanup ──
setInterval(async () => {
  try {
    await Promise.all([
      dbRun("DELETE FROM user_states WHERE updated_at < NOW() - INTERVAL '1 hour'"),
      dbRun("DELETE FROM group_members WHERE updated_at < NOW() - INTERVAL '7 days'"),
      dbRun("DELETE FROM cache_store WHERE expires_at::bigint < $1::bigint", [Date.now()])
    ]);
    if(!global._botMsgs) return;
    const keys = Object.keys(global._botMsgs);
    if(keys.length > 100) keys.slice(0, keys.length - 100).forEach(k => delete global._botMsgs[k]);
  } catch(e) {}
}, 3600000);

setInterval(() => { const now = Date.now(); for (const uid in global.userStates) { if (global.userStates[uid]?._ts && now - global.userStates[uid]._ts > 3600000) global.delState(uid); } }, 3600000);

process.once('SIGINT', async () => { try { if(global._stateTimer) clearTimeout(global._stateTimer); const {flushGroupMembers}=require('./index'); flushGroupMembers(); const db=require('./database/db'); if(db.saveDB) db.saveDB(); if(db.getPg) { const p=db.getPg(); if(p) await p.end(); } bot.stop('SIGINT'); } catch(e) {} });
process.once('SIGTERM', async () => { try { if(global._stateTimer) clearTimeout(global._stateTimer); const {flushGroupMembers}=require('./index'); flushGroupMembers(); const db=require('./database/db'); if(db.saveDB) db.saveDB(); if(db.getPg) { const p=db.getPg(); if(p) await p.end(); } bot.stop('SIGTERM'); } catch(e) {} });
process.on('uncaughtException', err => logger.error('Uncaught:', err.message));
process.on('unhandledRejection', err => logger.error('Unhandled:', err?.message || err));

// ── Memory Monitor ──
setInterval(() => { const mem = process.memoryUsage().heapUsed / 1024 / 1024; if (mem > 440) { logger.error('⚠️ Memory critical:', mem.toFixed(0) + 'MB'); if (global.gc) global.gc(); if (mem > 480) { logger.error("Restarting due to memory..."); process.emit("SIGTERM"); } } }, 60000);
