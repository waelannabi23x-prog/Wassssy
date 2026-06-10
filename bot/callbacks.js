const { handleBankGamesCallback } = require('../handlers/bank_games');
'use strict';
const { handleSettingsCallback } = require('../handlers/group_commands');
const browse      = require('../handlers/browse');
const groupPanel  = require('../handlers/group_panel');
const groupSetup  = require('../handlers/group_setup');
const gamesPanel  = require('../handlers/games_panel');
const millionGame = require('../handlers/millionaire');

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
    ['main_menu',  ctx => startHandler.showMainMenu(ctx)],
    ['mygroups_refresh', ctx => tools.listGroups(ctx)],
    
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
    { p: 'grp_main_',   fn: (ctx, d) => { const chatId = d.replace('grp_main_',''); const { showAllMembers } = require('../handlers/group_admin'); return showAllMembers(ctx, chatId); } },
    { p: 'grp_main',    fn: (ctx, d) => { const uid = ctx.uid || ctx.from?.id; const isOwner = uid === parseInt(process.env.OWNER_ID); return isOwner ? groupPanel.showMainMenu(ctx) : groupPanel.showMyGroups(ctx); } },
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
    { p: 'mlr_',        fn: (ctx, d) => millionGame.handleCallback(ctx, d) },
    { p: 'mar_',        fn: (ctx, d) => millionGame.handleCallback(ctx, d) },
    { p: 'share_',      fn: (ctx)    => { const { handleShare } = require('../handlers/share_summary'); return handleShare(ctx); } },
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
    { p: 'grp_stats_', fn: async (ctx, d) => {
      const chatId = d.replace('grp_stats_', '');
      try {
        const { all: dbAll2 } = require('../database/db');
        const [msgs, members, warns] = await Promise.all([
          dbAll2('SELECT COUNT(*) AS cnt FROM group_messages WHERE chat_id=$1', [chatId]).catch(() => [{ cnt: 0 }]),
          dbAll2('SELECT COUNT(*) AS cnt FROM group_members WHERE chat_id=$1', [chatId]).catch(() => [{ cnt: 0 }]),
          dbAll2('SELECT COUNT(*) AS cnt FROM group_warns WHERE chat_id=$1', [chatId]).catch(() => [{ cnt: 0 }]),
        ]);
        const text = '📊 *إحصائيات القروب*\n━━━━━━━━━━━━\n\n' +
          '👤 الأعضاء المسجلون: *' + (members[0]?.cnt || 0) + '*\n' +
          '⚠️ التحذيرات: *' + (warns[0]?.cnt || 0) + '*\n' +
          '💬 الرسائل المحفوظة: *' + (msgs[0]?.cnt || 0) + '*';
        return ctx.answerCbQuery().catch(()=>{}).then(() =>
          ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '◀️ رجوع', callback_data: 'gp_view_' + chatId }]] } })
          .catch(() => ctx.reply(text, { parse_mode: 'Markdown' }).catch(() => {}))
        );
      } catch(e) { ctx.answerCbQuery('❌ ' + e.message, { show_alert: true }).catch(() => {}); }
    }},
    { p: 'gp_close', fn: async (ctx, d) => {
      await ctx.answerCbQuery().catch(() => {});
      await ctx.deleteMessage().catch(async () => {
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
      });
      return;
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
    { p: 'mg_',         fn: async (ctx, d) => { if (!ctx.isAdmin && !ctx.isOwner) return ctx.answerCbQuery('🚫', { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); }); return manage.handleCallback(ctx, d); }},
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

    try {
      // ── ألعاب ──
      if (data === 'mb_panel' || data.startsWith('gp_million') || data.startsWith('gp_guess')) {
        return gamesPanel.handleCallback(ctx, data);
      }

      if (data === 'rules_ok') {
        ctx.answerCbQuery('✅ شكراً! التزم بالقواعد 🙏').catch(() => {});
        ctx.deleteMessage().catch(() => {});
        return;
      }
      if (data.startsWith('gs_')) {
        ctx.answerCbQuery('').catch(() => {});
        await handleSettingsCallback(ctx, data);
        return;
      }

      // أجب فوراً مرة وحدة فقط
      ctx.answerCbQuery('').catch(() => {});


      // ── toggle أذونات (يشتغل من الخاص) ──
      if (data.startsWith('grp_ptog_')) {
        const parts2 = data.replace('grp_ptog_', '').split('_');
        const permKey = parts2[0];
        const uid3    = parseInt(parts2[1]);
        const cid3    = parseInt(parts2[2]);
        const curKb   = ctx.callbackQuery?.message?.reply_markup?.inline_keyboard || [];
        const labels  = {
          can_send_messages:'الرسائل النصية',
          can_send_media_messages:'الوسائط (صور/فيديو)',
          can_send_polls:'الاستطلاعات',
          can_add_web_page_previews:'معاينة الروابط',
          can_invite_users:'دعوة أعضاء',
          can_pin_messages:'تثبيت الرسائل',
        };
        // نقلب حالة الزر في الـ keyboard
        const newKb = curKb.map(row => row.map(btn => {
          if (btn.callback_data === data) {
            const isOn = btn.text.startsWith('✅');
            return { ...btn, text: (isOn ? '❌ ' : '✅ ') + (labels[permKey] || permKey) };
          }
          return btn;
        }));
        await ctx.editMessageReplyMarkup({ inline_keyboard: newKb }).catch(() => {});
        return ctx.answerCbQuery('').catch(() => {});
      }

      if (data.startsWith('grp_psave_')) {
        const parts3  = data.replace('grp_psave_', '').split('_');
        const uid3    = parseInt(parts3[0]);
        const cid3    = parseInt(parts3[1]);
        const curKb2  = ctx.callbackQuery?.message?.reply_markup?.inline_keyboard || [];
        const keyMap  = {
          'الرسائل النصية':'can_send_messages',
          'الوسائط (صور/فيديو)':'can_send_media_messages',
          'الاستطلاعات':'can_send_polls',
          'معاينة الروابط':'can_add_web_page_previews',
          'دعوة أعضاء':'can_invite_users',
          'تثبيت الرسائل':'can_pin_messages',
        };
        const permsToSave = {};
        for (const row of curKb2) {
          for (const btn of row) {
            const isOn = btn.text.startsWith('✅');
            for (const [label, key] of Object.entries(keyMap)) {
              if (btn.text.includes(label)) permsToSave[key] = isOn;
            }
          }
        }
        try {
          await ctx.telegram.restrictChatMember(cid3, uid3, { permissions: permsToSave });
          await ctx.editMessageText('✅ *تم حفظ الأذونات بنجاح!*', { parse_mode: 'Markdown' }).catch(() => {});
          return ctx.answerCbQuery('✅ تم الحفظ').catch(() => {});
        } catch(e) {
          return ctx.answerCbQuery('❌ ' + e.message, { show_alert: true }).catch(() => {});
        }
      }

        if (data.startsWith('gp_leave_')) {
          const leaveChatId = parseInt(data.replace('gp_leave_', ''));
          const { run: dbRun2 } = require('../database/db');
          try {
            await ctx.telegram.leaveChat(leaveChatId);
            await dbRun2('UPDATE group_chats SET is_active=0 WHERE chat_id=$1', [leaveChatId]).catch(() => {});
            await ctx.editMessageText(
              '✅ *تم الخروج من القروب بنجاح*',
              { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '◀️ رجوع', callback_data: 'gp_mygroups' }]] }}
            ).catch(() => ctx.reply('✅ تم الخروج').catch(() => {}));
          } catch(e) {
            ctx.answerCbQuery('❌ فشل الخروج: ' + e.message, { show_alert: true }).catch(() => {});
          }
          return;
        }


      // ── صح أو جرأة ──
      if (data.startsWith('tnd_truth_') || data.startsWith('tnd_dare_')) {
        const isT = data.startsWith('tnd_truth_');
        const uid2 = parseInt(data.replace(isT ? 'tnd_truth_' : 'tnd_dare_', ''));
        const truths = [
          "ما هو أكبر كذبة قلتها في حياتك؟",
          "من هو الشخص الذي تحبه سراً في هذا القروب؟",
          "ما هو أحرج موقف مررت به؟",
          "ما هو الشيء الذي تخجل من الاعتراف به؟",
          "هل سبق أن تجسست على شخص ما؟",
          "ما هو أغبى شيء فعلته في حياتك؟",
          "ما هو سرك الذي لم تخبر به أحداً؟",
          "ما هو الشيء الذي تفعله سراً ولا تريد أحداً أن يعرف؟",
          "ما هو أسوأ قرار اتخذته في حياتك؟",
          "من هو الشخص الذي تعتذر منه لو قدرت؟",
        ];
        const dares = [
          "أرسل آخر صورة في هاتفك! 📸",
          "اكتب رسالة محرجة لآخر شخص تحدثت معه!",
          "غير اسمك في القروب لشيء مضحك لمدة ساعة!",
          "أرسل صوت تقلد فيه شخصاً مشهوراً! 🎤",
          "اكتب 10 أشياء تحبها في نفسك!",
          "قلد أسلوب كتابة شخص في القروب لرسالة كاملة!",
          "اعترف بشيء محرج حدث معك هذا الأسبوع!",
          "اكتب رأيك الحقيقي في آخر شخص تكلم في القروب!",
          "تحدى شخصاً آخر في القروب على شيء!",
          "أرسل ميم يعبر عن مزاجك الآن!",
        ];
        const list = isT ? truths : dares;
        const q = list[Math.floor(Math.random() * list.length)];
        const emoji = isT ? "🤔" : "😈";
        const label = isT ? "سؤال صح" : "تحدي جرأة";
        const kb = [[
          { text: isT ? "🎭 جرأة بدل" : "🤔 صح بدل", callback_data: (isT ? "tnd_dare_" : "tnd_truth_") + uid2 },
          { text: "🔄 " + (isT ? "سؤال آخر" : "تحدي آخر"), callback_data: data },
        ]];
        await ctx.editMessageText(
          emoji + " *" + label + ":*\n\n" + q,
          { parse_mode: "Markdown", reply_markup: { inline_keyboard: kb } }
        ).catch(() => {});
        return ctx.answerCbQuery("").catch(() => {});
      }

      // ── slot callbacks ──
      if (data.startsWith('slot_play_')) {
        const uid2 = parseInt(data.replace('slot_play_', ''));
        if (ctx.from.id !== uid2) return ctx.answerCbQuery('🚫 هذه ليست لعبتك!', { show_alert: true }).catch(() => {});
        const { get: dbGet, run: dbRun } = require('../database/db');
        const BET = 50;
        const acc = await dbGet('SELECT balance FROM bank_accounts WHERE user_id=$1', [uid2]).catch(() => null);
        if (!acc || parseFloat(acc.balance) < BET) return ctx.answerCbQuery('❌ رصيدك غير كافٍ! (' + BET + ' دج)', { show_alert: true }).catch(() => {});
        await dbRun('UPDATE bank_accounts SET balance=balance-$1 WHERE user_id=$2', [BET, uid2]).catch(() => {});
        const symbols = ['🍎','🍊','🍋','🍒','🍇','⭐','💎','7️⃣'];
        const r1 = symbols[Math.floor(Math.random()*symbols.length)];
        const r2 = symbols[Math.floor(Math.random()*symbols.length)];
        const r3 = symbols[Math.floor(Math.random()*symbols.length)];
        let win = 0, resultTxt = '';
        if (r1===r2&&r2===r3) {
          if (r1==='💎'){win=BET*10;resultTxt='💎 *جاكبوت!! ×10*';}
          else if (r1==='7️⃣'){win=BET*7;resultTxt='7️⃣ *سبعة ×7*';}
          else if (r1==='⭐'){win=BET*5;resultTxt='⭐ *نجوم ×5*';}
          else {win=BET*3;resultTxt='🎉 *ثلاثة متشابهة ×3*';}
        } else if (r1===r2||r2===r3||r1===r3) { win=Math.floor(BET*1.5); resultTxt='✅ *اثنان متشابهان ×1.5*'; }
        else { resultTxt='❌ *خسرت!*'; }
        if (win>0) await dbRun('UPDATE bank_accounts SET balance=balance+$1 WHERE user_id=$2',[win,uid2]).catch(()=>{});
        const newBal = await dbGet('SELECT balance FROM bank_accounts WHERE user_id=$1',[uid2]).then(r=>r?.balance||0).catch(()=>0);
        await ctx.editMessageText(
          '🎰 *ماكينة القمار*\n\n[ '+r1+' | '+r2+' | '+r3+' ]\n\n'+resultTxt+'\n'+(win>0?'💰 ربحت: *'+win+' دج*':'💸 خسرت: *'+BET+' دج*')+'\n👛 رصيدك: *'+parseFloat(newBal).toFixed(0)+' دج*',
          { parse_mode:'Markdown', reply_markup:{ inline_keyboard:[[
            {text:'🎰 العب مجدداً', callback_data:'slot_play_'+uid2},
            {text:'💰 رصيدي', callback_data:'slot_bal_'+uid2},
          ]]}}
        ).catch(()=>{});
        return ctx.answerCbQuery('').catch(()=>{});
      }

      if (data.startsWith('slot_bal_')) {
        const uid2 = parseInt(data.replace('slot_bal_', ''));
        const { get: dbGet } = require('../database/db');
        const acc = await dbGet('SELECT balance FROM bank_accounts WHERE user_id=$1',[uid2]).catch(()=>null);
        return ctx.answerCbQuery('💰 رصيدك: '+(acc?parseFloat(acc.balance).toFixed(0):0)+' دج', { show_alert:true }).catch(()=>{});
      }

      // ── shop callbacks ──
      if (data.startsWith('shop_buy_')) {
        const parts = data.replace('shop_buy_','').split('_');
        const itemId = parseInt(parts[0]);
        const uid2   = parseInt(parts[1]);
        if (ctx.from.id !== uid2) return ctx.answerCbQuery('🚫 هذه ليست قائمتك!', { show_alert:true }).catch(()=>{});
        const { get: dbGet, run: dbRun } = require('../database/db');
        const items = [
          { id:1, name:'🛡️ درع الحماية',  price:500  },
          { id:2, name:'⭐ نجمة VIP',      price:1000 },
          { id:3, name:'🎯 تذكرة مليون',   price:300  },
          { id:4, name:'🎰 رمز سلوت ×2',   price:200  },
          { id:5, name:'📦 صندوق مفاجأة',  price:150  },
        ];
        const item = items.find(i=>i.id===itemId);
        if (!item) return ctx.answerCbQuery('❌ منتج غير موجود', {show_alert:true}).catch(()=>{});
        const acc = await dbGet('SELECT balance FROM bank_accounts WHERE user_id=$1',[uid2]).catch(()=>null);
        if (!acc || parseFloat(acc.balance) < item.price)
          return ctx.answerCbQuery('❌ رصيدك غير كافٍ! تحتاج '+item.price+' دج', {show_alert:true}).catch(()=>{});
        await dbRun('UPDATE bank_accounts SET balance=balance-$1 WHERE user_id=$2',[item.price, uid2]).catch(()=>{});
        // تنفيذ المنتج
        if (itemId === 5) {
          const bonus = Math.floor(Math.random()*1900)+100;
          await dbRun('UPDATE bank_accounts SET balance=balance+$1 WHERE user_id=$2',[bonus,uid2]).catch(()=>{});
          return ctx.answerCbQuery('📦 فتحت الصندوق وربحت '+bonus+' دج! 🎉', {show_alert:true}).catch(()=>{});
        }
        await ctx.answerCbQuery('✅ اشتريت '+item.name+'!', {show_alert:true}).catch(()=>{});
        const newBal = await dbGet('SELECT balance FROM bank_accounts WHERE user_id=$1',[uid2]).then(r=>r?.balance||0).catch(()=>0);
        await ctx.editMessageText(
          '✅ *تمت عملية الشراء!*\n\n'+item.name+'\n💰 المبلغ: '+item.price+' دج\n👛 رصيدك الآن: '+parseFloat(newBal).toFixed(0)+' دج',
          { parse_mode:'Markdown', reply_markup:{ inline_keyboard:[[{text:'🏪 العودة للمتجر', callback_data:'shop_back_'+uid2}]]}}
        ).catch(()=>{});
        return;
      }

      if (data === 'shop_close') {
        await ctx.deleteMessage().catch(()=>{});
        return ctx.answerCbQuery('').catch(()=>{});
      }

      if (data.startsWith('shop_back_')) {
        return ctx.answerCbQuery('🏪 اكتب /متجر لفتح المتجر مجدداً').catch(()=>{});
      }

      // ── bank callbacks ──
      if (data === 'bank_transfer_help') {
        return ctx.answerCbQuery('💸 رد على رسالة شخص واكتب: فارسي 500', { show_alert: true }).catch(() => {});
      }
      if (data.startsWith('bank_stats_')) {
        const uid2 = parseInt(data.replace('bank_stats_', ''));
        const { all: dbAll } = require('../database/db');
        const stats = await dbAll(
          'SELECT type, SUM(amount) as total, COUNT(*) as cnt FROM bank_transactions WHERE to_id=$1 OR from_id=$1 GROUP BY type',
          [uid2]
        ).catch(() => []);
        let txt = '📊 *إحصائياتك البنكية*\n━━━━━━━━━━━━━━━━━━\n\n';
        for (const s of stats) {
          txt += '• ' + (s.type||'معاملة') + ': ' + s.cnt + ' مرة (' + s.total + ' دج)\n';
        }
        if (!stats.length) txt += '_لا توجد معاملات بعد_';
        await ctx.reply(txt, { parse_mode: 'Markdown' }).catch(() => {});
        return ctx.answerCbQuery('').catch(() => {});
      }
      if (data === 'bank_top') {
        const { all: dbAll } = require('../database/db');
        const top = await dbAll(
          'SELECT user_id, first_name, balance FROM bank_accounts ORDER BY balance DESC LIMIT 10'
        ).catch(() => []);
        let txt = '🏆 *أثرى المستخدمين*\n━━━━━━━━━━━━━━━━━━\n\n';
        const medals = ['🥇','🥈','🥉'];
        top.forEach((u,i) => {
          txt += (medals[i]||i+1+'.') + ' ' + (u.first_name||'مجهول') + ' — *' + parseFloat(u.balance).toLocaleString() + ' دج*\n';
        });
        await ctx.reply(txt, { parse_mode: 'Markdown' }).catch(() => {});
        return ctx.answerCbQuery('').catch(() => {});
      }
      if (data === 'grp_search_close') {
        await ctx.deleteMessage().catch(() => {});
        return ctx.answerCbQuery('').catch(() => {});
      }

      if (ctx.chat?.type !== 'private') {
        if (data.startsWith('grp_main_')) {
          const chatId = data.replace('grp_main_', '');
          const { showAllMembers } = require('../handlers/group_admin');
          return showAllMembers(ctx, chatId);
        }

        if (data.startsWith('grp_reg_btn_')) {
          const regChatId = data.replace('grp_reg_btn_', '');
          const { registerMembers } = require('../handlers/group_admin');
          ctx.answerCbQuery('').catch(() => {});
          return registerMembers(ctx, regChatId);
        }

        if (data.startsWith('grp_register_')) {
          const regChatId = data.replace('grp_register_', '');
          const u = ctx.from;
          require('../database/db').run(
            `INSERT INTO group_members(chat_id,user_id,username,first_name,updated_at)
             VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP)
             ON CONFLICT(chat_id,user_id) DO UPDATE SET first_name=EXCLUDED.first_name, updated_at=CURRENT_TIMESTAMP`,
            [regChatId, u.id, u.username||'', u.first_name||'']
          ).catch(() => {});
          require('../utils/cache').cacheClear('grp_members_' + regChatId);
          ctx.answerCbQuery('✅ تم تسجيلك!').catch(() => {});
          return;
        }

        // ── ألعاب المليون (في القروبات والخاص) ──────────────────
        if (data.startsWith('ml_') || data.startsWith('ma_') ||
            data.startsWith('mlr_') || data.startsWith('mar_')) {
          if (millionGame.handleCallback) {
            return millionGame.handleCallback(ctx, data).catch(e => ctx.answerCbQuery('❌ ' + e.message).catch(() => {}));
          }
          return;
        }

        
        // ── أزرار info/warn السريعة ──
        if (data.startsWith('grp_mute_1h_')) {
          const uid2 = parseInt(data.replace('grp_mute_1h_', ''));
          const { muteMember } = require('../handlers/group_admin');
          await muteMember(ctx, ctx.chat.id, uid2, 60);
          return ctx.answerCbQuery('🔇 تم الإسكات ساعة').catch(() => {});
        }
        if (data.startsWith('grp_ban_')) {
          const uid2 = parseInt(data.replace('grp_ban_', ''));
          await ctx.telegram.banChatMember(ctx.chat.id, uid2).catch(() => {});
          await ctx.editMessageReplyMarkup({ inline_keyboard: [[{ text: '🔓 رفع الحظر', callback_data: 'grp_unban_' + uid2 }]] }).catch(() => {});
          return ctx.answerCbQuery('🚫 تم الحظر').catch(() => {});
        }
        if (data.startsWith('grp_warns_')) {
          const uid2 = parseInt(data.replace('grp_warns_', ''));
          const { get: dbGet } = require('../database/db');
          const w = await dbGet('SELECT COUNT(*) as c FROM group_warns WHERE chat_id=$1 AND user_id=$2', [ctx.chat.id, uid2]).catch(() => ({ c:0 }));
          return ctx.answerCbQuery('❗ الإنذارات: ' + (w?.c||0) + '/3', { show_alert: true }).catch(() => {});
        }
        if (data.startsWith('grp_perms_')) {
          const parts   = data.replace('grp_perms_', '').split('_');
          const uid2    = parseInt(parts[0]);
          const chatId2 = parts[1] ? parseInt(parts[1]) : ctx.chat.id;
          const adminId = ctx.from.id;
          const member  = await ctx.telegram.getChatMember(chatId2, uid2).catch(() => null);
          const p = member?.status === 'restricted' ? member : null;
          const can = (key) => p ? (p[key] !== false) : true;
          const tog = (label, key, val) => [{
            text: (can(key) ? '✅ ' : '❌ ') + label,
            callback_data: 'grp_ptog_' + key + '_' + uid2 + '_' + chatId2
          }];
          const kb = [
            tog('الرسائل النصية',      'can_send_messages',          true),
            tog('الوسائط (صور/فيديو)', 'can_send_media_messages',    true),
            tog('الاستطلاعات',         'can_send_polls',             true),
            tog('معاينة الروابط',      'can_add_web_page_previews',  true),
            tog('دعوة أعضاء',          'can_invite_users',           true),
            tog('تثبيت الرسائل',       'can_pin_messages',           false),
            [{ text: '💾 حفظ', callback_data: 'grp_psave_' + uid2 + '_' + chatId2 }],
          ];
          const txt = '🎛 *أذونات العضو*\n🆔 ' + uid2 + '\n\n_اضغط لتفعيل/تعطيل كل إذن ثم اضغط حفظ_';
          try {
            await ctx.telegram.sendMessage(adminId, txt, {
              parse_mode: 'Markdown',
              reply_markup: { inline_keyboard: kb }
            });
            return ctx.answerCbQuery('📨 تم الإرسال للخاص', { show_alert: false }).catch(() => {});
          } catch(_) {
            return ctx.answerCbQuery('⚠️ افتح الخاص مع البوت أولاً', { show_alert: true }).catch(() => {});
          }
        }
        if (data.startsWith('grp_restrict_')) {
          const uid2 = parseInt(data.replace('grp_restrict_', ''));
          await ctx.telegram.restrictChatMember(ctx.chat.id, uid2, {
            permissions: { can_send_messages: false, can_send_media_messages: false, can_send_polls: false }
          }).catch(() => {});
          await ctx.editMessageReplyMarkup({ inline_keyboard: [[{ text: '🔊 إعطاء الكلام', callback_data: 'grp_unrestrict_' + uid2 }]] }).catch(() => {});
          return ctx.answerCbQuery('🔇 تم سحب الكلام').catch(() => {});
        }
        if (data.startsWith('grp_unrestrict_')) {
          const uid2 = parseInt(data.replace('grp_unrestrict_', ''));
          await ctx.telegram.restrictChatMember(ctx.chat.id, uid2, {
            permissions: { can_send_messages: true, can_send_media_messages: true, can_send_polls: true, can_add_web_page_previews: true }
          }).catch(() => {});
          await ctx.editMessageReplyMarkup({ inline_keyboard: [[{ text: '🔇 سحب الكلام', callback_data: 'grp_restrict_' + uid2 }]] }).catch(() => {});
          return ctx.answerCbQuery('🔊 تم إعطاء الكلام').catch(() => {});
        }

        // ── أزرار warn/info — للأدمن فقط ──
        if (data.startsWith('grp_warns_show_') || data.startsWith('grp_mute_60_') ||
            data.startsWith('grp_ban_now_') || data.startsWith('grp_perms_') ||
            data.startsWith('grp_restrict_') || data.startsWith('grp_unrestrict_') ||
            data.startsWith('grp_ptog_') || data.startsWith('grp_psave_')) {
          const isAdmOrOwner = ctx.isAdmin || ctx.isOwner ||
            ['administrator','creator'].includes(
              (await ctx.telegram.getChatMember(ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id, ctx.from.id).catch(() => null))?.status
            );
          if (!isAdmOrOwner) return ctx.answerCbQuery('🚫 للمشرفين فقط', { show_alert: true }).catch(() => {});
        }
        if (data.startsWith('grp_warns_show_')) {
          const parts_w = data.replace('grp_warns_show_', '').split('_');
          const uid2  = parseInt(parts_w[0]);
          const cid_w = parts_w[1] ? parseInt(parts_w[1]) : ctx.chat?.id;
          const { all: dbAll, run: dbRun } = require('../database/db');
          const rows = await dbAll('SELECT id, reason, created_at FROM group_warns WHERE chat_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 5', [cid_w, uid2]).catch(() => []);
          const cnt = rows.length;
          let txt = '❗ *إنذارات العضو: ' + cnt + '/3*\n\n';
          for (const r of rows) {
            const d = new Date(r.created_at).toLocaleDateString('ar');
            txt += '• ' + r.reason + ' — ' + d + '\n';
          }
          if (!cnt) txt = '✅ لا توجد إنذارات بعد';
          const wKb = [[
            { text: '➕ إنذار', callback_data: 'grp_wadd_' + uid2 + '_' + cid_w },
            { text: '➖ حذف إنذار', callback_data: 'grp_wdel_' + uid2 + '_' + cid_w },
          ]];
          await ctx.answerCbQuery('').catch(() => {});
          return ctx.reply(txt, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: wKb } }).catch(() => {});
        }

        if (data.startsWith('grp_wadd_')) {
          const parts_wa = data.replace('grp_wadd_', '').split('_');
          const uid2 = parseInt(parts_wa[0]);
          const cid_w = parseInt(parts_wa[1]);
          const { run: dbRun, get: dbGet } = require('../database/db');
          await dbRun(
            'INSERT INTO group_warns(chat_id,user_id,warned_by,reason,created_at) VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP)',
            [cid_w, uid2, ctx.from.id, 'إنذار يدوي']
          ).catch(() => {});
          const cnt = await dbGet('SELECT COUNT(*) as c FROM group_warns WHERE chat_id=$1 AND user_id=$2', [cid_w, uid2]).then(r=>r?.c||0).catch(()=>0);
          // تحقق إذا وصل 3
          if (parseInt(cnt) >= 3) {
            await ctx.telegram.banChatMember(cid_w, uid2).catch(() => {});
            await dbRun('DELETE FROM group_warns WHERE chat_id=$1 AND user_id=$2', [cid_w, uid2]).catch(() => {});
            return ctx.editMessageText('🚫 *تم الحظر تلقائياً بعد 3 إنذارات!*', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔓 رفع الحظر', callback_data: 'grp_unban_' + uid2 }]] }}).catch(() => {});
          }
          await ctx.editMessageText(
            '❗ *إنذارات العضو: ' + cnt + '/3*\n\n✅ تم إضافة إنذار',
            { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
              { text: '➕ إنذار', callback_data: 'grp_wadd_' + uid2 + '_' + cid_w },
              { text: '➖ حذف إنذار', callback_data: 'grp_wdel_' + uid2 + '_' + cid_w },
            ]]}}
          ).catch(() => {});
          return ctx.answerCbQuery('✅ تم إضافة إنذار — ' + cnt + '/3').catch(() => {});
        }

        if (data.startsWith('grp_wdel_')) {
          const parts_wd = data.replace('grp_wdel_', '').split('_');
          const uid2 = parseInt(parts_wd[0]);
          const cid_w = parseInt(parts_wd[1]);
          const { run: dbRun, get: dbGet, all: dbAll2 } = require('../database/db');
          // نحذف آخر إنذار
          const last = await dbAll2('SELECT id FROM group_warns WHERE chat_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 1', [cid_w, uid2]).then(r=>r[0]).catch(()=>null);
          if (last) await dbRun('DELETE FROM group_warns WHERE id=$1', [last.id]).catch(() => {});
          const cnt = await dbGet('SELECT COUNT(*) as c FROM group_warns WHERE chat_id=$1 AND user_id=$2', [cid_w, uid2]).then(r=>r?.c||0).catch(()=>0);
          await ctx.editMessageText(
            '❗ *إنذارات العضو: ' + cnt + '/3*\n\n✅ تم حذف إنذار',
            { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
              { text: '➕ إنذار', callback_data: 'grp_wadd_' + uid2 + '_' + cid_w },
              { text: '➖ حذف إنذار', callback_data: 'grp_wdel_' + uid2 + '_' + cid_w },
            ]]}}
          ).catch(() => {});
          return ctx.answerCbQuery('✅ تم حذف إنذار — ' + cnt + '/3').catch(() => {});
        }
        if (data.startsWith('grp_mute_60_')) {
          const uid2 = parseInt(data.replace('grp_mute_60_', ''));
          const { muteMember } = require('../handlers/group_admin');
          await muteMember(ctx, ctx.chat.id, uid2, 60).catch(() => {});
          await ctx.editMessageReplyMarkup({ inline_keyboard: [[{ text: '🔊 رفع الكتم', callback_data: 'grp_unmute_' + uid2 }]] }).catch(() => {});
          return ctx.answerCbQuery('🔇 تم الكتم ساعة').catch(() => {});
        }
        if (data.startsWith('grp_ban_now_')) {
          const uid2 = parseInt(data.replace('grp_ban_now_', ''));
          await ctx.telegram.banChatMember(ctx.chat.id, uid2).catch(() => {});
          await ctx.editMessageReplyMarkup({ inline_keyboard: [[{ text: '🔓 رفع الحظر', callback_data: 'grp_unban_' + uid2 }]] }).catch(() => {});
          return ctx.answerCbQuery('🚫 تم الحظر').catch(() => {});
        }
        if (data.startsWith('grp_restrict_')) {
          const uid2 = parseInt(data.replace('grp_restrict_', ''));
          await ctx.telegram.restrictChatMember(ctx.chat.id, uid2, {
            permissions: { can_send_messages: false, can_send_media_messages: false, can_send_polls: false }
          }).catch(() => {});
          await ctx.editMessageReplyMarkup({ inline_keyboard: [[{ text: '🔊 إعطاء الكلام', callback_data: 'grp_unrestrict_' + uid2 }]] }).catch(() => {});
          return ctx.answerCbQuery('🔇 تم سحب الكلام').catch(() => {});
        }
        if (data.startsWith('grp_unrestrict_')) {
          const uid2 = parseInt(data.replace('grp_unrestrict_', ''));
          await ctx.telegram.restrictChatMember(ctx.chat.id, uid2, {
            permissions: { can_send_messages: true, can_send_media_messages: true, can_send_polls: true, can_add_web_page_previews: true, can_invite_users: true }
          }).catch(() => {});
          await ctx.editMessageReplyMarkup({ inline_keyboard: [[{ text: '🔇 سحب الكلام', callback_data: 'grp_restrict_' + uid2 }]] }).catch(() => {});
          return ctx.answerCbQuery('🔊 تم إعطاء الكلام').catch(() => {});
        }



      // ── إرسال ملف للقروب من نتائج البحث ──
      if (data.startsWith('gsf-')) {
        const parts  = data.replace('gsf-', '').split('-');
        const fileId = parts[0];
        const reqUid = parseInt(parts[1]);
        if (ctx.from.id !== reqUid) return ctx.answerCbQuery('🚫 هذا البحث مو لك!', { show_alert: true }).catch(() => {});
        const { get: dbGet } = require('../database/db');
        const file = await dbGet('SELECT * FROM files WHERE id=$1 AND is_deleted=0', [fileId]).catch(() => null);
        if (!file) return ctx.answerCbQuery('❌ الملف غير موجود', { show_alert: true }).catch(() => {});
        try {
          const caption = '📁 *' + (file.title || file.name || 'ملف') + '*';
          if (file.file_id) {
            await ctx.telegram.sendDocument(ctx.chat.id, file.file_id, { caption, parse_mode: 'Markdown' });
          } else {
            await ctx.reply(caption + '\n🔗 ' + (file.url || ''), { parse_mode: 'Markdown' });
          }
          await ctx.deleteMessage().catch(() => {});
          return ctx.answerCbQuery('✅ تم إرسال الملف').catch(() => {});
        } catch(e) {
          return ctx.answerCbQuery('❌ ' + e.message, { show_alert: true }).catch(() => {});
        }
      }
        const _grpOk = data.startsWith('grp_') || data.startsWith('del_channel_')
          || data.startsWith('gs_') || data.startsWith('grp_unban_')
          || data.startsWith('grp_unmute_') || data === 'check_subscription'
          || data === 'refresh_channels' || data.startsWith('mute_all_')
          || data.startsWith('unmute_all_') || data.startsWith('tag_all_')
          || data.startsWith('close_list_') || data.startsWith('close_stats_')
          || data.startsWith('grp_stats_') || data === 'rules_ok'
          || data.startsWith('ml_') || data.startsWith('gp_')
          || data.startsWith('grp_register_') || data.startsWith('grp_reg_btn_')
          || data === 'mb_panel' || data.startsWith('gp_million') || data.startsWith('gp_guess')
          || data.startsWith('mlr_') || data.startsWith('mar_')
          || data.startsWith('grp_mute_1h_') || data.startsWith('grp_ban_')
          || data.startsWith('grp_warns_') || data.startsWith('grp_perms_')
          || data.startsWith('grp_restrict_') || data.startsWith('grp_unrestrict_')
          || data.startsWith('games_');
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

      // ── ألعاب القروب ──
      if (data.startsWith('games_')) {
        try { await handleBankGamesCallback(ctx, data); }
        catch(e) { ctx.answerCbQuery('❌ ' + e.message, { show_alert: true }).catch(() => {}); }
        return;
      }

            if (exactR.has(data)) return exactR.get(data)(ctx, data);
      const _h = _getPrefixHandler(data);
      if (_h) return _h(ctx, data);

    } catch(e) { logger.error('[CB]', e.message, { data, uid: ctx.from?.id }); }
  

  // تحقق من الاشتراك
  if (data === 'check_subscription') {
    const uid = ctx.from.id;
    const name = ctx.from.first_name || 'صديقي';
    const guard = require('../utils/channelGuard');
    const bot = global.__bot || { telegram: ctx.telegram };
    const res = await guard.checkAllChannels(bot, uid);
    if (!res.ok) {
      const { text, buttons } = guard.buildSubscribeMessage(res.missing, name);
      await ctx.answerCbQuery('❌ لم تشترك بعد!', { show_alert: true }).catch(()=>{});
      return ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }).catch(() => ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }).catch(()=>{}));
    }
    await ctx.answerCbQuery('✅ تم التحقق!').catch(()=>{});
    await ctx.deleteMessage().catch(()=>{});
    return startHandler(ctx);
  }
  });
};
