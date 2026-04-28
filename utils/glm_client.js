'use strict';

// يستخدم GLM أولاً، لو فشل يستخدم Groq
const GLM_API_KEY = process.env.GLM_API_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

async function aiChat(messages, model) {
  // جرب GLM أولاً
  if (GLM_API_KEY) {
    try {
      const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + GLM_API_KEY,
        },
        body: JSON.stringify({ model: 'glm-4-flash', messages, max_tokens: 1000 }),
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return content;
      }
    } catch(e) { console.error('[GLM]', e.message); }
  }

  // Groq كـ fallback
  if (GROQ_API_KEY) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + GROQ_API_KEY,
      },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, max_tokens: 1000 }),
    });
    if (!res.ok) throw new Error('Groq error: ' + res.status);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  throw new Error('No AI API key configured');
}

const groqChat = aiChat;
module.exports = { aiChat, groqChat };
