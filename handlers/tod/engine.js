'use strict';
// ══════════════════════════════════════════════════════════════
//  🎮 أكسيو أو فيريتي — المحرك الرئيسي
// ══════════════════════════════════════════════════════════════

const CFG = require('./config');
const state = require('./state');
const fairness = require('./fairness');
const texts = require('./texts');
const kb = require('./keyboards');
const tdb = require('./db');
const logger = require('../../utils/logger');

let BOT = null;
function init(bot) { BOT = bot; }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function safeSend(chatId, text, extra) {
  try { return await BOT.telegram.sendMessage(chatId, text, Object.assign({ parse_mode: 'Markdown' }, extra)); }
  catch (e) { logger.warn('[ToD] sendMessage: ' + e.message); return null; }
}

function isOver(session) { return session.ended || !state.sessions.has(session.chatId); }

async function loadSettingsInto(session) {
  const row = await tdb.getSettings(session.chatId);
  session.settings = {
    registration: row.reg_timeout,
    asker_prompt: CFG.DEFAULT_TIMERS.ASKER_PROMPT,
    choice: row.choice_timeout,
    submit: row.submit_timeout,
    answer: row.answer_timeout,
    banter: row.banter_timeout,
    min_players: row.min_players,
    delete_offtopic: row.delete_offtopic,
    fairness_enabled: row.fairness_enabled,
  };
  return session.settings;
}

// ══════════════════ التسجيل ══════════════════
async function createSession(ctx) {
  if (!['group', 'supergroup'].includes(ctx.chat?.type)) {
    return ctx.reply('🎮 لعبة أكسيو أو فيريتي تُلعب داخل القروبات فقط!').catch(() => {});
  }
  if (state.getSession(ctx.chat.id)) {
    return ctx.reply('⚠️ توجد غرفة/لعبة أكسيو أو فيريتي نشطة في هذا القروب بالفعل.').catch(() => {});
  }
  const owner = { id: ctx.from.id, first_name: ctx.from.first_name, username: ctx.from.username };
  const session = state.createSession(ctx.chat.id, ctx.chat.title, owner);
  await loadSettingsInto(session);

  const replyOpts = { parse_mode: 'Markdown' };
  if (ctx.message?.message_id) replyOpts.reply_to_message_id = ctx.message.message_id;
  const msg = await ctx.reply(texts.registrationText(session), replyOpts);
  session.regMsgId = msg?.message_id;
  await tdb.saveSessionSnapshot(session);

  if (session.settings.registration > 0) {
    session.regTimer = setTimeout(async () => {
      const s = state.getSession(ctx.chat.id);
      if (!s || s.status !== 'registration') return;
      state.destroySession(ctx.chat.id);
      await tdb.deleteSessionSnapshot(ctx.chat.id);
      await safeSend(ctx.chat.id, texts.sessionCancelledText('⏰ انتهت مهلة التسجيل ولم يبدأ المنشئ اللعبة.'));
    }, session.settings.registration);
  }
}

async function refreshRegMsg(session) {
  if (!session.regMsgId) return;
  await BOT.telegram.editMessageText(session.chatId, session.regMsgId, undefined, texts.registrationText(session), { parse_mode: 'Markdown' }).catch(() => {});
}

async function joinSession(ctx, next) {
  const session = state.getSession(ctx.chat.id);
  if (!session || session.status !== 'registration') return next();
  const uid = ctx.from.id;
  if (session.players.has(uid)) return; // مستهلك بصمت
  if (session.players.size >= CFG.MAX_PLAYERS) {
    return ctx.reply('🚫 الغرفة مكتملة!').catch(() => {});
  }
  state.addPlayer(session, { id: uid, first_name: ctx.from.first_name, username: ctx.from.username });
  await refreshRegMsg(session);
  await tdb.saveSessionSnapshot(session);
}

async function cancelSession(ctx, next) {
  const session = state.getSession(ctx.chat.id);
  if (!session || session.status !== 'registration') return next();
  if (ctx.from.id !== session.ownerId && !ctx.isAdmin && !ctx.isOwner) return next();
  if (session.regTimer) clearTimeout(session.regTimer);
  state.destroySession(ctx.chat.id);
  await tdb.deleteSessionSnapshot(ctx.chat.id);
  await safeSend(ctx.chat.id, texts.sessionCancelledText('أُلغيت بواسطة ' + (ctx.from.first_name || 'مستخدم') + '.'));
}

async function startGame(ctx, next) {
  const session = state.getSession(ctx.chat.id);
  if (!session || session.status !== 'registration') return next();
  if (ctx.from.id !== session.ownerId) return next();
  const min = session.settings.min_players || CFG.MIN_PLAYERS;
  if (session.players.size < min) {
    return ctx.reply(texts.notEnoughPlayersText(min, session.players.size)).catch(() => {});
  }
  if (session.regTimer) clearTimeout(session.regTimer);
  session.status = 'active';
  await safeSend(ctx.chat.id, '🚀 *بدأت اللعبة!* استعدّوا...');
  await tdb.saveSessionSnapshot(session);
  runRoundLoop(session).catch(e => {
    logger.error('[ToD] runRoundLoop crashed: ' + e.message);
    safeSend(session.chatId, '⚠️ حدث خطأ غير متوقع وتم إيقاف اللعبة.');
    state.destroySession(session.chatId);
    tdb.deleteSessionSnapshot(session.chatId).catch(() => {});
  });
}

// ══════════════════ حلقة الجولات ══════════════════
async function runRoundLoop(session) {
  while (true) {
    if (isOver(session)) return;
    session.round++;

    const asker = fairness.pickAsker(session, session.settings.fairness_enabled);
    if (!asker) { await endSession(session, 'لا يوجد لاعبون كافون للمتابعة.'); return; }
    const answerer = fairness.pickAnswerer(session, asker.id, session.settings.fairness_enabled);
    if (!answerer) { await endSession(session, 'لا يوجد لاعبون كافون للمتابعة.'); return; }

    session.currentAsker = asker.id;
    session.currentAnswerer = answerer.id;
    session.mode = null;

    await safeSend(session.chatId, texts.roundAnnounceText(session, asker, answerer));

    // ── 1) ننتظر السائل يكتب "أكسيو ولا فيريتي؟" (تأكيد حضور) ──
    const askerText = await state.waitForMessage(session, 'asker_prompt', asker.id, session.settings.asker_prompt);
    if (isOver(session)) return;
    if (askerText === null) {
      await safeSend(session.chatId, texts.askerTimeoutText(asker));
      asker.timeouts = (asker.timeouts || 0) + 1;
      await sleep(2000);
      continue;
    }

    // ── 2) المجيب يختار أكسيو أو فيريتي عبر الأزرار ──
    state.nextEpoch(session);
    const choiceMsg = await safeSend(session.chatId, texts.choicePromptText(answerer), { reply_markup: kb.choiceKeyboard(session) });
    await state.createWaiter(session, 'choice', answerer.id, session.settings.choice);
    if (isOver(session)) return;
    if (!session.mode) {
      await safeSend(session.chatId, texts.choiceTimeoutText(answerer));
      answerer.timeouts = (answerer.timeouts || 0) + 1;
      if (choiceMsg) await BOT.telegram.editMessageReplyMarkup(session.chatId, choiceMsg.message_id, undefined, { inline_keyboard: [] }).catch(() => {});
      await sleep(2000);
      continue;
    }
    if (choiceMsg) await BOT.telegram.editMessageReplyMarkup(session.chatId, choiceMsg.message_id, undefined, { inline_keyboard: [] }).catch(() => {});

    // ── 3) السائل يكتب السؤال/التحدي ──
    await safeSend(session.chatId, texts.submitPromptText(session, asker, answerer, session.mode));
    const content = await state.waitForMessage(session, 'asker_submit', asker.id, session.settings.submit);
    if (isOver(session)) return;
    if (content === null) {
      await safeSend(session.chatId, texts.submitTimeoutText(asker));
      asker.timeouts = (asker.timeouts || 0) + 1;
      await sleep(2000);
      continue;
    }

    asker.askedCount = (asker.askedCount || 0) + 1;
    await safeSend(session.chatId, texts.questionPostedText(session, asker, answerer, session.mode, content));

    // ── 4) المجيب يجيب ──
    const answerText = await state.waitForMessage(session, 'answerer_reply', answerer.id, session.settings.answer);
    if (isOver(session)) return;
    answerer.answeredCount = (answerer.answeredCount || 0) + 1;
    let timedOut = false;
    if (answerText === null) {
      await safeSend(session.chatId, texts.answerTimeoutText(answerer));
      answerer.timeouts = (answerer.timeouts || 0) + 1;
      timedOut = true;
    } else {
      await safeSend(session.chatId, texts.answerReceivedText(answerer));
      if (session.mode === 'dare') answerer.dareCompleted = (answerer.dareCompleted || 0) + 1;
      else answerer.truthCompleted = (answerer.truthCompleted || 0) + 1;
    }

    // حفظ إحصائيات هذه الجولة
    await tdb.applyRoundStats({ userId: asker.id, firstName: asker.name, username: asker.username, asked: true });
    await tdb.applyRoundStats({
      userId: answerer.id, firstName: answerer.name, username: answerer.username, answered: true,
      dareDone: !timedOut && session.mode === 'dare', truthDone: !timedOut && session.mode === 'truth', timedOut,
    });

    session.lastAsker = asker.id;
    session.lastAnswerer = answerer.id;
    await tdb.saveSessionSnapshot(session);

    // ── 5) فتح الدردشة لثوانٍ ──
    session.status = 'banter';
    const banterSecs = Math.round((session.settings.banter || CFG.DEFAULT_TIMERS.BANTER) / 1000);
    await safeSend(session.chatId, texts.banterOpenText(banterSecs));
    await sleep(session.settings.banter || CFG.DEFAULT_TIMERS.BANTER);
    if (isOver(session)) return;
    session.status = 'active';
    await safeSend(session.chatId, texts.banterClosedText());
    await sleep(1500);
  }
}

// ══════════════════ إنهاء اللعبة ══════════════════
async function endSession(session, reason) {
  if (session.ended) return;
  session.ended = true;
  if (session.pendingCapture) session.pendingCapture.resolve(null);
  for (const w of Object.values(session.waiters)) { try { w.finish(); } catch (_) {} }
  await safeSend(session.chatId, texts.sessionEndedText(session, reason));
  await tdb.markGamePlayed([...session.players.keys()]);
  for (const uid of session.players.keys()) {
    const row = await tdb.getStatsForUser(uid).catch(() => null);
    if (row) {
      const fresh = await tdb.checkNewAchievements(uid, row);
      if (fresh.length) {
        const lines = fresh.map(a => `${a.emoji} ${a.name}`).join('\n');
        BOT.telegram.sendMessage(uid, `🎖️ *إنجازات جديدة في أكسيو أو فيريتي!*\n${lines}`, { parse_mode: 'Markdown' }).catch(() => {});
      }
    }
  }
  await tdb.deleteSessionSnapshot(session.chatId);
  state.destroySession(session.chatId);
}

async function forceEnd(ctx, next) {
  const session = state.getSession(ctx.chat.id);
  if (!session) return next ? next() : undefined;
  const isOwnerOrAdmin = ctx.from.id === session.ownerId || ctx.isAdmin || ctx.isOwner;
  if (!isOwnerOrAdmin) return next ? next() : undefined;
  if (session.status === 'registration') {
    if (session.regTimer) clearTimeout(session.regTimer);
    state.destroySession(ctx.chat.id);
    await tdb.deleteSessionSnapshot(ctx.chat.id);
    return safeSend(ctx.chat.id, texts.sessionCancelledText('أُلغيت بواسطة ' + (ctx.from.first_name || 'مستخدم') + '.'));
  }
  await endSession(session, '🛑 أُنهيت بواسطة ' + (ctx.from.first_name || 'مشرف') + '.');
}

// ══════════════════ معالجة الرسائل أثناء اللعبة ══════════════════
async function handleGroupMessage(ctx) {
  const session = state.getSession(ctx.chat.id);
  if (!session || session.status === 'registration' || isOver(session)) return null;
  const uid = ctx.from.id;
  const text = (ctx.message?.text || '').trim();

  if (session.pendingCapture && session.pendingCapture.userId === uid) {
    const captured = state.feedCapture(session, uid, text);
    if (captured) return 'consumed';
  }

  if (session.status === 'active' && session.settings.delete_offtopic) {
    const isParticipant = uid === session.currentAsker || uid === session.currentAnswerer || uid === session.ownerId;
    const isAdminUser = !!(ctx.isAdmin || ctx.isOwner);
    if (!isParticipant && !isAdminUser) {
      await ctx.deleteMessage().catch(() => {});
      return 'consumed';
    }
  }
  return null;
}

// ══════════════════ ضغط زر الاختيار (أكسيو/فيريتي) ══════════════════
async function handleChoiceCallback(ctx, session, parsed) {
  const uid = ctx.from.id;
  if (uid !== session.currentAnswerer) {
    return ctx.answerCbQuery('🚫 هذا الاختيار ليس لك!', { show_alert: true }).catch(() => {});
  }
  if (session.mode) return ctx.answerCbQuery('✅ تم الاختيار مسبقاً.').catch(() => {});
  session.mode = parsed.arg === 'dare' ? 'dare' : 'truth';
  const answerer = state.getPlayer(session, uid);
  state.notifyWaiter(session, 'choice', uid);
  await ctx.answerCbQuery('✅ اخترت!').catch(() => {});
  await safeSend(session.chatId, texts.choiceMadeText(answerer, session.mode));
}

async function handleEndCallback(ctx, session) {
  const isOwnerOrAdmin = ctx.from.id === session.ownerId || ctx.isAdmin || ctx.isOwner;
  if (!isOwnerOrAdmin) return ctx.answerCbQuery('🚫 غير مسموح.', { show_alert: true }).catch(() => {});
  await ctx.answerCbQuery('🛑 جارٍ الإنهاء...').catch(() => {});
  await endSession(session, '🛑 أُنهيت بواسطة ' + (ctx.from.first_name || 'مشرف') + '.');
}

// ══════════════════ استعادة بعد إعادة التشغيل ══════════════════
async function resumeAllSessions() {
  const rows = await tdb.loadAllSnapshots();
  for (const row of rows) {
    try {
      const snap = row.snapshot;
      const owner = snap.players.find(p => p.id === snap.ownerId) || { id: snap.ownerId, name: 'مالك' };
      const session = state.createSession(snap.chatId, snap.chatTitle, owner);
      session.players.clear();
      session.playerOrder = [];
      for (const p of snap.players) {
        session.players.set(p.id, p);
        session.playerOrder.push(p.id);
      }
      session.round = snap.round || 0;
      await loadSettingsInto(session);

      if (snap.status === 'registration') {
        session.status = 'registration';
        const msg = await safeSend(snap.chatId, '♻️ *تم استرجاع غرفة أكسيو أو فيريتي بعد إعادة تشغيل البوت*\n\n' + texts.registrationText(session));
        session.regMsgId = msg?.message_id;
      } else {
        session.status = 'active';
        await safeSend(snap.chatId, '🔄 *تمت إعادة تشغيل البوت أثناء جولة نشطة!*\nتم الحفاظ على اللاعبين والإحصائيات — جارٍ بدء جولة جديدة...');
        runRoundLoop(session).catch(e => logger.error('[ToD resume] ' + e.message));
      }
    } catch (e) {
      logger.error('[ToD] resume session error: ' + e.message);
    }
  }
  if (rows.length) logger.info(`✅ [ToD] استُرجعت ${rows.length} جلسة بعد إعادة التشغيل`);
}

async function cmdStats(ctx) {
  const row = await tdb.getStatsForUser(ctx.from.id);
  const { all } = require('../../database/db');
  const ach = await all('SELECT achievement_key FROM tod_achievements WHERE user_id=$1', [ctx.from.id]).catch(() => []);
  return ctx.reply(texts.statsText(row, ach), { parse_mode: 'Markdown' }).catch(() => {});
}

async function cmdRules(ctx) {
  return ctx.reply(texts.rulesText(), { parse_mode: 'Markdown' }).catch(() => {});
}

module.exports = {
  init, createSession, joinSession, cancelSession, startGame, forceEnd,
  handleGroupMessage, handleChoiceCallback, handleEndCallback,
  resumeAllSessions, cmdStats, cmdRules,
};
