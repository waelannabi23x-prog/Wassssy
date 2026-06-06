const fs = require('fs');
const authPath = process.env.HOME + '/study-bot-backup-20260407_011636/middlewares/auth.js';
let auth = fs.readFileSync(authPath, 'utf8');

const oldReply = `            return ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }).catch(()=>{});`;

const newReply = `            // احذف الرسالة السابقة إذا موجودة
            const _subMsgId = require('../utils/cache').cacheGet('sub_msg_' + uid);
            if (_subMsgId) {
              ctx.telegram.deleteMessage(ctx.chat.id, _subMsgId).catch(() => {});
            }
            const _newMsg = await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }).catch(() => null);
            if (_newMsg) require('../utils/cache').cacheSet('sub_msg_' + uid, _newMsg.message_id, 300000);
            return;`;

if (auth.includes(oldReply)) {
  auth = auth.replace(oldReply, newReply);
  fs.writeFileSync(authPath, auth);
  console.log('✅ Done');
} else {
  console.log('❌ pattern not found');
}
