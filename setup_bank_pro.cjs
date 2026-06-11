#!/usr/bin/env node
/**
 * ══════════════════════════════════════════════
 *   🏦  setup_bank_pro.cjs
 *   شغّل هذا السكريبت من Termux مرة واحدة فقط
 *   node ~/setup_bank_pro.cjs
 * ══════════════════════════════════════════════
 */

const { execSync } = require('child_process');
const fs           = require('fs');
const path         = require('path');

// ── اكتب مسار مشروعك هنا ──
const PROJECT_DIR  = process.env.PROJECT_DIR || '/data/data/com.termux/files/home/Lwsss23-main';
const INDEX_FILE   = path.join(PROJECT_DIR, 'index.js');
const HANDLERS_DIR = path.join(PROJECT_DIR, 'handlers');

// ── ألوان الطباعة ──
const G = '\x1b[32m', Y = '\x1b[33m', R = '\x1b[31m', B = '\x1b[34m', W = '\x1b[0m';
const ok  = msg => console.log(G + '✅ ' + msg + W);
const warn= msg => console.log(Y + '⚠️  ' + msg + W);
const err = msg => console.log(R + '❌ ' + msg + W);
const inf = msg => console.log(B + '📌 ' + msg + W);

// ════════════════════════════════════════════════
//  STEP 1: تشغيل الـ Migration في PostgreSQL
// ════════════════════════════════════════════════
async function runMigration() {
  inf('تشغيل migration الجداول الجديدة...');

  // قراءة .env للحصول على DATABASE_URL
  const envFile = path.join(PROJECT_DIR, '.env');
  let dbUrl = process.env.DATABASE_URL;

  if (!dbUrl && fs.existsSync(envFile)) {
    const envContent = fs.readFileSync(envFile, 'utf8');
    const match = envContent.match(/DATABASE_URL\s*=\s*["']?([^\s"'\n]+)/);
    if (match) dbUrl = match[1];
  }

  if (!dbUrl) {
    err('لم يتم إيجاد DATABASE_URL! تأكد من .env أو متغيرات البيئة.');
    process.exit(1);
  }

  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  const SQL = `
CREATE TABLE IF NOT EXISTS pro_bank_accounts (
  user_id       BIGINT PRIMARY KEY,
  first_name    TEXT    DEFAULT '',
  username      TEXT    DEFAULT '',
  balance       NUMERIC DEFAULT 0,
  card_type     TEXT    DEFAULT 'classic',
  account_type  TEXT    DEFAULT 'current',
  iban          TEXT    UNIQUE,
  pin           TEXT    DEFAULT NULL,
  is_frozen     INTEGER DEFAULT 0,
  total_deposits NUMERIC DEFAULT 0,
  loans_count   INTEGER DEFAULT 0,
  loans_paid    INTEGER DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pro_bank_transactions (
  id         SERIAL PRIMARY KEY,
  from_id    BIGINT,
  to_id      BIGINT,
  amount     NUMERIC NOT NULL,
  fee        NUMERIC DEFAULT 0,
  type       TEXT    DEFAULT 'transfer',
  note       TEXT    DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pbt_from ON pro_bank_transactions(from_id);
CREATE INDEX IF NOT EXISTS idx_pbt_to   ON pro_bank_transactions(to_id);
CREATE INDEX IF NOT EXISTS idx_pbt_date ON pro_bank_transactions(created_at);

CREATE TABLE IF NOT EXISTS pro_bank_loans (
  id         SERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL,
  amount     NUMERIC NOT NULL,
  total_due  NUMERIC NOT NULL,
  paid       INTEGER DEFAULT 0,
  paid_at    TIMESTAMP,
  due_at     TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pbl_user ON pro_bank_loans(user_id, paid);

CREATE TABLE IF NOT EXISTS pro_bank_investments (
  id            SERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL,
  amount        NUMERIC NOT NULL,
  daily_rate    NUMERIC NOT NULL,
  tier          TEXT    DEFAULT 'أساسي',
  active        INTEGER DEFAULT 1,
  profit_earned NUMERIC DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pbi_user ON pro_bank_investments(user_id, active);
`;

  try {
    await pool.query(SQL);
    ok('تم إنشاء جداول البنك الاحترافي بنجاح!');

    // ترحيل الأرصدة القديمة إذا وُجدت
    try {
      await pool.query(`
        INSERT INTO pro_bank_accounts (user_id, first_name, username, balance)
        SELECT user_id, first_name, username, balance FROM bank_accounts
        ON CONFLICT(user_id) DO NOTHING
      `);
      ok('تم ترحيل الأرصدة القديمة!');
    } catch(_) {
      warn('لا توجد أرصدة قديمة للترحيل (طبيعي).');
    }
  } finally {
    await pool.end();
  }
}

// ════════════════════════════════════════════════
//  STEP 2: نسخ handler الجديد
// ════════════════════════════════════════════════
function copyHandler() {
  inf('نسخ bank_pro.js إلى مجلد handlers...');
  const src = path.join(process.env.HOME || '/data/data/com.termux/files/home', 'bank_pro.js');
  const dst = path.join(HANDLERS_DIR, 'bank_pro.js');

  if (!fs.existsSync(src)) {
    err(`الملف ${src} غير موجود! تأكد من نسخه أولاً.`);
    process.exit(1);
  }

  fs.copyFileSync(src, dst);
  ok(`تم نسخ bank_pro.js إلى ${dst}`);
}

// ════════════════════════════════════════════════
//  STEP 3: تعديل index.js لإضافة أوامر البنك
// ════════════════════════════════════════════════
function patchIndex() {
  inf('تعديل index.js...');

  let content = fs.readFileSync(INDEX_FILE, 'utf8');

  // ── A. إضافة require ──
  if (content.includes("require('./handlers/bank_pro')")) {
    warn('bank_pro موجود بالفعل في index.js — تخطي الإضافة.');
    return;
  }

  content = content.replace(
    "const bank          = require('./handlers/bank');",
    "const bank          = require('./handlers/bank');\nconst bankPro       = require('./handlers/bank_pro');"
  );

  // ── B. إضافة أوامر البنك الاحترافي في gameAndBankMiddleware ──
  const OLD_BANK = `    // البنك
    if (/^انشاء حساب$/i.test(txt))    return bank.createAccount(ctx).catch(() => next());
    if (/^فلوسي$/i.test(txt))          return bank.showBalance(ctx).catch(() => next());
    if (/^فارسي/i.test(txt))           return bank.transfer(ctx).catch(() => next());
    if (/^rip /i.test(txt))            return bank.loan(ctx).catch(() => next());`;

  const NEW_BANK = `    // البنك القديم
    if (/^انشاء حساب$/i.test(txt))    return bank.createAccount(ctx).catch(() => next());
    if (/^فلوسي$/i.test(txt))          return bank.showBalance(ctx).catch(() => next());
    if (/^فارسي/i.test(txt))           return bank.transfer(ctx).catch(() => next());
    if (/^rip /i.test(txt))            return bank.loan(ctx).catch(() => next());

    // ── 🏦 البنك الاحترافي (Taline Bank) ──
    if (/^بنك$/i.test(txt))                         return bankPro.openAccount(ctx).catch(() => next());
    if (/^محفظتي$/i.test(txt))                      return bankPro.showWallet(ctx).catch(() => next());
    if (/^بطاقتي$/i.test(txt))                      return bankPro.showCard(ctx).catch(() => next());
    if (/^كشف$/i.test(txt))                         return bankPro.showStatement(ctx).catch(() => next());
    if (/^تحويل\s+\d/i.test(txt))                   return bankPro.transfer(ctx).catch(() => next());
    if (/^قرض(\s+\d.*)?$/i.test(txt))               return bankPro.requestLoan(ctx).catch(() => next());
    if (/^ديوني$/i.test(txt))                        return bankPro.showLoans(ctx).catch(() => next());
    if (/^سداد$/i.test(txt))                         return bankPro.repayLoan(ctx).catch(() => next());
    if (/^استثمار(\s+\d.*)?$/i.test(txt))            return bankPro.invest(ctx).catch(() => next());
    if (/^سحب استثمار$/i.test(txt))                  return bankPro.withdrawInvest(ctx).catch(() => next());
    if (/^(الاثرياء|أثرياء|اثرياء)$/i.test(txt))   return bankPro.richList(ctx).catch(() => next());`;

  if (!content.includes(OLD_BANK)) {
    warn('تعذّر إيجاد block البنك القديم — إضافة يدوية مطلوبة.');
    warn('أضف أوامر bankPro يدوياً داخل gameAndBankMiddleware في index.js');
  } else {
    content = content.replace(OLD_BANK, NEW_BANK);
    ok('تم إضافة أوامر البنك الاحترافي في gameAndBankMiddleware!');
  }

  // ── C. إضافة callback handler ──
  const CB_SEARCH = "bot.on('callback_query'";
  if (content.includes(CB_SEARCH) && !content.includes('bankpro:')) {
    // أضف قبل أول bot.on('callback_query') — أو بعد bot.use(groupProtectionMiddleware)
    content = content.replace(
      /bot\.on\('callback_query'/,
      `// 🏦 Callbacks بنك Taline\nbot.on('callback_query', async (ctx, next) => {\n  if (ctx.callbackQuery?.data?.startsWith('bankpro:')) {\n    return bankPro.handleCallback(ctx).catch(() => {});\n  }\n  return next();\n});\n\nbot.on('callback_query'`
    );
    ok('تم إضافة callback handler للبنك!');
  } else if (!content.includes('bankpro:')) {
    warn('أضف callback handler يدوياً (انظر تعليمات أدناه).');
  }

  fs.writeFileSync(INDEX_FILE, content, 'utf8');
  ok('تم حفظ index.js بنجاح!');
}

// ════════════════════════════════════════════════
//  STEP 4: Deploy
// ════════════════════════════════════════════════
function deploy() {
  inf('رفع التعديلات إلى Railway...');
  try {
    execSync('git -C "' + PROJECT_DIR + '" add -A', { stdio: 'inherit' });
    execSync('git -C "' + PROJECT_DIR + '" commit -m "feat: add Taline Bank pro system"', { stdio: 'inherit' });
    execSync('git -C "' + PROJECT_DIR + '" push', { stdio: 'inherit' });
    ok('تم رفع التعديلات! سيتم إعادة النشر تلقائياً.');
  } catch(e) {
    err('فشل الـ push: ' + e.message);
    warn('حاول يدوياً: cd ' + PROJECT_DIR + ' && git push');
  }
}

// ════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════
(async () => {
  console.log('\n' + B + '══════════════════════════════════════' + W);
  console.log(B + '  🏦  Taline Bank — Setup Script' + W);
  console.log(B + '══════════════════════════════════════\n' + W);

  try {
    // Step 1: Database migration
    await runMigration();

    // Step 2: Copy handler
    copyHandler();

    // Step 3: Patch index.js
    patchIndex();

    // Step 4: Ask about deploy
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('\n' + Y + 'هل تريد رفع التعديلات إلى Railway الآن؟ (y/n): ' + W, (ans) => {
      rl.close();
      if (ans.toLowerCase() === 'y') {
        deploy();
      } else {
        warn('لم يتم الرفع. شغّل: cd ' + PROJECT_DIR + ' && git add -A && git push');
      }

      console.log('\n' + G + '══════════════════════════════════════' + W);
      console.log(G + '  ✅  الإعداد اكتمل بنجاح!' + W);
      console.log(G + '══════════════════════════════════════\n' + W);
      console.log('📋 الأوامر المتاحة الآن في البوت:\n');
      console.log('  بنك          — فتح/عرض الحساب');
      console.log('  محفظتي       — لوحة البنك الكاملة');
      console.log('  بطاقتي       — تفاصيل البطاقة');
      console.log('  كشف          — آخر المعاملات');
      console.log('  تحويل 5000   — تحويل مبلغ (رد على رسالة)');
      console.log('  قرض 10000    — طلب قرض');
      console.log('  ديوني        — عرض القروض');
      console.log('  سداد         — تسديد القرض');
      console.log('  استثمار 5000 — استثمار مبلغ');
      console.log('  سحب استثمار  — سحب الأرباح');
      console.log('  الاثرياء     — قائمة أغنى المستخدمين\n');
    });

  } catch(e) {
    err('خطأ: ' + e.message);
    console.error(e);
    process.exit(1);
  }
})();
