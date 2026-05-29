'use strict';
const { run, all } = require('../database/db');
const logger = require('./logger');

const _mem = new Map();
let _redis = null;

const { getRedisClient } = require('./redisClient');
_redis = getRedisClient();

// ── Startup: من DB دائماً (KEYS محظور في Upstash Free) ──
async function loadAllStates() {
  try {
    const rows = await all("SELECT user_id, state FROM user_states WHERE updated_at > NOW() - INTERVAL '24 hours'");
    let n = 0;
    for (const r of rows) {
      try { _mem.set(r.user_id, JSON.parse(r.state)); n++; } catch(err) { require('./logger').debug('[catch]', err.message); }
    }
    run("DELETE FROM user_states WHERE updated_at <= NOW() - INTERVAL '24 hours'").catch(err => { require('./logger').debug("[silent]", err.message); });
    logger.info('Loaded ' + n + ' states من DB');
  } catch(e) { logger.warn('[State] DB unavailable:', e.message); }
}

// ── setState: Redis أولاً + DB backup ──
async function setState(uid, val) {
  val._ts = Date.now();
  _mem.set(uid, val);
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
  ).catch(err => { require('./logger').debug("[silent]", err.message); });
}

// ── delState ──
async function delState(uid) {
  _mem.delete(uid);

  if (_redis) {
    try { await _redis.del('state:' + uid); } catch(err) { require('./logger').debug('[catch]', err.message); }
  }

  run('DELETE FROM user_states WHERE user_id=$1', [uid]).catch(err => { require('./logger').debug("[silent]", err.message); });
}

// ── getState: من الذاكرة دائماً (فوري) ──
async function getStateAsync(uid) {
  if (_mem.has(uid)) return _mem.get(uid);
  if (_redis) {
    try {
      const val = await _redis.get('state:' + uid);
      if (val) {
        const parsed = typeof val === 'string' ? JSON.parse(val) : val;
        _mem.set(uid, parsed);
        return parsed;
      }
    } catch(err) { require('./logger').debug('[catch]', err.message); }
  }
  return null;
}

function getState(uid) { return _mem.get(uid) || null; }

module.exports = { loadAllStates, setState, delState, getState, getStateAsync, _mem };
