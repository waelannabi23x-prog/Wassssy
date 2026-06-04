'use strict';
const { handleSettingsCallback } = require('../handlers/group_commands');
const groupPanel = require('../handlers/group_panel');

module.exports.registerCallbacks = function(bot, deps) {
  const {
    CBDedup, cbRes, startHandler, manage, browse, userH,
    bundlesDb, contentDb, usersDb, interactions, commentsDb,
    cacheClear, cacheClearPrefix, kbBtn, kbBuild, eos,
    logger, safeInt, tagAll, muteAll, unmuteAll,
  } = deps;

  const { run: dbRun, all: dbAll } = require('../database/db');
  const filesDb  = require('../database/files');
  const million  = require('../handlers/million');

  // ── Helpers ──
  async function hGrpSp(ctx, d) {
    if (!ctx.isOwner) return ctx.answerCbQuery('🚫 للمالك فقط', { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    const r = d.substring(7), i = r.lastIndexOf('_');
    const cid = parseInt(r.substring(0, i)), sid = parseInt(r.substring(i + 1));
    try {
      await dbRun('INSERT INTO group_chats(chat_id,specialty_id) VALUES($1,$2) ON CONFLICT(chat_id) DO UPDATE SET specialty_id=$2', [cid, sid]);
      const sp = await dbAll('SELECT name FROM specialties WHERE id=$1', [sid]);
      const nm = sp[0]?.name || sid;
      await ctx.answerCbQuery('✅ ' + nm).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      await ctx.telegram.editMessageText(cid, ctx.callbackQuery.message.message_id, null, '✅ تخصص القروب: 🎓 ' + nm).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    } catch(e) { ctx.answerCbQuery('❌ ' + e.message, { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); }); }
  }

  async function hGrpDl(ctx, d) {
    if (!ctx.isOwner) return ctx.answerCbQuery('🚫').catch(() => {});
    // ✅ رد فوري على الزر
    ctx.answerCbQuery('📤 جاري الإرسال...').catch(() => {});
    try {
      const f = await filesDb.getFile(d.substring(7));
      if (!f) return;
      const cap = '📄 ' + f.title + (f.sub_name ? '\n📚 ' + f.sub_name : '');
      let sm;
      if (f.file_type === 'photo')     sm = await ctx.telegram.sendPhoto(ctx.chat.id, f.file_id, { caption: cap });
      else if (f.file_type === 'link') sm = await ctx.telegram.sendMessage(ctx.chat.id, cap + '\n🔗 ' + f.file_id);
      else                              sm = await ctx.telegram.sendDocument(ctx.chat.id, f.file_id, { caption: cap });
      if (sm?.message_id) dbRun('INSERT INTO group_bot_msgs(chat_id,message_id) VALUES($1,$2)', [ctx.chat.id, sm.message_id]).catch(() => {});
    } catch(e) { logger.error('[hGrpDl]', e.message); }
  }

  async function hSearchDel(ctx, d) {
    if (!ctx.isAdmin) return ctx.answerCbQuery('🚫', { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    const p = d.substring(11).split('|'), fid = p[0], q = decodeURIComponent(p[1] || '');
    await filesDb.softDelete(fid);
    cacheClearPrefix('search_');
    if (global._clearSearchCache) global._clearSearchCache();
    await ctx.answerCbQuery('✅ تم الحذف').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    return userH.handleSearch(ctx, q);
  }

  async function hMgTtype(ctx, d) {
    if (!ctx.reply) return;
    const i = d.indexOf('_', 9), tt = d.substring(9, i), nm = decodeURIComponent(d.substring(i + 1));
    if (tt === 'text' || tt === 'link') {
      await require('../utils/stateManager').setState(ctx.from?.id, { type: 'mg_tpl_content', name: nm, tplType: tt, fileId: '' });
      return ctx.reply(tt === 'link' ? '🔗 اكتب الرابط:' : '✏️ اكتب المحتوى:').catch(() => {});
    }
    await require('../utils/stateManager').setState(ctx.from?.id, { type: 'mg_tpl_file', name: nm, tplType: tt, fileId: '' });
    return ctx.reply('📎 أبعث الملف أو الصورة:').catch(() => {});
  }

  // ── Exact matches ──
  const exactR = new Map([
    ['bundle_search_prompt', async ctx => {
      await require('../utils/stateManager').setState(ctx.uid, { type: 'bundle_search' });
      return ctx.reply('🔍 اكتب اسم الحزمة للبحث:').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }],
    ['bundle_list', async ctx => {
      try {
        const rows = await bundlesDb.getAllBundles().catch(() => []);
        if (!rows.length) return ctx.reply('📦 لا توجد حزم.').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
        const kb = rows.map(b => [kbBtn('📦 ' + b.title + (b.specialty_name ? ' · ' + b.specialty_name : ''), 'bundle_view_' + b.id)]);
        kb.push([kbBtn('➕ حزمة جديدة', 'bundle_new')]);
        return eos(ctx, '📦 *الحزم الدراسية* (' + rows.length + ')', { parse_mode: 'Markdown', ...kbBuild(kb) });
      } catch(e) { return ctx.reply('❌ ' + e.message).catch(err => { require('../utils/logger').debug("[silent]", err.message); }); }
    }],
    ['bundle_new', async ctx => {
      await require('../utils/stateManager').setState(ctx.uid, { type: 'mg_bundle_create' });
      return ctx.reply('📦 اكتب اسم الحزمة الجديدة:').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }],
    ['noop',       () => {}],
    ['main_menu',  ctx => startHandler(ctx)],
    
    ['mg_open_app', async ctx => {
      const url = process.env.WEBHOOK_URL + '/app/app_index.html';
      return ctx.reply('📱 افتح الـ Mini App:', {
        reply_markup: { inline_keyboard: [[{ text: '📱 فتح EduMaster App', web_app: { url } }]] }
      }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }],
    ['mg_toggle_app', async ctx => {
      global._appPublic = !global._appPublic;
      await ctx.answerCbQuery(global._appPublic ? '✅ App ظاهر للكل' : '🔒 App مخفي', { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      return manage.mainMenu(ctx);
    }],
    ['mg_menu',    ctx => { if (!ctx.isAdmin) return ctx.answerCbQuery('🚫', { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); }); return manage.mainMenu(ctx); }],
    ['mg_content', ctx => { if (!ctx.isAdmin) return ctx.answerCbQuery('🚫', { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); }); return manage.handleCallback(ctx, 'mg_content'); }],
    ['browse',          ctx => browse.showSpecs(ctx)],
    ['latest',          ctx => userH.showLatest(ctx)],
    ['new_in_sp',       ctx => userH.showNewInSpecialty(ctx)],
    ['recommended',     ctx => userH.showRecommended(ctx)],
    ['favorites',       ctx => userH.showFavorites(ctx)],
    ['history',         ctx => userH.showHistory(ctx)],
    ['profile',         ctx => userH.showProfile(ctx)],
    ['stats',           ctx => userH.showStats(ctx)],
    ['progress',        ctx => userH.showProgress(ctx)],
    ['search_prompt',   ctx => { require('../utils/stateManager').setState(ctx.uid, { type: 'search' }); return ctx.reply('🔍 اكتب كلمة البحث:').catch(err => { require('../utils/logger').debug("[silent]", err.message); }); }],
    ['ai_prompt',       ctx => { require('../utils/stateManager').setState(ctx.uid, { type: 'ai_mode' }); return ctx.reply('🤖 المساعد الذكي مفعل!\n\nاكتب سؤالك:').catch(err => { require('../utils/logger').debug("[silent]", err.message); }); }],
    ['ai_reset',        ctx => { const { resetChat } = require('../handlers/ai_chat'); resetChat(ctx.uid); return ctx.reply('🔄 تم مسح سياق المحادثة.').catch(err => { require('../utils/logger').debug("[silent]", err.message); }); }],
    ['clear_my_history', async ctx => {
      await dbRun('DELETE FROM history WHERE user_id=$1', [ctx.uid]).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      cacheClear('lastfile_' + ctx.uid); cacheClear('rec_' + ctx.uid);
      return ctx.answerCbQuery('✅ تم مسح سجلك', { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }],
    ['skip_sp',   async ctx => { await usersDb.setSpecialty(ctx.uid, 0); return startHandler.showMainMenu(ctx); }],
    ['change_sp', async ctx => {
      const sp = await contentDb.getSpecs();
      return eos(ctx, '🎓 *اختر تخصصك:*', { parse_mode: 'Markdown', ...kbBuild(sp.map(s => [kbBtn('🎓 ' + s.name, 'set_sp_' + s.id)])) });
    }],
  ]);

  // ── Prefix matches — مرتبة من الأطول للأقصر ──
  const prefR = [
    // Bundle
    { p: 'bundle_del_file_',  fn: async (ctx, d) => {
      if (!ctx.isAdmin) return ctx.answerCbQuery('🚫', { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      const p = d.substring(16).split('_'), bid = parseInt(p[0]), fid = parseInt(p[1]);
      try {
        await bundlesDb.removeBundleFile(bid, fid);
        await ctx.answerCbQuery('✅ تم حذف الملف').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
        const [files, b] = await Promise.all([bundlesDb.getBundleFiles(bid), bundlesDb.getBundle(bid)]);
        const kb = files.map(f => [kbBtn('🗑️ ' + f.title.substring(0,35), 'bundle_del_file_' + bid + '_' + f.id)]);
        kb.push([kbBtn('➕ إضافة ملفات', 'bundle_add_files_' + bid), kbBtn('🗑️ حذف الحزمة', 'bundle_delete_' + bid)]);
        kb.push([kbBtn('◀️ رجوع', 'mg_content')]);
        return eos(ctx, '📦 *' + (b.title || (b.title || b.name || 'حزمة') || "حزمة") + '*\n\n' + files.length + ' ملف', { parse_mode: 'Markdown', ...kbBuild(kb) });
      } catch(e) { ctx.answerCbQuery('❌ ' + e.message, { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); }); }
    }},
    { p: 'bundle_add_files_', fn: async (ctx, d) => {
      if (!ctx.isAdmin) return ctx.answerCbQuery('🚫', { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      const bid = parseInt(d.substring(17));
      await require('../utils/stateManager').setState(ctx.uid, { type: 'mg_bundle_files', bundleId: bid, fileCount: 0 });
      return ctx.reply('📦 أرسل الملفات الآن.\n/done للإنهاء').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }},
    { p: 'bundle_delete_',    fn: async (ctx, d) => {
      if (!ctx.isOwner) return ctx.answerCbQuery('🚫 للمالك فقط', { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      const bid = parseInt(d.substring(14));
      try { await bundlesDb.deleteBundle(bid); await ctx.answerCbQuery('✅ تم حذف الحزمة').catch(err => { require('../utils/logger').debug("[silent]", err.message); }); return ctx.reply('✅ تم حذف الحزمة.').catch(err => { require('../utils/logger').debug("[silent]", err.message); }); }
      catch(e) { ctx.answerCbQuery('❌ ' + e.message, { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); }); }
    }},
    { p: 'bundle_view_',      fn: async (ctx, d) => {
      const bid = parseInt(d.substring(12));
      try {
        const [b, files] = await Promise.all([bundlesDb.getBundle(bid), bundlesDb.getBundleFiles(bid)]);
        if (!b) return ctx.answerCbQuery('❌ غير موجود').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
        const kb = files.map(f => [kbBtn('🗑️ ' + f.title.substring(0,35), 'bundle_del_file_' + bid + '_' + f.id)]);
        kb.push([kbBtn('➕ إضافة ملفات', 'bundle_add_files_' + bid), kbBtn('🗑️ حذف الحزمة', 'bundle_delete_' + bid)]);
        kb.push([kbBtn('◀️ رجوع', 'mg_content')]);
        return eos(ctx, '📦 *' + (b.title || (b.title || b.name || 'حزمة') || "حزمة") + '*\n\n' + files.length + ' ملف\n\n_اضغط على ملف لحذفه_', { parse_mode: 'Markdown', ...kbBuild(kb) });
      } catch(e) { ctx.answerCbQuery('❌ ' + e.message, { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); }); }
    }},

    // Search & Manage
    { p: 'search_del_', fn: hSearchDel },
    { p: 'mg_ttype_',   fn: hMgTtype  },

    // Group Admin
    { p: 'unmute_all_', fn: (ctx, d) => unmuteAll(ctx, parseInt(d.substring(11))) },
    { p: 'mute_all_',   fn: (ctx, d) => muteAll(ctx, parseInt(d.substring(9))) },
    { p: 'tag_all_',    fn: (ctx, d) => tagAll(ctx, parseInt(d.substring(8))) },

    // Report & Comments
    { p: 'do_report_',  fn: (ctx, d) => { const p = d.substring(10).split('_'); return browse.doReport(ctx, p[0], p[1], p[2], p[3], p[4], p[5], p[6]); }},
    { p: 'add_cmt_',    fn: async (ctx, d) => {
      const p = d.substring(8).split('_');
      await require('../utils/stateManager').setState(ctx.uid, { type: 'add_comment', fid: p[0], spId: p[1], yrId: p[2], smId: p[3], sbId: p[4], catId: p[5] });
      return ctx.reply('✍️ اكتب تعليقك:\n_(أو /cancel)_', { parse_mode: 'Markdown' }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }},
    { p: 'cmt_pg_',     fn: (ctx, d) => { const p = d.substring(7).split('_'); return browse.showComments(ctx, p[0], p[1], p[2], p[3], p[4], p[5], p[6], parseInt(p[7])); }},
    { p: 'dcmt_',       fn: async (ctx, d) => {
      const p = d.substring(5).split('_');
      await commentsDb.deleteCommentAdmin(p[0]);
      await ctx.answerCbQuery('✅ تم الحذف').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      return browse.showComments(ctx, p[1], p[2], p[3], p[4], p[5], p[6], p[7]);
    }},
    { p: 'report_',     fn: (ctx, d) => { const p = d.substring(7).split('_'); return browse.showReportMenu(ctx, p[0], p[1], p[2], p[3], p[4], p[5]); }},
    { p: 'cmt_',        fn: (ctx, d) => { const p = d.substring(4).split('_'); return browse.showComments(ctx, p[0], p[1], p[2], p[3], p[4], p[5], p[6]); }},

    // Navigation pages
    { p: 'yr_page_',    fn: (ctx, d) => { const p = d.substring(8).split('_'); return browse.showYears(ctx, p[0], parseInt(p[1])); }},
    { p: 'sb_page_',    fn: (ctx, d) => { const p = d.substring(8).split('_'); return browse.showSubjects(ctx, p[0], p[1], p[2], parseInt(p[3])); }},
    { p: 'ct_page_',    fn: (ctx, d) => { const p = d.substring(8).split('_'); return browse.showFiles(ctx, p[0], p[1], p[2], p[3], p[4], parseInt(p[5])); }},
    { p: 'preview_',    fn: (ctx, d) => { const p = d.split('_'); return browse.showPreview(ctx, p[1], p[2], p[3], p[4], p[5], p[6]); }},

    // Specialty, Favorites, Rating
    { p: 'set_sp_',     fn: async (ctx, d) => { await usersDb.setSpecialty(ctx.uid, safeInt(d.substring(7))); await ctx.answerCbQuery('✅ تم حفظ تخصصك').catch(err => { require('../utils/logger').debug("[silent]", err.message); }); return startHandler.showMainMenu(ctx); }},
    { p: 'unfav_',      fn: (ctx, d) => userH.toggleFav(ctx, safeInt(d.substring(6)), true)  },
    { p: 'rate_',       fn: async (ctx, d) => {
      const p = d.substring(5).split('_');
      await interactions.addRating(ctx.uid, p[0], parseInt(p[1]));
      await ctx.answerCbQuery('⭐ تم التقييم!').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      cacheClear('personal_' + ctx.uid + '_' + p[0]);
      return browse.showPreview(ctx, p[0], p[2], p[3], p[4], p[5], p[6]);
    }},

    // Group
    { p: 'grp_main',    fn: (ctx, d) => groupPanel.showMainMenu(ctx) },
    { p: 'gp_',         fn: (ctx, d) => groupPanel.handleCallback(ctx, d) },
    { p: 'grp_sp_',     fn: hGrpSp },
    { p: 'grp_dl_',     fn: hGrpDl },

    // Back navigation shortcuts
    { p: 'sbs_',        fn: (ctx, d) => { const p = d.substring(4).split('_'); return browse.showSubjects(ctx, p[0], p[1], p[2]); }},
    { p: 'sms_',        fn: (ctx, d) => { const p = d.substring(4).split('_'); return browse.showSemesters(ctx, p[0], p[1]); }},
    { p: 'yrs_',        fn: (ctx, d) => { const p = d.substring(4).split('_'); return browse.showYears(ctx, p[0]); }},
    { p: 'fav_',        fn: (ctx, d) => userH.toggleFav(ctx, safeInt(d.substring(4)), false) },

    // Browse navigation — الترتيب مهم (الأطول أولاً)
    { p: 'bundle_',     fn: (ctx, d) => { const p = d.split('_'); return browse.showBundle(ctx, p[1], p[2], p[3], p[4], p[5], p[6]); }},
    { p: 'bdl_',        fn: (ctx, d) => { const p = d.split('_'); return browse.sendBundle(ctx, p[1], p[2], p[3], p[4], p[5], p[6]); }},
    { p: 'fl_',         fn: (ctx, d) => { const p = d.split('_'); return browse.sendFile(ctx, p[1], p[2], p[3], p[4], p[5], p[6]); }},
    { p: 'ml_',         fn: (ctx)    => million.handleCallback(bot, ctx) },
    { p: 'ct_',         fn: (ctx, d) => { const p = d.split('_'); return browse.showFiles(ctx, p[1], p[2], p[3], p[4], p[5]); }},
    { p: 'sb_',         fn: (ctx, d) => { const p = d.split('_'); return browse.showCategories(ctx, p[1], p[2], p[3], p[4]); }},
    { p: 'sm_',         fn: (ctx, d) => { const p = d.split('_'); return browse.showSubjects(ctx, p[1], p[2], p[3]); }},   // ✅ semester → subjects
    { p: 'yr_',         fn: (ctx, d) => { const p = d.split('_'); return browse.showSemesters(ctx, p[1], p[2]); }},          // ✅ year → semesters
    { p: 'sp_',         fn: (ctx, d) => browse.showYears(ctx, safeInt(d.substring(3))) },                                    // ✅ specialty → years

    // Admin (آخر شيء — prefix قصير)

    // del_channel
    { p: 'del_channel_', fn: async (ctx, d) => {
      if (!ctx.isOwner) return ctx.answerCbQuery("للمالك فقط", { show_alert: true }).catch(() => {});
      const channelId = d.replace('del_channel_', '');
      const { removeChannel } = require('../utils/channelGuard');
      const { cacheClear } = require('../utils/cache');
      await removeChannel(channelId).catch(() => {});
      cacheClear('required_channels');
      ctx.answerCbQuery('تم الحذف').catch(() => {});
      const { getChannels } = require("../utils/channelGuard");
      const list = await getChannels().catch(() => []);
      if (!list.length) return ctx.editMessageText("لا توجد قنوات").catch(() => ctx.reply("لا توجد قنوات").catch(() => {}));
      const rows = list.map(ch => [{
        text: "🗑 " + (ch.channel_name || ch.channel_id),
        callback_data: "del_channel_" + ch.channel_id
      }]);
      return ctx.editMessageReplyMarkup({ inline_keyboard: rows }).catch(() => {});
    }},
    { p: 'leave_grp_', fn: async (ctx, d) => {
      if (!ctx.isOwner) return ctx.answerCbQuery('🚫 للمالك فقط', { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      const chatId = parseInt(d.substring(10));
      try {
        await ctx.telegram.leaveChat(chatId);
        await dbRun('DELETE FROM group_chats WHERE chat_id=$1', [chatId]);
        await ctx.answerCbQuery('✅ تم الخروج').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
        return ctx.editMessageText('✅ خرجت من القروب ' + chatId).catch(() => ctx.reply('✅ تم الخروج.').catch(err => { require('../utils/logger').debug("[silent]", err.message); }));
      } catch(e) { ctx.answerCbQuery('❌ ' + e.message, { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); }); }
    }},
    { p: 'mg_',         fn: async (ctx, d) => { if (!ctx.isAdmin) return ctx.answerCbQuery('🚫', { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); }); return manage.handleCallback(ctx, d); }},
  ];

  function _getPrefixHandler(data) {
    for (const r of prefR) if (data.startsWith(r.p)) return r.fn;
    return null;
  }

  // ── Main callback handler ──
  bot.on('callback_query', async ctx => {
    if (!ctx.from) return;
    const _raw = ctx.callbackQuery?.data, cbId = ctx.callbackQuery?.id;
    if (!_raw || CBDedup.isDupe(cbId)) return;

    const data = cbRes(_raw);
    ctx.answerCbQuery('').catch(err => { require('../utils/logger').debug("[silent]", err.message); }); // أجب فوراً — يشيل الـ spinner

    try {
      if (data.startsWith('gs_')) { await handleSettingsCallback(ctx, data); return; }

      if (ctx.chat?.type !== 'private') {
        const _grpOk = data.startsWith('grp_') || data.startsWith('del_channel_')
          || data.startsWith('gs_') || data.startsWith('grp_unban_')
          || data.startsWith('grp_unmute_') || data === 'check_subscription'
          || data === 'refresh_channels';
        if (!_grpOk)
          return ctx.answerCbQuery('👉 استخدم البوت في الخاص', { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      }

      // Pre-warm بالتوازي
      // Pre-warm aggressive
      if (data === 'browse' || data === 'main_menu') {
        contentDb.getSpecs().catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      } else if (data.startsWith('sp_')) {
        const sid = parseInt(data.split('_').pop());
        contentDb.getYears(sid).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      } else if (data.startsWith('yr_') && !data.startsWith('yr_page_')) {
        const yid = parseInt(data.split('_').pop());
        contentDb.getSemesters(yid).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      } else if (data.startsWith('sm_')) {
        const smid = parseInt(data.split('_').pop());
        Promise.all([
          contentDb.getSubjects(smid),
        ]).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      } else if (data.startsWith('sb_')) {
        const parts = data.split('_');
        const sbid = parseInt(parts.pop());
        contentDb.getCategories(sbid).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      } else if (data.startsWith('ct_') && !data.startsWith('ct_page_')) {
        const parts = data.split('_');
        // pre-warm files for this category
        const filesDb = require('../database/files');
        filesDb.getFiles(parseInt(parts[parts.length-1])).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      }

      if (exactR.has(data)) return exactR.get(data)(ctx, data);
      const _h = _getPrefixHandler(data);
      if (_h) return _h(ctx, data);

    } catch(e) { logger.error('[CB]', e.message, { data, uid: ctx.from?.id }); }
  });
};
