#!/usr/bin/env python3
# patch_v3.py — يعدل مباشرة على الكود الفعلي
import re, os

TARGET = os.path.expanduser(
    '~/study-bot-backup-20260407_011636/public/app/index.html'
)

with open(TARGET, 'r', encoding='utf-8') as f:
    html = f.read()

changes = 0

# ══════════════════════════════════════════════════
# 1. أضف /xp/me للـAPI calls في profile()
# ══════════════════════════════════════════════════
old1 = """    const [prof, pts, rank] = await Promise.all([
      API.get('/profile'),
      API.get('/points/me').catch(()=>({total_points:0,downloads_count:0,comments_count:0,ratings_count:0,streak_days:0})),
      API.get('/points/rank').catch(()=>({rank:999})),
    ]);"""

new1 = """    const [prof, pts, rank, xpD] = await Promise.all([
      API.get('/profile'),
      API.get('/points/me').catch(()=>({total_points:0,downloads_count:0,comments_count:0,ratings_count:0,streak_days:0})),
      API.get('/points/rank').catch(()=>({rank:999})),
      API.get('/xp/me').catch(()=>({xp:0,level:1,rank:999})),
    ]);
    API.post('/xp/daily',{}).catch(()=>{});"""

if old1 in html:
    html = html.replace(old1, new1, 1)
    changes += 1
    print("✅ Added /xp/me to profile API calls")
else:
    print("⚠️  API calls pattern not matched")

# ══════════════════════════════════════════════════
# 2. أضف متغيرات XP بعد totalPts
# ══════════════════════════════════════════════════
old2 = """    const totalPts=pts.total_points||0;
    const lv=getLevel(totalPts);
    const xpPct=xpPercent(totalPts);
    const myRank=rank.rank||999;
    const nextLv=LEVELS[Math.min(lv.idx+1,LEVELS.length-1)];"""

new2 = """    const totalPts = xpD?.xp || pts.total_points || 0;
    const lv = getLevel(totalPts);
    const xpPct = xpPercent(totalPts);
    const myRank = xpD?.rank || rank.rank || 999;
    const nextLv = LEVELS[Math.min(lv.idx+1,LEVELS.length-1)];
    const xpLbl = lv.idx<LEVELS.length-1
      ? `${totalPts.toLocaleString('ar')} / ${nextLv.min.toLocaleString('ar')} XP`
      : `${totalPts.toLocaleString('ar')} XP 👑`;
    const xpSub = lv.idx<LEVELS.length-1
      ? `باقي ${(nextLv.min-totalPts).toLocaleString('ar')} XP للمستوى ${lv.idx+2}`
      : 'المستوى الأعلى 👑';
    const xpBarCls = 'xp-' + (prof.isOwner ? 'owner' : (lv.c||lv.cls||'lv1'));
    const heroBg = prof.isOwner
      ? 'linear-gradient(160deg,rgba(232,184,75,.08),transparent 65%)'
      : ({lv1:'rgba(100,110,160,.04)',lv2:'rgba(77,159,255,.05)',lv3:'rgba(16,217,160,.07)',
          lv4:'rgba(157,125,255,.07)',lv5:'rgba(255,140,66,.07)',lv6:'rgba(0,212,255,.08)',
          lv7:'rgba(157,125,255,.09)',lv8:'rgba(16,217,160,.08)',lv9:'rgba(232,184,75,.09)',
          lv10:'rgba(232,184,75,.12)'})[lv.c||lv.cls||'lv1'] || 'rgba(100,110,160,.04)';
    const lvCls = lv.c || lv.cls || 'lv1';
    const showRing  = lv.idx >= 2 || prof.isOwner;
    const showRing2 = lv.idx >= 8 || prof.isOwner;
    const ringCls   = prof.isOwner ? 'owner' : lvCls;
    const ringHtml  = showRing
      ? `<div class="av-ring ${ringCls}"></div>${showRing2?`<div class="av-ring2 ${ringCls}"></div>`:''}`
      : '';
    const ptcHtml = lv.idx >= 6 || prof.isOwner
      ? `<div class="particles ${prof.isOwner?'owner-p':lvCls+'-p'}">${'<div class="p-dot"></div>'.repeat(5)}</div>`
      : '';
    let ownerSection = '';
    if (prof.isOwner) {
      let ownerStats = {users:'—',files:'—'};
      try { const s=await API.get('/admin/stats'); ownerStats={users:s.users||'—',files:s.files||'—'}; } catch(_) {}
      ownerSection = `
        <div style="text-align:center;margin-top:4px">
          <span style="font-size:22px;display:inline-block;animation:crwn 3s ease-in-out infinite;filter:drop-shadow(0 0 10px rgba(232,184,75,.7))">👑</span>
        </div>
        <div style="display:flex;justify-content:center;margin-top:4px">
          <div style="background:linear-gradient(135deg,rgba(232,184,75,.15),rgba(255,140,66,.1));color:#e8b84b;border:1px solid rgba(232,184,75,.3);padding:4px 14px;border-radius:20px;font-size:11px;font-weight:800">👑 مالك المنصة</div>
        </div>
        <div style="background:rgba(232,184,75,.04);border:1px solid rgba(232,184,75,.1);border-radius:12px;padding:10px 14px;margin-top:10px;text-align:right">
          <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:11px">
            <span style="color:rgba(232,184,75,.55);font-size:10px">👥 المستخدمون</span>
            <span style="color:#e8b84b;font-weight:800">${ownerStats.users}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:11px">
            <span style="color:rgba(232,184,75,.55);font-size:10px">📄 الملفات</span>
            <span style="color:#e8b84b;font-weight:800">${ownerStats.files}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:11px">
            <span style="color:rgba(232,184,75,.55);font-size:10px">🆔 المعرف</span>
            <span style="color:#e8b84b;font-weight:800">${prof.user?.id||'—'}</span>
          </div>
        </div>`;
    }"""

if old2 in html:
    html = html.replace(old2, new2, 1)
    changes += 1
    print("✅ XP variables added")
else:
    print("⚠️  XP variables pattern not matched")

# ══════════════════════════════════════════════════
# 3. استبدل render() داخل profile
# ══════════════════════════════════════════════════
old3 = """    render(`
      <div class="prof-hero">
        <div class="av ${lv.idx>=5?'l5-ring':'av-ring'}" style="background:linear-gradient(135deg,var(--em),var(--em2))">${initial}</div>
          <div class="av-edit-btn" onclick="toggleBioEdit()">✏️</div>
        <div class="prof-name">${esc(name)}</div>
        ${prof.user?.username?`<div class="prof-un">@${esc(prof.user.username)}</div>`:''}
        <div class="prof-sp">🎓 ${prof.specialty?esc(prof.specialty.name):'لم يحدد تخصص'}</div>
        ${roleTag}
        <div style="margin-top:12px">
          <div class="lvl-badge ${lv.cls}" style="margin-bottom:8px">${lv.icon} ${lv.name} · ${totalPts} XP</div>
          <div style="font-size:10px;color:var(--t2);margin-bottom:5px">${lv.idx<LEVELS.length-1?`${nextLv.min-totalPts} XP للمستوى التالي`:' المستوى الأعلى! 👑'}</div>
          <div class="xp-bar-wrap"><div class="xp-bar" style="width:${xpPct}%"></div></div>
        </div>
      </div>"""

new3 = """    render(`
      <div class="prof-hero ${prof.isOwner?'owner-hero':''}" style="--hero-bg:${heroBg}">
        ${ptcHtml}
        <div class="prof-av-wrap">
          <div class="av" style="background:linear-gradient(135deg,var(--em),var(--em2));width:82px;height:82px;font-size:32px;position:relative;z-index:1">${initial}</div>
          ${ringHtml}
        </div>
        <div class="av-edit-btn" onclick="toggleBioEdit()">✏️</div>
        <div class="prof-name">${esc(name)}</div>
        ${prof.user?.username?`<div class="prof-un">@${esc(prof.user.username)}</div>`:''}
        <div class="prof-sp">🎓 ${prof.specialty?esc(prof.specialty.name):'لم يحدد تخصص'}</div>
        ${prof.isOwner ? ownerSection : roleTag}
        <div style="margin-top:12px" class="${xpBarCls}">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div class="lvbg ${lvCls}">${lv.icon||lv.i} ${lv.name||lv.n} · Lv.${lv.idx+1}</div>
            <span style="font-size:11px;font-weight:800;color:var(--t2,#8888bb)">${xpLbl}</span>
          </div>
          <div style="font-size:10px;color:var(--t3,#44446a);margin-bottom:6px;text-align:center">${xpSub}</div>
          <div class="xpw"><div class="xpf" style="width:${xpPct}%"></div></div>
        </div>
      </div>"""

if old3 in html:
    html = html.replace(old3, new3, 1)
    changes += 1
    print("✅ Profile hero render updated")
else:
    print("⚠️  Profile hero not matched — trying partial...")
    # try matching just the av line
    old3b = '        <div class="av ${lv.idx>=5?\'l5-ring\':\'av-ring\'}" style="background:linear-gradient(135deg,var(--em),var(--em2))">${initial}</div>'
    new3b = ('        <div class="prof-av-wrap">\n'
             '          <div class="av" style="background:linear-gradient(135deg,var(--em),var(--em2));width:82px;height:82px;font-size:32px;position:relative;z-index:1">${initial}</div>\n'
             '          ${ringHtml}\n'
             '        </div>')
    if old3b in html:
        html = html.replace(old3b, new3b, 1)
        changes += 1
        print("✅ Profile av-wrap added (partial match)")

# ══════════════════════════════════════════════════
# 4. Fix stat rows — add XP + rank row
# ══════════════════════════════════════════════════
old4 = """      <div class="stat-row" style="margin-top:-8px">
        <div class="stat-pill sp-blue"><div class="sp-val">${totalPts}</div><div class="sp-lbl">XP كلي</div></div>
        <div class="stat-pill sp-purple"><div class="sp-val">#${myRank}</div><div class="sp-lbl">ترتيبك</div></div>
        <div class="stat-pill sp-ora"><div class="sp-val">${pts.streak_days||0}🔥</div><div class="sp-lbl">يوم متتالي</div></div>
      </div>"""

new4 = """      <div class="stat-row" style="margin-top:-8px">
        <div class="stat-pill sp-blue"><div class="sp-val">${totalPts.toLocaleString('ar')}</div><div class="sp-lbl">✨ XP</div></div>
        <div class="stat-pill sp-purple"><div class="sp-val">#${myRank}</div><div class="sp-lbl">🏅 ترتيب</div></div>
        <div class="stat-pill sp-ora"><div class="sp-val">${pts.streak_days||0}🔥</div><div class="sp-lbl">يوم متتالي</div></div>
      </div>"""

if old4 in html:
    html = html.replace(old4, new4, 1)
    changes += 1
    print("✅ Stat rows updated")

# ══════════════════════════════════════════════════
# 5. CSS — prof-av-wrap + owner-hero + crwn animation
# ══════════════════════════════════════════════════
CSS_EXTRA = """
/* ══ PROF AV WRAP ══ */
.prof-av-wrap{position:relative;display:flex;align-items:center;justify-content:center;width:fit-content;margin:0 auto 14px}
.prof-av-wrap .av{margin:0}
.prof-hero{position:relative;overflow:hidden}
.prof-hero::before{content:'';position:absolute;inset:0;background:var(--hero-bg,transparent);pointer-events:none;border-radius:inherit}
.owner-hero{border-color:rgba(232,184,75,.2) !important}
@keyframes crwn{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-4px) rotate(3deg)}}
"""

if '.prof-av-wrap{position:relative' not in html:
    html = html.replace('</style>', CSS_EXTRA + '\n</style>', 1)
    changes += 1
    print("✅ Extra CSS added")

# ══════════════════════════════════════════════════
# Save
# ══════════════════════════════════════════════════
with open(TARGET, 'w', encoding='utf-8') as f:
    f.write(html)

print(f"\n{'='*44}")
print(f"✅ Done — {changes} changes applied")
print("\nNext:")
print("  git add public/app/index.html")
print('  git commit -m "fix: XP animations v3"')
print("  git push origin main")
