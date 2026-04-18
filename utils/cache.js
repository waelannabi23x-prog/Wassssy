const store = new Map();
const MAX_CACHE = 8000;

function cacheGet(key) {
  const e = store.get(key);
  if (e.exp && Date.now() > e.exp) { store.delete(key); return null; }
  return e.val;
}

function cacheSet(key, val, ttl = 300000) {
  store.set(key, { val, exp: Date.now() + ttl });
  if (store.size > MAX_CACHE + 500) _evict();
}

function cacheClear(key) { store.delete(key); }

function cacheClearPrefix(prefix) {
  const toDelete = [];
  for (const k of store.keys()) if (k.startsWith(prefix)) toDelete.push(k);
  for (const k of toDelete) store.delete(k);
}

function _evict() {
  if (store.size <= MAX_CACHE) return;
  const toDelete = store.size - MAX_CACHE;
  let i = 0;
  for (const k of store.keys()) { if (i++ >= toDelete) break; store.delete(k); }
}

async function cacheWarmup() {
  try {
    const { getSpecs, getYears, getSemesters, getSubjects, getCategories } = require('../database/content');
    const specs = await getSpecs();
    for (const sp of specs) {
      const years = await getYears(sp.id);
      for (const yr of years) {
        const sems = await getSemesters(yr.id);
        for (const sm of sems) {
          const subs = await getSubjects(sm.id);
          for (const sb of subs) getCategories(sb.id);
        }
      }
    }
    _evict();
  } catch (e) {}
}

function cacheStats() { return { size: store.size }; }
module.exports = { cacheGet, cacheSet, cacheClear, cacheClearPrefix, cacheWarmup, cacheStats };