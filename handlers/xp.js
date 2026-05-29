'use strict';
const xpDb = require('../database/xp');
const logger = require('../utils/logger');

/* ─── Level-up message templates ─────────────────────────── */
function levelUpMsg(info) {
  const { old_level, new_level, level_info, xp } = info;
  const msgs = {
    3:  '✨ بدأت تتقدم! استمر في التفاعل.',
    4:  '🔬 وصلت لمستوى المتقدمين! الجهد يُثمر.',
    5:  '⚡ أنت الآن من النشيطين في المنصة!',
    6:  '💎 مستوى المحترفين — قلة وصلوا هنا.',
    7:  '🚀 خبير حقيقي! بروفايلك أصبح يتميز.',
    8:  '🌌 النخبة — أنت من أنشط المستخدمين!',
    9:  '👑 أسطوري! نادر جداً من يصل لهذا المستوى.',
    10: '🏆 الأسطوري XL — القمة المطلقة في المنصة!',
  };
  const extra = msgs[new_level] || '🎉 أحسنت، استمر!';
  return `
🎊 *ترقيت للمستوى ${new_level}!*

${level_info.i} *${level_info.n}*
${extra}

✨ إجمالي XP: \`${xp}\`
  `.trim();
}

/* ─── Core award function ─────────────────────────────────── */
/**
 * Award XP to a user, optionally send level-up message via bot.
 * @param {object} bot - Telegraf bot instance (or null)
 * @param {number} uid - Telegram user ID
 * @param {string} reason - XP reason key from XP_REWARDS
 * @param {number} [amount] - Override amount (optional)
 */
async function award(bot, uid, reason, amount) {
  try {
    const result = await xpDb.addXp(uid, reason, amount);
    if (!result) return null;

    // Send level-up notification
    if (result.leveled_up && bot && uid) {
      const msg = levelUpMsg(result);
      bot.telegram.sendMessage(uid, msg, { parse_mode: 'Markdown' })
        .catch(err => { require('../utils/logger').debug("[silent]", err.message); }); // non-blocking — don't crash if user blocked bot
    }

    return result;
  } catch (e) {
    logger.error('[XP] award error:', e.message);
    return null;
  }
}

/* ─── Convenience wrappers ────────────────────────────────── */

/** Called when user uploads a file */
async function onUpload(bot, uid) {
  return award(bot, uid, 'upload');
}

/** Called when someone downloads a user's file (passive XP) */
async function onFileDownloaded(bot, uploaderUid) {
  if (!uploaderUid || uploaderUid === 0) return;
  return award(bot, uploaderUid, 'download_own');
}

/** Called when user downloads a file */
async function onDownload(bot, uid) {
  return award(bot, uid, 'download');
}

/** Called when user posts a comment */
async function onComment(bot, uid) {
  return award(bot, uid, 'comment');
}

/** Called when user rates a file */
async function onRating(bot, uid) {
  return award(bot, uid, 'rating');
}

/** Called on daily login */
async function onDailyLogin(bot, uid) {
  return award(bot, uid, 'daily_login');
}

/** Called when user completes their profile */
async function onProfileComplete(bot, uid) {
  return award(bot, uid, 'profile_complete');
}

module.exports = {
  award,
  onUpload,
  onFileDownloaded,
  onDownload,
  onComment,
  onRating,
  onDailyLogin,
  onProfileComplete,
};
