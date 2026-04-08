const { all, get, run } = require('./db');
const { cacheGet, cacheSet, cacheClear } = require('../utils/cache');

const TTL = 21600000; // 6 ساعات

const getSpecs = async () => { const k='specs'; const c=cacheGet(k); if(c) return c; const r=await all('SELECT * FROM specialties WHERE is_deleted=0 ORDER BY name'); cacheSet(k,r,TTL); return r; };
const getSpec = async id => { const k='spec_'+id; const c=cacheGet(k); if(c) return c; const r=await get('SELECT * FROM specialties WHERE id=?',[id]); if(r) cacheSet(k,r,TTL); return r; };
const getYears = async spId => { const k='years_'+spId; const c=cacheGet(k); if(c) return c; const r=await all('SELECT * FROM years WHERE specialty_id=? AND is_deleted=0 ORDER BY name',[spId]); cacheSet(k,r,TTL); return r; };
const getYear = async id => { const k='year_'+id; const c=cacheGet(k); if(c) return c; const r=await get('SELECT * FROM years WHERE id=?',[id]); if(r) cacheSet(k,r,TTL); return r; };
const getSemesters = async yrId => { const k='sems_'+yrId; const c=cacheGet(k); if(c) return c; const r=await all('SELECT * FROM semesters WHERE year_id=? AND is_deleted=0 ORDER BY name',[yrId]); cacheSet(k,r,TTL); return r; };
const getSemester = async id => { const k='sem_'+id; const c=cacheGet(k); if(c) return c; const r=await get('SELECT * FROM semesters WHERE id=?',[id]); if(r) cacheSet(k,r,TTL); return r; };
const getSubjects = async smId => { const k='subs_'+smId; const c=cacheGet(k); if(c) return c; const r=await all('SELECT * FROM subjects WHERE semester_id=? AND is_deleted=0 ORDER BY name',[smId]); cacheSet(k,r,TTL); return r; };
const getSubject = async id => { const k='sub_'+id; const c=cacheGet(k); if(c) return c; const r=await get('SELECT * FROM subjects WHERE id=?',[id]); if(r) cacheSet(k,r,TTL); return r; };
const getCategories = async sbId => { const k='cats_'+sbId; const c=cacheGet(k); if(c) return c; const r=await all('SELECT * FROM categories WHERE subject_id=? AND is_deleted=0 ORDER BY name',[sbId]); cacheSet(k,r,TTL); return r; };
const getCategory = async id => { const k='cat_'+id; const c=cacheGet(k); if(c) return c; const r=await get('SELECT * FROM categories WHERE id=?',[id]); if(r) cacheSet(k,r,TTL); return r; };

const addSpec = async name => { if(await get('SELECT 1 FROM specialties WHERE name=? AND is_deleted=0',[name])) throw new Error('exists'); await run('INSERT INTO specialties(name) VALUES(?)',[name]); cacheClear('spec'); cacheClear('specs'); };
const renameSpec = async (id,name) => { await run('UPDATE specialties SET name=? WHERE id=?',[name,id]); cacheClear('spec'); cacheClear('specs'); };
const deleteSpec = async id => { await run('UPDATE specialties SET is_deleted=1 WHERE id=?',[id]); cacheClear('spec'); cacheClear('specs'); };
const addYear = async (spId,name) => { await run('INSERT INTO years(specialty_id,name) VALUES(?,?)',[spId,name]); cacheClear('years_'+spId); };
const renameYear = async (id,name) => { await run('UPDATE years SET name=? WHERE id=?',[name,id]); cacheClear('year_'+id); };
const deleteYear = async id => { await run('UPDATE years SET is_deleted=1 WHERE id=?',[id]); cacheClear('year_'+id); };
const addSemester = async (yrId,name) => { await run('INSERT INTO semesters(year_id,name) VALUES(?,?)',[yrId,name]); cacheClear('sems_'+yrId); };
const renameSemester = async (id,name) => { await run('UPDATE semesters SET name=? WHERE id=?',[name,id]); cacheClear('sem_'+id); };
const deleteSemester = async id => { await run('UPDATE semesters SET is_deleted=1 WHERE id=?',[id]); cacheClear('sem_'+id); };
const addSubject = async (smId,name) => { await run('INSERT INTO subjects(semester_id,name) VALUES(?,?)',[smId,name]); cacheClear('subs_'+smId); };
const renameSubject = async (id,name) => { await run('UPDATE subjects SET name=? WHERE id=?',[name,id]); cacheClear('sub_'+id); };
const deleteSubject = async id => { await run('UPDATE subjects SET is_deleted=1 WHERE id=?',[id]); cacheClear('sub_'+id); };
const addCategory = async (sbId,name) => { await run('INSERT INTO categories(subject_id,name) VALUES(?,?)',[sbId,name]); cacheClear('cats_'+sbId); };
const renameCategory = async (id,name) => { await run('UPDATE categories SET name=? WHERE id=?',[name,id]); cacheClear('cat_'+id); };
const deleteCategory = async id => { await run('UPDATE categories SET is_deleted=1 WHERE id=?',[id]); cacheClear('cat_'+id); };

module.exports = { getSpecs,getSpec,addSpec,renameSpec,deleteSpec,getYears,getYear,addYear,renameYear,deleteYear,getSemesters,getSemester,addSemester,renameSemester,deleteSemester,getSubjects,getSubject,addSubject,renameSubject,deleteSubject,getCategories,getCategory,addCategory,renameCategory,deleteCategory };
