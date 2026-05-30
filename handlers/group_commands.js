'use strict';
const {
  showAllMembers, tagAll, muteAll, unmuteAll,
  showGroupStats, showGroupRules, setGroupRules,
  warnMember, showWarns, clearWarns,
  banMember, unbanMember,
  muteMember, unmuteMember,
  setWelcomeMessage, setWelcomeImage, clearWelcome,
} = require('./group_admin');
const million = require('./million_battle');

// ── Helper: التحقق من أن المستخدم مشرف أو أونر ──
async function isAdminOrOwner(ctx, chatId) {
  try {
    const member = await ctx.telegram.getChatMember(chatId, ctx.from.id);
    return ['administrator', 'creator'].includes(member?.status)
      || ctx.isOwner
      || ctx.isAdmin;
  } catch (_) {
    return ctx.isOwner || ctx.isAdmin;
  }
}

// ── Helper: استخراج userId من المنشن أو الرد أو النص ──
async function resolveTarget(ctx) {
  // من الرد على رسالة
  if (ctx.message?.reply_to_message?.from) {
    const u = ctx.message.reply_to_message.from;
    return { userId: u.id, firstName: u.first_name || 'عضو' };
  }

  // من النص بعد الأمر  @username أو id
  const parts = (ctx.message?.text || '').split(/\s+/);
  if (parts[1]) {
    const raw = parts[1].replace('@', '');
    if (/^\d+$/.test(raw)) return { userId: parseInt(raw), firstName: raw };
    try {
      const m = await ctx.telegram.getChatMember(ctx.chat.id, '@' + raw);
      if (m?.user) return { userId: m.user.id, firstName: m.user.first_name || raw };
    } catch (_) {}
  }
  return null;
}

// ── Helper: السبب من النص ──
function getReason(ctx, skip = 2) {

// ══════════════════════════════════════════════════════════
// 🤖 تسجيل جميع أوامر القروب
// ══════════════════════════════════════════════════════════
function setupGroupCommands(bot) {

  // ── فلتر: فقط في السوبرقروب أو القروب ──
  const grpOnly = async (ctx, next) => {
    if (!['supergroup', 'group'].includes(ctx.chat?.type)) return;
    return next();
  };

  // ── فلتر: للمشرفين فقط ──
  const adminOnly = async (ctx, next) => {
    const ok = await isAdminOrOwner(ctx, ctx.chat.id);
    if (!ok) {
      const m = await ctx.reply('🚫 هذا الأمر للمشرفين فقط').catch(() => null);
      if (m) setTimeout(() => ctx.deleteMessage(m.message_id).catch(err => { require('../utils/logger').debug("[silent]", err.message); }), 4000);
      return;
    }
    return next();
  };

  // ════════════════════════════════════
  // 📜 /rules — عرض قواعد القروب
  // ════════════════════════════════════
  bot.command('rules', grpOnly, async ctx => {
    try { await showGroupRules(ctx, ctx.chat.id); }
    catch (e) { ctx.reply('❌ ' + e.message).catch(err => { require('../utils/logger').debug("[silent]", err.message); }); }
  });

  // ════════════════════════════════════
  // 📝 /setrules — تعيين قواعد القروب (مشرف)
  // ════════════════════════════════════
  bot.command('setrules', grpOnly, adminOnly, async ctx => {
    const text = ctx.message.text.replace(/^\/setrules\s*/i, '').trim();
    if (!text) {
      return ctx.reply(
        '📝 *طريقة الاستخدام:*\n`/setrules قواعدك هنا`\n\nأو أرسل الأمر بدون نص لمسح القواعد الحالية.',
        { parse_mode: 'Markdown' }
      ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }
    await setGroupRules(ctx, ctx.chat.id, text);
  });

  // ════════════════════════════════════
  // 👥 /all — عرض الأعضاء (مشرف)
  // ════════════════════════════════════
  bot.command('all', grpOnly, adminOnly, async ctx => {
    try { await showAllMembers(ctx, ctx.chat.id); }
    catch (e) { ctx.reply('❌').catch(err => { require('../utils/logger').debug("[silent]", err.message); }); }
  });

  // ════════════════════════════════════
  // 🏷️ /tag — منشن الكل (مشرف)
  // ════════════════════════════════════
  bot.command('tag', grpOnly, adminOnly, async ctx => {
    const msg = ctx.message.text.replace(/^\/tag\s*/i, '').trim();
    try { await tagAll(ctx, ctx.chat.id, msg || null); }
    catch (e) { ctx.reply('❌').catch(err => { require('../utils/logger').debug("[silent]", err.message); }); }
  });

  // ════════════════════════════════════
  // 📊 /stats — إحصائيات القروب (مشرف)
  // ════════════════════════════════════
  bot.command('stats', grpOnly, adminOnly, async ctx => {
    try { await showGroupStats(ctx, ctx.chat.id); }
    catch (e) { ctx.reply('❌').catch(err => { require('../utils/logger').debug("[silent]", err.message); }); }
  });

  // ════════════════════════════════════
  // 🔇 /mute — إسكات (مشرف)
  // استخدام: /mute @user 30 (دقائق) أو رد على رسالة
  // ════════════════════════════════════
  bot.command('mute', grpOnly, adminOnly, async ctx => {
    const target = await resolveTarget(ctx);
    if (!target) {
      return ctx.reply(
        '📌 *طريقة الاستخدام:*\n`/mute @user 30` — إسكات لمدة 30 دقيقة\nأو رُدَّ على رسالة العضو وأرسل `/mute`',
        { parse_mode: 'Markdown' }
      ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }

    // استخرج المدة (الرقم بعد المستخدم)
    const parts    = ctx.message.text.split(/\s+/);
    const duration = parseInt(parts[2]) || 60; // افتراضي 60 دقيقة

    await muteMember(ctx, ctx.chat.id, target.userId, duration);
    ctx.deleteMessage().catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  });

  // ════════════════════════════════════
  // 🔊 /unmute — تفعيل (مشرف)
  // ════════════════════════════════════
  bot.command('unmute', grpOnly, adminOnly, async ctx => {
    const target = await resolveTarget(ctx);
    if (!target) {
      return ctx.reply(
        '📌 *طريقة الاستخدام:*\n`/unmute @user` أو رُدَّ على رسالة العضو وأرسل `/unmute`',
        { parse_mode: 'Markdown' }
      ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }
    await unmuteMember(ctx, ctx.chat.id, target.userId);
    ctx.deleteMessage().catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  });

  // ════════════════════════════════════
  // 🔇 /muteall — إسكات الكل (مشرف)
  // ════════════════════════════════════
  bot.command('muteall', grpOnly, adminOnly, async ctx => {
    ctx.deleteMessage().catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    try { await muteAll(ctx, ctx.chat.id); }
    catch (e) { ctx.reply('❌').catch(err => { require('../utils/logger').debug("[silent]", err.message); }); }
  });

  // ════════════════════════════════════
  // 🔊 /unmuteall — تفعيل الكل (مشرف)
  // ════════════════════════════════════
  bot.command('unmuteall', grpOnly, adminOnly, async ctx => {
    ctx.deleteMessage().catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    try { await unmuteAll(ctx, ctx.chat.id); }
    catch (e) { ctx.reply('❌').catch(err => { require('../utils/logger').debug("[silent]", err.message); }); }
  });

  // ════════════════════════════════════
  // ⚠️ /warn — تحذير عضو (مشرف)
  // ════════════════════════════════════
  bot.command('warn', grpOnly, adminOnly, async ctx => {
    const target = await resolveTarget(ctx);
    if (!target) {
      return ctx.reply(
        '📌 *طريقة الاستخدام:*\n`/warn @user السبب`\nأو رُدَّ على رسالة العضو وأرسل `/warn السبب`',
        { parse_mode: 'Markdown' }
      ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }

    const reason = getReason(ctx, ctx.message?.reply_to_message ? 1 : 2);
    await warnMember(ctx, ctx.chat.id, target.userId, reason);
    ctx.deleteMessage().catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  });

  // ════════════════════════════════════
  // 📋 /warns — عرض تحذيرات عضو (مشرف)
  // ════════════════════════════════════
  bot.command('warns', grpOnly, adminOnly, async ctx => {
    const target = await resolveTarget(ctx);
    if (!target) {
      return ctx.reply(
        '📌 *طريقة الاستخدام:*\n`/warns @user` أو رُدَّ على رسالة العضو وأرسل `/warns`',
        { parse_mode: 'Markdown' }
      ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }
    await showWarns(ctx, ctx.chat.id, target.userId);
    ctx.deleteMessage().catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  });

  // ════════════════════════════════════
  // 🧹 /clearwarns — مسح تحذيرات (مشرف)
  // ════════════════════════════════════
  bot.command('clearwarns', grpOnly, adminOnly, async ctx => {
    const target = await resolveTarget(ctx);
    if (!target) {
      return ctx.reply(
        '📌 *طريقة الاستخدام:*\n`/clearwarns @user`',
        { parse_mode: 'Markdown' }
      ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }
    await clearWarns(ctx, ctx.chat.id, target.userId);
    ctx.deleteMessage().catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  });

  // ════════════════════════════════════
  // 🚫 /ban — حظر عضو (مشرف)
  // ════════════════════════════════════
  bot.command('ban', grpOnly, adminOnly, async ctx => {
    const target = await resolveTarget(ctx);
    if (!target) {
      return ctx.reply(
        '📌 *طريقة الاستخدام:*\n`/ban @user السبب`\nأو رُدَّ على رسالة العضو وأرسل `/ban السبب`',
        { parse_mode: 'Markdown' }
      ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }
    const reason = getReason(ctx, ctx.message?.reply_to_message ? 1 : 2);
    await banMember(ctx, ctx.chat.id, target.userId, reason, false);
    ctx.deleteMessage().catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  });

  // ════════════════════════════════════
  // ✅ /unban — رفع الحظر (مشرف)
  // ════════════════════════════════════
  bot.command('unban', grpOnly, adminOnly, async ctx => {
    const target = await resolveTarget(ctx);
    if (!target) {
      return ctx.reply(
        '📌 *طريقة الاستخدام:*\n`/unban @user` أو `/unban userId`',
        { parse_mode: 'Markdown' }
      ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }
    await unbanMember(ctx, ctx.chat.id, target.userId);
    ctx.deleteMessage().catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  });

  // ════════════════════════════════════
  // 🗑 /kick — طرد عضو (مشرف)
  // ════════════════════════════════════

  bot.command('bans', grpOnly, adminOnly, async ctx => {
    try {
      const { bans } = require('../database/group_db');
      const list = await bans.list(ctx.chat.id);
      let text = 'Banned list:\n';
      list.forEach((b, i) => {
        const d = new Date(b.created_at).toLocaleDateString('ar-DZ');
        text += (i+1) + '. ID:' + b.user_id + ' - ' + (b.reason||'no reason') + ' - ' + d + '\n';
      });
      ctx.reply(text).catch(() => {});
    } catch(e) { ctx.reply('خطأ: '+e.message).catch(() => {}); }
  });


  bot.command('bans', grpOnly, adminOnly, async ctx => {
    try {
      const { bans } = require('../database/group_db');
      const list = await bans.list(ctx.chat.id);
      if (!list.length) return ctx.reply('✅ لا يوجد محظورون').catch(() => {});
      let text = 'Banned list:\n';
      list.forEach((b, i) => {
        const d = new Date(b.created_at).toLocaleDateString('ar-DZ');
        text += (i+1) + '. ID:' + b.user_id + ' - ' + (b.reason||'no reason') + ' - ' + d + '\n';
      });
      ctx.reply(text, { parse_mode: 'Markdown' }).catch(() => {});
    } catch(e) { ctx.reply('❌ ' + e.message).catch(() => {}); }
  });
  bot.command('kick', grpOnly, adminOnly, async ctx => {
    const target = await resolveTarget(ctx);
    if (!target) {
      return ctx.reply(
        '📌 *طريقة الاستخدام:*\n`/kick @user` أو رُدَّ على رسالة العضو',
        { parse_mode: 'Markdown' }
      ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }
    try {
      await ctx.telegram.banChatMember(ctx.chat.id, target.userId);
      await ctx.telegram.unbanChatMember(ctx.chat.id, target.userId); // طرد بدون حظر دائم
      const msg = await ctx.reply(
        `👢 *تم طرد العضو*\n👤 [${target.firstName}](tg://user?id=${target.userId})`,
        { parse_mode: 'Markdown' }
      ).catch(() => null);
      if (msg) setTimeout(() => ctx.deleteMessage(msg.message_id).catch(err => { require('../utils/logger').debug("[silent]", err.message); }), 8000);
    } catch (e) {
      ctx.reply('❌ فشل الطرد: ' + e.message).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }
    ctx.deleteMessage().catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  });

  // ════════════════════════════════════
  // 📌 /pin — تثبيت رسالة (مشرف)
  // ════════════════════════════════════
  bot.command('pin', grpOnly, adminOnly, async ctx => {
    if (!ctx.message?.reply_to_message) {
      return ctx.reply('📌 رُدَّ على الرسالة التي تريد تثبيتها وأرسل `/pin`', { parse_mode: 'Markdown' }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }
    try {
      await ctx.telegram.pinChatMessage(ctx.chat.id, ctx.message.reply_to_message.message_id, {
        disable_notification: false,
      });
      const msg = await ctx.reply('📌 *تم تثبيت الرسالة*', { parse_mode: 'Markdown' }).catch(() => null);
      if (msg) setTimeout(() => ctx.deleteMessage(msg.message_id).catch(err => { require('../utils/logger').debug("[silent]", err.message); }), 5000);
    } catch (e) {
      ctx.reply('❌ فشل التثبيت: ' + e.message).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }
    ctx.deleteMessage().catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  });

  // ════════════════════════════════════
  // 📌 /unpin — إلغاء تثبيت (مشرف)
  // ════════════════════════════════════
  bot.command('unpin', grpOnly, adminOnly, async ctx => {
    try {
      await ctx.telegram.unpinChatMessage(ctx.chat.id);
      const msg = await ctx.reply('✅ *تم إلغاء التثبيت*', { parse_mode: 'Markdown' }).catch(() => null);
      if (msg) setTimeout(() => ctx.deleteMessage(msg.message_id).catch(err => { require('../utils/logger').debug("[silent]", err.message); }), 5000);
    } catch (e) {
      ctx.reply('❌ ' + e.message).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }
    ctx.deleteMessage().catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  });

  // ════════════════════════════════════
  // 🔔 /setwelcome — تعيين رسالة الترحيب (مشرف)
  // ════════════════════════════════════
  bot.command('setwelcome', grpOnly, adminOnly, async ctx => {
    const text = ctx.message.text.replace(/^\/setwelcome\s*/i, '').trim();
    if (!text) {
      return ctx.reply(
        '📝 *طريقة الاستخدام:*\n`/setwelcome رسالتك هنا`\n\n📌 المتغيرات:\n`{name}` الاسم\n`{spec}` التخصص\n`{id}` المعرّف\n`{date}` التاريخ\n`{time}` الوقت',
        { parse_mode: 'Markdown' }
      ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }
    await setWelcomeMessage(ctx, ctx.chat.id, text);
    ctx.deleteMessage().catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  });

  // ════════════════════════════════════
  // 🖼 /setwelcomeimg — تعيين صورة الترحيب (مشرف)
  // إرسال مع صورة مرفقة
  // ════════════════════════════════════
  bot.command('setwelcomeimg', grpOnly, adminOnly, async ctx => {
    if (!ctx.message?.reply_to_message?.photo) {
      return ctx.reply(
        '🖼 رُدَّ على صورة وأرسل `/setwelcomeimg` لتعيينها صورة ترحيب',
        { parse_mode: 'Markdown' }
      ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }
    const photos = ctx.message.reply_to_message.photo;
    const fileId = photos[photos.length - 1].file_id;
    await setWelcomeImage(ctx, ctx.chat.id, fileId);
    ctx.deleteMessage().catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  });

  // ════════════════════════════════════
  // 🗑 /clearwelcome — مسح إعدادات الترحيب (مشرف)
  // ════════════════════════════════════
  bot.command('clearwelcome', grpOnly, adminOnly, async ctx => {
    await clearWelcome(ctx.chat.id);
    ctx.reply('✅ تم مسح إعدادات الترحيب — سيُستخدم النص الافتراضي').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    ctx.deleteMessage().catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  });

  // ════════════════════════════════════
  // 🎮 /million — لعبة المليونير (مشرف)
  // ════════════════════════════════════
  bot.command('million', grpOnly, adminOnly, async ctx => {
    return million.showQuestionsPanel(ctx);
  });

  // ════════════════════════════════════
  // ⏹ /stopmillion — إيقاف اللعبة (مشرف)
  // ════════════════════════════════════
  bot.command('stopmillion', grpOnly, async ctx => {
    return million.stopGame(ctx);
  });

  // ════════════════════════════════════
  // ❓ /help — مساعدة القروب (للجميع)
  // ════════════════════════════════════
  bot.command('grouphelp', grpOnly, async ctx => {
    const isAdm = await isAdminOrOwner(ctx, ctx.chat.id);
    let text = `🤖 *أوامر القروب*\n━━━━━━━━━━━━━━━━━━\n\n`;
    text += `📜 /rules — قواعد القروب\n`;
    text += `📊 /stats — إحصائيات *(مشرف)*\n`;
    text += `👥 /all — قائمة الأعضاء *(مشرف)*\n`;
    text += `🏷️ /tag [رسالة] — منشن الكل *(مشرف)*\n`;
    text += `🎮 /million — لعبة المليونير *(مشرف)*\n\n`;

    if (isAdm) {
      text += `*🛡 الإشراف:*\n`;
      text += `/warn @user [سبب] — تحذير\n`;
      text += `/warns @user — عرض التحذيرات\n`;
      text += `/clearwarns @user — مسح التحذيرات\n`;
      text += `/ban @user [سبب] — حظر\n`;
      text += `/unban @user — رفع الحظر\n`;
      text += `/kick @user — طرد\n`;
      text += `/mute @user [دقائق] — إسكات\n`;
      text += `/unmute @user — تفعيل\n`;
      text += `/muteall — إسكات الكل\n`;
      text += `/unmuteall — تفعيل الكل\n`;
      text += `/pin — تثبيت رسالة (رُدَّ عليها)\n`;
      text += `/unpin — إلغاء التثبيت\n\n`;
      text += `*⚙️ الإعدادات:*\n`;
      text += `/setwelcome [نص] — رسالة الترحيب\n`;
      text += `/setwelcomeimg — صورة الترحيب (رُدَّ على صورة)\n`;
      text += `/clearwelcome — مسح الترحيب\n`;
      text += `/setrules [نص] — تعيين القواعد\n`;
    }

    const msg = await ctx.reply(text, { parse_mode: 'Markdown' }).catch(() => null);
    if (msg) setTimeout(() => ctx.deleteMessage(msg.message_id).catch(err => { require('../utils/logger').debug("[silent]", err.message); }), 30000);
    ctx.deleteMessage().catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  });
}

module.exports = setupGroupCommands;
