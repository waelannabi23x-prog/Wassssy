'use strict';
// ══════════════════════════════════════════════════════════════
//  🎮 أكسيو أو فيريتي — حالة الجلسات بالذاكرة (جلسة واحدة لكل قروب)
// ══════════════════════════════════════════════════════════════

const sessions = new Map(); // chatId -> session

function createSession(chatId, chatTitle, owner, settings) {
  const session = {
    chatId,
    chatTitle: chatTitle || '',
    ownerId: owner.id,
    status: 'registration', // registration | active | ended
    players: new Map(),     // userId -> {id,name,username,askedCount,answeredCount,dareCompleted,truthCompleted,timeouts}
    playerOrder: [],
    regMsgId: null,
    epoch: 0,
    round: 0,
    currentAsker: null,
    currentAnswerer: null,
    lastAsker: null,
    lastAnswerer: null,
    mode: null, // 'truth' | 'dare'
    pendingCapture: null, // {key, userId, resolve}
    waiters: {},
    settings: settings || {},
    ended: false,
    regTimer: null,
    createdAt: Date.now(),
  };
  sessions.set(chatId, session);
  addPlayer(session, owner);
  return session;
}

function getSession(chatId) { return sessions.get(chatId) || null; }

function destroySession(chatId) {
  const s = sessions.get(chatId);
  if (!s) return;
  if (s.regTimer) clearTimeout(s.regTimer);
  for (const w of Object.values(s.waiters)) { try { w.finish(); } catch (_) {} }
  if (s.pendingCapture) { try { s.pendingCapture.resolve(null); } catch (_) {} }
  sessions.delete(chatId);
}

function addPlayer(session, user) {
  if (session.players.has(user.id)) return false;
  session.players.set(user.id, {
    id: user.id,
    name: (user.first_name || user.name || 'لاعب').slice(0, 40),
    username: user.username || '',
    askedCount: 0,
    answeredCount: 0,
    dareCompleted: 0,
    truthCompleted: 0,
    timeouts: 0,
  });
  session.playerOrder.push(user.id);
  return true;
}

function removePlayer(session, userId) {
  if (!session.players.has(userId)) return false;
  session.players.delete(userId);
  session.playerOrder = session.playerOrder.filter(id => id !== userId);
  return true;
}

function getPlayer(session, userId) { return session.players.get(userId) || null; }

function nextEpoch(session) {
  session.epoch = (session.epoch + 1) % 100000;
  return session.epoch;
}

// ── انتظار رسالة نصية محددة من مستخدم محدد (مهلة زمنية) ──
function waitForMessage(session, key, expectedUserId, timeoutMs) {
  return new Promise(resolve => {
    let done = false;
    const timer = setTimeout(finish, timeoutMs);
    function finish(text) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      session.pendingCapture = null;
      resolve(text === undefined ? null : text);
    }
    session.pendingCapture = { key, userId: expectedUserId, resolve: finish };
  });
}

// يُستدعى من middleware الرسائل عند وصول رسالة من لاعب أثناء انتظار
function feedCapture(session, userId, text) {
  if (!session.pendingCapture) return false;
  if (session.pendingCapture.userId !== userId) return false;
  session.pendingCapture.resolve(text);
  return true;
}

// ── انتظار ضغط زر (أكسيو/فيريتي) ──
function createWaiter(session, key, expectedId, timeoutMs) {
  return new Promise(resolve => {
    let done = false;
    const timer = setTimeout(finish, timeoutMs);
    function finish() {
      if (done) return;
      done = true;
      clearTimeout(timer);
      delete session.waiters[key];
      resolve();
    }
    session.waiters[key] = { expectedId, finish, notify(uid) { if (uid === expectedId) finish(); } };
  });
}

function notifyWaiter(session, key, userId) {
  const w = session.waiters[key];
  if (w) w.notify(userId);
}

module.exports = {
  sessions, createSession, getSession, destroySession,
  addPlayer, removePlayer, getPlayer, nextEpoch,
  waitForMessage, feedCapture, createWaiter, notifyWaiter,
};
