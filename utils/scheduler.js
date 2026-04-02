const fs = require('fs');
const path = require('path');
const BACKUP_DIR = path.join(__dirname, '../backups');

async function checkScheduledMessages(bot) {
  try {
    const messagesDb = require('../database/messages');
    const usersDb = require('../database/users');
    const pending = await messagesDb.getPending();
    for(const msg of pending) {
      let ids = [];
      if(msg.target === 'all') ids = await usersDb.allIds();
      else if(msg.target === 'specialty') ids = await usersDb.getUsersBySpecialty(msg.specialty_id);
      let sent = 0, failed = 0;
      for(const id of ids) {
        try {
          if(msg.type === 'text') await bot.telegram.sendMessage(id, msg.content, {parse_mode:'Markdown'});
          else if(msg.type === 'photo') await bot.telegram.sendPhoto(id, msg.file_id, {caption:msg.content});
          else if(msg.type === 'document') await bot.telegram.sendDocument(id, msg.file_id, {caption:msg.content});
          else if(msg.type === 'link') await bot.telegram.sendMessage(id, msg.content+'\n\n'+msg.file_id);
          sent++;
        } catch { failed++; }
        await new Promise(r => setTimeout(r, 50));
      }
      await messagesDb.markSent(msg.id);
      console.log('Scheduled msg sent:', msg.name, 'sent:', sent, 'failed:', failed);
    }
  } catch(e) { console.error('Scheduler msg error:', e.message); }
}

function startScheduler(bot, ownerIds) {
  if(!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

  // Check scheduled messages every minute
  setInterval(() => checkScheduledMessages(bot), 60000);
  checkScheduledMessages(bot);

  scheduleDaily(async () => {
    try {
      const { DB_PATH } = require('../database/db');
      const stamp = new Date().toISOString().split('T')[0];
      const dest = path.join(BACKUP_DIR, 'backup_' + stamp + '.db');
      fs.copyFileSync(DB_PATH, dest);
      const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db')).sort();
      if(files.length > 7) fs.unlinkSync(path.join(BACKUP_DIR, files[0]));
      for(const oid of ownerIds) {
      bot.telegram.sendMessage(oid, 'Backup Done ' + stamp).catch(() => {});
      // Send backup file to owner
      try {
        await bot.telegram.sendDocument(oid, {source: dest, filename: 'backup_'+stamp+'.db'}, {caption: 'Daily Backup'});
      } catch(e) { console.error('Backup send error:', e.message); }
    }
      console.log('Backup:', dest);
    } catch(e) { console.error('Backup error:', e.message); }
  });

  scheduleDaily(() => {
    require('../database/interactions').clearOldLogs();
    const { run } = require('../database/db');
    run(`DELETE FROM files WHERE is_deleted=1 AND uploaded_at < datetime('now','-30 days')`);
    console.log('Cleanup done');
  });
}

function scheduleDaily(fn) {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  setTimeout(() => { fn(); setInterval(fn, 86400000); }, midnight - now);
}

module.exports = { startScheduler };
