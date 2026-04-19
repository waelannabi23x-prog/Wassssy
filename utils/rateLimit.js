'use strict';
const LIMIT = 6;        // الحد الأقصى 6 ضغطات في الثانية
const BLOCK_TIME = 3000; // اذا تعدى، يتصفر لمدة 3 ثواني
const users = new Map();

module.exports = function rateLimit(ctx, next) {
  const uid = ctx.from?.id;
  if (!uid) return next();

  const now = Date.now();
  let u = users.get(uid);

  // اعادة تعيين العداد كل ثانية
  if (!u || now - u.lastReset > 1000) {
    u = { count: 1, lastReset: now, blocked: false, unblockAt: 0 };
    users.set(uid, u);
  } else {
    u.count++;
  }

  // اذا كان محظوراً، نتجاهل الرسالة بصمت
  if (u.blocked) {
    if (now < u.unblockAt) return;
    u.blocked = false; 
  }

  // اذا وصل للحد، نحظره ونرسل تحذير واحد بس
  if (u.count > LIMIT) {
    u.blocked = true;
    u.unblockAt = now + BLOCK_TIME;
    if (u.count === LIMIT + 1) {
      return ctx.reply('⚠️ إبطاء قليلاً... أنت تضغط بسرعة كبيرة.').catch(() => {});
    }
    return;
  }

  return next();
};
