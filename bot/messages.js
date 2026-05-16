'use strict';
const https = require('https');

module.exports.registerMessages = function(bot, deps) {
  const {
    ownerH, GrpBuf, GrpMsgs, handleAiChat, handleOwnerAI,
    manage, browse, userH, bundlesDb, filesDb, adminsDb,
    logger, OWNER_ID, safeInt,
  } = deps;

  const { run: dbRun, all: dbAll } = require('../database/db');
  const { cacheSet, cacheClear, cacheClearPrefix } = require('../utils/cache');
  const { btn: kbBtn, build: kbBuild } = require('../utils/keyboard');
  const { eos } = require('../utils/helpers');
  const commentsDb = require('../database/comments');
  const tools = require('../handlers/owner_tools');

  // ── Media Group Collector ──
  const MGColl = {
    _g: new Map(),
    add(id, msg) { if (!this._g.has(id)) this._g.set(id, []); this._g.get(id).push(msg); },
    drain(id)    { const m = this._g.get(id) || []; this._g.delete(id); return m; },
  };
  setInterval(() => { for (const k of MGColl._g.keys()) MGColl._g.delete(k); }, 30000).unref();

  // ── Message (group) ──
  bot.on('message', async (ctx, next) => {
    if (ctx.chat?.type === 'private' && ctx.from?.id === OWNER_ID && ctx.message?.text?.startsWith('!'))
      return ownerH.handle(ctx, ctx.message.text);

    if (ctx.chat?.type !== 'private') {
      if (ctx.from && !ctx.from.is_bot)
        GrpBuf.add(ctx.chat.id, ctx.from.id, ctx.from.username, ctx.from.first_name);

      const s = global.getState(ctx.uid);
      if (s?.type === 'mg_bundle_files' && ctx.message.media_group_id) {
        const mgId = ctx.message.media_group_id;
        MGColl.add(mgId, ctx.message);
        setTimeout(async () => {
          const msgs = MGColl.drain(mgId); if (!msgs.length) return;
          let c = 0;
          for (const m of msgs) {
            let fid, ft, tl = '';
            if (m.document)    { fid = m.document.file_id; ft = 'document'; tl = m.document.file_name || ''; }
            else if (m.photo)  { fid = m.photo[m.photo.length - 1].file_id; ft = 'photo'; }
            else if (m.video)  { fid = m.video.file_id; ft = 'document'; }
            else continue;
            await bundlesDb.addBundleFile(s.bundleId, fid, ft, tl).catch(() => {}); c++;
          }
          s.fileCount = (s.fileCount || 0) + c;
          ctx.reply('📎 ' + c + ' ملف. المجموع: ' + s.fileCount + '\nأبعث المزيد أو /done').catch(() => {});
        }, 1500);
        return;
      }
      return next();
    }
    return next();
  });

  // ── Documents ──
  bot.on('document', async ctx => {
    if (!ctx.isAdmin && !ctx.isOwner) return;
    const s = global.getState(ctx.uid);

    if (ctx.isOwner) {
      const isFwd = !!(ctx.message.forward_from || ctx.message.forward_from_chat || ctx.message.forward_sender_name);
      const hasCap = !!(ctx.message.caption && /تخصص:|سنة:|spec:|year:|sem:|mat:|cat:/i.test(ctx.message.caption));
      if (isFwd && !hasCap && !s) {
        await global.setState(ctx.uid, { type: 'pending_forward', doc: ctx.message.document, photo: null });
        await ctx.reply('📎 ملف محفوظ! أرسل المسار:\n`تخصص: X | سنة: X | فصل: X | مادة: X | قسم: X`', { parse_mode: 'Markdown' }).catch(() => {});
        return;
      }
    }

    if (await tools.trySmartUpload(ctx)) return;
    if (s?.type === 'mg_bundle_files') return manage.handleBundleFileUpload(ctx);
    if (s?.type === 'mg_bulk_files')   return manage.handleBulkUpload(ctx);
    if (s?.type === 'mg_tpl_file') {
      await global.setState(ctx.uid, { ...s, type: 'mg_tpl_content', fileId: ctx.message.document.file_id });
      return ctx.reply('✏️ اكتب نص الرسالة (أو skip):').catch(() => {});
    }

    // Restore backup
    if (s?.type === 'mg_awaiting_restore' && ctx.isOwner) {
      await global.delState(ctx.uid);
      const msg = await ctx.reply('⏳ جاري الاستعادة...').catch(() => {});
      try {
        const link = await ctx.telegram.getFileLink(ctx.message.document.file_id);
        const raw  = await new Promise((resolve, reject) => {
          let data = '';
          https.get(link.href, res => { res.on('data', c => data += c); res.on('end', () => resolve(data)); }).on('error', reject);
        });
        const backup = JSON.parse(raw);
        if (!backup.tables) throw new Error('ملف غير صالح');
        const SAFE = new Set(['users','admins','specialties','years','semesters','subjects','categories','files','favorites','history','ratings','user_specialties','settings','bundles','bundle_files','message_templates','scheduled_messages','comments','reports','group_chats','group_members']);
        let restored = 0, errors = 0;
        for (const [table, rows] of Object.entries(backup.tables)) {
          if (!rows.length || !SAFE.has(table)) { errors++; continue; }
          const cols = Object.keys(rows[0]).filter(c => /^[a-zA-Z_][a-zA-Z0-9_]{0,59}$/.test(c));
          if (!cols.length) { errors++; continue; }
          const ph   = rows.map((_, ri) => '(' + cols.map((_, ci) => '$' + (ri * cols.length + ci + 1)).join(',') + ')').join(',');
          const vals = rows.flatMap(r => cols.map(c => r[c]));
          try { await dbRun('INSERT INTO ' + table + '(' + cols.join(',') + ') VALUES ' + ph + ' ON CONFLICT DO NOTHING', vals); restored += rows.length; }
          catch(e) { errors++; logger.error('[Restore]', table, e.message); }
        }
        if (msg) ctx.deleteMessage(msg.message_id).catch(() => {});
        ctx.reply('✅ تمت الاستعادة\n\n' + restored + ' سجل | ' + errors + ' خطأ').catch(() => {});
      } catch(e) {
        if (msg) ctx.deleteMessage(msg.message_id).catch(() => {});
        ctx.reply('❌ فشلت الاستعادة: ' + e.message).catch(() => {});
      }
      return;
    }

    if (s?.type === 'mg_file') return manage.handleFileUpload(ctx);
  });

  // ── Photos / Videos / Audio / Voice ──
  bot.on(['photo', 'video', 'audio', 'voice'], async ctx => {
    if (!ctx.isAdmin && !ctx.isOwner) return;
    const s = global.getState(ctx.uid);
    if (s?.type === 'mg_bulk_files')   return manage.handleBulkUpload(ctx);
    if (s?.type === 'mg_bundle_files') return manage.handleBundleFileUpload(ctx);
    if (s?.type === 'mg_file')         return manage.handleFileUpload(ctx);
    if (s?.type === 'mg_tpl_content')  return manage.handleText(ctx, s);
  });

  // ── Text ──
  bot.on('text', async ctx => {
    try {
      if (ctx.message.text.startsWith('/')) return;
      const uid = ctx.uid, s = global.getState(uid);
      if (!s) return;
      const txt = ctx.message.text.trim();

      if (s.type === 'ai_mode' && ctx.chat?.type === 'private') {
        if (txt.length > 1000) return ctx.reply('⚠️ الحد 1000 حرف.').catch(() => {});
        if (ctx.isOwner && await handleOwnerAI(ctx, txt, null, null)) return;
        if (await handleAiChat(ctx, txt)) return;
      }
      if (s.type === 'mg_file')       return manage.handleFileUpload(ctx);
      if (s.type === 'mg_bulk_prefix') return manage.handleText(ctx, s);
      if (s.type === 'mg_bulk_files' && txt !== '/done') return manage.handleText(ctx, s);
      if (s.type === 'mg_tpl_link') {
        await global.setState(ctx.uid, { ...s, type: 'mg_tpl_content', fileId: txt });
        return ctx.reply('✏️ اكتب نص الرسالة (أو skip):').catch(() => {});
      }
      if (s.type === 'pending_forward' && ctx.isOwner) {
        const pTrig = /تخصص:|سنة:|فصل:|مادة:|قسم:|spec:|year:|sem:|mat:|cat:/i;
        if (pTrig.test(txt)) {
          const sv = s; await global.delState(ctx.uid);
          const fCtx = Object.assign({}, ctx, { message: Object.assign({}, ctx.message, { document: sv.doc, photo: sv.photo, caption: txt }) });
          if (await tools.trySmartUpload(fCtx)) return;
        }
      }
      if (s.type === 'bundle_search') {
        const rows = await bundlesDb.searchBundles(txt).catch(() => []);
        await global.delState(ctx.uid);
        if (!rows.length) return ctx.reply('❌ لا نتائج لـ "' + txt + '"').catch(() => {});
        const kb = rows.map(b => [kbBtn('📦 ' + b.name, 'bundle_view_' + b.id)]);
        return eos(ctx, '🔍 نتائج: ' + rows.length, { ...kbBuild(kb) });
      }
      if (s.type === 'mg_bundle_create') {
        if (!ctx.isAdmin) { await global.delState(ctx.uid); return; }
        const name = txt.trim();
        if (!name) return ctx.reply('❌ الاسم فارغ').catch(() => {});
        const b = await bundlesDb.createBundle(name, null, null);
        await global.setState(ctx.uid, { type: 'mg_bundle_files', bundleId: b.id, fileCount: 0 });
        return ctx.reply('✅ تم إنشاء الحزمة: *' + name + '*\n\nأرسل الملفات الآن.\n/done للإنهاء', { parse_mode: 'Markdown' }).catch(() => {});
      }
      if (s.type === 'search')      return userH.handleSearch(ctx, txt);
      if (s.type === 'add_comment') {
        if (!txt || txt === '/cancel') { await global.delState(ctx.uid); return ctx.reply('❌ تم الإلغاء.').catch(() => {}); }
        if (txt.length > 500) return ctx.reply('⚠️ الحد 500 حرف.').catch(() => {});
        await commentsDb.addComment(s.fid, ctx.uid, txt);
        await global.delState(ctx.uid);
        cacheClear('cmts_' + s.fid + '_0'); cacheClear('cmts_' + s.fid + '_1');
        await ctx.reply('✅ تم إضافة تعليقك!').catch(() => {});
        try {
          const _cf = await filesDb.getFile(s.fid);
          if (_cf) ctx.telegram.sendMessage(OWNER_ID, '💬 *تعليق جديد*\n📄 ' + _cf.title + '\n👤 ' + (ctx.from.first_name || '') + '\n\n' + txt.substring(0, 300), { parse_mode: 'Markdown' }).catch(() => {});
        } catch(_) {}
        return browse.showComments(ctx, s.fid, s.spId, s.yrId, s.smId, s.sbId, s.catId);
      }
      if ((s?.type || '').startsWith('mg_') && ctx.isAdmin) return manage.handleText(ctx, s);
    } catch(e) { logger.error('[TextHandler]', e.message, { uid: ctx.from?.id }); }
  });

  // ── Chat member changes ──
  bot.on('my_chat_member', async ctx => {
    const chat = ctx.myChatMember?.chat, member = ctx.myChatMember?.new_chat_member, oldMember = ctx.myChatMember?.old_chat_member;
    if (!chat || chat.type === 'private') return;
    if (!global._cachedBotId) { try { global._cachedBotId = (await ctx.telegram.getMe()).id; } catch(_) { return; } }
    if (member?.user?.id !== global._cachedBotId) {
      if (oldMember?.status === 'left' && member?.status !== 'left') {
        const { handleNewMember } = require('../handlers/group_admin');
        await handleNewMember(bot, chat.id, member.user.id, member.user.first_name);
      }
      return;
    }
    if (['member', 'administrator'].includes(member?.status)) {
      try {
        await dbRun('INSERT INTO group_chats(chat_id,title) VALUES($1,$2) ON CONFLICT(chat_id) DO UPDATE SET title=EXCLUDED.title', [chat.id, chat.title || '']);
        const sp = await dbAll('SELECT id,name FROM specialties WHERE is_deleted=0 ORDER BY id');
        await ctx.telegram.sendMessage(chat.id, 'مرحباً! أنا بوت الدراسة\n\nاختر تخصص هذا القروب:', {
          reply_markup: { inline_keyboard: sp.map(s => [{ text: '🎓 ' + s.name, callback_data: 'grp_sp_' + chat.id + '_' + s.id }]) }
        });
      } catch(e) { if (!e.message?.includes('TOPIC_CLOSED')) logger.error('[GrpJoin]', e.message); }
    } else if (['left', 'kicked'].includes(member?.status)) {
      await Promise.all([
        dbRun('DELETE FROM group_chats WHERE chat_id=$1',  [chat.id]).catch(() => {}),
        dbRun('DELETE FROM group_members WHERE chat_id=$1', [chat.id]).catch(() => {}),
      ]);
    }
  });

  // ── Inline Query ──
  bot.on('inline_query', async ctx => {
    const q = (ctx.inlineQuery?.query || '').trim();
    if (q.length < 2) { ctx.answerInlineQuery([], { cache_time: 5 }); return; }
    try {
      const { smartSearch } = require('../handlers/group');
      const res = await smartSearch(q, 10);
      if (!res?.length) { ctx.answerInlineQuery([], { cache_time: 5 }); return; }
      const results = res.map(f => ({
        type: 'article', id: String(f.id),
        title: f.title, description: f.sub_name || '',
        input_message_content: { message_text: '📄 ' + f.title + (f.sub_name ? '\n📚 ' + f.sub_name : '') }
      }));
      ctx.answerInlineQuery(results, { cache_time: 10 });
    } catch(_) { ctx.answerInlineQuery([], { cache_time: 5 }); }
  });
};
