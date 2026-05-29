'use strict';
let _client = null;
function getRedisClient() {
  if (_client) return _client;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  try {
    const { Redis } = require('@upstash/redis');
    _client = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
    return _client;
  } catch(e) { require('./logger').warn('[Redis]', e.message); return null; }
}
module.exports = { getRedisClient };
