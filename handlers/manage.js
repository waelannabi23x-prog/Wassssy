'use strict';
var safeInt = function(v) { var n = parseInt(v); return isNaN(n) ? 0 : n; };
const content = require('../database/content');
const bundlesDb = require('../database/bundles');
const filesDb = require('../database/files');
const adminsDb = require('../database/admins');
const usersDb = require('../database/users');
const interactions = require('../database/interactions');
const browse = require('./browse');
const { eos, escMd, buildPath } = require('../utils/helpers');
const { build, btn, back, backMenu } = require('../utils/keyboard');
const { cacheGet, cacheSet } = require('../utils/cache');
const { isOwner } = require('../middlewares/auth');
const { all, run: dbRun } = require('../database/db');
const messagesDb = require('../database/messages');

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
  if (bundles2.length) {
    rows.unshift([btn('━━━ الحزم (' + bundles2.length + ') ━━━', 'noop')]);
    for (var bi = 0; bi < bundles2.length; bi++) rows.splice(1, 0, [btn('📦 ' + bundles2[bi].title, 'bundle_' + bundles2[bi].id + '_' + spId + '_' + yrId + '_' + smId + '_' + sbId + '_' + catId)]);
  }
  var uploadRow = [btn('➕ رفع ملف', 'mg_upl_' + spId + '_' + yrId + '_' + smId + '_' + sbId + '_' + catId), btn('📤 رفع متعدد', 'mg_upl_bulk_' + spId + '_' + yrId + '_' + smId + '_' + sbId + '_' + catId)];
  if (ctx.isOwner) uploadRow.push(btn('📦 حزمة', 'mg_add_bundle_' + spId + '_' + yrId + '_' + smId + '_' + sbId + '_' + catId));
  rows.push(uploadRow);
  rows.push(back('mg_cats_' + spId + '_' + yrId + '_' + smId + '_' + sbId));
  return eos(ctx, text, { parse_mode: 'Markdown', ...build(rows) });
}

async function showAnalytics(ctx) {
  var _ckey = "analytics_admin";
  var _cc = cacheGet(_ckey);
  if (_cc) return eos(ctx, _cc.text, { parse_mode: "Markdown", ...build(_cc.rows) });
  var r1 = await Promise.all([filesDb.topDownloaded(5), filesDb.recentFiles(5), usersDb.count(), usersDb.activeToday(), filesDb.totalFiles(), filesDb.totalDownloads(), content.getSpecs(), all('SELECT COUNT(*) as c FROM group_chats').then(function(r) { return r[0] ? r[0].c : 0; })]);
  var top = r1[0], recent = r1[1], totalUsers = r1[2], activeToday = r1[3], totalFiles = r1[4], totalDl = r1[5], specs = r1[6], totalGroups = r1[7];
  var r2 = await Promise.all([
    all("SELECT sp.name, COUNT(us.user_id) as cnt FROM user_specialties us LEFT JOIN specialties sp ON us.specialty_id=sp.id GROUP BY sp.name ORDER BY cnt DESC LIMIT 5"),
    all("SELECT u.first_name, u.username, COUNT(h.id) as cnt FROM history h LEFT JOIN users u ON h.user_id=u.id GROUP BY h.user_id, u.first_name, u.username ORDER BY cnt DESC LIMIT 5"),
    all("SELECT EXTRACT(HOUR FROM viewed_at::timestamp) as hour, COUNT(*) as cnt FROM history GROUP BY hour ORDER BY cnt DESC LIMIT 3"),
    all("SELECT c.name, COUNT(h.id) as cnt FROM history h LEFT JOIN files f ON h.file_id=f.id LEFT JOIN categories c ON f.category_id=c.id WHERE h.viewed_at >= NOW() - INTERVAL '7 days' GROUP BY c.name ORDER BY cnt DESC LIMIT 3")
  ]);
  var spDist = r2[0], topUsers = r2[1], peakHours = r2[2], topCats = r2[3];
  var text = '📊 *لوحة الإحصائيات المتقدمة*\n━━━━━━━━━━━━\n👥 المستخدمون: *' + totalUsers + '*\n🟢 نشطون اليوم: *' + activeToday + '*\n📁 الملفات: *' + totalFiles + '*\n⬇️ التحميلات: *' + totalDl + '*\n🎓 التخصصات: *' + specs.length + '*\n👥 القروبات: *' + totalGroups + '*\n';
  if (topGroups) topGroups.forEach(function(g, i) { text += (i + 1) + '. ' + escMd(g.title || 'بدون اسم') + ' — *' + g.members + '*\n'; });
  if (spDist) spDist.forEach(function(s, i) { text += '\n' + (i + 1) + '. ' + escMd(s.name || 'غير محدد') + ' — *' + s.cnt + '*'; });
  if (topUsers) topUsers.forEach(function(u, i) { text += '\n' + (i + 1) + '. ' + escMd(u.first_name || '?') + (u.username ? ' @' + escMd(u.username) : '') + ' — *' + u.cnt + '*'; });
  if (peakHours) peakHours.forEach(function(h, i) { text += '\n⏰ الساعة *' + Math.round(h.hour) + ':00* — *' + h.cnt + '*'; });
  if (topCats) topCats.forEach(function(c, i) { text += '\n📁 *' + escMd(c.name || '?') + ' — *' + c.cnt + '*'; });
  text += '\n🏆 *الأكثر تحميلاً:*\n';
  top.forEach(function(f, i) { text += (i + 1) + '. ' + escMd(f.title) + ' ⬇️*' + f.downloads + '*\n'; });
  text += '\n🆕 *أحدث الملفات:*\n';
  recent.forEach(function(f, i) { text += (i + 1) + '. ' + escMd(f.title) + '\n'; });
  var rows = [[btn('🔄 تحديث', 'mg_analytics')], back('mg_menu')];
  cacheSet(_ckey, { text: text, rows: rows }, 600000);
  return eos(ctx, text, { parse_mode: 'Markdown', ...build(rows) });
}

async function showLogs(ctx) {
  var _lk = 'admin_logs';
  var _lc = cacheGet(_lk);
  var logs = _lc || await interactions.getLogs(20);
  if (!_lc) cacheSet(_lk, logs, 60000);
  var text = '📜 *آخر السجلات*\n\n';
  if (logs.length) logs.forEach(function(l) { text += '• ' + (l.first_name || 'ID:' + l.user_id) + ': ' + l.action + (l.details ? ' — ' + l.details : '') + '\n'; });
  else text += '_لا توجد سجلات._';
  return eos(ctx, text, { parse_mode: 'Markdown', ...build([back('mg_menu')]) });
}

async function showUsers(ctx, page) {
  page = safeInt(page) || 0;
  var _uk = 'admin_users_' + page;
  var _uc = cacheGet(_uk);
  var results = _uc ? [_uc.list, _uc.total] : await Promise.all([usersDb.getAll(page, PS), usersDb.count()]).then(function(r) { cacheSet(_uk, { list: r[0], total: r[1] }, 30000); return [r[0], r[1]]; });
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
  var text = '👤 *بروفايل المستخدم*\n\n🆔 ID: `' + userId + '`\n👋 ' + escMd(user.first_name || '؟') + '\n' + (user.username ? '📛 @' + escMd(user.username) + '\n' : '') + '🎓 ' + (sp ? escMd(sp.name) : 'غير محدد') + '\n⬇️ التحميلات: *' + dlCount + '*' + (lastFile ? '\n📄 آخر ملف: *' + escMd(lastFile.title) : '');
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

async function showMsgsMenu(ctx) {
  var results = await Promise.all([messagesDb.getTemplates(), messagesDb.getScheduled()]);
  var templates = results[0], scheduled = results[1];
  var text = '📨 *نظام الرسائل*\n\n📝 القوالب: *' + templates.length + '*\n📅 المجدولة: *' + scheduled.length + '*';
  var rows = [[btn('📝 القوالب', 'mg_templates'), btn('📅 المجدولة', 'mg_scheduled')]];
  rows.push([btn('➕ قالب جديد', 'mg_add_template')]);
  rows.push(back('mg_menu'));
  return eos(ctx, text, { parse_mode: 'Markdown', ...build(rows) });
}

async function showTemplates(ctx) {
  var list = await messagesDb.getTemplates();
  var rows = list.map(function(t) { return [btn(t.name, 'mg_tpl_' + t.id)]; });
  rows.push([btn('➕ قالب جديد', 'mg_add_template')]);
  rows.push(back('mg_msgs'));
  return eos(ctx, '📝 *القوالب (' + list.length + ')*', { parse_mode: 'Markdown', ...build(rows) });
}

async function showScheduled(ctx) {
  var list = await messagesDb.getScheduled();
  var rows = list.map(function(s) { return [btn((s.name || 'رسالة') + ' — ' + s.send_at, 'noop'), btn('🗑', 'mg_del_sched_' + s.id)]; });
  rows.push(back('mg_msgs'));
  return eos(ctx, '📅 *المجدولة (' + list.length + ')*', { parse_mode: 'Markdown', ...build(rows) });
}

var MAX_SIZE = 20 * 1024 * 1024;
var ALLOWED = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.gif', '.mp4', '.zip', '.rar', '.txt', '.md', '.csv', '.link', '.photo', '.video', '.audio', '.voice'];

async function handleFileUpload(ctx) {
  var msg = ctx.message;
  var fid, ftype, ftitle = '';
  var isLink = msg.entities && msg.entities.some(function(e) { return e.type === 'url' || e.type === 'text_link'; });
  if (isLink) { fid = (msg.text || msg.caption || '').trim(); ftype = 'link'; ftitle = 'رابط'; }
  else if (msg.document) {
    fid = msg.document.file_id; ftype = 'document';
    var fn = msg.document.file_name || '';
    if (!fn) { await ctx.reply('⚠️ الملف بدون اسم'); return; }
    if (msg.document.file_size > MAX_SIZE) { await ctx.reply('⚠️ كبير جداً (الحد 20MB)'); return; }
    ftitle = fn.replace(/.[^/.]+$/, '').trim() || 'ملف';
    var ext = fn.substring(fn.lastIndexOf('.')).toLowerCase();
    if (ALLOWED.indexOf(ext) === -1) { await ctx.reply('⚠️ نوع غير مسموح: ' + ext); return; }
  } else if (msg.photo) { fid = msg.photo[msg.photo.length - 1].file_id; ftype = 'photo'; ftitle = msg.caption || 'صورة'; }
  else if (msg.video) { fid = msg.video.file_id; ftype = 'document'; ftitle = msg.video.file_name || 'فيديو'; }
  else if (msg.audio || msg.voice) { fid = (msg.audio || msg.voice).file_id; ftype = 'document'; ftitle = 'ملف صوت'; }
  else { await ctx.reply('ارسل ملف أو رابط. أو /cancel'); return; }
  try {
    var newFile = await filesDb.addFile(ctx.state.catId, ctx.state.title, ctx.state.desc || '', fid, ftype, ctx.uid);
    await interactions.addLog(ctx.uid, 'upload', ctx.state.title);
    await global.delState(ctx.uid);
    if (newFile && global.__bot) {
      var notify = require('../utils/groupNotify');
      notify.notifyGroupsNewFile(global.__bot, newFile).catch(function(){});
    }
    await ctx.reply('✅ *' + escMd(ctx.state.title) + '* رُفع بنجاح!', {
      parse_mode: 'Markdown',
      ...build([[btn('➕ رفع آخر', 'mg_upl_' + ctx.state.spId + '_' + ctx.state.yrId + '_' + ctx.state.smId + '_' + ctx.state.sbId + '_' + ctx.state.catId)], [btn('📁 عرض الملفات', 'mg_fls_' + ctx.state.spId + '_' + ctx.state.yrId + '_' + ctx.state.smId + '_' + ctx.state.sbId + '_' + ctx.state.catId)]])
    });
  } catch (e) {
    await global.delState(ctx.uid);
    ctx.reply(e.message === 'exists' ? '❌ يوجد ملف بهذا الاسم!' : '❌ فشل: ' + e.message).catch(function(){});
  }
}

async function handleBulkUpload(ctx) {
  var uid = ctx.uid;
  var state = global.userStates && global.userStates[uid];
  if (!state || state.type !== 'mg_bulk_files') return false;
  var msg = ctx.message;
  var fid, ftype, title = '';
  if (msg.document) {
    fid = msg.document.file_id; ftype = 'document';
    title = msg.document.file_name || msg.caption || ('ملف_' + Date.now());
    title = title.replace(/.[^/.]+$/, '').trim() || ('ملف_' + Date.now());
  } else if (msg.photo) {
    fid = msg.photo[msg.photo.length - 1].file_id; ftype = 'photo'; title = msg.caption || ('صورة_' + Date.now());
  } else if (msg.video) {
    fid = msg.video.file_id; ftype = 'document';
    title = msg.video.file_name || msg.caption || ('فيديو_' + Date.now());
    title = title.replace(/.[^/.]+$/, '').trim() || ('فيديو_' + Date.now());
  } else if (msg.audio) {
    fid = msg.audio.file_id; ftype = 'document';
    title = msg.audio.title || msg.audio.file_name || ('صوت_' + Date.now());
  } else { return false; }
  var finalTitle = state.prefix ? state.prefix + ' — ' + title : title;
  try {
    await filesDb.addFile(state.catId, finalTitle, '', fid, ftype, uid);
    state.uploaded = state.uploaded || [];
    state.uploaded.push(finalTitle);
    ctx.reply('✅ ' + finalTitle).catch(function(){});
  } catch (e) {
    state.failed = state.failed || [];
    state.failed.push(finalTitle + (e.message === 'exists' ? ' (موجود)' : ''));
  }
  return true;
}

async function handleBundleFileUpload(ctx) {
  var uid = ctx.uid;
  var state = global.userStates && global.userStates[uid];
  if (!state || state.type !== 'mg_bundle_files') return false;
  var msg = ctx.message;
  var fid, ftype, title = '';
  if (msg.document) { fid = msg.document.file_id; ftype = 'document'; title = msg.document.file_name || ''; }
  else if (msg.photo) { fid = msg.photo[msg.photo.length - 1].file_id; ftype = 'photo'; }
  else if (msg.video) { fid = msg.video.file_id; ftype = 'document'; }
  else if (msg.audio) { fid = msg.audio.file_id; ftype = 'document'; }
  else return false;
  await bundlesDb.addBundleFile(state.bundleId, fid, ftype, title);
  state.fileCount = (state.fileCount || 0) + 1;
  ctx.reply('✅ ملف ' + state.fileCount + ' تم. أبعث المزيد أو /done').catch(function(){});
  return true;
}

async function handleText(ctx, state) {
  var uid = ctx.uid;
  var text = ctx.message.text ? ctx.message.text.trim() : ctx.message.caption ? ctx.message.caption.trim() : '';
  if (text === '/cancel') { clearState(uid); return ctx.reply('تم الإلغاء.', build([back('mg_menu')])); }
  var done = function(msg, cb) { clearState(uid); ctx.reply(msg, { parse_mode: 'Markdown', ...build([[btn('◀️ رجوع', cb)]]) }); };
  try {
    switch (state.type) {
      case 'mg_add_sp': await content.addSpec(text); done('✅ تم إضافة *' + text + '*!', 'mg_content'); break;
      case 'mg_rn_sp': await content.renameSpec(state.id, text); done('✅ تمت التسمية!', 'mg_content'); break;
      case 'mg_add_yr_': await content.addYear(state.spId, text); done('✅ تمت الإضافة!', 'mg_yrs_' + state.spId); break;
      case 'mg_rn_yr_': await content.renameYear(state.id, text); done('✅ تمت التسمية!', 'mg_yrs_' + state.spId); break;
      case 'mg_add_sem_': await content.addSemester(state.yrId, text); done('✅ تمت الإضافة!', 'mg_sems_' + state.spId + '_' + state.yrId); break;
      case 'mg_rn_sem_': await content.renameSemester(state.id, text); done('✅ تمت التسمية!', 'mg_sems_' + state.spId + '_' + state.yrId); break;
      case 'mg_add_sb_': await content.addSubject(state.smId, text); done('✅ تمت الإضافة!', 'mg_sbs_' + state.spId + '_' + state.yrId + '_' + state.smId); break;
      case 'mg_rn_sb_': await content.renameSubject(state.id, text); done('✅ تمت التسمية!', 'mg_sbs_' + state.spId + '_' + state.yrId + '_' + state.smId); break;
      case 'mg_add_cat_': await content.addCategory(state.sbId, text); done('✅ تمت الإضافة!', 'mg_cats_' + state.spId + '_' + state.yrId + '_' + state.smId + '_' + state.sbId); break;
      case 'mg_rn_cat_': await content.renameCategory(state.id, text); done('✅ تمت التسمية!', 'mg_cats_' + state.spId + '_' + state.yrId + '_' + state.smId + '_' + state.sbId); break;
      case 'mg_rename_bundle': await bundlesDb.renameBundle(state.bundleId, text); done('✅ تم تعديل الاسم', 'mg_fls_' + [state.spId, state.yrId, state.smId, state.sbId, state.catId].join('_')); break;
      case 'mg_bundle_title': setState(uid, Object.assign({}, state, { type: 'mg_bundle_desc', title: text })); ctx.reply('📝 وصف الحزمة (أو skip):'); break;
      case 'mg_bundle_desc': try { var bid = await bundlesDb.addBundle(state.catId, state.title, text === 'skip' ? '' : text, uid); setState(uid, Object.assign({}, state, { type: 'mg_bundle_files', bundleId: bid, fileCount: 0 })); ctx.reply('✅ تم إنشاء الحزمة! ابعث الملفات أو /done'); } catch(e) { clearState(uid); ctx.reply(e.message === 'exists' ? 'حزمة موجودة' : 'خطأ: ' + e.message); } break;
      case 'mg_upl_title': setState(uid, Object.assign({}, state, { type: 'mg_upl_desc', title: text })); ctx.reply('📝 الوصف (أو skip):'); break;
      case 'mg_bulk_prefix': setState(uid, Object.assign({}, state, { type: 'mg_bulk_files', prefix: text === 'skip' ? '' : text, uploaded: [], failed: [] })); ctx.reply('ارسل الملفات. /done للانتهاء.'); break;
      case 'mg_upl_desc': setState(uid, Object.assign({}, state, { type: 'mg_file', desc: text === 'skip' ? '' : text, catId: state.catId })); ctx.reply('📎 أرسل الملف:\n_(أو /cancel)_', { parse_mode: 'Markdown' }); break;
      case 'mg_rn_fl_': await filesDb.rename(state.id, text); done('✅ تمت التسمية!', 'mg_fls_' + [state.spId, state.yrId, state.smId, state.sbId, state.catId].join('_')); break;
      case 'mg_desc_fl_': await filesDb.updateDesc(state.id, text); done('✅ تم التحديث!', 'mg_fls_' + [state.spId, state.yrId, state.smId, state.sbId, state.catId].join('_')); break;
      case 'mg_maint': global.maintenanceMode = !global.maintenanceMode; await setSetting('maintenance', global.maintenanceMode ? 'true' : 'false'); await interactions.addLog(uid, 'maintenance', global.maintenanceMode ? 'ON' : 'OFF'); var mm = '🔧 *الصيانة: ' + (global.maintenanceMode ? '🔴 مفعّلة' : '🟢 متوقفة') + '*'; return eos(ctx, mm, { parse_mode: 'Markdown', ...build([[btn(global.maintenanceMode ? '🟢 إيقاف' : '🔴 تفعيل', 'mg_maint')], [btn('📝 تعديل الرسالة', 'mg_set_maint_msg'), btn('◀️ رجوع', 'mg_menu')]]) }); break;
      case 'mg_set_maint_msg': global.maintenanceMsg = text; clearState(uid); ctx.reply('✅ تم تحديث رسالة الصيانة', build([back('mg_menu')])); break;
      case 'mg_backup': try { await ctx.replyWithDocument({ source: DB_PATH, filename: 'backup_' + Date.now() + '.db' }, { caption: '💾 نسخ احتياطي — ' + new Date().toLocaleString() }); } catch(e) { ctx.reply('❌ فشل: ' + e.message); } break;
      case 'mg_restore': setState(uid, { type: 'mg_awaiting_restore' }); return eos(ctx, '♻️ *استعادة قاعدة البيانات*\n\nأرسل ملف `.db`:', { parse_mode: 'Markdown', ...build([back('mg_menu')]) });
      case 'mg_broadcast': clearState(uid); var ids = await usersDb.allIds(); var total = ids.length; var s = 0, f = 0; var sm = await ctx.reply('📢 *جاري الإرسال...*\n`[░░░░░░░░░] 0%\n✅ 0 | ❌ 0 | ⏳ ' + total); for (var i = 0; i < total; i += 30) { var r = await Promise.allSettled(ids.slice(i, i + 30).map(function(id) { return ctx.telegram.sendMessage(id, '📢 *إعلان*\n\n' + text, { parse_mode: 'Markdown' }).then(function() { return true; }).catch(function() { return false; }); })); r.forEach(function(x) { if (x.status === 'fulfilled' && x.value) s++; else f++; }); var p = Math.round((s + f) / total * 100); var b = '█'.repeat(Math.round(p / 10)) + '░'.repeat(10 - Math.round(p / 10)); ctx.telegram.editMessageText(ctx.chat.id, sm.message_id, null, '✅ *اكتمل!*\n`[' + b + '] 100%\n✅ ' + s + ' | ❌ ' + f, { parse_mode: 'Markdown', ...build([back('mg_menu')]) }).catch(function(){}); if (i + 30 < total) await new Promise(function(r) { setTimeout(r, 50); }); } return; break;
      case 'mg_notify_sp': var specs = await content.getSpecs(); var rows = specs.map(function(s) { return [btn('🎓 ' + s.name, 'mg_notify_sp_' + s.id)]; }); rows.push(back('mg_menu')); return ctx.reply('🎓 اختر تخصص لإرسال إشعار:', { ...build(rows) }); break;
      case 'mg_notify_sp_msg': clearState(uid); var spUsers = await usersDb.getUsersBySpecialty(state.spId); var results = await Promise.allSettled(spUsers.map(function(id) { return ctx.telegram.sendMessage(id, '🔔 ' + text, { parse_mode: 'Markdown' }).then(function() { return true; }).catch(function() { return false; }); })); var s = results.filter(function(x) { return x.status === 'fulfilled' && x.value; }).length; ctx.reply('✅ أُرسل لـ *' + s + '* مستخدم', { parse_mode: 'Markdown', ...build([back('mg_menu')]) }).catch(function(){}); break;
      case 'mg_notify_groups_msg': clearState(uid); var groups = state.spId === '0' ? await all('SELECT chat_id FROM group_chats') : await all('SELECT chat_id FROM group_chats WHERE specialty_id=$1', [state.spId]); var gSent = 0, gFail = 0; for (var gi = 0; gi < groups.length; gi++) { try { await ctx.telegram.sendMessage(groups[gi].chat_id, '📣 *إشعار*\n\n' + text, { parse_mode: 'Markdown' }); gSent++; } catch (_) { gFail++; } await new Promise(function(r) { setTimeout(r, 100); }); } ctx.reply('✅ أُرسل لـ *' + gSent + ' قروب' + (gFail ? ' | ❌ ' + gFail : ''), { parse_mode: 'Markdown', ...build([back('mg_menu')]) }); break;
      case 'mg_notify_msg': clearState(uid); var nIds = await interactions.getActiveUsers(7); var results2 = await Promise.allSettled(nIds.map(function(id) { return ctx.telegram.sendMessage(id, '🔔 *إشعار*\n\n' + text, { parse_mode: 'Markdown' }).then(function() { return true; }).catch(function() { return false; }); })); var nSent = results2.filter(function(x) { return x.status === 'fulfilled' && x.value; }).length; ctx.reply('✅ أُرسل لـ *' + nSent + '* مستخدم نشط!', { parse_mode: 'Markdown', ...build([back('mg_menu')]) }).catch(function(){}); break;
      case 'mg_add_admin_id': var tid = parseInt(text); if (isNaN(tid)) { clearState(uid); return ctx.reply('❌ ID غير صحيح.'); } await adminsDb.add(tid, uid); await interactions.addLog(uid, 'add_admin', 'ID: ' + tid); if (global.invalidateAdmin) global.invalidateAdmin(tid); var specs2 = await content.getSpecs(); var spRows = specs2.map(function(s) { return [btn('🎓 ' + s.name, 'mg_admin_sp_' + tid + '_' + s.id)]; }); spRows.push([btn('كل التخصصات', 'mg_admin_sp_' + tid + '_0')]); clearState(uid); ctx.reply('اختر تخصص المشرف:', { ...build(spRows) }); try { ctx.telegram.sendMessage(tid, '🎉 تمت إضافتك مشرفاً', { parse_mode: 'Markdown' }); } catch (_) {} break;
      case 'mg_admin_sp_': await adminsDb.setSpecialty(p[0], p[1]); return eos(ctx, '✅ تم تحديد التخصص', { ...build([back('mg_admins')]) }); break;
      case 'mg_ep_': return showEditPerms(ctx, data.replace('mg_ep_', ''));
      case 'mg_tp_': var p = data.replace('mg_tp_', '').split('_'); var list2 = await adminsDb.getAll(); var admin = list.find(function(a) { return a.user_id == p[0]; }); if (!admin) return; var currentPerms = (admin.permissions || 'upload,add_content').split(',').map(function(p) { return p.trim(); }); if (currentPerms.includes(p[1])) currentPerms = currentPerms.filter(function(x) { return x !== p[1]; }); else { if (p[1] === 'full') currentPerms = ['full']; else currentPerms.push(p[1]); } await adminsDb.updatePerms(p[0], currentPerms.join(',')); return showEditPerms(ctx, p[0]); break;
      case 'mg_da_': await adminsDb.remove(p.replace('mg_da_', '')); if (global.invalidateAdmin) global.invalidateAdmin(p.replace('mg_da_', '')); return showAdmins(ctx); break;
      case 'mg_profile_': return showUserProfile(ctx, data.replace('mg_profile_', ''));
      case 'mg_users_p': return showUsers(ctx, parseInt(data.replace('mg_users_p', '')));
      case 'mg_ban_': await usersDb.ban(safeInt(data.replace('mg_ban_', ''))); cacheClear('ban_' + data.replace('mg_ban_', '')); interactions.addLog(ctx.uid, 'ban', String(data.replace('mg_ban_', ''))); return showUsers(ctx); break;
      case 'mg_unban_': await usersDb.unban(safeInt(data.replace('mg_unban_', ''))); cacheClear('ban_' + data.replace('mg_unban_', '')); return showUsers(ctx); break;
      case 'mg_restore_fl_': await filesDb.restore(data.replace('mg_restore_fl_', '')); return showTrash(ctx); break;
      case 'mg_empty_trash': return eos(ctx, '⚠️ حذف الكل نهائياً؟', build([[btn('✅ تأكيد', 'mg_confirm_empty')], [btn('❌ إلغاء', 'mg_trash')]]));
      case 'mg_confirm_empty': await dbRun('DELETE FROM files WHERE is_deleted=1'); return eos(ctx, '✅ تم حذف السلة!', { parse_mode: 'Markdown', ...build([back('mg_menu')]) }); break;
      case 'mg_cdl_fl_': var p = data.replace('mg_cdl_fl_', '').split('_'); await filesDb.softDelete(p[5]); return showMgFiles(ctx, p[0], p[1], p[2], p[3], p[4]); break;
      case 'mg_fls_pg_': var p = data.replace('mg_fls_pg_', '').split('_'); return showMgFiles(ctx, p[0], p[1], p[2], p[3], p[4], safeInt(p[5])); break;
      case 'mg_add_bundle_': if (!ctx.isOwner) return ctx.answerCbQuery('🚫 للمالك فقط', { show_alert: true }).catch(function(){}); var p = data.replace('mg_add_bundle_', '').split('_'); setState(uid, { type: 'mg_bundle_title', spId: p[0], yrId: p[1], smId: p[2], sbId: p[3], catId: p[4] }); return ctx.reply('📦 اسم الحزمة:'); break;
      case 'mg_add_bundle_files_': var p2 = data.replace('mg_add_bundle_files_', '').split('_'); setState(uid, Object.assign({}, global.userStates[uid] || {}, { type: 'mg_bundle_files', bundleId: p2[0], fileCount: 0 })); ctx.reply('➕ أبعث ملفات للحزمة. /done للانتهاء'); break;
      case 'mg_dl_bundle_': var p3 = data.replace('mg_dl_bundle_', '').split('_'); await bundlesDb.deleteBundle(p3[0]); await ctx.answerCbQuery('✅ تم الحذف').catch(function(){}); return browse.showFiles(ctx, p3[2], p3[3], p3[4], p3[5]); break;
      case 'mg_rn_bundle_': var p4 = data.replace('mg_rn_bundle_', '').split('_'); await bundlesDb.renameBundle(p4[0], p4[1]); await global.delState(ctx.uid); ctx.reply('✅ تم التعديل', build([back('mg_fls_' + p4[2] + '_' + p4[3] + '_' + p4[4] + '_' + p4[5])])) ; break;
      case 'mg_upl_': var p5 = data.replace('mg_upl_', '').split('_'); if (!ctx.isOwner) { var pr = ctx.isOwner ? ['full'] : await adminsDb.getPerms(ctx.uid); if (!pr.includes('full') && !pr.includes('upload')) return ctx.answerCbQuery('ليس لديك صلاحية', { show_alert: true }); } setState(uid, { type: 'mg_upl_title', spId: p5[0], yrId: p5[1], smId: p5[2], sbId: p5[3], catId: p5[4] }); return ctx.reply('✏️ عنوان الملف:'); break;
      case 'mg_upl_bulk_': var p6 = data.replace('mg_upl_bulk_', '').split('_'); if (!ctx.isOwner) { var pr2 = ctx.isOwner ? ['full'] : await adminsDb.getPerms(ctx.uid); if (!pr2.includes('full') && !pr2.includes('upload')) return ctx.answerCbQuery('ليس لديك صلاحية', { show_alert: true }); } setState(uid, { type: 'mg_bulk_prefix', spId: p6[0], yrId: p6[1], smId: p6[2], sbId: p6[3], catId: p6[4] }); return ctx.reply('رفع متعدد — بادئة للأسماء (أو skip):'); break;
      case 'mg_bulk_files': return handleBulkUpload(ctx);
      case 'mg_tpl_': var p7 = data.replace('mg_tpl_', '').split('_'); return ctx.editMessageText('📝 *' + escMd((await messagesDb.getTemplate(p7)).name) + '\nالنوع: ' + ((await messagesDb.getTemplate(p7) || {}).type || 'text') + '\n\n' + escMd(((await messagesDb.getTemplate(p7) || {}).content || '').substring(0, 200)), { parse_mode: 'Markdown', ...build([[btn('📤 إرسال الآن', 'mg_send_now_' + p7)],[btn('👥 كل المستخدمين', 'mg_sched_all_' + p7),btn('🎓 تخصص معين', 'mg_sched_sp_' + p7)],[btn('💾 حفظ فقط', 'mg_templates')]])}); break;
      case 'mg_sched_all_': var p8 = data.replace('mg_sched_all_', '').split('_'); return eos(ctx, '📅 من تريد الإرسال؟', { ...build([[btn('👥 كل المستخدمين', 'mg_sched_all_' + p8), btn('🎓 تخصص معين', 'mg_sched_sp_' + p8)]])}); break;
      case 'mg_sched_sp_': var p9 = data.replace('mg_sched_sp_', '').split('_'); return eos(ctx, 'اختر التخصص:', { ...build(specs.map(function(s) { return [btn('🎓 ' + s.name, 'mg_sched_spid_' + p9 + '_' + s.id)]; }))}); break;
      case 'mg_sched_time_': var p10 = data.replace('mg_sched_time_', '').split('_'); setState(uid, { type: 'mg_sched_time', tplId: p10[0], target: 'all', spId: p10[1] }); return ctx.reply('📅 وقت الإرسال\nمثال: 2026-04-10 20:00'); break;
      case 'mg_send_now_': var p11 = data.replace('mg_send_now_', '').split('_'); var tpl = await messagesDb.getTemplate(p11); if (!tpl) return ctx.reply('❌ غير موجود'); var ids = await usersDb.allIds(); var sent = 0, failed = 0; var total = ids.length; var sm = await ctx.reply('📤 *جاري...*\n`[░░░░░░░░░░] 0%\n✅ 0 | ❌ 0 | ⏳ ' + total); for (var ii = 0; ii < total; ii += 30) { var r = await Promise.allSettled(ids.slice(ii, ii + 30).map(function(id) { var o = { parse_mode: 'Markdown' }; if (tpl.type === 'text') return ctx.telegram.sendMessage(id, tpl.content, o).then(function() { return true; }).catch(function() { return false; }); if (tpl.type === 'photo') return ctx.telegram.sendPhoto(id, tpl.file_id, { caption: tpl.content, ...o }).then(function() { return true; }).catch(function() { return false; }); if (tpl.type === 'document') return ctx.telegram.sendDocument(id, tpl.file_id, { caption: tpl.content, ...o }).then(function() { return true; }).catch(function() { return false; }); if (tpl.type === 'link') return ctx.telegram.sendMessage(id, tpl.content).then(function() { return true; }).catch(function() { return false; }); return Promise.resolve(false); })); } var p12 = Math.round((sent + failed) / total * 100); var b = '█'.repeat(Math.round(p12 / 10)) + '░'.repeat(10 - Math.round(p12 / 10)); ctx.telegram.editMessageText(ctx.chat.id, sm.message_id, null, '✅ *اكتمل!*\n`[' + b + '] 100%\n✅ ' + sent + ' | ❌ ' + failed, { parse_mode: 'Markdown', ...build([back('mg_templates')]) }).catch(function(){}); break;
      case 'mg_del_sched_': await messagesDb.deleteScheduled(data.replace('mg_del_sched_', '')); return showScheduled(ctx); break;
      case 'mg_reports': var rpts = await all("SELECT r.*,f.title as ft,u.first_name as fn,u.username as un FROM reports r LEFT JOIN files f ON r.file_id=f.id LEFT JOIN users u ON r.user_id=u.id WHERE r.status='pending' ORDER BY r.created_at DESC LIMIT 20");
      var txt = '🚩 *البلاغات (' + rpts.length + ')*\n\n';
      if (!rpts.length) txt += 'لا بلاغات.';
      else rpts.forEach(function(r) { txt += (r.fn || 'ID:' + r.file_id) + ' | ' + (r.reason || '?') + '\n'; });
      var rrows = rpts.map(function(r) { return [btn('حذف', 'mg_cdl_fl_0_0_0_0_0'), btn('تجاهل', 'mg_dismiss_report_' + r.id)]; });
      rrows.push(back('mg_menu')); return eos(ctx, txt, { parse_mode: 'Markdown', ...build(rrows) }); break;
      case 'mg_maint_msg': setState(uid, { type: 'mg_maint_msg' }); ctx.reply('📝 رسالة الصيانة:'); break;
      default: break;
    }
    await ctx.answerCbQuery('').catch(function(){});
  } catch(e) { await global.delState(ctx.uid); ctx.reply('❌ ' + (e.message === 'exists' ? 'موجود!' : '❌ فشل: ' + e.message)).catch(function(){});
  }
}


async function handleCallback(ctx, data) { try { await ctx.answerCbQuery().catch(function(){}); } catch(e) {} }

module.exports = { mainMenu, handleCallback, handleText, handleFileUpload, handleBulkUpload, showUserProfile, showUsers, handleBundleFileUpload };
