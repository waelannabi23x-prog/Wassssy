with open('database/db.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = """    pgPool.on('connect', () => {
      console.log('✅ PG new connection established');
    });"""

new = ""

if old in content:
    content = content.replace(old, new)
    with open('database/db.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Fixed")
else:
    print("❌ Not found")
