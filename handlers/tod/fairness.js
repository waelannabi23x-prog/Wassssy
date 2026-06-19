'use strict';
// ══════════════════════════════════════════════════════════════
//  ⚖️ نظام العدالة — اختيار السائل والمجيب بدون تكرار مفرط
// ══════════════════════════════════════════════════════════════

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// يختار السائل: أقل عدد مرات سؤال، مع تفادي تكرار آخر سائل إن أمكن
function pickAsker(session, fairnessEnabled) {
  const all = [...session.players.values()];
  if (!all.length) return null;
  if (!fairnessEnabled) return shuffle(all)[0];

  let candidates = all;
  if (session.lastAsker && all.length > 2) {
    const filtered = all.filter(p => p.id !== session.lastAsker);
    if (filtered.length) candidates = filtered;
  }
  const minCount = Math.min(...candidates.map(p => p.askedCount));
  const top = candidates.filter(p => p.askedCount === minCount);
  return shuffle(top)[0];
}

// يختار المجيب: من الباقين (غير السائل)، أقل عدد مرات إجابة، مع تفادي تكرار آخر مجيب
function pickAnswerer(session, askerId, fairnessEnabled) {
  const all = [...session.players.values()].filter(p => p.id !== askerId);
  if (!all.length) return null;
  if (!fairnessEnabled) return shuffle(all)[0];

  let candidates = all;
  if (session.lastAnswerer && all.length > 1) {
    const filtered = all.filter(p => p.id !== session.lastAnswerer);
    if (filtered.length) candidates = filtered;
  }
  const minCount = Math.min(...candidates.map(p => p.answeredCount));
  const top = candidates.filter(p => p.answeredCount === minCount);
  return shuffle(top)[0];
}

module.exports = { pickAsker, pickAnswerer, shuffle };
