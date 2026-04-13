const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'gemma2-9b-it'
];

let currentIdx = 0;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function groqChat(messages, maxTokens=500, temperature=0.7) {
  let lastError;
  for(let i=0; i<MODELS.length; i++) {
    const model = MODELS[(currentIdx + i) % MODELS.length];
    let backoff = 1000;
    for(let attempt=0; attempt<3; attempt++) {
      try {
        const res = await groq.chat.completions.create({
          model, messages, max_tokens: maxTokens, temperature
        });
        return res.choices[0].message.content.trim();
      } catch(e) {
        lastError = e;
        if(e.status === 429) {
          console.log(`Model ${model} rate limited, backoff ${backoff}ms...`);
          await sleep(backoff);
          backoff *= 2;
          continue;
        }
        if(e.status === 400 || e.status === 404) {
          console.log(`Model ${model} unavailable, switching...`);
          currentIdx = (currentIdx + i + 1) % MODELS.length;
          break;
        }
        throw e;
      }
    }
  }
  throw lastError || new Error('All models failed');
}

module.exports = { groqChat };
