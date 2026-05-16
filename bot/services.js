'use strict';
const { run: dbRun } = require('../database/db');
const logger = require('../utils/logger');

const CFG = {
  cbDedupMax: 2000, cbDedupTTL: 8000,
  grpFlushMs: 15000, grpBufMax: 2000,
  botMsgsPerChat: 100, maxChatsTracked: 150,
};

// ── منع التكرار في الـ Callbacks ──
const CBDedup = {
  _s: new Map(),
  isDupe(id) {
    if (this._s.has(id)) return true;
    this._s.set(id, Date.now());
    if (this._s.size > CFG.cbDedupMax) {
      const c = Date.now() - CFG.cbDedupTTL;
      for (const [k, v] of this._s) if (v < c) this._s.delete(k);
    }
    return false;
  },
};

// ── منع تنفيذ نفس الطلب مرتين ──
const InFlight = {
  _m: new Map(),
  go(u, k, fn) {
    const key = u + '_' + k;
    if (this._m.has(key)) return this._m.get(key);
    const p = fn().finally(() => this._m.delete(key));
    this._m.set(key, p);
    return p;
  },
};

// ── Batch تحديث أعضاء المجموعات ──
const GrpBuf = {
  _b: new Map(), _t: null,
  add(cid, uid, un, fn) {
    this._b.set(cid + '_' + uid, { chatId: cid, userId: uid, username: un || '', firstName: fn || '' });
    if (this._b.size >= CFG.grpBufMax) this.flush();
  },
  async flush() {
    if (!this._b.size) return;
    const e = [...this._b.values()]; this._b.clear();
    if (!e.length) return;
    const ph = e.map((_, i) => `($${i*4+1},$${i*4+2},$${i*4+3},$${i*4+4},CURRENT_TIMESTAMP)`).join(',');
    try {
      await dbRun(
        `INSERT INTO group_members(chat_id,user_id,username,first_name,updated_at) VALUES ${ph}
         ON CONFLICT(chat_id,user_id) DO UPDATE SET username=EXCLUDED.username,first_name=EXCLUDED.first_name,updated_at=CURRENT_TIMESTAMP`,
        e.flatMap(x => [x.chatId, x.userId, x.username, x.firstName])
      );
    } catch(err) { logger.error('GrpBuf:', err.message); }
  },
  start() { this._t = setInterval(() => this.flush(), CFG.grpFlushMs); this._t.unref(); },
  stop()  { if (this._t) clearInterval(this._t); return this.flush(); },
};

// ── تتبع رسائل البوت في المجموعات ──
const GrpMsgs = {
  _m: Object.create(null),
  add(c, m) {
    if (!this._m[c]) this._m[c] = [];
    this._m[c].push(m);
    if (this._m[c].length > CFG.botMsgsPerChat) this._m[c] = this._m[c].slice(-CFG.botMsgsPerChat);
  },
  all(c)   { return [...new Set(this._m[c] || [])]; },
  clear(c) { this._m[c] = []; },
  prune()  {
    const k = Object.keys(this._m);
    if (k.length > CFG.maxChatsTracked)
      k.slice(0, k.length - CFG.maxChatsTracked).forEach(x => delete this._m[x]);
  },
};

global.dedupRequest = (u, k, fn) => InFlight.go(u, k, fn);

module.exports = { CBDedup, InFlight, GrpBuf, GrpMsgs };
