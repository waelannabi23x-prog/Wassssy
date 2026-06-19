'use strict';
// ══════════════════════════════════════════════════════════════
//  🎮 أكسيو أو فيريتي — لوحات الأزرار
// ══════════════════════════════════════════════════════════════

const { cb, cbAdmin } = require('./codec');

function choiceKeyboard(session) {
  return {
    inline_keyboard: [[
      { text: '🔥 أكسيو (تحدي)',   callback_data: cb('ch', session, 'dare') },
      { text: '💬 فيريتي (سؤال)', callback_data: cb('ch', session, 'truth') },
    ]],
  };
}

function ownerEndKeyboard(session) {
  return { inline_keyboard: [[{ text: '🛑 إنهاء اللعبة', callback_data: cb('end', session) }]] };
}

// ── لوحة تحكم الإدارة (بالخاص) ──────────────────────────────
function adminPanelKeyboard(chatId, s) {
  const onoff = v => v ? '✅' : '❌';
  return {
    inline_keyboard: [
      [{ text: `⏱️ مدة التسجيل: ${Math.round(s.reg_timeout/1000)}ث`, callback_data: 'noop' }],
      [
        { text: '➖', callback_data: cbAdmin('dec', chatId, 'reg_timeout') },
        { text: '➕', callback_data: cbAdmin('inc', chatId, 'reg_timeout') },
      ],
      [{ text: `⏱️ مهلة الاختيار: ${Math.round(s.choice_timeout/1000)}ث`, callback_data: 'noop' }],
      [
        { text: '➖', callback_data: cbAdmin('dec', chatId, 'choice_timeout') },
        { text: '➕', callback_data: cbAdmin('inc', chatId, 'choice_timeout') },
      ],
      [{ text: `⏱️ مهلة طرح السؤال: ${Math.round(s.submit_timeout/1000)}ث`, callback_data: 'noop' }],
      [
        { text: '➖', callback_data: cbAdmin('dec', chatId, 'submit_timeout') },
        { text: '➕', callback_data: cbAdmin('inc', chatId, 'submit_timeout') },
      ],
      [{ text: `⏱️ مهلة الإجابة: ${Math.round(s.answer_timeout/1000)}ث`, callback_data: 'noop' }],
      [
        { text: '➖', callback_data: cbAdmin('dec', chatId, 'answer_timeout') },
        { text: '➕', callback_data: cbAdmin('inc', chatId, 'answer_timeout') },
      ],
      [{ text: `⏱️ مدة الدردشة: ${Math.round(s.banter_timeout/1000)}ث`, callback_data: 'noop' }],
      [
        { text: '➖', callback_data: cbAdmin('dec', chatId, 'banter_timeout') },
        { text: '➕', callback_data: cbAdmin('inc', chatId, 'banter_timeout') },
      ],
      [{ text: `👥 الحد الأدنى للاعبين: ${s.min_players}`, callback_data: 'noop' }],
      [
        { text: '➖', callback_data: cbAdmin('dec', chatId, 'min_players') },
        { text: '➕', callback_data: cbAdmin('inc', chatId, 'min_players') },
      ],
      [{ text: `${onoff(s.delete_offtopic)} حذف الرسائل الجانبية`, callback_data: cbAdmin('toggle', chatId, 'delete_offtopic') }],
      [{ text: `${onoff(s.fairness_enabled)} نظام العدالة`, callback_data: cbAdmin('toggle', chatId, 'fairness_enabled') }],
      [{ text: '📊 إحصائيات القروب', callback_data: cbAdmin('stats', chatId) }],
      [{ text: '🛑 إنهاء اللعبة الحالية', callback_data: cbAdmin('forceend', chatId) }],
      [{ text: '🔄 تحديث', callback_data: cbAdmin('refresh', chatId) }],
    ],
  };
}

module.exports = { choiceKeyboard, ownerEndKeyboard, adminPanelKeyboard };
