const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const filesDb = require('../database/files');
const { build, btn } = require('../utils/keyboard');
const escMd = t => (t||'').replace(/[*_`\[\]()~>#+=|{}.!\-]/g,'\\$&');
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// حفظ سياق المحادثة لكل مستخدم (آخر 6 رسائل)
const _convHistory = new Map();
function getHistory(uid) {
  return _convHistory.get(uid) || [];
}
function addToHistory(uid, role, content) {
  const hist = getHistory(uid);
  hist.push({ role, content });
  if(hist.length > 6) hist.splice(0, hist.length - 6);
  _convHistory.set(uid, hist);
}
function clearHistory(uid) {
  _convHistory.delete(uid);
}

// هل السؤال يحتاج بحث في DB؟
async function needsFileSearch(msg) {
  const fileKeywords = /ملف|كتاب|cours|serie|td|tp|exam|solution|chapter|محاضرة|سلسلة|امتحان|حل|pdf/i;
  return fileKeywords.test(msg);
}

async function searchFiles(query) {
  const q = query
    .replace(/الغوا|algorithmique/gi, 'algo')
    .replace(/سيري|سلسلة/gi, 'serie')
    .replace(/كور|محاضرة/gi, 'cours')
    .replace(/امتحان/gi, 'exam')
    .replace(/هل|عندك|يوجد|فيه|أبحث|بغيت|عطيني|ماذا|فل|في|هناك/gi, '')
    .replace(/\s+/g, ' ').trim();
  
  let results = await filesDb.search(q, 6);
  if(!results.length) {
    const words = q.split(/\s+/).filter(w=>w.length>=2);
    const seen = new Map();
    for(const w of words) {
      const wr = await filesDb.search(w, 5);
      for(const r of wr) if(!seen.has(r.id)) seen.set(r.id, r);
    }
    results = [...seen.values()].slice(0, 6);
  }
  return results;
}

async function handleAiChat(ctx, text) {
  if(ctx.chat?.type !== 'private') return false;
  if(text.length < 2) return false;

  const uid = ctx.uid;
  ctx.telegram.sendChatAction(ctx.chat.id, 'typing').catch(()=>{});

  // هل يحتاج بحث في DB؟
  const searchNeeded = await needsFileSearch(text);
  let fileContext = '';
  let fileResults = [];

  if(searchNeeded) {
    fileResults = await searchFiles(text);
    if(fileResults.length) {
      fileContext = '\n\nملفات متاحة في البوت:\n' + 
        fileResults.map((f,i) => `${i+1}. ${f.title} (${f.sub_name})`).join('\n');
    }
  }

  // بناء الرسالة للـ AI
  const systemPrompt = `أنت مساعد دراسي ذكي اسمك EduMaster في بوت تيليغرام تعليمي جزائري.
تساعد الطلاب الجزائريين في جميع التخصصات الجامعية.
قواعد مهمة:
- تجاوب بنفس لغة الطالب (عربي/فرنسي/دارجة/إنجليزي)
- إذا سألك عن ملف وعندك نتائج — أخبره إن الملفات متاحة
- إذا سألك سؤال دراسي — اشرح بشكل واضح ومبسط
- إذا طلب تصحيح كود — صحح وفسر الخطأ
- كن ودياً ومشجعاً
- الردود تكون مختصرة ومفيدة (مش طويلة جداً)
- إذا السؤال خارج نطاق الدراسة — قل بلطف إنك متخصص في المواد الدراسية${fileContext}`;

  addToHistory(uid, 'user', text);

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...getHistory(uid)
    ];

    const res = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      max_tokens: 600,
      temperature: 0.7
    });

    const reply = res.choices[0].message.content.trim();
    addToHistory(uid, 'assistant', reply);

    // إذا فيه ملفات — أضف أزرار
    if(fileResults.length) {
      const rows = fileResults.map(f => [
        btn('📄 '+f.title.substring(0,30)+' · '+f.sub_name, 'preview_'+f.id+'_0_0_0_0_0')
      ]);
      rows.push([btn('🔍 بحث جديد','search_prompt'), btn('🏠','main_menu')]);
      await ctx.reply(reply, build(rows)).catch(async ()=>{
        await ctx.reply(reply);
      });
    } else {
      await ctx.reply(reply).catch(async ()=>{
        await ctx.reply(reply);
      });
    }
    return true;
  } catch(e) {
    console.error('AI chat error:', e.message);
    return false;
  }
}

// مسح سياق المحادثة
function resetChat(uid) {
  clearHistory(uid);
}

module.exports = { handleAiChat, resetChat };
