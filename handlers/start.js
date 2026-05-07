'use strict';
const escMd = t => (t || '').replace(/[*_`\[\]()~>#+=|{}.!\-]/g, '\\$&');
const { build, btn } = require('../utils/keyboard');
const { eos } = require('../utils/helpers');
const interactions = require('../database/interactions');
const usersDb = require('../database/users');
const content = require('../database/content');
const { cacheGet, cacheSet } = require('../utils/cache');
const filesDb = require('../database/files');
const { escMd: escMdCommon } = require('../utils/common');
const safeInt = v => { const n = parseInt(v); return isNaN(n) ? 0 : n; };

async function startHandler(ctx) {
  const uid = ctx.uid;
  const name = ctx.from?.first_name || 'Student';
  const rawText = ctx.message?.text || '';
  const payload = rawText.includes(' ') ? rawText.split(' ')[1] : ctx.startPayload || null;

  // ── deep link لملف مباشر ──
  if (payload?.startsWith('file_')) {
    const fid = safeInt(payload.replace('file_', ''));
    if (fid > 0) {
      const f = await filesDb.getFile(fid);
      if (f) {
        const isFav = await interactions.isFav(uid, fid).catch(() => false);
        const cap = '📄 *' + escMdCommon(f.title) + '*' +
          (f.description ? '\n📝 ' + escMdCommon(f.description) : '') +
          '\n📁 ' + escMdCommon(f.cat_name || '') + ' | 📖 ' + escMdCommon(f.sub_name || '');
        const kb = build([[
          btn(isFav ? '⭐ محفوظ' : '☆ حفظ', 'fav_' + fid),
          btn('🏠 الرئيسية', 'main_menu')
        ]]);
        try {
          if (f.file_type === 'photo')
            await ctx.replyWithPhoto(f.file_id, { caption: cap, parse_mode: 'Markdown', ...kb });
          else if (f.file_type === 'link')
            await ctx.reply(cap + '\n\n🔗 ' + f.file_id, { parse_mode: 'Markdown', ...kb });
          else
            await ctx.replyWithDocument(f.file_id, { caption: cap, parse_mode: 'Markdown', ...kb });
          interactions.addHistory(uid, fid).catch(() => {});
          filesDb.incDownloads(fid).catch(() => {});
        } catch (e) { await ctx.reply('❌ تعذر إرسال الملف'); }
      }
    }
  }

  const hasSp = await usersDb.getSpecialty(uid);
  if (!hasSp) return askSpecialty(ctx, name);
  return showMainMenu(ctx, name);
}

async function askSpecialty(ctx, name) {
  const specs = await content.getSpecs();
  if (!specs.length) return showMainMenu(ctx, name);
  const rows = specs.map(s => [btn('🎓 ' + s.name, 'set_sp_' + s.id)]);
  rows.push([btn('⏭ تخطي لاحقاً', 'skip_sp')]);
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
  if (!name) name = ctx.from?.first_name || 'Student';

  // ── cache بيانات المنيو دقيقة واحدة ──
  const menuKey = 'menu_data_' + uid;
  let menuData = cacheGet(menuKey);
  if (!menuData) {
    const [, spRow] = await Promise.all([
      Promise.resolve(),
      usersDb.getSpecialty(uid)
    ]);
    const _spId = spRow?.specialty_id || null;
    const sp = _spId && _spId != 0
      ? (cacheGet('spec_' + _spId) || await content.getSpec(_spId))
      : null;
    menuData = { sp };
    cacheSet(menuKey, menuData, 60000);
  }

  const { sp } = menuData;
  const hour = new Date().getHours();
  const timeGreet = hour < 12 ? '🌅 صباح النور' : hour < 17 ? '☀️ مساء الخير' : '🌙 مساء النور';

  let welcome = timeGreet + '، *' + escMd(name) + '!*\n';
  if (sp) welcome += '🎓 *' + escMd(sp.name) + '*\n';
  welcome += '━━━━━━━━━━━━━━━━\n📚 منصتك الأكاديمية — اختر ما تريد:';

  const webAppUrl = process.env.WEBHOOK_URL ? process.env.WEBHOOK_URL + '/app' : null;

  const rows = [];

  // ── زر التطبيق الرئيسي ──
  if (webAppUrl) {
    rows.push([{ text: "🚀 Let's Go", web_app: { url: webAppUrl } }]);
  } else {
    rows.push([btn('📚 تصفح المحتوى', 'browse')]);
  }

  // ── AI + تغيير تخصص ──
  rows.push([btn('🤖 المساعد الذكي', 'ai_prompt')]);
  rows.push([btn(sp ? '🎓 تغيير تخصصي' : '🎓 اختر تخصصي', 'change_sp')]);

  // ── لوحة الإدارة للأدمن والأونر فقط ──
  if (ctx.isOwner) rows.push([btn('👑 لوحة الإدارة', 'mg_menu')]);
  else if (ctx.isAdmin) rows.push([btn('🛡️ لوحة الإدارة', 'mg_menu')]);

  return eos(ctx, welcome, { parse_mode: 'Markdown', ...build(rows) });
}

startHandler.clearAiMode = async function(uid) {
  const state = global.getState(uid);
  if (state?.type === 'ai_mode') await global.delState(uid);
};

module.exports = startHandler;
module.exports.showMainMenu = showMainMenu;
module.exports.askSpecialty = askSpecialty;
