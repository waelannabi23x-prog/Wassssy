const memStore = new Map();

function cacheGet(key) {
  const m = memStore.get(key);
  if(!m) return null;
  if(Date.now() > m.expires) { memStore.delete(key); return null; }
  return m.value;
}

function cacheSet(key, value, ttl = 1800000) {
  memStore.set(key, { value, expires: Date.now() + ttl });
}

function cacheClear(prefix) {
  for(const k of memStore.keys()) if(k.startsWith(prefix)) memStore.delete(k);
}

async function cacheWarmup() {
  try {
    const { all } = require('../database/db');
    const rows = await all('SELECT key,value,expires_at FROM cache_store WHERE expires_at > ?', [Date.now()]);
    rows.forEach(r => {
      try { memStore.set(r.key, { value: JSON.parse(r.value), expires: Number(r.expires_at) }); } catch(e) {}
    });
    console.log('✅ Cache warmed up:', rows.length, 'entries');
  } catch(e) {}
}

// تنظيف كل 5 دقائق
setInterval(() => {
  const now = Date.now();
  for(const [k,v] of memStore.entries()) if(now > v.expires) memStore.delete(k);
}, 300000);

module.exports = { cacheGet, cacheSet, cacheClear, cacheWarmup };
