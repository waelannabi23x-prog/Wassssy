const https = require('https');
const logger = require('./logger');

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY;

// ═══════════════════════════════════════════════════════
// 🧠 Gemini API (أساسي - مجاني وسريع)
// ═══════════════════════════════════════════════════════
function geminiChat(messages, maxTokens = 400, temperature = 0.7) {
  return new Promise((resolve, reject) => {
    if (!GEMINI_KEY) return reject(new Error('No Gemini key'));

    const systemMsg = messages.find(m => m.role === 'system');
    const userMsgs = messages.filter(m => m.role !== 'system');

    const body = {
      system_instruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
      contents: userMsgs.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      })),
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: temperature
      }
    };

    const data = JSON.stringify(body);
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_KEY;

    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          if (json.error) return reject(new Error(json.error.message));
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) return reject(new Error('Empty response'));
          resolve(text);
        } catch (e) { reject(e); }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════
// 🧠 Groq API (احتياطي)
// ═══════════════════════════════════════════════════════
let groqClient = null;
function getGroq() {
  if (groqClient) return groqClient;
  if (!GROQ_KEY) return null;
  try {
    const Groq = require('groq-sdk');
    groqClient = new Groq({ apiKey: GROQ_KEY });
    return groqClient;
  } catch (e) { return null; }
}

function groqFallback(messages, maxTokens = 400, temperature = 0.7) {
  return new Promise((resolve, reject) => {
    const g = getGroq();
    if (!g) return reject(new Error('No AI provider'));
    g.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: messages,
      max_tokens: maxTokens,
      temperature: temperature
    }).then(r => resolve(r.choices[0].message.content.trim()))
      .catch(reject);
  });
}

// ═══════════════════════════════════════════════════════
// 🧠 الموحد: Gemini أولياً → Groq احتياطي
// ═══════════════════════════════════════════════════════
async function groqChat(messages, maxTokens = 400, temperature = 0.7) {
  if (GEMINI_KEY) {
    try {
      return await geminiChat(messages, maxTokens, temperature);
    } catch (e) {
      logger.warn('Gemini failed, falling back to Groq:', e.message);
    }
  }
  return groqFallback(messages, maxTokens, temperature);
}

module.exports = { groqChat };
