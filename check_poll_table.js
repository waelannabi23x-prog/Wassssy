require('dotenv').config();
const { get, all } = require('./database/db');
(async () => {
  const cols = await all(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='poll_votes' ORDER BY ordinal_position"
  ).catch(e => { console.log('خطأ:', e.message); return []; });
  console.log('أعمدة poll_votes الحقيقية:');
  console.log(cols);
})();
