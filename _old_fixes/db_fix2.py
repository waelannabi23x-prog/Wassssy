with open('database/db.js', 'r') as f:
    content = f.read()

old = """
async function withRetry(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (e) {
      const retry = e.message?.includes('timeout') || e.message?.includes('terminated');
      if (!retry || i === retries - 1) throw e;
      const wait = 500 * Math.pow(2, i);
      console.warn(`⚠️ DB retry ${i+1}/${retries} in ${wait}ms:`, e.message);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}"""

if old in content:
    content = content.replace(old, '')
    with open('database/db.js', 'w') as f:
        f.write(content)
    print("✅ Duplicate removed")
else:
    print("❌ Not found")
