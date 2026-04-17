with open('index.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = """// ── Duplicate Callback Guard ──
const _cbSeen = new Map();
function isDupeCB(cbId) {
  if (_cbSeen.has(cbId)) return true;
  _cbSeen.set(cbId, Date.now());
  if (_cbSeen.size > 500) {
    const cutoff = Date.now() - 30000;
    for (const [k, v] of _cbSeen) if (v < cutoff) _cbSeen.delete(k);
  }
  return false;
}"""

new = """// ── Duplicate Callback Guard ──
const _cbSeen = new Map();
function isDupeCB(cbId) {
  if (_cbSeen.has(cbId)) return true;
  _cbSeen.set(cbId, Date.now());
  if (_cbSeen.size > 200) {
    const cutoff = Date.now() - 15000;
    for (const [k, v] of _cbSeen) if (v < cutoff) _cbSeen.delete(k);
  }
  return false;
}

// ── In-flight dedup — منع query مزدوجة لنفس المستخدم ──
const _inFlight = new Map();
function dedupRequest(uid, key, fn) {
  const k = uid+'_'+key;
  if (_inFlight.has(k)) return _inFlight.get(k);
  const p = fn().finally(() => _inFlight.delete(k));
  _inFlight.set(k, p);
  return p;
}
global.dedupRequest = dedupRequest;"""

if old in content:
    content = content.replace(old, new)
    with open('index.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Fixed")
else:
    print("❌ Not found")
