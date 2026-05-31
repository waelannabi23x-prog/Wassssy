'use strict';
/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   🎮 لعبة خمن — Image Guessing Challenge                       ║
 * ║   نظام تحدي بالصور بين لاعبين في القروب                        ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * الأوامر:
 *   خمن       — ابدأ تحدي جديد في القروب
 *   تخمين: X  — محاولة التخمين أثناء اللعبة
 */

const { run, get, all } = require('../database/db');

// ══════════════════════════════════════════════════════════
// 🗃️ DB Migration
// ══════════════════════════════════════════════════════════
async function initGuessDB() {
  await run(`CREATE TABLE IF NOT EXISTS guess_games (
    id          SERIAL PRIMARY KEY,
    chat_id     BIGINT NOT NULL,
    creator_id  BIGINT NOT NULL,
    creator_name TEXT,
    opponent_id  BIGINT DEFAULT NULL,
    opponent_name TEXT,
    state        TEXT DEFAULT 'waiting',
    invite_msg_id BIGINT DEFAULT NULL,
    confirm_msg_id BIGINT DEFAULT NULL,
    game_msg_id   BIGINT DEFAULT NULL,
    creator_image TEXT DEFAULT NULL,
    creator_answer TEXT DEFAULT NULL,
    opponent_image TEXT DEFAULT NULL,
    opponent_answer TEXT DEFAULT NULL,
    winner_id    BIGINT DEFAULT NULL,
    started_at   TIMESTAMP DEFAULT NULL,
    ended_at     TIMESTAMP DEFAULT NULL,
    msg_ids      TEXT DEFAULT '[]',
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`).catch(() => {});

  await run(`CREATE INDEX IF NOT EXISTS idx_guess_chat ON guess_games(chat_id, state)`).catch(() => {});
}

// ══════════════════════════════════════════════════════════
// 🗺️ Active Games Map (in-memory)
// ══════════════════════════════════════════════════════════
const _games    = new Map(); // chatId → gameId
const _timers   = new Map(); // gameId → timer
const _pvState  = new Map(); // userId → { gameId, role: 'creator'|'opponent', step: 'photo'|'answer' }
const _msgToDelete = new Map(); // gameId → [msgIds]

const INVITE_TIMEOUT  = 60000;  // 60 ثانية للانتظار
const GAME_DURATION   = 300000; // 5 دقائق للعبة

// ══════════════════════════════════════════════════════════
// 🔧 Helpers
// ══════════════════════════════════════════════════════════
function addMsgToDelete(gameId, msgId) {
  if (!msgId) return;
  const arr = _msgToDelete.get(gameId) || [];
  arr.push(msgId);
  _msgToDelete.set(gameId, arr);
}

async function deleteGameMessages(bot, chatId, gameId) {
  const msgs = _msgToDelete.get(gameId) || [];
  for (const id of msgs) {
    await bot.telegram.deleteMessage(chatId, id).catch(() => {});
    await new Promise(r => setTimeout(r, 50));
  }
  _msgToDelete.delete(gameId);
}

function clearTimer(gameId) {
  if (_timers.has(gameId)) {
    clearTimeout(_timers.get(gameId));
    _timers.delete(gameId);
  }
}

// ══════════════════════════════════════════════════════════
// 🎮 1. بدء التحدي
// ══════════════════════════════════════════════════════════
async function startChallenge(bot, ctx) {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const userName = ctx.from.first_name || 'لاعب';

  // تحقق ما في لعبة جارية
  if (_games.has(chatId)) {
    const m = await ctx.reply('⚠️ يوجد تحدي جارٍ بالفعل في هذا القروب!').catch(() => null);
    if (m) setTimeout(() => ctx.telegram.deleteMessage(chatId, m.message_id).catch(() => {}), 5000);
    return;
  }

  // إنشاء اللعبة في DB
  const res = await run(
    `INSERT INTO guess_games(chat_id, creator_id, creator_name, state)
     VALUES($1,$2,$3,'waiting') RETURNING id`,
    [chatId, userId, userName]
  ).catch(() => null);

  if (!res) return ctx.reply('❌ خطأ في إنشاء اللعبة').catch(() => {});

  // جلب ID اللعبة
  const game = await get(
    'SELECT id FROM guess_games WHERE chat_id=$1 AND state=$2 ORDER BY created_at DESC LIMIT 1',
    [chatId, 'waiting']
  );
  if (!game) return;

  const gameId = game.id;
  _games.set(chatId, gameId);
  _msgToDelete.set(gameId, []);

  // رسالة الدعوة
  const inviteText =
    `🎮 *تحدي جديد!*\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `👤 ${userName} يتحدى أحداً!\n\n` +
    `📸 *قواعد اللعبة:*\n` +
    `• كل لاعب يرسل صورة للبوت في الخاص\n` +
    `• اكتشف صورة خصمك قبله\n` +
    `• اكتب \`تخمين: الاسم\` للفوز\n\n` +
    `⏳ الدعوة تنتهي خلال 60 ثانية`;

  const inviteBtn = {
    inline_keyboard: [[
      { text: '🔥 أنا جاهز!', callback_data: 'guess_join_' + gameId },
    ]],
  };

  const inviteMsg = await ctx.reply(inviteText, {
    parse_mode: 'Markdown',
    reply_markup: inviteBtn,
  }).catch(() => null);

  if (inviteMsg) {
    addMsgToDelete(gameId, inviteMsg.message_id);
    await run('UPDATE guess_games SET invite_msg_id=$1 WHERE id=$2', [inviteMsg.message_id, gameId]);
  }

  // حذف رسالة "خمن" الأصلية
  ctx.deleteMessage().catch(() => {});

  // Timer للدعوة
  const invTimer = setTimeout(async () => {
    const g = await get('SELECT state FROM guess_games WHERE id=$1', [gameId]);
    if (g?.state === 'waiting') {
      await run("UPDATE guess_games SET state='expired', ended_at=NOW() WHERE id=$1", [gameId]);
      _games.delete(chatId);
      _timers.delete(gameId);
      await deleteGameMessages(bot, chatId, gameId);
      const m = await bot.telegram.sendMessage(chatId, '⏰ انتهت مدة الانتظار — لم ينضم أحد.').catch(() => null);
      if (m) setTimeout(() => bot.telegram.deleteMessage(chatId, m.message_id).catch(() => {}), 5000);
    }
  }, INVITE_TIMEOUT);

  _timers.set(gameId, invTimer);
}

// ══════════════════════════════════════════════════════════
// 🤝 2. انضمام المنافس
// ══════════════════════════════════════════════════════════
async function joinChallenge(bot, ctx, gameId) {
  const userId   = ctx.from.id;
  const userName = ctx.from.first_name || 'لاعب';

  ctx.answerCbQuery('').catch(() => {});

  const game = await get('SELECT * FROM guess_games WHERE id=$1', [gameId]);
  if (!game || game.state !== 'waiting') {
    return ctx.answerCbQuery('⚠️ هذا التحدي لم يعد متاحاً', { show_alert: true }).catch(() => {});
  }

  if (game.creator_id === userId) {
    return ctx.answerCbQuery('😅 ما تقدرش تلعب ضد نفسك!', { show_alert: true }).catch(() => {});
  }

  // احذف invite message
  clearTimer(gameId);
  ctx.deleteMessage().catch(() => {});

  // حدّث DB
  await run(
    "UPDATE guess_games SET opponent_id=$1, opponent_name=$2, state='confirming' WHERE id=$3",
    [userId, userName, gameId]
  );

  // رسالة التأكيد لصاحب التحدي
  const confirmText =
    `✅ *وجدنا منافساً!*\n\n` +
    `⚔️ ${game.creator_name} VS ${userName}\n\n` +
    `@${game.creator_name}، هل تريد بدء التحدي؟`;

  const confirmBtn = {
    inline_keyboard: [[
      { text: '✅ ابدأ!',    callback_data: 'guess_confirm_' + gameId },
      { text: '❌ إلغاء',   callback_data: 'guess_cancel_'  + gameId },
    ]],
  };

  const confirmMsg = await bot.telegram.sendMessage(game.chat_id, confirmText, {
    parse_mode: 'Markdown',
    reply_markup: confirmBtn,
  }).catch(() => null);

  if (confirmMsg) {
    addMsgToDelete(gameId, confirmMsg.message_id);
    await run('UPDATE guess_games SET confirm_msg_id=$1 WHERE id=$2', [confirmMsg.message_id, gameId]);
  }

  // Timer للتأكيد (30 ثانية)
  const confTimer = setTimeout(async () => {
    const g = await get('SELECT state FROM guess_games WHERE id=$1', [gameId]);
    if (g?.state === 'confirming') {
      await run("UPDATE guess_games SET state='expired', ended_at=NOW() WHERE id=$1", [gameId]);
      _games.delete(game.chat_id);
      await deleteGameMessages(bot, game.chat_id, gameId);
      bot.telegram.sendMessage(game.chat_id, '⏰ انتهى وقت التأكيد — تم إلغاء التحدي.').catch(() => {});
    }
  }, 30000);
  _timers.set(gameId, confTimer);
}

// ══════════════════════════════════════════════════════════
// ✅ 3. تأكيد البدء
// ══════════════════════════════════════════════════════════
async function confirmGame(bot, ctx, gameId) {
  ctx.answerCbQuery('').catch(() => {});

  const game = await get('SELECT * FROM guess_games WHERE id=$1', [gameId]);
  if (!game || game.state !== 'confirming') return;

  if (ctx.from.id !== game.creator_id) {
    return ctx.answerCbQuery('⚠️ فقط صاحب التحدي يقدر يؤكد', { show_alert: true }).catch(() => {});
  }

  clearTimer(gameId);
  ctx.deleteMessage().catch(() => {});

  // حدّث state
  await run("UPDATE guess_games SET state='collecting', started_at=NOW() WHERE id=$1", [gameId]);

  // أرسل رسالة في القروب
  const gameMsg = await bot.telegram.sendMessage(game.chat_id,
    `⚔️ *بدأ التحدي!*\n━━━━━━━━━━━━━━━━━━\n\n` +
    `🔵 ${game.creator_name} VS 🔴 ${game.opponent_name}\n\n` +
    `📸 أرسل صورتك للبوت في الخاص الآن!\n` +
    `⏳ عندك دقيقة لإرسال صورتك`,
    { parse_mode: 'Markdown' }
  ).catch(() => null);

  if (gameMsg) {
    addMsgToDelete(gameId, gameMsg.message_id);
    await run('UPDATE guess_games SET game_msg_id=$1 WHERE id=$2', [gameMsg.message_id, gameId]);
  }

  // افتح الخاص مع اللاعبين
  const botUsername = (await bot.telegram.getMe().catch(() => ({}))).username;
  const startLink = botUsername ? `https://t.me/${botUsername}?start=guess_${gameId}` : '';

  for (const [pid, pname] of [[game.creator_id, game.creator_name], [game.opponent_id, game.opponent_name]]) {
    const role = pid === game.creator_id ? 'creator' : 'opponent';
    _pvState.set(pid, { gameId, chatId: game.chat_id, role, step: 'photo' });

    await bot.telegram.sendMessage(pid,
      `🎮 *تحدي بدأ!*\n\n` +
      `أنت تلعب ضد: *${pid === game.creator_id ? game.opponent_name : game.creator_name}*\n\n` +
      `📸 *أرسل صورة الآن*\n` +
      `_(صورة واضحة يمكن التخمين عليها)_`,
      { parse_mode: 'Markdown' }
    ).catch(async () => {
      // ما قدر يفتح الخاص — أرسل رابط
      if (startLink) {
        await bot.telegram.sendMessage(game.chat_id,
          `${pname}، افتح الخاص مع البوت: ${startLink}`,
        ).catch(() => {});
      }
    });
  }

  // Timer لجمع الصور (60 ثانية)
  const collectTimer = setTimeout(async () => {
    const g = await get('SELECT * FROM guess_games WHERE id=$1', [gameId]);
    if (g?.state === 'collecting') {
      if (!g.creator_image || !g.opponent_image) {
        await run("UPDATE guess_games SET state='expired', ended_at=NOW() WHERE id=$1", [gameId]);
        _games.delete(game.chat_id);
        _pvState.delete(game.creator_id);
        _pvState.delete(game.opponent_id);
        await deleteGameMessages(bot, game.chat_id, gameId);
        bot.telegram.sendMessage(game.chat_id,
          `⏰ انتهى وقت إرسال الصور — تم إلغاء التحدي.\n` +
          `${!g.creator_image ? `❌ ${g.creator_name} لم يرسل صورة\n` : ''}` +
          `${!g.opponent_image ? `❌ ${g.opponent_name} لم يرسل صورة` : ''}`
        ).catch(() => {});
      }
    }
  }, 90000);
  _timers.set(gameId, collectTimer);
}

// ══════════════════════════════════════════════════════════
// ❌ 4. إلغاء اللعبة
// ══════════════════════════════════════════════════════════
async function cancelGame(bot, ctx, gameId) {
  ctx.answerCbQuery('تم الإلغاء').catch(() => {});
  const game = await get('SELECT * FROM guess_games WHERE id=$1', [gameId]);
  if (!game) return;

  clearTimer(gameId);
  await run("UPDATE guess_games SET state='cancelled', ended_at=NOW() WHERE id=$1", [gameId]);
  _games.delete(game.chat_id);
  ctx.deleteMessage().catch(() => {});

  const m = await bot.telegram.sendMessage(game.chat_id, '❌ تم إلغاء التحدي.').catch(() => null);
  if (m) setTimeout(() => bot.telegram.deleteMessage(game.chat_id, m.message_id).catch(() => {}), 5000);
}

// ══════════════════════════════════════════════════════════
// 📸 5. استقبال الصورة في الخاص
// ══════════════════════════════════════════════════════════
async function handlePrivatePhoto(bot, ctx) {
  const userId = ctx.from.id;
  const pv = _pvState.get(userId);
  if (!pv || pv.step !== 'photo') return false;

  const photo = ctx.message?.photo;
  if (!photo?.length) return false;

  const fileId = photo[photo.length - 1].file_id;
  const col = pv.role === 'creator' ? 'creator_image' : 'opponent_image';

  await run(`UPDATE guess_games SET ${col}=$1 WHERE id=$2`, [fileId, pv.gameId]);
  _pvState.set(userId, { ...pv, step: 'answer' });

  await ctx.reply(
    `✅ تم استلام صورتك!\n\n` +
    `✏️ *الآن أرسل الاسم الصحيح* للصورة\n` +
    `_(هذا هو الجواب الذي سيتخمنه خصمك)_`,
    { parse_mode: 'Markdown' }
  ).catch(() => {});

  return true;
}

// ══════════════════════════════════════════════════════════
// ✏️ 6. استقبال الجواب في الخاص
// ══════════════════════════════════════════════════════════
async function handlePrivateAnswer(bot, ctx) {
  const userId = ctx.from.id;
  const pv = _pvState.get(userId);
  if (!pv || pv.step !== 'answer') return false;

  const answer = ctx.message?.text?.trim();
  if (!answer) return false;

  const col = pv.role === 'creator' ? 'creator_answer' : 'opponent_answer';
  await run(`UPDATE guess_games SET ${col}=$1 WHERE id=$2`, [answer, pv.gameId]);
  _pvState.delete(userId);

  await ctx.reply(
    `✅ *جاهز!*\n\nانتظر خصمك يرسل صورته...\n\nاللعبة ستبدأ تلقائياً! 🎮`,
    { parse_mode: 'Markdown' }
  ).catch(() => {});

  // تحقق إذا الطرفان جاهزان
  const game = await get('SELECT * FROM guess_games WHERE id=$1', [pv.gameId]);
  if (game?.creator_image && game?.creator_answer && game?.opponent_image && game?.opponent_answer) {
    await startActiveGame(bot, game);
  }

  return true;
}

// ══════════════════════════════════════════════════════════
// ⚔️ 7. بدء اللعبة الفعلية
// ══════════════════════════════════════════════════════════
async function startActiveGame(bot, game) {
  clearTimer(game.id);
  await run("UPDATE guess_games SET state='active' WHERE id=$1", [game.id]);

  // أرسل الصور للخصوم
  await bot.telegram.sendPhoto(game.creator_id, game.opponent_image, {
    caption: `🎮 هذي صورة خصمك!\n\nفي القروب اكتب:\n\`تخمين: الاسم\``,
    parse_mode: 'Markdown',
  }).catch(() => {});

  await bot.telegram.sendPhoto(game.opponent_id, game.creator_image, {
    caption: `🎮 هذي صورة خصمك!\n\nفي القروب اكتب:\n\`تخمين: الاسم\``,
    parse_mode: 'Markdown',
  }).catch(() => {});

  // رسالة البدء في القروب
  const startMsg = await bot.telegram.sendMessage(game.chat_id,
    `⚔️ *المباراة بدأت!*\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `🔵 ${game.creator_name}  VS  🔴 ${game.opponent_name}\n\n` +
    `📬 كل لاعب استلم صورة خصمه في الخاص\n\n` +
    `💬 تناقشوا بحرية — اسألوا أسئلة للتخمين!\n\n` +
    `✏️ للفوز اكتب: \`تخمين: الاسم\`\n` +
    `⏱ عندكم *5 دقائق*!`,
    { parse_mode: 'Markdown' }
  ).catch(() => null);

  if (startMsg) addMsgToDelete(game.id, startMsg.message_id);

  // Timer 5 دقائق
  const gameTimer = setTimeout(() => endGame(bot, game.id, null), GAME_DURATION);
  _timers.set(game.id, gameTimer);
}

// ══════════════════════════════════════════════════════════
// 🎯 8. محاولة التخمين في القروب
// ══════════════════════════════════════════════════════════
async function handleGuessAttempt(bot, ctx) {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const text   = ctx.message?.text || '';

  if (!_games.has(chatId)) return false;

  const match = text.match(/^تخمين[:\s]+(.+)/i);
  if (!match) return false;

  const gameId = _games.get(chatId);
  const game = await get('SELECT * FROM guess_games WHERE id=$1', [gameId]);
  if (!game || game.state !== 'active') return false;

  // تأكد اللاعب مشارك
  if (userId !== game.creator_id && userId !== game.opponent_id) {
    const m = await ctx.reply('⚠️ أنت لست مشاركاً في هذا التحدي!').catch(() => null);
    if (m) setTimeout(() => ctx.deleteMessage(m.message_id).catch(() => {}), 3000);
    ctx.deleteMessage().catch(() => {});
    return true;
  }

  const guess  = match[1].trim().toLowerCase();
  const target = userId === game.creator_id ? game.opponent_answer : game.creator_answer;

  addMsgToDelete(gameId, ctx.message.message_id);

  if (guess === target.toLowerCase()) {
    // فاز!
    await endGame(bot, gameId, userId);
  } else {
    const m = await bot.telegram.sendMessage(chatId,
      `❌ خطأ! حاول مجدداً...`,
      { parse_mode: 'Markdown' }
    ).catch(() => null);
    if (m) {
      addMsgToDelete(gameId, m.message_id);
      setTimeout(() => bot.telegram.deleteMessage(chatId, m.message_id).catch(() => {}), 3000);
    }
  }

  return true;
}

// ══════════════════════════════════════════════════════════
// 🏆 9. نهاية اللعبة
// ══════════════════════════════════════════════════════════
async function endGame(bot, gameId, winnerId) {
  clearTimer(gameId);
  const game = await get('SELECT * FROM guess_games WHERE id=$1', [gameId]);
  if (!game || game.state === 'finished' || game.state === 'expired') return;

  await run(
    "UPDATE guess_games SET state='finished', winner_id=$1, ended_at=NOW() WHERE id=$2",
    [winnerId, gameId]
  );

  _games.delete(game.chat_id);
  _pvState.delete(game.creator_id);
  _pvState.delete(game.opponent_id);

  // رسالة النتيجة
  let resultText;
  if (winnerId) {
    const winnerName = winnerId === game.creator_id ? game.creator_name : game.opponent_name;
    const loserName  = winnerId === game.creator_id ? game.opponent_name : game.creator_name;
    resultText =
      `🏆 *انتهى التحدي!*\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `🥇 الفائز: *${winnerName}* 🎉\n` +
      `💔 ${loserName} لم يتمكن من التخمين\n\n` +
      `📸 الصور الصحيحة:`;
  } else {
    resultText =
      `⏰ *انتهى الوقت!*\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `😅 لم يتمكن أحد من التخمين!\n\n` +
      `📸 الصور الصحيحة:`;
  }

  await deleteGameMessages(bot, game.chat_id, gameId);

  const resultMsg = await bot.telegram.sendMessage(game.chat_id, resultText, {
    parse_mode: 'Markdown',
  }).catch(() => null);

  // أرسل الصور مع الأسماء
  await bot.telegram.sendPhoto(game.chat_id, game.creator_image, {
    caption: `🔵 صورة ${game.creator_name}\n✏️ الإجابة: *${game.creator_answer}*`,
    parse_mode: 'Markdown',
  }).catch(() => {});

  await new Promise(r => setTimeout(r, 500));

  await bot.telegram.sendPhoto(game.chat_id, game.opponent_image, {
    caption: `🔴 صورة ${game.opponent_name}\n✏️ الإجابة: *${game.opponent_answer}*`,
    parse_mode: 'Markdown',
  }).catch(() => {});

  // نقاط للفائز
  if (winnerId) {
    try {
      await require('../database/points').awardPoints(winnerId, 'rating');
    } catch(_) {}
  }
}

// ══════════════════════════════════════════════════════════
// 🔌 Register Bot Handlers
// ══════════════════════════════════════════════════════════
function register(bot) {
  initGuessDB();

  // خمن في القروب
  bot.hears(/^خمن$/i, async ctx => {
    if (!['supergroup', 'group'].includes(ctx.chat?.type)) return;
    await startChallenge(bot, ctx);
  });

  // تخمين في القروب
  bot.on('text', async ctx => {
    if (!['supergroup', 'group'].includes(ctx.chat?.type)) return;
    if (!ctx.message?.text?.match(/^تخمين[:\s]+/i)) return;
    await handleGuessAttempt(bot, ctx);
  });

  // Callbacks
  bot.action(/^guess_join_(\d+)$/, async ctx => {
    const gameId = parseInt(ctx.match[1]);
    await joinChallenge(bot, ctx, gameId);
  });

  bot.action(/^guess_confirm_(\d+)$/, async ctx => {
    const gameId = parseInt(ctx.match[1]);
    await confirmGame(bot, ctx, gameId);
  });

  bot.action(/^guess_cancel_(\d+)$/, async ctx => {
    const gameId = parseInt(ctx.match[1]);
    await cancelGame(bot, ctx, gameId);
  });

  // الخاص — استقبال صورة
  bot.on('photo', async ctx => {
    if (ctx.chat?.type !== 'private') return;
    await handlePrivatePhoto(bot, ctx);
  });

  // الخاص — استقبال نص (الإجابة)
  bot.on('text', async ctx => {
    if (ctx.chat?.type !== 'private') return;
    const pv = _pvState.get(ctx.from?.id);
    if (pv?.step === 'answer') await handlePrivateAnswer(bot, ctx);
  });

  // /start في الخاص من رابط اللعبة
  bot.command('start', async ctx => {
    if (ctx.chat?.type !== 'private') return;
    const payload = ctx.message?.text?.split(' ')[1];
    if (!payload?.startsWith('guess_')) return;
    const gameId = parseInt(payload.replace('guess_', ''));
    const pv = _pvState.get(ctx.from?.id);
    if (pv?.gameId === gameId) {
      await ctx.reply('📸 أرسل صورتك الآن!').catch(() => {});
    }
  });
}

module.exports = { register, initGuessDB };
