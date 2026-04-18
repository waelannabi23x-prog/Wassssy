'use strict';
var store = new Map();
var MAX = 8000;

function cacheGet(key) {
  var entry = store.get(key);
  if (!entry) return null;
  if (entry.exp && Date.now() > entry.exp) { store.delete(key); return null; }
  store.delete(key);
  store.set(key, entry);
  return entry.val;
}

function cacheSet(key, val, ttl) {
  ttl = ttl || 300000;
  if (store.has(key)) store.delete(key);
  while (store.size >= MAX) store.delete(store.keys().next().value);
  store.set(key, { val: val, exp: Date.now() + ttl });
}

function cacheClear(key) { store.delete(key); }

function cacheClearPrefix(prefix) {
  var toRemove = [];
  for (var key of store.keys()) {
    if (key.startsWith(prefix)) toRemove.push(key);
  }
  for (var i = 0; i < toRemove.length; i++) store.delete(toRemove[i]);
}

function cacheWarmup() {
  var content = require('../database/content');
  return content.getSpecs().then(function(specs) {
    if (!specs || !specs.length) return;
    var chain = Promise.resolve();
    specs.forEach(function(sp) {
      if (!sp || !sp.id) return;
      chain = chain.then(function() { return content.getYears(sp.id); }).then(function(years) {
        if (!years) return;
        var chain2 = Promise.resolve();
        years.forEach(function(yr) {
          if (!yr || !yr.id) return;
          chain2 = chain2.then(function() { return content.getSemesters(yr.id); }).then(function(sems) {
            if (!sems) return;
            var chain3 = Promise.resolve();
            sems.forEach(function(sm) {
              if (!sm || !sm.id) return;
              chain3 = chain3.then(function() { return content.getSubjects(sm.id); }).then(function(subs) {
                if (!subs) return;
                var chain4 = Promise.resolve();
                subs.forEach(function(sb) {
                  if (sb && sb.id) chain4 = chain4.then(function() { return content.getCategories(sb.id).catch(function(){}); });
                });
                return chain4;
              }).catch(function(){});
            });
            return chain3;
          }).catch(function(){});
        });
        return chain2;
      }).catch(function(){});
    });
    return chain;
  }).catch(function(){});
}

function cacheStats() { return { size: store.size }; }
function getCacheSize() { return store.size; }
function getCacheKeys() { return Array.from(store.keys()); }
module.exports = { cacheGet: cacheGet, cacheSet: cacheSet, cacheClear: cacheClear, cacheClearPrefix: cacheClearPrefix, cacheWarmup: cacheWarmup, cacheStats: cacheStats, getCacheSize: getCacheSize, getCacheKeys: getCacheKeys };
