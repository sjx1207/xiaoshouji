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
  weather:      () => openWeatherSettings(),
  music:        () => openMusicSettings(),
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
function openCountdownSettings() { showToast('倒数日组件设置 — 即将开放'); }
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
      const req = indexedDB.open('LunaWallpaperDB', 1);
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
      const req = indexedDB.open('LunaIconBeautyDB', 1);
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
      const req = indexedDB.open('LunaMusicDB', 1);
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
      const req = indexedDB.open('LunaFontDB', 2);
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
          const req = indexedDB.open('LunaWallpaperDB', 1);
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
          const req = indexedDB.open('LunaIconBeautyDB', 1);
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
            const req = indexedDB.open('LunaMusicDB', 1);
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
          const req = indexedDB.open('LunaFontDB', 2);
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
    document.getElementById('wwStatusIsland')
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
const WW_TINT = {
  none:   '',
  blue:   'radial-gradient(ellipse at 30% 40%,rgba(147,197,253,0.4) 0%,transparent 60%),radial-gradient(ellipse at 75% 70%,rgba(147,197,253,0.22) 0%,transparent 55%)',
  purple: 'radial-gradient(ellipse at 30% 40%,rgba(196,181,253,0.4) 0%,transparent 60%),radial-gradient(ellipse at 75% 70%,rgba(196,181,253,0.22) 0%,transparent 55%)',
  pink:   'radial-gradient(ellipse at 30% 40%,rgba(249,168,212,0.38) 0%,transparent 60%),radial-gradient(ellipse at 75% 70%,rgba(249,168,212,0.25) 0%,transparent 55%)',
  amber:  'radial-gradient(ellipse at 30% 40%,rgba(252,211,77,0.38) 0%,transparent 60%),radial-gradient(ellipse at 75% 70%,rgba(252,211,77,0.22) 0%,transparent 55%)',
  teal:   'radial-gradient(ellipse at 30% 40%,rgba(94,234,212,0.38) 0%,transparent 60%),radial-gradient(ellipse at 75% 70%,rgba(94,234,212,0.22) 0%,transparent 55%)',
};

let _ww = { bgDataUrl: null, opacity: 100, glassOn: false, blur: 18, sat: 160, tint: 'none' };

async function wwOpen() {
  // 读取已保存
  try {
    const s = localStorage.getItem('luna_weather_widget_style');
    if (s) _ww = Object.assign(_ww, JSON.parse(s));
    const bg = localStorage.getItem('luna_weather_widget_bg');
    if (bg) _ww.bgDataUrl = bg;
  } catch(e) {}

  wwApply();
  // 同步壁纸到底层预览
  const base = document.getElementById('wwWallpaperBase');
  if (base && _ww.bgDataUrl) {
    base.style.background = `url(${_ww.bgDataUrl}) center/cover no-repeat`;
  }
  // 尝试读取主页壁纸（如果有）
  try {
    const wpDb = await new Promise((res, rej) => {
      const req = indexedDB.open('LunaWallpaperDB', 1);
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

  document.getElementById('wwPanel').querySelectorAll('.ww-tint-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      _ww.tint = dot.dataset.tint;
      document.getElementById('wwPanel').querySelectorAll('.ww-tint-dot')
        .forEach(d => d.classList.toggle('selected', d === dot));
      wwApplyGlass();
    });
  });
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

  // 玻璃开关
  document.getElementById('wwGlassToggle').checked = _ww.glassOn;
  document.getElementById('wwGlassControls').style.display = _ww.glassOn ? 'block' : 'none';

  // 滑块值
  document.getElementById('wwBlurSlider').value = _ww.blur;
  document.getElementById('wwBlurNum').textContent = _ww.blur;
  document.getElementById('wwSatSlider').value = _ww.sat;
  document.getElementById('wwSatNum').textContent = _ww.sat;

  // 光晕色选中态
  document.getElementById('wwPanel').querySelectorAll('.ww-tint-dot')
    .forEach(d => d.classList.toggle('selected', d.dataset.tint === _ww.tint));

  wwApplyGlass();
}

function wwApplyGlass() {
  const card = document.getElementById('wwBpCard');
  const bg   = document.getElementById('wwCardBg');
  if (!card || !bg) return;

  if (!_ww.glassOn) {
    // 关闭玻璃：背景层恢复为图片或纯白，移除所有玻璃滤镜
    bg.style.backdropFilter       = 'none';
    bg.style.webkitBackdropFilter = 'none';
    bg.style.backgroundImage      = _ww.bgDataUrl ? `url(${_ww.bgDataUrl})` : 'none';
    bg.style.backgroundColor      = _ww.bgDataUrl ? 'transparent' : '#ffffff';
    bg.style.backgroundSize       = 'cover';
    bg.style.backgroundPosition   = 'center';
    card.style.boxShadow          = '0 6px 32px rgba(0,0,0,.13), 0 2px 8px rgba(0,0,0,.07)';
    card.style.border             = 'none';
    return;
  }

  // 开启液态玻璃
  const blur = _ww.blur || 18;
  const sat  = _ww.sat  || 160;

  // 背景层变成半透明 + 毛玻璃
  // 有背景图时：图片本身就是玻璃底层，opacity 由滑块控制
  // 无背景图时：用非常轻的白色让 backdrop-filter 能作用于卡片后方壁纸
  if (_ww.bgDataUrl) {
    bg.style.backgroundImage    = `url(${_ww.bgDataUrl})`;
    bg.style.backgroundColor    = 'transparent';
    bg.style.backgroundSize     = 'cover';
    bg.style.backgroundPosition = 'center';
  } else {
    // 没有背景图：背景层必须透明才能透出壁纸
    bg.style.backgroundImage    = 'none';
    bg.style.backgroundColor    = 'rgba(255,255,255,0.15)';
  }

  // 核心：毛玻璃滤镜
  bg.style.backdropFilter       = `blur(${blur}px) saturate(${sat}%)`;
  bg.style.webkitBackdropFilter = `blur(${blur}px) saturate(${sat}%)`;

  // 光晕颜色叠加
  const tintGradient = WW_TINT[_ww.tint] || '';
  if (tintGradient) {
    if (_ww.bgDataUrl) {
      bg.style.backgroundImage = `url(${_ww.bgDataUrl})`;
    } else {
      bg.style.backgroundImage = 'none';
    }
    // 用 outline 层叠加光晕，不破坏背景图
    bg.style.boxShadow = 'none';
    // 在 bg 上面创建光晕伪效果（通过 outline 不行，改用额外内联 div）
    let glowEl = document.getElementById('wwGlowLayer');
    if (!glowEl) {
      glowEl = document.createElement('div');
      glowEl.id = 'wwGlowLayer';
      glowEl.style.cssText = 'position:absolute;inset:0;z-index:1;pointer-events:none;border-radius:inherit;';
      card.insertBefore(glowEl, card.firstChild);
    }
    glowEl.style.background = tintGradient;
    glowEl.style.opacity    = '0.55';
  } else {
    const glowEl = document.getElementById('wwGlowLayer');
    if (glowEl) glowEl.style.background = 'none';
  }

  // iOS 26 玻璃高光边框
  card.style.boxShadow = '0 8px 32px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(255,255,255,0.15)';
  card.style.border    = '1px solid rgba(255,255,255,0.4)';
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
  wwApplyGlass();
}

function wwApplyBg() {
  const bg = document.getElementById('wwCardBg');
  const alpha = _ww.opacity / 100;
  if (_ww.bgDataUrl) {
    // 有背景图：用图片，opacity 控制整个背景层
    bg.style.backgroundImage    = `url(${_ww.bgDataUrl})`;
    bg.style.backgroundColor    = 'transparent';
    bg.style.backgroundSize     = 'cover';
    bg.style.backgroundPosition = 'center';
    bg.style.opacity            = alpha;
  } else {
    // 没有背景图：用 rgba 白色，alpha 直接响应滑块
    bg.style.backgroundImage = 'none';
    bg.style.backgroundColor = `rgba(255,255,255,${alpha})`;
    bg.style.opacity         = 1;  // opacity 保持1，靠 rgba 的 alpha 来控制
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
  try {
    const toSave = { opacity: _ww.opacity, glassOn: _ww.glassOn, blur: _ww.blur, sat: _ww.sat, tint: _ww.tint };
    localStorage.setItem('luna_weather_widget_style', JSON.stringify(toSave));
    if (_ww.bgDataUrl) {
      localStorage.setItem('luna_weather_widget_bg', _ww.bgDataUrl);
    } else {
      localStorage.removeItem('luna_weather_widget_bg');
    }
    localStorage.setItem('luna_weather_widget_update', Date.now().toString());
    showToast('已保存');
    setTimeout(() => wwClose(), 800);
  } catch(e) {
    showToast('保存失败，图片可能过大');
  }
}