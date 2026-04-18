'use strict';
const Redis = require('ioredis');
const logger = require('./logger');
let client = null;
const _memStates = new Map();
const _dirty = new Set();
let _flushT = null;

function getRedis() {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    client = new Redis(url, { maxRetriesPerRequest: 3, retryStrategy(t) { return Math.min(t * 500, 3000); }, tls: {}, lazyConnect: true });
    client.on('error', e => { if (e.message?.includes('ECONNREFUSED') || e.message?.includes('getaddrinfo')) logger.error('Redis:', e.message); });
    client.on('connect', () => logger.info('✅ Redis connected'));
    return client;
  } catch (e) { logger.error('Redis init:', e.message); return null; }
}

function scheduleFlush() {
  if (_flushT) return;
  _flushT = setTimeout(async () => {
    _flushT = null;
    if (!_dirty.size) return;
    const snap = new Set(_dirty); _dirty.clear();
    try {
      const { run } = require('../database/db');
      const del = [], up = [];
      for (const uid of snap) { const s = _memStates.get(uid); if (s) up.push([uid, JSON.stringify(s)]); else del.push(uid); }
      if (del.length) { const ph = del.map((_, i) => '$' + (i + 1)).join(','); await run('DELETE FROM user_states WHERE user_id IN (' + ph + ')', del); }
      if (up.length) { const ph = up.map((_, i) => '($' + (i * 2 + 1) + ',$' + (i * 2 + 2) + ',CURRENT_TIMESTAMP)').join(','); await run('INSERT INTO user_states(user_id,state,updated_at) VALUES ' + ph + ' ON CONFLICT(user_id) DO UPDATE SET state=EXCLUDED.state,updated_at=CURRENT_TIMESTAMP', up.flat()); }
    } catch (_) {}
  }, 2000);
  if (_flushT.unref) _flushT.unref();
}

async function setState(uid, state) { _memStates.set(uid, state); _dirty.add(uid); const r = getRedis(); if (r) try { await r.set('state_' + uid, JSON.stringify(state), 'EX', 3600); } catch (_) {} scheduleFlush(); }
async function delState(uid) { _memStates.delete(uid); _dirty.add(uid); const r = getRedis(); if (r) try { await r.del('state_' + uid); } catch (_) {} scheduleFlush(); }
async function loadAllStates() { try { const { all } = require('../database/db'); const rows = await all('SELECT user_id, state FROM user_states'); for (const r of rows) { try { _memStates.set(r.user_id, JSON.parse(r.state)); } catch (_) {} } logger.info('✅ Loaded ' + _memStates.size + ' states'); } catch (_) {} }
module.exports = { getRedis, setState, delState, loadAllStates };
