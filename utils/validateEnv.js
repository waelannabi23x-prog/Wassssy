'use strict';

function validateEnv() {
  const required = ['BOT_TOKEN', 'OWNER_ID', 'DATABASE_URL', 'WEBHOOK_URL'];
  const missing  = required.filter(k => !process.env[k]);
  if (missing.length) {
    console.error('FATAL: متغيرات البيئة الناقصة:', missing.join(', '));
    process.exit(1);
  }
  if (isNaN(parseInt(process.env.OWNER_ID))) {
    console.error('FATAL: OWNER_ID يجب أن يكون رقماً');
    process.exit(1);
  }
  console.log('[INFO] ✅ Environment OK');
}

module.exports = { validateEnv };
