/* ================================================
   album.js
   状态栏时间 / 电量 / 灵动岛 / 字体
   → 一比一复刻 secret.js（来自 Luna OS 主工程）
================================================ */

/* ---- 状态栏：实时时间 ---- */
function updateTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeStr = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const el = document.getElementById('statusTime');
  if (el) el.textContent = timeStr;
}

/* ---- 状态栏：电量 ---- */
function updateBattery() {
  const pctEl   = document.getElementById('batPct');
  const innerEl = document.getElementById('batInner');

  function render(p) {
    p = Math.round(p);
    if (pctEl)   pctEl.textContent = p;
    if (innerEl) {
      innerEl.style.width = p + '%';
      innerEl.style.background = p <= 20
        ? 'linear-gradient(90deg,#f87171,#ef4444)'
        : 'linear-gradient(90deg,#6ee7b7,#34d399)';
    }
  }

  if ('getBattery' in navigator) {
    navigator.getBattery().then(b => {
      render(b.level * 100);
      b.addEventListener('levelchange', () => render(b.level * 100));
    });
  } else {
    render(76);
  }
}

/* ---- 灵动岛 — 一比一复刻 secret.js applyIsland ---- */
function applyIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const el      = document.getElementById('statusIsland');
  if (!el) return;

  if (!enabled) { el.innerHTML = ''; return; }

  const styleMap = {
    minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
    clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="siClockText">--:--</span></div></div>`,
    pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
    ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
    rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
    music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
    scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
  };

  el.innerHTML = styleMap[style] || styleMap.minimal;

  /* clock 模式：启动计时器 */
  clearInterval(window._albIslandClockTimer);
  if (style === 'clock') {
    const tick = () => {
      const t = document.getElementById('siClockText');
      if (!t) return;
      const now = new Date();
      t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    };
    tick();
    window._albIslandClockTimer = setInterval(tick, 10000);
  }
}

/* ---- 字体 — 一比一复刻 secret.js applyGlobalFont ---- */
async function applyGlobalFont() {
  const name = localStorage.getItem('luna_font_active_name');
  const id   = parseInt(localStorage.getItem('luna_font_active_id'));

  if (name && id) {
    try {
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open('LunaFontDB', 4);
        req.onupgradeneeded = e => {
          const d = e.target.result;
          if (!d.objectStoreNames.contains('fonts')) {
            d.createObjectStore('fonts', { keyPath: 'id', autoIncrement: true });
          }
        };
        req.onsuccess = e => res(e.target.result);
        req.onerror   = () => rej();
      });

      const all = await new Promise(res => {
        const r = db.transaction('fonts').objectStore('fonts').getAll();
        r.onsuccess = () => res(r.result || []);
        r.onerror   = () => res([]);
      });

      const f = all.find(x => x.id === id);
      if (f) {
        const face = new FontFace(name, `url(${f.data})`);
        await face.load();
        document.fonts.add(face);
      }
    } catch (e) {}
  }

  let tag = document.getElementById('luna-font-override');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'luna-font-override';
    document.head.appendChild(tag);
  }
  const familyRule = name ? `font-family: '${name}', sans-serif !important;` : '';
  tag.textContent = `* { ${familyRule} }`;
}

/* ---- 跨页 storage 监听，实时同步主页面设置变化 ---- */
window.addEventListener('storage', e => {
  if (e.key === 'luna_font_update')   applyGlobalFont();
  if (e.key === 'luna_island_update') applyIsland();
  if (e.key === 'luna_tz_update')     updateTime();
  if (e.key === 'luna_stat_photos' || e.key === 'luna_stat_albums' || e.key === 'luna_stat_latest') updateStats();
});

/* ---- 定时刷新时间（每 10 s，与主工程一致） ---- */
setInterval(updateTime, 10000);

/* ---- 底部导航切页 ---- */
function go(name, el) {
  document.querySelectorAll('.bn-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('p-' + name).classList.add('active');
}

/* ---- 相册统计数据（动态读取，从 localStorage 或默认值） ---- */
function updateStats() {
  const photos = parseInt(localStorage.getItem('luna_stat_photos') || '0');
  const albums = parseInt(localStorage.getItem('luna_stat_albums') || '0');

  // 最新年份：优先读存储，否则用当前年份
  const latestRaw = localStorage.getItem('luna_stat_latest');
  const latest = latestRaw ? latestRaw : new Date().getFullYear().toString();

  const elP = document.getElementById('statPhotos');
  const elA = document.getElementById('statAlbums');
  const elL = document.getElementById('statLatest');

  if (elP) elP.textContent = photos > 0 ? photos : '0';
  if (elA) elA.textContent = albums > 0 ? albums : '0';
  if (elL) elL.textContent = latest;
}

/* ================================================
   MINE PAGE — IndexedDB 照片存储
================================================ */

const MINE_DB_NAME    = 'LunaAlbumDB';
const MINE_DB_VERSION = 1;
const MINE_STORE      = 'photos';

function mineOpenDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(MINE_DB_NAME, MINE_DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(MINE_STORE)) {
        const store = db.createObjectStore(MINE_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('date', 'date', { unique: false });
      }
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror   = () => rej(req.error);
  });
}

async function mineSavePhoto(photoData) {
  /* photoData: { dataUrl, filename, size, desc, caption, date } */
  const db = await mineOpenDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(MINE_STORE, 'readwrite');
    const req = tx.objectStore(MINE_STORE).add(photoData);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

async function mineLoadAllPhotos() {
  const db = await mineOpenDB();
  return new Promise(res => {
    const req = db.transaction(MINE_STORE).objectStore(MINE_STORE).getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror   = () => res([]);
  });
}

/* ================================================
   MINE PAGE — 时间轴渲染
================================================ */

/* 格式化日期标签 MM-DD */
function mineFmtDateLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return mm + '-' + dd;
}

/* 获取 "年-月" key，如 "2026-05" */
function mineMonthKey(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

/* 月份名 */
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/* 按年月分组，每组内按日期降序 */
function mineGroupPhotos(photos) {
  const map = {};
  photos.forEach(p => {
    const key = mineMonthKey(p.date);
    if (!key) return;
    if (!map[key]) map[key] = [];
    map[key].push(p);
  });
  /* 每组内按日期降序 */
  Object.values(map).forEach(arr => arr.sort((a, b) => new Date(b.date) - new Date(a.date)));
  /* 按 key 降序排列（最新月份在前） */
  return Object.keys(map).sort((a, b) => b.localeCompare(a)).map(k => ({ key: k, photos: map[k] }));
}

/* 渲染空状态 */
function mineRenderEmpty(container) {
  container.innerHTML = `
    <div class="mine-empty">
      <div class="mine-empty-icon"><i class="ti ti-photo-off" aria-hidden="true"></i></div>
      <div class="mine-empty-title">No photos <em>yet</em></div>
      <div class="mine-empty-sub">Your timeline is waiting. Upload your first photo to get started.</div>
      <button class="mine-empty-btn" onclick="mineOpenUpload()" aria-label="Upload first photo">
        <i class="ti ti-cloud-upload" aria-hidden="true"></i>
        <span>Upload photo</span>
      </button>
    </div>`;
}

/* 主渲染函数 */
async function mineRenderTimeline(animateLatest) {
  const photos  = await mineLoadAllPhotos();
  const gridEl  = document.getElementById('mineViewGrid');
  const fanEl   = document.getElementById('mineViewFan');
  if (!gridEl || !fanEl) return;

  /* 更新统计 */
  const countEl  = document.getElementById('statPhotos');
  const latestEl = document.getElementById('statLatest');
  if (countEl) countEl.textContent = photos.length || '0';
  if (latestEl && photos.length) {
    const newest = photos.reduce((a, b) => new Date(b.date) > new Date(a.date) ? b : a);
    const d = new Date(newest.date);
    latestEl.textContent = MONTH_NAMES[d.getMonth()] + ' ' + d.getDate();
  } else if (latestEl) {
    latestEl.textContent = '—';
  }

  /* 空状态 */
  if (!photos.length) {
    mineRenderEmpty(gridEl);
    mineRenderEmpty(fanEl);
    return;
  }

  const groups = mineGroupPhotos(photos);

  /* ---------- GRID VIEW ---------- */
  let gridHTML = '';
  let lastYear = null;
  groups.forEach(({ key, photos: grpPhotos }) => {
    const [yr, mo] = key.split('-');
    const year = parseInt(yr);
    const monthName = MONTH_NAMES[parseInt(mo) - 1];

    if (year !== lastYear) {
      gridHTML += `<div class="mine-year-anchor"><span class="mine-year-num">${yr}</span><div class="mine-year-line"></div></div>`;
      lastYear = year;
    }

    const cells = grpPhotos.slice(0, 9).map(p => {
      const label = mineFmtDateLabel(p.date);
      return `<div class="mine-cell" onclick="photoDetailOpen(${p.id})">
        <img src="${p.dataUrl}" alt="" loading="lazy">
        ${label ? `<div class="mine-cell-date">${label}</div>` : ''}
      </div>`;
    }).join('');

    gridHTML += `
      <div class="mine-tl-group">
        <div class="mine-tl-month">
          <div class="mine-tl-month-pill">
            <span class="mine-tl-month-name">${monthName}</span>
            <span class="mine-tl-month-yr">${yr}</span>
          </div>
          <div class="mine-tl-month-line"></div>
          <span class="mine-tl-month-cnt">${grpPhotos.length} photos</span>
        </div>
        <div class="mine-grid">${cells}</div>
      </div>
      <div class="mine-tl-spacer"></div>`;
  });
  gridEl.innerHTML = gridHTML;

  /* animate latest entry */
  if (animateLatest) {
    const firstCell = gridEl.querySelector('.mine-cell');
    if (firstCell) firstCell.classList.add('new-entry');
  }

  /* ---------- FAN VIEW ---------- */
  let fanHTML = '';
  lastYear = null;
  groups.forEach(({ key, photos: grpPhotos }) => {
    const [yr, mo] = key.split('-');
    const year = parseInt(yr);
    const monthName = MONTH_NAMES[parseInt(mo) - 1];

    if (year !== lastYear) {
      fanHTML += `<div class="mine-year-anchor"><span class="mine-year-num">${yr}</span><div class="mine-year-line"></div></div>`;
      lastYear = year;
    }

    const displayCards = grpPhotos.slice(0, 5);
    const extra = grpPhotos.length - displayCards.length;
    const n = displayCards.length;
    const spread = Math.min(20, 10 + n * 2);
    const step   = n > 1 ? (spread * 2) / (n - 1) : 0;
    const baseLeft = 14;
    const gap      = 26;

    const cards = displayCards.map((p, i) => {
      const angle = n > 1 ? (-spread + i * step) : 0;
      const left  = baseLeft + i * gap;
      const label = mineFmtDateLabel(p.date);
      return `<div class="mine-fan-card" style="left:${left}px;transform:rotate(${angle}deg)" data-rot="${angle}" data-left="${left}" onclick="photoDetailOpen(${p.id})">
        <img src="${p.dataUrl}" alt="" loading="lazy">
        ${label ? `<div class="mine-fan-card-date">${label}</div>` : ''}
      </div>`;
    }).join('');

    const moreTag = extra > 0 ? `<div class="mine-fan-more">+${extra}</div>` : '';

    fanHTML += `
      <div class="mine-fan-group">
        <div class="mine-fan-hdr">
          <div class="mine-fan-hdr-left">
            <div class="mine-fan-month-big">${monthName} <em>'${yr.slice(2)}</em></div>
            <div class="mine-fan-month-meta">
              <span class="mine-fan-month-yr">${yr}</span>
              <span class="mine-fan-cnt-badge">${grpPhotos.length} photos</span>
            </div>
          </div>
        </div>
        <div class="mine-fan-stage">${cards}${moreTag}</div>
        <div class="mine-fan-rule"></div>
      </div>`;
  });
  fanEl.innerHTML = fanHTML;

  if (animateLatest) {
    const firstGroup = fanEl.querySelector('.mine-fan-group');
    if (firstGroup) firstGroup.classList.add('new-entry');
  }

  /* 重新绑定扇形交互 */
  mineInitFan();
}

/* ================================================
   MINE PAGE — 视图切换 & 扇形交互
================================================ */

let _mineCurrentView = 'grid';

function mineSwitchView(v) {
  _mineCurrentView = v;
  const grid = document.getElementById('mineViewGrid');
  const fan  = document.getElementById('mineViewFan');
  const btnG = document.getElementById('mineTogGrid');
  const btnF = document.getElementById('mineTogFan');
  if (!grid || !fan) return;
  grid.style.display = v === 'grid' ? 'block' : 'none';
  fan.style.display  = v === 'fan'  ? 'block' : 'none';
  if (btnG) btnG.className = 'mine-tog' + (v === 'grid' ? ' on' : '');
  if (btnF) btnF.className = 'mine-tog' + (v === 'fan'  ? ' on' : '');
}

function mineInitFan() {
  document.querySelectorAll('.mine-fan-stage').forEach(stage => {
    const cards = Array.from(stage.querySelectorAll('.mine-fan-card'));
    const n = cards.length;
    cards.forEach(c => {
      c._rot  = parseFloat(c.dataset.rot)  || 0;
      c._left = parseFloat(c.dataset.left) || 0;
    });
    stage.addEventListener('touchstart', () => expandFan(stage, cards, n), { passive: true });
    stage.addEventListener('mouseenter', () => expandFan(stage, cards, n));
    stage.addEventListener('mouseleave', () => collapseFan(stage, cards));
    stage.addEventListener('touchend',   () => setTimeout(() => collapseFan(stage, cards), 900), { passive: true });
  });
}

function expandFan(stage, cards, n) {
  const spread   = 26;
  const step     = n > 1 ? (spread * 2) / (n - 1) : 0;
  const baseLeft = 14;
  const gap      = 32;
  cards.forEach((c, i) => {
    const angle = -spread + i * step;
    c.style.transform = `rotate(${angle}deg) translateY(-10px)`;
    c.style.left = (baseLeft + i * gap) + 'px';
    c.style.zIndex = i + 1;
  });
}

function collapseFan(stage, cards) {
  cards.forEach(c => {
    c.style.transform = `rotate(${c._rot}deg)`;
    c.style.left = c._left + 'px';
    c.style.zIndex = '';
  });
}

/* ================================================
   初始化
================================================ */
/* ================================================
   CHAR PAGE — 从 LunaCharDB 动态渲染角色文件夹
================================================ */

async function _charFetchAllFromDB() {
  try {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open('LunaCharDB', 4);
      req.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('chars'))
          d.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
      };
      req.onsuccess = e => res(e.target.result);
      req.onerror   = () => rej();
    });
    return await new Promise(res => {
      const r = db.transaction('chars').objectStore('chars').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror   = () => res([]);
    });
  } catch(e) { return []; }
}

async function charPageRender() {
  const chars    = await _charFetchAllFromDB();
  const list     = document.getElementById('charCardList');
  const actList  = document.getElementById('charActivityList');
  const countEl  = document.getElementById('charHeroCount');
  const activeId = parseInt(localStorage.getItem('luna_active_char')) || null;

  /* 更新 hero 计数 */
  if (countEl) countEl.textContent = String(chars.length).padStart(2, '0');

  /* ── 无角色时的空状态 ── */
  if (!list) return;
  if (chars.length === 0) {
    list.innerHTML = `
      <div style="text-align:center;padding:32px 20px 16px">
        <div style="font-size:9px;letter-spacing:.3em;color:#ccc;text-transform:uppercase;margin-bottom:8px">No Characters</div>
        <div style="font-size:12px;color:#bbb">前往角色档案页创建角色</div>
      </div>`;
    if (actList) actList.innerHTML = `
      <div class="char-tl-item">
        <div class="char-tl-bullet"></div>
        <div class="char-tl-yr">—</div>
        <div class="char-tl-text">暂无角色活动记录</div>
      </div>`;
    return;
  }

  /* ── 渲染卡片 ── */
  list.innerHTML = '';
  chars.forEach((c, i) => {
    const isActive = c.id === activeId;
    const letter   = (c.name || '?')[0].toUpperCase();
    const traits   = Array.isArray(c.traits) ? c.traits : [];
    const photoCount = Array.isArray(c.photos) ? c.photos.length : 0;
    const countStr   = String(photoCount).padStart(2, '0') + ' IMG';
    const metaStr    = [c.role, c.gender, c.age ? c.age + '岁' : ''].filter(Boolean).join(' · ');

    /* 头像：如果有 avatar 图则用 img，否则用首字母 */
    const avatarInner = c.avatar
      ? `<img src="${c.avatar}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:4px;">`
      : `<div class="fc2-init">${letter}</div>`;

    /* 标签 HTML */
    const tagsHtml = traits.slice(0, 3).map(t => `<div class="fc2-tag">${t}</div>`).join('');

    const div = document.createElement('div');
    div.className = 'fc2' + (isActive ? ' active-card' : '');
    div.onclick = () => {
      /* 实时从 DB 取最新数据再跳转 */
      _charFetchAllFromDB().then(fresh => {
        const latest = fresh.find(x => x.id === c.id) || c;
        sessionStorage.setItem('luna_char_album_data', JSON.stringify(latest));
        openCharAlbum(latest);
      });
    };
    div.innerHTML = `
      <div class="fc2-tab"></div>
      <div class="fc2-body">
        ${isActive ? '<div class="fc2-active-dot"></div>' : ''}
        <div class="fc2-photos">
          <div class="fc2-photo-main">${avatarInner}</div>
          <div class="fp l1"></div><div class="fp l2"></div><div class="fp l3"></div>
        </div>
        <div class="fc2-name">${c.name || '—'}</div>
        <div class="fc2-meta">${metaStr || '—'}</div>
        <div class="fc2-bottom">
          <div class="fc2-tags">${tagsHtml}</div>
          <div class="fc2-count">${countStr}</div>
        </div>
        <div class="fc2-deco-corner"></div>
      </div>`;
    list.appendChild(div);
  });

  /* ── 渲染 Recent Activity（最近3个角色的简单活动记录） ── */
  if (actList) {
    const today = new Date();
    const fmtDate = d => {
      const diff = Math.floor((today - d) / 86400000);
      if (diff === 0) return '今天';
      if (diff === 1) return '昨天';
      return (d.getMonth() + 1) + '/' + d.getDate();
    };

    /* 按 id 降序取最近3个作为活动记录 */
    const recent = chars.slice().sort((a, b) => b.id - a.id).slice(0, 3);
    const activeName = activeId ? (chars.find(c => c.id === activeId) || {}).name : null;

    actList.innerHTML = recent.map((c, i) => {
      /* 模拟活动文案 */
      let text;
      if (i === 0 && c.id === activeId) {
        text = `${c.name} 已激活 · 当前对话角色`;
      } else if (i === 0) {
        text = `${c.name} 档案已更新`;
      } else {
        text = `${c.name} 档案创建`;
      }
      /* 用 id 做伪时间偏移，id 越大越新 */
      const d = new Date(today - i * 86400000);
      return `<div class="char-tl-item">
        <div class="char-tl-bullet"></div>
        <div class="char-tl-yr">${fmtDate(d)}</div>
        <div class="char-tl-text">${text}</div>
      </div>`;
    }).join('');
  }
}

/* ── 当 LunaCharDB 有更新时自动刷新 char page ── */
window.addEventListener('storage', e => {
  if (e.key === 'luna_char_db_update') charPageRender();
});

(function init() {
  updateTime();
  updateBattery();
  applyIsland();
  applyGlobalFont();
  updateStats();
  mineRenderTimeline(false);
  charPageRender();
})();
/* ================================================
   SECRET PAGE — Social Redesign JS
   所有函数加 sct 前缀，避免冲突
================================================ */

/* ---- 内部 tab 切换 ---- */
function sctSwitch(name, btn) {
  document.querySelectorAll('.sct-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.sct-page').forEach(p => { p.style.display = 'none'; p.classList.remove('active'); });
  const target = document.getElementById('sct-pg-' + name);
  if (target) { target.style.display = 'flex'; target.classList.add('active'); }
}

/* ---- Like ---- */
function sctLike(btnId, countId) {
  const b = document.getElementById(btnId);
  const c = document.getElementById(countId);
  if (!b || !c) return;
  const on = b.classList.toggle('liked');
  const icon = b.querySelector('i');
  if (icon) icon.className = on ? 'ti ti-heart-filled' : 'ti ti-heart';
  c.textContent = parseInt(c.textContent) + (on ? 1 : -1);
}

/* ---- Save ---- */
function sctToggleSave(btnId) {
  const b = document.getElementById(btnId);
  if (!b) return;
  const on = b.classList.toggle('saved');
  const icon = b.querySelector('i');
  if (icon) {
    icon.style.color = on ? '#111' : '#999';
    icon.className = on ? 'ti ti-bookmark-filled' : 'ti ti-bookmark';
  }
}

/* ---- Share → open DM ---- */
function sctSendPost(name, label) {
  const dmBtn = document.querySelectorAll('.sct-tab')[1];
  if (dmBtn) sctSwitch('dm', dmBtn);
  document.getElementById('sctNavBadge').style.display = 'none';
  setTimeout(() => sctOpenChat(name, name[0], true, 'Shared: ' + label, 'now'), 200);
}

/* ---- Expand post (visual hint) ---- */
function sctExpandPost(el) {
  el.style.outline = '1.5px solid #111';
  setTimeout(() => el.style.outline = '', 400);
}

/* ---- Open chat ---- */
let sctCurChat = {};
function sctOpenChat(name, av, online, preview, time) {
  sctCurChat = { name, av, online };
  const els = ['sctCAv', 'sctCAvXs', 'sctCAvXs2'];
  els.forEach(id => { const e = document.getElementById(id); if (e) e.textContent = av; });
  const shareNameEl = document.getElementById('sctCShareName');
  if (shareNameEl) shareNameEl.textContent = name;
  const nameEl = document.getElementById('sctCName');
  if (nameEl) nameEl.textContent = name;
  const statusEl = document.getElementById('sctCStatus');
  if (statusEl) statusEl.textContent = online ? 'Active now' : 'Seen ' + time;

  const dm = document.getElementById('sct-pg-dm');
  if (dm) { dm.style.display = 'none'; dm.classList.remove('active'); }
  const chat = document.getElementById('sct-pg-chat');
  if (chat) { chat.style.display = 'flex'; chat.classList.add('active'); }
  setTimeout(() => { const s = document.querySelector('#sct-pg-chat .sct-msg-scroll'); if (s) s.scrollTop = s.scrollHeight; }, 60);
}

function sctBackToDM() {
  const chat = document.getElementById('sct-pg-chat');
  if (chat) { chat.style.display = 'none'; chat.classList.remove('active'); }
  const dm = document.getElementById('sct-pg-dm');
  if (dm) { dm.style.display = 'flex'; dm.classList.add('active'); }
}

function sctBackToFeed() {
  const feedBtn = document.querySelectorAll('.sct-tab')[0];
  if (feedBtn) sctSwitch('feed', feedBtn);
}

/* ---- Send message ---- */
function sctOnInputChange() {
  // no-op, visual only
}
function sctSendMsg() {
  const inp = document.getElementById('sctChatInput');
  if (!inp) return;
  const txt = inp.value.trim();
  if (!txt) return;
  const list = document.getElementById('sctMsgList');
  if (!list) return;
  const r = document.createElement('div');
  r.className = 'sct-msg-row me';
  r.innerHTML = `<div class="sct-msg-bub me">${txt}</div>`;
  list.appendChild(r);
  inp.value = '';
  const n = new Date();
  const ts = document.createElement('div');
  ts.className = 'sct-msg-ts';
  ts.style = 'text-align:right;padding-right:4px';
  ts.textContent = String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
  list.appendChild(ts);
  const scroll = document.querySelector('#sct-pg-chat .sct-msg-scroll');
  if (scroll) setTimeout(() => scroll.scrollTop = scroll.scrollHeight, 30);

  const replies = ['Noted.', 'Understood.', 'I see.', 'Interesting.', '...', 'Later.'];
  setTimeout(() => {
    const rep = document.createElement('div');
    rep.className = 'sct-msg-row them';
    rep.innerHTML = `<div class="sct-msg-av-xs">${sctCurChat.av || '?'}</div><div class="sct-msg-bub them">${replies[Math.floor(Math.random() * replies.length)]}</div>`;
    list.appendChild(rep);
    if (scroll) setTimeout(() => scroll.scrollTop = scroll.scrollHeight, 30);
  }, 1100);
}
(function() {
  const inp = document.getElementById('sctChatInput');
  if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') sctSendMsg(); });
})();

/* ---- Compose ---- */
let sctVisIdx = 0;
function sctShowCompose() {
  const o = document.getElementById('sctComposeOverlay');
  if (o) o.style.display = 'flex';
}
function sctHideCompose() {
  const o = document.getElementById('sctComposeOverlay');
  if (o) o.style.display = 'none';
}
function sctSelectVis(i) {
  sctVisIdx = i;
  ['sctVo1', 'sctVo2', 'sctVo3'].forEach((id, j) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.borderColor = j === i ? '#111' : '#e8e8e8';
    el.style.color = j === i ? '#111' : '#bbb';
  });
}
function sctSubmitPost() {
  const txt = document.getElementById('sctComposeText');
  if (!txt || !txt.value.trim()) { sctHideCompose(); return; }
  const feed = document.querySelector('#sct-pg-feed .sct-scroll');
  if (!feed) { sctHideCompose(); return; }
  const card = document.createElement('div');
  card.className = 'sct-post-card';
  const vis = ['Only me', 'Inner circle', 'Archive'][sctVisIdx];
  card.innerHTML = `
    <div class="sct-post-strip">
      <div class="sct-post-strip-l"><div class="sct-post-av" style="background:#111;color:#fff;font-family:'Inter',sans-serif;font-style:normal;font-size:9px;font-weight:700;">Y</div><div><div class="sct-post-author">You</div><div class="sct-post-sub">${vis} · Just now</div></div></div>
      <div class="sct-post-strip-r"><span class="sct-post-index">New</span></div>
    </div>
    <div class="sct-text-card" style="min-height:120px">
      <div class="sct-ptc-quote" style="font-size:17px">${txt.value.trim()}</div>
      <div class="sct-ptc-foot"><span class="sct-ptc-date">Just now</span><span class="sct-ptc-sig">You</span></div>
    </div>
    <div class="sct-post-bottom">
      <div class="sct-post-actions"><div class="sct-pa-l"><button class="sct-pa-btn"><i class="ti ti-heart" aria-hidden="true"></i></button></div></div>
      <div class="sct-post-saves">0 saves</div>
    </div>`;
  feed.insertBefore(card, feed.firstChild);
  txt.value = '';
  const cc = document.getElementById('sctCharCount');
  if (cc) cc.textContent = '0 / 200';
  sctHideCompose();
}
(function() {
  const t = document.getElementById('sctComposeText');
  if (t) t.addEventListener('input', function() {
    const cc = document.getElementById('sctCharCount');
    if (cc) cc.textContent = this.value.length + ' / 200';
  });
  const ds = document.getElementById('sctDmSearch');
  if (ds) ds.addEventListener('input', function() {
    const q = this.value.toLowerCase();
    document.querySelectorAll('#sctDmList .sct-dm-row').forEach(r => {
      const n = r.querySelector('.sct-dm-name');
      r.style.display = (!q || (n && n.textContent.toLowerCase().includes(q))) ? 'flex' : 'none';
    });
  });
  // show badge on page load
  const badge = document.getElementById('sctNavBadge');
  if (badge) badge.style.display = 'block';
})();
/* ================================================
   MINE UPLOAD MODAL
================================================ */
function mineOpenUpload() {
  const o = document.getElementById('mineUploadOverlay');
  if (o) o.classList.add('open');
}

function mineCloseUpload() {
  const o = document.getElementById('mineUploadOverlay');
  if (o) o.classList.remove('open');
  mupReset();
}

function mupTriggerFile() {
  document.getElementById('mupFileInput').click();
}

function mupHandleFile(inp) {
  const f = inp.files[0];
  if (!f) return;
  const kb = f.size / 1024;
  const sz = kb > 1024 ? (kb / 1024).toFixed(1) + ' MB' : Math.round(kb) + ' KB';
  const fmt = f.name.split('.').pop().toUpperCase();
  document.getElementById('mupSize').textContent = sz;
  document.getElementById('mupFmt').textContent = fmt;
  const r = new FileReader();
  r.onload = function(e) {
    const zone = document.getElementById('mupZone');
    const nm = f.name.length > 20 ? f.name.slice(0, 18) + '…' : f.name;
    zone.className = 'mup-zone filled';
    zone.onclick = null;
    zone.innerHTML = `<img class="mup-prev-img" src="${e.target.result}" alt="preview">
      <div class="mup-prev-corner tl"></div><div class="mup-prev-corner tr"></div>
      <div class="mup-prev-bar">
        <span class="mup-prev-name">${nm}</span>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="mup-prev-size">${sz}</span>
          <button class="mup-prev-change" onclick="mupChangeFile(event)">Change</button>
        </div>
      </div>`;
    document.getElementById('mupSubmit').disabled = false;
  };
  r.readAsDataURL(f);
}

function mupChangeFile(e) {
  e.stopPropagation();
  const zone = document.getElementById('mupZone');
  zone.className = 'mup-zone';
  zone.onclick = mupTriggerFile;
  zone.innerHTML = `<i class="ti ti-photo" style="font-size:24px;color:#bbb" aria-hidden="true"></i>
    <span class="mup-zone-txt">Select a photo to upload</span>
    <span class="mup-zone-sub">JPG · PNG · WEBP · Max 20MB</span>`;
  document.getElementById('mupFileInput').value = '';
  document.getElementById('mupSize').textContent = '—';
  document.getElementById('mupFmt').textContent = '—';
  document.getElementById('mupSubmit').disabled = true;
}

function mupOnDesc() {
  const v = document.getElementById('mupDesc').value.length;
  document.getElementById('mupCB').textContent = v + '/200';
  document.getElementById('mupChars').textContent = v;
}

function mupToggleCap() {
  const tog = document.getElementById('mupTog');
  const area = document.getElementById('mupCapArea');
  tog.classList.toggle('on');
  area.classList.toggle('open');
}

function mupPickTag(el, tag) {
  el.classList.toggle('on');
  const ta = document.getElementById('mupCapTa');
  if (el.classList.contains('on')) {
    if (!ta.value.includes(tag)) ta.value = (ta.value + ' ' + tag).trim();
  } else {
    ta.value = ta.value.replace(tag, '').replace(/\s+/g, ' ').trim();
  }
}

function mupReset() {
  mupChangeFile({ stopPropagation: () => {} });
  const desc = document.getElementById('mupDesc');
  const capTa = document.getElementById('mupCapTa');
  const cb = document.getElementById('mupCB');
  const chars = document.getElementById('mupChars');
  if (desc) desc.value = '';
  if (capTa) capTa.value = '';
  if (cb) cb.textContent = '0/200';
  if (chars) chars.textContent = '0';
  const tog = document.getElementById('mupTog');
  const area = document.getElementById('mupCapArea');
  if (tog && tog.classList.contains('on')) { tog.classList.remove('on'); area.classList.remove('open'); }
  document.querySelectorAll('.mup-tag.on').forEach(t => t.classList.remove('on'));
}

/* 点击遮罩层关闭 */
document.getElementById('mineUploadOverlay').addEventListener('click', function(e) {
  if (e.target === this) mineCloseUpload();
});

/* ---- 上传提交：保存到 IndexedDB 并刷新时间轴 ---- */
async function mupSubmitPhoto() {
  const submitBtn = document.getElementById('mupSubmit');
  if (!submitBtn || submitBtn.disabled) return;

  /* 读取图片 dataUrl */
  const img = document.querySelector('#mupZone .mup-prev-img');
  if (!img) return;
  const dataUrl = img.src;

  /* 读取元信息 */
  const filename = (document.querySelector('#mupZone .mup-prev-name') || {}).textContent || 'photo';
  const size     = (document.getElementById('mupSize') || {}).textContent || '—';
  const fmt      = (document.getElementById('mupFmt') || {}).textContent || '—';
  const desc     = (document.getElementById('mupDesc') || {}).value || '';
  const caption  = (document.getElementById('mupCapTa') || {}).value || '';
  const date     = new Date().toISOString(); /* 以上传时间为照片日期 */

  /* 禁用按钮防重复 */
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="ti ti-loader-2" style="font-size:14px;animation:spin .7s linear infinite" aria-hidden="true"></i> Saving...';

  /* 添加 spin 动画（如无） */
  if (!document.getElementById('mup-spin-style')) {
    const s = document.createElement('style');
    s.id = 'mup-spin-style';
    s.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(s);
  }

  try {
    await mineSavePhoto({ dataUrl, filename, size, fmt, desc, caption, date });

    /* 同步 stats localStorage */
    const cur = parseInt(localStorage.getItem('luna_stat_photos') || '0');
    localStorage.setItem('luna_stat_photos', cur + 1);

    /* 关闭弹窗 */
    mineCloseUpload();

    /* 重新渲染时间轴（带入场动画） */
    await mineRenderTimeline(true);

    /* 更新顶部统计 */
    updateStats();

  } catch (err) {
    console.error('Upload save error:', err);
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="ti ti-upload" style="font-size:14px" aria-hidden="true"></i> Upload photo';
  }
}
/* ================================================
   PHOTO DETAIL OVERLAY
   从 IndexedDB 读取真实照片数据填充
================================================ */

let _pdCurrentPhoto = null;   // 当前展示的照片对象
let _pdSaved = false;          // 当前是否已收藏

/* 格式化日期为 "Month DD, YYYY" */
function pdFmtDateLong(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return '—';
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

/* 格式化日期为 "YYYY · MM-DD · Personal" */
function pdFmtDateline(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return '—';
  const yr = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return yr + ' · ' + mm + '-' + dd + ' · Personal';
}

/* 打开详情弹窗 */
async function photoDetailOpen(id) {
  const db = await mineOpenDB();
  const photo = await new Promise(res => {
    const req = db.transaction(MINE_STORE).objectStore(MINE_STORE).get(id);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => res(null);
  });
  if (!photo) return;

  _pdCurrentPhoto = photo;
  _pdSaved = false;

  /* 获取所有照片以确定序号 */
  const allPhotos = await mineLoadAllPhotos();
  const sortedIds = allPhotos
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(p => p.id);
  const idx = sortedIds.indexOf(id);
  const num = idx >= 0 ? String(idx + 1).padStart(3, '0') : '—';

  /* ---- 填充图片 ---- */
  const photoEl = document.getElementById('pdPhoto');
  const placeholder = document.getElementById('pdPhotoPlaceholder');

  // 移除旧的 img 如存在
  const oldImg = photoEl.querySelector('img');
  if (oldImg) oldImg.remove();
  placeholder.style.display = 'none';

  const img = document.createElement('img');
  img.src = photo.dataUrl;
  img.alt = photo.filename || '';
  img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
  photoEl.insertBefore(img, photoEl.firstChild);

  /* ---- 元数据 ---- */
  document.getElementById('pdDateline').textContent   = pdFmtDateline(photo.date);
  document.getElementById('pdIndex').textContent      = 'No. ' + num;
  document.getElementById('pdFmt').textContent        = photo.fmt || '—';
  document.getElementById('pdDateFull').textContent   = pdFmtDateLong(photo.date);

  /* ---- 随机 Views（模拟，基于 id 保持稳定） */
  const views = 3 + (id * 7) % 97;
  document.getElementById('pdViews').textContent = views;
  document.getElementById('pdSaves').textContent = '0';

  /* ---- desc / caption / tags ---- */
  const hasDesc    = photo.desc && photo.desc.trim();
  const hasCaption = photo.caption && photo.caption.trim();
  const body = document.getElementById('pdBody');
  const noNote = document.getElementById('pdNoNote');

  if (hasDesc || hasCaption) {
    body.style.display = 'block';
    noNote.style.display = 'none';

    /* Tags — 从 caption 里解析 #tag */
    const tagsEl = document.getElementById('pdTags');
    if (hasCaption) {
      const matches = photo.caption.match(/#\w+/g) || [];
      if (matches.length) {
        tagsEl.innerHTML = matches.map(t =>
          `<span class="pc-tag">${t}</span>`
        ).join('');
        tagsEl.style.display = 'flex';
      } else {
        tagsEl.innerHTML = '';
        tagsEl.style.display = 'none';
      }
    } else {
      tagsEl.innerHTML = '';
      tagsEl.style.display = 'none';
    }

    const descEl = document.getElementById('pdDesc');
    const capEl  = document.getElementById('pdCaption');

    if (hasDesc) {
      descEl.textContent = '\u201c' + photo.desc.trim() + '\u201d';
      descEl.style.display = 'block';
    } else {
      descEl.style.display = 'none';
    }

    if (hasCaption) {
      // 去掉 tag 只显示纯文字部分
      const plain = photo.caption.replace(/#\w+/g, '').trim();
      if (plain) {
        capEl.textContent = plain;
        capEl.style.display = 'block';
      } else {
        capEl.style.display = 'none';
      }
    } else {
      capEl.style.display = 'none';
    }
  } else {
    body.style.display = 'none';
    noNote.style.display = 'flex';
  }

  /* ---- 评论区 ---- */
  _pdLoadComments(id);

  /* ---- 收藏状态重置 ---- */
  const saveBtn = document.getElementById('pdSaveBtn');
  if (saveBtn) {
    const icon = saveBtn.querySelector('i');
    if (icon) icon.className = 'ti ti-bookmark';
    saveBtn.style.background = '';
    saveBtn.style.borderColor = '';
  }

  /* ---- 打开弹窗 ---- */
  const overlay = document.getElementById('photoDetailOverlay');
  if (overlay) overlay.classList.add('open');

  /* 更新 views 到 DB（可选，写回） */
  try {
    const tx2 = db.transaction(MINE_STORE, 'readwrite');
    const store = tx2.objectStore(MINE_STORE);
    const get2 = store.get(id);
    get2.onsuccess = () => {
      const rec = get2.result;
      if (rec) {
        rec.views = (rec.views || views) + 1;
        store.put(rec);
        document.getElementById('pdViews').textContent = rec.views;
      }
    };
  } catch(e) {}
}

/* 关闭弹窗（带退出动画） */
function photoDetailClose() {
  const overlay = document.getElementById('photoDetailOverlay');
  if (!overlay || !overlay.classList.contains('open')) return;
  overlay.classList.remove('open');
  overlay.classList.add('closing');
  setTimeout(() => {
    overlay.classList.remove('closing');
    _pdCurrentPhoto = null;
  }, 200);
}

/* 点击遮罩关闭 */
function photoDetailOnBgClick(e) {
  if (e.target === document.getElementById('photoDetailOverlay')) {
    photoDetailClose();
  }
}

/* ---- 收藏切换 ---- */
function pdToggleSave() {
  _pdSaved = !_pdSaved;
  const btn = document.getElementById('pdSaveBtn');
  const icon = btn && btn.querySelector('i');
  const saveCount = document.getElementById('pdSaves');

  if (_pdSaved) {
    if (icon) icon.className = 'ti ti-bookmark-filled';
    btn.style.background = '#111';
    btn.style.borderColor = '#111';
    if (icon) icon.style.color = '#fff';
    const n = parseInt(saveCount.textContent) || 0;
    saveCount.textContent = n + 1;
  } else {
    if (icon) icon.className = 'ti ti-bookmark';
    btn.style.background = '';
    btn.style.borderColor = '';
    if (icon) icon.style.color = '';
    const n = parseInt(saveCount.textContent) || 0;
    saveCount.textContent = Math.max(0, n - 1);
  }
}

/* ---- 聚焦评论输入框 ---- */
function pdFocusComment() {
  const inp = document.getElementById('pdCmtInput');
  if (inp) {
    inp.focus();
    const card = document.getElementById('photoDetailCard');
    if (card) setTimeout(() => card.scrollTop = card.scrollHeight, 100);
  }
}

/* ---- 加载评论（从 localStorage 按 photo id） ---- */
function _pdLoadComments(id) {
  const key = 'luna_album_cmts_' + id;
  let cmts = [];
  try { cmts = JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) {}

  const list = document.getElementById('pdCmtList');
  const cnt  = document.getElementById('pdCmtCount');
  const lbl  = document.getElementById('pdCmtCountLabel');

  if (!list) return;
  list.innerHTML = '';

  if (cmts.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:10px 0 4px">
      <span style="font-size:11px;color:#ccc;font-family:'DM Mono',monospace;letter-spacing:.04em">Be the first to reply.</span>
    </div>`;
  } else {
    cmts.forEach(c => {
      const div = document.createElement('div');
      div.className = 'pc-cmt';
      div.innerHTML = `
        <div class="pc-cmt-av">${c.av}</div>
        <div class="pc-cmt-body">
          <div class="pc-cmt-name">${c.name}</div>
          <div class="pc-cmt-text">${c.text}</div>
          <div class="pc-cmt-time">${c.time}</div>
        </div>`;
      list.appendChild(div);
    });
  }

  const n = cmts.length;
  if (cnt) cnt.textContent = n;
  if (lbl) lbl.textContent = n + (n === 1 ? ' reply' : ' replies');
}

/* ---- 发送评论 ---- */
function pdSendComment() {
  if (!_pdCurrentPhoto) return;
  const inp = document.getElementById('pdCmtInput');
  if (!inp) return;
  const txt = inp.value.trim();
  if (!txt) return;

  const id  = _pdCurrentPhoto.id;
  const key = 'luna_album_cmts_' + id;
  let cmts = [];
  try { cmts = JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) {}

  const now = new Date();
  cmts.push({
    av:   'ME',
    name: 'You',
    text: txt,
    time: String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0')
  });
  localStorage.setItem(key, JSON.stringify(cmts));
  inp.value = '';
  _pdLoadComments(id);

  /* 滚动到底部 */
  const card = document.getElementById('photoDetailCard');
  if (card) setTimeout(() => card.scrollTop = card.scrollHeight, 50);
}

/* 支持 Enter 键发送 */
document.addEventListener('DOMContentLoaded', function() {
  const inp = document.getElementById('pdCmtInput');
  if (inp) inp.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') pdSendComment();
  });

  /* 点击弹窗内照片区域打开大图查看页 */
  const pdPhoto = document.getElementById('pdPhoto');
  if (pdPhoto) {
    pdPhoto.addEventListener('click', function() {
      if (!_pdCurrentPhoto) return;
      lbOpen(_pdCurrentPhoto);
    });
    pdPhoto.style.cursor = 'pointer';
  }

  /* ---- 从 characters.html 跳转过来时，自动打开角色相册页 ---- */
  const params = new URLSearchParams(window.location.search);
  const charId = params.get('charId');
  if (charId) {
    /* 优先读 sessionStorage 里序列化的完整角色数据 */
    try {
      const raw = sessionStorage.getItem('luna_char_album_data');
      if (raw) {
        const charData = JSON.parse(raw);
        /* 延迟一帧，等主页面渲染完成 */
        requestAnimationFrame(() => openCharAlbum(charData));
        return;
      }
    } catch(e) {}

    /* 降级：从 IndexedDB 里取 */
    (async () => {
      try {
        const req = indexedDB.open('LunaCharDB', 4);
        req.onsuccess = async (e) => {
          const db = e.target.result;
          const tx = db.transaction('chars');
          const r  = tx.objectStore('chars').get(parseInt(charId));
          r.onsuccess = () => {
            if (r.result) requestAnimationFrame(() => openCharAlbum(r.result));
          };
        };
      } catch(e) {}
    })();
  }
});

/* ================================================
   PHOTO VIEWER — 大图查看页
   风格：photo_viewer_topbottom_preview
================================================ */

let _lbPhoto  = null;   // 当前大图查看的照片对象
let _lbLiked  = false;
let _lbSaved  = false;

/* 格式化日期：May 23, 2026 · 14:27 */
function lbFmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];
  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' · ' + hh + ':' + mm;
}

/* 打开大图查看页 */
function lbOpen(photo) {
  const lb  = document.getElementById('photoLightbox');
  const img = document.getElementById('lbImg');
  if (!lb || !img || !photo) return;

  _lbPhoto = photo;
  _lbLiked = false;
  _lbSaved = false;

  /* 先清空比例，防止闪烁 */
  const box = document.getElementById('lbPhotoBox');
  if (box) {
    box.style.aspectRatio = '';
    box.style.width = '100%';
    box.style.height = 'auto';
  }

  /* 图片加载后根据真实比例设置框的 aspect-ratio */
  img.onload = function() {
    if (!box) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return;
    /* 以宽度为基准，按比例限高 */
    box.style.aspectRatio = w + ' / ' + h;
    box.style.width = '100%';
    box.style.height = 'auto';
  };
  img.src = photo.dataUrl || '';

  /* 顶部中间：序号 + 格式 */
  const allPhotos = [];  /* 序号在异步加载后更新 */
  const fmt = photo.fmt || 'IMG';
  document.getElementById('lbTopMid').textContent = '—  · ' + fmt;

  /* 异步拿序号 */
  mineLoadAllPhotos().then(function(all) {
    const sorted = all.slice().sort((a,b) => new Date(a.date) - new Date(b.date));
    const idx = sorted.findIndex(p => p.id === photo.id);
    const num = idx >= 0 ? 'No. ' + String(idx + 1).padStart(3,'0') : 'No. —';
    document.getElementById('lbTopMid').textContent = num + ' · ' + fmt;
  });

  /* 日期 */
  document.getElementById('lbDate').textContent = lbFmtDate(photo.date);

  /* 文案 */
  const capEl = document.getElementById('lbCaption');
  if (photo.desc && photo.desc.trim()) {
    capEl.textContent = '\u201c' + photo.desc.trim() + '\u201d';
    capEl.style.display = 'block';
  } else {
    capEl.style.display = 'none';
  }

  /* 标签 */
  const tagsEl = document.getElementById('lbTags');
  tagsEl.innerHTML = '';
  if (photo.caption) {
    const matches = photo.caption.match(/#\w+/g) || [];
    matches.forEach(t => {
      const span = document.createElement('span');
      span.className = 'lb-ptag';
      span.textContent = t;
      tagsEl.appendChild(span);
    });
  }

  /* 重置喜欢/收藏按钮状态 */
  _lbSetLiked(false);
  _lbSetSaved(false);

  /* 打开 */
  lb.classList.remove('closing');
  lb.classList.add('open');
}

function lbClose() {
  const lb = document.getElementById('photoLightbox');
  if (!lb || !lb.classList.contains('open')) return;
  lb.classList.remove('open');
  lb.classList.add('closing');
  setTimeout(() => {
    lb.classList.remove('closing');
    _lbPhoto = null;
    const img = document.getElementById('lbImg');
    if (img) img.src = '';
  }, 200);
}

/* ---- 喜欢 ---- */
function _lbSetLiked(on) {
  _lbLiked = on;
  const item  = document.getElementById('lbLikeItem');
  const label = document.getElementById('lbLikeLabel');
  const icon  = document.getElementById('lbLikeIcon');
  if (!item) return;
  item.classList.toggle('liked', on);
  if (label) label.textContent = on ? '已喜欢' : '喜欢';
  if (icon)  icon.className = on ? 'ti ti-heart-filled lb-ctx-icon' : 'ti ti-heart lb-ctx-icon';
}
function lbToggleLike() { _lbSetLiked(!_lbLiked); }

/* ---- 收藏（同步到弹窗 Save 状态） ---- */
function _lbSetSaved(on) {
  _lbSaved = on;
  const item  = document.getElementById('lbSaveItem');
  const label = document.getElementById('lbSaveLabel');
  const icon  = document.getElementById('lbSaveIcon');
  if (!item) return;
  item.classList.toggle('saved', on);
  if (label) label.textContent = on ? '已收藏' : '收藏';
  if (icon)  icon.className = on ? 'ti ti-bookmark-filled lb-ctx-icon' : 'ti ti-bookmark lb-ctx-icon';

  /* 同步弹窗里的 Save 按钮 */
  if (_pdSaved !== on) pdToggleSave();
}
function lbToggleSave() { _lbSetSaved(!_lbSaved); }

/* ---- 导出（下载原图） ---- */
function lbExport() {
  if (!_lbPhoto || !_lbPhoto.dataUrl) return;
  const a = document.createElement('a');
  a.href = _lbPhoto.dataUrl;
  a.download = _lbPhoto.filename || 'photo.jpg';
  a.click();
}

/* ---- 编辑备注（关闭大图，打开弹窗并聚焦评论） ---- */
function lbEditNote() {
  lbClose();
  setTimeout(() => pdFocusComment(), 250);
}

/* ---- 删除照片 ---- */
async function lbDeletePhoto() {
  if (!_lbPhoto) return;
  const id = _lbPhoto.id;
  lbClose();
  setTimeout(() => photoDetailClose(), 50);

  /* 从 IndexedDB 删除 */
  try {
    const db = await mineOpenDB();
    await new Promise((res, rej) => {
      const tx  = db.transaction(MINE_STORE, 'readwrite');
      const req = tx.objectStore(MINE_STORE).delete(id);
      req.onsuccess = res;
      req.onerror   = rej;
    });
    /* 同步统计 */
    const cur = parseInt(localStorage.getItem('luna_stat_photos') || '0');
    localStorage.setItem('luna_stat_photos', Math.max(0, cur - 1));
    await mineRenderTimeline(false);
    updateStats();
  } catch(e) {
    console.error('Delete error:', e);
  }
}

/* ---- 更多按钮（预留，目前无操作） ---- */
function lbToggleMore() {}

/* ESC 键关闭大图 */
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const lb = document.getElementById('photoLightbox');
    if (lb && lb.classList.contains('open')) lbClose();
  }
});
/* ================================================
   CHAR ALBUM PAGE
   openCharAlbum(charData) — 从 characters.html 调用
   closeCharAlbum()        — 返回
================================================ */

/* 当前展示的角色数据 */
let _caChar = null;

/* ---- 从 LunaCharDB 实时读取单个角色最新数据 ---- */
async function _caFetchCharFromDB(charId) {
  try {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open('LunaCharDB', 4);
      req.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('chars'))
          d.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
      };
      req.onsuccess = e => res(e.target.result);
      req.onerror   = () => rej();
    });
    return await new Promise(res => {
      const r = db.transaction('chars').objectStore('chars').get(charId);
      r.onsuccess = () => res(r.result || null);
      r.onerror   = () => res(null);
    });
  } catch(e) { return null; }
}

/* ---- 打开角色相册页 ---- */
async function openCharAlbum(charData) {
  const page = document.getElementById('charAlbumPage');
  if (!page) return;

  /* 1. 实时从 LunaCharDB 读取最新角色数据（确保同步） */
  const fresh = await _caFetchCharFromDB(charData.id);
  _caChar = fresh || charData;

  /* 2. 同步状态栏 / 灵动岛 */
  _caApplyStatusBar();

  /* 3. 填充角色基本信息（含剧本） */
  _caFillHero(_caChar);

  /* 4. 加载该角色专属照片（仅从 LunaCharDB，不读用户相册） */
  await _caLoadPhotos(_caChar);

  /* 5. 滑入 */
  page.classList.add('show');
}

/* ---- 关闭角色相册页 ---- */
function closeCharAlbum() {
  const page = document.getElementById('charAlbumPage');
  if (page) page.classList.remove('show');
  _caChar = null;
}

/* ---- 同步状态栏 ---- */
function _caApplyStatusBar() {
  /* 时间 */
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeStr = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const tEl = document.getElementById('caStatusTime');
  if (tEl) tEl.textContent = timeStr;

  /* 电量 */
  const pctEl   = document.getElementById('caBatPct');
  const innerEl = document.getElementById('caBatInner');
  function renderBat(p) {
    p = Math.round(p);
    if (pctEl)   pctEl.textContent = p;
    if (innerEl) {
      innerEl.style.width = p + '%';
      innerEl.style.background = p <= 20
        ? 'linear-gradient(90deg,#f87171,#ef4444)'
        : 'linear-gradient(90deg,#6ee7b7,#34d399)';
    }
  }
  if ('getBattery' in navigator) {
    navigator.getBattery().then(b => renderBat(b.level * 100));
  } else { renderBat(76); }

  /* 灵动岛 */
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const islandEl = document.getElementById('caStatusIsland');
  if (!islandEl) return;
  if (!enabled) { islandEl.innerHTML = ''; return; }
  const styleMap = {
    minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
    clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="caIslandClock">--:--</span></div></div>`,
    pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
    ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
    rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
    music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
    scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
  };
  islandEl.innerHTML = styleMap[style] || styleMap.minimal;
  clearInterval(window._caIslandClock);
  if (style === 'clock') {
    const tick = () => {
      const el = document.getElementById('caIslandClock');
      if (!el) return;
      const now = new Date();
      el.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0');
    };
    tick();
    window._caIslandClock = setInterval(tick, 10000);
  }
}

/* ---- 填充 Hero 信息（含剧本同步） ---- */
function _caFillHero(c) {
  if (!c) return;

  /* 编号（用 id 做序号） */
  const idx = String(c.id || 1).padStart(3, '0');
  const idxEl = document.getElementById('caHeroIndex');
  if (idxEl) idxEl.textContent = `NO. ${idx} · CHAR ALBUM`;

  /* 激活状态 */
  const activeId = parseInt(localStorage.getItem('luna_active_char'));
  const isActive = c.id === activeId;
  const pillTxt = document.getElementById('caActiveStatus');
  const pill    = document.getElementById('caActivePill');
  if (pillTxt) pillTxt.textContent = isActive ? 'Active' : 'Standby';
  if (pill) {
    pill.style.background = isActive ? '#111' : '#f0f0f0';
    if (pillTxt) pillTxt.style.color = isActive ? '#e0e0e0' : '#bbb';
    const dot = pill.querySelector('.ca-active-pill-dot');
    if (dot) dot.style.background = isActive ? '#777' : '#ccc';
  }

  /* 角色定位 / 名字 / 副标题 */
  const roleEl = document.getElementById('caHeroRole');
  const nameEl = document.getElementById('caHeroName');
  const subEl  = document.getElementById('caHeroSub');
  if (roleEl) roleEl.textContent = c.role || 'AI Character';
  if (nameEl) nameEl.textContent = c.name || '—';
  if (subEl)  subEl.textContent  = `${c.gender || 'AI'} · Character Profile`;

  /* 头像 */
  const avEl     = document.getElementById('caAvatar');
  const letterEl = document.getElementById('caAvatarLetter');
  if (avEl) {
    if (c.avatar) {
      avEl.innerHTML = `<img src="${c.avatar}" alt="avatar"><div class="ca-avatar-ring"></div>`;
    } else {
      const letter = (c.name || '?')[0].toUpperCase();
      if (letterEl) letterEl.textContent = letter;
    }
  }

  /* 性格标签 */
  const traitsEl = document.getElementById('caTraits');
  if (traitsEl) {
    traitsEl.innerHTML = (c.traits || [])
      .map(t => `<span class="ca-trait">${t}</span>`)
      .join('');
  }

  /* 四格信息 */
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
  set('caMAge',    c.age);
  set('caMGender', c.gender);
  set('caMBday',   c.birthday);

  /* 剧本 / Prompt 同步（如果页面有对应元素） */
  const promptEl = document.getElementById('caPrompt');
  if (promptEl) promptEl.textContent = c.prompt || '（未设置剧本）';
  const descEl = document.getElementById('caDesc');
  if (descEl) descEl.textContent = c.desc || '';
}

/* ---- 加载该角色专属照片（仅从 LunaCharDB 角色记录的 photos 字段，不读用户相册） ---- */
async function _caLoadPhotos(charObj) {
  /*
   * 照片来源：LunaCharDB → chars → 该角色记录的 photos 数组
   * 每条照片格式：{ dataUrl, filename, date, caption? }
   * 用户在 Mine 页上传的照片存在 LunaAlbumDB，完全不读取，杜绝混入。
   */
  let photos = [];

  /* 如果传入的是 charObj（对象），直接取 photos 字段；否则当 charId 重新从 DB 取 */
  if (charObj && typeof charObj === 'object') {
    photos = Array.isArray(charObj.photos) ? charObj.photos : [];
  } else {
    /* 兼容：传入的是 charId 数字时，从 DB 重新取 */
    const fresh = await _caFetchCharFromDB(charObj);
    photos = (fresh && Array.isArray(fresh.photos)) ? fresh.photos : [];
  }

  /* 按日期降序 */
  photos = photos.slice().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  const total = photos.length;

  /* 更新计数 */
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('caMPhotos',    total);
  setEl('caStatPhotos', total);
  setEl('caStatMoments', total);
  setEl('caGalCnt',     `/ ${total}`);
  setEl('caDaylapseTag', `${total} moments`);

  /* 月份标签（取最新照片的月份） */
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (photos.length > 0) {
    const latest = new Date(photos[0].date || Date.now());
    setEl('caMonthName',  monthNames[latest.getMonth()]);
    setEl('caMonthYr',    latest.getFullYear());
    setEl('caMonthCount', `${photos.length} photos`);
  } else {
    setEl('caMonthName',  new Date().toLocaleString('en', { month: 'short' }));
    setEl('caMonthYr',    new Date().getFullYear());
    setEl('caMonthCount', '0 photos');
  }

  /* 渲染网格 */
  const grid    = document.getElementById('caGrid');
  const emptyEl = document.getElementById('caEmptyState');
  if (!grid) return;

  if (photos.length === 0) {
    grid.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  /* 最多展示 12 张 */
  grid.innerHTML = photos.slice(0, 12).map(p => {
    const dateStr = p.date
      ? new Date(p.date).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }).replace('/', '.')
      : '';
    return `<div class="ca-cell">
      <img src="${p.dataUrl}" alt="${p.filename || ''}" loading="lazy">
      <span class="ca-cell-date">${dateStr}</span>
    </div>`;
  }).join('');
}

/* ---- 监听主页面设置变更，同步更新状态栏 & 角色数据 ---- */
window.addEventListener('storage', async e => {
  const page = document.getElementById('charAlbumPage');
  if (!page || !page.classList.contains('show')) return;

  if (e.key === 'luna_island_update') _caApplyStatusBar();
  if (e.key === 'luna_tz_update')     _caApplyStatusBar();

  /* 当角色数据有变更时，实时重新从 LunaCharDB 拉取并刷新 */
  if (e.key === 'luna_char_update' && _caChar) {
    const fresh = await _caFetchCharFromDB(_caChar.id);
    if (fresh) {
      _caChar = fresh;
      _caFillHero(_caChar);
      await _caLoadPhotos(_caChar);
    }
  }
});