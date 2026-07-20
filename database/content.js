const { all, get, run } = require('./db');
const { cacheGet, cacheSet, cacheClear, cacheClearPrefix } = require('../utils/cache');

const TTL = 86400000; // 24h — content rarely changes

const getSpecs  = async () => { const k='specs'; const c=cacheGet(k); if(c) return c; const r=await all('SELECT id,name FROM specialties WHERE is_deleted=0 ORDER BY id'); cacheSet(k,r,TTL); return r; };
const getSpec   = async id => { const k='spec_'+id; const c=cacheGet(k); if(c) return c; const r=await get('SELECT id,name FROM specialties WHERE id=$1',[id]); if(r) cacheSet(k,r,TTL); return r; };
const getYears  = async spId => { const k='years_'+spId; const c=cacheGet(k); if(c) return c; const r=await all('SELECT id,name,specialty_id FROM years WHERE specialty_id=$1 AND is_deleted=0 ORDER BY id',[spId]); cacheSet(k,r,TTL); return r; };
const getYear   = async id => { const k='year_'+id; const c=cacheGet(k); if(c) return c; const r=await get('SELECT id,name,specialty_id FROM years WHERE id=$1',[id]); if(r) cacheSet(k,r,TTL); return r; };
const getSemesters = async yrId => { const k='sems_raw_'+yrId; const c=cacheGet(k); if(c) return c; const r=await all('SELECT id,name,year_id FROM semesters WHERE year_id=$1 AND is_deleted=0 ORDER BY id',[yrId]); cacheSet(k,r,TTL); return r; };
const getSemester  = async id => { const k='sem_'+id; const c=cacheGet(k); if(c) return c; const r=await get('SELECT id,name,year_id FROM semesters WHERE id=$1',[id]); if(r) cacheSet(k,r,TTL); return r; };
const getSubjects  = async smId => { const k='subs_raw_'+smId; const c=cacheGet(k); if(c) return c; const r=await all('SELECT id,name,semester_id FROM subjects WHERE semester_id=$1 AND is_deleted=0 ORDER BY id',[smId]); cacheSet(k,r,TTL); return r; };
const getSubject   = async id => { const k='sub_'+id; const c=cacheGet(k); if(c) return c; const r=await get('SELECT id,name,semester_id FROM subjects WHERE id=$1',[id]); if(r) cacheSet(k,r,TTL); return r; };
const getCategories = async sbId => { const k='cats_raw_'+sbId; const c=cacheGet(k); if(c) return c; const r=await all('SELECT id,name,subject_id FROM categories WHERE subject_id=$1 AND is_deleted=0 ORDER BY id',[sbId]); cacheSet(k,r,TTL); return r; };
const getCategory   = async id => { const k='cat_'+id; const c=cacheGet(k); if(c) return c; const r=await get('SELECT id,name,subject_id FROM categories WHERE id=$1',[id]); if(r) cacheSet(k,r,TTL); return r; };

const invalidateSpec = spId => { cacheClear('specs'); cacheClear('spec_'+spId); cacheClearPrefix('yrs_'+spId); cacheClearPrefix('sems_'+spId); cacheClearPrefix('subs_'+spId); cacheClearPrefix('cats_'+spId); cacheClearPrefix('path_'+spId); };
const invalidateYear = (spId,yrId) => { cacheClear('years_'+spId); cacheClear('year_'+yrId); cacheClearPrefix('sems_raw_'+yrId); cacheClearPrefix('sems_'+spId+'_'+yrId); cacheClearPrefix('subs_'+spId+'_'+yrId); cacheClearPrefix('path_'); };
const invalidateSem  = (spId,yrId,smId) => { cacheClear('sems_raw_'+yrId); cacheClear('sem_'+smId); cacheClearPrefix('subs_raw_'+smId); cacheClearPrefix('subs_'+spId+'_'+yrId+'_'+smId); cacheClearPrefix('path_'); };
const invalidateSub  = (spId,yrId,smId,sbId) => { cacheClear('subs_raw_'+smId); cacheClear('sub_'+sbId); cacheClearPrefix('cats_raw_'+sbId); cacheClearPrefix('cats_'+spId+'_'+yrId+'_'+smId+'_'+sbId); cacheClearPrefix('path_'); };
const invalidateCat  = (spId,yrId,smId,sbId,catId) => { cacheClear('cats_raw_'+sbId); cacheClear('cat_'+catId); cacheClearPrefix('showfiles_'+catId); cacheClearPrefix('path_'); };

const addSpec    = async name => {
  // ✅ تحقق من الموجود غير المحذوف فقط
  const active = await get('SELECT id FROM specialties WHERE name=$1 AND is_deleted=0',[name]);
  if (active) throw new Error('exists');
  // ✅ إذا كان موجوداً كمحذوف — أعد تفعيله بدل INSERT جديد
  const deleted = await get('SELECT id FROM specialties WHERE name=$1 AND is_deleted=1',[name]);
  if (deleted) {
    await run('UPDATE specialties SET is_deleted=0 WHERE id=$1',[deleted.id]);
    cacheClear('specs'); cacheClear('spec_'+deleted.id);
    return deleted.id;
  }
  const pg = require('./db').getPg();
  if (pg) {
    const r = await pg.query('INSERT INTO specialties(name) VALUES($1) RETURNING id',[name]);
    cacheClear('specs');
    return r.rows[0]?.id;
  }
  await run('INSERT INTO specialties(name) VALUES($1)',[name]);
  cacheClear('specs');
};
const renameSpec = async (id,name) => { await run('UPDATE specialties SET name=$1 WHERE id=$2',[name,id]); cacheClear('specs'); cacheClear('spec_'+id); cacheClearPrefix('path_'); };
const deleteSpec = async id => {
  // ✅ حذف كامل cascade — كل شيء مرتبط بالتخصص
  const {run:_run, all:_all} = require('./db');
  try {
    // 1. جلب كل الملفات المرتبطة لحذفها من الكاش
    const files = await _all(
      'SELECT f.id, f.category_id FROM files f JOIN categories c ON f.category_id=c.id JOIN subjects s ON c.subject_id=s.id JOIN semesters sm ON s.semester_id=sm.id JOIN years y ON sm.year_id=y.id WHERE y.specialty_id=$1',
      [id]
    ).catch(()=>[]);
    // 2. حذف cascade بالترتيب الصحيح
    await _run('DELETE FROM files WHERE id IN (SELECT f.id FROM files f JOIN categories c ON f.category_id=c.id JOIN subjects s ON c.subject_id=s.id JOIN semesters sm ON s.semester_id=sm.id JOIN years y ON sm.year_id=y.id WHERE y.specialty_id=$1)',[id]).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    await _run('DELETE FROM categories WHERE subject_id IN (SELECT s.id FROM subjects s JOIN semesters sm ON s.semester_id=sm.id JOIN years y ON sm.year_id=y.id WHERE y.specialty_id=$1)',[id]).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    await _run('DELETE FROM subjects WHERE semester_id IN (SELECT sm.id FROM semesters sm JOIN years y ON sm.year_id=y.id WHERE y.specialty_id=$1)',[id]).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    await _run('DELETE FROM semesters WHERE year_id IN (SELECT id FROM years WHERE specialty_id=$1)',[id]).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    await _run('DELETE FROM years WHERE specialty_id=$1',[id]).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    await _run('DELETE FROM user_specialties WHERE specialty_id=$1',[id]).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    await _run('DELETE FROM group_chats WHERE specialty_id=$1',[id]).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    await _run('DELETE FROM specialties WHERE id=$1',[id]).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    // 3. تنظيف الكاش
    files.forEach(f => { cacheClear('file_'+f.id); cacheClear('prev_static_'+f.id); cacheClearPrefix('showfiles_'+f.category_id); });
    cacheClearPrefix('search_'); cacheClearPrefix('gsrc_');
    if (global._clearSearchCache) global._clearSearchCache();
    invalidateSpec(id);
  } catch(e) { throw e; }
};

const addYear    = async (spId,name) => { const r=await get('SELECT id FROM years WHERE specialty_id=$1 AND name=$2',[spId,name]); if(r) throw new Error('exists'); await run('INSERT INTO years(specialty_id,name) VALUES($1,$2)',[spId,name]); cacheClear('years_'+spId); cacheClearPrefix('yrs_'+spId); };
const renameYear = async (id,name) => { const y=await getYear(id); await run('UPDATE years SET name=$1 WHERE id=$2',[name,id]); cacheClear('year_'+id); cacheClear('years_'+y?.specialty_id); cacheClearPrefix('path_'); };
const deleteYear = async id => { await run('UPDATE years SET is_deleted=1 WHERE id=$1',[id]); const y=await get('SELECT specialty_id FROM years WHERE id=$1',[id]); invalidateYear(y?.specialty_id,id); };

const addSemester    = async (yrId,name) => { const r=await get('SELECT id FROM semesters WHERE year_id=$1 AND name=$2',[yrId,name]); if(r) throw new Error('exists'); await run('INSERT INTO semesters(year_id,name) VALUES($1,$2)',[yrId,name]); cacheClear('sems_raw_'+yrId); };
const renameSemester = async (id,name) => { await run('UPDATE semesters SET name=$1 WHERE id=$2',[name,id]); cacheClear('sem_'+id); cacheClearPrefix('sems_raw_'); cacheClearPrefix('path_'); };
const deleteSemester = async id => { await run('UPDATE semesters SET is_deleted=1 WHERE id=$1',[id]); cacheClear('sem_'+id); cacheClearPrefix('sems_raw_'); cacheClearPrefix('path_'); };

const addSubject    = async (smId,name) => { const r=await get('SELECT id FROM subjects WHERE semester_id=$1 AND name=$2',[smId,name]); if(r) throw new Error('exists'); await run('INSERT INTO subjects(semester_id,name) VALUES($1,$2)',[smId,name]); cacheClear('subs_raw_'+smId); };
const renameSubject = async (id,name) => { await run('UPDATE subjects SET name=$1 WHERE id=$2',[name,id]); cacheClear('sub_'+id); cacheClearPrefix('subs_raw_'); cacheClearPrefix('path_'); };
const deleteSubject = async id => {
  // ✅ حذف كامل نهائي — المادة + كل التصنيفات والملفات المرتبطة بها
  const {run:_run, all:_all} = require('./db');
  try {
    const files = await _all(
      'SELECT f.id, f.category_id FROM files f JOIN categories c ON f.category_id=c.id WHERE c.subject_id=$1',
      [id]
    ).catch(()=>[]);
    await _run('DELETE FROM files WHERE id IN (SELECT f.id FROM files f JOIN categories c ON f.category_id=c.id WHERE c.subject_id=$1)',[id]).catch(()=>{});
    await _run('DELETE FROM categories WHERE subject_id=$1',[id]).catch(()=>{});
    await _run('DELETE FROM subjects WHERE id=$1',[id]).catch(()=>{});
    files.forEach(f => { cacheClear('file_'+f.id); cacheClear('prev_static_'+f.id); cacheClearPrefix('showfiles_'+f.category_id); });
    cacheClear('sub_'+id); cacheClearPrefix('subs_raw_'); cacheClearPrefix('path_'); cacheClearPrefix('cats_raw_');
    cacheClearPrefix('search_'); cacheClearPrefix('gsrc_');
    if (global._clearSearchCache) global._clearSearchCache();
  } catch(e) {
    require('../utils/logger').error('[deleteSubject]', e.message);
    throw e;
  }
};

const addCategory    = async (sbId,name) => { const r=await get('SELECT id FROM categories WHERE subject_id=$1 AND name=$2',[sbId,name]); if(r) throw new Error('exists'); await run('INSERT INTO categories(subject_id,name) VALUES($1,$2)',[sbId,name]); cacheClear('cats_raw_'+sbId); };
const renameCategory = async (id,name) => { await run('UPDATE categories SET name=$1 WHERE id=$2',[name,id]); cacheClear('cat_'+id); cacheClearPrefix('cats_raw_'); cacheClearPrefix('path_'); cacheClearPrefix('showfiles_'); };
const deleteCategory = async id => {
  // ✅ حذف كامل نهائي — التصنيف + كل الملفات بداخله
  const {run:_run, all:_all} = require('./db');
  try {
    const files = await _all('SELECT id FROM files WHERE category_id=$1',[id]).catch(()=>[]);
    await _run('DELETE FROM files WHERE category_id=$1',[id]).catch(()=>{});
    await _run('DELETE FROM categories WHERE id=$1',[id]).catch(()=>{});
    files.forEach(f => { cacheClear('file_'+f.id); cacheClear('prev_static_'+f.id); });
    cacheClear('cat_'+id); cacheClearPrefix('cats_raw_'); cacheClearPrefix('showfiles_'); cacheClearPrefix('path_');
    cacheClearPrefix('search_'); cacheClearPrefix('gsrc_');
    if (global._clearSearchCache) global._clearSearchCache();
  } catch(e) {
    require('../utils/logger').error('[deleteCategory]', e.message);
    throw e;
  }
};

// يجلب المسار الكامل (spId,yrId,smId,sbId) انطلاقاً من category_id فقط.
// استعلام واحد خفيف — يُستخدم لبناء زر رجوع صحيح عند فتح ملف من
// "جديد/مفضلاتي/سجلي" حيث لا تتوفر السلسلة الكاملة مسبقاً.
const { get: _get } = require('./db');
const { cacheGet: _cg, cacheSet: _cs } = require('../utils/cache');
async function getPathFromCategory(catId) {
  if (!catId || catId == 0) return null;
  const k = 'catpath_' + catId;
  const cached = _cg(k);
  if (cached) return cached;
  const row = await _get(
    `SELECT y.specialty_id as sp_id, s.year_id as yr_id, sub.semester_id as sm_id, c.subject_id as sb_id
     FROM categories c
     JOIN subjects sub ON c.subject_id = sub.id
     JOIN semesters s ON sub.semester_id = s.id
     JOIN years y ON s.year_id = y.id
     WHERE c.id = $1`,
    [catId]
  ).catch(() => null);
  if (!row) return null;
  const path = { spId: row.sp_id, yrId: row.yr_id, smId: row.sm_id, sbId: row.sb_id, catId };
  _cs(k, path, 600000);
  return path;
}

module.exports = {
  getSpecs,getSpec,getYears,getYear,getSemesters,getSemester,getSubjects,getSubject,getCategories,getCategory,
  addSpec,renameSpec,deleteSpec,addYear,renameYear,deleteYear,
  addSemester,renameSemester,deleteSemester,addSubject,renameSubject,deleteSubject,
  addCategory,renameCategory,deleteCategory,
  invalidateSpec,invalidateYear,invalidateSem,invalidateSub,invalidateCat,
  getPathFromCategory
};
