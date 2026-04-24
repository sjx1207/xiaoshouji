/* ================================
   Luna Phone — wallpaper.js
   壁纸应用逻辑
================================ */

/* ---- 当前状态 ---- */
let currentType = 'static';       // 'static' | 'dynamic'
let currentUploadTab = 'file';    // 'file' | 'url'
let currentPreviewUrl = null;     // 当前预览的 URL（blob 或 http）
let currentPreviewKind = null;    // 'image' | 'video'
let isSavedToFavorites = false;

/* ================================================
   DB 封装（IndexedDB）
   存储：
     'applied'  — 当前应用的壁纸 { kind, dataUrl, name }
     'favorites' — 收藏列表 [{ id, kind, dataUrl, name }]
================================================ */
let _db = null;

function openDB() {
  return new Promise((res, rej) => {
    if (_db) return res(_db);
    const req = indexedDB.open('LunaWallpaperDB', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('data')) {
        db.createObjectStore('data', { keyPath: 'key' });
      }
    };
    req.onsuccess = e => { _db = e.target.result; res(_db); };
    req.onerror = () => rej('DB Error');
  });
}

async function dbSet(key, value) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('data', 'readwrite');
    tx.objectStore('data').put({ key, value });
    tx.oncomplete = () => res();
    tx.onerror = () => rej();
  });
}

async function dbGet(key) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const req = db.transaction('data').objectStore('data').get(key);
    req.onsuccess = () => res(req.result ? req.result.value : null);
    req.onerror = () => res(null);
  });
}

/* ================================================
   状态栏同步（时间 + 电量）
================================================ */
function updateTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });

  const el = document.getElementById('statusTime');
  if (el) el.textContent = timeStr;

  const ovTime = document.getElementById('ovTime');
  if (ovTime) ovTime.textContent = timeStr;

  // 预览叠层日期也跟随时区
  const tzNow = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  const weeks = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
  const ovDate = document.getElementById('ovDate');
  if (ovDate) ovDate.textContent = `${tzNow.getMonth()+1}月${tzNow.getDate()}日 ${weeks[tzNow.getDay()]}`;
}

function updateBattery() {
  const pctEl = document.getElementById('batPct');
  const innerEl = document.getElementById('batInner');

  function render(pct) {
    const p = Math.round(pct);
    if (pctEl) pctEl.textContent = p;
    if (innerEl) {
      innerEl.style.width = p + '%';
      innerEl.style.background = p <= 20
        ? 'linear-gradient(90deg, #f87171, #ef4444)'
        : 'linear-gradient(90deg, #6ee7b7, #34d399)';
    }
  }

  if ('getBattery' in navigator) {
    navigator.getBattery().then(battery => {
      render(battery.level * 100);
      battery.addEventListener('levelchange', () => render(battery.level * 100));
    });
  } else {
    render(76);
  }
}

/* ================================================
   类型切换（静态 / 动态）
================================================ */
function switchType(type) {
  currentType = type;
  document.getElementById('btnStatic').classList.toggle('active', type === 'static');
  document.getElementById('btnDynamic').classList.toggle('active', type === 'dynamic');

  // 更新上传提示文字
  const dropSub = document.getElementById('dropSub');
  if (dropSub) {
    dropSub.textContent = type === 'static'
      ? '支持 JPG · PNG · WebP'
      : '支持 MP4 · MOV · WebM';
  }

  // 更新 file input accept
  const fi = document.getElementById('fileInput');
  if (fi) fi.accept = type === 'static' ? 'image/*' : 'video/*';

  // 清空当前预览（切换类型时重置）
  clearPreview();
}

/* ================================================
   上传方式切换（文件 / URL）
================================================ */
function switchUploadTab(tab) {
  currentUploadTab = tab;
  document.getElementById('tabFile').classList.toggle('active', tab === 'file');
  document.getElementById('tabUrl').classList.toggle('active', tab === 'url');
  document.getElementById('panelFile').style.display = tab === 'file' ? 'block' : 'none';
  document.getElementById('panelUrl').style.display = tab === 'url' ? 'block' : 'none';
}

/* ================================================
   文件上传处理
================================================ */
function handleFileInput(input) {
  const file = input.files[0];
  if (!file) return;
  processFile(file);
}

function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('dropZone').classList.add('drag-over');
}

function handleDragLeave(e) {
  document.getElementById('dropZone').classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('dropZone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
}

function processFile(file) {
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');

  if (!isImage && !isVideo) {
    alert('不支持的文件格式，请上传图片或视频');
    return;
  }

  // 自动切换类型
  if (isImage && currentType !== 'static') switchType('static');
  if (isVideo && currentType !== 'dynamic') switchType('dynamic');

  const reader = new FileReader();
  reader.onload = e => {
    showPreview(e.target.result, isImage ? 'image' : 'video', file.name);
  };
  reader.readAsDataURL(file);
}

/* ================================================
   URL 加载
================================================ */
function onUrlInput() {
  const val = document.getElementById('urlInput').value.trim();
  const btn = document.getElementById('urlLoadBtn');
  btn.disabled = val.length === 0;
}

async function loadFromUrl() {
  const url = document.getElementById('urlInput').value.trim();
  const statusEl = document.getElementById('urlStatus');

  if (!url) return;

  statusEl.textContent = '加载中...';
  statusEl.className = 'wp-url-status';

  // 根据扩展名判断类型
  const isVideo = /\.(mp4|mov|webm|m4v)(\?.*)?$/i.test(url);
  const isImage = /\.(jpg|jpeg|png|webp|gif|avif)(\?.*)?$/i.test(url);

  if (!isImage && !isVideo) {
    statusEl.textContent = '无法识别链接类型，请确认后缀名';
    statusEl.className = 'wp-url-status err';
    return;
  }

  try {
    // 简单验证：尝试 HEAD 或直接展示
    const kind = isVideo ? 'video' : 'image';
    if (isImage && currentType !== 'static') switchType('static');
    if (isVideo && currentType !== 'dynamic') switchType('dynamic');

    showPreview(url, kind, url.split('/').pop());
    statusEl.textContent = '载入成功';
    statusEl.className = 'wp-url-status';
    setTimeout(() => { statusEl.textContent = ''; }, 2000);
  } catch (e) {
    statusEl.textContent = '加载失败，请检查链接是否可访问';
    statusEl.className = 'wp-url-status err';
  }
}

/* ================================================
   预览展示
================================================ */
function showPreview(src, kind, name) {
  currentPreviewUrl = src;
  currentPreviewKind = kind;
  isSavedToFavorites = false;

  const defaultBg = document.getElementById('defaultBg');
  const img = document.getElementById('previewImg');
  const video = document.getElementById('previewVideo');

  defaultBg.style.display = 'none';
  img.style.display = 'none';
  video.style.display = 'none';

  if (kind === 'image') {
    img.src = src;
    img.style.display = 'block';
  } else {
    video.src = src;
    video.style.display = 'block';
    video.play().catch(() => {});
  }

  // 更新保存按钮状态
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.classList.remove('saved');
  saveBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    保存到收藏
  `;

  // 显示操作按钮
  document.getElementById('wpActions').style.display = 'flex';

  // 更新状态条
  setStatus('preview', `预览中 · ${kind === 'image' ? '静态图片' : '动态视频'}`);
}

function clearPreview() {
  currentPreviewUrl = null;
  currentPreviewKind = null;

  document.getElementById('defaultBg').style.display = 'block';
  document.getElementById('previewImg').style.display = 'none';
  document.getElementById('previewVideo').style.display = 'none';
  document.getElementById('wpActions').style.display = 'none';

  checkAppliedStatus();
}

/* ================================================
   应用壁纸（写入 IndexedDB，供 index.html 读取）
================================================ */
async function applyWallpaper() {
  if (!currentPreviewUrl) return;

  const data = {
    kind: currentPreviewKind,
    dataUrl: currentPreviewUrl,
    appliedAt: Date.now()
  };

  await dbSet('applied', data);

  // 同步到 index.html 的壁纸（通过 localStorage 通知，index 监听）
  try {
    localStorage.setItem('luna_wallpaper_update', Date.now().toString());
  } catch(e) {}

  setStatus('active', `已应用 · ${currentPreviewKind === 'image' ? '静态图片' : '动态视频'}`);

  // 按钮反馈
  const btn = document.querySelector('.wp-apply-btn');
  const orig = btn.innerHTML;
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
      <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    已应用
  `;
  setTimeout(() => { btn.innerHTML = orig; }, 2000);
}

/* ================================================
   保存到收藏
================================================ */
async function saveToFavorites() {
  if (!currentPreviewUrl || isSavedToFavorites) return;

  const favorites = (await dbGet('favorites')) || [];

  const item = {
    id: Date.now(),
    kind: currentPreviewKind,
    dataUrl: currentPreviewUrl,
    savedAt: Date.now()
  };

  favorites.unshift(item);
  await dbSet('favorites', favorites);

  isSavedToFavorites = true;

  const saveBtn = document.getElementById('saveBtn');
  saveBtn.classList.add('saved');
  saveBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
      <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    已收藏
  `;

  renderFavorites(favorites);
}

/* ================================================
   删除收藏
================================================ */
async function deleteFavorite(id) {
  const favorites = (await dbGet('favorites')) || [];
  const updated = favorites.filter(f => f.id !== id);
  await dbSet('favorites', updated);
  renderFavorites(updated);
}

/* ================================================
   从收藏中应用
================================================ */
function applyFromFavorite(item) {
  showPreview(item.dataUrl, item.kind, '收藏壁纸');
  // 自动滚动到顶部预览
  document.querySelector('.wp-app').scrollTo({ top: 0, behavior: 'smooth' });
}

/* ================================================
   渲染收藏列表
================================================ */
function renderFavorites(favorites) {
  const list = document.getElementById('favList');
  const empty = document.getElementById('favEmpty');
  const count = document.getElementById('favCount');

  count.textContent = `${favorites.length} 项`;

  if (favorites.length === 0) {
    list.innerHTML = '';
    list.appendChild(empty);
    return;
  }

  list.innerHTML = favorites.map(item => `
    <div class="wp-fav-card" id="fav-${item.id}" data-id="${item.id}">
      ${item.kind === 'image'
        ? `<img src="${item.dataUrl}" alt="收藏壁纸" loading="lazy" />`
        : `<video src="${item.dataUrl}" muted playsinline loop autoplay style="pointer-events:none"></video>`
      }
      <div class="wp-fav-overlay"></div>
      <div class="wp-fav-badge">${item.kind === 'image' ? '静态' : '动态'}</div>
      <button class="wp-fav-del" data-del="${item.id}">
        <svg viewBox="0 0 24 24" width="10" height="10" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  `).join('');

  // 用事件委托绑定点击，避免 innerHTML 里 onclick 解析问题
  list.querySelectorAll('.wp-fav-del').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = Number(btn.dataset.del);
      showConfirm({
        title: '删除收藏',
        desc: '确定要删除这张壁纸吗？',
        confirmText: '删除',
        danger: true,
        onConfirm: () => deleteFavorite(id)
      });
    });
  });

  list.querySelectorAll('.wp-fav-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = Number(card.dataset.id);
      const item = favorites.find(f => f.id === id);
      if (item) applyFromFavorite(item);
    });
  });
}

/* ================================================
   恢复默认壁纸
================================================ */
async function resetWallpaper() {
  showConfirm({
    title: '恢复默认壁纸',
    desc: '将清除当前应用的壁纸，恢复为 Luna 默认渐变背景。',
    confirmText: '恢复',
    danger: false,
    onConfirm: async () => {
      await dbSet('applied', null);
      try {
        localStorage.setItem('luna_wallpaper_update', 'reset_' + Date.now());
      } catch(e) {}
      clearPreview();
      setStatus('default', '当前使用默认壁纸');
    }
  });
}

/* ================================================
   状态条更新
================================================ */
function setStatus(type, text) {
  const dot = document.getElementById('wpStatusDot');
  const txt = document.getElementById('wpStatusText');

  dot.className = 'wp-status-dot';
  txt.textContent = text;

  if (type === 'active') dot.classList.add('active');
  else if (type === 'dynamic') dot.classList.add('dynamic');
  else if (type === 'preview') dot.classList.add('dynamic');
}

/* ================================================
   检查当前已应用的壁纸（页面加载时）
================================================ */
async function checkAppliedStatus() {
  const applied = await dbGet('applied');

  if (applied && applied.dataUrl) {
    const kind = applied.kind;
    setStatus(kind === 'image' ? 'active' : 'dynamic',
      `正在使用 · ${kind === 'image' ? '静态图片' : '动态视频'}`);

    // 在预览区显示当前壁纸
    showPreview(applied.dataUrl, applied.kind, '当前壁纸');
  } else {
    setStatus('default', '当前使用默认壁纸');
  }
}

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
        r.onerror = () => res([]);
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
  const colorRule  = style.color ? `color: ${style.color} !important;` : '';
  const sizeRule   = style.size  ? `font-size: ${style.size}px !important;` : '';
  const familyRule = name        ? `font-family: '${name}', sans-serif !important;` : '';
  tag.textContent  = `* { ${colorRule} ${sizeRule} ${familyRule} }`;
}

/* ================================================
   初始化
================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  updateTime();
  updateBattery();
  setInterval(updateTime, 1000);

  // 载入收藏列表
  const favorites = (await dbGet('favorites')) || [];
  renderFavorites(favorites);

  // 检查当前壁纸
  await checkAppliedStatus();

  // URL输入按钮初始禁用
  // URL输入按钮初始禁用
  const urlBtn = document.getElementById('urlLoadBtn');
  if (urlBtn) urlBtn.disabled = true;

  applyGlobalFont();
  applyIsland();
});

/* ================================
   通用确认弹窗
================================ */
function showConfirm({ title, desc, confirmText, danger, onConfirm }) {
  // 防止重复
  const old = document.getElementById('lunaConfirmMask');
  if (old) old.remove();

  const mask = document.createElement('div');
  mask.id = 'lunaConfirmMask';
  mask.innerHTML = `
    <div class="luna-confirm-box">
      <div class="luna-confirm-title">${title}</div>
      <div class="luna-confirm-desc">${desc}</div>
      <div class="luna-confirm-actions">
        <button class="luna-confirm-cancel" id="lunaConfirmCancel">取消</button>
        <button class="luna-confirm-ok ${danger ? 'danger' : ''}" id="lunaConfirmOk">${confirmText}</button>
      </div>
    </div>
  `;
  document.body.appendChild(mask);

  // 进入动画
  requestAnimationFrame(() => mask.classList.add('show'));

  function close() {
    mask.classList.remove('show');
    setTimeout(() => mask.remove(), 280);
  }

  document.getElementById('lunaConfirmCancel').addEventListener('click', close);
  document.getElementById('lunaConfirmOk').addEventListener('click', () => {
    close();
    onConfirm();
  });
  mask.addEventListener('click', e => { if (e.target === mask) close(); });
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