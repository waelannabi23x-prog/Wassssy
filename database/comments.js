'use strict';
const { all, get, run } = require('./db');
const { cacheGet, cacheSet, cacheClear, cacheClearPrefix } = require('../utils/cache');

const getComments = (fileId, limit) => {
  limit = limit || 20;
  var k = 'cmts_all_' + fileId;
  var cv = cacheGet(k);
  if (cv) return cv;
  var r = all(
    "SELECT c.*, u.first_name, u.username FROM comments c LEFT JOIN users u ON c.user_id=u.id WHERE c.file_id=$1 AND c.is_deleted=0 ORDER BY c.created_at DESC LIMIT $2",
    [fileId, limit]
  );
  cacheSet(k, r, 60000);
  return r;
};

const addComment = (fileId, userId, text) => {
  cacheClear('cmtcnt_' + fileId);
  cacheClearPrefix('cmts_all_');
  return run('INSERT INTO comments(file_id,user_id,text) VALUES($1,$2,$3)', [fileId, userId, text]);
};

const deleteComment = id => run('UPDATE comments SET is_deleted=1 WHERE id=$1', [id]);

const deleteCommentAdmin = async id => {
  var c = await get('SELECT file_id FROM comments WHERE id=$1', [id]);
  if (c) { cacheClear('cmtcnt_' + c.file_id); cacheClearPrefix('cmts_all_'); }
  return run('DELETE FROM comments WHERE id=$1', [id]);
};

const getComment = id => get('SELECT * FROM comments WHERE id=$1', [id]);

const countComments = async (fileId) => {
  var k = 'cmtcnt_' + fileId;
  var cv = cacheGet(k);
  if (cv !== null) return cv;
  var r = await get('SELECT COUNT(*) as c FROM comments WHERE file_id=$1 AND is_deleted=0', [fileId]);
  var cnt = r ? r.c : 0;
  cacheSet(k, cnt, 300000);
  return cnt;
};

const getUserComments = userId => all('SELECT c.*, f.title as file_title FROM comments c LEFT JOIN files f ON c.file_id=f.id WHERE c.user_id=$1 AND c.is_deleted=0 ORDER BY c.created_at DESC LIMIT 10', [userId]);

module.exports = { getComments, addComment, deleteComment, deleteCommentAdmin, getComment, countComments, getUserComments };
