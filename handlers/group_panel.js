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
  const groups = await all('SELECT * FROM group_chats ORDER BY title').catch(() => []);
  const total = groups.length;

  let text = '📋 *لوحة إدارة القروبات*\n';
  text += '━━━━━━━━━━━━━━━━━━\n\n';
  text += '👥 *القروبات المسجلة:* ' + total + '\n';

  const rows = [];

  if (!groups.length) {
    text += '\n_لا توجد قروبات بعد_\n';
    text += '_أضف البوت لقروب وسيظهر هنا_';
  } else {
    groups.forEach(g => {
      const sp = g.specialty_id ? '🎓' : '📚';
      const w  = g.welcome_enabled ? '✅' : '❌';
      rows.push([kbBtn(sp + ' ' + (g.title || 'قروب ' + g.chat_id).substring(0,30) + ' ' + w, 'gp_view_' + g.chat_id)]);
    });
  }

  rows.push([
    kbBtn('📜 تعديل القواعد', 'gp_setrules_' + chatId),
    kbBtn('📢 رسالة للكل',    'gp_broadcast_0'),
    kbBtn('🎓 رسالة لتخصص', 'gp_broadcast_sp'),
  ]);
  rows.push([kbBtn('🎮 ألعاب القروب', 'mb_panel')]);
  rows.push([kbBtn('◀️ رجوع', 'mg_menu')]);

  return eos(ctx, text, { parse_mode: 'Markdown', ...kbBuild(rows) });
}

async function showGroupDetail(ctx, chatId) {
  const [g, spec, mc, warns, bans] = await Promise.all([
    get('SELECT * FROM group_chats WHERE chat_id=$1', [chatId]),
    get('SELECT s.name FROM specialties s JOIN group_chats g ON g.specialty_id=s.id WHERE g.chat_id=$1', [chatId]).catch(() => null),
    get('SELECT COUNT(*) AS cnt FROM group_members WHERE chat_id=$1', [chatId]).catch(() => ({ cnt: 0 })),
    get('SELECT COUNT(*) AS cnt FROM group_warns WHERE chat_id=$1', [chatId]).catch(() => ({ cnt: 0 })),
    get('SELECT COUNT(*) AS cnt FROM group_bans WHERE chat_id=$1', [chatId]).catch(() => ({ cnt: 0 })),
  ]);
  if (!g) return ctx.answerCbQuery('غير موجود', { show_alert: true }).catch(() => {});

  const on  = '🟢';
  const off = '🔴';

  let text = '👥 *' + (g.title || 'قروب').substring(0,30) + '*\n';
  text += '━━━━━━━━━━━━━━━━━━\n\n';
  text += '🆔 `' + chatId + '`\n';
  text += '🎓 التخصص: *' + (spec?.name || 'غير محدد') + '*\n';
  text += '👤 الأعضاء المسجلون: *' + mc.cnt + '*\n';
  text += '⚠️ التحذيرات: *' + warns.cnt + '* | 🚫 المحظورون: *' + bans.cnt + '*\n\n';
  text += '━━━━━━━━━━━━━━━━━━\n';
  text += '⚙️ *الإعدادات:*\n';
  text += (g.welcome_enabled  ? on : off) + ' رسالة الترحيب\n';
  text += (g.goodbye_enabled  ? on : off) + ' رسالة الوداع\n';
  text += (g.notify_new_files ? on : off) + ' إشعار الملفات الجديدة\n';
  text += (g.anti_spam        ? on : off) + ' مكافحة السبام\n';
  text += (g.anti_link        ? on : off) + ' حجب الروابط\n';
  text += (g.anti_flood       ? on : off) + ' مكافحة الفلود\n';

  const rows = [
    // ── الترحيب ──
    [kbBtn('✏️ رسالة الترحيب', 'gp_setwelcome_' + chatId),
     kbBtn('🖼 صورة الترحيب',  'gp_setwphoto_'  + chatId)],
    // ── تبديل الإعدادات ──
    [kbBtn(g.welcome_enabled  ? '🔴 إيقاف الترحيب'  : '🟢 تفعيل الترحيب',  'gp_togglew_'      + chatId),
     kbBtn(g.goodbye_enabled  ? '🔴 إيقاف الوداع'   : '🟢 تفعيل الوداع',   'gp_togglebye_'    + chatId)],
    [kbBtn(g.notify_new_files ? '🔕 إيقاف الإشعار'  : '🔔 تفعيل الإشعار',  'gp_togglenotify_' + chatId),
     kbBtn('🎓 تغيير التخصص',                                                'gp_setspec_'      + chatId)],
    // ── الحماية ──
    [kbBtn(g.anti_spam  ? '🔴 إيقاف Anti-Spam'  : '🛡 تفعيل Anti-Spam',  'gp_togglespam_'  + chatId),
     kbBtn(g.anti_link  ? '🔴 السماح بالروابط'   : '🔗 حجب الروابط',      'gp_togglelink_'  + chatId)],
    [kbBtn(g.anti_flood ? '🔴 إيقاف Anti-Flood' : '🌊 تفعيل Anti-Flood', 'gp_toggleflood_' + chatId)],
    // ── إجراءات ──
    [kbBtn('📢 راسل هذا القروب', 'gp_msgone_'  + chatId),
     kbBtn('📊 إحصائيات',        'grp_stats_'  + chatId)],
    [kbBtn('👥 الأعضاء',         'grp_main_'   + chatId),
     kbBtn('🚪 مغادرة القروب',   'leave_grp_'  + chatId)],
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
  if (data === 'gp_panel') return showGroupPanel(ctx);

  // ── تبديل anti-spam/link/flood ──
  const gpToggles = {
    'gp_togglespam_':  'anti_spam',
    'gp_togglelink_':  'anti_link',
    'gp_toggleflood_': 'anti_flood',
  };
  for (const [prefix, col] of Object.entries(gpToggles)) {
    if (data.startsWith(prefix)) {
      const cid = data.replace(prefix, '');
      const cur = await get('SELECT ' + col + ' FROM group_chats WHERE chat_id=$1', [cid]).catch(() => null);
      const newVal = cur?.[col] ? 0 : 1;
      await run('UPDATE group_chats SET ' + col + '=$1 WHERE chat_id=$2', [newVal, cid]).catch(() => {});
      ctx.answerCbQuery(newVal ? '✅ تم التفعيل' : '❌ تم الإيقاف').catch(() => {});
      return showGroupDetail(ctx, cid);
    }
  }
  if (data === 'gp_broadcast_sp') return showBroadcastSpecPicker(ctx);

  // ── تعديل قواعد القروب ──
  if (data.startsWith('gp_setrules_')) {
    const chatId = data.replace('gp_setrules_', '');
    await require('../utils/stateManager').setState(ctx.from.id, { type: 'gp_set_rules', chatId });
    return ctx.reply(
      '📜 *تعديل قواعد القروب*\n\nأرسل القواعد الجديدة:\n_(أو /cancel للإلغاء)_\n\n' +
      '💡 يمكنك استخدام الأرقام والإيموجي:\n' +
      '1️⃣ الاحترام المتبادل\n' +
      '2️⃣ ممنوع الفلود...',
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }

  if (data.startsWith('gp_broadcast_')) {
    const spId = data.replace('gp_broadcast_', '');
    await require('../utils/stateManager').setState(uid, { type: 'gp_broadcast_msg', spId });
    return ctx.reply('📢 *ارسال رسالة للقروبات*\n\nارسل الرسالة:\n نص فقط\n صورة مع caption\n فيديو مع caption\n\n_(او /cancel)_', { parse_mode: 'Markdown' }).catch(() => {});
  }

  if (data.startsWith('gp_msgone_')) {
    const chatId = data.replace('gp_msgone_', '');
    await require('../utils/stateManager').setState(uid, { type: 'gp_msgone', chatId });
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
    await require('../utils/stateManager').setState(uid, { type: 'gp_set_welcome', chatId });
    return ctx.reply('✏️ ارسل نص رسالة الترحيب:\n\nالمتغيرات: {name} اسم العضو | {id} معرفه | {date} التاريخ\n\n_(او /cancel)_', { parse_mode: 'Markdown' }).catch(() => {});
  }

  if (data.startsWith('gp_setwphoto_')) {
    const chatId = data.replace('gp_setwphoto_', '');
    await require('../utils/stateManager').setState(uid, { type: 'gp_set_wphoto', chatId });
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
    // حفظ في الجدولين
    await run('UPDATE group_chats SET welcome_msg=$1 WHERE chat_id=$2', [text, state.chatId]).catch(() => {});
    await run(
      `INSERT INTO group_welcome(chat_id, message, updated_at) VALUES($1,$2,NOW())
       ON CONFLICT(chat_id) DO UPDATE SET message=$2, updated_at=NOW()`,
      [state.chatId, text]
    ).catch(() => {});
    await require('../utils/stateManager').delState(ctx.uid);
    await ctx.reply('✅ تم حفظ رسالة الترحيب!\n\n📝 المتغيرات:\n`{name}` الاسم | `{id}` المعرف\n`{spec}` التخصص | `{date}` التاريخ\n`{count}` عدد الأعضاء | `{group}` اسم القروب', { parse_mode: 'Markdown' }).catch(() => {});
    return showGroupDetail(ctx, state.chatId);
  }
  if (state.type === 'gp_broadcast_msg') {
    await require('../utils/stateManager').delState(ctx.uid);
    return _doBroadcast(ctx, state.spId, text, null, null);
  }
  if (state.type === 'gp_msgone') {
    await require('../utils/stateManager').delState(ctx.uid);
    try {
      console.log('[gp_msgone] sending to:', state.chatId);
      await ctx.telegram.sendMessage(state.chatId, '📢 *رسالة من الادارة*\n\n' + text, { parse_mode: 'Markdown' });
      return ctx.reply('تم الارسال!', kbBuild([[kbBtn('◀️ رجوع', 'gp_view_' + state.chatId)]])).catch(() => {});
    } catch (e) { return ctx.reply('فشل: ' + e.message).catch(() => {}); }
  }
}

async function handleMedia(ctx, state) {
  // صورة الترحيب
  if (state.type === 'gp_set_wphoto') {
    const photo = ctx.message?.photo;
    const fileId = photo ? photo[photo.length - 1].file_id : null;
    if (!fileId) return ctx.reply('⚠️ أرسل صورة صحيحة').catch(() => {});
    await run(
      `INSERT INTO group_welcome(chat_id, image_file_id, updated_at) VALUES($1,$2,NOW())
       ON CONFLICT(chat_id) DO UPDATE SET image_file_id=$2, updated_at=NOW()`,
      [state.chatId, fileId]
    ).catch(() => {});
    await run('UPDATE group_chats SET welcome_photo=$1 WHERE chat_id=$2', [fileId, state.chatId]).catch(() => {});
    await require('../utils/stateManager').delState(ctx.uid);
    await ctx.reply('✅ تم حفظ صورة الترحيب!').catch(() => {});
    return showGroupDetail(ctx, state.chatId);
  }
  const msg = ctx.message;
  const caption = msg.caption || '';

  if (state.type === 'gp_set_wphoto') {
    const photo = msg.photo;
    if (!photo?.length) return ctx.reply('ارسل صورة صحيحة').catch(() => {});
    const fileId = photo[photo.length - 1].file_id;
    await run('UPDATE group_chats SET welcome_photo=$1 WHERE chat_id=$2', [fileId, state.chatId]);
    await require('../utils/stateManager').delState(ctx.uid);
    await ctx.reply('تم تحديث صورة الترحيب!').catch(() => {});
    return showGroupDetail(ctx, state.chatId);
  }

  if (state.type === 'gp_set_wphoto') {
    // صورة ترحيب — يجب أن تكون صورة
    await require('../utils/stateManager').delState(ctx.uid);
    await ctx.reply('⚠️ أرسل صورة وليس نصاً').catch(() => {});
    return;
  }
  if (state.type === 'gp_broadcast_msg') {
    await require('../utils/stateManager').delState(ctx.uid);
    let fileId, mediaType;
    if (msg.photo)         { fileId = msg.photo[msg.photo.length-1].file_id; mediaType = 'photo'; }
    else if (msg.video)    { fileId = msg.video.file_id;    mediaType = 'video'; }
    else if (msg.document) { fileId = msg.document.file_id; mediaType = 'document'; }
    else if (msg.sticker)  { fileId = msg.sticker.file_id;  mediaType = 'sticker'; }
    else if (msg.voice)    { fileId = msg.voice.file_id;    mediaType = 'voice'; }
    return _doBroadcast(ctx, state.spId, caption || 'اشعار من الادارة', fileId, mediaType);
  }

  if (state.type === 'gp_msgone') {
    await require('../utils/stateManager').delState(ctx.uid);
    try {
      if (msg.photo)
        await ctx.telegram.sendPhoto(state.chatId, msg.photo[msg.photo.length-1].file_id, { caption: caption || 'رسالة من الادارة', parse_mode: 'Markdown' });
      else if (msg.video)
        await ctx.telegram.sendVideo(state.chatId, msg.video.file_id, { caption: caption || 'رسالة من الادارة', parse_mode: 'Markdown' });
      else if (msg.voice)
        await ctx.telegram.sendVoice(state.chatId, msg.voice.file_id);
      else if (msg.sticker)
        await ctx.telegram.sendSticker(state.chatId, msg.sticker.file_id);
      else if (msg.audio)
        await ctx.telegram.sendAudio(state.chatId, msg.audio.file_id);
      return ctx.reply('تم الارسال!').catch(() => {});
    } catch (e) {
      if (e.message?.includes('TOPIC_CLOSED') || e.message?.includes('CHAT_WRITE_FORBIDDEN')) {
        return ctx.reply('تم الارسال (topic مغلق - تجاهل)').catch(() => {});
      }
      return ctx.reply('فشل: ' + e.message).catch(() => {});
    }
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
      else if (mediaType === 'sticker' && fileId)
        return ctx.telegram.sendSticker(g.chat_id, fileId);
      else if (mediaType === 'voice' && fileId)
        return ctx.telegram.sendVoice(g.chat_id, fileId);
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

// ══════════════════════════════════════════════════════════
// القائمة الرئيسية للقروبات
// ══════════════════════════════════════════════════════════
async function showMainMenu(ctx) {
  const groups  = await all('SELECT COUNT(*) AS cnt FROM group_chats').then(r => r[0]?.cnt || 0).catch(() => 0);
  const channels = await all('SELECT COUNT(*) AS cnt FROM group_chats WHERE specialty_id IS NOT NULL').then(r => r[0]?.cnt || 0).catch(() => 0);

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

module.exports = { showMainMenu, showGroupPanel, handleCallback, handleText, handleMedia, migrateGroupPanel };
