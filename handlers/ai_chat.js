const { groqChat } = require('../utils/groq_client');
const filesDb = require('../database/files');
const { cacheGet, cacheSet } = require('../utils/cache');

// ═══════════════════════════════════════════════════════
// 🧠 Enterprise AI Engine V2 - المساعد الجامعي الذكي
// ═══════════════════════════════════════════════════════

const SYSTEM_PERSONA = `أنت "أكاديمي"، مساعد جامعي ذكي ومتفوق لبوت منصة جامعية جزائرية.
شخصيتك:
- تتحدث بلهجة جزائرية دارجة ممزوجة بالعربية الفصحى المبسطة (إذا تكلم المستخدم بالدارجة، رد بالدارجة. إذا بالفرنسية، رد بالفرنسية).
- مختصر، دقيق، ومفيد. لا تهلل ولا تطل كلاماً بلا فائدة.
- إذا سألك الطالب عن شيء تقني أو أكاديمي، اشرح له كأنك تشرح لزميلك في الساحة (مثال: الـ Stack هو هيكل بيانات الأخير يدخل أول يخرج آخر LIFO).
- لا تستخدم Markdown الثقيل (لا تضع عناوين كبيرة أو نقاط كثيرة)، اكتب بشكل عادي ونظيف.
- إذا لم تعرف الإجابة أو المعلومة غير متوفرة، قل بصراحة "ما عندي هاد المعلومة حالياً، جرب تسأل الأساتذة أو راجع الكورس".
- ممنوع تقديم معلومات خاطئة أو تتوقع.`;

async function smartSearchForAI(query, limit = 3) {
  const q = query.replace(/[%;\\]/g, '').trim();
  if (q.length < 2) return [];
  try {
    const results = await filesDb.search(q, limit);
    if (results.length >= 2) return results;
    
    const words = q.split(/\s+/).filter(w => w.length >= 3);
    if (words.length > 1) {
      const extras = new Map();
      const existingIds = new Set(results.map(x => x.id));
      const wordResults = await Promise.all(words.map(w => filesDb.search(w, limit)));
      for (const wr of wordResults) {
        for (const r of wr) { if (!existingIds.has(r.id)) { extras.set(r.id, r); existingIds.add(r.id); } }
      }
      return [...results, ...extras.values()].slice(0, limit);
    }
    return results;
  } catch (e) { return []; }
}

function classifyIntent(text) {
  const t = text.toLowerCase();
  if (/عندك|يوجد|بحث|بحث لي|شوف لي|أريد ملف|عايز ملف|حاب تاخذ|حاب تبعث/.test(t)) return 'FILE_SEARCH';
  if (/اشرح|شرحلي|وش يعني|ما هو|ماذا يعني|قانون|تعريف|مفهوم|فرق بين/.test(t)) return 'CONCEPT_EXPLAIN';
  if (/حل|صلحلي|كيفاش نحسب|نحسب|طريقة|خطوات|تمرين|exercice|série|td/.test(t)) return 'PROBLEM_SOLVING';
  return 'GENERAL_CHAT';
}

async function handleAiChat(ctx, text) {
  const uid = ctx.uid;
  ctx.sendChatAction('typing').catch(() => {});

  const intent = classifyIntent(text);

  // 1. بحث الملفات (إذا كان القصد ملف)
  if (intent === 'FILE_SEARCH') {
    const files = await smartSearchForAI(text, 5);
    if (files.length > 0) {
      const rows = files.slice(0, 5).map(f => [
        { text: '📄 ' + f.title.substring(0, 35) + ' · ' + f.sub_name, callback_data: 'preview_' + f.id + '_0_0_0_0_0' }
      ]);
      rows.push([{ text: '🔍 بحث يدوي', callback_data: 'search_prompt' }, { text: '🏠', callback_data: 'main_menu' }]);
      const fileListStr = files.map(f => '- ' + f.title + ' (' + f.sub_name + ')').join('\n');
      
      await ctx.reply('🔍 لقيت هاذو الملفات اللي تبحث عليهم:\n\n' + fileListStr + '\n\nاضغط على اللي تبيه:', {
        reply_markup: { inline_keyboard: rows }
      });
      return true;
    }
  }

  // 2. RAG (إحضار سياق الملفات المتعلقة لتغذية الذكاء الاصطناعي)
  let ragContext = '';
  if (intent === 'CONCEPT_EXPLAIN' || intent === 'PROBLEM_SOLVING') {
    const relevantFiles = await smartSearchForAI(text, 2);
    if (relevantFiles.length > 0) {
      ragContext = `\n[ملاحظة: عندك ملفات متعلقة بالموضوع في المنصة: ${relevantFiles.map(f => f.title).join(', ')}]`;
    }
  }

  // 3. توليد الرد الذكي
  try {
    const messages = [
      { role: 'system', content: SYSTEM_PERSONA + ragContext },
      { role: 'user', content: text }
    ];

    const reply = await groqChat(messages, 400, 0.7);
    
    // زرائد سريعة للتفاعل
    const rows = [
      [{ text: '📄 بحث عن ملف', callback_data: 'search_prompt' }, { text: '🏠 القائمة', callback_data: 'main_menu' }]
    ];

    await ctx.reply(reply, {
      reply_markup: { inline_keyboard: rows }
    });
    return true;
  } catch (e) {
    await ctx.reply('⚠️ حصل خلية في السيرفر، جرب من جديد.', {
      reply_markup: { inline_keyboard: [[{ text: '🏠 القائمة', callback_data: 'main_menu' }]] }
    });
    return true;
  }
}

async function resetChat(uid) {
  // في المستقبل يمكن إضافة مسح سياق الـ AI هنا
}

module.exports = { handleAiChat, resetChat };
