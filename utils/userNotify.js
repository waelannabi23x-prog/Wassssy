'use strict';
const { getUsersBySpecialty } = require('../database/users');
const logger = require('./logger');

async function notifyUsersNewFile(bot, file, specialtyId) {
  if (!bot || !specialtyId) return;
  try {
    const users = await getUsersBySpecialty(specialtyId);
    if (!users.length) return;
    const botInfo = await bot.telegram.getMe().catch(() => null);
    const link = botInfo ? `https://t.me/${botInfo.username}?start=file_${file.id}` : null;
    const text = `📢 *ملف جديد تم رفعه!*\n\n📄 ${file.title}${link ? `\n\n⬇️ [تحميل مباشر](${link})` : ''}`;
    const BATCH = 25;
    for (let i = 0; i < users.length; i += BATCH) {
      await Promise.allSettled(
        users.slice(i, i + BATCH).map(u =>
          bot.telegram.sendMessage(u.id, text, { parse_mode: 'Markdown' }).catch(err => { require('./logger').debug("[silent]", err.message); })
        )
      );
      if (i + BATCH < users.length) await new Promise(r => setTimeout(r, 1000));
    }
    logger.info(`[UserNotify] أُرسل لـ ${users.length} مستخدم`);
  } catch(err) {
    logger.error('[UserNotify]', err.message);
  }
}
module.exports = { notifyUsersNewFile };
