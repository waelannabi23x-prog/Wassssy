const { cacheGet, cacheSet } = require('./cache');
const { build, btn, backMenu } = require('./keyboard');
const { buildPath } = require('./helpers');
const escMd = t => (t||'').replace(/[*_`\[\]()~>#+=|{}.!\-]/g,'\\$&');

async function pLimit(fns, limit=3) {
  const results = [];
  let i = 0;
  async function worker() {
    while(i < fns.length) {
      const idx = i++;
      results[idx] = await fns[idx]();
    }
  }
  await Promise.all(Array.from({length: Math.min(limit, fns.length)}, worker));
  return results;
}

async function precomputeAll() {
  const content = require('../database/content');
  const filesDb = require('../database/files');
  const bundlesDb = require('../database/bundles');

  const specs = await content.getSpecs();
  cacheSet('precomp_specs', {
    text: '🎓 *اختر تخصصك:*',
    extra: {parse_mode:'Markdown',...build([...specs.map(s=>[btn('🎓 '+s.name,'sp_'+s.id)]),[btn('🏠 القائمة','main_menu')]])}
  }, 3600000);

  await pLimit(specs.map(sp => async () => {
    const years = await content.getYears(sp.id);
    cacheSet('precomp_yrs_'+sp.id, {
      text: buildPath([escMd(sp.name)])+'\n\n📅 *اختر السنة:*',
      extra: {parse_mode:'Markdown',...build([...years.map(y=>[btn('📅 '+y.name,'yr_'+sp.id+'_'+y.id)]),backMenu('browse')])}
    }, 3600000);

    await pLimit(years.map(yr => async () => {
      const sems = await content.getSemesters(yr.id);
      cacheSet('precomp_sems_'+sp.id+'_'+yr.id, {
        text: buildPath([escMd(sp.name),escMd(yr.name)])+'\n\n📆 *اختر الفصل:*',
        extra: {parse_mode:'Markdown',...build([...sems.map(s=>[btn('📆 '+s.name,'sm_'+sp.id+'_'+yr.id+'_'+s.id)]),backMenu('yrs_'+sp.id+'_'+yr.id)])}
      }, 3600000);

      await pLimit(sems.map(sm => async () => {
        const subs = await content.getSubjects(sm.id);
        cacheSet('precomp_subs_'+sp.id+'_'+yr.id+'_'+sm.id, {
          text: buildPath([escMd(sp.name),escMd(yr.name),escMd(sm.name)])+'\n\n📖 *اختر المادة:*',
          extra: {parse_mode:'Markdown',...build([...(() => { const rows=[]; for(let i=0;i<subs.length;i+=2){ const row=[btn('📖 '+subs[i].name,'sb_'+sp.id+'_'+yr.id+'_'+sm.id+'_'+subs[i].id)]; if(subs[i+1]) row.push(btn('📖 '+subs[i+1].name,'sb_'+sp.id+'_'+yr.id+'_'+sm.id+'_'+subs[i+1].id)); rows.push(row); } return rows; })(),backMenu('sms_'+sp.id+'_'+yr.id+'_'+sm.id)])}
        }, 3600000);

        await pLimit(subs.map(sb => async () => {
          const cats = await content.getCategories(sb.id);
          cacheSet('precomp_cats_'+sp.id+'_'+yr.id+'_'+sm.id+'_'+sb.id, {
            text: buildPath([escMd(sp.name),escMd(yr.name),escMd(sm.name),escMd(sb.name)])+'\n\n📁 *اختر القسم:*',
            extra: {parse_mode:'Markdown',...build([...cats.map(c=>[btn('📁 '+c.name,'ct_'+sp.id+'_'+yr.id+'_'+sm.id+'_'+sb.id+'_'+c.id)]),backMenu('sbs_'+sp.id+'_'+yr.id+'_'+sm.id+'_'+sb.id)])}
          }, 3600000);

          await pLimit(cats.map(cat => async () => {
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
          }));
        }));
      }));
    }));
  }));
  console.log('✅ Precomputed all browse menus');
}

module.exports = { precomputeAll };
