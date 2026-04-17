async function mainMenu(ctx){
  const uid=ctx.uid;
  const [specs0, files0] = await Promise.all([content.getSpecs(), filesDb.totalFiles()]);
  const text='🛠 *لوحة الإدارة*\n\n📚 التخصصات: *'+specs0.length+'*\n📁 الملفات: *'+files0+'*\n🔧 الصيانة: *'+(global.maintenanceMode?'🔴 مفعّل':'🟢 متوقف')+'*';
  const rows=[[btn('📂 المحتوى','mg_content')],[btn('📊 الإحصائيات','mg_analytics'),btn('📜 السجلات','mg_logs')]];
  if(isOwner(uid)){
    rows.push([btn('📢 بث','mg_broadcast'),btn('👥 المستخدمون','mg_users')]);
    rows.push([btn('👑 الإداريون','mg_admins')]);
    rows.push([btn('💾 نسخ احتياطي','mg_backup'),btn(global.maintenanceMode?'🟢 إيقاف الصيانة':'🔴 وضع الصيانة','mg_maint')]);
    rows.push([btn('♻️ استعادة','mg_restore'),btn('🗑 سلة المحذوفات','mg_trash')]);
    rows.push([btn('🔔 إشعار للمستخدمين','mg_notify'),btn('📣 إشعار القروبات','mg_notify_groups')]);
  rows.push([btn('🚩 البلاغات','mg_reports')]);
    rows.push([btn('📨 نظام الرسائل','mg_msgs')]);
    rows.push([btn('🎓 إشعار لتخصص','mg_notify_sp')]);
  }
  rows.push([btn('🏠 القائمة الرئيسية','main_menu')]);
  return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});
}

async function showContent(ctx){
  const uid=ctx.uid;
  const adminSp=ctx.isOwner?0:await adminsDb.getAdminSpecialty(uid);
  let specs=await content.getSpecs();
  if(adminSp&&adminSp!=0) specs=specs.filter(s=>s.id==adminSp);
  const rows=specs.map(s=>[btn('🎓 '+s.name,'mg_yrs_'+s.id),btn('✏️','mg_rn_sp_'+s.id),btn('🗑','mg_dl_sp_'+s.id)]);
  rows.push([btn('➕ إضافة تخصص','mg_add_sp')]);
  rows.push([btn('🗑 حذف الكل نهائياً','mg_empty_trash')]);
  rows.push(back('mg_menu'));
  return eos(ctx,'🎓 *التخصصات*'+(specs.length?'':'\n_لا يوجد._'),{parse_mode:'Markdown',...build(rows)});
}

async function showYears(ctx,spId){
  const [sp, years] = await Promise.all([content.getSpec(spId), content.getYears(spId)]);
  const rows=years.map(y=>[btn('📅 '+y.name,'mg_sems_'+spId+'_'+y.id),btn('✏️','mg_rn_yr_'+spId+'_'+y.id),btn('🗑','mg_dl_yr_'+spId+'_'+y.id)]);
  rows.push([btn('➕ إضافة سنة','mg_add_yr_'+spId)]);
  rows.push(back('mg_content'));
  return eos(ctx,'🎓 *'+escMd(sp?.name)+'*\n📅 السنوات',{parse_mode:'Markdown',...build(rows)});
}

async function showSemesters(ctx,spId,yrId){
  const [sp, yr, sems] = await Promise.all([content.getSpec(spId), content.getYear(yrId), content.getSemesters(yrId)]);
  const rows=sems.map(s=>[btn('📆 '+s.name,'mg_sbs_'+spId+'_'+yrId+'_'+s.id),btn('✏️','mg_rn_sem_'+spId+'_'+yrId+'_'+s.id),btn('🗑','mg_dl_sem_'+spId+'_'+yrId+'_'+s.id)]);
  rows.push([btn('➕ إضافة فصل','mg_add_sem_'+spId+'_'+yrId)]);
  rows.push(back('mg_yrs_'+spId));
  return eos(ctx,buildPath([escMd(sp?.name),escMd(yr?.name)])+'\n📆 الفصول',{parse_mode:'Markdown',...build(rows)});
}

async function showSubjects(ctx,spId,yrId,smId){
  const [sm, subs] = await Promise.all([content.getSemester(smId), content.getSubjects(smId)]);
  const rows=subs.map(s=>[btn('📖 '+s.name,'mg_cats_'+spId+'_'+yrId+'_'+smId+'_'+s.id),btn('✏️','mg_rn_sb_'+spId+'_'+yrId+'_'+smId+'_'+s.id),btn('🗑','mg_dl_sb_'+spId+'_'+yrId+'_'+smId+'_'+s.id)]);
  rows.push([btn('➕ إضافة مادة','mg_add_sb_'+spId+'_'+yrId+'_'+smId)]);
  rows.push(back('mg_sems_'+spId+'_'+yrId));
  return eos(ctx,'📆 *'+escMd(sm?.name)+'*\n📖 المواد',{parse_mode:'Markdown',...build(rows)});
}

async function showCategories(ctx,spId,yrId,smId,sbId){
  const [sb, cats] = await Promise.all([content.getSubject(sbId), content.getCategories(sbId)]);
  const rows=cats.map(c=>[btn('📁 '+c.name,'mg_fls_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+c.id),btn('✏️','mg_rn_cat_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+c.id),btn('🗑','mg_dl_cat_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+c.id)]);
  rows.push([btn('➕ إضافة فئة','mg_add_cat_'+spId+'_'+yrId+'_'+smId+'_'+sbId)]);
  rows.push(back('mg_sbs_'+spId+'_'+yrId+'_'+smId));
  return eos(ctx,'📖 *'+escMd(sb?.name)+'*\n📁 الفئات',{parse_mode:'Markdown',...build(rows)});
}

async function showMgFiles(ctx,spId,yrId,smId,sbId,catId,page=0){
  const [cat, all2] = await Promise.all([content.getCategory(catId), filesDb.getFiles(catId)]);
  const total=all2.length; const list=all2.slice(page*PS,(page+1)*PS);
  let text='📁 *'+escMd(cat?.name)+'*\n━━━━━━━━━━━━\n'+(total?'📄 *'+total+' ملف*':'_لا توجد ملفات._');
  const rows=[];
  list.forEach(f=>{
    rows.push([btn('📄 '+f.title,'preview_'+f.id+'_0_0_0_0_0')]);
    rows.push([btn('✏️','mg_rn_fl_'+[spId,yrId,smId,sbId,catId,f.id].join('_')),btn('📝','mg_desc_fl_'+[spId,yrId,smId,sbId,catId,f.id].join('_')),btn('🗑','mg_dl_fl_'+[spId,yrId,smId,sbId,catId,f.id].join('_'))]);
  });
  if(total>PS){const nav=[];if(page>0)nav.push(btn('⬅️','mg_fls_pg_'+[spId,yrId,smId,sbId,catId,page-1].join('_')));nav.push(btn((page+1)+'/'+Math.ceil(total/PS),'noop'));if((page+1)*PS<total)nav.push(btn('➡️','mg_fls_pg_'+[spId,yrId,smId,sbId,catId,page+1].join('_')));rows.push(nav);}
  const bundles2 = await bundlesDb.getBundles(catId);
  if(bundles2.length){
    rows.unshift([btn('━━━ الحزم ('+bundles2.length+') ━━━','noop')]);
    bundles2.forEach(b=>{ rows.splice(1,0,[btn('📦 '+b.title,'bundle_'+b.id+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId)]); });
  }
  const uploadRow=[
    btn('➕ رفع ملف','mg_upl_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId),
    btn('📤 رفع متعدد','mg_upl_bulk_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId)
  ];
  if(ctx.isOwner) uploadRow.push(btn('📦 حزمة','mg_add_bundle_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId));
  rows.push(uploadRow);
  rows.push(back('mg_cats_'+spId+'_'+yrId+'_'+smId+'_'+sbId));
  return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});
}

async function showAnalytics(ctx){
  const _ckey="analytics_admin";
  const _cc=cacheGet(_ckey);
  if(_cc) return eos(ctx,_cc.text,{parse_mode:"Markdown",...build(_cc.rows)});
  const [top, recent, totalUsers, activeToday, totalFiles, totalDl, specs, totalGroups, topGroups] = await Promise.all([
    filesDb.topDownloaded(5), filesDb.recentFiles(5), usersDb.count(),
    usersDb.activeToday(), filesDb.totalFiles(), filesDb.totalDownloads(), content.getSpecs(),
    all('SELECT COUNT(*) as c FROM group_chats').then(r=>r[0]?.c||0),
    all('SELECT gc.title, sp.name as sp_name, COUNT(gm.user_id) as members FROM group_chats gc LEFT JOIN specialties sp ON gc.specialty_id=sp.id LEFT JOIN group_members gm ON gc.chat_id=gm.chat_id GROUP BY gc.chat_id, gc.title, sp.name ORDER BY members DESC LIMIT 5')
  ]);
  const [spDist, topUsers, peakHours, topCats] = await Promise.all([
    all(`SELECT sp.name, COUNT(us.user_id) as cnt FROM user_specialties us LEFT JOIN specialties sp ON us.specialty_id=sp.id GROUP BY sp.name ORDER BY cnt DESC LIMIT 5`),
    all(`SELECT u.first_name, u.username, COUNT(h.id) as cnt FROM history h LEFT JOIN users u ON h.user_id=u.id GROUP BY h.user_id, u.first_name, u.username ORDER BY cnt DESC LIMIT 5`),
    all(`SELECT EXTRACT(HOUR FROM viewed_at::timestamp) as hour, COUNT(*) as cnt FROM history GROUP BY hour ORDER BY cnt DESC LIMIT 3`),
    all(`SELECT c.name, COUNT(h.id) as cnt FROM history h LEFT JOIN files f ON h.file_id=f.id LEFT JOIN categories c ON f.category_id=c.id WHERE h.viewed_at >= NOW() - INTERVAL '7 days' GROUP BY c.name ORDER BY cnt DESC LIMIT 3`)
  ]);
  let text='📊 *لوحة الإحصائيات المتقدمة*\n━━━━━━━━━━━━\n';
  text+='👥 المستخدمون: *'+totalUsers+'*\n🟢 نشطون اليوم: *'+activeToday+'*\n📁 الملفات: *'+totalFiles+'*\n⬇️ التحميلات: *'+totalDl+'*\n🎓 التخصصات: *'+specs.length+'*\n👥 القروبات: *'+totalGroups+'*\n';
  text+='\n📣 *أكبر القروبات:*\n';
  if(topGroups.length) topGroups.forEach((g,i)=>{ text+=(i+1)+'. '+escMd(g.title||'بدون اسم')+' ('+(g.sp_name||'بدون تخصص')+') — *'+g.members+'* عضو\n'; });
  else text+='_لا قروبات._\n';
  text+='\n🎓 *توزيع التخصصات:*\n';
  if(spDist.length) spDist.forEach((s,i)=>{ text+=(i+1)+'. '+escMd(s.name||'غير محدد')+' — *'+s.cnt+'* مستخدم\n'; });
  else text+='_لا بيانات._\n';
  text+='\n🏆 *أكثر المستخدمين نشاطاً:*\n';
  if(topUsers.length) topUsers.forEach((u,i)=>{ text+=(i+1)+'. '+(escMd(u.first_name)||'مجهول')+(u.username?' @'+escMd(u.username):'')+' — *'+u.cnt+'* تحميل\n'; });
  else text+='_لا بيانات._\n';
  text+='\n⏰ *أوقات الذروة:*\n';
  if(peakHours.length) peakHours.forEach((h,i)=>{ text+=(i+1)+'. الساعة *'+Math.round(h.hour)+':00* — *'+h.cnt+'* نشاط\n'; });
  else text+='_لا بيانات._\n';
  text+='\n📁 *أكثر الفئات هذا الأسبوع:*\n';
  if(topCats.length) topCats.forEach((c,i)=>{ text+=(i+1)+'. '+escMd(c.name||'غير محدد')+' — *'+c.cnt+'* تحميل\n'; });
  else text+='_لا بيانات._\n';
  text+='\n🏆 *الأكثر تحميلاً:*\n';
  top.forEach((f,i)=>{ text+=(i+1)+'. '+escMd(f.title)+' ⬇️*'+f.downloads+'*\n'; });
  text+='\n🆕 *أحدث الملفات:*\n';
  recent.forEach((f,i)=>{ text+=(i+1)+'. '+escMd(f.title)+'\n'; });
  const rows=[[btn('🔄 تحديث','mg_analytics')],back('mg_menu')];
  cacheSet(_ckey,{text,rows},600000);
  return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});
}

async function showLogs(ctx){
  const _lk='admin_logs';
  const _lc=cacheGet(_lk);
  const logs=_lc||await interactions.getLogs(20);
  if(!_lc) cacheSet(_lk,logs,60000);
  let text='📜 *آخر السجلات*\n\n';
  if(logs.length) logs.forEach(l=>{ text+='• '+(l.first_name||'ID:'+l.user_id)+': '+l.action+(l.details?' — '+l.details:'')+'\n'; });
  else text+='_لا توجد سجلات._';
  return eos(ctx,text,{parse_mode:'Markdown',...build([back('mg_menu')])});
}

async function showUsers(ctx,page=0){
  const _uk='admin_users_'+page;
  const _uc=cacheGet(_uk);
  const [list, total] = _uc ? [_uc.list,_uc.total] : await Promise.all([usersDb.getAll(page,PS), usersDb.count()]).then(([l,t])=>{cacheSet(_uk,{list:l,total:t},30000);return[l,t];});
  let text='👥 *المستخدمون ('+total+')*\n\n';
  list.forEach((u,i)=>{
    const j=u.joined_at?new Date(u.joined_at).toLocaleDateString("en-GB"):"?";
    const a=u.last_active?new Date(u.last_active).toLocaleDateString("en-GB"):"?";
    text+=(page*PS+i+1)+". "+esc(u.first_name)+(u.username?" @"+esc(u.username):" ID:"+u.id)+(u.is_banned?" 🚫":"")+"\n   📅 "+j+" | 🕐 "+a+"\n";
  });
  const rows=list.map(u=>[
    btn('👤 '+(u.first_name||u.id),'mg_profile_'+u.id),
    btn(u.is_banned?'✅':'🚫',(u.is_banned?'mg_unban_':'mg_ban_')+u.id)
  ]);
  const nav=[];
  if(page>0) nav.push(btn('⬅️','mg_users_p'+(page-1)));
  nav.push(btn((page+1)+'/'+Math.ceil(total/PS),'noop'));
  if((page+1)*PS<total) nav.push(btn('➡️','mg_users_p'+(page+1)));
  if(nav.length) rows.push(nav);
  rows.push(back('mg_menu'));
  return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});
}

async function showUserProfile(ctx, userId) {
  const [user, dlCount, favCount, spRow, lastFile] = await Promise.all([
    usersDb.getById(userId),
    interactions.getUserDownloadCount(userId),
    require('../../database/db').get('SELECT COUNT(*) as c FROM favorites WHERE user_id=?',[userId]).then(r=>r?.c||0),
    usersDb.getSpecialty(userId),
    interactions.getLastFile(userId)
  ]);
  const favs = { length: favCount };
  if (!user) return ctx.reply('❌ المستخدم غير موجود.');
  const spId = spRow?.specialty_id;
  const sp = spId&&spId!=0 ? await content.getSpec(spId) : null;
  const text = '👤 *بروفايل المستخدم*\n\n' +
    '🆔 ID: `' + userId + '`\n' +
    '👋 الاسم: ' + escMd(user.first_name||'؟') + ' ' + escMd(user.last_name||'') + '\n' +
    (user.username ? '📛 @' + escMd(user.username) + '\n' : '') +
    '📅 انضم: ' + (user.joined_at ? new Date(user.joined_at).toLocaleDateString('en-GB') : '؟') + '\n' +
    '🕐 آخر نشاط: ' + (user.last_active ? new Date(user.last_active).toLocaleDateString('en-GB') : '؟') + '\n' +
    '🎓 التخصص: *' + escMd(sp ? (sp.name||'غير محدد') : 'غير محدد') + '*\n' +
    '🚫 محظور: ' + (user.is_banned ? 'نعم' : 'لا') + '\n\n' +
    '📊 *النشاط:*\n' +
    '⬇️ التحميلات: *' + dlCount + '*\n' +
    '⭐ المفضلة: *' + favs.length + '*' +
    (lastFile ? '\n📄 آخر ملف: *' + escMd(lastFile.title||'') + '*' : '');
  const rows = [
    [btn(user.is_banned ? '✅ إلغاء الحظر' : '🚫 حظر', (user.is_banned ? 'mg_unban_' : 'mg_ban_') + userId)],
    [back('mg_users')[0]]
  ];
  return eos(ctx, text, {parse_mode:'Markdown', ...build(rows)});
}

const ALL_PERMS=['upload','delete','add_content','view_users','full'];
const PERM_LABELS={upload:'📤 رفع',delete:'🗑 حذف',add_content:'➕ إضافة محتوى',view_users:'👥 مشاهدة المستخدمين',full:'👑 كل الصلاحيات'};

async function showEditPerms(ctx,adminId){
  const list=await adminsDb.getAll();
  const admin=list.find(a=>a.user_id==adminId);
  const currentPerms=(admin.permissions||'upload,add_content').split(',').map(p=>p.trim());
  const text="⚙️ صلاحيات "+(admin.first_name||adminId);
  const rows=ALL_PERMS.map(p=>[btn((currentPerms.includes(p)?'✅ ':'☐ ')+(PERM_LABELS[p]||p),'mg_tp_'+adminId+'_'+p)]);
  rows.push([btn('◀️ رجوع','mg_admins')]);
  return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});
}

async function showAdmins(ctx){
  const list=await adminsDb.getAll();
  // invalidate cache عند التعديل
  let text='👑 *الإداريون ('+list.length+')*\n\n';
  const rows=list.map(a=>{
    const perms=(a.permissions||'upload,add_content').split(',').map(p=>PERM_LABELS[p.trim()]||p).join(' | ');
    text+='• '+(escMd(a.first_name||'ID:'+a.user_id))+(a.username?' @'+escMd(a.username):'')+'\n  🔑 '+perms+'\n';
    return [btn('⚙️ '+(a.first_name||a.user_id),'mg_ep_'+a.user_id),btn('🗑','mg_da_'+a.user_id)];
  });
  rows.push([btn('➕ إضافة مشرف','mg_add_admin')]);
  rows.push(back('mg_menu'));
  return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});
}

async function showTrash(ctx){
  const list=await filesDb.getTrash();
  let text='🗑 *سلة المحذوفات ('+list.length+')*\n\n';
  if(!list.length) text+='_فارغة._';
  const rows=list.map(f=>[btn('📄 '+f.title,'noop'),btn('استعادة','mg_restore_fl_'+f.id)]);
  if(list.length) rows.push([btn('حذف الكل نهائيا','mg_empty_trash')]);
  rows.push(back('mg_menu'));
  return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});
}
async function showMsgsMenu(ctx){
  const templates=await messagesDb.getTemplates();
  const scheduled=await messagesDb.getScheduled();
  const text='📨 *نظام الرسائل*\n\n📝 القوالب: *'+templates.length+'*\n📅 المجدولة: *'+scheduled.length+'*';
  const rows=[[btn('📝 القوالب','mg_templates'),btn('📅 المجدولة','mg_scheduled')]];
  rows.push([btn('➕ قالب جديد','mg_add_template')]);
  rows.push(back('mg_menu'));
  return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});
}

async function showTemplates(ctx){
  const list=await messagesDb.getTemplates();
  const text='📝 *القوالب ('+list.length+')*';
  const rows=list.map(t=>[btn(t.name,'mg_tpl_'+t.id)]);
  rows.push([btn('➕ قالب جديد','mg_add_template')]);
  rows.push(back('mg_msgs'));
  return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});
}

async function showScheduled(ctx){
  const list=await messagesDb.getScheduled();
  const text='📅 *المجدولة ('+list.length+')*';
  const rows=list.map(s=>[btn((s.name||'رسالة')+' — '+s.send_at,'noop'),btn('🗑','mg_del_sched_'+s.id)]);
  rows.push(back('mg_msgs'));
  return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});
}

async function handleBundleFileUpload(ctx){
  const uid=ctx.uid; const state=global.userStates?.[uid];
  if(!state||state.type!=='mg_bundle_files') return false;
  const msg=ctx.message; let fid,ftype,title='';
  if(msg.document){fid=msg.document.file_id;ftype='document';title=msg.document.file_name||'';}
  else if(msg.photo){fid=msg.photo[msg.photo.length-1].file_id;ftype='photo';}
  else if(msg.video){fid=msg.video.file_id;ftype='document';}
  else if(msg.audio){fid=msg.audio.file_id;ftype='document';}
  else if(msg.voice){fid=msg.voice.file_id;ftype='document';}
  else return false;
  await bundlesDb.addBundleFile(state.bundleId,fid,ftype,title);
  state.fileCount=(state.fileCount||0)+1;
  await ctx.reply('✅ ملف '+state.fileCount+' تم الحفظ. ابعث المزيد أو /done للانتهاء.');
  return true;
}

async function handleBulkUpload(ctx){
  const uid=ctx.uid;
  const state=global.userStates?.[uid];
  if(!state||state.type!=='mg_bulk_files') return false;
  const msg=ctx.message;
  let fid,ftype,title='';

  if(msg.document){
    fid=msg.document.file_id;
    ftype='document';
    title=msg.document.file_name||msg.caption||('ملف_'+Date.now());
    title=title.replace(/.[^/.]+$/,'').trim()||('ملف_'+Date.now());
  } else if(msg.photo){
    fid=msg.photo[msg.photo.length-1].file_id;
    ftype='photo';
    title=msg.caption||('صورة_'+Date.now());
  } else if(msg.video){
    fid=msg.video.file_id;
    ftype='document';
    title=msg.video.file_name||msg.caption||('فيديو_'+Date.now());
    title=title.replace(/.[^/.]+$/,'').trim()||('فيديو_'+Date.now());
  } else if(msg.audio){
    fid=msg.audio.file_id;
    ftype='document';
    title=msg.audio.title||msg.audio.file_name||msg.caption||('صوت_'+Date.now());
  } else {
    return false;
  }

  // أضف prefix إذا موجود
  const finalTitle = state.prefix ? state.prefix+' — '+title : title;

  try {
    await filesDb.addFile(state.catId,finalTitle,'',fid,ftype,uid);
    state.uploaded = state.uploaded||[];
    state.uploaded.push(finalTitle);
    // تأكيد سريع بدون react
    ctx.reply('✅ '+finalTitle).catch(()=>{});
  } catch(e) {
    state.failed = state.failed||[];
    if(e.message==='exists'){
      state.failed.push(finalTitle+' (موجود)');
    } else {
      state.failed.push(finalTitle);
    }
  }
  return true;
}
