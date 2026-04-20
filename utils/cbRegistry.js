'use strict';
// Callback Data Registry — solves Telegram's 64-byte limit
// Stores full context in memory, sends short key in callback_data
// Key format: "r_XXXXXX" (8 chars total)

const store = new Map(); // key → {data, ts}
const TTL   = 3600000;  // 1 hour
const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

function _genKey() {
  let k = '';
  for (let i = 0; i < 6; i++) k += CHARS[Math.floor(Math.random() * CHARS.length)];
  return 'r_' + k;
}

// Store long data → returns short key (≤8 chars)
function reg(data) {
  if (data.length <= 64) return data; // no need to register
  // Check if already stored
  for (const [k, v] of store) if (v.data === data) { v.ts = Date.now(); return k; }
  let key;
  do { key = _genKey(); } while (store.has(key));
  store.set(key, { data, ts: Date.now() });
  return key;
}

// Resolve key → original data
function res(key) {
  if (!key.startsWith('r_')) return key;
  const e = store.get(key);
  if (!e) return key;
  e.ts = Date.now();
  return e.data;
}

// Cleanup old entries (called by periodic cleaner)
function purge() {
  const cut = Date.now() - TTL;
  for (const [k, v] of store) if (v.ts < cut) store.delete(k);
}

// Stats
function size() { return store.size; }

module.exports = { reg, res, purge, size };
