function escMarkdown(text){
  if(!text) return '';
  return text.replace(/[*_`\[\]()~>#+=|{}.!\-]/g,'\\$&');
}

function eos(ctx,text,extra){
  if(ctx.callbackQuery) return ctx.editMessageText(text,extra).catch(()=>ctx.reply(text,extra));
  return ctx.reply(text,extra);
}
function buildPath(parts){ return '📍 '+parts.filter(Boolean).map(p=>String(p).replace(/[*_`\[\]()~>#+=|{}.!\-]/g,'\\$&')).join(' › '); }
function formatDate(dt){ return new Date(dt).toLocaleDateString('en-GB'); }
module.exports={eos,buildPath,formatDate,escMarkdown};
