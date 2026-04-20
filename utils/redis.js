'use strict';
const Redis  = require('ioredis');
const logger = require('./logger');

let client = null;
const _mem   = new Map(); // uid → state object
const _dirty = new Set();
let   _flushT = null;

function getRedis() {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    client = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: t => Math.min(t * 500, 3000),
      tls: {},
      lazyConnect: true,
    });
    client.on('error', e => {
      if (e.message?.includes('ECONNREFUSED') || e.message?.includes('getaddrinfo'))
        logger.error('Redis:', e.message);
    });
    client.on('connect', () => logger.info('✅ Redis connected'));
    return client;
  } catch (e) { logger.error('Redis init:', e.message); return null; }
}

function _scheduleFlush() {
  if (_flushT) return;
  _flushT = setTimeout(async () => {
    _flushT = null;
    if (!_dirty.size) return;
    const snap = new Set(_dirty); _dirty.clear();
    try {
      const { run } = require('../database/db');
      const del = [], up = [];
      for (const uid of snap) {
        const s = _mem.get(uid);
        if (s) up.push([uid, JSON.stringify(s)]);
        else    del.push(uid);
      }
      if (del.length) {
        await run(
          `DELETE FROM user_states WHERE user_id IN (${del.map((_,i) => '$'+(i+1)).join(',')})`,
          del
        );
      }
      if (up.length) {
        await run(
          `INSERT INTO user_states(user_id,state,updated_at) VALUES
           ${up.map((_,i) => `($${i*2+1},$${i*2+2},CURRENT_TIMESTAMP)`).join(',')}
           ON CONFLICT(user_id) DO UPDATE SET state=EXCLUDED.state,updated_at=CURRENT_TIMESTAMP`,
          up.flat()
        );
      }
    } catch (_) {}
  }, 2000);
  if (_flushT.unref) _flushT.unref();
}

async function setState(uid, state) {
  state._ts = Date.now();
  _mem.set(uid, state);
  _dirty.add(uid);
  const r = getRedis();
  if (r) r.set('st_' + uid, JSON.stringify(state), 'EX', 3600).catch(() => {});
  _scheduleFlush();
}

async function delState(uid) {
  _mem.delete(uid);
  _dirty.add(uid);
  const r = getRedis();
  if (r) r.del('st_' + uid).catch(() => {});
  _scheduleFlush();
}

function getState(uid) { return _mem.get(uid) || null; }

async function loadAllStates() {
  try {
    const { all } = require('../database/db');
    const rows = await all(
      "SELECT user_id, state FROM user_states WHERE updated_at > NOW() - INTERVAL '24 hours'"
    );
    for (const r of rows) {
      try { _mem.set(r.user_id, JSON.parse(r.state)); } catch (_) {}
    }
    logger.info(`✅ Loaded ${_mem.size} user states`);
  } catch (e) { logger.warn('[States] DB unavailable:', e.message); }
}

module.exports = { getRedis, setState, delState, getState, loadAllStates };
