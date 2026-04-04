const { all, get, run } = require('./db');

const getComments = (fileId, limit=20) => all(
  `SELECT c.*, u.first_name, u.username FROM comments c 
   LEFT JOIN users u ON c.user_id=u.id 
   WHERE c.file_id=? AND c.is_deleted=0 
   ORDER BY c.created_at DESC LIMIT ?`,
  [fileId, limit]
);

const addComment = (fileId, userId, text) => run(
  'INSERT INTO comments(file_id,user_id,text) VALUES(?,?,?)',
  [fileId, userId, text]
);

const deleteComment = (id) => run('UPDATE comments SET is_deleted=1 WHERE id=?', [id]);
const deleteCommentAdmin = (id) => run('DELETE FROM comments WHERE id=?', [id]);
const getComment = (id) => get('SELECT * FROM comments WHERE id=?', [id]);
const countComments = async (fileId) => (await get('SELECT COUNT(*) as c FROM comments WHERE file_id=? AND is_deleted=0', [fileId]))?.c || 0;
const getUserComments = (userId) => all('SELECT c.*, f.title as file_title FROM comments c LEFT JOIN files f ON c.file_id=f.id WHERE c.user_id=? AND c.is_deleted=0 ORDER BY c.created_at DESC LIMIT 10', [userId]);

module.exports = { getComments, addComment, deleteComment, deleteCommentAdmin, getComment, countComments, getUserComments };
