'use strict';
const { showAllMembers, tagAll, muteAll, unmuteAll } = require('./group_admin');
const million = require('./million_battle');

function setupGroupCommands(bot) {
  // ═══ Million Battle ═══
  bot.command('million', async ctx => {
    if (!['supergroup','group'].includes(ctx.chat?.type)) return;
    if (!ctx.isOwner && !ctx.isAdmin) return ctx.reply('🚫 للمشرفين فقط').catch(()=>{});
    return million.showQuestionsPanel(ctx);
  });
  bot.command('stopmillion', async ctx => {
    if (!['supergroup','group'].includes(ctx.chat?.type)) return;
    return million.stopGame(ctx);
  });

  bot.command('all', async ctx => {
    if (!['supergroup','group'].includes(ctx.chat.type)) return;
    if (!ctx.isOwner && !ctx.isAdmin) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});
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
