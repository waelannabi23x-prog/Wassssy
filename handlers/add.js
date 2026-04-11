require('dotenv').config();
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const { all, run } = require('../database/db');
const filesDb = require('../database/files');
const { build, btn } = require('../utils/keyboard');
const escMd = t => (t||'').replace(/[*_`\[\]()~>#+=|{}.!\-]/g,'\\$&');

const GROQ_MODEL = 'llama-3.1-8b-instant';

async function classifyFile(filename, subjects, categories) {
  const subList = subjects.map(s => s.name).join(', ');
  const catList = [...new Set(categories.map(c => c.name))].join(', ');
  const prompt = `You are a university file classifier. Given a filename, suggest the most likely subject and category.
Filename: "${filename}"
Available subjects: ${subList}
Available categories: ${catList}
Respond ONLY with valid JSON like: {"subject":"Algo 1","category":"Cours","confidence":0.9}
No explanation, no markdown, just JSON.`;
  try {
    const res = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 60,
      temperature: 0.1
    });
    const text = res.choices[0].message.content.trim();
    return JSON.parse(text);
  } catch(e) {
    return null;
  }
}

async function handleAdd(ctx) {
  if(!ctx.isOwner) return ctx.deleteMessage().catch(()=>{});
  const isGroup = ctx.chat?.type !== 'private';
  if(!isGroup) return ctx.reply('هذا الأمر للقروبات فقط');
  ctx.deleteMessage().catch(()=>{});
  await global.setState(ctx.uid, { type: 'add_mode', chatId: ctx.chat.id });
  const m = await ctx.reply('📥 *وضع الإضافة*\n\nفوّرد الملفات وسأصنفها تلقائياً\nاكتب /done للإنهاء', { parse_mode: 'Markdown' });
  setTimeout(() => ctx.telegram.deleteMessage(ctx.chat.id, m.message_id).catch(()=>{}), 10000);
}

async function handleAddFile(ctx) {
  const state = global.userStates?.[ctx.uid];
  if(!state || state.type !== 'add_mode') return false;
  const msg = ctx.message;
  let fid, ftype, filename = '';
  if(msg.document)    { fid = msg.document.file_id; ftype = 'document'; filename = msg.document.file_name || ''; }
  else if(msg.photo)  { fid = msg.photo[msg.photo.length-1].file_id; ftype = 'photo'; filename = 'photo'; }
  else if(msg.video)  { fid = msg.video.file_id; ftype = 'document'; filename = msg.video.file_name || 'video'; }
  else return false;

  const title = filename.replace(/\.[^/.]+$/, '') || 'ملف';

  // جلب المواد والفئات
  const subjects = await all('SELECT id, name FROM subjects WHERE is_deleted=0');
  const categories = await all('SELECT id, name FROM categories');

  // AI تصنيف
  const thinking = await ctx.reply('🤖 جاري التصنيف...').catch(()=>null);
  const ai = await classifyFile(filename, subjects, categories);
  if(thinking) ctx.telegram.deleteMessage(ctx.chat.id, thinking.message_id).catch(()=>{});

  // ابحث عن المادة المقترحة
  const suggestedSub = ai ? subjects.find(s => s.name.toLowerCase() === ai.subject?.toLowerCase()) : null;
  const suggestedCat = ai ? categories.find(c => c.name.toLowerCase() === ai.category?.toLowerCase()) : null;

  // حفظ في state
  await global.setState(ctx.uid, {
    ...state,
    type: 'add_confirm',
    fid, ftype, title,
    suggestedSubId: suggestedSub?.id,
    suggestedCatId: suggestedCat?.id,
    aiSub: ai?.subject || '؟',
    aiCat: ai?.category || '؟',
    confidence: ai?.confidence || 0
  });

  // أزرار المواد
  const subRows = subjects.map(s => [btn(
    (s.id == suggestedSub?.id ? '✅ ' : '') + s.name,
    'add_sub_' + s.id
  )]);
  subRows.push([btn('❌ إلغاء', 'add_cancel')]);

  const conf = ai ? Math.round((ai.confidence||0)*100)+'%' : 'غير متاح';
  await ctx.reply(
    `📄 *${escMd(title)}*\n\n🤖 AI يقترح:\n📚 المادة: *${escMd(ai?.subject||'؟')}* (${conf})\n📁 الفئة: *${escMd(ai?.category||'؟')}*\n\nاختر المادة:`,
    { parse_mode: 'Markdown', ...build(subRows) }
  );
  return true;
}

async function handleAddCallback(ctx, data) {
  const state = global.userStates?.[ctx.uid];

  if(data === 'add_cancel') {
    await global.delState(ctx.uid);
    return ctx.editMessageText('❌ تم الإلغاء').catch(()=>{});
  }

  if(data.startsWith('add_sub_')) {
    const subId = data.replace('add_sub_', '');
    const sub = await all('SELECT id, name FROM subjects WHERE id=?', [subId]);
    // جلب الفئات لهذه المادة
    const cats = await all(
      'SELECT c.id, c.name FROM categories c JOIN subjects s ON c.subject_id=s.id WHERE s.id=?',
      [subId]
    );
    await global.setState(ctx.uid, { ...state, type: 'add_confirm', chosenSubId: subId, chosenSubName: sub[0]?.name });
    const catRows = cats.map(c => [btn(
      (c.id == state.suggestedCatId ? '✅ ' : '') + c.name,
      'add_cat_' + c.id
    )]);
    catRows.push([btn('❌ إلغاء', 'add_cancel')]);
    return ctx.editMessageText(
      `📚 المادة: *${escMd(sub[0]?.name)}*\n\nاختر الفئة:`,
      { parse_mode: 'Markdown', ...build(catRows) }
    ).catch(()=>{});
  }

  if(data.startsWith('add_cat_')) {
    const catId = data.replace('add_cat_', '');
    const cat = await all('SELECT id, name FROM categories WHERE id=?', [catId]);
    try {
      await filesDb.addFile(catId, state.title, '', state.fid, state.ftype, ctx.uid);
      await global.delState(ctx.uid);
      await ctx.editMessageText(
        `✅ *${escMd(state.title)}*\n📚 ${escMd(state.chosenSubName)} → 📁 ${escMd(cat[0]?.name)}\n\nتم الحفظ!`,
        { parse_mode: 'Markdown' }
      ).catch(()=>{});
      // رجع لوضع add_mode
      await global.setState(ctx.uid, { type: 'add_mode', chatId: state.chatId });
    } catch(e) {
      await ctx.editMessageText('❌ ' + (e.message === 'exists' ? 'الملف موجود مسبقاً' : e.message)).catch(()=>{});
    }
    return;
  }
}

module.exports = { handleAdd, handleAddFile, handleAddCallback };
