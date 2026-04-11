require('dotenv').config();
const { all } = require('./database/db');
async function check() {
  const subjects = await all('SELECT id, name FROM subjects LIMIT 20');
  const cats = await all('SELECT id, name FROM categories LIMIT 20');
  console.log('المواد:', subjects);
  console.log('الفئات:', cats);
  process.exit(0);
}
check().catch(e => { console.error(e.message); process.exit(1); });
