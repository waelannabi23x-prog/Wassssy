const fs = require('fs');
const path = require('path');
const { all, run } = require('../database/db');
const messagesDb = require('../database/messages');
const logger = require('./logger');

const BACKUP_DIR = path.join(__dirname, '../backups');
let isRunning = false;

// delay ذكي — أبطأ كلما كثر الإرسال لتجنب flood
function smartDelay(idx) {
  if(idx < 10)  return 30;
  if(idx < 50)  return 50;
  if(idx < 200) return 100;
  return 200;
}

async function checkScheduledMessages(bot) {
  if(isRunning) return;
  isRunning = true;
  try {
    const pending = await messagesDb.getPending();
    if(!pending.length) { isRunning = false; return; }

    for(const msg of pending) {
      const BATCH = 100;
      let offset = 0, sent = 0, failed = 0, globalIdx = 0;

      while(true) {
        let rows = [];
        if(msg.target === 'all') {
          rows = await all('SELECT id FROM users WHERE is_banned=0 LIMIT ? OFFSET ?', [BATCH, offset]);
        } else if(msg.target === 'specialty') {
          rows = await all('SELECT user_id as id FROM user_specialties WHERE specialty_id=? LIMIT ? OFFSET ?', [msg.specialty_id, BATCH, offset]);
        }
        if(!rows.length) break;

        for(const row of rows) {
          try {
            if(msg.type==='text')
              await bot.telegram.sendMessage(row.id, msg.content, { parse_mode:'Markdown' });
            else if(msg.type==='photo')
              await bot.telegram.sendPhoto(row.id, msg.file_id, { caption:msg.content, parse_mode:'Markdown' });
            else if(msg.type==='document')
              await bot.telegram.sendDocument(row.id, msg.file_id, { caption:msg.content, parse_mode:'Markdown' });
            else if(msg.type==='link')
              await bot.telegram.sendMessage(row.id, (msg.content||'')+'\n\n'+msg.file_id);
            sent++;
          } catch(e) {
            failed++;
            // إذا flood wait — انتظر المطلوب
            if(e.parameters?.retry_after) {
              await new Promise(r=>setTimeout(r, e.parameters.retry_after * 1000));
            }
          }
          await new Promise(r=>setTimeout(r, smartDelay(globalIdx++)));
        }

        offset += BATCH;
        if(rows.length < BATCH) break;
      }

      await messagesDb.markSent(msg.id);
      logger.info(`📨 Broadcast "${msg.name}" — ✅${sent} ❌${failed}`);
    }
  } catch(e) { logger.error('Scheduler error:', e.message); }
  isRunning = false;
}

async function sendBackupStats(bot, ownerIds) {
  try {
    const [users, files, downloads] = await Promise.all([
      all('SELECT COUNT(*) as c FROM users'),
      all('SELECT COUNT(*) as c FROM files WHERE is_deleted=0'),
      all('SELECT SUM(downloads) as t FROM files WHERE is_deleted=0'),
    ]);
    const msg =
      '📊 *تقرير يومي — ' + new Date().toLocaleDateString('ar-DZ') + '*\n\n' +
      '👥 المستخدمون: *' + (users[0]?.c||0) + '*\n' +
      '📁 الملفات: *' + (files[0]?.c||0) + '*\n' +
      '⬇️ التحميلات: *' + (downloads[0]?.t||0) + '*';
    for(const oid of ownerIds) {
      bot.telegram.sendMessage(oid, msg, { parse_mode:'Markdown' }).catch(()=>{});
    }
  } catch(e) { logger.error('Backup stats error:', e.message); }
}

async function dailyCleanup() {
  try {
    await run(`DELETE FROM files WHERE is_deleted=1 AND uploaded_at < NOW() - INTERVAL '30 days'`);
    await run(`DELETE FROM logs WHERE created_at < NOW() - INTERVAL '30 days'`);
    await run(`DELETE FROM history WHERE viewed_at < NOW() - INTERVAL '90 days'`);
    await run(`DELETE FROM cache_store WHERE expires_at::bigint < $1::bigint`, [Date.now()]);
    logger.info('✅ Daily cleanup done');
  } catch(e) { logger.error('Cleanup error:', e.message); }
}

function scheduleDaily(fn) {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24,0,0,0);
  const msToMidnight = midnight - now;
  setTimeout(() => { fn(); setInterval(fn, 86400000); }, msToMidnight);
}

async function startScheduler(bot, ownerIds) {
  try {
    await fs.promises.access(BACKUP_DIR);
  } catch (e) {
    await fs.promises.mkdir(BACKUP_DIR, { recursive: true });
  }
  setInterval(() => checkScheduledMessages(bot), 60000);
  setTimeout(() => checkScheduledMessages(bot), 5000);
  scheduleDaily(() => sendBackupStats(bot, ownerIds));
  scheduleDaily(dailyCleanup);
  logger.info('✅ Scheduler started');
}

module.exports = { startScheduler };
