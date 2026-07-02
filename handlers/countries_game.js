'use strict';
/**
 * ════════════════════════════════════════════
 *  🌍 handlers/countries_game.js
 *  لعبة خمّن الدولة من العلم
 * ════════════════════════════════════════════
 */

const { get, run } = require('../database/db');

// ─── قائمة الدول ────────────────────────────
const COUNTRIES = [
  { name: 'الجزائر',      aliases: ['الجزائر','جزائر','algerie','algeria'],           flag: '🇩🇿', reward: 150 },
  { name: 'المغرب',       aliases: ['المغرب','مغرب','maroc','morocco'],                flag: '🇲🇦', reward: 150 },
  { name: 'تونس',         aliases: ['تونس','tunisie','tunisia'],                        flag: '🇹🇳', reward: 150 },
  { name: 'مصر',          aliases: ['مصر','egypt'],                                     flag: '🇪🇬', reward: 150 },
  { name: 'ليبيا',        aliases: ['ليبيا','libya'],                                   flag: '🇱🇾', reward: 160 },
  { name: 'السودان',      aliases: ['السودان','سودان','sudan'],                         flag: '🇸🇩', reward: 160 },
  { name: 'سوريا',        aliases: ['سوريا','syria'],                                   flag: '🇸🇾', reward: 160 },
  { name: 'العراق',       aliases: ['العراق','عراق','iraq'],                            flag: '🇮🇶', reward: 160 },
  { name: 'اليمن',        aliases: ['اليمن','يمن','yemen'],                             flag: '🇾🇪', reward: 160 },
  { name: 'السعودية',     aliases: ['السعودية','سعودية','saudi','ksa'],                flag: '🇸🇦', reward: 200 },
  { name: 'الإمارات',     aliases: ['الإمارات','امارات','الامارات','uae'],             flag: '🇦🇪', reward: 200 },
  { name: 'الكويت',       aliases: ['الكويت','كويت','kuwait'],                          flag: '🇰🇼', reward: 200 },
  { name: 'قطر',          aliases: ['قطر','qatar'],                                      flag: '🇶🇦', reward: 200 },
  { name: 'البحرين',      aliases: ['البحرين','بحرين','bahrain'],                       flag: '🇧🇭', reward: 200 },
  { name: 'عُمان',        aliases: ['عمان','oman'],                                     flag: '🇴🇲', reward: 200 },
  { name: 'الأردن',       aliases: ['الاردن','أردن','jordan'],                          flag: '🇯🇴', reward: 180 },
  { name: 'لبنان',        aliases: ['لبنان','lebanon'],                                 flag: '🇱🇧', reward: 180 },
  { name: 'فلسطين',       aliases: ['فلسطين','palestine'],                              flag: '🇵🇸', reward: 180 },
  { name: 'فرنسا',        aliases: ['فرنسا','france'],                                  flag: '🇫🇷', reward: 180 },
  { name: 'إسبانيا',      aliases: ['اسبانيا','إسبانيا','spain','espagne'],             flag: '🇪🇸', reward: 180 },
  { name: 'ألمانيا',      aliases: ['المانيا','ألمانيا','germany','allemagne'],          flag: '🇩🇪', reward: 180 },
  { name: 'إيطاليا',      aliases: ['ايطاليا','إيطاليا','italy','italie'],              flag: '🇮🇹', reward: 180 },
  { name: 'البرتغال',     aliases: ['البرتغال','برتغال','portugal'],                    flag: '🇵🇹', reward: 200 },
  { name: 'هولندا',       aliases: ['هولندا','netherlands','pays-bas'],                  flag: '🇳🇱', reward: 200 },
  { name: 'بلجيكا',       aliases: ['بلجيكا','belgique','belgium'],                     flag: '🇧🇪', reward: 200 },
  { name: 'السويد',       aliases: ['السويد','sweden','suede'],                          flag: '🇸🇪', reward: 220 },
  { name: 'النرويج',      aliases: ['النرويج','norway','norvege'],                       flag: '🇳🇴', reward: 220 },
  { name: 'الدنمارك',     aliases: ['الدنمارك','دنمارك','denmark','danemark'],           flag: '🇩🇰', reward: 220 },
  { name: 'فنلندا',       aliases: ['فنلندا','finland','finlande'],                      flag: '🇫🇮', reward: 220 },
  { name: 'سويسرا',       aliases: ['سويسرا','switzerland','suisse'],                   flag: '🇨🇭', reward: 220 },
  { name: 'النمسا',       aliases: ['النمسا','austria','autriche'],                      flag: '🇦🇹', reward: 220 },
  { name: 'بولندا',       aliases: ['بولندا','poland','pologne'],                        flag: '🇵🇱', reward: 200 },
  { name: 'اليونان',      aliases: ['اليونان','يونان','greece','grece'],                 flag: '🇬🇷', reward: 200 },
  { name: 'تركيا',        aliases: ['تركيا','turkey','turquie'],                         flag: '🇹🇷', reward: 180 },
  { name: 'إيران',        aliases: ['ايران','إيران','iran'],                             flag: '🇮🇷', reward: 200 },
  { name: 'باكستان',      aliases: ['باكستان','pakistan'],                               flag: '🇵🇰', reward: 180 },
  { name: 'الهند',        aliases: ['الهند','هند','india','inde'],                       flag: '🇮🇳', reward: 180 },
  { name: 'الصين',        aliases: ['الصين','صين','china','chine'],                      flag: '🇨🇳', reward: 200 },
  { name: 'اليابان',      aliases: ['اليابان','يابان','japan','japon'],                  flag: '🇯🇵', reward: 200 },
  { name: 'كوريا الجنوبية', aliases: ['كوريا','korea','coree'],                          flag: '🇰🇷', reward: 200 },
  { name: 'سنغافورة',     aliases: ['سنغافورة','singapore'],                             flag: '🇸🇬', reward: 250 },
  { name: 'إندونيسيا',    aliases: ['اندونيسيا','إندونيسيا','indonesia'],               flag: '🇮🇩', reward: 200 },
  { name: 'ماليزيا',      aliases: ['ماليزيا','malaysia'],                               flag: '🇲🇾', reward: 200 },
  { name: 'تايلاند',      aliases: ['تايلاند','thailand','thailande'],                   flag: '🇹🇭', reward: 200 },
  { name: 'روسيا',        aliases: ['روسيا','russia','russie'],                          flag: '🇷🇺', reward: 200 },
  { name: 'أوكرانيا',     aliases: ['اوكرانيا','أوكرانيا','ukraine'],                   flag: '🇺🇦', reward: 200 },
  { name: 'كندا',         aliases: ['كندا','canada'],                                    flag: '🇨🇦', reward: 200 },
  { name: 'المكسيك',      aliases: ['المكسيك','مكسيك','mexico','mexique'],               flag: '🇲🇽', reward: 200 },
  { name: 'البرازيل',     aliases: ['البرازيل','برازيل','brazil','bresil'],              flag: '🇧🇷', reward: 200 },
  { name: 'الأرجنتين',    aliases: ['الارجنتين','أرجنتين','argentina'],                  flag: '🇦🇷', reward: 220 },
  { name: 'كولومبيا',     aliases: ['كولومبيا','colombia'],                               flag: '🇨🇴', reward: 220 },
  { name: 'أستراليا',     aliases: ['استراليا','أستراليا','australia'],                  flag: '🇦🇺', reward: 220 },
  { name: 'نيوزيلندا',    aliases: ['نيوزيلندا','new zealand','nouvelle zelande'],        flag: '🇳🇿', reward: 250 },
  { name: 'جنوب أفريقيا', aliases: ['جنوب افريقيا','south africa'],                      flag: '🇿🇦', reward: 220 },
  { name: 'نيجيريا',      aliases: ['نيجيريا','nigeria'],                                flag: '🇳🇬', reward: 220 },
  { name: 'إثيوبيا',      aliases: ['اثيوبيا','إثيوبيا','ethiopia'],                    flag: '🇪🇹', reward: 220 },
  { name: 'كينيا',        aliases: ['كينيا','kenya'],                                    flag: '🇰🇪', reward: 220 },
  { name: 'غانا',         aliases: ['غانا','ghana'],                                     flag: '🇬🇭', reward: 220 },
  { name: 'المملكة المتحدة', aliases: ['انجلترا','بريطانيا','uk','england','britain'],   flag: '🇬🇧', reward: 180 },
  { name: 'الولايات المتحدة', aliases: ['امريكا','أمريكا','usa','america','etats-unis'], flag: '🇺🇸', reward: 180 },
];

// ─── State ───────────────────────────────────
const activeGames = new Map(); // chatId → { country, msgId, startTime }
const cooldowns   = new Map(); // chatId → timestamp
const COOLDOWN_MS = 5_000;    // 5 ثوانٍ بين الجولات
const TIMEOUT_MS  = 10_000;   // 30 ثانية للإجابة

// ─── Helpers ─────────────────────────────────
async function addBalance(userId, amount) {
  await run(
    `INSERT INTO pro_bank_accounts(user_id, balance)
     VALUES($1, $2)
     ON CONFLICT(user_id) DO UPDATE SET balance = pro_bank_accounts.balance + $2`,
    [userId, amount]
  ).catch(() => {});
}

async function getBalance(userId) {
  const row = await get('SELECT balance FROM pro_bank_accounts WHERE user_id=$1', [userId]).catch(() => null);
  return row ? parseFloat(row.balance || 0) : 0;
}

function randomCountry(exclude) {
  let c;
  let tries = 0;
  do {
    c = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
    tries++;
  } while (c.name === exclude && tries < 20);
  return c;
}

// ─── بدء اللعبة ──────────────────────────────
exports.startGame = async (ctx) => {
  const chatId = ctx.chat.id;

  // إذا في لعبة نشطة ابدأ واحدة جديدة مباشرة
  activeGames.delete(chatId);

  // اختر دولة عشوائية
  const prev    = activeGames.get(chatId)?.country?.name;
  const country = randomCountry(prev);


  const startTime = Date.now();

  const msg = await ctx.reply(
    `• دولة ← ${country.flag}`,
    { reply_to_message_id: ctx.message?.message_id }
  ).catch(() => null);

  activeGames.set(chatId, { country, msgId: msg?.message_id, startTime });

  // انتهاء الوقت تلقائياً
  setTimeout(() => {
    const game = activeGames.get(chatId);
    if (game && game.startTime === startTime) {
      activeGames.delete(chatId);
    }
  }, TIMEOUT_MS);
};

// ─── معالجة الإجابة ──────────────────────────
exports.handleAnswer = async (ctx) => {
  const chatId = ctx.chat.id;
  const game   = activeGames.get(chatId);
  if (!game) return false;

  const txt = (ctx.message?.text || '').trim().toLowerCase();
  const isCorrect = game.country.aliases.some(a => txt === a.toLowerCase());
  if (!isCorrect) return false;

  // ✅ إجابة صحيحة
  const elapsed = ((Date.now() - game.startTime) / 1000).toFixed(2);
  const reward  = game.country.reward;
  activeGames.delete(chatId);

  const uid  = ctx.from.id;
  const name = ctx.from.first_name || 'لاعب';

  const mention = `[${name}](tg://user?id=${uid})`;
  // جيب الرصيد ثم رد
  const curBal = await getBalance(uid);
  const newBal = curBal + reward;
  ctx.reply(
    `• اجابة صحيحة ← ${mention}\n` +
    `• الدولة ← ${game.country.name} ${game.country.flag}\n` +
    `• عدد الثواني ← ${elapsed}\n` +
    `• فلوسك ← (${Math.floor(newBal).toLocaleString()} DA 🤑)\n` +
    `-`,
    { reply_to_message_id: ctx.message.message_id, parse_mode: 'Markdown' }
  ).catch(() => {});
  // DB في الخلفية
  addBalance(uid, reward).catch(() => {});

  return true;
};

// ─── إحصائيات اللعبة ──────────────────────────
exports.getStats = () => ({
  active: activeGames.size,
  total:  COUNTRIES.length,
});
