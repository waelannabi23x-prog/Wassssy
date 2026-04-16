const { all, get, run } = require('./db');
const { cacheGet, cacheSet, cacheClear, cacheClearPrefix } = require('../utils/cache');

const TTL = 7200000; // ساعتين — المحتوى نادراً يتغير

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

const addSpec    = async name => { const r=await get('SELECT id FROM specialties WHERE name=$1',[name]); if(r) throw new Error('exists'); await run('INSERT INTO specialties(name) VALUES($1)',[name]); cacheClear('specs'); };
const renameSpec = async (id,name) => { await run('UPDATE specialties SET name=$1 WHERE id=$2',[name,id]); cacheClear('specs'); cacheClear('spec_'+id); cacheClearPrefix('path_'); };
const deleteSpec = async id => { await run('UPDATE specialties SET is_deleted=1 WHERE id=$1',[id]); invalidateSpec(id); };

const addYear    = async (spId,name) => { const r=await get('SELECT id FROM years WHERE specialty_id=$1 AND name=$2',[spId,name]); if(r) throw new Error('exists'); await run('INSERT INTO years(specialty_id,name) VALUES($1,$2)',[spId,name]); cacheClear('years_'+spId); cacheClearPrefix('yrs_'+spId); };
const renameYear = async (id,name) => { const y=await getYear(id); await run('UPDATE years SET name=$1 WHERE id=$2',[name,id]); cacheClear('year_'+id); cacheClear('years_'+y?.specialty_id); cacheClearPrefix('path_'); };
const deleteYear = async id => { await run('UPDATE years SET is_deleted=1 WHERE id=$1',[id]); const y=await get('SELECT specialty_id FROM years WHERE id=$1',[id]); invalidateYear(y?.specialty_id,id); };

const addSemester    = async (yrId,name) => { const r=await get('SELECT id FROM semesters WHERE year_id=$1 AND name=$2',[yrId,name]); if(r) throw new Error('exists'); await run('INSERT INTO semesters(year_id,name) VALUES($1,$2)',[yrId,name]); cacheClear('sems_raw_'+yrId); };
const renameSemester = async (id,name) => { await run('UPDATE semesters SET name=$1 WHERE id=$2',[name,id]); cacheClear('sem_'+id); cacheClearPrefix('sems_raw_'); cacheClearPrefix('path_'); };
const deleteSemester = async id => { await run('UPDATE semesters SET is_deleted=1 WHERE id=$1',[id]); cacheClear('sem_'+id); cacheClearPrefix('sems_raw_'); cacheClearPrefix('path_'); };

const addSubject    = async (smId,name) => { const r=await get('SELECT id FROM subjects WHERE semester_id=$1 AND name=$2',[smId,name]); if(r) throw new Error('exists'); await run('INSERT INTO subjects(semester_id,name) VALUES($1,$2)',[smId,name]); cacheClear('subs_raw_'+smId); };
const renameSubject = async (id,name) => { await run('UPDATE subjects SET name=$1 WHERE id=$2',[name,id]); cacheClear('sub_'+id); cacheClearPrefix('subs_raw_'); cacheClearPrefix('path_'); };
const deleteSubject = async id => { await run('UPDATE subjects SET is_deleted=1 WHERE id=$1',[id]); cacheClear('sub_'+id); cacheClearPrefix('subs_raw_'); cacheClearPrefix('path_'); };

const addCategory    = async (sbId,name) => { const r=await get('SELECT id FROM categories WHERE subject_id=$1 AND name=$2',[sbId,name]); if(r) throw new Error('exists'); await run('INSERT INTO categories(subject_id,name) VALUES($1,$2)',[sbId,name]); cacheClear('cats_raw_'+sbId); };
const renameCategory = async (id,name) => { await run('UPDATE categories SET name=$1 WHERE id=$2',[name,id]); cacheClear('cat_'+id); cacheClearPrefix('cats_raw_'); cacheClearPrefix('path_'); cacheClearPrefix('showfiles_'); };
const deleteCategory = async id => { await run('UPDATE categories SET is_deleted=1 WHERE id=$1',[id]); cacheClear('cat_'+id); cacheClearPrefix('cats_raw_'); cacheClearPrefix('showfiles_'); cacheClearPrefix('path_'); };

module.exports = {
  getSpecs,getSpec,getYears,getYear,getSemesters,getSemester,getSubjects,getSubject,getCategories,getCategory,
  addSpec,renameSpec,deleteSpec,addYear,renameYear,deleteYear,
  addSemester,renameSemester,deleteSemester,addSubject,renameSubject,deleteSubject,
  addCategory,renameCategory,deleteCategory,
  invalidateSpec,invalidateYear,invalidateSem,invalidateSub,invalidateCat
};
