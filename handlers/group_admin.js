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

    // اجلب اسم التخصص
    const grp = await get('SELECT specialty_id FROM group_chats WHERE chat_id=$1', [chatId]).catch(() => null);
    const spec = grp?.specialty_id ? await get('SELECT name FROM specialties WHERE id=$1', [grp.specialty_id]).catch(() => null) : null;

    const name = firstName || 'عضو';
    const specLine = spec ? `\n🎓 التخصص: *${spec.name}*` : '';

    const welcome =
`👋 *أهلاً وسهلاً يا ${name}!*${specLine}

━━━━━━━━━━━━━━━
📚 *كيف تستخدم البوت؟*

🔍 للبحث عن ملف:
\`/search اسم الملف\`

📂 آخر الملفات المضافة:
\`/new\`

🏆 الأكثر تحميلاً:
\`/top\`
━━━━━━━━━━━━━━━
💡 يمكنك البحث مباشرة بكتابة اسم المادة`;

    await bot.telegram.sendMessage(chatId, welcome, { parse_mode: 'Markdown' }).catch(e => {
      console.error('[Welcome]', e.message);
    });
  } catch(e) {
    console.error('[Welcome]', e.message);
  }
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

    return ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: rows }
    }).catch(() => {});
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
    const members = await all(
      'SELECT user_id, first_name FROM group_members WHERE chat_id=$1 LIMIT 100',
      [chatId]
    ).catch(() => []);

    if (!members.length) {
      return ctx.answerCbQuery('📭 لا يوجد أعضاء', { show_alert: true }).catch(() => {});
    }

    const mentions = members.map(m => `[${m.first_name || '👤'}](tg://user?id=${m.user_id})`).join(' ');
    return ctx.reply('👋 ' + mentions, { parse_mode: 'Markdown' }).catch(() => {});
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
    return ctx.reply(
      `🔇 *تم الإسكات*\n✅ ${ok} عضو | ❌ ${fail} فشل\n⏱ لمدة ساعة واحدة`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
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
    return ctx.reply(
      `🔊 *تم التفعيل*\n✅ ${ok} عضو | ❌ ${fail} فشل`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  } catch(e) {
    console.error('[unmute]', e.message);
  }
}

module.exports = { handleNewMember, showAllMembers, tagAll, muteAll, unmuteAll };
