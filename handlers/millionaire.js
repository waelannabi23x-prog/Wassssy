'use strict';
/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║       🏆 من سيربح المليون — Enterprise Edition v3.0            ║
 * ║   Full Group Game · Lifelines · Leaderboard · Multi-Round      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * التركيب في index.js:
 *   const millionaire = require('./handlers/millionaire');
 *   millionaire.register(bot);
 *
 * Commands:
 *   /million        — بدء لعبة جديدة في القروب
 *   /mstop          — إيقاف اللعبة (للأدمن)
 *   /mtop           — لوحة المتصدرين
 *   /maddq          — إضافة سؤال (للأدمن)  [في PV]
 *   /mstats         — إحصائياتي
 */

const { run, all, get, runSilent } = require('../database/db');
const logger = require('../utils/logger');

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const PRIZES = [
  100, 200, 300, 500, 1000,
  2000, 4000, 8000, 16000, 32000,
  64000, 125000, 250000, 500000, 1000000,
];

const SAFE_ZONES    = [4, 9, 14];  // indexes (0-based) = 5k, 32k, 1M

async function _notify(telegram, chatId, text, opts = {}, deleteAfterMs = 0) {
  try {
    const m = await telegram.sendMessage(chatId, text, { parse_mode: "Markdown", ...opts });
    if (deleteAfterMs > 0 && m) {
      setTimeout(() => telegram.deleteMessage(chatId, m.message_id).catch(() => {}), deleteAfterMs);
    }
    return m;
  } catch(_) { return null; }
}

const QUESTION_SECS = 30;          // seconds per question
const JOIN_SECS     = 20;          // seconds to join before game starts
const MAX_PLAYERS   = 30;

const DIFFICULTY = { easy: '🟢', medium: '🟡', hard: '🔴' };
const LETTERS    = ['أ', 'ب', 'ج', 'د'];
const TROPHIES   = ['🥇', '🥈', '🥉'];

const LIFELINES = {
  fifty:    { key: 'fifty',    emoji: '5️⃣0️⃣', name: 'المساعدة 50/50'        },
  audience: { key: 'audience', emoji: '👥',    name: 'مساعدة الجمهور'        },
  call:     { key: 'call',     emoji: '📞',    name: 'مساعدة صديق في القروب' },
  skip:     { key: 'skip',     emoji: '⏭️',   name: 'تخطي السؤال (مرة)'     },
};

/* ═══════════════════════════════════════════════════════════════
   SCHEMA INIT  (call once at startup)
═══════════════════════════════════════════════════════════════ */
async function initMillionaireSchema() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS million_questions (
      id          SERIAL PRIMARY KEY,
      text        TEXT NOT NULL,
      option_a    TEXT NOT NULL,
      option_b    TEXT NOT NULL,
      option_c    TEXT NOT NULL,
      option_d    TEXT NOT NULL,
      correct     CHAR(1) NOT NULL CHECK (correct IN ('a','b','c','d')),
      difficulty  TEXT DEFAULT 'medium',
      specialty_id INTEGER DEFAULT 0,
      category    TEXT DEFAULT 'عام',
      used_count  INTEGER DEFAULT 0,
      added_by    BIGINT,
      is_active   SMALLINT DEFAULT 1,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS million_sessions (
      id          SERIAL PRIMARY KEY,
      chat_id     BIGINT NOT NULL,
      status      TEXT DEFAULT 'waiting',
      current_q   INTEGER DEFAULT 0,
      started_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ended_at    TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS million_players (
      session_id  INTEGER NOT NULL,
      user_id     BIGINT NOT NULL,
      first_name  TEXT,
      username    TEXT,
      level       INTEGER DEFAULT 0,
      prize       INTEGER DEFAULT 0,
      lifelines   JSONB DEFAULT '{"fifty":true,"audience":true,"call":true,"skip":true}',
      is_alive    SMALLINT DEFAULT 1,
      answer_time INTEGER DEFAULT 0,
      PRIMARY KEY (session_id, user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS million_scores (
      user_id     BIGINT PRIMARY KEY,
      first_name  TEXT,
      username    TEXT,
      best_prize  INTEGER DEFAULT 0,
      total_games INTEGER DEFAULT 0,
      wins        INTEGER DEFAULT 0,
      total_prize BIGINT DEFAULT 0,
      updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
  ];
  for (const t of tables) await run(t).catch(err => { require('../utils/logger').debug("[silent]", err.message); });

  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_mq_difficulty ON million_questions(difficulty) WHERE is_active=1`,
    `CREATE INDEX IF NOT EXISTS idx_mq_used ON million_questions(used_count) WHERE is_active=1`,
    `CREATE INDEX IF NOT EXISTS idx_ms_chat ON million_sessions(chat_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_mscores_prize ON million_scores(best_prize DESC)`,
  ];
  for (const i of indexes) await run(i).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
}

/* ═══════════════════════════════════════════════════════════════
   IN-MEMORY GAME STATE  (per chat)
═══════════════════════════════════════════════════════════════ */
const _games = new Map();  // chatId → GameState

function getGame(chatId)      { return _games.get(String(chatId)) || null; }
function setGame(chatId, g)   { _games.set(String(chatId), g); }
function delGame(chatId)      { _games.delete(String(chatId)); }

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
function fmtPrize(n) {
  if (n >= 1000000) return '💰 ' + (n/1000000).toFixed(0) + ' مليون دج';
  if (n >= 1000)    return '💵 ' + (n/1000).toFixed(0) + 'k دج';
  return '💵 ' + n + ' دج';
}

function levelBar(level) {
  const bars = PRIZES.map((_, i) => {
    if (i < level)  return '▰';
    if (i === level) return '◆';
    return '▱';
  }).join('');
  return bars;
}

function safeZoneText(level) {
  const next = SAFE_ZONES.find(z => z >= level);
  if (next === undefined) return '';
  return `\n🛡️ أمان: ${fmtPrize(PRIZES[next])} (سؤال ${next + 1})`;
}

function lifelineButtons(lifelines) {
  const btns = [];
  for (const [k, v] of Object.entries(LIFELINES)) {
    if (lifelines[k]) btns.push({ text: v.emoji + ' ' + v.name, callback_data: 'mlr_' + k });
  }
  return btns;
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function getRandomQuestion(usedIds, difficulty) {
  const diff = difficulty || 'medium';
  const exclude = usedIds.length ? `AND id NOT IN (${usedIds.join(',')})` : '';
  // Try exact difficulty first, then fallback
  let q = await get(
    `SELECT * FROM million_questions WHERE is_active=1 AND difficulty=$1 ${exclude}
     ORDER BY used_count ASC, RANDOM() LIMIT 1`, [diff]
  );
  if (!q) {
    q = await get(
      `SELECT * FROM million_questions WHERE is_active=1 ${exclude}
       ORDER BY used_count ASC, RANDOM() LIMIT 1`, []
    );
  }
  return q;
}

function getDifficultyForLevel(level) {
  if (level <= 4)  return 'easy';
  if (level <= 9)  return 'medium';
  return 'hard';
}

/* ═══════════════════════════════════════════════════════════════
   MESSAGE BUILDERS
═══════════════════════════════════════════════════════════════ */
function buildQuestionMsg(game, q, hiddenOptions) {
  const level    = game.currentLevel;
  const prize    = PRIZES[level];
  const isSafe   = SAFE_ZONES.includes(level);
  const diff     = DIFFICULTY[q.difficulty] || '🟡';
  const hidden   = hiddenOptions || [];

  const opts = ['a','b','c','d'].map((l, i) => {
    if (hidden.includes(l)) return `${LETTERS[i]}️⃣ ~~...~~`;
    return `${LETTERS[i]}) ${q['option_' + l]}`;
  }).join('\n');

  const players = [...game.players.values()].filter(p => p.alive);

  return (
    `🎯 *السؤال ${level + 1} من 15*\n` +
    `${diff} • ${q.category || 'عام'} • ${fmtPrize(prize)}\n` +
    `${levelBar(level)}\n` +
    (isSafe ? `\n🛡️ *نقطة أمان!*\n` : '') +
    `\n❓ *${q.text}*\n\n` +
    `${opts}\n\n` +
    `👥 اللاعبون النشطون: ${players.length}\n` +
    `⏱️ الوقت: ${QUESTION_SECS} ثانية` +
    safeZoneText(level + 1)
  );
}

function buildAnswerKeyboard(game, q, hiddenOptions) {
  const hidden = hiddenOptions || [];
  const rows = [];
  const opts = [
    { l: 'a', txt: `${LETTERS[0]}) ${q.option_a}` },
    { l: 'b', txt: `${LETTERS[1]}) ${q.option_b}` },
    { l: 'c', txt: `${LETTERS[2]}) ${q.option_c}` },
    { l: 'd', txt: `${LETTERS[3]}) ${q.option_d}` },
  ];
  // 2 options per row
  for (let i = 0; i < opts.length; i += 2) {
    const row = [];
    for (let j = i; j < i + 2 && j < opts.length; j++) {
      const o = opts[j];
      if (!hidden.includes(o.l)) {
        row.push({ text: o.txt.substring(0, 40), callback_data: `mar_${o.l}_${game.sessionId}` });
      }
    }
    if (row.length) rows.push(row);
  }
  return rows;
}

function buildLifelineKeyboard(game) {
  // Only show available lifelines for alive players concept
  const btns = lifelineButtons(game.lifelines);
  if (!btns.length) return [];
  const rows = [];
  for (let i = 0; i < btns.length; i += 2) {
    rows.push(btns.slice(i, i + 2));
  }
  return rows;
}

/* ═══════════════════════════════════════════════════════════════
   CORE GAME FLOW
═══════════════════════════════════════════════════════════════ */
async function startJoinPhase(ctx) {
  const chatId   = ctx.chat.id;
  const existing = getGame(chatId);
  if (existing) {
    return ctx.reply('⚠️ يوجد لعبة جارية بالفعل! /mstop لإيقافها.').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  }

  // Check questions count
  const qCount = await get('SELECT COUNT(*) as c FROM million_questions WHERE is_active=1');
  if (!qCount || parseInt(qCount.c) < 5) {
    return ctx.reply(
      '❌ لا توجد أسئلة كافية.\n' +
      'أضف أسئلة بـ /maddq في المحادثة الخاصة.'
    ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  }

  // Create DB session
  const session = await get(
    'INSERT INTO million_sessions(chat_id,status) VALUES($1,$2) RETURNING id',
    [chatId, 'waiting']
  );

  const game = {
    sessionId:    session.id,
    chatId:       String(chatId),
    status:       'waiting',
    players:      new Map(),    // userId → { name, username, alive, prize, lifelines, answers }
    currentLevel: 0,
    currentQ:     null,
    usedQIds:     [],
    timer:        null,
    joinTimer:    null,
    msgId:        null,
    lifelines:    { fifty: true, audience: true, call: true, skip: true }, // shared pool
    hiddenOpts:   [],
    answerDeadline: 0,
    roundAnswers:   new Map(),  // userId → answer letter
    joinMsgId:    null,
  };

  setGame(chatId, game);

  // ── Auto-join: أضف المضيف مباشرة ──────────────────────────────
  const _starter = ctx.from;
  const _suid    = String(_starter.id);
  game.players.set(_suid, {
    name:      _starter.first_name || 'لاعب',
    username:  _starter.username   || '',
    alive:     true,
    prize:     0,
    lifelines: { fifty: true, audience: true, call: true, skip: true },
    answers:   [],
  });

  // ── رسالة البداية الاحترافية ─────────────────────────────────
  const _joinTxt =
    '🎰 *من سيربح المليون؟*\n' +
    '━━━━━━━━━━━━━━━━━━━━\n\n' +
    '👑 المضيف: *' + (_starter.first_name || 'لاعب') + '*\n' +
    '👥 اللاعبون (1):\n' +
    '1\. ' + (_starter.first_name || 'لاعب') + '\n\n' +
    '💰 الجائزة الكبرى: *1,000,000 دج*\n\n' +
    '⏱️ تبدأ اللعبة خلال *5* ثوانٍ\.\.\.';

  const msg = await ctx.reply(_joinTxt, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🚀 ابدأ', callback_data: 'mlr_forcestart' }],
        [{ text: '📊 الترتيب', callback_data: 'mlr_ranking' }, { text: '❓ كيف العب', callback_data: 'mlr_howto' }],
        [{ text: '🔴 إلغاء', callback_data: 'mlr_cancel' }],
      ],
    },
  }).catch(() => null);

  if (msg) { game.joinMsgId = msg.message_id; trackGameMsg(chatId, msg.message_id); }

  // ── بدء تلقائي بعد 5 ثوانٍ ──────────────────────────────────
  game.joinTimer = setTimeout(() => beginGame(ctx.telegram, chatId), 5000);
}

async function joinGame(ctx) {
  const chatId = ctx.chat.id;
  const game   = getGame(chatId);
  if (!game || game.status !== 'waiting') {
    return ctx.answerCbQuery('⚠️ لا يوجد لعبة للانضمام.', { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  }
  if (game.players.size >= MAX_PLAYERS) {
    return ctx.answerCbQuery('⚠️ اللعبة ممتلئة!', { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  }

  const uid  = ctx.from.id;
  const name = ctx.from.first_name || 'لاعب';

  if (game.players.has(uid)) {
    return ctx.answerCbQuery('أنت مسجل بالفعل! ✅').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  }

  game.players.set(uid, {
    id:        uid,
    name,
    username:  ctx.from.username || '',
    alive:     true,
    prize:     0,
    level:     0,
    lifelines: { fifty: true, audience: true, call: true, skip: true },
    answers:   [],
    joinedAt:  Date.now(),
  });

  await ctx.answerCbQuery(`✅ مرحباً ${name}! انتظر بدء اللعبة.`).catch(err => { require('../utils/logger').debug("[silent]", err.message); });

  // Update join message
  const count = game.players.size;
  const names = [...game.players.values()].map(p => `• ${p.name}`).join('\n');
  await ctx.telegram.editMessageText(
    chatId, game.joinMsgId, null,
    `🎉 *من سيربح المليون — جولة جديدة!*\n\n` +
    `👥 *اللاعبون (${count}):*\n${names}\n\n` +
    `⏱️ اللعبة تبدأ قريباً...\n💰 الجائزة الكبرى: *1,000,000 دج*`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: `✋ انضم (${count})`, callback_data: 'mlr_join' },
          { text: '▶️ ابدأ الآن', callback_data: 'mlr_forcestart' },
        ]],
      },
    }
  ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
}

async function beginGame(telegram, chatId) {
  const game = getGame(chatId);
  if (!game) return;
  if (game.joinTimer) { clearTimeout(game.joinTimer); game.joinTimer = null; }

  // حذف رسالة الانضمام
  if (game.joinMsgId) {
    await telegram.deleteMessage(chatId, game.joinMsgId).catch(() => {});
    game.joinMsgId = null;
  }

  if (game.players.size === 0) {
    await _notify(telegram, chatId, '😕 لم ينضم أحد للعبة. تم الإلغاء.', {}, 5000);
    delGame(chatId);
    return;
  }
  // ✅ لاعب واحد مسموح — لا حاجة للانتظار

  game.status = 'playing';
  await run('UPDATE million_sessions SET status=$1 WHERE id=$2', ['playing', game.sessionId]).catch(err => { require('../utils/logger').debug("[silent]", err.message); });

  // Register players in DB
  for (const p of game.players.values()) {
    await run(
      `INSERT INTO million_players(session_id,user_id,first_name,username)
       VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [game.sessionId, p.id, p.name, p.username]
    ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  }

  const playerList = [...game.players.values()].map(p => `👤 ${p.name}`).join('\n');
  await telegram.sendMessage(
    chatId,
    `🚀 *اللعبة تبدأ الآن!*\n\n${playerList}\n\n⚡ استعدوا للسؤال الأول...`,
    { parse_mode: 'Markdown' }
  ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });

  await new Promise(r => setTimeout(r, 2000));
  await sendNextQuestion(telegram, chatId);
}

// ── حذف رسائل القروب القديمة ──────────────────────────────
const _grpMsgs = new Map(); // chatId → [msgIds]
function trackGrpMsg(chatId, msgId) {
  if (!msgId) return;
  if (!_grpMsgs.has(chatId)) _grpMsgs.set(chatId, []);
  _grpMsgs.get(chatId).push(msgId);
}
async function clearGrpMsgs(telegram, chatId, keepId) {
  const ids = _grpMsgs.get(chatId) || [];
  await Promise.allSettled(
    ids.filter(id => id !== keepId)
       .map(id => telegram.deleteMessage(chatId, id).catch(() => {}))
  );
  _grpMsgs.set(chatId, keepId ? [keepId] : []);
}

async function sendNextQuestion(telegram, chatId) {
  const game = getGame(chatId);
  if (!game || game.status !== 'playing') return;

  const alivePlayers = [...game.players.values()].filter(p => p.alive);
  if (alivePlayers.length === 0) {
    await endGame(telegram, chatId, 'no_players');
    return;
  }

  if (game.currentLevel >= PRIZES.length) {
    await endGame(telegram, chatId, 'complete');
    return;
  }

  const diff = getDifficultyForLevel(game.currentLevel);
  const q    = await getRandomQuestion(game.usedQIds, diff);

  if (!q) {
    await telegram.sendMessage(chatId, '❌ نفدت الأسئلة! تم إنهاء اللعبة.').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    await endGame(telegram, chatId, 'no_questions');
    return;
  }

  game.currentQ    = q;
  game.hiddenOpts  = [];
  game.roundAnswers.clear();
  game.usedQIds.push(q.id);
  game.answerDeadline = Date.now() + QUESTION_SECS * 1000;

  // Mark question as used
  runSilent('UPDATE million_questions SET used_count=used_count+1 WHERE id=$1', [q.id]);

  const txt = buildQuestionMsg(game, q);
  const keyboard = [
    ...buildAnswerKeyboard(game, q, []),
    ...buildLifelineKeyboard(game),
  ];

  // احذف رسالة السؤال القديمة
  if (game.msgId) {
    await telegram.deleteMessage(chatId, game.msgId).catch(() => {});
    game.msgId = null;
  }

  const msg = await telegram.sendMessage(chatId, txt, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard },
  }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });

  if (msg) game.msgId = msg.message_id;

  // Countdown timer
  game.timer = setTimeout(async () => {
    await resolveQuestion(telegram, chatId, true); // timeout
  }, QUESTION_SECS * 1000);

  // Mid-timer warning at 10 seconds
  setTimeout(async () => {
    const g2 = getGame(chatId);
    if (!g2 || g2.status !== 'playing' || g2.msgId !== msg?.message_id) return;
    await _notify(telegram, chatId, '⚠️ *10 ثواني متبقية!*', {}, 4000); //(err => { require('../utils/logger').debug("[silent]", err.message); });
  }, (QUESTION_SECS - 10) * 1000);
}

async function handleAnswer(ctx, letter) {
  const chatId = ctx.chat.id;
  const game   = getGame(chatId);
  if (!game || game.status !== 'playing') {
    return ctx.answerCbQuery('⚠️ لا توجد لعبة نشطة.').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  }

  const uid    = ctx.from.id;
  const player = game.players.get(uid);
  if (!player) {
    return ctx.answerCbQuery('🚫 هذه ليست لعبتك!', { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  }
  if (!player.alive) {
    return ctx.answerCbQuery('❌ لقد خرجت من اللعبة.').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  }
  if (game.roundAnswers.has(uid)) {
    return ctx.answerCbQuery('✅ إجابتك مسجلة، انتظر النتيجة.').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  }
  if (Date.now() > game.answerDeadline) {
    return ctx.answerCbQuery('⏰ انتهى الوقت!').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  }

  game.roundAnswers.set(uid, letter);
  const elapsed = Math.floor((Date.now() - (game.answerDeadline - QUESTION_SECS * 1000)) / 1000);
  player.answerTime = elapsed;

  await ctx.answerCbQuery(`✅ سجلنا إجابتك: ${LETTERS['abcd'.indexOf(letter)]}`).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  // احفظ آخر message للاعب للـ reply
  if (player) player.lastMsgId = ctx.callbackQuery?.message?.message_id;

  // If all alive players answered → resolve early
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
  const correct = q.correct;
  const prize   = PRIZES[game.currentLevel];
  const isSafe  = SAFE_ZONES.includes(game.currentLevel);

  // Evaluate each player
  const results = { correct: [], wrong: [], noAnswer: [] };
  for (const p of game.players.values()) {
    if (!p.alive) continue;
    const ans = game.roundAnswers.get(p.id);
    if (!ans)            { results.noAnswer.push(p); p.alive = false; }
    else if (ans === correct) { results.correct.push(p); }
    else                 { results.wrong.push(p); p.alive = false; }
  }

  // Update prize for correct players
  for (const p of results.correct) {
    p.prize = prize;
    p.level = game.currentLevel + 1;
  }

  // Build result message
  const correctOpt  = q['option_' + correct];
  const wrongList   = results.wrong.map(p => `❌ ${p.name}`).join('  ');
  const noAnsList   = results.noAnswer.map(p => `⏰ ${p.name}`).join('  ');
  const correctList = results.correct.map(p => `✅ ${p.name}`).join('  ');
  const aliveAfter  = [...game.players.values()].filter(p => p.alive);

  let txt =
    `${timeout ? '⏰ انتهى الوقت!\n' : ''}` +
    `✅ *الإجابة الصحيحة:* ${LETTERS['abcd'.indexOf(correct)]}) ${correctOpt}\n\n`;

  if (correctList) txt += `🎉 *أصابوا (${results.correct.length}):*\n${correctList}\n\n`;
  if (wrongList)   txt += `💀 *أخطأوا:*\n${wrongList}\n\n`;
  if (noAnsList)   txt += `⏰ *لم يجيبوا:*\n${noAnsList}\n\n`;

  if (aliveAfter.length > 0) {
    txt += `👥 *الباقون: ${aliveAfter.length}* — ${fmtPrize(prize)} لكل واحد\n`;
    if (isSafe) txt += `\n🛡️ *نقطة أمان محققة!* اللاعبون يضمنون ${fmtPrize(prize)}`;
  }

  const resultMsg = await telegram.sendMessage(chatId, txt, { parse_mode: 'Markdown' }).catch(() => null);
  // احذف رسالة النتيجة بعد 5 ثواني
  if (resultMsg) setTimeout(() => telegram.deleteMessage(chatId, resultMsg.message_id).catch(() => {}), 7000);

  // Check if safe zone — eliminated players keep safe amount
  if (isSafe) {
    for (const p of game.players.values()) {
      if (!p.alive && p.prize === 0) p.prize = prize; // give safe floor
    }
  }

  await new Promise(r => setTimeout(r, 3000));

  // Check end conditions
  if (aliveAfter.length === 0) {
    await endGame(telegram, chatId, 'all_eliminated');
    return;
  }
  if (game.currentLevel >= PRIZES.length - 1) {
    await endGame(telegram, chatId, 'complete');
    return;
  }

  // Next question
  game.currentLevel++;
  await sendNextQuestion(telegram, chatId);
}

async function endGame(telegram, chatId, reason) {
  const game = getGame(chatId);
  if (!game) return;

  if (game.timer)     { clearTimeout(game.timer);    game.timer = null; }
  if (game.joinTimer) { clearTimeout(game.joinTimer); game.joinTimer = null; }

  game.status = 'ended';

  // Sort players by prize desc
  const sorted = [...game.players.values()].sort((a, b) => b.prize - a.prize);

  let txt = `🏁 *انتهت اللعبة!*\n\n`;

  const reasonTxt = {
    complete:      '🏆 اكتملت جميع الأسئلة!',
    all_eliminated:'💀 جميع اللاعبين خرجوا!',
    no_players:    '😕 لا يوجد لاعبون.',
    no_questions:  '❌ نفدت الأسئلة.',
    stopped:       '🛑 توقفت اللعبة.',
  };
  txt += (reasonTxt[reason] || '') + '\n\n';

  txt += `🏆 *النتائج النهائية:*\n`;
  for (let i = 0; i < sorted.length; i++) {
    const p    = sorted[i];
    const icon = TROPHIES[i] || `${i + 1}.`;
    txt += `${icon} ${p.name} — ${fmtPrize(p.prize)}\n`;
  }

  const winner = sorted[0];
  if (winner && winner.prize > 0) {
    txt += `\n🎊 *المبروك ${winner.name}!*\n🏆 جائزتك: ${fmtPrize(winner.prize)}`;
    // ── إضافة الجائزة للبنك ──
    try {
      const bank = require('./bank');
      await bank.addWinnings(winner.id, winner.name, winner.username, winner.prize, 'جائزة من سيربح المليون');
      // reply على رسالة صاحب اللعبة (اللي كتب مليون)
      try {
        const replyOpts = game.hostMsgId ? { reply_to_message_id: game.hostMsgId } : {};
        await telegram.sendMessage(chatId,
          '🎊 *' + winner.name + '* ربح *' + fmtPrize(winner.prize) + '*! 🏆',
          { parse_mode: 'Markdown', ...replyOpts }
        );
      } catch(_) {}
      // reply للفائز مباشرة
      try {
        await telegram.sendMessage(winner.id,
          '🏆 *مبروك! ربحت من سيربح المليون!*' + String.fromCharCode(10) +
          '💰 جائزتك: *' + fmtPrize(winner.prize) + '*' + String.fromCharCode(10) +
          '🏦 تم إضافة المبلغ لحسابك البنكي!',
          { parse_mode: 'Markdown' }
        );
      } catch(_) {}
      await telegram.sendMessage(winner.id,
        '🏆 *مبروك! ربحت ' + fmtPrize(winner.prize) + ' في لعبة المليون!*\n💰 تم إضافة الجائزة لحسابك البنكي!\n\nاكتب *فلوسي* لعرض رصيدك.',
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    } catch(_) {}
  }

  await telegram.sendMessage(chatId, txt, { parse_mode: 'Markdown' }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });

  // Save scores to DB
  await run('UPDATE million_sessions SET status=$1, ended_at=NOW() WHERE id=$2', ['ended', game.sessionId]).catch(err => { require('../utils/logger').debug("[silent]", err.message); });

  for (const p of game.players.values()) {
    const isWinner = p.id === winner?.id && p.prize > 0 ? 1 : 0;
    await run(
      `INSERT INTO million_scores(user_id,first_name,username,best_prize,total_games,wins,total_prize)
       VALUES($1,$2,$3,$4,1,$5,$6)
       ON CONFLICT(user_id) DO UPDATE SET
         first_name=EXCLUDED.first_name,
         username=EXCLUDED.username,
         best_prize=GREATEST(million_scores.best_prize, EXCLUDED.best_prize),
         total_games=million_scores.total_games+1,
         wins=million_scores.wins+$5,
         total_prize=million_scores.total_prize+$6,
         updated_at=NOW()`,
      [p.id, p.name, p.username, p.prize, isWinner, p.prize]
    ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  }

  delGame(chatId);
}

/* ═══════════════════════════════════════════════════════════════
   LIFELINE HANDLERS
═══════════════════════════════════════════════════════════════ */
async function useLifeline(ctx, type) {
  const chatId = ctx.chat.id;
  const game   = getGame(chatId);
  if (!game || game.status !== 'playing') return ctx.answerCbQuery('⚠️').catch(err => { require('../utils/logger').debug("[silent]", err.message); });

  const uid    = ctx.from.id;
  const player = game.players.get(uid);
  if (!player || !player.alive) return ctx.answerCbQuery('❌ لست في اللعبة.').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  if (!player.lifelines[type])  return ctx.answerCbQuery('❌ استخدمت هذه المساعدة بالفعل.', { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });

  player.lifelines[type] = false;
  game.lifelines[type]   = false; // global pool update

  const q = game.currentQ;

  if (type === 'fifty') {
    // Remove 2 wrong answers
    const wrong = ['a','b','c','d'].filter(l => l !== q.correct);
    const toHide = shuffleArray(wrong).slice(0, 2);
    game.hiddenOpts = toHide;

    await ctx.answerCbQuery('✅ تم تطبيق 50/50!').catch(err => { require('../utils/logger').debug("[silent]", err.message); });

    // Re-edit question message
    const txt = buildQuestionMsg(game, q, toHide);
    const keyboard = [
      ...buildAnswerKeyboard(game, q, toHide),
      ...buildLifelineKeyboard(game),
    ];
    await ctx.telegram.editMessageText(chatId, game.msgId, null, txt, {
      parse_mode:   'Markdown',
      reply_markup: { inline_keyboard: keyboard },
    }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });

    await ctx.telegram.sendMessage(chatId,
      `5️⃣0️⃣ *${ctx.from.first_name} استخدم 50/50!*\n` +
      `حُذفت إجابتان خاطئتان.`,
      { parse_mode: 'Markdown' }
    ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });

  } else if (type === 'audience') {
    // Simulate audience poll (bias toward correct)
    const dist = {};
    const opts = ['a','b','c','d'].filter(l => !game.hiddenOpts.includes(l));
    let rem = 100;
    const correctPct = 40 + Math.floor(Math.random() * 35); // 40-75%
    dist[q.correct] = correctPct;
    rem -= correctPct;
    const others = opts.filter(l => l !== q.correct);
    for (let i = 0; i < others.length; i++) {
      if (i === others.length - 1) { dist[others[i]] = rem; }
      else {
        const v = Math.floor(Math.random() * (rem / (others.length - i)));
        dist[others[i]] = v; rem -= v;
      }
    }

    const bars = opts.map(l =>
      `${LETTERS['abcd'.indexOf(l)]}) ${'█'.repeat(Math.floor((dist[l]||0)/5))} ${dist[l]||0}%`
    ).join('\n');

    await ctx.answerCbQuery('✅ نتيجة استطلاع الجمهور!').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    await ctx.telegram.sendMessage(chatId,
      `👥 *${ctx.from.first_name} استشار الجمهور!*\n\n📊 *نتيجة التصويت:*\n${bars}`,
      { parse_mode: 'Markdown' }
    ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });

  } else if (type === 'call') {
    // Ask the group — pause timer and reveal hint
    const hint = LETTERS['abcd'.indexOf(q.correct)];
    await ctx.answerCbQuery('✅ طُرح السؤال على القروب!').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    await ctx.telegram.sendMessage(chatId,
      `📞 *${ctx.from.first_name} يستشير القروب!*\n\n` +
      `❓ *${q.text}*\n\n` +
      `💡 ساعدوه! ردوا بالحرف الصحيح (أ، ب، ج، أو د)\n` +
      `_(للمشرف فقط: الجواب ${hint})_`,
      { parse_mode: 'Markdown' }
    ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });

  } else if (type === 'skip') {
    // Skip question (no penalty, no prize for this level)
    await ctx.answerCbQuery('✅ تم تخطي السؤال!').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    if (game.timer) { clearTimeout(game.timer); game.timer = null; }
    await ctx.telegram.sendMessage(chatId,
      `⏭️ *${ctx.from.first_name} تخطى السؤال!*\n` +
      `سينتقل الجميع للسؤال التالي.`,
      { parse_mode: 'Markdown' }
    ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    await new Promise(r => setTimeout(r, 2000));
    await sendNextQuestion(ctx.telegram, chatId);
  }
}

/* ═══════════════════════════════════════════════════════════════
   ADMIN: ADD QUESTION  (in private)
═══════════════════════════════════════════════════════════════ */
const _addState = new Map(); // userId → step state

async function handleAddQuestion(ctx) {
  const uid = ctx.from.id;

  // Check if admin
  const adm = await get('SELECT user_id FROM admins WHERE user_id=$1', [uid]);
  const isOwner = String(uid) === String(process.env.OWNER_ID);
  if (!adm && !isOwner) return ctx.reply('🚫 للأدمن فقط.').catch(err => { require('../utils/logger').debug("[silent]", err.message); });

  _addState.set(uid, { step: 'text', data: {} });
  return ctx.reply(
    '➕ *إضافة سؤال جديد*\n\n📝 أرسل نص السؤال:',
    { parse_mode: 'Markdown' }
  ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
}

async function handleAddText(ctx) {
  const uid = ctx.from.id;
  const st  = _addState.get(uid);
  if (!st) return false;

  const txt = ctx.message.text.trim();

  if (st.step === 'text') {
    st.data.text = txt;
    st.step = 'options';
    await ctx.reply(
      '✅ السؤال:\n' + txt + '\n\n' +
      '📝 الآن أرسل الخيارات الأربعة (كل خيار في سطر):\n' +
      'مثال:\n' +
      'باريس\nلندن\nبرلين\nروما'
    ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    return true;
  }

  if (st.step === 'options') {
    const lines = txt.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 4) {
      await ctx.reply('❌ أرسل 4 خيارات (كل واحد في سطر).').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      return true;
    }
    st.data.opts = lines.slice(0, 4);
    st.step = 'correct';
    await ctx.reply(
      '✅ الخيارات:\n' +
      lines.slice(0,4).map((l,i) => `${LETTERS[i]}) ${l}`).join('\n') + '\n\n' +
      '✅ أرسل رقم الإجابة الصحيحة (1/2/3/4):'
    ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    return true;
  }

  if (st.step === 'correct') {
    const n = parseInt(txt);
    if (isNaN(n) || n < 1 || n > 4) {
      await ctx.reply('❌ أرسل رقم بين 1 و 4.').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      return true;
    }
    st.data.correct = ['a','b','c','d'][n-1];
    st.step = 'difficulty';
    await ctx.reply(
      '✅ الإجابة الصحيحة: ' + LETTERS[n-1] + '\n\n' +
      '🎯 اختر مستوى الصعوبة:',
      {
        reply_markup: { inline_keyboard: [[
          { text: '🟢 سهل',   callback_data: 'mq_diff_easy'   },
          { text: '🟡 متوسط', callback_data: 'mq_diff_medium' },
          { text: '🔴 صعب',   callback_data: 'mq_diff_hard'   },
        ]]},
      }
    ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    return true;
  }

  if (st.step === 'category') {
    st.data.category = txt || 'عام';
    await saveQuestion(ctx, uid, st.data);
    _addState.delete(uid);
    return true;
  }

  return false;
}

async function handleDifficultySelect(ctx, diff) {
  const uid = ctx.from.id;
  const st  = _addState.get(uid);
  if (!st) return ctx.answerCbQuery('⚠️').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  st.data.difficulty = diff;
  st.step = 'category';
  await ctx.answerCbQuery('✅ ' + DIFFICULTY[diff]).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  await ctx.reply('📁 أرسل فئة السؤال (مثل: علوم، رياضيات، عام...):').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
}

async function saveQuestion(ctx, uid, data) {
  const opts = data.opts;
  await run(
    `INSERT INTO million_questions(text,option_a,option_b,option_c,option_d,correct,difficulty,category,added_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [data.text, opts[0], opts[1], opts[2], opts[3], data.correct, data.difficulty||'medium', data.category||'عام', uid]
  );
  const total = await get('SELECT COUNT(*) as c FROM million_questions WHERE is_active=1');
  await ctx.reply(
    `✅ *تم حفظ السؤال بنجاح!*\n\n` +
    `📝 ${data.text}\n` +
    `✅ الإجابة: ${LETTERS['abcd'.indexOf(data.correct)]}) ${opts['abcd'.indexOf(data.correct)]}\n` +
    `🎯 ${DIFFICULTY[data.difficulty||'medium']} • ${data.category||'عام'}\n\n` +
    `📊 إجمالي الأسئلة: ${total?.c || '?'}`,
    { parse_mode: 'Markdown' }
  ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
}

/* ═══════════════════════════════════════════════════════════════
   LEADERBOARD
═══════════════════════════════════════════════════════════════ */
async function showLeaderboard(ctx) {
  const rows = await all(
    `SELECT first_name, username, best_prize, total_games, wins, total_prize
     FROM million_scores ORDER BY best_prize DESC, wins DESC LIMIT 15`
  );
  if (!rows.length) return ctx.reply('📊 لا توجد نتائج بعد. العب أولاً!').catch(err => { require('../utils/logger').debug("[silent]", err.message); });

  let txt = `🏆 *لوحة المتصدرين — من سيربح المليون*\n\n`;
  for (let i = 0; i < rows.length; i++) {
    const r    = rows[i];
    const icon = TROPHIES[i] || `${i+1}.`;
    const name = r.username ? `@${r.username}` : r.first_name;
    txt += `${icon} *${name}*\n`;
    txt += `   💰 أفضل: ${fmtPrize(r.best_prize)} | 🎮 ألعاب: ${r.total_games} | 🏆 فوز: ${r.wins}\n\n`;
  }
  await ctx.reply(txt, { parse_mode: 'Markdown' }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
}

async function showMyStats(ctx) {
  const uid = ctx.from.id;
  const r   = await get('SELECT * FROM million_scores WHERE user_id=$1', [uid]);
  if (!r) return ctx.reply('📊 لم تلعب بعد!').catch(err => { require('../utils/logger').debug("[silent]", err.message); });

  const rank = await get(
    'SELECT COUNT(*)+1 as r FROM million_scores WHERE best_prize > $1', [r.best_prize]
  );

  await ctx.reply(
    `📊 *إحصائياتك — من سيربح المليون*\n\n` +
    `👤 ${ctx.from.first_name}\n\n` +
    `🏅 ترتيبك: #${rank?.r || '?'}\n` +
    `💰 أفضل جائزة: ${fmtPrize(r.best_prize)}\n` +
    `🎮 إجمالي الألعاب: ${r.total_games}\n` +
    `🏆 مرات الفوز: ${r.wins}\n` +
    `💵 إجمالي الجوائز: ${fmtPrize(r.total_prize)}`,
    { parse_mode: 'Markdown' }
  ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
}

/* ═══════════════════════════════════════════════════════════════
   REGISTER BOT HANDLERS
═══════════════════════════════════════════════════════════════ */
function register(bot) {
  // Init schema
  initMillionaireSchema().catch(e => logger.error('[Million:Schema] ' + e.message));

  // Commands
  bot.command('million', async ctx => {
    if (ctx.chat?.type === 'private') return ctx.reply('⚠️ هذه اللعبة للقروبات فقط!').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    return startJoinPhase(ctx);
  });

  bot.hears(/^مليون$/i, async ctx => {
    if (ctx.chat?.type === 'private') return ctx.reply('⚠️ هذه اللعبة للقروبات فقط!').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    return startJoinPhase(ctx);
  });

  bot.command('mstop', async ctx => {
    if (!ctx.isAdmin && !ctx.isOwner) return ctx.reply('🚫 للأدمن فقط.').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    const game = getGame(ctx.chat.id);
    if (!game) return ctx.reply('⚠️ لا توجد لعبة نشطة.').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    await endGame(ctx.telegram, ctx.chat.id, 'stopped');
    return ctx.reply('🛑 تم إيقاف اللعبة.').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  });

  bot.command('mtop', ctx => showLeaderboard(ctx));
  bot.command('mstats', ctx => showMyStats(ctx));

  bot.command('maddq', ctx => {
    if (ctx.chat?.type !== 'private') return ctx.reply('📩 أرسل هذا الأمر في المحادثة الخاصة.').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    return handleAddQuestion(ctx);
  });

  // Callback queries
  bot.on('callback_query', async (ctx, next) => {
    const d = ctx.callbackQuery?.data || '';

    if (d === 'mlr_join')        return joinGame(ctx);
    if (d === 'mlr_forcestart') {
      if (!ctx.isAdmin && !ctx.isOwner) return ctx.answerCbQuery('🚫 للأدمن فقط.').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      const game = getGame(ctx.chat.id);
      if (!game || game.status !== 'waiting') return ctx.answerCbQuery('⚠️').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      if (game.joinTimer) { clearTimeout(game.joinTimer); game.joinTimer = null; }
      await ctx.answerCbQuery('▶️ بدأت اللعبة!').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      return beginGame(ctx.telegram, ctx.chat.id);
    }
    if (d === 'mlr_players') {
      const game = getGame(ctx.chat.id);
      if (!game) return ctx.answerCbQuery('⚠️').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      const list = [...game.players.values()].map(p => `👤 ${p.name}`).join('\n') || 'لا أحد';
      return ctx.answerCbQuery(`اللاعبون:\n${list}`, { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }

    // Lifelines
    if (d.startsWith('mlr_')) {
      const type = d.substring(3);
      if (['fifty','audience','call','skip'].includes(type)) return useLifeline(ctx, type);
    }

    // Answer
    if (d.startsWith('mar_')) {
      const parts  = d.split('_');
      const letter = parts[1];
      const sid    = parseInt(parts[2]);
      const game   = getGame(ctx.chat.id);
      if (game && game.sessionId === sid) return handleAnswer(ctx, letter);
    }

    // Add question difficulty
    if (d.startsWith('mq_diff_')) {
      const diff = d.substring(8);
      return handleDifficultySelect(ctx, diff);
    }

    return next?.();
  });

  // Text handler for add-question flow
  bot.on('text', async (ctx, next) => {
    if (ctx.chat?.type !== 'private') return next?.();
    const uid = ctx.from.id;
    if (!_addState.has(uid)) return next?.();
    const handled = await handleAddText(ctx);
    if (!handled) return next?.();
  });

  logger.info('✅ Million game registered');
}


async function handleMillionCallback(ctx, data) {
  const chatId = ctx.chat?.id;
  const uid    = String(ctx.from?.id);

  // ── إجابة السؤال ma_LETTER_SESSION ──────────────────────────
  if (data.startsWith('ma_')) {
    const parts  = data.split('_');
    const letter = parts[1];
    const sid    = parseInt(parts[2]);
    const game   = getGame(chatId);
    if (!game || game.status !== 'playing') {
      return ctx.answerCbQuery('⌛ لا يوجد لعبة نشطة').catch(() => {});
    }
    // فقط اللاعب المسجّل يجيب
    if (!game.players.has(uid)) {
      return ctx.answerCbQuery('⛔ لست مسجلاً في هذه الجولة').catch(() => {});
    }
    if (game.roundAnswers.has(uid)) {
      return ctx.answerCbQuery('✅ تم تسجيل إجابتك').catch(() => {});
    }
    game.roundAnswers.set(uid, letter);
    return ctx.answerCbQuery('📝 تم تسجيل إجابتك: ' + letter.toUpperCase()).catch(() => {});
  }

  // ── ml_forcestart ─────────────────────────────────────────────
  if (data === 'ml_forcestart') {
    ctx.answerCbQuery('🚀 جاري الإطلاق!').catch(() => {});
    const game = getGame(chatId);
    if (!game || game.status !== 'waiting') return;
    if (game.joinTimer) { clearTimeout(game.joinTimer); game.joinTimer = null; }
    return beginGame(ctx.telegram, chatId);
  }

  // ── ml_cancel ─────────────────────────────────────────────────
  if (data === 'ml_cancel') {
    ctx.answerCbQuery('🔴 تم الإلغاء').catch(() => {});
    const game = getGame(chatId);
    if (!game) return;
    if (game.joinTimer)  clearTimeout(game.joinTimer);
    if (game.timer)      clearTimeout(game.timer);
    if (game.joinMsgId) ctx.telegram.deleteMessage(chatId, game.joinMsgId).catch(() => {});
    clearGame(chatId);
    return;
  }

  // ── ml_howto ──────────────────────────────────────────────────
  if (data === 'ml_howto') {
    ctx.answerCbQuery('').catch(() => {});
    return ctx.reply(
      '📖 *كيف تلعب من سيربح المليون؟*\n━━━━━━━━━━━━━━━━━━\n\n' +
      '• اكتب *مليون* أو */million* لبدء اللعبة\n' +
      '• اضغط *🚀 ابدأ* لتشغيل اللعبة فوراً\n' +
      '• يظهر سؤال مع 4 خيارات — اختر قبل الوقت\n' +
      '• لديك مساعدات قيّمة: 50/50، الجمهور، الصديق\n' +
      '• 15 سؤال متصاعدة للوصول لـ 1,000,000 دج!\n\n' +
      '🛡 *مناطق الأمان:* السؤال 5 — 10 — 15',
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }

  // ── ml_ranking ────────────────────────────────────────────────
  if (data === 'ml_ranking') {
    ctx.answerCbQuery('').catch(() => {});
    return showLeaderboard(ctx).catch(() => {});
  }

  // ── ml_fifty / ml_audience / ml_call / ml_skip ───────────────
  if (data.startsWith('ml_')) {
    const lifelineKey = data.replace('ml_', '');
    const game = getGame(chatId);
    if (!game || !game.players.has(uid)) {
      return ctx.answerCbQuery('⛔ لست في اللعبة').catch(() => {});
    }
    const player = game.players.get(uid);
    if (player && player.lifelines && player.lifelines[lifelineKey] !== undefined) {
      if (!player.lifelines[lifelineKey]) {
        return ctx.answerCbQuery('❌ استخدمت هذه المساعدة مسبقاً').catch(() => {});
      }
      player.lifelines[lifelineKey] = false;
      return ctx.answerCbQuery('✅ تم استخدام المساعدة').catch(() => {});
    }
    return ctx.answerCbQuery('').catch(() => {});
  }
}


module.exports = { register, initMillionaireSchema, startJoinPhase, handleCallback: handleMillionCallback };
