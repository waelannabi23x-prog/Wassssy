require('dotenv').config();
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function test() {
  const msgs = ['ماذا يوجد فل algo 2', 'هل يوجد حل serie 1 algo 2', 'عندك الغوا 2 سيري'];
  for(const msg of msgs) {
    const res = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: `Extract search keywords from this student question about university files.\nQuestion: "${msg}"\nReturn ONLY a JSON: {"query": "keywords to search", "is_question": true/false}` }],
      max_tokens: 50, temperature: 0.1
    });
    console.log(msg, '→', res.choices[0].message.content.trim());
  }
}
test().catch(console.error).finally(()=>process.exit());
