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
  friends: () => fwOpen(),
  countdown:    () => openCountdownSettings(),
magazine:     () => mgzOpen(),
  profile:      () => openProfileSettings(),
  chat:         () => showToast('聊天组件设置 — 即将开放'),
  photodiary:   () => pdwOpen(),
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
function openMagazineSettings()  { mgzOpen(); }

/* ============ 倒数日面板 ============ */
let _cd = {};

function openCdPanel() {
  document.getElementById('cdOverlay').style.display = 'block';
  document.getElementById('cdPanel').style.transform = 'translateX(0)';
  cdLoadPanel();
}
function cdClose() {
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
    document.getElementById('cdOpacityNum').textContent = _cd.opacity;
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
  document.getElementById('cdOpacityNum').textContent = val;
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
    setTimeout(() => cdClose(), 800);
  };
  tx.onerror = () => showToast('保存失败');
}
function openProfileSettings()   { pwOpen(); }

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
      const req = indexedDB.open('LunaMusicDB', 4);
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
            const req = indexedDB.open('LunaMusicDB', 4);
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
      const req = indexedDB.open('LunaWeatherDB', 4);
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

  // 同步灵动岛
  const island = document.getElementById('wwStatusIsland');
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
  const req = indexedDB.open('LunaWeatherDB', 4);
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
let _wm = { discLeftImage: null, discRightImage: null, bgImage: null, opacity: 100, song: '', artist: '' };

async function wmOpen() {
  try {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open('LunaMusicDB', 4);
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
    if (saved.song)            _wm.song            = saved.song;
    if (saved.artist)          _wm.artist          = saved.artist;
    if (saved.discLeftImage)   _wm.discLeftImage   = saved.discLeftImage;
    if (saved.discRightImage)  _wm.discRightImage  = saved.discRightImage;
    if (saved.bgImage)         _wm.bgImage         = saved.bgImage;
    if (saved.opacity !== undefined) _wm.opacity   = saved.opacity;
  } catch(e) {}

  document.getElementById('wmSongInput').value   = _wm.song   || '';
  document.getElementById('wmArtistInput').value = _wm.artist || '';
  document.getElementById('wmOpacitySlider').value    = _wm.opacity;
  document.getElementById('wmOpacityNum').textContent = _wm.opacity;

  if (_wm.discLeftImage) {
    wmApplyDiscPreview('left', _wm.discLeftImage);
  }
  if (_wm.discRightImage) {
    wmApplyDiscPreview('right', _wm.discRightImage);
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

function wmHandleDiscLeft(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _wm.discLeftImage = e.target.result;
    wmApplyDiscPreview('left', e.target.result);
  };
  reader.readAsDataURL(file);
}

function wmHandleDiscRight(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _wm.discRightImage = e.target.result;
    wmApplyDiscPreview('right', e.target.result);
  };
  reader.readAsDataURL(file);
}

function wmApplyDiscPreview(side, url) {
  if (side === 'left') {
    const el = document.getElementById('wmPrevDiscLeft');
    if (el) { el.style.backgroundImage = `url(${url})`; el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center'; }
    const thumb = document.getElementById('wmDiscLeftPreview');
    if (thumb) { thumb.style.backgroundImage = `url(${url})`; thumb.style.backgroundSize = 'cover'; thumb.style.backgroundPosition = 'center'; thumb.innerHTML = ''; }
  } else {
    const el = document.getElementById('wmPrevDiscRight');
    if (el) { el.style.backgroundImage = `url(${url})`; el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center'; }
    const thumb = document.getElementById('wmDiscRightPreview');
    if (thumb) { thumb.style.backgroundImage = `url(${url})`; thumb.style.backgroundSize = 'cover'; thumb.style.backgroundPosition = 'center'; thumb.innerHTML = ''; }
  }
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
  if (!bg) return;
  const alpha = _wm.opacity / 100;

  if (_wm.bgImage) {
    bg.style.backgroundImage    = `url(${_wm.bgImage})`;
    bg.style.backgroundSize     = 'cover';
    bg.style.backgroundPosition = 'center';
    bg.style.backgroundColor    = 'transparent';
    if (mask) mask.style.background = `rgba(255,255,255,${1 - alpha})`;
    const card = document.getElementById('wmPreviewCard');
    if (card) {
      card.style.background = `rgba(255,255,255,${1 - alpha})`;
      card.style.backdropFilter = alpha > 0.1 ? `blur(${Math.round(alpha * 20)}px)` : 'none';
    }
  } else {
    bg.style.backgroundImage = 'none';
    bg.style.backgroundColor = 'transparent';
    if (mask) mask.style.background = `rgba(255,255,255,${alpha})`;
    const card = document.getElementById('wmPreviewCard');
    if (card) {
      card.style.background = `rgba(255,255,255,${alpha})`;
      card.style.backdropFilter = alpha < 0.9 ? `blur(${Math.round((1 - alpha) * 30)}px)` : 'none';
    }
  }
}

async function wmSave() {
  _wm.song   = document.getElementById('wmSongInput').value.trim();
  _wm.artist = document.getElementById('wmArtistInput').value.trim();

  const req = indexedDB.open('LunaMusicDB', 4);
  req.onupgradeneeded = e => {
    if (!e.target.result.objectStoreNames.contains('music'))
      e.target.result.createObjectStore('music', { keyPath: 'id' });
  };
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('music', 'readwrite');
    tx.objectStore('music').put({
      id: 'widget',
      song:            _wm.song,
      artist:          _wm.artist,
      discLeftImage:   _wm.discLeftImage,
      discRightImage:  _wm.discRightImage,
      bgImage:         _wm.bgImage,
      opacity:         _wm.opacity,
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
  if (el) el.textContent = val || '七里香';
}
function wmPreviewArtist(val) {
  const el = document.getElementById('wmPreviewArtist');
  if (el) el.textContent = val || '周杰伦';
}

/* ============================================
   好友组件设置面板 — fw
============================================ */
let _fw = { avLeft: null, avRight: null, bgImage: null, opacity: 92, date: '', label: 'days together', sig: 'always on the same page' };

async function fwOpen() {
  try {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open('LunaFriendsDB', 1);
      req.onupgradeneeded = e => {
        if (!e.target.result.objectStoreNames.contains('fw'))
          e.target.result.createObjectStore('fw', { keyPath: 'id' });
      };
      req.onsuccess = e => res(e.target.result);
      req.onerror = () => rej();
    });
    const saved = await new Promise(res => {
      const r = db.transaction('fw').objectStore('fw').get('widget');
      r.onsuccess = () => res(r.result || {});
      r.onerror = () => res({});
    });
    if (saved.avLeft    !== undefined) _fw.avLeft   = saved.avLeft;
    if (saved.avRight   !== undefined) _fw.avRight  = saved.avRight;
    if (saved.bgImage   !== undefined) _fw.bgImage  = saved.bgImage;
    if (saved.opacity   !== undefined) _fw.opacity  = saved.opacity;
    if (saved.date)                    _fw.date     = saved.date;
    if (saved.label)                   _fw.label    = saved.label;
    if (saved.sig)                     _fw.sig      = saved.sig;
  } catch(e) {}

  // 填入面板
  document.getElementById('fwDateInput').value       = _fw.date  || '';
  document.getElementById('fwLabelInput').value      = _fw.label || '';
  document.getElementById('fwSigInput').value        = _fw.sig   || '';
  document.getElementById('fwOpacitySlider').value   = _fw.opacity;
  document.getElementById('fwOpacityNum').textContent = _fw.opacity;

  if (_fw.avLeft)  { fwApplyAvPreview('left',  _fw.avLeft);  }
  if (_fw.avRight) { fwApplyAvPreview('right', _fw.avRight); }
  if (_fw.bgImage) {
    document.getElementById('fwBgPreview').style.display = 'block';
    document.getElementById('fwBgThumb').src = _fw.bgImage;
  } else {
    document.getElementById('fwBgPreview').style.display = 'none';
  }

  fwPreviewText();
  fwCalcDays();
  fwApplyBg();

  // 同步状态栏
  fwSyncStatusBar();

  document.getElementById('fwOverlay').style.display = 'block';
  document.getElementById('fwPanel').style.transform = 'translateX(0)';
}

function fwClose() {
  document.getElementById('fwOverlay').style.display = 'none';
  document.getElementById('fwPanel').style.transform = 'translateX(100%)';
}

function fwSyncStatusBar() {
  // 时间
  const tz  = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  const el = document.getElementById('fwStatusTime');
  if (el) el.textContent = timeStr;

  // 灵动岛
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const islandEl = document.getElementById('fwStatusIsland');
  if (islandEl) {
    if (!enabled) { islandEl.innerHTML = ''; }
    else {
      const styleMap = {
        minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
        glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
        clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text">${timeStr}</span></div></div>`,
        pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
        ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
        rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
        music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
        scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
      };
      islandEl.innerHTML = styleMap[style] || styleMap.minimal;
    }
  }

  // 电量
  const batPct = document.getElementById('fwBatPct');
  const batInner = document.getElementById('fwBatInner');
  if ('getBattery' in navigator) {
    navigator.getBattery().then(b => {
      const p = Math.round(b.level * 100);
      if (batPct) batPct.textContent = p;
      if (batInner) {
        batInner.style.width = p + '%';
        batInner.style.background = p <= 20 ? 'linear-gradient(90deg,#f87171,#ef4444)' : 'linear-gradient(90deg,#6ee7b7,#34d399)';
      }
    });
  } else {
    if (batPct) batPct.textContent = '76';
    if (batInner) { batInner.style.width = '76%'; batInner.style.background = 'linear-gradient(90deg,#6ee7b7,#34d399)'; }
  }
}

function fwCalcDays() {
  const val = document.getElementById('fwDateInput').value;
  if (!val) return;
  _fw.date = val;
  const start = new Date(val);
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((today - start) / 86400000);
  _fw.days = diff;
  const el = document.getElementById('fwPrevDays');
  if (el) el.textContent = Math.abs(diff);
}

function fwPreviewText() {
  const label = document.getElementById('fwLabelInput').value;
  const sig   = document.getElementById('fwSigInput').value;
  if (label) { const el = document.getElementById('fwPrevLbl'); if (el) el.textContent = label; }
  if (sig)   { const el = document.getElementById('fwPrevSig'); if (el) el.textContent = sig; }
  _fw.label = label;
  _fw.sig   = sig;
}

function fwHandleAv(input, side) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const url = e.target.result;
    if (side === 'left')  _fw.avLeft  = url;
    else                  _fw.avRight = url;
    fwApplyAvPreview(side, url);
  };
  reader.readAsDataURL(file);
}

function fwApplyAvPreview(side, url) {
  const previewId = side === 'left' ? 'fwPrevAvL' : 'fwPrevAvR';
  const thumbId   = side === 'left' ? 'fwAvLThumb' : 'fwAvRThumb';
  const previewEl = side === 'left' ? 'fwAvLPreview' : 'fwAvRPreview';
  const prev = document.getElementById(previewId);
  if (prev) {
    prev.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;
  }
  const thumb = document.getElementById(thumbId);
  if (thumb) thumb.src = url;
  const previewDiv = document.getElementById(previewEl);
  if (previewDiv) previewDiv.style.display = 'block';
}

function fwRemoveAv(side) {
  if (side === 'left') {
    _fw.avLeft = null;
    document.getElementById('fwAvLPreview').style.display = 'none';
    document.getElementById('fwAvLInput').value = '';
    const el = document.getElementById('fwPrevAvL');
    if (el) el.innerHTML = 'L';
  } else {
    _fw.avRight = null;
    document.getElementById('fwAvRPreview').style.display = 'none';
    document.getElementById('fwAvRInput').value = '';
    const el = document.getElementById('fwPrevAvR');
    if (el) el.innerHTML = 'M';
  }
}

function fwHandleBg(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _fw.bgImage = e.target.result;
    document.getElementById('fwBgPreview').style.display = 'block';
    document.getElementById('fwBgThumb').src = e.target.result;
    fwApplyBg();
  };
  reader.readAsDataURL(file);
}

function fwRemoveBg() {
  _fw.bgImage = null;
  document.getElementById('fwBgPreview').style.display = 'none';
  document.getElementById('fwBgInput').value = '';
  fwApplyBg();
}

function fwPreviewOpacity(val) {
  _fw.opacity = parseInt(val);
  document.getElementById('fwOpacityNum').textContent = val;
  fwApplyBg();
}

function fwApplyBg() {
  const bg   = document.getElementById('fwPreviewBg');
  const mask = document.getElementById('fwPreviewMask');
  if (!bg || !mask) return;
  const alpha = _fw.opacity / 100;

  if (_fw.bgImage) {
    bg.style.backgroundImage    = `url(${_fw.bgImage})`;
    bg.style.backgroundSize     = 'cover';
    bg.style.backgroundPosition = 'center';
    mask.style.background       = `rgba(255,255,255,${alpha})`;
    mask.style.backdropFilter   = alpha < 0.5 ? `blur(${Math.round((1 - alpha) * 24)}px)` : 'blur(24px)';
    mask.style.webkitBackdropFilter = mask.style.backdropFilter;
  } else {
    bg.style.backgroundImage = 'none';
    mask.style.background    = `rgba(255,255,255,${alpha})`;
    mask.style.backdropFilter = `blur(24px)`;
    mask.style.webkitBackdropFilter = 'blur(24px)';
  }
}

async function fwSave() {
  _fw.label = document.getElementById('fwLabelInput').value.trim();
  _fw.sig   = document.getElementById('fwSigInput').value.trim();
  _fw.date  = document.getElementById('fwDateInput').value;
  _fw.opacity = parseInt(document.getElementById('fwOpacitySlider').value);

  const req = indexedDB.open('LunaFriendsDB', 1);
  req.onupgradeneeded = e => {
    if (!e.target.result.objectStoreNames.contains('fw'))
      e.target.result.createObjectStore('fw', { keyPath: 'id' });
  };
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('fw', 'readwrite');
    tx.objectStore('fw').put({
      id:       'widget',
      avLeft:   _fw.avLeft,
      avRight:  _fw.avRight,
      bgImage:  _fw.bgImage,
      opacity:  _fw.opacity,
      date:     _fw.date,
      label:    _fw.label,
      sig:      _fw.sig,
    });
    tx.oncomplete = () => {
      localStorage.setItem('luna_friends_widget_update', Date.now().toString());
      showToast('已保存');
      setTimeout(() => fwClose(), 800);
    };
    tx.onerror = () => showToast('保存失败');
  };
  req.onerror = () => showToast('保存失败，无法打开数据库');
}

/* ============================================
   杂志组件设置面板 — mgz
============================================ */
let _mgz = { photo1:null, photo2:null, photo3:null, bgImage:null, opacity:100,
             num:'No. 01 · Edition', title1:'Quiet', title2:'Luxury',
             sub:'Luna · Maison', footerL:'SS · 2026', footerR:'LUNA' };

async function mgzOpen() {
  try {
    const db = await new Promise((res,rej) => {
      const req = indexedDB.open('LunaMagazineDB', 1);
      req.onupgradeneeded = e => { if(!e.target.result.objectStoreNames.contains('mgz')) e.target.result.createObjectStore('mgz',{keyPath:'id'}); };
      req.onsuccess = e => res(e.target.result);
      req.onerror = () => rej();
    });
    const saved = await new Promise(res => {
      const r = db.transaction('mgz').objectStore('mgz').get('widget');
      r.onsuccess = () => res(r.result || {});
      r.onerror = () => res({});
    });
    ['photo1','photo2','photo3','bgImage','opacity','num','title1','title2','sub','footerL','footerR'].forEach(k => {
      if (saved[k] !== undefined && saved[k] !== null) _mgz[k] = saved[k];
    });
  } catch(e) {}

  // 填入面板
  document.getElementById('mgzNumInput').value     = _mgz.num     || '';
  document.getElementById('mgzTitle1Input').value  = _mgz.title1  || '';
  document.getElementById('mgzTitle2Input').value  = _mgz.title2  || '';
  document.getElementById('mgzSubInput').value     = _mgz.sub     || '';
  document.getElementById('mgzFooterLInput').value = _mgz.footerL || '';
  document.getElementById('mgzFooterRInput').value = _mgz.footerR || '';
  document.getElementById('mgzOpacitySlider').value    = _mgz.opacity;
  document.getElementById('mgzOpacityNum').textContent = _mgz.opacity;

  [1,2,3].forEach(i => {
    if (_mgz['photo'+i]) {
      document.getElementById('mgzP'+i+'Preview').style.display = 'block';
      document.getElementById('mgzP'+i+'Thumb').src = _mgz['photo'+i];
      mgzApplyPhoto(i, _mgz['photo'+i]);
    }
  });
  if (_mgz.bgImage) {
    document.getElementById('mgzBgPreview').style.display = 'block';
    document.getElementById('mgzBgThumb').src = _mgz.bgImage;
  } else {
    document.getElementById('mgzBgPreview').style.display = 'none';
  }

  mgzPreviewText();
  mgzApplyBg();
  mgzSyncStatusBar();

  document.getElementById('mgzOverlay').style.display = 'block';
  document.getElementById('mgzPanel').style.transform = 'translateX(0)';
}

function mgzClose() {
  document.getElementById('mgzOverlay').style.display = 'none';
  document.getElementById('mgzPanel').style.transform = 'translateX(100%)';
}

function mgzSyncStatusBar() {
  const tz  = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-CN',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false});
  const el = document.getElementById('mgzStatusTime');
  if (el) el.textContent = timeStr;

  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const islandEl = document.getElementById('mgzStatusIsland');
  if (islandEl) {
    if (!enabled) { islandEl.innerHTML = ''; }
    else {
      const styleMap = {
        minimal:`<div class="si-minimal"><div class="si-capsule"></div></div>`,
        glow:`<div class="si-glow"><div class="si-capsule"></div></div>`,
        clock:`<div class="si-clock"><div class="si-capsule"><span class="si-clock-text">${timeStr}</span></div></div>`,
        pulse:`<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
        ripple:`<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
        rainbow:`<div class="si-rainbow"><div class="si-capsule"></div></div>`,
        music:`<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
        scan:`<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
      };
      islandEl.innerHTML = styleMap[style] || styleMap.minimal;
    }
  }

  const batPct = document.getElementById('mgzBatPct');
  const batInner = document.getElementById('mgzBatInner');
  if ('getBattery' in navigator) {
    navigator.getBattery().then(b => {
      const p = Math.round(b.level*100);
      if (batPct) batPct.textContent = p;
      if (batInner) { batInner.style.width=p+'%'; batInner.style.background=p<=20?'linear-gradient(90deg,#f87171,#ef4444)':'linear-gradient(90deg,#6ee7b7,#34d399)'; }
    });
  } else {
    if (batPct) batPct.textContent='76';
    if (batInner) { batInner.style.width='76%'; batInner.style.background='linear-gradient(90deg,#6ee7b7,#34d399)'; }
  }
}

function mgzHandlePhoto(input, idx) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const url = e.target.result;
    _mgz['photo'+idx] = url;
    document.getElementById('mgzP'+idx+'Preview').style.display = 'block';
    document.getElementById('mgzP'+idx+'Thumb').src = url;
    mgzApplyPhoto(idx, url);
  };
  reader.readAsDataURL(file);
}

function mgzApplyPhoto(idx, url) {
  const idMap = { 1:'mgzPrevPhoto1', 2:'mgzPrevPhoto2', 3:'mgzPrevPhoto3' };
  const el = document.getElementById(idMap[idx]);
  if (!el) return;
  el.style.backgroundImage = `url(${url})`;
  el.style.backgroundSize = 'cover';
  el.style.backgroundPosition = 'center';
  el.innerHTML = '';
}

function mgzRemovePhoto(idx) {
  _mgz['photo'+idx] = null;
  document.getElementById('mgzP'+idx+'Preview').style.display = 'none';
  document.getElementById('mgzP'+idx+'Input').value = '';
  const idMap = {1:'mgzPrevPhoto1',2:'mgzPrevPhoto2',3:'mgzPrevPhoto3'};
  const placeholderSvg = `<svg viewBox="0 0 40 40" fill="none" width="${idx===1?36:22}" height="${idx===1?36:22}"><rect x="2" y="6" width="36" height="28" rx="3" stroke="rgba(100,92,80,0.35)" stroke-width="1.2"/><circle cx="12" cy="17" r="4" stroke="rgba(100,92,80,0.3)" stroke-width="1"/><path d="M2 28l9-7 7 7 5-5 13 9" stroke="rgba(100,92,80,0.3)" stroke-width="1" stroke-linecap="round"/></svg>`;
  const el = document.getElementById(idMap[idx]);
  if (el) { el.style.backgroundImage='none'; el.innerHTML = placeholderSvg; }
}

function mgzPreviewText() {
  const map = {
    mgzNumInput:    'mgzPrevNum',
    mgzSubInput:    'mgzPrevSub',
    mgzFooterLInput:'mgzPrevFooterL',
    mgzFooterRInput:'mgzPrevFooterR',
  };
  Object.entries(map).forEach(([inId, outId]) => {
    const val = document.getElementById(inId).value;
    if (val) { const el = document.getElementById(outId); if(el) el.textContent = val; }
  });
  // 大标题（两行分开）
  const t1 = document.getElementById('mgzTitle1Input').value;
  const t2 = document.getElementById('mgzTitle2Input').value;
  const titleEl = document.getElementById('mgzPrevTitle');
  if (titleEl) titleEl.innerHTML = `${t1 || 'Quiet'}<br><em style="font-style:italic;color:#4a4540;">${t2 || 'Luxury'}</em>`;

  _mgz.num     = document.getElementById('mgzNumInput').value;
  _mgz.title1  = document.getElementById('mgzTitle1Input').value;
  _mgz.title2  = document.getElementById('mgzTitle2Input').value;
  _mgz.sub     = document.getElementById('mgzSubInput').value;
  _mgz.footerL = document.getElementById('mgzFooterLInput').value;
  _mgz.footerR = document.getElementById('mgzFooterRInput').value;
}

function mgzHandleBg(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _mgz.bgImage = e.target.result;
    document.getElementById('mgzBgPreview').style.display = 'block';
    document.getElementById('mgzBgThumb').src = e.target.result;
    mgzApplyBg();
  };
  reader.readAsDataURL(file);
}

function mgzRemoveBg() {
  _mgz.bgImage = null;
  document.getElementById('mgzBgPreview').style.display = 'none';
  document.getElementById('mgzBgInput').value = '';
  mgzApplyBg();
}

function mgzPreviewOpacity(val) {
  _mgz.opacity = parseInt(val);
  document.getElementById('mgzOpacityNum').textContent = val;
  mgzApplyBg();
}

function mgzApplyBg() {
  const bg   = document.getElementById('mgzPrevBg');
  const mask = document.getElementById('mgzPrevMask');
  if (!bg || !mask) return;
  const alpha = _mgz.opacity / 100;
  if (_mgz.bgImage) {
    bg.style.backgroundImage    = `url(${_mgz.bgImage})`;
    bg.style.backgroundSize     = 'cover';
    bg.style.backgroundPosition = 'center';
    mask.style.background       = `rgba(250,250,248,${alpha})`;
    mask.style.backdropFilter   = alpha < 0.5 ? `blur(${Math.round((1-alpha)*20)}px)` : 'none';
    mask.style.webkitBackdropFilter = mask.style.backdropFilter;
  } else {
    bg.style.backgroundImage  = 'none';
    bg.style.backgroundColor  = '#FAFAF8';
    mask.style.background     = `rgba(250,250,248,${alpha})`;
    mask.style.backdropFilter = alpha < 0.9 ? `blur(${Math.round((1-alpha)*20)}px)` : 'none';
    mask.style.webkitBackdropFilter = mask.style.backdropFilter;
  }
}

async function mgzSave() {
  _mgz.num     = document.getElementById('mgzNumInput').value.trim();
  _mgz.title1  = document.getElementById('mgzTitle1Input').value.trim();
  _mgz.title2  = document.getElementById('mgzTitle2Input').value.trim();
  _mgz.sub     = document.getElementById('mgzSubInput').value.trim();
  _mgz.footerL = document.getElementById('mgzFooterLInput').value.trim();
  _mgz.footerR = document.getElementById('mgzFooterRInput').value.trim();
  _mgz.opacity = parseInt(document.getElementById('mgzOpacitySlider').value);

  const req = indexedDB.open('LunaMagazineDB', 1);
  req.onupgradeneeded = e => { if(!e.target.result.objectStoreNames.contains('mgz')) e.target.result.createObjectStore('mgz',{keyPath:'id'}); };
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('mgz','readwrite');
    tx.objectStore('mgz').put({ id:'widget', ..._mgz });
    tx.oncomplete = () => {
      localStorage.setItem('luna_magazine_widget_update', Date.now().toString());
      showToast('已保存');
      setTimeout(() => mgzClose(), 800);
    };
    tx.onerror = () => showToast('保存失败');
  };
  req.onerror = () => showToast('保存失败，无法打开数据库');
}

/* ============================================
   Press 名片组件设置面板 — pw
============================================ */
let _pw = { avatar: null, bgImage: null, opacity: 100, band: '', name: '', sub: '', n1: '', l1: '', n2: '', l2: '', n3: '', l3: '' };

async function pwOpen() {
  try {
    const db = await new Promise((res,rej) => {
      const req = indexedDB.open('LunaPressDB', 1);
      req.onupgradeneeded = e => { if(!e.target.result.objectStoreNames.contains('pw')) e.target.result.createObjectStore('pw',{keyPath:'id'}); };
      req.onsuccess = e => res(e.target.result);
      req.onerror = () => rej();
    });
    const saved = await new Promise(res => {
      const r = db.transaction('pw').objectStore('pw').get('widget');
      r.onsuccess = () => res(r.result || {});
      r.onerror = () => res({});
    });
    ['avatar','bgImage','bgOpacity','band','name','sub','n1','l1','n2','l2','n3','l3'].forEach(k => {
      if (saved[k] !== undefined && saved[k] !== null) _pw[k] = saved[k];
    });
  } catch(e) {}

  document.getElementById('pwBandInput').value = _pw.band || '';
  document.getElementById('pwNameInput').value = _pw.name || '';
  document.getElementById('pwSubInput').value  = _pw.sub  || '';
  document.getElementById('pwN1').value = _pw.n1 || '';
  document.getElementById('pwL1').value = _pw.l1 || '';
  document.getElementById('pwN2').value = _pw.n2 || '';
  document.getElementById('pwL2').value = _pw.l2 || '';
  document.getElementById('pwN3').value = _pw.n3 || '';
  document.getElementById('pwL3').value = _pw.l3 || '';

  // 恢复背景图
  if (_pw.bgImage) {
    document.getElementById('pwBgThumb').src = _pw.bgImage;
    document.getElementById('pwBgPreview').style.display = 'block';
    pwApplyBg();
  }
  const opacityVal = _pw.bgOpacity !== undefined ? _pw.bgOpacity : 0;
  document.getElementById('pwBgOpacity').value = opacityVal;
  document.getElementById('pwBgOpacityVal').textContent = Math.round(opacityVal * 100) + '%';

  if (_pw.avatar) {
    document.getElementById('pwAvPreview').style.display = 'block';
    document.getElementById('pwAvThumb').src = _pw.avatar;
    const prev = document.getElementById('pwPrevAvatar');
    if (prev) prev.innerHTML = `<img src="${_pw.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;"/>`;
  }

  pwPreviewText();
  pwSyncStatusBar();

  document.getElementById('pwOverlay').style.display = 'block';
  document.getElementById('pwPanel').style.transform = 'translateX(0)';
}

function pwClose() {
  document.getElementById('pwOverlay').style.display = 'none';
  document.getElementById('pwPanel').style.transform = 'translateX(100%)';
}

function pwSyncStatusBar() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-CN',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false});
  const el = document.getElementById('pwStatusTime');
  if (el) el.textContent = timeStr;

  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const islandEl = document.getElementById('pwStatusIsland');
  if (islandEl) {
    if (!enabled) { islandEl.innerHTML = ''; }
    else {
      const styleMap = {
        minimal:`<div class="si-minimal"><div class="si-capsule"></div></div>`,
        glow:`<div class="si-glow"><div class="si-capsule"></div></div>`,
        clock:`<div class="si-clock"><div class="si-capsule"><span class="si-clock-text">${timeStr}</span></div></div>`,
        pulse:`<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
        ripple:`<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
        rainbow:`<div class="si-rainbow"><div class="si-capsule"></div></div>`,
        music:`<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
        scan:`<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
      };
      islandEl.innerHTML = styleMap[style] || styleMap.minimal;
    }
  }

  const batPct = document.getElementById('pwBatPct');
  const batInner = document.getElementById('pwBatInner');
  if ('getBattery' in navigator) {
    navigator.getBattery().then(b => {
      const p = Math.round(b.level*100);
      if (batPct) batPct.textContent = p;
      if (batInner) { batInner.style.width=p+'%'; batInner.style.background=p<=20?'linear-gradient(90deg,#f87171,#ef4444)':'linear-gradient(90deg,#6ee7b7,#34d399)'; }
    });
  } else {
    if (batPct) batPct.textContent='76';
    if (batInner) { batInner.style.width='76%'; batInner.style.background='linear-gradient(90deg,#6ee7b7,#34d399)'; }
  }
}

function pwHandleBg(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const url = e.target.result;
    _pw.bgImage = url;
    document.getElementById('pwBgPreview').style.display = 'block';
    document.getElementById('pwBgThumb').src = url;
    pwApplyBg();
  };
  reader.readAsDataURL(file);
}

function pwRemoveBg() {
  _pw.bgImage = null;
  document.getElementById('pwBgPreview').style.display = 'none';
  document.getElementById('pwBgInput').value = '';
  pwApplyBg();
}

function pwApplyBg() {
  const previewCard = document.querySelector('#pwPanel .ww-body > div:nth-child(2) > div');
  // 找到预览卡片的最外层容器（有background:#ffffff那个）
  const card = document.getElementById('pwPreviewCard');
  if (!card) return;
  const opacity = parseFloat(document.getElementById('pwBgOpacity').value || 0);
  if (_pw.bgImage) {
    card.style.backgroundImage = `url(${_pw.bgImage})`;
    card.style.backgroundSize = 'cover';
    card.style.backgroundPosition = 'center';
    card.style.backgroundColor = `rgba(255,255,255,${1 - opacity})`;
  } else {
    card.style.backgroundImage = 'none';
    card.style.backgroundColor = `rgba(255,255,255,1)`;
  }
}

function pwHandleAvatar(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const url = e.target.result;
    _pw.avatar = url;
    document.getElementById('pwAvPreview').style.display = 'block';
    document.getElementById('pwAvThumb').src = url;
    const prev = document.getElementById('pwPrevAvatar');
    if (prev) prev.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;"/>`;
  };
  reader.readAsDataURL(file);
}

function pwRemoveAvatar() {
  _pw.avatar = null;
  document.getElementById('pwAvPreview').style.display = 'none';
  document.getElementById('pwAvInput').value = '';
  const prev = document.getElementById('pwPrevAvatar');
  if (prev) prev.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#9a9690" stroke-width="1.3" width="22" height="22"><circle cx="12" cy="8" r="4.5"/><path d="M3 21c0-4.5 4-8 9-8s9 3.5 9 8"/></svg>`;
}

function pwPreviewText() {
  const band = document.getElementById('pwBandInput').value;
  const name = document.getElementById('pwNameInput').value;
  const sub  = document.getElementById('pwSubInput').value;
  const n1 = document.getElementById('pwN1').value;
  const l1 = document.getElementById('pwL1').value;
  const n2 = document.getElementById('pwN2').value;
  const l2 = document.getElementById('pwL2').value;
  const n3 = document.getElementById('pwN3').value;
  const l3 = document.getElementById('pwL3').value;

  if (band) document.getElementById('pwPrevBandLabel').textContent = band;
  if (name) document.getElementById('pwPrevName').textContent = name;
  if (sub)  document.getElementById('pwPrevSub').textContent  = sub;
  if (n1)   document.getElementById('pwPrevN1').textContent   = n1;
  if (l1)   document.getElementById('pwPrevL1').textContent   = l1;
  if (n2)   document.getElementById('pwPrevN2').textContent   = n2;
  if (l2)   document.getElementById('pwPrevL2').textContent   = l2;
  if (n3)   document.getElementById('pwPrevN3').textContent   = n3;
  if (l3)   document.getElementById('pwPrevL3').textContent   = l3;

  Object.assign(_pw, {band,name,sub,n1,l1,n2,l2,n3,l3});
}

async function pwSave() {
  pwPreviewText();
  // 同步透明度到 _pw.bgOpacity（统一用 bgOpacity 0~1 范围）
  _pw.bgOpacity = parseFloat(document.getElementById('pwBgOpacity').value || 0);
  const req = indexedDB.open('LunaPressDB', 1);
  req.onupgradeneeded = e => { if(!e.target.result.objectStoreNames.contains('pw')) e.target.result.createObjectStore('pw',{keyPath:'id'}); };
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('pw','readwrite');
    tx.objectStore('pw').put({ id:'widget', ..._pw });
    tx.oncomplete = () => {
      localStorage.setItem('luna_press_widget_update', Date.now().toString());
      showToast('已保存');
      setTimeout(() => pwClose(), 800);
    };
    tx.onerror = () => showToast('保存失败');
  };
  req.onerror = () => showToast('保存失败，无法打开数据库');
}
/* ============================================
   日记本组件设置面板 — pdw
============================================ */
let _pdw = { bgImage: null, opacity: 100, caption: '', name: '', sub: '', stat1: '', stat2: '', stat3: '' };

async function pdwOpen() {
  try {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open('LunaDiaryDB', 1);
      req.onupgradeneeded = e => { if (!e.target.result.objectStoreNames.contains('pdw')) e.target.result.createObjectStore('pdw', { keyPath: 'id' }); };
      req.onsuccess = e => res(e.target.result);
      req.onerror = () => rej();
    });
    const saved = await new Promise(res => {
      const r = db.transaction('pdw').objectStore('pdw').get('widget');
      r.onsuccess = () => res(r.result || {});
      r.onerror = () => res({});
    });
    ['bgImage', 'opacity', 'caption', 'name', 'sub', 'stat1', 'stat2', 'stat3'].forEach(k => {
      if (saved[k] !== undefined && saved[k] !== null) _pdw[k] = saved[k];
    });
  } catch(e) {}

  document.getElementById('pdwCaptionInput').value = _pdw.caption || '';
  document.getElementById('pdwNameInput').value    = _pdw.name    || '';
  document.getElementById('pdwSubInput').value     = _pdw.sub     || '';
  document.getElementById('pdwStat1').value        = _pdw.stat1   || '';
  document.getElementById('pdwStat2').value        = _pdw.stat2   || '';
  document.getElementById('pdwStat3').value        = _pdw.stat3   || '';

  const opVal = _pdw.opacity !== undefined ? _pdw.opacity : 100;
  document.getElementById('pdwOpacitySlider').value = opVal;
  document.getElementById('pdwOpacityNum').textContent = opVal;

  if (_pdw.bgImage) {
    document.getElementById('pdwBgThumb').src = _pdw.bgImage;
    document.getElementById('pdwBgPreview').style.display = 'block';
  } else {
    document.getElementById('pdwBgPreview').style.display = 'none';
  }

  pdwApplyBg();
  pdwPreviewText();
  pdwSyncStatusBar();

  document.getElementById('pdwOverlay').style.display = 'block';
  document.getElementById('pdwPanel').style.transform = 'translateX(0)';
}

function pdwClose() {
  document.getElementById('pdwOverlay').style.display = 'none';
  document.getElementById('pdwPanel').style.transform = 'translateX(100%)';
}

function pdwSyncStatusBar() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  const el = document.getElementById('pdwStatusTime');
  if (el) el.textContent = timeStr;

  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const islandEl = document.getElementById('pdwStatusIsland');
  if (islandEl) {
    if (!enabled) { islandEl.innerHTML = ''; }
    else {
      const styleMap = {
        minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
        glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
        clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text">${timeStr}</span></div></div>`,
        pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
        ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
        rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
        music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
        scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
      };
      islandEl.innerHTML = styleMap[style] || styleMap.minimal;
    }
  }

  const batPct   = document.getElementById('pdwBatPct');
  const batInner = document.getElementById('pdwBatInner');
  if ('getBattery' in navigator) {
    navigator.getBattery().then(b => {
      const p = Math.round(b.level * 100);
      if (batPct)   batPct.textContent = p;
      if (batInner) { batInner.style.width = p + '%'; batInner.style.background = p <= 20 ? 'linear-gradient(90deg,#f87171,#ef4444)' : 'linear-gradient(90deg,#6ee7b7,#34d399)'; }
    });
  } else {
    if (batPct)   batPct.textContent = '76';
    if (batInner) { batInner.style.width = '76%'; batInner.style.background = 'linear-gradient(90deg,#6ee7b7,#34d399)'; }
  }
}

function pdwHandleBg(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const url = e.target.result;
    _pdw.bgImage = url;
    document.getElementById('pdwBgThumb').src = url;
    document.getElementById('pdwBgPreview').style.display = 'block';
    pdwApplyBg();
  };
  reader.readAsDataURL(file);
}

function pdwRemoveBg() {
  _pdw.bgImage = null;
  document.getElementById('pdwBgPreview').style.display = 'none';
  document.getElementById('pdwBgInput').value = '';
  pdwApplyBg();
}

function pdwApplyBg() {
  const imgDiv = document.getElementById('pdwPrevImg');
  const placeholder = document.getElementById('pdwPrevPlaceholder');
  if (!imgDiv) return;
  const alpha = (_pdw.opacity !== undefined ? _pdw.opacity : 100) / 100;

  if (_pdw.bgImage) {
    imgDiv.style.backgroundImage    = `url(${_pdw.bgImage})`;
    imgDiv.style.backgroundSize     = 'cover';
    imgDiv.style.backgroundPosition = 'center';
    // 用白色叠加层控制透明度，而不是对整个 div 设置 opacity（避免文字也透明）
    imgDiv.style.backgroundColor    = `rgba(255,255,255,${1 - alpha})`;
    imgDiv.style.opacity            = '';
    if (placeholder) placeholder.style.display = 'none';
  } else {
    imgDiv.style.backgroundImage = 'none';
    imgDiv.style.background      = `linear-gradient(160deg,#eae8e2 0%,#d8d4cc 100%)`;
    imgDiv.style.opacity         = '';
    if (placeholder) placeholder.style.display = '';
  }
  // 渐隐遮罩始终保留
  const fade = document.getElementById('pdwPrevFade');
  if (fade) fade.style.background = `linear-gradient(to top, rgba(255,255,255,${0.6 + alpha * 0.3}), transparent)`;
}

function pdwPreviewText() {
  const caption = document.getElementById('pdwCaptionInput').value;
  const name    = document.getElementById('pdwNameInput').value;
  const sub     = document.getElementById('pdwSubInput').value;
  const s1      = document.getElementById('pdwStat1').value;
  const s2      = document.getElementById('pdwStat2').value;
  const s3      = document.getElementById('pdwStat3').value;

  const cap = document.getElementById('pdwPrevCaption');
  const nm  = document.getElementById('pdwPrevName');
  const sb  = document.getElementById('pdwPrevSub');
  const st1 = document.getElementById('pdwPrevStat1');
  const st2 = document.getElementById('pdwPrevStat2');
  const st3 = document.getElementById('pdwPrevStat3');

  if (cap && caption) cap.textContent = `"${caption}"`;
  if (nm  && name)    nm.textContent  = name;
  if (sb  && sub)     sb.textContent  = sub;
  if (st1 && s1)      st1.textContent = s1;
  if (st2 && s2)      st2.textContent = s2;
  if (st3 && s3)      st3.textContent = s3;

  Object.assign(_pdw, { caption, name, sub, stat1: s1, stat2: s2, stat3: s3 });
}

async function pdwSave() {
  pdwPreviewText();
  const req = indexedDB.open('LunaDiaryDB', 1);
  req.onupgradeneeded = e => { if (!e.target.result.objectStoreNames.contains('pdw')) e.target.result.createObjectStore('pdw', { keyPath: 'id' }); };
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('pdw', 'readwrite');
    tx.objectStore('pdw').put({ id: 'widget', ..._pdw });
    tx.oncomplete = () => {
      localStorage.setItem('luna_diary_widget_update', Date.now().toString());
      showToast('已保存');
      setTimeout(() => pdwClose(), 800);
    };
    tx.onerror = () => showToast('保存失败');
  };
  req.onerror = () => showToast('保存失败，无法打开数据库');
}