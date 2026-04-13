const { groqChat } = require('../utils/groq_client');
const { getBotKnowledge } = require('../utils/ai_knowledge');
const filesDb = require('../database/files');
const { all } = require('../database/db');
const { build, btn } = require('../utils/keyboard');

const { all: dbAll, run: dbRun } = require('../database/db');

async function getHistory(uid) {
  try {
    const rows = await dbAll(
      'SELECT role, content FROM ai_history WHERE user_id=$1 ORDER BY created_at DESC LIMIT 12',
      [uid]
    );
    return rows.reverse();
  } catch(e) { return []; }
}

async function addMessage(uid, role, content) {
  try {
    await dbRun(
      'INSERT INTO ai_history(user_id, role, content) VALUES($1, $2, $3)',
      [uid, role, content]
    );
    // احتفظ بآخر 12 رسالة فقط
    await dbRun(
      'DELETE FROM ai_history WHERE user_id=$1 AND id NOT IN (SELECT id FROM ai_history WHERE user_id=$1 ORDER BY created_at DESC LIMIT 12)',
      [uid]
    );
  } catch(e) {}
}

async function resetChat(uid) {
  try { await dbRun('DELETE FROM ai_history WHERE user_id=$1', [uid]); } catch(e) {}
}

// بحث ذكي متعدد المراحل
async function smartSearch(query) {
  const cleaned = query
    .replace(/الغوا|الغوارزميات|algorithmique|algorithme/gi,'algo')
    .replace(/سيري|سلسلة تمارين/gi,'serie')
    .replace(/كور|محاضرة/gi,'cours')
    .replace(/امتحان|اختبار|examen/gi,'exam')
    .replace(/حل|correction|corrigé/gi,'solution')
    .replace(/هل|عندك|كاين|فيه|واش|وش|عندكم|يوجد|بغيت|عطيني|اعطيني/gi,'')
    .replace(/\s+/g,' ').trim();

  if(!cleaned || cleaned.length < 2) return [];

  let results = await filesDb.search(cleaned, 8);
  if(results.length >= 3) return results;

  const words = cleaned.split(/\s+/).filter(w=>w.length>=2);
  if(words.length > 1) {
    const sets = await Promise.all(words.map(w=>filesDb.search(w,15)));
    const score = new Map();
    for(const s of sets) for(const f of s) score.set(f.id,(score.get(f.id)||0)+1);
    const all_r = sets.flat().filter((f,i,a)=>a.findIndex(x=>x.id===f.id)===i);
    results = all_r.sort((a,b)=>(score.get(b.id)||0)-(score.get(a.id)||0)).slice(0,8);
  }
  return results;
}

function isFileRequest(text) {
  return /\b(cours|serie|td|tp|exam|examen|solution|corrigé|chapter|chapitre|pdf|ملف|محاضرة|سلسلة|امتحان|حل|تمارين|كاين|عندك|واش فيه|وش عندك|هل عندك|هل يوجد|عندكم)\b/i.test(text);
}

const SYSTEM = `You are EduMaster — an expert academic assistant embedded in a Telegram bot for Algerian university students.

IDENTITY & CONTEXT:
- You serve students from ALL university specialties: CS, Medicine, Mathematics, Physics, Chemistry, Law, Economics, Literature, etc.
- You are deployed inside an educational file-sharing bot
- Students communicate in Algerian Darija, French, Arabic, or mixed languages
- Always respond in the EXACT same language/mix the student uses

ACADEMIC KNOWLEDGE:
- Computer Science: algorithms, data structures (linked lists, trees, graphs, stacks, queues), OOP, OS, networks, databases, programming (C, Java, Python, etc.)
- Mathematics: analysis, algebra, probability, statistics, linear algebra
- Physics & Chemistry: all university-level topics
- Medicine: anatomy, biochemistry, pharmacology, etc.
- ALWAYS interpret technical terms in their ACADEMIC context first (e.g., "file" = file d'attente/queue, "liste" = linked list, "arbre" = tree data structure)

RESPONSE RULES:
1. Adapt your response length to the question complexity — simple questions get short answers, medical/technical/detailed questions get FULL comprehensive answers like a real expert would give. Never cut corners on important academic content.
2. ABSOLUTELY NEVER use *, **, _, __, #, or any markdown symbols. This is critical — the chat renders plain text only. Use numbers and indentation instead of bullets.
3. For code: write it cleanly without markdown backticks
4. For math: use simple notation (x^2, sqrt(), integral)
5. If unsure about something: say so honestly and briefly
6. Never hallucinate facts — if you don't know, say so
7. Be warm and encouraging like a smart study buddy

CONVERSATION MEMORY:
- Remember what was discussed earlier in this conversation
- If the student refers to "it" or "this" or continues a previous topic, understand the context
- Build on previous answers naturally

FILE SYSTEM KNOWLEDGE:
- This bot contains university files (cours, TD, séries, exams, solutions)
- When files are found, mention them enthusiastically but briefly
- When no files found, be honest and suggest alternative search terms`;

async function handleAiChat(ctx, text) {
  if(!text || text.length < 2) return false;
  const uid = ctx.uid;
  
  // جلب تخصص المستخدم
  let userSpecialty = '';
  try {
    const { all } = require('../database/db');
    const sp = await all('SELECT sp.name, y.name as yr FROM user_specialties us LEFT JOIN specialties sp ON us.specialty_id=sp.id LEFT JOIN years y ON y.specialty_id=sp.id WHERE us.user_id=$1 LIMIT 1',[uid]);
    if(sp[0]?.name) userSpecialty = sp[0].name;
  } catch(e) {}
  // Safety — رفض الطلبات غير الدراسية
  const nonAcademic = /اكتب قصيدة|اكتب أغنية|write a poem|generate image|صور لي|مين أحسن لاعب|كرة القدم|سياسة|politique(?!.*cours)/i;
  if(nonAcademic.test(text) && !text.includes('?')) {
    await ctx.reply('أنا مساعد دراسي متخصص — يمكنني مساعدتك في المواد الدراسية والأسئلة الأكاديمية فقط 🎓');
    return true;
  }
  ctx.telegram.sendChatAction(ctx.chat.id, 'typing').catch(()=>{});

  let fileResults = [];
  let fileContext = '';

  if(isFileRequest(text)) {
    fileResults = await smartSearch(text);
    if(fileResults.length) {
      fileContext = `\n\nFILES FOUND IN BOT (${fileResults.length} results):\n` +
        fileResults.map((f,i)=>`${i+1}. "${f.title}" — ${f.sub_name} [${f.cat_name}]`).join('\n') +
        '\nMention these files are available and the student can access them via the buttons below.';
    } else {
      fileContext = '\n\nNO FILES FOUND for this search. Tell the student honestly in their language, suggest they try different keywords or browse manually.';
    }
  }

  addMessage(uid, 'user', text);

  try {
    const knowledge = await getBotKnowledge();
    const knowledgeCtx = knowledge ? `\n\n=== WHAT THIS BOT CONTAINS ===\n${knowledge}\nIMPORTANT: When students ask what files are available, what subjects exist, or what you have — answer from this knowledge base accurately. This is YOUR unique advantage over other AI assistants.` : '';
    const specialtyCtx = userSpecialty ? `

STUDENT PROFILE: This student studies ${userSpecialty}. Tailor your responses to their specialty when relevant.` : '';
    const history = await getHistory(uid);
    const reply = await groqChat([
      { role: 'system', content: SYSTEM + specialtyCtx + knowledgeCtx + fileContext },
      ...history
    ], 1200, 0.65);

    addMessage(uid, 'assistant', reply);

    // Streaming typewriter effect
    const sent = await ctx.reply('...').catch(()=>null);
    if(sent) {
      try {
        await ctx.telegram.editMessageText(ctx.chat.id, sent.message_id, null, reply);
      } catch(e) {
        await ctx.reply(reply).catch(()=>{});
      }
    } else {
      await ctx.reply(reply).catch(()=>{});
    }
    if(fileResults.length) {
      const rows = fileResults.slice(0,5).map(f=>[
        btn('📄 '+f.title.substring(0,28)+' · '+f.sub_name, 'preview_'+f.id+'_0_0_0_0_0')
      ]);
      rows.push([btn('🔍 بحث يدوي','search_prompt'),btn('🏠','main_menu')]);
      await ctx.reply('👆 الملفات المتاحة:', build(rows)).catch(()=>{});
    }
    return true;
  } catch(e) {
    console.error('AI error:', e.message);
    await ctx.reply('حدث خطأ مؤقت، حاول مرة أخرى.').catch(()=>{});
    return true;
  }
}

module.exports = { handleAiChat, resetChat };
