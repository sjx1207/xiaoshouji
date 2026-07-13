// ==========================================================
// PhoneChar (Luna) · 手机 UI 交互脚本
// ==========================================================

// ==========================================================
// 当前角色识别
// 与 charphone.js / chatroom.js 共用同一套 localStorage 约定：
//   luna_current_chat        角色 name（chatroom.js 的 CR_NAME 读取源）
//   luna_active_char         角色 id（characters.html / charphone.js 通用）
//   luna_active_phone_char   角色 id（本页专用，charphone.js 进入时写入）
// URL ?char=<id> 优先级最高（防止 localStorage 尚未来得及写入/被覆盖）
// ==========================================================

function pcGetActiveCharId() {
  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get('char');
    if (q) return isNaN(Number(q)) ? q : Number(q);
  } catch (e) {}
  const stored = localStorage.getItem('luna_active_phone_char') || localStorage.getItem('luna_active_char');
  if (stored) return isNaN(Number(stored)) ? stored : Number(stored);
  return null;
}

// ---------------- 只读打开 LunaCharDB（与 characters.js / charphone.js / chatroom.js 同一个库） ----------------

let _pcCharDB = null;
function pcOpenCharDB() {
  if (_pcCharDB) return Promise.resolve(_pcCharDB);
  return new Promise((res, rej) => {
    const probe = indexedDB.open('LunaCharDB');
    probe.onsuccess = e => {
      const cur = e.target.result;
      const ver = cur.version;
      const hasChars = cur.objectStoreNames.contains('chars');
      cur.close();
      if (hasChars) {
        const req2 = indexedDB.open('LunaCharDB', ver);
        req2.onsuccess = e2 => { _pcCharDB = e2.target.result; res(_pcCharDB); };
        req2.onerror   = e2 => rej(e2.target.error);
      } else {
        const req3 = indexedDB.open('LunaCharDB', ver + 1);
        req3.onupgradeneeded = e3 => {
          const db3 = e3.target.result;
          if (!db3.objectStoreNames.contains('chars'))
            db3.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
        };
        req3.onsuccess = e3 => { _pcCharDB = e3.target.result; res(_pcCharDB); };
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

async function pcGetAllChars() {
  try {
    const db = await pcOpenCharDB();
    return await new Promise(res => {
      const r = db.transaction('chars', 'readonly').objectStore('chars').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror   = () => res([]);
    });
  } catch (e) { return []; }
}

async function pcLoadActiveChar() {
  const id = pcGetActiveCharId();
  const all = await pcGetAllChars();
  if (!all.length) return null;
  if (id != null) {
    const found = all.find(c => c.id === id || String(c.id) === String(id));
    if (found) return found;
  }
  // 兜底：按 luna_current_chat 里的 name 匹配
  const name = localStorage.getItem('luna_current_chat');
  if (name) {
    const byName = all.find(c => c.name === name);
    if (byName) return byName;
  }
  return all[0] || null;
}

// 与 charphone.js 保持一致的头像兜底底色
const PC_COLOR_MAP = {
  warm:  { avBg:'#1C1C1C', avCol:'#B4B4B4' },
  cool:  { avBg:'#141414', avCol:'#9C9C9C' },
  gold:  { avBg:'#181818', avCol:'#A8A8A8' },
  ash:   { avBg:'#141414', avCol:'#9D9D9D' },
  mist:  { avBg:'#151515', avCol:'#A5A5A5' },
  blush: { avBg:'#171717', avCol:'#ADADAD' },
};

// 当前已加载的角色（全局，供本文件后续各功能复用）
let PC_CHAR = null;

// ---------------- 时间：跟随系统实时时间 ----------------

function updateStatusBarTime() {
  const timeEl = document.getElementById('time');
  if (!timeEl) return;

  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  timeEl.textContent = `${hours}:${minutes}`;
}

updateStatusBarTime();
setInterval(updateStatusBarTime, 1000 * 10);

// ---------------- 电池：同步设备真实电量 ----------------
// 使用 Battery Status API（部分浏览器/系统支持，如 Android Chrome）。
// 若设备或浏览器不支持，则保留满电显示，不做假数据。

function setBatteryWidth(level) {
  const levelEl = document.getElementById('batteryLevel');
  if (!levelEl) return;
  const clamped = Math.max(0, Math.min(1, level));
  const fullWidth = 16; // 对应 SVG 内部电池格宽度
  levelEl.setAttribute('width', (fullWidth * clamped).toFixed(2));
}

if ('getBattery' in navigator) {
  navigator.getBattery().then((battery) => {
    setBatteryWidth(battery.level);

    battery.addEventListener('levelchange', () => {
      setBatteryWidth(battery.level);
    });
  });
}

// ---------------- Dock 图标点击反馈（非编辑模式下才触发按压效果） ----------------

document.querySelectorAll('.dock-item').forEach((item) => {
  item.addEventListener('click', () => {
    if (document.body.classList.contains('edit-mode')) return;
    item.style.transform = 'scale(0.9)';
    setTimeout(() => {
      item.style.transform = '';
    }, 140);
  });
});

// ==========================================================
// 自定义素材系统：壁纸 / 图标 / 组件背景
// 持久化存储在 IndexedDB（浏览器端数据库，容量远大于 localStorage，
// 适合存放图片 / 视频这类较大的二进制数据）
// ==========================================================

const DB_NAME = 'phonechar_db';
const DB_VERSION = 1;
const STORE_NAME = 'assets';

/* 每个角色的美化素材（壁纸/图标/组件背景）互相隔离，不共享全局：
   所有 key 前缀带上当前角色 id，读取时用当前 PC_CHAR.id 拼接。
   pcGetActiveCharId() 在文件顶部已定义，这里作为 key 前缀来源；
   若尚未识别出角色（比如直接打开本页），退回 'default' 作为兜底前缀，
   保证功能仍可用，不报错。 */
function pcCharKeyPrefix() {
  const id = (PC_CHAR && PC_CHAR.id != null) ? PC_CHAR.id : (pcGetActiveCharId() ?? 'default');
  return 'char_' + id + '_';
}

const STORAGE_KEYS = {
  wallpaperType: () => pcCharKeyPrefix() + 'wallpaper_type', // 'image' | 'video'
  wallpaperData: () => pcCharKeyPrefix() + 'wallpaper_data',
  icon: (key) => pcCharKeyPrefix() + 'icon_' + key,
  widget: (key) => pcCharKeyPrefix() + 'widget_' + key,
};

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('当前浏览器不支持 IndexedDB'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function idbGet(key) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result != null ? req.result : null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('IndexedDB 读取失败', e);
    return null;
  }
}

async function idbSet(key, value) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return true;
  } catch (e) {
    console.error('IndexedDB 写入失败', e);
    return false;
  }
}

async function idbRemove(key) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('IndexedDB 删除失败', e);
  }
}

// ---------------- 编辑模式开关：长按 Dock 最后一个图标（星星）触发 ----------------

const body = document.body;
const editBanner = document.getElementById('editBanner');
const editBannerClose = document.getElementById('editBannerClose');
const wallpaperEditFab = document.getElementById('wallpaperEditFab');
const dockEditTrigger = document.getElementById('dockEditTrigger');
const dockProgressCircle = document.getElementById('dockProgressCircle');

function setEditMode(on) {
  body.classList.toggle('edit-mode', on);
  editBanner.classList.toggle('is-visible', on);
}

editBannerClose.addEventListener('click', () => setEditMode(false));

// 长按检测：按住 600ms 触发编辑模式，期间显示进度环反馈；短按（<600ms 松开）视为普通点击
const LONG_PRESS_MS = 600;
const RING_CIRCUMFERENCE = 163.4;
let pressTimer = null;
let pressStart = 0;
let progressRAF = null;
let justLongPressed = false; // 长按刚触发时短暂锁定，避免松手瞬间被判定为图标点击

function startPressFeedback() {
  dockEditTrigger.classList.add('is-charging');
  pressStart = performance.now();

  function tick() {
    const elapsed = performance.now() - pressStart;
    const ratio = Math.min(elapsed / LONG_PRESS_MS, 1);
    dockProgressCircle.setAttribute(
      'stroke-dashoffset',
      String(RING_CIRCUMFERENCE * (1 - ratio))
    );
    if (ratio < 1) {
      progressRAF = requestAnimationFrame(tick);
    }
  }
  progressRAF = requestAnimationFrame(tick);

  pressTimer = setTimeout(() => {
    // 长按达成：触发编辑模式，短振动反馈（如设备支持）
    if (navigator.vibrate) navigator.vibrate(12);
    setEditMode(!body.classList.contains('edit-mode'));
    justLongPressed = true;
    setTimeout(() => { justLongPressed = false; }, 300);
    resetPressFeedback();
  }, LONG_PRESS_MS);
}

function resetPressFeedback() {
  clearTimeout(pressTimer);
  cancelAnimationFrame(progressRAF);
  pressTimer = null;
  dockEditTrigger.classList.remove('is-charging');
  dockProgressCircle.setAttribute('stroke-dashoffset', String(RING_CIRCUMFERENCE));
}

dockEditTrigger.addEventListener('pointerdown', (e) => {
  if (body.classList.contains('edit-mode')) return; // 编辑模式下交给图标点击逻辑处理（替换该图标）
  e.preventDefault();
  startPressFeedback();
});
['pointerup', 'pointerleave', 'pointercancel'].forEach((evt) => {
  dockEditTrigger.addEventListener(evt, () => {
    if (pressTimer !== null) resetPressFeedback();
  });
});

// ---------------- 通用编辑弹层（壁纸 / 图标 / 组件背景 共用） ----------------

const editOverlay = document.getElementById('editOverlay');
const editSheet = document.getElementById('editSheet');
const editSheetTitle = document.getElementById('editSheetTitle');
const editSheetClose = document.getElementById('editSheetClose');
const editTypeSwitch = document.getElementById('editTypeSwitch');
const editPreview = document.getElementById('editPreview');
const editPreviewImg = document.getElementById('editPreviewImg');
const editPreviewVideo = document.getElementById('editPreviewVideo');
const editUploadZone = document.getElementById('editUploadZone');
const editUploadLabel = document.getElementById('editUploadLabel');
const editFileInput = document.getElementById('editFileInput');
const editHint = document.getElementById('editHint');
const editResetBtn = document.getElementById('editResetBtn');
const editConfirmBtn = document.getElementById('editConfirmBtn');

// 当前弹层会话状态
let session = {
  mode: null,        // 'wallpaper' | 'icon' | 'widget'
  targetKey: null,    // icon key / widget key
  mediaType: 'image', // 'image' | 'video'（仅壁纸场景用到 video）
  dataUrl: null,       // 待应用的 base64 数据
  hasExisting: false,  // 该目标当前是否已有自定义素材
};

// 存储上限：IndexedDB 容量通常在几百 MB 以上（远大于 localStorage 的 ~5MB），
// 这里给一个宽松但仍合理的上限，避免单个文件过大拖慢页面
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;   // 图片建议 20MB 以内
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;   // 视频建议 60MB 以内

async function openEditSheet({ mode, targetKey, title, allowVideo, hint }) {
  session = {
    mode,
    targetKey: targetKey || null,
    mediaType: 'image',
    dataUrl: null,
    hasExisting: false,
  };

  editSheetTitle.textContent = title;
  editHint.textContent = hint || '支持透明背景 PNG，将按组件形状自动裁切显示';
  editTypeSwitch.classList.toggle('is-visible', !!allowVideo);
  editTypeSwitch.querySelectorAll('.type-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.mediaType === 'image');
  });

  editFileInput.accept = 'image/*';
  editUploadLabel.textContent = '点击选择图片，或拖拽到此处';

  // 面板先以空状态打开，避免等待数据库读取时界面卡顿感
  editResetBtn.disabled = true;
  editConfirmBtn.disabled = true;
  renderPreview();
  editOverlay.classList.add('is-open');

  // 载入已有素材作为预览（异步读取 IndexedDB）
  let existingType = 'image';
  let existingData = null;
  if (mode === 'wallpaper') {
    existingType = (await idbGet(STORAGE_KEYS.wallpaperType())) || 'image';
    existingData = await idbGet(STORAGE_KEYS.wallpaperData());
  } else if (mode === 'icon') {
    existingData = await idbGet(STORAGE_KEYS.icon(targetKey));
  } else if (mode === 'widget') {
    existingData = await idbGet(STORAGE_KEYS.widget(targetKey));
  }

  // 若用户在读取期间已经关闭了面板或切换了目标，则不要用过期数据覆盖当前会话
  if (session.mode !== mode || session.targetKey !== (targetKey || null)) return;

  if (existingData) {
    session.hasExisting = true;
    session.dataUrl = existingData;
    session.mediaType = existingType;
    if (allowVideo) {
      editTypeSwitch.querySelectorAll('.type-btn').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.mediaType === existingType);
      });
      editFileInput.accept = existingType === 'video' ? 'video/*' : 'image/*';
      editUploadLabel.textContent = existingType === 'video'
        ? '点击选择视频，或拖拽到此处'
        : '点击选择图片，或拖拽到此处';
    }
    renderPreview();
  } else {
    session.hasExisting = false;
    session.dataUrl = null;
    renderPreview();
  }

  editResetBtn.disabled = !session.hasExisting;
  editConfirmBtn.disabled = !session.dataUrl;
}

function closeEditSheet() {
  editOverlay.classList.remove('is-open');
  editPreviewVideo.pause();
}

editSheetClose.addEventListener('click', closeEditSheet);
editOverlay.addEventListener('click', (e) => {
  if (e.target === editOverlay) closeEditSheet();
});

editTypeSwitch.querySelectorAll('.type-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    editTypeSwitch.querySelectorAll('.type-btn').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    session.mediaType = btn.dataset.mediaType;
    editFileInput.accept = session.mediaType === 'video' ? 'video/*' : 'image/*';
    editUploadLabel.textContent = session.mediaType === 'video'
      ? '点击选择视频，或拖拽到此处'
      : '点击选择图片，或拖拽到此处';
  });
});

function renderPreview() {
  editPreview.classList.remove('mode-image', 'mode-video', 'has-media');
  editPreviewVideo.pause();
  editPreviewImg.src = '';
  editPreviewVideo.src = '';

  if (!session.dataUrl) return;

  editPreview.classList.add('has-media');
  if (session.mediaType === 'video') {
    editPreview.classList.add('mode-video');
    editPreviewVideo.src = session.dataUrl;
    editPreviewVideo.play().catch(() => {});
  } else {
    editPreview.classList.add('mode-image');
    editPreviewImg.src = session.dataUrl;
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

async function handleIncomingFile(file) {
  if (!file) return;

  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');

  if (session.mode === 'wallpaper') {
    if (!isVideo && !isImage) {
      alert('请上传图片或视频文件');
      return;
    }
    session.mediaType = isVideo ? 'video' : 'image';
    editTypeSwitch.querySelectorAll('.type-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.mediaType === session.mediaType);
    });
  } else if (!isImage) {
    alert('请上传图片文件');
    return;
  }

  const maxBytes = session.mediaType === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > maxBytes) {
    alert('文件较大，可能无法保存成功，建议压缩后再上传（建议 4.5MB 以内）');
  }

  try {
    const dataUrl = await readFileAsDataUrl(file);
    session.dataUrl = dataUrl;
    renderPreview();
    editConfirmBtn.disabled = false;
  } catch (err) {
    alert('文件读取失败，请重试');
  }
}

editFileInput.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  handleIncomingFile(file);
});

['dragover', 'dragenter'].forEach((evt) => {
  editUploadZone.addEventListener(evt, (e) => {
    e.preventDefault();
    editUploadZone.classList.add('is-dragover');
  });
});
['dragleave', 'drop'].forEach((evt) => {
  editUploadZone.addEventListener(evt, (e) => {
    e.preventDefault();
    editUploadZone.classList.remove('is-dragover');
  });
});
editUploadZone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  handleIncomingFile(file);
});

// ---------------- 应用 / 恢复默认 ----------------

function applyWallpaper(type, dataUrl) {
  const layer = document.getElementById('wallpaperLayer');
  const img = document.getElementById('wallpaperImg');
  const video = document.getElementById('wallpaperVideo');

  if (!dataUrl) {
    layer.classList.remove('is-active');
    img.classList.remove('is-active');
    video.classList.remove('is-active');
    img.src = '';
    video.src = '';
    return;
  }

  layer.classList.add('is-active');
  if (type === 'video') {
    video.src = dataUrl;
    video.classList.add('is-active');
    img.classList.remove('is-active');
    img.src = '';
    video.play().catch(() => {});
  } else {
    img.src = dataUrl;
    img.classList.add('is-active');
    video.classList.remove('is-active');
    video.src = '';
  }
}

function applyIconImage(key, dataUrl) {
  const targets = document.querySelectorAll(`[data-icon-key="${key}"]`);
  targets.forEach((el) => {
    const imgEl = el.querySelector('.icon-custom-img');
    if (!imgEl) return;
    if (dataUrl) {
      imgEl.src = dataUrl;
      el.classList.add('has-custom-img');
    } else {
      imgEl.src = '';
      el.classList.remove('has-custom-img');
    }
  });
}

function applyWidgetImage(key, dataUrl) {
  const imgEl = document.getElementById(key + 'BgImg');
  if (!imgEl) return;
  const bgContainer = imgEl.parentElement; // .glass-plate 或 .note-glass
  if (dataUrl) {
    imgEl.src = dataUrl;
    bgContainer.classList.add('has-custom-bg');
  } else {
    imgEl.src = '';
    bgContainer.classList.remove('has-custom-bg');
  }
}

editConfirmBtn.addEventListener('click', async () => {
  if (!session.dataUrl) return;

  editConfirmBtn.disabled = true;
  editConfirmBtn.textContent = '保存中…';

  let ok = false;
  try {
    if (session.mode === 'wallpaper') {
      const okType = await idbSet(STORAGE_KEYS.wallpaperType(), session.mediaType);
      const okData = await idbSet(STORAGE_KEYS.wallpaperData(), session.dataUrl);
      ok = okType && okData;
      if (ok) applyWallpaper(session.mediaType, session.dataUrl);
    } else if (session.mode === 'icon') {
      ok = await idbSet(STORAGE_KEYS.icon(session.targetKey), session.dataUrl);
      if (ok) applyIconImage(session.targetKey, session.dataUrl);
    } else if (session.mode === 'widget') {
      ok = await idbSet(STORAGE_KEYS.widget(session.targetKey), session.dataUrl);
      if (ok) applyWidgetImage(session.targetKey, session.dataUrl);
    }
  } catch (e) {
    ok = false;
  }

  editConfirmBtn.textContent = '应用';
  editConfirmBtn.disabled = false;

  if (!ok) {
    alert('保存失败，请更换较小的图片或视频后重试');
    return;
  }

  closeEditSheet();
});

editResetBtn.addEventListener('click', async () => {
  editResetBtn.disabled = true;
  try {
    if (session.mode === 'wallpaper') {
      await idbRemove(STORAGE_KEYS.wallpaperType());
      await idbRemove(STORAGE_KEYS.wallpaperData());
      applyWallpaper(null, null);
    } else if (session.mode === 'icon') {
      await idbRemove(STORAGE_KEYS.icon(session.targetKey));
      applyIconImage(session.targetKey, null);
    } else if (session.mode === 'widget') {
      await idbRemove(STORAGE_KEYS.widget(session.targetKey));
      applyWidgetImage(session.targetKey, null);
    }
  } finally {
    editResetBtn.disabled = false;
  }
  closeEditSheet();
});

// ---------------- 点击入口绑定 ----------------

// 壁纸编辑入口
wallpaperEditFab.addEventListener('click', () => {
  openEditSheet({
    mode: 'wallpaper',
    title: '更换壁纸',
    allowVideo: true,
    hint: '支持图片或视频作为壁纸，建议选择浅色调素材以保持界面清晰易读',
  });
});

// 图标点击（编辑模式下拦截默认跳转/反馈，弹出编辑面板）
document.querySelectorAll('.app-icon[data-icon-key]').forEach((iconEl) => {
  iconEl.addEventListener('click', (e) => {
    if (!body.classList.contains('edit-mode')) return;
    e.preventDefault();
    e.stopPropagation();
    const key = iconEl.dataset.iconKey;
    const label = iconEl.dataset.iconLabel || '图标';
    openEditSheet({
      mode: 'icon',
      targetKey: key,
      title: `替换「${label}」图标`,
      allowVideo: false,
      hint: '建议使用方形图片，将自动裁切为圆角图标样式',
    });
  });
});

document.querySelectorAll('.dock-icon[data-icon-key]').forEach((iconEl) => {
  iconEl.addEventListener('click', (e) => {
    if (!body.classList.contains('edit-mode')) return;
    if (justLongPressed) return; // 刚由长按切换到编辑模式，忽略这次点击
    e.preventDefault();
    e.stopPropagation();
    const key = iconEl.dataset.iconKey;
    openEditSheet({
      mode: 'icon',
      targetKey: key,
      title: '替换 Dock 图标',
      allowVideo: false,
      hint: '建议使用方形图片，将自动裁切为圆角图标样式',
    });
  });
});

// 组件背景点击
document.querySelectorAll('[data-widget-key]').forEach((widgetEl) => {
  widgetEl.addEventListener('click', (e) => {
    if (!body.classList.contains('edit-mode')) return;
    e.preventDefault();
    e.stopPropagation();
    const key = widgetEl.dataset.widgetKey;
    const title = key === 'widget1' ? '替换头像组件背景' : '替换便签组件背景';
    openEditSheet({
      mode: 'widget',
      targetKey: key,
      title,
      allowVideo: false,
      hint: '支持透明背景 PNG，图片将铺满组件卡片区域',
    });
  });
});

// ---------------- 页面加载时恢复已保存的自定义素材（按角色隔离） ----------------

async function restoreSavedCustomizations() {
  // 壁纸（角色专属）
  const [wallpaperType, wallpaperData] = await Promise.all([
    idbGet(STORAGE_KEYS.wallpaperType()),
    idbGet(STORAGE_KEYS.wallpaperData()),
  ]);
  if (wallpaperData) {
    applyWallpaper(wallpaperType || 'image', wallpaperData);
  } else {
    applyWallpaper(null, null);
  }

  // 图标（12 个网格图标 + 5 个 Dock 图标），并行读取加快首屏恢复速度
  const iconEls = Array.from(document.querySelectorAll('[data-icon-key]'));
  await Promise.all(iconEls.map(async (el) => {
    const key = el.dataset.iconKey;
    const data = await idbGet(STORAGE_KEYS.icon(key));
    applyIconImage(key, data || null);
  }));

  // 组件背景
  const widgetEls = Array.from(document.querySelectorAll('[data-widget-key]'));
  await Promise.all(widgetEls.map(async (el) => {
    const key = el.dataset.widgetKey;
    const data = await idbGet(STORAGE_KEYS.widget(key));
    applyWidgetImage(key, data || null);
  }));
}

// ==========================================================
// 角色专属初始化：头像同步 / AI 气泡文案 / 便签内容 / Home 返回
// ==========================================================

/* ---- 头像同步：把角色的 avatar / color 渲染进组件1的头像位 ---- */
function pcApplyAvatar(char) {
  const wrap = document.querySelector('.avatar-wrap');
  const circle = document.querySelector('.avatar-circle');
  if (!wrap || !circle) return;

  const col = PC_COLOR_MAP[char?.color] || PC_COLOR_MAP.warm;
  const letter = (char?.name || '?')[0].toUpperCase();

  // 清掉旧的自绘人像剪影，改为真实头像图（有 avatar 时）或字母兜底
  circle.innerHTML = '';
  circle.style.background = '';

  if (char?.avatar) {
    const img = document.createElement('img');
    img.src = char.avatar;
    img.alt = char.name || '';
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
    circle.appendChild(img);
  } else {
    circle.style.background = col.avBg;
    const span = document.createElement('span');
    span.textContent = letter;
    span.style.cssText = `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Poppins',serif;font-size:32px;color:${col.avCol};`;
    circle.appendChild(span);
  }

  // 签名行 / 头像标记里的名字同步（体现这是该角色专属的手机）
  const sigEl = document.querySelector('.signature');
  if (sigEl && char?.name) {
    sigEl.innerHTML = `${escapePcHtml(char.name)}.<span class="en">Personal Widget</span>`;
  }
  const markEl = document.querySelector('.avatar-mark');
  if (markEl) markEl.textContent = '✳';

  document.title = char?.name ? `${char.name} 的手机` : 'PhoneChar';
}

function escapePcHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ==========================================================
   气泡 AI 文案 —— 复用 chatroom.js 同款的 OpenAI 兼容接口配置
   （localStorage: luna_api_current / luna_api_model），
   不重复实现 API 调用逻辑之外的东西，只按同一协议直接 fetch。

   规则：
   - 每个角色专属一份缓存，key 里带上角色 id，互不干扰、不共享
   - 只要用户没点击气泡，就一直显示上次生成的文案（含跨页面/刷新）
   - 每次真正"进入这个角色的手机"（页面加载）只允许生成一次，
     不会在同一次停留里被重复调用；点击气泡才会主动重新生成一次
   ========================================================== */

const PC_BUBBLE_STORE_PREFIX = 'pc_bubble_';

function pcBubbleKey(charId) {
  return PC_BUBBLE_STORE_PREFIX + charId;
}

async function pcCallApi(systemPrompt, messages) {
  const cur   = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  if (!cur.baseUrl || !cur.apiKey || !model) throw new Error('NO_API_CONFIG');

  const response = await fetch(`${cur.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${cur.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${response.status}`);
  }
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('回复为空');
  return text;
}

/* 打开 LunaChatDB 只读，取该角色的聊天记录 + 通话记录，供生成气泡文案参考 */
function pcOpenChatDB() {
  return new Promise((res, rej) => {
    const probe = indexedDB.open('LunaChatDB');
    probe.onsuccess = e => { res(e.target.result); };
    probe.onerror = e => rej(e.target.error);
  });
}

async function pcLoadRecentMessages(charName, limit) {
  try {
    const db = await pcOpenChatDB();
    if (!db.objectStoreNames.contains('messages')) return [];
    return await new Promise(res => {
      const r = db.transaction('messages').objectStore('messages').get(charName);
      r.onsuccess = () => {
        const msgs = (r.result && r.result.msgs) || [];
        res(msgs.slice(-limit));
      };
      r.onerror = () => res([]);
    });
  } catch (e) { return []; }
}

async function pcLoadRecentCallLogs(charName, limit) {
  try {
    const db = await pcOpenChatDB();
    if (!db.objectStoreNames.contains('videoLogs')) return [];
    return await new Promise(res => {
      const r = db.transaction('videoLogs').objectStore('videoLogs').getAll();
      r.onsuccess = () => {
        const all = (r.result || []).filter(v => (v.charName || '') === charName);
        res(all.slice(-limit));
      };
      r.onerror = () => res([]);
    });
  } catch (e) { return []; }
}

/* 打开 LunaIdentityDB 只读，取绑定给该角色的用户身份资料 */
function pcOpenIdentityDB() {
  return new Promise((res, rej) => {
    const probe = indexedDB.open('LunaIdentityDB');
    probe.onsuccess = e => { res(e.target.result); };
    probe.onerror = e => rej(e.target.error);
  });
}

async function pcLoadBoundUserIdentity(charId) {
  if (charId == null) return null;
  try {
    const db = await pcOpenIdentityDB();
    if (!db.objectStoreNames.contains('identities')) return null;
    return await new Promise(res => {
      const r = db.transaction('identities').objectStore('identities').getAll();
      r.onsuccess = () => {
        const list = r.result || [];
        const matches = list.filter(i => {
          const ids = Array.isArray(i.boundCharIds) ? i.boundCharIds : (i.boundCharId ? [i.boundCharId] : []);
          return ids.includes(charId);
        });
        if (!matches.length) { res(null); return; }
        const active = matches.find(i => i.active);
        res(active || matches[0]);
      };
      r.onerror = () => res(null);
    });
  } catch (e) { return null; }
}

function pcBuildUserIdentityLine(identity) {
  if (!identity) return '';
  const parts = [];
  if (identity.name) parts.push(`名字是${identity.name}`);
  if (identity.role) parts.push(`身份是${identity.role}`);
  if (identity.desc) parts.push(`背景：${identity.desc}`);
  if (Array.isArray(identity.tags) && identity.tags.length) parts.push(`标签：${identity.tags.join('、')}`);
  return parts.length ? parts.join('，') : '';
}

/* 组装 system prompt：人设 + 用户资料 + 最近聊天摘要 + 最近通话摘要，
   要求只输出一句锁屏气泡短语，符合人设口吻 */
async function pcBuildBubblePrompt(char) {
  const name    = char?.name    || '';
  const persona = char?.persona || char?.description || char?.desc || '';
  const traits  = char?.traits  || char?.personality || '';
  const bg      = char?.background || char?.story || '';

  const [recentMsgs, recentCalls, identity] = await Promise.all([
    pcLoadRecentMessages(name, 12),
    pcLoadRecentCallLogs(name, 2),
    pcLoadBoundUserIdentity(char?.id),
  ]);

  const chatSummary = recentMsgs.map(m => {
    const role = m.role === 'mine' ? '用户' : name;
    const text = m.isVoice ? (m.voiceText || m.text) : (m.text || (m.isMeme ? '[表情包]' : ''));
    return text ? `${role}：${text}` : '';
  }).filter(Boolean).join('\n');

  const callSummary = recentCalls.map(v => {
    const t = (v.transcript || []).map(e => e.text).filter(Boolean).slice(-4).join('；');
    return t ? `一通视频通话中提到：${t}` : '';
  }).filter(Boolean).join('\n');

  const identityLine = pcBuildUserIdentityLine(identity);

  const systemPrompt = `你是「${name}」本人，绝不是 AI 或助手。
人物简介：${persona}
性格特点：${traits}
背景故事：${bg}
${identityLine ? `和你关系亲近的这个人：${identityLine}` : ''}

你现在人不在，手机屏幕锁屏前留下了一句此刻的心情/念头/小提醒，会显示在手机主屏的一个小气泡里，像"锁屏小组件"一样，让对方一打开手机就能看到你此刻的状态。

要求：
- 只输出一句话，8-22个字之间，第一人称，口语化，绝不加引号、不加任何前缀、不加标点堆砌
- 内容要符合你的人设口吻和性格，可以是此刻的心情、对刚才聊天/通话的余韵、一句念叨、一个小提醒或期待
- 如果最近有聊天或通话记录，可以自然带入其中的情绪或话题余韵，但不要直接复述对话内容
- 不要出现"AI""系统""手机""气泡""组件"这类跳出角色的词
- 绝不能是问候语模板（不要"在吗""想你了"这种烂大街的句子，要更具体、更有这个人的味道）`;

  const userPrompt = `最近的聊天片段（可能为空）：
${chatSummary || '（暂无聊天记录）'}

${callSummary ? `最近的通话片段：\n${callSummary}` : ''}

请写下这句锁屏气泡文案。`;

  return { systemPrompt, userPrompt };
}

async function pcGenerateBubbleText(char) {
  try {
    const { systemPrompt, userPrompt } = await pcBuildBubblePrompt(char);
    const raw = await pcCallApi(systemPrompt, [{ role: 'user', content: userPrompt }]);
    return (raw || '').replace(/^["“'‘]+|["”'’]+$/g, '').trim();
  } catch (e) {
    return '';
  }
}

/* 把文案渲染进气泡 DOM */
function pcRenderBubbleText(text) {
  const el = document.querySelector('.cloud-bubble .text-placeholder');
  const sub = document.querySelector('.cloud-bubble .text-sub');
  if (el && text) {
    el.innerHTML = escapePcHtml(text).replace(/\n/g, '<br>');
  }
  if (sub) sub.textContent = 'Tap to refresh';
}

/* 气泡缓存读写（IndexedDB assets 表，按角色 id 隔离） */
async function pcLoadBubbleCache(charId) {
  return await idbGet(pcBubbleKey(charId));
}
async function pcSaveBubbleCache(charId, text) {
  await idbSet(pcBubbleKey(charId), { text, ts: Date.now() });
}

/* 对外统一入口：
   - 有缓存 -> 直接展示缓存（不调用 AI，避免每次进入都调用一次生成）
   - 无缓存（首次进入这个角色的手机）-> 调用一次 AI 生成并落缓存
   - 用户点击气泡 -> 强制重新生成并覆盖缓存 */
let pcBubbleLoading = false;

async function pcInitBubble(char) {
  if (!char) return;
  const cached = await pcLoadBubbleCache(char.id);
  if (cached && cached.text) {
    pcRenderBubbleText(cached.text);
    return;
  }
  await pcRefreshBubble(char, /*isInitial*/true);
}

async function pcRefreshBubble(char, isInitial) {
  if (!char || pcBubbleLoading) return;
  pcBubbleLoading = true;

  const el = document.querySelector('.cloud-bubble .text-placeholder');
  const sub = document.querySelector('.cloud-bubble .text-sub');
  if (el) el.style.opacity = '0.4';
  if (sub) sub.textContent = '正在想…';

  const text = await pcGenerateBubbleText(char);

  if (text) {
    await pcSaveBubbleCache(char.id, text);
    pcRenderBubbleText(text);
  } else {
    // 生成失败（多半是未配置 API）时，保留一句友好占位，不覆盖已有缓存
    if (el && isInitial) el.innerHTML = `今天也要<br>好好生活呀`;
    if (sub) sub.textContent = 'Tap to refresh';
  }
  if (el) el.style.opacity = '1';
  pcBubbleLoading = false;
}

/* 点击气泡 -> 用户主动要求重新生成一句 */
function pcBindBubbleClick() {
  const bubble = document.querySelector('.cloud-bubble');
  if (!bubble) return;
  bubble.style.cursor = 'pointer';
  bubble.addEventListener('click', (e) => {
    if (body.classList.contains('edit-mode')) return; // 编辑模式下交给组件背景替换逻辑
    e.stopPropagation();
    if (!PC_CHAR) return;
    pcRefreshBubble(PC_CHAR, false);
  });
}

/* ==========================================================
   便签组件内容：根据计划 / 秘密 / 备忘录等记忆填充文字，
   替换掉原来的三条灰色占位条

   【保密原则 —— 必须遵守】
   这是锁屏小组件性质的东西，只应该露出"含蓄、模糊、有生活感"的
   记忆碎片，绝不能：
   - 直接摘抄/复述人设简介、性格设定等本该保密的角色设定原文
   - 直接摘抄"秘密"档案（haze）里角色心事的原始猜测文本
   - 直接摘抄"计划"档案（chronicle）里故事标题的具体细节
   这些都是"当事人自己会写给自己看的一句提示"，而不是"资料卡摘要"，
   所以一律不使用原始字段拼接展示，而是把原始素材喂给 AI，
   要求它改写成模糊、留白、只有当事人自己能懂的一句话。
   ========================================================== */

async function pcLoadNoteEntries(charName) {
  // koukan（叩问档案）/ chronicle（幕后志）/ haze（迷雾困惑）都是与 chatroom.js
  // 同一个 LunaChatDB 里、按角色名存一条记录、entries 数组结构一致，这里只读取。
  try {
    const db = await pcOpenChatDB();
    const stores = ['koukan', 'chronicle', 'haze'].filter(s => db.objectStoreNames.contains(s));
    if (!stores.length) return { koukan: [], chronicle: [], haze: [] };
    const tx = db.transaction(stores, 'readonly');
    const results = await Promise.all(stores.map(s => new Promise(res => {
      const r = tx.objectStore(s).get(charName);
      r.onsuccess = () => res((r.result && r.result.entries) || []);
      r.onerror   = () => res([]);
    })));
    const out = { koukan: [], chronicle: [], haze: [] };
    stores.forEach((s, i) => { out[s] = results[i]; });
    return out;
  } catch (e) { return { koukan: [], chronicle: [], haze: [] }; }
}

/* 便签内容缓存：和气泡一样，按角色 id 隔离，只在没有缓存时才调用一次 AI 改写，
   避免每次进入都重新生成、也避免和气泡抢同一时间的网络请求 */
const PC_NOTE_STORE_PREFIX = 'pc_note_';
function pcNoteKey(charId) { return PC_NOTE_STORE_PREFIX + charId; }
async function pcLoadNoteCache(charId) { return await idbGet(pcNoteKey(charId)); }
async function pcSaveNoteCache(charId, lines) { await idbSet(pcNoteKey(charId), { lines, ts: Date.now() }); }

/* 把三类原始素材喂给 AI，要求改写成"只有当事人自己能看懂的模糊提示"，
   而不是把人设/秘密/计划原文透出去 */
async function pcGenerateNoteLines(char) {
  const persona = char.persona || char.description || char.desc || '';
  const traits  = char.traits  || char.personality || '';
  const { koukan, chronicle, haze } = await pcLoadNoteEntries(char.name);

  const chronicleTitle = chronicle.length ? (chronicle[chronicle.length - 1]?.title || '') : '';
  const hazeGuess = (() => {
    if (!haze.length) return '';
    const items = (haze[haze.length - 1] && haze[haze.length - 1].items) || [];
    const unresolved = items.find(it => !it.resolved) || items[0];
    return unresolved ? (unresolved.guessZh || unresolved.guess || '') : '';
  })();
  const koukanQuestion = koukan.length ? (koukan[koukan.length - 1]?.question || '') : '';

  // 完全没有素材时不调用 AI，直接走本地占位（下面 pcFillNoteWidget 兜底处理）
  if (!persona && !traits && !chronicleTitle && !hazeGuess && !koukanQuestion) return null;

  const systemPrompt = `你是「${char.name}」本人写给自己看的私人备忘系统，绝不是 AI 或助手。
下面会给你一些关于这个人的私密素材（性格设定、正在进行的故事计划、心里藏着的秘密、一个还没问出口的问题）。
这些素材本身绝对不能被泄露、被复述、被摘抄出来给别人看到——你要做的是把每一类素材都改写成"只有本人自己才看得懂"的一句极简、含蓄、留白的私人备忘/暗号，
就像一个人给自己写的便签，别人即使看到这句话，也完全猜不出具体内容是什么，只能感受到一种氛围或心情。

严格规则：
- 绝不能出现素材里的具体人名、具体事件细节、具体设定描述，只能是情绪化、意象化、模糊的短句
- 每条不超过12个字
- 不要用"关于TA""我的秘密"这类会暴露"这是资料"的说法
- 只输出 JSON，不要任何多余文字、不要 markdown 代码块`;

  const userPrompt = `性格/人设参考（禁止直接使用或改写后仍可辨认出原文）：${persona} ${traits}
正在进行的计划/故事（禁止透出标题细节）：${chronicleTitle || '（暂无）'}
藏着的心事/秘密（禁止透出具体猜测内容）：${hazeGuess || '（暂无）'}
还没问出口的一个念头（禁止直接引用）：${koukanQuestion || '（暂无）'}

请分别为"计划"、"秘密"、"惦记"这三类，各生成一句极简模糊的私人备忘（如果对应素材为空，就写一句符合这个人性格、泛泛而不具体的心情小句，同样不能具体到任何设定细节）。
输出格式（只输出这个 JSON）：
{"plan":"计划类的一句","secret":"秘密类的一句","miss":"惦记类的一句"}`;

  try {
    const raw = await pcCallApi(systemPrompt, [{ role: 'user', content: userPrompt }]);
    const clean = raw.replace(/```json|```/g, '').trim();
    const data = JSON.parse(clean);
    const lines = [];
    if (data.plan)   lines.push({ label: '计划', text: pcTruncate(data.plan, 16) });
    if (data.secret) lines.push({ label: '心事', text: pcTruncate(data.secret, 16) });
    if (data.miss)   lines.push({ label: '惦记', text: pcTruncate(data.miss, 16) });
    return lines.length ? lines : null;
  } catch (e) {
    return null;
  }
}

function pcTruncate(s, n) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function pcRenderNoteLines(lines) {
  const noteContent = document.querySelector('.note-content');
  if (!noteContent) return;
  noteContent.querySelector('.note-lines')?.remove();
  const wrap = document.createElement('div');
  wrap.className = 'note-lines pc-note-lines';
  wrap.innerHTML = lines.slice(0, 3).map(l => `
    <div class="pc-note-line">
      <span class="pc-note-label">${escapePcHtml(l.label)}</span>
      <span class="pc-note-text">${escapePcHtml(l.text)}</span>
    </div>
  `).join('');
  noteContent.appendChild(wrap);
}

/* 对外入口：
   - 立刻用本地占位渲染一版，绝不等待网络，保证便签"秒出"，不会显得慢
   - 有缓存 -> 用缓存覆盖占位（仍然是本地读取，几乎瞬时）
   - 无缓存（首次进入这个角色）-> 占位先显示，AI 改写在后台异步进行，
     生成后再悄悄替换，不阻塞、不影响其他初始化流程 */
const PC_NOTE_FALLBACK = [
  { label: '计划', text: '还在慢慢想' },
  { label: '心事', text: '暂时不说' },
  { label: '惦记', text: '有一点点' },
];

async function pcFillNoteWidget(char) {
  const noteContent = document.querySelector('.note-content');
  if (!noteContent || !char) return;

  // 第一时间用占位渲染，不等待任何异步操作
  pcRenderNoteLines(PC_NOTE_FALLBACK);

  // 有缓存就立刻用缓存覆盖（本地 IndexedDB 读取很快，不算"调用生成"）
  const cached = await pcLoadNoteCache(char.id);
  if (cached && Array.isArray(cached.lines) && cached.lines.length) {
    pcRenderNoteLines(cached.lines);
    return;
  }

  // 没有缓存：后台异步生成一次，完成后再替换，不阻塞页面其他部分
  pcGenerateNoteLines(char).then(lines => {
    if (lines) {
      pcSaveNoteCache(char.id, lines);
      pcRenderNoteLines(lines);
    }
  }).catch(() => {});
}

/* ==========================================================
   Dock 中间 Home 按钮 —— 点击返回 charphone.html 设备陈列页
   dock3（房子图标）承担 Home 语义
   ========================================================== */

function pcBindHomeButton() {
  const homeIcon = document.querySelector('.dock-icon[data-icon-key="dock3"]');
  if (!homeIcon) return;
  const dockItem = homeIcon.closest('.dock-item') || homeIcon;
  dockItem.addEventListener('click', (e) => {
    if (body.classList.contains('edit-mode')) return; // 编辑模式下交给图标替换逻辑
    if (justLongPressed) return;
    e.preventDefault();
    e.stopPropagation();

    const mask = document.createElement('div');
    mask.style.cssText = 'position:fixed;inset:0;background:rgba(245,245,245,0.97);opacity:0;z-index:9999;transition:opacity 0.28s ease;pointer-events:all;';
    document.body.appendChild(mask);
    requestAnimationFrame(() => { mask.style.opacity = '1'; });
    setTimeout(() => { window.location.href = 'charphone.html'; }, 260);
  });
}

/* ==========================================================
   角色专属初始化总入口
   ========================================================== */

async function pcInitCharacter() {
  const char = await pcLoadActiveChar();
  PC_CHAR = char;

  if (!char) {
    // 没有任何角色数据（比如直接打开本页、还没在 charphone.html 选过设备），
    // 保留页面默认占位内容，不报错、不跳转，避免用户困惑。
    return;
  }

  pcApplyAvatar(char);
  pcBindBubbleClick();
  // 气泡文案（可能需要调用 AI）与便签内容（本地占位优先、AI 改写异步进行）
  // 并行触发，互不等待，避免其中一个变慢就拖慢另一个的呈现
  pcInitBubble(char).catch(() => {});
  pcFillNoteWidget(char).catch(() => {});
}

pcBindHomeButton();
restoreSavedCustomizations().catch((e) => console.error('恢复自定义素材失败', e));
pcInitCharacter().catch((e) => console.error('角色初始化失败', e));