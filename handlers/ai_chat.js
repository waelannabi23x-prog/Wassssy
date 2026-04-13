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
  const cleaned = query
    .replace(/الغوا|الغوارزميات|algorithmique|algorithme/gi,'algo')
    .replace(/سيري|سلسلة|exercices/gi,'serie')
    .replace(/كور|محاضرة|cours magistral/gi,'cours')
    .replace(/امتحان|اختبار|examen/gi,'exam')
    .replace(/حل|correction|corrigé|solution/gi,'solution')
    .replace(/هل|عندك|كاين|فيه|واش|وش|عندكم|يوجد|بغيت|عطيني|اعطيني|اريد|أريد|جيبلي/gi,'')
    .replace(/\s+/g,' ').trim();

  if(!cleaned || cleaned.length < 2) return [];

  // مرحلة 1 — بحث مباشر
  let results = await filesDb.search(cleaned, 8);
  if(results.length >= 3) return results;

  // مرحلة 2 — بحث بكل كلمة + تقاطع
  const words = cleaned.split(/\s+/).filter(w=>w.length>=2);
  if(words.length > 1) {
    const sets = await Promise.all(words.map(w=>filesDb.search(w,15)));
    const intersection = sets[0].filter(f=>sets.every(s=>s.find(x=>x.id===f.id)));
    if(intersection.length) return intersection.slice(0,8);
    const score = new Map();
    for(const s of sets) for(const f of s) score.set(f.id,(score.get(f.id)||0)+1);
    const all_r = sets.flat().filter((f,i,a)=>a.findIndex(x=>x.id===f.id)===i);
    results = all_r.sort((a,b)=>(score.get(b.id)||0)-(score.get(a.id)||0)).slice(0,8);
  }
  return results;
}

// استخرج كلمات البحث من الـ AI
async function extractSearchTerms(text, knowledge) {
  const prompt = `You are a file search assistant. Extract search keywords from this request.
Bot content overview:
${knowledge.substring(0, 500)}

User request: "${text}"

Return ONLY JSON: {"terms": ["keyword1", "keyword2"], "subject": "subject name or null"}
Examples:
- "عندك سيري الغوا 2" → {"terms": ["serie", "algo 2"], "subject": "Algo 2"}
- "cours analyse 1 chapitre 3" → {"terms": ["cours", "analyse 1"], "subject": "Analyse 1"}
- "بغيت امتحانات proba" → {"terms": ["exam", "proba"], "subject": "Proba"}`;
  try {
    const raw = await groqChat([{role:'user',content:prompt}], 100, 0.1);
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {terms: [text], subject: null};
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
