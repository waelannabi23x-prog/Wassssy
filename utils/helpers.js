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

const MAX_RETRIES = 3;

async function eos(ctx, text, extra = {}) {
  const msg = ctx.callbackQuery?.message;
  if (msg) {
    let retries = 0;
    while (retries < MAX_RETRIES) {
      try {
        return await ctx.editMessageText(text, extra);
      } catch (e) {
        if (e.description?.includes('message is not modified')) return;
        if (e.description?.includes('Too Many Requests')) {
          retries++;
          if (retries >= MAX_RETRIES) return ctx.reply(text, extra).catch(() => {});
          const wait = (e.parameters?.retry_after || 3) * 1000;
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        if (e.description?.includes('message to edit not found') ||
            e.description?.includes('MESSAGE_ID_INVALID')) {
          return ctx.reply(text, extra).catch(() => {});
        }
        return ctx.reply(text, extra).catch(() => {});
      }
    }
  }
  return ctx.reply(text, extra).catch(e => {
    if (e.description?.includes('Too Many Requests')) {
      const wait = (e.parameters?.retry_after || 3) * 1000;
      return new Promise(r => setTimeout(r, wait)).then(() => ctx.reply(text, extra));
    }
  });
}

async function quickAck(ctx, text = '') {
  return ctx.answerCbQuery(text, { show_alert: false }).catch(() => {});
}

async function showTyping(ctx) {
  return ctx.sendChatAction('typing').catch(() => {});
}

module.exports = { escMd, buildPath, eos, formatDate, quickAck, showTyping };
