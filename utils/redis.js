const Redis = require('ioredis');
const logger = require('./logger');

let client = null;

function getRedis() {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    client = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 500, 3000);
        return delay;
      },
      tls: {},
      lazyConnect: true,
    });

    client.on('error', (err) => {
      if (err.message?.includes('ECONNREFUSED') || err.message?.includes('getaddrinfo')) {
        logger.error('Redis connection lost:', err.message);
      }
    });

    client.on('connect', () => logger.info('✅ Redis connected'));

    logger.info('✅ Redis ready');
    return client;
  } catch (e) {
    logger.error('Redis init failed:', e.message);
    return null;
  }
}

const memoryStates = new Map();

async function getState(uid) {
  const r = getRedis();
  if (r) {
    try {
      const data = await r.get('state_' + uid);
      if (data) return JSON.parse(data);
    } catch (e) {}
  }
  return memoryStates.get(uid) || null;
}

async function setState(uid, state) {
  memoryStates.set(uid, state);
  const r = getRedis();
  if (r) {
    try {
      await r.set('state_' + uid, JSON.stringify(state), 'EX', 3600);
    } catch (e) {}
  }
  _scheduleFlush(uid, state);
}

async function delState(uid) {
  memoryStates.delete(uid);
  const r = getRedis();
  if (r) {
    try { await r.del('state_' + uid); } catch (e) {}
  }
  _scheduleFlush(uid, null);
}

const _dirty = new Set();
let _timer = null;

function _scheduleFlush(uid, state) {
  _dirty.add(uid);
  if (_timer) return;
  _timer = setTimeout(async () => {
    _timer = null;
    if (!_dirty.size) return;
    const uids = [..._dirty];
    _dirty.clear();

    const toUpsert = [], toDelete = [];
    for (const uid of uids) {
      const s = memoryStates.get(uid);
      if (s) toUpsert.push([uid, JSON.stringify(s)]);
      else toDelete.push(uid);
    }

    try {
      const { run } = require('../database/db');
      if (toDelete.length) {
        const ph = toDelete.map((_, i) => '$' + (i + 1)).join(',');
        await run('DELETE FROM user_states WHERE user_id IN (' + ph + ')', toDelete);
      }
      if (toUpsert.length) {
        const ph = toUpsert.map((_, i) => '($' + (i*2+1) + ', $' + (i*2+2) + ', CURRENT_TIMESTAMP)').join(',');
        await run(
          'INSERT INTO user_states(user_id, state, updated_at) VALUES ' + ph +
          ' ON CONFLICT(user_id) DO UPDATE SET state=EXCLUDED.state, updated_at=CURRENT_TIMESTAMP',
          toUpsert.flat()
        );
      }
    } catch (e) {}
  }, 2000);
}

async function loadAllStates() {
  try {
    const { all } = require('../database/db');
    const rows = await all('SELECT user_id, state FROM user_states');
    for (const r of rows) {
      try { memoryStates.set(r.user_id, JSON.parse(r.state)); } catch (e) {}
    }
    logger.info('✅ Loaded ' + memoryStates.size + ' states from DB');
  } catch (e) {}
}

module.exports = { getRedis, getState, setState, delState, loadAllStates };
