'use strict';
// ══════════════════════════════════════════════════════════════
//  🐺 Loup-Garou — قوالب النصوص (عربي)
// ══════════════════════════════════════════════════════════════

const { ROLES } = require('./roles');
const CFG = require('./config');
const { getAlivePlayers, getPlayer } = require('./state');

function roleLine(roleId) {
  const r = ROLES[roleId];
  return r ? `${r.emoji} ${r.name}` : roleId;
}

function esc(s) {
  return String(s || '').replace(/[*_`[\]]/g, '');
}

// ══════════════════ اللوبي ══════════════════
function lobbyText(game) {
  const players = game.playerOrder.map((id, i) => `${i + 1}. ${esc(getPlayer(game, id)?.name)}`).join('\n') || '—';
  const lockLine = game.canRestrict
    ? '🔒 القفل التلقائي للقروب: متاح ✅'
    : '🔓 القفل التلقائي للقروب: غير متاح (يحتاج البوت صلاحية حذف/تقييد الأعضاء)';
  return (
`🎮 *لوب غارو — غرفة لعبة جديدة*
كود الغرفة: \`${game.gameId}\`

👥 اللاعبون: *${game.players.size}/${CFG.MAX_PLAYERS}*
📊 الحد الأدنى للبدء: ${CFG.MIN_PLAYERS}

👤 *المنضمّون:*
${players}

${lockLine}

اضغط ✅ *انضمام* للمشاركة.
عند اكتمال العدد الأدنى، يضغط منشئ الغرفة أو أحد المشرفين 🚀 *ابدأ اللعبة*.`
  );
}

function lobbyCancelledText(reason) {
  return `❌ *تم إلغاء غرفة لوب غارو*\n\n${reason || 'لم يكتمل العدد المطلوب.'}`;
}

// ══════════════════ توزيع الأدوار ══════════════════
function roleDmText(game, player) {
  const role = ROLES[player.role];
  let text = role.dm;
  if (player.isLover) {
    const partnerId = game.loversPair.find(id => id !== player.id);
    const partner = getPlayer(game, partnerId);
    text += `\n\n━━━━━━━━━━━━━━\n❤️ *أنت أيضاً عاشق!*\nشريكك في الحب: *${esc(partner?.name)}*\n\n• إن مات أحدكما يموت الآخر من الحزن فوراً.\n• إن بقيتما آخر لاعبين على قيد الحياة، *تفوزان معاً* بغض النظر عن فصيليكما الأصليين!`;
  }
  text += `\n\n💬 سيُرسل لك البوت إشعارات هنا (في الخاص) عندما يحين دورك ليلاً. تابع هذه المحادثة!`;
  return text;
}

function rolesAnnouncedText(game) {
  return (
`🎭 *تم توزيع الأدوار!*

تم إرسال دورك بالخاص لكل لاعب 📩
إن لم تستلم رسالة خاصة، تأكد من أنك بدأت محادثة مع البوت (اضغط على اسمه ثم Start) — وإلا ستُحتسب أفعالك "تجاهل" تلقائياً عند انتهاء الوقت.

عدد اللاعبين: ${game.players.size}
🐺 الذئاب: ${game.composition?.wolves || '?'}

🌙 الليل الأول يبدأ الآن...`
  );
}

// ══════════════════ الليل ══════════════════
function nightStartText(game) {
  const lockMsg = game.canRestrict ? '\n🚫 تم *قفل القروب* — يُمنع الكتابة حتى الصباح.' : '\n⚠️ تعذّر قفل القروب تلقائياً (صلاحيات ناقصة)، يُرجى الصمت حتى الصباح.';
  return `🌙 *حلّ الليل — الجولة ${game.round}*\n\nأصحاب القدرات الليلية، تابعوا رسائلكم الخاصة 📩${lockMsg}`;
}

function waitingNightText(game) {
  return `🌙 *الليل ${game.round}*\n\n⏳ البوت ينتظر اكتمال إجراءات اللاعبين أصحاب القدرات...`;
}

// ── أدوار محددة: نصوص الطلب ──
const PROMPTS = {
  guardian: '🛡️ *الحارس* — من تريد حمايته الليلة؟\n(لا يمكنك حماية من حميته الليلة الماضية)',
  seer:     '🔮 *العراف* — اختر لاعباً لتكشف حقيقته:',
  detective:'🕵️ *المحقق* — اختر *لاعبين* للمقارنة بينهما:',
  fox:      '🦊 *الثعلب* — اختر *3 لاعبين* لفحص المجموعة:',
  wolves:   '🐺 *الذئاب* — اختاروا ضحية هذه الليلة (تصويت جماعي):',
  sk:       '☠️ *القاتل المتسلسل* — اختر ضحيتك الليلة:',
  vampire:  '🧛 *مصاص الدماء* — اختر ضحيتك الليلة لتنهشها:',
};

function nightPromptText(roleKind, extra) {
  return PROMPTS[roleKind] + (extra ? '\n\n' + extra : '');
}

function seerResultText(target, isWolf) {
  return `🔮 *نتيجة التحقيق عن ${esc(target.name)}:*\n\n${isWolf ? '🐺 ذئب! احذروه.' : '👤 بريء (ليس من الذئاب).'}`;
}

function detectiveResultText(t1, t2, same) {
  return `🕵️ *نتيجة المقارنة:*\n${esc(t1.name)} ↔️ ${esc(t2.name)}\n\n${same ? '✅ كلاهما من *نفس الفصيل*.' : '❌ كلاهما من *فصيلين مختلفين*.'}`;
}

function foxResultText(targets, found, lostAbility) {
  const names = targets.map(t => esc(t.name)).join('، ');
  let text = `🦊 *نتيجة الفحص:*\nالمجموعة: ${names}\n\n${found ? '🐺 يوجد ذئب واحد على الأقل بينهم!' : '✅ لا يوجد أي ذئب بينهم.'}`;
  if (lostAbility) text += '\n\n⚠️ بسبب نتيجة "لا يوجد ذئب"، فقدتَ قدرتك كثعلب لبقية اللعبة.';
  return text;
}

function witchPromptText(victim) {
  const v = victim ? `الضحية التي اختارها الذئاب الليلة: *${esc(victim.name)}*` : 'لم يختر الذئاب ضحية محددة الليلة (أو ماتوا جميعاً).';
  return `🧪 *الساحرة*\n\n${v}\n\nماذا تفعلين؟`;
}

function hunterRevengeText() {
  return `🔫 *أنت الصياد!*\n\nأنت تموت الآن — لكن قبل ذلك، أطلق رصاصتك الأخيرة على أحدهم فيموت معك:`;
}

// ══════════════════ الصباح ══════════════════
function dayStartText(game, deaths, extraNotes) {
  let body;
  if (!deaths.length) {
    body = '✅ *نجا الجميع الليلة الماضية!* لم يمت أحد.';
  } else {
    body = deaths.map(d => {
      if (d.cause === 'heartbreak') return `💔 مات *${esc(d.name)}* حزناً على فقدان حبيبه/حبيبته.`;
      if (d.cause === 'hunter') return `🔫 مات *${esc(d.name)}* برصاصة الصياد، وكان ${roleLine(d.revealRole)}.`;
      return `💀 مات/ماتت *${esc(d.name)}* الليلة.`;
    }).join('\n');
  }
  const notes = extraNotes && extraNotes.length ? '\n\n' + extraNotes.join('\n') : '';
  const unlock = game.canRestrict ? '\n\n🔓 تم *فتح القروب* للنقاش.' : '';
  return `☀️ *أشرقت الشمس — الجولة ${game.round}*\n\n${body}${notes}${unlock}\n\n👥 الأحياء: ${getAlivePlayers(game).length} | 💀 الأموات: ${game.players.size - getAlivePlayers(game).length}`;
}

function discussionStartText(seconds) {
  return `🗣️ *النقاش مفتوح!*\n\n⏳ لديكم ${Math.round(seconds / 1000)} ثانية للنقاش والاستنتاج قبل بدء التصويت.`;
}

function discussionTimeLeftText(seconds) {
  return `⏳ ${seconds} ثانية متبقية على النقاش...`;
}

function discussionEndedText() {
  return `🔇 *انتهى وقت النقاش!*\n\n🚫 تم إغلاق القروب، استعدّوا للتصويت.`;
}

// ══════════════════ التصويت ══════════════════
function voteStartText(game, votedCount) {
  const total = getAlivePlayers(game).length;
  return `🗳️ *من تريد القرية إعدامه؟*\n\nصوّت حتى الآن: ${votedCount}/${total}\n⏳ لديك ${Math.round(CFG.TIMERS.VOTE / 1000)} ثانية.`;
}

function voteResultsText(game, tally) {
  const lines = [...tally.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([key, v]) => {
      const label = key === 'x' ? '🤝 عدم الإعدام' : esc(v.name);
      const mayorTag = v.hasMayor ? ' 👑' : '';
      return `${label}: ${v.count} صوت${mayorTag}`;
    });
  return `📊 *نتائج التصويت:*\n\n${lines.join('\n')}`;
}

function executionText(player) {
  const role = ROLES[player.role];
  let extra = '';
  if (player.role === 'jester') extra = '\n\n🤡 *المهرج فاز!* لقد نجحت خطته في جعل القرية تُعدمه — فوز شخصي فوري!';
  return `⚖️ *تم إعدام ${esc(player.name)}*\n\nكان دوره: ${role.emoji} *${role.name}*${extra}`;
}

function noExecutionText() {
  return `🤝 *قررت القرية عدم إعدام أحد هذه الجولة.*`;
}

function tieText(names) {
  return `🤝 *تعادل!*\nالأصوات متساوية بين: ${names.map(esc).join('، ')}\nلم يُعدم أحد هذه الجولة.`;
}

// ══════════════════ الحالة والسجل ══════════════════
function statusText(game) {
  const alive = getAlivePlayers(game);
  const dead = [...game.players.values()].filter(p => !p.alive);
  const phaseNames = { lobby: '⏳ غرفة الانتظار', night: '🌙 ليل', day: '☀️ نهار', discussion: '🗣️ نقاش', voting: '🗳️ تصويت', ended: '🏁 انتهت' };
  const aliveList = alive.map(p => `• ${esc(p.name)}`).join('\n') || '—';
  const deadList = dead.map(p => {
    const revealed = game.deadRolesRevealed.get(p.id);
    return revealed ? `• ${esc(p.name)} — ${roleLine(revealed)}` : `• ${esc(p.name)}`;
  }).join('\n') || '—';
  return (
`📋 *حالة اللعبة* (كود: \`${game.gameId}\`)

📍 المرحلة: ${phaseNames[game.status] || game.status}
🔄 الجولة: ${game.round}

👥 *الأحياء (${alive.length}):*
${aliveList}

💀 *الأموات (${dead.length}):*
${deadList}`
  );
}

function eventLogText(game) {
  if (!game.eventLog.length) return '📜 *سجل الأحداث:*\n\nلا توجد أحداث بعد.';
  const recent = game.eventLog.slice(-CFG.EVENT_LOG_DISPLAY);
  let lastRound = null;
  const lines = [];
  for (const e of recent) {
    if (e.round !== lastRound) { lines.push(`\n*— الجولة ${e.round} —*`); lastRound = e.round; }
    lines.push('• ' + e.text);
  }
  return `📜 *سجل أحداث اللعبة* (آخر ${recent.length}):\n${lines.join('\n')}`;
}

// ══════════════════ نهاية اللعبة ══════════════════
const TEAM_NAMES = {
  village: '👨‍🌾 فصيل القرية',
  wolves: '🐺 فصيل الذئاب',
  solo_sk: '☠️ القاتل المتسلسل',
  solo_vampire: '🧛 مصاص الدماء',
  lovers: '❤️ العاشقان',
};

function gameEndText(game, result) {
  let header;
  if (result.winType === 'lovers') {
    const names = result.winners.map(w => esc(w.name)).join(' و ');
    header = `🏁 *انتهت اللعبة!*\n\n❤️ *فاز العاشقان معاً:* ${names}!`;
  } else {
    header = `🏁 *انتهت اللعبة!*\n\n🎉 *${TEAM_NAMES[result.winTeam] || result.winTeam} هو الفائز!*`;
  }

  let jesterLine = '';
  if (game.jesterWon) {
    const j = getPlayer(game, game.jesterWon);
    jesterLine = `\n🤡 بالإضافة لذلك، فاز *${esc(j?.name)}* (المهرج) فوزاً شخصياً بإعدامه سابقاً!`;
  }

  const byRole = new Map();
  for (const p of game.players.values()) {
    if (!byRole.has(p.role)) byRole.set(p.role, []);
    byRole.get(p.role).push(p.name);
  }
  const rolesText = [...byRole.entries()]
    .map(([roleId, names]) => `${roleLine(roleId)}: ${names.map(esc).join('، ')}`)
    .join('\n');

  return (
`${header}${jesterLine}

🎭 *الأدوار الكاملة:*
${rolesText}

🔄 عدد الجولات: ${game.round}
💰 تم توزيع مكافآت اقتصادية على المستحقين!

اكتب 🎮 لإنشاء غرفة جديدة.`
  );
}

// ══════════════════ القوانين ══════════════════
function rulesText() {
  const roleLines = Object.values(ROLES).map(r => `${r.emoji} *${r.name}* — ${r.short}`).join('\n');
  return (
`📖 *قوانين لوب غارو الاحترافية*

🔄 *دورة اللعبة:*
🌙 ليل (تنفيذ القدرات سرّاً) → ☀️ صباح (إعلان النتائج) → 🗣️ نقاش (مؤقت) → 🗳️ تصويت → ⚖️ إعدام → فحص الفوز → جولة جديدة.

👥 اللاعبون: ${CFG.MIN_PLAYERS}–${CFG.MAX_PLAYERS}، وتتغيّر الأدوار المتاحة تلقائياً حسب العدد.

🎭 *الأدوار:*
${roleLines}

🏆 *شروط الفوز:*
• تفوز *القرية* إن انعدمت الذئاب (والخائن).
• تفوز *الذئاب* إن انعدم فصيل القرية.
• يفوز *القاتل المتسلسل* / *مصاص الدماء* إن بقي هو الناجي الوحيد.
• يفوز *العاشقان* معاً إن بقيا آخر اثنين على قيد الحياة.
• يفوز *المهرج* فوراً وفوزاً شخصياً إن أعدمته القرية بالتصويت.

🚨 *مكافحة الغش:* لا يمكن الانضمام لأكثر من لعبة بالتوازي، ولا التصويت أكثر من مرة فعّالة، وكل زر له صلاحية لمرحلته فقط.`
  );
}

// ══════════════════ الإحصائيات / الرتب / المواسم ══════════════════
function statsText(row, rank, achCount) {
  const games = row.games_played || 0;
  const wins = row.wins || 0;
  const rate = games > 0 ? Math.round((wins / games) * 100) : 0;
  const rc = row.role_counts || {};
  const roleCountsLines = Object.keys(ROLES).map(id => `${roleLine(id)}: ${rc[id] || 0}`).join('\n');
  return (
`🏆 *إحصائياتك — لوب غارو*

${rank.emoji} *${rank.name}*

🎮 عدد الألعاب: ${games}
✅ الانتصارات: ${wins}
❌ الهزائم: ${row.losses || 0}
📊 نسبة الفوز: ${rate}%

🐺 انتصارات كذئب: ${row.wolf_wins || 0}
👨‍🌾 انتصارات مع القرية: ${row.village_wins || 0}
☠️ انتصارات منفردة (قاتل/مصاص): ${(row.sk_wins || 0) + (row.vampire_wins || 0)}
🤡 انتصارات المهرج: ${row.jester_wins || 0}

🔮 تحقيقات ناجحة: ${row.seer_correct || 0} (من ${row.seer_investigations || 0})
🧪 إنقاذات الساحرة: ${row.witch_saves || 0}
🛡️ حمايات ناجحة: ${row.guardian_saves || 0}
🎯 إعدامات صحيحة: ${row.correct_executions || 0}

🎭 *عدد مرات لعب كل دور:*
${roleCountsLines}

🎖️ الإنجازات المُحققة: ${achCount}`
  );
}

function rankUpText(rank) {
  return `🎉 *ترقية رتبة!* أصبحت الآن ${rank.emoji} *${rank.name}*!`;
}

function newAchievementsText(achievements) {
  if (!achievements.length) return '';
  const lines = achievements.map(a => `${a.emoji} *${a.name}*`).join('\n');
  return `\n\n🎖️ *إنجازات جديدة!*\n${lines}`;
}

function seasonText(seasonKey, board, label) {
  function line(emoji, lbl, row, valKey, suffix) {
    if (!row) return `${emoji} ${lbl}: لا توجد بيانات كافية بعد`;
    const name = esc(row.first_name || row.username || 'لاعب');
    let val = row[valKey];
    if (valKey === 'rate') val = Math.round(val * 100) + '%';
    return `${emoji} ${lbl}: *${name}* — ${val}${suffix || ''}`;
  }
  return (
`🌍 *${label}*

${line('🏆', 'أفضل لاعب', board.bestPlayer, 'wins', ' انتصار')}
${line('🐺', 'أفضل ذئب', board.bestWolf, 'wolf_wins', ' فوز كذئب')}
${line('🔮', 'أفضل عراف', board.bestSeer, 'seer_correct', ' تحقيق ناجح')}
${line('📈', 'أفضل نسبة فوز (3+ ألعاب)', board.bestRate, 'rate')}`
  );
}

function achievementsText(earned, allDefs) {
  const earnedKeys = new Set(earned.map(a => a.key));
  const earnedLines = earned.length
    ? earned.map(a => `${a.emoji} *${a.name}*`).join('\n')
    : '— لا يوجد بعد —';
  const lockedLines = allDefs.filter(a => !earnedKeys.has(a.key))
    .map(a => `🔒 ${a.emoji} ${a.name}`).join('\n') || '— حصلت على الكل! —';
  return (
`🎖️ *إنجازاتك في لوب غارو*

✅ *محقَّقة:*
${earnedLines}

🔒 *قادمة:*
${lockedLines}`
  );
}

module.exports = {
  roleLine, esc,
  lobbyText, lobbyCancelledText,
  roleDmText, rolesAnnouncedText,
  nightStartText, waitingNightText, nightPromptText,
  seerResultText, detectiveResultText, foxResultText, witchPromptText, hunterRevengeText,
  dayStartText, discussionStartText, discussionTimeLeftText, discussionEndedText,
  voteStartText, voteResultsText, executionText, noExecutionText, tieText,
  statusText, eventLogText, gameEndText, rulesText,
  statsText, rankUpText, newAchievementsText, seasonText, achievementsText,
};
