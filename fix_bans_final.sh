#!/bin/bash
cd ~/study-bot-backup-20260407_011636

cat > add_bans.cjs << 'JSEOF'
const fs = require('fs');
let c = fs.readFileSync('handlers/group_commands.js', 'utf8');

const bansCmd = [
  '',
  "  bot.command('bans', grpOnly, adminOnly, async ctx => {",
  '    try {',
  "      const { bans } = require('../database/group_db');",
  '      const list = await bans.list(ctx.chat.id);',
  "      if (!list.length) return ctx.reply('No banned members').catch(() => {});",
  "      let text = 'Banned: ' + list.length + '\\n\\n';",
  '      list.forEach((b, i) => {',
  "        const d = new Date(b.created_at).toLocaleDateString('en-GB');",
  "        text += (i+1) + '. ID:' + b.user_id + ' - ' + (b.reason||'no reason') + ' - ' + d + '\\n';",
  '      });',
  '      ctx.reply(text).catch(() => {});',
  "    } catch(e) { ctx.reply('Error: ' + e.message).catch(() => {}); }",
  '  });',
  ''
].join('\n');

c = c.replace('}\n\nmodule.exports = setupGroupCommands;', bansCmd + '}\n\nmodule.exports = setupGroupCommands;');
fs.writeFileSync('handlers/group_commands.js', c);
console.log('done');
JSEOF

node add_bans.cjs
node --check handlers/group_commands.js && echo "OK" || echo "ERROR"
rm add_bans.cjs
