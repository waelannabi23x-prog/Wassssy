'use strict';
// ══════════════════════════════════════════════════════════════
//  🎮 أكسيو أو فيريتي — نقطة التسجيل الرئيسية
//  يُستدعى من index.js:  require('./handlers/tod').register(bot);
// ══════════════════════════════════════════════════════════════

const engine = require('./engine');
const adminPanel = require('./admin_panel');
const state = require('./state');
const { parseCb } = require('./codec');
const tdb = require('./db');
const logger = require('../../utils/logger');

async function register(bot) {
  await tdb.migrate().catch(e => logger.error('[ToD] migrate: ' + e.message));
  engine.init(bot);

  // ── إنشاء الجلسة ──
  bot.hears(/^صحصح$/i, async (ctx, next) => {
    if (!['group', 'supergroup'].includes(ctx.chat?.type)) return next();
    return engine.createSession(ctx).catch(e => logger.error('[ToD] createSession: ' + e.message));
  });

  // ── الانضمام ("أنا") — لا يتدخل إن لم توجد جلسة تسجيل نشطة ──
  bot.hears(/^[أاآ]نا$/i, async (ctx, next) => {
    if (!['group', 'supergroup'].includes(ctx.chat?.type)) return next();
    return engine.joinSession(ctx, next);
  });

  // ── البدء ──
  bot.hears(/^ابدأ$/i, async (ctx, next) => {
    if (!['group', 'supergroup'].includes(ctx.chat?.type)) return next();
    return engine.startGame(ctx, next);
  });

  // ── الإلغاء (أثناء التسجيل فقط) ──
  bot.hears(/^[إا]لغاء$/i, async (ctx, next) => {
    if (!['group', 'supergroup'].includes(ctx.chat?.type)) return next();
    return engine.cancelSession(ctx, next);
  });

  // ── الإنهاء الإجباري (أثناء اللعب) ──
  bot.hears(/^[إا]نهاء$/i, async (ctx, next) => {
    if (!['group', 'supergroup'].includes(ctx.chat?.type)) return next();
    return engine.forceEnd(ctx, next);
  });

  // ── أوامر مساعدة ──
  bot.command(['tod_rules', 'قوانين_صحصح'], ctx => engine.cmdRules(ctx));
  bot.command(['tod_stats', 'احصائياتي_صحصح'], ctx => engine.cmdStats(ctx));
  bot.command(['tod_settings', 'اعدادات_صحصح'], ctx => adminPanel.openPanelFromGroup(ctx));

  // ── معالجة كل رسائل القروب (تغذية الانتظار + حذف الرسائل الجانبية) ──
  bot.on('message', async (ctx, next) => {
    if (!['group', 'supergroup'].includes(ctx.chat?.type) || !ctx.message?.text) return next();
    try {
      const result = await engine.handleGroupMessage(ctx);
      if (result === 'consumed') return; // تم التعامل معها (حذف أو تسجيل إجابة)
    } catch (e) {
      logger.error('[ToD] handleGroupMessage: ' + e.message);
    }
    return next();
  });

  // ── Callbacks (tod: + todadm:) ──
  bot.on('callback_query', async (ctx, next) => {
    const data = ctx.callbackQuery?.data || '';
    if (data === 'noop') return ctx.answerCbQuery().catch(() => {});

    if (data.startsWith('tod:')) {
      const parsed = parseCb(data);
      if (!parsed) return ctx.answerCbQuery('❌ بيانات غير صالحة.').catch(() => {});
      const session = state.getSession(parsed.chatId);
      if (!session) return ctx.answerCbQuery('⌛ انتهت اللعبة.', { show_alert: true }).catch(() => {});
      if (parsed.epoch !== session.epoch) {
        return ctx.answerCbQuery('🚫 هذا الزر لم يعد صالحاً.', { show_alert: true }).catch(() => {});
      }
      if (parsed.verb === 'ch') return engine.handleChoiceCallback(ctx, session, parsed).catch(e => logger.error('[ToD] choice cb: ' + e.message));
      if (parsed.verb === 'end') return engine.handleEndCallback(ctx, session).catch(e => logger.error('[ToD] end cb: ' + e.message));
      return ctx.answerCbQuery().catch(() => {});
    }

    if (data.startsWith('todadm:')) {
      return adminPanel.handleAdminCallback(ctx, data).catch(e => {
        logger.error('[ToD] admin cb: ' + e.message);
        ctx.answerCbQuery('⚠️ خطأ.').catch(() => {});
      });
    }

    return next();
  });

  // ── استعادة الجلسات بعد إعادة التشغيل ──
  engine.resumeAllSessions().catch(e => logger.error('[ToD] resume: ' + e.message));

  logger.info('✅ [ToD] لعبة أكسيو أو فيريتي مُسجَّلة بنجاح');
}

module.exports = { register };
