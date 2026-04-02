const fs = require('fs');
const path = './handlers/user.js';
let code = fs.readFileSync(path, 'utf8');
const oldFn = `async function toggleFav(ctx,fid,remove=false){
  const uid=ctx.uid;
  if(remove||await interactions.isFav(uid,fid)){
    await interactions.removeFav(uid,fid);
    await ctx.answerCbQuery('❌ تم الحذف').catch(()=>{});
  } else {
    await interactions.addFav(uid,fid);
    await ctx.answerCbQuery('⭐ تم الحفظ!').catch(()=>{});
  }
}`;
const newFn = `async function toggleFav(ctx,fid,remove=false){
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
}`;
code=code.replace(oldFn,newFn);
fs.writeFileSync(path,code);
console.log('Done!');
