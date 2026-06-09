'use strict';
/**
 * 🎮 لعبة "خمن" — نص فقط، بدون أزرار
 * خمن  ← يبدأ التحدي
 * انا  ← ينضم المنافس
 */

const logger = require('../utils/logger');

const INVITE_SECS  = 60;
const COLLECT_SECS = 600;
const GAME_SECS    = 480; // 8 دقائق

const _games    = new Map(); // chatId → game
const _pvStates = new Map(); // userId → pvState
const _toDelete = new Map(); // chatId → [msgIds]

const s    = v => String(v || '');
const norm = t => s(t).trim().toLowerCase()
  .replace(/[أإآا]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/\s+/g,' ');
const esc  = t => s(t).replace(/[_*[\]()~`>#+=|{}.!\-]/g,'\\$&');
const uname = u => u ? ([u.first_name,u.last_name].filter(Boolean).join(' ')||u.username||s(u.id)) : '؟';
const mention = u => u.username ? `@${u.username}` : `[${esc(uname(u))}](tg://user?id=${u.id})`;

function trackMsg(chatId, msgId) {
  if (!msgId) return;
  if (!_toDelete.has(chatId)) _toDelete.set(chatId, []);
  _toDelete.get(chatId).push(msgId);
}

async function cleanGroup(telegram, chatId, keepId) {
  const ids = _toDelete.get(chatId) || [];
  await Promise.allSettled(
    ids.filter(id => id !== keepId)
       .map(id => telegram.deleteMessage(chatId, id).catch(() => {}))
  );
  _toDelete.delete(chatId);
}

/* ══════ PHASE 1 — خمن ══════ */
async function startInvite(ctx) {
  const chatId = s(ctx.chat.id);
  const user   = ctx.from;

  const ex = _games.get(chatId);
  const _uid = s(user.id);
  const _pvBusy = _pvStates.has(_uid);
  if ((ex && ex.status !== 'ended') || _pvBusy) {
    const w = await ctx.telegram.sendMessage(chatId,
      `⏳ *يوجد تحدٍّ نشط بالفعل!*\nانتظر انتهاءه ثم ابدأ جولة جديدة.`
    ).catch(() => null);
    if (w) setTimeout(() => ctx.telegram.deleteMessage(chatId, w.message_id).catch(() => {}), 5000);
    ctx.telegram.deleteMessage(chatId, ctx.message.message_id).catch(() => {});
    return;
  }

  // نبقي رسالة خمن لأن الرد سيكون عليها

  const gameId = Date.now();
  const game = {
    id: gameId, chatId,
    status: 'waiting',
    p1: { ...user }, p2: null,
    inviteMsgId: null,
    inviteTimer: null, collectTimer: null, gameTimer: null, warnTimer: null,
  };
  _games.set(chatId, game);


  const _botInfo = await ctx.telegram.getMe().catch(() => ({ username: '' }));
  const _botLink = _botInfo.username ? `https://t.me/${_botInfo.username}` : '';
  const _startMsgId = ctx.message?.message_id;
  const m = await ctx.telegram.sendMessage(chatId,
    `🎮 *تحدي خمن الصورة!*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 ${mention(user)} يتحدى الجميع!\n\n` +
    `📌 *كيف تلعب؟*\n` +
    `1️⃣ اكتب *انا* للانضمام\n` +
    `2️⃣ افتح البوت وأرسل صورة سرية\n` +
    `3️⃣ أول من يخمن صورة خصمه يفوز 🏆\n\n` +
    `⏳ *60 ثانية* للانضمام`,
    { parse_mode: 'Markdown', reply_to_message_id: _startMsgId }
  ).catch(() => null);

  if (!m) { _games.delete(chatId); return; }

  game.inviteMsgId = m.message_id;
  trackMsg(chatId, m.message_id);

  // ── عداد تنازلي يتحدث كل 10 ثواني ──
  const _cdStart = Date.now();
  const _cdInterval = setInterval(async () => {
    const g = _games.get(chatId);
    if (!g || g.status !== 'waiting') { clearInterval(_cdInterval); return; }
    const elapsed = Math.floor((Date.now() - _cdStart) / 1000);
    const left    = INVITE_SECS - elapsed;
    if (left <= 0) { clearInterval(_cdInterval); return; }
    const bar = '█'.repeat(Math.floor(left/6)) + '░'.repeat(10 - Math.floor(left/6));
    await ctx.telegram.editMessageText(chatId, game.inviteMsgId, null,
      `🎮 *تحدي جديد من ${mention(user)}!*\n\n` +
      `🖼️ كل لاعب يختار صورة سرية، والآخر يحاول تخمينها خلال 5 دقائق عبر الحوار الحر.\n\n` +
      `✏️ اكتب *انا* للانضمام\n` +
      `⏳ ${bar} *${left}ث*`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }, 10000);
  game._cdInterval = _cdInterval;

  game.inviteTimer = setTimeout(async () => {
    clearInterval(_cdInterval);
    const g = _games.get(chatId);
    if (!g || g.status !== 'waiting') return;
    g.status = 'ended';
    _games.delete(chatId);
    const r = await ctx.telegram.sendMessage(chatId,
      `⏰ انتهى وقت الدعوة، لم ينضم أحد.`
    ).catch(() => null);
    await cleanGroup(ctx.telegram, chatId, null);
    if (r) setTimeout(() => ctx.telegram.deleteMessage(chatId, r.message_id).catch(() => {}), 8000);
  }, INVITE_SECS * 1000);
}

/* ══════ PHASE 2 — انا ══════ */
async function handleJoin(ctx) {
  const chatId = s(ctx.chat.id);
  const user   = ctx.from;
  const game   = _games.get(chatId);

  if (!game || game.status !== 'waiting') return;
  if (s(user.id) === s(game.p1.id)) {
    const w = await ctx.telegram.sendMessage(chatId, `😄 ${mention(user)} لا تستطيع التحدي مع نفسك!`, { parse_mode: 'Markdown' }).catch(() => null);
    ctx.telegram.deleteMessage(chatId, ctx.message.message_id).catch(() => {});
    if (w) { trackMsg(chatId, w.message_id); setTimeout(() => ctx.telegram.deleteMessage(chatId, w.message_id).catch(() => {}), 4000); }
    return;
  }

  // أرسل زر البوت للاعب الجديد
  try {
    const _bu = await ctx.telegram.getMe().catch(()=>({username:''}));
    if (_bu.username) {
      const _bl = `https://t.me/${_bu.username}`;
      await ctx.telegram.sendMessage(user.id,
        `🎮 *انضممت للتحدي\!*\n\n` +
        `📸 أرسل صورتك السرية الآن\n` +
        `ثم اكتب اسمها`,
        { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: [[{ text: '📸 أرسل صورتك هنا', url: _bl }]] } }
      ).catch(() => {
        // إذا ما فتح المستخدم البوت — أرسل في القروب
        ctx.telegram.sendMessage(ctx.chat.id,
          `📌 ${mention(user)} أرسل صورتك السرية للبوت!`,
          { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🤖 فتح البوت', url: _bl }]] } }
        ).catch(() => {});
      });
    }
  } catch(_) {}

  clearTimeout(game.inviteTimer);
  clearInterval(game._cdInterval);
  game.status = 'collecting';
  game.p2     = { ...user };

  ctx.telegram.deleteMessage(chatId, ctx.message.message_id).catch(() => {});

  // امسح كل رسائل الدعوة
  await cleanGroup(ctx.telegram, chatId, null);

  // رسالة المشاركين
  const _bu2 = await ctx.telegram.getMe().catch(() => ({ username: '' }));
  const _bl2 = _bu2.username ? `https://t.me/${_bu2.username}` : '';
  const m = await ctx.telegram.sendMessage(chatId,
    `🎯 *المباراة بدأت!*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🔴 ${mention(game.p1)}\n` +
    `🔵 ${mention(game.p2)}\n\n` +
    `⏳ عندكم *5 دقائق* لإرسال الصور السرية\n` +
    `📲 افتح البوت وأرسل صورتك الآن!`,
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
      [{ text: '📸 أرسل صورتك للبوت', url: _bl2 }]
    ]}}
  ).catch(() => null);

  if (m) trackMsg(chatId, m.message_id);

  // اطلب الصور في PV
  for (const player of [game.p1, game.p2]) {
    await _requestPhoto(ctx.telegram, game, player);
  }

  // تحذير دقيقتين قبل انتهاء الوقت
  setTimeout(async () => {
    const g = _games.get(chatId);
    if (!g || g.status !== 'collecting') return;
    const pending = [g.p1, g.p2].filter(p => !p.ready).map(p => mention(p)).join(' و ');
    if (!pending) return;
    const w = await ctx.telegram.sendMessage(chatId,
      `⚠️ تبقّت *دقيقتان* لإرسال الصور!\n📲 ${pending} تحقق من رسائلك الخاصة مع البوت.`,
      { parse_mode: 'Markdown' }
    ).catch(() => null);
    if (w) setTimeout(() => ctx.telegram.deleteMessage(chatId, w.message_id).catch(() => {}), 110000);
  }, (COLLECT_SECS - 120) * 1000);

  // Timeout للجمع
  game.collectTimer = setTimeout(async () => {
    const g = _games.get(chatId);
    if (!g || g.status !== 'collecting') return;
    g.status = 'ended';
    _games.delete(chatId);
    _pvStates.delete(s(g.p1.id));
    _pvStates.delete(s(g.p2.id));
    const miss = [g.p1, g.p2].filter(p => !p.ready).map(p => uname(p)).join(' و ');
    const r = await ctx.telegram.sendMessage(chatId,
      `⚠️ *انتهت الجولة*\n` +
    `┄┄┄┄┄┄┄┄┄┄\n` +
    `${esc(miss)} لم يرسل صورته في الوقت المحدد.\n` +
    `اكتب *خمن* لبدء جولة جديدة!`,
      { parse_mode: 'Markdown' }
    ).catch(() => null);
    await cleanGroup(ctx.telegram, chatId, r?.message_id);
  }, COLLECT_SECS * 1000);
}

/* ══════ REQUEST PHOTO ══════ */
async function _requestPhoto(telegram, game, player) {
  const BOT = process.env.BOT_USERNAME || '';
  const opp = s(player.id) === s(game.p1.id) ? game.p2 : game.p1;

  _pvStates.set(s(player.id), {
    chatId: s(game.chatId),
    step:   'waiting_photo',
    photo:  null,
    name:   null,
  });

  try {
    await telegram.sendMessage(player.id,
      `🎮 *تحدي خمن — مرحباً!*\n` +
      `┄┄┄┄┄┄┄┄┄┄\n` +
      `⚔️ منافسك: *${esc(uname(opp))}*\n\n` +
      `📸 *الخطوة 1:* أرسل لي الصورة السرية\n` +
      `_لن يراها منافسك إلا بعد انتهاء اللعبة_\n\n` +
      `⏳ عندك 5 دقائق للإرسال`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    logger.warn(`[GuessGame] PV fail ${player.id}: ${e.message}`);
    const chatId = s(game.chatId);
    await telegram.sendMessage(chatId,
      `📩 ${mention(player)} ابدأ البوت في الخاص ثم أرسل صورتك:`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[
          { text: '🤖 افتح البوت', url: `https://t.me/${BOT}?start=guess_${game.id}` }
        ]]}
      }
    ).catch(() => {});
  }
}

/* ══════ PHASE 3 — PV Collection ══════ */
async function handlePvMessage(ctx) {
  if (ctx.chat?.type !== 'private') return false;
  const uid = s(ctx.from.id);
  const pv  = _pvStates.get(uid);
  if (!pv) return false;

  if (pv.step === 'waiting_photo') {
    const photo = ctx.message?.photo;
    if (!photo?.length) {
      await ctx.reply('📷 أرسل *صورة* فقط.', { parse_mode: 'Markdown' }).catch(() => {});
      return true;
    }
    if (pv._lock) return true; // منع double-processing
    pv._lock = true;
    pv.photo = photo[photo.length - 1].file_id;
    pv.step  = 'waiting_name';
    delete pv._lock;
    await ctx.reply(
      `✅ *تم استلام الصورة!*\n\n✏️ الآن اكتب الاسم الصحيح للصورة.\nمثال: \`برج إيفل\``,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
    return true;
  }

  if (pv.step === 'waiting_name') {
    // إذا أرسل صورة بدل نص في هذه المرحلة
    if (ctx.message?.photo) {
      await ctx.reply('✅ الصورة محفوظة بالفعل! ✏️ الآن اكتب *الاسم* فقط نصاً.', { parse_mode: 'Markdown' }).catch(() => {});
      return true;
    }
    const txt = ctx.message?.text?.trim();
    if (!txt) { await ctx.reply('✏️ اكتب الاسم نصاً.').catch(() => {}); return true; }
    if (pv._lock) return true;
    pv._lock = true;
    pv.name = txt;
    pv.step = 'done';
    delete pv._lock;

    const game = _games.get(pv.chatId);
    if (!game || game.status !== 'collecting') {
      await ctx.reply('❌ انتهت اللعبة.').catch(() => {});
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
      `✅ *جاهز!*\nالاسم المحفوظ: *${esc(txt)}* 🤫\n\nفي انتظار منافسك...`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});

    if (game.p1.ready && game.p2.ready) {
      clearTimeout(game.collectTimer);
      await beginGame(ctx.telegram, game);
    }
    return true;
  }

  return false;
}

/* ══════ PHASE 4 — Game Active ══════ */
async function beginGame(telegram, game) {
  const chatId = s(game.chatId);
  game.status    = 'active';
  game.startedAt = Date.now();

  for (const player of [game.p1, game.p2]) {
    const opp = s(player.id) === s(game.p1.id) ? game.p2 : game.p1;
    await telegram.sendMessage(player.id,
      `🚀 *انطلقت اللعبة!*\n` +
      `━━━━━━━━━━━━━━━\n` +
      `⚔️ منافسك: *${esc(uname(opp))}*\n\n` +
      `💬 تحدث معه بحرية في القروب\n` +
      `🎯 للتخمين اكتب في القروب اسم صورة منافسك مباشرة\n\n` +
      `⏱️ عندك *8 دقائق* — بالتوفيق! 🍀`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }

  await cleanGroup(telegram, chatId, null);

  const m = await telegram.sendMessage(chatId,
    `🔥 *انطلقت المباراة!*\n` +
    `━━━━━━━━━━━━━━━\n` +
    `🔴 ${mention(game.p1)}\n` +
    `🔵 ${mention(game.p2)}\n\n` +
    `💬 تحدثوا بحرية وتبادلوا الأسئلة\n` +
    `🎯 اكتب اسم صورة منافسك مباشرة\n` +
    `⏱️ المدة: *8 دقائق* 🍀`,
    { parse_mode: 'Markdown' }
  ).catch(() => null);

  if (m) trackMsg(chatId, m.message_id);

  game.warnTimer = setTimeout(async () => {
    const g = _games.get(chatId);
    if (!g || g.status !== 'active') return;
    const w = await telegram.sendMessage(chatId, `⏰ *تبقّت دقيقة!*`, { parse_mode: 'Markdown' }).catch(() => null);
    if (w) { trackMsg(chatId, w.message_id); setTimeout(() => telegram.deleteMessage(chatId, w.message_id).catch(() => {}), 50000); }
  }, (GAME_SECS - 60) * 1000);

  game.gameTimer = setTimeout(() => endGame(telegram, chatId), GAME_SECS * 1000);
}

/* ══════ PHASE 5 — Guess ══════ */
async function handleGuess(ctx) {
  if (ctx.chat?.type === 'private') return false;
  const chatId = s(ctx.chat.id);
  const game   = _games.get(chatId);
  if (!game || game.status !== 'active') return false;

  const text = ctx.message?.text || '';
  // يقبل: "تخمين: اسم" أو "اسم" مباشرة
  const m    = text.match(/^تخمين[:\s]+(.+)$/i);
  const guess = m ? m[1].trim() : text.trim();
  if (!guess || guess.length < 1) return false;
  const guesser = ctx.from;
  const isP1    = s(guesser.id) === s(game.p1.id);
  const isP2    = s(guesser.id) === s(game.p2.id);

  ctx.telegram.deleteMessage(chatId, ctx.message.message_id).catch(() => {});

  if (!isP1 && !isP2) return true;

  const target = isP1 ? game.p2 : game.p1;

  if (norm(guess) === norm(target.name)) {
    await handleWin(ctx.telegram, game, guesser, target);
  } else {
    const w = await ctx.telegram.sendMessage(chatId,
      `❌ *${esc(uname(guesser))}* خمّن: _"${esc(guess)}"_ — غلط! 🤔`,
      { parse_mode: 'Markdown' }
    ).catch(() => null);
    if (w) { trackMsg(chatId, w.message_id); setTimeout(() => ctx.telegram.deleteMessage(chatId, w.message_id).catch(() => {}), 6000); }
  }
  return true;
}

/* ══════ WIN ══════ */
async function handleWin(telegram, game, winner, loser) {
  clearTimeout(game.gameTimer);
  clearTimeout(game.warnTimer);
  game.status = 'ended';
  const chatId = s(game.chatId);
  _games.delete(chatId);

  await cleanGroup(telegram, chatId, null);

  const r = await telegram.sendMessage(chatId,
    `🏆 *انتهت المباراة!*\n` +
    `━━━━━━━━━━━━━━━\n` +
    `👑 *الفائز:* ${mention(winner)} 🎉\n` +
    `✅ خمّن الإجابة: *${esc(loser.name)}*\n\n` +
    `📸 *كشف الصور:*`,
    { parse_mode: 'Markdown' }
  ).catch(() => null);

  await telegram.sendPhoto(chatId, game.p1.photo, { caption: `🔴 صورة *${esc(uname(game.p1))}*\nالإجابة: *${esc(game.p1.name)}*`, parse_mode: 'Markdown' }).catch(() => {});
  await telegram.sendPhoto(chatId, game.p2.photo, { caption: `🔵 صورة *${esc(uname(game.p2))}*\nالإجابة: *${esc(game.p2.name)}*`, parse_mode: 'Markdown' }).catch(() => {});

  // ── إضافة جائزة لعبة خمن للبنك ──
  try {
    const bank = require('./bank');
    await bank.addWinnings(winner.id, winner.first_name, winner.username, 500, 'جائزة لعبة خمن');
  } catch(_) {}

  for (const p of [winner, { id: loser.id }]) {
    const isWinner = s(p.id) === s(winner.id);
    const msg = isWinner
      ? '🏆 *فزت!* أحسنت، خمّنت صورة منافسك! 💪🎊\n\n💰 *ربحت 500 $* تم إضافتها لحسابك البنكي!'
      : '😔 *خسرت هذه الجولة*\nمنافسك كان أسرع! حظاً أوفر المرة القادمة 🍀';
    await telegram.sendMessage(p.id, msg, { parse_mode: 'Markdown' }).catch(() => {});
  }
}

/* ══════ TIMEOUT ══════ */
async function endGame(telegram, chatId) {
  const game = _games.get(s(chatId));
  if (!game || game.status !== 'active') return;
  clearTimeout(game.gameTimer);
  clearTimeout(game.warnTimer);
  game.status = 'ended';
  _games.delete(s(chatId));

  await cleanGroup(telegram, chatId, null);

  await telegram.sendMessage(chatId,
    `⏰ *انتهت المباراة!*\n` +
    `┄┄┄┄┄┄┄┄┄┄\n` +
    `🤝 تعادل — لم يتمكن أحد من التخمين\n\n` +
    `📸 كشف الصور:`,
    { parse_mode: 'Markdown' }
  ).catch(() => {});

  await telegram.sendPhoto(chatId, game.p1.photo, { caption: `🔴 *${esc(uname(game.p1))}*\nكانت: *"${esc(game.p1.name)}"*`, parse_mode: 'Markdown' }).catch(() => {});
  await telegram.sendPhoto(chatId, game.p2.photo, { caption: `🔵 *${esc(uname(game.p2))}*\nكانت: *"${esc(game.p2.name)}"*`, parse_mode: 'Markdown' }).catch(() => {});

  for (const p of [game.p1, game.p2]) {
    await telegram.sendMessage(p.id, `⏰ انتهى الوقت! لم يفز أحد. حاولوا مجدداً! 🎮`).catch(() => {});
  }
}

/* ══════ REGISTER ══════ */
function register(bot) {

  // حالة اللعبة في PV
  bot.command('gamestatus', async ctx => {
    if (ctx.chat?.type !== 'private') return;
    const uid = s(ctx.from.id);
    const pv  = _pvStates.get(uid);
    if (!pv) return ctx.reply('لا توجد لعبة نشطة لك حالياً.').catch(() => {});
    const stepMap = { waiting_photo: '📸 في انتظار صورتك', waiting_name: '✏️ في انتظار اسم الصورة', done: '✅ جاهز' };
    ctx.reply(
      `🎮 *حالة لعبتك:*
${stepMap[pv.step] || pv.step}

` +
      (pv.step === 'waiting_photo' ? '📸 أرسل الصورة السرية الآن' : '') +
      (pv.step === 'waiting_name'  ? '✏️ اكتب اسم الصورة التي أرسلتها' : ''),
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  });


  // تخمينات في القروب فقط (PV يُعالج في bypass قبل auth)
  bot.on('text', async (ctx, next) => {
    if (ctx.chat?.type === 'private') return next();
    const handled = await handleGuess(ctx).catch(() => false);
    if (handled) return;
    return next();
  });

  logger.info('[GuessGame] ✅ registered');
}

function isGameActive(chatId) {
  const game = _games.get(String(chatId));
  return game && game.status !== 'ended';
}
function hasPvState(uid) {
  return _pvStates.has(String(uid));
}

async function handlePvDirect(ctx) {
  return handlePvMessage(ctx);
}

module.exports = { register, startInvite, handleJoin, isGameActive, hasPvState, handlePvDirect, handleGuessMsg: handleGuess };
