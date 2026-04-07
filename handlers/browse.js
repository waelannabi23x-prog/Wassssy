const escMd = t => (t||'').replace(/[*_`\[\]()~>#+=|{}.!\-]/g,'\\$&');
const { cacheGet, cacheSet } = require('../utils/cache');
const reportsDb = require('../database/reports');

function formatSize(bytes) {
  if(!bytes || bytes===0) return '';
  if(bytes < 1024) return bytes+'B';
  if(bytes < 1024*1024) return (bytes/1024).toFixed(1)+'KB';
  return (bytes/(1024*1024)).toFixed(1)+'MB';
}

function starsDisplay(avg, cnt) {
  const full = Math.round(avg);
  return '⭐'.repeat(full)+'☆'.repeat(5-full)+(cnt?' '+avg+'/5 ('+cnt+' تقييم)':' لا يوجد تقييم');
}

const content = require('../database/content');
const bundlesDb = require('../database/bundles');
const commentsDb = require('../database/comments');
const filesDb = require('../database/files');
const interactions = require('../database/interactions');
const { build, btn, back, backMenu } = require('../utils/keyboard');
const { eos, buildPath } = require('../utils/helpers');
const { t } = require('../utils/i18n');

const PS = 8;

async function getPathData(spId, yrId, smId, sbId, catId) {
  const key = 'path_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId;
  const cached = cacheGet(key);
  if(cached) return cached;
  const [sp, yr, sm, sb, cat] = await Promise.all([
    spId && spId!=='0' ? content.getSpec(spId) : null,
    yrId && yrId!=='0' ? content.getYear(yrId) : null,
    smId && smId!=='0' ? content.getSemester(smId) : null,
    sbId && sbId!=='0' ? content.getSubject(sbId) : null,
    catId && catId!=='0' ? content.getCategory(catId) : null,
  ]);
  const result = {sp, yr, sm, sb, cat};
  cacheSet(key, result, 600000);
  return result;
}

async function showSpecs(ctx) {
  const specs = await content.getSpecs();
  if(!specs.length) return eos(ctx,'📭 لا توجد تخصصات بعد.',build([back('main_menu')]));
  const rows = specs.map(s=>[btn('🎓 '+s.name,'sp_'+s.id)]);
  rows.push(back('main_menu'));
  return eos(ctx,'🎓 *اختر تخصصك:*',{parse_mode:'Markdown',...build(rows)});
}

async function showYears(ctx,spId,page=0) {
  const [sp, all] = await Promise.all([content.getSpec(spId), content.getYears(spId)]);
  const total = all.length;
  const years = all.slice(page*PS,(page+1)*PS);
  if(!years.length) return eos(ctx,buildPath([escMd(sp?.name)])+'\n\n📭 لا توجد سنوات.',build([backMenu('browse')]));
  const rows = years.map(y=>[btn('📅 '+y.name,'yr_'+spId+'_'+y.id)]);
  if(total>PS){
    const nav=[];
    if(page>0) nav.push(btn('⬅️','yr_page_'+spId+'_'+(page-1)));
    nav.push(btn((page+1)+'/'+Math.ceil(total/PS),'noop'));
    if((page+1)*PS<total) nav.push(btn('➡️','yr_page_'+spId+'_'+(page+1)));
    rows.push(nav);
  }
  rows.push(backMenu('browse'));
  return eos(ctx,buildPath([sp?.name])+'\n\n📅 *اختر السنة:*',{parse_mode:'Markdown',...build(rows)});
}

async function showSemesters(ctx,spId,yrId) {
  const [sp, yr, sems] = await Promise.all([content.getSpec(spId), content.getYear(yrId), content.getSemesters(yrId)]);
  if(!sems.length) return eos(ctx,buildPath([sp?.name,yr?.name])+'\n\n📭 لا توجد فصول.',build([backMenu('yr_'+spId+'_'+yrId)]));
  const rows = sems.map(s=>[btn('📆 '+s.name,'sm_'+spId+'_'+yrId+'_'+s.id)]);
  rows.push(backMenu('yrs_'+spId+'_'+yrId));
  return eos(ctx,buildPath([escMd(sp?.name),escMd(yr?.name)])+'\n\n📆 *اختر الفصل:*',{parse_mode:'Markdown',...build(rows)});
}

async function showSubjects(ctx,spId,yrId,smId,page=0) {
  const [sp, yr, sm, all] = await Promise.all([content.getSpec(spId), content.getYear(yrId), content.getSemester(smId), content.getSubjects(smId)]);
  const total = all.length;
  const subs = all.slice(page*PS,(page+1)*PS);
  if(!subs.length) return eos(ctx,buildPath([sp?.name,yr?.name,sm?.name])+'\n\n📭 لا توجد مواد.',build([backMenu('sm_'+spId+'_'+yrId+'_'+smId)]));
  const rows = subs.map(s=>[btn('📖 '+s.name,'sb_'+spId+'_'+yrId+'_'+smId+'_'+s.id)]);
  if(total>PS){
    const nav=[];
    if(page>0) nav.push(btn('⬅️','sb_page_'+spId+'_'+yrId+'_'+smId+'_'+(page-1)));
    nav.push(btn((page+1)+'/'+Math.ceil(total/PS),'noop'));
    if((page+1)*PS<total) nav.push(btn('➡️','sb_page_'+spId+'_'+yrId+'_'+smId+'_'+(page+1)));
    rows.push(nav);
  }
  rows.push(backMenu('sms_'+spId+'_'+yrId+'_'+smId));
  return eos(ctx,buildPath([escMd(sp?.name),escMd(yr?.name),escMd(sm?.name)])+'\n\n📖 *اختر المادة:*',{parse_mode:'Markdown',...build(rows)});
}

async function showCategories(ctx,spId,yrId,smId,sbId) {
  const [sp, yr, sm, sb, cats] = await Promise.all([content.getSpec(spId), content.getYear(yrId), content.getSemester(smId), content.getSubject(sbId), content.getCategories(sbId)]);
  if(!cats.length) return eos(ctx,buildPath([sp?.name,yr?.name,sm?.name,sb?.name])+'\n\n📭 لا توجد فئات.',build([backMenu('sb_'+spId+'_'+yrId+'_'+smId+'_'+sbId)]));
  const rows = cats.map(c=>[btn('📁 '+c.name,'ct_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+c.id)]);
  rows.push(backMenu('sbs_'+spId+'_'+yrId+'_'+smId+'_'+sbId));
  return eos(ctx,buildPath([escMd(sp?.name),escMd(yr?.name),escMd(sm?.name),escMd(sb?.name)])+'\n\n📁 *اختر القسم:*',{parse_mode:'Markdown',...build(rows)});
}

async function showFiles(ctx,spId,yrId,smId,sbId,catId,page=0) {
  const uid = ctx.uid;
  const [{sp,yr,sm,sb,cat}, allFiles, bundles] = await Promise.all([
    getPathData(spId,yrId,smId,sbId,catId),
    filesDb.getFiles(catId),
    bundlesDb.getBundles(catId)
  ]);
  const total = allFiles.length;
  const list = allFiles.slice(page*PS,(page+1)*PS);
  const pathStr = buildPath([sp?.name,yr?.name,sm?.name,sb?.name,cat?.name]);
  let text = pathStr+'\n━━━━━━━━━━━━\n'+(total?'📄 *'+total+' ملف*':t(uid,'no_files'));
  const fileIds = list.map(f=>f.id);
  const [favMap, ratingMap] = await Promise.all([
    interactions.getFavBatch(uid, fileIds),
    interactions.getRatingBatch(fileIds)
  ]);
  const rows = list.map(f=>{
    const fav = favMap[f.id]||false;
    const avg = ratingMap[f.id]||0;
    const star = avg>=4?'⭐':avg>=2?'🌟':'📄';
    return [
      btn(star+' '+f.title+(avg>0?' '+avg+'★':''),'preview_'+f.id+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId),
      btn(fav?'⭐':'☆','fav_'+f.id)
    ];
  });
  if(total>PS){
    const nav=[];
    if(page>0) nav.push(btn('⬅️','ct_page_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId+'_'+(page-1)));
    nav.push(btn((page+1)+'/'+Math.ceil(total/PS),'noop'));
    if((page+1)*PS<total) nav.push(btn('➡️','ct_page_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId+'_'+(page+1)));
    rows.push(nav);
  }
  if(bundles.length){
    rows.unshift([btn('━━━ الحزم ('+bundles.length+') ━━━','noop')]);
    bundles.forEach(b=>{
      rows.splice(1,0,[btn('📦 '+b.title+' ('+b.downloads+' تحميل)','bundle_'+b.id+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId)]);
    });
  }
  rows.push(backMenu('sbs_'+spId+'_'+yrId+'_'+smId+'_'+sbId));
  return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});
}

async function showPreview(ctx,fid,spId,yrId,smId,sbId,catId) {
  const uid = ctx.uid;
  const [f, ratingData, commentCount, alreadyReported] = await Promise.all([
    filesDb.getFile(fid),
    interactions.getAvgRating(fid),
    commentsDb.countComments(fid),
    reportsDb.hasReported(uid, fid)
  ]);
  if(!f) return ctx.reply(t(uid,'not_found'));
  const [fav, favCnt, userRating] = await Promise.all([
    interactions.isFav(uid,fid),
    interactions.favCount(fid),
    interactions.getUserRating(uid,fid)
  ]);
  const {avg,cnt} = ratingData;
  const sizeStr = f.file_size ? ' | 💾 '+formatSize(f.file_size) : '';
  const text = '📄 *'+escMd(f.title)+'*\n'+(f.description?'📝 _'+escMd(f.description)+'_\n':'')+
    '\n📁 '+escMd(f.cat_name)+' | 📖 '+escMd(f.sub_name)+
    '\n⬇️ *'+f.downloads+'* تحميل | ⭐ *'+favCnt+'* محفوظ'+sizeStr+
    '\n💬 *'+commentCount+'* تعليق\n'+starsDisplay(avg,cnt);
  const backCb = catId!=='0'?'ct_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId:'main_menu';
  const ratingBtns = [1,2,3,4,5].map(i=>btn(i<=userRating?'⭐':'☆','rate_'+fid+'_'+i+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId));
  const rows = [
    [btn('⬇️ تحميل الملف','fl_'+fid+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId)],
    [btn(fav?'⭐ محفوظ':'☆ حفظ','fav_'+fid), btn('💬 تعليقات ('+commentCount+')','cmt_'+fid+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId)],
    ratingBtns,
    [btn(alreadyReported?'🚩 تم التبليغ':'⚠️ تبليغ عن مشكلة', alreadyReported?'noop':'report_'+fid+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId)],
    [btn('◀️ رجوع',backCb)]
  ];
  return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});
}

async function showReportMenu(ctx, fid, spId, yrId, smId, sbId, catId) {
  const reasons = [
    ['🔗 رابط معطوب', 'broken_link'],
    ['📄 ملف تالف', 'corrupted'],
    ['❌ ملف خاطئ', 'wrong_file'],
    ['🔄 ملف مكرر', 'duplicate'],
    ['⚠️ محتوى غير لائق', 'inappropriate'],
  ];
  const rows = reasons.map(([label, reason])=>[btn(label,'do_report_'+fid+'_'+reason+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId)]);
  rows.push([btn('◀️ إلغاء','preview_'+fid+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId)]);
  return eos(ctx,'⚠️ *تبليغ عن مشكلة*\n\nاختر نوع المشكلة:',{parse_mode:'Markdown',...build(rows)});
}

async function doReport(ctx, fid, reason, spId, yrId, smId, sbId, catId) {
  const uid = ctx.uid;
  const already = await reportsDb.hasReported(uid, fid);
  if(already) return ctx.answerCbQuery('🚩 لقد أبلغت عن هذا الملف مسبقاً',{show_alert:true}).catch(()=>{});
  await reportsDb.addReport(fid, uid, reason);
  await ctx.answerCbQuery('✅ تم إرسال التبليغ، شكراً!',{show_alert:true}).catch(()=>{});
  return showPreview(ctx,fid,spId,yrId,smId,sbId,catId);
}

async function showComments(ctx,fid,spId,yrId,smId,sbId,catId,page=0) {
  const uid = ctx.uid;
  const [comments, f] = await Promise.all([commentsDb.getComments(fid,50), filesDb.getFile(fid)]);
  const CPS = 5;
  const total = comments.length;
  const list = comments.slice(page*CPS,(page+1)*CPS);
  let text = '💬 *تعليقات: '+escMd(f?.title||'')+'*\n━━━━━━━━━━━━\n';
  if(!list.length) text += '_لا توجد تعليقات بعد._';
  else list.forEach(c=>{
    const name = escMd(c.first_name||'مجهول');
    const date = new Date(c.created_at).toLocaleDateString('en-GB');
    text += '\n👤 *'+name+'* — _'+date+'_\n'+escMd(c.text)+'\n';
  });
  const rows = [];
  if(ctx.isAdmin) list.forEach(c=>{rows.push([btn('🗑 '+c.text.substring(0,20),'dcmt_'+c.id+'_'+fid+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId)]);});
  const nav = [];
  if(page>0) nav.push(btn('⬅️','cmt_pg_'+fid+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId+'_'+(page-1)));
  if((page+1)*CPS<total) nav.push(btn('➡️','cmt_pg_'+fid+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId+'_'+(page+1)));
  if(nav.length) rows.push(nav);
  rows.push([btn('✍️ أضف تعليق','add_cmt_'+fid+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId)]);
  rows.push([btn('◀️ رجوع','preview_'+fid+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId)]);
  return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});
}

async function sendFile(ctx,fid,spId,yrId,smId,sbId,catId) {
  const uid = ctx.uid;
  const [f, fav] = await Promise.all([filesDb.getFile(fid), interactions.isFav(uid,fid)]);
  if(!f) return ctx.reply(t(uid,'not_found'));
  Promise.all([filesDb.incDownloads(fid), interactions.addHistory(uid,fid), interactions.addLog(uid,'download',f.title)]).catch(()=>{});
  const sizeStr = f.file_size ? ' | 💾 '+formatSize(f.file_size) : '';
  const caption = '📄 *'+escMd(f.title)+'*\n'+(f.description?'📝 '+escMd(f.description)+'\n':'')+'📁 '+escMd(f.cat_name)+' | 📖 '+escMd(f.sub_name)+sizeStr;
  const backCb = catId!=='0'?'ct_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId:'main_menu';
  const kb = build([[btn(fav?'⭐ محفوظ':'☆ حفظ','fav_'+fid)],[btn('◀️ رجوع',backCb),btn('🏠','main_menu')]]);
  try {
    if(f.file_type==='link') await ctx.reply(caption+'\n\n🔗 '+f.file_id,{parse_mode:'Markdown',...kb});
    else if(f.file_type==='photo') await ctx.replyWithPhoto(f.file_id,{caption,parse_mode:'Markdown',...kb});
    else await ctx.replyWithDocument(f.file_id,{caption,parse_mode:'Markdown',...kb});
    try{ await ctx.deleteMessage(); }catch(e){}
    interactions.getSimilar(fid,4).then(similar=>{
      if(similar.length){
        const simRows = similar.map(sf=>[btn('📄 '+sf.title+' · '+sf.sub_name,'preview_'+sf.id+'_0_0_0_0_0')]);
        simRows.push([btn('🏠 القائمة','main_menu')]);
        ctx.reply('📎 ملفات قد تهمك:',{...build(simRows)});
      }
    }).catch(()=>{});
  } catch(e) { ctx.reply('❌ تعذر إرسال الملف. حاول مجدداً.'); }
}

async function showBundle(ctx,bundleId,spId,yrId,smId,sbId,catId) {
  const [b, files] = await Promise.all([bundlesDb.getBundle(bundleId), bundlesDb.getBundleFiles(bundleId)]);
  if(!b) return ctx.reply('الحزمة غير موجودة');
  const text = '📦 *'+escMd(b.title)+'*'+(b.description?'\n📝 '+escMd(b.description):'')+
    '\n\n📄 *'+files.length+' ملف*\n'+files.map((f,i)=>(i+1)+'. '+escMd(f.title||f.file_title||'')).join('\n')+
    '\n\n⬇️ تحميل: *'+b.downloads+'*';
  const backCb = catId!=='0'?'ct_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId:'main_menu';
  const rows = [[btn('⬇️ تحميل الكل','bdl_'+bundleId+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId)]];
  if(ctx.isAdmin) rows.push([btn('✏️ تعديل','mg_rn_bundle_'+bundleId+'_'+catId+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId),btn('🗑 حذف','mg_dl_bundle_'+bundleId+'_'+catId+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId)]);
  rows.push([btn('◀️ رجوع',backCb)]);
  return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});
}

async function sendBundle(ctx,bundleId,spId,yrId,smId,sbId,catId) {
  const [b, files] = await Promise.all([bundlesDb.getBundle(bundleId), bundlesDb.getBundleFiles(bundleId)]);
  if(!files.length) return ctx.reply('الحزمة فارغة');
  bundlesDb.incBundleDownloads(bundleId);
  await ctx.reply('📦 *'+b.title+'* — جاري الإرسال...',{parse_mode:'Markdown'});
  const mediaGroup = files.filter(f=>f.real_type!=='link').map(f=>({type:f.real_type==='photo'?'photo':'document',media:f.file_id,caption:f.file_title||f.title||''}));
  if(mediaGroup.length) await ctx.replyWithMediaGroup(mediaGroup).catch(()=>{});
  const links = files.filter(f=>f.real_type==='link');
  if(links.length) await ctx.reply(links.map(f=>(f.file_title||f.title)+': '+f.file_id).join('\n'));
  const backCb = catId!=='0'?'ct_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId:'main_menu';
  await ctx.reply('✅ اكتمل الإرسال!',{...build([[btn('◀️ رجوع',backCb),btn('🏠','main_menu')]])});
}

module.exports={showSpecs,showYears,showSemesters,showSubjects,showCategories,showFiles,showPreview,showReportMenu,doReport,sendFile,showBundle,sendBundle,showComments};
