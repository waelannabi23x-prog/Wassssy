'use strict';
// ══════════════════════════════════════════════════════════════
//  🐺 Loup-Garou — سجلّ الأدوار + خوارزمية التوزيع الديناميكي
// ══════════════════════════════════════════════════════════════

// team           : الفصيل الحقيقي (يُستخدم في حساب شرط الفوز)
// revealTeam     : ما يظهر للعراف/المحقق (مهم للخائن: يبدو قروياً)
// isWolfPack     : يُستخدم بواسطة الثعلب (هل هذا اللاعب من "عصابة الذئاب"؟)
// night          : نوع الإجراء الليلي (null = لا يوجد إجراء)
// order          : ترتيب التنفيذ في الليل (أصغر = أولاً)
const ROLES = {
  wolf: {
    id: 'wolf', name: 'الذئب', emoji: '🐺', team: 'wolves', revealTeam: 'wolves',
    isWolfPack: true, night: 'wolves_vote', order: 30,
    short: 'تقضي مع رفاقك الذئاب على القرويين ليلاً، بدون أن يكتشفكم أحد.',
    dm: '🐺 *أنت ذئب!*\n\nهدفك: القضاء على القرية مع باقي الذئاب.\nكل ليلة تختار مع رفاقك ضحية لتقتلوها.\n\n🤫 حافظ على سرّيتك نهاراً!',
  },
  villager: {
    id: 'villager', name: 'القروي', emoji: '👨‍🌾', team: 'village', revealTeam: 'village',
    isWolfPack: false, night: null, order: 0,
    short: 'لا قدرات خاصة، لكن صوتك في التصويت قد يغيّر مصير القرية.',
    dm: '👨‍🌾 *أنت قروي!*\n\nهدفك: مساعدة القرية على كشف الذئاب والقضاء عليها بالتصويت.\nلا تملك قدرة ليلية — راقب، استنتج، وصوّت بحكمة!',
  },
  seer: {
    id: 'seer', name: 'العراف', emoji: '🔮', team: 'village', revealTeam: 'village',
    isWolfPack: false, night: 'seer', order: 10,
    short: 'يفحص هوية لاعب كل ليلة ويعرف إن كان ذئباً أم بريئاً.',
    dm: '🔮 *أنت العراف!*\n\nكل ليلة يمكنك كشف حقيقة لاعب واحد: هل هو 🐺 ذئب أم 👤 بريء؟\nاستخدم معلوماتك بحكمة دون أن تكشف نفسك!',
  },
  witch: {
    id: 'witch', name: 'الساحرة', emoji: '🧪', team: 'village', revealTeam: 'village',
    isWolfPack: false, night: 'witch', order: 40,
    short: 'تملك جرعة إنقاذ واحدة وجرعة سمّ واحدة لكامل اللعبة.',
    dm: '🧪 *أنت الساحرة!*\n\nتملكين جرعتين لمرة واحدة طوال اللعبة:\n💚 *جرعة إنقاذ* — تُنجي ضحية الذئاب الليلة.\n☠️ *جرعة سمّ* — تقتل أي لاعب تختارينه.\n\nكل ليلة سترين من اختارته الذئاب وتقررين.',
  },
  guardian: {
    id: 'guardian', name: 'الحارس', emoji: '🛡️', team: 'village', revealTeam: 'village',
    isWolfPack: false, night: 'guardian', order: 5,
    short: 'يحمي لاعباً كل ليلة من القتل، ولا يمكنه حماية نفس الشخص مرتين متتاليتين.',
    dm: '🛡️ *أنت الحارس!*\n\nكل ليلة تحمي لاعباً واحداً من القتل (لا يشمل سمّ الساحرة).\n⚠️ لا يمكنك حماية نفس الشخص ليلتين متتاليتين.',
  },
  hunter: {
    id: 'hunter', name: 'الصياد', emoji: '🔫', team: 'village', revealTeam: 'village',
    isWolfPack: false, night: null, order: 0,
    short: 'إذا مات (ليلاً أو نهاراً)، يطلق رصاصته الأخيرة على شخص آخر فيموت معه.',
    dm: '🔫 *أنت الصياد!*\n\nلا قدرة ليلية مباشرة، لكن إن متّ (بأي سبب) — ستطلق رصاصتك الأخيرة فوراً على لاعب من اختيارك، فيموت معك!',
  },
  detective: {
    id: 'detective', name: 'المحقق', emoji: '🕵️', team: 'village', revealTeam: 'village',
    isWolfPack: false, night: 'detective', order: 15,
    short: 'يقارن كل ليلة بين لاعبين ليعرف إن كانا من نفس الفصيل أم لا.',
    dm: '🕵️ *أنت المحقق!*\n\nكل ليلة اختر *لاعبين*، وستعرف إن كانا من *نفس الفصيل* أم *فصيلين مختلفين* (دون معرفة الفصيل نفسه).',
  },
  fox: {
    id: 'fox', name: 'الثعلب', emoji: '🦊', team: 'village', revealTeam: 'village',
    isWolfPack: false, night: 'fox', order: 20,
    short: 'يفحص مجموعة من 3 لاعبين: هل بينهم ذئب؟ إن أخطأ مرة يفقد قدرته للأبد.',
    dm: '🦊 *أنت الثعلب!*\n\nكل ليلة اختر *3 لاعبين*، وستعرف إن كان بينهم *ذئب واحد على الأقل* أم *لا أحد*.\n⚠️ إذا كانت الإجابة "لا أحد"، تفقد قدرتك للأبد!',
  },
  mayor: {
    id: 'mayor', name: 'العمدة', emoji: '👑', team: 'village', revealTeam: 'village',
    isWolfPack: false, night: null, order: 0,
    short: 'صوته في التصويت النهاري يُحسب كصوتين.',
    dm: '👑 *تم انتخابك عمدة القرية!*\n\nلا قدرة ليلية، لكن *صوتك في تصويت الإعدام يُحسب كصوتين* طوال اللعبة.\nحافظ على حياتك — إن متّ يُفقد هذا الامتياز.',
  },
  traitor: {
    id: 'traitor', name: 'الخائن', emoji: '🦹', team: 'wolves', revealTeam: 'village',
    isWolfPack: true, night: null, order: 0,
    short: 'يبدو قروياً بريئاً أمام العراف والمحقق، لكنه يفوز مع الذئاب سرّاً.',
    dm: '🦹 *أنت الخائن!*\n\nتبدو *قروياً عادياً* أمام العراف والمحقق، لكنك تفوز مع *الذئاب* إن فازوا.\nلا تملك قدرة ليلية، لكن لو ماتت جميع الذئاب وبقيتَ حياً، تصبح أنت قائد الذئاب الجديد وتكتسب قدرتهم على القتل ليلاً.',
  },
  jester: {
    id: 'jester', name: 'المهرج', emoji: '🤡', team: 'village', revealTeam: 'village',
    isWolfPack: false, night: null, order: 0,
    short: 'لا ينتمي لأي فصيل؛ يفوز شخصياً إن أعدمته القرية بالتصويت!',
    dm: '🤡 *أنت المهرج!*\n\nهدفك الوحيد: أن تجعل القرية *تُعدمك* بالتصويت! إن حدث ذلك تفوز فوزاً شخصياً فوراً مهما كانت نتيجة اللعبة.\nلا تموت ليلاً عادةً — لكن إياك أن تكون هادئاً جداً فلا يشك فيك أحد 😉',
  },
  serial_killer: {
    id: 'serial_killer', name: 'القاتل المتسلسل', emoji: '☠️', team: 'solo_sk', revealTeam: 'solo_sk',
    isWolfPack: false, night: 'sk', order: 35,
    short: 'فصيل منفرد: يقتل شخصاً كل ليلة، ويفوز إن بقي آخر الناجين.',
    dm: '☠️ *أنت القاتل المتسلسل!*\n\nأنت وحدك في فصيلك. كل ليلة تختار ضحية تقتلها بنفسك (مستقل عن الذئاب).\n🏆 *شرط فوزك:* أن تكون آخر شخص على قيد الحياة.',
  },
  vampire: {
    id: 'vampire', name: 'مصاص الدماء', emoji: '🧛', team: 'solo_vampire', revealTeam: 'solo_vampire',
    isWolfPack: false, night: 'vampire', order: 36,
    short: 'فصيل منفرد آخر: ينهش ضحية كل ليلة، ويفوز إن بقي آخر الناجين.',
    dm: '🧛 *أنت مصاص دماء!*\n\nأنت وحدك في فصيلك. كل ليلة تختار ضحية تنهشها (مستقلة عن الذئاب).\n🏆 *شرط فوزك:* أن تكون آخر شخص على قيد الحياة.',
  },
};

// ترتيب تنفيذ الإجراءات الليلية
const NIGHT_ORDER = ['guardian', 'seer', 'detective', 'fox', 'wolves_vote', 'sk', 'vampire', 'witch'];

// ── توزيع الأدوار حسب عدد اللاعبين (ديناميكي) ──
// كل عتبة تُضيف دوراً جديداً للمجموعة، والباقي قرويون.
function getComposition(n) {
  const wolves = Math.max(1, Math.floor(n / 5));
  const specials = [];
  if (n >= 6)  specials.push('seer', 'witch', 'guardian');
  if (n >= 7)  specials.push('hunter');
  if (n >= 8)  specials.push('detective');
  if (n >= 9)  specials.push('mayor');
  if (n >= 10) specials.push('fox');
  if (n >= 11) specials.push('jester');
  if (n >= 12) specials.push('traitor');
  if (n >= 13) specials.push('serial_killer');
  if (n >= 14) specials.push('vampire');

  const villagers = Math.max(0, n - wolves - specials.length);
  return { wolves, specials, villagers, lovers: n >= 8 };
}

// ── خلط عشوائي (Fisher-Yates) ──
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// players: [{id, name}]
// returns: { roleByUser: Map(userId -> roleId), loversPair: [id,id]|null, mayorId: id|null, composition }
function assignRoles(players) {
  const n = players.length;
  const comp = getComposition(n);

  const roleList = [];
  for (let i = 0; i < comp.wolves; i++) roleList.push('wolf');
  roleList.push(...comp.specials);
  for (let i = 0; i < comp.villagers; i++) roleList.push('villager');

  const shuffledPlayers = shuffle(players);
  const roleByUser = new Map();
  shuffledPlayers.forEach((p, i) => roleByUser.set(p.id, roleList[i] || 'villager'));

  // العاشقان — أي لاعبين عشوائيين بغض النظر عن فصيلهما
  let loversPair = null;
  if (comp.lovers && n >= 2) {
    const pick = shuffle(players).slice(0, 2);
    loversPair = [pick[0].id, pick[1].id];
  }

  // العمدة — حامل دور mayor (إن وُجد ضمن التركيبة)
  let mayorId = null;
  if (roleList.includes('mayor')) {
    const holder = players.find(p => roleByUser.get(p.id) === 'mayor');
    mayorId = holder ? holder.id : null;
  }

  return { roleByUser, loversPair, mayorId, composition: comp };
}

module.exports = { ROLES, NIGHT_ORDER, getComposition, assignRoles, shuffle };
