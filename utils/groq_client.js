'use strict';
const https = require('https');
const logger = require('./logger');

const GEMINI_KEY = process.env.GEMINI_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY;

const MAX_RETRIES = 2;
const QUOTA_WAIT_MS = 60000;

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function geminiChat(messages, maxTokens = 400, temperature = 0.7, retries = 0) {
  if (!GEMINI_KEY) throw new Error('No Gemini key');
  const body = {
    system_instruction: messages.find(m => m.role === 'system') ? { parts: [{ text: messages[0].content }] } : undefined,
    contents: messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    })),
    generationConfig: { maxOutputTokens: maxTokens, temperature }
  };
  const data = JSON.stringify(body);
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_KEY;

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
              if (msg.includes('QUOTA_EXCEEDED') || msg.includes('429') || msg.includes('quota')) {
                if (retries < MAX_RETRIES) {
                  logger.warn('Gemini quota hit, retry ' + (retries + 1) + ' in ' + (QUOTA_WAIT_MS * (retries + 1)) + 'ms');
                  return wait(QUOTA_WAIT_MS * (retries + 1)).then(() => geminiChat(messages, maxTokens, temperature, retries + 1));
                }
                reject(new Error('Gemini quota exceeded. Try later.'));
              }
              reject(new Error(msg));
            }
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) reject(new Error('Empty response'));
            resolve(text);
          } catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
    return res;
  } catch (e) {
    const msg = e.message || '';
    if (msg.includes('QUOTA_EXCEEDED') || msg.includes('429') || msg.includes('quota')) {
      if (retries < MAX_RETRIES) {
        logger.warn('Gemini quota hit, retrying in ' + (QUOTA_WAIT_MS * (retries + 1)) + 'ms');
        return wait(QUOTA_WAIT_MS * (retries + 1)).then(() => geminiChat(messages, maxTokens, temperature, retries + 1));
      }
      throw new Error('Gemini quota exceeded. Try later.');
    }
    logger.error('Gemini failed:', msg.substring(0, 100));
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

async function groqChat(messages, maxTokens = 400, temperature = 0.7) {
  if (GEMINI_KEY) {
    try {
      return await geminiChat(messages, maxTokens, temperature);
    } catch (e) {
      const msg = e.message || '';
      if (!msg.includes('quota') && !msg.includes('Quota')) {
        logger.error('Gemini failed:', msg.substring(0, 100));
      }
    }
  }
  return groqFallback(messages, maxTokens, temperature);
}

module.exports = { groqChat };
