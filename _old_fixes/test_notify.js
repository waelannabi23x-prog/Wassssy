require('dotenv').config();
const { all } = require('./database/db');
async function test() {
  const groups = await all('SELECT chat_id, title, specialty_id FROM group_chats');
  console.log('القروبات:', groups);
  process.exit(0);
}
test().catch(e => { console.error(e.message); process.exit(1); });
