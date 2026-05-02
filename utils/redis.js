'use strict';
const { run, all } = require('../database/db');
const logger = require('./logger');

const _mem = {};

async function loadAllStates() {
  try {
    const rows = await all("SELECT user_id, state FROM user_states WHERE updated_at > NOW() - INTERVAL '24 hours'");
    let n = 0;
    for (const r of rows) {
      try { _mem[r.user_id] = JSON.parse(r.state); n++; } catch(_) {}
    }
    run("DELETE FROM user_states WHERE updated_at <= NOW() - INTERVAL '24 hours'").catch(()=>{});
    logger.info('Loaded ' + n + ' user states');
  } catch(e) {
    logger.warn('[State] DB unavailable:', e.message);
  }
}

async function setState(uid, val) {
  val._ts = Date.now();
  _mem[uid] = val;
  run('INSERT INTO user_states(user_id,state,updated_at) VALUES($1,$2,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET state=$2,updated_at=CURRENT_TIMESTAMP',
    [uid, JSON.stringify(val)]).catch(()=>{});
}

async function delState(uid) {
  delete _mem[uid];
  run('DELETE FROM user_states WHERE user_id=$1', [uid]).catch(()=>{});
}

function getState(uid) { return _mem[uid] || null; }

module.exports = { loadAllStates, setState, delState, getState, _mem };
