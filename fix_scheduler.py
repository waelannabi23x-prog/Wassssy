with open('utils/scheduler.js', 'r') as f:
    content = f.read()

# اضف logger
old = """const fs = require('fs');
const path = require('path');
const { all, run } = require('../database/db');
const messagesDb = require('../database/messages');"""

new = """const fs = require('fs');
const path = require('path');
const { all, run } = require('../database/db');
const messagesDb = require('../database/messages');
const logger = require('./logger');"""

content = content.replace(old, new)

# استبدل console
content = content.replace(
    "console.log(`📨 Broadcast",
    "logger.info(`📨 Broadcast"
)
content = content.replace(
    "console.error('Scheduler error:",
    "logger.error('Scheduler error:"
)
content = content.replace(
    "console.log('✅ Daily cleanup done')",
    "logger.info('✅ Daily cleanup done')"
)
content = content.replace(
    "console.error('Cleanup error:",
    "logger.error('Cleanup error:"
)
content = content.replace(
    "console.error('Backup stats error:",
    "logger.error('Backup stats error:"
)
content = content.replace(
    "console.log('✅ Scheduler started')",
    "logger.info('✅ Scheduler started')"
)

# اصلح history cleanup الثقيل
old_cleanup = "    await run(`DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY viewed_at DESC LIMIT 100000)`);"
new_cleanup = "    await run(`DELETE FROM history WHERE viewed_at < NOW() - INTERVAL '90 days'`);"

content = content.replace(old_cleanup, new_cleanup)

with open('utils/scheduler.js', 'w') as f:
    f.write(content)
print("✅ Fixed")
