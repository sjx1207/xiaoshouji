/* =========================================================
   论坛 · 界面层  forum-ui.js
   图标 / 液态按压 / 轻提示 / 弹层 / 页面栈 / Tab 与液滴导航 / 富文本排版
========================================================= */

/* ---------------- 图标（线性 SVG，禁止 emoji） ---------------- */
F.I = (() => {
  const P = {
    back: '<path d="M15 5l-7 7 7 7"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    more: '<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>',
    heart: '<path d="M12 20s-7.5-4.4-7.5-10.1A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.5C19.5 15.6 12 20 12 20z"/>',
    fav: '<path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.8L6 20V5.5a1 1 0 0 1 1-1z"/>',
    comment: '<path d="M20 11.5a7.5 7.5 0 0 1-11.2 6.5L4.5 19l1.1-3.9A7.5 7.5 0 1 1 20 11.5z"/>',
    repost: '<path d="M7 7h10.5l-2.5-2.5M17 17H6.5L9 19.5"/><path d="M17.5 7v4M6.5 17v-4"/>',
    edit: '<path d="M4.5 19.5h4l10-10a2.8 2.8 0 0 0-4-4l-10 10z"/><path d="M13.5 6.5l4 4"/>',
    swap: '<path d="M7 4 4 7l3 3"/><path d="M4 7h11a4 4 0 0 1 4 4"/><path d="m17 20 3-3-3-3"/><path d="M20 17H9a4 4 0 0 1-4-4"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m20 16-4.5-4.5L6 19.5"/>',
    camera: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.4-2h5l1.4 2h1.6A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.8" r="3.4"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    right: '<path d="m9 5 7 7-7 7"/>',
    down: '<path d="m5 9 7 7 7-7"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"/><path d="M20 20v-4h-4"/>',
    send: '<path d="M4.5 12 20 4.5 15.5 20l-3-6.5z"/><path d="m12.5 13.5 7.5-9"/>',
    spark: '<path d="M12 3.5c.6 4.4 2.6 6.9 7.5 8.5-4.9 1.6-6.9 4.1-7.5 8.5-.6-4.4-2.6-6.9-7.5-8.5 4.9-1.6 6.9-4.1 7.5-8.5z"/>',
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="3"/><path d="m4.5 7.5 7.5 5.5 7.5-5.5"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7"/>',
    trash: '<path d="M5 7h14M10 7V4.8h4V7M6.5 7l.9 12.2a1.5 1.5 0 0 0 1.5 1.3h6.2a1.5 1.5 0 0 0 1.5-1.3L17.5 7"/>',
    pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>',
    cal: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.3 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.3-3.5-8.5s1-5.9 3.5-8.5z"/>',
    circles: '<circle cx="9" cy="10" r="4.5"/><circle cx="15.5" cy="14" r="4.5"/>',
    crown: '<path d="M4 17.5 3 7.5l5 4 4-6 4 6 5-4-1 10z"/><path d="M5 20.5h14"/>',
    shield: '<path d="M12 3.5 19 6v5.5c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    poll: '<rect x="4" y="5" width="16" height="3.2" rx="1.6"/><rect x="4" y="10.4" width="11" height="3.2" rx="1.6"/><rect x="4" y="15.8" width="7" height="3.2" rx="1.6"/>',
    article: '<rect x="4.5" y="3.5" width="15" height="17" rx="2.5"/><path d="M8 8h8M8 11.5h8M8 15h5"/>',
    feather: '<path d="M19.5 4.5c-6 0-11 4.5-11 11v4"/><path d="M8.5 15.5h6c3-1.5 5-5.5 5-11"/><path d="M5 20.5l3.5-5"/>',
    qa: '<path d="M4 5.5h11v8H8.5L5 16.5v-3H4z"/><path d="M15 9.5h5v7h-1v3l-3-3h-5v-3"/>',
    thread: '<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><path d="M6 8v8M11 6h9M11 12h9M11 18h9"/>',
    review: '<path d="m12 4 2.4 5 5.3.7-3.9 3.7 1 5.3L12 16.2l-4.8 2.5 1-5.3-3.9-3.7 5.3-.7z"/>',
    news: '<path d="M4 6.5h13v12a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z"/><path d="M17 9.5h3v9a2 2 0 0 1-2 2M7.5 10h6M7.5 13.5h6M7.5 17h4"/>',
    at: '<circle cx="12" cy="12" r="3.6"/><path d="M15.6 12v1.5a2.5 2.5 0 0 0 5 0V12a8.6 8.6 0 1 0-3.4 6.9"/>',
    hash: '<path d="M9.5 4 8 20M16 4l-1.5 16M4.5 9h15M4 15h15"/>',
    users: '<circle cx="9" cy="8.5" r="3.4"/><path d="M3 19.5c.6-3.3 3-5 6-5s5.4 1.7 6 5"/><path d="M15.5 5.3a3.3 3.3 0 0 1 0 6.4M18 14.8c1.7.7 2.8 2.3 3 4.7"/>',
    bolt: '<path d="M13 3 5 13.5h6l-1 7.5 8-10.5h-6z"/>',
    book: '<path d="M4.5 5.5A2 2 0 0 1 6.5 3.5H19v14H6.5a2 2 0 0 0-2 2z"/><path d="M4.5 19.5a2 2 0 0 0 2 2H19v-4"/>',
    play: '<path d="m8 5.5 11 6.5-11 6.5z"/>',
    flame: '<path d="M12 3.5c.6 3.2 4.8 5.1 4.8 9.6A4.8 4.8 0 0 1 12 18a4.8 4.8 0 0 1-4.8-4.9c0-2.2 1.2-3.4 2.2-4.4.3 1.6 1 2.5 2 2.8-.6-2.6-.1-5.6.6-8z"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.8"/>',
    stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/>',
    doc: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7 3.5z"/><path d="M14 3.5V8h4"/>'
  };
  return (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${P[name] || ''}</svg>`;
})();
F.vbadge = (dark = true) => `<span class="vbadge"><svg viewBox="0 0 24 24"><path d="M12 1.8l2.5 1.9 3.1-.3 1 3 2.7 1.6-.8 3 .8 3-2.7 1.6-1 3-3.1-.3L12 22.2l-2.5-1.9-3.1.3-1-3-2.7-1.6.8-3-.8-3 2.7-1.6 1-3 3.1.3z" fill="${dark ? '#1e1e22' : '#8e8e96'}"/><path d="m8.3 12.2 2.5 2.5 5-5.2" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;

/* ---------------- 液态按压：iOS 26 式的挤压回弹 + 跟随指尖的镜面高光 ---------------- */
(() => {
  const target = e => e.target.closest && e.target.closest('.lg, .dock-glass');
  document.addEventListener('pointerdown', e => {
    const el = target(e); if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
    el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    if (el.classList.contains('lg')) el.classList.add('pressed');
  }, { passive: true });
  const up = () => document.querySelectorAll('.lg.pressed').forEach(el => el.classList.remove('pressed'));
  document.addEventListener('pointerup', up, { passive: true });
  document.addEventListener('pointercancel', up, { passive: true });
  document.addEventListener('pointermove', e => {
    const el = target(e); if (!el || !el.classList.contains('pressed')) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
  }, { passive: true });
})();

/* ---------------- 轻提示 ---------------- */
F.toast = (msg, icon = 'check', ms = 2200) => {
  const wrap = document.getElementById('toastWrap');
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = (icon ? F.I(icon) : '') + `<span>${F.esc(msg)}</span>`;
  wrap.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 450); }, ms);
};

/* ---------------- 底部弹层 ---------------- */
F.sheet = (opts) => {
  const layer = document.getElementById('sheetLayer');
  const bd = document.createElement('div'); bd.className = 'sheet-backdrop';
  const sh = document.createElement('div'); sh.className = 'sheet' + (opts.cls ? ' ' + opts.cls : '');
  sh.innerHTML = `<div class="sheet-grip"></div>
    ${opts.title ? `<div class="sheet-head"><div style="flex:1"><h3>${F.esc(opts.title)}</h3>${opts.sub ? `<p>${F.esc(opts.sub)}</p>` : ''}</div><button class="gorb sm lg" data-close>${F.I('close')}</button></div>` : ''}
    <div class="sheet-body"></div>${opts.foot ? '<div class="sheet-foot"></div>' : ''}`;
  layer.append(bd, sh);
  layer.style.pointerEvents = 'auto';
  const api = {
    el: sh, body: sh.querySelector('.sheet-body'), foot: sh.querySelector('.sheet-foot'),
    close() {
      bd.classList.remove('show'); sh.classList.remove('show');
      setTimeout(() => { bd.remove(); sh.remove(); if (!layer.children.length) layer.style.pointerEvents = 'none'; opts.onClose && opts.onClose(); }, 480);
    }
  };
  bd.onclick = api.close;
  sh.querySelectorAll('[data-close]').forEach(b => b.onclick = api.close);
  // 下拉关闭
  let sy = null, dy = 0;
  const grip = sh.querySelector('.sheet-grip');
  const head = sh.querySelector('.sheet-head');
  [grip, head].filter(Boolean).forEach(h => {
    h.addEventListener('touchstart', e => { sy = e.touches[0].clientY; sh.style.transition = 'none'; }, { passive: true });
    h.addEventListener('touchmove', e => { if (sy == null) return; dy = Math.max(0, e.touches[0].clientY - sy); sh.style.transform = `translateY(${dy}px)`; }, { passive: true });
    h.addEventListener('touchend', () => { sh.style.transition = ''; sh.style.transform = ''; if (dy > 90) api.close(); sy = null; dy = 0; });
  });
  opts.render && opts.render(api);
  requestAnimationFrame(() => requestAnimationFrame(() => { bd.classList.add('show'); sh.classList.add('show'); }));
  return api;
};
F.confirm = (title, sub, okText = '确定', danger = false) => new Promise(res => {
  let done = false;
  const s = F.sheet({
    title, sub, foot: true,
    onClose: () => { if (!done) res(false); },
    render(api) {
      api.body.style.display = 'none';
      api.foot.innerHTML = `<div style="display:flex;gap:10px"><button class="gbtn lgx lg" style="flex:1" data-no>取消</button><button class="gbtn lgx lg lg-dark" style="flex:1${danger ? ';background:linear-gradient(160deg,#2a2a2e,#0f0f11)' : ''}" data-ok>${F.esc(okText)}</button></div>`;
      api.foot.querySelector('[data-no]').onclick = () => { done = true; res(false); api.close(); };
      api.foot.querySelector('[data-ok]').onclick = () => { done = true; res(true); api.close(); };
    }
  });
});
/* 选项菜单 */
F.menu = (title, items) => new Promise(res => {
  let picked = false;
  F.sheet({
    title,
    onClose: () => { if (!picked) res(null); },
    render(api) {
      api.body.innerHTML = `<div class="group">${items.map((it, i) => `<button class="row" data-i="${i}" style="width:100%;text-align:left">${it.icon ? `<span style="width:22px;color:${it.danger ? '#c23b3b' : 'var(--ink)'}">${F.I(it.icon)}</span>` : ''}<div class="r-main"><div class="r-title" style="${it.danger ? 'color:#c23b3b' : ''}">${F.esc(it.label)}</div>${it.sub ? `<div class="r-sub">${F.esc(it.sub)}</div>` : ''}</div>${it.on ? `<span style="width:18px">${F.I('check')}</span>` : ''}</button>`).join('')}</div>`;
      api.body.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { picked = true; res(items[+b.dataset.i].value); api.close(); });
    }
  });
});

/* ---------------- 页面栈 ---------------- */
F.nav = {
  stack: [],
  push(render, opts = {}) {
    F.video && F.video.pauseAll && F.video.pauseAll();
    const host = document.getElementById('pageStack');
    const page = document.createElement('div');
    page.className = 'page' + (opts.fromCore ? ' from-core' : '') + (opts.cls ? ' ' + opts.cls : '');
    if (opts.fromCore) { page.style.setProperty('--cx', opts.fromCore.x + 'px'); page.style.setProperty('--cy', opts.fromCore.y + 'px'); }
    page._tone = !!opts.darkTop;
    host.appendChild(page);
    const prev = this.stack[this.stack.length - 1];
    this.stack.push(page);
    page._api = { page, close: () => this.pop(page) };
    render(page, page._api);
    this._edgeSwipe(page);
    document.getElementById('dock').classList.add('hide');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      page.classList.add('in');
      if (prev && !opts.fromCore) prev.classList.add('under');
      F.statusbar.tone(page._tone);
    }));
    return page;
  },
  pop(target) {
    const page = target || this.stack[this.stack.length - 1];
    if (!page) return;
    const idx = this.stack.indexOf(page);
    if (idx < 0) return;
    this.stack.splice(idx, 1);
    page.classList.remove('in'); page.classList.add('out');
    page._onLeave && page._onLeave();
    const top = this.stack[this.stack.length - 1];
    if (top) { top.classList.remove('under'); top._refresh && top._refresh(); F.statusbar.tone(top._tone); }
    else { document.getElementById('dock').classList.remove('hide'); F.tabs.refresh(); F.statusbar.tone(F.tabs.darkTop); }
    setTimeout(() => page.remove(), 560);
  },
  popAll() { [...this.stack].reverse().forEach(p => this.pop(p)); },
  _edgeSwipe(page) {
    const edge = document.createElement('div'); edge.className = 'page-edge'; page.appendChild(edge);
    let sx = null, dx = 0;
    edge.addEventListener('touchstart', e => { sx = e.touches[0].clientX; page.style.transition = 'none'; }, { passive: true });
    edge.addEventListener('touchmove', e => { if (sx == null) return; dx = Math.max(0, e.touches[0].clientX - sx); page.style.transform = `translateX(${dx}px)`; }, { passive: true });
    edge.addEventListener('touchend', () => {
      page.style.transition = ''; page.style.transform = '';
      if (dx > window.innerWidth * .32) this.pop(page);
      sx = null; dx = 0;
    });
  }
};

/* 标准顶栏 */
F.topbar = (title, { left = 'back', right = '', sub = '', clear = false } = {}) => `
  <header class="topbar${clear ? ' clear' : ''}">
    <div class="tb-side">${left === 'back' ? `<button class="gorb lg" data-back>${F.I('back')}</button>` : left}</div>
    <div class="tb-title">${F.esc(title)}${sub ? `<small>${F.esc(sub)}</small>` : ''}</div>
    <div class="tb-side r">${right}</div>
  </header>`;
F.bindBack = (page, api) => page.querySelectorAll('[data-back]').forEach(b => b.onclick = () => api.close());

/* ---------------- Tab 与液滴导航 ---------------- */
F.tabs = {
  current: 'home', renderers: {}, darkTop: false,
  init() {
    const dock = document.getElementById('dock');
    const glass = dock.querySelector('.dock-glass');
    const shine = document.createElement('span'); shine.className = 'dock-shine'; glass.appendChild(shine);
    this.shine = shine;
    dock.querySelectorAll('.dock-item').forEach(b => b.onclick = () => this.go(b.dataset.tab));
    document.getElementById('dockCore').onclick = e => {
      const core = e.currentTarget; core.classList.add('fire');
      const r = core.getBoundingClientRect();
      setTimeout(() => core.classList.remove('fire'), 700);
      F.compose.open({ fromCore: { x: r.left + r.width / 2, y: r.top + r.height / 2 } });
    };
    window.addEventListener('resize', () => this.moveGoo(false));
    if (window.ResizeObserver) new ResizeObserver(() => this.moveGoo(false)).observe(dock.querySelector('.dock-glass'));
    document.querySelectorAll('.tab-view').forEach(v => {
      let last = 0;
      v.addEventListener('scroll', () => {
        const y = v.scrollTop, d = y - last;
        if (Math.abs(d) > 6) dock.classList.toggle('min', d > 0 && y > 120);
        last = y;
        v._onScroll && v._onScroll(y);
      }, { passive: true });
    });
    F.bus.on('change', F.debounce(() => { if (!F.nav.stack.length) this.refresh(true); }, 60));
  },
  go(name) {
    const same = name === this.current;
    if (!same && F.video && F.video.pauseAll) F.video.pauseAll();
    this.current = name;
    document.querySelectorAll('.tab-view').forEach(v => v.classList.toggle('active', v.dataset.tab === name));
    document.getElementById('app').classList.toggle('video-mode', name === 'video');
    document.querySelectorAll('.dock-item').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
    document.getElementById('dock').classList.remove('min');
    this.moveGoo(true);
    const view = document.querySelector(`.tab-view[data-tab="${name}"]`);
    if (same) { view.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    this.refresh();
  },
  refresh(soft) {
    const view = document.querySelector(`.tab-view[data-tab="${this.current}"]`);
    const r = this.renderers[this.current];
    if (r) r(view, !!soft);
    F.statusbar.tone(this.darkTop = !!view._darkTop);
  },
  moveGoo(anim) {
    const dock = document.getElementById('dock');
    const glass = dock.querySelector('.dock-glass');
    const item = dock.querySelector(`.dock-item[data-tab="${this.current}"]`);
    if (!item) return;
    const x = item.offsetLeft + item.offsetWidth / 2;
    const goo = dock.querySelector('.dock-goo');
    const head = goo.querySelector('.goo-head'), tail = goo.querySelector('.goo-tail');
    if (!anim) { [head, tail, this.shine].forEach(el => { el.style.transition = 'none'; }); }
    head.style.transform = tail.style.transform = this.shine.style.transform = `translateX(${x}px)`;
    if (anim) { goo.classList.remove('moving'); void goo.offsetWidth; goo.classList.add('moving'); }
    else requestAnimationFrame(() => [head, tail, this.shine].forEach(el => el.style.transition = ''));
    glass.style.setProperty('--mx', (x / glass.offsetWidth * 100) + '%');
  }
};

/* ---------------- 分段控制 ---------------- */
F.seg = (el, onChange) => {
  const pill = document.createElement('span'); pill.className = 'seg-pill'; el.prepend(pill);
  const place = () => { const on = el.querySelector('button.on') || el.querySelector('button'); if (!on) return; pill.style.left = on.offsetLeft + 'px'; pill.style.width = on.offsetWidth + 'px'; };
  el.querySelectorAll('button').forEach(b => b.onclick = () => { el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); place(); onChange && onChange(b.dataset.v, b); });
  requestAnimationFrame(place); setTimeout(place, 300);
  return { place };
};
F.switchHTML = (id, on, disabled) => `<label class="switch"><input type="checkbox" ${id ? `data-sw="${id}"` : ''} ${on ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span class="trk"></span><span class="knob"></span></label>`;

/* ---------------- 图片查看器 ---------------- */
F.viewer = (images, start = 0) => {
  const v = document.getElementById('viewer');
  v.innerHTML = `<div class="viewer-count"></div><button class="gorb lg lg-on-img viewer-close">${F.I('close')}</button>
    <div class="viewer-track">${images.map(im => `<div>${im.src ? `<img src="${im.src}">` : `<div style="width:86%;aspect-ratio:1;border-radius:24px;overflow:hidden">${F.art.photoSVG(im.seed || im.desc || 'p')}</div>`}</div>`).join('')}</div>
    <div class="viewer-cap"></div>`;
  v.classList.add('show');
  const track = v.querySelector('.viewer-track'), cap = v.querySelector('.viewer-cap'), cnt = v.querySelector('.viewer-count');
  const upd = () => { const i = Math.round(track.scrollLeft / track.clientWidth); cnt.textContent = `${i + 1} / ${images.length}`; cap.textContent = images[i] && images[i].desc || ''; };
  track.addEventListener('scroll', F.debounce(upd, 50));
  requestAnimationFrame(() => { track.scrollLeft = start * track.clientWidth; upd(); });
  v.querySelector('.viewer-close').onclick = () => v.classList.remove('show');
};

/* ---------------- 富文本排版：把常见符号标记为易读样式 ----------------
   # 标题 / ## 小标题 / > 引用 / - 列表 / 1. 有序 / --- 分隔
   **加粗** ==高亮== ~~删除~~ 「引语」 “对白” 《书名》 【标签】 #话题# @提及 （注释）
------------------------------------------------------------------ */
F.inline = s => {
  let t = F.esc(s);
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/==(.+?)==/g, '<mark class="rt-mark">$1</mark>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/「([^」]{1,200})」/g, '<span class="rt-corner">「$1」</span>')
    .replace(/“([^”]{1,300})”/g, '<span class="rt-dialog">“$1”</span>')
    .replace(/《([^》]{1,40})》/g, '<span class="rt-book">《$1》</span>')
    .replace(/【([^】]{1,30})】/g, '<span class="rt-tag">$1</span>')
    .replace(/#([^#\s][^#\n]{0,30})#/g, '<span class="rt-topic">#$1#</span>')
    .replace(/(^|[\s，。！？、,])@([\u4e00-\u9fa5A-Za-z0-9_\-·]{1,20})/g, '$1<span class="rt-at">@$2</span>')
    .replace(/（(注|按|编者注|PS)[:：]([^）]{1,200})）/g, '<span class="rt-note">$1 · $2</span>');
  return t;
};
F.rich = (text, { toc = false } = {}) => {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  let html = '', list = null, heads = [];
  const flush = () => { if (list) { html += `</${list}>`; list = null; } };
  lines.forEach(raw => {
    const l = raw.trim();
    if (!l) { flush(); return; }
    let m;
    if (/^(-{3,}|\*{3,}|—{2,})$/.test(l)) { flush(); html += '<hr class="rt-hr">'; return; }
    if ((m = l.match(/^#{1}\s+(.+)/)) && !/^#[^#\s]/.test(l)) { flush(); const id = 'h' + heads.length; heads.push({ id, t: m[1], lv: 1 }); html += `<h2 class="rt-h2" id="${id}">${F.inline(m[1])}</h2>`; return; }
    if ((m = l.match(/^#{2,3}\s+(.+)/))) { flush(); const id = 'h' + heads.length; heads.push({ id, t: m[1], lv: 2 }); html += `<h3 class="rt-h3" id="${id}">${F.inline(m[1])}</h3>`; return; }
    if ((m = l.match(/^[>＞]\s?(.+)/))) { flush(); html += `<blockquote class="rt-quote">${F.inline(m[1])}</blockquote>`; return; }
    if ((m = l.match(/^[-·•]\s+(.+)/))) { if (list !== 'ul') { flush(); html += '<ul class="rt-ul">'; list = 'ul'; } html += `<li>${F.inline(m[1])}</li>`; return; }
    if ((m = l.match(/^(\d{1,2})[.、)]\s*(.+)/))) { if (list !== 'ol') { flush(); html += '<ol class="rt-ol">'; list = 'ol'; } html += `<li>${F.inline(m[2])}</li>`; return; }
    flush();
    html += `<p>${F.inline(l)}</p>`;
  });
  flush();
  if (toc && heads.length >= 2) {
    html = `<nav class="rt-toc"><div class="rt-toc-t">目录</div>${heads.map(h => `<a data-jump="${h.id}" class="lv${h.lv}">${F.esc(h.t.replace(/\*\*/g, ''))}</a>`).join('')}</nav>` + html;
  }
  return html;
};
/* 只滚动指定容器，绝不连带滚动外层页面（避免顶栏被推到状态栏下） */
F.scrollInto = (box, el, pos = 'center', smooth = true) => {
  if (!box || !el) return;
  const br = box.getBoundingClientRect(), er = el.getBoundingClientRect();
  let top = box.scrollTop + (er.top - br.top);
  if (pos === 'center') top -= (box.clientHeight - er.height) / 2;
  else if (pos === 'nearest') { if (er.top >= br.top && er.bottom <= br.bottom) return; if (er.bottom > br.bottom) top -= box.clientHeight - er.height - 12; else top -= 12; }
  box.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
};
F.typeName = t => ((F.TYPES && F.TYPES[t]) || (F.VTYPES && F.VTYPES[t]) || { name: t === 'repost' ? '转发' : '内容' }).name;
F.plain = text => String(text || '').replace(/^(-{3,}|\*{3,}|—{2,})\s*$/gm, '').replace(/^#{1,3}\s+/gm, '').replace(/\*\*|==|~~/g, '').replace(/^[>＞]\s?/gm, '').replace(/^[-·•]\s+/gm, '· ').replace(/\n{2,}/g, '\n').trim();