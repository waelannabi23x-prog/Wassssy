with open('handlers/start.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = "  const payload = ctx.message?.text?.split(' ')[1] || null;"
new = "  const rawText = ctx.message?.text || '';\n  const payload = rawText.includes(' ') ? rawText.split(' ')[1] : ctx.startPayload || null;"

if old in content:
    content = content.replace(old, new)
    with open('handlers/start.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Fixed")
else:
    print("❌ Not found")
