'use strict';
// ══════════════════════════════════════════════════════════════
//  🐺 Loup-Garou — نقطة التسجيل الرئيسية
//  يُستدعى مرة واحدة من index.js بعد إنشاء البوت:
//    require('./handlers/werewolf').register(bot);
// ══════════════════════════════════════════════════════════════

const engine  = require('./engine');
const actions = require('./actions');
const { parseCb, parseCbx } = require('./codec');
const state   = require('./state');
const wwdb    = require('./db');
const logger  = require('../../utils/logger');

async function register(bot) {
  // تهيئة schema قاعدة البيانات
  await wwdb.migrate().catch(e => logger.error('[Werewolf] migrate: ' + e.message));
  engine.init(bot);

  // ── أوامر المجموعات ──────────────────────────────────────
  bot.command(['لوب_غارو', 'loupgarou', 'werewolf'], ctx => {
    if (!['group', 'supergroup'].includes(ctx.chat?.type)) return;
    return engine.createLobby(ctx).catch(e => logger.error('[WW] createLobby: ' + e.message));
  });

  bot.command('ww_status',   ctx => engine.cmdStatus(ctx, false));
  bot.command('ww_log',      ctx => engine.cmdLog(ctx, false));
  bot.command('ww_rules',    ctx => engine.cmdRules(ctx, false));
  bot.command('ww_stats',    ctx => engine.cmdStats(ctx, false));
  bot.command('ww_ach',      ctx => engine.cmdAchievements(ctx, false));
  bot.command('ww_season',   ctx => engine.cmdSeason(ctx, false));
  bot.command('ww_menu',     ctx => engine.cmdMenu(ctx));

  // ── Trigger نصي بالعربية (في الجروب) ───────────────────
  // يُضاف في gameAndBankMiddleware في index.js — راجع التعليمات أسفله

  // ── Callbacks (ww: + wwx:) ──────────────────────────────
  bot.on('callback_query', async (ctx, next) => {
    const data = ctx.callbackQuery?.data || '';

    // ── وزن ww:<verb>:<gameId>:<epoch>:<arg> ──
    if (data.startsWith('ww:')) {
      const parsed = parseCb(data);
      if (!parsed) return ctx.answerCbQuery('❌ بيانات غير صالحة.').catch(() => {});

      const game = state.getGameById(parsed.gameId);
      if (!game) return ctx.answerCbQuery('⌛ انتهت اللعبة أو تم إلغاؤها.', { show_alert: true }).catch(() => {});

      // ── مكافحة الغش: رفض أزرار الجولات/المراحل القديمة ──
      if (parsed.epoch !== game.epoch) {
        return ctx.answerCbQuery('🚫 هذا الزر لم يعد صالحاً (مرحلة قديمة).', { show_alert: true }).catch(() => {});
      }

      // أفعال اللوبي (j, lv, st, cn)
      if (['j', 'lv', 'st', 'cn'].includes(parsed.verb)) {
        return engine.handleLobbyAction(ctx, game, parsed).catch(e => {
          logger.error('[WW] lobbyAction: ' + e.message);
          ctx.answerCbQuery('⚠️ خطأ، حاول مجدداً.').catch(() => {});
        });
      }

      // أفعال الليل والتصويت
      return actions.handle(ctx, game, parsed).catch(e => {
        logger.error('[WW] action: ' + e.message);
        ctx.answerCbQuery('⚠️ خطأ، حاول مجدداً.').catch(() => {});
      });
    }

    // ── وزن wwx:<action>:<arg> ──
    if (data.startsWith('wwx:')) {
      const { parseCbx } = require('./codec');
      const parsed = parseCbx(data);
      if (!parsed) return ctx.answerCbQuery().catch(() => {});
      return engine.handleMenuAction(ctx, parsed).catch(e => {
        logger.error('[WW] menuAction: ' + e.message);
        ctx.answerCbQuery().catch(() => {});
      });
    }

    return next();
  });

  // ── مغادرة لاعب أو طرده أثناء اللعبة ───────────────────
  bot.on('chat_member', async (ctx, next) => {
    try {
      const upd = ctx.update?.chat_member;
      if (!upd) return next();
      const { new_chat_member: newM, old_chat_member: oldM, chat } = upd;
      if (!['group', 'supergroup'].includes(chat?.type)) return next();
      const wasIn = ['member', 'administrator', 'creator', 'restricted'].includes(oldM?.status);
      const gone  = ['left', 'kicked', 'banned'].includes(newM?.status);
      if (wasIn && gone && newM?.user) {
        await engine.handlePlayerLeft(chat.id, newM.user.id);
      }
    } catch (e) {
      logger.error('[WW] chat_member: ' + e.message);
    }
    return next();
  });

  logger.info('✅ [Werewolf] لعبة لوب غارو مُسجَّلة بنجاح');
}

module.exports = { register };
