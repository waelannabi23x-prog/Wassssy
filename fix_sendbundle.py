with open('handlers/browse.js', 'r') as f:
    content = f.read()

old = """async function sendBundle(ctx,bundleId,spId,yrId,smId,sbId,catId) {
  const [b, files] = await Promise.all([bundlesDb.getBundle(bundleId), bundlesDb.getBundleFiles(bundleId)]);"""

new = """async function sendBundle(ctx,bundleId,spId,yrId,smId,sbId,catId) {
  const bkey='bundle_full_'+bundleId;
  const bcached=cacheGet(bkey);
  const [b, files] = bcached
    ? [bcached.b, bcached.files]
    : await Promise.all([bundlesDb.getBundle(bundleId), bundlesDb.getBundleFiles(bundleId)]);
  if(!bcached && b) cacheSet(bkey,{b,files},600000);"""

if old in content:
    content = content.replace(old, new)
    with open('handlers/browse.js', 'w') as f:
        f.write(content)
    print("✅ Fixed")
else:
    print("❌ Not found")
