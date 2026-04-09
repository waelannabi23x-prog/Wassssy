const { cacheGet, cacheSet } = require('./cache');
const { build, btn, backMenu } = require('./keyboard');
const { buildPath } = require('./helpers');
const escMd = t => (t||'').replace(/[*_`\[\]()~>#+=|{}.!\-]/g,'\\$&');

async function precomputeAll() {
  const content = require('../database/content');
  const filesDb = require('../database/files');
  const bundlesDb = require('../database/bundles');

  const specs = await content.getSpecs();
  cacheSet('precomp_specs', {
    text: '🎓 *اختر تخصصك:*',
    extra: {parse_mode:'Markdown',...build([...specs.map(s=>[btn('🎓 '+s.name,'sp_'+s.id)]),[btn('🏠 القائمة','main_menu')]])}
  }, 3600000);

  for(const sp of specs) {
    const years = await content.getYears(sp.id);
    cacheSet('precomp_yrs_'+sp.id, {
      text: buildPath([escMd(sp.name)])+'\n\n📅 *اختر السنة:*',
      extra: {parse_mode:'Markdown',...build([...years.map(y=>[btn('📅 '+y.name,'yr_'+sp.id+'_'+y.id)]),backMenu('browse')])}
    }, 3600000);

    for(const yr of years) {
      const sems = await content.getSemesters(yr.id);
      cacheSet('precomp_sems_'+sp.id+'_'+yr.id, {
        text: buildPath([escMd(sp.name),escMd(yr.name)])+'\n\n📆 *اختر الفصل:*',
        extra: {parse_mode:'Markdown',...build([...sems.map(s=>[btn('📆 '+s.name,'sm_'+sp.id+'_'+yr.id+'_'+s.id)]),backMenu('yrs_'+sp.id+'_'+yr.id)])}
      }, 3600000);

      for(const sm of sems) {
        const subs = await content.getSubjects(sm.id);
        cacheSet('precomp_subs_'+sp.id+'_'+yr.id+'_'+sm.id, {
          text: buildPath([escMd(sp.name),escMd(yr.name),escMd(sm.name)])+'\n\n📖 *اختر المادة:*',
          extra: {parse_mode:'Markdown',...build([...subs.map(s=>[btn('📖 '+s.name,'sb_'+sp.id+'_'+yr.id+'_'+sm.id+'_'+s.id)]),backMenu('sms_'+sp.id+'_'+yr.id+'_'+sm.id)])}
        }, 3600000);

        for(const sb of subs) {
          const cats = await content.getCategories(sb.id);
          cacheSet('precomp_cats_'+sp.id+'_'+yr.id+'_'+sm.id+'_'+sb.id, {
            text: buildPath([escMd(sp.name),escMd(yr.name),escMd(sm.name),escMd(sb.name)])+'\n\n📁 *اختر القسم:*',
            extra: {parse_mode:'Markdown',...build([...cats.map(c=>[btn('📁 '+c.name,'ct_'+sp.id+'_'+yr.id+'_'+sm.id+'_'+sb.id+'_'+c.id)]),backMenu('sbs_'+sp.id+'_'+yr.id+'_'+sm.id+'_'+sb.id)])}
          }, 3600000);

          for(const cat of cats) {
            // precompute showFiles لكل فئة
            try {
              const [allFiles, bundles] = await Promise.all([
                filesDb.getFiles(cat.id),
                bundlesDb.getBundles(cat.id)
              ]);
              const staticKey='showfiles_'+cat.id+'_'+sp.id+'_'+yr.id+'_'+sm.id+'_'+sb.id;
              cacheSet(staticKey, {
                pathData:{sp,yr,sm,sb,cat},
                allFiles,
                bundles
              }, 900000);
            } catch(e) {}
          }
        }
      }
    }
  }
  console.log('✅ Precomputed all browse menus');
}

module.exports = { precomputeAll };
