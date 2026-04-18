const store = new Map();
const MAX_CACHE = 8000;

function cacheGet(key) {
  const e = store.get(key);
  if (!e) return null;
  if (e.exp && Date.now() > e.exp) { store.delete(key); return null; }
  return e.val;
}

function cacheSet(key, val, ttl) {
  ttl = ttl || 300000;
  store.set(key, { val: val, exp: Date.now() + ttl });
  if (store.size > MAX_CACHE + 500) _evict();
}

function cacheClear(key) { store.delete(key); }

function cacheClearPrefix(prefix) {
  const toDelete = [];
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) toDelete.push(k);
  }
  for (var i = 0; i < toDelete.length; i++) store.delete(toDelete[i]);
}

function _evict() {
  if (store.size <= MAX_CACHE) return;
  var toDelete = store.size - MAX_CACHE;
  var i = 0;
  for (const k of store.keys()) {
    if (i++ >= toDelete) break;
    store.delete(k);
  }
}

async function cacheWarmup() {
  try {
    var content = require('../database/content');
    var specs = await content.getSpecs();
    if (!specs || !specs.length) return;
    for (var si = 0; si < specs.length; si++) {
      var sp = specs[si];
      if (!sp || !sp.id) continue;
      try {
        var years = await content.getYears(sp.id);
        if (!years) continue;
        for (var yi = 0; yi < years.length; yi++) {
          var yr = years[yi];
          if (!yr || !yr.id) continue;
          try {
            var sems = await content.getSemesters(yr.id);
            if (!sems) continue;
            for (var smi = 0; smi < sems.length; smi++) {
              var sm = sems[smi];
              if (!sm || !sm.id) continue;
              try {
                var subs = await content.getSubjects(sm.id);
                if (!subs) continue;
                for (var sbi = 0; sbi < subs.length; sbi++) {
                  var sb = subs[sbi];
                  if (sb && sb.id) {
                    try { await content.getCategories(sb.id); } catch(_) {}
                  }
                }
              } catch(_) {}
            }
          } catch(_) {}
        }
      } catch(_) {}
    }
    _evict();
  } catch(_) {}
}

function cacheStats() { return { size: store.size }; }
function getCacheSize() { return store.size; }
function getCacheKeys() { return Array.from(store.keys()); }
module.exports = { cacheGet: cacheGet, cacheSet: cacheSet, cacheClear: cacheClear, cacheClearPrefix: cacheClearPrefix, cacheWarmup: cacheWarmup, cacheStats: cacheStats, getCacheSize: getCacheSize, getCacheKeys: getCacheKeys };
