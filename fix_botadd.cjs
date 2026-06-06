const fs = require('fs');
const path = require('path');
const indexPath = process.env.HOME + '/study-bot-backup-20260407_011636/index.js';
let idx = fs.readFileSync(indexPath, 'utf8');

const oldMsg = `        setTimeout(async () => {
          try {
            await ctx.telegram.sendMessage(addedBy.id,
              '🎉 شكراً لإضافتي في *' + title + '!*\\n\\nيمكنك إعداد القروب والتحكم فيه من هنا:',
              {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [
                  [{ text: '⚙️ إعداد القروب', url: 'https://t.me/' + un + '?start=setup_' + chatId }]
                ]}
              }
            );
          } catch(_) {}
        }, 2000);`;

const newMsg = `        setTimeout(async () => {
          try {
            // تحقق إذا البوت ادمين
            const botMember = await ctx.telegram.getChatMember(chatId, ctx.botInfo?.id || (await ctx.telegram.getMe()).id).catch(() => null);
            const isAdmin = botMember?.status === 'administrator';
            if (isAdmin) {
              // البوت ادمين — رسالة ترحيب وإعداد
              await ctx.telegram.sendMessage(addedBy.id,
                '✅ تم إضافتي في *' + title + '* كـ ادمين!\\n\\nيمكنك إعداد القروب والتحكم فيه من هنا:',
                {
                  parse_mode: 'Markdown',
                  reply_markup: { inline_keyboard: [
                    [{ text: '⚙️ إعداد القروب', url: 'https://t.me/' + un + '?start=setup_' + chatId }]
                  ]}
                }
              );
            } else {
              // البوت مش ادمين — رسالة تنبيه وخروج
              await ctx.telegram.sendMessage(addedBy.id,
                '⚠️ شكراً على الإضافة في *' + title + '*!\\n\\n' +
                'لكن لاحظت أنك لم تمنحني صلاحيات *ادمين*، ولن أتمكن من العمل بشكل صحيح.\\n\\n' +
                '📌 *كيف تصلح ذلك؟*\\n' +
                '1\\. اذهب لإعدادات القروب\\n' +
                '2\\. ادمنز ← أضف ادمن\\n' +
                '3\\. اخترني وفعّل الصلاحيات\\n\\n' +
                'سأخرج الآن وأعود عند إضافتي كادمين 👋',
                { parse_mode: 'Markdown' }
              ).catch(() => {});
              await ctx.telegram.leaveChat(chatId).catch(() => {});
            }
          } catch(_) {}
        }, 2000);`;

if (idx.includes(oldMsg.trim().substring(0, 50))) {
  idx = idx.replace(oldMsg, newMsg);
  fs.writeFileSync(indexPath, idx);
  console.log('✅ Done');
} else {
  console.log('❌ pattern not found — trying partial match');
  // partial fix
  idx = idx.replace(
    "'🎉 شكراً لإضافتي في *' + title + '!*\\n\\nيمكنك إعداد القروب والتحكم فيه من هنا:'",
    "'✅ تم إضافتي في *' + title + '* كادمين!\\n\\nيمكنك إعداد القروب من هنا:'"
  );
  fs.writeFileSync(indexPath, idx);
  console.log('⚠️ partial fix applied');
}
