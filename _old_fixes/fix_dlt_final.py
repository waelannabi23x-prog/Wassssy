with open('index.js', 'r', encoding='utf-8') as f:
    content = f.read()

# استبدل tracking في grp_dl
old = """        if(sentMsg?.message_id) {
          if(!global._botMsgs) global._botMsgs = {};
          if(!global._botMsgs[ctx.chat.id]) global._botMsgs[ctx.chat.id] = [];
          global._botMsgs[ctx.chat.id].push(sentMsg.message_id);
          if(global._botMsgs[ctx.chat.id].length > 500) global._botMsgs[ctx.chat.id].shift();
        }"""

new = """        if(sentMsg?.message_id) {
          if(!global._botMsgs) global._botMsgs = {};
          if(!global._botMsgs[ctx.chat.id]) global._botMsgs[ctx.chat.id] = [];
          global._botMsgs[ctx.chat.id].push(sentMsg.message_id);
          if(global._botMsgs[ctx.chat.id].length > 500) global._botMsgs[ctx.chat.id].shift();
          // حفظ في DB للـ persistence
          dbRun('INSERT INTO group_bot_msgs(chat_id,message_id) VALUES($1,$2)',[ctx.chat.id, sentMsg.message_id]).catch(()=>{});
        }"""

# استبدل /dlt ليجيب من DB
old2 = """  const stored = global._botMsgs?.[ctx.chat.id] || [];
  let deleted = 0;
  console.log('DLT debug — chat:', ctx.chat.id, 'stored:', stored.length, 'ids:', stored);
  for(const msgId of stored){
    try{ await ctx.telegram.deleteMessage(ctx.chat.id, msgId); deleted++; }catch(e){ console.log('del err:', msgId, e.message); }
  }
  if(global._botMsgs) global._botMsgs[ctx.chat.id] = [];
  const m = await ctx.reply('✅ حُذف '+deleted+' رسالة — كان عندي '+stored.length+' محفوظة');
  setTimeout(()=>ctx.deleteMessage(m.message_id).catch(()=>{}), 3000);"""

new2 = """  // جيب من DB + الذاكرة معاً
  const dbMsgs = await dbAll('SELECT message_id FROM group_bot_msgs WHERE chat_id=$1 ORDER BY sent_at DESC LIMIT 200',[ctx.chat.id]);
  const dbIds = dbMsgs.map(r => r.message_id);
  const memIds = global._botMsgs?.[ctx.chat.id] || [];
  const allIds = [...new Set([...dbIds, ...memIds])];
  let deleted = 0;
  for(const msgId of allIds){
    try{ await ctx.telegram.deleteMessage(ctx.chat.id, msgId); deleted++; }catch(e){}
  }
  // نظف بعد الحذف
  if(global._botMsgs) global._botMsgs[ctx.chat.id] = [];
  dbRun('DELETE FROM group_bot_msgs WHERE chat_id=$1',[ctx.chat.id]).catch(()=>{});
  const m = await ctx.reply('✅ حُذف '+deleted+' رسالة');
  setTimeout(()=>ctx.deleteMessage(m.message_id).catch(()=>{}), 3000);"""

if old in content and old2 in content:
    content = content.replace(old, new)
    content = content.replace(old2, new2)
    with open('index.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Fixed")
else:
    print("❌ Not found")
    if old not in content: print("  - grp_dl tracking not matched")
    if old2 not in content: print("  - dlt command not matched")
