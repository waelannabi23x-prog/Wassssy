const fs = require('fs');
const indexPath = process.env.HOME + '/study-bot-backup-20260407_011636/index.js';
let idx = fs.readFileSync(indexPath, 'utf8');

const oldAR = `    const arKey = 'auto_replies_all';
    let arList = _cGet(arKey);
    if (!arList) {
      arList = await _dbAll('SELECT * FROM auto_replies WHERE is_active=1').catch(()=>[]);
      _cSet(arKey, arList, 120000);
    }
    // Rotation — رد واحد فقط على الجملة (أول trigger يطابق)
    if (!global._arCounters) global._arCounters = new Map();

    // ابحث عن أول trigger يطابق الجملة
    const triggersFound = [];
    for (const ar of arList) {
      const t = ar.trigger.toLowerCase();`;

if (!idx.includes(oldAR.substring(0, 80))) {
  console.log('⚠️ pattern check failed, trying direct replacement');
}

// نستبدل كامل منطق auto_replies
const oldBlock = idx.substring(
  idx.indexOf("    const arKey = 'auto_replies_all';"),
  idx.indexOf("      ctx.reply(responses[rIdx].response, { reply_to_message_id: ctx.message.message_id }).catch(()=>{});") + 
  "      ctx.reply(responses[rIdx].response, { reply_to_message_id: ctx.message.message_id }).catch(()=>{});".length
);

const newBlock = `    const arKey = 'auto_replies_all';
    let arList = _cGet(arKey);
    if (!arList) {
      arList = await _dbAll('SELECT * FROM auto_replies WHERE is_active=1').catch(() => []);
      _cSet(arKey, arList, 120000);
    }

    // ابحث عن كل triggers تطابق
    const matched = [];
    for (const ar of arList) {
      try {
        let isMatch = false;
        if (ar.match_type === 'regex') {
          isMatch = new RegExp(ar.trigger, 'i').test(txt);
        } else if (ar.match_type === 'exact') {
          isMatch = txt.toLowerCase() === ar.trigger.toLowerCase();
        } else {
          isMatch = txt.toLowerCase().includes(ar.trigger.toLowerCase());
        }
        if (isMatch) matched.push(ar);
      } catch(_) {
        if (txt.toLowerCase().includes(ar.trigger.toLowerCase())) matched.push(ar);
      }
    }

    if (matched.length > 0) {
      // رد عشوائي حقيقي
      const pick = matched[Math.floor(Math.random() * matched.length)];
      ctx.reply(pick.response, {
        reply_to_message_id: ctx.message.message_id,
        parse_mode: 'Markdown'
      }).catch(() => {});`;

if (oldBlock.length > 50) {
  idx = idx.replace(oldBlock, newBlock);
  fs.writeFileSync(indexPath, idx);
  console.log('✅ Done - length replaced:', oldBlock.length);
} else {
  console.log('❌ block not found, length:', oldBlock.length);
}
