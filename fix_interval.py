with open('index.js', 'r') as f:
    content = f.read()

old = """    await dbRun("DELETE FROM user_states WHERE updated_at < CURRENT_TIMESTAMP - INTERVAL '1 hour'");"""

new = """    await dbRun("DELETE FROM user_states WHERE updated_at < NOW() - INTERVAL '1 hour'");"""

if old in content:
    content = content.replace(old, new)
    with open('index.js', 'w') as f:
        f.write(content)
    print("✅ Fixed")
else:
    print("❌ Not found")
