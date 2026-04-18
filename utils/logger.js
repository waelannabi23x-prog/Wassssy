const fs = require('fs');
const path = require('path');

const ERR_LOG = path.join(__dirname, '../logs/err.log');
const MAX_SIZE = 5 * 1024 * 1024;

let lastRotate = 0;
function maybeRotate(file) {
  const now = Date.now();
  if (now - lastRotate < 60000) return;
  lastRotate = now;
  try {
    fs.access(file, (err) => {
      if (err) return;
      fs.stat(file, (err, stats) => {
        if (err || stats.size <= MAX_SIZE) return;
        fs.rename(file, file + '.bak', () => {});
      });
    });
  } catch(e) {}
}

function ts() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function write(file, level, args) {
  maybeRotate(file);
  const line = '[' + ts() + '] [' + level + '] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') + '\n';
  fs.appendFile(file, line, () => {});
}

const isProd = process.env.NODE_ENV === 'production';

const logger = {
  info:  (...args) => { if (!isProd) console.log(...args); write(ERR_LOG, 'INFO',  args); },
  warn:  (...args) => { console.warn(...args);  write(ERR_LOG, 'WARN',  args); },
  error: (...args) => { console.error(...args); write(ERR_LOG, 'ERROR', args); },
  db:    (...args) => { write(ERR_LOG, 'DB', args); },
};

module.exports = logger;
