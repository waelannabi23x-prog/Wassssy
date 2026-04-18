const { cacheGet, cacheSet } = require('./cache');
const langs = new Map();

const messages = {
  ar: {
    no_files: '_لا توجد ملفات في هذا القسم._',
    not_found: '❌ الملف غير موجود.',
    error: '⚠️ حدث خطأ. يرجى المحاولة مجدداً.',
  },
  en: {
    no_files: '_No files in this section._',
    not_found: '❌ File not found.',
    error: '⚠️ An error occurred. Please try again.',
  }
};

function getLang(uid) {
  const c = cacheGet('lang_'+uid);
  return c || 'ar';
}
function setLang(uid, lang) {
  langs.set(uid, lang);
  cacheSet('lang_'+uid, lang, 86400000);
}
function t(uid, key) {
  const lang = getLang(uid);
  return (messages[lang] || messages.ar)[key] || key;
}

module.exports = { t, getLang, setLang };
