'use strict';
const { cacheGet, cacheSet, cacheClearPrefix, cacheClear } = require('../utils/cache');
const filesDb = require('../database/files');
const { parseQuery, scoreFile } = require('../utils/searchParser');
const SEARCH_SVC = process.env.SEARCH_SERVICE_URL || 'http://localhost:3001';
const USE_GO_SEARCH = false;
function _getCached(key){return cacheGet('gsrc_'+key);}
function _setCached(key,data){cacheSet('gsrc_'+key,data,300000);}
async function _goSearch(q,limit){
  if(!USE_GO_SEARCH)return null;
  try{
    const ctrl=new AbortController();
    const tid=setTimeout(()=>ctrl.abort(),600);
    const res=await fetch(`${SEARCH_SVC}/search?q=${encodeURIComponent(q)}&limit=${limit}`,{signal:ctrl.signal});
    clearTimeout(tid);
    if(res.ok)return await res.json();
  }catch(_){}
  return null;
}
async function smartSearch(rawQ,limit){
  limit=limit||15;
  const{terms,raw}=parseQuery(rawQ);
  if(!terms.length)return[];
  const cacheKey=raw.slice(0,60);
  const cached=_getCached(cacheKey);
  if(cached)return cached;
  const allResults=new Map();
  const goRes=await _goSearch(raw,limit*2);
  if(goRes&&goRes.length)goRes.forEach(f=>allResults.set(f.id,f));
  const pgTerms=[...new Set([raw,...terms])].slice(0,4);
  const pgResults=await Promise.all(pgTerms.map(t=>filesDb.search(t,limit).catch(()=>[])));
  for(const arr of pgResults)arr.forEach(f=>{if(!allResults.has(f.id))allResults.set(f.id,f);});
  const final=[...allResults.values()]
    .map(f=>({f,s:scoreFile(f,terms)}))
    .filter(x=>x.s>0)
    .sort((a,b)=>b.s-a.s)
    .slice(0,limit)
    .map(x=>x.f);
  _setCached(cacheKey,final);
  return final;
}
function invalidateSearchCache(){
  cacheClearPrefix('search_');cacheClearPrefix('gsrc_');
  cacheClear('latest_15');cacheClear('popular_15');
  if(USE_GO_SEARCH)fetch(`${SEARCH_SVC}/reindex`,{method:'POST'}).catch(()=>{});
}
global._clearSearchCache=invalidateSearchCache;
module.exports={smartSearch,invalidateSearchCache};
