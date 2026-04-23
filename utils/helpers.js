'use strict';
var common = require('./common');
var escMd = common.escMd;
var buildPath = common.buildPath;
var formatDate = common.formatDate;

async function eos(ctx, text, extra) {
  extra = extra || {};
  if (ctx.callbackQuery) {
    ctx.answerCbQuery('').catch(function(){});
    var msg = ctx.callbackQuery.message;
    // نص عادي → عدّل في مكانه
    if (msg && msg.text) {
      try { return await ctx.editMessageText(text, extra); } catch (e) {
        if ((e.description || '').indexOf('not modified') !== -1) return;
      }
    }
    // ميديا (صورة/ملف/فيديو) → احذف وابعث جديدة نظيفة
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
