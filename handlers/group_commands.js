'use strict';

const { showAllMembers, tagAll, muteAll, unmuteAll,
        warnMember, banMember, unbanMember,
        muteMember, unmuteMember } = require('./group_admin');
const million = require('./million_battle');
const { get, all, run } = require('../database/db');
const { build } = require('../utils/keyboard');

// ── مساعدات ──────────────────────────────────────────────
function isGroup(ctx) {
  return ['supergroup', 'group'].includes(ctx.chat?.type);
}
function isAdmin(ctx) {
  return ctx.isOwner || ctx.isAdmin;
}

async function isTgAdmin(ctx) {
  if (ctx.isOwner || ctx.isAdmin) return true;
  try {
    const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
    return ['administrator', 'creator'].includes(member?.status);
  } catch { return false; }
}
// استخرج المستخدم المستهدف (reply أو mention أو ID)
async function getTarget(ctx) {
  const msg = ctx.message;
  // من الرد
  if (msg.reply_to_message?.from) {
    const u = msg.reply_to_message.from;
    return { id: u.id, name: u.first_name || 'مستخدم' };
  }
  // من النص: /ban @username أو /ban 123456
  const args = msg.text?.split(' ').slice(1) || [];
  if (!args.length) return null;
  const raw = args[0];
  if (/^\d+$/.test(raw)) return { id: parseInt(raw), name: 'ID:' + raw };
  if (raw.startsWith('@')) {
    try {
      const u = await ctx.telegram.getChatMember(ctx.chat.id, raw);
      return { id: u.user?.id, name: u.user?.first_name || raw };
    } catch { return null; }
  }
  return null;
}
// استخرج مدة الإسكات: /mute @user 10m أو 1h أو 1d
function parseDuration(arg) {
  if (!arg) return 10; // 10 دقائق افتراضي
  const m = arg.match(/^(\d+)(m|h|d)?$/i);
  if (!m) return 10;
  const n = parseInt(m[1]);
  const u = (m[2] || 'm').toLowerCase();
  if (u === 'h') return n * 60;
  if (u === 'd') return n * 1440;
  return n;
}
// حذف أمر المشرف بعد ثانية
function delCmd(ctx) {
  setTimeout(() => ctx.deleteMessage().catch(() => {}), 1000);
}

function setupGroupCommands(bot) {

  // ══════════════════════════════════════════
  // 🚫 /ban — حظر عضو
  // ══════════════════════════════════════════
  bot.command('ban', async ctx => {
    if (!isGroup(ctx)) return;
    if (!await isTgAdmin(ctx)) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});
    delCmd(ctx);
    const target = await getTarget(ctx);
    if (!target) return ctx.reply('⚠️ رد على رسالة المستخدم أو اكتب:\n`/ban @username السبب`', { parse_mode: 'Markdown' }).catch(() => {});
    const args = ctx.message.text.split(' ').slice(2);
    const reason = args.join(' ') || 'لم يُذكر سبب';
    try {
      await ctx.telegram.banChatMember(ctx.chat.id, target.id);
      await run(
        `INSERT INTO group_bans(chat_id,user_id,banned_by,reason) VALUES($1,$2,$3,$4)
         ON CONFLICT(chat_id,user_id) DO UPDATE SET reason=$4, banned_by=$3`,
        [ctx.chat.id, target.id, ctx.from.id, reason]
      ).catch(() => {});
      const msg = await ctx.reply(
        `🚫 *تم الحظر*\n👤 ${target.name}\n📝 السبب: ${reason}`,
        { parse_mode: 'Markdown', ...build([[{ text: '🔓 رفع الحظر', callback_data: 'grp_unban_' + target.id }]]) }
      ).catch(() => {});
      if (msg) setTimeout(() => ctx.deleteMessage(msg.message_id).catch(() => {}), 15000);
    } catch(e) {
      ctx.reply('❌ فشل الحظر: ' + e.message).catch(() => {});
    }
  });

  // ══════════════════════════════════════════
  // ✅ /unban — رفع الحظر
  // ══════════════════════════════════════════
  bot.command('unban', async ctx => {
    if (!isGroup(ctx)) return;
    if (!await isTgAdmin(ctx)) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});
    delCmd(ctx);
    const target = await getTarget(ctx);
    if (!target) return ctx.reply('⚠️ `/unban @username`', { parse_mode: 'Markdown' }).catch(() => {});
    try {
      await ctx.telegram.unbanChatMember(ctx.chat.id, target.id);
      await run('DELETE FROM group_bans WHERE chat_id=$1 AND user_id=$2', [ctx.chat.id, target.id]).catch(() => {});
      const msg = await ctx.reply(`✅ *رُفع الحظر عن ${target.name}*`, { parse_mode: 'Markdown' }).catch(() => {});
      if (msg) setTimeout(() => ctx.deleteMessage(msg.message_id).catch(() => {}), 8000);
    } catch(e) {
      ctx.reply('❌ فشل: ' + e.message).catch(() => {});
    }
  });

  // ══════════════════════════════════════════
  // 🦵 /kick — طرد بدون حظر
  // ══════════════════════════════════════════
  bot.command('kick', async ctx => {
    if (!isGroup(ctx)) return;
    if (!await isTgAdmin(ctx)) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});
    delCmd(ctx);
    const target = await getTarget(ctx);
    if (!target) return ctx.reply('⚠️ رد على رسالة المستخدم أو `/kick @username`', { parse_mode: 'Markdown' }).catch(() => {});
    try {
      await ctx.telegram.banChatMember(ctx.chat.id, target.id);
      await ctx.telegram.unbanChatMember(ctx.chat.id, target.id);
      const msg = await ctx.reply(`🦵 *تم طرد ${target.name}*\n_(يمكنه العودة بالرابط)_`, { parse_mode: 'Markdown' }).catch(() => {});
      if (msg) setTimeout(() => ctx.deleteMessage(msg.message_id).catch(() => {}), 8000);
    } catch(e) {
      ctx.reply('❌ فشل: ' + e.message).catch(() => {});
    }
  });

  // ══════════════════════════════════════════
  // 🔇 /mute — إسكات عضو معين أو الكل
  // ══════════════════════════════════════════
  bot.command('mute', async ctx => {
    if (!isGroup(ctx)) return;
    if (!await isTgAdmin(ctx)) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});
    delCmd(ctx);
    const args = ctx.message.text.split(' ').slice(1);

    // إذا ما في args أو مكتوب "all" → إسكات الكل
    if (!args.length || args[0] === 'all') {
      return muteAll(ctx, ctx.chat.id);
    }

    const target = await getTarget(ctx);
    if (!target) return ctx.reply('⚠️ رد على رسالة أو:\n`/mute @user 10m`\nالمدة: m=دقائق h=ساعات d=أيام', { parse_mode: 'Markdown' }).catch(() => {});

    // المدة: آخر argument إذا كان رقم+وحدة
    const lastArg = args[args.length - 1];
    const minutes = parseDuration(/^\d/.test(lastArg) ? lastArg : null);
    const durText = minutes < 60 ? minutes + ' دقيقة'
      : minutes < 1440 ? (minutes/60) + ' ساعة'
      : (minutes/1440) + ' يوم';

    try {
      await muteMember(ctx, ctx.chat.id, target.id, minutes);
      const msg = await ctx.reply(
        `🔇 *تم الإسكات*\n👤 ${target.name}\n⏱ المدة: ${durText}`,
        { parse_mode: 'Markdown', ...build([[{ text: '🔊 رفع الإسكات', callback_data: 'grp_unmute_' + target.id }]]) }
      ).catch(() => {});
      if (msg) setTimeout(() => ctx.deleteMessage(msg.message_id).catch(() => {}), 15000);
    } catch(e) {
      ctx.reply('❌ فشل: ' + e.message).catch(() => {});
    }
  });

  // ══════════════════════════════════════════
  // 🔊 /unmute — رفع الإسكات عن عضو أو الكل
  // ══════════════════════════════════════════
  bot.command('unmute', async ctx => {
    if (!isGroup(ctx)) return;
    if (!await isTgAdmin(ctx)) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});
    delCmd(ctx);
    const args = ctx.message.text.split(' ').slice(1);
    if (!args.length || args[0] === 'all') {
      return unmuteAll(ctx, ctx.chat.id);
    }
    const target = await getTarget(ctx);
    if (!target) return ctx.reply('⚠️ رد على رسالة أو `/unmute @user`', { parse_mode: 'Markdown' }).catch(() => {});
    try {
      await unmuteMember(ctx, ctx.chat.id, target.id);
      const msg = await ctx.reply(`🔊 *رُفع الإسكات عن ${target.name}*`, { parse_mode: 'Markdown' }).catch(() => {});
      if (msg) setTimeout(() => ctx.deleteMessage(msg.message_id).catch(() => {}), 8000);
    } catch(e) {
      ctx.reply('❌ فشل: ' + e.message).catch(() => {});
    }
  });

  // ══════════════════════════════════════════
  // ⚠️ /warn — تحذير عضو
  // ══════════════════════════════════════════

  // ══════════════════════════════════════════
  // 👤 /info — معلومات مستخدم
  // ══════════════════════════════════════════
  bot.command('info', async ctx => {
    if (!isGroup(ctx)) return;
    const target = ctx.message?.reply_to_message?.from || ctx.from;
    const uid = target?.id;
    if (!uid) return;

    const { get: dbG, all: dbA } = require('../database/db');

    const [userRow, warns, bankAcc, xpRow] = await Promise.all([
      dbG('SELECT * FROM users WHERE id=$1', [uid]).catch(()=>null),
      dbA('SELECT id FROM group_warns WHERE chat_id=$1 AND user_id=$2', [ctx.chat.id, uid]).catch(()=>[]),
      dbG('SELECT balance FROM bank_accounts WHERE user_id=$1', [uid]).catch(()=>null),
      dbG('SELECT xp, level FROM user_xp WHERE user_id=$1', [uid]).catch(()=>null),
    ]);

    // تحقق من صلاحيات في القروب
    let chatMember;
    try { chatMember = await ctx.telegram.getChatMember(ctx.chat.id, uid); } catch(_) {}
    const roleMap = {
      creator: '👑 صاحب القروب',
      administrator: '⚡ مشرف',
      member: '👤 عضو',
      restricted: '🔇 مقيد',
      left: '🚶 غادر',
      kicked: '🚫 محظور',
    };
    const role = roleMap[chatMember?.status] || '👤 عضو';

    let text = '👤 *معلومات المستخدم*\n━━━━━━━━━━━━━━━\n\n';
    text += '🆔 ID: `' + uid + '`\n';
    text += '📛 الاسم: [' + (target.first_name||'؟') + '](tg://user?id=' + uid + ')\n';
    if (target.username) text += '🔗 يوزر: @' + target.username + '\n';
    text += '🎭 الدور: ' + role + '\n';
    if (target.is_bot) text += '🤖 بوت\n';
    text += '\n📊 *الإحصائيات:*\n';
    text += '⚠️ التحذيرات: *' + warns.length + '/3*\n';
    if (bankAcc) text += '💰 الرصيد: *' + Number(bankAcc.balance||0).toLocaleString('en') + ' $*\n';
    if (xpRow) text += '✨ XP: *' + (xpRow.xp||0) + '* | المستوى: *' + (xpRow.level||1) + '*\n';
    if (userRow?.joined_at) text += '📅 انضم للبوت: *' + new Date(userRow.joined_at).toLocaleDateString('ar') + '*\n';

    const rows = [];
    if (warns.length && (ctx.isAdmin || ctx.isOwner)) {
      rows.push([{ text: '🗑 مسح التحذيرات', callback_data: 'grp_clearwarn_' + uid }]);
    }
    if (ctx.isAdmin || ctx.isOwner) {
      rows.push([
        { text: '🚫 حظر', callback_data: 'grp_ban_' + uid },
        { text: '🔇 كتم', callback_data: 'grp_mute_1h_' + uid },
      ]);
    }

    return ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.message?.message_id,
      reply_markup: rows.length ? { inline_keyboard: rows } : undefined
    }).catch(()=>{});
  });


    bot.command('warn', async ctx => {
    if (!isGroup(ctx)) return;
    if (!await isTgAdmin(ctx)) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});
    delCmd(ctx);
    const target = await getTarget(ctx);
    if (!target) return ctx.reply('⚠️ رد على رسالة المستخدم أو اكتب /warn @username [سبب]', { reply_to_message_id: ctx.message?.message_id }).catch(() => {});
    const args = ctx.message.text.split(' ').slice(target.fromReply ? 1 : 2);
    const reason = args.join(' ').trim() || 'مخالفة القواعد';

    // إضافة التحذير
    await run(
      'INSERT INTO group_warns(chat_id,user_id,reason,warned_by) VALUES($1,$2,$3,$4)',
      [ctx.chat.id, target.id, reason, ctx.from?.id]
    ).catch(()=>{});

    const warns = await all(
      'SELECT id FROM group_warns WHERE chat_id=$1 AND user_id=$2',
      [ctx.chat.id, target.id]
    ).catch(()=>[]);
    const count = warns.length;
    const MAX = 3;

    const warnText =
      '⚠️ *تحذير!*\n━━━━━━━━━━━━━━━\n\n' +
      '👤 المستخدم: [' + target.name + '](tg://user?id=' + target.id + ')\n' +
      '📝 السبب: ' + reason + '\n' +
      '🔢 التحذيرات: *' + count + '/' + MAX + '*\n\n' +
      (count >= MAX ? '🚫 *تم الحظر تلقائياً بعد ' + MAX + ' تحذيرات!*' : '_تحذير ' + count + ' من ' + MAX + '_');

    const rows = [[
      { text: '🗑 مسح التحذيرات', callback_data: 'grp_clearwarn_' + target.id },
      { text: '🚫 حظر', callback_data: 'grp_ban_' + target.id },
    ]];

    await ctx.reply(warnText, {
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.message?.reply_to_message?.message_id || ctx.message?.message_id,
      reply_markup: { inline_keyboard: rows }
    }).catch(() => {});

    // حظر تلقائي بعد MAX تحذيرات
    if (count >= MAX) {
      await ctx.telegram.banChatMember(ctx.chat.id, target.id).catch(() => {});
      await run('DELETE FROM group_warns WHERE chat_id=$1 AND user_id=$2', [ctx.chat.id, target.id]).catch(() => {});
    }
  });

  // ══════════════════════════════════════════
  // 🗑 /unwarn — إزالة تحذيرات
  // ══════════════════════════════════════════
  bot.command('unwarn', async ctx => {
    if (!isGroup(ctx)) return;
    if (!await isTgAdmin(ctx)) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});
    delCmd(ctx);
    const target = await getTarget(ctx);
    if (!target) return ctx.reply('⚠️ رد على رسالة المستخدم').catch(() => {});
    await run('DELETE FROM group_warns WHERE chat_id=$1 AND user_id=$2', [ctx.chat.id, target.id]).catch(() => {});
    const msg = await ctx.reply(`✅ *مُسحت تحذيرات ${target.name}*`, { parse_mode: 'Markdown' }).catch(() => {});
    if (msg) setTimeout(() => ctx.deleteMessage(msg.message_id).catch(() => {}), 8000);
  });

  // ══════════════════════════════════════════
  // 📋 /warns — عرض تحذيرات عضو
  // ══════════════════════════════════════════
  bot.command('warns', async ctx => {
    if (!isGroup(ctx)) return;
    if (!await isTgAdmin(ctx)) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});
    delCmd(ctx);
    const target = await getTarget(ctx);
    if (!target) return ctx.reply('⚠️ رد على رسالة المستخدم').catch(() => {});
    const warns = await all(
      'SELECT reason, warned_by, created_at FROM group_warns WHERE chat_id=$1 AND user_id=$2 ORDER BY created_at DESC',
      [ctx.chat.id, target.id]
    ).catch(() => []);
    let text = '📋 *سجل تحذيرات* [' + target.name + '](tg://user?id=' + target.id + ')\n';
    text += '━━━━━━━━━━━━━━━\n\n';
    text += '🔢 المجموع: *' + warns.length + '/3*\n\n';
    if (warns.length) {
      warns.forEach((w, i) => {
        const date = new Date(w.created_at).toLocaleDateString('ar');
        text += (i+1) + '. ' + (w.reason||'مخالفة') + ' — _' + date + '_\n';
      });
    } else {
      text += '✅ _لا توجد تحذيرات_';
    }
    const rows = warns.length ? [[
      { text: '🗑 مسح الكل', callback_data: 'grp_clearwarn_' + target.id },
    ]] : [];
    return ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: rows.length ? { inline_keyboard: rows } : undefined
    }).catch(() => {});
  });

  // ══════════════════════════════════════════
  // 📌 /pin — تثبيت رسالة
  // ══════════════════════════════════════════
  bot.command('pin', async ctx => {
    if (!isGroup(ctx)) return;
    if (!await isTgAdmin(ctx)) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});
    delCmd(ctx);
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg) return ctx.reply('⚠️ رد على الرسالة اللي تبغي تثبتها').catch(() => {});
    try {
      await ctx.telegram.pinChatMessage(ctx.chat.id, replyMsg.message_id, { disable_notification: false });
    } catch(e) { ctx.reply('❌ فشل التثبيت: ' + e.message).catch(() => {}); }
  });

  // ══════════════════════════════════════════
  // 📌 /unpin — إلغاء تثبيت
  // ══════════════════════════════════════════
  bot.command('unpin', async ctx => {
    if (!isGroup(ctx)) return;
    if (!await isTgAdmin(ctx)) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});
    delCmd(ctx);
    try {
      await ctx.telegram.unpinAllChatMessages(ctx.chat.id);
      const msg = await ctx.reply('✅ تم إلغاء تثبيت كل الرسائل').catch(() => {});
      if (msg) setTimeout(() => ctx.deleteMessage(msg.message_id).catch(() => {}), 5000);
    } catch(e) { ctx.reply('❌ ' + e.message).catch(() => {}); }
  });

  // ══════════════════════════════════════════
  // 👥 /all — منشن الكل
  // ══════════════════════════════════════════
  bot.command('all', async ctx => {
    if (!isGroup(ctx)) return;
    if (!await isTgAdmin(ctx)) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});
    const args = ctx.message.text.split(' ').slice(1).join(' ');
    delCmd(ctx);
    try { await tagAll(ctx, ctx.chat.id, args || null); }
    catch(e) { ctx.reply('❌ ' + e.message).catch(() => {}); }
  });

  bot.command('tag', async ctx => {
    if (!isGroup(ctx)) return;
    if (!await isTgAdmin(ctx)) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});
    const args = ctx.message.text.split(' ').slice(1).join(' ');
    delCmd(ctx);
    try { await tagAll(ctx, ctx.chat.id, args || null); }
    catch(e) { ctx.reply('❌ ' + e.message).catch(() => {}); }
  });

  // ══════════════════════════════════════════
  // ⚙️ /settings — لوحة إعدادات القروب
  // ══════════════════════════════════════════

  bot.command('stats', async ctx => {
    if (!isGroup(ctx)) return;
    const { showGroupStats } = require('./group_admin');
    return showGroupStats(ctx, ctx.chat.id);
  });

  // ══════════════════════════════════════════
  // 📜 /rules — قواعد القروب
  // ══════════════════════════════════════════
  bot.command(['rules', 'قواعد'], async ctx => {
    if (!isGroup(ctx)) return;
    // احذف أمر /rules
    ctx.deleteMessage().catch(() => {});
    const { showGroupRules } = require('./group_admin');
    return showGroupRules(ctx, ctx.chat.id);
  });

  // ══════════════════════════════════════════
  // ℹ️ /adminhelp — مساعدة المشرفين
  // ══════════════════════════════════════════
  bot.command('adminhelp', async ctx => {
    if (!isGroup(ctx)) return;
    if (!await isTgAdmin(ctx)) return;
    delCmd(ctx);
    const text =
      '🛡 *أوامر الإدارة*\n' +
      '━━━━━━━━━━━━━━━\n\n' +
      '🚫 *الحظر والطرد:*\n' +
      '`/ban` — حظر عضو (رد أو @user)\n' +
      '`/unban` — رفع الحظر\n' +
      '`/kick` — طرد بدون حظر\n\n' +
      '🔇 *الإسكات:*\n' +
      '`/mute` — إسكات عضو (رد أو @user)\n' +
      '`/mute all` — إسكات الكل\n' +
      '`/unmute` — رفع الإسكات\n' +
      '`/unmute all` — رفع إسكات الكل\n\n' +
      '⚠️ *التحذيرات:*\n' +
      '`/warn` — تحذير (3 تحذيرات = حظر)\n' +
      '`/unwarn` — مسح التحذيرات\n' +
      '`/warns` — عرض التحذيرات\n\n' +
      '📌 *التثبيت:*\n' +
      '`/pin` — تثبيت رسالة (رد)\n' +
      '`/unpin` — إلغاء كل التثبيتات\n\n' +
      '👥 *المنشن:*\n' +
      '`/all [رسالة]` — منشن الكل\n\n' +
      '⚙️ *الإعدادات:*\n' +
      '`/settings` — لوحة الإعدادات\n' +
      '`/stats` — إحصائيات\n' +
      '`/rules` — القواعد';
    const msg = await ctx.reply(text, { parse_mode: 'Markdown' }).catch(() => {});
    if (msg) setTimeout(() => ctx.deleteMessage(msg.message_id).catch(() => {}), 30000);
  });

  // ══════════════════════════════════════════
  // 🎮 كومند الألعاب
  // ══════════════════════════════════════════
  bot.command(["العاب", "games", "العبوا", "الالعاب"], async ctx => {
    if (!isGroup(ctx)) return;
    const { get: dbG } = require('../database/db');
    const qc = await dbG('SELECT COUNT(*) AS c FROM million_questions WHERE is_active=1').catch(() => ({ c: 0 }));
    const qs = qc?.c || 0;
    const text =
      '🎮 *ألعاب القروب*\n━━━━━━━━━━━━━━━━━━━━\n\n' +
      '🏆 *من سيربح المليون* — ' + qs + ' سؤال — اكتب *مليون*\n' +
      '📸 *خمن الصورة* — اكتب *خمن*\n' +
      '🎲 *قلب العملة* — /flip [مبلغ]\n' +
      '🦹 *السرقة* — رد + /rob\n' +
      '🎁 *مكافأة يومية* — /daily\n' +
      '🏅 *المتصدرون* — /leaderboard';
    const rows = [
      [{ text: '🏆 مليون', callback_data: 'games_start_million' }, { text: '📸 خمن', callback_data: 'games_start_guess' }],
      [{ text: '🎲 قلب عملة', callback_data: 'games_start_flip' }, { text: '🏦 حسابي البنكي', callback_data: 'games_bank' }],
      [{ text: '🎁 مكافأة يومية', callback_data: 'games_daily' }, { text: '🏅 متصدرون', callback_data: 'games_leaderboard' }],
    ];
    const msg = await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows } }).catch(() => null);
    if (msg) setTimeout(() => ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {}), 120000);
  });

  // ══════════════════════════════════════════
  // 🎮 Million Battle
  // ══════════════════════════════════════════
  bot.command('million', async ctx => {
    if (!isGroup(ctx)) return;
    if (!await isTgAdmin(ctx)) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});
    return million.showQuestionsPanel(ctx);
  });
  bot.command('stopmillion', async ctx => {
    if (!isGroup(ctx)) return;
    return million.stopGame(ctx);
  });

  // ══════════════════════════════════════════
  // Callbacks من القروب (ban/unban/mute من الأزرار)
  // ══════════════════════════════════════════

  // ══════════════════════════════════════════
  // 💰 أوامر البنك في القروب
  // ══════════════════════════════════════════
  bot.command(['daily','يومي'], async ctx => { if(!isGroup(ctx)) return; const {handleDaily}=require('./bank_games'); return handleDaily(ctx).catch(()=>{}); });
  bot.command(['flip','عملة'], async ctx => { if(!isGroup(ctx)) return; const {handleFlip}=require('./bank_games'); return handleFlip(ctx).catch(()=>{}); });
  bot.command(['rob','سرقة'], async ctx => { if(!isGroup(ctx)) return; const {handleRob}=require('./bank_games'); return handleRob(ctx).catch(()=>{}); });
  bot.command(['leaderboard','متصدرين','lb'], async ctx => { if(!isGroup(ctx)) return; const {handleLeaderboard}=require('./bank_games'); return handleLeaderboard(ctx).catch(()=>{}); });

    bot.action(/^grp_unban_(\d+)$/, async ctx => {
    if (!await isTgAdmin(ctx)) return ctx.answerCbQuery('🚫').catch(() => {});
    const userId = parseInt(ctx.match[1]);
    try {
      await ctx.telegram.unbanChatMember(ctx.chat.id, userId);
      await run('DELETE FROM group_bans WHERE chat_id=$1 AND user_id=$2', [ctx.chat.id, userId]).catch(() => {});
      ctx.answerCbQuery('✅ رُفع الحظر').catch(() => {});
      ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    } catch(e) { ctx.answerCbQuery('❌ ' + e.message, { show_alert: true }).catch(() => {}); }
  });

  bot.action(/^grp_unmute_(\d+)$/, async ctx => {
    if (!await isTgAdmin(ctx)) return ctx.answerCbQuery('🚫').catch(() => {});
    const userId = parseInt(ctx.match[1]);
    try {
      await unmuteMember(ctx, ctx.chat.id, userId);
      ctx.answerCbQuery('✅ رُفع الإسكات').catch(() => {});
      ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    } catch(e) { ctx.answerCbQuery('❌ ' + e.message, { show_alert: true }).catch(() => {}); }
  });

  // ══ /promote ══
  bot.command("promote", async ctx => {
    if (!isGroup(ctx)) return;
    if (!await isTgAdmin(ctx)) return ctx.reply("🚫 للمشرفين فقط").catch(() => {});
    delCmd(ctx);
    const target = await getTarget(ctx);
    if (!target) return ctx.reply("⚠️ رد على رسالة العضو").catch(() => {});
    try {
      await ctx.telegram.promoteChatMember(ctx.chat.id, target.id, {
        can_delete_messages: true, can_restrict_members: true,
        can_pin_messages: true, can_manage_chat: true, can_invite_users: true,
      });
      const m = await ctx.reply("👑 *تم ترقية " + target.name + " لمشرف*", { parse_mode: "Markdown" }).catch(() => null);
      if (m) setTimeout(() => ctx.deleteMessage(m.message_id).catch(() => {}), 8000);
    } catch(e) { ctx.reply("❌ فشل: " + e.message).catch(() => {}); }
  });

  // ══ /demote ══
  bot.command("demote", async ctx => {
    if (!isGroup(ctx)) return;
    if (!await isTgAdmin(ctx)) return ctx.reply("🚫 للمشرفين فقط").catch(() => {});
    delCmd(ctx);
    const target = await getTarget(ctx);
    if (!target) return ctx.reply("⚠️ رد على رسالة المشرف").catch(() => {});
    try {
      await ctx.telegram.promoteChatMember(ctx.chat.id, target.id, {
        can_delete_messages: false, can_restrict_members: false,
        can_pin_messages: false, can_manage_chat: false,
      });
      const m = await ctx.reply("🔽 *تم سحب صلاحيات " + target.name + "*", { parse_mode: "Markdown" }).catch(() => null);
      if (m) setTimeout(() => ctx.deleteMessage(m.message_id).catch(() => {}), 8000);
    } catch(e) { ctx.reply("❌ فشل: " + e.message).catch(() => {}); }
  });

  // ══ /info ══
  bot.command("info", async ctx => {
    if (!isGroup(ctx)) return;
    delCmd(ctx);
    const target = ctx.message.reply_to_message?.from || ctx.from;
    const { get: dbGet } = require("../database/db");
    const member = await ctx.telegram.getChatMember(ctx.chat.id, target.id).catch(() => null);
    const warns  = await dbGet("SELECT COUNT(*) as c FROM group_warns WHERE chat_id=$1 AND user_id=$2", [ctx.chat.id, target.id]).catch(() => ({ c: 0 }));
    const statusMap = { member:"عضو 👤", administrator:"مشرف 🛡️", creator:"مؤسس 👑", restricted:"مقيّد 🔒", left:"غادر 🚪", kicked:"محظور 🚫" };
    const name = [target.first_name, target.last_name].filter(Boolean).join(" ");
    const isAdm = ['administrator','creator'].includes(member?.status);
    // join date من restricted info
    const joinDate = member?.status === 'restricted' ? '' : '';
    let txt = "👤 *معلومات العضو*\n\n";
    txt += "🔴 الاسم: *" + name + "*\n";
    if (target.username) txt += "🔗 يوزر: @" + target.username + "\n";
    txt += "🆔 الرقم التعريفي: " + target.id + "\n";
    if (target.last_name) txt += "👨‍👩 اسم العائلة: " + target.last_name + "\n";
    txt += "👀 الحالة: " + (statusMap[member?.status] || "غير معروف") + "\n";
    txt += "❗ الإنذارات: " + (warns?.c || 0) + "/3\n";
    txt += "⬇️ الانضمام: " + (member?.status === 'left' ? 'غير متاح' : 'متاح') + "\n";
    const kb = [];
    if (!isAdm) {
      kb.push([{ text: '❗ الإنذارات', callback_data: 'grp_warns_' + target.id }]);
      kb.push([
        { text: '🔇 كتم 🪃',   callback_data: 'grp_mute_1h_' + target.id },
        { text: '🚫 حظر 🏹',   callback_data: 'grp_ban_' + target.id },
      ]);
      kb.push([{ text: '🎛 أذونات 📡', callback_data: 'grp_perms_' + target.id + '_' + ctx.chat.id }]);
    }
    ctx.reply(txt, {
      parse_mode: "Markdown",
      reply_to_message_id: ctx.message?.reply_to_message?.message_id,
      reply_markup: kb.length ? { inline_keyboard: kb } : undefined
    }).catch(() => {});
  });

  // ══ /clean ══
  bot.command("clean", async ctx => {
    if (!isGroup(ctx)) return;
    if (!await isTgAdmin(ctx)) return ctx.reply("🚫 للمشرفين فقط").catch(() => {});
    delCmd(ctx);
    const n = Math.min(parseInt(ctx.message.text.split(" ")[1]) || 10, 50);
    let deleted = 0;
    const startId = ctx.message.message_id;
    for (let i = startId; i > startId - n - 1 && i > 0; i--) {
      try { await ctx.telegram.deleteMessage(ctx.chat.id, i); deleted++; } catch(_) {}
      await new Promise(r => setTimeout(r, 80));
    }
    const m = await ctx.reply("✅ تم حذف " + deleted + " رسالة").catch(() => null);
    if (m) setTimeout(() => ctx.telegram.deleteMessage(ctx.chat.id, m.message_id).catch(() => {}), 4000);
  });

  // ══ /cmds ══
  bot.command(["cmds", "اوامر"], async ctx => {
    if (!isGroup(ctx)) return;
    delCmd(ctx);
    const isAdm = await isTgAdmin(ctx);
    let txt = "📋 *أوامر البوت*\n\n👥 *للجميع:*\n`/info` معلومات عضو\n`/rules` القواعد\n`مليون` لعبة المليون\n`خمن` لعبة التخمين\n";
    if (isAdm) {
      txt += "\n🛡️ *للمشرفين:*\n`/ban` `/unban` `/kick`\n`/mute 10m` `/unmute`\n`/warn` `/warns` `/unwarn`\n`/pin` `/unpin`\n`/promote` `/demote`\n`/info` `/clean 20`\n`/mstop` `/mstats`\n`/tagall` `/stats`\n";
    }
    const m = await ctx.reply(txt, { parse_mode: "Markdown" }).catch(() => null);
    if (m) setTimeout(() => ctx.telegram.deleteMessage(ctx.chat.id, m.message_id).catch(() => {}), 30000);
  });


  // ══════════════════════════════════════════
  // 🗑 /purge — حذف رسائل بالجملة
  // ══════════════════════════════════════════
  bot.command(["purge", "مسح"], async ctx => {
    if (!isGroup(ctx)) return;
    if (!await isTgAdmin(ctx)) return ctx.reply("🚫 للمشرفين فقط").catch(() => {});
    delCmd(ctx);
    const replyTo = ctx.message.reply_to_message;
    if (!replyTo) return ctx.reply("↩️ رد على أول رسالة تريد حذفها").catch(() => {});
    const fromId  = replyTo.message_id;
    const toId    = ctx.message.message_id - 1;
    if (toId < fromId) return ctx.reply("⚠️ ما في رسائل للحذف").catch(() => {});
    const total = toId - fromId + 1;
    if (total > 100) return ctx.reply("⚠️ الحد الأقصى 100 رسالة").catch(() => {});
    const m = await ctx.reply("🗑 جاري حذف " + total + " رسالة...").catch(() => null);
    let deleted = 0;
    for (let i = fromId; i <= toId; i++) {
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, i);
        deleted++;
      } catch(_) {}
      if (deleted % 10 === 0) await new Promise(r => setTimeout(r, 200));
    }
    if (m) await ctx.telegram.deleteMessage(ctx.chat.id, m.message_id).catch(() => {});
    const done = await ctx.reply("✅ تم حذف " + deleted + " رسالة").catch(() => null);
    if (done) setTimeout(() => ctx.telegram.deleteMessage(ctx.chat.id, done.message_id).catch(() => {}), 4000);
  });

  // ══════════════════════════════════════════
  // 🗑 /del — حذف رسالة واحدة (رد عليها)
  // ══════════════════════════════════════════
  bot.command(["del", "حذف"], async ctx => {
    if (!isGroup(ctx)) return;
    if (!await isTgAdmin(ctx)) return ctx.reply("🚫 للمشرفين فقط").catch(() => {});
    const replyTo = ctx.message.reply_to_message;
    delCmd(ctx);
    if (!replyTo) return;
    ctx.telegram.deleteMessage(ctx.chat.id, replyTo.message_id).catch(() => {});
  });


  // ══════════════════════════════════════════
  // 🎭 /truth و /dare — صح أو جرأة
  // ══════════════════════════════════════════
  const _truths = [
    "ما هو أكبر كذبة قلتها في حياتك؟",
    "من هو الشخص الذي تحبه سراً في هذا القروب؟",
    "ما هو أحرج موقف مررت به؟",
    "ما هو الشيء الذي تخجل من الاعتراف به؟",
    "هل سبق أن تجسست على شخص ما؟",
    "ما هو أغبى شيء فعلته في حياتك؟",
    "من هو الشخص الذي تتمنى لو لم تقابله؟",
    "ما هو سرك الذي لم تخبر به أحداً؟",
    "هل سبق أن كذبت على أحد قريب منك؟ وماذا قلت؟",
    "ما هو الشيء الذي تفعله سراً ولا تريد أحداً أن يعرف؟",
    "من هو أكثر شخص تغار منه؟",
    "ما هو أسوأ قرار اتخذته في حياتك؟",
    "هل سبق أن بكيت بسبب فيلم أو مسلسل؟ أي واحد؟",
    "ما هو الشيء الذي تتمنى تغييره في نفسك؟",
    "من هو الشخص الذي تعتذر منه لو قدرت؟",
  ];

  const _dares = [
    "أرسل آخر صورة في هاتفك! 📸",
    "اكتب رسالة محرجة لآخر شخص تحدثت معه!",
    "غير اسمك في القروب لشيء مضحك لمدة ساعة!",
    "أرسل صوت تقلد فيه شخصاً مشهوراً! 🎤",
    "اكتب 10 أشياء تحبها في نفسك!",
    "أرسل أغرب إيموجي تعرفه وفسره!",
    "اكتب قصيدة قصيرة عن شخص في القروب!",
    "قلد أسلوب كتابة شخص في القروب لرسالة كاملة!",
    "اعترف بشيء محرج حدث معك هذا الأسبوع!",
    "أرسل ميم يعبر عن مزاجك الآن!",
    "اكتب رسالة بالكامل بدون حروف العلة!",
    "غني مقطع من أغنية تحبها (نص الكلمات)!",
    "أرسل أول شيء تجده في بحث Google الآن!",
    "اكتب رأيك الحقيقي في آخر شخص تكلم في القروب!",
    "تحدى شخصاً آخر في القروب على شيء!",
  ];

  bot.command(["truth", "صح", "حقيقة"], async ctx => {
    if (!isGroup(ctx)) return;
    const target = ctx.message.reply_to_message?.from || ctx.from;
    const name = target.first_name || "أنت";
    const q = _truths[Math.floor(Math.random() * _truths.length)];
    const kb = [[
      { text: "🎭 جرأة بدل", callback_data: "tnd_dare_" + target.id },
      { text: "🔄 سؤال آخر",  callback_data: "tnd_truth_" + target.id },
    ]];
    ctx.reply(
      "🤔 *سؤال صح لـ " + name + ":*\n\n" + q,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: kb } }
    ).catch(() => {});
  });

  bot.command(["dare", "جرأة"], async ctx => {
    if (!isGroup(ctx)) return;
    const target = ctx.message.reply_to_message?.from || ctx.from;
    const name = target.first_name || "أنت";
    const d = _dares[Math.floor(Math.random() * _dares.length)];
    const kb = [[
      { text: "🤔 صح بدل",   callback_data: "tnd_truth_" + target.id },
      { text: "🔄 تحدي آخر", callback_data: "tnd_dare_"  + target.id },
    ]];
    ctx.reply(
      "😈 *تحدي جرأة لـ " + name + ":*\n\n" + d,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: kb } }
    ).catch(() => {});
  });


  // ══════════════════════════════════════════
  // 🎰 /slot — ماكينة القمار
  // ══════════════════════════════════════════
  bot.command(["slot", "سلوت", "قمار"], async ctx => {
    if (!isGroup(ctx)) return;
    delCmd(ctx);
    const { get: dbGet, run: dbRun } = require("../database/db");
    const uid = ctx.from.id;
    const name = ctx.from.first_name || "لاعب";
    const BET = 50;

    const acc = await dbGet("SELECT balance FROM bank_accounts WHERE user_id=$1", [uid]).catch(() => null);
    if (!acc) return ctx.reply("❌ ليس لديك حساب بنكي! اكتب *انشاء حساب*", { parse_mode: "Markdown" }).catch(() => {});
    if (parseFloat(acc.balance) < BET) return ctx.reply("❌ رصيدك غير كافٍ! تحتاج *" + BET + " دج* للعب.", { parse_mode: "Markdown" }).catch(() => {});

    // خصم الرهان
    await dbRun("UPDATE bank_accounts SET balance=balance-$1 WHERE user_id=$2", [BET, uid]).catch(() => {});

    const symbols = ["🍎", "🍊", "🍋", "🍒", "🍇", "⭐", "💎", "7️⃣"];
    const r1 = symbols[Math.floor(Math.random() * symbols.length)];
    const r2 = symbols[Math.floor(Math.random() * symbols.length)];
    const r3 = symbols[Math.floor(Math.random() * symbols.length)];

    const spinning = await ctx.reply("🎰 *جاري الدوران...*\n\n[ 🔄 | 🔄 | 🔄 ]", { parse_mode: "Markdown" }).catch(() => null);

    let win = 0;
    let resultTxt = "";
    if (r1 === r2 && r2 === r3) {
      if (r1 === "💎") { win = BET * 10; resultTxt = "💎 *جاكبوت!! ×10*"; }
      else if (r1 === "7️⃣") { win = BET * 7; resultTxt = "7️⃣ *سبعة ×7*"; }
      else if (r1 === "⭐") { win = BET * 5; resultTxt = "⭐ *نجوم ×5*"; }
      else { win = BET * 3; resultTxt = "🎉 *ثلاثة متشابهة ×3*"; }
    } else if (r1 === r2 || r2 === r3 || r1 === r3) {
      win = Math.floor(BET * 1.5);
      resultTxt = "✅ *اثنان متشابهان ×1.5*";
    } else {
      resultTxt = "❌ *خسرت!*";
    }

    if (win > 0) {
      await dbRun("UPDATE bank_accounts SET balance=balance+$1 WHERE user_id=$2", [win, uid]).catch(() => {});
    }

    const newBal = await dbGet("SELECT balance FROM bank_accounts WHERE user_id=$1", [uid]).then(r => r?.balance || 0).catch(() => 0);

    setTimeout(async () => {
      if (spinning) {
        await ctx.telegram.editMessageText(ctx.chat.id, spinning.message_id, null,
          "🎰 *ماكينة القمار*\n\n" +
          "[ " + r1 + " | " + r2 + " | " + r3 + " ]\n\n" +
          resultTxt + "\n" +
          (win > 0 ? "💰 ربحت: *" + win + " دج*" : "💸 خسرت: *" + BET + " دج*") + "\n" +
          "👛 رصيدك: *" + parseFloat(newBal).toFixed(0) + " دج*",
          { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[
            { text: "🎰 العب مجدداً", callback_data: "slot_play_" + uid },
            { text: "💰 رصيدي", callback_data: "slot_bal_" + uid },
          ]]}}
        ).catch(() => {});
      }
    }, 2000);
  });

  // ══════════════════════════════════════════
  // 🏪 /market — متجر البوت
  // ══════════════════════════════════════════
  bot.command(["market", "متجر", "shop"], async ctx => {
    if (!isGroup(ctx)) return;
    delCmd(ctx);
    const { get: dbGet } = require("../database/db");
    const uid = ctx.from.id;
    const acc = await dbGet("SELECT balance FROM bank_accounts WHERE user_id=$1", [uid]).catch(() => null);
    const bal = acc ? parseFloat(acc.balance).toFixed(0) : 0;

    const items = [
      { id: 1, name: "🛡️ درع الحماية",    desc: "حمايتك من السبام يوم كامل", price: 500,   emoji: "🛡️" },
      { id: 2, name: "⭐ نجمة VIP",        desc: "لقب VIP في القروب أسبوع",   price: 1000,  emoji: "⭐" },
      { id: 3, name: "🎯 تذكرة مليون",     desc: "دخول مجاني للعبة المليون",  price: 300,   emoji: "🎯" },
      { id: 4, name: "🎰 رمز سلوت ×2",     desc: "ضاعف أرباح السلوت مرة",     price: 200,   emoji: "🎰" },
      { id: 5, name: "📦 صندوق مفاجأة",    desc: "ربح عشوائي 100-2000 دج",   price: 150,   emoji: "📦" },
    ];

    let txt = "🏪 *متجر البوت*\n";
    txt += "━━━━━━━━━━━━━━━━━━\n";
    txt += "👛 رصيدك: *" + bal + " دج*\n\n";
    for (const item of items) {
      txt += item.emoji + " *" + item.name + "* — " + item.price + " دج\n";
      txt += "   _" + item.desc + "_\n\n";
    }

    const kb = items.map(item => [{ text: item.emoji + " " + item.name + " (" + item.price + " دج)", callback_data: "shop_buy_" + item.id + "_" + uid }]);
    kb.push([{ text: "❌ إغلاق", callback_data: "shop_close" }]);

    ctx.reply(txt, { parse_mode: "Markdown", reply_markup: { inline_keyboard: kb } }).catch(() => {});
  });




  // ══════════════════════════════════════════
  // 📋 /setlog — تعيين قناة السجل
  // ══════════════════════════════════════════
  bot.command(["setlog", "سجل"], async ctx => {
    if (!isGroup(ctx)) return;
    if (!await isTgAdmin(ctx)) return ctx.reply("🚫 للمشرفين فقط").catch(() => {});
    delCmd(ctx);
    const args = ctx.message.text.split(" ").slice(1);
    if (!args.length) {
      const { get: dbGet } = require("../database/db");
      const g = await dbGet("SELECT log_channel FROM group_chats WHERE chat_id=$1", [ctx.chat.id]).catch(() => null);
      return ctx.reply(
        "📋 *قناة السجل*\n\n" +
        "الحالية: " + (g?.log_channel ? "*" + g.log_channel + "*" : "_غير محددة_") + "\n\n" +
        "لتعيين قناة:\n`/setlog @username_channel`\n\nلإلغاء:\n`/setlog off`",
        { parse_mode: "Markdown" }
      ).catch(() => {});
    }
    const { run: dbRun } = require("../database/db");
    if (args[0] === "off") {
      await dbRun("UPDATE group_chats SET log_channel=NULL WHERE chat_id=$1", [ctx.chat.id]).catch(() => {});
      return ctx.reply("✅ تم إلغاء قناة السجل").catch(() => {});
    }
    const channel = args[0];
    try {
      await ctx.telegram.sendMessage(channel, "✅ *تم ربط هذه القناة كسجل لـ " + (ctx.chat.title||"القروب") + "*", { parse_mode: "Markdown" });
      await dbRun("UPDATE group_chats SET log_channel=$1 WHERE chat_id=$2", [channel, ctx.chat.id]).catch(() => {});
      ctx.reply("✅ تم تعيين " + channel + " كقناة سجل!", { parse_mode: "Markdown" }).catch(() => {});
    } catch(e) {
      ctx.reply("❌ فشل — تأكد أن البوت ادمين في القناة\n" + e.message).catch(() => {});
    }
  });

  bot.command(['couples', 'زوج', 'زواج'], async ctx => {
    if (!isGroup(ctx)) return;
    delCmd(ctx);
    const { all: dbAll } = require('../database/db');
    const members = await dbAll(
      'SELECT user_id, first_name FROM group_members WHERE chat_id=$1 AND first_name IS NOT NULL AND first_name != \'\'',
      [ctx.chat.id]
    ).catch(() => []);
    if (members.length < 2) return ctx.reply('❌ لا يوجد أعضاء كافيون!').catch(() => {});
    const today = new Date().toISOString().split('T')[0];
    const seed = (String(ctx.chat.id) + today).split('').reduce((a,c) => a + c.charCodeAt(0), 0);
    const idx1 = seed % members.length;
    let idx2 = (seed * 7 + 3) % members.length;
    if (idx2 === idx1) idx2 = (idx2 + 1) % members.length;
    const p1 = members[idx1];
    const p2 = members[idx2];
    const hearts = ['\u{1F495}','\u{1F496}','\u{1F497}','\u{1F49D}','\u{1F493}','\u{1F49E}','\u{1F970}','\u{1F60D}'];
    const heart = hearts[seed % hearts.length];
    const chatTitle = ctx.chat.title || 'القروب';
    const txt = heart + ' *زوج اليوم في ' + chatTitle + '*\n'
      + '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n'
      + '\u{1F46B} [' + p1.first_name + '](tg://user?id=' + p1.user_id + ')\n'
      + heart + ' *\u00D7* ' + heart + '\n'
      + '\u{1F46B} [' + p2.first_name + '](tg://user?id=' + p2.user_id + ')\n\n'
      + '_يتجدد كل يوم_ \u{1F5D3}';
    ctx.reply(txt, { parse_mode: 'Markdown' }).catch(() => {});
  });


  // 💑 Couple of the Day
  bot.command(['couple','زوج'], async ctx => {
    if (!isGroup(ctx)) return;
    const cid = ctx.chat?.id;
    const today = new Date().toISOString().split('T')[0];
    const ck = 'couple_' + cid + '_' + today;
    let saved = require('../utils/cache').cacheGet ? null : null;
    const existing = await require('../database/db').get(
      'SELECT * FROM couple_of_day WHERE chat_id=$1 AND date=$2', [cid, today]
    ).catch(()=>null);
    if (existing) {
      const hearts = ['💕','💖','💗','💝','💓'];
      const h = hearts[Math.floor(Math.random()*hearts.length)];
      return ctx.reply(
        h + ' *زوج اليوم*\n━━━━━━━━━━━━━━━\n\n' +
        '[' + existing.name1 + '](tg://user?id=' + existing.user1_id + ') ' + h + ' [' + existing.name2 + '](tg://user?id=' + existing.user2_id + ')\n\n_يتجدد غداً!_ 🌅',
        { parse_mode:'Markdown', reply_to_message_id: ctx.message?.message_id }
      ).catch(()=>{});
    }
    const members = await require('../database/db').all(
      'SELECT user_id, first_name FROM group_members WHERE chat_id=$1 AND is_bot=0 ORDER BY RANDOM() LIMIT 20', [cid]
    ).catch(()=>[]);
    if (!members || members.length < 2) return ctx.reply('❌ ما في أعضاء كافيين!', { reply_to_message_id: ctx.message?.message_id }).catch(()=>{});
    const u1 = members[0], u2 = members[1];
    await require('../database/db').run(
      'INSERT INTO couple_of_day(chat_id,date,user1_id,user2_id,name1,name2) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',
      [cid, today, u1.user_id, u2.user_id, u1.first_name||'؟', u2.first_name||'؟']
    ).catch(()=>{});
    const hearts = ['💕','💖','💗','💝','💓'];
    const h = hearts[Math.floor(Math.random()*hearts.length)];
    return ctx.reply(
      h + ' *زوج اليوم*\n━━━━━━━━━━━━━━━\n\n' +
      '[' + (u1.first_name||'؟') + '](tg://user?id=' + u1.user_id + ') ' + h + ' [' + (u2.first_name||'؟') + '](tg://user?id=' + u2.user_id + ')\n\n_يتجدد غداً!_ 🌅',
      { parse_mode:'Markdown', reply_to_message_id: ctx.message?.message_id }
    ).catch(()=>{});
  });



  // ══════════════════════════════════════════
  // 🔍 + اسم الملف — بحث سريع في القروب
  // ══════════════════════════════════════════
  bot.hears(/^[+＋]\s*(.+)/, async ctx => {
    if (!isGroup(ctx)) return;
    const query = ctx.match[1]?.trim();
    if (!query || query.length < 2) return;
    const { smartSearch } = require('./group');
    // رسالة loading فورية
    const loadMsg = await ctx.reply('🔍 *جاري البحث...*', { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id }).catch(() => null);
    const results = await smartSearch(query, 8).catch(() => []);
    if (loadMsg) ctx.telegram.deleteMessage(ctx.chat.id, loadMsg.message_id).catch(() => {});
    if (!results.length) {
      const m = await ctx.reply('❌ ما وجدنا نتائج لـ *' + query + '*', { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id }).catch(() => null);
      if (m) setTimeout(() => ctx.telegram.deleteMessage(ctx.chat.id, m.message_id).catch(() => {}), 5000);
      return;
    }
    const kb = results.slice(0, 8).map(f => ([{
      text: (f.title || f.name || 'ملف').substring(0, 40),
      callback_data: 'gsf-' + f.id + '-' + ctx.from.id
    }]));
    kb.push([{ text: '❌ إلغاء', callback_data: 'grp_search_close' }]);
    ctx.reply(
      '🔍 *نتائج البحث عن:* ' + query + '\n' +
      '━━━━━━━━━━━━━━━━━━\n' +
      '📁 وجدنا *' + results.length + '* نتيجة — اضغط لإرسال الملف:',
      {
        parse_mode: 'Markdown',
        reply_to_message_id: ctx.message.message_id,
        reply_markup: { inline_keyboard: kb }
      }
    ).catch(() => {});
  });

}

// ══════════════════════════════════════════
// ⚙️ لوحة إعدادات القروب الشاملة
// ══════════════════════════════════════════
async function showGroupSettings(bot, ctx, chatId) {
  const grp = await get(
    'SELECT welcome_enabled, goodbye_enabled, notify_new_files, anti_spam, anti_link, anti_flood FROM group_chats WHERE chat_id=$1',
    [chatId]
  ).catch(() => null);

  const on  = '✅';
  const off = '❌';
  const g = grp || {};

  const text =
    '⚙️ *إعدادات القروب*\n' +
    '━━━━━━━━━━━━━━━\n\n' +
    '🎉 الترحيب: '        + (g.welcome_enabled  ? on : off) + '\n' +
    '👋 الوداع: '         + (g.goodbye_enabled  ? on : off) + '\n' +
    '🔔 إشعار ملفات: '   + (g.notify_new_files ? on : off) + '\n' +
    '🛡 مكافحة سبام: '   + (g.anti_spam        ? on : off) + '\n' +
    '🔗 حجب الروابط: '   + (g.anti_link        ? on : off) + '\n' +
    '🌊 مكافحة فلود: '   + (g.anti_flood       ? on : off);

  const rows = [
    [{ text: (g.welcome_enabled  ? '🔴 إيقاف الترحيب'       : '🟢 تفعيل الترحيب'),       callback_data: 'gs_toggle_welcome_'    + chatId }],
    [{ text: (g.goodbye_enabled  ? '🔴 إيقاف الوداع'        : '🟢 تفعيل الوداع'),         callback_data: 'gs_toggle_goodbye_'    + chatId }],
    [{ text: (g.notify_new_files ? '🔕 إيقاف إشعار الملفات' : '🔔 تفعيل إشعار الملفات'), callback_data: 'gs_toggle_notify_'     + chatId }],
    [{ text: (g.anti_spam        ? '🔴 إيقاف مكافحة السبام' : '🟢 تفعيل مكافحة السبام'), callback_data: 'gs_toggle_antispam_'   + chatId }],
    [{ text: (g.anti_link        ? '🔴 السماح بالروابط'     : '🔗 حجب الروابط'),          callback_data: 'gs_toggle_antilink_'   + chatId }],
    [{ text: (g.anti_flood       ? '🔴 إيقاف مكافحة الفلود' : '🌊 تفعيل مكافحة الفلود'), callback_data: 'gs_toggle_antiflood_'  + chatId }],
    [{ text: '✏️ تعديل رسالة الترحيب', callback_data: 'gp_setwelcome_' + chatId }],
    [{ text: '📜 تعديل القواعد',        callback_data: 'gs_setrules_'   + chatId }],
  ];

  return ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: rows }
  }).catch(() => {});
}

// ── Callbacks إعدادات القروب ─────────────────────────────
async function handleSettingsCallback(ctx, data) {
  if (!data.startsWith('gs_')) return false;

  const toggleMap = {
    'gs_toggle_welcome_':   'welcome_enabled',
    'gs_toggle_goodbye_':   'goodbye_enabled',
    'gs_toggle_notify_':    'notify_new_files',
    'gs_toggle_antispam_':  'anti_spam',
    'gs_toggle_antilink_':  'anti_link',
    'gs_toggle_antiflood_': 'anti_flood',
  };

  for (const [prefix, col] of Object.entries(toggleMap)) {
    if (data.startsWith(prefix)) {
      const chatId = data.replace(prefix, '');
      const current = await get('SELECT ' + col + ' FROM group_chats WHERE chat_id=$1', [chatId]).catch(() => null);
      const newVal = current?.[col] ? 0 : 1;
      await run('UPDATE group_chats SET ' + col + '=$1 WHERE chat_id=$2', [newVal, chatId]).catch(() => {});
      ctx.answerCbQuery(newVal ? '✅ تم التفعيل' : '❌ تم الإيقاف').catch(() => {});
      return showGroupSettings(bot, ctx, chatId);
    }
  }

  if (data.startsWith('gs_setrules_')) {
    const chatId = data.replace('gs_setrules_', '');
    await require('../utils/stateManager').setState(ctx.from.id, { type: 'grp_set_rules', chatId });
    return ctx.reply('📜 أرسل قواعد القروب:').catch(() => {});
  }

  return false;
}


async function showGamesMenu(ctx) {
  const { get: dbG } = require('../database/db');
  const qc = await dbG('SELECT COUNT(*) AS c FROM million_questions WHERE is_active=1').catch(() => ({ c: 0 }));
  const qs = qc?.c || 0;
  const text =
    '🎮 *ألعاب القروب*\n━━━━━━━━━━━━━━━━━━━━\n\n' +
    '🏆 *من سيربح المليون*\n' +
    '   📊 ' + qs + ' سؤال متاح\n' +
    '   💬 اكتب *مليون* لبدء اللعبة\n\n' +
    '📸 *خمن الصورة*\n' +
    '   💬 اكتب *خمن* لبدء التحدي\n\n' +
    '━━━━━━━━━━━━━━━━━━━━\n' +
    '💰 *أوامر البنك:*\n' +
    '`/flip [مبلغ]` — قلب عملة\n' +
    '`/rob` — سرقة (رد على شخص)\n' +
    '`/daily` — مكافأة يومية\n' +
    '`/leaderboard` — المتصدرون\n' +
    '`انشاء حساب` — فتح حساب\n' +
    '`فلوسي` — عرض رصيدك';
  const rows = [
    [
      { text: '🏆 كيف تلعب المليون؟', callback_data: 'games_how_million' },
    ],
    [
      { text: '📸 كيف تلعب خمن؟', callback_data: 'games_how_guess' },
    ],
  ];
  return ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_to_message_id: ctx.message?.message_id,
    reply_markup: { inline_keyboard: rows }
  }).catch(() => null);
}

module.exports = { setupGroupCommands, showGamesMenu, handleSettingsCallback, showGroupSettings };
