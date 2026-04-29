/* ============================================
   Beautify Studio — beautify.js
============================================ */

// ---- 入场动画 ----
window.addEventListener('DOMContentLoaded', () => {
  const mask = document.getElementById('btMask');
  requestAnimationFrame(() => {
    mask.classList.add('hidden');
  });

  initTabs();
  initCards();
  initData();
  updateTime();
  setInterval(updateTime, 1000);
  updateBattery();
  applyIsland();
  applyGlobalFont();
});

// ---- Tab 切换 ----
function initTabs() {
  const tabs = document.querySelectorAll('.bt-tab');
  const panels = document.querySelectorAll('.bt-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById('tab-' + tab.dataset.tab);
      if (target) target.classList.add('active');
    });
  });
}

// ---- 返回按钮 ----
document.getElementById('btBack').addEventListener('click', () => {
  const mask = document.getElementById('btMask');
  mask.classList.remove('hidden');
  setTimeout(() => { window.location.href = 'index.html'; }, 300);
});

// ---- 组件卡片路由 ----
const widgetRoutes = {
  weather: () => openWeatherSettings(),
  music: () => wmOpen(),
  countdown:    () => openCountdownSettings(),
  profile:      () => openProfileSettings(),
  chat:         () => showToast('聊天组件设置 — 即将开放'),
  photodiary:   () => showToast('日记本组件设置 — 即将开放'),
  lunaprofile:  () => showToast('Luna 名片组件设置 — 即将开放'),
  icons:        () => navigateTo('iconbeauty.html'),
  wallpaper:    () => navigateTo('Wallpaper.html'),
};

function initCards() {
  document.querySelectorAll('.bt-card[data-target]').forEach(card => {
    card.addEventListener('click', () => {
      const fn = widgetRoutes[card.dataset.target];
      if (fn) fn();
    });
  });
}

function navigateTo(url) {
  const mask = document.getElementById('btMask');
  mask.classList.remove('hidden');
  setTimeout(() => { window.location.href = url; }, 300);
}

// 预留：各组件设置面板触发函数（后续在此扩展）
function openWeatherSettings() { wwOpen(); }
function openMusicSettings()     { showToast('音乐组件设置 — 即将开放'); }
function openCountdownSettings() { openCdPanel(); }

/* ============ 倒数日面板 ============ */
let _cd = {};

function openCdPanel() {
  document.getElementById('cdOverlay').style.display = 'block';
  document.getElementById('cdPanel').style.transform = 'translateX(0)';
  cdLoadPanel();
}
function closeCdPanel() {
  document.getElementById('cdOverlay').style.display = 'none';
  document.getElementById('cdPanel').style.transform = 'translateX(100%)';
}

async function cdLoadPanel() {
  _cd = await cdLoadDB();
  if (_cd.date)       document.getElementById('cdDateInput').value       = _cd.date;
  if (_cd.eyebrow)    document.getElementById('cdEyebrowInput').value    = _cd.eyebrow;
  if (_cd.unit)       document.getElementById('cdUnitInput').value       = _cd.unit;
  if (_cd.event)      document.getElementById('cdEventInput').value      = _cd.event;
  if (_cd.dateLabel)  document.getElementById('cdDateLabelInput').value  = _cd.dateLabel;
  if (_cd.opacity !== undefined) {
    document.getElementById('cdOpacitySlider').value = _cd.opacity;
    document.getElementById('cdOpacityVal').textContent = _cd.opacity;
  }
  if (_cd.pol1) { const d=document.getElementById('cdPrevPol1'); d.style.background='none'; d.innerHTML=`<img src="${_cd.pol1}" style="width:100%;height:100%;object-fit:cover;"/>`; }
  if (_cd.pol2) { const d=document.getElementById('cdPrevPol2'); d.style.background='none'; d.innerHTML=`<img src="${_cd.pol2}" style="width:100%;height:100%;object-fit:cover;"/>`; }
  if (_cd.bgImage) {
    document.getElementById('cdBgPreview').style.display = 'block';
    document.getElementById('cdBgThumb').src = _cd.bgImage;
  }
  cdCalc();
  cdApplyBg();
}

function cdCalc() {
  const val = document.getElementById('cdDateInput').value;
  if (!val) return;
  const target = new Date(val);
  const today  = new Date(); today.setHours(0,0,0,0);
  const diff   = Math.round((target - today) / 86400000);
  _cd.date = val;
  _cd.days = diff;
  document.getElementById('cdPrevNumber').textContent = Math.abs(diff);
  // 自动更新单位提示（不覆盖用户自定义）
  const unitEl = document.getElementById('cdUnitInput');
  if (!unitEl.value) {
    document.getElementById('cdPrevUnit').textContent = diff >= 0 ? 'days away' : 'days ago';
  }
  cdPreviewText();
}

function cdPreviewText() {
  const eyebrow   = document.getElementById('cdEyebrowInput').value;
  const unit      = document.getElementById('cdUnitInput').value;
  const event     = document.getElementById('cdEventInput').value;
  const dateLabel = document.getElementById('cdDateLabelInput').value;
  const diff      = _cd.days;
  if (eyebrow)   document.getElementById('cdPrevEyebrow').textContent = eyebrow;
  if (unit)      document.getElementById('cdPrevUnit').textContent    = unit;
  else if (diff !== undefined) document.getElementById('cdPrevUnit').textContent = diff >= 0 ? 'days away' : 'days ago';
  if (event)     document.getElementById('cdPrevEvent').textContent   = event;
  if (dateLabel) document.getElementById('cdPrevDate').textContent    = dateLabel;
}

function cdPreviewOpacity(val) {
  document.getElementById('cdOpacityVal').textContent = val;
  _cd.opacity = parseInt(val);
  cdApplyBg();
}

function cdApplyBg() {
  const bg   = document.getElementById('cdPrevBg');
  const mask = document.getElementById('cdPrevMask');
  const alpha = (_cd.opacity !== undefined ? _cd.opacity : 65) / 100;
  if (_cd.bgImage) {
    bg.style.backgroundImage    = `url(${_cd.bgImage})`;
    bg.style.backgroundSize     = 'cover';
    bg.style.backgroundPosition = 'center';
    mask.style.background       = 'rgba(255,255,255,0)'; // 有图不受透明度影响
  } else {
    bg.style.backgroundImage = 'none';
    mask.style.background    = `rgba(255,255,255,${alpha})`;
  }
}

function cdHandlePol(input, idx) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const url = e.target.result;
    _cd['pol' + idx] = url;
    const d = document.getElementById('cdPrevPol' + idx);
    d.style.background = 'none';
    d.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;"/>`;
  };
  reader.readAsDataURL(file);
}

function cdHandleBg(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _cd.bgImage = e.target.result;
    document.getElementById('cdBgPreview').style.display = 'block';
    document.getElementById('cdBgThumb').src = _cd.bgImage;
    cdApplyBg();
  };
  reader.readAsDataURL(file);
}

function cdRemoveBg() {
  _cd.bgImage = null;
  document.getElementById('cdBgPreview').style.display = 'none';
  document.getElementById('cdBgInput').value = '';
  cdApplyBg();
}

function cdOpenDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('LunaCountdownDB', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('cd', { keyPath: 'id' });
    req.onsuccess = e => res(e.target.result);
    req.onerror = () => rej();
  });
}
async function cdLoadDB() {
  const db = await cdOpenDB();
  return new Promise(res => {
    const req = db.transaction('cd').objectStore('cd').get('widget');
    req.onsuccess = () => res(req.result || {});
    req.onerror   = () => res({});
  });
}
async function cdSave() {
  _cd.eyebrow   = document.getElementById('cdEyebrowInput').value.trim();
  _cd.unit      = document.getElementById('cdUnitInput').value.trim();
  _cd.event     = document.getElementById('cdEventInput').value.trim();
  _cd.dateLabel = document.getElementById('cdDateLabelInput').value.trim();
  _cd.opacity   = parseInt(document.getElementById('cdOpacitySlider').value);
  const db = await cdOpenDB();
  const tx = db.transaction('cd', 'readwrite');
  tx.objectStore('cd').put({ id: 'widget', ..._cd });
  tx.oncomplete = () => {
    localStorage.setItem('luna_countdown_update', Date.now().toString());
    showToast('已保存');
    setTimeout(() => closeCdPanel(), 800);
  };
  tx.onerror = () => showToast('保存失败');
}
function openProfileSettings()   { showToast('名片组件设置 — 即将开放'); }

// ---- 数据管理 ----
function initData() {
  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', importData);
  document.getElementById('resetBtn').addEventListener('click', resetData);
}

// 导出：localStorage + 所有 IndexedDB 数据
async function exportData() {
  showToast('正在打包数据…');

  const backup = {};

  // 1. localStorage
  backup.localStorage = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    backup.localStorage[key] = localStorage.getItem(key);
  }

  // 2. 壁纸 DB（applied + favorites）
  try {
    const wpDb = await new Promise((res, rej) => {
      const req = indexedDB.open('LunaWallpaperDB', 2);
      req.onsuccess = e => res(e.target.result);
      req.onerror = () => rej();
    });
    const wpAll = await new Promise(res => {
      const r = wpDb.transaction('data').objectStore('data').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => res([]);
    });
    backup.wallpaper = wpAll; // [{ key: 'applied', value: {...} }, { key: 'favorites', value: [...] }]
  } catch(e) { backup.wallpaper = []; }

  // 3. 图标 DB
  try {
    const ibDb = await new Promise((res, rej) => {
      const req = indexedDB.open('LunaIconBeautyDB', 2);
      req.onsuccess = e => res(e.target.result);
      req.onerror = () => rej();
    });
    const ibAll = await new Promise(res => {
      const r = ibDb.transaction('icons').objectStore('icons').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => res([]);
    });
    backup.icons = ibAll; // [{ appId: 'wallpaper', imageData: 'data:image/...' }, ...]
  } catch(e) { backup.icons = []; }

  // 4. 音乐 DB
  try {
    const muDb = await new Promise((res, rej) => {
      const req = indexedDB.open('LunaMusicDB', 2);
      req.onsuccess = e => res(e.target.result);
      req.onerror = () => rej();
    });
    // 尝试读取 music store（你的 DB store 名可能是 'music'，失败也不影响）
    const muAll = await new Promise(res => {
      try {
        const r = muDb.transaction('music').objectStore('music').getAll();
        r.onsuccess = () => res(r.result || []);
        r.onerror = () => res([]);
      } catch(e) { res([]); }
    });
    backup.music = muAll;
  } catch(e) { backup.music = []; }

  // 5. 字体 DB（字体文件本身，base64 会很大）
  try {
    const ftDb = await new Promise((res, rej) => {
      const req = indexedDB.open('LunaFontDB', 3);
      req.onsuccess = e => res(e.target.result);
      req.onerror = () => rej();
    });
    const ftAll = await new Promise(res => {
      const r = ftDb.transaction('fonts').objectStore('fonts').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => res([]);
    });
    backup.fonts = ftAll;
  } catch(e) { backup.fonts = []; }

  // 打包下载
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'luna-backup.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('导出完成！');
}

// 导入：还原 localStorage + 所有 IndexedDB
function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const backup = JSON.parse(ev.target.result);
      showToast('导入中，请稍候…');

      // 1. 还原 localStorage
      if (backup.localStorage) {
        Object.keys(backup.localStorage).forEach(key => {
          localStorage.setItem(key, backup.localStorage[key]);
        });
      } else {
        // 兼容旧版备份（直接是 key-value 的老格式）
        Object.keys(backup).forEach(key => {
          if (!['wallpaper','icons','music','fonts'].includes(key)) {
            localStorage.setItem(key, backup[key]);
          }
        });
      }

      // 2. 还原壁纸 DB
      if (backup.wallpaper && backup.wallpaper.length > 0) {
        const wpDb = await new Promise((res, rej) => {
          const req = indexedDB.open('LunaWallpaperDB', 2);
          req.onupgradeneeded = e => { e.target.result.createObjectStore('data', { keyPath: 'key' }); };
          req.onsuccess = e => res(e.target.result);
          req.onerror = () => rej();
        });
        await new Promise(res => {
          const tx = wpDb.transaction('data', 'readwrite');
          const store = tx.objectStore('data');
          backup.wallpaper.forEach(item => store.put(item));
          tx.oncomplete = () => res();
          tx.onerror = () => res();
        });
      }

      // 3. 还原图标 DB
      if (backup.icons && backup.icons.length > 0) {
        const ibDb = await new Promise((res, rej) => {
          const req = indexedDB.open('LunaIconBeautyDB', 2);
          req.onupgradeneeded = e => { e.target.result.createObjectStore('icons', { keyPath: 'appId' }); };
          req.onsuccess = e => res(e.target.result);
          req.onerror = () => rej();
        });
        await new Promise(res => {
          const tx = ibDb.transaction('icons', 'readwrite');
          const store = tx.objectStore('icons');
          backup.icons.forEach(item => store.put(item));
          tx.oncomplete = () => res();
          tx.onerror = () => res();
        });
      }

      // 4. 还原音乐 DB
      if (backup.music && backup.music.length > 0) {
        try {
          const muDb = await new Promise((res, rej) => {
            const req = indexedDB.open('LunaMusicDB', 2);
            req.onsuccess = e => res(e.target.result);
            req.onerror = () => rej();
          });
          await new Promise(res => {
            const tx = muDb.transaction('music', 'readwrite');
            const store = tx.objectStore('music');
            backup.music.forEach(item => store.put(item));
            tx.oncomplete = () => res();
            tx.onerror = () => res();
          });
        } catch(e) {}
      }

      // 5. 还原字体 DB
      if (backup.fonts && backup.fonts.length > 0) {
        const ftDb = await new Promise((res, rej) => {
          const req = indexedDB.open('LunaFontDB', 3);
          req.onupgradeneeded = e => { e.target.result.createObjectStore('fonts', { keyPath: 'id' }); };
          req.onsuccess = e => res(e.target.result);
          req.onerror = () => rej();
        });
        await new Promise(res => {
          const tx = ftDb.transaction('fonts', 'readwrite');
          const store = tx.objectStore('fonts');
          backup.fonts.forEach(item => store.put(item));
          tx.oncomplete = () => res();
          tx.onerror = () => res();
        });
      }

      showToast('导入成功，重新加载中…');
      setTimeout(() => window.location.reload(), 1400);

    } catch(err) {
      showToast('文件格式错误');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// 重置
function resetData() {
  if (!confirm('确定要清除所有自定义数据吗？')) return;
  localStorage.clear();
  showToast('已恢复默认设置');
}

// ---- Toast ----
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('btToast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---- 时间同步 ----
function updateTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const now = new Date();
  const str = now.toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  ['statusTime', 'wwStatusTime'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = str;
  });
}

// ---- 电池同步 ----
function updateBattery() {
  if (!navigator.getBattery) return;
  navigator.getBattery().then(b => {
    const pct = Math.round(b.level * 100);
    ['batPct','wwBatPct'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = pct;
    });
    ['batInner','wwBatInner'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.width = pct + '%';
    });
  });
}

// ---- 灵动岛同步 ----
function applyIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const targets = [
    document.getElementById('statusIsland'),
    document.getElementById('wwStatusIsland'),
    document.getElementById('wmStatusIsland')
  ];
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
  targets.forEach(el => {
    if (!el) return;
    el.innerHTML = enabled ? (styleMap[style] || styleMap.minimal) : '';
  });
}

// ---- 字体同步 ----
async function applyGlobalFont() {
  const name = localStorage.getItem('luna_font_active_name');
  const id   = parseInt(localStorage.getItem('luna_font_active_id'));

  // 从 IndexedDB 加载字体数据并注册到浏览器
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

  // 只注入字体名称，不注入颜色和字号
  let tag = document.getElementById('luna-font-override');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'luna-font-override';
    document.head.appendChild(tag);
  }
  const familyRule = name ? `font-family: '${name}', sans-serif !important;` : '';
  tag.textContent = familyRule ? `body, * { ${familyRule} }` : '';
}

/* ============================================
   天气组件设置面板 — ww
============================================ */

let _ww = { bgDataUrl: null, opacity: 100 };

async function wwOpen() {
  // 从 IndexedDB 读取已保存的设置（和 wwSave 存的地方一致）
  try {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open('LunaWeatherDB', 2);
      req.onupgradeneeded = e => {
        if (!e.target.result.objectStoreNames.contains('settings'))
          e.target.result.createObjectStore('settings', { keyPath: 'id' });
      };
      req.onsuccess = e => res(e.target.result);
      req.onerror = () => rej();
    });
    const saved = await new Promise((res, rej) => {
      const r = db.transaction('settings').objectStore('settings').get('weather');
      r.onsuccess = () => res(r.result || {});
      r.onerror = () => res({});
    });
    if (saved.opacity !== undefined) _ww.opacity = saved.opacity;
    if (saved.bgImage) _ww.bgDataUrl = saved.bgImage;
  } catch(e) {}

  wwApply();

  // 同步壁纸到底层预览
  const base = document.getElementById('wwWallpaperBase');
  if (base && _ww.bgDataUrl) {
    base.style.background = `url(${_ww.bgDataUrl}) center/cover no-repeat`;
  }
  // 没有组件背景图时，尝试读取主页壁纸作为底层预览背景
  try {
    const wpDb = await new Promise((res, rej) => {
      const req = indexedDB.open('LunaWallpaperDB', 2);
      req.onsuccess = e => res(e.target.result);
      req.onerror = () => rej();
    });
    const rec = await new Promise(res => {
      const r = wpDb.transaction('data').objectStore('data').get('applied');
      r.onsuccess = () => res(r.result);
      r.onerror  = () => res(null);
    });
    if (rec && rec.value && rec.value.dataUrl && base && !_ww.bgDataUrl) {
      base.style.background = `url(${rec.value.dataUrl}) center/cover no-repeat`;
    }
  } catch(e) {}

  // 同步到预览卡片
  wmPreviewSong(_wm.song || 'Super Shy');
  wmPreviewArtist(_wm.artist || 'NewJeans');
  if (_wm.coverImage) wmPreviewCover(_wm.coverImage);
  wmApplyBg();
// 同步灵动岛
const island = document.getElementById('wmStatusIsland');
if (island) {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const html = {
    minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
    clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text">${new Date().toLocaleTimeString('zh',{hour:'2-digit',minute:'2-digit',hour12:false})}</span></div></div>`,
    pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
    ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
    rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
    music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
    scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
  };
  island.innerHTML = enabled ? (html[style] || html.minimal) : '';
}

  document.getElementById('wwOverlay').classList.add('show');
  document.getElementById('wwPanel').classList.add('show');
}

function wwClose() {
  document.getElementById('wwOverlay').classList.remove('show');
  document.getElementById('wwPanel').classList.remove('show');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('wwClose').addEventListener('click', wwClose);
  document.getElementById('wwOverlay').addEventListener('click', wwClose);

});

function wwApply() {
  // 背景图
  if (_ww.bgDataUrl) {
  document.getElementById('wwBgThumb').src = _ww.bgDataUrl;
  document.getElementById('wwBgPreview').style.display = 'block';
} else {
  /* 没有背景图时，确保背景层是 rgba 白色，才能响应透明度滑块 */
  const bg = document.getElementById('wwCardBg');
  bg.style.backgroundImage = 'none';
  bg.style.backgroundColor = 'rgba(255,255,255,1)';
}

  // 透明度
  document.getElementById('wwOpacitySlider').value = _ww.opacity;
document.getElementById('wwOpacityNum').textContent = _ww.opacity;
wwApplyBg();
}

function wwHandleBg(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
  _ww.bgDataUrl = e.target.result;
  document.getElementById('wwBgThumb').src = e.target.result;
  document.getElementById('wwBgPreview').style.display = 'block';
  // 上传的图片同步到壁纸底层
  const base = document.getElementById('wwWallpaperBase');
  if (base) {
    base.style.background = `url(${e.target.result}) center/cover no-repeat`;
  }
  wwApplyBg();
};
  reader.readAsDataURL(file);
}

function wwRemoveBg() {
  _ww.bgDataUrl = null;
  document.getElementById('wwBgPreview').style.display = 'none';
  document.getElementById('wwBgInput').value = '';
  wwApplyBg();
}

function wwHandleOpacity(val) {
  _ww.opacity = parseInt(val);
  document.getElementById('wwOpacityNum').textContent = val;
  wwApplyBg();   // 统一由 wwApplyBg 处理
}

function wwApplyBg() {
  const bg = document.getElementById('wwCardBg');
  const alpha = _ww.opacity / 100;
  if (_ww.bgDataUrl) {
    bg.style.backgroundImage    = `url(${_ww.bgDataUrl})`;
    bg.style.backgroundColor    = 'transparent';
    bg.style.backgroundSize     = 'cover';
    bg.style.backgroundPosition = 'center';
    bg.style.opacity            = alpha;
  } else {
    bg.style.backgroundImage = 'none';
    bg.style.backgroundColor = `rgba(255,255,255,${alpha})`;
    bg.style.opacity         = 1;
  }

  // 黑色顶栏跟着透明度一起变
  const header = document.querySelector('#wwBpCard .bp-header');
  if (header) {
    header.style.background = `rgba(10,10,10,${alpha})`;
  }
}

function wwHandleGlass(on) {
  _ww.glassOn = on;
  document.getElementById('wwGlassControls').style.display = on ? 'block' : 'none';
  wwApplyGlass();
}

function wwHandleBlur(val) {
  _ww.blur = parseInt(val);
  document.getElementById('wwBlurNum').textContent = val;
  if (_ww.glassOn) wwApplyGlass();
}

function wwHandleSat(val) {
  _ww.sat = parseInt(val);
  document.getElementById('wwSatNum').textContent = val;
  if (_ww.glassOn) wwApplyGlass();
}

function wwSave() {
  const req = indexedDB.open('LunaWeatherDB', 2);
  req.onupgradeneeded = e => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains('settings')) {
      db.createObjectStore('settings', { keyPath: 'id' });
    }
  };
  req.onsuccess = e => {
    const db = e.target.result;
    const toSave = {
      id: 'weather',
      opacity: _ww.opacity,
      bgImage: _ww.bgDataUrl || null,
    };
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put(toSave);
    tx.oncomplete = () => {
      // 通知 index.html 刷新
      localStorage.setItem('luna_weather_widget_update', Date.now().toString());
      showToast('已保存');
      setTimeout(() => wwClose(), 800);
    };
    tx.onerror = () => showToast('保存失败');
  };
  req.onerror = () => showToast('保存失败，无法打开数据库');
}

/* ============================================
   音乐组件设置面板 — wm
============================================ */
let _wm = { coverImage: null, bgImage: null, opacity: 42, song: '', artist: '' };

async function wmOpen() {
  // 从 LunaMusicDB 读取已保存数据
  try {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open('LunaMusicDB', 2);
      req.onupgradeneeded = e => {
        if (!e.target.result.objectStoreNames.contains('music'))
          e.target.result.createObjectStore('music', { keyPath: 'id' });
      };
      req.onsuccess = e => res(e.target.result);
      req.onerror = () => rej();
    });
    const saved = await new Promise(res => {
      const r = db.transaction('music').objectStore('music').get('widget');
      r.onsuccess = () => res(r.result || {});
      r.onerror = () => res({});
    });
    if (saved.song)        _wm.song        = saved.song;
    if (saved.artist)      _wm.artist      = saved.artist;
    if (saved.coverImage)  _wm.coverImage  = saved.coverImage;
    if (saved.bgImage)     _wm.bgImage     = saved.bgImage;
    if (saved.opacity !== undefined) _wm.opacity = saved.opacity;
  } catch(e) {}

  // 填入面板
  document.getElementById('wmSongInput').value   = _wm.song   || '';
  document.getElementById('wmArtistInput').value = _wm.artist || '';
  document.getElementById('wmOpacitySlider').value    = _wm.opacity;
  document.getElementById('wmOpacityNum').textContent = _wm.opacity;

  if (_wm.coverImage) {
    document.getElementById('wmCoverPreview').innerHTML =
      `<img src="${_wm.coverImage}" style="width:72px;height:72px;object-fit:cover;border-radius:14px;display:block;"/>`;
  }
  if (_wm.bgImage) {
    document.getElementById('wmBgPreview').style.display = 'block';
    document.getElementById('wmBgThumb').src = _wm.bgImage;
  } else {
    document.getElementById('wmBgPreview').style.display = 'none';
  }

  wmApplyBg();

  document.getElementById('wmOverlay').style.display = 'block';
  document.getElementById('wmPanel').style.transform = 'translateX(0)';
}

function wmClose() {
  document.getElementById('wmOverlay').style.display = 'none';
  document.getElementById('wmPanel').style.transform = 'translateX(100%)';
}

function wmHandleCover(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _wm.coverImage = e.target.result;
    wmPreviewCover(e.target.result);
    document.getElementById('wmCoverPreview').innerHTML =
      `<img src="${e.target.result}" style="width:72px;height:72px;object-fit:cover;border-radius:14px;display:block;"/>`;
  };
  reader.readAsDataURL(file);
}

function wmHandleBg(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _wm.bgImage = e.target.result;
    document.getElementById('wmBgPreview').style.display = 'block';
    document.getElementById('wmBgThumb').src = e.target.result;
    wmApplyBg();
  };
  reader.readAsDataURL(file);
}

function wmRemoveBg() {
  _wm.bgImage = null;
  document.getElementById('wmBgPreview').style.display = 'none';
  document.getElementById('wmBgInput').value = '';
  wmApplyBg();
}

function wmHandleOpacity(val) {
  _wm.opacity = parseInt(val);
  document.getElementById('wmOpacityNum').textContent = val;
  wmApplyBg();
}

function wmApplyBg() {
  const bg   = document.getElementById('wmPreviewBg');
  const mask = document.getElementById('wmPreviewMask');
  const band = document.getElementById('wmPreviewBand');
  const alpha = _wm.opacity / 100;
  if (!bg || !mask || !band) return;

  if (_wm.bgImage) {
    bg.style.backgroundImage    = `url(${_wm.bgImage})`;
    bg.style.backgroundSize     = 'cover';
    bg.style.backgroundPosition = 'center';
    bg.style.backgroundColor    = 'transparent';
    mask.style.background       = 'rgba(255,255,255,0)';
    band.style.background       = `rgba(26,25,22,${alpha})`;  // ← 跟滑条联动
  } else {
    bg.style.backgroundImage = 'none';
    bg.style.backgroundColor = 'transparent';
    mask.style.background    = `rgba(255,255,255,${alpha})`;
    band.style.background    = '#1a1916';                      // ← 无背景图时保持不透明
  }
}

async function wmSave() {
  _wm.song   = document.getElementById('wmSongInput').value.trim();
  _wm.artist = document.getElementById('wmArtistInput').value.trim();

  const req = indexedDB.open('LunaMusicDB', 2);
  req.onupgradeneeded = e => {
    if (!e.target.result.objectStoreNames.contains('music'))
      e.target.result.createObjectStore('music', { keyPath: 'id' });
  };
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('music', 'readwrite');
    tx.objectStore('music').put({
      id: 'widget',
      song:        _wm.song,
      artist:      _wm.artist,
      coverImage:  _wm.coverImage,
      bgImage:     _wm.bgImage,
      opacity:     _wm.opacity,
    });
    tx.oncomplete = () => {
      localStorage.setItem('luna_music_widget_update', Date.now().toString());
      showToast('已保存');
      setTimeout(() => wmClose(), 800);
    };
    tx.onerror = () => showToast('保存失败');
  };
  req.onerror = () => showToast('保存失败，无法打开数据库');
}

function wmPreviewSong(val) {
  const el = document.getElementById('wmPreviewSong');
  if (el) el.textContent = val || 'Super Shy';
}
function wmPreviewArtist(val) {
  const el = document.getElementById('wmPreviewArtist');
  if (el) el.textContent = val || 'NewJeans';
}
function wmPreviewCover(url) {
  const el = document.getElementById('wmPreviewCover');
  if (el) el.innerHTML = `<img src="${url}" style="width:40px;height:40px;object-fit:cover;border-radius:9px;display:block;"/>`;
}