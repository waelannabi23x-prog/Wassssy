const fs = require('fs');
const path = require('path');
const BASE = process.env.HOME + '/study-bot-backup-20260407_011636';
const panelPath = path.join(BASE, 'handlers/group_panel.js');
let panel = fs.readFileSync(panelPath, 'utf8');

// نضيف دالة showMyGroups للمستخدم العادي
const newFn = `
async function showMyGroups(ctx) {
  const uid = ctx.uid || ctx.from?.id;
  const isOwner = uid === parseInt(process.env.OWNER_ID);

  const allGroups = await all('SELECT chat_id, title FROM group_chats WHERE is_active=1 ORDER BY title').catch(() => []);
  const BOT_UN = process.env.BOT_USERNAME || '';

  const myGroups = [];
  if (isOwner) {
    allGroups.forEach(g => myGroups.push(g));
  } else {
    for (const g of allGroups) {
      try {
        const m = await ctx.telegram.getChatMember(g.chat_id, uid);
        if (['administrator','creator'].includes(m?.status)) myGroups.push(g);
      } catch(_) {}
    }
  }

  if (!myGroups.length) {
    return ctx.reply(
      '📭 أنت لست ادمين في أي قروب يحتوي البوت.\\n\\nأضف البوت لقروبك:',
      { reply_markup: { inline_keyboard: [[
        { text: '➕ أضف البوت لقروب', url: 'https://t.me/' + BOT_UN + '?startgroup=true' }
      ]]}}
    ).catch(() => {});
    return;
  }

  const { build: kb, btn: b } = require('../utils/keyboard');
  const text = '👥 *قروباتك (' + myGroups.length + ')*\\n━━━━━━━━━━━━\\n\\nاختر قروب لإدارته:';
  const rows = myGroups.map(g => [b('⚙️ ' + String(g.title || g.chat_id).substring(0,25), 'gp_view_' + g.chat_id)]);
  rows.push([{ text: '➕ أضف البوت لقروب جديد', url: 'https://t.me/' + BOT_UN + '?startgroup=true' }]);
  return ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows } }).catch(() => {});
}
`;

// أضف الدالة قبل module.exports
if (!panel.includes('showMyGroups')) {
  panel = panel.replace('module.exports', newFn + '\nmodule.exports');
}

// تأكد showMyGroups في exports
if (!panel.includes('showMyGroups,')) {
  panel = panel.replace(
    'module.exports = {',
    'module.exports = {\n  showMyGroups,'
  );
}

fs.writeFileSync(panelPath, panel);
console.log('✅ Done');
