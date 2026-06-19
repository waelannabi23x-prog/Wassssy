'use strict';
// ══════════════════════════════════════════════════════════════
//  🎮 أكسيو أو فيريتي (صحصح) — إعدادات مركزية
// ══════════════════════════════════════════════════════════════

module.exports = {
  MIN_PLAYERS: 3,
  MAX_PLAYERS: 30,

  // مؤقتات افتراضية (مللي ثانية) — قابلة للتعديل لكل قروب عبر لوحة التحكم
  DEFAULT_TIMERS: {
    REGISTRATION: 300000, // 5 دقائق — إغلاق تلقائي للتسجيل إن لم يبدأ المالك (0 = بلا حد)
    ASKER_PROMPT: 20000,  // وقت السائل ليكتب "أكسيو ولا فيريتي؟"
    CHOICE:       20000,  // وقت المجيب لاختيار أكسيو/فيريتي
    SUBMIT:       60000,  // وقت السائل لكتابة السؤال أو التحدي
    ANSWER:       30000,  // وقت المجيب للإجابة
    BANTER:       10000,  // فتح الدردشة بعد الإجابة
  },

  CALLBACK_PREFIX: 'tod',     // ── أزرار الجولة (مع حماية إعادة التشغيل)
  ADMIN_PREFIX:    'todadm',  // ── أزرار لوحة التحكم بالخاص

  // الإحصائيات الدائمة
  ACHIEVEMENTS: [
    { key: 'first_game',   name: 'أول لعبة',        emoji: '🎮', check: s => s.games_played >= 1 },
    { key: 'brave_10',     name: '10 تحديات منجزة',  emoji: '🔥', check: s => s.dare_completed >= 10 },
    { key: 'honest_10',    name: '10 إجابات صادقة',  emoji: '💬', check: s => s.truth_completed >= 10 },
    { key: 'popular_asker',name: 'سائل نشيط (20 مرة)', emoji: '🎯', check: s => s.asked_count >= 20 },
    { key: 'no_timeout_10',name: 'لا تهرب! (0 تهرّب في 10 إجابات)', emoji: '🏅', check: s => s.answered_count >= 10 && s.timeouts === 0 },
  ],
};
