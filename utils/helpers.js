'use strict';
var common = require('./common');
var escMd = common.escMd;
var buildPath = common.buildPath;
var formatDate = common.formatDate;

async function eos(ctx, text, extra) {
  extra = extra || {};
  if (ctx.callbackQuery) {
    try { return await ctx.editMessageText(text, extra); } catch (e) {
      var d = e.description || '';
      if (d.indexOf('not modified') !== -1) return;
      try { return await ctx.editMessageCaption(text, { ...extra, parse_mode: undefined }); } catch (_) {}
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
