'use strict';
const { get, run, all, getPg } = require('../database/db');

const MIN_TRANSFER    = 100;
const MIN_LOAN_BALANCE = 100;

function fmt(n) { return Number(n).toLocaleString('en') + ' $'; }

async function getAccount(userId) {
  return await get('SELECT * FROM bank_accounts WHERE user_id=$1', [userId]);
}

async function ensureAccount(userId, firstName, username) {
  let acc = await getAccount(userId);
  if (!acc) {
    await run(
      'INSERT INTO bank_accounts(user_id, first_name, username, balance) VALUES($1,$2,$3,0) ON CONFLICT(user_id) DO NOTHING',
      [userId, firstName || '', username || '']
    );
    acc = await getAccount(userId);
  }
  return acc;
}

// ── helper: atomic debit/credit داخل transaction مع row-level lock ──
async function _atomicTransfer({ fromId, toId, amount, type, note, extraQueries = [] }) {
  const pg     = getPg();
  const client = await pg.connect();
  try {
    await client.query('BEGIN');

    // Lock rows بالترتيب الثابت (أصغر id أولاً) لتجنب deadlock
    const [lockFirst, lockSecond] = fromId < toId
      ? [fromId, toId]
      : [toId,   fromId];
    await client.query(
      'SELECT balance FROM bank_accounts WHERE user_id = ANY($1::bigint[]) FOR UPDATE',
      [[lockFirst, lockSecond]]
    );

    // تحقق من الرصيد داخل الـ transaction
    const { rows } = await client.query(
      'SELECT balance FROM bank_accounts WHERE user_id=$1', [fromId]
    );
    if (!rows.length || Number(rows[0].balance) < amount) {
      await client.query('ROLLBACK');
      client.release();
      return { ok: false, reason: 'insufficient' };
    }

    await client.query(
      'UPDATE bank_accounts SET balance = balance - $1 WHERE user_id=$2', [amount, fromId]
    );
    await client.query(
      'UPDATE bank_accounts SET balance = balance + $1 WHERE user_id=$2', [amount, toId]
    );
    await client.query(
      'INSERT INTO bank_transactions(from_id,to_id,amount,type,note) VALUES($1,$2,$3,$4,$5)',
      [fromId, toId, amount, type, note]
    );

    for (const { sql, params } of extraQueries) {
      await client.query(sql, params);
    }

    await client.query('COMMIT');
    return { ok: true };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
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
  await run(
    'INSERT INTO bank_accounts(user_id, first_name, username, balance) VALUES($1,$2,$3,0) ON CONFLICT(user_id) DO NOTHING',
    [uid, ctx.from?.first_name || '', ctx.from?.username || '']
  );
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
  const uid      = ctx.uid || ctx.from?.id;
  const targetId = uid;
  const acc = await getAccount(targetId);
  if (!acc) {
    return ctx.reply(
      '❌ ليس لديك حساب!\n\nاكتب *انشاء حساب* لفتح حساب.',
      { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }
    ).catch(() => {});
  }
  const txs = await all(
    'SELECT * FROM bank_transactions WHERE to_id=$1 OR from_id=$1 ORDER BY created_at DESC LIMIT 5',
    [targetId]
  ).catch(() => []);
  let text  = '🏦 *حساب بنكك*\n';
  text += '━━━━━━━━━━━━━━━━━━━━\n\n';
  text += '🆔 رقم الحساب: `' + targetId + '`\n';
  text += '💰 الرصيد: *' + fmt(acc.balance) + '*\n\n';
  if (txs.length) {
    text += '📋 *آخر المعاملات:*\n';
    txs.forEach(tx => {
      const isIn  = tx.to_id == targetId && tx.from_id != targetId;
      const arrow = isIn ? '📥' : '📤';
      const note  = tx.note || tx.type || 'معاملة';
      text += arrow + ' *' + fmt(tx.amount) + '* — ' + note + '\n';
    });
  }
  const kb = [[
    { text: '💸 تحويل',         callback_data: 'bank_transfer_help' },
    { text: '📊 إحصائياتي',     callback_data: 'bank_stats_' + targetId },
  ],[
    { text: '🏆 أثرى المستخدمين', callback_data: 'bank_top' },
  ]];
  return ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_to_message_id: ctx.message?.message_id,
    reply_markup: { inline_keyboard: kb },
  }).catch(() => {});
};

// ── تحويل (atomic) ──
exports.transfer = async (ctx) => {
  const uid     = ctx.uid || ctx.from?.id;
  const replyTo = ctx.message?.reply_to_message;
  const text    = ctx.message?.text || '';
  if (!replyTo) {
    return ctx.reply(
      '📌 *كيف تحول؟*\n\nرد على رسالة المستخدم واكتب:\nفارسي 500',
      { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }
    ).catch(() => {});
  }
  const toId = replyTo.from?.id;
  if (toId === uid) return ctx.reply('❌ لا تستطيع التحويل لنفسك!').catch(() => {});

  const amount = parseFloat(text.replace(/فارسي/g, '').trim());
  if (isNaN(amount) || amount < MIN_TRANSFER) {
    return ctx.reply(
      '❌ أدخل مبلغاً صحيحاً (الحد الأدنى ' + fmt(MIN_TRANSFER) + ')',
      { reply_to_message_id: ctx.message?.message_id }
    ).catch(() => {});
  }

  // تأكد من وجود حساب المرسل
  const fromAcc = await getAccount(uid);
  if (!fromAcc) {
    return ctx.reply('❌ ليس لديك حساب! اكتب *انشاء حساب*',
      { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }
    ).catch(() => {});
  }

  // أنشئ حساب المستقبل إذا ما عنده (خارج الـ transaction — آمن)
  await ensureAccount(toId, replyTo.from?.first_name, replyTo.from?.username);

  const result = await _atomicTransfer({
    fromId: uid,
    toId,
    amount,
    type: 'transfer',
    note: 'تحويل من ' + (ctx.from?.first_name || uid),
  }).catch(e => ({ ok: false, reason: e.message }));

  if (!result.ok) {
    const msg = result.reason === 'insufficient'
      ? '❌ رصيدك غير كافٍ!'
      : '❌ فشل التحويل، حاول مجدداً.';
    return ctx.reply(msg, { reply_to_message_id: ctx.message?.message_id }).catch(() => {});
  }

  const [fromNew, toNew] = await Promise.all([getAccount(uid), getAccount(toId)]);
  ctx.telegram.sendMessage(toId,
    '💸 *استلمت تحويلاً!*\n\n👤 من: *' + (ctx.from?.first_name || 'مجهول') + '*\n💰 المبلغ: *' + fmt(amount) + '*\n💳 رصيدك الجديد: *' + fmt(toNew?.balance ?? 0) + '*',
    { parse_mode: 'Markdown' }
  ).catch(() => {});

  return ctx.reply(
    '✅ *تم التحويل!*\n\n💸 أرسلت *' + fmt(amount) + '* لـ ' + (replyTo.from?.first_name || 'المستخدم') + '\n💳 رصيدك المتبقي: *' + fmt(fromNew?.balance ?? 0) + '*',
    { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }
  ).catch(() => {});
};

// ── قرض (atomic) ──
exports.loan = async (ctx) => {
  const uid     = ctx.uid || ctx.from?.id;
  const replyTo = ctx.message?.reply_to_message;
  const text    = ctx.message?.text || '';
  if (!replyTo) {
    return ctx.reply(
      '📌 *كيف تقرض؟*\n\nرد على رسالة المستخدم واكتب:\nrip 500\n\n⚠️ يجب أن يكون رصيدك فوق ' + fmt(MIN_LOAN_BALANCE),
      { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }
    ).catch(() => {});
  }
  const toId = replyTo.from?.id;
  if (toId === uid) return ctx.reply('❌ لا تستطيع إقراض نفسك!').catch(() => {});

  const amount = parseFloat(text.replace(/rip/gi, '').trim());
  if (isNaN(amount) || amount <= 0) {
    return ctx.reply('❌ أدخل مبلغاً صحيحاً\nمثال: rip 500',
      { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }
    ).catch(() => {});
  }

  const fromAcc = await getAccount(uid);
  if (!fromAcc) {
    return ctx.reply('❌ ليس لديك حساب! اكتب *انشاء حساب*',
      { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }
    ).catch(() => {});
  }
  if (fromAcc.balance < MIN_LOAN_BALANCE) {
    return ctx.reply('❌ يجب أن يكون رصيدك فوق *' + fmt(MIN_LOAN_BALANCE) + '* للإقراض!',
      { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }
    ).catch(() => {});
  }

  await ensureAccount(toId, replyTo.from?.first_name, replyTo.from?.username);

  const result = await _atomicTransfer({
    fromId: uid,
    toId,
    amount,
    type: 'loan',
    note: 'قرض من ' + (ctx.from?.first_name || uid),
    extraQueries: [
      { sql: "INSERT INTO bank_loans(user_id,amount,due_at) VALUES($1,$2, NOW() + INTERVAL '7 days')", params: [toId, amount] },
    ],
  }).catch(e => ({ ok: false, reason: e.message }));

  if (!result.ok) {
    const msg = result.reason === 'insufficient'
      ? '❌ رصيدك غير كافٍ!'
      : '❌ فشل القرض، حاول مجدداً.';
    return ctx.reply(msg, { reply_to_message_id: ctx.message?.message_id }).catch(() => {});
  }

  const [fromNew, toNew] = await Promise.all([getAccount(uid), getAccount(toId)]);
  ctx.telegram.sendMessage(toId,
    '🤝 *حصلت على قرض!*\n\n👤 من: *' + (ctx.from?.first_name || 'مجهول') + '*\n💰 المبلغ: *' + fmt(amount) + '*\n💳 رصيدك الجديد: *' + fmt(toNew?.balance ?? 0) + '*\n\n⚠️ يجب السداد خلال 7 أيام!',
    { parse_mode: 'Markdown' }
  ).catch(() => {});

  return ctx.reply(
    '✅ *تم القرض!*\n\n🤝 أقرضت *' + fmt(amount) + '* لـ ' + (replyTo.from?.first_name || 'المستخدم') + '\n💳 رصيدك المتبقي: *' + fmt(fromNew?.balance ?? 0) + '*',
    { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }
  ).catch(() => {});
};

// ── إضافة رصيد من الألعاب ──
exports.addWinnings = async (userId, firstName, username, amount, note) => {
  try {
    await ensureAccount(userId, firstName, username);
    await run('UPDATE bank_accounts SET balance = balance + $1 WHERE user_id=$2', [amount, userId]);
    await run(
      "INSERT INTO bank_transactions(from_id,to_id,amount,type,note) VALUES($1,$2,$3,'win',$4)",
      [userId, userId, amount, note || 'جائزة لعبة']
    );
    return true;
  } catch(e) {
    require('../utils/logger').error('[Bank] addWinnings:', e.message);
    return false;
  }
};

exports.showRip = async (ctx) => {
  const uid = ctx.from.id;
  const acc = await getAccount(uid);
  if (!acc) return ctx.reply('❌ ما عندك حساب بنكي! اكتب *انشاء حساب*',
    { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }
  ).catch(() => {});
  const txs = await all(
    'SELECT * FROM bank_transactions WHERE to_id=$1 OR from_id=$1 ORDER BY created_at DESC LIMIT 10',
    [uid]
  ).catch(() => []);
  let text = '🏦 *حسابك البنكي*\n';
  text += '━━━━━━━━━━━━━━━━\n\n';
  text += '👤 ' + (ctx.from.first_name || '') + '\n';
  text += '💰 الرصيد: *' + fmt(acc.balance) + '*\n\n';
  if (txs.length) {
    text += '📋 *آخر المعاملات:*\n';
    txs.forEach(t => {
      const sign = t.to_id === uid ? '➕' : '➖';
      text += sign + ' ' + fmt(t.amount) + ' — ' + (t.note || t.type) + '\n';
    });
  }
  return ctx.reply(text, { parse_mode: 'Markdown', reply_to_message_id: ctx.message?.message_id }).catch(() => {});
};

exports.getAccount = getAccount;
exports.fmt        = fmt;
