const { run } = require('./database/db.js');
async function test(){
  try {
    await run(`INSERT INTO users(id,first_name,last_name,username,last_active) VALUES(?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,username=EXCLUDED.username,last_active=CURRENT_TIMESTAMP`,[123,'Test','','']);
    console.log('OK');
  } catch(e) { console.log('ERROR:', e.message); }
  process.exit(0);
}
test();
