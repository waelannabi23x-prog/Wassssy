const escMd = t => (t||'').replace(/[*_`\[\]()~>#+=|{}.!\-]/g,'\\$&');
const { build, btn } = require('../utils/keyboard');
const { eos } = require('../utils/helpers');
const interactions = require('../database/interactions');
const usersDb = require('../database/users');
const content = require('../database/content');
const { cacheGet, cacheSet } = require('../utils/cache');

async function startHandler(ctx) {
  const uid = ctx.uid;
  const name = escMd(ctx.from?.first_name || 'Student');
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
    '👋 *أهلاً ' + name + '!*\n\n' +
    '📚 منصتك الأكاديمية على تيليغرام\n' +
    '━━━━━━━━━━━━━━━━\n' +
    '🎓 *اختر تخصصك للبدء:*',
    { parse_mode: 'Markdown', ...build(rows) }
  );
}

async function showMainMenu(ctx, name) {
  const uid = ctx.uid;
  if (!name) name = escMd(ctx.from?.first_name || 'Student');

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
  const { last, spRow, sp } = menuData;
  const spId = spRow?.specialty_id;

  const hour = new Date().getHours();
  const timeGreet = hour < 12 ? '🌅 صباح النور' : hour < 17 ? '☀️ مساء الخير' : '🌙 مساء الخير';

  let welcome = timeGreet + '، *' + name + '!*\n';
  if (sp) welcome += '🎓 *' + escMd(sp.name) + '*\n';
  welcome += '━━━━━━━━━━━━━━━━\n';
  welcome += '📚 منصتك الأكاديمية — اختر ما تريد:';

  const rows = [
    [btn('📚  تصفح المحتوى', 'browse')],
    [btn('🔍 بحث', 'search_prompt'), btn('🆕 الأحدث', 'latest')],
    [btn('⭐ المفضلة', 'favorites'), btn('📂 سجلي', 'history')],
    [btn('👤 ملفي', 'profile'), btn('📊 إحصائيات', 'stats')],
    [btn(sp ? '🎓 تغيير تخصصي' : '🎓 اختر تخصصي', 'change_sp')],
  ];

  if (last?.title) rows.push([btn('▶️ استكمال: ' + last.title.substring(0, 25), 'preview_' + last.id + '_0_0_0_0_0')]);
  if (ctx.isAdmin) rows.push([btn('🛠 لوحة الإدارة', 'mg_menu')]);

  return eos(ctx, welcome, { parse_mode: 'Markdown', ...build(rows) });
}

module.exports = startHandler;
module.exports.showMainMenu = showMainMenu;
module.exports.askSpecialty = askSpecialty;
