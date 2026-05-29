'use strict';
const { run, get, all } = require('./db');
const { cacheGet, cacheSet, cacheClear } = require('../utils/cache');

/* ─── LEVELS definition (shared with frontend) ─────────── */
const LEVELS = [
  { lv:1,  min:0,      max:99,     n:'مبتدئ',      i:'🌱', c:'lv1',  anim:'none'     },
  { lv:2,  min:100,    max:299,    n:'طالب',        i:'📖', c:'lv2',  anim:'none'     },
  { lv:3,  min:300,    max:599,    n:'متعلم',       i:'🎓', c:'lv3',  anim:'pulse'    },
  { lv:4,  min:600,    max:1199,   n:'متقدم',       i:'🔬', c:'lv4',  anim:'glow'     },
  { lv:5,  min:1200,   max:2499,   n:'نشيط',        i:'⚡', c:'lv5',  anim:'glow'     },
  { lv:6,  min:2500,   max:4999,   n:'محترف',       i:'💎', c:'lv6',  anim:'shimmer'  },
  { lv:7,  min:5000,   max:9999,   n:'خبير',        i:'🚀', c:'lv7',  anim:'particles'},
  { lv:8,  min:10000,  max:19999,  n:'نخبة',        i:'🌌', c:'lv8',  anim:'galaxy'   },
  { lv:9,  min:20000,  max:49999,  n:'أسطوري',      i:'👑', c:'lv9',  anim:'aura'     },
  { lv:10, min:50000,  max:Infinity,n:'أسطوري XL',  i:'🏆', c:'lv10', anim:'cinematic'},
];

function getLevel(xp) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].min) return { idx: i, ...LEVELS[i] };
  }
  return { idx: 0, ...LEVELS[0] };
}

function getProgress(xp) {
  const lv = getLevel(xp);
  if (lv.lv === 10) return { current: xp, needed: xp, pct: 100, next: null };
  const next = LEVELS[lv.idx + 1];
  const current = xp - lv.min;
  const needed   = next.min - lv.min;
  const pct = Math.round((current / needed) * 100);
  return { current: xp, needed: next.min, pct, next };
}

/* ─── DB helpers ─────────────────────────────────────────── */
async function ensureUser(uid) {
  await run(
    'INSERT INTO user_xp(user_id,xp,level) VALUES($1,0,1) ON CONFLICT(user_id) DO NOTHING',
    [uid]
  ).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
}

async function initTable() {
  await run(`CREATE TABLE IF NOT EXISTS user_xp (
    user_id   BIGINT PRIMARY KEY,
    xp        INTEGER DEFAULT 0,
    level     INTEGER DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
}

let _ready = false;
async function ready() {
  if (_ready) return;
  await initTable();
  _ready = true;
}

/* ─── Award XP ──────────────────────────────────────────── */
const XP_REWARDS = {
  upload:         50,
  download_own:    5,   // passive — someone downloaded your file
  download:        3,   // you downloaded a file
  comment:         8,
  rating:          4,
  favorite:        2,
  daily_login:    20,
  first_file_sp: 150,   // first file in a specialty
  top1_weekly:   300,
  top3_weekly:   150,
  top10_weekly:   75,
  profile_complete: 80,
};

/**
 * Award XP to a user.
 * Returns { xp, level, leveled_up, old_level, new_level } or null
 */
async function addXp(uid, reason, override_amount) {
  if (!uid) return null;
  await ready();
  await ensureUser(uid);

  const amount = override_amount ?? XP_REWARDS[reason] ?? 0;
  if (amount <= 0) return null;

  // get current
  const row = await get('SELECT xp, level FROM user_xp WHERE user_id=$1', [uid]);
  const oldXp    = row?.xp    ?? 0;
  const oldLevel = row?.level ?? 1;
  const newXp    = oldXp + amount;
  const newLevelObj = getLevel(newXp);
  const newLevel = newLevelObj.lv;
  const leveled_up = newLevel > oldLevel;

  await run(
    'UPDATE user_xp SET xp=$1, level=$2, updated_at=CURRENT_TIMESTAMP WHERE user_id=$3',
    [newXp, newLevel, uid]
  );

  cacheClear('xp_' + uid);
  if (leveled_up) cacheClear('xp_lb');

  return {
    xp: newXp,
    amount,
    level: newLevel,
    leveled_up,
    old_level: oldLevel,
    new_level: newLevel,
    level_info: newLevelObj,
  };
}

/* ─── Get user XP data ───────────────────────────────────── */
async function getXp(uid) {
  await ready();
  const k = 'xp_' + uid;
  const cv = cacheGet(k);
  if (cv) return cv;

  await ensureUser(uid);
  const row = await get('SELECT xp, level FROM user_xp WHERE user_id=$1', [uid]);
  const xp  = row?.xp ?? 0;
  const lv  = getLevel(xp);
  const pg  = getProgress(xp);

  const result = { xp, level: lv.lv, level_info: lv, progress: pg };
  cacheSet(k, result, 120000);
  return result;
}

/* ─── Leaderboard ────────────────────────────────────────── */
async function getLeaderboard(limit = 20) {
  await ready();
  const k = 'xp_lb';
  const cv = cacheGet(k);
  if (cv) return cv;

  const rows = await all(
    `SELECT ux.user_id, ux.xp, ux.level, u.first_name, u.last_name, u.username
     FROM user_xp ux
     JOIN users u ON u.id = ux.user_id
     WHERE ux.xp > 0
     ORDER BY ux.xp DESC
     LIMIT $1`,
    [limit]
  ).catch(() => []);

  cacheSet(k, rows, 300000);
  return rows;
}

/* ─── Rank ───────────────────────────────────────────────── */
async function getRank(uid) {
  await ready();
  const row = await get('SELECT xp FROM user_xp WHERE user_id=$1', [uid]).catch(() => null);
  const xp  = row?.xp ?? 0;
  const r   = await get('SELECT COUNT(*)+1 AS rank FROM user_xp WHERE xp > $1', [xp]).catch(() => ({ rank: 999 }));
  return parseInt(r?.rank ?? 999);
}

module.exports = {
  LEVELS,
  XP_REWARDS,
  getLevel,
  getProgress,
  addXp,
  getXp,
  getLeaderboard,
  getRank,
  initTable,
};
