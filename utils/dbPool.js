const { Worker } = require('worker_threads');
const path = require('path');
const os = require('os');

const POOL_SIZE = Math.min(os.cpus().length, 4);
const workers = [];
const pending = new Map();
let reqId = 0;
let roundRobin = 0;

function createWorker() {
  const w = new Worker(path.join(__dirname, '../workers/dbWorker.js'));
  w.on('message', ({ id, result, error }) => {
    const { resolve, reject } = pending.get(id) || {};
    pending.delete(id);
    if(error) reject(new Error(error));
    else resolve(result);
  });
  w.on('error', e => console.error('Worker error:', e.message));
  return w;
}

for(let i=0; i<POOL_SIZE; i++) workers.push(createWorker());

function dbQuery(type, sql, params=[]) {
  return new Promise((resolve, reject) => {
    const id = ++reqId;
    pending.set(id, { resolve, reject });
    const worker = workers[roundRobin++ % POOL_SIZE];
    worker.postMessage({ id, type, sql, params });
  });
}

module.exports = {
  all: (sql, params) => dbQuery('all', sql, params),
  get: (sql, params) => dbQuery('get', sql, params),
  run: (sql, params) => dbQuery('run', sql, params),
};
