#!/bin/bash
cd ~/study-bot-backup-20260407_011636

# اكتب الأمر الجديد في ملف مؤقت
cat > /tmp/bans_cmd.js << 'CMDEOF'

  bot.command('bans', grpOnly, adminOnly, async ctx => {
    try {
      const { bans } = require('../database/group_db');
      const list = await bans.list(ctx.chat.id);
      if (!list.length) return ctx.reply('No banned members').catch(() => {});
      let text = 'Banned members:\n\n';
      list.forEach((b, i) => {
        const d = new Date(b.created_at).toLocaleDateString('en-GB');
        text += (i+1) + '. ID:' + b.user_id + ' - ' + (b.reason || 'no reason') + ' - ' + d + '\n';
      });
      ctx.reply(text).catch(() => {});
    } catch(e) { ctx.reply('Error: ' + e.message).catch(() => {}); }
  });

CMDEOF

node -e "
const fs = require('fs');
let c = fs.readFileSync('handlers/group_commands.js', 'utf8');
const newCmd = fs.readFileSync('/tmp/bans_cmd.js', 'utf8');
c = c.replace(\"  bot.command('kick'\", newCmd + \"  bot.command('kick'\");
fs.writeFileSync('handlers/group_commands.js', c);
console.log('done');
"

node --check handlers/group_commands.js && echo "OK" || echo "ERROR"
