'use strict';
// بديل آمن عن global._uCache و global._admCache و global._cachedBotId

let _botId   = null;
const _bans  = new Map(); // uid → {banned, exp}
const _admins= new Map(); // uid → {perms, exp}

function getBotId()          { return _botId; }
function setBotId(id)        { _botId = id; }

function getBanStatus(uid) {
  const c = _bans.get(uid);
  if (!c || Date.now() > c.exp) return undefined;
  return c.banned;
}
function setBanStatus(uid, banned, ttlMs = 3600000) {
  _bans.set(uid, { banned, exp: Date.now() + ttlMs });
  if (_bans.size > 20000) {
    const now = Date.now();
    for (const [k, v] of _bans) if (v.exp < now) _bans.delete(k);
  }
}

function getAdminPerms(uid) {
  const c = _admins.get(uid);
  if (!c || Date.now() > c.exp) return undefined;
  return c.perms;
}
function setAdminPerms(uid, perms, ttlMs = 7200000) {
  _admins.set(uid, { perms, exp: Date.now() + ttlMs });
}
function clearAdminPerms(uid) { _admins.delete(uid); }

module.exports = { getBotId, setBotId, getBanStatus, setBanStatus, getAdminPerms, setAdminPerms, clearAdminPerms };
