'use strict';
const { showAllMembers, tagAll, muteAll, unmuteAll } = require('./group_admin');

function setupGroupCommands(bot) {
  bot.command('all', async ctx => {
    if (!['supergroup','group'].includes(ctx.chat.type)) return;
    try { await showAllMembers(ctx, ctx.chat.id); }
    catch(e) { ctx.reply('❌').catch(() => {}); }
  });

  bot.command('tag', async ctx => {
    if (!['supergroup','group'].includes(ctx.chat.type)) return;
    if (!ctx.isOwner && !ctx.isAdmin) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});
    try { await tagAll(ctx, ctx.chat.id); }
    catch(e) { ctx.reply('❌').catch(() => {}); }
  });

  bot.command('mute', async ctx => {
    if (!['supergroup','group'].includes(ctx.chat.type)) return;
    if (!ctx.isOwner && !ctx.isAdmin) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});
    try { await muteAll(ctx, ctx.chat.id); }
    catch(e) { ctx.reply('❌').catch(() => {}); }
  });

  bot.command('unmute', async ctx => {
    if (!['supergroup','group'].includes(ctx.chat.type)) return;
    if (!ctx.isOwner && !ctx.isAdmin) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});
    try { await unmuteAll(ctx, ctx.chat.id); }
    catch(e) { ctx.reply('❌').catch(() => {}); }
  });
}

module.exports = setupGroupCommands;
