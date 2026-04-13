const { all } = require('../database/db');
const { cacheGet, cacheSet } = require('./cache');

async function getBotKnowledge() {
  const cacheKey = 'ai_knowledge_base';
  const cached = cacheGet(cacheKey);
  if(cached) return cached;

  try {
    // جلب كل الهيكل الكامل
    const [specs, subjects, categories, recentFiles, topFiles, totalFiles] = await Promise.all([
      all('SELECT sp.id, sp.name, COUNT(DISTINCT y.id) as years_count FROM specialties sp LEFT JOIN years y ON y.specialty_id=sp.id WHERE sp.is_deleted=0 GROUP BY sp.id, sp.name'),
      all('SELECT s.id, s.name, sp.name as specialty, y.name as year, sm.name as semester, COUNT(DISTINCT c.id) as cat_count FROM subjects s JOIN semesters sm ON s.semester_id=sm.id JOIN years y ON sm.year_id=y.id JOIN specialties sp ON y.specialty_id=sp.id LEFT JOIN categories c ON c.subject_id=s.id WHERE s.is_deleted=0 GROUP BY s.id, s.name, sp.name, y.name, sm.name ORDER BY sp.name, y.name'),
      all('SELECT DISTINCT c.name FROM categories c JOIN subjects s ON c.subject_id=s.id WHERE s.is_deleted=0 ORDER BY c.name'),
      all('SELECT f.title, s.name as subject, c.name as category FROM files f JOIN categories c ON f.category_id=c.id JOIN subjects s ON c.subject_id=s.id WHERE f.is_deleted=0 ORDER BY f.uploaded_at DESC LIMIT 10'),
      all('SELECT f.title, s.name as subject, f.downloads FROM files f JOIN categories c ON f.category_id=c.id JOIN subjects s ON c.subject_id=s.id WHERE f.is_deleted=0 ORDER BY f.downloads DESC LIMIT 10'),
      all('SELECT COUNT(*) as c FROM files WHERE is_deleted=0').then(r => r[0]?.c || 0)
    ]);

    // بناء knowledge base نصي
    let knowledge = `=== BOT CONTENT KNOWLEDGE BASE ===\n`;
    knowledge += `Total files: ${totalFiles}\n\n`;

    knowledge += `SPECIALTIES (${specs.length}):\n`;
    for(const sp of specs) {
      knowledge += `- ${sp.name} (${sp.years_count} years)\n`;
    }

    knowledge += `\nSUBJECTS BY SPECIALTY:\n`;
    let currentSpec = '';
    for(const s of subjects) {
      if(s.specialty !== currentSpec) {
        currentSpec = s.specialty;
        knowledge += `\n[${currentSpec}]\n`;
      }
      knowledge += `  ${s.year} > ${s.semester} > ${s.name} (${s.cat_count} categories)\n`;
    }

    knowledge += `\nFILE CATEGORIES AVAILABLE:\n`;
    knowledge += categories.map(c => c.name).join(', ') + '\n';

    knowledge += `\nRECENTLY ADDED FILES:\n`;
    for(const f of recentFiles) {
      knowledge += `- "${f.title}" [${f.subject} / ${f.category}]\n`;
    }

    knowledge += `\nMOST DOWNLOADED FILES:\n`;
    for(const f of topFiles) {
      knowledge += `- "${f.title}" [${f.subject}] (${f.downloads} downloads)\n`;
    }

    // cache لمدة 10 دقائق
    cacheSet(cacheKey, knowledge, 600000);
    return knowledge;
  } catch(e) {
    console.error('Knowledge base error:', e.message);
    return '';
  }
}

module.exports = { getBotKnowledge };
