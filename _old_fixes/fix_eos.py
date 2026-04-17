with open('utils/helpers.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = """  if(msg) {
    try {
      const sameText = msg.text === text;
      const sameKb = JSON.stringify(msg.reply_markup) === JSON.stringify(extra.reply_markup);
      if(sameText && sameKb) return; // لا تغيير = لا طلب
      return await ctx.editMessageText(text, extra);"""

new = """  if(msg) {
    try {
      return await ctx.editMessageText(text, extra);"""

if old in content:
    content = content.replace(old, new)
    with open('utils/helpers.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Fixed")
else:
    print("❌ Not found")
