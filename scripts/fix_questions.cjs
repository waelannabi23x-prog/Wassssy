'use strict';
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function main() {
  // إصلاح الأسئلة التي correct فارغ لكن correct_answer موجود
  try {
    await pool.query(`
      UPDATE million_questions
      SET correct = LOWER(SUBSTRING(correct_answer, 1, 1))
      WHERE (correct IS NULL OR correct = '')
        AND correct_answer IS NOT NULL
        AND correct_answer != ''
    `);
    console.log('✅ updated from correct_answer');
  } catch(e) { console.log('no correct_answer column:', e.message); }

  // عرض عينة
  const { rows } = await pool.query('SELECT id, text, correct FROM million_questions LIMIT 5');
  rows.forEach(r => console.log(r.id, '|', r.correct, '|', (r.text||'').substring(0,30)));
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
