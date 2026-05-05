f = open('handlers/group_admin.js', 'r')
c = f.read()
f.close()

old = """    const defaultMsg =
'❋═══════════════════❋\\n' +
'🎉 نورت قروبنا يـ *' + name + '*\\n' +
'❋═══════════════════❋\\n\\n' +
'° : اسمك  ⟸  『' + name + '』\\n' +
'° : ايديك  ⟸  『' + userId + '』\\n' +
(specName ? '° : تخصصك  ⟸  『' + specName + '』\\n' : '') +
'\\n┌─────────────────┐\\n' +
'° : تاريخ انضمامك 🗓  :  ' + joinDate + '\\n' +
'° : الساعة 🕐  :  ' + joinTime + '\\n' +
'└─────────────────┘\\n\\n' +
'❋═══════════════════❋';"""

new = """    const defaultMsg =
'❋═══════════════════❋\\n' +
'🎉 نورت قروبنا يـ [' + name + '](tg://user?id=' + userId + ')\\n' +
'❋═══════════════════❋\\n\\n' +
'° : اسمك  ⟸  『' + name + '』\\n' +
'° : ايديك  ⟸  ||' + userId + '||\\n' +
'\\n┌─────────────────┐\\n' +
'° : تاريخ انضمامك 🗓  :  ' + joinDate + '\\n' +
'° : الساعة 🕐  :  ' + joinTime + '\\n' +
'└─────────────────┘\\n\\n' +
'❋═══════════════════❋';"""

if old in c:
    c = c.replace(old, new, 1)
    open('handlers/group_admin.js', 'w').write(c)
    print('OK')
else:
    print('NOT FOUND')

f = open('handlers/group_admin.js', 'r')
c = f.read()
f.close()

old = "parse_mode: 'Markdown'\n      }).catch(e => console.error('[Welcome Photo]'"
new = "parse_mode: 'MarkdownV2'\n      }).catch(e => console.error('[Welcome Photo]'"
c = c.replace(old, new, 1)

old2 = "{ parse_mode: 'Markdown' }).catch(e => {\n        console.error('[Welcome]'"
new2 = "{ parse_mode: 'MarkdownV2' }).catch(e => {\n        console.error('[Welcome]'"
c = c.replace(old2, new2, 1)

open('handlers/group_admin.js', 'w').write(c)
print('parse_mode OK')
