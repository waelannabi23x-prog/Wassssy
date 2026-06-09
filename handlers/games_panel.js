'use strict';
const { get, run, all } = require('../database/db');
const { build: kbBuild, btn: kbBtn } = require('../utils/keyboard');
const { eos } = require('../utils/helpers');

// ══════════════════════════════════════════
// لوحة الألعاب الرئيسية
// ══════════════════════════════════════════
async function showGamesPanel(ctx) {
  const text =
    '🎮 *لوحة الألعاب*\n' +
    '━━━━━━━━━━━━━━━━━━━━\n\n' +
    '🎯 *الألعاب المتاحة:*\n\n' +
    '🎰 *من سيربح المليون* — لعبة أسئلة وأجوبة\n' +
    '📸 *خمن الصورة* — تحدي بين لاعبين\n\n' +
    '⚙️ اختر لعبة لإدارتها:';

  const slotStats = await get('SELECT COUNT(*) as games, SUM(CASE WHEN amount>0 THEN 1 ELSE 0 END) as wins FROM bank_transactions WHERE type=$1', ['slot_win']).catch(()=>({games:0,wins:0}));
  const rows = [
    [kbBtn('🎰 إدارة لعبة المليون', 'gp_million_panel')],
    [kbBtn('📸 إدارة لعبة خمن',     'gp_guess_panel')],
    [kbBtn('🎰 إعدادات السلوت',      'gp_slot_panel')],
    [kbBtn('🏪 إدارة المتجر',        'gp_shop_panel')],
    [kbBtn('◀️ رجوع', 'gp_panel')],
  ];
  return eos(ctx, text, { parse_mode: 'Markdown', ...kbBuild(rows) });
}

// ══════════════════════════════════════════
// لوحة إدارة المليون
// ══════════════════════════════════════════
async function showMillionPanel(ctx) {
  const count = await get('SELECT COUNT(*) AS cnt FROM million_questions WHERE is_active=1').catch(() => ({ cnt: 0 }));
  const text =
    '🎰 *إدارة لعبة المليون*\n' +
    '━━━━━━━━━━━━━━━━━━━━\n\n' +
    '📊 الأسئلة النشطة: *' + (count?.cnt || 0) + '*\n\n' +
    '⚙️ اختر ما تريد:';

  const rows = [
    [kbBtn('➕ إضافة سؤال', 'gp_million_add')],
    [kbBtn('📋 عرض الأسئلة', 'gp_million_list_0')],
    [kbBtn('🗑 حذف سؤال', 'gp_million_del')],
    [kbBtn('◀️ رجوع', 'mb_panel')],
  ];
  return eos(ctx, text, { parse_mode: 'Markdown', ...kbBuild(rows) });
}

// ══════════════════════════════════════════
// لوحة إدارة خمن
// ══════════════════════════════════════════
async function showGuessPanel(ctx) {
  const text =
    '📸 *إدارة لعبة خمن*\n' +
    '━━━━━━━━━━━━━━━━━━━━\n\n' +
    '🎯 *كيف تعمل اللعبة؟*\n' +
    '• اكتب *خمن* في القروب لبدء تحدي\n' +
    '• اكتب *انا* للانضمام\n' +
    '• كل لاعب يرسل صورة سرية للبوت\n' +
    '• الفائز من يخمن صورة منافسه أولاً\n\n' +
    '💰 جائزة الفوز: *500 $*';

  const rows = [
    [kbBtn('◀️ رجوع', 'mb_panel')],
  ];
  return eos(ctx, text, { parse_mode: 'Markdown', ...kbBuild(rows) });
}

// ══════════════════════════════════════════
// عرض قائمة الأسئلة
// ══════════════════════════════════════════
async function showMillionQuestions(ctx, page) {
  page = parseInt(page) || 0;
  const limit = 5;
  const offset = page * limit;
  const questions = await all(
    'SELECT * FROM million_questions WHERE is_active=1 ORDER BY id DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  ).catch(() => []);
  const total = await get('SELECT COUNT(*) AS cnt FROM million_questions WHERE is_active=1').catch(() => ({ cnt: 0 }));

  if (!questions.length) {
    return eos(ctx, '📋 *لا توجد أسئلة بعد!*\n\nاضغط ➕ لإضافة سؤال.', {
      parse_mode: 'Markdown',
      ...kbBuild([[kbBtn('◀️ رجوع', 'gp_million_panel')]])
    });
  }

  let text = '📋 *قائمة الأسئلة* (' + (page * limit + 1) + '-' + Math.min((page + 1) * limit, total.cnt) + ' من ' + total.cnt + ')\n━━━━━━━━━━━━━━━━━━━━\n\n';
  questions.forEach((q, i) => {
    text += (offset + i + 1) + '. [' + q.id + '] ' + (q.text || '').substring(0, 40) + '\n';
    text += '   ✅ ' + (q.correct || '?') + ' | ' + (q.difficulty || 'medium') + '\n\n';
  });

  const rows = [];
  const navRow = [];
  if (page > 0) navRow.push(kbBtn('◀️', 'gp_million_list_' + (page - 1)));
  if ((page + 1) * limit < total.cnt) navRow.push(kbBtn('▶️', 'gp_million_list_' + (page + 1)));
  if (navRow.length) rows.push(navRow);
  rows.push([kbBtn('◀️ رجوع', 'gp_million_panel')]);

  return eos(ctx, text, { parse_mode: 'Markdown', ...kbBuild(rows) });
}

// ══════════════════════════════════════════
// handleCallback
// ══════════════════════════════════════════
async function handleCallback(ctx, data) {
  if (data === 'mb_panel')         return showGamesPanel(ctx);
  if (data === 'gp_slot_panel')   return showSlotPanel(ctx);
  if (data === 'gp_shop_panel')   return showShopPanel(ctx);
  if (data === 'gp_slot_top') {
    const { all: dbAll } = require('../database/db');
    const top = await dbAll(
      "SELECT user_id, first_name, SUM(amount) as total FROM bank_transactions WHERE description LIKE '%سلوت%' AND amount>0 GROUP BY user_id, first_name ORDER BY total DESC LIMIT 10"
    ).catch(() => []);
    let txt = '🏆 *أفضل لاعبي السلوت*\n━━━━━━━━━━━━━━━━━━━━\n\n';
    if (!top.length) txt += '_لا توجد بيانات بعد_';
    const medals = ['🥇','🥈','🥉'];
    top.forEach((p,i) => { txt += (medals[i]||i+1+'.') + ' ' + (p.first_name||'مجهول') + ' — *' + p.total + ' دج*\n'; });
    return eos(ctx, txt, { parse_mode:'Markdown', ...kbBuild([[kbBtn('◀️ رجوع','gp_slot_panel')]]) });
  }
  if (data === 'gp_slot_bet') {
    return eos(ctx, '💰 *تغيير الرهان*\n\nأرسل المبلغ الجديد (الحد الأدنى 10 دج):', { parse_mode:'Markdown', ...kbBuild([[kbBtn('❌ إلغاء','gp_slot_panel')]]) });
  }
  if (data === 'gp_million_panel') return showMillionPanel(ctx);
  if (data === 'gp_guess_panel') return showGuessPanel(ctx);
  if (data.startsWith('gp_million_list_')) return showMillionQuestions(ctx, data.replace('gp_million_list_', ''));

  if (data === 'gp_million_add') {
    const { setState } = require('../utils/stateManager');
    await setState(ctx.uid || ctx.from?.id, { type: 'million_add_q' });
    return eos(ctx,
      '➕ *إضافة سؤال جديد*\n━━━━━━━━━━━━━━━━━━━━\n\n' +
      'أرسل السؤال بهذا الشكل:\n\n' +
      '`السؤال؟\nأ) خيار1\nب) خيار2\nج) خيار3\nد) خيار4\nالإجابة: أ`\n\n' +
      'مثال:\n`ما عاصمة الجزائر؟\nأ) وهران\nب) الجزائر\nج) قسنطينة\nد) عنابة\nالإجابة: ب`',
      { parse_mode: 'Markdown', ...kbBuild([[kbBtn('❌ إلغاء', 'gp_million_panel')]]) }
    );
  }

  if (data === 'gp_million_del') {
    const { setState } = require('../utils/stateManager');
    await setState(ctx.uid || ctx.from?.id, { type: 'million_del_q' });
    return eos(ctx,
      '🗑 *حذف سؤال*\n\nأرسل رقم ID السؤال لحذفه:\n\nاستعمل عرض الأسئلة لمعرفة الـ ID.',
      { parse_mode: 'Markdown', ...kbBuild([[kbBtn('❌ إلغاء', 'gp_million_panel')]]) }
    );
  }
}

// ══════════════════════════════════════════
// handleText — إضافة/حذف سؤال
// ══════════════════════════════════════════
async function handleText(ctx) {
  const uid = ctx.uid || ctx.from?.id;
  const { getState, delState } = require('../utils/stateManager');
  const state = await getState(uid);
  if (!state) return false;

  // إضافة سؤال
  if (state.type === 'million_add_q') {
    const text = ctx.message?.text || '';
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 6) {
      await ctx.reply('❌ الصيغة غير صحيحة! أرسل السؤال كاملاً مع 4 خيارات والإجابة.').catch(() => {});
      return true;
    }
    const question = lines[0];
    const optA = lines[1].replace(/^أ[)\s]+/, '').trim();
    const optB = lines[2].replace(/^ب[)\s]+/, '').trim();
    const optC = lines[3].replace(/^ج[)\s]+/, '').trim();
    const optD = lines[4].replace(/^د[)\s]+/, '').trim();
    const answerLine = lines[5].replace(/الإجابة[:\s]+/, '').trim();
    const answerMap = { 'أ': optA, 'ب': optB, 'ج': optC, 'د': optD };
    const correct = answerMap[answerLine] || answerLine;

    await run(
      'INSERT INTO million_questions(text, option_a, option_b, option_c, option_d, correct, difficulty, is_active) VALUES($1,$2,$3,$4,$5,$6,$7,1)',
      [question, optA, optB, optC, optD, correct, 'medium']
    ).catch(() => {});
    await delState(uid);
    await ctx.reply('✅ *تم إضافة السؤال!*\n\n❓ ' + question + '\n✅ الإجابة: ' + correct, { parse_mode: 'Markdown' }).catch(() => {});
    return true;
  }

  // حذف سؤال
  if (state.type === 'million_del_q') {
    const id = parseInt(ctx.message?.text || '');
    if (isNaN(id)) {
      await ctx.reply('❌ أرسل رقم ID صحيح').catch(() => {});
      return true;
    }
    const q = await get('SELECT * FROM million_questions WHERE id=$1', [id]).catch(() => null);
    if (!q) {
      await ctx.reply('❌ لم يتم العثور على سؤال برقم ' + id).catch(() => {});
      return true;
    }
    await run('UPDATE million_questions SET is_active=0::smallint WHERE id=$1', [id]).catch(() => {});
    await delState(uid);
    await ctx.reply('✅ تم حذف السؤال: ' + (q.text || '').substring(0, 50)).catch(() => {});
    return true;
  }

  return false;
}


// ══════════════════════════════════════════
// لوحة إعدادات السلوت
// ══════════════════════════════════════════
async function showSlotPanel(ctx) {
  const { get: dbGet } = require('../database/db');
  // إحصائيات السلوت
  const stats = await dbGet(
    "SELECT COUNT(*) as total, SUM(CASE WHEN description LIKE '%ربح%' THEN 1 ELSE 0 END) as wins FROM bank_transactions WHERE description LIKE '%سلوت%'"
  ).catch(() => ({ total: 0, wins: 0 }));

  const text =
    '🎰 *إعدادات السلوت*\n' +
    '━━━━━━━━━━━━━━━━━━━━\n\n' +
    '📊 *الإحصائيات:*\n' +
    '🎮 إجمالي الجولات: *' + (stats?.total || 0) + '*\n' +
    '🏆 الفائزون: *' + (stats?.wins || 0) + '*\n\n' +
    '⚙️ *الإعدادات الحالية:*\n' +
    '💰 الرهان: *50 دج*\n' +
    '💎 جاكبوت: *×10*\n' +
    '7️⃣ سبعة: *×7*\n' +
    '⭐ نجوم: *×5*\n' +
    '🎉 ثلاثة: *×3*\n' +
    '✅ اثنان: *×1.5*\n';

  const rows = [
    [kbBtn('💰 تغيير الرهان',     'gp_slot_bet')],
    [kbBtn('🏆 أفضل اللاعبين',    'gp_slot_top')],
    [kbBtn('🔄 إعادة ضبط',        'gp_slot_reset')],
    [kbBtn('◀️ رجوع', 'mb_panel')],
  ];
  return eos(ctx, text, { parse_mode: 'Markdown', ...kbBuild(rows) });
}

// ══════════════════════════════════════════
// لوحة إدارة المتجر
// ══════════════════════════════════════════
async function showShopPanel(ctx) {
  const { all: dbAll } = require('../database/db');
  const purchases = await dbAll(
    "SELECT COUNT(*) as cnt FROM bank_transactions WHERE description LIKE '%متجر%' OR description LIKE '%اشترى%'"
  ).catch(() => []);
  const total = purchases[0]?.cnt || 0;

  const items = [
    { id:1, name:'🛡️ درع الحماية',  price:500  },
    { id:2, name:'⭐ نجمة VIP',      price:1000 },
    { id:3, name:'🎯 تذكرة مليون',   price:300  },
    { id:4, name:'🎰 رمز سلوت ×2',   price:200  },
    { id:5, name:'📦 صندوق مفاجأة',  price:150  },
  ];

  let text = '🏪 *إدارة المتجر*\n━━━━━━━━━━━━━━━━━━━━\n\n';
  text += '📊 إجمالي المشتريات: *' + total + '*\n\n';
  text += '🛒 *المنتجات الحالية:*\n';
  for (const item of items) {
    text += item.name + ' — ' + item.price + ' دج\n';
  }

  const rows = [
    [kbBtn('➕ إضافة منتج',      'gp_shop_add')],
    [kbBtn('✏️ تعديل سعر',       'gp_shop_edit')],
    [kbBtn('📊 إحصائيات المبيعات','gp_shop_stats')],
    [kbBtn('◀️ رجوع', 'mb_panel')],
  ];
  return eos(ctx, text, { parse_mode: 'Markdown', ...kbBuild(rows) });
}

module.exports = { showGamesPanel, showMillionPanel, showGuessPanel, handleCallback, handleText };
