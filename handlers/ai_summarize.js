const { escMd } = require('../utils/common');
const https = require('https');
const http = require('http');

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
  const thinking = await ctx.reply('📝 جاري تلخيص الملف...').catch(() => null);
  try {
    const link = await ctx.telegram.getFileLink(fileId);
    const buffer = await fetchBuffer(link.href);

    if (buffer.length > 10 * 1024 * 1024) {
      if (thinking) ctx.deleteMessage(thinking.message_id).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      return ctx.reply('⚠️ الملف كبير جداً (أكثر من 10MB).');
    }

    let text = null;

    // إذا عندنا Gemini، نبعث PDF مباشرة (بدون pdf-parse!)
    if (process.env.GEMINI_API_KEY) {
      try {
        text = await geminiExtractPdf(buffer, title);
      } catch (e) {
        // fallback لـ pdf-parse
        try {
          const pdfParse = require('pdf-parse');
          const data = await pdfParse(buffer);
          text = data.text?.trim().substring(0, 8000);
        } catch (e2) {}
      }
    } else {
      try {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);
        text = data.text?.trim().substring(0, 8000);
      } catch (e) {}
    }

    if (thinking) ctx.deleteMessage(thinking.message_id).catch(err => { require('../utils/logger').debug("[silent]", err.message); });

    if (!text || text.length < 50) {
      return ctx.reply('⚠️ ما قدرت أقرأ هذا الملف — قد يكون scanned أو غير PDF نصي.');
    }

    const { groqChat } = require('../utils/groq_client');
    const summary = await groqChat([
      { role: 'system', content: 'لخص هذا المستند الجامعي. اكتشف اللغة (عربي/فرنسي/إنجليزي) ورد بنفس اللغة.\n\n1. 📌 الموضوع الرئيسي (سطر واحد)\n2. 🔑 5 نقاط رئيسية\n3. 💡 مفاهيم أو قوانين مهمة\n4. ⚠️ ماذا يركز عليه للامتحان\n\nكن مختصراً وواضحاً.' },
      { role: 'user', content: 'المستند: ' + title + '\n\n' + text }
    ], 800, 0.3);

    await ctx.reply('📄 *ملخص: ' + escMd(title) + '*\n\n' + summary, { parse_mode: 'Markdown' });
  } catch (e) {
    if (thinking) ctx.deleteMessage(thinking.message_id).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    ctx.reply('❌ فشل التلخيص: ' + e.message).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  }
}

// Gemini يقرأ PDF مباشرة عبر API
function geminiExtractPdf(buffer, title) {
  return new Promise((resolve, reject) => {
  
    const prompt = JSON.stringify({
      contents: [{ role: 'user', parts: [
        { text: 'استخرج كل النص من هذا PDF. ارجع النص فقط بدون أي إضافة.' },
        { inline_data: { mime_type: 'application/pdf', data: buffer.toString('base64') } }
      ]}],
      generationConfig: { maxOutputTokens: 8000 }
    });

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + process.env.GEMINI_API_KEY;

    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(prompt) }
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) resolve(text.trim().substring(0, 8000));
          else reject(new Error('Empty'));
        } catch (e) { reject(e); }
      });
    });

    req.on('error', reject);
    req.write(prompt);
    req.end();
  });
}

module.exports = { handleSummarize };
