/* ================================
   角色档案 — characters.js
   状态栏 / 灵动岛 完整同步 index
================================ */

/* ---- 返回首页 ---- */
function goBack() {
  const mask = document.createElement('div');
  mask.style.cssText = 'position:fixed;inset:0;background:rgba(238,234,227,0.97);opacity:0;z-index:9999;transition:opacity 0.28s ease;pointer-events:all;';
  document.body.appendChild(mask);
  requestAnimationFrame(() => { mask.style.opacity = '1'; });
  setTimeout(() => { window.location.href = 'index.html'; }, 260);
}

/* ================================
   状态栏时间 — 同步 index 逻辑
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
   电量 — 同步 index 逻辑
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
   灵动岛 — 完整同步 index 逻辑
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
  if (e.key === 'luna_font_update')   applyGlobalFont();  // ← 加这行
});

/* ================================
   Tab 切换（仅视觉）
================================ */
function switchTab(el) {
  document.querySelectorAll('.ch-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

/* ================================
   颜色方案
================================ */
const COLOR_MAP = {
  warm:  { strip: 'linear-gradient(180deg,#c9b89a,#a8956e)', topC1:'#f5efe7', topC2:'#ede3d5', avBg:'#1e1a14', avCol:'#c9b89a' },
  cool:  { strip: 'linear-gradient(180deg,#8fa3a8,#607d85)', topC1:'#e8eef0', topC2:'#d8e6ea', avBg:'#101618', avCol:'#8fa3a8' },
  gold:  { strip: 'linear-gradient(180deg,#b8a47a,#927d50)', topC1:'#f0eadb', topC2:'#e4d9c4', avBg:'#181410', avCol:'#b8a47a' },
  ash:   { strip: 'linear-gradient(180deg,#9d9d9d,#707070)', topC1:'#ebebeb', topC2:'#dedede', avBg:'#141414', avCol:'#9d9d9d' },
  mist:  { strip: 'linear-gradient(180deg,#a8b5a0,#7a8e72)', topC1:'#e5ede2', topC2:'#d5e2d0', avBg:'#111512', avCol:'#a8b5a0' },
  blush: { strip: 'linear-gradient(180deg,#c4a5a0,#9e7870)', topC1:'#f0e5e3', topC2:'#e4d5d2', avBg:'#180f0e', avCol:'#c4a5a0' },
};

/* ================================
   IndexedDB
================================ */
let _db = null;

function openCharDB() {
  return new Promise((res, rej) => {
    if (_db) return res(_db);
    const req = indexedDB.open('LunaCharDB', 2);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = e => { _db = e.target.result; res(_db); };
    req.onerror = () => rej('DB Error');
  });
}

async function getAllChars() {
  const db = await openCharDB();
  return new Promise(res => {
    const req = db.transaction('chars').objectStore('chars').getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror  = () => res([]);
  });
}

async function saveChar(data) {
  const db = await openCharDB();
  return new Promise(res => {
    const tx    = db.transaction('chars', 'readwrite');
    const store = tx.objectStore('chars');
    const req   = data.id ? store.put(data) : store.add(data);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => res(null);
  });
}

/* ================================
   渲染列表
================================ */
let _chars   = [];
let _activeId = null;

async function renderList() {
  _chars    = await getAllChars();
  _activeId = parseInt(localStorage.getItem('luna_active_char')) || null;

  if (_chars.length === 0) {
    list.innerHTML = `
      <div class="ch-empty">
        <div class="ch-empty-icon">
          <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
            <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="1.5" opacity="0.3"/>
            <circle cx="18" cy="20" r="3" fill="currentColor" opacity="0.4"/>
            <circle cx="30" cy="20" r="3" fill="currentColor" opacity="0.4"/>
            <path d="M16 30c2-3 6-5 8-5s6 2 8 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
            <path d="M24 4v4M24 40v4M4 24h4M40 24h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.2"/>
          </svg>
        </div>
        <div class="ch-empty-title">还没有角色</div>
        <div class="ch-empty-desc">点击右上角 <strong>+</strong> 创建你的第一个 AI 角色</div>
        <button class="ch-empty-btn" onclick="openNewCard()">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          立即创建
        </button>
      </div>`;
    return;
  }

  const list = document.getElementById('chList');
  list.innerHTML = '';
  _chars.forEach((c, i) => {
    const card = buildCard(c, i + 1);
    card.style.animation = `fadeUp 0.5s ease both ${0.05 + i * 0.1}s`;
    list.appendChild(card);
  });
  list.appendChild(Object.assign(document.createElement('div'), { style: 'height:40px' }));

  const countEl = document.getElementById('statCount');
  if (countEl) countEl.textContent = String(_chars.length).padStart(2, '0');
}

function buildCard(c, idx) {
  const col      = COLOR_MAP[c.color] || COLOR_MAP.warm;
  const isActive = c.id === _activeId;
  const letter   = (c.name || '?')[0].toUpperCase();
  const idxStr   = String(idx).padStart(2, '0');
  const promptPrev = (c.prompt || '').slice(0, 28) + (c.prompt && c.prompt.length > 28 ? '...' : '');

  const div = document.createElement('div');
  div.className  = 'ch-card' + (isActive ? ' ch-card-active' : '');
  div.onclick = () => toggleCard(div);
  div.dataset.id = c.id;
  div.innerHTML = `
  <div class="ch-card-banner" style="
  --card-c1:${col.topC1};--card-c2:${col.topC2};
  ${c.cardBg ? `background-image:url(${c.cardBg});background-size:cover;background-position:center;` : ''}
">
    <div class="ch-card-banner-deco"></div>
    <div class="ch-card-banner-deco2"></div>
    <div class="ch-card-banner-status">
      <div class="ch-status-pill${isActive ? ' active' : ''}">${isActive ? '激活中' : '待机'}</div>
    </div>
  </div>
  <div class="ch-card-peek">
    <div class="ch-card-peek-avatar">
      <div class="ch-avatar" style="--av-bg:${col.avBg};--av-col:${col.avCol}">
        ${c.avatar
          ? `<img src="${c.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:11px;" />`
          : `<span class="ch-av-letter">${letter}</span>`
        }
      </div>
    </div>
    <div class="ch-card-peek-info">
      <div class="ch-card-peek-name">${escHtml(c.name || '')}</div>
      <div class="ch-card-peek-role">${escHtml(c.role || '')}</div>
    </div>
    <div class="ch-card-peek-arrow">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none">
        <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  </div>
  <div class="ch-card-expand">
    <div class="ch-card-body">
      <div class="ch-card-divider"></div>
      <div class="ch-trait-row">
        ${(c.traits || []).map(t => `<span class="ch-trait">${escHtml(t)}</span>`).join('')}
      </div>
      <div class="ch-card-desc">${escHtml((c.desc || '').slice(0, 60))}${c.desc && c.desc.length > 60 ? '...' : ''}</div>
      <div class="ch-prompt-box">
        <span class="ch-prompt-tag">PROMPT</span>
        <span class="ch-prompt-snippet">${escHtml(promptPrev || '（未设置提示词）')}</span>
      </div>
    </div>
    <div class="ch-card-actions">
      <button class="ch-btn-edit" onclick="event.stopPropagation();openView(${c.id})">查看</button>
      <button class="ch-btn-apply${isActive ? ' applied' : ''}" onclick="event.stopPropagation();applyCard(${c.id})">
        ${isActive ? '✓ 已应用' : '应用'}
      </button>
    </div>
  </div>`;
  return div;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ================================
   应用角色
================================ */
function applyCard(id) {
  const c = _chars.find(x => x.id === id);
  if (!c) return;
  localStorage.setItem('luna_active_char', id);
  localStorage.setItem('luna_char_prompt', c.prompt || '');
  localStorage.setItem('luna_char_name',   c.name   || '');
  _activeId = id;

  document.querySelectorAll('.ch-card').forEach(card => {
    const cid    = parseInt(card.dataset.id);
    const btn    = card.querySelector('.ch-btn-apply');
    const status = card.querySelector('.ch-status-pill');
    if (!btn) return;

    if (cid === id) {
      btn.textContent = '已应用';
      btn.classList.add('applied');
      card.classList.add('ch-card-active');
      if (status) { status.textContent = '激活中'; status.classList.add('active'); }
    } else {
      btn.textContent = '应用';
      btn.classList.remove('applied');
      card.classList.remove('ch-card-active');
      if (status) { status.textContent = '待机'; status.classList.remove('active'); }
    }
  });
}

/* ================================
   弹窗 — 新建 / 编辑
================================ */
let _editingId = null;

function openNewCard() {
  _editingId = null;
  _formAvatarData = null;
  _formBgData = null;
  _formGender = '女';
  document.getElementById('chModalTitle').textContent = '新建角色';
  document.getElementById('formName').value     = '';
  document.getElementById('formRole').value     = '';
  document.getElementById('formDesc').value     = '';
  document.getElementById('formTraits').value   = '';
  document.getElementById('formPrompt').value   = '';
  document.getElementById('formAge').value      = '';
  document.getElementById('formBirthday').value = '';
  document.getElementById('previewName').textContent = '角色名称';
  document.getElementById('previewMeta').textContent = '定位 · 性别 · 年龄';
  document.getElementById('previewAvatar').innerHTML = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.5"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  document.getElementById('previewBg').style.backgroundImage = '';
  document.getElementById('descCount').textContent = '0';
  document.querySelectorAll('.ch-gender-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  document.querySelectorAll('.ch-color-opt').forEach((o, i) => o.classList.toggle('selected', i === 0));
  showModal();
}

async function editCard(id) {
  const c = _chars.find(x => x.id === id);
  if (!c) return;
  _editingId = id;

  // 文字字段
  document.getElementById('chModalTitle').textContent  = '编辑角色';
  document.getElementById('formName').value            = c.name     || '';
  document.getElementById('formRole').value            = c.role     || '';
  document.getElementById('formDesc').value            = c.desc     || '';
  document.getElementById('formTraits').value          = (c.traits || []).join(', ');
  document.getElementById('formPrompt').value          = c.prompt   || '';
  document.getElementById('formAge').value             = c.age      || '';
  document.getElementById('formBirthday').value        = c.birthday || '';
  document.getElementById('descCount').textContent     = (c.desc || '').length;

  // 性别按钮
  _formGender = c.gender || '女';
  document.querySelectorAll('.ch-gender-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.gender === _formGender);
  });

  // 颜色
  document.querySelectorAll('.ch-color-opt').forEach(o => {
    o.classList.toggle('selected', o.dataset.color === (c.color || 'warm'));
  });

  // 头像预览回填
  _formAvatarData = c.avatar || null;
  const av = document.getElementById('previewAvatar');
  if (c.avatar) {
    av.innerHTML = `<img src="${c.avatar}" alt="avatar"/>`;
  } else {
    av.innerHTML = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.5"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  }

  // 背景图预览回填
  _formBgData = c.cardBg || null;
  const bg = document.getElementById('previewBg');
  bg.style.backgroundImage = c.cardBg ? `url(${c.cardBg})` : '';

  // 预览名字和 meta
  document.getElementById('previewName').textContent = c.name || '角色名称';
  updatePreviewMeta();

  showModal();
}

async function saveCard() {
  const name   = document.getElementById('formName').value.trim();
  const role   = document.getElementById('formRole').value.trim();
  const desc   = document.getElementById('formDesc').value.trim();
  const traits = document.getElementById('formTraits').value.split(',').map(s => s.trim()).filter(Boolean);
  const prompt = document.getElementById('formPrompt').value.trim();

  if (!name) { document.getElementById('formName').focus(); return; }

  const age      = document.getElementById('formAge').value.trim();
    const birthday = document.getElementById('formBirthday').value.trim();
    const data = { name, role, desc, traits, prompt,
                gender: _formGender, age, birthday,
                avatar: _formAvatarData, cardBg: _formBgData };
  if (_editingId) data.id = _editingId;

  await saveChar(data);
  closeModal();
  await renderList();
  if (_viewingId) openView(_viewingId);  // ← 加这行，刷新详情页数据
}

function showModal() {
  document.getElementById('chModalOverlay').classList.add('show');
  document.getElementById('chModal').classList.add('show');
}

function closeModal() {
  document.getElementById('chModalOverlay').classList.remove('show');
  document.getElementById('chModal').classList.remove('show');
}

function selectColor(el) {
  document.querySelectorAll('.ch-color-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}

/* ================================
   初始化
================================ */
document.addEventListener('DOMContentLoaded', () => {
  updateTime();
  setInterval(updateTime, 1000);
  updateBattery();
  applyIsland();
  applyGlobalFont();  // ← 加这行
  renderList();
});

/* ================================
   字体同步
================================ */
async function applyGlobalFont() {
  const style = JSON.parse(localStorage.getItem('luna_font_style') || '{}');
  const name  = localStorage.getItem('luna_font_active_name');
  const id    = parseInt(localStorage.getItem('luna_font_active_id'));
  if (name && id) {
    try {
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open('LunaFontDB', 3);
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

function toggleCard(el) {
  const isExpanded = el.classList.contains('expanded');
  // 关闭所有
  document.querySelectorAll('.ch-card').forEach(c => c.classList.remove('expanded'));
  // 如果点的不是已展开的，就展开它
  if (!isExpanded) el.classList.add('expanded');
}

/* ================================
   弹窗辅助函数
================================ */
let _formAvatarData = null;
let _formBgData = null;
let _formGender = '女';

function handleAvatarUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _formAvatarData = e.target.result;
    const av = document.getElementById('previewAvatar');
    av.innerHTML = `<img src="${e.target.result}" alt="avatar"/>`;
  };
  reader.readAsDataURL(file);
}

function handleBgUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _formBgData = e.target.result;
    document.getElementById('previewBg').style.backgroundImage = `url(${e.target.result})`;
  };
  reader.readAsDataURL(file);
}

function selectGender(el) {
  document.querySelectorAll('.ch-gender-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  _formGender = el.dataset.gender;
  updatePreviewMeta();
}

function updatePreviewMeta() {
  const role = document.getElementById('formRole').value || '定位';
  const age  = document.getElementById('formAge').value  || '年龄';
  document.getElementById('previewMeta').textContent = `${role} · ${_formGender} · ${age}`;
}

/* ================================
   详情页
================================ */
let _viewingId = null;

function openView(id) {
  const c = _chars.find(x => x.id === id);
  if (!c) return;
  _viewingId = id;

  // 背景图
  const bg = document.getElementById('cvHeroBg');
  if (c.cardBg) {
    bg.style.backgroundImage = `url(${c.cardBg})`;
  } else {
    const col = COLOR_MAP[c.color] || COLOR_MAP.warm;
    bg.style.backgroundImage = 'none';
    bg.style.background = `linear-gradient(135deg, ${col.topC1}, ${col.topC2})`;
  }

  // 头像
  const av = document.getElementById('cvAvatar');
  if (c.avatar) {
    av.innerHTML = `<img src="${c.avatar}" alt="avatar"/>`;
  } else {
    const col = COLOR_MAP[c.color] || COLOR_MAP.warm;
    av.innerHTML = `<div class="cv-hero-avatar-letter" style="color:${col.avCol}">${(c.name||'?')[0].toUpperCase()}</div>`;
    av.style.background = col.avBg;
  }

  // 基本信息
  document.getElementById('cvName').textContent     = c.name     || '—';
  document.getElementById('cvRole').textContent     = c.role     || '—';
  document.getElementById('cvGender').textContent   = c.gender   || '—';
  document.getElementById('cvAge').textContent      = c.age ? c.age + ' 岁' : '—';
  document.getElementById('cvBirthday').textContent = c.birthday || '—';
  document.getElementById('cvDesc').textContent     = c.desc     || '暂无描述';
  document.getElementById('cvPrompt').textContent   = c.prompt   || '（未设置，将自动生成）';

  // 状态胶囊
  const isActive = c.id === _activeId;
  const statusEl = document.getElementById('cvStatus');
  statusEl.innerHTML = `<div class="ch-status-pill${isActive ? ' active' : ''}">${isActive ? '激活中' : '待机'}</div>`;

  // 应用按钮状态
  const applyBtn = document.getElementById('cvApplyBtn');
  if (isActive) {
    applyBtn.classList.add('applied');
    applyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 已应用`;
  } else {
    applyBtn.classList.remove('applied');
    applyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 应用角色`;
  }

  // 性格标签
  const traitsEl = document.getElementById('cvTraits');
  traitsEl.innerHTML = (c.traits||[]).map(t =>
    `<span class="cv-trait">${escHtml(t)}</span>`
  ).join('');

  // 打开页面
  document.getElementById('cvPage').classList.add('show');
}

function closeView() {
  document.getElementById('cvPage').classList.remove('show');
  _viewingId = null;
}

function openMoreMenu() {
  document.getElementById('cvMenuOverlay').classList.add('show');
  document.getElementById('cvMenu').classList.add('show');
}
function closeMoreMenu() {
  document.getElementById('cvMenuOverlay').classList.remove('show');
  document.getElementById('cvMenu').classList.remove('show');
}

function openDeleteConfirm() {
  document.getElementById('cvConfirmOverlay').classList.add('show');
  document.getElementById('cvConfirm').classList.add('show');
}
function closeDeleteConfirm() {
  document.getElementById('cvConfirmOverlay').classList.remove('show');
  document.getElementById('cvConfirm').classList.remove('show');
}

async function confirmDelete() {
  if (!_viewingId) return;
  const db = await openCharDB();
  await new Promise(res => {
    const tx = db.transaction('chars', 'readwrite');
    tx.objectStore('chars').delete(_viewingId);
    tx.oncomplete = res;
  });
  // 如果删的是激活角色，清掉 localStorage
  if (_viewingId === _activeId) {
    localStorage.removeItem('luna_active_char');
    localStorage.removeItem('luna_char_prompt');
    localStorage.removeItem('luna_char_name');
  }
  closeDeleteConfirm();
  closeView();
  await renderList();
}

function openEditFromView() {
  if (!_viewingId) return;
  const id = _viewingId;   // 先把 id 存下来
  setTimeout(() => editCard(id), 380);  // 用局部变量，不受 closeView 影响
}

function applyFromView() {
  if (!_viewingId) return;
  applyCard(_viewingId);
  // 刷新详情页状态
  openView(_viewingId);
}