const { Worker } = require('worker_threads');
const path = require('path');
const os = require('os');

const POOL_SIZE = Math.min(os.cpus().length, 4);
const workers = [];
const pending = new Map();
let reqId = 0;
let roundRobin = 0;

function createWorker(index) {
  const w = new Worker(path.join(__dirname, '../workers/dbWorker.js'));
  w.on('message', ({ id, result, error }) => {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (error) p.reject(new Error(error));
    else p.resolve(result);
  });
  w.on('error', e => {
    console.error(`[dbPool] Worker ${index} error:`, e.message);
    _restartWorker(index);
  });
  w.on('exit', code => {
    if (code !== 0) {
      console.error(`[dbPool] Worker ${index} exited code ${code}, restarting...`);
      _restartWorker(index);
    }
  });
  return w;
}

function _restartWorker(index) {
  for (const [id, p] of pending) {
    pending.delete(id);
    p.reject(new Error('Worker crashed, please retry'));
  }
  try { workers[index]?.terminate(); } catch(e) {}
  workers[index] = createWorker(index);
  console.log(`[dbPool] Worker ${index} restarted ✅`);
}

for (let i = 0; i < POOL_SIZE; i++) workers.push(createWorker(i));

function dbQuery(type, sql, params = []) {
  return new Promise((resolve, reject) => {
    const id = ++reqId;
    const timer = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error('DB query timeout after 10s'));
      }
    }, 10000);
    pending.set(id, {
      resolve: (v) => { clearTimeout(timer); resolve(v); },
      reject:  (e) => { clearTimeout(timer); reject(e); }
    });
    workers[roundRobin++ % POOL_SIZE].postMessage({ id, type, sql, params });
  });
}

module.exports = {
  all: (sql, params) => dbQuery('all', sql, params),
  get: (sql, params) => dbQuery('get', sql, params),
  run: (sql, params) => dbQuery('run', sql, params),
};
