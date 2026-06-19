'use strict';
// ══════════════════════════════════════════════════════════════
//  🎮 أكسيو أو فيريتي — ترميز/فكّ الأزرار
//  tod:<verb>:<chatId>:<epoch>:<arg>      — أزرار الجولة (حماية من إعادة التشغيل)
//  todadm:<action>:<chatId>:<arg>         — لوحة تحكم الإدارة (بالخاص، بلا epoch)
// ══════════════════════════════════════════════════════════════

function cb(verb, session, arg) {
  return `tod:${verb}:${session.chatId}:${session.epoch}:${arg === undefined ? '0' : arg}`;
}

function parseCb(data) {
  const parts = String(data || '').split(':');
  if (parts.length < 5 || parts[0] !== 'tod') return null;
  const chatId = parseInt(parts[2], 10);
  const epoch = parseInt(parts[3], 10);
  if (Number.isNaN(chatId) || Number.isNaN(epoch)) return null;
  return { verb: parts[1], chatId, epoch, arg: parts.slice(4).join(':') };
}

function cbAdmin(action, chatId, arg) {
  return `todadm:${action}:${chatId}:${arg === undefined ? '0' : arg}`;
}

function parseCbAdmin(data) {
  const parts = String(data || '').split(':');
  if (parts.length < 4 || parts[0] !== 'todadm') return null;
  const chatId = parseInt(parts[2], 10);
  if (Number.isNaN(chatId)) return null;
  return { action: parts[1], chatId, arg: parts.slice(3).join(':') };
}

module.exports = { cb, parseCb, cbAdmin, parseCbAdmin };
