'use strict';
// ══════════════════════════════════════════════════════════════
//  🐺 Loup-Garou — قفل/فتح القروب أثناء الليل والتصويت
// ══════════════════════════════════════════════════════════════

const logger = require('../../utils/logger');

const LOCKED = {
  can_send_messages: false,
  can_send_audios: false,
  can_send_documents: false,
  can_send_photos: false,
  can_send_videos: false,
  can_send_video_notes: false,
  can_send_voice_notes: false,
  can_send_polls: false,
  can_send_other_messages: false,
  can_add_web_page_previews: false,
};

// يتحقق من صلاحيات البوت ويخزّن صلاحيات القروب الأصلية لاستعادتها لاحقاً
async function prepareChat(bot, game) {
  try {
    const chat = await bot.telegram.getChat(game.chatId);
    game.chatPermissions = chat.permissions || {
      can_send_messages: true, can_send_other_messages: true,
      can_add_web_page_previews: true, can_send_polls: true,
    };
  } catch (_) {
    game.chatPermissions = { can_send_messages: true };
  }
  try {
    const me = await bot.telegram.getChatMember(game.chatId, bot.botInfo.id);
    game.canRestrict = me.status === 'creator' ||
      (me.status === 'administrator' && me.can_restrict_members === true);
  } catch (_) {
    game.canRestrict = false;
  }
  return game.canRestrict;
}

async function lockChat(bot, game) {
  if (!game.canRestrict) return false;
  try {
    await bot.telegram.setChatPermissions(game.chatId, LOCKED);
    return true;
  } catch (e) {
    logger.warn('[Werewolf] lockChat: ' + e.message);
    return false;
  }
}

async function unlockChat(bot, game) {
  if (!game.canRestrict) return false;
  try {
    await bot.telegram.setChatPermissions(
      game.chatId,
      game.chatPermissions || { can_send_messages: true, can_send_other_messages: true, can_add_web_page_previews: true }
    );
    return true;
  } catch (e) {
    logger.warn('[Werewolf] unlockChat: ' + e.message);
    return false;
  }
}

module.exports = { prepareChat, lockChat, unlockChat };
