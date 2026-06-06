const fs = require('fs');
const path = require('path');
const BASE = process.env.HOME + '/study-bot-backup-20260407_011636';

// ══════════════════════════════════════════
// إصلاح mygroup في commands.js
// يستعمل Telegram API بدل group_members
// ══════════════════════════════════════════
const cmdPath = path.join(BASE, 'bot/commands.js');
let cmd = fs.readFileSync(cmdPath, 'utf8');

// ابحث عن بداية ونهاية دالة mygroup
const start = cmd.indexOf("bot.command('mygroup', async ctx => {");
const end = cmd.indexOf("\n  });\n", start) + 6;

if (start === -1) {
  console.log('❌ mygroup command not found');
  process.exit(1);
}

const newMygroup = `bot.command('mygroup', async ctx => {
    if (ctx.chat?.type !== 'private') {
      ctx.deleteMessage().catch(() => {});
      const w = await ctx.reply('🔒 هذا الأمر في الخاص فقط').catch(() => null);
      if (w) setTimeout(() => ctx.telegram.deleteMessage(ctx.chat.id, w.message_id).catch(() => {}), 4000);
      return;
    }
    const uid = ctx.uid || ctx.from?.id;
    const { all } = require('../database/db');
    const { build: kb, btn: b } = require('../utils/keyboard');
    const isOwner = uid === parseInt(process.env.OWNER_ID);
    const BOT_UN = process.env.BOT_USERNAME || '';

    // جلب كل القروبات النشطة
    const allGroups = await all('SELECT chat_id, title FROM group_chats WHERE is_active=1 ORDER BY title').catch(() => []);

    if (!allGroups.length) {
      return ctx.reply(
        '👥 *قروباتك*\\n\\nلا توجد قروبات مرتبطة بحسابك.\\n\\nأضف البوت لقروبك أولاً:',
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
          { text: '➕ أضف البوت لقروب', url: 'https://t.me/' + BOT_UN + '?startgroup=true' }
        ]]}}
      ).catch(() => {});
    }

    // فلتر عبر Telegram API
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
        '👥 *قروباتك*\\n\\nأنت لست ادمين في أي قروب يحتوي البوت حالياً.\\n\\nأضف البوت لقروبك:',
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
          { text: '➕ أضف البوت لقروب', url: 'https://t.me/' + BOT_UN + '?startgroup=true' }
        ]]}}
      ).catch(() => {});
    }

    let text = '👥 *قروباتك (' + myGroups.length + ')*\\n━━━━━━━━━━━━\\n\\nاختر قروب لإدارته:';
    const rows = myGroups.map(g => [b('⚙️ ' + String(g.title || g.chat_id).substring(0,25), 'gp_view_' + g.chat_id)]);
    rows.push([{ text: '➕ أضف البوت لقروب جديد', url: 'https://t.me/' + BOT_UN + '?startgroup=true' }]);
    return ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows } }).catch(() => {});
  });`;

cmd = cmd.slice(0, start) + newMygroup + cmd.slice(end);
fs.writeFileSync(cmdPath, cmd);
console.log('✅ commands.js updated');
