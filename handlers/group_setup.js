'use strict';
const { get, run, all } = require('../database/db');
const { build, btn }    = require('../utils/keyboard');
const { eos }           = require('../utils/helpers');

// واجهة إعداد القروب للأدمن (ليس المالك)
async function showGroupSetup(ctx, chatId) {
  const g = await get('SELECT * FROM group_chats WHERE chat_id=$1', [chatId]).catch(() => null);
  if (!g) return ctx.reply('⚠️ هذا القروب غير مسجّل.').catch(() => {});

  // تحقق أن المستخدم أدمن في هذا القروب
  const uid = ctx.uid || ctx.from?.id;
  try {
    const m = await ctx.telegram.getChatMember(parseInt(chatId), uid);
    if (!['administrator','creator'].includes(m?.status)) {
      return ctx.reply('⛔ أنت لست أدمن في هذا القروب.').catch(() => {});
    }
  } catch(_) {
    return ctx.reply('⚠️ تعذّر التحقق من صلاحياتك.').catch(() => {});
  }

  const on = '🟢', off = '🔴';
  const spec = await get('SELECT s.name FROM specialties s WHERE s.id=$1', [g.specialty_id]).catch(() => null);

  let text = '⚙️ *إعداد القروب*\n';
  text += '━━━━━━━━━━━━━━━\n';
  text += '👥 *' + (g.title || 'القروب') + '*\n\n';
  text += '🎓 التخصص: *' + (spec?.name || 'غير محدد') + '*\n';
  text += (g.welcome_enabled ? on : off) + ' رسالة الترحيب\n';
  text += (g.notify_new_files ? on : off) + ' إشعار الملفات الجديدة\n';

  const rows = [
    [btn('✏️ رسالة الترحيب',     'gs_setwelcome_'  + chatId)],
    [btn('🖼 صورة الترحيب',       'gs_setwphoto_'   + chatId)],
    [btn((g.welcome_enabled ? '🔴 إيقاف' : '🟢 تفعيل') + ' الترحيب', 'gs_togglew_' + chatId)],
    [btn((g.notify_new_files ? '🔕 إيقاف' : '🔔 تفعيل') + ' إشعار الملفات', 'gs_togglenotify_' + chatId)],
    [btn('🎓 تغيير التخصص',       'gs_setspec_'     + chatId)],
    [btn('📜 قواعد القروب',        'gs_setrules_'    + chatId)],
    [btn('❌ إغلاق', 'gs_close')],
  ];
  return eos(ctx, text, { parse_mode: 'Markdown', ...build(rows) });
}

async function handleGroupSetupCallback(ctx, data) {
  const uid = ctx.uid || ctx.from?.id;
  ctx.answerCbQuery('').catch(() => {});

  if (data === 'gs_close') return ctx.deleteMessage().catch(() => {});

  const chatId = data.split('_').slice(-1)[0];

  if (data.startsWith('gs_togglew_')) {
    const g = await get('SELECT welcome_enabled FROM group_chats WHERE chat_id=$1', [chatId]);
    await run('UPDATE group_chats SET welcome_enabled=$1 WHERE chat_id=$2', [g?.welcome_enabled ? 0 : 1, chatId]);
    return showGroupSetup(ctx, chatId);
  }
  if (data.startsWith('gs_togglenotify_')) {
    const g = await get('SELECT notify_new_files FROM group_chats WHERE chat_id=$1', [chatId]);
    await run('UPDATE group_chats SET notify_new_files=$1 WHERE chat_id=$2', [g?.notify_new_files ? 0 : 1, chatId]);
    return showGroupSetup(ctx, chatId);
  }
  if (data.startsWith('gs_setwelcome_')) {
    await require('../utils/stateManager').setState(uid, { type: 'gs_set_welcome', chatId });
    return ctx.reply('✏️ أرسل رسالة الترحيب:\nالمتغيرات: {name} الاسم | {count} الأعضاء\n_(/cancel للإلغاء)_', { parse_mode: 'Markdown' }).catch(() => {});
  }
  if (data.startsWith('gs_setwphoto_')) {
    await require('../utils/stateManager').setState(uid, { type: 'gs_set_wphoto', chatId });
    return ctx.reply('🖼 أرسل صورة الترحيب:\n_(/cancel للإلغاء)_', { parse_mode: 'Markdown' }).catch(() => {});
  }
  if (data.startsWith('gs_setspec_')) {
    const specs = await all('SELECT * FROM specialties ORDER BY name').catch(() => []);
    const rows = specs.map(s => [btn('🎓 ' + s.name, 'gs_dospec_' + chatId + '_' + s.id)]);
    rows.push([btn('◀️ رجوع', 'gs_back_' + chatId)]);
    return eos(ctx, 'اختر التخصص:', { ...build(rows) });
  }
  if (data.startsWith('gs_dospec_')) {
    const parts = data.replace('gs_dospec_', '').split('_');
    await run('UPDATE group_chats SET specialty_id=$1 WHERE chat_id=$2', [parts[1], parts[0]]);
    ctx.answerCbQuery('✅ تم').catch(() => {});
    return showGroupSetup(ctx, parts[0]);
  }
  if (data.startsWith('gs_setrules_')) {
    await require('../utils/stateManager').setState(uid, { type: 'gs_set_rules', chatId });
    return ctx.reply('📜 أرسل قواعد القروب:\n_(/cancel للإلغاء)_', { parse_mode: 'Markdown' }).catch(() => {});
  }
  if (data.startsWith('gs_back_')) return showGroupSetup(ctx, chatId);
}

async function handleGroupSetupText(ctx, state) {
  const { delState } = require('../utils/stateManager');
  if (state.type === 'gs_set_welcome') {
    const text = ctx.message.text;
    await run('UPDATE group_chats SET welcome_msg=$1 WHERE chat_id=$2', [text, state.chatId]).catch(() => {});
    await run('INSERT INTO group_welcome(chat_id,message,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(chat_id) DO UPDATE SET message=$2,updated_at=NOW()', [state.chatId, text]).catch(() => {});
    await delState(ctx.uid);
    await ctx.reply('✅ تم حفظ رسالة الترحيب!').catch(() => {});
    return showGroupSetup(ctx, state.chatId);
  }
  if (state.type === 'gs_set_rules') {
    await run('UPDATE group_chats SET rules=$1 WHERE chat_id=$2', [ctx.message.text, state.chatId]).catch(() => {});
    await delState(ctx.uid);
    await ctx.reply('✅ تم حفظ القواعد!').catch(() => {});
    return showGroupSetup(ctx, state.chatId);
  }
}

async function handleGroupSetupMedia(ctx, state) {
  if (state.type === 'gs_set_wphoto') {
    const photo = ctx.message?.photo;
    if (!photo?.length) return ctx.reply('⚠️ أرسل صورة').catch(() => {});
    const fileId = photo[photo.length - 1].file_id;
    await run('UPDATE group_chats SET welcome_photo=$1 WHERE chat_id=$2', [fileId, state.chatId]).catch(() => {});
    await run('INSERT INTO group_welcome(chat_id,image_file_id,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(chat_id) DO UPDATE SET image_file_id=$2,updated_at=NOW()', [state.chatId, fileId]).catch(() => {});
    await require('../utils/stateManager').delState(ctx.uid);
    await ctx.reply('✅ تم حفظ الصورة!').catch(() => {});
    return showGroupSetup(ctx, state.chatId);
  }
}

module.exports = { showGroupSetup, handleGroupSetupCallback, handleGroupSetupText, handleGroupSetupMedia };
