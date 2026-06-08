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
    p.push(ctx.telegram.sendMessage(ctx.chat.id, '⚡').catch(err => { require('../utils/logger').debug("[silent]", err.message); }));
  }
  await Promise.all(p);
  var eT = Date.now();
  var eM = process.memoryUsage().heapUsed / 1024 / 1024;
  return ctx.reply('🧬 *نتائج: *' + cnt + '*\n⏱️ الرسائل: *' + (eT - sT) + 'ms*\n💾 الرام: *+' + (eM - sM).toFixed(2) + ' MB*', { parse_mode: 'Markdown' });
}


// ── مزامنة القروبات ─────────────────────────────────────
async function syncGroups(ctx) {
  const { all, run } = require('../database/db');
  const groups = await all('SELECT chat_id, title FROM group_chats WHERE is_active=1').catch(() => []);
  if (!groups.length) return ctx.reply('لا توجد قروبات نشطة.').catch(() => {});
  await ctx.reply('🔄 جاري التحقق من ' + groups.length + ' قروب...').catch(() => {});
  let ok = 0, bad = 0;
  const me = await ctx.telegram.getMe().catch(() => ({}));
  for (const g of groups) {
    try {
      const m = await ctx.telegram.getChatMember(g.chat_id, me.id);
      if (['kicked','left'].includes(m.status)) {
        await run('UPDATE group_chats SET is_active=0 WHERE chat_id=$1', [g.chat_id]).catch(() => {});
        bad++;
      } else { ok++; }
    } catch(_) {
      await run('UPDATE group_chats SET is_active=0 WHERE chat_id=$1', [g.chat_id]).catch(() => {});
      bad++;
    }
    await new Promise(r => setTimeout(r, 300));
  }
  ctx.reply('✅ مزامنة كاملة\n\n🟢 نشط: ' + ok + '\n🔴 تم تعطيل: ' + bad).catch(() => {});
}

module.exports = { spy, stress };
