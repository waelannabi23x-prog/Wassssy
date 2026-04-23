'use strict';
const { dbRun, dbAll, dbGet } = require('../database/db');

async function handleNewMember(bot, chatId, userId, firstName) {
  try {
    await dbRun(
      'INSERT INTO group_members(chat_id,user_id,username,first_name,updated_at) VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP) ON CONFLICT(chat_id,user_id) DO UPDATE SET first_name=EXCLUDED.first_name,updated_at=CURRENT_TIMESTAMP',
      [chatId, userId, '', firstName || 'عضو']
    ).catch(() => {});

    const grp = await dbGet('SELECT specialty_id FROM group_chats WHERE chat_id=$1', [chatId]).catch(() => null);
    const spec = grp?.specialty_id ? await dbGet('SELECT name FROM specialties WHERE id=$1', [grp.specialty_id]).catch(() => null) : null;

    const welcome = `👋 مرحباً يا ${firstName}!\n${spec ? '🎓 ' + spec.name : ''}\n📚 اضغط /start`;
    await bot.telegram.sendMessage(chatId, welcome).catch(() => {});
  } catch(e) {
    console.error('[Welcome]', e.message);
  }
}

async function showAllMembers(ctx, chatId) {
  try {
    const members = await dbAll('SELECT user_id, first_name FROM group_members WHERE chat_id=$1 LIMIT 200', [chatId]);
    if (!members.length) return ctx.reply('📭 لا أعضاء').catch(() => {});

    let text = `👥 ${members.length} عضو\n━━━\n`;
    members.forEach((m, i) => { text += `${i+1}. ${m.first_name}\n`; });

    const rows = [[{text:'🏷️ Tag All', callback_data:'tag_all_'+chatId}], [{text:'🔇 Mute', callback_data:'mute_all_'+chatId}]];
    return ctx.reply(text, {reply_markup:{inline_keyboard:rows}}).catch(() => {});
  } catch(e) {
    return ctx.reply('❌').catch(() => {});
  }
}

async function tagAll(ctx, chatId) {
  ctx.answerCbQuery('✅ منشن').catch(() => {});
  const members = await dbAll('SELECT user_id FROM group_members WHERE chat_id=$1 LIMIT 100', [chatId]).catch(() => []);
  const mentions = members.map(m => `[_](tg://user?id=${m.user_id})`).join('');
  return ctx.reply('👋' + mentions, {parse_mode:'Markdown'}).catch(() => {});
}

async function muteAll(ctx, chatId) {
  ctx.answerCbQuery('⏳').catch(() => {});
  const members = await dbAll('SELECT user_id FROM group_members WHERE chat_id=$1 LIMIT 100', [chatId]).catch(() => []);
  let ok = 0;
  for (const m of members) {
    try {
      await ctx.telegram.restrictChatMember(chatId, m.user_id, {can_send_messages:false, until_date:Math.floor(Date.now()/1000)+3600});
      ok++;
    } catch(_) {}
  }
  return ctx.reply(`🔇 ${ok}/${members.length}`).catch(() => {});
}

async function unmuteAll(ctx, chatId) {
  ctx.answerCbQuery('✅').catch(() => {});
  const members = await dbAll('SELECT user_id FROM group_members WHERE chat_id=$1 LIMIT 100', [chatId]).catch(() => []);
  let ok = 0;
  for (const m of members) {
    try {
      await ctx.telegram.restrictChatMember(chatId, m.user_id, {can_send_messages:true, can_send_media_messages:true});
      ok++;
    } catch(_) {}
  }
  return ctx.reply(`🔊 ${ok}/${members.length}`).catch(() => {});
}

module.exports = { handleNewMember, showAllMembers, tagAll, muteAll, unmuteAll };
