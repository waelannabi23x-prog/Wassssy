const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'gemma2-9b-it',
];

let currentIdx = 0;

async function groqChat(messages, maxTokens=500, temperature=0.7) {
  for(let i=0; i<MODELS.length; i++) {
    const model = MODELS[(currentIdx + i) % MODELS.length];
    try {
      const res = await groq.chat.completions.create({
        model,
        messages,
        max_tokens: maxTokens,
        temperature
      });
      return res.choices[0].message.content.trim();
    } catch(e) {
      if(e.status === 429 || e.status === 503) {
        console.log(`Model ${model} rate limited, trying next...`);
        currentIdx = (currentIdx + i + 1) % MODELS.length;
        continue;
      }
      throw e;
    }
  }
  throw new Error('All models rate limited');
}

module.exports = { groqChat };
