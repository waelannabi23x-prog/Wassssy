#!/usr/bin/env node
/**
 * setup_music.cjs — تثبيت نظام البحث عن الأغاني
 * شغّل: node setup_music.cjs
 * من داخل مجلد المشروع
 */
const fs   = require('fs');
const path = require('path');

const G='\x1b[32m', Y='\x1b[33m', R='\x1b[31m', B='\x1b[34m', W='\x1b[0m';
const ok  = m => console.log(G+'✅ '+m+W);
const warn= m => console.log(Y+'⚠️  '+m+W);
const err = m => console.log(R+'❌ '+m+W);
const inf = m => console.log(B+'📌 '+m+W);

// ════════════════════════════════════════════════
//  1. نسخ music.js إلى handlers/
// ════════════════════════════════════════════════
function copyHandler() {
  const src = path.join(process.env.HOME || '/data/data/com.termux/files/home', 'music.js');
  const dst = path.join(process.cwd(), 'handlers', 'music.js');
  if (!fs.existsSync(src)) {
    err(`الملف ${src} غير موجود! تأكد من نسخه أولاً.`);
    process.exit(1);
  }
  fs.copyFileSync(src, dst);
  ok(`تم نسخ music.js → handlers/music.js`);
}

// ════════════════════════════════════════════════
//  2. تعديل index.js
// ════════════════════════════════════════════════
function patchIndex() {
  const file = path.join(process.cwd(), 'index.js');
  let c = fs.readFileSync(file, 'utf8');

  // A) أضف require
  if (c.includes("require('./handlers/music')")) {
    warn('music موجود بالفعل في index.js');
  } else {
    c = c.replace(
      "const bankPro       = require('./handlers/bank_pro');",
      "const bankPro       = require('./handlers/bank_pro');\nconst music         = require('./handlers/music');"
    );
    ok('تمت إضافة require لـ music');
  }

  // B) أضف trigger البحث في gameAndBankMiddleware
  const ANCHOR = `    // gpq_quick_panel_trigger — لوحة الإدارة السريعة`;
  const MUSIC_TRIGGER = `    // 🎵 البحث عن الأغاني
    if (/^🎵\\s+.+/i.test(txt) || /^موسيقى\\s+.+/i.test(txt) || /^اغنية\\s+.+/i.test(txt) || /^أغنية\\s+.+/i.test(txt)) {
      return music.handleSearch(ctx).catch(() => next());
    }

    `;

  if (!c.includes('music.handleSearch')) {
    if (c.includes(ANCHOR)) {
      c = c.replace(ANCHOR, MUSIC_TRIGGER + ANCHOR);
      ok('تمت إضافة trigger البحث عن الأغاني');
    } else {
      // أضف قبل Taline Bank
      c = c.replace(
        `    // 🏦 Taline Bank`,
        MUSIC_TRIGGER + `    // 🏦 Taline Bank`
      );
      ok('تمت إضافة trigger البحث (fallback)');
    }
  } else {
    warn('trigger البحث موجود بالفعل');
  }

  fs.writeFileSync(file, c, 'utf8');
  ok('تم حفظ index.js');
}

// ════════════════════════════════════════════════
//  3. إضافة callback في bot/callbacks.js
// ════════════════════════════════════════════════
function patchCallbacks() {
  const file = path.join(process.cwd(), 'bot', 'callbacks.js');
  let c = fs.readFileSync(file, 'utf8');

  if (c.includes('music_track_') || c.includes("data === 'music_close'")) {
    warn('callbacks البحث موجودة بالفعل');
    return;
  }

  // أضف قبل نهاية registerCallbacks أو قبل آخر })
  const INSERT = `
  // ══ 🎵 Music Search Callbacks ══
  if (data === 'music_close' || data.startsWith('music_track_')) {
    return require('../handlers/music').handleCallback(ctx).catch(() => {});
  }
`;

  // ابحث عن نقطة إدراج مناسبة (قبل آخر }); في الـ callback handler)
  const ANCHOR = `  // ══ GROUP PRO CALLBACKS ══`;
  if (c.includes(ANCHOR)) {
    c = c.replace(ANCHOR, INSERT + '\n' + ANCHOR);
    ok('تمت إضافة music callbacks');
  } else {
    // أضف قبل آخر سطر في bot.on callback_query
    const lines = c.split('\n');
    // ابحث عن آخر سطر فيه "});" يليه "}"
    let insertIdx = -1;
    for (let i = lines.length-1; i > 0; i--) {
      if (lines[i].trim() === '});' && lines[i+1]?.trim() === '}') {
        insertIdx = i;
        break;
      }
    }
    if (insertIdx > -1) {
      lines.splice(insertIdx, 0, INSERT);
      c = lines.join('\n');
      ok('تمت إضافة music callbacks (fallback)');
    } else {
      warn('تعذّر إيجاد نقطة الإدراج في callbacks.js — أضفه يدوياً.');
    }
  }

  fs.writeFileSync(file, c, 'utf8');
  ok('تم حفظ bot/callbacks.js');
}

// ════════════════════════════════════════════════
//  4. إضافة music_track_ و music_close للقائمة
//     البيضاء في القروبات (إن وُجدت)
// ════════════════════════════════════════════════
function patchWhitelist() {
  const file = path.join(process.cwd(), 'bot', 'callbacks.js');
  let c = fs.readFileSync(file, 'utf8');

  const OLD_WL = `|| data.startsWith('games_');`;
  const NEW_WL = `|| data.startsWith('games_')
          || data.startsWith('music_');`;

  if (c.includes(OLD_WL)) {
    c = c.replace(OLD_WL, NEW_WL);
    ok('تمت إضافة music_ للقائمة البيضاء (القروبات)');
  } else {
    warn('القائمة البيضاء لم تُعثر — music_ قد لا تعمل في القروبات');
  }

  fs.writeFileSync(file, c, 'utf8');
}

// ════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════
console.log('\n'+B+'══════════════════════════════════════'+W);
console.log(B+'  🎵  Music Search — Setup'+W);
console.log(B+'══════════════════════════════════════\n'+W);

try {
  copyHandler();
  patchIndex();
  patchCallbacks();
  patchWhitelist();

  console.log('\n'+G+'══════════════════════════════════════'+W);
  console.log(G+'  ✅  اكتمل!'+W);
  console.log(G+'══════════════════════════════════════\n'+W);
  console.log('تحقق من الأخطاء:');
  console.log('  node --check index.js');
  console.log('  node --check handlers/music.js');
  console.log('  node --check bot/callbacks.js\n');
  console.log('ثم ارفع:');
  console.log('  git add -A && git commit -m "feat: music search system (Deezer)" && git push\n');
  console.log('الأوامر المتاحة:');
  console.log('  🎵 اسم الأغنية  (في القروب أو الخاص)');
  console.log('  موسيقى اسم الأغنية');
  console.log('  أغنية اسم الأغنية');
} catch(e) {
  err('خطأ: ' + e.message);
  console.error(e);
  process.exit(1);
}
