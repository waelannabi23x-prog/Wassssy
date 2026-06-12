#!/usr/bin/env node
/**
 * patch_group_pro_3.cjs — لوحة المشرف السريعة + نظام الرتب
 *
 * يضيف:
 *  - أمر/زر: عند الرد على عضو بكلمة "ادارة" أو "إدارة" → لوحة سريعة
 *    (حظر، طرد، كتم، إنذار، معلومات، السجل، منح رتبة، سحب رتبة)
 *  - نظام رتب مخصصة (مالك/مدير/مشرف عام/مشرف حماية/مشرف محتوى/مراقب)
 *    باستخدام جدول grp_roles الموجود مسبقاً
 *  - دوال صلاحيات: hasPermission(chatId, userId, perm)
 */
const fs = require('fs');
const path = require('path');

const G='\x1b[32m',Y='\x1b[33m',R='\x1b[31m',B='\x1b[34m',W='\x1b[0m';
const ok=m=>console.log(G+'✅ '+m+W);
const warn=m=>console.log(Y+'⚠️  '+m+W);
const err=m=>console.log(R+'❌ '+m+W);

// ════════════════════════════════════════════════
//  1. إضافة دوال الرتب + اللوحة السريعة في group_pro.js
// ════════════════════════════════════════════════
function patchGroupPro() {
  const file = path.join(process.cwd(), 'handlers', 'group_pro.js');
  let c = fs.readFileSync(file, 'utf8');

  if (c.includes('ROLES_DEFINITIONS')) {
    warn('نظام الرتب موجود بالفعل في group_pro.js.');
    return;
  }

  const ROLES_BLOCK = `
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
    \`INSERT INTO grp_roles(chat_id,user_id,role,permissions,assigned_by) VALUES($1,$2,$3,$4,$5)
     ON CONFLICT(chat_id,user_id) DO UPDATE SET role=$3, permissions=$4, assigned_by=$5, created_at=NOW()\`,
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
    \`👤 *لوحة الإدارة السريعة*\\n━━━━━━━━━━━━━━━━━━━━\\n\\n\` +
    \`الاسم: *\${name}*\\n\` +
    \`🆔 ID: \\\`\${targetId}\\\`\\n\` +
    \`🎖 الرتبة: \${roleLabel}\\n\\n\` +
    \`💬 الرسائل: *\${stats?.msg_count || 0}*\\n\` +
    \`⚠️ المخالفات: *\${stats?.violations || 0}*\\n\` +
    \`🔇 مرات الكتم: *\${stats?.mute_count || 0}*\\n\` +
    \`🚫 مرات الحظر: *\${stats?.ban_count || 0}*\`;

  const kb = [
    [
      { text: '🚫 حظر',  callback_data: \`gpq_ban_\${chatId}_\${targetId}\` },
      { text: '🦵 طرد',  callback_data: \`gpq_kick_\${chatId}_\${targetId}\` },
    ],
    [
      { text: '🔇 كتم',  callback_data: \`gpq_mute_\${chatId}_\${targetId}\` },
      { text: '⚠️ إنذار', callback_data: \`gpq_warn_\${chatId}_\${targetId}\` },
    ],
    [
      { text: '📋 السجل', callback_data: \`gpq_log_\${chatId}_\${targetId}\` },
      { text: '🔄 تصفير المخالفات', callback_data: \`gpq_reset_\${chatId}_\${targetId}\` },
    ],
    [
      { text: '🎖 منح رتبة', callback_data: \`gpq_grole_\${chatId}_\${targetId}\` },
      { text: '🗑 سحب رتبة', callback_data: \`gpq_rrole_\${chatId}_\${targetId}\` },
    ],
  ];

  return { txt, kb };
}

async function buildRoleSelectPanel(chatId, targetId) {
  const txt = '🎖 *اختر الرتبة الجديدة:*';
  const kb = Object.entries(ROLES_DEFINITIONS)
    .filter(([key]) => key !== 'owner')
    .map(([key, def]) => [{ text: def.label, callback_data: \`gpq_setrole_\${chatId}_\${targetId}_\${key}\` }]);
  kb.push([{ text: '◀️ إلغاء', callback_data: \`gpq_cancel_\${chatId}_\${targetId}\` }]);
  return { txt, kb };
}

async function buildUserLogPanel(chatId, targetId) {
  const logs = await all(
    'SELECT action, reason, created_at FROM grp_logs WHERE chat_id=$1 AND target_id=$2 ORDER BY created_at DESC LIMIT 10',
    [chatId, targetId]
  ).catch(() => []);
  const emoji = { warn:'⚠️', ban:'🚫', mute:'🔇', unmute:'🔊', unban:'🔓', kick:'🦵', auto_ban:'🤖🚫', auto_mute:'🤖🔇' };
  let txt = '📋 *سجل العضو*\\n━━━━━━━━━━━━━━━━━━━━\\n\\n';
  if (!logs.length) txt += '_لا توجد سجلات لهذا العضو_';
  else logs.forEach(l => {
    const d = new Date(l.created_at).toLocaleDateString('ar-DZ');
    txt += \`\${emoji[l.action]||'📌'} \\\`\${l.action}\\\`\`;
    if (l.reason) txt += \` _(\${l.reason})_\`;
    txt += \` · \${d}\\n\`;
  });
  return { txt, kb: [[{ text: '◀️ رجوع', callback_data: \`gpq_back_\${chatId}_\${targetId}\` }]] };
}
`;

  // أدخل الكتلة قبل module.exports
  c = c.replace(/module\.exports = \{/, ROLES_BLOCK + '\nmodule.exports = {');

  // أضف التصديرات
  c = c.replace(
    /module\.exports = \{([\s\S]*?)\};/,
    (match, inner) => {
      const newExports = inner.trim().replace(/,\s*$/, '') + `,
  ROLES_DEFINITIONS, getRole, setRole, removeRole, hasPermission, listRoles,
  buildQuickPanel, buildRoleSelectPanel, buildUserLogPanel,`;
      return `module.exports = {\n  ${newExports}\n};`;
    }
  );

  fs.writeFileSync(file, c, 'utf8');
  ok('تمت إضافة نظام الرتب + لوحة المشرف السريعة في group_pro.js');
}

// ════════════════════════════════════════════════
//  2. إضافة trigger "ادارة" في index.js (رد على عضو)
// ════════════════════════════════════════════════
function patchIndexTrigger() {
  const file = path.join(process.cwd(), 'index.js');
  let c = fs.readFileSync(file, 'utf8');

  if (c.includes("gpq_quick_panel_trigger")) {
    warn('trigger لوحة الإدارة السريعة موجود بالفعل.');
    return;
  }

  const ANCHOR = `// ── 🏦 البنك الاحترافي (Taline Bank)`;
  const NEW = `// gpq_quick_panel_trigger — لوحة الإدارة السريعة (رد على عضو + "ادارة")
    if (/^(ادارة|إدارة)$/i.test(txt) && ctx.message?.reply_to_message) {
      const target = ctx.message.reply_to_message.from;
      if (target && !target.is_bot) {
        const allowed = await groupPro.hasPermission(ctx, ctx.chat.id, ctx.from.id, 'manage_protection')
          .catch(() => false);
        if (allowed || ctx.isAdmin || ctx.isOwner) {
          const { txt: pTxt, kb: pKb } = await groupPro.buildQuickPanel(ctx, target);
          return ctx.reply(pTxt, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: pKb } }).catch(() => next());
        }
      }
    }

    // ── 🏦 البنك الاحترافي (Taline Bank)`;

  if (c.includes(ANCHOR)) {
    c = c.replace(ANCHOR, NEW);
    ok('تمت إضافة trigger "ادارة" (لوحة سريعة عبر الرد على عضو)');
  } else {
    warn('تعذّر إيجاد ANCHOR في index.js — أضف trigger يدوياً.');
  }

  fs.writeFileSync(file, c, 'utf8');
  ok('تم حفظ index.js');
}

// ════════════════════════════════════════════════
//  3. إضافة callbacks gpq_* في bot/callbacks.js
// ════════════════════════════════════════════════
function patchCallbacks() {
  const file = path.join(process.cwd(), 'bot', 'callbacks.js');
  let c = fs.readFileSync(file, 'utf8');

  if (c.includes("data.startsWith('gpq_')")) {
    warn('gpq_ callbacks موجودة بالفعل.');
    return;
  }

  const GPQ_BLOCK = `
  // ══ QUICK ADMIN PANEL CALLBACKS (gpq_) ══
  if (data.startsWith('gpq_')) {
    const gp = require('../handlers/group_pro');
    const db = require('../database/db');
    const parts = data.split('_');
    const action = parts[1];

    // gpq_setrole_chatId_targetId_roleKey
    if (action === 'setrole') {
      const [, , chatId, targetId, roleKey] = parts;
      const allowed = await gp.hasPermission(ctx, chatId, ctx.from.id, 'manage_roles').catch(()=>false);
      if (!allowed && !ctx.isOwner && !ctx.isAdmin) return ctx.answerCbQuery('❌ لا تملك صلاحية').catch(()=>{});
      await gp.setRole(chatId, targetId, roleKey, ctx.from.id);
      await gp.log(chatId, 'role_grant', targetId, ctx.from.id, roleKey);
      await ctx.answerCbQuery('✅ تم منح الرتبة').catch(()=>{});
      const targetUser = { id: targetId, first_name: 'العضو' };
      const { txt, kb } = await gp.buildQuickPanel(ctx, targetUser);
      return ctx.editMessageText(txt, { parse_mode:'Markdown', reply_markup:{ inline_keyboard:kb } }).catch(()=>{});
    }

    const chatId   = parts[2];
    const targetId = parts[3];

    if (action === 'cancel' || action === 'back') {
      const targetUser = { id: targetId, first_name: 'العضو' };
      const { txt, kb } = await gp.buildQuickPanel(ctx, targetUser);
      await ctx.answerCbQuery('').catch(()=>{});
      return ctx.editMessageText(txt, { parse_mode:'Markdown', reply_markup:{ inline_keyboard:kb } }).catch(()=>{});
    }

    // صلاحيات
    const permMap = { ban:'ban', kick:'kick', mute:'mute', warn:'warn', reset:'manage_protection', grole:'manage_roles', rrole:'manage_roles', log:'manage_logs' };
    const requiredPerm = permMap[action];
    if (requiredPerm) {
      const allowed = await gp.hasPermission(ctx, chatId, ctx.from.id, requiredPerm).catch(()=>false);
      if (!allowed && !ctx.isOwner && !ctx.isAdmin) return ctx.answerCbQuery('❌ لا تملك صلاحية لهذا الإجراء').catch(()=>{});
    }

    if (action === 'ban') {
      await bot.telegram.banChatMember(chatId, targetId).catch(()=>{});
      await db.run('UPDATE grp_member_stats SET ban_count=ban_count+1 WHERE chat_id=\$1 AND user_id=\$2',[chatId,targetId]).catch(()=>{});
      await gp.log(chatId, 'ban', targetId, ctx.from.id, 'حظر يدوي');
      await ctx.answerCbQuery('🚫 تم الحظر').catch(()=>{});
      return ctx.editMessageText('🚫 تم حظر العضو بنجاح.', { parse_mode:'Markdown' }).catch(()=>{});
    }

    if (action === 'kick') {
      await bot.telegram.banChatMember(chatId, targetId).catch(()=>{});
      await bot.telegram.unbanChatMember(chatId, targetId).catch(()=>{});
      await gp.log(chatId, 'kick', targetId, ctx.from.id, 'طرد يدوي');
      await ctx.answerCbQuery('🦵 تم الطرد').catch(()=>{});
      return ctx.editMessageText('🦵 تم طرد العضو بنجاح.', { parse_mode:'Markdown' }).catch(()=>{});
    }

    if (action === 'mute') {
      const until = Math.floor(Date.now()/1000) + 3600; // ساعة
      await bot.telegram.restrictChatMember(chatId, targetId, {
        permissions: { can_send_messages: false }, until_date: until,
      }).catch(()=>{});
      await db.run('UPDATE grp_member_stats SET mute_count=mute_count+1 WHERE chat_id=\$1 AND user_id=\$2',[chatId,targetId]).catch(()=>{});
      await gp.log(chatId, 'mute', targetId, ctx.from.id, 'كتم يدوي (ساعة)');
      await ctx.answerCbQuery('🔇 تم الكتم لمدة ساعة').catch(()=>{});
      return ctx.editMessageText('🔇 تم كتم العضو لمدة ساعة.', { parse_mode:'Markdown' }).catch(()=>{});
    }

    if (action === 'warn') {
      const targetUser = { id: targetId, first_name: 'العضو' };
      const r = await gp.warnUser(bot, chatId, targetId, ctx.from.id, 'إنذار يدوي', targetUser.first_name);
      await ctx.answerCbQuery('⚠️ تم الإنذار').catch(()=>{});
      return ctx.editMessageText(r.text, { parse_mode:'Markdown' }).catch(()=>{});
    }

    if (action === 'reset') {
      await db.run('UPDATE grp_member_stats SET violations=0, warn_count=0 WHERE chat_id=\$1 AND user_id=\$2',[chatId,targetId]).catch(()=>{});
      await db.run('DELETE FROM group_warns WHERE chat_id=\$1 AND user_id=\$2',[chatId,targetId]).catch(()=>{});
      await gp.log(chatId, 'reset_violations', targetId, ctx.from.id, 'تصفير المخالفات');
      await ctx.answerCbQuery('🔄 تم تصفير المخالفات').catch(()=>{});
      return ctx.editMessageText('🔄 تم تصفير مخالفات العضو.', { parse_mode:'Markdown' }).catch(()=>{});
    }

    if (action === 'log') {
      const { txt, kb } = await gp.buildUserLogPanel(chatId, targetId);
      await ctx.answerCbQuery('').catch(()=>{});
      return ctx.editMessageText(txt, { parse_mode:'Markdown', reply_markup:{ inline_keyboard:kb } }).catch(()=>{});
    }

    if (action === 'grole') {
      const { txt, kb } = await gp.buildRoleSelectPanel(chatId, targetId);
      await ctx.answerCbQuery('').catch(()=>{});
      return ctx.editMessageText(txt, { parse_mode:'Markdown', reply_markup:{ inline_keyboard:kb } }).catch(()=>{});
    }

    if (action === 'rrole') {
      await gp.removeRole(chatId, targetId);
      await gp.log(chatId, 'role_revoke', targetId, ctx.from.id, 'سحب رتبة');
      await ctx.answerCbQuery('✅ تم سحب الرتبة').catch(()=>{});
      const targetUser = { id: targetId, first_name: 'العضو' };
      const { txt, kb } = await gp.buildQuickPanel(ctx, targetUser);
      return ctx.editMessageText(txt, { parse_mode:'Markdown', reply_markup:{ inline_keyboard:kb } }).catch(()=>{});
    }

    await ctx.answerCbQuery('').catch(()=>{});
    return;
  }
`;

  // أدخل قبل "// ══ GROUP PRO CALLBACKS ══"
  const ANCHOR = `  // ══ GROUP PRO CALLBACKS ══`;
  if (c.includes(ANCHOR)) {
    c = c.replace(ANCHOR, GPQ_BLOCK + '\n' + ANCHOR);
    ok('تمت إضافة gpq_ callbacks (لوحة الإدارة السريعة)');
  } else {
    warn('تعذّر إيجاد نقطة الإدراج في callbacks.js');
  }

  fs.writeFileSync(file, c, 'utf8');
  ok('تم حفظ bot/callbacks.js');
}

// ════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════
console.log('\n\x1b[34m══════════════════════════════════════\x1b[0m');
console.log('\x1b[34m  🎖️  Group Pro — Patch 3/3 (الرتب + اللوحة السريعة)\x1b[0m');
console.log('\x1b[34m══════════════════════════════════════\n\x1b[0m');

try {
  patchGroupPro();
  patchIndexTrigger();
  patchCallbacks();

  console.log('\n'+G+'══════════════════════════════════════'+W);
  console.log(G+'  ✅  Patch 3 اكتمل!'+W);
  console.log(G+'══════════════════════════════════════\n'+W);
  console.log('تحقق:');
  console.log('  node --check index.js');
  console.log('  node --check handlers/group_pro.js');
  console.log('  node --check bot/callbacks.js\n');
} catch(e) {
  err('خطأ: ' + e.message);
  console.error(e);
  process.exit(1);
}
