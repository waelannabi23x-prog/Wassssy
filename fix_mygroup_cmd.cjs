const fs = require('fs');
const path = require('path');
const cmdPath = process.env.HOME + '/study-bot-backup-20260407_011636/bot/commands.js';
let cmd = fs.readFileSync(cmdPath, 'utf8');

const start = cmd.indexOf("  bot.command('mygroup', async ctx => {");
const end = cmd.indexOf("\n  });", start) + 6;

if (start === -1) { console.log('❌ not found'); process.exit(1); }

const newCmd = `  bot.command('mygroup', async ctx => {
    if (ctx.chat?.type !== 'private') {
      ctx.deleteMessage().catch(() => {});
      const w = await ctx.reply('🔒 هذا الأمر في الخاص فقط').catch(() => null);
      if (w) setTimeout(() => ctx.telegram.deleteMessage(ctx.chat.id, w.message_id).catch(() => {}), 4000);
      return;
    }
    return require('../handlers/group_panel').showMyGroups(ctx);
  });`;

cmd = cmd.slice(0, start) + newCmd + cmd.slice(end);
fs.writeFileSync(cmdPath, cmd);
console.log('✅ Done');
