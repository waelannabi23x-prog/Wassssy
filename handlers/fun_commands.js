'use strict';
const { get, run, all } = require('../database/db');
const logger = require('../utils/logger');

function isGroup(ctx) { return ['group','supergroup'].includes(ctx.chat?.type); }

// ══════════════════════════════════════
// 🌙 AFK
// ══════════════════════════════════════
async function handleAfk(ctx) {
  const uid = ctx.from?.id;
  const name = ctx.from?.first_name || 'مجهول';
  const reason = (ctx.message?.text||'').split(' ').slice(1).join(' ').trim();
  await run(
    'INSERT INTO afk_users(user_id,reason,since,is_afk) VALUES($1,$2,NOW(),1) ON CONFLICT(user_id) DO UPDATE SET reason=$2,since=NOW(),is_afk=1',
    [uid, reason]
  ).catch(()=>{});
  return ctx.reply(
    '🌙 *' + name + '* غائب الآن!' + (reason ? '\n📝 ' + reason : ''),
    { parse_mode:'Markdown', reply_to_message_id: ctx.message?.message_id }
  ).catch(()=>{});
}

async function checkAfkOnMessage(ctx) {
  if (!isGroup(ctx)) return;
  const uid = ctx.from?.id;
  // إذا كان AFK — أزله
  const afkRow = await get('SELECT * FROM afk_users WHERE user_id=$1 AND is_afk=1',[uid]).catch(()=>null);
  if (afkRow) {
    await run('UPDATE afk_users SET is_afk=0 WHERE user_id=$1',[uid]).catch(()=>{});
    const mins = Math.floor((Date.now()-new Date(afkRow.since).getTime())/60000);
    const t = mins < 60 ? mins+'د' : Math.floor(mins/60)+'س';
    ctx.reply(
      '👋 مرحباً *' + (ctx.from?.first_name||'') + '*! تم إزالة وضع الغياب.\n⏱ كنت غائباً: ' + t,
      { parse_mode:'Markdown', reply_to_message_id: ctx.message?.message_id }
    ).catch(()=>{});
  }
  // تحقق إذا رد على شخص AFK
  const rep = ctx.message?.reply_to_message?.from;
  if (rep && !rep.is_bot && rep.id !== uid) {
    const repAfk = await get('SELECT * FROM afk_users WHERE user_id=$1 AND is_afk=1',[rep.id]).catch(()=>null);
    if (repAfk) {
      const mins = Math.floor((Date.now()-new Date(repAfk.since).getTime())/60000);
      const t = mins < 60 ? mins+'د' : Math.floor(mins/60)+'س';
      ctx.reply(
        '💤 *' + (rep.first_name||'هذا الشخص') + '* غائب منذ ' + t +
        (repAfk.reason ? '\n📝 ' + repAfk.reason : ''),
        { parse_mode:'Markdown', reply_to_message_id: ctx.message?.message_id }
      ).catch(()=>{});
    }
  }
}

// ══════════════════════════════════════
// 📝 Notes
// ══════════════════════════════════════
async function saveNote(ctx) {
  if (!isGroup(ctx)) return;
  if (!ctx.isAdmin && !ctx.isOwner) return ctx.reply('🚫 للأدمن فقط').catch(()=>{});
  const args = (ctx.message?.text||'').split(' ');
  const name = args[1]?.toLowerCase();
  const rep = ctx.message?.reply_to_message;
  const content = args.slice(2).join(' ').trim() || rep?.text || rep?.caption || '';
  const file_id = rep?.sticker?.file_id || rep?.photo?.[rep.photo.length-1]?.file_id || rep?.video?.file_id || rep?.document?.file_id || null;
  const note_type = rep?.sticker ? 'sticker' : rep?.photo ? 'photo' : rep?.video ? 'video' : rep?.document ? 'document' : 'text';
  if (!name) return ctx.reply('📝 /note [اسم] [محتوى]\nأو رد على رسالة: /note [اسم]', { reply_to_message_id: ctx.message?.message_id }).catch(()=>{});
  if (!content && !file_id) return ctx.reply('❌ لا يوجد محتوى للحفظ!', { reply_to_message_id: ctx.message?.message_id }).catch(()=>{});
  await run(
    'INSERT INTO notes(chat_id,name,content,file_id,note_type,created_by) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(chat_id,name) DO UPDATE SET content=$3,file_id=$4,note_type=$5',
    [ctx.chat.id, name, content, file_id, note_type, ctx.from?.id]
  ).catch(()=>{});
  return ctx.reply('✅ تم حفظ الملاحظة: *#' + name + '*', { parse_mode:'Markdown', reply_to_message_id: ctx.message?.message_id }).catch(()=>{});
}

async function getNote(ctx, name) {
  const note = await get('SELECT * FROM notes WHERE chat_id=$1 AND name=$2',[ctx.chat?.id, name.toLowerCase()]).catch(()=>null);
  if (!note) return ctx.reply('❌ الملاحظة *#' + name + '* غير موجودة!', { parse_mode:'Markdown', reply_to_message_id: ctx.message?.message_id }).catch(()=>{});
  const opts = { reply_to_message_id: ctx.message?.message_id };
  if (note.note_type === 'sticker' && note.file_id) return ctx.telegram.sendSticker(ctx.chat.id, note.file_id, opts).catch(()=>{});
  if (note.note_type === 'photo' && note.file_id) return ctx.telegram.sendPhoto(ctx.chat.id, note.file_id, { ...opts, caption: note.content||undefined, parse_mode:'Markdown' }).catch(()=>{});
  if (note.note_type === 'video' && note.file_id) return ctx.telegram.sendVideo(ctx.chat.id, note.file_id, { ...opts, caption: note.content||undefined, parse_mode:'Markdown' }).catch(()=>{});
  if (note.note_type === 'document' && note.file_id) return ctx.telegram.sendDocument(ctx.chat.id, note.file_id, { ...opts, caption: note.content||undefined, parse_mode:'Markdown' }).catch(()=>{});
  return ctx.reply(note.content||'_فارغة_', { parse_mode:'Markdown', ...opts }).catch(()=>{});
}

async function listNotes(ctx) {
  if (!isGroup(ctx)) return;
  const notes = await all('SELECT name FROM notes WHERE chat_id=$1 ORDER BY name',[ctx.chat?.id]).catch(()=>[]);
  if (!notes.length) return ctx.reply('📭 لا توجد ملاحظات محفوظة', { reply_to_message_id: ctx.message?.message_id }).catch(()=>{});
  const txt = '📝 *الملاحظات المحفوظة:*\n━━━━━━━━━━━━━━━\n\n' + notes.map(n=>'• #'+n.name).join('\n');
  return ctx.reply(txt, { parse_mode:'Markdown', reply_to_message_id: ctx.message?.message_id }).catch(()=>{});
}

async function delNote(ctx) {
  if (!isGroup(ctx)) return;
  if (!ctx.isAdmin && !ctx.isOwner) return ctx.reply('🚫 للأدمن فقط').catch(()=>{});
  const name = (ctx.message?.text||'').split(' ')[1]?.toLowerCase();
  if (!name) return ctx.reply('❌ /delnote [اسم]', { reply_to_message_id: ctx.message?.message_id }).catch(()=>{});
  await run('DELETE FROM notes WHERE chat_id=$1 AND name=$2',[ctx.chat?.id, name]).catch(()=>{});
  return ctx.reply('🗑 تم حذف *#' + name + '*', { parse_mode:'Markdown', reply_to_message_id: ctx.message?.message_id }).catch(()=>{});
}

// ══════════════════════════════════════
// 🚫 Blacklist
// ══════════════════════════════════════
async function addBlacklist(ctx) {
  if (!isGroup(ctx)) return;
  if (!ctx.isAdmin && !ctx.isOwner) return ctx.reply('🚫 للأدمن فقط').catch(()=>{});
  const word = (ctx.message?.text||'').split(' ').slice(1).join(' ').trim().toLowerCase();
  if (!word) return ctx.reply('❌ /blacklist [كلمة]', { reply_to_message_id: ctx.message?.message_id }).catch(()=>{});
  await run('INSERT INTO blacklist_words(chat_id,word,added_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[ctx.chat?.id, word, ctx.from?.id]).catch(()=>{});
  try { require('../utils/cache').cacheClear('bl_'+ctx.chat?.id); } catch(_) {}
  return ctx.reply('✅ أضيفت *' + word + '* للقائمة السوداء', { parse_mode:'Markdown', reply_to_message_id: ctx.message?.message_id }).catch(()=>{});
}

async function delBlacklist(ctx) {
  if (!isGroup(ctx)) return;
  if (!ctx.isAdmin && !ctx.isOwner) return ctx.reply('🚫 للأدمن فقط').catch(()=>{});
  const word = (ctx.message?.text||'').split(' ').slice(1).join(' ').trim().toLowerCase();
  if (!word) return ctx.reply('❌ /unblacklist [كلمة]', { reply_to_message_id: ctx.message?.message_id }).catch(()=>{});
  await run('DELETE FROM blacklist_words WHERE chat_id=$1 AND word=$2',[ctx.chat?.id, word]).catch(()=>{});
  try { require('../utils/cache').cacheClear('bl_'+ctx.chat?.id); } catch(_) {}
  return ctx.reply('✅ حُذفت *' + word + '* من القائمة السوداء', { parse_mode:'Markdown', reply_to_message_id: ctx.message?.message_id }).catch(()=>{});
}

async function listBlacklist(ctx) {
  if (!isGroup(ctx)) return;
  const list = await all('SELECT word FROM blacklist_words WHERE chat_id=$1 ORDER BY word',[ctx.chat?.id]).catch(()=>[]);
  if (!list.length) return ctx.reply('📭 القائمة السوداء فارغة', { reply_to_message_id: ctx.message?.message_id }).catch(()=>{});
  return ctx.reply('🚫 *الكلمات المحظورة:*\n\n' + list.map(w=>'• '+w.word).join('\n'), { parse_mode:'Markdown', reply_to_message_id: ctx.message?.message_id }).catch(()=>{});
}

async function checkBlacklist(ctx) {
  if (!isGroup(ctx)) return;
  const txt = (ctx.message?.text||ctx.message?.caption||'').toLowerCase();
  if (!txt) return;
  const ck = 'bl_' + ctx.chat?.id;
  let list;
  try { list = require('../utils/cache').cacheGet(ck); } catch(_) {}
  if (!list) {
    list = await all('SELECT word FROM blacklist_words WHERE chat_id=$1',[ctx.chat?.id]).catch(()=>[]);
    try { require('../utils/cache').cacheSet(ck, list, 300000); } catch(_) {}
  }
  if (!list?.length) return;
  const matched = list.find(w => txt.includes(w.word));
  if (!matched) return;
  ctx.deleteMessage().catch(()=>{});
  return ctx.reply(
    '⚠️ [' + (ctx.from?.first_name||'مستخدم') + '](tg://user?id=' + ctx.from?.id + ') كلمة محظورة!',
    { parse_mode:'Markdown' }
  ).catch(()=>{});
}

// ══════════════════════════════════════
// 🔒 Locks
// ══════════════════════════════════════
async function handleLock(ctx, unlock) {
  if (!isGroup(ctx)) return;
  if (!ctx.isAdmin && !ctx.isOwner) return ctx.reply('🚫 للأدمن فقط').catch(()=>{});
  const type = (ctx.message?.text||'').split(' ')[1]?.toLowerCase();
  const validTypes = ['sticker','gif','link','forward','photo','video','voice','poll'];
  if (!type || !validTypes.includes(type)) {
    return ctx.reply('🔒 الأنواع المتاحة:\n' + validTypes.map(t=>'• '+t).join('\n'), { reply_to_message_id: ctx.message?.message_id }).catch(()=>{});
  }
  const col = 'lock_' + type;
  const val = unlock ? 0 : 1;
  await run(`INSERT INTO group_locks(chat_id,${col}) VALUES($1,$2) ON CONFLICT(chat_id) DO UPDATE SET ${col}=$2`,[ctx.chat?.id, val]).catch(()=>{});
  try { require('../utils/cache').cacheClear('locks_'+ctx.chat?.id); } catch(_) {}
  return ctx.reply((unlock?'🔓 فُتح: ':'🔒 قُفل: ') + '*' + type + '*', { parse_mode:'Markdown', reply_to_message_id: ctx.message?.message_id }).catch(()=>{});
}

async function checkLocks(ctx) {
  if (!isGroup(ctx)) return;
  const ck = 'locks_' + ctx.chat?.id;
  let locks;
  try { locks = require('../utils/cache').cacheGet(ck); } catch(_) {}
  if (!locks) {
    locks = await get('SELECT * FROM group_locks WHERE chat_id=$1',[ctx.chat?.id]).catch(()=>null);
    try { require('../utils/cache').cacheSet(ck, locks, 300000); } catch(_) {}
  }
  if (!locks) return;
  const msg = ctx.message;
  if (ctx.isAdmin || ctx.isOwner) return;
  if (locks.lock_sticker && msg.sticker) { ctx.deleteMessage().catch(()=>{}); return; }
  if (locks.lock_gif && msg.animation) { ctx.deleteMessage().catch(()=>{}); return; }
  if (locks.lock_photo && msg.photo) { ctx.deleteMessage().catch(()=>{}); return; }
  if (locks.lock_video && msg.video) { ctx.deleteMessage().catch(()=>{}); return; }
  if (locks.lock_voice && (msg.voice||msg.audio)) { ctx.deleteMessage().catch(()=>{}); return; }
  if (locks.lock_poll && msg.poll) { ctx.deleteMessage().catch(()=>{}); return; }
  if (locks.lock_forward && msg.forward_from) { ctx.deleteMessage().catch(()=>{}); return; }
  if (locks.lock_link && msg.text) {
    const hasLink = /https?:\/\/|t\.me\/|@\w+/i.test(msg.text);
    if (hasLink) { ctx.deleteMessage().catch(()=>{}); return; }
  }
}

module.exports = {
  handleAfk, checkAfkOnMessage,
  saveNote, getNote, listNotes, delNote,
  addBlacklist, delBlacklist, listBlacklist, checkBlacklist,
  handleLock, checkLocks,
};
