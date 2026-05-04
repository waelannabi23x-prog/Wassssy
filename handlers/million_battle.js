'use strict';
const { all, get, run } = require('../database/db');

// ═══ DB INIT ═══
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
  )`).catch(()=>{});
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
  )`).catch(()=>{});
  await run(`CREATE TABLE IF NOT EXISTS million_answers (
    game_id INTEGER NOT NULL,
    user_id BIGINT NOT NULL,
    answer TEXT NOT NULL,
    PRIMARY KEY(game_id, user_id)
  )`).catch(()=>{});
}

// ═══ STATE ═══
const _timers     = new Map();
const _editTimers = new Map();

const parsePlayers = g => { try { return JSON.parse(g.players || '[]'); } catch(_) { return []; } };
const parseIds     = g => { try { return JSON.parse(g.played_ids || '[]'); } catch(_) { return []; } };
const getGame      = chatId => get('SELECT * FROM million_games WHERE chat_id=$1', [chatId]);

// ═══ REGISTER ═══
async function startRegistration(ctx) {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const userName = ctx.from.first_name || 'لاعب';
  const existing = await getGame(chatId);
  if (existing && ['registering','playing'].includes(existing.state)) return;
  await run('DELETE FROM million_games WHERE chat_id=$1', [chatId]).catch(()=>{});
  const players = [{ id: userId, name: userName }];
  await run(
    'INSERT INTO million_games(chat_id,owner_id,owner_name,state,players) VALUES($1,$2,$3,$4,$5)',
    [chatId, userId, userName, 'registering', JSON.stringify(players)]
  );
  const msg = await ctx.reply(buildRegText(players, userName), { parse_mode: 'Markdown' }).catch(()=>null);
  if (msg) await run('UPDATE million_games SET msg_id=$1 WHERE chat_id=$2', [msg.message_id, chatId]);
}

function buildRegText(players, ownerName) {
  let t = '🎮 *Million Battle*\n';
  t += '━━━━━━━━━━━━━━━━\n';
  t += '✍️ اكتب *أنا* للانضمام\n\n';
  t += '👥 *اللاعبون (' + players.length + '):*\n';
  players.forEach((p, i) => { t += (i+1) + '. ' + p.name + '\n'; });
  t += '\n⏳ صاحب اللعبة *' + ownerName + '* يكتب *ابدأ* للبدء';
  return t;
}

// ═══ JOIN ═══
async function joinGame(ctx) {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const g = await getGame(chatId);
  if (!g || g.state !== 'registering') return;
  const players = parsePlayers(g);
  if (players.find(p => p.id === userId)) return ctx.reply('⚠️ أنت مسجل بالفعل!').catch(()=>{});
  players.push({ id: userId, name: ctx.from.first_name || 'لاعب' });
  await run('UPDATE million_games SET players=$1 WHERE chat_id=$2', [JSON.stringify(players), chatId]);
  if (g.msg_id) ctx.telegram.editMessageText(chatId, g.msg_id, null, buildRegText(players, g.owner_name), { parse_mode: 'Markdown' }).catch(()=>{});
}

// ═══ START GAME ═══
async function startGame(ctx) {
  const chatId = ctx.chat.id;
  const g = await getGame(chatId);
  if (!g || g.state !== 'registering') return;
  if (g.owner_id != ctx.from.id && !ctx.isOwner) return ctx.reply('🚫 فقط صاحب اللعبة يقدر يبدأ').catch(()=>{});
  const players = parsePlayers(g);
  await run('UPDATE million_games SET state=$1 WHERE chat_id=$2', ['playing', chatId]);
  await ctx.reply(
    '🚀 *بدأت اللعبة!*\n\n👥 اللاعبون: *' + players.length + '*\n🔥 حظ موفق للجميع!',
    { parse_mode: 'Markdown' }
  ).catch(()=>{});
  await nextQuestion(ctx, chatId);
}

// ═══ NEXT QUESTION ═══
async function nextQuestion(ctx, chatId) {
  const g = await getGame(chatId);
  if (!g || g.state !== 'playing') return;
  const players = parsePlayers(g);
  if (!players.length) return endGame(ctx, chatId, null);

  const qNum     = (g.current_q || 0) + 1;
  const timeLimit = qNum >= 10 ? 20 : qNum >= 5 ? 15 : 10;
  const prize     = Math.min(100 * qNum, 10000);
  const playedIds = parseIds(g);

  // جلب سؤال غير مستخدم
  let q = null;
  if (playedIds.length) {
    q = await get(
      'SELECT * FROM million_questions WHERE is_active=1 AND id != ALL($1) ORDER BY RANDOM() LIMIT 1',
      [playedIds]
    ).catch(()=>null);
  }
  if (!q) {
    q = await get('SELECT * FROM million_questions WHERE is_active=1 ORDER BY RANDOM() LIMIT 1').catch(()=>null);
  }

  if (!q) {
    await ctx.telegram.sendMessage(chatId, '❌ لا توجد أسئلة! أضف من لوحة التحكم.').catch(()=>{});
    return endGame(ctx, chatId, null);
  }

  playedIds.push(q.id);
  await run('UPDATE million_games SET current_q=$1,prize=$2,played_ids=$3 WHERE chat_id=$4',
    [qNum, prize, JSON.stringify(playedIds), chatId]);
  await run('DELETE FROM million_answers WHERE game_id=$1', [g.id]).catch(()=>{});

  const kb = {
    inline_keyboard: [
      [{ text: '🅐  ' + q.option_a, callback_data: 'mb_ans_A_' + g.id },
       { text: '🅑  ' + q.option_b, callback_data: 'mb_ans_B_' + g.id }],
      [{ text: '🅒  ' + q.option_c, callback_data: 'mb_ans_C_' + g.id },
       { text: '🅓  ' + q.option_d, callback_data: 'mb_ans_D_' + g.id }],
    ]
  };

  const text = buildQText(q, qNum, players.length, prize, timeLimit);
  let qMsg = null;

  if (q.media_file_id && q.media_type === 'photo') {
    qMsg = await ctx.telegram.sendPhoto(chatId, q.media_file_id, {
      caption: text, parse_mode: 'Markdown', reply_markup: kb
    }).catch(()=>null);
  } else if (q.media_file_id && q.media_type === 'video') {
    qMsg = await ctx.telegram.sendVideo(chatId, q.media_file_id, {
      caption: text, parse_mode: 'Markdown', reply_markup: kb
    }).catch(()=>null);
  } else {
    qMsg = await ctx.telegram.sendMessage(chatId, text, {
      parse_mode: 'Markdown', reply_markup: kb
    }).catch(()=>null);
  }

  if (qMsg) await run('UPDATE million_games SET msg_id=$1 WHERE chat_id=$2', [qMsg.message_id, chatId]);

  // countdown
  if (_editTimers.has(chatId)) clearInterval(_editTimers.get(chatId));
  let rem = timeLimit - 1;
  const editT = setInterval(async () => {
    if (rem <= 0) { clearInterval(editT); _editTimers.delete(chatId); return; }
    const gNow = await getGame(chatId).catch(()=>null);
    if (!gNow || gNow.state !== 'playing') { clearInterval(editT); return; }
    const newText = buildQText(q, qNum, parsePlayers(gNow).length, prize, rem);
    if (qMsg) {
      if (q.media_file_id) ctx.telegram.editMessageCaption(chatId, qMsg.message_id, null, newText, { parse_mode: 'Markdown', reply_markup: kb }).catch(()=>{});
      else ctx.telegram.editMessageText(chatId, qMsg.message_id, null, newText, { parse_mode: 'Markdown', reply_markup: kb }).catch(()=>{});
    }
    rem--;
  }, 1000);
  _editTimers.set(chatId, editT);

  if (_timers.has(chatId)) clearTimeout(_timers.get(chatId));
  const t = setTimeout(() => processAnswers(ctx, chatId, q), timeLimit * 1000);
  _timers.set(chatId, t);
}

function buildQText(q, qNum, playersLeft, prize, timeLeft) {
  const diff = q.difficulty === 3 ? '🔴 صعب' : q.difficulty === 2 ? '🟡 متوسط' : '🟢 سهل';
  return (
    '🎮 *Million Battle — السؤال ' + qNum + '*\n' +
    '━━━━━━━━━━━━━━━━\n\n' +
    '❓ ' + q.question + '\n\n' +
    '━━━━━━━━━━━━━━━━\n' +
    '💰 ' + prize + ' نقطة  |  ' +
    '⏳ ' + timeLeft + 'ث  |  ' +
    '👥 ' + playersLeft + '  |  ' + diff
  );
}

// ═══ ANSWER ═══
async function handleAnswer(ctx, answer, gameId) {
  const userId = ctx.from.id;
  const chatId = ctx.callbackQuery?.message?.chat?.id || ctx.chat?.id;
  const g = await getGame(chatId);
  if (!g || g.state !== 'playing' || g.id != gameId) return ctx.answerCbQuery('❌ اللعبة انتهت').catch(()=>{});
  const players = parsePlayers(g);
  if (!players.find(p => p.id === userId)) return ctx.answerCbQuery('❌ أنت خارج اللعبة').catch(()=>{});
  const existing = await get('SELECT 1 FROM million_answers WHERE game_id=$1 AND user_id=$2', [g.id, userId]).catch(()=>null);
  if (existing) return ctx.answerCbQuery('⚠️ جاوبت مسبقاً!').catch(()=>{});
  await run('INSERT INTO million_answers(game_id,user_id,answer) VALUES($1,$2,$3)', [g.id, userId, answer]).catch(()=>{});
  ctx.answerCbQuery('✅ تم تسجيل إجابتك: ' + answer).catch(()=>{});
}

// ═══ PROCESS ═══
async function processAnswers(ctx, chatId, q) {
  if (_timers.has(chatId)) { clearTimeout(_timers.get(chatId)); _timers.delete(chatId); }
  if (_editTimers.has(chatId)) { clearInterval(_editTimers.get(chatId)); _editTimers.delete(chatId); }
  const g = await getGame(chatId);
  if (!g || g.state !== 'playing') return;
  const players = parsePlayers(g);
  const answers = await all('SELECT user_id,answer FROM million_answers WHERE game_id=$1', [g.id]).catch(()=>[]);
  const correct = q.correct;
  const correctIds = new Set(answers.filter(a => a.answer === correct).map(a => a.user_id.toString()));
  const survivors = players.filter(p => correctIds.has(p.id.toString()));
  const eliminated = players.filter(p => !correctIds.has(p.id.toString()));
  const optMap = { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d };

  let text = '━━━━━━━━━━━━━━━━\n';
  text += '✅ *الإجابة الصحيحة:* ' + correct + ' — ' + optMap[correct] + '\n\n';
  if (eliminated.length) text += '❌ *خرج:* ' + eliminated.map(p => p.name).join(', ') + '\n\n';
  if (survivors.length) text += '🔥 *متبقي:* ' + survivors.map(p => p.name).join(', ');
  else text += '😱 *الجميع أخطأ! نكمل بكل اللاعبين*';

  await ctx.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' }).catch(()=>{});

  const next = survivors.length ? survivors : players;
  await run('UPDATE million_games SET players=$1 WHERE chat_id=$2', [JSON.stringify(next), chatId]);
  if (survivors.length === 1) return endGame(ctx, chatId, survivors[0]);
  setTimeout(() => nextQuestion(ctx, chatId), 3000);
}

// ═══ END ═══
async function endGame(ctx, chatId, winner) {
  if (_timers.has(chatId)) { clearTimeout(_timers.get(chatId)); _timers.delete(chatId); }
  if (_editTimers.has(chatId)) { clearInterval(_editTimers.get(chatId)); _editTimers.delete(chatId); }
  await run('UPDATE million_games SET state=$1 WHERE chat_id=$2', ['ended', chatId]);
  const g2 = await getGame(chatId);
  const finalPrize = g2?.prize || 0;
  let text;
  if (winner) {
    try { const { awardPoints } = require('../database/points'); for (let i=0;i<Math.floor(finalPrize/10);i++) awardPoints(winner.id,'rating').catch(()=>{}); } catch(_){}
    text = '🏆━━━━━━━━━━━━━━━━━━━━━━\n\n🎉 *الفائز: ' + winner.name + '*\n\n💰 الجائزة: *' + finalPrize + ' نقطة*\n📊 الأسئلة: *' + (g2?.current_q||0) + '*\n\n━━━━━━━━━━━━━━━━━━━━━━🏆';
  } else {
    text = '🤝 *لا يوجد فائز!*\n\nاكتب *مليون* للعب مجدداً 🎮';
  }
  await ctx.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' }).catch(()=>{});
  setTimeout(() => run('DELETE FROM million_games WHERE chat_id=$1', [chatId]).catch(()=>{}), 30000);
}

async function stopGame(ctx) {
  const g = await getGame(ctx.chat.id);
  if (!g) return ctx.reply('❌ لا توجد لعبة نشطة').catch(()=>{});
  if (g.owner_id != ctx.from.id && !ctx.isOwner) return ctx.reply('🚫 فقط صاحب اللعبة').catch(()=>{});
  await endGame(ctx, ctx.chat.id, null);
}

// ═══ TEXT TRIGGERS ═══
async function handleText(ctx) {
  const text = (ctx.message?.text || '').trim();
  if (text === 'مليون') return startRegistration(ctx);
  if (text === 'أنا' || text === 'انا') return joinGame(ctx);
  if (text === 'ابدأ' || text === 'ابدا') return startGame(ctx);
}

// ═══ OWNER PANEL ═══
async function showQuestionsPanel(ctx) {
  const total = await get('SELECT COUNT(*) as c FROM million_questions WHERE is_active=1').catch(()=>null);
  const qs = await all('SELECT id,question,correct,difficulty FROM million_questions WHERE is_active=1 ORDER BY id DESC LIMIT 15').catch(()=>[]);
  let text = '🎮 *Million Battle — الأسئلة*\n━━━━━━━━━━\n📊 الإجمالي: *' + (total?.c||0) + '*\n\n';
  qs.forEach((q,i) => { text += (i+1) + '. ' + q.question.substring(0,45) + '\n   ✅' + q.correct + ' ⭐'.repeat(q.difficulty||1) + '\n'; });
  if (!qs.length) text += '_لا توجد أسئلة بعد_';
  return ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
    [{ text: '➕ إضافة سؤال', callback_data: 'mb_add_q' }],
    [{ text: '🗑 حذف سؤال', callback_data: 'mb_del_q_menu' }],
    [{ text: '❌ إغلاق', callback_data: 'noop' }],
  ]}}).catch(()=>{});
}

async function handleOwnerCallback(ctx, data) {
  if (data === 'mb_add_q') {
    await global.setState(ctx.uid, { type: 'mb_add_question', step: 'question' });
    return ctx.reply('📝 أرسل السؤال (أو صورة/فيديو مع caption):').catch(()=>{});
  }
  if (data === 'mb_del_q_menu') {
    const qs = await all('SELECT id,question FROM million_questions WHERE is_active=1 ORDER BY id DESC LIMIT 15').catch(()=>[]);
    if (!qs.length) return ctx.answerCbQuery('لا توجد أسئلة').catch(()=>{});
    const rows = qs.map(q => [{ text: '🗑 ' + q.question.substring(0,40), callback_data: 'mb_del_q_' + q.id }]);
    rows.push([{ text: '◀️ رجوع', callback_data: 'mb_panel' }]);
    return ctx.editMessageText('اختر السؤال للحذف:', { reply_markup: { inline_keyboard: rows } }).catch(()=>{});
  }
  if (data.startsWith('mb_del_q_')) {
    await run('UPDATE million_questions SET is_active=0 WHERE id=$1', [data.replace('mb_del_q_','')]).catch(()=>{});
    ctx.answerCbQuery('✅ تم الحذف').catch(()=>{});
    return showQuestionsPanel(ctx);
  }
  if (data === 'mb_panel') return showQuestionsPanel(ctx);
}

async function handleOwnerState(ctx, state) {
  const uid = ctx.uid;
  const text = ctx.message?.text?.trim() || '';
  const msg = ctx.message;
  if (state.type !== 'mb_add_question') return;
  const step = state.step;
  if (step === 'question') {
    const q = msg.caption || text;
    if (!q) return ctx.reply('⚠️ أرسل السؤال كنص أو كـ caption').catch(()=>{});
    const fid = msg.photo ? msg.photo[msg.photo.length-1].file_id : msg.video?.file_id || null;
    const ftype = msg.photo ? 'photo' : msg.video ? 'video' : null;
    await global.setState(uid, { ...state, step: 'option_a', question: q, mediaFileId: fid, mediaType: ftype });
    return ctx.reply('🅐 الخيار A:').catch(()=>{});
  }
  if (step === 'option_a') { await global.setState(uid, { ...state, step: 'option_b', option_a: text }); return ctx.reply('🅑 الخيار B:').catch(()=>{}); }
  if (step === 'option_b') { await global.setState(uid, { ...state, step: 'option_c', option_b: text }); return ctx.reply('🅒 الخيار C:').catch(()=>{}); }
  if (step === 'option_c') { await global.setState(uid, { ...state, step: 'option_d', option_c: text }); return ctx.reply('🅓 الخيار D:').catch(()=>{}); }
  if (step === 'option_d') { await global.setState(uid, { ...state, step: 'correct', option_d: text }); return ctx.reply('✅ الإجابة الصحيحة؟ (A/B/C/D):').catch(()=>{}); }
  if (step === 'correct') {
    const c = text.toUpperCase();
    if (!['A','B','C','D'].includes(c)) return ctx.reply('⚠️ اكتب A أو B أو C أو D!').catch(()=>{});
    await global.setState(uid, { ...state, step: 'difficulty', correct: c });
    return ctx.reply('⭐ الصعوبة؟\n1 = سهل\n2 = متوسط\n3 = صعب').catch(()=>{});
  }
  if (step === 'difficulty') {
    const diff = Math.min(Math.max(parseInt(text)||1, 1), 3);
    await run(
      'INSERT INTO million_questions(question,option_a,option_b,option_c,option_d,correct,media_file_id,media_type,difficulty) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [state.question, state.option_a, state.option_b, state.option_c, state.option_d, state.correct, state.mediaFileId||null, state.mediaType||null, diff]
    );
    await global.delState(uid);
    return ctx.reply('✅ تم إضافة السؤال! 🎮\n\n' + state.question + '\n🅐 ' + state.option_a + '\n🅑 ' + state.option_b + '\n🅒 ' + state.option_c + '\n🅓 ' + state.option_d + '\n✅ الصحيح: ' + state.correct).catch(()=>{});
  }
}

module.exports = { initMillionDB, handleText, handleAnswer, handleOwnerCallback, handleOwnerState, showQuestionsPanel, stopGame };
