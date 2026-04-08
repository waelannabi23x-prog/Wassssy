const { cacheGet, cacheSet } = require('./cache');
const { build, btn, backMenu } = require('./keyboard');
const { buildPath } = require('./helpers');
const escMd = t => (t||'').replace(/[*_`\[\]()~>#+=|{}.!\-]/g,'\\$&');

// يحسب الرسالة والأزرار مسبقاً ويحفظها
async function precomputeSpecs() {
  const content = require('../database/content');
  const specs = await content.getSpecs();
  const rows = specs.map(s=>[btn('🎓 '+s.name,'sp_'+s.id)]);
  rows.push(backMenu('main_menu'));
  const result = { text:'🎓 *اختر تخصصك:*', extra:{parse_mode:'Markdown',...build(rows)} };
  cacheSet('precomp_specs', result, 3600000);
  return result;
}

async function precomputeYears(spId) {
  const content = require('../database/content');
  const cached = cacheGet('yrs_'+spId);
  if(!cached) return null;
  const {sp, all} = cached;
  const rows = all.map(y=>[btn('📅 '+y.name,'yr_'+spId+'_'+y.id)]);
  rows.push(backMenu('browse'));
  const result = {
    text: buildPath([escMd(sp?.name)])+'\n\n📅 *اختر السنة:*',
    extra: {parse_mode:'Markdown',...build(rows)}
  };
  cacheSet('precomp_yrs_'+spId, result, 3600000);
  return result;
}

async function precomputeAll() {
  const content = require('../database/content');
  await precomputeSpecs();
  const specs = await content.getSpecs();
  for(const sp of specs) {
    await precomputeYears(sp.id);
    const years = await content.getYears(sp.id);
    for(const yr of years) {
      const sems = await content.getSemesters(yr.id);
      const rows = sems.map(s=>[btn('📆 '+s.name,'sm_'+sp.id+'_'+yr.id+'_'+s.id)]);
      rows.push(backMenu('yrs_'+sp.id+'_'+yr.id));
      const pathStr = buildPath([escMd(sp.name),escMd(yr.name)]);
      cacheSet('precomp_sems_'+sp.id+'_'+yr.id, {
        text: pathStr+'\n\n📆 *اختر الفصل:*',
        extra: {parse_mode:'Markdown',...build(rows)}
      }, 3600000);
      for(const sm of sems) {
        const subs = await content.getSubjects(sm.id);
        const rows2 = subs.map(s=>[btn('📖 '+s.name,'sb_'+sp.id+'_'+yr.id+'_'+sm.id+'_'+s.id)]);
        rows2.push(backMenu('sms_'+sp.id+'_'+yr.id+'_'+sm.id));
        cacheSet('precomp_subs_'+sp.id+'_'+yr.id+'_'+sm.id, {
          text: buildPath([escMd(sp.name),escMd(yr.name),escMd(sm.name)])+'\n\n📖 *اختر المادة:*',
          extra: {parse_mode:'Markdown',...build(rows2)}
        }, 3600000);
        for(const sb of subs) {
          const cats = await content.getCategories(sb.id);
          const rows3 = cats.map(c=>[btn('📁 '+c.name,'ct_'+sp.id+'_'+yr.id+'_'+sm.id+'_'+sb.id+'_'+c.id)]);
          rows3.push(backMenu('sbs_'+sp.id+'_'+yr.id+'_'+sm.id+'_'+sb.id));
          cacheSet('precomp_cats_'+sp.id+'_'+yr.id+'_'+sm.id+'_'+sb.id, {
            text: buildPath([escMd(sp.name),escMd(yr.name),escMd(sm.name),escMd(sb.name)])+'\n\n📁 *اختر القسم:*',
            extra: {parse_mode:'Markdown',...build(rows3)}
          }, 3600000);
        }
      }
    }
  }
  console.log('✅ Precomputed all browse menus');
}

module.exports = { precomputeAll, precomputeSpecs, precomputeYears };
