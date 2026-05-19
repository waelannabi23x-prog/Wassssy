'use strict';
const { Queue, Worker, QueueEvents } = require('bullmq');

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  maxRetriesPerRequest: null,
};

// ─── Queues ───────────────────────────────────────────────────────
const broadcastQueue  = new Queue('broadcast',  { connection, defaultJobOptions: { attempts: 2, backoff: { type: 'exponential', delay: 3000 } } });
const notifyQueue     = new Queue('notify',     { connection, defaultJobOptions: { attempts: 3, backoff: { type: 'fixed',       delay: 2000 } } });

module.exports = { broadcastQueue, notifyQueue, connection };
