'use strict';
var safeInt = function(v) { var n = parseInt(v); return isNaN(n) ? 0 : n; };
const { groqChat } = require('../utils/groq_client');
const { all } = require('../database/db');
const filesDb = require('../database/files');
const { build, btn } = require('../utils/keyboard');
.replace(/[*_`\[\]()~>#+=|{}.!\-]/g,'\\$&');

async function classifyFile(filename, subjects, categories) {
  var subList = subjects.map(function(s) { return s.name; }).join(', ');
  var catList = [];
  var seen = {};
  for (var i = 0; i < categories.length; i++) {
    if (!seen[categories[i].name]) { seen[categories[i].name] = true; catList.push(categories[i].name); }
  }
  catList = catList.join(', ');
  var prompt = 'You are a university file classifier. Given filename suggest subject and category.\nFilename: "' + filename + '"\nSubjects: ' + subList + '\nCategories: ' + catList + '\nRespond ONLY with JSON: {"subject":"Name","category":"Name","confidence":0.9}';
  try {
    var reply = await groqChat([{ role: 'user', content: prompt }], 60, 0.1);
    return JSON.parse(reply);
  } catch(e) { return null; }
}

async function handleAdd(ctx) {
  if (!ctx.isOwner) return ctx.deleteMessage().catch(function(){});
  if (ctx.chat?.type === 'private') return ctx.reply('هذا الأمر للقروبات فقط');
  ctx.deleteMessage().catch(function(){});
  await require('../utils/stateManager').setState(ctx.uid, { type: 'add_mode', chatId: ctx.chat.id });
  ctx.reply('📥 وضع الإضافة — فوّرد الملفات\n/done للإنهاء').catch(function(){});
}

async function handleAddFile(ctx) {
  var state = require('../utils/stateManager').getState(uid) || {}
// ctx.uid];
  if (!state || state.type !== 'add_mode') return false;
  var msg = ctx.message;
  var fid, ftype, filename = '';
  if (msg.document) { fid = msg.document.file_id; ftype = 'document'; filename = msg.document.file_name || ''; }
  else if (msg.photo) { fid = msg.photo[msg.photo.length - 1].file_id; ftype = 'photo'; filename = 'photo'; }
  else if (msg.video) { fid = msg.video.file_id; ftype = 'document'; filename = 'video'; }
  else return false;
  var title = filename.replace(/\.[^/.]+$/, '') || 'ملف';
  var subjects = await all('SELECT id, name FROM subjects WHERE is_deleted=0');
  var categories = await all('SELECT id, name FROM categories');
  var ai = await classifyFile(filename, subjects, categories);
  var suggestedSub = ai ? subjects.find(function(s) { return s.name.toLowerCase() === (ai.subject || '').toLowerCase(); }) : null;
  var suggestedCat = ai ? categories.find(function(c) { return c.name.toLowerCase() === (ai.category || '').toLowerCase(); }) : null;
  await require('../utils/stateManager').setState(ctx.uid, {
    type: 'add_confirm', fid: fid, ftype: ftype, title: title,
    suggestedSubId: suggestedSub ? suggestedSub.id : null,
    suggestedCatId: suggestedCat ? suggestedCat.id : null,
    aiSub: ai ? ai.subject : '؟', aiCat: ai ? ai.category : '؟'
  });
  var conf = ai ? Math.round((ai.confidence || 0) * 100) + '%' : 'غير متاح';
  var rows = subjects.map(function(s) { return [btn((s.id === (suggestedSub && suggestedSub.id) ? '✅ ' : '') + s.name, 'add_sub_' + s.id)]; });
  rows.push([btn('❌ إلغاء', 'add_cancel')]);
  ctx.reply('📄 *' + escMd(title) + '*\n\n🤖 AI: 📚 *' + escMd(ai ? ai.subject : '؟') + '* (' + conf + ')\n📁 *' + escMd(ai ? ai.category : '؟') + '*\n\nاختر المادة:', { parse_mode: 'Markdown', ...build(rows) }).catch(function(){});
  return true;
}

async function handleAddCallback(ctx, data) {
  var state = require('../utils/stateManager').getState(uid) || {}
// ctx.uid];
  if (data === 'add_cancel') { await require('../utils/stateManager').delState(ctx.uid); return ctx.editMessageText('❌ تم الإلغاء').catch(function(){}); }
  if (data.startsWith('add_sub_')) {
    var subId = safeInt(data.replace('add_sub_', ''));
    var sub = await all('SELECT id, name FROM subjects WHERE id=$1', [subId]);
    var cats = await all('SELECT c.id, c.name FROM categories c WHERE c.subject_id=$1', [subId]);
    await require('../utils/stateManager').setState(ctx.uid, { type: 'add_confirm', fid: state.fid, ftype: state.ftype, title: state.title, suggestedCatId: state.suggestedCatId, chosenSubId: subId, chosenSubName: sub[0] ? sub[0].name : '' });
    var rows = cats.map(function(c) { return [btn((c.id === state.suggestedCatId ? '✅ ' : '') + c.name, 'add_cat_' + c.id)]; });
    rows.push([btn('❌ إلغاء', 'add_cancel')]);
    return ctx.editMessageText('📚 *' + escMd(sub[0] ? sub[0].name : '') + '*\n\nاختر الفئة:', { parse_mode: 'Markdown', ...build(rows) }).catch(function(){});
  }
  if (data.startsWith('add_cat_')) {
    var catId = safeInt(data.replace('add_cat_', ''));
    var cat = await all('SELECT id, name FROM categories WHERE id=$1', [catId]);
    try {
      await filesDb.addFile(catId, state.title, '', state.fid, state.ftype, ctx.uid);
      await require('../utils/stateManager').delState(ctx.uid);
      ctx.editMessageText('✅ *' + escMd(state.title) + '*\n📚 ' + escMd(state.chosenSubName) + ' → 📁 ' + escMd(cat[0] ? cat[0].name : ''), { parse_mode: 'Markdown' }).catch(function(){});
      await require('../utils/stateManager').setState(ctx.uid, { type: 'add_mode', chatId: state.chatId });
      // ── XP for upload ──
      try { require('./xp').onUpload(global.__bot, ctx.uid).catch(function(){}); } catch(err) { require('../utils/logger').debug('[catch]', err.message); }
    } catch(e) { ctx.editMessageText('❌ ' + (e.message === 'exists' ? 'موجود مسبقاً' : e.message)).catch(function(){}); }
  }
}

module.exports = { handleAdd, handleAddFile, handleAddCallback };
