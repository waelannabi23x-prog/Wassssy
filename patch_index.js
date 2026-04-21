'use strict';
const fs=require('fs');
const src=fs.readFileSync('index.js','utf8');
const lines=src.split('\n');
let startLine=-1,endLine=-1;
for(let i=0;i<lines.length;i++){
  if(lines[i].includes("bot.command('search', async ctx => {"))startLine=i;
  if(startLine!==-1&&i>startLine&&lines[i].includes("bot.command('profile',"))endLine=i;
}
if(startLine===-1||endLine===-1){console.error('Not found: start='+startLine+' end='+endLine);process.exit(1);}
const H=[
"bot.command('search', async ctx => {",
"  const isGrp = ctx.chat && ctx.chat.type !== 'private';",
"  const raw   = ctx.message.text.replace('/search', '').replace(/@\\w+/g, '').trim();",
"  if (isGrp) {",
"    await ctx.deleteMessage().catch(function(){});",
"    const q = (raw || '').slice(0, 80);",
"    if (!q || q.length < 2) {",
"      const m = await ctx.reply('\\u{1F50D} \\u0645\\u062B\\u0627\\u0644: /search algo 2  \\u00B7  serie 1  \\u00B7  td analyse').catch(function(){});",
"      if (m) setTimeout(function(){ ctx.deleteMessage(m.message_id).catch(function(){}); }, 7000);",
"      return;",
"    }",
"    let loadMsg = null;",
"    try { loadMsg = await ctx.reply('\\u{1F50D} \\u062C\\u0627\\u0631\\u064A \\u0627\\u0644\\u0628\\u062D\\u062B...'); } catch(_) {}",
"    try {",
"      const [res, un] = await Promise.all([smartSearch(q, 12), botUn(ctx)]);",
"      if (!res || !res.length) {",
"        if (loadMsg) ctx.deleteMessage(loadMsg.message_id).catch(function(){});",
"        const m = await ctx.reply('\\u274C \\u0644\\u0627 \\u0646\\u062A\\u0627\\u0626\\u062C \\u0644\\u0640 \"' + q + '\"\\n\\u{1F4A1} \\u062C\\u0631\\u0628: algo \\u00B7 serie \\u00B7 td \\u00B7 exam').catch(function(){});",
"        if (m) setTimeout(function(){ ctx.deleteMessage(m.message_id).catch(function(){}); }, 10000);",
"        return;",
"      }",
"      const rows = res.map(function(f) {",
"        const label = '\\u{1F4C4} ' + f.title.substring(0, 35) + (f.sub_name ? ' \\u00B7 ' + f.sub_name.substring(0, 15) : '');",
"        return un ? [{ text: label, url: 'https://t.me/' + un + '?start=file_' + f.id }] : [{ text: label, callback_data: 'grp_dl_' + f.id }];",
"      });",
"      if (un) rows.push([{ text: '\\u{1F916} \\u0641\\u062A\\u062D \\u0627\\u0644\\u0628\\u0648\\u062A \\u0644\\u0644\\u062A\\u062D\\u0645\\u064A\\u0644', url: 'https://t.me/' + un }]);",
"      const rTxt = '\\u{1F50D} *' + q + '* \\u2014 ' + res.length + ' \\u0646\\u062A\\u064A\\u062C\\u0629\\n_\\u0627\\u0636\\u063A\\u0637 \\u0639\\u0644\\u0649 \\u0627\\u0644\\u0645\\u0644\\u0641 \\u0644\\u0644\\u062A\\u062D\\u0645\\u064A\\u0644_ \\u{1F447}';",
"      let resultMsg = null;",
"      if (loadMsg) {",
"        try {",
"          resultMsg = await ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null, rTxt, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows } });",
"        } catch(_) {",
"          ctx.deleteMessage(loadMsg.message_id).catch(function(){});",
"          resultMsg = await ctx.reply(rTxt, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows } }).catch(function(){});",
"        }",
"      } else {",
"        resultMsg = await ctx.reply(rTxt, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows } }).catch(function(){});",
"      }",
"      const msgId = (resultMsg && resultMsg.message_id) || (loadMsg && loadMsg.message_id);",
"      if (msgId) { GrpMsgs.add(ctx.chat.id, msgId); setTimeout(function(){ ctx.deleteMessage(msgId).catch(function(){}); }, 90000); }",
"    } catch(e) {",
"      logger.error('[search grp]', e.message);",
"      if (loadMsg) ctx.deleteMessage(loadMsg.message_id).catch(function(){});",
"    }",
"    return;",
"  }",
"  if (raw) return userH.handleSearch(ctx, raw);",
"  await global.setState(ctx.uid, { type: 'search' });",
"  return ctx.reply('\\u{1F50D} \\u0627\\u0643\\u062A\\u0628 \\u0643\\u0644\\u0645\\u0629 \\u0627\\u0644\\u0628\\u062D\\u062B:').catch(function(){});",
"});",
""
];
const result=[...lines.slice(0,startLine),...H,...lines.slice(endLine)].join('\n');
fs.writeFileSync('index.js',result);
console.log('Done. Lines replaced: '+startLine+' to '+endLine);
