'use strict';
/**
 * ╔══════════════════════════════════════════════════╗
 * ║   🎮 لعبة "خمن" — تحدي الصور بين لاعبين       ║
 * ║   الأمر: خمن  (في القروب)                       ║
 * ╚══════════════════════════════════════════════════╝
 */

const logger = require('../utils/logger');

const INVITE_SECS  = 60;
const CONFIRM_SECS = 30;
const COLLECT_SECS = 120;
const GAME_SECS    = 300;

const _games    = new Map(); // chatId  → game
const _pvStates = new Map(); // userId  → pvState
const _msgs     = new Map(); // gameKey → [{chatId, msgId}]

/* ═══════════ UTILS ═══════════ */
const s   = v => String(v || '');
const key = (chatId, id) => `${chatId}_${id}`;

function norm(t) {
  return s(t).trim().toLowerCase()
    .replace(/[أإآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
}

function esc(t) {
  return s(t).replace(/[_*[\]()~`>#+=|{}.!\-]/g, '\\$&');
}

function name(u) {
  if (!u) return 'لاعب';
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || s(u.id);
}

function mention(u) {
  return u.username ? `@${u.username}` : `[${esc(name(u))}](tg://user?id=${u.id})`;
}

function logMsg(gkey, chatId, msgId) {
  if (!msgId) return;
  if (!_msgs.has(gkey)) _msgs.set(gkey, []);
  _msgs.get(gkey).push({ chatId, msgId });
}

async function cleanMsgs(telegram, gkey, keepId = null) {
  const list = _msgs.get(gkey) || [];
  await Promise.allSettled(
    list
      .filter(m => m.msgId !== keepId)
      .map(({ chatId, msgId }) => telegram.deleteMessage(chatId, msgId).catch(() => {}))
  );
  _msgs.delete(gkey);
}

/* ═══════════ PHASE 1 — INVITE ═══════════ */
async function startInvite(ctx) {
  const chatId = s(ctx.chat.id);
  const user   = ctx.from;

  const existing = _games.get(chatId);
  if (existing && existing.status !== 'ended') {
    const w = await ctx.reply('⚠️ يوجد تحدٍّ نشط بالفعل، انتظر حتى ينتهي.').catch(() => null);
    if (w) setTimeout(() => ctx.telegram.deleteMessage(chatId, w.message_id).catch(() => {}), 5000);
    return;
  }

  ctx.telegram.deleteMessage(chatId, ctx.message.message_id).catch(() => {});

  const gameId = Date.now();
  const gkey   = key(chatId, gameId);

  const game = {
    id: gameId, key: gkey, chatId,
    status: 'waiting',
    p1: { ...user, photo: null, name: null, ready: false },
    p2: null,
    inviteMsgId: null, confirmMsgId: null,
    inviteTimer: null, confirmTimer: null, collectTimer: null,
    gameTimer: null,   warnTimer: null,
  };

  _games.set(chatId, game);

  const msg = await ctx.telegram.sendMessage(chatId,
    `🎮 *تحدي جديد من ${esc(name(user))}!*\n\n` +
    `🖼️ كل لاعب يختار صورة سرية، والآخر يحاول تخمينها خلال 5 دقائق عبر الحوار الحر.\n\n` +
    `⏳ يُنتظر منافس... تنتهي الدعوة خلال *60 ثانية*`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '🔥 أنا جاهز للتحدي!', callback_data: `gg_join_${chatId}_${gameId}` }
        ]]
      }
    }
  ).catch(() => null);

  if (!msg) { _games.delete(chatId); return; }

  game.inviteMsgId = msg.message_id;
  logMsg(gkey, chatId, msg.message_id);

  game.inviteTimer = setTimeout(
    () => _cancelGame(ctx.telegram, chatId, gameId, 'waiting', '⏰ انتهى وقت الدعوة، لم يتقدم أحد.'),
    INVITE_SECS * 1000
  );
}

/* ═══════════ PHASE 2 — JOIN ═══════════ */
async function handleJoin(ctx, chatId, gameId) {
  const game = _games.get(s(chatId));
  if (!game || game.id !== parseInt(gameId) || game.status !== 'waiting') {
    return ctx.answerCbQuery('⚠️ هذا التحدي لم يعد متاحاً.', { show_alert: true }).catch(() => {});
  }

  const user = ctx.from;
  if (s(user.id) === s(game.p1.id)) {
    return ctx.answerCbQuery('😄 لا تستطيع التحدي مع نفسك!', { show_alert: true }).catch(() => {});
  }

  clearTimeout(game.inviteTimer);
  game.status = 'confirming';
  game.p2     = { ...user, photo: null, name: null, ready: false };

  await ctx.answerCbQuery('✅ أُرسل طلبك للاعب الأول!').catch(() => {});

  await ctx.telegram.editMessageText(chatId, game.inviteMsgId, null,
    `🎮 *تحدي من ${esc(name(game.p1))}*\n\n` +
    `👤 تقدّم: *${esc(name(user))}*\n\n` +
    `⏳ في انتظار موافقة ${mention(game.p1)}...`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ قبول التحدي', callback_data: `gg_cf_${chatId}_${gameId}_yes` },
          { text: '❌ رفض',          callback_data: `gg_cf_${chatId}_${gameId}_no`  },
        ]]
      }
    }
  ).catch(() => {});

  game.confirmTimer = setTimeout(
    () => _cancelGame(ctx.telegram, chatId, game.id, 'confirming', '⏰ انتهى وقت التأكيد.'),
    CONFIRM_SECS * 1000
  );
}

/* ═══════════ PHASE 3 — CONFIRM ═══════════ */
async function handleConfirm(ctx, chatId, gameId, answer) {
  const game = _games.get(s(chatId));
  if (!game || game.id !== parseInt(gameId) || game.status !== 'confirming') {
    return ctx.answerCbQuery('⚠️ انتهت صلاحية هذا الطلب.').catch(() => {});
  }
  if (s(ctx.from.id) !== s(game.p1.id)) {
    return ctx.answerCbQuery('🚫 هذا القرار للاعب الأول فقط.', { show_alert: true }).catch(() => {});
  }

  clearTimeout(game.confirmTimer);

  if (answer === 'no') {
    await ctx.answerCbQuery('❌ تم الرفض.').catch(() => {});
    return _cancelGame(ctx.telegram, chatId, gameId, 'confirming', '❌ رفض اللاعب التحدي.');
  }

  await ctx.answerCbQuery('✅ تم القبول! راجع رسائلك الخاصة.').catch(() => {});
  game.status = 'collecting';

  await ctx.telegram.editMessageText(chatId, game.inviteMsgId, null,
    `⚔️ *تم قبول التحدي!*\n\n` +
    `🔴 ${mention(game.p1)}\n` +
    `🔵 ${mention(game.p2)}\n\n` +
    `📩 يرجى إرسال صورتك السرية للبوت في الخاص...\n` +
    `⏳ عندكم *${COLLECT_SECS} ثانية*`,
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [] } }
  ).catch(() => {});

  // طلب الصورة من كل لاعب في PV
  for (const player of [game.p1, game.p2]) {
    await _requestPhoto(ctx.telegram, game, player);
  }

  // Timeout إذا ما رفعوا الصور
  game.collectTimer = setTimeout(async () => {
    const g = _games.get(s(chatId));
    if (!g || g.status !== 'collecting') return;
    const missing = [g.p1, g.p2].filter(p => !p.ready).map(p => name(p)).join(' و ');
    g.status = 'ended';
    _games.delete(s(chatId));
    _pvStates.delete(s(g.p1.id));
    _pvStates.delete(s(g.p2.id));
    await ctx.telegram.editMessageText(chatId, g.inviteMsgId, null,
      `❌ انتهى وقت رفع الصور.\n*${esc(missing)}* لم يرسل صورته في الوقت المحدد.`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
    setTimeout(() => ctx.telegram.deleteMessage(chatId, g.inviteMsgId).catch(() => {}), 10000);
  }, COLLECT_SECS * 1000);
}

async function _requestPhoto(telegram, game, player) {
  const BOT = process.env.BOT_USERNAME || '';
  const opp = player.id === game.p1.id ? game.p2 : game.p1;

  // سجّل الـ pvState أولاً حتى لو ما أرسلنا
  _pvStates.set(s(player.id), {
    gameKey: game.key,
    chatId:  s(game.chatId),
    step:    'waiting_photo',
    photo:   null,
    name:    null,
  });

  try {
    await telegram.sendMessage(player.id,
      `🎮 *تحدي "خمن"!*\n\n` +
      `⚔️ منافسك: *${esc(name(opp))}*\n\n` +
      `📸 أرسل لي الصورة التي تريد أن يخمنها منافسك.\n` +
      `_ستُكشف له فقط بعد انتهاء اللعبة._`,
      { parse_mode: 'Markdown' }
    );
    logger.info(`[GuessGame] PV sent to ${player.id}`);
  } catch (e) {
    logger.warn(`[GuessGame] PV unreachable for ${player.id}: ${e.message}`);
    // ← زر مباشر بدل رسالة نصية مربكة
    await telegram.sendMessage(game.chatId,
      `📩 ${mention(player)} اضغط الزر وابدأ البوت في الخاص لإرسال صورتك:`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '🤖 افتح البوت وأرسل صورتك', url: `https://t.me/${BOT}?start=guess_${game.id}` }
          ]]
        }
      }
    ).catch(() => {});
  }
}

/* ═══════════ PHASE 4 — COLLECT (PV) ═══════════ */
async function handlePvMessage(ctx) {
  if (ctx.chat?.type !== 'private') return false;

  const uid = s(ctx.from.id);
  const pv  = _pvStates.get(uid);
  if (!pv) return false;

  // انتظار الصورة
  if (pv.step === 'waiting_photo') {
    const photo = ctx.message?.photo;
    if (!photo?.length) {
      await ctx.reply('📷 أرسل *صورة* فقط، ليس نصاً أو ملفاً آخر.', { parse_mode: 'Markdown' }).catch(() => {});
      return true;
    }
    pv.photo = photo[photo.length - 1].file_id;
    pv.step  = 'waiting_name';
    await ctx.reply(
      `✅ *تم استلام الصورة!*\n\n` +
      `✏️ *الخطوة 2/2:* اكتب الاسم الصحيح للصورة.\n` +
      `_هذا ما سيقارنه البوت مع إجابة منافسك._\n\n` +
      `مثال: إذا الصورة برج إيفل، اكتب:\n\`برج إيفل\``,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
    return true;
  }

  // انتظار الاسم
  if (pv.step === 'waiting_name') {
    const txt = ctx.message?.text?.trim();
    if (!txt || txt.length < 1) {
      await ctx.reply('✏️ اكتب اسماً نصياً.').catch(() => {});
      return true;
    }

    pv.name = txt;
    pv.step = 'done';

    const game = _games.get(pv.chatId);
    if (!game || game.status !== 'collecting') {
      await ctx.reply('❌ انتهت اللعبة قبل أن تكمل.').catch(() => {});
      _pvStates.delete(uid);
      return true;
    }

    const isP1   = s(game.p1.id) === uid;
    const player = isP1 ? game.p1 : game.p2;
    player.photo = pv.photo;
    player.name  = pv.name;
    player.ready = true;
    _pvStates.delete(uid);

    await ctx.reply(
      `✅ *جاهز!*\n\n` +
      `🖼️ صورتك محفوظة سراً 🤫\n` +
      `📝 الاسم الذي أدخلته: *${esc(txt)}*\n\n` +
      `⏳ في انتظار منافسك...`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});

    // هل الطرفان جاهزان؟
    if (game.p1.ready && game.p2.ready) {
      clearTimeout(game.collectTimer);
      await beginGame(ctx.telegram, game);
    }

    return true;
  }

  return false;
}

/* ═══════════ PHASE 5 — GAME ACTIVE ═══════════ */
async function beginGame(telegram, game) {
  const chatId = s(game.chatId);
  game.status    = 'active';
  game.startedAt = Date.now();

  // إشعار كل لاعب في PV
  for (const player of [game.p1, game.p2]) {
    const opp = player.id === game.p1.id ? game.p2 : game.p1;
    await telegram.sendMessage(player.id,
      `🚀 *بدأت اللعبة!*\n\n` +
      `⚔️ منافسك: *${esc(name(opp))}*\n\n` +
      `💬 تحدث معه بحرية في القروب واطرح ما تشاء من أسئلة.\n` +
      `🎯 للتخمين اكتب في القروب:\n` +
      `\`تخمين: اسم الصورة\`\n\n` +
      `⏱️ عندك *5 دقائق!* بالتوفيق 🍀`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }

  const m = await telegram.editMessageText(chatId, game.inviteMsgId, null,
    `⚔️ *بدأت المباراة!*\n\n` +
    `🔴 ${mention(game.p1)}\n` +
    `🔵 ${mention(game.p2)}\n\n` +
    `💬 تحدثوا بحرية واطرحوا ما تشاؤون.\n\n` +
    `🎯 *للتخمين اكتب:*\n` +
    `\`تخمين: [الاسم الصحيح]\`\n\n` +
    `⏱️ المدة: *5 دقائق*`,
    { parse_mode: 'Markdown' }
  ).catch(() => null);

  if (m) logMsg(game.key, chatId, game.inviteMsgId);

  // مؤقت تحذير دقيقة أخيرة
  game.warnTimer = setTimeout(async () => {
    const g = _games.get(chatId);
    if (!g || g.status !== 'active') return;
    const w = await telegram.sendMessage(chatId,
      `⏰ *تبقّى دقيقة واحدة!* جادّوا في التخمين.`,
      { parse_mode: 'Markdown' }
    ).catch(() => null);
    if (w) {
      logMsg(game.key, chatId, w.message_id);
      setTimeout(() => telegram.deleteMessage(chatId, w.message_id).catch(() => {}), 40000);
    }
  }, (GAME_SECS - 60) * 1000);

  // مؤقت نهاية اللعبة
  game.gameTimer = setTimeout(() => endGame(telegram, chatId, 'timeout'), GAME_SECS * 1000);
}

/* ═══════════ PHASE 6 — GUESS ═══════════ */
async function handleGuess(ctx) {
  if (ctx.chat?.type === 'private') return false;
  const chatId = s(ctx.chat.id);
  const game   = _games.get(chatId);
  if (!game || game.status !== 'active') return false;

  const text = ctx.message?.text || '';
  const m    = text.match(/^تخمين[:\s]+(.+)$/i);
  if (!m) return false;

  const guess   = m[1].trim();
  const guesser = ctx.from;
  const isP1    = s(guesser.id) === s(game.p1.id);
  const isP2    = s(guesser.id) === s(game.p2.id);

  if (!isP1 && !isP2) {
    const w = await ctx.reply('🚫 أنت لست طرفاً في هذه اللعبة.').catch(() => null);
    ctx.telegram.deleteMessage(chatId, ctx.message.message_id).catch(() => {});
    if (w) setTimeout(() => ctx.telegram.deleteMessage(chatId, w.message_id).catch(() => {}), 4000);
    return true;
  }

  // التخمين يكون على صورة الخصم
  const target = isP1 ? game.p2 : game.p1;

  ctx.telegram.deleteMessage(chatId, ctx.message.message_id).catch(() => {});

  if (norm(guess) === norm(target.name)) {
    await handleWin(ctx.telegram, game, guesser, target);
  } else {
    const w = await ctx.telegram.sendMessage(chatId,
      `❌ *${esc(name(guesser))}* خمّن: _"${esc(guess)}"_ — غلط! حاول مجدداً 🤔`,
      { parse_mode: 'Markdown' }
    ).catch(() => null);
    if (w) {
      logMsg(game.key, chatId, w.message_id);
      setTimeout(() => ctx.telegram.deleteMessage(chatId, w.message_id).catch(() => {}), 6000);
    }
  }

  return true;
}

/* ═══════════ WIN ═══════════ */
async function handleWin(telegram, game, winner, loser) {
  clearTimeout(game.gameTimer);
  clearTimeout(game.warnTimer);
  game.status = 'ended';
  const chatId = s(game.chatId);
  _games.delete(chatId);

  // رسالة الفوز في القروب
  const resultMsg = await telegram.sendMessage(chatId,
    `🏆 *فاز ${mention(winner)}!*\n\n` +
    `✅ خمّن صورة ${mention(loser)} بشكل صحيح!\n` +
    `الإجابة كانت: *${esc(loser.name)}* 🎉`,
    { parse_mode: 'Markdown' }
  ).catch(() => null);

  // كشف الصورتين
  await telegram.sendPhoto(chatId, game.p1.photo, {
    caption: `🔴 صورة *${esc(name(game.p1))}*\n📝 الإجابة: *${esc(game.p1.name)}*`,
    parse_mode: 'Markdown',
  }).catch(() => {});

  await telegram.sendPhoto(chatId, game.p2.photo, {
    caption: `🔵 صورة *${esc(name(game.p2))}*\n📝 الإجابة: *${esc(game.p2.name)}*`,
    parse_mode: 'Markdown',
  }).catch(() => {});

  // إشعار PV
  await telegram.sendMessage(winner.id,
    `🏆 *أحسنت! فزت بالتحدي!*\nتمكنت من تخمين صورة منافسك. 💪`,
    { parse_mode: 'Markdown' }
  ).catch(() => {});

  await telegram.sendMessage(loser.id,
    `😔 *خسرت هذه الجولة.*\n${esc(name(winner))} تمكّن من تخمين صورتك.\nحظاً أوفر قادماً! 🍀`,
    { parse_mode: 'Markdown' }
  ).catch(() => {});

  // تنظيف الرسائل القديمة بعد 20 ثانية
  setTimeout(() => cleanMsgs(telegram, game.key, resultMsg?.message_id), 20000);
}

/* ═══════════ TIMEOUT ═══════════ */
async function endGame(telegram, chatId, reason) {
  const game = _games.get(s(chatId));
  if (!game || game.status !== 'active') return;
  clearTimeout(game.gameTimer);
  clearTimeout(game.warnTimer);
  game.status = 'ended';
  _games.delete(s(chatId));

  const resultMsg = await telegram.sendMessage(chatId,
    `⏰ *انتهى الوقت!*\n\nلم يتمكن أي لاعب من التخمين الصحيح.\n📸 كشف الصور:`,
    { parse_mode: 'Markdown' }
  ).catch(() => null);

  await telegram.sendPhoto(chatId, game.p1.photo, {
    caption: `🔴 صورة *${esc(name(game.p1))}*\nكانت: *"${esc(game.p1.name)}"*`,
    parse_mode: 'Markdown',
  }).catch(() => {});

  await telegram.sendPhoto(chatId, game.p2.photo, {
    caption: `🔵 صورة *${esc(name(game.p2))}*\nكانت: *"${esc(game.p2.name)}"*`,
    parse_mode: 'Markdown',
  }).catch(() => {});

  for (const p of [game.p1, game.p2]) {
    await telegram.sendMessage(p.id,
      `⏰ انتهى الوقت! لم يفز أحد. حاولوا مجدداً في القروب! 🎮`,
    ).catch(() => {});
  }

  setTimeout(() => cleanMsgs(telegram, game.key, resultMsg?.message_id), 20000);
}

/* ═══════════ CANCEL HELPER ═══════════ */
async function _cancelGame(telegram, chatId, gameId, fromStatus, msg) {
  const game = _games.get(s(chatId));
  if (!game || game.id !== parseInt(gameId) || game.status !== fromStatus) return;
  game.status = 'ended';
  clearTimeout(game.inviteTimer);
  clearTimeout(game.confirmTimer);
  _games.delete(s(chatId));

  await telegram.editMessageText(chatId, game.inviteMsgId, null, msg, {
    parse_mode: 'Markdown', reply_markup: { inline_keyboard: [] }
  }).catch(() => {});

  setTimeout(() => telegram.deleteMessage(chatId, game.inviteMsgId).catch(() => {}), 8000);
}

/* ═══════════ REGISTER ═══════════ */
function register(bot) {

  // deep link: /start guess_GAMEID — لما لاعب يفتح البوت من زر اللعبة
  bot.start(async (ctx) => {
    const payload = ctx.startPayload || '';
    if (!payload.startsWith('guess_')) return;
    const uid = s(ctx.from.id);
    const pv  = _pvStates.get(uid);
    if (!pv) {
      return ctx.reply('⚠️ انتهت اللعبة أو لم تُدعَ لأي تحدٍّ حالياً.').catch(() => {});
    }
    await ctx.reply(
      '📸 أرسل لي الصورة التي تريد أن يخمنها منافسك.',
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  });

  // أمر التشغيل في القروب
  bot.hears(/^خمن$/i, async ctx => {
    if (!ctx.chat || ctx.chat.type === 'private') return;
    return startInvite(ctx);
  });

  // رسائل الـ PV (صورة + نص)
  bot.on(['photo', 'text'], async (ctx, next) => {
    if (ctx.chat?.type !== 'private') return next();
    const handled = await handlePvMessage(ctx).catch(e => {
      logger.error('[GuessGame:pv] ' + e.message);
      return false;
    });
    if (!handled) return next();
  });

  // مراقبة التخمينات في القروب
  bot.on('text', async (ctx, next) => {
    if (ctx.chat?.type === 'private') return next();
    const handled = await handleGuess(ctx).catch(e => {
      logger.error('[GuessGame:guess] ' + e.message);
      return false;
    });
    if (handled) return;
    return next();
  });

  // Callbacks
  bot.on('callback_query', async (ctx, next) => {
    const d = ctx.callbackQuery?.data || '';

    const jm = d.match(/^gg_join_(-?\d+)_(\d+)$/);
    if (jm) return handleJoin(ctx, jm[1], jm[2]);

    const cm = d.match(/^gg_cf_(-?\d+)_(\d+)_(yes|no)$/);
    if (cm) return handleConfirm(ctx, cm[1], cm[2], cm[3]);

    return next();
  });

  logger.info('[GuessGame] ✅ registered');
}

async function handleCallback(ctx) {
  const d = ctx.callbackQuery?.data || '';
  const jm = d.match(/^gg_join_(-?d+)_(d+)$/);
  if (jm) return handleJoin(ctx, jm[1], jm[2]);
  const cm = d.match(/^gg_cf_(-?d+)_(d+)_(yes|no)$/);
  if (cm) return handleConfirm(ctx, cm[1], cm[2], cm[3]);
}

module.exports = { register, startInvite, handleCallback };
