'use strict';
const { all, get } = require('../database/db');
const { cacheGet, cacheSet } = require('../utils/cache');
const { build, btn, back } = require('../utils/keyboard');
const { eos } = require('../utils/helpers');

function bar(val, max, w) {
  w = w || 10; if (!max || !val) return '\u2591'.repeat(w) + ' ' + (val || 0);
  const f = Math.min(Math.round((val / max) * w), w);
  return '\u2588'.repeat(f) + '\u2591'.repeat(w - f) + ' ' + val;
}

async function showAnalytics(ctx) {
  if (!ctx.isAdmin) return ctx.answerCbQuery('\ud83d\udeab', { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  const cKey = 'analytics_main_v2';
  const cached = cacheGet(cKey);
  if (cached) return eos(ctx, cached.text, { parse_mode: 'Markdown', ...build(cached.kb) });
  const [uTotal,uToday,uWeek,uMonth,fTotal,fWeek,dlTotal,topFiles,specStats,dailyUploads] = await Promise.all([
    get('SELECT COUNT(*) as c FROM users'),
    get("SELECT COUNT(*) as c FROM users WHERE last_active >= NOW() - INTERVAL '1 day'"),
    get("SELECT COUNT(*) as c FROM users WHERE last_active >= NOW() - INTERVAL '7 days'"),
    get("SELECT COUNT(*) as c FROM users WHERE last_active >= NOW() - INTERVAL '30 days'"),
    get('SELECT COUNT(*) as c FROM files WHERE is_deleted=0'),
    get("SELECT COUNT(*) as c FROM files WHERE is_deleted=0 AND uploaded_at >= NOW() - INTERVAL '7 days'"),
    get('SELECT COALESCE(SUM(downloads),0) as c FROM files WHERE is_deleted=0'),
    all('SELECT f.title, f.downloads, s.name as sub_name FROM files f JOIN categories c ON c.id=f.category_id JOIN subjects s ON s.id=c.subject_id WHERE f.is_deleted=0 ORDER BY f.downloads DESC LIMIT 6'),
    all('SELECT sp.name, COUNT(DISTINCT f.id) as files, COALESCE(SUM(f.downloads),0) as dl FROM specialties sp LEFT JOIN years y ON y.specialty_id=sp.id AND y.is_deleted=0 LEFT JOIN semesters sm ON sm.year_id=y.id AND sm.is_deleted=0 LEFT JOIN subjects sub ON sub.semester_id=sm.id AND sub.is_deleted=0 LEFT JOIN categories cat ON cat.subject_id=sub.id AND cat.is_deleted=0 LEFT JOIN files f ON f.category_id=cat.id AND f.is_deleted=0 WHERE sp.is_deleted=0 GROUP BY sp.id,sp.name ORDER BY dl DESC'),
    all("SELECT TO_CHAR(uploaded_at,'DD/MM') as day, COUNT(*) as cnt FROM files WHERE is_deleted=0 AND uploaded_at >= NOW() - INTERVAL '7 days' GROUP BY TO_CHAR(uploaded_at,'DD/MM'),DATE(uploaded_at) ORDER BY DATE(uploaded_at) ASC")
  ]);
  let text = '\ud83d\udcca *\u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u062d\u0644\u064a\u0644\u0627\u062a*\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n';
  text += '\ud83d\udc65 *\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u0648\u0646*\n';
  text += `\u250c \u0627\u0644\u0643\u0644:    \`${uTotal?.c||0}\`\n\u251c \u0627\u0644\u064a\u0648\u0645:   \`${uToday?.c||0}\`\n\u251c \u0627\u0644\u0623\u0633\u0628\u0648\u0639: \`${uWeek?.c||0}\`\n\u2514 \u0627\u0644\u0634\u0647\u0631:   \`${uMonth?.c||0}\`\n\n`;
  text += `\ud83d\udcc1 *\u0627\u0644\u0645\u062d\u062a\u0648\u0649*\n\u250c \u0627\u0644\u0645\u0644\u0641\u0627\u062a: \`${fTotal?.c||0}\` (\ud83c\udd95 ${fWeek?.c||0} \u0647\u0630\u0627 \u0627\u0644\u0623\u0633\u0628\u0648\u0639)\n\u2514 \u0627\u0644\u062a\u062d\u0645\u064a\u0644\u0627\u062a: \`${dlTotal?.c||0}\`\n\n`;
  if (topFiles.length) {
    const maxDl = parseInt(topFiles[0].downloads)||1;
    const medals = ['\ud83e\udd47','\ud83e\udd48','\ud83e\udd49','4\ufe0f\u20e3','5\ufe0f\u20e3','6\ufe0f\u20e3'];
    text += '\ud83c\udfc6 *\u0627\u0644\u0623\u0643\u062b\u0631 \u062a\u062d\u0645\u064a\u0644\u0627\u064b*\n';
    topFiles.forEach((f,i) => { text += `${medals[i]} \`${bar(f.downloads,maxDl,7)}\`\n   _${f.title.substring(0,28)} \u00b7 ${f.sub_name}_\n`; });
    text += '\n';
  }
  if (specStats.length) {
    const maxDl = Math.max(...specStats.map(s=>parseInt(s.dl)||0),1);
    text += '\ud83c\udf93 *\u0627\u0644\u062a\u062e\u0635\u0635\u0627\u062a*\n';
    specStats.forEach(s => { text += `\u25aa\ufe0f *${s.name}*\n   \ud83d\udcc4\`${s.files}\`  \u2b07\ufe0f\`${bar(parseInt(s.dl)||0,maxDl,6)}\`\n`; });
    text += '\n';
  }
  if (dailyUploads.length) {
    const maxUp = Math.max(...dailyUploads.map(d=>parseInt(d.cnt)||0),1);
    text += '\ud83d\udcc8 *\u0631\u0641\u0639 \u0622\u062e\u0631 7 \u0623\u064a\u0627\u0645*\n`';
    dailyUploads.forEach(d => { text += `${d.day} ${bar(parseInt(d.cnt)||0,maxUp,8)}\n`; });
    text += '`\n';
  }
  text += `\n_\u23f0 ${new Date().toLocaleTimeString('ar-DZ')}_`;
  const kb = [[btn('\ud83d\udcc8 \u062a\u0641\u0635\u064a\u0644\u064a','mg_analytics_detail'),btn('\ud83d\udd04 \u062a\u062d\u062f\u064a\u062b','mg_analytics')],[btn('\ud83d\uddd3 \u0627\u0644\u064a\u0648\u0645','mg_analytics_daily'),btn('\ud83d\udc65 \u0623\u0641\u0636\u0644 \u0645\u0633\u062a\u062e\u062f\u0645\u064a\u0646','mg_analytics_users')],back('mg_menu')];
  cacheSet(cKey, { text, kb }, 600000);
  return eos(ctx, text, { parse_mode: 'Markdown', ...build(kb) });
}

async function showDetailedAnalytics(ctx) {
  if (!ctx.isAdmin) return ctx.answerCbQuery('\ud83d\udeab', { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  const [topSubs,newUsers7d,reportStats,avgRating,bundleStats] = await Promise.all([
    all('SELECT s.name, COUNT(f.id) as cnt, COALESCE(SUM(f.downloads),0) as dl FROM subjects s JOIN categories c ON c.subject_id=s.id JOIN files f ON f.category_id=c.id AND f.is_deleted=0 WHERE s.is_deleted=0 GROUP BY s.id,s.name ORDER BY dl DESC LIMIT 8'),
    all("SELECT TO_CHAR(joined_at,'DD/MM') as day, COUNT(*) as cnt FROM users WHERE joined_at >= NOW() - INTERVAL '7 days' GROUP BY TO_CHAR(joined_at,'DD/MM'),DATE(joined_at) ORDER BY DATE(joined_at) ASC"),
    get("SELECT COUNT(*) as total, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending FROM reports"),
    get('SELECT ROUND(AVG(rating),2) as avg, COUNT(*) as cnt FROM ratings'),
    get('SELECT COUNT(*) as total, SUM(downloads) as dl FROM bundles WHERE is_deleted=0')
  ]);
  let text = '\ud83d\udcc8 *\u062a\u0642\u0631\u064a\u0631 \u0645\u0641\u0635\u0651\u0644*\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n';
  if (topSubs.length) {
    const maxDl = Math.max(...topSubs.map(s=>parseInt(s.dl)||0),1);
    text += '\ud83d\udcda *\u0623\u0643\u062b\u0631 \u0627\u0644\u0645\u0648\u0627\u062f \u062a\u062d\u0645\u064a\u0644\u0627\u064b*\n';
    topSubs.forEach((s,i) => { text += `${i+1}\\. \`${bar(parseInt(s.dl)||0,maxDl,7)}\`\n   _${s.name.substring(0,25)} \u00b7 ${s.cnt} \u0645\u0644\u0641_\n`; });
    text += '\n';
  }
  if (newUsers7d.length) {
    const maxU = Math.max(...newUsers7d.map(d=>parseInt(d.cnt)||0),1);
    text += '\ud83c\udd95 *\u0645\u0633\u062a\u062e\u062f\u0645\u0648\u0646 \u062c\u062f\u062f*\n`';
    newUsers7d.forEach(d => { text += `${d.day} ${bar(parseInt(d.cnt)||0,maxU,8)}\n`; }); text += '`\n\n';
  }
  text += `\u2b50 *\u0627\u0644\u062a\u0642\u064a\u064a\u0645\u0627\u062a*: \u0645\u062a\u0648\u0633\u0637 \`${avgRating?.avg||'0'}\` \u0645\u0646 ${avgRating?.cnt||0} \u062a\u0642\u064a\u064a\u0645\n`;
  text += `\ud83d\udce6 *\u0627\u0644\u062d\u0632\u0645*: ${bundleStats?.total||0} | \u2b07\ufe0f ${bundleStats?.dl||0}\n`;
  text += `\ud83d\udea9 *\u0627\u0644\u0628\u0644\u0627\u063a\u0627\u062a*: ${reportStats?.total||0} (\u23f3 ${reportStats?.pending||0} \u0645\u0639\u0644\u0642\u0629)\n`;
  return eos(ctx, text, { parse_mode: 'Markdown', ...build([[btn('\u25c0\ufe0f \u0631\u062c\u0648\u0639','mg_analytics')]]) });
}

async function showDailyAnalytics(ctx) {
  if (!ctx.isAdmin) return ctx.answerCbQuery('\ud83d\udeab', { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  const [todayFiles,todayDl,todayUsers,todayComments,hourlyActivity] = await Promise.all([
    get('SELECT COUNT(*) as c FROM files WHERE DATE(uploaded_at)=CURRENT_DATE AND is_deleted=0'),
    get('SELECT COALESCE(SUM(downloads),0) as c FROM files WHERE DATE(uploaded_at)=CURRENT_DATE AND is_deleted=0'),
    get('SELECT COUNT(*) as c FROM users WHERE DATE(last_active)=CURRENT_DATE'),
    get('SELECT COUNT(*) as c FROM comments WHERE DATE(created_at)=CURRENT_DATE AND is_deleted=0'),
    all('SELECT EXTRACT(HOUR FROM viewed_at) as hr, COUNT(*) as cnt FROM history WHERE DATE(viewed_at)=CURRENT_DATE GROUP BY EXTRACT(HOUR FROM viewed_at) ORDER BY hr')
  ]);
  const today = new Date().toISOString().split('T')[0];
  let text = `\ud83d\udcc5 *\u0627\u0644\u064a\u0648\u0645 \u2014 ${today}*\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n`;
  text += `\ud83d\udcc1 \u0645\u0644\u0641\u0627\u062a \u062c\u062f\u064a\u062f\u0629: \`${todayFiles?.c||0}\`\n\u2b07\ufe0f \u062a\u062d\u0645\u064a\u0644\u0627\u062a: \`${todayDl?.c||0}\`\n`;
  text += `\ud83d\udc65 \u0646\u0634\u0637\u0648\u0646: \`${todayUsers?.c||0}\`\n\ud83d\udcac \u062a\u0639\u0644\u064a\u0642\u0627\u062a: \`${todayComments?.c||0}\`\n\n`;
  if (hourlyActivity.length) {
    const maxH = Math.max(...hourlyActivity.map(h=>parseInt(h.cnt)||0),1);
    text += '\ud83d\udd50 *\u0646\u0634\u0627\u0637 \u0628\u0627\u0644\u0633\u0627\u0639\u0629*\n`';
    for (let hr=0;hr<24;hr+=3) {
      const cnt=hourlyActivity.filter(h=>{const h2=parseInt(h.hr);return h2>=hr&&h2<hr+3;}).reduce((a,b)=>a+parseInt(b.cnt),0);
      if(cnt>0) text+=`${String(hr).padStart(2,'0')}-${String(hr+3).padStart(2,'0')}h ${bar(cnt,maxH,8)}\n`;
    }
    text += '`\n';
  }
  return eos(ctx, text, { parse_mode: 'Markdown', ...build([[btn('\u25c0\ufe0f \u0631\u062c\u0648\u0639','mg_analytics')]]) });
}

async function showTopUsers(ctx) {
  if (!ctx.isAdmin) return ctx.answerCbQuery('\ud83d\udeab', { show_alert: true }).catch(err => { require('../utils/logger').debug("[silent]", err.message); });
  const [topDl,topFav,mostActive] = await Promise.all([
    all('SELECT u.first_name,u.username,COUNT(h.file_id) as cnt FROM history h JOIN users u ON u.id=h.user_id WHERE u.is_banned=0 GROUP BY u.id,u.first_name,u.username ORDER BY cnt DESC LIMIT 8'),
    all('SELECT u.first_name,u.username,COUNT(f.file_id) as cnt FROM favorites f JOIN users u ON u.id=f.user_id GROUP BY u.id,u.first_name,u.username ORDER BY cnt DESC LIMIT 5'),
    get("SELECT COUNT(*) as c FROM users WHERE last_active >= NOW() - INTERVAL '1 hour'")
  ]);
  let text = '\ud83d\udc65 *\u0623\u0641\u0636\u0644 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u064a\u0646*\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n';
  text += `\ud83d\udd50 \u0646\u0634\u0637 \u0627\u0644\u0622\u0646: \`${mostActive?.c||0}\`\n\n`;
  if (topDl.length) {
    const maxDl=parseInt(topDl[0].cnt)||1;
    const medals=['\ud83e\udd47','\ud83e\udd48','\ud83e\udd49','4\ufe0f\u20e3','5\ufe0f\u20e3','6\ufe0f\u20e3','7\ufe0f\u20e3','8\ufe0f\u20e3'];
    text += '\u2b07\ufe0f *\u0623\u0643\u062b\u0631 \u062a\u062d\u0645\u064a\u0644\u0627\u064b*\n';
    topDl.forEach((u,i)=>{const nm=u.username?'@'+u.username:u.first_name||'\u2014';text+=`${medals[i]} ${nm}: \`${bar(parseInt(u.cnt)||0,maxDl,7)}\`\n`;});
    text+='\n';
  }
  if (topFav.length) {
    text+='\u2b50 *\u0623\u0643\u062b\u0631 \u062d\u0641\u0638\u0627\u064b*\n';
    topFav.forEach((u,i)=>{const nm=u.username?'@'+u.username:u.first_name||'\u2014';text+=`${i+1}. ${nm}: \`${u.cnt}\`\n`;});
  }
  return eos(ctx, text, { parse_mode: 'Markdown', ...build([[btn('\u25c0\ufe0f \u0631\u062c\u0648\u0639','mg_analytics')]]) });
}

module.exports = { showAnalytics, showDetailedAnalytics, showDailyAnalytics, showTopUsers };
