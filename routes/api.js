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
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

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
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/rate/:id', auth, async (req, res) => {
  try {
    const { rating } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'invalid' });
    await run(`INSERT INTO ratings(user_id,file_id,rating) VALUES($1,$2,$3) ON CONFLICT(user_id,file_id) DO UPDATE SET rating=$3`, [req.tgUser.id, req.params.id, rating]);
    const avg = await get(`SELECT AVG(rating) as avg, COUNT(*) as cnt FROM ratings WHERE file_id=$1`, [req.params.id]);
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
      get('SELECT COUNT(*) as c FROM downloads WHERE user_id=$1', [parseInt(targetId)]).catch(() => ({ c: 0 })),
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
      get('SELECT COUNT(*) as c FROM downloads WHERE user_id=$1', [targetId]).catch(() => ({ c: 0 })),
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

