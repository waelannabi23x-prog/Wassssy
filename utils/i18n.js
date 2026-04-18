'use strict';
const _langs = new Map();
const _dict = {
  ar: { no_files: 'لا توجد ملفات.', not_found: 'الملف غير موجود.' },
  en: { no_files: 'No files found.', not_found: 'File not found.' },
};
function getLang(uid) { return _langs.get(uid) || 'ar'; }
function setLang(uid, lang) { _langs.set(uid, lang === 'en' ? 'en' : 'ar'); }
function t(uid, key) { const lang = getLang(uid); return _dict[lang]?.[key] || _dict.ar[key] || key; }
module.exports = { getLang, setLang, t };
