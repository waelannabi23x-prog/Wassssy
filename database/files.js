const { all, get, run } = require('./db');
const { cacheGet, cacheSet, cacheClear } = require('../utils/cache');

const J = `SELECT f.*,c.name as cat_name,s.name as sub_name,sm.name as sem_name,y.name as year_name,sp.name as spec_name FROM files f JOIN categories c ON f.category_id=c.id JOIN subjects s ON c.subject_id=s.id JOIN semesters sm ON s.semester_id=sm.id JOIN years y ON sm.year_id=y.id JOIN specialties sp ON y.specialty_id=sp.id`;

const getFiles = async catId => {
  const key='files_'+catId;
  const cached=cacheGet(key);
  if(cached) return cached;
  const result=await all(J+' WHERE f.category_id=? AND f.is_deleted=0 ORDER BY f.title',[catId]);
  cacheSet(key,result,300000);
  return result;
};

const getFile = async id => {
  const key='file_'+id;
  const cached=cacheGet(key);
  if(cached) return cached;
  const result=await get(J+' WHERE f.id=?',[id]);
  if(result) cacheSet(key,result,300000);
  return result;
};

const addFile = async (catId,title,desc,fid,ftype,by) => {
  if(await get('SELECT 1 FROM files WHERE category_id=? AND title=? AND is_deleted=0',[catId,title])) throw new Error('exists');
  await run('INSERT INTO files(category_id,title,description,file_id,file_type,uploaded_by) VALUES(?,?,?,?,?,?)',[catId,title,desc||'',fid,ftype,by]);
  cacheClear('files_'+catId);
};

const softDelete = async id => {
  const f=await get('SELECT category_id FROM files WHERE id=?',[id]);
  cacheClear('file_'+id);
  if(f) cacheClear('files_'+f.category_id);
  return run('UPDATE files SET is_deleted=1 WHERE id=?',[id]);
};

const restore = async id => {
  const f=await get('SELECT category_id FROM files WHERE id=?',[id]);
  cacheClear('file_'+id);
  if(f) cacheClear('files_'+f.category_id);
  return run('UPDATE files SET is_deleted=0 WHERE id=?',[id]);
};

const rename = async (id,title) => {
  const f=await get('SELECT category_id FROM files WHERE id=?',[id]);
  cacheClear('file_'+id);
  if(f) cacheClear('files_'+f.category_id);
  return run('UPDATE files SET title=? WHERE id=?',[title,id]);
};

const updateDesc = (id,desc) => { cacheClear('file_'+id); return run('UPDATE files SET description=? WHERE id=?',[desc,id]); };

// بدون cacheClear — downloads لا يأثر على التصفح
const incDownloads = id => run('UPDATE files SET downloads=downloads+1 WHERE id=?',[id]);

const totalFiles = async () => (await get('SELECT COUNT(*) as c FROM files WHERE is_deleted=0'))?.c || 0;
const totalDownloads = async () => (await get('SELECT SUM(downloads) as t FROM files WHERE is_deleted=0'))?.t || 0;
const topDownloaded = (n=10) => all(J+' WHERE f.is_deleted=0 ORDER BY f.downloads DESC LIMIT ?',[n]);
const recentFiles = (n=15) => all(J+' WHERE f.is_deleted=0 ORDER BY f.uploaded_at DESC LIMIT ?',[n]);
const getTrash = () => all(J+' WHERE f.is_deleted=1 ORDER BY f.uploaded_at DESC LIMIT 30');

const search = async (q, spId=0) => {
  const key='search_'+q.toLowerCase().trim();
  const cached=cacheGet(key);
  if(cached) return cached;
  const words=q.trim().split(/\s+/);
  const conditions=words.map(()=>'(f.title LIKE ? OR f.description LIKE ? OR s.name LIKE ? OR c.name LIKE ? OR sp.name LIKE ? OR y.name LIKE ? OR sm.name LIKE ?)').join(' AND ');
  const params=words.flatMap(w=>Array(7).fill('%'+w+'%'));
  const spFilter = spId && spId!=0 ? ' AND y.specialty_id='+parseInt(spId) : '';
  const result=await all(J+' WHERE f.is_deleted=0 AND ('+conditions+')'+spFilter+' ORDER BY f.downloads DESC, f.uploaded_at DESC LIMIT 30',params);
  cacheSet(key,result,300000);
  return result;
};

module.exports={getFiles,getFile,addFile,softDelete,restore,rename,updateDesc,incDownloads,totalFiles,totalDownloads,topDownloaded,recentFiles,getTrash,search};
