'use strict';
const { addChannel, removeChannel, getChannels } = require('../utils/channelGuard');

module.exports = function registerCommands(bot, deps) {
  const {
    startHandler, manage, userH, million, tools,
    browse, contentDb, usersDb, bundlesDb,
    dbAll, cacheClear, logger, OWNER_ID,
    kbBtn, kbBuild, eos, resetChat, millionaire,
    tagAll, muteAll, unmuteAll, showAllMembers,
  } = deps;


  // Ban commands (owner only - private)

  bot.command('top', async ctx => {
    try {
      const list = await dbAll('SELECT u.first_name, u.username, p.total_points, p.downloads_count FROM user_points p JOIN users u ON u.id=p.user_id ORDER BY p.total_points DESC LIMIT 10');
      if (!list.length) return ctx.reply("No data yet").catch(() => {});
      const medals = ['🥇','🥈','🥉'];
      let text = '🏆 Top 10\n━━━━━━━━━━━━━━━━━━\n\n';
      list.forEach((u, i) => {
        const medal = medals[i] || (i+1) + '.';
        const name = (u.first_name || 'user').substring(0, 15);
        text += medal + ' ' + name + ' — ' + (u.total_points||0) + ' pts | ' + (u.downloads_count||0) + ' dl\n';
      });
      ctx.reply(text).catch(() => {});
    } catch(e) { ctx.reply("Error").catch(() => {}); }
  });
  bot.command('ban', async ctx => {
    if (!ctx.isOwner) return;
    if (ctx.chat?.type !== 'private') return;
    const parts = (ctx.message.text || '').split(/\s+/);
    const targetId = parseInt(parts[1]);
    if (!targetId) return ctx.reply('Usage: /ban ID').catch(() => {});
    try {
      await deps.usersDb.ban(targetId);
      deps.cacheClear('ban_' + targetId);
      return ctx.reply('Banned: ' + targetId).catch(() => {});
    } catch(e) { ctx.reply('Error: ' + e.message).catch(() => {}); }
  });

  bot.command('unban', async ctx => {
    if (!ctx.isOwner) return;
    if (ctx.chat?.type !== 'private') return;
    const parts = (ctx.message.text || '').split(/\s+/);
    const targetId = parseInt(parts[1]);
    if (!targetId) return ctx.reply('Usage: /unban ID').catch(() => {});
    try {
      await deps.usersDb.unban(targetId);
      deps.cacheClear('ban_' + targetId);
      return ctx.reply('Unbanned: ' + targetId).catch(() => {});
    } catch(e) { ctx.reply('Error: ' + e.message).catch(() => {}); }
  });

  bot.command('bans', async ctx => {
    if (!ctx.isOwner) return;
    if (ctx.chat?.type !== 'private') return;
    try {
      const list = await deps.dbAll('SELECT id, first_name, username FROM users WHERE is_banned=1 LIMIT 50');
      if (!list.length) return ctx.reply('No banned users').catch(() => {});
      let text = 'Banned: ' + list.length + '\n';
      list.forEach((u, i) => {
        text += (i+1) + '. ' + (u.first_name||'?') + ' ID:' + u.id + '\n';
      });
      ctx.reply(text).catch(() => {});
    } catch(e) { ctx.reply('Error: ' + e.message).catch(() => {}); }
  });


  bot.command('ban', async ctx => {
    if (!ctx.isOwner) return;
    if (ctx.chat?.type !== 'private') return;
    const parts = (ctx.message.text || '').split(/\s+/);
    const targetId = parseInt(parts[1]);
    if (!targetId) return ctx.reply('Usage: /ban ID').catch(() => {});
    try {
      await usersDb.ban(targetId);
      cacheClear('ban_' + targetId);
      return ctx.reply('Banned: ' + targetId).catch(() => {});
    } catch(e) { ctx.reply('Error: ' + e.message).catch(() => {}); }
  });

  bot.command('unban', async ctx => {
    if (!ctx.isOwner) return;
    if (ctx.chat?.type !== 'private') return;
    const parts = (ctx.message.text || '').split(/\s+/);
    const targetId = parseInt(parts[1]);
    if (!targetId) return ctx.reply('Usage: /unban ID').catch(() => {});
    try {
      await usersDb.unban(targetId);
      cacheClear('ban_' + targetId);
      return ctx.reply('Unbanned: ' + targetId).catch(() => {});
    } catch(e) { ctx.reply('Error: ' + e.message).catch(() => {}); }
  });

  bot.command('bans', async ctx => {
    if (!ctx.isOwner) return;
    if (ctx.chat?.type !== 'private') return;
    try {
      const list = await dbAll('SELECT id, first_name, username FROM users WHERE is_banned=1 LIMIT 50');
      if (!list.length) return ctx.reply('No banned users').catch(() => {});
      let text = 'Banned (' + list.length + '):\n';
      list.forEach((u, i) => {
        text += (i+1) + '. ' + (u.first_name||'user') + (u.username?' @'+u.username:'') + ' ID:' + u.id + '\n';
      });
      ctx.reply(text).catch(() => {});
    } catch(e) { ctx.reply('Error: ' + e.message).catch(() => {}); }
  });
  bot.command('start', async ctx => {
    if (startHandler.clearAiMode) await startHandler.clearAiMode(ctx.uid);
    return startHandler(ctx);
  });

  bot.command(['admin', 'owner', 'manage'], ctx => {
    if (!ctx.isAdmin) return ctx.reply('🚫 ليس لديك صلاحية.').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    return manage.mainMenu(ctx);
  });

  bot.command('setsp', async ctx => {
    if (ctx.chat?.type === 'private') return ctx.reply('⚠️ للقروبات فقط.').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    if (!ctx.isOwner && !ctx.isAdmin) return ctx.deleteMessage().catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    ctx.deleteMessage().catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    try {
      const specs = await dbAll('SELECT id,name FROM specialties WHERE is_deleted=0 ORDER BY id');
      if (!specs.length) return ctx.reply('❌ لا تخصصات.').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      return ctx.reply('اختر تخصص القروب:', {
        reply_markup: { inline_keyboard: specs.map(s => [{ text: '🎓 ' + s.name, callback_data: 'grp_sp_' + ctx.chat.id + '_' + s.id }]) }
      }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    } catch(e) { logger.error('[setsp]', e.message); }
  });

  bot.command('search', async ctx => {
    const isGrp = ctx.chat && ctx.chat.type !== 'private';
    const raw   = ctx.message.text.replace('/search', '').replace(/@\w+/g, '').trim();
    if (isGrp) {
      await ctx.deleteMessage().catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      const q = (raw || '').slice(0, 80);
      if (!q || q.length < 2) return;
      const { smartSearch } = require('../handlers/group');
      const res = await smartSearch(q, 5);
      if (!res?.length) return ctx.reply('❌ لا نتائج لـ: ' + q).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      if (!global._cachedBotUsername) {
        try { global._cachedBotUsername = (await bot.telegram.getMe()).username; } catch(err) { require('../utils/logger').debug('[catch]', err.message); }
      }
      const un = global._cachedBotUsername;
      const buttons = res.map(f => ([{
        text: '📥 ' + f.title.substring(0, 38) + (f.sub_name ? '  •  ' + f.sub_name.substring(0, 18) : ''),
        url: 'https://t.me/' + un + '?start=file_' + f.id
      }]));
      return ctx.reply('🔍 *نتائج: "' + q + '"*', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
      }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }
    await require('../utils/stateManager').setState(ctx.uid, { type: 'search', query: raw || '' });
    return ctx.reply('🔍 اكتب كلمة البحث:').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  });

  bot.command('profile', ctx => userH.showProfile(ctx));
  bot.command('stats',   ctx => userH.showStats(ctx));

  bot.command('done', async ctx => {
    const s = require('../utils/stateManager').getState(ctx.uid);
    if (!s) return;
    if (s.type === 'mg_bundle_files') {
      await require('../utils/stateManager').delState(ctx.uid);
      return ctx.reply('✅ تم حفظ الحزمة.').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }
    await require('../utils/stateManager').delState(ctx.uid);
  });

  bot.command('mygroups',  ctx => tools.listGroups(ctx));
  bot.command('leavegroup',ctx => tools.leaveGroup(ctx));

  bot.command('leaveall', async ctx => {
    if (!ctx.isOwner) return;
    try {
      const ch = await dbAll('SELECT chat_id FROM group_chats');
      let l = 0;
      for (const c of ch) { try { await ctx.telegram.leaveChat(c.chat_id); l++; } catch(_){} }
      return ctx.reply('✅ خرجت من ' + l + ' قروب.').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    } catch(e) { logger.error('[leaveall]', e.message); }
  });

  bot.command('dlt', async ctx => {
    if (ctx.chat?.type !== 'private') {
      const s = require('../utils/stateManager').getState(ctx.uid);
      if (s?.type === 'mg_bundle_files') {
        await require('../utils/stateManager').delState(ctx.uid);
        return ctx.reply('❌ تم إلغاء إضافة الملفات.').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      }
    }
    const msgId = ctx.message?.reply_to_message?.message_id;
    if (msgId) return ctx.deleteMessage(msgId).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  });

  bot.command('ai', async ctx => {
    await require('../utils/stateManager').setState(ctx.uid, { type: 'ai_mode' });
    return ctx.reply('🤖 وضع المساعد الذكي مفعل!\n\nاكتب أي سؤال.\n/start للرجوع.').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  });

  bot.command('reset',  ctx => { resetChat(ctx.uid); return ctx.reply('🔄 تم مسح سياق المحادثة.').catch(err => { require('../utils/logger').debug("[silent]", err.message); }); });
  bot.command('promote',ctx => tools.batchPromote(ctx));

  bot.command('cancel', async ctx => {
    if (require('../utils/stateManager').getState(ctx.uid)) {
      await require('../utils/stateManager').delState(ctx.uid);
      return ctx.reply('❌ تم الإلغاء.').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }
  });

  bot.command('million', ctx => million.cmdMillion(ctx));
  bot.command('mtop',    ctx => million.cmdTop(ctx));

  bot.command('users', async ctx => {
    if (!ctx.isOwner && !ctx.isAdmin) return;
    const rows = await dbAll('SELECT COUNT(*) AS c FROM users');
    return ctx.reply('👥 المستخدمون: ' + (rows[0]?.c || 0)).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  });

  bot.command('new', async ctx => {
    if (ctx.chat?.type !== 'private') return ctx.deleteMessage().catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    if (!ctx.isAdmin) return ctx.reply('🚫 ليس لديك صلاحية.').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    return manage.mainMenu(ctx);
  });

  bot.command('top', async ctx => {
    try {
      const rows = await dbAll('SELECT u.first_name, p.total_points FROM user_points p JOIN users u ON u.id=p.user_id ORDER BY p.total_points DESC LIMIT 10');
      if (!rows.length) return ctx.reply('لا توجد نقاط بعد.').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      const txt = rows.map((r, i) => `${i+1}. ${r.first_name} — ${r.total_points} نقطة`).join('\n');
      return ctx.reply('🏆 *المتصدرون:*\n\n' + txt, { parse_mode: 'Markdown' }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    } catch(e) { logger.error('[top]', e.message); }
  });

  // ── Group Admin Commands ──
  bot.command('all', async ctx => {
    if (ctx.chat.type !== 'supergroup' && ctx.chat.type !== 'group') return;
    try { return await showAllMembers(ctx, ctx.chat.id); }
    catch(e) { return ctx.reply('❌ خطأ').catch(err => { require('../utils/logger').debug("[silent]", err.message); }); }
  });

  bot.command('tag', async ctx => {
    if (ctx.chat.type !== 'supergroup' && ctx.chat.type !== 'group') return;
    return tagAll(ctx, ctx.chat.id).catch(() => ctx.reply('❌').catch(err => { require('../utils/logger').debug("[silent]", err.message); }));
  });

  bot.command('mute', async ctx => {
    if (ctx.chat.type !== 'supergroup' && ctx.chat.type !== 'group') return;
    return muteAll(ctx, ctx.chat.id).catch(() => ctx.reply('❌').catch(err => { require('../utils/logger').debug("[silent]", err.message); }));
  });

  bot.command('unmute', async ctx => {
    if (ctx.chat.type !== 'supergroup' && ctx.chat.type !== 'group') return;
    return unmuteAll(ctx, ctx.chat.id).catch(() => ctx.reply('❌').catch(err => { require('../utils/logger').debug("[silent]", err.message); }));
  });

  bot.command('help', ctx => ctx.reply(
    '📚 *أوامر البوت*\n\n/start — الرئيسية\n/search — البحث\n/profile — شخصي\n/stats — إحصائيات\n/cancel — إلغاء\n/ai — مساعد ذكي\n/reset — مسح سياق\n\n👑 *المشرفين:*\n/admin — الإدارة',
    { parse_mode: 'Markdown' }
  ).catch(err => { require('../utils/logger').debug("[silent]", err.message); }));

  bot.command('addchannel', async ctx => {
    if (!ctx.isOwner) return ctx.reply('للمالك فقط').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 2) return ctx.reply('الصيغة: /addchannel الاسم الرابط').catch(() => {});
    const url = args[args.length - 1];
    const nm  = args.slice(0, args.length - 1).join(' ');
    // استخرج channel_id من الرابط أو استخدم الاسم
    let cid = url.replace('https://t.me/', '@');
    if (!cid.startsWith('@') && !cid.startsWith('-')) cid = nm;
    await addChannel(cid, nm, url).catch(e => ctx.reply('خطا: ' + e.message).catch(err => { require('../utils/logger').debug("[silent]", err.message); }));
    return ctx.reply('تمت الاضافة: ' + nm).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  });

  bot.command('removechannel', async ctx => {
    if (!ctx.isOwner) return ctx.reply('للمالك فقط').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    const id = parseInt(ctx.message.text.split(' ')[1]);
    if (!id) return ctx.reply('ارسل رقم القناة').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    await removeChannel(id).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    return ctx.reply('تم الحذف ' + id).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  });


  bot.command('cleanchannels', async ctx => {
    if (!ctx.isOwner) return ctx.reply("للمالك فقط").catch(() => {});
    const { cacheGet, cacheClear } = require('../utils/cache');
    cacheClear('required_channels');
    const list = await getChannels().catch(() => []);
    if (!list.length) return ctx.reply("لا توجد قنوات").catch(() => {});
    const rows = list.map(ch => [{
      text: "🗑 " + (ch.channel_name || ch.channel_id),
      callback_data: "del_channel_" + ch.channel_id
    }]);
    return ctx.reply("اختر القناة للحذف:", {
      reply_markup: { inline_keyboard: rows }
    }).catch(() => {});
  });
  bot.command('channels', async ctx => {
    if (!ctx.isOwner) return ctx.reply('للمالك فقط').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    cacheClear('required_channels');
    const list = await getChannels().catch(() => []);
    if (!list.length) return ctx.reply('لا توجد قنوات').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    const txt = list.map(ch => ch.id + '. ' + ch.channel_name + ' ' + ch.channel_url).join('\n');
    return ctx.reply('القنوات:\n' + txt).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  });

};
