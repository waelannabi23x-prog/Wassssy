'use strict';
/**
 * 📊 handlers/group_info_panel.js
 * لوحة /info احترافية — كل شيء في الخاص + تنقل بـ editMessage
 *
 * بادئة الـ callbacks: inf_
 *   inf_main_<uid>_<chatId>     ← الصفحة الرئيسية
 *   inf_ban_<uid>_<chatId>      ← تأكيد الحظر
 *   inf_kick_<uid>_<chatId>     ← تأكيد الطرد
 *   inf_mute_<uid>_<chatId>     ← خيارات الكتم
 *   inf_mute_t_<mins>_<uid>_<chatId>  ← تنفيذ الكتم بمدة
 *   inf_unmute_<uid>_<chatId>   ← رفع الكتم
 *   inf_warn_<uid>_<chatId>     ← تأكيد الإنذار
 *   inf_warns_<uid>_<chatId>    ← عرض الإنذارات
 *   inf_clrwarn_<uid>_<chatId>  ← مسح الإنذارات
 *   inf_perms_<uid>_<chatId>    ← لوحة الصلاحيات
 *   inf_ptog_<perm>_<uid>_<chatId>  ← تبديل صلاحية
 *   inf_role_<uid>_<chatId>     ← لوحة الرتب
 *   inf_setrole_<role>_<uid>_<chatId>  ← تعيين رتبة
 *   inf_rmrole_<uid>_<chatId>   ← إزالة رتبة
 *   inf_viol_<uid>_<chatId>     ← مخالفات الحماية
 *   inf_rstviol_<uid>_<chatId>  ← تصفير المخالفات
 *   inf_approve_<uid>_<chatId>  ← استثناء
 *   inf_unapprove_<uid>_<chatId>← إلغاء استثناء
 *   inf_watch_<uid>_<chatId>    ← مراقبة
 *   inf_promote_<uid>_<chatId>  ← ترقية TG
 *   inf_demote_<uid>_<chatId>   ← تنزيل TG
 */

const { get, all, run } = require('../database/db');
const proDb = require('../database/group_pro_db');
const { getEffectiveRole, roleLabel, ROLE_ORDER, ROLE_LABELS, clearRoleCache } = require('./group_roles');
const { violationLabel } = require('./group_protection');
const logger = require('../utils/logger');

const OWNER_ID = parseInt(process.env.OWNER_ID || '0');

// ══════════════════════════════════════════════════════════
// 🔧 مساعدات
// ══════════════════════════════════════════════════════════
function parse(data, prefix) {
  const rest = data.replace(prefix, '');
  const parts = rest.split('_');
  const chatId = parseInt(parts.pop());
  const uid    = parseInt(parts.pop());
  return { uid, chatId, extra: parts.join('_') };
}

function mention(uid, name) {
  return '[' + (name || uid) + '](tg://user?id=' + uid + ')';
}

function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }

async function loadMemberData(telegram, chatId, uid) {
  const [member, warnsRow, userRow, msgRow, proRole, violations, approved] = await Promise.all([
    telegram.getChatMember(chatId, uid).catch(() => null),
    get('SELECT COUNT(*)::int AS c FROM group_warns WHERE chat_id=$1 AND user_id=$2', [chatId, uid]).catch(() => ({ c: 0 })),
    get('SELECT xp, level, balance FROM users WHERE id=$1', [uid]).catch(() => null),
    get('SELECT msg_count, first_name FROM group_members WHERE chat_id=$1 AND user_id=$2', [chatId, uid]).catch(() => null),
    proDb.getRole(chatId, uid).catch(() => null),
    proDb.getViolationCount(chatId, uid, 24).catch(() => 0),
    get('SELECT 1 FROM grp_approved WHERE chat_id=$1 AND user_id=$2', [chatId, uid]).catch(() => null),
  ]);
  const name = [member?.user?.first_name, member?.user?.last_name].filter(Boolean).join(' ') || msgRow?.first_name || 'مستخدم';
  const username = member?.user?.username || '';
  const status = member?.status || 'unknown';
  const isAdm = ['administrator', 'creator'].includes(status);
  const warns = parseInt(warnsRow?.c || 0);
  return { member, name, username, status, isAdm, warns, userRow, msgCount: msgRow?.msg_count || 0, proRole, violations, approved: !!approved };
}

const STATUS_LABELS = {
  member: '👤 عضو', administrator: '🛡 مشرف', creator: '👑 صاحب',
  restricted: '🔒 مقيّد', left: '🚪 غادر', kicked: '🚫 محظور', unknown: '❓',
};

// ══════════════════════════════════════════════════════════
// 🏠 الصفحة الرئيسية
// ══════════════════════════════════════════════════════════
function mainText(d, uid) {
  const { name, username, status, isAdm, warns, userRow, msgCount, proRole, violations, approved } = d;
  let t = '⚡ *لوحة التحكم بالعضو*\n━━━━━━━━━━━━━━━━━━\n\n';
  t += '👤 ' + mention(uid, name) + '\n';
  t += '🆔 `' + uid + '`' + (username ? '  @' + username : '') + '\n';
  t += '📊 الحالة: ' + (STATUS_LABELS[status] || status) + '\n';
  if (proRole) t += '🎭 الرتبة: *' + roleLabel(proRole) + '*\n';
  if (approved) t += '✅ مستثنى من الحماية\n';
  t += '\n📈 *الإحصائيات*\n';
  t += '⚠️ الإنذارات: *' + warns + '*   🛡 المخالفات (24س): *' + violations + '*\n';
  if (msgCount) t += '💬 الرسائل: *' + fmt(msgCount) + '*\n';
  if (userRow) {
    if (userRow.balance != null) t += '💰 الرصيد: *' + fmt(userRow.balance) + ' $*\n';
    if (userRow.xp != null)     t += '🏆 XP: *' + userRow.xp + '* — المستوى: *' + (userRow.level || 0) + '*\n';
  }
  return t;
}

function mainKb(uid, chatId, d) {
  const p = uid + '_' + chatId;
  return { inline_keyboard: [
    [{ text: '🚫 حظر',      callback_data: 'inf_ban_' + p },
     { text: '🦵 طرد',      callback_data: 'inf_kick_' + p }],
    [{ text: '🔇 كتم',      callback_data: 'inf_mute_' + p },
     { text: '⚠️ إنذار',   callback_data: 'inf_warn_' + p }],
    [{ text: '🔊 رفع كتم',  callback_data: 'inf_unmute_' + p },
     { text: '📋 الإنذارات',callback_data: 'inf_warns_' + p }],
    [{ text: '🎛 الصلاحيات',callback_data: 'inf_perms_' + p },
     { text: '🛡 المخالفات',callback_data: 'inf_viol_' + p }],
    [{ text: '🎭 الرتب',    callback_data: 'inf_role_' + p },
     d.approved
       ? { text: '❌ إلغاء استثناء الحماية', callback_data: 'inf_unapprove_' + p }
       : { text: '✅ استثناء من الحماية',     callback_data: 'inf_approve_'   + p }],
    [{ text: '👁 مراقبة',   callback_data: 'inf_watch_' + p },
     { text: '♻️ تصفير كل',callback_data: 'inf_rstviol_' + p }],
    [d.isAdm
      ? { text: '⬇️ إزالة من المشرفين', callback_data: 'inf_demote_' + p }
      : { text: '⬆️ ترقية لمشرف TG',   callback_data: 'inf_promote_' + p }],
  ]};
}

function backBtn(uid, chatId) {
  return { text: '◀️ رجوع', callback_data: 'inf_main_' + uid + '_' + chatId };
}

// ══════════════════════════════════════════════════════════
// 🔒 لوحة الصلاحيات
// ══════════════════════════════════════════════════════════
const PERMS_DEF = [
  { key: 'can_send_messages',         label: '💬 إرسال رسائل' },
  { key: 'can_send_photos',           label: '🖼 إرسال صور' },
  { key: 'can_send_videos',           label: '🎬 إرسال فيديو' },
  { key: 'can_send_other_messages',   label: '🎭 ملصقات/GIF' },
  { key: 'can_send_polls',            label: '📊 استطلاعات' },
  { key: 'can_add_web_page_previews', label: '🔗 معاينة الروابط' },
  { key: 'can_invite_users',          label: '➕ دعوة أعضاء' },
  { key: 'can_pin_messages',          label: '📌 تثبيت رسائل' },
];

async function buildPermsPanel(telegram, uid, chatId) {
  const member = await telegram.getChatMember(chatId, uid).catch(() => null);
  // الصلاحيات تجي مباشرة على member للأعضاء العاديين
  function getPerm(key) {
    if (member?.permissions && member.permissions[key] !== undefined) return member.permissions[key] !== false;
    if (member?.[key] !== undefined) return member[key] !== false;
    return true; // افتراضي: مسموح
  }

  let t = '🎛 *الصلاحيات*\n━━━━━━━━━━━━━━━━━━\n\n';
  const rows = PERMS_DEF.map(p => {
    const val = getPerm(p.key);
    t += (val ? '✅' : '⬜') + ' ' + p.label + '\n';
    return [{ text: (val ? '✅ ' : '⬜ ') + p.label, callback_data: 'inf_ptog_' + p.key + '_' + uid + '_' + chatId }];
  });
  rows.push([backBtn(uid, chatId)]);
  return { text: t, kb: { inline_keyboard: rows } };
}

// ══════════════════════════════════════════════════════════
// 🎭 لوحة الرتب
// ══════════════════════════════════════════════════════════
async function buildRolePanel(uid, chatId, currentRole) {
  let t = '🎭 *الرتب والصلاحيات*\n━━━━━━━━━━━━━━━━━━\n\n';
  t += 'الرتبة الحالية: *' + (currentRole ? roleLabel(currentRole) : 'لا توجد') + '*\n\nاختر رتبة:';
  const rows = ROLE_ORDER.map(r => [{
    text: (r === currentRole ? '✅ ' : '') + ROLE_LABELS[r],
    callback_data: 'inf_setrole_' + r + '_' + uid + '_' + chatId,
  }]);
  if (currentRole) rows.push([{ text: '🗑 إزالة الرتبة', callback_data: 'inf_rmrole_' + uid + '_' + chatId }]);
  rows.push([backBtn(uid, chatId)]);
  return { text: t, kb: { inline_keyboard: rows } };
}

// ══════════════════════════════════════════════════════════
// 🛡 لوحة المخالفات
// ══════════════════════════════════════════════════════════
async function buildViolPanel(uid, chatId) {
  const settings = await proDb.getRawSettings(chatId).catch(() => null);
  const hrs = settings?.violation_window_hours || 24;
  const count = await proDb.getViolationCount(chatId, uid, hrs);
  const history = await proDb.getViolationHistory(chatId, uid, 8);
  let t = '🛡 *مخالفات الحماية*\n━━━━━━━━━━━━━━━━━━\n\n';
  t += 'العدد (' + hrs + 'س): *' + count + '*\n\n';
  if (!history.length) { t += '_لا توجد مخالفات._'; }
  else {
    history.forEach(h => {
      const time = new Date(h.created_at).toLocaleString('ar-DZ', { hour12: false, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      t += '• ' + violationLabel(h.type) + ' — _' + time + '_\n';
    });
  }
  const kb = { inline_keyboard: [
    [{ text: '♻️ تصفير المخالفات', callback_data: 'inf_rstviol_' + uid + '_' + chatId }],
    [backBtn(uid, chatId)],
  ]};
  return { text: t, kb };
}

// ══════════════════════════════════════════════════════════
// ⚠️ لوحة الإنذارات
// ══════════════════════════════════════════════════════════
async function buildWarnsPanel(uid, chatId) {
  const rows = await all('SELECT reason, created_at FROM group_warns WHERE chat_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 10', [chatId, uid]).catch(() => []);
  let t = '⚠️ *الإنذارات*\n━━━━━━━━━━━━━━━━━━\n\n';
  t += 'العدد: *' + rows.length + '*\n\n';
  if (!rows.length) { t += '_لا توجد إنذارات._'; }
  else rows.forEach((r, i) => {
    const time = new Date(r.created_at).toLocaleString('ar-DZ', { hour12: false, day: '2-digit', month: '2-digit' });
    t += (i + 1) + '. ' + (r.reason || 'مخالفة') + ' — _' + time + '_\n';
  });
  const kb = { inline_keyboard: [
    [{ text: '🗑 مسح كل الإنذارات', callback_data: 'inf_clrwarn_' + uid + '_' + chatId }],
    [backBtn(uid, chatId)],
  ]};
  return { text: t, kb };
}

// ══════════════════════════════════════════════════════════
// 🔇 لوحة الكتم
// ══════════════════════════════════════════════════════════
function buildMutePanel(uid, chatId) {
  const p = uid + '_' + chatId;
  return {
    text: '🔇 *كتم العضو*\n━━━━━━━━━━━━━━━━━━\n\nاختر مدة الكتم:',
    kb: { inline_keyboard: [
      [{ text: '⏱ 10 دقائق',  callback_data: 'inf_mute_t_10_' + p },
       { text: '⏱ 30 دقيقة',  callback_data: 'inf_mute_t_30_' + p }],
      [{ text: '⏱ ساعة',      callback_data: 'inf_mute_t_60_' + p },
       { text: '⏱ 6 ساعات',   callback_data: 'inf_mute_t_360_' + p }],
      [{ text: '⏱ 24 ساعة',   callback_data: 'inf_mute_t_1440_' + p },
       { text: '♾️ دائم',      callback_data: 'inf_mute_t_0_' + p }],
      [backBtn(uid, chatId)],
    ]},
  };
}

// ══════════════════════════════════════════════════════════
// 🚫 تأكيد الحظر
// ══════════════════════════════════════════════════════════
function buildBanPanel(uid, chatId, name) {
  return {
    text: '🚫 *تأكيد الحظر*\n━━━━━━━━━━━━━━━━━━\n\nهل تريد حظر ' + mention(uid, name) + '؟',
    kb: { inline_keyboard: [
      [{ text: '✅ نعم، حظر', callback_data: 'inf_banc_' + uid + '_' + chatId },
       { text: '❌ إلغاء',   callback_data: 'inf_main_' + uid + '_' + chatId }],
    ]},
  };
}

// ══════════════════════════════════════════════════════════
// 🚀 الإرسال والتحديث
// ══════════════════════════════════════════════════════════
async function edit(ctx, text, kb) {
  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    reply_markup: kb,
  }).catch(() => {});
  await ctx.answerCbQuery('').catch(() => {});
}

async function toast(ctx, msg, alert) {
  await ctx.answerCbQuery(msg, alert ? { show_alert: true } : undefined).catch(() => {});
}

// ══════════════════════════════════════════════════════════
// 🔁 الموجّه الرئيسي
// ══════════════════════════════════════════════════════════
async function handleCallback(ctx, data) {
  if (!data.startsWith('inf_')) return false;

  // تصفير مخالفات + إنذارات من أي مكان
  if (data.startsWith('inf_rstviol_')) {
    const { uid, chatId } = parse(data, 'inf_rstviol_');
    await proDb.resetViolations(chatId, uid);
    await run('DELETE FROM group_warns WHERE chat_id=$1 AND user_id=$2', [chatId, uid]).catch(() => {});
    await toast(ctx, '♻️ تم تصفير المخالفات والإنذارات', true);
    const d = await loadMemberData(ctx.telegram, chatId, uid);
    return edit(ctx, mainText(d, uid), mainKb(uid, chatId, d));
  }

  // ── الصفحة الرئيسية ──
  if (data.startsWith('inf_main_')) {
    const { uid, chatId } = parse(data, 'inf_main_');
    const d = await loadMemberData(ctx.telegram, chatId, uid);
    return edit(ctx, mainText(d, uid), mainKb(uid, chatId, d));
  }

  // ── تأكيد الحظر ──
  if (data.startsWith('inf_ban_') && !data.startsWith('inf_banc_')) {
    const { uid, chatId } = parse(data, 'inf_ban_');
    const d = await loadMemberData(ctx.telegram, chatId, uid);
    const p = buildBanPanel(uid, chatId, d.name);
    return edit(ctx, p.text, p.kb);
  }
  if (data.startsWith('inf_banc_')) {
    const { uid, chatId } = parse(data, 'inf_banc_');
    try {
      await ctx.telegram.banChatMember(chatId, uid);
      await run('INSERT INTO group_bans(chat_id,user_id,banned_by,reason) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [chatId, uid, ctx.from.id, 'من لوحة /info']).catch(() => {});
      await toast(ctx, '✅ تم الحظر');
      const d = await loadMemberData(ctx.telegram, chatId, uid);
      return edit(ctx, mainText(d, uid), mainKb(uid, chatId, d));
    } catch (e) { return toast(ctx, '❌ ' + e.message, true); }
  }

  // ── الطرد ──
  if (data.startsWith('inf_kick_')) {
    const { uid, chatId } = parse(data, 'inf_kick_');
    try {
      await ctx.telegram.banChatMember(chatId, uid);
      await ctx.telegram.unbanChatMember(chatId, uid);
      await toast(ctx, '✅ تم الطرد');
      const d = await loadMemberData(ctx.telegram, chatId, uid);
      return edit(ctx, mainText(d, uid), mainKb(uid, chatId, d));
    } catch (e) { return toast(ctx, '❌ ' + e.message, true); }
  }

  // ── لوحة الكتم ──
  if (data.startsWith('inf_mute_') && !data.startsWith('inf_mute_t_')) {
    const { uid, chatId } = parse(data, 'inf_mute_');
    const p = buildMutePanel(uid, chatId);
    return edit(ctx, p.text, p.kb);
  }
  if (data.startsWith('inf_mute_t_')) {
    const rest = data.replace('inf_mute_t_', '');
    const parts = rest.split('_');
    const chatId = parseInt(parts.pop());
    const uid    = parseInt(parts.pop());
    const mins   = parseInt(parts.join('_'));
    try {
      const perms = { can_send_messages: false, can_send_media_messages: false, can_send_polls: false, can_send_other_messages: false };
      const until = mins > 0 ? Math.floor(Date.now() / 1000) + mins * 60 : undefined;
      await ctx.telegram.restrictChatMember(chatId, uid, { permissions: perms, until_date: until });
      const label = mins === 0 ? 'دائم' : mins < 60 ? mins + 'د' : mins < 1440 ? (mins/60) + 'س' : (mins/1440) + 'ي';
      await toast(ctx, '✅ تم الكتم ' + label);
      const d = await loadMemberData(ctx.telegram, chatId, uid);
      return edit(ctx, mainText(d, uid), mainKb(uid, chatId, d));
    } catch (e) { return toast(ctx, '❌ ' + e.message, true); }
  }

  // ── رفع الكتم ──
  if (data.startsWith('inf_unmute_')) {
    const { uid, chatId } = parse(data, 'inf_unmute_');
    try {
      let chat;
      try { chat = await ctx.telegram.getChat(chatId); } catch (_) {}
      const defaultPerms = chat?.permissions || { can_send_messages: true, can_send_media_messages: true, can_send_polls: true, can_send_other_messages: true, can_add_web_page_previews: true };
      await ctx.telegram.restrictChatMember(chatId, uid, { permissions: defaultPerms });
      await toast(ctx, '✅ تم رفع الكتم');
      const d = await loadMemberData(ctx.telegram, chatId, uid);
      return edit(ctx, mainText(d, uid), mainKb(uid, chatId, d));
    } catch (e) { return toast(ctx, '❌ ' + e.message, true); }
  }

  // ── الإنذار ──
  if (data.startsWith('inf_warn_') && !data.startsWith('inf_warns_')) {
    const { uid, chatId } = parse(data, 'inf_warn_');
    try {
      await run('INSERT INTO group_warns(chat_id,user_id,warned_by,reason,created_at) VALUES($1,$2,$3,$4,NOW())',
        [chatId, uid, ctx.from.id, 'من لوحة /info']).catch(() => {});
      await toast(ctx, '✅ تم الإنذار');
      const d = await loadMemberData(ctx.telegram, chatId, uid);
      return edit(ctx, mainText(d, uid), mainKb(uid, chatId, d));
    } catch (e) { return toast(ctx, '❌ ' + e.message, true); }
  }

  // ── قائمة الإنذارات ──
  if (data.startsWith('inf_warns_')) {
    const { uid, chatId } = parse(data, 'inf_warns_');
    const p = await buildWarnsPanel(uid, chatId);
    return edit(ctx, p.text, p.kb);
  }
  if (data.startsWith('inf_clrwarn_')) {
    const { uid, chatId } = parse(data, 'inf_clrwarn_');
    await run('DELETE FROM group_warns WHERE chat_id=$1 AND user_id=$2', [chatId, uid]).catch(() => {});
    await toast(ctx, '✅ تم مسح الإنذارات');
    return edit(ctx, '⚠️ *الإنذارات*\n\nتم مسح كل الإنذارات ✅', { inline_keyboard: [[backBtn(uid, chatId)]] });
  }

  // ── الصلاحيات ──
  if (data.startsWith('inf_perms_')) {
    const { uid, chatId } = parse(data, 'inf_perms_');
    const p = await buildPermsPanel(ctx.telegram, uid, chatId);
    return edit(ctx, p.text, p.kb);
  }
  if (data.startsWith('inf_ptog_')) {
    const rest = data.replace('inf_ptog_', '');
    const parts = rest.split('_');
    const chatId = parseInt(parts.pop());
    const uid    = parseInt(parts.pop());
    const perm   = parts.join('_');
    try {
      const member = await ctx.telegram.getChatMember(chatId, uid).catch(() => null);
      // استخرج الأذونات من member مباشرة (مش من permissions object)
      const PERM_KEYS = ['can_send_messages','can_send_photos','can_send_videos',
        'can_send_other_messages','can_send_polls','can_add_web_page_previews',
        'can_invite_users','can_pin_messages'];
      const cur = {};
      for (const k of PERM_KEYS) {
        if (member?.permissions?.[k] !== undefined) cur[k] = member.permissions[k] !== false;
        else if (member?.[k] !== undefined) cur[k] = member[k] !== false;
        else cur[k] = true;
      }
      const newVal = !cur[perm];
      const updated = { ...cur, [perm]: newVal };
      await ctx.telegram.restrictChatMember(chatId, uid, { permissions: updated });
      await toast(ctx, (newVal ? '✅ ' : '⬜ ') + perm);
      const p = await buildPermsPanel(ctx.telegram, uid, chatId);
      return edit(ctx, p.text, p.kb);
    } catch (e) { return toast(ctx, '❌ ' + e.message, true); }
  }

  // ── الرتب ──
  if (data.startsWith('inf_role_') && !data.startsWith('inf_setrole_') && !data.startsWith('inf_rmrole_')) {
    const { uid, chatId } = parse(data, 'inf_role_');
    const cur = await proDb.getRole(chatId, uid).catch(() => null);
    const p = await buildRolePanel(uid, chatId, cur);
    return edit(ctx, p.text, p.kb);
  }
  if (data.startsWith('inf_setrole_')) {
    const rest = data.replace('inf_setrole_', '');
    const parts = rest.split('_');
    const chatId = parseInt(parts.pop());
    const uid    = parseInt(parts.pop());
    const role   = parts.join('_');
    await proDb.setRole(chatId, uid, role, ctx.from.id);
    clearRoleCache(chatId, uid);
    await toast(ctx, '✅ تم تعيين ' + ROLE_LABELS[role]);
    const p = await buildRolePanel(uid, chatId, role);
    return edit(ctx, p.text, p.kb);
  }
  if (data.startsWith('inf_rmrole_')) {
    const { uid, chatId } = parse(data, 'inf_rmrole_');
    await proDb.removeRole(chatId, uid);
    clearRoleCache(chatId, uid);
    await toast(ctx, '✅ تم إزالة الرتبة');
    const p = await buildRolePanel(uid, chatId, null);
    return edit(ctx, p.text, p.kb);
  }

  // ── المخالفات ──
  if (data.startsWith('inf_viol_')) {
    const { uid, chatId } = parse(data, 'inf_viol_');
    const p = await buildViolPanel(uid, chatId);
    return edit(ctx, p.text, p.kb);
  }

  // ── استثناء الحماية ──
  if (data.startsWith('inf_approve_')) {
    const { uid, chatId } = parse(data, 'inf_approve_');
    await run('INSERT INTO grp_approved(chat_id,user_id,approved_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [chatId, uid, ctx.from.id]).catch(() => {});
    await toast(ctx, '✅ تم الاستثناء من الحماية');
    const d = await loadMemberData(ctx.telegram, chatId, uid);
    return edit(ctx, mainText(d, uid), mainKb(uid, chatId, d));
  }
  if (data.startsWith('inf_unapprove_')) {
    const { uid, chatId } = parse(data, 'inf_unapprove_');
    await run('DELETE FROM grp_approved WHERE chat_id=$1 AND user_id=$2', [chatId, uid]).catch(() => {});
    await toast(ctx, '✅ تم إلغاء الاستثناء');
    const d = await loadMemberData(ctx.telegram, chatId, uid);
    return edit(ctx, mainText(d, uid), mainKb(uid, chatId, d));
  }

  // ── مراقبة ──
  if (data.startsWith('inf_watch_')) {
    const { uid, chatId } = parse(data, 'inf_watch_');
    const existing = await get('SELECT 1 FROM group_watching WHERE chat_id=$1 AND user_id=$2', [chatId, uid]).catch(() => null);
    if (existing) {
      await run('DELETE FROM group_watching WHERE chat_id=$1 AND user_id=$2', [chatId, uid]).catch(() => {});
      await toast(ctx, '✅ تم إيقاف المراقبة', true);
    } else {
      await run('INSERT INTO group_watching(chat_id,user_id,admin_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [chatId, uid, ctx.from.id]).catch(() => {});
      await toast(ctx, '👁 بدأت المراقبة على العضو', true);
    }
    const d = await loadMemberData(ctx.telegram, chatId, uid);
    return edit(ctx, mainText(d, uid), mainKb(uid, chatId, d));
  }

  // ── ترقية/تنزيل TG ──
  if (data.startsWith('inf_promote_') && !data.startsWith('inf_promote_c_')) {
    const { uid, chatId } = parse(data, 'inf_promote_');
    const p2 = uid + '_' + chatId;
    return edit(ctx,
      '⬆️ *ترقية لمشرف*\n━━━━━━━━━━━━━━━━━━\n\nاختر الصلاحيات:',
      { inline_keyboard: [
        [{ text: '✅ حذف رسائل',   callback_data: 'inf_aptog_del_'  + p2 },
         { text: '✅ حظر أعضاء',   callback_data: 'inf_aptog_ban_'  + p2 }],
        [{ text: '✅ تثبيت',       callback_data: 'inf_aptog_pin_'  + p2 },
         { text: '⬜ إضافة مشرفين',callback_data: 'inf_aptog_prom_' + p2 }],
        [{ text: '✅ إدارة القروب', callback_data: 'inf_aptog_mgmt_' + p2 },
         { text: '✅ دعوة',        callback_data: 'inf_aptog_inv_'  + p2 }],
        [{ text: '✅ تأكيد الترقية',callback_data: 'inf_promote_c_' + p2 }],
        [backBtn(uid, chatId)],
      ]}
    );
  }
  if (data.startsWith('inf_promote_c_')) {
    const { uid, chatId } = parse(data, 'inf_promote_c_');
    const kb = ctx.callbackQuery?.message?.reply_markup?.inline_keyboard || [];
    const permsMap = {
      'inf_aptog_del_':  'can_delete_messages',
      'inf_aptog_ban_':  'can_restrict_members',
      'inf_aptog_pin_':  'can_pin_messages',
      'inf_aptog_prom_': 'can_promote_members',
      'inf_aptog_mgmt_': 'can_manage_chat',
      'inf_aptog_inv_':  'can_invite_users',
    };
    const rights = { can_manage_chat: false, can_delete_messages: false, can_restrict_members: false, can_promote_members: false, can_change_info: false, can_invite_users: false, can_pin_messages: false };
    for (const row of kb) for (const btn of row) {
      for (const [pfx, key] of Object.entries(permsMap)) {
        if (btn.callback_data?.startsWith(pfx)) rights[key] = btn.text.startsWith('✅');
      }
    }
    try {
      await ctx.telegram.promoteChatMember(chatId, uid, rights);
      await toast(ctx, '✅ تمت الترقية');
      const d = await loadMemberData(ctx.telegram, chatId, uid);
      return edit(ctx, mainText(d, uid), mainKb(uid, chatId, d));
    } catch (e) { return toast(ctx, '❌ ' + e.message, true); }
  }
  if (data.startsWith('inf_aptog_')) {
    const kb = ctx.callbackQuery?.message?.reply_markup?.inline_keyboard || [];
    const newKb = kb.map(row => row.map(btn => {
      if (btn.callback_data === data) {
        const isOn = btn.text.startsWith('✅');
        return { ...btn, text: (isOn ? '⬜ ' : '✅ ') + btn.text.slice(2) };
      }
      return btn;
    }));
    await ctx.editMessageReplyMarkup({ inline_keyboard: newKb }).catch(() => {});
    return ctx.answerCbQuery('').catch(() => {});
  }
  if (data.startsWith('inf_demote_')) {
    const { uid, chatId } = parse(data, 'inf_demote_');
    try {
      await ctx.telegram.promoteChatMember(chatId, uid, {
        can_manage_chat: false, can_delete_messages: false, can_manage_video_chats: false,
        can_restrict_members: false, can_promote_members: false, can_change_info: false,
        can_invite_users: false, can_pin_messages: false,
      });
      await toast(ctx, '✅ تم الإزالة من المشرفين');
      const d = await loadMemberData(ctx.telegram, chatId, uid);
      return edit(ctx, mainText(d, uid), mainKb(uid, chatId, d));
    } catch (e) { return toast(ctx, '❌ ' + e.message, true); }
  }

  return false;
}

// ══════════════════════════════════════════════════════════
// 📤 إرسال اللوحة من /info
// ══════════════════════════════════════════════════════════
async function sendInfoPanel(ctx, targetUser, chatId, adminId) {
  const d = await loadMemberData(ctx.telegram, chatId, targetUser.id);
  const text = mainText(d, targetUser.id);
  const kb   = mainKb(targetUser.id, chatId, d);

  try {
    await ctx.telegram.sendMessage(adminId, text, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      reply_markup: kb,
    });
  } catch (e) {
    // لو ما فتح الخاص
    if (ctx.message) {
      ctx.reply('⚠️ افتح الخاص مع البوت لتلقي لوحة التحكم!', {
        reply_to_message_id: ctx.message.message_id,
        reply_markup: {
          inline_keyboard: [[{ text: '📨 فتح الخاص', url: 'https://t.me/' + (ctx.botInfo?.username || '') }]]
        }
      }).catch(() => {});
    }
  }
}

module.exports = { sendInfoPanel, handleCallback };
