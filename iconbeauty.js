/* ================================
   Icon Beauty — iconbeauty.js
   图标自定义 · IndexedDB 持久化
================================ */

/* ================================
   App 定义表 — 对应 index.html 所有 app
================================ */
const IB_APPS = [
  {
    id: 'wallpaper',
    name: '壁纸',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="rgba(167,139,250,0.18)" stroke="rgba(167,139,250,0.7)" stroke-width="1.4"/>
      <circle cx="8.5" cy="8.5" r="2" fill="rgba(251,191,36,0.85)"/>
      <path d="M3 15l5-4 4 4 3-3 6 5" stroke="rgba(99,102,241,0.75)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  },
  {
    id: 'settings',
    name: '设置',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <circle cx="12" cy="12" r="3" stroke="rgba(100,116,139,0.8)" stroke-width="1.5"/>
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="rgba(100,116,139,0.75)" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'chat',
    name: '聊天',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="rgba(99,102,241,0.12)" stroke="rgba(99,102,241,0.7)" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M8 10h8M8 13h5" stroke="rgba(99,102,241,0.7)" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'music2',
    name: '音乐',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <path d="M9 18V6l10-2v12" stroke="rgba(251,146,60,0.8)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="7" cy="18" r="2.5" fill="rgba(251,146,60,0.7)"/>
      <circle cx="17" cy="16" r="2.5" fill="rgba(251,146,60,0.7)"/>
    </svg>`
  },
  {
    id: 'characters',
    name: '角色',
    defaultSvg: `<svg viewBox="0 0 24 24" fill="none" width="27" height="27">
      <rect x="4" y="2" width="16" height="20" rx="2" stroke="#1a1a2e" stroke-width="1.8"/>
      <rect x="4" y="2" width="16" height="7" rx="2" fill="#1a1a2e"/>
      <rect x="4" y="6" width="16" height="3" fill="#1a1a2e"/>
      <circle cx="12" cy="13" r="3" stroke="#1a1a2e" stroke-width="1.6"/>
      <path d="M7 20.5 Q12 17 17 20.5" stroke="#1a1a2e" stroke-width="1.6" stroke-linecap="round" fill="none"/>
    </svg>`
  },
  {
    id: 'worldbook',
    name: '世界书',
    defaultSvg: `<svg viewBox="0 0 24 24" fill="none" width="27" height="27">
      <path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z" stroke="#1c1916" stroke-width="1.6"/>
      <path d="M7 10h10M7 14h6" stroke="#1c1916" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="17" cy="14" r="2" stroke="#1c1916" stroke-width="1.4"/>
      <path d="M6 6V4M18 6V4" stroke="#1c1916" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'memory',
    name: '记忆',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
        <path d="M12 2a7 7 0 0 1 7 7c0 2.5-1.3 4.7-3.3 6l-.7.4V18a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-2.6l-.7-.4A7 7 0 0 1 12 2z" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M9 18h6" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M10 21h4" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`
    },
  {
    id: 'iconbeauty',
    name: '图标美化',
    defaultSvg: `<svg viewBox="0 0 24 24" fill="none" width="27" height="27">
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="#000" stroke-width="1.5"/>
      <circle cx="8" cy="12" r="1" fill="#000"/>
      <circle cx="12" cy="12" r="1" fill="#000"/>
      <circle cx="16" cy="12" r="1" fill="#000"/>
    </svg>`
  }
];

/* ================================
   IndexedDB
================================ */
let _ibDb = null;

function openIbDB() {
  return new Promise((res, rej) => {
    if (_ibDb) return res(_ibDb);
    const req = indexedDB.open('LunaIconBeautyDB', 2);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('icons', { keyPath: 'appId' });
    };
    req.onsuccess = e => { _ibDb = e.target.result; res(_ibDb); };
    req.onerror = () => rej('IB DB Error');
  });
}

async function ibSaveIconDB(appId, imageData) {
  const db = await openIbDB();
  return new Promise(res => {
    const tx = db.transaction('icons', 'readwrite');
    tx.objectStore('icons').put({ appId, imageData });
    tx.oncomplete = () => res(true);
    tx.onerror = () => res(false);
  });
}

async function ibDeleteIconDB(appId) {
  const db = await openIbDB();
  return new Promise(res => {
    const tx = db.transaction('icons', 'readwrite');
    tx.objectStore('icons').delete(appId);
    tx.oncomplete = () => res(true);
    tx.onerror = () => res(false);
  });
}

async function ibGetAllIcons() {
  const db = await openIbDB();
  return new Promise(res => {
    const req = db.transaction('icons').objectStore('icons').getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => res([]);
  });
}

/* ================================
   状态
================================ */
let _selectedAppId = null;
let _pendingImageData = null;
let _customIcons = {};  // appId -> imageData

/* ================================
   初始化
================================ */
document.addEventListener('DOMContentLoaded', async () => {
  updateIbTime();
  setInterval(updateIbTime, 1000);
  updateIbBattery();
  applyIsland();
  applyGlobalFont();

  // 加载已保存的图标
  const saved = await ibGetAllIcons();
  saved.forEach(row => { _customIcons[row.appId] = row.imageData; });

  renderAppGrid();

  // 拖拽上传
  const zone = document.getElementById('ibUploadZone');
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) readFileAsDataUrl(file);
  });
});

/* ================================
   渲染 App 网格
================================ */
function renderAppGrid() {
  const grid = document.getElementById('ibAppGrid');
  grid.innerHTML = '';

  IB_APPS.forEach(app => {
    const div = document.createElement('div');
    div.className = 'ib-app-item' + (_customIcons[app.id] ? ' has-custom' : '');
    div.dataset.appId = app.id;
    div.onclick = () => selectApp(app.id);

    const face = document.createElement('div');
    face.className = 'ib-app-face';

    if (_customIcons[app.id]) {
      const img = document.createElement('img');
      img.src = _customIcons[app.id];
      img.alt = app.name;
      face.appendChild(img);
    } else {
      face.innerHTML = app.defaultSvg;
    }

    const label = document.createElement('div');
    label.className = 'ib-app-name';
    label.textContent = app.name;

    div.appendChild(face);
    div.appendChild(label);
    grid.appendChild(div);
  });
}

/* ================================
   选择 App
================================ */
function selectApp(appId) {
  _selectedAppId = appId;
  _pendingImageData = null;

  // 更新选中态
  document.querySelectorAll('.ib-app-item').forEach(el => {
    el.classList.toggle('active', el.dataset.appId === appId);
  });

  const app = IB_APPS.find(a => a.id === appId);
  if (!app) return;

  // 显示预览
  const previewZone = document.getElementById('ibPreviewZone');
  const editPanel = document.getElementById('ibEditPanel');
  previewZone.style.display = 'block';
  editPanel.style.display = 'block';

  // 更新原始图标预览
  const prevIcon = document.getElementById('ibPreviewIcon');
  if (_customIcons[appId]) {
    prevIcon.innerHTML = `<img src="${_customIcons[appId]}" alt="${app.name}"/>`;
  } else {
    prevIcon.innerHTML = app.defaultSvg;
  }

  // 重置新图标预览
  const prevNew = document.getElementById('ibPreviewNew');
  prevNew.innerHTML = `<div class="ib-preview-placeholder">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.2" stroke-dasharray="3 3"/>
      <path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  </div>`;

  document.getElementById('ibPreviewLabel').textContent = app.name;

  // 重置按钮状态
  document.getElementById('ibBtnSave').disabled = true;

  // 清空输入
  document.getElementById('ibUrlInput').value = '';
  document.getElementById('ibFileInput').value = '';
}

/* ================================
   Tab 切换
================================ */
function ibSwitchTab(btn) {
  const tab = btn.dataset.tab;
  document.querySelectorAll('.ib-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.ib-tab-panel').forEach(p => p.style.display = 'none');
  const panel = document.getElementById('ib-tab-' + tab);
  if (panel) panel.style.display = 'block';
}

/* ================================
   文件上传处理
================================ */
function ibHandleFile(input) {
  const file = input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    ibShowToastError('请选择图片文件');
    return;
  }
  readFileAsDataUrl(file);
}

function readFileAsDataUrl(file) {
  const reader = new FileReader();
  reader.onload = e => {
    setPreviewImage(e.target.result);
  };
  reader.onerror = () => ibShowToastError('文件读取失败');
  reader.readAsDataURL(file);
}

/* ================================
   URL 加载
================================ */
async function ibLoadUrl() {
  const url = document.getElementById('ibUrlInput').value.trim();
  if (!url) { ibShowToastError('请输入图片链接'); return; }

  // 用 Image 验证图片能否加载
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    // 转为 base64 以便存储
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    try {
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      setPreviewImage(dataUrl);
    } catch(e) {
      // 跨域图片无法转 base64，直接用 url
      setPreviewImage(url);
    }
  };
  img.onerror = () => ibShowToastError('图片加载失败，请检查链接或跨域权限');
  img.src = url;
}

/* ================================
   设置预览图
================================ */
function setPreviewImage(src) {
  if (!_selectedAppId) return;
  _pendingImageData = src;

  const prevNew = document.getElementById('ibPreviewNew');
  prevNew.innerHTML = `<img src="${src}" alt="预览" style="width:100%;height:100%;object-fit:cover;border-radius:16px;"/>`;

  document.getElementById('ibBtnSave').disabled = false;
}

/* ================================
   保存图标
================================ */
async function ibSaveIcon() {
  if (!_selectedAppId || !_pendingImageData) return;

  const ok = await ibSaveIconDB(_selectedAppId, _pendingImageData);
  if (!ok) { ibShowToastError('保存失败，请重试'); return; }

  _customIcons[_selectedAppId] = _pendingImageData;

  // 更新网格显示
  renderAppGrid();
  // 重新激活选中
  document.querySelectorAll('.ib-app-item').forEach(el => {
    el.classList.toggle('active', el.dataset.appId === _selectedAppId);
  });

  // 更新左侧预览为新图标
  const prevIcon = document.getElementById('ibPreviewIcon');
  prevIcon.innerHTML = `<img src="${_pendingImageData}" alt=""/>`;

  _pendingImageData = null;
  document.getElementById('ibBtnSave').disabled = true;

  ibShowToast('ibToastSaved');

  // 通知 localStorage 让 index.html 监听同步
  localStorage.setItem('luna_icon_update', Date.now().toString());
}

/* ================================
   恢复原始确认
================================ */
function ibConfirmReset() {
  if (!_selectedAppId) return;
  document.getElementById('ibResetOverlay').classList.add('show');
  document.getElementById('ibResetModal').classList.add('show');
}
function ibCloseReset() {
  document.getElementById('ibResetOverlay').classList.remove('show');
  document.getElementById('ibResetModal').classList.remove('show');
}
async function ibDoReset() {
  if (!_selectedAppId) return;
  ibCloseReset();

  await ibDeleteIconDB(_selectedAppId);
  delete _customIcons[_selectedAppId];

  const app = IB_APPS.find(a => a.id === _selectedAppId);
  if (!app) return;

  // 还原预览
  const prevIcon = document.getElementById('ibPreviewIcon');
  prevIcon.innerHTML = app.defaultSvg;

  // 重置新图标区
  const prevNew = document.getElementById('ibPreviewNew');
  prevNew.innerHTML = `<div class="ib-preview-placeholder">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.2" stroke-dasharray="3 3"/>
      <path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  </div>`;

  _pendingImageData = null;
  document.getElementById('ibBtnSave').disabled = true;

  renderAppGrid();
  document.querySelectorAll('.ib-app-item').forEach(el => {
    el.classList.toggle('active', el.dataset.appId === _selectedAppId);
  });

  // 通知 index 同步
  localStorage.setItem('luna_icon_update', Date.now().toString());

  ibShowToast('ibToastSaved');
}

/* ================================
   Toast 显示
================================ */
function ibShowToast(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2400);
}
function ibShowToastError(msg) {
  const el = document.getElementById('ibToastError');
  const txt = document.getElementById('ibToastErrorText');
  if (txt) txt.textContent = msg;
  if (!el) return;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2400);
}

/* ================================
   返回首页
================================ */
function goBack() {
  const mask = document.createElement('div');
  mask.style.cssText = 'position:fixed;inset:0;background:rgba(232,244,235,0.97);opacity:0;z-index:9999;transition:opacity 0.28s ease;pointer-events:all;';
  document.body.appendChild(mask);
  requestAnimationFrame(() => { mask.style.opacity = '1'; });
  setTimeout(() => { window.location.href = 'index.html'; }, 260);
}

/* ================================
   时间 / 电量 / 灵动岛 — 同步 index
================================ */
function updateIbTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const now = new Date();
  const s = now.toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  document.querySelectorAll('.status-time').forEach(el => el.textContent = s);
}

function updateIbBattery() {
  function render(pct) {
    const p = Math.round(pct);
    document.querySelectorAll('.bat-pct').forEach(el => el.textContent = p);
    document.querySelectorAll('.bat-inner').forEach(el => {
      el.style.width = p + '%';
      el.style.background = p <= 20 ? 'linear-gradient(90deg,#f87171,#ef4444)' : 'linear-gradient(90deg,#86c99a,#4fa868)';
    });
  }
  if ('getBattery' in navigator) {
    navigator.getBattery().then(b => {
      render(b.level * 100);
      b.addEventListener('levelchange', () => render(b.level * 100));
    });
  } else { render(76); }
}

function applyIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const styleMap = {
    minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
  };
  document.querySelectorAll('.status-island').forEach(el => {
    el.innerHTML = enabled ? (styleMap[style] || styleMap.minimal) : '';
  });
}

async function applyGlobalFont() {
  const name = localStorage.getItem('luna_font_active_name');
  const id   = parseInt(localStorage.getItem('luna_font_active_id'));
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
  tag.textContent = `* { ${familyRule} }`;
}

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
      t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0');
    };
    tick();
    window._siClockTimer = setInterval(tick, 10000);
  }
}

/* ================================
   index.html 图标同步读取（供 index 调用）
   index.html 的 script.js 监听 localStorage 事件后
   调用 applyCustomIcons() 即可刷新图标显示
================================ */
window.addEventListener('storage', e => {
  if (e.key === 'luna_island_update') applyIsland();
  if (e.key === 'luna_tz_update')     updateIbTime();
  if (e.key === 'luna_font_update')   applyGlobalFont();
});