'use strict';

// BullMQ يحتاج ioredis connection — نستخدم نفس الـ env vars
// اللي تستخدمها redis.js
function getConnection() {
  // Railway Redis plugin أو Upstash ioredis URL
  if (process.env.REDIS_URL) {
    const tls = process.env.REDIS_URL.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined;
    return { url: process.env.REDIS_URL, tls, maxRetriesPerRequest: null, enableReadyCheck: false };
  }
  // Upstash ioredis endpoint منفصل
  if (process.env.UPSTASH_REDIS_REST_URL) {
    // Upstash REST لا يدعم BullMQ — BullMQ معطّل
    return null;
  }
  // Railway Redis variables
  if (process.env.REDISHOST || process.env.REDIS_HOST) {
    return {
      host:     process.env.REDISHOST     || process.env.REDIS_HOST     || 'localhost',
      port:     parseInt(process.env.REDISPORT || process.env.REDIS_PORT || '6379'),
      password: process.env.REDISPASSWORD || process.env.REDIS_PASSWORD || undefined,
      tls:      process.env.REDIS_TLS === 'true' ? { rejectUnauthorized: false } : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }
  return null; // لا يوجد Redis — BullMQ معطّل
}

const _conn = getConnection();

// إذا ما فيه Redis متوافق → نستخدم in-memory fallback بدون crash
let broadcastQueue, notifyQueue;

if (_conn) {
  try {
    const { Queue } = require('bullmq');
    broadcastQueue = new Queue('broadcast', {
      connection: _conn,
      defaultJobOptions: { attempts: 2, backoff: { type: 'exponential', delay: 3000 } }
    });
    notifyQueue = new Queue('notify', {
      connection: _conn,
      defaultJobOptions: { attempts: 3, backoff: { type: 'fixed', delay: 2000 } }
    });
    console.log('[BullMQ] ✅ Queues connected');
  } catch(e) {
    console.warn('[BullMQ] ⚠️ Queue init failed:', e.message);
    _conn && (_conn._failed = true);
  }
}

// Fallback: إذا BullMQ فشل → نفذ مباشرة بدون queue
async function safeAdd(queue, name, data) {
  if (queue) {
    try { return await queue.add(name, data); } catch(_) {}
  }
  // Fallback: in-process async
  setImmediate(async () => {
    const bot = global.__bot;
    if (!bot || !data.userIds?.length) return;
    let sent = 0;
    for (const id of data.userIds) {
      try { await bot.telegram.sendMessage(id, data.message, { parse_mode: data.parseMode || 'Markdown' }); sent++; } catch(_) {}
      if (sent % 25 === 0) await new Promise(r => setTimeout(r, 1000));
    }
    if (data.fromUid) {
      bot.telegram.sendMessage(data.fromUid, `✅ اكتمل: *${sent}* مستخدم`, { parse_mode: 'Markdown' }).catch(() => {});
    }
  });
}

module.exports = { broadcastQueue, notifyQueue, safeAdd, connection: _conn };
