import re

with open('index.js', 'r') as f:
    content = f.read()

old = """  if(words.length > 1) {
    const extras = new Map();
    const wordResults = await Promise.all(words.map(async w => {
      const wr = _getGSC(w) || await filesDb.search(w, limit); return { w, wr };
      _setGSC(w, wr);
      })); for(const { w, wr } of wordResults) { _setGSC(w, wr); for(const r of wr) {
        if(!results.find(x=>x.id===r.id)) extras.set(r.id, r);
      }
    }
    results = [...results, ...extras.values()].slice(0, limit);
    _setGSC(q, results);
  }"""

new = """  if(words.length > 1) {
    const extras = new Map();
    const wordResults = await Promise.all(words.map(async w => {
      const wr = _getGSC(w) || await filesDb.search(w, limit);
      _setGSC(w, wr);
      return { w, wr };
    }));
    for(const { w, wr } of wordResults) {
      for(const r of wr) {
        if(!results.find(x=>x.id===r.id)) extras.set(r.id, r);
      }
    }
    results = [...results, ...extras.values()].slice(0, limit);
    _setGSC(q, results);
  }"""

if old in content:
    content = content.replace(old, new)
    with open('index.js', 'w') as f:
        f.write(content)
    print("✅ Fixed successfully")
else:
    print("❌ Pattern not found — no changes made")
