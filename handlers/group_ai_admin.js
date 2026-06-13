'use strict';
/**
 * 🤖 handlers/group_ai_admin.js — ذكاء اصطناعي للمشرفين
 * ──────────────────────────────────────────────────────────────
 * - تلخيص نشاط القروب (المخالفات + الأعضاء الأكثر مخالفة).
 * - تحليل المشاكل المتكررة باستخدام الذكاء الاصطناعي (مع fallback
 *   إحصائي إن لم تتوفر مفاتيح AI أو فشل الاتصال).
 */

const db = require('../database/group_pro_db');
const { build: kbBuild, btn: kbBtn } = require('../utils/keyboard');
const { eos } = require('../utils/helpers');
const logger = require('../utils/logger');

async function buildStatsSection(chatId, hours, title) {
  const stats = await db.getViolationStats(chatId, hours);
  if (!stats.length) return { text: '', total: 0 };
  const { violationLabel } = require('./group_protection');
  let text = title + ':\n';
  let total = 0;
  for (const s of stats) {
    text += '• ' + violationLabel(s.type) + ': *' + s.cnt + '*\n';
    total += s.cnt;
  }
  return { text, total };
}

async function buildTopViolatorsText(ctx, chatId) {
  const top = await db.getTopViolators(chatId, 24 * 7, 5);
  if (!top.length) return '';
  let text = '';
  for (const v of top) {
    let name = 'مستخدم ' + v.user_id;
    try {
      const m = await ctx.telegram.getChatMember(chatId, v.user_id);
      if (m?.user?.first_name) name = m.user.first_name;
    } catch (_) {}
    text += '• ' + name + ' — ' + v.cnt + ' مخالفة\n';
  }
  return text;
}

// ══════════════════════════════════════════════════════════
// 🧠 الملخّص الذكي
// ══════════════════════════════════════════════════════════
async function buildSummaryText(ctx, chatId) {
  const [last24, last7d, topText] = await Promise.all([
    buildStatsSection(chatId, 24, '📅 آخر 24 ساعة'),
    buildStatsSection(chatId, 24 * 7, '📆 آخر 7 أيام'),
    buildTopViolatorsText(ctx, chatId),
  ]);

  let text = '🤖 *تحليل نشاط القروب*\n━━━━━━━━━━━━━━━━━━\n\n';

  if (!last7d.total) {
    text += '📭 لا توجد مخالفات مسجّلة حتى الآن.\n_فعّل نظام الحماية من اللوحة الاحترافية للبدء بجمع البيانات._';
    return text;
  }

  text += last24.text ? last24.text + '\n' : '✅ لا مخالفات آخر 24 ساعة\n\n';
  text += last7d.text + '\n';
  if (topText) text += '👤 *الأكثر مخالفة (7 أيام):*\n' + topText + '\n';

  // ── تحليل AI (اختياري مع fallback) ──
  let aiText = '';
  try {
    const { aiChat } = require('../utils/groq_client');
    const prompt =
      'أنت مساعد إدارة قروب تيليجرام عربي. إليك إحصائيات مخالفات آخر 7 أيام:\n' +
      last7d.text.replace(/\*/g, '') +
      (topText ? '\nالأعضاء الأكثر مخالفة:\n' + topText : '') +
      '\n\nاكتب تحليلاً عربياً قصيراً جداً (3 إلى 4 أسطر فقط، بدون عناوين أو رموز Markdown) ' +
      'عن أبرز مشكلة متكررة في هذا القروب، ونصيحة عملية واحدة محددة للمشرفين لتحسينها.';
    const raw = await aiChat([{ role: 'user', content: prompt }], 250, 0.5);
    aiText = (raw || '').trim().replace(/[*_`]/g, '');
  } catch (e) {
    logger.debug('[GroupAIAdmin] AI unavailable: ' + e.message);
  }

  if (aiText) {
    text += '💡 *تحليل الذكاء الاصطناعي:*\n' + aiText;
  } else {
    // Fallback بدون AI: أبرز نوع مخالفة
    const stats = await db.getViolationStats(chatId, 24 * 7);
    if (stats.length) {
      const { violationLabel } = require('./group_protection');
      const top = stats[0];
      text += '💡 *نصيحة:* أكثر مخالفة هي «' + violationLabel(top.type) + '» (' + top.cnt + ' مرة) — ' +
        'يُفضّل تشديد الإجراء المرتبط بها من «⚖️ سلّم العقوبات».';
    }
  }

  return text;
}

async function showSummary(ctx, chatId) {
  if (ctx.callbackQuery) await ctx.answerCbQuery('⏳ جاري التحليل...').catch(() => {});
  else await require('../utils/helpers').showTyping(ctx).catch(() => {});
  const text = await buildSummaryText(ctx, chatId).catch(e => {
    logger.error('[GroupAIAdmin.showSummary] ' + e.message);
    return '❌ تعذّر إجراء التحليل حالياً، حاول لاحقاً.';
  });
  const rows = [[kbBtn('🔄 تحديث', 'gpx_aisummary_' + chatId)], [kbBtn('◀️ رجوع', 'gpx_home_' + chatId)]];
  return eos(ctx, text, { parse_mode: 'Markdown', ...kbBuild(rows) });
}

module.exports = { buildSummaryText, showSummary };
