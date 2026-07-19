#!/usr/bin/env node
/**
 * setup_backup.cjs — تثبيت نظام النسخ الاحتياطي/الاستعادة الشامل
 * شغّل: node setup_backup.cjs
 * من داخل مجلد المشروع
 */
const fs = require('fs');
const path = require('path');

const G='\x1b[32m', Y='\x1b[33m', R='\x1b[31m', B='\x1b[34m', W='\x1b[0m';
const ok  = m => console.log(G+'✅ '+m+W);
const warn= m => console.log(Y+'⚠️  '+m+W);
const err = m => console.log(R+'❌ '+m+W);

function copyUtil() {
  const src = path.join(process.env.HOME || '/data/data/com.termux/files/home', 'backup_full.js');
  const dst = path.join(process.cwd(), 'utils', 'backup_full.js');
  if (!fs.existsSync(src)) {
    err(`${src} غير موجود! انسخه أولاً.`);
    process.exit(1);
  }
  fs.copyFileSync(src, dst);
  ok('تم نسخ backup_full.js إلى utils/');
}

function patchManage() {
  const file = path.join(process.cwd(), 'handlers', 'manage.js');
  let c = fs.readFileSync(file, 'utf8');

  // 1) استبدال mg_backup القديم بالشامل
  const OLD_BACKUP = `  if(data==='mg_backup'){
    const msg = await ctx.reply('⏳ جاري تصدير البيانات...').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    try {
      const tables = ['specialties','years','semesters','subjects','categories','files','bundles','bundle_files','admins','settings','message_templates','scheduled_messages'];
      const backup = { exported_at: new Date().toISOString(), tables: {} };
      for (const t of tables) {
        try { backup.tables[t] = await all('SELECT * FROM ' + t); } catch(_) { backup.tables[t] = []; }
      }
      const json = JSON.stringify(backup, null, 2);
      const buf  = Buffer.from(json, 'utf8');
      const fname = 'backup_' + new Date().toISOString().substring(0,10) + '.json';
      await ctx.replyWithDocument({ source: buf, filename: fname }, { caption: '💾 Backup ' + new Date().toISOString().substring(0,10) });
      if (msg) ctx.deleteMessage(msg.message_id).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    } catch(e) {
      if (msg) ctx.deleteMessage(msg.message_id).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      ctx.reply('❌ فشل التصدير: ' + e.message).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }
    return;
  }`;

  const NEW_BACKUP = `  if(data==='mg_backup'){
    const msg = await ctx.reply('⏳ جاري تصدير كل البيانات (قد يستغرق دقيقة)...').catch(()=>{});
    try {
      const { exportAll } = require('../utils/backup_full');
      const backup = await exportAll();
      const json = JSON.stringify(backup);
      const buf  = Buffer.from(json, 'utf8');
      const sizeMB = (buf.length / 1024 / 1024).toFixed(2);
      const fname = 'taline_backup_' + new Date().toISOString().substring(0,10) + '.json';

      const tableCount = Object.keys(backup.tables).length;
      const rowCount = Object.values(backup.tables).reduce((s,r)=>s+r.length,0);
      const errCount = backup.errors.length;

      let caption = '💾 *نسخة احتياطية شاملة*\\n' +
        '📊 الجداول: *' + tableCount + '*\\n' +
        '📄 الصفوف: *' + rowCount + '*\\n' +
        '📦 الحجم: *' + sizeMB + ' MB*';
      if (errCount) caption += '\\n⚠️ جداول فشلت: *' + errCount + '*';

      await ctx.replyWithDocument({ source: buf, filename: fname }, { caption, parse_mode: 'Markdown' });
      if (msg) ctx.deleteMessage(msg.message_id).catch(()=>{});
    } catch(e) {
      if (msg) ctx.deleteMessage(msg.message_id).catch(()=>{});
      ctx.reply('❌ فشل التصدير: ' + e.message).catch(()=>{});
    }
    return;
  }`;

  if (c.includes(OLD_BACKUP)) {
    c = c.replace(OLD_BACKUP, NEW_BACKUP, 1);
    ok('تم استبدال mg_backup بالنسخة الشاملة');
  } else if (c.includes('exportAll')) {
    warn('mg_backup محدَّث بالفعل');
  } else {
    warn('تعذّر إيجاد mg_backup القديم — أضفه يدوياً');
  }

  // 2) تحديث mg_restore رسالة الطلب لتوضح .json بدل .db
  const OLD_RESTORE = `  if(data==='mg_restore'){setState(uid,{type:'mg_awaiting_restore'});return eos(ctx,'♻️ *استعادة قاعدة البيانات*\\n\\n⚠️ سيتم استبدال البيانات!\\n\\nأرسل ملف \`.db\`:',{parse_mode:'Markdown',...build([back('mg_menu')])});}`;

  const NEW_RESTORE = `  if(data==='mg_restore'){setState(uid,{type:'mg_awaiting_restore'});return eos(ctx,'♻️ *استعادة كاملة*\\n\\n⚠️ سيُستبدل كل شيء: مستخدمين، ملفات، بنك، ألعاب، حماية، ردود تلقائية!\\n\\nأرسل ملف \`.json\` من "نسخ احتياطي":',{parse_mode:'Markdown',...build([back('mg_menu')])});}`;

  if (c.includes(OLD_RESTORE)) {
    c = c.replace(OLD_RESTORE, NEW_RESTORE, 1);
    ok('تم تحديث رسالة mg_restore');
  } else if (c.includes("استعادة كاملة")) {
    warn('mg_restore محدَّث بالفعل');
  } else {
    warn('تعذّر إيجاد mg_restore القديم');
  }

  fs.writeFileSync(file, c, 'utf8');
  ok('تم حفظ manage.js');
}

// 3) إضافة معالج استلام ملف .json للاستعادة الفعلية
function patchMessages() {
  const file = path.join(process.cwd(), 'bot', 'messages.js');
  let c = fs.readFileSync(file, 'utf8');

  if (c.includes('mg_awaiting_restore')) {
    warn('معالج mg_awaiting_restore موجود بالفعل في messages.js');
    return;
  }

  // ابحث عن نقطة مناسبة لإدراج المعالج — بعد أول dedup check في bot.on('message')
  const ANCHOR = `  bot.on('message', async (ctx, next) => {
    const _mid = ctx.message?.message_id + '_' + (ctx.from?.id || '');
    if (isDupMsg(_mid)) return;`;

  const RESTORE_HANDLER = `  bot.on('message', async (ctx, next) => {
    const _mid = ctx.message?.message_id + '_' + (ctx.from?.id || '');
    if (isDupMsg(_mid)) return;

    // ♻️ استعادة كاملة من نسخة احتياطية
    if (ctx.chat?.type === 'private' && ctx.message?.document) {
      const { getState, delState } = require('../utils/stateManager');
      const state = getState(ctx.uid);
      if (state?.type === 'mg_awaiting_restore') {
        await delState(ctx.uid);
        const doc = ctx.message.document;
        if (!doc.file_name?.endsWith('.json')) {
          return ctx.reply('❌ يجب أن يكون الملف بصيغة .json').catch(()=>{});
        }
        const loading = await ctx.reply('⏳ جاري الاستعادة، لا تغلق البوت...').catch(()=>null);
        try {
          const fileLink = await ctx.telegram.getFileLink(doc.file_id);
          const res = await fetch(fileLink.href || fileLink);
          const text = await res.text();
          const backup = JSON.parse(text);

          const { restoreAll } = require('../utils/backup_full');
          const result = await restoreAll(backup);

          if (loading) ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(()=>{});

          const restoredCount = Object.keys(result.restored).length;
          const totalRows = Object.values(result.restored).reduce((s,n)=>s+n,0);
          const errCount = result.errors.length;

          let msg = '✅ *تمت الاستعادة!*\\n' +
            '📊 جداول مستعادة: *' + restoredCount + '*\\n' +
            '📄 صفوف مستعادة: *' + totalRows + '*';
          if (errCount) {
            msg += '\\n⚠️ أخطاء: *' + errCount + '*\\n' +
              result.errors.slice(0,5).map(e=>'  • '+e).join('\\n');
          }
          if (result.skipped.length) {
            msg += '\\n⏭ تم تخطي: *' + result.skipped.length + '* جدول (بيانات غير صحيحة)';
          }
          await ctx.reply(msg, { parse_mode: 'Markdown' }).catch(()=>{});
          if (global.invalidateAdmin) { /* أعد تحميل الكاش إن وُجد */ }
        } catch(e) {
          if (loading) ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(()=>{});
          ctx.reply('❌ فشلت الاستعادة: ' + e.message).catch(()=>{});
        }
        return;
      }
    }`;

  if (c.includes(ANCHOR)) {
    c = c.replace(ANCHOR, RESTORE_HANDLER, 1);
    ok('تمت إضافة معالج استلام ملف الاستعادة');
  } else {
    warn('تعذّر إيجاد ANCHOR في messages.js — أضف المعالج يدوياً');
  }

  fs.writeFileSync(file, c, 'utf8');
  ok('تم حفظ bot/messages.js');
}

console.log('\n'+B+'══════════════════════════════════════'+W);
console.log(B+'  💾  Full Backup/Restore — Setup'+W);
console.log(B+'══════════════════════════════════════\n'+W);

try {
  copyUtil();
  patchManage();
  patchMessages();

  console.log('\n'+G+'══════════════════════════════════════'+W);
  console.log(G+'  ✅  اكتمل!'+W);
  console.log(G+'══════════════════════════════════════\n'+W);
  console.log('تحقق:');
  console.log('  node --check utils/backup_full.js');
  console.log('  node --check handlers/manage.js');
  console.log('  node --check bot/messages.js\n');
  console.log('ثم ارفع:');
  console.log('  git add -A && git commit -m "feat: complete backup/restore system for all tables" && git push\n');
} catch(e) {
  err('خطأ: ' + e.message);
  console.error(e);
  process.exit(1);
}
