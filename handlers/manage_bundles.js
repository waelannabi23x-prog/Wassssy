const bundlesDb = require('../database/bundles');
const { btn, build, back } = require('../utils/keyboard');
const { escMd } = require('../utils/helpers');

async function handleBundleFileUpload(ctx) {
  const uid = ctx.uid;
  const state = global.userStates && global.userStates[uid];
  if (!state || state.type !== 'mg_bundle_files') return false;

  const msg = ctx.message;
  let fid = null;
  let ftype = null;
  let title = '';

  // ملفات مرفوعة (أولوية عالية)
  if (msg.document) {
    fid = msg.document.file_id;
    ftype = 'document';
    title = msg.document.file_name || '📄 ملف';
  } else if (msg.photo) {
    fid = msg.photo[msg.photo.length - 1].file_id;
    ftype = 'photo';
    title = '🖼️ صورة';
  } else if (msg.video) {
    fid = msg.video.file_id;
    ftype = 'video';
    title = msg.video.file_name || '🎥 فيديو';
  } else if (msg.audio) {
    fid = msg.audio.file_id;
    ftype = 'audio';
    title = msg.audio.title || '🎵 صوت';
  } else if (msg.voice) {
    fid = msg.voice.file_id;
    ftype = 'voice';
    title = '🎤 تسجيل صوتي';
  }

  // روابط (أولوية منخفضة - فقط إذا ما في ملف)
  if (!fid) {
    var txt = '';
    if (msg.text) txt = msg.text.trim();
    if (msg.caption) txt = txt + ' ' + msg.caption.trim();
    
    // forwarded messages
    if (msg.forward_origin) {
      if (msg.forward_origin.text && Array.isArray(msg.forward_origin.text)) {
        txt = txt + ' ' + msg.forward_origin.text.join(' ');
      }
    }

    var urlMatch = txt.match(/https?:\/\/[^\s]+/) || txt.match(/www\.[^\s]+/);
    if (urlMatch && urlMatch[0]) {
      fid = urlMatch[0];
      ftype = 'link';
      var shortUrl = urlMatch[0];
      if (shortUrl.length > 40) shortUrl = shortUrl.substring(0, 40) + '...';
      title = '🔗 ' + shortUrl;
    }
  }

  if (!fid) return false;

  try {
    await bundlesDb.addBundleFile(state.bundleId, fid, ftype, title);
    state.fileCount = (state.fileCount || 0) + 1;

    var icons = { link: '🔗', photo: '🖼️', video: '🎥', audio: '🎵', voice: '🎤', document: '📄' };
    var icon = icons[ftype] || '📄';
    await ctx.reply(icon + ' ملف ' + state.fileCount + ' تم الحفظ. ابعث المزيد أو /done.');
    return true;
  } catch (err) {
    console.error('Bundle upload error:', err.message);
    return false;
  }
}

function makeBackPath(state) {
  if (!state) return 'main_menu';
  return 'mg_fls_' + state.spId + '_' + state.yrId + '_' + state.smId + '_' + state.sbId + '_' + state.catId;
}

function handleBundleTextCases(ctx, state, text, uid, clearState, setState) {
  // /done إنهاء الحزمة
  if (text === '/done' && state.type === 'mg_bundle_files') {
    clearState(uid);
    var pathArr = makeBackPath(state);
    var kb = [[btn('◀️ رجوع', pathArr)]];
    return { handled: true, msg: '✅ تم حفظ الحزمة بـ ' + state.fileCount + ' ملف!', kb: kb };
  }

  // اسم الحزمة
  if (state.type === 'mg_bundle_title') {
    setState(uid, Object.assign({}, state, { type: 'mg_bundle_desc', title: text }));
    return { handled: true, msg: '📝 وصف الحزمة (أو اكتب skip للتجاوزه):' };
  }

  // وصف الحزمة
  if (state.type === 'mg_bundle_desc') {
    var desc = text;
    if (text === 'skip') desc = '';
    return bundlesDb.addBundle(state.catId, state.title, desc, uid).then(function(bid) {
      setState(uid, Object.assign({}, state, { type: 'mg_bundle_files', bundleId: bid, fileCount: 0 }));
      return { handled: true, msg: '✅ تم إنشاء الحزمة! ابعث الملفات الآن.\nبعث /done للانتهاء' };
    }).catch(function(e) {
      clearState(uid);
      if (e.message === 'exists') {
        return { handled: true, msg: '❌ حزمة بهذا الاسم موجودة بالفعل!' };
      }
      return { handled: true, msg: '❌ خطأ: ' + e.message };
    });
  }

  // تعديل اسم الحزمة
  if (state.type === 'mg_rename_bundle') {
    var pathArr = makeBackPath(state);
    var kb = [[btn('◀️ رجوع', pathArr)]];
    return bundlesDb.renameBundle(state.bundleId, text).then(function() {
      clearState(uid);
      return { handled: true, msg: '✅ تم تعديل الاسم بنجاح', kb: kb };
    }).catch(function(e) {
      clearState(uid);
      return { handled: true, msg: '❌ خطأ: ' + e.message };
    });
  }

  return { handled: false };
}

function handleBundleCbCases(ctx, data) {
  // إضافة ملفات لحزمة موجودة
  if (data.startsWith('mg_add_bundle_files_')) {
    var p = data.replace('mg_add_bundle_files_', '').split('_');
    global.setState(ctx.uid, {
      type: 'mg_bundle_files',
      bundleId: p[0],
      catId: p[1],
      spId: p[2],
      yrId: p[3],
      smId: p[4],
      sbId: p[5],
      fileCount: 0
    });
    return { handled: true, msg: '➕ أبعث ملفات أو روابط للحزمة.\n📷 صور | 📄 ملفات | 🎥 فيديو | 🔗 روابط\n\nابعث /done للانتهاء' };
  }

  // حذف حزمة
  if (data.startsWith('mg_dl_bundle_')) {
    var p = data.replace('mg_dl_bundle_', '').split('_');
    return bundlesDb.deleteBundle(p[0]).then(function() {
      ctx.answerCbQuery('✅ تم الحذف').catch(function() {});
      return { handled: true, action: 'files', args: [p[2], p[3], p[4], p[5], p[1]] };
    }).catch(function(e) {
      ctx.answerCbQuery('❌ ' + e.message, { show_alert: true }).catch(function() {});
      return { handled: true };
    });
  }

  // تعديل اسم حزمة
  if (data.startsWith('mg_rn_bundle_')) {
    var p = data.replace('mg_rn_bundle_', '').split('_');
    global.setState(ctx.uid, {
      type: 'mg_rename_bundle',
      bundleId: p[0],
      catId: p[1],
      spId: p[2],
      yrId: p[3],
      smId: p[4],
      sbId: p[5]
    });
    return { handled: true, msg: '✏️ الاسم الجديد للحزمة:' };
  }

  // إنشاء حزمة جديدة
  if (data.startsWith('mg_add_bundle_')) {
    if (!ctx.isOwner) {
      ctx.answerCbQuery('🚫 هذه الميزة للمالك فقط.', { show_alert: true }).catch(function() {});
      return { handled: true };
    }
    var p = data.replace('mg_add_bundle_', '').split('_');
    global.setState(ctx.uid, {
      type: 'mg_bundle_title',
      spId: p[0],
      yrId: p[1],
      smId: p[2],
      sbId: p[3],
      catId: p[4]
    });
    return { handled: true, msg: '📦 اسم الحزمة:' };
  }

  return { handled: false };
}

module.exports = {
  handleBundleFileUpload: handleBundleFileUpload,
  handleBundleTextCases: handleBundleTextCases,
  handleBundleCbCases: handleBundleCbCases
};
