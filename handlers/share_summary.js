'use strict';
const { all, get } = require('../database/db');
const { aiChat }   = require('../utils/groq_client');
const logger       = require('../utils/logger');

// ── File Share — deep link ─────────────────────────────────────
async function handleShare(ctx) {
  try {
    await ctx.answerCbQuery().catch(err => { require('../utils/logger').debug("[silent]", err.message); });
    const fileId = parseInt(ctx.match?.[1]);
    if (!fileId) return;

    const botInfo = ctx.botInfo || await ctx.telegram.getMe();
    const file    = await get('SELECT title, file_type FROM files WHERE id=$1 AND is_deleted=0', [fileId]);
    if (!file) return ctx.reply('⚠️ الملف غير موجود');

    const link = `https://t.me/${botInfo.username}?start=file_${fileId}`;
    await ctx.reply(
      `🔗 *${file.title}*\n\n${link}\n\n📤 شارك الرابط مع أصدقائك!`,
      { parse_mode: 'Markdown' }
    );
  } catch(e) { logger.error('[Share]', e.message); }
}

// ── PDF Summarizer ─────────────────────────────────────────────
async function handleSummarize(ctx) {
  try {
    const doc = ctx.message?.reply_to_message?.document || ctx.message?.document;
    if (!doc) {
      return ctx.reply('📄 كيفية الاستخدام:\n\nردّ على ملف PDF وأكتب /لخص');
    }
    if (!doc.mime_type?.includes('pdf') && !doc.file_name?.toLowerCase().endsWith('.pdf')) {
      return ctx.reply('⚠️ فقط ملفات PDF مدعومة حالياً');
    }
    if (doc.file_size > 15 * 1024 * 1024) {
      return ctx.reply('⚠️ الملف كبير جداً — الحد الأقصى 15MB');
    }

    const processing = await ctx.reply('⏳ جاري تحليل الملف...');

    // تحميل الملف
    const fileInfo = await ctx.telegram.getFile(doc.file_id);
    const fileUrl  = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileInfo.file_path}`;

    const https = require('https');
    const pdfParse = require('pdf-parse');

    const pdfBuffer = await new Promise((res, rej) => {
      https.get(fileUrl, resp => {
        const chunks = [];
        resp.on('data', c => chunks.push(c));
        resp.on('end', () => res(Buffer.concat(chunks)));
        resp.on('error', rej);
      }).on('error', rej);
    });

    const pdfData = await pdfParse(pdfBuffer);
    const text    = pdfData.text?.substring(0, 4000) || '';

    if (!text.trim()) {
      return ctx.telegram.editMessageText(
        ctx.chat.id, processing.message_id, null,
        '⚠️ لم أتمكن من قراءة النص — قد يكون الملف صورة فقط'
      );
    }

    const messages = [
      { role: 'system', content: 'أنت مساعد أكاديمي. لخّص المحتوى التالي بشكل مرتب: نقاط رئيسية، أهم المفاهيم، خلاصة قصيرة. باللغة العربية.' },
      { role: 'user',   content: `لخّص هذا المحتوى الأكاديمي:\n\n${text}` }
    ];

    const summary = await aiChat(messages, 1000);

    await ctx.telegram.editMessageText(
      ctx.chat.id, processing.message_id, null,
      `📝 *ملخص: ${doc.file_name || 'الملف'}*\n\n${summary}`,
      { parse_mode: 'Markdown' }
    );
  } catch(e) {
    logger.error('[Summarize]', e.message);
    ctx.reply('❌ حدث خطأ أثناء المعالجة').catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  }
}

module.exports = { handleShare, handleSummarize };
