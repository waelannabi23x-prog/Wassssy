const logger = require('./logger');
const { cacheSet, getCacheSize } = require('./cache');
const { getSpecs, getYears, getSemesters, getSubjects } = require('../database/content');
const { build, btn, backMenu } = require('./keyboard');
const escMd = t => (t||'').replace(/[*_`\[\]()~>#+=|{}.!\-]/g,'\\$&');

async function startSmartWarmup() {
  logger.info('🔥 بدء التسخين التدريجي للقوائم...');
  try {
    const specs = await getSpecs();

    // المرحلة 1: التخصصات -> السنوات (أسرع شيء)
    for (const sp of specs) {
      const years = await getYears(sp.id);
      const rows = years.map(y=>[btn('📅 '+y.name,'yr_'+sp.id+'_'+y.id)]);
      rows.push(backMenu('browse'));
      cacheSet('precomp_yrs_'+sp.id, {
        text: '*'+escMd(sp.name)+'*\n\n📅 *اختر السنة:*',
        extra: {parse_mode:'Markdown',...build(rows)}
      }, 3600000);
    }
    logger.info('✅ تسخين السنوات - Cache:', getCacheSize());

    // المرحلة 2: الفصول (بعد ثانيتين)
    await new Promise(r => setTimeout(r, 2000));
    for (const sp of specs) {
      const years = await getYears(sp.id);
      for (const yr of years) {
        const sems = await getSemesters(yr.id);
        const rows = sems.map(s=>[btn('📆 '+s.name,'sm_'+sp.id+'_'+yr.id+'_'+s.id)]);
        rows.push(backMenu('yrs_'+sp.id));
        cacheSet('precomp_sems_'+sp.id+'_'+yr.id, {
          text: '*'+escMd(sp.name)+' › '+escMd(yr.name)+'*\n\n📆 *اختر الفصل:*',
          extra: {parse_mode:'Markdown',...build(rows)}
        }, 3600000);
      }
    }
    logger.info('✅ تسخين الفصول - Cache:', getCacheSize());

    // المرحلة 3: المواد (بعد 4 ثواني - أول تخصصين فقط لتوفير RAM)
    await new Promise(r => setTimeout(r, 4000));
    for (const sp of specs.slice(0, 2)) {
      const years = await getYears(sp.id);
      for (const yr of years) {
        const sems = await getSemesters(yr.id);
        for (const sm of sems) {
          const subs = await getSubjects(sm.id);
          const rows = [];
          for(let i=0; i<subs.length; i+=2) {
            const row = [btn('📖 '+subs[i].name,'sb_'+sp.id+'_'+yr.id+'_'+sm.id+'_'+subs[i].id)];
            if(subs[i+1]) row.push(btn('📖 '+subs[i+1].name,'sb_'+sp.id+'_'+yr.id+'_'+sm.id+'_'+subs[i+1].id));
            rows.push(row);
          }
          rows.push(backMenu('sms_'+sp.id+'_'+yr.id));
          cacheSet('precomp_subs_'+sp.id+'_'+yr.id+'_'+sm.id, {
            text: '*'+escMd(sp.name)+' › '+escMd(yr.name)+' › '+escMd(sm.name)+'*\n\n📖 *اختر المادة:*',
            extra: {parse_mode:'Markdown',...build(rows)}
          }, 3600000);
        }
      }
    }
    logger.info('✅ تسخين المواد - Cache:', getCacheSize());
    logger.info('🚀 انتهى التسخين! التصفح الآن فوري.');
  } catch(e) { logger.error('Warmup error:', e.message); }
}

module.exports = { startSmartWarmup };
