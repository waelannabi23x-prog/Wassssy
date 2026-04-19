'use strict';

require('dotenv').config();

const https = require('https');
const path = require('path');
const fs = require('fs');
const { Telegraf } = require('telegraf');
const express = require('express');
const compression = require('compression');

const logger = require('./utils/logger');
const { initSchema, getSetting, run: dbRun, all: dbAll, getPg } = require('./database/db');
const { authMiddleware, OWNER_ID } = require('./middlewares/auth');
const interactions = require('./database/interactions');
const commentsDb = require('./database/comments');
const adminsDb = require('./database/admins');
const usersDb = require('./database/users');
const filesDb = require('./database/files');
const contentDb = require('./database/content');
const { initPersistentStates } = require('./utils/stateManager');
const rateLimit = require('./utils/rateLimit');
const bundlesDb = require('./database/bundles');
const { btn: kbBtn, build: kbBuild } = require('./utils/keyboard');
const { eos } = require('./utils/helpers');

const { loadAllStates } = require('./utils/redis');
const { cacheWarmup, cacheClear, cacheClearPrefix } = require('./utils/cache');
const { setLang } = require('./utils/i18n');
const { startScheduler } = require('./utils/scheduler');
const { startSmartWarmup } = require('./utils/smartWarmup');
const { handleAiChat, resetChat } = require('./handlers/ai_chat');
const { handleOwnerAI } = require('./handlers/ai_owner');
const { smartSearch } = require('./handlers/group');
const tools = require('./handlers/owner_tools');
const startHandler = require('./handlers/start');
const browse = require('./handlers/browse');
const userH = require('./handlers/user');
const manage = require('./handlers/manage');

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) { logger.error('FATAL: BOT_TOKEN missing'); process.exit(1); }
const WEBHOOK_URL = process.env.WEBHOOK_URL || '';
const PORT = process.env.PORT || 3000;

const safeInt = v => { var n = parseInt(v); return isNaN(n) ? 0 : n; };
const CFG = {
  rlWindow: 10000, rlMax: 25,
  cbDedupMax: 500, cbDedupTTL: 20000,
  grpFlushMs: 15000, grpBufMax: 2000,
  stateTTL: 3600000, cleanupMs: 3600000,
  botMsgsPerChat: 100, maxChatsTracked: 150,
};
const StateMgr = {
  _s: {},
  get(u) { return this._s[u] || null; },
  async set(u, v) {
    v._ts = Date.now(); this._s[u] = v;
    dbRun('INSERT INTO user_states(user_id,state,updated_at) VALUES($1,$2,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET state=$2,updated_at=CURRENT_TIMESTAMP',[u,JSON.stringify(v)]).catch(()=>{});
  },
  async del(u) {
    delete this._s[u];
    dbRun('DELETE FROM user_states WHERE user_id=$1',[u]).catch(()=>{});
  },
  gc() { var n = Date.now(); var c = 0; for (var u in this._s) { if (this._s[u]._ts && n - this._s[u]._ts > CFG.stateTTL) { this.del(u); c++; } } return c; },
  get size() { return Object.keys(this._s).length; },
};
global.userStates = StateMgr._s;
global.setState = (u, v) => StateMgr.set(u, v);
global.delState = (u) => StateMgr.del(u);


const app = express();
app.use(compression({ level: 6, threshold: 512 }));
app.use(express.json({ limit: '1mb' }));
app.set('trust proxy', 1);

app.get('/', (_r, res) => res.send('OK'));

const RL = {
  _m: new Map(),
  check(u) {
    const n = Date.now(); let e = this._m.get(u);
    if (!e || n > e.r) { e = { c: 0, r: n + CFG.rlWindow }; this._m.set(u, e); }
    return ++e.c <= CFG.rlMax;
  },
  gc() { const n = Date.now(); for (const [k, v] of this._m) if (n > v.r + 5000) this._m.delete(k); },
};

const CBDedup = {
  _s: new Map(),
  isDupe(id) {
    if (this._s.has(id)) return true;
    this._s.set(id, Date.now());
    if (this._s.size > CFG.cbDedupMax) { const c = Date.now() - CFG.cbDedupTTL; for (const [k, v] of this._s) if (v < c) this._s.delete(k); }
    return false;
  },
};

const InFlight = {
  _m: new Map(),
  go(u, k, fn) { const key = u + '_' + k; if (this._m.has(key)) return this._m.get(key); const p = fn().finally(() => this._m.delete(key)); this._m.set(key, p); return p; },
};
global.dedupRequest = (u, k, fn) => InFlight.go(u, k, fn);

const GrpBuf = {
  _b: new Map(), _t: null,
  add(cid, uid, un, fn) {
    this._b.set(cid + '_' + uid, { chatId: cid, userId: uid, username: un || '', firstName: fn || '' });
    if (this._b.size >= CFG.grpBufMax) this.flush();
  },
  async flush() {
    if (!this._b.size) return;
    const e = [...this._b.values()]; this._b.clear(); if (!e.length) return;
    const ph = e.map((_, i) => `($${i*4+1},$${i*4+2},$${i*4+3},$${i*4+4},CURRENT_TIMESTAMP)`).join(',');
    try {
      await dbRun(
        `INSERT INTO group_members(chat_id,user_id,username,first_name,updated_at) VALUES ${ph}
         ON CONFLICT(chat_id,user_id) DO UPDATE SET username=EXCLUDED.username,first_name=EXCLUDED.first_name,updated_at=CURRENT_TIMESTAMP`,
        e.flatMap(x => [x.chatId, x.userId, x.username, x.firstName])
      );
    } catch(err) { logger.error('GrpBuf:', err.message); }
  },
  start() { this._t = setInterval(() => this.flush(), CFG.grpFlushMs); this._t.unref(); },
  stop() { if (this._t) clearInterval(this._t); return this.flush(); },
};

const MGColl = {
  _g: new Map(),
  add(id, msg) { if (!this._g.has(id)) this._g.set(id, []); this._g.get(id).push(msg); },
  drain(id) { const m = this._g.get(id) || []; this._g.delete(id); return m; },
  start() { const t = setInterval(() => { const n = Date.now(); for (const k in this._g) if (!this._g[k]._ts || n - this._g[k]._ts > 10000) delete this._g[k]; }, 30000); t.unref(); },
  stop() {},
};

const GrpMsgs = {
  _m: {},
  add(c, m) { if (!this._m[c]) this._m[c] = []; this._m[c].push(m); if (this._m[c].length > CFG.botMsgsPerChat) this._m[c] = this._m[c].slice(-CFG.botMsgsPerChat); },
  all(c) { return [...new Set(this._m[c] || [])]; },
  clear(c) { this._m[c] = []; },
  prune() { const k = Object.keys(this._m); if (k.length > CFG.maxChatsTracked) k.slice(0, k.length - CFG.maxChatsTracked).forEach(x => delete this._m[x]); },
};

global.maintenanceMode = false;
async function loadMaintenance() { try { global.maintenanceMode = (await getSetting('maintenance')) === 'true'; } catch(_){} }

const bot = new Telegraf(TOKEN, { handlerTimeout: 90000, telegram: { apiRoot: process.env.TELEGRAM_API_ROOT || undefined } });
let _botUn = null;
async function botUn(ctx) { if (_botUn) return _botUn; try { const m = await ctx.telegram.getMe(); _botUn = m.username; } catch(_){} return _botUn; }

bot.use(async (ctx, next) => {
  if (ctx.chat?.type !== 'private') {
    if (ctx.callbackQuery) return next();
    const t = ctx.message?.text || '';
    if (ctx.message && !['/search', '/setsp', '/dlt'].some(p => t.startsWith(p))) return ctx.deleteMessage().catch(() => {});
  }
  return next();
});
bot.use(rateLimit);
bot.use(authMiddleware);
  return next();
});
bot.catch((err, ctx) => {
  if(!err.message.includes('is not modified')&&!err.message.includes('message is not modified'))logger.error(`[BotErr] ${err.message}`, { uid: ctx.from?.id, type: ctx.updateType });
  if (!ctx.callbackQuery) ctx.reply('⚠️ حدث خطأ. حاول مجدداً.').catch(() => {});
});

bot.command('start', async ctx => { if (startHandler.clearAiMode) await startHandler.clearAiMode(ctx.uid); return startHandler(ctx); });
bot.command(['admin', 'owner', 'manage'], ctx => { if (!ctx.isAdmin) return ctx.reply('🚫 ليس لديك صلاحية.').catch(() => {}); return manage.mainMenu(ctx); });

bot.command('setsp', async ctx => {
  if (ctx.chat?.type === 'private') return ctx.reply('⚠️ للقروبات فقط.').catch(() => {});
  if (!ctx.isOwner && !ctx.isAdmin) return ctx.deleteMessage().catch(() => {});
  await ctx.deleteMessage().catch(() => {});
  try {
    const specs = await dbAll('SELECT id,name FROM specialties WHERE is_deleted=0 ORDER BY id');
    if (!specs.length) return ctx.reply('❌ لا تخصصات.').catch(() => {});
    return ctx.reply('اختر تخصص القروب:', { reply_markup: { inline_keyboard: specs.map(s => [{ text: '🎓 ' + s.name, callback_data: 'grp_sp_' + ctx.chat.id + '_' + s.id }]) } }).catch(() => {});
  } catch(e) { logger.error('[setsp]', e.message); }
});

bot.command('search', async ctx => {
  const isGrp = ctx.chat?.type !== 'private';
  const raw = ctx.message.text.replace('/search', '').replace(/@\w+/g, '').trim();
  if (isGrp) {
    await ctx.deleteMessage().catch(() => {});
    if (!raw || raw.length < 2) { const m = await ctx.reply('🔍 مثال: /search algo serie 1').catch(() => {}); if (m) setTimeout(() => ctx.deleteMessage(m.message_id).catch(() => {}), 6000); return; }
    try {
      const res = await smartSearch(raw, 10);
      if (!res.length) { const m = await ctx.reply('❌ لا نتائج لـ "' + raw + '"').catch(() => {}); if (m) setTimeout(() => ctx.deleteMessage(m.message_id).catch(() => {}), 8000); return; }
      const un = await botUn(ctx);
      const rows = res.map(f => {
        const l = '📄 ' + f.title.substring(0, 32) + ' · ' + f.sub_name;
        return ctx.isOwner ? [{ text: l, callback_data: 'grp_dl_' + f.id }] : [{ text: l, url: 'https://t.me/' + un + '?start=file_' + f.id }];
      });
      if (!ctx.isOwner && un) rows.push([{ text: '🤖 فتح البوت', url: 'https://t.me/' + un }]);
      const m = await ctx.reply('🔍 "' + raw + '" — ' + res.length + ' نتيجة\nاضغط للتحميل 👇', { reply_markup: { inline_keyboard: rows } }).catch(() => {});
      if (m) { GrpMsgs.add(ctx.chat.id, m.message_id); setTimeout(() => ctx.deleteMessage(m.message_id).catch(() => {}), 60000); }
    } catch(e) { logger.error('[search grp]', e.message); }
    return;
  }
  if (raw) return userH.handleSearch(ctx, raw);
  await global.setState(ctx.uid, { type: 'search' });
  return ctx.reply('🔍 اكتب كلمة البحث:').catch(() => {});
});

bot.command('profile', ctx => userH.showProfile(ctx));
bot.command('stats', ctx => userH.showStats(ctx));

bot.command('done', async ctx => {
  const s = StateMgr.get(ctx.uid); if (!s) return;
  if (s.type === 'mg_bundle_files') { await global.delState(ctx.uid); return ctx.reply('✅ تم حفظ الحزمة بـ ' + (s.fileCount || 0) + ' ملف').catch(() => {}); }
  if (s.type === 'mg_bulk_files') {
    const up = s.uploaded || [], fl = s.failed || [];
    await global.delState(ctx.uid);
    cacheClearPrefix('files_cat_' + s.catId); cacheClearPrefix('showfiles_' + s.catId);
    let msg = '✅ تم الرفع: ' + up.length + ' ملف'; if (fl.length) msg += ' | ❌ فشل: ' + fl.length;
    if (up.length) msg += '\n' + up.map(t => '+ ' + t).join('\n');
    if (fl.length) msg += '\n' + fl.map(t => '✗ ' + t).join('\n');
    return ctx.reply(msg, { ...kbBuild([[kbBtn('📂 عرض الملفات', 'mg_fls_' + s.spId + '_' + s.yrId + '_' + s.smId + '_' + s.sbId + '_' + s.catId)]]) }).catch(() => {});
  }
});

bot.command('mygroups', ctx => tools.listGroups(ctx));
bot.command('leavegroup', ctx => tools.leaveGroup(ctx));
bot.command('leaveall', async ctx => {
  if (!ctx.isOwner) return ctx.reply('🚫').catch(() => {});
  try { const ch = await dbAll('SELECT chat_id FROM group_chats'); let l = 0; for (const c of ch) { try { await ctx.telegram.leaveChat(c.chat_id); l++; } catch(_){} } return ctx.reply('✅ خرجت من ' + l + ' قروب.').catch(() => {}); } catch(e) { logger.error('[leaveall]', e.message); }
});
bot.command('dlt', async ctx => {
  if (!ctx.isOwner) return ctx.deleteMessage().catch(() => {});
  if (ctx.chat?.type === 'private') return ctx.reply('⚠️ للقروبات فقط.').catch(() => {});
  await ctx.deleteMessage().catch(() => {});
  try {
    const db = await dbAll('SELECT message_id FROM group_bot_msgs WHERE chat_id=$1 ORDER BY sent_at DESC LIMIT 200', [ctx.chat.id]);
    const ids = [...new Set([...db.map(r => r.message_id), ...GrpMsgs.all(ctx.chat.id)])];
    let d = 0; for (const id of ids) { try { await ctx.telegram.deleteMessage(ctx.chat.id, id); d++; } catch(_){} }
    GrpMsgs.clear(ctx.chat.id);
    await dbRun('DELETE FROM group_bot_msgs WHERE chat_id=$1', [ctx.chat.id]).catch(() => {});
    const m = await ctx.reply('✅ حُذف ' + d + ' رسالة.').catch(() => {});
    if (m) setTimeout(() => ctx.deleteMessage(m.message_id).catch(() => {}), 3000);
  } catch(e) { logger.error('[dlt]', e.message); }
});
bot.command('ai', async ctx => { await global.setState(ctx.uid, { type: 'ai_mode' }); return ctx.reply('🤖 وضع المساعد الذكي مفعل!\n\nاكتب أي سؤال.\n/start للرجوع.').catch(() => {}); });
bot.command('reset', ctx => { resetChat(ctx.uid); return ctx.reply('🔄 تم مسح سياق المحادثة.').catch(() => {}); });
bot.command('promote', ctx => tools.batchPromote(ctx));
bot.command('cancel', async ctx => { if (StateMgr.get(ctx.uid)) { await global.delState(ctx.uid); return ctx.reply('❌ تم الإلغاء.').catch(() => {}); } });
bot.command('users', async ctx => {
  if (!ctx.isOwner && !ctx.isAdmin) return ctx.reply('🚫').catch(() => {});
  if (ctx.isAdmin && !ctx.isOwner) { const p = await adminsDb.getPerms(ctx.uid).catch(() => []); if (!p.includes('full') && !p.includes('view_users')) return ctx.reply('🚫').catch(() => {}); }
  return manage.showUsers(ctx);
});
bot.command('help', ctx => ctx.reply(
  '📚 *أوامر البوت*\n\n/start — الرئيسية\n/search — البحث\n/profile — شخصي\n/stats — إحصائيات\n/cancel — إلغاء\n/ai — مساعد ذكي\n/reset — مسح سياق\n\n👑 *المشرفين:*\n/admin — الإدارة',
  { parse_mode: 'Markdown' }
).catch(() => {}));

const exactR = new Map([
  ['noop', () => {}],
  ['main_menu', ctx => startHandler(ctx)],
  ['browse', ctx => browse.showSpecs(ctx)],
  ['latest', ctx => userH.showLatest(ctx)],
  ['new_in_sp', ctx => userH.showNewInSpecialty(ctx)],
  ['recommended', ctx => userH.showRecommended(ctx)],
  ['favorites', ctx => userH.showFavorites(ctx)],
  ['history', ctx => userH.showHistory(ctx)],
  ['profile', ctx => userH.showProfile(ctx)],
  ['stats', ctx => userH.showStats(ctx)],
  ['progress', ctx => userH.showProgress(ctx)],
  ['search_prompt', ctx => { global.setState(ctx.uid, { type: 'search' }); return ctx.reply('🔍 اكتب كلمة البحث:').catch(() => {}); }],
  ['ai_prompt', ctx => { global.setState(ctx.uid, { type: 'ai_mode' }); return ctx.reply('🤖 المساعد الذكي مفعل!\n\nاكتب سؤالك:').catch(() => {}); }],
  ['skip_sp', async ctx => { await usersDb.setSpecialty(ctx.uid, 0); return startHandler.showMainMenu(ctx); }],
  ['change_sp', async ctx => { const sp = await contentDb.getSpecs(); return eos(ctx, '🎓 *اختر تخصصك:*', { parse_mode: 'Markdown', ...kbBuild(sp.map(s => [kbBtn('🎓 ' + s.name, 'set_sp_' + s.id)])) }); }],
]);

async function hGrpSp(ctx, d) {
  if (!ctx.isOwner) return ctx.answerCbQuery('🚫 للمالك فقط', { show_alert: true }).catch(() => {});
  const r = d.substring(7), i = r.lastIndexOf('_'), cid = parseInt(r.substring(0, i)), sid = parseInt(r.substring(i + 1));
  try {
    await dbRun('INSERT INTO group_chats(chat_id,specialty_id) VALUES($1,$2) ON CONFLICT(chat_id) DO UPDATE SET specialty_id=$2', [cid, sid]);
    const sp = await dbAll('SELECT name FROM specialties WHERE id=$1', [sid]); const nm = sp[0]?.name || sid;
    await ctx.answerCbQuery('✅ ' + nm).catch(() => {});
    await ctx.telegram.editMessageText(cid, ctx.callbackQuery.message.message_id, null, '✅ تخصص القروب: 🎓 ' + nm).catch(() => {});
  } catch(e) { ctx.answerCbQuery('❌ ' + e.message, { show_alert: true }).catch(() => {}); }
}

async function hGrpDl(ctx, d) {
  if (!ctx.isOwner) return ctx.answerCbQuery('🚫').catch(() => {});
  try {
    const f = await filesDb.getFile(d.substring(7)); if (!f) return ctx.answerCbQuery('❌ غير موجود').catch(() => {});
    const cap = '📄 ' + f.title + (f.sub_name ? '\n📚 ' + f.sub_name : '');
    let sm;
    if (f.file_type === 'photo') sm = await ctx.telegram.sendPhoto(ctx.chat.id, f.file_id, { caption: cap });
    else if (f.file_type === 'link') sm = await ctx.telegram.sendMessage(ctx.chat.id, cap + '\n🔗 ' + f.file_id);
    else sm = await ctx.telegram.sendDocument(ctx.chat.id, f.file_id, { caption: cap });
    if (sm?.message_id) { GrpMsgs.add(ctx.chat.id, sm.message_id); await dbRun('INSERT INTO group_bot_msgs(chat_id,message_id) VALUES($1,$2)', [ctx.chat.id, sm.message_id]).catch(() => {}); }
    ctx.answerCbQuery('✅ تم الإرسال').catch(() => {});
  } catch(e) { ctx.answerCbQuery('❌ ' + e.message, { show_alert: true }).catch(() => {}); }
}

async function hSearchDel(ctx, d) {
  if (!ctx.isAdmin) return ctx.answerCbQuery('🚫', { show_alert: true }).catch(() => {});
  const p = d.substring(11).split('|'), fid = p[0], q = decodeURIComponent(p[1] || '');
  await filesDb.softDelete(fid); cacheClearPrefix('search_'); if (global._clearSearchCache) global._clearSearchCache();
  await ctx.answerCbQuery('✅ تم الحذف').catch(() => {}); return userH.handleSearch(ctx, q);
}

async function hMgTtype(ctx, d) {
  const i = d.indexOf('_', 9), tt = d.substring(9, i), nm = decodeURIComponent(d.substring(i + 1));
  if (tt === 'text' || tt === 'link') { await global.setState(ctx.uid, { type: 'mg_tpl_content', name: nm, tplType: tt, fileId: '' }); return ctx.reply(tt === 'link' ? '🔗 اكتب الرابط:' : '✏️ اكتب المحتوى:').catch(() => {}); }
  await global.setState(ctx.uid, { type: 'mg_tpl_file', name: nm, tplType: tt, fileId: '' }); return ctx.reply('📎 أبعث الملف أو الصورة:').catch(() => {});
}

const prefR = [
  { p: 'grp_sp_', fn: hGrpSp },
  { p: 'grp_dl_', fn: hGrpDl },
  { p: 'sp_', fn: (ctx, d) => browse.showYears(ctx, safeInt(d.substring(3))) },
  { p: 'yr_', fn: (ctx, d) => { const p = d.split('_'); return browse.showSemesters(ctx, p[1], p[2]); } },
  { p: 'sm_', fn: (ctx, d) => { const p = d.split('_'); return browse.showSubjects(ctx, p[1], p[2], p[3]); } },
  { p: 'sb_', fn: (ctx, d) => { const p = d.split('_'); return browse.showCategories(ctx, p[1], p[2], p[3], p[4]); } },
  { p: 'ct_', fn: (ctx, d) => { const p = d.split('_'); return browse.showFiles(ctx, p[1], p[2], p[3], p[4], p[5]); } },
  { p: 'fl_', fn: (ctx, d) => { const p = d.split('_'); return browse.sendFile(ctx, p[1], p[2], p[3], p[4], p[5], p[6]); } },
  { p: 'preview_', fn: (ctx, d) => { const p = d.split('_'); return browse.showPreview(ctx, p[1], p[2], p[3], p[4], p[5], p[6]); } },
  { p: 'bundle_', fn: (ctx, d) => { const p = d.split('_'); return browse.showBundle(ctx, p[1], p[2], p[3], p[4], p[5], p[6]); } },
  { p: 'bdl_', fn: (ctx, d) => { const p = d.split('_'); return browse.sendBundle(ctx, p[1], p[2], p[3], p[4], p[5], p[6]); } },
  { p: 'ct_page_', fn: (ctx, d) => { const p = d.substring(8).split('_'); return browse.showFiles(ctx, p[0], p[1], p[2], p[3], p[4], parseInt(p[5])); } },
  { p: 'yr_page_', fn: (ctx, d) => { const p = d.substring(8).split('_'); return browse.showYears(ctx, p[0], parseInt(p[1])); } },
  { p: 'sb_page_', fn: (ctx, d) => { const p = d.substring(8).split('_'); return browse.showSubjects(ctx, p[0], p[1], p[2], parseInt(p[3])); } },
  { p: 'sbs_', fn: (ctx, d) => { const p = d.substring(4).split('_'); return browse.showSubjects(ctx, p[0], p[1], p[2]); } },
  { p: 'yrs_', fn: (ctx, d) => { const p = d.substring(4).split('_'); return browse.showYears(ctx, p[0]); } },
  { p: 'sms_', fn: (ctx, d) => { const p = d.substring(4).split('_'); return browse.showSemesters(ctx, p[0], p[1]); } },
  { p: 'unfav_', fn: (ctx, d) => userH.toggleFav(ctx, safeInt(d.substring(6)), true) },
  { p: 'fav_', fn: (ctx, d) => userH.toggleFav(ctx, safeInt(d.substring(4)), false) },
  { p: 'set_sp_', fn: async (ctx, d) => { await usersDb.setSpecialty(ctx.uid, safeInt(d.substring(7))); await ctx.answerCbQuery('✅ تم حفظ تخصصك').catch(() => {}); return startHandler.showMainMenu(ctx); } },
  { p: 'lang_', fn: (ctx, d) => { setLang(ctx.uid, d.substring(5)); return userH.showProfile(ctx); } },
  { p: 'rate_', fn: async (ctx, d) => { const p = d.substring(5).split('_'); await interactions.addRating(ctx.uid, p[0], parseInt(p[1])); await ctx.answerCbQuery('⭐ تم التقييم!').catch(() => {}); return browse.showPreview(ctx, p[0], p[2], p[3], p[4], p[5], p[6]); } },
  { p: 'do_report_', fn: (ctx, d) => { const p = d.substring(10).split('_'); return browse.doReport(ctx, p[0], p[1], p[2], p[3], p[4], p[5], p[6]); } },
  { p: 'report_', fn: (ctx, d) => { const p = d.substring(7).split('_'); return browse.showReportMenu(ctx, p[0], p[1], p[2], p[3], p[4], p[5]); } },
  { p: 'cmt_pg_', fn: (ctx, d) => { const p = d.substring(7).split('_'); return browse.showComments(ctx, p[0], p[1], p[2], p[3], p[4], p[5], p[6], parseInt(p[7])); } },
  { p: 'cmt_', fn: (ctx, d) => { const p = d.substring(4).split('_'); return browse.showComments(ctx, p[0], p[1], p[2], p[3], p[4], p[5], p[6]); } },
  { p: 'add_cmt_', fn: async (ctx, d) => { const p = d.substring(9).split('_'); await global.setState(ctx.uid, { type: 'add_comment', fid: p[0], spId: p[1], yrId: p[2], smId: p[3], sbId: p[4], catId: p[5] }); return ctx.reply('✍️ اكتب تعليقك:\n_(أو /cancel)_', { parse_mode: 'Markdown' }).catch(() => {}); } },
  { p: 'dcmt_', fn: async (ctx, d) => { const p = d.substring(5).split('_'); await commentsDb.deleteCommentAdmin(p[0]); await ctx.answerCbQuery('✅ تم الحذف').catch(() => {}); return browse.showComments(ctx, p[1], p[2], p[3], p[4], p[5], p[6], p[7]); } },
  { p: 'search_del_', fn: hSearchDel },
  { p: 'mg_ttype_', fn: hMgTtype },
  { p: 'mg_', fn: async (ctx, d) => { if (!ctx.isAdmin) return ctx.answerCbQuery('🚫', { show_alert: true }).catch(() => {}); return manage.handleCallback(ctx, d); } },
];

bot.on('callback_query', async ctx => {
  const data = ctx.callbackQuery?.data, cbId = ctx.callbackQuery?.id;
  if (!data || CBDedup.isDupe(cbId) || data.length > 64) return;
  try {
    // no blanket answerCbQuery — saves 100ms per click
    if (ctx.chat?.type !== 'private' && !data.startsWith('grp_')) return ctx.answerCbQuery('👉 استخدم البوت في الخاص').catch(() => {});
    if (exactR.has(data)) return exactR.get(data)(ctx);
    for (const r of prefR) { if (data.startsWith(r.p)) return r.fn(ctx, data); }
  } catch(e) { logger.error('[CB]', e.message, { data, uid: ctx.from?.id }); }
});

bot.on('message', async (ctx, next) => {
  if (ctx.chat?.type !== 'private') {
    if (ctx.from && !ctx.from.is_bot) GrpBuf.add(ctx.chat.id, ctx.from.id, ctx.from.username, ctx.from.first_name);
    const s = StateMgr.get(ctx.uid);
    if (s?.type === 'mg_bundle_files' && ctx.message.media_group_id) {
      const mgId = ctx.message.media_group_id; MGColl.add(mgId, ctx.message);
      setTimeout(async () => {
        const msgs = MGColl.drain(mgId); if (!msgs.length) return;
        let c = 0;
        for (const m of msgs) {
          let fid, ft, tl = '';
          if (m.document) { fid = m.document.file_id; ft = 'document'; tl = m.document.file_name || ''; }
          else if (m.photo) { fid = m.photo[m.photo.length - 1].file_id; ft = 'photo'; }
          else if (m.video) { fid = m.video.file_id; ft = 'document'; }
          else continue;
          await bundlesDb.addBundleFile(s.bundleId, fid, ft, tl).catch(() => {}); c++;
        }
        s.fileCount = (s.fileCount || 0) + c;
        ctx.reply('📎 ' + c + ' ملف. المجموع: ' + s.fileCount + '\nأبعث المزيد أو /done').catch(() => {});
      }, 1500);
      return;
    }
    return next();
  }
  return next();
});

bot.on('document', async ctx => {
  if (!ctx.isAdmin && !ctx.isOwner) return;
  const s = StateMgr.get(ctx.uid);
  if (await tools.trySmartUpload(ctx)) return;
  if (s?.type === 'mg_bundle_files') return manage.handleBundleFileUpload(ctx);
  if (s?.type === 'mg_bulk_files') return manage.handleBulkUpload(ctx);
  if (s?.type === 'mg_tpl_file') { await global.setState(ctx.uid, { ...s, type: 'mg_tpl_content', fileId: ctx.message.document.file_id }); return ctx.reply('✏️ اكتب نص الرسالة (أو skip):').catch(() => {}); }
  if (s?.type === 'mg_awaiting_restore' && ctx.isOwner) {
    await global.delState(ctx.uid);
    try {
      const link = await ctx.telegram.getFileLink(ctx.message.document.file_id);
      const file = fs.createWriteStream(path.join(__dirname, 'study_bot.db'));
      https.get(link.href, res => { res.pipe(file); file.on('finish', () => { file.close(); ctx.reply('✅ تمت الاستعادة!').catch(() => {}); }); });
    } catch(e) { ctx.reply('❌ فشلت: ' + e.message).catch(() => {}); }
    return;
  }
  if (s?.type === 'mg_file') return manage.handleFileUpload(ctx);
});

bot.on(['photo', 'video', 'audio', 'voice'], async ctx => {
  if (!ctx.isAdmin && !ctx.isOwner) return;
  const s = StateMgr.get(ctx.uid);
  if (s?.type === 'mg_bulk_files') return manage.handleBulkUpload(ctx);
  if (s?.type === 'mg_bundle_files') return manage.handleBundleFileUpload(ctx);
  if (s?.type === 'mg_file') return manage.handleFileUpload(ctx);
  if (s?.type === 'mg_tpl_content') return manage.handleText(ctx, s);
});

bot.on('text', async ctx => { try {
  if (ctx.message.text.startsWith('/')) return;
  const uid = ctx.uid, s = StateMgr.get(uid); if (!s) return;
  const txt = ctx.message.text.trim();
  if (s.type === 'ai_mode' && ctx.chat?.type === 'private') {
    if (txt.length > 1000) return ctx.reply('⚠️ الحد 1000 حرف.').catch(() => {});
    if (ctx.isOwner && await handleOwnerAI(ctx, txt, null, null)) return;
    if (await handleAiChat(ctx, txt)) return;
  }
  if (s.type === 'mg_file') return manage.handleFileUpload(ctx);
  if (s.type === 'mg_bulk_prefix') return manage.handleText(ctx, s);
  if (s.type === 'mg_bulk_files' && txt !== '/done') return manage.handleText(ctx, s);
  if (s.type === 'mg_tpl_link') { await global.setState(ctx.uid, { ...s, type: 'mg_tpl_content', fileId: txt }); return ctx.reply('✏️ اكتب نص الرسالة (أو skip):').catch(() => {}); }
  if (s.type === 'search') return userH.handleSearch(ctx, txt);
  if (s.type === 'add_comment') {
    if (!txt || txt === '/cancel') { await global.delState(ctx.uid); return ctx.reply('❌ تم الإلغاء.').catch(() => {}); }
    if (txt.length > 500) return ctx.reply('⚠️ الحد 500 حرف.').catch(() => {});
    await commentsDb.addComment(s.fid, ctx.uid, txt); await global.delState(ctx.uid);
    cacheClear('cmts_' + s.fid + '_0'); cacheClear('cmts_' + s.fid + '_1');
    await ctx.reply('✅ تم إضافة تعليقك!').catch(() => {}); return browse.showComments(ctx, s.fid, s.spId, s.yrId, s.smId, s.sbId, s.catId);
  }
    if (s.type?.startsWith('mg_') && ctx.isAdmin) return manage.handleText(ctx, s);
  } catch(e) { logger.error('[TextHandler]', e.message, { uid: ctx.from?.id }); }
});

bot.on('my_chat_member', async ctx => {
  const chat = ctx.myChatMember?.chat, member = ctx.myChatMember?.new_chat_member;
  if (!chat || chat.type === 'private') return;
  if (!global._cachedBotId) { try { global._cachedBotId = (await ctx.telegram.getMe()).id; } catch(_) { return; } }
  if (member?.user?.id !== global._cachedBotId) return;
  if (['member', 'administrator'].includes(member?.status)) {
    try {
      await dbRun('INSERT INTO group_chats(chat_id,title) VALUES($1,$2) ON CONFLICT(chat_id) DO UPDATE SET title=EXCLUDED.title', [chat.id, chat.title || '']);
      const sp = await dbAll('SELECT id,name FROM specialties WHERE is_deleted=0 ORDER BY id');
      await ctx.telegram.sendMessage(chat.id, 'مرحباً! أنا بوت الدراسة\n\nاختر تخصص هذا القروب:', { reply_markup: { inline_keyboard: sp.map(s => [{ text: '🎓 ' + s.name, callback_data: 'grp_sp_' + chat.id + '_' + s.id }]) } });
    } catch(e) { logger.error('[GrpJoin]', e.message); }
  } else if (['left', 'kicked'].includes(member?.status)) {
    await dbRun('DELETE FROM group_chats WHERE chat_id=$1', [chat.id]).catch(() => {});
    await dbRun('DELETE FROM group_members WHERE chat_id=$1', [chat.id]).catch(() => {});
  }
});

async function launch() {
  logger.info('🚀 Study Bot v5.0 — Enterprise Edition');
  try {
    await initSchema();
  await initPersistentStates(); logger.info('✅ DB ready');

    try {
      const db = require('./database/db');
      await db.run("CREATE TABLE IF NOT EXISTS group_notify_log(id SERIAL PRIMARY KEY,file_id INTEGER NOT NULL,chat_id BIGINT NOT NULL,sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE(file_id,chat_id))");
      await db.run("CREATE INDEX IF NOT EXISTS idx_gnl_file ON group_notify_log(file_id)");
      logger.info('✅ Extra tables ready');
    } catch(e) { logger.warn('Extra tables:', e.message); }

    await Promise.all([loadMaintenance(), loadAllStates().catch(() => {})]);
    logger.info('✅ Config loaded');
    await cacheWarmup(); logger.info('✅ Cache warm');
    startScheduler(bot, [OWNER_ID]);
    GrpBuf.start(); MGColl.start(); logger.info('✅ Services started');
    app.use(bot.webhookCallback('/webhook/' + TOKEN));
    app.get('/health', async (_r, res) => {
    res.setHeader('Cache-Control', 'no-store');
    var mu = process.memoryUsage();
    var ok = true;
    var checks = {};
    // DB check
    try { var r = await dbAll('SELECT 1'); checks.db = r.length ? 'ok' : 'empty'; } catch(e) { ok = false; checks.db = 'error: ' + e.message.substring(0, 50); }
    // Cache check
    try { var cs = require('./utils/cache'); checks.cache = cs.getCacheSize ? 'ok' : 'error'; } catch(e) { checks.cache = 'error'; }
    // Memory check
    var heapMB = Math.round(mu.heapUsed / 1048576);
    checks.memory = heapMB < 450 ? 'ok' : 'high';
    if (heapMB > 450) ok = false;
    res.json({ status: ok ? 'ok' : 'degraded', uptime: Math.floor(process.uptime()), heap: heapMB + 'MB', rss: Math.round(mu.rss / 1048576) + 'MB', checks: checks, region: process.env.RAILWAY_REGION || 'local', ts: Date.now() });
  });
app.listen(PORT, () => logger.info('✅ Express :' + PORT));
    if (WEBHOOK_URL) {
    await bot.telegram.setWebhook(WEBHOOK_URL + '/webhook/' + TOKEN, { allowed_updates: ['message', 'callback_query', 'my_chat_member'], drop_pending_updates: true, max_connections: 40 });
    logger.info('✅ Webhook: ' + WEBHOOK_URL);
  } else {
    logger.warn('⚠️ No WEBHOOK_URL - using polling');
    bot.launch({ drop_pending_updates: true });
  }
    global.__bot = bot;
global._clearSearchCache = function() { var cc = require('./utils/cache'); cc.cacheClearPrefix('search_'); cc.cacheClear('latest_15'); cc.cacheClear('popular_15'); }; // startSmartWarmup(); // disabled: cacheWarmup sufficient
    logger.info('🚀 Ready');
  } catch(e) { logger.error('[Launch]', e.message); setTimeout(launch, 10000); }
}

async function shutdown(sig) {
  logger.info('[Shutdown] ' + sig);
  try { bot.stop(sig); await GrpBuf.stop(); StateMgr.gc(); const pg = getPg(); if (pg) await pg.end(); process.exit(0); } catch(e) { process.exit(1); }
}
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', e => logger.error('[Uncaught]', e.message));
process.on('unhandledRejection', e => logger.error('[Rejection]', e?.message || e));

const _cln = setInterval(async () => {
  try {
    await Promise.all([
      dbRun("DELETE FROM user_states WHERE updated_at::timestamp < NOW() - INTERVAL '1 hour'").catch(() => {}),
      dbRun("DELETE FROM group_members WHERE updated_at::timestamp < NOW() - INTERVAL '7 days'").catch(() => {}),
      dbRun("DELETE FROM cache_store WHERE expires_at::bigint < $1::bigint", [Date.now()]).catch(() => {}),
    ]);
    StateMgr.gc(); GrpMsgs.prune();
  } catch(_) {}
}, CFG.cleanupMs);
_cln.unref();

const _mem = setInterval(() => {
  const h = process.memoryUsage().heapUsed / 1048576;
  if (h > 440) { logger.warn('[Mem] ' + h.toFixed(0) + 'MB'); if (global.gc) global.gc(); }
  if (h > 480) { logger.error('[Mem CRITICAL] restarting'); process.emit('SIGTERM'); }
}, 60000);
_mem.unref();

launch();
