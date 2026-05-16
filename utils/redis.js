'use strict';
const { run, all } = require('../database/db');
const logger = require('./logger');

// ── الذاكرة الداخلية (fallback دائماً) ──
const _mem = {};

// ── Redis client (اختياري) ──
let _redis = null;

if (process.env.REDIS_URL) {
  try {
    const Redis = require('ioredis');
    _redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      connectTimeout: 5000,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    _redis.on('connect', () => logger.info('✅ Redis متصل'));
    _redis.on('error',   e  => { logger.warn('[Redis] ' + e.message); _redis = null; });
  } catch(e) {
    logger.warn('[Redis] ioredis غير متاح — يعمل بالذاكرة');
    _redis = null;
  }
}

// ── loadAllStates: من Redis أولاً، ثم DB ──
async function loadAllStates() {
  if (_redis) {
    try {
      const keys = await _redis.keys('state:*');
      let n = 0;
      if (keys.length) {
        const vals = await _redis.mget(...keys);
        keys.forEach((k, i) => {
          if (!vals[i]) return;
          try {
            const uid = k.replace('state:', '');
            _mem[uid] = JSON.parse(vals[i]);
            n++;
          } catch(_) {}
        });
      }
      logger.info('Loaded ' + n + ' states من Redis');
      return;
    } catch(e) { logger.warn('[Redis] loadAllStates:', e.message); }
  }

  // Fallback → DB
  try {
    const rows = await all("SELECT user_id, state FROM user_states WHERE updated_at > NOW() - INTERVAL '24 hours'");
    let n = 0;
    for (const r of rows) {
      try { _mem[r.user_id] = JSON.parse(r.state); n++; } catch(_) {}
    }
    run("DELETE FROM user_states WHERE updated_at <= NOW() - INTERVAL '24 hours'").catch(()=>{});
    logger.info('Loaded ' + n + ' states من DB');
  } catch(e) { logger.warn('[State] DB unavailable:', e.message); }
}

// ── setState ──
async function setState(uid, val) {
  val._ts = Date.now();
  _mem[uid] = val;
  const json = JSON.stringify(val);

  if (_redis) {
    try {
      await _redis.set('state:' + uid, json, 'EX', 86400); // 24h
      return;
    } catch(e) { logger.warn('[Redis] setState:', e.message); }
  }

  // Fallback → DB
  run(
    'INSERT INTO user_states(user_id,state,updated_at) VALUES($1,$2,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET state=$2,updated_at=CURRENT_TIMESTAMP',
    [uid, json]
  ).catch(()=>{});
}

// ── delState ──
async function delState(uid) {
  delete _mem[uid];

  if (_redis) {
    try { await _redis.del('state:' + uid); return; } catch(e) {}
  }

  run('DELETE FROM user_states WHERE user_id=$1', [uid]).catch(()=>{});
}

// ── getState (sync من الذاكرة دائماً — فوري) ──
function getState(uid) { return _mem[uid] || null; }

module.exports = { loadAllStates, setState, delState, getState, _mem };
