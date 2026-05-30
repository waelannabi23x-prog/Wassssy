#!/bin/bash
cd ~/study-bot-backup-20260407_011636

node -e "
const fs = require('fs');
let c = fs.readFileSync('handlers/group_commands.js', 'utf8');
const newCmd = [
  '',
  '  bot.command(\'bans\', grpOnly, adminOnly, async ctx => {',
  '    try {',
  '      const { bans } = require(\'../database/group_db\');',
  '      const list = await bans.list(ctx.chat.id);',
  '      if (!list.length) return ctx.reply(\'✅ \u0644\u0627 \u064a\u0648\u062c\u062f \u0645\u062d\u0638\u0648\u0631\u0648\u0646\').catch(() => {});',
  '      let text = \'\uD83D\uDEAB \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u062d\u0638\u0648\u0631\u064a\u0646\\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\\n\\n\';',
  '      list.forEach((b, i) => {',
  '        const d = new Date(b.created_at).toLocaleDateString(\'ar-DZ\');',
  '        text += (i+1) + \'. [\u0639\u0636\u0648](tg://user?id=\' + b.user_id + \') \u2014 \' + (b.reason||\'\u0644\u0627 \u0633\u0628\u0628\') + \' \u2014 _\' + d + \'_\\n\';',
  '      });',
  '      ctx.reply(text, { parse_mode: \'Markdown\' }).catch(() => {});',
  '    } catch(e) { ctx.reply(\'\u274C \' + e.message).catch(() => {}); }',
  '  });',
  ''
].join('\n');
c = c.replace('  bot.command(\'kick\'', newCmd + '  bot.command(\'kick\'');
fs.writeFileSync('handlers/group_commands.js', c);
console.log('done');
"

node --check handlers/group_commands.js && echo "OK" || echo "ERROR"
