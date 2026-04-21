'use strict';
var common = require('./common');
var escMd = common.escMd;
var buildPath = common.buildPath;
var formatDate = common.formatDate;

// ✅ Fixed: properly handle media messages (document/photo)
// When editMessageText fails on a media msg → delete it + reply fresh (clean UI)
async function eos(ctx, text, extra) {
  extra = extra || {};
  if (ctx.callbackQuery) {
    // 1st try: edit as text message
    try { return await ctx.editMessageText(text, extra); } catch (e) {
      var d = e.description || '';
      if (d.indexOf('not modified') !== -1) return;
      // 2nd try: edit as media caption (keep parse_mode!)
      try { return await ctx.editMessageCaption(text, extra); } catch (_) {
        // Both failed (media msg that can't be edited cleanly)
        // → Delete the media msg and send fresh text reply
        ctx.deleteMessage().catch(function(){});
        return ctx.reply(text, extra).catch(function(){});
      }
    }
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
