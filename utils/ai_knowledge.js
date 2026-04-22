'use strict';
const { all, get } = require('../database/db');
const { cacheGet, cacheSet } = require('./cache');

// ── معرفة البوت الكاملة للـ AI ──────────────────────────────────
async function getBotKnowledge() {
  const key = 'ai_knowledge_v3';
  const cached = cacheGet(key);
  if (cached) return cached;

  try {
    const [specs, subjects, cats, totalFiles, topFiles] = await Promise.all([
      all('SELECT name FROM specialties WHERE is_deleted=0'),
      all(`SELECT s.name as sub, sp.name as spec
           FROM subjects s
           JOIN semesters sm ON s.semester_id=sm.id
           JOIN years y ON sm.year_id=y.id
           JOIN specialties sp ON y.specialty_id=sp.id
           WHERE s.is_deleted=0 LIMIT 150`),
      all('SELECT DISTINCT name FROM categories WHERE is_deleted=0'),
      get('SELECT COUNT(*) as c FROM files WHERE is_deleted=0').then(r => r ? r.c : 0),
      all('SELECT f.title, s.name as sub_name FROM files f JOIN categories c ON f.category_id=c.id JOIN subjects s ON c.subject_id=s.id WHERE f.is_deleted=0 ORDER BY f.downloads DESC LIMIT 10')
    ]);

    const specMap = {};
    for (const s of subjects) {
      if (!specMap[s.spec]) specMap[s.spec] = [];
      if (specMap[s.spec].length < 20) specMap[s.spec].push(s.sub);
    }

    let k = 'إجمالي الملفات: ' + totalFiles + '\n';
    k += 'التخصصات: ' + specs.map(s => s.name).join(', ') + '\n\n';
    k += 'المواد حسب التخصص:\n';
    for (const sp in specMap) k += '• ' + sp + ': ' + specMap[sp].join(', ') + '\n';
    k += '\nأنواع الملفات: ' + cats.map(c => c.name).join(', ') + '\n';
    if (topFiles.length) k += '\nأكثر الملفات تحميلاً: ' + topFiles.map(f => f.title).join(', ');

    cacheSet(key, k, 1800000);
    return k;
  } catch(e) {
    return 'منصة جامعية جزائرية — ملفات دراسية (كورسات، TD، امتحانات).';
  }
}

// ── context خاص (إحصائيات) ──────────────────────────────────────
async function getSmartContext(type) {
  if (type === 'stats') {
    const key = 'ai_stats_ctx';
    const cached = cacheGet(key);
    if (cached) return cached;
    try {
      const [files, users, downloads] = await Promise.all([
        get('SELECT COUNT(*) as c FROM files WHERE is_deleted=0'),
        get('SELECT COUNT(*) as c FROM users'),
        get('SELECT COALESCE(SUM(downloads),0) as c FROM files WHERE is_deleted=0'),
      ]);
      const txt = '📊 إحصائيات المنصة:\n\n📄 الملفات: ' + (files?.c || 0) +
                  '\n👤 المستخدمين: ' + (users?.c || 0) +
                  '\n⬇️ إجمالي التحميلات: ' + (downloads?.c || 0);
      cacheSet(key, txt, 600000);
      return txt;
    } catch(e) { return null; }
  }
  return null;
}

module.exports = { getBotKnowledge, getSmartContext };
