const { get: dbGet } = require('./database/db');
(async () => {
  try {
    const r = await require('./database/db').run(
      'ALTER TABLE files ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0'
    );
    console.log('✅ تمت إضافة العمود (أو كان موجوداً مسبقاً)');
  } catch (e) {
    console.log('❌ خطأ:', e.message);
  }
  process.exit(0);
})();
