with open('handlers/browse.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = """  const favMap = await interactions.getFavBatch(uid, fileIds);"""

new = """  const favKey='favbatch_'+uid+'_'+catId+'_'+page;
  let favMap=cacheGet(favKey);
  if(!favMap) {
    favMap=await interactions.getFavBatch(uid, fileIds);
    cacheSet(favKey,favMap,300000);
  }"""

if old in content:
    content = content.replace(old, new)
    with open('handlers/browse.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Fixed")
else:
    print("❌ Not found")
