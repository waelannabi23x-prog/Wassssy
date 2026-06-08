'use strict';
const { get, run, all } = require('../database/db');
const { cacheGet, cacheSet } = require('../utils/cache');
const logger = require('../utils/logger');

function fmt(n) { return Number(n||0).toLocaleString('en') + ' $'; }
async function getAcc(uid) { return await get('SELECT * FROM bank_accounts WHERE user_id=$1',[uid]); }
async function ensureAcc(ctx) {
  const uid=ctx.from?.id;
  let a=await getAcc(uid);
  if(!a){ await run('INSERT INTO bank_accounts(user_id,first_name,username,balance) VALUES($1,$2,$3,1000)',[uid,ctx.from?.first_name||'',ctx.from?.username||'']); a=await getAcc(uid); }
  return a;
}

async function handleDaily(ctx) {
  const uid=ctx.from?.id;
  const acc=await ensureAcc(ctx);
  const ck='daily_'+uid;
  const last=cacheGet(ck);
  if(last){ const rem=86400000-(Date.now()-last); if(rem>0){ const h=Math.floor(rem/3600000),m=Math.floor((rem%3600000)/60000); return ctx.reply('⏳ *انتظر '+h+'س '+m+'د*\n💰 رصيدك: *'+fmt(acc.balance)+'*', { reply_to_message_id: ctx.message?.message_id, parse_mode:'Markdown',reply_to_message_id:ctx.message?.message_id}).catch(()=>{}); } }
  const lr=await get("SELECT created_at FROM bank_transactions WHERE from_id=0 AND to_id=$1 AND type='daily' ORDER BY created_at DESC LIMIT 1",[uid]).catch(()=>null);
  if(lr?.created_at){ const t=new Date(lr.created_at).getTime(),rem=86400000-(Date.now()-t); if(rem>0){ cacheSet(ck,t,rem); const h=Math.floor(rem/3600000),m=Math.floor((rem%3600000)/60000); return ctx.reply('⏳ *انتظر '+h+'س '+m+'د*\n💰 رصيدك: *'+fmt(acc.balance)+'*', { reply_to_message_id: ctx.message?.message_id, parse_mode:'Markdown',reply_to_message_id:ctx.message?.message_id}).catch(()=>{}); } }
  const xr=await get('SELECT xp FROM user_xp WHERE user_id=$1',[uid]).catch(()=>null);
  const bonus=Math.floor((xr?.xp||0)/100)*50;
  const reward=Math.min(500+bonus,5000);
  await run('UPDATE bank_accounts SET balance=balance+$1 WHERE user_id=$2',[reward,uid]);
  await run("INSERT INTO bank_transactions(from_id,to_id,amount,type,note) VALUES(0,$1,$2,'daily','مكافأة يومية')",[uid,reward]);
  cacheSet(ck,Date.now(),86400000);
  return ctx.reply('🎁 *مكافأتك اليومية!*\n━━━━━━━━━━━━━━━\n\n💰 المكافأة: *+'+fmt(reward)+'*'+(bonus>0?' _(مكافأة مستوى)_':'')+'\n🏦 الرصيد: *'+fmt((acc.balance||0)+reward)+'*\n\n⏰ عود غداً!', { reply_to_message_id: ctx.message?.message_id, parse_mode:'Markdown',reply_to_message_id:ctx.message?.message_id}).catch(()=>{});
}

async function handleFlip(ctx) {
  const uid=ctx.from?.id;
  const args=(ctx.message?.text||'').split(' ');
  const bet=parseInt(args[1]);
  if(!bet||bet<100) return ctx.reply('🎲 *قلب العملة*\n\nالاستخدام: /flip [مبلغ]\nمثال: /flip 500\nالحد الأدنى: 100$', { reply_to_message_id: ctx.message?.message_id, parse_mode:'Markdown',reply_to_message_id:ctx.message?.message_id}).catch(()=>{});
  const acc=await ensureAcc(ctx);
  if((acc.balance||0)<bet) return ctx.reply('❌ رصيدك غير كافٍ!\n💰 رصيدك: *'+fmt(acc.balance)+'*', { reply_to_message_id: ctx.message?.message_id, parse_mode:'Markdown',reply_to_message_id:ctx.message?.message_id}).catch(()=>{});
  const maxBet=Math.min(Math.floor((acc.balance||0)*0.5),50000);
  if(bet>maxBet) return ctx.reply('⚠️ الحد الأقصى: *'+fmt(maxBet)+'*', { reply_to_message_id: ctx.message?.message_id, parse_mode:'Markdown',reply_to_message_id:ctx.message?.message_id}).catch(()=>{});
  const wm=await ctx.reply('🪙 تقلب العملة...',{reply_to_message_id:ctx.message?.message_id}).catch(()=>null);
  await new Promise(r=>setTimeout(r,1500));
  const win=Math.random()<0.5;
  const change=win?bet:-bet;
  await run('UPDATE bank_accounts SET balance=balance+$1 WHERE user_id=$2',[change,uid]);
  await run("INSERT INTO bank_transactions(from_id,to_id,amount,type,note) VALUES($1,$2,$3,'flip',$4)",[win?0:uid,win?uid:0,bet,win?'ربح قلب عملة':'خسارة قلب عملة']);
  if(win){ try{ const {awardPoints}=require('../database/points'); await awardPoints(uid,'rating').catch(()=>{}); }catch(_){} }
  const newBal=(acc.balance||0)+change;
  const txt=win?'🦅 *صقر — فزت!*\n\n💰 ربحت: *+'+fmt(bet)+'*\n🏦 رصيدك: *'+fmt(newBal)+'*':'🪙 *كتابة — خسرت!*\n\n💸 خسرت: *-'+fmt(bet)+'*\n🏦 رصيدك: *'+fmt(newBal)+'*\n_حظاً أوفر!_';
  if(wm) ctx.telegram.editMessageText(ctx.chat.id,wm.message_id,null,txt,{parse_mode:'Markdown'}).catch(()=>ctx.reply(txt, { reply_to_message_id: ctx.message?.message_id, parse_mode:'Markdown'}).catch(()=>{}));
  else ctx.reply(txt, { reply_to_message_id: ctx.message?.message_id, parse_mode:'Markdown',reply_to_message_id:ctx.message?.message_id}).catch(()=>{});
}

async function handleRob(ctx) {
  const uid=ctx.from?.id;
  const target=ctx.message?.reply_to_message?.from;
  if(!target||target.is_bot||target.id===uid) return ctx.reply('🦹 *السرقة*\n\nرد على رسالة شخص لتسرقه!\nنسبة نجاح: 40% — عند الفشل: غرامة 5%', { reply_to_message_id: ctx.message?.message_id, parse_mode:'Markdown',reply_to_message_id:ctx.message?.message_id}).catch(()=>{});
  const rk='rob_'+uid;
  if(cacheGet(rk)) return ctx.reply('⏳ انتظر 5 دقائق بين كل سرقة!',{reply_to_message_id:ctx.message?.message_id}).catch(()=>{});
  const [ra,va]=await Promise.all([ensureAcc(ctx),getAcc(target.id)]);
  if(!va||va.balance<200) return ctx.reply('😔 الضحية مفلسة — ما في شيء يُسرق!',{reply_to_message_id:ctx.message?.message_id}).catch(()=>{});
  cacheSet(rk,1,300000);
  const ok2=Math.random()<0.4;
  if(ok2){
    const s=Math.floor(Math.min(va.balance*0.1,2000));
    await Promise.all([run('UPDATE bank_accounts SET balance=balance+$1 WHERE user_id=$2',[s,uid]),run('UPDATE bank_accounts SET balance=balance-$1 WHERE user_id=$2',[s,target.id]),run("INSERT INTO bank_transactions(from_id,to_id,amount,type,note) VALUES($1,$2,$3,'rob','سرقة')",[target.id,uid,s])]);
    return ctx.reply('🦹 *السرقة نجحت!*\n\n🎯 الضحية: *'+(target.first_name||'مجهول')+'*\n💰 المسروق: *'+fmt(s)+'*\n🏦 رصيدك: *'+fmt((ra.balance||0)+s)+'*', { reply_to_message_id: ctx.message?.message_id, parse_mode:'Markdown',reply_to_message_id:ctx.message?.message_id}).catch(()=>{});
  } else {
    const f=Math.min(Math.floor((ra.balance||0)*0.05),500);
    await Promise.all([run('UPDATE bank_accounts SET balance=balance-$1 WHERE user_id=$2',[f,uid]),run('UPDATE bank_accounts SET balance=balance+$1 WHERE user_id=$2',[f,target.id]),run("INSERT INTO bank_transactions(from_id,to_id,amount,type,note) VALUES($1,$2,$3,'rob_fine','غرامة سرقة')",[uid,target.id,f])]);
    return ctx.reply('🚔 *السرقة فشلت!*\n\n👮 تم القبض عليك\n💸 الغرامة: *-'+fmt(f)+'*\n🏦 رصيدك: *'+fmt(Math.max(0,(ra.balance||0)-f))+'*',{parse_mode:'Markdown',reply_to_message_id:ctx.message?.message_id}).catch(()=>{});
  }
}

async function handleLeaderboard(ctx) {
  const isGrp=['group','supergroup'].includes(ctx.chat?.type);
  const cid=ctx.chat?.id;
  let pl;
  if(isGrp) pl=await all('SELECT ba.user_id,ba.first_name,ba.username,ba.balance FROM bank_accounts ba INNER JOIN group_members gm ON gm.user_id=ba.user_id AND gm.chat_id=$1 ORDER BY ba.balance DESC LIMIT 10',[cid]).catch(()=>[]);
  else pl=await all('SELECT user_id,first_name,username,balance FROM bank_accounts ORDER BY balance DESC LIMIT 10').catch(()=>[]);
  if(!pl?.length) return ctx.reply('📭 لا يوجد لاعبون بعد!\n\nاكتب: انشاء حساب',{reply_to_message_id:ctx.message?.message_id}).catch(()=>{});
  const md=['🥇','🥈','🥉'];
  let txt='🏆 *'+(isGrp?'أثرياء المجموعة':'المتصدرون عالمياً')+'*\n━━━━━━━━━━━━━━━━━━━━\n\n';
  pl.forEach((p,i)=>{ const me=p.user_id==ctx.from?.id; txt+=( md[i]||(i+1)+'.')+(me?' *أنت —* ':' ')+(p.first_name||p.username||'مجهول')+'\n   💰 '+fmt(p.balance)+'\n\n'; });
  return ctx.reply(txt, { reply_to_message_id: ctx.message?.message_id, parse_mode:'Markdown',reply_to_message_id:ctx.message?.message_id}).catch(()=>{});
}

async function handleBankGamesCallback(ctx,data) {
  if(data==='games_leaderboard'){ ctx.answerCbQuery().catch(()=>{}); return handleLeaderboard(ctx); }
  if(data==='games_bank'){ ctx.answerCbQuery().catch(()=>{}); return require('./bank').showBalance(ctx); }
  if(data==='games_daily'){ ctx.answerCbQuery().catch(()=>{}); return handleDaily(ctx); }
  if(data==='games_start_million'){ ctx.answerCbQuery('اكتب: مليون',{show_alert:true}).catch(()=>{}); return; }
  if(data==='games_start_guess'){ ctx.answerCbQuery('اكتب: خمن',{show_alert:true}).catch(()=>{}); return; }
  if(data==='games_start_flip'){ ctx.answerCbQuery().catch(()=>{}); return ctx.reply('🎲 /flip [مبلغ] — مثال: /flip 500',{reply_to_message_id:ctx.message?.message_id}).catch(()=>{}); }
  return false;
}

module.exports = { handleDaily, handleFlip, handleRob, handleLeaderboard, handleBankGamesCallback };
