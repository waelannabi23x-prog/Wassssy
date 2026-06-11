'use strict';
/**
 * 🏆 من سيربح المليون — v4.0 Clean Edition
 * - رسالة واحدة تُعدَّل (edit) بدل إرسال رسائل جديدة
 * - أزرار تخص اللاعب فقط — غيره يرد عليه "ليست لعبتك"
 * - انتقال سلس بين الأسئلة بدون فوضى
 */

const { run, all, get } = require('../database/db');
const logger = require('../utils/logger');
const runSilent = (q, p) => run(q, p).catch(() => {});

/* ══════════════ CONSTANTS ══════════════ */
const PRIZES = [100,200,300,500,1000,2000,4000,8000,16000,32000,64000,125000,250000,500000,1000000];
const SAFE_ZONES    = [4, 9, 14];
const QUESTION_SECS = 30;
const JOIN_SECS     = 25;
const MAX_PLAYERS   = 30;
const LETTERS       = ['\u0623','\u0628','\u062c','\u062f'];

const LIFELINES = {
  fifty:    { emoji: '5\ufe0f\u20e30\ufe0f\u20e3', name: '50/50'          },
  audience: { emoji: '\ud83d\udc65',               name: '\u0645\u0633\u0627\u0639\u062f\u0629 \u0627\u0644\u062c\u0645\u0647\u0648\u0631' },
  call:     { emoji: '\ud83d\udcde',               name: '\u0645\u0633\u0627\u0639\u062f\u0629 \u0635\u062f\u064a\u0642'  },
  skip:     { emoji: '\u23ed\ufe0f',               name: '\u062a\u062e\u0637\u064a \u0627\u0644\u0633\u0624\u0627\u0644'  },
};

function fmtPrize(n) {
  if (n >= 1000000) return '1,000,000 \u062f\u062c \ud83d\udc8e';
  if (n >= 1000)    return (n/1000).toFixed(n%1000?1:0) + 'k \ud83d\udcb0';
  return n + ' \u062f\u062c';
}
function getDiff(level) {
  if (level < 5)  return 1;
  if (level < 10) return 2;
  return 3;
}

/* ══════════════ GAME STATE ══════════════ */
const _games = new Map();
function getGame(cid)    { return _games.get(String(cid)) || null; }
function setGame(cid, g) { _games.set(String(cid), g); }
function delGame(cid)    { _games.delete(String(cid)); }

function newGame(chatId) {
  return {
    chatId, status: 'waiting',
    players: new Map(),
    currentLevel: 0,
    currentQ: null,
    roundAnswers: new Map(),
    usedQIds: [],
    msgId: null,
    joinMsgId: null,
    timer: null,
    joinTimer: null,
    sessionId: Date.now(),
    answerDeadline: 0,
  };
}

/* ══════════════ DB ══════════════ */
async function initMillionaireSchema() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS million_questions (
      id SERIAL PRIMARY KEY, text TEXT NOT NULL,
      option_a TEXT NOT NULL, option_b TEXT NOT NULL,
      option_c TEXT NOT NULL, option_d TEXT NOT NULL,
      correct CHAR(1) NOT NULL CHECK (correct IN ('a','b','c','d')),
      difficulty TEXT DEFAULT 'medium', specialty_id INTEGER DEFAULT 0,
      used_count INTEGER DEFAULT 0,
      is_active SMALLINT DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS million_scores (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      chat_id BIGINT NOT NULL,
      score INTEGER DEFAULT 0,
      level_reached INTEGER DEFAULT 0,
      won BOOLEAN DEFAULT FALSE,
      played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE million_scores ADD COLUMN IF NOT EXISTS user_id BIGINT`,
    `ALTER TABLE million_scores ADD COLUMN IF NOT EXISTS chat_id BIGINT`,
    `CREATE INDEX IF NOT EXISTS idx_mq_active ON million_questions(is_active)`,
    `CREATE INDEX IF NOT EXISTS idx_ms_user   ON million_scores(user_id)`,
  ];
  for (const q of tables) await run(q,[]).catch(()=>{});
}

async function getRandomQuestion(usedIds, diff) {
  const ex = usedIds.length ? `AND id NOT IN (${usedIds.join(',')})` : '';
  // جرب نفس الصعوبة أولاً
  let q = await get(
    `SELECT * FROM million_questions WHERE is_active=1 AND difficulty=$1 ${ex} ORDER BY random() LIMIT 1`,
    [diff]
  ).catch(()=>null);
  // fallback: أي سؤال متاح
  if (!q) q = await get(
    `SELECT * FROM million_questions WHERE is_active=1 ${ex} ORDER BY random() LIMIT 1`, []
  ).catch(()=>null);
  // fallback: كل الأسئلة استُخدمت — reset
  if (!q) {
    await run('UPDATE million_questions SET used_count=0 WHERE is_active=1', []).catch(()=>{});
    q = await get(
      'SELECT * FROM million_questions WHERE is_active=1 AND difficulty=$1 ORDER BY random() LIMIT 1',
      [diff]
    ).catch(()=>null);
    if (!q) q = await get(
      'SELECT * FROM million_questions WHERE is_active=1 ORDER BY random() LIMIT 1', []
    ).catch(()=>null);
  }
  require('../utils/logger').info('[getQ] diff=' + diff + ' found=' + (q ? q.id : 'null'));
  return q || null;
}

/* ══════════════ BUILD MESSAGES ══════════════ */
function buildJoinMsg(game) {
  const count = game.players.size;
  const names = [...game.players.values()].map(p => p.name).join(' | ') || '\u2014';
  return (
    '\ud83c\udfae *\u0645\u0646 \u0633\u064a\u0631\u0628\u062d \u0627\u0644\u0645\u0644\u064a\u0648\u0646\u061f*\n' +
    '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n' +
    '\ud83d\udc65 \u0627\u0644\u0644\u0627\u0639\u0628\u0648\u0646 (' + count + '): ' + names + '\n\n' +
    '\u23f3 \u0644\u062f\u064a\u0643 *' + JOIN_SECS + ' \u062b\u0627\u0646\u064a\u0629* \u0644\u0644\u0627\u0646\u0636\u0645\u0627\u0645\n' +
    '\ud83c\udfc6 \u0627\u0644\u062c\u0627\u0626\u0632\u0629: *1,000,000 \u062f\u062c*\n\n' +
    '\ud83d\udc47 \u0627\u0636\u063a\u0637 *\u0627\u0646\u0636\u0645* \u0644\u0644\u062f\u062e\u0648\u0644!'
  );
}

function buildQuestionMsg(game, q) {
  const level  = game.currentLevel + 1;
  const prize  = fmtPrize(PRIZES[game.currentLevel]);
  const safe   = SAFE_ZONES.find(s => s > game.currentLevel);
  const safeStr = safe !== undefined ? fmtPrize(PRIZES[safe]) : '\u2014';
  const bar    = '\u25c6' + '\u25c7'.repeat(game.currentLevel) + '\u25a1'.repeat(14 - game.currentLevel);
  const opts   = ['a','b','c','d'];
  const hidden = game.hiddenOpts || [];
  let optsTxt  = '';
  opts.forEach((l,i) => {
    if (hidden.includes(l)) return;
    optsTxt += LETTERS[i] + ') ' + (q['option_'+l]||'') + '\n';
  });
  return (
    '\ud83c\udfaf *\u0627\u0644\u0633\u0624\u0627\u0644 ' + level + ' \u0645\u0646 15*\n' +
    '\u2022 ' + getDiff(game.currentLevel).replace('easy','\ud83d\udfe2 \u0633\u0647\u0644').replace('medium','\ud83d\udfe1 \u0648\u0633\u0637').replace('hard','\ud83d\udd34 \u0635\u0639\u0628') +
    ' \u2022 ' + prize + '\n' +
    bar + '\n\n' +
    '\u2753 *' + (q.text||q.question||'\u0633\u0624\u0627\u0644') + '*\n\n' +
    optsTxt + '\n' +
    '\ud83d\udc65 \u0627\u0644\u0644\u0627\u0639\u0628\u0648\u0646 \u0627\u0644\u0646\u0634\u0637\u0648\u0646: ' + [...game.players.values()].filter(p=>p.alive).length + '\n' +
    '\u23f0 \u0627\u0644\u0648\u0642\u062a: ' + QUESTION_SECS + ' \u062b\u0627\u0646\u064a\u0629\n' +
    (safe !== undefined ? '\ud83d\udee1 \u0623\u0645\u0627\u0646: ' + safeStr + ' (\u0633\u0624\u0627\u0644 ' + (safe+1) + ')' : '')
  );
}

function buildAnswerKeyboard(game, q, sessionId) {
  const opts = ['a','b','c','d'];
  const hidden = game.hiddenOpts || [];
  const visible = opts.filter(l => !hidden.includes(l));
  const rows = [];
  for (let i = 0; i < visible.length; i += 2) {
    const row = visible.slice(i, i+2).map(l => ({
      text: LETTERS[opts.indexOf(l)] + ') ' + (q['option_'+l]||'').substring(0,20),
      callback_data: 'mar_' + l + '_' + sessionId,
    }));
    rows.push(row);
  }
  return rows;
}

function buildLifelineKeyboard(game) {
  const btns = [];
  for (const [k, v] of Object.entries(LIFELINES)) {
    const player = [...game.players.values()][0];
    const used   = player ? !player.lifelines[k] : false;
    if (!used) btns.push({ text: v.emoji + ' ' + v.name, callback_data: 'mlr_' + k });
  }
  const rows = [];
  for (let i = 0; i < btns.length; i += 2) rows.push(btns.slice(i, i+2));
  return rows;
}

/* ══════════════ GAME FLOW ══════════════ */
async function startJoinPhase(ctx) {
  const chatId = ctx.chat.id;
  if (getGame(chatId)) {
    return ctx.reply('\u26a0\ufe0f \u0647\u0646\u0627\u0643 \u0644\u0639\u0628\u0629 \u062c\u0627\u0631\u064a\u0629!').catch(()=>{});
  }
  const qCount = await get('SELECT COUNT(*) as c FROM million_questions WHERE is_active=1').catch(()=>({c:0}));
  if (!qCount || parseInt(qCount.c) < 5) {
    return ctx.reply('\u26a0\ufe0f \u0639\u062f\u062f \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u063a\u064a\u0631 \u0643\u0627\u0641\u064d! \u0623\u0636\u0641 \u0623\u0633\u0626\u0644\u0629 \u0623\u0648\u0644\u0627\u064b.').catch(()=>{});
  }

  const game = newGame(chatId);
  setGame(chatId, game);

  const msg = await ctx.reply(buildJoinMsg(game), {
    parse_mode: 'Markdown',
    reply_to_message_id: ctx.message?.message_id,
    allow_sending_without_reply: true,
    reply_markup: { inline_keyboard: [
      [{ text: '\ud83d\ude80 \u0627\u0646\u0636\u0645!', callback_data: 'mlr_join' }],
      [{ text: '\u25b6\ufe0f \u0627\u0628\u062f\u0623 \u0627\u0644\u0622\u0646', callback_data: 'mlr_forcestart' }, { text: '\ud83d\udd34 \u0625\u0644\u063a\u0627\u0621', callback_data: 'mlr_cancel' }],
    ]},
  }).catch(()=>null);

  if (msg) game.joinMsgId = msg.message_id;

  game.joinTimer = setTimeout(async () => {
    await beginGame(ctx.telegram, chatId);
  }, JOIN_SECS * 1000);
}

async function joinGame(ctx) {
  const chatId = ctx.callbackQuery?.message?.chat?.id || ctx.chat?.id;
  if (!chatId) return ctx.answerCbQuery('❌ خطأ').catch(()=>{});
  const game   = getGame(chatId);
  if (!game || game.status !== 'waiting') return ctx.answerCbQuery('⚠️ لا توجد لعبة للانضمام.', { show_alert: true }).catch(()=>{});
  if (game.players.size >= MAX_PLAYERS) return ctx.answerCbQuery('\u26a0\ufe0f \u0627\u0644\u0644\u0639\u0628\u0629 \u0645\u0645\u062a\u0644\u0626\u0629!', { show_alert: true }).catch(()=>{});

  const uid  = ctx.from.id;
  const name = ctx.from.first_name || '\u0644\u0627\u0639\u0628';
  if (game.players.has(uid)) return ctx.answerCbQuery('\u0623\u0646\u062a \u0645\u0633\u062c\u0644 \u0628\u0627\u0644\u0641\u0639\u0644! \u2705').catch(()=>{});

  game.players.set(uid, {
    id: uid, name, username: ctx.from.username || '',
    alive: true, prize: 0, level: 0,
    lifelines: { fifty: true, audience: true, call: true, skip: true },
    answers: [], joinedAt: Date.now(),
  });

  await ctx.answerCbQuery('\u2705 \u0645\u0631\u062d\u0628\u0627\u064b ' + name + '!').catch(()=>{});

  if (game.joinMsgId) {
    ctx.telegram.editMessageText(chatId, game.joinMsgId, null, buildJoinMsg(game), {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [
        [{ text: '\ud83d\ude80 \u0627\u0646\u0636\u0645! (' + game.players.size + ')', callback_data: 'mlr_join' }],
        [{ text: '\u25b6\ufe0f \u0627\u0628\u062f\u0623 \u0627\u0644\u0622\u0646', callback_data: 'mlr_forcestart' }, { text: '\ud83d\udd34 \u0625\u0644\u063a\u0627\u0621', callback_data: 'mlr_cancel' }],
      ]},
    }).catch(()=>{});
  }
}

async function forceStart(ctx) {
  const chatId = ctx.callbackQuery?.message?.chat?.id || ctx.chat?.id;
  const game   = getGame(chatId);
  if (!game || game.status !== 'waiting') return ctx.answerCbQuery().catch(()=>{});
  if (game.joinTimer) { clearTimeout(game.joinTimer); game.joinTimer = null; }
  ctx.answerCbQuery('\ud83d\ude80 \u062c\u0627\u0631\u064a \u0627\u0644\u0625\u0637\u0644\u0627\u0642!').catch(()=>{});
  await beginGame(ctx.telegram, chatId);
}

async function cancelGame(ctx) {
  const chatId = ctx.callbackQuery?.message?.chat?.id || ctx.chat?.id;
  const game   = getGame(chatId);
  if (!game) return ctx.answerCbQuery().catch(()=>{});
  if (game.joinTimer)  clearTimeout(game.joinTimer);
  if (game.timer)      clearTimeout(game.timer);
  if (game.joinMsgId)  ctx.telegram.deleteMessage(chatId, game.joinMsgId).catch(()=>{});
  if (game.msgId)      ctx.telegram.deleteMessage(chatId, game.msgId).catch(()=>{});
  delGame(chatId);
  ctx.answerCbQuery('\ud83d\udd34 \u062a\u0645 \u0627\u0644\u0625\u0644\u063a\u0627\u0621').catch(()=>{});
}

async function beginGame(telegram, chatId) {
  const game = getGame(chatId);
  if (!game) return;
  if (game.status !== 'waiting') return;

  if (game.players.size === 0) {
    if (game.joinMsgId) telegram.deleteMessage(chatId, game.joinMsgId).catch(()=>{});
    delGame(chatId);
    return telegram.sendMessage(chatId, '\u274c \u0644\u0627 \u064a\u0648\u062c\u062f \u0644\u0627\u0639\u0628\u0648\u0646!').catch(()=>{});
  }

  game.status = 'playing';
  if (game.joinMsgId) {
    telegram.editMessageText(chatId, game.joinMsgId, null,
      '🎮 *بدأت اللعبة!* انتبه للسؤال...',
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [] } }
    ).catch(()=>{});
    game.joinMsgId = null;
  }
  await new Promise(r => setTimeout(r, 1500));
  await sendNextQuestion(telegram, chatId);
}

async function sendNextQuestion(telegram, chatId) {
  const game = getGame(chatId);
  if (!game || game.status !== 'playing') return;

  const alive = [...game.players.values()].filter(p => p.alive);
  if (alive.length === 0) return endGame(telegram, chatId, 'all_eliminated');
  if (game.currentLevel >= PRIZES.length) return endGame(telegram, chatId, 'complete');

  const q = await getRandomQuestion(game.usedQIds, getDiff(game.currentLevel));
  if (!q) {
    await telegram.sendMessage(chatId, '\u274c \u0646\u0641\u062f\u062a \u0627\u0644\u0623\u0633\u0626\u0644\u0629!').catch(()=>{});
    return endGame(telegram, chatId, 'no_questions');
  }

  game.currentQ = q;
  game.hiddenOpts = [];
  game.roundAnswers.clear();
  game.usedQIds.push(q.id);
  game.answerDeadline = Date.now() + QUESTION_SECS * 1000;
  runSilent('UPDATE million_questions SET used_count=used_count+1 WHERE id=$1', [q.id]);

  const txt      = buildQuestionMsg(game, q);
  const keyboard = [...buildAnswerKeyboard(game, q, game.sessionId), ...buildLifelineKeyboard(game)];

  if (game.msgId) {
    const edited = await telegram.editMessageText(chatId, game.msgId, null, txt, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard },
    }).catch(()=>null);
    if (!edited) {
      const m = await telegram.sendMessage(chatId, txt, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard },
        reply_to_message_id: game.msgId || undefined,
      }).catch(()=>null);
      if (m) game.msgId = m.message_id;
    }
  } else {
    const m = await telegram.sendMessage(chatId, txt, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard },
    }).catch(()=>null);
    if (m) game.msgId = m.message_id;
  }

  if (game.timer) clearTimeout(game.timer);
  game.timer = setTimeout(() => resolveQuestion(telegram, chatId, true), QUESTION_SECS * 1000);
}

async function handleAnswer(ctx, letter) {
  const chatId = ctx.callbackQuery?.message?.chat?.id || ctx.chat?.id;
  const uid    = ctx.from.id;
  const game   = getGame(chatId);

  if (!game || game.status !== 'playing') return ctx.answerCbQuery('\u26a0\ufe0f \u0644\u0627 \u062a\u0648\u062c\u062f \u0644\u0639\u0628\u0629 \u0646\u0634\u0637\u0629.').catch(()=>{});

  // تحقق أن هذا لاعب في اللعبة
  if (!game.players.has(uid)) {
    return ctx.answerCbQuery('\u26d4 \u0647\u0630\u0647 \u0644\u064a\u0633\u062a \u0644\u0639\u0628\u062a\u0643!', { show_alert: true }).catch(()=>{});
  }

  const player = game.players.get(uid);
  if (!player.alive) return ctx.answerCbQuery('\u274c \u0644\u0642\u062f \u062e\u0631\u062c\u062a \u0645\u0646 \u0627\u0644\u0644\u0639\u0628\u0629.').catch(()=>{});
  if (game.roundAnswers.has(uid)) return ctx.answerCbQuery('\u2705 \u0625\u062c\u0627\u0628\u062a\u0643 \u0645\u0633\u062c\u0644\u0629\u060c \u0627\u0646\u062a\u0638\u0631 \u0627\u0644\u0646\u062a\u064a\u062c\u0629.').catch(()=>{});
  if (Date.now() > game.answerDeadline) return ctx.answerCbQuery('\u23f0 \u0627\u0646\u062a\u0647\u0649 \u0627\u0644\u0648\u0642\u062a!').catch(()=>{});

  game.roundAnswers.set(uid, letter);
  const optText = game.currentQ?.['option_'+letter] || '';
  await ctx.answerCbQuery('\u2705 \u0633\u062c\u0644\u0646\u0627 \u0625\u062c\u0627\u0628\u062a\u0643: ' + LETTERS['abcd'.indexOf(letter)] + ') ' + optText.substring(0,30)).catch(()=>{});

  const alive = [...game.players.values()].filter(p => p.alive);
  if (game.roundAnswers.size >= alive.length) {
    if (game.timer) { clearTimeout(game.timer); game.timer = null; }
    await resolveQuestion(ctx.telegram, chatId, false);
  }
}

async function resolveQuestion(telegram, chatId, timeout) {
  const game = getGame(chatId);
  if (!game || game.status !== 'playing') return;
  if (game.timer) { clearTimeout(game.timer); game.timer = null; }

  const q       = game.currentQ;
  if (!q) return endGame(telegram, chatId, 'error');
  const correct = (q.correct || 'a').toLowerCase().trim();
  const prize   = PRIZES[game.currentLevel];
  const isSafe  = SAFE_ZONES.includes(game.currentLevel);

  const results = { correct: [], wrong: [], noAnswer: [] };
  for (const p of game.players.values()) {
    if (!p.alive) continue;
    const ans = game.roundAnswers.get(p.id);
    if (!ans)             { results.noAnswer.push(p); p.alive = false; }
    else if (ans===correct) { results.correct.push(p); p.prize = prize; p.level = game.currentLevel+1; }
    else                  { results.wrong.push(p);   p.alive = false; }
  }

  if (isSafe) {
    for (const p of game.players.values()) {
      if (!p.alive && p.prize === 0) p.prize = prize;
    }
  }

  const correctOpt  = q['option_'+correct] || '؟';
  const correctList = results.correct.map(p=>'✅ '+p.name).join('  ');
  const wrongList   = results.wrong.map(p=>'❌ '+p.name).join('  ');
  const noAnsList   = results.noAnswer.map(p=>'⏰ '+p.name).join('  ');
  const aliveAfter  = [...game.players.values()].filter(p=>p.alive);

  let txt = (timeout ? '\u23f0 \u0627\u0646\u062a\u0647\u0649 \u0627\u0644\u0648\u0642\u062a!\n\n' : '') +
    '\u2705 *\u0627\u0644\u0625\u062c\u0627\u0628\u0629 \u0627\u0644\u0635\u062d\u064a\u062d\u0629:* ' + LETTERS['abcd'.indexOf(correct)] + ') ' + correctOpt + '\n\n';
  if (correctList) txt += '\ud83c\udf89 *\u0623\u0635\u0627\u0628\u0648\u0627:*\n' + correctList + '\n\n';
  if (wrongList)   txt += '\ud83d\udca5 *\u0623\u062e\u0637\u0623\u0648\u0627:*\n' + wrongList + '\n\n';
  if (noAnsList)   txt += '\u23f0 *\u0644\u0645 \u064a\u062c\u064a\u0628\u0648\u0627:*\n' + noAnsList + '\n\n';
  if (aliveAfter.length > 0) txt += '\ud83d\udc65 *\u0627\u0644\u0628\u0627\u0642\u0648\u0646: ' + aliveAfter.length + '*\n';
  if (isSafe) txt += '\n\ud83d\udee1\ufe0f *\u0646\u0642\u0637\u0629 \u0623\u0645\u0627\u0646 \u0645\u062d\u0642\u0642\u0629!*';

  if (game.msgId) {
    await telegram.editMessageText(chatId, game.msgId, null, txt, {
      parse_mode: 'Markdown', reply_markup: { inline_keyboard: [] }
    }).catch(()=>{});
  }

  await new Promise(r => setTimeout(r, 3500));

  if (aliveAfter.length === 0) return endGame(telegram, chatId, 'all_eliminated');
  if (game.currentLevel >= PRIZES.length - 1) return endGame(telegram, chatId, 'complete');

  game.currentLevel++;
  await sendNextQuestion(telegram, chatId);
}

async function endGame(telegram, chatId, reason) {
  const game = getGame(chatId);
  if (!game) return;
  if (game.timer)     clearTimeout(game.timer);
  if (game.joinTimer) clearTimeout(game.joinTimer);
  game.status = 'ended';

  const sorted = [...game.players.values()].sort((a,b) => b.prize - a.prize);
  const trophies = ['\ud83e\udd47','\ud83e\udd48','\ud83e\udd49'];
  let txt = '\ud83c\udfc1 *\u0627\u0646\u062a\u0647\u062a \u0627\u0644\u0644\u0639\u0628\u0629!*\n\n';

  const reasonTxt = {
    complete:      '\ud83c\udf89 \u0627\u0643\u062a\u0645\u0644 \u0627\u0644\u0644\u0627\u0639\u0628\u0648\u0646 \u0643\u0644 \u0627\u0644\u0623\u0633\u0626\u0644\u0629!',
    all_eliminated:'\ud83d\udca5 \u062e\u0631\u062c \u062c\u0645\u064a\u0639 \u0627\u0644\u0644\u0627\u0639\u0628\u064a\u0646!',
    no_questions:  '\u274c \u0646\u0641\u062f\u062a \u0627\u0644\u0623\u0633\u0626\u0644\u0629!',
    stopped:       '\ud83d\udd34 \u062a\u0645 \u0625\u064a\u0642\u0627\u0641 \u0627\u0644\u0644\u0639\u0628\u0629.',
    error:         '\u26a0\ufe0f \u062e\u0637\u0623 \u062a\u0642\u0646\u064a.',
  };
  txt += (reasonTxt[reason] || '') + '\n\n';

  if (sorted.length > 0) {
    txt += '\ud83c\udfc6 *\u0627\u0644\u062a\u0631\u062a\u064a\u0628 \u0627\u0644\u0646\u0647\u0627\u0626\u064a:*\n';
    sorted.slice(0,10).forEach((p,i) => {
      const trophy = trophies[i] || '\ud83d\udd35';
      txt += trophy + ' ' + p.name + ': *' + fmtPrize(p.prize) + '*\n';
    });
  }

  for (const p of sorted) {
    if (p.prize > 0) {
      await run('UPDATE users SET coins=COALESCE(coins,0)+$1 WHERE user_id=$2', [p.prize, p.id]).catch(()=>{});
      await run('INSERT INTO million_scores(user_id,chat_id,score,level_reached,won) VALUES($1,$2,$3,$4,$5)',
        [p.id, chatId, p.prize, p.level, p.level >= 15]).catch(e => require('../utils/logger').debug('[ms insert]', e.message));
    }
  }

  if (game.msgId) {
    await telegram.editMessageText(chatId, game.msgId, null, txt, {
      parse_mode: 'Markdown', reply_markup: { inline_keyboard: [] }
    }).catch(() => telegram.sendMessage(chatId, txt, { parse_mode: 'Markdown' }).catch(()=>{}));
  } else {
    await telegram.sendMessage(chatId, txt, { parse_mode: 'Markdown' }).catch(()=>{});
  }

  delGame(chatId);
}

async function stopGame(ctx) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const game = getGame(chatId);
  if (!game) return ctx.reply('\u26a0\ufe0f \u0644\u0627 \u062a\u0648\u062c\u062f \u0644\u0639\u0628\u0629 \u062c\u0627\u0631\u064a\u0629.').catch(()=>{});
  await endGame(ctx.telegram, chatId, 'stopped');
  ctx.reply('\ud83d\udd34 \u062a\u0645 \u0625\u064a\u0642\u0627\u0641 \u0627\u0644\u0644\u0639\u0628\u0629.').catch(()=>{});
}

async function useLifeline(ctx, type) {
  const chatId = ctx.callbackQuery?.message?.chat?.id || ctx.chat?.id;
  const uid    = ctx.from.id;
  const game   = getGame(chatId);
  if (!game || game.status !== 'playing') return ctx.answerCbQuery('\u26a0\ufe0f').catch(()=>{});
  if (!game.players.has(uid)) return ctx.answerCbQuery('\u26d4 \u0647\u0630\u0647 \u0644\u064a\u0633\u062a \u0644\u0639\u0628\u062a\u0643!', { show_alert: true }).catch(()=>{});
  const player = game.players.get(uid);
  if (!player.alive) return ctx.answerCbQuery('\u274c \u0644\u0642\u062f \u062e\u0631\u062c\u062a.').catch(()=>{});
  if (!player.lifelines[type]) return ctx.answerCbQuery('\u274c \u0627\u0633\u062a\u062e\u062f\u0645\u062a \u0647\u0630\u0647 \u0627\u0644\u0645\u0633\u0627\u0639\u062f\u0629 \u0645\u0633\u0628\u0642\u0627\u064b.', { show_alert: true }).catch(()=>{});

  player.lifelines[type] = false;
  const q = game.currentQ;

  if (type === 'fifty') {
    const wrong = ['a','b','c','d'].filter(l => l !== q.correct);
    const hide  = wrong.sort(()=>Math.random()-0.5).slice(0,2);
    game.hiddenOpts = hide;
    await ctx.answerCbQuery('\u2705 \u062a\u0645 \u062a\u0637\u0628\u064a\u0642 50/50!').catch(()=>{});
  } else if (type === 'skip') {
    await ctx.answerCbQuery('\u23ed\ufe0f \u062a\u0645 \u062a\u062e\u0637\u064a \u0627\u0644\u0633\u0624\u0627\u0644!').catch(()=>{});
    if (game.timer) { clearTimeout(game.timer); game.timer = null; }
    game.currentLevel++;
    return sendNextQuestion(ctx.telegram, chatId);
  } else if (type === 'audience') {
    await ctx.answerCbQuery('\ud83d\udc65 \u0645\u0633\u0627\u0639\u062f\u0629 \u0627\u0644\u062c\u0645\u0647\u0648\u0631!').catch(()=>{});
    const correct = q.correct;
    const dist = {};
    ['a','b','c','d'].forEach(l => { dist[l] = l === correct ? Math.floor(Math.random()*30)+40 : Math.floor(Math.random()*20); });
    const total = Object.values(dist).reduce((a,b)=>a+b,0);
    let poll = '\ud83d\udcca *\u0631\u0623\u064a \u0627\u0644\u062c\u0645\u0647\u0648\u0631:*\n';
    ['a','b','c','d'].forEach((l,i) => {
      const pct = Math.round(dist[l]/total*100);
      poll += LETTERS[i] + ') ' + '\u2588'.repeat(Math.round(pct/5)) + ' ' + pct + '%\n';
    });
    const m = await ctx.telegram.sendMessage(chatId, poll, { parse_mode: 'Markdown' }).catch(()=>null);
    if (m) setTimeout(() => ctx.telegram.deleteMessage(chatId, m.message_id).catch(()=>{}), 10000);
    return;
  } else if (type === 'call') {
    await ctx.answerCbQuery('\ud83d\udcde \u0645\u0633\u0627\u0639\u062f\u0629 \u0635\u062f\u064a\u0642!').catch(()=>{});
    const hint = '\ud83d\udcde *\u0635\u062f\u064a\u0642\u0643 \u064a\u0642\u0648\u0644:*\n\u0623\u0638\u0646 \u0627\u0644\u0625\u062c\u0627\u0628\u0629 \u0647\u064a *' + LETTERS['abcd'.indexOf(q.correct)] + ')* \u2014 \u0644\u0643\u0646\u064a \u0644\u0633\u062a \u0645\u062a\u0623\u0643\u062f\u0627\u064b!';
    const m = await ctx.telegram.sendMessage(chatId, hint, { parse_mode: 'Markdown' }).catch(()=>null);
    if (m) setTimeout(() => ctx.telegram.deleteMessage(chatId, m.message_id).catch(()=>{}), 10000);
    return;
  }

  // refresh keyboard after fifty
  const keyboard = [...buildAnswerKeyboard(game, q, game.sessionId), ...buildLifelineKeyboard(game)];
  if (game.msgId) {
    ctx.telegram.editMessageReplyMarkup(chatId, game.msgId, null, { inline_keyboard: keyboard }).catch(()=>{});
  }
}

async function showRanking(ctx) {
  const rows = await all(
    'SELECT u.first_name, SUM(s.score) as total FROM million_scores s JOIN users u ON u.user_id=s.user_id GROUP BY u.user_id, u.first_name ORDER BY total DESC LIMIT 10'
  ).catch(()=>[]);
  if (!rows.length) return ctx.answerCbQuery('\u0644\u0627 \u064a\u0648\u062c\u062f \u0625\u062d\u0635\u0627\u0626\u064a\u0627\u062a \u0628\u0639\u062f.', { show_alert: true }).catch(()=>{});
  const trophies = ['\ud83e\udd47','\ud83e\udd48','\ud83e\udd49'];
  let txt = '\ud83c\udfc6 *\u0623\u0641\u0636\u0644 \u0627\u0644\u0644\u0627\u0639\u0628\u064a\u0646:*\n\n';
  rows.forEach((r,i) => { txt += (trophies[i]||'\ud83d\udd35') + ' ' + r.first_name + ': *' + fmtPrize(Number(r.total)) + '*\n'; });
  ctx.answerCbQuery().catch(()=>{});
  return ctx.reply(txt, { parse_mode: 'Markdown' }).catch(()=>{});
}

/* ══════════════ CALLBACK HANDLER ══════════════ */
async function handleCallback(ctx, d) {
  try {
    if (!d) d = ctx.callbackQuery?.data;
    if (d === 'mlr_join')       return joinGame(ctx);
    if (d === 'mlr_forcestart') return forceStart(ctx);
    if (d === 'mlr_cancel')     return cancelGame(ctx);
    if (d === 'mlr_ranking')    return showRanking(ctx);
    if (d === 'mlr_howto')      return ctx.answerCbQuery('\u0627\u0643\u062a\u0628 \u0645\u0644\u064a\u0648\u0646 \u0641\u064a \u0627\u0644\u0642\u0631\u0648\u0628 \u0644\u0628\u062f\u0621 \u0627\u0644\u0644\u0639\u0628\u0629!', { show_alert: true }).catch(()=>{});
    if (d.startsWith('mar_')) {
      const parts  = d.split('_');
      const letter = parts[1];
      const sid    = parseInt(parts[2]);
      const game   = getGame(ctx.chat.id);
      if (game && sid !== game.sessionId) return ctx.answerCbQuery('\u274c \u0647\u0630\u0647 \u0623\u0632\u0631\u0627\u0631 \u0633\u0624\u0627\u0644 \u0642\u062f\u064a\u0645!', { show_alert: true }).catch(()=>{});
      return handleAnswer(ctx, letter);
    }
    if (d.startsWith('mlr_')) {
      const type = d.substring(4);
      if (['fifty','audience','call','skip'].includes(type)) return useLifeline(ctx, type);
      return ctx.answerCbQuery().catch(()=>{});
    }
  } catch(e) {
    ctx.answerCbQuery('\u274c ' + e.message).catch(()=>{});
  }
}

/* ══════════════ REGISTER ══════════════ */
function register(bot) {
  bot.command(['million','مليون'], async ctx => {
    if (!['group','supergroup'].includes(ctx.chat?.type)) {
      return ctx.reply('\ud83c\udfae \u0647\u0630\u0647 \u0627\u0644\u0644\u0639\u0628\u0629 \u0644\u0644\u0642\u0631\u0648\u0628\u0627\u062a \u0641\u0642\u0637!').catch(()=>{});
    }
    await startJoinPhase(ctx);
  });
  bot.command(['mstop'], async ctx => {
    if (!ctx.isAdmin && !ctx.isOwner) return ctx.reply('\ud83d\udeab').catch(()=>{});
    await stopGame(ctx);
  });
  bot.command(['mtop'], ctx => showRanking(ctx));
}

module.exports = { stopGame, register, initMillionaireSchema, startJoinPhase, handleCallback };
