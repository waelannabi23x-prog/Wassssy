'use strict';
// ══════════════════════════════════════════════════════════════
//  🐺 Loup-Garou — حالة اللعبة في الذاكرة (متعددة القروبات بالتوازي)
// ══════════════════════════════════════════════════════════════

const games        = new Map(); // gameId -> game
const gameByChat   = new Map(); // chatId -> gameId
const playerToGame = new Map(); // userId -> gameId  (لعبة واحدة فقط لكل لاعب)

let _counter = 0;
function genGameId() {
  _counter = (_counter + 1) % 46656; // 36^3
  return _counter.toString(36).padStart(3, '0');
}

function createGame(chatId, chatTitle, creator) {
  const gameId = genGameId();
  const game = {
    gameId,
    chatId,
    chatTitle: chatTitle || '',
    status: 'lobby', // lobby | night | day | discussion | voting | ended
    round: 0,
    creatorId: creator.id,
    players: new Map(),   // userId -> player object
    playerOrder: [],       // ترتيب الانضمام
    lobbyMsg: null,         // {messageId}
    epoch: 0,
    pending: {},            // userId -> {type, picks:[]}  (للمحقق/الثعلب)
    votes: {},              // userId -> targetUserId (تصويت النهار)
    nightActions: {},        // مؤقتة لكل ليلة
    waiters: {},
    loversPair: null,
    mayorId: null,
    lastGuardianTarget: null,
    witch: { saveUsed: false, poisonUsed: false },
    fox: { active: true },
    eventLog: [],
    deadRolesRevealed: new Map(), // userId -> roleId (للعرض في حالة اللعبة)
    gameRowId: null,
    jesterWon: null, // userId إن فاز المهرج
    chatPermissions: null, // صلاحيات القروب الأصلية (لإعادتها)
    canRestrict: false,
    createdAt: Date.now(),
  };
  games.set(gameId, game);
  gameByChat.set(chatId, gameId);
  addPlayer(game, creator);
  return game;
}

function getGameByChat(chatId) {
  const gid = gameByChat.get(chatId);
  return gid ? games.get(gid) : null;
}

function getGameById(gameId) {
  return games.get(gameId) || null;
}

function getGameForUser(userId) {
  const gid = playerToGame.get(userId);
  return gid ? games.get(gid) : null;
}

function isPlayerBusy(userId) {
  return playerToGame.has(userId);
}

function addPlayer(game, user) {
  // TEST MODE: if (game.players.has(user.id)) return false;
  game.players.set(user.id, {
    id: user.id,
    name: (user.first_name || user.name || 'لاعب').slice(0, 40),
    username: user.username || '',
    role: null,
    team: null,
    revealTeam: null,
    alive: true,
    isLover: false,
    isMayor: false,
    hunterUsed: false,
    foxActive: true,
    deathCause: null,
    dmOk: true,
    seerInvestigations: 0,
    seerCorrect: 0,
    witchSaves: 0,
    guardianSaves: 0,
    correctExecutions: 0,
  });
  game.playerOrder.push(user.id);
  playerToGame.set(user.id, game.gameId);
  return true;
}

function removePlayer(game, userId) {
  if (!game.players.has(userId)) return false;
  game.players.delete(userId);
  game.playerOrder = game.playerOrder.filter(id => id !== userId);
  if (playerToGame.get(userId) === game.gameId) playerToGame.delete(userId);
  return true;
}

function destroyGame(game) {
  for (const uid of game.players.keys()) {
    if (playerToGame.get(uid) === game.gameId) playerToGame.delete(uid);
  }
  if (gameByChat.get(game.chatId) === game.gameId) gameByChat.delete(game.chatId);
  // أنهِ أي مؤقتات معلّقة
  for (const w of Object.values(game.waiters)) { try { w.finish(); } catch (_) {} }
  games.delete(game.gameId);
}

function getPlayer(game, userId) {
  return game.players.get(userId) || null;
}

function getAlivePlayers(game) {
  return [...game.players.values()].filter(p => p.alive);
}

function getAliveByRole(game, roleId) {
  return getAlivePlayers(game).filter(p => p.role === roleId);
}

function nextEpoch(game) {
  game.epoch = (game.epoch + 1) % 100000;
  return game.epoch;
}

// ── إضافة لسجل أحداث الجولة (بالذاكرة + قاعدة البيانات) ─────
function pushEvent(game, text) {
  game.eventLog.push({ round: game.round, text });
  const CFG = require('./config');
  if (game.eventLog.length > CFG.MAX_EVENT_LOG) game.eventLog.shift();
  require('./db').logEvent(game.gameRowId, game.round, text);
}

// ── مُنتظِر: ينتظر استجابة مجموعة من اللاعبين أو انتهاء الوقت ──
function createWaiter(game, key, expectedIds, timeoutMs) {
  return new Promise(resolve => {
    let done = false;
    const expected = new Set(expectedIds.filter(Boolean));
    const responded = new Set();
    const timer = setTimeout(finish, timeoutMs);
    function finish() {
      if (done) return;
      done = true;
      clearTimeout(timer);
      delete game.waiters[key];
      resolve();
    }
    if (expected.size === 0) { finish(); return; }
    game.waiters[key] = {
      expected, responded, finish,
      notify(uid) {
        responded.add(uid);
        if ([...expected].every(id => responded.has(id))) finish();
      },
    };
  });
}

function notifyWaiter(game, key, userId) {
  const w = game.waiters[key];
  if (w) w.notify(userId);
}

module.exports = {
  games, gameByChat, playerToGame,
  createGame, getGameByChat, getGameById, getGameForUser, isPlayerBusy,
  addPlayer, removePlayer, destroyGame,
  getPlayer, getAlivePlayers, getAliveByRole,
  nextEpoch, pushEvent,
  createWaiter, notifyWaiter,
};
