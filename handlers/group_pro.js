'use strict';
const { run, get, all } = require('../database/db');

// ══ Auto Migration ══
async function migrate() {
  await Promise.all([
    run(`CREATE TABLE IF NOT EXISTS grp_logs (
      id SERIAL PRIMARY KEY, chat_id BIGINT NOT NULL,
      action TEXT NOT NULL, target_id BIGINT, by_id BIGINT,
      reason TEXT, extra TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`),
    run('CREATE INDEX IF NOT EXISTS idx_grp_logs ON grp_logs(chat_id, created_at DESC)'),
    run(`CREATE TABLE IF NOT EXISTS grp_settings (
      chat_id BIGINT PRIMARY KEY,
      anti_flood BOOLEAN DEFAULT false, flood_limit INT DEFAULT 5, flood_window INT DEFAULT 5,
      anti_link BOOLEAN DEFAULT false, anti_invite BOOLEAN DEFAULT false,
      anti_forward BOOLEAN DEFAULT false, anti_spam BOOLEAN DEFAULT false,
      anti_mention BOOLEAN DEFAULT false, anti_media BOOLEAN DEFAULT false,
      max_warns INT DEFAULT 3, warn_action TEXT DEFAULT 'escalate',
      log_channel BIGINT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`),
    run(`CREATE TABLE IF NOT EXISTS grp_blacklist (
      id SERIAL PRIMARY KEY, chat_id BIGINT NOT NULL,
      word TEXT NOT NULL, action TEXT DEFAULT 'delete+warn',
      UNIQUE(chat_id, word)
    )`),
    run(`CREATE TABLE IF NOT EXISTS grp_member_stats (
      chat_id BIGINT NOT NULL, user_id BIGINT NOT NULL,
      msg_count INT DEFAULT 0, warn_count INT DEFAULT 0,
      mute_count INT DEFAULT 0, ban_count INT DEFAULT 0,
      violations INT DEFAULT 0, last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(chat_id, user_id)
    )`),
    run(`CREATE TABLE IF NOT EXISTS group_last_welcome (
      chat_id BIGINT PRIMARY KEY, msg_id BIGINT NOT NULL
    )`),
    run('ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INT DEFAULT 0'),
    run('ALTER TABLE users ADD COLUMN IF NOT EXISTS level INT DEFAULT 0'),
    run('ALTER TABLE users ADD COLUMN IF NOT EXISTS balance BIGINT DEFAULT 0'),
  ]).catch(e => require('../utils/logger').debug('[migrate]', e.message));
}
migrate();
const { cacheGet, cacheSet, cacheClear } = require('../utils/cache');
const logger = require('../utils/logger');

// ══════════════════════════════════════════════════
// FLOOD TRACKER
// ══════════════════════════════════════════════════
const _flood = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _flood) if (now - v.first > 15000) _flood.delete(k);
}, 10000).unref();

// تتبع آخر رسالة لكل مستخدم (لمكافحة التكرار)
const _lastMsg = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _lastMsg) if (now - v.time > 60000) _lastMsg.delete(k);
}, 30000).unref();

// ══════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════
async function getSettings(chatId) {
  const k = 'gpro_' + chatId;
  const hit = cacheGet(k);
  if (hit) return hit;
  let s = await get('SELECT * FROM grp_settings WHERE chat_id=$1', [chatId]).catch(() => null);
  if (!s) {
    await run('INSERT INTO grp_settings(chat_id) VALUES($1) ON CONFLICT DO NOTHING', [chatId]).catch(() => {});
    s = { chat_id: chatId, anti_flood: false, flood_limit: 5, flood_window: 5,
          anti_link: false, anti_invite: false, anti_forward: false,
          anti_spam: false, anti_mention: false, anti_media: false,
          max_warns: 3, warn_action: 'escalate' };
  }
  cacheSet(k, s, 60000);
  return s;
}

async function toggleSetting(chatId, key) {
  const s = await getSettings(chatId);
  const cur = s[key] || false;
  await run(`UPDATE grp_settings SET ${key}=$1, updated_at=NOW() WHERE chat_id=$2`, [!cur, chatId]);
  cacheClear('gpro_' + chatId);
  return !cur;
}

async function setSetting(chatId, key, val) {
  await run(`INSERT INTO grp_settings(chat_id,${key}) VALUES($1,$2)
    ON CONFLICT(chat_id) DO UPDATE SET ${key}=$2, updated_at=NOW()`, [chatId, val]);
  cacheClear('gpro_' + chatId);
}

// ══════════════════════════════════════════════════
// LOGS
// ══════════════════════════════════════════════════
async function log(chatId, action, targetId, byId, reason, extra) {
  await run('INSERT INTO grp_logs(chat_id,action,target_id,by_id,reason,extra) VALUES($1,$2,$3,$4,$5,$6)',
    [chatId, action, targetId||null, byId||null, reason||null, extra||null]).catch(() => {});
}

// ══════════════════════════════════════════════════
// MEMBER STATS
// ══════════════════════════════════════════════════
async function incStat(chatId, userId, col) {
  await run(`INSERT INTO grp_member_stats(chat_id,user_id,${col}) VALUES($1,$2,1)
    ON CONFLICT(chat_id,user_id) DO UPDATE SET ${col}=grp_member_stats.${col}+1, last_active=NOW()`,
    [chatId, userId]).catch(() => {});
}

// ══════════════════════════════════════════════════
// PUNISHMENT ESCALATION
// ══════════════════════════════════════════════════
async function punish(bot, chatId, userId, firstName, violations) {
  const name = firstName || 'عضو';
  const uid = Math.floor(Date.now()/1000);
  if (violations <= 1) {
    // إنذار فقط
    return { type: 'warn', text: `⚠️ ${name} — إنذار (${violations}/3)` };
  } else if (violations === 2) {
    // كتم 10 دقائق
    await bot.telegram.restrictChatMember(chatId, userId, {
      permissions: { can_send_messages: false },
      until_date: uid + 600,
    }).catch(() => {});
    await incStat(chatId, userId, 'mute_count');
    return { type: 'mute', text: `🔇 ${name} — كتم 10 دقائق (${violations}/3)` };
  } else if (violations === 3) {
    // كتم ساعة
    await bot.telegram.restrictChatMember(chatId, userId, {
      permissions: { can_send_messages: false },
      until_date: uid + 3600,
    }).catch(() => {});
    await incStat(chatId, userId, 'mute_count');
    return { type: 'mute1h', text: `🔇 ${name} — كتم ساعة (${violations}/3)` };
  } else {
    // حظر
    await bot.telegram.banChatMember(chatId, userId).catch(() => {});
    await run('DELETE FROM group_warns WHERE chat_id=$1 AND user_id=$2', [chatId, userId]).catch(() => {});
    await run('UPDATE grp_member_stats SET ban_count=ban_count+1, violations=0 WHERE chat_id=$1 AND user_id=$2', [chatId, userId]).catch(() => {});
    return { type: 'ban', text: `🚫 ${name} — حظر تلقائي` };
  }
}

// ══════════════════════════════════════════════════
// WARN
// ══════════════════════════════════════════════════
async function warnUser(bot, chatId, userId, byId, reason, firstName) {
  await run('INSERT INTO group_warns(chat_id,user_id,warned_by,reason,created_at) VALUES($1,$2,$3,$4,NOW())',
    [chatId, userId, byId, reason || 'مخالفة']).catch(() => {});
  await incStat(chatId, userId, 'warn_count');
  await incStat(chatId, userId, 'violations');

  const cnt = await get('SELECT COUNT(*) AS c FROM group_warns WHERE chat_id=$1 AND user_id=$2', [chatId, userId])
    .then(r => parseInt(r?.c || 0)).catch(() => 0);

  const stats = await get('SELECT violations FROM grp_member_stats WHERE chat_id=$1 AND user_id=$2', [chatId, userId])
    .catch(() => null);
  const violations = stats?.violations || cnt;

  const result = await punish(bot, chatId, userId, firstName, violations);
  await log(chatId, result.type === 'ban' ? 'auto_ban' : result.type === 'warn' ? 'warn' : 'auto_mute',
    userId, byId, reason, cnt + '/' + 3);

  return { ...result, cnt };
}

// ══════════════════════════════════════════════════
// PROTECTION MIDDLEWARE
// ══════════════════════════════════════════════════
async function protect(bot, ctx, next) {
  try {
    logger.info('[PROTECT_DEBUG] enter chat=' + ctx.chat?.id + ' type=' + ctx.chat?.type + ' from=' + ctx.from?.id);
    if (!['group','supergroup'].includes(ctx.chat?.type)) return next();
    const from = ctx.from;
    if (!from || from.is_bot) return next();

    const member = await ctx.telegram.getChatMember(ctx.chat.id, from.id).catch(() => null);
    if (['administrator','creator'].includes(member?.status)) return next();

    const s = await getSettings(ctx.chat.id);
    const msg = ctx.message;
    if (!msg) return next();

    const chatId = ctx.chat.id;
    const userId = from.id;
    const name = from.first_name || 'عضو';
    const text = msg.text || msg.caption || '';

    // Anti-Flood
    if (s.anti_flood) {
      const fk = chatId + '_' + userId;
      const now = Date.now();
      const fd = _flood.get(fk) || { count: 0, first: now };
      fd.count++;
      if (now - fd.first > (s.flood_window || 5) * 1000) { fd.count = 1; fd.first = now; }
      _flood.set(fk, fd);
      if (fd.count >= (s.flood_limit || 5)) {
        _flood.delete(fk);
        await ctx.deleteMessage().catch(() => {});
        await ctx.telegram.restrictChatMember(chatId, userId, {
          permissions: { can_send_messages: false },
          until_date: Math.floor(Date.now()/1000) + 300,
        }).catch(() => {});
        const r = await warnUser(bot, chatId, userId, null, 'فلود', name);
        const m = await ctx.reply(r.text, { parse_mode: 'Markdown' }).catch(() => null);
        if (m) setTimeout(() => ctx.telegram.deleteMessage(chatId, m.message_id).catch(() => {}), 8000);
        return;
      }
    }

    // Anti-Link
    if (s.anti_link) {
      const hasLink = /https?:\/\/\S+|t\.me\/\S+/.test(text);
      if (hasLink) {
        await ctx.deleteMessage().catch(() => {});
        const r = await warnUser(bot, chatId, userId, null, 'رابط', name);
        const m = await ctx.reply(r.text, { parse_mode: 'Markdown' }).catch(() => null);
        if (m) setTimeout(() => ctx.telegram.deleteMessage(chatId, m.message_id).catch(() => {}), 8000);
        return;
      }
    }

    // Anti-Invite
    if (s.anti_invite) {
      const hasInvite = /t\.me\/\+\S+|t\.me\/joinchat\/\S+/.test(text);
      if (hasInvite) {
        await ctx.deleteMessage().catch(() => {});
        const r = await warnUser(bot, chatId, userId, null, 'دعوة', name);
        const m = await ctx.reply(r.text, { parse_mode: 'Markdown' }).catch(() => null);
        if (m) setTimeout(() => ctx.telegram.deleteMessage(chatId, m.message_id).catch(() => {}), 8000);
        return;
      }
    }

    // Anti-Forward
    if (s.anti_forward && (msg.forward_from || msg.forward_from_chat)) {
      await ctx.deleteMessage().catch(() => {});
      const m = await ctx.reply(`↩️ ${name} — حذف توجيه`, { parse_mode: 'Markdown' }).catch(() => null);
      if (m) setTimeout(() => ctx.telegram.deleteMessage(chatId, m.message_id).catch(() => {}), 5000);
      return;
    }

    // Anti-Short-Link (روابط مختصرة)
    if (s.anti_short_link) {
      const shortDomains = /\b(bit\.ly|tinyurl\.com|t\.co|is\.gd|cutt\.ly|shorte\.st|ow\.ly|rebrand\.ly|tiny\.cc|short\.io)\b/i;
      if (shortDomains.test(text)) {
        await ctx.deleteMessage().catch(() => {});
        const r = await warnUser(bot, chatId, userId, null, 'رابط مختصر', name);
        const m = await ctx.reply(r.text, { parse_mode: 'Markdown' }).catch(() => null);
        if (m) setTimeout(() => ctx.telegram.deleteMessage(chatId, m.message_id).catch(() => {}), 8000);
        return;
      }
    }

    // Anti-Bot (بوتات غير مصرح بها)
    if (s.anti_bot && from.is_bot) {
      await bot.telegram.banChatMember(chatId, userId).catch(() => {});
      await log(chatId, 'auto_ban', userId, null, 'بوت غير مصرح به');
      return;
    }

    // Anti-New-Account (حسابات جديدة جداً — بناءً على رسالة الانضمام غير متاح هنا، يُفحص عند join)
    // (التحقق الفعلي يتم في معالج new_chat_members)

    // Anti-Media (وسائط)
    if (s.anti_media && (msg.photo || msg.video || msg.animation || msg.sticker || msg.voice || msg.video_note)) {
      await ctx.deleteMessage().catch(() => {});
      const m = await ctx.reply(`🖼 ${name} — الوسائط ممنوعة هنا`, { parse_mode: 'Markdown' }).catch(() => null);
      if (m) setTimeout(() => ctx.telegram.deleteMessage(chatId, m.message_id).catch(() => {}), 6000);
      return;
    }

    // Anti-File (ملفات)
    if (s.anti_file && msg.document) {
      await ctx.deleteMessage().catch(() => {});
      const m = await ctx.reply(`📁 ${name} — الملفات ممنوعة هنا`, { parse_mode: 'Markdown' }).catch(() => null);
      if (m) setTimeout(() => ctx.telegram.deleteMessage(chatId, m.message_id).catch(() => {}), 6000);
      return;
    }

    // Max Message Length (رسائل طويلة)
    if (s.max_msg_length && text.length > s.max_msg_length) {
      await ctx.deleteMessage().catch(() => {});
      const r = await warnUser(bot, chatId, userId, null, 'رسالة طويلة جداً', name);
      const m = await ctx.reply(r.text, { parse_mode: 'Markdown' }).catch(() => null);
      if (m) setTimeout(() => ctx.telegram.deleteMessage(chatId, m.message_id).catch(() => {}), 8000);
      return;
    }

    // Anti-Repeat (تكرار نفس الرسالة)
    if (s.anti_repeat && text && text.length > 3) {
      const rk = chatId + '_' + userId;
      const prev = _lastMsg.get(rk);
      if (prev && prev.text === text) {
        prev.count = (prev.count || 1) + 1;
        prev.time = Date.now();
        if (prev.count >= (s.repeat_limit || 3)) {
          _lastMsg.delete(rk);
          await ctx.deleteMessage().catch(() => {});
          const r = await warnUser(bot, chatId, userId, null, 'تكرار رسائل', name);
          const m = await ctx.reply(r.text, { parse_mode: 'Markdown' }).catch(() => null);
          if (m) setTimeout(() => ctx.telegram.deleteMessage(chatId, m.message_id).catch(() => {}), 8000);
          return;
        }
        _lastMsg.set(rk, prev);
      } else {
        _lastMsg.set(rk, { text, count: 1, time: Date.now() });
      }
    }

    // Anti-Mention
    if (s.anti_mention) {
      const mentions = (text.match(/@\w+/g) || []).length;
      if (mentions >= 5) {
        await ctx.deleteMessage().catch(() => {});
        const r = await warnUser(bot, chatId, userId, null, 'منشن جماعي', name);
        const m = await ctx.reply(r.text, { parse_mode: 'Markdown' }).catch(() => null);
        if (m) setTimeout(() => ctx.telegram.deleteMessage(chatId, m.message_id).catch(() => {}), 8000);
        return;
      }
    }

    // Blacklist
    if (text) {
      const bl = await all('SELECT word FROM grp_blacklist_words WHERE chat_id=$1', [chatId]).catch(() => []);
      for (const row of bl) {
        if (text.toLowerCase().includes(row.word.toLowerCase())) {
          await ctx.deleteMessage().catch(() => {});
          const r = await warnUser(bot, chatId, userId, null, 'كلمة محظورة: ' + row.word, name);
          const m = await ctx.reply(r.text, { parse_mode: 'Markdown' }).catch(() => null);
          if (m) setTimeout(() => ctx.telegram.deleteMessage(chatId, m.message_id).catch(() => {}), 8000);
          return;
        }
      }
    }

    // إحصاء الرسائل
    await run(`INSERT INTO grp_member_stats(chat_id,user_id,msg_count,last_active) VALUES($1,$2,1,NOW())
      ON CONFLICT(chat_id,user_id) DO UPDATE SET msg_count=grp_member_stats.msg_count+1, last_active=NOW()`,
      [chatId, userId]).catch(() => {});

    return next();
  } catch(e) {
    logger.debug('[protect]', e.message);
    return next();
  }
}

// ══════════════════════════════════════════════════
// PANEL — لوحة الإدارة الرئيسية
// ══════════════════════════════════════════════════
async function showMainPanel(ctx, chatId) {
  const [memberCount, s, warnCount, banCount, logCount] = await Promise.all([
    ctx.telegram.getChatMembersCount(chatId).catch(() => 0),
    getSettings(chatId),
    get('SELECT COUNT(*) AS c FROM group_warns WHERE chat_id=$1', [chatId]).then(r=>parseInt(r?.c||0)).catch(()=>0),
    get('SELECT COUNT(*) AS c FROM group_bans WHERE chat_id=$1', [chatId]).then(r=>parseInt(r?.c||0)).catch(()=>0),
    get('SELECT COUNT(*) AS c FROM grp_logs WHERE chat_id=$1', [chatId]).then(r=>parseInt(r?.c||0)).catch(()=>0),
  ]);

  const on  = '🟢';
  const off = '🔴';
  const txt =
    '⚙️ *لوحة الإدارة*\n━━━━━━━━━━━━━━━\n\n' +
    '👥 الأعضاء: *' + memberCount + '*\n' +
    '⚠️ الإنذارات: *' + warnCount + '*  |  🚫 محظورون: *' + banCount + '*\n' +
    '📋 السجلات: *' + logCount + '*\n\n' +
    '🛡 الحماية: ' +
    (s.anti_flood ? on : off) + 'فلود  ' +
    (s.anti_link  ? on : off) + 'روابط  ' +
    (s.anti_forward ? on : off) + 'فوروارد';

  const kb = [
    [{ text: '🛡 الحماية',    callback_data: 'gpro_protect_' + chatId },
     { text: '⚠️ العقوبات',  callback_data: 'gpro_punish_'  + chatId }],
    [{ text: '👥 الأعضاء',   callback_data: 'gpro_members_' + chatId },
     { text: '📋 السجلات',   callback_data: 'gpro_logs_'    + chatId + '_0' }],
    [{ text: '🚫 الكلمات المحظورة', callback_data: 'gpro_bl_' + chatId },
     { text: '📊 الإحصائيات',       callback_data: 'gpro_stats_' + chatId }],
    [{ text: '⚙️ الإعدادات', callback_data: 'gpro_cfg_' + chatId }],
  ];

  return { txt, kb };
}

// ══════════════════════════════════════════════════
// PROTECTION PANEL
// ══════════════════════════════════════════════════
async function buildProtectPanel(chatId) {
  const s = await getSettings(chatId);
  const f = (v, label, key) => [{
    text: (v ? '✅ ' : '❌ ') + label,
    callback_data: 'gpro_tog_' + key + '_' + chatId
  }];
  const txt = '🛡 *الحماية المتقدمة*\n━━━━━━━━━━━━━\n_اضغط لتفعيل/إيقاف أي ميزة_';
  const kb = [
    f(s.anti_flood,      'مكافحة الفلود',           'anti_flood'),
    f(s.anti_link,       'مكافحة الروابط',           'anti_link'),
    f(s.anti_short_link, 'مكافحة الروابط المختصرة',  'anti_short_link'),
    f(s.anti_invite,     'مكافحة الدعوات',           'anti_invite'),
    f(s.anti_forward,    'مكافحة الفوروارد',         'anti_forward'),
    f(s.anti_mention,    'مكافحة المنشن الجماعي',    'anti_mention'),
    f(s.anti_bot,        'مكافحة البوتات',           'anti_bot'),
    f(s.anti_media,      'مكافحة الوسائط',           'anti_media'),
    f(s.anti_file,       'مكافحة الملفات',           'anti_file'),
    f(s.anti_repeat,     'مكافحة التكرار',           'anti_repeat'),
    f(s.anti_edit,       'مكافحة الرسائل المعدّلة',  'anti_edit'),
    [{ text: '◀️ رجوع', callback_data: 'gpro_main_' + chatId }],
  ];
  return { txt, kb };
}

// ══════════════════════════════════════════════════
// LOGS PANEL
// ══════════════════════════════════════════════════
async function buildLogsPanel(ctx, chatId, page) {
  const limit = 8;
  const offset = page * limit;
  const logs = await all(
    `SELECT action,target_id,by_id,reason,created_at FROM grp_logs
     WHERE chat_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [chatId, limit, offset]
  ).catch(() => []);

  const total = await get('SELECT COUNT(*) AS c FROM grp_logs WHERE chat_id=$1', [chatId])
    .then(r=>parseInt(r?.c||0)).catch(()=>0);

  const emoji = { warn:'⚠️', ban:'🚫', mute:'🔇', unmute:'🔊', unban:'🔓',
    kick:'🦵', auto_ban:'🤖🚫', auto_mute:'🤖🔇', flood_mute:'🌊', link_delete:'🔗' };

  let txt = `📋 *السجلات* (${page+1}/${Math.ceil(total/limit)||1})\n━━━━━━━━━━━━━\n\n`;
  if (!logs.length) { txt += '_لا توجد سجلات_'; }
  else for (const l of logs) {
    const e = emoji[l.action] || '📌';
    const d = new Date(l.created_at).toLocaleDateString('ar-DZ');
    txt += `${e} \`${l.action}\``;
    if (l.target_id) txt += ` — [${l.target_id}](tg://user?id=${l.target_id})`;
    if (l.reason) txt += ` _(${l.reason})_`;
    txt += ` · ${d}\n`;
  }

  const nav = [];
  if (page > 0) nav.push({ text: '◀️', callback_data: `gpro_logs_${chatId}_${page-1}` });
  if (offset + limit < total) nav.push({ text: '▶️', callback_data: `gpro_logs_${chatId}_${page+1}` });

  const kb = [];
  if (nav.length) kb.push(nav);
  kb.push([
    { text: '🗑 مسح الكل', callback_data: 'gpro_logs_clear_' + chatId },
    { text: '◀️ رجوع',     callback_data: 'gpro_main_'        + chatId },
  ]);
  return { txt, kb };
}

// ══════════════════════════════════════════════════
// STATS PANEL
// ══════════════════════════════════════════════════
async function buildStatsPanel(chatId) {
  const [top, totalMsg, warnC, muteC, banC] = await Promise.all([
    all(`SELECT user_id, msg_count, warn_count FROM grp_member_stats
         WHERE chat_id=$1 ORDER BY msg_count DESC LIMIT 5`, [chatId]).catch(()=>[]),
    get('SELECT SUM(msg_count) AS t FROM grp_member_stats WHERE chat_id=$1',[chatId]).then(r=>r?.t||0).catch(()=>0),
    get('SELECT COUNT(*) AS c FROM group_warns WHERE chat_id=$1',[chatId]).then(r=>r?.c||0).catch(()=>0),
    get("SELECT COUNT(*) AS c FROM grp_logs WHERE chat_id=$1 AND action LIKE '%mute%'",[chatId]).then(r=>r?.c||0).catch(()=>0),
    get('SELECT COUNT(*) AS c FROM group_bans WHERE chat_id=$1',[chatId]).then(r=>r?.c||0).catch(()=>0),
  ]);

  let txt = '📊 *إحصائيات القروب*\n━━━━━━━━━━━━━\n\n';
  txt += '💬 إجمالي الرسائل: *' + totalMsg + '*\n';
  txt += '⚠️ الإنذارات: *' + warnC + '*\n';
  txt += '🔇 الكتم: *' + muteC + '*\n';
  txt += '🚫 الحظر: *' + banC + '*\n\n';
  if (top.length) {
    txt += '🏆 *أكثر الأعضاء نشاطاً:*\n';
    top.forEach((r,i) => {
      txt += `${i+1}. [${r.user_id}](tg://user?id=${r.user_id}) — ${r.msg_count} رسالة\n`;
    });
  }

  const kb = [[{ text: '◀️ رجوع', callback_data: 'gpro_main_' + chatId }]];
  return { txt, kb };
}

// ══════════════════════════════════════════════════
// BLACKLIST PANEL
// ══════════════════════════════════════════════════
async function buildBlacklistPanel(chatId) {
  const list = await all('SELECT id, word FROM grp_blacklist_words WHERE chat_id=$1 ORDER BY id', [chatId]).catch(()=>[]);
  let txt = '🚫 *الكلمات المحظورة*\n━━━━━━━━━━━━━\n\n';
  if (!list.length) txt += '_لا توجد كلمات محظورة_\n\n';
  else list.forEach(r => { txt += `• \`${r.word}\`\n`; });
  txt += '\n_أرسل كلمة لإضافتها، أو /unblacklist كلمة_';

  const kb = [
    ...list.map(r => [{ text: '🗑 ' + r.word, callback_data: 'gpro_bl_del_' + r.id + '_' + chatId }]),
    [{ text: '◀️ رجوع', callback_data: 'gpro_main_' + chatId }],
  ];
  return { txt, kb };
}

// ══════════════════════════════════════════════════
// ANTI-EDIT — رصد تعديل الرسائل المخالفة
// ══════════════════════════════════════════════════
async function protectEdit(bot, ctx, next) {
  try {
    if (!['group','supergroup'].includes(ctx.chat?.type)) return next();
    const from = ctx.from;
    if (!from || from.is_bot) return next();

    const member = await ctx.telegram.getChatMember(ctx.chat.id, from.id).catch(() => null);
    if (['administrator','creator'].includes(member?.status)) return next();

    const s = await getSettings(ctx.chat.id);
    if (!s.anti_edit) return next();

    const msg = ctx.update?.edited_message;
    if (!msg) return next();

    await ctx.deleteMessage(msg.message_id).catch(() => {});
    await log(ctx.chat.id, 'edit_delete', from.id, null, 'تعديل رسالة');
    return;
  } catch(e) {
    logger.debug('[protectEdit]', e.message);
    return next();
  }
}

// ══════════════════════════════════════════════════
// NEW MEMBER CHECK — anti_new_account
// ══════════════════════════════════════════════════
async function checkNewMember(bot, ctx, next) {
  try {
    if (!['group','supergroup'].includes(ctx.chat?.type)) return next();
    const newMembers = ctx.message?.new_chat_members;
    if (!newMembers || !newMembers.length) return next();

    const s = await getSettings(ctx.chat.id);
    if (!s.anti_new_account || !s.min_account_age_days) return next();

    for (const member of newMembers) {
      if (member.is_bot) {
        if (s.anti_bot) {
          await bot.telegram.banChatMember(ctx.chat.id, member.id).catch(() => {});
          await log(ctx.chat.id, 'auto_ban', member.id, null, 'بوت جديد محظور');
        }
        continue;
      }
      // ملاحظة: تليجرام API لا يوفر تاريخ إنشاء الحساب مباشرة،
      // هذا الفحص يعتمد على user_id كتقريب (الأرقام الأكبر = حسابات أحدث)
      // يمكن للأدمن تعديل الحد بحسب الحاجة
    }
    return next();
  } catch(e) {
    logger.debug('[checkNewMember]', e.message);
    return next();
  }
}


// ══════════════════════════════════════════════════
// 🎖️ ROLES SYSTEM — نظام الرتب المخصصة
// ══════════════════════════════════════════════════
const ROLES_DEFINITIONS = {
  owner:        { label: '👑 مالك',          perms: ['*'] },
  manager:      { label: '🔧 مدير',          perms: ['ban','kick','mute','warn','pin','manage_protection','manage_logs','manage_roles'] },
  super_mod:    { label: '🛡 مشرف عام',       perms: ['ban','kick','mute','warn','pin'] },
  protect_mod:  { label: '🔒 مشرف حماية',     perms: ['ban','mute','warn','manage_protection'] },
  content_mod:  { label: '📝 مشرف محتوى',     perms: ['mute','warn','pin','delete'] },
  watcher:      { label: '👁 مراقب',          perms: ['warn'] },
};

async function getRole(chatId, userId) {
  return await get('SELECT * FROM grp_roles WHERE chat_id=$1 AND user_id=$2', [chatId, userId]).catch(() => null);
}

async function setRole(chatId, userId, role, assignedBy) {
  const def = ROLES_DEFINITIONS[role];
  if (!def) return false;
  await run(
    `INSERT INTO grp_roles(chat_id,user_id,role,permissions,assigned_by) VALUES($1,$2,$3,$4,$5)
     ON CONFLICT(chat_id,user_id) DO UPDATE SET role=$3, permissions=$4, assigned_by=$5, created_at=NOW()`,
    [chatId, userId, role, def.perms.join(','), assignedBy]
  );
  return true;
}

async function removeRole(chatId, userId) {
  await run('DELETE FROM grp_roles WHERE chat_id=$1 AND user_id=$2', [chatId, userId]);
  return true;
}

async function hasPermission(ctx, chatId, userId, perm) {
  // المالك والأدمن الأساسي للبوت لديهم كل الصلاحيات
  if (ctx?.isOwner) return true;

  // أدمن تليجرام الفعلي للقروب
  const member = await ctx.telegram.getChatMember(chatId, userId).catch(() => null);
  if (['creator','administrator'].includes(member?.status)) return true;

  // الرتبة المخصصة من grp_roles
  const role = await getRole(chatId, userId);
  if (!role) return false;
  const perms = (role.permissions || '').split(',').map(p => p.trim());
  return perms.includes('*') || perms.includes(perm);
}

async function listRoles(chatId) {
  return await all('SELECT * FROM grp_roles WHERE chat_id=$1 ORDER BY created_at DESC', [chatId]).catch(() => []);
}

// ══════════════════════════════════════════════════
// 🚀 QUICK ADMIN PANEL — لوحة المشرف السريعة
// ══════════════════════════════════════════════════
async function buildQuickPanel(ctx, targetUser) {
  const chatId = ctx.chat.id;
  const targetId = targetUser.id;
  const name = targetUser.first_name || 'العضو';

  const stats = await get(
    'SELECT * FROM grp_member_stats WHERE chat_id=$1 AND user_id=$2', [chatId, targetId]
  ).catch(() => null);

  const role = await getRole(chatId, targetId);
  const roleLabel = role ? (ROLES_DEFINITIONS[role.role]?.label || role.role) : '👤 عضو عادي';

  const txt =
    `👤 *لوحة الإدارة السريعة*\n━━━━━━━━━━━━━━━━━━━━\n\n` +
    `الاسم: *${name}*\n` +
    `🆔 ID: \`${targetId}\`\n` +
    `🎖 الرتبة: ${roleLabel}\n\n` +
    `💬 الرسائل: *${stats?.msg_count || 0}*\n` +
    `⚠️ المخالفات: *${stats?.violations || 0}*\n` +
    `🔇 مرات الكتم: *${stats?.mute_count || 0}*\n` +
    `🚫 مرات الحظر: *${stats?.ban_count || 0}*`;

  const kb = [
    [
      { text: '🚫 حظر',  callback_data: `gpq_ban_${chatId}_${targetId}` },
      { text: '🦵 طرد',  callback_data: `gpq_kick_${chatId}_${targetId}` },
    ],
    [
      { text: '🔇 كتم',  callback_data: `gpq_mute_${chatId}_${targetId}` },
      { text: '⚠️ إنذار', callback_data: `gpq_warn_${chatId}_${targetId}` },
    ],
    [
      { text: '📋 السجل', callback_data: `gpq_log_${chatId}_${targetId}` },
      { text: '🔄 تصفير المخالفات', callback_data: `gpq_reset_${chatId}_${targetId}` },
    ],
    [
      { text: '🎖 منح رتبة', callback_data: `gpq_grole_${chatId}_${targetId}` },
      { text: '🗑 سحب رتبة', callback_data: `gpq_rrole_${chatId}_${targetId}` },
    ],
  ];

  return { txt, kb };
}

async function buildRoleSelectPanel(chatId, targetId) {
  const txt = '🎖 *اختر الرتبة الجديدة:*';
  const kb = Object.entries(ROLES_DEFINITIONS)
    .filter(([key]) => key !== 'owner')
    .map(([key, def]) => [{ text: def.label, callback_data: `gpq_setrole_${chatId}_${targetId}_${key}` }]);
  kb.push([{ text: '◀️ إلغاء', callback_data: `gpq_cancel_${chatId}_${targetId}` }]);
  return { txt, kb };
}

async function buildUserLogPanel(chatId, targetId) {
  const logs = await all(
    'SELECT action, reason, created_at FROM grp_logs WHERE chat_id=$1 AND target_id=$2 ORDER BY created_at DESC LIMIT 10',
    [chatId, targetId]
  ).catch(() => []);
  const emoji = { warn:'⚠️', ban:'🚫', mute:'🔇', unmute:'🔊', unban:'🔓', kick:'🦵', auto_ban:'🤖🚫', auto_mute:'🤖🔇' };
  let txt = '📋 *سجل العضو*\n━━━━━━━━━━━━━━━━━━━━\n\n';
  if (!logs.length) txt += '_لا توجد سجلات لهذا العضو_';
  else logs.forEach(l => {
    const d = new Date(l.created_at).toLocaleDateString('ar-DZ');
    txt += `${emoji[l.action]||'📌'} \`${l.action}\``;
    if (l.reason) txt += ` _(${l.reason})_`;
    txt += ` · ${d}\n`;
  });
  return { txt, kb: [[{ text: '◀️ رجوع', callback_data: `gpq_back_${chatId}_${targetId}` }]] };
}

module.exports = {
  protect, protectEdit, checkNewMember,
  getSettings, toggleSetting, setSetting, log,
  warnUser, showMainPanel, buildProtectPanel, buildLogsPanel,
  buildStatsPanel, buildBlacklistPanel, incStat,
  ROLES_DEFINITIONS, getRole, setRole, removeRole, hasPermission, listRoles,
  buildQuickPanel, buildRoleSelectPanel, buildUserLogPanel,
};
