'use strict';
const { build, btn } = require('../utils/keyboard');
const { eos } = require('../utils/helpers');
const { escMd } = require('../utils/common');
const interactions  = require('../database/interactions');
const usersDb       = require('../database/users');
const content       = require('../database/content');
const filesDb       = require('../database/files');
const { cacheGet, cacheSet } = require('../utils/cache');
const safeInt = v => { const n = parseInt(v); return isNaN(n) ? 0 : n; };

async function startHandler(ctx) {
  const uid  = ctx.uid;
  const name = ctx.from?.first_name || 'Student';
  const raw  = ctx.message?.text || '';
  const payload = raw.includes(' ') ? raw.split(' ')[1] : ctx.startPayload || null;

  if (payload?.startsWith('file_')) {
    const fid = safeInt(payload.replace('file_', ''));
    if (fid > 0) {
      const f = await filesDb.getFile(fid);
      if (f) {
        const isFav = await interactions.isFav(uid, fid).catch(() => false);
        const cap = '📄 *' + escMd(f.title) + '*' +
          (f.description ? '\n📝 ' + escMd(f.description) : '') +
          '\n📁 ' + escMd(f.cat_name || '') + ' | 📖 ' + escMd(f.sub_name || '');
        const kb = build([[
          btn(isFav ? '⭐ محفوظ' : '☆ حفظ', 'fav_' + fid),
          btn('🏠 الرئيسية', 'main_menu'),
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
        } catch(_) { await ctx.reply('❌ تعذر إرسال الملف'); }
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
  rows.push([btn('⏭️ تخطي', 'skip_sp')]);
  return eos(ctx,
    '👋 *أهلاً ' + escMd(name) + '!*\n\n' +
    '🎓 اختر تخصصك للبدء:',
    { parse_mode: 'Markdown', ...build(rows) }
  );
}

async function showMainMenu(ctx, name) {
  const uid = ctx.uid;
  if (!name) name = ctx.from?.first_name || 'Student';

  const menuKey = 'menu_' + uid;
  let md = cacheGet(menuKey);
  if (!md) {
    const spRow = await usersDb.getSpecialty(uid);
    const spId  = spRow?.specialty_id || null;
    const sp    = spId && spId != 0 ? await content.getSpec(spId) : null;
    md = { sp };
    cacheSet(menuKey, md, 60000);
  }

  const { sp } = md;
  const hour   = new Date().getHours();
  const greet  = hour < 5 ? '🌙' : hour < 12 ? '🌅' : hour < 18 ? '☀️' : '🌙';

  const header =
    greet + ' *' + escMd(name) + '*' +
    (sp ? ' | 🎓 ' + escMd(sp.name) : '') +
    '\n━━━━━━━━━━━━━━━━\n' +
    '📚 *منصتك الأكاديمية*';

  // آخر ملف
  let lastBtn = null;
  try {
    const hist = await interactions.getHistory(uid, 1).catch(() => []);
    if (hist?.length) {
      const t = (hist[0].title || '').substring(0, 20);
      lastBtn = btn('▶️ استكمال: ' + t, 'preview_' + hist[0].id + '_0_0_0_0_0');
    }
  } catch(_) {}

  const rows = [
    // ── الصف 1: تصفح كامل ──
    [btn('📚 تصفح المحتوى', 'browse')],

    // ── الصف 2: بحث + جديد ──
    [btn('🔍 بحث', 'search_prompt'), btn('🆕 أحدث الملفات', 'latest')],

    // ── الصف 3: مفضلة + سجل ──
    [btn('⭐ مفضلاتي', 'favorites'), btn('🕐 سجل المشاهدة', 'history')],

    // ── الصف 4: AI ──
    [btn('🤖 المساعد الذكي', 'ai_prompt')],

    // ── الصف 5: ملف + إحصائيات ──
    [btn('👤 ملفي', 'profile'), btn('📊 إحصائياتي', 'stats')],

    // ── الصف 6: تخصص ──
    [btn(sp ? '🎓 تغيير تخصصي' : '🎓 اختر تخصصي', 'change_sp')],
  ];

  // ── آخر ملف ──
  if (lastBtn) rows.push([lastBtn]);

  // ── لوحة الإدارة ──
  if (ctx.isOwner)      rows.push([btn('👑 لوحة المالك', 'owner_panel')]);
  else if (ctx.isAdmin) rows.push([btn('🛡️ لوحة الإدارة', 'mg_menu')]);

  return eos(ctx, header, { parse_mode: 'Markdown', ...build(rows) });
}

startHandler.clearAiMode = async uid => {
  const s = global.getState(uid);
  if (s?.type === 'ai_mode') await global.delState(uid);
};

module.exports = startHandler;
module.exports.showMainMenu  = showMainMenu;
module.exports.askSpecialty  = askSpecialty;
