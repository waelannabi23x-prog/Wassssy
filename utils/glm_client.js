'use strict';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function aiChat(messages, model) {
  model = model || 'llama3-8b-8192';
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY not set');

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + GROQ_API_KEY,
    },
    body: JSON.stringify({ model, messages, max_tokens: 1000 }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error('Groq error: ' + res.status + ' ' + err.substring(0, 100));
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

const groqChat = aiChat;
module.exports = { aiChat, groqChat };
