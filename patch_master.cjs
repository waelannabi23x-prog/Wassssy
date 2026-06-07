'use strict';
const fs = require('fs');
const path = require('path');
const R = __dirname;
const rd = r => fs.readFileSync(path.join(R,r),'utf8');
const wr = (r,c) => fs.writeFileSync(path.join(R,r),c,'utf8');

// 1. bank_games.js
