'use strict';

// ═══════════════════════════════════════════════════════
// 🎯 Group Smart Triggers — ردود تلقائية ذكية في القروب
// ═══════════════════════════════════════════════════════

// ── 1: كلمة مفتاحية "lws" لتفعيل AI ──
const LWS_TRIGGERS = [
  /\blws\b/i,
  /\bلوس\b/,
  /\bلـوس\b/,
];

// ── 2: ردود اجتماعية ثابتة (بدون AI — فورية) ──
const SOCIAL_PATTERNS = [
  // تحيات
  {
    test: t => /سلام\s*عليكم|السلام\s*عليكم/i.test(t),
    replies: [
      'وعليكم السلام ورحمة الله 🌟 كيراك خويا؟',
      'وعليكم السلام 😊 أهلاً بيك! شنو تحتاج؟',
      'وعليكم السلام ورحمة الله وبركاتو 🤍',
      'وعليكم السلام احكي وش عندك ولا متكسرليش راسي ربي عيشك مهم ! مرحبا بيك 👋',
    ]
  },
  // أحبك / نحبك
  {
    test: t => /نحبك|نحبّك|ن\s*ح\s*ب\s*ك|je t'aime|i love you/i.test(t),
    replies: [
      'أنا أيضاً نحبك 🤍 ونموت عليك لعزيزة والله ',
      'ومن بعدك نحب مين؟! 💙 أنا نحبك زاد وأكثر ا!',
      'والله نحبك وكان فيا نعطيك قلبي نحيها من لويس و نمدهالك  🥹 يسلم ليك صحتك ا!',
      'آه والله نحبك زاد يا طبيبة ! 😄🤍 ومن بعدك ما كاين',
      'نحبك ونموت عليك يا روحي! 💙 أنتي أحسن وحدة في القروب',
    ]
  },
  // شكراً
  {
    test: t => /شكرا|شكراً|merci|thank|يعطيك الصحة|بارك الله/i.test(t),
    replies: [
      'بلامزية لعزيز متكثرش برك  🙏 دايماً في خدمتك',
      'الشكر لله! يسلم ليك 😊 أي وقت محتاج كلمني',
      'Avec plaisir! 🌟 دايماً هنا',
      'مشكور خويا! ربي يبارك فيك 🤍',
    ]
  },
  // كيف الحال / كيراك / labas
  {
    test: t => /كيراك|كيف\s*حالك|كيفاش|labas|لاباس|vas bien|ça va/i.test(t),
    replies: [
      'لاباس الحمد لله! وأنت كيراك خويا؟ 😊',
      'بخير الحمد لله! كيف أنت وكيف الدراسة؟ 📚',
      'Ça va bien merci! وأنت كيف حالك؟ 😄',
      'لاباس الحمد لله لحب  ☀️ وأنتي إن شاء الله بخير!',
    ]
  },
  // وداع / مع السلامة / bslama
  {
    test: t => /مع\s*السلامة|وداعاً|bslama|بسلامة|نروح|تصبح على خير|bonne nuit|au revoir/i.test(t),
    replies: [
      'بسلامة ! ربي يحفظك 🤍',
      'مع السلامة! إن شاء الله نتلاقاو 😊',
      'Bonne journée! ربي يوفقك في دراستك 📚',
      'بسلامة وربي معك! 🌟',
    ]
  },
  // تعبان / مريض / دراسة صعبة
  {
    test: t => /تعبان|تعبت|صعيب|صعب|ما فهمتش|ما فهمت|نبكي|نعيا|مريض/i.test(t),
    replies: [
      'أيه والله الدراسة صعيبة 😅 لكن أنت قادر! قولي شنو ما فهمت ونساعدك 📚',
      'ربي يعافيك خويا! شنو صعيبك؟ نساعدك إن شاء الله 💪',
      'ما تيأسش! كل واحد مر بهاد الحال 😊 قولي أين المشكلة',
      'صبر شوي خو ! الدراسة صعيبة لكن النتيجة حلوة 🌟 شنو تحتاج؟',
    ]
  },
  // ضحك / nhar
  {
    test: t => /هههه|ههه|lol|😂|🤣|واعر|زاد واعر|خطرة/i.test(t),
    replies: [
      'هههه 😂 واعر والله!',
      'هههه خطرة 😄',
      '😂😂 والله عجبتني!',
      'هههه زاد واعر 😂 شنو دار؟',
    ]
  },
];

// ── 3: فحص الذكر (mention) بالاسم ──
function isMentioned(text, botUsername) {
  if (!text) return false;
  const t = text.toLowerCase();
  // @username check — strip leading @ if passed with it
  if (botUsername) {
    const un = botUsername.replace(/^@/, '').toLowerCase();
    if (t.includes('@' + un)) return true;
  }
  // fallback: any @mention pattern (for when username unknown)
  if (/@\w+/.test(text) && LWS_TRIGGERS.some(r => r.test(text.replace(/@\w+/g,'')))) return true;
  return LWS_TRIGGERS.some(r => r.test(text));
}

// ── 4: فحص الرد المباشر على رسالة البوت ──
function isReplyToBot(ctx, botId) {
  const replyTo = ctx.message?.reply_to_message;
  if (!replyTo) return false;
  return replyTo.from?.is_bot && (botId ? replyTo.from.id === botId : true);
}

// ── 5: فحص الردود الاجتماعية ──
function getSocialReply(text) {
  for (const p of SOCIAL_PATTERNS) {
    if (p.test(text)) {
      const arr = p.replies;
      return arr[Math.floor(Math.random() * arr.length)];
    }
  }
  return null;
}

module.exports = { isMentioned, isReplyToBot, getSocialReply, LWS_TRIGGERS };
