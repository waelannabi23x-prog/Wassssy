#!/bin/bash
cd ~/study-bot-backup-20260407_011636

cat > fix_clean.cjs << 'JSEOF'
const fs = require('fs');
let c = fs.readFileSync('bot/commands.js', 'utf8');

const newCmd = [
  '',
  "  bot.command('cleanchannels', async ctx => {",
  '    if (!ctx.isOwner) return ctx.reply("للمالك فقط").catch(() => {});',
  "    const { cacheGet, cacheClear } = require('../utils/cache');",
  "    cacheClear('required_channels');",
  "    const list = await getChannels().catch(() => []);",
  '    if (!list.length) return ctx.reply("لا توجد قنوات").catch(() => {});',
  '    const rows = list.map(ch => [{',
  '      text: "🗑 " + (ch.channel_name || ch.channel_id),',
  '      callback_data: "del_channel_" + ch.channel_id',
  '    }]);',
  '    return ctx.reply("اختر القناة للحذف:", {',
  '      reply_markup: { inline_keyboard: rows }',
  '    }).catch(() => {});',
  '  });',
  ''
].join('\n');

c = c.replace("  bot.command('channels'", newCmd + "  bot.command('channels'");
fs.writeFileSync('bot/commands.js', c);
console.log('done');
JSEOF

node fix_clean.cjs
node --check bot/commands.js && echo "OK" || echo "ERROR"
rm fix_clean.cjs
