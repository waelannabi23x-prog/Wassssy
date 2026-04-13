const { groqChat } = require('../utils/groq_client');
const filesDb = require('../database/files');
const { all: dbAll, run: dbRun } = require('../database/db');
const { getBotKnowledge } = require('../utils/ai_knowledge');
const { build, btn } = require('../utils/keyboard');

async function getHistory(uid) {
  try {
    const rows = await dbAll('SELECT role, content FROM ai_history WHERE user_id=$1 ORDER BY created_at DESC LIMIT 8',[uid]);
    return rows.reverse();
  } catch(e) { return []; }
}

async function addMessage(uid, role, content) {
  try {
    await dbRun('INSERT INTO ai_history(user_id, role, content) VALUES($1, $2, $3)',[uid, role, content.substring(0,2000)]);
    await dbRun('DELETE FROM ai_history WHERE user_id=$1 AND id NOT IN (SELECT id FROM ai_history WHERE user_id=$1 ORDER BY created_at DESC LIMIT 8)',[uid]);
  } catch(e) {}
}

async function resetChat(uid) {
  try { await dbRun('DELETE FROM ai_history WHERE user_id=$1',[uid]); } catch(e) {}
}

async function smartSearch(query) {
  // Normalize query for better matching
  let cleaned = query
    .toLowerCase()
    .replace(/[àáâãäå]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/سيري|سلسلة|exercices|exercises/gi, 'serie')
    .replace(/كور|محاضرة|cours magistral|cours/gi, 'cours')
    .replace(/امتحان|اختبار|examen|exam/gi, 'exam')
    .replace(/حل|correction|corrigé|solution/gi, 'solution')
    .replace(/تلخيص|ملخص|resume|summary/gi, 'resume')
    .trim();

  if(!cleaned || cleaned.length < 2) return [];

  // 1. Fuzzy search with trigrams (leveraging the new search in files.js)
  let results = await filesDb.search(cleaned, 12);
  if(results.length >= 2) return results;

  // 2. Multi-word intersection fallback
  const words = cleaned.split(/\s+/).filter(w => w.length >= 3);
  if(words.length > 1) {
    const multiSearch = await filesDb.search(words.join(' '), 10);
    if(multiSearch.length) return multiSearch;
  }
  
  return results;
}

// Extract search keywords from the AI
async function extractSearchTerms(text, knowledge) {
  const prompt = `You are an expert academic file locator for Algerian University students.
Extract the most relevant search keywords from the user's request.
Context:
- Types: cours, serie, exam, solution, resume.
- User might use Darija (e.g., "بغيت", "كاين"), French, or Arabic.

Knowledge base summary:
${knowledge.substring(0, 1000)}

User request: "${text}"

Return ONLY JSON: {"terms": ["keyword1", "keyword2"], "subject": "Canonical Subject Name if found", "type": "file type if specified"}
Examples:
- "سيري الغوا 2" -> {"terms": ["serie", "algo 2"], "subject": "Algorithmique 2", "type": "serie"}
- "cours analyse" -> {"terms": ["cours", "analyse"], "subject": "Analyse 1", "type": "cours"}`;

  try {
    const raw = await groqChat([{role:'user', content:prompt}], 150, 0.1);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON');
    const parsed = JSON.parse(match[0]);
    
    // If subject was found but terms are poor, use subject as a term
    if (parsed.subject && (!parsed.terms || parsed.terms.length === 0)) {
        parsed.terms = [parsed.subject];
    }
    return parsed;
  } catch(e) {
    return {terms: [text], subject: null};
  }
}

async function handleAiChat(ctx, text) {
  if(!text || text.length < 2) return false;
  const uid = ctx.uid;
  ctx.telegram.sendChatAction(ctx.chat.id, 'typing').catch(()=>{});

  const knowledge = await getBotKnowledge();

  // استخرج كلمات البحث
  const extracted = await extractSearchTerms(text, knowledge);
  const searchQuery = extracted.terms.join(' ');

  // بحث ذكي
  let results = await smartSearch(searchQuery);

  // إذا ما لقى — جرب بالمادة مباشرة
  if(!results.length && extracted.subject) {
    results = await smartSearch(extracted.subject);
  }

  addMessage(uid, 'user', text);

  if(results.length) {
    // رد بسيط + أزرار
    const reply = results.length === 1
      ? `وجدت ملف واحد لـ "${searchQuery}":`
      : `وجدت ${results.length} ملف لـ "${searchQuery}":`;

    const rows = results.slice(0,6).map(f=>[
      btn('📄 '+f.title.substring(0,30)+' · '+f.sub_name, 'preview_'+f.id+'_0_0_0_0_0')
    ]);
    rows.push([btn('🔍 بحث يدوي','search_prompt'), btn('🏠','main_menu')]);
    addMessage(uid, 'assistant', reply);
    await ctx.reply(reply, build(rows));
  } else {
    // ما لقى — جواب ذكي
    const systemMsg = `You are a file search assistant for an Algerian university bot. 
A student searched for files but nothing was found.
Bot content: ${knowledge.substring(0,800)}
Student searched for: "${text}"
Reply in the same language as the student (Darija/French/Arabic).
In 1-2 lines: say what's not found, suggest what IS available that's close.
Be direct and helpful. No markdown.`;
    try {
      const reply = await groqChat([
        {role:'system', content: systemMsg},
        ...await getHistory(uid)
      ], 200, 0.5);
      addMessage(uid, 'assistant', reply);
      await ctx.reply(reply, build([[btn('🔍 بحث يدوي','search_prompt'), btn('🏠','main_menu')]]));
    } catch(e) {
      await ctx.reply('ما لقيت نتائج. جرب /search أو تصفح المحتوى.');
    }
  }
  return true;
}

module.exports = { handleAiChat, resetChat };
