'use strict';
/**
 * 🎮 لعبة "خمن الصورة" — احترافية
 * ─────────────────────────────────
 * خمن     ← يبدأ التحدي في القروب
 * انا     ← ينضم المنافس
 * تخمين: [الاسم] ← محاولة التخمين
 */

const logger = require('../utils/logger');

// ── الإعدادات ──────────────────────────────────────────
const CFG = {
  INVITE_SECS:  60,   // وقت انتظار المنافس
  COLLECT_SECS: 300,  // وقت إرسال الصور (5 دقائق)
  GAME_SECS:    300,  // وقت التخمين (5 دقائق)
  MAX_ATTEMPTS: 5,    // أقصى محاولات لكل لاعب
  WARN_BEFORE:  60,   // تحذير قبل انتهاء الوقت
};

// ── الخرائط ────────────────────────────────────────────
const _games    = new Map(); // chatId → game
const _pvStates = new Map(); // userId → pvState
const _toDelete = new Map(); // chatId → [msgIds]

// ── مساعدات النصوص ─────────────────────────────────────
const s      = v => String(v || '');
const norm   = t => s(t).trim().toLowerCase()
  .replace(/[أإآا]/g, 'ا')
  .replace(/ة/g, 'ه')
  .replace(/ى/g, 'ي')
  .replace(/[\s\-_]/g, '')
  .replace(/[.,!?؟،؛]/g, '');

// تحقق تقريبي — يقبل إذا كان التشابه 80% فأكثر
function isSimilar(a, b) {
  const na = norm(a), nb = norm(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  // Levenshtein distance بسيط
  if (Math.abs(na.length - nb.length) > 3) return false;
  let diff = 0;
  const min = Math.min(na.length, nb.length);
  for (let i = 0; i < min; i++) if (na[i] !== nb[i]) diff++;
  diff += Math.abs(na.length - nb.length);
  return diff <= Math.floor(Math.max(na.length, nb.length) * 0.25);
}

const uname = u => u ? ([u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || s(u.id)) : '؟';
const mention = u => u.username ? `@${u.username}` : `[${uname(u)}](tg://user?id=${u.id})`;
const esc = t => s(t).replace(/[_*[\]()~`>#+=|{}.!\-]/g, '\\$&');

// ── إدارة الرسائل ──────────────────────────────────────
function trackMsg(chatId, msgId) {
  if (!msgId) return;
  if (!_toDelete.has(chatId)) _toDelete.set(chatId, []);
  _toDelete.get(chatId).push(msgId);
}

async function cleanGroup(telegram, chatId, keepIds = []) {
  const ids = (_toDelete.get(chatId) || []).filter(id => !keepIds.includes(id));
  await Promise.allSettled(ids.map(id => telegram.deleteMessage(chatId, id).catch(() => {})));
  _toDelete.delete(chatId);
}

function buildTimer(left, total) {
  const pct   = Math.max(0, Math.min(10, Math.round((left / total) * 10)));
  const color = left > 60 ? '🟩' : left > 20 ? '🟨' : '🟥';
  return color.repeat(pct) + '⬛'.repeat(10 - pct) + ` *${left}ث*`;
}

// ══════════════════════════════════════════════════════
// PHASE 1 — بدء التحدي (خمن)
// ══════════════════════════════════════════════════════
async function startInvite(ctx) {
  const chatId = s(ctx.chat.id);
  const user   = ctx.from;

  // تحقق من لعبة نشطة
  const ex = _games.get(chatId);
  if (ex && ex.status !== 'ended') {
    const w = await ctx.telegram.sendMessage(chatId,
      `⚠️ يوجد تحدٍّ نشط بالفعل!\nانتظر انتهاءه ثم ابدأ جولة جديدة.`
    ).catch(() => null);
    ctx.telegram.deleteMessage(chatId, ctx.message.message_id).catch(() => {});
    if (w) setTimeout(() => ctx.telegram.deleteMessage(chatId, w.message_id).catch(() => {}), 5000);
    return;
  }

  ctx.telegram.deleteMessage(chatId, ctx.message.message_id).catch(() => {});

  const game = {
    id: Date.now(), chatId,
    status: 'waiting',
    p1: { ...user, attempts: 0 },
    p2: null,
    inviteMsgId: null,
    _timers: [],
  };
  _games.set(chatId, game);

  const m = await ctx.telegram.sendMessage(chatId,
    `🎮 *تحدي خمن الصورة!*\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `👤 المتحدي: ${mention(user)}\n\n` +
    `📋 *القواعد:*\n` +
    `📸 كل لاعب يختار صورة سرية\n` +
    `✉️ يرسلها للبوت في الخاص\n` +
    `💬 تتحدثون بحرية في القروب\n` +
    `🎯 اكتب \`تخمين: الاسم\` للفوز\n` +
    `❌ لديك *${CFG.MAX_ATTEMPTS} محاولات* فقط!\n\n` +
    `${buildTimer(CFG.INVITE_SECS, CFG.INVITE_SECS)}\n\n` +
    `✏️ اكتب *انا* للانضمام`,
    { parse_mode: 'Markdown' }
  ).catch(() => null);

  if (!m) { _games.delete(chatId); return; }
  game.inviteMsgId = m.message_id;
  trackMsg(chatId, m.message_id);

  // ── عداد تنازلي كل 10 ثواني ──
  const start = Date.now();
  const cdInterval = setInterval(async () => {
    const g = _games.get(chatId);
    if (!g || g.status !== 'waiting') { clearInterval(cdInterval); return; }
    const left = Math.max(0, CFG.INVITE_SECS - Math.floor((Date.now() - start) / 1000));
    await ctx.telegram.editMessageText(chatId, game.inviteMsgId, null,
      `🎮 *تحدي خمن الصورة!*\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `👤 المتحدي: ${mention(user)}\n\n` +
      `📋 *القواعد:*\n` +
      `📸 كل لاعب يختار صورة سرية\n` +
      `✉️ يرسلها للبوت في الخاص\n` +
      `💬 تتحدثون بحرية في القروب\n` +
      `🎯 اكتب \`تخمين: الاسم\` للفوز\n` +
      `❌ لديك *${CFG.MAX_ATTEMPTS} محاولات* فقط!\n\n` +
      `${buildTimer(left, CFG.INVITE_SECS)}\n\n` +
      `✏️ اكتب *انا* للانضمام`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }, 10000);
  game._timers.push(cdInterval);

  // ── timeout انتهاء الدعوة ──
  const inviteTimeout = setTimeout(async () => {
    clearInterval(cdInterval);
    const g = _games.get(chatId);
    if (!g || g.status !== 'waiting') return;
    g.status = 'ended';
    _games.delete(chatId);
    await cleanGroup(ctx.telegram, chatId);
    const r = await ctx.telegram.sendMessage(chatId,
      `⏰ انتهى وقت الدعوة — لم ينضم أحد.\n\nاكتب *خمن* لبدء تحدٍّ جديد!`
    ).catch(() => null);
    if (r) setTimeout(() => ctx.telegram.deleteMessage(chatId, r.message_id).catch(() => {}), 8000);
  }, CFG.INVITE_SECS * 1000);
  game._timers.push(inviteTimeout);
}

// ══════════════════════════════════════════════════════
// PHASE 2 — الانضمام (انا)
// ══════════════════════════════════════════════════════
async function handleJoin(ctx) {
  const chatId = s(ctx.chat.id);
  const user   = ctx.from;
  const game   = _games.get(chatId);

  if (!game || game.status !== 'waiting') return;
  if (s(user.id) === s(game.p1.id)) {
    const w = await ctx.telegram.sendMessage(chatId,
      `😄 ${mention(user)} لا تستطيع التحدي مع نفسك!`,
      { parse_mode: 'Markdown' }
    ).catch(() => null);
    ctx.telegram.deleteMessage(chatId, ctx.message.message_id).catch(() => {});
    if (w) setTimeout(() => ctx.telegram.deleteMessage(chatId, w.message_id).catch(() => {}), 4000);
    return;
  }

  // أوقف كل timers السابقة
  game._timers.forEach(t => { clearTimeout(t); clearInterval(t); });
  game._timers = [];
  game.status = 'collecting';
  game.p2 = { ...user, attempts: 0 };

  ctx.telegram.deleteMessage(chatId, ctx.message.message_id).catch(() => {});
  await cleanGroup(ctx.telegram, chatId);

  const m = await ctx.telegram.sendMessage(chatId,
    `⚔️ *اكتملت المباراة!*\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `🔴 ${mention(game.p1)}\n` +
    `🔵 ${mention(game.p2)}\n\n` +
    `📲 *تحقق من رسائلك الخاصة مع البوت*\n` +
    `📸 أرسل صورتك السرية خلال *5 دقائق*`,
    { parse_mode: 'Markdown' }
  ).catch(() => null);
  if (m) trackMsg(chatId, m.message_id);

  // اطلب الصور من اللاعبين
  for (const player of [game.p1, game.p2]) {
    await _requestPhoto(ctx.telegram, game, player);
  }

  // تحذير دقيقتين قبل انتهاء وقت الإرسال
  const warnT = setTimeout(async () => {
    const g = _games.get(chatId);
    if (!g || g.status !== 'collecting') return;
    const pending = [g.p1, g.p2].filter(p => !p.ready).map(p => mention(p)).join(' و ');
    if (!pending) return;
    const w = await ctx.telegram.sendMessage(chatId,
      `⚠️ تبقّت *دقيقتان* لإرسال الصور!\n${pending} افتح الخاص مع البوت`,
      { parse_mode: 'Markdown' }
    ).catch(() => null);
    if (w) setTimeout(() => ctx.telegram.deleteMessage(chatId, w.message_id).catch(() => {}), 115000);
  }, (CFG.COLLECT_SECS - 120) * 1000);
  game._timers.push(warnT);

  // timeout إرسال الصور
  const collectT = setTimeout(async () => {
    const g = _games.get(chatId);
    if (!g || g.status !== 'collecting') return;
    g.status = 'ended';
    _games.delete(chatId);
    _pvStates.delete(s(g.p1.id));
    _pvStates.delete(s(g.p2?.id));
    const miss = [g.p1, g.p2].filter(p => p && !p.ready).map(p => uname(p)).join(' و ');
    await cleanGroup(ctx.telegram, chatId);
    const r = await ctx.telegram.sendMessage(chatId,
      `⏰ *انتهى الوقت!*\n\n` +
      `${miss} لم يرسل صورته في الوقت المحدد.\n\nاكتب *خمن* لبدء جولة جديدة!`
    ).catch(() => null);
    if (r) setTimeout(() => ctx.telegram.deleteMessage(chatId, r.message_id).catch(() => {}), 10000);
  }, CFG.COLLECT_SECS * 1000);
  game._timers.push(collectT);
}

// ══════════════════════════════════════════════════════
// طلب الصورة في الخاص
// ══════════════════════════════════════════════════════
async function _requestPhoto(telegram, game, player) {
  const opp = s(player.id) === s(game.p1.id) ? game.p2 : game.p1;

  _pvStates.set(s(player.id), {
    chatId: s(game.chatId),
    step:   'waiting_photo',
    photo:  null,
    name:   null,
  });

  const msg =
    `🎮 *تحدي خمن — مرحباً ${uname(player)}!*\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `⚔️ منافسك: *${uname(opp)}*\n\n` +
    `📸 *الخطوة الأولى:*\n` +
    `أرسل لي صورة سرية الآن\n` +
    `_(لن يراها منافسك إلا بعد انتهاء اللعبة)_\n\n` +
    `💡 اختر صورة واضحة لها اسم محدد\n` +
    `مثال: صورة برج إيفل، قطة، سيارة...`;

  try {
    await telegram.sendMessage(player.id, msg, { parse_mode: 'Markdown' });
  } catch (e) {
    logger.warn(`[GuessGame] PV fail ${player.id}: ${e.message}`);
    const BOT = process.env.BOT_USERNAME || '';
    await telegram.sendMessage(s(game.chatId),
      `📩 ${mention(player)} — افتح البوت في الخاص وأرسل صورتك!`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[
          { text: '🤖 افتح البوت', url: `https://t.me/${BOT}` }
        ]]}
      }
    ).catch(() => {});
  }
}

// ══════════════════════════════════════════════════════
// PHASE 3 — استلام الصور في الخاص
// ══════════════════════════════════════════════════════
async function handlePvMessage(ctx) {
  if (ctx.chat?.type !== 'private') return false;
  const uid = s(ctx.from.id);
  const pv  = _pvStates.get(uid);
  if (!pv) return false;

  // ── مرحلة 1: انتظار الصورة ──
  if (pv.step === 'waiting_photo') {
    const photo = ctx.message?.photo;
    if (!photo?.length) {
      await ctx.reply(
        `📷 أرسل *صورة* فقط.\n_(اضغط على أيقونة المرفقات واختر صورة)_`,
        { parse_mode: 'Markdown' }
      ).catch(() => {});
      return true;
    }
    if (pv._lock) return true;
    pv._lock = true;
    pv.photo = photo[photo.length - 1].file_id;
    pv.step  = 'waiting_name';
    delete pv._lock;

    await ctx.reply(
      `✅ *تم استلام الصورة!*\n\n` +
      `✏️ *الخطوة الثانية:*\n` +
      `اكتب الاسم الصحيح للصورة\n\n` +
      `💡 مثال: \`برج إيفل\` أو \`قطة برتقالية\`\n` +
      `_(هذا الاسم هو ما يجب أن يخمنه منافسك)_`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
    return true;
  }

  // ── مرحلة 2: انتظار الاسم ──
  if (pv.step === 'waiting_name') {
    if (ctx.message?.photo) {
      await ctx.reply(`✅ الصورة محفوظة!\n✏️ الآن اكتب *الاسم* نصاً فقط.`, { parse_mode: 'Markdown' }).catch(() => {});
      return true;
    }
    const txt = ctx.message?.text?.trim();
    if (!txt || txt.startsWith('/')) {
      await ctx.reply(`✏️ اكتب اسم الصورة نصاً.`).catch(() => {});
      return true;
    }
    if (txt.length < 2) {
      await ctx.reply(`⚠️ الاسم قصير جداً! اكتب اسماً أوضح.`).catch(() => {});
      return true;
    }
    if (pv._lock) return true;
    pv._lock = true;
    pv.name = txt;
    pv.step = 'done';
    delete pv._lock;

    const game = _games.get(pv.chatId);
    if (!game || game.status !== 'collecting') {
      await ctx.reply(`❌ انتهت اللعبة أو انتهى وقتها.`).catch(() => {});
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
      `✅ *جاهز تماماً!*\n\n` +
      `🤫 الاسم المحفوظ: *${esc(txt)}*\n\n` +
      `⏳ في انتظار منافسك...\n` +
      `ستبدأ اللعبة تلقائياً عند جاهزية الجميع`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});

    // إذا الاثنان جاهزان — ابدأ اللعبة
    if (game.p1.ready && game.p2.ready) {
      game._timers.forEach(t => { clearTimeout(t); clearInterval(t); });
      game._timers = [];
      await beginGame(ctx.telegram, game);
    }
    return true;
  }

  return false;
}

// ══════════════════════════════════════════════════════
// PHASE 4 — بداية اللعبة
// ══════════════════════════════════════════════════════
async function beginGame(telegram, game) {
  const chatId   = s(game.chatId);
  game.status    = 'active';
  game.startedAt = Date.now();
  game.p1.attempts = 0;
  game.p2.attempts = 0;

  // أرسل الصور للاعبين (كل لاعب يشوف صورة خصمه)
  for (const player of [game.p1, game.p2]) {
    const opp = s(player.id) === s(game.p1.id) ? game.p2 : game.p1;
    try {
      await telegram.sendPhoto(player.id, opp.photo, {
        caption:
          `🎮 *بدأت اللعبة!*\n\n` +
          `🖼️ هذي صورة منافسك — خمّن اسمها!\n\n` +
          `🎯 اكتب في القروب:\n\`تخمين: الاسم\`\n\n` +
          `❌ لديك *${CFG.MAX_ATTEMPTS} محاولات* فقط!\n` +
          `⏱️ وقتك *5 دقائق*`,
        parse_mode: 'Markdown'
      });
    } catch(e) {
      await telegram.sendMessage(player.id,
        `🚀 *بدأت اللعبة!*\n\nخمّن اسم صورة منافسك في القروب:\n\`تخمين: الاسم\``,
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }
  }

  await cleanGroup(telegram, chatId);

  const m = await telegram.sendMessage(chatId,
    `⚔️ *انطلقت المباراة!*\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `🔴 ${mention(game.p1)} — ❌ 0/${CFG.MAX_ATTEMPTS}\n` +
    `🔵 ${mention(game.p2)} — ❌ 0/${CFG.MAX_ATTEMPTS}\n\n` +
    `💡 كل لاعب استلم صورة خصمه في الخاص\n` +
    `🎯 اكتب: \`تخمين: اسم الصورة\`\n\n` +
    `${buildTimer(CFG.GAME_SECS, CFG.GAME_SECS)}\n` +
    `⏱️ لديكم *5 دقائق* — بالتوفيق! 🍀`,
    { parse_mode: 'Markdown' }
  ).catch(() => null);

  if (m) {
    trackMsg(chatId, m.message_id);
    game.statusMsgId = m.message_id;
  }

  // ── عداد تنازلي يحدث الرسالة كل 30 ثانية ──
  const start = Date.now();
  const cdInterval = setInterval(async () => {
    const g = _games.get(chatId);
    if (!g || g.status !== 'active') { clearInterval(cdInterval); return; }
    const left = Math.max(0, CFG.GAME_SECS - Math.floor((Date.now() - start) / 1000));
    if (!g.statusMsgId) return;
    await telegram.editMessageText(chatId, g.statusMsgId, null,
      `⚔️ *المباراة جارية!*\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `🔴 ${mention(game.p1)} — ❌ ${game.p1.attempts}/${CFG.MAX_ATTEMPTS}\n` +
      `🔵 ${mention(game.p2)} — ❌ ${game.p2.attempts}/${CFG.MAX_ATTEMPTS}\n\n` +
      `🎯 اكتب: \`تخمين: اسم الصورة\`\n\n` +
      `${buildTimer(left, CFG.GAME_SECS)}`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }, 30000);
  game._timers.push(cdInterval);

  // ── تحذير قبل دقيقة ──
  const warnT = setTimeout(async () => {
    const g = _games.get(chatId);
    if (!g || g.status !== 'active') return;
    const w = await telegram.sendMessage(chatId,
      `⏰ *تبقّت دقيقة واحدة!* سارعوا!`,
      { parse_mode: 'Markdown' }
    ).catch(() => null);
    if (w) setTimeout(() => telegram.deleteMessage(chatId, w.message_id).catch(() => {}), 55000);
  }, (CFG.GAME_SECS - CFG.WARN_BEFORE) * 1000);
  game._timers.push(warnT);

  // ── timeout اللعبة ──
  const gameT = setTimeout(() => endGame(telegram, chatId), CFG.GAME_SECS * 1000);
  game._timers.push(gameT);
}

// ══════════════════════════════════════════════════════
// PHASE 5 — التخمين (الدالة الرئيسية المُصلحة)
// ══════════════════════════════════════════════════════
async function handleGuess(ctx) {
  if (ctx.chat?.type === 'private') return false;

  const chatId = s(ctx.chat.id);
  const game   = _games.get(chatId);

  // ── تحقق من حالة اللعبة ──
  if (!game) return false;
  if (game.status !== 'active') return false;

  const text = (ctx.message?.text || '').trim();

  // ── تحقق من صيغة التخمين ──
  const match = text.match(/^تخمين[:\s]+(.+)$/i);
  if (!match) return false;

  const guess   = match[1].trim();
  const guesser = ctx.from;
  const uid     = s(guesser.id);

  // ── تحقق أن المخمن لاعب في المباراة ──
  const isP1 = uid === s(game.p1.id);
  const isP2 = uid === s(game.p2?.id);

  ctx.telegram.deleteMessage(chatId, ctx.message.message_id).catch(() => {});

  if (!isP1 && !isP2) {
    const w = await ctx.telegram.sendMessage(chatId,
      `👀 ${mention(guesser)} لست في هذه المباراة!`,
      { parse_mode: 'Markdown' }
    ).catch(() => null);
    if (w) setTimeout(() => ctx.telegram.deleteMessage(chatId, w.message_id).catch(() => {}), 4000);
    return true;
  }

  // ── المخمن والهدف ──
  const player = isP1 ? game.p1 : game.p2;
  const target = isP1 ? game.p2 : game.p1;

  // ── تحقق من المحاولات ──
  if (player.attempts >= CFG.MAX_ATTEMPTS) {
    const w = await ctx.telegram.sendMessage(chatId,
      `🚫 ${mention(guesser)} استنفذت محاولاتك الـ${CFG.MAX_ATTEMPTS}!`,
      { parse_mode: 'Markdown' }
    ).catch(() => null);
    if (w) setTimeout(() => ctx.telegram.deleteMessage(chatId, w.message_id).catch(() => {}), 5000);
    return true;
  }

  // ── تحقق من الإجابة ──
  if (!target.name) {
    const w = await ctx.telegram.sendMessage(chatId,
      `⚠️ منافسك لم يرسل اسم صورته بعد!`,
      { parse_mode: 'Markdown' }
    ).catch(() => null);
    if (w) setTimeout(() => ctx.telegram.deleteMessage(chatId, w.message_id).catch(() => {}), 4000);
    return true;
  }

  const correct = isSimilar(guess, target.name);
  player.attempts++;

  if (correct) {
    // ── فاز! ──
    await handleWin(ctx.telegram, game, guesser, player, target);
  } else {
    // ── خطأ ──
    const remaining = CFG.MAX_ATTEMPTS - player.attempts;
    let msg = `❌ *${esc(uname(guesser))}* خمّن: _"${esc(guess)}"_ — خطأ!`;

    if (remaining === 0) {
      msg += `\n\n💀 *نفدت محاولاتك!*`;
      // تحقق إذا الاثنان نفدت محاولاتهم
      const otherPlayer = isP1 ? game.p2 : game.p1;
      if (otherPlayer.attempts >= CFG.MAX_ATTEMPTS) {
        await ctx.telegram.sendMessage(chatId, msg, { parse_mode: 'Markdown' }).catch(() => {});
        await endGame(ctx.telegram, chatId);
        return true;
      }
    } else if (remaining === 1) {
      msg += `\n\n⚠️ *آخر محاولة!*`;
    } else {
      msg += `\n_متبقي: ${remaining} محاولات_`;
    }

    const w = await ctx.telegram.sendMessage(chatId, msg, { parse_mode: 'Markdown' }).catch(() => null);
    if (w) setTimeout(() => ctx.telegram.deleteMessage(chatId, w.message_id).catch(() => {}), 7000);

    // تحديث رسالة الحالة
    if (game.statusMsgId) {
      const left = Math.max(0, CFG.GAME_SECS - Math.floor((Date.now() - game.startedAt) / 1000));
      ctx.telegram.editMessageText(chatId, game.statusMsgId, null,
        `⚔️ *المباراة جارية!*\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `🔴 ${mention(game.p1)} — ❌ ${game.p1.attempts}/${CFG.MAX_ATTEMPTS}\n` +
        `🔵 ${mention(game.p2)} — ❌ ${game.p2.attempts}/${CFG.MAX_ATTEMPTS}\n\n` +
        `🎯 اكتب: \`تخمين: اسم الصورة\`\n\n` +
        `${buildTimer(left, CFG.GAME_SECS)}`,
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }
  }

  return true;
}

// ══════════════════════════════════════════════════════
// الفوز
// ══════════════════════════════════════════════════════
async function handleWin(telegram, game, winnerUser, winnerPlayer, loserPlayer) {
  game._timers.forEach(t => { clearTimeout(t); clearInterval(t); });
  game._timers = [];
  game.status = 'ended';
  const chatId = s(game.chatId);
  _games.delete(chatId);

  await cleanGroup(telegram, chatId);

  // رسالة الفوز في القروب
  const r = await telegram.sendMessage(chatId,
    `🏆 *انتهت المباراة!*\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `👑 الفائز: ${mention(winnerUser)}\n` +
    `✅ خمّن الإجابة: *${esc(loserPlayer.name)}*\n\n` +
    `📊 المحاولات:\n` +
    `🔴 ${uname(game.p1)}: ${game.p1.attempts} محاولة\n` +
    `🔵 ${uname(game.p2)}: ${game.p2.attempts} محاولة\n\n` +
    `📸 كشف الصور:`,
    { parse_mode: 'Markdown' }
  ).catch(() => null);

  // كشف الصور
  await telegram.sendPhoto(chatId, game.p1.photo, {
    caption: `🔴 صورة *${esc(uname(game.p1))}*\n✏️ الإجابة: *${esc(game.p1.name)}*`,
    parse_mode: 'Markdown'
  }).catch(() => {});

  await telegram.sendPhoto(chatId, game.p2.photo, {
    caption: `🔵 صورة *${esc(uname(game.p2))}*\n✏️ الإجابة: *${esc(game.p2.name)}*`,
    parse_mode: 'Markdown'
  }).catch(() => {});

  // رسائل خاصة
  for (const p of [game.p1, game.p2]) {
    const isWinner = s(p.id) === s(winnerUser.id);
    const msg = isWinner
      ? `🏆 *فزت!* تمكنت من تخمين صورة منافسك 💪\nالإجابة الصحيحة كانت: *${esc(loserPlayer.name)}*`
      : `😔 *خسرت* هذه الجولة.\nمنافسك خمّن صورتك! حظاً أوفر 🍀\n\nصورتك كانت: *${esc(winnerPlayer.name)}*`;
    await telegram.sendMessage(p.id, msg, { parse_mode: 'Markdown' }).catch(() => {});
  }
}

// ══════════════════════════════════════════════════════
// انتهاء الوقت
// ══════════════════════════════════════════════════════
async function endGame(telegram, chatId) {
  const cid  = s(chatId);
  const game = _games.get(cid);
  if (!game || game.status !== 'active') return;

  game._timers.forEach(t => { clearTimeout(t); clearInterval(t); });
  game._timers = [];
  game.status = 'ended';
  _games.delete(cid);

  await cleanGroup(telegram, chatId);

  await telegram.sendMessage(chatId,
    `⏰ *انتهت المباراة!*\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `🤝 تعادل — لم يتمكن أحد من التخمين!\n\n` +
    `📊 المحاولات:\n` +
    `🔴 ${uname(game.p1)}: ${game.p1.attempts}/${CFG.MAX_ATTEMPTS}\n` +
    `🔵 ${uname(game.p2)}: ${game.p2.attempts}/${CFG.MAX_ATTEMPTS}\n\n` +
    `📸 كشف الصور:`,
    { parse_mode: 'Markdown' }
  ).catch(() => {});

  await telegram.sendPhoto(chatId, game.p1.photo, {
    caption: `🔴 *${esc(uname(game.p1))}*\nكانت: *${esc(game.p1.name)}*`,
    parse_mode: 'Markdown'
  }).catch(() => {});

  await telegram.sendPhoto(chatId, game.p2.photo, {
    caption: `🔵 *${esc(uname(game.p2))}*\nكانت: *${esc(game.p2.name)}*`,
    parse_mode: 'Markdown'
  }).catch(() => {});

  for (const p of [game.p1, game.p2]) {
    await telegram.sendMessage(p.id,
      `⏰ انتهى الوقت! تعادل — لم يفز أحد.\nصورة منافسك كانت: *${esc(s(p.id) === s(game.p1.id) ? game.p2.name : game.p1.name)}*`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }
}

// ══════════════════════════════════════════════════════
// التسجيل
// ══════════════════════════════════════════════════════
function register(bot) {
  // حالة اللعبة
  bot.command('gamestatus', async ctx => {
    if (ctx.chat?.type !== 'private') return;
    const uid = s(ctx.from.id);
    const pv  = _pvStates.get(uid);
    if (!pv) return ctx.reply('لا توجد لعبة نشطة لك حالياً.').catch(() => {});
    const steps = {
      waiting_photo: '📸 في انتظار صورتك — أرسلها الآن',
      waiting_name:  '✏️ في انتظار اسم الصورة — اكتبه الآن',
      done:          '✅ جاهز — في انتظار المنافس'
    };
    ctx.reply(`🎮 *حالة لعبتك:*\n${steps[pv.step] || pv.step}`, { parse_mode: 'Markdown' }).catch(() => {});
  });

  // التخمينات في القروب
  bot.on('text', async (ctx, next) => {
    if (ctx.chat?.type === 'private') return next();
    const handled = await handleGuess(ctx).catch(e => { logger.error('[GuessGame]', e.message); return false; });
    if (handled) return;
    return next();
  });

  logger.info('[GuessGame] ✅ registered');
}

function isGameActive(chatId) {
  const game = _games.get(String(chatId));
  return !!(game && game.status !== 'ended');
}

function hasPvState(uid) {
  return _pvStates.has(String(uid));
}

async function handlePvDirect(ctx) {
  return handlePvMessage(ctx);
}

module.exports = {
  register,
  startInvite,
  handleJoin,
  isGameActive,
  hasPvState,
  handlePvDirect,
  handleGuessMsg: handleGuess,
};
