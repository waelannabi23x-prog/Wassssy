'use strict';
const ALIASES = {
  'algo':['algorithme','algorithmes','algorithmique','خوارزميات'],
  'alg':['algorithme','algorithmes','algèbre','جبر'],
  'algebre':['algèbre','جبر'],
  'analyse':['analyse','تحليل'],
  'proba':['probabilités','probabilite','احتمالات'],
  'stat':['statistiques','statistique','إحصاء'],
  'archi':['architecture','معمارية'],
  'ro':['recherche opérationnelle','بحث عملياتي'],
  'rof':['recherche opérationnelle','بحث عملياتي'],
  'poo':['programmation orientée objet','oop','objet'],
  'prog':['programmation','برمجة'],
  'math':['mathématiques','رياضيات','maths'],
  'phy':['physique','فيزياء'],
  'elec':['électronique','électricité','الكترونيك'],
  'reseau':['réseau','réseaux','شبكات'],
  'bd':['base de données','قاعدة بيانات','sql'],
  'bdd':['base de données','قاعدة بيانات','sql'],
  'sgbd':['sgbd','base de données','sql'],
  'signal':['traitement du signal','معالجة الاشارة'],
  'ia':['intelligence artificielle','ذكاء اصطناعي'],
  'sys':['système','systèmes','نظم'],
  'se':['système exploitation','نظام التشغيل'],
  'tlc':['télécommunications','اتصالات'],
  'genie':['génie','هندسة'],
  'serie':['série','séries','series','exercices','td'],
  'series':['série','séries','exercices'],
  'td':['travaux dirigés','série','exercices','td'],
  'tp':['travaux pratiques','tp','pratique'],
  'cc':['contrôle continu','controle','interrogation'],
  'exam':['examen','امتحان','اختبار'],
  'ds':['devoir surveillé','devoir'],
  'poly':['polycopié','cours'],
  'cours':['cours','polycopié','محاضرة'],
  'correction':['corrigé','correction','حل','تصحيح'],
  'corrige':['corrigé','correction','حل'],
  'sol':['solution','corrigé','حل'],
  'resume':['résumé','ملخص'],
  'fiche':['fiche','ورقة مراجعة'],
  'qcm':['qcm','choix multiple'],
  'خوارزميات':['algorithme','algorithmes','algo'],
  'محاضرة':['cours','polycopié','poly'],
  'سلسلة':['série','series','td','exercices'],
  'امتحان':['examen','exam'],
  'تمارين':['exercices','td','série','serie'],
  'حل':['correction','corrigé','solution'],
  'ملخص':['résumé','resume'],
};
const _RX_DIAC  = /[\u0300-\u036f]/g;
const _RX_PUNCT = /[^\w\s\u0600-\u06ff]/g;
const _RX_SPACE = /\s+/g;
const _RX_SANIT = /[%;\\<>'"]/g;
const _RX_SPLIT = /[\s,_\-.]+/;
const _RX_NUMTK = /^([a-zA-Z\u0600-\u06ff]+)(\d+)$/;
function normalize(s){return(s||'').toLowerCase().normalize('NFD').replace(_RX_DIAC,'').replace(_RX_PUNCT,' ').replace(_RX_SPACE,' ').trim();}
function parseQuery(rawQ){
  if(!rawQ)return{terms:[],raw:''};
  const q=rawQ.replace(_RX_SANIT,'').trim().slice(0,100);
  const tokens=[];
  for(const tok of q.split(_RX_SPLIT).filter(t=>t.length>=1)){
    const m=tok.match(_RX_NUMTK);
    if(m){tokens.push(m[1].toLowerCase(),m[2]);}
    else tokens.push(tok.toLowerCase());
  }
  const termSet=new Set();
  for(const tok of tokens){
    const norm=normalize(tok);
    termSet.add(norm);
    const expns=ALIASES[tok]||ALIASES[norm];
    if(expns)expns.slice(0,3).forEach(a=>termSet.add(normalize(a)));
  }
  const terms=[...termSet].filter(t=>t.length>=1);
  return{terms,raw:tokens.join(' ')};
}
function scoreFile(file,terms){
  const title=normalize(file.title),sub=normalize(file.sub_name||''),cat=normalize(file.cat_name||'');
  const full=title+' '+sub+' '+cat;
  // precompute normalized terms once
  const nterms=terms.map(t=>normalize(t)).filter(Boolean);
  let score=0;
  for(const t of nterms){
    if(title===t){score+=30;continue;}
    if(title.includes(t)){score+=title.startsWith(t)?12:7;}
    if(sub.includes(t)){score+=4;}
    if(cat.includes(t)){score+=2;}
  }
  if(nterms.length>1&&nterms.every(t=>full.includes(t)))score+=15;
  score+=Math.min(Math.log10((file.downloads||0)+1)*2,4);
  return score;
}
module.exports={parseQuery,scoreFile,normalize};
