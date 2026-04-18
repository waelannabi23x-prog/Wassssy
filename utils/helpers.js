'use strict';
var common = require('./common');
var escMd = common.escMd;
var buildPath = common.buildPath;
var formatDate = common.formatDate;

async function eos(ctx, text, extra) {
  extra = extra || {};
  var msg = ctx.callbackQuery && ctx.callbackQuery.message;
  if (msg) {
    try {
      return await ctx.editMessageText(text, extra);
    } catch (e) {
      if (e.description && e.description.indexOf('message is not modified') !== -1) return;
      if (e.description && e.description.indexOf('no text in the message') !== -1) {
        try { return await ctx.editMessageCaption(text, extra); } catch(_) {}
      }
      try { return await ctx.reply(text, extra); } catch(_) {}
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

module.exports = { escMd: escMd, buildPath: buildPath, formatDate: formatDate, eos: eos, quickAck: quickAck, showTyping: showTyping };
