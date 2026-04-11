with open('index.js', 'r') as f:
    content = f.read()

old = """    const extras = new Map();
    const wordResults = await Promise.all(words.map(async w => {
      const wr = _getGSC(w) || await filesDb.search(w, limit);
      _setGSC(w, wr);
      return { w, wr };
    }));
    for(const { w, wr } of wordResults) {
      for(const r of wr) {
        if(!results.find(x=>x.id===r.id)) extras.set(r.id, r);
      }
    }"""

new = """    const extras = new Map();
    const existingIds = new Set(results.map(x => x.id));
    const wordResults = await Promise.all(words.map(async w => {
      const wr = _getGSC(w) || await filesDb.search(w, limit);
      _setGSC(w, wr);
      return { w, wr };
    }));
    for(const { w, wr } of wordResults) {
      for(const r of wr) {
        if(!existingIds.has(r.id)) { extras.set(r.id, r); existingIds.add(r.id); }
      }
    }"""

if old in content:
    content = content.replace(old, new)
    with open('index.js', 'w') as f:
        f.write(content)
    print("✅ Fixed O(n²) → O(1)")
else:
    print("❌ Not found")
