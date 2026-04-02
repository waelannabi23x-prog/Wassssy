const db = require('../database/db');
if (!global.userStates) global.userStates = {};

const ALL_PERMISSIONS = ['upload', 'delete', 'add_content', 'view_users', 'full'];
const PERM_LABELS = {
  upload: '📤 رفع ملفات',
  delete: '🗑 حذف ملفات',
  add_content: '➕ إضافة محتوى',
  view_users: '👥 عرض المستخدمين',
  full: '👑 صلاحيات كاملة',
};

function editOrSend(bot, chatId, msgId, text, opts) {
  if (msgId) return bot.editMessageText(text, { chat_id: chatId, message_id: msgId, ...opts }).catch(() => bot.sendMessage(chatId, text, opts));
  return bot.sendMessage(chatId, text, opts);
}

async function sendOwnerMenu(bot, chatId, msgId) {
  return editOrSend(bot, chatId, msgId, '👑 *Owner Panel*', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
    [{ text: '📢 Broadcast', callback_data: 'owner_broadcast' }],
    [{ text: '📊 Detailed Stats', callback_data: 'owner_stats' }],
    [{ text: '👤 Add Admin', callback_data: 'owner_add_admin' }, { text: '👥 List Admins', callback_data: 'owner_list_admins' }],
    [{ text: '🛠️ Admin Panel', callback_data: 'admin_menu' }, { text: '🏠 Main Menu', callback_data: 'main_menu' }],
  ]}});
}

async function promptBroadcast(bot, chatId, userId) {
  global.userStates[userId] = { type: 'broadcast' };
  bot.sendMessage(chatId, '📢 Type the message to broadcast to ALL users:');
}

async function handleBroadcast(bot, msg, text) {
  const userId = msg.from.id; const chatId = msg.chat.id;
  delete global.userStates[userId];
  const users = db.getAllUserIds();
  let sent = 0, failed = 0;
  const statusMsg = await bot.sendMessage(chatId, '📢 Broadcasting to ' + users.length + ' users...');
  for (const uid of users) {
    try { await bot.sendMessage(uid, '📢 *Announcement*\n\n' + text, { parse_mode: 'Markdown' }); sent++; }
    catch { failed++; }
    await new Promise(r => setTimeout(r, 35));
  }
  bot.editMessageText('✅ *Broadcast Complete!*\n\n✅ Sent: ' + sent + '\n❌ Failed: ' + failed,
    { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '👑 Owner Panel', callback_data: 'owner_menu' }]] } });
}

async function showDetailedStats(bot, chatId, msgId) {
  const topFiles = db.getMostDownloaded(5);
  let text = '📊 *Detailed Stats*\n\n👥 Users: *' + db.getUserCount() + '*\n🎓 Specialties: *' + db.getSpecialties().length + '*\n📁 Files: *' + db.getTotalFiles() + '*\n⬇️ Downloads: *' + db.getTotalDownloads() + '*\n🛡 Admins: *' + db.getAdmins().length + '*\n\n🏆 *Top Files:*\n';
  topFiles.forEach((f, i) => { text += (i+1) + '. ' + f.title + ' — ⬇️ ' + f.downloads + '\n'; });
  return editOrSend(bot, chatId, msgId, text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '◀️ Back', callback_data: 'owner_menu' }]] } });
}

async function promptAddAdmin(bot, chatId, userId) {
  global.userStates[userId] = { type: 'add_admin' };
  bot.sendMessage(chatId, '👤 Send the *Telegram user ID* to make admin:', { parse_mode: 'Markdown' });
}

async function handleAddAdmin(bot, msg, text) {
  const userId = msg.from.id; const chatId = msg.chat.id;
  delete global.userStates[userId];
  const targetId = parseInt(text.trim());
  if (isNaN(targetId)) return bot.sendMessage(chatId, '❌ Invalid ID.');
  db.addAdmin(targetId, userId);
  bot.sendMessage(chatId, '✅ User *' + targetId + '* is now admin!\n\n⚙️ Default permissions: upload, delete, add\\_content, view\\_users\n\nUse /owner → List Admins to edit permissions.', {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[{ text: '◀️ Owner Panel', callback_data: 'owner_menu' }]] }
  });
  bot.sendMessage(targetId, '🎉 You are now an *Admin* of Study Bot!', { parse_mode: 'Markdown' }).catch(()=>{});
}

async function listAdmins(bot, chatId, msgId) {
  const admins = db.getAdmins();
  if (!admins.length) return editOrSend(bot, chatId, msgId, '👥 No admins yet.', { reply_markup: { inline_keyboard: [[{ text: '◀️ Back', callback_data: 'owner_menu' }]] } });
  let text = '👥 *Admins (' + admins.length + '):*\n\n';
  admins.forEach(a => {
    const perms = (a.permissions||'').split(',').map(p => PERM_LABELS[p.trim()]||p).join(', ');
    text += '• ' + (a.first_name||'Unknown') + ' (' + (a.username?'@'+a.username:'ID: '+a.user_id) + ')\n  🔑 ' + perms + '\n\n';
  });
  const buttons = admins.map(a => [
    { text: '⚙️ ' + (a.first_name||a.user_id), callback_data: 'owner_edit_perms_' + a.user_id },
    { text: '🗑 Remove', callback_data: 'owner_remove_admin_' + a.user_id }
  ]);
  buttons.push([{ text: '◀️ Owner Panel', callback_data: 'owner_menu' }]);
  return editOrSend(bot, chatId, msgId, text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
}

async function showEditPerms(bot, chatId, adminId, msgId) {
  const admins = db.getAdmins();
  const admin = admins.find(a => a.user_id == adminId);
  if (!admin) return bot.sendMessage(chatId, '❌ Admin not found.');
  const currentPerms = (admin.permissions||'').split(',').map(p => p.trim());
  const text = '⚙️ *Permissions for ' + (admin.first_name||adminId) + '*\n\n✅ = enabled | ☐ = disabled\n\nTap to toggle:';
  const buttons = ALL_PERMISSIONS.map(p => {
    const active = currentPerms.includes(p);
    return [{ text: (active ? '✅ ' : '☐ ') + (PERM_LABELS[p]||p), callback_data: 'owner_toggle_perm_' + adminId + '_' + p }];
  });
  buttons.push([{ text: '◀️ Back to Admins', callback_data: 'owner_list_admins' }]);
  return editOrSend(bot, chatId, msgId, text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
}

async function togglePermission(bot, chatId, adminId, perm, msgId) {
  const admins = db.getAdmins();
  const admin = admins.find(a => a.user_id == adminId);
  if (!admin) return;
  let currentPerms = (admin.permissions||'').split(',').map(p => p.trim()).filter(Boolean);
  if (currentPerms.includes(perm)) {
    currentPerms = currentPerms.filter(p => p !== perm);
  } else {
    if (perm === 'full') currentPerms = ['full'];
    else { currentPerms = currentPerms.filter(p => p !== 'full'); currentPerms.push(perm); }
  }
  db.updateAdminPermissions(adminId, currentPerms.join(','));
  await showEditPerms(bot, chatId, adminId, msgId);
}

async function removeAdmin(bot, chatId, adminId) {
  db.removeAdmin(parseInt(adminId));
  bot.sendMessage(chatId, '✅ Admin removed.', { reply_markup: { inline_keyboard: [[{ text: '◀️ Back', callback_data: 'owner_list_admins' }]] } });
}

module.exports = {
  sendOwnerMenu, promptBroadcast, handleBroadcast, showDetailedStats,
  promptAddAdmin, handleAddAdmin, listAdmins, removeAdmin,
  showEditPerms, togglePermission
};
