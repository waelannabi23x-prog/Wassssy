with open('handlers/start.js', 'r', encoding='utf-8') as f:
    content = f.read()

# ابحث عن البداية والنهاية
start_marker = "  // لو جاء من قروب بـ file_xxx"
end_marker = "  const hasSp = await usersDb.getSpecialty(uid);\n  if (!hasSp) return askSpecialty(ctx, name);\n  return showMainMenu(ctx, name);\n}"

new_block = """  // لو جاء من قروب بـ file_xxx
  const payload = ctx.message?.text?.split(' ')[1] || ctx.startPayload;
  if(payload?.startsWith('file_')) {
    const fid = payload.replace('file_', '');
    const filesDb = require('../database/files');
    const f = await filesDb.getFile(fid);
    if(f) {
      const cap = '📄 *' + escMd(f.title) + '*' +
        (f.description ? '\\n📝 ' + escMd(f.description) : '') +
        '\\n📁 ' + escMd(f.cat_name) + ' | 📖 ' + escMd(f.sub_name);
      try {
        if(f.file_type === 'photo') await ctx.replyWithPhoto(f.file_id, {caption: cap, parse_mode: 'Markdown'});
        else if(f.file_type === 'link') await ctx.reply(cap + '\\n\\n🔗 ' + f.file_id, {parse_mode: 'Markdown'});
        else await ctx.replyWithDocument(f.file_id, {caption: cap, parse_mode: 'Markdown'});
        const interactions = require('../database/interactions');
        interactions.addHistory(uid, fid).catch(() => {});
        filesDb.incDownloads(fid).catch(() => {});
      } catch(e) { await ctx.reply('❌ تعذر إرسال الملف.'); }
    } else {
      await ctx.reply('❌ الملف غير موجود.');
    }
  }

  const hasSp = await usersDb.getSpecialty(uid);
  if (!hasSp) return askSpecialty(ctx, name);
  return showMainMenu(ctx, name);
}"""

# ابحث عن الجزء القديم واستبدله
import re
pattern = r'  // لو جاء من قروب بـ file_xxx.*?return showMainMenu\(ctx, name\);\n\}'
new_content = re.sub(pattern, new_block, content, flags=re.DOTALL)

with open('handlers/start.js', 'w', encoding='utf-8') as f:
    f.write(new_content)
print("✅ Fixed")
