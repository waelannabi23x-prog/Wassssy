const escMd = t => (t||'').replace(/[*_`\[\]()~>#+=|{}.!\-]/g,'\\$&');

function starsDisplay(avg, cnt) {
  const full = Math.round(avg);
  const stars = '⭐'.repeat(full) + '☆'.repeat(5-full);
  return stars + (cnt ? ' ' + avg + '/5 (' + cnt + ' تقييم)' : ' لا يوجد تقييم');
}

const content = require('../database/content');
const filesDb = require('../database/files');
const interactions = require('../database/interactions');
const { build, btn, back, backMenu } = require('../utils/keyboard');
const { eos, buildPath } = require('../utils/helpers');
const { t } = require('../utils/i18n');

const PS = 8;

async function showSpecs(ctx) {
  const uid=ctx.uid; const specs=await content.getSpecs();
  if(!specs.length) return eos(ctx,'📭 لا توجد تخصصات بعد.',build([back('main_menu')]));
  const rows=specs.map(s=>[btn('🎓 '+s.name,'sp_'+s.id)]);
  rows.push(back('main_menu'));
  return eos(ctx,t(uid,'choose_specialty'),{parse_mode:'Markdown',...build(rows)});
}

async function showYears(ctx,spId,page=0) {
  const uid=ctx.uid; const sp=await content.getSpec(spId); const all=await content.getYears(spId);
  const total=all.length; const years=all.slice(page*PS,(page+1)*PS);
  if(!years.length) return eos(ctx,buildPath([escMd(sp?.name)])+'\n\n📭 لا توجد سنوات.',build([backMenu('browse')]));
  const rows=years.map(y=>[btn('📅 '+y.name,'yr_'+spId+'_'+y.id)]);
  if(total>PS){const nav=[];if(page>0)nav.push(btn('⬅️','yr_page_'+spId+'_'+(page-1)));nav.push(btn((page+1)+'/'+Math.ceil(total/PS),'noop'));if((page+1)*PS<total)nav.push(btn('➡️','yr_page_'+spId+'_'+(page+1)));rows.push(nav);}
  rows.push(backMenu('browse'));
  return eos(ctx,buildPath([sp?.name])+'\n\n'+t(uid,'choose_year'),{parse_mode:'Markdown',...build(rows)});
}

async function showSemesters(ctx,spId,yrId) {
  const uid=ctx.uid; const sp=await content.getSpec(spId); const yr=await content.getYear(yrId);
  const sems=await content.getSemesters(yrId);
  if(!sems.length) return eos(ctx,buildPath([sp?.name,yr?.name])+'\n\n📭 لا توجد فصول.',build([backMenu('yr_'+spId+'_'+yrId)]));
  const rows=sems.map(s=>[btn('📆 '+s.name,'sm_'+spId+'_'+yrId+'_'+s.id)]);
  rows.push(backMenu('yrs_'+spId+'_'+yrId));
  return eos(ctx,buildPath([escMd(sp?.name),escMd(yr?.name)])+'\n\n'+t(uid,'choose_semester'),{parse_mode:'Markdown',...build(rows)});
}

async function showSubjects(ctx,spId,yrId,smId,page=0) {
  const uid=ctx.uid; const sp=await content.getSpec(spId); const yr=await content.getYear(yrId); const sm=await content.getSemester(smId);
  const all=await content.getSubjects(smId); const total=all.length; const subs=all.slice(page*PS,(page+1)*PS);
  if(!subs.length) return eos(ctx,buildPath([sp?.name,yr?.name,sm?.name])+'\n\n📭 لا توجد مواد.',build([backMenu('sm_'+spId+'_'+yrId+'_'+smId)]));
  const rows=subs.map(s=>[btn('📖 '+s.name,'sb_'+spId+'_'+yrId+'_'+smId+'_'+s.id)]);
  if(total>PS){const nav=[];if(page>0)nav.push(btn('⬅️','sb_page_'+spId+'_'+yrId+'_'+smId+'_'+(page-1)));nav.push(btn((page+1)+'/'+Math.ceil(total/PS),'noop'));if((page+1)*PS<total)nav.push(btn('➡️','sb_page_'+spId+'_'+yrId+'_'+smId+'_'+(page+1)));rows.push(nav);}
  rows.push(backMenu('sms_'+spId+'_'+yrId+'_'+smId));
  return eos(ctx,buildPath([escMd(sp?.name),escMd(yr?.name),escMd(sm?.name)])+'\n\n'+t(uid,'choose_subject'),{parse_mode:'Markdown',...build(rows)});
}

async function showCategories(ctx,spId,yrId,smId,sbId) {
  const uid=ctx.uid; const sp=await content.getSpec(spId); const yr=await content.getYear(yrId); const sm=await content.getSemester(smId); const sb=await content.getSubject(sbId);
  const cats=await content.getCategories(sbId);
  if(!cats.length) return eos(ctx,buildPath([sp?.name,yr?.name,sm?.name,sb?.name])+'\n\n📭 لا توجد فئات.',build([backMenu('sb_'+spId+'_'+yrId+'_'+smId+'_'+sbId)]));
  const rows=cats.map(c=>[btn('📁 '+c.name,'ct_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+c.id)]);
  rows.push(backMenu('sbs_'+spId+'_'+yrId+'_'+smId+'_'+sbId));
  return eos(ctx,buildPath([escMd(sp?.name),escMd(yr?.name),escMd(sm?.name),escMd(sb?.name)])+'\n\n'+t(uid,'choose_category'),{parse_mode:'Markdown',...build(rows)});
}

async function showFiles(ctx,spId,yrId,smId,sbId,catId,page=0) {
  const uid=ctx.uid; const cat=await content.getCategory(catId); const sb=await content.getSubject(sbId);
  const sp=await content.getSpec(spId); const yr=await content.getYear(yrId); const sm=await content.getSemester(smId);
  const all=await filesDb.getFiles(catId); const total=all.length; const list=all.slice(page*PS,(page+1)*PS);
  const pathStr=buildPath([sp?.name,yr?.name,sm?.name,sb?.name,cat?.name]);
  let text=pathStr+'\n━━━━━━━━━━━━\n'+(total?'📄 *'+total+' ملف*':t(uid,'no_files'));
  const rows=await Promise.all(list.map(async f=>{const fav=await interactions.isFav(uid,f.id);return[btn('📄 '+f.title,'preview_'+f.id+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId),btn(fav?'⭐':'☆','fav_'+f.id)];}));
  if(total>PS){const nav=[];if(page>0)nav.push(btn('⬅️','ct_page_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId+'_'+(page-1)));nav.push(btn((page+1)+'/'+Math.ceil(total/PS),'noop'));if((page+1)*PS<total)nav.push(btn('➡️','ct_page_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId+'_'+(page+1)));rows.push(nav);}
  // Show bundles
  const bundlesDb = require('../database/bundles');
  const bundles = await bundlesDb.getBundles(catId);
  if(bundles.length){
    rows.unshift([btn('━━━ الحزم ('+bundles.length+') ━━━','noop')]);
    bundles.forEach(b=>{
      rows.splice(1,0,[btn('📦 '+b.title+' ('+b.downloads+' تحميل)','bundle_'+b.id+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId)]);
    });
  }
  if(ctx.isAdmin) rows.push([btn('➕ رفع ملف','mg_upl_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId),btn('📦 حزمة','mg_add_bundle_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId)]);
  rows.push(backMenu('sbs_'+spId+'_'+yrId+'_'+smId+'_'+sbId));
  return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});
}

async function showPreview(ctx,fid,spId,yrId,smId,sbId,catId) {
  const uid=ctx.uid; const f=await filesDb.getFile(fid);
  if(!f) return ctx.reply(t(uid,'not_found'));
  const fav=await interactions.isFav(uid,fid); const favCnt=await interactions.favCount(fid);
  const userRating=await interactions.getUserRating(uid,fid);
  const {avg,cnt}=await interactions.getAvgRating(fid);
  const ratingText = starsDisplay(avg, cnt);
  const text='📄 *'+escMd(f.title)+'*\n'+(f.description?'📝 _'+escMd(f.description)+'_\n':'')+'\n📁 '+escMd(f.cat_name)+'\n📖 '+escMd(f.sub_name)+'\n⬇️ تحميل: *'+f.downloads+'*\n⭐ محفوظ: *'+favCnt+'* مستخدم\n'+ratingText;
  const backCb = catId!=='0' ? 'ct_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId : 'main_menu';
  const ratingBtns=[1,2,3,4,5].map(i=>btn(i<=userRating?'⭐':'☆','rate_'+fid+'_'+i+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId));
  const rows=[[btn('⬇️ تحميل','fl_'+fid+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId)],[btn(fav?'⭐ محفوظ':'☆ حفظ','fav_'+fid)],ratingBtns,[btn('◀️ رجوع',backCb)]];
  return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});
}

async function sendFile(ctx,fid,spId,yrId,smId,sbId,catId) {
  const uid=ctx.uid; const f=await filesDb.getFile(fid);
  if(!f) return ctx.reply(t(uid,'not_found'));
  filesDb.incDownloads(fid); interactions.addHistory(uid,fid); interactions.addLog(uid,'download',f.title);
  const fav=await interactions.isFav(uid,fid);
  const caption='📄 *'+escMd(f.title)+'*\n'+(f.description?'📝 '+escMd(f.description)+'\n':'')+'📁 '+escMd(f.cat_name)+' | 📖 '+escMd(f.sub_name)+'\n⬇️ '+(f.downloads+1);
  const backCb=catId!=='0'?'ct_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId:'main_menu';
  const kb=build([[btn(fav?'⭐ محفوظ':'☆ حفظ','fav_'+fid)],[btn('◀️ رجوع',backCb),btn('🏠','main_menu')]]);
  try{
    if(f.file_type==='link'){await ctx.reply(caption+' '+f.url,{...kb});}
    else if(f.file_type==='photo') await ctx.replyWithPhoto(f.file_id,{caption,parse_mode:'Markdown',...kb});
    else await ctx.replyWithDocument(f.file_id,{caption,parse_mode:'Markdown',...kb});
    try{await ctx.deleteMessage();}catch(e){}
    const similar=await interactions.getSimilar(fid,4);
    if(similar.length){
      const simRows=similar.map(sf=>[btn('📄 '+sf.title+' · '+sf.sub_name,'preview_'+sf.id+'_0_0_0_0_0')]);
      simRows.push([btn('🏠 القائمة','main_menu')]);
      await ctx.reply('ملفات قد تهمك ('+similar.length+'):',{...build(simRows)});
    }
  }catch(e){ctx.reply('❌ تعذر إرسال الملف. حاول مجدداً.');}
}

module.exports={showSpecs,showYears,showSemesters,showSubjects,showCategories,showFiles,showPreview,sendFile,showBundle,sendBundle};

async function showBundle(ctx,bundleId,spId,yrId,smId,sbId,catId){
  const bundlesDb=require('../database/bundles');
  const b=await bundlesDb.getBundle(bundleId);
  if(!b) return ctx.reply('الحزمة غير موجودة');
  const files=await bundlesDb.getBundleFiles(bundleId);
  const text='📦 *'+b.title+'*'+(b.description?'\n📝 '+b.description:'')+'\n\n📄 *'+files.length+' ملف*\n'+files.map((f,i)=>(i+1)+'. '+f.title).join('\n')+'\n\n⬇️ تحميل: *'+b.downloads+'*';
  const backCb=catId!=='0'?'ct_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId:'main_menu';
  const rows=[[btn('⬇️ تحميل الكل','bdl_'+bundleId+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId)]];
  if(ctx.isAdmin) rows.push([btn('✏️ تعديل الاسم','mg_rn_bundle_'+bundleId+'_'+catId+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId),btn('🗑 حذف','mg_dl_bundle_'+bundleId+'_'+catId+'_'+spId+'_'+yrId+'_'+smId+'_'+sbId)]);
  rows.push([btn('◀️ رجوع',backCb)]);
  return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});
}

async function sendBundle(ctx,bundleId,spId,yrId,smId,sbId,catId){
  const bundlesDb=require('../database/bundles');
  const b=await bundlesDb.getBundle(bundleId);
  const files=await bundlesDb.getBundleFiles(bundleId);
  if(!files.length) return ctx.reply('الحزمة فارغة');
  bundlesDb.incBundleDownloads(bundleId);
  await ctx.reply('📦 *'+b.title+'* — جاري الإرسال...',{parse_mode:'Markdown'});
  const mediaGroup=files.filter(f=>f.real_type!=='link').map(f=>({type:f.real_type==='photo'?'photo':'document',media:f.file_id,caption:f.file_title||f.title||''}));
  if(mediaGroup.length) await ctx.replyWithMediaGroup(mediaGroup).catch(()=>{});
  const links=files.filter(f=>f.real_type==='link');
  if(links.length) await ctx.reply(links.map(f=>(f.file_title||f.title)+': '+f.file_id).join('\n'));
  const backCb=catId!=='0'?'ct_'+spId+'_'+yrId+'_'+smId+'_'+sbId+'_'+catId:'main_menu';
  await ctx.reply('✅ اكتمل الإرسال!',{...build([[btn('◀️ رجوع',backCb),btn('🏠','main_menu')]])});
}
