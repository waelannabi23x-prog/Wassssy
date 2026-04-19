'use strict';
const fs   = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const ERR_LOG = path.join(LOG_DIR, 'err.log');

try { if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true }); } catch (_) {}

let buf = '', flushT = null;

function ts() { return new Date().toISOString().replace('T', ' ').substring(0, 19); }

function _flush() {
  if (!buf) return;
  const d = buf; buf = '';
  fs.appendFile(ERR_LOG, d, () => {});
}

function _write(level, args) {
  buf += '[' + ts() + '] [' + level + '] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') + '\n';
  if (buf.length > 4096) _flush();
  if (!flushT) { flushT = setInterval(_flush, 3000); flushT.unref(); }
}

// ✅ info يظهر دائماً حتى في production (Railway يلتقطها من stdout)
const logger = {
  info:  (...a) => { console.log('[INFO]',  ...a); },
  warn:  (...a) => { console.warn('[WARN]',  ...a); _write('WARN',  a); },
  error: (...a) => { console.error('[ERROR]', ...a); _write('ERROR', a); },
  db:    (...a) => { _write('DB', a); },
};

process.on('exit', _flush);
module.exports = logger;
