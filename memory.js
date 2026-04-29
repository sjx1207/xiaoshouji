/* ================================
   Luna Memory — memory.js
   记忆档案核心逻辑 v2
   · 角色自动从 LunaCharDB 读取，无需手填
   · 状态栏 / 灵动岛 / 字体 完整同步 characters.js
================================ */

/* ================================
   状态栏时间
================================ */
function updateTime() {
  const tz  = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const now = new Date();
  const s   = now.toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  document.querySelectorAll('.status-time').forEach(el => el.textContent = s);
}

/* ================================
   电量
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
  } else { render(76); }
}

/* ================================
   灵动岛 — 完整同步 characters
================================ */
function applyIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
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
  document.querySelectorAll('.status-island').forEach(el => {
    el.innerHTML = enabled ? (styleMap[style] || styleMap.minimal) : '';
  });
  clearInterval(window._siClockTimer);
  if (enabled && style === 'clock') {
    const tick = () => {
      document.querySelectorAll('.si-clock-text').forEach(el => {
        const now = new Date();
        el.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
      });
    };
    tick();
    window._siClockTimer = setInterval(tick, 10000);
  }
}

/* ================================
   全局字体同步 — 与 characters 相同逻辑
   注意：仅同步字体族，不强制覆盖大小和颜色
================================ */
async function applyGlobalFont() {
  try {
    const style = JSON.parse(localStorage.getItem('luna_font_style') || '{}');
    const name  = localStorage.getItem('luna_font_name') || '';
    if (name && style.data) {
      const face = new FontFace(name, `url(${style.data})`);
      await face.load();
      document.fonts.add(face);
    }
    let tag = document.getElementById('luna-font-override');
    if (!tag) {
      tag = document.createElement('style');
      tag.id = 'luna-font-override';
      document.head.appendChild(tag);
    }
    // 只同步字体族，颜色/大小由各自 CSS 控制
    const familyRule = name ? `font-family: '${name}', sans-serif !important;` : '';
    tag.textContent  = familyRule ? `* { ${familyRule} }` : '';
  } catch(e) {}
}

/* localStorage 跨页同步 */
window.addEventListener('storage', (e) => {
  if (e.key === 'luna_island_update') applyIsland();
  if (e.key === 'luna_tz_update')     updateTime();
  if (e.key === 'luna_font_update')   applyGlobalFont();
  if (e.key === 'luna_memory_update') renderAll();
});

/* ================================
   返回首页
================================ */
function goBack() {
  const mask = document.createElement('div');
  mask.style.cssText = 'position:fixed;inset:0;background:rgba(238,234,227,0.97);opacity:0;z-index:9999;transition:opacity 0.28s ease;pointer-events:all;';
  document.body.appendChild(mask);
  requestAnimationFrame(() => { mask.style.opacity = '1'; });
  setTimeout(() => { window.location.href = 'index.html'; }, 260);
}

/* ================================
   IndexedDB — LunaMemoryDB
================================ */
const MEM_DB_NAME    = 'LunaMemoryDB';
const MEM_DB_VERSION = 1;
const MEM_STORE      = 'memories';

function openMemDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(MEM_DB_NAME, MEM_DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(MEM_STORE)) {
        const store = db.createObjectStore(MEM_STORE, { keyPath: 'id' });
        store.createIndex('charId', 'charId', { unique: false });
        store.createIndex('type',   'type',   { unique: false });
      }
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

async function getAllMemories() {
  const db = await openMemDB();
  return new Promise((res, rej) => {
    const req = db.transaction(MEM_STORE, 'readonly').objectStore(MEM_STORE).getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror   = () => rej(req.error);
  });
}

async function putMemory(mem) {
  const db = await openMemDB();
  return new Promise((res, rej) => {
    const req = db.transaction(MEM_STORE, 'readwrite').objectStore(MEM_STORE).put(mem);
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}

async function deleteMemory(id) {
  const db = await openMemDB();
  return new Promise((res, rej) => {
    const req = db.transaction(MEM_STORE, 'readwrite').objectStore(MEM_STORE).delete(id);
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}

/* ================================
   LunaCharDB — 读取角色列表
================================ */
async function loadCharsFromDB() {
  return new Promise((res) => {
    const req = indexedDB.open('LunaCharDB', 2);
    req.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('chars')) { res([]); return; }
      const r = db.transaction('chars', 'readonly').objectStore('chars').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror   = () => res([]);
    };
    req.onerror = () => res([]);
  });
}

/* ================================
   应用状态
================================ */
let _allMemories     = [];
let _allChars        = [];
let _activeCharId    = 'all'; // 'all' 或角色 id
let _activeType      = 'all';
let _currentMemId    = null;
let _pendingDeleteId = null;

/* ================================
   渲染入口
================================ */
async function renderAll() {
  _allMemories = await getAllMemories();
  _allChars    = await loadCharsFromDB();

  updateStats();
  renderCharStrip();
  renderCards();
  updateFabVisibility();
}

function updateStats() {
  const total = _allMemories.length;
  // 统计有记忆的角色数
  const charIds = new Set(_allMemories.map(m => m.charId || m.charName));
  document.getElementById('statTotal').textContent = String(total).padStart(2, '0');
  document.getElementById('statChars').textContent = String(charIds.size).padStart(2, '0');
}

/* ================================
   角色筛选横条
================================ */
function renderCharStrip() {
  const strip = document.getElementById('memCharStrip');
  strip.innerHTML = '';

  // "全部"按钮
  const allBtn = document.createElement('button');
  allBtn.className = 'mem-char-btn-all' + (_activeCharId === 'all' ? ' active' : '');
  allBtn.textContent = '全部';
  allBtn.onclick = () => filterChar('all', allBtn);
  strip.appendChild(allBtn);

  // 有记忆的角色 id 集合
  const usedCharIds = new Set(_allMemories.map(m => m.charId || m.charName));

  // 从 _allChars 里找出有记忆的角色
  _allChars.forEach(char => {
    const cid = char.id || char.name;
    if (!usedCharIds.has(cid)) return;

    const btn = document.createElement('button');
    btn.className = 'mem-char-btn' + (_activeCharId === cid ? ' active' : '');
    btn.dataset.id = cid;
    btn.onclick = () => filterChar(cid, btn);

    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'mem-char-btn-avatar';
    if (char.avatar) {
      const img = document.createElement('img');
      img.src = char.avatar;
      img.alt = char.name;
      avatarDiv.appendChild(img);
    } else {
      avatarDiv.textContent = (char.name || '?').charAt(0).toUpperCase();
    }

    const nameSpan = document.createElement('span');
    nameSpan.className = 'mem-char-btn-name';
    nameSpan.textContent = char.name || cid;

    btn.appendChild(avatarDiv);
    btn.appendChild(nameSpan);
    strip.appendChild(btn);
  });
}

function filterChar(id, el) {
  _activeCharId = id;
  document.querySelectorAll('.mem-char-btn, .mem-char-btn-all').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderCards();
}

function filterType(el) {
  _activeType = el.dataset.type;
  document.querySelectorAll('.mem-type-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderCards();
}

/* ================================
   卡片渲染
================================ */
function renderCards() {
  const body  = document.getElementById('memBody');
  const empty = document.getElementById('memEmpty');

  // 清除旧卡片
  body.querySelectorAll('.mem-char-group').forEach(g => g.remove());

  // 过滤
  let list = _allMemories.slice();

  if (_activeCharId !== 'all') {
    list = list.filter(m => (m.charId || m.charName) === _activeCharId);
  }
  if (_activeType !== 'all') {
    list = list.filter(m => m.type === _activeType);
  }

  if (list.length === 0) {
    empty.classList.add('show');
    // 根据情况调整提示文字
    if (_allChars.length === 0) {
      document.getElementById('emptyTitle').textContent  = '暂无角色';
      document.getElementById('emptySub').innerHTML      = '请先前往<b>角色档案</b>创建角色，<br>再回来添加记忆';
    } else if (_allMemories.length === 0) {
      document.getElementById('emptyTitle').textContent  = '暂无记忆档案';
      document.getElementById('emptySub').innerHTML      = '点击右下角 <b>+</b> 按钮为角色添加第一段记忆';
    } else {
      document.getElementById('emptyTitle').textContent  = '没有符合的记忆';
      document.getElementById('emptySub').innerHTML      = '试试切换角色或类型筛选';
    }
    return;
  }

  empty.classList.remove('show');

  // 按角色分组
  const groups = {};
  list.forEach(m => {
    const key = m.charId || m.charName;
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  });

  Object.entries(groups).forEach(([key, mems]) => {
    // 找角色信息
    const charInfo = _allChars.find(c => (c.id || c.name) === key) || { name: key };
    const group = buildGroup(charInfo, mems);
    body.appendChild(group);
  });
}

/* ================================
   分组构建
================================ */
function buildGroup(charInfo, mems) {
  const group = document.createElement('div');
  group.className = 'mem-char-group';

  // 头部行
  const header = document.createElement('div');
  header.className = 'mem-char-group-header';

  const avatar = document.createElement('div');
  avatar.className = 'mem-char-avatar';
  if (charInfo.avatar) {
    const img = document.createElement('img');
    img.src = charInfo.avatar;
    img.alt = charInfo.name;
    avatar.appendChild(img);
  } else {
    avatar.textContent = (charInfo.name || '?').charAt(0).toUpperCase();
  }

  const nameEl = document.createElement('div');
  nameEl.className = 'mem-char-group-name';
  nameEl.textContent = charInfo.name || charInfo.id;

  const countEl = document.createElement('div');
  countEl.className = 'mem-char-group-count';
  countEl.textContent = mems.length + ' 条记忆';

  header.appendChild(avatar);
  header.appendChild(nameEl);
  header.appendChild(countEl);

  // 卡片网格
  const grid = document.createElement('div');
  grid.className = 'mem-cards-grid';

  mems.forEach((mem, i) => {
    const wide = (i === 0 && mems.length > 2);
    grid.appendChild(buildCard(mem, wide));
  });

  group.appendChild(header);
  group.appendChild(grid);
  return group;
}

/* ================================
   单张卡片
================================ */
function buildCard(mem, wide) {
  const card = document.createElement('div');
  card.className = 'mem-card' + (wide ? ' wide' : '');
  card.dataset.id = mem.id;
  card.addEventListener('click', () => openDetail(mem.id));

  const stripe = document.createElement('div');
  stripe.className = `mem-card-stripe stripe-${mem.type || 'core'}`;
  card.appendChild(stripe);

  if (mem.alwaysOn) {
    const pin = document.createElement('div');
    pin.className = 'mem-card-pin';
    card.appendChild(pin);
  }

  const typeTag = document.createElement('div');
  typeTag.className = `mem-card-type type-${mem.type || 'core'}`;
  typeTag.textContent = typeLabel(mem.type);
  card.appendChild(typeTag);

  const title = document.createElement('div');
  title.className = 'mem-card-title';
  title.textContent = mem.title;
  card.appendChild(title);

  const preview = document.createElement('div');
  preview.className = 'mem-card-preview' + (wide ? ' tall' : '');
  preview.textContent = mem.content || '';
  card.appendChild(preview);

  const footer = document.createElement('div');
  footer.className = 'mem-card-footer';

  const intensity = document.createElement('div');
  intensity.className = 'mem-card-intensity';
  for (let i = 1; i <= 5; i++) {
    const dot = document.createElement('span');
    if (i <= (mem.intensity || 3)) dot.classList.add('on');
    intensity.appendChild(dot);
  }

  const dateEl = document.createElement('div');
  dateEl.className = 'mem-card-date';
  dateEl.textContent = formatDate(mem.createdAt);

  footer.appendChild(intensity);
  footer.appendChild(dateEl);
  card.appendChild(footer);
  return card;
}

function typeLabel(type) {
  return { core: '核心记忆', relation: '关系', emotion: '情绪', event: '事件' }[type] || '记忆';
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getMonth()+1}/${d.getDate()}`;
}

/* ================================
   FAB 显示控制
================================ */
function updateFabVisibility() {
  const fab = document.getElementById('memFab');
  // 有角色才显示新增按钮
  fab.style.display = _allChars.length > 0 ? 'flex' : 'none';
}

/* ================================
   详情面板
================================ */
async function openDetail(id) {
  const mem = _allMemories.find(m => m.id === id);
  if (!mem) return;
  _currentMemId = id;

  // 找角色名
  const charInfo = _allChars.find(c => (c.id || c.name) === (mem.charId || mem.charName));
  const charDisplay = charInfo ? charInfo.name : (mem.charName || mem.charId || '');

  document.getElementById('detailCharName').textContent = charDisplay;
  document.getElementById('detailTitle').textContent    = mem.title;

  const body = document.getElementById('detailBody');
  body.innerHTML = '';

  // 类型 + 强度
  const metaBlock = document.createElement('div');
  metaBlock.className = 'mem-detail-block';
  metaBlock.innerHTML = `
    <div class="mem-detail-block-label">分类 / 情感强度</div>
    <div style="display:flex;align-items:center;gap:12px;margin-top:4px;">
      <span class="mem-card-type type-${mem.type || 'core'}">${typeLabel(mem.type)}</span>
      <div class="mem-detail-intensity">
        ${[1,2,3,4,5].map(i => `<div class="mem-detail-dot${i <= (mem.intensity||3) ? ' on' : ''}"></div>`).join('')}
      </div>
      ${mem.alwaysOn ? '<span style="font-family:\'Space Mono\',monospace;font-size:8px;letter-spacing:1.5px;color:var(--accent);">常驻</span>' : ''}
    </div>
  `;
  body.appendChild(metaBlock);

  if (mem.content) {
    const cb = document.createElement('div');
    cb.className = 'mem-detail-block';
    cb.innerHTML = `<div class="mem-detail-block-label">记忆内容</div><div class="mem-detail-block-text">${escapeHtml(mem.content)}</div>`;
    body.appendChild(cb);
  }

  if (mem.prompt) {
    const pb = document.createElement('div');
    pb.className = 'mem-prompt-block';
    pb.innerHTML = `<div class="mem-detail-block-label">AI 提示词片段</div><div class="mem-detail-block-text">${escapeHtml(mem.prompt)}</div>`;
    body.appendChild(pb);
  }

  if (mem.tags && mem.tags.trim()) {
    const tb = document.createElement('div');
    tb.className = 'mem-detail-block';
    const tagList = mem.tags.trim().split(/\s+/).map(t =>
      `<span class="mem-detail-tag">${escapeHtml(t)}</span>`
    ).join('');
    tb.innerHTML = `<div class="mem-detail-block-label">关键词标签</div><div class="mem-detail-tags">${tagList}</div>`;
    body.appendChild(tb);
  }

  const timeBlock = document.createElement('div');
  timeBlock.className = 'mem-detail-block';
  timeBlock.innerHTML = `
    <div class="mem-detail-block-label">创建时间</div>
    <div class="mem-detail-block-text" style="font-family:'Space Mono',monospace;font-size:11px;">
      ${mem.createdAt ? new Date(mem.createdAt).toLocaleString('zh-CN') : '未知'}
    </div>
  `;
  body.appendChild(timeBlock);

  document.getElementById('memOverlay').classList.add('show');
  document.getElementById('memDetailPanel').classList.add('show');
}

function closeDetail() {
  document.getElementById('memOverlay').classList.remove('show');
  document.getElementById('memDetailPanel').classList.remove('show');
  _currentMemId = null;
}

function editCurrentMemory() {
  if (!_currentMemId) return;
  const mem = _allMemories.find(m => m.id === _currentMemId);
  if (!mem) return;
  closeDetail();
  setTimeout(() => openEditPanel(mem), 320);
}

/* ================================
   新增/编辑面板
================================ */
async function openEditPanel(mem) {
  const isEdit = !!mem;
  document.getElementById('editPanelTitle').textContent = isEdit ? '编辑记忆' : '新增记忆';
  document.getElementById('editId').value       = mem ? mem.id : '';
  document.getElementById('editTitle').value    = mem ? mem.title : '';
  document.getElementById('editContent').value  = mem ? (mem.content || '') : '';
  document.getElementById('editPrompt').value   = mem ? (mem.prompt  || '') : '';
  document.getElementById('editTags').value     = mem ? (mem.tags    || '') : '';
  document.getElementById('editIntensity').value = mem ? (mem.intensity || 3) : 3;
  document.getElementById('intensityVal').textContent = mem ? (mem.intensity || 3) : 3;

  const alwaysToggle = document.getElementById('alwaysToggle');
  alwaysToggle.dataset.on = mem ? String(!!mem.alwaysOn) : 'false';

  // 类型
  document.querySelectorAll('.mem-type-btn').forEach(btn => {
    btn.classList.remove('active');
    if (mem ? btn.dataset.type === mem.type : btn.dataset.type === 'core') {
      btn.classList.add('active');
    }
  });

  // 渲染角色选择
  await renderCharSelect(mem ? (mem.charId || mem.charName) : null);

  document.getElementById('editOverlay').classList.add('show');
  document.getElementById('memEditPanel').classList.add('show');
}

async function renderCharSelect(selectedId) {
  const container = document.getElementById('charSelectRow');
  container.innerHTML = '';

  const chars = await loadCharsFromDB();

  if (chars.length === 0) {
    container.innerHTML = '<div class="mem-no-chars">请先在角色档案中创建角色</div>';
    return;
  }

  chars.forEach((char, i) => {
    const cid = char.id || char.name;
    const btn = document.createElement('button');
    btn.className = 'mem-char-select-btn' + (
      selectedId ? (cid === selectedId ? ' active' : '') : (i === 0 ? ' active' : '')
    );
    btn.dataset.id   = cid;
    btn.dataset.name = char.name || cid;
    btn.onclick      = () => {
      document.querySelectorAll('.mem-char-select-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    };

    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'mem-char-select-avatar';
    if (char.avatar) {
      const img = document.createElement('img');
      img.src = char.avatar;
      img.alt = char.name;
      avatarDiv.appendChild(img);
    } else {
      avatarDiv.textContent = (char.name || '?').charAt(0).toUpperCase();
    }

    btn.appendChild(avatarDiv);
    btn.appendChild(document.createTextNode(char.name || cid));
    container.appendChild(btn);
  });
}

function closeEdit() {
  document.getElementById('editOverlay').classList.remove('show');
  document.getElementById('memEditPanel').classList.remove('show');
}

function selectType(btn) {
  document.querySelectorAll('.mem-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function updateIntensity(val) {
  document.getElementById('intensityVal').textContent = val;
}

function toggleAlways() {
  const el = document.getElementById('alwaysToggle');
  el.dataset.on = el.dataset.on === 'true' ? 'false' : 'true';
}

async function saveMemory() {
  // 取选中角色
  const activeCharBtn = document.querySelector('.mem-char-select-btn.active');
  if (!activeCharBtn) { showToast('请选择所属角色'); return; }

  const charId   = activeCharBtn.dataset.id;
  const charName = activeCharBtn.dataset.name;
  const title    = document.getElementById('editTitle').value.trim();
  const content  = document.getElementById('editContent').value.trim();
  const prompt   = document.getElementById('editPrompt').value.trim();
  const tags     = document.getElementById('editTags').value.trim();
  const intensity = parseInt(document.getElementById('editIntensity').value) || 3;
  const alwaysOn  = document.getElementById('alwaysToggle').dataset.on === 'true';
  const type      = document.querySelector('.mem-type-btn.active')?.dataset.type || 'core';
  const id        = document.getElementById('editId').value;

  if (!title) { showToast('记忆标题不能为空'); return; }

  const mem = {
    id:        id || ('mem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
    charId,
    charName,
    title, content, prompt, tags, type, intensity, alwaysOn,
    createdAt: id ? (_allMemories.find(m => m.id === id)?.createdAt || Date.now()) : Date.now(),
    updatedAt: Date.now()
  };

  await putMemory(mem);
  closeEdit();
  await renderAll();
  showToast('记忆已保存');
  localStorage.setItem('luna_memory_update', Date.now().toString());
}

/* ================================
   删除
================================ */
function deleteCurrentMemory() {
  if (!_currentMemId) return;
  _pendingDeleteId = _currentMemId;
  document.getElementById('confirmOverlay').classList.add('show');
  document.getElementById('memConfirmPanel').classList.add('show');
}

function cancelDelete() {
  _pendingDeleteId = null;
  document.getElementById('confirmOverlay').classList.remove('show');
  document.getElementById('memConfirmPanel').classList.remove('show');
}

async function confirmDelete() {
  if (!_pendingDeleteId) return;
  await deleteMemory(_pendingDeleteId);
  cancelDelete();
  closeDetail();
  await renderAll();
  showToast('记忆已删除');
  localStorage.setItem('luna_memory_update', Date.now().toString());
}

/* ================================
   Toast
================================ */
function showToast(msg) {
  let toast = document.getElementById('lunaToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'lunaToast';
    toast.style.cssText = `
      position:fixed; bottom:80px; left:50%; transform:translateX(-50%) translateY(10px);
      background:#1c1916; color:#f5f0e8; font-size:13px; font-weight:500;
      padding:10px 22px; border-radius:22px; z-index:9999;
      opacity:0; transition:all 0.26s cubic-bezier(0.34,1.2,0.64,1);
      white-space:nowrap; letter-spacing:0.2px; font-family:'DM Sans',sans-serif;
      box-shadow:0 6px 22px rgba(28,25,22,0.25);
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  requestAnimationFrame(() => {
    toast.style.opacity   = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    toast.style.opacity   = '0';
    toast.style.transform = 'translateX(-50%) translateY(10px)';
  }, 2200);
}

/* ================================
   工具
================================ */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

/* ================================
   公开 API — 供 Chat/AI 调用
================================ */
async function getMemoriesForChar(charId) {
  const all = await getAllMemories();
  return all
    .filter(m => m.charId === charId || m.charName === charId)
    .sort((a, b) => {
      if (a.alwaysOn !== b.alwaysOn) return b.alwaysOn ? 1 : -1;
      return (b.intensity || 0) - (a.intensity || 0);
    });
}

async function buildMemoryPrompt(charId) {
  const mems = await getMemoriesForChar(charId);
  if (!mems.length) return '';

  const alwaysOn   = mems.filter(m => m.alwaysOn);
  const contextual = mems.filter(m => !m.alwaysOn).slice(0, 8);
  const label = charId;

  let lines = [`[${label} 的记忆档案]`];

  if (alwaysOn.length) {
    lines.push('\n【核心常驻记忆】');
    alwaysOn.forEach(m => {
      lines.push(`- ${m.title}（${typeLabel(m.type)}）`);
      if (m.prompt) lines.push(`  ${m.prompt}`);
      else if (m.content) lines.push(`  ${m.content.slice(0, 120)}`);
    });
  }

  if (contextual.length) {
    lines.push('\n【背景记忆参考】');
    contextual.forEach(m => {
      lines.push(`- ${m.title}：${(m.prompt || m.content || '').slice(0, 80)}`);
    });
  }

  return lines.join('\n');
}

window.MemoryAPI = {
  getMemoriesForChar,
  buildMemoryPrompt,
  getAllMemories,
  putMemory,
  deleteMemory
};

/* ================================
   初始化
================================ */
document.addEventListener('DOMContentLoaded', async () => {
  updateTime();
  setInterval(updateTime, 1000);
  updateBattery();
  applyIsland();
  applyGlobalFont();
  await renderAll();
});

window.addEventListener('pageshow', e => {
  if (e.persisted) window.location.reload();
  applyGlobalFont();
});