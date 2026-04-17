with open('index.js', 'r') as f:
    content = f.read()

old = """require("dotenv").config();"""

new = """require("dotenv").config();
const logger = require('./utils/logger');"""

content = content.replace(old, new, 1)
content = content.replace("console.log('🔧 Maintenance mode:", "logger.info('🔧 Maintenance mode:")
content = content.replace("console.log('✅ States loaded:", "logger.info('✅ States loaded:")
content = content.replace("console.error('States load error:", "logger.error('States load error:")
content = content.replace("console.error('Bot error:", "logger.error('Bot error:")
content = content.replace("console.error('CB error:", "logger.error('CB error:")
content = content.replace("console.error('grp_sp error:", "logger.error('grp_sp error:")
content = content.replace("console.error('Group join:", "logger.error('Group join:")
content = content.replace("console.error('Launch error:", "logger.error('Launch error:")
content = content.replace("console.error('⚠️ Memory critical:", "logger.error('⚠️ Memory critical:")
content = content.replace("console.log('✅ Database ready')", "logger.info('✅ Database ready')")
content = content.replace("console.log('✅ Express on port", "logger.info('✅ Express on port")
content = content.replace("console.log('🚀 Study Bot", "logger.info('🚀 Study Bot")
content = content.replace("console.error('Uncaught:", "logger.error('Uncaught:")
content = content.replace("console.error('Unhandled:", "logger.error('Unhandled:")

with open('index.js', 'w') as f:
    f.write(content)
print("✅ Logger integrated in index.js")
