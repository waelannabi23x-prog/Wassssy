'use strict';
const os = require('os');
const usersDb = require('../database/users');
const content = require('../database/content');
const { escMd } = require('../utils/helpers');

async function handle(ctx, text) {
  var uid = ctx.uid;
  var parts = text.split(' ');
  var cmd = parts[0];
  var val = parts.slice(1).join(' ');

  if (cmd === '!spy') return spyMode(ctx, val);
  if (cmd === '!stress') return stressTest(ctx, val);
  return ctx.reply("⚠️ أوامر المالك:\n!spy [ID]\n!stress [عدد]");
}

async function spyMode(ctx, val) {
  var tid = parseInt(val);
  if (!tid) return ctx.reply("❌ اكتب: !spy [ID]");
  var u = await usersDb.getById(tid);
  if (!u) return ctx.reply("❌ المستخدم غير موجود.");
  var sp = await usersDb.getSpecialty(tid);
  var spName = sp && sp.specialty_id ? (await content.getSpec(sp.specialty_id))?.name : null;
  var state = global.userStates ? global.userStates[tid] : null;
  var stateStr = state ? "🔄 *" + state.type + "*" : "⬜ فاضي";
  var text = "🕵️ *تجسس: " + escMd(u.first_name || '?') + "*\n━━━━━━━━━━━━\n🆔 `" + tid + "`\n📛 " + (u.username ? "@" + escMd(u.username) : "لا يوجد") + "\n🎓 " + escMd(spName || "غير محدد") + "\n🚫 " + (u.is_banned ? "محظور" : "طبيعي") + "\n🕐 " + (u.last_active ? new Date(u.last_active).toLocaleDateString('en-GB') : "لم يسجل دخول") + "\n" + stateStr;
  return ctx.reply(text, { parse_mode: 'Markdown' });
}

async function stressTest(ctx, val) {
  var count = Math.min(parseInt(val) || 50, 200);
  await ctx.reply("🧬 جاري اختبار " + count + " رسالة...");
  var startMem = process.memoryUsage().heapUsed / 1024 / 1024;
  var startTime = Date.now();
  var proms = [];
  for (var i = 0; i < count; i++) {
    proms.push(ctx.telegram.sendMessage(ctx.chat.id, "⚡ " + (i+1)).catch(function(){}));
  }
  await Promise.all(proms);
  var endTime = Date.now();
  var endMem = process.memoryUsage().heapUsed / 1024 / 1024;
  var diff = endMem - startMem;
  var avg = count > 0 ? ((endTime - startTime) / count).toFixed(2) : 0;
  var report = "🧬 *نتائج اختبار الضغط*\n\n📦 الحجم: *" + count + "*\n⏱️ الوقت: *" + (endTime - startTime) + "ms*\n💾 الرام: *+" + diff.toFixed(2) + " MB*\n📊 المتوسط: *" + avg + "ms*";
  return ctx.reply(report, { parse_mode: 'Markdown' });
}

module.exports = { handle };
