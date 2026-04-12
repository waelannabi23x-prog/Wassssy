const { groqChat } = require('../utils/groq_client');
const filesDb = require('../database/files');
const { build, btn } = require('../utils/keyboard');

const _history = new Map();
function getHistory(uid) { return _history.get(uid) || []; }
function addMessage(uid, role, content) {
  const h = getHistory(uid);
  h.push({ role, content });
  if(h.length > 10) h.splice(0, h.length - 10);
  _history.set(uid, h);
}
function resetChat(uid) { _history.delete(uid); }

async function extractQuery(text) {
  const prompt = `Extract file search keywords from this student message.
Message: "${text}"
Rules:
- "الغوا/algo/algorithmique" → "algo"
- "سيري/serie/سلسلة" → "serie"
- "كور/cours/محاضرة" → "cours"
- "امتحان/exam" → "exam"
- "حل/solution/correction" → "solution"
- Keep numbers as-is
- Remove question words
Return ONLY JSON: {"query": "keywords", "is_file_request": true}`;
  try {
    const raw = await groqChat([{ role: 'user', content: prompt }], 60, 0.1);
    return JSON.parse(raw.replace(/```json|```/g,'').trim());
  } catch(e) {
    return { query: text, is_file_request: false };
  }
}

async function smartSearch(query) {
  let results = await filesDb.search(query, 8);
  if(results.length >= 3) return results;
  const words = query.split(/\s+/).filter(w => w.length >= 2);
  if(words.length > 1) {
    const sets = await Promise.all(words.map(w => filesDb.search(w, 20)));
    const intersection = sets[0].filter(f => sets.every(s => s.find(x => x.id === f.id)));
    if(intersection.length) return intersection.slice(0, 8);
    const score = new Map();
    for(const s of sets) for(const f of s) score.set(f.id, (score.get(f.id)||0)+1);
    const all_r = sets.flat().filter((f,i,a) => a.findIndex(x=>x.id===f.id)===i);
    results = all_r.sort((a,b) => (score.get(b.id)||0)-(score.get(a.id)||0)).slice(0, 8);
  }
  return results;
}

function isFileRequest(text) {
  return /ملف|cours|serie|td|tp|exam|solution|chapter|محاضرة|سلسلة|امتحان|حل|pdf|كاين|عندك|واش|وش|هل فيه|هل عندك|عندكم/i.test(text);
}

const SYSTEM = `You are EduMaster, a smart and friendly academic assistant inside a Telegram bot for Algerian university students.
You help students from ALL specialties: computer science, medicine, mathematics, physics, chemistry, law, literature, and more.

Your personality:
- Warm, encouraging, and direct — like a smart friend who knows everything
- You always respond in the SAME language the student uses (Algerian Darija, French, Arabic, or English)
- You naturally mix languages if the student does (e.g., Darija + French)

Strict rules:
- NEVER use markdown symbols like *, **, _, __, backtick, #
- NEVER use bullet points with * or - — use numbers or plain text instead
- Keep responses concise and clear — no unnecessary fluff
- For code: show it in plain text, explain errors clearly
- For math/physics: solve step by step
- For file requests: tell the student what's available with enthusiasm
- If no files found: be honest and encouraging, suggest alternative search terms
- For general questions: give accurate, helpful answers`;

async function handleAiChat(ctx, text) {
  if(!text || text.length < 2) return false;
  const uid = ctx.uid;
  ctx.telegram.sendChatAction(ctx.chat.id, 'typing').catch(()=>{});

  let fileResults = [];
  let fileContext = '';

  if(isFileRequest(text)) {
    const extracted = await extractQuery(text);
    if(extracted.query && extracted.query.length >= 2) {
      fileResults = await smartSearch(extracted.query);
    }
    if(fileResults.length) {
      fileContext = `\nملفات موجودة في البوت (${fileResults.length} نتيجة):\n` +
        fileResults.map((f,i) => `${i+1}. "${f.title}" — ${f.sub_name} (${f.cat_name})`).join('\n') +
        '\nأخبر الطالب بحماس أن هذه الملفات موجودة.';
    } else {
      fileContext = '\nلا توجد ملفات مطابقة. أخبر الطالب بلطف وشجعه على البحث بكلمات أخرى.';
    }
  }

  addMessage(uid, 'user', text);

  try {
    const reply = await groqChat([
      { role: 'system', content: SYSTEM + fileContext },
      ...getHistory(uid)
    ], 500, 0.7);

    addMessage(uid, 'assistant', reply);

    if(fileResults.length) {
      const rows = fileResults.slice(0,5).map(f => [
        btn('📄 '+f.title.substring(0,28)+' · '+f.sub_name, 'preview_'+f.id+'_0_0_0_0_0')
      ]);
      rows.push([btn('🔍 بحث يدوي','search_prompt'), btn('🏠','main_menu')]);
      await ctx.reply(reply, build(rows));
    } else {
      await ctx.reply(reply);
    }
    return true;
  } catch(e) {
    console.error('AI error:', e.message);
    await ctx.reply('عذراً، حدث خطأ مؤقت. حاول مرة أخرى.').catch(()=>{});
    return true;
  }
}

module.exports = { handleAiChat, resetChat };
