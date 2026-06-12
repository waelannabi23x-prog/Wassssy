#!/usr/bin/env node
/**
 * patch_group_pro_1.cjs — الأساس
 * - إضافة عمود violations لجدول grp_member_stats
 * - توحيد جدول الكلمات المحظورة (grp_blacklist_words)
 * - تفعيل protect() في index.js
 * - تفعيل لوحة /panel للأدمن في القروبات
 */
const fs = require('fs');
const path = require('path');

const G='\x1b[32m',Y='\x1b[33m',R='\x1b[31m',B='\x1b[34m',W='\x1b[0m';
const ok=m=>console.log(G+'✅ '+m+W);
const warn=m=>console.log(Y+'⚠️  '+m+W);
const err=m=>console.log(R+'❌ '+m+W);
const inf=m=>console.log(B+'📌 '+m+W);

// ════════════════════════════════════════════════
//  1. DB SCHEMA FIX
// ════════════════════════════════════════════════
function patchDb() {
  const file = path.join(process.cwd(), 'database', 'db.js');
  let c = fs.readFileSync(file, 'utf8');

  // أ) أضف عمود violations
  const OLD_STATS = `    \`CREATE TABLE IF NOT EXISTS grp_member_stats (
      chat_id BIGINT NOT NULL,
      user_id BIGINT NOT NULL,
      msg_count INTEGER DEFAULT 0,
      warn_count INTEGER DEFAULT 0,
      mute_count INTEGER DEFAULT 0,
      ban_count INTEGER DEFAULT 0,
      joined_at TIMESTAMP DEFAULT NOW(),
      last_active TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (chat_id, user_id)
    )\`,`;

  const NEW_STATS = `    \`CREATE TABLE IF NOT EXISTS grp_member_stats (
      chat_id BIGINT NOT NULL,
      user_id BIGINT NOT NULL,
      msg_count INTEGER DEFAULT 0,
      warn_count INTEGER DEFAULT 0,
      mute_count INTEGER DEFAULT 0,
      ban_count INTEGER DEFAULT 0,
      violations INTEGER DEFAULT 0,
      joined_at TIMESTAMP DEFAULT NOW(),
      last_active TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (chat_id, user_id)
    )\`,
    \`ALTER TABLE grp_member_stats ADD COLUMN IF NOT EXISTS violations INTEGER DEFAULT 0\`,`;

  if (c.includes(OLD_STATS) && !c.includes('violations INTEGER DEFAULT 0')) {
    c = c.replace(OLD_STATS, NEW_STATS);
    ok('تمت إضافة عمود violations لـ grp_member_stats');
  } else if (c.includes('violations INTEGER')) {
    warn('عمود violations موجود بالفعل.');
  } else {
    warn('تعذّر إيجاد grp_member_stats — أضف العمود يدوياً.');
  }

  // ب) إعادة تسمية / إضافة الأعمدة الناقصة في grp_settings للحمايات الجديدة
  const SETTINGS_ALTER = `    \`ALTER TABLE grp_settings ADD COLUMN IF NOT EXISTS anti_repeat BOOLEAN DEFAULT false\`,
    \`ALTER TABLE grp_settings ADD COLUMN IF NOT EXISTS repeat_limit INTEGER DEFAULT 3\`,
    \`ALTER TABLE grp_settings ADD COLUMN IF NOT EXISTS max_mentions INTEGER DEFAULT 5\`,
    \`ALTER TABLE grp_settings ADD COLUMN IF NOT EXISTS min_account_age_days INTEGER DEFAULT 0\`,`;

  if (!c.includes('anti_repeat BOOLEAN')) {
    c = c.replace(
      `    \`CREATE TABLE IF NOT EXISTS grp_logs (`,
      SETTINGS_ALTER + `\n    \`CREATE TABLE IF NOT EXISTS grp_logs (`
    );
    ok('تمت إضافة أعمدة الإعدادات الجديدة (anti_repeat, repeat_limit, max_mentions, min_account_age_days)');
  } else {
    warn('أعمدة الإعدادات الجديدة موجودة بالفعل.');
  }

  // ج) Migration: blacklist words table اسم موحد grp_blacklist (alias)
  // الجدول الحقيقي grp_blacklist_words — نضيف view أو نعدل الكود ليستخدم الاسم الصحيح (نفعل ذلك في group_pro.js و callbacks.js)

  fs.writeFileSync(file, c, 'utf8');
  ok('تم حفظ database/db.js');
}

// ════════════════════════════════════════════════
//  2. إصلاح أسماء جدول البلاك ليست في group_pro.js
// ════════════════════════════════════════════════
function patchGroupProBlacklist() {
  const file = path.join(process.cwd(), 'handlers', 'group_pro.js');
  let c = fs.readFileSync(file, 'utf8');

  // في protect(): استعلام البلاك ليست
  c = c.replace(
    `const bl = await all('SELECT word, action FROM grp_blacklist WHERE chat_id=$1', [chatId]).catch(() => []);`,
    `const bl = await all('SELECT word FROM grp_blacklist_words WHERE chat_id=$1', [chatId]).catch(() => []);`
  );

  // buildBlacklistPanel
  c = c.replace(
    `const list = await all('SELECT id, word FROM grp_blacklist WHERE chat_id=$1 ORDER BY id', [chatId]).catch(()=>[]);`,
    `const list = await all('SELECT id, word FROM grp_blacklist_words WHERE chat_id=$1 ORDER BY id', [chatId]).catch(()=>[]);`
  );

  fs.writeFileSync(file, c, 'utf8');
  ok('تم توحيد اسم جدول الكلمات المحظورة في group_pro.js → grp_blacklist_words');
}

// ════════════════════════════════════════════════
//  3. إصلاح أسماء الجدول في bot/callbacks.js
// ════════════════════════════════════════════════
function patchCallbacksBlacklist() {
  const file = path.join(process.cwd(), 'bot', 'callbacks.js');
  let c = fs.readFileSync(file, 'utf8');

  c = c.replace(
    `await require('../database/db').run('DELETE FROM grp_blacklist WHERE id=$1', [rowId]).catch(()=>{});`,
    `await require('../database/db').run('DELETE FROM grp_blacklist_words WHERE id=$1', [rowId]).catch(()=>{});`
  );

  fs.writeFileSync(file, c, 'utf8');
  ok('تم توحيد اسم جدول الكلمات المحظورة في bot/callbacks.js');
}

// ════════════════════════════════════════════════
//  4. تفعيل protect() في index.js + أمر /panel
// ════════════════════════════════════════════════
function patchIndex() {
  const file = path.join(process.cwd(), 'index.js');
  let c = fs.readFileSync(file, 'utf8');

  if (c.includes("require('./handlers/group_pro')")) {
    warn('group_pro موجود بالفعل في index.js — تخطي require.');
  } else {
    c = c.replace(
      "const bank          = require('./handlers/bank');",
      "const bank          = require('./handlers/bank');\nconst groupPro      = require('./handlers/group_pro');"
    );
    ok('تمت إضافة require لـ group_pro');
  }

  // تفعيل middleware الحماية — يجب أن يكون قبل أي معالجة نصية أخرى في القروبات
  if (c.includes('groupPro.protect(bot,')) {
    warn('middleware الحماية مفعّل بالفعل.');
  } else {
    // أضفه بعد bot.use(gameAndBankMiddleware)
    const ANCHOR = `bot.use(gameAndBankMiddleware);   // الألعاب والبنك قبل auth`;
    if (c.includes(ANCHOR)) {
      c = c.replace(
        ANCHOR,
        ANCHOR + `\n\n// 🛡️ نظام الحماية الاحترافي (group_pro)\nbot.use(async (ctx, next) => {\n  if (!['group','supergroup'].includes(ctx.chat?.type)) return next();\n  return groupPro.protect(bot, ctx, next);\n});`
      );
      ok('تم تفعيل middleware الحماية (groupPro.protect)!');
    } else {
      warn('تعذّر إيجاد نقطة التثبيت — أضف middleware الحماية يدوياً.');
    }
  }

  fs.writeFileSync(file, c, 'utf8');
  ok('تم حفظ index.js');
}

// ════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════
console.log('\n'+B+'══════════════════════════════════════'+W);
console.log(B+'  🛡️  Group Pro — Patch 1/3 (الأساس)'+W);
console.log(B+'══════════════════════════════════════\n'+W);

try {
  patchDb();
  patchGroupProBlacklist();
  patchCallbacksBlacklist();
  patchIndex();

  console.log('\n'+G+'══════════════════════════════════════'+W);
  console.log(G+'  ✅  Patch 1 اكتمل!'+W);
  console.log(G+'══════════════════════════════════════\n'+W);
  console.log('تحقق من الأخطاء النحوية:');
  console.log('  node --check index.js');
  console.log('  node --check database/db.js');
  console.log('  node --check handlers/group_pro.js');
  console.log('  node --check bot/callbacks.js\n');
} catch(e) {
  err('خطأ: ' + e.message);
  console.error(e);
  process.exit(1);
}
