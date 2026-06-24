'use strict';
// ══════════════════════════════════════════════════════════════
//  🎮 أكسيو أو فيريتي — لوحة تحكم الإدارة (بالخاص)
// ══════════════════════════════════════════════════════════════

const tdb = require('./db');
const kb = require('./keyboards');
const { parseCbAdmin } = require('./codec');
const state = require('./state');

const STEP = { reg_timeout: 30000, choice_timeout: 10000, submit_timeout: 15000, answer_timeout: 10000, banter_timeout: 5000, min_players: 1 };
const MIN  = { reg_timeout: 0, choice_timeout: 10000, submit_timeout: 15000, answer_timeout: 15000, banter_timeout: 5000, min_players: 2 };
const MAX  = { reg_timeout: 1800000, choice_timeout: 120000, submit_timeout: 300000, answer_timeout: 180000, banter_timeout: 60000, min_players: 30 };

async function panelText(chatId) {
  return '⚙️ *لوحة تحكم أكسيو أو فيريتي*\nالقروب: `' + chatId + '`\n\nعدّل الإعدادات أدناه:';
}

// يُستدعى عندما يكتب أدمن الأمر داخل القروب — يفتح اللوحة في الخاص
async function openPanelFromGroup(ctx) {
  if (!['group', 'supergroup'].includes(ctx.chat?.type)) return;
  const isAdminUser = ctx.isAdmin || ctx.isOwner;
  if (!isAdminUser) return ctx.reply('🚫 هذا الأمر للمشرفين فقط.').catch(() => {});
  const chatId = ctx.chat.id;
  const settings = await tdb.getSettings(chatId);
  try {
    await ctx.telegram.sendMessage(ctx.from.id, await panelText(chatId), {
      parse_mode: 'Markdown', reply_markup: kb.adminPanelKeyboard(chatId, settings),
    });
    await ctx.reply('📩 تم إرسال لوحة التحكم في الخاص.').catch(() => {});
  } catch (e) {
    await ctx.reply('⚠️ افتح محادثة خاصة مع البوت أولاً (اضغط Start) ثم أعد المحاولة.').catch(() => {});
  }
}

async function refreshPanel(ctx, chatId) {
  const settings = await tdb.getSettings(chatId);
  await ctx.editMessageText(await panelText(chatId), {
    parse_mode: 'Markdown', reply_markup: kb.adminPanelKeyboard(chatId, settings),
  }).catch(() => {});
}

async function handleAdminCallback(ctx, data) {
  const parsed = parseCbAdmin(data);
  if (!parsed) return ctx.answerCbQuery().catch(() => {});
  const { action, chatId, arg } = parsed;

  // تحقّق أن الضاغط أدمن فعلاً في ذلك القروب
  try {
    const member = await ctx.telegram.getChatMember(chatId, ctx.from.id);
    if (!['administrator', 'creator'].includes(member?.status)) {
      return ctx.answerCbQuery('🚫 لست مشرفاً في ذلك القروب.', { show_alert: true }).catch(() => {});
    }
  } catch (_) {
    return ctx.answerCbQuery('⚠️ تعذّر التحقق من صلاحياتك.', { show_alert: true }).catch(() => {});
  }

  if (action === 'noop') return ctx.answerCbQuery().catch(() => {});

  if (action === 'inc' || action === 'dec') {
    const settings = await tdb.getSettings(chatId);
    const field = arg;
    const step = STEP[field] || 1000;
    let val = (settings[field] || 0) + (action === 'inc' ? step : -step);
    val = Math.max(MIN[field] ?? 0, Math.min(MAX[field] ?? 999999999, val));
    await tdb.updateSetting(chatId, field, val);
    await ctx.answerCbQuery('✅ تم التحديث').catch(() => {});
    return refreshPanel(ctx, chatId);
  }

  if (action === 'toggle') {
    const settings = await tdb.getSettings(chatId);
    const field = arg;
    await tdb.updateSetting(chatId, field, !settings[field]);
    await ctx.answerCbQuery('✅ تم التبديل').catch(() => {});
    return refreshPanel(ctx, chatId);
  }

  if (action === 'forceend') {
    const session = state.getSession(chatId);
    if (!session) return ctx.answerCbQuery('ℹ️ لا توجد لعبة نشطة حالياً.').catch(() => {});
    const engine = require('./engine');
    await ctx.answerCbQuery('🛑 جارٍ الإنهاء...').catch(() => {});
    const fakeCtx = { chat: { id: chatId }, from: ctx.from, isAdmin: true };
    return engine.forceEnd(fakeCtx);
  }

  if (action === 'stats') {
    const session = state.getSession(chatId);
    const text = session
      ? `📊 *حالة اللعبة الحالية في القروب*\n\nالحالة: ${session.status}\nعدد اللاعبين: ${session.players.size}\nالجولة: ${session.round}`
      : 'ℹ️ لا توجد لعبة نشطة حالياً في هذا القروب.';
    await ctx.answerCbQuery().catch(() => {});
    return ctx.reply(text, { parse_mode: 'Markdown' }).catch(() => {});
  }

  if (action === 'refresh') {
    await ctx.answerCbQuery('🔄 تم التحديث').catch(() => {});
    return refreshPanel(ctx, chatId);
  }

  return ctx.answerCbQuery().catch(() => {});
}

module.exports = { openPanelFromGroup, handleAdminCallback };
