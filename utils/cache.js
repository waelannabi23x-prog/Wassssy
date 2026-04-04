const memStore = new Map();

function cacheGet(key) {
  // أول من الذاكرة
  const m = memStore.get(key);
  if (m) {
    if (Date.now() > m.expires) { memStore.delete(key); }
    else return m.value;
  }
  return null;
}

function cacheSet(key, value, ttl = 1800000) {
  memStore.set(key, { value, expires: Date.now() + ttl });
  // حفظ في DB بشكل async بدون انتظار
  try {
    const { run } = require('./database/db');
    run('INSERT INTO cache_store(key,value,expires_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,expires_at=EXCLUDED.expires_at',
      [key, JSON.stringify(value), Date.now() + ttl]
    ).catch(()=>{});
  } catch(e) {}
}

function cacheClear(prefix) {
  for (const k of memStore.keys()) if (k.startsWith(prefix)) memStore.delete(k);
  try {
    const { run } = require('./database/db');
    run("DELETE FROM cache_store WHERE key LIKE ?", [prefix+'%']).catch(()=>{});
  } catch(e) {}
}

async function cacheWarmup() {
  try {
    const { all } = require('./database/db');
    const rows = await all('SELECT key,value,expires_at FROM cache_store WHERE expires_at > ?', [Date.now()]);
    rows.forEach(r => {
      try { memStore.set(r.key, { value: JSON.parse(r.value), expires: r.expires_at }); } catch(e) {}
    });
    console.log('✅ Cache warmed up:', rows.length, 'entries');
  } catch(e) {}
}

module.exports = { cacheGet, cacheSet, cacheClear, cacheWarmup };
