'use strict';

const GLM_API_KEY = process.env.GLM_API_KEY || '';
const GLM_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

async function aiChat(messages, model) {
  model = model || 'glm-4-flash';
  if (!GLM_API_KEY) throw new Error('GLM_API_KEY not set');

  const res = await fetch(GLM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + GLM_API_KEY,
    },
    body: JSON.stringify({ model, messages, max_tokens: 1000 }),
  });

  if (!res.ok) throw new Error('GLM API error: ' + res.status);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// back-compat
const groqChat = aiChat;

module.exports = { aiChat, groqChat };
