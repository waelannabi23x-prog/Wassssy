with open('index.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = """  console.log('DLT — chat_id:', ctx.chat.id, 'db:', dbIds.length, 'mem:', memIds.length, 'total:', allIds.length);"""

if old in content:
    content = content.replace(old, '')
    with open('index.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Removed")
else:
    print("❌ Not found")
