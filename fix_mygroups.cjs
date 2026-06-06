const fs = require('fs');
const path = require('path');
const BASE = process.env.HOME + '/study-bot-backup-20260407_011636';

// ══════════════════════════════════════════
// 1. إصلاح listGroups — يظهر فقط قروبات المستخدم
// ══════════════════════════════════════════
const toolsPath = path.join(BASE, 'handlers/owner_tools.js');
let tools = fs.readFileSync(toolsPath, 'utf8');

const newListGroups = `exports.listGroups = async (ctx) => {
  const uid = ctx.uid || ctx.from?.id;
  // جلب القروبات اللي المستخدم ادمين فيها والبوت موجود فيها
  const groups = await db.all(
    \`SELECT gc.chat_id, gc.title, sp.name as spec,
            gc.welcome_enabled, gc.is_active,
            (SELECT COUNT(*) FROM group_members gm WHERE gm.chat_id=gc.chat_id) as members
     FROM group_chats gc
     LEFT JOIN specialties sp ON gc.specialty_id=sp.id
     INNER JOIN group_members adm ON adm.chat_id=gc.chat_id AND adm.user_id=$1 AND adm.is_admin=1
     WHERE gc.is_active=1
     ORDER BY gc.title\`,
    [uid]
  );
  if (!groups.length) return ctx.reply('📭 أنت لست ادمين في أي قروب يحتوي البوت حالياً.');

  let text = '👥 *قروباتك (' + groups.length + ')*\\n━━━━━━━━━━━━\\n\\n';
  const rows = [];
  groups.forEach((g, i) => {
    const sp = g.spec ? '🎓 ' + g.spec : '📚 غير محدد';
    const w  = g.welcome_enabled ? '✅' : '❌';
    text += (i+1) + '. *' + (g.title||'قروب').substring(0,25) + '*\\n';
    text += '   👤 ' + (g.members||0) + ' | ' + sp + ' | ترحيب: ' + w + '\\n\\n';
    rows.push([btn('⚙️ ' + (g.title||g.chat_id).substring(0,20), 'gp_view_' + g.chat_id)]);
  });
  rows.push([btn('🔄 تحديث', 'mygroups_refresh')]);
  ctx.reply(text, { parse_mode: 'Markdown', ...build(rows) });
};`;

// استبدل الدالة القديمة
tools = tools.replace(/exports\.listGroups = async \(ctx\) => \{[\s\S]*?\n\};/, newListGroups);
fs.writeFileSync(toolsPath, tools);
console.log('✅ owner_tools.js updated');

// ══════════════════════════════════════════
// 2. إضافة callback mygroups_refresh
// ══════════════════════════════════════════
const cbPath = path.join(BASE, 'bot/callbacks.js');
let cb = fs.readFileSync(cbPath, 'utf8');

if (!cb.includes('mygroups_refresh')) {
  cb = cb.replace(
    "['main_menu',  ctx => startHandler.showMainMenu(ctx)]",
    "['main_menu',  ctx => startHandler.showMainMenu(ctx)],\n    ['mygroups_refresh', ctx => tools.listGroups(ctx)]"
  );
  fs.writeFileSync(cbPath, cb);
  console.log('✅ callbacks.js updated');
} else {
  console.log('⏭️  callbacks.js already has mygroups_refresh');
}

// ══════════════════════════════════════════
// 3. إصلاح my_chat_member — إذا البوت مش ادمين يبعث رسالة ويخرج
// ══════════════════════════════════════════
const indexPath = path.join(BASE, 'index.js');
let idx = fs.readFileSync(indexPath, 'utf8');

const oldInsert = `      if (['member','administrator'].includes(member?.status)) {
        // البوت أُضيف للقروب
        await dbRun(
          \`INSERT INTO group_chats(chat_id, title, specialty_id, welcome_enabled, goodbye_enabled, notify_new_files)
           VALUES($1,$2,0,1,0,1)
           ON CONFLICT(chat_id) DO UPDATE SET title=$2\`,
          [chat.id, chat.title || '']
        ).catch(() => {});
        logger.info('[GroupReg] ✅ أُضيف البوت لـ: ' + (chat.title||chat.id));`;

const newInsert = `      if (['member','administrator'].includes(member?.status)) {
        // تحقق إذا البوت ادمين
        if (member?.status !== 'administrator') {
          // مش ادمين — بعث رسالة لمن أضافه وخرج
          const addedBy2 = ctx.update?.my_chat_member?.from;
          if (addedBy2?.id) {
            await ctx.telegram.sendMessage(addedBy2.id,
              '⚠️ تم إضافتي في *' + (chat.title||'القروب') + '* لكن بدون صلاحيات ادمين!\\n\\n' +
              '📌 لكي أعمل بشكل كامل، يرجى ترقيتي لـ *ادمين* ثم أضفني مجدداً.',
              { parse_mode: 'Markdown' }
            ).catch(() => {});
          }
          await ctx.telegram.leaveChat(chat.id).catch(() => {});
          logger.info('[GroupReg] ⚠️ خرج البوت (مش ادمين) من: ' + (chat.title||chat.id));
          return;
        }
        // البوت أُضيف للقروب كادمين
        await dbRun(
          \`INSERT INTO group_chats(chat_id, title, specialty_id, welcome_enabled, goodbye_enabled, notify_new_files)
           VALUES($1,$2,0,1,0,1)
           ON CONFLICT(chat_id) DO UPDATE SET title=$2\`,
          [chat.id, chat.title || '']
        ).catch(() => {});
        logger.info('[GroupReg] ✅ أُضيف البوت لـ: ' + (chat.title||chat.id));`;

if (idx.includes("if (['member','administrator'].includes(member?.status)) {")) {
  idx = idx.replace(oldInsert, newInsert);
  fs.writeFileSync(indexPath, idx);
  console.log('✅ index.js updated');
} else {
  console.log('❌ index.js — pattern not found, manual fix needed');
}

console.log('\n🏁 Done!');
