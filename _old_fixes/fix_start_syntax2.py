with open('handlers/start.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    if "else if(f.file_type==='link') await ctx.reply(cap+'" in line and line.rstrip().endswith("+'"):
        # دمج السطرين
        next_line = lines[i+1] if i+1 < len(lines) else ''
        combined = line.rstrip()[:-1] + "'\\n\\n🔗 '+f.file_id,{parse_mode:'Markdown'});\n"
        new_lines.append(combined)
        i += 2  # تخطى السطر الفارغ والتالي
    else:
        new_lines.append(line)
        i += 1

with open('handlers/start.js', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print("✅ Fixed")
