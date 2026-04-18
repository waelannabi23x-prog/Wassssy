'use strict';
const { all, get, run } = require('./db');
const { cacheGet, cacheSet, cacheClear, cacheClearPrefix } = require('../utils/cache');

const J = 'SELECT f.*,c.name as cat_name,s.name as sub_name FROM files f JOIN categories c ON f.category_id=c.id JOIN subjects s ON c.subject_id=s.id';

const getFile = async id => { var k='file_'+id; var cv=cacheGet(k); if(cv) return cv; var r=await get(J+' WHERE f.id=$1 AND f.is_deleted=0',[id]); if(r) cacheSet(k,r,600000); return r; };
const getFiles = async catId => { var k='files_cat_'+catId; var cv=cacheGet(k); if(cv) return cv; var r=await all(J+' WHERE f.category_id=$1 AND f.is_deleted=0 ORDER BY f.uploaded_at DESC',[catId]); cacheSet(k,r,600000); return r; };

const invalidateFilesCache = catId => { cacheClearPrefix('files_cat_'+catId); cacheClearPrefix('showfiles_'); };

const addFile = async (catId,title,desc,fileId,fileType,uploadedBy) => {
  var exists=await get('SELECT id FROM files WHERE category_id=$1 AND title=$2 AND is_deleted=0',[catId,title]);
  if(exists) throw new Error('exists');
  await run('INSERT INTO files(category_id,title,description,file_id,file_type,uploaded_by) VALUES($1,$2,$3,$4,$5,$6)',[catId,title,desc,fileId,fileType,uploadedBy]);
  invalidateFilesCache(catId);
  if(global._clearSearchCache) global._clearSearchCache();
  var newFile = await get(J+' WHERE f.category_id=$1 AND f.title=$2 AND f.is_deleted=0 ORDER BY f.id DESC LIMIT 1',[catId,title]);
  return newFile;
};

const incDownloads = async id => { await run('UPDATE files SET downloads=downloads+1 WHERE id=$1',[id]); cacheClear('file_'+id); };
const softDelete = async id => { if(global._clearSearchCache) global._clearSearchCache(); var f=await get('SELECT category_id FROM files WHERE id=$1',[id]); await run('UPDATE files SET is_deleted=1 WHERE id=$1',[id]); cacheClear('file_'+id); cacheClear('prev_static_'+id); cacheClear('similar_'+id); if(f) invalidateFilesCache(f.category_id); };
const restore = async id => { if(global._clearSearchCache) global._clearSearchCache(); var f=await get('SELECT category_id FROM files WHERE id=$1',[id]); await run('UPDATE files SET is_deleted=0 WHERE id=$1',[id]); cacheClear('file_'+id); if(f) invalidateFilesCache(f.category_id); };
const rename = async (id,title) => { if(global._clearSearchCache) global._clearSearchCache(); var f=await get('SELECT category_id FROM files WHERE id=$1',[id]); await run('UPDATE files SET title=$1 WHERE id=$2',[title,id]); cacheClear('file_'+id); if(f) invalidateFilesCache(f.category_id); };
const updateDesc = async (id,desc) => { await run('UPDATE files SET description=$1 WHERE id=$2',[desc,id]); cacheClear('file_'+id); };
const updateDescMd = updateDesc;

// بحث سريع — ملفين فقط بدون JOINات ثقيلة
const search = (q, limit) => {
  limit = limit || 20;
  var w = '%' + q + '%';
  return all(
    J + ' WHERE f.is_deleted=0 AND (f.title ILIKE $1 OR f.description ILIKE $1) ORDER BY f.downloads DESC LIMIT $2',
    [w, limit]
  );
};

const topDownloaded = (n) => { n=n||5; return all(J+' WHERE f.is_deleted=0 ORDER BY f.downloads DESC LIMIT $1',[n]); };
const recentFiles = (n) => { n=n||5; return all(J+' WHERE f.is_deleted=0 ORDER BY f.uploaded_at DESC LIMIT $1',[n]); };
const totalFiles = async () => { var r=await get('SELECT COUNT(*) as c FROM files WHERE is_deleted=0'); return r?r.c:0; };
const totalDownloads = async () => { var r=await get('SELECT SUM(downloads) as c FROM files WHERE is_deleted=0'); return r?r.c:0; };
const getTrash = () => all('SELECT * FROM files WHERE is_deleted=1 ORDER BY uploaded_at DESC');
const getNewFiles = (spId,limit) => { limit=limit||10; return all(J+' JOIN semesters sm ON s.semester_id=sm.id JOIN years y ON sm.year_id=y.id WHERE y.specialty_id=$1 AND f.is_deleted=0 ORDER BY f.uploaded_at DESC LIMIT $2',[spId,limit]); };

module.exports = { getFile,getFiles,addFile,incDownloads,softDelete,restore,rename,updateDesc,updateDescMd,search,topDownloaded,recentFiles,totalFiles,totalDownloads,getTrash,getNewFiles,invalidateFilesCache };
