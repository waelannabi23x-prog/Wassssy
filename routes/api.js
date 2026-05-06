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
  const [dlCount, favCount, spRow] = await Promise.all([
    interactions.getUserDownloadCount(uid),
    get('SELECT COUNT(*) as c FROM favorites WHERE user_id=$1', [uid]).then(r => r?.c || 0),
    usersDb.getSpecialty(uid),
  ]);
  const sp = spRow?.specialty_id ? await content.getSpec(spRow.specialty_id) : null;
  res.json({ user: req.tgUser, dlCount, favCount, specialty: sp });
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
