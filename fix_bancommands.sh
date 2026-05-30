#!/bin/bash
cd ~/study-bot-backup-20260407_011636

node -e "
const fs = require('fs');
let c = fs.readFileSync('bot/commands.js', 'utf8');

const newCmds = \`
  // Ban commands (owner only - private)
  bot.command('ban', async ctx => {
    if (!ctx.isOwner) return;
    if (ctx.chat?.type !== 'private') return;
    const parts = (ctx.message.text || '').split(/\\\\s+/);
    const targetId = parseInt(parts[1]);
    if (!targetId) return ctx.reply('Usage: /ban ID').catch(() => {});
    try {
      await deps.usersDb.ban(targetId);
      deps.cacheClear('ban_' + targetId);
      return ctx.reply('Banned: ' + targetId).catch(() => {});
    } catch(e) { ctx.reply('Error: ' + e.message).catch(() => {}); }
  });

  bot.command('unban', async ctx => {
    if (!ctx.isOwner) return;
    if (ctx.chat?.type !== 'private') return;
    const parts = (ctx.message.text || '').split(/\\\\s+/);
    const targetId = parseInt(parts[1]);
    if (!targetId) return ctx.reply('Usage: /unban ID').catch(() => {});
    try {
      await deps.usersDb.unban(targetId);
      deps.cacheClear('ban_' + targetId);
      return ctx.reply('Unbanned: ' + targetId).catch(() => {});
    } catch(e) { ctx.reply('Error: ' + e.message).catch(() => {}); }
  });

  bot.command('bans', async ctx => {
    if (!ctx.isOwner) return;
    if (ctx.chat?.type !== 'private') return;
    try {
      const list = await deps.dbAll('SELECT id, first_name, username FROM users WHERE is_banned=1 LIMIT 50');
      if (!list.length) return ctx.reply('No banned users').catch(() => {});
      let text = 'Banned users (' + list.length + '):\\n\\n';
      list.forEach((u, i) => {
        text += (i+1) + '. ' + (u.first_name || 'user') + (u.username ? ' @' + u.username : '') + ' - ID:' + u.id + '\\n';
      });
      ctx.reply(text).catch(() => {});
    } catch(e) { ctx.reply('Error: ' + e.message).catch(() => {}); }
  });

\`;

c = c.replace(\"  bot.command('start'\", newCmds + \"  bot.command('start'\");
fs.writeFileSync('bot/commands.js', c);
console.log('done');
"

node --check bot/commands.js && echo "OK" || echo "ERROR"
