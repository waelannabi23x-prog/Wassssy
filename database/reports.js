'use strict';
const { all, get, run } = require('./db');
const add = (fileId, uid, reason) => run('INSERT INTO reports(file_id,user_id,reason) VALUES($1,$2,$3)', [fileId, uid, reason]);
const hasReported = async (uid, fid) => !!(await get("SELECT 1 FROM reports WHERE user_id=$1 AND file_id=$2 AND status='pending'", [uid, fid]));
const dismiss = id => run("UPDATE reports SET status='dismissed' WHERE id=$1", [id]);
module.exports = { add, hasReported, dismiss };
