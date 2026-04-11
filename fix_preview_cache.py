with open('handlers/browse.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = """  // البيانات الشخصية في query واحدة
  const { fav, userRating, alreadyReported } = await interactions.getPreviewPersonal(uid,fid);"""

new = """  // البيانات الشخصية مع cache
  const personalKey = 'personal_'+uid+'_'+fid;
  let personal = cacheGet(personalKey);
  if(!personal) {
    personal = await interactions.getPreviewPersonal(uid,fid);
    cacheSet(personalKey, personal, 300000);
  }
  const { fav, userRating, alreadyReported } = personal;"""

if old in content:
    content = content.replace(old, new)
    with open('handlers/browse.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Fixed")
else:
    print("❌ Not found")
