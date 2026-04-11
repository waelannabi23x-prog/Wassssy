with open('database/db.js', 'r', encoding='utf-8') as f:
    content = f.read()

# اضف جدول group_bot_msgs
old = "    `CREATE TABLE IF NOT EXISTS cache_store (key TEXT PRIMARY KEY, value TEXT, expires_at BIGINT)`,"
new = """    `CREATE TABLE IF NOT EXISTS cache_store (key TEXT PRIMARY KEY, value TEXT, expires_at BIGINT)`,
    `CREATE TABLE IF NOT EXISTS group_bot_msgs (id SERIAL PRIMARY KEY, chat_id BIGINT NOT NULL, message_id BIGINT NOT NULL, sent_at TIMESTAMP DEFAULT NOW())`,"""

if old in content:
    content = content.replace(old, new)
    with open('database/db.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ db.js Fixed")
else:
    print("❌ Not found in db.js")
