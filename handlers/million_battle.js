'use strict';
const { all, get, run } = require('../database/db');

async function initMillionDB() {
  await run(`CREATE TABLE IF NOT EXISTS million_questions (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    option_a TEXT NOT NULL, option_b TEXT NOT NULL,
    option_c TEXT NOT NULL, option_d TEXT NOT NULL,
    correct TEXT NOT NULL,
    media_file_id TEXT DEFAULT NULL,
    media_type TEXT DEFAULT NULL,
    difficulty INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`).catch(() => {});
  await run(`CREATE TABLE IF NOT EXISTS million_games (
    id SERIAL PRIMARY KEY,
    chat_id BIGINT NOT NULL UNIQUE,
    owner_id BIGINT NOT NULL,
    owner_name TEXT,
    state TEXT DEFAULT 'registering',
    players TEXT DEFAULT '[]',
    played_ids TEXT DEFAULT '[]',
    current_q INTEGER DEFAULT 0,
    current_q_id INTEGER DEFAULT NULL,
    prize INTEGER DEFAULT 0,
    msg_id BIGINT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`).catch(() => {});
  await run(`ALTER TABLE million_games ADD COLUMN IF NOT EXISTS played_ids TEXT DEFAULT '[]'`).catch(() => {});
  await run(`ALTER TABLE million_games ADD COLUMN IF NOT EXISTS prize INTEGER DEFAULT 0`).catch(() => {});
  await run(`ALTER TABLE million_games ADD COLUMN IF NOT EXISTS current_q_id INTEGER DEFAULT NULL`).catch(() => {});
  await run(`CREATE TABLE IF NOT EXISTS million_answers (
    game_id INTEGER NOT NULL,
    user_id BIGINT NOT NULL,
    answer TEXT NOT NULL,
    PRIMARY KEY(game_id, user_id)
  )`).catch(() => {});
}

// ── نسخة (generation) لكل لعبة لمنع الـ race condition ──
const _gameGen    = new Map(); // chatId → generation number
const _timers     = new Map();
const _editTimers = new Map();

function getGame(chatId) {
  return get('SELECT * FROM million_games WHERE chat_id=$1', [chatId]);
}
function parsePlayers(g) {
  try { return JSON.parse(g.players || '[]'); } catch (_) { return []; }
}
function calcPrize(qNum) { return Math.min(100 * qNum, 10000); }
function timeLimit(qNum) { return qNum >= 10 ? 30 : 20; }
function mention(p) { return p.name; }

function stopTimers(chatId) {
  if (_timers.has(chatId))     { clearTimeout(_timers.get(chatId));     _timers.delete(chatId); }
  if (_editTimers.has(chatId)) { clearInterval(_editTimers.get(chatId)); _editTimers.delete(chatId); }
  // زد الجيل — يوقف أي interval قديم
  _gameGen.set(chatId, (_gameGen.get(chatId) || 0) + 1);
}

// ══════════════════════════════════════════════
//  REGISTRATION
// ══════════════════════════════════════════════
async function startRegistration(ctx) {
  const chatId   = ctx.chat.id;
  const userId   = ctx.from.id;
  const userName = ctx.from.first_name || 'لاعب';
  const existing = await getGame(chatId);
  if (existing && ['registering', 'playing'].includes(existing.state)) {
    return ctx.reply(
      '⚠️ يوجد لعبة نشطة! اكتب *ابدأ* للبدء أو /stopmillion للإيقاف',
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }
  await run('DELETE FROM million_games WHERE chat_id=$1', [chatId]).catch(() => {});
  const players = [{ id: userId, name: userName }];
  await run(
    'INSERT INTO million_games(chat_id,owner_id,owner_name,state,players) VALUES($1,$2,$3,$4,$5)',
    [chatId, userId, userName, 'registering', JSON.stringify(players)]
  );
  const msg = await ctx.reply(buildLobbyText(players), { parse_mode: 'Markdown' }).catch(() => null);
  if (msg) await run('UPDATE million_games SET msg_id=$1 WHERE chat_id=$2', [msg.message_id, chatId]);
}

function buildLobbyText(players) {
  let t = '🎮 *بدأت لعبة Million Battle!*\n\n✍️ اكتب *أنا* للمشاركة\n\n👥 *اللاعبين:*\n';
  if (!players.length) t += '_لا يوجد_\n';
  else players.forEach((p, i) => { t += `${i + 1}. ${p.name}\n`; });
  t += '\n⏳ في انتظار صاحب اللعبة يكتب *ابدأ*';
  return t;
}

async function joinGame(ctx) {
  const chatId   = ctx.chat.id;
  const userId   = ctx.from.id;
  const userName = ctx.from.first_name || 'لاعب';
  const g = await getGame(chatId);
  if (!g || g.state !== 'registering') return;
  const players = parsePlayers(g);
  if (players.find(p => p.id === userId)) return;
  players.push({ id: userId, name: userName });
  await run('UPDATE million_games SET players=$1 WHERE chat_id=$2', [JSON.stringify(players), chatId]);
  if (g.msg_id) ctx.telegram.editMessageText(chatId, g.msg_id, null, buildLobbyText(players), { parse_mode: 'Markdown' }).catch(() => {});
}

async function startGame(ctx) {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const g = await getGame(chatId);
  if (!g || g.state !== 'registering') return;
  if (g.owner_id != userId) return ctx.reply('🚫 فقط صاحب اللعبة يقدر يبدأها').catch(() => {});
  const players = parsePlayers(g);
  if (!players.length) return ctx.reply('⚠️ لازم لاعب واحد على الأقل!').catch(() => {});
  await run('UPDATE million_games SET state=$1 WHERE chat_id=$2', ['playing', chatId]);
  await ctx.reply(
    `🚀 *بدأت اللعبة!*\n\n👥 عدد اللاعبين: *${players.length}*\n🔥 حظ موفق للجميع!`,
    { parse_mode: 'Markdown' }
  ).catch(() => {});
  await nextQuestion(ctx, chatId);
}

// ══════════════════════════════════════════════
//  NEXT QUESTION
// ══════════════════════════════════════════════
async function nextQuestion(ctx, chatId) {
  stopTimers(chatId);
  const myGen = _gameGen.get(chatId); // نسخة هذه الجولة

  const g = await getGame(chatId);
  if (!g || g.state !== 'playing') return;
  const players = parsePlayers(g);
  if (!players.length) return endGame(ctx, chatId, null);

  let playedIds = [];
  try { playedIds = JSON.parse(g.played_ids || '[]'); } catch (_) {}

  let q;
  if (playedIds.length) {
    q = await get(
      'SELECT * FROM million_questions WHERE is_active=1 AND id != ALL($1) ORDER BY difficulty ASC, RANDOM() LIMIT 1',
      [playedIds]
    ).catch(() => null);
  } else {
    q = await get(
      'SELECT * FROM million_questions WHERE is_active=1 ORDER BY difficulty ASC, RANDOM() LIMIT 1',
      []
    ).catch(() => null);
  }

  if (!q) {
    await ctx.telegram.sendMessage(chatId, '🏁 *انتهت جميع الأسئلة!*', { parse_mode: 'Markdown' }).catch(() => {});
    return endGame(ctx, chatId, players.length === 1 ? players[0] : null);
  }

  playedIds.push(q.id);
  const qNum  = (g.current_q || 0) + 1;
  const prize = calcPrize(qNum);
  await run(
    'UPDATE million_games SET current_q=$1, current_q_id=$2, prize=$3, played_ids=$4 WHERE chat_id=$5',
    [qNum, q.id, prize, JSON.stringify(playedIds), chatId]
  );

  const gFresh = await getGame(chatId);
  const limit  = timeLimit(qNum);
  await run('DELETE FROM million_answers WHERE game_id=$1', [gFresh.id]).catch(() => {});

  const text = buildQuestionText(q, qNum, players.length, prize, limit);
  const kb   = buildAnswerKeyboard(gFresh.id);

  let qMsg = null;
  try {
    if (q.media_file_id && q.media_type === 'photo') {
      qMsg = await ctx.telegram.sendPhoto(chatId, q.media_file_id, { caption: text, parse_mode: 'Markdown', ...kb });
    } else if (q.media_file_id && q.media_type === 'video') {
      qMsg = await ctx.telegram.sendVideo(chatId, q.media_file_id, { caption: text, parse_mode: 'Markdown', ...kb });
    } else {
      qMsg = await ctx.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown', ...kb });
    }
  } catch (_) {}
  if (qMsg) await run('UPDATE million_games SET msg_id=$1 WHERE chat_id=$2', [qMsg.message_id, chatId]);

  // ── Countdown ──
  let remaining = limit - 1;
  const editT = setInterval(async () => {
    // ✅ لو تغير الجيل → هذا الـ interval قديم → نوقفه
    if (_gameGen.get(chatId) !== myGen) { clearInterval(editT); return; }
    if (remaining <= 0) { clearInterval(editT); _editTimers.delete(chatId); return; }
    const gNow = await getGame(chatId).catch(() => null);
    if (!gNow || gNow.state !== 'playing') { clearInterval(editT); _editTimers.delete(chatId); return; }
    const newText = buildQuestionText(q, qNum, parsePlayers(gNow).length, prize, remaining);
    if (qMsg) {
      if (q.media_file_id) ctx.telegram.editMessageCaption(chatId, qMsg.message_id, null, newText, { parse_mode: 'Markdown', ...kb }).catch(() => {});
      else ctx.telegram.editMessageText(chatId, qMsg.message_id, null, newText, { parse_mode: 'Markdown', ...kb }).catch(() => {});
    }
    remaining--;
  }, 1000);
  _editTimers.set(chatId, editT);

  // ── Timeout ──
  const t = setTimeout(async () => {
    if (_gameGen.get(chatId) !== myGen) return; // جيل قديم
    await processAnswers(ctx, chatId, q.id);
  }, limit * 1000);
  _timers.set(chatId, t);
}

function buildQuestionText(q, qNum, playersLeft, prize, timeLeft) {
  const stars = q.difficulty >= 3 ? ' ⭐⭐⭐' : q.difficulty === 2 ? ' ⭐⭐' : ' ⭐';
  return (
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `❓ *السؤال ${qNum}*${stars}\n\n` +
    `${q.question}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🅐 ${q.option_a}\n🅑 ${q.option_b}\n🅒 ${q.option_c}\n🅓 ${q.option_d}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 *${prize}*  ⏳ *${timeLeft}s*  👥 *${playersLeft}*`
  );
}

function buildAnswerKeyboard(gameId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🅐', callback_data: `mb_ans_A_${gameId}` }, { text: '🅑', callback_data: `mb_ans_B_${gameId}` }],
        [{ text: '🅒', callback_data: `mb_ans_C_${gameId}` }, { text: '🅓', callback_data: `mb_ans_D_${gameId}` }],
      ],
    },
  };
}

// ══════════════════════════════════════════════
//  HANDLE ANSWER
// ══════════════════════════════════════════════
async function handleAnswer(ctx, answer, gameId) {
  // ✅ رد فوري على Telegram — لازم يكون قبل كل شيء
  await ctx.answerCbQuery('').catch(() => {});

  const userId   = ctx.from.id;
  const userName = ctx.from.first_name || 'لاعب';
  const chatId   = ctx.callbackQuery?.message?.chat?.id || ctx.chat?.id;
  if (!chatId) return;

  const g = await getGame(chatId);

  if (!g || g.state !== 'playing') {
    return ctx.telegram.sendMessage(chatId, '❌ اللعبة انتهت!').catch(() => {});
  }
  if (g.id != gameId) {
    return ctx.telegram.sendMessage(chatId, '❌ جلسة لعبة قديمة!').catch(() => {});
  }

  const players = parsePlayers(g);
  if (!players.find(p => p.id === userId)) {
    return ctx.telegram.sendMessage(chatId,
      `❌ ${mention({ id: userId, name: userName })} أنت خارج اللعبة!`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }

  const existing = await get('SELECT 1 FROM million_answers WHERE game_id=$1 AND user_id=$2', [g.id, userId]).catch(() => null);
  if (existing) {
    return ctx.telegram.sendMessage(chatId,
      `⚠️ ${mention({ id: userId, name: userName })} أجبت مسبقاً!`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }

  await run('INSERT INTO million_answers(game_id,user_id,answer) VALUES($1,$2,$3)', [g.id, userId, answer]).catch(() => {});

  // ✅ لو كل اللاعبين أجابوا → نعالج فوراً
  const totalAnswers = await get('SELECT COUNT(*) as c FROM million_answers WHERE game_id=$1', [g.id]).catch(() => null);
  if (totalAnswers && parseInt(totalAnswers.c) >= players.length) {
    stopTimers(chatId);
    await processAnswers(ctx, chatId, g.current_q_id);
  }
}

// ══════════════════════════════════════════════
//  PROCESS ANSWERS — مع حماية من الـ race condition
// ══════════════════════════════════════════════
async function processAnswers(ctx, chatId, questionId) {
  // ✅ atomic lock — غير state لـ 'processing' لمنع الاستدعاء المزدوج
  // atomic lock
  const gCheck = await get('SELECT state FROM million_games WHERE chat_id=$1', [chatId]).catch(() => null);
  if (!gCheck || !['playing','processing'].includes(gCheck.state)) return;
  if (gCheck.state === 'processing') return; // سبقنا استدعاء ثاني
  await run('UPDATE million_games SET state=$1 WHERE chat_id=$2', ['processing', chatId]).catch(() => {});

  stopTimers(chatId);

  const g = await getGame(chatId);
  if (!g) return;

  // اجلب السؤال من ID المخزون
  const qId = questionId || g.current_q_id;
  const q   = qId ? await get('SELECT * FROM million_questions WHERE id=$1', [qId]).catch(() => null) : null;
  if (!q) {
    await run('UPDATE million_games SET state=$1 WHERE chat_id=$2', ['playing', chatId]);
    return endGame(ctx, chatId, null);
  }

  const players  = parsePlayers(g);
  const answers  = await all('SELECT user_id, answer FROM million_answers WHERE game_id=$1', [g.id]).catch(() => []);
  const correct  = q.correct;
  const optionEmojis = { A: '🅐', B: '🅑', C: '🅒', D: '🅓' };
  const correctEmoji = optionEmojis[correct] || correct;
  const correctText  = q[`option_${correct.toLowerCase()}`] || '';

  const correctIds = new Set(answers.filter(a => a.answer === correct).map(a => String(a.user_id)));
  const survivors  = players.filter(p => correctIds.has(String(p.id)));
  const eliminated = players.filter(p => !correctIds.has(String(p.id)));

  // ══ الكل أخطأ → تنتهي اللعبة ══
  if (!survivors.length) {
    const txt =
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `✅ *الإجابة الصحيحة:* ${correctEmoji} ${correctText}\n\n` +
      `😱 *الجميع أخطأ!*\n\n` +
      `❌ *تم إقصاء الجميع:*\n${players.map(p => `• ${mention(p)}`).join('\n')}\n\n` +
      `🏁 *انتهت اللعبة بدون فائز!*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━`;
    await ctx.telegram.sendMessage(chatId, txt, { parse_mode: 'Markdown' }).catch(() => {});
    return endGame(ctx, chatId, null);
  }

  // ══ رسالة النتيجة ══
  let resultText =
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `✅ *الإجابة الصحيحة:* ${correctEmoji} ${correctText}\n\n` +
    `🎯 *أجابوا صح:*\n${survivors.map(p => `• ${mention(p)}`).join('\n')}\n`;

  if (eliminated.length) {
    resultText += `\n❌ *تم إقصاء:*\n${eliminated.map(p => `• ${mention(p)}`).join('\n')}\n`;
  }

  const nextPrize = calcPrize((g.current_q || 0) + 1);
  resultText +=
    `\n🔥 *المتبقين: ${survivors.length}*  💰 الجائزة القادمة: *${nextPrize}*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.telegram.sendMessage(chatId, resultText, { parse_mode: 'Markdown' }).catch(() => {});
  await run('UPDATE million_games SET players=$1, state=$2 WHERE chat_id=$3', [JSON.stringify(survivors), 'playing', chatId]);

  if (survivors.length === 1 && players.length > 1) return endGame(ctx, chatId, survivors[0]);
  setTimeout(() => nextQuestion(ctx, chatId), 3000);
}

// ══════════════════════════════════════════════
//  END GAME
// ══════════════════════════════════════════════
async function endGame(ctx, chatId, winner) {
  stopTimers(chatId);
  await run('UPDATE million_games SET state=$1 WHERE chat_id=$2', ['ended', chatId]);
  const g2         = await getGame(chatId);
  const finalPrize = g2?.prize || 0;
  const totalQ     = g2?.current_q || 0;
  let text;
  if (winner) {
    try { const { awardPoints } = require('../database/points'); await awardPoints(winner.id, 'rating').catch(() => {}); } catch (_) {}
    text =
      `🏆━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🎉 *الفائز: ${mention(winner)}*\n\n` +
      `💰 الجائزة: *${finalPrize} نقطة*\n` +
      `📊 الأسئلة: *${totalQ}*\n\n` +
      `🔥 أنت بطل Million Battle!\n` +
      `━━━━━━━━━━━━━━━━━━━━━━🏆`;
  } else {
    text = `🤝 *لا يوجد فائز هذه الجولة!*\n\nاكتب *مليون* للعب من جديد 🎮`;
  }
  await ctx.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' }).catch(() => {});
  setTimeout(() => run('DELETE FROM million_games WHERE chat_id=$1', [chatId]).catch(() => {}), 30000);
}

async function stopGame(ctx) {
  const chatId = ctx.chat.id;
  const g = await getGame(chatId);
  if (!g || g.state === 'ended') return ctx.reply('❌ لا توجد لعبة نشطة').catch(() => {});
  if (g.owner_id != ctx.from.id && !ctx.isOwner) return ctx.reply('🚫 فقط صاحب اللعبة أو الأدمن').catch(() => {});
  await ctx.reply('🛑 *تم إيقاف اللعبة!*', { parse_mode: 'Markdown' }).catch(() => {});
  await endGame(ctx, chatId, null);
}

async function handleText(ctx) {
  const text = (ctx.message?.text || '').trim();
  if (text === 'مليون')                   return startRegistration(ctx);
  if (text === 'أنا' || text === 'انا')   return joinGame(ctx);
  if (text === 'ابدأ' || text === 'ابدا') return startGame(ctx);
}

async function showQuestionsPanel(ctx) {
  const questions = await all('SELECT id,question,correct,difficulty FROM million_questions WHERE is_active=1 ORDER BY difficulty ASC, id DESC LIMIT 20').catch(() => []);
  const total = await get('SELECT COUNT(*) as c FROM million_questions WHERE is_active=1').catch(() => null);
  let text = `🎮 *Million Battle — الأسئلة*\n\n📊 إجمالي: *${total?.c || 0}* سؤال\n\n`;
  const stars = d => d >= 3 ? '⭐⭐⭐' : d === 2 ? '⭐⭐' : '⭐';
  if (questions.length) questions.forEach((q, i) => { text += `${i+1}. ${q.question.substring(0,35)}... ✅${q.correct} ${stars(q.difficulty)}\n`; });
  else text += '_لا توجد أسئلة بعد_\n';
  return ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [
      [{ text: '➕ إضافة سؤال', callback_data: 'mb_add_q' }],
      [{ text: '🗑 حذف سؤال', callback_data: 'mb_del_q_menu' }],
      [{ text: '❌ إغلاق', callback_data: 'noop' }],
    ]},
  }).catch(() => {});
}

async function handleOwnerCallback(ctx, data) {
  if (data === 'mb_add_q') {
    await require('../utils/stateManager').setState(ctx.uid, { type: 'mb_add_question', step: 'question' });
    return ctx.reply('📝 *إضافة سؤال جديد*\n\nأرسل السؤال (أو صورة مع السؤال كـ caption):', { parse_mode: 'Markdown' }).catch(() => {});
  }
  if (data === 'mb_del_q_menu') {
    const qs = await all('SELECT id,question FROM million_questions WHERE is_active=1 ORDER BY id DESC LIMIT 15').catch(() => []);
    if (!qs.length) return ctx.answerCbQuery('لا توجد أسئلة').catch(() => {});
    const rows = qs.map(q => [{ text: '🗑 ' + q.question.substring(0,35), callback_data: 'mb_del_q_' + q.id }]);
    rows.push([{ text: '◀️ رجوع', callback_data: 'mb_panel' }]);
    return ctx.editMessageText('اختر السؤال للحذف:', { reply_markup: { inline_keyboard: rows } }).catch(() => {});
  }
  if (data.startsWith('mb_del_q_')) {
    await run('UPDATE million_questions SET is_active=0 WHERE id=$1', [data.replace('mb_del_q_','')]).catch(() => {});
    await ctx.answerCbQuery('✅ تم الحذف').catch(() => {});
    return showQuestionsPanel(ctx);
  }
  if (data === 'mb_panel') return showQuestionsPanel(ctx);
}

async function handleOwnerState(ctx, state) {
  const uid = ctx.uid;
  const text = ctx.message?.text?.trim() || '';
  const msg  = ctx.message;
  if (state.type !== 'mb_add_question') return;
  const step = state.step;
  if (step === 'question') {
    const question = msg.caption || text;
    if (!question) return ctx.reply('⚠️ أرسل السؤال كنص أو صورة مع caption').catch(() => {});
    const mediaFileId = msg.photo ? msg.photo[msg.photo.length-1].file_id : msg.video ? msg.video.file_id : null;
    const mediaType   = msg.photo ? 'photo' : msg.video ? 'video' : null;
    await require('../utils/stateManager').setState(uid, { ...state, step:'option_a', question, mediaFileId, mediaType });
    return ctx.reply('🅐 أرسل الخيار A:').catch(() => {});
  }
  if (step === 'option_a') { await require('../utils/stateManager').setState(uid, { ...state, step:'option_b', option_a:text }); return ctx.reply('🅑 أرسل الخيار B:').catch(() => {}); }
  if (step === 'option_b') { await require('../utils/stateManager').setState(uid, { ...state, step:'option_c', option_b:text }); return ctx.reply('🅒 أرسل الخيار C:').catch(() => {}); }
  if (step === 'option_c') { await require('../utils/stateManager').setState(uid, { ...state, step:'option_d', option_c:text }); return ctx.reply('🅓 أرسل الخيار D:').catch(() => {}); }
  if (step === 'option_d') { await require('../utils/stateManager').setState(uid, { ...state, step:'correct', option_d:text }); return ctx.reply('✅ الإجابة الصحيحة؟ اكتب A أو B أو C أو D:').catch(() => {}); }
  if (step === 'correct') {
    const correct = text.toUpperCase();
    if (!['A','B','C','D'].includes(correct)) return ctx.reply('⚠️ اكتب A أو B أو C أو D فقط!').catch(() => {});
    await require('../utils/stateManager').setState(uid, { ...state, step:'difficulty', correct });
    return ctx.reply('⭐ الصعوبة?\n1 = سهل ⭐\n2 = متوسط ⭐⭐\n3 = صعب ⭐⭐⭐').catch(() => {});
  }
  if (step === 'difficulty') {
    const diff = Math.min(3, Math.max(1, parseInt(text) || 1));
    await run(
      'INSERT INTO million_questions(question,option_a,option_b,option_c,option_d,correct,media_file_id,media_type,difficulty) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [state.question,state.option_a,state.option_b,state.option_c,state.option_d,state.correct,state.mediaFileId||null,state.mediaType||null,diff]
    );
    await require('../utils/stateManager').delState(uid);
    return ctx.reply('✅ تم إضافة السؤال! 🎮').catch(() => {});
  }
}

module.exports = { initMillionDB, handleText, handleAnswer, handleOwnerCallback, handleOwnerState, showQuestionsPanel, stopGame };
