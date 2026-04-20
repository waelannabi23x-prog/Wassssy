'use strict';
const { cacheGet, cacheSet, cacheClearPrefix, cacheClear } = require('../utils/cache');
const filesDb = require('../database/files');

const SEARCH_SVC = process.env.SEARCH_SERVICE_URL || 'http://localhost:3001';
const USE_GO_SEARCH = !process.env.DISABLE_GO_SEARCH;

function _getGSC(q)        { return cacheGet('gsrc_' + q.toLowerCase().trim()); }
function _setGSC(q, data)  { cacheSet('gsrc_' + q.toLowerCase().trim(), data, 300000); }

// Fast path: Go in-memory search service (<1ms)
async function _goSearch(q, limit) {
  if (!USE_GO_SEARCH) return null;
  try {
    const url  = `${SEARCH_SVC}/search?q=${encodeURIComponent(q)}&limit=${limit}`;
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 500);
    const res  = await fetch(url, { signal: ctrl.signal });
    clearTimeout(tid);
    if (res.ok) return await res.json();
  } catch (_) {}
  return null;
}

async function smartSearch(rawQ, limit = 10) {
  const q       = rawQ.replace(/[%;\\]/g, '').trim();
  const cached  = _getGSC(q);
  if (cached) return cached;

  // 1️⃣ Try Go search (sub-ms in-memory)
  const goResults = await _goSearch(q, limit);
  if (goResults && goResults.length >= 3) {
    _setGSC(q, goResults);
    return goResults;
  }

  // 2️⃣ Fallback: PostgreSQL
  let results = await filesDb.search(q, limit);
  _setGSC(q, results);

  // 3️⃣ Multi-word fallback
  if (results.length < 3) {
    const words = q.split(/\s+/).filter(w => w.length >= 2);
    if (words.length > 1) {
      const extras = new Map();
      for (const w of words) {
        const wr = _getGSC(w) || await filesDb.search(w, limit);
        _setGSC(w, wr);
        for (const f of wr) if (!results.find(x => x.id === f.id)) extras.set(f.id, f);
      }
      results = [...results, ...extras.values()].slice(0, limit);
      _setGSC(q, results);
    }
  }
  return results;
}

// Invalidate search caches (call after file add/delete)
function invalidateSearchCache() {
  cacheClearPrefix('search_');
  cacheClearPrefix('gsrc_');
  cacheClear('latest_15');
  cacheClear('popular_15');
  // Trigger Go service re-index
  if (USE_GO_SEARCH) {
    fetch(`${SEARCH_SVC}/reindex`, { method: 'POST' }).catch(() => {});
  }
}

global._clearSearchCache = invalidateSearchCache;

module.exports = { smartSearch, invalidateSearchCache };
