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
const { all, get } = require('../database/db');

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
