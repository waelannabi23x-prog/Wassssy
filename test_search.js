require('dotenv').config();
const filesDb = require('./database/files');
async function test() {
  const queries = ['algo 2', 'serie', 'algo', 'Algo 2'];
  for(const q of queries) {
    const r = await filesDb.search(q, 3);
    console.log(q, '→', r.length, 'نتيجة', r[0]?.title||'');
  }
}
test().finally(()=>process.exit());
