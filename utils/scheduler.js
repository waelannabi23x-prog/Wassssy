'use strict';

const logger = require('./logger');
const { all, run } = require('../database/db');

const CFG = { tickMs: 60000, batchSize: 30, batchDelayMs: 50, cleanupDays: 7 };
let _bot = null, _owners = [], _timer = null, _lock = false;

function startScheduler(bot, owners) {
  _bot = bot;
  _owners = Array.isArray(owners) ? owners : [];
  if (_timer) clearInterval(_timer);
  _timer = setInterval(tick, CFG.tickMs);
  _timer.unref();
  setTimeout(tick, 5000).unref();
  logger.info('✅ Scheduler active');
}

async function tick() {
  if (_lock || !_bot) return;
  _lock = true;
  try {
    await processScheduled();
    await processGroupNotifications();
    await cleanup();
  } catch (e) {
    logger.error('[Sched]', e.message);
  } finally {
    _lock = false;
  }
}

async function processScheduled() {
  const now = new Date().toISOString().substring(0, 19).replace('T', ' ');
  const rows = await all(
    `SELECT sm.id, sm.target, sm.specialty_id, mt.type, mt.content, mt.file_id, mt.name
     FROM scheduled_messages sm JOIN message_templates mt ON sm.template_id = mt.id
     WHERE sm.sent = 0 AND sm.send_at <= ?`, [now]
  );
  if (!rows.length) return;
  for (const row of rows) {
    try {
      const count = await dispatchScheduled(row);
      await run('UPDATE scheduled_messages SET sent = 1 WHERE id = ?', [row.id]);
      logger.info(`[Sched] "${row.name}" → ${count}`);
      notifyOwners(`✅ رسالة مجدولة "${row.name}" أُرسلت لـ ${count} مستخدم`);
    } catch (e) { logger.error(`[Sched] id=${row.id}`, e.message); }
  }
}

async function dispatchScheduled(msg) {
  let uids = [];
  if (msg.target === 'all') {
    const r = await all('SELECT id FROM users WHERE is_banned = 0');
    uids = r.map(x => x.id);
  } else if (msg.target === 'specialty' && msg.specialty_id) {
    const r = await all('SELECT user_id FROM user_specialties WHERE specialty_id = ?', [msg.specialty_id]);
    uids = r.map(x => x.user_id);
  }
  if (!uids.length) return 0;
  let sent = 0;
  for (let i = 0; i < uids.length; i++) {
    try {
      await sendMsg(uids[i], msg);
      sent++;
      if ((i + 1) % CFG.batchSize === 0) await sleep(CFG.batchDelayMs);
    } catch (_) {}
  }
  return sent;
}

async function sendMsg(uid, msg) {
  const cap = msg.content || undefined;
  if (msg.type === 'document' && msg.file_id) return _bot.telegram.sendDocument(uid, msg.file_id, { caption: cap, parse_mode: 'Markdown' });
  if (msg.type === 'photo' && msg.file_id) return _bot.telegram.sendPhoto(uid, msg.file_id, { caption: cap, parse_mode: 'Markdown' });
  if (msg.type === 'link') return _bot.telegram.sendMessage(uid, cap + (msg.file_id ? '\n🔗 ' + msg.file_id : ''), { parse_mode: 'Markdown', disable_web_page_preview: false });
  return _bot.telegram.sendMessage(uid, cap || '', { parse_mode: 'Markdown' });
}

async function processGroupNotifications() {
  try {
    const setting = await (async () => { const { getSetting } = require('../database/db'); return getSetting('group_notify_enabled'); })();
    if (setting === 'false') return;
    const recent = await all(
      `SELECT f.id, f.title, f.category_id, s.name as sub_name, s.semester_id, sem.year_id, gc.chat_id, gc.specialty_id
       FROM files f JOIN categories c ON c.id = f.category_id JOIN subjects s ON s.id = c.subject_id
       JOIN semesters sem ON sem.id = s.semester_id JOIN group_chats gc ON gc.specialty_id = sem.year_id
       LEFT JOIN group_notify_log gnl ON gnl.file_id = f.id AND gnl.chat_id = gc.chat_id
       WHERE f.is_deleted = 0 AND gc.notify_new_files = 1 AND f.uploaded_at > NOW() - INTERVAL '10 minutes' AND gnl.id IS NULL LIMIT 100`
    );
    if (!recent.length) return;
    const un = await (async () => { try { const m = await _bot.telegram.getMe(); return m.username; } catch (_) { return null; } })();
    for (const r of recent) {
      try {
        const label = '📄 ' + r.title.substring(0, 30) + (r.sub_name ? ' · ' + r.sub_name : '');
        const kb = un ? { reply_markup: { inline_keyboard: [[{ text: '⬇️ تحميل', url: 'https://t.me/' + un + '?start=file_' + r.id }]] } } : {};
        await _bot.telegram.sendMessage(r.chat_id, '📢 *ملف جديد*\n\n' + label, { parse_mode: 'Markdown', ...kb });
        await run('INSERT INTO group_notify_log(file_id, chat_id, sent_at) VALUES(?, ?, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING', [r.id, r.chat_id]).catch(() => {});
      } catch (_) {}
    }
  } catch (_) {}
}

async function cleanup() {
  try { await run("DELETE FROM scheduled_messages WHERE sent = 1 AND created_at < NOW() - INTERVAL '7 days'"); } catch (_) {}
  try { await run("DELETE FROM group_notify_log WHERE sent_at < NOW() - INTERVAL '30 days'"); } catch (_) {}
}

function notifyOwners(text) { for (const oid of _owners) _bot.telegram.sendMessage(oid, text).catch(() => {}); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { startScheduler };
