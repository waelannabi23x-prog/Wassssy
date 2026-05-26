#!/bin/bash
cd ~/study-bot-backup-20260407_011636

echo "📦 جاري تنصيب الملفات..."

# ── backup ──────────────────────────────────────
cp handlers/group_admin.js   handlers/group_admin.js.bak   2>/dev/null
cp handlers/group_commands.js handlers/group_commands.js.bak 2>/dev/null
cp utils/groupNotify.js      utils/groupNotify.js.bak      2>/dev/null
echo "✅ نسخ احتياطي تم"

# ── group_admin.js ───────────────────────────────
cat > handlers/group_admin.js << 'EOF'
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
    ).catch(() => {});

    // مسح الكاش عند إضافة عضو جديد
    cacheClear('grp_members_' + chatId);
    cacheClear('grp_count_' + chatId);

    // جلب إعدادات الترحيب + تخصص القروب
    const [grp, welcomeSettings] = await Promise.all([
      get('SELECT specialty_id FROM group_chats WHERE chat_id=$1', [chatId]).catch(() => null),
      get(
        'SELECT image_file_id, message FROM group_welcome WHERE chat_id=$1 OR chat_id=0 ORDER BY chat_id DESC LIMIT 1',
        [chatId]
      ).catch(() => null),
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

    if (welcomeSettings?.image_file_id) {
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
    ).catch(() => {});

    // إرسال رسالة وداع (اختياري — يُعطَّل إذا كان القروب كبير)
    const grp = await get(
      'SELECT goodbye_enabled FROM group_chats WHERE chat_id=$1',
      [chatId]
    ).catch(() => null);

    if (grp?.goodbye_enabled) {
      const name = escV2(firstName || 'عضو');
      const msg = `👋 *${name}* غادر القروب\\.\n\nنتمنى لك التوفيق في مسيرتك\\! 🌟`;
      await bot.telegram.sendMessage(chatId, msg, { parse_mode: 'MarkdownV2' })
        .catch(() => {});
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
  return ctx.reply('✅ تم حفظ صورة الترحيب').catch(() => {});
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
  ).catch(() => {});
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
            ).catch(() => {});
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
      ).catch(() => {});
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
      setTimeout(() => ctx.deleteMessage(sentMsg.message_id).catch(() => {}), 30000);
    }
    return sentMsg;
  } catch (e) {
    console.error('[/all]', e.message);
    return ctx.reply('❌ خطأ: ' + e.message).catch(() => {});
  }
}

// ══════════════════════════════════════════════════════════
// 🏷️ منشن الكل — مع رسالة مخصصة
// ══════════════════════════════════════════════════════════
async function tagAll(ctx, chatId, customMessage) {
  try {
    ctx.answerCbQuery('⏳ جاري المنشن…').catch(() => {});
    ctx.deleteMessage().catch(() => {});

    const members = await all(
      'SELECT user_id, first_name FROM group_members WHERE chat_id=$1 LIMIT 100',
      [chatId]
    ).catch(() => []);

    if (!members.length) {
      return ctx.answerCbQuery('📭 لا يوجد أعضاء مسجلون', { show_alert: true }).catch(() => {});
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
    ctx.answerCbQuery('⏳ جاري الإسكات…').catch(() => {});
    ctx.deleteMessage().catch(() => {}); // مرة واحدة فقط ← BUG FIX

    const members = await all(
      'SELECT user_id FROM group_members WHERE chat_id=$1 LIMIT 100',
      [chatId]
    ).catch(() => []);

    if (!members.length) {
      return ctx.answerCbQuery('📭 لا يوجد أعضاء', { show_alert: true }).catch(() => {});
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

    if (sent) setTimeout(() => ctx.deleteMessage(sent.message_id).catch(() => {}), 8000);
  } catch (e) {
    console.error('[muteAll]', e.message);
  }
}

// ══════════════════════════════════════════════════════════
// 🔊 تفعيل الكل
// ══════════════════════════════════════════════════════════
async function unmuteAll(ctx, chatId) {
  try {
    ctx.answerCbQuery('⏳ جاري التفعيل…').catch(() => {});
    ctx.deleteMessage().catch(() => {}); // مرة واحدة فقط ← BUG FIX

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

    if (sent) setTimeout(() => ctx.deleteMessage(sent.message_id).catch(() => {}), 8000);
  } catch (e) {
    console.error('[unmuteAll]', e.message);
  }
}

// ══════════════════════════════════════════════════════════
// 📊 إحصائيات القروب
// ══════════════════════════════════════════════════════════
async function showGroupStats(ctx, chatId) {
  try {
    ctx.answerCbQuery('📊 جاري التحميل…').catch(() => {});

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

    if (sent) setTimeout(() => ctx.deleteMessage(sent.message_id).catch(() => {}), 20000);
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
    }).catch(() => {});
  } catch (e) {
    console.error('[Rules]', e.message);
  }
}

async function setGroupRules(ctx, chatId, rules) {
  await run(
    `UPDATE group_chats SET rules=$1 WHERE chat_id=$2`,
    [rules, chatId]
  );
  return ctx.reply('✅ تم حفظ قواعد القروب').catch(() => {});
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
    ).catch(() => {});

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
        await run('DELETE FROM group_warns WHERE chat_id=$1 AND user_id=$2', [chatId, targetUserId]).catch(() => {});
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

    if (msg) setTimeout(() => ctx.deleteMessage(msg.message_id).catch(() => {}), 15000);
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
      return ctx.reply('✅ هذا العضو لا يملك أي تحذيرات').catch(() => {});
    }

    let text = `📋 *تحذيرات العضو*\n━━━━━━━━━━━━━━━━━━\n\n`;
    warns.forEach((w, i) => {
      const d = new Date(w.created_at).toLocaleDateString('ar-DZ');
      text += `${i + 1}. ${w.reason || 'لا سبب'} — _${d}_\n`;
    });

    return ctx.reply(text, { parse_mode: 'Markdown' }).catch(() => {});
  } catch (e) {
    console.error('[ShowWarns]', e.message);
  }
}

async function clearWarns(ctx, chatId, targetUserId) {
  await run('DELETE FROM group_warns WHERE chat_id=$1 AND user_id=$2', [chatId, targetUserId]).catch(() => {});
  return ctx.reply('✅ تم مسح تحذيرات العضو').catch(() => {});
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
    ).catch(() => {});

    const msg = await ctx.reply(
      `🚫 *تم الحظر*\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `👤 [العضو](tg://user?id=${targetUserId})\n` +
      `📝 السبب: ${reason || 'غير محدد'}`,
      { parse_mode: 'Markdown' }
    ).catch(() => null);

    if (msg) setTimeout(() => ctx.deleteMessage(msg.message_id).catch(() => {}), 10000);
  } catch (e) {
    ctx.reply('❌ فشل الحظر: ' + e.message).catch(() => {});
  }
}

async function unbanMember(ctx, chatId, targetUserId) {
  try {
    await ctx.telegram.unbanChatMember(chatId, targetUserId);
    await run('DELETE FROM group_bans WHERE chat_id=$1 AND user_id=$2', [chatId, targetUserId]).catch(() => {});
    const msg = await ctx.reply(`✅ تم رفع الحظر عن [العضو](tg://user?id=${targetUserId})`, {
      parse_mode: 'Markdown',
    }).catch(() => null);
    if (msg) setTimeout(() => ctx.deleteMessage(msg.message_id).catch(() => {}), 8000);
  } catch (e) {
    ctx.reply('❌ فشل رفع الحظر: ' + e.message).catch(() => {});
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
    if (msg) setTimeout(() => ctx.deleteMessage(msg.message_id).catch(() => {}), 8000);
  } catch (e) {
    ctx.reply('❌ فشل الإسكات: ' + e.message).catch(() => {});
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
    if (msg) setTimeout(() => ctx.deleteMessage(msg.message_id).catch(() => {}), 8000);
  } catch (e) {
    ctx.reply('❌ فشل التفعيل: ' + e.message).catch(() => {});
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
EOF
echo "✅ group_admin.js"

# ── group_commands.js ───────────────────────────────
cat > handlers/group_commands.js << 'EOF'
'use strict';
const {
  showAllMembers, tagAll, muteAll, unmuteAll,
  showGroupStats, showGroupRules, setGroupRules,
  warnMember, showWarns, clearWarns,
  banMember, unbanMember,
  muteMember, unmuteMember,
  setWelcomeMessage, setWelcomeImage, clearWelcome,
} = require('./group_admin');
const million = require('./million_battle');

// ── Helper: التحقق من أن المستخدم مشرف أو أونر ──
async function isAdminOrOwner(ctx, chatId) {
  try {
    const member = await ctx.telegram.getChatMember(chatId, ctx.from.id);
    return ['administrator', 'creator'].includes(member?.status)
      || ctx.isOwner
      || ctx.isAdmin;
  } catch (_) {
    return ctx.isOwner || ctx.isAdmin;
  }
}

// ── Helper: استخراج userId من المنشن أو الرد أو النص ──
async function resolveTarget(ctx) {
  // من الرد على رسالة
  if (ctx.message?.reply_to_message?.from) {
    const u = ctx.message.reply_to_message.from;
    return { userId: u.id, firstName: u.first_name || 'عضو' };
  }

  // من النص بعد الأمر  @username أو id
  const parts = (ctx.message?.text || '').split(/\s+/);
  if (parts[1]) {
    const raw = parts[1].replace('@', '');
    if (/^\d+$/.test(raw)) return { userId: parseInt(raw), firstName: raw };
    try {
      const m = await ctx.telegram.getChatMember(ctx.chat.id, '@' + raw);
      if (m?.user) return { userId: m.user.id, firstName: m.user.first_name || raw };
    } catch (_) {}
  }
  return null;
}

// ── Helper: السبب من النص ──
function getReason(ctx, skip = 2) {
  const parts = (ctx.message?.text || '').split(/\s+/);
  return parts.slice(skip).join(' ') || '';
}

// ══════════════════════════════════════════════════════════
// 🤖 تسجيل جميع أوامر القروب
// ══════════════════════════════════════════════════════════
function setupGroupCommands(bot) {

  // ── فلتر: فقط في السوبرقروب أو القروب ──
  const grpOnly = async (ctx, next) => {
    if (!['supergroup', 'group'].includes(ctx.chat?.type)) return;
    return next();
  };

  // ── فلتر: للمشرفين فقط ──
  const adminOnly = async (ctx, next) => {
    const ok = await isAdminOrOwner(ctx, ctx.chat.id);
    if (!ok) {
      const m = await ctx.reply('🚫 هذا الأمر للمشرفين فقط').catch(() => null);
      if (m) setTimeout(() => ctx.deleteMessage(m.message_id).catch(() => {}), 4000);
      return;
    }
    return next();
  };

  // ════════════════════════════════════
  // 📜 /rules — عرض قواعد القروب
  // ════════════════════════════════════
  bot.command('rules', grpOnly, async ctx => {
    try { await showGroupRules(ctx, ctx.chat.id); }
    catch (e) { ctx.reply('❌ ' + e.message).catch(() => {}); }
  });

  // ════════════════════════════════════
  // 📝 /setrules — تعيين قواعد القروب (مشرف)
  // ════════════════════════════════════
  bot.command('setrules', grpOnly, adminOnly, async ctx => {
    const text = ctx.message.text.replace(/^\/setrules\s*/i, '').trim();
    if (!text) {
      return ctx.reply(
        '📝 *طريقة الاستخدام:*\n`/setrules قواعدك هنا`\n\nأو أرسل الأمر بدون نص لمسح القواعد الحالية.',
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }
    await setGroupRules(ctx, ctx.chat.id, text);
  });

  // ════════════════════════════════════
  // 👥 /all — عرض الأعضاء (مشرف)
  // ════════════════════════════════════
  bot.command('all', grpOnly, adminOnly, async ctx => {
    try { await showAllMembers(ctx, ctx.chat.id); }
    catch (e) { ctx.reply('❌').catch(() => {}); }
  });

  // ════════════════════════════════════
  // 🏷️ /tag — منشن الكل (مشرف)
  // ════════════════════════════════════
  bot.command('tag', grpOnly, adminOnly, async ctx => {
    const msg = ctx.message.text.replace(/^\/tag\s*/i, '').trim();
    try { await tagAll(ctx, ctx.chat.id, msg || null); }
    catch (e) { ctx.reply('❌').catch(() => {}); }
  });

  // ════════════════════════════════════
  // 📊 /stats — إحصائيات القروب (مشرف)
  // ════════════════════════════════════
  bot.command('stats', grpOnly, adminOnly, async ctx => {
    try { await showGroupStats(ctx, ctx.chat.id); }
    catch (e) { ctx.reply('❌').catch(() => {}); }
  });

  // ════════════════════════════════════
  // 🔇 /mute — إسكات (مشرف)
  // استخدام: /mute @user 30 (دقائق) أو رد على رسالة
  // ════════════════════════════════════
  bot.command('mute', grpOnly, adminOnly, async ctx => {
    const target = await resolveTarget(ctx);
    if (!target) {
      return ctx.reply(
        '📌 *طريقة الاستخدام:*\n`/mute @user 30` — إسكات لمدة 30 دقيقة\nأو رُدَّ على رسالة العضو وأرسل `/mute`',
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }

    // استخرج المدة (الرقم بعد المستخدم)
    const parts    = ctx.message.text.split(/\s+/);
    const duration = parseInt(parts[2]) || 60; // افتراضي 60 دقيقة

    await muteMember(ctx, ctx.chat.id, target.userId, duration);
    ctx.deleteMessage().catch(() => {});
  });

  // ════════════════════════════════════
  // 🔊 /unmute — تفعيل (مشرف)
  // ════════════════════════════════════
  bot.command('unmute', grpOnly, adminOnly, async ctx => {
    const target = await resolveTarget(ctx);
    if (!target) {
      return ctx.reply(
        '📌 *طريقة الاستخدام:*\n`/unmute @user` أو رُدَّ على رسالة العضو وأرسل `/unmute`',
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }
    await unmuteMember(ctx, ctx.chat.id, target.userId);
    ctx.deleteMessage().catch(() => {});
  });

  // ════════════════════════════════════
  // 🔇 /muteall — إسكات الكل (مشرف)
  // ════════════════════════════════════
  bot.command('muteall', grpOnly, adminOnly, async ctx => {
    ctx.deleteMessage().catch(() => {});
    try { await muteAll(ctx, ctx.chat.id); }
    catch (e) { ctx.reply('❌').catch(() => {}); }
  });

  // ════════════════════════════════════
  // 🔊 /unmuteall — تفعيل الكل (مشرف)
  // ════════════════════════════════════
  bot.command('unmuteall', grpOnly, adminOnly, async ctx => {
    ctx.deleteMessage().catch(() => {});
    try { await unmuteAll(ctx, ctx.chat.id); }
    catch (e) { ctx.reply('❌').catch(() => {}); }
  });

  // ════════════════════════════════════
  // ⚠️ /warn — تحذير عضو (مشرف)
  // ════════════════════════════════════
  bot.command('warn', grpOnly, adminOnly, async ctx => {
    const target = await resolveTarget(ctx);
    if (!target) {
      return ctx.reply(
        '📌 *طريقة الاستخدام:*\n`/warn @user السبب`\nأو رُدَّ على رسالة العضو وأرسل `/warn السبب`',
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }

    const reason = getReason(ctx, ctx.message?.reply_to_message ? 1 : 2);
    await warnMember(ctx, ctx.chat.id, target.userId, reason);
    ctx.deleteMessage().catch(() => {});
  });

  // ════════════════════════════════════
  // 📋 /warns — عرض تحذيرات عضو (مشرف)
  // ════════════════════════════════════
  bot.command('warns', grpOnly, adminOnly, async ctx => {
    const target = await resolveTarget(ctx);
    if (!target) {
      return ctx.reply(
        '📌 *طريقة الاستخدام:*\n`/warns @user` أو رُدَّ على رسالة العضو وأرسل `/warns`',
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }
    await showWarns(ctx, ctx.chat.id, target.userId);
    ctx.deleteMessage().catch(() => {});
  });

  // ════════════════════════════════════
  // 🧹 /clearwarns — مسح تحذيرات (مشرف)
  // ════════════════════════════════════
  bot.command('clearwarns', grpOnly, adminOnly, async ctx => {
    const target = await resolveTarget(ctx);
    if (!target) {
      return ctx.reply(
        '📌 *طريقة الاستخدام:*\n`/clearwarns @user`',
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }
    await clearWarns(ctx, ctx.chat.id, target.userId);
    ctx.deleteMessage().catch(() => {});
  });

  // ════════════════════════════════════
  // 🚫 /ban — حظر عضو (مشرف)
  // ════════════════════════════════════
  bot.command('ban', grpOnly, adminOnly, async ctx => {
    const target = await resolveTarget(ctx);
    if (!target) {
      return ctx.reply(
        '📌 *طريقة الاستخدام:*\n`/ban @user السبب`\nأو رُدَّ على رسالة العضو وأرسل `/ban السبب`',
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }
    const reason = getReason(ctx, ctx.message?.reply_to_message ? 1 : 2);
    await banMember(ctx, ctx.chat.id, target.userId, reason, false);
    ctx.deleteMessage().catch(() => {});
  });

  // ════════════════════════════════════
  // ✅ /unban — رفع الحظر (مشرف)
  // ════════════════════════════════════
  bot.command('unban', grpOnly, adminOnly, async ctx => {
    const target = await resolveTarget(ctx);
    if (!target) {
      return ctx.reply(
        '📌 *طريقة الاستخدام:*\n`/unban @user` أو `/unban userId`',
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }
    await unbanMember(ctx, ctx.chat.id, target.userId);
    ctx.deleteMessage().catch(() => {});
  });

  // ════════════════════════════════════
  // 🗑 /kick — طرد عضو (مشرف)
  // ════════════════════════════════════
  bot.command('kick', grpOnly, adminOnly, async ctx => {
    const target = await resolveTarget(ctx);
    if (!target) {
      return ctx.reply(
        '📌 *طريقة الاستخدام:*\n`/kick @user` أو رُدَّ على رسالة العضو',
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }
    try {
      await ctx.telegram.banChatMember(ctx.chat.id, target.userId);
      await ctx.telegram.unbanChatMember(ctx.chat.id, target.userId); // طرد بدون حظر دائم
      const msg = await ctx.reply(
        `👢 *تم طرد العضو*\n👤 [${target.firstName}](tg://user?id=${target.userId})`,
        { parse_mode: 'Markdown' }
      ).catch(() => null);
      if (msg) setTimeout(() => ctx.deleteMessage(msg.message_id).catch(() => {}), 8000);
    } catch (e) {
      ctx.reply('❌ فشل الطرد: ' + e.message).catch(() => {});
    }
    ctx.deleteMessage().catch(() => {});
  });

  // ════════════════════════════════════
  // 📌 /pin — تثبيت رسالة (مشرف)
  // ════════════════════════════════════
  bot.command('pin', grpOnly, adminOnly, async ctx => {
    if (!ctx.message?.reply_to_message) {
      return ctx.reply('📌 رُدَّ على الرسالة التي تريد تثبيتها وأرسل `/pin`', { parse_mode: 'Markdown' }).catch(() => {});
    }
    try {
      await ctx.telegram.pinChatMessage(ctx.chat.id, ctx.message.reply_to_message.message_id, {
        disable_notification: false,
      });
      const msg = await ctx.reply('📌 *تم تثبيت الرسالة*', { parse_mode: 'Markdown' }).catch(() => null);
      if (msg) setTimeout(() => ctx.deleteMessage(msg.message_id).catch(() => {}), 5000);
    } catch (e) {
      ctx.reply('❌ فشل التثبيت: ' + e.message).catch(() => {});
    }
    ctx.deleteMessage().catch(() => {});
  });

  // ════════════════════════════════════
  // 📌 /unpin — إلغاء تثبيت (مشرف)
  // ════════════════════════════════════
  bot.command('unpin', grpOnly, adminOnly, async ctx => {
    try {
      await ctx.telegram.unpinChatMessage(ctx.chat.id);
      const msg = await ctx.reply('✅ *تم إلغاء التثبيت*', { parse_mode: 'Markdown' }).catch(() => null);
      if (msg) setTimeout(() => ctx.deleteMessage(msg.message_id).catch(() => {}), 5000);
    } catch (e) {
      ctx.reply('❌ ' + e.message).catch(() => {});
    }
    ctx.deleteMessage().catch(() => {});
  });

  // ════════════════════════════════════
  // 🔔 /setwelcome — تعيين رسالة الترحيب (مشرف)
  // ════════════════════════════════════
  bot.command('setwelcome', grpOnly, adminOnly, async ctx => {
    const text = ctx.message.text.replace(/^\/setwelcome\s*/i, '').trim();
    if (!text) {
      return ctx.reply(
        '📝 *طريقة الاستخدام:*\n`/setwelcome رسالتك هنا`\n\n📌 المتغيرات:\n`{name}` الاسم\n`{spec}` التخصص\n`{id}` المعرّف\n`{date}` التاريخ\n`{time}` الوقت',
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }
    await setWelcomeMessage(ctx, ctx.chat.id, text);
    ctx.deleteMessage().catch(() => {});
  });

  // ════════════════════════════════════
  // 🖼 /setwelcomeimg — تعيين صورة الترحيب (مشرف)
  // إرسال مع صورة مرفقة
  // ════════════════════════════════════
  bot.command('setwelcomeimg', grpOnly, adminOnly, async ctx => {
    if (!ctx.message?.reply_to_message?.photo) {
      return ctx.reply(
        '🖼 رُدَّ على صورة وأرسل `/setwelcomeimg` لتعيينها صورة ترحيب',
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }
    const photos = ctx.message.reply_to_message.photo;
    const fileId = photos[photos.length - 1].file_id;
    await setWelcomeImage(ctx, ctx.chat.id, fileId);
    ctx.deleteMessage().catch(() => {});
  });

  // ════════════════════════════════════
  // 🗑 /clearwelcome — مسح إعدادات الترحيب (مشرف)
  // ════════════════════════════════════
  bot.command('clearwelcome', grpOnly, adminOnly, async ctx => {
    await clearWelcome(ctx.chat.id);
    ctx.reply('✅ تم مسح إعدادات الترحيب — سيُستخدم النص الافتراضي').catch(() => {});
    ctx.deleteMessage().catch(() => {});
  });

  // ════════════════════════════════════
  // 🎮 /million — لعبة المليونير (مشرف)
  // ════════════════════════════════════
  bot.command('million', grpOnly, adminOnly, async ctx => {
    return million.showQuestionsPanel(ctx);
  });

  // ════════════════════════════════════
  // ⏹ /stopmillion — إيقاف اللعبة (مشرف)
  // ════════════════════════════════════
  bot.command('stopmillion', grpOnly, async ctx => {
    return million.stopGame(ctx);
  });

  // ════════════════════════════════════
  // ❓ /help — مساعدة القروب (للجميع)
  // ════════════════════════════════════
  bot.command('grouphelp', grpOnly, async ctx => {
    const isAdm = await isAdminOrOwner(ctx, ctx.chat.id);
    let text = `🤖 *أوامر القروب*\n━━━━━━━━━━━━━━━━━━\n\n`;
    text += `📜 /rules — قواعد القروب\n`;
    text += `📊 /stats — إحصائيات *(مشرف)*\n`;
    text += `👥 /all — قائمة الأعضاء *(مشرف)*\n`;
    text += `🏷️ /tag [رسالة] — منشن الكل *(مشرف)*\n`;
    text += `🎮 /million — لعبة المليونير *(مشرف)*\n\n`;

    if (isAdm) {
      text += `*🛡 الإشراف:*\n`;
      text += `/warn @user [سبب] — تحذير\n`;
      text += `/warns @user — عرض التحذيرات\n`;
      text += `/clearwarns @user — مسح التحذيرات\n`;
      text += `/ban @user [سبب] — حظر\n`;
      text += `/unban @user — رفع الحظر\n`;
      text += `/kick @user — طرد\n`;
      text += `/mute @user [دقائق] — إسكات\n`;
      text += `/unmute @user — تفعيل\n`;
      text += `/muteall — إسكات الكل\n`;
      text += `/unmuteall — تفعيل الكل\n`;
      text += `/pin — تثبيت رسالة (رُدَّ عليها)\n`;
      text += `/unpin — إلغاء التثبيت\n\n`;
      text += `*⚙️ الإعدادات:*\n`;
      text += `/setwelcome [نص] — رسالة الترحيب\n`;
      text += `/setwelcomeimg — صورة الترحيب (رُدَّ على صورة)\n`;
      text += `/clearwelcome — مسح الترحيب\n`;
      text += `/setrules [نص] — تعيين القواعد\n`;
    }

    const msg = await ctx.reply(text, { parse_mode: 'Markdown' }).catch(() => null);
    if (msg) setTimeout(() => ctx.deleteMessage(msg.message_id).catch(() => {}), 30000);
    ctx.deleteMessage().catch(() => {});
  });
}

module.exports = setupGroupCommands;
EOF
echo "✅ group_commands.js"

# ── groupNotify.js ─────────────────────────────────
cat > utils/groupNotify.js << 'EOF'
'use strict';
const { all, run } = require('../database/db');

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
  if (!bot || !fileInfo?.specialty_id) return;

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
module.exports = {
  notifyGroupsNewFile,
  notifyGroupsCustom,
  broadcastToSpecialty,
  postToChannel,
  buildAnnouncementMessage,
  sendToGroup,
};
EOF
echo "✅ groupNotify.js"

# ── groupBroadcast.js ──────────────────────────────
cat > utils/groupBroadcast.js << 'EOF'
'use strict';
/**
 * 📣 groupBroadcast.js — نظام بث احترافي للقروبات
 * ─────────────────────────────────────────────────
 * ✅ إرسال فوري أو مجدول
 * ✅ دعم النص + صورة + فيديو + ملف
 * ✅ أزرار Inline
 * ✅ منشن الأعضاء (اختياري)
 * ✅ إحصائيات تفصيلية
 * ✅ Rate limit آمن
 * ✅ Retry تلقائي
 * ✅ تقرير للمالك بعد الانتهاء
 */

const { all, run } = require('../database/db');
const { notifyGroupsCustom } = require('./groupNotify');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ══════════════════════════════════════════════════════════
// 🏗️ بناء رسالة بث احترافية
// ══════════════════════════════════════════════════════════
/**
 * @param {object} opts
 * @param {string} opts.title   - عنوان البث (اختياري)
 * @param {string} opts.body    - نص البث (مطلوب)
 * @param {string} [opts.footer] - ذيل الرسالة
 * @param {boolean} [opts.showDate] - إضافة التاريخ والوقت
 * @returns {string} نص Markdown
 */
function buildBroadcastText({ title, body, footer, showDate = false }) {
  const lines = [];

  if (title) {
    lines.push(`📢 *${title}*`);
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
  }

  lines.push(body);

  if (footer || showDate) {
    lines.push('');
    lines.push('─────────────────────');
    if (footer) lines.push(`_${footer}_`);
    if (showDate) {
      const now = new Date(Date.now() + 3600000); // UTC+1 Algeria
      const dt  = now.toLocaleString('ar-DZ', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
      lines.push(`🕐 _${dt}_`);
    }
  }

  return lines.join('\n');
}

// ══════════════════════════════════════════════════════════
// 📤 إرسال بث لجميع القروبات
// ══════════════════════════════════════════════════════════
/**
 * @param {object} bot - Telegraf bot instance
 * @param {object} opts
 * @param {string}  opts.text         - نص الرسالة
 * @param {string}  [opts.mediaFileId] - file_id لوسائط
 * @param {string}  [opts.mediaType]   - 'photo' | 'video' | 'document'
 * @param {Array}   [opts.buttons]     - [[{ text, url }]]
 * @param {number}  [opts.specialtyId] - بث لتخصص معين فقط
 * @param {boolean} [opts.mentionAll]  - منشن الأعضاء في كل قروب
 * @param {function} [opts.onProgress] - callback(sent, total)
 * @returns {Promise<{sent, fail, fatal, total, duration}>}
 */
async function broadcastToGroups(bot, opts = {}) {
  const {
    text,
    mediaFileId,
    mediaType,
    buttons    = null,
    specialtyId = null,
    mentionAll  = false,
    onProgress  = null,
  } = opts;

  if (!text && !mediaFileId) throw new Error('يجب توفير نص أو وسيط');

  const startTime = Date.now();

  // جلب القروبات المستهدفة
  const groups = specialtyId
    ? await all('SELECT chat_id FROM group_chats WHERE specialty_id=$1', [specialtyId])
    : await all('SELECT chat_id FROM group_chats');

  if (!groups.length) return { sent: 0, fail: 0, fatal: 0, total: 0, duration: 0 };

  let sent = 0, fail = 0, fatal = 0;
  const BATCH = 4;
  const DELAY = 1200; // ms بين batches

  for (let i = 0; i < groups.length; i += BATCH) {
    const chunk = groups.slice(i, i + BATCH);

    await Promise.allSettled(chunk.map(async g => {
      try {
        let fullText = text;

        // منشن الأعضاء إذا طُلب
        if (mentionAll) {
          const members = await all(
            'SELECT user_id, first_name FROM group_members WHERE chat_id=$1 LIMIT 20',
            [g.chat_id]
          ).catch(() => []);

          if (members.length) {
            const mentions = members
              .map(m => `[${(m.first_name || '👤').substring(0, 12)}](tg://user?id=${m.user_id})`)
              .join(' ');
            fullText = fullText + '\n\n' + mentions;
          }
        }

        const extra = {
          parse_mode:               'Markdown',
          disable_web_page_preview: true,
          reply_markup: buttons ? { inline_keyboard: buttons } : undefined,
        };

        if (mediaType === 'photo' && mediaFileId) {
          await bot.telegram.sendPhoto(g.chat_id, mediaFileId, { caption: fullText, ...extra });
        } else if (mediaType === 'video' && mediaFileId) {
          await bot.telegram.sendVideo(g.chat_id, mediaFileId, { caption: fullText, ...extra });
        } else if (mediaType === 'document' && mediaFileId) {
          await bot.telegram.sendDocument(g.chat_id, mediaFileId, { caption: fullText, ...extra });
        } else {
          await bot.telegram.sendMessage(g.chat_id, fullText, extra);
        }

        sent++;
        if (onProgress) onProgress(sent, groups.length);
      } catch (e) {
        fail++;
        const msg = e.message || '';
        if (msg.includes('kicked') || msg.includes('Forbidden') || msg.includes('not found')) {
          fatal++;
          // تنظيف القروب المحظور
          run('UPDATE group_chats SET notify_new_files=0 WHERE chat_id=$1', [g.chat_id]).catch(() => {});
        }
        // Flood wait
        const floodMatch = msg.match(/retry after (\d+)/i);
        if (floodMatch) await sleep((parseInt(floodMatch[1]) + 1) * 1000);
      }
    }));

    if (i + BATCH < groups.length) await sleep(DELAY);
  }

  return {
    sent,
    fail,
    fatal,
    total:    groups.length,
    duration: Math.round((Date.now() - startTime) / 1000),
  };
}

// ══════════════════════════════════════════════════════════
// 📊 تقرير البث للمالك
// ══════════════════════════════════════════════════════════
function buildBroadcastReport(stats, title = 'بث') {
  const { sent, fail, fatal, total, duration } = stats;
  const rate = total > 0 ? Math.round(sent / total * 100) : 0;

  return (
    `📊 *تقرير البث: ${title}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📨 إجمالي القروبات: *${total}*\n` +
    `✅ نجح: *${sent}* (${rate}%)\n` +
    `❌ فشل: *${fail}*\n` +
    `🚫 محظورة/محذوفة: *${fatal}*\n` +
    `⏱ المدة: *${duration} ثانية*`
  );
}

// ══════════════════════════════════════════════════════════
// 📋 معاينة الرسالة قبل الإرسال
// ══════════════════════════════════════════════════════════
async function previewBroadcast(ctx, text, buttons = null) {
  const extra = {
    parse_mode:   'Markdown',
    reply_markup: buttons
      ? { inline_keyboard: buttons }
      : {
          inline_keyboard: [[
            { text: '✅ إرسال للكل', callback_data: 'bcast_confirm' },
            { text: '❌ إلغاء',      callback_data: 'bcast_cancel'  },
          ]],
        },
  };

  return ctx.reply(
    `👁 *معاينة الرسالة:*\n━━━━━━━━━━━━━━━━━━━━\n\n${text}`,
    extra
  );
}

// ══════════════════════════════════════════════════════════
// 📑 إحصائيات القروبات (للوحة الإدارة)
// ══════════════════════════════════════════════════════════
async function getGroupsBroadcastStats() {
  try {
    const [total, active, withSpec] = await Promise.all([
      all('SELECT COUNT(*) AS cnt FROM group_chats').then(r => r[0]?.cnt || 0),
      all('SELECT COUNT(*) AS cnt FROM group_chats WHERE notify_new_files=1').then(r => r[0]?.cnt || 0),
      all('SELECT COUNT(*) AS cnt FROM group_chats WHERE specialty_id IS NOT NULL').then(r => r[0]?.cnt || 0),
    ]);

    return { total, active, withSpec };
  } catch (_) {
    return { total: 0, active: 0, withSpec: 0 };
  }
}

// ══════════════════════════════════════════════════════════
// Exports
// ══════════════════════════════════════════════════════════
module.exports = {
  broadcastToGroups,
  buildBroadcastText,
  buildBroadcastReport,
  previewBroadcast,
  getGroupsBroadcastStats,
};
EOF
echo "✅ groupBroadcast.js"

# ── group_db.js ─────────────────────────────────────
cat > database/group_db.js << 'EOF'
'use strict';
/**
 * 🗄️ database/group_db.js — دوال قاعدة البيانات الخاصة بالقروبات
 * ──────────────────────────────────────────────────────────────
 * تحتاج إنشاء هذه الجداول في db.js :
 *
 *  CREATE TABLE IF NOT EXISTS group_warns (
 *    id         SERIAL PRIMARY KEY,
 *    chat_id    BIGINT NOT NULL,
 *    user_id    BIGINT NOT NULL,
 *    warned_by  BIGINT,
 *    reason     TEXT,
 *    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 *  );
 *
 *  CREATE TABLE IF NOT EXISTS group_bans (
 *    id         SERIAL PRIMARY KEY,
 *    chat_id    BIGINT NOT NULL,
 *    user_id    BIGINT NOT NULL,
 *    banned_by  BIGINT,
 *    reason     TEXT,
 *    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *    updated_at TIMESTAMP,
 *    UNIQUE(chat_id, user_id)
 *  );
 *
 *  ALTER TABLE group_chats ADD COLUMN IF NOT EXISTS rules TEXT;
 *  ALTER TABLE group_chats ADD COLUMN IF NOT EXISTS goodbye_enabled INTEGER DEFAULT 0;
 */

const { run, all, get } = require('./db');

// ══════════════════════════════════════════════════════════
// ⚠️ نظام التحذيرات
// ══════════════════════════════════════════════════════════
const warns = {
  add: (chatId, userId, warnedBy, reason) =>
    run(
      `INSERT INTO group_warns(chat_id, user_id, warned_by, reason, created_at)
       VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP)`,
      [chatId, userId, warnedBy, reason || '']
    ),

  count: async (chatId, userId) => {
    const r = await get(
      'SELECT COUNT(*) AS cnt FROM group_warns WHERE chat_id=$1 AND user_id=$2',
      [chatId, userId]
    );
    return parseInt(r?.cnt || 0);
  },

  list: (chatId, userId) =>
    all(
      'SELECT * FROM group_warns WHERE chat_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 10',
      [chatId, userId]
    ),

  clear: (chatId, userId) =>
    run('DELETE FROM group_warns WHERE chat_id=$1 AND user_id=$2', [chatId, userId]),

  clearAll: chatId =>
    run('DELETE FROM group_warns WHERE chat_id=$1', [chatId]),
};

// ══════════════════════════════════════════════════════════
// 🚫 نظام الحظر
// ══════════════════════════════════════════════════════════
const bans = {
  add: (chatId, userId, bannedBy, reason) =>
    run(
      `INSERT INTO group_bans(chat_id, user_id, banned_by, reason, created_at)
       VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP)
       ON CONFLICT(chat_id, user_id) DO UPDATE
         SET reason=$4, updated_at=CURRENT_TIMESTAMP`,
      [chatId, userId, bannedBy, reason || '']
    ),

  remove: (chatId, userId) =>
    run('DELETE FROM group_bans WHERE chat_id=$1 AND user_id=$2', [chatId, userId]),

  isBanned: async (chatId, userId) => {
    const r = await get('SELECT 1 FROM group_bans WHERE chat_id=$1 AND user_id=$2', [chatId, userId]);
    return !!r;
  },

  list: chatId =>
    all('SELECT * FROM group_bans WHERE chat_id=$1 ORDER BY created_at DESC', [chatId]),
};

// ══════════════════════════════════════════════════════════
// 📜 قواعد القروب
// ══════════════════════════════════════════════════════════
const rules = {
  get: async chatId => {
    const r = await get('SELECT rules FROM group_chats WHERE chat_id=$1', [chatId]);
    return r?.rules || null;
  },

  set: (chatId, text) =>
    run('UPDATE group_chats SET rules=$1 WHERE chat_id=$2', [text, chatId]),
};

// ══════════════════════════════════════════════════════════
// 👥 الأعضاء
// ══════════════════════════════════════════════════════════
const members = {
  add: (chatId, userId, username, firstName) =>
    run(
      `INSERT INTO group_members(chat_id, user_id, username, first_name, updated_at)
       VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP)
       ON CONFLICT(chat_id, user_id) DO UPDATE
         SET first_name=EXCLUDED.first_name, updated_at=CURRENT_TIMESTAMP`,
      [chatId, userId, username || '', firstName || '']
    ),

  remove: (chatId, userId) =>
    run('DELETE FROM group_members WHERE chat_id=$1 AND user_id=$2', [chatId, userId]),

  list: (chatId, limit = 200) =>
    all(
      'SELECT * FROM group_members WHERE chat_id=$1 ORDER BY updated_at DESC LIMIT $2',
      [chatId, limit]
    ),

  count: async chatId => {
    const r = await get('SELECT COUNT(*) AS cnt FROM group_members WHERE chat_id=$1', [chatId]);
    return parseInt(r?.cnt || 0);
  },
};

// ══════════════════════════════════════════════════════════
// ⚙️ إعدادات القروب
// ══════════════════════════════════════════════════════════
const settings = {
  get: chatId =>
    get('SELECT * FROM group_chats WHERE chat_id=$1', [chatId]),

  setSpecialty: (chatId, specialtyId) =>
    run('UPDATE group_chats SET specialty_id=$1 WHERE chat_id=$2', [specialtyId, chatId]),

  setNotify: (chatId, enabled) =>
    run('UPDATE group_chats SET notify_new_files=$1 WHERE chat_id=$2', [enabled ? 1 : 0, chatId]),

  setGoodbye: (chatId, enabled) =>
    run('UPDATE group_chats SET goodbye_enabled=$1 WHERE chat_id=$2', [enabled ? 1 : 0, chatId]),

  listAll: () =>
    all('SELECT * FROM group_chats ORDER BY title'),

  listActive: () =>
    all('SELECT * FROM group_chats WHERE notify_new_files=1 ORDER BY title'),
};

// ══════════════════════════════════════════════════════════
// 🏗️ migration — إنشاء الجداول الجديدة إن لم تكن موجودة
// ══════════════════════════════════════════════════════════
async function migrateGroupTables() {
  const queries = [
    // جدول التحذيرات
    `CREATE TABLE IF NOT EXISTS group_warns (
       id         SERIAL PRIMARY KEY,
       chat_id    BIGINT NOT NULL,
       user_id    BIGINT NOT NULL,
       warned_by  BIGINT,
       reason     TEXT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE INDEX IF NOT EXISTS idx_group_warns_user ON group_warns(chat_id, user_id)`,

    // جدول الحظر
    `CREATE TABLE IF NOT EXISTS group_bans (
       id         SERIAL PRIMARY KEY,
       chat_id    BIGINT NOT NULL,
       user_id    BIGINT NOT NULL,
       banned_by  BIGINT,
       reason     TEXT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP,
       UNIQUE(chat_id, user_id)
     )`,
    `CREATE INDEX IF NOT EXISTS idx_group_bans_user ON group_bans(chat_id, user_id)`,

    // أعمدة جديدة في group_chats
    `ALTER TABLE group_chats ADD COLUMN IF NOT EXISTS rules           TEXT`,
    `ALTER TABLE group_chats ADD COLUMN IF NOT EXISTS goodbye_enabled INTEGER DEFAULT 0`,
  ];

  for (const q of queries) {
    await run(q, []).catch(e => {
      // تجاهل أخطاء "already exists"
      if (!e.message?.includes('already exists') && !e.message?.includes('duplicate')) {
        console.error('[GroupDB Migration]', e.message);
      }
    });
  }

  console.log('✅ [GroupDB] Migration complete');
}

module.exports = { warns, bans, rules, members, settings, migrateGroupTables };
EOF
echo "✅ group_db.js"

# ── syntax check ────────────────────────────────
echo ""
echo "🔍 فحص الـ syntax..."
node --check handlers/group_admin.js    && echo "✅ group_admin.js OK"    || echo "❌ group_admin.js ERROR"
node --check handlers/group_commands.js && echo "✅ group_commands.js OK" || echo "❌ group_commands.js ERROR"
node --check utils/groupNotify.js       && echo "✅ groupNotify.js OK"    || echo "❌ groupNotify.js ERROR"
node --check utils/groupBroadcast.js    && echo "✅ groupBroadcast.js OK" || echo "❌ groupBroadcast.js ERROR"
node --check database/group_db.js       && echo "✅ group_db.js OK"       || echo "❌ group_db.js ERROR"

echo ""
echo "🎉 تم التنصيب!"
