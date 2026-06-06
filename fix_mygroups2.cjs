const fs = require('fs');
const path = require('path');
const BASE = process.env.HOME + '/study-bot-backup-20260407_011636';

const toolsPath = path.join(BASE, 'handlers/owner_tools.js');
let tools = fs.readFileSync(toolsPath, 'utf8');

const newListGroups = `exports.listGroups = async (ctx) => {
  const uid = ctx.uid || ctx.from?.id;
  // جلب كل القروبات النشطة
  const groups = await db.all(
    \`SELECT chat_id, title FROM group_chats WHERE is_active=1 ORDER BY title\`
  ).catch(() => []);

  if (!groups.length) return ctx.reply('📭 البوت ليس في أي قروب حالياً.');

  // فلتر فقط القروبات اللي المستخدم ادمين فيها عبر Telegram API
  const myGroups = [];
  for (const g of groups) {
    try {
      const member = await ctx.telegram.getChatMember(g.chat_id, uid);
      if (['administrator','creator'].includes(member?.status)) {
        myGroups.push(g);
      }
    } catch(_) {}
  }

  if (!myGroups.length) return ctx.reply('📭 أنت لست ادمين في أي قروب يحتوي البوت حالياً.\\n\\nأضف البوت لقروبك وسيظهر هنا.');

  let text = '👥 *قروباتك (' + myGroups.length + ')*\\n━━━━━━━━━━━━\\n\\nاختر قروب لإدارته:';
  const rows = [];
  myGroups.forEach(g => {
    rows.push([btn('⚙️ ' + (g.title||g.chat_id).substring(0,25), 'gp_view_' + g.chat_id)]);
  });
  rows.push([btn('🔄 تحديث', 'mygroups_refresh')]);
  ctx.reply(text, { parse_mode: 'Markdown', ...build(rows) });
};`;

// استبدل
const regex = /exports\.listGroups = async \(ctx\) => \{[\s\S]*?\n\};/;
if (regex.test(tools)) {
  tools = tools.replace(regex, newListGroups);
  fs.writeFileSync(toolsPath, tools);
  console.log('✅ owner_tools.js updated');
} else {
  console.log('❌ pattern not found');
}
