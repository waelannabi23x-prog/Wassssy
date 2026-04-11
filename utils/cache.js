const store = new Map();
const timers = new Map();

function cacheGet(key) {
  const e = store.get(key);
  if(!e) return null;
  if(e.exp && Date.now() > e.exp) { store.delete(key); timers.delete(key); return null; }
  return e.val;
}

function cacheSet(key, val, ttl=300000) {
  if(timers.has(key)) clearTimeout(timers.get(key));
  store.set(key, { val, exp: Date.now()+ttl });
  const t = setTimeout(() => { store.delete(key); timers.delete(key); }, ttl);
  if(t.unref) t.unref();
  timers.set(key, t);
}

function cacheClear(key) {
  if(timers.has(key)) clearTimeout(timers.get(key));
  store.delete(key); timers.delete(key);
}

function cacheClearPrefix(prefix) {
  for(const k of store.keys()) if(k.startsWith(prefix)) cacheClear(k);
}

// LRU — لو الكاش وصل 2000 entry احذف الاقدم
const MAX_CACHE = 2000;
function _evict() {
  if(store.size <= MAX_CACHE) return;
  const toDelete = store.size - MAX_CACHE;
  let i = 0;
  for(const k of store.keys()) {
    if(i++ >= toDelete) break;
    cacheClear(k);
  }
}
const _origSet = cacheSet;

async function cacheWarmup() {
  try {
    const { getSpecs, getYears, getSemesters, getSubjects, getCategories } = require('../database/content');
    const specs = await getSpecs();
    cacheSet('specs', specs, 3600000);

    for(const sp of specs) {
      const years = await getYears(sp.id);
      cacheSet('yrs_'+sp.id, {sp, all:years}, 3600000);
      for(const yr of years) {
        const sems = await getSemesters(yr.id);
        cacheSet('sems_'+sp.id+'_'+yr.id, {sp, yr, sems}, 3600000);
        for(const sm of sems) {
          const subs = await getSubjects(sm.id);
          cacheSet('subs_'+sp.id+'_'+yr.id+'_'+sm.id, {sp,yr,sm,all:subs}, 3600000);
          for(const sb of subs) {
            const cats = await getCategories(sb.id);
            cacheSet('cats_'+sp.id+'_'+yr.id+'_'+sm.id+'_'+sb.id, {sp,yr,sm,sb,cats}, 3600000);
          }
        }
      }
    }

    _evict();
    console.log('✅ Cache warmed up:', store.size, 'entries');
  } catch(e) { console.error('Warmup error:', e.message); }
}

function cacheStats() {
  return { size: store.size, keys: [...store.keys()].slice(0,20) };
}

function getCacheSize() { return store.size; }
function getCacheKeys() { return [...store.keys()]; }

module.exports = { cacheGet, cacheSet, cacheClear, cacheClearPrefix, cacheWarmup, cacheStats, getCacheSize, getCacheKeys };
