with open('index.js', 'r') as f:
    content = f.read()

old = """const mediaGroups = {};"""

new = """const mediaGroups = {};
setInterval(() => {
  const now = Date.now();
  for (const k in mediaGroups) {
    if (mediaGroups[k]._ts && now - mediaGroups[k]._ts > 10000) {
      delete mediaGroups[k];
    }
  }
}, 30000);"""

if old in content:
    content = content.replace(old, new, 1)
    with open('index.js', 'w') as f:
        f.write(content)
    print("✅ Fixed")
else:
    print("❌ Not found")
