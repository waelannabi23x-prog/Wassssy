const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const filesDb = require('../database/files');
const { all } = require('../database/db');
const { build, btn } = require('../utils/keyboard');
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const _history = new Map();
function getHistory(uid) { return _history.get(uid) || []; }
function addMessage(uid, role, content) {
  const h = getHistory(uid);
  h.push({ role, content });
  if(h.length > 10) h.splice(0, h.length - 10);
  _history.set(uid, h);
}
function resetChat(uid) { _history.delete(uid); }

// استخرج كلمات البحث من السؤال
async function extractQuery(text) {
  const prompt = `Extract file search keywords from this student message.
Message: "${text}"
Rules:
- "الغوا/algo/algorithmique" → "algo"
- "سيري/serie/سلسلة" → "serie"
- "كور/cours/محاضرة" → "cours"
- "امتحان/exam/examen" → "exam"
- "حل/solution/correction" → "solution"
- Keep numbers as-is
- Remove question words (هل,عندك,كاين,فيه,واش,وش)
Return ONLY JSON: {"query": "keywords", "is_file_request": true/false}`;
  try {
    const res = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 60, temperature: 0.1
    });
    return JSON.parse(res.choices[0].message.content.trim().replace(/```json|```/g,''));
  } catch(e) {
    return { query: text, is_file_request: false };
  }
}

// بحث ذكي متعدد المراحل
async function smartSearch(query) {
  // مرحلة 1 — بحث مباشر
  let results = await filesDb.search(query, 8);
  if(results.length >= 3) return results;

  // مرحلة 2 — بحث بكل كلمة وتقاطع
  const words = query.split(/\s+/).filter(w => w.length >= 2);
  if(words.length > 1) {
    const sets = await Promise.all(words.map(w => filesDb.search(w, 20)));
    const intersection = sets[0].filter(f => sets.every(s => s.find(x => x.id === f.id)));
    if(intersection.length) return intersection.slice(0, 8);
    // union مرتب
    const score = new Map();
    for(const s of sets) for(const f of s) score.set(f.id, (score.get(f.id)||0)+1);
    const all_r = sets.flat().filter((f,i,a) => a.findIndex(x=>x.id===f.id)===i);
    results = all_r.sort((a,b) => (score.get(b.id)||0)-(score.get(a.id)||0)).slice(0, 8);
  }
  return results;
}

// هل الرسالة طلب ملف؟
function isFileRequest(text) {
  return /ملف|cours|serie|td|tp|exam|solution|chapter|محاضرة|سلسلة|امتحان|حل|pdf|كاين|عندك|واش|وش|هل فيه|هل عندك|عندكم/i.test(text);
}

const SYSTEM = `أنت EduMaster — مساعد دراسي ذكي وودود في بوت تعليمي جزائري.
تساعد طلاب جامعيين من كل التخصصات.
شخصيتك: ذكي، ودود، مشجع، تتكلم بنفس لغة الطالب (دارجة/فرنسي/عربي/إنجليزي).
قواعد:
- لا تستخدم * أو _ أو أي markdown
- ردودك مختصرة وواضحة
- إذا وجدت ملفات أخبر الطالب بحماس
- إذا ما وجدت ملفات كن صادقاً ومشجعاً
- تشرح المفاهيم بطريقة بسيطة
- تصحح الأكواد وتشرح الأخطاء
- تحل المسائل خطوة بخطوة`;

async function handleAiChat(ctx, text) {
  if(!text || text.length < 2) return false;
  const uid = ctx.uid;

  ctx.telegram.sendChatAction(ctx.chat.id, 'typing').catch(()=>{});

  let fileResults = [];
  let fileContext = '';

  // بحث في الملفات
  if(isFileRequest(text)) {
    const extracted = await extractQuery(text);
    if(extracted.query && extracted.query.length >= 2) {
      fileResults = await smartSearch(extracted.query);
    }
    if(fileResults.length) {
      fileContext = `\nملفات موجودة في البوت (${fileResults.length} نتيجة):\n` +
        fileResults.map((f,i) => `${i+1}. "${f.title}" — ${f.sub_name} (${f.cat_name})`).join('\n') +
        '\nأخبر الطالب بحماس أن هذه الملفات موجودة وأضف أزرار للوصول إليها.';
    } else if(extracted.is_file_request) {
      fileContext = '\nلا توجد ملفات مطابقة في البوت. أخبر الطالب بلطف وشجعه على البحث بكلمات أخرى.';
    }
  }

  addMessage(uid, 'user', text);

  const systemMsg = SYSTEM + fileContext;

  try {
    const res = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemMsg },
        ...getHistory(uid)
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const reply = res.choices[0].message.content.trim();
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
