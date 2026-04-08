const { all, get, run } = require('./db');
const { cacheGet, cacheSet } = require('../utils/cache');

const addReport = (fileId,userId,reason) => run('INSERT INTO reports(file_id,user_id,reason) VALUES(?,?,?)',[fileId,userId,reason]);

const getReports = (status='pending') => all(`SELECT r.*,f.title as file_title,u.first_name FROM reports r LEFT JOIN files f ON r.file_id=f.id LEFT JOIN users u ON r.user_id=u.id WHERE r.status=? ORDER BY r.created_at DESC LIMIT 50`,[status]);

const countPending = async () => (await get('SELECT COUNT(*) as c FROM reports WHERE status=?',['pending']))?.c||0;

const resolveReport = id => run("UPDATE reports SET status='resolved' WHERE id=?",[id]);
const dismissReport = id => run("UPDATE reports SET status='dismissed' WHERE id=?",[id]);

const hasReported = async (userId,fileId) => {
  const key='rep_'+userId+'_'+fileId;
  const c=cacheGet(key);
  if(c!==null) return c;
  const r=!!(await get("SELECT 1 FROM reports WHERE user_id=? AND file_id=? AND status='pending'",[userId,fileId]));
  cacheSet(key,r,600000);
  return r;
};

module.exports = { addReport,getReports,countPending,resolveReport,dismissReport,hasReported };
