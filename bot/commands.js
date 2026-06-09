'use strict';
const { addChannel, removeChannel, getChannels } = require('../utils/channelGuard');


  // ── AFK ──
  bot.command(['afk','غائب'], handleAfk);

  // ── Notes ──
  bot.command(['note','ملاحظة'], saveNote);
  bot.command(['notes','ملاحظات'], listNotes);
  bot.command(['delnote','حذف_ملاحظة'], delNote);
  bot.hears(/^#(\w+)$/i, async ctx => {
    if (!['group','supergroup'].includes(ctx.chat?.type)) return;
    return getNote(ctx, ctx.match[1]);
  });

  // ── Blacklist ──
  bot.command(['blacklist','قائمة_سوداء'], addBlacklist);
  bot.command(['unblacklist','حذف_محظور'], delBlacklist);
  bot.command(['blacklists','المحظورات'], listBlacklist);

  // ── Locks ──
  bot.command('lock',   ctx => handleLock(ctx, false));
  bot.command('unlock', ctx => handleLock(ctx, true));

  // ── البنك ──
  bot.command(['daily','يومي'],    handleDaily);
  bot.command(['flip','عملة'],     handleFlip);
  bot.command(['rob','سرقة'],      handleRob);
  bot.command(['leaderboard','متصدرين','lb'], handleLeaderboard);
  bot.command(['bank','حسابي','بنكي'], ctx => require('../handlers/bank').showBalance(ctx).catch(()=>{}));

  // ── cleangroups ──
  bot.command('cleangroups', async ctx => {
    if (!ctx.isOwner) return;
    const { all: dbA, run: dbR } = require('../database/db');
    const groups = await dbA('SELECT chat_id, title FROM group_chats WHERE is_active=1').catch(() => []);
    const msg = await ctx.reply('🔍 يفحص ' + groups.length + ' قروب...').catch(() => null);
    let removed = 0;
    for (const g of groups) {
      try { await ctx.telegram.getChat(g.chat_id); }
      catch(e) { await dbR('UPDATE group_chats SET is_active=0 WHERE chat_id=$1',[g.chat_id]).catch(()=>{}); removed++; }
      await new Promise(r => setTimeout(r, 300));
    }
    const txt = '✅ نشط: *'+(groups.length-removed)+'* | 🗑 مُسح: *'+removed+'*';
    if (msg) ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, txt, {parse_mode:'Markdown'}).catch(()=>{});
    else ctx.reply(txt, {parse_mode:'Markdown'}).catch(()=>{});
  });

  // ── adminpanel ──
  bot.command(['adminpanel','لوحة'], async ctx => {
    if (!ctx.isOwner && !ctx.isAdmin) return;
    const rows = [
      [{text:'📁 المحتوى',callback_data:'manage'},{text:'👥 المستخدمون',callback_data:'manage_users_0'}],
      [{text:'🏦 البنك',callback_data:'mg_bank_panel'},{text:'🎮 الألعاب',callback_data:'gp_million_panel'}],
      [{text:'📊 إحصائيات',callback_data:'manage_analytics'},{text:'⚙️ الإعدادات',callback_data:'manage_settings'}],
    ];
    return ctx.reply('🛡️ *لوحة الإدارة*\n━━━━━━━━━━━━━━━',{parse_mode:'Markdown',reply_markup:{inline_keyboard:rows}}).catch(()=>{});
  });

module.exports = function registerCommands(bot, { startHandler, manage, userH, million, tools, browse, bank, contentDb, usersDb, bundlesDb, dbAll, cacheClear, logger, OWNER_ID, kbBtn, kbBuild, eos, resetChat, millionaire, tagAll, muteAll, unmuteAll, showAllMembers }) {

  bot.command('top', async ctx => {
    if (ctx.chat?.type !== 'private') return;
    if (!ctx.isOwner && !ctx.isAdmin) return;
    const top = await dbAll('SELECT first_name, username, xp, level FROM users ORDER BY xp DESC LIMIT 10').catch(() => []);
    let text = '🏆 *المتصدرون*\n━━━━━━━━━━━━━━━\n\n';
    top.forEach((u, i) => { text += (i+1) + '. ' + (u.first_name||'?') + ' — ' + (u.xp||0) + ' XP\n'; });
    return ctx.reply(text, { parse_mode: 'Markdown' }).catch(() => {});
  });

  bot.command('ban', async ctx => {
    if (ctx.chat?.type !== 'private') return;
    if (!ctx.isOwner) return;
    const id = parseInt((ctx.message.text||'').split(' ')[1]);
    if (!id) return ctx.reply('❌ /ban [ID]').catch(() => {});
    await require('../database/db').run('UPDATE users SET is_banned=1 WHERE id=$1', [id]);
    return ctx.reply('✅ تم الحظر: ' + id).catch(() => {});
  });

  bot.command('unban', async ctx => {
    if (ctx.chat?.type !== 'private') return;
    if (!ctx.isOwner) return;
    const id = parseInt((ctx.message.text||'').split(' ')[1]);
    if (!id) return ctx.reply('❌ /unban [ID]').catch(() => {});
    await require('../database/db').run('UPDATE users SET is_banned=0 WHERE id=$1', [id]);
    return ctx.reply('✅ رُفع الحظر: ' + id).catch(() => {});
  });

  bot.command('bans', async ctx => {
    if (ctx.chat?.type !== 'private') return;
    if (!ctx.isOwner && !ctx.isAdmin) return;
    const list = await dbAll('SELECT id, first_name FROM users WHERE is_banned=1 LIMIT 20').catch(() => []);
    let text = '🚫 *المحظورون (' + list.length + ')*\n\n';
    list.forEach(u => { text += '• ' + (u.first_name||'؟') + ' — `' + u.id + '`\n'; });
    return ctx.reply(text||'لا يوجد', { parse_mode: 'Markdown' }).catch(() => {});
  });

  bot.command('start', async ctx => {
    if (['group','supergroup'].includes(ctx.chat?.type)) {
      const un = ctx.botInfo?.username || '';
      return ctx.reply('👋 مرحباً! للوصول للميزات:', {
        reply_markup: { inline_keyboard: [[{ text: '🎓 فتح البوت', url: 'https://t.me/' + un }]] }
      }).catch(() => {});
    }
    return startHandler(ctx);
  });

  bot.command(['admin', 'owner', 'manage'], async ctx => {
    if (ctx.chat?.type !== 'private') return;
    if (!ctx.isOwner && !ctx.isAdmin) return;
    return manage.mainMenu(ctx);
  });

  bot.command('setsp', async ctx => {
    if (ctx.chat?.type !== 'private') return;
    if (!ctx.isOwner && !ctx.isAdmin) return;
    return manage.handleCallback(ctx, 'mg_setsp');
  });

  bot.command('search', async ctx => {
    if (ctx.chat?.type !== 'private') return;
    const q = (ctx.message.text||'').split(' ').slice(1).join(' ').trim();
    if (!q) return ctx.reply('🔍 اكتب كلمة البحث بعد الأمر').catch(() => {});
    return browse.handleSearch(ctx, q);
  });

  bot.command('profile', ctx => userH.showProfile(ctx));
  bot.command('stats',   ctx => userH.showStats(ctx));

  bot.command('done', async ctx => {
    if (ctx.chat?.type !== 'private') return;
    if (!ctx.isOwner && !ctx.isAdmin) return;
    return manage.handleCallback(ctx, 'mg_done');
  });

  bot.command('mygroups', ctx => require('../handlers/group_panel').showMyGroups(ctx));

  bot.command('syncgroups', async ctx => {
    if (!ctx.isOwner) return;
    const { all: dAll } = require('../database/db');
    const groups = await dAll('SELECT chat_id, title FROM group_chats WHERE is_active=1').catch(() => []);
    let ok = 0, fail = 0;
    for (const g of groups) {
      try { await ctx.telegram.getChat(g.chat_id); ok++; }
      catch(e) {
        await require('../database/db').run('UPDATE group_chats SET is_active=0 WHERE chat_id=$1', [g.chat_id]).catch(() => {});
        fail++;
      }
      await new Promise(r => setTimeout(r, 300));
    }
    return ctx.reply('✅ نشط: ' + ok + ' | 🗑 مُسح: ' + fail).catch(() => {});
  });

  bot.command('leavegroup', ctx => tools.leaveGroup(ctx));

  bot.command('leaveall', async ctx => {
    if (!ctx.isOwner) return;
    return tools.leaveAll ? tools.leaveAll(ctx) : ctx.reply('غير متاح').catch(() => {});
  });

  bot.command('dlt', async ctx => {
    if (!ctx.isOwner && !ctx.isAdmin) return;
    const r = ctx.message?.reply_to_message;
    if (r) ctx.telegram.deleteMessage(ctx.chat.id, r.message_id).catch(() => {});
    ctx.deleteMessage().catch(() => {});
  });

  bot.command('ai', async ctx => {
    return ctx.reply('🤖 اكتب رسالتك مباشرة وسيرد عليك الذكاء الاصطناعي.').catch(() => {});
  });

  bot.command('reset', ctx => {
    resetChat(ctx.uid);
    return ctx.reply('🔄 تم مسح سياق المحادثة.').catch(() => {});
  });

  bot.command('promote', ctx => tools.batchPromote(ctx));

  bot.command('cancel', async ctx => {
    const { setState } = require('../utils/stateManager');
    setState(ctx.uid, null);
    return ctx.reply('❌ تم الإلغاء.').catch(() => {});
  });

  bot.command('million', async ctx => {
    if (['group','supergroup'].includes(ctx.chat?.type)) return millionaire.startJoinPhase(ctx).catch(() => {});
    return ctx.reply('🎰 لعبة المليون تعمل في القروبات فقط').catch(() => {});
  });

  bot.command('mstop', async ctx => {
    try { await millionaire.stopGame(ctx); } catch(e) { ctx.reply('❌ ' + e.message).catch(() => {}); }
  });

  bot.command('mstats', ctx => millionaire.showMyStats ? millionaire.showMyStats(ctx) : ctx.reply('📊 قريباً').catch(() => {}));
  bot.command('mtop',   ctx => millionaire.showLeaderboard ? millionaire.showLeaderboard(ctx) : ctx.reply('قريباً').catch(() => {}));

  bot.command('users', async ctx => {
    if (!ctx.isOwner && !ctx.isAdmin) return;
    return manage.handleCallback(ctx, 'manage_users_0');
  });

  bot.command('new', async ctx => {
    if (ctx.chat?.type !== 'private') return;
    return browse.showNew ? browse.showNew(ctx) : ctx.reply('قريباً').catch(() => {});
  });

  bot.command('top', async ctx => {
    if (ctx.chat?.type !== 'private') return;
    return browse.showTop ? browse.showTop(ctx) : ctx.reply('قريباً').catch(() => {});
  });

  bot.command('all', async ctx => {
    if (!['group','supergroup'].includes(ctx.chat?.type)) return;
    if (!ctx.isOwner && !ctx.isAdmin) return;
    const args = ctx.message.text.split(' ').slice(1).join(' ');
    return tagAll(ctx, ctx.chat.id, args||null);
  });

  bot.command('tag', async ctx => {
    if (!['group','supergroup'].includes(ctx.chat?.type)) return;
    if (!ctx.isOwner && !ctx.isAdmin) return;
    const args = ctx.message.text.split(' ').slice(1).join(' ');
    return tagAll(ctx, ctx.chat.id, args||null);
  });

  bot.command('mute', async ctx => {
    if (!['group','supergroup'].includes(ctx.chat?.type)) return;
    return muteAll(ctx, ctx.chat.id);
  });

  bot.command('unmute', async ctx => {
    if (!['group','supergroup'].includes(ctx.chat?.type)) return;
    return unmuteAll(ctx, ctx.chat.id);
  });

  bot.command('channels', async ctx => {
    if (!ctx.isOwner && !ctx.isAdmin) return;
    return manage.handleCallback(ctx, 'mg_channels_menu');
  });

  bot.command('setwelcome', async ctx => {
    if (!ctx.isOwner && !ctx.isAdmin) return;
    const { setState } = require('../utils/stateManager');
    setState(ctx.uid, { type: 'mg_set_start_welcome' });
    return ctx.reply('📝 أرسل نص الترحيب الجديد:\nيمكنك استخدام {name} للاسم').catch(() => {});
  });

  // ── أوامر البنك ──
  bot.command(['daily','يومي'],    ctx => require('../handlers/bank_games').handleDaily(ctx).catch(()=>{}));
  bot.command(['flip','عملة'],     ctx => require('../handlers/bank_games').handleFlip(ctx).catch(()=>{}));
  bot.command(['rob','سرقة'],      ctx => require('../handlers/bank_games').handleRob(ctx).catch(()=>{}));
  bot.command(['leaderboard','متصدرين','lb'], ctx => require('../handlers/bank_games').handleLeaderboard(ctx).catch(()=>{}));
  bot.command(['bank','حسابي','بنكي'], ctx => require('../handlers/bank').showBalance(ctx).catch(()=>{}));

  // ── لوحة الإدارة ──
  bot.command(['adminpanel','لوحة'], async ctx => {
    if (!ctx.isOwner && !ctx.isAdmin) return;
    const rows = [
      [{ text:'📁 المحتوى', callback_data:'manage' }, { text:'👥 المستخدمون', callback_data:'manage_users_0' }],
      [{ text:'🏦 البنك', callback_data:'mg_bank_panel' }, { text:'🎮 الألعاب', callback_data:'gp_million_panel' }],
      [{ text:'📊 إحصائيات', callback_data:'manage_analytics' }, { text:'⚙️ الإعدادات', callback_data:'manage_settings' }],
    ];
    return ctx.reply('🛡️ *لوحة الإدارة*\n━━━━━━━━━━━━━━━', {
      parse_mode:'Markdown', reply_markup:{ inline_keyboard:rows }
    }).catch(() => {});
  });

  // ── cleangroups ──
  bot.command('cleangroups', async ctx => {
    if (!ctx.isOwner) return;
    const { all: dbA, run: dbR } = require('../database/db');
    const groups = await dbA('SELECT chat_id, title FROM group_chats WHERE is_active=1').catch(() => []);
    const msg = await ctx.reply('🔍 يفحص ' + groups.length + ' قروب...').catch(() => null);
    let removed = 0;
    for (const g of groups) {
      try { await ctx.telegram.getChat(g.chat_id); }
      catch(e) { await dbR('UPDATE group_chats SET is_active=0 WHERE chat_id=$1',[g.chat_id]).catch(()=>{}); removed++; }
      await new Promise(r => setTimeout(r, 300));
    }
    const txt = '✅ نشط: *'+(groups.length-removed)+'* | 🗑 مُسح: *'+removed+'*';
    if (msg) ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, txt, {parse_mode:'Markdown'}).catch(()=>{});
    else ctx.reply(txt, {parse_mode:'Markdown'}).catch(()=>{});
  });

};
