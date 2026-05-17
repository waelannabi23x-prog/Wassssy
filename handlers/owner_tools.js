'use strict';
const db = require('../database/db');
const filesDb = require('../database/files');
const adminsDb = require('../database/admins');
const { btn, build } = require('../utils/keyboard');

async function resolveSmartPath(parts) {
  let specs = await db.all('SELECT id, name FROM specialties WHERE is_deleted=0');
  let m1 = specs.filter(s => s.name.toLowerCase().includes(parts[0].toLowerCase()));
  if (m1.length !== 1) return { err: parts[0], choices: m1 };
  let years = await db.all('SELECT id, name FROM years WHERE specialty_id=$1 AND is_deleted=0', [m1[0].id]);
  let m2 = years.filter(y => y.name.toLowerCase().includes(parts[1].toLowerCase()));
  if (m2.length !== 1) return { err: parts[1], choices: m2 };
  let sems = await db.all('SELECT id, name FROM semesters WHERE year_id=$1 AND is_deleted=0', [m2[0].id]);
  let m3 = sems.filter(s => s.name.toLowerCase().includes(parts[2].toLowerCase()));
  if (m3.length !== 1) return { err: parts[2], choices: m3 };
  let subs = await db.all('SELECT id, name FROM subjects WHERE semester_id=$1 AND is_deleted=0', [m3[0].id]);
  let m4 = subs.filter(s => s.name.toLowerCase().includes(parts[3].toLowerCase()));
  if (m4.length !== 1) return { err: parts[3], choices: m4 };
  let cats = await db.all('SELECT id, name FROM categories WHERE subject_id=$1 AND is_deleted=0', [m4[0].id]);
  let m5 = cats.filter(c => c.name.toLowerCase().includes(parts[4].toLowerCase()));
  if (m5.length !== 1) return { err: parts[4], choices: m5 };
  return { catId: m5[0].id, path: m1[0].name+' > '+m2[0].name+' > '+m3[0].name+' > '+m4[0].name+' > '+m5[0].name };
}

exports.trySmartUpload = async (ctx) => {
  if (!ctx.isOwner) return false;
  const msg = ctx.message;
  const caption = (msg.text || msg.caption || '').trim();
  const regex = /تخصص:|سنة:|فصل:|مادة:|قسم:|spec:|year:|sem:|mat:|cat:/i;
  if (!regex.test(caption)) return false;
  ctx.reply('جاري تحليل المسار...').catch(() => {});
  // نقسم بـ | ثم نمسح الـlabel من كل جزء (تخصص: X → X)
  let parts = caption.split(/[|,]/)
    .map(p => p.replace(/^[^:：]+[:：]\s*/, '').trim())
    .filter(p => p && !/^(تخصص|سنة|فصل|مادة|قسم|spec|year|sem|mat|cat)$/i.test(p));
  if (parts.length < 5) {
    ctx.reply('❌ صيغة غير مكتملة\n\nمثال مع ملف:\n`Computer science | 1 | Sem 2 | Analyse 2 | Cours`\n\nأو:\n`تخصص: CS | سنة: 1 | فصل: Sem 2 | مادة: Analyse 2 | قسم: Cours`', {parse_mode:'Markdown'});
    return true;
  }
  let fileId, fileType, fileName = '';
  if (msg.document) { fileId = msg.document.file_id; fileType = 'document'; fileName = msg.document.file_name || 'ملف'; }
  else if (msg.photo) { fileId = msg.photo[msg.photo.length - 1].file_id; fileType = 'photo'; fileName = 'صورة'; }
  else { ctx.reply('يرجى إرفاق ملف مع المسار.'); return true; }
  const res = await resolveSmartPath(parts);
  if (res.err) {
    let text = 'وجدت عدة خيارات لـ ' + res.err + ' اختر الصحيح:';
    const rows = res.choices.slice(0, 6).map(c => [btn(c.name, 'smart_fix_' + c.id + '_' + parts.join('_'))]);
    ctx.reply(text, { parse_mode: 'Markdown', ...build(rows) });
    return true;
  }
  try {
    let finalTitle = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    await filesDb.addFile(res.catId, finalTitle, '', fileId, fileType, ctx.uid);
    ctx.reply('تم الرفع بنجاح!\n' + res.path + '\n' + finalTitle);
  } catch (e) {
    ctx.reply('فشل: ' + (e.message === 'exists' ? 'الملف موجود!' : e.message));
  }
  return true;
};

exports.fixSmartPath = async (ctx, data) => {
  ctx.deleteMessage().catch(() => {});
  ctx.reply('تم التصحيح! أعد إرسال الملف بنفس المسار.');
};

exports.batchPromote = async (ctx) => {
  const text = ctx.message.text.replace(/\/promote/gi, '').trim();
  const ids = text.split(/\s+/).map(Number).filter(n => !isNaN(n));
  if (!ids.length) return ctx.reply('استخدام: /promote ID1 ID2');
  let done = 0;
  for (const id of ids) { try { await adminsDb.add(id, ctx.uid); done++; } catch (_) {} }
  ctx.reply('تم إضافة ' + done + ' مشرف.');
};

exports.listGroups = async (ctx) => {
  const groups = await db.all('SELECT gc.chat_id, gc.title, sp.name as spec FROM group_chats gc LEFT JOIN specialties sp ON gc.specialty_id=sp.id');
  if (!groups.length) return ctx.reply('البوت ليس في أي قروب.');
  let text = 'قروبات البوت:\n\n';
  const rows = [];
  groups.forEach(g => {
    text += 'ID: ' + g.chat_id + '\n' + (g.title || 'بدون اسم') + '\n\n';
    rows.push([btn('خروج: ' + (g.title || g.chat_id).substring(0, 20), 'leave_grp_' + g.chat_id)]);
  });
  ctx.reply(text, { parse_mode: 'Markdown', ...build(rows) });
};

exports.leaveGroup = async (ctx) => {
  const id = parseInt(ctx.message.text.replace(/\/leavegroup/gi, '').trim());
  if (isNaN(id)) return ctx.reply('استخدام: /leavegroup <ID>');
  try {
    await ctx.telegram.leaveChat(id);
    await db.run('DELETE FROM group_chats WHERE chat_id=$1', [id]);
    ctx.reply('تم الخروج من القروب ' + id);
  } catch (e) { ctx.reply('فشل: ' + e.message); }
};
