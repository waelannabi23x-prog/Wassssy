const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');

const heavyActions = ['preview_','fl_','ct_','bundle_','bdl_','sp_','yr_','sm_','sb_','sms_','sbs_','yrs_','latest','new_in_sp','recommended','favorites','history','profile','stats','progress','cmt_','rate_','mg_analytics','mg_content','mg_users','mg_admins','mg_logs','browse','main_menu'];

code = code.replace(
  "    // أجب على الـ callback فوراً لمنع timeout\n    ctx.answerCbQuery('').catch(() => {});",
  `    const _isHeavy = [${heavyActions.map(a=>`'${a}'`).join(',')}].some(p=>data.startsWith(p)||data===p);\n    ctx.answerCbQuery(_isHeavy ? '⏳' : '', { show_alert: false }).catch(() => {});`
);

fs.writeFileSync('index.js', code);
console.log('✅ index.js patched');
