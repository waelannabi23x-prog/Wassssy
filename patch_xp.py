#!/usr/bin/env python3
# patch_xp.py — شغّله مرة واحدة يعدل index.html تلقائياً
import re, os, sys

TARGET = os.path.expanduser(
    '~/study-bot-backup-20260407_011636/public/app/index.html'
)

with open(TARGET, 'r', encoding='utf-8') as f:
    html = f.read()

original_size = len(html)
changes = 0

# ─── 1. LEVELS array (6 → 10) ─────────────────────────────────────────
p1_old = re.compile(
    r"const LEVELS=\[.*?\];",
    re.DOTALL
)
p1_new = """const LEVELS=[
  {lv:1, min:0,     max:99,    n:'مبتدئ',    i:'🌱',c:'lv1'},
  {lv:2, min:100,   max:299,   n:'طالب',      i:'📖',c:'lv2'},
  {lv:3, min:300,   max:599,   n:'متعلم',     i:'🎓',c:'lv3'},
  {lv:4, min:600,   max:1199,  n:'متقدم',     i:'🔬',c:'lv4'},
  {lv:5, min:1200,  max:2499,  n:'نشيط',      i:'⚡',c:'lv5'},
  {lv:6, min:2500,  max:4999,  n:'محترف',     i:'💎',c:'lv6'},
  {lv:7, min:5000,  max:9999,  n:'خبير',      i:'🚀',c:'lv7'},
  {lv:8, min:10000, max:19999, n:'نخبة',      i:'🌌',c:'lv8'},
  {lv:9, min:20000, max:49999, n:'أسطوري',    i:'👑',c:'lv9'},
  {lv:10,min:50000, max:Infinity,n:'أسطوري XL',i:'🏆',c:'lv10'},
];"""
new_html, n = p1_old.subn(p1_new, html, count=1)
if n: html = new_html; changes += 1; print("✅ LEVELS array updated (10 levels)")
else: print("⚠️  LEVELS array not found")

# ─── 2. lvl() + xpPct() functions ─────────────────────────────────────
p2_old = re.compile(
    r"function lvl\(pts\)\{.*?\}function xpPct\(pts\)\{.*?\}"
)
p2_new = ("function lvl(pts){for(let i=LEVELS.length-1;i>=0;i--)if(pts>=LEVELS[i].min)return{idx:i,...LEVELS[i]};return{idx:0,...LEVELS[0]};}"
          "function xpPct(pts){const l=lvl(pts);if(l.lv===10)return 100;const nx=LEVELS[l.idx+1];return Math.round(((pts-l.min)/(nx.min-l.min))*100);}")
new_html, n = p2_old.subn(p2_new, html, count=1)
if n: html = new_html; changes += 1; print("✅ lvl() + xpPct() fixed")
else: print("⚠️  lvl/xpPct not found")

# ─── 3. CSS: level badges + av-ring + particles + xp bar + owner ───────
CSS_INJECT = """
/* ══ XP LEVEL ANIMATIONS ══ */
.lvbg{display:inline-flex;align-items:center;gap:5px;padding:3px 11px;border-radius:20px;font-size:10px;font-weight:800}
.lv1{background:rgba(160,160,190,.1);color:#8888bb;border:1px solid rgba(100,100,160,.2)}
.lv2{background:rgba(77,159,255,.1);color:#4d9fff;border:1px solid rgba(77,159,255,.2)}
.lv3{background:rgba(16,217,160,.1);color:#10d9a0;border:1px solid rgba(16,217,160,.2);animation:lv3p 3s infinite}
.lv4{background:rgba(157,125,255,.1);color:#9d7dff;border:1px solid rgba(157,125,255,.2);animation:lvgl 2.5s infinite}
.lv5{background:rgba(255,140,66,.1);color:#ff8c42;border:1px solid rgba(255,140,66,.25);animation:lvgl 2.2s infinite}
.lv6{background:linear-gradient(135deg,rgba(0,212,255,.1),rgba(157,125,255,.1));color:#00d4ff;border:1px solid rgba(0,212,255,.25);animation:lv6s 3s infinite}
.lv7{background:linear-gradient(135deg,rgba(157,125,255,.12),rgba(255,82,82,.08));color:#9d7dff;border:1px solid rgba(157,125,255,.3);animation:lv7p 2s infinite}
.lv8{background:linear-gradient(135deg,rgba(16,217,160,.1),rgba(0,100,255,.12));color:#10d9a0;border:1px solid rgba(16,217,160,.3);animation:lv8g 4s linear infinite}
.lv9{background:linear-gradient(135deg,rgba(232,184,75,.15),rgba(255,140,66,.1));color:#e8b84b;border:1px solid rgba(232,184,75,.4);animation:lv9a 2s infinite}
.lv10{background:linear-gradient(135deg,rgba(232,184,75,.2),rgba(255,82,82,.1),rgba(157,125,255,.15));color:#e8b84b;border:1px solid rgba(232,184,75,.5);animation:lv10c 1.5s infinite}
@keyframes lv3p{0%,100%{opacity:1}50%{opacity:.7}}
@keyframes lvgl{0%,100%{box-shadow:none}50%{box-shadow:0 0 8px rgba(157,125,255,.3)}}
@keyframes lv6s{0%,100%{border-color:rgba(0,212,255,.25)}50%{border-color:rgba(157,125,255,.4)}}
@keyframes lv7p{0%,100%{transform:scale(1)}50%{transform:scale(1.04);box-shadow:0 0 12px rgba(157,125,255,.25)}}
@keyframes lv8g{0%{border-color:rgba(16,217,160,.3)}33%{border-color:rgba(77,159,255,.4)}66%{border-color:rgba(157,125,255,.4)}100%{border-color:rgba(16,217,160,.3)}}
@keyframes lv9a{0%,100%{box-shadow:none}50%{box-shadow:0 0 14px rgba(232,184,75,.25)}}
@keyframes lv10c{0%{box-shadow:0 0 8px rgba(232,184,75,.2)}33%{box-shadow:0 0 16px rgba(255,82,82,.25)}66%{box-shadow:0 0 16px rgba(157,125,255,.3)}100%{box-shadow:0 0 8px rgba(232,184,75,.2)}}
/* AVATAR RING */
.av-wrap{position:relative;display:flex;align-items:center;justify-content:center;width:fit-content;margin:0 auto 12px}
.av-wrap .av{margin:0}
.av-ring{position:absolute;inset:-4px;border-radius:50%;border:2.5px solid transparent;pointer-events:none;z-index:2}
.av-ring.lv3{border-color:rgba(16,217,160,.5)}
.av-ring.lv4{border-color:rgba(157,125,255,.6);animation:rp 2.8s ease-in-out infinite}
.av-ring.lv5{border-color:rgba(255,140,66,.7);animation:rp 2.4s ease-in-out infinite}
.av-ring.lv6{border-color:rgba(0,212,255,.7);animation:rg 2.5s ease-in-out infinite;box-shadow:0 0 8px rgba(0,212,255,.2)}
.av-ring.lv7{border-color:rgba(157,125,255,.85);animation:rg 2s ease-in-out infinite;box-shadow:0 0 14px rgba(157,125,255,.3)}
.av-ring.lv8{animation:r8 2.5s linear infinite;box-shadow:0 0 12px rgba(16,217,160,.2)}
.av-ring.lv9{border-color:rgba(232,184,75,.9);animation:r9 1.6s ease-in-out infinite;box-shadow:0 0 18px rgba(232,184,75,.3)}
.av-ring.lv10{animation:r10 1.2s ease-in-out infinite;border-width:3px;box-shadow:0 0 28px rgba(232,184,75,.4)}
.av-ring.owner{border-width:3.5px;animation:rown 1.8s ease-in-out infinite;box-shadow:0 0 32px rgba(232,184,75,.55)}
.av-ring2{position:absolute;inset:-10px;border-radius:50%;border:1px solid transparent;pointer-events:none;z-index:1;opacity:.4}
.av-ring2.lv9{border-color:rgba(232,184,75,.4);animation:r9 2.4s ease-in-out infinite reverse}
.av-ring2.lv10,.av-ring2.owner{border-color:rgba(255,220,50,.5);animation:r10 1.8s ease-in-out infinite reverse}
@keyframes rp{0%,100%{opacity:.5}50%{opacity:1}}
@keyframes rg{0%,100%{box-shadow:0 0 6px rgba(0,212,255,.2)}50%{box-shadow:0 0 16px rgba(0,212,255,.5)}}
@keyframes r8{0%{border-color:rgba(16,217,160,.7)}33%{border-color:rgba(77,159,255,.7)}66%{border-color:rgba(157,125,255,.7)}100%{border-color:rgba(16,217,160,.7)}}
@keyframes r9{0%,100%{border-color:rgba(232,184,75,.7);box-shadow:0 0 12px rgba(232,184,75,.2)}50%{border-color:rgba(232,184,75,1);box-shadow:0 0 24px rgba(232,184,75,.45)}}
@keyframes r10{0%{border-color:rgba(232,184,75,.9)}33%{border-color:rgba(255,82,82,.8)}66%{border-color:rgba(157,125,255,.9)}100%{border-color:rgba(232,184,75,.9)}}
@keyframes rown{0%,100%{border-color:rgba(232,184,75,.9);box-shadow:0 0 20px rgba(232,184,75,.4)}50%{border-color:rgba(255,220,50,1);box-shadow:0 0 36px rgba(232,184,75,.6)}}
/* XP BAR */
.xpw{background:rgba(255,255,255,.06);border-radius:6px;height:7px;overflow:hidden;position:relative;margin-top:10px}
.xpf{height:100%;background:linear-gradient(90deg,#10d9a0,#e8b84b);border-radius:6px;transition:width 1.1s cubic-bezier(.4,0,.2,1);position:relative}
.xpf::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,.4) 50%,transparent 100%);animation:shine 2s infinite}
.xp-lv1 .xpf,.xp-lv2 .xpf{background:linear-gradient(90deg,#6b7db3,#8899cc)}
.xp-lv3 .xpf{background:linear-gradient(90deg,#10d9a0,#0ab88a)}
.xp-lv4 .xpf{background:linear-gradient(90deg,#9d7dff,#7b5de0)}
.xp-lv5 .xpf{background:linear-gradient(90deg,#ff8c42,#e06820)}
.xp-lv6 .xpf{background:linear-gradient(90deg,#00d4ff,#9d7dff)}
.xp-lv7 .xpf{background:linear-gradient(90deg,#9d7dff,#ff5252,#9d7dff);background-size:200%;animation:xpfl 2s linear infinite}
.xp-lv8 .xpf{background:linear-gradient(90deg,#10d9a0,#4d9fff,#9d7dff);background-size:200%;animation:xpfl 2.5s linear infinite}
.xp-lv9 .xpf,.xp-lv10 .xpf,.xp-owner .xpf{background:linear-gradient(90deg,#e8b84b,#ff8c42,#e8b84b,#ffcc00);background-size:300%;animation:xpgold 1.8s linear infinite}
@keyframes xpfl{0%{background-position:0%}100%{background-position:200%}}
@keyframes xpgold{0%{background-position:0%}100%{background-position:300%}}
/* PARTICLES */
.particles{position:absolute;inset:0;pointer-events:none;overflow:hidden;border-radius:inherit}
.p-dot{position:absolute;border-radius:50%;opacity:0;animation:pdot 4s ease-in-out infinite}
.p-dot:nth-child(1){width:3px;height:3px;left:15%;animation-delay:0s;animation-duration:3.5s}
.p-dot:nth-child(2){width:2px;height:2px;left:35%;animation-delay:.8s;animation-duration:4.2s}
.p-dot:nth-child(3){width:4px;height:4px;left:55%;animation-delay:1.6s;animation-duration:3.8s}
.p-dot:nth-child(4){width:2px;height:2px;left:72%;animation-delay:2.4s;animation-duration:4.5s}
.p-dot:nth-child(5){width:3px;height:3px;left:85%;animation-delay:1.2s;animation-duration:3.2s}
@keyframes pdot{0%{opacity:0;transform:translateY(60px) scale(0)}20%{opacity:.8}80%{opacity:.4}100%{opacity:0;transform:translateY(-20px) scale(1.5)}}
.lv7-p .p-dot{background:rgba(157,125,255,.7)}
.lv8-p .p-dot{background:rgba(16,217,160,.7)}
.lv9-p .p-dot,.lv10-p .p-dot,.owner-p .p-dot{background:rgba(232,184,75,.8)}
/* OWNER */
.owner-hero{background:linear-gradient(160deg,rgba(232,184,75,.07),var(--ink2,#0a0a14) 70%) !important;border-color:rgba(232,184,75,.2) !important}
.owner-crown{font-size:20px;animation:cb 3s ease-in-out infinite;filter:drop-shadow(0 0 8px rgba(232,184,75,.6));display:inline-block}
@keyframes cb{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
.owner-badge{background:linear-gradient(135deg,rgba(232,184,75,.15),rgba(255,140,66,.1));color:#e8b84b;border:1px solid rgba(232,184,75,.3);padding:3px 12px;border-radius:20px;font-size:10px;font-weight:800}
.owner-pstats{background:rgba(232,184,75,.04);border:1px solid rgba(232,184,75,.1);border-radius:10px;padding:10px;margin-top:8px}
.ops-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:11px}
.ops-row:last-child{border:none}
.ops-l{color:rgba(232,184,75,.5);font-size:10px}.ops-v{color:#e8b84b;font-weight:800}
/* LEVEL-UP TOAST */
@keyframes lvlup{0%{opacity:0;transform:translateX(-50%) scale(.5)}30%{opacity:1;transform:translateX(-50%) scale(1.1)}70%{opacity:1;transform:translateX(-50%) scale(1)}100%{opacity:0;transform:translateX(-50%) scale(.9) translateY(-20px)}}
.lvlup-toast{position:fixed;top:30%;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,rgba(232,184,75,.15),rgba(255,140,66,.1));border:1px solid rgba(232,184,75,.4);border-radius:16px;padding:14px 24px;text-align:center;z-index:9999;animation:lvlup 2.5s ease-in-out forwards;pointer-events:none;backdrop-filter:blur(12px)}
.lvlup-toast .li{font-size:28px;margin-bottom:4px}
.lvlup-toast .lt{font-size:13px;font-weight:800;color:#e8b84b}
.lvlup-toast .ls{font-size:11px;color:#8888bb;margin-top:2px}
"""

# inject before </style>
if CSS_INJECT.strip()[:20] not in html:
    html = html.replace('</style>', CSS_INJECT + '\n</style>', 1)
    changes += 1
    print("✅ CSS animations injected")
else:
    print("⚠️  CSS already injected")

# ─── 4. JS: showLevelUp + checkLevelUp ────────────────────────────────
JS_INJECT = """
function showLevelUp(li){
  const el=document.createElement('div');el.className='lvlup-toast';
  el.innerHTML=`<div class="li">${li.i||'🎉'}</div><div class="lt">ترقيت للمستوى ${li.lv}!</div><div class="ls">${li.n}</div>`;
  document.body.appendChild(el);
  try{Telegram.WebApp.HapticFeedback.notificationOccurred('success');}catch(_){}
  setTimeout(()=>{if(el.parentNode)el.parentNode.removeChild(el);},2600);
}
async function checkLevelUp(){
  try{
    const prev=parseInt(localStorage.getItem('_lv')||'0');
    const d=await API.get('/xp/me').catch(()=>null);
    if(!d)return;
    const cur=d.level||1;
    if(prev>0&&cur>prev){setTimeout(()=>showLevelUp(LEVELS[cur-1]||{lv:cur,n:'',i:'🎉'}),800);}
    localStorage.setItem('_lv',cur);
  }catch(_){}
}
"""
if 'checkLevelUp' not in html:
    html = html.replace('</script>', JS_INJECT + '\n</script>', 1)
    changes += 1
    print("✅ Level-up JS injected")
else:
    print("⚠️  Level-up JS already present")

# ─── 5. Fix av container → av-wrap ────────────────────────────────────
# Find profile hero avatar div and wrap it
AV_OLD = re.compile(
    r'(<div class="av av-lg"[^>]*>.*?</div>)\s*'
    r'(\$\{lv\.(?:idx|lv)>=\d\|\|isOwner\?`<div[^`]+av-ring[^`]+`\s*:\s*\'\'[^}]*\})',
    re.DOTALL
)
def av_replacer(m):
    av_div = m.group(1)
    ring   = m.group(2)
    return (
        '<div class="av-wrap">\n'
        '          ' + av_div + '\n'
        '          ' + ring + '\n'
        '          ${lv.lv>=9||isOwner?`<div class="av-ring2 ${isOwner?\'owner\':lv.c}"></div>`:\'\'}\n'
        '        </div>'
    )
new_html, n = AV_OLD.subn(av_replacer, html, count=1)
if n:
    html = new_html; changes += 1
    print("✅ av-wrap added")
else:
    print("⚠️  av-wrap pattern not matched (may already exist or different structure)")

# ─── 6. XP display: add xpLabel + xpSubLabel + xp class ──────────────
XP_OLD = re.compile(
    r"(const lv=lvl\(tpts\);const xp=xpPct\(tpts\);)\s*"
    r"(const myRank[^\n]+)\s*"
    r"(const nextLv[^\n]+)",
    re.MULTILINE
)
XP_NEW = (
    r"\1\n"
    r"    \2\n"
    r"    \3\n"
    r"    const xpLabel=lv.lv<10?`${tpts.toLocaleString('ar')} / ${nextLv.min.toLocaleString('ar')} XP`:`${tpts.toLocaleString('ar')} XP 👑`;\n"
    r"    const xpSubLabel=lv.lv<10?`باقي ${(nextLv.min-tpts).toLocaleString('ar')} XP للمستوى ${lv.lv+1}`:'المستوى الأعلى 👑';\n"
    r"    const xpCls='xp-'+(isOwner?'owner':lv.c);\n"
    r"    const heroBgMap={lv1:'rgba(100,110,160,.04)',lv2:'rgba(77,159,255,.05)',lv3:'rgba(16,217,160,.07)',lv4:'rgba(157,125,255,.07)',lv5:'rgba(255,140,66,.07)',lv6:'rgba(0,212,255,.08)',lv7:'rgba(157,125,255,.09)',lv8:'rgba(16,217,160,.08)',lv9:'rgba(232,184,75,.09)',lv10:'rgba(232,184,75,.12)'};\n"
    r"    const hbg=isOwner?'rgba(232,184,75,.1)':heroBgMap[lv.c]||heroBgMap.lv1;"
)
if 'xpLabel' not in html:
    new_html, n = XP_OLD.subn(XP_NEW, html, count=1)
    if n: html = new_html; changes += 1; print("✅ xpLabel + heroBg vars added")
    else: print("⚠️  xpLabel pattern not matched")
else:
    print("⚠️  xpLabel already present")

# ─── 7. Replace XP bar HTML with level-aware version ──────────────────
if 'xpCls' in html:
    # Replace static xp bar with dynamic one
    old_bar  = re.compile(r'<div class="xpw"><div class="xpf" style="width:\$\{xp\}%"></div></div>')
    new_bar  = ('<div class="${xpCls}">'
                '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">'
                '<div class="lvbg ${lv.c}">${lv.i} ${lv.n} · Lv.${lv.lv}</div>'
                '<span style="font-size:11px;font-weight:800;color:var(--t2,#8888bb)">${xpLabel}</span></div>'
                '<div style="font-size:10px;color:var(--t3,#44446a);margin-bottom:6px">${xpSubLabel}</div>'
                '<div class="xpw"><div class="xpf" style="width:${xp}%"></div></div></div>')
    new_html, n = old_bar.subn(new_bar, html, count=1)
    if n: html = new_html; changes += 1; print("✅ XP bar upgraded")
    else: print("⚠️  XP bar pattern not matched")

# ─── 8. Particles in hero ─────────────────────────────────────────────
if 'p-dot' not in html and 'lv.lv>=7' not in html:
    # add after the av-wrap closing in the render template
    html = html.replace(
        '</div>\n        <div class="prof-name">',
        '</div>\n'
        '        ${lv.lv>=7||isOwner?`<div class="particles ${isOwner?\'owner-p\':\'lv\'+lv.lv+\'-p\'}">'
        '${"<div class=\\"p-dot\\"></div>".repeat(5)}</div>`:\'\'}\n'
        '        <div class="prof-name">',
        1
    )
    changes += 1
    print("✅ Particles added")

# ─── Save ─────────────────────────────────────────────────────────────
with open(TARGET, 'w', encoding='utf-8') as f:
    f.write(html)

print(f"\n{'='*40}")
print(f"✅ Done — {changes} changes applied")
print(f"   Original: {original_size:,} chars")
print(f"   New:      {len(html):,} chars")
print(f"\nNext:")
print(f"  cd ~/study-bot-backup-20260407_011636")
print(f"  git add public/app/index.html")
print(f'  git commit -m "fix: XP level animations"')
print(f"  git push origin main")
