const fs = require('fs');
const path = require('path');
const BASE = process.env.HOME + '/study-bot-backup-20260407_011636';
const panelPath = path.join(BASE, 'handlers/group_panel.js');
let panel = fs.readFileSync(panelPath, 'utf8');

const oldStart = `async function showGroupDetail(ctx, chatId) {
  const [g, spec, mc, warns, bans] = await Promise.all([`;

const newStart = `async function showGroupDetail(ctx, chatId) {
  const uid = ctx.uid || ctx.from?.id;
  const isOwner = uid === parseInt(process.env.OWNER_ID);

  // تحقق من صلاحيات المستخدم
  if (!isOwner) {
    try {
      const member = await ctx.telegram.getChatMember(chatId, uid);
      if (!['administrator','creator'].includes(member?.status)) {
        return ctx.answerCbQuery('🚫 ليس لديك صلاحية إدارة هذا القروب', { show_alert: true }).catch(() => {});
      }
    } catch(e) {
      return ctx.answerCbQuery('🚫 تعذر التحقق من صلاحياتك', { show_alert: true }).catch(() => {});
    }
  }

  const [g, spec, mc, warns, bans] = await Promise.all([`;

if (panel.includes(oldStart)) {
  panel = panel.replace(oldStart, newStart);
  fs.writeFileSync(panelPath, panel);
  console.log('✅ Done');
} else {
  console.log('❌ pattern not found');
}
