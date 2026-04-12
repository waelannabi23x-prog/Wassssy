const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const { all, run } = require('../database/db');
const usersDb = require('../database/users');
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// تحليل أمر الـ owner
async function parseOwnerCommand(text, hasMedia, mediaType) {
  const specs = await all('SELECT id, name FROM specialties WHERE is_deleted=0');
  const specList = specs.map(s => s.name).join(', ');

  const prompt = `You are a command parser for a Telegram bot admin.
Parse this owner command and return ONLY JSON.
Available specialties: ${specList}

Command: "${text}"
Has media: ${hasMedia} (type: ${mediaType || 'none'})

Return JSON:
{
  "action": "broadcast" | "notify_specialty" | "notify_groups" | "schedule" | "unknown",
  "target_specialty": "specialty name or null",
  "message": "extracted message text or null",
  "schedule_time": "HH:MM or null",
  "send_now": true/false
}

Examples:
- "ارسل للجميع امتحان غداً" → {"action":"broadcast","target_specialty":null,"message":"امتحان غداً","schedule_time":null,"send_now":true}
- "ابعث لتخصص Computer science تذكير بالمراجعة" → {"action":"notify_specialty","target_specialty":"Computer science","message":"تذكير بالمراجعة","schedule_time":null,"send_now":true}
- "جدول رسالة الساعة 8 مساء تذكير" → {"action":"broadcast","target_specialty":null,"message":"تذكير","schedule_time":"20:00","send_now":false}
- "ابعث لقروبات رسالة ترحيب" → {"action":"notify_groups","target_specialty":null,"message":"رسالة ترحيب","schedule_time":null,"send_now":true}
Only JSON, no explanation.`;

  try {
    const res = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.1
    });
    const raw = res.choices[0].message.content.trim().replace(/```json|```/g,'');
    return JSON.parse(raw);
  } catch(e) {
    return { action: 'unknown' };
  }
}

async function executeOwnerCommand(ctx, cmd, mediaFileId, mediaType) {
  const bot = ctx.telegram;

  if(cmd.action === 'unknown') {
    return ctx.reply('ما فهمت الأمر. جرب:\n- "ارسل للجميع [رسالة]"\n- "ابعث لتخصص [اسم] [رسالة]"\n- "ابعث للقروبات [رسالة]"\n- "جدول الساعة [HH:MM] [رسالة]"');
  }

  // جدولة
  if(!cmd.send_now && cmd.schedule_time) {
    const [h, m] = cmd.schedule_time.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(h, m, 0, 0);
    if(target <= now) target.setDate(target.getDate() + 1);
    const delay = target - now;

    setTimeout(async () => {
      await sendToAll(bot, ctx.chat.id, cmd, mediaFileId, mediaType);
    }, delay);

    return ctx.reply(`✅ تم الجدولة للساعة ${cmd.schedule_time}\nالرسالة: "${cmd.message}"`);
  }

  // إرسال فوري
  await ctx.reply('📤 جاري الإرسال...');
  await sendToAll(bot, ctx.chat.id, cmd, mediaFileId, mediaType);
}

async function sendToAll(bot, ownerChatId, cmd, mediaFileId, mediaType) {
  let ids = [];
  let label = '';

  if(cmd.action === 'broadcast') {
    ids = await usersDb.allIds();
    label = 'جميع المستخدمين';
  } else if(cmd.action === 'notify_specialty' && cmd.target_specialty) {
    const specs = await all('SELECT id FROM specialties WHERE name ILIKE $1', ['%'+cmd.target_specialty+'%']);
    if(!specs.length) { bot.sendMessage(ownerChatId, '❌ التخصص غير موجود'); return; }
    const spId = specs[0].id;
    ids = await usersDb.getUsersBySpecialty(spId);
    label = 'تخصص ' + cmd.target_specialty;
  } else if(cmd.action === 'notify_groups') {
    const groups = await all('SELECT chat_id FROM group_chats' + 
      (cmd.target_specialty ? ' WHERE specialty_id=(SELECT id FROM specialties WHERE name ILIKE $1)' : ''),
      cmd.target_specialty ? ['%'+cmd.target_specialty+'%'] : []
    );
    ids = groups.map(g => g.chat_id);
    label = 'القروبات';
  }

  if(!ids.length) { bot.sendMessage(ownerChatId, '❌ لا يوجد مستخدمون'); return; }

  let sent = 0, failed = 0;
  for(const id of ids) {
    try {
      if(mediaFileId) {
        if(mediaType === 'photo') await bot.sendPhoto(id, mediaFileId, { caption: cmd.message || '' });
        else if(mediaType === 'document') await bot.sendDocument(id, mediaFileId, { caption: cmd.message || '' });
        else if(mediaType === 'video') await bot.sendVideo(id, mediaFileId, { caption: cmd.message || '' });
      } else {
        await bot.sendMessage(id, cmd.message || '');
      }
      sent++;
    } catch(e) { failed++; }
    await new Promise(r => setTimeout(r, 50));
  }
  bot.sendMessage(ownerChatId, `✅ اكتمل الإرسال لـ ${label}\n✅ ${sent} | ❌ ${failed}`);
}

async function handleOwnerAI(ctx, text, mediaFileId, mediaType) {
  if(!ctx.isOwner) return false;
  
  const ownerTriggers = /ارسل|ابعث|بعث|اشعر|جدول|send|broadcast|notify/i;
  if(!ownerTriggers.test(text)) return false;

  ctx.telegram.sendChatAction(ctx.chat.id, 'typing').catch(()=>{});
  const cmd = await parseOwnerCommand(text, !!mediaFileId, mediaType);
  await executeOwnerCommand(ctx, cmd, mediaFileId, mediaType);
  return true;
}

module.exports = { handleOwnerAI };
