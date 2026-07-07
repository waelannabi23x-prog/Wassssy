#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();
const DRY_RUN = process.argv.includes('--dry-run');
const patches = [
  {
    "file": "index.js",
    "desc": "فحص حظر مباشر داخل gameAndBankMiddleware (يمنع تجاوز المحظورين للألعاب/البنك)",
    "old": "const gameAndBankMiddleware = async (ctx, next) => {\n  const isGroup = ['group', 'supergroup'].includes(ctx.chat?.type);\n  const txt     = (ctx.message?.text || '').trim();\n\n  if (isGroup && ctx.message) {",
    "new": "const gameAndBankMiddleware = async (ctx, next) => {\n  const isGroup = ['group', 'supergroup'].includes(ctx.chat?.type);\n  const txt     = (ctx.message?.text || '').trim();\n\n  // 🔒 [إصلاح] فحص حظر مباشر هنا: هذا الميدلوير مسجَّل قبل authMiddleware عمداً (الألعاب/البنك قبل auth)،\n  // لذلك فحص الحظر داخل authMiddleware لا يصل لهذه الرسائل أبداً. هذا السطر يسد الثغرة دون تغيير ترتيب التسجيل.\n  if (isGroup && ctx.message && ctx.from?.id) {\n    const _banChk = await dbGet('SELECT is_banned FROM users WHERE id=$1', [ctx.from.id]).catch(() => null);\n    if (_banChk && _banChk.is_banned === 1) return next();\n  }\n\n  if (isGroup && ctx.message) {"
  },
  {
    "file": "index.js",
    "desc": "إضافة \"دول\" و\"xo\" لمصفوفة الكلمات المحجوزة لبطاقات الأعضاء",
    "old": "  const _blocked = [\"ضف رد\",\"امحي ردي\",\"اعمل\",\"بنك\",\"مواطن\",\"دولتي\",\"لوب غارو\",\"werewolf\",\"خمن\",\"مليون\",\"بطاقتي\",\"فلوسي\",\"حسابي\"];",
    "new": "  const _blocked = [\"ضف رد\",\"امحي ردي\",\"اعمل\",\"بنك\",\"مواطن\",\"دولتي\",\"لوب غارو\",\"werewolf\",\"خمن\",\"مليون\",\"بطاقتي\",\"فلوسي\",\"حسابي\",\"دول\",\"xo\"];"
  },
  {
    "file": "bot/callbacks.js",
    "desc": "إضافة بادئتي gf_ و sch_ الناقصتين لقائمة أزرار القروب البيضاء",
    "old": "        const _grpOk = data.startsWith('grp_') || data.startsWith('del_channel_')\n          || data.startsWith('gs_') || data.startsWith('grp_unban_')",
    "new": "        const _grpOk = data.startsWith('grp_') || data.startsWith('del_channel_')\n          || data.startsWith('gf_') || data.startsWith('sch_') // [إصلاح] فلاتر القروب + الحظر المؤقت كانتا مفقودتين من القائمة\n          || data.startsWith('gs_') || data.startsWith('grp_unban_')"
  },
  {
    "file": "bot/callbacks.js",
    "desc": "تصحيح اسم جدول الموافقة على عضو (group_approved -> grp_approved)",
    "old": "      if (action === 'approve') {\n        await _r('INSERT INTO group_approved(chat_id,user_id,approved_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [chatId, userId, ctx.from.id]).catch(() => {});\n        return ctx.answerCbQuery('✅ تم الاستثناء من الحماية').catch(() => {});\n      }\n\n      if (action === 'unapprove') {\n        await _r('DELETE FROM group_approved WHERE chat_id=$1 AND user_id=$2', [chatId, userId]).catch(() => {});\n        return ctx.answerCbQuery('✅ تم إلغاء الاستثناء').catch(() => {});\n      }",
    "new": "      if (action === 'approve') {\n        // [إصلاح] كانت تكتب في group_approved بينما isApproved() في group_pro_features.js تقرأ من grp_approved\n        await _r('INSERT INTO grp_approved(chat_id,user_id,approved_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [chatId, userId, ctx.from.id]).catch(() => {});\n        return ctx.answerCbQuery('✅ تم الاستثناء من الحماية').catch(() => {});\n      }\n\n      if (action === 'unapprove') {\n        await _r('DELETE FROM grp_approved WHERE chat_id=$1 AND user_id=$2', [chatId, userId]).catch(() => {});\n        return ctx.answerCbQuery('✅ تم إلغاء الاستثناء').catch(() => {});\n      }"
  },
  {
    "file": "database/db.js",
    "desc": "إصلاح ReferenceError: pg is not defined داخل migrateGroupPro",
    "old": "async function migrateGroupPro() {\n  if (!pg) return;",
    "new": "async function migrateGroupPro() {\n  const pg = getPg(); // [إصلاح] كانت pg غير معرّفة هنا فتسبب ReferenceError عند أي استدعاء لهذه الدالة\n  if (!pg) return;"
  },
  {
    "file": "database/db.js",
    "desc": "إضافة عمودي created_at/updated_at الناقصين لجدول group_bans",
    "old": "  try { if(pg) await pg.query(`CREATE TABLE IF NOT EXISTS group_bans (id SERIAL PRIMARY KEY, chat_id BIGINT NOT NULL, user_id BIGINT NOT NULL, banned_by BIGINT, reason TEXT, banned_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(chat_id, user_id))`); } catch(err) { require('../utils/logger').debug('[catch]', err.message); }",
    "new": "  try { if(pg) await pg.query(`CREATE TABLE IF NOT EXISTS group_bans (id SERIAL PRIMARY KEY, chat_id BIGINT NOT NULL, user_id BIGINT NOT NULL, banned_by BIGINT, reason TEXT, banned_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(chat_id, user_id))`); } catch(err) { require('../utils/logger').debug('[catch]', err.message); }\n  // [إصلاح] group_db.js كان ينشئ نفس الجدول بأعمدة created_at/updated_at بدل banned_at، فيفشل الإدراج في group_protection.js و group_admin.js بصمت.\n  // إضافة العمودين هنا (بدون حذف banned_at) يجعل كل المسارات القديمة والجديدة تعمل معاً.\n  try { if(pg) await pg.query(`ALTER TABLE group_bans ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`); } catch(err) { require('../utils/logger').debug('[catch]', err.message); }\n  try { if(pg) await pg.query(`ALTER TABLE group_bans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP`); } catch(err) { require('../utils/logger').debug('[catch]', err.message); }"
  },
  {
    "file": "database/db.js",
    "desc": "استبدال ADD CONSTRAINT IF NOT EXISTS (غير مدعومة) بصيغة DO آمنة لقيد history",
    "old": "  try { if(pg) await pg.query('ALTER TABLE history ADD CONSTRAINT IF NOT EXISTS hist_user_file_unique UNIQUE (user_id, file_id)'); } catch(err) { require('../utils/logger').debug('[catch]', err.message); }",
    "new": "  // [إصلاح] \"ADD CONSTRAINT IF NOT EXISTS\" غير مدعومة في PostgreSQL (فقط ADD COLUMN تدعمها) فكانت تفشل بصمت دائماً.\n  try { if(pg) await pg.query(`DO $$ BEGIN\n    ALTER TABLE history ADD CONSTRAINT hist_user_file_unique UNIQUE (user_id, file_id);\n  EXCEPTION WHEN duplicate_object THEN NULL; END $$;`); } catch(err) { require('../utils/logger').debug('[catch]', err.message); }"
  },
  {
    "file": "database/db.js",
    "desc": "حذف عبارة ALTER TABLE المكررة لنفس قيد history (أصبحت زائدة بعد الإصلاح أعلاه)",
    "old": "\n  try { if(pg) await pg.query('ALTER TABLE history ADD CONSTRAINT hist_user_file_unique UNIQUE (user_id, file_id)'); } catch(err) { require('../utils/logger').debug('[catch]', err.message); }",
    "new": ""
  },
  {
    "file": "bot/commands.js",
    "desc": "توجيه أمر /bank القديم لنظام bank_pro الفعلي بدل handlers/bank.js",
    "old": "  bot.command(['bank','حسابي','بنكي'], ctx => require('../handlers/bank').showBalance(ctx).catch(()=>{}));",
    "new": "  bot.command(['bank','حسابي','بنكي'], ctx => require('../handlers/bank_pro').showWalletNoButtons(ctx).catch(()=>{}));"
  },
  {
    "file": "handlers/group_commands.js",
    "desc": "إعادة تسمية /million الإداري إلى /million_admin لتفادي تعارضه مع أمر بدء اللعبة",
    "old": "  bot.command('million', async ctx => {\n    if (!isGroup(ctx)) return;\n    if (!await isTgAdmin(ctx)) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});\n    return million.showQuestionsPanel(ctx);\n  });",
    "new": "  // [إصلاح] كان اسمه 'million' فيتعارض مع أمر بدء اللعبة المسجَّل في bot/commands.js (الذي يفوز دائماً لأنه مسجَّل أولاً)\n  // ما يجعل لوحة إدارة الأسئلة هذه غير قابلة للوصول إطلاقاً. أعيدت تسميته لأمر منفصل حتى يعمل الاثنان معاً.\n  bot.command(['million_admin', 'اسئلة_المليون'], async ctx => {\n    if (!isGroup(ctx)) return;\n    if (!await isTgAdmin(ctx)) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});\n    return million.showQuestionsPanel(ctx);\n  });"
  }
];

const C = { g: '\x1b[32m', y: '\x1b[33m', r: '\x1b[31m', b: '\x1b[36m', reset: '\x1b[0m', bold: '\x1b[1m' };
const log = (color, msg) => console.log(color + msg + C.reset);

console.log('');
log(C.bold + C.b, '🔧 سكربت إصلاحات بوت Taline — ' + (DRY_RUN ? 'وضع المعاينة (dry-run)' : 'وضع التطبيق الفعلي'));
console.log('');

const filesNeeded = [...new Set(patches.map(p => p.file))];
let missing = false;
for (const f of filesNeeded) {
  if (!fs.existsSync(path.join(ROOT, f))) {
    log(C.r, `❌ لم أجد الملف: ${f}`);
    missing = true;
  }
}
if (missing || !fs.existsSync(path.join(ROOT, 'index.js'))) {
  log(C.r, '\nشغّل هذا السكربت من مجلد جذر المشروع نفسه (المجلد الذي يحتوي index.js مباشرة).');
  process.exit(1);
}

let backupDir = null;
if (!DRY_RUN) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  backupDir = path.join(path.dirname(ROOT), `TALINE_BACKUP_قبل_الاصلاح_${stamp}`);
  fs.cpSync(ROOT, backupDir, {
    recursive: true,
    filter: (src) => !src.includes(`${path.sep}node_modules`) && !src.includes(`${path.sep}.git`),
  });
  log(C.b, `📦 نسخة احتياطية كاملة من المشروع محفوظة في:\n   ${backupDir}`);
  console.log('');
}

let applied = 0, skippedDone = 0, needsReview = 0;

for (const p of patches) {
  const filePath = path.join(ROOT, p.file);
  const content = fs.readFileSync(filePath, 'utf8');

  if (p.old === '') continue;

  if (p.new !== '' && content.includes(p.new)) {
    log(C.y, `⏭️  [${p.file}] ${p.desc}\n     مطبّق مسبقاً — تم التخطي`);
    skippedDone++;
    continue;
  }

  const count = content.split(p.old).length - 1;

  if (count === 0) {
    if (p.new === '') {
      log(C.y, `⏭️  [${p.file}] ${p.desc}\n     مطبّق مسبقاً (تم الحذف سابقاً) — تم التخطي`);
      skippedDone++;
      continue;
    }
    log(C.r, `⚠️  [${p.file}] ${p.desc}\n     لم أجد الموضع المتوقع — يحتاج مراجعة يدوية`);
    needsReview++;
    continue;
  }

  if (count > 1) {
    log(C.y, `⚠️  [${p.file}] ${p.desc}\n     الموضع تكرر ${count} مرة — تم التخطي، راجعه يدوياً`);
    needsReview++;
    continue;
  }

  if (DRY_RUN) {
    log(C.g, `✅ (معاينة) [${p.file}] ${p.desc}`);
  } else {
    fs.writeFileSync(filePath, content.replace(p.old, () => p.new), 'utf8');
    log(C.g, `✅ [${p.file}] ${p.desc}`);
  }
  applied++;
}

console.log('');
log(C.bold, `النتيجة: ${applied} ${DRY_RUN ? 'سيُطبَّق' : 'تم تطبيقه'}، ${skippedDone} مطبّق مسبقاً، ${needsReview} يحتاج مراجعة.`);

if (applied > 0 && !DRY_RUN) {
  console.log('');
  log(C.b, '🔎 تحقق من سلامة الصياغة البرمجية...');
  let allOk = true;
  for (const f of filesNeeded) {
    try {
      execSync(`node --check "${path.join(ROOT, f)}"`, { stdio: 'pipe' });
      log(C.g, `   ✅ ${f}`);
    } catch (e) {
      allOk = false;
      log(C.r, `   ❌ ${f} فيه خطأ نحوي! استرجعه من: ${path.join(backupDir, f)}`);
    }
  }
  console.log('');
  if (allOk) {
    log(C.bold + C.g, '🎉 كل شيء سليم. أعد تشغيل البوت الآن (pm2 restart أو إعادة نشر Railway).');
  }
} else if (DRY_RUN) {
  log(C.b, 'معاينة فقط. للتطبيق الفعلي: node taline_fix.js');
}
