const { workerData, parentPort } = require('worker_threads');
const { all, get, run } = require('../database/db');

parentPort.on('message', async ({ id, type, sql, params }) => {
  try {
    let result;
    if(type==='all') result = await all(sql, params);
    else if(type==='get') result = await get(sql, params);
    else if(type==='run') { await run(sql, params); result = null; }
    parentPort.postMessage({ id, result, error: null });
  } catch(e) {
    parentPort.postMessage({ id, result: null, error: e.message });
  }
});
