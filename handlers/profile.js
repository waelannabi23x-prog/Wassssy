'use strict';
/**
 * handlers/profile.js
 */

const usersDb      = require('../database/users');
const content      = require('../database/content');
const interactions = require('../database/interactions');
const { getPoints, getLeaderboard, getUserRank } = require('../database/points');
const { get }      = require('../database/db');
const { build, btn, back } = require('../utils/keyboard');
const { eos, escMd, formatDate } = require('../utils/helpers');
const { cacheGet, cacheSet } = require('../utils/cache');

const LEVELS = [
  { min: 0,     max: 499,   label: 'مبتدئ',      emoji: '🌱', bar_fill: '░' },
  { min: 500,   max: 1999,  label: 'نشيط',       emoji: '⚡', bar_fill: '▒' },
  { min: 2000,  max: 4999,  label: 'متقدم',      emoji: '🔥', bar_fill: '▓' },
  { min: 5000,  max: 9999,  label: 'محترف',      emoji: '💎', bar_fill: '█' },
  { min: 10000, max: 19999, label: 'نخبة',       emoji: '🌌', bar_fill: '█' },
  { min: 20000, max: 49999, label: 'أسطوري',     emoji: '👑', bar_fill: '█' },
  { min: 50000, max: Infinity, label: 'أسطوري XL', emoji: '🏆', bar_fill: '█' },
];

const AURA = [
  '',
  '· · ·',
  '~ ~ ~  🔥  ~ ~ ~',
  '✦ ✧ ✦ ✧ ✦',
  '★彡  𝓖𝓪𝓵𝓪𝔁𝔂  彡★',
  '꧁ 👑 ꧂',
  '⊱ ━━ ✦ 🏆 ✦ ━━ ⊰',
];

function getLevel(xp) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].min) return { ...LEVELS[i], index: i };
  }
  return { ...LEVELS[0], index: 0 };
}

function xpBar(xp, lvl) {
  if (lvl.index === LEVELS.length - 1) return '`[██████████] MAX`';
  const progress = xp - lvl.min;
  const total    = lvl.max - lvl.min + 1;
  const pct      = Math.min(Math.round((progress / total) * 10), 10);
  const filled   = lvl.bar_fill.repeat(pct);
  const empty    = '░'.repeat(10 - pct);
  const percent  = Math.round((progress / total) * 100);
  return '`[' + filled + empty + '] ' + percent + '%`';
}

function rankMedal(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '#' + rank;
}

function streakBadge(days) {
  if (!days || days < 2) return '';
  if (days >= 30) return ' 📅×' + days;
  if (days >= 7)  return ' 🔥×' + days;
  return ' ×' + days;
}

function isOwner(uid) {
  return String(uid) === String(process.env.OWNER_ID || '');
}

async function buildOwnerProfile(ctx, uid) {
  const [user, pts, rank, dlCount, favCount, spRow,
         totalUsers, totalFiles] = await Promise.all([
    usersDb.getById(uid),
    getPoints(uid).catch(() => null),
    getUserRank(uid).catch(() => null),
    interactions.getUserDownloadCount(uid),
    get('SELECT COUNT(*) as c FROM favorites WHERE user_id=$1', [uid]).then(r => r ? parseInt(r.c) : 0),
    usersDb.getSpecialty(uid),
    usersDb.count(),
    require('../database/files').totalFiles().catch(() => '—'),
  ]);

  const sp = spRow?.specialty_id ? await content.getSpec(spRow.specialty_id) : null;
  const xp = pts ? parseInt(pts.total_points) || 0 : 0;

  let text = '';
  text += '⊱ ━━ ✦ 👑 ✦ ━━ ⊰\n';
  text += '*مالك المنصة*\n';
  text += '⊱ ━━━━━━━━━━━━━ ⊰\n\n';
  text += '🆔 ID: `' + uid + '`\n';
  text += '👋 ' + escMd(user?.first_name || 'المالك') + '\n';
  if (user?.username) text += '📛 @' + escMd(user.username) + '\n';
  text += '\n━━━━━━━━━━━━━━━━\n';
  text += '✨ *إحصائيات المنصة*\n';
  text += '👥 المستخدمون: *' + totalUsers + '*\n';
  text += '📁 الملفات: *' + totalFiles + '*\n';
  text += '━━━━━━━━━━━━━━━━\n\n';
  text += '🏅 *نشاطي الشخصي*\n';
  text += '⬇️ تحميلاتي: *' + dlCount + '*\n';
  text += '⭐ مفضلتي: *' + favCount + '*\n';
  text += '🎓 تخصصي: *' + (sp ? escMd(sp.name) : 'غير محدد') + '*\n';
  text += '📅 انضم: ' + (user?.joined_at ? formatDate(user.joined_at) : '—') + '\n\n';
  text += '━━━━━━━━━━━━━━━━\n';
  text += '🎖 *نقاطي*: ' + xp + ' XP | المركز: ' + (rank ? rankMedal(rank) : '—') + '\n';
  text += '`[⬡⬡⬡⬡⬡⬡⬡⬡⬡⬡] OWNER ∞`\n';
  text += '━━━━━━━━━━━━━━━━';

  const rows = [
    [btn('🏆 المتصدرون', 'leaderboard'), btn('📊 تقدمي', 'progress')],
    back('main_menu'),
  ];
  return eos(ctx, text, { parse_mode: 'Markdown', ...build(rows) });
}

async function showProfile(ctx) {
  const uid = ctx.uid;
  if (isOwner(uid)) return buildOwnerProfile(ctx, uid);

  const [user, pts, rank, dlCount, favCount, spRow, lastFile] = await Promise.all([
    usersDb.getById(uid),
    getPoints(uid).catch(() => null),
    getUserRank(uid).catch(() => null),
    interactions.getUserDownloadCount(uid),
    get('SELECT COUNT(*) as c FROM favorites WHERE user_id=$1', [uid]).then(r => r ? parseInt(r.c) : 0),
    usersDb.getSpecialty(uid),
    interactions.getLastFile(uid).catch(() => null),
  ]);

  const sp  = spRow?.specialty_id ? await content.getSpec(spRow.specialty_id) : null;
  const xp  = pts ? parseInt(pts.total_points) || 0 : 0;
  const lvl = getLevel(xp);
  const aura = AURA[lvl.index];

  let text = '';
  if (aura) text += aura + '\n';
  text += lvl.emoji + ' *' + lvl.label + '*\n';
  if (aura) text += aura + '\n';
  text += '\n';
  text += '🆔 ID: `' + uid + '`\n';
  text += '👋 ' + escMd(user?.first_name || 'غير معروف');
  if (pts?.streak_days > 1) text += streakBadge(parseInt(pts.streak_days));
  text += '\n';
  if (user?.username) text += '📛 @' + escMd(user.username) + '\n';
  text += '📅 انضم: ' + (user?.joined_at ? formatDate(user.joined_at) : '—') + '\n';
  text += '🎓 التخصص: *' + (sp ? escMd(sp.name) : 'غير محدد') + '*\n\n';
  text += '━━━━━━━━━━━━━━━━\n';
  text += '✨ *XP:* ' + xp;
  if (lvl.index < LEVELS.length - 1) {
    text += ' / ' + LEVELS[lvl.index + 1].min + ' للمستوى التالي';
  }
  text += '\n';
  text += xpBar(xp, lvl) + '\n';
  text += '🏅 المركز: *' + (rank ? rankMedal(rank) : '—') + '*\n';
  text += '━━━━━━━━━━━━━━━━\n\n';
  text += '📊 *النشاط:*\n';
  text += '⬇️ التحميلات: *' + dlCount + '*\n';
  if (pts) text += '💬 التعليقات: *' + (pts.comments_count || 0) + '*\n';
  text += '⭐ المفضلة: *' + favCount + '*\n';
  if (lastFile) text += '📄 آخر ملف: *' + escMd(lastFile.title) + '*\n';
  if (lvl.index < LEVELS.length - 1) {
    const needed = LEVELS[lvl.index + 1].min - xp;
    text += '\n💡 تحتاج *' + needed + ' XP* للوصول إلى ' + LEVELS[lvl.index + 1].emoji + ' ' + LEVELS[lvl.index + 1].label;
  }

  const rows = [
    [btn('🏆 المتصدرون', 'leaderboard'), btn('📊 تقدمي', 'progress')],
    [btn('🎯 موصى به', 'recommended'), btn('⭐ مفضلتي', 'favs')],
    back('main_menu'),
  ];
  return eos(ctx, text, { parse_mode: 'Markdown', ...build(rows) });
}

async function showLeaderboard(ctx) {
  const k = 'leaderboard_msg_v2';
  const cached = cacheGet(k);
  if (cached) return eos(ctx, cached, { parse_mode: 'Markdown', ...build([back('my_profile')]) });

  const rows = await getLeaderboard(10);
  if (!rows || !rows.length) {
    return eos(ctx, '🏆 *المتصدرون*\n\nلا توجد بيانات بعد.', { parse_mode: 'Markdown', ...build([back('my_profile')]) });
  }

  let text = '🏆 *أفضل 10 مستخدمين*\n━━━━━━━━━━━━━━━━\n\n';
  rows.forEach((r, i) => {
    const xp    = parseInt(r.total_points) || 0;
    const lvl   = getLevel(xp);
    const medal = rankMedal(i + 1);
    const name  = escMd(r.first_name || ('مستخدم ' + r.user_id));
    const owner = isOwner(r.user_id) ? ' 👑' : '';
    text += medal + ' ' + lvl.emoji + ' *' + name + '*' + owner + '\n';
    text += '   ' + xp + ' XP — ' + lvl.label + '\n\n';
  });
  text += '━━━━━━━━━━━━━━━━';

  cacheSet(k, text, 300000);
  return eos(ctx, text, { parse_mode: 'Markdown', ...build([back('my_profile')]) });
}

const { awardPoints } = require('../database/points');
async function awardXP(uid, type) {
  return awardPoints(uid, type).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
}

module.exports = { showProfile, showLeaderboard, awardXP };
