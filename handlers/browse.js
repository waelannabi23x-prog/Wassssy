const escMd = t => (t||'').replace(/[*_`\[\]()~>#+=|{}.!\-]/g,'\\$&');
const { cacheGet, cacheSet } = require('../utils/cache');
const reportsDb = require('../database/reports');

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
  cacheSet(key, result, 7200000);
  return result;
}

async function showSpecs(ctx) {
  const pre = cacheGet('precomp_specs');
  if(pre) return eos(ctx, pre.text, pre.extra);
  const specs = await content.getSpecs();
  const rows = specs.map(s=>[btn('🎓 '+s.name,'sp_'+s.id)]);
  rows.push(back('main_menu'));
  return eos(ctx,'🎓 *اختر تخصصك:*',{parse_mode:'Markdown',...build(rows)});
}

async function showYears(ctx,spId,page=0) {
  if(page===0){
    const pre=cacheGet('precomp_yrs_'+spId);
    if(pre) return eos(ctx,pre.text,pre.extra);
  }
  const ckey='yrs_'+spId;
  let yd=cacheGet(ckey);
  if(!yd) {
    const [sp,all]=await Promise.all([content.getSpec(spId),content.getYears(spId)]);
    yd={sp,all};
    cacheSet(ckey,yd,3600000);
  }
  const {sp, all} = yd;
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
  return eos(ctx,buildPath([escMd(sp?.name)])+'\n\n📅 *اختر السنة:*',{parse_mode:'Markdown',...build(rows)});
}

async function showSemesters(ctx,spId,yrId) {
  const pre=cacheGet('precomp_sems_'+spId+'_'+yrId);
  if(pre) return eos(ctx,pre.text,pre.extra);
  const ckey='sems_'+spId+'_'+yrId;
  let sd=cacheGet(ckey);
  if(!sd) {
    const [sp,yr,sems]=await Promise.all([content.getSpec(spId),content.getYear(yrId),content.getSemesters(yrId)]);
    sd={sp,yr,sems};
    cacheSet(ckey,sd,3600000);
  }
  const {sp, yr, sems} = sd;
  if(!sems.length) return eos(ctx,buildPath([escMd(sp?.name),escMd(yr?.name)])+'\n\n📭 لا توجد فصول.',build([backMenu('yr_'+spId+'_'+yrId)]));
  const rows = sems.map(s=>[btn('📆 '+s.name,'sm_'+spId+'_'+yrId+'_'+s.id)]);
  rows.push(backMenu('yrs_'+spId+'_'+yrId));
  return eos(ctx,buildPath([escMd(sp?.name),escMd(yr?.name)])+'\n\n📆 *اختر الفصل:*',{parse_mode:'Markdown',...build(rows)});
}

async function showSubjects(ctx,spId,yrId,smId,page=0) {
  if(page===0) {
    const pre=cacheGet('precomp_subs_'+spId+'_'+yrId+'_'+smId);
    if(pre) return eos(ctx,pre.text,pre.extra);
  }
  const ckey='subs_'+spId+'_'+yrId+'_'+smId;
  let subd=cacheGet(ckey);
  if(!subd) {
    const [sp,yr,sm,all]=await Promise.all([content.getSpec(spId),content.getYear(yrId),content.getSemester(smId),content.getSubjects(smId)]);
    subd={sp,yr,sm,all};
    cacheSet(ckey,subd,3600000);
  }
  const {sp, yr, sm, all} = subd;
  const total = all.length;
  const subs = all.slice(page*PS,(page+1)*PS);
  if(!subs.length) return eos(ctx,buildPath([escMd(sp?.name),escMd(yr?.name),escMd(sm?.name)])+'\n\n📭 لا توجد مواد.',build([backMenu('sm_'+spId+'_'+yrId+'_'+smId)]));
  // عمودين
  const rows = [];
  for(let i=0; i<subs.length; i+=2) {
    const row = [btn('📖 '+subs[i].name,'sb_'+spId+'_'+yrId+'_'+smId+'_'+subs[i].id)];
    if(subs[i+1]) row.push(btn('📖 '+subs[i+1].name,'sb_'+spId+'_'+yrId+'_'+smId+'_'+subs[i+1].id));
    rows.push(row);
  }
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
  const pre=cacheGet('precomp_cats_'+spId+'_'+yrId+'_'+smId+'_'+sbId);
  if(pre) return eos(ctx,pre.text,pre.extra);
  const ckey='cats_'+spId+'_'+yrId+'_'+smId+'_'+sbId;
  let catd=cacheGet(ckey);
  if(!catd) {
    const [sp,yr,sm,sb,cats]=await Promise.all([content.getSpec(spId),content.getYear(yrId),content.getSemester(smId),content.getSubject(sbId),content.getCategories(sbId)]);
    catd={sp,yr,sm,sb,cats};
    cacheSet(ckey,catd,3600000);
  }
  const {sp, yr, sm, sb, cats} = catd;
  if(!cats.length) return eos(ctx,buildPath([escMd(sp?.name),escMd(yr?.name),escMd(sm?.name),escMd(sb?.name)])+'\n\n📭 لا توجد فئات.',build([backMenu('sb_'+spId+'_'+yrId+'_'+smId+'_'+sbId)]));
  const rows = cats.map(c=>[btn('📁 '+c.name,'ct_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+c.id)]);
  rows.push(backMenu('sbs_'+spId+'_'+yrId+'_'+smId+'_'+sbId));
  return eos(ctx,buildPath([escMd(sp?.name),escMd(yr?.name),escMd(sm?.name),escMd(sb?.name)])+'\n\n📁 *اختر القسم:*',{parse_mode:'Markdown',...build(rows)});
}

async function showFiles(ctx,spId,yrId,smId,sbId,catId,page=0) {
  const uid=ctx.uid;
  if(global.dedupRequest) return global.dedupRequest(uid,'sf_'+catId+'_'+page, ()=>_showFiles(ctx,spId,yrId,smId,sbId,catId,page));
  return _showFiles(ctx,spId,yrId,smId,sbId,catId,page);
}
async function _showFiles(ctx,spId,yrId,smId,sbId,catId,page=0) {
  const uid=ctx.uid;
  const userKey='showfiles_u_'+uid+'_'+catId+'_'+page;
  const userCached=cacheGet(userKey);
  if(userCached) return eos(ctx,userCached.text,userCached.extra);
  const staticKey='showfiles_'+catId+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId;
  let staticData=cacheGet(staticKey);
  if(!staticData){
    const [pathData, allFiles, bundles] = await Promise.all([
      getPathData(spId,yrId,smId,sbId,catId),
      filesDb.getFiles(catId),
      bundlesDb.getBundles(catId)
    ]);
    staticData={pathData,allFiles,bundles};
    cacheSet(staticKey,staticData,3600000);
  }
  const {pathData:{sp,yr,sm,sb,cat}, allFiles, bundles} = staticData;
  const total = allFiles.length;
  const list = allFiles.slice(page*PS,(page+1)*PS);
  const pathStr = buildPath([sp?.name,yr?.name,sm?.name,sb?.name,cat?.name]);
  let text = pathStr+'\n━━━━━━━━━━━━\n'+(total?'📄 *'+total+' ملف*':t(uid,'no_files'));
  const fileIds = list.map(f=>f.id);
  // ratings = static (نفس لكل الناس) | favs = personal
  const ratingKey='ratingbatch_static_'+catId+'_'+page;
  let ratingMap=cacheGet(ratingKey);
  if(!ratingMap) {
    ratingMap=await interactions.getRatingBatch(fileIds);
    cacheSet(ratingKey,ratingMap,3600000);
  }
  const favKey='favbatch_'+uid+'_'+catId+'_'+page;
  let favMap=cacheGet(favKey);
  if(!favMap) {
    favMap=await interactions.getFavBatch(uid, fileIds);
    cacheSet(favKey,favMap,300000);
  }
  const rows = list.map(f=>{
    const fav = favMap[f.id]||false;
    const avg = ratingMap[f.id]||0;
    const star = avg>=4?'⭐':avg>=2?'🌟':'📄';
    const typeIcon = f.file_type==='link' ? '🔗' : f.file_type==='photo' ? '🖼️' : '📄';
    return [
      btn(typeIcon+' '+f.title+(avg>0?' ('+avg+'★)':''),'preview_'+f.id+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId),
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
  const extra={parse_mode:'Markdown',...build(rows)};
  cacheSet(userKey,{text,extra},300000);

  // pre-warm بالتوازي مع الرد — بدون انتظار
  Promise.all(list.map(f => {
    const sk='prev_static_'+f.id;
    if(cacheGet(sk)) return Promise.resolve();
    return Promise.all([
      filesDb.getFile(f.id),
      interactions.getAvgRating(f.id),
      commentsDb.countComments(f.id),
      interactions.favCount(f.id),
    ]).then(([_f,_r,_cc,_fc])=>{
      if(_f) cacheSet(sk,{f:_f,ratingData:_r,commentCount:_cc,favCnt:_fc},1800000);
    }).catch(()=>{});
  })).catch(()=>{});

  return eos(ctx,text,extra);
}

async function showPreview(ctx,fid,spId,yrId,smId,sbId,catId) {
  const uid = ctx.uid;
  if(global.dedupRequest) return global.dedupRequest(uid,'sp_'+fid, ()=>_showPreview(ctx,fid,spId,yrId,smId,sbId,catId));
  return _showPreview(ctx,fid,spId,yrId,smId,sbId,catId);
}
async function _showPreview(ctx,fid,spId,yrId,smId,sbId,catId) {
  const uid = ctx.uid;
  const staticKey = 'prev_static_'+fid;
  let staticData = cacheGet(staticKey);
  if(!staticData) {
    const [f, ratingData, commentCount, favCnt] = await Promise.all([
      filesDb.getFile(fid),
      interactions.getAvgRating(fid),
      commentsDb.countComments(fid),
      interactions.favCount(fid),
    ]);
    staticData = {f, ratingData, commentCount, favCnt};
    if(f) cacheSet(staticKey, staticData, 3600000);
  }
  const {f, ratingData, commentCount, favCnt} = staticData;
  if(!f) return ctx.reply(t(uid,'not_found'));

  // البيانات الشخصية مع cache
  const personalKey = 'personal_'+uid+'_'+fid;
  let personal = cacheGet(personalKey);
  if(!personal) {
    personal = await interactions.getPreviewPersonal(uid,fid);
    cacheSet(personalKey, personal, 300000);
  }
  const { fav, userRating, alreadyReported } = personal;

  const {avg,cnt} = ratingData;
  const text = '📄 *'+escMd(f.title)+'*\n'+
    (f.description?'📝 _'+escMd(f.description)+'_\n':'')+
    '\n📁 '+escMd(f.cat_name)+' | 📖 '+escMd(f.sub_name)+
    '\n⬇️ *'+f.downloads+'* تحميل | ⭐ *'+favCnt+'* محفوظ'+
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
    ['🔗 رابط معطوب','broken_link'],
    ['📄 ملف تالف','corrupted'],
    ['❌ ملف خاطئ','wrong_file'],
    ['🔄 ملف مكرر','duplicate'],
    ['⚠️ محتوى غير لائق','inappropriate'],
  ];
  const rows = reasons.map(([label,reason])=>[btn(label,'do_report_'+fid+'_'+reason+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId)]);
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
  const cmtKey='cmts_'+fid+'_'+page;
  const cmtCached=cacheGet(cmtKey);
  const [comments, f] = cmtCached
    ? [cmtCached.comments, cmtCached.f]
    : await Promise.all([commentsDb.getComments(fid,50), filesDb.getFile(fid)]);
  if(!cmtCached) cacheSet(cmtKey,{comments,f},60000);
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
  if(ctx.isAdmin) list.forEach(c=>{ rows.push([btn('🗑 '+c.text.substring(0,20),'dcmt_'+c.id+'_'+fid+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId)]); });
  const nav = [];
  if(page>0) nav.push(btn('⬅️','cmt_pg_'+fid+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId+'_'+(page-1)));
  if((page+1)*CPS<total) nav.push(btn('➡️','cmt_pg_'+fid+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId+'_'+(page+1)));
  if(nav.length) rows.push(nav);
  rows.push([btn('✍️ أضف تعليق','add_cmt_'+fid+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId)]);
  rows.push([btn('◀️ رجوع','preview_'+fid+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId)]);
  return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});
}

async function sendFile(ctx,fid,spId,yrId,smId,sbId,catId) {
  const uid=ctx.uid;
  ctx.answerCbQuery('').catch(()=>{});
  ctx.sendChatAction('upload_document').catch(()=>{});
  const [f,similar,fav]=await Promise.all([filesDb.getFile(fid),interactions.getSimilar(fid,4),interactions.isFav(uid,fid)]);
  if(!f) return ctx.reply(t(uid,'not_found'));
  filesDb.incDownloads(fid).catch(()=>{});
  interactions.addHistory(uid,fid).catch(()=>{});
  interactions.addLog(uid,'download',f.title);
  interactions.invalidateLastFile(uid);
  // pre-warm يبدأ فوراً بالتوازي مع إرسال الملف
  if(similar.length) {
    similar.forEach(sf => {
      const sk = 'prev_static_'+sf.id;
      if(!cacheGet(sk)) {
        Promise.all([
          filesDb.getFile(sf.id),
          interactions.getAvgRating(sf.id),
          commentsDb.countComments(sf.id),
          interactions.favCount(sf.id),
        ]).then(([_f,_r,_cc,_fc]) => {
          if(_f) cacheSet(sk,{f:_f,ratingData:_r,commentCount:_cc,favCnt:_fc},1800000);
        }).catch(()=>{});
      }
    });
  }
  const caption='📄 *'+escMd(f.title)+'*\n'+(f.description?'📝 '+escMd(f.description)+'\n':'')+'📁 '+escMd(f.cat_name)+' | 📖 '+escMd(f.sub_name);
  const backCb=catId!=='0'?'ct_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId:'main_menu';
  const kb=build([[btn(fav?'⭐ محفوظ':'☆ حفظ','fav_'+fid)],[btn('◀️ رجوع',backCb),btn('🏠','main_menu')]]);
  try {
    if(f.file_type==='link') await ctx.reply(caption+'\n\n🔗 '+f.file_id,{parse_mode:'Markdown',...kb});
    else if(f.file_type==='photo') await ctx.replyWithPhoto(f.file_id,{caption,parse_mode:'Markdown',...kb});
    else await ctx.replyWithDocument(f.file_id,{caption,parse_mode:'Markdown',...kb});
    ctx.deleteMessage().catch(()=>{});
    if(similar.length){
      const simRows=similar.map(sf=>[btn('📄 '+sf.title+' · '+sf.sub_name,'preview_'+sf.id+'_0_0_0_0_0')]);
      simRows.push([btn('🏠 القائمة','main_menu')]);
      ctx.reply('📎 ملفات قد تهمك:',{...build(simRows)});
    }
  } catch(e){ctx.reply('❌ تعذر إرسال الملف. حاول مجدداً.');}
}
async function showBundle(ctx,bundleId,spId,yrId,smId,sbId,catId){
  const bkey='bundle_full_'+bundleId;
  const bcached=cacheGet(bkey);
  const [b, files] = bcached
    ? [bcached.b, bcached.files]
    : await Promise.all([bundlesDb.getBundle(bundleId), bundlesDb.getBundleFiles(bundleId)]);
  if(!bcached && b) cacheSet(bkey,{b,files},600000);
  if(!b) return ctx.reply('الحزمة غير موجودة');
  const typeIcons = {photo:'🖼️',document:'📄',video:'🎥',audio:'🎵',voice:'🎤',link:'🔗'};
  const typeCounts = {};
  files.forEach(f => { typeCounts[f.real_type] = (typeCounts[f.real_type]||0)+1; });
  const typeStr = Object.entries(typeCounts).map(([t,c]) => (typeIcons[t]||'📄')+' '+c).join(' | ');
  const text = '📦 *'+escMd(b.title)+'*'+(b.description?'\n📝 '+escMd(b.description):'')+
    '\n\n📁 *'+files.length+' ملف*\n'+typeStr+'\n\n⬇️ تحميل: *'+b.downloads+'*';
  const backCb = catId!=='0'?'ct_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId:'main_menu';
  const rows = [[btn('⬇️ تحميل الكل','bdl_'+bundleId+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId)]];
  if(ctx.isAdmin) rows.push([btn('✏️ تعديل','mg_rn_bundle_'+bundleId+'_'+catId+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId),btn('🗑 حذف','mg_dl_bundle_'+bundleId+'_'+catId+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId)]);
  rows.push([btn('◀️ رجوع',backCb)]);
  return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});
}

async function sendBundle(ctx,bundleId,spId,yrId,smId,sbId,catId){
  const bkey='bundle_full_'+bundleId;
  const bcached=cacheGet(bkey);
  const [b, files] = bcached
    ? [bcached.b, bcached.files]
    : await Promise.all([bundlesDb.getBundle(bundleId), bundlesDb.getBundleFiles(bundleId)]);
  if(!bcached && b) cacheSet(bkey,{b,files},600000);
  if(!files.length) return ctx.reply('الحزمة فارغة');
  bundlesDb.incBundleDownloads(bundleId).catch(()=>{});
  await ctx.reply('📦 *'+escMd(b.title)+'* — جاري الإرسال...',{parse_mode:'Markdown'});
  const photos=files.filter(f=>f.real_type==='photo');
  const docs=files.filter(f=>f.real_type==='document');
  const videos=files.filter(f=>f.real_type==='video');
  const audios=files.filter(f=>f.real_type==='audio'||f.real_type==='voice');
  const links=files.filter(f=>f.real_type==='link');
  if(photos.length){
    try {
      await ctx.replyWithMediaGroup(photos.map(f=>({type:'photo',media:f.file_id,caption:f.file_title||f.title||''})));
    } catch(e) {
      for(const f of photos) await ctx.replyWithPhoto(f.file_id,{caption:f.file_title||''}).catch(()=>{});
    }
  }
  for(const v of videos) await ctx.replyWithVideo(v.file_id,{caption:v.file_title||''}).catch(()=>{});
  for(const d of docs) await ctx.replyWithDocument(d.file_id,{caption:d.file_title||''}).catch(()=>{});
  for(const a of audios){
    if(a.real_type==='voice') await ctx.replyWithVoice(a.file_id).catch(()=>{});
    else await ctx.replyWithAudio(a.file_id,{caption:a.file_title||''}).catch(()=>{});
  }
  if(links.length){
    let linkMsg='🔗 *الروابط:*\n\n';
    links.forEach((l,i)=>{ linkMsg+=(i+1)+'. '+(l.file_title||l.title||'')+'\n'+l.file_id+'\n\n'; });
    await ctx.reply(linkMsg,{parse_mode:'Markdown'});
  }
  const backCb=catId!=='0'?'ct_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId:'main_menu';
  await ctx.reply('✅ اكتمل الإرسال!',{...build([[btn('◀️ رجوع',backCb),btn('🏠','main_menu')]])});
}
module.exports={showSpecs,showYears,showSemesters,showSubjects,showCategories,showFiles,showPreview,showReportMenu,doReport,sendFile,showBundle,sendBundle,showComments};
