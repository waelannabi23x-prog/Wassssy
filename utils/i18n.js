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

function getLang(uid) { return langs.get(uid) || 'ar'; }
function setLang(uid, lang) { langs.set(uid, lang); }
function t(uid, key) {
  const lang = getLang(uid);
  return (messages[lang] || messages.ar)[key] || key;
}

module.exports = { t, getLang, setLang };
