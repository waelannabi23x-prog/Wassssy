#!/usr/bin/env node
/**
 * patch_bank_admin.cjs
 * شغّل: node patch_bank_admin.cjs
 * من داخل مجلد المشروع
 */
const fs = require('fs');
const path = require('path');

const G = '\x1b[32m', Y = '\x1b[33m', R = '\x1b[31m', W = '\x1b[0m';
const ok   = m => console.log(G + '✅ ' + m + W);
const warn = m => console.log(Y + '⚠️  ' + m + W);
const err  = m => console.log(R + '❌ ' + m + W);

// ════════════════════════════════════════════════
//  PATCH 1 — لوحة الإدارة: استبدل mg_bank_panel
// ════════════════════════════════════════════════
function patchManage() {
  const file = path.join(process.cwd(), 'handlers', 'manage.js');
  let c = fs.readFileSync(file, 'utf8');

  // ── A. استبدل زر البنك القديم ──
  c = c.replace(
    `btn('🏦 البنك','mg_bank_panel')`,
    `btn('🏦 Taline Bank','mg_pro_bank_panel')`
  );

  // ── B. استبدل لوحة البنك القديمة كاملة ──
  const OLD_PANEL = `  if(data==='mg_bank_panel'){
    try {
      const { all } = require('../database/db');
      const [accounts, txCount] = await Promise.all([
        all('SELECT COUNT(*) as cnt FROM bank_accounts').catch(()=>[{cnt:0}]),
        all('SELECT COUNT(*) as cnt FROM bank_transactions').catch(()=>[{cnt:0}]),
      ]);
      const text =
        '🏦 *لوحة البنك*\\n' +
        '━━━━━━━━━━━━━━━━━━━━\\n\\n' +
        '👤 الحسابات: *' + (accounts[0]?.cnt||0) + '*\\n' +
        '💸 المعاملات: *' + (txCount[0]?.cnt||0) + '*\\n\\n' +
        '⚙️ اختر ما تريد:';
      const rows = [
        [btn('👤 أغنى المستخدمين','mg_bank_top')],
        [btn('💸 آخر المعاملات','mg_bank_txs')],
        [btn('➕ إضافة رصيد','mg_bank_add')],
        [back('mg_menu')[0]],
      ];
      return eos(ctx, text, {parse_mode:'Markdown', ...build(rows)});
    } catch(e) { return ctx.answerCbQuery('❌ ' + e.message, {show_alert:true}).catch(()=>{}); }
  }`;

  const NEW_PANEL = `  // ══════════════════════════════════════
  //  🏦  Taline Bank Admin Panel
  // ══════════════════════════════════════
  if (data === 'mg_pro_bank_panel') {
    try {
      const { all } = require('../database/db');
      const [accs, txs, loans, invests] = await Promise.all([
        all('SELECT COUNT(*) as cnt FROM pro_bank_accounts').catch(()=>[{cnt:0}]),
        all('SELECT COUNT(*) as cnt FROM pro_bank_transactions').catch(()=>[{cnt:0}]),
        all('SELECT COUNT(*) as cnt FROM pro_bank_loans WHERE paid=0').catch(()=>[{cnt:0}]),
        all('SELECT COUNT(*) as cnt FROM pro_bank_investments WHERE active=1').catch(()=>[{cnt:0}]),
      ]);
      const totalBal = await all('SELECT COALESCE(SUM(balance),0) as s FROM pro_bank_accounts').catch(()=>[{s:0}]);
      const text =
        '🏦 *Taline Bank — لوحة الإدارة*\\n' +
        '━━━━━━━━━━━━━━━━━━━━\\n\\n' +
        '👥 الحسابات: *' + (accs[0]?.cnt||0) + '*\\n' +
        '💸 المعاملات: *' + (txs[0]?.cnt||0) + '*\\n' +
        '🔴 قروض نشطة: *' + (loans[0]?.cnt||0) + '*\\n' +
        '📈 استثمارات: *' + (invests[0]?.cnt||0) + '*\\n\\n' +
        '💰 إجمالي الأموال: *' + Number(totalBal[0]?.s||0).toLocaleString('en') + ' DA*';
      const rows = [
        [btn('🏆 أغنى المستخدمين','mg_pb_top'),  btn('💸 آخر المعاملات','mg_pb_txs')],
        [btn('➕ إضافة رصيد','mg_pb_add'),        btn('➖ خصم رصيد','mg_pb_deduct')],
        [btn('🔍 بحث مستخدم','mg_pb_search'),    btn('🔄 إعادة ضبط حساب','mg_pb_reset')],
        [btn('🔴 قروض نشطة','mg_pb_loans'),      btn('📈 استثمارات','mg_pb_invests')],
        [btn('💳 ترقية بطاقة','mg_pb_upgrade'),  btn('🚫 تجميد حساب','mg_pb_freeze')],
        [back('mg_menu')[0]],
      ];
      return eos(ctx, text, { parse_mode:'Markdown', ...build(rows) });
    } catch(e) { return ctx.answerCbQuery('❌ ' + e.message, {show_alert:true}).catch(()=>{}); }
  }

  // ── أغنى المستخدمين (pro) ──
  if (data === 'mg_pb_top') {
    const { all } = require('../database/db');
    const top = await all(
      'SELECT first_name, username, balance, card_type FROM pro_bank_accounts ORDER BY balance DESC LIMIT 15'
    ).catch(()=>[]);
    const cards = {classic:'🪙',silver:'🥈',gold:'🥇',platinum:'💎',black:'🖤'};
    let text = '🏆 *أغنى المستخدمين*\\n━━━━━━━━━━━━━━━━━━━━\\n\\n';
    top.forEach((u,i) => {
      text += (i+1) + '. ' + (cards[u.card_type]||'🪙') + ' *' + (u.first_name||'مجهول') + '*\\n';
      text += '   ' + Number(u.balance).toLocaleString('en') + ' DA\\n';
    });
    return eos(ctx, text||'لا يوجد', { parse_mode:'Markdown', ...build([back('mg_pro_bank_panel')]) });
  }

  // ── آخر المعاملات (pro) ──
  if (data === 'mg_pb_txs') {
    const { all } = require('../database/db');
    const txs = await all(
      \`SELECT t.*, 
        (SELECT first_name FROM pro_bank_accounts WHERE user_id=t.from_id LIMIT 1) as fn,
        (SELECT first_name FROM pro_bank_accounts WHERE user_id=t.to_id   LIMIT 1) as tn
       FROM pro_bank_transactions t ORDER BY t.created_at DESC LIMIT 15\`
    ).catch(()=>[]);
    const typeAr = {transfer:'تحويل',win:'جائزة',loan:'قرض',repay:'سداد',invest:'استثمار',deposit:'إيداع',salary:'راتب'};
    let text = '💸 *آخر المعاملات*\\n━━━━━━━━━━━━━━━━━━━━\\n\\n';
    txs.forEach(t => {
      const d = new Date(t.created_at).toLocaleDateString('ar-DZ',{month:'short',day:'numeric'});
      text += (typeAr[t.type]||t.type) + ' | ' + Number(t.amount).toLocaleString('en') + ' DA';
      if (t.fee > 0) text += ' (رسوم: ' + t.fee + ')';
      text += '\\n   ' + (t.fn||'النظام') + ' ← ' + (t.tn||'النظام') + ' | ' + d + '\\n';
    });
    return eos(ctx, text||'لا يوجد', { parse_mode:'Markdown', ...build([back('mg_pro_bank_panel')]) });
  }

  // ── القروض النشطة ──
  if (data === 'mg_pb_loans') {
    const { all } = require('../database/db');
    const loans = await all(
      \`SELECT l.*, a.first_name FROM pro_bank_loans l
       LEFT JOIN pro_bank_accounts a ON a.user_id=l.user_id
       WHERE l.paid=0 ORDER BY l.due_at ASC LIMIT 20\`
    ).catch(()=>[]);
    let text = '🔴 *القروض النشطة*\\n━━━━━━━━━━━━━━━━━━━━\\n\\n';
    loans.forEach(l => {
      const days = Math.ceil((new Date(l.due_at) - Date.now()) / 86400000);
      text += '👤 ' + (l.first_name||l.user_id) + '\\n';
      text += '   💸 ' + Number(l.total_due).toLocaleString('en') + ' DA | ';
      text += (days > 0 ? '⏳ ' + days + ' يوم' : '🔴 متأخر ' + Math.abs(days) + ' يوم') + '\\n';
    });
    if (!loans.length) text += '✅ لا توجد قروض نشطة';
    return eos(ctx, text, { parse_mode:'Markdown', ...build([back('mg_pro_bank_panel')]) });
  }

  // ── الاستثمارات النشطة ──
  if (data === 'mg_pb_invests') {
    const { all } = require('../database/db');
    const invs = await all(
      \`SELECT i.*, a.first_name FROM pro_bank_investments i
       LEFT JOIN pro_bank_accounts a ON a.user_id=i.user_id
       WHERE i.active=1 ORDER BY i.amount DESC LIMIT 20\`
    ).catch(()=>[]);
    let text = '📈 *الاستثمارات النشطة*\\n━━━━━━━━━━━━━━━━━━━━\\n\\n';
    invs.forEach(inv => {
      const days = Math.floor((Date.now() - new Date(inv.created_at)) / 86400000);
      const profit = Math.floor(Number(inv.amount) * inv.daily_rate * days);
      text += '👤 ' + (inv.first_name||inv.user_id) + ' | ' + inv.tier + '\\n';
      text += '   💰 ' + Number(inv.amount).toLocaleString('en') + ' DA | ربح: +' + profit.toLocaleString('en') + '\\n';
    });
    if (!invs.length) text += '_(لا توجد استثمارات)_';
    return eos(ctx, text, { parse_mode:'Markdown', ...build([back('mg_pro_bank_panel')]) });
  }

  // ── إضافة رصيد ──
  if (data === 'mg_pb_add') {
    setState(uid, { type: 'mg_pb_add_id', op: 'add' });
    return eos(ctx, '➕ *إضافة رصيد*\\n\\nأرسل ID المستخدم:', 
      { parse_mode:'Markdown', ...build([[btn('❌ إلغاء','mg_pro_bank_panel')]]) });
  }

  // ── خصم رصيد ──
  if (data === 'mg_pb_deduct') {
    setState(uid, { type: 'mg_pb_add_id', op: 'deduct' });
    return eos(ctx, '➖ *خصم رصيد*\\n\\nأرسل ID المستخدم:',
      { parse_mode:'Markdown', ...build([[btn('❌ إلغاء','mg_pro_bank_panel')]]) });
  }

  // ── بحث مستخدم ──
  if (data === 'mg_pb_search') {
    setState(uid, { type: 'mg_pb_search_id' });
    return eos(ctx, '🔍 *بحث عن مستخدم*\\n\\nأرسل ID أو اسم المستخدم:',
      { parse_mode:'Markdown', ...build([[btn('❌ إلغاء','mg_pro_bank_panel')]]) });
  }

  // ── تجميد/فك تجميد ──
  if (data === 'mg_pb_freeze') {
    setState(uid, { type: 'mg_pb_freeze_id' });
    return eos(ctx, '🚫 *تجميد/فك تجميد حساب*\\n\\nأرسل ID المستخدم:',
      { parse_mode:'Markdown', ...build([[btn('❌ إلغاء','mg_pro_bank_panel')]]) });
  }

  // ── ترقية بطاقة ──
  if (data === 'mg_pb_upgrade') {
    setState(uid, { type: 'mg_pb_upgrade_id' });
    return eos(ctx, '💳 *ترقية بطاقة يدوية*\\n\\nأرسل ID المستخدم:',
      { parse_mode:'Markdown', ...build([[btn('❌ إلغاء','mg_pro_bank_panel')]]) });
  }

  // ── إعادة ضبط حساب ──
  if (data === 'mg_pb_reset') {
    setState(uid, { type: 'mg_pb_reset_id' });
    return eos(ctx, '🔄 *إعادة ضبط حساب*\\n⚠️ سيُصفَّر الرصيد!\\n\\nأرسل ID المستخدم:',
      { parse_mode:'Markdown', ...build([[btn('❌ إلغاء','mg_pro_bank_panel')]]) });
  }

  // ── البنك القديم (للتوافق) ──
  if(data==='mg_bank_panel'){
    return ctx.answerCbQuery('').catch(()=>{});
  }`;

  if (!c.includes("data === 'mg_pro_bank_panel'")) {
    if (c.includes(OLD_PANEL)) {
      c = c.replace(OLD_PANEL, NEW_PANEL);
      ok('تم استبدال لوحة البنك القديمة بالجديدة!');
    } else {
      // أضف قبل mg_bank_add
      c = c.replace(
        `  if(data==='mg_bank_add') {`,
        NEW_PANEL + `\n\n  if(data==='mg_bank_add') {`
      );
      ok('تم إضافة لوحة البنك الجديدة!');
    }
  } else {
    warn('لوحة البنك الجديدة موجودة بالفعل.');
  }

  // ── C. معالجة state لإضافة/خصم/بحث/تجميد/ترقية/ضبط ──
  const STATE_SEARCH = `case 'mg_bank_add_id': {`;
  const STATE_INSERT = `// ── Taline Bank admin states ──
      case 'mg_pb_add_id': {
        const targetId = parseInt(text.trim());
        if (isNaN(targetId)) return ctx.reply('❌ ID غير صحيح').catch(()=>{});
        const acc = await dbG('SELECT * FROM pro_bank_accounts WHERE user_id=$1',[targetId]).catch(()=>null);
        if (!acc) return ctx.reply('❌ لا يوجد حساب بهذا ID').catch(()=>{});
        setState(uid, { ...state, type: 'mg_pb_add_amount', targetId, targetName: acc.first_name||String(targetId) });
        return ctx.reply(
          (state.op==='deduct'?'➖ خصم':'➕ إضافة') + ' رصيد لـ *' + (acc.first_name||targetId) + '*\\n' +
          '💰 رصيده الحالي: *' + Number(acc.balance).toLocaleString('en') + ' DA*\\n\\nأرسل المبلغ:',
          { parse_mode:'Markdown', ...build([[btn('❌ إلغاء','mg_pro_bank_panel')]]) }
        ).catch(()=>{});
      }
      case 'mg_pb_add_amount': {
        const amount = parseFloat(text.trim());
        if (isNaN(amount) || amount <= 0) return ctx.reply('❌ مبلغ غير صحيح').catch(()=>{});
        const { run: dbR2 } = require('../database/db');
        const op = state.op || 'add';
        if (op === 'deduct') {
          await dbR('UPDATE pro_bank_accounts SET balance=GREATEST(0,balance-$1) WHERE user_id=$2',[amount,state.targetId]);
          await dbR(\`INSERT INTO pro_bank_transactions(from_id,to_id,amount,fee,type,note) VALUES($1,$2,$3,0,'admin','خصم يدوي من الأدمن')\`,[state.targetId,state.targetId,amount]);
        } else {
          await dbR('UPDATE pro_bank_accounts SET balance=balance+$1 WHERE user_id=$2',[amount,state.targetId]);
          await dbR(\`INSERT INTO pro_bank_transactions(from_id,to_id,amount,fee,type,note) VALUES(0,$1,$2,0,'admin','إضافة يدوية من الأدمن')\`,[state.targetId,amount]);
        }
        const newAcc = await dbG('SELECT balance,card_type FROM pro_bank_accounts WHERE user_id=$1',[state.targetId]).catch(()=>null);
        clearState(uid);
        // أبلغ المستخدم
        ctx.telegram.sendMessage(state.targetId,
          (op==='deduct'?'🔴 تم خصم ':'🟢 تم إضافة ') + '*' + amount.toLocaleString('en') + ' DA* ' +
          (op==='deduct'?'من':'إلى') + ' حسابك بواسطة الإدارة.\\n💳 رصيدك: *' + Number(newAcc?.balance||0).toLocaleString('en') + ' DA*',
          { parse_mode:'Markdown' }
        ).catch(()=>{});
        return eos(ctx,
          '✅ تم ' + (op==='deduct'?'خصم':'إضافة') + ' *' + amount.toLocaleString('en') + ' DA* ' +
          (op==='deduct'?'من':'لـ') + ' *' + state.targetName + '*\\n💳 الرصيد الجديد: *' + Number(newAcc?.balance||0).toLocaleString('en') + ' DA*',
          { parse_mode:'Markdown', ...build([back('mg_pro_bank_panel')]) }
        );
      }
      case 'mg_pb_search_id': {
        const { all: dbAll } = require('../database/db');
        const q = text.trim();
        const results = await dbAll(
          'SELECT * FROM pro_bank_accounts WHERE user_id=$1::text::bigint OR first_name ILIKE $2 OR username ILIKE $2 LIMIT 5',
          [isNaN(q)?0:q, '%'+q+'%']
        ).catch(()=>[]);
        clearState(uid);
        if (!results.length) return ctx.reply('❌ لم يُوجد مستخدم').catch(()=>{});
        const cards = {classic:'🪙',silver:'🥈',gold:'🥇',platinum:'💎',black:'🖤'};
        let text2 = '🔍 *نتائج البحث*\\n━━━━━━━━━━━━━━━━━━━━\\n\\n';
        results.forEach(u => {
          text2 += cards[u.card_type]||'🪙';
          text2 += ' *' + (u.first_name||'مجهول') + '*';
          if (u.username) text2 += ' (@' + u.username + ')';
          text2 += '\\n🆔 ' + u.user_id + ' | 💰 ' + Number(u.balance).toLocaleString('en') + ' DA';
          text2 += ' | ' + (u.is_frozen?'🔴 مجمد':'🟢 نشط') + '\\n\\n';
        });
        return eos(ctx, text2, { parse_mode:'Markdown', ...build([back('mg_pro_bank_panel')]) });
      }
      case 'mg_pb_freeze_id': {
        const targetId = parseInt(text.trim());
        if (isNaN(targetId)) return ctx.reply('❌ ID غير صحيح').catch(()=>{});
        const acc = await dbG('SELECT * FROM pro_bank_accounts WHERE user_id=$1',[targetId]).catch(()=>null);
        if (!acc) return ctx.reply('❌ لا يوجد حساب').catch(()=>{});
        const newState2 = acc.is_frozen ? 0 : 1;
        await dbR('UPDATE pro_bank_accounts SET is_frozen=$1 WHERE user_id=$2',[newState2,targetId]);
        clearState(uid);
        ctx.telegram.sendMessage(targetId,
          newState2 ? '🔴 *تم تجميد حسابك البنكي من قبل الإدارة.*' : '🟢 *تم فك تجميد حسابك البنكي.*',
          { parse_mode:'Markdown' }
        ).catch(()=>{});
        return eos(ctx,
          '✅ تم ' + (newState2?'تجميد':'فك تجميد') + ' حساب *' + (acc.first_name||targetId) + '*',
          { parse_mode:'Markdown', ...build([back('mg_pro_bank_panel')]) }
        );
      }
      case 'mg_pb_upgrade_id': {
        const targetId = parseInt(text.trim());
        if (isNaN(targetId)) return ctx.reply('❌ ID غير صحيح').catch(()=>{});
        const acc = await dbG('SELECT * FROM pro_bank_accounts WHERE user_id=$1',[targetId]).catch(()=>null);
        if (!acc) return ctx.reply('❌ لا يوجد حساب').catch(()=>{});
        setState(uid, { ...state, type: 'mg_pb_upgrade_card', targetId, targetName: acc.first_name });
        return ctx.reply(
          '💳 اختر نوع البطاقة الجديدة:\\n\\n' +
          '1 — 🪙 Classic\\n2 — 🥈 Silver\\n3 — 🥇 Gold\\n4 — 💎 Platinum\\n5 — 🖤 Black\\n\\nأرسل الرقم:',
          build([[btn('❌ إلغاء','mg_pro_bank_panel')]])
        ).catch(()=>{});
      }
      case 'mg_pb_upgrade_card': {
        const types = {1:'classic',2:'silver',3:'gold',4:'platinum',5:'black'};
        const cardType = types[parseInt(text.trim())];
        if (!cardType) return ctx.reply('❌ رقم غير صحيح (1-5)').catch(()=>{});
        await dbR('UPDATE pro_bank_accounts SET card_type=$1 WHERE user_id=$2',[cardType,state.targetId]);
        const emojis = {classic:'🪙',silver:'🥈',gold:'🥇',platinum:'💎',black:'🖤'};
        clearState(uid);
        ctx.telegram.sendMessage(state.targetId,
          '🎉 تمت ترقية بطاقتك إلى *' + emojis[cardType] + ' ' + cardType.charAt(0).toUpperCase()+cardType.slice(1) + '*!',
          { parse_mode:'Markdown' }
        ).catch(()=>{});
        return eos(ctx,
          '✅ تم ترقية بطاقة *' + (state.targetName||state.targetId) + '* إلى ' + emojis[cardType] + ' ' + cardType,
          { parse_mode:'Markdown', ...build([back('mg_pro_bank_panel')]) }
        );
      }
      case 'mg_pb_reset_id': {
        const targetId = parseInt(text.trim());
        if (isNaN(targetId)) return ctx.reply('❌ ID غير صحيح').catch(()=>{});
        await dbR('UPDATE pro_bank_accounts SET balance=0, card_type=\\'classic\\', is_frozen=0 WHERE user_id=$1',[targetId]);
        await dbR('UPDATE pro_bank_loans SET paid=1 WHERE user_id=$1 AND paid=0',[targetId]);
        await dbR('UPDATE pro_bank_investments SET active=0 WHERE user_id=$1',[targetId]);
        clearState(uid);
        return eos(ctx, '✅ تم إعادة ضبط حساب ID: ' + targetId,
          { ...build([back('mg_pro_bank_panel')]) });
      }

      `;

  if (!c.includes("case 'mg_pb_add_id':")) {
    if (c.includes(STATE_SEARCH)) {
      c = c.replace(STATE_SEARCH, STATE_INSERT + STATE_SEARCH);
      ok('تم إضافة states البنك الاحترافي!');
    } else {
      warn('تعذّر إيجاد موقع الـ states — تخطي.');
    }
  } else {
    warn('states البنك موجودة بالفعل.');
  }

  fs.writeFileSync(file, c, 'utf8');
  ok('تم حفظ manage.js!');
}

// ════════════════════════════════════════════════
//  PATCH 2 — السماح لجميع المستخدمين باستخدام
//            أوامر وأزرار البنك في الخاص
// ════════════════════════════════════════════════
function patchAuth() {
  const file = path.join(process.cwd(), 'middlewares', 'auth.js');
  let c = fs.readFileSync(file, 'utf8');

  // البحث عن نقطة التحقق من الاشتراك في الخاص
  const OLD = `    if (!ctx.isOwner && !ctx.isAdmin && chatType === 'private') {
      const cbData = ctx.callbackQuery?.data;`;

  const NEW = `    if (!ctx.isOwner && !ctx.isAdmin && chatType === 'private') {
      const cbData = ctx.callbackQuery?.data;

      // ✅ البنك مفتوح للجميع في الخاص
      const BANK_CMDS = ['بنك','محفظتي','بطاقتي','كشف','ديوني','سداد','الاثرياء','أثرياء','اثرياء'];
      const msgTxt = (ctx.message?.text||'').trim();
      const isBankCmd = BANK_CMDS.includes(msgTxt)
        || /^تحويل\\s+\\d/i.test(msgTxt)
        || /^قرض/i.test(msgTxt)
        || /^استثمار/i.test(msgTxt)
        || /^سحب استثمار/i.test(msgTxt)
        || (cbData && cbData.startsWith('bankpro:'));
      if (isBankCmd) return next();`;

  if (!c.includes('isBankCmd')) {
    if (c.includes(OLD)) {
      c = c.replace(OLD, NEW);
      ok('تم إضافة استثناء البنك في auth.js!');
    } else {
      warn('تعذّر إيجاد موقع التحقق في auth.js — أضفه يدوياً.');
    }
  } else {
    warn('استثناء البنك موجود بالفعل في auth.js.');
  }

  fs.writeFileSync(file, c, 'utf8');
  ok('تم حفظ auth.js!');
}

// ════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════
console.log('\n\x1b[34m══════════════════════════════════════\x1b[0m');
console.log('\x1b[34m  🏦  Taline Bank — Admin Patch\x1b[0m');
console.log('\x1b[34m══════════════════════════════════════\n\x1b[0m');

try {
  patchManage();
  patchAuth();

  console.log('\n' + G + '══════════════════════════════════════' + W);
  console.log(G + '  ✅  اكتمل بنجاح!' + W);
  console.log(G + '══════════════════════════════════════\n' + W);
  console.log('الخطوة التالية:');
  console.log('  git add -A && git commit -m "feat: bank admin panel + auth fix" && git push\n');
} catch(e) {
  err('خطأ: ' + e.message);
  console.error(e);
  process.exit(1);
}
