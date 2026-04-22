var { reg: cbReg } = require('../utils/cbRegistry');
var common      = require('../utils/common');
var escMd       = common.escMd;
var buildPath   = common.buildPath;
var starsDisplay = common.starsDisplay;
var safeInt     = require('../utils/validate').safeInt;
var { cacheGet, cacheSet, cacheClear, cacheClearPrefix } = require('../utils/cache');
var reportsDb   = require('../database/reports');
var content     = require('../database/content');
var bundlesDb   = require('../database/bundles');
var commentsDb  = require('../database/comments');
var filesDb     = require('../database/files');
var interactions = require('../database/interactions');
var { build, btn, back, backMenu } = require('../utils/keyboard');
var { eos } = require('../utils/helpers');
var { t } = require('../utils/i18n');
var PS = 8;

async function getPathData(spId,yrId,smId,sbId,catId){var key='path_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId;var cached=cacheGet(key);if(cached)return cached;var results=await Promise.all([spId&&spId!==0?content.getSpec(spId):null,yrId&&yrId!==0?content.getYear(yrId):null,smId&&smId!==0?content.getSemester(smId):null,sbId&&sbId!==0?content.getSubject(sbId):null,catId&&catId!==0?content.getCategory(catId):null]);var r={sp:results[0],yr:results[1],sm:results[2],sb:results[3],cat:results[4]};cacheSet(key,r,86400000);return r;}

async function showSpecs(ctx){var specs=await content.getSpecs();var rows=specs.map(function(s){return[btn('🎓 '+s.name,'sp_'+s.id)];});rows.push(back('main_menu'));return eos(ctx,'🎓 *اختر تخصصك:*',{parse_mode:'Markdown',...build(rows)});}

async function showYears(ctx,spId,page){spId=safeInt(spId);page=safeInt(page);var ckey='yrs_'+spId;var yd=cacheGet(ckey);if(!yd){var results=await Promise.all([content.getSpec(spId),content.getYears(spId)]);yd={sp:results[0],all:results[1]};cacheSet(ckey,yd,21600000);}var sp=yd.sp,all=yd.all;var total=all.length;var years=all.slice(page*PS,(page+1)*PS);if(!years.length)return eos(ctx,buildPath([escMd(sp?sp.name:'')])+'\\n\\n📭 لا توجد سنوات.',build([backMenu('browse')]));var rows=years.map(function(y){return[btn('📅 '+y.name,'yr_'+spId+'_'+y.id)];});if(total>PS){var nav=[];if(page>0)nav.push(btn('⬅️','yr_page_'+spId+'_'+(page-1)));nav.push(btn((page+1)+'/'+Math.ceil(total/PS),'noop'));if((page+1)*PS<total)nav.push(btn('➡️','yr_page_'+spId+'_'+(page+1)));rows.push(nav);}rows.push(backMenu('browse'));return eos(ctx,buildPath([escMd(sp?sp.name:'')])+'\\n\\n📅 *اختر السنة:*',{parse_mode:'Markdown',...build(rows)});}

async function showSemesters(ctx,spId,yrId){spId=safeInt(spId);yrId=safeInt(yrId);var ckey='sems_'+spId+'_'+yrId;var sd=cacheGet(ckey);if(!sd){var results=await Promise.all([content.getSpec(spId),content.getYear(yrId),content.getSemesters(yrId)]);sd={sp:results[0],yr:results[1],sems:results[2]};cacheSet(ckey,sd,21600000);}var sp=sd.sp,yr=sd.yr,sems=sd.sems;if(!sems.length)return eos(ctx,buildPath([escMd(sp?sp.name:''),escMd(yr?yr.name:'')])+'\\n\\n📭 لا توجد فصول.',build([backMenu('yrs_'+spId)]));var rows=sems.map(function(s){return[btn('📆 '+s.name,'sm_'+spId+'_'+yrId+'_'+s.id)];});rows.push(backMenu('yrs_'+spId));return eos(ctx,buildPath([escMd(sp?sp.name:''),escMd(yr?yr.name:'')])+'\\n\\n📆 *اختر الفصل:*',{parse_mode:'Markdown',...build(rows)});}

async function showSubjects(ctx,spId,yrId,smId,page){spId=safeInt(spId);yrId=safeInt(yrId);smId=safeInt(smId);page=safeInt(page);var ckey='subs_'+spId+'_'+yrId+'_'+smId;var subd=cacheGet(ckey);if(!subd){var results=await Promise.all([content.getSpec(spId),content.getYear(yrId),content.getSemester(smId),content.getSubjects(smId)]);subd={sp:results[0],yr:results[1],sm:results[2],all:results[3]};cacheSet(ckey,subd,21600000);}var sp=subd.sp,yr=subd.yr,sm=subd.sm,all=subd.all;var total=all.length;var subs=all.slice(page*PS,(page+1)*PS);if(!subs.length)return eos(ctx,buildPath([escMd(sp?sp.name:''),escMd(yr?yr.name:''),escMd(sm?sm.name:'')])+'\\n\\n📭 لا توجد مواد.',build([backMenu('sm_'+spId+'_'+yrId)]));var rows=[];for(var i=0;i<subs.length;i+=2){var row=[btn('📖 '+subs[i].name,'sb_'+spId+'_'+yrId+'_'+smId+'_'+subs[i].id)];if(subs[i+1])row.push(btn('📖 '+subs[i+1].name,'sb_'+spId+'_'+yrId+'_'+smId+'_'+subs[i+1].id));rows.push(row);}if(total>PS){var nav=[];if(page>0)nav.push(btn('⬅️','sb_page_'+spId+'_'+yrId+'_'+smId+'_'+(page-1)));nav.push(btn((page+1)+'/'+Math.ceil(total/PS),'noop'));if((page+1)*PS<total)nav.push(btn('➡️','sb_page_'+spId+'_'+yrId+'_'+smId+'_'+(page+1)));rows.push(nav);}rows.push(backMenu('sms_'+spId+'_'+yrId));return eos(ctx,buildPath([escMd(sp?sp.name:''),escMd(yr?yr.name:''),escMd(sm?sm.name:'')])+'\\n\\n📖 *اختر المادة:*',{parse_mode:'Markdown',...build(rows)});}

async function showCategories(ctx,spId,yrId,smId,sbId){spId=safeInt(spId);yrId=safeInt(yrId);smId=safeInt(smId);sbId=safeInt(sbId);var ckey='cats_'+spId+'_'+yrId+'_'+smId+'_'+sbId;var catd=cacheGet(ckey);if(!catd){var results=await Promise.all([content.getSpec(spId),content.getYear(yrId),content.getSemester(smId),content.getSubject(sbId),content.getCategories(sbId)]);catd={sp:results[0],yr:results[1],sm:results[2],sb:results[3],cats:results[4]};cacheSet(ckey,catd,3600000);}var sp=catd.sp,yr=catd.yr,sm=catd.sm,sb=catd.sb,cats=catd.cats;if(!cats.length)return eos(ctx,buildPath([escMd(sp?sp.name:''),escMd(yr?yr.name:''),escMd(sm?sm.name:''),escMd(sb?sb.name:'')])+'\\n\\n📭 لا توجد فئات.',build([backMenu('sbs_'+spId+'_'+yrId+'_'+smId)]));var rows=cats.map(function(c){return[btn('📁 '+c.name,cbReg('ct_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+c.id))];});rows.push(backMenu('sbs_'+spId+'_'+yrId+'_'+smId));return eos(ctx,buildPath([escMd(sp?sp.name:''),escMd(yr?yr.name:''),escMd(sm?sm.name:''),escMd(sb?sb.name:'')])+'\\n\\n📁 *اختر القسم:*',{parse_mode:'Markdown',...build(rows)});}

async function showFiles(ctx,spId,yrId,smId,sbId,catId,page){spId=safeInt(spId);yrId=safeInt(yrId);smId=safeInt(smId);sbId=safeInt(sbId);catId=safeInt(catId);page=safeInt(page);var uid=ctx.uid;if(global.dedupRequest)return global.dedupRequest(uid,'sf_'+catId+'_'+page,function(){return _showFiles(ctx,spId,yrId,smId,sbId,catId,page);});return _showFiles(ctx,spId,yrId,smId,sbId,catId,page);}

async function _showFiles(ctx,spId,yrId,smId,sbId,catId,page){var uid=ctx.uid;var staticKey='showfiles_'+catId+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId;var staticData=cacheGet(staticKey);if(!staticData){var results=await Promise.all([getPathData(spId,yrId,smId,sbId,catId),filesDb.getFiles(catId),bundlesDb.getBundles(catId)]);staticData={pathData:results[0],allFiles:results[1],bundles:results[2]};cacheSet(staticKey,staticData,3600000);}var pd=staticData.pathData;var sp=pd.sp,yr=pd.yr,sm=pd.sm,sb=pd.sb,cat=pd.cat;var allFiles=staticData.allFiles,bundles=staticData.bundles;var total=allFiles.length;var list=allFiles.slice(page*PS,(page+1)*PS);var pathStr=buildPath([sp?sp.name:'',yr?yr.name:'',sm?sm.name:'',sb?sb.name:'',cat?cat.name:'']);var text=pathStr+'\\n━━━━━━━━━━━━\\n'+(total?'📄 *'+total+' ملف*':'لا توجد ملفات');var fileIds=list.map(function(f){return f.id;});var ratingKey='ratingbatch_static_'+catId+'_'+page;var ratingMap=cacheGet(ratingKey);if(!ratingMap){ratingMap=await interactions.getRatingBatch(fileIds);cacheSet(ratingKey,ratingMap,3600000);}var favKey='favbatch_'+uid+'_'+catId+'_'+page;var favMap=cacheGet(favKey);if(!favMap){favMap=await interactions.getFavBatch(uid,fileIds);cacheSet(favKey,favMap,300000);}var rows=list.map(function(f){var fav=favMap[f.id]||false;var avg=ratingMap[f.id]||0;var typeIcon=f.file_type==='link'?'🔗':f.file_type==='photo'?'🖼️':'📄';return[btn(typeIcon+' '+f.title+(avg>0?' ('+avg+'★)':''),cbReg('preview_'+f.id+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId)),btn(fav?'⭐':'☆','fav_'+f.id)];});if(total>PS){var nav=[];if(page>0)nav.push(btn('⬅️','ct_page_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId+'_'+(page-1)));nav.push(btn((page+1)+'/'+Math.ceil(total/PS),'noop'));if((page+1)*PS<total)nav.push(btn('➡️','ct_page_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId+'_'+(page+1)));rows.push(nav);}if(bundles.length){rows.unshift([btn('━━━ الحزم ('+bundles.length+') ━━━','noop')]);bundles.forEach(function(b){rows.splice(1,0,[btn('📦 '+b.title+' ('+b.downloads+' تحميل)',cbReg('bundle_'+b.id+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId))]);});}rows.push(backMenu('sbs_'+spId+'_'+yrId+'_'+smId));return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});}

async function showPreview(ctx,fid,spId,yrId,smId,sbId,catId){fid=safeInt(fid);spId=safeInt(spId);yrId=safeInt(yrId);smId=safeInt(smId);sbId=safeInt(sbId);catId=safeInt(catId);var uid=ctx.uid;if(global.dedupRequest)return global.dedupRequest(uid,'sp_'+fid,function(){return _showPreview(ctx,fid,spId,yrId,smId,sbId,catId);});return _showPreview(ctx,fid,spId,yrId,smId,sbId,catId);}

async function _showPreview(ctx,fid,spId,yrId,smId,sbId,catId){var uid=ctx.uid;var staticKey='prev_static_'+fid;var staticData=cacheGet(staticKey);if(!staticData){var results=await Promise.all([filesDb.getFile(fid),interactions.getAvgRating(fid),commentsDb.countComments(fid),interactions.favCount(fid)]);staticData={f:results[0],ratingData:results[1],commentCount:results[2],favCnt:results[3]};if(results[0])cacheSet(staticKey,staticData,3600000);}var f=staticData.f,ratingData=staticData.ratingData,commentCount=staticData.commentCount,favCnt=staticData.favCnt;if(!f)return ctx.reply(t(uid,'not_found'));var personalKey='personal_'+uid+'_'+fid;var personal=cacheGet(personalKey);if(!personal){personal=await interactions.getPreviewPersonal(uid,fid);cacheSet(personalKey,personal,300000);}var fav=personal.fav,userRating=personal.userRating,alreadyReported=personal.alreadyReported;var avg=ratingData.avg,cnt=ratingData.cnt;var text='📄 *'+escMd(f.title)+'*\n'+(f.description?'📝 _'+escMd(f.description)+'_\n':'')+'\n📁 '+escMd(f.cat_name)+' | 📖 '+escMd(f.sub_name)+'\n⬇️ *'+f.downloads+'* تحميل | ⭐ *'+favCnt+'* محفوظ\n💬 *'+commentCount+'* تعليق\n'+starsDisplay(avg,cnt);var backCb=catId!==0?'ct_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId:'main_menu';var ratingBtns=[1,2,3,4,5].map(function(i){return btn(i<=userRating?'⭐':'☆',cbReg('rate_'+fid+'_'+i+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId));});var rows=[[btn('⬇️ تحميل الملف',cbReg('fl_'+fid+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId))],[btn(fav?'⭐ محفوظ':'☆ حفظ','fav_'+fid),btn('💬 تعليقات ('+commentCount+')',cbReg('cmt_'+fid+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId))],ratingBtns,[btn(alreadyReported?'🚩 تم التبليغ':'⚠️ تبليغ عن مشكلة',alreadyReported?'noop':'report_'+fid+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId)],[btn('◀️ رجوع',backCb)]];return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});}

async function showReportMenu(ctx,fid,spId,yrId,smId,sbId,catId){var reasons=[['🔗 رابط معطوب','broken_link'],['📄 ملف تالف','corrupted'],['❌ ملف خاطئ','wrong_file'],['🔄 ملف مكرر','duplicate'],['⚠️ محتوى غير لائق','inappropriate']];var rows=reasons.map(function(r){return[btn(r[0],cbReg('do_report_'+fid+'_'+r[1]+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId))];});rows.push([btn('◀️ إلغاء',cbReg('preview_'+fid+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId))]);return eos(ctx,'⚠️ *تبليغ عن مشكلة*\n\nاختر نوع المشكلة:',{parse_mode:'Markdown',...build(rows)});}

async function doReport(ctx,fid,reason,spId,yrId,smId,sbId,catId){fid=safeInt(fid);var uid=ctx.uid;var already=await reportsDb.hasReported(uid,fid);if(already)return ctx.answerCbQuery('🚩 لقد أبلغت عن هذا الملف مسبقاً',{show_alert:true}).catch(function(){});await reportsDb.addReport(fid,uid,reason);await ctx.answerCbQuery('✅ تم إرسال التبليغ، شكراً!',{show_alert:true}).catch(function(){});
  try{var _oid=parseInt(process.env.OWNER_ID||'0');if(_oid)ctx.telegram.sendMessage(_oid,'🚩 *بلاغ جديد*\n📄 '+fid+'\n📋 '+reason+'\n👤 '+(ctx.from.first_name||String(uid)),{parse_mode:'Markdown'}).catch(function(){});}catch(_){}
  return showPreview(ctx,fid,spId,yrId,smId,sbId,catId);}

async function showComments(ctx,fid,spId,yrId,smId,sbId,catId,page){fid=safeInt(fid);page=safeInt(page);var cmtKey='cmts_'+fid+'_'+page;var cmtCached=cacheGet(cmtKey);var comments,f;if(cmtCached){comments=cmtCached.comments;f=cmtCached.f;}else{var r=await Promise.all([commentsDb.getComments(fid,50),filesDb.getFile(fid)]);comments=r[0];f=r[1];cacheSet(cmtKey,{comments,f},60000);}var CPS=5,total=comments.length,list=comments.slice(page*CPS,(page+1)*CPS);var text='💬 *تعليقات: '+escMd(f?f.title:'')+'*\n━━━━━━━━━━━━\n';if(!list.length)text+='_لا توجد تعليقات بعد._';else list.forEach(function(c){var name=escMd(c.first_name||'مجهول');var date=new Date(c.created_at).toLocaleDateString('en-GB');text+='\n👤 *'+name+'* — _'+date+'_\n'+escMd(c.text)+'\n';});var rows=[];if(ctx.isAdmin)list.forEach(function(c){rows.push([btn('🗑 '+c.text.substring(0,20),'dcmt_'+c.id+'_'+fid+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId)]);});var nav=[];if(page>0)nav.push(btn('⬅️','cmt_pg_'+fid+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId+'_'+(page-1)));if((page+1)*CPS<total)nav.push(btn('➡️','cmt_pg_'+fid+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId+'_'+(page+1)));if(nav.length)rows.push(nav);rows.push([btn('✍️ أضف تعليق',cbReg('add_cmt_'+fid+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId))]);rows.push([btn('◀️ رجوع',cbReg('preview_'+fid+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId))]);return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});}

// ✨ PROFESSIONAL ANIMATION: ⏳ → file appears clean → similar auto-deletes after 25s
async function sendFile(ctx, fid, spId, yrId, smId, sbId, catId) {
  fid = safeInt(fid);
  var uid = ctx.uid;
  var backCb = catId !== 0 ? 'ct_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId : 'main_menu';

  // Step 1: Transform preview → ⏳ (instant feedback)
  ctx.answerCbQuery('').catch(function(){});
  var loadEdited = false;
  try {
    await ctx.editMessageText('⏳', { reply_markup: { inline_keyboard: [] } });
    loadEdited = true;
  } catch(_) {}

  // Step 2: Telegram upload indicator
  ctx.sendChatAction('upload_document').catch(function(){});

  // Step 3: Get file data
  var f = await filesDb.getFile(fid);
  if (!f) {
    if (loadEdited) ctx.editMessageText('❌ ' + t(uid,'not_found'), { reply_markup: { inline_keyboard: [[{text:'🏠',callback_data:'main_menu'}]] } }).catch(function(){});
    else ctx.reply(t(uid,'not_found')).catch(function(){});
    return;
  }

  // Step 4: Parallel background work
  var bgRes = await Promise.all([
    interactions.getSimilar(fid, 4),
    interactions.isFav(uid, fid),
    filesDb.incDownloads(fid),
    interactions.addHistory(uid, fid),
    interactions.addLog(uid, 'download', f.title)
  ]);
  var similar = bgRes[0], fav = bgRes[1];

  var caption = '📄 *'+escMd(f.title)+'*\n'+(f.description?'📝 '+escMd(f.description)+'\n':'')+'📁 '+escMd(f.cat_name||'عام')+' | 📖 '+escMd(f.sub_name||'عام');
  var kb = build([[btn(fav?'⭐ محفوظ':'☆ حفظ','fav_'+fid)],[btn('◀️ رجوع',backCb),btn('🏠','main_menu')]]);

  try {
    // Step 5: Delete ⏳ — file arrives clean with no clutter
    ctx.deleteMessage().catch(function(){});

    // Step 6: Send the actual file
    if (f.file_type === 'link')
      await ctx.reply(caption+'\n\n🔗 '+f.file_id, { parse_mode:'Markdown', ...kb });
    else if (f.file_type === 'photo')
      await ctx.replyWithPhoto(f.file_id, { caption, parse_mode:'Markdown', ...kb });
    else
      await ctx.replyWithDocument(f.file_id, { caption, parse_mode:'Markdown', ...kb });

    // Step 7: Similar files — auto-delete after 25s (no clutter)
    if (similar.length) {
      var simRows = similar.map(sf => [btn('📄 '+sf.title.substring(0,30)+' · '+sf.sub_name,'preview_'+sf.id+'_0_0_0_0_0')]);
      simRows.push([btn('🏠','main_menu')]);
      var simMsg = await ctx.reply('📎 *ملفات قد تهمك:*', { parse_mode:'Markdown', ...build(simRows) }).catch(function(){});
      if (simMsg) setTimeout(function(){ ctx.telegram.deleteMessage(ctx.chat.id, simMsg.message_id).catch(function(){}); }, 25000);
    }
  } catch(e) {
    ctx.reply('❌ تعذر إرسال الملف. حاول مجدداً.').catch(function(){});
  }
}

async function showBundle(ctx,bundleId,spId,yrId,smId,sbId,catId){bundleId=safeInt(bundleId);var bkey='bundle_full_'+bundleId;var bcached=cacheGet(bkey);var b,files;if(bcached){b=bcached.b;files=bcached.files;}else{var r=await Promise.all([bundlesDb.getBundle(bundleId),bundlesDb.getBundleFiles(bundleId)]);b=r[0];files=r[1];if(b)cacheSet(bkey,{b,files},600000);}if(!b)return ctx.reply('الحزمة غير موجودة');var typeIcons={photo:'🖼️',document:'📄',video:'🎥',audio:'🎵',voice:'🎤',link:'🔗'};var typeCounts={};files.forEach(function(f){typeCounts[f.real_type]=(typeCounts[f.real_type]||0)+1;});var typeStr=Object.keys(typeCounts).map(function(tp){return(typeIcons[tp]||'📄')+' '+typeCounts[tp];}).join(' | ');var text='📦 *'+escMd(b.title)+'*'+(b.description?'\n📝 '+escMd(b.description):'')+'\n\n📁 *'+files.length+' ملف*\n'+typeStr+'\n\n⬇️ تحميل: *'+b.downloads+'*';var backCb=catId!==0?'ct_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId:'main_menu';var rows=[[btn('⬇️ تحميل الكل',cbReg('bdl_'+bundleId+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId))]];if(ctx.isAdmin){rows.push([btn('➕ إضافة ملفات',cbReg('mg_add_bundle_files_'+bundleId+'_'+catId+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId))]);rows.push([btn('✏️ تعديل',cbReg('mg_rn_bundle_'+bundleId+'_'+catId+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId)),btn('🗑 حذف',cbReg('mg_dl_bundle_'+bundleId+'_'+catId+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId))]);}rows.push([btn('◀️ رجوع',backCb)]);return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});}

async function sendBundle(ctx,bundleId,spId,yrId,smId,sbId,catId){bundleId=safeInt(bundleId);var bkey='bundle_full_'+bundleId;var bcached=cacheGet(bkey);var b,files;if(bcached){b=bcached.b;files=bcached.files;}else{var r=await Promise.all([bundlesDb.getBundle(bundleId),bundlesDb.getBundleFiles(bundleId)]);b=r[0];files=r[1];if(b)cacheSet(bkey,{b,files},600000);}if(!files.length)return ctx.reply('الحزمة فارغة');bundlesDb.incBundleDownloads(bundleId).catch(function(){});await ctx.reply('📦 *'+escMd(b.title)+'* — جاري الإرسال...',{parse_mode:'Markdown'});var photos=files.filter(f=>f.real_type==='photo');var docs=files.filter(f=>f.real_type==='document');var videos=files.filter(f=>f.real_type==='video');var audios=files.filter(f=>f.real_type==='audio'||f.real_type==='voice');var links=files.filter(f=>f.real_type==='link');if(photos.length){try{await ctx.replyWithMediaGroup(photos.map(f=>({type:'photo',media:f.file_id,caption:f.file_title||f.title||''})));}catch(e){for(var i=0;i<photos.length;i++)await ctx.replyWithPhoto(photos[i].file_id,{caption:photos[i].file_title||''}).catch(function(){});}}for(var i=0;i<videos.length;i++)await ctx.replyWithVideo(videos[i].file_id,{caption:videos[i].file_title||''}).catch(function(){});for(var i=0;i<docs.length;i++)await ctx.replyWithDocument(docs[i].file_id,{caption:docs[i].file_title||''}).catch(function(){});for(var i=0;i<audios.length;i++){if(audios[i].real_type==='voice')await ctx.replyWithVoice(audios[i].file_id).catch(function(){});else await ctx.replyWithAudio(audios[i].file_id,{caption:audios[i].file_title||''}).catch(function(){});}if(links.length){var linkMsg='🔗 *الروابط:*\n\n';links.forEach(function(l,i){linkMsg+=(i+1)+'. '+(l.file_title||l.title||'')+'\n'+l.file_id+'\n\n';});await ctx.reply(linkMsg,{parse_mode:'Markdown'});}var backCb=catId!==0?'ct_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId:'main_menu';await ctx.reply('✅ اكتمل الإرسال!',{...build([[btn('◀️ رجوع',backCb),btn('🏠','main_menu')]])});}

module.exports={showSpecs,showYears,showSemesters,showSubjects,showCategories,showFiles,showPreview,showReportMenu,doReport,showComments,sendFile,showBundle,sendBundle};
