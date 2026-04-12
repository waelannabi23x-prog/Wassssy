const { groqChat } = require('../utils/groq_client');
const { all } = require('../database/db');
const usersDb = require('../database/users');
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant', 
  'gemma2-9b-it',
  'mixtral-8x7b-32768'
];
let _modelIdx = 0;
function getModel() { return GROQ_MODELS[_modelIdx % GROQ_MODELS.length]; }
function nextModel() { _modelIdx++; console.log('Switched to model:', getModel()); }

async function parseOwnerCommand(text, hasMedia, mediaType) {
  const specs = await all('SELECT id, name FROM specialties WHERE is_deleted=0');
  const specList = specs.map(s => `"${s.name}"`).join(', ');

  const prompt = `You are parsing admin commands for a Telegram educational bot.
Available specialties: ${specList}

Admin command: "${text}"
Has attached media: ${hasMedia} (type: ${mediaType || 'none'})

Understand the intent even if the command is vague or incomplete.
Rules:
- If no message text found, use empty string ""
- "ارسل للجميع" or "بعث للكل" or "broadcast" = broadcast to all users
- "ابعث لتخصص X" or "للطلاب X" = notify specialty X
- "للقروبات" or "ابعث للجروبات" or "القروبات" = notify groups
- "جدول" or "في الساعة" or "schedule" = schedule message
- If has media and no clear target → broadcast
- Extract the actual message content (everything after the target/action words)

Return ONLY this JSON:
{
  "action": "broadcast" | "notify_specialty" | "notify_groups" | "schedule" | "unknown",
  "target_specialty": "exact specialty name or null",
  "message": "message content to send (can be empty string)",
  "schedule_time": "HH:MM 24h format or null",
  "send_now": true or false,
  "confidence": 0.0-1.0
}`;

  try {
    let res;
  for(let _try=0; _try<GROQ_MODELS.length; _try++) {
    try {
      res = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.1
    });
    const raw = res.choices[0].message.content.trim().replace(/```json|```/g,'').trim();
    const parsed = JSON.parse(raw);
    return parsed;
  } catch(e) {
    // fallback — تحليل بسيط
    return fallbackParse(text, hasMedia);
  }
}

function fallbackParse(text, hasMedia) {
  const t = text.toLowerCase();
  let action = 'unknown';
  let target_specialty = null;
  
  if(t.includes('جميع') || t.includes('كل') || t.includes('broadcast') || t.includes('للكل')) action = 'broadcast';
  else if(t.includes('قروب') || t.includes('group')) action = 'notify_groups';
  else if(t.includes('تخصص') || t.includes('طلاب')) action = 'notify_specialty';
  else if(hasMedia) action = 'broadcast';

  // استخرج الرسالة — كل شيء بعد كلمة الفعل
  let message = text
    .replace(/ارسل|ابعث|بعث|اشعر|جدول|للجميع|للكل|للقروبات|للقروبات|لتخصص|لطلاب/gi, '')
    .replace(/\s+/g,' ').trim();

  return { action, target_specialty, message, schedule_time: null, send_now: true, confidence: 0.5 };
}

async function executeOwnerCommand(ctx, cmd, mediaFileId, mediaType) {
  const bot = ctx.telegram;

  if(cmd.action === 'unknown' || cmd.confidence < 0.3) {
    return ctx.reply(
      '❓ ما فهمت كامل — وضح أكثر:\n\n' +
      '• "ارسل للجميع [رسالة]"\n' +
      '• "ابعث لتخصص [اسم] [رسالة]"\n' +
      '• "ابعث للقروبات [رسالة]"\n' +
      '• "جدول الساعة 20:00 [رسالة]"'
    );
  }

  // جدولة
  if(!cmd.send_now && cmd.schedule_time) {
    const [h, m] = cmd.schedule_time.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(h, m, 0, 0);
    if(target <= now) target.setDate(target.getDate() + 1);
    const delay = target - now;
    const mins = Math.round(delay/60000);
    setTimeout(async () => {
      await sendMessages(bot, ctx.chat.id, cmd, mediaFileId, mediaType);
    }, delay);
    return ctx.reply(`✅ تم الجدولة للساعة ${cmd.schedule_time}\nبعد ${mins} دقيقة\nالرسالة: "${cmd.message || '(ملف)'}"`);
  }

  await ctx.reply('📤 جاري الإرسال...');
  await sendMessages(bot, ctx.chat.id, cmd, mediaFileId, mediaType);
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

async function handleOwnerAI(ctx, text, mediaFileId, mediaType) {
  if(!ctx.isOwner) return false;
  const triggers = /ارسل|ابعث|بعث|اشعر|جدول|send|broadcast|notify|للجميع|للكل|للقروب|لتخصص/i;
  if(!triggers.test(text) && !mediaFileId) return false;
  ctx.telegram.sendChatAction(ctx.chat.id, 'typing').catch(()=>{});
  const cmd = await parseOwnerCommand(text, !!mediaFileId, mediaType);
  await executeOwnerCommand(ctx, cmd, mediaFileId, mediaType);
  return true;
}

module.exports = { handleOwnerAI };
