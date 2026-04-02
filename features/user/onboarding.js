const { Markup } = require('telegraf');
const Speciality = require('../../models/Speciality');
const { Year } = require('../../models/Hierarchy');
const User = require('../../models/User');

async function startOnboarding(ctx) {
  const user = await User.findOne({ telegramId: ctx.from.id });
  if (!user) return null;
  if (user.speciality && user.year) return null;

  const specs = await Speciality.find({ isActive: true });
  if (!specs.length) return null;

  const buttons = specs.map(s => [
    Markup.button.callback(`${s.emoji} ${s.name}`, `ob_spec:${s._id}`)
  ]);
  buttons.push([Markup.button.callback('⏭️ تخطي', 'ob_skip')]);

  await ctx.reply(
    `👋 <b>مرحباً ${user.firstName}!</b>\n\n🎓 اختر تخصصك:`,
    { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) }
  );
  return true;
}

function registerOnboarding(bot) {
  bot.action(/^ob_spec:(.+)$/, async ctx => {
    ctx.answerCbQuery();
    const specId = ctx.match[1];
    const user   = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return;
    await User.updateOne({ _id: user._id }, { speciality: specId });
    const years = await Year.find({ speciality: specId, isActive: true });
    if (!years.length) {
      try { await ctx.editMessageText('✅ تم حفظ تخصصك!', { parse_mode: 'HTML' }); } catch {}
      const { showMainMenu } = require('../navigation');
      return showMainMenu(ctx);
    }
    const buttons = years.map(y => [
      Markup.button.callback(`📅 ${y.name}`, `ob_year:${y._id}:${specId}`)
    ]);
    buttons.push([Markup.button.callback('⏭️ تخطي', 'ob_skip')]);
    try {
      await ctx.editMessageText('📅 <b>اختر سنتك الدراسية:</b>',
        { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
    } catch {
      await ctx.reply('📅 <b>اختر سنتك:</b>',
        { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
    }
  });

  bot.action(/^ob_year:(.+):(.+)$/, async ctx => {
    ctx.answerCbQuery();
    const yearId = ctx.match[1];
    const specId = ctx.match[2];
    const user   = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return;
    await User.updateOne({ _id: user._id }, { speciality: specId, year: yearId });
    try { await ctx.editMessageText('✅ <b>تم! حُفظ تخصصك وسنتك.</b>', { parse_mode: 'HTML' }); } catch {}
    const { showMainMenu } = require('../navigation');
    return showMainMenu(ctx);
  });

  bot.action('ob_skip', async ctx => {
    ctx.answerCbQuery();
    try { await ctx.editMessageText('👍 يمكنك تحديد تخصصك لاحقاً.'); } catch {}
    const { showMainMenu } = require('../navigation');
    return showMainMenu(ctx);
  });
}

module.exports = { startOnboarding, registerOnboarding };
