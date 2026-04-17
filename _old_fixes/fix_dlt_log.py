with open('index.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = """  const dbMsgs = await dbAll('SELECT message_id FROM group_bot_msgs WHERE chat_id=$1 ORDER BY sent_at DESC LIMIT 200',[ctx.chat.id]);
  const dbIds = dbMsgs.map(r => r.message_id);
  const memIds = global._botMsgs?.[ctx.chat.id] || [];
  const allIds = [...new Set([...dbIds, ...memIds])];"""

new = """  const dbMsgs = await dbAll('SELECT message_id FROM group_bot_msgs WHERE chat_id=$1 ORDER BY sent_at DESC LIMIT 200',[ctx.chat.id]);
  const dbIds = dbMsgs.map(r => r.message_id);
  const memIds = global._botMsgs?.[ctx.chat.id] || [];
  const allIds = [...new Set([...dbIds, ...memIds])];
  console.log('DLT — chat_id:', ctx.chat.id, 'db:', dbIds.length, 'mem:', memIds.length, 'total:', allIds.length);"""

if old in content:
    content = content.replace(old, new)
    with open('index.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Fixed")
else:
    print("❌ Not found")
