with open('index.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = """        if(f.file_type === 'photo') await ctx.telegram.sendPhoto(ctx.chat.id, f.file_id, {caption:cap});
        if(f.file_type === 'photo') sentMsg = await ctx.telegram.sendPhoto(ctx.chat.id, f.file_id, {caption:cap});"""

new = """        let sentMsg;
        if(f.file_type === 'photo') sentMsg = await ctx.telegram.sendPhoto(ctx.chat.id, f.file_id, {caption:cap});"""

if old in content:
    content = content.replace(old, new)
    with open('index.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Fixed")
else:
    print("❌ Not found")
