const escMd = t => (t||'').replace(/[*_`\[\]()~>#+=|{}.!\-]/g,'\\$&');
const filesDb=require('../database/files');
const interactions=require('../database/interactions');
const usersDb=require('../database/users');
const content=require('../database/content');
const {build,btn,back}=require('../utils/keyboard');
const {eos,formatDate}=require('../utils/helpers');
const {t,getLang,setLang}=require('../utils/i18n');

async function showLatest(ctx){
  const uid=ctx.uid; const list=await filesDb.recentFiles(15);
  if(!list.length) return eos(ctx,'🆕 لا توجد ملفات بعد.',build([back('main_menu')]));
  const rows=list.map(f=>[btn('📄 '+f.title+' · '+f.sub_name,'preview_'+f.id+'_0_0_0_0_0')]);
  rows.push(back('main_menu'));
  return eos(ctx,'🆕 *آخر الملفات ('+list.length+')*',{parse_mode:'Markdown',...build(rows)});
}

async function showPopular(ctx){
  const list=await filesDb.topDownloaded(15);
  if(!list.length) return eos(ctx,'🔥 لا توجد ملفات.',build([back('main_menu')]));
  const rows=list.map((f,i)=>[btn((i+1)+'🔥 '+f.title+' ⬇️'+f.downloads,'preview_'+f.id+'_0_0_0_0_0')]);
  rows.push(back('main_menu'));
  return eos(ctx,'🔥 *الأكثر تحميلاً*',{parse_mode:'Markdown',...build(rows)});
}

async function showRecommended(ctx){
  const uid=ctx.uid; const list=await interactions.getRecommended(uid,10);
  if(!list.length) return showPopular(ctx);
  const rows=list.map(f=>[btn('📄 '+f.title+' · '+f.sub_name,'preview_'+f.id+'_0_0_0_0_0')]);
  rows.push(back('main_menu'));
  return eos(ctx,'🎯 *موصى به لك*',{parse_mode:'Markdown',...build(rows)});
}

async function showFavorites(ctx){
  const uid=ctx.uid; const favs=await interactions.getFavs(uid);
  if(!favs.length) return eos(ctx,'⭐ *المفضلة*\n\nلا توجد ملفات محفوظة.',{parse_mode:'Markdown',...build([back('main_menu')])});
  const rows=favs.map(f=>[btn('📄 '+f.title,'preview_'+f.id+'_0_0_0_0_0'),btn('🗑','unfav_'+f.id)]);
  rows.push(back('main_menu'));
  return eos(ctx,'⭐ *المفضلة ('+favs.length+')*',{parse_mode:'Markdown',...build(rows)});
}

async function toggleFav(ctx,fid,remove=false){
  const uid=ctx.uid;
  const isFaved=await interactions.isFav(uid,fid);
  if(remove||isFaved){
    await interactions.removeFav(uid,fid);
    await ctx.answerCbQuery('').catch(()=>{});
    try{await ctx.editMessageReplyMarkup({inline_keyboard:ctx.callbackQuery.message.reply_markup.inline_keyboard.map(row=>row.map(b=>b.callback_data===('fav_'+fid)||b.callback_data===('unfav_'+fid)?{...b,text:'☆ حفظ',callback_data:'fav_'+fid}:b))});}catch(e){}
  } else {
    await interactions.addFav(uid,fid);
    await ctx.answerCbQuery('').catch(()=>{});
    try{await ctx.editMessageReplyMarkup({inline_keyboard:ctx.callbackQuery.message.reply_markup.inline_keyboard.map(row=>row.map(b=>b.callback_data===('fav_'+fid)||b.callback_data===('unfav_'+fid)?{...b,text:'⭐ محفوظ',callback_data:'unfav_'+fid}:b))});}catch(e){}
  }
}

async function showHistory(ctx){
  const uid=ctx.uid; const hist=await interactions.getHistory(uid);
  if(!hist.length) return eos(ctx,'📂 *السجل*\n\nلم تشاهد أي ملفات بعد.',{parse_mode:'Markdown',...build([back('main_menu')])});
  const rows=hist.map(f=>[btn('📄 '+f.title,'preview_'+f.id+'_0_0_0_0_0')]);
  rows.push(back('main_menu'));
  return eos(ctx,'📂 *السجل ('+hist.length+')*',{parse_mode:'Markdown',...build(rows)});
}

async function showProfile(ctx){
  const uid=ctx.uid; const user=await usersDb.getById(uid);
  const dlCount=await interactions.getUserDownloadCount(uid);
  const _favs=await interactions.getFavs(uid); const favCount=_favs.length;
  const lang=getLang(uid);
  const text='👤 *ملفك الشخصي*\n\n🆔 ID: `'+uid+'`\n👋 الاسم: '+(user?.first_name||'غير معروف')+'\n'+(user?.username?'📛 @'+user.username+'\n':'')+'📅 انضم: '+(user?.joined_at?formatDate(user.joined_at):'غير معروف')+'\n\n📊 *النشاط:*\n⬇️ التحميلات: *'+dlCount+'*\n⭐ المفضلة: *'+favCount+'*\n🌍 اللغة: *'+(lang==='ar'?'العربية 🇩🇿':'English 🇬🇧')+'*';
  const rows=[[btn(lang==='ar'?'Switch to English 🇬🇧':'التبديل للعربية 🇩🇿','lang_'+(lang==='ar'?'en':'ar'))],[btn('🎯 موصى به','recommended')],back('main_menu')];
  return eos(ctx,text,{parse_mode:'Markdown',...build(rows)});
}

async function showStats(ctx){
  const text='📊 *الإحصائيات*\n\n👥 المستخدمون: *'+await usersDb.count()+'*\n🟢 نشطون اليوم: *'+await usersDb.activeToday()+'*\n📁 الملفات: *'+await filesDb.totalFiles()+'*\n⬇️ التحميلات: *'+await filesDb.totalDownloads()+'*\n🎓 التخصصات: *'+(await content.getSpecs()).length+'*';
  return eos(ctx,text,{parse_mode:'Markdown',...build([back('main_menu')])});
}

async function handleSearch(ctx,query){
  if(global.delState) await global.delState(ctx.uid); else delete global.userStates[ctx.uid];
  if(!query||query.trim().length<2) return ctx.reply('⚠️ قصير جداً. ادخل كلمة على الأقل.');
  if(query.trim().length>100) return ctx.reply('⚠️ البحث طويل جداً. اكتب أقل من 100 حرف.');
  // Strip special chars that could break SQL
  query = query.trim().replace(/[%;\\]/g,'');
  if(!query.length) return ctx.reply('⚠️ كلمة البحث غير صالحة.');
  const results=await filesDb.search(query.trim());
  if(!results.length) return ctx.reply('لا نتائج لـ: '+query,{...build([[btn('بحث جديد','search_prompt')],back('main_menu')])});
  const rows=results.map(f=>{
    const row=[btn('📄 '+f.title+' · '+f.sub_name,'preview_'+f.id+'_0_0_0_0_0')];
    if(ctx.isAdmin) row.push(btn('🗑','search_del_'+f.id+'_'+encodeURIComponent(query)));
    return row;
  });
  rows.push([btn('بحث جديد','search_prompt'),btn('🏠','main_menu')]);
  ctx.reply('نتائج "'+query+'" ('+results.length+')',{...build(rows)});
}

module.exports={showLatest,showPopular,showRecommended,showFavorites,toggleFav,showHistory,showProfile,showStats,handleSearch};
