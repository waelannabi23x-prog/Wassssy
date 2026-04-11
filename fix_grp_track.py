with open('index.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    new_lines.append(line)
    if 'else await ctx.telegram.sendDocument(ctx.chat.id, f.file_id, {caption:cap});' in line:
        # استبدل السطور الثلاثة بنسخة تحفظ الـ message_id
        new_lines.pop()  # احذف السطر الحالي
        new_lines.append('        let sentMsg;\n')
        new_lines.append('        if(f.file_type === \'photo\') sentMsg = await ctx.telegram.sendPhoto(ctx.chat.id, f.file_id, {caption:cap});\n')
        new_lines.append('        else if(f.file_type === \'link\') sentMsg = await ctx.telegram.sendMessage(ctx.chat.id, cap+\'\\n🔗 \'+f.file_id);\n')
        new_lines.append('        else sentMsg = await ctx.telegram.sendDocument(ctx.chat.id, f.file_id, {caption:cap});\n')
        new_lines.append('        if(sentMsg?.message_id) {\n')
        new_lines.append('          if(!global._botMsgs) global._botMsgs = {};\n')
        new_lines.append('          if(!global._botMsgs[ctx.chat.id]) global._botMsgs[ctx.chat.id] = [];\n')
        new_lines.append('          global._botMsgs[ctx.chat.id].push(sentMsg.message_id);\n')
        new_lines.append('          if(global._botMsgs[ctx.chat.id].length > 500) global._botMsgs[ctx.chat.id].shift();\n')
        new_lines.append('        }\n')
        # احذف السطرين اللي قبله (sendPhoto و sendMessage)
        new_lines.pop(-11)
        new_lines.pop(-10)

with open('index.js', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print("✅ Fixed")
