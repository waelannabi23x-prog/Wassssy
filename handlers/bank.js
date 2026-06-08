'use strict';
const { get, run, all } = require('../database/db');

const MIN_TRANSFER = 100;
const MIN_LOAN_BALANCE = 100;

function fmt(n) { return Number(n).toLocaleString('en') + ' $'; }

async function getAccount(userId) {
  return await get('SELECT * FROM bank_accounts WHERE user_id=$1', [userId]);
}

async function ensureAccount(userId, firstName, username) {
  let acc = await getAccount(userId);
  if (!acc) {
    await run('INSERT INTO bank_accounts(user_id, first_name, username, balance) VALUES($1,$2,$3,0)',
      [userId, firstName || '', username || '']);
    acc = await getAccount(userId);
  }
  return acc;
}

// ── إنشاء حساب ──
exports.createAccount = async (ctx) => {
  const uid = ctx.uid || ctx.from?.id;
  const existing = await getAccount(uid);
  if (existing) {
    return ctx.reply(
      '🏦 *حسابك البنكي موجود!*\n\n💰 رصيدك: *' + fmt(existing.balance) + '*\n\nاكتب *فلوسي* لعرض تفاصيل حسابك.',
      { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }
    ).catch(() => {});
  }
  await run('INSERT INTO bank_accounts(user_id, first_name, username, balance) VALUES($1,$2,$3,0)',
    [uid, ctx.from?.first_name || '', ctx.from?.username || '']);
  return ctx.reply(
    '🏦 *تم إنشاء حسابك البنكي!*\n\n' +
    '👤 الاسم: *' + (ctx.from?.first_name || 'مجهول') + '*\n' +
    '🆔 رقم الحساب: ' + uid + '\n' +
    '💰 الرصيد الابتدائي: *0 $*\n\n' +
    '💡 ابدأ بالعب لكسب المال!',
    { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }
  ).catch(() => {});
};

// ── عرض الرصيد ──
exports.showBalance = async (ctx) => {
  const uid = ctx.uid || ctx.from?.id;
  // فلوسي = دائماً رصيد المستخدم نفسه
  const targetId = uid;
  const isSelf = true;
  const acc = await getAccount(targetId);
  if (!acc) {
    return ctx.reply(
      isSelf ? '❌ ليس لديك حساب!\n\nاكتب *انشاء حساب* لفتح حساب.' : '❌ هذا المستخدم ليس لديه حساب.',
      { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }
    ).catch(() => {});
  }
  const txs = await all(
    'SELECT * FROM bank_transactions WHERE to_id=$1 OR from_id=$1 ORDER BY created_at DESC LIMIT 5',
    [targetId]
  ).catch(() => []);
  let text = '🏦 *حساب ' + (isSelf ? 'بنكك' : acc.first_name || 'المستخدم') + '*\n';
  text += '━━━━━━━━━━━━━━━━━━━━\n\n';
  text += '🆔 رقم الحساب: ' + targetId + '\n';
  text += '💰 الرصيد: *' + fmt(acc.balance) + '*\n\n';
  if (txs.length) {
    text += '📋 *آخر المعاملات:*\n';
    txs.forEach(tx => {
      const isIn = tx.to_id == targetId && tx.from_id != targetId;
      text += (isIn ? '📥' : '📤') + ' ' + fmt(tx.amount) + ' — ' + (tx.note || tx.type) + '\n';
    });
  }
  return ctx.reply(text, { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }).catch(() => {});
};

// ── تحويل ──
exports.transfer = async (ctx) => {
  const uid = ctx.uid || ctx.from?.id;
  const replyTo = ctx.message?.reply_to_message;
  const text = ctx.message?.text || '';
  if (!replyTo) {
    return ctx.reply('📌 *كيف تحول؟*\n\nرد على رسالة المستخدم واكتب:\nفارسي 500', { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }).catch(() => {});
  }
  const toId = replyTo.from?.id;
  if (toId === uid) return ctx.reply('❌ لا تستطيع التحويل لنفسك!').catch(() => {});
  const amount = parseFloat(text.replace(/فارسي/g, '').trim());
  if (isNaN(amount) || amount < MIN_TRANSFER) {
    return ctx.reply('❌ أدخل مبلغاً صحيحاً (الحد الأدنى ' + fmt(MIN_TRANSFER) + ')').catch(() => {});
  }
  const fromAcc = await getAccount(uid);
  if (!fromAcc) return ctx.reply('❌ ليس لديك حساب! اكتب *انشاء حساب*', { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }).catch(() => {});
  if (fromAcc.balance < amount) return ctx.reply('❌ رصيدك غير كافٍ! رصيدك: *' + fmt(fromAcc.balance) + '*', { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }).catch(() => {});
  const toAcc = await ensureAccount(toId, replyTo.from?.first_name, replyTo.from?.username);
  await run('UPDATE bank_accounts SET balance = balance - $1 WHERE user_id=$2', [amount, uid]);
  await run('UPDATE bank_accounts SET balance = balance + $1 WHERE user_id=$2', [amount, toId]);
  await run('INSERT INTO bank_transactions(from_id, to_id, amount, type, note) VALUES($1,$2,$3,$4,$5)',
    [uid, toId, amount, 'transfer', 'تحويل من ' + (ctx.from?.first_name || uid)]);
  const toAccNew = await getAccount(toId);
  ctx.telegram.sendMessage(toId,
    '💸 *استلمت تحويلاً!*\n\n👤 من: *' + (ctx.from?.first_name || 'مجهول') + '*\n💰 المبلغ: *' + fmt(amount) + '*\n💳 رصيدك الجديد: *' + fmt(toAccNew ? toAccNew.balance : Number(toAcc.balance) + amount) + '*',
    { parse_mode: 'Markdown' }
  ).catch(() => {});
  return ctx.reply(
    '✅ *تم التحويل!*\n\n💸 أرسلت *' + fmt(amount) + '* لـ ' + (replyTo.from?.first_name || 'المستخدم') + '\n💳 رصيدك المتبقي: *' + fmt(Number(fromAcc.balance) - amount) + '*',
    { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }
  ).catch(() => {});
};

// ── قرض ──
exports.loan = async (ctx) => {
  const uid = ctx.uid || ctx.from?.id;
  const replyTo = ctx.message?.reply_to_message;
  const text = ctx.message?.text || '';
  if (!replyTo) {
    return ctx.reply('📌 *كيف تقرض؟*\n\nرد على رسالة المستخدم واكتب:\nrip 500\n\n⚠️ يجب أن يكون رصيدك فوق ' + fmt(MIN_LOAN_BALANCE), { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }).catch(() => {});
  }
  const toId = replyTo.from?.id;
  if (toId === uid) return ctx.reply('❌ لا تستطيع إقراض نفسك!').catch(() => {});
  const amount = parseFloat(text.replace(/rip/gi, '').trim());
  if (isNaN(amount) || amount <= 0) {
    return ctx.reply('❌ أدخل مبلغاً صحيحاً\nمثال: rip 500', { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }).catch(() => {});
  }
  const fromAcc = await getAccount(uid);
  if (!fromAcc) return ctx.reply('❌ ليس لديك حساب! اكتب *انشاء حساب*', { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }).catch(() => {});
  if (fromAcc.balance < MIN_LOAN_BALANCE) return ctx.reply('❌ يجب أن يكون رصيدك فوق *' + fmt(MIN_LOAN_BALANCE) + '* للإقراض!', { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }).catch(() => {});
  if (amount > fromAcc.balance) return ctx.reply('❌ لا تستطيع إقراض أكثر من رصيدك *' + fmt(fromAcc.balance) + '*', { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }).catch(() => {});
  const toAcc = await ensureAccount(toId, replyTo.from?.first_name, replyTo.from?.username);
  await run('UPDATE bank_accounts SET balance = balance - $1 WHERE user_id=$2', [amount, uid]);
  await run('UPDATE bank_accounts SET balance = balance + $1 WHERE user_id=$2', [amount, toId]);
  await run('INSERT INTO bank_transactions(from_id, to_id, amount, type, note) VALUES($1,$2,$3,$4,$5)',
    [uid, toId, amount, 'loan', 'قرض من ' + (ctx.from?.first_name || uid)]);
  await run('INSERT INTO bank_loans(user_id, amount, due_at) VALUES($1,$2, NOW() + INTERVAL \'7 days\')', [toId, amount]);
  const toAccLoanNew = await getAccount(toId);
  ctx.telegram.sendMessage(toId,
    '🤝 *حصلت على قرض!*\n\n👤 من: *' + (ctx.from?.first_name || 'مجهول') + '*\n💰 المبلغ: *' + fmt(amount) + '*\n💳 رصيدك الجديد: *' + fmt(toAccLoanNew ? toAccLoanNew.balance : Number(toAcc.balance) + amount) + '*\n\n⚠️ يجب السداد خلال 7 أيام!',
    { parse_mode: 'Markdown' }
  ).catch(() => {});
  return ctx.reply(
    '✅ *تم القرض!*\n\n🤝 أقرضت *' + fmt(amount) + '* لـ ' + (replyTo.from?.first_name || 'المستخدم') + '\n💳 رصيدك المتبقي: *' + fmt(Number(fromAcc.balance) - amount) + '*',
    { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }
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

exports.showRip = async (ctx) => {
  const uid = ctx.from.id;
  const acc = await getAccount(uid);
  if (!acc) return ctx.reply('❌ ما عندك حساب بنكي! اكتب *انشاء حساب*', { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }).catch(() => {});
  const { all } = require('../database/db');
  const txs = await all('SELECT * FROM bank_transactions WHERE to_id=$1 OR from_id=$1 ORDER BY created_at DESC LIMIT 10', [uid]).catch(() => []);
  let text = '🏦 *حسابك البنكي*' + String.fromCharCode(10);
  text += '━━━━━━━━━━━━━━━━' + String.fromCharCode(10) + String.fromCharCode(10);
  text += '👤 ' + (ctx.from.first_name || '') + String.fromCharCode(10);
  text += '💰 الرصيد: *' + fmt(acc.balance) + '*' + String.fromCharCode(10) + String.fromCharCode(10);
  if (txs.length) {
    text += '📋 *آخر المعاملات:*' + String.fromCharCode(10);
    txs.forEach(t => {
      const sign = t.to_id === uid ? '➕' : '➖';
      text += sign + ' ' + fmt(t.amount) + ' — ' + (t.note || t.type) + String.fromCharCode(10);
    });
  }
  return ctx.reply(text, { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }).catch(() => {});
};

exports.getAccount = getAccount;
exports.fmt = fmt;
