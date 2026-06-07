const fs = require('fs');
const dbPath = process.env.HOME + '/study-bot-backup-20260407_011636/database/db.js';
let db = fs.readFileSync(dbPath, 'utf8');

const oldFn = `async function initBankTables() {
  const { getPool } = require('./db');
  try {
    const pool = getPool();
    if (!pool) return;
    await pool.query('CREATE TABLE IF NOT EXISTS bank_accounts(user_id BIGINT PRIMARY KEY, username TEXT, first_name TEXT, balance NUMERIC DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
    await pool.query('CREATE TABLE IF NOT EXISTS bank_transactions(id SERIAL PRIMARY KEY, from_id BIGINT, to_id BIGINT, amount NUMERIC, type TEXT, note TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
    await pool.query('CREATE TABLE IF NOT EXISTS bank_loans(id SERIAL PRIMARY KEY, user_id BIGINT, amount NUMERIC, due_at TIMESTAMP, paid INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
    console.log('[Bank] ✅ Tables ready');
  } catch(e) { console.error('[Bank]', e.message); }
}
module.exports.initBankTables = initBankTables;`;

const newFn = `async function initBankTables() {
  const pg = getPg();
  if (!pg) return;
  try {
    await pg.query('CREATE TABLE IF NOT EXISTS bank_accounts(user_id BIGINT PRIMARY KEY, username TEXT, first_name TEXT, balance NUMERIC DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
    await pg.query('CREATE TABLE IF NOT EXISTS bank_transactions(id SERIAL PRIMARY KEY, from_id BIGINT, to_id BIGINT, amount NUMERIC, type TEXT, note TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
    await pg.query('CREATE TABLE IF NOT EXISTS bank_loans(id SERIAL PRIMARY KEY, user_id BIGINT, amount NUMERIC, due_at TIMESTAMP, paid INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
    console.log('[Bank] ✅ Tables ready');
  } catch(e) { console.error('[Bank]', e.message); }
}
module.exports.initBankTables = initBankTables;`;

db = db.replace(oldFn, newFn);
fs.writeFileSync(dbPath, db);
console.log('✅ Done');
