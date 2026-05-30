#!/bin/bash
cd ~/study-bot-backup-20260407_011636

cat > fix_delch.cjs << 'JSEOF'
const fs = require('fs');
let c = fs.readFileSync('bot/callbacks.js', 'utf8');

const newHandler = [
  '',
  '    // del_channel',
  "    { p: 'del_channel_', fn: async (ctx, d) => {",
  '      if (!ctx.isOwner) return ctx.answerCbQuery("للمالك فقط", { show_alert: true }).catch(() => {});',
  "      const channelId = d.replace('del_channel_', '');",
  "      const { removeChannel } = require('../utils/channelGuard');",
  "      const { cacheClear } = require('../utils/cache');",
  '      await removeChannel(channelId).catch(() => {});',
  "      cacheClear('required_channels');",
  "      ctx.answerCbQuery('تم الحذف').catch(() => {});",
  '      const { getChannels } = require("../utils/channelGuard");',
  '      const list = await getChannels().catch(() => []);',
  '      if (!list.length) return ctx.editMessageText("لا توجد قنوات").catch(() => ctx.reply("لا توجد قنوات").catch(() => {}));',
  '      const rows = list.map(ch => [{',
  '        text: "🗑 " + (ch.channel_name || ch.channel_id),',
  '        callback_data: "del_channel_" + ch.channel_id',
  '      }]);',
  '      return ctx.editMessageReplyMarkup({ inline_keyboard: rows }).catch(() => {});',
  '    }},',
  ''
].join('\n');

c = c.replace("    { p: 'leave_grp_'", newHandler + "    { p: 'leave_grp_'");
fs.writeFileSync('bot/callbacks.js', c);
console.log('done');
JSEOF

node fix_delch.cjs
node --check bot/callbacks.js && echo "OK" || echo "ERROR"
rm fix_delch.cjs
