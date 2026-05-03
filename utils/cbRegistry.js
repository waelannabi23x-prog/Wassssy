'use strict';
// Callback Data Registry — solves Telegram's 64-byte limit
// Stores full context in memory, sends short key in callback_data
// Key format: "r_XXXXXX" (8 chars total)

const store   = new Map(); // key → {data, ts}
const reverse = new Map(); // data → key  (O(1) dedup)
const TTL      = 3600000;  // 1 hour
const MAX_SIZE = 2000;      // max 2000 entries — prevents spam
let _counter = 0;

function _genKey() {
  _counter = (_counter + 1) & 0xFFFFFF; // 16M before wrap
  return 'r_' + _counter.toString(36).padStart(5, '0');
}

// Store long data → returns short key (≤8 chars)
function reg(data) {
  if (data.length <= 64) return data; // no need to register
  // O(1) dedup check
  if (reverse.has(data)) { const k = reverse.get(data); store.get(k).ts = Date.now(); return k; }
  // Evict oldest if at capacity
  if (store.size >= MAX_SIZE) {
    const oldest = [...store.entries()].reduce((a,b) => a[1].ts < b[1].ts ? a : b);
    store.delete(oldest[0]); reverse.delete(oldest[1].data);
  }
  let key;
  key = _genKey();
  store.set(key, { data, ts: Date.now() }); reverse.set(data, key);
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
  for (const [k, v] of store) if (v.ts < cut) { reverse.delete(v.data); store.delete(k); }
}

// Stats
function size() { return store.size; }

module.exports = { reg, res, purge, size };
