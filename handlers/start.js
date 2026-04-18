const escMd = t => (t || '').replace(/[*_`\[\]()~>#+=|{}.!\-]/g, '\\$&');
const { build, btn } = require('../utils/keyboard');
const { eos } = require('../utils/helpers');
const interactions = require('../database/interactions');
const usersDb = require('../database/users');
const content = require('../database/content');
const { cacheGet, cacheSet } = require('../utils/cache');
const { t, getLang, setLang, getLangButtons, getGreeting } = require('../utils/i18n');

async function startHandler(ctx) {
  const uid = ctx.uid;
  const name = ctx.from?.first_name || 'Student';
  const rawText = ctx.message?.text || '';
  const payload = rawText.includes(' ') ? rawText.split(' ')[1] : ctx.startPayload || null;

  // استقبال ملف من deep link
  if (payload && payload.startsWith('file_')) {
    const fid = payload.replace('file_', '');
    const filesDb = require('../database/files');
    const f = await filesDb.getFile(fid);
    if (f) {
      const cap = '📄 ' + f.title + (f.description ? '\n📝 ' + f.description : '') + '\n📁 ' + f.cat_name + ' | 📖 ' + f.sub_name;
      try {
        if (f.file_type === 'photo') await ctx.replyWithPhoto(f.file_id, { caption: cap });
        else if (f.file_type === 'link') await ctx.reply(cap + '\n\n🔗 ' + f.file_id, {});
        else await ctx.replyWithDocument(f.file_id, { caption: cap });
        interactions.addHistory(uid, fid).catch(() => {});
        filesDb.incDownloads(fid).catch(() => {});
      } catch (e) { console.error('START FILE ERROR:', e.message); await ctx.reply('❌ ' + t(uid, 'try_again')); }
    } else { await ctx.reply('❌ ' + t(uid, 'not_found')); }
  }

  // اختيار اللغة (أول مرة)
  const lang = getLang(uid);
  if (!lang || rawText.includes('setlang')) return askLanguage(ctx);

  const hasSp = await usersDb.getSpecialty(uid);
  if (!hasSp) return askSpecialty(ctx, name);
  return showMainMenu(ctx, name);
}

async function askLanguage(ctx) {
  const rows = [
    [btn('🇩🇿 العربية', 'lang_ar'), btn('🇫🇷 Français', 'lang_fr'), btn('🇷🇺 Русский', 'lang_ru')]
  ];
  return ctx.reply('🌍 اختر لغتك / Choisissez votre langue / Выберите язык:', { ...build(rows) });
}

async function askSpecialty(ctx, name) {
  const uid = ctx.uid;
  const specs = await content.getSpecs();
  if (!specs.length) return showMainMenu(ctx, name);
  const rows = specs.map(s => [btn('🎓 ' + s.name, 'set_sp_' + s.id)]);
  rows.push([btn(t(uid, 'skip_spec'), 'skip_sp')]);
  return eos(ctx,
    getGreeting(uid) + ', *' + name + '!*\n\n' +
    '📚 منصتك الأكاديمية\n' +
    '━━━━━━━━━━━━━━━━\n' +
    t(uid, 'choose_spec'),
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

  let welcome = getGreeting(uid) + ', *' + name + '!*\n';
  if (sp) welcome += '🎓 *' + escMd(sp.name) + '*\n';
  welcome += '━━━━━━━━━━━━━━━━\n' + t(uid, 'platform_desc');

  const rows = [
    [btn(t(uid, 'browse'), 'browse')],
    [btn(t(uid, 'search'), 'search_prompt'), btn(t(uid, 'latest'), 'latest')],
    [btn(t(uid, 'favorites'), 'favorites'), btn(t(uid, 'history'), 'history')],
    [btn(t(uid, 'ai'), 'ai_prompt')],
    [btn(t(uid, 'profile'), 'profile'), btn(t(uid, 'stats'), 'stats')],
    [btn(t(uid, 'change_spec'), 'change_sp')],
  ];

  if (last?.title) rows.push([btn(t(uid, 'continue') + ' ' + last.title.substring(0, 25), 'preview_' + last.id + '_0_0_0_0_0')]);
  if (ctx.isAdmin) rows.push([btn(t(uid, 'admin'), 'mg_menu')]);

  // أزرار تغيير اللغة
  const langBtns = getLangButtons(uid);
  if (langBtns.length) rows.push(langBtns);

  return eos(ctx, welcome, { parse_mode: 'Markdown', ...build(rows) });
}

startHandler.clearAiMode = async (uid) => {
  const state = global.userStates?.[uid];
  if (state?.type === 'ai_mode') await global.delState(uid);
};

module.exports = startHandler;
module.exports.showMainMenu = showMainMenu;
module.exports.askSpecialty = askSpecialty;
