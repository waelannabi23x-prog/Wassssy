const msgs={
  ar:{
    welcome:name=>`🎓 *مرحباً، ${name}!*\n\n_منصتك الأكاديمية على تيليغرام._`,
    choose_specialty:'📚 *اختر التخصص:*',choose_year:'📅 *اختر السنة:*',
    choose_semester:'📆 *اختر الفصل:*',choose_subject:'📖 *اختر المادة:*',
    choose_category:'📁 *اختر الفئة:*',no_files:'_لا توجد ملفات بعد._',
    not_found:'❌ غير موجود.',cancelled:'❌ تم الإلغاء.',
    error:'⚠️ حدث خطأ. حاول مجدداً.',loading:'⏳ جاري التحميل...',
  },
  en:{
    welcome:name=>`🎓 *Welcome, ${name}!*\n\n_Your academic platform on Telegram._`,
    choose_specialty:'📚 *Choose your Specialty:*',choose_year:'📅 *Choose Year:*',
    choose_semester:'📆 *Choose Semester:*',choose_subject:'📖 *Choose Subject:*',
    choose_category:'📁 *Choose Category:*',no_files:'_No files yet._',
    not_found:'❌ Not found.',cancelled:'❌ Cancelled.',
    error:'⚠️ Something went wrong.',loading:'⏳ Loading...',
  }
};
const userLangs=new Map();
const getLang=uid=>userLangs.get(uid)||'ar';
const setLang=(uid,lang)=>userLangs.set(uid,lang);
function t(uid,key,...args){
  const lang=getLang(uid);
  const msg=msgs[lang]?.[key]||msgs['en'][key];
  if(!msg) return key;
  return typeof msg==='function'?msg(...args):msg;
}
module.exports={t,getLang,setLang};
