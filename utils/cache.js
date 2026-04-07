const memStore = new Map();
let dirtyKeys = new Set();
let flushTimer = null;

function cacheGet(key) {
  const m = memStore.get(key);
  if(!m) return null;
  if(Date.now() > m.expires) { memStore.delete(key); return null; }
  return m.value;
}

function cacheSet(key, value, ttl = 1800000) {
  memStore.set(key, { value, expires: Date.now() + ttl });
  // بس البيانات الكبيرة تتحفظ في DB
  if(ttl > 300000) {
    dirtyKeys.add(key);
    scheduleFlush();
  }
}

function scheduleFlush() {
  if(flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    if(!dirtyKeys.size) return;
    const keys = [...dirtyKeys];
    dirtyKeys.clear();
    try {
      const { run } = require('./database/db');
      for(const key of keys) {
        const m = memStore.get(key);
        if(m) await run('INSERT INTO cache_store(key,value,expires_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,expires_at=EXCLUDED.expires_at',
          [key, JSON.stringify(m.value), m.expires]).catch(()=>{});
      }
    } catch(e) {}
  }, 5000); // flush كل 5 ثواني بدل فوراً
}

function cacheClear(prefix) {
  for(const k of memStore.keys()) if(k.startsWith(prefix)) memStore.delete(k);
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
      try { memStore.set(r.key, { value: JSON.parse(r.value), expires: Number(r.expires_at) }); } catch(e) {}
    });
    console.log('✅ Cache warmed up:', rows.length, 'entries');
  } catch(e) {}
}

// تنظيف الـ cache المنتهي كل 10 دقائق
setInterval(() => {
  const now = Date.now();
  for(const [k,v] of memStore.entries()) if(now > v.expires) memStore.delete(k);
}, 600000);

module.exports = { cacheGet, cacheSet, cacheClear, cacheWarmup };
