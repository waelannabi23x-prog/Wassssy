'use strict';
/**
 * 📥 handlers/forward_organizer.js
 * أي مستخدم يعمل forward لملف/صورة/فيديو في الخاص
 * يتبعث مباشرة لـ owner مع معلومات المُرسل، بدون أسئلة
 */

const logger = require('../utils/logger');
const OWNER_ID = parseInt(process.env.OWNER_ID || '0');

function isForwarded(msg) {
  return !!(msg.forward_date || msg.forward_from || msg.forward_from_chat || msg.forward_sender_name || msg.forward_origin);
}

function extractFile(msg) {
  if (msg.document) return { type: 'document', file_id: msg.document.file_id, name: msg.document.file_name || 'ملف' };
  if (msg.photo)    return { type: 'photo',    file_id: msg.photo[msg.photo.length - 1].file_id, name: 'صورة' };
  if (msg.video)    return { type: 'video',    file_id: msg.video.file_id, name: msg.video.file_name || 'فيديو' };
  return null;
}

function getForwardSourceName(msg) {
  if (msg.forward_from) {
    return [msg.forward_from.first_name, msg.forward_from.last_name].filter(Boolean).join(' ');
  }
  if (msg.forward_from_chat) return msg.forward_from_chat.title || 'قناة/قروب';
  if (msg.forward_sender_name) return msg.forward_sender_name;
  if (msg.forward_origin) {
    const o = msg.forward_origin;
    if (o.sender_user) return [o.sender_user.first_name, o.sender_user.last_name].filter(Boolean).join(' ');
    if (o.chat) return o.chat.title || 'قناة/قروب';
    if (o.sender_user_name) return o.sender_user_name;
  }
  return 'مصدر مخفي';
}

// ── استقبال ملف/صورة/فيديو forwarded ──
async function handleForward(ctx) {
  if (ctx.chat?.type !== 'private') return false;
  if (!isForwarded(ctx.message)) return false;
  if (!OWNER_ID) return false;

  const file = extractFile(ctx.message);
  if (!file) return false;

  const sender = ctx.from;
  const senderName = [sender.first_name, sender.last_name].filter(Boolean).join(' ') || 'مستخدم';
  const senderTag = sender.username ? '@' + sender.username : ('ID: ' + sender.id);
  const origSource = getForwardSourceName(ctx.message);

  const caption =
    `📥 *ملف مُعاد توجيهه*\n━━━━━━━━━━━━━━━━\n\n` +
    `👤 من: [${senderName}](tg://user?id=${sender.id}) (${senderTag})\n` +
    `📡 المصدر الأصلي: *${origSource}*\n` +
    `📄 النوع: ${file.type === 'document' ? '📄 مستند' : file.type === 'photo' ? '🖼 صورة' : '🎬 فيديو'}` +
    (file.name && file.name !== 'ملف' && file.name !== 'صورة' && file.name !== 'فيديو' ? `\n📎 الاسم: \`${file.name}\`` : '');

  try {
    if      (file.type === 'document') await ctx.telegram.sendDocument(OWNER_ID, file.file_id, { caption, parse_mode: 'Markdown' });
    else if (file.type === 'photo')    await ctx.telegram.sendPhoto(OWNER_ID, file.file_id, { caption, parse_mode: 'Markdown' });
    else if (file.type === 'video')    await ctx.telegram.sendVideo(OWNER_ID, file.file_id, { caption, parse_mode: 'Markdown' });
  } catch (e) {
    logger.error('[ForwardOrganizer]', e.message);
    return false;
  }

  return true;
}

module.exports = { handleForward };
