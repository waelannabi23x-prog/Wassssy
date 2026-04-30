'use strict';
// ✅ Cached admin check — eliminates repeated getChatMember API calls
const { cacheGet, cacheSet } = require('./cache');
const ADMIN_TTL = 300000; // 5 minutes

async function getAdminCached(telegram, chatId, userId) {
  const key = 'adm_' + chatId + '_' + userId;
  const cached = cacheGet(key);
  if (cached !== null) return cached === 1;
  try {
    const member = await telegram.getChatMember(chatId, userId);
    const isAdmin = ['administrator', 'creator'].includes(member?.status);
    cacheSet(key, isAdmin ? 1 : 0, ADMIN_TTL);
    return isAdmin;
  } catch (_) {
    return false;
  }
}

function invalidateAdminCache(chatId, userId) {
  const { cacheClear } = require('./cache');
  cacheClear('adm_' + chatId + '_' + userId);
}

module.exports = { getAdminCached, invalidateAdminCache };
