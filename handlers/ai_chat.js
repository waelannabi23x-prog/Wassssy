'use strict';

const { aiChat }        = require('../utils/glm_client');
const { all, run }      = require('../database/db');
const { smartSearch }   = require('./group');
const { getBotKnowledge } = require('../utils/ai_knowledge');

// ══════════════════════════════════════
// 🛡️ Rate Limiter — 10 رسائل/دقيقة
// ══════════════════════════════════════
const _aiRl    = new Map();
const AI_MAX   = 10;
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
}, 300000).unref();

// ══════════════════════════════════════
// 💬 Hybrid Memory + DB — تاريخ دائم
// ══════════════════════════════════════
const _aiHistory = new Map();
const _aiTimers  = new Map();
const HIST_MAX   = 10;

setInterval(() => {
  const cut = Date.now() - 7200000;
  for (const [k, v] of _aiHistory) if (!v.ts || v.ts < cut) _aiHistory.delete(k);
}, 1800000).unref();

// ✅ يحمل التاريخ من DB بعد restart
async function loadHistoryFromDB(uid) {
  try {
    const rows = await all(
      'SELECT role, content FROM ai_history WHERE user_id=$1 ORDER BY created_at ASC LIMIT $2',
      [uid, HIST_MAX * 2]
    );
    return rows.map(r => ({ role: r.role, content: r.content }));
  } catch(_) { return []; }
}

// ✅ يحفظ رسالتين (user+assistant) في INSERT واحد
function saveToDB(uid, userText, assistantText) {
  run(
    'INSERT INTO ai_history(user_id,role,content) VALUES($1,$2,$3),($4,$5,$6)',
    [uid, 'user', userText.substring(0, 2000), uid, 'assistant', assistantText.substring(0, 2000)]
  ).catch(() => {});
}

// ✅ resetChat: يمسح الذاكرة + DB
async function resetChat(uid) {
  _aiHistory.delete(uid);
  if (_aiTimers.get(uid)) { clearTimeout(_aiTimers.get(uid)); _aiTimers.delete(uid); }
  try { await run('DELETE FROM ai_history WHERE user_id=$1', [uid]); } catch(_) {}
}

// ══════════════════════════════════════
// شخصية المساعد
// ══════════════════════════════════════
const SYSTEM_PERSONA = `أنت "lws" — صاحب ذكي وكول في قروب جامعي جزائري.

══ شخصيتك ══
- راجل عادي من الجزائر، واثق في نفسه، حنون، ظريف، ما عندكش تكبر
- تحكي دارجة جزائرية طبيعية مع شوية فرنسية كيما الشباب
- عندك حس فكاهي خفيف — تضحك مع الناس بدون مبالغة
- ما أنتش روبوت — أنت صاحب حقيقي يساعد

══ طريقة ردودك ══
- دارجة: "واه والله صح قلت، هاد القانون..."
- فرنسية: رد بنفس الروح بالفرنسية
- عربية: رد مبسط وواضح
- ما تستعملش markdown — اكتب طبيعي بدون نجوم
- ردودك **مفصلة ومفيدة** — مو جملة وخلاص

══ قواعد الإجابة (مهم جداً) ══
1. **دايما اعطي تفاصيل**: إذا سألوك على قانون، اشرح القانون + مثال + كيفاش يتطبق
2. **لا تقول "راجع كتابك"** — أنت هنا تشرح مو تحيل
3. **الخطوات والأمثلة**: في المسائل الحسابية، اشرح خطوة بخطوة
4. **الجامعة الجزائرية**: استعمل أمثلة من الواقع الجزائري (LMD، TP، TD، module...)
5. **إذا ما عرفتش كامل**: قل ما تعرفه واعترف بالباقي — ما تخترعش
6. **شجع دايما**: "واعر خويا! هاد السؤال ذكي"

══ في القروب ══
- إذا سألوا سؤال دراسي: جاوب بتفاصيل كافية في 3-5 أسطر
- إذا كلام عادي/اجتماعي: رد قصير وطبيعي
- إذا ما فهمتش القصد: اسأل "تقصد شنو بالضبط؟"
- ما تطول ردودك على 8 أسطر في القروب

══ أمثلة على جودة الردود ══
❌ سيء: "هذا موضوع واسع، ادرس الكتاب"
✅ زين: "حساب التكامل: عندك دالة f(x)=x², التكامل = x³/3 + C. مثلاً من 0 إلى 3: [27/3 - 0] = 9. الفكرة هي..."

❌ سيء: "هناك عدة عوامل..."  
✅ زين: "3 أسباب رئيسية: أول حاجة... ثاني حاجة... آخر حاجة..."`;

async function smartSearchForAI(query, limit) {
  limit = limit || 4;
  try { return await smartSearch(query, limit); } catch(e) { return []; }
}

// ✅ Precompiled regexes — not rebuilt on every call
const _RX_FILE    = /عندك|يوجد|فيه|بحث|بحث لي|شوف لي|أريد ملف|عايز ملف|حاب تاخذ|حاب تبعث|دورو|فين نلقى|ملف|cours|td|tp|exam/;
const _RX_EXPLAIN = /اشرح|شرحلي|وش يعني|ما هو|ماذا يعني|قانون|تعريف|مفهوم|فرق بين|قارن|expliqu|c'est quoi|définition|différence/;
const _RX_SOLVE   = /حل|صلحلي|كيفاش نحسب|نحسب|طريقة|خطوات|exercice|série|calcul|résoudre|corrig|دير لي/;
const _RX_STUDY   = /مادة|module|matière|semestre|session|امتحان|examen|بكالوريا|licence|master|lmd|درس|محاضرة|TP|TD/;

function classifyIntent(text) {
  const t = text.toLowerCase();
  if (_RX_FILE.test(t))    return 'FILE_SEARCH';
  if (_RX_EXPLAIN.test(t)) return 'CONCEPT_EXPLAIN';
  if (_RX_SOLVE.test(t))   return 'PROBLEM_SOLVING';
  if (_RX_STUDY.test(t))   return 'STUDY_QUESTION';
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

  if (intent === 'FILE_SEARCH') {
    const files = await smartSearchForAI(text, 5);
    if (files.length > 0) {
      const rows = files.slice(0, 5).map(f => [
        { text: '📄 ' + f.title.substring(0, 35) + ' · ' + (f.sub_name || ''), callback_data: 'preview_' + f.id + '_0_0_0_0_0' }
      ]);
      rows.push([{ text: '🔍 بحث يدوي', callback_data: 'search_prompt' }, { text: '🏠', callback_data: 'main_menu' }]);
      const fileListStr = files.map(f => '- ' + f.title + ' (' + (f.sub_name || '') + ')').join('\n');
      await ctx.reply('🔍 لقيت هاذو الملفات:\n\n' + fileListStr + '\n\nاضغط على اللي تبيه:', {
        reply_markup: { inline_keyboard: rows }
      });
      return true;
    }
  }

  let ragContext = '';
  if (['CONCEPT_EXPLAIN', 'PROBLEM_SOLVING', 'STUDY_QUESTION'].includes(intent)) {
    const relevantFiles = await smartSearchForAI(text, 3);
    if (relevantFiles.length > 0) {
      ragContext = '\n[📚 ملفات متعلقة بالموضوع: ' + relevantFiles.map(f => f.title + (f.sub_name ? ' (' + f.sub_name + ')' : '')).join(' | ') + ']';
      ragContext += '\n[تذكر: اشرح بتفاصيل كافية ثم أشر للملفات]';
    }
  }
  // للمسائل: أضف تعليمة الخطوات
  if (intent === 'PROBLEM_SOLVING') {
    ragContext += '\n[المطلوب: حل خطوة بخطوة مع أرقام ومثال عملي]';
  }
  if (intent === 'CONCEPT_EXPLAIN') {
    ragContext += '\n[المطلوب: تعريف + شرح + مثال من الواقع الجزائري]';
  }

  // ✅ Hybrid: memory أولاً، لو ما فيها نحمل من DB
  let hEntry = _aiHistory.get(uid);
  if (!hEntry) {
    const _dbMsgs = await loadHistoryFromDB(uid);
    hEntry = { msgs: _dbMsgs, ts: Date.now() };
    _aiHistory.set(uid, hEntry);
  }
  const history = hEntry.msgs;

  let botK = '';
  try { botK = await getBotKnowledge(); } catch(_) {}
  const kPrefix = botK ? ('\n\n[معرفة البوت]:\n' + botK.substring(0, 1500)) : '';
  const sysContent = SYSTEM_PERSONA + kPrefix + ragContext;
  const messages = [
    { role: 'system', content: sysContent },
    ...hEntry.msgs.filter(m => m.role && m.content),
    { role: 'user', content: text }
  ];

  try {
    const reply = await aiChat(messages);

    // ✅ حفظ في Memory + DB
    hEntry.msgs.push({ role: 'user',      content: text  });
    hEntry.msgs.push({ role: 'assistant', content: reply });
    if (hEntry.msgs.length > HIST_MAX * 2) hEntry.msgs.splice(0, 2);
    hEntry.ts = Date.now();
    saveToDB(uid, text, reply);

    // تنظيف تلقائي بعد ساعة خمول
    if (_aiTimers.get(uid)) clearTimeout(_aiTimers.get(uid));
    _aiTimers.set(uid, setTimeout(() => {
      _aiHistory.delete(uid);
      _aiTimers.delete(uid);
    }, 3600000));

    if (ctx.chat?.type === 'private') {
      await ctx.reply(reply, {
        reply_markup: { inline_keyboard: [[
          { text: '📄 بحث عن ملف', callback_data: 'search_prompt' },
          { text: '🔄 محادثة جديدة', callback_data: 'ai_reset'    },
          { text: '🏠 القائمة',      callback_data: 'main_menu'   }
        ]] }
      });
    } else {
      await ctx.reply(reply);
    }
    return true;
  } catch (e) {
    console.error('[AI Error]', e.message);
    await ctx.reply('⚠️ حصل مشكلة تقنية، جرب من جديد.', {
      reply_markup: { inline_keyboard: [[{ text: '🏠 القائمة', callback_data: 'main_menu' }]] }
    });
    return true;
  }
}

module.exports = { handleAiChat, resetChat };
