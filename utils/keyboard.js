'use strict';
const { Markup } = require('telegraf');

// ── زر عادي ──
const btn = (text, data) => Markup.button.callback(text, data);

// ── زر ملون ──────────────────────────────────────
// color: 1=أحمر  2=برتقالي  3=بنفسجي  4=أخضر  5=رمادي
const btnC = (text, data, color) => ({
  text,
  callback_data: data,
  color: color || undefined,
});

// ── اختصارات الألوان ──
const btnRed    = (text, data) => btnC(text, data, 1); // 🔴
const btnOrange = (text, data) => btnC(text, data, 2); // 🟠
const btnPurple = (text, data) => btnC(text, data, 3); // 🟣
const btnGreen  = (text, data) => btnC(text, data, 4); // 🟢
const btnGray   = (text, data) => btnC(text, data, 5); // ⚫

// ── أزرار تنقل ──
const back     = data => [btn('◀️ رجوع', data)];
const backMenu = data => [btn('◀️ رجوع', data), btn('🏠 الرئيسية', 'main_menu')];

// ── بناء الكيبورد (يقبل أزرار عادية وملونة معاً) ──
const build = rows => ({
  reply_markup: { inline_keyboard: rows }
});

module.exports = {
  btn, btnC,
  btnRed, btnOrange, btnPurple, btnGreen, btnGray,
  back, backMenu, build,
};
