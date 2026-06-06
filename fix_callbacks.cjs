const fs = require('fs');
const cbPath = process.env.HOME + '/study-bot-backup-20260407_011636/bot/callbacks.js';
let cb = fs.readFileSync(cbPath, 'utf8');

// 1. إضافة handler لـ grp_stats_ و gp_close
const oldLeave = "    { p: 'leave_grp_', fn: async (ctx, d) => {";

const newHandlers = `    { p: 'grp_stats_', fn: async (ctx, d) => {
      const chatId = d.replace('grp_stats_', '');
      try {
        const { all: dbAll2 } = require('../database/db');
        const [msgs, members, warns] = await Promise.all([
          dbAll2('SELECT COUNT(*) AS cnt FROM group_messages WHERE chat_id=$1', [chatId]).catch(() => [{ cnt: 0 }]),
          dbAll2('SELECT COUNT(*) AS cnt FROM group_members WHERE chat_id=$1', [chatId]).catch(() => [{ cnt: 0 }]),
          dbAll2('SELECT COUNT(*) AS cnt FROM group_warns WHERE chat_id=$1', [chatId]).catch(() => [{ cnt: 0 }]),
        ]);
        const text = '📊 *إحصائيات القروب*\\n━━━━━━━━━━━━\\n\\n' +
          '👤 الأعضاء المسجلون: *' + (members[0]?.cnt || 0) + '*\\n' +
          '⚠️ التحذيرات: *' + (warns[0]?.cnt || 0) + '*\\n' +
          '💬 الرسائل المحفوظة: *' + (msgs[0]?.cnt || 0) + '*';
        return ctx.answerCbQuery().catch(()=>{}).then(() =>
          ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '◀️ رجوع', callback_data: 'gp_view_' + chatId }]] } })
          .catch(() => ctx.reply(text, { parse_mode: 'Markdown' }).catch(() => {}))
        );
      } catch(e) { ctx.answerCbQuery('❌ ' + e.message, { show_alert: true }).catch(() => {}); }
    }},
    { p: 'gp_close', fn: async (ctx, d) => {
      ctx.answerCbQuery().catch(() => {});
      return ctx.deleteMessage().catch(() => {});
    }},
    { p: 'leave_grp_', fn: async (ctx, d) => {`;

cb = cb.replace(oldLeave, newHandlers);
console.log('✅ handlers added');

// 2. حذف زر مغادرة القروب من showGroupDetail للمستخدم العادي
// نخليه يظهر فقط للأونر
const panelPath = process.env.HOME + '/study-bot-backup-20260407_011636/handlers/group_panel.js';
let panel = fs.readFileSync(panelPath, 'utf8');

// استبدل زر مغادرة بزر إغلاق للمستخدم العادي
const oldRows = `    [kbBtn('👥 الأعضاء',         'grp_main_'   + chatId),
     kbBtn('🚪 مغادرة القروب',   'leave_grp_'  + chatId)],
    [kbBtn('◀️ رجوع', 'gp_panel')],`;

const newRows = `    [kbBtn('👥 الأعضاء', 'grp_main_' + chatId)],
    [kbBtn('◀️ رجوع', 'gp_panel'), kbBtn('🗑 إغلاق', 'gp_close')],`;

if (panel.includes(oldRows)) {
  panel = panel.replace(oldRows, newRows);
  fs.writeFileSync(panelPath, panel);
  console.log('✅ panel updated — مغادرة محذوفة');
} else {
  console.log('⚠️ panel pattern not found');
}

fs.writeFileSync(cbPath, cb);
console.log('🏁 Done');
