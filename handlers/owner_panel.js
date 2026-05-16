'use strict';
const { build, btn } = require('../utils/keyboard');
const { eos, escMd } = require('../utils/helpers');
const { all, run, getSetting, setSetting } = require('../database/db');
const { cacheGet, cacheSet, cacheStats } = require('../utils/cache');
const logger = require('../utils/logger');

async function showOwnerPanel(ctx) {
  if (!ctx.isOwner) return ctx.answerCbQuery('🚫', { show_alert: true }).catch(() => {});

  // إحصائيات سريعة
  const key = 'owner_stats';
  let stats = cacheGet(key);
  if (!stats) {
    const [users, files, downloads, banned, admins, groups] = await Promise.all([
      all('SELECT COUNT(*) as c FROM users').then(r => r[0]?.c || 0),
      all('SELECT COUNT(*) as c FROM files WHERE is_deleted=0').then(r => r[0]?.c || 0),
      all('SELECT COALESCE(SUM(downloads),0) as c FROM files').then(r => r[0]?.c || 0),
      all('SELECT COUNT(*) as c FROM users WHERE is_banned=1').then(r => r[0]?.c || 0),
      all('SELECT COUNT(*) as c FROM admins').then(r => r[0]?.c || 0),
      all('SELECT COUNT(*) as c FROM group_chats').then(r => r[0]?.c || 0),
    ]);
    stats = { users, files, downloads, banned, admins, groups };
    cacheSet(key, stats, 120000); // 2 دقيقة
  }

  const cache = cacheStats();
  const mem   = process.memoryUsage();
  const heapMB = Math.round(mem.heapUsed / 1048576);
  const maint  = global.maintenanceMode;

  const text =
    '👑 *لوحة المالك*\n' +
    '━━━━━━━━━━━━━━━━\n\n' +
    '👥 المستخدمون: *' + stats.users + '* | 🚫 محظور: *' + stats.banned + '*\n' +
    '📁 الملفات: *' + stats.files + '* | ⬇️ تحميل: *' + stats.downloads + '*\n' +
    '🛡️ المشرفون: *' + stats.admins + '* | 💬 القروبات: *' + stats.groups + '*\n' +
    '━━━━━━━━━━━━━━━━\n' +
    '🧠 RAM: *' + heapMB + 'MB* | 💾 Cache: *' + cache.size + '/' + cache.max + '*\n' +
    '🔧 الصيانة: ' + (maint ? '🔴 مفعّلة' : '🟢 متوقفة');

  const rows = [
    // ── محتوى ──
    [btn('📂 إدارة المحتوى', 'mg_content'), btn('📦 الحزم', 'bundle_list')],

    // ── مستخدمون ──
    [btn('👥 المستخدمون', 'mg_users'), btn('🛡️ المشرفون', 'mg_admins')],

    // ── بث ──
    [btn('📢 بث للكل', 'mg_broadcast'), btn('🎓 بث لتخصص', 'mg_notify_sp')],

    // ── إشعارات ──
    [btn('🔔 إشعار مستخدمين', 'mg_notify'), btn('📣 إشعار قروبات', 'mg_notify_groups')],

    // ── إحصائيات ──
    [btn('📊 الإحصائيات', 'mg_analytics'), btn('📜 السجلات', 'mg_logs')],

    // ── نظام ──
    [btn('💾 نسخ احتياطي', 'mg_backup'), btn('♻️ استعادة', 'mg_restore')],
    [btn('🗑️ سلة المحذوفات', 'mg_trash'), btn('🚩 البلاغات', 'mg_reports')],
    [btn('📨 نظام الرسائل', 'mg_msgs'), btn('🎮 ألعاب القروب', 'mb_panel')],

    // ── صيانة ──
    [btn(maint ? '🟢 إيقاف الصيانة' : '🔴 وضع الصيانة', 'mg_maint')],

    // ── أدوات سريعة ──
    [btn('🔄 مسح الكاش', 'owner_clear_cache'), btn('📈 حالة السيرفر', 'owner_server_stats')],

    // ── رجوع ──
    [btn('🏠 القائمة الرئيسية', 'main_menu')],
  ];

  return eos(ctx, text, { parse_mode: 'Markdown', ...build(rows) });
}

async function showServerStats(ctx) {
  if (!ctx.isOwner) return ctx.answerCbQuery('🚫', { show_alert: true }).catch(() => {});

  const mem    = process.memoryUsage();
  const uptime = Math.floor(process.uptime());
  const h      = Math.floor(uptime / 3600);
  const m      = Math.floor((uptime % 3600) / 60);
  const s      = uptime % 60;
  const cache  = cacheStats();

  const text =
    '📈 *حالة السيرفر*\n' +
    '━━━━━━━━━━━━━━━━\n\n' +
    '⏱️ Uptime: *' + h + 'h ' + m + 'm ' + s + 's*\n' +
    '🧠 Heap: *' + Math.round(mem.heapUsed / 1048576) + 'MB / ' + Math.round(mem.heapTotal / 1048576) + 'MB*\n' +
    '💾 RSS: *' + Math.round(mem.rss / 1048576) + 'MB*\n' +
    '📦 Cache: *' + cache.size + '/' + cache.max + ' مفتاح*\n' +
    '🌐 Node: *' + process.version + '*\n' +
    '🚂 Railway: *' + (process.env.RAILWAY_REGION || 'local') + '*';

  return eos(ctx, text, {
    parse_mode: 'Markdown',
    ...build([[btn('🔄 تحديث', 'owner_server_stats'), btn('◀️ رجوع', 'owner_panel')]]),
  });
}

async function clearCache(ctx) {
  if (!ctx.isOwner) return ctx.answerCbQuery('🚫', { show_alert: true }).catch(() => {});
  const { cachePurgeExpired } = require('../utils/cache');
  cachePurgeExpired();
  if (global.gc) global.gc();
  const mem = Math.round(process.memoryUsage().heapUsed / 1048576);
  await ctx.answerCbQuery('✅ تم مسح الكاش المنتهي — RAM: ' + mem + 'MB', { show_alert: true }).catch(() => {});
  return showOwnerPanel(ctx);
}

module.exports = { showOwnerPanel, showServerStats, clearCache };
