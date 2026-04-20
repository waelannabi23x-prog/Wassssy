'use strict';
const fs   = require('fs');
const path = require('path');

const LOG_DIR  = path.join(__dirname, '..', 'logs');
const ERR_LOG  = path.join(LOG_DIR, 'err.log');
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB per file
const MAX_KEEP = 3;                 // keep last 3 rotated logs

try { if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true }); } catch (_) {}

let buf = '', flushTimer = null;

function ts() { return new Date().toISOString().replace('T', ' ').substring(0, 19); }

function _rotate() {
  try {
    if (fs.statSync(ERR_LOG).size < MAX_SIZE) return;
    for (let i = MAX_KEEP; i >= 1; i--) {
      const src  = i === 1 ? ERR_LOG : `${ERR_LOG}.${i - 1}`;
      const dest = `${ERR_LOG}.${i}`;
      try { fs.renameSync(src, dest); } catch (_) {}
    }
  } catch (_) {}
}

function _flush() {
  if (!buf) return;
  _rotate();
  const d = buf; buf = '';
  fs.appendFile(ERR_LOG, d, () => {});
}

function _write(level, args) {
  buf += `[${ts()}] [${level}] ${
    args.map(a => (typeof a === 'object' && a !== null) ? JSON.stringify(a) : String(a)).join(' ')
  }\n`;
  if (buf.length > 4096) { _flush(); return; }
  if (!flushTimer) {
    flushTimer = setTimeout(() => { flushTimer = null; _flush(); }, 3000);
    if (flushTimer.unref) flushTimer.unref();
  }
}

const logger = {
  info:  (...a) => { console.log('[INFO]',  ...a); },
  warn:  (...a) => { console.warn('[WARN]',  ...a); _write('WARN',  a); },
  error: (...a) => { console.error('[ERROR]', ...a); _write('ERROR', a); },
  debug: (...a) => { if (process.env.DEBUG) console.debug('[DEBUG]', ...a); },
};

process.on('exit', _flush);
module.exports = logger;
