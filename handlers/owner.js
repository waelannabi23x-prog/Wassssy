'use strict';
const usersDb = require('../database/users');
const content = require('../database/content');
const { escMd } = require('../utils/helpers');
const { build, btn, back } = require('../utils/keyboard');

async function spy(ctx, text) {
  var tid = parseInt(text);
  if (isNaN(tid)) return ctx.reply('❌ ID غير صحيح.');
  var u = await usersDb.getById(tid);
  if (!u) return ctx.reply('❌ غير موجود.');
  var sp = await usersDb.getSpecialty(tid);
  var spN = sp && sp.specialty_id ? (await content.getSpec(sp.specialty_id))?.name : null;
  var st = require('../utils/stateManager').getState(tid);
  var text = '🕵️ *' + escMd(u.first_name || '?') + '*\n━━━━\n🆔 `' + tid + '`\n📛 ' + (u.username ? '@' + escMd(u.username) : 'لا يوجد') + '\n🎓 ' + escMd(spN || 'غير محدد') + '\n' + (st ? '🔄 *' + st.type + '*' : '⬜ فاضي');
  return ctx.reply(text, { parse_mode: 'Markdown' });
}

async function stress(ctx, text) {
  var cnt = Math.min(parseInt(text) || 50, 200);
  if (isNaN(cnt)) return ctx.reply('❌');
  var sM = process.memoryUsage().heapUsed / 1024 / 1024;
  var sT = Date.now();
  var p = [];
  for (var i = 0; i < cnt; i++) {
    p.push(ctx.telegram.sendMessage(ctx.chat.id, '⚡').catch(() => {}));
  }
  await Promise.all(p);
  var eT = Date.now();
  var eM = process.memoryUsage().heapUsed / 1024 / 1024;
  return ctx.reply('🧬 *نتائج: *' + cnt + '*\n⏱️ الرسائل: *' + (eT - sT) + 'ms*\n💾 الرام: *+' + (eM - sM).toFixed(2) + ' MB*', { parse_mode: 'Markdown' });
}

module.exports = { spy, stress };
