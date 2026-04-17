with open('database/db.js', 'r') as f:
    content = f.read()

old = """  const indexes = ["""

new = """  // pg_trgm للبحث السريع
  if(pg) {
    try {
      await pg.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
      await pg.query("CREATE INDEX IF NOT EXISTS idx_files_title_trgm ON files USING GIN(title gin_trgm_ops)");
      await pg.query("CREATE INDEX IF NOT EXISTS idx_files_desc_trgm ON files USING GIN(description gin_trgm_ops)");
      await pg.query("CREATE INDEX IF NOT EXISTS idx_subjects_name_trgm ON subjects USING GIN(name gin_trgm_ops)");
      logger.info('✅ pg_trgm indexes ready');
    } catch(e) { logger.warn('⚠️ pg_trgm skipped:', e.message); }
  }

  const indexes = ["""

if old in content:
    content = content.replace(old, new, 1)
    with open('database/db.js', 'w') as f:
        f.write(content)
    print("✅ Fixed")
else:
    print("❌ Not found")
