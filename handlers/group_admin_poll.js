
// ═══════════════════════════════════════════════════
// 🗳️ نظام التصويت الاحترافي
// ═══════════════════════════════════════════════════

const { run, all, get } = require('../database/db');
const { cacheGet, cacheSet, cacheClear } = require('../utils/cache');

// ── إنشاء تصويت ──────────────────────────────────
async function createPoll(ctx, chatId, question, options, mediaFileId, mediaType) {
  try {
    // احفظ التصويت في DB
    const poll = await get(
      `INSERT INTO polls(chat_id, created_by, question, media_file_id, media_type, created_at)
       VALUES($1,$2,$3,$4,$5,CURRENT_TIMESTAMP) RETURNING id`,
      [chatId, ctx.from.id, question, mediaFileId||null, mediaType||null]
    );
    const pollId = poll.id;

    // احفظ الخيارات
    for (let i = 0; i < options.length; i++) {
      await run(
        'INSERT INTO poll_options(poll_id, option_text, emoji, position) VALUES($1,$2,$3,$4)',
        [pollId, options[i].text, options[i].emoji||'🔵', i+1]
      );
    }

    return pollId;
  } catch(e) {
    console.error('[Poll Create]', e.message);
    return null;
  }
}

// ── إرسال التصويت للقروب ─────────────────────────
async function sendPoll(ctx, chatId, pollId) {
  try {
    const poll = await get('SELECT * FROM polls WHERE id=$1', [pollId]);
    const options = await all('SELECT * FROM poll_options WHERE poll_id=$1 ORDER BY position', [pollId]);
    if (!poll || !options.length) return;

    const text = buildPollText(poll, options);
    const rows = buildPollButtons(pollId, options);

    let sentMsg;
    if (poll.media_file_id) {
      const extra = { caption: text, parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows } };
      if (poll.media_type === 'photo') sentMsg = await ctx.telegram.sendPhoto(chatId, poll.media_file_id, extra).catch(() => null);
      else if (poll.media_type === 'video') sentMsg = await ctx.telegram.sendVideo(chatId, poll.media_file_id, extra).catch(() => null);
      else sentMsg = await ctx.telegram.sendDocument(chatId, poll.media_file_id, extra).catch(() => null);
    } else {
      sentMsg = await ctx.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows } }).catch(() => null);
    }

    if (sentMsg) {
      await run('UPDATE polls SET message_id=$1 WHERE id=$2', [sentMsg.message_id, pollId]);
    }

    return sentMsg;
  } catch(e) {
    console.error('[Send Poll]', e.message);
  }
}

// ── بناء نص التصويت ──────────────────────────────
function buildPollText(poll, options) {
  const totalVotes = options.reduce((s, o) => s + (o.votes||0), 0);
  let text = `📊 *${poll.question}*\n\n`;

  options.forEach(opt => {
    const votes = opt.votes || 0;
    const pct = totalVotes > 0 ? Math.round(votes / totalVotes * 100) : 0;
    const bar = buildBar(pct);
    text += `${opt.emoji} *${opt.option_text}*\n`;
    text += `${bar} ${pct}% (${votes} صوت)\n\n`;
  });

  text += `━━━━━━━━━━━━\n`;
  text += `👥 إجمالي الأصوات: *${totalVotes}*`;
  return text;
}

// ── شريط التقدم ──────────────────────────────────
function buildBar(pct) {
  const filled = Math.round(pct / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

// ── أزرار التصويت ────────────────────────────────
function buildPollButtons(pollId, options) {
  const rows = options.map(opt => [{
    text: `${opt.emoji} ${opt.option_text} (${opt.votes||0})`,
    callback_data: `vote_${pollId}_${opt.id}`
  }]);
  rows.push([
    { text: '📊 النتائج', callback_data: `poll_results_${pollId}` },
    { text: '🔄 تحديث', callback_data: `poll_refresh_${pollId}` }
  ]);
  return rows;
}

// ── تسجيل صوت ────────────────────────────────────
async function castVote(ctx, pollId, optionId) {
  try {
    const uid = ctx.from.id;

    // تحقق من التصويت المسبق
    const existing = await get(
      'SELECT option_id FROM poll_votes WHERE poll_id=$1 AND user_id=$2',
      [pollId, uid]
    );

    if (existing) {
      if (existing.option_id === optionId) {
        return ctx.answerCbQuery('✅ لقد صوّت بالفعل لهذا الخيار', { show_alert: true }).catch(() => {});
      }
      // غيّر الصوت
      await run('UPDATE poll_votes SET option_id=$1, voted_at=CURRENT_TIMESTAMP WHERE poll_id=$2 AND user_id=$3',
        [optionId, pollId, uid]);
      await run('UPDATE poll_options SET votes=votes-1 WHERE id=$1', [existing.option_id]);
      await run('UPDATE poll_options SET votes=votes+1 WHERE id=$1', [optionId]);
      ctx.answerCbQuery('🔄 تم تغيير صوتك!').catch(() => {});
    } else {
      // صوت جديد
      await run('INSERT INTO poll_votes(poll_id, option_id, user_id) VALUES($1,$2,$3)',
        [pollId, optionId, uid]);
      await run('UPDATE poll_options SET votes=votes+1 WHERE id=$1', [optionId]);
      ctx.answerCbQuery('✅ تم تسجيل صوتك!').catch(() => {});
    }

    // تحديث الرسالة
    await refreshPollMessage(ctx, pollId);
  } catch(e) {
    console.error('[Vote]', e.message);
    ctx.answerCbQuery('❌ خطأ').catch(() => {});
  }
}

// ── تحديث رسالة التصويت ──────────────────────────
async function refreshPollMessage(ctx, pollId) {
  try {
    const poll = await get('SELECT * FROM polls WHERE id=$1', [pollId]);
    const options = await all('SELECT * FROM poll_options WHERE poll_id=$1 ORDER BY position', [pollId]);
    if (!poll || !poll.message_id) return;

    const text = buildPollText(poll, options);
    const rows = buildPollButtons(pollId, options);

    if (poll.media_file_id) {
      await ctx.telegram.editMessageCaption(poll.chat_id, poll.message_id, null, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: rows }
      }).catch(() => {});
    } else {
      await ctx.telegram.editMessageText(poll.chat_id, poll.message_id, null, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: rows }
      }).catch(() => {});
    }
  } catch(e) {
    console.error('[Refresh Poll]', e.message);
  }
}

// ── عرض النتائج التفصيلية ────────────────────────
async function showPollResults(ctx, pollId) {
  try {
    ctx.answerCbQuery('').catch(() => {});
    const poll = await get('SELECT * FROM polls WHERE id=$1', [pollId]);
    const options = await all('SELECT * FROM poll_options WHERE poll_id=$1 ORDER BY votes DESC', [pollId]);
    const totalVotes = options.reduce((s, o) => s + (o.votes||0), 0);

    let text = `📊 *نتائج: ${poll.question}*\n\n`;
    options.forEach((opt, i) => {
      const votes = opt.votes || 0;
      const pct = totalVotes > 0 ? Math.round(votes / totalVotes * 100) : 0;
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '▫️';
      text += `${medal} ${opt.emoji} *${opt.option_text}*\n`;
      text += `   ${buildBar(pct)} ${pct}% — ${votes} صوت\n\n`;
    });
    text += `━━━━━━━━━━━━\n👥 المجموع: *${totalVotes}* صوت`;

    await ctx.reply(text, { parse_mode: 'Markdown' }).catch(() => {});
  } catch(e) {
    console.error('[Results]', e.message);
  }
}

// ── تصفير الأصوات ─────────────────────────────────
async function resetPoll(pollId) {
  await run('UPDATE poll_options SET votes=0 WHERE poll_id=$1', [pollId]);
  await run('DELETE FROM poll_votes WHERE poll_id=$1', [pollId]);
}

// ── حذف تصويت ────────────────────────────────────
async function deletePoll(ctx, pollId) {
  const poll = await get('SELECT * FROM polls WHERE id=$1', [pollId]);
  if (poll?.message_id) {
    await ctx.telegram.deleteMessage(poll.chat_id, poll.message_id).catch(() => {});
  }
  await run('DELETE FROM poll_votes WHERE poll_id=$1', [pollId]);
  await run('DELETE FROM poll_options WHERE poll_id=$1', [pollId]);
  await run('DELETE FROM polls WHERE id=$1', [pollId]);
}

module.exports = {
  createPoll, sendPoll, castVote, refreshPollMessage,
  showPollResults, resetPoll, deletePoll, buildPollText, buildPollButtons
};
