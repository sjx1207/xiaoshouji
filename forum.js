/* ================================
   PRISM Forum — forum.js
   状态栏时间/电量同步、灵动岛同步、
   字体【仅字族】同步、页面切换逻辑
================================ */

/* ══════════════════════════════
   状态栏 — 时间（同步 index/settings）
══════════════════════════════ */
function updateTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-CN', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const el = document.getElementById('statusTime');
  if (el) el.textContent = timeStr;
}

/* ══════════════════════════════
   状态栏 — 电量（同步 index/settings）
══════════════════════════════ */
function updateBattery() {
  const pctEl   = document.getElementById('batPct');
  const innerEl = document.getElementById('batInner');

  function render(pct) {
    const p = Math.round(pct);
    if (pctEl)   pctEl.textContent = p;
    if (innerEl) {
      innerEl.style.width      = p + '%';
      innerEl.style.background = p <= 20
        ? 'linear-gradient(90deg, #f87171, #ef4444)'
        : 'linear-gradient(90deg, #6ee7b7, #34d399)';
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

/* ══════════════════════════════
   灵动岛（同步 settings.js applyIsland）
══════════════════════════════ */
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

  clearInterval(window._siClockTimer);
  if (style === 'clock') {
    const tick = () => {
      const t = document.getElementById('siClockText');
      if (!t) return;
      const now = new Date();
      t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    };
    tick();
    window._siClockTimer = setInterval(tick, 10000);
  }
}

/* ══════════════════════════════
   字体同步 — ⚠️ 仅同步字体族（font-family）
   禁止同步 font-size / font-weight（由 forum.css 自行控制）
══════════════════════════════ */
async function applyFontFamily() {
  const name = localStorage.getItem('luna_font_active_name');
  const id   = parseInt(localStorage.getItem('luna_font_active_id'));

  // 若设置了颜色，也允许同步颜色（但不同步大小和粗细）
  let tag = document.getElementById('luna-font-override');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'luna-font-override';
    document.head.appendChild(tag);
  }

  const style      = JSON.parse(localStorage.getItem('luna_font_style') || '{}');
  const colorRule  = style.color  ? `color: ${style.color} !important;` : '';
  // ⚠️ 故意不读取 style.size 和 style.weight，避免破坏排版
  const familyRule = name         ? `font-family: '${name}', 'DM Sans', sans-serif !important;` : '';

  tag.textContent = `* { ${colorRule} ${familyRule} }`;

  // 若是自定义字体文件，从 IndexedDB 加载字型
  if (name && id) {
    try {
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open('LunaFontDB', 3);
        req.onsuccess  = e => res(e.target.result);
        req.onerror    = ()  => rej();
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
    } catch (e) {
      // 字体加载失败时静默降级，保持系统字体
    }
    document.body.style.fontFamily = `'${name}', 'DM Sans', sans-serif`;
  }
}

/* ══════════════════════════════
   页面切换
══════════════════════════════ */
function switchPage(pageName, btn) {
  // 隐藏所有页
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // 切换导航激活态
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // 显示目标页
  const target = document.getElementById('page-' + pageName);
  if (target) {
    target.classList.add('active');
    const scroll = target.querySelector('.page-scroll');
    if (scroll) scroll.scrollTop = 0;
  }

  // 激活导航按钮
  if (btn) btn.classList.add('active');

  // 触感反馈
  if (window.navigator && navigator.vibrate) navigator.vibrate(8);

  // profile 页状态栏变白，其他页恢复
  const statusBar = document.querySelector('.status-bar');
  if (statusBar) {
    if (pageName === 'profile') {
      statusBar.classList.add('profile-mode');
    } else {
      statusBar.classList.remove('profile-mode');
    }
  }

  // 滑块跟随（如果不是发布键才移动）
  if (btn && !btn.classList.contains('nav-center-btn')) {
    const track = document.querySelector('.nav-track');
    const slider = document.querySelector('.nav-slider');
    if (track && slider) {
      const navRect = track.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      slider.style.left  = (btnRect.left - navRect.left + 4) + 'px';
      slider.style.width = (btnRect.width - 8) + 'px';
    }
  }
}

/* ── 筛选标签切换 ── */
document.addEventListener('click', function(e) {
  const tab = e.target.closest('.filter-tab');
  if (tab) {
    const siblings = tab.parentElement.querySelectorAll('.filter-tab');
    siblings.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
  }

  const typeTab = e.target.closest('.type-tab');
  if (typeTab) {
    const siblings = typeTab.parentElement.querySelectorAll('.type-tab');
    siblings.forEach(t => t.classList.remove('active'));
    typeTab.classList.add('active');
  }

  const profileTab = e.target.closest('.profile-tab');
  if (profileTab) {
    const siblings = profileTab.parentElement.querySelectorAll('.profile-tab');
    siblings.forEach(t => t.classList.remove('active'));
    profileTab.classList.add('active');
  }

  const tagChip = e.target.closest('.tag-chip:not(.add-chip)');
  if (tagChip) {
    tagChip.classList.toggle('active');
  }
});

/* ══════════════════════════════
   返回 index.html（从 luna-frame 退出）
══════════════════════════════ */
function goBackToHome() {
  const frame = document.getElementById('lunaFrame');
  if (frame) {
    frame.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
    frame.style.opacity    = '0';
    frame.style.transform  = 'scale(0.96) translateX(-20px)';
  }
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 220);
}

/* ══════════════════════════════
   阻止浏览器缓存快照（与 index/settings 一致）
══════════════════════════════ */
window.addEventListener('pageshow', (e) => {
  if (e.persisted) window.location.reload();
});

/* ══════════════════════════════
   监听 settings 变更实时同步
══════════════════════════════ */
window.addEventListener('storage', (e) => {
  if (e.key === 'luna_island_update') {
    applyIsland();
  }
  if (e.key === 'luna_font_active_name' || e.key === 'luna_font_style') {
    applyFontFamily();
  }
  if (e.key === 'luna_tz' || e.key === 'luna_tz_update') {
    updateTime();
  }
});

/* ══════════════════════════════
   初始化
══════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  updateTime();
  updateBattery();
  setInterval(updateTime, 1000);
  applyIsland();
  applyFontFamily();

  // 启动时读取已缓存的热搜数据
  const cachedTrending = loadTrendingFromStorage();
  if (cachedTrending) {
    _trendingData = cachedTrending.data;
    _trendTime    = cachedTrending.time;
    renderTrendList(_trendingData.top50.slice(0, 5));
    document.getElementById('trendFullBtn').style.display = '';
  }

  // 启动时读取已缓存的帖子
  const cachedPosts = loadPostsFromStorage();
  if (cachedPosts) {
    renderPostList(cachedPosts);
  }

  // 创建滑块并定位到默认激活项
  const track = document.querySelector('.nav-track');
  const activeItem = document.querySelector('.nav-item.active:not(.nav-center-btn)');
  if (track && activeItem) {
    const slider = document.createElement('div');
    slider.className = 'nav-slider';
    track.insertBefore(slider, track.firstChild);
    // 先不加动画，直接定位
    slider.style.transition = 'none';
    setTimeout(() => {
      const navRect = track.getBoundingClientRect();
      const btnRect = activeItem.getBoundingClientRect();
      slider.style.left  = (btnRect.left - navRect.left + 4) + 'px';
      slider.style.width = (btnRect.width - 8) + 'px';
      // 定位完再开启动画
      setTimeout(() => { slider.style.transition = ''; }, 50);
    }, 100);
  }
});

/* ══════════════════════════════
   个人中心 — 标签切换
══════════════════════════════ */
function switchPfTab(btn, panel) {
  document.querySelectorAll('.pf-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.pf-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  const target = document.getElementById('panel-' + panel);
  if (target) target.classList.add('active');
}

/* ══════════════════════════════
   个人中心 — 编辑弹窗
══════════════════════════════ */
function openEditModal() {
  // 把现有数据填入表单
  document.getElementById('editName').value     = document.getElementById('pfName').textContent || '';
  document.getElementById('editHandle').value   = (document.getElementById('pfHandle').textContent || '').replace('@', '');
  document.getElementById('editBio').value      = document.getElementById('pfBio').textContent || '';
  document.getElementById('editFollowers').value = document.getElementById('pfFollowers').textContent || '0';
  document.getElementById('editFollowing').value = document.getElementById('pfFollowing').textContent || '0';

  document.getElementById('pfModalMask').classList.add('open');
  document.getElementById('pfModal').classList.add('open');
}

function closeEditModal() {
  document.getElementById('pfModalMask').classList.remove('open');
  document.getElementById('pfModal').classList.remove('open');
}

function saveProfile() {
  const name      = document.getElementById('editName').value.trim();
  const handle    = document.getElementById('editHandle').value.trim();
  const bio       = document.getElementById('editBio').value.trim();
  const followers = document.getElementById('editFollowers').value || '0';
  const following = document.getElementById('editFollowing').value || '0';

  if (name)    document.getElementById('pfName').textContent     = name;
  if (handle)  document.getElementById('pfHandle').textContent   = '@' + handle;
  if (bio)     document.getElementById('pfBio').textContent      = bio;
  document.getElementById('pfFollowers').textContent = followers;
  document.getElementById('pfFollowing').textContent = following;

  closeEditModal();
}

function previewBanner(input) {
  if (!input.files || !input.files[0]) return;
  const url = URL.createObjectURL(input.files[0]);
  // 同步到页面Banner和弹窗Banner
  document.getElementById('pfBanner').style.backgroundImage      = `url(${url})`;
  document.getElementById('pfBanner').style.backgroundSize       = 'cover';
  document.getElementById('pfBanner').style.backgroundPosition   = 'center';
  document.getElementById('modalBanner').style.backgroundImage   = `url(${url})`;
  document.getElementById('modalBanner').style.backgroundSize    = 'cover';
  document.getElementById('modalBanner').style.backgroundPosition = 'center';
}

function previewAvatar(input) {
  if (!input.files || !input.files[0]) return;
  const url = URL.createObjectURL(input.files[0]);
  // 同步到页面头像和弹窗头像
  document.getElementById('pfAvatar').style.backgroundImage    = `url(${url})`;
  document.getElementById('pfAvatar').style.backgroundSize     = 'cover';
  document.getElementById('pfAvatar').style.backgroundPosition = 'center';
  document.getElementById('modalAvatar').style.backgroundImage    = `url(${url})`;
  document.getElementById('modalAvatar').style.backgroundSize     = 'cover';
  document.getElementById('modalAvatar').style.backgroundPosition = 'center';
}

/* ══════════════════════════════
   人设弹窗 — IndexedDB
══════════════════════════════ */
let _personaDB = null;

function openPersonaDB() {
  return new Promise((res, rej) => {
    if (_personaDB) return res(_personaDB);
    const req = indexedDB.open('LunaPersonaDB', 2);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('identities')) {
        db.createObjectStore('identities', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('worldview')) {
        db.createObjectStore('worldview', { keyPath: 'key' });
      }
    };
    req.onsuccess = e => { _personaDB = e.target.result; res(_personaDB); };
    req.onerror = () => rej();
  });
}

async function dbGetAll(storeName) {
  const db = await openPersonaDB();
  return new Promise(res => {
    const r = db.transaction(storeName).objectStore(storeName).getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror = () => res([]);
  });
}

async function dbPut(storeName, data) {
  const db = await openPersonaDB();
  return new Promise(res => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(data);
    req.onsuccess = () => res(req.result);
    req.onerror = () => res(null);
  });
}

async function dbDelete(storeName, id) {
  const db = await openPersonaDB();
  return new Promise(res => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = res;
  });
}

/* ══════════════════════════════
   人设弹窗 — 打开 / 关闭
══════════════════════════════ */
function openPersonaModal() {
  document.getElementById('personaMask').classList.add('open');
  document.getElementById('personaModal').classList.add('open');
  loadPersonaCharList();
  loadIdentityList();
  loadWorldview();
}

function closePersonaModal() {
  document.getElementById('personaMask').classList.remove('open');
  document.getElementById('personaModal').classList.remove('open');
}

/* ══════════════════════════════
   Tab 切换
══════════════════════════════ */
function switchPersonaTab(btn, panel) {
  document.querySelectorAll('.persona-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.persona-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('ptab-' + panel).classList.add('active');
}

/* ══════════════════════════════
   Tab 1：读取角色书角色
══════════════════════════════ */
let _selectedCharId = parseInt(localStorage.getItem('luna_active_char')) || null;

async function loadPersonaCharList() {
  const listEl = document.getElementById('personaCharList');
  listEl.innerHTML = '<div class="persona-loading">读取角色书中...</div>';

  let chars = [];
  try {
    chars = await new Promise((res, rej) => {
      const req = indexedDB.open('LunaCharDB', 2);
      req.onsuccess = e => {
        const db = e.target.result;
        const r = db.transaction('chars').objectStore('chars').getAll();
        r.onsuccess = () => res(r.result || []);
        r.onerror = () => res([]);
      };
      req.onerror = () => res([]);
    });
  } catch(e) { chars = []; }

  if (chars.length === 0) {
    listEl.innerHTML = '<div class="persona-char-empty">角色书中还没有角色<br>请先去角色书创建角色</div>';
    return;
  }

  const COLOR_BG = {
    warm:'#a8956e', cool:'#607d85', gold:'#927d50',
    ash:'#707070', mist:'#7a8e72', blush:'#9e7870'
  };

  listEl.innerHTML = '';
  chars.forEach(c => {
    const isSelected = c.id === _selectedCharId;
    const bgColor = COLOR_BG[c.color] || '#a8956e';
    const letter = (c.name || '?')[0].toUpperCase();

    const item = document.createElement('div');
    item.className = 'persona-char-item' + (isSelected ? ' selected' : '');
    item.dataset.id = c.id;
    item.innerHTML = `
      <div class="persona-char-avatar" style="background:${bgColor}">
        ${c.avatar ? `<img src="${c.avatar}" alt=""/>` : letter}
      </div>
      <div class="persona-char-info">
        <div class="persona-char-name">${c.name || '未命名'}</div>
        <div class="persona-char-role">${c.role || '无定位'}</div>
      </div>
      <div class="persona-char-check">
        ${isSelected ? `<svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ''}
      </div>`;
    item.onclick = () => selectPersonaChar(item, c);
    listEl.appendChild(item);
  });
}

function selectPersonaChar(itemEl, c) {
  _selectedCharId = c.id;
  localStorage.setItem('luna_active_char', c.id);
  localStorage.setItem('luna_char_name', c.name || '');
  localStorage.setItem('luna_char_prompt', c.prompt || '');

  document.querySelectorAll('.persona-char-item').forEach(el => {
    const isMe = parseInt(el.dataset.id) === c.id;
    el.classList.toggle('selected', isMe);
    el.querySelector('.persona-char-check').innerHTML = isMe
      ? `<svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      : '';
  });
}

/* ══════════════════════════════
   Tab 2：用户身份
══════════════════════════════ */
let _identities = [];
let _editingIdentityId = null;
let _idtGender = '不限';

async function loadIdentityList() {
  _identities = await dbGetAll('identities');
  renderIdentityList();

  // 默认加载第一个身份到表单
  const active = _identities.find(x => x.id === parseInt(localStorage.getItem('luna_active_identity')));
  if (active) fillIdentityForm(active);
  else if (_identities.length > 0) fillIdentityForm(_identities[0]);
}

function renderIdentityList() {
  const listEl = document.getElementById('personaIdentityList');
  if (_identities.length === 0) { listEl.innerHTML = ''; return; }
  const activeId = parseInt(localStorage.getItem('luna_active_identity'));
  listEl.innerHTML = '';
  _identities.forEach(idt => {
    const isSelected = idt.id === activeId;
    const div = document.createElement('div');
    div.className = 'persona-identity-item' + (isSelected ? ' selected' : '');
    div.dataset.id = idt.id;
    div.innerHTML = `
      <div onclick="fillIdentityForm(window._identities.find(x=>x.id===${idt.id}))">
        <div class="persona-identity-name">${idt.name || '未命名身份'}</div>
        <div class="persona-identity-meta">${idt.gender || ''} ${idt.age ? '· ' + idt.age : ''} ${idt.tags ? '· ' + idt.tags.slice(0,16) : ''}</div>
      </div>
      <button class="persona-identity-del" onclick="deleteIdentity(${idt.id})">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none">
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </button>`;
    div.querySelector('div').onclick = () => fillIdentityForm(idt);
    listEl.appendChild(div);
  });
}

function fillIdentityForm(idt) {
  if (!idt) return;
  _editingIdentityId = idt.id;
  _idtGender = idt.gender || '不限';
  document.getElementById('idtName').value = idt.name || '';
  document.getElementById('idtAge').value = idt.age || '';
  document.getElementById('idtTags').value = idt.tags || '';
  document.getElementById('idtPersonality').value = idt.personality || '';
  document.getElementById('idtExtra').value = idt.extra || '';
  document.querySelectorAll('.persona-gender-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.g === _idtGender);
  });
  localStorage.setItem('luna_active_identity', idt.id);
  renderIdentityList();
}

function selectIdtGender(btn) {
  _idtGender = btn.dataset.g;
  document.querySelectorAll('.persona-gender-btn').forEach(b => b.classList.toggle('active', b === btn));
}

function newIdentity() {
  _editingIdentityId = null;
  _idtGender = '不限';
  document.getElementById('idtName').value = '';
  document.getElementById('idtAge').value = '';
  document.getElementById('idtTags').value = '';
  document.getElementById('idtPersonality').value = '';
  document.getElementById('idtExtra').value = '';
  document.querySelectorAll('.persona-gender-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
}

async function saveIdentity() {
  const name = document.getElementById('idtName').value.trim();
  if (!name) { document.getElementById('idtName').focus(); return; }

  const data = {
    name,
    gender: _idtGender,
    age: document.getElementById('idtAge').value.trim(),
    tags: document.getElementById('idtTags').value.trim(),
    personality: document.getElementById('idtPersonality').value.trim(),
    extra: document.getElementById('idtExtra').value.trim(),
  };
  if (_editingIdentityId) data.id = _editingIdentityId;

  const newId = await dbPut('identities', data);
  if (!_editingIdentityId) data.id = newId;
  _editingIdentityId = data.id;
  localStorage.setItem('luna_active_identity', data.id);

  _identities = await dbGetAll('identities');
  renderIdentityList();
}

async function deleteIdentity(id) {
  await dbDelete('identities', id);
  if (parseInt(localStorage.getItem('luna_active_identity')) === id) {
    localStorage.removeItem('luna_active_identity');
    _editingIdentityId = null;
  }
  _identities = await dbGetAll('identities');
  renderIdentityList();
  if (_identities.length > 0) fillIdentityForm(_identities[0]);
  else newIdentity();
}

/* ══════════════════════════════
   Tab 3：世界观
══════════════════════════════ */
let _worldTone = '轻松';

async function loadWorldview() {
  const db = await openPersonaDB();
  const data = await new Promise(res => {
    const r = db.transaction('worldview').objectStore('worldview').get('main');
    r.onsuccess = () => res(r.result || {});
    r.onerror = () => res({});
  });
  document.getElementById('worldName').value = data.name || '';
  document.getElementById('worldDesc').value = data.desc || '';
  document.getElementById('worldTaboo').value = data.taboo || '';
  _worldTone = data.tone || '轻松';
  document.querySelectorAll('.persona-tone-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.t === _worldTone);
  });
}

function selectTone(btn) {
  _worldTone = btn.dataset.t;
  document.querySelectorAll('.persona-tone-btn').forEach(b => b.classList.toggle('active', b === btn));
}

async function saveWorldview() {
  await dbPut('worldview', {
    key: 'main',
    name: document.getElementById('worldName').value.trim(),
    desc: document.getElementById('worldDesc').value.trim(),
    taboo: document.getElementById('worldTaboo').value.trim(),
    tone: _worldTone,
  });
  const tip = document.getElementById('worldSaveTip');
  tip.style.display = 'block';
  setTimeout(() => { tip.style.display = 'none'; }, 1800);
}

/* ══════════════════════════════
   热搜页 — 读取世界观设定
══════════════════════════════ */
async function getWorldviewContext() {
  try {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open('LunaPersonaDB', 2);
      req.onsuccess = e => res(e.target.result);
      req.onerror = () => rej();
    });
    const data = await new Promise(res => {
      const r = db.transaction('worldview').objectStore('worldview').get('main');
      r.onsuccess = () => res(r.result || {});
      r.onerror = () => res({});
    });
    return data;
  } catch(e) { return {}; }
}

/* ══════════════════════════════
   热搜数据存储（内存）
══════════════════════════════ */
let _trendingData = null; // { top50: [], rising: [] }
let _trendTime = '';

function saveTrendingToStorage(data, time) {
  try {
    localStorage.setItem('luna_trending_data', JSON.stringify(data));
    localStorage.setItem('luna_trending_time', time);
  } catch(e) {}
}

function loadTrendingFromStorage() {
  try {
    const raw = localStorage.getItem('luna_trending_data');
    const time = localStorage.getItem('luna_trending_time') || '';
    if (raw) return { data: JSON.parse(raw), time };
  } catch(e) {}
  return null;
}

function savePostsToStorage(posts) {
  try {
    localStorage.setItem('luna_trending_posts', JSON.stringify(posts));
  } catch(e) {}
}

function loadPostsFromStorage() {
  try {
    const raw = localStorage.getItem('luna_trending_posts');
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return null;
}

/* ══════════════════════════════
   生成热搜榜（50条 + 5条上升榜）
══════════════════════════════ */
async function generateTrending() {
  const btn = document.getElementById('trendGenBtn');
  btn.classList.add('loading');
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> 生成中...`;

  const world = await getWorldviewContext();
  const worldDesc = world.name
    ? `世界观：${world.name}。${world.desc || ''}。论坛基调：${world.tone || '轻松'}。禁忌话题：${world.taboo || '无'}。`
    : '这是一个活跃的现代中文互联网社区论坛，用户年轻化，内容有网感有生活气息。';

  const prompt = `你是一个中文社交平台的热搜榜生成器。
${worldDesc}
请根据以上世界观设定，生成一份热搜榜单，要求：
1. 话题要有真实感，像真实用户讨论的热点，有网感、有共鸣感
2. 话题标题简短有力，10字以内
3. top50里前3个标注 hot，第4-10个可随机标注 new 或不标注
4. 上升榜5条单独生成，标注上升百分比

只返回JSON，格式如下，禁止输出其他任何文字：
{
  "top50": [
    {"rank":1,"title":"话题标题","heat":"892万","tag":"hot"},
    {"rank":2,"title":"话题标题","heat":"741万","tag":"hot"},
    ...共50条，tag只能是hot/new/rise/空字符串
  ],
  "rising": [
    {"title":"话题标题","pct":"+234%"},
    ...共5条
  ]
}`;

  try {
    const { baseUrl, apiKey, model } = getApiConfig();
    if (!baseUrl || !apiKey || !model) throw new Error('请先在设置中配置并激活 API 预设');
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await res.json();
    const text = (data.choices?.[0]?.message?.content || '').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);

    _trendingData = parsed;
    _trendTime = new Date().toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' }) + ' 更新';

    saveTrendingToStorage(parsed, _trendTime);

    renderTrendList(parsed.top50.slice(0, 5));
    document.getElementById('trendFullBtn').style.display = '';

  } catch(e) {
    document.getElementById('trendList').innerHTML = '<div class="tr-empty"><div class="tr-empty-text">生成失败，请重试</div></div>';
  }

  btn.classList.remove('loading');
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> 重新生成`;
}

/* ══════════════════════════════
   渲染热搜列表（前5）
══════════════════════════════ */
function renderTrendList(items) {
  const el = document.getElementById('trendList');
  el.innerHTML = '';
  items.forEach((item, i) => {
    const rankClass = i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : '';
    const tagHtml = item.tag === 'hot'
      ? '<span class="tr-item-tag tag-hot">热</span>'
      : item.tag === 'new'
      ? '<span class="tr-item-tag tag-new">新</span>'
      : item.tag === 'rise'
      ? '<span class="tr-item-tag tag-rise">升</span>'
      : '';
    const div = document.createElement('div');
    div.className = 'tr-item';
    div.innerHTML = `
      <div class="tr-rank-num ${rankClass}">${item.rank}</div>
      <div class="tr-item-content">
        <div class="tr-item-title">${item.title}</div>
        ${tagHtml}
      </div>
      <div class="tr-item-heat">${item.heat}</div>`;
    el.appendChild(div);
  });
}

/* ══════════════════════════════
   完整榜单弹窗
══════════════════════════════ */
function openFullRank() {
  if (!_trendingData) return;
  document.getElementById('trRankTime').textContent = _trendTime;

  const fullList = document.getElementById('trFullList');
  fullList.innerHTML = '';
  _trendingData.top50.forEach((item, i) => {
    const rankClass = i < 3 ? 'r1' : '';
    const tagHtml = item.tag === 'hot'
      ? '<span class="tr-item-tag tag-hot" style="font-size:9px;padding:1px 5px">热</span>'
      : item.tag === 'new'
      ? '<span class="tr-item-tag tag-new" style="font-size:9px;padding:1px 5px">新</span>'
      : '';
    const div = document.createElement('div');
    div.className = 'tr-rank-item';
    div.innerHTML = `
      <div class="tr-rank-n ${rankClass}">${item.rank}</div>
      <div class="tr-rank-text">${item.title} ${tagHtml}</div>
      <div class="tr-rank-heat">${item.heat}</div>`;
    fullList.appendChild(div);
  });

  const risingList = document.getElementById('trRisingList');
  risingList.innerHTML = '';
  (_trendingData.rising || []).forEach(item => {
    const div = document.createElement('div');
    div.className = 'tr-rising-item';
    div.innerHTML = `
      <div class="tr-rising-arrow">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none">
          <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="tr-rising-text">${item.title}</div>
      <div class="tr-rising-pct">${item.pct}</div>`;
    risingList.appendChild(div);
  });

  document.getElementById('trRankMask').classList.add('open');
  document.getElementById('trRankModal').classList.add('open');
}

function closeFullRank() {
  document.getElementById('trRankMask').classList.remove('open');
  document.getElementById('trRankModal').classList.remove('open');
}

/* ══════════════════════════════
   生成热门帖子
══════════════════════════════ */
async function generatePosts() {
  const btn = document.getElementById('postGenBtn');
  btn.classList.add('loading');
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.6"/><path d="M7 8h10M7 12h7M7 16h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg> 生成中...`;

  const world = await getWorldviewContext();
  const worldDesc = world.name
    ? `世界观：${world.name}。${world.desc || ''}。论坛基调：${world.tone || '轻松'}。`
    : '这是一个活跃的现代中文互联网社区论坛，用户年轻化，内容有网感。';

  const topTitles = _trendingData
    ? _trendingData.top50.slice(0, 10).map(t => t.title).join('、')
    : '各种日常热点';

  const prompt = `你是一个中文社区论坛的内容生成器。
${worldDesc}
当前热搜话题参考：${topTitles}

请生成8篇风格各异的热门帖子，要求：
1. 类型多样：可以是吐槽、分享、提问、讨论、故事、点评、种草、爆料等
2. 标题有吸引力，正文摘要有网感，像真实用户写的
3. 作者名用符合世界观的名字
4. 互动数据要有参差感

只返回JSON，禁止输出其他文字：
{
  "posts": [
    {
      "type": "吐槽",
      "author": "用户名",
      "authorInitial": "用",
      "time": "3分钟前",
      "title": "帖子标题",
      "excerpt": "正文前两句，有网感，不超过60字",
      "likes": "1.2k",
      "comments": "89",
      "shares": "34"
    }
  ]
}`;

  try {
    const { baseUrl, apiKey, model } = getApiConfig();
    if (!baseUrl || !apiKey || !model) throw new Error('请先在设置中配置并激活 API 预设');
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await res.json();
    const text = (data.choices?.[0]?.message?.content || '').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);
    renderPostList(parsed.posts);
    savePostsToStorage(parsed.posts);
  } catch(e) {
    document.getElementById('trendPostList').innerHTML = '<div class="tr-empty"><div class="tr-empty-text">生成失败，请重试</div></div>';
  }

  btn.classList.remove('loading');
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.6"/><path d="M7 8h10M7 12h7M7 16h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg> 重新生成`;
}

function getApiConfig() {
  const cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  return { baseUrl: (cur.baseUrl || '').replace(/\/$/, ''), apiKey: cur.apiKey || '', model };
}

/* ══════════════════════════════
   渲染帖子列表
══════════════════════════════ */
function renderPostList(posts) {
  const el = document.getElementById('trendPostList');
  el.innerHTML = '';
  posts.forEach(p => {
    const div = document.createElement('div');
    div.className = 'tr-post-item';
    div.innerHTML = `
      <div class="tr-post-head">
        <div class="tr-post-author-row">
          <div class="tr-post-avatar">${p.authorInitial || (p.author||'?')[0]}</div>
          <div class="tr-post-author">${p.author}</div>
          <div class="tr-post-time">${p.time}</div>
        </div>
        <div class="tr-post-type-badge">${p.type}</div>
      </div>
      <div class="tr-post-title">${p.title}</div>
      <div class="tr-post-excerpt">${p.excerpt}</div>
      <div class="tr-post-footer">
        <div class="tr-post-stat">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" stroke-width="1.5"/></svg>
          ${p.likes}
        </div>
        <div class="tr-post-stat">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.5"/></svg>
          ${p.comments}
        </div>
        <div class="tr-post-stat">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          ${p.shares}
        </div>
      </div>`;
    div.addEventListener('click', () => openPostDetail(p));
    el.appendChild(div);
  });
}

/* ══════════════════════════════
   帖子详情 — 打开 / 关闭
══════════════════════════════ */
let _currentPost = null; // 当前打开的帖子数据

function openPostDetail(post) {
  _currentPost = post;

  // 填入发帖人信息
  const initial = post.authorInitial || (post.author || '?')[0];
  const avatarEl = document.getElementById('pdAuthorAvatar');
  avatarEl.textContent = initial;

  document.getElementById('pdAuthorName').textContent = post.author || '未知用户';
  document.getElementById('pdAuthorTime').textContent = post.time || '';
  document.getElementById('pdAuthorType').textContent = post.type || '';

  // 填入帖子内容（正文用 excerpt 展开，AI 后续可扩充）
  document.getElementById('pdPostTitle').textContent = post.title || '';
  document.getElementById('pdPostBody').textContent = post.excerpt || '';

  // 填入数据
  document.getElementById('pdLikes').textContent = post.likes || '0';
  document.getElementById('pdComments').textContent = post.comments || '0';
  document.getElementById('pdShares').textContent = post.shares || '0';

  // 清空评论区和转发区（每次打开重置）
  document.getElementById('pdCommentList').innerHTML = '<div class="pd-empty-hint">点击「刷新评论」生成</div>';
  document.getElementById('pdRepostList').innerHTML = '<div class="pd-empty-hint">点击「刷新转发」生成</div>';

  // 同步状态栏时间
  const mainTime = document.getElementById('statusTime');
  const pdTime   = document.getElementById('pdStatusTime');
  if (mainTime && pdTime) pdTime.textContent = mainTime.textContent;

  // 同步电量
  const mainPct   = document.getElementById('batPct');
  const mainInner = document.getElementById('batInner');
  const pdPct     = document.getElementById('pdBatPct');
  const pdInner   = document.getElementById('pdBatInner');
  if (mainPct && pdPct) pdPct.textContent = mainPct.textContent;
  if (mainInner && pdInner) {
    pdInner.style.width      = mainInner.style.width;
    pdInner.style.background = mainInner.style.background;
  }

  // 同步灵动岛
  const mainIsland = document.getElementById('statusIsland');
  const pdIsland   = document.getElementById('pdStatusIsland');
  if (mainIsland && pdIsland) pdIsland.innerHTML = mainIsland.innerHTML;

  // 打开覆盖层
  document.getElementById('pdOverlay').classList.add('open');
}

function closePostDetail() {
  document.getElementById('pdOverlay').classList.remove('open');
}

/* ══════════════════════════════
   AI 生成评论
══════════════════════════════ */
async function generateComments() {
  if (!_currentPost) return;
  const btn = document.getElementById('pdCommentRefreshBtn');
  btn.classList.add('loading');
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> 生成中...`;

  const world = await getWorldviewContext();
  const worldDesc = world.name
    ? `世界观：${world.name}。${world.desc || ''}。论坛基调：${world.tone || '轻松'}。`
    : '这是一个活跃的现代中文互联网社区。';

  const prompt = `你是一个中文社区评论生成器。
${worldDesc}
帖子标题：「${_currentPost.title}」
帖子摘要：${_currentPost.excerpt}

请生成8条真实感强的评论，风格要多样（有赞同、有补充、有调侃、有共鸣、有质疑），像真实用户写的，有网感。

只返回JSON，禁止输出其他文字：
{
  "comments": [
    {
      "author": "用户名",
      "authorInitial": "用",
      "time": "5分钟前",
      "text": "评论内容",
      "likes": "23"
    }
  ]
}`;

  try {
    const { baseUrl, apiKey, model } = getApiConfig();
    if (!baseUrl || !apiKey || !model) throw new Error('未配置API');
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 2000, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await res.json();
    const text = (data.choices?.[0]?.message?.content || '').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);
    renderComments(parsed.comments);
  } catch(e) {
    document.getElementById('pdCommentList').innerHTML = '<div class="pd-empty-hint">生成失败，请重试</div>';
  }

  btn.classList.remove('loading');
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> 刷新评论`;
}

function renderComments(comments) {
  const el = document.getElementById('pdCommentList');
  el.innerHTML = '';
  (comments || []).forEach(c => {
    const div = document.createElement('div');
    div.className = 'pd-comment-item';
    div.innerHTML = `
      <div class="pd-comment-head">
        <div class="pd-comment-avatar">${c.authorInitial || (c.author||'?')[0]}</div>
        <div class="pd-comment-author">${c.author}</div>
        <div class="pd-comment-time">${c.time}</div>
      </div>
      <div class="pd-comment-text">${c.text}</div>
      <div class="pd-comment-likes">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" stroke-width="1.5"/></svg>
        ${c.likes}
      </div>`;
    el.appendChild(div);
  });
}

/* ══════════════════════════════
   AI 生成转发
══════════════════════════════ */
async function generateReposts() {
  if (!_currentPost) return;
  const btn = document.getElementById('pdRepostRefreshBtn');
  btn.classList.add('loading');
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> 生成中...`;

  const world = await getWorldviewContext();
  const worldDesc = world.name
    ? `世界观：${world.name}。${world.desc || ''}。论坛基调：${world.tone || '轻松'}。`
    : '这是一个活跃的现代中文互联网社区。';

  const prompt = `你是一个中文社区转发内容生成器。
${worldDesc}
原帖标题：「${_currentPost.title}」
原帖摘要：${_currentPost.excerpt}

请生成5条转发记录，转发时用户会加上自己的一句话评语（repostText），风格多样，像真实用户转发时说的话（有推荐、有感叹、有点评、有调侃）。

只返回JSON，禁止输出其他文字：
{
  "reposts": [
    {
      "author": "用户名",
      "authorInitial": "用",
      "time": "10分钟前",
      "repostText": "转发时说的一句话"
    }
  ]
}`;

  try {
    const { baseUrl, apiKey, model } = getApiConfig();
    if (!baseUrl || !apiKey || !model) throw new Error('未配置API');
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 1500, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await res.json();
    const text = (data.choices?.[0]?.message?.content || '').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);
    renderReposts(parsed.reposts);
  } catch(e) {
    document.getElementById('pdRepostList').innerHTML = '<div class="pd-empty-hint">生成失败，请重试</div>';
  }

  btn.classList.remove('loading');
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> 刷新转发`;
}

function renderReposts(reposts) {
  const el = document.getElementById('pdRepostList');
  el.innerHTML = '';
  (reposts || []).forEach(r => {
    const div = document.createElement('div');
    div.className = 'pd-repost-item';
    div.innerHTML = `
      <div class="pd-repost-head">
        <div class="pd-repost-avatar">${r.authorInitial || (r.author||'?')[0]}</div>
        <div class="pd-repost-author">${r.author}</div>
        <div class="pd-repost-time">${r.time}</div>
      </div>
      <div class="pd-repost-quote">↩ 转发了这篇帖子</div>
      <div class="pd-repost-text">${r.repostText}</div>`;
    el.appendChild(div);
  });
}