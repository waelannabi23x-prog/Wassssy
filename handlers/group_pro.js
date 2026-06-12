'use strict';
/**
 * group_pro.js — نظام إدارة القروبات الاحترافي
 */
const { run, get, all } = require('../database/db');
const { cacheGet, cacheSet, cacheClear } = require('../utils/cache');
const logger = require('../utils/logger');

// ══════════════════════════════════════════
// FLOOD TRACKER — في الذاكرة
// ══════════════════════════════════════════
const _flood = new Map(); // chatId_userId → { count, first }
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _flood) {
    if (now - v.first > 10000) _flood.delete(k);
  }
}, 10000).unref();

// ══════════════════════════════════════════
// SETTINGS — مع cache
// ══════════════════════════════════════════
async function getSettings(chatId) {
  const key = 'grp_set_' + chatId;
  const hit = cacheGet(key);
  if (hit) return hit;
  let s = await get('SELECT * FROM grp_settings WHERE chat_id=$1', [chatId]).catch(() => null);
  if (!s) {
    await run('INSERT INTO grp_settings(chat_id) VALUES($1) ON CONFLICT DO NOTHING', [chatId]).catch(() => {});
    s = { chat_id: chatId, anti_spam: false, anti_link: false, anti_flood: false,
          anti_forward: false, max_warns: 3, flood_limit: 5, flood_window: 5, warn_action: 'mute' };
  }
  cacheSet(key, s, 60000);
  return s;
}

async function updateSetting(chatId, key, val) {
  await run(`UPDATE grp_settings SET ${key}=$1, updated_at=NOW() WHERE chat_id=$2`, [val, chatId]);
  cacheClear('grp_set_' + chatId);
}

// ══════════════════════════════════════════
// LOG — سجل الأحداث
// ══════════════════════════════════════════
async function addLog(chatId, action, targetId, byId, reason, extra) {
  await run(
    'INSERT INTO grp_logs(chat_id,action,target_id,by_id,reason,extra) VALUES($1,$2,$3,$4,$5,$6)',
    [chatId, action, targetId || null, byId || null, reason || null, extra || null]
  ).catch(() => {});
}

// ══════════════════════════════════════════
// AUTO-PROTECTION MIDDLEWARE
// ══════════════════════════════════════════
async function protect(bot, ctx, next) {
  try {
    const chat = ctx.chat;
    if (!chat || !['group','supergroup'].includes(chat.type)) return next();
    const from = ctx.from;
    if (!from || from.is_bot) return next();

    // تحقق من صلاحيات البوت
    const me = await ctx.telegram.getChatMember(chat.id, ctx.botInfo?.id).catch(() => null);
    if (!me || !['administrator','creator'].includes(me.status)) return next();

    // لا نطبق على المشرفين
    const member = await ctx.telegram.getChatMember(chat.id, from.id).catch(() => null);
    if (['administrator','creator'].includes(member?.status)) return next();

    const s = await getSettings(chat.id);
    const msg = ctx.message;
    if (!msg) return next();

    const chatId = chat.id;
    const userId = from.id;
    const name = from.first_name || 'عضو';

    // ── Anti-Flood ──
    if (s.anti_flood) {
      const fk = chatId + '_' + userId;
      const now = Date.now();
      const fd = _flood.get(fk) || { count: 0, first: now };
      fd.count++;
      if (now - fd.first > (s.flood_window || 5) * 1000) {
        fd.count = 1; fd.first = now;
      }
      _flood.set(fk, fd);
      if (fd.count >= (s.flood_limit || 5)) {
        _flood.delete(fk);
        await ctx.deleteMessage().catch(() => {});
        await ctx.telegram.restrictChatMember(chatId, userId, {
          permissions: { can_send_messages: false },
          until_date: Math.floor(Date.now() / 1000) + 300,
        }).catch(() => {});
        const m = await ctx.reply(`🌊 ${name} — كتم 5 دقائق (فلود)`, { parse_mode: 'Markdown' }).catch(() => null);
        if (m) setTimeout(() => ctx.telegram.deleteMessage(chatId, m.message_id).catch(() => {}), 8000);
        await addLog(chatId, 'flood_mute', userId, null, 'فلود تلقائي', null);
        return;
      }
    }

    // ── Anti-Link ──
    if (s.anti_link) {
      const text = msg.text || msg.caption || '';
      const hasLink = /https?:\/\/|t\.me\/|@\w{4,}/.test(text);
      if (hasLink) {
        await ctx.deleteMessage().catch(() => {});
        const m = await ctx.reply(`🔗 ${name} — حذف رابط`, { parse_mode: 'Markdown' }).catch(() => null);
        if (m) setTimeout(() => ctx.telegram.deleteMessage(chatId, m.message_id).catch(() => {}), 5000);
        await addLog(chatId, 'link_delete', userId, null, 'رابط محذوف', text.substring(0, 100));
        return;
      }
    }

    // ── Anti-Forward ──
    if (s.anti_forward && msg.forward_from) {
      await ctx.deleteMessage().catch(() => {});
      const m = await ctx.reply(`↩️ ${name} — حذف forward`, { parse_mode: 'Markdown' }).catch(() => null);
      if (m) setTimeout(() => ctx.telegram.deleteMessage(chatId, m.message_id).catch(() => {}), 5000);
      return;
    }

    // ── Blacklist ──
    const text = (msg.text || msg.caption || '').toLowerCase();
    if (text) {
      const bl = await all('SELECT word FROM grp_blacklist WHERE chat_id=$1', [chatId]).catch(() => []);
      for (const row of bl) {
        if (text.includes(row.word.toLowerCase())) {
          await ctx.deleteMessage().catch(() => {});
          const m = await ctx.reply(`🚫 ${name} — كلمة محظورة`, { parse_mode: 'Markdown' }).catch(() => null);
          if (m) setTimeout(() => ctx.telegram.deleteMessage(chatId, m.message_id).catch(() => {}), 5000);
          return;
        }
      }
    }

    return next();
  } catch(e) {
    logger.debug('[protect]', e.message);
    return next();
  }
}

// ══════════════════════════════════════════
// WARN SYSTEM
// ══════════════════════════════════════════
async function warnUser(bot, chatId, userId, byId, reason) {
  const s = await getSettings(chatId);
  const maxWarns = s.max_warns || 3;

  await run(
    'INSERT INTO group_warns(chat_id,user_id,warned_by,reason,created_at) VALUES($1,$2,$3,$4,NOW())',
    [chatId, userId, byId, reason || 'مخالفة']
  ).catch(() => {});

  const cnt = await get('SELECT COUNT(*) AS c FROM group_warns WHERE chat_id=$1 AND user_id=$2', [chatId, userId])
    .then(r => parseInt(r?.c || 0)).catch(() => 0);

  await addLog(chatId, 'warn', userId, byId, reason, cnt + '/' + maxWarns);

  if (cnt >= maxWarns) {
    // تنفيذ العقوبة
    if (s.warn_action === 'ban') {
      await bot.telegram.banChatMember(chatId, userId).catch(() => {});
      await run('DELETE FROM group_warns WHERE chat_id=$1 AND user_id=$2', [chatId, userId]).catch(() => {});
      await addLog(chatId, 'auto_ban', userId, null, 'وصل ' + maxWarns + ' إنذارات', null);
      return { action: 'ban', cnt };
    } else {
      // كتم افتراضي
      await bot.telegram.restrictChatMember(chatId, userId, {
        permissions: { can_send_messages: false },
        until_date: Math.floor(Date.now() / 1000) + 3600,
      }).catch(() => {});
      await run('DELETE FROM group_warns WHERE chat_id=$1 AND user_id=$2', [chatId, userId]).catch(() => {});
      await addLog(chatId, 'auto_mute', userId, null, 'وصل ' + maxWarns + ' إنذارات', null);
      return { action: 'mute', cnt };
    }
  }
  return { action: 'warn', cnt, max: maxWarns };
}

// ══════════════════════════════════════════
// LOGS VIEWER
// ══════════════════════════════════════════
async function showLogs(ctx, chatId, page = 0) {
  const limit = 10;
  const offset = page * limit;
  const logs = await all(
    `SELECT action, target_id, by_id, reason, created_at FROM grp_logs
     WHERE chat_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [chatId, limit, offset]
  ).catch(() => []);

  if (!logs.length) return ctx.reply('📋 لا توجد سجلات').catch(() => {});

  const actionEmoji = {
    warn: '⚠️', ban: '🚫', mute: '🔇', unmute: '🔊', unban: '🔓',
    kick: '🦵', flood_mute: '🌊', link_delete: '🔗', auto_ban: '🚫🤖',
    auto_mute: '🔇🤖',
  };

  let txt = `📋 *سجل القروب* (صفحة ${page+1})\n━━━━━━━━━━━━━\n\n`;
  for (const log of logs) {
    const emoji = actionEmoji[log.action] || '📌';
    const date = new Date(log.created_at).toLocaleDateString('ar-DZ');
    txt += `${emoji} \`${log.action}\``;
    if (log.target_id) txt += ` — [${log.target_id}](tg://user?id=${log.target_id})`;
    if (log.reason) txt += ` — ${log.reason}`;
    txt += ` _(${date})_\n`;
  }

  const kb = [];
  const nav = [];
  if (page > 0) nav.push({ text: '◀️', callback_data: `grp_logs_${chatId}_${page-1}` });
  if (logs.length === limit) nav.push({ text: '▶️', callback_data: `grp_logs_${chatId}_${page+1}` });
  if (nav.length) kb.push(nav);
  kb.push([{ text: '🗑 مسح السجلات', callback_data: `grp_logs_clear_${chatId}` }]);

  return ctx.reply(txt, { parse_mode: 'Markdown', disable_web_page_preview: true, reply_markup: { inline_keyboard: kb } }).catch(() => {});
}

module.exports = { protect, getSettings, updateSetting, addLog, warnUser, showLogs };
