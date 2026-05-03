'use strict';

const logger = require('./logger');
const { all, run } = require('../database/db');

const CFG = { tickMs: 300000, batchSize: 25, batchDelayMs: 1000 }; // 5min tick // 2min tick — sufficient for notifications
let _bot = null, _owners = [], _timer = null, _lock = false;

function startScheduler(bot, owners) {
  _bot    = bot;
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
     WHERE sm.sent = 0 AND sm.send_at <= $1`, [now]
  );
  if (!rows.length) return;
  for (const row of rows) {
    try {
      const { sent, failed } = await dispatchScheduled(row);
      await run('UPDATE scheduled_messages SET sent = 1 WHERE id = $1', [row.id]);
      logger.info(`[Sched] "${row.name}" → ✅${sent} ❌${failed}`);
      notifyOwners(`✅ رسالة "${row.name}" أُرسلت\n✅ نجح: ${sent} | ❌ فشل: ${failed}`);
    } catch (e) {
      logger.error(`[Sched] id=${row.id}`, e.message);
    }
  }
}

// ✅ إرسال متوازي حقيقي مع rate control
async function dispatchScheduled(msg) {
  let uids = [];
  if (msg.target === 'all') {
    const r = await all('SELECT id FROM users WHERE is_banned = 0');
    uids = r.map(x => x.id);
  } else if (msg.target === 'specialty' && msg.specialty_id) {
    const r = await all('SELECT user_id FROM user_specialties WHERE specialty_id = $1', [msg.specialty_id]);
    uids = r.map(x => x.user_id);
  }
  if (!uids.length) return { sent: 0, failed: 0 };

  let sent = 0, failed = 0;
  for (let i = 0; i < uids.length; i += CFG.batchSize) {
    const chunk = uids.slice(i, i + CFG.batchSize);
    const results = await Promise.allSettled(
      chunk.map(uid => sendMsg(uid, msg))
    );
    results.forEach(r => r.status === 'fulfilled' ? sent++ : failed++);
    if (i + CFG.batchSize < uids.length) await sleep(CFG.batchDelayMs);
  }
  return { sent, failed };
}

async function sendMsg(uid, msg) {
  const cap = msg.content || undefined;
  if (msg.type === 'document' && msg.file_id) return _bot.telegram.sendDocument(uid, msg.file_id, { caption: cap, parse_mode: 'Markdown' });
  if (msg.type === 'photo'    && msg.file_id) return _bot.telegram.sendPhoto(uid, msg.file_id, { caption: cap, parse_mode: 'Markdown' });
  if (msg.type === 'link') return _bot.telegram.sendMessage(uid, (cap || '') + (msg.file_id ? '\n🔗 ' + msg.file_id : ''), { parse_mode: 'Markdown' });
  return _bot.telegram.sendMessage(uid, cap || '', { parse_mode: 'Markdown' });
}

async function processGroupNotifications() {
  try {
    const { getSetting } = require('../database/db');
    const setting = await getSetting('group_notify_enabled');
    if (setting === 'false') return;

    const recent = await all(
      `SELECT f.id, f.title, f.category_id, s.name AS sub_name, gc.chat_id
       FROM files f
       JOIN categories c   ON c.id  = f.category_id
       JOIN subjects s     ON s.id  = c.subject_id
       JOIN semesters sem  ON sem.id = s.semester_id
       JOIN years y        ON y.id  = sem.year_id
       JOIN group_chats gc ON gc.specialty_id = y.specialty_id
       LEFT JOIN group_notify_log gnl ON gnl.file_id = f.id AND gnl.chat_id = gc.chat_id
       WHERE f.is_deleted = 0
         AND gc.notify_new_files = 1
         AND f.uploaded_at > NOW() - INTERVAL '10 minutes'
         AND gnl.id IS NULL
       LIMIT 100`
    );
    if (!recent.length) return;

    if (!_bot._cachedUsername) {
      try { const m = await _bot.telegram.getMe(); _bot._cachedUsername = m.username; } catch (_) {}
    }
    const un = _bot._cachedUsername || null;

    // ✅ Parallel batches of 5 with 1s gap — ~5x faster, stays within Telegram limits
    const NOTIFY_BATCH = 5;
    for (let bi = 0; bi < recent.length; bi += NOTIFY_BATCH) {
      const chunk = recent.slice(bi, bi + NOTIFY_BATCH);
      await Promise.allSettled(chunk.map(async r => {
        try {
          const label = '📄 ' + r.title.substring(0, 30) + (r.sub_name ? ' · ' + r.sub_name : '');
          const kb = un ? { reply_markup: { inline_keyboard: [[{ text: '⬇️ تحميل', url: 'https://t.me/' + un + '?start=file_' + r.id }]] } } : {};
          await _bot.telegram.sendMessage(r.chat_id, '📢 *ملف جديد*\n\n' + label, { parse_mode: 'Markdown', ...kb });
          await run(
            'INSERT INTO group_notify_log(file_id, chat_id, sent_at) VALUES($1, $2, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING',
            [r.id, r.chat_id]
          ).catch(() => {});
        } catch (_) {}
      }));
      if (bi + NOTIFY_BATCH < recent.length) await sleep(1000);
    }
  } catch (_) {}
}

async function cleanup() {
  try { await run("DELETE FROM scheduled_messages WHERE sent = 1 AND created_at < NOW() - INTERVAL '7 days'"); } catch (_) {}
  try { await run("DELETE FROM group_notify_log WHERE sent_at < NOW() - INTERVAL '30 days'"); } catch (_) {}
  try { await run("DELETE FROM group_bot_msgs WHERE sent_at < NOW() - INTERVAL '3 days'"); } catch (_) {}
  try { await run("DELETE FROM ai_history WHERE created_at < NOW() - INTERVAL '7 days'"); } catch (_) {}
  try { await run("DELETE FROM logs WHERE created_at < NOW() - INTERVAL '30 days'"); } catch (_) {}
}

function notifyOwners(text) { for (const oid of _owners) _bot.telegram.sendMessage(oid, text).catch(() => {}); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { startScheduler };
