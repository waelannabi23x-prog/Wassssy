'use strict';
const { run, all } = require('../database/db');
const logger = require('./logger');

const STATE_TTL_HOURS = 24;

async function initPersistentStates() {
  try {
    const rows = await all(
      `SELECT user_id, state FROM user_states WHERE updated_at > NOW() - INTERVAL '${STATE_TTL_HOURS} hours'`
    );
    let loaded = 0;
    for (const row of rows) {
      try { global.userStates[row.user_id] = JSON.parse(row.state); loaded++; } catch (_) {}
    }
    run(`DELETE FROM user_states WHERE updated_at <= NOW() - INTERVAL '${STATE_TTL_HOURS} hours'`).catch(() => {});
    logger.info(`✅ Loaded ${loaded} states from DB`);
  } catch (e) {
    logger.warn('[StateMgr] DB states unavailable, RAM only:', e.message);
  }
}

module.exports = { initPersistentStates };
