'use strict';
/**
 * ════════════════════════════════════════════
 *  🎮 handlers/xo.js — لعبة XO للقروبات v2
 * ════════════════════════════════════════════
 */

const games = new Map();

const EMPTY = '·';
const X_SYM = 'X';
const O_SYM = 'O';

const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

function checkWinner(board) {
  for (const [a,b,c] of WIN_LINES) {
    if (board[a] !== EMPTY && board[a] === board[b] && board[b] === board[c])
      return { winner: board[a], line: [a,b,c] };
  }
  if (board.every(c => c !== EMPTY)) return { winner: 'draw' };
  return null;
}

function buildBoard(board, chatId, highlight = []) {
  const rows = [];
  for (let r = 0; r < 3; r++) {
    const row = [];
    for (let col = 0; col < 3; col++) {
      const i = r * 3 + col;
      const cell = board[i];
      const isWin = highlight.includes(i);
      let text = cell;
      if (isWin && cell === X_SYM) text = 'X';
      if (isWin && cell === O_SYM) text = 'O';
      row.push({
        text: cell === EMPTY ? '·' : (cell === 'X' ? 'X' : 'O'),
        callback_data: cell === EMPTY ? `xo_move_${chatId}_${i}` : `xo_noop_${i}`,
      });
    }
    rows.push(row);
  }
  return rows;
}

function buildMessage(game) {
  const p1   = game.player1Name;
  const p2   = game.player2Name || '⏳';
  const cur  = game.turn === 1 ? `${X_SYM} دور: *${p1}*` : `${O_SYM} دور: *${p2}*`;
  return (
    `🎮 *لعبة XO*\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `${X_SYM} *${p1}* vs ${O_SYM} *${p2}*\n\n` +
    (game.started ? cur : `⏳ ينتظر منافس للانضمام...`)
  );
}

// ─── رسالة المناداة (مثل MIKEY) ──────────────
exports.startGame = async (ctx) => {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const name   = ctx.from.first_name || 'لاعب';

  // دائماً احذف اللعبة القديمة وابدأ جديدة
  games.delete(chatId);

  const gameId = `${chatId}_${Date.now()}`;
  const game = {
    gameId, chatId,
    player1: userId, player1Name: name,
    player2: null,   player2Name: null,
    board: Array(9).fill(EMPTY),
    turn: 1, started: false, msgId: null,
  };
  games.set(chatId, game);

  // رسالة مناداة احترافية
  const inviteText =
    `*تم بدء لعبة XO*\n` +
    `اللاعب الاول : ${name}\n` +
    `اللي بيلعب يضغط زر ابدء اللعبه\n` +
    `-`;

  const msg = await ctx.reply(inviteText, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [
      [{ text: '• ابدء اللعبه', callback_data: `xo_join_${chatId}` }],
    ]},
  }).catch(()=>null);

  if (msg) game.msgId = msg.message_id;
};

// ─── Callback Handler ─────────────────────────
exports.handleCallback = async (ctx) => {
  const data   = ctx.callbackQuery?.data || '';
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  const name   = ctx.from?.first_name || 'لاعب';

  if (data === 'xo_noop' || data.startsWith('xo_noop_')) {
    return ctx.answerCbQuery('❌ هذه الخانة مأخوذة!').catch(()=>{});
  }

  // إعادة اللعب
  if (data.startsWith('xo_rematch_')) {
    const parts = data.split('_');
    const p1id  = parseInt(parts[2]);
    const p2id  = parseInt(parts[3]);
    const p1n   = decodeURIComponent(parts[4] || 'لاعب');
    const p2n   = decodeURIComponent(parts[5] || 'لاعب');

    const gameId = `${chatId}_${Date.now()}`;
    const game = {
      gameId, chatId,
      player1: p1id, player1Name: p1n,
      player2: p2id, player2Name: p2n,
      board: Array(9).fill(EMPTY),
      turn: Math.random() < 0.5 ? 1 : 2,
      started: true, msgId: null,
    };
    games.set(chatId, game);

    await ctx.answerCbQuery('🎮 إعادة اللعب!').catch(()=>{});
    const text   = buildMessage(game);
    const boardKb = buildBoard(game.board, game.chatId);
    boardKb.push([{ text: '• اعادة اللعب', callback_data: `xo_rematch_${p1id}_${p2id}_${encodeURIComponent(p1n)}_${encodeURIComponent(p2n)}` }]);
    return ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: boardKb },
    }).catch(()=>{});
  }

  const game = games.get(chatId);

  // انضمام
  if (data.startsWith('xo_join_')) {
    if (!game) return ctx.answerCbQuery('❌ لا توجد لعبة نشطة، اكتب XO لبدء لعبة جديدة').catch(()=>{});
    if (game.player1 === userId)
      return ctx.answerCbQuery('❌ لا يمكنك اللعب مع نفسك!').catch(()=>{});
    if (game.started)
      return ctx.answerCbQuery('❌ اللعبة بدأت').catch(()=>{});

    game.player2     = userId;
    game.player2Name = name;
    game.started     = true;
    game.turn        = Math.random() < 0.5 ? 1 : 2;

    await ctx.answerCbQuery(`✅ انضممت كـ ${O_SYM}`).catch(()=>{});

    const startText =
      `🎮 *لعبة XO*\n` +
      `• اللاعب الاول : ${game.player1Name} (${X_SYM})\n` +
      `• اللاعب الثاني : ${name} (${O_SYM})\n\n` +
      (game.turn === 1 ? `${X_SYM} دور: *${game.player1Name}*` : `${O_SYM} دور: *${name}*`);

    const boardKb = buildBoard(game.board, game.chatId);
    

    return ctx.editMessageText(startText, {
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
    const winnerId   = isP1 ? game.player2 : game.player1;
    const loserId    = isP1 ? game.player1 : game.player2;
    const loserName  = isP1 ? game.player1Name : game.player2Name;
    const p1id = game.player1, p2id = game.player2;
    const p1n  = game.player1Name, p2n = game.player2Name;
    games.delete(chatId);

    await ctx.answerCbQuery('🏳️ استسلمت').catch(()=>{});
    return ctx.editMessageText(
      `🎮 *لعبة XO*\n` +
      `• اللاعب الاول : ${p1n} (${X_SYM})\n` +
      `• اللاعب الثاني : ${p2n} (${O_SYM})\n\n` +
      `• الفائز : ${winnerName} (بالاستسلام)`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[
          { text: '• اعادة اللعب', callback_data: `xo_rematch_${p1id}_${p2id}_${encodeURIComponent(p1n)}_${encodeURIComponent(p2n)}` }
        ]]},
      }
    ).catch(()=>{});
  }

  // حركة
  if (data.startsWith('xo_move_')) {
    if (!game || !game.started)
      return ctx.answerCbQuery('❌ لا توجد لعبة نشطة').catch(()=>{});

    const parts = data.split('_');
    const cell  = parseInt(parts[parts.length - 1]);
    if (isNaN(cell) || cell < 0 || cell > 8)
      return ctx.answerCbQuery('❌ خطأ').catch(()=>{});

    const isMyTurn =
      (game.turn === 1 && game.player1 === userId) ||
      (game.turn === 2 && game.player2 === userId);

    if (!isMyTurn)
      return ctx.answerCbQuery('⏳ ليس دورك!').catch(()=>{});
    if (game.board[cell] !== EMPTY)
      return ctx.answerCbQuery('❌ هذه الخانة مأخوذة').catch(()=>{});

    game.board[cell] = game.turn === 1 ? X_SYM : O_SYM;

    // انتظر answerCbQuery أولاً لسرعة الاستجابة
    ctx.answerCbQuery('✅').catch(()=>{});

    const result = checkWinner(game.board);

    if (result) {
      const p1id = game.player1, p2id = game.player2;
      const p1n  = game.player1Name, p2n = game.player2Name;
      games.delete(chatId);

      const boardKb = buildBoard(game.board, game.chatId, result.line || []);

      if (result.winner === 'draw') {
        boardKb.push([{ text: '• اعادة اللعب', callback_data: `xo_rematch_${p1id}_${p2id}_${encodeURIComponent(p1n)}_${encodeURIComponent(p2n)}` }]);
        return ctx.editMessageText(
          `🎮 *لعبة XO*\n` +
          `• اللاعب الاول : ${p1n} (${X_SYM})\n` +
          `• اللاعب الثاني : ${p2n} (${O_SYM})\n\n` +
          `• تعادل!`,
          { parse_mode: 'Markdown', reply_markup: { inline_keyboard: boardKb } }
        ).catch(()=>{});
      }

      const winnerName = result.winner === X_SYM ? p1n : p2n;
      const winSym = result.winner === X_SYM ? 'X' : 'O';
      boardKb.push([{ text: '• اعادة اللعب', callback_data: `xo_rematch_${p1id}_${p2id}_${encodeURIComponent(p1n)}_${encodeURIComponent(p2n)}` }]);
      return ctx.editMessageText(
        `🎮 *لعبة XO*\n` +
        `• اللاعب الاول : ${p1n} (${X_SYM})\n` +
        `• اللاعب الثاني : ${p2n} (${O_SYM})\n\n` +
        `• الفائز : ${winnerName} (${winSym})`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: boardKb } }
      ).catch(()=>{});
    }

    game.turn = game.turn === 1 ? 2 : 1;

    const text    = buildMessage(game);
    const boardKb = buildBoard(game.board, game.chatId);
    

    return ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: boardKb },
    }).catch(()=>{});
  }
};

// تنظيف الألعاب القديمة
setInterval(() => {
  const now = Date.now();
  for (const [id, game] of games) {
    const ts = parseInt(game.gameId.split('_').pop() || '0');
    if (now - ts > 3600_000) games.delete(id);
  }
}, 3600_000).unref();
