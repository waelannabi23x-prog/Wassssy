with open('handlers/start.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = "      const cap = '📄 *'+escMd(f.title)+'*\n'+(f.description?'📝 '+escMd(f.description)+'\n':'')+'📁 '+escMd(f.cat_name)+' | 📖 '+escMd(f.sub_name);"
new = "      const cap = '📄 *'+escMd(f.title)+'*\\n'+(f.description?'📝 '+escMd(f.description)+'\\n':'')+'📁 '+escMd(f.cat_name)+' | 📖 '+escMd(f.sub_name);"

if old in content:
    content = content.replace(old, new)
    with open('handlers/start.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Fixed")
else:
    print("❌ Not found — trying direct fix")
    # direct fix
    import re
    content = re.sub(
        r"const cap = '📄 \*'\+escMd\(f\.title\)\+'.*?escMd\(f\.sub_name\);",
        "const cap = '📄 *'+escMd(f.title)+'*\\\\n'+(f.description?'📝 '+escMd(f.description)+'\\\\n':'')+'📁 '+escMd(f.cat_name)+' | 📖 '+escMd(f.sub_name);",
        content, flags=re.DOTALL
    )
    with open('handlers/start.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Direct fix applied")
