const { cacheGet, cacheSet, cacheClear } = require("../utils/cache");
const { all, get, run } = require('./db');

const getBundles = async catId => { const key="bdls_"+catId; const c=cacheGet(key); if(c) return c; const r=await all('SELECT * FROM bundles WHERE category_id=$1 AND is_deleted=0 ORDER BY created_at DESC',[catId]); cacheSet(key,r,300000); return r; };
const getBundle = async id => {
  const key='bundle_'+id;
  const c=cacheGet(key);
  if(c) return c;
  const r=await get('SELECT * FROM bundles WHERE id=$1',[id]);
  if(r) cacheSet(key,r,600000);
  return r;
};
const addBundle = async (catId,title,desc,by) => {
  if(await get('SELECT 1 FROM bundles WHERE category_id=$1 AND title=$2 AND is_deleted=0',[catId,title])) throw new Error('exists');
  await run('INSERT INTO bundles(category_id,title,description,uploaded_by) VALUES($1,$2,$3,$4)',[catId,title,desc||'',by]);
  cacheClear('bdls_'+catId);
  const b = await get('SELECT id FROM bundles WHERE category_id=$1 AND title=$2 ORDER BY id DESC LIMIT 1',[catId,title]);
  return b.id;
};
const deleteBundle = async id => { const b=await get('SELECT category_id FROM bundles WHERE id=$1',[id]); await run('UPDATE bundles SET is_deleted=1 WHERE id=$1',[id]); cacheClear('bundle_'+id); cacheClear('bundle_full_'+id); if(b) cacheClear('bdls_'+b.category_id); };
const incBundleDownloads = id => run('UPDATE bundles SET downloads=downloads+1 WHERE id=$1',[id]);

const getBundleFiles = bundleId => all('SELECT bf.*, bf.title as file_title, bf.file_type as real_type FROM bundle_files bf WHERE bf.bundle_id=$1',[bundleId]);
const addBundleFile = (bundleId,fileId,fileType,title) => run('INSERT INTO bundle_files(bundle_id,file_id,file_type,title) VALUES($1,$2,$3,$4)',[bundleId,fileId,fileType||'document',title||'']);
const removeBundleFile = id => run('DELETE FROM bundle_files WHERE id=$1',[id]);
const getBundleCount = async catId => (await get('SELECT COUNT(*) as c FROM bundles WHERE category_id=$1 AND is_deleted=0',[catId]))?.c||0;

const renameBundle = async (id,title) => { await run('UPDATE bundles SET title=$1 WHERE id=$2',[title,id]); cacheClear('bundle_'+id); cacheClear('bundle_full_'+id); };
const restoreBundle = async id => { const b=await get('SELECT category_id FROM bundles WHERE id=$1',[id]); await run('UPDATE bundles SET is_deleted=0 WHERE id=$1',[id]); cacheClear('bundle_'+id); if(b) cacheClear('bdls_'+b.category_id); };
module.exports = { getBundles,getBundle,addBundle,deleteBundle,renameBundle,restoreBundle,incBundleDownloads,getBundleFiles,addBundleFile,removeBundleFile,getBundleCount };

// ── إضافات جديدة ──────────────────────────────────────────────────

async function getAllBundles() {
  return all(`SELECT b.*, s.name as specialty_name, COUNT(bf.file_id) as files_count
    FROM bundles b LEFT JOIN specialties s ON s.id=b.specialty_id
    LEFT JOIN bundle_files bf ON bf.bundle_id=b.id
    GROUP BY b.id, s.name ORDER BY b.created_at DESC`);
}
async function searchBundles(q) {
  return all(`SELECT b.*, s.name as specialty_name FROM bundles b
    LEFT JOIN specialties s ON s.id=b.specialty_id
    WHERE LOWER(b.name) LIKE LOWER($1) ORDER BY b.name LIMIT 20`, ['%'+q+'%']);
}

async function createBundle(name, specialtyId, description) {
  return get(`INSERT INTO bundles(name,specialty_id,description)
    VALUES($1,$2,$3) RETURNING *`, [name, specialtyId||null, description||null]);
}

module.exports = { ...module.exports, getAllBundles, searchBundles, createBundle };
