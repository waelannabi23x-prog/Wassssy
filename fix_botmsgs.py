with open('index.js', 'r') as f:
    content = f.read()

old = """    const m = await ctx.reply(header, {reply_markup:{inline_keyboard:rows}});
    if(!global._botMsgs) global._botMsgs = {};
    if(!global._botMsgs[ctx.chat.id]) global._botMsgs[ctx.chat.id] = [];
    global._botMsgs[ctx.chat.id].push(m.message_id);
    setTimeout(()=>ctx.deleteMessage(m.message_id).catch(()=>{}), 60000);"""

new = """    const m = await ctx.reply(header, {reply_markup:{inline_keyboard:rows}});
    if(!global._botMsgs) global._botMsgs = {};
    if(!global._botMsgs[ctx.chat.id]) global._botMsgs[ctx.chat.id] = [];
    global._botMsgs[ctx.chat.id].push(m.message_id);
    if(global._botMsgs[ctx.chat.id].length > 50) global._botMsgs[ctx.chat.id].shift();
    setTimeout(()=>ctx.deleteMessage(m.message_id).catch(()=>{}), 60000);"""

if old in content:
    content = content.replace(old, new)
    # اضف cleanup كل ساعة بعد memory monitor
    cleanup = """
// ── BotMsgs Cleanup ──
setInterval(() => {
  if(!global._botMsgs) return;
  const keys = Object.keys(global._botMsgs);
  if(keys.length > 100) {
    keys.slice(0, keys.length - 100).forEach(k => delete global._botMsgs[k]);
  }
}, 3600000);
"""
    content = content.replace("process.once('SIGINT'", cleanup + "\nprocess.once('SIGINT'")
    with open('index.js', 'w') as f:
        f.write(content)
    print("✅ Fixed")
else:
    print("❌ Not found")
