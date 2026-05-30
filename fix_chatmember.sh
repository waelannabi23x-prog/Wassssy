#!/bin/bash
cd ~/study-bot-backup-20260407_011636

cat > fix_chatmember.cjs << 'JSEOF'
const fs = require('fs');
let c = fs.readFileSync('bot/messages.js', 'utf8');

const newHandler = [
  '',
  "  bot.on('chat_member', async ctx => {",
  '    try {',
  '      const chat   = ctx.chatMember?.chat;',
  '      const member = ctx.chatMember?.new_chat_member;',
  '      const old    = ctx.chatMember?.old_chat_member;',
  '      if (!chat || chat.type === "private") return;',
  '      if (member?.user?.is_bot) return;',
  '      const wasOut = ["left","kicked"].includes(old?.status);',
  '      const isIn   = ["member","restricted","administrator","creator"].includes(member?.status);',
  '      const isOut  = ["left","kicked"].includes(member?.status);',
  '      if (wasOut && isIn) {',
  "        const { handleNewMember } = require('../handlers/group_admin');",
  '        handleNewMember(bot, chat.id, member.user.id, member.user.first_name).catch(() => {});',
  '      }',
  '      if (!wasOut && isOut) {',
  "        const { handleMemberLeft } = require('../handlers/group_admin');",
  '        handleMemberLeft(bot, chat.id, member.user.id, member.user.first_name).catch(() => {});',
  '      }',
  '    } catch(e) {}',
  '  });',
  ''
].join('\n');

c = c.replace("  bot.on('sticker'", newHandler + "  bot.on('sticker'");
fs.writeFileSync('bot/messages.js', c);
console.log('done');
JSEOF

node fix_chatmember.cjs
node --check bot/messages.js && echo "OK" || echo "ERROR"
rm fix_chatmember.cjs
