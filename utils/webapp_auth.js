'use strict';
const crypto = require('crypto');
const TOKEN = process.env.BOT_TOKEN || '';

function verifyWebApp(initData) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const keys = [...params.keys()].sort();
    const dataCheck = keys.map(k => `${k}=${params.get(k)}`).join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(TOKEN).digest();
    const sig = crypto.createHmac('sha256', secret).update(dataCheck).digest('hex');
    if (sig !== hash) return null;
    const user = JSON.parse(params.get('user') || 'null');
    return user;
  } catch(_) { return null; }
}

module.exports = { verifyWebApp };
