// ضع هذا الكود بدلاً من دالة sendBundle الموجودة في browse.js (السطر 110)

async function sendBundle(ctx, bundleId, spId, yrId, smId, sbId, catId) {
  bundleId = safeInt(bundleId);
  const bkey = 'bundle_full_' + bundleId;
  const bcached = cacheGet(bkey);
  let b, files;

  if (bcached) {
    b = bcached.b; files = bcached.files;
  } else {
    const r = await Promise.all([bundlesDb.getBundle(bundleId), bundlesDb.getBundleFiles(bundleId)]);
    b = r[0]; files = r[1];
    if (b) cacheSet(bkey, { b, files }, 600000);
  }

  if (!files.length) return ctx.reply('الحزمة فارغة');
  bundlesDb.incBundleDownloads(bundleId).catch(() => {});
  await ctx.reply('📦 *' + escMd(b.title) + '* — جاري الإرسال...', { parse_mode: 'Markdown' });

  const photos  = files.filter(f => f.real_type === 'photo');
  const docs    = files.filter(f => f.real_type === 'document');
  const videos  = files.filter(f => f.real_type === 'video');
  const audios  = files.filter(f => f.real_type === 'audio' || f.real_type === 'voice');
  const links   = files.filter(f => f.real_type === 'link');

  // دالة مساعدة: قسّم المصفوفة إلى chunks
  const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

  // الصور: mediaGroup (max 10) بالتوازي
  if (photos.length) {
    await Promise.allSettled(
      chunk(photos, 10).map(gr =>
        ctx.replyWithMediaGroup(gr.map(f => ({ type: 'photo', media: f.file_id, caption: f.file_title || f.title || '' })))
          .catch(() => Promise.allSettled(gr.map(f => ctx.replyWithPhoto(f.file_id, { caption: f.file_title || '' }).catch(() => {}))))
      )
    );
  }

  // الفيديوهات: mediaGroup (max 10) بالتوازي
  if (videos.length) {
    await Promise.allSettled(
      chunk(videos, 10).map(gr =>
        ctx.replyWithMediaGroup(gr.map(f => ({ type: 'video', media: f.file_id, caption: f.file_title || f.title || '' })))
          .catch(() => Promise.allSettled(gr.map(f => ctx.replyWithVideo(f.file_id, { caption: f.file_title || '' }).catch(() => {}))))
      )
    );
  }

  // الوثائق: mediaGroup (max 10) بالتوازي
  if (docs.length) {
    await Promise.allSettled(
      chunk(docs, 10).map(gr =>
        ctx.replyWithMediaGroup(gr.map(f => ({ type: 'document', media: f.file_id, caption: f.file_title || f.title || '' })))
          .catch(() => Promise.allSettled(gr.map(f => ctx.replyWithDocument(f.file_id, { caption: f.file_title || '' }).catch(() => {}))))
      )
    );
  }

  // الصوتيات: بالتوازي
  if (audios.length) {
    await Promise.allSettled(
      audios.map(f =>
        f.real_type === 'voice'
          ? ctx.replyWithVoice(f.file_id).catch(() => {})
          : ctx.replyWithAudio(f.file_id, { caption: f.file_title || '' }).catch(() => {})
      )
    );
  }

  // الروابط
  if (links.length) {
    const linkMsg = '🔗 *الروابط:*\n\n' + links.map((l, i) => `${i + 1}. ${l.file_title || l.title || ''}\n${l.file_id}`).join('\n\n');
    await ctx.reply(linkMsg, { parse_mode: 'Markdown' }).catch(() => {});
  }

  const backCb = catId !== 0 ? 'ct_' + spId + '_' + yrId + '_' + smId + '_' + sbId + '_' + catId : 'main_menu';
  await ctx.reply('✅ اكتمل الإرسال!', { ...build([[btn('◀️ رجوع', backCb), btn('🏠', 'main_menu')]]) });
}
