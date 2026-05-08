'use strict';
const express = require('express');
const router = express.Router();
const { verifyWebApp } = require('../utils/webapp_auth');
const content = require('../database/content');
const filesDb = require('../database/files');
const interactions = require('../database/interactions');
const usersDb = require('../database/users');
const { smartSearch } = require('../handlers/group');
const { cacheGet, cacheSet } = require('../utils/cache');
const { all, get, run } = require('../database/db');

// ─── Auth middleware ────────────────────────────────
function auth(req, res, next) {
  const initData = req.headers['x-init-data'] || req.query.initData || '';
  const user = verifyWebApp(initData);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.tgUser = user;
  next();
}

// ─── Endpoints ──────────────────────────────────────
router.get('/specialties', auth, async (req, res) => {
  const specs = await content.getSpecs();
  res.json(specs);
});

router.get('/years/:spId', auth, async (req, res) => {
  const data = await content.getYears(req.params.spId);
  res.json(data);
});

router.get('/semesters/:yrId', auth, async (req, res) => {
  res.json(await content.getSemesters(req.params.yrId));
});

router.get('/subjects/:smId', auth, async (req, res) => {
  res.json(await content.getSubjects(req.params.smId));
});

router.get('/categories/:sbId', auth, async (req, res) => {
  res.json(await content.getCategories(req.params.sbId));
});

router.get('/files/:catId', auth, async (req, res) => {
  res.json(await filesDb.getFiles(req.params.catId));
});

router.get('/file/:id', auth, async (req, res) => {
  const f = await filesDb.getFile(req.params.id);
  if (!f) return res.status(404).json({ error: 'Not found' });
  const [rating, fav, comments] = await Promise.all([
    interactions.getAvgRating(req.params.id),
    interactions.isFav(req.tgUser.id, req.params.id),
    get('SELECT COUNT(*) as c FROM comments WHERE file_id=$1 AND is_deleted=0', [req.params.id]).then(r => r?.c || 0),
  ]);
  res.json({ ...f, rating, fav, comments });
});

router.get('/search', auth, async (req, res) => {
  const q = (req.query.q || '').slice(0, 80);
  if (q.length < 2) return res.json([]);
  const key = 'api_search_' + q.toLowerCase();
  let cached = cacheGet(key);
  if (!cached) { cached = await smartSearch(q, 20); cacheSet(key, cached, 300000); }
  res.json(cached);
});

router.get('/profile', auth, async (req, res) => {
  const uid = req.tgUser.id;
  const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
  const isOwner = parseInt(uid) === OWNER_ID;
  const adm = await get('SELECT permissions FROM admins WHERE user_id=$1', [uid]);
  const [dlCount, favCount, cmtCount, ratingCount, spRow] = await Promise.all([
    interactions.getUserDownloadCount(uid),
    get('SELECT COUNT(*) as c FROM favorites WHERE user_id=$1', [uid]).then(r => r?.c || 0),
    get('SELECT COUNT(*) as c FROM comments WHERE user_id=$1 AND is_deleted=0', [uid]).then(r => r?.c || 0),
    get('SELECT COUNT(*) as c FROM ratings WHERE user_id=$1', [uid]).then(r => r?.c || 0),
    usersDb.getSpecialty(uid),
  ]);
  const sp = spRow?.specialty_id ? await content.getSpec(spRow.specialty_id) : null;
  res.json({ user: req.tgUser, dlCount, favCount, cmtCount, ratingCount, specialty: sp, isAdmin: isOwner || !!adm, isOwner });
});

router.get('/latest', auth, async (req, res) => {
  res.json(await filesDb.recentFiles(20));
});

router.post('/fav/:id', auth, async (req, res) => {
  const uid = req.tgUser.id, fid = req.params.id;
  const isFav = await interactions.isFav(uid, fid);
  if (isFav) await interactions.removeFav(uid, fid);
  else await interactions.addFav(uid, fid);
  res.json({ fav: !isFav });
});

// إرسال الملف للمستخدم عبر البوت
router.post('/send/:id', auth, async (req, res) => {
  const uid = req.tgUser.id;
  const f = await filesDb.getFile(req.params.id);
  if (!f) return res.status(404).json({ error: 'Not found' });
  try {
    const bot = global.__bot;
    const cap = `📄 *${f.title}*\n📁 ${f.cat_name} | 📖 ${f.sub_name}`;
    if (f.file_type === 'link') await bot.telegram.sendMessage(uid, cap + '\n\n🔗 ' + f.file_id, { parse_mode: 'Markdown' });
    else if (f.file_type === 'photo') await bot.telegram.sendPhoto(uid, f.file_id, { caption: cap, parse_mode: 'Markdown' });
    else await bot.telegram.sendDocument(uid, f.file_id, { caption: cap, parse_mode: 'Markdown' });
    filesDb.incDownloads(req.params.id);
    interactions.addHistory(uid, req.params.id).catch(() => {});
    // ── XP: downloader gets XP ──
    try { require('../handlers/xp').onDownload(global.__bot, parseInt(uid)).catch(()=>{}); } catch(_) {}
    // ── XP: uploader gets passive XP ──
    try { if(f.uploaded_by && f.uploaded_by !== parseInt(uid)) require('../handlers/xp').onFileDownloaded(global.__bot, parseInt(f.uploaded_by)).catch(()=>{}); } catch(_) {}
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/favorites', auth, async (req, res) => {
  try {
    const rows = await all(`SELECT f.*, s.name as sub_name FROM favorites fv JOIN files f ON f.id=fv.file_id LEFT JOIN subjects s ON s.id=(SELECT semester_id FROM categories c JOIN subjects sb ON sb.id=c.subject_id WHERE c.id=f.category_id LIMIT 1) WHERE fv.user_id=$1 AND f.is_deleted=0 ORDER BY f.uploaded_at DESC`, [req.tgUser.id]);
    res.json(rows);
  } catch(e) { res.json([]); }
});

router.get('/comments/:id', auth, async (req, res) => {
  try {
    const rows = await all(`SELECT c.*, u.first_name FROM comments c LEFT JOIN users u ON u.id=c.user_id WHERE c.file_id=$1 AND c.is_deleted=0 ORDER BY c.created_at DESC LIMIT 50`, [req.params.id]);
    res.json(rows);
  } catch(e) { res.json([]); }
});

router.post('/comment/:id', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length < 1) return res.status(400).json({ error: 'empty' });
    await run(`INSERT INTO comments(file_id,user_id,text) VALUES($1,$2,$3)`, [req.params.id, req.tgUser.id, text.trim()]);
    try { require('../handlers/xp').onComment(global.__bot, parseInt(req.tgUser.id)).catch(()=>{}); } catch(_) {}
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/rate/:id', auth, async (req, res) => {
  try {
    const { rating } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'invalid' });
    await run(`INSERT INTO ratings(user_id,file_id,rating) VALUES($1,$2,$3) ON CONFLICT(user_id,file_id) DO UPDATE SET rating=$3`, [req.tgUser.id, req.params.id, rating]);
    const avg = await get(`SELECT AVG(rating) as avg, COUNT(*) as cnt FROM ratings WHERE file_id=$1`, [req.params.id]);
    try { require('../handlers/xp').onRating(global.__bot, parseInt(req.tgUser.id)).catch(()=>{}); } catch(_) {}
    res.json({ ok: true, avg: avg.avg, cnt: avg.cnt });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/admin/check', auth, async (req, res) => {
  const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
  const uid = parseInt(req.tgUser.id);
  const isOwner = uid === OWNER_ID;
  const adm = await get('SELECT * FROM admins WHERE user_id=$1', [uid]);
  if (!isOwner && !adm) return res.status(403).json({ error: 'forbidden' });
  res.json({ ok: true, isOwner, perms: adm?.permissions || (isOwner ? 'full' : '') });
});

router.get('/admin/stats', auth, async (req, res) => {
  const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
  const uid = parseInt(req.tgUser.id);
  const isOwner = uid === OWNER_ID;
  const adm = await get('SELECT * FROM admins WHERE user_id=$1', [uid]);
  if (!isOwner && !adm) return res.status(403).json({ error: 'forbidden' });
  try {
    const [users, files, downloads, favs, comments, specs, admins] = await Promise.all([
      get('SELECT COUNT(*) as c FROM users WHERE is_banned=0'),
      get('SELECT COUNT(*) as c FROM files WHERE is_deleted=0'),
      get('SELECT COALESCE(SUM(downloads),0) as c FROM files WHERE is_deleted=0'),
      get('SELECT COUNT(*) as c FROM favorites'),
      get('SELECT COUNT(*) as c FROM comments WHERE is_deleted=0'),
      get('SELECT COUNT(*) as c FROM specialties WHERE is_deleted=0'),
      get('SELECT COUNT(*) as c FROM admins'),
    ]);
    const recentUsers = await all('SELECT id,first_name,last_name,username,last_active,joined_at FROM users ORDER BY joined_at DESC LIMIT 10');
    const topFiles = await all('SELECT f.id,f.title,f.downloads,f.file_type FROM files f WHERE f.is_deleted=0 ORDER BY f.downloads DESC LIMIT 10');
    const bannedCount = await get('SELECT COUNT(*) as c FROM users WHERE is_banned=1');
    res.json({ users: users.c, files: files.c, downloads: downloads.c, favs: favs.c, comments: comments.c, specs: specs.c, admins: admins.c, banned: bannedCount.c, recentUsers, topFiles });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/admin/users', auth, async (req, res) => {
  const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
  const uid = parseInt(req.tgUser.id);
  const isOwner = uid === OWNER_ID;
  const adm = await get('SELECT * FROM admins WHERE user_id=$1', [uid]);
  if (!isOwner && !adm) return res.status(403).json({ error: 'forbidden' });
  const q = req.query.q || '';
  const page = parseInt(req.query.page || '0');
  const limit = 20;
  let rows;
  if (q) {
    rows = await all(`SELECT * FROM users WHERE first_name ILIKE $1 OR username ILIKE $1 OR id::text=$2 ORDER BY joined_at DESC LIMIT $3 OFFSET $4`, [`%${q}%`, q, limit, page * limit]);
  } else {
    rows = await all(`SELECT * FROM users ORDER BY joined_at DESC LIMIT $1 OFFSET $2`, [limit, page * limit]);
  }
  res.json(rows);
});

router.post('/admin/ban/:id', auth, async (req, res) => {
  const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
  const uid = parseInt(req.tgUser.id);
  const isOwner = uid === OWNER_ID;
  if (!isOwner) return res.status(403).json({ error: 'owner only' });
  const { ban } = req.body;
  await run('UPDATE users SET is_banned=$1 WHERE id=$2', [ban ? 1 : 0, req.params.id]);
  res.json({ ok: true });
});

router.get('/admin/files', auth, async (req, res) => {
  const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
  const uid = parseInt(req.tgUser.id);
  const isOwner = uid === OWNER_ID;
  const adm = await get('SELECT * FROM admins WHERE user_id=$1', [uid]);
  if (!isOwner && !adm) return res.status(403).json({ error: 'forbidden' });
  const rows = await all(`SELECT f.*,c.name as cat_name FROM files f LEFT JOIN categories c ON c.id=f.category_id WHERE f.is_deleted=0 ORDER BY f.uploaded_at DESC LIMIT 50`);
  res.json(rows);
});

router.post('/admin/delfile/:id', auth, async (req, res) => {
  const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
  const uid = parseInt(req.tgUser.id);
  const isOwner = uid === OWNER_ID;
  const adm = await get('SELECT * FROM admins WHERE user_id=$1', [uid]);
  if (!isOwner && !adm) return res.status(403).json({ error: 'forbidden' });
  await run('UPDATE files SET is_deleted=1 WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ═══ ADMIN ADVANCED ROUTES ═══

router.get('/admin/groups', auth, async (req, res) => {
  const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
  const uid = parseInt(req.tgUser.id);
  const adm = await get('SELECT * FROM admins WHERE user_id=$1', [uid]);
  if (uid !== OWNER_ID && !adm) return res.status(403).json({ error: 'forbidden' });
  try {
    const rows = await all(`SELECT gc.*, sp.name as sp_name, COUNT(gm.user_id) as members FROM group_chats gc LEFT JOIN specialties sp ON gc.specialty_id=sp.id LEFT JOIN group_members gm ON gc.chat_id=gm.chat_id GROUP BY gc.chat_id, gc.title, gc.specialty_id, gc.notify_new_files, gc.joined_at, sp.name ORDER BY members DESC`);
    res.json(rows);
  } catch(e) { res.json([]); }
});

router.post('/admin/broadcast', auth, async (req, res) => {
  const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
  const uid = parseInt(req.tgUser.id);
  if (uid !== OWNER_ID) return res.status(403).json({ error: 'owner only' });
  const { text, target, specialtyId } = req.body;
  if (!text) return res.status(400).json({ error: 'no text' });
  try {
    const usersDb = require('../database/users');
    const ids = target === 'groups'
      ? (specialtyId && specialtyId !== '0'
          ? (await all('SELECT chat_id as id FROM group_chats WHERE specialty_id=$1', [specialtyId])).map(r => r.id)
          : (await all('SELECT chat_id as id FROM group_chats')).map(r => r.id))
      : await usersDb.allIds();
    const bot = require('../index').bot || global.botInstance;
    let sent = 0, failed = 0;
    const chunks = [];
    for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
    for (const chunk of chunks) {
      await Promise.all(chunk.map(id =>
        bot.telegram.sendMessage(id, text, { parse_mode: 'Markdown' })
          .then(() => sent++)
          .catch(() => failed++)
      ));
      await new Promise(r => setTimeout(r, 500));
    }
    res.json({ ok: true, sent, failed, total: ids.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/admin/specialties', auth, async (req, res) => {
  const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
  const uid = parseInt(req.tgUser.id);
  const adm = await get('SELECT * FROM admins WHERE user_id=$1', [uid]);
  if (uid !== OWNER_ID && !adm) return res.status(403).json({ error: 'forbidden' });
  const rows = await all('SELECT * FROM specialties WHERE is_deleted=0 ORDER BY id');
  res.json(rows);
});

router.get('/admin/reports', auth, async (req, res) => {
  const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
  const uid = parseInt(req.tgUser.id);
  const adm = await get('SELECT * FROM admins WHERE user_id=$1', [uid]);
  if (uid !== OWNER_ID && !adm) return res.status(403).json({ error: 'forbidden' });
  try {
    const rows = await all(`SELECT r.*, f.title as file_title, u.first_name FROM reports r LEFT JOIN files f ON f.id=r.file_id LEFT JOIN users u ON u.id=r.user_id WHERE r.status='pending' ORDER BY r.created_at DESC LIMIT 30`);
    res.json(rows);
  } catch(e) { res.json([]); }
});

router.post('/admin/report/:id/resolve', auth, async (req, res) => {
  const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
  const uid = parseInt(req.tgUser.id);
  const adm = await get('SELECT * FROM admins WHERE user_id=$1', [uid]);
  if (uid !== OWNER_ID && !adm) return res.status(403).json({ error: 'forbidden' });
  await run('UPDATE reports SET status=$1 WHERE id=$2', [req.body.status || 'resolved', req.params.id]);
  res.json({ ok: true });
});

router.get('/admin/admins', auth, async (req, res) => {
  const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
  const uid = parseInt(req.tgUser.id);
  if (uid !== OWNER_ID) return res.status(403).json({ error: 'owner only' });
  const rows = await all(`SELECT a.*, u.first_name, u.username FROM admins a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.added_at DESC`);
  res.json(rows);
});

router.post('/admin/removeadmin/:id', auth, async (req, res) => {
  const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
  const uid = parseInt(req.tgUser.id);
  if (uid !== OWNER_ID) return res.status(403).json({ error: 'owner only' });
  await run('DELETE FROM admins WHERE user_id=$1', [req.params.id]);
  res.json({ ok: true });
});
// ══════════════════════════════════════════════════════════════════
// أضف هذا كاملاً في routes/api.js قبل سطر module.exports = router;
// ══════════════════════════════════════════════════════════════════

// ─── رفع صورة/فيديو من الجهاز مباشرة ────────────────────────────
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

router.post('/admin/upload-media', (req, res, next) => {
  // Auth manual (لأن multer يتعارض مع json middleware)
  const initData = req.headers['x-init-data'] || '';
  if (!initData) return res.status(401).json({ error: 'unauthorized' });
  next();
}, upload.single('file'), async (req, res) => {
  const OWNER_ID = parseInt(process.env.OWNER_ID || '0');

  // استخرج uid من header
  let uid = 0;
  try {
    const params = new URLSearchParams(req.headers['x-init-data']);
    const userStr = params.get('user');
    if (userStr) uid = parseInt(JSON.parse(decodeURIComponent(userStr)).id);
  } catch(_) {}

  const adm = await get('SELECT 1 FROM admins WHERE user_id=$1', [uid]).catch(() => null);
  if (uid !== OWNER_ID && !adm) return res.status(403).json({ error: 'forbidden' });

  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'no file' });

    const isVideo = file.mimetype.startsWith('video/');
    const bot = global.__bot;
    if (!bot) return res.status(500).json({ error: 'bot not ready' });

    // أرسل للبوت باش نحصل على file_id
    let result;
    if (isVideo) {
      result = await bot.telegram.sendVideo(
        parseInt(process.env.OWNER_ID),
        { source: file.buffer, filename: file.originalname || 'video.mp4' },
        { caption: '📤 رفع إعلان' }
      );
    } else {
      result = await bot.telegram.sendPhoto(
        parseInt(process.env.OWNER_ID),
        { source: file.buffer, filename: file.originalname || 'image.jpg' },
        { caption: '📤 رفع إعلان' }
      );
    }

    // استخرج file_id
    const fileId = isVideo
      ? result.video?.file_id
      : (result.photo?.[result.photo.length - 1]?.file_id);

    if (!fileId) return res.status(500).json({ error: 'no file_id returned' });

    // احصل على URL
    const fileInfo = await bot.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileInfo.file_path}`;

    res.json({
      ok: true,
      file_id: fileId,
      url: fileUrl,
      type: isVideo ? 'video' : 'image'
    });

  } catch(e) {
    console.error('[upload-media]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── إصلاح بروفايل المستخدم (للأونر/أدمن) ──────────────────────
// احذف أو استبدل الـ route القديم /admin/user/:id/profile بهذا:
router.get('/admin/user/:id/profile', auth, async (req, res) => {
  const uid = parseInt(req.tgUser.id);
  const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
  const adm = await get('SELECT 1 FROM admins WHERE user_id=$1', [uid]).catch(() => null);
  if (uid !== OWNER_ID && !adm) return res.status(403).json({ error: 'forbidden' });

  try {
    const targetId = req.params.id;

    // ── جلب المستخدم بدون specialty join ──
    const user = await get('SELECT * FROM users WHERE id=$1', [parseInt(targetId)]);
    if (!user) return res.status(404).json({ error: 'not found' });

    // ── جلب اسم التخصص بشكل منفصل ──
    let specialtyName = null;
    if (user.specialty_id) {
      const sp = await get('SELECT name FROM specialties WHERE id=$1', [user.specialty_id]).catch(() => null);
      specialtyName = sp?.name || null;
    }

    // ── إحصائيات ──
    const [pts, dlC, favC, cmtC, ratC] = await Promise.all([
      get('SELECT * FROM user_points WHERE user_id=$1', [parseInt(targetId)]).catch(() => null),
      get('SELECT COALESCE(downloads_count,0) as c FROM user_points WHERE user_id=$1', [parseInt(targetId)]).catch(() => ({ c: 0 })),
      get('SELECT COUNT(*) as c FROM favorites WHERE user_id=$1', [parseInt(targetId)]).catch(() => ({ c: 0 })),
      get('SELECT COUNT(*) as c FROM comments WHERE user_id=$1', [parseInt(targetId)]).catch(() => ({ c: 0 })),
      get('SELECT COUNT(*) as c FROM ratings WHERE user_id=$1', [parseInt(targetId)]).catch(() => ({ c: 0 })),
    ]);

    const isAdm = await get('SELECT * FROM admins WHERE user_id=$1', [parseInt(targetId)]).catch(() => null);

    res.json({
      id: user.id,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      username: user.username || null,
      is_banned: user.is_banned || false,
      joined_at: user.joined_at,
      specialty_name: specialtyName,
      total_points: pts?.total_points || 0,
      streak_days: pts?.streak_days || 0,
      downloads_count: parseInt(dlC?.c || 0),
      favs_count: parseInt(favC?.c || 0),
      comments_count: parseInt(cmtC?.c || 0),
      ratings_count: parseInt(ratC?.c || 0),
      is_admin: !!isAdm,
      permissions: isAdm?.permissions || null,
      is_owner: parseInt(targetId) === OWNER_ID,
    });
  } catch(e) {
    console.error('[profile]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── بروفايل عام (لكل مستخدم) ────────────────────────────────────
router.get('/user/:id/profile', auth, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    const user = await get('SELECT * FROM users WHERE id=$1', [targetId]);
    if (!user) return res.status(404).json({ error: 'not found' });

    let specialtyName = null;
    if (user.specialty_id) {
      const sp = await get('SELECT name FROM specialties WHERE id=$1', [user.specialty_id]).catch(() => null);
      specialtyName = sp?.name || null;
    }

    const [pts, dlC, cmtC] = await Promise.all([
      get('SELECT total_points, streak_days FROM user_points WHERE user_id=$1', [targetId]).catch(() => null),
      get('SELECT COALESCE(downloads_count,0) as c FROM user_points WHERE user_id=$1', [targetId]).catch(() => ({ c: 0 })),
      get('SELECT COUNT(*) as c FROM comments WHERE user_id=$1', [targetId]).catch(() => ({ c: 0 })),
    ]);

    const isAdm = await get('SELECT permissions FROM admins WHERE user_id=$1', [targetId]).catch(() => null);
    const OWNER_ID = parseInt(process.env.OWNER_ID || '0');

    res.json({
      id: user.id,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      username: user.username || null,
      joined_at: user.joined_at,
      specialty_name: specialtyName,
      total_points: pts?.total_points || 0,
      streak_days: pts?.streak_days || 0,
      downloads_count: parseInt(dlC?.c || 0),
      comments_count: parseInt(cmtC?.c || 0),
      is_admin: !!isAdm,
      is_owner: targetId === OWNER_ID,
      permissions: isAdm?.permissions || null,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── قائمة الأدمنز العامة ─────────────────────────────────────────
router.get('/admins/public', auth, async (req, res) => {
  try {
    const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
    const rows = await all(
      `SELECT a.user_id, a.permissions, a.added_at,
              u.first_name, u.last_name, u.username
       FROM admins a LEFT JOIN users u ON u.id = a.user_id
       ORDER BY a.added_at ASC`
    );
    const ownerUser = await get('SELECT first_name, last_name, username FROM users WHERE id=$1', [OWNER_ID]).catch(() => null);
    const result = [];
    if (ownerUser) result.push({ ...ownerUser, user_id: OWNER_ID, permissions: 'owner', is_owner: true });
    result.push(...rows.filter(r => r.user_id !== OWNER_ID));
    res.json(result);
  } catch(e) { res.json([]); }
});

// ══════════════════════════════════════════════════════════════════
// routes_missing.js — أضف هذا كاملاً في api.js قبل module.exports
// ══════════════════════════════════════════════════════════════════

// ─── ملفات حديثة حسب التخصص ──────────────────────────────────────
router.get('/latest/specialty/:spId', auth, async (req, res) => {
  try {
    const spId = parseInt(req.params.spId);
    const rows = await all(
      `SELECT f.*, c.name as cat_name, s.name as sub_name, s.id as sub_id,
              sem.name as sem_name, y.name as year_name,
              COALESCE(d.cnt,0) as downloads,
              COALESCE(r.avg,0) as rating_avg
       FROM files f
       JOIN categories c ON c.id = f.category_id
       JOIN subjects s ON s.id = c.subject_id
       JOIN semesters sem ON sem.id = s.semester_id
       JOIN years y ON y.id = sem.year_id
       -- downloads in files.downloads column
       LEFT JOIN (SELECT file_id, AVG(rating)::numeric(3,1) as avg FROM ratings GROUP BY file_id) r ON r.file_id=f.id
       WHERE y.specialty_id = $1
       ORDER BY f.created_at DESC LIMIT 8`,
      [spId]
    );
    res.json(rows);
  } catch(e) { res.json([]); }
});

// ─── تحديث بروفايل المستخدم (الاسم فقط) ─────────────────────────
router.post('/profile/update', auth, async (req, res) => {
  try {
    const uid = parseInt(req.tgUser.id);
    const { first_name, last_name } = req.body;
    if (first_name) {
      await run(
        'UPDATE users SET first_name=$1, last_name=$2 WHERE id=$3',
        [first_name.trim(), (last_name||'').trim(), uid]
      ).catch(() => {}); // silently fail if column doesn't exist
    }
    const { cacheClear } = require('../utils/cache');
    cacheClear('prof_' + uid);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── تحديث التخصص ────────────────────────────────────────────────
// (إذا لم يكن موجوداً مسبقاً)
if (!global._hasSpecialtyRoute) {
  global._hasSpecialtyRoute = true;
  router.post('/profile/specialty', auth, async (req, res) => {
    try {
      const uid = parseInt(req.tgUser.id);
      const { specialtyId } = req.body;
      await run('UPDATE users SET specialty_id=$1 WHERE id=$2', [specialtyId||null, uid]);
      const { cacheClear } = require('../utils/cache');
      cacheClear('prof_' + uid);
      res.json({ ok: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });
}

// ─── نقاط المستخدم ───────────────────────────────────────────────
router.get('/points/me', auth, async (req, res) => {
  try {
    const uid = parseInt(req.tgUser.id);
    const pts = await require('../database/points').getPoints(uid).catch(() => null);
    const rank = await require('../database/points').getUserRank(uid).catch(() => 999);
    const dlC = await get('SELECT COALESCE(downloads_count,0) as c FROM user_points WHERE user_id=$1',[uid]).catch(()=>({c:0}));
    const cmtC = await get('SELECT COUNT(*) as c FROM comments WHERE user_id=$1',[uid]).catch(()=>({c:0}));
    const ratC = await get('SELECT COUNT(*) as c FROM ratings WHERE user_id=$1',[uid]).catch(()=>({c:0}));
    res.json({
      total_points: pts?.total_points || 0,
      streak_days: pts?.streak_days || 0,
      downloads_count: parseInt(dlC?.c||0),
      comments_count: parseInt(cmtC?.c||0),
      ratings_count: parseInt(ratC?.c||0),
      rank: rank || 999,
    });
  } catch(e) { res.json({ total_points:0,downloads_count:0,comments_count:0,ratings_count:0,streak_days:0,rank:999 }); }
});

router.get('/points/rank', auth, async (req, res) => {
  try {
    const uid = parseInt(req.tgUser.id);
    const rank = await require('../database/points').getUserRank(uid).catch(() => 999);
    res.json({ rank: rank || 999 });
  } catch(e) { res.json({ rank: 999 }); }
});

router.get('/points/leaderboard', auth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit||'20'), 50);
    const lb = await require('../database/points').getLeaderboard(limit).catch(() => []);
    res.json(lb);
  } catch(e) { res.json([]); }
});

router.post('/points/daily', auth, async (req, res) => {
  try {
    const uid = parseInt(req.tgUser.id);
    const awarded = await require('../database/points').checkDailyLogin(uid).catch(() => false);
    // Also award XP for daily login
    if (awarded) {
      try { require('../handlers/xp').onDailyLogin(global.__bot, uid).catch(()=>{}); } catch(_) {}
    }
    res.json({ ok: true, awarded });
  } catch(e) { res.json({ ok: false }); }
});

// ─── سجل التحميل ─────────────────────────────────────────────────
router.get('/history', auth, async (req, res) => {
  try {
    const uid = parseInt(req.tgUser.id);
    const rows = await all(
      `SELECT f.*, c.name as cat_name, s.name as sub_name
       FROM files f
       LEFT JOIN categories c ON c.id = f.category_id
       LEFT JOIN subjects s ON s.id = c.subject_id
       WHERE f.is_deleted=0
       ORDER BY f.downloads DESC, f.uploaded_at DESC
       LIMIT 20`,
      []
    );
    res.json(rows);
  } catch(e) { res.json([]); }
});

// ─── لايك التعليق ────────────────────────────────────────────────
router.post('/comment/:id/like', auth, async (req, res) => {
  try {
    const uid = parseInt(req.tgUser.id);
    const cid = parseInt(req.params.id);
    const ex = await get('SELECT 1 FROM comment_likes WHERE user_id=$1 AND comment_id=$2',[uid,cid]).catch(()=>null);
    if (ex) {
      await run('DELETE FROM comment_likes WHERE user_id=$1 AND comment_id=$2',[uid,cid]);
      await run('UPDATE comments SET likes=GREATEST(0,COALESCE(likes,0)-1) WHERE id=$1',[cid]).catch(()=>{});
      res.json({ liked: false });
    } else {
      await run('INSERT INTO comment_likes(user_id,comment_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[uid,cid]);
      await run('UPDATE comments SET likes=COALESCE(likes,0)+1 WHERE id=$1',[cid]).catch(()=>{});
      res.json({ liked: true });
    }
  } catch(e) { res.json({ liked: false }); }
});

// ─── إضافة مشرف جديد ──────────────────────────────────────────────
router.post('/admin/addadmin', auth, async (req, res) => {
  const uid = parseInt(req.tgUser.id);
  const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
  if (uid !== OWNER_ID) return res.status(403).json({ error: 'owner only' });
  const { userId, permissions } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    await run(
      'INSERT INTO admins(user_id,added_by,permissions) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET permissions=$3',
      [parseInt(userId), uid, permissions || 'full']
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── الإعلانات العامة ────────────────────────────────────────────
router.get('/ads', auth, async (req, res) => {
  try {
    const uid = parseInt(req.tgUser.id);
    const userRow = await get('SELECT specialty_id FROM users WHERE id=$1',[uid]).catch(()=>null);
    const spId = userRow?.specialty_id || null;
    const rows = await all(
      `SELECT * FROM ads WHERE is_deleted=0
       AND (specialty_id IS NULL${spId ? ' OR specialty_id=$1' : ''})
       ORDER BY is_pinned DESC, created_at DESC LIMIT 30`,
      spId ? [spId] : []
    );
    res.json(rows);
  } catch(e) { res.json([]); }
});

// ─── القنوات ─────────────────────────────────────────────────────
router.get('/channels', auth, async (req, res) => {
  try {
    const rows = await all('SELECT * FROM channels WHERE is_deleted=0 ORDER BY sort_order ASC, id DESC');
    res.json(rows);
  } catch(e) { res.json([]); }
});

// ─── إنشاء إعلان ─────────────────────────────────────────────────
router.post('/admin/ads', auth, async (req, res) => {
  const uid = parseInt(req.tgUser.id);
  const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
  const adm = await get('SELECT 1 FROM admins WHERE user_id=$1',[uid]).catch(()=>null);
  if (uid !== OWNER_ID && !adm) return res.status(403).json({ error: 'forbidden' });
  const { title, body, icon, link, specialty_id, is_pinned, image_url, video_url } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    await run(
      `INSERT INTO ads(title,body,icon,link,specialty_id,is_pinned,created_by,image_url,video_url)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [title, body||null, icon||'📌', link||null, specialty_id||null, is_pinned?1:0, uid, image_url||null, video_url||null]
    );
    res.json({ ok: true });
  } catch(e) {
    // fallback بدون video_url إذا العمود غير موجود
    try {
      await run(
        `INSERT INTO ads(title,body,icon,link,specialty_id,is_pinned,created_by,image_url)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [title, body||null, icon||'📌', link||null, specialty_id||null, is_pinned?1:0, uid, image_url||video_url||null]
      );
      res.json({ ok: true });
    } catch(e2) { res.status(500).json({ error: e2.message }); }
  }
});

router.post('/admin/ads/:id/delete', auth, async (req, res) => {
  const uid = parseInt(req.tgUser.id);
  const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
  const adm = await get('SELECT 1 FROM admins WHERE user_id=$1',[uid]).catch(()=>null);
  if (uid !== OWNER_ID && !adm) return res.status(403).json({ error: 'forbidden' });
  try { await run('UPDATE ads SET is_deleted=1 WHERE id=$1',[req.params.id]); res.json({ ok:true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── إنشاء قناة ──────────────────────────────────────────────────
router.post('/admin/channels', auth, async (req, res) => {
  const uid = parseInt(req.tgUser.id);
  const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
  const adm = await get('SELECT 1 FROM admins WHERE user_id=$1',[uid]).catch(()=>null);
  if (uid !== OWNER_ID && !adm) return res.status(403).json({ error: 'forbidden' });
  const { name, description, link, icon, members_count } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    await run(
      'INSERT INTO channels(name,description,link,icon,members_count,created_by) VALUES($1,$2,$3,$4,$5,$6)',
      [name, description||null, link||null, icon||'📺', members_count||null, uid]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/admin/channels/:id/delete', auth, async (req, res) => {
  const uid = parseInt(req.tgUser.id);
  const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
  const adm = await get('SELECT 1 FROM admins WHERE user_id=$1',[uid]).catch(()=>null);
  if (uid !== OWNER_ID && !adm) return res.status(403).json({ error: 'forbidden' });
  try { await run('UPDATE channels SET is_deleted=1 WHERE id=$1',[req.params.id]); res.json({ ok:true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});
// ══════════════════════════════════════════════════════════════════
// routes_missing_v2.js — استبدل routes_missing.js الأول بهذا
// أضفه في api.js قبل module.exports = router;
// ══════════════════════════════════════════════════════════════════

// ─── ملفات حديثة حسب التخصص ──────────────────────────────────────
router.get('/latest/specialty/:spId', auth, async (req, res) => {
  try {
    const spId = parseInt(req.params.spId);
    const rows = await all(
      `SELECT f.*, c.name as cat_name, s.name as sub_name
       FROM files f
       JOIN categories c ON c.id = f.category_id
       JOIN subjects s ON s.id = c.subject_id
       JOIN semesters sem ON sem.id = s.semester_id
       JOIN years y ON y.id = sem.year_id
       WHERE y.specialty_id = $1 AND f.is_deleted=0
       ORDER BY f.uploaded_at DESC LIMIT 8`,
      [spId]
    );
    res.json(rows);
  } catch(e) { res.json([]); }
});

// ─── تحديث بروفايل المستخدم (الاسم) ─────────────────────────────
router.post('/profile/update', auth, async (req, res) => {
  try {
    const uid = parseInt(req.tgUser.id);
    const { first_name, last_name } = req.body;
    if (first_name) {
      await run(
        'UPDATE users SET first_name=$1, last_name=$2 WHERE id=$3',
        [first_name.trim(), (last_name || '').trim(), uid]
      ).catch(() => {});
    }
    const { cacheClear } = require('../utils/cache');
    cacheClear('prof_' + uid);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── نقاط المستخدم ───────────────────────────────────────────────
router.get('/points/me', auth, async (req, res) => {
  try {
    const uid = parseInt(req.tgUser.id);
    const pts = await get('SELECT * FROM user_points WHERE user_id=$1', [uid]).catch(() => null);
    const rank = await require('../database/points').getUserRank(uid).catch(() => 999);
    res.json({
      total_points: pts?.total_points || 0,
      streak_days: pts?.streak_days || 0,
      downloads_count: pts?.downloads_count || 0,
      comments_count: pts?.comments_count || 0,
      ratings_count: pts?.ratings_count || 0,
      rank: rank || 999,
    });
  } catch(e) {
    res.json({ total_points:0, downloads_count:0, comments_count:0, ratings_count:0, streak_days:0, rank:999 });
  }
});

router.get('/points/rank', auth, async (req, res) => {
  try {
    const uid = parseInt(req.tgUser.id);
    const rank = await require('../database/points').getUserRank(uid).catch(() => 999);
    res.json({ rank: rank || 999 });
  } catch(e) { res.json({ rank: 999 }); }
});

router.get('/points/leaderboard', auth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20'), 50);
    const lb = await require('../database/points').getLeaderboard(limit).catch(() => []);
    res.json(lb);
  } catch(e) { res.json([]); }
});

router.post('/points/daily', auth, async (req, res) => {
  try {
    const uid = parseInt(req.tgUser.id);
    await require('../database/points').checkDailyLogin(uid).catch(() => {});
    res.json({ ok: true });
  } catch(e) { res.json({ ok: false }); }
});

// ─── سجل التحميل (من user_points + latest files) ─────────────────
router.get('/history', auth, async (req, res) => {
  try {
    // ما في جدول downloads منفصل — نرجع آخر الملفات بدلاً
    const files = await all(
      `SELECT f.*, c.name as cat_name, s.name as sub_name
       FROM files f
       LEFT JOIN categories c ON c.id = f.category_id
       LEFT JOIN subjects s ON s.id = c.subject_id
       WHERE f.is_deleted=0
       ORDER BY f.downloads DESC, f.uploaded_at DESC
       LIMIT 20`
    );
    res.json(files);
  } catch(e) { res.json([]); }
});

// ─── لايك التعليق ────────────────────────────────────────────────
router.post('/comment/:id/like', auth, async (req, res) => {
  try {
    const uid = parseInt(req.tgUser.id);
    const cid = parseInt(req.params.id);
    const ex = await get(
      'SELECT 1 FROM comment_likes WHERE user_id=$1 AND comment_id=$2',
      [uid, cid]
    ).catch(() => null);
    if (ex) {
      await run('DELETE FROM comment_likes WHERE user_id=$1 AND comment_id=$2', [uid, cid]);
      await run('UPDATE comments SET likes=GREATEST(0,COALESCE(likes,0)-1) WHERE id=$1', [cid]).catch(() => {});
      res.json({ liked: false });
    } else {
      await run('INSERT INTO comment_likes(user_id,comment_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [uid, cid]);
      await run('UPDATE comments SET likes=COALESCE(likes,0)+1 WHERE id=$1', [cid]).catch(() => {});
      res.json({ liked: true });
    }
  } catch(e) { res.json({ liked: false }); }
});

// ─── الإعلانات ───────────────────────────────────────────────────
router.get('/ads', auth, async (req, res) => {
  try {
    const rows = await all(
      `SELECT * FROM ads WHERE is_deleted=0
       ORDER BY is_pinned DESC, created_at DESC LIMIT 30`
    ).catch(() => []);
    res.json(rows);
  } catch(e) { res.json([]); }
});

// ─── القنوات ─────────────────────────────────────────────────────
router.get('/channels', auth, async (req, res) => {
  try {
    const rows = await all(
      'SELECT * FROM channels WHERE is_deleted=0 ORDER BY sort_order ASC, id DESC'
    ).catch(() => []);
    res.json(rows);
  } catch(e) { res.json([]); }
});

// ─── إنشاء إعلان ─────────────────────────────────────────────────
router.post('/admin/ads', auth, async (req, res) => {
  const uid = parseInt(req.tgUser.id);
  const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
  const adm = await get('SELECT 1 FROM admins WHERE user_id=$1', [uid]).catch(() => null);
  if (uid !== OWNER_ID && !adm) return res.status(403).json({ error: 'forbidden' });
  const { title, body, icon, link, specialty_id, is_pinned, image_url, video_url } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    await run(
      `INSERT INTO ads(title,body,icon,link,specialty_id,is_pinned,created_by,image_url,video_url)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [title, body||null, icon||'📌', link||null, specialty_id||null,
       is_pinned ? 1 : 0, uid, image_url||null, video_url||null]
    );
    res.json({ ok: true });
  } catch(e) {
    // fallback بدون video_url
    try {
      await run(
        `INSERT INTO ads(title,body,icon,link,specialty_id,is_pinned,created_by,image_url)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [title, body||null, icon||'📌', link||null, specialty_id||null,
         is_pinned ? 1 : 0, uid, image_url||video_url||null]
      );
      res.json({ ok: true });
    } catch(e2) { res.status(500).json({ error: e2.message }); }
  }
});

router.post('/admin/ads/:id/delete', auth, async (req, res) => {
  const uid = parseInt(req.tgUser.id);
  const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
  const adm = await get('SELECT 1 FROM admins WHERE user_id=$1', [uid]).catch(() => null);
  if (uid !== OWNER_ID && !adm) return res.status(403).json({ error: 'forbidden' });
  try {
    await run('UPDATE ads SET is_deleted=1 WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── إنشاء قناة ──────────────────────────────────────────────────
router.post('/admin/channels', auth, async (req, res) => {
  const uid = parseInt(req.tgUser.id);
  const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
  const adm = await get('SELECT 1 FROM admins WHERE user_id=$1', [uid]).catch(() => null);
  if (uid !== OWNER_ID && !adm) return res.status(403).json({ error: 'forbidden' });
  const { name, description, link, icon, members_count } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    await run(
      'INSERT INTO channels(name,description,link,icon,members_count,created_by) VALUES($1,$2,$3,$4,$5,$6)',
      [name, description||null, link||null, icon||'📺', members_count||null, uid]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/admin/channels/:id/delete', auth, async (req, res) => {
  const uid = parseInt(req.tgUser.id);
  const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
  const adm = await get('SELECT 1 FROM admins WHERE user_id=$1', [uid]).catch(() => null);
  if (uid !== OWNER_ID && !adm) return res.status(403).json({ error: 'forbidden' });
  try {
    await run('UPDATE channels SET is_deleted=1 WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── إضافة مشرف ──────────────────────────────────────────────────
router.post('/admin/addadmin', auth, async (req, res) => {
  const uid = parseInt(req.tgUser.id);
  const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
  if (uid !== OWNER_ID) return res.status(403).json({ error: 'owner only' });
  const { userId, permissions } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    await run(
      'INSERT INTO admins(user_id,added_by,permissions) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET permissions=$3',
      [parseInt(userId), uid, permissions || 'full']
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════
//  XP SYSTEM ROUTES
// ══════════════════════════════════════════════════════
const xpDb = require('../database/xp');

// GET /api/xp/me — full XP data for current user
router.get('/xp/me', auth, async (req, res) => {
  try {
    const uid = parseInt(req.tgUser.id);
    const [xpData, rank] = await Promise.all([
      xpDb.getXp(uid),
      xpDb.getRank(uid),
    ]);
    res.json({ ...xpData, rank });
  } catch(e) { res.json({ xp:0, level:1, rank:999 }); }
});

// GET /api/xp/leaderboard
router.get('/xp/leaderboard', auth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit||'20'), 50);
    const lb = await xpDb.getLeaderboard(limit);
    res.json(lb);
  } catch(e) { res.json([]); }
});

// GET /api/xp/levels — send LEVELS array to frontend
router.get('/xp/levels', auth, (_req, res) => {
  res.json(xpDb.LEVELS);
});

// POST /api/xp/daily — daily login XP
router.post('/xp/daily', auth, async (req, res) => {
  try {
    const uid = parseInt(req.tgUser.id);
    // Check if already claimed today
    const today = new Date().toISOString().slice(0,10);
    const row = await get('SELECT updated_at FROM user_xp WHERE user_id=$1', [uid]).catch(()=>null);
    const lastDate = row ? String(row.updated_at||'').slice(0,10) : '';
    if (lastDate === today) return res.json({ ok: true, awarded: false, already: true });
    const result = await xpDb.addXp(uid, 'daily_login');
    // also send level-up msg if needed
    if (result?.leveled_up && global.__bot) {
      try { require('../handlers/xp').award(global.__bot, uid, 'daily_login'); } catch(_) {}
    }
    res.json({ ok: true, awarded: true, result });
  } catch(e) { res.json({ ok: false }); }
});

module.exports = router;

// ─── PROFILE UPDATE ───
router.post('/profile/update', auth, async (req, res) => {
  const uid = req.tgUser.id;
  const { bio, specialty_id, owner_about } = req.body;
  try {
    if (bio !== undefined) {
      await run(`INSERT INTO users(id,first_name) VALUES($1,'') ON CONFLICT(id) DO UPDATE SET bio=$2`, [uid, bio.substring(0,200)]);
    }
    if (specialty_id !== undefined && specialty_id > 0) {
      await run(`INSERT INTO user_specialties(user_id,specialty_id) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET specialty_id=$2, updated_at=NOW()`, [uid, specialty_id]);
    }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── PUBLIC USER PROFILE ───
router.get('/user/:id', auth, async (req, res) => {
  try {
    const u = await get(`SELECT u.*, us.specialty_id, s.name as specialty_name,
      (SELECT COUNT(*) FROM history WHERE user_id=u.id) as dl_count,
      (SELECT COUNT(*) FROM favorites WHERE user_id=u.id) as fav_count,
      (SELECT COUNT(*) FROM comments WHERE user_id=u.id AND is_deleted=0) as cmt_count,
      (SELECT COUNT(*) FROM ratings WHERE user_id=u.id) as rating_count,
      (SELECT COALESCE(total_points,0) FROM user_points WHERE user_id=u.id) as xp
      FROM users u
      LEFT JOIN user_specialties us ON us.user_id=u.id
      LEFT JOIN specialties s ON s.id=us.specialty_id
      WHERE u.id=$1`, [req.params.id]);
    if (!u) return res.status(404).json({ error: 'not found' });
    const OWNER_ID = parseInt(process.env.OWNER_ID || '0');
    u.is_owner = parseInt(u.id) === OWNER_ID;
    res.json(u);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── LEADERBOARD ───
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const rows = await all(`SELECT u.id, u.first_name, u.last_name, us.specialty_id,
      s.name as specialty_name,
      COALESCE(up.total_points,0) as total,
      (SELECT COUNT(*) FROM history WHERE user_id=u.id) as dl_count
      FROM users u
      LEFT JOIN user_specialties us ON us.user_id=u.id
      LEFT JOIN specialties s ON s.id=us.specialty_id
      LEFT JOIN user_points up ON up.user_id=u.id
      WHERE u.is_banned=0
      ORDER BY COALESCE(up.total_points,0) DESC
      LIMIT 20`);
    res.json(rows);
  } catch(e) { res.json([]); }
});

// ─── TRENDING ───
router.get('/trending', auth, async (req, res) => {
  try {
    const rows = await all(`SELECT f.*, s.name as sub_name,
      AVG(r.rating) as rating_avg, COUNT(r.rating) as rating_cnt
      FROM files f
      LEFT JOIN categories c ON c.id=f.category_id
      LEFT JOIN subjects s ON s.id=c.subject_id
      LEFT JOIN ratings r ON r.file_id=f.id
      WHERE f.is_deleted=0
      GROUP BY f.id, s.name
      ORDER BY f.downloads DESC, f.uploaded_at DESC
      LIMIT 20`);
    res.json(rows);
  } catch(e) { res.json([]); }
});

// ─── HISTORY ───
router.get('/history', auth, async (req, res) => {
  const uid = req.tgUser.id;
  try {
    const rows = await all(`SELECT f.*, s.name as sub_name, h.viewed_at
      FROM history h
      JOIN files f ON f.id=h.file_id
      LEFT JOIN categories c ON c.id=f.category_id
      LEFT JOIN subjects s ON s.id=c.subject_id
      WHERE h.user_id=$1 AND f.is_deleted=0
      ORDER BY h.viewed_at DESC LIMIT 30`, [uid]);
    res.json(rows);
  } catch(e) { res.json([]); }
});

// ─── NOTIFICATIONS ───
router.get('/notifications', auth, async (req, res) => {
  try { res.json([]); } catch(e) { res.json([]); }
});
router.get('/notifications/count', auth, async (req, res) => {
  res.json({ count: 0 });
});

// ─── ADMINS PUBLIC ───
router.get('/admins/public', auth, async (req, res) => {
  try {
    const rows = await all(`SELECT a.user_id, u.first_name, u.last_name, u.username,
      s.name as specialty_name
      FROM admins a
      LEFT JOIN users u ON u.id=a.user_id
      LEFT JOIN specialties s ON s.id=a.specialty_id
      WHERE u.username IS NOT NULL AND u.username != ''
      ORDER BY a.added_at DESC LIMIT 10`);
    res.json(rows);
  } catch(e) { res.json([]); }
});

// ─── AI CHAT ───
router.post('/ai/chat', auth, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'no message' });
  try {
    const { handleOwnerAI } = require('../handlers/ai_owner');
    const fakeCtx = {
      uid: req.tgUser.id,
      from: req.tgUser,
      message: { text: message },
      reply: (text) => { res.json({ reply: text }); }
    };
    await handleOwnerAI(fakeCtx, message);
  } catch(e) {
    res.json({ reply: 'عذراً، حدث خطأ في الاتصال بالذكاء الاصطناعي. جرب مرة أخرى.' });
  }
});

// ─── ADS ───
router.get('/ads', auth, async (req, res) => {
  try {
    const rows = await all(`SELECT * FROM message_templates WHERE type IN ('ad','pinned','specialty','channel','general') ORDER BY created_at DESC LIMIT 20`).catch(()=>[]);
    res.json(rows);
  } catch(e) { res.json([]); }
});

// ─── CHANNELS ───
router.get('/channels', auth, async (req, res) => {
  try {
    const rows = await all(`SELECT * FROM required_channels WHERE is_active=1 ORDER BY id`).catch(()=>[]);
    res.json(rows.map(r=>({...r,joined:false,is_trending:false,is_recommended:false,emoji:'📺',url:r.channel_url,name:r.channel_name,members:0})));
  } catch(e) { res.json([]); }
});

// ─── FILE OF DAY ───
router.get('/fotd', auth, async (req, res) => {
  try {
    const f = await get(`SELECT f.*, s.name as sub_name FROM files f LEFT JOIN categories c ON c.id=f.category_id LEFT JOIN subjects s ON s.id=c.subject_id WHERE f.is_deleted=0 ORDER BY f.downloads DESC LIMIT 1`);
    res.json(f||null);
  } catch(e) { res.json(null); }
});

// ─── LATEST by specialty ───
router.get('/latest', auth, async (req, res) => {
  const spId = req.query.spId;
  try {
    let q = `SELECT f.*, s.name as sub_name FROM files f LEFT JOIN categories c ON c.id=f.category_id LEFT JOIN subjects s ON s.id=c.subject_id`;
    const params = [];
    if (spId && spId !== '0') {
      q += ` LEFT JOIN semesters sem ON sem.id=s.semester_id LEFT JOIN years y ON y.id=sem.year_id WHERE f.is_deleted=0 AND y.specialty_id=$1`;
      params.push(spId);
    } else {
      q += ` WHERE f.is_deleted=0`;
    }
    q += ` ORDER BY f.uploaded_at DESC LIMIT 20`;
    const rows = await all(q, params);
    res.json(rows);
  } catch(e) { res.json([]); }
});
