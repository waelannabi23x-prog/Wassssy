const escMd = t => (t || '').replace(/[*_`\[\]()~>#+=|{}.!\-]/g, '\\$&');

function buildPath(parts) {
  return parts.filter(Boolean).map(p => '*' + escMd(p) + '*').join(' › ');
}

function formatDate(dateStr) {
  if (!dateStr) return 'غير معروف';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'غير معروف';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch (e) { return 'غير معروف'; }
}

async function eos(ctx, text, extra = {}) {
  const msg = ctx.callbackQuery?.message;
  if (msg) {
    try {
      return await ctx.editMessageText(text, extra);
    } catch (e) {
      if (e.description?.includes('message is not modified')) return;
      if (e.description?.includes('no text in the message')) {
        try { return await ctx.editMessageCaption(text, extra); } catch(_) {}
      }
      try { return await ctx.reply(text, extra); } catch(_) {}
    }
  }
  return ctx.reply(text, extra).catch(() => {});
}

async function quickAck(ctx, text = '') {
  return ctx.answerCbQuery(text, { show_alert: false }).catch(() => {});
}

async function showTyping(ctx) {
  return ctx.sendChatAction('typing').catch(() => {});
}

module.exports = { escMd, buildPath, eos, formatDate, quickAck, showTyping };
