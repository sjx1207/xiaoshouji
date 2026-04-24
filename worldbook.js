
/* ================================
   世界书 — worldbook.js
   状态栏 / 灵动岛 / 字体 完整同步 index
================================ */

/* ================================
   分类样式 map
================================ */
const CAT_CLASS = {
  '地点': 'cat-location',
  '势力': 'cat-faction',
  '事件': 'cat-event',
  '规则': 'cat-rule',
  '其他': 'cat-other',
};

/* ---- 返回首页 ---- */
function goBack() {
  const mask = document.createElement('div');
  mask.style.cssText = 'position:fixed;inset:0;background:rgba(221,238,255,0.97);opacity:0;z-index:9999;transition:opacity 0.28s ease;pointer-events:all;';
  document.body.appendChild(mask);
  requestAnimationFrame(() => { mask.style.opacity = '1'; });
  setTimeout(() => { window.location.href = 'index.html'; }, 260);
}

/* ================================
   状态栏时间 — 同步 index
================================ */
function updateTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const now = new Date();
  const s = now.toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  document.querySelectorAll('.status-time').forEach(el => el.textContent = s);
}

/* ================================
   电量 — 同步 index
================================ */
function updateBattery() {
  function render(pct) {
    const p = Math.round(pct);
    document.querySelectorAll('.bat-pct').forEach(el => el.textContent = p);
    document.querySelectorAll('.bat-inner').forEach(el => {
      el.style.width      = p + '%';
      el.style.background = p <= 20
        ? 'linear-gradient(90deg,#f87171,#ef4444)'
        : 'linear-gradient(90deg,#6ee7b7,#34d399)';
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

/* ================================
   灵动岛 — 完整同步 index
================================ */
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
      const t = now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0');
      document.querySelectorAll('.si-clock-text').forEach(el => el.textContent = t);
    };
    tick();
    window._siClockTimer = setInterval(tick, 10000);
  }
}

/* localStorage 跨页同步 */
window.addEventListener('storage', (e) => {
  if (e.key === 'luna_island_update') applyIsland();
  if (e.key === 'luna_tz_update')     updateTime();
  if (e.key === 'luna_font_update')   applyGlobalFont();
});

/* ================================
   字体同步 — 完整同步 index
================================ */
async function applyGlobalFont() {
  const style = JSON.parse(localStorage.getItem('luna_font_style') || '{}');
  const name  = localStorage.getItem('luna_font_active_name');
  const id    = parseInt(localStorage.getItem('luna_font_active_id'));
  if (name && id) {
    try {
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open('LunaFontDB', 2);
        req.onsuccess = e => res(e.target.result);
        req.onerror = () => rej();
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
    } catch(e) {}
  }
  let tag = document.getElementById('luna-font-override');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'luna-font-override';
    document.head.appendChild(tag);
  }
  const familyRule = name ? `font-family: '${name}', sans-serif !important;` : '';
  tag.textContent  = `* { ${familyRule} }`;
}

/* ================================
   IndexedDB — 世界书数据
================================ */
let _wbDb = null;

function openWbDB() {
  return new Promise((res, rej) => {
    if (_wbDb) return res(_wbDb);
    const req = indexedDB.open('LunaWorldBookDB', 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('entries', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = e => { _wbDb = e.target.result; res(_wbDb); };
    req.onerror   = () => rej('WB DB Error');
  });
}

async function getAllEntries() {
  const db = await openWbDB();
  return new Promise(res => {
    const req = db.transaction('entries').objectStore('entries').getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror   = () => res([]);
  });
}

async function saveEntry_db(data) {
  const db = await openWbDB();
  return new Promise(res => {
    const tx    = db.transaction('entries', 'readwrite');
    const store = tx.objectStore('entries');
    const req   = data.id ? store.put(data) : store.add(data);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => res(null);
  });
}

async function deleteEntry_db(id) {
  const db = await openWbDB();
  return new Promise(res => {
    const tx = db.transaction('entries', 'readwrite');
    tx.objectStore('entries').delete(id);
    tx.oncomplete = () => res();
  });
}

/* ================================
   角色读取 — 从角色档案 IndexedDB
================================ */
async function getAllChars() {
  try {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open('LunaCharDB', 1);
      req.onsuccess = e => res(e.target.result);
      req.onerror   = () => rej();
    });
    return new Promise(res => {
      const r = db.transaction('chars').objectStore('chars').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror   = () => res([]);
    });
  } catch(e) { return []; }
}

/* ================================
   状态管理
================================ */
let _entries   = [];
let _chars     = [];
let _editingId = null;
let _viewingId = null;
let _filterCat = 'all';
let _searchQ   = '';
let _selChars  = [];     // 正在编辑时选中的角色 id 列表
let _formBgData = null;
let _formPos   = 'before';

/* ================================
   渲染列表
================================ */
async function renderList() {
  _entries = await getAllEntries();
  _chars   = await getAllChars();
  updateStats();

  const list = document.getElementById('wbList');
  list.innerHTML = '';

  let filtered = _entries;
  if (_filterCat !== 'all') filtered = filtered.filter(e => e.cat === _filterCat);
  if (_searchQ) {
    const q = _searchQ.toLowerCase();
    filtered = filtered.filter(e =>
      (e.title || '').toLowerCase().includes(q) ||
      (e.keywords || '').toLowerCase().includes(q) ||
      (e.sub || '').toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="wb-empty">
        <div class="wb-empty-icon">
          <svg viewBox="0 0 48 48" width="36" height="36" fill="none">
            <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
            <path d="M16 20h16M16 26h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
            <circle cx="35" cy="35" r="6" fill="currentColor" opacity="0.15"/>
            <path d="M33 35h4M35 33v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
          </svg>
        </div>
        <div class="wb-empty-title">${_searchQ ? '未找到匹配的条目' : '还没有世界书条目'}</div>
        <div class="wb-empty-desc">${_searchQ ? '换个关键词试试？' : '点击右上角 + 创建你的第一个<br>世界观设定条目'}</div>
        ${!_searchQ ? `<button class="wb-empty-btn" onclick="openNewEntry()">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          立即创建
        </button>` : ''}
      </div>`;
    return;
  }

  filtered.forEach((entry, i) => {
    const card = buildCard(entry);
    card.style.animationDelay = `${0.04 + i * 0.07}s`;
    list.appendChild(card);
  });
  list.appendChild(Object.assign(document.createElement('div'), { style: 'height:40px' }));
}

/* ================================
   构建卡片
================================ */
function buildCard(entry) {
  const catCls  = CAT_CLASS[entry.cat] || 'cat-other';
  const kwFirst = (entry.keywords || '').split(',').map(s=>s.trim()).filter(Boolean)[0] || '';

  // 关联角色头像
  const charIds = entry.chars || [];
  const linkedChars = charIds.map(id => _chars.find(c => c.id === id)).filter(Boolean);

  let avatarHTML = '';
  if (linkedChars.length === 0) {
    // 空头像占位
    avatarHTML = `
      <div class="wb-avatar-slot empty">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
          <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.5"/>
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>`;
  } else {
    const show = linkedChars.slice(0, 2);
    avatarHTML = show.map(c => {
      const letter = (c.name || '?')[0].toUpperCase();
      return `<div class="wb-avatar-slot" style="margin-bottom:4px">
        ${c.avatar
          ? `<img src="${c.avatar}" alt="${escHtml(c.name)}"/>`
          : `<span style="font-size:14px;font-weight:700">${letter}</span>`
        }
      </div>`;
    }).join('');
    if (linkedChars.length > 2) {
      avatarHTML += `<div class="wb-avatar-more">+${linkedChars.length - 2}</div>`;
    }
  }

  const div = document.createElement('div');
  div.className = 'wb-card';
  div.dataset.id = entry.id;
  div.innerHTML = `
    <div class="wb-card-stripe ${catCls}"></div>
    <div class="wb-card-body">
      <div class="wb-card-avatars">${avatarHTML}</div>
      <div class="wb-card-main">
        <div class="wb-card-top">
          <div class="wb-cat-pill ${catCls}">${entry.cat || '其他'}</div>
        </div>
        <div class="wb-card-title">${escHtml(entry.title || '未命名')}</div>
        <div class="wb-card-sub">${escHtml(entry.sub || '无描述')}</div>
        <div class="wb-card-footer">
          <div class="wb-card-meta">
            <div class="wb-status-dot ${entry.enabled !== false ? 'on' : 'off'}"></div>
            ${kwFirst ? `<div class="wb-card-kw">${escHtml(kwFirst)}</div>` : ''}
          </div>
          <div class="wb-card-arrow">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none">
              <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
    </div>`;
  div.onclick = () => openView(entry.id);
  return div;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ================================
   统计数据
================================ */
function updateStats() {
  const cats    = new Set(_entries.map(e => e.cat)).size;
  const enabled = _entries.filter(e => e.enabled !== false).length;
  const countEl   = document.getElementById('statCount');
  const catsEl    = document.getElementById('statCats');
  const enabledEl = document.getElementById('statEnabled');
  if (countEl)   countEl.textContent   = String(_entries.length).padStart(2,'0');
  if (catsEl)    catsEl.textContent    = String(cats).padStart(2,'0');
  if (enabledEl) enabledEl.textContent = String(enabled).padStart(2,'0');
}

/* ================================
   筛选 & 搜索
================================ */
function filterBy(btn) {
  document.querySelectorAll('.wb-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _filterCat = btn.dataset.cat;
  renderList();
}

function onSearch(val) {
  _searchQ = val.trim();
  renderList();
}

/* ================================
   新建 / 编辑 弹窗
================================ */
async function openNewEntry() {
  _editingId  = null;
  _formBgData = null;
  _selChars   = [];
  _formPos    = 'before';

  document.getElementById('wbModalTitle').textContent        = '新建条目';
  document.getElementById('formTitle').value                 = '';
  document.getElementById('formSub').value                   = '';
  document.getElementById('formKeywords').value              = '';
  document.getElementById('formDetail').value                = '';
  document.getElementById('detailCount').textContent         = '0';
  document.getElementById('formEnabled').checked             = true;
  document.getElementById('wbPreviewBg').style.backgroundImage = '';
  document.getElementById('previewTitle').textContent        = '条目名称';
  document.getElementById('previewSub').textContent          = '简短描述';
  document.getElementById('previewCat').textContent          = '地点';
  document.getElementById('formCat').value                   = '地点';

  // 位置按钮重置
  document.querySelectorAll('.wb-pos-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.pos === 'before');
  });

  await buildCharPicker();
  showModal();
}

async function editEntry(id) {
  const e = _entries.find(x => x.id === id);
  if (!e) return;
  _editingId  = id;
  _formBgData = e.bg || null;
  _selChars   = e.chars ? [...e.chars] : [];
  _formPos    = e.pos || 'before';

  document.getElementById('wbModalTitle').textContent = '编辑条目';
  document.getElementById('formTitle').value          = e.title    || '';
  document.getElementById('formSub').value            = e.sub      || '';
  document.getElementById('formKeywords').value       = e.keywords || '';
  document.getElementById('formDetail').value         = e.detail   || '';
  document.getElementById('detailCount').textContent  = (e.detail || '').length;
  document.getElementById('formEnabled').checked      = e.enabled !== false;
  document.getElementById('formCat').value            = e.cat      || '地点';
  document.getElementById('previewTitle').textContent = e.title    || '条目名称';
  document.getElementById('previewSub').textContent   = e.sub      || '简短描述';
  document.getElementById('previewCat').textContent   = e.cat      || '地点';

  const bg = document.getElementById('wbPreviewBg');
  bg.style.backgroundImage = e.bg ? `url(${e.bg})` : '';

  // 位置按钮
  document.querySelectorAll('.wb-pos-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.pos === _formPos);
  });

  await buildCharPicker();
  showModal();
}

/* 构建关联角色选择器 */
async function buildCharPicker() {
  _chars = await getAllChars();
  const picker = document.getElementById('wbCharPicker');
  if (_chars.length === 0) {
    picker.innerHTML = `<div class="wb-char-empty-hint">暂无角色，请先在角色档案中创建</div>`;
    return;
  }
  picker.innerHTML = _chars.map(c => {
    const letter   = (c.name || '?')[0].toUpperCase();
    const selected = _selChars.includes(c.id);
    return `
      <div class="wb-char-chip ${selected ? 'selected' : ''}" onclick="toggleCharSel(this, ${c.id})">
        <div class="wb-char-chip-av">
          ${c.avatar
            ? `<img src="${c.avatar}" alt="${escHtml(c.name)}"/>`
            : `<span>${letter}</span>`
          }
        </div>
        ${escHtml(c.name || '')}
      </div>`;
  }).join('');
}

function toggleCharSel(el, id) {
  el.classList.toggle('selected');
  if (el.classList.contains('selected')) {
    if (!_selChars.includes(id)) _selChars.push(id);
  } else {
    _selChars = _selChars.filter(x => x !== id);
  }
}

function onCatChange(sel) {
  document.getElementById('previewCat').textContent = sel.value;
}

function selectPos(btn) {
  document.querySelectorAll('.wb-pos-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _formPos = btn.dataset.pos;
}

function handleBgUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _formBgData = e.target.result;
    document.getElementById('wbPreviewBg').style.backgroundImage = `url(${e.target.result})`;
  };
  reader.readAsDataURL(file);
}

/* ================================
   保存条目
================================ */
async function saveEntry() {
  const title    = document.getElementById('formTitle').value.trim();
  const sub      = document.getElementById('formSub').value.trim();
  const cat      = document.getElementById('formCat').value;
  const keywords = document.getElementById('formKeywords').value.trim();
  const detail   = document.getElementById('formDetail').value.trim();
  const enabled  = document.getElementById('formEnabled').checked;

  if (!title) { document.getElementById('formTitle').focus(); return; }

  const data = { title, sub, cat, keywords, detail, enabled,
                 chars: [..._selChars], pos: _formPos, bg: _formBgData };
  if (_editingId) data.id = _editingId;

  await saveEntry_db(data);
  closeModal();
  await renderList();
  if (_viewingId) openView(_viewingId);
}

function showModal() {
  document.getElementById('wbModalOverlay').classList.add('show');
  document.getElementById('wbModal').classList.add('show');
}

function closeModal() {
  document.getElementById('wbModalOverlay').classList.remove('show');
  document.getElementById('wbModal').classList.remove('show');
}

/* ================================
   详情页
================================ */
async function openView(id) {
  _entries = await getAllEntries();
  _chars   = await getAllChars();
  const e  = _entries.find(x => x.id === id);
  if (!e) return;
  _viewingId = id;

  // Hero 背景
  const bg = document.getElementById('wvHeroBg');
  bg.style.backgroundImage = e.bg ? `url(${e.bg})` : '';

  // 基础信息
  const catCls = CAT_CLASS[e.cat] || 'cat-other';
  document.getElementById('wvCatBadge').textContent = e.cat || '其他';
  document.getElementById('wvTitle').textContent    = e.title   || '—';
  document.getElementById('wvSub').textContent      = e.sub     || '—';
  document.getElementById('wvCat').textContent      = e.cat     || '—';
  document.getElementById('wvPos').textContent      = posLabel(e.pos);
  document.getElementById('wvEnabled').textContent  = e.enabled !== false ? '启用' : '禁用';
  document.getElementById('wvDetail').textContent   = e.detail  || '（暂无详细设定）';

  // 状态胶囊
  const pill = document.getElementById('wvStatusPill');
  pill.textContent = e.enabled !== false ? '启用中' : '已禁用';
  pill.className   = 'wv-status-pill' + (e.enabled !== false ? '' : ' disabled');

  // 启用/禁用按钮
  const toggleBtn = document.getElementById('wvToggleBtn');
  toggleBtn.innerHTML = e.enabled !== false
    ? `<svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> 禁用条目`
    : `<svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 启用条目`;
  toggleBtn.className = 'wv-act-apply' + (e.enabled !== false ? ' disabled-state' : '');

  // 关联角色
  const charIds     = e.chars || [];
  const linkedChars = charIds.map(cid => _chars.find(c => c.id === cid)).filter(Boolean);
  const charsSection = document.getElementById('wvCharsSection');
  const charsRow     = document.getElementById('wvCharsRow');
  if (linkedChars.length === 0) {
    charsSection.style.display = 'none';
  } else {
    charsSection.style.display = '';
    charsRow.innerHTML = linkedChars.map(c => {
      const letter = (c.name || '?')[0].toUpperCase();
      return `<div class="wv-char-chip">
        <div class="wv-char-av">
          ${c.avatar
            ? `<img src="${c.avatar}" alt="${escHtml(c.name)}"/>`
            : `<span>${letter}</span>`}
        </div>
        ${escHtml(c.name || '')}
      </div>`;
    }).join('');
  }

  // 关键词
  const kws       = (e.keywords || '').split(',').map(s=>s.trim()).filter(Boolean);
  const kwSection = document.getElementById('wvKwSection');
  const kwRow     = document.getElementById('wvKwRow');
  if (kws.length === 0) {
    kwSection.style.display = 'none';
  } else {
    kwSection.style.display = '';
    kwRow.innerHTML = kws.map(k => `<div class="wv-kw-tag">${escHtml(k)}</div>`).join('');
  }

  // 显示页面
  document.getElementById('wvPage').classList.add('show');
  document.getElementById('wvPage').scrollTop = 0;
}

function posLabel(pos) {
  const map = { before: '对话前', after: '对话后', system: '系统层' };
  return map[pos] || pos || '—';
}

function closeView() {
  document.getElementById('wvPage').classList.remove('show');
  _viewingId = null;
}

/* ================================
   详情页操作
================================ */
async function toggleFromView() {
  const e = _entries.find(x => x.id === _viewingId);
  if (!e) return;
  e.enabled = e.enabled === false ? true : false;
  await saveEntry_db(e);
  await renderList();
  openView(_viewingId);
}

function openEditFromView() {
  editEntry(_viewingId);
}

function openMoreMenu() {
  document.getElementById('wvMenuOverlay').classList.add('show');
  document.getElementById('wvMenu').classList.add('show');
}

function closeMoreMenu() {
  document.getElementById('wvMenuOverlay').classList.remove('show');
  document.getElementById('wvMenu').classList.remove('show');
}

function openDeleteConfirm() {
  document.getElementById('wvConfirmOverlay').classList.add('show');
  document.getElementById('wvConfirm').classList.add('show');
}

function closeDeleteConfirm() {
  document.getElementById('wvConfirmOverlay').classList.remove('show');
  document.getElementById('wvConfirm').classList.remove('show');
}

async function confirmDelete() {
  if (!_viewingId) return;
  await deleteEntry_db(_viewingId);
  closeDeleteConfirm();
  closeView();
  await renderList();
}

/* ================================
   初始化
================================ */
document.addEventListener('DOMContentLoaded', () => {
  updateTime();
  setInterval(updateTime, 1000);
  updateBattery();
  applyIsland();
  applyGlobalFont();
  renderList();
});