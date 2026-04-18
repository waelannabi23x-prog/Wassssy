const store = new Map();
const timers = new Map();
const MAX_CACHE = 5000;

function cacheGet(key) {
  const e = store.get(key);
  if (!e) return null;
  if (e.exp && Date.now() > e.exp) { store.delete(key); timers.delete(key); return null; }
  return e.val;
}

function cacheSet(key, val, ttl = 300000) {
  if (timers.has(key)) clearTimeout(timers.get(key));
  store.set(key, { val, exp: Date.now() + ttl });
  const t = setTimeout(() => { store.delete(key); timers.delete(key); }, ttl);
  if (t.unref) t.unref();
  timers.set(key, t);
  _evict();
}

function cacheClear(key) {
  if (timers.has(key)) clearTimeout(timers.get(key));
  store.delete(key); timers.delete(key);
}

function cacheClearPrefix(prefix) {
  const toDelete = [];
  for (const k of store.keys()) if (k.startsWith(prefix)) toDelete.push(k);
  for (const k of toDelete) cacheClear(k);
}

function _evict() {
  if (store.size <= MAX_CACHE) return;
  const toDelete = store.size - MAX_CACHE;
  let i = 0;
  for (const k of store.keys()) { if (i++ >= toDelete) break; cacheClear(k); }
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
          for (const sb of subs) await getCategories(sb.id);
        }
      }
    }
    _evict();
    console.log('✅ Cache warmed up:', store.size, 'entries');
  } catch (e) { console.error('Warmup error:', e.message); }
}

function cacheStats() { return { size: store.size }; }
function getCacheSize() { return store.size; }
function getCacheKeys() { return [...store.keys()]; }

module.exports = { cacheGet, cacheSet, cacheClear, cacheClearPrefix, cacheWarmup, cacheStats, getCacheSize, getCacheKeys };
