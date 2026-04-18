'use strict';
var safeInt = function(v) { var n = parseInt(v); return isNaN(n) ? 0 : n; };
const content = require('../../database/content');
const filesDb = require('../../database/files');
const adminsDb = require('../../database/admins');
const usersDb = require('../../database/users');
const interactions = require('../../database/interactions');
const bundlesDb = require('../../database/bundles');
const messagesDb = require('../../database/messages');
const { all } = require('../../database/db');
const { eos, escMd, buildPath } = require('../../utils/helpers');
const { build, btn, back, backMenu } = require('../../utils/keyboard');
const { cacheGet, cacheSet } = require('../../utils/cache');
const { isOwner } = require('../../middlewares/auth');

var PS = 10;

async function mainMenu(ctx) {
  var specs0 = await content.getSpecs();
  var files0 = await filesDb.totalFiles();
  var text = '🛠 *لوحة الإدارة*\n\n📚 التخصصات: *' + specs0.length + '*\n📁 الملفات: *' + files0 + '*\n🔧 الصيانة: *' + (global.maintenanceMode ? '🔴 مفعّل' : '🟢 متوقف') + '*';
  var rows = [[btn('📂 المحتوى', 'mg_content')], [btn('📊 الإحصائيات', 'mg_analytics'), btn('📜 السجلات', 'mg_logs')]];
  if (isOwner(ctx.uid)) {
    rows.push([btn('📢 بث', 'mg_broadcast'), btn('👥 المستخدمون', 'mg_users')]);
    rows.push([btn('👑 الإداريون', 'mg_admins')]);
    rows.push([btn('💾 نسخ احتياطي', 'mg_backup'), btn(global.maintenanceMode ? '🟢 إيقاف الصيانة' : '🔴 وضع الصيانة', 'mg_maint')]);
    rows.push([btn('♻️ استعادة', 'mg_restore'), btn('🗑 سلة المحذوفات', 'mg_trash')]);
    rows.push([btn('🔔 إشعار للمستخدمين', 'mg_notify'), btn('📣 إشعار القروبات', 'mg_notify_groups')]);
    rows.push([btn('🚩 البلاغات', 'mg_reports')]);
    rows.push([btn('📨 نظام الرسائل', 'mg_msgs')]);
    rows.push([btn('🎓 إشعار لتخصص', 'mg_notify_sp')]);
  }
  rows.push([btn('🏠 القائمة الرئيسية', 'main_menu')]);
  return eos(ctx, text, { parse_mode: 'Markdown', ...build(rows) });
}

async function showContent(ctx) {
  var adminSp = ctx.isOwner ? 0 : await adminsDb.getAdminSpecialty(ctx.uid);
  var specs = await content.getSpecs();
  if (adminSp && adminSp != 0) specs = specs.filter(function(s) { return s.id == adminSp; });
  var rows = specs.map(function(s) { return [btn('🎓 ' + s.name, 'mg_yrs_' + s.id), btn('✏️', 'mg_rn_sp_' + s.id), btn('🗑', 'mg_dl_sp_' + s.id)]; });
  rows.push([btn('➕ إضافة تخصص', 'mg_add_sp')]);
  rows.push([btn('🗑 حذف الكل نهائياً', 'mg_empty_trash')]);
  rows.push(back('mg_menu'));
  return eos(ctx, '🎓 *التخصصات*' + (specs.length ? '' : '\n_لا يوجد._'), { parse_mode: 'Markdown', ...build(rows) });
}

async function showYears(ctx, spId) {
  spId = safeInt(spId);
  var results = await Promise.all([content.getSpec(spId), content.getYears(spId)]);
  var sp = results[0], years = results[1];
  var rows = years.map(function(y) { return [btn('📅 ' + y.name, 'mg_sems_' + spId + '_' + y.id), btn('✏️', 'mg_rn_yr_' + spId + '_' + y.id), btn('🗑', 'mg_dl_yr_' + spId + '_' + y.id)]; });
  rows.push([btn('➕ إضافة سنة', 'mg_add_yr_' + spId)]);
  rows.push(back('mg_content'));
  return eos(ctx, '🎓 *' + escMd(sp ? sp.name : '') + '*\n📅 السنوات', { parse_mode: 'Markdown', ...build(rows) });
}

async function showSemesters(ctx, spId, yrId) {
  spId = safeInt(spId); yrId = safeInt(yrId);
  var results = await Promise.all([content.getSpec(spId), content.getYear(yrId), content.getSemesters(yrId)]);
  var sp = results[0], yr = results[1], sems = results[2];
  var rows = sems.map(function(s) { return [btn('📆 ' + s.name, 'mg_sbs_' + spId + '_' + yrId + '_' + s.id), btn('✏️', 'mg_rn_sem_' + spId + '_' + yrId + '_' + s.id), btn('🗑', 'mg_dl_sem_' + spId + '_' + yrId + '_' + s.id)]; });
  rows.push([btn('➕ إضافة فصل', 'mg_add_sem_' + spId + '_' + yrId)]);
  rows.push(back('mg_yrs_' + spId));
  return eos(ctx, buildPath([escMd(sp ? sp.name : ''), escMd(yr ? yr.name : '')]) + '\n📆 الفصول', { parse_mode: 'Markdown', ...build(rows) });
}

async function showSubjects(ctx, spId, yrId, smId) {
  spId = safeInt(spId); yrId = safeInt(yrId); smId = safeInt(smId);
  var results = await Promise.all([content.getSemester(smId), content.getSubjects(smId)]);
  var sm = results[0], subs = results[1];
  var rows = subs.map(function(s) { return [btn('📖 ' + s.name, 'mg_cats_' + spId + '_' + yrId + '_' + smId + '_' + s.id), btn('✏️', 'mg_rn_sb_' + spId + '_' + yrId + '_' + smId + '_' + s.id), btn('🗑', 'mg_dl_sb_' + spId + '_' + yrId + '_' + smId + '_' + s.id)]; });
  rows.push([btn('➕ إضافة مادة', 'mg_add_sb_' + spId + '_' + yrId + '_' + smId)]);
  rows.push(back('mg_sems_' + spId + '_' + yrId));
  return eos(ctx, '📆 *' + escMd(sm ? sm.name : '') + '*\n📖 المواد', { parse_mode: 'Markdown', ...build(rows) });
}

async function showCategories(ctx, spId, yrId, smId, sbId) {
  spId = safeInt(spId); yrId = safeInt(yrId); smId = safeInt(smId); sbId = safeInt(sbId);
  var results = await Promise.all([content.getSubject(sbId), content.getCategories(sbId)]);
  var sb = results[0], cats = results[1];
  var rows = cats.map(function(c) { return [btn('📁 ' + c.name, 'mg_fls_' + spId + '_' + yrId + '_' + smId + '_' + sbId + '_' + c.id), btn('✏️', 'mg_rn_cat_' + spId + '_' + yrId + '_' + smId + '_' + sbId + '_' + c.id), btn('🗑', 'mg_dl_cat_' + spId + '_' + yrId + '_' + smId + '_' + sbId + '_' + c.id)]; });
  rows.push([btn('➕ إضافة فئة', 'mg_add_cat_' + spId + '_' + yrId + '_' + smId + '_' + sbId)]);
  rows.push(back('mg_sbs_' + spId + '_' + yrId + '_' + smId));
  return eos(ctx, '📖 *' + escMd(sb ? sb.name : '') + '*\n📁 الفئات', { parse_mode: 'Markdown', ...build(rows) });
}

async function showMgFiles(ctx, spId, yrId, smId, sbId, catId, page) {
  spId = safeInt(spId); yrId = safeInt(yrId); smId = safeInt(smId); sbId = safeInt(sbId); catId = safeInt(catId); page = safeInt(page) || 0;
  var results = await Promise.all([content.getCategory(catId), filesDb.getFiles(catId)]);
  var cat = results[0], all2 = results[1];
  var total = all2.length, list = all2.slice(page * PS, (page + 1) * PS);
  var text = '📁 *' + escMd(cat ? cat.name : '') + '*\n━━━━━━━━━━━━\n' + (total ? '📄 *' + total + ' ملف*' : '_لا توجد ملفات._');
  var rows = [];
  for (var i = 0; i < list.length; i++) {
    var f = list[i];
    rows.push([btn('📄 ' + f.title, 'preview_' + f.id + '_0_0_0_0_0')]);
    rows.push([btn('✏️', 'mg_rn_fl_' + spId + '_' + yrId + '_' + smId + '_' + sbId + '_' + catId + '_' + f.id), btn('📝', 'mg_desc_fl_' + spId + '_' + yrId + '_' + smId + '_' + sbId + '_' + catId + '_' + f.id), btn('🗑', 'mg_dl_fl_' + spId + '_' + yrId + '_' + smId + '_' + sbId + '_' + catId + '_' + f.id)]);
  }
  if (total > PS) {
    var nav = [];
    if (page > 0) nav.push(btn('⬅️', 'mg_fls_pg_' + spId + '_' + yrId + '_' + smId + '_' + sbId + '_' + catId + '_' + (page - 1)));
    nav.push(btn((page + 1) + '/' + Math.ceil(total / PS), 'noop'));
    if ((page + 1) * PS < total) nav.push(btn('➡️', 'mg_fls_pg_' + spId + '_' + yrId + '_' + smId + '_' + sbId + '_' + catId + '_' + (page + 1)));
    rows.push(nav);
  }
  var bundles2 = await bundlesDb.getBundles(catId);
  if (bundles2.length) { rows.unshift([btn('━━━ الحزم (' + bundles2.length + ') ━━━', 'noop')]); for (var bi = 0; bi < bundles2.length; bi++) rows.splice(1, 0, [btn('📦 ' + bundles2[bi].title, 'bundle_' + bundles2[bi].id + '_' + spId + '_' + yrId + '_' + smId + '_' + sbId + '_' + catId)]); }
  var uploadRow = [btn('➕ رفع ملف', 'mg_upl_' + spId + '_' + yrId + '_' + smId + '_' + sbId + '_' + catId), btn('📤 رفع متعدد', 'mg_upl_bulk_' + spId + '_' + yrId + '_' + smId + '_' + sbId + '_' + catId)];
  if (ctx.isOwner) uploadRow.push(btn('📦 حزمة', 'mg_add_bundle_' + spId + '_' + yrId + '_' + smId + '_' + sbId + '_' + catId));
  rows.push(uploadRow);
  rows.push(back('mg_cats_' + spId + '_' + yrId + '_' + smId + '_' + sbId));
  return eos(ctx, text, { parse_mode: 'Markdown', ...build(rows) });
}

async function showLogs(ctx) {
  var logs = await interactions.getLogs(20);
  var text = '📜 *آخر السجلات*\n\n';
  if (logs.length) logs.forEach(function(l) { text += '• ' + (l.first_name || 'ID:' + l.user_id) + ': ' + l.action + (l.details ? ' — ' + l.details : '') + '\n'; });
  else text += '_لا توجد سجلات._';
  return eos(ctx, text, { parse_mode: 'Markdown', ...build([back('mg_menu')]) });
}

async function showUsers(ctx, page) {
  page = safeInt(page) || 0;
  var results = await Promise.all([usersDb.getAll(page, PS), usersDb.count()]);
  var list = results[0], total = results[1];
  var text = '👥 *المستخدمون (' + total + ')*\n\n';
  for (var i = 0; i < list.length; i++) {
    var u = list[i];
    text += (page * PS + i + 1) + '. ' + escMd(u.first_name) + (u.username ? ' @' + escMd(u.username) : ' ID:' + u.id) + (u.is_banned ? ' 🚫' : '') + '\n';
  }
  var rows = list.map(function(u) { return [btn('👤 ' + (u.first_name || u.id), 'mg_profile_' + u.id), btn(u.is_banned ? '✅' : '🚫', (u.is_banned ? 'mg_unban_' : 'mg_ban_') + u.id)]; });
  var nav = [];
  if (page > 0) nav.push(btn('⬅️', 'mg_users_p' + (page - 1)));
  nav.push(btn((page + 1) + '/' + Math.ceil(total / PS), 'noop'));
  if ((page + 1) * PS < total) nav.push(btn('➡️', 'mg_users_p' + (page + 1)));
  if (nav.length) rows.push(nav);
  rows.push(back('mg_menu'));
  return eos(ctx, text, { parse_mode: 'Markdown', ...build(rows) });
}

async function showUserProfile(ctx, userId) {
  userId = safeInt(userId);
  var results = await Promise.all([usersDb.getById(userId), interactions.getUserDownloadCount(userId), usersDb.getSpecialty(userId), interactions.getLastFile(userId)]);
  var user = results[0], dlCount = results[1], spRow = results[2], lastFile = results[3];
  if (!user) return ctx.reply('❌ المستخدم غير موجود.');
  var spId = spRow ? spRow.specialty_id : null;
  var sp = spId && spId != 0 ? await content.getSpec(spId) : null;
  var text = '👤 *بروفايل المستخدم*\n\n🆔 ID: `' + userId + '`\n👋 ' + escMd(user.first_name || '؟') + '\n' + (user.username ? '📛 @' + escMd(user.username) + '\n' : '') + '🎓 ' + (sp ? escMd(sp.name) : 'غير محدد') + '\n⬇️ التحميلات: *' + dlCount + '*' + (lastFile ? '\n📄 آخر: *' + escMd(lastFile.title) + '*' : '');
  var rows = [[btn(user.is_banned ? '✅ إلغاء الحظر' : '🚫 حظر', (user.is_banned ? 'mg_unban_' : 'mg_ban_') + userId)], [back('mg_users')[0]]];
  return eos(ctx, text, { parse_mode: 'Markdown', ...build(rows) });
}

async function showTrash(ctx) {
  var list = await filesDb.getTrash();
  var text = '🗑 *سلة المحذوفات (' + list.length + ')*\n\n';
  if (!list.length) text += '_فارغة._';
  var rows = list.map(function(f) { return [btn('📄 ' + f.title, 'noop'), btn('استعادة', 'mg_restore_fl_' + f.id)]; });
  if (list.length) rows.push([btn('حذف الكل نهائياً', 'mg_empty_trash')]);
  rows.push(back('mg_menu'));
  return eos(ctx, text, { parse_mode: 'Markdown', ...build(rows) });
}

module.exports = { mainMenu, showContent, showYears, showSemesters, showSubjects, showCategories, showMgFiles, showLogs, showUsers, showUserProfile, showTrash };
