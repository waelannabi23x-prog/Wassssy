'use strict';
var common = require('./common');
var escMd = common.escMd;
var buildPath = common.buildPath;
var formatDate = common.formatDate;

async function eos(ctx, text, extra) {
  extra = extra || {};
  if (ctx.callbackQuery) {
    var msg = ctx.callbackQuery.message;
    var isMedia = msg && !msg.text; // photo/document/video

    if (!isMedia) {
      // رسالة نص عادية — عدّل في مكانها
      try { return await ctx.editMessageText(text, extra); } catch (e) {
        if ((e.description || '').indexOf('not modified') !== -1) return;
      }
    }

    // رسالة ميديا — احذف وابعث جديدة (نظيف 100%)
    ctx.deleteMessage().catch(function(){});
    return ctx.reply(text, extra).catch(function(){});
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
