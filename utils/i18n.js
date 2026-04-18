const { cacheGet, cacheSet } = require('./cache');
const messages = {
  ar: { no_files: '_لا توجد ملفات في هذا القسم._', not_found: '❌ الملف غير موجود.', error: '⚠️ حدث خطأ.' },
  en: { no_files: '_No files in this section._', not_found: '❌ File not found.', error: '⚠️ An error occurred.' }
};
function getLang(uid) { return cacheGet('lang_'+uid) || 'ar'; }
function setLang(uid, lang) { cacheSet('lang_'+uid, lang, 86400000); }
function t(uid, key) { const lang = getLang(uid); return (messages[lang] || messages.ar)[key] || key; }
module.exports = { t, getLang, setLang };
