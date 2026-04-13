const { groqChat } = require('../utils/groq_client');
const { all } = require('../database/db');
const usersDb = require('../database/users');

async function parseOwnerCommand(text, hasMedia, mediaType) {
  const specs = await all('SELECT id, name FROM specialties WHERE is_deleted=0');
  const specList = specs.map(s => `"${s.name}"`).join(', ');
  const prompt = `Parse this bot admin command and return ONLY JSON.
Available specialties: ${specList}
Command: "${text}"
Has media: ${hasMedia} (type: ${mediaType || 'none'})
Return: {"action":"broadcast"|"notify_specialty"|"notify_groups"|"schedule"|"unknown","target_specialty":null,"message":"text","schedule_time":null,"send_now":true,"confidence":0.9}`;
  try {
    const raw = await groqChat([{ role: 'user', content: prompt }], 150, 0.1);
    return JSON.parse(raw.replace(/```json|```/g,'').trim());
  } catch(e) {
    return fallbackParse(text, hasMedia);
  }
}

function fallbackParse(text, hasMedia) {
  const t = text.toLowerCase();
  let action = 'unknown';
  if(t.includes('جميع')||t.includes('كل')||t.includes('للكل')) action = 'broadcast';
  else if(t.includes('قروب')||t.includes('group')) action = 'notify_groups';
  else if(t.includes('تخصص')||t.includes('طلاب')) action = 'notify_specialty';
  else if(hasMedia) action = 'broadcast';
  const message = text.replace(/ارسل|ابعث|بعث|للجميع|للكل|للقروبات|لتخصص/gi,'').replace(/\s+/g,' ').trim();
  return { action, target_specialty: null, message, schedule_time: null, send_now: true, confidence: 0.5 };
}

async function sendMessages(bot, ownerChatId, cmd, mediaFileId, mediaType) {
  let ids = [];
  let label = '';
  if(cmd.action === 'broadcast') {
    ids = await usersDb.allIds();
    label = 'جميع المستخدمين';
  } else if(cmd.action === 'notify_specialty' && cmd.target_specialty) {
    const specs = await all('SELECT id,name FROM specialties WHERE name ILIKE $1', ['%'+cmd.target_specialty+'%']);
    if(!specs.length) { bot.sendMessage(ownerChatId, '❌ التخصص غير موجود'); return; }
    ids = await usersDb.getUsersBySpecialty(specs[0].id);
    label = 'تخصص ' + specs[0].name;
  } else if(cmd.action === 'notify_groups') {
    const groups = await all('SELECT chat_id FROM group_chats');
    ids = groups.map(g => g.chat_id);
    label = 'القروبات';
  }
  if(!ids.length) { bot.sendMessage(ownerChatId, '❌ لا يوجد مستخدمون'); return; }
  let sent = 0, failed = 0;
  for(const id of ids) {
    try {
      if(mediaFileId) {
        const cap = cmd.message || '';
        if(mediaType==='photo') await bot.sendPhoto(id, mediaFileId, {caption:cap});
        else if(mediaType==='video') await bot.sendVideo(id, mediaFileId, {caption:cap});
        else await bot.sendDocument(id, mediaFileId, {caption:cap});
      } else if(cmd.message) {
        await bot.sendMessage(id, cmd.message);
      }
      sent++;
    } catch(e) { failed++; }
    await new Promise(r=>setTimeout(r,50));
  }
  bot.sendMessage(ownerChatId, `✅ اكتمل الإرسال لـ ${label}\n✅ ${sent} | ❌ ${failed}`);
}

async function executeOwnerCommand(ctx, cmd, mediaFileId, mediaType) {
  if(cmd.action === 'unknown' || (cmd.confidence||1) < 0.3) {
    return ctx.reply('❓ ما فهمت — جرب:\n• "ارسل للجميع [رسالة]"\n• "ابعث لتخصص [اسم] [رسالة]"\n• "ابعث للقروبات [رسالة]"\n• "جدول الساعة 20:00 [رسالة]"');
  }
  if(!cmd.send_now && cmd.schedule_time) {
    const [h,m] = cmd.schedule_time.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(h,m,0,0);
    if(target<=now) target.setDate(target.getDate()+1);
    const delay = target-now;
    const mins = Math.round(delay/60000);
    setTimeout(async()=>{ await sendMessages(ctx.telegram, ctx.chat.id, cmd, mediaFileId, mediaType); }, delay);
    return ctx.reply(`✅ تم الجدولة للساعة ${cmd.schedule_time}\nبعد ${mins} دقيقة\nالرسالة: "${cmd.message||'(ملف)'}"`);
  }
  await ctx.reply('📤 جاري الإرسال...');
  await sendMessages(ctx.telegram, ctx.chat.id, cmd, mediaFileId, mediaType);
}

async function handleOwnerAI(ctx, text, mediaFileId, mediaType) {
  if(!ctx.isOwner) return false;
  const triggers = /^(ارسل|ابعث|بعث|جدول الساعة|send to|broadcast|ابعث للجميع|ارسل للجميع|ابعث للقروب|ابعث لتخصص)/i;
  if(!triggers.test(text) && !mediaFileId) return false;
  ctx.telegram.sendChatAction(ctx.chat.id, 'typing').catch(()=>{});
  const cmd = await parseOwnerCommand(text, !!mediaFileId, mediaType);
  await executeOwnerCommand(ctx, cmd, mediaFileId, mediaType);
  return true;
}

module.exports = { handleOwnerAI };
