#!/usr/bin/env python3
# patch_profile.py — يعيد كتابة profile كامل + animations
import re, os

TARGET = os.path.expanduser(
    '~/study-bot-backup-20260407_011636/public/app/index.html'
)

with open(TARGET, 'r', encoding='utf-8') as f:
    html = f.read()

# ══════════════════════════════════════════════════════════════
# 1. CSS — prof-av-wrap + rings + owner
# ══════════════════════════════════════════════════════════════
CSS_PROFILE = """
/* ══ PROFILE HERO ══ */
.prof-hero{
  position:relative;overflow:hidden;
  background:var(--s2,#111127);
  border:1px solid rgba(255,255,255,.06);
  border-radius:20px;padding:24px 16px 18px;
  text-align:center;margin-bottom:12px;
}
.prof-hero::before{
  content:'';position:absolute;inset:0;
  background:var(--hero-bg,linear-gradient(160deg,rgba(100,110,160,.04),transparent 70%));
  pointer-events:none;
}
/* AVATAR */
.prof-av-wrap{
  position:relative;display:flex;align-items:center;
  justify-content:center;width:fit-content;
  margin:0 auto 14px;
}
.prof-av{
  width:82px;height:82px;border-radius:50%;
  background:linear-gradient(135deg,#6c63ff,#c653ff);
  display:flex;align-items:center;justify-content:center;
  font-size:32px;font-weight:900;color:#fff;
  overflow:hidden;position:relative;z-index:1;
  box-shadow:0 6px 24px rgba(0,0,0,.35);
}
.prof-av img{width:100%;height:100%;object-fit:cover}
/* RINGS */
.av-ring{
  position:absolute;inset:-5px;border-radius:50%;
  border:2.5px solid transparent;pointer-events:none;z-index:2;
}
.av-ring2{
  position:absolute;inset:-12px;border-radius:50%;
  border:1.5px solid transparent;pointer-events:none;z-index:1;opacity:.4;
}
.av-ring.lv3{border-color:rgba(16,217,160,.55)}
.av-ring.lv4{border-color:rgba(157,125,255,.65);animation:rp 2.8s ease-in-out infinite}
.av-ring.lv5{border-color:rgba(255,140,66,.75);animation:rp 2.3s ease-in-out infinite}
.av-ring.lv6{border-color:rgba(0,212,255,.75);animation:rg 2.5s ease-in-out infinite}
.av-ring.lv7{border-color:rgba(157,125,255,.9);animation:rg 2s ease-in-out infinite;box-shadow:0 0 14px rgba(157,125,255,.35)}
.av-ring.lv8{animation:r8 2.2s linear infinite;box-shadow:0 0 14px rgba(16,217,160,.25)}
.av-ring.lv9{border-color:rgba(232,184,75,.95);animation:r9 1.6s ease-in-out infinite;box-shadow:0 0 20px rgba(232,184,75,.35)}
.av-ring.lv10{animation:r10 1.1s ease-in-out infinite;border-width:3px;box-shadow:0 0 30px rgba(232,184,75,.45)}
.av-ring.owner{border-width:3.5px;animation:rown 1.8s ease-in-out infinite;box-shadow:0 0 36px rgba(232,184,75,.6)}
.av-ring2.lv9{border-color:rgba(232,184,75,.4);animation:r9 2.4s ease-in-out infinite reverse}
.av-ring2.lv10,.av-ring2.owner{border-color:rgba(255,210,0,.5);animation:rown 2.6s ease-in-out infinite reverse}
@keyframes rp{0%,100%{opacity:.5}50%{opacity:1}}
@keyframes rg{0%,100%{box-shadow:0 0 6px rgba(0,212,255,.2)}50%{box-shadow:0 0 18px rgba(0,212,255,.5)}}
@keyframes r8{0%{border-color:rgba(16,217,160,.7)}33%{border-color:rgba(77,159,255,.7)}66%{border-color:rgba(157,125,255,.7)}100%{border-color:rgba(16,217,160,.7)}}
@keyframes r9{0%,100%{border-color:rgba(232,184,75,.7);box-shadow:0 0 14px rgba(232,184,75,.25)}50%{border-color:rgba(232,184,75,1);box-shadow:0 0 28px rgba(232,184,75,.5)}}
@keyframes r10{0%{border-color:rgba(232,184,75,.9)}33%{border-color:rgba(255,80,80,.85)}66%{border-color:rgba(157,125,255,.9)}100%{border-color:rgba(232,184,75,.9)}}
@keyframes rown{0%,100%{border-color:rgba(232,184,75,.9);box-shadow:0 0 22px rgba(232,184,75,.45)}50%{border-color:rgba(255,220,50,1);box-shadow:0 0 40px rgba(232,184,75,.7)}}
/* OWNER CROWN */
.owner-crown-wrap{margin-bottom:6px}
.owner-crown{font-size:22px;display:inline-block;animation:crwn 3s ease-in-out infinite;filter:drop-shadow(0 0 10px rgba(232,184,75,.7))}
@keyframes crwn{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-4px) rotate(3deg)}}
.owner-badge{
  display:inline-flex;align-items:center;gap:5px;
  background:linear-gradient(135deg,rgba(232,184,75,.18),rgba(255,140,66,.12));
  color:#e8b84b;border:1px solid rgba(232,184,75,.35);
  padding:4px 14px;border-radius:20px;font-size:11px;font-weight:800;
  margin-top:6px;letter-spacing:.4px;
}
.owner-pstats{
  background:rgba(232,184,75,.04);border:1px solid rgba(232,184,75,.1);
  border-radius:12px;padding:10px 14px;margin-top:10px;text-align:right;
}
.ops-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:11px}
.ops-row:last-child{border:none}
.ops-l{color:rgba(232,184,75,.55);font-size:10px;font-weight:600}
.ops-v{color:#e8b84b;font-weight:800}
/* PROFILE NAME */
.prof-name{font-size:20px;font-weight:900;text-align:center;margin-bottom:3px;letter-spacing:-.3px}
.prof-un{font-size:12px;color:var(--txt2,#8888bb);text-align:center;margin-bottom:4px}
.prof-sp{font-size:12px;color:var(--txt2,#8888bb);text-align:center;margin-bottom:8px}
/* LEVEL BADGE + XP */
.lv-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.lv-xp-txt{font-size:11px;font-weight:800;color:var(--txt2,#8888bb)}
.lv-sub{font-size:10px;color:var(--txt3,#44446a);margin-bottom:6px;text-align:center}
/* STATS */
.stats3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
.stat-box{background:var(--s2,#111127);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:11px 6px;text-align:center;position:relative;overflow:hidden}
.stat-box::before{content:'';position:absolute;top:0;left:0;right:0;height:2px}
.stat-box:nth-child(1)::before{background:linear-gradient(90deg,#10d9a0,#00d4ff)}
.stat-box:nth-child(2)::before{background:linear-gradient(90deg,#e8b84b,#ff8c42)}
.stat-box:nth-child(3)::before{background:linear-gradient(90deg,#9d7dff,#c653ff)}
.stat-val{font-size:22px;font-weight:900;line-height:1;margin-bottom:3px}
.stat-lbl{font-size:9px;color:var(--txt3,#44446a);font-weight:700;letter-spacing:.5px}
.stats2{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}
.stat-box2{background:var(--s2,#111127);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:10px 6px;text-align:center}
.sv2{font-size:18px;font-weight:900;line-height:1;margin-bottom:2px}
.sl2{font-size:9px;color:var(--txt3,#44446a);font-weight:700}
/* PARTICLES */
.particles{position:absolute;inset:0;pointer-events:none;overflow:hidden;border-radius:inherit}
.p-dot{position:absolute;border-radius:50%;opacity:0;animation:pdot 4s ease-in-out infinite}
.p-dot:nth-child(1){width:3px;height:3px;left:10%;animation-delay:0s;animation-duration:3.5s}
.p-dot:nth-child(2){width:2px;height:2px;left:30%;animation-delay:.7s;animation-duration:4.2s}
.p-dot:nth-child(3){width:4px;height:4px;left:52%;animation-delay:1.5s;animation-duration:3.8s}
.p-dot:nth-child(4){width:2px;height:2px;left:70%;animation-delay:2.2s;animation-duration:4.5s}
.p-dot:nth-child(5){width:3px;height:3px;left:88%;animation-delay:1.1s;animation-duration:3.2s}
@keyframes pdot{0%{opacity:0;transform:translateY(70px) scale(0)}20%{opacity:.9}80%{opacity:.4}100%{opacity:0;transform:translateY(-10px) scale(1.5)}}
.lv7-p .p-dot{background:rgba(157,125,255,.8)}
.lv8-p .p-dot{background:rgba(16,217,160,.8)}
.lv9-p .p-dot,.lv10-p .p-dot,.owner-p .p-dot{background:rgba(232,184,75,.9)}
/* BADGES SECTION */
.badges-grid{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:14px}
.badge-item{display:flex;flex-direction:column;align-items:center;gap:3px;width:56px}
.badge-ico{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;border:2px solid transparent;transition:all .2s}
.badge-ico.on{background:rgba(232,184,75,.1);border-color:rgba(232,184,75,.35);box-shadow:0 0 10px rgba(232,184,75,.15)}
.badge-ico.off{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.06);filter:grayscale(1);opacity:.4}
.badge-nm{font-size:9px;color:var(--txt3,#44446a);text-align:center;font-weight:600}
"""

# inject before </style>
if '.prof-hero{' not in html:
    html = html.replace('</style>', CSS_PROFILE + '\n</style>', 1)
    print("✅ Profile CSS injected")
else:
    print("⚠️  Profile CSS already there")

# ══════════════════════════════════════════════════════════════
# 2. JS — LEVELS + helper functions before NAV
# ══════════════════════════════════════════════════════════════
JS_LEVELS = """
/* ══ XP LEVEL SYSTEM ══ */
const LEVELS=[
  {lv:1, min:0,     max:99,    n:'مبتدئ',    i:'🌱',c:'lv1',col:'#8899cc'},
  {lv:2, min:100,   max:299,   n:'طالب',      i:'📖',c:'lv2',col:'#4d9fff'},
  {lv:3, min:300,   max:599,   n:'متعلم',     i:'🎓',c:'lv3',col:'#10d9a0'},
  {lv:4, min:600,   max:1199,  n:'متقدم',     i:'🔬',c:'lv4',col:'#9d7dff'},
  {lv:5, min:1200,  max:2499,  n:'نشيط',      i:'⚡',c:'lv5',col:'#ff8c42'},
  {lv:6, min:2500,  max:4999,  n:'محترف',     i:'💎',c:'lv6',col:'#00d4ff'},
  {lv:7, min:5000,  max:9999,  n:'خبير',      i:'🚀',c:'lv7',col:'#9d7dff'},
  {lv:8, min:10000, max:19999, n:'نخبة',      i:'🌌',c:'lv8',col:'#10d9a0'},
  {lv:9, min:20000, max:49999, n:'أسطوري',    i:'👑',c:'lv9',col:'#e8b84b'},
  {lv:10,min:50000, max:Infinity,n:'أسطوري XL',i:'🏆',c:'lv10',col:'#e8b84b'},
];
const BADGES=[
  {i:'🗣',n:'ناشط اجتماعي',q:(p,r)=>(p?.cmtCount||0)>=5},
  {i:'💬',n:'أول تعليق',   q:(p,r)=>(p?.cmtCount||0)>=1},
  {i:'🚀',n:'محمل نشيط',   q:(p,r)=>(p?.dlCount||0)>=20},
  {i:'📦',n:'10 تحميلات',  q:(p,r)=>(p?.dlCount||0)>=10},
  {i:'⬇️', n:'أول تحميل',  q:(p,r)=>(p?.dlCount||0)>=1},
  {i:'🏆',n:'Top 10',       q:(p,r)=>r<=10},
  {i:'💎',n:'XP 100',       q:(p,r)=>(p?.xp||0)>=100},
  {i:'🔥',n:'7 أيام',       q:(p,r)=>(p?.streak||0)>=7},
  {i:'⭐',n:'مقيّم',        q:(p,r)=>(p?.favCount||0)>=3},
];
function getLevel(xp){for(let i=LEVELS.length-1;i>=0;i--)if(xp>=LEVELS[i].min)return{idx:i,...LEVELS[i]};return{idx:0,...LEVELS[0]};}
function xpPct(xp){const l=getLevel(xp);if(l.lv===10)return 100;const nx=LEVELS[l.idx+1];return Math.round(((xp-l.min)/(nx.min-l.min))*100);}
function getHeroBg(lv,isOwner){
  if(isOwner)return'linear-gradient(160deg,rgba(232,184,75,.08),transparent 65%)';
  const m={lv1:'rgba(100,110,160,.04)',lv2:'rgba(77,159,255,.05)',lv3:'rgba(16,217,160,.07)',
    lv4:'rgba(157,125,255,.07)',lv5:'rgba(255,140,66,.07)',lv6:'rgba(0,212,255,.08)',
    lv7:'rgba(157,125,255,.09)',lv8:'rgba(16,217,160,.08)',lv9:'rgba(232,184,75,.09)',lv10:'rgba(232,184,75,.12)'};
  return`linear-gradient(160deg,${m[lv.c]||m.lv1},transparent 65%)`;
}
"""

if 'function getLevel' not in html:
    # inject before NAV object
    html = html.replace('const NAV = {', JS_LEVELS + '\nconst NAV = {', 1)
    print("✅ LEVELS + helper JS injected")
else:
    print("⚠️  LEVELS already present")

# ══════════════════════════════════════════════════════════════
# 3. Rewrite profile() function
# ══════════════════════════════════════════════════════════════
OLD_PROFILE = re.compile(
    r"async profile\(\)\s*\{.*?(?=,\s*/\*\s*══|,\s*async admin\b)",
    re.DOTALL
)

NEW_PROFILE = r"""async profile() {
    loader();
    try {
      _profile = await API.get('/profile');
      const p = _profile;
      _isAdmin = p.isAdmin; _isOwner = p.isOwner;
      if (_isAdmin||_isOwner) injectAdminTab();

      // XP data
      let xpData = {xp:0,level:1,rank:999};
      try { xpData = await API.get('/xp/me'); } catch(_) {}
      // daily XP claim
      API.post('/xp/daily',{}).catch(()=>{});

      const xp   = xpData.xp || p.totalPoints || 0;
      const rank = xpData.rank || 999;
      const lv   = getLevel(xp);
      const pct  = xpPct(xp);
      const nx   = lv.lv < 10 ? LEVELS[lv.idx+1] : null;
      const xpLbl  = nx ? `${xp.toLocaleString('ar')} / ${nx.min.toLocaleString('ar')} XP` : `${xp.toLocaleString('ar')} XP 👑`;
      const xpSub  = nx ? `باقي ${(nx.min-xp).toLocaleString('ar')} XP للمستوى ${lv.lv+1}` : 'المستوى الأعلى 👑';
      const xpCls  = 'xp-' + (p.isOwner ? 'owner' : lv.c);
      const heroBg = getHeroBg(lv, p.isOwner);

      // avatar
      const photoHtml = TG.photo_url
        ? `<img src="${esc(TG.photo_url)}" alt="avatar" onerror="this.parentNode.innerHTML='${(TG.first_name||'?')[0].toUpperCase()}'">`
        : (TG.first_name||'?')[0].toUpperCase();

      // ring
      const showRing  = lv.lv >= 3 || p.isOwner;
      const showRing2 = lv.lv >= 9 || p.isOwner;
      const ringCls   = p.isOwner ? 'owner' : lv.c;
      const ringHtml  = showRing
        ? `<div class="av-ring ${ringCls}"></div>${showRing2?`<div class="av-ring2 ${ringCls}"></div>`:''}`
        : '';

      // particles
      const ptcHtml = (lv.lv >= 7 || p.isOwner)
        ? `<div class="particles ${p.isOwner?'owner-p':'lv'+lv.lv+'-p'}">${'<div class="p-dot"></div>'.repeat(5)}</div>`
        : '';

      // owner special section
      let ownerSection = '';
      if (p.isOwner) {
        let ownerStats = {users:'—',files:'—'};
        try { const s=await API.get('/admin/stats'); ownerStats={users:s.users||'—',files:s.files||'—'}; } catch(_) {}
        ownerSection = `
          <div class="owner-crown-wrap"><span class="owner-crown">👑</span></div>
          <div class="owner-badge">👑 مالك المنصة</div>
          <div class="owner-pstats">
            <div class="ops-row"><span class="ops-l">👥 المستخدمون</span><span class="ops-v">${ownerStats.users}</span></div>
            <div class="ops-row"><span class="ops-l">📄 الملفات</span><span class="ops-v">${ownerStats.files}</span></div>
            <div class="ops-row"><span class="ops-l">🆔 المعرف</span><span class="ops-v">${TG.id||'—'}</span></div>
          </div>`;
      } else if (p.isAdmin) {
        ownerSection = `<div style="display:flex;justify-content:center;margin-top:4px"><div class="badge-admin">🛡️ Admin</div></div>`;
      }

      // badges
      const pForBadge = {...p, xp, streak: xpData.streak_days||0};
      const bdgHtml = BADGES.map(b=>{
        const on = b.q(pForBadge, rank);
        return `<div class="badge-item">
          <div class="badge-ico ${on?'on':'off'}">${b.i}</div>
          <div class="badge-nm">${b.n}</div>
        </div>`;
      }).join('');

      // favs
      let favs=[];
      try { favs = await API.get('/favorites'); } catch(_) {}
      const favHtml = favs.slice(0,5).map(f=>`
        <div class="fc" onclick='NAV.go("preview",{fileId:${f.id}},"📄 ${esc(f.title.substring(0,22))}")'>
          <div class="fc-ico">${typeIco(f.file_type)}</div>
          <div class="fc-body">
            <div class="fc-ttl">${esc(f.title)}</div>
            <div class="fc-meta"><span>⬇️ ${f.downloads||0}</span></div>
          </div>
          <button style="background:none;border:none;color:#ff4d6d;font-size:18px;cursor:pointer;padding:4px;flex-shrink:0"
            onclick="event.stopPropagation();toggleFav(${f.id},true)">🗑</button>
        </div>`).join('');

      render(`
        <div class="prof-hero ${p.isOwner?'owner-hero':''}" style="--hero-bg:${heroBg}">
          ${ptcHtml}
          <div class="prof-av-wrap">
            <div class="prof-av">${photoHtml}</div>
            ${ringHtml}
          </div>
          <div class="prof-name">${esc(TG.first_name||'')} ${esc(TG.last_name||'')}</div>
          ${TG.username?`<div class="prof-un">@${esc(TG.username)}</div>`:''}
          <div class="prof-sp">🎓 ${p.specialty?esc(p.specialty.name):'غير محدد'}</div>
          ${ownerSection}
          <div style="margin-top:12px" class="${xpCls}">
            <div class="lv-row">
              <span class="lvbg ${lv.c}">${lv.i} ${lv.n} · Lv.${lv.lv}</span>
              <span class="lv-xp-txt">${xpLbl}</span>
            </div>
            <div class="lv-sub">${xpSub}</div>
            <div class="xpw"><div class="xpf" style="width:${pct}%"></div></div>
          </div>
        </div>

        <div class="stats3">
          <div class="stat-box"><div class="stat-val" style="color:#10d9a0">${p.dlCount||0}</div><div class="stat-lbl">📥 تحميل</div></div>
          <div class="stat-box"><div class="stat-val" style="color:#e8b84b">${p.favCount||0}</div><div class="stat-lbl">⭐ مفضلة</div></div>
          <div class="stat-box"><div class="stat-val" style="color:#9d7dff">${p.cmtCount||0}</div><div class="stat-lbl">💬 تعليق</div></div>
        </div>
        <div class="stats2">
          <div class="stat-box2"><div class="sv2" style="color:#e8b84b">${xp.toLocaleString('ar')}</div><div class="sl2">✨ XP</div></div>
          <div class="stat-box2"><div class="sv2" style="color:#c653ff">#${rank}</div><div class="sl2">🏅 ترتيب</div></div>
          <div class="stat-box2"><div class="sv2" style="color:#ff8c42">${xpData.streak_days||0}🔥</div><div class="sl2">يوم متواصل</div></div>
        </div>

        <div class="sec">
          <div class="sec-lbl">🏅 الإنجازات (${BADGES.filter(b=>b.q(pForBadge,rank)).length}/${BADGES.length})</div>
          <div class="badges-grid">${bdgHtml}</div>
        </div>

        ${favs.length?`
        <div class="sec">
          <div class="sec-lbl">⭐ آخر المفضلة</div>
          <div class="g1">${favHtml}</div>
        </div>`:''}

        ${(p.isAdmin||p.isOwner)?`
        <div class="divider"></div>
        <button class="btn btn-gd" onclick="NAV.tab('admin')">🛡️ الدخول إلى لوحة الإدارة</button>`:''}
      `);
    } catch(e) { toast('خطأ في تحميل الملف الشخصي', 'err'); }
  },"""

match = OLD_PROFILE.search(html)
if match:
    html = html[:match.start()] + NEW_PROFILE + '\n\n  ' + html[match.end():]
    print("✅ profile() function rewritten")
else:
    print("❌ profile() not found — trying alternate pattern")
    # Try simpler pattern
    alt = re.compile(r"async profile\(\) \{.*?catch\(e\) \{ toast\('خطأ في تحميل الملف الشخصي', 'err'\); \}\s*\},", re.DOTALL)
    m2 = alt.search(html)
    if m2:
        html = html[:m2.start()] + NEW_PROFILE + '\n\n  ' + html[m2.end():]
        print("✅ profile() rewritten (alt pattern)")
    else:
        print("❌ Could not find profile() — please check manually")

# ══════════════════════════════════════════════════════════════
# 4. owner-hero CSS variable support
# ══════════════════════════════════════════════════════════════
if '.owner-hero{' not in html:
    html = html.replace(
        '.owner-crown-wrap{',
        '.owner-hero{background:linear-gradient(160deg,rgba(232,184,75,.07),transparent 65%) !important;border-color:rgba(232,184,75,.2) !important}\n.owner-crown-wrap{',
        1
    )

# ══════════════════════════════════════════════════════════════
# Save
# ══════════════════════════════════════════════════════════════
with open(TARGET, 'w', encoding='utf-8') as f:
    f.write(html)

print("\n" + "="*45)
print("✅ Done! Now run:")
print("  cd ~/study-bot-backup-20260407_011636")
print("  git add public/app/index.html")
print('  git commit -m "feat: fire profile redesign + XP animations"')
print("  git push origin main")
