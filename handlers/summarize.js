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

async function handleSummarize(ctx, fileId, fileType, title) {
  const thinking = await ctx.reply('📝 جاري تلخيص الملف...').catch(()=>null);
  try {
    const link = await ctx.telegram.getFileLink(fileId);
    const buffer = await fetchBuffer(link.href);
    const base64 = buffer.toString('base64');

    const res = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `You are an academic assistant. Summarize this university document titled "${title}".
Detect the language (Arabic/French/English) and respond in the SAME language.
Provide:
1. 📌 Main topic (1 line)
2. 🔑 5 key points (bullet points)
3. 💡 Important concepts or formulas
4. ⚠️ What to focus on for exams
Keep it concise and student-friendly.`
          },
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64
            }
          }
        ]
      }],
      max_tokens: 1000,
      temperature: 0.3
    });

    const summary = res.choices[0].message.content.trim();
    if(thinking) ctx.deleteMessage(thinking.message_id).catch(()=>{});
    await ctx.reply(`📄 *ملخص: ${title}*\n\n${summary}`, { parse_mode: 'Markdown' });
  } catch(e) {
    if(thinking) ctx.deleteMessage(thinking.message_id).catch(()=>{});
    // fallback — pdf-parse
    try {
      const link = await ctx.telegram.getFileLink(fileId);
      const buffer = await fetchBuffer(link.href);
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      const text = data.text?.trim().substring(0, 6000);
      if(!text || text.length < 50) return ctx.reply('⚠️ ما قدرت أقرأ هذا الملف.');
      const res2 = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: `Summarize this university document titled "${title}".\nDetect language and respond in same language.\nProvide: 📌 topic, 🔑 5 key points, 💡 concepts, ⚠️ exam focus.\n\n${text}` }],
        max_tokens: 800, temperature: 0.3
      });
      await ctx.reply(`📄 *ملخص: ${title}*\n\n${res2.choices[0].message.content.trim()}`, { parse_mode: 'Markdown' });
    } catch(e2) {
      ctx.reply('❌ فشل التلخيص. الملف قد يكون محمياً أو تالفاً.').catch(()=>{});
    }
  }
}

module.exports = { handleSummarize };
