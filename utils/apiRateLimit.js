'use strict';

const _map = new Map();

// تنظيف كل دقيقة
setInterval(() => {
  const cut = Date.now() - 60000;
  for (const [k, v] of _map) if (v.t < cut) _map.delete(k);
}, 60000).unref();

// max: عدد الطلبات، window: بالمللي ثانية
function rateLimit(max = 30, windowMs = 60000) {
  return (req, res, next) => {
    const ip  = req.ip || req.connection.remoteAddress || 'unknown';
    const uid = req.tgUser?.id || ip;
    const key = uid + '_api';
    const now = Date.now();
    let u = _map.get(key);
    if (!u || now - u.t > windowMs) {
      u = { c: 1, t: now };
    } else {
      u.c++;
      if (u.c > max) {
        return res.status(429).json({ error: 'Too many requests. Try again later.' });
      }
    }
    _map.set(key, u);
    return next();
  };
}

module.exports = { rateLimit };
