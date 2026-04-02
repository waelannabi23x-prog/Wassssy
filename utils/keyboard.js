const { Markup } = require('telegraf');
const btn=(text,data)=>Markup.button.callback(text,data);
const back=data=>[btn('◀️ Back',data)];
const backMenu=data=>[btn('◀️ Back',data),btn('🏠 Menu','main_menu')];
const build=rows=>Markup.inlineKeyboard(rows);
module.exports={btn,back,backMenu,build};
