const fs = require('fs');
const path = require('path');
const BACKUP_DIR = path.join(__dirname, '../backups');

async function checkScheduledMessages(bot) {
  try {
    const messagesDb = require('../database/messages');
    const usersDb = require('../database/users');
    const pending = await messagesDb.getPending();
    for(const msg of pending) {
      // pagination بدل تحميل كل IDs دفعة وحدة
      const BATCH = 100;
      let offset = 0;
      let sent = 0, failed = 0;
      while(true) {
        let ids = [];
        if(msg.target === 'all') {
          const rows = await require('../database/db').all(
            'SELECT id FROM users WHERE is_banned=0 LIMIT ? OFFSET ?', [BATCH, offset]
          );
          ids = rows.map(r => r.id);
        } else if(msg.target === 'specialty') {
          const rows = await require('../database/db').all(
            'SELECT user_id as id FROM user_specialties WHERE specialty_id=? LIMIT ? OFFSET ?',
            [msg.specialty_id, BATCH, offset]
          );
          ids = rows.map(r => r.id);
        }
        if(!ids.length) break;
        for(let idx=0; idx<ids.length; idx++) {
          const id = ids[idx];
          try {
            if(msg.type==='text') await bot.telegram.sendMessage(id, msg.content, {parse_mode:'Markdown'});
            else if(msg.type==='photo') await bot.telegram.sendPhoto(id, msg.file_id, {caption:msg.content});
            else if(msg.type==='document') await bot.telegram.sendDocument(id, msg.file_id, {caption:msg.content});
            else if(msg.type==='link') await bot.telegram.sendMessage(id, msg.content+'\n\n'+msg.file_id);
            sent++;
          } catch { failed++; }
          await new Promise(r => setTimeout(r, idx%10===9 ? 1000 : 50));
        }
        offset += BATCH;
        if(ids.length < BATCH) break;
      }
      await messagesDb.markSent(msg.id);
      console.log('Scheduled msg sent:', msg.name, 'sent:', sent, 'failed:', failed);
    }
  } catch(e) { console.error('Scheduler msg error:', e.message); }
}

async function sendBackupStats(bot, ownerIds) {
  try {
    const { all } = require('../database/db');
    const [users, files, downloads] = await Promise.all([
      all('SELECT COUNT(*) as c FROM users'),
      all('SELECT COUNT(*) as c FROM files WHERE is_deleted=0'),
      all('SELECT SUM(downloads) as t FROM files WHERE is_deleted=0'),
    ]);
    const stamp = new Date().toLocaleDateString('en-GB');
    const msg = '💾 *Daily Backup — '+stamp+'*\n\n'+
      '👥 المستخدمون: *'+(users[0]?.c||0)+'*\n'+
      '📁 الملفات: *'+(files[0]?.c||0)+'*\n'+
      '⬇️ التحميلات: *'+(downloads[0]?.t||0)+'*';
    for(const oid of ownerIds) {
      bot.telegram.sendMessage(oid, msg, {parse_mode:'Markdown'}).catch(()=>{});
    }
  } catch(e) { console.error('Backup stats error:', e.message); }
}

function startScheduler(bot, ownerIds) {
  if(!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, {recursive:true});
  setInterval(() => checkScheduledMessages(bot), 60000);
  setTimeout(() => checkScheduledMessages(bot), 5000);
  scheduleDaily(async () => { await sendBackupStats(bot, ownerIds); });
  scheduleDaily(async () => {
    try {
      const { run } = require('../database/db');
      await run(`DELETE FROM files WHERE is_deleted=1 AND uploaded_at < NOW() - INTERVAL '30 days'`);
      await run(`DELETE FROM logs WHERE created_at < NOW() - INTERVAL '30 days'`);
      await run(`DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY viewed_at DESC LIMIT 100000)`);
      await run(`DELETE FROM cache_store WHERE expires_at < ?`, [Date.now()]);
      console.log('✅ Cleanup done');
    } catch(e) { console.error('Cleanup error:', e.message); }
  });
}

function scheduleDaily(fn) {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  setTimeout(() => { fn(); setInterval(fn, 86400000); }, midnight - now);
}

module.exports = { startScheduler };
