'use strict';
const bundlesDb = require('../database/bundles');
const content = require('../database/content');
const { build, btn, back } = require('../utils/keyboard');
const { eos, escMd } = require('../utils/helpers');
const filesDb = require('../database/files');

async function showBundle(ctx, bundleId, spId, yrId, smId, sbId, catId) {
  const [b, files] = await Promise.all([bundlesDb.getBundle(bundleId), bundlesDb.getBundleFiles(bundleId)]);
  if (!b) return ctx.reply('❌ غير موجود');
  let text = '📦 *' + escMd(b.title) + '*\n' + (b.description ? '📝 ' + escMd(b.description) + '\n' : '') + '━━━━━━━━━━━━\n';
  if (files.length) files.forEach((f, i) => { text += (i + 1) + '. ' + escMd(f.title || 'ملف') + '\n'; });
  const rows = [];
  if (files.length) rows.push([btn('📥 تحميل الكل', 'dl_bundle_' + bundleId + '_' + spId + '_' + yrId + '_' + smId + '_' + sbId + '_' + catId)]);
  rows.push(back('mg_fls_' + spId + '_' + yrId + '_' + smId + '_' + sbId + '_' + catId));
  return eos(ctx, text, { parse_mode: 'Markdown', ...build(rows) });
}

async function addBundle(ctx, catId, title, desc, uid) {
  return bundlesDb.addBundle(catId, title, desc || '', uid);
}

async function renameBundle(id, title) {
  return bundlesDb.renameBundle(id, title);
}

async function deleteBundle(id) {
  return bundlesDb.deleteBundle(id);
}

async function addBundleFile(bundleId, fileId, fileType, title) {
  return bundlesDb.addBundleFile(bundleId, fileId, fileType, title);
}

async function getBundles(catId) {
  return bundlesDb.getBundles(catId);
}

module.exports = { showBundle, addBundle, renameBundle, deleteBundle, addBundleFile, getBundles };
