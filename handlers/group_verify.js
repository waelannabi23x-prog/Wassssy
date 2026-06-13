'use strict';
/**
 * ✅ handlers/group_verify.js — نظام التحقق من الأعضاء الجدد
 * ──────────────────────────────────────────────────────────────
 * عند انضمام عضو جديد (إن كان verify_enabled مفعّلاً):
 *   1) تقييد العضو فوراً (لا يستطيع الكتابة).
 *   2) إرسال رسالة بزر "✅ أنا لست بوت — تحقق".
 *   3) عند الضغط: فك التقييد + رسالة الترحيب المعتادة.
 *   4) إن لم يضغط خلال المهلة: طرد تلقائي (Kick) + سجل.
 *
 * هذا يغطي: "اختبار تحقق للأعضاء الجدد" + يدعم "مكافحة الحسابات الوهمية".
 */

const db = require('../database/group_pro_db');
const { build: kbBuild, btn: kbBtn } = require('../utils/keyboard');
const logger = require('../utils/logger');

const RESTRICTED_PERMS = {
  can_send_messages:       false,
  can_send_media_messages: false,
  can_send_polls:          false,
  can_send_other_messages: false,
  can_add_web_page_previews: false,
};

const FULL_PERMS = {
  can_send_messages:         true,
  can_send_media_messages:   true,
  can_send_polls:            true,
  can_add_web_page_previews: true,
  can_send_other_messages:   true,
};

async function getRestorePermissions(telegram, chatId) {
  try {
    const chat = await telegram.getChat(chatId);
    if (chat?.permissions) return chat.permissions;
  } catch (_) {}
  return FULL_PERMS;
}

// ══════════════════════════════════════════════════════════
// 🚪 بدء التحقق عند انضمام عضو جديد
// ══════════════════════════════════════════════════════════
async function startVerification(bot, chatId, user) {
  try {
    const settings = await require('./group_protection').getSettings(chatId);
    const timeout = settings.verify_timeout || 5;
    const name = user.first_name || 'عضو جديد';

    // تقييد العضو فوراً حتى يتحقق
    await bot.telegram.restrictChatMember(chatId, user.id, { permissions: RESTRICTED_PERMS }).catch(() => {});

    const text =
      '👋 أهلاً بك *' + name + '*!\n\n' +
      '🔐 للتأكد أنك لست بوتاً، اضغط الزر أدناه خلال *' + timeout + '* ' + (timeout === 1 ? 'دقيقة' : 'دقائق') + '،\n' +
      'وإلا سيتم *طردك تلقائياً* من القروب.';

    const kb = kbBuild([[kbBtn('✅ أنا لست بوت — تحقق', 'gpx_verify_' + user.id + '_' + chatId)]]);

    const msg = await bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown', ...kb });
    await db.addVerify(chatId, user.id, name, msg.message_id, timeout);
  } catch (e) {
    logger.error('[GroupVerify.start] ' + e.message);
  }
}

// ══════════════════════════════════════════════════════════
// ✅ الضغط على زر التحقق
// ══════════════════════════════════════════════════════════
async function handleVerifyClick(ctx, data) {
  const rest = data.replace('gpx_verify_', '');
  const m = rest.match(/^(\d+)_(-?\d+)$/);
  if (!m) return ctx.answerCbQuery('❌ خطأ في البيانات').catch(() => {});

  const targetUid = parseInt(m[1]);
  const chatId    = parseInt(m[2]);

  if (ctx.from.id !== targetUid) {
    return ctx.answerCbQuery('🚫 هذا التحقق ليس لك!', { show_alert: true }).catch(() => {});
  }

  const rec = await db.getVerify(chatId, targetUid);
  if (!rec || rec.status !== 'pending') {
    return ctx.answerCbQuery('✅ تم التحقق مسبقاً').catch(() => {});
  }

  // فكّ التقييد
  const perms = await getRestorePermissions(ctx.telegram, chatId);
  await ctx.telegram.restrictChatMember(chatId, targetUid, { permissions: perms }).catch(() => {});
  await db.setVerifyStatus(chatId, targetUid, 'verified');

  await ctx.answerCbQuery('✅ تم التحقق بنجاح، أهلاً بك!').catch(() => {});
  await ctx.editMessageText(
    '✅ *تم التحقق بنجاح*\nأهلاً بك [' + (ctx.from.first_name || 'عضو') + '](tg://user?id=' + targetUid + ') 🎉',
    { parse_mode: 'Markdown' }
  ).catch(() => {});

  // رسالة الترحيب المعتادة
  try {
    const { handleNewMember } = require('./group_admin');
    await handleNewMember({ telegram: ctx.telegram }, chatId, targetUid, ctx.from.first_name || 'عضو');
  } catch (_) {}

  require('./group_logs').logAction({ telegram: ctx.telegram }, chatId, 'verify_pass', {
    targetId: targetUid, targetName: ctx.from.first_name || '', details: '✅ نجح التحقق من الهوية',
  }).catch(() => {});
}

// ══════════════════════════════════════════════════════════
// ⏰ فحص دوري للتحققات المنتهية → طرد تلقائي
// ══════════════════════════════════════════════════════════
async function checkExpiredVerifications(bot) {
  const expired = await db.getExpiredVerifications();
  for (const v of expired) {
    try {
      await bot.telegram.banChatMember(v.chat_id, v.user_id).catch(() => {});
      await bot.telegram.unbanChatMember(v.chat_id, v.user_id).catch(() => {});
      if (v.join_msg_id) await bot.telegram.deleteMessage(v.chat_id, v.join_msg_id).catch(() => {});
      await db.setVerifyStatus(v.chat_id, v.user_id, 'expired');

      const m = await bot.telegram.sendMessage(
        v.chat_id,
        '⏰ تم *طرد* ' + (v.first_name || 'عضو') + ' لعدم إكمال التحقق ضمن الوقت المحدد.\n' +
        '_يمكنه الانضمام مجدداً والمحاولة._',
        { parse_mode: 'Markdown' }
      ).catch(() => null);
      if (m) setTimeout(() => bot.telegram.deleteMessage(v.chat_id, m.message_id).catch(() => {}), 8000);

      require('./group_logs').logAction(bot, v.chat_id, 'verify_fail', {
        targetId: v.user_id, targetName: v.first_name || '', details: '⏰ انتهت مهلة التحقق — تم الطرد',
      }).catch(() => {});
    } catch (e) {
      logger.error('[GroupVerify.expire] ' + e.message);
    }
  }
}

function startVerifyWatcher(bot) {
  const timer = setInterval(() => checkExpiredVerifications(bot).catch(() => {}), 30000);
  timer.unref();
  logger.info('✅ [GroupVerify] Watcher started');
}

module.exports = {
  startVerification, handleVerifyClick,
  checkExpiredVerifications, startVerifyWatcher,
};
