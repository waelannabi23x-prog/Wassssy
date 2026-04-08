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

async function cacheWarmup() {
  try {
    const { all } = require('../database/db');
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
    console.log('✅ Cache warmed up:', store.size, 'entries');
  } catch(e) { console.error('Warmup error:', e.message); }
}

function cacheStats() {
  return { size: store.size, keys: [...store.keys()].slice(0,20) };
}

module.exports = { cacheGet, cacheSet, cacheClear, cacheClearPrefix, cacheWarmup, cacheStats };
