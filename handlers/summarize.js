const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const https = require('https');
const http = require('http');
const GROQ_MODEL = 'llama-3.3-70b-versatile';

async function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function extractText(buffer, fileType) {
  if(fileType === 'photo') return null;
  if(fileType === 'link') return null;
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text?.trim().substring(0, 8000) || null;
  } catch(e) {
    return null;
  }
}

async function summarizeText(text, title, lang='ar') {
  const langInstr = lang === 'fr' 
    ? 'Respond in French.' 
    : 'Respond in Arabic (Egyptian/Algerian dialect is fine).';
  
  const prompt = `You are an academic assistant. Summarize this university document.
Title: "${title}"
${langInstr}

Document content:
${text}

Provide:
1. 📌 Main topic (1 line)
2. 🔑 5 key points (bullet points)
3. 💡 Important concepts/formulas if any
4. ⚠️ What to focus on for exams

Keep it concise and student-friendly.`;

  const res = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 800,
    temperature: 0.3
  });
  return res.choices[0].message.content.trim();
}

async function handleSummarize(ctx, fileId, fileType, title) {
  const thinking = await ctx.reply('📝 جاري تلخيص الملف...').catch(()=>null);
  try {
    // جلب رابط الملف
    const link = await ctx.telegram.getFileLink(fileId);
    const buffer = await fetchBuffer(link.href);
    const text = await extractText(buffer, fileType);
    
    if(!text || text.length < 100) {
      if(thinking) ctx.deleteMessage(thinking.message_id).catch(()=>{});
      return ctx.reply('⚠️ ما قدرت أقرأ هذا الملف. يمكن يكون صورة أو محمي.');
    }

    // اكتشف اللغة
    const isFrench = text.match(/[a-zA-ZéèêëàâùûüôçÉÈÊÀÂÙÛÔÇ]{4,}/g)?.length > 20;
    const summary = await summarizeText(text, title, isFrench ? 'fr' : 'ar');
    
    if(thinking) ctx.deleteMessage(thinking.message_id).catch(()=>{});
    await ctx.reply(`📄 *ملخص: ${title}*\n\n${summary}`, { parse_mode: 'Markdown' });
  } catch(e) {
    if(thinking) ctx.deleteMessage(thinking.message_id).catch(()=>{});
    ctx.reply('❌ فشل التلخيص: ' + e.message).catch(()=>{});
  }
}

module.exports = { handleSummarize };
