const escMd = t => (t||'').replace(/[*_`\[\]()~>#+=|{}.!\-]/g,'\\$&');
const { build, btn } = require('../utils/keyboard');
const { eos } = require('../utils/helpers');
const { t } = require('../utils/i18n');
const interactions = require('../database/interactions');
const usersDb = require('../database/users');
const content = require('../database/content');

async function startHandler(ctx) {
  const uid = ctx.uid;
  const name = escMd(ctx.from?.first_name || 'Student');
  const hasSp = await usersDb.getSpecialty(uid);
  if (!hasSp) return askSpecialty(ctx, name);
  return showMainMenu(ctx, name);
}

async function askSpecialty(ctx, name) {
  const uid = ctx.uid;
  const specs = await content.getSpecs();
  if (!specs.length) return showMainMenu(ctx, name);
  const rows = specs.map(s => [btn('🎓 ' + s.name, 'set_sp_' + s.id)]);
  rows.push([btn('⏭ تخطي', 'skip_sp')]);
  return eos(ctx, '👋 *مرحباً ' + name + '!*\n\n🎓 اختر تخصصك:', {
    parse_mode: 'Markdown', ...build(rows)
  });
}

async function showMainMenu(ctx, name) {
  const uid = ctx.uid;
  if (!name) name = escMd(ctx.from?.first_name || 'Student');

  const [last, spRow] = await Promise.all([
    interactions.getLastFile(uid),
    usersDb.getSpecialty(uid)
  ]);

  const spId = spRow?.specialty_id;
  const sp = spId && spId != 0 ? await content.getSpec(spId) : null;

  // تحيات عشوائية احترافية
  const hour = new Date().getHours();
  let timeGreet = hour < 12 ? '🌅 صباح النور' : hour < 17 ? '☀️ مساء الخير' : hour < 21 ? '🌆 مساء النور' : '🌙 مساء الخير';

  const greetings = [
    timeGreet + '، *' + name + '!* 👋',
    '✨ أهلاً بك، *' + name + '!*',
    '🎓 مرحباً، *' + name + '!*',
    '💡 يسعدنا وجودك، *' + name + '!*',
    '🚀 أهلاً وسهلاً، *' + name + '!*',
  ];
  const greet = greetings[Math.floor(Math.random() * greetings.length)];

  let welcome = greet + '\n';
  if (sp) welcome += '🎓 ' + escMd(sp.name) + '\n';
  welcome += '━━━━━━━━━━━━━━━━\n';
  welcome += '📚 *منصتك الأكاديمية على تيليغرام*';

  const rows = [
    [btn('📚 تصفح المحتوى', 'browse')],
    [btn('🔍 بحث', 'search_prompt'), btn('🆕 الأحدث', 'latest')],
    [btn('🆕 جديد في تخصصي', 'new_in_sp'), btn('🎯 موصى به', 'recommended')],
    [btn('⭐ المفضلة', 'favorites'), btn('📂 السجل', 'history')],
    [btn('👤 ملفي', 'profile'), btn('📊 إحصائيات', 'stats')],
  ];
  if (sp) rows.push([btn('🎓 تغيير تخصصي', 'change_sp')]);
  if (last && last.title) rows.push([btn('▶️ استكمال: ' + last.title.substring(0,20), 'preview_' + last.id + '_0_0_0_0_0')]);
  if (ctx.isAdmin) rows.push([btn('🛠 لوحة الإدارة', 'mg_menu')]);
  return eos(ctx, welcome, { parse_mode: 'Markdown', ...build(rows) });
}

module.exports = startHandler;
module.exports.showMainMenu = showMainMenu;
module.exports.askSpecialty = askSpecialty;
