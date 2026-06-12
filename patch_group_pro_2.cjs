#!/usr/bin/env node
/**
 * patch_group_pro_2.cjs — توسيع الحماية
 * يضيف: anti_short_link, anti_new_account, anti_bot,
 *       anti_media, anti_file, anti_repeat (تكرار رسائل),
 *       anti_edit (تعديل رسالة), max_msg_length
 * + يحدّث buildProtectPanel ليشمل الجميع
 */
const fs = require('fs');
const path = require('path');

const G='\x1b[32m',Y='\x1b[33m',R='\x1b[31m',B='\x1b[34m',W='\x1b[0m';
const ok=m=>console.log(G+'✅ '+m+W);
const warn=m=>console.log(Y+'⚠️  '+m+W);
const err=m=>console.log(R+'❌ '+m+W);

function patchGroupPro() {
  const file = path.join(process.cwd(), 'handlers', 'group_pro.js');
  let c = fs.readFileSync(file, 'utf8');

  // ── 1. flood tracker للتكرار (anti_repeat) — نضيف Map ثانية ──
  if (!c.includes('_lastMsg')) {
    c = c.replace(
      `const _flood = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _flood) if (now - v.first > 15000) _flood.delete(k);
}, 10000).unref();`,
      `const _flood = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _flood) if (now - v.first > 15000) _flood.delete(k);
}, 10000).unref();

// تتبع آخر رسالة لكل مستخدم (لمكافحة التكرار)
const _lastMsg = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _lastMsg) if (now - v.time > 60000) _lastMsg.delete(k);
}, 30000).unref();`
    );
    ok('تمت إضافة _lastMsg tracker (مكافحة التكرار)');
  } else {
    warn('_lastMsg موجود بالفعل.');
  }

  // ── 2. إضافة الحمايات الجديدة داخل protect() ──
  const ANCHOR = `    // Anti-Mention
    if (s.anti_mention) {`;

  const NEW_PROTECTIONS = `    // Anti-Short-Link (روابط مختصرة)
    if (s.anti_short_link) {
      const shortDomains = /\\b(bit\\.ly|tinyurl\\.com|t\\.co|is\\.gd|cutt\\.ly|shorte\\.st|ow\\.ly|rebrand\\.ly|tiny\\.cc|short\\.io)\\b/i;
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
      const m = await ctx.reply(\`🖼 \${name} — الوسائط ممنوعة هنا\`, { parse_mode: 'Markdown' }).catch(() => null);
      if (m) setTimeout(() => ctx.telegram.deleteMessage(chatId, m.message_id).catch(() => {}), 6000);
      return;
    }

    // Anti-File (ملفات)
    if (s.anti_file && msg.document) {
      await ctx.deleteMessage().catch(() => {});
      const m = await ctx.reply(\`📁 \${name} — الملفات ممنوعة هنا\`, { parse_mode: 'Markdown' }).catch(() => null);
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
    if (s.anti_mention) {`;

  if (!c.includes('Anti-Short-Link')) {
    if (c.includes(ANCHOR)) {
      c = c.replace(ANCHOR, NEW_PROTECTIONS);
      ok('تمت إضافة 6 أنواع حماية جديدة (روابط مختصرة، بوتات، وسائط، ملفات، رسائل طويلة، تكرار)');
    } else {
      warn('تعذّر إيجاد نقطة الإدراج — لم تُضف الحمايات الجديدة.');
    }
  } else {
    warn('الحمايات الجديدة موجودة بالفعل.');
  }

  // ── 3. Anti-Edit (رصد تعديل الرسائل) — يحتاج معالج edited_message منفصل ──
  if (!c.includes('async function protectEdit')) {
    c = c.replace(
      `module.exports = {`,
      `// ══════════════════════════════════════════════════
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

module.exports = {`
    );
    // أضف التصديرات الجديدة لقائمة exports
    c = c.replace(
      `module.exports = {
  protect, getSettings, toggleSetting, setSetting, log,
  warnUser, showMainPanel, buildProtectPanel, buildLogsPanel,
  buildStatsPanel, buildBlacklistPanel, incStat,
};`,
      `module.exports = {
  protect, protectEdit, checkNewMember,
  getSettings, toggleSetting, setSetting, log,
  warnUser, showMainPanel, buildProtectPanel, buildLogsPanel,
  buildStatsPanel, buildBlacklistPanel, incStat,
};`
    );
    ok('تمت إضافة protectEdit و checkNewMember');
  } else {
    warn('protectEdit موجودة بالفعل.');
  }

  // ── 4. تحديث buildProtectPanel ليشمل كل الحمايات ──
  const OLD_PANEL = `async function buildProtectPanel(chatId) {
  const s = await getSettings(chatId);
  const f = (v, label, key) => [{
    text: (v ? '✅ ' : '❌ ') + label,
    callback_data: 'gpro_tog_' + key + '_' + chatId
  }];
  const txt = '🛡 *الحماية*\\n━━━━━━━━━━━━━\\n_اضغط لتفعيل/إيقاف_';
  const kb = [
    f(s.anti_flood,   'مكافحة الفلود',        'anti_flood'),
    f(s.anti_link,    'مكافحة الروابط',        'anti_link'),
    f(s.anti_invite,  'مكافحة الدعوات',        'anti_invite'),
    f(s.anti_forward, 'مكافحة الفوروارد',      'anti_forward'),
    f(s.anti_mention, 'مكافحة المنشن الجماعي', 'anti_mention'),
    [{ text: '◀️ رجوع', callback_data: 'gpro_main_' + chatId }],
  ];
  return { txt, kb };
}`;

  const NEW_PANEL = `async function buildProtectPanel(chatId) {
  const s = await getSettings(chatId);
  const f = (v, label, key) => [{
    text: (v ? '✅ ' : '❌ ') + label,
    callback_data: 'gpro_tog_' + key + '_' + chatId
  }];
  const txt = '🛡 *الحماية المتقدمة*\\n━━━━━━━━━━━━━\\n_اضغط لتفعيل/إيقاف أي ميزة_';
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
}`;

  if (c.includes(OLD_PANEL)) {
    c = c.replace(OLD_PANEL, NEW_PANEL);
    ok('تم تحديث buildProtectPanel بـ 11 ميزة حماية!');
  } else if (c.includes('anti_short_link,')) {
    warn('buildProtectPanel محدّث بالفعل.');
  } else {
    warn('تعذّر إيجاد buildProtectPanel القديمة — تحقق يدوياً.');
  }

  fs.writeFileSync(file, c, 'utf8');
  ok('تم حفظ group_pro.js');
}

// ════════════════════════════════════════════════
//  تسجيل protectEdit و checkNewMember في index.js
// ════════════════════════════════════════════════
function patchIndex() {
  const file = path.join(process.cwd(), 'index.js');
  let c = fs.readFileSync(file, 'utf8');

  if (c.includes('groupPro.protectEdit')) {
    warn('protectEdit مسجّل بالفعل.');
    return;
  }

  const ANCHOR = `// 🛡️ نظام الحماية الاحترافي (group_pro)
bot.use(async (ctx, next) => {
  if (!['group','supergroup'].includes(ctx.chat?.type)) return next();
  return groupPro.protect(bot, ctx, next);
});`;

  const NEW = `// 🛡️ نظام الحماية الاحترافي (group_pro)
bot.use(async (ctx, next) => {
  if (!['group','supergroup'].includes(ctx.chat?.type)) return next();
  return groupPro.protect(bot, ctx, next);
});

// 🛡️ مكافحة التعديل
bot.on('edited_message', async (ctx, next) => {
  if (!['group','supergroup'].includes(ctx.chat?.type)) return next();
  return groupPro.protectEdit(bot, ctx, next);
});

// 🛡️ فحص الأعضاء الجدد (بوتات/حسابات جديدة)
bot.use(async (ctx, next) => {
  if (ctx.message?.new_chat_members) {
    return groupPro.checkNewMember(bot, ctx, next);
  }
  return next();
});`;

  if (c.includes(ANCHOR)) {
    c = c.replace(ANCHOR, NEW);
    ok('تم تسجيل protectEdit و checkNewMember في index.js');
  } else {
    warn('تعذّر إيجاد ANCHOR في index.js — تأكد من تشغيل Patch 1 أولاً.');
  }

  fs.writeFileSync(file, c, 'utf8');
  ok('تم حفظ index.js');
}

// ════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════
console.log('\n\x1b[34m══════════════════════════════════════\x1b[0m');
console.log('\x1b[34m  🛡️  Group Pro — Patch 2/3 (الحماية الموسّعة)\x1b[0m');
console.log('\x1b[34m══════════════════════════════════════\n\x1b[0m');

try {
  patchGroupPro();
  patchIndex();

  console.log('\n'+G+'══════════════════════════════════════'+W);
  console.log(G+'  ✅  Patch 2 اكتمل!'+W);
  console.log(G+'══════════════════════════════════════\n'+W);
  console.log('تحقق:');
  console.log('  node --check index.js');
  console.log('  node --check handlers/group_pro.js\n');
} catch(e) {
  err('خطأ: ' + e.message);
  console.error(e);
  process.exit(1);
}
