const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const filesDb = require('../database/files');
const { build, btn } = require('../utils/keyboard');
const escMd = t => (t||'').replace(/[*_`\[\]()~>#+=|{}.!\-]/g,'\\$&');
const GROQ_MODEL = 'llama-3.1-8b-instant';

// استخرج كلمات البحث من سؤال المستخدم
async function extractSearchQuery(userMsg) {
  const prompt = `Extract search keywords from this student question about university files.
Question: "${userMsg}"
Return ONLY a JSON: {"query": "keywords to search", "is_question": true/false}
Examples:
- "هل عندك حل serie algo 2" → {"query": "serie algo 2", "is_question": true}
- "algo serie 3" → {"query": "algo serie 3", "is_question": false}
- "أبحث عن cours analyse 1" → {"query": "cours analyse 1", "is_question": true}
No explanation, just JSON.`;
  try {
    const res = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 50,
      temperature: 0.1
    });
    return JSON.parse(res.choices[0].message.content.trim());
  } catch(e) { return { query: userMsg, is_question: false }; }
}

// صيغ رد ذكي بناءً على النتائج
async function generateReply(userMsg, results) {
  if(!results.length) {
    const prompt = `Student asked: "${userMsg}"
No files found. Reply in the same language as the question (Arabic/French/Darija) in 1 sentence saying sorry not found and suggest they try different keywords. Be friendly and short.`;
    try {
      const res = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 80,
        temperature: 0.7
      });
      return res.choices[0].message.content.trim();
    } catch(e) { return 'ما لقيت نتائج. جرب كلمات أخرى.'; }
  }

  const fileList = results.slice(0,5).map((f,i) => `${i+1}. ${f.title} (${f.sub_name})`).join('\n');
  const prompt = `Student asked: "${userMsg}"
Found ${results.length} files:
${fileList}
Reply in the same language as the question (Arabic/French/Darija) in 1-2 sentences confirming you found the files. Be friendly and short. Don't list the files again.`;
  try {
    const res = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      temperature: 0.7
    });
    return res.choices[0].message.content.trim();
  } catch(e) { return `وجدت ${results.length} نتيجة 👇`; }
}

async function handleAiChat(ctx, text) {
  if(ctx.chat?.type !== 'private') return false;

  // فقط الجمل الطويلة أو اللي فيها علامة سؤال
  const isQuestion = text.includes('?') || text.includes('؟') ||
    text.includes('هل') || text.includes('عندك') || text.includes('فيه') ||
    text.includes('أبحث') || text.includes('نحتاج') || text.length > 15;
  if(!isQuestion) return false;

  // typing indicator
  ctx.telegram.sendChatAction(ctx.chat.id, 'typing').catch(()=>{});

  const extracted = await extractSearchQuery(text);
  if(!extracted?.query) return false;

  const results = await filesDb.search(extracted.query, 8);
  const reply = await generateReply(text, results);

  if(!results.length) {
    await ctx.reply(reply, {
      ...build([[btn('🔍 بحث يدوي', 'search_prompt'), btn('🏠', 'main_menu')]])
    });
    return true;
  }

  const rows = results.slice(0,6).map(f => [
    btn('📄 '+f.title.substring(0,30)+' · '+f.sub_name, 'preview_'+f.id+'_0_0_0_0_0')
  ]);
  rows.push([btn('🔍 بحث جديد', 'search_prompt'), btn('🏠', 'main_menu')]);

  await ctx.reply(reply, { parse_mode: 'Markdown', ...build(rows) });
  return true;
}

module.exports = { handleAiChat };
