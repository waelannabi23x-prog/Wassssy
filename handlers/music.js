'use strict';
/**
 * ════════════════════════════════════════════
 *  🎵 handlers/music.js — Deezer Music Search
 *  يعمل في القروب والخاص
 * ════════════════════════════════════════════
 */

// ─── Config (غيّر هنا فقط إذا أردت API آخر) ───────────────────
const API = {
  search:  q  => `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=8`,
  track:   id => `https://api.deezer.com/track/${id}`,
};

// ─── Helpers ───────────────────────────────────────────────────
const fmtDur = s => s ? `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}` : '';

async function apiGet(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'TalineBot/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Search ────────────────────────────────────────────────────
async function searchMusic(query) {
  const data = await apiGet(API.search(query));
  return (data.data || []).slice(0, 8);
}

// ─── Build results message ─────────────────────────────────────
function buildResultsMsg(tracks, query) {
  let text = `🎵 *نتائج البحث عن:* _${query}_\n━━━━━━━━━━━━━━━━━━\n\n`;
  tracks.forEach((t, i) => {
    const dur = fmtDur(t.duration);
    text += `${i+1}. 🎵 *${t.title}*\n`;
    text += `   👤 ${t.artist?.name || '?'}`;
    if (dur) text += `  ⏱ ${dur}`;
    text += '\n';
  });
  text += '\n_اضغط على رقم الأغنية لتنزيلها_';
  return text;
}

function buildResultsKb(tracks) {
  return tracks.map((t, i) => [{
    text: `${i+1}. ${t.title.substring(0,30)} — ${(t.artist?.name||'').substring(0,20)}`,
    callback_data: `music_track_${t.id}`,
  }]);
}

// ─── Main search handler (يُستدعى من index.js) ─────────────────
exports.handleSearch = async (ctx) => {
  const query = (ctx.message?.text || '').replace(/^🎵\s*/,'').trim();
  if (!query || query.length < 2) {
    return ctx.reply('🎵 *البحث عن أغنية*\n\nاكتب: `🎵 اسم الأغنية`\nمثال: `🎵 دق 3 دقات`',
      { parse_mode:'Markdown', reply_to_message_id: ctx.message?.message_id }).catch(()=>{});
  }

  const loading = await ctx.reply(`🔍 جارٍ البحث عن: _${query}_...`,
    { parse_mode:'Markdown', reply_to_message_id: ctx.message?.message_id }).catch(()=>null);

  try {
    const tracks = await searchMusic(query);

    if (loading) ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(()=>{});

    if (!tracks.length) {
      return ctx.reply(`❌ لا توجد نتائج لـ *${query}*`,
        { parse_mode:'Markdown', reply_to_message_id: ctx.message?.message_id }).catch(()=>{});
    }

    const text = buildResultsMsg(tracks, query);
    const kb   = buildResultsKb(tracks);
    kb.push([{ text: '❌ إغلاق', callback_data: 'music_close' }]);

    return ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.message?.message_id,
      reply_markup: { inline_keyboard: kb },
    }).catch(()=>{});

  } catch(e) {
    if (loading) ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(()=>{});
    return ctx.reply('❌ فشل البحث، حاول مجدداً.',
      { reply_to_message_id: ctx.message?.message_id }).catch(()=>{});
  }
};

// ─── Callback: اختيار أغنية ────────────────────────────────────
exports.handleCallback = async (ctx) => {
  const data = ctx.callbackQuery?.data || '';

  // إغلاق
  if (data === 'music_close') {
    await ctx.answerCbQuery('').catch(()=>{});
    return ctx.deleteMessage().catch(()=>{});
  }

  // اختيار أغنية
  if (data.startsWith('music_track_')) {
    const trackId = data.replace('music_track_','');
    await ctx.answerCbQuery('⏳ جارٍ التحميل...').catch(()=>{});

    // رسالة "جارٍ الإرسال" مؤقتة
    const loading = await ctx.reply('🎵 جارٍ إرسال الأغنية...').catch(()=>null);

    try {
      const track = await apiGet(API.track(trackId));
      if (loading) ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(()=>{});

      const dur     = fmtDur(track.duration);
      const preview = track.preview; // 30-ثانية MP3 مجاني من Deezer

      const caption =
        `🎵 *${track.title}*\n` +
        `👤 الفنان: *${track.artist?.name || '?'}*\n` +
        `💿 الألبوم: *${track.album?.title || '?'}*\n` +
        (dur ? `⏱ المدة: *${dur}*\n` : '') +
        `\n📻 معاينة 30 ثانية من Deezer`;

      if (preview) {
        // إرسال ملف صوت مع صورة الغلاف
        await ctx.replyWithAudio(preview, {
          caption,
          parse_mode: 'Markdown',
          title: track.title,
          performer: track.artist?.name || '',
          thumb: track.album?.cover_medium || undefined,
          reply_markup: { inline_keyboard: [[
            { text: '🎵 فتح على Deezer', url: track.link || `https://www.deezer.com/track/${trackId}` },
          ]]},
        }).catch(async () => {
          // fallback: صورة + معلومات فقط
          await sendTrackInfo(ctx, track, caption);
        });
      } else {
        await sendTrackInfo(ctx, track, caption);
      }

    } catch(e) {
      if (loading) ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(()=>{});
      ctx.reply('❌ تعذّر جلب الأغنية.').catch(()=>{});
    }
  }
};

// ─── Helper: إرسال معلومات فقط (بدون preview) ─────────────────
async function sendTrackInfo(ctx, track, caption) {
  const cover = track.album?.cover_big || track.album?.cover_medium;
  if (cover) {
    await ctx.replyWithPhoto(cover, {
      caption,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[
        { text: '🎵 فتح على Deezer', url: track.link || `https://www.deezer.com/track/${track.id}` },
      ]]},
    }).catch(() => {
      ctx.reply(caption, { parse_mode:'Markdown' }).catch(()=>{});
    });
  } else {
    ctx.reply(caption, { parse_mode:'Markdown' }).catch(()=>{});
  }
}
