const fs = require('fs');
const path = require('path');
const BASE = process.env.HOME + '/study-bot-backup-20260407_011636';

// ══════════════════════════════════════════
// 1. إضافة جداول البنك في db.js
// ══════════════════════════════════════════
const dbPath = path.join(BASE, 'database/db.js');
let db = fs.readFileSync(dbPath, 'utf8');

const bankTables = `
    // ── نظام البنك ──
    "CREATE TABLE IF NOT EXISTS bank_accounts(user_id BIGINT PRIMARY KEY, username TEXT, first_name TEXT, balance NUMERIC DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS bank_transactions(id SERIAL PRIMARY KEY, from_id BIGINT, to_id BIGINT, amount NUMERIC, type TEXT, note TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS bank_loans(id SERIAL PRIMARY KEY, user_id BIGINT, amount NUMERIC, due_at TIMESTAMP, paid INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",`;

// أضف قبل آخر سطر في مصفوفة الجداول
db = db.replace(
  '"CREATE TABLE IF NOT EXISTS group_chats(',
  bankTables + '\n    "CREATE TABLE IF NOT EXISTS group_chats('
);

fs.writeFileSync(dbPath, db);
console.log('✅ db.js updated');

// ══════════════════════════════════════════
// 2. إنشاء handlers/bank.js
// ══════════════════════════════════════════
const bankHandler = `'use strict';
const { get, run, all } = require('../database/db');
const { cacheGet, cacheSet } = require('../utils/cache');

const MIN_TRANSFER = 100;  // حد أدنى للتحويل
const MAX_LOAN_RATIO = 1;  // 100% من الرصيد
const MIN_LOAN_BALANCE = 100; // حد أدنى للرصيد للحصول على قرض

// ── مساعدات ──
function fmt(n) { return Number(n).toLocaleString('en') + ' $'; }

async function getAccount(userId) {
  return await get('SELECT * FROM bank_accounts WHERE user_id=$1', [userId]);
}

async function ensureAccount(userId, firstName, username) {
  let acc = await getAccount(userId);
  if (!acc) {
    await run(
      'INSERT INTO bank_accounts(user_id, first_name, username, balance) VALUES($1,$2,$3,0)',
      [userId, firstName || '', username || '']
    );
    acc = await getAccount(userId);
  }
  return acc;
}

async function addBalance(userId, amount, type, note, fromId) {
  await run(
    'UPDATE bank_accounts SET balance = balance + $1 WHERE user_id=$2',
    [amount, userId]
  );
  await run(
    'INSERT INTO bank_transactions(from_id, to_id, amount, type, note) VALUES($1,$2,$3,$4,$5)',
    [fromId || userId, userId, amount, type, note || '']
  );
}

// ── إنشاء حساب ──
exports.createAccount = async (ctx) => {
  const uid = ctx.uid || ctx.from?.id;
  const existing = await getAccount(uid);
  if (existing) {
    return ctx.reply(
      '🏦 *حسابك البنكي موجود بالفعل!*\\n\\n' +
      '💰 رصيدك الحالي: *' + fmt(existing.balance) + '*\\n\\n' +
      'اكتب *فلوسي* لعرض تفاصيل حسابك.',
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }

  await run(
    'INSERT INTO bank_accounts(user_id, first_name, username, balance) VALUES($1,$2,$3,0)',
    [uid, ctx.from?.first_name || '', ctx.from?.username || '']
  );

  return ctx.reply(
    '🏦 *تم إنشاء حسابك البنكي!*\\n\\n' +
    '👤 الاسم: *' + (ctx.from?.first_name || 'مجهول') + '*\\n' +
    '🆔 رقم الحساب: `' + uid + '`\\n' +
    '💰 الرصيد الابتدائي: *0 $*\\n\\n' +
    '💡 ابدأ بالعب لكسب المال!',
    { parse_mode: 'Markdown' }
  ).catch(() => {});
};

// ── عرض الرصيد ──
exports.showBalance = async (ctx) => {
  const uid = ctx.uid || ctx.from?.id;
  const replyTo = ctx.message?.reply_to_message;

  // إذا رد على رسالة شخص آخر
  const targetId = replyTo ? replyTo.from?.id : uid;
  const isSelf = targetId === uid;

  const acc = await getAccount(targetId);
  if (!acc) {
    return ctx.reply(
      isSelf ? '❌ ليس لديك حساب بنكي!\\n\\nاكتب *انشاء حساب* لفتح حساب.' :
               '❌ هذا المستخدم ليس لديه حساب بنكي.',
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }

  const txs = await all(
    'SELECT * FROM bank_transactions WHERE to_id=$1 OR from_id=$1 ORDER BY created_at DESC LIMIT 5',
    [targetId]
  ).catch(() => []);

  let text = '🏦 *حساب ' + (isSelf ? 'بنكك' : acc.first_name || 'المستخدم') + '*\\n';
  text += '━━━━━━━━━━━━━━━━━━━━\\n\\n';
  text += '🆔 رقم الحساب: `' + targetId + '`\\n';
  text += '💰 الرصيد: *' + fmt(acc.balance) + '*\\n\\n';

  if (txs.length) {
    text += '📋 *آخر المعاملات:*\\n';
    txs.forEach(tx => {
      const isIn = tx.to_id == targetId && tx.from_id != targetId;
      text += (isIn ? '📥' : '📤') + ' ' + fmt(tx.amount) + ' — ' + (tx.note || tx.type) + '\\n';
    });
  }

  return ctx.reply(text, { parse_mode: 'Markdown' }).catch(() => {});
};

// ── تحويل ──
exports.transfer = async (ctx) => {
  const uid = ctx.uid || ctx.from?.id;
  const replyTo = ctx.message?.reply_to_message;
  const text = ctx.message?.text || '';

  // فارسي [مبلغ] — رد على رسالة
  if (!replyTo) {
    return ctx.reply('📌 *كيف تحول؟*\\n\\nرد على رسالة المستخدم واكتب:\\n`فارسي 500`', { parse_mode: 'Markdown' }).catch(() => {});
  }

  const toId = replyTo.from?.id;
  if (toId === uid) return ctx.reply('❌ لا تستطيع التحويل لنفسك!').catch(() => {});

  const amount = parseFloat(text.replace(/فارسي/g, '').trim());
  if (isNaN(amount) || amount < MIN_TRANSFER) {
    return ctx.reply('❌ أدخل مبلغاً صحيحاً (الحد الأدنى ' + fmt(MIN_TRANSFER) + ')').catch(() => {});
  }

  const fromAcc = await getAccount(uid);
  if (!fromAcc) return ctx.reply('❌ ليس لديك حساب بنكي! اكتب *انشاء حساب*', { parse_mode: 'Markdown' }).catch(() => {});
  if (fromAcc.balance < amount) return ctx.reply('❌ رصيدك غير كافٍ! رصيدك: *' + fmt(fromAcc.balance) + '*', { parse_mode: 'Markdown' }).catch(() => {});

  const toAcc = await ensureAccount(toId, replyTo.from?.first_name, replyTo.from?.username);

  await run('UPDATE bank_accounts SET balance = balance - $1 WHERE user_id=$2', [amount, uid]);
  await run('UPDATE bank_accounts SET balance = balance + $1 WHERE user_id=$2', [amount, toId]);
  await run('INSERT INTO bank_transactions(from_id, to_id, amount, type, note) VALUES($1,$2,$3,$4,$5)',
    [uid, toId, amount, 'transfer', 'تحويل من ' + (ctx.from?.first_name || uid)]);

  // إشعار المستلم
  ctx.telegram.sendMessage(toId,
    '💸 *استلمت تحويلاً!*\\n\\n' +
    '👤 من: *' + (ctx.from?.first_name || 'مجهول') + '*\\n' +
    '💰 المبلغ: *' + fmt(amount) + '*\\n' +
    '💳 رصيدك الجديد: *' + fmt(Number(toAcc.balance) + amount) + '*',
    { parse_mode: 'Markdown' }
  ).catch(() => {});

  return ctx.reply(
    '✅ *تم التحويل!*\\n\\n' +
    '💸 أرسلت *' + fmt(amount) + '* لـ ' + (replyTo.from?.first_name || 'المستخدم') + '\\n' +
    '💳 رصيدك المتبقي: *' + fmt(Number(fromAcc.balance) - amount) + '*',
    { parse_mode: 'Markdown' }
  ).catch(() => {});
};

// ── قرض ──
exports.loan = async (ctx) => {
  const uid = ctx.uid || ctx.from?.id;
  const replyTo = ctx.message?.reply_to_message;
  const text = ctx.message?.text || '';

  if (!replyTo) {
    return ctx.reply('📌 *كيف تطلب قرضاً؟*\\n\\nرد على رسالة المستخدم واكتب:\\n`rip 500`\\n\\n⚠️ يجب أن يكون رصيدك فوق ' + fmt(MIN_LOAN_BALANCE), { parse_mode: 'Markdown' }).catch(() => {});
  }

  const toId = replyTo.from?.id;
  if (toId === uid) return ctx.reply('❌ لا تستطيع إقراض نفسك!').catch(() => {});

  const amount = parseFloat(text.replace(/rip/gi, '').trim());
  if (isNaN(amount) || amount <= 0) {
    return ctx.reply('❌ أدخل مبلغاً صحيحاً\\nمثال: `rip 500`', { parse_mode: 'Markdown' }).catch(() => {});
  }

  const fromAcc = await getAccount(uid);
  if (!fromAcc) return ctx.reply('❌ ليس لديك حساب! اكتب *انشاء حساب*', { parse_mode: 'Markdown' }).catch(() => {});
  if (fromAcc.balance < MIN_LOAN_BALANCE) return ctx.reply('❌ يجب أن يكون رصيدك فوق *' + fmt(MIN_LOAN_BALANCE) + '* للإقراض!', { parse_mode: 'Markdown' }).catch(() => {});
  if (amount > fromAcc.balance) return ctx.reply('❌ لا تستطيع إقراض أكثر من رصيدك *' + fmt(fromAcc.balance) + '*', { parse_mode: 'Markdown' }).catch(() => {});

  const toAcc = await ensureAccount(toId, replyTo.from?.first_name, replyTo.from?.username);

  await run('UPDATE bank_accounts SET balance = balance - $1 WHERE user_id=$2', [amount, uid]);
  await run('UPDATE bank_accounts SET balance = balance + $1 WHERE user_id=$2', [amount, toId]);
  await run('INSERT INTO bank_transactions(from_id, to_id, amount, type, note) VALUES($1,$2,$3,$4,$5)',
    [uid, toId, amount, 'loan', 'قرض من ' + (ctx.from?.first_name || uid)]);
  await run('INSERT INTO bank_loans(user_id, amount, due_at) VALUES($1,$2, NOW() + INTERVAL \'7 days\')',
    [toId, amount]);

  ctx.telegram.sendMessage(toId,
    '🤝 *حصلت على قرض!*\\n\\n' +
    '👤 من: *' + (ctx.from?.first_name || 'مجهول') + '*\\n' +
    '💰 المبلغ: *' + fmt(amount) + '*\\n' +
    '💳 رصيدك الجديد: *' + fmt(Number(toAcc.balance) + amount) + '*\\n\\n' +
    '⚠️ يجب السداد خلال 7 أيام!',
    { parse_mode: 'Markdown' }
  ).catch(() => {});

  return ctx.reply(
    '✅ *تم القرض!*\\n\\n' +
    '🤝 أقرضت *' + fmt(amount) + '* لـ ' + (replyTo.from?.first_name || 'المستخدم') + '\\n' +
    '💳 رصيدك المتبقي: *' + fmt(Number(fromAcc.balance) - amount) + '*',
    { parse_mode: 'Markdown' }
  ).catch(() => {});
};

// ── إضافة رصيد من الألعاب ──
exports.addWinnings = async (userId, firstName, username, amount, note) => {
  try {
    await ensureAccount(userId, firstName, username);
    await run('UPDATE bank_accounts SET balance = balance + $1 WHERE user_id=$2', [amount, userId]);
    await run('INSERT INTO bank_transactions(from_id, to_id, amount, type, note) VALUES($1,$2,$3,$4,$5)',
      [userId, userId, amount, 'win', note || 'جائزة لعبة']);
    return true;
  } catch(_) { return false; }
};

// ── رقم البنك ──
exports.showAccountNumber = async (ctx) => {
  const uid = ctx.uid || ctx.from?.id;
  const replyTo = ctx.message?.reply_to_message;
  const targetId = replyTo ? replyTo.from?.id : uid;
  const acc = await getAccount(targetId);
  if (!acc) return ctx.reply('❌ لا يوجد حساب بنكي لهذا المستخدم.').catch(() => {});
  return ctx.reply('🏦 رقم الحساب: \`' + targetId + '\`', { parse_mode: 'Markdown' }).catch(() => {});
};
`;

fs.writeFileSync(path.join(BASE, 'handlers/bank.js'), bankHandler);
console.log('✅ bank.js created');

console.log('\\n🏁 All done!');
