const fs = require('fs');

// 1 — db.js
let db = fs.readFileSync('database/db.js', 'utf8');
db = db.replace(
  '`CREATE TABLE IF NOT EXISTS group_chats (chat_id BIGINT PRIMARY KEY, title TEXT, joined_at TEXT DEFAULT (CURRENT_TIMESTAMP))`',
  '`CREATE TABLE IF NOT EXISTS group_chats (chat_id BIGINT PRIMARY KEY, title TEXT, specialty_id INTEGER DEFAULT 0, notify_new_files INTEGER DEFAULT 1, joined_at TEXT DEFAULT (CURRENT_TIMESTAMP))`'
);
db = db.replace(
  '`CREATE TABLE IF NOT EXISTS cache_store (key TEXT PRIMARY KEY, value TEXT, expires_at BIGINT)`',
  '`CREATE TABLE IF NOT EXISTS cache_store (key TEXT PRIMARY KEY, value TEXT, expires_at BIGINT)`,\n    `CREATE TABLE IF NOT EXISTS group_members (chat_id BIGINT, user_id BIGINT, username TEXT, first_name TEXT, updated_at TEXT DEFAULT (CURRENT_TIMESTAMP), PRIMARY KEY(chat_id, user_id))`'
);
fs.writeFileSync('database/db.js', db);
console.log('1 db.js done');

// 2 — groupNotify.js
fs.writeFileSync('utils/groupNotify.js', `
const { all } = require('../database/db');
const { cacheGet, cacheSet } = require('./cache');
const escMd = t => (t||'').replace(/[*_\`\\[\\]()~>#+=|{}.!\\-]/g,'\\\\$&');

let _botUsername = null;
async function getBotUsername(bot) {
  if(_botUsername) return _botUsername;
  const me = await bot.telegram.getMe();
  _botUsername = me.username;
  return _botUsername;
}

async function notifyGroupsNewFile(bot, fileInfo) {
  if(!bot || !fileInfo?.specialty_id) return;
  try {
    const groups = await all(
      'SELECT chat_id, title FROM group_chats WHERE specialty_id=$1 AND notify_new_files=1',
      [fileInfo.specialty_id]
    );
    if(!groups.length) return;
    const username = await getBotUsername(bot);
    for(const group of groups) {
      try {
        const members = await all(
          'SELECT user_id, username, first_name FROM group_members WHERE chat_id=$1 LIMIT 30',
          [group.chat_id]
        );
        let msg = '📚 *ملف جديد في تخصصك!*\\n\\n';
        msg += '📄 *' + escMd(fileInfo.title) + '*\\n';
        msg += '📁 ' + escMd(fileInfo.cat_name||'') + ' | 📖 ' + escMd(fileInfo.sub_name||'') + '\\n\\n';
        if(members.length) {
          msg += members.map(m =>
            m.username ? '@'+m.username
            : '['+escMd(m.first_name||'عضو')+'](tg://user?id='+m.user_id+')'
          ).join(' ') + '\\n\\n';
        }
        msg += '👆 اضغط للتحميل';
        await bot.telegram.sendMessage(group.chat_id, msg, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{
            text: 'تحميل ' + (fileInfo.title||'').substring(0,20),
            url: 'https://t.me/' + username + '?start=file_' + fileInfo.id
          }]]}
        });
      } catch(e) { console.error('notify group error:', group.chat_id, e.message); }
    }
  } catch(e) { console.error('notifyGroupsNewFile error:', e.message); }
}

module.exports = { notifyGroupsNewFile };
`);
console.log('2 groupNotify.js done');

// 3 — files.js — addFile يرجع معلومات الملف
let files = fs.readFileSync('database/files.js', 'utf8');
files = files.replace(
  `const addFile = async (catId,title,desc,fileId,fileType,uploadedBy,extra='') => {
  const exists=await get('SELECT id FROM files WHERE category_id=? AND title=? AND is_deleted=0',[catId,title]);
  if(exists) throw new Error('exists');
  await run('INSERT INTO files(category_id,title,description,file_id,file_type,uploaded_by) VALUES(?,?,?,?,?,?)',[catId,title,desc,fileId,fileType,uploadedBy]);
  invalidateFilesCache(catId);
};`,
  `const addFile = async (catId,title,desc,fileId,fileType,uploadedBy,extra='') => {
  const exists=await get('SELECT id FROM files WHERE category_id=? AND title=? AND is_deleted=0',[catId,title]);
  if(exists) throw new Error('exists');
  await run('INSERT INTO files(category_id,title,description,file_id,file_type,uploaded_by) VALUES(?,?,?,?,?,?)',[catId,title,desc,fileId,fileType,uploadedBy]);
  invalidateFilesCache(catId);
  const newFile = await get(
    'SELECT f.*,c.name as cat_name,s.name as sub_name,y.specialty_id FROM files f JOIN categories c ON f.category_id=c.id JOIN subjects s ON c.subject_id=s.id JOIN semesters sm ON s.semester_id=sm.id JOIN years y ON sm.year_id=y.id WHERE f.category_id=? AND f.title=? AND f.is_deleted=0 ORDER BY f.id DESC LIMIT 1',
    [catId,title]
  );
  return newFile;
};`
);
fs.writeFileSync('database/files.js', files);
console.log('3 files.js done');

// 4 — manage.js — أضف إشعار + require
let mg = fs.readFileSync('handlers/manage.js', 'utf8');
if(!mg.includes('groupNotify')) {
  mg = mg.replace(
    "const { cacheGet, cacheSet, cacheClear, cacheClearPrefix } = require('../utils/cache');",
    "const { cacheGet, cacheSet, cacheClear, cacheClearPrefix } = require('../utils/cache');\nconst { notifyGroupsNewFile } = require('../utils/groupNotify');"
  );
  mg = mg.replace(
    `    await filesDb.addFile(state.catId,state.title,state.desc||'',fid,ftype,uid,ftype==='link'?msgText:'');
    await interactions.addLog(uid,'upload',state.title);
    clearState(uid);
    ctx.reply('✅ *'+escMd(state.title)+'* رُفع بنجاح!'`,
    `    const newFile = await filesDb.addFile(state.catId,state.title,state.desc||'',fid,ftype,uid,ftype==='link'?msgText:'');
    await interactions.addLog(uid,'upload',state.title);
    clearState(uid);
    if(newFile && global.__bot) notifyGroupsNewFile(global.__bot, newFile).catch(()=>{});
    ctx.reply('✅ *'+escMd(state.title)+'* رُفع بنجاح!'`
  );
  fs.writeFileSync('handlers/manage.js', mg);
}
console.log('4 manage.js done');

// 5 — index.js
let idx = fs.readFileSync('index.js', 'utf8');

// أ — أضف __bot
if(!idx.includes('global.__bot')) {
  idx = idx.replace(
    "console.log('🚀 Study Bot v3.2 — FIXED & OPTIMIZED');",
    "global.__bot = bot;\n    console.log('🚀 Study Bot v3.2 — FIXED & OPTIMIZED');"
  );
}

// ب — /start مع deep link
if(!idx.includes('file_')) {
  idx = idx.replace(
    "bot.command('start', startHandler);",
    `bot.command('start', async ctx => {
  const payload = ctx.message.text.replace('/start','').replace(/@\\w+/,'').trim();
  if(payload.startsWith('file_')) {
    const fid = payload.replace('file_','');
    return browse.showPreview(ctx, fid, '0','0','0','0','0');
  }
  return startHandler(ctx);
});`
  );
}

// ج — /search ذكي في القروب
idx = idx.replace(
  `bot.command('search', ctx => {
  const q = ctx.message.text.replace('/search', '').trim();
  if (q) return userH.handleSearch(ctx, q);
  global.setState(ctx.uid, { type: 'search' });
  ctx.reply('🔍 اكتب كلمة البحث:');
});`,
  `bot.command('search', async ctx => {
  const q = ctx.message.text.replace('/search','').replace(/@\\w+/,'').trim();
  const isGroup = ctx.chat?.type !== 'private';
  if(isGroup) {
    if(!q) {
      const m = await ctx.reply('استخدم: /search اسم الملف');
      setTimeout(()=>ctx.deleteMessage(m.message_id).catch(()=>{}), 5000);
      return;
    }
    const results = await filesDb.search(q, 8);
    if(!results.length) {
      const m = await ctx.reply('لا نتائج لـ: ' + q);
      setTimeout(()=>ctx.deleteMessage(m.message_id).catch(()=>{}), 8000);
      return;
    }
    const me = await ctx.telegram.getMe();
    const rows = results.map(f => [{
      text: '📄 '+f.title.substring(0,35)+' · '+f.sub_name,
      url: 'https://t.me/'+me.username+'?start=file_'+f.id
    }]);
    rows.push([{text:'🤖 فتح البوت', url:'https://t.me/'+me.username}]);
    const m = await ctx.reply(
      'نتائج "'+q+'" ('+results.length+')\\nاضغط للتحميل في الخاص:',
      {reply_markup:{inline_keyboard:rows}}
    );
    setTimeout(()=>ctx.deleteMessage(m.message_id).catch(()=>{}), 60000);
    return;
  }
  if(q) return userH.handleSearch(ctx, q);
  global.setState(ctx.uid, {type:'search'});
  ctx.reply('اكتب كلمة البحث:');
});`
);

// د — my_chat_member بدل auto-leave
idx = idx.replace(
  `bot.on('my_chat_member', async ctx => {
  const chat = ctx.myChatMember.chat;
  if (chat.type !== 'private') {
    try {
      await dbRun(
        'INSERT INTO group_chats(chat_id,title) VALUES(?,?) ON CONFLICT(chat_id) DO NOTHING',
        [chat.id, chat.title || '']
      );
      await ctx.telegram.leaveChat(chat.id);
    } catch(e) {}
  }
});`,
  `bot.on('my_chat_member', async ctx => {
  const chat = ctx.myChatMember?.chat;
  const member = ctx.myChatMember?.new_chat_member;
  if(!chat || chat.type === 'private') return;
  const botId = (await ctx.telegram.getMe()).id;
  if(member?.user?.id !== botId) return;
  if(['member','administrator'].includes(member?.status)) {
    try {
      await dbRun(
        'INSERT INTO group_chats(chat_id,title) VALUES(?,?) ON CONFLICT(chat_id) DO UPDATE SET title=EXCLUDED.title',
        [chat.id, chat.title||'']
      );
      const specs = await dbAll('SELECT id,name FROM specialties WHERE is_deleted=0 ORDER BY id');
      const rows = specs.map(s=>[{text:'🎓 '+s.name, callback_data:'grp_sp_'+chat.id+'_'+s.id}]);
      await ctx.telegram.sendMessage(chat.id,
        'مرحباً! أنا بوت الدراسة\\n\\nاختر تخصص هذا القروب:',
        {reply_markup:{inline_keyboard:rows}}
      );
    } catch(e) { console.error('Group join:', e.message); }
  } else if(['left','kicked'].includes(member?.status)) {
    dbRun('DELETE FROM group_chats WHERE chat_id=?',[chat.id]).catch(()=>{});
    dbRun('DELETE FROM group_members WHERE chat_id=?',[chat.id]).catch(()=>{});
  }
});`
);

// هـ — حفظ أعضاء القروب + وقف auto-leave
idx = idx.replace(
  `  // Auto-leave non-private chats
  if (ctx.chat?.type !== 'private') {
    try { await ctx.telegram.leaveChat(ctx.chat.id); } catch(e) {}
    return;
  }`,
  `  if(ctx.chat?.type !== 'private') {
    if(ctx.from && !ctx.from.is_bot) {
      dbRun(
        'INSERT INTO group_members(chat_id,user_id,username,first_name,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(chat_id,user_id) DO UPDATE SET username=EXCLUDED.username,first_name=EXCLUDED.first_name,updated_at=CURRENT_TIMESTAMP',
        [ctx.chat.id, ctx.from.id, ctx.from.username||'', ctx.from.first_name||'']
      ).catch(()=>{});
    }
    return next();
  }`
);

// و — callback لاختيار تخصص القروب
if(!idx.includes('grp_sp_')) {
  idx = idx.replace(
    "    if (data === 'noop') return;",
    `    if(data === 'noop') return;

    if(data.startsWith('grp_sp_')) {
      const p = data.replace('grp_sp_','').split('_');
      const chatId = p[0]; const spId = p[1];
      try {
        await dbRun('UPDATE group_chats SET specialty_id=? WHERE chat_id=?',[spId,chatId]);
        const sp = await dbAll('SELECT name FROM specialties WHERE id=?',[spId]);
        await ctx.answerCbQuery('تم!').catch(()=>{});
        await ctx.editMessageText(
          'تم ربط القروب بتخصص ' + (sp[0]?.name||'') + '\\n\\nستصلكم اشعارات الملفات الجديدة\\nللبحث: /search اسم الملف'
        );
      } catch(e) { ctx.answerCbQuery('خطأ').catch(()=>{}); }
      return;
    }`
  );
}

fs.writeFileSync('index.js', idx);
console.log('5 index.js done');

console.log('\\nكل شيء تم!');
