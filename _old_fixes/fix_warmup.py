with open('utils/cache.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = """    await Promise.all(specs.map(async sp => {
      const years = await getYears(sp.id);
      cacheSet('yrs_'+sp.id, {sp, all:years}, 3600000);

      await Promise.all(years.map(async yr => {
        const sems = await getSemesters(yr.id);
        cacheSet('sems_'+sp.id+'_'+yr.id, {sp, yr, sems}, 3600000);

        await Promise.all(sems.map(async sm => {
          const subs = await getSubjects(sm.id);
          cacheSet('subs_'+sp.id+'_'+yr.id+'_'+sm.id, {sp,yr,sm,all:subs}, 3600000);

          await Promise.all(subs.map(async sb => {
            const cats = await getCategories(sb.id);
            cacheSet('cats_'+sp.id+'_'+yr.id+'_'+sm.id+'_'+sb.id, {sp,yr,sm,sb,cats}, 3600000);
          }));
        }));
      }));
    }));"""

new = """    for(const sp of specs) {
      const years = await getYears(sp.id);
      cacheSet('yrs_'+sp.id, {sp, all:years}, 3600000);
      for(const yr of years) {
        const sems = await getSemesters(yr.id);
        cacheSet('sems_'+sp.id+'_'+yr.id, {sp, yr, sems}, 3600000);
        for(const sm of sems) {
          const subs = await getSubjects(sm.id);
          cacheSet('subs_'+sp.id+'_'+yr.id+'_'+sm.id, {sp,yr,sm,all:subs}, 3600000);
          for(const sb of subs) {
            const cats = await getCategories(sb.id);
            cacheSet('cats_'+sp.id+'_'+yr.id+'_'+sm.id+'_'+sb.id, {sp,yr,sm,sb,cats}, 3600000);
          }
        }
      }
    }"""

if old in content:
    content = content.replace(old, new)
    with open('utils/cache.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Fixed")
else:
    print("❌ Not found")
