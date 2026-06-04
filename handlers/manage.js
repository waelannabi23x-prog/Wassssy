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
  const text='🛠 *لوحة الإدارة*\n\n📚 التخصصات: *'+specs0.length+'*\n📁 الملفات: *'+files0+'*\n🔧 الصيانة: *'+(global.maintenanceMode?'🔴 مفعّل':'🟢 متوقف')+'*';
  const rows=[[btn('📂 المحتوى','mg_content')],[btn('📊 الإحصائيات','mg_analytics'),btn('📜 السجلات','mg_logs')]];
  if(isOwner(ctx.uid)){
    rows.push([btn('📢 بث','mg_broadcast'),btn('👥 المستخدمون','mg_users')]);
    rows.push([btn('👑 الإداريون','mg_admins')]);
    rows.push([btn('👥 القروبات','grp_main')]);
    rows.push([btn('💾 نسخ احتياطي','mg_backup'),btn(global.maintenanceMode?'🟢 إيقاف الصيانة':'🔴 وضع الصيانة','mg_maint')]);
    rows.push([btn('♻️ استعادة','mg_restore'),btn('🗑 سلة المحذوفات','mg_trash')]);
    rows.push([btn('🔔 إشعار للمستخدمين','mg_notify')]);
    if(process.env.CHANNEL_ID) rows.push([btn('📢 نشر في القناة','mg_post_channel')]);
    rows.push([btn('🚩 البلاغات','mg_reports'),btn('📨 نظام الرسائل','mg_msgs')]);
    rows.push([btn('🎓 إشعار لتخصص','mg_notify_sp')]);
  }
  if(isOwner(ctx.uid)){
    const appVisible = global._appPublic || false;
    rows.push([btn('📱 فتح Mini App','mg_open_app'), btn(appVisible ? '👁 ظاهر للكل' : '🔒 مخفي عن المستخدمين', 'mg_toggle_app')]);
  }
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
  const PAGE_SIZE = 15;
  const _uk = 'admin_users_' + page + '_' + filter;
  const _uc = cacheGet(_uk);
  let list, total;

  if (_uc) { list = _uc.list; total = _uc.total; }
  else {
    const whereClause = filter === 'banned'
      ? "WHERE is_banned=1"
      : filter === 'new'
      ? "WHERE joined_at > NOW() - INTERVAL '24 hours'"
      : "WHERE last_active > NOW() - INTERVAL '7 days'";

    [list, total] = await Promise.all([
      require('../database/db').all(
        `SELECT id, first_name, last_name, username, is_banned, last_active, joined_at
         FROM users ${whereClause}
         ORDER BY last_active DESC NULLS LAST
         LIMIT $1 OFFSET $2`,
        [PAGE_SIZE, page * PAGE_SIZE]
      ),
      require('../database/db').get(
        `SELECT COUNT(*) as c FROM users ${whereClause}`
      ).then(r => parseInt(r?.c || 0))
    ]);
    cacheSet(_uk, { list, total }, 30000);
  }

  const pages = Math.ceil(total / PAGE_SIZE) || 1;
  const filterLabel = { all: '🟢 النشطون 7 أيام', banned: '🚫 المحظورون', new: '🆕 جدد اليوم' }[filter];

  let text = '👥 *المستخدمون — ' + filterLabel + '*\n';
  text += '📊 الإجمالي: *' + total + '* | صفحة *' + (page+1) + '/' + pages + '*\n';
  text += '━━━━━━━━━━━━━━━\n\n';

  if (!list.length) {
    text += '_لا يوجد مستخدمون_';
  } else {
    list.forEach((u, i) => {
      const num = page * PAGE_SIZE + i + 1;
      const name = escMd((u.first_name || 'مجهول').substring(0, 15));
      const uname = u.username ? ' @' + escMd(u.username.substring(0, 12)) : '';
      const status = u.is_banned ? ' 🚫' : '';
      const days = u.last_active
        ? Math.floor((Date.now() - new Date(u.last_active)) / 86400000)
        : '?';
      const daysText = days === 0 ? 'اليوم' : days + 'ي';
      text += num + '. ' + name + uname + status + ' `' + u.id + '` _(' + daysText + ')_\n';
    });
  }

  // ── أزرار فلتر ──
  const filterRow = [
    btn(filter==='all'  ? '✅ النشطون' : '🟢 النشطون',  'mg_users_f_all'),
    btn(filter==='banned'? '✅ محظورون' : '🚫 محظورون', 'mg_users_f_banned'),
    btn(filter==='new'  ? '✅ جدد'     : '🆕 جدد',      'mg_users_f_new'),
  ];

  // ── أزرار المستخدمين — زر واحد فقط لكل مستخدم ──
  const userRows = list.map(u => [
    btn(
      (u.is_banned ? '🚫 ' : '👤 ') + (u.first_name || 'ID:' + u.id).substring(0, 20),
      'mg_profile_' + u.id
    )
  ]);

  // ── Navigation ──
  const nav = [];
  if (page > 0)                      nav.push(btn('⬅️ السابق', 'mg_users_p' + (page-1) + '_' + filter));
  if ((page+1) * PAGE_SIZE < total)  nav.push(btn('التالي ➡️', 'mg_users_p' + (page+1) + '_' + filter));

  const rows = [filterRow, ...userRows];
  if (nav.length) rows.push(nav);
  rows.push(back('mg_menu'));

  if (ctx.callbackQuery) ctx.deleteMessage().catch(() => {});
  return ctx.reply(text, { parse_mode: 'Markdown', ...build(rows) }).catch(e => {
    const plain = text.replace(/[*_`_]/g, '');
    return ctx.reply(plain, build(rows)).catch(() => {});
  });
}

async function showUserProfile(ctx,userId){const [user,dlCount,favCount,spRow,lastFile]=await Promise.all([usersDb.getById(userId),interactions.getUserDownloadCount(userId),require('../database/db').get('SELECT COUNT(*) as c FROM favorites WHERE user_id=$1',[userId]).then(r=>r?.c||0),usersDb.getSpecialty(userId),interactions.getLastFile(userId)]);if(!user) return ctx.reply('❌ المستخدم غير موجود.');const spId=spRow?.specialty_id;const sp=spId&&spId!=0?await content.getSpec(spId):null;const text='👤 *بروفايل المستخدم*\n\n🆔 ID: `'+userId+'`\n👋 الاسم: '+escMd(user.first_name||'؟')+' '+(user.last_name?escMd(user.last_name):'')+'\n'+(user.username?'📛 @'+escMd(user.username)+'\n':'')+'📅 انضم: '+(user.joined_at?new Date(user.joined_at).toLocaleDateString('en-GB'):'؟')+'\n🕐 آخر نشاط: '+(user.last_active?new Date(user.last_active).toLocaleDateString('en-GB'):'؟')+'\n🎓 التخصص: *'+escMd(sp?sp.name:'غير محدد')+'*\n🚫 محظور: '+(user.is_banned?'نعم':'لا')+'\n\n📊 *النشاط:*\n⬇️ التحميلات: *'+dlCount+'*\n⭐ المفضلة: *'+favCount+'*'+(lastFile?'\n📄 آخر ملف: *'+escMd(lastFile.title)+'*':'');const rows=[[btn(user.is_banned?'✅ إلغاء الحظر':'🚫 حظر',(user.is_banned?'mg_unban_':'mg_ban_')+userId)],[back('mg_users')[0]]];return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});}
const { ALL_PERMS: PERMS_MAP } = require('../database/admins');
const ALL_PERMS = Object.keys(PERMS_MAP);
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
      case 'mg_tpl_name':setState(uid,{...state,type:'mg_tpl_content',name:text,tplType:'auto',fileId:''});ctx.reply('📨 *'+escMd(text)+'*\n\nأرسل محتوى الرسالة:',{parse_mode:'Markdown',...build([[btn('❌ إلغاء','mg_templates')]])});break;
      case 'mg_tpl_content':{try{const msg2=ctx.message;let tplType='text',fileId='',tplContent=text||'';if(msg2.photo){tplType='photo';fileId=msg2.photo[msg2.photo.length-1].file_id;tplContent=msg2.caption||'';}else if(msg2.document){tplType='document';fileId=msg2.document.file_id;tplContent=msg2.caption||'';}else if(msg2.video){tplType='video';fileId=msg2.video.file_id;tplContent=msg2.caption||'';}else if(msg2.audio){tplType='audio';fileId=msg2.audio.file_id;tplContent=msg2.caption||'';}else if(text&&(text.startsWith('http')||text.startsWith('www'))){tplType='link';fileId=text;tplContent=text;}await messagesDb.addTemplate(state.name,tplType,tplContent,fileId);const savedTpl=await messagesDb.getTemplates();const lastTpl=savedTpl[0];clearState(uid);ctx.reply('✅ *تم حفظ القالب!*\nالنوع: '+tplType,{parse_mode:'Markdown',...build([[btn('📤 إرسال الآن','mg_send_now_'+lastTpl.id)],[btn('👥 كل المستخدمين','mg_sched_all_'+lastTpl.id)],[btn('🎓 تخصص معين','mg_sched_sp_'+lastTpl.id)],[btn('💾 حفظ فقط','mg_templates')]])});}catch(e){clearState(uid);ctx.reply(e.message==='exists'?'❌ قالب موجود!':'❌ '+e.message);}break;}
      case 'mg_sched_time':{try{await messagesDb.addScheduled(state.tplId,state.target,state.spId||0,text);clearState(uid);ctx.reply('✅ تمت الجدولة!',build([[btn('📅 المجدولة','mg_scheduled')]]));}catch(e){clearState(uid);ctx.reply('❌ '+e.message);}break;}
      default:break;
    }
  }catch(e){clearState(uid);ctx.reply(e.message==='exists'?'❌ موجود!':'❌ '+e.message);}
}
async function handleCallback(ctx,data){
  const uid=ctx.uid;
  try{
  if(data==='mg_content') return showContent(ctx);
  if(data==='mg_analytics') return showAnalytics(ctx);
  if(data==='mg_logs') return showLogs(ctx);
  if(data==='mg_users'){try{const p=ctx.isOwner?['full']:await adminsDb.getPerms(ctx.uid);if(!p.includes('full')&&!p.includes('view_users')) return ctx.answerCbQuery('ليس لديك صلاحية',{show_alert:true});return await showUsers(ctx);}catch(e){console.error('[mg_users]',e.message);return ctx.reply('❌ خطأ: '+e.message).catch(err => { require('../utils/logger').debug("[silent]", err.message); });}}
  if(data==='mg_admins') return showAdmins(ctx);
  if(data==='mg_trash') return showTrash(ctx);
  if(data==='mg_search_prompt'){setState(uid,{type:'mg_admin_search'});return ctx.reply('🔍 بحث:\nأدخل اسم ملف أو مستخدم:');}
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
  if(data==='mg_restore'){setState(uid,{type:'mg_awaiting_restore'});return eos(ctx,'♻️ *استعادة قاعدة البيانات*\n\n⚠️ سيتم استبدال البيانات!\n\nأرسل ملف `.db`:',{parse_mode:'Markdown',...build([back('mg_menu')])});}
  if(data==='mg_broadcast'){setState(uid,{type:'mg_broadcast'});return ctx.reply('📢 رسالة البث:\n_(أو /cancel)_',{parse_mode:'Markdown'});}
  if(data==='mg_add_admin'){setState(uid,{type:'mg_add_admin_id'});return ctx.reply('👤 ID المستخدم:\n_(أو /cancel)_',{parse_mode:'Markdown'});}
  if(data.startsWith('mg_admin_sp_')){const p=data.replace('mg_admin_sp_','').split('_');await adminsDb.setSpecialty(p[0],p[1]);return eos(ctx,'✅ تم تحديد التخصص',{...build([back('mg_admins')])});}
  if(data.startsWith('mg_da_')){const rid=parseInt(data.replace('mg_da_',''));await adminsDb.remove(rid);if(global.invalidateAdmin)global.invalidateAdmin(rid);return showAdmins(ctx);}
  if(data.startsWith('mg_ep_')) return showEditPerms(ctx,data.replace('mg_ep_',''));
  if(data.startsWith('mg_tp_')){const p=data.replace('mg_tp_','').split('_');const adminId=p[0];const perm=p.slice(1).join('_');const list=await adminsDb.getAll();const admin=list.find(a=>a.user_id==adminId);let perms=(admin.permissions||'').split(',').map(x=>x.trim()).filter(Boolean);if(perms.includes(perm)) perms=perms.filter(x=>x!==perm);else{if(perm==='full') perms=['full'];else{perms=perms.filter(x=>x!=='full');perms.push(perm);}}await adminsDb.updatePerms(adminId,perms.join(','));return showEditPerms(ctx,adminId);}
  if(data.startsWith('mg_profile_')) return showUserProfile(ctx,data.replace('mg_profile_',''));
  if(data.startsWith('mg_ban_')){const bid=parseInt(data.replace('mg_ban_',''));await usersDb.ban(bid);cacheClearPrefix('admin_users_');cacheClear('ban_'+bid);await interactions.addLog(uid,'ban',String(bid));return showUsers(ctx);}
  if(data.startsWith('mg_unban_')){const ubid=parseInt(data.replace('mg_unban_',''));await usersDb.unban(ubid);cacheClearPrefix('admin_users_');cacheClear('ban_'+ubid);return showUsers(ctx);}
  if(data.startsWith('mg_users_f_')) {
    const filter = data.replace('mg_users_f_','');
    return showUsers(ctx, 0, filter);
  }
  if(data.startsWith('mg_users_p')) {
    const parts = data.replace('mg_users_p','').split('_');
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

module.exports={mainMenu,handleCallback,handleText,handleFileUpload,handleBulkUpload,showUserProfile,showUsers,handleBundleFileUpload};

