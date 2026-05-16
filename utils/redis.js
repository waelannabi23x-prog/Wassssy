'use strict';
const { run, all } = require('../database/db');
const logger = require('./logger');

const _mem = {};
let _redis = null;

// ── Upstash Redis (REST) ──
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    const { Redis } = require('@upstash/redis');
    _redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    logger.info('✅ Upstash Redis متصل');
  } catch(e) {
    logger.warn('[Redis] فشل الاتصال — يعمل بالذاكرة:', e.message);
    _redis = null;
  }
}

async function loadAllStates() {
  if (_redis) {
    try {
      const keys = await _redis.keys('state:*');
      if (keys.length) {
        await Promise.all(keys.map(async k => {
          try {
            const val = await _redis.get(k);
            if (val) _mem[k.replace('state:', '')] = typeof val === 'string' ? JSON.parse(val) : val;
          } catch(_) {}
        }));
      }
      logger.info('Loaded ' + Object.keys(_mem).length + ' states من Upstash');
      return;
    } catch(e) { logger.warn('[Redis] loadAllStates:', e.message); }
  }
  // Fallback DB
  try {
    const rows = await all("SELECT user_id, state FROM user_states WHERE updated_at > NOW() - INTERVAL '24 hours'");
    for (const r of rows) {
      try { _mem[r.user_id] = JSON.parse(r.state); } catch(_) {}
    }
    run("DELETE FROM user_states WHERE updated_at <= NOW() - INTERVAL '24 hours'").catch(() => {});
    logger.info('Loaded ' + Object.keys(_mem).length + ' states من DB');
  } catch(e) { logger.warn('[State] DB unavailable:', e.message); }
}

async function setState(uid, val) {
  val._ts = Date.now();
  _mem[uid] = val;
  if (_redis) {
    try {
      await _redis.set('state:' + uid, JSON.stringify(val), { ex: 86400 });
      return;
    } catch(e) { logger.warn('[Redis] setState:', e.message); }
  }
  run(
    'INSERT INTO user_states(user_id,state,updated_at) VALUES($1,$2,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET state=$2,updated_at=CURRENT_TIMESTAMP',
    [uid, JSON.stringify(val)]
  ).catch(() => {});
}

async function delState(uid) {
  delete _mem[uid];
  if (_redis) {
    try { await _redis.del('state:' + uid); return; } catch(e) {}
  }
  run('DELETE FROM user_states WHERE user_id=$1', [uid]).catch(() => {});
}

function getState(uid) { return _mem[uid] || null; }

module.exports = { loadAllStates, setState, delState, getState, _mem };
