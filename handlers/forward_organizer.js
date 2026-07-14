'use strict';
/**
 * 📥 handlers/forward_organizer.js
 * أي مستخدم عادي (غير admin/owner) يعمل forward لملفات في الخاص
 * البوت يجمعها، يسأل تخصص + مادة بأزرار، ثم يرجعها له باسم المادة
 */

const { all } = require('../database/db');
const logger = require('../utils/logger');

const sessions = new Map(); // userId -> { files, timer, step, lastActivity }
const COLLECT_WINDOW = 2500;

function isForwarded(msg) {
  return !!(msg.forward_date || msg.forward_from || msg.forward_from_chat || msg.forward_sender_name || msg.forward_origin);
}

function extractFile(msg) {
  if (msg.document) return { type: 'document', file_id: msg.document.file_id };
  if (msg.photo)    return { type: 'photo',    file_id: msg.photo[msg.photo.length - 1].file_id };
  if (msg.video)    return { type: 'video',    file_id: msg.video.file_id };
  if (msg.audio)    return { type: 'audio',    file_id: msg.audio.file_id };
  if (msg.voice)    return { type: 'voice',    file_id: msg.voice.file_id };
  return null;
}

async function askSpecialty(ctx) {
  const sess = sessions.get(ctx.from.id);
  const specs = await all('SELECT id, name FROM specialties WHERE is_deleted=0 ORDER BY id').catch(() => []);
  if (!specs.length) {
    sessions.delete(ctx.from.id);
    return ctx.reply('⚠️ لا توجد تخصصات مسجلة حالياً.').catch(() => {});
  }
  const kb = specs.map(s => [{ text: '🎓 ' + s.name, callback_data: 'fwo_spec_' + s.id }]);
  kb.push([{ text: '❌ إلغاء', callback_data: 'fwo_cancel' }]);
  return ctx.reply(
    `📥 *تم استلام ${sess?.files.length || 0} ملف*\n\n🎓 اختر التخصص:`,
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } }
  ).catch(() => {});
}

// ── استقبال ملف/صورة forwarded ──
async function handleForward(ctx) {
  if (ctx.chat?.type !== 'private') return false;
  if (!isForwarded(ctx.message)) return false;
  // إذا فيه caption بصيغة تصنيف قديمة، خلّي الـ owner flow القديم يشتغل
  const hasCap = !!(ctx.message.caption && /تخصص:|سنة:|spec:|year:|sem:|mat:|cat:/i.test(ctx.message.caption));
  if (hasCap) return false;

  const file = extractFile(ctx.message);
  if (!file) return false;

  const uid = ctx.from.id;
  let sess = sessions.get(uid);
  if (!sess || sess.step !== 'collecting') {
    sess = { files: [], timer: null, step: 'collecting', lastActivity: Date.now() };
    sessions.set(uid, sess);
  }

  sess.files.push(file);
  sess.lastActivity = Date.now();
  clearTimeout(sess.timer);
  sess.timer = setTimeout(() => {
    sess.step = 'choosing';
    askSpecialty(ctx).catch(() => {});
  }, COLLECT_WINDOW);

  return true;
}

// ── Callbacks ──
async function handleCallback(ctx, data) {
  if (!data.startsWith('fwo_')) return false;
  const uid = ctx.from.id;
  const sess = sessions.get(uid);

  if (data === 'fwo_cancel') {
    sessions.delete(uid);
    await ctx.answerCbQuery('❌ تم الإلغاء').catch(() => {});
    await ctx.editMessageText('❌ تم إلغاء التنظيم.').catch(() => {});
    return true;
  }

  if (!sess) {
    await ctx.answerCbQuery('⚠️ انتهت الجلسة، أعد الإرسال', { show_alert: true }).catch(() => {});
    return true;
  }
  sess.lastActivity = Date.now();

  if (data.startsWith('fwo_spec_')) {
    const specId = parseInt(data.replace('fwo_spec_', ''));
    sess.specId = specId;

    const subjects = await all(
      `SELECT DISTINCT su.id, su.name FROM subjects su
       JOIN semesters se ON su.semester_id = se.id
       JOIN years y ON se.year_id = y.id
       WHERE y.specialty_id=$1 AND su.is_deleted=0
       ORDER BY su.name`,
      [specId]
    ).catch(() => []);

    if (!subjects.length) {
      await ctx.answerCbQuery('⚠️ لا توجد مواد لهذا التخصص', { show_alert: true }).catch(() => {});
      return true;
    }

    const kb = subjects.map(s => [{ text: '📘 ' + s.name, callback_data: 'fwo_subj_' + s.id }]);
    kb.push([{ text: '◀️ رجوع', callback_data: 'fwo_back_spec' }]);
    await ctx.answerCbQuery('').catch(() => {});
    await ctx.editMessageText('📘 *اختر المادة:*', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } }).catch(() => {});
    return true;
  }

  if (data === 'fwo_back_spec') {
    await ctx.answerCbQuery('').catch(() => {});
    await askSpecialty(ctx);
    return true;
  }

  if (data.startsWith('fwo_subj_')) {
    const subjId = parseInt(data.replace('fwo_subj_', ''));
    const rows = await all('SELECT name FROM subjects WHERE id=$1', [subjId]).catch(() => []);
    const subjName = rows[0]?.name || 'مادة';

    await ctx.answerCbQuery('📤 جاري الإرسال...').catch(() => {});
    await ctx.editMessageText(`✅ *تم!* جاري إرسال ${sess.files.length} ملف باسم *${subjName}*...`, { parse_mode: 'Markdown' }).catch(() => {});

    for (const f of sess.files) {
      const caption = `📘 ${subjName}`;
      try {
        if      (f.type === 'document') await ctx.telegram.sendDocument(uid, f.file_id, { caption });
        else if (f.type === 'photo')    await ctx.telegram.sendPhoto(uid, f.file_id, { caption });
        else if (f.type === 'video')    await ctx.telegram.sendVideo(uid, f.file_id, { caption });
        else if (f.type === 'audio')    await ctx.telegram.sendAudio(uid, f.file_id, { caption });
        else if (f.type === 'voice')    await ctx.telegram.sendVoice(uid, f.file_id, { caption });
      } catch (e) { logger.error('[ForwardOrganizer send]', e.message); }
    }

    sessions.delete(uid);
    return true;
  }

  return false;
}

// تنظيف الجلسات القديمة (أكثر من 15 دقيقة بدون نشاط)
setInterval(() => {
  const now = Date.now();
  for (const [uid, sess] of sessions) {
    if (now - sess.lastActivity > 15 * 60 * 1000) sessions.delete(uid);
  }
}, 5 * 60 * 1000).unref();

module.exports = { handleForward, handleCallback };
