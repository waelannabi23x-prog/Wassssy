with open('utils/precompute.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = "  for(const sp of specs) {"
new = "  await Promise.all(specs.map(async sp => {"

old2 = "    for(const yr of years) {"
new2 = "    await Promise.all(years.map(async yr => {"

old3 = "      for(const sm of sems) {"
new3 = "      await Promise.all(sems.map(async sm => {"

old4 = "        for(const sb of subs) {"
new4 = "        await Promise.all(subs.map(async sb => {"

old5 = "          for(const cat of cats) {"
new5 = "          await Promise.all(cats.map(async cat => {"

# اغلاق الـ loops - نستبدل الـ closing brackets
old6 = "        }\n      }\n    }\n  }\n  console.log"
new6 = "        }));\n      }));\n    }));\n  }));\n  console.log"

if old in content:
    content = content.replace(old, new, 1)
    content = content.replace(old2, new2, 1)
    content = content.replace(old3, new3, 1)
    content = content.replace(old4, new4, 1)
    content = content.replace(old5, new5, 1)
    content = content.replace(old6, new6, 1)
    with open('utils/precompute.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Fixed")
else:
    print("❌ Not found")
