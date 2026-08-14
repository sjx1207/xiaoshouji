/* ================================================================
   档案袋 · dossier.js
   —— 与 characters.html 共用同一份 LunaCharDB / chars store
   —— 仅读取并展示基础资料字段，绝不触碰人设/性格/背景故事等机密字段
   —— 单一珠光白 ins 风档案卡（重设计版，替换原 20 种材质拼贴风格）
================================================================ */

/* ---------------- 状态栏：完整同步主应用逻辑 ---------------- */
function updateTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const now = new Date();
  const s = now.toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  document.querySelectorAll('.status-time').forEach(el => el.textContent = s);
}

function updateBattery() {
  function render(pct) {
    const p = Math.round(pct);
    document.querySelectorAll('.bat-pct').forEach(el => el.textContent = p);
    document.querySelectorAll('.bat-inner').forEach(el => {
      el.style.width      = p + '%';
      el.style.background = p <= 20
        ? 'linear-gradient(90deg,#f3b8c4,#e88ba0)'
        : 'linear-gradient(90deg,#b7e3c9,#8fd6ac)';
    });
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

function applyIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const styleMap = {
    minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
    clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text">--:--</span></div></div>`,
    pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
    ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
    rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
    music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
    scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
  };
  document.querySelectorAll('.status-island').forEach(el => {
    el.innerHTML = enabled ? (styleMap[style] || styleMap.minimal) : '';
  });
  clearInterval(window._siClockTimer);
  if (enabled && style === 'clock') {
    const tick = () => {
      const now = new Date();
      const t = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
      document.querySelectorAll('.si-clock-text').forEach(el => el.textContent = t);
    };
    tick();
    window._siClockTimer = setInterval(tick, 10000);
  }
}

window.addEventListener('storage', (e) => {
  if (e.key === 'luna_island_update') applyIsland();
  if (e.key === 'luna_tz_update')     updateTime();
  if (e.key === 'luna_characters_updated' || e.key === 'luna_char_db_update') loadAndRender();
});

function goBack() {
  // 若关系圈相关页面处于打开状态，返回键优先逐层收起，而非直接离开档案袋
  if (document.getElementById('rcNpcPage')?.classList.contains('show')) { closeNpcDetail(); return; }
  if (document.getElementById('rcSuggestPage')?.classList.contains('show')) { closeSuggestPanel(); return; }
  if (document.getElementById('rcPage')?.classList.contains('show')) { closeRelationCircle(); return; }

  const mask = document.createElement('div');
  mask.style.cssText = 'position:fixed;inset:0;background:rgba(253,252,255,0.97);opacity:0;z-index:9999;transition:opacity 0.28s ease;pointer-events:all;';
  document.body.appendChild(mask);
  requestAnimationFrame(() => { mask.style.opacity = '1'; });
  setTimeout(() => { window.location.href = 'characters.html'; }, 260);
}

/* ================================================================
   IndexedDB 读取 —— 与 characters.js 完全一致的探测式打开逻辑
================================================================ */
let _db = null;
function openCharDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const probe = indexedDB.open('LunaCharDB');
    probe.onsuccess = e => {
      const cur = e.target.result;
      const ver = cur.version;
      const hasChars = cur.objectStoreNames.contains('chars');
      cur.close();
      if (hasChars) {
        const req2 = indexedDB.open('LunaCharDB', ver);
        req2.onsuccess = e2 => { _db = e2.target.result; res(_db); };
        req2.onerror   = e2 => rej(e2.target.error);
        req2.onupgradeneeded = () => {};
      } else {
        const req3 = indexedDB.open('LunaCharDB', ver + 1);
        req3.onupgradeneeded = e3 => {
          const db3 = e3.target.result;
          if (!db3.objectStoreNames.contains('chars'))
            db3.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
        };
        req3.onsuccess = e3 => { _db = e3.target.result; res(_db); };
        req3.onerror   = e3 => rej(e3.target.error);
      }
    };
    probe.onerror = e => rej(e.target.error);
    probe.onupgradeneeded = e => {
      const db0 = e.target.result;
      if (!db0.objectStoreNames.contains('chars'))
        db0.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
    };
  });
}

async function getAllChars() {
  const db = await openCharDB().catch(() => null);
  if (!db) return [];
  return new Promise(res => {
    const req = db.transaction('chars', 'readonly').objectStore('chars').getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror   = () => res([]);
  });
}

function escHtml(s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ---------------- 常用小工具 ---------------- */
function letterOf(c) { return (c.name || '?').trim()[0]?.toUpperCase() || '?'; }
function genderMark(g) {
  if (g === '男') return '♂';
  if (g === '女') return '♀';
  return '?';
}
function fmtVal(v, fallback) { return (v && String(v).trim()) ? escHtml(v) : `<span style="color:var(--ink-faint);font-style:italic;">${fallback}</span>`; }

function avatarInner(c) {
  if (c.avatar) return `<img src="${c.avatar}" alt="" />`;
  return escHtml(letterOf(c));
}

const LOCK_SVG = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none"><rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

function lockNote() {
  return `<div class="ds-lock-note">${LOCK_SVG}<span>完整人设、语言风格与背景故事已加密存档，仅角色本体持有访问权限。</span></div>`;
}

function traitChips(c) {
  const traits = Array.isArray(c.traits) ? c.traits.slice(0, 6) : [];
  if (!traits.length) return '';
  return `<div class="ds-trait-chips">${traits.map(t => `<span class="ds-trait-chip">${escHtml(t)}</span>`).join('')}</div>`;
}

function statusPill(isActive) {
  return `<div class="ds-status-pill${isActive ? ' active' : ''}"><i></i>${isActive ? 'ACTIVE · 已激活' : 'ARCHIVED · 待机'}</div>`;
}

function kvRowsHtml(c) {
  const rows = [
    ['性别', `${genderMark(c.gender)} ${fmtVal(c.gender,'未设置')}`],
    ['年龄', fmtVal(c.age,'不详')],
    ['生日', fmtVal(c.birthday,'未记录')],
    ['种族/类型', fmtVal(c.species,'人类 / 常规')],
  ];
  return rows.map(([k,v]) => `
    <div class="ds-kv-line">
      <div class="ds-kv-k">${k}</div>
      <div class="ds-kv-v">${v}</div>
    </div>`).join('');
}

const TAP_SVG = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* ================================================================
   单一档案卡渲染 —— 珠光白卡片：顶部丝带头像 + 状态徽标 + 资料行 + 特质
================================================================ */
function renderCardHtml(c, isActive) {
  return `
    <div class="ds-card-shell">
      <div class="ds-card-ribbon">
        <div class="ds-avatar-seal">${avatarInner(c)}</div>
      </div>
      <div class="ds-card-body">
        ${statusPill(isActive)}
        <div class="s-eyebrow">PERSONAL DOSSIER · No.${String(c.id||0).padStart(4,'0')}</div>
        <div class="s-name">${escHtml(c.name||'未命名')}</div>
        <div class="s-role">${fmtVal(c.role,'定位未设置')}</div>
        <div class="ds-divider"></div>
        ${kvRowsHtml(c)}
        ${traitChips(c)}
        ${lockNote()}
        <div class="ds-tap-hint"><span>轻触查看关系圈</span>${TAP_SVG}</div>
      </div>
    </div>`;
}

/* ================================================================
   主状态与渲染
================================================================ */
let _chars = [];
let _activeCharId = null;
let _curIndex = 0;
let _viewMode = 'stage';   // 'stage' 单卷详读 | 'shelf' 架上总览
let _searchQuery = '';
let _activeOnly = false;
let _activeTag = null;

async function loadAndRender() {
  _chars = await getAllChars();
  _activeCharId = parseInt(localStorage.getItem('luna_active_char')) || null;

  if (!_chars.length) {
    document.getElementById('dsStage').innerHTML = '';
    document.getElementById('dsStage').style.display = 'none';
    document.getElementById('dsEmpty').style.display = '';
    document.querySelector('.ds-control').style.display = 'none';
    document.getElementById('dsFilmstrip').style.display = 'none';
    document.getElementById('dsShelf').style.display = 'none';
    document.getElementById('dsSearchRow').style.display = 'none';
    document.getElementById('dsTagScroll').style.display = 'none';
    return;
  }
  document.getElementById('dsEmpty').style.display = 'none';
  if (_curIndex >= _chars.length) _curIndex = 0;

  applyViewModeDisplay();
  renderStage();
  renderFilmstrip();
  renderDots();
  updateIndexLabel();
  renderShelf();
  renderTagScroll();
}

/* ---------------- 架上总览 / 单卷详读 切换 ---------------- */
function applyViewModeDisplay() {
  const stage  = document.getElementById('dsStage');
  const ctrl   = document.querySelector('.ds-control');
  const film   = document.getElementById('dsFilmstrip');
  const shelf  = document.getElementById('dsShelf');
  const searchRow = document.getElementById('dsSearchRow');
  const tagScroll  = document.getElementById('dsTagScroll');
  const multi = _chars.length > 1;

  document.getElementById('btnViewShelf').classList.toggle('active', _viewMode === 'shelf');
  document.getElementById('btnViewStage').classList.toggle('active', _viewMode === 'stage');

  if (_viewMode === 'shelf') {
    stage.style.display = 'none';
    ctrl.style.display = 'none';
    film.style.display = 'none';
    shelf.style.display = '';
    searchRow.style.display = '';
    tagScroll.style.display = '';
  } else {
    stage.style.display = '';
    ctrl.style.display = multi ? '' : 'none';
    film.style.display = multi ? '' : 'none';
    shelf.style.display = 'none';
    searchRow.style.display = 'none';
    tagScroll.style.display = 'none';
  }
}

function setViewMode(mode) {
  if (mode === _viewMode) return;
  _viewMode = mode;
  applyViewModeDisplay();
  if (mode === 'shelf') renderShelf();
}

function onSearchInput() {
  _searchQuery = (document.getElementById('dsSearchInput').value || '').trim().toLowerCase();
  renderShelf();
}

function toggleActiveFilter() {
  _activeOnly = !_activeOnly;
  document.getElementById('btnActiveFilter').classList.toggle('active', _activeOnly);
  renderShelf();
}

function toggleTagFilter(tag) {
  _activeTag = (_activeTag === tag) ? null : tag;
  renderTagScroll();
  renderShelf();
}

function allTagsInUse() {
  const set = new Set();
  _chars.forEach(c => (Array.isArray(c.traits) ? c.traits : []).forEach(t => set.add(t)));
  return Array.from(set).slice(0, 16);
}

function renderTagScroll() {
  const el = document.getElementById('dsTagScroll');
  const tags = allTagsInUse();
  if (!tags.length) { el.innerHTML = ''; return; }
  el.innerHTML = tags.map(t => `
    <button class="ds-tag-pill${t === _activeTag ? ' active' : ''}" onclick="toggleTagFilter('${escHtml(t).replace(/'/g,"\\'")}')">${escHtml(t)}</button>
  `).join('');
}

function filteredChars() {
  return _chars.filter(c => {
    if (_activeOnly && c.id !== _activeCharId) return false;
    if (_activeTag && !(Array.isArray(c.traits) && c.traits.includes(_activeTag))) return false;
    if (_searchQuery) {
      const hay = [c.name, c.role, ...(Array.isArray(c.traits) ? c.traits : [])].join(' ').toLowerCase();
      if (!hay.includes(_searchQuery)) return false;
    }
    return true;
  });
}

function folioClass(c, i) {
  const idx = Math.abs(relationHashSafe(c.id != null ? String(c.id) : String(i))) % 6;
  return `folio-${idx}`;
}
function relationHashSafe(str) {
  let h = 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function renderShelf() {
  const shelf = document.getElementById('dsShelf');
  if (_viewMode !== 'shelf') return;
  const list = filteredChars();
  if (!list.length) {
    shelf.innerHTML = `<div class="ds-shelf-empty-hint">没有匹配的档案</div>`;
    return;
  }
  shelf.innerHTML = list.map((c, i) => {
    const isActive = c.id === _activeCharId;
    const realIndex = _chars.indexOf(c);
    return `
    <div class="ds-folio-tile ${folioClass(c, i)}" style="animation-delay:${i * 0.04}s" onclick="openFromShelf(${realIndex})" tabindex="0">
      <div class="ds-folio-tab-ear"></div>
      <div class="ds-folio-body-wrap">
        <div class="ds-folio-tab">
          ${isActive ? '<div class="ds-folio-active-dot"></div>' : ''}
          <div class="ds-folio-avatar">${avatarInner(c)}</div>
        </div>
        <div class="ds-folio-body">
          <div class="ds-folio-name">${escHtml(c.name || '未命名')}</div>
          <div class="ds-folio-role">${fmtVal(c.role, '定位未设置')}</div>
          <div class="ds-folio-no">NO.${String(c.id || 0).padStart(4, '0')}</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openFromShelf(i) {
  _curIndex = i;
  _viewMode = 'stage';
  applyViewModeDisplay();
  renderStage();
  renderFilmstrip();
  renderDots();
  updateIndexLabel();
}

function renderStage() {
  const stage = document.getElementById('dsStage');
  const c = _chars[_curIndex];
  const isActive = c.id === _activeCharId;

  const card = document.createElement('div');
  card.className = 'dossier-card';
  card.innerHTML = renderCardHtml(c, isActive);

  stage.innerHTML = '';
  const shadow = document.createElement('div');
  shadow.className = 'ds-stage-shadow';
  shadow.id = 'dsStageShadow';
  stage.appendChild(shadow);
  stage.appendChild(card);

  bindCardTapToOpen(card);

  const prevBtn = document.getElementById('btnPrev');
  const nextBtn = document.getElementById('btnNext');
  prevBtn.disabled = _chars.length <= 1;
  nextBtn.disabled = _chars.length <= 1;
}

/* 点击档案袋卡片本身 → 进入该角色的关系圈整页（与左右滑动切换手势不冲突：
   仅在按下与抬起位置几乎未移动时才判定为"点击"，否则视为滑动手势） */
function bindCardTapToOpen(card) {
  let downX = 0, downY = 0, moved = false;
  const THRESHOLD = 8;
  const onDown = (x, y) => { downX = x; downY = y; moved = false; };
  const onMove = (x, y) => { if (Math.abs(x - downX) > THRESHOLD || Math.abs(y - downY) > THRESHOLD) moved = true; };
  const onUp = () => { if (!moved) openRelationCircle(); };

  let pressed = false;
  card.addEventListener('mousedown', e => { pressed = true; onDown(e.clientX, e.clientY); });
  card.addEventListener('mousemove', e => { if (pressed) onMove(e.clientX, e.clientY); });
  card.addEventListener('mouseup', e => { pressed = false; onUp(); });
  card.addEventListener('mouseleave', () => { pressed = false; });

  card.addEventListener('touchstart', e => { const t = e.touches[0]; onDown(t.clientX, t.clientY); }, { passive: true });
  card.addEventListener('touchmove', e => { const t = e.touches[0]; onMove(t.clientX, t.clientY); }, { passive: true });
  card.addEventListener('touchend', onUp, { passive: true });
}

function renderDots() {
  const dots = document.getElementById('ctrlDots');
  const max = 10;
  if (_chars.length > max) { dots.innerHTML = ''; return; }
  dots.innerHTML = _chars.map((c,i) => `<i class="${i===_curIndex?'on':''}"></i>`).join('');
}

function updateIndexLabel() {
  document.getElementById('ctrlIndex').textContent =
    `${String(_curIndex+1).padStart(2,'0')} / ${String(_chars.length).padStart(2,'0')}`;
}

function renderFilmstrip() {
  const film = document.getElementById('dsFilmstrip');
  film.innerHTML = _chars.map((c,i) => `
    <div class="ds-film-item${i===_curIndex?' active':''}" onclick="jumpTo(${i})" tabindex="0">
      ${c.avatar ? `<img src="${c.avatar}"/>` : escHtml(letterOf(c))}
    </div>
  `).join('');
}

function transitionTo(newIndex) {
  const stage = document.getElementById('dsStage');
  const cur = stage.querySelector('.dossier-card');
  if (cur) {
    cur.classList.add('leaving');
    setTimeout(() => {
      _curIndex = newIndex;
      renderStage();
      renderFilmstrip();
      renderDots();
      updateIndexLabel();
    }, 200);
  } else {
    _curIndex = newIndex;
    renderStage();
    renderFilmstrip();
    renderDots();
    updateIndexLabel();
  }
}

function gotoPrev() {
  if (_chars.length <= 1) return;
  const n = (_curIndex - 1 + _chars.length) % _chars.length;
  transitionTo(n);
}
function gotoNext() {
  if (_chars.length <= 1) return;
  const n = (_curIndex + 1) % _chars.length;
  transitionTo(n);
}
function jumpTo(i) {
  if (i === _curIndex) return;
  transitionTo(i);
}

/* “重新分配样式”按钮：卡片已统一为单一风格，改为轻量刷新动效，保留按钮交互反馈 */
function shuffleStyles() {
  const btn = document.getElementById('btnShuffle');
  btn.style.transform = 'rotate(180deg)';
  setTimeout(() => { btn.style.transform = ''; }, 320);

  const stage = document.getElementById('dsStage');
  const card = stage.querySelector('.dossier-card');
  if (card) {
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';
    card.classList.remove('leaving');
  }
  renderStage();
}

/* ---------------- 滑动手势（触屏左右滑动切换） ---------------- */
(function initSwipe(){
  let startX = 0, startY = 0, tracking = false;
  const stage = document.getElementById('dsStage');
  stage.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX; startY = e.touches[0].clientY; tracking = true;
  }, { passive:true });
  stage.addEventListener('touchend', e => {
    if (!tracking) return; tracking = false;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx < 0) gotoNext(); else gotoPrev();
    }
  }, { passive:true });
})();

/* ---------------- 键盘左右方向键 / ESC 逐层返回 ---------------- */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { goBack(); return; }
  const rcOpen = document.getElementById('rcPage')?.classList.contains('show');
  if (rcOpen) return; // 关系圈打开时不响应档案切换快捷键
  if (e.key === 'ArrowLeft') gotoPrev();
  if (e.key === 'ArrowRight') gotoNext();
});

/* ================================================================
   初始化
================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  updateTime();
  setInterval(updateTime, 30000);
  updateBattery();
  applyIsland();
  loadAndRender();
});
/* ================================================================================================
   关系圈 · RELATION CIRCLE
   —— 所有关系人物（NPC）均为该角色专属私有档案，独立存储，绝不写入角色库(chars store)
   —— 由 AI 读取角色人设后推演生成，用户勾选后归档；归档后可再次调用 AI 补全完整人设
   —— 现为独立整页视图（非弹窗）：openRelationCircle 会切入 #rcPage 整页，
      通过顶部返回按钮 / goBack() 逐层收起，不使用居中弹窗/遮罩交互
================================================================================================ */

/* ---------------- 专属 IndexedDB：LunaCharDB / npc_relations ---------------- */
let _rcDb = null;
function openRcDB() {
  if (_rcDb) return Promise.resolve(_rcDb);
  return new Promise((res, rej) => {
    const probe = indexedDB.open('LunaCharDB');
    probe.onsuccess = e => {
      const cur = e.target.result;
      const ver = cur.version;
      const has = cur.objectStoreNames.contains('npc_relations');
      cur.close();
      if (has) {
        const req2 = indexedDB.open('LunaCharDB', ver);
        req2.onsuccess = e2 => { _rcDb = e2.target.result; res(_rcDb); };
        req2.onerror   = e2 => rej(e2.target.error);
      } else {
        const req3 = indexedDB.open('LunaCharDB', ver + 1);
        req3.onupgradeneeded = e3 => {
          const db3 = e3.target.result;
          if (!db3.objectStoreNames.contains('npc_relations')) {
            const store = db3.createObjectStore('npc_relations', { keyPath: 'id', autoIncrement: true });
            store.createIndex('ownerId', 'ownerId', { unique: false });
          }
        };
        req3.onsuccess = e3 => { _rcDb = e3.target.result; res(_rcDb); };
        req3.onerror   = e3 => rej(e3.target.error);
      }
    };
    probe.onerror = e => rej(e.target.error);
    probe.onupgradeneeded = e => {
      const db0 = e.target.result;
      if (!db0.objectStoreNames.contains('chars'))
        db0.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
      if (!db0.objectStoreNames.contains('npc_relations')) {
        const store = db0.createObjectStore('npc_relations', { keyPath: 'id', autoIncrement: true });
        store.createIndex('ownerId', 'ownerId', { unique: false });
      }
    };
  });
}

async function getNpcsForOwner(ownerId) {
  const db = await openRcDB().catch(() => null);
  if (!db) return [];
  return new Promise(res => {
    const tx = db.transaction('npc_relations', 'readonly');
    const store = tx.objectStore('npc_relations');
    const idx = store.index('ownerId');
    const req = idx.getAll(IDBKeyRange.only(ownerId));
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => res([]);
  });
}
async function addNpc(record) {
  const db = await openRcDB();
  return new Promise((res, rej) => {
    let settled = false;
    const tx = db.transaction('npc_relations', 'readwrite');
    const req = tx.objectStore('npc_relations').add(record);
    // req.onsuccess fires before the tx actually commits; wait for the
    // transaction itself so a late abort (quota, versionchange race, etc.)
    // can never leave the save silently unresolved.
    req.onsuccess = () => { if (!settled) { settled = true; res(req.result); } };
    req.onerror = () => { if (!settled) { settled = true; rej(req.error || new Error('ADD_NPC_FAILED')); } };
    tx.onabort = () => { if (!settled) { settled = true; rej(tx.error || new Error('TX_ABORTED')); } };
  });
}
async function putNpc(record) {
  const db = await openRcDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('npc_relations', 'readwrite');
    const req = tx.objectStore('npc_relations').put(record);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function deleteNpc(id) {
  const db = await openRcDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('npc_relations', 'readwrite');
    const req = tx.objectStore('npc_relations').delete(id);
    req.onsuccess = () => res(true);
    req.onerror = () => rej(req.error);
  });
}

/* ---------------- AI 调用封装：复用 settings.js 中保存的 OpenAI 兼容端点配置 ---------------- */
function getAiConfig() {
  try {
    const cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
    const model = localStorage.getItem('luna_api_model') || '';
    if (!cur.baseUrl || !cur.apiKey || !model) return null;
    return { baseUrl: cur.baseUrl.replace(/\/$/, ''), apiKey: cur.apiKey, model };
  } catch (e) { return null; }
}

async function callAiJson(systemPrompt, userPrompt) {
  const cfg = getAiConfig();
  if (!cfg) throw new Error('NO_API_CONFIG');
  const resp = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.9,
      max_tokens: 2200
    })
  });
  if (!resp.ok) throw new Error(`HTTP_${resp.status}`);
  const data = await resp.json();
  const raw = data.choices?.[0]?.message?.content || '';
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const startArr = cleaned.indexOf('[');
  let jsonStr = cleaned;
  if (start === -1 && startArr === -1) throw new Error('NO_JSON');
  if (startArr !== -1 && (start === -1 || startArr < start)) {
    jsonStr = cleaned.slice(startArr, cleaned.lastIndexOf(']') + 1);
  } else {
    jsonStr = cleaned.slice(start, cleaned.lastIndexOf('}') + 1);
  }
  return JSON.parse(jsonStr);
}

/* 抽取角色人设的所有可用字段，拼装成给 AI 的完整上下文（尽量兼容不同建卡字段命名） */
function extractPersonaContext(c) {
  const pick = (...keys) => { for (const k of keys) { if (c[k] && String(c[k]).trim()) return String(c[k]).trim(); } return ''; };
  return {
    name: c.name || '未命名角色',
    gender: c.gender || '',
    age: c.age || '',
    species: c.species || '',
    role: c.role || '',
    traits: Array.isArray(c.traits) ? c.traits.join('、') : '',
    personality: pick('personality','character','disposition','性格'),
    background: pick('background','backstory','history','世界观','设定','背景故事'),
    persona: pick('persona','prompt','systemPrompt','description','desc','人设','简介'),
    speech: pick('speechStyle','tone','语气','说话风格'),
    scenario: pick('scenario','情景','开场'),
    greeting: pick('greeting','firstMessage','开场白'),
  };
}

/* ---------------- 状态 ---------------- */
let _rcOwner = null;      // 当前打开关系圈的角色对象
let _rcNpcs = [];          // 该角色已归档的 NPC 列表
let _rcCandidates = [];    // AI 建议结果（尚未归档）
let _rcSelected = new Set();
let _rcActiveNpcId = null;

function currentDossierChar() {
  return _chars[_curIndex] || null;
}

/* ---------------- 打开 / 关闭 关系圈整页 ----------------
   不再使用底部弹出的居中 modal + 遮罩：改为从右侧滑入的全屏页面，
   与档案袋主页视觉体系一致（同一套浅白/薰衣紫渐变背景）。
------------------------------------------------------------ */
async function openRelationCircle() {
  const c = currentDossierChar();
  if (!c) return;
  _rcOwner = c;
  document.getElementById('rcOwnerName').textContent = `${c.name || '未命名'} · 关系圈`;
  const page = document.getElementById('rcPage');
  page.classList.add('show');
  page.setAttribute('aria-hidden', 'false');
  page.scrollTop = 0;
  await refreshNpcList();
  switchRelationView('graph');
}
function closeRelationCircle() {
  const page = document.getElementById('rcPage');
  if (page.contains(document.activeElement)) document.activeElement.blur();
  page.classList.remove('show');
  page.setAttribute('aria-hidden', 'true');
}

async function refreshNpcList() {
  if (!_rcOwner) return;
  _rcNpcs = await getNpcsForOwner(_rcOwner.id);
  const empty = document.getElementById('rcEmpty');
  const graphView = document.getElementById('rcViewGraph');
  const listView = document.getElementById('rcViewList');
  const tabs = document.querySelector('.rc-tabs');

  if (!_rcNpcs.length) {
    empty.style.display = 'flex';
    graphView.style.display = 'none';
    listView.style.display = 'none';
    tabs.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  tabs.style.display = 'flex';
  renderRelationGraph();
  renderNpcList();
  const activeTab = document.querySelector('.rc-tab.active')?.dataset.view || 'graph';
  switchRelationView(activeTab);
}

function switchRelationView(view) {
  if (!_rcNpcs.length) return;
  document.querySelectorAll('.rc-tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  document.getElementById('rcViewGraph').style.display = view === 'graph' ? 'flex' : 'none';
  document.getElementById('rcViewList').style.display = view === 'list' ? 'block' : 'none';
}

/* ================================================================================================
   关系星图渲染 —— 中心为角色本人，环绕节点为各 NPC，按亲密度决定连线粗细与距离
   浅白 ins 高级感：珠光节点 + 曲线连接 + 关系标签 + 呼吸浮动
================================================================================================ */
const RC_LAV_STOPS = ['#a5382b','#395a78','#3f6b4c','#8a5a2e','#6b4a7c'];

function relationHash(str) {
  let h = 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function renderRelationGraph() {
  const svg = document.getElementById('rcGraphSvg');
  const W = 360, H = 420, CX = 180, CY = 190;
  const n = _rcNpcs.length;
  const R = Math.min(150, 78 + n * 9);

  const nodes = _rcNpcs.map((npc, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2 + (relationHash(npc.name) % 100) / 100 * 0.25;
    const jitter = 0.86 + (relationHash(npc.name + 'r') % 30) / 100;
    const rr = R * jitter;
    return {
      npc,
      x: CX + Math.cos(angle) * rr,
      y: CY + Math.sin(angle) * rr,
      color: RC_LAV_STOPS[relationHash(npc.relation || npc.name) % RC_LAV_STOPS.length]
    };
  });

  let defs = `
    <defs>
      <radialGradient id="rcCoreGrad" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stop-color="#fbf7ee"/>
        <stop offset="55%" stop-color="#e8ddc0"/>
        <stop offset="100%" stop-color="#a5382b"/>
      </radialGradient>
      <filter id="rcSoftGlow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="4.2" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>`;

  let linksHtml = '';
  nodes.forEach((node) => {
    const midX = (CX + node.x) / 2 + (node.y - CY) * 0.12;
    const midY = (CY + node.y) / 2 - (node.x - CX) * 0.12;
    const closeness = node.npc.closeness || 3;
    const strokeW = 0.8 + closeness * 0.35;
    const opacity = 0.28 + closeness * 0.07;
    linksHtml += `
      <path class="rc-link" d="M${CX},${CY} Q${midX},${midY} ${node.x},${node.y}"
        fill="none" stroke="${node.color}" stroke-width="${strokeW}" stroke-opacity="${opacity}" stroke-linecap="round"/>`;
  });

  let nodesHtml = '';
  nodes.forEach((node, i) => {
    const label = escHtml((node.npc.name || '?').slice(0, 6));
    const relLabel = escHtml((node.npc.relation || '').slice(0, 8));
    const letter = escHtml((node.npc.name || '?').trim()[0] || '?');
    nodesHtml += `
      <g class="rc-node" onclick="openNpcDetail(${node.npc.id})" style="animation: rcNodeFloat ${5 + (i % 3)}s ease-in-out ${i * 0.3}s infinite;">
        <circle class="rc-node-halo" cx="${node.x}" cy="${node.y}" r="21" fill="${node.color}" opacity="0.22"/>
        <circle cx="${node.x}" cy="${node.y}" r="15.5" fill="${node.color}" filter="url(#rcSoftGlow)" opacity="0.94"/>
        <circle cx="${node.x}" cy="${node.y}" r="15.5" fill="none" stroke="#fbf7ee" stroke-width="1.6" opacity="0.85"/>
        <text x="${node.x}" y="${node.y + 5}" text-anchor="middle" font-family="Noto Serif SC, serif" font-size="13" font-weight="600" fill="#fbf7ee">${letter}</text>
        <text x="${node.x}" y="${node.y + 30}" text-anchor="middle" class="rc-link-label" font-size="10.5" font-weight="600" fill="#2a2118">${label}</text>
        <text x="${node.x}" y="${node.y + 42}" text-anchor="middle" class="rc-link-label" font-size="8.5" fill="#7c2820">${relLabel}</text>
      </g>`;
  });

  const centerAvatar = _rcOwner.avatar
    ? `<clipPath id="rcCenterClip"><circle cx="${CX}" cy="${CY}" r="30"/></clipPath><image href="${_rcOwner.avatar}" x="${CX-30}" y="${CY-30}" width="60" height="60" clip-path="url(#rcCenterClip)" preserveAspectRatio="xMidYMid slice"/>`
    : `<text x="${CX}" y="${CY+8}" text-anchor="middle" font-family="Noto Serif SC, serif" font-size="24" font-weight="600" fill="#fbf7ee">${escHtml((_rcOwner.name||'?').trim()[0]||'?')}</text>`;

  const centerHtml = `
    <g class="rc-node-core">
      <circle cx="${CX}" cy="${CY}" r="38" fill="url(#rcCoreGrad)"/>
      <circle cx="${CX}" cy="${CY}" r="38" fill="none" stroke="#fbf7ee" stroke-width="2.4"/>
      ${centerAvatar}
      <text x="${CX}" y="${CY + 56}" text-anchor="middle" font-family="Space Mono, monospace" font-size="11" font-weight="700" fill="#2a2118">${escHtml((_rcOwner.name||'未命名').slice(0,8))}</text>
    </g>`;

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = defs + linksHtml + centerHtml + nodesHtml;

  if (!document.getElementById('rcNodeFloatKeyframe')) {
    const style = document.createElement('style');
    style.id = 'rcNodeFloatKeyframe';
    style.textContent = `@keyframes rcNodeFloat{0%,100%{transform:translateY(0);}50%{transform:translateY(-3px);}}`;
    document.head.appendChild(style);
  }
}

function renderNpcList() {
  const list = document.getElementById('rcList');
  list.innerHTML = _rcNpcs.map(npc => `
    <div class="rc-npc-card" onclick="openNpcDetail(${npc.id})">
      <div class="rc-npc-avatar">${npc.avatar ? `<img src="${escHtml(npc.avatar)}"/>` : escHtml((npc.name||'?').trim()[0]||'?')}</div>
      <div class="rc-npc-info">
        <div class="rc-npc-name">${escHtml(npc.name||'未命名人物')}</div>
        <div class="rc-npc-rel">${escHtml(npc.relation||'关系未定')}</div>
        <div class="rc-npc-desc">${escHtml(npc.desc||'')}</div>
      </div>
      <div class="rc-npc-fill ${npc.filled ? 'done' : ''}" title="${npc.filled ? '档案已完善' : '档案待完善'}">
        ${npc.filled
          ? `<svg viewBox="0 0 24 24" width="13" height="13" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
          : `<svg viewBox="0 0 24 24" width="13" height="13" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8" stroke-dasharray="2 3"/></svg>`}
      </div>
    </div>`).join('');
}

/* ================================================================================================
   AI 生成关系建议 —— 读取角色完整人设，推演出合理的关系网络人物
   —— 现为从右侧滑入的独立子页（叠加于关系圈整页之上），而非居中弹窗
================================================================================================ */
async function requestRelationSuggestions(manualOnly) {
  const c = _rcOwner || currentDossierChar();
  if (!c) return;
  _rcOwner = c;

  const page = document.getElementById('rcSuggestPage');
  page.classList.add('show');
  page.setAttribute('aria-hidden', 'false');
  page.scrollTop = 0;

  const body = document.getElementById('rcSuggestBody');
  const footer = document.getElementById('rcSuggestFooter');

  // 手动模式：跳过 AI 推演，直接打开一个空候选区 + 手动添加表单
  if (manualOnly) {
    _rcCandidates = [];
    _rcSelected = new Set();
    footer.style.display = 'flex';
    renderSuggestCandidates();
    openManualNpcForm();
    return;
  }

  footer.style.display = 'none';
  body.innerHTML = `
    <div class="rc-suggest-loading">
      <div class="rc-loading-ring"></div>
      <div class="rc-suggest-loading-text">正在为「${escHtml(c.name||'角色')}」编织关系网络……</div>
    </div>`;

  const cfg = getAiConfig();
  if (!cfg) {
    renderSuggestError('尚未配置 AI 接口', '请先前往「设置 · API 接入」填写并保存可用的模型接口，再回来生成关系网络。');
    return;
  }

  const existingNames = _rcNpcs.map(n => n.name).filter(Boolean);
  const ctx = extractPersonaContext(c);

  const systemPrompt = `你是一名资深的角色关系设定顾问，擅长为虚构人物构建真实、有层次、有戏剧张力的人际关系网络。
你的任务：根据给定角色的完整人设信息，推演出 5 到 7 位与之相关联的关系人物（NPC）。
要求：
1. 关系类型需多样且合理（如亲属、挚友、恋人、竞争对手、恩师、旧敌、同僚、暗恋对象、血缘之外的羁绊等），避免全部雷同。
2. 每位人物需有姓名、与主角的具体关系（简短标签，4-10字）、亲密度 closeness（1-5 整数，5 为最亲密/羁绊最深）、一段 2-3 句的关系描述（说明这段关系的来历、现状与张力），以及 2-4 个性格/身份标签 tags。
3. 人物需与角色人设强相关，符合其世界观、性格与背景设定的逻辑，不要脱离设定凭空捏造。
4. 不要与已存在的人物重名：${existingNames.length ? existingNames.join('、') : '（暂无）'}
5. 只输出 JSON，不要任何多余文字、不要 markdown 代码块标记。

输出格式（JSON 数组）：
[
  { "name": "人物姓名", "relation": "关系标签", "closeness": 4, "desc": "关系描述文本", "tags": ["标签1","标签2"] }
]`;

  const userPrompt = `角色姓名：${ctx.name}
性别：${ctx.gender || '未设置'}
年龄：${ctx.age || '未设置'}
种族/类型：${ctx.species || '未设置'}
定位/身份：${ctx.role || '未设置'}
性格标签：${ctx.traits || '无'}
性格描写：${ctx.personality || '无'}
背景故事/世界观：${ctx.background || '无'}
人设/设定原文：${ctx.persona || '无'}
说话风格：${ctx.speech || '无'}
情景设定：${ctx.scenario || '无'}
开场白：${ctx.greeting || '无'}

请基于以上信息推演该角色的关系网络。`;

  try {
    const result = await callAiJson(systemPrompt, userPrompt);
    const arr = Array.isArray(result) ? result : (Array.isArray(result?.list) ? result.list : []);
    if (!arr.length) throw new Error('EMPTY_RESULT');
    _rcCandidates = arr.map((r, i) => ({
      _tmpId: 'c' + Date.now() + '_' + i,
      name: String(r.name || '未命名人物').trim(),
      relation: String(r.relation || '关系未定').trim(),
      closeness: Math.min(5, Math.max(1, parseInt(r.closeness) || 3)),
      desc: String(r.desc || '').trim(),
      tags: Array.isArray(r.tags) ? r.tags.slice(0, 4).map(String) : []
    }));
    _rcSelected = new Set();
    renderSuggestCandidates();
  } catch (e) {
    console.error(e);
    if (String(e.message) === 'NO_API_CONFIG') {
      renderSuggestError('尚未配置 AI 接口', '请先前往「设置 · API 接入」填写并保存可用的模型接口，再回来生成关系网络。');
    } else {
      renderSuggestError('关系推演失败', '模型返回内容暂时无法解析，可能是网络波动或接口暂不可用，请重试一次。');
    }
  }
}

function renderSuggestError(title, desc) {
  const body = document.getElementById('rcSuggestBody');
  body.innerHTML = `
    <div class="rc-suggest-error">
      <div class="rc-suggest-error-icon">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none"><path d="M12 8v5M12 16.2v.1" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/></svg>
      </div>
      <div style="font-family:var(--font-serif-cn);font-size:16px;font-weight:600;color:var(--ink);margin-bottom:8px;">${escHtml(title)}</div>
      <div>${escHtml(desc)}</div>
      <button class="rc-empty-btn" style="margin-top:20px;" onclick="requestRelationSuggestions()">重新尝试</button>
    </div>`;
}

function renderSuggestCandidates() {
  const body = document.getElementById('rcSuggestBody');
  const footer = document.getElementById('rcSuggestFooter');
  footer.style.display = 'flex';

  body.innerHTML = `
    <div style="padding:6px 2px 18px;display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
      <div>
        <div style="font-family:var(--font-serif-cn);font-size:16px;font-weight:600;color:var(--ink);">为「${escHtml(_rcOwner.name||'角色')}」推演的关系网络</div>
        <div style="font-size:11.5px;color:var(--ink-faint);line-height:1.7;margin-top:6px;">不满意某一位？点它右上角的骰子图标单独重新推演，不用整批重来</div>
      </div>
    </div>
    <div style="margin:0 2px 18px;">
      <button class="rc-manual-add-btn" onclick="openManualNpcForm()">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <span>手动添加一位人物</span>
      </button>
    </div>
    <div id="candList">${_rcCandidates.map(candCardHtml).join('')}</div>`;
  updateSelCount();
}

function candCardHtml(cand) {
  const busy = cand._regenerating;
  return `
      <div class="rc-suggest-item${_rcSelected.has(cand._tmpId) ? ' selected' : ''}${busy ? ' rc-cand-busy' : ''}" id="cand-${cand._tmpId}">
        <div class="rc-suggest-check" onclick="toggleCandidate('${cand._tmpId}')">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="rc-suggest-item-body" onclick="toggleCandidate('${cand._tmpId}')">
          <div class="rc-suggest-item-name">${escHtml(cand.name)}</div>
          <div class="rc-suggest-item-rel">${escHtml(cand.relation)} · 亲密度 ${cand.closeness}/5</div>
          <div class="rc-suggest-item-desc">${busy ? '正在重新推演这位人物…' : escHtml(cand.desc)}</div>
          ${(!busy && cand.tags.length) ? `<div class="rc-suggest-item-tags">${cand.tags.map(t => `<span class="rc-suggest-tag">${escHtml(t)}</span>`).join('')}</div>` : ''}
        </div>
        <button class="rc-cand-reroll" title="重新推演这一位" onclick="event.stopPropagation(); regenerateCandidate('${cand._tmpId}')" ${busy ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>`;
}

/* 单独重新推演某一位候选人物，不影响其余已选中的候选 */
async function regenerateCandidate(tmpId) {
  const idx = _rcCandidates.findIndex(c => c._tmpId === tmpId);
  if (idx === -1 || !_rcOwner) return;
  const cfg = getAiConfig();
  if (!cfg) { alert('尚未配置 AI 接口，请先前往「设置 · API 接入」完成配置。'); return; }

  _rcCandidates[idx]._regenerating = true;
  const el = document.getElementById(`cand-${tmpId}`);
  if (el) el.outerHTML = candCardHtml(_rcCandidates[idx]);

  const old = _rcCandidates[idx];
  const ctx = extractPersonaContext(_rcOwner);
  const otherNames = _rcCandidates.filter(c => c._tmpId !== tmpId).map(c => c.name)
    .concat(_rcNpcs.map(n => n.name)).filter(Boolean);

  const systemPrompt = `你是一名资深的角色关系设定顾问。请只推演【一位】与主角关联的关系人物（NPC），替换掉一个用户不满意的旧候选。
要求：
1. 与旧候选的关系类型或人物基调应有明显差异（旧候选关系是"${old.relation}"，请勿再给出雷同或近义的关系类型）。
2. 需符合主角的人设、世界观与性格逻辑。
3. 不要与以下人物重名：${otherNames.length ? otherNames.join('、') : '（暂无）'}
4. 只输出 JSON 对象，不要任何多余文字、不要 markdown 代码块标记。

输出格式：
{ "name": "人物姓名", "relation": "关系标签", "closeness": 4, "desc": "关系描述文本", "tags": ["标签1","标签2"] }`;

  const userPrompt = `角色姓名：${ctx.name}
性别：${ctx.gender || '未设置'}　年龄：${ctx.age || '未设置'}　定位：${ctx.role || '未设置'}
性格：${ctx.personality || ctx.traits || '无'}
背景/世界观：${ctx.background || ctx.persona || '无'}

被替换的旧候选：${old.name}（${old.relation}）
请给出一位新的候选人物。`;

  try {
    const r = await callAiJson(systemPrompt, userPrompt);
    const wasSelected = _rcSelected.has(tmpId);
    _rcSelected.delete(tmpId);
    const fresh = {
      _tmpId: 'c' + Date.now() + '_r',
      name: String(r.name || '未命名人物').trim(),
      relation: String(r.relation || '关系未定').trim(),
      closeness: Math.min(5, Math.max(1, parseInt(r.closeness) || 3)),
      desc: String(r.desc || '').trim(),
      tags: Array.isArray(r.tags) ? r.tags.slice(0, 4).map(String) : []
    };
    _rcCandidates[idx] = fresh;
    if (wasSelected) _rcSelected.add(fresh._tmpId);
    renderSuggestCandidates();
  } catch (e) {
    console.error(e);
    _rcCandidates[idx]._regenerating = false;
    const el2 = document.getElementById(`cand-${tmpId}`);
    if (el2) el2.outerHTML = candCardHtml(_rcCandidates[idx]);
    alert('重新推演失败，可能是网络波动，请再试一次。');
  }
}

function toggleCandidate(tmpId) {
  const el = document.getElementById(`cand-${tmpId}`);
  if (_rcSelected.has(tmpId)) { _rcSelected.delete(tmpId); el.classList.remove('selected'); }
  else { _rcSelected.add(tmpId); el.classList.add('selected'); }
  updateSelCount();
}

/* ================================================================================================
   手动添加人物 —— 不依赖 AI，随时可以自己填一位关系人物加入候选区，
   与 AI 推演出的候选一起勾选、一起存档
================================================================================================ */
function openManualNpcForm() {
  const body = document.getElementById('rcSuggestBody');
  const existing = document.getElementById('rcManualForm');
  if (existing) { existing.remove(); return; }

  const wrap = document.createElement('div');
  wrap.id = 'rcManualForm';
  wrap.className = 'rc-manual-form';
  wrap.innerHTML = `
    <div class="rc-manual-form-title">手动添加人物</div>
    <div class="rc-manual-form-field">
      <div class="rc-manual-form-label">姓名</div>
      <input class="rc-edit-input" id="mNpcName" placeholder="这位人物叫什么" maxlength="20"/>
    </div>
    <div class="rc-manual-form-field">
      <div class="rc-manual-form-label">与主角的关系</div>
      <input class="rc-edit-input" id="mNpcRel" placeholder="如：发小、竞争对手、恩师" maxlength="16"/>
    </div>
    <div class="rc-manual-form-field">
      <div class="rc-manual-form-label">亲密度</div>
      <div class="rc-closeness-picker" id="mNpcCloseness">
        ${[1,2,3,4,5].map(n => `<div class="rc-closeness-dot${n===3?' on':''}" data-v="${n}" onclick="pickManualCloseness(${n})">${n}</div>`).join('')}
      </div>
    </div>
    <div class="rc-manual-form-field">
      <div class="rc-manual-form-label">关系背景（选填）</div>
      <textarea class="rc-manual-form-textarea" id="mNpcDesc" placeholder="这段关系的来历与现状" maxlength="160" rows="3"></textarea>
    </div>
    <div class="rc-manual-form-field">
      <div class="rc-manual-form-label">标签（选填）</div>
      <input class="rc-edit-input" id="mNpcTags" placeholder="用逗号分隔，如：嘴硬心软, 学生会"/>
    </div>
    <div class="rc-manual-form-actions">
      <button class="rc-manual-cancel" onclick="document.getElementById('rcManualForm').remove()">取消</button>
      <button class="rc-manual-confirm" onclick="addManualCandidate()">加入候选</button>
    </div>`;
  document.getElementById('candList').before(wrap);
  document.getElementById('mNpcName').focus();
}

function pickManualCloseness(n) {
  document.querySelectorAll('#mNpcCloseness .rc-closeness-dot').forEach(d => d.classList.toggle('on', Number(d.dataset.v) === n));
}

function addManualCandidate() {
  const name = document.getElementById('mNpcName').value.trim();
  const relation = document.getElementById('mNpcRel').value.trim();
  if (!name) { document.getElementById('mNpcName').focus(); return; }
  const closeness = Number(document.querySelector('#mNpcCloseness .rc-closeness-dot.on')?.dataset.v || 3);
  const desc = document.getElementById('mNpcDesc').value.trim();
  const tags = document.getElementById('mNpcTags').value.split(/[,，]/).map(s => s.trim()).filter(Boolean).slice(0, 4);

  const cand = {
    _tmpId: 'm' + Date.now(),
    name,
    relation: relation || '关系未定',
    closeness,
    desc,
    tags
  };
  _rcCandidates.unshift(cand);
  _rcSelected.add(cand._tmpId);
  document.getElementById('rcManualForm').remove();
  renderSuggestCandidates();
}
function updateSelCount() {
  document.getElementById('rcSelCount').textContent = _rcSelected.size;
  document.getElementById('rcConfirmBtn').disabled = _rcSelected.size === 0;
}

function closeSuggestPanel() {
  const page = document.getElementById('rcSuggestPage');
  if (page.contains(document.activeElement)) document.activeElement.blur();
  document.getElementById('rcGenBtn')?.focus();
  page.classList.remove('show');
  page.setAttribute('aria-hidden', 'true');
}

async function confirmSelectedNpcs() {
  if (!_rcSelected.size || !_rcOwner) return;
  const btn = document.getElementById('rcConfirmBtn');
  btn.disabled = true;
  btn.textContent = '正在存档…';

  const toSave = _rcCandidates.filter(c => _rcSelected.has(c._tmpId));
  const saved = [];
  const failed = [];

  for (const cand of toSave) {
    try {
      const id = await addNpc({
        ownerId: _rcOwner.id,
        ownerName: _rcOwner.name || '',
        name: cand.name,
        relation: cand.relation,
        closeness: cand.closeness,
        desc: cand.desc,
        tags: cand.tags,
        avatar: null,
        filled: false,
        persona: null,
        createdAt: Date.now()
      });
      saved.push({ ...cand, id });
      _rcSelected.delete(cand._tmpId);
    } catch (e) {
      console.error('addNpc failed for', cand.name, e);
      failed.push(cand);
    }
  }

  if (saved.length) await refreshNpcList();

  if (failed.length) {
    // Leave the panel open, keep the failed ones selected so nothing is lost,
    // and tell the user plainly instead of hanging on "正在存档…" forever.
    failed.forEach(c => _rcSelected.add(c._tmpId));
    renderSuggestCandidates();
    btn.disabled = false;
    btn.textContent = '重试存档';
    const body = document.getElementById('rcSuggestBody');
    const notice = document.createElement('div');
    notice.className = 'rc-save-error-banner';
    notice.innerHTML = `${saved.length ? `已存档 ${saved.length} 位，` : ''}有 ${failed.length} 位保存失败（存储写入被中断），已为你保留选中状态，可直接点击下方按钮重试。`;
    body.prepend(notice);
    return;
  }

  // All saved — show a proper receipt instead of just silently closing.
  showSaveReceipt(saved);
  _rcCandidates = [];
  _rcSelected = new Set();
}

function showSaveReceipt(savedList) {
  const body = document.getElementById('rcSuggestBody');
  const footer = document.getElementById('rcSuggestFooter');
  footer.style.display = 'none';
  body.innerHTML = `
    <div class="rc-receipt">
      <div class="rc-receipt-check">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div class="rc-receipt-title">${savedList.length} 位人物已归档</div>
      <div class="rc-receipt-desc">已存入「${escHtml(_rcOwner?.name||'角色')}」的专属关系圈，可随时在人物档案中查看或完善</div>
    </div>
    <div class="rc-receipt-list">
      ${savedList.map(c => `
        <div class="rc-receipt-card" onclick="closeSuggestPanel(); openNpcDetail(${c.id});">
          <div class="rc-receipt-card-avatar">${escHtml((c.name||'?').trim()[0]||'?')}</div>
          <div class="rc-receipt-card-body">
            <div class="rc-receipt-card-name">${escHtml(c.name)}</div>
            <div class="rc-receipt-card-rel">${escHtml(c.relation)} · 亲密度 ${c.closeness}/5</div>
          </div>
          <div class="rc-receipt-card-arrow">${TAP_SVG}</div>
        </div>`).join('')}
    </div>
    <button class="rc-empty-btn" style="margin:22px auto 6px;display:block;" onclick="closeSuggestPanel()">完成</button>`;
}

/* ================================================================================================
   NPC 专属档案详情 —— 展示已归档信息；未完善时提供"继续调用 AI 完整填充人设"入口
   —— 现为从右侧滑入的独立子页
================================================================================================ */
async function openNpcDetail(npcId) {
  const npc = _rcNpcs.find(n => n.id === npcId);
  if (!npc) return;
  _rcActiveNpcId = npcId;
  renderNpcDetailSheet(npc);
  const page = document.getElementById('rcNpcPage');
  page.classList.add('show');
  page.setAttribute('aria-hidden', 'false');
  page.scrollTop = 0;
}
function closeNpcDetail() {
  const page = document.getElementById('rcNpcPage');
  if (page.contains(document.activeElement)) document.activeElement.blur();
  page.classList.remove('show');
  page.setAttribute('aria-hidden', 'true');
  _rcActiveNpcId = null;
}

function renderNpcDetailSheet(npc) {
  const sheet = document.getElementById('rcNpcSheet');
  const p = npc.persona || {};

  const heroMeta = [
    npc.closeness ? `亲密度 ${npc.closeness}/5` : '',
    npc.filled && p.identity ? p.identity : ''
  ].filter(Boolean).join(' · ');

  let bodyHtml = '';

  if (!npc.filled) {
    bodyHtml = `
      <div class="rc-npc-section">
        <div class="rc-npc-section-title">关系纪要</div>
        <div class="rc-npc-section-text">${escHtml(npc.desc || '暂无描述')}</div>
      </div>
      ${npc.tags && npc.tags.length ? `
      <div class="rc-npc-section">
        <div class="rc-npc-section-title">特征标签</div>
        <div class="rc-npc-tags">${npc.tags.map(t => `<span class="rc-npc-tag">${escHtml(t)}</span>`).join('')}</div>
      </div>` : ''}
      <div class="rc-npc-empty-fill">
        <div class="rc-npc-empty-fill-title">这份档案还只是雏形</div>
        <div class="rc-npc-empty-fill-desc">点击下方按钮，AI 将基于「${escHtml(_rcOwner?.name||'角色')}」的人设与这段关系，<br/>为「${escHtml(npc.name)}」继续填充完整的身份、性格、外貌与背景设定</div>
        <button class="rc-npc-fill-btn" id="npcFillBtn" onclick="fillNpcPersona(${npc.id})">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none"><path d="M12 3v3.2M12 17.8V21M3 12h3.2M17.8 12H21M5.6 5.6l2.3 2.3M16.1 16.1l2.3 2.3M18.4 5.6l-2.3 2.3M7.9 16.1l-2.3 2.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.6"/></svg>
          <span>AI 完整填充人设</span>
        </button>
      </div>`;
  } else {
    bodyHtml = `
      ${p.quote ? `<div class="rc-npc-section"><div class="rc-npc-quote">"${escHtml(p.quote)}"</div></div>` : ''}
      <div class="rc-npc-section">
        <div class="rc-npc-section-title">基础信息</div>
        <div class="rc-npc-kv">
          <div class="rc-npc-kv-item"><div class="rc-npc-kv-k">性别</div><div class="rc-npc-kv-v">${escHtml(p.gender||'未知')}</div></div>
          <div class="rc-npc-kv-item"><div class="rc-npc-kv-k">年龄</div><div class="rc-npc-kv-v">${escHtml(p.age||'未知')}</div></div>
        </div>
      </div>
      <div class="rc-npc-section">
        <div class="rc-npc-section-title">身份 / 定位</div>
        <div class="rc-npc-section-text">${escHtml(p.identity || '暂无')}</div>
      </div>
      <div class="rc-npc-section">
        <div class="rc-npc-section-title">性格特质</div>
        <div class="rc-npc-section-text">${escHtml(p.personality || '暂无')}</div>
      </div>
      <div class="rc-npc-section">
        <div class="rc-npc-section-title">外貌形象</div>
        <div class="rc-npc-section-text">${escHtml(p.appearance || '暂无')}</div>
      </div>
      <div class="rc-npc-section">
        <div class="rc-npc-section-title">与「${escHtml(_rcOwner?.name||'角色')}」的关系</div>
        <div class="rc-npc-section-text">${escHtml(npc.desc || '')}</div>
      </div>
      <div class="rc-npc-section">
        <div class="rc-npc-section-title">背景故事</div>
        <div class="rc-npc-section-text">${escHtml(p.background || '暂无')}</div>
      </div>
      <div class="rc-npc-section">
        <div class="rc-npc-section-title">说话方式</div>
        <div class="rc-npc-section-text">${escHtml(p.speech || '暂无')}</div>
      </div>
      <div class="rc-npc-section">
        <div class="rc-npc-section-title">喜好 / 厌恶</div>
        <div class="rc-npc-section-text">喜欢：${escHtml(p.likes || '暂无')}<br/>厌恶：${escHtml(p.dislikes || '暂无')}</div>
      </div>
      ${p.secret ? `
      <div class="rc-npc-section">
        <div class="rc-npc-section-title">隐藏设定</div>
        <div class="rc-npc-section-text">${escHtml(p.secret)}</div>
      </div>` : ''}
      ${npc.tags && npc.tags.length ? `
      <div class="rc-npc-section">
        <div class="rc-npc-section-title">特征标签</div>
        <div class="rc-npc-tags">${npc.tags.map(t => `<span class="rc-npc-tag pink">${escHtml(t)}</span>`).join('')}</div>
      </div>` : ''}`;
  }

  sheet.innerHTML = `
    <div class="rc-npc-hero">
      <div class="rc-npc-hero-topbar">
        <button class="rc-icon-btn" onclick="closeNpcDetail()" aria-label="返回">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="rc-icon-btn danger-icon" onclick="removeNpc(${npc.id})" aria-label="移除此人物" title="从关系圈移除">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div class="rc-npc-hero-avatar">${npc.avatar ? `<img src="${escHtml(npc.avatar)}"/>` : escHtml((npc.name||'?').trim()[0]||'?')}</div>
      <div class="rc-npc-hero-name">${escHtml(npc.name||'未命名人物')}</div>
      <div class="rc-npc-hero-rel">${escHtml(npc.relation||'关系未定')}</div>
      ${heroMeta ? `<div class="rc-npc-hero-meta">${escHtml(heroMeta)}</div>` : ''}
    </div>
    <div class="rc-npc-body">${bodyHtml}</div>`;
}

async function removeNpc(npcId) {
  if (!confirm('确定要将这位人物从关系圈中移除吗？此操作不可撤销。')) return;
  await deleteNpc(npcId);
  closeNpcDetail();
  await refreshNpcList();
}

/* AI 继续完整填充某个已归档 NPC 的完整人设 */
async function fillNpcPersona(npcId) {
  const npc = _rcNpcs.find(n => n.id === npcId);
  if (!npc || !_rcOwner) return;

  const btn = document.getElementById('npcFillBtn');
  if (btn) { btn.disabled = true; btn.querySelector('span').textContent = 'AI 正在生成完整档案…'; }

  const cfg = getAiConfig();
  if (!cfg) {
    alert('尚未配置 AI 接口，请先前往「设置 · API 接入」完成配置。');
    if (btn) { btn.disabled = false; btn.querySelector('span').textContent = 'AI 完整填充人设'; }
    return;
  }

  const ctx = extractPersonaContext(_rcOwner);
  const systemPrompt = `你是一名专业的角色人设撰写师，负责为一个已经确定"与主角关系"的 NPC 人物，撰写完整、生动、具有可扮演性的角色设定。
输出要求：
1. 内容需与主角的人设、世界观、性格逻辑保持一致，也要与给定的关系背景相符。
2. 人物需立体、有血有肉，避免空洞的形容词堆砌，多用具体细节。
3. 只输出 JSON，不要任何多余文字、不要 markdown 代码块标记。

输出格式（JSON 对象）：
{
  "gender": "性别",
  "age": "年龄（数字或描述）",
  "identity": "身份/定位，一句话",
  "personality": "性格特质，2-4句话，具体、有细节",
  "appearance": "外貌形象描写，2-3句话",
  "background": "背景故事，3-5句话，说明与主角相识的经过与当下处境",
  "speech": "说话方式与语言风格，1-2句话，可附带口头禅",
  "likes": "喜好，逗号分隔的短语",
  "dislikes": "厌恶，逗号分隔的短语",
  "quote": "一句最能代表这个人物、且会说给主角听的台词",
  "secret": "这个人物尚未告诉主角的一个隐藏设定或秘密（可选，若无可留空字符串）"
}`;

  const userPrompt = `【主角人设参考】
姓名：${ctx.name}
性别：${ctx.gender || '未设置'}　年龄：${ctx.age || '未设置'}　定位：${ctx.role || '未设置'}
性格：${ctx.personality || ctx.traits || '无'}
背景/世界观：${ctx.background || ctx.persona || '无'}

【待完善人物】
姓名：${npc.name}
与主角的关系：${npc.relation}
关系亲密度：${npc.closeness}/5
关系描述：${npc.desc}
已知标签：${(npc.tags||[]).join('、') || '无'}

请为「${npc.name}」撰写完整人设。`;

  try {
    const result = await callAiJson(systemPrompt, userPrompt);
    npc.persona = {
      gender: result.gender || '',
      age: result.age || '',
      identity: result.identity || '',
      personality: result.personality || '',
      appearance: result.appearance || '',
      background: result.background || '',
      speech: result.speech || '',
      likes: result.likes || '',
      dislikes: result.dislikes || '',
      quote: result.quote || '',
      secret: result.secret || ''
    };
    npc.filled = true;
    npc.filledAt = Date.now();
    await putNpc(npc);
    const idx = _rcNpcs.findIndex(n => n.id === npc.id);
    if (idx !== -1) _rcNpcs[idx] = npc;
    renderNpcDetailSheet(npc);
    renderNpcList();
  } catch (e) {
    console.error(e);
    if (btn) { btn.disabled = false; btn.querySelector('span').textContent = 'AI 完整填充人设'; }
    alert('生成失败，可能是网络波动或接口暂不可用，请重试。');
  }
}