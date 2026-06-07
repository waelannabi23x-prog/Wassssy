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
  bot.command('warn', async ctx => {
    if (!isGroup(ctx)) return;
    if (!await isTgAdmin(ctx)) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});
    delCmd(ctx);
    const target = await getTarget(ctx);
    if (!target) return ctx.reply('⚠️ رد على رسالة المستخدم', { parse_mode: 'Markdown' }).catch(() => {});
    const args = ctx.message.text.split(' ').slice(2);
    const reason = args.join(' ') || 'مخالفة القواعد';
    await warnMember(ctx, ctx.chat.id, target.id, reason);
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
      'SELECT reason, created_at FROM group_warns WHERE chat_id=$1 AND user_id=$2 ORDER BY created_at DESC',
      [ctx.chat.id, target.id]
    ).catch(() => []);
    let text = `⚠️ *تحذيرات ${target.name}*: ${warns.length}/3\n\n`;
    warns.forEach((w, i) => { text += `${i+1}. ${w.reason}\n`; });
    if (!warns.length) text += '_لا توجد تحذيرات_';
    const msg = await ctx.reply(text, { parse_mode: 'Markdown' }).catch(() => {});
    if (msg) setTimeout(() => ctx.deleteMessage(msg.message_id).catch(() => {}), 20000);
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
  bot.command('settings', async ctx => {
    if (!isGroup(ctx)) return;
    if (!await isTgAdmin(ctx)) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});
    delCmd(ctx);
    return showGroupSettings(bot, ctx, ctx.chat.id);
  });

  // ══════════════════════════════════════════
  // 📊 /stats — إحصائيات القروب
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

  // ══ /pin ══
  bot.command("pin", async ctx => {
    if (!isGroup(ctx)) return;
    if (!await isTgAdmin(ctx)) return ctx.reply("🚫 للمشرفين فقط").catch(() => {});
    delCmd(ctx);
    const r = ctx.message.reply_to_message;
    if (!r) return ctx.reply("↩️ رد على الرسالة التي تريد تثبيتها").catch(() => {});
    try {
      await ctx.telegram.pinChatMessage(ctx.chat.id, r.message_id);
      const m = await ctx.reply("📌 تم تثبيت الرسالة").catch(() => null);
      if (m) setTimeout(() => ctx.deleteMessage(m.message_id).catch(() => {}), 5000);
    } catch(e) { ctx.reply("❌ فشل: " + e.message).catch(() => {}); }
  });

  // ══ /unpin ══
  bot.command("unpin", async ctx => {
    if (!isGroup(ctx)) return;
    if (!await isTgAdmin(ctx)) return ctx.reply("🚫 للمشرفين فقط").catch(() => {});
    delCmd(ctx);
    try {
      const r = ctx.message.reply_to_message;
      if (r) await ctx.telegram.unpinChatMessage(ctx.chat.id, r.message_id);
      else   await ctx.telegram.unpinAllChatMessages(ctx.chat.id);
      const m = await ctx.reply("✅ تم إلغاء التثبيت").catch(() => null);
      if (m) setTimeout(() => ctx.deleteMessage(m.message_id).catch(() => {}), 5000);
    } catch(e) { ctx.reply("❌ فشل: " + e.message).catch(() => {}); }
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
      kb.push([{ text: '🎛 أذونات 📡', callback_data: 'grp_perms_' + target.id }]);
    }
    ctx.reply(txt, { parse_mode: "Markdown", reply_markup: kb.length ? { inline_keyboard: kb } : undefined }).catch(() => {});
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
      txt += "\n🛡️ *للمشرفين:*\n`/ban` `/unban` `/kick`\n`/mute 10m` `/unmute`\n`/warn` `/warns` `/clearwarns`\n`/pin` `/unpin`\n`/promote` `/demote`\n`/info` `/clean 20`\n`/mstop`\n`/tagall` `/stats`\n";
    }
    const m = await ctx.reply(txt, { parse_mode: "Markdown" }).catch(() => null);
    if (m) setTimeout(() => ctx.telegram.deleteMessage(ctx.chat.id, m.message_id).catch(() => {}), 30000);
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

module.exports = { setupGroupCommands, handleSettingsCallback, showGroupSettings };
