'use strict';

require('dotenv').config();

const https = require('https');
const path = require('path');
const fs = require('fs');
const { Telegraf } = require('telegraf');
const express = require('express');
const compression = require('compression');

const logger = require('./utils/logger');
const { res: cbRes, purge: cbPurge } = require('./utils/cbRegistry');
const { initSchema, getSetting, run: dbRun, all: dbAll, getPg } = require('./database/db');
const { authMiddleware, OWNER_ID } = require('./middlewares/auth');
const ownerH = require('./handlers/owner');
const interactions = require('./database/interactions');
const commentsDb = require('./database/comments');
const adminsDb = require('./database/admins');
const usersDb = require('./database/users');
const filesDb = require('./database/files');
const contentDb = require('./database/content');
const { initPersistentStates } = require('./utils/stateManager');
// RATE LIMITER: Integrated below
const bundlesDb = require('./database/bundles');
const { btn: kbBtn, build: kbBuild } = require('./utils/keyboard');
const { eos } = require('./utils/helpers');

const { loadAllStates } = require('./utils/redis');
const { cacheWarmup, cacheClear, cacheClearPrefix } = require('./utils/cache');
const { setLang } = require('./utils/i18n');
const { startScheduler } = require('./utils/scheduler');
const { handleAiChat, resetChat } = require('./handlers/ai_chat');
const poll = require('./handlers/group_admin_poll');
const { handleOwnerAI } = require('./handlers/ai_owner');
const setupGroupCommands = require('./handlers/group_commands');
const { smartSearch } = require('./handlers/group');
const tools = require('./handlers/owner_tools');
const startHandler = require('./handlers/start');
const browse = require('./handlers/browse');
const userH = require('./handlers/user');
const manage = require('./handlers/manage');

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) { logger.error('FATAL: BOT_TOKEN missing'); process.exit(1); }
const WEBHOOK_URL = process.env.WEBHOOK_URL || '';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const PORT = process.env.PORT || 3000;

const safeInt = v => { var n = parseInt(v); return isNaN(n) ? 0 : n; };
const CFG = {
  rlWindow: 10000, rlMax: 25,
  cbDedupMax: 500, cbDedupTTL: 20000,
  grpFlushMs: 15000, grpBufMax: 2000,
  stateTTL: 3600000, cleanupMs: 3600000,
  botMsgsPerChat: 100, maxChatsTracked: 150,
};
const { setState: _setState, delState: _delState, getState: _getState } = require('./utils/redis');
global.setState = _setState;
global.delState = _delState;
global.getState = _getState;
// userStates shim — handlers that read global.getState() use getState() instead
global.userStates = {}; // kept for back-compat, actual state lives in redis.js _mem


const app = express();
app.use(compression({ level: 6, threshold: 512 }));
app.use(express.json({ limit: '1mb' }));
app.set('trust proxy', 1);

app.get('/', (_r, res) => res.send('OK'));


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
  start() { const t = setInterval(() => { for (const k of this._g.keys()) this._g.delete(k); }, 30000); t.unref(); },
  stop() {},
};

const GrpMsgs = {
  _m: Object.create(null),
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
    const _tcmd = t.split('@')[0].split(' ')[0];
    // لو في poll state نسمح بالرسالة تعبر
    const _pollState = global.getState && global.getState(ctx.from?.id);
    if (_pollState?.type === 'poll_create') return next();
    if (ctx.message && !['/search', '/setsp', '/dlt', '/done', '/cancel', '/new', '/top', '/all', '/tag', '/mute', '/unmute', '/ai', '/reset', '/start', '/help', '/stats', '/poll', '/polls', '/setwelcome', '/setwelcomemsg', '/clearwelcome'].some(p => _tcmd === p || t.startsWith(p))) {
      if (ctx.from && !ctx.from.is_bot) {
        const { run } = require('./database/db');
        run('INSERT INTO group_members(chat_id,user_id,username,first_name,updated_at) VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP) ON CONFLICT(chat_id,user_id) DO UPDATE SET first_name=EXCLUDED.first_name,updated_at=CURRENT_TIMESTAMP',
          [ctx.chat.id, ctx.from.id, ctx.from.username||'', ctx.from.first_name||'عضو']).catch(()=>{});
      }
      return ctx.deleteMessage().catch(() => {});
    }
  }
  return next();
});
// 🛡️ Ultra-Light Anti-Flood (Built-in)
const _floodMap  = new Map();
const FLOOD_MAX  = 10000; // hard cap — prevents memory abuse
const _floodClean = setInterval(() => {
  const cut = Date.now() - 60000;
  for (const [k,v] of _floodMap) if (v.t < cut) _floodMap.delete(k);
  // Emergency evict if still over cap
  if (_floodMap.size > FLOOD_MAX) {
    const iter = _floodMap.keys();
    while (_floodMap.size > FLOOD_MAX * 0.8) _floodMap.delete(iter.next().value);
  }
}, 60000);
if (_floodClean.unref) _floodClean.unref();
const rateLimit = function(ctx, next) {
  const uid = ctx.from?.id;
  if (!uid) return next();
  const now = Date.now();
  let u = _floodMap.get(uid);
  if (!u || now - u.t > 10000) { u = {c: 1, t: now}; _floodMap.set(uid, u); }
  else {
    u.c++;
    if (u.c > 15) return; // بلوك بعد 15 ضغطة فقط
  }
  return next();
};

bot.use(rateLimit);
bot.use(authMiddleware);
bot.catch((err, ctx) => {
  if(!err.message.includes('is not modified')&&!err.message.includes('message is not modified'))logger.error(`[BotErr] ${err.message}`, { uid: ctx.from?.id, type: ctx.updateType });
  if (!ctx.callbackQuery) ctx.reply('⚠️ حدث خطأ. حاول مجدداً.').catch(() => {});
});

bot.command('start', async ctx => {
  // /start في القروب → احذف الرسالة فقط
  if (ctx.chat.type === 'supergroup' || ctx.chat.type === 'group') {
    ctx.deleteMessage().catch(() => {});
    return;
  } if (startHandler.clearAiMode) await startHandler.clearAiMode(ctx.uid); return startHandler(ctx); });
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
  const isGrp = ctx.chat && ctx.chat.type !== 'private';
  const raw   = ctx.message.text.replace('/search', '').replace(/@\w+/g, '').trim();
  if (isGrp) {
    await ctx.deleteMessage().catch(function(){});
    const q = (raw || '').slice(0, 80);
    if (!q || q.length < 2) {
      const m = await ctx.reply('\u{1F50D} \u0645\u062B\u0627\u0644: /search algo 2  \u00B7  serie 1  \u00B7  td analyse').catch(function(){});
      if (m) setTimeout(function(){ ctx.deleteMessage(m.message_id).catch(function(){}); }, 7000);
      return;
    }
    let loadMsg = null;
    try { loadMsg = await ctx.reply('\u{1F50D} \u062C\u0627\u0631\u064A \u0627\u0644\u0628\u062D\u062B...'); } catch(_) {}
    try {
      const [res, un] = await Promise.all([smartSearch(q, 12), botUn(ctx)]);
      if (!res || !res.length) {
        if (loadMsg) ctx.deleteMessage(loadMsg.message_id).catch(function(){});
        const m = await ctx.reply('\u274C \u0644\u0627 \u0646\u062A\u0627\u0626\u062C \u0644\u0640 "' + q + '"\n\u{1F4A1} \u062C\u0631\u0628: algo \u00B7 serie \u00B7 td \u00B7 exam').catch(function(){});
        if (m) setTimeout(function(){ ctx.deleteMessage(m.message_id).catch(function(){}); }, 10000);
        return;
      }
      const rows = res.map(function(f) {
        const label = '\u{1F4C4} ' + f.title.substring(0, 35) + (f.sub_name ? ' \u00B7 ' + f.sub_name.substring(0, 15) : '');
        return un ? [{ text: label, url: 'https://t.me/' + un + '?start=file_' + f.id }] : [{ text: label, callback_data: 'grp_dl_' + f.id }];
      });
      if (un) rows.push([{ text: '\u{1F916} \u0641\u062A\u062D \u0627\u0644\u0628\u0648\u062A \u0644\u0644\u062A\u062D\u0645\u064A\u0644', url: 'https://t.me/' + un }]);
      const rTxt = '\u{1F50D} *' + q + '* \u2014 ' + res.length + ' \u0646\u062A\u064A\u062C\u0629\n_\u0627\u0636\u063A\u0637 \u0639\u0644\u0649 \u0627\u0644\u0645\u0644\u0641 \u0644\u0644\u062A\u062D\u0645\u064A\u0644_ \u{1F447}';
      let resultMsg = null;
      if (loadMsg) {
        try {
          resultMsg = await ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null, rTxt, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows } });
        } catch(_) {
          ctx.deleteMessage(loadMsg.message_id).catch(function(){});
          resultMsg = await ctx.reply(rTxt, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows } }).catch(function(){});
        }
      } else {
        resultMsg = await ctx.reply(rTxt, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows } }).catch(function(){});
      }
      const msgId = (resultMsg && resultMsg.message_id) || (loadMsg && loadMsg.message_id);
      if (msgId) { GrpMsgs.add(ctx.chat.id, msgId); setTimeout(function(){ ctx.deleteMessage(msgId).catch(function(){}); }, 90000); }
    } catch(e) {
      logger.error('[search grp]', e.message);
      if (loadMsg) ctx.deleteMessage(loadMsg.message_id).catch(function(){});
    }
    return;
  }
  if (raw) return userH.handleSearch(ctx, raw);
  await global.setState(ctx.uid, { type: 'search' });
  return ctx.reply('\u{1F50D} \u0627\u0643\u062A\u0628 \u0643\u0644\u0645\u0629 \u0627\u0644\u0628\u062D\u062B:').catch(function(){});
});

bot.command('profile', ctx => userH.showProfile(ctx));
bot.command('stats', ctx => userH.showStats(ctx));


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
bot.command('cancel', async ctx => { if (global.getState(ctx.uid)) { await global.delState(ctx.uid); return ctx.reply('❌ تم الإلغاء.').catch(() => {}); } });

bot.command('done', async ctx => {
  const s = global.getState(ctx.uid);
  if (s?.type === 'poll_create' && s.step === 'options') {
    if (!s.options || s.options.length < 2) return ctx.reply('\u26a0\ufe0f أضف خيارين على الأقل').catch(() => {});
    await global.delState(ctx.uid);
    const pollId = await poll.createPoll(ctx, s.chatId, s.question, s.options, s.mediaFileId, s.mediaType);
    if (!pollId) return ctx.reply('\u274c فشل إنشاء التصويت').catch(() => {});
    await poll.sendPoll(ctx, s.chatId, pollId);
    return ctx.reply('\u2705 تم إنشاء التصويت وإرساله للقروب!').catch(() => {});
  }
  if (global.getState(ctx.uid)) { await global.delState(ctx.uid); return ctx.reply('\u274c تم الإلغاء.').catch(() => {}); }
});
bot.command('users', async ctx => {
  if (!ctx.isOwner && !ctx.isAdmin) return ctx.reply('🚫').catch(() => {});
  if (ctx.isAdmin && !ctx.isOwner) { const p = await adminsDb.getPerms(ctx.uid).catch(() => []); if (!p.includes('full') && !p.includes('view_users')) return ctx.reply('🚫').catch(() => {}); }
  return manage.showUsers(ctx);
});
bot.command('new', async ctx => {
  if (ctx.chat?.type === 'private') return;
  await ctx.deleteMessage().catch(()=>{});
  try {
    const gc = await dbAll('SELECT specialty_id FROM group_chats WHERE chat_id=$1',[ctx.chat.id]);
    const spId = gc[0]?.specialty_id;
    if (!spId || spId==0) { const m=await ctx.reply('⚠️ حدد تخصص القروب أولاً: /setsp').catch(()=>{}); if(m)setTimeout(()=>ctx.deleteMessage(m.message_id).catch(()=>{}),7000); return; }
    const files = await dbAll('SELECT f.id,f.title,f.downloads,s.name as sub_name FROM files f JOIN categories c ON f.category_id=c.id JOIN subjects s ON c.subject_id=s.id JOIN semesters sm ON s.semester_id=sm.id JOIN years y ON sm.year_id=y.id WHERE y.specialty_id=$1 AND f.is_deleted=0 ORDER BY f.uploaded_at DESC LIMIT 8',[spId]);
    if (!files.length) { const m=await ctx.reply('📭 لا توجد ملفات جديدة.').catch(()=>{}); if(m)setTimeout(()=>ctx.deleteMessage(m.message_id).catch(()=>{}),7000); return; }
    const un = await botUn(ctx);
    const rows = files.map(f=>{ const lbl='🆕 '+f.title.substring(0,35)+(f.sub_name?' · '+f.sub_name.substring(0,12):''); return un?[{text:lbl,url:'https://t.me/'+un+'?start=file_'+f.id}]:[{text:lbl,callback_data:'grp_dl_'+f.id}]; });
    if (un) rows.push([{text:'🤖 فتح البوت',url:'https://t.me/'+un}]);
    const m = await ctx.reply('🆕 *آخر الملفات في تخصصك:*',{parse_mode:'Markdown',reply_markup:{inline_keyboard:rows}}).catch(()=>{});
    if (m) { GrpMsgs.add(ctx.chat.id,m.message_id); setTimeout(()=>ctx.deleteMessage(m.message_id).catch(()=>{}),90000); }
  } catch(e) { logger.error('[/new]',e.message); }
});
bot.command('top', async ctx => {
  if (ctx.chat?.type === 'private') return;
  await ctx.deleteMessage().catch(()=>{});
  try {
    const gc = await dbAll('SELECT specialty_id FROM group_chats WHERE chat_id=$1',[ctx.chat.id]);
    const spId = gc[0]?.specialty_id;
    if (!spId || spId==0) { const m=await ctx.reply('⚠️ حدد تخصص القروب أولاً: /setsp').catch(()=>{}); if(m)setTimeout(()=>ctx.deleteMessage(m.message_id).catch(()=>{}),7000); return; }
    const files = await dbAll('SELECT f.id,f.title,f.downloads,s.name as sub_name FROM files f JOIN categories c ON f.category_id=c.id JOIN subjects s ON c.subject_id=s.id JOIN semesters sm ON s.semester_id=sm.id JOIN years y ON sm.year_id=y.id WHERE y.specialty_id=$1 AND f.is_deleted=0 ORDER BY f.downloads DESC LIMIT 8',[spId]);
    if (!files.length) { const m=await ctx.reply('📭 لا توجد ملفات.').catch(()=>{}); if(m)setTimeout(()=>ctx.deleteMessage(m.message_id).catch(()=>{}),7000); return; }
    const un = await botUn(ctx);
    const rows = files.map(f=>{ const lbl='🏆 '+f.title.substring(0,30)+(f.sub_name?' · '+f.sub_name.substring(0,12):'')+(f.downloads?' ('+f.downloads+')':''); return un?[{text:lbl,url:'https://t.me/'+un+'?start=file_'+f.id}]:[{text:lbl,callback_data:'grp_dl_'+f.id}]; });
    if (un) rows.push([{text:'🤖 فتح البوت',url:'https://t.me/'+un}]);
    const m = await ctx.reply('🏆 *الأكثر تحميلاً في تخصصك:*',{parse_mode:'Markdown',reply_markup:{inline_keyboard:rows}}).catch(()=>{});
    if (m) { GrpMsgs.add(ctx.chat.id,m.message_id); setTimeout(()=>ctx.deleteMessage(m.message_id).catch(()=>{}),90000); }
  } catch(e) { logger.error('[/top]',e.message); }
});
bot.command('poll', async ctx => {
  if (!['supergroup','group'].includes(ctx.chat?.type)) return;
  let isGroupAdmin = ctx.isOwner;
  if (!isGroupAdmin) {
    try {
      const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
      isGroupAdmin = ['administrator','creator'].includes(member.status);
    } catch(_) {}
  }
  if (!isGroupAdmin) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});

  const chatId = ctx.chat.id;
  // احفظ chatId وأرسل للخاص
  await global.setState(ctx.uid, { type: 'poll_create', step: 'question', chatId });
  try {
    await ctx.telegram.sendMessage(ctx.from.id,
      '🗳️ *إنشاء تصويت جديد*\n\n📝 أرسل *السؤال* أو صورة/فيديو مع السؤال كـ caption:',
      { parse_mode: 'Markdown' }
    );
    await ctx.reply('📩 تم إرسال رابط الإنشاء في الخاص!').catch(() => {});
    setTimeout(() => ctx.deleteMessage().catch(() => {}), 3000);
  } catch(e) {
    await ctx.reply('⚠️ افتح البوت في الخاص أولاً: @' + (await ctx.telegram.getMe()).username).catch(() => {});
  }
});

bot.command('polls', async ctx => {
  if (!['supergroup','group'].includes(ctx.chat?.type)) return;
  const polls = await require('./database/db').all(
    'SELECT id, question, created_at FROM polls WHERE chat_id=$1 AND is_closed=0 ORDER BY created_at DESC LIMIT 10',
    [ctx.chat.id]
  ).catch(() => []);
  if (!polls.length) return ctx.reply('📭 لا يوجد تصويتات').catch(() => {});
  let text = '📊 *التصويتات النشطة:*\n\n';
  polls.forEach((p, i) => { text += `${i+1}. ${p.question} — /delpoll_${p.id}
`; });
  return ctx.reply(text, { parse_mode: 'Markdown' }).catch(() => {});
});

bot.command('setwelcome', async ctx => {
  if (!ctx.isOwner && !ctx.isAdmin) return ctx.reply('🚫 للمشرفين فقط').catch(()=>{});
  // يشتغل في الخاص فقط
  if (ctx.chat?.type !== 'private') {
    try {
      await ctx.telegram.sendMessage(ctx.from.id, '📸 أرسل الصورة التي تريدها لرسالة الترحيب لكل القروبات:');
      await global.setState(ctx.uid, { type: 'set_welcome_image', chatId: 'all' });
    } catch(e) {
      await ctx.reply('⚠️ افتح البوت في الخاص أولاً').catch(()=>{});
    }
    setTimeout(() => ctx.deleteMessage().catch(()=>{}), 3000);
    return;
  }
  await global.setState(ctx.uid, { type: 'set_welcome_image', chatId: 'all' });
  return ctx.reply('📸 أرسل الصورة التي تريدها لرسالة الترحيب لكل القروبات:').catch(()=>{});
});

bot.command('setwelcomemsg', async ctx => {
  if (!ctx.isOwner && !ctx.isAdmin) return ctx.reply('🚫 للمشرفين فقط').catch(()=>{});
  if (ctx.chat?.type !== 'private') {
    try {
      await ctx.telegram.sendMessage(ctx.from.id, '✏️ أرسل نص رسالة الترحيب:\nاستخدم {name} لاسم العضو و {spec} للتخصص');
      await global.setState(ctx.uid, { type: 'set_welcome_msg', chatId: 'all' });
    } catch(e) {
      await ctx.reply('⚠️ افتح البوت في الخاص أولاً').catch(()=>{});
    }
    setTimeout(() => ctx.deleteMessage().catch(()=>{}), 3000);
    return;
  }
  await global.setState(ctx.uid, { type: 'set_welcome_msg', chatId: 'all' });
  return ctx.reply('✏️ أرسل نص رسالة الترحيب:\nاستخدم {name} لاسم العضو و {spec} للتخصص').catch(()=>{});
});

bot.command('clearwelcome', async ctx => {
  if (!['supergroup','group'].includes(ctx.chat?.type)) return;
  if (!ctx.isOwner && !ctx.isAdmin) return;
  const { clearWelcome } = require('./handlers/group_admin');
  await clearWelcome(ctx.chat.id);
  ctx.reply('✅ تم مسح إعدادات الترحيب').catch(()=>{});
  setTimeout(() => ctx.deleteMessage().catch(()=>{}), 3000);
});

bot.command('all', async ctx => {
  if (!['supergroup','group'].includes(ctx.chat?.type)) return;
  // تحقق من admin في Telegram مباشرة
  let isGroupAdmin = ctx.isOwner;
  if (!isGroupAdmin) {
    const cacheKey = 'grp_admin_' + ctx.chat.id + '_' + ctx.from.id;
    let cached = require('./utils/cache').cacheGet(cacheKey);
    if (cached === null) {
      try {
        const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
        cached = ['administrator','creator'].includes(member.status) ? 1 : 0;
        require('./utils/cache').cacheSet(cacheKey, cached, 300000);
      } catch(_) { cached = 0; }
    }
    isGroupAdmin = cached === 1;
  }
  if (!isGroupAdmin) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});
  require('./utils/cache').cacheClear('grp_members_' + ctx.chat.id);
  try { const { showAllMembers } = require('./handlers/group_admin'); await showAllMembers(ctx, ctx.chat.id); }
});
bot.command('tag', async ctx => {
  if (!['supergroup','group'].includes(ctx.chat?.type)) return;
  let isGroupAdmin = ctx.isOwner;
  if (!isGroupAdmin) {
    try {
      const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
      isGroupAdmin = ['administrator','creator'].includes(member.status);
    } catch(_) {}
  }
  if (!isGroupAdmin) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});
  try { const { tagAll } = require('./handlers/group_admin'); await tagAll(ctx, ctx.chat.id); }
  catch(e) { ctx.reply('❌').catch(() => {}); }
});
bot.command('mute', async ctx => {
  if (!['supergroup','group'].includes(ctx.chat?.type)) return;
  let isGroupAdmin = ctx.isOwner;
  if (!isGroupAdmin) {
    try {
      const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
      isGroupAdmin = ['administrator','creator'].includes(member.status);
    } catch(_) {}
  }
  if (!isGroupAdmin) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});
  try { const { muteAll } = require('./handlers/group_admin'); await muteAll(ctx, ctx.chat.id); }
  catch(e) { ctx.reply('❌').catch(() => {}); }
});
bot.command('unmute', async ctx => {
  if (!['supergroup','group'].includes(ctx.chat?.type)) return;
  let isGroupAdmin = ctx.isOwner;
  if (!isGroupAdmin) {
    try {
      const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
      isGroupAdmin = ['administrator','creator'].includes(member.status);
    } catch(_) {}
  }
  if (!isGroupAdmin) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});
  try { const { unmuteAll } = require('./handlers/group_admin'); await unmuteAll(ctx, ctx.chat.id); }
  catch(e) { ctx.reply('❌').catch(() => {}); }
});
bot.command('help', ctx => ctx.reply(
  '📚 *أوامر البوت*\n\n/start — الرئيسية\n/search — البحث\n/profile — شخصي\n/stats — إحصائيات\n/cancel — إلغاء\n/ai — مساعد ذكي\n/reset — مسح سياق\n\n👑 *المشرفين:*\n/admin — الإدارة',
  { parse_mode: 'Markdown' }
).catch(() => {}));

const exactR = new Map([
  ['tag_all_', (ctx, d) => { const { tagAll } = require('./handlers/group_admin'); return tagAll(ctx, parseInt(d.replace('tag_all_',''))); }],
  ['mute_all_', (ctx, d) => { const { muteAll } = require('./handlers/group_admin'); return muteAll(ctx, parseInt(d.replace('mute_all_',''))); }],
  ['unmute_all_', (ctx, d) => { const { unmuteAll } = require('./handlers/group_admin'); return unmuteAll(ctx, parseInt(d.replace('unmute_all_',''))); }],

  ['noop', () => {}],
  ['main_menu', ctx => startHandler(ctx)],
  ['mg_menu',    ctx => { if (!ctx.isAdmin) return ctx.answerCbQuery('🚫', {show_alert:true}).catch(()=>{}); return manage.mainMenu(ctx); }],
  ['mg_content', ctx => { if (!ctx.isAdmin) return ctx.answerCbQuery('🚫', {show_alert:true}).catch(()=>{}); return manage.handleCallback(ctx, 'mg_content'); }],
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
  ['ai_reset', ctx => { const { resetChat } = require('./handlers/ai_chat'); resetChat(ctx.uid); return ctx.reply('🔄 تم مسح سياق المحادثة.').catch(() => {}); }],
  ['clear_my_history', async ctx => {
    const { run: _dhr } = require('./database/db');
    await _dhr('DELETE FROM history WHERE user_id=$1',[ctx.uid]).catch(()=>{});
    cacheClear('lastfile_'+ctx.uid); cacheClear('rec_'+ctx.uid);
    return ctx.answerCbQuery('✅ تم مسح سجلك',{show_alert:true}).catch(()=>{});
  }],
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
  { p: 'yr_page_', fn: (ctx, d) => { const p = d.substring(8).split('_'); return browse.showYears(ctx, p[0], parseInt(p[1])); } },
  { p: 'yr_', fn: (ctx, d) => { const p = d.split('_'); return browse.showSemesters(ctx, p[1], p[2]); } },
  { p: 'sm_', fn: (ctx, d) => { const p = d.split('_'); return browse.showSubjects(ctx, p[1], p[2], p[3]); } },
  { p: 'sb_page_', fn: (ctx, d) => { const p = d.substring(8).split('_'); return browse.showSubjects(ctx, p[0], p[1], p[2], parseInt(p[3])); } },
  { p: 'sb_', fn: (ctx, d) => { const p = d.split('_'); return browse.showCategories(ctx, p[1], p[2], p[3], p[4]); } },
  { p: 'ct_page_', fn: (ctx, d) => { const p = d.substring(8).split('_'); return browse.showFiles(ctx, p[0], p[1], p[2], p[3], p[4], parseInt(p[5])); } },
  { p: 'ct_', fn: (ctx, d) => { const p = d.split('_'); return browse.showFiles(ctx, p[1], p[2], p[3], p[4], p[5]); } },
  { p: 'fl_', fn: (ctx, d) => { const p = d.split('_'); return browse.sendFile(ctx, p[1], p[2], p[3], p[4], p[5], p[6]); } },
  { p: 'preview_', fn: (ctx, d) => { const p = d.split('_'); return browse.showPreview(ctx, p[1], p[2], p[3], p[4], p[5], p[6]); } },
  { p: 'bundle_', fn: (ctx, d) => { const p = d.split('_'); return browse.showBundle(ctx, p[1], p[2], p[3], p[4], p[5], p[6]); } },
  { p: 'bdl_', fn: (ctx, d) => { const p = d.split('_'); return browse.sendBundle(ctx, p[1], p[2], p[3], p[4], p[5], p[6]); } },
  // [PATCHED] page handlers moved above
  { p: 'sbs_', fn: (ctx, d) => { const p = d.substring(4).split('_'); return browse.showSubjects(ctx, p[0], p[1], p[2]); } },
  { p: 'yrs_', fn: (ctx, d) => { const p = d.substring(4).split('_'); return browse.showYears(ctx, p[0]); } },
  { p: 'sms_', fn: (ctx, d) => { const p = d.substring(4).split('_'); return browse.showSemesters(ctx, p[0], p[1]); } },
  { p: 'unfav_', fn: (ctx, d) => userH.toggleFav(ctx, safeInt(d.substring(6)), true) },
  { p: 'fav_', fn: (ctx, d) => userH.toggleFav(ctx, safeInt(d.substring(4)), false) },
  { p: 'set_sp_', fn: async (ctx, d) => { await usersDb.setSpecialty(ctx.uid, safeInt(d.substring(7))); await ctx.answerCbQuery('✅ تم حفظ تخصصك').catch(() => {}); return startHandler.showMainMenu(ctx); } },
  { p: 'lang_', fn: (ctx, d) => { setLang(ctx.uid, d.substring(5)); return userH.showProfile(ctx); } },
  { p: 'rate_', fn: async (ctx, d) => { const p = d.substring(5).split('_'); await interactions.addRating(ctx.uid, p[0], parseInt(p[1])); await ctx.answerCbQuery('⭐ تم التقييم!').catch(() => {}); cacheClear('personal_'+ctx.uid+'_'+p[0]); return browse.showPreview(ctx, p[0], p[2], p[3], p[4], p[5], p[6]); } },
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


// O(1) callback prefix dispatcher — built from prefR at startup
let _prefixMap = null;
function _getPrefixHandler(data) {
  if (!_prefixMap) {
    // Sort by length descending so longer prefixes match first
    const sorted = [...prefR].sort((a, b) => b.p.length - a.p.length);
    _prefixMap = sorted;
  }
  for (const r of _prefixMap) if (data.startsWith(r.p)) return r.fn;
  return null;
}

bot.on('callback_query', async ctx => {
  const _raw = ctx.callbackQuery?.data, cbId = ctx.callbackQuery?.id;
  if (!_raw || CBDedup.isDupe(cbId)) return;
  const data = cbRes(_raw); // resolve registry key → full data
  try {
    // no blanket answerCbQuery — saves 100ms per click
    if (ctx.chat?.type !== 'private' && !data.startsWith('grp_') && !data.startsWith('tag_all_') && !data.startsWith('mute_all_') && !data.startsWith('unmute_all_') && !data.startsWith('vote_') && !data.startsWith('poll_')) return ctx.answerCbQuery('👉 استخدم البوت في الخاص').catch(() => {});
    if (exactR.has(data)) return exactR.get(data)(ctx);
    // Group admin prefix callbacks
    if (data.startsWith('vote_')) {
      const parts = data.split('_');
      return poll.castVote(ctx, parseInt(parts[1]), parseInt(parts[2]));
    }
    if (data.startsWith('poll_results_')) {
      return poll.showPollResults(ctx, parseInt(data.replace('poll_results_','')));
    }
    if (data === 'poll_closed_notice') return ctx.answerCbQuery('🔒 التصويت مغلق!', { show_alert: true }).catch(()=>{});
    if (data.startsWith('leave_grp_')) {
      const chatId = parseInt(data.replace('leave_grp_',''));
      try {
        await ctx.telegram.leaveChat(chatId);
        await require('./database/db').run('DELETE FROM group_chats WHERE chat_id=$1', [chatId]);
        return ctx.answerCbQuery('✅ تم الخروج').catch(()=>{});
      } catch(e) {
        return ctx.answerCbQuery('❌ ' + e.message, { show_alert: true }).catch(()=>{});
      }
    }
    if (data.startsWith('poll_reset_')) { return poll.resetPoll(ctx, parseInt(data.replace('poll_reset_',''))); }
    if (data.startsWith('poll_delete_')) { return poll.deletePoll(ctx, parseInt(data.replace('poll_delete_',''))); }
    if (data.startsWith('poll_close_')) {
      return poll.closePoll(ctx, parseInt(data.replace('poll_close_','')));
    }
    if (data.startsWith('poll_refresh_')) {
      ctx.answerCbQuery('🔄').catch(()=>{});
      return poll.refreshPollMessage(ctx, parseInt(data.replace('poll_refresh_','')));
    }
    if (data.startsWith('tag_all_')) { const { tagAll } = require('./handlers/group_admin'); return tagAll(ctx, parseInt(data.replace('tag_all_',''))); }
    if (data.startsWith('mute_all_')) { const { muteAll } = require('./handlers/group_admin'); return muteAll(ctx, parseInt(data.replace('mute_all_',''))); }
    if (data.startsWith('unmute_all_')) { const { unmuteAll } = require('./handlers/group_admin'); return unmuteAll(ctx, parseInt(data.replace('unmute_all_',''))); }
    const _h = _getPrefixHandler(data);
  if (_h) return _h(ctx, data);
  } catch(e) { logger.error('[CB]', e.message, { data, uid: ctx.from?.id }); }
});

bot.on('message', async (ctx, next) => {
  // Photo/Video/Document handler
  if (ctx.message?.photo || ctx.message?.video || ctx.message?.document) {
    const s = global.getState(ctx.uid);

    // إشعار القروبات بوسائط
    if (s?.type === 'mg_notify_groups_msg') {
      const msg = ctx.message;
      let mediaFileId = null, mediaType = null;
      if (msg.photo) { mediaFileId = msg.photo[msg.photo.length-1].file_id; mediaType = 'photo'; }
      else if (msg.video) { mediaFileId = msg.video.file_id; mediaType = 'video'; }
      else if (msg.document) { mediaFileId = msg.document.file_id; mediaType = 'document'; }
      const text = msg.caption || '';
      const { all: dbAll } = require('./database/db');
      const groups = s.spId === '0' ? await dbAll('SELECT chat_id FROM group_chats') : await dbAll('SELECT chat_id FROM group_chats WHERE specialty_id=$1', [s.spId]);
      let gSent = 0, gFail = 0;
      const msgText = text;
      for (const g of groups) {
        try {
          if (mediaType === 'photo') await ctx.telegram.sendPhoto(g.chat_id, mediaFileId, { caption: msgText, parse_mode: 'Markdown' });
          else if (mediaType === 'video') await ctx.telegram.sendVideo(g.chat_id, mediaFileId, { caption: msgText, parse_mode: 'Markdown' });
          else if (mediaType === 'document') await ctx.telegram.sendDocument(g.chat_id, mediaFileId, { caption: msgText, parse_mode: 'Markdown' });
          gSent++;
        } catch(_) { gFail++; }
        await new Promise(r => setTimeout(r, 600));
      }
      await global.delState(ctx.uid);
      return ctx.reply('✅ أُرسل لـ *' + gSent + '* قروب' + (gFail ? ' | ❌ ' + gFail : ''), { parse_mode: 'Markdown' }).catch(() => {});
    }

    if (s?.type === 'set_welcome_image') {
      const fileId = ctx.message.photo[ctx.message.photo.length-1].file_id;
      const { setWelcomeImage } = require('./handlers/group_admin');
      const { all: dbAll } = require('./database/db');
      const groups = await dbAll('SELECT chat_id FROM group_chats').catch(()=>[]);
      for (const g of groups) await setWelcomeImage(ctx, g.chat_id, fileId).catch(()=>{});
      await setWelcomeImage(ctx, 0, fileId).catch(()=>{});
      await global.delState(ctx.uid);
      return ctx.reply('✅ تم تعيين صورة الترحيب لـ ' + groups.length + ' قروب!').catch(()=>{});
    }
    // Poll creation with photo
    const ps = global.getState(ctx.uid);
    if (ps?.type === 'poll_create' && ps.step === 'question') {
      const question = ctx.message.caption || '';
      if (!question) return ctx.reply('⚠️ أضف caption للصورة كسؤال التصويت').catch(()=>{});
      const mediaFileId = ctx.message.photo[ctx.message.photo.length-1].file_id;
      await global.setState(ctx.uid, { type: 'poll_create', step: 'options', chatId: ps.chatId, question, mediaFileId, mediaType: 'photo', options: [] });
      return ctx.reply('✅ السؤال: ' + question + '\n\n📝 أرسل الخيارات واحداً تلو الآخر.\nاكتب /done عند الانتهاء').catch(()=>{});
    }
  }
  if (ctx.chat?.type === 'private' && ctx.from?.id === OWNER_ID && ctx.message?.text?.startsWith('!')) return ownerH.handle(ctx, ctx.message.text);
  if (ctx.chat?.type !== 'private') {
    if (ctx.from && !ctx.from.is_bot) {
      GrpBuf.add(ctx.chat.id, ctx.from.id, ctx.from.username, ctx.from.first_name);
      // سجّل في group_members تلقائياً
      const { run } = require('./database/db');
      run(
        'INSERT INTO group_members(chat_id,user_id,username,first_name,updated_at) VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP) ON CONFLICT(chat_id,user_id) DO UPDATE SET first_name=EXCLUDED.first_name,updated_at=CURRENT_TIMESTAMP',
        [ctx.chat.id, ctx.from.id, ctx.from.username||'', ctx.from.first_name||'عضو']
      ).catch(()=>{});
    }
    const s = global.getState(ctx.uid);
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
  const s = global.getState(ctx.uid);
  if (ctx.isOwner) {
    const isFwd = !!(ctx.message.forward_from || ctx.message.forward_from_chat || ctx.message.forward_sender_name);
    const hasCap = !!(ctx.message.caption && /تخصص:|سنة:|spec:|year:|sem:|mat:|cat:/i.test(ctx.message.caption));
    if (isFwd && !hasCap && !s) {
      await global.setState(ctx.uid, { type: 'pending_forward', doc: ctx.message.document, photo: null });
      await ctx.reply('\u{1F4CE} \u0645\u0644\u0641 \u0645\u062D\u0641\u0648\u0638! \u0623\u0631\u0633\u0644 \u0627\u0644\u0645\u0633\u0627\u0631:\n`\u062A\u062E\u0635\u0635: X | \u0633\u0646\u0629: X | \u0641\u0635\u0644: X | \u0645\u0627\u062F\u0629: X | \u0642\u0633\u0645: X`', { parse_mode: 'Markdown' }).catch(()=>{});
      return;
    }
  }
  if (await tools.trySmartUpload(ctx)) return;
  if (s?.type === 'mg_bundle_files') return manage.handleBundleFileUpload(ctx);
  if (s?.type === 'mg_bulk_files') return manage.handleBulkUpload(ctx);
  if (s?.type === 'mg_tpl_file') { await global.setState(ctx.uid, { ...s, type: 'mg_tpl_content', fileId: ctx.message.document.file_id }); return ctx.reply('✏️ اكتب نص الرسالة (أو skip):').catch(() => {}); }
  if (s?.type === 'mg_awaiting_restore' && ctx.isOwner) {
    await global.delState(ctx.uid);
    const msg = await ctx.reply('⏳ جاري الاستعادة...').catch(()=>{});
    try {
      const link = await ctx.telegram.getFileLink(ctx.message.document.file_id);
      // Download JSON backup
      const raw = await new Promise((resolve, reject) => {
        let data = '';
        https.get(link.href, res => {
          res.on('data', c => data += c);
          res.on('end', () => resolve(data));
        }).on('error', reject);
      });
      const backup = JSON.parse(raw);
      if (!backup.tables) throw new Error('ملف غير صالح — يجب أن يكون backup JSON');
      let restored = 0, errors = 0;
      for (const [table, rows] of Object.entries(backup.tables)) {
        if (!rows.length) continue;
        try {
          const SAFE_TABLES = new Set(['users','admins','specialties','years','semesters','subjects','categories','files','favorites','history','ratings','user_specialties','settings','bundles','bundle_files','message_templates','scheduled_messages','comments','reports','group_chats','group_members','group_chats']);
          if (!SAFE_TABLES.has(table)) { errors++; logger.warn('[Restore] blocked unsafe table: ' + table); continue; }
          const cols = Object.keys(rows[0]).filter(c => /^[a-zA-Z_][a-zA-Z0-9_]{0,59}$/.test(c));
          if (!cols.length) { errors++; continue; }
          const ph   = rows.map((_, ri) => '(' + cols.map((_, ci) => '$' + (ri * cols.length + ci + 1)).join(',') + ')').join(',');
          const vals = rows.flatMap(r => cols.map(c => r[c]));
          await dbRun('INSERT INTO ' + table + '(' + cols.join(',') + ') VALUES ' + ph + ' ON CONFLICT DO NOTHING', vals);
          restored += rows.length;
        } catch(e) { errors++; logger.error('[Restore]', table, e.message); }
      }
      if (msg) ctx.deleteMessage(msg.message_id).catch(()=>{});
      ctx.reply('✅ تمت الاستعادة\n\n' + restored + ' سجل | ' + errors + ' خطأ').catch(()=>{});
    } catch(e) {
      if (msg) ctx.deleteMessage(msg.message_id).catch(()=>{});
      ctx.reply('❌ فشلت الاستعادة: ' + e.message).catch(() => {});
    }
    return;
  }
  if (s?.type === 'mg_file') return manage.handleFileUpload(ctx);
});

bot.on(['photo', 'video', 'audio', 'voice'], async ctx => {
  if (!ctx.isAdmin && !ctx.isOwner) return;
  const s = global.getState(ctx.uid);
  if (s?.type === 'mg_bulk_files') return manage.handleBulkUpload(ctx);
  if (s?.type === 'mg_bundle_files') return manage.handleBundleFileUpload(ctx);
  if (s?.type === 'mg_file') return manage.handleFileUpload(ctx);
  if (s?.type === 'mg_tpl_content') return manage.handleText(ctx, s);
});

bot.on('text', async ctx => { try {
  if (ctx.message.text.startsWith('/')) return;
  const uid = ctx.uid, s = global.getState(uid); if (!s) return;
  const txt = ctx.message.text.trim();
  // Poll creation flow — يشتغل في أي وضع
  const pollState = global.getState(ctx.uid);
  if (pollState?.type === 'poll_create') {
    const step = pollState.step;
    const chatId = pollState.chatId;
    if (step === 'question') {
      const question = ctx.message.caption || ctx.message.text || '';
      const mediaFileId = ctx.message.photo ? ctx.message.photo[ctx.message.photo.length-1].file_id :
                         ctx.message.video ? ctx.message.video.file_id : null;
      const mediaType = ctx.message.photo ? 'photo' : ctx.message.video ? 'video' : null;
      await global.setState(ctx.uid, { type: 'poll_create', step: 'options', chatId, question, mediaFileId, mediaType, options: [] });
      return ctx.reply('✅ السؤال: ' + question + '\n\n📝 أرسل الخيارات واحداً تلو الآخر.\nمثال: 🔴 صعبة\n\nاكتب /done عند الانتهاء', { parse_mode: 'Markdown' }).catch(() => {});
    }
    if (step === 'options') {
      const optText = (ctx.message.text || '').trim();
      const emoji = optText.match(/^(\p{Emoji})/u)?.[1] || '🔵';
      const text = optText.replace(/^(\p{Emoji}\s*)/u, '').trim() || optText;
      const opts = pollState.options || [];
      opts.push({ emoji, text });
      await global.setState(ctx.uid, { ...pollState, options: opts });
      return ctx.reply('✅ الخيار ' + opts.length + ': ' + emoji + ' ' + text + '\n\n' + (opts.length >= 2 ? 'اكتب /done للإنشاء أو أضف المزيد' : 'أضف خياراً آخر على الأقل'), { parse_mode: 'Markdown' }).catch(() => {});
    }
    return;
  }

  if (s.type === 'ai_mode' && ctx.chat?.type === 'private') {
    if (txt.length > 1000) return ctx.reply('⚠️ الحد 1000 حرف.').catch(() => {});
    if (ctx.isOwner && await handleOwnerAI(ctx, txt, null, null)) return;
    const pollState2 = null; // already handled above
    if (pollState?.type === 'poll_create') {
      const step = pollState.step;
      const chatId = pollState.chatId;

      if (step === 'question') {
        const question = ctx.message.caption || ctx.message.text || '';
        const mediaFileId = ctx.message.photo ? ctx.message.photo[ctx.message.photo.length-1].file_id :
                           ctx.message.video ? ctx.message.video.file_id : null;
        const mediaType = ctx.message.photo ? 'photo' : ctx.message.video ? 'video' : null;
        await global.setState(ctx.uid, { type: 'poll_create', step: 'options', chatId, question, mediaFileId, mediaType, options: [] });
        return ctx.reply('✅ *السؤال:* ' + question + '\n\n📝 الآن أرسل *خيارات التصويت* واحداً تلو الآخر.\nمثال: 🔴 صعبة\n\nاكتب /done عند الانتهاء (2-8 خيارات)', { parse_mode: 'Markdown' }).catch(() => {});
      }

      if (step === 'options') {
        const optText = (ctx.message.text || '').trim();
        const emoji = optText.match(/^(\p{Emoji})/u)?.[1] || '🔵';
        const text = optText.replace(/^(\p{Emoji}\s*)/u, '').trim() || optText;
        const opts = pollState.options || [];
        opts.push({ emoji, text });
        await global.setState(ctx.uid, { ...pollState, options: opts });
        return ctx.reply(`✅ الخيار ${opts.length}: ${emoji} ${text}

${opts.length >= 2 ? 'اكتب /done للإنشاء أو أضف المزيد' : 'أضف خياراً آخر على الأقل'}`, { parse_mode: 'Markdown' }).catch(() => {});
      }
      return;
    }

    if (await handleAiChat(ctx, txt)) return;
  }
  if (s.type === 'mg_file') return manage.handleFileUpload(ctx);
  if (s.type === 'mg_bulk_prefix') return manage.handleText(ctx, s);
  if (s.type === 'mg_bulk_files' && txt !== '/done') return manage.handleText(ctx, s);
  if (s.type === 'mg_tpl_link') { await global.setState(ctx.uid, { ...s, type: 'mg_tpl_content', fileId: txt }); return ctx.reply('✏️ اكتب نص الرسالة (أو skip):').catch(() => {}); }
  if (s?.type === 'pending_forward' && ctx.isOwner) {
    const pTrig = /تخصص:|سنة:|فصل:|مادة:|قسم:|spec:|year:|sem:|mat:|cat:/i;
    if (pTrig.test(txt)) {
      const sv = s; await global.delState(ctx.uid);
      const fCtx = Object.assign({}, ctx, { message: Object.assign({}, ctx.message, { document: sv.doc, photo: sv.photo, caption: txt }) });
      if (await tools.trySmartUpload(fCtx)) return;
    }
  }
  if (s.type === 'search') return userH.handleSearch(ctx, txt);
  if (s.type === 'add_comment') {
    if (!txt || txt === '/cancel') { await global.delState(ctx.uid); return ctx.reply('❌ تم الإلغاء.').catch(() => {}); }
    if (txt.length > 500) return ctx.reply('⚠️ الحد 500 حرف.').catch(() => {});
    await commentsDb.addComment(s.fid, ctx.uid, txt); await global.delState(ctx.uid);
    cacheClear('cmts_' + s.fid + '_0'); cacheClear('cmts_' + s.fid + '_1');
    await ctx.reply('✅ تم إضافة تعليقك!').catch(() => {});
    try{const _cf=await filesDb.getFile(s.fid);if(_cf)ctx.telegram.sendMessage(OWNER_ID,'💬 *تعليق جديد*\n📄 '+_cf.title+'\n👤 '+(ctx.from.first_name||'')+'\n\n'+txt.substring(0,300),{parse_mode:'Markdown'}).catch(()=>{});}catch(_){}
    return browse.showComments(ctx, s.fid, s.spId, s.yrId, s.smId, s.sbId, s.catId);
  }
    if ((s?.type || '').startsWith('mg_') && ctx.isAdmin) return manage.handleText(ctx, s);
  } catch(e) { logger.error('[TextHandler]', e.message, { uid: ctx.from?.id }); }
});

bot.on('chat_member', async ctx => {
  try {
    const member = ctx.chatMember?.new_chat_member;
    const chat = ctx.chatMember?.chat;
    const old_status = ctx.chatMember?.old_chat_member?.status;
    if (!member || !chat) return;
    // عضو جديد دخل
    if (['left','kicked'].includes(old_status) && !['left','kicked'].includes(member.status)) {
      const { handleNewMember } = require('./handlers/group_admin');
      await handleNewMember(bot, chat.id, member.user.id, member.user.first_name);
    }
    // عضو خرج → احذفه من DB
    if (!['left','kicked'].includes(old_status) && ['left','kicked'].includes(member.status)) {
      const { handleMemberLeft } = require('./handlers/group_admin');
      await handleMemberLeft(chat.id, member.user.id);
    }
  } catch(e) { console.error('[chat_member]', e.message); }
});

bot.on('my_chat_member', async ctx => {
  const chat = ctx.myChatMember?.chat, member = ctx.myChatMember?.new_chat_member;
  if (!chat || chat.type === 'private') return;
  if (!global._cachedBotId) { try { global._cachedBotId = (await ctx.telegram.getMe()).id; } catch(_) { return; } }
  if (member?.user?.id !== global._cachedBotId) return;
  if (['member', 'administrator'].includes(member?.status)) {
    try {
      await dbRun('INSERT INTO group_chats(chat_id,title) VALUES($1,$2) ON CONFLICT(chat_id) DO UPDATE SET title=EXCLUDED.title', [chat.id, chat.title || '']);
    logger.info('[Group Joined]', chat.id, chat.title);
      const sp = await dbAll('SELECT id,name FROM specialties WHERE is_deleted=0 ORDER BY id');
      await ctx.telegram.sendMessage(chat.id, 'مرحباً! أنا بوت الدراسة\n\nاختر تخصص هذا القروب:', { reply_markup: { inline_keyboard: sp.map(s => [{ text: '🎓 ' + s.name, callback_data: 'grp_sp_' + chat.id + '_' + s.id }]) } });
    } catch(e) { if(!e.message?.includes('TOPIC_CLOSED')&&!e.message?.includes('CHAT_WRITE_FORBIDDEN'))logger.error('[GrpJoin]',e.message); }
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
    app.use(bot.webhookCallback('/webhook/' + TOKEN, { secretToken: WEBHOOK_SECRET || undefined }));
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
setupGroupCommands(bot);
  if (WEBHOOK_URL) {
    await bot.telegram.setWebhook(WEBHOOK_URL + '/webhook/' + TOKEN, { allowed_updates: ['message', 'callback_query', 'my_chat_member', 'chat_member', 'inline_query'], drop_pending_updates: true, max_connections: 100, ...(WEBHOOK_SECRET && { secret_token: WEBHOOK_SECRET }) });
    logger.info('✅ Webhook: ' + WEBHOOK_URL);
  } else {
    logger.warn('⚠️ No WEBHOOK_URL - using polling');
    bot.launch({ drop_pending_updates: true });
  }
    global.__bot = bot; // _clearSearchCache set in handlers/group.js // startSmartWarmup(); // disabled: cacheWarmup sufficient
    logger.info('🚀 Ready');
  } catch(e) { logger.error('[Launch]', e.message); setTimeout(launch, 10000); }
}

async function shutdown(sig) {
  logger.info('[Shutdown] ' + sig);
  try { bot.stop(sig); await GrpBuf.stop(); const pg = getPg(); if (pg) await pg.end(); process.exit(0); } catch(e) { process.exit(1); }
}


bot.on('inline_query', async ctx => {
  var q = (ctx.inlineQuery && ctx.inlineQuery.query || '').trim();
  if (q.length < 2) { ctx.answerInlineQuery([], {cache_time:5}); return; }
  try {
    var res = await smartSearch(q, 10);
    var un = _botUn || '';
    var items = res.slice(0, 10).map(function(f) {
      var url = un ? ('https://t.me/' + un + '?start=file_' + f.id) : '';
      var txt = url ? ('[' + f.title + '](' + url + ')') : f.title;
      var item = {type:'article', id:String(f.id), title:f.title,
        description: f.sub_name || '',
        input_message_content: {message_text: txt, parse_mode: 'Markdown'}};
      if (url) item.reply_markup = {inline_keyboard:[[{text:'Download', url:url}]]};
      return item;
    });
    ctx.answerInlineQuery(items, {cache_time:30});
  } catch(e) { ctx.answerInlineQuery([], {cache_time:5}); }
});

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', e => logger.error('[Uncaught]', e.message));
process.on('unhandledRejection', e => logger.error('[Rejection]', e?.message || e));

const _cln = setInterval(async () => {
  try {
    await Promise.all([
      dbRun("DELETE FROM user_states WHERE updated_at::timestamp < NOW() - INTERVAL '1 hour'").catch(() => {}),
      dbRun("DELETE FROM group_members WHERE updated_at::timestamp < NOW() - INTERVAL '30 days'").catch(() => {}),
      dbRun("DELETE FROM cache_store WHERE expires_at::bigint < $1::bigint", [Date.now()]).catch(() => {}),
    ]);
    GrpMsgs.prune();
    
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
