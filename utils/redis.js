'use strict';
const { run, all } = require('../database/db');
const logger = require('./logger');

const _mem = {};
let _redis = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    const { Redis } = require('@upstash/redis');
    _redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    logger.info('✅ Upstash Redis متصل');
  } catch(e) {
    logger.warn('[Redis] فشل الاتصال:', e.message);
    _redis = null;
  }
}

// ── Startup: من DB دائماً (KEYS محظور في Upstash Free) ──
async function loadAllStates() {
  try {
    const rows = await all("SELECT user_id, state FROM user_states WHERE updated_at > NOW() - INTERVAL '24 hours'");
    let n = 0;
    for (const r of rows) {
      try { _mem[r.user_id] = JSON.parse(r.state); n++; } catch(_) {}
    }
    run("DELETE FROM user_states WHERE updated_at <= NOW() - INTERVAL '24 hours'").catch(() => {});
    logger.info('Loaded ' + n + ' states من DB');
  } catch(e) { logger.warn('[State] DB unavailable:', e.message); }
}

// ── setState: Redis أولاً + DB backup ──
async function setState(uid, val) {
  val._ts = Date.now();
  _mem[uid] = val;
  const json = JSON.stringify(val);

  if (_redis) {
    try {
      await _redis.set('state:' + uid, json, { ex: 86400 });
    } catch(e) {
      if (e.message && e.message.includes('NOPERM')) {
        logger.warn('[Redis] NOPERM — تعطيل Redis والاعتماد على الذاكرة');
        _redis = null; // disable for this session, no more spam
      }
      // silent fail for other errors
    }
  }

  // DB دائماً كـ backup
  run(
    'INSERT INTO user_states(user_id,state,updated_at) VALUES($1,$2,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET state=$2,updated_at=CURRENT_TIMESTAMP',
    [uid, json]
  ).catch(() => {});
}

// ── delState ──
async function delState(uid) {
  delete _mem[uid];

  if (_redis) {
    try { await _redis.del('state:' + uid); } catch(_) {}
  }

  run('DELETE FROM user_states WHERE user_id=$1', [uid]).catch(() => {});
}

// ── getState: من الذاكرة دائماً (فوري) ──
async function getStateAsync(uid) {
  if (_mem[uid]) return _mem[uid];
  if (_redis) {
    try {
      const val = await _redis.get('state:' + uid);
      if (val) {
        const parsed = typeof val === 'string' ? JSON.parse(val) : val;
        _mem[uid] = parsed;
        return parsed;
      }
    } catch(_) {}
  }
  return null;
}

function getState(uid) { return _mem[uid] || null; }

module.exports = { loadAllStates, setState, delState, getState, getStateAsync, _mem };
