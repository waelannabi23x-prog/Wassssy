const fs = require('fs');
let code = fs.readFileSync('handlers/manage.js', 'utf8');

const editPermsFunc = [
  '',
  'const ALL_PERMS=["upload","delete","add_content","view_users","full"];',
  'const PERM_LABELS={upload:"📤 رفع",delete:"🗑 حذف",add_content:"➕ إضافة محتوى",view_users:"👥 مشاهدة",full:"👑 كل الصلاحيات"};',
  '',
  'async function showEditPerms(ctx,adminId){',
  '  const list=adminsDb.getAll();',
  '  const admin=list.find(a=>a.user_id==adminId);',
  '  if(!admin) return ctx.reply("غير موجود.");',
  '  const currentPerms=(admin.permissions||"upload,add_content").split(",").map(p=>p.trim());',
  '  const text="صلاحيات "+(admin.first_name||adminId);',
  '  const rows=ALL_PERMS.map(p=>[btn((currentPerms.includes(p)?"✅ ":"☐ ")+(PERM_LABELS[p]||p),"mg_tp_"+adminId+"_"+p)]);',
  '  rows.push([btn("◀️ رجوع","mg_admins")]);',
  '  return eos(ctx,text,{parse_mode:"Markdown",...build(rows)});',
  '}',
  '',
].join('\n');

code = code.replace('async function showAdmins(ctx){', editPermsFunc + 'async function showAdmins(ctx){');

const oldRow = 'const rows=list.map(a=>[btn("🗑 "+(a.first_name||a.user_id),"mg_da_"+a.user_id)]);';
const newRow = 'const rows=list.map(a=>[btn("⚙️ "+(a.first_name||a.user_id),"mg_ep_"+a.user_id),btn("🗑","mg_da_"+a.user_id)]);';
code = code.replace(oldRow, newRow);

fs.writeFileSync('handlers/manage.js', code);
console.log('Done!');
