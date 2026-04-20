'use strict';
// LRU cache — O(1) get/set/evict via Map insertion-order
const store = new Map();
const MAX = 8000;

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
  ttl = ttl || 300000;
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

async function cacheWarmup() {
  try {
    const content = require('../database/content');
    const specs = await content.getSpecs();
    if (!specs?.length) return;
    await Promise.all(specs.map(async sp => {
      try {
        const years = await content.getYears(sp.id);
        await Promise.all((years || []).map(async yr => {
          try {
            const sems = await content.getSemesters(yr.id);
            await Promise.all((sems || []).map(async sm => {
              try {
                const subs = await content.getSubjects(sm.id);
                await Promise.all((subs || []).map(sb =>
                  content.getCategories(sb.id).catch(() => {})));
              } catch (_) {}
            }));
          } catch (_) {}
        }));
      } catch (_) {}
    }));
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
