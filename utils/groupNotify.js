'use strict';
const { all } = require('../database/db');
const escMd = t => (t||'').replace(/[*_`\[\]()~>#+=|{}.!\-]/g,'\\$&');

let _botUsername = null;
async function getBotUsername(bot) {
  if (_botUsername) return _botUsername;
  _botUsername = (await bot.telegram.getMe()).username;
  return _botUsername;
}

async function notifyGroupsNewFile(bot, fileInfo) {
  if (!bot || !fileInfo || !fileInfo.specialty_id) return;
  try {
    const groups = await all(
      'SELECT chat_id FROM group_chats WHERE specialty_id=$1 AND notify_new_files=1',
      [fileInfo.specialty_id]
    );
    if (!groups.length) return;
    const username = await getBotUsername(bot);

    for (const group of groups) {
      try {
        // اجلب أعضاء للمنشن
        const members = await all(
          'SELECT user_id, username, first_name FROM group_members WHERE chat_id=$1 LIMIT 20',
          [group.chat_id]
        );

        const mentions = members.map(m =>
          m.username ? '@' + m.username :
          '[' + escMd(m.first_name||'عضو') + '](tg://user?id=' + m.user_id + ')'
        ).join(' ');

        const caption =
          '🆕 *ملف جديد!*\n\n' +
          '📄 *' + escMd(fileInfo.title) + '*\n' +
          '📁 ' + escMd(fileInfo.cat_name||'') + ' | 📖 ' + escMd(fileInfo.sub_name||'') + '\n\n' +
          (mentions ? mentions + '\n\n' : '') +
          '👆 اضغط للتحميل';

        const btn = { inline_keyboard: [[{
          text: '⬇️ ' + (fileInfo.title||'').substring(0,25),
          url: 'https://t.me/' + username + '?start=file_' + fileInfo.id
        }]]};

        const extra = { parse_mode: 'Markdown', reply_markup: btn };

        // أرسل حسب نوع الملف
        const ftype = fileInfo.file_type || 'document';
        const fid = fileInfo.file_id;

        if (ftype === 'photo' && fid) {
          await bot.telegram.sendPhoto(group.chat_id, fid, { caption, ...extra }).catch(()=>{});
        } else if (ftype === 'video' && fid) {
          await bot.telegram.sendVideo(group.chat_id, fid, { caption, ...extra }).catch(()=>{});
        } else if (ftype === 'link') {
          await bot.telegram.sendMessage(group.chat_id, caption + '\n\n🔗 ' + fid, extra).catch(()=>{});
        } else if (fid) {
          await bot.telegram.sendDocument(group.chat_id, fid, { caption, ...extra }).catch(()=>{});
        } else {
          await bot.telegram.sendMessage(group.chat_id, caption, extra).catch(()=>{});
        }

        await new Promise(r => setTimeout(r, 500));
      } catch(e) { console.error('[Notify]', e.message); }
    }
  } catch(e) { console.error('[NotifyGroups]', e.message); }
}

// إشعار مخصص مع وسائط من لوحة الإدارة
async function notifyGroupsCustom(bot, groups, text, mediaFileId, mediaType) {
  let sent = 0, fail = 0;
  for (const g of groups) {
    try {
      const extra = { parse_mode: 'Markdown' };
      if (mediaType === 'photo' && mediaFileId) {
        await bot.telegram.sendPhoto(g.chat_id, mediaFileId, { caption: text, ...extra });
      } else if (mediaType === 'video' && mediaFileId) {
        await bot.telegram.sendVideo(g.chat_id, mediaFileId, { caption: text, ...extra });
      } else if (mediaType === 'document' && mediaFileId) {
        await bot.telegram.sendDocument(g.chat_id, mediaFileId, { caption: text, ...extra });
      } else {
        await bot.telegram.sendMessage(g.chat_id, text, extra);
      }
      sent++;
    } catch(_) { fail++; }
    await new Promise(r => setTimeout(r, 600));
  }
  return { sent, fail };
}

// ── نشر في القناة الرسمية ──────────────────────
async function postToChannel(bot, fileInfo) {
  const channelId = process.env.CHANNEL_ID;
  if (!channelId || !fileInfo) return;
  try {
    const username = await getBotUsername(bot);
    const title = escMd(fileInfo.title || '');
    const desc = fileInfo.description ? escMd(fileInfo.description) : '';
    const cat = escMd(fileInfo.cat_name || '');
    const sub = escMd(fileInfo.sub_name || '');
    const lines = [];
    lines.push('*' + title + '*');
    if (desc) lines.push(desc);
    lines.push(cat + ' | ' + sub);
    lines.push('');
    lines.push('للتحميل اضغط الزر');
    const caption = lines.join('\n');
    const btn = { inline_keyboard: [[{
      text: 'تحميل ' + (fileInfo.title||'').substring(0,25),
      url: 'https://t.me/' + username + '?start=file_' + fileInfo.id
    }]]};
    const extra = { caption: caption, parse_mode: 'Markdown', reply_markup: btn };
    const ftype = fileInfo.file_type || 'document';
    const fid = fileInfo.file_id;
    if (ftype === 'photo' && fid) {
      await bot.telegram.sendPhoto(channelId, fid, extra);
    } else if (ftype === 'video' && fid) {
      await bot.telegram.sendVideo(channelId, fid, extra);
    } else if (fid) {
      await bot.telegram.sendDocument(channelId, fid, extra);
    } else {
      await bot.telegram.sendMessage(channelId, caption, { parse_mode: 'Markdown', reply_markup: btn });
    }
  } catch(e) { console.error('[Channel Post]', e.message); }
}

module.exports = { notifyGroupsNewFile, notifyGroupsCustom, postToChannel };
