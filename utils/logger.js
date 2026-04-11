const fs = require('fs');
const path = require('path');

const ERR_LOG = path.join(__dirname, '../logs/err.log');
const OUT_LOG = path.join(__dirname, '../logs/out.log');
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

function timestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function rotate(file) {
  try {
      try {
        await fs.promises.access(file);
        const stats = await fs.promises.stat(file);
        if (stats.size > MAX_SIZE) {
          await fs.promises.rename(file, file + '.bak');
        }
      } catch (e) {
        // file might not exist, ignore
      }
  } catch(e) {}
}

function write(file, level, args) {
  rotate(file);
  const line = `[${timestamp()}] [${level}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`;
  fs.appendFile(file, line, () => {});
}

const logger = {
  info:  (...args) => { console.log(...args);   write(OUT_LOG, 'INFO',  args); },
  warn:  (...args) => { console.warn(...args);  write(OUT_LOG, 'WARN',  args); },
  error: (...args) => { console.error(...args); write(ERR_LOG, 'ERROR', args); },
  db:    (...args) => { write(OUT_LOG, 'DB', args); },
};

module.exports = logger;
