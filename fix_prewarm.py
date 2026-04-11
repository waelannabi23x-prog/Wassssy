with open('handlers/browse.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = """  const extra={parse_mode:'Markdown',...build(rows)};
  cacheSet(userKey,{text,extra},3600000);

  // pre-warm preview cache للملفات المعروضة — في الخلفية
  setImmediate(() => {
    list.forEach(f => {
      const sk='prev_static_'+f.id;
      if(!cacheGet(sk)){
        Promise.all([
          filesDb.getFile(f.id),
          interactions.getAvgRating(f.id),
          commentsDb.countComments(f.id),
          interactions.favCount(f.id),
        ]).then(([_f,_r,_cc,_fc])=>{
          if(_f) cacheSet(sk,{f:_f,ratingData:_r,commentCount:_cc,favCnt:_fc},1800000);
        }).catch(()=>{});
      }
    });
  });

  return eos(ctx,text,extra);"""

new = """  const extra={parse_mode:'Markdown',...build(rows)};
  cacheSet(userKey,{text,extra},3600000);

  // pre-warm بالتوازي مع الرد — بدون انتظار
  Promise.all(list.map(f => {
    const sk='prev_static_'+f.id;
    if(cacheGet(sk)) return Promise.resolve();
    return Promise.all([
      filesDb.getFile(f.id),
      interactions.getAvgRating(f.id),
      commentsDb.countComments(f.id),
      interactions.favCount(f.id),
    ]).then(([_f,_r,_cc,_fc])=>{
      if(_f) cacheSet(sk,{f:_f,ratingData:_r,commentCount:_cc,favCnt:_fc},1800000);
    }).catch(()=>{});
  })).catch(()=>{});

  return eos(ctx,text,extra);"""

if old in content:
    content = content.replace(old, new)
    with open('handlers/browse.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Fixed")
else:
    print("❌ Not found")
