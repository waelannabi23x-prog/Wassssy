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

async function showNewInSpecialty(ctx){
  const uid=ctx.uid;
  const spRow=await require('../database/users').getSpecialty(uid);
  const spId=spRow?.specialty_id;
  if(!spId||spId==0) return showLatest(ctx);
  const {all}=require('../database/db');
  const list=await all(
    `SELECT f.*,c.name as cat_name,s.name as sub_name FROM files f
     JOIN categories c ON f.category_id=c.id
     JOIN subjects s ON c.subject_id=s.id
     JOIN semesters sm ON s.semester_id=sm.id
     JOIN years y ON sm.year_id=y.id
     WHERE y.specialty_id=? AND f.is_deleted=0
     ORDER BY f.uploaded_at DESC LIMIT 15`,[spId]);
  if(!list.length) return showLatest(ctx);
  const rows=list.map(f=>[btn('📄 '+f.title+' · '+escMd(f.sub_name),'preview_'+f.id+'_0_0_0_0_0')]);
  rows.push(back('main_menu'));
  return eos(ctx,'🆕 *الجديد في تخصصك ('+list.length+')*',{parse_mode:'Markdown',...build(rows)});
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

async function showProgress(ctx) {
  const uid = ctx.uid;
  const spRow = await usersDb.getSpecialty(uid);
  const spId = spRow?.specialty_id;
  if (!spId || spId == 0) return eos(ctx, '⚠️ لم تحدد تخصصك بعد.', {parse_mode:'Markdown',...build([back('main_menu')])});

  const sp = await content.getSpec(spId);
  const {all} = require('../database/db');

  // كل المواد مع عدد ملفاتها وعدد اللي شافها المستخدم
  const subjects = await all(`
    SELECT s.name as sub_name,
           COUNT(DISTINCT f.id) as total,
           COUNT(DISTINCT CASE WHEN h.user_id=? THEN h.file_id END) as seen
    FROM subjects s
    JOIN semesters sm ON s.semester_id=sm.id
    JOIN years y ON sm.year_id=y.id
    JOIN categories c ON c.subject_id=s.id
    JOIN files f ON f.category_id=c.id AND f.is_deleted=0
    LEFT JOIN history h ON h.file_id=f.id AND h.user_id=?
    WHERE y.specialty_id=? AND s.is_deleted=0
    GROUP BY s.id, s.name
    ORDER BY seen DESC, total DESC
  `, [uid, uid, spId]);

  if (!subjects.length) return eos(ctx, '📭 لا يوجد محتوى في تخصصك بعد.', {parse_mode:'Markdown',...build([back('main_menu')])});

  const totalFiles = subjects.reduce((a,s) => a + parseInt(s.total), 0);
  const totalSeen = subjects.reduce((a,s) => a + parseInt(s.seen), 0);
  const overallPct = totalFiles ? Math.round(totalSeen/totalFiles*100) : 0;

  function progressBar(seen, total) {
    const pct = total ? Math.round(seen/total*100) : 0;
    const filled = Math.round(pct/10);
    const bar = '█'.repeat(filled) + '░'.repeat(10-filled);
    return '['+bar+'] '+pct+'%';
  }

  function medal(pct) {
    if(pct>=100) return '🏆';
    if(pct>=75) return '🥇';
    if(pct>=50) return '🥈';
    if(pct>=25) return '🥉';
    return '📚';
  }

  let text = '📊 *تقدمك في ' + escMd(sp.name) + '*\n';
  text += '━━━━━━━━━━━━━━━━\n\n';

  subjects.forEach(s => {
    const seen = parseInt(s.seen);
    const total = parseInt(s.total);
    const pct = total ? Math.round(seen/total*100) : 0;
    text += medal(pct)+' *'+escMd(s.sub_name)+'*\n';
    text += '`'+progressBar(seen,total)+'`\n';
    text += '📄 '+seen+'/'+total+' ملف\n\n';
  });

  text += '━━━━━━━━━━━━━━━━\n';
  text += '🎯 *الإجمالي: '+totalSeen+'/'+totalFiles+' ملف*\n';
  text += '`'+progressBar(totalSeen,totalFiles)+'`\n';
  if(overallPct>=75) text += '\n🔥 *أداء ممتاز! استمر!*';
  else if(overallPct>=50) text += '\n💪 *في المنتصف! لا تتوقف!*';
  else if(overallPct>=25) text += '\n📖 *بداية جيدة! واصل!*';
  else text += '\n🚀 *ابدأ رحلتك التعليمية!*';

  return eos(ctx, text, {parse_mode:'Markdown',...build([
    [btn('🔄 تحديث','progress')],
    back('main_menu')
  ])});
}

async function showProfile(ctx){
  const uid=ctx.uid; const user=await usersDb.getById(uid);
  const dlCount=await interactions.getUserDownloadCount(uid);
  const _favs=await interactions.getFavs(uid); const favCount=_favs.length;
  const lang=getLang(uid);
  const spRow=await usersDb.getSpecialty(uid);
  const spId=spRow?.specialty_id;
  const sp=spId&&spId!=0?await content.getSpec(spId):null;
  const lastFile=await interactions.getLastFile(uid);
  let text='👤 *ملفك الشخصي*\n\n';
  text+='🆔 ID: `'+uid+'`\n';
  text+='👋 الاسم: '+(user?.first_name||'غير معروف')+'\n';
  if(user?.username) text+='📛 @'+escMd(user.username)+'\n';
  text+='📅 انضم: '+(user?.joined_at?formatDate(user.joined_at):'غير معروف')+'\n';
  text+='🎓 التخصص: *'+(sp?escMd(sp.name):'غير محدد')+'*\n';
  text+='\n📊 *النشاط:*\n';
  text+='⬇️ التحميلات: *'+dlCount+'*\n';
  text+='⭐ المفضلة: *'+favCount+'*\n';
  if(lastFile) text+='📄 آخر ملف: *'+escMd(lastFile.title)+'*\n';
  text+='🌍 اللغة: *'+(lang==='ar'?'العربية 🇩🇿':'English 🇬🇧')+'*';
  const rows=[[btn(lang==='ar'?'Switch to English 🇬🇧':'التبديل للعربية 🇩🇿','lang_'+(lang==='ar'?'en':'ar'))],[btn('📊 تقدمي في تخصصي','progress'),btn('🎯 موصى به','recommended')],back('main_menu')];
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

module.exports={showLatest,showPopular,showNewInSpecialty,showRecommended,showFavorites,toggleFav,showHistory,showProfile,showStats,handleSearch,showProgress};
