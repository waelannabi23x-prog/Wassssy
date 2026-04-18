const { cacheGet, cacheSet } = require('./cache');
const translations = require('./translations');

const LANG_NAMES = {
  ar: '🇩🇿 العربية',
  fr: '🇫🇷 Français',
  ru: '🇷🇺 Русский'
};

const LANG_SWITCH = {
  ar: { fr: '🇫🇷 Français', ru: '🇷🇺 Русский' },
  fr: { ar: '🇩🇿 العربية', ru: '🇷🇺 Русский' },
  ru: { ar: '🇩🇿 العربية', fr: '🇫🇷 Français' }
};

function getLang(uid) {
  const c = cacheGet('lang_' + uid);
  return (c && translations[c]) ? c : 'ar';
}

function setLang(uid, lang) {
  if (translations[lang]) cacheSet('lang_' + uid, lang, 86400000);
}

function t(uid, key) {
  const lang = getLang(uid);
  return (translations[lang] || translations.ar)[key] || (translations.ar)[key] || key;
}

function getLangButtons(uid) {
  const lang = getLang(uid);
  const switches = LANG_SWITCH[lang] || LANG_SWITCH.ar;
  return Object.entries(switches).map(([code, label]) => ({
    text: label,
    callback_data: 'lang_' + code
  }));
}

function getGreeting(uid) {
  const hour = new Date().getHours();
  const key = hour < 12 ? 'welcome_morning' : hour < 17 ? 'welcome_afternoon' : 'welcome_evening';
  return t(uid, key);
}

module.exports = { t, getLang, setLang, getLangButtons, getGreeting, LANG_NAMES };
