'use strict';
const { all, run, get } = require('../database/db');
const { build: kbBuild, btn: kbBtn } = require('../utils/keyboard');
const { eos } = require('../utils/helpers');

async function migrateGroupPanel() {
  const cols = [
    'ALTER TABLE group_chats ADD COLUMN IF NOT EXISTS welcome_enabled INTEGER DEFAULT 1',
    'ALTER TABLE group_chats ADD COLUMN IF NOT EXISTS welcome_msg     TEXT',
    'ALTER TABLE group_chats ADD COLUMN IF NOT EXISTS welcome_photo   TEXT',
    'ALTER TABLE group_chats ADD COLUMN IF NOT EXISTS goodbye_enabled INTEGER DEFAULT 0',
  ];
  for (const q of cols) await run(q, []).catch(() => {});
  console.log('[GroupPanel] Migration done');
}

async function showGroupPanel(ctx) {
  const groups = await all('SELECT * FROM group_chats ORDER BY title');
  const rows = groups.map(g => [kbBtn('👥 ' + (g.title || 'قروب ' + g.chat_id), 'gp_view_' + g.chat_id)]);
  rows.push([kbBtn('📢 رسالة للكل', 'gp_broadcast_0'), kbBtn('🎓 رسالة لتخصص', 'gp_broadcast_sp')]);
  rows.push([kbBtn('🎮 ألعاب القروب', 'mb_panel')]);
  rows.push([kbBtn('◀️ رجوع', 'mg_menu')]);
  return eos(ctx, '📋 *لوحة إدارة القروبات*\n━━━━━━━━━━━━━━━━━━\n👥 ' + groups.length + ' قروب مسجل', { parse_mode: 'Markdown', ...kbBuild(rows) });
}

async function showGroupDetail(ctx, chatId) {
  const g = await get('SELECT * FROM group_chats WHERE chat_id=$1', [chatId]);
  if (!g) return ctx.answerCbQuery('غير موجود', { show_alert: true }).catch(() => {});
  const spec = g.specialty_id ? await get('SELECT name FROM specialties WHERE id=$1', [g.specialty_id]).catch(() => null) : null;
  const mc = await get('SELECT COUNT(*) AS cnt FROM group_members WHERE chat_id=$1', [chatId]).catch(() => ({ cnt: 0 }));
  const wIcon   = g.welcome_enabled  ? '🟢' : '🔴';
  const byeIcon = g.goodbye_enabled  ? '🟢' : '🔴';
  const notIcon = g.notify_new_files ? '🟢' : '🔴';
  const text =
    '👥 *' + (g.title || 'قروب') + '*\n' +
    '━━━━━━━━━━━━━━━━━━\n' +
    'ID: `' + chatId + '`\n' +
    'التخصص: *' + (spec?.name || 'غير محدد') + '*\n' +
    'الأعضاء: *' + mc.cnt + '*\n\n' +
    wIcon   + ' رسالة ترحيب\n' +
    byeIcon + ' رسالة وداع\n' +
    notIcon + ' اشعار ملفات\n\n' +
    'نص الترحيب:\n_' + (g.welcome_msg || 'افتراضي').substring(0, 100) + '_';
  const rows = [
    [kbBtn('✏️ رسالة الترحيب', 'gp_setwelcome_' + chatId), kbBtn('🖼 صورة الترحيب', 'gp_setwphoto_' + chatId)],
    [kbBtn(g.welcome_enabled  ? '🔴 ايقاف الترحيب'       : '🟢 تفعيل الترحيب',       'gp_togglew_'      + chatId)],
    [kbBtn(g.goodbye_enabled  ? '🔴 ايقاف الوداع'        : '🟢 تفعيل الوداع',         'gp_togglebye_'    + chatId)],
    [kbBtn(g.notify_new_files ? '🔕 ايقاف اشعار الملفات' : '🔔 تفعيل اشعار الملفات', 'gp_togglenotify_' + chatId)],
    [kbBtn('🎓 تغيير التخصص', 'gp_setspec_' + chatId)],
    [kbBtn('📢 راسل هذا القروب', 'gp_msgone_' + chatId)],
    [kbBtn('◀️ رجوع', 'gp_panel')],
  ];
  return eos(ctx, text, { parse_mode: 'Markdown', ...kbBuild(rows) });
}

async function showBroadcastSpecPicker(ctx) {
  const specs = await all('SELECT * FROM specialties ORDER BY name').catch(() => []);
  const rows = specs.map(s => [kbBtn('🎓 ' + s.name, 'gp_broadcast_' + s.id)]);
  rows.push([kbBtn('📣 كل القروبات', 'gp_broadcast_0')]);
  rows.push([kbBtn('◀️ رجوع', 'gp_panel')]);
  return eos(ctx, '📢 *ارسال رسالة للقروبات*\n━━━━━━━━━━━━━━━━━━\n\nاختر التخصص:', { parse_mode: 'Markdown', ...kbBuild(rows) });
}

async function handleCallback(ctx, data) {
  const uid = ctx.uid;
  console.log('[gp] data='+data);
  if (data === 'gp_panel') return showGroupPanel(ctx);
  if (data === 'gp_broadcast_sp') return showBroadcastSpecPicker(ctx);

  if (data.startsWith('gp_broadcast_')) {
    const spId = data.replace('gp_broadcast_', '');
    await global.setState(uid, { type: 'gp_broadcast_msg', spId });
    return ctx.reply('📢 *ارسال رسالة للقروبات*\n\nارسل الرسالة:\n نص فقط\n صورة مع caption\n فيديو مع caption\n\n_(او /cancel)_', { parse_mode: 'Markdown' }).catch(() => {});
  }

  if (data.startsWith('gp_msgone_')) {
    const chatId = data.replace('gp_msgone_', '');
    await global.setState(uid, { type: 'gp_msgone', chatId });
    return ctx.reply('📢 ارسل الرسالة لهذا القروب:\n_(او /cancel)_', { parse_mode: 'Markdown' }).catch(() => {});
  }

  if (data.startsWith('gp_view_')) return showGroupDetail(ctx, data.replace('gp_view_', ''));

  if (data.startsWith('gp_togglew_')) {
    const chatId = data.replace('gp_togglew_', '');
    const g = await get('SELECT welcome_enabled FROM group_chats WHERE chat_id=$1', [chatId]);
    await run('UPDATE group_chats SET welcome_enabled=$1 WHERE chat_id=$2', [g?.welcome_enabled ? 0 : 1, chatId]);
    return showGroupDetail(ctx, chatId);
  }

  if (data.startsWith('gp_togglebye_')) {
    const chatId = data.replace('gp_togglebye_', '');
    const g = await get('SELECT goodbye_enabled FROM group_chats WHERE chat_id=$1', [chatId]);
    await run('UPDATE group_chats SET goodbye_enabled=$1 WHERE chat_id=$2', [g?.goodbye_enabled ? 0 : 1, chatId]);
    return showGroupDetail(ctx, chatId);
  }

  if (data.startsWith('gp_togglenotify_')) {
    const chatId = data.replace('gp_togglenotify_', '');
    const g = await get('SELECT notify_new_files FROM group_chats WHERE chat_id=$1', [chatId]);
    await run('UPDATE group_chats SET notify_new_files=$1 WHERE chat_id=$2', [g?.notify_new_files ? 0 : 1, chatId]);
    return showGroupDetail(ctx, chatId);
  }

  if (data.startsWith('gp_setwelcome_')) {
    const chatId = data.replace('gp_setwelcome_', '');
    await global.setState(uid, { type: 'gp_set_welcome', chatId });
    return ctx.reply('✏️ ارسل نص رسالة الترحيب:\n\nالمتغيرات: {name} اسم العضو | {id} معرفه | {date} التاريخ\n\n_(او /cancel)_', { parse_mode: 'Markdown' }).catch(() => {});
  }

  if (data.startsWith('gp_setwphoto_')) {
    const chatId = data.replace('gp_setwphoto_', '');
    await global.setState(uid, { type: 'gp_set_wphoto', chatId });
    return ctx.reply('🖼 ارسل صورة الترحيب:\n_(او /cancel)_', { parse_mode: 'Markdown' }).catch(() => {});
  }

  if (data.startsWith('gp_setspec_')) {
    const chatId = data.replace('gp_setspec_', '');
    const specs = await all('SELECT * FROM specialties ORDER BY name').catch(() => []);
    const rows = specs.map(s => [kbBtn('🎓 ' + s.name, 'gp_dospec_' + chatId + '_' + s.id)]);
    rows.push([kbBtn('◀️ رجوع', 'gp_view_' + chatId)]);
    return eos(ctx, 'اختر التخصص:', { ...kbBuild(rows) });
  }

  if (data.startsWith('gp_dospec_')) {
    const parts = data.replace('gp_dospec_', '').split('_');
    const chatId = parts[0];
    const spId = parts[1];
    await run('UPDATE group_chats SET specialty_id=$1 WHERE chat_id=$2', [spId, chatId]);
    ctx.answerCbQuery('تم تحديث التخصص').catch(() => {});
    return showGroupDetail(ctx, chatId);
  }
}

async function handleText(ctx, text, state) {
  if (state.type === 'gp_set_welcome') {
    await run('UPDATE group_chats SET welcome_msg=$1 WHERE chat_id=$2', [text, state.chatId]);
    await global.delState(ctx.uid);
    await ctx.reply('تم تحديث رسالة الترحيب!').catch(() => {});
    return showGroupDetail(ctx, state.chatId);
  }
  if (state.type === 'gp_broadcast_msg') {
    await global.delState(ctx.uid);
    return _doBroadcast(ctx, state.spId, text, null, null);
  }
  if (state.type === 'gp_msgone') {
    await global.delState(ctx.uid);
    try {
      await ctx.telegram.sendMessage(state.chatId, '📢 *رسالة من الادارة*\n\n' + text, { parse_mode: 'Markdown' });
      return ctx.reply('تم الارسال!', kbBuild([[kbBtn('◀️ رجوع', 'gp_view_' + state.chatId)]])).catch(() => {});
    } catch (e) { return ctx.reply('فشل: ' + e.message).catch(() => {}); }
  }
}

async function handleMedia(ctx, state) {
  const msg = ctx.message;
  const caption = msg.caption || '';

  if (state.type === 'gp_set_wphoto') {
    const photo = msg.photo;
    if (!photo?.length) return ctx.reply('ارسل صورة صحيحة').catch(() => {});
    const fileId = photo[photo.length - 1].file_id;
    await run('UPDATE group_chats SET welcome_photo=$1 WHERE chat_id=$2', [fileId, state.chatId]);
    await global.delState(ctx.uid);
    await ctx.reply('تم تحديث صورة الترحيب!').catch(() => {});
    return showGroupDetail(ctx, state.chatId);
  }

  if (state.type === 'gp_broadcast_msg') {
    await global.delState(ctx.uid);
    let fileId, mediaType;
    if (msg.photo)         { fileId = msg.photo[msg.photo.length-1].file_id; mediaType = 'photo'; }
    else if (msg.video)    { fileId = msg.video.file_id;    mediaType = 'video'; }
    else if (msg.document) { fileId = msg.document.file_id; mediaType = 'document'; }
    return _doBroadcast(ctx, state.spId, caption || 'اشعار من الادارة', fileId, mediaType);
  }

  if (state.type === 'gp_msgone') {
    await global.delState(ctx.uid);
    try {
      if (msg.photo)
        await ctx.telegram.sendPhoto(state.chatId, msg.photo[msg.photo.length-1].file_id, { caption: caption || 'رسالة من الادارة', parse_mode: 'Markdown' });
      else if (msg.video)
        await ctx.telegram.sendVideo(state.chatId, msg.video.file_id, { caption: caption || 'رسالة من الادارة', parse_mode: 'Markdown' });
      return ctx.reply('تم الارسال!').catch(() => {});
    } catch (e) { return ctx.reply('فشل: ' + e.message).catch(() => {}); }
  }
}

async function _doBroadcast(ctx, spId, text, fileId, mediaType) {
  const groups = spId === '0'
    ? await all('SELECT chat_id FROM group_chats')
    : await all('SELECT chat_id FROM group_chats WHERE specialty_id=$1', [spId]);

  if (!groups.length)
    return ctx.reply('لا يوجد قروبات', kbBuild([[kbBtn('◀️ رجوع', 'gp_panel')]])).catch(() => {});

  const prog = await ctx.reply('جاري الارسال... ' + groups.length + ' قروب', { parse_mode: 'Markdown' }).catch(() => null);
  let sent = 0, fail = 0;
  const msgText = '📢 *رسالة من الادارة*\n\n' + text;
  const CHUNK = 5;

  for (let i = 0; i < groups.length; i += CHUNK) {
    const chunk = groups.slice(i, i + CHUNK);
    const results = await Promise.allSettled(chunk.map(async g => {
      if (mediaType === 'photo' && fileId)
        return ctx.telegram.sendPhoto(g.chat_id, fileId, { caption: msgText, parse_mode: 'Markdown' });
      else if (mediaType === 'video' && fileId)
        return ctx.telegram.sendVideo(g.chat_id, fileId, { caption: msgText, parse_mode: 'Markdown' });
      else if (mediaType === 'document' && fileId)
        return ctx.telegram.sendDocument(g.chat_id, fileId, { caption: msgText, parse_mode: 'Markdown' });
      else
        return ctx.telegram.sendMessage(g.chat_id, msgText, { parse_mode: 'Markdown' });
    }));
    results.forEach(r => r.status === 'fulfilled' ? sent++ : fail++);
    if (i + CHUNK < groups.length) await new Promise(r => setTimeout(r, 1000));
  }

  if (prog) ctx.telegram.deleteMessage(ctx.chat.id, prog.message_id).catch(() => {});

  return ctx.reply(
    'اكتمل الارسال!\nاجمالي: *' + groups.length + '*\nنجح: *' + sent + '*\nفشل: *' + fail + '*',
    { parse_mode: 'Markdown', ...kbBuild([[kbBtn('◀️ رجوع', 'gp_panel')]]) }
  ).catch(() => {});
}

module.exports = { showMainMenu, showGroupPanel, handleCallback, handleText, handleMedia, migrateGroupPanel };

// ══════════════════════════════════════════════════════════
// القائمة الرئيسية للقروبات
// ══════════════════════════════════════════════════════════
async function showMainMenu(ctx) {
  const groups  = await all('SELECT COUNT(*) AS cnt FROM group_chats').then(r => r[0]?.cnt || 0).catch(() => 0);
  const channels = await all('SELECT COUNT(*) AS cnt FROM group_chats WHERE is_channel=1').then(r => r[0]?.cnt || 0).catch(() => 0);

  const rows = [
    [kbBtn('👥 إدارة القروبات',         'gp_panel')],
    [kbBtn('📣 إشعار القروبات',          'mg_notify_groups')],
    [kbBtn('🎮 ألعاب القروب',            'mb_panel')],
    [kbBtn('◀️ رجوع',                   'mg_menu')],
  ];

  return eos(ctx,
    '👥 *القروبات والقنوات*\n' +
    '━━━━━━━━━━━━━━━━━━\n\n' +
    '👥 القروبات: *' + groups + '*\n',
    { parse_mode: 'Markdown', ...kbBuild(rows) }
  );
}
