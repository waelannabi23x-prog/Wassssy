'use strict';
const https  = require('https');
const logger = require('./logger');

const GEMINI_KEY   = process.env.GEMINI_KEY;
const GROQ_KEY     = process.env.GROQ_API_KEY;
const MAX_RETRIES  = 2;
const QUOTA_WAIT   = 5000;

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function geminiChat(messages, maxTokens = 700, temperature = 0.65, retries = 0) {
  if (!GEMINI_KEY) throw new Error('No Gemini key');
  const body = {
    system_instruction: messages.find(m => m.role === 'system')
      ? { parts: [{ text: messages[0].content }] } : undefined,
    contents: messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    })),
    generationConfig: { maxOutputTokens: maxTokens, temperature }
  };
  const data = JSON.stringify(body);
  const url  = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_KEY;

  try {
    const res = await new Promise((resolve, reject) => {
      const req = https.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        timeout: 30000,
      }, (res) => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(raw);
            if (json.error) {
              const msg = json.error.message || '';
              if ((msg.includes('QUOTA_EXCEEDED') || msg.includes('429')) && retries < MAX_RETRIES) {
                return wait(QUOTA_WAIT * (retries + 1))
                  .then(() => geminiChat(messages, maxTokens, temperature, retries + 1))
                  .then(resolve).catch(reject);
              }
              return reject(new Error(msg));
            }
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) return reject(new Error('Empty response'));
            resolve(text);
          } catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Gemini timeout')); });
      req.write(data);
      req.end();
    });
    return res;
  } catch (e) {
    const msg = e.message || '';
    if ((msg.includes('QUOTA_EXCEEDED') || msg.includes('429')) && retries < MAX_RETRIES) {
      return wait(QUOTA_WAIT * (retries + 1))
        .then(() => geminiChat(messages, maxTokens, temperature, retries + 1));
    }
    throw e;
  }
}

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

function groqFallback(messages, maxTokens = 700, temperature = 0.65) {
  return new Promise((resolve, reject) => {
    const g = getGroq();
    if (!g) return reject(new Error('No AI provider available'));
    g.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: maxTokens,
      temperature
    }).then(r => resolve(r.choices[0].message.content.trim()))
      .catch(reject);
  });
}

// ✅ اسم واضح: aiChat بدل groqChat المضلل
// Primary: Gemini | Fallback: Groq
async function aiChat(messages, maxTokens = 700, temperature = 0.65) {
  if (GEMINI_KEY) {
    try {
      return await geminiChat(messages, maxTokens, temperature);
    } catch (e) {
      if (!e.message?.includes('quota') && !e.message?.includes('Quota')) {
        logger.error('[AI] Gemini error:', e.message.substring(0, 100));
      }
    }
  }
  return groqFallback(messages, maxTokens, temperature);
}

// ✅ نصدّر aiChat — groqChat كـ alias للتوافق مع الكود القديم

// ── Streaming: يبعث tokens بشكل تدريجي ─────────────────────────
async function aiChatStream(messages, onChunk, maxTokens = 700) {
  const g = getGroq();
  // إذا ما فيه Groq، استخدم Gemini العادي (لا يدعم streaming)
  if (!g) {
    const result = await aiChat(messages, maxTokens);
    await onChunk(result, true);
    return result;
  }
  try {
    const stream = await g.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: maxTokens,
      stream: true,
      temperature: 0.65
    });
    let full = '';
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || '';
      if (token) {
        full += token;
        await onChunk(full, false);
      }
    }
    if (!full.trim()) throw new Error('Empty stream');
    await onChunk(full, true);
    return full;
  } catch(e) {
    // fallback لـ Gemini إذا فشل Groq stream
    logger.warn('[AI Stream] fallback to Gemini:', e.message?.substring(0, 80));
    const result = await aiChat(messages, maxTokens);
    await onChunk(result, true);
    return result;
  }
}

module.exports = { aiChat, aiChatStream, groqChat: aiChat };
