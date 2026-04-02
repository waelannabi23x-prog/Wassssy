if (!global.userStates) global.userStates = {};
async function promptSearch(bot, chatId) {
  global.userStates[chatId] = { type: 'search' };
  bot.sendMessage(chatId, '🔍 *Smart Search*\n\nType any keyword — title, subject, specialty, or tag:', { parse_mode: 'Markdown' });
}
module.exports = { promptSearch };
