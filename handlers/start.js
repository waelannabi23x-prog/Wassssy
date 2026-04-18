const { escMd, buildPath, eos } = require('../utils/helpers');
const { build, btn } = require('../utils/keyboard');
const interactions = require('../database/interactions');
const usersDb = require('../database/users');
const content = require('../database/content');
const { cacheGet, cacheSet } = require('../utils/cache');

async function startHandler(ctx) {
  var uid = ctx.uid;
  var name = ctx.from ? ctx.from.first_name || 'Student' : 'Student';
  var rawText = ctx.message ? ctx.message.text || '' : '';
  var payload = rawText.includes(' ') ? rawText.split(' ')[1] : ctx.startPayload || null;
  if (payload && payload.startsWith('file_')) {
    var safeInt = function(v) { var n = parseInt(v); return isNaN(n) ? 0 : n; };
    var fid = safeInt(payload.replace('file_', ''));
    if (fid > 0) {
      var filesDb = require('../database/files');
      var f = await filesDb.getFile(fid);
      if (f) {
        var cap = '📄 ' + f.title + (f.description ? '\n📝 ' + f.description : '') + '\n📁 ' + f.cat_name + ' | 📖 ' + f.sub_name;
        try {
          if (f.file_type === 'photo') await ctx.replyWithPhoto(f.file_id, { caption: cap });
          else if (f.file_type === 'link') await ctx.reply(cap + '\n\n🔗 ' + f.file_id);
          else await ctx.replyWithDocument(f.file_id, { caption: cap });
          interactions.addHistory(uid, fid).catch(function(){});
          filesDb.incDownloads(fid).catch(function(){});
        } catch(e) { await ctx.reply('❌ تعذر إرسال الملف'); }
      }
    }
  }
  var hasSp = await usersDb.getSpecialty(uid);
  if (!hasSp) return askSpecialty(ctx, name);
  return showMainMenu(ctx, name);
}

async function askSpecialty(ctx, name) {
  var specs = await content.getSpecs();
  if (!specs.length) return showMainMenu(ctx, name);
  var rows = specs.map(function(s) { return [btn('🎓 ' + s.name, 'set_sp_' + s.id)]; });
  rows.push([btn('⏭ تخطي لأختار لاحقاً', 'skip_sp')]);
  return eos(ctx, '👋 *أهلاً ' + name + '!*\n\n📚 منصتك الأكاديمية على تيليغرام\n━━━━━━━━━━━━━━━━\n🎓 *اختر تخصصك للبدء:*', { parse_mode: 'Markdown', ...build(rows) });
}

async function showMainMenu(ctx, name) {
  var uid = ctx.uid;
  if (!name) name = ctx.from ? ctx.from.first_name || 'Student' : 'Student';
  var menuKey = 'menu_data_' + uid;
  var menuData = cacheGet(menuKey);
  if (!menuData) {
    var results = await Promise.all([interactions.getLastFile(uid), usersDb.getSpecialty(uid)]);
    var last = results[0], spRow = results[1];
    var _spId = spRow ? spRow.specialty_id : null;
    var sp = _spId && _spId != 0 ? await content.getSpec(_spId) : null;
    menuData = { last: last, sp: sp };
    cacheSet(menuKey, menuData, 60000);
  }
  var last = menuData.last, sp = menuData.sp;
  var hour = new Date().getHours();
  var timeGreet = hour < 12 ? '🌅 صباح النور' : hour < 17 ? '☀️ مساء الخير' : '🌙 مساء الخير';
  var welcome = timeGreet + '، *' + name + '!*\n';
  if (sp) welcome += '🎓 *' + escMd(sp.name) + '*\n';
  welcome += '━━━━━━━━━━━━━━━━\n📚 منصتك الأكاديمية — اختر ما تريد:';
  var rows = [
    [btn('📚 تصفح المحتوى', 'browse')],
    [btn('🔍 بحث سريع', 'search_prompt'), btn('🆕 أحدث الملفات', 'latest')],
    [btn('⭐ مفضلاتي', 'favorites'), btn('📂 آخر ما شاهدت', 'history')],
    [btn('🤖 المساعد الذكي', 'ai_prompt')],
    [btn('👤 ملفي', 'profile'), btn('📊 إحصائيات', 'stats')],
    [btn(sp ? '🎓 تغيير تخصصي' : '🎓 اختر تخصصي', 'change_sp')],
  ];
  if (last && last.title) rows.push([btn('▶️ استكمال: ' + last.title.substring(0, 25), 'preview_' + last.id + '_0_0_0_0_0')]);
  if (ctx.isAdmin) rows.push([btn('🛠 لوحة الإدارة', 'mg_menu')]);
  return eos(ctx, welcome, { parse_mode: 'Markdown', ...build(rows) });
}

startHandler.clearAiMode = async function(uid) {
  var state = global.userStates && global.userStates[uid];
  if (state && state.type === 'ai_mode') await global.delState(uid);
};

module.exports = startHandler;
module.exports.showMainMenu = showMainMenu;
module.exports.askSpecialty = askSpecialty;
