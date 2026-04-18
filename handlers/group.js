require('dotenv').config();
const { cacheGet, cacheSet, cacheClearPrefix } = require('../utils/cache');
const { run: dbRun, all: dbAll } = require('../database/db');
const filesDb = require('../database/files');
const { isOwner } = require('../middlewares/auth');

function _getGSC(q) { return cacheGet('gsrc_'+q.toLowerCase().trim()); }
function _setGSC(q, data) { cacheSet('gsrc_'+q.toLowerCase().trim(), data, 300000); }
global._clearSearchCache = () => cacheClearPrefix('gsrc_');

async function smartSearch(rawQ, limit=10) {
  const q = rawQ.replace(/[%;\\]/g,'').trim();
  let results = _getGSC(q);
  if(!results) { results = await filesDb.search(q, limit); _setGSC(q, results); }
  if(results.length >= 3) return results;
  const words = q.split(/\s+/).filter(w => w.length >= 2);
  if(words.length > 1) {
    const extras = new Map();
    for(const w of words) {
      const wr = _getGSC(w) || await filesDb.search(w, limit);
      _setGSC(w, wr);
      for(const r of wr) if(!results.find(x=>x.id===r.id)) extras.set(r.id, r);
    }
    results = [...results, ...extras.values()].slice(0, limit);
    _setGSC(q, results);
  }
  return results;
}

async function handleGroupSearch(ctx, raw) {
  ctx.deleteMessage().catch(()=>{});
  if(!raw || raw.length < 2) {
    const m = await ctx.reply('🔍 مثال: /search algo serie 1');
    setTimeout(()=>ctx.telegram.deleteMessage(ctx.chat.id, m.message_id).catch(()=>{}), 6000);
    return;
  }
  const results = await smartSearch(raw, 10);
  if(!results.length) {
    const m = await ctx.reply('❌ لا نتائج لـ "'+raw+'"');
    setTimeout(()=>ctx.telegram.deleteMessage(ctx.chat.id, m.message_id).catch(()=>{}), 8000);
    return;
  }
  const isOwnerUser = ctx.isOwner;
  let botUsername = global._cachedBotUsername;
  if(!botUsername) { const me = await ctx.telegram.getMe(); botUsername = me.username; global._cachedBotUsername = botUsername; }
  const rows = results.map(f => {
    const label = '📄 '+f.title.substring(0,32)+' · '+f.sub_name;
    if(isOwnerUser) return [{ text: label, callback_data: 'grp_dl_'+f.id }];
    return [{ text: label, url: 'https://t.me/'+botUsername+'?start=file_'+f.id }];
  });
  if(!isOwnerUser) rows.push([{text:'🤖 فتح البوت', url:'https://t.me/'+botUsername}]);
  const header = isOwnerUser
    ? '🔍 "'+raw+'" — '+results.length+' نتيجة\nاضغط لإرسال الملف:'
    : '🔍 "'+raw+'" — '+results.length+' نتيجة\nاضغط للتحميل في الخاص 👇';
  const m = await ctx.reply(header, {reply_markup:{inline_keyboard:rows}});
  if(!global._botMsgs) global._botMsgs = {};
  if(!global._botMsgs[ctx.chat.id]) global._botMsgs[ctx.chat.id] = [];
  global._botMsgs[ctx.chat.id].push(m.message_id);
  setTimeout(()=>ctx.telegram.deleteMessage(ctx.chat.id, m.message_id).catch(()=>{}), 60000);
}

async function handleGrpSp(ctx, data) {
  if(!ctx.isOwner) return ctx.answerCbQuery('🚫 للمالك فقط', {show_alert:true}).catch(()=>{});
  const raw = data.replace('grp_sp_', '');
  const lastUs = raw.lastIndexOf('_');
  const chatId = parseInt(raw.substring(0, lastUs));
  const specId = parseInt(raw.substring(lastUs + 1));
  try {
    await dbRun('INSERT INTO group_chats(chat_id,specialty_id) VALUES($1,$2) ON CONFLICT(chat_id) DO UPDATE SET specialty_id=$3',[chatId,specId,specId]);
    const specs = await dbAll('SELECT name FROM specialties WHERE id=$1',[specId]);
    const spName = specs[0]?.name || String(specId);
    await ctx.answerCbQuery('✅ ' + spName, {show_alert:false}).catch(()=>{});
    await ctx.telegram.editMessageText(chatId, ctx.callbackQuery.message.message_id, null, '✅ تخصص القروب: 🎓 ' + spName).catch(()=>{});
  } catch(e) {
    console.error('grp_sp error:', e.message);
    await ctx.answerCbQuery('❌ ' + e.message, {show_alert:true}).catch(()=>{});
  }
}

async function handleGrpDl(ctx, data) {
  if(!ctx.isOwner) return ctx.answerCbQuery('🚫').catch(()=>{});
  const fid = data.replace('grp_dl_','');
  const f = await filesDb.getFile(fid);
  if(!f) return ctx.answerCbQuery('❌ الملف غير موجود').catch(()=>{});
  try {
    const cap = '📄 '+f.title+(f.sub_name?'\n📚 '+f.sub_name:'');
    if(f.file_type === 'photo') await ctx.telegram.sendPhoto(ctx.chat.id, f.file_id, {caption:cap});
    else if(f.file_type === 'link') await ctx.telegram.sendMessage(ctx.chat.id, cap+'\n🔗 '+f.file_id);
    else await ctx.telegram.sendDocument(ctx.chat.id, f.file_id, {caption:cap});
    await ctx.answerCbQuery('✅ تم الإرسال').catch(()=>{});
  } catch(e) { await ctx.answerCbQuery('❌ '+e.message,{show_alert:true}).catch(()=>{}); }
}

module.exports = { handleGroupSearch, handleGrpSp, handleGrpDl, smartSearch };
