'use strict';
const fs = require('fs');
let d = fs.readFileSync('index.js','utf8');

// 1. Allow /new /top in groups
d = d.replace(
  "['/search', '/setsp', '/dlt', '/done', '/cancel']",
  "['/search', '/setsp', '/dlt', '/done', '/cancel', '/new', '/top']"
);

// 2. Forward+Path — forwarded doc handler
const oldDoc = `bot.on('document', async ctx => {
  if (!ctx.isAdmin && !ctx.isOwner) return;
  const s = global.getState(ctx.uid);
  if (await tools.trySmartUpload(ctx)) return;`;
const newDoc = `bot.on('document', async ctx => {
  if (!ctx.isAdmin && !ctx.isOwner) return;
  const s = global.getState(ctx.uid);
  if (ctx.isOwner) {
    const isFwd = !!(ctx.message.forward_from || ctx.message.forward_from_chat || ctx.message.forward_sender_name);
    const hasCap = !!(ctx.message.caption && /تخصص:|سنة:|spec:|year:|sem:|mat:|cat:/i.test(ctx.message.caption));
    if (isFwd && !hasCap && !s) {
      await global.setState(ctx.uid, { type: 'pending_forward', doc: ctx.message.document, photo: null });
      await ctx.reply('📎 ملف محفوظ! أرسل المسار:\n\`تخصص: X | سنة: X | فصل: X | مادة: X | قسم: X\`', { parse_mode: 'Markdown' }).catch(()=>{});
      return;
    }
  }
  if (await tools.trySmartUpload(ctx)) return;`;
if (d.includes(oldDoc)) { d = d.replace(oldDoc, newDoc); console.log('✅ forward+path doc'); }
else console.log('⚠️ forward doc not found');

// 3. Forward+Path — text handler
const oldTxt = "  if (s.type === 'search') return userH.handleSearch(ctx, txt);";
const newTxt = `  if (s?.type === 'pending_forward' && ctx.isOwner) {
    const pTrig = /تخصص:|سنة:|فصل:|مادة:|قسم:|spec:|year:|sem:|mat:|cat:/i;
    if (pTrig.test(txt)) {
      const sv = s; await global.delState(ctx.uid);
      const fCtx = Object.assign({}, ctx, { message: Object.assign({}, ctx.message, { document: sv.doc, photo: sv.photo, caption: txt }) });
      if (await tools.trySmartUpload(fCtx)) return;
    }
  }
  if (s.type === 'search') return userH.handleSearch(ctx, txt);`;
if (d.includes(oldTxt)) { d = d.replace(oldTxt, newTxt); console.log('✅ forward+path txt'); }
else console.log('⚠️ forward txt not found');

// 4. Comment notify owner
const oldCmt = "    await ctx.reply('✅ تم إضافة تعليقك!').catch(() => {}); return browse.showComments(ctx, s.fid, s.spId, s.yrId, s.smId, s.sbId, s.catId);";
const newCmt = `    await ctx.reply('✅ تم إضافة تعليقك!').catch(() => {});
    try{const _cf=await filesDb.getFile(s.fid);if(_cf)ctx.telegram.sendMessage(OWNER_ID,'💬 *تعليق جديد*\\n📄 '+_cf.title+'\\n👤 '+(ctx.from.first_name||'')+'\\n\\n'+txt.substring(0,300),{parse_mode:'Markdown'}).catch(()=>{});}catch(_){}
    return browse.showComments(ctx, s.fid, s.spId, s.yrId, s.smId, s.sbId, s.catId);`;
if (d.includes(oldCmt)) { d = d.replace(oldCmt, newCmt); console.log('✅ comment notify'); }
else console.log('⚠️ comment not found');

// 5. /new command
const newCmdBlock = `bot.command('new', async ctx => {
  if (ctx.chat?.type === 'private') return;
  await ctx.deleteMessage().catch(()=>{});
  try {
    const gc = await dbAll('SELECT specialty_id FROM group_chats WHERE chat_id=$1',[ctx.chat.id]);
    const spId = gc[0]?.specialty_id;
    if (!spId || spId==0) { const m=await ctx.reply('⚠️ حدد تخصص القروب أولاً: /setsp').catch(()=>{}); if(m)setTimeout(()=>ctx.deleteMessage(m.message_id).catch(()=>{}),7000); return; }
    const files = await dbAll('SELECT f.id,f.title,f.downloads,s.name as sub_name FROM files f JOIN categories c ON f.category_id=c.id JOIN subjects s ON c.subject_id=s.id JOIN semesters sm ON s.semester_id=sm.id JOIN years y ON sm.year_id=y.id WHERE y.specialty_id=$1 AND f.is_deleted=0 ORDER BY f.uploaded_at DESC LIMIT 8',[spId]);
    if (!files.length) { const m=await ctx.reply('📭 لا توجد ملفات جديدة.').catch(()=>{}); if(m)setTimeout(()=>ctx.deleteMessage(m.message_id).catch(()=>{}),7000); return; }
    const un = await botUn(ctx);
    const rows = files.map(f=>{ const lbl='🆕 '+f.title.substring(0,35)+(f.sub_name?' · '+f.sub_name.substring(0,12):''); return un?[{text:lbl,url:'https://t.me/'+un+'?start=file_'+f.id}]:[{text:lbl,callback_data:'grp_dl_'+f.id}]; });
    if (un) rows.push([{text:'🤖 فتح البوت',url:'https://t.me/'+un}]);
    const m = await ctx.reply('🆕 *آخر الملفات في تخصصك:*',{parse_mode:'Markdown',reply_markup:{inline_keyboard:rows}}).catch(()=>{});
    if (m) { GrpMsgs.add(ctx.chat.id,m.message_id); setTimeout(()=>ctx.deleteMessage(m.message_id).catch(()=>{}),90000); }
  } catch(e) { logger.error('[/new]',e.message); }
});
bot.command('top', async ctx => {
  if (ctx.chat?.type === 'private') return;
  await ctx.deleteMessage().catch(()=>{});
  try {
    const gc = await dbAll('SELECT specialty_id FROM group_chats WHERE chat_id=$1',[ctx.chat.id]);
    const spId = gc[0]?.specialty_id;
    if (!spId || spId==0) { const m=await ctx.reply('⚠️ حدد تخصص القروب أولاً: /setsp').catch(()=>{}); if(m)setTimeout(()=>ctx.deleteMessage(m.message_id).catch(()=>{}),7000); return; }
    const files = await dbAll('SELECT f.id,f.title,f.downloads,s.name as sub_name FROM files f JOIN categories c ON f.category_id=c.id JOIN subjects s ON c.subject_id=s.id JOIN semesters sm ON s.semester_id=sm.id JOIN years y ON sm.year_id=y.id WHERE y.specialty_id=$1 AND f.is_deleted=0 ORDER BY f.downloads DESC LIMIT 8',[spId]);
    if (!files.length) { const m=await ctx.reply('📭 لا توجد ملفات.').catch(()=>{}); if(m)setTimeout(()=>ctx.deleteMessage(m.message_id).catch(()=>{}),7000); return; }
    const un = await botUn(ctx);
    const rows = files.map(f=>{ const lbl='🏆 '+f.title.substring(0,30)+(f.sub_name?' · '+f.sub_name.substring(0,12):'')+(f.downloads?' ('+f.downloads+')':''); return un?[{text:lbl,url:'https://t.me/'+un+'?start=file_'+f.id}]:[{text:lbl,callback_data:'grp_dl_'+f.id}]; });
    if (un) rows.push([{text:'🤖 فتح البوت',url:'https://t.me/'+un}]);
    const m = await ctx.reply('🏆 *الأكثر تحميلاً في تخصصك:*',{parse_mode:'Markdown',reply_markup:{inline_keyboard:rows}}).catch(()=>{});
    if (m) { GrpMsgs.add(ctx.chat.id,m.message_id); setTimeout(()=>ctx.deleteMessage(m.message_id).catch(()=>{}),90000); }
  } catch(e) { logger.error('[/top]',e.message); }
});`;

const helpAnchor = "bot.command('help', ctx => ctx.reply(";
if (d.includes(helpAnchor)) { d = d.replace(helpAnchor, newCmdBlock + '\n' + helpAnchor); console.log('✅ /new + /top'); }
else console.log('⚠️ help anchor not found');

// 6. clear_my_history callback
const aiResetLine = "  ['ai_reset', ctx => { const { resetChat } = require('./handlers/ai_chat'); resetChat(ctx.uid); return ctx.reply('🔄 تم مسح سياق المحادثة.').catch(() => {}); }],";
const clearHistLine = aiResetLine + `
  ['clear_my_history', async ctx => {
    const { run: _dhr } = require('./database/db');
    await _dhr('DELETE FROM history WHERE user_id=$1',[ctx.uid]).catch(()=>{});
    cacheClear('lastfile_'+ctx.uid); cacheClear('rec_'+ctx.uid);
    return ctx.answerCbQuery('✅ تم مسح سجلك',{show_alert:true}).catch(()=>{});
  }],`;
if (d.includes(aiResetLine)) { d = d.replace(aiResetLine, clearHistLine); console.log('✅ clear_my_history'); }
else console.log('⚠️ aiReset not found');

// 7. Inline Search
const sigintLine = "process.once('SIGINT', () => shutdown('SIGINT'));";
const inlineSearch = `// ✨ Inline Search @BotName algo 2
bot.on('inline_query', async ctx => {
  const q=(ctx.inlineQuery?.query||'').trim();
  if(q.length<2) return ctx.answerInlineQuery([],{cache_time:5});
  try{
    const res=await smartSearch(q,10);
    const un=_botUn||'';
    const items=res.slice(0,10).map(f=>({
      type:'article',id:String(f.id),title:f.title,
      description:(f.sub_name||'')+(f.downloads?' · '+f.downloads+' تحميل':''),
      input_message_content:{message_text:un?'['+f.title+'](https://t.me/'+un+'?start=file_'+f.id+')\n'+(f.sub_name||''):'📄 '+f.title,parse_mode:'Markdown'},
      ...(un?{reply_markup:{inline_keyboard:[[{text:'⬇️ تحميل',url:'https://t.me/'+un+'?start=file_'+f.id}]]}}:{}),
    }));
    await ctx.answerInlineQuery(items,{cache_time:30});
  }catch(e){await ctx.answerInlineQuery([],{cache_time:5});}
});
` + sigintLine;
if (d.includes(sigintLine)) { d = d.replace(sigintLine, inlineSearch); console.log('✅ inline search'); }
else console.log('⚠️ sigint not found');

// 8. Allowed updates
d = d.replace(
  "allowed_updates: ['message', 'callback_query', 'my_chat_member'], drop_pending_updates",
  "allowed_updates: ['message', 'callback_query', 'my_chat_member', 'inline_query'], drop_pending_updates"
);
console.log('✅ inline_query in allowed_updates');

fs.writeFileSync('index.js', d);
require('child_process').execSync('node --check index.js');
console.log('\n🎉 index.js done!');
