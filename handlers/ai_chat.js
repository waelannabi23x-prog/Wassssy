'use strict';
const { groqChat } = require('../utils/groq_client');
const filesDb = require('../database/files');
const { getBotKnowledge } = require('../utils/ai_knowledge');

// ═══ AI Rate Limiter — 5 رسائل/دقيقة لكل مستخدم ═══
const _aiRl = new Map();
const AI_MAX = 5, AI_WINDOW = 60000;
function checkAiLimit(uid) {
  const now = Date.now();
  let times = _aiRl.get(uid);
  if (!times) { times = []; _aiRl.set(uid, times); }
  while (times.length && now - times[0] > AI_WINDOW) times.shift();
  if (times.length >= AI_MAX) return false;
  times.push(now); return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _aiRl) { while (v.length && now - v[0] > AI_WINDOW) v.shift(); if (!v.length) _aiRl.delete(k); }
}, 300000).unref();

// ═══ Conversation History — آخر 10 رسائل لكل مستخدم ═══
const _history = new Map();
const MAX_HISTORY = 10;
function getHistory(uid) { return _history.get(uid) || []; }
function addToHistory(uid, role, content) {
  let h = _history.get(uid) || [];
  h.push({ role, content });
  if (h.length > MAX_HISTORY) h = h.slice(-MAX_HISTORY);
  _history.set(uid, h);
}
function resetChat(uid) { _history.delete(uid); }

// ═══ System Persona ═══
const BASE_PERSONA = `أنت "أكاديمي"، مساعد جامعي ذكي لبوت منصة جامعية جزائرية.
شخصيتك:
- تتحدث بلهجة جزائرية دارجة ممزوجة بالعربية المبسطة. إذا تكلم المستخدم بالفرنسية رد بالفرنسية.
- مختصر، دقيق، ومفيد. لا تطل بلا فائدة.
- اشرح كأنك تشرح لزميلك في الساحة.
- لا تستخدم Markdown ثقيل، اكتب بشكل عادي ونظيف.
- إذا ما عندك المعلومة، قل "ما عندي هاد المعلومة حالياً" بدل ما تتوقع.`;

async function smartSearchForAI(query, limit = 3) {
  const q = query.replace(/[%;\\]/g, '').trim();
  if (q.length < 2) return [];
  try {
    const results = await filesDb.search(q, limit);
    if (results.length >= 2) return results;
    const words = q.split(/\s+/).filter(w => w.length >= 3);
    if (words.length > 1) {
      const existingIds = new Set(results.map(x => x.id));
      const extras = new Map();
      const wordResults = await Promise.all(words.map(w => filesDb.search(w, limit)));
      for (const wr of wordResults)
        for (const r of wr) if (!existingIds.has(r.id)) { extras.set(r.id, r); existingIds.add(r.id); }
      return [...results, ...extras.values()].slice(0, limit);
    }
    return results;
  } catch (_) { return []; }
}

function classifyIntent(text) {
  const t = text.toLowerCase();
  if (/عندك|يوجد|بحث|بحث لي|شوف لي|أريد ملف|عايز ملف|حاب تاخذ|حاب تبعث/.test(t)) return 'FILE_SEARCH';
  if (/اشرح|شرحلي|وش يعني|ما هو|ماذا يعني|قانون|تعريف|مفهوم|فرق بين/.test(t)) return 'CONCEPT_EXPLAIN';
  if (/حل|صلحلي|كيفاش نحسب|طريقة|خطوات|تمرين|exercice|série|td/.test(t)) return 'PROBLEM_SOLVING';
  return 'GENERAL_CHAT';
}

async function handleAiChat(ctx, text) {
  const uid = ctx.uid;
  if (!checkAiLimit(uid)) {
    return ctx.reply('⏳ انتظر دقيقة ثم حاول مرة أخرى.', {
      reply_markup: { inline_keyboard: [[{ text: '🏠 القائمة', callback_data: 'main_menu' }]] }
    });
  }
  if (text.trim().length < 2) return false;
  ctx.sendChatAction('typing').catch(() => {});

  const intent = classifyIntent(text);

  // FILE SEARCH — رد مباشر بالملفات
  if (intent === 'FILE_SEARCH') {
    const files = await smartSearchForAI(text, 5);
    if (files.length > 0) {
      const rows = files.map(f => [{
        text: '📄 ' + f.title.substring(0, 35) + ' · ' + f.sub_name,
        callback_data: 'preview_' + f.id + '_0_0_0_0_0'
      }]);
      rows.push([{ text: '🔍 بحث يدوي', callback_data: 'search_prompt' }, { text: '🏠', callback_data: 'main_menu' }]);
      const fileListStr = files.map(f => '- ' + f.title + ' (' + f.sub_name + ')').join('\n');
      addToHistory(uid, 'user', text);
      addToHistory(uid, 'assistant', 'وجدت ' + files.length + ' ملفات متعلقة.');
      await ctx.reply('🔍 لقيت هاذو الملفات:\n\n' + fileListStr + '\n\nاضغط على اللي تبيه:', {
        reply_markup: { inline_keyboard: rows }
      });
      return true;
    }
  }

  // بناء context من الملفات ذات الصلة
  let ragContext = '';
  if (intent === 'CONCEPT_EXPLAIN' || intent === 'PROBLEM_SOLVING') {
    const relevantFiles = await smartSearchForAI(text, 2);
    if (relevantFiles.length > 0)
      ragContext = '\n[عندك ملفات متعلقة: ' + relevantFiles.map(f => f.title).join(', ') + ']';
  }

  // بناء system prompt مع قاعدة المعرفة
  let knowledge = '';
  try { knowledge = await getBotKnowledge(); } catch (_) {}
  const systemPrompt = BASE_PERSONA + (knowledge ? '\n\n' + knowledge : '') + ragContext;

  // بناء messages مع التاريخ
  const history = getHistory(uid);
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: text }
  ];

  try {
    const reply = await groqChat(messages, 500, 0.7);
    addToHistory(uid, 'user', text);
    addToHistory(uid, 'assistant', reply);
    await ctx.reply(reply, {
      reply_markup: { inline_keyboard: [[
        { text: '📄 بحث عن ملف', callback_data: 'search_prompt' },
        { text: '🏠 القائمة', callback_data: 'main_menu' }
      ]] }
    });
    return true;
  } catch (e) {
    await ctx.reply('⚠️ حصل مشكلة، جرب من جديد.', {
      reply_markup: { inline_keyboard: [[{ text: '🏠 القائمة', callback_data: 'main_menu' }]] }
    });
    return true;
  }
}

module.exports = { handleAiChat, resetChat };
