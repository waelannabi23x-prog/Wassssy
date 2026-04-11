require('dotenv').config({path: process.env.HOME+'/study-bot/.env'});
const initSqlJs = require('sql.js');
const fs = require('fs');
const { Pool } = require('pg');
const path = require('path');

const DB_PATH = process.env.HOME+'/study-bot/study_bot.db';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function migrate() {
  console.log('Loading SQLite...');
  const SQL = await initSqlJs();
  const db = new SQL.Database(await fs.promises.readFile(DB_PATH));

  function all(sql) {
    const stmt = db.prepare(sql);
    const rows = [];
    while(stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }

  const tables = [
    { name: 'users', cols: ['id','first_name','last_name','username','is_banned','joined_at','last_active'] },
    { name: 'admins', cols: ['user_id','added_by','permissions','specialty_id','added_at'] },
    { name: 'specialties', cols: ['id','name','is_deleted'] },
    { name: 'years', cols: ['id','specialty_id','name','is_deleted'] },
    { name: 'semesters', cols: ['id','year_id','name','is_deleted'] },
    { name: 'subjects', cols: ['id','semester_id','name','is_deleted'] },
    { name: 'categories', cols: ['id','subject_id','name','is_deleted'] },
    { name: 'files', cols: ['id','category_id','title','description','file_id','file_type','downloads','uploaded_by','is_deleted','uploaded_at'] },
    { name: 'favorites', cols: ['user_id','file_id'] },
    { name: 'history', cols: ['id','user_id','file_id','viewed_at'] },
    { name: 'ratings', cols: ['user_id','file_id','rating'] },
    { name: 'user_specialties', cols: ['user_id','specialty_id'] },
    { name: 'settings', cols: ['key','value'] },
    { name: 'bundles', cols: ['id','category_id','title','description','downloads','created_at'] },
    { name: 'bundle_files', cols: ['id','bundle_id','file_id','file_type','title'] },
    { name: 'message_templates', cols: ['id','name','type','content','file_id','created_at'] },
    { name: 'scheduled_messages', cols: ['id','template_id','target','specialty_id','send_at','sent','created_at'] },
  ];

  for(const {name, cols} of tables) {
    try {
      const rows = all('SELECT * FROM '+name);
      if(!rows.length){ console.log(name+': empty, skip'); continue; }
      let inserted = 0;
      for(const row of rows) {
        const vals = cols.map(c => row[c] !== undefined ? row[c] : null);
        const ph = cols.map((_,i) => '$'+(i+1)).join(',');
        try {
          await pool.query(`INSERT INTO ${name}(${cols.join(',')}) VALUES(${ph}) ON CONFLICT DO NOTHING`, vals);
          inserted++;
        } catch(e) { console.error(name+' row error:', e.message.substring(0,60)); }
      }
      console.log('✅ '+name+': '+inserted+'/'+rows.length);
    } catch(e) { console.log('⚠️ '+name+': '+e.message.substring(0,60)); }
  }

  // Reset sequences
  const seqTables = ['specialties','years','semesters','subjects','categories','files','history','logs','bundles','bundle_files','message_templates','scheduled_messages'];
  for(const t of seqTables) {
    try {
      await pool.query(`SELECT setval(pg_get_serial_sequence('${t}','id'), COALESCE(MAX(id),0)+1) FROM ${t}`);
    } catch(e) {}
  }

  console.log('✅ Migration done!');
  await pool.end();
  process.exit(0);
}

migrate().catch(e => { console.error('Migration failed:', e.message); process.exit(1); });
