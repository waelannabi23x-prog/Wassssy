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

  // تحقق من الاشتراك
  if (!ctx.isOwner && !ctx.isAdmin && ctx.chat?.type === 'private') {
    const guard = require('../utils/channelGuard');
    const res = await guard.checkAllChannels({ telegram: ctx.telegram }, uid);
    if (!res.ok) {
      const { text, buttons } = guard.buildSubscribeMessage(res.missing, name);
      return ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }).catch(() => {});
    }
  }
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
          interactions.addHistory(uid, fid).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
          filesDb.incDownloads(fid).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
          // ملفات مشابهة
          require('./browse')._showSimilar(ctx, f, 0, 0, 0, 0, f.category_id).catch(() => {});
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

  // ── cache ──
  const menuKey = 'menu_data_' + uid;
  let menuData = cacheGet(menuKey);
  if (!menuData) {
    const spRow = await usersDb.getSpecialty(uid);
    const _spId = spRow?.specialty_id || null;
    const sp = _spId && _spId != 0
      ? (cacheGet('spec_' + _spId) || await content.getSpec(_spId))
      : null;
    menuData = { sp };
    cacheSet(menuKey, menuData, 60000);
  }

  const { sp } = menuData;
  const hour = new Date(Date.now() + 3600000).getHours(); // UTC+1 Algeria
  const timeGreet = hour < 5  ? '🌙 مساء النور'  :
                    hour < 12 ? '🌅 صباح النور'  :
                    hour < 18 ? '☀️ مساء الخير'  : '🌙 مساء النور';

  const specLine = sp ? '🎓 *' + escMd(sp.name) + '*' : '🎓 اختر تخصصك';

  // ── آخر ملف للمستخدم ──
  let lastFileBtn = null;
  try {
    const hist = await interactions.getHistory(uid, 1).catch(() => []);
    if (hist?.length) {
      const lf = hist[0];
      const shortTitle = (lf.title || '').substring(0, 20);
      lastFileBtn = btn('▶️ استكمال: ' + shortTitle, 'preview_' + lf.id + '_0_0_0_0_0');
    }
  } catch(err) { require('../utils/logger').debug('[catch]', err.message); }

  const welcome =
    timeGreet + ' *' + escMd(ctx.from?.first_name || 'Student') + '*\n' +
    '━━━━━━━━━━━━━━━━━━━━\n' +
    specLine + '\n\n' +
    '📚 *منصتك الأكاديمية* — اختر ما تريد:';

  const rows = [
    [btn('📚 تصفح المحتوى', 'browse')],
    [
      btn('🔍 بحث سريع',     'search_prompt'),
      btn('🆕 أحدث الملفات', 'latest'),
    ],
    [
      btn('⭐ مفضلاتي',      'favorites'),
      btn('🗂 آخر ما شاهدت', 'history'),
    ],
    [
      btn('🤖 المساعد الذكي', 'ai_prompt'),
      
    ],
    [
      btn('👤 ملفي',         'profile'),
      btn('📊 إحصائياتي',    'stats'),
    ],
    [btn(sp ? '🎓 تغيير تخصصي' : '🎓 اختر تخصصي', 'change_sp')],
  ];

  if (lastFileBtn) rows.push([lastFileBtn]);

  // ── لوحة الإدارة ──
  if (ctx.isOwner) rows.push([btn('🔧 لوحة الإدارة', 'mg_menu')]);
  else if (ctx.isAdmin) rows.push([btn('🛡️ لوحة الإدارة', 'mg_menu')]);

  return eos(ctx, welcome, { parse_mode: 'Markdown', ...build(rows) });
}

startHandler.clearAiMode = async function(uid) {
  const state = require('../utils/stateManager').getState(uid);
  if (state?.type === 'ai_mode') await require('../utils/stateManager').delState(uid);
};


async function showWelcome(telegram, chatId, from, name) {
  const uid = from?.id;
  if (!uid) return;
  try {
    const spRow = await usersDb.getSpecialty(uid);
    const _spId = spRow?.specialty_id || null;
    const sp = _spId && _spId != 0 ? await content.getSpec(_spId) : null;
    const hour = new Date(Date.now() + 3600000).getHours();
    const timeGreet = hour < 5 ? '🌙' : hour < 12 ? '🌅 صباح النور' : hour < 18 ? '☀️ مساء الخير' : '🌙 مساء النور';
    const specLine = sp ? '🎓 *' + escMd(sp.name) + '*' : '';
    const welcome = timeGreet + ' *' + escMd(name) + '*\n━━━━━━━━━━━━━━━━━━━━\n' + (specLine ? specLine + '\n\n' : '\n') + '📚 *منصتك الأكاديمية* — اختر ما تريد:';
    const rows = [
      [{ text: '📚 تصفح المحتوى', callback_data: 'browse' }],
      [{ text: '🔍 بحث سريع', callback_data: 'search_prompt' }, { text: '🆕 أحدث الملفات', callback_data: 'latest' }],
      [{ text: '⭐ مفضلاتي', callback_data: 'favorites' }, { text: '🗂 آخر ما شاهدت', callback_data: 'history' }],
      [{ text: '👤 ملفي', callback_data: 'profile' }, { text: '📊 إحصائياتي', callback_data: 'stats' }],
      [{ text: sp ? '🎓 تغيير تخصصي' : '🎓 اختر تخصصي', callback_data: 'change_sp' }],
    ];
    await telegram.sendMessage(chatId, welcome, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows } });
  } catch(e) {}
}

module.exports = startHandler;
module.exports.showMainMenu = showMainMenu;
module.exports.showWelcome = showWelcome;
module.exports.askSpecialty = askSpecialty;
