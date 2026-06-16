'use strict';
// ══════════════════════════════════════════════════════════════
//  🐺 Loup-Garou — ترميز/فكّ بيانات الأزرار (Callback Data)
//  الصيغة: ww:<verb>:<gameId>:<epoch>:<arg>   |   wwx:<action>:<arg>
//  epoch يتغيّر مع كل مرحلة قرار جديدة -> أزرار الجولات القديمة تُرفض تلقائياً
// ══════════════════════════════════════════════════════════════

function cb(verb, game, arg) {
  return `ww:${verb}:${game.gameId}:${game.epoch}:${arg === undefined ? '0' : arg}`;
}

function cbx(action, arg) {
  return `wwx:${action}:${arg === undefined ? '0' : arg}`;
}

// يُعيد {verb, gameId, epoch, arg} أو null إن لم تطابق الصيغة
function parseCb(data) {
  const parts = String(data || '').split(':');
  if (parts.length < 5 || parts[0] !== 'ww') return null;
  const epoch = parseInt(parts[3], 10);
  if (Number.isNaN(epoch)) return null;
  return { verb: parts[1], gameId: parts[2], epoch, arg: parts.slice(4).join(':') };
}

function parseCbx(data) {
  const parts = String(data || '').split(':');
  if (parts.length < 3 || parts[0] !== 'wwx') return null;
  return { action: parts[1], arg: parts.slice(2).join(':') };
}

module.exports = { cb, cbx, parseCb, parseCbx };
