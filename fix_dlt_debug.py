with open('index.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = """  const stored = global._botMsgs?.[ctx.chat.id] || [];
  let deleted = 0;
  for(const msgId of stored){
    try{ await ctx.telegram.deleteMessage(ctx.chat.id, msgId); deleted++; }catch(e){}
  }
  if(global._botMsgs) global._botMsgs[ctx.chat.id] = [];
  const m = await ctx.reply('✅ حُذف '+deleted+' رسالة');
  setTimeout(()=>ctx.deleteMessage(m.message_id).catch(()=>{}), 3000);"""

new = """  const stored = global._botMsgs?.[ctx.chat.id] || [];
  let deleted = 0;
  console.log('DLT debug — chat:', ctx.chat.id, 'stored:', stored.length, 'ids:', stored);
  for(const msgId of stored){
    try{ await ctx.telegram.deleteMessage(ctx.chat.id, msgId); deleted++; }catch(e){ console.log('del err:', msgId, e.message); }
  }
  if(global._botMsgs) global._botMsgs[ctx.chat.id] = [];
  const m = await ctx.reply('✅ حُذف '+deleted+' رسالة — كان عندي '+stored.length+' محفوظة');
  setTimeout(()=>ctx.deleteMessage(m.message_id).catch(()=>{}), 3000);"""

if old in content:
    content = content.replace(old, new)
    with open('index.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Fixed")
else:
    print("❌ Not found")
