const store = new Map();

function cacheGet(key) {
  const i = store.get(key);
  if (!i) return null;
  if (Date.now() > i.expires) { store.delete(key); return null; }
  return i.value;
}

function cacheSet(key, value, ttl = 1800000) {
  store.set(key, { value, expires: Date.now() + ttl });
}

function cacheClear(prefix) {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}

module.exports = { cacheGet, cacheSet, cacheClear };
