const { Markup } = require('telegraf');
const btn=(text,data)=>Markup.button.callback(text,data);
const back=data=>[btn('◀️ رجوع',data)];
const backMenu=data=>[btn('◀️ رجوع',data),btn('🏠 الرئيسية','main_menu')];
const build=rows=>Markup.inlineKeyboard(rows);
module.exports={btn,back,backMenu,build};
