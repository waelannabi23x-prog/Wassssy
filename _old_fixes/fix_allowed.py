with open('index.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = "    const allowed = text.startsWith('/search') || text.startsWith('/setsp');"
new = "    const allowed = text.startsWith('/search') || text.startsWith('/setsp') || text.startsWith('/dlt');"

if old in content:
    content = content.replace(old, new)
    with open('index.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Fixed")
else:
    print("❌ Not found")
