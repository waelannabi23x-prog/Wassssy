'use strict';
// ══════════════════════════════════════════════════════════════
//  🐺 Loup-Garou — لوحات الأزرار (Inline Keyboards)
// ══════════════════════════════════════════════════════════════

const { cb, cbx } = require('./codec');
const { getAlivePlayers } = require('./state');

// ── اللوبي ──────────────────────────────────────────────────
function lobbyKeyboard(game) {
  return {
    inline_keyboard: [
      [
        { text: '✅ انضمام', callback_data: cb('j', game) },
        { text: '🚪 خروج', callback_data: cb('lv', game) },
      ],
      [
        { text: '🚀 ابدأ اللعبة', callback_data: cb('st', game) },
        { text: '❌ إلغاء', callback_data: cb('cn', game) },
      ],
      [
        { text: '📖 شرح الأدوار والقوانين', callback_data: cbx('rules') },
      ],
    ],
  };
}

// ── قائمة هدف واحد (حماية/فحص/قتل ...) ──────────────────────
// excludeIds: مصفوفة آيدي يُستثنون من القائمة
function targetKeyboard(game, verb, excludeIds = [], opts = {}) {
  const ex = new Set(excludeIds);
  const targets = getAlivePlayers(game).filter(p => !ex.has(p.id));
  const rows = targets.map((p, i) => [{ text: '👤 ' + p.name, callback_data: cb(verb, game, String(i)) }]);
  if (opts.extraText && opts.extraVerb) {
    rows.push([{ text: opts.extraText, callback_data: cb(opts.extraVerb, game, opts.extraArg || 'x') }]);
  }
  return { inline_keyboard: rows };
}

// إرجاع نفس قائمة الأهداف المُستخدمة أعلاه (لفكّ الفهرس عند الاستلام)
function getTargets(game, excludeIds = []) {
  const ex = new Set(excludeIds);
  return getAlivePlayers(game).filter(p => !ex.has(p.id));
}

// ── اختيار متعدد (المحقق = 2، الثعلب = 3) ───────────────────
function multiSelectKeyboard(game, verb, confirmVerb, excludeIds, picks, need) {
  const targets = getTargets(game, excludeIds);
  const rows = targets.map((p, i) => {
    const picked = picks.includes(i);
    return [{ text: (picked ? '✅ ' : '👤 ') + p.name, callback_data: cb(verb, game, String(i)) }];
  });
  if (picks.length === need) {
    rows.push([{ text: '✅ تأكيد الاختيار', callback_data: cb(confirmVerb, game, '0') }]);
  }
  return { inline_keyboard: rows };
}

// ── الساحرة: إنقاذ / تجاهل + قائمة سمّ ───────────────────────
function witchKeyboard(game, witchId, victimId, canSave, canPoison) {
  const rows = [];
  const top = [];
  if (canSave) top.push({ text: '💚 إنقاذ الضحية', callback_data: cb('wt', game, 's') });
  top.push({ text: '❌ تجاهل (لا تتدخلي)', callback_data: cb('wt', game, 'i') });
  rows.push(top);
  if (canPoison) {
    const targets = getTargets(game, [witchId]);
    targets.forEach((p, i) => {
      rows.push([{ text: '☠️ سمّ: ' + p.name, callback_data: cb('wtp', game, String(i)) }]);
    });
  }
  return { inline_keyboard: rows };
}

// ── التصويت النهاري ──────────────────────────────────────────
function dayVoteKeyboard(game, excludeIds = []) {
  const targets = getTargets(game, excludeIds);
  const rows = targets.map((p, i) => [{ text: '🗳️ ' + p.name, callback_data: cb('dv', game, String(i)) }]);
  rows.push([{ text: '🤝 عدم الإعدام', callback_data: cb('dv', game, 'x') }]);
  return { inline_keyboard: rows };
}

// ── القائمة العامة (تعمل دائماً) ─────────────────────────────
function mainMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '📋 حالة اللعبة', callback_data: cbx('status') },
        { text: '📜 السجل', callback_data: cbx('log') },
      ],
      [
        { text: '🏆 إحصائياتي', callback_data: cbx('mystats') },
        { text: '🎖️ إنجازاتي', callback_data: cbx('ach') },
      ],
      [
        { text: '🌍 الموسم', callback_data: cbx('season') },
        { text: '📖 القوانين', callback_data: cbx('rules') },
      ],
    ],
  };
}

module.exports = {
  lobbyKeyboard, targetKeyboard, getTargets, multiSelectKeyboard,
  witchKeyboard, dayVoteKeyboard, mainMenuKeyboard,
};
