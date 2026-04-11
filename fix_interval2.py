with open('database/interactions.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = """  const rows=await all(`SELECT id FROM users WHERE is_banned=0 AND last_active >= NOW() - INTERVAL '${parseInt(days)} days'`);"""

new = """  const rows=await all(`SELECT id FROM users WHERE is_banned=0 AND last_active >= NOW() - (parseInt(days) || ' days')::interval`);"""

if old in content:
    content = content.replace(old, new)
    with open('database/interactions.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Fixed")
else:
    print("❌ Not found")
