const { all } = require('../database/db');
const { cacheGet, cacheSet } = require('./cache');

async function getBotKnowledge() {
  const cacheKey = 'ai_knowledge_base_v2';
  const cached = cacheGet(cacheKey);
  if(cached) return cached;

  try {
    const [specs, subjects, categories, totalFiles] = await Promise.all([
      all('SELECT name FROM specialties WHERE is_deleted=0'),
      all('SELECT s.name, sp.name as spec FROM subjects s JOIN semesters sm ON s.semester_id=sm.id JOIN years y ON sm.year_id=y.id JOIN specialties sp ON y.specialty_id=sp.id WHERE s.is_deleted=0'),
      all('SELECT DISTINCT name FROM categories WHERE is_deleted=0'),
      all('SELECT COUNT(*) as c FROM files WHERE is_deleted=0').then(r => r[0]?.c || 0)
    ]);

    let knowledge = `SYSTEM KNOWLEDGE (Total Files: ${totalFiles})\n\n`;
    
    knowledge += `SPECIALTIES:\n${specs.map(s => s.name).join(', ')}\n\n`;
    
    // Group subjects by specialty to save tokens
    const specMap = {};
    for(const s of subjects) {
      if(!specMap[s.spec]) specMap[s.spec] = [];
      if(specMap[s.spec].length < 15) specMap[s.spec].push(s.name); // Limit per spec to avoid bloat
    }
    
    knowledge += `SUBJECTS BY SPECIALTY:\n`;
    for(const spec in specMap) {
      knowledge += `- [${spec}]: ${specMap[spec].join(', ')}\n`;
    }

    knowledge += `\nFILE TYPES (CATEGORIES):\n${categories.map(c => c.name).join(', ')}`;

    // cache for 30 mins as this doesn't change often
    cacheSet(cacheKey, knowledge, 1800000);
    return knowledge;
  } catch(e) {
    console.error('Knowledge base error:', e.message);
    return 'University academic files (cours, TD, exams, solutions).';
  }
}

module.exports = { getBotKnowledge };
