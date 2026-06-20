'use strict';
// ══════════════════════════════════════════════════════════════
//  🎮 أكسيو أو فيريتي — قوالب النصوص
// ══════════════════════════════════════════════════════════════

function esc(s) { return String(s || '').replace(/[*_`[\]]/g, ''); }
function mention(p) { return `[${esc(p.name)}](tg://user?id=${p.id})`; }
function secs(ms) { return Math.round(ms / 1000); }

function registrationText(session) {
  const list = session.playerOrder.map((id, i) => `${i + 1}. ${esc(session.players.get(id)?.name)}`).join('\n') || '—';
  const owner = session.players.get(session.ownerId);
  return (
`🎮 *لعبة أكسيو أو فيريتي*

👑 *المنشئ:* ${owner ? mention(owner) : '—'}

👥 *المشاركون:*
${list}

📊 *العدد:* ${session.players.size}

✍️ اكتب *"أنا"* للانضمام.
🚀 يكتب المنشئ *"ابدأ"* لبدء اللعبة.
❌ يكتب المنشئ *"إلغاء"* لإلغاء الغرفة.`
  );
}

function sessionCancelledText(reason) {
  return `❌ *تم إلغاء غرفة أكسيو أو فيريتي*\n\n${reason || ''}`;
}

function notEnoughPlayersText(min, current) {
  return `🚫 العدد غير كافٍ! المطلوب ${min} لاعبين على الأقل (الحاليون: ${current}).`;
}

function roundAnnounceText(session, asker, answerer) {
  return (
`🎯 *الجولة ${session.round}*

🎤 *السائل:* ${mention(asker)}
🙋 *المجيب:* ${mention(answerer)}`
  );
}

function choicePromptText(answerer) {
  return `${mention(answerer)}، اختر:`;
}

function choiceMadeText(answerer, mode) {
  const label = mode === 'truth' ? '💬 فيريتي (سؤال صادق)' : '🔥 أكسيو (تحدي)';
  return `✅ اختار ${mention(answerer)}: *${label}*`;
}

function choiceTimeoutText(answerer) {
  return `⏰ *${esc(answerer.name)}* لم يختر في الوقت المحدد — جارٍ اختيار جولة جديدة...`;
}

function submitPromptText(session, asker, answerer, mode) {
  const kind = mode === 'truth' ? 'سؤالاً صادقاً' : 'تحدياً مناسباً';
  return (
`${mention(asker)}، اكتب الآن ${kind} لـ ${mention(answerer)}.

✍️ اكتب رسالتك بالصيغة التالية:
*سل* ثم ${kind === 'سؤالاً صادقاً' ? 'سؤالك' : 'تحديك'}
مثال: \`سل كم عمرك؟\`

⏳ لديك ${secs(session.settings.submit || 60000)} ثانية.`
  );
}

function submitTimeoutText(asker) {
  return `⏰ *${esc(asker.name)}* لم يكتب السؤال/التحدي بالصيغة الصحيحة (سل ...) في الوقت المحدد — جارٍ اختيار جولة جديدة...`;
}

function questionPostedText(session, asker, answerer, mode, content) {
  const icon = mode === 'truth' ? '💬' : '🔥';
  const label = mode === 'truth' ? 'فيريتي' : 'أكسيو';
  return (
`${icon} *${label}* — من ${mention(asker)} إلى ${mention(answerer)}:

"${esc(content)}"

✍️ ${mention(answerer)} للإجابة اكتب رسالتك بالصيغة:
*اجب* ثم إجابتك
مثال: \`اجب 20 سنة\`

⏳ لديك ${secs(session.settings.answer || 30000)} ثانية للرد!`
  );
}

function answerReceivedText(answerer) {
  return `✅ *${esc(answerer.name)}* أجاب/أجابت! 🎉`;
}

function answerTimeoutText(answerer) {
  return `⏰ *انتهت المهلة!* لم يُجب ${esc(answerer.name)} في الوقت المحدد.`;
}

function banterOpenText(seconds) {
  return `💬 *الدردشة مفتوحة الآن* لمدة ${seconds} ثانية — علّقوا، اضحكوا، تفاعلوا! 😄`;
}

function banterClosedText() {
  return `🔇 أُغلقت الدردشة — الجولة القادمة بعد قليل...`;
}

function sessionEndedText(session, reason) {
  return (
`🏁 *انتهت لعبة أكسيو أو فيريتي!*

${reason || ''}

🔄 عدد الجولات: ${session.round}
👥 عدد اللاعبين: ${session.players.size}

اكتب *"صحصح"* لبدء جلسة جديدة.`
  );
}

function statsText(row, ach) {
  return (
`📊 *إحصائياتك — أكسيو أو فيريتي*

🎮 عدد الألعاب: ${row.games_played || 0}
🎤 مرات كسائل: ${row.asked_count || 0}
🙋 مرات كمجيب: ${row.answered_count || 0}
🔥 تحديات منجزة: ${row.dare_completed || 0}
💬 إجابات صادقة: ${row.truth_completed || 0}
⏰ مرات التهرّب: ${row.timeouts || 0}

🎖️ الإنجازات: ${ach.length}`
  );
}

function rulesText() {
  return (
`📖 *قوانين أكسيو أو فيريتي*

1️⃣ اكتب *"صحصح"* لإنشاء غرفة، وانضم الآخرون بكتابة *"أنا"*.
2️⃣ يبدأ المنشئ بكتابة *"ابدأ"* (يلزم حد أدنى من اللاعبين).
3️⃣ يختار البوت سائلاً ومجيباً بعدالة (الأقل مشاركة له الأولوية)، وتظهر أزرار *أكسيو/فيريتي* للمجيب فوراً.
4️⃣ بعد اختيار المجيب، يكتب السائل سؤاله/تحديه بالصيغة: *سل* ثم النص (مثال: \`سل كم عمرك؟\`).
5️⃣ يجيب المجيب بالصيغة: *اجب* ثم النص (مثال: \`اجب 20 سنة\`).
6️⃣ بعد كل جولة تُفتح الدردشة لثوانٍ معدودة للتفاعل.
7️⃣ أثناء الجولة النشطة، لا يُسمح بالكلام إلا للسائل والمجيب — أي رسالة أخرى تُحذف تلقائياً.
8️⃣ يكتب المنشئ أو أي مشرف *"إنهاء"* لإيقاف اللعبة في أي وقت.`
  );
}

module.exports = {
  esc, mention, secs,
  registrationText, sessionCancelledText, notEnoughPlayersText,
  roundAnnounceText,
  choicePromptText, choiceMadeText, choiceTimeoutText,
  submitPromptText, submitTimeoutText,
  questionPostedText, answerReceivedText, answerTimeoutText,
  banterOpenText, banterClosedText,
  sessionEndedText, statsText, rulesText,
};
