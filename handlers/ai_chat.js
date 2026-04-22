'use strict';

const { aiChat } = require('../utils/groq_client');
const filesDb = require('../database/files');
const { smartSearch } = require('./group');
const { getBotKnowledge } = require('../utils/ai_knowledge');

// ══════════════════════════════════════
// 🛡️ Rate Limiter — 5 رسائل/دقيقة
// ══════════════════════════════════════
const _aiRl    = new Map();
const AI_MAX   = 5;
const AI_WINDOW = 60000;

function checkAiLimit(uid) {
  const now = Date.now();
  let times = _aiRl.get(uid);
  if (!times) { times = []; _aiRl.set(uid, times); }
  while (times.length && now - times[0] > AI_WINDOW) times.shift();
  if (times.length >= AI_MAX) return false;
  times.push(now);
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _aiRl) {
    while (v.length && now - v[0] > AI_WINDOW) v.shift();
    if (!v.length) _aiRl.delete(k);
  }
}, 300000);

// ══════════════════════════════════════
// 💬 تاريخ المحادثة (حقيقي الآن)
// ══════════════════════════════════════
const _aiHistory  = new Map();
const _aiTimers   = new Map(); // timers منفصلة بدل property على Map
const HIST_MAX    = 10; // أقصى 10 أزواج سؤال/جواب
// Cleanup idle histories every 30 min (unused > 2h)
setInterval(() => {
  const cut = Date.now() - 7200000;
  for (const [k, v] of _aiHistory) if (!v._ts || v._ts < cut) _aiHistory.delete(k);
}, 1800000).unref();

// ✅ resetChat تفعل شيئاً حقيقياً الآن
async function resetChat(uid) {
  _aiHistory.delete(uid);
}

// ══════════════════════════════════════
// شخصية المساعد
// ══════════════════════════════════════
const SYSTEM_PERSONA = `أنت "أكاديمي"، مساعد جامعي ذكي ومتفوق لبوت منصة جامعية جزائرية.
شخصيتك:
- تتحدث بلهجة جزائرية دارجة ممزوجة بالعربية الفصحى المبسطة (إذا تكلم المستخدم بالدارجة، رد بالدارجة. إذا بالفرنسية، رد بالفرنسية).
- مختصر، دقيق، ومفيد. لا تهلل ولا تطل كلاماً بلا فائدة.
- إذا سألك الطالب عن شيء تقني أو أكاديمي، اشرح له كأنك تشرح لزميلك في الساحة.
- لا تستخدم Markdown الثقيل، اكتب بشكل عادي ونظيف.
- إذا لم تعرف الإجابة، قل بصراحة "ما عندي هاد المعلومة حالياً".
- ممنوع تقديم معلومات خاطئة أو تتوقع.`;

async function smartSearchForAI(query,limit){
  limit=limit||4;
  try{return await smartSearch(query,limit);}catch(e){return[];}
}

function classifyIntent(text) {
  const t = text.toLowerCase();
  if (/عندك|يوجد|بحث|بحث لي|شوف لي|أريد ملف|عايز ملف|حاب تاخذ|حاب تبعث/.test(t)) return 'FILE_SEARCH';
  if (/اشرح|شرحلي|وش يعني|ما هو|ماذا يعني|قانون|تعريف|مفهوم|فرق بين/.test(t))   return 'CONCEPT_EXPLAIN';
  if (/حل|صلحلي|كيفاش نحسب|نحسب|طريقة|خطوات|تمرين|exercice|série|td/.test(t))    return 'PROBLEM_SOLVING';
  return 'GENERAL_CHAT';
}

async function handleAiChat(ctx, text) {
  const uid = ctx.uid;

  if (!checkAiLimit(uid)) {
    return ctx.reply('⏳ أنت سريع جداً! انتظر دقيقة ثم حاول.', {
      reply_markup: { inline_keyboard: [[{ text: '🏠 القائمة', callback_data: 'main_menu' }]] }
    });
  }

  if (text.trim().length < 2) return false;
  ctx.sendChatAction('typing').catch(() => {});
  const intent = classifyIntent(text);

  // بحث ملفات مباشر
  if (intent === 'FILE_SEARCH') {
    const files = await smartSearchForAI(text, 5);
    if (files.length > 0) {
      const rows = files.slice(0, 5).map(f => [
        { text: '📄 ' + f.title.substring(0, 35) + ' · ' + (f.sub_name||''), callback_data: 'preview_' + f.id + '_0_0_0_0_0' }
      ]);
      rows.push([{ text: '🔍 بحث يدوي', callback_data: 'search_prompt' }, { text: '🏠', callback_data: 'main_menu' }]);
      const fileListStr = files.map(f => '- ' + f.title + ' (' + f.sub_name + ')').join('\n');
      await ctx.reply('🔍 لقيت هاذو الملفات:\n\n' + fileListStr + '\n\nاضغط على اللي تبيه:', {
        reply_markup: { inline_keyboard: rows }
      });
      return true;
    }
  }

  // RAG context للشرح والحل
  let ragContext = '';
  if (intent === 'CONCEPT_EXPLAIN' || intent === 'PROBLEM_SOLVING') {
    const relevantFiles = await smartSearchForAI(text, 2);
    if (relevantFiles.length > 0) {
      ragContext = '\n[ملاحظة: عندك ملفات متعلقة: ' + relevantFiles.map(f => f.title).join(', ') + ']';
    }
  }

  // ✅ استخدام تاريخ المحادثة الحقيقي
  const history = _aiHistory.get(uid) || [];

  let botK = '';
  try { botK = await getBotKnowledge(); } catch(_) {}
  const kPrefix = botK ? ('\n\n[' + '\u0645\u0639\u0631\u0641\u0629' + '\u0627\u0644\u0628\u0648\u062A]:\n' + botK.substring(0,1500)) : '';
  const sysContent = SYSTEM_PERSONA + kPrefix + ragContext;
  const messages = [
    { role: 'system', content: sysContent },
    ...history,
    { role: 'user', content: text }
  ];

  try {
    const reply = await aiChat(messages, 400, 0.7);

    // ✅ حفظ التاريخ مع حد أقصى
    history.push({ role: 'user',      content: text  });
    history.push({ role: 'assistant', content: reply });
    if (history.length > HIST_MAX * 2) history.splice(0, 2);
    history._ts = Date.now();
    _aiHistory.set(uid, history);

    // ✅ تنظيف تلقائي بعد ساعة خمول
    if (_aiTimers.get(uid)) clearTimeout(_aiTimers.get(uid));
    _aiTimers.set(uid, setTimeout(() => {
      _aiHistory.delete(uid);
      _aiTimers.delete(uid);
    }, 3600000));

    await ctx.reply(reply, {
      reply_markup: { inline_keyboard: [[
        { text: '📄 بحث عن ملف', callback_data: 'search_prompt' },
        { text: '🔄 محادثة جديدة', callback_data: 'ai_reset'    },
        { text: '🏠 القائمة',      callback_data: 'main_menu'   }
      ]] }
    });
    return true;
  } catch (e) {
    await ctx.reply('⚠️ حصل مشكلة تقنية، جرب من جديد.', {
      reply_markup: { inline_keyboard: [[{ text: '🏠 القائمة', callback_data: 'main_menu' }]] }
    });
    return true;
  }
}

module.exports = { handleAiChat, resetChat };
