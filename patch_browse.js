const fs = require('fs');
let code = fs.readFileSync('handlers/browse.js', 'utf8');

code = code.replace(
  "const {eos,buildPath}=require('../utils/helpers');",
  "const {eos,buildPath,quickAck,showTyping}=require('../utils/helpers');"
);

fs.writeFileSync('handlers/browse.js', code);
console.log('✅ browse.js patched');
