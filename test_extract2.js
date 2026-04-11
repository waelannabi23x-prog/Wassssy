require('dotenv').config();
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function extractSearchQuery(userMsg) {
  const { default: aiChat } = await import('./handlers/ai_chat.js').catch(()=>({}));
  const prompt = `You extract file search keywords from student messages. The student is looking for university course files.
Message: "${userMsg}"
Rules:
- Extract ONLY the subject/course name and file type (cours, serie, td, exam, solution)
- "الغوا" or "algo" = "algo"
- "سيري" or "serie" = "serie"  
- "كور" or "cours" = "cours"
- Numbers stay as-is
- Return ONLY JSON, no extra text: {"query": "extracted keywords"}
Examples:
- "عندك الغوا 2 سيري" → {"query": "algo 2 serie"}
- "هل يوجد حل serie 1 algo 2" → {"query": "algo 2 serie 1"}
- "ماذا يوجد فل algo 2" → {"query": "algo 2"}`;
  const res = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 50, temperature: 0.1
  });
  return res.choices[0].message.content.trim();
}

async function test() {
  const msgs = ['ماذا يوجد فل algo 2', 'هل يوجد حل serie 1 algo 2', 'عندك الغوا 2 سيري'];
  for(const msg of msgs) {
    const r = await extractSearchQuery(msg);
    console.log(msg, '→', r);
  }
}
test().catch(console.error).finally(()=>process.exit());
