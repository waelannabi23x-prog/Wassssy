const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const filesDb = require('../database/files');
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

const SYSTEM = `أنت EduMaster — مساعد دراسي ذكي في بوت تيليغرام جزائري.
تساعد طلاب جامعيين من كل التخصصات: إعلاميات، طب، رياضيات، فيزياء، كيمياء، أدب...
قواعدك:
- تجاوب دائماً بنفس لغة الطالب (دارجة/فرنسي/عربي فصيح/إنجليزي)
- تشرح المفاهيم بطريقة بسيطة ومفهومة
- تصحح الأكواد البرمجية وتشرح الأخطاء
- تحل المسائل الرياضية والفيزيائية خطوة بخطوة
- تجاوب على أسئلة الطب والعلوم بدقة
- ردودك مختصرة ومفيدة
- لا تستخدم * أو _ أو أي markdown في ردودك
- كن ودياً ومشجعاً دائماً`;

async function handleAiChat(ctx, text) {
  if(!text || text.length < 2) return false;

  const uid = ctx.uid;

  // بحث في الملفات إذا طلب ملف
  const wantsFile = /ملف|cours|serie|td|tp|exam|solution|chapter|محاضرة|سلسلة|امتحان|حل pdf|عندك/i.test(text);
  let fileResults = [];
  if(wantsFile) {
    const q = text
      .replace(/الغوا|algorithmique/gi,'algo')
      .replace(/سيري|سلسلة/gi,'serie')
      .replace(/كور|محاضرة/gi,'cours')
      .replace(/امتحان/gi,'exam')
      .replace(/هل|عندك|يوجد|فيه|أبحث|بغيت|عطيني|ماذا|فل|في|هناك/gi,'')
      .replace(/\s+/g,' ').trim();
    fileResults = await filesDb.search(q, 5).catch(()=>[]);
    if(!fileResults.length) {
      const words = q.split(/\s+/).filter(w=>w.length>=2);
      const seen = new Map();
      for(const w of words){
        const wr = await filesDb.search(w,4).catch(()=>[]);
        for(const r of wr) if(!seen.has(r.id)) seen.set(r.id,r);
      }
      fileResults = [...seen.values()].slice(0,5);
    }
  }

  ctx.telegram.sendChatAction(ctx.chat.id,'typing').catch(()=>{});
  addMessage(uid,'user',text);

  const systemMsg = fileResults.length
    ? SYSTEM + '\n\nملفات موجودة في البوت:\n' + fileResults.map((f,i)=>`${i+1}. ${f.title} — ${f.sub_name}`).join('\n') + '\nأخبر الطالب أن هذه الملفات متاحة له.'
    : SYSTEM;

  try {
    const res = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemMsg },
        ...getHistory(uid)
      ],
      max_tokens: 700,
      temperature: 0.7
    });

    const reply = res.choices[0].message.content.trim();
    addMessage(uid,'assistant',reply);

    if(fileResults.length) {
      const rows = fileResults.map(f=>[btn('📄 '+f.title.substring(0,28)+' · '+f.sub_name,'preview_'+f.id+'_0_0_0_0_0')]);
      rows.push([btn('🔍 بحث','search_prompt'),btn('🏠','main_menu')]);
      await ctx.reply(reply, build(rows));
    } else {
      await ctx.reply(reply);
    }
    return true;
  } catch(e) {
    console.error('AI error:', e.message);
    await ctx.reply('عذراً، حدث خطأ. حاول مرة أخرى.').catch(()=>{});
    return true;
  }
}

module.exports = { handleAiChat, resetChat };
