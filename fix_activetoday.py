with open('database/users.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = """const activeToday = async () => (await get(`SELECT COUNT(*) as c FROM users WHERE last_active >= NOW() - INTERVAL '1 day'::interval`))?.c||0;"""

new = """const activeToday = async () => (await get(`SELECT COUNT(*) as c FROM users WHERE last_active >= NOW() - '1 day'::interval`))?.c||0;"""

if old in content:
    content = content.replace(old, new)
    with open('database/users.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Fixed")
else:
    print("❌ Not found")
