'use strict';
var common = require('./common');
var escMd = common.escMd;
var buildPath = common.buildPath;
var formatDate = common.formatDate;

async function eos(ctx, text, extra) {
  extra = extra || {};
  if (ctx.callbackQuery) {
    // ⚡ answerCbQuery fire-and-forget — stops spinner instantly
    ctx.answerCbQuery('').catch(function(){});
    var msg = ctx.callbackQuery.message;
    if (msg && msg.text) {
      // ⚡ editMessageText — fastest path, in-place update
      try { return await ctx.editMessageText(text, extra); } catch (e) {
        var desc = e.description || e.message || '';
        if (desc.indexOf('not modified') !== -1) return;
        return ctx.reply(text, extra).catch(function(){});
      }
    }
    // ⚡ media → delete+reply in parallel
    var delP = ctx.deleteMessage().catch(function(){});
    var repP = ctx.reply(text, extra).catch(function(){});
    await Promise.all([delP, repP]);
    return;
  }
  return ctx.reply(text, extra).catch(function(){});
}

async function quickAck(ctx, text) {
  return ctx.answerCbQuery(text || '', { show_alert: false }).catch(function(){});
}
async function showTyping(ctx) {
  return ctx.sendChatAction('typing').catch(function(){});
}

module.exports = { escMd, buildPath, formatDate, eos, quickAck, showTyping };
