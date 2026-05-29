'use strict';
const { all, get, run } = require('../database/db');

const PRIZES = [0,100,200,500,1000,2000,5000,10000,20000,50000,100000,250000,500000,1000000];
const SAFE_ZONES = [4,7,10];
const ANSWER_TIME = 30;

const QS = [
  {q:'ما هي عاصمة الجزائر؟',a:0,opts:['الجزائر','وهران','قسنطينة','عنابة'],d:1},
  {q:'كم عدد اضلاع المثلث؟',a:1,opts:['4','3','5','6'],d:1},
  {q:'من اكتشف الجاذبية؟',a:2,opts:['انشتاين','داروين','نيوتن','غاليليو'],d:2},
  {q:'اكبر قارة في العالم؟',a:0,opts:['اسيا','افريقيا','اوروبا','امريكا'],d:1},
  {q:'كم تساوي 15x15؟',a:2,opts:['200','215','225','250'],d:2},
  {q:'متى قامت الثورة الجزائرية؟',a:1,opts:['1952','1954','1956','1958'],d:2},
  {q:'اسرع حيوان بري؟',a:0,opts:['الفهد','الاسد','الغزال','الحصان'],d:2},
  {q:'كم حاسة للانسان؟',a:1,opts:['4','5','6','7'],d:1},
  {q:'من كتب البؤساء؟',a:3,opts:['ديكنز','بلزاك','تولستوي','فيكتور هوغو'],d:3},
  {q:'الرمز الكيميائي للذهب؟',a:2,opts:['Gl','Gd','Au','Go'],d:3},
  {q:'اطول نهر في العالم؟',a:0,opts:['النيل','الامازون','المسيسيبي','اليانغتسي'],d:2},
  {q:'برج ايفل في اي بلد؟',a:1,opts:['ايطاليا','فرنسا','اسبانيا','بلجيكا'],d:1},
  {q:'عملة السعودية؟',a:2,opts:['دينار','درهم','ريال','قرش'],d:1},
  {q:'عدد لاعبي كرة القدم لكل فريق؟',a:1,opts:['10','11','12','9'],d:1},
  {q:'من اخترع الهاتف؟',a:0,opts:['غراهام بيل','اديسون','تسلا','ماركوني'],d:2},
  {q:'اكثر معدن ثقلا في الطبيعة؟',a:2,opts:['الرصاص','الذهب','الاوزميوم','البلاتين'],d:4},
  {q:'اقرب كوكب للشمس؟',a:0,opts:['عطارد','الزهرة','الارض','المريخ'],d:2},
  {q:'من بنى الاهرامات؟',a:1,opts:['الرومان','المصريون القدامى','الاغريق','الفرس'],d:1},
  {q:'كم ساعة في الاسبوع؟',a:3,opts:['148','158','162','168'],d:2},
  {q:'عدد ركائز الاسلام؟',a:1,opts:['4','5','6','7'],d:1},
  {q:'عاصمة اليابان؟',a:2,opts:['اوساكا','كيوتو','طوكيو','ناغويا'],d:1},
  {q:'من فاز بكاس العالم 2022؟',a:1,opts:['فرنسا','الارجنتين','البرازيل','المغرب'],d:2},
  {q:'اكبر مدينة في العالم سكانا؟',a:0,opts:['طوكيو','شنغهاي','دلهي','بكين'],d:3},
  {q:'الغاز الاكثر وفرة في الغلاف الجوي؟',a:1,opts:['الاوكسجين','النيتروجين','ثاني اكسيد الكربون','الهيدروجين'],d:3},
  {q:'كم عدد ابراج الفلك؟',a:2,opts:['10','11','12','13'],d:2},
  {q:'من رسم الموناليزا؟',a:0,opts:['ليوناردو دافينشي','مايكل انجلو','رافاييل','بيكاسو'],d:2},
  {q:'اعمق بحيرة في العالم؟',a:1,opts:['بحيرة فيكتوريا','بايكال','تيتيكاكا','سوبيريور'],d:3},
  {q:'عدد عظام الجسم البالغ؟',a:2,opts:['196','200','206','210'],d:3},
  {q:'من كتب الف ليلة وليلة؟',a:3,opts:['ابن سينا','الجاحظ','ابن خلدون','مجهول'],d:3},
  {q:'اعلى قمة في العالم؟',a:0,opts:['ايفرست','k2','كانشنجانغا','لوتسي'],d:2},
  {q:'اول رائد فضاء في التاريخ؟',a:1,opts:['نيل ارمسترونغ','يوري غاغارين','بوز الدرين','فالنتينا'],d:2},
  {q:'عاصمة كندا؟',a:2,opts:['تورنتو','مونتريال','اوتاوا','فانكوفر'],d:2},
  {q:'اكبر محيط في العالم؟',a:0,opts:['الهادي','الاطلسي','الهندي','المتجمد الشمالي'],d:1},
  {q:'كم دقيقة في اليوم؟',a:3,opts:['1200','1320','1400','1440'],d:2},
  {q:'ما هو عدد الكروموسومات في الخلية البشرية؟',a:1,opts:['23','46','48','22'],d:4},
];

const sessions = new Map();

class Game {
  constructor(chatId, hostId, hostName) {
    this.chatId    = chatId;
    this.hostId    = hostId;
    this.hostName  = hostName;
    this.state     = 'waiting';
    this.players   = new Map();
    this.queue     = [];
    this.current   = null;
    this.qIdx      = 0;
    this.question  = null;
    this.usedQs    = new Set();
    this.lifelines = {};
    this.msgId     = null;
    this.timer     = null;
    this.prizePool = 0;
    this.startTime = Date.now();
  }
  addPlayer(uid, name) {
    if (!this.players.has(uid)) {
      this.players.set(uid, { name, score: 0, wins: 0 });
      this.lifelines[uid] = { fifty: true, phone: true, audience: true, skip: true };
    }
  }
  prize()     { return PRIZES[this.qIdx] || 0; }
  nextPrize() { return PRIZES[this.qIdx + 1] || PRIZES[PRIZES.length - 1]; }
  safePrize() {
    for (let i = this.qIdx - 1; i >= 0; i--)
      if (SAFE_ZONES.includes(i)) return PRIZES[i];
    return 0;
  }
  isSafe() { return SAFE_ZONES.includes(this.qIdx); }
}

function getQ(session) {
  const diff = Math.min(Math.ceil((session.qIdx + 1) / 3), 5);
  const pool = QS.filter(q => !session.usedQs.has(q.q) && Math.abs(q.d - diff) <= 1);
  const src  = pool.length ? pool : QS.filter(q => !session.usedQs.has(q.q));
  const list = src.length ? src : QS;
  const q    = list[Math.floor(Math.random() * list.length)];
  session.usedQs.add(q.q);
  return q;
}

function lobbyTxt(s) {
  const pl = [...s.players.values()];
  return `🎰 *من سيربح المليون؟*\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `👑 المضيف: *${s.hostName}*\n` +
    `👥 اللاعبون (${pl.length}):\n` +
    (pl.length ? pl.map((p,i) => `${i+1}. ${p.name}`).join('\n') : '_لا يوجد لاعبون_') + '\n' +
    `━━━━━━━━━━━━━━━━━\n` +
    `اضغط *انضم* للمشاركة!`;
}

function lobbyKb() {
  return { inline_keyboard: [
    [
      { text: '➕ انضم', callback_data: 'ml_join' },
      { text: '🚀 ابدأ', callback_data: 'ml_start' },
    ],
    [
      { text: '📊 الترتيب', callback_data: 'ml_top' },
      { text: '❓ كيف العب', callback_data: 'ml_help' },
    ],
    [{ text: '🔴 الغاء', callback_data: 'ml_cancel' }],
  ]};
}

function qTxt(s, q, hidden) {
  const opts  = hidden || q.opts;
  const let_  = ['أ','ب','ج','د'];
  const lines = opts.map((o,i) => o ? `${let_[i]}) ${o}` : `${let_[i]}) ~~محذوف~~`).join('\n');
  const pl    = s.players.get(s.current);
  const ll    = s.lifelines[s.current] || {};
  const stg   = PRIZES.slice(Math.max(0,s.qIdx-1), s.qIdx+4)
    .map((p,i) => {
      const ri = Math.max(0,s.qIdx-1) + i;
      if (ri === s.qIdx) return `▶️${p.toLocaleString()}`;
      if (SAFE_ZONES.includes(ri)) return `🛡️${p.toLocaleString()}`;
      if (ri < s.qIdx) return `✅`;
      return `⬜${p.toLocaleString()}`;
    }).join(' │ ');

  return `🎮 *السؤال ${s.qIdx + 1}* ${'⭐'.repeat(Math.min(q.d,5))}\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `👤 *${pl?.name}*\n` +
    `💰 الجائزة: *${s.prize().toLocaleString()} دج*\n` +
    `🎯 التالية: *${s.nextPrize().toLocaleString()} دج*\n` +
    `🛡️ الضمان: *${s.safePrize().toLocaleString()} دج*\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `❓ *${q.q}*\n\n${lines}\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `🆘 ${ll.fifty?'5️⃣0️⃣':'~~50~~'} ${ll.phone?'📞':'~~📞~~'} ${ll.audience?'👥':'~~👥~~'} ${ll.skip?'⏭️':'~~⏭️~~'}\n` +
    `⏱️ *${ANSWER_TIME} ثانية!*\n` +
    `📊 ${stg}`;
}

function qKb(s, hidden) {
  const opts = hidden || s.question?.opts || [];
  const let_ = ['أ','ب','ج','د'];
  const ll   = s.lifelines[s.current] || {};
  const rows = [];
  const r1 = [], r2 = [];
  opts.forEach((o,i) => {
    if (!o) return;
    const b = { text: `${let_[i]}) ${o.substring(0,18)}`, callback_data: `ml_a${i}` };
    i < 2 ? r1.push(b) : r2.push(b);
  });
  if (r1.length) rows.push(r1);
  if (r2.length) rows.push(r2);
  const hlp = [];
  if (ll.fifty)    hlp.push({ text: '5️⃣0️⃣', callback_data: 'ml_ll_fifty' });
  if (ll.phone)    hlp.push({ text: '📞 اتصل', callback_data: 'ml_ll_phone' });
  if (ll.audience) hlp.push({ text: '👥 جمهور', callback_data: 'ml_ll_audience' });
  if (ll.skip)     hlp.push({ text: '⏭️ تخطي', callback_data: 'ml_ll_skip' });
  if (hlp.length)  rows.push(hlp);
  rows.push([{ text: '🏃 انسحب + خذ الضمان', callback_data: 'ml_walk' }]);
  return { inline_keyboard: rows };
}

function scoreTxt(s) {
  const sorted = [...s.players.entries()].sort((a,b) => b[1].score - a[1].score);
  const md = ['🥇','🥈','🥉'];
  const rows = sorted.map(([,p],i) => `${md[i]||`${i+1}.`} *${p.name}*: ${p.score.toLocaleString()} دج`).join('\n');
  return `🏆 *نتائج الجولة*\n━━━━━━━━━━━━━━━━━\n${rows}\n━━━━━━━━━━━━━━━━━\n💰 إجمالي: *${s.prizePool.toLocaleString()} دج*`;
}

async function nextTurn(bot, s) {
  if (!s.queue.length) return endGame(bot, s);
  s.current = s.queue.shift();
  s.qIdx = 0;
  s.usedQs.clear();
  const pl = s.players.get(s.current);
  if (!pl) return nextTurn(bot, s);
  await bot.telegram.sendMessage(s.chatId,
    `🎮 دور *${pl.name}*!\n💰 الجائزة الكبرى: *${PRIZES[PRIZES.length-1].toLocaleString()} دج*\nهل انت مستعد؟`,
    { parse_mode:'Markdown', reply_markup:{ inline_keyboard:[[
      { text:'✅ مستعد!', callback_data:'ml_ready' },
      { text:'❌ تنازل', callback_data:'ml_forfeit' },
    ]]}}).catch(()=>{});
}

async function askQ(bot, s) {
  const q = getQ(s);
  s.question = q;
  if (s.timer) { clearTimeout(s.timer); s.timer = null; }
  const txt = qTxt(s, q);
  const kb  = qKb(s);
  try {
    if (s.msgId) {
      await bot.telegram.editMessageText(s.chatId, s.msgId, null, txt, { parse_mode:'Markdown', reply_markup:kb });
    } else {
      const m = await bot.telegram.sendMessage(s.chatId, txt, { parse_mode:'Markdown', reply_markup:kb });
      s.msgId = m.message_id;
    }
  } catch(err) { require('../utils/logger').debug('[catch]', err.message); }
  s.timer = setTimeout(() => timeOut(bot, s), ANSWER_TIME * 1000);
}

async function timeOut(bot, s) {
  s.timer = null;
  const q   = s.question;
  const pl  = s.players.get(s.current);
  const saf = s.safePrize();
  if (pl) { pl.score += saf; s.prizePool += saf; }
  try {
    await bot.telegram.editMessageText(s.chatId, s.msgId, null,
      `⏰ *انتهى الوقت!*\nالاجابة الصحيحة: *${['أ','ب','ج','د'][q.a]}) ${q.opts[q.a]}*\n💰 *${pl?.name}* خرج بـ *${saf.toLocaleString()} دج*`,
      { parse_mode:'Markdown', reply_markup:{ inline_keyboard:[] }});
  } catch(err) { require('../utils/logger').debug('[catch]', err.message); }
  await saveStat(s, s.current, saf, false);
  await sleep(3000);
  s.msgId = null;
  nextTurn(bot, s);
}

async function onAnswer(bot, ctx, s, idx) {
  if (ctx.from.id !== s.current)
    return ctx.answerCbQuery('⚠️ ليس دورك!', { show_alert:true }).catch(()=>{});
  if (s.timer) { clearTimeout(s.timer); s.timer = null; }
  ctx.answerCbQuery('').catch(()=>{});
  const q   = s.question;
  const pl  = s.players.get(s.current);
  const ok  = idx === q.a;
  if (ok) {
    const prz = s.prize();
    s.qIdx++;
    const isMil = s.qIdx >= PRIZES.length - 1;
    if (pl && isMil) { pl.score += PRIZES[PRIZES.length-1]; pl.wins++; s.prizePool += PRIZES[PRIZES.length-1]; }
    try {
      await bot.telegram.editMessageText(s.chatId, s.msgId, null,
        isMil
          ? `🎆🎉👑 *مليونير جديد!*\n👤 *${pl?.name}* ربح *المليون دج!* 🏆🎊`
          : `✅ *إجابة صحيحة!* 🎉\n👤 *${pl?.name}*\n💰 ربح: *${prz.toLocaleString()} دج*\n${s.isSafe()?'🛡️ منطقة آمنة!\n':''}🎯 التالية: *${s.nextPrize().toLocaleString()} دج*`,
        { parse_mode:'Markdown', reply_markup:{ inline_keyboard:[] }});
    } catch(err) { require('../utils/logger').debug('[catch]', err.message); }
    if (isMil) {
      await saveStat(s, s.current, PRIZES[PRIZES.length-1], true);
      await sleep(4000); s.msgId = null; return nextTurn(bot, s);
    }
    await sleep(2500); s.msgId = null; askQ(bot, s);
  } else {
    const saf = s.safePrize();
    if (pl) { pl.score += saf; s.prizePool += saf; }
    try {
      await bot.telegram.editMessageText(s.chatId, s.msgId, null,
        `❌ *إجابة خاطئة!*\nالصحيحة: *${['أ','ب','ج','د'][q.a]}) ${q.opts[q.a]}*\n💔 *${pl?.name}* خرج بـ *${saf.toLocaleString()} دج*`,
        { parse_mode:'Markdown', reply_markup:{ inline_keyboard:[] }});
    } catch(err) { require('../utils/logger').debug('[catch]', err.message); }
    await saveStat(s, s.current, saf, false);
    await sleep(3000); s.msgId = null; nextTurn(bot, s);
  }
}

async function useLL(bot, ctx, s, type) {
  if (ctx.from.id !== s.current)
    return ctx.answerCbQuery('⚠️ ليس دورك!', { show_alert:true }).catch(()=>{});
  const ll = s.lifelines[s.current];
  if (!ll || !ll[type])
    return ctx.answerCbQuery('هذه المساعدة مستخدمة!', { show_alert:true }).catch(()=>{});
  ll[type] = false;
  ctx.answerCbQuery('').catch(()=>{});
  const q = s.question;

  if (type === 'fifty') {
    const wrong  = [0,1,2,3].filter(i => i !== q.a).sort(()=>Math.random()-.5).slice(0,2);
    const hidden = q.opts.map((o,i) => wrong.includes(i) ? null : o);
    s.question = { ...q, hidden };
    await bot.telegram.sendMessage(s.chatId, `5️⃣0️⃣ *50/50* — تم حذف إجابتين!`, { parse_mode:'Markdown' }).catch(()=>{});
    try {
      await bot.telegram.editMessageText(s.chatId, s.msgId, null, qTxt(s,q,hidden), { parse_mode:'Markdown', reply_markup:qKb(s,hidden) });
    } catch(err) { require('../utils/logger').debug('[catch]', err.message); }
  } else if (type === 'phone') {
    const others = [...s.players.entries()].filter(([uid])=>uid!==s.current);
    const friend = others.length ? others[Math.floor(Math.random()*others.length)][1].name : 'الصديق';
    const right  = Math.random() > 0.35;
    const hint   = right ? q.opts[q.a] : q.opts[(q.a+1+Math.floor(Math.random()*3))%4];
    await bot.telegram.sendMessage(s.chatId,
      `📞 *اتصال بالصديق*\n🗣️ *${friend}* يقول:\n"اعتقد الاجابة هي *${hint}*... لكن مش متاكد 100% 🤔"`,
      { parse_mode:'Markdown' }).catch(()=>{});
  } else if (type === 'audience') {
    const dist = genDist(q.a);
    const let_ = ['أ','ب','ج','د'];
    const bars = q.opts.map((o,i) => {
      const b = '█'.repeat(Math.round(dist[i]/5)) + '░'.repeat(20-Math.round(dist[i]/5));
      return `${let_[i]}) ${b} ${dist[i]}%`;
    }).join('\n');
    await bot.telegram.sendMessage(s.chatId, `👥 *رأي الجمهور*\n\n${bars}`, { parse_mode:'Markdown' }).catch(()=>{});
  } else if (type === 'skip') {
    if (s.timer) { clearTimeout(s.timer); s.timer = null; }
    await bot.telegram.sendMessage(s.chatId, `⏭️ *تم التخطي!* سؤال جديد...`, { parse_mode:'Markdown' }).catch(()=>{});
    await sleep(1500); s.msgId = null; askQ(bot, s);
  }
}

function genDist(correctIdx) {
  const d  = [0,0,0,0];
  const cw = Math.round((0.55 + Math.random()*0.2) * 100);
  d[correctIdx] = cw;
  const others  = [0,1,2,3].filter(i=>i!==correctIdx);
  let left = 100 - cw;
  others.forEach((i,idx) => {
    if (idx === others.length-1) { d[i] = left; }
    else { const v = Math.round(Math.random()*left*0.8); d[i]=v; left-=v; }
  });
  return d;
}

async function endGame(bot, s) {
  s.state = 'ended';
  if (s.timer) { clearTimeout(s.timer); s.timer = null; }
  const top = [...s.players.entries()].sort((a,b)=>b[1].score-a[1].score)[0];
  try {
    await bot.telegram.sendMessage(s.chatId,
      `🎮 *انتهت اللعبة!*\n\n${scoreTxt(s)}\n\n🏆 الفائز: *${top?top[1].name:'لا احد'}*\n\nشكرا للجميع! لجولة جديدة: /million`,
      { parse_mode:'Markdown' });
  } catch(err) { require('../utils/logger').debug('[catch]', err.message); }
  sessions.delete(s.chatId);
}

async function saveStat(s, uid, prize, won) {
  try {
    await run(`CREATE TABLE IF NOT EXISTS million_stats(id BIGSERIAL PRIMARY KEY,user_id BIGINT,chat_id BIGINT,prize INTEGER DEFAULT 0,won SMALLINT DEFAULT 0,questions_answered INTEGER DEFAULT 0,played_at TIMESTAMPTZ DEFAULT NOW())`).catch(()=>{});
    await run(`INSERT INTO million_stats(user_id,chat_id,prize,won,questions_answered,played_at) VALUES($1,$2,$3,$4,$5,NOW())`,
      [uid, s.chatId, prize, won?1:0, s.qIdx]).catch(()=>{});
    const xp = Math.round(prize/100) + (won?500:50);
    await run(`INSERT INTO user_points(user_id,total_points) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET total_points=user_points.total_points+$2`,
      [uid, xp]).catch(()=>{});
  } catch(err) { require('../utils/logger').debug('[catch]', err.message); }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function cmdMillion(ctx) {
  if (ctx.chat?.type === 'private')
    return ctx.reply('هذه اللعبة للمجموعات فقط!\nاضف البوت لمجموعتك واكتب /million').catch(()=>{});
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const name   = ctx.from.first_name || 'لاعب';
  if (sessions.has(chatId)) {
    const s = sessions.get(chatId);
    return ctx.reply(
      `يوجد لعبة جارية!\nالمضيف: ${s.hostName}\nاللاعبون: ${s.players.size}`,
      { reply_markup:{ inline_keyboard:[[
        { text:'➕ انضم', callback_data:'ml_join' },
        { text:'🔴 انهاء', callback_data:'ml_cancel' },
      ]]}}).catch(()=>{});
  }
  const s = new Game(chatId, userId, name);
  s.addPlayer(userId, name);
  sessions.set(chatId, s);
  const msg = await ctx.reply(lobbyTxt(s), { parse_mode:'Markdown', reply_markup:lobbyKb() }).catch(()=>null);
  if (msg) s.msgId = msg.message_id;
}

async function cmdHelp(ctx) {
  return ctx.reply(
    `🎮 *من سيربح المليون؟ — كيف تلعب*\n━━━━━━━━━━━━━━━━━\n` +
    `1. اكتب /million لإنشاء لعبة\n2. الاصدقاء يضغطون "انضم"\n3. المضيف يضغط "ابدأ"\n4. كل لاعب يلعب بالترتيب\n\n` +
    `💰 *14 مرحلة من 100 الى 1,000,000 دج*\n\n` +
    `🛡️ *مناطق آمنة:* المرحلة 4، 7، 10\n\n` +
    `🆘 *المساعدات:*\n5️⃣0️⃣ 50/50 — حذف إجابتين\n📞 اتصل بصديق\n👥 رأي الجمهور\n⏭️ تخطي السؤال`,
    { parse_mode:'Markdown' }).catch(()=>{});
}

async function cmdTop(ctx) {
  try {
    await run(`CREATE TABLE IF NOT EXISTS million_stats(id BIGSERIAL PRIMARY KEY,user_id BIGINT,chat_id BIGINT,prize INTEGER DEFAULT 0,won SMALLINT DEFAULT 0,questions_answered INTEGER DEFAULT 0,played_at TIMESTAMPTZ DEFAULT NOW())`).catch(()=>{});
    const rows = await all(
      `SELECT u.first_name,SUM(ms.prize) total,COUNT(*) games,SUM(ms.won) wins FROM million_stats ms LEFT JOIN users u ON u.id=ms.user_id WHERE ms.chat_id=$1 GROUP BY ms.user_id,u.first_name ORDER BY total DESC LIMIT 10`,
      [ctx.chat?.id]).catch(()=>[]);
    if (!rows.length) return ctx.reply('لا توجد إحصائيات بعد!').catch(()=>{});
    const md = ['🥇','🥈','🥉'];
    const txt = rows.map((r,i)=>`${md[i]||`${i+1}.`} *${r.first_name||'لاعب'}* — ${parseInt(r.total||0).toLocaleString()} دج | ${r.games} جولة | ${r.wins} فوز`).join('\n');
    ctx.reply(`🏆 *الترتيب*\n━━━━━━━━━━━━━━━━━\n${txt}`, { parse_mode:'Markdown' }).catch(()=>{});
  } catch(_) { ctx.reply('خطأ!').catch(()=>{}); }
}

async function handleCallback(bot, ctx) {
  const data   = ctx.callbackQuery?.data || '';
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  const name   = ctx.from?.first_name || 'لاعب';
  if (!data.startsWith('ml_')) return;
  ctx.answerCbQuery('').catch(()=>{});
  const s      = sessions.get(chatId);
  const action = data.slice(3);

  if (action === 'join') {
    if (!s || s.state !== 'waiting')
      return ctx.answerCbQuery('لا توجد لعبة في الانتظار!', { show_alert:true }).catch(()=>{});
    if (s.players.has(userId))
      return ctx.answerCbQuery('انت منضم بالفعل!', { show_alert:true }).catch(()=>{});
    s.addPlayer(userId, name);
    await bot.telegram.editMessageText(chatId, s.msgId, null, lobbyTxt(s), { parse_mode:'Markdown', reply_markup:lobbyKb() }).catch(()=>{});
    return ctx.answerCbQuery(`✅ انضممت للعبة!`, { show_alert:true }).catch(()=>{});
  }

  if (action === 'start') {
    if (!s) return ctx.answerCbQuery('لا توجد لعبة!', { show_alert:true }).catch(()=>{});
    if (s.hostId !== userId) return ctx.answerCbQuery('فقط المضيف يستطيع البدء!', { show_alert:true }).catch(()=>{});
    if (!s.players.size) return ctx.answerCbQuery('لا يوجد لاعبون!', { show_alert:true }).catch(()=>{});
    s.state = 'playing';
    s.queue = [...s.players.keys()].sort(()=>Math.random()-.5);
    s.msgId = null;
    await bot.telegram.sendMessage(chatId,
      `🚀 *انطلقت اللعبة!*\n👥 ${s.players.size} لاعبون\n🎯 الترتيب: ${[...s.queue].map(id=>s.players.get(id)?.name).join(' ← ')}`,
      { parse_mode:'Markdown' }).catch(()=>{});
    await sleep(2000);
    return nextTurn(bot, s);
  }

  if (action === 'ready') {
    if (!s || s.current !== userId) return;
    return askQ(bot, s);
  }

  if (action === 'forfeit') {
    if (!s || s.current !== userId) return;
    if (s.timer) { clearTimeout(s.timer); s.timer = null; }
    const saf = s.safePrize();
    const pl  = s.players.get(userId);
    if (pl) { pl.score += saf; s.prizePool += saf; }
    await bot.telegram.sendMessage(chatId,
      `🏃 *${pl?.name}* تنازل!\n💰 خرج بـ *${saf.toLocaleString()} دج*`,
      { parse_mode:'Markdown' }).catch(()=>{});
    s.msgId = null;
    await sleep(2000);
    return nextTurn(bot, s);
  }

  if (action === 'walk') {
    if (!s || s.current !== userId)
      return ctx.answerCbQuery('ليس دورك!', { show_alert:true }).catch(()=>{});
    if (s.timer) { clearTimeout(s.timer); s.timer = null; }
    const prz = s.prize();
    const pl  = s.players.get(userId);
    if (pl) { pl.score += prz; s.prizePool += prz; }
    await bot.telegram.editMessageText(s.chatId, s.msgId, null,
      `🚶 *${pl?.name}* انسحب بذكاء!\n💰 اخذ *${prz.toLocaleString()} دج* 🎉`,
      { parse_mode:'Markdown', reply_markup:{ inline_keyboard:[] }}).catch(()=>{});
    await saveStat(s, userId, prz, false);
    s.msgId = null;
    await sleep(3000);
    return nextTurn(bot, s);
  }

  if (action.startsWith('a') && /^a\d$/.test(action)) {
    if (!s || s.state !== 'playing') return;
    return onAnswer(bot, ctx, s, parseInt(action[1]));
  }

  if (action.startsWith('ll_')) {
    if (!s || s.state !== 'playing') return;
    return useLL(bot, ctx, s, action.slice(3));
  }

  if (action === 'cancel') {
    if (!s) return ctx.answerCbQuery('لا توجد لعبة!', { show_alert:true }).catch(()=>{});
    if (s.hostId !== userId && !ctx.isAdmin)
      return ctx.answerCbQuery('فقط المضيف!', { show_alert:true }).catch(()=>{});
    if (s.timer) clearTimeout(s.timer);
    sessions.delete(chatId);
    return bot.telegram.sendMessage(chatId, '🔴 تم الغاء اللعبة.').catch(()=>{});
  }

  if (action === 'top') return cmdTop(ctx);
  if (action === 'help') return cmdHelp(ctx);
}

// تنظيف الجلسات المتوقفة كل 30 دقيقة
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions)
    if (now - s.startTime > 3600000) { if (s.timer) clearTimeout(s.timer); sessions.delete(id); }
}, 1800000).unref();

module.exports = { cmdMillion, cmdHelp, cmdTop, handleCallback };
