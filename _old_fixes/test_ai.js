require('dotenv').config();
const { handleAiChat } = require('./handlers/ai_chat');
const filesDb = require('./database/files');

async function test() {
  const results = await filesDb.search('algo 2', 5);
  console.log('بحث مباشر algo 2:', results.length, 'نتيجة');
  const results2 = await filesDb.search('serie', 5);
  console.log('بحث مباشر serie:', results2.length, 'نتيجة');
}
test().catch(console.error).finally(()=>process.exit());
