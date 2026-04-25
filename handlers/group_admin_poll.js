'use strict';
const { run, all, get } = require('../database/db');

// ── إنشاء تصويت ──────────────────────────────────
async function createPoll(ctx, chatId, question, options, mediaFileId, mediaType) {
  try {
    const poll = await get(
      'INSERT INTO polls(chat_id,created_by,question,media_file_id,media_type,created_at) VALUES($1,$2,$3,$4,$5,CURRENT_TIMESTAMP) RETURNING id',
      [chatId, ctx.from.id, question, mediaFileId||null, mediaType||null]
    );
    const pollId = poll.id;
    for (let i = 0; i < options.length; i++) {
      await run('INSERT INTO poll_options(poll_id,option_text,emoji,position) VALUES($1,$2,$3,$4)',
        [pollId, options[i].text, options[i].emoji||'🔵', i+1]);
    }
    return pollId;
  } catch(e) { console.error('[Poll Create]', e.message); return null; }
}

// ── إرسال التصويت للقروب ─────────────────────────
async function sendPoll(ctx, chatId, pollId) {
  try {
    const poll = await get('SELECT * FROM polls WHERE id=$1', [pollId]);
    const options = await all('SELECT * FROM poll_options WHERE poll_id=$1 ORDER BY position', [pollId]);
    if (!poll || !options.length) return;
    const text = buildPollText(poll, options);
    const rows = buildPollButtons(pollId, options, poll.is_closed, true);
    let sentMsg;
    if (poll.media_file_id) {
      const extra = { caption: text, parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows } };
      if (poll.media_type === 'photo') sentMsg = await ctx.telegram.sendPhoto(chatId, poll.media_file_id, extra).catch(()=>null);
      else if (poll.media_type === 'video') sentMsg = await ctx.telegram.sendVideo(chatId, poll.media_file_id, extra).catch(()=>null);
      else sentMsg = await ctx.telegram.sendDocument(chatId, poll.media_file_id, extra).catch(()=>null);
    } else {
      sentMsg = await ctx.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows } }).catch(()=>null);
    }
    if (sentMsg) await run('UPDATE polls SET message_id=$1 WHERE id=$2', [sentMsg.message_id, pollId]);
    return sentMsg;
  } catch(e) { console.error('[Send Poll]', e.message); }
}

// ── بناء نص التصويت ──────────────────────────────
function buildPollText(poll, options) {
  const totalVotes = options.reduce((s, o) => s + (o.votes||0), 0);
  const status = poll.is_closed ? '🔒 *مغلق*' : '🟢 *نشط*';
  let text = `📊 *${poll.question}*\n${status}\n\n`;
  options.forEach((opt, i) => {
    const votes = opt.votes || 0;
    const pct = totalVotes > 0 ? Math.round(votes / totalVotes * 100) : 0;
    const bar = buildBar(pct);
    const crown = (i === 0 && totalVotes > 0 && votes > 0) ? '👑 ' : '';
    text += `${crown}${opt.emoji} *${opt.option_text}*\n${bar} ${pct}% — ${votes} صوت\n\n`;
  });
  text += `━━━━━━━━━━━━\n👥 إجمالي الأصوات: *${totalVotes}*`;
  return text;
}

function buildBar(pct) {
  const filled = Math.round(pct / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

// ── أزرار التصويت ────────────────────────────────
function buildPollButtons(pollId, options, isClosed, isAdmin) {
  const rows = options.map(opt => [{
    text: `${opt.emoji} ${opt.option_text} (${opt.votes||0})`,
    callback_data: isClosed ? 'poll_closed_notice' : `vote_${pollId}_${opt.id}`
  }]);
  rows.push([
    { text: '📊 النتائج', callback_data: `poll_results_${pollId}` },
    { text: '🔄 تحديث', callback_data: `poll_refresh_${pollId}` }
  ]);
  if (isAdmin) {
    if (!isClosed) {
      rows.push([{ text: '🔒 إنهاء التصويت', callback_data: `poll_close_${pollId}` }]);
    } else {
      rows.push([
        { text: '🗑 حذف', callback_data: `poll_delete_${pollId}` },
        { text: '🔄 تصفير', callback_data: `poll_reset_${pollId}` }
      ]);
    }
  }
  return rows;
}

// ── تسجيل صوت ────────────────────────────────────
async function castVote(ctx, pollId, optionId) {
  try {
    const uid = ctx.from.id;
    const pollCheck = await get('SELECT is_closed FROM polls WHERE id=$1', [pollId]);
    if (pollCheck?.is_closed) return ctx.answerCbQuery('🔒 التصويت مغلق!', { show_alert: true }).catch(()=>{});
    const existing = await get('SELECT option_id FROM poll_votes WHERE poll_id=$1 AND user_id=$2', [pollId, uid]);
    if (existing) return ctx.answerCbQuery('🚫 صوّت مسبقاً ولا يمكن التغيير!', { show_alert: true }).catch(()=>{});
    await run('INSERT INTO poll_votes(poll_id,option_id,user_id) VALUES($1,$2,$3)', [pollId, optionId, uid]);
    await run('UPDATE poll_options SET votes=votes+1 WHERE id=$1', [optionId]);
    ctx.answerCbQuery('✅ تم تسجيل صوتك!').catch(()=>{});
    await refreshPollMessage(ctx, pollId);
  } catch(e) { console.error('[Vote]', e.message); ctx.answerCbQuery('❌ خطأ').catch(()=>{}); }
}

// ── تحديث رسالة التصويت ──────────────────────────
async function refreshPollMessage(ctx, pollId) {
  try {
    const poll = await get('SELECT * FROM polls WHERE id=$1', [pollId]);
    const options = await all('SELECT * FROM poll_options WHERE poll_id=$1 ORDER BY position', [pollId]);
    if (!poll || !poll.message_id) return;
    // تحقق من صلاحيات المستخدم الحالي
    const OWNER_ID = parseInt(process.env.OWNER_ID||'0');
    let isAdmin = ctx.from?.id === OWNER_ID;
    if (!isAdmin) {
      try {
        const m = await ctx.telegram.getChatMember(poll.chat_id, ctx.from.id);
        isAdmin = ['administrator','creator'].includes(m?.status);
      } catch(_) {}
    }
    const text = buildPollText(poll, options);
    const rows = buildPollButtons(pollId, options, poll.is_closed, isAdmin);
    if (poll.media_file_id) {
      await ctx.telegram.editMessageCaption(poll.chat_id, poll.message_id, null, text, {
        parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows }
      }).catch(()=>{});
    } else {
      await ctx.telegram.editMessageText(poll.chat_id, poll.message_id, null, text, {
        parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows }
      }).catch(()=>{});
    }
  } catch(e) { console.error('[Refresh Poll]', e.message); }
}

// ── النتائج التفصيلية — تحديث نفس الرسالة ────────
async function showPollResults(ctx, pollId) {
  try {
    ctx.answerCbQuery('📊 تم التحديث').catch(()=>{});
    await refreshPollMessage(ctx, pollId);
  } catch(e) { console.error('[Results]', e.message); }
}

// ── إغلاق التصويت ────────────────────────────────
async function closePoll(ctx, pollId) {
  try {
    ctx.answerCbQuery('').catch(()=>{});
    const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id).catch(()=>null);
    const isAdmin = ctx.from.id === parseInt(process.env.OWNER_ID) ||
                   ['administrator','creator'].includes(member?.status);
    if (!isAdmin) return ctx.answerCbQuery('🚫 للمشرفين فقط', { show_alert: true }).catch(()=>{});
    await run('UPDATE polls SET is_closed=1 WHERE id=$1', [pollId]);
    await refreshPollMessage(ctx, pollId);
  } catch(e) { console.error('[Close Poll]', e.message); }
}

// ── تصفير الأصوات ────────────────────────────────
async function resetPoll(ctx, pollId) {
  try {
    ctx.answerCbQuery('✅ تم التصفير').catch(()=>{});
    await run('UPDATE poll_options SET votes=0 WHERE poll_id=$1', [pollId]);
    await run('DELETE FROM poll_votes WHERE poll_id=$1', [pollId]);
    await run('UPDATE polls SET is_closed=0 WHERE id=$1', [pollId]);
    await refreshPollMessage(ctx, pollId);
  } catch(e) { console.error('[Reset Poll]', e.message); }
}

// ── حذف تصويت ────────────────────────────────────
async function deletePoll(ctx, pollId) {
  try {
    ctx.answerCbQuery('🗑 تم الحذف').catch(()=>{});
    const poll = await get('SELECT * FROM polls WHERE id=$1', [pollId]);
    if (poll?.message_id) await ctx.telegram.deleteMessage(poll.chat_id, poll.message_id).catch(()=>{});
    await run('DELETE FROM poll_votes WHERE poll_id=$1', [pollId]);
    await run('DELETE FROM poll_options WHERE poll_id=$1', [pollId]);
    await run('DELETE FROM polls WHERE id=$1', [pollId]);
  } catch(e) { console.error('[Delete Poll]', e.message); }
}

module.exports = { createPoll, sendPoll, castVote, refreshPollMessage, showPollResults, resetPoll, deletePoll, closePoll, buildPollText, buildPollButtons };
