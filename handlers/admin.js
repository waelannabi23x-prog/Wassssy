const db = require('../database/db');
const { hasPermission } = require('../middleware');
if (!global.userStates) global.userStates = {};

function setState(userId, state) { global.userStates[userId] = state; }
function clearState(userId) { delete global.userStates[userId]; }
function editOrSend(bot, chatId, msgId, text, opts) {
  if (msgId) return bot.editMessageText(text, { chat_id: chatId, message_id: msgId, ...opts }).catch(() => bot.sendMessage(chatId, text, opts));
  return bot.sendMessage(chatId, text, opts);
}

async function sendAdminMenu(bot, chatId, userId, msgId) {
  const buttons = [];
  if (hasPermission(userId, 'add_content')) {
    buttons.push([{ text: '🎓 Add Specialty', callback_data: 'admin_add_specialty' }, { text: '📅 Add Year', callback_data: 'admin_add_year' }]);
    buttons.push([{ text: '📖 Add Subject', callback_data: 'admin_add_subject' }]);
    buttons.push([{ text: '🏷 Manage File Types', callback_data: 'admin_file_types' }]);
  }
  if (hasPermission(userId, 'upload')) buttons.push([{ text: '📤 Upload File', callback_data: 'admin_upload_file' }]);
  buttons.push([{ text: '📋 List Files', callback_data: 'admin_list_files' }]);
  buttons.push([{ text: '🏠 Main Menu', callback_data: 'main_menu' }]);
  return editOrSend(bot, chatId, msgId, '🛠️ *Admin Panel*\n\nChoose an action:', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
}

// ── File Types Management ──────────────────────────────────────────────────────
async function showFileTypes(bot, chatId, msgId) {
  const types = db.getFileTypes();
  let text = '🏷 *File Types Management*\n\n';
  if (!types.length) text += 'No types yet.\n';
  else types.forEach(t => { text += t.emoji + ' ' + t.name + '\n'; });
  const buttons = types.map(t => [
    { text: t.emoji + ' ' + t.name, callback_data: 'noop' },
    { text: '✏️', callback_data: 'admin_edit_type_' + t.id },
    { text: '🗑', callback_data: 'admin_del_type_' + t.id }
  ]);
  buttons.push([{ text: '➕ Add New Type', callback_data: 'admin_add_type' }]);
  buttons.push([{ text: '◀️ Admin Panel', callback_data: 'admin_menu' }]);
  return editOrSend(bot, chatId, msgId, text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
}

async function promptAddType(bot, chatId, userId) {
  setState(userId, { type: 'add_file_type_name' });
  bot.sendMessage(chatId, '🏷 Enter the name for the new file type:\n_(e.g. Correction, TP, Summary)_', { parse_mode: 'Markdown' });
}

async function promptEditType(bot, chatId, typeId, userId) {
  const t = db.getFileType(typeId);
  if (!t) return bot.sendMessage(chatId, '❌ Type not found.');
  setState(userId, { type: 'edit_file_type_name', typeId, oldEmoji: t.emoji });
  bot.sendMessage(chatId, '✏️ Current: ' + t.emoji + ' *' + t.name + '*\n\nEnter new name or type *skip*:', { parse_mode: 'Markdown' });
}

async function deleteFileType(bot, chatId, typeId, msgId) {
  db.deleteFileType(typeId);
  bot.answerCallbackQuery && null;
  await showFileTypes(bot, chatId, msgId);
}

// ── Add Content ───────────────────────────────────────────────────────────────
async function promptAddSpecialty(bot, chatId, userId) {
  setState(userId, { type: 'add_specialty' });
  bot.sendMessage(chatId, '🎓 Enter the specialty name:');
}

async function promptAddYear(bot, chatId, userId) {
  const specs = db.getSpecialties();
  if (!specs.length) return bot.sendMessage(chatId, '❌ No specialties yet.');
  const buttons = specs.map(s => [{ text: s.name, callback_data: 'admin_year_spec_' + s.id }]);
  bot.sendMessage(chatId, '📅 Choose specialty for the year:', { reply_markup: { inline_keyboard: buttons } });
}

async function promptAddSubject(bot, chatId, userId) {
  const specs = db.getSpecialties();
  if (!specs.length) return bot.sendMessage(chatId, '❌ No specialties yet.');
  const buttons = specs.map(s => [{ text: s.name, callback_data: 'admin_subj_spec_' + s.id }]);
  bot.sendMessage(chatId, '📖 Choose specialty:', { reply_markup: { inline_keyboard: buttons } });
}

async function promptUploadFile(bot, chatId, userId) {
  const specs = db.getSpecialties();
  if (!specs.length) return bot.sendMessage(chatId, '❌ No specialties yet.');
  const buttons = specs.map(s => [{ text: s.name, callback_data: 'admin_upl_spec_' + s.id }]);
  setState(userId, { type: 'select_spec_for_upload' });
  bot.sendMessage(chatId, '📤 *Upload File*\nStep 1: Choose specialty:', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
}

async function handleFileUpload(bot, msg) {
  const userId = msg.from.id;
  const state = global.userStates?.[userId];
  if (!state || state.type !== 'awaiting_file') return;
  let fileId, fileType;
  if (msg.document) { fileId = msg.document.file_id; fileType = 'document'; }
  else if (msg.photo) { fileId = msg.photo[msg.photo.length-1].file_id; fileType = 'photo'; }
  else return bot.sendMessage(msg.chat.id, '❌ Send a document or photo.');
  db.addFile(state.subjectId, state.fileTypeName, state.title, fileId, fileType, state.tags||'', userId);
  clearState(userId);
  bot.sendMessage(msg.chat.id, '✅ *File uploaded!*\n\n📁 ' + state.title + '\n🏷 ' + state.fileTypeName + '\n🔖 ' + (state.tags||'none'), { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🛠️ Admin Panel', callback_data: 'admin_menu' }]] } });
}

async function listFiles(bot, chatId) {
  const files = db.getAllFiles();
  if (!files.length) return bot.sendMessage(chatId, '📭 No files yet.');
  const buttons = files.map(f => [
    { text: '📁 ' + f.title + ' (' + f.type + ')', callback_data: 'file_' + f.id + '_0_0_0_' + f.type },
    { text: '✏️', callback_data: 'admin_edit_file_' + f.id },
    { text: '🗑', callback_data: 'admin_delete_file_' + f.id }
  ]);
  buttons.push([{ text: '◀️ Admin Panel', callback_data: 'admin_menu' }]);
  bot.sendMessage(chatId, '📋 *All Files (' + files.length + ')*', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
}

async function deleteFile(bot, chatId, fileId) {
  db.deleteFile(fileId);
  bot.sendMessage(chatId, '🗑 File deleted.', { reply_markup: { inline_keyboard: [[{ text: '◀️ Admin Panel', callback_data: 'admin_menu' }]] } });
}

async function promptEditFile(bot, chatId, fileId, userId) {
  const file = db.getFile(fileId);
  if (!file) return bot.sendMessage(chatId, '❌ File not found.');
  setState(userId, { type: 'edit_file_title', fileId });
  bot.sendMessage(chatId, '✏️ Current title: *' + file.title + '*\n\nEnter new title or type *skip*:', { parse_mode: 'Markdown' });
}

// ── Text Input Handler ─────────────────────────────────────────────────────────
async function handleTextInput(bot, msg, state) {
  const userId = msg.from.id; const chatId = msg.chat.id; const text = msg.text.trim();

  if (state.type === 'add_specialty') {
    try { db.addSpecialty(text); clearState(userId); bot.sendMessage(chatId, '✅ Specialty *' + text + '* added!', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🛠️ Admin Panel', callback_data: 'admin_menu' }]] } }); }
    catch(e) { clearState(userId); bot.sendMessage(chatId, '❌ Already exists.'); }

  } else if (state.type === 'add_year') {
    db.addYear(state.specId, text); clearState(userId);
    bot.sendMessage(chatId, '✅ Year *' + text + '* added!', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🛠️ Admin Panel', callback_data: 'admin_menu' }]] } });

  } else if (state.type === 'add_subject') {
    db.addSubject(state.yearId, state.specId, text); clearState(userId);
    bot.sendMessage(chatId, '✅ Subject *' + text + '* added!', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🛠️ Admin Panel', callback_data: 'admin_menu' }]] } });

  } else if (state.type === 'add_file_type_name') {
    setState(userId, { type: 'add_file_type_emoji', name: text });
    bot.sendMessage(chatId, '😀 Enter an emoji for *' + text + '*\n_(e.g. 📘, 📝, 🔥)_ or type *skip* for default 📁:', { parse_mode: 'Markdown' });

  } else if (state.type === 'add_file_type_emoji') {
    const emoji = text.toLowerCase() === 'skip' ? '📁' : text;
    try { db.addFileType(state.name, emoji); clearState(userId);
      bot.sendMessage(chatId, '✅ File type *' + emoji + ' ' + state.name + '* added!', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🏷 File Types', callback_data: 'admin_file_types' }]] } });
    } catch(e) { clearState(userId); bot.sendMessage(chatId, '❌ Already exists.'); }

  } else if (state.type === 'edit_file_type_name') {
    const newName = text.toLowerCase() === 'skip' ? null : text;
    setState(userId, { type: 'edit_file_type_emoji', typeId: state.typeId, newName, oldEmoji: state.oldEmoji });
    bot.sendMessage(chatId, '😀 Enter new emoji or type *skip* to keep ' + state.oldEmoji + ':', { parse_mode: 'Markdown' });

  } else if (state.type === 'edit_file_type_emoji') {
    const t = db.getFileType(state.typeId);
    const finalName = state.newName || t.name;
    const finalEmoji = text.toLowerCase() === 'skip' ? t.emoji : text;
    db.updateFileType(state.typeId, finalName, finalEmoji); clearState(userId);
    bot.sendMessage(chatId, '✅ Updated to *' + finalEmoji + ' ' + finalName + '*', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🏷 File Types', callback_data: 'admin_file_types' }]] } });

  } else if (state.type === 'upload_title') {
    setState(userId, { ...state, type: 'upload_tags', title: text });
    bot.sendMessage(chatId, '🔖 Enter tags or type *skip*:', { parse_mode: 'Markdown' });

  } else if (state.type === 'upload_tags') {
    const tags = text.toLowerCase() === 'skip' ? '' : text;
    setState(userId, { ...state, type: 'awaiting_file', tags });
    bot.sendMessage(chatId, '📎 Now *send the file*:', { parse_mode: 'Markdown' });

  } else if (state.type === 'edit_file_title') {
    if (text.toLowerCase() !== 'skip') db.updateFileTitle(state.fileId, text);
    setState(userId, { type: 'edit_file_tags', fileId: state.fileId });
    bot.sendMessage(chatId, '🔖 Enter new tags or type *skip*:', { parse_mode: 'Markdown' });

  } else if (state.type === 'edit_file_tags') {
    if (text.toLowerCase() !== 'skip') db.updateFileTags(state.fileId, text);
    clearState(userId);
    bot.sendMessage(chatId, '✅ File updated!', { reply_markup: { inline_keyboard: [[{ text: '📋 Files', callback_data: 'admin_list_files' }]] } });
  }
}

// ── Callback Router ────────────────────────────────────────────────────────────
async function handleAdminCallback(bot, data, chatId, userId) {
  if (data === 'admin_file_types') return showFileTypes(bot, chatId);
  if (data === 'admin_add_type') return promptAddType(bot, chatId, userId);
  if (data.startsWith('admin_edit_type_')) return promptEditType(bot, chatId, data.replace('admin_edit_type_',''), userId);
  if (data.startsWith('admin_del_type_')) return deleteFileType(bot, chatId, data.replace('admin_del_type_',''));

  if (data.startsWith('admin_year_spec_')) {
    global.userStates[userId] = { type: 'add_year', specId: data.replace('admin_year_spec_','') };
    return bot.sendMessage(chatId, '📅 Enter the year label (e.g. L1, L2, Master 1):');
  }
  if (data.startsWith('admin_subj_spec_')) {
    const specId = data.replace('admin_subj_spec_','');
    const years = db.getYears(specId);
    if (!years.length) return bot.sendMessage(chatId, '❌ No years for this specialty.');
    return bot.sendMessage(chatId, '📅 Choose year:', { reply_markup: { inline_keyboard: years.map(y=>[{ text: y.label, callback_data: 'admin_subj_year_'+specId+'_'+y.id }]) } });
  }
  if (data.startsWith('admin_subj_year_')) {
    const parts = data.replace('admin_subj_year_','').split('_');
    global.userStates[userId] = { type: 'add_subject', specId: parts[0], yearId: parts[1] };
    return bot.sendMessage(chatId, '📖 Enter the subject name:');
  }
  if (data.startsWith('admin_upl_spec_')) {
    const years = db.getYears(data.replace('admin_upl_spec_',''));
    if (!years.length) return bot.sendMessage(chatId, '❌ No years.');
    return bot.sendMessage(chatId, 'Step 2: Choose year:', { reply_markup: { inline_keyboard: years.map(y=>[{ text: y.label, callback_data: 'admin_upl_year__'+y.id }]) } });
  }
  if (data.startsWith('admin_upl_year__')) {
    const yearId = data.replace('admin_upl_year__','');
    const subjects = db.getSubjects(yearId);
    if (!subjects.length) return bot.sendMessage(chatId, '❌ No subjects.');
    return bot.sendMessage(chatId, 'Step 3: Choose subject:', { reply_markup: { inline_keyboard: subjects.map(s=>[{ text: s.name, callback_data: 'admin_upl_subj_'+s.id }]) } });
  }
  if (data.startsWith('admin_upl_subj_')) {
    const subjectId = data.replace('admin_upl_subj_','');
    const types = db.getFileTypes();
    if (!types.length) return bot.sendMessage(chatId, '❌ No file types. Add some from Admin Panel → Manage File Types.');
    const buttons = types.map(t => [{ text: t.emoji+' '+t.name, callback_data: 'admin_upl_type_'+subjectId+'_'+encodeURIComponent(t.name) }]);
    return bot.sendMessage(chatId, 'Step 4: Choose file type:', { reply_markup: { inline_keyboard: buttons } });
  }
  if (data.startsWith('admin_upl_type_')) {
    const idx = data.indexOf('_', 'admin_upl_type_'.length);
    const subjectId = data.substring('admin_upl_type_'.length, idx);
    const fileTypeName = decodeURIComponent(data.substring(idx+1));
    global.userStates[userId] = { type: 'upload_title', subjectId, fileTypeName };
    return bot.sendMessage(chatId, 'Step 5: Enter the file *title*:', { parse_mode: 'Markdown' });
  }
}

module.exports = {
  sendAdminMenu, promptAddSpecialty, promptAddYear, promptAddSubject,
  promptUploadFile, handleFileUpload, listFiles, deleteFile, promptEditFile,
  handleTextInput, handleAdminCallback, showFileTypes
};
