'use strict';
const filesDb      = require('../database/files');
const { smartSearch } = require('./group');
const { all, get } = require('../database/db');
const interactions = require('../database/interactions');
const usersDb      = require('../database/users');
const content      = require('../database/content');
const { build, btn, back } = require('../utils/keyboard');
const { eos, formatDate } = require('../utils/helpers');
const { t, getLang } = require('../utils/i18n');
const { cacheGet, cacheSet, cacheClear, cacheClearPrefix } = require('../utils/cache');

async function showLatest(ctx) {
  var k = 'latest_15', list = cacheGet(k);
  if (!list) { list = await filesDb.recentFiles(15); cacheSet(k, list, 120000); }
  if (!list.length) return eos(ctx, '🆕 لا توجد ملفات بعد.', build([back('main_menu')]));
  var rows = list.map(f => [btn('📄 ' + f.title + ' · ' + f.sub_name, 'preview_' + f.id + '_0_0_0_0_0')]);
  rows.push(back('main_menu'));
  return eos(ctx, '🆕 *آخر الملفات (' + list.length + ')*', { parse_mode: 'Markdown', ...build(rows) });
}

async function showRecommended(ctx) {
  var uid = ctx.uid, k = 'rec_' + uid, list = cacheGet(k);
  if (!list) { list = await interactions.getRecommended(uid, 10); cacheSet(k, list, 300000); }
  if (!list.length) return showLatest(ctx);
  var rows = list.map(f => [btn('📄 ' + f.title + ' · ' + f.sub_name, 'preview_' + f.id + '_0_0_0_0_0')]);
  rows.push(back('main_menu'));
  return eos(ctx, '🎯 *موصى به لك*', { parse_mode: 'Markdown', ...build(rows) });
}

async function showNewInSpecialty(ctx) {
  var uid = ctx.uid;
  var spRow = await usersDb.getSpecialty(uid);
  var spId = spRow ? spRow.specialty_id : null;
  if (!spId || spId == 0) return showLatest(ctx);
  var k = 'new_sp_' + spId, list = cacheGet(k);
  if (!list) {
    list = await all('SELECT f.*,c.name as cat_name,s.name as sub_name FROM files f JOIN categories c ON f.category_id=c.id JOIN subjects s ON c.subject_id=s.id JOIN semesters sm ON s.semester_id=sm.id JOIN years y ON sm.year_id=y.id WHERE y.specialty_id=$1 AND f.is_deleted=0 ORDER BY f.uploaded_at DESC LIMIT 15',[spId]);
    cacheSet(k, list, 120000);
  }
  if (!list.length) return showLatest(ctx);
  var rows = list.map(f => [btn('📄 ' + f.title + ' · ' + f.sub_name, 'preview_' + f.id + '_0_0_0_0_0')]);
  rows.push(back('main_menu'));
  return eos(ctx, '🆕 *الجديد في تخصصك (' + list.length + ')*', { parse_mode: 'Markdown', ...build(rows) });
}

async function showFavorites(ctx) {
  var uid = ctx.uid, favs = await interactions.getFavs(uid);
  if (!favs.length) return eos(ctx, '⭐ *المفضلة*\n\nلا توجد ملفات محفوظة.', { parse_mode: 'Markdown', ...build([back('main_menu')]) });
  var rows = favs.map(f => [btn('📄 ' + f.title, 'preview_' + f.id + '_0_0_0_0_0'), btn('🗑', 'unfav_' + f.id)]);
  rows.push(back('main_menu'));
  return eos(ctx, '⭐ *المفضلة (' + favs.length + ')*', { parse_mode: 'Markdown', ...build(rows) });
}

async function toggleFav(ctx, fid, remove) {
  var uid = ctx.uid, isFaved = await interactions.isFav(uid, fid);
  if (remove || isFaved) {
    await interactions.removeFav(uid, fid).catch(function(){});
    cacheClearPrefix('personal_' + uid + '_' + fid); cacheClearPrefix('favbatch_' + uid + '_');
    try { await ctx.editMessageReplyMarkup({ inline_keyboard: ctx.callbackQuery.message.reply_markup.inline_keyboard.map(row => row.map(b => { if (b.callback_data === 'fav_' + fid || b.callback_data === 'unfav_' + fid) return Object.assign({}, b, { text: '☆ حفظ', callback_data: 'fav_' + fid }); return b; })) }); } catch(e) {}
  } else {
    await interactions.addFav(uid, fid).catch(function(){});
    cacheClearPrefix('personal_' + uid + '_' + fid); cacheClearPrefix('favbatch_' + uid + '_');
    try { await ctx.editMessageReplyMarkup({ inline_keyboard: ctx.callbackQuery.message.reply_markup.inline_keyboard.map(row => row.map(b => { if (b.callback_data === 'fav_' + fid || b.callback_data === 'unfav_' + fid) return Object.assign({}, b, { text: '⭐ محفوظ', callback_data: 'unfav_' + fid }); return b; })) }); } catch(e) {}
  }
}

async function showHistory(ctx) {
  var uid = ctx.uid, hist = await interactions.getHistory(uid);
  if (!hist.length) return eos(ctx, '📂 *السجل*\n\nلم تشاهد أي ملفات بعد.', { parse_mode: 'Markdown', ...build([back('main_menu')]) });
  var rows = hist.map(f => [btn('📄 ' + f.title, 'preview_' + f.id + '_0_0_0_0_0')]);
  rows.push(back('main_menu'));
  return eos(ctx, '📂 *السجل (' + hist.length + ')*', { parse_mode: 'Markdown', ...build(rows) });
}

async function showProgress(ctx) {
  var uid = ctx.uid, spRow = await usersDb.getSpecialty(uid);
  var spId = spRow ? spRow.specialty_id : null;
  if (!spId || spId == 0) return eos(ctx, '⚠️ لم تحدد تخصصك بعد.', { parse_mode: 'Markdown', ...build([back('main_menu')]) });
  var k = 'progress_' + uid, cached = cacheGet(k);
  if (cached) return eos(ctx, cached.text, { parse_mode: 'Markdown', ...build(cached.kb) });
  var sp = await content.getSpec(spId);
  var subjects = await all('SELECT s.name as sub_name,COUNT(DISTINCT f.id) as total,COUNT(DISTINCT CASE WHEN h.user_id=$1 THEN h.file_id END) as seen FROM subjects s JOIN semesters sm ON s.semester_id=sm.id JOIN years y ON sm.year_id=y.id JOIN categories c ON c.subject_id=s.id JOIN files f ON f.category_id=c.id AND f.is_deleted=0 LEFT JOIN history h ON h.file_id=f.id AND h.user_id=$1 WHERE y.specialty_id=$2 AND s.is_deleted=0 GROUP BY s.id,s.name ORDER BY seen DESC,total DESC',[uid,spId]);
  if (!subjects.length) return eos(ctx, '📭 لا يوجد محتوى في تخصصك بعد.', { parse_mode: 'Markdown', ...build([back('main_menu')]) });
  var tf=0,ts=0; subjects.forEach(s=>{tf+=parseInt(s.total);ts+=parseInt(s.seen);});
  var op=tf?Math.round(ts/tf*100):0;
  var bar=(s,t)=>{var p=t?Math.round(s/t*100):0,f=Math.round(p/10);return'['+'█'.repeat(f)+'░'.repeat(10-f)+'] '+p+'%';};
  var medal=p=>p>=100?'🏆':p>=75?'🥇':p>=50?'🥈':p>=25?'🥉':'📚';
  var escMd=require('../utils/helpers').escMd;
  var text='📊 *تقدمك في '+(sp?escMd(sp.name):''+'')+'*\n━━━━━━━━━━━━━━━━\n\n';
  subjects.forEach(s=>{var seen=parseInt(s.seen),total=parseInt(s.total),p=total?Math.round(seen/total*100):0;text+=medal(p)+' *'+(s.sub_name||'')+'*\n`'+bar(seen,total)+'`\n📄 '+seen+'/'+total+' ملف\n\n';});
  text+='━━━━━━━━━━━━━━━━\n🎯 *الإجمالي: '+ts+'/'+tf+' ملف*\n`'+bar(ts,tf)+'`';
  if(op>=75)text+='\n\n🔥 *أداء ممتاز! استمر!*';else if(op>=50)text+='\n\n💪 *في المنتصف! لا تتوقف!*';
  var kb=[[btn('🔄 تحديث','progress')],back('main_menu')];
  cacheSet(k,{text,kb},300000);
  return eos(ctx,text,{parse_mode:'Markdown',...build(kb)});
}

async function showProfile(ctx) {
  var uid=ctx.uid,lang=getLang(uid);
  var [user,dlCount,favCount,spRow,lastFile]=await Promise.all([usersDb.getById(uid),interactions.getUserDownloadCount(uid),get('SELECT COUNT(*) as c FROM favorites WHERE user_id=$1',[uid]).then(r=>r?r.c:0),usersDb.getSpecialty(uid),interactions.getLastFile(uid)]);
  var spId=spRow?spRow.specialty_id:null;
  var sp=spId&&spId!=0?await content.getSpec(spId):null;
  var escMd=require('../utils/helpers').escMd;
  var text='👤 *ملفك الشخصي*\n\n🆔 ID: `'+uid+'`\n👋 الاسم: '+(user?user.first_name||'غير معروف':'غير معروف')+'\n';
  if(user&&user.username)text+='📛 @'+escMd(user.username)+'\n';
  text+='📅 انضم: '+(user&&user.joined_at?formatDate(user.joined_at):'غير معروف')+'\n';
  text+='🎓 التخصص: *'+(sp?escMd(sp.name):'غير محدد')+'*\n\n📊 *النشاط:*\n';
  text+='⬇️ التحميلات: *'+dlCount+'*\n⭐ المفضلة: *'+favCount+'*';
  if(lastFile)text+='\n📄 آخر ملف: *'+escMd(lastFile.title)+'*';
  text+='\n🌍 اللغة: *'+(lang==='ar'?'العربية 🇩🇿':'English 🇬🇧')+'*';
  var rows=[[btn(lang==='ar'?'Switch to English 🇬🇧':'التبديل للعربية 🇩🇿','lang_'+(lang==='ar'?'en':'ar'))],[btn('📊 تقدمي في تخصصي','progress'),btn('🎯 موصى به','recommended')],back('main_menu')];
  return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});
}

async function showStats(ctx) {
  var k='stats_global',cached=cacheGet(k);
  if(cached)return eos(ctx,cached,{parse_mode:'Markdown',...build([back('main_menu')])});
  var [totalUsers,activeToday,totalFiles,totalDl,specs]=await Promise.all([usersDb.count(),usersDb.activeToday(),filesDb.totalFiles(),filesDb.totalDownloads(),content.getSpecs()]);
  var text='📊 *الإحصائيات*\n\n👥 المستخدمون: *'+totalUsers+'*\n🟢 نشطون اليوم: *'+activeToday+'*\n📁 الملفات: *'+totalFiles+'*\n⬇️ التحميلات: *'+totalDl+'*\n🎓 التخصصات: *'+specs.length+'*';
  cacheSet(k,text,300000);
  return eos(ctx,text,{parse_mode:'Markdown',...build([back('main_menu')])});
}

// ✅ FIXED: uses smartSearch (aliases + scoring) instead of raw filesDb.search
async function handleSearch(ctx, query) {
  if (global.delState) await global.delState(ctx.uid);
  if (!query || query.trim().length < 2) return ctx.reply('⚠️ قصير جداً. ادخل كلمة على الأقل.').catch(function(){});
  if (query.trim().length > 100) return ctx.reply('⚠️ البحث طويل جداً.').catch(function(){});
  query = query.trim().replace(/[%;\\"<>']/g, '');
  if (!query.length) return ctx.reply('⚠️ كلمة البحث غير صالحة.').catch(function(){});

  ctx.sendChatAction('typing').catch(function(){});

  var key = 'search_' + query.toLowerCase().replace(/\s+/g, ' ');
  var results = cacheGet(key);
  if (!results) {
    results = await smartSearch(query, 20);
    if (results && results.length) cacheSet(key, results, 300000);
  }

  if (!results || !results.length) {
    return ctx.reply(
      '🔍 لا نتائج لـ: *' + query + '*\n\n💡 اختصارات: `algo` · `serie 2` · `td` · `exam` · `ds` · `cc`',
      { parse_mode: 'Markdown', ...build([[btn('🔍 بحث جديد', 'search_prompt')], back('main_menu')]) }
    ).catch(function(){});
  }

  var rows = results.map(function(f) {
    var row = [btn('📄 ' + f.title + ' · ' + f.sub_name, 'preview_' + f.id + '_0_0_0_0_0')];
    if (ctx.isAdmin) row.push(btn('🗑', 'search_del_' + f.id + '|' + encodeURIComponent(query)));
    return row;
  });
  rows.push([btn('🔍 بحث جديد', 'search_prompt'), btn('🏠', 'main_menu')]);
  return ctx.reply('🔍 *نتائج "' + query + '"* — ' + results.length + ' نتيجة', { parse_mode: 'Markdown', ...build(rows) }).catch(function(){});
}

module.exports = { showLatest, showRecommended, showNewInSpecialty, showFavorites, toggleFav, showHistory, showProfile, showStats, handleSearch, showProgress };
