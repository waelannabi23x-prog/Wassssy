'use strict';

const _map = new Map();

setInterval(() => {
  const cut = Date.now() - 120000;
  for (const [k, v] of _map) if (v.t < cut) _map.delete(k);
}, 60000).unref();

function rateLimit(max = 30, windowMs = 60000) {
  return (req, res, next) => {
    const uid = req.tgUser?.id || req.ip || 'unknown';
    const key = uid + '_api';
    const now = Date.now();
    let u = _map.get(key);
    if (!u || now - u.t > windowMs) {
      _map.set(key, { c: 1, t: now });
      return next();
    }
    u.c++;
    _map.set(key, u);
    if (u.c > max) {
      return res.status(429).json({ error: 'Too many requests. Try again later.' });
    }
    return next();
  };
}

module.exports = { rateLimit };
