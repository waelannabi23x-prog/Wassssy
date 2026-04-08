const escMd = t => (t||'').replace(/[*_`\[\]()~>#+=|{}.!\-]/g,'\\$&');

function buildPath(parts) {
  return parts.filter(Boolean).map(p=>'*'+escMd(p)+'*').join(' › ');
}

// eos - edit or send مع retry تلقائي
async function eos(ctx, text, extra={}) {
  const msg = ctx.callbackQuery?.message;
  if(msg) {
    try {
      if(msg.text !== text || JSON.stringify(msg.reply_markup) !== JSON.stringify(extra.reply_markup)) {
        return await ctx.editMessageText(text, extra);
      }
      return;
    } catch(e) {
      if(e.description?.includes('message is not modified')) return;
      if(e.description?.includes('Too Many Requests')) {
        const wait = (e.parameters?.retry_after||3)*1000;
        await new Promise(r=>setTimeout(r,wait));
        return eos(ctx,text,extra);
      }
      // fallback: send new
      return ctx.reply(text, extra).catch(()=>{});
    }
  }
  return ctx.reply(text, extra).catch(e=>{
    if(e.description?.includes('Too Many Requests')) {
      const wait = (e.parameters?.retry_after||3)*1000;
      return new Promise(r=>setTimeout(r,wait)).then(()=>ctx.reply(text,extra));
    }
  });
}

module.exports = { escMd, buildPath, eos };
