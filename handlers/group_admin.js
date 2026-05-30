'use strict';
const { run, all, get } = require('../database/db');
const { cacheGet, cacheSet, cacheClear } = require('../utils/cache');

// ══════════════════════════════════════════════════════════
// 🔧 Utility — MarkdownV2 escape (Telegram strict)
// ══════════════════════════════════════════════════════════
const escV2 = t => String(t || '').replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');

// الساعة الجزائرية UTC+1
function algeriaTime() {
  const now = new Date(Date.now() + 3600000);
  const date = now.toLocaleDateString('ar-DZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return { date, time };
}

// ══════════════════════════════════════════════════════════
// 🎉 ترحيب احترافي بالأعضاء الجدد
// ══════════════════════════════════════════════════════════
async function handleNewMember(bot, chatId, userId, firstName) {
  try {
    // تسجيل العضو في DB
    await run(
      `INSERT INTO group_members(chat_id,user_id,username,first_name,updated_at)
       VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP)
       ON CONFLICT(chat_id,user_id) DO UPDATE
         SET first_name=EXCLUDED.first_name, updated_at=CURRENT_TIMESTAMP`,
      [chatId, userId, '', firstName || 'عضو']
    ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });

    // مسح الكاش عند إضافة عضو جديد
    cacheClear('grp_members_' + chatId);
    cacheClear('grp_count_' + chatId);

    // جلب إعدادات الترحيب + تخصص القروب
    const [grp, welcomeSettings] = await Promise.all([
      get('SELECT specialty_id, welcome_enabled, welcome_msg, welcome_photo FROM group_chats WHERE chat_id=$1', [chatId]).catch(() => null),
    ]);

    const spec = grp?.specialty_id
      ? await get('SELECT name FROM specialties WHERE id=$1', [grp.specialty_id]).catch(() => null)
      : null;

    const { date, time } = algeriaTime();
    const name     = escV2(firstName || 'عضو');
    const uid      = userId;
    const specName = spec?.name ? escV2(spec.name) : '';
    const specLine = specName ? `\n🎓 التخصص: *${specName}*` : '';

    // عدد الأعضاء الحاليين
    let memberCount = '';
    try {
      const cnt = await bot.telegram.getChatMembersCount(chatId);
      memberCount = `\n👥 أنتَ العضو رقم: *${escV2(String(cnt))}*`;
    } catch (_) {}

    const defaultMsg =
`╔══════════════════╗
🎊 *أهلاً وسهلاً بك\\!*
╚══════════════════╝

🌟 *${name}* انضم لعائلتنا\\!

┌─────────────────────┐
│ 🆔 *المعرّف:* ||${uid}||
│ 📅 *تاريخ الانضمام:* ${escV2(date)}
│ 🕐 *الساعة:* ${escV2(time)}${specLine}${memberCount}
└─────────────────────┘

💡 *يُمنع* السبّ والإزعاج
📚 تفاعل معنا وشارك دراستك\\!

🔗 [ملفّك الشخصي](tg://user?id=${uid})`;

    const welcomeMsg = welcomeSettings?.message
      ? welcomeSettings.message
          .replace('{name}', firstName || 'عضو')
          .replace('{spec}', spec?.name || '')
          .replace('{id}',   userId)
          .replace('{date}', date)
          .replace('{time}', time)
      : defaultMsg;

    const parse = welcomeSettings?.message ? 'Markdown' : 'MarkdownV2';

    if (grp?.welcome_photo && grp.welcome_photo.startsWith('CAA')) {
      await bot.telegram.sendSticker(chatId, grp.welcome_photo).catch(() => {});
    } else if (welcomeSettings?.image_file_id) {
      await bot.telegram.sendPhoto(chatId, welcomeSettings.image_file_id, {
        caption:    welcomeMsg,
        parse_mode: parse,
      }).catch(e => console.error('[Welcome Photo]', e.message));
    } else {
      await bot.telegram.sendMessage(chatId, welcomeMsg, {
        parse_mode:           parse,
        disable_web_page_preview: true,
      }).catch(e => console.error('[Welcome]', e.message));
    }
  } catch (e) {
    console.error('[Welcome]', e.message);
  }
}

// ══════════════════════════════════════════════════════════
// 👋 رسالة وداع عند مغادرة عضو
// ══════════════════════════════════════════════════════════
async function handleMemberLeft(bot, chatId, userId, firstName) {
  try {
    cacheClear('grp_members_' + chatId);
    cacheClear('grp_count_'   + chatId);

    await run(
      'DELETE FROM group_members WHERE chat_id=$1 AND user_id=$2',
      [chatId, userId]
    ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });

    // إرسال رسالة وداع (اختياري — يُعطَّل إذا كان القروب كبير)
    const grp = await get(
      'SELECT goodbye_enabled FROM group_chats WHERE chat_id=$1',
      [chatId]
    ).catch(() => null);

    if (grp?.goodbye_enabled) {
      const name = escV2(firstName || 'عضو');
      const msg = `👋 *${name}* غادر القروب\\.\n\nنتمنى لك التوفيق في مسيرتك\\! 🌟`;
      await bot.telegram.sendMessage(chatId, msg, { parse_mode: 'MarkdownV2' })
        .catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }
  } catch (e) {
    console.error('[Left]', e.message);
  }
}

// ══════════════════════════════════════════════════════════
// ⚙️ إعدادات الترحيب
// ══════════════════════════════════════════════════════════
async function setWelcomeImage(ctx, chatId, fileId) {
  await run(
    `INSERT INTO group_welcome(chat_id, image_file_id, updated_at)
     VALUES($1,$2,CURRENT_TIMESTAMP)
     ON CONFLICT(chat_id) DO UPDATE
       SET image_file_id=$2, updated_at=CURRENT_TIMESTAMP`,
    [chatId, fileId]
  );
  return ctx.reply('✅ تم حفظ صورة الترحيب').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
}

async function setWelcomeMessage(ctx, chatId, message) {
  await run(
    `INSERT INTO group_welcome(chat_id, message, updated_at)
     VALUES($1,$2,CURRENT_TIMESTAMP)
     ON CONFLICT(chat_id) DO UPDATE
       SET message=$2, updated_at=CURRENT_TIMESTAMP`,
    [chatId, message]
  );
  return ctx.reply(
    '✅ تم حفظ رسالة الترحيب\n\n📝 المتغيرات المتاحة:\n`{name}` - اسم العضو\n`{spec}` - التخصص\n`{id}` - المعرّف\n`{date}` - التاريخ\n`{time}` - الساعة',
    { parse_mode: 'Markdown' }
  ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
}

async function clearWelcome(chatId) {
  await run('DELETE FROM group_welcome WHERE chat_id=$1', [chatId]);
}

// ══════════════════════════════════════════════════════════
// 👥 عرض الأعضاء
// ══════════════════════════════════════════════════════════
async function showAllMembers(ctx, chatId) {
  try {
    const cacheKey = 'grp_members_' + chatId;
    let members = cacheGet(cacheKey);

    if (!members) {
      members = await all(
        'SELECT user_id, first_name FROM group_members WHERE chat_id=$1 ORDER BY updated_at DESC LIMIT 200',
        [chatId]
      ).catch(() => []);

      // أضف الأدمنز من Telegram إن لم يكونوا موجودين
      try {
        const admins = await ctx.telegram.getChatAdministrators(chatId).catch(() => []);
        for (const a of admins) {
          if (!a?.user || a.user.is_bot) continue;
          if (!members.find(m => String(m.user_id) === String(a.user.id))) {
            members.push({
              user_id:    a.user.id,
              first_name: (a.user.first_name || 'Admin') + ' 👑',
            });
            run(
              `INSERT INTO group_members(chat_id,user_id,username,first_name,updated_at)
               VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP)
               ON CONFLICT(chat_id,user_id) DO UPDATE SET first_name=EXCLUDED.first_name`,
              [chatId, a.user.id, a.user.username || '', a.user.first_name || 'Admin']
            ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
          }
        }
      } catch (_) {}

      cacheSet(cacheKey, members, 300000);
    }

    const tgTotal = await ctx.telegram.getChatMembersCount(chatId).catch(() => 0);

    if (!members.length) {
      return ctx.reply(
        `📭 *لا يوجد أعضاء مسجلين بعد*\n\n` +
        `💡 الأعضاء يُسجَّلون تلقائياً عند إرسال أي رسالة\n` +
        `👥 إجمالي القروب حسب Telegram: *${tgTotal}*`,
        { parse_mode: 'Markdown' }
      ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }

    let text = `👥 *قائمة الأعضاء*\n`;
    text += `━━━━━━━━━━━━━━━━━━\n`;
    text += `📊 مسجلون: *${members.length}* | إجمالي TG: *${tgTotal}*\n`;
    text += `━━━━━━━━━━━━━━━━━━\n\n`;

    members.slice(0, 50).forEach((m, i) => {
      const icon = (m.first_name || '').includes('👑') ? '' : '👤 ';
      text += `${i + 1}\\. ${icon}${m.first_name || 'مجهول'}\n`;
    });

    if (members.length > 50) {
      text += `\n_…و ${members.length - 50} عضو آخر_`;
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🏷️ منشن الكل',   callback_data: 'tag_all_'   + chatId },
          { text: '📊 إحصائيات',    callback_data: 'grp_stats_' + chatId },
        ],
        [
          { text: '🔇 إسكات الكل',  callback_data: 'mute_all_'   + chatId },
          { text: '🔊 تفعيل الكل',  callback_data: 'unmute_all_' + chatId },
        ],
        [
          { text: '🗑 إغلاق',       callback_data: 'close_list_' + chatId },
        ],
      ],
    };

    const sentMsg = await ctx.reply(text, {
      parse_mode:   'Markdown',
      reply_markup: keyboard,
    }).catch(() => null);

    // حذف القائمة بعد 30 ثانية تلقائياً
    if (sentMsg) {
      setTimeout(() => ctx.deleteMessage(sentMsg.message_id).catch(err => { require('../utils/logger').debug("[silent]", err.message); }), 30000);
    }
    return sentMsg;
  } catch (e) {
    console.error('[/all]', e.message);
    return ctx.reply('❌ خطأ: ' + e.message).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  }
}

// ══════════════════════════════════════════════════════════
// 🏷️ منشن الكل — مع رسالة مخصصة
// ══════════════════════════════════════════════════════════
async function tagAll(ctx, chatId, customMessage) {
  try {
    ctx.answerCbQuery('⏳ جاري المنشن…').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    ctx.deleteMessage().catch(err => { require('../utils/logger').debug("[silent]", err.message); });

    const members = await all(
      'SELECT user_id, first_name FROM group_members WHERE chat_id=$1 LIMIT 100',
      [chatId]
    ).catch(() => []);

    if (!members.length) {
      return ctx.answerCbQuery('📭 لا يوجد أعضاء مسجلون', { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }

    const header = customMessage
      ? `📢 *${customMessage}*\n\n`
      : '👋 *تنبيه لجميع الأعضاء*\n\n';

    // كل chunk = 25 عضو للبقاء ضمن حد الرسالة (~1024 حرف)
    const CHUNK = 25;
    let first = true;
    for (let i = 0; i < members.length; i += CHUNK) {
      const chunk    = members.slice(i, i + CHUNK);
      const mentions = chunk
        .map(m => `[${(m.first_name || '👤').substring(0, 15)}](tg://user?id=${m.user_id})`)
        .join(' ');

      await ctx.reply((first ? header : '') + mentions, {
        parse_mode:               'Markdown',
        disable_web_page_preview: true,
      }).catch(() => null);

      first = false;
      if (i + CHUNK < members.length) await sleep(1200); // Telegram flood wait
    }
  } catch (e) {
    console.error('[tagAll]', e.message);
  }
}

// ══════════════════════════════════════════════════════════
// 🔇 إسكات الكل
// ══════════════════════════════════════════════════════════
async function muteAll(ctx, chatId) {
  try {
    ctx.answerCbQuery('⏳ جاري الإسكات…').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    ctx.deleteMessage().catch(err => { require('../utils/logger').debug("[silent]", err.message); }); // مرة واحدة فقط ← BUG FIX

    const members = await all(
      'SELECT user_id FROM group_members WHERE chat_id=$1 LIMIT 100',
      [chatId]
    ).catch(() => []);

    if (!members.length) {
      return ctx.answerCbQuery('📭 لا يوجد أعضاء', { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }

    let ok = 0, fail = 0;
    const until = Math.floor(Date.now() / 1000) + 3600; // ساعة واحدة

    for (const m of members) {
      try {
        await ctx.telegram.restrictChatMember(chatId, m.user_id, {
          permissions: {
            can_send_messages:       false,
            can_send_media_messages: false,
            can_send_polls:          false,
            can_send_other_messages: false,
          },
          until_date: until,
        });
        ok++;
      } catch (_) { fail++; }
      await sleep(60); // max ~16 req/s — آمن من rate-limit
    }

    const sent = await ctx.reply(
      `🔇 *تم إسكات الأعضاء*\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `✅ نجح: *${ok}* عضو\n` +
      `❌ فشل: *${fail}*\n` +
      `⏱ المدة: ساعة واحدة`,
      { parse_mode: 'Markdown' }
    ).catch(() => null);

    if (sent) setTimeout(() => ctx.deleteMessage(sent.message_id).catch(err => { require('../utils/logger').debug("[silent]", err.message); }), 8000);
  } catch (e) {
    console.error('[muteAll]', e.message);
  }
}

// ══════════════════════════════════════════════════════════
// 🔊 تفعيل الكل
// ══════════════════════════════════════════════════════════
async function unmuteAll(ctx, chatId) {
  try {
    ctx.answerCbQuery('⏳ جاري التفعيل…').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    ctx.deleteMessage().catch(err => { require('../utils/logger').debug("[silent]", err.message); }); // مرة واحدة فقط ← BUG FIX

    const members = await all(
      'SELECT user_id FROM group_members WHERE chat_id=$1 LIMIT 100',
      [chatId]
    ).catch(() => []);

    if (!members.length) {
      return ctx.answerCbQuery('📭 لا يوجد أعضاء', { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }

    let ok = 0, fail = 0;
    for (const m of members) {
      try {
        await ctx.telegram.restrictChatMember(chatId, m.user_id, {
          permissions: {
            can_send_messages:         true,
            can_send_media_messages:   true,
            can_send_polls:            true,
            can_add_web_page_previews: true,
            can_send_other_messages:   true,
            can_change_info:           false,
            can_invite_users:          true,
            can_pin_messages:          false,
          },
        });
        ok++;
      } catch (_) { fail++; }
      await sleep(60);
    }

    const sent = await ctx.reply(
      `🔊 *تم تفعيل الكل*\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `✅ نجح: *${ok}* عضو\n` +
      `❌ فشل: *${fail}*`,
      { parse_mode: 'Markdown' }
    ).catch(() => null);

    if (sent) setTimeout(() => ctx.deleteMessage(sent.message_id).catch(err => { require('../utils/logger').debug("[silent]", err.message); }), 8000);
  } catch (e) {
    console.error('[unmuteAll]', e.message);
  }
}

// ══════════════════════════════════════════════════════════
// 📊 إحصائيات القروب
// ══════════════════════════════════════════════════════════
async function showGroupStats(ctx, chatId) {
  try {
    ctx.answerCbQuery('📊 جاري التحميل…').catch(err => { require('../utils/logger').debug("[silent]", err.message); });

    const [tgCount, dbMembers, grp] = await Promise.all([
      ctx.telegram.getChatMembersCount(chatId).catch(() => 0),
      all('SELECT COUNT(*) AS cnt FROM group_members WHERE chat_id=$1', [chatId]).catch(() => [{ cnt: 0 }]),
      get('SELECT title, specialty_id, notify_new_files FROM group_chats WHERE chat_id=$1', [chatId]).catch(() => null),
    ]);

    const spec = grp?.specialty_id
      ? await get('SELECT name FROM specialties WHERE id=$1', [grp.specialty_id]).catch(() => null)
      : null;

    const dbCount   = dbMembers[0]?.cnt || 0;
    const notifyOn  = grp?.notify_new_files ? '🟢 مفعّل' : '🔴 معطّل';
    const specName  = spec?.name || 'غير محدد';

    const text =
      `📊 *إحصائيات القروب*\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🏷 الاسم: *${grp?.title || 'غير معروف'}*\n` +
      `🎓 التخصص: *${specName}*\n\n` +
      `👥 أعضاء Telegram: *${tgCount}*\n` +
      `🗂 مسجلون في DB: *${dbCount}*\n\n` +
      `🔔 إشعارات الملفات: ${notifyOn}\n` +
      `🆔 معرف القروب: \`${chatId}\``;

    const sent = await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '🗑 إغلاق', callback_data: 'close_stats_' + chatId },
        ]],
      },
    }).catch(() => null);

    if (sent) setTimeout(() => ctx.deleteMessage(sent.message_id).catch(err => { require('../utils/logger').debug("[silent]", err.message); }), 20000);
  } catch (e) {
    console.error('[GroupStats]', e.message);
  }
}

// ══════════════════════════════════════════════════════════
// 📌 قواعد القروب
// ══════════════════════════════════════════════════════════
async function showGroupRules(ctx, chatId) {
  try {
    const grp = await get('SELECT rules FROM group_chats WHERE chat_id=$1', [chatId]).catch(() => null);

    const defaultRules =
      `📜 *قواعد القروب*\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `1️⃣ الاحترام المتبادل بين جميع الأعضاء\n` +
      `2️⃣ ممنوع الإزعاج والفلود\n` +
      `3️⃣ ممنوع الإعلانات والسبام\n` +
      `4️⃣ الحفاظ على موضوع القروب (الدراسة)\n` +
      `5️⃣ المشرفون يملكون حق التحذير والطرد\n\n` +
      `⚠️ مخالفة القواعد = تحذير ثم حظر`;

    const text = grp?.rules || defaultRules;

    await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '✅ قرأت وفهمت', callback_data: 'rules_ok' }]],
      },
    }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  } catch (e) {
    console.error('[Rules]', e.message);
  }
}

async function setGroupRules(ctx, chatId, rules) {
  await run(
    `UPDATE group_chats SET rules=$1 WHERE chat_id=$2`,
    [rules, chatId]
  );
  return ctx.reply('✅ تم حفظ قواعد القروب').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
}

// ══════════════════════════════════════════════════════════
// 🛡 نظام التحذيرات (Warn System)
// ══════════════════════════════════════════════════════════
async function warnMember(ctx, chatId, targetUserId, reason) {
  try {
    // أضف تحذير
    await run(
      `INSERT INTO group_warns(chat_id, user_id, warned_by, reason, created_at)
       VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP)`,
      [chatId, targetUserId, ctx.from.id, reason || 'مخالفة القواعد']
    ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });

    // احسب مجموع التحذيرات
    const warnCount = await get(
      'SELECT COUNT(*) AS cnt FROM group_warns WHERE chat_id=$1 AND user_id=$2',
      [chatId, targetUserId]
    ).catch(() => ({ cnt: 0 }));

    const count = parseInt(warnCount?.cnt || 0);
    const MAX_WARNS = 3;

    let actionText = '';
    if (count >= MAX_WARNS) {
      // حظر تلقائي بعد 3 تحذيرات
      try {
        await ctx.telegram.banChatMember(chatId, targetUserId);
        actionText = `\n🚫 *تم الحظر تلقائياً* بعد ${MAX_WARNS} تحذيرات\\!`;
        // إعادة ضبط التحذيرات
        await run('DELETE FROM group_warns WHERE chat_id=$1 AND user_id=$2', [chatId, targetUserId]).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      } catch (_) {
        actionText = `\n⚠️ *تعذّر الحظر* — يرجى المراجعة يدوياً`;
      }
    } else if (count === MAX_WARNS - 1) {
      actionText = `\n⚠️ *تحذير أخير\\!* — تحذير آخر = حظر فوري`;
    }

    const msg = await ctx.reply(
      `⚠️ *تحذير رسمي*\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `👤 المستخدم: [user](tg://user?id=${targetUserId})\n` +
      `📝 السبب: ${escV2(reason || 'مخالفة القواعد')}\n` +
      `🔢 التحذير رقم: *${count}/${MAX_WARNS}*` +
      actionText,
      { parse_mode: 'MarkdownV2' }
    ).catch(() => null);

    if (msg) setTimeout(() => ctx.deleteMessage(msg.message_id).catch(err => { require('../utils/logger').debug("[silent]", err.message); }), 15000);
  } catch (e) {
    console.error('[Warn]', e.message);
  }
}

async function showWarns(ctx, chatId, targetUserId) {
  try {
    const warns = await all(
      'SELECT reason, created_at FROM group_warns WHERE chat_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 10',
      [chatId, targetUserId]
    ).catch(() => []);

    if (!warns.length) {
      return ctx.reply('✅ هذا العضو لا يملك أي تحذيرات').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }

    let text = `📋 *تحذيرات العضو*\n━━━━━━━━━━━━━━━━━━\n\n`;
    warns.forEach((w, i) => {
      const d = new Date(w.created_at).toLocaleDateString('ar-DZ');
      text += `${i + 1}. ${w.reason || 'لا سبب'} — _${d}_\n`;
    });

    return ctx.reply(text, { parse_mode: 'Markdown' }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  } catch (e) {
    console.error('[ShowWarns]', e.message);
  }
}

async function clearWarns(ctx, chatId, targetUserId) {
  await run('DELETE FROM group_warns WHERE chat_id=$1 AND user_id=$2', [chatId, targetUserId]).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  return ctx.reply('✅ تم مسح تحذيرات العضو').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
}

// ══════════════════════════════════════════════════════════
// 🚫 حظر / رفع الحظر
// ══════════════════════════════════════════════════════════
async function banMember(ctx, chatId, targetUserId, reason, deleteMessages) {
  try {
    await ctx.telegram.banChatMember(chatId, targetUserId, {
      revoke_messages: deleteMessages || false,
    });

    // سجّل الحظر
    await run(
      `INSERT INTO group_bans(chat_id, user_id, banned_by, reason, created_at)
       VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP)
       ON CONFLICT(chat_id, user_id) DO UPDATE SET reason=$4, updated_at=CURRENT_TIMESTAMP`,
      [chatId, targetUserId, ctx.from.id, reason || 'لا سبب']
    ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });

    const msg = await ctx.reply(
      `🚫 *تم الحظر*\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `👤 [العضو](tg://user?id=${targetUserId})\n` +
      `📝 السبب: ${reason || 'غير محدد'}`,
      { parse_mode: 'Markdown' }
    ).catch(() => null);

    if (msg) setTimeout(() => ctx.deleteMessage(msg.message_id).catch(err => { require('../utils/logger').debug("[silent]", err.message); }), 10000);
  } catch (e) {
    ctx.reply('❌ فشل الحظر: ' + e.message).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  }
}

async function unbanMember(ctx, chatId, targetUserId) {
  try {
    await ctx.telegram.unbanChatMember(chatId, targetUserId);
    await run('DELETE FROM group_bans WHERE chat_id=$1 AND user_id=$2', [chatId, targetUserId]).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    const msg = await ctx.reply(`✅ تم رفع الحظر عن [العضو](tg://user?id=${targetUserId})`, {
      parse_mode: 'Markdown',
    }).catch(() => null);
    if (msg) setTimeout(() => ctx.deleteMessage(msg.message_id).catch(err => { require('../utils/logger').debug("[silent]", err.message); }), 8000);
  } catch (e) {
    ctx.reply('❌ فشل رفع الحظر: ' + e.message).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  }
}

// ══════════════════════════════════════════════════════════
// 🔕 إسكات / تفعيل عضو واحد
// ══════════════════════════════════════════════════════════
async function muteMember(ctx, chatId, targetUserId, durationMinutes) {
  try {
    const until = durationMinutes
      ? Math.floor(Date.now() / 1000) + durationMinutes * 60
      : 0; // 0 = إلى الأبد

    await ctx.telegram.restrictChatMember(chatId, targetUserId, {
      permissions: {
        can_send_messages:       false,
        can_send_media_messages: false,
        can_send_polls:          false,
        can_send_other_messages: false,
      },
      until_date: until || undefined,
    });

    const durText = durationMinutes ? `${durationMinutes} دقيقة` : 'حتى يتم التفعيل يدوياً';
    const msg = await ctx.reply(
      `🔇 *تم إسكات العضو*\n` +
      `👤 [العضو](tg://user?id=${targetUserId})\n` +
      `⏱ المدة: ${durText}`,
      { parse_mode: 'Markdown' }
    ).catch(() => null);
    if (msg) setTimeout(() => ctx.deleteMessage(msg.message_id).catch(err => { require('../utils/logger').debug("[silent]", err.message); }), 8000);
  } catch (e) {
    ctx.reply('❌ فشل الإسكات: ' + e.message).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  }
}

async function unmuteMember(ctx, chatId, targetUserId) {
  try {
    await ctx.telegram.restrictChatMember(chatId, targetUserId, {
      permissions: {
        can_send_messages:         true,
        can_send_media_messages:   true,
        can_send_polls:            true,
        can_add_web_page_previews: true,
        can_send_other_messages:   true,
        can_change_info:           false,
        can_invite_users:          true,
        can_pin_messages:          false,
      },
    });

    const msg = await ctx.reply(
      `🔊 *تم تفعيل العضو*\n👤 [العضو](tg://user?id=${targetUserId})`,
      { parse_mode: 'Markdown' }
    ).catch(() => null);
    if (msg) setTimeout(() => ctx.deleteMessage(msg.message_id).catch(err => { require('../utils/logger').debug("[silent]", err.message); }), 8000);
  } catch (e) {
    ctx.reply('❌ فشل التفعيل: ' + e.message).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  }
}

// ══════════════════════════════════════════════════════════
// 🤖 مكافحة السبام (Anti-Spam)
// ══════════════════════════════════════════════════════════
const _spamMap = new Map(); // userId → { count, last }

function checkAntiSpam(userId, maxMsg = 5, windowMs = 5000) {
  const now  = Date.now();
  const data = _spamMap.get(userId) || { count: 0, last: now };

  if (now - data.last > windowMs) {
    _spamMap.set(userId, { count: 1, last: now });
    return false; // لا سبام
  }

  data.count++;
  data.last = now;
  _spamMap.set(userId, data);
  return data.count > maxMsg; // سبام!
}

// تنظيف خريطة السبام كل دقيقة
setInterval(() => {
  const cutoff = Date.now() - 60000;
  for (const [k, v] of _spamMap.entries()) {
    if (v.last < cutoff) _spamMap.delete(k);
  }
}, 60000).unref();

// ══════════════════════════════════════════════════════════
// 🔗 Helper
// ══════════════════════════════════════════════════════════
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ══════════════════════════════════════════════════════════
// Exports
// ══════════════════════════════════════════════════════════
module.exports = {
  handleNewMember,
  handleMemberLeft,
  showAllMembers,
  tagAll,
  muteAll,
  unmuteAll,
  showGroupStats,
  showGroupRules,
  setGroupRules,
  warnMember,
  showWarns,
  clearWarns,
  banMember,
  unbanMember,
  muteMember,
  unmuteMember,
  setWelcomeImage,
  setWelcomeMessage,
  clearWelcome,
  checkAntiSpam,
};
