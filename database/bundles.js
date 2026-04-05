const { all, get, run } = require('./db');

const getBundles = catId => all('SELECT * FROM bundles WHERE category_id=? AND is_deleted=0 ORDER BY created_at DESC',[catId]);
const getBundle = id => get('SELECT * FROM bundles WHERE id=?',[id]);
const addBundle = async (catId,title,desc,by) => {
  if(await get('SELECT 1 FROM bundles WHERE category_id=? AND title=? AND is_deleted=0',[catId,title])) throw new Error('exists');
  await run('INSERT INTO bundles(category_id,title,description,uploaded_by) VALUES(?,?,?,?)',[catId,title,desc||'',by]);
  const b = await get('SELECT id FROM bundles WHERE category_id=? AND title=? ORDER BY id DESC LIMIT 1',[catId,title]);
  return b.id;
};
const deleteBundle = id => run('UPDATE bundles SET is_deleted=1 WHERE id=?',[id]);
const incBundleDownloads = id => run('UPDATE bundles SET downloads=downloads+1 WHERE id=?',[id]);

const getBundleFiles = bundleId => all('SELECT bf.*, bf.title as file_title, bf.file_type as real_type FROM bundle_files bf WHERE bf.bundle_id=?',[bundleId]);
const addBundleFile = (bundleId,fileId,fileType,title) => run('INSERT INTO bundle_files(bundle_id,file_id,file_type,title) VALUES(?,?,?,?)',[bundleId,fileId,fileType||'document',title||'']);
const removeBundleFile = id => run('DELETE FROM bundle_files WHERE id=?',[id]);
const getBundleCount = async catId => (await get('SELECT COUNT(*) as c FROM bundles WHERE category_id=? AND is_deleted=0',[catId]))?.c||0;

const renameBundle = (id,title) => run('UPDATE bundles SET title=? WHERE id=?',[title,id]);
const restoreBundle = id => run('UPDATE bundles SET is_deleted=0 WHERE id=?',[id]);
module.exports = { getBundles,getBundle,addBundle,deleteBundle,renameBundle,restoreBundle,incBundleDownloads,getBundleFiles,addBundleFile,removeBundleFile,getBundleCount };
