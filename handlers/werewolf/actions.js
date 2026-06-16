'use strict';
// ══════════════════════════════════════════════════════════════
//  🐺 Loup-Garou — معالجات أزرار الإجراءات (الليل + التصويت)
//  التحقق من صلاحية الزر (gameId + epoch) يتم في index.js قبل
//  الوصول هنا — فهذه المعالجات تفترض أن المرحلة الحالية صحيحة.
// ══════════════════════════════════════════════════════════════

const { ROLES } = require('./roles');
const texts = require('./texts');
const { getAlivePlayers, notifyWaiter } = require('./state');
const { getTargets, multiSelectKeyboard } = require('./keyboards');

const CLEAR_KB = { inline_keyboard: [] };

async function handle(ctx, game, parsed) {
  const userId = ctx.from.id;
  const player = game.players.get(userId);
  if (!player) return ctx.answerCbQuery('❌ لست لاعباً في هذه اللعبة.', { show_alert: true });
  if (!player.alive && parsed.verb !== 'hv') {
    return ctx.answerCbQuery('💀 أنت ميت — يمكنك المشاهدة فقط.', { show_alert: true });
  }

  switch (parsed.verb) {
    case 'gp':  return guardianProtect(ctx, game, player, parsed.arg);
    case 'sv':  return seerView(ctx, game, player, parsed.arg);
    case 'dtp': return detectivePick(ctx, game, player, parsed.arg);
    case 'dtc': return detectiveConfirm(ctx, game, player);
    case 'fxp': return foxPick(ctx, game, player, parsed.arg);
    case 'fxc': return foxConfirm(ctx, game, player);
    case 'wk':  return wolfKill(ctx, game, player, parsed.arg);
    case 'wt':  return witchAction(ctx, game, player, parsed.arg);
    case 'wtp': return witchPoison(ctx, game, player, parsed.arg);
    case 'skv': return soloKill(ctx, game, player, parsed.arg, 'serial_killer', 'sk', 'skTarget');
    case 'vpv': return soloKill(ctx, game, player, parsed.arg, 'vampire', 'vampire', 'vampireTarget');
    case 'hv':  return hunterRevenge(ctx, game, player, parsed.arg);
    case 'dv':  return dayVote(ctx, game, player, parsed.arg);
    default:    return ctx.answerCbQuery();
  }
}

// ── الحارس ──────────────────────────────────────────────────
async function guardianProtect(ctx, game, player, arg) {
  if (player.role !== 'guardian') return ctx.answerCbQuery();
  const exclude = [player.id];
  if (game.lastGuardianTarget) exclude.push(game.lastGuardianTarget);
  const target = getTargets(game, exclude)[parseInt(arg, 10)];
  if (!target) return ctx.answerCbQuery('❌ خيار غير صالح.', { show_alert: true });
  game.nightActions.guardianTarget = target.id;
  notifyWaiter(game, 'guardian', player.id);
  await ctx.answerCbQuery('🛡️ سوف تحمي: ' + target.name);
  await ctx.editMessageReplyMarkup(CLEAR_KB).catch(() => {});
}

// ── العراف ──────────────────────────────────────────────────
async function seerView(ctx, game, player, arg) {
  if (player.role !== 'seer') return ctx.answerCbQuery();
  const target = getTargets(game, [player.id])[parseInt(arg, 10)];
  if (!target) return ctx.answerCbQuery('❌ خيار غير صالح.', { show_alert: true });
  const isWolf = ROLES[target.role].revealTeam === 'wolves';
  player.seerInvestigations = (player.seerInvestigations || 0) + 1;
  if (isWolf) player.seerCorrect = (player.seerCorrect || 0) + 1;
  notifyWaiter(game, 'seer', player.id);
  await ctx.answerCbQuery();
  await ctx.editMessageText(texts.seerResultText(target, isWolf), { parse_mode: 'Markdown', reply_markup: CLEAR_KB }).catch(() => {});
}

// ── المحقق ──────────────────────────────────────────────────
async function detectivePick(ctx, game, player, arg) {
  if (player.role !== 'detective') return ctx.answerCbQuery();
  const idx = parseInt(arg, 10);
  const pend = game.pending[player.id] || (game.pending[player.id] = { type: 'detective', picks: [] });
  const i = pend.picks.indexOf(idx);
  if (i >= 0) pend.picks.splice(i, 1);
  else if (pend.picks.length < 2) pend.picks.push(idx);
  else { pend.picks.shift(); pend.picks.push(idx); }
  await ctx.answerCbQuery();
  const kb = multiSelectKeyboard(game, 'dtp', 'dtc', [player.id], pend.picks, 2);
  await ctx.editMessageReplyMarkup(kb).catch(() => {});
}

async function detectiveConfirm(ctx, game, player) {
  if (player.role !== 'detective') return ctx.answerCbQuery();
  const pend = game.pending[player.id];
  if (!pend || pend.picks.length !== 2) return ctx.answerCbQuery('اختر لاعبين أولاً.', { show_alert: true });
  const targets = getTargets(game, [player.id]);
  const t1 = targets[pend.picks[0]], t2 = targets[pend.picks[1]];
  if (!t1 || !t2) return ctx.answerCbQuery('❌ خيار غير صالح.', { show_alert: true });
  const same = ROLES[t1.role].revealTeam === ROLES[t2.role].revealTeam;
  delete game.pending[player.id];
  notifyWaiter(game, 'detective', player.id);
  await ctx.answerCbQuery();
  await ctx.editMessageText(texts.detectiveResultText(t1, t2, same), { parse_mode: 'Markdown', reply_markup: CLEAR_KB }).catch(() => {});
}

// ── الثعلب ──────────────────────────────────────────────────
async function foxPick(ctx, game, player, arg) {
  if (player.role !== 'fox') return ctx.answerCbQuery();
  const idx = parseInt(arg, 10);
  const pend = game.pending[player.id] || (game.pending[player.id] = { type: 'fox', picks: [] });
  const i = pend.picks.indexOf(idx);
  if (i >= 0) pend.picks.splice(i, 1);
  else if (pend.picks.length < 3) pend.picks.push(idx);
  else { pend.picks.shift(); pend.picks.push(idx); }
  await ctx.answerCbQuery();
  const kb = multiSelectKeyboard(game, 'fxp', 'fxc', [player.id], pend.picks, 3);
  await ctx.editMessageReplyMarkup(kb).catch(() => {});
}

async function foxConfirm(ctx, game, player) {
  if (player.role !== 'fox') return ctx.answerCbQuery();
  const pend = game.pending[player.id];
  if (!pend || pend.picks.length !== 3) return ctx.answerCbQuery('اختر 3 لاعبين أولاً.', { show_alert: true });
  const targets = getTargets(game, [player.id]);
  const chosen = pend.picks.map(i => targets[i]).filter(Boolean);
  if (chosen.length !== 3) return ctx.answerCbQuery('❌ خيار غير صالح.', { show_alert: true });
  const found = chosen.some(t => ROLES[t.role].isWolfPack);
  let lost = false;
  if (!found) { player.foxActive = false; lost = true; }
  delete game.pending[player.id];
  notifyWaiter(game, 'fox', player.id);
  await ctx.answerCbQuery();
  await ctx.editMessageText(texts.foxResultText(chosen, found, lost), { parse_mode: 'Markdown', reply_markup: CLEAR_KB }).catch(() => {});
}

// ── الذئاب ──────────────────────────────────────────────────
async function wolfKill(ctx, game, player, arg) {
  if (player.role !== 'wolf') return ctx.answerCbQuery();
  const wolfPackIds = getAlivePlayers(game).filter(p => ROLES[p.role].isWolfPack).map(p => p.id);
  const target = getTargets(game, wolfPackIds)[parseInt(arg, 10)];
  if (!target) return ctx.answerCbQuery('❌ خيار غير صالح.', { show_alert: true });
  game.nightActions.wolfVotes = game.nightActions.wolfVotes || {};
  game.nightActions.wolfVotes[player.id] = target.id;
  notifyWaiter(game, 'wolves', player.id);
  await ctx.answerCbQuery('🐺 صوّتَ بقتل: ' + target.name);
}

// ── الساحرة ─────────────────────────────────────────────────
async function witchAction(ctx, game, player, arg) {
  if (player.role !== 'witch') return ctx.answerCbQuery();
  if (arg === 's') {
    if (game.witch.saveUsed) return ctx.answerCbQuery('🚫 استخدمتِ جرعة الإنقاذ من قبل.', { show_alert: true });
    game.nightActions.witchSave = true;
  } else if (arg === 'i') {
    game.nightActions.witchIgnore = true;
  } else {
    return ctx.answerCbQuery();
  }
  notifyWaiter(game, 'witch', player.id);
  await ctx.answerCbQuery();
  await ctx.editMessageReplyMarkup(CLEAR_KB).catch(() => {});
}

async function witchPoison(ctx, game, player, arg) {
  if (player.role !== 'witch') return ctx.answerCbQuery();
  if (game.witch.poisonUsed) return ctx.answerCbQuery('🚫 استخدمتِ جرعة السمّ من قبل.', { show_alert: true });
  const target = getTargets(game, [player.id])[parseInt(arg, 10)];
  if (!target) return ctx.answerCbQuery('❌ خيار غير صالح.', { show_alert: true });
  game.nightActions.witchPoisonTarget = target.id;
  notifyWaiter(game, 'witch', player.id);
  await ctx.answerCbQuery('☠️ سوف تُسمّمين: ' + target.name);
  await ctx.editMessageReplyMarkup(CLEAR_KB).catch(() => {});
}

// ── القاتل المتسلسل / مصاص الدماء ─────────────────────────────
async function soloKill(ctx, game, player, arg, roleId, waiterKey, actionField) {
  if (player.role !== roleId) return ctx.answerCbQuery();
  const target = getTargets(game, [player.id])[parseInt(arg, 10)];
  if (!target) return ctx.answerCbQuery('❌ خيار غير صالح.', { show_alert: true });
  game.nightActions[actionField] = target.id;
  notifyWaiter(game, waiterKey, player.id);
  await ctx.answerCbQuery('🎯 ضحيتك الليلة: ' + target.name);
  await ctx.editMessageReplyMarkup(CLEAR_KB).catch(() => {});
}

// ── الصياد (الرصاصة الأخيرة) ───────────────────────────────────
async function hunterRevenge(ctx, game, player, arg) {
  if (player.role !== 'hunter') return ctx.answerCbQuery();
  if (arg === 'x') {
    game.nightActions.hunterTarget = null;
  } else {
    const target = getTargets(game, [player.id])[parseInt(arg, 10)];
    if (!target) return ctx.answerCbQuery('❌ خيار غير صالح.', { show_alert: true });
    game.nightActions.hunterTarget = target.id;
  }
  notifyWaiter(game, 'hunter', player.id);
  await ctx.answerCbQuery();
  await ctx.editMessageReplyMarkup(CLEAR_KB).catch(() => {});
}

// ── التصويت النهاري ───────────────────────────────────────────
async function dayVote(ctx, game, player, arg) {
  if (game.status !== 'voting') return ctx.answerCbQuery('⏰ انتهى وقت التصويت.', { show_alert: true });
  let targetKey;
  if (arg === 'x') {
    targetKey = 'x';
  } else {
    const target = getAlivePlayers(game)[parseInt(arg, 10)];
    if (!target) return ctx.answerCbQuery('❌ خيار غير صالح.', { show_alert: true });
    targetKey = String(target.id);
  }
  const isNew = !Object.prototype.hasOwnProperty.call(game.votes, player.id);
  game.votes[player.id] = targetKey;
  notifyWaiter(game, 'dayVote', player.id);
  await ctx.answerCbQuery(isNew ? '✅ تم تسجيل صوتك' : '🔄 تم تحديث صوتك');
  const votedCount = Object.keys(game.votes).length;
  const markup = ctx.callbackQuery?.message?.reply_markup;
  await ctx.editMessageText(texts.voteStartText(game, votedCount), { parse_mode: 'Markdown', reply_markup: markup }).catch(() => {});
}

module.exports = { handle };
