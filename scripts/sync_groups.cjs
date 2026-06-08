
'use strict';
/**
 * sync_groups.cjs
 * يمشي على كل group_chats ويتحقق إذا البوت لا يزال فيها
 * شغّله: node scripts/sync_groups.cjs
 */

require('dotenv').config();
const { Telegraf } = require('telegraf');
const { Pool } = require('pg');

const bot = new Telegraf(process.env.BOT_TOKEN);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const { rows } = await pool.query('SELECT chat_id, title FROM group_chats WHERE is_active=1');
  console.log('🔍 عدد القروبات في DB:', rows.length);

  let active = 0, deactivated = 0;

  for (const row of rows) {
    try {
      const member = await bot.telegram.getChatMember(row.chat_id, (await bot.telegram.getMe()).id);
      if (['kicked', 'left'].includes(member.status)) {
        await pool.query('UPDATE group_chats SET is_active=0 WHERE chat_id=$1', [row.chat_id]);
        console.log('🚪 غير نشط (خرج/طُرد):', row.title || row.chat_id);
        deactivated++;
      } else {
        console.log('✅ نشط:', row.title || row.chat_id, '|', member.status);
        active++;
      }
    } catch (e) {
      // getChatMember يرمي error إذا البوت مش في القروب أو القروب محذوف
      await pool.query('UPDATE group_chats SET is_active=0 WHERE chat_id=$1', [row.chat_id]);
      console.log('❌ خطأ/غير موجود:', row.title || row.chat_id, '—', e.message);
      deactivated++;
    }
    await new Promise(r => setTimeout(r, 300)); // تجنب rate limit
  }

  console.log('\n📊 النتيجة:');
  console.log('  ✅ نشط:', active);
  console.log('  🚪 تم تعطيل:', deactivated);
  await pool.end();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
