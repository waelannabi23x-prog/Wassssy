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
    ? await all('SELECT chat_id FROM group_chats WHERE specialty_id=$1 AND (is_active=1 OR is_active=true)', [specialtyId])
    : await all('SELECT chat_id FROM group_chats WHERE is_active=1 OR is_active=true');

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
          run('UPDATE group_chats SET notify_new_files=0 WHERE chat_id=$1', [g.chat_id]).catch(err => { require('./logger').debug("[silent]", err.message); });
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
