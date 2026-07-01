'use strict';
/**
 * ════════════════════════════════════════════
 *  🎮 handlers/xo.js — لعبة XO للقروبات
 * ════════════════════════════════════════════
 */

// ─── State: chatId → gameState ───────────────
const games = new Map();

// ─── Constants ───────────────────────────────
const EMPTY = '⬜';
const X_SYM = '❌';
const O_SYM = '⭕';

// فحص الفوز
const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8], // أفقي
  [0,3,6],[1,4,7],[2,5,8], // عمودي
  [0,4,8],[2,4,6],          // قطري
];

function checkWinner(board) {
  for (const [a,b,c] of WIN_LINES) {
    if (board[a] !== EMPTY && board[a] === board[b] && board[b] === board[c]) {
      return { winner: board[a], line: [a,b,c] };
    }
  }
  if (board.every(c => c !== EMPTY)) return { winner: 'draw' };
  return null;
}

// بناء لوحة الأزرار
function buildBoard(board, gameId, highlight = []) {
  const rows = [];
  for (let r = 0; r < 3; r++) {
    const row = [];
    for (let col = 0; col < 3; col++) {
      const i = r * 3 + col;
      const cell = board[i];
      const isWin = highlight.includes(i);
      let text = cell;
      if (isWin && cell === X_SYM) text = '🔴';
      if (isWin && cell === O_SYM) text = '🔵';
      row.push({
        text,
        callback_data: cell === EMPTY ? `xo_move_${gameId}_${i}` : `xo_noop`,
      });
    }
    rows.push(row);
  }
  return rows;
}

// بناء رسالة اللعبة
function buildMessage(game) {
  const p1 = game.player1Name;
  const p2 = game.player2Name || '⏳ ينتظر منافس';
  const turn = game.turn === 1
    ? `${X_SYM} دور: *${p1}*`
    : `${O_SYM} دور: *${game.player2Name || '...'}*`;

  return (
    `🎮 *لعبة XO*\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `${X_SYM} *${p1}*\n` +
    `${O_SYM} *${p2}*\n\n` +
    (game.started ? turn : `⏳ ينتظر منافس للانضمام...`)
  );
}

// ─── إنشاء لعبة جديدة ────────────────────────
exports.startGame = async (ctx) => {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const name   = ctx.from.first_name || 'لاعب';

  // إذا كانت لعبة قائمة
  if (games.has(chatId)) {
    const g = games.get(chatId);
    if (!g.started) {
      return ctx.reply(`⚠️ لعبة XO قائمة بالفعل! اضغط "ابدأ اللعبة" للانضمام.`,
        { reply_to_message_id: ctx.message?.message_id }).catch(()=>{});
    }
    games.delete(chatId);
  }

  const gameId = `${chatId}_${Date.now()}`;
  const game = {
    gameId,
    chatId,
    player1: userId,
    player1Name: name,
    player2: null,
    player2Name: null,
    board: Array(9).fill(EMPTY),
    turn: 1, // 1 = X, 2 = O
    started: false,
    msgId: null,
  };
  games.set(chatId, game);

  const text = buildMessage(game);
  const kb = [
    [{ text: '🟢 ابدأ اللعبة (انضم كـ ⭕)', callback_data: `xo_join_${gameId}` }],
    [{ text: '❌ إلغاء', callback_data: `xo_cancel_${gameId}` }],
  ];

  const msg = await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: kb },
  }).catch(()=>null);

  if (msg) game.msgId = msg.message_id;
};

// ─── Callback Handler ─────────────────────────
exports.handleCallback = async (ctx) => {
  const data   = ctx.callbackQuery?.data || '';
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  const name   = ctx.from?.first_name || 'لاعب';

  // noop
  if (data === 'xo_noop') {
    return ctx.answerCbQuery('هذه الخانة مأخوذة!').catch(()=>{});
  }

  const game = games.get(chatId);

  // انضمام
  if (data.startsWith('xo_join_')) {
    if (!game) return ctx.answerCbQuery('❌ انتهت اللعبة').catch(()=>{});
    if (game.player1 === userId)
      return ctx.answerCbQuery('❌ لا يمكنك اللعب مع نفسك!').catch(()=>{});
    if (game.started)
      return ctx.answerCbQuery('❌ اللعبة بدأت بالفعل').catch(()=>{});

    game.player2     = userId;
    game.player2Name = name;
    game.started     = true;
    // اختر من يبدأ عشوائياً
    game.turn = Math.random() < 0.5 ? 1 : 2;

    await ctx.answerCbQuery(`✅ انضممت كـ ${O_SYM}`).catch(()=>{});

    const text = buildMessage(game);
    const boardKb = buildBoard(game.board, game.gameId);
    boardKb.push([{ text: '🏳️ استسلام', callback_data: `xo_resign_${game.gameId}` }]);

    return ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: boardKb },
    }).catch(()=>{});
  }

  // إلغاء
  if (data.startsWith('xo_cancel_')) {
    if (!game) return ctx.answerCbQuery('').catch(()=>{});
    if (game.player1 !== userId)
      return ctx.answerCbQuery('❌ فقط صاحب اللعبة يلغيها').catch(()=>{});
    games.delete(chatId);
    await ctx.answerCbQuery('تم الإلغاء').catch(()=>{});
    return ctx.editMessageText('❌ تم إلغاء لعبة XO.').catch(()=>{});
  }

  // استسلام
  if (data.startsWith('xo_resign_')) {
    if (!game || !game.started) return ctx.answerCbQuery('').catch(()=>{});
    const isP1 = game.player1 === userId;
    const isP2 = game.player2 === userId;
    if (!isP1 && !isP2)
      return ctx.answerCbQuery('❌ أنت لست في هذه اللعبة').catch(()=>{});

    const winnerName = isP1 ? game.player2Name : game.player1Name;
    games.delete(chatId);
    await ctx.answerCbQuery('🏳️ استسلمت').catch(()=>{});
    return ctx.editMessageText(
      `🏳️ *استسلام!*\n\n🏆 فاز *${winnerName}* بالاستسلام!`,
      { parse_mode: 'Markdown' }
    ).catch(()=>{});
  }

  // حركة
  if (data.startsWith('xo_move_')) {
    if (!game || !game.started)
      return ctx.answerCbQuery('❌ لا توجد لعبة نشطة').catch(()=>{});

    const parts = data.split('_');
    const cell  = parseInt(parts[parts.length - 1]);

    // تحقق من الدور
    const isMyTurn =
      (game.turn === 1 && game.player1 === userId) ||
      (game.turn === 2 && game.player2 === userId);

    if (!isMyTurn)
      return ctx.answerCbQuery('⏳ ليس دورك!').catch(()=>{});

    if (game.board[cell] !== EMPTY)
      return ctx.answerCbQuery('❌ هذه الخانة مأخوذة').catch(()=>{});

    // ضع الرمز
    game.board[cell] = game.turn === 1 ? X_SYM : O_SYM;
    await ctx.answerCbQuery('✅').catch(()=>{});

    // تحقق من الفوز
    const result = checkWinner(game.board);

    if (result) {
      games.delete(chatId);

      if (result.winner === 'draw') {
        const boardKb = buildBoard(game.board, game.gameId);
        return ctx.editMessageText(
          `🎮 *لعبة XO*\n━━━━━━━━━━━━━━━━━━\n\n` +
          `🤝 *تعادل!* كلاكما بطل!\n\n` +
          `${X_SYM} ${game.player1Name} vs ${O_SYM} ${game.player2Name}`,
          {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: boardKb },
          }
        ).catch(()=>{});
      } else {
        const winnerName = result.winner === X_SYM ? game.player1Name : game.player2Name;
        const boardKb = buildBoard(game.board, game.gameId, result.line);
        return ctx.editMessageText(
          `🎮 *لعبة XO*\n━━━━━━━━━━━━━━━━━━\n\n` +
          `🏆 فاز *${winnerName}* ${result.winner}!\n\n` +
          `${X_SYM} ${game.player1Name} vs ${O_SYM} ${game.player2Name}`,
          {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: boardKb },
          }
        ).catch(()=>{});
      }
    }

    // تبديل الدور
    game.turn = game.turn === 1 ? 2 : 1;

    const text   = buildMessage(game);
    const boardKb = buildBoard(game.board, game.gameId);
    boardKb.push([{ text: '🏳️ استسلام', callback_data: `xo_resign_${game.gameId}` }]);

    return ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: boardKb },
    }).catch(()=>{});
  }
};

// تنظيف الألعاب القديمة (كل ساعة)
setInterval(() => {
  const now = Date.now();
  for (const [chatId, game] of games) {
    const ts = parseInt(game.gameId.split('_').pop() || '0');
    if (now - ts > 3600_000) games.delete(chatId);
  }
}, 3600_000).unref();
