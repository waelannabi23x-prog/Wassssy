'use strict';
const { all, run, get } = require('../database/db');

// ══════════════════════════════════════════════════════════
// 🔧 Helpers
// ══════════════════════════════════════════════════════════
const escMd = t => String(t || '').replace(/[*_`[\]()~>#+=|{}.!\-\\]/g, '\\$&');
const sleep  = ms => new Promise(r => setTimeout(r, ms));

let _botUsername = null;
async function getBotUsername(bot) {
  if (_botUsername) return _botUsername;
  try { _botUsername = (await bot.telegram.getMe()).username; } catch (_) {}
  return _botUsername || '';
}

// ══════════════════════════════════════════════════════════
// 📤 إرسال رسالة لقروب واحد مع Retry (حتى 3 محاولات)
// ══════════════════════════════════════════════════════════
async function sendToGroup(bot, chatId, text, extra, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await bot.telegram.sendMessage(chatId, text, extra);
      return { ok: true };
    } catch (e) {
      const msg = e.message || '';

      // حظر دائم — لا تعيد المحاولة
      if (msg.includes('bot was kicked') || msg.includes('chat not found') || msg.includes('Forbidden')) {
        return { ok: false, fatal: true, reason: msg };
      }

      // Flood Wait — انتظر المدة المطلوبة
      const floodMatch = msg.match(/retry after (\d+)/i);
      if (floodMatch) {
        const wait = (parseInt(floodMatch[1]) + 1) * 1000;
        await sleep(wait);
        continue;
      }

      // خطأ مؤقت — انتظر ثم أعد المحاولة
      if (attempt < retries) await sleep(1000 * attempt);
    }
  }
  return { ok: false, fatal: false, reason: 'max retries' };
}

// ══════════════════════════════════════════════════════════
// 📢 إشعار القروبات بملف جديد
// ══════════════════════════════════════════════════════════
async function notifyGroupsNewFile(bot, fileInfo) {
  if (!bot || !fileInfo) return;

    // استخرج specialty_id من DB إذا ما كان موجود
    if (!fileInfo.specialty_id && fileInfo.category_id) {
      const spec = await get(
        `SELECT y.specialty_id FROM categories c JOIN subjects s ON c.subject_id=s.id JOIN semesters sm ON s.semester_id=sm.id JOIN years y ON sm.year_id=y.id WHERE c.id=$1 LIMIT 1`,
        [fileInfo.category_id]
      ).catch(() => null);
      if (spec?.specialty_id) fileInfo.specialty_id = spec.specialty_id;
    }
    if (!fileInfo.specialty_id) return;

  try {
    const groups = await all(
      'SELECT chat_id FROM group_chats WHERE specialty_id=$1 AND notify_new_files=1',
      [fileInfo.specialty_id]
    );
    if (!groups.length) return;

    const username = await getBotUsername(bot);

    for (const group of groups) {
      try {
        // جلب بعض الأعضاء للمنشن (أول 15)
        const members = await all(
          'SELECT user_id, username, first_name FROM group_members WHERE chat_id=$1 LIMIT 15',
          [group.chat_id]
        );

        const mentions = members
          .map(m =>
            m.username
              ? '@' + m.username
              : `[${escMd(m.first_name || 'عضو').substring(0, 12)}](tg://user?id=${m.user_id})`
          )
          .join(' ');

        // بناء رسالة احترافية
        const typeIcon = { document: '📄', photo: '🖼', video: '🎬', link: '🔗' }[fileInfo.file_type] || '📎';

        const caption =
          `🆕 *ملف جديد أُضيف للمكتبة\\!*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `${typeIcon} *${escMd(fileInfo.title)}*\n` +
          (fileInfo.cat_name ? `📁 *القسم:* ${escMd(fileInfo.cat_name)}\n` : '') +
          (fileInfo.sub_name ? `📖 *المادة:* ${escMd(fileInfo.sub_name)}\n` : '') +
          `\n` +
          (mentions ? `👥 ${mentions}\n\n` : '') +
          `⬇️ *اضغط الزر للتحميل*`;

        const btn = {
          inline_keyboard: [[{
            text: `⬇️ تحميل — ${(fileInfo.title || '').substring(0, 28)}`,
            url:  username ? `https://t.me/${username}?start=file_${fileInfo.id}` : `https://t.me/${username}`,
          }]],
        };

        const extra = { parse_mode: 'MarkdownV2', reply_markup: btn };
        const fid   = fileInfo.file_id;
        const ftype = fileInfo.file_type || 'document';

        if (ftype === 'photo' && fid) {
          await bot.telegram.sendPhoto(group.chat_id, fid, { caption, ...extra }).catch(() => {
            // fallback: نص فقط
            sendToGroup(bot, group.chat_id, caption, extra);
          });
        } else if (ftype === 'video' && fid) {
          await bot.telegram.sendVideo(group.chat_id, fid, { caption, ...extra }).catch(() => {
            sendToGroup(bot, group.chat_id, caption, extra);
          });
        } else if (ftype === 'link') {
          await sendToGroup(bot, group.chat_id, caption + (fid ? `\n\n🔗 ${escMd(fid)}` : ''), extra);
        } else if (fid) {
          await bot.telegram.sendDocument(group.chat_id, fid, { caption, ...extra }).catch(() => {
            sendToGroup(bot, group.chat_id, caption, extra);
          });
        } else {
          await sendToGroup(bot, group.chat_id, caption, extra);
        }

        await sleep(600); // Telegram rate limit بين القروبات
      } catch (e) {
        console.error('[Notify Group]', group.chat_id, e.message);
      }
    }
  } catch (e) {
    console.error('[NotifyGroupsNewFile]', e.message);
  }
}

// ══════════════════════════════════════════════════════════
// 📣 بث مخصص لقروبات محددة من لوحة الإدارة
// مع إحصائيات كاملة + retry
// ══════════════════════════════════════════════════════════
async function notifyGroupsCustom(bot, groups, text, mediaFileId, mediaType, options = {}) {
  const {
    parseMode = 'Markdown',
    buttons   = null,      // [[{ text, url }]]
    batchSize = 5,         // عدد القروبات في كل batch
    batchDelay = 1000,     // ms بين batches
  } = options;

  let sent = 0, fail = 0, fatal = 0;
  const errors = [];

  const extra = {
    parse_mode:   parseMode,
    reply_markup: buttons ? { inline_keyboard: buttons } : undefined,
  };

  // إرسال بـ batches لتفادي Flood
  for (let i = 0; i < groups.length; i += batchSize) {
    const chunk   = groups.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      chunk.map(async g => {
        try {
          if (mediaType === 'photo' && mediaFileId) {
            await bot.telegram.sendPhoto(g.chat_id, mediaFileId, { caption: text, ...extra });
          } else if (mediaType === 'video' && mediaFileId) {
            await bot.telegram.sendVideo(g.chat_id, mediaFileId, { caption: text, ...extra });
          } else if (mediaType === 'document' && mediaFileId) {
            await bot.telegram.sendDocument(g.chat_id, mediaFileId, { caption: text, ...extra });
          } else {
            const result = await sendToGroup(bot, g.chat_id, text, extra);
            if (!result.ok) throw new Error(result.reason);
          }
          return { ok: true };
        } catch (e) {
          return { ok: false, reason: e.message, chatId: g.chat_id };
        }
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.ok) {
        sent++;
      } else {
        fail++;
        const reason = r.value?.reason || r.reason?.message || 'unknown';
        if (reason.includes('kicked') || reason.includes('Forbidden') || reason.includes('not found')) fatal++;
        errors.push({ chatId: r.value?.chatId, reason });
      }
    }

    if (i + batchSize < groups.length) await sleep(batchDelay);
  }

  return { sent, fail, fatal, total: groups.length, errors: errors.slice(0, 10) };
}

// ══════════════════════════════════════════════════════════
// 📡 بث للمشتركين في تخصص معين
// ══════════════════════════════════════════════════════════
async function broadcastToSpecialty(bot, specialtyId, text, mediaFileId, mediaType) {
  try {
    const groups = await all(
      'SELECT chat_id FROM group_chats WHERE specialty_id=$1 AND notify_new_files=1',
      [specialtyId]
    );
    if (!groups.length) return { sent: 0, fail: 0, total: 0 };
    return notifyGroupsCustom(bot, groups, text, mediaFileId, mediaType);
  } catch (e) {
    console.error('[BroadcastSpecialty]', e.message);
    return { sent: 0, fail: 0, total: 0 };
  }
}

// ══════════════════════════════════════════════════════════
// 📢 نشر في القناة الرسمية
// ══════════════════════════════════════════════════════════
async function postToChannel(bot, fileInfo) {
  const channelId = process.env.CHANNEL_ID;
  if (!channelId || !fileInfo) return;

  try {
    const username = await getBotUsername(bot);
    const typeIcon = { document: '📄', photo: '🖼', video: '🎬', link: '🔗' }[fileInfo.file_type] || '📎';

    const title = escMd(fileInfo.title || '');
    const desc  = fileInfo.description ? `\n💬 ${escMd(fileInfo.description)}` : '';
    const cat   = escMd(fileInfo.cat_name || '');
    const sub   = escMd(fileInfo.sub_name || '');

    const caption =
      `${typeIcon} *${title}*${desc}\n\n` +
      (cat || sub ? `📁 ${cat}${cat && sub ? ' · ' : ''}${sub}\n\n` : '') +
      `⬇️ اضغط للتحميل المباشر`;

    const btn = {
      inline_keyboard: [[{
        text: `⬇️ تحميل ${(fileInfo.title || '').substring(0, 25)}`,
        url:  username ? `https://t.me/${username}?start=file_${fileInfo.id}` : '',
      }]],
    };

    const extra = { caption, parse_mode: 'MarkdownV2', reply_markup: btn };
    const ftype = fileInfo.file_type || 'document';
    const fid   = fileInfo.file_id;

    if      (ftype === 'photo' && fid) await bot.telegram.sendPhoto(channelId, fid, extra);
    else if (ftype === 'video' && fid) await bot.telegram.sendVideo(channelId, fid, extra);
    else if (fid)                      await bot.telegram.sendDocument(channelId, fid, extra);
    else                               await bot.telegram.sendMessage(channelId, caption, { parse_mode: 'MarkdownV2', reply_markup: btn });
  } catch (e) {
    console.error('[ChannelPost]', e.message);
  }
}

// ══════════════════════════════════════════════════════════
// 🔔 رسالة إعلانية احترافية — تُستخدم من scheduler أو admin
// ══════════════════════════════════════════════════════════
function buildAnnouncementMessage(title, body, footer) {
  return (
    `📢 *${escMd(title)}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `${escMd(body)}\n\n` +
    (footer ? `─────────────────────\n_${escMd(footer)}_` : '')
  );
}

// ══════════════════════════════════════════════════════════
// Exports
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
// 🔔 إشعار ذكي للمستخدمين عند إضافة ملف في تخصصهم
// ══════════════════════════════════════════════════════════
async function notifyUsersNewFile(bot, fileInfo) {
  if (!bot || !fileInfo?.specialty_id) return;
  try {
    const { all } = require('../database/db');
    const { cacheGet, cacheSet } = require('./cache');

    // جلب المستخدمين المشتركين في هذا التخصص (فقط النشطين آخر 30 يوم)
    const users = await all(
      "SELECT u.id FROM users u JOIN user_specialties us ON u.id=us.user_id WHERE us.specialty_id=$1 AND u.is_banned=0 AND u.last_active > NOW() - INTERVAL '30 days' LIMIT 500",
      [fileInfo.specialty_id]
    ).catch(() => []);

    if (!users.length) return;

    const botUsername = await bot.telegram.getMe().then(m => m.username).catch(() => '');
    const icon = { document: '📄', photo: '🖼', video: '🎬', link: '🔗' }[fileInfo.file_type] || '📎';
    const text =
      '🆕 *ملف جديد في تخصصك!*\n' +
      '━━━━━━━━━━━━━━━━━━\n\n' +
      icon + ' *' + (fileInfo.title || '') + '*\n' +
      (fileInfo.sub_name ? '📖 ' + fileInfo.sub_name + '\n' : '') +
      '\n⬇️ اضغط للتحميل المباشر';

    const btn = botUsername ? [[{ text: '⬇️ تحميل', url: 'https://t.me/' + botUsername + '?start=file_' + fileInfo.id }]] : [];

    let sent = 0;
    const BATCH = 25;
    for (let i = 0; i < users.length; i += BATCH) {
      const chunk = users.slice(i, i + BATCH);
      await Promise.allSettled(chunk.map(u =>
        bot.telegram.sendMessage(u.id, text, {
          parse_mode: 'Markdown',
          reply_markup: btn.length ? { inline_keyboard: btn } : undefined
        }).catch(() => {})
      ));
      sent += chunk.length;
      if (i + BATCH < users.length) await new Promise(r => setTimeout(r, 1000));
    }
    console.log('[SmartNotify] Sent to', sent, 'users for file', fileInfo.id);
  } catch(e) {
    console.error('[SmartNotify]', e.message);
  }
}

module.exports = {
  notifyGroupsNewFile,
  notifyUsersNewFile,
  notifyGroupsCustom,
  broadcastToSpecialty,
  postToChannel,
  buildAnnouncementMessage,
  sendToGroup,
};
