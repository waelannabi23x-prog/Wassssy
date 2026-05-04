'use strict';
const { all, get, run } = require('../database/db');
const logger = require('../utils/logger');

// ═══════════════════════════════════════════════
//  DB INIT
// ═══════════════════════════════════════════════
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
    prize INTEGER DEFAULT 0,
    msg_id BIGINT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`).catch(() => {});
  await run(`CREATE TABLE IF NOT EXISTS million_answers (
    game_id INTEGER NOT NULL,
    user_id BIGINT NOT NULL,
    answer TEXT NOT NULL,
    PRIMARY KEY(game_id, user_id)
  )`).catch(() => {});
}

// ═══════════════════════════════════════════════
//  IN-MEMORY TIMERS
// ═══════════════════════════════════════════════
const _timers     = new Map();
const _editTimers = new Map();

// ═══════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════
function getGame(chatId) {
  return get('SELECT * FROM million_games WHERE chat_id=$1', [chatId]);
}

function parsePlayers(g) {
  try { return JSON.parse(g.players || '[]'); } catch (_) { return []; }
}

function calcPrize(qNum) {
  return Math.min(100 * qNum, 10000);
}

function timeLimit(qNum) {
  return qNum >= 10 ? 20 : 10;
}

// ═══════════════════════════════════════════════
//  REGISTRATION
// ═══════════════════════════════════════════════
async function startRegistration(ctx) {
  const chatId   = ctx.chat.id;
  const userId   = ctx.from.id;
  const userName = ctx.from.first_name || 'لاعب';

  const existing = await getGame(chatId);
  if (existing && ['registering', 'playing'].includes(existing.state)) return;

  await run('DELETE FROM million_games WHERE chat_id=$1', [chatId]).catch(() => {});

  const players = [{ id: userId, name: userName }];
  await run(
    'INSERT INTO million_games(chat_id,owner_id,owner_name,state,players) VALUES($1,$2,$3,$4,$5)',
    [chatId, userId, userName, 'registering', JSON.stringify(players)]
  );

  const text = buildLobbyText([{ name: userName }]);
  const msg  = await ctx.reply(text, { parse_mode: 'Markdown' }).catch(() => null);
  if (msg) {
    await run('UPDATE million_games SET msg_id=$1 WHERE chat_id=$2', [msg.message_id, chatId]);
  }
}

function buildLobbyText(players) {
  let t = '🎮 *بدأت لعبة Million Battle!*\n\n';
  t    += '✍️ اكتب *أنا* للمشاركة\n\n';
  t    += '👥 *اللاعبين:*\n';
  if (!players.length) t += '_لا يوجد_\n';
  else players.forEach((p, i) => { t += `${i + 1}. ${p.name}\n`; });
  t    += '\n⏳ في انتظار صاحب اللعبة يكتب *ابدأ*';
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

  if (g.msg_id) {
    ctx.telegram
      .editMessageText(chatId, g.msg_id, null, buildLobbyText(players), { parse_mode: 'Markdown' })
      .catch(() => {});
  }
}

// ═══════════════════════════════════════════════
//  START GAME
// ═══════════════════════════════════════════════
async function startGame(ctx) {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;

  const g = await getGame(chatId);
  if (!g || g.state !== 'registering') return;

  if (g.owner_id != userId) {
    return ctx.reply('🚫 فقط صاحب اللعبة يقدر يبدأها').catch(() => {});
  }

  const players = parsePlayers(g);
  if (players.length < 1) {
    return ctx.reply('⚠️ لازم لاعب واحد على الأقل للبدء!').catch(() => {});
  }

  await run('UPDATE million_games SET state=$1 WHERE chat_id=$2', ['playing', chatId]);

  await ctx.reply(
    `🚀 *بدأت اللعبة!*\n\n👥 عدد اللاعبين: *${players.length}*\n🔥 حظ موفق للجميع!`,
    { parse_mode: 'Markdown' }
  ).catch(() => {});

  await nextQuestion(ctx, chatId);
}

// ═══════════════════════════════════════════════
//  NEXT QUESTION
// ═══════════════════════════════════════════════
async function nextQuestion(ctx, chatId, repeatQuestion = null) {
  const g = await getGame(chatId);
  if (!g || g.state !== 'playing') return;

  const players = parsePlayers(g);
  if (!players.length) return endGame(ctx, chatId, null);

  let q = repeatQuestion;

  if (!q) {
    let playedIds = [];
    try { playedIds = JSON.parse(g.played_ids || '[]'); } catch (_) {}

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
      await ctx.telegram
        .sendMessage(chatId, '❌ لا توجد أسئلة! أضف أسئلة من لوحة التحكم.')
        .catch(() => {});
      return endGame(ctx, chatId, null);
    }

    playedIds.push(q.id);
    const qNum  = (g.current_q || 0) + 1;
    const prize = calcPrize(qNum);
    await run(
      'UPDATE million_games SET current_q=$1, prize=$2, played_ids=$3 WHERE chat_id=$4',
      [qNum, prize, JSON.stringify(playedIds), chatId]
    );
  }

  const gFresh = await getGame(chatId);
  const qNum   = gFresh.current_q;
  const prize  = gFresh.prize;
  const limit  = timeLimit(qNum);

  await run('DELETE FROM million_answers WHERE game_id=$1', [gFresh.id]).catch(() => {});

  const text = buildQuestionText(q, qNum, players.length, prize, limit);
  const kb   = buildAnswerKeyboard(gFresh.id);

  let qMsg = null;
  if (q.media_file_id && q.media_type === 'photo') {
    qMsg = await ctx.telegram
      .sendPhoto(chatId, q.media_file_id, { caption: text, parse_mode: 'Markdown', ...kb })
      .catch(() => null);
  } else if (q.media_file_id && q.media_type === 'video') {
    qMsg = await ctx.telegram
      .sendVideo(chatId, q.media_file_id, { caption: text, parse_mode: 'Markdown', ...kb })
      .catch(() => null);
  } else {
    qMsg = await ctx.telegram
      .sendMessage(chatId, text, { parse_mode: 'Markdown', ...kb })
      .catch(() => null);
  }

  if (qMsg) {
    await run('UPDATE million_games SET msg_id=$1 WHERE chat_id=$2', [qMsg.message_id, chatId]);
  }

  // ── Countdown ──
  if (_editTimers.has(chatId)) clearInterval(_editTimers.get(chatId));
  let remaining = limit - 1;

  const editT = setInterval(async () => {
    if (remaining <= 0) {
      clearInterval(editT);
      _editTimers.delete(chatId);
      return;
    }
    const gNow = await getGame(chatId).catch(() => null);
    if (!gNow || gNow.state !== 'playing') {
      clearInterval(editT);
      _editTimers.delete(chatId);
      return;
    }
    const newText = buildQuestionText(q, qNum, parsePlayers(gNow).length, prize, remaining);
    if (qMsg) {
      if (q.media_file_id) {
        ctx.telegram
          .editMessageCaption(chatId, qMsg.message_id, null, newText, { parse_mode: 'Markdown', ...kb })
          .catch(() => {});
      } else {
        ctx.telegram
          .editMessageText(chatId, qMsg.message_id, null, newText, { parse_mode: 'Markdown', ...kb })
          .catch(() => {});
      }
    }
    remaining--;
  }, 1000);
  _editTimers.set(chatId, editT);

  // ── Answer Timeout ──
  if (_timers.has(chatId)) clearTimeout(_timers.get(chatId));
  const t = setTimeout(() => processAnswers(ctx, chatId, q), limit * 1000);
  _timers.set(chatId, t);
}

function buildQuestionText(q, qNum, playersLeft, prize, timeLeft) {
  return (
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `❓ *السؤال ${qNum}*\n\n` +
    `${q.question}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🅐 ${q.option_a}\n🅑 ${q.option_b}\n🅒 ${q.option_c}\n🅓 ${q.option_d}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 الجائزة: *${prize}*  ⏳ *${timeLeft}s*  👥 المتبقين: *${playersLeft}*`
  );
}

function buildAnswerKeyboard(gameId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🅐', callback_data: `mb_ans_A_${gameId}` },
          { text: '🅑', callback_data: `mb_ans_B_${gameId}` },
        ],
        [
          { text: '🅒', callback_data: `mb_ans_C_${gameId}` },
          { text: '🅓', callback_data: `mb_ans_D_${gameId}` },
        ],
      ],
    },
  };
}

// ═══════════════════════════════════════════════
//  HANDLE ANSWER
// ═══════════════════════════════════════════════
async function handleAnswer(ctx, answer, gameId) {
  const userId = ctx.from.id;
  const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;

  const g = await getGame(chatId);
  if (!g || g.state !== 'playing' || g.id != gameId) {
    return ctx.answerCbQuery('❌ اللعبة انتهت').catch(() => {});
  }

  const players = parsePlayers(g);
  if (!players.find(p => p.id === userId)) {
    return ctx.answerCbQuery('❌ أنت خارج اللعبة').catch(() => {});
  }

  const existing = await get(
    'SELECT 1 FROM million_answers WHERE game_id=$1 AND user_id=$2',
    [g.id, userId]
  ).catch(() => null);
  if (existing) {
    return ctx.answerCbQuery('⚠️ لقد أجبت مسبقاً!').catch(() => {});
  }

  await run(
    'INSERT INTO million_answers(game_id,user_id,answer) VALUES($1,$2,$3)',
    [g.id, userId, answer]
  ).catch(() => {});

  ctx.answerCbQuery(`✅ اخترت ${answer}`).catch(() => {});
}

// ═══════════════════════════════════════════════
//  PROCESS ANSWERS
// ═══════════════════════════════════════════════
async function processAnswers(ctx, chatId, q) {
  if (_timers.has(chatId))     { clearTimeout(_timers.get(chatId));     _timers.delete(chatId); }
  if (_editTimers.has(chatId)) { clearInterval(_editTimers.get(chatId)); _editTimers.delete(chatId); }

  const g = await getGame(chatId);
  if (!g || g.state !== 'playing') return;

  const players  = parsePlayers(g);
  const answers  = await all(
    'SELECT user_id, answer FROM million_answers WHERE game_id=$1',
    [g.id]
  ).catch(() => []);

  const correct    = q.correct;
  const correctIds = new Set(
    answers.filter(a => a.answer === correct).map(a => a.user_id.toString())
  );

  const eliminated = players.filter(p => !correctIds.has(p.id.toString()));
  const survivors  = players.filter(p =>  correctIds.has(p.id.toString()));

  const optionEmojis = { A: '🅐', B: '🅑', C: '🅒', D: '🅓' };
  const correctEmoji = optionEmojis[correct] || correct;
  const correctText  = q[`option_${correct.toLowerCase()}`] || '';

  // الكل غلط → نعيد نفس السؤال
  if (!survivors.length) {
    const noWinText =
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `✅ *الإجابة الصحيحة:* ${correctEmoji} ${correctText}\n\n` +
      `😱 *الجميع أخطأ!*\n🔁 إعادة السؤال...\n` +
      `━━━━━━━━━━━━━━━━━━━━━━`;
    await ctx.telegram.sendMessage(chatId, noWinText, { parse_mode: 'Markdown' }).catch(() => {});
    setTimeout(() => nextQuestion(ctx, chatId, q), 3000);
    return;
  }

  let resultText =
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `✅ *الإجابة الصحيحة:* ${correctEmoji} ${correctText}\n\n`;

  if (eliminated.length) {
    resultText += `❌ *تم إقصاء:*\n${eliminated.map(p => `- ${p.name}`).join('\n')}\n\n`;
  }

  resultText +=
    `🔥 *المتبقين:*\n${survivors.map(p => `- ${p.name}`).join('\n')}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.telegram.sendMessage(chatId, resultText, { parse_mode: 'Markdown' }).catch(() => {});
  await run('UPDATE million_games SET players=$1 WHERE chat_id=$2', [JSON.stringify(survivors), chatId]);

  if (survivors.length === 1) return endGame(ctx, chatId, survivors[0]);
  setTimeout(() => nextQuestion(ctx, chatId), 3000);
}

// ═══════════════════════════════════════════════
//  END GAME
// ═══════════════════════════════════════════════
async function endGame(ctx, chatId, winner) {
  if (_timers.has(chatId))     { clearTimeout(_timers.get(chatId));     _timers.delete(chatId); }
  if (_editTimers.has(chatId)) { clearInterval(_editTimers.get(chatId)); _editTimers.delete(chatId); }

  await run('UPDATE million_games SET state=$1 WHERE chat_id=$2', ['ended', chatId]);

  const g2         = await getGame(chatId);
  const finalPrize = g2 ? g2.prize : 0;
  const totalQ     = g2 ? g2.current_q : 0;

  let text;
  if (winner) {
    try {
      const { awardPoints } = require('../database/points');
      const bonusPoints = Math.max(1, Math.floor(finalPrize / 10));
      for (let i = 0; i < bonusPoints; i++) {
        await awardPoints(winner.id, 'rating').catch(() => {});
      }
    } catch (_) {}

    text =
      `🏆━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🎉 *الفائز: ${winner.name}*\n\n` +
      `💰 الجائزة الكبرى: *${finalPrize} نقطة*\n` +
      `📊 الأسئلة: *${totalQ}*\n\n` +
      `🔥 أنت بطل Million Battle!\n` +
      `━━━━━━━━━━━━━━━━━━━━━━🏆`;
  } else {
    text =
      `🤝 *لا يوجد فائز هذه الجولة!*\n\n` +
      `اكتب *مليون* للعب من جديد 🎮`;
  }

  await ctx.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' }).catch(() => {});
  setTimeout(() => run('DELETE FROM million_games WHERE chat_id=$1', [chatId]).catch(() => {}), 30000);
}

// ═══════════════════════════════════════════════
//  STOP GAME
// ═══════════════════════════════════════════════
async function stopGame(ctx) {
  const chatId = ctx.chat.id;
  const g      = await getGame(chatId);
  if (!g || g.state === 'ended') {
    return ctx.reply('❌ لا توجد لعبة نشطة').catch(() => {});
  }
  if (g.owner_id != ctx.from.id && !ctx.isOwner) {
    return ctx.reply('🚫 فقط صاحب اللعبة أو الأدمن').catch(() => {});
  }
  await ctx.reply('🛑 *تم إيقاف اللعبة من قبل الأدمن*', { parse_mode: 'Markdown' }).catch(() => {});
  await endGame(ctx, chatId, null);
}

// ═══════════════════════════════════════════════
//  TEXT HANDLER
// ═══════════════════════════════════════════════
async function handleText(ctx) {
  const text = (ctx.message?.text || '').trim();
  if (text === 'مليون')               return startRegistration(ctx);
  if (text === 'أنا' || text === 'انا')   return joinGame(ctx);
  if (text === 'ابدأ' || text === 'ابدا') return startGame(ctx);
}

// ═══════════════════════════════════════════════
//  OWNER PANEL
// ═══════════════════════════════════════════════
async function showQuestionsPanel(ctx) {
  const questions = await all(
    'SELECT id, question, correct, difficulty FROM million_questions WHERE is_active=1 ORDER BY id DESC LIMIT 20'
  ).catch(() => []);
  const total = await get(
    'SELECT COUNT(*) as c FROM million_questions WHERE is_active=1'
  ).catch(() => null);

  let text = `🎮 *Million Battle — الأسئلة*\n\n📊 إجمالي: *${total?.c || 0}* سؤال\n\n`;
  if (questions.length) {
    questions.forEach((q, i) => {
      text += `${i + 1}. ${q.question.substring(0, 40)}... ✅${q.correct} ⭐${q.difficulty}\n`;
    });
  } else {
    text += '_لا توجد أسئلة بعد_\n';
  }

  return ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '➕ إضافة سؤال', callback_data: 'mb_add_q' }],
        [{ text: '🗑 حذف سؤال',   callback_data: 'mb_del_q_menu' }],
        [{ text: '❌ إغلاق',       callback_data: 'noop' }],
      ],
    },
  }).catch(() => {});
}

async function handleOwnerCallback(ctx, data) {
  if (data === 'mb_add_q') {
    await global.setState(ctx.uid, { type: 'mb_add_question', step: 'question' });
    return ctx.reply(
      '📝 *إضافة سؤال جديد*\n\nأرسل السؤال (أو صورة/فيديو مع السؤال كـ caption):',
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }
  if (data === 'mb_del_q_menu') {
    const qs = await all(
      'SELECT id, question FROM million_questions WHERE is_active=1 ORDER BY id DESC LIMIT 15'
    ).catch(() => []);
    if (!qs.length) return ctx.answerCbQuery('لا توجد أسئلة').catch(() => {});
    const rows = qs.map(q => [{
      text: '🗑 ' + q.question.substring(0, 35),
      callback_data: 'mb_del_q_' + q.id,
    }]);
    rows.push([{ text: '◀️ رجوع', callback_data: 'mb_panel' }]);
    return ctx.editMessageText('اختر السؤال للحذف:', {
      reply_markup: { inline_keyboard: rows },
    }).catch(() => {});
  }
  if (data.startsWith('mb_del_q_')) {
    const qId = data.replace('mb_del_q_', '');
    await run('UPDATE million_questions SET is_active=0 WHERE id=$1', [qId]).catch(() => {});
    await ctx.answerCbQuery('✅ تم الحذف').catch(() => {});
    return showQuestionsPanel(ctx);
  }
  if (data === 'mb_panel') return showQuestionsPanel(ctx);
}

async function handleOwnerState(ctx, state) {
  const uid  = ctx.uid;
  const text = ctx.message?.text?.trim() || '';
  const msg  = ctx.message;

  if (state.type !== 'mb_add_question') return;
  const step = state.step;

  if (step === 'question') {
    const question    = msg.caption || text;
    const mediaFileId = msg.photo ? msg.photo[msg.photo.length - 1].file_id : msg.video ? msg.video.file_id : null;
    const mediaType   = msg.photo ? 'photo' : msg.video ? 'video' : null;
    await global.setState(uid, { ...state, step: 'option_a', question, mediaFileId, mediaType });
    return ctx.reply('🅐 أرسل الخيار A:').catch(() => {});
  }
  if (step === 'option_a') {
    await global.setState(uid, { ...state, step: 'option_b', option_a: text });
    return ctx.reply('🅑 أرسل الخيار B:').catch(() => {});
  }
  if (step === 'option_b') {
    await global.setState(uid, { ...state, step: 'option_c', option_b: text });
    return ctx.reply('🅒 أرسل الخيار C:').catch(() => {});
  }
  if (step === 'option_c') {
    await global.setState(uid, { ...state, step: 'option_d', option_c: text });
    return ctx.reply('🅓 أرسل الخيار D:').catch(() => {});
  }
  if (step === 'option_d') {
    await global.setState(uid, { ...state, step: 'correct', option_d: text });
    return ctx.reply('✅ الإجابة الصحيحة؟ اكتب A أو B أو C أو D:').catch(() => {});
  }
  if (step === 'correct') {
    const correct = text.toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(correct)) {
      return ctx.reply('⚠️ اكتب A أو B أو C أو D فقط!').catch(() => {});
    }
    await global.setState(uid, { ...state, step: 'difficulty', correct });
    return ctx.reply('⭐ الصعوبة؟ اكتب 1 (سهل) أو 2 (متوسط) أو 3 (صعب):').catch(() => {});
  }
  if (step === 'difficulty') {
    const diff = parseInt(text) || 1;
    await run(
      'INSERT INTO million_questions(question,option_a,option_b,option_c,option_d,correct,media_file_id,media_type,difficulty) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [state.question, state.option_a, state.option_b, state.option_c, state.option_d,
       state.correct, state.mediaFileId || null, state.mediaType || null, diff]
    );
    await global.delState(uid);
    return ctx.reply('✅ تم إضافة السؤال بنجاح! 🎮').catch(() => {});
  }
}

module.exports = {
  initMillionDB,
  handleText,
  handleAnswer,
  handleOwnerCallback,
  handleOwnerState,
  showQuestionsPanel,
  stopGame,
};
