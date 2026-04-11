with open('database/db.js', 'r') as f:
    content = f.read()

old = """const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, '..', 'study_bot.db');"""

new = """const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, '..', 'study_bot.db');
const logger = require('../utils/logger');"""

content = content.replace(old, new)
content = content.replace("console.error('PG pool error:", "logger.error('PG pool error:")
content = content.replace("console.log('✅ Using PostgreSQL')", "logger.info('✅ Using PostgreSQL')")
content = content.replace("console.log('✅ Using better-sqlite3')", "logger.info('✅ Using better-sqlite3')")
content = content.replace("console.log('⚠️ Using sql.js fallback')", "logger.warn('⚠️ Using sql.js fallback')")
content = content.replace("console.warn(`⚠️ DB", "logger.warn(`⚠️ DB")
content = content.replace("console.error('DB all FAILED:", "logger.error('DB all FAILED:")
content = content.replace("console.error('DB all error:", "logger.error('DB all error:")
content = content.replace("console.error('DB run FAILED:", "logger.error('DB run FAILED:")
content = content.replace("console.error('DB run error:", "logger.error('DB run error:")
content = content.replace("console.error('Table error:", "logger.error('Table error:")
content = content.replace("console.log('✅ DB schema ready')", "logger.info('✅ DB schema ready')")
content = content.replace("console.log('✅ Using PostgreSQL')", "logger.info('✅ Using PostgreSQL')")

with open('database/db.js', 'w') as f:
    f.write(content)
print("✅ Logger integrated in db.js")
