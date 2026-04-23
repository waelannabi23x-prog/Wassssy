'use strict';
// LRU cache — O(1) get/set/evict via Map insertion-order
const store = new Map();
const MAX = 40000;
const TTL = {
  SEARCH: 300000, FILE: 600000, CONTENT: 21600000,
  RATING: 3600000, USER: 300000, AI: 1800000, STATIC: 86400000,
};

function cacheGet(key) {
  const e = store.get(key);
  if (!e) return null;
  if (e.exp && Date.now() > e.exp) { store.delete(key); return null; }
  // Move to tail = most-recently-used
  store.delete(key);
  store.set(key, e);
  return e.val;
}

function cacheSet(key, val, ttl) {
  ttl = ttl || TTL.FILE;
  store.delete(key); // re-insert to tail
  store.set(key, { val, exp: Date.now() + ttl });
  if (store.size > MAX) _evictLRU();
}

function cacheClear(key) { store.delete(key); }

function cacheClearPrefix(prefix) {
  for (const k of store.keys())
    if (k.startsWith(prefix)) store.delete(k);
}

function _evictLRU() {
  // First entry = LRU (insertion-order), O(1) per delete
  const iter = store.keys();
  while (store.size > MAX) store.delete(iter.next().value);
}

// Throttled warmup — max CONC concurrent DB queries to avoid startup pressure
async function cacheWarmup() {
  const CONC = 5;
  try {
    const content = require('../database/content');
    const specs = await content.getSpecs();
    if (!specs?.length) return;

    // Collect all tasks first, then run with concurrency limit
    const tasks = [];
    for (const sp of specs) {
      tasks.push(async () => { try { await content.getYears(sp.id); } catch(_){} });
      try {
        const years = await content.getYears(sp.id);
        for (const yr of (years||[])) {
          tasks.push(async () => { try { await content.getSemesters(yr.id); } catch(_){} });
          try {
            const sems = await content.getSemesters(yr.id);
            for (const sm of (sems||[])) {
              tasks.push(async () => { try { await content.getSubjects(sm.id); } catch(_){} });
              try {
                const subs = await content.getSubjects(sm.id);
                for (const sb of (subs||[]))
                  tasks.push(async () => { try { await content.getCategories(sb.id); } catch(_){} });
              } catch(_){}
            }
          } catch(_){}
        }
      } catch(_){}
    }

    // Run with concurrency limit
    let i = 0;
    async function worker() {
      while (i < tasks.length) { const t = tasks[i++]; await t(); }
    }
    await Promise.all(Array.from({length: Math.min(CONC, tasks.length)}, worker));
    _evictLRU();
  } catch (_) {}
}

// Purge expired entries (called periodically by index.js)
function cachePurgeExpired() {
  const now = Date.now();
  for (const [k, e] of store) if (e.exp && now > e.exp) store.delete(k);
}

function cacheStats()   { return { size: store.size, max: MAX }; }
function getCacheSize() { return store.size; }
function getCacheKeys() { return Array.from(store.keys()); }

module.exports = {
  cacheGet, cacheSet, cacheClear, cacheClearPrefix,
  cacheWarmup, cacheStats, getCacheSize, getCacheKeys, cachePurgeExpired,
};
