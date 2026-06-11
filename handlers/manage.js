'use strict';
const content=require('../database/content');
const bundlesDb=require('../database/bundles');
const filesDb=require('../database/files');
const adminsDb=require('../database/admins');
const usersDb=require('../database/users');
const interactions=require('../database/interactions');
const browse=require('./browse');
const {build,btn,back,backMenu}=require('../utils/keyboard');
const {eos,buildPath,escMd}=require('../utils/helpers');
const {isOwner}=require('../middlewares/auth');
const bundlesH=require('./manage_bundles');
const analyticsH=require('./analytics');
const {cacheGet,cacheSet,cacheClear,cacheClearPrefix}=require('../utils/cache');
const {notifyGroupsNewFile}=require('../utils/groupNotify');
const {broadcastQueue,safeAdd}=require('../utils/queues');
const messagesDb=require('../database/messages');
const {all,run:dbRun,getSetting,setSetting}=require('../database/db');

const PS=10;

// Sanitize user input — strip dangerous chars, limit length
function sanitizeInput(str, maxLen = 200) {
  if (!str) return '';
  return String(str)
    .replace(/[\x00-\x1f\x7f]/g, '')   // strip control chars
    .replace(/[<>"'`;]{2,}/g, '')        // strip injection patterns
    .trim()
    .substring(0, maxLen);
}


const setState=(uid,s)=>{ if(require('../utils/stateManager').setState) require('../utils/stateManager').setState(uid,s); };
const clearState=uid=>{ if(require('../utils/stateManager').delState) require('../utils/stateManager').delState(uid); };

async function concurrentBroadcast(bot,chatId,msgId,ids,txt,opt={}){if(!bot)return {sent:0,failed:0};
  if(!bot||!bot.sendMessage){console.error('[BC] bot is undefined');return {sent:0,failed:ids.length};}
  let s=0,f=0;const t=ids.length,B=30;
  const ui=async()=>{const p=Math.round((s+f)/t*100),b='█'.repeat(Math.round(p/10))+'░'.repeat(10-Math.round(p/10));bot.editMessageText(chatId,msgId,null,'📢 *جاري الإرسال...*\x60['+b+'] '+p+'%\x60\n✅ '+s+' | ❌ '+f+' | ⏳ '+(t-s-f),{parse_mode:'Markdown'}).catch(err => { require('../utils/logger').debug("[silent]", err.message); });};
  for(let i=0;i<t;i+=B){const r=await Promise.allSettled(ids.slice(i,i+B).map(id=>bot.sendMessage(id,txt,opt).then(()=>true).catch(()=>false)));r.forEach(x=>{if(x.status==='fulfilled'&&x.value)s++;else f++;});await ui();if(i+B<t)await new Promise(r=>setTimeout(r,1100));}
  return {sent:s,failed:f};
}
async function mainMenu(ctx){
  const [specs0,files0]=await Promise.all([content.getSpecs(),filesDb.totalFiles()]);
  const text=
    '🛠 *لوحة الإدارة*\n' +
    '━━━━━━━━━━━━━━━━━━━━\n\n' +
    '📚 التخصصات: *'+specs0.length+'*\n' +
    '📁 الملفات: *'+files0+'*\n' +
    '🔧 الصيانة: *'+(global.maintenanceMode?'🔴 مفعّل':'🟢 متوقف')+'*';

  const rows = [];

  // ── المحتوى والإحصائيات ──
  rows.push([btn('📂 المحتوى','mg_content'), btn('📊 الإحصائيات','mg_analytics')]);
  rows.push([btn('📜 السجلات','mg_logs'), btn('🗑 المحذوفات','mg_trash')]);

  if(isOwner(ctx.uid)){
    // ── المستخدمون ──
    rows.push([btn('👥 المستخدمون','mg_users'), btn('👑 الإداريون','mg_admins')]);

    // ── القروبات ──
    rows.push([btn('👥 القروبات','grp_main')]);

    // ── البث والإشعارات ──
    rows.push([btn('📢 بث للكل','mg_broadcast'), btn('🔔 إشعار','mg_notify')]);
    rows.push([btn('🎓 إشعار لتخصص','mg_notify_sp'), btn('📨 الرسائل','mg_msgs')]);

    // ── الألعاب والبنك ──
    rows.push([btn('🎮 الألعاب','mb_panel'), btn('🏦 البنك','mg_bank_panel')]);

    // ── الردود والقنوات ──
    rows.push([btn('🤖 الردود التلقائية','mg_auto_replies'), btn('📢 القنوات','mg_channels_menu')]);

    // ── النظام ──
    rows.push([btn('💾 نسخ احتياطي','mg_backup'), btn('♻️ استعادة','mg_restore')]);
    rows.push([btn(global.maintenanceMode?'🟢 إيقاف الصيانة':'🔴 الصيانة','mg_maint'), btn('🚩 البلاغات','mg_reports')]);

    if(process.env.CHANNEL_ID) rows.push([btn('📢 نشر في القناة','mg_post_channel')]);

    const appVisible = global._appPublic || false;
    rows.push([btn('📱 Mini App','mg_open_app'), btn(appVisible?'👁 ظاهر':'🔒 مخفي','mg_toggle_app')]);
  }

  rows.push([btn('⚙️ إعدادات البوت','mg_bot_settings')]);
  rows.push([btn('🏠 القائمة الرئيسية','main_menu')]);
  return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});
}

async function showContent(ctx){
  const adminSp=ctx.isOwner?0:await adminsDb.getAdminSpecialty(ctx.uid);
  let specs=await content.getSpecs();
  if(adminSp&&adminSp!=0) specs=specs.filter(s=>s.id==adminSp);
  const rows=specs.map(s=>[btn('🎓 '+s.name,'mg_yrs_'+s.id),btn('✏️','mg_rn_sp_'+s.id),btn('🗑','mg_dl_sp_'+s.id)]);
  rows.push([btn('➕ إضافة تخصص','mg_add_sp'),btn('🗑 حذف الكل نهائياً','mg_empty_trash')]);
  rows.push(back('mg_menu'));
  return eos(ctx,'🎓 *التخصصات*'+(specs.length?'':'\n_لا يوجد._'),{parse_mode:'Markdown',...build(rows)});
}

async function showYears(ctx,spId){
  const [sp,years]=await Promise.all([content.getSpec(spId),content.getYears(spId)]);
  const rows=years.map(y=>[btn('📅 '+y.name,'mg_sems_'+spId+'_'+y.id),btn('✏️','mg_rn_yr_'+spId+'_'+y.id),btn('🗑','mg_dl_yr_'+spId+'_'+y.id)]);
  rows.push([btn('➕ إضافة سنة','mg_add_yr_'+spId)]);
  rows.push(back('mg_content'));
  return eos(ctx,'🎓 *'+escMd(sp?.name)+'*\n📅 السنوات',{parse_mode:'Markdown',...build(rows)});
}

async function showSemesters(ctx,spId,yrId){
  const [sp,yr,sems]=await Promise.all([content.getSpec(spId),content.getYear(yrId),content.getSemesters(yrId)]);
  const rows=sems.map(s=>[btn('📆 '+s.name,'mg_sbs_'+spId+'_'+yrId+'_'+s.id),btn('✏️','mg_rn_sem_'+spId+'_'+yrId+'_'+s.id),btn('🗑','mg_dl_sem_'+spId+'_'+yrId+'_'+s.id)]);
  rows.push([btn('➕ إضافة فصل','mg_add_sem_'+spId+'_'+yrId)]);
  rows.push(back('mg_yrs_'+spId));
  return eos(ctx,buildPath([escMd(sp?.name),escMd(yr?.name)])+'\n📆 الفصول',{parse_mode:'Markdown',...build(rows)});
}

async function showSubjects(ctx,spId,yrId,smId){
  const [sm,subs]=await Promise.all([content.getSemester(smId),content.getSubjects(smId)]);
  const rows=subs.map(s=>[btn('📖 '+s.name,'mg_cats_'+spId+'_'+yrId+'_'+smId+'_'+s.id),btn('✏️','mg_rn_sb_'+spId+'_'+yrId+'_'+smId+'_'+s.id),btn('🗑','mg_dl_sb_'+spId+'_'+yrId+'_'+smId+'_'+s.id)]);
  rows.push([btn('➕ إضافة مادة','mg_add_sb_'+spId+'_'+yrId+'_'+smId)]);
  rows.push(back('mg_sems_'+spId+'_'+yrId));
  return eos(ctx,'📆 *'+escMd(sm?.name)+'*\n📖 المواد',{parse_mode:'Markdown',...build(rows)});
}

async function showCategories(ctx,spId,yrId,smId,sbId){
  const [sb,cats]=await Promise.all([content.getSubject(sbId),content.getCategories(sbId)]);
  const rows=cats.map(c=>[btn('📁 '+c.name,'mg_fls_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+c.id),btn('✏️','mg_rn_cat_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+c.id),btn('🗑','mg_dl_cat_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+c.id)]);
  rows.push([btn('➕ إضافة فئة','mg_add_cat_'+spId+'_'+yrId+'_'+smId+'_'+sbId)]);
  rows.push(back('mg_sbs_'+spId+'_'+yrId+'_'+smId));
  return eos(ctx,'📖 *'+escMd(sb?.name)+'*\n📁 الفئات',{parse_mode:'Markdown',...build(rows)});
}
async function showMgFiles(ctx,spId,yrId,smId,sbId,catId,page=0){
  const [cat,list,total]=await Promise.all([content.getCategory(catId),filesDb.getFiles(catId,PS,page*PS),filesDb.countFiles(catId)]);
  let text='📁 *'+escMd(cat?.name)+'*\n━━━━━━━━━━━━\n'+(total?'📄 *'+total+' ملف*':'_لا توجد ملفات._');
  const rows=[];
  list.forEach(f=>{rows.push([btn('📄 '+f.title,'preview_'+f.id+'_0_0_0_0_0')]);rows.push([btn('✏️','mg_rn_fl_'+[spId,yrId,smId,sbId,catId,f.id].join('_')),btn('📝','mg_desc_fl_'+[spId,yrId,smId,sbId,catId,f.id].join('_')),btn('🗑','mg_dl_fl_'+[spId,yrId,smId,sbId,catId,f.id].join('_'))]);});
  if(total>PS){const nav=[];if(page>0)nav.push(btn('⬅️','mg_fls_pg_'+[spId,yrId,smId,sbId,catId,page-1].join('_')));nav.push(btn((page+1)+'/'+Math.ceil(total/PS),'noop'));if((page+1)*PS<total)nav.push(btn('➡️','mg_fls_pg_'+[spId,yrId,smId,sbId,catId,page+1].join('_')));rows.push(nav);}
  const bundles2=await bundlesDb.getBundles(catId);
  if(bundles2.length){rows.unshift([btn('━━━ الحزم ('+bundles2.length+') ━━━','noop')]);bundles2.forEach(b=>{rows.splice(1,0,[btn('📦 '+b.title,'bundle_view_'+b.id)]);});}
  const uploadRow=[btn('➕ رفع ملف','mg_upl_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId),btn('📤 رفع متعدد','mg_upl_bulk_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId)];
  if(ctx.isOwner) uploadRow.push(btn('📦 حزمة','mg_add_bundle_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId));
  rows.push(uploadRow);rows.push(back('mg_cats_'+spId+'_'+yrId+'_'+smId+'_'+sbId));
  return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});
}

async function showAnalytics(ctx){
  const _ckey="analytics_admin";const _cc=cacheGet(_ckey);if(_cc) return eos(ctx,_cc.text,{parse_mode:"Markdown",...build(_cc.rows)});
  const [top,recent,totalUsers,activeToday,totalFiles,totalDl,specs,totalGroups,topGroups]=await Promise.all([filesDb.topDownloaded(5),filesDb.recentFiles(5),usersDb.count(),usersDb.activeToday(),filesDb.totalFiles(),filesDb.totalDownloads(),content.getSpecs(),all('SELECT COUNT(*) as c FROM group_chats').then(r=>r[0]?.c||0),all('SELECT gc.title,sp.name as sp_name,COUNT(gm.user_id) as members FROM group_chats gc LEFT JOIN specialties sp ON gc.specialty_id=sp.id LEFT JOIN group_members gm ON gc.chat_id=gm.chat_id GROUP BY gc.chat_id,gc.title,sp.name ORDER BY members DESC LIMIT 5')]);
  const [spDist,topUsers,peakHours,topCats]=await Promise.all([all(`SELECT sp.name,COUNT(us.user_id) as cnt FROM user_specialties us LEFT JOIN specialties sp ON us.specialty_id=sp.id GROUP BY sp.name ORDER BY cnt DESC LIMIT 5`),all(`SELECT u.first_name,u.username,COUNT(h.id) as cnt FROM history h LEFT JOIN users u ON h.user_id=u.id GROUP BY h.user_id,u.first_name,u.username ORDER BY cnt DESC LIMIT 5`),all(`SELECT EXTRACT(HOUR FROM viewed_at) as hour,COUNT(*) as cnt FROM history GROUP BY hour ORDER BY cnt DESC LIMIT 3`),all(`SELECT c.name,COUNT(h.id) as cnt FROM history h LEFT JOIN files f ON h.file_id=f.id LEFT JOIN categories c ON f.category_id=c.id WHERE h.viewed_at >= NOW() - INTERVAL '7 days' GROUP BY c.name ORDER BY cnt DESC LIMIT 3`)]);
  let text='📊 *لوحة الإحصائيات المتقدمة*\n━━━━━━━━━━━━\n👥 المستخدمون: *'+totalUsers+'*\n🟢 نشطون اليوم: *'+activeToday+'*\n📁 الملفات: *'+totalFiles+'*\n⬇️ التحميلات: *'+totalDl+'*\n🎓 التخصصات: *'+specs.length+'*\n👥 القروبات: *'+totalGroups+'*\n';
  if(topGroups.length) topGroups.forEach((g,i)=>{text+=(i+1)+'. '+escMd(g.title||'بدون اسم')+' ('+(g.sp_name||'?')+') — *'+g.members+'*\n';});
  if(spDist.length){text+='\n🎓 *توزيع التخصصات:*\n';spDist.forEach((s,i)=>{text+=(i+1)+'. '+escMd(s.name||'غير محدد')+' — *'+s.cnt+'*\n';});}
  if(topUsers.length){text+='\n🏆 *الأكثر نشاطاً:*\n';topUsers.forEach((u,i)=>{text+=(i+1)+'. '+escMd(u.first_name||'?')+(u.username?' @'+escMd(u.username):'')+' — *'+u.cnt+'*\n';});}
  if(peakHours.length){text+='\n⏰ *أوقات الذروة:*\n';peakHours.forEach((h,i)=>{text+=(i+1)+'. *'+Math.round(h.hour)+':00* — *'+h.cnt+'*\n';});}
  if(topCats.length){text+='\n📁 *أكثر الفئات هذا الأسبوع:*\n';topCats.forEach((c,i)=>{text+=(i+1)+'. '+escMd(c.name||'?')+' — *'+c.cnt+'*\n';});}
  if(top.length){text+='\n🏆 *الأكثر تحميلاً:*\n';top.forEach((f,i)=>{text+=(i+1)+'. '+escMd(f.title)+' ⬇️*'+f.downloads+'*\n';});}
  if(recent.length){text+='\n🆕 *أحدث الملفات:*\n';recent.forEach((f,i)=>{text+=(i+1)+'. '+escMd(f.title)+'\n';});}
  const rows=[[btn('🔄 تحديث','mg_analytics')],back('mg_menu')];
  cacheSet(_ckey,{text,rows},600000);
  return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});
}

async function showLogs(ctx){const _lk='admin_logs';const _lc=cacheGet(_lk);const logs=_lc||await interactions.getLogs(20);if(!_lc) cacheSet(_lk,logs,60000);let text='📜 *آخر السجلات*\n\n';if(logs.length) logs.forEach(l=>{text+='• '+(escMd(l.first_name)||'ID:'+l.user_id)+': '+l.action+(l.details?' — '+l.details:'')+'\n';});else text+='_لا توجد سجلات._';return eos(ctx,text,{parse_mode:'Markdown',...build([back('mg_menu')])});}

async function showUsers(ctx, page=0, filter='all') {
  const uid = ctx.uid || ctx.from?.id;
  const perms = ctx.isOwner ? ['full'] : await require('../database/admins').getPerms(uid).catch(() => []);
  if (!perms.includes('full') && !perms.includes('view_users'))
    return ctx.answerCbQuery('ليس لديك صلاحية', { show_alert: true }).catch(() => {});

  page = parseInt(page) || 0;
  const limit = 10;
  const offset = page * limit;

  let whereClause = '';
  if (filter === 'banned') whereClause = 'WHERE is_banned=1';
  else if (filter === 'new')  whereClause = "WHERE joined_at >= NOW() - INTERVAL '1 day'";
  else                        whereClause = "WHERE last_active >= NOW() - INTERVAL '7 days'";

  const cacheKey = 'users_' + filter + '_' + page;
  let list, totalRow;
  const cached = cacheGet(cacheKey);
  if (cached) { list = cached.list; totalRow = cached.total; }
  else {
    [list, totalRow] = await Promise.all([
      all(`SELECT * FROM users ${whereClause} ORDER BY last_active DESC LIMIT $1 OFFSET $2`, [limit, offset]),
      all(`SELECT COUNT(*) as c FROM users ${whereClause}`).then(r => parseInt(r[0]?.c || 0)),
    ]);
    cacheSet(cacheKey, { list, total: totalRow }, 30000);
  }

  const totalPages = Math.ceil(totalRow / limit) || 1;
  const filterLabel = { all: '🟢 النشطون 7 أيام', banned: '🚫 المحظورون', new: '🆕 جدد اليوم' }[filter];

  const text =
    '👥 *المستخدمون — ' + filterLabel + '*\n' +
    '━━━━━━━━━━━━━━━━━━━━\n' +
    'الإجمالي: *' + totalRow + '* | صفحة ' + (page + 1) + '/' + totalPages;

  // فلاتر
  const filterRow = [
    btn(filter === 'all'    ? '✅ النشطون'  : '🟢 النشطون',   'mg_uf.all'),
    btn(filter === 'banned' ? '✅ محظورون'  : '🚫 محظورون',  'mg_uf.banned'),
    btn(filter === 'new'    ? '✅ جدد'      : '🆕 جدد',       'mg_uf.new'),
  ];

  // أزرار المستخدمين 2 × N
  const userBtns = list
    .filter(u => u.user_id || u.id)
    .map(u => {
      const uid3 = String(u.user_id || u.id);
      const icon = u.is_banned ? '🚫' : '👤';
      const rawName = (u.first_name || 'مجهول').replace(/[^\w\s؀-ۿ]/g, '').trim() || 'مجهول';
      const label = (icon + ' ' + rawName).substring(0, 20);
      return btn(label, 'mg_up_' + uid3);
    });
  const userRows = [];
  for (let i = 0; i < userBtns.length; i += 2)
    userRows.push(userBtns.slice(i, i + 2));

  // تنقل صفحات
  const navRow = [];
  if (page > 0)              navRow.push(btn('◀️', 'mg_upg_' + filter + '_' + (page - 1)));
  if ((page + 1) < totalPages) navRow.push(btn('▶️', 'mg_upg_' + filter + '_' + (page + 1)));

  const rows = [filterRow, ...userRows];
  if (navRow.length) rows.push(navRow);
  rows.push([back('mg_main')[0]]);

  return eos(ctx, text, { parse_mode: 'Markdown', ...build(rows) });
}


async function showUserProfile(ctx, userId) {
  userId = String(userId);
  const [user, dlCount, favCount, spRow, lastFile] = await Promise.all([
    usersDb.getById(userId),
    interactions.getUserDownloadCount(userId),
    require('../database/db').get('SELECT COUNT(*) as c FROM favorites WHERE user_id=$1', [userId]).then(r => r?.c || 0),
    usersDb.getSpecialty(userId),
    interactions.getLastFile(userId),
  ]);
  if (!user) return ctx.reply('❌ المستخدم غير موجود.').catch(() => {});

  const spId = spRow?.specialty_id;
  const sp   = spId && spId != 0 ? await content.getSpec(spId) : null;

  const text =
    '👤 *بروفايل المستخدم*\n\n' +
    '🆔 ID: `' + userId + '`\n' +
    '👋 الاسم: ' + escMd(user.first_name || '؟') + ' ' + (user.last_name ? escMd(user.last_name) : '') + '\n' +
    (user.username ? '📛 @' + escMd(user.username) + '\n' : '') +
    '📅 انضم: ' + (user.joined_at ? new Date(user.joined_at).toLocaleDateString('en-GB') : '؟') + '\n' +
    '🕐 آخر نشاط: ' + (user.last_active ? new Date(user.last_active).toLocaleDateString('en-GB') : '؟') + '\n' +
    '🎓 التخصص: *' + escMd(sp ? sp.name : 'غير محدد') + '*\n' +
    '🚫 محظور: ' + (user.is_banned ? 'نعم ⛔' : 'لا ✅') + '\n\n' +
    '📊 *النشاط:*\n' +
    '⬇️ التحميلات: *' + dlCount + '*\n' +
    '⭐ المفضلة: *' + favCount + '*' +
    (lastFile ? '\n📄 آخر ملف: *' + escMd(lastFile.title) + '*' : '');

  const rows = [
    [
      btn(user.is_banned ? '✅ إلغاء الحظر' : '🚫 حظر', (user.is_banned ? 'mg_unban_' : 'mg_ban_') + userId),
      btn('💬 تواصل', 'mg_contact_' + userId),
    ],
    [back('mg_users')[0]],
  ];
  return eos(ctx, text, { parse_mode: 'Markdown', ...build(rows) });
}


const PERM_LABELS={upload:'📤 رفع',delete:'🗑 حذف',add_content:'➕ إضافة محتوى',view_users:'👥 مشاهدة المستخدمين',full:'👑 كل الصلاحيات'};

async function showEditPerms(ctx, adminId) {
  const list = await adminsDb.getAll();
  const admin = list.find(a => a.user_id == adminId);
  if (!admin) return ctx.reply('❌ المشرف غير موجود').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  const currentPerms = (admin.permissions || '').split(',').map(p => p.trim());
  const name = admin.first_name || 'ID:' + adminId;
  let text = '\u2699\ufe0f *\u0635\u0644\u0627\u062d\u064a\u0627\u062a ' + escMd(name) + '*\n';
  if (admin.username) text += '@' + escMd(admin.username) + '\n';
  text += '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n';
  text += '_اضغط لتفعيل/تعطيل الصلاحية:_';

  const rows = ALL_PERMS.map(p => [{
    text: (currentPerms.includes(p) ? '✅ ' : '☐ ') + (PERM_LABELS[p] || p),
    callback_data: 'mg_tp_' + adminId + '_' + p
  }]);

  // زر تخصص المشرف
  rows.push([btn('🎓 تحديد التخصص', 'mg_admin_sp_select_' + adminId)]);
  rows.push([btn('🗑 حذف المشرف', 'mg_da_' + adminId), btn('◀️ رجوع', 'mg_admins')]);
  return eos(ctx, text, { parse_mode: 'Markdown', ...build(rows) });
}

async function showAdmins(ctx){const list=await adminsDb.getAll();let text='👑 *الإداريون ('+list.length+')*\n\n';const rows=list.map(a=>{const perms=(a.permissions||'upload,add_content').split(',').map(p=>PERM_LABELS[p.trim()]||p).join(' | ');text+='• '+(escMd(a.first_name||'ID:'+a.user_id))+(a.username?' @'+escMd(a.username):'')+'\n  🔑 '+perms+'\n';return [btn('⚙️ '+(a.first_name||a.user_id),'mg_ep_'+a.user_id),btn('🗑','mg_da_'+a.user_id)];});rows.push([btn('➕ إضافة مشرف','mg_add_admin')]);rows.push(back('mg_menu'));return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});}

async function showTrash(ctx){const list=await filesDb.getTrash();let text='🗑 *سلة المحذوفات ('+list.length+')*\n\n';if(!list.length) text+='_فارغة._';const rows=list.map(f=>[btn('📄 '+f.title,'noop'),btn('استعادة','mg_restore_fl_'+f.id)]);if(list.length) rows.push([btn('حذف الكل نهائياً','mg_empty_trash')]);rows.push(back('mg_menu'));return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});}

async function showMsgsMenu(ctx){const templates=await messagesDb.getTemplates();const scheduled=await messagesDb.getScheduled();const text='📨 *نظام الرسائل*\n\n📝 القوالب: *'+templates.length+'*\n📅 المجدولة: *'+scheduled.length+'*';const rows=[[btn('📝 القوالب','mg_templates'),btn('📅 المجدولة','mg_scheduled')],[btn('➕ قالب جديد','mg_add_template')],back('mg_menu')];return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});}
async function showTemplates(ctx){const list=await messagesDb.getTemplates();const text='📝 *القوالب ('+list.length+')*';const rows=list.map(t=>[btn(t.name,'mg_tpl_'+t.id)]);rows.push([btn('➕ قالب جديد','mg_add_template')]);rows.push(back('mg_msgs'));return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});}
async function showScheduled(ctx){const list=await messagesDb.getScheduled();const text='📅 *المجدولة ('+list.length+')*';const rows=list.map(s=>[btn((s.name||'رسالة')+' — '+s.send_at,'noop'),btn('🗑','mg_del_sched_'+s.id)]);rows.push(back('mg_msgs'));return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});}
async function handleBundleFileUpload(ctx){
  const uid=ctx.uid;const state=require('../utils/stateManager').getState(uid);
  if(!state||state.type!=='mg_bundle_files') return false;
  const msg=ctx.message;let fid=null,ftype=null,title='';
  if(msg.document){fid=msg.document.file_id;ftype='document';title=msg.document.file_name||'📄 ملف';}
  else if(msg.photo){fid=msg.photo[msg.photo.length-1].file_id;ftype='photo';title='🖼️ صورة';}
  else if(msg.video){fid=msg.video.file_id;ftype='video';title='🎥 فيديو';}
  else if(msg.audio){fid=msg.audio.file_id;ftype='audio';title='🎵 صوت';}
  else if(msg.voice){fid=msg.voice.file_id;ftype='voice';title='🎤 تسجيل صوتي';}
  if(!fid){const txt=(msg.text||'').trim();const urlMatch=txt.match(/https?:\/\/[^\s]+/)||txt.match(/www\.[^\s]+/);if(urlMatch){fid=urlMatch[0];ftype='link';title='🔗 '+urlMatch[0].substring(0,35)+(urlMatch[0].length>35?'...':'');}}
  if(!fid) return false;
  await bundlesDb.addBundleFile(state.bundleId,fid,ftype,title);
  state.fileCount=(state.fileCount||0)+1;
  const icons={link:'🔗',photo:'🖼️',video:'🎥',audio:'🎵',voice:'🎤',document:'📄'};
  await ctx.reply((icons[ftype]||'📄')+' ملف '+state.fileCount+' تم الحفظ. ابعث المزيد أو /done.');
  return true;
}

async function handleBulkUpload(ctx){
  const uid=ctx.uid;const state=require('../utils/stateManager').getState(uid);
  if(!state||state.type!=='mg_bulk_files') return false;
  const msg=ctx.message;let fid,ftype,title='';
  if(msg.document){fid=msg.document.file_id;ftype='document';title=msg.document.file_name||msg.caption||('ملف_'+Date.now());title=title.replace(/.[^/.]+$/,'').trim()||('ملف_'+Date.now());}
  else if(msg.photo){fid=msg.photo[msg.photo.length-1].file_id;ftype='photo';title=msg.caption||('صورة_'+Date.now());}
  else if(msg.video){fid=msg.video.file_id;ftype='document';title=msg.video.file_name||msg.caption||('فيديو_'+Date.now());title=title.replace(/.[^/.]+$/,'').trim()||('فيديو_'+Date.now());}
  else if(msg.audio){fid=msg.audio.file_id;ftype='document';title=msg.audio.title||msg.audio.file_name||msg.caption||('صوت_'+Date.now());}
  else return false;
  const finalTitle=state.prefix?state.prefix+' — '+title:title;
  try{await filesDb.addFile(state.catId,finalTitle,'',fid,ftype,uid);state.uploaded=state.uploaded||[];state.uploaded.push(finalTitle);ctx.reply('✅ '+finalTitle).catch(err => { require('../utils/logger').debug("[silent]", err.message); });}
  catch(e){state.failed=state.failed||[];state.failed.push(finalTitle+(e.message==='exists'?' (موجود)':''));}
  return true;
}

async function handleFileUpload(ctx){
  if(await handleBundleFileUpload(ctx)) return;
  const uid=ctx.uid;const state=require('../utils/stateManager').getState(uid);
  if(!state||state.type!=='mg_file') return;
  const msg=ctx.message;let fid,ftype;let msgText=(msg.text||msg.caption||'').trim();
  const isLink=msg.entities?.some(e=>e.type==='url'||e.type==='text_link')||msgText.startsWith('http');
  if(msg.document){fid=msg.document.file_id;ftype='document';}
  else if(msg.photo){fid=msg.photo[msg.photo.length-1].file_id;ftype='photo';}
  else if(msg.video){fid=msg.video.file_id;ftype='video';}
  else if(msg.audio){fid=msg.audio.file_id;ftype='document';}
  else if(msg.voice){fid=msg.voice.file_id;ftype='document';}
  else if(isLink){fid=msgText;ftype='link';}
  else return ctx.reply('ارسل ملف او رابط. او /cancel');
  try{
    const newFile=await filesDb.addFile(state.catId,state.title,state.desc||'',fid,ftype,uid);
    await interactions.addLog(uid,'upload',state.title);clearState(uid);
    if(newFile&&global.__bot) {
      notifyGroupsNewFile(global.__bot,newFile).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      // نشر في القناة الرسمية
      if(process.env.CHANNEL_ID) {
        const { postToChannel } = require('../utils/groupNotify');
        postToChannel(global.__bot, newFile).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      }
    }
    ctx.reply('✅ *'+escMd(state.title)+'* رُفع بنجاح!',{parse_mode:'Markdown',...build([[btn('➕ رفع آخر','mg_upl_'+state.spId+'_'+state.yrId+'_'+state.smId+'_'+state.sbId+'_'+state.catId)],[btn('📁 عرض الملفات','mg_fls_'+state.spId+'_'+state.yrId+'_'+state.smId+'_'+state.sbId+'_'+state.catId)]])});
  }catch(e){clearState(uid);ctx.reply(e.message==='exists'?'❌ يوجد ملف بهذا الاسم!':'❌ فشل: '+e.message);}
}
async function handleText(ctx,state){
  const uid=ctx.uid;const text=ctx.message.text?.trim()||ctx.message.caption?.trim()||'';
  if(text==='/cancel'){clearState(uid);return ctx.reply('تم الإلغاء.',build([back('mg_menu')]));}
  const done=(msg,cb)=>{clearState(uid);ctx.reply(msg,{parse_mode:'Markdown',...build([[btn('◀️ رجوع',cb)]])});};
  
  // احفظ الوسائط في الـ state
  if(state.type==='mg_notify_groups_msg'||state.type==='mg_msg_user_content'){
    const msg=ctx.message;
    if(msg.photo){state.mediaFileId=msg.photo[msg.photo.length-1].file_id;state.mediaType="photo";if(msg.caption)state.mediaCaption=msg.caption;}
    else if(msg.video){state.mediaFileId=msg.video.file_id;state.mediaType="video";if(msg.caption)state.mediaCaption=msg.caption;}
    else if(msg.document){state.mediaFileId=msg.document.file_id;state.mediaType="document";if(msg.caption)state.mediaCaption=msg.caption;}
    else if(msg.sticker){state.mediaFileId=msg.sticker.file_id;state.mediaType="sticker";}
    await require('../utils/stateManager').setState(uid,state);
  }

  try{
    switch(state.type){
      case 'mg_add_sp':await content.addSpec(text);done('✅ تم إضافة *'+escMd(text)+'*!','mg_content');break;
case '/cancel':clearState(uid);return ctx.reply('تم الإلغاء.',build([back('mg_menu')]));break;
      case 'mg_rn_sp':await content.renameSpec(state.id,text);done('✅ تمت التسمية!','mg_content');break;
      case 'mg_add_yr':await content.addYear(state.spId,text);done('✅ تمت الإضافة!','mg_yrs_'+state.spId);break;
      case 'mg_rn_yr':await content.renameYear(state.id,text);done('✅ تمت التسمية!','mg_yrs_'+state.spId);break;
      case 'mg_add_sem':await content.addSemester(state.yrId,text);done('✅ تمت الإضافة!','mg_sems_'+state.spId+'_'+state.yrId);break;
      case 'mg_rn_sem':await content.renameSemester(state.id,text);done('✅ تمت التسمية!','mg_sems_'+state.spId+'_'+state.yrId);break;
      case 'mg_add_sb':await content.addSubject(state.smId,text);done('✅ تمت الإضافة!','mg_sbs_'+state.spId+'_'+state.yrId+'_'+state.smId);break;
      case 'mg_rn_sb':await content.renameSubject(state.id,text);done('✅ تمت التسمية!','mg_sbs_'+state.spId+'_'+state.yrId+'_'+state.smId);break;
      case 'mg_add_cat':await content.addCategory(state.sbId,text);done('✅ تمت الإضافة!','mg_cats_'+state.spId+'_'+state.yrId+'_'+state.smId+'_'+state.sbId);break;
      case 'mg_rn_cat':await content.renameCategory(state.id,text);done('✅ تمت التسمية!','mg_cats_'+state.spId+'_'+state.yrId+'_'+state.smId+'_'+state.sbId);break;
      case 'mg_rename_bundle':await bundlesDb.renameBundle(state.bundleId,text);clearState(uid);ctx.reply('✅ تم تعديل الاسم',build([[btn('◀️ رجوع','mg_fls_'+[state.spId,state.yrId,state.smId,state.sbId,state.catId].join('_'))]]));break;
      case 'mg_bundle_title':setState(uid,{...state,type:'mg_bundle_desc',title:text});ctx.reply('📝 وصف الحزمة (أو skip):');break;
      case 'mg_bundle_desc':try{const bid=await bundlesDb.addBundle(state.catId,state.title,text==='skip'?'':text,uid);setState(uid,{...state,type:'mg_bundle_files',bundleId:bid,fileCount:0});ctx.reply('✅ تم إنشاء الحزمة! ابعث الملفات أو /done');}catch(e){clearState(uid);ctx.reply(e.message==='exists'?'حزمة موجودة':'خطأ: '+e.message);}break;
      case 'mg_upl_title':setState(uid,{...state,type:'mg_upl_desc',title:text});ctx.reply('📝 الوصف (أو *skip*):',{parse_mode:'Markdown'});break;
      case 'mg_bulk_prefix':setState(uid,{...state,type:'mg_bulk_files',prefix:text==='skip'?'':text,uploaded:[],failed:[]});ctx.reply('ارسل الملفات. /done للانتهاء.');break;
      case 'mg_upl_desc':setState(uid,{...state,type:'mg_file',desc:text==='skip'?'':text,catId:state.catId});ctx.reply('📎 أرسل الملف:\n_(أو /cancel)_',{parse_mode:'Markdown'});break;
      case 'mg_rn_fl':await filesDb.rename(state.id,text);done('✅ تمت التسمية!','mg_fls_'+[state.spId,state.yrId,state.smId,state.sbId,state.catId].join('_'));break;
      case 'mg_desc_fl':await filesDb.updateDesc(state.id,text);done('✅ تم التحديث!','mg_fls_'+[state.spId,state.yrId,state.smId,state.sbId,state.catId].join('_'));break;
      case 'mg_admin_search':{clearState(uid);const [fr,ur]=await Promise.all([filesDb.search(text),usersDb.searchUsers(text)]);let resp='🔍 *بحث: "'+escMd(text)+'"*\n\n';if(fr.length){resp+='📄 *ملفات ('+fr.length+'):*\n';fr.slice(0,5).forEach(f=>{resp+='• '+escMd(f.title)+' ('+escMd(f.sub_name)+')\n';});}if(ur.length){resp+='\n👥 *مستخدمون ('+ur.length+'):*\n';ur.slice(0,5).forEach(u=>{resp+='• '+escMd(u.first_name||'ID:'+u.id)+(u.username?' @'+escMd(u.username):'')+'\n';});}if(!fr.length&&!ur.length) resp+='_لا نتائج._';ctx.reply(resp,{parse_mode:'Markdown',...build([back('mg_menu')])});break;}
      case 'mg_set_welcome':
        clearState(uid);
        if(text==='/cancel')return ctx.reply('❌ تم الإلغاء').catch(()=>{});
        await require('../database/db').run("INSERT INTO settings(key,value) VALUES('start_welcome_text',$1) ON CONFLICT(key) DO UPDATE SET value=$1",[text]).catch(()=>{});
        ctx.reply('✅ تم حفظ رسالة /start!',{parse_mode:'Markdown'}).catch(()=>{});
        return handleCallback(ctx,'mg_bot_settings');
      case 'mg_broadcast':{clearState(uid);const ids=await usersDb.allIds();const total_bc=ids.length;const sm=await ctx.reply('📢 *جاري الإرسال...*\n`[░░░░░░░░░░] 0%`\n✅ 0 | ❌ 0 | ⏳ '+total_bc,{parse_mode:'Markdown'});const bcRes=await concurrentBroadcast(ctx.telegram,ctx.chat.id,sm.message_id,ids,'📢 *إعلان*\n\n'+text,{parse_mode:'Markdown'});ctx.telegram.editMessageText(ctx.chat.id,sm.message_id,null,'✅ *اكتمل!*\n`[██████████] 100%`\n✅ '+bcRes.sent+' | ❌ '+bcRes.failed,{...build([back('mg_menu')]),parse_mode:'Markdown'}).catch(err => { require('../utils/logger').debug("[silent]", err.message); });break;}
      case 'mg_msg_user_id':{setState(uid,{...state,type:'mg_msg_user_content',targetId:text.replace('@','')});ctx.reply('📝 ارسل الرسالة (نص، صورة، فيديو، sticker، voice):',{parse_mode:'Markdown'});break;}
      case 'mg_msg_user_content':{
        clearState(uid);
        const tId = parseInt(state.targetId);
        if(isNaN(tId)) { ctx.reply('❌ ID غير صحيح.'); break; }
        const msgTxt = '📩 *رسالة من الإدارة*\n\n' + (state.mediaCaption || text || '');
        const mFid   = state.mediaFileId || null;
        const mType  = state.mediaType   || null;
        try {
          if      (mType==='photo'    && mFid) await ctx.telegram.sendPhoto   (tId, mFid, {caption: msgTxt, parse_mode:'Markdown'});
          else if (mType==='video'    && mFid) await ctx.telegram.sendVideo   (tId, mFid, {caption: msgTxt, parse_mode:'Markdown'});
          else if (mType==='document' && mFid) await ctx.telegram.sendDocument(tId, mFid, {caption: msgTxt, parse_mode:'Markdown'});
          else if (mType==='sticker'  && mFid) await ctx.telegram.sendSticker (tId, mFid);
          else if (mType==='voice'    && mFid) await ctx.telegram.sendVoice   (tId, mFid);
          else await ctx.telegram.sendMessage(tId, msgTxt, {parse_mode:'Markdown'});
          ctx.reply('✅ تم الإرسال للمستخدم ' + tId, {parse_mode:'Markdown', ...build([back('mg_menu')])});
        } catch(e) {
          ctx.reply('❌ فشل الإرسال: ' + e.message + '\nتحقق من الـ ID أو أن المستخدم لم يحجب البوت.', build([back('mg_menu')]));
        }
        break;}
      case 'mg_notify_sp_msg':{clearState(uid);const spUsers=await usersDb.getUsersBySpecialty(state.spId);await safeAdd(broadcastQueue,'broadcast-sp',{userIds:spUsers,message:'🔔 '+text,parseMode:'Markdown',fromUid:uid});ctx.reply('📤 جاري الإرسال لـ *'+spUsers.length+'* مستخدم — ستصلك النتيجة',{parse_mode:'Markdown',...build([back('mg_menu')])});break;}
      case 'mg_notify_groups_msg':{
        clearState(uid);
        const groups=state.spId==='0'?await all('SELECT chat_id FROM group_chats'):await all('SELECT chat_id FROM group_chats WHERE specialty_id=$1',[state.spId]);
        let gSent=0,gFail=0;
        const msgText='📣 *إشعار*\n\n'+(state.mediaCaption||text);

        const mFileId=state.mediaFileId||null;
        const mType=state.mediaType||null;
        // إرسال بـ chunks لتسريع الـ broadcast
        const CHUNK = 5;
        for(let ci=0;ci<groups.length;ci+=CHUNK){
          const chunk = groups.slice(ci,ci+CHUNK);
          const results = await Promise.allSettled(chunk.map(async g=>{
            if(mType==='photo'&&mFileId) return ctx.telegram.sendPhoto(g.chat_id,mFileId,{caption:msgText,parse_mode:'Markdown'});
            else if(mType==='video'&&mFileId) return ctx.telegram.sendVideo(g.chat_id,mFileId,{caption:msgText,parse_mode:'Markdown'});
            else if(mType==='document'&&mFileId) return ctx.telegram.sendDocument(g.chat_id,mFileId,{caption:msgText,parse_mode:'Markdown'});
            else if(mType==='sticker'&&mFileId) return ctx.telegram.sendSticker(g.chat_id,mFileId);
            else if(mType==='voice'&&mFileId) return ctx.telegram.sendVoice(g.chat_id,mFileId);
            else return ctx.telegram.sendMessage(g.chat_id,msgText,{parse_mode:'Markdown'});
          }));
          results.forEach(r=>r.status==='fulfilled'?gSent++:gFail++);
          if(ci+CHUNK<groups.length) await new Promise(r=>setTimeout(r,1000));
        }
        ctx.reply('✅ أُرسل لـ *'+gSent+'* قروب'+(gFail?' | ❌ '+gFail:''),{parse_mode:'Markdown',...build([back('mg_menu')])});
        break;}
      case 'mg_notify_msg':{clearState(uid);const nIds=await interactions.getActiveUsers(7);await safeAdd(broadcastQueue,'broadcast-all',{userIds:nIds,message:'🔔 *إشعار*\n\n'+text,parseMode:'Markdown',fromUid:uid});ctx.reply('📤 جاري الإرسال لـ *'+nIds.length+'* مستخدم — ستصلك النتيجة لما ينتهي',{parse_mode:'Markdown',...build([back('mg_menu')])});break;}
      case 'mg_add_admin_id':{const tid=parseInt(text);if(isNaN(tid)){clearState(uid);return ctx.reply('❌ ID غير صحيح.');}await adminsDb.add(tid,uid);await interactions.addLog(uid,'add_admin','ID: '+tid);if(global.invalidateAdmin) global.invalidateAdmin(tid);const specs=await content.getSpecs();const spRows=specs.map(s=>[btn('🎓 '+s.name,'mg_admin_sp_'+tid+'_'+s.id)]);spRows.push([btn('كل التخصصات','mg_admin_sp_'+tid+'_0')]);clearState(uid);ctx.reply('اختر تخصص المشرف:',{...build(spRows)});try{ctx.telegram.sendMessage(tid,'🎉 تمت إضافتك مشرفاً',{parse_mode:'Markdown'});}catch(_){}break;}
      case 'mg_maint_msg':global.maintenanceModeMsg=text;clearState(uid);ctx.reply('✅ تم تحديث رسالة الصيانة',build([back('mg_menu')]));break;
      case 'mg_gs_edit': {
        const { run: dbRun2 } = require('../database/db');
        await dbRun2(
          'INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2',
          [state.key, text]
        ).catch(()=>{});
        clearState(uid);
        await ctx.reply('✅ تم الحفظ!').catch(()=>{});
        return showGamesSettings(ctx);
      }

      case 'mg_bank_add_id': {
        const targetId = parseInt(text);
        if(!targetId || isNaN(targetId)) {
          return ctx.reply('❌ ID غير صحيح، أرسل رقم ID فقط').catch(()=>{});
        }
        const { get: dbG } = require('../database/db');
        const acc = await dbG('SELECT * FROM bank_accounts WHERE user_id=$1',[targetId]).catch(()=>null);
        if(!acc) {
          return ctx.reply('❌ هذا المستخدم ليس لديه حساب بنكي').catch(()=>{});
        }
        setState(uid, { type:'mg_bank_add_amount', targetId, targetName: acc.first_name||String(targetId) });
        return ctx.reply(
          '🏦 المستخدم: *' + (acc.first_name||targetId) + '*\n💰 رصيده الحالي: *' + Number(acc.balance).toLocaleString('en') + ' $*\n\nأرسل المبلغ المراد إضافته:',
          { parse_mode:'Markdown', ...build([[btn('❌ إلغاء','mg_bank_panel')]]) }
        ).catch(()=>{});
      }
      case 'mg_bank_add_amount': {
        const amount = parseInt(text);
        if(!amount || isNaN(amount) || amount === 0) {
          return ctx.reply('❌ أرسل رقم صحيح (يمكن أن يكون سالباً للخصم)').catch(()=>{});
        }
        const { run: dbR, get: dbG } = require('../database/db');
        await dbR('UPDATE bank_accounts SET balance=balance+$1 WHERE user_id=$2',[amount, state.targetId]);
        await dbR("INSERT INTO bank_transactions(from_id,to_id,amount,type,note) VALUES(0,$1,$2,'admin','إضافة يدوية من الأدمن')",[state.targetId, Math.abs(amount)]);
        const newAcc = await dbG('SELECT balance FROM bank_accounts WHERE user_id=$1',[state.targetId]).catch(()=>null);
        setState(uid, null);
        // إشعار المستخدم
        ctx.telegram.sendMessage(state.targetId,
          (amount>0?'💰 *تم إضافة ':'💸 *تم خصم ') + Math.abs(amount).toLocaleString('en') + ' $ ' + (amount>0?'لحسابك':'من حسابك') + ' من الإدارة*\n🏦 رصيدك الجديد: *' + Number(newAcc?.balance||0).toLocaleString('en') + ' $*',
          { parse_mode:'Markdown' }
        ).catch(()=>{});
        return ctx.reply(
          '✅ *تم!*\n👤 ' + (state.targetName||state.targetId) + '\n' + (amount>0?'➕ أضيف: ':'➖ خُصم: ') + '*' + Math.abs(amount).toLocaleString('en') + ' $*\n💰 الرصيد الجديد: *' + Number(newAcc?.balance||0).toLocaleString('en') + ' $*',
          { parse_mode:'Markdown', ...build([[btn('◀️ رجوع','mg_bank_panel')]]) }
        ).catch(()=>{});
      }

            case 'mg_ar_search': {
        const results = await all(
          "SELECT * FROM auto_replies WHERE is_active=1 AND (trigger ILIKE $1 OR response ILIKE $1) LIMIT 10",
          ['%' + text + '%']
        ).catch(() => []);
        clearState(uid);
        if (!results.length) {
          return eos(ctx, '🔍 لم يُعثر على نتائج لـ: *' + escMd(text) + '*', {
            parse_mode:'Markdown', ...build([[btn('◀️ رجوع','mg_auto_replies')]])
          });
        }
        const tIcon = { exact:'🎯', regex:'⚙️', contains:'🔍' };
        const rows = results.map(r => [btn((tIcon[r.match_type]||'🔍')+' '+r.trigger.substring(0,25), 'mg_ar_view_'+r.id)]);
        rows.push([btn('◀️ رجوع','mg_auto_replies')]);
        return eos(ctx, '🔍 *' + results.length + ' نتيجة*', { parse_mode:'Markdown', ...build(rows) });
      }

            case 'mg_ar_trigger': {
        setState(uid, { type: 'mg_ar_response', trigger: text });
        return eos(ctx,
          '🤖 *إضافة رد تلقائي*\n\n' +
          '✅ الكلمة: `' + escMd(text) + '`\n\n' +
          'الخطوة 2/3: أرسل الرد التلقائي:',
          { parse_mode: 'Markdown', ...build([
            [btn('❌ إلغاء','mg_auto_replies')]
          ]) }
        );
      }
      case 'mg_ar_response_media': {
        // رد بمحتوى (تمت معالجته في handleMedia)
        break;
      }
      case 'mg_ar_response': {
        const trigger = state.trigger;
        const matchType = state.matchType || 'contains';
        // نص عادي فقط — الوسائط تُعالج في handleMedia/sticker handlers
        await dbRun(
          'INSERT INTO auto_replies(trigger,response,match_type,resp_type,file_id,created_by) VALUES($1,$2,$3,$4,$5,$6)',
          [trigger, text, matchType, 'text', null, uid]
        ).catch(()=>{});
        cacheClear('auto_replies_all');
        clearState(uid);
        await ctx.reply(
          '✅ *تم حفظ الرد التلقائي!*\n\n' +
          '🔍 عند: `' + escMd(trigger) + '`\n' +
          '↩️ الرد: ' + escMd(text.substring(0,50)),
          { parse_mode: 'Markdown' }
        ).catch(()=>{});
        return showAutoReplies(ctx);
      }
      case 'mg_awaiting_channel': {
        // دعم: @username أو رابط أو forward
        const fwd = ctx.message?.forward_from_chat;
        let cid, nm, url;

        if (fwd) {
          // أُرسل forward من قناة
          cid = fwd.username ? '@' + fwd.username : String(fwd.id);
          nm  = fwd.title || cid;
          url = fwd.username ? 'https://t.me/' + fwd.username : '';
        } else {
          const parts = text.trim().split(/\s+/);
          const cidRaw = parts[0];
          nm = parts.slice(1).join(' ') || cidRaw;
          cid = cidRaw.startsWith('@') ? cidRaw
            : cidRaw.startsWith('https://t.me/') ? '@' + cidRaw.replace('https://t.me/','').split('/')[0]
            : cidRaw.startsWith('-') ? cidRaw
            : '@' + cidRaw;
          url = cid.startsWith('@') ? 'https://t.me/' + cid.replace('@','') : cidRaw;
        }

        // تحقق إذا البوت ادمن في القناة
        const { addChannel, validateBotInChannel } = require('../utils/channelGuard');
        const bot = global.__bot || { telegram: ctx.telegram };

        // القنوات الخاصة (invite link) نضيفها مباشرة مع تحذير
        const isPrivate = cid.startsWith('+') || cid.includes('/+');
        let adminWarning = null;

        if (!isPrivate) {
          const valid = await validateBotInChannel(bot, cid).catch(() => ({ ok: true }));
          if (!valid.ok) {
            adminWarning = '⚠️ *تنبيه:* البوت مش ادمن في هذه القناة\nالفحص لن يعمل حتى تضيفه كادمن!';
          }
        }

        await addChannel(cid, nm, url, bot).catch(e => { clearState(uid); return ctx.reply('❌ ' + e.message).catch(()=>{}); });
        clearState(uid);
        cacheClear('required_channels');
        let successMsg = '✅ *تمت إضافة القناة بنجاح!*\n\n' +
          '📢 الاسم: *' + nm + '*\n' +
          '🆔 المعرف: `' + cid + '`\n' +
          '🔗 الرابط: ' + (url || 'قناة خاصة') + '\n';
        if (adminWarning) successMsg += '\n' + adminWarning;
        await ctx.reply(successMsg, { parse_mode: 'Markdown' }).catch(()=>{});
        return showChannelsMenu(ctx);
      }
      case 'mg_awaiting_ad_title': {
        setState(uid, { type: 'mg_awaiting_ad_body', adTitle: text });
        return ctx.reply('📝 أرسل نص الإعلان (أو /skip للتخطي):', { parse_mode: 'Markdown', ...build([[btn('⏭ تخطي', 'mg_skip_adbody')]]) }).catch(()=>{});
      }
      case 'mg_awaiting_ad_body': {
        const title = state.adTitle || 'إعلان';
        await dbRun('INSERT INTO ads(title,body,created_by) VALUES($1,$2,$3)', [title, text, uid]).catch(()=>{});
        clearState(uid);
        await ctx.reply('✅ *تم حفظ الإعلان!*', { parse_mode: 'Markdown' }).catch(()=>{});
        return showAdsMenu(ctx);
      }
      case 'mg_tpl_name':setState(uid,{...state,type:'mg_tpl_content',name:text,tplType:'auto',fileId:''});ctx.reply('📨 *'+escMd(text)+'*\n\nأرسل محتوى الرسالة:',{parse_mode:'Markdown',...build([[btn('❌ إلغاء','mg_templates')]])});break;
      case 'mg_tpl_content':{try{const msg2=ctx.message;let tplType='text',fileId='',tplContent=text||'';if(msg2.photo){tplType='photo';fileId=msg2.photo[msg2.photo.length-1].file_id;tplContent=msg2.caption||'';}else if(msg2.document){tplType='document';fileId=msg2.document.file_id;tplContent=msg2.caption||'';}else if(msg2.video){tplType='video';fileId=msg2.video.file_id;tplContent=msg2.caption||'';}else if(msg2.audio){tplType='audio';fileId=msg2.audio.file_id;tplContent=msg2.caption||'';}else if(text&&(text.startsWith('http')||text.startsWith('www'))){tplType='link';fileId=text;tplContent=text;}await messagesDb.addTemplate(state.name,tplType,tplContent,fileId);const savedTpl=await messagesDb.getTemplates();const lastTpl=savedTpl[0];clearState(uid);ctx.reply('✅ *تم حفظ القالب!*\nالنوع: '+tplType,{parse_mode:'Markdown',...build([[btn('📤 إرسال الآن','mg_send_now_'+lastTpl.id)],[btn('👥 كل المستخدمين','mg_sched_all_'+lastTpl.id)],[btn('🎓 تخصص معين','mg_sched_sp_'+lastTpl.id)],[btn('💾 حفظ فقط','mg_templates')]])});}catch(e){clearState(uid);ctx.reply(e.message==='exists'?'❌ قالب موجود!':'❌ '+e.message);}break;}
      case 'mg_sched_time':{try{await messagesDb.addScheduled(state.tplId,state.target,state.spId||0,text);clearState(uid);ctx.reply('✅ تمت الجدولة!',build([[btn('📅 المجدولة','mg_scheduled')]]));}catch(e){clearState(uid);ctx.reply('❌ '+e.message);}break;}
      default:break;
    }
  }catch(e){clearState(uid);ctx.reply(e.message==='exists'?'❌ موجود!':'❌ '+e.message);}
  // ── تواصل مع مستخدم ──
  if (state && state.type === 'admin_contact') {
    const targetId = state.targetId;
    const msg = ctx.message;
    try {
      if (msg.photo) {
        const fid = msg.photo[msg.photo.length - 1].file_id;
        await ctx.telegram.sendPhoto(targetId, fid, { caption: msg.caption || '' });
      } else if (msg.video) {
        await ctx.telegram.sendVideo(targetId, msg.video.file_id, { caption: msg.caption || '' });
      } else if (msg.sticker) {
        await ctx.telegram.sendSticker(targetId, msg.sticker.file_id);
      } else if (msg.document) {
        await ctx.telegram.sendDocument(targetId, msg.document.file_id, { caption: msg.caption || '' });
      } else if (text) {
        await ctx.telegram.sendMessage(targetId, text);
      }
      await clearState(uid);
      await ctx.reply('✅ تم الإرسال!', build([[btn('◀️ رجوع للبروفايل', 'mg_up_' + targetId)]]));
    } catch(_) {
      await ctx.reply('❌ فشل الإرسال — المستخدم ربما حظر البوت.');
    }
    return true;
  }

  // ── wizard إضافة سؤال مليون ──
  if (state && state.type === 'mq_wizard_q') {
    await setState(uid, { type:'mq_wizard_a', question: text });
    return ctx.reply('✅ السؤال حُفظ!\n\n📝 الخطوة 2/6 — أرسل الإجابة أ:', { reply_markup:{ inline_keyboard:[[{ text:'❌ إلغاء', callback_data:'mg_million_q' }]] }}).catch(()=>{});
  }
  if (state && state.type === 'mq_wizard_a') {
    await setState(uid, { ...state, type:'mq_wizard_b', opt_a: text });
    return ctx.reply('✅ أ: ' + text + '\n\n📝 الخطوة 3/6 — أرسل الإجابة ب:', { reply_markup:{ inline_keyboard:[[{ text:'❌ إلغاء', callback_data:'mg_million_q' }]] }}).catch(()=>{});
  }
  if (state && state.type === 'mq_wizard_b') {
    await setState(uid, { ...state, type:'mq_wizard_c', opt_b: text });
    return ctx.reply('✅ ب: ' + text + '\n\n📝 الخطوة 4/6 — أرسل الإجابة ج:', { reply_markup:{ inline_keyboard:[[{ text:'❌ إلغاء', callback_data:'mg_million_q' }]] }}).catch(()=>{});
  }
  if (state && state.type === 'mq_wizard_c') {
    await setState(uid, { ...state, type:'mq_wizard_d', opt_c: text });
    return ctx.reply('✅ ج: ' + text + '\n\n📝 الخطوة 5/6 — أرسل الإجابة د:', { reply_markup:{ inline_keyboard:[[{ text:'❌ إلغاء', callback_data:'mg_million_q' }]] }}).catch(()=>{});
  }
  if (state && state.type === 'mq_wizard_d') {
    await setState(uid, { ...state, type:'mq_wizard_correct', opt_d: text });
    return ctx.reply(
      '✅ د: ' + text + '\n\n🎯 الخطوة 6/6 — اختر الإجابة الصحيحة:',
      { reply_markup:{ inline_keyboard:[
        [{ text:'أ) ' + state.opt_a, callback_data:'mq_correct_a' }, { text:'ب) ' + state.opt_b, callback_data:'mq_correct_b' }],
        [{ text:'ج) ' + state.opt_c, callback_data:'mq_correct_c' }, { text:'د) ' + text, callback_data:'mq_correct_d' }],
        [{ text:'❌ إلغاء', callback_data:'mg_million_q' }],
      ]}}).catch(()=>{});
  }

}
async function handleCallback(ctx,data){
  const uid=ctx.uid;
  try{
  if (data.startsWith('mq_correct_')) {
    const correct = data.replace('mq_correct_', '');
    const { getStateAsync, getState, delState } = require('../utils/stateManager');
    const s = await (getStateAsync || getState)(uid).catch(()=>null);
    if (!s || s.type !== 'mq_wizard_correct') return ctx.answerCbQuery('❌ انتهت الجلسة').catch(()=>{});
    const insertRes = await run(
      'INSERT INTO million_questions(text,option_a,option_b,option_c,option_d,correct,difficulty,is_active) VALUES($1,$2,$3,$4,$5,$6,$7,1)',
      [s.question, s.opt_a, s.opt_b, s.opt_c, s.opt_d, correct, 1]
    ).catch(e => { require('../utils/logger').error('[mq insert]', e.message); return null; });
    await delState(uid).catch(()=>{});
    const L = { a:'أ', b:'ب', c:'ج', d:'د' };
    return ctx.editMessageText(
      '✅ *تم حفظ السؤال!*\n\n❓ ' + s.question + '\n🎯 الصحيحة: *' + L[correct] + ')*',
      { parse_mode:'Markdown', reply_markup:{ inline_keyboard:[
        [{ text:'➕ إضافة آخر', callback_data:'mq_add' }, { text:'◀️ رجوع', callback_data:'mg_million_q' }]
      ]}}).catch(()=>ctx.reply('✅ تم الحفظ!').catch(()=>{}));
  }
  if(data==='mg_menu')         return mainMenu(ctx);
  if(data==='mg_sec_users')    return showSectionUsers(ctx);
  if(data==='mg_sec_content')  return showSectionContent(ctx);
  if(data==='mg_sec_notify')   return showSectionNotify(ctx);
  if(data==='mg_sec_admin')    return showSectionAdmin(ctx);
  if(data==='mg_sec_settings') return showSectionSettings(ctx);
  if(data==='mg_content') return showContent(ctx);
  // ── بروفايل مستخدم من الأزرار الجديدة ──
  if (data.startsWith('mg_up_') && !data.startsWith('mg_upg_')) {
    const uid2 = data.replace('mg_up_', '');
    if (!uid2) return ctx.answerCbQuery('❌').catch(() => {});
    return showUserProfile(ctx, uid2);
  }
  // ── تنقل صفحات المستخدمين ──
  if (data.startsWith('mg_upg_')) {
    const parts = data.replace('mg_upg_', '').split('_');
    const pg = parseInt(parts[parts.length - 1]) || 0;
    const flt = parts.slice(0, -1).join('_') || 'all';
    return showUsers(ctx, pg, flt);
  }

  // ── القنوات والإعلانات ──
  if(data==='mg_channels_menu') {
    try { return await showChannelsMenu(ctx); }
    catch(e) { console.error('[channels_menu]', e.message, e.stack); return ctx.reply('❌ ' + e.message).catch(()=>{}); }
  }
  if(data==='mg_auto_replies') return showAutoReplies(ctx);
  if(data==='mg_games_settings') return showGamesSettings(ctx);
  if(data.startsWith('mg_gs_')) {
    const key = data.replace('mg_gs_','');
    const val = await require('../database/db').get('SELECT value FROM settings WHERE key=$1',[key]).catch(()=>null);
    const cur = val?.value || '';
    setState(uid, { type: 'mg_gs_edit', key });
    return eos(ctx,
      '⚙️ *تعديل إعداد اللعبة*\n\n' +
      '🔑 `' + key + '`\n' +
      '📝 القيمة الحالية: `' + (cur||'غير محددة') + '`\n\n' +
      'أرسل القيمة الجديدة:',
      { parse_mode:'Markdown', ...build([[btn('❌ إلغاء','mg_games_settings')]]) }
    );
  }
  if(data.startsWith('mg_ar_page_')) {
    const pg = parseInt(data.replace('mg_ar_page_','')) || 0;
    return showAutoReplies(ctx, pg);
  }
  if(data.startsWith('mg_ar_view_')) {
    const arId = parseInt(data.replace('mg_ar_view_',''));
    return showAutoReplyDetail(ctx, arId);
  }
  if(data==='mg_ar_search') {
    setState(uid, { type: 'mg_ar_search' });
    return eos(ctx,
      '🔍 *بحث في الردود التلقائية*\n\nأرسل الكلمة للبحث:',
      { parse_mode:'Markdown', ...build([[btn('❌ إلغاء','mg_auto_replies')]]) }
    );
  }
  if(data==='mg_add_ar') {
    setState(uid, { type: 'mg_ar_trigger' });
    return eos(ctx,
      '🤖 *إضافة رد تلقائي*\n\n' +
      'الخطوة 1/3: أرسل الكلمة أو الجملة التي يراقبها البوت:\n\n' +
      'مثال: `سلام عليكم` أو `❤️` أو `?`',
      { parse_mode: 'Markdown', ...build([[btn('❌ إلغاء','mg_auto_replies')]]) }
    );
  }
  if(data.startsWith('mg_del_ar_')) {
    const arId = parseInt(data.replace('mg_del_ar_',''));
    await dbRun('UPDATE auto_replies SET is_active=0 WHERE id=$1',[arId]).catch(()=>{});
    cacheClear('auto_replies_all');
    ctx.answerCbQuery('✅ تم الحذف').catch(()=>{});
    return showAutoReplies(ctx);
  }
  if(data.startsWith('mg_ar_type_')) {
    const parts = data.replace('mg_ar_type_','').split('_');
    const matchType = parts[0];
    const s = require('../utils/stateManager').getState(uid);
    if(s?.type === 'mg_ar_response') {
      setState(uid, { ...s, matchType });
    }
    return ctx.answerCbQuery(matchType === 'exact' ? '🎯 مطابقة تامة' : '🔍 يحتوي على').catch(()=>{});
  }
  if(data==='mg_ads_menu') return showAdsMenu(ctx);
  if(data==='mg_addchannel') {
    setState(uid, { type: 'mg_awaiting_channel' });
    return eos(ctx,
      '📢 *إضافة قناة اشتراك إجباري*\n' +
      '━━━━━━━━━━━━━━━\n\n' +
      '*الطريقة 1 — Forward:*\n' +
      '↩️ أعد توجيه أي رسالة من القناة هنا\n\n' +
      '*الطريقة 2 — يدوي:*\n' +
      '✏️ أرسل: `@username اسم القناة`\n\n' +
      '⚠️ *تأكد إن البوت ادمن في القناة أولاً!*',
      { parse_mode: 'Markdown', ...build([[btn('❌ إلغاء','mg_channels_menu')]]) }
    );
  }
  if(data.startsWith('mg_delch_')) {
    const chId = data.replace('mg_delch_','');
    const { removeChannel } = require('../utils/channelGuard');
    await removeChannel(chId).catch(()=>{});
    cacheClear('required_channels');
    return showChannelsMenu(ctx);
  }
  if(data==='mg_addad') {
    setState(uid, { type: 'mg_awaiting_ad_title' });
    return eos(ctx, '📣 *إعلان جديد*\n\nأرسل عنوان الإعلان:', { parse_mode: 'Markdown', ...build([[btn('❌ إلغاء','mg_ads_menu')]]) });
  }
  if(data.startsWith('mg_delad_')) {
    const adId = parseInt(data.replace('mg_delad_',''));
    await dbRun('UPDATE ads SET is_deleted=1 WHERE id=$1',[adId]).catch(()=>{});
    return showAdsMenu(ctx);
  }
  if(data.startsWith('mg_pinad_')) {
    const adId = parseInt(data.replace('mg_pinad_',''));
    const ad = await require('../database/db').get('SELECT is_pinned FROM ads WHERE id=$1',[adId]).catch(()=>null);
    if(ad) await dbRun('UPDATE ads SET is_pinned=$1 WHERE id=$2',[ad.is_pinned?0:1,adId]).catch(()=>{});
    return showAdsMenu(ctx);
  }
  if(data.startsWith('mg_ad_')) {
    const adId = parseInt(data.replace('mg_ad_',''));
    const ad = await require('../database/db').get('SELECT * FROM ads WHERE id=$1',[adId]).catch(()=>null);
    if(!ad) return eos(ctx,'❌ غير موجود',build([[btn('◀️ رجوع','mg_ads_menu')]]));
    const text = (ad.icon||'📌')+' *'+escMd(ad.title)+'*\n\n'+(ad.body?escMd(ad.body)+'\n\n':'')+(ad.link?'🔗 '+ad.link+'\n':'')+'📌 مثبت: '+(ad.is_pinned?'نعم':'لا');
    return eos(ctx, text, { parse_mode:'Markdown', ...build([[btn(ad.is_pinned?'📌 إلغاء التثبيت':'📌 تثبيت','mg_pinad_'+adId)],[btn('🗑 حذف','mg_delad_'+adId)],[btn('◀️ رجوع','mg_ads_menu')]]) });
  }
  if(data==='mg_analytics') return showAnalytics(ctx);
  if(data==='mg_logs') return showLogs(ctx);
  if(data==='mg_users'){try{const p=ctx.isOwner?['full']:await adminsDb.getPerms(ctx.uid);if(!p.includes('full')&&!p.includes('view_users')) return ctx.answerCbQuery('ليس لديك صلاحية',{show_alert:true});return await showUsers(ctx);}catch(e){console.error('[mg_users]',e.message);return ctx.reply('❌ خطأ: '+e.message).catch(err => { require('../utils/logger').debug("[silent]", err.message); });}}
  if(data==='mg_admins') return showAdmins(ctx);
  if(data==='mg_trash') return showTrash(ctx);
  if(data==='mg_search_prompt'){setState(uid,{type:'mg_admin_search'});return ctx.reply('🔍 بحث:\nأدخل اسم ملف أو مستخدم:');}
  if(data==='mg_bank_panel'){
    try {
      const { all } = require('../database/db');
      const [accounts, txCount] = await Promise.all([
        all('SELECT COUNT(*) as cnt FROM bank_accounts').catch(()=>[{cnt:0}]),
        all('SELECT COUNT(*) as cnt FROM bank_transactions').catch(()=>[{cnt:0}]),
      ]);
      const text =
        '🏦 *لوحة البنك*\n' +
        '━━━━━━━━━━━━━━━━━━━━\n\n' +
        '👤 الحسابات: *' + (accounts[0]?.cnt||0) + '*\n' +
        '💸 المعاملات: *' + (txCount[0]?.cnt||0) + '*\n\n' +
        '⚙️ اختر ما تريد:';
      const rows = [
        [btn('👤 أغنى المستخدمين','mg_bank_top')],
        [btn('💸 آخر المعاملات','mg_bank_txs')],
        [btn('➕ إضافة رصيد','mg_bank_add')],
        [back('mg_menu')[0]],
      ];
      return eos(ctx, text, {parse_mode:'Markdown', ...build(rows)});
    } catch(e) { return ctx.answerCbQuery('❌ ' + e.message, {show_alert:true}).catch(()=>{}); }
  }


  if(data==='mg_bank_add') {
    setState(uid, { type: 'mg_bank_add_id' });
    return eos(ctx,
      '🏦 *إضافة رصيد يدوي*\n\n' +
      'أرسل ID المستخدم:',
      { parse_mode:'Markdown', ...build([[btn('❌ إلغاء','mg_bank_panel')]]) }
    );
  }

    if(data==='mg_bank_top'){
    const { all } = require('../database/db');
    const top = await all('SELECT first_name, balance FROM bank_accounts ORDER BY balance DESC LIMIT 10').catch(()=>[]);
    let text = '🏆 *أغنى المستخدمين*\n━━━━━━━━━━━━━━━━━━━━\n\n';
    top.forEach((u,i) => { text += (i+1) + '. ' + (u.first_name||'مجهول') + ' — ' + Number(u.balance).toLocaleString('en') + ' $\n'; });
    return eos(ctx, text||'لا يوجد', {parse_mode:'Markdown', ...build([back('mg_bank_panel')])});
  }

  if(data==='mg_bank_txs'){
    const { all } = require('../database/db');
    const txs = await all('SELECT * FROM bank_transactions ORDER BY created_at DESC LIMIT 10').catch(()=>[]);
    let text = '💸 *آخر المعاملات*\n━━━━━━━━━━━━━━━━━━━━\n\n';
    txs.forEach(tx => { text += (tx.type==='win'?'🏆':'💸') + ' ' + Number(tx.amount).toLocaleString('en') + ' $ — ' + (tx.note||tx.type) + '\n'; });
    return eos(ctx, text||'لا يوجد', {parse_mode:'Markdown', ...build([back('mg_bank_panel')])});
  }

  if(data==='mg_notify'){setState(uid,{type:'mg_msg_user_id'});return ctx.reply('ID: ارسل ID المستخدم',{parse_mode:'Markdown',...build([back('mg_menu')])});}
  if(data.startsWith('mg_ng_sp_')){const spId=data.replace('mg_ng_sp_','');setState(uid,{type:'mg_notify_groups_msg',spId});return ctx.reply('📝 رسالة الإشعار لـ '+(spId==='0'?'كل القروبات':'التخصص')+':\n_(أو /cancel)_',{parse_mode:'Markdown'});}
  if(data.startsWith('mg_notify_sp_')&&!data.startsWith('mg_notify_sp_msg')){const spId=data.replace('mg_notify_sp_','');setState(uid,{type:'mg_notify_sp_msg',spId});return ctx.reply('📝 رسالة الإشعار:\n_(أو /cancel)_',{parse_mode:'Markdown'});}
  if(data==='mg_post_channel'){
    setState(uid,{type:'mg_channel_post'});
    return ctx.reply('📢 أرسل المحتوى للنشر في القناة (نص أو صورة أو فيديو أو مستند مع caption):').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  }
  if(data==='mg_msgs') return showMsgsMenu(ctx);
  if(data==='mg_templates') return showTemplates(ctx);
  if(data==='mg_add_template'){setState(uid,{type:'mg_tpl_name'});return ctx.reply('📝 *قالب جديد*\n\nاسم القالب:',{parse_mode:'Markdown',...build([[btn('❌ إلغاء','mg_templates')]])});}
  if(data.startsWith('mg_tpl_')&&!data.startsWith('mg_tpl_content')){const id=data.replace('mg_tpl_','');const t=await messagesDb.getTemplate(id);if(!t) return ctx.reply('❌ غير موجود');const typeIcon={'text':'📝','photo':'🖼','document':'📄','link':'🔗','video':'🎥'}[t.type]||'📝';const rows=[[btn('📤 إرسال الآن','mg_send_now_'+id)],[btn('📅 جدولة','mg_sched_'+id)],[btn('🗑 حذف','mg_del_tpl_'+id)],[back('mg_templates')[0]]];return eos(ctx,typeIcon+' *'+escMd(t.name)+'*\nالنوع: '+t.type+'\n\n'+escMd((t.content||'').substring(0,200)),{parse_mode:'Markdown',...build(rows)});}
  if(data.startsWith('mg_del_tpl_')){await messagesDb.deleteTemplate(data.replace('mg_del_tpl_',''));return showTemplates(ctx);}
  if(data.startsWith('mg_sched_')&&!data.startsWith('mg_sched_all_')&&!data.startsWith('mg_sched_sp_')){const tplId=data.replace('mg_sched_','');const rows=[[btn('👥 كل المستخدمين','mg_sched_all_'+tplId)],[btn('🎓 تخصص معين','mg_sched_sp_'+tplId)],[back('mg_templates')[0]]];return eos(ctx,'📅 من تريد الإرسال؟',{parse_mode:'Markdown',...build(rows)});}
  if(data.startsWith('mg_sched_all_')){setState(uid,{type:'mg_sched_time',tplId:data.replace('mg_sched_all_',''),target:'all'});return ctx.reply('📅 وقت الإرسال\nمثال: 2026-04-10 20:00');}
  if(data.startsWith('mg_sched_sp_')&&!data.startsWith('mg_sched_spid_')){const tplId=data.replace('mg_sched_sp_','');const specs=await content.getSpecs();const rows=specs.map(s=>[btn('🎓 '+s.name,'mg_sched_spid_'+tplId+'_'+s.id)]);return eos(ctx,'اختر التخصص:',{...build(rows)});}
  if(data.startsWith('mg_sched_spid_')){const p=data.replace('mg_sched_spid_','').split('_');setState(uid,{type:'mg_sched_time',tplId:p[0],target:'specialty',spId:p[1]});return ctx.reply('📅 وقت الإرسال\nمثال: 2026-04-10 20:00');}
  if(data.startsWith('mg_send_now_')){const tplId=data.replace('mg_send_now_','');const tpl=await messagesDb.getTemplate(tplId);if(!tpl) return ctx.reply('❌ غير موجود');const ids=await usersDb.allIds();let sent=0,failed=0;const total=ids.length;const sm=await ctx.reply('📤 *جاري...*\n`[░░░░░░░░░░] 0%`\n✅ 0 | ❌ 0 | ⏳ '+total,{parse_mode:'Markdown'});async function st(id){const o={parse_mode:'Markdown'};if(tpl.type==='text')return ctx.telegram.sendMessage(id,tpl.content,o).then(()=>1).catch(()=>0);if(tpl.type==='photo')return ctx.telegram.sendPhoto(id,tpl.file_id,{caption:tpl.content,...o}).then(()=>1).catch(()=>0);if(tpl.type==='document')return ctx.telegram.sendDocument(id,tpl.file_id,{caption:tpl.content,...o}).then(()=>1).catch(()=>0);if(tpl.type==='video')return ctx.telegram.sendVideo(id,tpl.file_id,{caption:tpl.content,...o}).then(()=>1).catch(()=>0);if(tpl.type==='link')return ctx.telegram.sendMessage(id,tpl.content).then(()=>1).catch(()=>0);return 0;}for(let i=0;i<ids.length;i+=30){const r=await Promise.allSettled(ids.slice(i,i+30).map(st));r.forEach(x=>{if(x.status==='fulfilled'&&x.value)sent++;else failed++;});const p=Math.round((sent+failed)/total*100);const b='█'.repeat(Math.round(p/10))+'░'.repeat(10-Math.round(p/10));ctx.telegram.editMessageText(ctx.chat.id,sm.message_id,null,'📤 *جاري...*\x60['+b+'] '+p+'%\x60\n✅ '+sent+' | ❌ '+failed+' | ⏳ '+(total-sent-failed),{parse_mode:'Markdown'}).catch(err => { require('../utils/logger').debug("[silent]", err.message); });if(i+30<total)await new Promise(r=>setTimeout(r,1100));}return ctx.telegram.editMessageText(ctx.chat.id,sm.message_id,null,'✅ *اكتمل!*\n`[██████████] 100%`\n✅ '+sent+' | ❌ '+failed,{parse_mode:'Markdown',...build([back('mg_templates')])}).catch(err => { require('../utils/logger').debug("[silent]", err.message); });}
  if(data==='mg_scheduled') return showScheduled(ctx);
  if(data.startsWith('mg_del_sched_')){await messagesDb.deleteScheduled(data.replace('mg_del_sched_',''));return showScheduled(ctx);}
  if(data==='mg_reports'){const rpts=await all(`SELECT r.*,f.title as ft,u.first_name as fn FROM reports r LEFT JOIN files f ON r.file_id=f.id LEFT JOIN users u ON r.user_id=u.id WHERE r.status='pending' ORDER BY r.created_at DESC LIMIT 20`);let txt='🚩 *البلاغات ('+rpts.length+')*\n\n';if(!rpts.length) txt+='لا توجد بلاغات.';else rpts.forEach((r,i)=>{txt+=(i+1)+'. '+escMd(r.ft||'?')+' | '+escMd(r.reason||'?')+' | '+(r.fn||r.user_id)+'\n';});const rrows=rpts.map(r=>[btn('✅ حل','mg_resolve_report_'+r.id),btn('🗑 حذف','mg_cdl_fl_0_0_0_0_'+r.file_id),btn('❌ تجاهل','mg_dismiss_report_'+r.id)]);rrows.push(back('mg_menu'));return eos(ctx,txt,{parse_mode:'Markdown',...build(rrows)});}
  if(data.startsWith('mg_dismiss_report_')){const rid=data.replace('mg_dismiss_report_','');dbRun("UPDATE reports SET status='dismissed' WHERE id=$1",[rid]).catch(err => { require('../utils/logger').debug("[silent]", err.message); });return handleCallback(ctx,'mg_reports');}
if(data.startsWith('mg_resolve_report_')){const rid=data.replace('mg_resolve_report_','');dbRun("UPDATE reports SET status='resolved' WHERE id=$1",[rid]).catch(err => { require('../utils/logger').debug("[silent]", err.message); });ctx.answerCbQuery('✅ تم حل البلاغ').catch(err => { require('../utils/logger').debug("[silent]", err.message); });return handleCallback(ctx,'mg_reports');}
  if(data==='mg_maint'){global.maintenanceMode=!global.maintenanceMode;await setSetting('maintenance',global.maintenanceMode?'true':'false');await interactions.addLog(uid,'maintenance',global.maintenanceMode?'ON':'OFF');return eos(ctx,'🔧 *الصيانة: '+(global.maintenanceMode?'🔴 مفعّلة':'🟢 متوقفة')+'*',{parse_mode:'Markdown',...build([[btn(global.maintenanceMode?'🟢 إيقاف':'🔴 تفعيل','mg_maint')],[btn('📝 تعديل الرسالة','mg_set_maint_msg'),btn('◀️ رجوع','mg_menu')]])});}
  if(data==='mg_set_maint_msg'){setState(uid,{type:'mg_maint_msg'});return ctx.reply('📝 رسالة الصيانة:');}
  if(data==='mg_backup'){
    const msg = await ctx.reply('⏳ جاري تصدير البيانات...').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    try {
      const tables = ['specialties','years','semesters','subjects','categories','files','bundles','bundle_files','admins','settings','message_templates','scheduled_messages'];
      const backup = { exported_at: new Date().toISOString(), tables: {} };
      for (const t of tables) {
        try { backup.tables[t] = await all('SELECT * FROM ' + t); } catch(_) { backup.tables[t] = []; }
      }
      const json = JSON.stringify(backup, null, 2);
      const buf  = Buffer.from(json, 'utf8');
      const fname = 'backup_' + new Date().toISOString().substring(0,10) + '.json';
      await ctx.replyWithDocument({ source: buf, filename: fname }, { caption: '💾 Backup ' + new Date().toISOString().substring(0,10) });
      if (msg) ctx.deleteMessage(msg.message_id).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    } catch(e) {
      if (msg) ctx.deleteMessage(msg.message_id).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
      ctx.reply('❌ فشل التصدير: ' + e.message).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    }
    return;
  }
  if(data==='mg_bot_settings'){
    const wt=await require('../database/db').getSetting('start_welcome_text').catch(()=>null);
    const preview=wt?wt.substring(0,150):'_غير مفعّل_';
    const r2=[[btn('✏️ تعديل رسالة /start','mg_edit_welcome')]];
    if(wt)r2.push([btn('🗑 حذف رسالة /start','mg_del_welcome')]);
    r2.push(back('mg_menu'));
    return eos(ctx,'⚙️ *إعدادات البوت*'+String.fromCharCode(10)+'━━━━━━━━━━━━━━━'+String.fromCharCode(10)+'📝 *رسالة /start:*'+String.fromCharCode(10)+preview,{parse_mode:'Markdown',...build(r2)});}

  if(data==='mg_edit_welcome'){setState(uid,{type:'mg_set_welcome'});return ctx.reply('✏️ أرسل رسالة /start الجديدة:'+String.fromCharCode(10)+'_(أو /cancel)_',{parse_mode:'Markdown'}).catch(()=>{});}

  if(data==='mg_del_welcome'){await require('../database/db').run("DELETE FROM settings WHERE key='start_welcome_text'").catch(()=>{});ctx.answerCbQuery('✅ تم الحذف').catch(()=>{});return handleCallback(ctx,'mg_bot_settings');}

  if(data==='mg_restore'){setState(uid,{type:'mg_awaiting_restore'});return eos(ctx,'♻️ *استعادة قاعدة البيانات*\n\n⚠️ سيتم استبدال البيانات!\n\nأرسل ملف `.db`:',{parse_mode:'Markdown',...build([back('mg_menu')])});}
  if(data==='mg_broadcast'){setState(uid,{type:'mg_broadcast'});return ctx.reply('📢 رسالة البث:\n_(أو /cancel)_',{parse_mode:'Markdown'});}
  if(data==='mg_add_admin'){setState(uid,{type:'mg_add_admin_id'});return ctx.reply('👤 ID المستخدم:\n_(أو /cancel)_',{parse_mode:'Markdown'});}
  if(data.startsWith('mg_admin_sp_')){const p=data.replace('mg_admin_sp_','').split('_');await adminsDb.setSpecialty(p[0],p[1]);return eos(ctx,'✅ تم تحديد التخصص',{...build([back('mg_admins')])});}
  if(data.startsWith('mg_da_')){const rid=parseInt(data.replace('mg_da_',''));await adminsDb.remove(rid);if(global.invalidateAdmin)global.invalidateAdmin(rid);return showAdmins(ctx);}
  if(data.startsWith('mg_ep_')) return showEditPerms(ctx,data.replace('mg_ep_',''));
  if(data.startsWith('mg_tp_')){const p=data.replace('mg_tp_','').split('_');const adminId=p[0];const perm=p.slice(1).join('_');const list=await adminsDb.getAll();const admin=list.find(a=>a.user_id==adminId);if(!admin) return ctx.answerCbQuery('❌').catch(()=>{});let perms=(admin.permissions||'').split(',').map(x=>x.trim()).filter(Boolean);if(perms.includes(perm)) perms=perms.filter(x=>x!==perm);else{if(perm==='full') perms=['full'];else{perms=perms.filter(x=>x!=='full');perms.push(perm);}}await adminsDb.updatePerms(adminId,perms.join(','));return showEditPerms(ctx,adminId);}
  if(data.startsWith('mg_profile_')) return showUserProfile(ctx,data.replace('mg_profile_',''));

  // ── تواصل مع مستخدم ──
  if (data.startsWith('mg_contact_')) {
    const cuid = data.replace('mg_contact_', '');
    const { setState } = require('../utils/stateManager');
    await setState(ctx.uid || ctx.from?.id, { type: 'admin_contact', targetId: cuid });
    return eos(ctx,
      '💬 *تواصل مع المستخدم*\n\n' +
      'أرسل أي شيء — نص، صورة، فيديو، أو ستيكر\n' +
      'وسيصله عبر البوت مباشرة.',
      { parse_mode: 'Markdown', ...build([[btn('❌ إلغاء', 'mg_up_' + cuid)]]) }
    );
  }

  if(data.startsWith('mg_ban_')){const bid=parseInt(data.replace('mg_ban_',''));await usersDb.ban(bid);cacheClearPrefix('admin_users_');cacheClear('ban_'+bid);await interactions.addLog(uid,'ban',String(bid));return showUsers(ctx);}
  if(data.startsWith('mg_unban_')){const ubid=parseInt(data.replace('mg_unban_',''));await usersDb.unban(ubid);cacheClearPrefix('admin_users_');cacheClear('ban_'+ubid);return showUsers(ctx);}
  if(data.startsWith('mg_uf.')) {
    const filter = data.replace('mg_uf.','');
    return showUsers(ctx, 0, filter);
  }
  if(data.startsWith('mg_up.')) {
    const parts = data.replace('mg_up.','').split('.');
    const pg = parseInt(parts[0]);
    const filter = parts[1] || 'all';
    return showUsers(ctx, pg, filter);
  }
  if(data.startsWith('mg_restore_fl_')){await filesDb.restore(data.replace('mg_restore_fl_',''));return showTrash(ctx);}
  if(data==='mg_empty_trash'){return eos(ctx,'⚠️ حذف الكل نهائياً؟',build([[btn('✅ تأكيد','mg_confirm_empty')],[btn('❌ إلغاء','mg_trash')]]));}
  if(data==='mg_confirm_empty'){await dbRun('DELETE FROM files WHERE is_deleted=1');return eos(ctx,'✅ تم حذف السلة!',{parse_mode:'Markdown',...build([back('mg_menu')])});}
  if(data.startsWith('mg_yrs_')) return showYears(ctx,data.replace('mg_yrs_',''));
  if(data.startsWith('mg_sems_')){const p=data.replace('mg_sems_','').split('_');return showSemesters(ctx,p[0],p[1]);}
  if(data.startsWith('mg_sbs_')){const p=data.replace('mg_sbs_','').split('_');return showSubjects(ctx,p[0],p[1],p[2]);}
  if(data.startsWith('mg_cats_')){const p=data.replace('mg_cats_','').split('_');return showCategories(ctx,p[0],p[1],p[2],p[3]);}
  if(data.startsWith('mg_fls_pg_')){const p=data.replace('mg_fls_pg_','').split('_');return showMgFiles(ctx,p[0],p[1],p[2],p[3],p[4],parseInt(p[5]));}
  if(data.startsWith('mg_fls_')){const p=data.replace('mg_fls_','').split('_');return showMgFiles(ctx,p[0],p[1],p[2],p[3],p[4]);}
  if(data==='mg_add_sp'){setState(uid,{type:'mg_add_sp'});return ctx.reply('🎓 اسم التخصص:\n_(أو /cancel)_',{parse_mode:'Markdown'});}
  if(data.startsWith('mg_rn_sp_')){setState(uid,{type:'mg_rn_sp',id:data.replace('mg_rn_sp_','')});return ctx.reply('✏️ الاسم الجديد:\n_(أو /cancel)_',{parse_mode:'Markdown'});}
  if(data.startsWith('mg_dl_sp_')){const id=data.replace('mg_dl_sp_','');const sp=await content.getSpec(id);return eos(ctx,'🗑 حذف *'+escMd(sp?.name||'')+'*؟\n⚠️ سيتم حذف كل المحتوى!',{parse_mode:'Markdown',...build([[btn('✅ تأكيد','mg_cdl_sp_'+id),btn('❌ إلغاء','mg_content')]])});}
  if(data.startsWith('mg_cdl_sp_')){await content.deleteSpec(data.replace('mg_cdl_sp_',''));return showContent(ctx);}
  if(data.startsWith('mg_add_yr_')){setState(uid,{type:'mg_add_yr',spId:data.replace('mg_add_yr_','')});return ctx.reply('📅 اسم السنة:\n_(أو /cancel)_',{parse_mode:'Markdown'});}
  if(data.startsWith('mg_rn_yr_')){const p=data.replace('mg_rn_yr_','').split('_');setState(uid,{type:'mg_rn_yr',id:p[1],spId:p[0]});return ctx.reply('✏️ الاسم الجديد:\n_(أو /cancel)_',{parse_mode:'Markdown'});}
  if(data.startsWith('mg_dl_yr_')){const p=data.replace('mg_dl_yr_','').split('_');const yr=await content.getYear(p[1]);return eos(ctx,'🗑 حذف *'+escMd(yr?.name||'')+'*؟',{parse_mode:'Markdown',...build([[btn('✅ نعم','mg_cdl_yr_'+p[0]+'_'+p[1]),btn('❌ لا','mg_yrs_'+p[0])]])});}
  if(data.startsWith('mg_cdl_yr_')){const p=data.replace('mg_cdl_yr_','').split('_');await content.deleteYear(p[1]);return showYears(ctx,p[0]);}
  if(data.startsWith('mg_add_sem_')){const p=data.replace('mg_add_sem_','').split('_');setState(uid,{type:'mg_add_sem',spId:p[0],yrId:p[1]});return ctx.reply('📆 اسم الفصل:\n_(أو /cancel)_',{parse_mode:'Markdown'});}
  if(data.startsWith('mg_rn_sem_')){const p=data.replace('mg_rn_sem_','').split('_');setState(uid,{type:'mg_rn_sem',id:p[2],spId:p[0],yrId:p[1]});return ctx.reply('✏️ الاسم الجديد:\n_(أو /cancel)_',{parse_mode:'Markdown'});}
  if(data.startsWith('mg_dl_sem_')){const p=data.replace('mg_dl_sem_','').split('_');const sem=await content.getSemester(p[2]);return eos(ctx,'🗑 حذف *'+escMd(sem?.name||'')+'*؟',{parse_mode:'Markdown',...build([[btn('✅ نعم','mg_cdl_sem_'+p[0]+'_'+p[1]+'_'+p[2]),btn('❌ لا','mg_sems_'+p[0]+'_'+p[1])]])});}
  if(data.startsWith('mg_cdl_sem_')){const p=data.replace('mg_cdl_sem_','').split('_');await content.deleteSemester(p[2]);return showSemesters(ctx,p[0],p[1]);}
  if(data.startsWith('mg_add_sb_')){const p=data.replace('mg_add_sb_','').split('_');setState(uid,{type:'mg_add_sb',spId:p[0],yrId:p[1],smId:p[2]});return ctx.reply('📖 اسم المادة:\n_(أو /cancel)_',{parse_mode:'Markdown'});}
  if(data.startsWith('mg_rn_sb_')){const p=data.replace('mg_rn_sb_','').split('_');setState(uid,{type:'mg_rn_sb',id:p[3],spId:p[0],yrId:p[1],smId:p[2]});return ctx.reply('✏️ الاسم الجديد:\n_(أو /cancel)_',{parse_mode:'Markdown'});}
  if(data.startsWith('mg_dl_sb_')){const p=data.replace('mg_dl_sb_','').split('_');const sb=await content.getSubject(p[3]);return eos(ctx,'🗑 حذف *'+escMd(sb?.name||'')+'*؟',{parse_mode:'Markdown',...build([[btn('✅ نعم','mg_cdl_sb_'+p[0]+'_'+p[1]+'_'+p[2]+'_'+p[3]),btn('❌ لا','mg_sbs_'+p[0]+'_'+p[1]+'_'+p[2])]])});}
  if(data.startsWith('mg_cdl_sb_')){const p=data.replace('mg_cdl_sb_','').split('_');await content.deleteSubject(p[3]);return showSubjects(ctx,p[0],p[1],p[2]);}
  if(data.startsWith('mg_add_cat_')){const p=data.replace('mg_add_cat_','').split('_');setState(uid,{type:'mg_add_cat',spId:p[0],yrId:p[1],smId:p[2],sbId:p[3]});return ctx.reply('📁 اسم الفئة:\n_(أو /cancel)_',{parse_mode:'Markdown'});}
  if(data.startsWith('mg_rn_cat_')){const p=data.replace('mg_rn_cat_','').split('_');setState(uid,{type:'mg_rn_cat',id:p[4],spId:p[0],yrId:p[1],smId:p[2],sbId:p[3]});return ctx.reply('✏️ الاسم الجديد:\n_(أو /cancel)_',{parse_mode:'Markdown'});}
  if(data.startsWith('mg_dl_cat_')){const p=data.replace('mg_dl_cat_','').split('_');const cat=await content.getCategory(p[4]);return eos(ctx,'🗑 حذف *'+escMd(cat?.name||'')+'*؟',{parse_mode:'Markdown',...build([[btn('✅ نعم','mg_cdl_cat_'+p[0]+'_'+p[1]+'_'+p[2]+'_'+p[3]+'_'+p[4]),btn('❌ لا','mg_cats_'+p[0]+'_'+p[1]+'_'+p[2]+'_'+p[3])]])});}
  if(data.startsWith('mg_cdl_cat_')){const p=data.replace('mg_cdl_cat_','').split('_');await content.deleteCategory(p[4]);return showCategories(ctx,p[0],p[1],p[2],p[3]);}
  if(data.startsWith('mg_add_bundle_files_')){const p=data.replace('mg_add_bundle_files_','').split('_');require('../utils/stateManager').setState(ctx.uid,{type:'mg_bundle_files',bundleId:p[0],catId:p[1],spId:p[2],yrId:p[3],smId:p[4],sbId:p[5],fileCount:0});return ctx.reply('➕ أبعث ملفات للحزمة. /done للانتهاء');}
  if(data.startsWith('mg_dl_bundle_')){const p=data.replace('mg_dl_bundle_','').split('_');const _bId=parseInt(p[0]),_bCat=parseInt(p[1]);await bundlesDb.deleteBundle(_bId);const {cacheClearPrefix:ccp,cacheClear:cc}=require('../utils/cache');ccp('showfiles_'+_bCat);cc('bdls_'+_bCat);cc('bundle_full_'+_bId);await ctx.answerCbQuery('✅ تم حذف الحزمة').catch(err => { require('../utils/logger').debug("[silent]", err.message); });return browse.showFiles(ctx,p[2],p[3],p[4],p[5],p[1],0);}
  if(data.startsWith('mg_rn_bundle_')){const p=data.replace('mg_rn_bundle_','').split('_');setState(uid,{type:'mg_rename_bundle',bundleId:p[0],catId:p[1],spId:p[2],yrId:p[3],smId:p[4],sbId:p[5]});return ctx.reply('✏️ الاسم الجديد:');}
  if(data.startsWith('mg_add_bundle_')){if(!ctx.isOwner) return ctx.answerCbQuery('🚫 للمالك فقط.',{show_alert:true});const p=data.replace('mg_add_bundle_','').split('_');setState(uid,{type:'mg_bundle_title',spId:p[0],yrId:p[1],smId:p[2],sbId:p[3],catId:p[4]});return ctx.reply('📦 اسم الحزمة:');}
  if(data.startsWith('mg_upl_bulk_')){const p=ctx.isOwner?['full']:await adminsDb.getPerms(ctx.uid);if(!p.includes('full')&&!p.includes('upload')) return ctx.answerCbQuery('ليس لديك صلاحية',{show_alert:true});const pr=data.replace('mg_upl_bulk_','').split('_');setState(uid,{type:'mg_bulk_prefix',spId:pr[0],yrId:pr[1],smId:pr[2],sbId:pr[3],catId:pr[4]});return ctx.reply('رفع متعدد — بادئة للأسماء؟ أو skip:');}
  if(data.startsWith('mg_upl_')){const p=ctx.isOwner?['full']:await adminsDb.getPerms(ctx.uid);if(!p.includes('full')&&!p.includes('upload')) return ctx.answerCbQuery('ليس لديك صلاحية',{show_alert:true});const pr=data.replace('mg_upl_','').split('_');setState(uid,{type:'mg_upl_title',spId:pr[0],yrId:pr[1],smId:pr[2],sbId:pr[3],catId:pr[4]});return ctx.reply('✏️ عنوان الملف:');}
  if(data.startsWith('mg_rn_fl_')){const p=data.replace('mg_rn_fl_','').split('_');setState(uid,{type:'mg_rn_fl',id:p[5],spId:p[0],yrId:p[1],smId:p[2],sbId:p[3],catId:p[4]});return ctx.reply('✏️ العنوان الجديد:\n_(أو /cancel)_',{parse_mode:'Markdown'});}
  if(data.startsWith('mg_desc_fl_')){const p=data.replace('mg_desc_fl_','').split('_');setState(uid,{type:'mg_desc_fl',id:p[5],spId:p[0],yrId:p[1],smId:p[2],sbId:p[3],catId:p[4]});return ctx.reply('📝 الوصف الجديد:\n_(أو /cancel)_',{parse_mode:'Markdown'});}
  if(data.startsWith('mg_dl_fl_')){const p=ctx.isOwner?['full']:await adminsDb.getPerms(ctx.uid);if(!p.includes('full')&&!p.includes('delete')) return ctx.answerCbQuery('ليس لديك صلاحية',{show_alert:true});const pr=data.replace('mg_dl_fl_','').split('_');const f=await filesDb.getFile(pr[5]);return eos(ctx,'🗑 نقل *'+escMd(f?.title||'الملف')+'* للسلة؟',{parse_mode:'Markdown',...build([[btn('✅ نعم','mg_cdl_fl_'+pr.join('_')),btn('❌ لا','mg_fls_'+pr.slice(0,5).join('_'))]])});}
  if(data.startsWith('mg_cdl_fl_')){const p=data.replace('mg_cdl_fl_','').split('_');await filesDb.softDelete(p[5]);return showMgFiles(ctx,p[0],p[1],p[2],p[3],p[4]);}
  }catch(e){console.error('[CB]',e.message);ctx.reply('❌ '+e.message).catch(err => { require('../utils/logger').debug("[silent]", err.message); });}
}

// ══════════════════════════════════════════
// 📢 نظام القنوات والإعلانات
// ══════════════════════════════════════════

async function showChannelsMenu(ctx) {
  const { getChannels } = require('../utils/channelGuard');
  const list = await getChannels().catch(() => []);

  let text = '📢 *قنوات الاشتراك الإجباري*\n━━━━━━━━━━━━━━━\n\n';
  text += '📌 *المجموع:* ' + list.length + ' قناة\n\n';

  const rows = [];

  if (list.length) {
    list.forEach((ch, i) => {
      const name = (ch.channel_name||'قناة').replace(/https?:\/\/\S+/g,'').trim() || ch.channel_id;
      const url  = ch.channel_url || ('https://t.me/' + String(ch.channel_id).replace('@',''));
      text += (i+1) + '. *' + escMd(name) + '*\n';
      text += '   🆔 `' + ch.channel_id + '`\n';
      const hasUrl = ch.channel_url && ch.channel_url.trim() && !ch.channel_url.includes('undefined') && !ch.channel_url.includes('/-100');
      if (hasUrl) text += '   🔗 ' + ch.channel_url + '\n';
      else if (ch.channel_id && !String(ch.channel_id).startsWith('-')) text += '   🔗 https://t.me/' + String(ch.channel_id).replace('@','') + '\n';
      else text += '   🔒 قناة خاصة\n';
      text += '\n';
      rows.push([
        btn('📣 ' + name.substring(0,20), url.startsWith('http') ? 'mg_ch_view_' + ch.id : 'mg_ch_view_' + ch.id),
        btn('🗑 حذف', 'mg_delch_' + ch.channel_id),
      ]);
    });
  } else {
    text += '_لا توجد قنوات مضافة بعد_\n\n';
    text += '💡 أضف قناة وأجعل الاشتراك فيها إجبارياً للمستخدمين';
  }

  rows.push([btn('➕ إضافة قناة', 'mg_addchannel')]);
  rows.push([btn('🗑 حذف الكل', 'mg_delch_all'), btn('📣 الإعلانات', 'mg_ads_menu')]);
  rows.push(back('mg_menu'));
  return eos(ctx, text, { parse_mode: 'Markdown', ...build(rows) });
}

async function showAdsMenu(ctx) {
  const ads = await all("SELECT * FROM ads WHERE is_deleted=0 ORDER BY is_pinned DESC, created_at DESC LIMIT 10").catch(() => []);
  let text = '📣 *الإعلانات*\n━━━━━━━━━━━━━━━\n\n';
  if (!ads.length) {
    text += '_لا توجد إعلانات_\n';
  } else {
    ads.forEach((ad, i) => {
      text += (i+1) + '. ' + (ad.icon||'📌') + ' *' + escMd(ad.title) + '*';
      text += (ad.is_pinned ? ' 📌' : '') + '\n';
      if (ad.body) text += '   ' + escMd(ad.body.substring(0,50)) + '...\n';
    });
  }
  const rows = ads.map(ad => [
    btn((ad.is_pinned?'📌 ':'') + ad.title.substring(0,20), 'mg_ad_' + ad.id),
    btn('🗑', 'mg_delad_' + ad.id)
  ]);
  rows.push([btn('➕ إضافة إعلان', 'mg_addad')]);
  rows.push([btn('◀️ رجوع', 'mg_channels_menu')]);
  return eos(ctx, text, { parse_mode: 'Markdown', ...build(rows) });
}

// ══════════════════════════════════════════
// 🤖 الردود التلقائية
// ══════════════════════════════════════════

async function showAutoReplies(ctx, page) {
  page = parseInt(page) || 0;
  const PAGE = 5;
  const total = await require('../database/db').get('SELECT COUNT(*) as c FROM auto_replies WHERE is_active=1').catch(()=>({c:0}));
  const totalCount = parseInt(total?.c) || 0;
  const list = await all(
    'SELECT * FROM auto_replies WHERE is_active=1 ORDER BY id DESC LIMIT $1 OFFSET $2',
    [PAGE, page * PAGE]
  ).catch(() => []);

  const typeIcon = { exact:'🎯', regex:'⚙️', contains:'🔍' };

  const text =
    '🤖 *الردود التلقائية*\n━━━━━━━━━━━━━━━\n\n' +
    '📊 المجموع: *' + totalCount + '* رد' +
    (totalCount === 0 ? '\n\n_لا توجد ردود مضافة_' : '');

  const rows = [];

  // زر لكل رد — يعرض التفاصيل عند الضغط
  list.forEach(r => {
    const icon = typeIcon[r.match_type] || '🔍';
    rows.push([btn(icon + ' ' + r.trigger.substring(0,25), 'mg_ar_view_' + r.id)]);
  });

  // تنقل صفحات
  const navRow = [];
  if (page > 0) navRow.push(btn('◀️', 'mg_ar_page_' + (page-1)));
  if ((page+1)*PAGE < totalCount) navRow.push(btn('▶️', 'mg_ar_page_' + (page+1)));
  if (navRow.length) rows.push(navRow);

  rows.push([btn('➕ إضافة رد', 'mg_add_ar'), btn('🔍 بحث', 'mg_ar_search')]);
  rows.push(back('mg_menu'));
  return eos(ctx, text, { parse_mode: 'Markdown', ...build(rows) });
}

async function showAutoReplyDetail(ctx, id) {
  const r = await require('../database/db').get('SELECT * FROM auto_replies WHERE id=$1',[id]).catch(()=>null);
  if (!r) return ctx.answerCbQuery('❌ غير موجود').catch(()=>{});
  const typeMap = { exact:'🎯 مطابقة تامة', regex:'⚙️ Regex', contains:'🔍 يحتوي على' };
  const respType = r.resp_type || 'text';
  const typeIcon2 = { text:'📝', photo:'🖼', video:'🎥', sticker:'🎭', voice:'🎤', animation:'🎞', document:'📄' };

  let text =
    '🤖 *تفاصيل الرد التلقائي*\n━━━━━━━━━━━━━━━\n\n' +
    '🔑 *الكلمة:* `' + escMd(r.trigger) + '`\n' +
    '📋 *النوع:* ' + (typeMap[r.match_type]||'🔍 يحتوي على') + '\n' +
    '📤 *الرد:* ' + (typeIcon2[respType]||'📝') + ' ' + respType + '\n';

  if (respType === 'text') {
    text += '\n💬 *المحتوى:*\n' + escMd((r.response||'').substring(0,200));
  }

  const rows = [
    [btn('🗑 حذف', 'mg_del_ar_' + r.id), btn('◀️ رجوع', 'mg_auto_replies')],
  ];

  // إرسال الوسائط مباشرة إذا كان رد بصورة/فيديو/ستيكر
  if (respType !== 'text' && r.file_id) {
    try {
      const opts = { caption: text, parse_mode:'Markdown', reply_markup:{ inline_keyboard: rows } };
      if (respType==='photo')     await ctx.telegram.sendPhoto(ctx.chat.id, r.file_id, opts).catch(()=>{});
      else if (respType==='video') await ctx.telegram.sendVideo(ctx.chat.id, r.file_id, opts).catch(()=>{});
      else if (respType==='sticker') {
        await ctx.telegram.sendSticker(ctx.chat.id, r.file_id).catch(()=>{});
        await ctx.reply(text, {parse_mode:'Markdown', ...build(rows)}).catch(()=>{});
      }
      else if (respType==='voice') await ctx.telegram.sendVoice(ctx.chat.id, r.file_id, opts).catch(()=>{});
      else if (respType==='animation') await ctx.telegram.sendAnimation(ctx.chat.id, r.file_id, opts).catch(()=>{});
      else if (respType==='document') await ctx.telegram.sendDocument(ctx.chat.id, r.file_id, opts).catch(()=>{});
      ctx.answerCbQuery().catch(()=>{});
      return;
    } catch(_) {}
  }

  return eos(ctx, text, { parse_mode:'Markdown', ...build(rows) });
}

// ══════════════════════════════════════════
// 🎮 إعدادات الألعاب
// ══════════════════════════════════════════
async function showGamesSettings(ctx) {
  const { get: dbGet } = require('../database/db');
  const keys = ['million_prize_currency','million_question_time','million_max_players','million_join_time'];
  const labels = {
    'million_prize_currency': '💰 عملة الجائزة',
    'million_question_time':  '⏱ وقت السؤال (ثانية)',
    'million_max_players':    '👥 أقصى لاعبين',
    'million_join_time':      '⏳ وقت الانضمام (ثانية)',
  };
  const defaults = {
    'million_prize_currency': 'دج',
    'million_question_time':  '30',
    'million_max_players':    '30',
    'million_join_time':      '20',
  };

  let text = '🎮 *إعدادات الألعاب*\n━━━━━━━━━━━━━━━\n\n';
  text += '🏆 *من سيربح المليون:*\n';
  const rows = [];
  for (const key of keys) {
    const val = await dbGet('SELECT value FROM settings WHERE key=$1',[key]).catch(()=>null);
    const v = val?.value || defaults[key];
    text += '• ' + labels[key] + ': `' + v + '`\n';
    rows.push([btn('✏️ ' + labels[key], 'mg_gs_' + key)]);
  }
  rows.push([btn('🗂 إدارة أسئلة المليون', 'mg_million_q')]);
  rows.push(back('mg_menu'));
  return eos(ctx, text, { parse_mode:'Markdown', ...build(rows) });
}


// ══════════════════════════════════════════
// إدارة أسئلة المليون
// ══════════════════════════════════════════
async function showMillionQPanel(ctx) {
  const { all: dbAll } = require('../database/db');
  const rows  = await dbAll("SELECT difficulty, COUNT(*) as c FROM million_questions WHERE is_active=1 GROUP BY difficulty").catch(()=>[]);
  const total = await dbAll("SELECT COUNT(*) as c FROM million_questions WHERE is_active=1").then(r=>r[0]?.c||0).catch(()=>0);
  const diff  = { easy:'🟢 سهل', medium:'🟡 متوسط', hard:'🔴 صعب' };
  let stats = '';
  for (const r of rows) stats += `\n  ${diff[r.difficulty]||r.difficulty}: ${r.c}`;
  const txt = `🎯 *إدارة أسئلة المليون*\n\n📊 إجمالي نشط: ${total}${stats}\n\n💡 اختر:`;
  const kb = [
    [{ text: '📋 قائمة الأسئلة', callback_data: 'mg_mq_list_1' }],
    [{ text: '➕ إضافة سؤال',    callback_data: 'mg_mq_add'    },
     { text: '🗑 حذف سؤال',      callback_data: 'mg_mq_del'    }],
    [{ text: '◀️ رجوع',           callback_data: 'mg_settings'  }],
  ];
  await ctx.editMessageText(txt, { parse_mode:'Markdown', reply_markup:{ inline_keyboard: kb }}).catch(()=>
    ctx.reply(txt, { parse_mode:'Markdown', reply_markup:{ inline_keyboard: kb }})
  );
}

async function showMillionQList(ctx, page) {
  page = page || 1;
  const { all: dbAll } = require('../database/db');
  const PER = 8, offset = (page-1)*PER;
  const rows = await dbAll(
    "SELECT id,question,correct,difficulty,is_active FROM million_questions ORDER BY id DESC LIMIT $1 OFFSET $2",
    [PER+1, offset]
  ).catch(()=>[]);
  const hasNext = rows.length > PER;
  const items = rows.slice(0, PER);
  if (!items.length) return ctx.answerCbQuery('لا توجد أسئلة.', { show_alert:true }).catch(()=>{});
  const de = { easy:'🟢', medium:'🟡', hard:'🔴' };
  let txt = `📋 *أسئلة المليون* — صفحة ${page}\n\n`;
  for (const q of items) {
    const st = q.is_active ? '✅' : '❌';
    const qt = q.question.length > 45 ? q.question.slice(0,42)+'...' : q.question;
    txt += `${st}${de[q.difficulty]||'⚪'} \[${q.id}\] ${qt}\n`;
  }
  const nav = [];
  if (page > 1)  nav.push({ text:'◀️', callback_data:'mg_mq_list_'+(page-1) });
  if (hasNext)   nav.push({ text:'▶️', callback_data:'mg_mq_list_'+(page+1) });
  const kb = [];
  if (nav.length) kb.push(nav);
  kb.push([{ text:'◀️ رجوع', callback_data:'mg_million_q' }]);
  await ctx.editMessageText(txt, { parse_mode:'Markdown', reply_markup:{ inline_keyboard: kb }}).catch(()=>
    ctx.reply(txt, { parse_mode:'Markdown', reply_markup:{ inline_keyboard: kb }})
  );
}

async function startMillionQAdd(ctx) {
  const { setState } = require('../utils/stateManager');
  await setState(String(ctx.uid || ctx.from?.id), { type:'mq_wizard_q' });
  await ctx.reply(
    '➕ *إضافة سؤال — الخطوة 1/6*\n\n❓ أرسل نص السؤال:',
    { parse_mode:'Markdown', reply_markup:{ inline_keyboard:[[{ text:'❌ إلغاء', callback_data:'mg_million_q' }]] }}
  ).catch(()=>{});
}

async function startMillionQDel(ctx) {
  const { setState } = require('../utils/stateManager');
  setState(ctx.from.id, { type:'mq_del_q' });
  await ctx.editMessageText(
    '🗑 *حذف سؤال*\n\n🔢 أرسل رقم ID السؤال:\n_(شوف الأرقام من قائمة الأسئلة)_',
    { parse_mode:'Markdown', reply_markup:{ inline_keyboard:[[{ text:'❌ إلغاء', callback_data:'mg_million_q' }]] }}
  ).catch(()=> ctx.reply('🔢 أرسل رقم السؤال:').catch(()=>{}));

}

module.exports={showAutoReplyDetail,mainMenu,handleCallback,handleText,handleFileUpload,handleBulkUpload,showUserProfile,showUsers,handleBundleFileUpload};
