
const { all } = require('../database/db');
const { cacheGet, cacheSet } = require('./cache');
const escMd = t => (t||'').replace(/[*_`\[\]()~>#+=|{}.!\-]/g,'\\$&');

let _botUsername = null;
async function getBotUsername(bot) {
  if(_botUsername) return _botUsername;
  const me = await bot.telegram.getMe();
  _botUsername = me.username;
  return _botUsername;
}

async function notifyGroupsNewFile(bot, fileInfo) {
  if(!bot || !fileInfo?.specialty_id) return;
  try {
    const groups = await all(
      'SELECT chat_id, title FROM group_chats WHERE specialty_id=$1 AND notify_new_files=1',
      [fileInfo.specialty_id]
    );
    if(!groups.length) return;
    const username = await getBotUsername(bot);
    for(const group of groups) {
      try {
        const members = await all(
          'SELECT user_id, username, first_name FROM group_members WHERE chat_id=$1 LIMIT 30',
          [group.chat_id]
        );
        let msg = '📚 *ملف جديد في تخصصك!*\n\n';
        msg += '📄 *' + escMd(fileInfo.title) + '*\n';
        msg += '📁 ' + escMd(fileInfo.cat_name||'') + ' | 📖 ' + escMd(fileInfo.sub_name||'') + '\n\n';
        if(members.length) {
          msg += members.map(m =>
            m.username ? '@'+m.username
            : '['+escMd(m.first_name||'عضو')+'](tg://user?id='+m.user_id+')'
          ).join(' ') + '\n\n';
        }
        msg += '👆 اضغط للتحميل';
        await bot.telegram.sendMessage(group.chat_id, msg, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{
            text: 'تحميل ' + (fileInfo.title||'').substring(0,20),
            url: 'https://t.me/' + username + '?start=file_' + fileInfo.id
          }]]}
        });
      } catch(e) { console.error('notify group error:', group.chat_id, e.message); }
    }
  } catch(e) { console.error('notifyGroupsNewFile error:', e.message); }
}

module.exports = { notifyGroupsNewFile };
