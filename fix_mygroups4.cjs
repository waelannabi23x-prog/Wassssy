const fs = require('fs');
const path = require('path');
const toolsPath = process.env.HOME + '/study-bot-backup-20260407_011636/handlers/owner_tools.js';
let tools = fs.readFileSync(toolsPath, 'utf8');

const newListGroups = `exports.listGroups = async (ctx) => {
  try {
    const uid = ctx.from?.id;
    if (!uid) return ctx.reply('❌ خطأ: لم يتم التعرف على المستخدم').catch(() => {});

    const { all } = require('../database/db');
    const groups = await all('SELECT chat_id, title FROM group_chats WHERE is_active=1 ORDER BY title').catch(() => []);

    if (!groups.length) {
      const BOT_UN = process.env.BOT_USERNAME || '';
      return ctx.reply('📭 البوت ليس في أي قروب حالياً.', {
        reply_markup: { inline_keyboard: [[{ text: '➕ أضف البوت لقروب', url: 'https://t.me/' + BOT_UN + '?startgroup=true' }]] }
      }).catch(() => {});
    }

    const isOwner = uid === parseInt(process.env.OWNER_ID);
    const myGroups = [];

    if (isOwner) {
      groups.forEach(g => myGroups.push(g));
    } else {
      for (const g of groups) {
        try {
          const m = await ctx.telegram.getChatMember(g.chat_id, uid);
          if (['administrator','creator'].includes(m?.status)) myGroups.push(g);
        } catch(_) {}
      }
    }

    const BOT_UN = process.env.BOT_USERNAME || '';
    if (!myGroups.length) {
      return ctx.reply('📭 أنت لست ادمين في أي قروب يحتوي البوت.\\n\\nأضف البوت لقروبك:', {
        reply_markup: { inline_keyboard: [[{ text: '➕ أضف البوت لقروب', url: 'https://t.me/' + BOT_UN + '?startgroup=true' }]] }
      }).catch(() => {});
    }

    const { build, btn } = require('../utils/keyboard');
    const text = '👥 *قروباتك (' + myGroups.length + ')*\\n━━━━━━━━━━━━\\n\\nاختر قروب لإدارته:';
    const rows = myGroups.map(g => [btn('⚙️ ' + String(g.title || g.chat_id).substring(0,25), 'gp_view_' + g.chat_id)]);
    rows.push([{ text: '➕ أضف البوت لقروب جديد', url: 'https://t.me/' + BOT_UN + '?startgroup=true' }]);
    rows.push([btn('🔄 تحديث', 'mygroups_refresh')]);
    return ctx.reply(text, { parse_mode: 'Markdown', ...build(rows) }).catch(() => {});
  } catch(e) {
    require('../utils/logger').error('[listGroups]', e.message);
    return ctx.reply('❌ خطأ: ' + e.message).catch(() => {});
  }
};`;

const regex = /exports\.listGroups = async \(ctx\) => \{[\s\S]*?\n\};/;
if (regex.test(tools)) {
  tools = tools.replace(regex, newListGroups);
  fs.writeFileSync(toolsPath, tools);
  console.log('✅ Done');
} else {
  console.log('❌ pattern not found');
}
