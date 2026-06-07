const fs = require('fs');
const BASE = process.env.HOME + '/study-bot-backup-20260407_011636';

// ══════════════════════════════════════════
// 1. messages.js — إضافة handlers للألعاب والرد التلقائي
// ══════════════════════════════════════════
const msgPath = BASE + '/bot/messages.js';
let msg = fs.readFileSync(msgPath, 'utf8');

// إضافة games_panel handler في text handler
const oldGp = "      if ((s?.type || '').startsWith('gp_')) return groupPanel.handleText(ctx, txt, s);";
const newGp = `      if ((s?.type || '').startsWith('gp_')) return groupPanel.handleText(ctx, txt, s);
      // ── ألعاب panel ──
      const handled = await require('../handlers/games_panel').handleText(ctx).catch(() => false);
      if (handled) return;`;

msg = msg.replace(oldGp, newGp);

// إضافة رد تلقائي عشوائي في القروب
const oldEnd = "  // ── Photos / Videos / Audio / Voice ──";
const autoReply = `  // ── رد تلقائي عشوائي في القروب ──
  bot.on('text', async (ctx, next) => {
    if (ctx.chat?.type !== 'group' && ctx.chat?.type !== 'supergroup') return next();
    if (ctx.message?.text?.startsWith('/')) return next();
    const uid = ctx.from?.id;
    const txt = (ctx.message?.text || '').trim();
    
    try {
      const { all } = require('../database/db');
      const triggers = await all(
        'SELECT * FROM auto_replies WHERE is_active=1',
        []
      ).catch(() => []);
      
      if (!triggers.length) return next();
      
      // ابحث عن trigger مطابق
      const matched = triggers.filter(t => {
        try {
          return new RegExp(t.trigger, 'i').test(txt);
        } catch(_) {
          return txt.toLowerCase().includes(t.trigger.toLowerCase());
        }
      });
      
      if (!matched.length) return next();
      
      // اختر رد عشوائي
      const pick = matched[Math.floor(Math.random() * matched.length)];
      await ctx.reply(pick.response, { 
        reply_to_message_id: ctx.message?.message_id,
        parse_mode: 'Markdown'
      }).catch(() => {});
      return;
    } catch(_) {}
    return next();
  });

  // ── Photos / Videos / Audio / Voice ──`;

msg = msg.replace(oldEnd, autoReply);
fs.writeFileSync(msgPath, msg);
console.log('✅ messages.js updated');

// ══════════════════════════════════════════
// 2. callbacks.js — إصلاح زر ألعاب
// ══════════════════════════════════════════
const cbPath = BASE + '/bot/callbacks.js';
let cb = fs.readFileSync(cbPath, 'utf8');

const oldGames = `      if (data === 'mb_panel' || data === 'gp_million_panel' || data === 'gp_guess_panel') {`;
const newGames = `      if (data === 'mb_panel' || data.startsWith('gp_million') || data.startsWith('gp_guess')) {`;

if (cb.includes(oldGames)) {
  cb = cb.replace(oldGames, newGames);
  console.log('✅ callbacks.js updated');
} else {
  // نشوف السطر الحالي
  const idx = cb.indexOf("data === 'mb_panel'");
  if (idx !== -1) {
    console.log('⚠️ found mb_panel at different location');
    // نضيف handler مباشر
    cb = cb.replace(
      "    { p: 'mygroups_refresh', ctx => tools.listGroups(ctx) }",
      "    { p: 'mygroups_refresh', fn: ctx => tools.listGroups(ctx) }"
    );
  }
  console.log('⚠️ callbacks pattern not exact');
}

fs.writeFileSync(cbPath, cb);
console.log('🏁 Done');
