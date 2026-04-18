const escMd = t => (t || '').replace(/[*_`\[\]()~>#+=|{}.!\-]/g, '\\$&');
const { build, btn } = require('../utils/keyboard');
const { eos } = require('../utils/helpers');
const interactions = require('../database/interactions');
const usersDb = require('../database/users');
const content = require('../database/content');
const { cacheGet, cacheSet } = require('../utils/cache');

async function startHandler(ctx) {
  const uid = ctx.uid;
  const name = ctx.from?.first_name || 'Student';
  const rawText = ctx.message?.text || '';
  const payload = rawText.includes(' ') ? rawText.split(' ')[1] : ctx.startPayload || null;
  if(payload && payload.startsWith('file_')) {
    const fid = payload.replace('file_', '');
    const filesDb = require('../database/files');
    const f = await filesDb.getFile(fid);
    if(f) {
      const cap = '📄 ' + f.title + (f.description ? '\n📝 ' + f.description : '') + '\n📁 ' + f.cat_name + ' | 📖 ' + f.sub_name;
      try {
        if(f.file_type === 'photo') await ctx.replyWithPhoto(f.file_id, {caption:cap});
        else if(f.file_type === 'link') await ctx.reply(cap + '\n\n🔗 ' + f.file_id, {});
        else await ctx.replyWithDocument(f.file_id, {caption:cap});
        interactions.addHistory(uid, fid).catch(()=>{});
        filesDb.incDownloads(fid).catch(()=>{});
      } catch(e) { console.error('START FILE ERROR:', e.message); await ctx.reply('❌ تعذر إرسال الملف: ' + e.message); }
    } else { await ctx.reply('❌ الملف غير موجود.'); }
  }
  const hasSp = await usersDb.getSpecialty(uid);
  if (!hasSp) return askSpecialty(ctx, name);
  return showMainMenu(ctx, name);
}

async function askSpecialty(ctx, name) {
  const specs = await content.getSpecs();
  if (!specs.length) return showMainMenu(ctx, name);
  const rows = specs.map(s => [btn('🎓 ' + s.name, 'set_sp_' + s.id)]);
  rows.push([btn('⏭ تخطي لأختار لاحقاً', 'skip_sp')]);
  return eos(ctx,
    '👋 *أهلاً ' + name + '!*\n\n📚 منصتك الأكاديمية على تيليغرام\n━━━━━━━━━━━━━━━━\n🎓 *اختر تخصصك للبدء:*',
    { parse_mode: 'Markdown', ...build(rows) }
  );
}

async function showMainMenu(ctx, name) {
  const uid = ctx.uid;
  if (!name) name = ctx.from?.first_name || 'Student';
  const menuKey = 'menu_data_' + uid;
  let menuData = cacheGet(menuKey);
  if (!menuData) {
    const [last, spRow] = await Promise.all([
      interactions.getLastFile(uid),
      usersDb.getSpecialty(uid)
    ]);
    const _spId = spRow?.specialty_id;
    const sp = _spId && _spId != 0 ? await content.getSpec(_spId) : null;
    menuData = { last, spRow, sp };
    cacheSet(menuKey, menuData, 60000);
  }
  const { last, sp } = menuData;
  const hour = new Date().getHours();
  const timeGreet = hour < 12 ? '🌅 صباح النور' : hour < 17 ? '☀️ مساء الخير' : '🌙 مساء الخير';
  let welcome = timeGreet + '، *' + name + '!*\n';
  if (sp) welcome += '🎓 *' + escMd(sp.name) + '*\n';
  welcome += '━━━━━━━━━━━━━━━━\n📚 منصتك الأكاديمية — اختر ما تريد:';
  const rows = [
    [btn('📚 تصفح المحتوى', 'browse')],
    [btn('🔍 بحث سريع', 'search_prompt'), btn('🆕 أحدث الملفات', 'latest')],
    [btn('⭐ مفضلاتي', 'favorites'), btn('📂 آخر ما شاهدت', 'history')],
    [btn('🤖 المساعد الذكي', 'ai_prompt')],
    [btn('👤 ملفي', 'profile'), btn('📊 إحصائيات', 'stats')],
    [btn(sp ? '🎓 تغيير تخصصي' : '🎓 اختر تخصصي', 'change_sp')],
  ];
  if (last?.title) rows.push([btn('▶️ استكمال: ' + last.title.substring(0, 25), 'preview_' + last.id + '_0_0_0_0_0')]);
  if (ctx.isAdmin) rows.push([btn('🛠 لوحة الإدارة', 'mg_menu')]);
  return eos(ctx, welcome, { parse_mode: 'Markdown', ...build(rows) });
}

startHandler.clearAiMode = async (uid) => {
  const state = global.userStates?.[uid];
  if(state?.type === 'ai_mode') await global.delState(uid);
};
module.exports = startHandler;
module.exports.showMainMenu = showMainMenu;
module.exports.askSpecialty = askSpecialty;
