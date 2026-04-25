'use strict';
const { run, all, get } = require('../database/db');

// ══════════════════════════════════════════════
// 🎉 ترحيب احترافي بالأعضاء الجدد
// ══════════════════════════════════════════════
async function handleNewMember(bot, chatId, userId, firstName) {
  try {
    // حفظ في DB
    await run(
      'INSERT INTO group_members(chat_id,user_id,username,first_name,updated_at) VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP) ON CONFLICT(chat_id,user_id) DO UPDATE SET first_name=EXCLUDED.first_name,updated_at=CURRENT_TIMESTAMP',
      [chatId, userId, '', firstName || 'عضو']
    ).catch(() => {});

    // اجلب إعدادات الترحيب + التخصص
    const [grp, welcomeSettings] = await Promise.all([
      get('SELECT specialty_id FROM group_chats WHERE chat_id=$1', [chatId]).catch(() => null),
      get('SELECT image_file_id, message FROM group_welcome WHERE chat_id=$1 OR chat_id=0 ORDER BY chat_id DESC LIMIT 1', [chatId]).catch(() => null)
    ]);
    const spec = grp?.specialty_id ? await get('SELECT name FROM specialties WHERE id=$1', [grp.specialty_id]).catch(() => null) : null;

    const name = firstName || 'عضو';
    const specLine = spec ? '\n🎓 التخصص: *' + spec.name + '*' : '';

    // رسالة ترحيب مخصصة أو افتراضية
    // تاريخ ووقت الانضمام
    const now = new Date();
    const joinDate = now.toLocaleDateString('en-GB').replace(/\//g, '/');
    const joinTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const specName = spec?.name || '';

    const defaultMsg =
'❋═══════════════════❋\n' +
'🎉 نورت قروبنا يـ *' + name + '*\n' +
'❋═══════════════════❋\n\n' +
'° : اسمك  ⟸  『' + name + '』\n' +
'° : ايديك  ⟸  『' + userId + '』\n' +
(specName ? '° : تخصصك  ⟸  『' + specName + '』\n' : '') +
'\n┌─────────────────┐\n' +
'° : تاريخ انضمامك 🗓  :  ' + joinDate + '\n' +
'° : الساعة 🕐  :  ' + joinTime + '\n' +
'└─────────────────┘\n\n' +
'❋═══════════════════❋';

    const welcomeMsg = welcomeSettings?.message
      ? welcomeSettings.message.replace('{name}', name).replace('{spec}', specName).replace('{id}', userId).replace('{date}', joinDate).replace('{time}', joinTime)
      : defaultMsg;

    if (welcomeSettings?.image_file_id) {
      await bot.telegram.sendPhoto(chatId, welcomeSettings.image_file_id, {
        caption: welcomeMsg,
        parse_mode: 'Markdown'
      }).catch(e => console.error('[Welcome Photo]', e.message));
    } else {
      await bot.telegram.sendMessage(chatId, welcomeMsg, { parse_mode: 'Markdown' }).catch(e => {
        console.error('[Welcome]', e.message);
      });
    }
  } catch(e) {
    console.error('[Welcome]', e.message);
  }
}

// ── إعداد صورة الترحيب ──────────────────────────
async function setWelcomeImage(ctx, chatId, fileId) {
  await run(
    'INSERT INTO group_welcome(chat_id, image_file_id, updated_at) VALUES($1,$2,CURRENT_TIMESTAMP) ON CONFLICT(chat_id) DO UPDATE SET image_file_id=$2, updated_at=CURRENT_TIMESTAMP',
    [chatId, fileId]
  );
}

async function setWelcomeMessage(ctx, chatId, message) {
  await run(
    'INSERT INTO group_welcome(chat_id, message, updated_at) VALUES($1,$2,CURRENT_TIMESTAMP) ON CONFLICT(chat_id) DO UPDATE SET message=$2, updated_at=CURRENT_TIMESTAMP',
    [chatId, message]
  );
}

async function clearWelcome(chatId) {
  await run('DELETE FROM group_welcome WHERE chat_id=$1', [chatId]);
}

// ══════════════════════════════════════════════
// 👥 عرض الأعضاء
// ══════════════════════════════════════════════
async function showAllMembers(ctx, chatId) {
  try {
    const members = await all(
      'SELECT user_id, first_name FROM group_members WHERE chat_id=$1 ORDER BY updated_at DESC LIMIT 200',
      [chatId]
    ).catch(() => []);

    if (!members.length) {
      return ctx.reply(
        '📭 *لا يوجد أعضاء مسجلين بعد*\n\nسيتم تسجيلهم تلقائياً عند دخولهم القادم',
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }

    let text = `👥 *الأعضاء: ${members.length}*\n━━━━━━━━━━━━\n\n`;
    members.slice(0, 50).forEach((m, i) => {
      text += `${i + 1}. ${m.first_name || 'مجهول'}\n`;
    });
    if (members.length > 50) text += `\n_...و ${members.length - 50} عضو آخر_`;

    const rows = [
      [
        { text: '🏷️ منشن الكل', callback_data: 'tag_all_' + chatId },
        { text: '🔇 إسكات الكل', callback_data: 'mute_all_' + chatId }
      ],
      [
        { text: '🔊 تفعيل الكل', callback_data: 'unmute_all_' + chatId }
      ]
    ];

    const sentMsg = await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: rows }
    }).catch(() => null);
    if (sentMsg) setTimeout(() => ctx.deleteMessage(sentMsg.message_id).catch(() => {}), 20000);
    return sentMsg;
  } catch(e) {
    console.error('[/all]', e.message);
    return ctx.reply('❌ خطأ: ' + e.message).catch(() => {});
  }
}

// ══════════════════════════════════════════════
// 🏷️ منشن الكل
// ══════════════════════════════════════════════
async function tagAll(ctx, chatId) {
  try {
    ctx.answerCbQuery('⏳ جاري المنشن...').catch(() => {});
    // احذف رسالة القائمة فوراً
    ctx.deleteMessage().catch(() => {});
    const members = await all(
      'SELECT user_id, first_name FROM group_members WHERE chat_id=$1 LIMIT 100',
      [chatId]
    ).catch(() => []);

    if (!members.length) {
      return ctx.answerCbQuery('📭 لا يوجد أعضاء', { show_alert: true }).catch(() => {});
    }

    const mentions = members.map(m => `[${m.first_name || '👤'}](tg://user?id=${m.user_id})`).join(' ');
    const m1 = await ctx.reply('👋 ' + mentions, { parse_mode: 'Markdown' }).catch(() => null);
  // المنشن يبقى — عشان الأعضاء يشوفونه
  } catch(e) {
    console.error('[tag]', e.message);
  }
}

// ══════════════════════════════════════════════
// 🔇 إسكات الكل
// ══════════════════════════════════════════════
async function muteAll(ctx, chatId) {
  try {
    ctx.answerCbQuery('⏳ جاري الإسكات...').catch(() => {});
    ctx.deleteMessage().catch(() => {});
    ctx.deleteMessage().catch(() => {});
    const members = await all(
      'SELECT user_id FROM group_members WHERE chat_id=$1 LIMIT 100',
      [chatId]
    ).catch(() => []);

    if (!members.length) {
      return ctx.answerCbQuery('📭 لا يوجد أعضاء', { show_alert: true }).catch(() => {});
    }

    let ok = 0, fail = 0;
    for (const m of members) {
      try {
        await ctx.telegram.restrictChatMember(chatId, m.user_id, {
          permissions: { can_send_messages: false },
          until_date: Math.floor(Date.now() / 1000) + 3600
        });
        ok++;
      } catch(_) { fail++; }
    }
    const m2 = await ctx.reply(
      `🔇 *تم الإسكات*\n✅ ${ok} عضو | ❌ ${fail} فشل\n⏱ لمدة ساعة واحدة`,
      { parse_mode: 'Markdown' }
    ).catch(() => null);
  if (m2) setTimeout(() => ctx.deleteMessage(m2.message_id).catch(() => {}), 5000);
  } catch(e) {
    console.error('[mute]', e.message);
  }
}

// ══════════════════════════════════════════════
// 🔊 تفعيل الكل
// ══════════════════════════════════════════════
async function unmuteAll(ctx, chatId) {
  try {
    ctx.answerCbQuery('⏳ جاري التفعيل...').catch(() => {});
    ctx.deleteMessage().catch(() => {});
    ctx.deleteMessage().catch(() => {});
    const members = await all(
      'SELECT user_id FROM group_members WHERE chat_id=$1 LIMIT 100',
      [chatId]
    ).catch(() => []);

    if (!members.length) {
      return ctx.answerCbQuery('📭 لا يوجد أعضاء', { show_alert: true }).catch(() => {});
    }

    let ok = 0, fail = 0;
    for (const m of members) {
      try {
        await ctx.telegram.restrictChatMember(chatId, m.user_id, {
          permissions: {
            can_send_messages: true,
            can_send_media_messages: true,
            can_send_polls: true,
            can_add_web_page_previews: true
          }
        });
        ok++;
      } catch(_) { fail++; }
    }
    const m3 = await ctx.reply(
      `🔊 *تم التفعيل*\n✅ ${ok} عضو | ❌ ${fail} فشل`,
      { parse_mode: 'Markdown' }
    ).catch(() => null);
  if (m3) setTimeout(() => ctx.deleteMessage(m3.message_id).catch(() => {}), 5000);
  } catch(e) {
    console.error('[unmute]', e.message);
  }
}

async function handleMemberLeft(chatId, userId) {
  try {
    await run(
      'DELETE FROM group_members WHERE chat_id=$1 AND user_id=$2',
      [chatId, userId]
    ).catch(() => {});
    console.log('[Left]', userId, 'removed from', chatId);
  } catch(e) {
    console.error('[Left]', e.message);
  }
}

module.exports = { handleNewMember, handleMemberLeft, showAllMembers, tagAll, muteAll, unmuteAll, setWelcomeImage, setWelcomeMessage, clearWelcome };
