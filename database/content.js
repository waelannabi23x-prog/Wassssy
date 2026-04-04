const { all, get, run } = require('./db');
const { cacheGet, cacheSet, cacheClear } = require('../utils/cache');

const getSpecs = async () => {
  const key = 'specs';
  const cached = cacheGet(key);
  if (cached) return cached;
  const result = await all('SELECT * FROM specialties WHERE is_deleted=0 ORDER BY name');
  cacheSet(key, result, 21600000);
  return result;
};

const getSpec = async id => {
  const key = 'spec_'+id;
  const cached = cacheGet(key);
  if (cached) return cached;
  const result = await get('SELECT * FROM specialties WHERE id=?', [id]);
  cacheSet(key, result, 21600000);
  return result;
};

const getYears = async spId => {
  const key = 'years_'+spId;
  const cached = cacheGet(key);
  if (cached) return cached;
  const result = await all('SELECT * FROM years WHERE specialty_id=? AND is_deleted=0 ORDER BY name', [spId]);
  cacheSet(key, result, 21600000);
  return result;
};

const getYear = async id => {
  const key = 'year_'+id;
  const cached = cacheGet(key);
  if (cached) return cached;
  const result = await get('SELECT * FROM years WHERE id=?', [id]);
  cacheSet(key, result, 21600000);
  return result;
};

const getSemesters = async yrId => {
  const key = 'sems_'+yrId;
  const cached = cacheGet(key);
  if (cached) return cached;
  const result = await all('SELECT * FROM semesters WHERE year_id=? AND is_deleted=0 ORDER BY name', [yrId]);
  cacheSet(key, result, 21600000);
  return result;
};

const getSemester = async id => {
  const key = 'sem_'+id;
  const cached = cacheGet(key);
  if (cached) return cached;
  const result = await get('SELECT * FROM semesters WHERE id=?', [id]);
  cacheSet(key, result, 21600000);
  return result;
};

const getSubjects = async smId => {
  const key = 'subs_'+smId;
  const cached = cacheGet(key);
  if (cached) return cached;
  const result = await all('SELECT * FROM subjects WHERE semester_id=? AND is_deleted=0 ORDER BY name', [smId]);
  cacheSet(key, result, 21600000);
  return result;
};

const getSubject = async id => {
  const key = 'sub_'+id;
  const cached = cacheGet(key);
  if (cached) return cached;
  const result = await get('SELECT * FROM subjects WHERE id=?', [id]);
  cacheSet(key, result, 21600000);
  return result;
};

const getCategories = async sbId => {
  const key = 'cats_'+sbId;
  const cached = cacheGet(key);
  if (cached) return cached;
  const result = await all('SELECT * FROM categories WHERE subject_id=? AND is_deleted=0 ORDER BY name', [sbId]);
  cacheSet(key, result, 21600000);
  return result;
};

const getCategory = async id => {
  const key = 'cat_'+id;
  const cached = cacheGet(key);
  if (cached) return cached;
  const result = await get('SELECT * FROM categories WHERE id=?', [id]);
  cacheSet(key, result, 21600000);
  return result;
};

const addSpec = async (name) => {
  if (await get('SELECT 1 FROM specialties WHERE name=? AND is_deleted=0', [name])) throw new Error('exists');
  await run('INSERT INTO specialties(name) VALUES(?)', [name]);
  cacheClear('spec');cacheClear('specs');
};

const renameSpec = async (id, name) => {
  await run('UPDATE specialties SET name=? WHERE id=?', [name, id]);
  cacheClear('spec');
};

const deleteSpec = async id => {
  await run('UPDATE specialties SET is_deleted=1 WHERE id=?', [id]);
  cacheClear('spec');
};

const addYear = async (spId, name) => {
  await run('INSERT INTO years(specialty_id,name) VALUES(?,?)', [spId, name]);
  cacheClear('year');
};

const renameYear = async (id, name) => {
  await run('UPDATE years SET name=? WHERE id=?', [name, id]);
  cacheClear('year');
};

const deleteYear = async id => {
  await run('UPDATE years SET is_deleted=1 WHERE id=?', [id]);
  cacheClear('year');
};

const addSemester = async (yrId, name) => {
  await run('INSERT INTO semesters(year_id,name) VALUES(?,?)', [yrId, name]);
  cacheClear('sem');
};

const renameSemester = async (id, name) => {
  await run('UPDATE semesters SET name=? WHERE id=?', [name, id]);
  cacheClear('sem');
};

const deleteSemester = async id => {
  await run('UPDATE semesters SET is_deleted=1 WHERE id=?', [id]);
  cacheClear('sem');
};

const addSubject = async (smId, name) => {
  await run('INSERT INTO subjects(semester_id,name) VALUES(?,?)', [smId, name]);
  cacheClear('sub');
};

const renameSubject = async (id, name) => {
  await run('UPDATE subjects SET name=? WHERE id=?', [name, id]);
  cacheClear('sub');
};

const deleteSubject = async id => {
  await run('UPDATE subjects SET is_deleted=1 WHERE id=?', [id]);
  cacheClear('sub');
};

const addCategory = async (sbId, name) => {
  await run('INSERT INTO categories(subject_id,name) VALUES(?,?)', [sbId, name]);
  cacheClear('cat');
};

const renameCategory = async (id, name) => {
  await run('UPDATE categories SET name=? WHERE id=?', [name, id]);
  cacheClear('cat');
};

const deleteCategory = async id => {
  await run('UPDATE categories SET is_deleted=1 WHERE id=?', [id]);
  cacheClear('cat');
};

module.exports = { getSpecs,getSpec,addSpec,renameSpec,deleteSpec,getYears,getYear,addYear,renameYear,deleteYear,getSemesters,getSemester,addSemester,renameSemester,deleteSemester,getSubjects,getSubject,addSubject,renameSubject,deleteSubject,getCategories,getCategory,addCategory,renameCategory,deleteCategory };
