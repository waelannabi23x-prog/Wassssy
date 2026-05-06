
const tg = window.Telegram.WebApp;
tg.ready(); tg.expand();
tg.setHeaderColor('#07070f');
tg.setBackgroundColor('#07070f');
const TG_USER = tg.initDataUnsafe?.user || {};
const INIT_DATA = tg.initData;

const API = {
  async call(path, method='GET', body=null) {
    const opts = { method, headers: { 'x-init-data': INIT_DATA, 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch('/api' + path, opts);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  get: p => API.call(p),
  post: (p, b) => API.call(p, 'POST', b),
};

const CACHE = {};
async function cached(key, fn, ttl=300000) {
  const now = Date.now();
  if (CACHE[key] && now - CACHE[key].ts < ttl) return CACHE[key].v;
  const v = await fn();
  CACHE[key] = { v, ts: now };
  return v;
}

const STACK = [];
let _currentTab = 'home';
let _isBack = false;

const NAV = {
  tab(name) {
    tg.HapticFeedback.selectionChanged();
    _currentTab = name;
    STACK.length = 0;
    _isBack = false;
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + name)?.classList.add('active');
    const titles = { home: '📚 EduMaster', browse: '📚 تصفح', search: '🔍 بحث', profile: '👤 حسابي' };
    setHeader(titles[name] || name, false);
    PAGES[name]?.();
  },
  go(name, params={}, title='') {
    tg.HapticFeedback.impactOccurred('light');
    STACK.push({ name: STACK.length ? STACK[STACK.length-1].name : _currentTab, params: {}, title: document.getElementById('headerTitle').textContent });
    _isBack = false;
    if (title) setHeader(title, true);
    PAGES[name]?.(params);
  },
  back() {
    if (!STACK.length) return;
    tg.HapticFeedback.impactOccurred('light');
    const prev = STACK.pop();
    _isBack = true;
    setHeader(prev.title, STACK.length > 0);
    PAGES[prev.name]?.(prev.params);
  },
};

function setHeader(title, showBack) {
  document.getElementById('headerTitle').textContent = title;
  document.getElementById('backBtn').classList.toggle('hidden', !showBack);
}

function render(html) {
  const el = document.getElementById('content');
  el.innerHTML = `<div class="page${_isBack ? ' page-back' : ''}">${html}</div>`;
  el.scrollTo(0, 0);
}

function loader() {
  render(`<div class="loader"><div class="spin"></div><div class="loader-text">جاري التحميل...</div></div>`);
}

function empty(icon='📭', text='لا يوجد محتوى', sub='') {
  return `<div class="empty"><div class="empty-icon">${icon}</div><div class="empty-text">${text}</div>${sub ? `<div class="empty-sub">${sub}</div>` : ''}</div>`;
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;');
}

let _toastT;
function toast(msg, type='') {
  clearTimeout(_toastT);
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  _toastT = setTimeout(() => el.className = 'toast', 2400);
}

function starsHtml(avg, cnt) {
  const full = Math.round(avg || 0);
  let s = '';
  for (let i = 1; i <= 5; i++) s += `<span style="color:${i <= full ? '#fbbf24' : '#55557a'};font-size:18px">★</span>`;
  return `${s} <span style="font-size:11px;color:var(--text2)">(${cnt || 0})</span>`;
}

let _profile = null;

const PAGES = {
  async home() {
    const h = new Date().getHours();
    const greet = h < 12 ? '🌅 صباح النور' : h < 17 ? '☀️ مساء الخير' : '🌙 مساء النور';
    const name = TG_USER.first_name || 'طالب';
    let spName = '';
    try {
      if (!_profile) _profile = await cached('profile', () => API.get('/profile'), 120000);
      spName = _profile.specialty?.name || '';
    } catch(_) {}
    render(`
      <div class="hero">
        <div class="hero-tag">EduMaster Platform</div>
        <div class="hero-name">${greet}،<br>${esc(name)} 👋</div>
        ${spName ? `<div class="hero-sp">🎓 <span style="color:var(--accent)">${esc(spName)}</span></div>` : ''}
      </div>
      <div class="section">
        <div class="section-label">الرئيسية</div>
        <div class="g2">
          <div class="menu-card blue" onclick="NAV.tab('browse')">
            <span class="mc-icon">📚</span>
            <div class="mc-body"><div class="mc-title">تصفح</div><div class="mc-sub">كل الملفات</div></div>
          </div>
          <div class="menu-card purple" onclick="NAV.tab('search')">
            <span class="mc-icon">🔍</span>
            <div class="mc-body"><div class="mc-title">بحث</div><div class="mc-sub">ابحث بسرعة</div></div>
          </div>
        </div>
      </div>
      <div class="section">
        <div class="section-label">اكتشف</div>
        <div class="g1">
          <div class="menu-card gold" onclick="loadLatest()">
            <span class="mc-icon">🆕</span>
            <div class="mc-body"><div class="mc-title">آخر الملفات</div><div class="mc-sub">أحدث ما أُضيف</div></div>
            <span class="mc-arrow">›</span>
          </div>
          <div class="menu-card green" onclick="loadFavorites()">
            <span class="mc-icon">⭐</span>
            <div class="mc-body"><div class="mc-title">المفضلة</div><div class="mc-sub">ملفاتك المحفوظة</div></div>
            <span class="mc-arrow">›</span>
          </div>
          <div class="menu-card red" onclick="NAV.tab('profile')">
            <span class="mc-icon">👤</span>
            <div class="mc-body"><div class="mc-title">حسابي</div><div class="mc-sub">إحصائياتي وتاريخي</div></div>
            <span class="mc-arrow">›</span>
          </div>
        </div>
      </div>`);
  },

  async browse() {
    loader();
    try {
      const specs = await cached('specs', () => API.get('/specialties'), 3600000);
      const icons = ['💻','🏥','📐','⚗️','📊','🔬','⚙️','🎨','📖','🌍','🎓','🔭','🧮','🏗️','💡','🧬'];
      let rows = '';
      for (let i = 0; i < specs.length; i += 2) {
        const cls1 = 's' + (i % 6), cls2 = 's' + ((i + 1) % 6);
        rows += `<div class="g2">
          <div class="spec-card ${cls1}" onclick="NAV.go('years',{spId:${specs[i].id},spName:'${esc(specs[i].name)}'},'📅 ${esc(specs[i].name)}')">
            <div class="si">${icons[i % icons.length]}</div>
            <div class="sn">${esc(specs[i].name)}</div>
          </div>`;
        if (specs[i + 1]) {
          rows += `<div class="spec-card ${cls2}" onclick="NAV.go('years',{spId:${specs[i+1].id},spName:'${esc(specs[i+1].name)}'},'📅 ${esc(specs[i+1].name)}')">
            <div class="si">${icons[(i + 1) % icons.length]}</div>
            <div class="sn">${esc(specs[i + 1].name)}</div>
          </div>`;
        }
        rows += `</div>`;
      }
      render(`<div class="section"><div class="section-label">اختر تخصصك</div>${rows}</div>`);
    } catch(e) { toast('خطأ في التحميل', 'err'); }
  },

  async years({ spId, spName }) {
    loader();
    setHeader('📅 ' + spName, true);
    try {
      const years = await cached('years_' + spId, () => API.get('/years/' + spId), 3600000);
      const items = years.map(y => `
        <div class="list-item" onclick="NAV.go('semesters',{yrId:${y.id},yrName:'${esc(y.name)}',spId:${spId},spName:'${esc(spName)}'},'📆 ${esc(y.name)}')">
          <span class="li-icon">📅</span>
          <div class="li-body"><div class="li-title">${esc(y.name)}</div></div>
          <span class="li-arrow">›</span>
        </div>`).join('');
      render(`
        <div class="breadcrumb">🎓 <span class="crumb">${esc(spName)}</span></div>
        <div class="g1">${items || empty()}</div>`);
    } catch(e) { toast('خطأ', 'err'); }
  },

  async semesters({ yrId, yrName, spId, spName }) {
    loader();
    setHeader('📆 ' + yrName, true);
    try {
      const sems = await cached('sems_' + yrId, () => API.get('/semesters/' + yrId), 3600000);
      let rows = '';
      for (let i = 0; i < sems.length; i += 2) {
        rows += '<div class="g2">';
        rows += `<div class="spec-card s${i%6}" onclick="NAV.go('subjects',{smId:${sems[i].id},smName:'${esc(sems[i].name)}',yrId:${yrId},yrName:'${esc(yrName)}',spId:${spId},spName:'${esc(spName)}'},'📖 ${esc(sems[i].name)}')"><div class="si">📆</div><div class="sn">${esc(sems[i].name)}</div></div>`;
        if (sems[i + 1]) {
          rows += `<div class="spec-card s${(i+1)%6}" onclick="NAV.go('subjects',{smId:${sems[i+1].id},smName:'${esc(sems[i+1].name)}',yrId:${yrId},yrName:'${esc(yrName)}',spId:${spId},spName:'${esc(spName)}'},'📖 ${esc(sems[i+1].name)}')"><div class="si">📆</div><div class="sn">${esc(sems[i+1].name)}</div></div>`;
        }
        rows += '</div>';
      }
      render(`
        <div class="breadcrumb">🎓 <span class="crumb">${esc(spName)}</span> <span class="sep">›</span> <span class="crumb">${esc(yrName)}</span></div>
        ${rows || empty()}`);
    } catch(e) { toast('خطأ', 'err'); }
  },

  async subjects({ smId, smName, yrId, yrName, spId, spName }) {
    loader();
    setHeader('📖 ' + smName, true);
    try {
      const subs = await cached('subs_' + smId, () => API.get('/subjects/' + smId), 3600000);
      let rows = '';
      for (let i = 0; i < subs.length; i += 2) {
        rows += '<div class="g2">';
        rows += `<div class="spec-card s${i%6}" onclick="NAV.go('categories',{sbId:${subs[i].id},sbName:'${esc(subs[i].name)}',smId:${smId},smName:'${esc(smName)}',yrId:${yrId},yrName:'${esc(yrName)}',spId:${spId},spName:'${esc(spName)}'},'📁 ${esc(subs[i].name)}')"><div class="si">📖</div><div class="sn">${esc(subs[i].name)}</div></div>`;
        if (subs[i + 1]) {
          rows += `<div class="spec-card s${(i+1)%6}" onclick="NAV.go('categories',{sbId:${subs[i+1].id},sbName:'${esc(subs[i+1].name)}',smId:${smId},smName:'${esc(smName)}',yrId:${yrId},yrName:'${esc(yrName)}',spId:${spId},spName:'${esc(spName)}'},'📁 ${esc(subs[i+1].name)}')"><div class="si">📖</div><div class="sn">${esc(subs[i+1].name)}</div></div>`;
        }
        rows += '</div>';
      }
      render(`
        <div class="breadcrumb">🎓 <span class="crumb">${esc(spName)}</span> <span class="sep">›</span> <span class="crumb">${esc(yrName)}</span> <span class="sep">›</span> <span class="crumb">${esc(smName)}</span></div>
        ${rows || empty()}`);
    } catch(e) { toast('خطأ', 'err'); }
  },

  async categories({ sbId, sbName, smId, smName, yrId, yrName, spId, spName }) {
    loader();
    setHeader('📁 ' + sbName, true);
    try {
      const cats = await cached('cats_' + sbId, () => API.get('/categories/' + sbId), 3600000);
      const catIcon = n => {
        n = n.toLowerCase();
        if (n.includes('cours')) return '📝';
        if (n.includes('td') || n.includes('serie')) return '✏️';
        if (n.includes('tp')) return '🔬';
        if (n.includes('exam') || n.includes('ds')) return '📋';
        if (n.includes('corr')) return '✅';
        return '📁';
      };
      let rows = '';
      for (let i = 0; i < cats.length; i += 2) {
        const p1 = { catId: cats[i].id, catName: esc(cats[i].name), sbId, sbName: esc(sbName), smId, smName: esc(smName), yrId, yrName: esc(yrName), spId, spName: esc(spName) };
        rows += '<div class="g2">';
        rows += `<div class="spec-card s${i%6}" onclick='NAV.go("files",${JSON.stringify(p1)},"📄 ${esc(cats[i].name)}")'><div class="si">${catIcon(cats[i].name)}</div><div class="sn">${esc(cats[i].name)}</div></div>`;
        if (cats[i + 1]) {
          const p2 = { ...p1, catId: cats[i+1].id, catName: esc(cats[i+1].name) };
          rows += `<div class="spec-card s${(i+1)%6}" onclick='NAV.go("files",${JSON.stringify(p2)},"📄 ${esc(cats[i+1].name)}")'><div class="si">${catIcon(cats[i+1].name)}</div><div class="sn">${esc(cats[i+1].name)}</div></div>`;
        }
        rows += '</div>';
      }
      render(`
        <div class="breadcrumb"><span class="crumb">${esc(spName)}</span> <span class="sep">›</span> <span class="crumb">${esc(yrName)}</span> <span class="sep">›</span> <span class="crumb">${esc(smName)}</span> <span class="sep">›</span> <span class="crumb">${esc(sbName)}</span></div>
        ${rows || empty()}`);
    } catch(e) { toast('خطأ', 'err'); }
  },

  async files({ catId, catName, sbName, smName, yrName, spName }) {
    loader();
    setHeader('📄 ' + catName, true);
    try {
      const files = await cached('files_' + catId, () => API.get('/files/' + catId), 600000);
      const typeIcon = t => t === 'link' ? '🔗' : t === 'photo' ? '🖼️' : '📄';
      const items = files.map(f => `
        <div class="file-card" onclick='NAV.go("preview",{fileId:${f.id}},"📄 ${esc(f.title.substring(0,25))}")'>
          <span class="fc-icon">${typeIcon(f.file_type)}</span>
          <div class="fc-body">
            <div class="fc-title">${esc(f.title)}</div>
            <div class="fc-meta"><span>📖 ${esc(f.sub_name || '')}</span><span>⬇️ ${f.downloads || 0}</span>${f.rating_avg ? `<span>${starsHtml(f.rating_avg, f.rating_cnt)}</span>` : ''}</div>
          </div>
          <span class="fc-arrow">›</span>
        </div>`).join('');
      const breadcrumb = [spName, yrName, smName, sbName, catName].filter(Boolean);
      render(`
        <div class="breadcrumb">${breadcrumb.map((b, i) => `<span class="crumb">${esc(b)}</span>${i < breadcrumb.length - 1 ? '<span class="sep">›</span>' : ''}`).join('')}</div>
        <div class="g1">${items || empty('📭', 'لا توجد ملفات في هذا القسم')}</div>`);
    } catch(e) { toast('خطأ', 'err'); }
  },

  async preview({ fileId }) {
    loader();
    try {
      const f = await API.get('/file/' + fileId);
      setHeader('📄 ' + f.title.substring(0, 22), true);
      let comments = [];
      try { comments = await API.get('/comments/' + fileId); } catch(_) {}
      const commentsHtml = comments.length
        ? comments.map(c => `
          <div class="comment-item">
            <div class="comment-author">👤 ${esc(c.first_name || 'مجهول')}</div>
            <div class="comment-text">${esc(c.text)}</div>
            <div class="comment-time">${new Date(c.created_at).toLocaleDateString('ar')}</div>
          </div>`).join('')
        : `<div style="color:var(--text3);font-size:12px;text-align:center;padding:16px">لا توجد تعليقات بعد</div>`;

      render(`
        <div class="preview-hero">
          <div class="prev-title">${esc(f.title)}</div>
          ${f.description ? `<div class="prev-desc">${esc(f.description)}</div>` : ''}
          <div class="prev-path">📁 <span>${esc(f.cat_name || '')}</span> › 📖 <span>${esc(f.sub_name || '')}</span></div>
          <div class="prev-stats">
            <span class="prev-stat">⬇️ ${f.downloads || 0} تحميل</span>
            <span class="prev-stat">💬 ${comments.length} تعليق</span>
          </div>
          <div style="margin-top:8px">${starsHtml(f.rating?.avg, f.rating?.cnt)}</div>
        </div>

        <div style="margin-bottom:9px">
          <div class="stars-label" style="font-size:12px;color:var(--text2);margin-bottom:6px">قيّم هذا الملف:</div>
          <div class="stars-row">
            ${[1,2,3,4,5].map(i => `<button class="star-btn" onclick="rateFile(${fileId},${i},${f.rating?.user||0})" id="star_${fileId}_${i}" style="color:${i<=(f.rating?.user||0)?'#fbbf24':'#55557a'}">★</button>`).join('')}
          </div>
        </div>

        <button class="btn btn-primary" onclick="sendFile(${f.id},this)">⬇️ تحميل الملف</button>
        <button class="btn btn-fav${f.fav ? ' active' : ''}" id="favBtn_${f.id}" onclick="toggleFav(${f.id},${f.fav})">${f.fav ? '⭐ محفوظ في المفضلة' : '☆ حفظ في المفضلة'}</button>

        <div class="comments-section">
          <div class="comments-title">💬 التعليقات</div>
          <div class="comment-box">
            <textarea class="comment-input" id="cmtInput_${f.id}" placeholder="اكتب تعليقك..."></textarea>
            <button class="comment-send" onclick="sendComment(${f.id})">➤</button>
          </div>
          <div id="commentsList_${f.id}">${commentsHtml}</div>
        </div>`);
    } catch(e) { toast('خطأ في تحميل الملف', 'err'); }
  },

  search() {
    render(`
      <div class="search-wrap">
        <span class="search-icon">🔍</span>
        <input class="search-input" id="si" type="search" placeholder="ابحث عن ملف..." autocomplete="off" oninput="doSearch(this.value)">
        <button class="search-clear" id="sc" onclick="clearSearch()">✕</button>
      </div>
      <div id="sr">${empty('🔍', 'ابحث عن أي ملف', 'algo · serie · td · exam · cours...')}</div>`);
    setTimeout(() => document.getElementById('si')?.focus(), 150);
  },

  async profile() {
    loader();
    try {
      _profile = await API.get('/profile');
      const p = _profile;
      const initial = (TG_USER.first_name || '?')[0].toUpperCase();
      let favs = [];
      try { favs = await API.get('/favorites'); } catch(_) {}
      const favsHtml = favs.slice(0, 5).map(f => `
        <div class="fav-card" onclick='NAV.go("preview",{fileId:${f.id}},"📄 ${esc(f.title.substring(0,25))}")'>
          <span class="fav-icon">📄</span>
          <div class="fav-body">
            <div class="fav-title">${esc(f.title)}</div>
            <div class="fav-meta">⬇️ ${f.downloads || 0} · ${starsHtml(f.rating_avg, f.rating_cnt)}</div>
          </div>
          <button class="fav-del" onclick="event.stopPropagation();toggleFav(${f.id},true)">🗑</button>
        </div>`).join('');

      render(`
        <div class="avatar">${initial}</div>
        <div class="profile-name">${esc(TG_USER.first_name || '')} ${esc(TG_USER.last_name || '')}</div>
        ${TG_USER.username ? `<div class="profile-un">@${esc(TG_USER.username)}</div>` : ''}
        <div class="profile-sp">🎓 ${p.specialty ? esc(p.specialty.name) : 'غير محدد'}</div>
        <div class="stats-row">
          <div class="stat-box"><div class="stat-val">${p.dlCount || 0}</div><div class="stat-lbl">⬇️ تحميل</div></div>
          <div class="stat-box"><div class="stat-val">${p.favCount || 0}</div><div class="stat-lbl">⭐ مفضلة</div></div>
          <div class="stat-box"><div class="stat-val">${p.cmtCount || 0}</div><div class="stat-lbl">💬 تعليق</div></div>
        </div>
        ${favs.length ? `<div class="section"><div class="section-label">⭐ آخر المفضلة</div>${favsHtml}</div>` : ''}`);
    } catch(e) { toast('خطأ', 'err'); }
  },
};

async function sendFile(fileId, btn) {
  const orig = btn.innerHTML;
  btn.innerHTML = '⏳ جاري الإرسال...';
  btn.disabled = true;
  try {
    await API.post('/send/' + fileId);
    toast('✅ تم الإرسال! افتح المحادثة مع البوت', 'ok');
    tg.HapticFeedback.notificationOccurred('success');
    btn.innerHTML = '✅ تم الإرسال!';
    setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 3000);
  } catch(e) {
    toast('❌ فشل الإرسال', 'err');
    btn.innerHTML = orig;
    btn.disabled = false;
  }
}

async function toggleFav(fileId, isFav) {
  tg.HapticFeedback.impactOccurred('medium');
  try {
    const res = await API.post('/fav/' + fileId);
    const btn = document.getElementById('favBtn_' + fileId);
    if (btn) {
      btn.classList.toggle('active', res.fav);
      btn.textContent = res.fav ? '⭐ محفوظ في المفضلة' : '☆ حفظ في المفضلة';
    }
    toast(res.fav ? '⭐ أُضيف للمفضلة' : '🗑 حُذف من المفضلة', res.fav ? 'ok' : '');
    delete CACHE['profile'];
  } catch(e) { toast('خطأ', 'err'); }
}

async function rateFile(fileId, rating, oldRating) {
  try {
    const res = await API.post('/rate/' + fileId, { rating });
    tg.HapticFeedback.notificationOccurred('success');
    toast('✅ تم تقييمك: ' + '★'.repeat(rating), 'ok');
    for (let i = 1; i <= 5; i++) {
      const s = document.getElementById('star_' + fileId + '_' + i);
      if (s) s.style.color = i <= rating ? '#fbbf24' : '#55557a';
    }
  } catch(e) { toast('خطأ في التقييم', 'err'); }
}

async function sendComment(fileId) {
  const inp = document.getElementById('cmtInput_' + fileId);
  if (!inp) return;
  const text = inp.value.trim();
  if (!text) { toast('اكتب تعليقاً أولاً', 'err'); return; }
  try {
    await API.post('/comment/' + fileId, { text });
    toast('✅ تم إرسال تعليقك', 'ok');
    inp.value = '';
    tg.HapticFeedback.notificationOccurred('success');
    const list = document.getElementById('commentsList_' + fileId);
    if (list) {
      const div = document.createElement('div');
      div.className = 'comment-item';
      div.innerHTML = `<div class="comment-author">👤 ${esc(TG_USER.first_name || 'أنت')}</div><div class="comment-text">${esc(text)}</div><div class="comment-time">الآن</div>`;
      list.prepend(div);
    }
    delete CACHE['profile'];
  } catch(e) { toast('خطأ في إرسال التعليق', 'err'); }
}

async function loadLatest() {
  STACK.push({ name: 'home', params: {}, title: '📚 EduMaster' });
  setHeader('🆕 آخر الملفات', true);
  loader();
  try {
    const files = await API.get('/latest');
    const typeIcon = t => t === 'link' ? '🔗' : t === 'photo' ? '🖼️' : '📄';
    const items = files.map(f => `
      <div class="file-card" onclick='NAV.go("preview",{fileId:${f.id}},"📄 ${esc(f.title.substring(0,25))}")'>
        <span class="fc-icon">${typeIcon(f.file_type)}</span>
        <div class="fc-body">
          <div class="fc-title">${esc(f.title)}</div>
          <div class="fc-meta"><span>📖 ${esc(f.sub_name || '')}</span><span>⬇️ ${f.downloads || 0}</span></div>
        </div>
        <span class="fc-arrow">›</span>
      </div>`).join('');
    render(`<div class="g1">${items || empty('📭', 'لا توجد ملفات')}</div>`);
  } catch(e) { toast('خطأ', 'err'); }
}

async function loadFavorites() {
  STACK.push({ name: 'home', params: {}, title: '📚 EduMaster' });
  setHeader('⭐ المفضلة', true);
  loader();
  try {
    const files = await API.get('/favorites');
    const typeIcon = t => t === 'link' ? '🔗' : t === 'photo' ? '🖼️' : '📄';
    const items = files.map(f => `
      <div class="file-card" onclick='NAV.go("preview",{fileId:${f.id}},"📄 ${esc(f.title.substring(0,25))}")'>
        <span class="fc-icon">${typeIcon(f.file_type)}</span>
        <div class="fc-body">
          <div class="fc-title">${esc(f.title)}</div>
          <div class="fc-meta"><span>⬇️ ${f.downloads || 0}</span>${f.rating_avg ? `<span>${starsHtml(f.rating_avg,0)}</span>` : ''}</div>
        </div>
        <span class="fc-arrow">›</span>
      </div>`).join('');
    render(`<div class="g1">${items || empty('⭐', 'لا توجد مفضلة بعد', 'احفظ الملفات بالضغط على ☆')}</div>`);
  } catch(e) { toast('خطأ', 'err'); }
}

let _st;
function doSearch(q) {
  const sc = document.getElementById('sc');
  if (sc) sc.classList.toggle('show', q.length > 0);
  clearTimeout(_st);
  if (q.length < 2) {
    document.getElementById('sr').innerHTML = empty('🔍', 'اكتب حرفين على الأقل');
    return;
  }
  document.getElementById('sr').innerHTML = `<div class="loader"><div class="spin"></div></div>`;
  _st = setTimeout(async () => {
    try {
      const res = await API.get('/search?q=' + encodeURIComponent(q));
      const typeIcon = t => t === 'link' ? '🔗' : t === 'photo' ? '🖼️' : '📄';
      if (!res.length) {
        document.getElementById('sr').innerHTML = empty('😕', `لا نتائج لـ "${esc(q)}"`, 'جرب: algo · td · exam · cours');
        return;
      }
      document.getElementById('sr').innerHTML = `<div class="g1">${res.map(f => `
        <div class="file-card" onclick='NAV.go("preview",{fileId:${f.id}},"📄 ${esc(f.title.substring(0,25))}")'>
          <span class="fc-icon">${typeIcon(f.file_type)}</span>
          <div class="fc-body">
            <div class="fc-title">${esc(f.title)}</div>
            <div class="fc-meta"><span>📖 ${esc(f.subject_name || '')}</span><span>⬇️ ${f.downloads || 0}</span></div>
          </div>
          <span class="fc-arrow">›</span>
        </div>`).join('')}</div>`;
    } catch(e) {
      document.getElementById('sr').innerHTML = empty('❌', 'خطأ في البحث');
    }
  }, 350);
}

function clearSearch() {
  const si = document.getElementById('si');
  if (si) { si.value = ''; si.focus(); }
  document.getElementById('sc')?.classList.remove('show');
  document.getElementById('sr').innerHTML = empty('🔍', 'ابحث عن أي ملف', 'algo · serie · td · exam · cours...');
}

tg.BackButton.onClick(() => {
  if (STACK.length > 0) NAV.back();
  else tg.BackButton.hide();
});

setInterval(() => {
  if (STACK.length > 0) tg.BackButton.show();
  else tg.BackButton.hide();
}, 300);

PAGES.home();
