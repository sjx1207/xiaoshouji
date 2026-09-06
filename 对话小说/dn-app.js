/* ==========================================================
   dn-app.js — 核心：状态栏 / 导航 / 路由 / 书架 / 工坊列表 / 个人中心
   ========================================================== */
const DN = {
  books: [],
  current: null,     // 当前打开的书
  chapterIdx: 0
};

/* ---------------- 状态栏（与 index 同步） ---------------- */
function dnUpdateTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  let s;
  try {
    s = new Date().toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  } catch (e) {
    const d = new Date();
    s = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  const el = document.getElementById('statusTime');
  if (el) el.textContent = s.replace(/^0/, '');
}
function dnUpdateBattery() {
  const render = pct => {
    const p = Math.round(pct * 100);
    const t = document.getElementById('batPct');
    const i = document.getElementById('batInner');
    if (t) t.textContent = p;
    if (i) i.style.width = Math.max(6, p) + '%';
  };
  if (navigator.getBattery) {
    navigator.getBattery().then(b => {
      render(b.level);
      b.addEventListener('levelchange', () => render(b.level));
    }).catch(() => render(0.76));
  } else render(0.76);
}

/* ---------------- 通用 UI ---------------- */
function dnToast(msg) {
  const t = document.getElementById('dnToast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2100);
}
function dnLoad(on, txt) {
  const l = document.getElementById('dnLoad');
  if (txt) document.getElementById('dnLoadTxt').textContent = txt;
  l.classList.toggle('show', !!on);
}
function dnPrompt(title, def) {
  return new Promise(res => {
    const m = document.getElementById('dnModal');
    const inp = document.getElementById('dmInput');
    document.getElementById('dmTitle').textContent = title;
    inp.value = def || '';
    m.classList.add('show');
    setTimeout(() => inp.focus(), 180);
    const done = v => {
      m.classList.remove('show');
      document.getElementById('dmOk').onclick = null;
      document.getElementById('dmCancel').onclick = null;
      res(v);
    };
    document.getElementById('dmOk').onclick = () => done(inp.value.trim());
    document.getElementById('dmCancel').onclick = () => done(null);
  });
}
function dnFile(input) {
  return new Promise(res => {
    input.value = '';
    input.onchange = () => {
      const f = input.files && input.files[0];
      if (!f) return res(null);
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(f);
    };
    input.click();
  });
}
function dnEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function dnOpenPage(id) {
  document.getElementById(id).classList.add('show');
  document.getElementById(id).scrollTop = 0;
}
function dnClosePage(id) {
  document.getElementById(id).classList.remove('show');
}
function dnDarkStatus(on) {
  document.getElementById('dnStatusBar').classList.toggle('on-dark', !!on);
}

/* ---------------- 底部导航 ---------------- */
let dnTab = 'shelf';
function dnMoveBlob(instant) {
  const nav = document.getElementById('dnNav');
  const items = [...nav.querySelectorAll('.nav-item')];
  const active = nav.querySelector('.nav-item.active') || items[0];
  const blob = document.getElementById('navBlob');
  const slab = nav.querySelector('.nav-slab');
  if (!active || !slab.offsetWidth) return;
  const r = active.getBoundingClientRect();
  const s = slab.getBoundingClientRect();
  const w = Math.max(96, r.width * 0.92);
  if (instant) blob.style.transition = 'none';
  blob.style.width = w + 'px';
  blob.style.transform = 'translateX(' + (r.left - s.left + (r.width - w) / 2) + 'px)';
  if (instant) requestAnimationFrame(() => blob.style.transition = '');
}
function dnSwitchTab(tab) {
  dnTab = tab;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
  document.querySelectorAll('.dn-view').forEach(v => v.classList.toggle('active', v.id === 'view-' + tab));
  dnMoveBlob();
  if (tab === 'shelf') renderShelf();
  if (tab === 'workshop') renderWorkshop();
  if (tab === 'me') renderProfile();
}

/* ---------------- 数据刷新 ---------------- */
async function dnReload() {
  DN.books = await DNStore.all();
}

/* ---------------- 书架 ---------------- */
let shelfFilter = 'all';
function bookProgress(b) {
  const total = (b.catalog || []).length || b.chapterCount || 1;
  const read = (b.catalog || []).filter(c => c.read).length;
  return Math.round(read / total * 100);
}
function lastReadChapter(b) {
  const c = (b.catalog || []);
  for (let i = c.length - 1; i >= 0; i--) if (c[i].read) return i;
  return -1;
}
function renderShelf() {
  const wrap = document.getElementById('shelfStack');
  const onShelf = DN.books.filter(b => b.onShelf);
  let list = onShelf;
  if (shelfFilter === 'reading') list = list.filter(b => bookProgress(b) > 0 && bookProgress(b) < 100);
  if (shelfFilter === 'done') list = list.filter(b => bookProgress(b) >= 100);
  document.getElementById('shelfEmpty').classList.toggle('show', !onShelf.length);
  document.getElementById('shelfCount').textContent = String(list.length).padStart(2, '0') + ' 册';

  /* 续读主位：取最近有阅读进度的一本 */
  const hero = document.getElementById('shelfHero');
  const cand = onShelf.filter(b => bookProgress(b) > 0).sort((x, y) => y.time - x.time)[0] || onShelf[0];
  if (cand) {
    const pct = bookProgress(cand);
    const li = lastReadChapter(cand);
    const nextTitle = (cand.catalog || [])[li + 1] ? cand.catalog[li + 1].title : (li >= 0 ? '已读完' : '尚未开卷');
    const C = 2 * Math.PI * 24;
    hero.innerHTML = `<div class="shero" data-id="${cand.id}">
      <div class="shero-cv" style="${cand.cover ? `background-image:url('${cand.cover}')` : ''}"></div>
      <div class="shero-in">
        <div class="shero-k">CONTINUE READING</div>
        <div class="shero-t">${dnEsc(cand.title)}</div>
        <div class="shero-c">下一章 · ${dnEsc(nextTitle)}</div>
        <div class="shero-go">翻 开</div>
      </div>
      <div class="shero-ring">
        <svg viewBox="0 0 54 54"><circle class="rt" cx="27" cy="27" r="24"/>
        <circle class="rp" cx="27" cy="27" r="24" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct / 100)}"/></svg>
        <em>${pct}</em>
      </div>
    </div>`;
    hero.querySelector('.shero').onclick = () => openDetail(cand.id);
  } else hero.innerHTML = '';

  wrap.innerHTML = list.map((b, i) => {
    const pct = bookProgress(b);
    const cp = (b.pairs || []).map(p => p.join(' × ')).join(' · ') || '待定关系';
    const chips = [
      (b.catalog || []).length ? (b.catalog || []).length + '章' : b.chapterCount + '章',
      (b.cpCount || 1) + '对CP',
      b.style ? (b.style.name || '文风') : '文风'
    ];
    return `<div class="sbook" style="animation-delay:${i * 60}ms" data-id="${b.id}">
      <div class="sb-spine"></div>
      <div class="sb-cover ${b.cover ? '' : 'empty'}" style="${b.cover ? `background-image:url('${b.cover}')` : ''}"></div>
      <div class="sb-body">
        <div class="sb-title">${dnEsc(b.title)}</div>
        <div class="sb-cp"><i></i>${dnEsc(cp)}</div>
        <div class="sb-chips">${chips.map(c => `<span>${dnEsc(c)}</span>`).join('')}</div>
        <div class="sb-foot">
          <div class="sb-prog"><i style="width:${pct}%"></i></div>
          <div class="sb-pct">${pct}%</div>
        </div>
      </div>
      <div class="sb-mark">${dnEsc((b.title || '书').slice(0, 1))}</div>
    </div>`;
  }).join('');
  wrap.querySelectorAll('.sbook').forEach(el => { el.onclick = () => openDetail(el.dataset.id); });
}

/* ---------------- 创作工坊 ---------------- */
function renderWorkshop() {
  const grid = document.getElementById('wsGrid');
  document.getElementById('wsEmpty').classList.toggle('show', !DN.books.length);
  grid.innerHTML = DN.books.map((b, i) => `
    <div class="wcard" style="animation-delay:${i * 55}ms" data-id="${b.id}">
      <div class="wc-cover ${b.cover ? '' : 'empty'}" style="${b.cover ? `background-image:url('${b.cover}')` : ''}">
        <div class="wc-badge">${(b.catalog || []).length || b.chapterCount || 0} CH</div>
        <div class="wc-del" data-del="${b.id}">✕</div>
      </div>
      <div class="wc-in">
        <div class="wc-t">${dnEsc(b.title)}</div>
        <div class="wc-s">${(b.chars || []).length} 位角色 · ${b.cpCount || 1} 对 CP</div>
      </div>
    </div>`).join('');
  grid.querySelectorAll('.wcard').forEach(el => {
    el.onclick = e => { if (e.target.dataset.del) return; openDetail(el.dataset.id); };
  });
  grid.querySelectorAll('.wc-del').forEach(el => {
    el.onclick = async e => {
      e.stopPropagation();
      await DNStore.del(el.dataset.del);
      await dnReload(); renderWorkshop(); dnToast('已删除');
    };
  });
}

/* ---------------- 个人中心 ---------------- */
const LEVEL_TITLES = ['初 阅 者', '拾 页 人', '夜 读 客', '执 灯 人', '摘 星 者', '藏 书 家', '叙 事 者', '不 眠 之 眼'];
const BADGES = [
  { k: 'first', n: '初次落笔', d: b => b.books >= 1, ic: 'M4 19.5l1-4.1L15.3 5.1a1.9 1.9 0 012.7 0l.9.9a1.9 1.9 0 010 2.7L8.6 18.5l-4.6 1z' },
  { k: 'three', n: '三部归档', d: b => b.books >= 3, ic: 'M5 4.5h4.2v15H5zM10.6 4.5h3.4v15h-3.4zM16.1 5.4l3.1.8-3.3 13.5-3.1-.8z' },
  { k: 'ten', n: '十章之内', d: b => b.chapters >= 10, ic: 'M6 4h12v16l-6-4-6 4z' },
  { k: 'fifty', n: '五十章', d: b => b.chapters >= 50, ic: 'M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z' },
  { k: 'cm', n: '开口评论', d: b => b.myComments >= 1, ic: 'M4 5h16v10H9l-5 4z' },
  { k: 'fav', n: '收藏成癖', d: b => b.shelf >= 3, ic: 'M12 20s-7-4.4-7-9.2A3.9 3.9 0 0112 8a3.9 3.9 0 017 2.8C19 15.6 12 20 12 20z' },
  { k: 'rel', n: '关系网大师', d: b => b.relations >= 2, ic: 'M12 4v5m0 6v5M6.5 7.5l3.2 3.2m4.6 4.6l3.2 3.2M17.5 7.5l-3.2 3.2m-4.6 4.6l-3.2 3.2' },
  { k: 'words', n: '十万字', d: b => b.words >= 100000, ic: 'M4 7h16M4 12h16M4 17h10' }
];
function profileStats() {
  const chapters = DN.books.reduce((n, b) => n + (b.catalog || []).filter(c => c.read).length, 0);
  const words = DN.books.reduce((n, b) =>
    n + (b.catalog || []).reduce((m, c) => m + ((c.segs || []).reduce((k, s) => k + (s.text || '').length, 0)), 0), 0);
  const myComments = DN.books.reduce((n, b) =>
    n + (b.catalog || []).reduce((m, c) => m + ((c.comments || []).filter(x => x.mine).length), 0), 0);
  return {
    books: DN.books.length, chapters, words, myComments,
    shelf: DN.books.filter(b => b.onShelf).length,
    relations: DN.books.filter(b => b.relation && b.relation.links && b.relation.links.length).length
  };
}
function palateScores() {
  const dims = [
    { n: '甜宠', k: ['甜', '宠', '轻快', '暖', '治愈', '日常'] },
    { n: '虐恋', k: ['虐', 'BE', '错过', '遗憾', '决裂', '眼泪'] },
    { n: '悬疑', k: ['悬', '谜', '案', '谍', '真相', '追查'] },
    { n: '古韵', k: ['古', '朝', '宫', '江湖', '王侯', '将军'] },
    { n: '群像', k: ['群像', '众人', '阵营', '家族', '同伴'] }
  ];
  const text = DN.books.map(b => (b.intro || '') + (b.style ? b.style.name + b.style.desc : '')).join('');
  const raw = dims.map(d => d.k.reduce((n, k) => n + (text.split(k).length - 1), 0));
  const max = Math.max(1, ...raw);
  return dims.map((d, i) => ({ n: d.n, v: 0.22 + (raw[i] / max) * 0.78 }));
}
function drawRadar() {
  const svg = document.getElementById('meRadarSvg');
  const data = palateScores();
  const cx = 130, cy = 98, R = 66, N = data.length;
  const pt = (i, r) => {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  let grid = '';
  [0.25, 0.5, 0.75, 1].forEach(f => {
    grid += `<polygon class="rdr-grid" points="${data.map((_, i) => pt(i, R * f).join(',')).join(' ')}"/>`;
  });
  data.forEach((_, i) => {
    const p = pt(i, R);
    grid += `<line class="rdr-axis" x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}"/>`;
  });
  const pts = data.map((d, i) => pt(i, R * d.v));
  const lbl = data.map((d, i) => {
    const p = pt(i, R + 17);
    return `<text class="rdr-lbl" x="${p[0]}" y="${p[1] + 3}" text-anchor="middle">${d.n}</text>`;
  }).join('');
  svg.innerHTML = grid +
    `<polygon class="rdr-area" points="${pts.map(p => p.join(',')).join(' ')}"/>` +
    pts.map(p => `<circle class="rdr-dot" cx="${p[0]}" cy="${p[1]}" r="2.6"/>`).join('') + lbl;
}
function renderProfile() {
  const p = DNStore.profile();
  const av = document.getElementById('meAvatar');
  const cv = document.getElementById('meCover');
  document.getElementById('meName').textContent = p.name;
  document.getElementById('meSign').textContent = p.sign || '轻触以编辑署名';
  if (p.avatar) { av.style.backgroundImage = `url('${p.avatar}')`; av.classList.add('has'); }
  else { av.style.backgroundImage = ''; av.classList.remove('has'); }
  if (p.cover) cv.style.backgroundImage = `url('${p.cover}')`;

  const st = profileStats();

  /* 等级 */
  const score = st.words / 800 + st.chapters * 2 + st.books * 6;
  const lv = Math.max(1, Math.min(8, Math.floor(Math.sqrt(score / 3)) + 1));
  const cur = Math.pow((lv - 1), 2) * 3, next = Math.pow(lv, 2) * 3;
  const pct = Math.max(4, Math.min(100, ((score - cur) / (next - cur)) * 100));
  document.getElementById('meLevel').innerHTML = `
    <div class="ml-top">
      <div class="ml-lv">LV.${lv}</div>
      <div class="ml-title">${LEVEL_TITLES[lv - 1]}</div>
      <div class="ml-next">${lv < 8 ? '距 LV.' + (lv + 1) : '已至顶阶'}</div>
    </div>
    <div class="ml-bar"><i style="width:${pct}%"></i></div>
    <div class="ml-hint">累计 ${st.words.toLocaleString()} 字 · ${st.chapters} 章 · ${st.books} 部建档</div>`;

  document.getElementById('meStats').innerHTML = `
    <div class="mst"><b>${st.books}</b><span>已建档</span></div>
    <div class="mst"><b>${st.chapters}</b><span>读过章节</span></div>
    <div class="mst"><b>${st.shelf}</b><span>在架</span></div>
    <div class="mst"><b>${(st.words / 1000).toFixed(1)}k</b><span>累计字数</span></div>`;

  /* 徽记 */
  const got = BADGES.filter(b => b.d(st)).length;
  document.getElementById('meBadgeCount').textContent = got + ' / ' + BADGES.length;
  document.getElementById('meBadges').innerHTML = BADGES.map(b => `
    <div class="bdg ${b.d(st) ? 'on' : ''}">
      <div class="bdg-ic"><svg viewBox="0 0 24 24" fill="none"><path d="${b.ic}" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"/></svg></div>
      <em>${b.n}</em>
    </div>`).join('');

  drawRadar();

  /* 七日轨迹 + 连续天数 */
  const log = p.log || {};
  const today = new Date();
  const keys = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    keys.push({ k: d.toISOString().slice(0, 10), w: '日一二三四五六'[d.getDay()] });
  }
  const maxV = Math.max(1, ...keys.map(x => log[x.k] || 0));
  document.getElementById('meBars').innerHTML = keys.map(x => {
    const v = log[x.k] || 0;
    const h = v ? 20 + (v / maxV) * 64 : 8;
    return `<div class="mbar ${v ? '' : 'dim'}"><i style="height:${h.toFixed(0)}px"></i><em>${x.w}</em></div>`;
  }).join('');
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10);
    if (log[d]) streak++; else if (i > 0) break;
  }
  document.getElementById('meStreak').textContent = '连续 ' + streak + ' 天';

  const recent = DN.books.slice(0, 8);
  document.getElementById('meRecent').innerHTML = recent.length ? recent.map(b => `
    <div class="mrc" data-id="${b.id}">
      <i style="${b.cover ? `background-image:url('${b.cover}')` : ''}"></i>
      <span>${dnEsc(b.title)}</span>
    </div>`).join('') : '<div style="font-size:11px;color:#9a9aa4;letter-spacing:.1em">暂无记录</div>';
  document.getElementById('meRecent').querySelectorAll('.mrc').forEach(el => {
    el.onclick = () => openDetail(el.dataset.id);
  });
}

/* 记录一次阅读（供阅读器回调） */
function dnMarkRead() {
  const p = DNStore.profile();
  p.log = p.log || {};
  const k = new Date().toISOString().slice(0, 10);
  p.log[k] = (p.log[k] || 0) + 1;
  DNStore.saveProfile(p);
}

/* ---------------- 印章长按 ---------------- */
function initSeal() {
  const wrap = document.getElementById('sealWrap');
  const prog = document.getElementById('sealProg');
  const LEN = 327;
  let raf = null, start = 0, done = false;

  const step = () => {
    const p = Math.min(1, (Date.now() - start) / 900);
    prog.style.strokeDashoffset = LEN * (1 - p);
    if (p >= 1 && !done) {
      done = true;
      stop();
      if (navigator.vibrate) navigator.vibrate(14);
      startWizard();
      return;
    }
    raf = requestAnimationFrame(step);
  };
  const begin = e => {
    e.preventDefault();
    done = false; start = Date.now();
    wrap.classList.add('hold');
    raf = requestAnimationFrame(step);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    wrap.classList.remove('hold');
    if (!done) prog.style.strokeDashoffset = LEN;
  };
  wrap.addEventListener('pointerdown', begin);
  wrap.addEventListener('pointerup', stop);
  wrap.addEventListener('pointercancel', stop);
  wrap.addEventListener('pointerleave', stop);
}

/* ---------------- 初始化 ---------------- */
document.addEventListener('DOMContentLoaded', async () => {
  dnUpdateTime();
  setInterval(dnUpdateTime, 1000);
  dnUpdateBattery();

  document.querySelectorAll('.nav-item').forEach(el => {
    el.onclick = () => dnSwitchTab(el.dataset.tab);
  });
  document.querySelectorAll('[data-close]').forEach(el => {
    el.onclick = () => {
      dnClosePage(el.dataset.close);
      if (el.dataset.close === 'page-pov' || el.dataset.close === 'page-reader') dnDarkStatus(false);
      if (el.dataset.close === 'page-reader') {
        document.getElementById('rsPanel').classList.remove('show');
        applyGlobalBg('');
      }
    };
  });
  document.getElementById('shelfFilters').querySelectorAll('.sf-chip').forEach(el => {
    el.onclick = () => {
      document.querySelectorAll('.sf-chip').forEach(c => c.classList.remove('active'));
      el.classList.add('active');
      shelfFilter = el.dataset.f;
      renderShelf();
    };
  });

  // 个人中心编辑
  document.getElementById('meAvatar').onclick = async () => {
    const d = await dnFile(document.getElementById('meAvatarFile'));
    if (!d) return;
    const p = DNStore.profile(); p.avatar = d; DNStore.saveProfile(p); renderProfile();
  };
  document.getElementById('meCoverEdit').onclick = async () => {
    const d = await dnFile(document.getElementById('meCoverFile'));
    if (!d) return;
    const p = DNStore.profile(); p.cover = d; DNStore.saveProfile(p); renderProfile();
  };
  document.getElementById('meName').onclick = async () => {
    const p = DNStore.profile();
    const v = await dnPrompt('修改昵称', p.name);
    if (v) { p.name = v; DNStore.saveProfile(p); renderProfile(); }
  };
  document.getElementById('meSign').onclick = async () => {
    const p = DNStore.profile();
    const v = await dnPrompt('修改署名', p.sign);
    if (v !== null) { p.sign = v; DNStore.saveProfile(p); renderProfile(); }
  };

  if (typeof finishChapter === 'function') {
    const _fc = finishChapter;
    window.finishChapter = function () { try { dnMarkRead(); } catch (e) { } return _fc.apply(this, arguments); };
  }

  initSeal();
  await dnReload();
  dnSwitchTab('shelf');
  setTimeout(() => dnMoveBlob(true), 60);
  window.addEventListener('resize', () => dnMoveBlob(true));
});

/* 全局背景（阅读器 / 全屏共用，无遮罩） */
function applyGlobalBg(url) {
  const el = document.getElementById('dnGlobalBg');
  if (url) { el.style.backgroundImage = `url('${url}')`; el.classList.add('on'); }
  else { el.style.backgroundImage = ''; el.classList.remove('on'); }
}