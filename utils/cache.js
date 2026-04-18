'use strict';
var store = new Map();
var MAX = 8000;

function cacheGet(key) {
  var entry = store.get(key);
  if (!entry) return null;
  if (entry.exp && Date.now() > entry.exp) { store.delete(key); return null; }
  entry.lastAccess = Date.now();
  return entry.val;
}

function cacheSet(key, val, ttl) {
  ttl = ttl || 300000;
  store.set(key, { val: val, exp: Date.now() + ttl, lastAccess: Date.now() });
  if (store.size > MAX + 500) _evictLRU();
}

function cacheClear(key) { store.delete(key); }

function cacheClearPrefix(prefix) {
  var toRemove = [];
  for (var k of store.keys()) {
    if (k.startsWith(prefix)) toRemove.push(k);
  }
  for (var i = 0; i < toRemove.length; i++) store.delete(toRemove[i]);
}

function _evictLRU() {
  if (store.size <= MAX) return;
  // ترتيب حسب آخر استخدام — أحذف الأقل استخدام
  var entries = Array.from(store.entries()).sort(function(a, b) { return a[1].lastAccess - b[1].lastAccess; });
  var toRemove = entries.length - MAX;
  for (var i = 0; i < toRemove; i++) store.delete(entries[i][0]);
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
                  if (sb && sb.id) try { await content.getCategories(sb.id); } catch(_) {}
                }
              } catch(_) {}
            }
          } catch(_) {}
        }
      } catch(_) {}
    }
    _evictLRU();
  } catch(_) {}
}

function cacheStats() { return { size: store.size }; }
function getCacheSize() { return store.size; }
function getCacheKeys() { return Array.from(store.keys()); }
module.exports = { cacheGet: cacheGet, cacheSet: cacheSet, cacheClear: cacheClear, cacheClearPrefix: cacheClearPrefix, cacheWarmup: cacheWarmup, cacheStats: cacheStats, getCacheSize: getCacheSize, getCacheKeys: getCacheKeys };
