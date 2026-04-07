const { get, run } = require('./db');

const hasReported = async (uid, fid) => {
  const r = await get('SELECT 1 FROM reports WHERE user_id=? AND file_id=?', [uid, fid]);
  return !!r;
};

const addReport = (fid, uid, reason) =>
  run('INSERT INTO reports(file_id,user_id,reason) VALUES(?,?,?) ON CONFLICT(user_id,file_id) DO NOTHING', [fid, uid, reason]);

const getReports = (fid) =>
  require('./db').all('SELECT * FROM reports WHERE file_id=?', [fid]);

module.exports = { hasReported, addReport, getReports };
