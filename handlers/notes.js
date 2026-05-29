'use strict';
const { get, run, all } = require('../database/db');
const { build, btn }   = require('../utils/keyboard');

/* ── Init table ───────────────────────────────────────────── */
let _ready = false;
async function initNotes() {
  if (_ready) return;
  await run(`CREATE TABLE IF NOT EXISTS notes (
    id           SERIAL PRIMARY KEY,
    title        TEXT,
    content      TEXT,
    media_file_id TEXT,
    media_type   TEXT DEFAULT 'text',
    url          TEXT,
    is_pinned    INTEGER DEFAULT 0,
    is_deleted   INTEGER DEFAULT 0,
    created_by   BIGINT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`).catch(() => {});
  _ready = true;
}

/* ── Helpers ──────────────────────────────────────────────── */
const esc = s => String(s||'').replace(/[_*[\]()~`>#+=|{}.!-]/g,'\\$&');
const typeIcon = t => t==='photo'?'🖼️':t==='video'?'🎬':t==='link'?'🔗':'📝';

function buildNoteText(n, idx, total) {
  const pin   = n.is_pinned ? '📌 ' : '';
  const icon  = typeIcon(n.media_type||'text');
  const date  = new Date(n.created_at).toLocaleDateString('ar');
  let text = `${pin}${icon} *${esc(n.title||'ملاحظة')}*\n`;
  text += `━━━━━━━━━━━━━━━\n`;
  if (n.content) text += `${esc(n.content)}\n`;
  if (n.url)     text += `\n🔗 ${n.url}\n`;
  text += `\n📅 ${date}`;
  if (total > 1) text += `  •  ${idx+1}/${total}`;
  return text;
}

function buildNoteKeyboard(n, idx, total, isAdmin) {
  const rows = [];
  // navigation
  const nav = [];
  if (idx > 0)        nav.push(btn('◀️ السابق', `note_nav_${idx-1}`));
  if (idx < total-1)  nav.push(btn('التالي ▶️', `note_nav_${idx+1}`));
  if (nav.length) rows.push(nav);
  // admin actions
  if (isAdmin) {
    rows.push([
      btn(n.is_pinned ? '📌 إلغاء التثبيت' : '📌 تثبيت', `note_pin_${n.id}`),
      btn('🗑 حذف', `note_del_${n.id}`),
    ]);
    rows.push([btn('➕ إضافة ملاحظة', 'note_add')]);
  }
  rows.push([btn('🏠 رئيسية', 'main_menu')]);
  return build(rows);
}

/* ── Get active notes ──────────────────────────────────────── */
async function getNotes() {
  return all(
    `SELECT * FROM notes WHERE is_deleted=0
     ORDER BY is_pinned DESC, created_at DESC`
  ).catch(() => []);
}

/* ── Show notes list ───────────────────────────────────────── */
async function showNotes(ctx, idx = 0) {
  await initNotes();
  const notes = await getNotes();

  if (!notes.length) {
    return ctx.reply(
      '📝 *لا توجد ملاحظات بعد*\n\n' +
      (ctx.isOwner||ctx.isAdmin ? 'اضغط ➕ لإضافة ملاحظة جديدة.' : ''),
      {
        parse_mode: 'Markdown',
        ...build([
          ...(ctx.isOwner||ctx.isAdmin ? [[btn('➕ إضافة ملاحظة','note_add')]] : []),
          [btn('🏠 رئيسية','main_menu')],
        ]),
      }
    ).catch(() => {});
  }

  idx = Math.max(0, Math.min(idx, notes.length - 1));
  const n   = notes[idx];
  const txt = buildNoteText(n, idx, notes.length);
  const kb  = buildNoteKeyboard(n, idx, notes.length, ctx.isOwner||ctx.isAdmin);

  try {
    if (n.media_file_id && n.media_type === 'photo')
      return await ctx.replyWithPhoto(n.media_file_id, { caption: txt, parse_mode: 'Markdown', ...kb });
    if (n.media_file_id && n.media_type === 'video')
      return await ctx.replyWithVideo(n.media_file_id, { caption: txt, parse_mode: 'Markdown', ...kb });
    if (n.media_file_id && n.media_type === 'document')
      return await ctx.replyWithDocument(n.media_file_id, { caption: txt, parse_mode: 'Markdown', ...kb });
    return await ctx.reply(txt, { parse_mode: 'Markdown', ...kb });
  } catch(err) { require('../utils/logger').debug('[catch]', err.message); }
}

/* ── Edit note message (for navigation) ───────────────────── */
async function editNote(ctx, idx) {
  await initNotes();
  const notes = await getNotes();
  if (!notes.length) return showNotes(ctx, 0);
  idx = Math.max(0, Math.min(idx, notes.length - 1));
  const n   = notes[idx];
  const txt = buildNoteText(n, idx, notes.length);
  const kb  = buildNoteKeyboard(n, idx, notes.length, ctx.isOwner||ctx.isAdmin);

  // If media changed type, delete and resend
  const prevType = ctx.callbackQuery?.message?.photo ? 'photo'
    : ctx.callbackQuery?.message?.video ? 'video'
    : ctx.callbackQuery?.message?.document ? 'document' : 'text';
  const newType = n.media_file_id ? (n.media_type||'text') : 'text';

  if (prevType !== newType) {
    await ctx.deleteMessage().catch(() => {});
    return showNotes(ctx, idx);
  }

  try {
    if (n.media_file_id) {
      await ctx.editMessageCaption(txt, { parse_mode: 'Markdown', ...kb });
    } else {
      await ctx.editMessageText(txt, { parse_mode: 'Markdown', ...kb });
    }
  } catch(_) {
    await ctx.deleteMessage().catch(() => {});
    return showNotes(ctx, idx);
  }
}

/* ── Pin / Unpin ───────────────────────────────────────────── */
async function togglePin(ctx, noteId) {
  const n = await get('SELECT is_pinned FROM notes WHERE id=$1', [noteId]).catch(() => null);
  if (!n) return ctx.answerCbQuery('❌ ملاحظة غير موجودة').catch(() => {});
  await run('UPDATE notes SET is_pinned=$1 WHERE id=$2', [n.is_pinned ? 0 : 1, noteId]);
  await ctx.answerCbQuery(n.is_pinned ? '✅ إلغاء التثبيت' : '📌 تم التثبيت').catch(() => {});
  const notes = await getNotes();
  const idx   = notes.findIndex(x => x.id == noteId);
  return editNote(ctx, Math.max(0, idx));
}

/* ── Delete ────────────────────────────────────────────────── */
async function deleteNote(ctx, noteId) {
  await run('UPDATE notes SET is_deleted=1 WHERE id=$1', [noteId]);
  await ctx.answerCbQuery('🗑 تم الحذف').catch(() => {});
  await ctx.deleteMessage().catch(() => {});
  return showNotes(ctx, 0);
}

/* ── Add note — start flow ─────────────────────────────────── */
async function startAddNote(ctx) {
  await require('../utils/stateManager').setState(ctx.uid, { type: 'note_add', step: 'content' });
  return ctx.reply(
    '📝 *إضافة ملاحظة جديدة*\n━━━━━━━━━━━━━━━\n\n' +
    'أرسل المحتوى:\n' +
    '• نص عادي\n' +
    '• صورة 🖼️\n' +
    '• فيديو 🎬\n' +
    '• ملف 📎\n' +
    '• رابط 🔗\n\n' +
    '_أو اكتب /cancel للإلغاء_',
    { parse_mode: 'Markdown' }
  ).catch(() => {});
}

/* ── Handle note content input ─────────────────────────────── */
async function handleNoteInput(ctx, state) {
  await initNotes();
  const msg = ctx.message;
  const uid = ctx.uid;

  if (state.step === 'content') {
    // detect content type
    let mediaFileId = null, mediaType = 'text', content = '', url = null;

    if (msg.photo) {
      mediaFileId = msg.photo[msg.photo.length - 1].file_id;
      mediaType   = 'photo';
      content     = msg.caption || '';
    } else if (msg.video) {
      mediaFileId = msg.video.file_id;
      mediaType   = 'video';
      content     = msg.caption || '';
    } else if (msg.document) {
      mediaFileId = msg.document.file_id;
      mediaType   = 'document';
      content     = msg.caption || '';
    } else if (msg.text) {
      const text = msg.text.trim();
      // detect URL
      const urlRx = /https?:\/\/[^\s]+/;
      if (urlRx.test(text)) {
        url = text.match(urlRx)[0];
        mediaType = 'link';
        content = text.replace(url, '').trim();
      } else {
        content = text;
      }
    }

    await require('../utils/stateManager').setState(uid, { ...state, step: 'title', mediaFileId, mediaType, content, url });
    return ctx.reply(
      '✏️ أرسل *عنوان* الملاحظة\n_(أو أرسل - للتخطي)_',
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }

  if (state.step === 'title') {
    const title = msg.text?.trim() === '-' ? '' : msg.text?.trim() || '';
    await run(
      'INSERT INTO notes(title,content,media_file_id,media_type,url,created_by) VALUES($1,$2,$3,$4,$5,$6)',
      [title, state.content||'', state.mediaFileId||null, state.mediaType||'text', state.url||null, uid]
    );
    await require('../utils/stateManager').delState(uid);
    await ctx.reply('✅ *تمت إضافة الملاحظة!*', { parse_mode: 'Markdown' }).catch(() => {});
    return showNotes(ctx, 0);
  }
}

/* ── Callback handler ──────────────────────────────────────── */
async function handleCallback(ctx, data) {
  if (!_ready) await initNotes();

  if (data === 'notes' || data === 'show_notes')
    return showNotes(ctx, 0);

  if (data.startsWith('note_nav_'))
    return editNote(ctx, parseInt(data.replace('note_nav_','')));

  if (data.startsWith('note_pin_')) {
    if (!ctx.isOwner) return ctx.answerCbQuery('🚫 للمالك فقط').catch(()=>{});
    return togglePin(ctx, data.replace('note_pin_',''));
  }

  if (data.startsWith('note_del_')) {
    if (!ctx.isOwner) return ctx.answerCbQuery('🚫 للمالك فقط').catch(()=>{});
    return deleteNote(ctx, data.replace('note_del_',''));
  }

  if (data === 'note_add') {
    if (!ctx.isOwner) return ctx.answerCbQuery('🚫 للمالك فقط').catch(()=>{});
    await ctx.answerCbQuery('').catch(()=>{});
    return startAddNote(ctx);
  }
}

module.exports = { initNotes, showNotes, handleCallback, handleNoteInput, startAddNote };
