with open('handlers/browse.js', 'r') as f:
    content = f.read()

old = """  const fileIds = list.map(f=>f.id);
  // جلب فقط فاوريت ورتينج بدون قراءة الكاش مرتين
  const [favMap, ratingMap] = await Promise.all([
    interactions.getFavBatch(uid, fileIds),
    interactions.getRatingBatch(fileIds)
  ]);"""

new = """  const fileIds = list.map(f=>f.id);
  // ratings = static (نفس لكل الناس) | favs = personal
  const ratingKey='ratingbatch_static_'+catId+'_'+page;
  let ratingMap=cacheGet(ratingKey);
  if(!ratingMap) {
    ratingMap=await interactions.getRatingBatch(fileIds);
    cacheSet(ratingKey,ratingMap,3600000);
  }
  const favMap = await interactions.getFavBatch(uid, fileIds);"""

if old in content:
    content = content.replace(old, new)
    # زيادة TTL للـ userKey من 10 دقيقة لساعة
    content = content.replace(
        "cacheSet(userKey,{text,extra},600000);",
        "cacheSet(userKey,{text,extra},3600000);"
    )
    with open('handlers/browse.js', 'w') as f:
        f.write(content)
    print("✅ Fixed")
else:
    print("❌ Not found")
