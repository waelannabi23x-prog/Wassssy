const fs=require('fs');
const browse=fs.readFileSync('handlers/browse.js','utf8');
const inter=fs.readFileSync('database/interactions.js','utf8');
const db=fs.readFileSync('database/db.js','utf8');

// 1. شوف كل cacheSet وTTL في browse
console.log('=== Cache TTLs ===');
const cacheSets=browse.match(/cacheSet\([^)]+\)/g)||[];
cacheSets.forEach(c=>console.log(c.substring(0,80)));

// 2. شوف كل DB query في interactions
console.log('\n=== DB Queries في interactions ===');
const queries=inter.match(/await (get|all)\([^)]+\)/g)||[];
queries.forEach(q=>console.log(q.substring(0,80)));

// 3. شوف pool settings
console.log('\n=== PG Pool ===');
const pool=db.match(/max:.*|min:.*|idle.*|connection.*/g)||[];
pool.forEach(p=>console.log(p.trim()));
