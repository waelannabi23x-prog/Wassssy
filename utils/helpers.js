'use strict';
var common = require('./common');
var escMd = common.escMd;
var buildPath = common.buildPath;
var formatDate = common.formatDate;

async function eos(ctx, text, extra) {
  extra = extra || {};
  if (ctx.callbackQuery) {
    // ⚡ answerCbQuery FIRST — stops spinner before any async work
    var _ack = ctx.answerCbQuery('').catch(function(){});
    var msg = ctx.callbackQuery.message;
    // حالة 1: رسالة نصية → عدّل عليها
    if (msg && msg.text) {
      try { return await ctx.editMessageText(text, extra); } catch (e) {
        var desc = e.description || e.message || '';
        if (desc.indexOf('not modified') !== -1) return;
        // فشل التعديل — ابعت جديدة بدون حذف
        return ctx.reply(text, extra).catch(function(){});
      }
    }
    // حالة 2: رسالة بـcaption (صورة/وثيقة) → عدّل الـcaption بدون حذف
    if (msg && msg.caption !== undefined) {
      try {
        return await ctx.editMessageCaption(text, extra);
      } catch (e) {
        var desc2 = e.description || e.message || '';
        if (desc2.indexOf('not modified') !== -1) return;
        // فشل → ابعت جديدة بدون حذف الرسالة القديمة
        return ctx.reply(text, extra).catch(function(){});
      }
    }
    // حالة 3: رسالة بدون نص ولا caption → ابعت جديدة فقط بدون حذف
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
