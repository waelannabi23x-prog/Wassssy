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
      console.error('eos edit failed:', e.message, e.description?.substring(0, 100));
      try {
        return await ctx.reply(text, extra);
      } catch (e2) {
        console.error('eos reply failed:', e2.message, e2.description?.substring(0, 100));
      }
    }
  }
  return ctx.reply(text, extra).catch(e => {
    console.error('eos final failed:', e.message);
  });
}

async function quickAck(ctx, text = '') {
  return ctx.answerCbQuery(text, { show_alert: false }).catch(() => {});
}

async function showTyping(ctx) {
  return ctx.sendChatAction('typing').catch(() => {});
}

module.exports = { escMd, buildPath, eos, formatDate, quickAck, showTyping };
