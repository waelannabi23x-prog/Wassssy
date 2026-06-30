'use strict';
/**
 * 🚀 handlers/group_advanced.js — ميزات الإدارة المتقدمة
 * ──────────────────────────────────────────────────────────────
 * ميزات جديدة كلياً غير موجودة في الكود الحالي:
 *
 *  1. 🐢 /slowmode [ثواني]     — وضع الكتابة البطيئة
 *  2. 🛡 /antiraid on/off/set  — مكافحة غزو القروبات
 *  3. ⏰ /tempban @user 1h      — حظر مؤقت بمدة محددة
 *  4. 📝 /note اسم | رسالة     — ملاحظات القروب
 *     /notes                   — عرض كل الملاحظات
 *     /delnote اسم             — حذف ملاحظة
 *  5. 🚨 /report (رد)          — الإبلاغ عن مستخدم (يُرسل للمشرفين)
 *  6. 🌍 /gban @user سبب       — حظر عالمي (Owner فقط)
 *     /ungban @user            — رفع الحظر العالمي
 *  7. 📅 /schedule HH:MM رسالة — جدولة رسالة مرة واحدة
 *  8. 🔇 /muteall & /unmuteall — (محسّن مع تأكيد)
 *  9. 👁 /watching @user        — مراقبة عضو (كل رسائله لأدمن)
 *     /unwatch @user
 * 10. 📊 /activity              — نشاط الأعضاء آخر 7 أيام
 */

const { run, get, all } = require('../database/db');
const { cacheGet, cacheSet, cacheClear } = require('../utils/cache');
const logger = require('../utils/logger');

const OWNER_ID = parseInt(process.env.OWNER_ID || '0');

// ══════════════════════════════════════════════════════════
// 🔧 مساعدات
// ══════════════════════════════════════════════════════════
function isGroup(ctx) { return ['group', 'supergroup'].includes(ctx.chat?.type); }

async function isTgAdmin(ctx) {
  if (ctx.isOwner || ctx.isAdmin) return true;
  try {
    const m = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
    return ['administrator', 'creator'].includes(m?.status);
  } catch { return false; }
}

function delCmd(ctx) { setTimeout(() => ctx.deleteMessage().catch(() => {}), 1200); }

function tempMsg(ctx, text, delay = 8000, opts = {}) {
  ctx.reply(text, { parse_mode: 'Markdown', ...opts })
    .then(m => { if (m && delay) setTimeout(() => ctx.telegram.deleteMessage(ctx.chat.id, m.message_id).catch(() => {}), delay); })
    .catch(() => {});
}

async function getTarget(ctx) {
  const msg = ctx.message;
  if (msg.reply_to_message?.from) {
    const u = msg.reply_to_message.from;
    return { id: u.id, name: u.first_name || 'مستخدم', fromReply: true };
  }
  const args = msg.text?.split(' ').slice(1) || [];
  if (!args.length) return null;
  const raw = args[0];
  if (/^\d+$/.test(raw)) return { id: parseInt(raw), name: 'ID:' + raw };
  if (raw.startsWith('@')) {
    try {
      const u = await ctx.telegram.getChatMember(ctx.chat.id, raw);
      return { id: u.user?.id, name: u.user?.first_name || raw };
    } catch { return null; }
  }
  return null;
}

// تحليل المدة: 10m / 2h / 1d → ثواني
function parseDurationSec(arg) {
  if (!arg) return 600;
  const m = arg.match(/^(\d+)(s|m|h|d)?$/i);
  if (!m) return 600;
  const n = parseInt(m[1]);
  const u = (m[2] || 'm').toLowerCase();
  if (u === 's') return n;
  if (u === 'm') return n * 60;
  if (u === 'h') return n * 3600;
  if (u === 'd') return n * 86400;
  return 600;
}

function formatDur(secs) {
  if (secs < 60) return secs + 'ث';
  if (secs < 3600) return Math.floor(secs / 60) + 'د';
  if (secs < 86400) return Math.floor(secs / 3600) + 'س';
  return Math.floor(secs / 86400) + 'ي';
}

// ══════════════════════════════════════════════════════════
// ── Auto-Migrate جداول جديدة ──────────────────────────────
// ══════════════════════════════════════════════════════════
async function migrateAdvanced() {
  await Promise.all([
    // ملاحظات القروب
    run(`CREATE TABLE IF NOT EXISTS group_notes (
      id SERIAL PRIMARY KEY,
      chat_id BIGINT NOT NULL,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_by BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`).then(() => run(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'group_notes_chat_name_unique'
        ) THEN
          ALTER TABLE group_notes ADD CONSTRAINT group_notes_chat_name_unique UNIQUE(chat_id, name);
        END IF;
      END $$;
    `).catch(() => {})),
    run('CREATE INDEX IF NOT EXISTS idx_group_notes ON group_notes(chat_id)'),

    // حظر عالمي
    run(`CREATE TABLE IF NOT EXISTS global_bans (
      user_id BIGINT PRIMARY KEY,
      reason TEXT,
      banned_by BIGINT,
      banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`),

    // رسائل مجدولة
    run(`CREATE TABLE IF NOT EXISTS group_schedules (
      id SERIAL PRIMARY KEY,
      chat_id BIGINT NOT NULL,
      message TEXT NOT NULL,
      send_at TIMESTAMP NOT NULL,
      created_by BIGINT,
      sent BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`),
    run('CREATE INDEX IF NOT EXISTS idx_group_schedules ON group_schedules(sent, send_at)'),

    // إبلاغات الأعضاء
    run(`CREATE TABLE IF NOT EXISTS group_reports (
      id SERIAL PRIMARY KEY,
      chat_id BIGINT NOT NULL,
      reporter_id BIGINT NOT NULL,
      target_id BIGINT,
      message_id BIGINT,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`),
    run('CREATE INDEX IF NOT EXISTS idx_group_reports ON group_reports(chat_id, status)'),

    // مراقبة الأعضاء
    run(`CREATE TABLE IF NOT EXISTS group_watching (
      chat_id BIGINT NOT NULL,
      user_id BIGINT NOT NULL,
      admin_id BIGINT NOT NULL,
      PRIMARY KEY(chat_id, user_id)
    )`),

    // حظر مؤقت — تتبع
    run(`CREATE TABLE IF NOT EXISTS group_tempbans (
      id SERIAL PRIMARY KEY,
      chat_id BIGINT NOT NULL,
      user_id BIGINT NOT NULL,
      unban_at TIMESTAMP NOT NULL,
      reason TEXT,
      UNIQUE(chat_id, user_id)
    )`),

    // إعدادات Anti-Raid
    run(`ALTER TABLE group_chats ADD COLUMN IF NOT EXISTS antiraid_enabled BOOLEAN DEFAULT FALSE`),
    run(`ALTER TABLE group_chats ADD COLUMN IF NOT EXISTS antiraid_threshold INT DEFAULT 10`),
    run(`ALTER TABLE group_chats ADD COLUMN IF NOT EXISTS antiraid_window INT DEFAULT 30`),
    run(`ALTER TABLE group_chats ADD COLUMN IF NOT EXISTS antiraid_action TEXT DEFAULT 'kick'`),
    run(`ALTER TABLE group_chats ADD COLUMN IF NOT EXISTS slowmode_seconds INT DEFAULT 0`),
  ]).catch(e => logger.debug('[migrateAdvanced]', e.message));
}
migrateAdvanced();

// ══════════════════════════════════════════════════════════
// 1. 🐢 وضع الكتابة البطيئة /slowmode
// ══════════════════════════════════════════════════════════
async function cmdSlowmode(ctx) {
  if (!isGroup(ctx)) return;
  if (!await isTgAdmin(ctx)) return tempMsg(ctx, '🚫 للمشرفين فقط', 5000);
  delCmd(ctx);

  const args = ctx.message.text.split(' ').slice(1);
  const sec = args[0] ? parseDurationSec(args[0]) : 0;

  // حد تيليجرام: 0 (إيقاف) أو 1–86400 ثانية
  const clamped = Math.min(Math.max(sec, 0), 86400);

  try {
    await ctx.telegram.setChatPermissions(ctx.chat.id, {
      can_send_messages: true,
      can_send_media_messages: true,
      can_send_other_messages: true,
      can_add_web_page_previews: true,
    });
    // Telegraf API — setChatSlowModeDelay
    await ctx.telegram.callApi('setChatSlowModeDelay', {
      chat_id: ctx.chat.id,
      seconds: clamped,
    });
    await run('UPDATE group_chats SET slowmode_seconds=$1 WHERE chat_id=$2', [clamped, ctx.chat.id]).catch(() => {});

    if (clamped === 0) {
      tempMsg(ctx, '🐢 *تم إيقاف وضع الكتابة البطيئة*', 8000);
    } else {
      tempMsg(ctx, `🐢 *وضع الكتابة البطيئة:* ${formatDur(clamped)} بين كل رسالة\n\nلإيقافه: \`/slowmode 0\``, 10000);
    }
  } catch (e) {
    tempMsg(ctx, '❌ فشل: ' + e.message, 5000);
  }
}

// ══════════════════════════════════════════════════════════
// 2. 🛡 Anti-Raid — مكافحة الغزو الجماعي
// ══════════════════════════════════════════════════════════
const _raidTracker = new Map(); // chatId -> { joins: [{uid, ts}], lockUntil? }

async function checkAntiRaid(bot, chatId, userId) {
  const settings = await get('SELECT antiraid_enabled, antiraid_threshold, antiraid_window, antiraid_action FROM group_chats WHERE chat_id=$1', [chatId]).catch(() => null);
  if (!settings?.antiraid_enabled) return false;

  const threshold = settings.antiraid_threshold || 10;
  const window = (settings.antiraid_window || 30) * 1000; // بالميلي ثانية
  const action = settings.antiraid_action || 'kick';
  const now = Date.now();

  let tracker = _raidTracker.get(chatId);
  if (!tracker) { tracker = { joins: [] }; _raidTracker.set(chatId, tracker); }

  // تنظيف القديم
  tracker.joins = tracker.joins.filter(j => now - j.ts < window);
  tracker.joins.push({ uid: userId, ts: now });

  if (tracker.joins.length >= threshold) {
    // تفعيل وضع Anti-Raid
    if (!tracker.lockUntil || now > tracker.lockUntil) {
      tracker.lockUntil = now + 300000; // قفل 5 دقائق
      try {
        // قيّد القروب — لا أعضاء جدد يستطيعون الكتابة
        await bot.telegram.setChatPermissions(chatId, {
          can_send_messages: false,
          can_send_media_messages: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false,
        });
        await bot.telegram.sendMessage(chatId,
          '🚨 *تنبيه! تم رصد محاولة غزو للقروب!*\n\n' +
          '🛡 تم تفعيل وضع الطوارئ تلقائياً\n' +
          '⏰ سيُرفع القيد بعد 5 دقائق\n\n' +
          '_يمكن للمشرفين رفعه يدوياً بـ `/antiraid off`_',
          { parse_mode: 'Markdown' }
        );
        logger.warn('[AntiRaid] Raid detected in', chatId, '— locked');
      } catch (e) {
        logger.error('[AntiRaid] Lock failed:', e.message);
      }

      // رفع القيد تلقائياً بعد 5 دقائق
      setTimeout(async () => {
        try {
          await bot.telegram.setChatPermissions(chatId, {
            can_send_messages: true,
            can_send_media_messages: true,
            can_send_other_messages: true,
            can_add_web_page_previews: true,
          });
          await bot.telegram.sendMessage(chatId, '✅ *رُفع قيد الطوارئ. القروب عاد للوضع الطبيعي.*', { parse_mode: 'Markdown' });
        } catch (_) {}
      }, 300000);
    }

    // كيك/حظر العضو الجديد حسب الإعداد
    if (action === 'kick' || action === 'ban') {
      try {
        await bot.telegram.banChatMember(chatId, userId);
        if (action === 'kick') await bot.telegram.unbanChatMember(chatId, userId);
      } catch (_) {}
    }
    return true;
  }
  return false;
}

async function cmdAntiRaid(ctx) {
  if (!isGroup(ctx)) return;
  if (!await isTgAdmin(ctx)) return tempMsg(ctx, '🚫 للمشرفين فقط', 5000);
  delCmd(ctx);

  const args = ctx.message.text.split(' ').slice(1);
  const sub = args[0]?.toLowerCase();

  if (!sub || sub === 'status') {
    const g = await get('SELECT antiraid_enabled, antiraid_threshold, antiraid_window, antiraid_action FROM group_chats WHERE chat_id=$1', [ctx.chat.id]).catch(() => null);
    const on = g?.antiraid_enabled;
    const txt =
      '🛡 *Anti-Raid — مكافحة الغزو*\n━━━━━━━━━━━━━━━\n\n' +
      'الحالة: ' + (on ? '✅ مفعّل' : '❌ موقوف') + '\n' +
      (on ? `العتبة: *${g.antiraid_threshold || 10}* عضو في *${g.antiraid_window || 30}* ثانية\n` : '') +
      (on ? `الإجراء: *${g.antiraid_action || 'kick'}*\n\n` : '\n') +
      '⚙️ الأوامر:\n' +
      '`/antiraid on` — تفعيل\n' +
      '`/antiraid off` — إيقاف\n' +
      '`/antiraid set 10 30 kick` — عتبة، نافذة(ث)، إجراء (kick/ban)\n';
    const kb = { inline_keyboard: [[
      { text: on ? '🔴 إيقاف' : '🟢 تفعيل', callback_data: 'adv_antiraid_toggle_' + ctx.chat.id },
    ]]};
    return ctx.reply(txt, { parse_mode: 'Markdown', reply_markup: kb }).catch(() => {});
  }

  if (sub === 'on' || sub === 'off') {
    const enabled = sub === 'on';
    await run('UPDATE group_chats SET antiraid_enabled=$1 WHERE chat_id=$2', [enabled, ctx.chat.id]).catch(() => {});
    return tempMsg(ctx, enabled ? '🛡 *تم تفعيل Anti-Raid*' : '❌ *تم إيقاف Anti-Raid*', 8000);
  }

  if (sub === 'set') {
    const threshold = parseInt(args[1]) || 10;
    const window = parseInt(args[2]) || 30;
    const action = ['kick', 'ban'].includes(args[3]) ? args[3] : 'kick';
    await run(
      'UPDATE group_chats SET antiraid_threshold=$1, antiraid_window=$2, antiraid_action=$3 WHERE chat_id=$4',
      [threshold, window, action, ctx.chat.id]
    ).catch(() => {});
    return tempMsg(ctx, `✅ *Anti-Raid مُحدَّث:* ${threshold} عضو/${window}ث → ${action}`, 8000);
  }
}

// ══════════════════════════════════════════════════════════
// 3. ⏰ /tempban — حظر مؤقت
// ══════════════════════════════════════════════════════════
async function cmdTempban(ctx) {
  if (!isGroup(ctx)) return;
  if (!await isTgAdmin(ctx)) return tempMsg(ctx, '🚫 للمشرفين فقط', 5000);
  delCmd(ctx);

  const target = await getTarget(ctx);
  if (!target) return tempMsg(ctx, '⚠️ `/tempban @user 1h [سبب]`\nأمثلة: `30m` `2h` `1d`', 8000);

  const args = ctx.message.text.split(' ').slice(target.fromReply ? 1 : 2);
  const durArg = args[0] || '1h';
  const reason = args.slice(1).join(' ') || 'حظر مؤقت';
  const secs = parseDurationSec(durArg);
  const unbanAt = new Date(Date.now() + secs * 1000);

  try {
    await ctx.telegram.banChatMember(ctx.chat.id, target.id, { until_date: Math.floor(unbanAt.getTime() / 1000) });
    await run(
      'INSERT INTO group_tempbans(chat_id,user_id,unban_at,reason) VALUES($1,$2,$3,$4) ON CONFLICT(chat_id,user_id) DO UPDATE SET unban_at=$3,reason=$4',
      [ctx.chat.id, target.id, unbanAt, reason]
    ).catch(() => {});

    const m = await ctx.reply(
      `⏰ *حظر مؤقت*\n━━━━━━━━━━━━━━━\n\n` +
      `👤 [${target.name}](tg://user?id=${target.id})\n` +
      `📝 السبب: ${reason}\n` +
      `⏱ المدة: *${formatDur(secs)}*\n` +
      `🔓 يُرفع في: ${unbanAt.toLocaleString('ar-DZ')}`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[
          { text: '🔓 رفع الحظر الآن', callback_data: 'adv_untempban_' + target.id },
          { text: '♾️ تحويل لدائم', callback_data: 'adv_permban_' + target.id },
        ]]}
      }
    ).catch(() => null);
    if (m) setTimeout(() => ctx.telegram.deleteMessage(ctx.chat.id, m.message_id).catch(() => {}), 30000);
  } catch (e) {
    tempMsg(ctx, '❌ فشل: ' + e.message, 5000);
  }
}

// ══════════════════════════════════════════════════════════
// 4. 📝 /note, /notes, /delnote — ملاحظات القروب
// ══════════════════════════════════════════════════════════
async function cmdNote(ctx) {
  if (!isGroup(ctx)) return;
  if (!await isTgAdmin(ctx)) return tempMsg(ctx, '🚫 للمشرفين فقط', 5000);
  delCmd(ctx);

  const text = ctx.message.text.split(' ').slice(1).join(' ').trim();
  const sep = text.indexOf('|');
  if (sep === -1) return tempMsg(ctx, '⚠️ الصيغة: `/note اسم | محتوى الملاحظة`', 8000);

  const name = text.slice(0, sep).trim().toLowerCase();
  const content = text.slice(sep + 1).trim();

  if (!name || !content) return tempMsg(ctx, '⚠️ `/note اسم | محتوى`', 8000);
  if (name.length > 32) return tempMsg(ctx, '⚠️ الاسم أقل من 32 حرف', 5000);

  await run(
    'INSERT INTO group_notes(chat_id,name,content,created_by) VALUES($1,$2,$3,$4) ON CONFLICT(chat_id,name) DO UPDATE SET content=$3,created_by=$4',
    [ctx.chat.id, name, content, ctx.from.id]
  ).catch(() => {});
  tempMsg(ctx, `✅ *تم حفظ الملاحظة:* \`${name}\`\nاستدعها بـ \`#${name}\``, 8000);
}

async function cmdNotes(ctx) {
  if (!isGroup(ctx)) return;
  delCmd(ctx);

  const notes = await all('SELECT name, created_at FROM group_notes WHERE chat_id=$1 ORDER BY name', [ctx.chat.id]).catch(() => []);
  if (!notes.length) return tempMsg(ctx, '📝 *لا توجد ملاحظات محفوظة*\n\nأضف بـ `/note اسم | محتوى`', 10000);

  let txt = '📝 *ملاحظات القروب*\n━━━━━━━━━━━━━━━\n\n';
  notes.forEach((n, i) => {
    txt += `${i + 1}. \`#${n.name}\`\n`;
  });
  txt += `\n_استدعِ ملاحظة بكتابة \`#اسم\` في القروب_`;

  const kb = notes.slice(0, 10).map(n => [{ text: '#' + n.name, callback_data: 'adv_note_show_' + n.name.slice(0, 20) }]);
  ctx.reply(txt, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } }).catch(() => {});
}

async function cmdDelnote(ctx) {
  if (!isGroup(ctx)) return;
  if (!await isTgAdmin(ctx)) return tempMsg(ctx, '🚫 للمشرفين فقط', 5000);
  delCmd(ctx);

  const name = ctx.message.text.split(' ').slice(1).join(' ').trim().toLowerCase();
  if (!name) return tempMsg(ctx, '⚠️ `/delnote اسم`', 5000);

  const res = await run('DELETE FROM group_notes WHERE chat_id=$1 AND name=$2', [ctx.chat.id, name]).catch(() => null);
  tempMsg(ctx, res ? `🗑 *حُذفت الملاحظة:* \`${name}\`` : `❌ لا توجد ملاحظة بهذا الاسم`, 6000);
}

// استدعاء تلقائي بـ #اسم
async function handleHashNote(ctx) {
  if (!isGroup(ctx)) return false;
  const txt = ctx.message?.text || '';
  const match = txt.match(/^#([a-zA-Z0-9_\u0600-\u06FF]{1,32})/);
  if (!match) return false;

  const name = match[1].toLowerCase();
  const note = await get('SELECT content FROM group_notes WHERE chat_id=$1 AND name=$2', [ctx.chat.id, name]).catch(() => null);
  if (!note) return false;

  ctx.reply(note.content, {
    reply_to_message_id: ctx.message.message_id,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  }).catch(() => {});
  return true;
}

// ══════════════════════════════════════════════════════════
// 5. 🚨 /report — الإبلاغ عن مستخدم
// ══════════════════════════════════════════════════════════
const _reportCooldown = new Map(); // uid_chatId -> timestamp

async function cmdReport(ctx) {
  if (!isGroup(ctx)) return;
  delCmd(ctx);

  const uid = ctx.from.id;
  const chatId = ctx.chat.id;
  const ck = uid + '_' + chatId;
  const lastReport = _reportCooldown.get(ck);
  if (lastReport && Date.now() - lastReport < 300000) {
    return tempMsg(ctx, '⏳ يمكنك الإبلاغ مرة كل 5 دقائق', 5000);
  }

  const rep = ctx.message.reply_to_message;
  if (!rep) return tempMsg(ctx, '↩️ *رد على الرسالة التي تريد الإبلاغ عنها*', 5000);

  const target = rep.from;
  if (!target || target.is_bot) return tempMsg(ctx, '❌ لا يمكن الإبلاغ عن بوت', 5000);
  if (target.id === uid) return tempMsg(ctx, '🤦 لا يمكنك الإبلاغ عن نفسك', 5000);

  const reason = ctx.message.text.split(' ').slice(1).join(' ') || 'لم يُذكر سبب';

  await run(
    'INSERT INTO group_reports(chat_id,reporter_id,target_id,message_id,reason) VALUES($1,$2,$3,$4,$5)',
    [chatId, uid, target.id, rep.message_id, reason]
  ).catch(() => {});
  _reportCooldown.set(ck, Date.now());

  // إشعار المشرفين
  const reporterName = ctx.from.first_name || 'عضو';
  const targetName = target.first_name || 'مستخدم';

  const adminAlert =
    `🚨 *بلاغ جديد!*\n━━━━━━━━━━━━━━━\n\n` +
    `📢 المُبلِّغ: [${reporterName}](tg://user?id=${uid})\n` +
    `🎯 المُبلَّغ عنه: [${targetName}](tg://user?id=${target.id})\n` +
    `📝 السبب: ${reason}\n` +
    `🔗 [الرسالة المُبلَّغ عنها](https://t.me/c/${String(chatId).replace('-100', '')}/${rep.message_id})`;

  // احصل على المشرفين وأرسل لهم رسالة خاصة
  try {
    const admins = await ctx.telegram.getChatAdministrators(chatId);
    for (const adm of admins) {
      if (adm.user?.is_bot) continue;
      ctx.telegram.sendMessage(adm.user.id, adminAlert, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[
          { text: '🚫 حظر', callback_data: `adv_report_ban_${target.id}_${chatId}` },
          { text: '🔇 كتم ساعة', callback_data: `adv_report_mute_${target.id}_${chatId}` },
          { text: '✅ تجاهل', callback_data: `adv_report_ignore` },
        ]]}
      }).catch(() => {});
    }
  } catch (_) {}

  tempMsg(ctx, '✅ *تم إرسال بلاغك للمشرفين*\nسيتم مراجعته قريباً.', 8000);
}

// ══════════════════════════════════════════════════════════
// 6. 🌍 /gban — حظر عالمي (Owner فقط)
// ══════════════════════════════════════════════════════════
async function cmdGban(ctx) {
  if (ctx.from.id !== OWNER_ID) return;
  delCmd(ctx);

  const target = await getTarget(ctx);
  if (!target) return tempMsg(ctx, '⚠️ `/gban @user سبب`', 5000);
  const reason = ctx.message.text.split(' ').slice(target.fromReply ? 1 : 2).join(' ') || 'حظر عالمي';

  await run(
    'INSERT INTO global_bans(user_id,reason,banned_by) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET reason=$2',
    [target.id, reason, ctx.from.id]
  ).catch(() => {});
  cacheSet('gban_' + target.id, true, 300000);

  ctx.reply(
    `🌍 *حظر عالمي*\n👤 [${target.name}](tg://user?id=${target.id})\n📝 ${reason}`,
    { parse_mode: 'Markdown' }
  ).catch(() => {});
}

async function cmdUngban(ctx) {
  if (ctx.from.id !== OWNER_ID) return;
  delCmd(ctx);

  const target = await getTarget(ctx);
  if (!target) return tempMsg(ctx, '⚠️ `/ungban @user`', 5000);

  await run('DELETE FROM global_bans WHERE user_id=$1', [target.id]).catch(() => {});
  cacheClear('gban_' + target.id);
  tempMsg(ctx, `✅ *رُفع الحظر العالمي عن [${target.name}](tg://user?id=${target.id})*`, 8000);
}

// فحص الحظر العالمي عند الانضمام
async function checkGlobalBan(bot, chatId, userId) {
  let banned = cacheGet('gban_' + userId);
  if (banned === null) {
    const row = await get('SELECT reason FROM global_bans WHERE user_id=$1', [userId]).catch(() => null);
    banned = !!row;
    cacheSet('gban_' + userId, banned, 300000);
    if (banned) {
      try {
        await bot.telegram.banChatMember(chatId, userId);
        logger.info(`[GBan] Auto-banned ${userId} from ${chatId}`);
      } catch (_) {}
    }
  }
  return banned;
}

// ══════════════════════════════════════════════════════════
// 7. 📅 /schedule — جدولة رسائل
// ══════════════════════════════════════════════════════════
async function cmdSchedule(ctx) {
  if (!isGroup(ctx)) return;
  if (!await isTgAdmin(ctx)) return tempMsg(ctx, '🚫 للمشرفين فقط', 5000);
  delCmd(ctx);

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) {
    return tempMsg(ctx,
      '⏰ *جدولة رسالة*\n\n' +
      'الصيغة: `/schedule HH:MM رسالة`\n' +
      'مثال: `/schedule 14:30 تذكير: اجتماع القروب!`\n\n' +
      '_يُرسل اليوم في الوقت المحدد (توقيت الجزائر +01:00)_',
      12000
    );
  }

  const timeStr = args[0];
  const msg = args.slice(1).join(' ').trim();
  const [hh, mm] = timeStr.split(':').map(Number);

  if (isNaN(hh) || isNaN(mm) || hh > 23 || mm > 59) {
    return tempMsg(ctx, '❌ صيغة الوقت غلط. استخدم HH:MM مثل `14:30`', 5000);
  }

  // حساب الوقت المجدول بتوقيت الجزائر
  const now = new Date(Date.now() + 3600000); // UTC+1
  const target = new Date(now);
  target.setUTCHours(hh - 1, mm, 0, 0); // رجع UTC
  if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1); // غداً

  await run(
    'INSERT INTO group_schedules(chat_id,message,send_at,created_by) VALUES($1,$2,$3,$4)',
    [ctx.chat.id, msg, target, ctx.from.id]
  ).catch(() => {});

  tempMsg(ctx,
    `✅ *تمت الجدولة!*\n\n` +
    `⏰ الإرسال في: *${timeStr}* (توقيت الجزائر)\n` +
    `📝 الرسالة: _${msg.slice(0, 60)}${msg.length > 60 ? '...' : ''}_`,
    10000
  );
}

// تشغيل مُرسِل الجدولة (يُستدعى مرة كل دقيقة)
let _scheduleTimer = null;
function startScheduleWatcher(bot) {
  if (_scheduleTimer) return;
  _scheduleTimer = setInterval(async () => {
    try {
      const pending = await all(
        'SELECT * FROM group_schedules WHERE sent=FALSE AND send_at <= NOW()',
        []
      ).catch(() => []);

      for (const s of pending) {
        try {
          await bot.telegram.sendMessage(s.chat_id, s.message, { parse_mode: 'Markdown' });
          await run('UPDATE group_schedules SET sent=TRUE WHERE id=$1', [s.id]).catch(() => {});
          logger.info('[Schedule] Sent scheduled message to', s.chat_id);
        } catch (e) {
          logger.error('[Schedule] Failed:', e.message);
          await run('UPDATE group_schedules SET sent=TRUE WHERE id=$1', [s.id]).catch(() => {}); // منع loop
        }
      }
    } catch (e) {
      logger.error('[ScheduleWatcher]', e.message);
    }
  }, 60000);
  logger.info('[Schedule] Watcher started');
}

// ══════════════════════════════════════════════════════════
// 8. 👁 /watching — مراقبة عضو
// ══════════════════════════════════════════════════════════
async function cmdWatch(ctx) {
  if (!isGroup(ctx)) return;
  if (!await isTgAdmin(ctx)) return tempMsg(ctx, '🚫 للمشرفين فقط', 5000);
  delCmd(ctx);

  const target = await getTarget(ctx);
  if (!target) return tempMsg(ctx, '⚠️ رد على رسالة العضو أو `/watching @user`', 5000);

  await run(
    'INSERT INTO group_watching(chat_id,user_id,admin_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
    [ctx.chat.id, target.id, ctx.from.id]
  ).catch(() => {});
  tempMsg(ctx, `👁 *تم تفعيل المراقبة على [${target.name}](tg://user?id=${target.id})*\nستصلك رسائله في الخاص.`, 8000);
}

async function cmdUnwatch(ctx) {
  if (!isGroup(ctx)) return;
  if (!await isTgAdmin(ctx)) return tempMsg(ctx, '🚫 للمشرفين فقط', 5000);
  delCmd(ctx);

  const target = await getTarget(ctx);
  if (!target) return tempMsg(ctx, '⚠️ `/unwatch @user`', 5000);

  await run('DELETE FROM group_watching WHERE chat_id=$1 AND user_id=$2', [ctx.chat.id, target.id]).catch(() => {});
  tempMsg(ctx, `✅ *إلغاء مراقبة [${target.name}](tg://user?id=${target.id})*`, 5000);
}

// Middleware مراقبة — يُستدعى من الرسائل
async function runWatchMiddleware(bot, ctx) {
  if (!isGroup(ctx) || !ctx.from || !ctx.message) return;
  try {
    const watchers = await all(
      'SELECT admin_id FROM group_watching WHERE chat_id=$1 AND user_id=$2',
      [ctx.chat.id, ctx.from.id]
    ).catch(() => []);
    if (!watchers.length) return;

    const name = ctx.from.first_name || 'مستخدم';
    const txt = ctx.message.text || ctx.message.caption || '[وسائط]';
    const alertText =
      `👁 *مراقبة — رسالة جديدة*\n━━━━━━━━━━━━\n\n` +
      `👤 [${name}](tg://user?id=${ctx.from.id})\n` +
      `💬 ${txt.slice(0, 200)}\n` +
      `🔗 [عرض في القروب](https://t.me/c/${String(ctx.chat.id).replace('-100', '')}/${ctx.message.message_id})`;

    for (const w of watchers) {
      bot.telegram.sendMessage(w.admin_id, alertText, { parse_mode: 'Markdown' }).catch(() => {});
    }
  } catch (_) {}
}

// ══════════════════════════════════════════════════════════
// 9. 📊 /activity — نشاط الأعضاء
// ══════════════════════════════════════════════════════════
async function cmdActivity(ctx) {
  if (!isGroup(ctx)) return;
  if (!await isTgAdmin(ctx)) return tempMsg(ctx, '🚫 للمشرفين فقط', 5000);
  delCmd(ctx);

  // نجمع الإحصائيات من group_members
  const active = await all(
    `SELECT gm.user_id, gm.first_name, gm.msg_count
     FROM group_members gm
     WHERE gm.chat_id=$1 AND gm.updated_at >= NOW() - INTERVAL '7 days'
     ORDER BY gm.msg_count DESC LIMIT 10`,
    [ctx.chat.id]
  ).catch(() => []);

  // تحذيرات الأسبوع الماضي
  const warnings = await all(
    `SELECT COUNT(*) as cnt FROM group_warns WHERE chat_id=$1 AND created_at >= NOW() - INTERVAL '7 days'`,
    [ctx.chat.id]
  ).catch(() => [{ cnt: 0 }]);

  // أعضاء جدد
  const newMembers = await all(
    `SELECT COUNT(*) as cnt FROM group_members WHERE chat_id=$1 AND joined_at >= NOW() - INTERVAL '7 days'`,
    [ctx.chat.id]
  ).catch(() => [{ cnt: 0 }]);

  let txt = '📊 *نشاط القروب — آخر 7 أيام*\n━━━━━━━━━━━━━━━\n\n';
  txt += `⚠️ التحذيرات: *${warnings[0]?.cnt || 0}*\n`;
  txt += `👥 أعضاء جدد: *${newMembers[0]?.cnt || 0}*\n\n`;

  if (active.length) {
    txt += '🏆 *الأكثر نشاطاً:*\n';
    active.forEach((m, i) => {
      const medals = ['🥇', '🥈', '🥉'];
      const badge = medals[i] || `${i + 1}.`;
      txt += `${badge} [${m.first_name || 'مستخدم'}](tg://user?id=${m.user_id}) — *${m.msg_count || 0}* رسالة\n`;
    });
  } else {
    txt += '_لا توجد بيانات نشاط بعد_';
  }

  ctx.reply(txt, { parse_mode: 'Markdown' }).catch(() => {});
}

// ══════════════════════════════════════════════════════════
// Callbacks الأزرار
// ══════════════════════════════════════════════════════════
async function handleAdvancedCallbacks(ctx, data) {
  if (!data.startsWith('adv_')) return false;
  ctx.answerCbQuery('').catch(() => {});

  if (data.startsWith('adv_antiraid_toggle_')) {
    const chatId = data.replace('adv_antiraid_toggle_', '');
    const g = await get('SELECT antiraid_enabled FROM group_chats WHERE chat_id=$1', [chatId]).catch(() => null);
    const newVal = !g?.antiraid_enabled;
    await run('UPDATE group_chats SET antiraid_enabled=$1 WHERE chat_id=$2', [newVal, chatId]).catch(() => {});
    ctx.answerCbQuery(newVal ? '✅ مفعّل' : '❌ موقوف', { show_alert: true }).catch(() => {});
    return ctx.deleteMessage().catch(() => {});
  }

  if (data.startsWith('adv_untempban_')) {
    if (!await isTgAdmin(ctx)) return ctx.answerCbQuery('🚫', { show_alert: true }).catch(() => {});
    const userId = parseInt(data.replace('adv_untempban_', ''));
    try {
      await ctx.telegram.unbanChatMember(ctx.chat.id, userId);
      await run('DELETE FROM group_tempbans WHERE chat_id=$1 AND user_id=$2', [ctx.chat.id, userId]).catch(() => {});
      ctx.answerCbQuery('✅ رُفع الحظر').catch(() => {});
      ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    } catch (e) { ctx.answerCbQuery('❌ ' + e.message, { show_alert: true }).catch(() => {}); }
    return true;
  }

  if (data.startsWith('adv_permban_')) {
    if (!await isTgAdmin(ctx)) return ctx.answerCbQuery('🚫', { show_alert: true }).catch(() => {});
    const userId = parseInt(data.replace('adv_permban_', ''));
    try {
      await ctx.telegram.banChatMember(ctx.chat.id, userId); // بدون until_date = دائم
      await run('DELETE FROM group_tempbans WHERE chat_id=$1 AND user_id=$2', [ctx.chat.id, userId]).catch(() => {});
      ctx.answerCbQuery('✅ تحوّل لحظر دائم').catch(() => {});
    } catch (e) { ctx.answerCbQuery('❌ ' + e.message, { show_alert: true }).catch(() => {}); }
    return true;
  }

  if (data.startsWith('adv_note_show_')) {
    const name = data.replace('adv_note_show_', '');
    const note = await get('SELECT content FROM group_notes WHERE chat_id=$1 AND name=$2', [ctx.chat.id, name]).catch(() => null);
    if (!note) return ctx.answerCbQuery('❌ لا توجد', { show_alert: true }).catch(() => {});
    ctx.reply(`📝 *#${name}*\n\n${note.content}`, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }).catch(() => {});
    return true;
  }

  if (data.startsWith('adv_report_ban_')) {
    const [userId, chatId] = data.replace('adv_report_ban_', '').split('_').map(Number);
    try {
      await ctx.telegram.banChatMember(chatId, userId);
      ctx.answerCbQuery('✅ محظور').catch(() => {});
      ctx.editMessageText(ctx.message.text + '\n\n✅ *تم اتخاذ الإجراء: حظر*', { parse_mode: 'Markdown' }).catch(() => {});
    } catch (e) { ctx.answerCbQuery('❌ ' + e.message, { show_alert: true }).catch(() => {}); }
    return true;
  }

  if (data.startsWith('adv_report_mute_')) {
    const [userId, chatId] = data.replace('adv_report_mute_', '').split('_').map(Number);
    try {
      const until = Math.floor(Date.now() / 1000) + 3600;
      await ctx.telegram.restrictChatMember(chatId, userId, {
        permissions: { can_send_messages: false },
        until_date: until,
      });
      ctx.answerCbQuery('✅ مكتوم ساعة').catch(() => {});
    } catch (e) { ctx.answerCbQuery('❌ ' + e.message, { show_alert: true }).catch(() => {}); }
    return true;
  }

  if (data === 'adv_report_ignore') {
    ctx.answerCbQuery('تم التجاهل').catch(() => {});
    return true;
  }

  return false;
}

// ══════════════════════════════════════════════════════════
// 🔌 تسجيل كل الأوامر
// ══════════════════════════════════════════════════════════
function setupAdvancedCommands(bot) {
  // 1. Slowmode
  bot.command(['slowmode', 'slow', 'بطيء'], ctx => cmdSlowmode(ctx));

  // 2. Anti-Raid
  bot.command(['antiraid', 'raid'], ctx => cmdAntiRaid(ctx));

  // 3. Tempban
  bot.command(['tempban', 'حظر_مؤقت', 'حظرمؤقت'], ctx => cmdTempban(ctx));

  // 4. Notes
  bot.command(['note', 'ملاحظة'], ctx => cmdNote(ctx));
  bot.command(['notes', 'ملاحظات'], ctx => cmdNotes(ctx));
  bot.command(['delnote', 'حذف_ملاحظة', 'delنوت'], ctx => cmdDelnote(ctx));

  // 5. Report
  bot.command(['report', 'بلاغ', 'إبلاغ'], ctx => cmdReport(ctx));

  // 6. GBan (Owner فقط)
  bot.command(['gban', 'حظرعالمي'], ctx => cmdGban(ctx));
  bot.command(['ungban', 'فك_حظرعالمي'], ctx => cmdUngban(ctx));

  // 7. Schedule
  bot.command(['schedule', 'جدولة', 'جدول'], ctx => cmdSchedule(ctx));

  // 8. Watch
  bot.command(['watching', 'watch', 'مراقبة'], ctx => cmdWatch(ctx));
  bot.command(['unwatch', 'stop_watch', 'الغاء_مراقبة'], ctx => cmdUnwatch(ctx));

  // 9. Activity
  bot.command(['activity', 'نشاط', 'احصائيات_النشاط'], ctx => cmdActivity(ctx));

  // #note trigger
  bot.hears(/^#([a-zA-Z0-9_\u0600-\u06FF]{1,32})$/, async ctx => {
    if (!isGroup(ctx)) return;
    await handleHashNote(ctx);
  });

  // Callbacks
  bot.action(/^adv_/, async ctx => {
    const data = ctx.callbackQuery?.data || '';
    await handleAdvancedCallbacks(ctx, data);
  });

  logger.info('[GroupAdvanced] ✅ All advanced commands registered');
}

module.exports = {
  setupAdvancedCommands,
  checkAntiRaid,
  checkGlobalBan,
  runWatchMiddleware,
  startScheduleWatcher,
  handleAdvancedCallbacks,
  handleHashNote,
};
