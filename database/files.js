const { all, get, run } = require('./db');
const { cacheGet, cacheSet, cacheClear, cacheClearPrefix } = require('../utils/cache');

const J = `SELECT f.*,c.name as cat_name,s.name as sub_name FROM files f JOIN categories c ON f.category_id=c.id JOIN subjects s ON c.subject_id=s.id`;

const getFile = async id => {
  const k='file_'+id;
  const c=cacheGet(k);
  if(c) return c;
  const r=await get(J+' WHERE f.id=? AND f.is_deleted=0',[id]);
  if(r) cacheSet(k,r,600000);
  return r;
};

const getFiles = async catId => {
  const k='files_cat_'+catId;
  const c=cacheGet(k);
  if(c) return c;
  const r=await all(J+' WHERE f.category_id=? AND f.is_deleted=0 ORDER BY f.uploaded_at DESC',[catId]);
  cacheSet(k,r,300000);
  return r;
};

const invalidateFilesCache = catId => {
  cacheClearPrefix('files_cat_'+catId);
  cacheClearPrefix('showfiles_'+catId);
};

const addFile = async (catId,title,desc,fileId,fileType,uploadedBy,extra='') => {
  const exists=await get('SELECT id FROM files WHERE category_id=? AND title=? AND is_deleted=0',[catId,title]);
  if(exists) throw new Error('exists');
  await run('INSERT INTO files(category_id,title,description,file_id,file_type,uploaded_by) VALUES(?,?,?,?,?,?)',[catId,title,desc,fileId,fileType,uploadedBy]);
  invalidateFilesCache(catId);
};

const incDownloads = async id => {
  await run('UPDATE files SET downloads=downloads+1 WHERE id=?',[id]);
  cacheClear('file_'+id);
  cacheClear('prev_static_'+id);
};

const softDelete = async id => {
  const f=await get('SELECT category_id FROM files WHERE id=?',[id]);
  await run('UPDATE files SET is_deleted=1 WHERE id=?',[id]);
  cacheClear('file_'+id);
  cacheClear('prev_static_'+id);
  cacheClear('similar_'+id);
  if(f) invalidateFilesCache(f.category_id);
};

const restore = async id => {
  const f=await get('SELECT category_id FROM files WHERE id=?',[id]);
  await run('UPDATE files SET is_deleted=0 WHERE id=?',[id]);
  cacheClear('file_'+id);
  if(f) invalidateFilesCache(f.category_id);
};

const rename = async (id,title) => {
  const f=await get('SELECT category_id FROM files WHERE id=?',[id]);
  await run('UPDATE files SET title=? WHERE id=?',[title,id]);
  cacheClear('file_'+id);
  cacheClear('prev_static_'+id);
  if(f) invalidateFilesCache(f.category_id);
};

const updateDesc = async (id,desc) => {
  await run('UPDATE files SET description=? WHERE id=?',[desc,id]);
  cacheClear('file_'+id);
  cacheClear('prev_static_'+id);
};

const search = (q,limit=20) => all(J+` WHERE f.is_deleted=0 AND (f.title ILIKE ? OR f.description ILIKE ?) ORDER BY f.downloads DESC LIMIT ?`,['%'+q+'%','%'+q+'%',limit]);
const topDownloaded = (n=5) => all(J+' WHERE f.is_deleted=0 ORDER BY f.downloads DESC LIMIT ?',[n]);
const recentFiles   = (n=5) => all(J+' WHERE f.is_deleted=0 ORDER BY f.uploaded_at DESC LIMIT ?',[n]);
const totalFiles    = async () => { const r=await get('SELECT COUNT(*) as c FROM files WHERE is_deleted=0'); return r?.c||0; };
const totalDownloads= async () => { const r=await get('SELECT SUM(downloads) as c FROM files WHERE is_deleted=0'); return r?.c||0; };
const getTrash      = () => all('SELECT * FROM files WHERE is_deleted=1 ORDER BY uploaded_at DESC');
const getNewFiles   = (spId,limit=10) => all(J+` JOIN subjects sb ON c.subject_id=sb.id JOIN semesters sm ON sb.semester_id=sm.id JOIN years yr ON sm.year_id=yr.id WHERE yr.specialty_id=? AND f.is_deleted=0 ORDER BY f.uploaded_at DESC LIMIT ?`,[spId,limit]);

module.exports = { getFile,getFiles,addFile,incDownloads,softDelete,restore,rename,updateDesc,search,topDownloaded,recentFiles,totalFiles,totalDownloads,getTrash,getNewFiles,invalidateFilesCache };
