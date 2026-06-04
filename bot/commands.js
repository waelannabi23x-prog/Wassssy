'use strict';
const { addChannel, removeChannel, getChannels, notifyUsersNewChannel } = require('../utils/channelGuard');

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

  // ── /channels — لوحة إدارة القنوات التفاعلية ──
  async function showChannelsPanel(ctx, msg) {
    const { cacheClear } = require('../utils/cache');
    cacheClear('required_channels');
    const list = await getChannels().catch(() => []);

    let text = '📢 *قنوات الاشتراك الإجباري*\n';
    text += '━━━━━━━━━━━━━━━\n\n';

    if (!list.length) {
      text += '_لا توجد قنوات مضافة حالياً_\n\n';
      text += '💡 لإضافة قناة أرسل:\n`/addchannel @username اسم_القناة`\n\nمثال:\n`/addchannel @mychannel قناتي`';
    } else {
      list.forEach((ch, i) => {
        text += (i+1) + '. *' + (ch.channel_name||'قناة') + '*\n';
        text += '   🔗 ' + (ch.channel_url||ch.channel_id) + '\n';
        text += '   🆔 `' + ch.channel_id + '`\n\n';
      });
      text += '\n💡 لإضافة قناة جديدة:\n`/addchannel @username اسم_القناة`';
    }

    const rows = list.map(ch => [{
      text: '🗑 حذف: ' + (ch.channel_name||ch.channel_id).substring(0,20),
      callback_data: 'del_channel_' + ch.channel_id
    }]);

    rows.push([{ text: '🔄 تحديث', callback_data: 'refresh_channels' }]);

    const extra = { parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows } };
    if (msg) {
      return ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, text, extra).catch(() =>
        ctx.reply(text, extra).catch(() => {})
      );
    }
    return ctx.reply(text, extra).catch(() => {});
  }

  bot.command('channels', async ctx => {
    if (!ctx.isOwner) return ctx.reply('🚫 للمالك فقط').catch(() => {});
    return showChannelsPanel(ctx, null);
  });

  bot.command('addchannel', async ctx => {
    if (!ctx.isOwner) return ctx.reply('🚫 للمالك فقط').catch(() => {});
    const args = ctx.message.text.split(' ').slice(1);

    if (!args.length) {
      return ctx.reply(
        '📢 *إضافة قناة اشتراك إجباري*\n\n' +
        'الصيغة:\n`/addchannel @username اسم_القناة`\n\n' +
        'أمثلة:\n' +
        '`/addchannel @mychannel قناتي الرئيسية`\n' +
        '`/addchannel -1001234567890 قناتي`',
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }

    // استخرج الـ URL إذا موجود
    const urlArg = args.find(a => a.startsWith('https://t.me/') || a.startsWith('http://t.me/'));
    const otherArgs = args.filter(a => !a.startsWith('https://') && !a.startsWith('http://'));

    const cidRaw = otherArgs[0];
    // الاسم = كل شيء بعد الـ username بدون الرابط
    const nmParts = otherArgs.slice(1).filter(a => !a.startsWith('https://') && !a.startsWith('http://'));
    const nm = nmParts.join(' ') || cidRaw.replace('@','');

    // استخرج channel_id
    let cid;
    if (cidRaw.startsWith('-')) {
      cid = cidRaw;
    } else if (cidRaw.startsWith('@')) {
      cid = cidRaw;
    } else if (cidRaw.startsWith('https://t.me/')) {
      const part = cidRaw.replace('https://t.me/', '').split('/')[0];
      cid = part.startsWith('+') ? cidRaw : '@' + part;
    } else {
      cid = '@' + cidRaw;
    }

    // بناء الرابط — الأولوية للرابط المعطى
    const url = urlArg
      ? urlArg
      : cid.startsWith('@')
        ? 'https://t.me/' + cid.replace('@', '')
        : cid;

    try {
      const _res = await addChannel(cid, nm, url, bot);
      notifyUsersNewChannel(bot, nm).catch(() => {});
      const list = await getChannels().catch(() => []);
      let text = '✅ *تمت الإضافة!*\n\n';
      text += '📢 *' + nm + '*\n';
      text += '🆔 `' + cid + '`\n';
      text += '🔗 ' + url + '\n\n';
      text += '📊 *إجمالي القنوات: ' + list.length + '*';
      if (_res && _res.warning) text += '\n\n' + _res.warning;
      const rows = [[{ text: '📋 عرض كل القنوات', callback_data: 'refresh_channels' }]];
      return ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows } }).catch(() => {});
    } catch(e) {
      return ctx.reply('❌ خطأ: ' + e.message).catch(() => {});
    }
  });

  bot.command('removechannel', async ctx => {
    if (!ctx.isOwner) return ctx.reply('🚫 للمالك فقط').catch(() => {});
    const arg = ctx.message.text.split(' ')[1];
    if (!arg) {
      // عرض قائمة للاختيار
      return showChannelsPanel(ctx, null);
    }
    const { cacheClear } = require('../utils/cache');
    await removeChannel(arg).catch(() => {});
    cacheClear('required_channels');
    return ctx.reply('✅ تم حذف القناة').catch(() => {});
  });

  // ── callback: refresh_channels ──
  bot.action('refresh_channels', async ctx => {
    if (!ctx.isOwner) return ctx.answerCbQuery('🚫').catch(() => {});
    ctx.answerCbQuery('🔄 تحديث...').catch(() => {});
    return showChannelsPanel(ctx, ctx.callbackQuery.message);
  });

  bot.command('checkchannels', async ctx => {
    if (!ctx.isOwner) return ctx.reply('للمالك فقط').catch(()=>{});
    const guard = require('../utils/channelGuard');
    const { cacheClear } = require('../utils/cache');
    cacheClear('required_channels');
    const list = await guard.getChannels().catch(()=>[]);
    if (!list.length) return ctx.reply('لا توجد قنوات').catch(()=>{});
    const lines = await Promise.all(list.map(async (ch) => {
      const v = await guard.validateBotInChannel({telegram:ctx.telegram}, ch.channel_id).catch(()=>({ok:false}));
      const icon = v.ok ? '✅' : '❌';
      const note = v.ok ? 'البوت ادمن' : 'اضف البوت كادمن!';
      return icon + ' ' + (ch.channel_name||ch.channel_id) + ' - ' + note;
    }));
    return ctx.reply('فحص القنوات:' + lines.join(String.fromCharCode(10))).catch(()=>{});
  });

};