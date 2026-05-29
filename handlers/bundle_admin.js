'use strict';
const bundlesDb = require('../database/bundles');
const { all, get } = require('../database/db');
const { build, btn, back } = require('../utils/keyboard');
const { eos, escMd } = require('../utils/helpers');
const filesDb = require('../database/files');

/* ─── بحث عن حزمة ──────────────────────────────────── */
async function searchBundles(ctx, query) {
  if (!query || query.trim().length < 2) {
    await require('../utils/stateManager').setState(ctx.uid, { type: 'bundle_search' });
    return ctx.reply('🔍 اكتب اسم الحزمة للبحث:');
  }

  const rows = await all(
    `SELECT b.id, b.title, b.description, b.downloads,
            c.name as cat_name, s.name as sp_name,
            (SELECT COUNT(*) FROM bundle_files bf WHERE bf.bundle_id=b.id) as file_count
     FROM bundles b
     LEFT JOIN categories c ON b.category_id=c.id
     LEFT JOIN subjects sub ON c.subject_id=sub.id
     LEFT JOIN semesters sem ON sub.semester_id=sem.id
     LEFT JOIN years yr ON sem.year_id=yr.id
     LEFT JOIN specialties s ON yr.specialty_id=s.id
     WHERE b.is_deleted=0 AND b.title ILIKE $1
     ORDER BY b.downloads DESC LIMIT 15`,
    [`%${query.trim()}%`]
  ).catch(() => []);

  if (!rows.length) {
    return ctx.reply(
      `🔍 لا توجد حزم بكلمة: *${escMd(query)}*`,
      { parse_mode: 'Markdown', ...build([[btn('🔍 بحث جديد', 'bundle_search')]]) }
    );
  }

  let text = `🔍 نتائج: *${escMd(query)}* (${rows.length})\n━━━━━━━━━━━━\n`;
  const rows_kb = rows.map(b => {
    text += `📦 *${escMd(b.title)}*\n`;
    text += `   🗂 ${escMd(b.sp_name || '?')} · 📁 ${escMd(b.cat_name || '?')}\n`;
    text += `   📄 ${b.file_count} ملف · ⬇️ ${b.downloads || 0}\n\n`;
    return [btn(`📦 ${b.title}`, `mg_bview_${b.id}`)];
  });
  rows_kb.push([btn('🔍 بحث جديد', 'bundle_search')]);

  return eos(ctx, text, { parse_mode: 'Markdown', ...build(rows_kb) });
}

/* ─── عرض حزمة مع خيارات الإدارة ────────────────────── */
async function viewBundleAdmin(ctx, bundleId) {
  const [b, files] = await Promise.all([
    bundlesDb.getBundle(bundleId),
    bundlesDb.getBundleFiles(bundleId),
  ]);
  if (!b) return ctx.reply('❌ الحزمة غير موجودة');

  let text = `📦 *${escMd(b.title)}*\n`;
  if (b.description) text += `📝 ${escMd(b.description)}\n`;
  text += `━━━━━━━━━━━━\n`;
  text += `📄 ${files.length} ملف · ⬇️ ${b.downloads || 0} تحميل\n\n`;

  const rows = [];

  if (files.length) {
    text += `*الملفات:*\n`;
    files.forEach((f, i) => {
      text += `${i + 1}. ${escMd(f.title || 'ملف')}\n`;
      rows.push([
        btn(`🗑 ${(f.title || 'ملف').substring(0, 20)}`, `mg_brmfile_${f.id}_${bundleId}`),
      ]);
    });
  } else {
    text += '_لا توجد ملفات في هذه الحزمة_\n';
  }

  rows.push([btn('➕ إضافة ملف', `mg_baddfile_${bundleId}`)]);
  rows.push([
    btn('✏️ تعديل الاسم', `mg_brename_${bundleId}`),
    btn('🗑 حذف الحزمة', `mg_bdel_${bundleId}`),
  ]);
  rows.push([btn('🔍 بحث حزمة', 'bundle_search')]);

  return eos(ctx, text, { parse_mode: 'Markdown', ...build(rows) });
}

/* ─── حذف ملف من حزمة ──────────────────────────────── */
async function removeBundleFile(ctx, bundleFileId, bundleId) {
  await bundlesDb.removeBundleFile(parseInt(bundleFileId)).catch(() => {});
  await ctx.answerCbQuery('✅ تم حذف الملف').catch(() => {});
  return viewBundleAdmin(ctx, bundleId);
}

/* ─── إضافة ملف لحزمة موجودة ───────────────────────── */
async function startAddFileToBunde(ctx, bundleId) {
  const b = await bundlesDb.getBundle(bundleId);
  if (!b) return ctx.reply('❌ الحزمة غير موجودة');
  await require('../utils/stateManager').setState(ctx.uid, {
    type: 'mg_bundle_files',
    bundleId: parseInt(bundleId),
    fileCount: 0,
    fromSearch: true,
  });
  return ctx.reply(
    `➕ أرسل الملفات لإضافتها إلى:\n📦 *${escMd(b.title)}*\n\nأرسل /done عند الانتهاء.`,
    { parse_mode: 'Markdown' }
  );
}

/* ─── تعديل اسم حزمة ───────────────────────────────── */
async function startRenameBundle(ctx, bundleId) {
  await require('../utils/stateManager').setState(ctx.uid, { type: 'mg_brename', bundleId: parseInt(bundleId) });
  return ctx.reply('✏️ أدخل الاسم الجديد للحزمة:');
}

/* ─── حذف حزمة كاملة ───────────────────────────────── */
async function deleteBundle(ctx, bundleId) {
  await bundlesDb.deleteBundle(parseInt(bundleId)).catch(() => {});
  await ctx.answerCbQuery('✅ تم حذف الحزمة').catch(() => {});
  return ctx.reply(
    '✅ تم حذف الحزمة.',
    { ...build([[btn('🔍 بحث حزمة', 'bundle_search')]]) }
  );
}

/* ─── handleText للـstates ──────────────────────────── */
async function handleBundleText(ctx) {
  const uid = ctx.uid;
  const state = require('../utils/stateManager').getState ? require('../utils/stateManager').getState(uid) : null;
  const text = ctx.message?.text?.trim();
  if (!state || !text) return false;

  // بحث عن حزمة
  if (state.type === 'bundle_search') {
    await require('../utils/stateManager').delState(uid);
    await searchBundles(ctx, text);
    return true;
  }

  // تعديل اسم حزمة
  if (state.type === 'mg_brename') {
    await require('../utils/stateManager').delState(uid);
    await bundlesDb.renameBundle(state.bundleId, text).catch(() => {});
    await ctx.reply('✅ تم تعديل اسم الحزمة');
    await viewBundleAdmin(ctx, state.bundleId);
    return true;
  }

  return false;
}

module.exports = {
  searchBundles,
  viewBundleAdmin,
  removeBundleFile,
  startAddFileToBunde,
  startRenameBundle,
  deleteBundle,
  handleBundleText,
};
