'use strict';
const { cacheGet, cacheSet, cacheClearPrefix, cacheClear } = require('../utils/cache');
const { run: dbRun, all: dbAll } = require('../database/db');
const filesDb = require('../database/files');
const { isOwner } = require('../middlewares/auth');

function _getGSC(q) { return cacheGet('gsrc_' + q.toLowerCase().trim()); }
function _setGSC(q, data) { cacheSet('gsrc_' + q.toLowerCase().trim(), data, 300000); }

async function smartSearch(rawQ, limit) {
  limit = limit || 10;
  var q = rawQ.replace(/[%;\\]/g, '').trim();
  var results = _getGSC(q);
  if (!results) { results = await filesDb.search(q, limit); _setGSC(q, results); }
  if (results.length >= 3) return results;
  var words = q.split(/\s+/).filter(function(w) { return w.length >= 2; });
  if (words.length > 1) {
    var extras = new Map();
    for (var wi = 0; wi < words.length; wi++) {
      var wr = _getGSC(words[wi]) || await filesDb.search(words[wi], limit);
      _setGSC(words[wi], wr);
      for (var ri = 0; ri < wr.length; ri++) { if (!results.find(function(x) { return x.id === wr[ri].id; })) extras.set(wr[ri].id, wr[ri]); }
    }
    results = results.concat(Array.from(extras.values())).slice(0, limit);
    _setGSC(q, results);
  }
  return results;
}

// مسح كاش البحث عند حذف ملف — يُستدعى من files.js
if (!global._clearSearchCache) {
  global._clearSearchCache = function() {
    var cc = require('../utils/cache');
    cc.cacheClearPrefix('search_');
    cc.cacheClear('latest_15');
    cc.cacheClear('popular_15');
  };
}
// مسح كاش القروبات أيضاً
var _origClear = global._clearSearchCache;
global._clearSearchCache = function() {
  _origClear();
  cacheClearPrefix('gsrc_');
};

async function handleGroupSearch(ctx, raw) {
  ctx.deleteMessage().catch(function(){});
  if (!raw || raw.length < 2) {
    var m = await ctx.reply('🔍 مثال: /search algo serie 1');
    setTimeout(function() { ctx.telegram.deleteMessage(ctx.chat.id, m.message_id).catch(function(){}); }, 6000);
    return;
  }
  var results = await smartSearch(raw, 10);
  if (!results.length) {
    var m = await ctx.reply('❌ لا نتائج لـ "' + raw + '"');
    setTimeout(function() { ctx.telegram.deleteMessage(ctx.chat.id, m.message_id).catch(function(){}); }, 8000);
    return;
  }
  var isOwnerUser = ctx.isOwner;
  var botUsername = global._cachedBotUsername;
  if (!botUsername) { var me = await ctx.telegram.getMe(); botUsername = me.username; global._cachedBotUsername = botUsername; }
  var rows = results.map(function(f) {
    var label = '📄 ' + f.title.substring(0, 32) + ' · ' + f.sub_name;
    if (isOwnerUser) return [{ text: label, callback_data: 'grp_dl_' + f.id }];
    return [{ text: label, url: 'https://t.me/' + botUsername + '?start=file_' + f.id }];
  });
  if (!isOwnerUser) rows.push([{ text: '🤖 فتح البوت', url: 'https://t.me/' + botUsername }]);
  var header = isOwnerUser ? '🔍 "' + raw + '" — ' + results.length + ' نتيجة' : '🔍 "' + raw + '" — ' + results.length + ' نتيجة\nاضغط للتحميل في الخاص 👇';
  var m = await ctx.reply(header, { reply_markup: { inline_keyboard: rows } });
  if (!global._botMsgs) global._botMsgs = {};
  if (!global._botMsgs[ctx.chat.id]) global._botMsgs[ctx.chat.id] = [];
  global._botMsgs[ctx.chat.id].push(m.message_id);
  setTimeout(function() { ctx.telegram.deleteMessage(ctx.chat.id, m.message_id).catch(function(){}); }, 60000);
}

async function handleGrpSp(ctx, data) {
  if (!ctx.isOwner) return ctx.answerCbQuery('🚫 للمالك فقط', { show_alert: true }).catch(function(){});
  var raw = data.replace('grp_sp_', '');
  var lastUs = raw.lastIndexOf('_');
  var chatId = parseInt(raw.substring(0, lastUs));
  var specId = parseInt(raw.substring(lastUs + 1));
  try {
    await dbRun('INSERT INTO group_chats(chat_id,specialty_id) VALUES($1,$2) ON CONFLICT(chat_id) DO UPDATE SET specialty_id=$3', [chatId, specId, specId]);
    var specs = await dbAll('SELECT name FROM specialties WHERE id=$1', [specId]);
    var spName = specs[0] ? specs[0].name : String(specId);
    ctx.answerCbQuery('✅ ' + spName, { show_alert: false }).catch(function(){});
    ctx.telegram.editMessageText(chatId, ctx.callbackQuery.message.message_id, null, '✅ تخصص القروب: 🎓 ' + spName).catch(function(){});
  } catch(e) { ctx.answerCbQuery('❌ ' + e.message, { show_alert: true }).catch(function(){}); }
}

async function handleGrpDl(ctx, data) {
  if (!ctx.isOwner) return ctx.answerCbQuery('🚫').catch(function(){});
  var fid = data.replace('grp_dl_', '');
  var f = await filesDb.getFile(fid);
  if (!f) return ctx.answerCbQuery('❌ الملف غير موجود').catch(function(){});
  try {
    var cap = '📄 ' + f.title + (f.sub_name ? '\n📚 ' + f.sub_name : '');
    if (f.file_type === 'photo') await ctx.telegram.sendPhoto(ctx.chat.id, f.file_id, { caption: cap });
    else if (f.file_type === 'link') await ctx.telegram.sendMessage(ctx.chat.id, cap + '\n🔗 ' + f.file_id);
    else await ctx.telegram.sendDocument(ctx.chat.id, f.file_id, { caption: cap });
    ctx.answerCbQuery('✅ تم الإرسال').catch(function(){});
  } catch(e) { ctx.answerCbQuery('❌ ' + e.message, { show_alert: true }).catch(function(){}); }
}

module.exports = { handleGroupSearch, handleGrpSp, handleGrpDl, smartSearch };
