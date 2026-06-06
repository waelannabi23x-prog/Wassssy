'use strict';\nconst { get, run, all } = require('../database/db');\nconst { build: kbBuild, btn: kbBtn } = require('../utils/keyboard');\nconst { eos } = require('../utils/helpers');

// ══════════════════════════════════════════
// لوحة الألعاب الرئيسية
// ══════════════════════════════════════════
async function showGamesPanel(ctx) {
  const text =\n    '🎮 *لوحة الألعاب*\n' +\n    '━━━━━━━━━━━━━━━━━━━━\n\n' +\n    '🎯 *الألعاب المتاحة:*\n\n' +\n    '🎰 *من سيربح المليون* — لعبة أسئلة وأجوبة\n' +\n    '📸 *خمن الصورة* — تحدي بين لاعبين\n\n' +\n    '⚙️ اختر لعبة لإدارتها:';

  const rows = [\n    [kbBtn('🎰 إدارة لعبة المليون', 'gp_million_panel')],\n    [kbBtn('📸 إدارة لعبة خمن', 'gp_guess_panel')],\n    [kbBtn('◀️ رجوع', 'gp_panel')],
  ];\n  return eos(ctx, text, { parse_mode: 'Markdown', ...kbBuild(rows) });
}

// ══════════════════════════════════════════
// لوحة إدارة المليون
// ══════════════════════════════════════════
async function showMillionPanel(ctx) {\n  const count = await get('SELECT COUNT(*) AS cnt FROM million_questions WHERE is_active=1').catch(() => ({ cnt: 0 }));
  const text =\n    '🎰 *إدارة لعبة المليون*\n' +\n    '━━━━━━━━━━━━━━━━━━━━\n\n' +\n    '📊 الأسئلة النشطة: *' + (count?.cnt || 0) + '*\n\n' +\n    '⚙️ اختر ما تريد:';

  const rows = [\n    [kbBtn('➕ إضافة سؤال', 'gp_million_add')],\n    [kbBtn('📋 عرض الأسئلة', 'gp_million_list_0')],\n    [kbBtn('🗑 حذف سؤال', 'gp_million_del')],\n    [kbBtn('◀️ رجوع', 'mb_panel')],
  ];\n  return eos(ctx, text, { parse_mode: 'Markdown', ...kbBuild(rows) });
}

// ══════════════════════════════════════════
// لوحة إدارة خمن
// ══════════════════════════════════════════
async function showGuessPanel(ctx) {
  const text =\n    '📸 *إدارة لعبة خمن*\n' +\n    '━━━━━━━━━━━━━━━━━━━━\n\n' +\n    '🎯 *كيف تعمل اللعبة؟*\n' +\n    '• اكتب *خمن* في القروب لبدء تحدي\n' +\n    '• اكتب *انا* للانضمام\n' +\n    '• كل لاعب يرسل صورة سرية للبوت\n' +\n    '• الفائز من يخمن صورة منافسه أولاً\n\n' +\n    '💰 جائزة الفوز: *500 $*';

  const rows = [\n    [kbBtn('◀️ رجوع', 'mb_panel')],
  ];\n  return eos(ctx, text, { parse_mode: 'Markdown', ...kbBuild(rows) });
}

// ══════════════════════════════════════════
// عرض قائمة الأسئلة
// ══════════════════════════════════════════
async function showMillionQuestions(ctx, page) {
  page = parseInt(page) || 0;
  const limit = 5;
  const offset = page * limit;
  const questions = await all(\n    'SELECT * FROM million_questions WHERE is_active=1 ORDER BY id DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  ).catch(() => []);\n  const total = await get('SELECT COUNT(*) AS cnt FROM million_questions WHERE is_active=1').catch(() => ({ cnt: 0 }));

  if (!questions.length) {\n    return eos(ctx, '📋 *لا توجد أسئلة بعد!*\n\nاضغط ➕ لإضافة سؤال.', {\n      parse_mode: 'Markdown',\n      ...kbBuild([[kbBtn('◀️ رجوع', 'gp_million_panel')]])
    });
  }
\n  let text = '📋 *قائمة الأسئلة* (' + (page * limit + 1) + '-' + Math.min((page + 1) * limit, total.cnt) + ' من ' + total.cnt + ')\n━━━━━━━━━━━━━━━━━━━━\n\n';
  questions.forEach((q, i) => {\n    text += (offset + i + 1) + '. ' + q.question.substring(0, 40) + '\n';\n    text += '   ✅ ' + q.correct_answer + ' | ⭐'.repeat(q.difficulty || 1) + '\n\n';
  });

  const rows = [];
  const navRow = [];\n  if (page > 0) navRow.push(kbBtn('◀️', 'gp_million_list_' + (page - 1)));\n  if ((page + 1) * limit < total.cnt) navRow.push(kbBtn('▶️', 'gp_million_list_' + (page + 1)));
  if (navRow.length) rows.push(navRow);\n  rows.push([kbBtn('◀️ رجوع', 'gp_million_panel')]);
\n  return eos(ctx, text, { parse_mode: 'Markdown', ...kbBuild(rows) });
}

// ══════════════════════════════════════════
// handleCallback
// ══════════════════════════════════════════
async function handleCallback(ctx, data) {\n  if (data === 'mb_panel') return showGamesPanel(ctx);\n  if (data === 'gp_million_panel') return showMillionPanel(ctx);\n  if (data === 'gp_guess_panel') return showGuessPanel(ctx);\n  if (data.startsWith('gp_million_list_')) return showMillionQuestions(ctx, data.replace('gp_million_list_', ''));
\n  if (data === 'gp_million_add') {\n    const { setState } = require('../utils/stateManager');\n    await setState(ctx.uid || ctx.from?.id, { type: 'million_add_q' });
    return eos(ctx,\n      '➕ *إضافة سؤال جديد*\n━━━━━━━━━━━━━━━━━━━━\n\n' +\n      'أرسل السؤال بهذا الشكل:\n\n' +\n      '`السؤال؟\nأ) خيار1\nب) خيار2\nج) خيار3\nد) خيار4\nالإجابة: أ`\n\n' +\n      'مثال:\n`ما عاصمة الجزائر؟\nأ) وهران\nب) الجزائر\nج) قسنطينة\nد) عنابة\nالإجابة: ب`',\n      { parse_mode: 'Markdown', ...kbBuild([[kbBtn('❌ إلغاء', 'gp_million_panel')]]) }
    );
  }
\n  if (data === 'gp_million_del') {\n    const { setState } = require('../utils/stateManager');\n    await setState(ctx.uid || ctx.from?.id, { type: 'million_del_q' });
    return eos(ctx,\n      '🗑 *حذف سؤال*\n\nأرسل رقم ID السؤال لحذفه:\n\nاستعمل عرض الأسئلة لمعرفة الـ ID.',\n      { parse_mode: 'Markdown', ...kbBuild([[kbBtn('❌ إلغاء', 'gp_million_panel')]]) }
    );
  }
}

// ══════════════════════════════════════════
// handleText — إضافة/حذف سؤال
// ══════════════════════════════════════════
async function handleText(ctx) {
  const uid = ctx.uid || ctx.from?.id;\n  const { getState, delState } = require('../utils/stateManager');
  const state = await getState(uid);
  if (!state) return false;

  // إضافة سؤال\n  if (state.type === 'million_add_q') {\n    const text = ctx.message?.text || '';\n    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 6) {\n      await ctx.reply('❌ الصيغة غير صحيحة! أرسل السؤال كاملاً مع 4 خيارات والإجابة.').catch(() => {});
      return true;
    }
    const question = lines[0];\n    const optA = lines[1].replace(/^أ[)\s]+/, '').trim();\n    const optB = lines[2].replace(/^ب[)\s]+/, '').trim();\n    const optC = lines[3].replace(/^ج[)\s]+/, '').trim();\n    const optD = lines[4].replace(/^د[)\s]+/, '').trim();\n    const answerLine = lines[5].replace(/الإجابة[:\s]+/, '').trim();\n    const answerMap = { 'أ': optA, 'ب': optB, 'ج': optC, 'د': optD };
    const correct = answerMap[answerLine] || answerLine;

    await run(\n      'INSERT INTO million_questions(question, option_a, option_b, option_c, option_d, correct_answer, difficulty, is_active) VALUES($1,$2,$3,$4,$5,$6,1,1)',
      [question, optA, optB, optC, optD, correct]
    ).catch(() => {});
    await delState(uid);\n    await ctx.reply('✅ *تم إضافة السؤال!*\n\n❓ ' + question + '\n✅ الإجابة: ' + correct, { parse_mode: 'Markdown' }).catch(() => {});
    return true;
  }

  // حذف سؤال\n  if (state.type === 'million_del_q') {\n    const id = parseInt(ctx.message?.text || '');
    if (isNaN(id)) {\n      await ctx.reply('❌ أرسل رقم ID صحيح').catch(() => {});
      return true;
    }\n    const q = await get('SELECT * FROM million_questions WHERE id=$1', [id]).catch(() => null);
    if (!q) {\n      await ctx.reply('❌ لم يتم العثور على سؤال برقم ' + id).catch(() => {});
      return true;
    }\n    await run('UPDATE million_questions SET is_active=0 WHERE id=$1', [id]).catch(() => {});
    await delState(uid);\n    await ctx.reply('✅ تم حذف السؤال: ' + q.question.substring(0, 50)).catch(() => {});
    return true;
  }

  return false;
}



// ══════════════════════════════════════════
// إدارة الأسئلة
// ══════════════════════════════════════════
async function showQuestionList(ctx, page) {
  page = parseInt(page) || 0;
  const PER = 5;\n  const total = await get('SELECT COUNT(*) AS cnt FROM million_questions WHERE is_active=1').catch(() => ({ cnt: 0 }));
  const questions = await all(\n    'SELECT * FROM million_questions WHERE is_active=1 ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [PER, page * PER]
  ).catch(() => []);

  if (!questions.length) {\n    return eos(ctx, '📋 *لا توجد أسئلة بعد*

اضغط ➕ لإضافة أسئلة.', {\n      parse_mode: 'Markdown', ...kbBuild([[kbBtn('◀️ رجوع', 'gp_million_panel')]]) });
  }
\n  let text = '📋 *قائمة الأسئلة* (' + total.cnt + ' سؤال)
━━━━━━━━━━━━━━━━━━
\n';
  questions.forEach((q, i) => {
    const diff = q.difficulty === 'easy' ? '🟢' : q.difficulty === 'hard' ? '🔴' : '🟡';\n    text += (page * PER + i + 1) + '. ' + diff + ' ' + q.text.substring(0, 40) + '...\n';
  });

  const rows = [];
  questions.forEach(q => rows.push([kbBtn('🗑 #' + q.id + ' ' + q.text.substring(0, 20), 'gp_million_delid_' + q.id)]));

  const nav = [];\n  if (page > 0) nav.push(kbBtn('⬅️', 'gp_million_list_' + (page - 1)));\n  if ((page + 1) * PER < total.cnt) nav.push(kbBtn('➡️', 'gp_million_list_' + (page + 1)));
  if (nav.length) rows.push(nav);\n  rows.push([kbBtn('➕ إضافة', 'gp_million_add'), kbBtn('◀️ رجوع', 'gp_million_panel')]);
\n  return eos(ctx, text, { parse_mode: 'Markdown', ...kbBuild(rows) });
}

async function handleGamesCallback(ctx, data) {\n  ctx.answerCbQuery('').catch(() => {});\n  const { setState } = require('../utils/stateManager');
  const uid = ctx.uid;
\n  if (data === 'mb_panel')          return showGamesPanel(ctx);\n  if (data === 'gp_million_panel')  return showMillionPanel(ctx);\n  if (data === 'gp_guess_panel')    return showGuessPanel(ctx);
\n  if (data === 'gp_million_add') {\n    await setState(uid, { type: 'admin_add_question', step: 'text' });
    return ctx.reply(\n      '➕ *إضافة سؤال جديد*
━━━━━━━━━━━━━━━━━━

' +\n      '1️⃣ أرسل نص السؤال:
_(أو /cancel للإلغاء)_',\n      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }
\n  if (data.startsWith('gp_million_list_')) {\n    return showQuestionList(ctx, data.replace('gp_million_list_', ''));
  }
\n  if (data === 'gp_million_del') {\n    await setState(uid, { type: 'admin_del_question' });\n    return ctx.reply('🗑 أرسل رقم ID السؤال لحذفه:
_(أو /cancel)_', { parse_mode: 'Markdown' }).catch(() => {});
  }
\n  if (data.startsWith('gp_million_delid_')) {\n    const qid = data.replace('gp_million_delid_', '');\n    await run('UPDATE million_questions SET is_active=0 WHERE id=$1', [qid]).catch(() => {});\n    ctx.answerCbQuery('✅ تم الحذف').catch(() => {});
    return showQuestionList(ctx, 0);
  }
\n  if (data.startsWith('gp_million_diff_')) {\n    const parts = data.replace('gp_million_diff_', '').split('_');
    const diff = parts[0];
    const uid2 = parts[1];\n    const st = await require('../utils/stateManager').getState(uid2 || uid);
    if (st?.draft) {
      st.draft.difficulty = diff;\n      await require('../utils/stateManager').setState(uid2 || uid, st);
    }\n    return ctx.reply('✅ الصعوبة: ' + diff + '\nأرسل الخيار أ:').catch(() => {});
  }
}

async function handleAdminQuestionText(ctx, state) {
  const { setState, delState } = require('../utils/stateManager');
  const uid = ctx.uid;
  const text = ctx.message.text;
\n  if (state.type === 'admin_add_question') {
    const draft = state.draft || {};
\n    if (state.step === 'text') {
      draft.text = text;\n      await setState(uid, { type: 'admin_add_question', step: 'opt_a', draft });\n      return ctx.reply('2️⃣ أرسل الخيار *أ*:', { parse_mode: 'Markdown' }).catch(() => {});
    }\n    if (state.step === 'opt_a') {
      draft.option_a = text;\n      await setState(uid, { type: 'admin_add_question', step: 'opt_b', draft });\n      return ctx.reply('3️⃣ أرسل الخيار *ب*:', { parse_mode: 'Markdown' }).catch(() => {});
    }\n    if (state.step === 'opt_b') {
      draft.option_b = text;\n      await setState(uid, { type: 'admin_add_question', step: 'opt_c', draft });\n      return ctx.reply('4️⃣ أرسل الخيار *ج*:', { parse_mode: 'Markdown' }).catch(() => {});
    }\n    if (state.step === 'opt_c') {
      draft.option_c = text;\n      await setState(uid, { type: 'admin_add_question', step: 'opt_d', draft });\n      return ctx.reply('5️⃣ أرسل الخيار *د*:', { parse_mode: 'Markdown' }).catch(() => {});
    }\n    if (state.step === 'opt_d') {
      draft.option_d = text;\n      await setState(uid, { type: 'admin_add_question', step: 'correct', draft });
      return ctx.reply(\n        '6️⃣ ما هي الإجابة الصحيحة؟
أرسل: *أ* أو *ب* أو *ج* أو *د*',\n        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }\n    if (state.step === 'correct') {\n      const map = { 'أ': 'a', 'ب': 'b', 'ج': 'c', 'د': 'd', 'a': 'a', 'b': 'b', 'c': 'c', 'd': 'd' };
      const correct = map[text.trim()];\n      if (!correct) return ctx.reply('❌ أرسل: أ أو ب أو ج أو د').catch(() => {});
      draft.correct = correct;
\n      const { build, btn } = require('../utils/keyboard');\n      await setState(uid, { type: 'admin_add_question', step: 'diff', draft });\n      return ctx.reply('7️⃣ اختر الصعوبة:', {
        ...build([\n          [btn('🟢 سهل', 'gp_million_diff_easy'), btn('🟡 متوسط', 'gp_million_diff_medium'), btn('🔴 صعب', 'gp_million_diff_hard')]
        ])
      }).catch(() => {});
    }
  }
\n  if (state.type === 'admin_del_question') {
    const qid = parseInt(text);\n    if (isNaN(qid)) return ctx.reply('❌ أرسل رقم صحيح').catch(() => {});\n    const q = await get('SELECT * FROM million_questions WHERE id=$1', [qid]);\n    if (!q) return ctx.reply('❌ السؤال غير موجود').catch(() => {});\n    await run('UPDATE million_questions SET is_active=0 WHERE id=$1', [qid]);
    await delState(uid);\n    await ctx.reply('✅ تم حذف السؤال #' + qid).catch(() => {});
    return showMillionPanel(ctx);
  }
}

// إنهاء إضافة السؤال بعد اختيار الصعوبة
async function finishAddQuestion(ctx, difficulty) {\n  const { delState, getState } = require('../utils/stateManager');
  const uid = ctx.uid;
  const state = await getState(uid);
  if (!state?.draft) return;
  const d = state.draft;
  d.difficulty = difficulty;
  await run(\n    'INSERT INTO million_questions(text, option_a, option_b, option_c, option_d, correct, difficulty, added_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [d.text, d.option_a, d.option_b, d.option_c, d.option_d, d.correct, d.difficulty, uid]\n  ).catch(e => console.error('[AddQ]', e.message));
  await delState(uid);
\n  const diff = d.difficulty === 'easy' ? '🟢 سهل' : d.difficulty === 'hard' ? '🔴 صعب' : '🟡 متوسط';
  await ctx.reply(\n    '✅ *تم إضافة السؤال!*

' +\n    '❓ ' + d.text + '\n' +
    'أ) ' + d.option_a + '\n' +
    'ب) ' + d.option_b + '\n' +
    'ج) ' + d.option_c + '\n' +
    'د) ' + d.option_d + '
\n' +
    '✅ الإجابة: *' + { a: 'أ', b: 'ب', c: 'ج', d: 'د' }[d.correct] + '*\n' +
    '📊 الصعوبة: ' + diff,\n    { parse_mode: 'Markdown' }
  ).catch(() => {});
  return showMillionPanel(ctx);
}



// ══════════════════════════════════════════
// إدارة الأسئلة
// ══════════════════════════════════════════
async function showQuestionList(ctx, page) {
  page = parseInt(page) || 0;
  const PER = 5;\n  const total = await get('SELECT COUNT(*) AS cnt FROM million_questions WHERE is_active=1').catch(() => ({ cnt: 0 }));
  const questions = await all(\n    'SELECT * FROM million_questions WHERE is_active=1 ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [PER, page * PER]
  ).catch(() => []);

  if (!questions.length) {\n    return eos(ctx, '📋 *لا توجد أسئلة بعد*

اضغط ➕ لإضافة أسئلة.', {\n      parse_mode: 'Markdown', ...kbBuild([[kbBtn('◀️ رجوع', 'gp_million_panel')]]) });
  }
\n  let text = '📋 *قائمة الأسئلة* (' + total.cnt + ' سؤال)
━━━━━━━━━━━━━━━━━━
\n';
  questions.forEach((q, i) => {
    const diff = q.difficulty === 'easy' ? '🟢' : q.difficulty === 'hard' ? '🔴' : '🟡';\n    text += (page * PER + i + 1) + '. ' + diff + ' ' + q.text.substring(0, 40) + '...\n';
  });

  const rows = [];
  questions.forEach(q => rows.push([kbBtn('🗑 #' + q.id + ' ' + q.text.substring(0, 20), 'gp_million_delid_' + q.id)]));

  const nav = [];\n  if (page > 0) nav.push(kbBtn('⬅️', 'gp_million_list_' + (page - 1)));\n  if ((page + 1) * PER < total.cnt) nav.push(kbBtn('➡️', 'gp_million_list_' + (page + 1)));
  if (nav.length) rows.push(nav);\n  rows.push([kbBtn('➕ إضافة', 'gp_million_add'), kbBtn('◀️ رجوع', 'gp_million_panel')]);
\n  return eos(ctx, text, { parse_mode: 'Markdown', ...kbBuild(rows) });
}

async function handleGamesCallback(ctx, data) {\n  ctx.answerCbQuery('').catch(() => {});\n  const { setState } = require('../utils/stateManager');
  const uid = ctx.uid;
\n  if (data === 'mb_panel')          return showGamesPanel(ctx);\n  if (data === 'gp_million_panel')  return showMillionPanel(ctx);\n  if (data === 'gp_guess_panel')    return showGuessPanel(ctx);
\n  if (data === 'gp_million_add') {\n    await setState(uid, { type: 'admin_add_question', step: 'text' });
    return ctx.reply(\n      '➕ *إضافة سؤال جديد*
━━━━━━━━━━━━━━━━━━

' +\n      '1️⃣ أرسل نص السؤال:
_(أو /cancel للإلغاء)_',\n      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }
\n  if (data.startsWith('gp_million_list_')) {\n    return showQuestionList(ctx, data.replace('gp_million_list_', ''));
  }
\n  if (data === 'gp_million_del') {\n    await setState(uid, { type: 'admin_del_question' });\n    return ctx.reply('🗑 أرسل رقم ID السؤال لحذفه:
_(أو /cancel)_', { parse_mode: 'Markdown' }).catch(() => {});
  }
\n  if (data.startsWith('gp_million_delid_')) {\n    const qid = data.replace('gp_million_delid_', '');\n    await run('UPDATE million_questions SET is_active=0 WHERE id=$1', [qid]).catch(() => {});\n    ctx.answerCbQuery('✅ تم الحذف').catch(() => {});
    return showQuestionList(ctx, 0);
  }
\n  if (data.startsWith('gp_million_diff_')) {\n    const parts = data.replace('gp_million_diff_', '').split('_');
    const diff = parts[0];
    const uid2 = parts[1];\n    const st = await require('../utils/stateManager').getState(uid2 || uid);
    if (st?.draft) {
      st.draft.difficulty = diff;\n      await require('../utils/stateManager').setState(uid2 || uid, st);
    }\n    return ctx.reply('✅ الصعوبة: ' + diff + '\nأرسل الخيار أ:').catch(() => {});
  }
}

async function handleAdminQuestionText(ctx, state) {
  const { setState, delState } = require('../utils/stateManager');
  const uid = ctx.uid;
  const text = ctx.message.text;
\n  if (state.type === 'admin_add_question') {
    const draft = state.draft || {};
\n    if (state.step === 'text') {
      draft.text = text;\n      await setState(uid, { type: 'admin_add_question', step: 'opt_a', draft });\n      return ctx.reply('2️⃣ أرسل الخيار *أ*:', { parse_mode: 'Markdown' }).catch(() => {});
    }\n    if (state.step === 'opt_a') {
      draft.option_a = text;\n      await setState(uid, { type: 'admin_add_question', step: 'opt_b', draft });\n      return ctx.reply('3️⃣ أرسل الخيار *ب*:', { parse_mode: 'Markdown' }).catch(() => {});
    }\n    if (state.step === 'opt_b') {
      draft.option_b = text;\n      await setState(uid, { type: 'admin_add_question', step: 'opt_c', draft });\n      return ctx.reply('4️⃣ أرسل الخيار *ج*:', { parse_mode: 'Markdown' }).catch(() => {});
    }\n    if (state.step === 'opt_c') {
      draft.option_c = text;\n      await setState(uid, { type: 'admin_add_question', step: 'opt_d', draft });\n      return ctx.reply('5️⃣ أرسل الخيار *د*:', { parse_mode: 'Markdown' }).catch(() => {});
    }\n    if (state.step === 'opt_d') {
      draft.option_d = text;\n      await setState(uid, { type: 'admin_add_question', step: 'correct', draft });
      return ctx.reply(\n        '6️⃣ ما هي الإجابة الصحيحة؟
أرسل: *أ* أو *ب* أو *ج* أو *د*',\n        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }\n    if (state.step === 'correct') {\n      const map = { 'أ': 'a', 'ب': 'b', 'ج': 'c', 'د': 'd', 'a': 'a', 'b': 'b', 'c': 'c', 'd': 'd' };
      const correct = map[text.trim()];\n      if (!correct) return ctx.reply('❌ أرسل: أ أو ب أو ج أو د').catch(() => {});
      draft.correct = correct;
\n      const { build, btn } = require('../utils/keyboard');\n      await setState(uid, { type: 'admin_add_question', step: 'diff', draft });\n      return ctx.reply('7️⃣ اختر الصعوبة:', {
        ...build([\n          [btn('🟢 سهل', 'gp_million_diff_easy'), btn('🟡 متوسط', 'gp_million_diff_medium'), btn('🔴 صعب', 'gp_million_diff_hard')]
        ])
      }).catch(() => {});
    }
  }
\n  if (state.type === 'admin_del_question') {
    const qid = parseInt(text);\n    if (isNaN(qid)) return ctx.reply('❌ أرسل رقم صحيح').catch(() => {});\n    const q = await get('SELECT * FROM million_questions WHERE id=$1', [qid]);\n    if (!q) return ctx.reply('❌ السؤال غير موجود').catch(() => {});\n    await run('UPDATE million_questions SET is_active=0 WHERE id=$1', [qid]);
    await delState(uid);\n    await ctx.reply('✅ تم حذف السؤال #' + qid).catch(() => {});
    return showMillionPanel(ctx);
  }
}

// إنهاء إضافة السؤال بعد اختيار الصعوبة
async function finishAddQuestion(ctx, difficulty) {\n  const { delState, getState } = require('../utils/stateManager');
  const uid = ctx.uid;
  const state = await getState(uid);
  if (!state?.draft) return;
  const d = state.draft;
  d.difficulty = difficulty;
  await run(\n    'INSERT INTO million_questions(text, option_a, option_b, option_c, option_d, correct, difficulty, added_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [d.text, d.option_a, d.option_b, d.option_c, d.option_d, d.correct, d.difficulty, uid]\n  ).catch(e => console.error('[AddQ]', e.message));
  await delState(uid);
\n  const diff = d.difficulty === 'easy' ? '🟢 سهل' : d.difficulty === 'hard' ? '🔴 صعب' : '🟡 متوسط';
  await ctx.reply(\n    '✅ *تم إضافة السؤال!*

' +\n    '❓ ' + d.text + '\n' +
    'أ) ' + d.option_a + '\n' +
    'ب) ' + d.option_b + '\n' +
    'ج) ' + d.option_c + '\n' +
    'د) ' + d.option_d + '
\n' +
    '✅ الإجابة: *' + { a: 'أ', b: 'ب', c: 'ج', d: 'د' }[d.correct] + '*\n' +
    '📊 الصعوبة: ' + diff,\n    { parse_mode: 'Markdown' }
  ).catch(() => {});
  return showMillionPanel(ctx);
}

module.exports = { showGamesPanel, showMillionPanel, showGuessPanel, showQuestionList, handleGamesCallback, handleAdminQuestionText, finishAddQuestion };
