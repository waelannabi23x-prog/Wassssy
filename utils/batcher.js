const { all } = require('../database/db');

const _queue = new Map();

function batchGet(table, ids, field='id') {
  return new Promise((resolve) => {
    if(!_queue.has(table)) _queue.set(table, []);
    _queue.get(table).push({ ids, resolve, field });
    if(_queue.get(table).length === 1) {
      setTimeout(async () => {
        const batch = _queue.get(table) || [];
        _queue.delete(table);
        const allIds = [...new Set(batch.flatMap(b => b.ids))];
        if(!allIds.length) { batch.forEach(b => b.resolve({})); return; }
        const ph = allIds.map((_,i) => '$'+(i+1)).join(',');
        const rows = await all(`SELECT * FROM ${table} WHERE ${field} IN (${ph})`, allIds);
        const map = Object.fromEntries(rows.map(r => [r[field], r]));
        batch.forEach(b => b.resolve(Object.fromEntries(b.ids.map(id => [id, map[id]||null]))));
      }, 10);
    }
  });
}

module.exports = { batchGet };
