'use strict';
const fs = require('fs');
const path = require('path');

let code = fs.readFileSync('index.js', 'utf8');
let changes = 0;

function replace(search, replacement, label) {
  if (!code.includes(search)) {
    console.warn('⚠️  NOT FOUND:', label);
    return;
  }
  code = code.replace(search, replacement);
  changes++;
  console.log('✅ Fixed:', label);
}

// ── FIX 1: Import adminCache ──────────────────────────────────────────
replace(
  "const manage = require('./handlers/manage');",
  "const manage = require('./handlers/manage');\nconst { getAdminCached } = require('./utils/adminCache');",
  'Import adminCache'
);

// ── FIX 2: /poll — cached admin check ────────────────────────────────
replace(
  `bot.command('poll', async ctx => {
  if (!['supergroup','group'].includes(ctx.chat?.type)) return;
  let isGroupAdmin = ctx.isOwner;
  if (!isGroupAdmin) {
    try {
      const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
      isGroupAdmin = ['administrator','creator'].includes(member.status);
    } catch(_) {}
  }
  if (!isGroupAdmin) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});`,
  `bot.command('poll', async ctx => {
  if (!['supergroup','group'].includes(ctx.chat?.type)) return;
  const isGroupAdmin = ctx.isOwner || await getAdminCached(ctx.telegram, ctx.chat.id, ctx.from.id);
  if (!isGroupAdmin) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});`,
  '/poll admin cache'
);

// ── FIX 3: /tag — cached admin check ─────────────────────────────────
replace(
  `bot.command('tag', async ctx => {
  if (!['supergroup','group'].includes(ctx.chat?.type)) return;
  let isGroupAdmin = ctx.isOwner;
  if (!isGroupAdmin) {
    try {
      const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
      isGroupAdmin = ['administrator','creator'].includes(member.status);
    } catch(_) {}
  }
  if (!isGroupAdmin) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});`,
  `bot.command('tag', async ctx => {
  if (!['supergroup','group'].includes(ctx.chat?.type)) return;
  const isGroupAdmin = ctx.isOwner || await getAdminCached(ctx.telegram, ctx.chat.id, ctx.from.id);
  if (!isGroupAdmin) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});`,
  '/tag admin cache'
);

// ── FIX 4: /mute — cached admin check ────────────────────────────────
replace(
  `bot.command('mute', async ctx => {
  if (!['supergroup','group'].includes(ctx.chat?.type)) return;
  let isGroupAdmin = ctx.isOwner;
  if (!isGroupAdmin) {
    try {
      const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
      isGroupAdmin = ['administrator','creator'].includes(member.status);
    } catch(_) {}
  }
  if (!isGroupAdmin) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});`,
  `bot.command('mute', async ctx => {
  if (!['supergroup','group'].includes(ctx.chat?.type)) return;
  const isGroupAdmin = ctx.isOwner || await getAdminCached(ctx.telegram, ctx.chat.id, ctx.from.id);
  if (!isGroupAdmin) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});`,
  '/mute admin cache'
);

// ── FIX 5: /unmute — cached admin check ──────────────────────────────
replace(
  `bot.command('unmute', async ctx => {
  if (!['supergroup','group'].includes(ctx.chat?.type)) return;
  let isGroupAdmin = ctx.isOwner;
  if (!isGroupAdmin) {
    try {
      const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
      isGroupAdmin = ['administrator','creator'].includes(member.status);
    } catch(_) {}
  }
  if (!isGroupAdmin) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});`,
  `bot.command('unmute', async ctx => {
  if (!['supergroup','group'].includes(ctx.chat?.type)) return;
  const isGroupAdmin = ctx.isOwner || await getAdminCached(ctx.telegram, ctx.chat.id, ctx.from.id);
  if (!isGroupAdmin) return ctx.reply('🚫 للمشرفين فقط').catch(() => {});`,
  '/unmute admin cache'
);

// ── FIX 6: /ai group — cached admin check ────────────────────────────
replace(
  `  if (['supergroup','group'].includes(ctx.chat?.type)) {
    let isAdmin = ctx.isOwner;
    if (!isAdmin) {
      try {
        const m = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
        isAdmin = ['administrator','creator'].includes(m?.status);
      } catch(_) {}
    }
    if (!isAdmin) return ctx.reply('🚫 للمشرفين فقط').catch(()=>{});`,
  `  if (['supergroup','group'].includes(ctx.chat?.type)) {
    const isAdmin = ctx.isOwner || await getAdminCached(ctx.telegram, ctx.chat.id, ctx.from.id);
    if (!isAdmin) return ctx.reply('🚫 للمشرفين فقط').catch(()=>{});`,
  '/ai admin cache'
);

// ── FIX 7: Remove duplicate poll code inside ai_mode ─────────────────
replace(
  `    const pollState2 = null; // already handled above
    if (pollState?.type === 'poll_create') {
      const step = pollState.step;
      const chatId = pollState.chatId;

      if (step === 'question') {
        const question = ctx.message.caption || ctx.message.text || '';
        const mediaFileId = ctx.message.photo ? ctx.message.photo[ctx.message.photo.length-1].file_id :
                           ctx.message.video ? ctx.message.video.file_id : null;
        const mediaType = ctx.message.photo ? 'photo' : ctx.message.video ? 'video' : null;
        await global.setState(ctx.uid, { type: 'poll_create', step: 'options', chatId, question, mediaFileId, mediaType, options: [] });
        return ctx.reply('✅ *السؤال:* ' + question + '\\n\\n📝 الآن أرسل *خيارات التصويت* واحداً تلو الآخر.\\nمثال: 🔴 صعبة\\n\\nاكتب /done عند الانتهاء (2-8 خيارات)', { parse_mode: 'Markdown' }).catch(() => {});
      }

      if (step === 'options') {
        const optText = (ctx.message.text || '').trim();
        const emoji = optText.match(/^(\\p{Emoji})/u)?.[1] || '🔵';
        const text = optText.replace(/^(\\p{Emoji}\\s*)/u, '').trim() || optText;
        const opts = pollState.options || [];
        opts.push({ emoji, text });
        await global.setState(ctx.uid, { ...pollState, options: opts });
        return ctx.reply(\`✅ الخيار \${opts.length}: \${emoji} \${text}\n\n\${opts.length >= 2 ? 'اكتب /done للإنشاء أو أضف المزيد' : 'أضف خياراً آخر على الأقل'}\`, { parse_mode: 'Markdown' }).catch(() => {});
      }
      return;
    }

    if (await handleAiChat(ctx, txt)) return;`,
  `    if (await handleAiChat(ctx, txt)) return;`,
  'Remove duplicate poll code in ai_mode'
);

// ── FIX 8: Broadcast speed — parallel batches instead of serial 600ms ─
replace(
  `      let gSent = 0, gFail = 0;
      const msgText = text;
      for (const g of groups) {
        try {
          if (mediaType === 'photo') await ctx.telegram.sendPhoto(g.chat_id, mediaFileId, { caption: msgText, parse_mode: 'Markdown' });
          else if (mediaType === 'video') await ctx.telegram.sendVideo(g.chat_id, mediaFileId, { caption: msgText, parse_mode: 'Markdown' });
          else if (mediaType === 'document') await ctx.telegram.sendDocument(g.chat_id, mediaFileId, { caption: msgText, parse_mode: 'Markdown' });
          gSent++;
        } catch(_) { gFail++; }
        await new Promise(r => setTimeout(r, 600));
      }`,
  `      let gSent = 0, gFail = 0;
      const msgText = text;
      // ✅ Parallel batches of 20 with 1s delay — 20x faster than serial 600ms
      const BATCH = 20;
      for (let bi = 0; bi < groups.length; bi += BATCH) {
        const chunk = groups.slice(bi, bi + BATCH);
        const results = await Promise.allSettled(chunk.map(g => {
          if (mediaType === 'photo') return ctx.telegram.sendPhoto(g.chat_id, mediaFileId, { caption: msgText, parse_mode: 'Markdown' });
          if (mediaType === 'video') return ctx.telegram.sendVideo(g.chat_id, mediaFileId, { caption: msgText, parse_mode: 'Markdown' });
          return ctx.telegram.sendDocument(g.chat_id, mediaFileId, { caption: msgText, parse_mode: 'Markdown' });
        }));
        results.forEach(r => r.status === 'fulfilled' ? gSent++ : gFail++);
        if (bi + BATCH < groups.length) await new Promise(r => setTimeout(r, 1000));
      }`,
  'Broadcast parallel batches'
);

// ── FIX 9: Memory threshold 480 → 490 ────────────────────────────────
replace(
  'if (h > 480) { logger.error(\'[Mem CRITICAL] restarting\'); process.emit(\'SIGTERM\'); }',
  'if (h > 490) { logger.error(\'[Mem CRITICAL] restarting\'); process.emit(\'SIGTERM\'); }',
  'Memory threshold 490MB'
);

// ── FIX 10: Webhook secret warning ───────────────────────────────────
replace(
  "const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';",
  "const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';\nif (!WEBHOOK_SECRET) logger.warn('⚠️  WEBHOOK_SECRET not set — webhook is unprotected! Set it in Railway env vars.');",
  'Webhook secret warning'
);

// ── WRITE ──────────────────────────────────────────────────────────────
fs.writeFileSync('index.js', code);
console.log('\n🎉 Done! ' + changes + '/10 fixes applied to index.js');
