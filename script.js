/* ================================
   Luna Phone — app.js
   桌面交互逻辑
================================ */

/* ---- 实时时间 ---- */
function updateTime() {
  const el = document.getElementById('statusTime');
  const wt = document.getElementById('widgetTime');
  const wd = document.getElementById('widgetDate');
  const dayFill = document.getElementById('dayFill');
  const dayPct = document.getElementById('dayPct');

  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const now = new Date();
  
  // 核心：定义 tzNow 以修复报错
  const tzNow = new Date(now.toLocaleString('en-US', { timeZone: tz }));

  // 状态栏时间（24小时制）
  const statusTimeStr = now.toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  
  // 机票时间：改为英文 AM/PM 格式
  const timeStr = now.toLocaleTimeString('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true
  });
  
  // 日期：英文大写格式
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const dateStr = `${monthNames[tzNow.getMonth()]} ${tzNow.getDate()}, ${tzNow.getFullYear()}`;

  if (el) el.textContent = statusTimeStr;
  if (wt) wt.textContent = timeStr.toUpperCase(); 
  if (wd) wd.textContent = dateStr;

  const totalMins = 24 * 60;
  const passedMins = tzNow.getHours() * 60 + tzNow.getMinutes();
  const pct = Math.round(passedMins / totalMins * 100);
  
  if (dayFill) dayFill.style.width = pct + '%';
  if (dayPct) dayPct.textContent = `PASS ${pct}%`; // 进度也改为英文更高级
}


/* ---- 模拟电量（固定演示值，后续可接真实API） ---- */
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
      battery.addEventListener('levelchange', () => {
        render(battery.level * 100);
      });
    });
  } else {
    // 不支持的设备（iOS等）显示固定值
    render(76);
  }
}
updateBattery();


/* ---- App 点击事件 ---- */
function setupAppClicks() {
  // 合并 grid 和 dock 里的所有可点击图标
  const allApps = document.querySelectorAll('.app[data-app], .dock-app[data-app]');

  allApps.forEach(el => {
    el.addEventListener('click', () => {
      const appName = el.dataset.app;
      openApp(appName);
    });
  });
}

/* 打开 App（目前只是占位提示，后续每个 app 会有独立模块） */
/* 打开 App — 带丝滑转场动画 */
function openApp(name) {
  // 图标弹簧反馈
  const face = document.querySelector(`[data-app="${name}"] .app-face, [data-app="${name}"] .dock-face`);
  if (face) {
    face.style.transition = 'transform 0.12s cubic-bezier(0.34,1.56,0.64,1)';
    face.style.transform = 'scale(0.82)';
    setTimeout(() => { face.style.transform = 'scale(1)'; }, 130);
  }

  // App 路由表
  const routes = {
    'wallpaper': 'Wallpaper.html',
    // 后续加其他 app：
    'settings': 'settings.html',
    'chat': 'Chat.html',
    'characters': 'characters.html',
    'worldbook': 'worldbook.html',
    'iconbeauty': 'iconbeauty.html',
    'memory': 'memory.html',
  };

  const url = routes[name];
  if (!url) return; // 没有对应页面就不跳转

  // 全屏遮罩淡入 → 跳转
  const mask = document.getElementById('appTransMask');
  mask.style.transition = 'opacity 0.32s cubic-bezier(0.4,0,0.2,1)';
  mask.style.opacity = '1';
  mask.style.pointerEvents = 'all';

  setTimeout(() => {
    window.location.href = url;
  }, 300);
}

// 禁止浏览器使用返回缓存快照，同时应用字体设置
window.addEventListener('pageshow', (e) => {
  if (e.persisted) window.location.reload();
  applyGlobalFont();
});
/* ---- 初始化 ---- */
document.addEventListener('DOMContentLoaded', () => {
  setupAppClicks();
  updateBattery();
  updateTime();
  setInterval(updateTime, 1000);
  applyIsland();
  applyCustomIcons();
});

function setWeather(type, label) {
  document.querySelectorAll('.wi-svg').forEach(el => el.style.display = 'none');
  const target = document.getElementById('wi-' + type);
  if (target) target.style.display = 'block';
  const lbl = document.querySelector('.wi-label');
  if (lbl) lbl.textContent = label;
}

/* ================================
   天气组件设置面板
================================ */

// 打开/关闭面板
function openWeatherPanel() {
  document.getElementById('wpOverlay').classList.add('show');
  document.getElementById('wpPanel').classList.add('show');
  loadPanelData();
}
function closeWeatherPanel() {
  document.getElementById('wpOverlay').classList.remove('show');
  document.getElementById('wpPanel').classList.remove('show');
}

// Tab 切换
function switchTab(name, btn) {
  document.querySelectorAll('.wp-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  ['api','custom'].forEach(t => {
    const el = document.getElementById('tab-' + t);
    if (el) el.style.display = t === name ? 'block' : 'none';
  });
}

// 加载已保存数据到面板
function loadPanelData() {
  const d = getDB();
  if (d.apiKey)   document.getElementById('inputApiKey').value = d.apiKey;
  if (d.apiCity)  document.getElementById('inputApiCity').value = d.apiCity;
  if (d.city)     document.getElementById('inputCity').value = d.city;
  if (d.temp)     document.getElementById('inputTemp').value = d.temp;
  if (d.desc)     document.getElementById('inputDesc').value = d.desc;
  if (d.selectedWI) {
    document.querySelectorAll('.wi-opt').forEach(o => {
      o.classList.toggle('selected', o.dataset.wi === d.selectedWI);
    });
  }
}

/* ---- IndexedDB 封装 ---- */
let _db = null;
function openDB() {
  return new Promise((res, rej) => {
    if (_db) return res(_db);
    const req = indexedDB.open('LunaWeatherDB', 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('settings', { keyPath: 'id' });
    };
    req.onsuccess = e => { _db = e.target.result; res(_db); };
    req.onerror = () => rej('DB Error');
  });
}
function saveDB(data) {
  return openDB().then(db => {
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ id: 'weather', ...data });
  });
}
function loadDB() {
  return openDB().then(db => new Promise((res, rej) => {
    const req = db.transaction('settings').objectStore('settings').get('weather');
    req.onsuccess = () => res(req.result || {});
    req.onerror = () => rej({});
  }));
}

// 内存缓存（同步读取用）
let _cache = {};
function getDB() { return _cache; }

// 页面加载时读取 DB 并应用
async function initWeatherSettings() {
  try {
    _cache = await loadDB();
    applyAllSettings(_cache);
  } catch(e) {}
}

function applyAllSettings(d) {
  if (d.opacity !== undefined) applyOpacity(d.opacity);
  if (d.bgImage) applyBgImage(d.bgImage);
  if (d.apiKey && d.apiCity) {
    fetchWeatherAPI(d.apiKey, d.apiCity);
  } else {
    if (d.city)  document.querySelector('.city').textContent = d.city;
    if (d.temp)  document.querySelector('.temp-num').textContent = d.temp;
    if (d.selectedWI) setWeather(d.selectedWI, d.desc || '');
  }
}

/* ---- API 天气获取 ---- */
async function saveApiSettings() {
  const key = document.getElementById('inputApiKey').value.trim();
  const city = document.getElementById('inputApiCity').value.trim();
  const st = document.getElementById('apiStatus');
  if (!city) {
    st.textContent = '请填写城市名';
    st.className = 'wp-status error';
    return;
  }
  st.textContent = '获取中...';
  st.className = 'wp-status';
  const ok = await fetchWeatherAPI(key, city);
  if (ok) {
    _cache = { ..._cache, apiKey: key, apiCity: city };
    await saveDB(_cache);
    st.textContent = '✓ 获取成功，已保存！';
    st.className = 'wp-status';
  } else {
    st.textContent = '✕ 获取失败，请检查 Key 或城市名（需英文）';
    st.className = 'wp-status error';
  }
}

async function fetchWeatherAPI(apiKey, city) {
  try {
    // 第一步：城市名转坐标
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh&format=json`;
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) return false;
    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) return false;
    const { latitude, longitude, name } = geoData.results[0];

    // 第二步：用坐标查天气
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
    const res = await fetch(url);
    if (!res.ok) return false;
    const data = await res.json();
    const temp = Math.round(data.current_weather.temperature);
    const code = data.current_weather.weathercode;
    const cityName = name || city;

    const cityEl = document.getElementById('bpCityCode');
    const tempEl = document.getElementById('bpTempCode');
    if (cityEl) cityEl.textContent = cityName;
    if (tempEl) tempEl.textContent = temp + '°';

    let wiType = 'sunny';
    let desc = '晴天';
    if (code === 0) { wiType = 'sunny'; desc = '晴天'; }
    else if (code <= 2) { wiType = 'partly-cloudy'; desc = '多云'; }
    else if (code === 3) { wiType = 'cloudy'; desc = '阴天'; }
    else if (code <= 49) { wiType = 'fog'; desc = '雾'; }
    else if (code <= 59) { wiType = 'light-rain'; desc = '小雨'; }
    else if (code <= 69) { wiType = 'moderate-rain'; desc = '中雨'; }
    else if (code <= 79) { wiType = 'light-snow'; desc = '小雪'; }
    else if (code <= 84) { wiType = 'moderate-rain'; desc = '阵雨'; }
    else if (code <= 94) { wiType = 'heavy-snow'; desc = '大雪'; }
    else { wiType = 'thunder'; desc = '雷暴'; }

    const lblEl = document.querySelector('.wi-label');
    if (lblEl) lblEl.textContent = desc;
    setWeather(wiType, desc);
    return true;
  } catch(e) { return false; }
}

/* ---- 自定义设置 ---- */
async function saveCustomSettings() {
  const city = document.getElementById('inputCity').value.trim();
  const temp = document.getElementById('inputTemp').value.trim();
  const desc = document.getElementById('inputDesc').value.trim();
  const selectedWI = document.querySelector('.wi-opt.selected')?.dataset.wi || 'sunny';

  if (city) {
    const cityEl = document.getElementById('bpCityCode');
    if (cityEl) cityEl.textContent = city;
  }
  if (temp) {
    const tempEl = document.getElementById('bpTempCode');
    if (tempEl) tempEl.textContent = temp + '°';
  }
  const lblEl = document.querySelector('.wi-label');
  if (lblEl && desc) lblEl.textContent = desc;
  setWeather(selectedWI, desc);

  _cache = { ..._cache, city, temp, desc, selectedWI, apiKey: null, apiCity: null };
  await saveDB(_cache);
  closeWeatherPanel();
}
function selectWI(el) {
  document.querySelectorAll('.wi-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}

/* ---- 卡片样式切换 ---- */
function selectCardStyle(el) {
  document.querySelectorAll('.style-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  const style = el.getAttribute('data-style');
  applyCardStyle(style);
  _cache = { ..._cache, cardStyle: style };
}

function applyCardStyle(style) {
  const card = document.getElementById('mainCard');
  if (!card) return;
  card.classList.remove('bp-style-02', 'bp-style-03');
  if (style === '02') card.classList.add('bp-style-02');
  if (style === '03') card.classList.add('bp-style-03');
}


/* ---- 初始化加载 ---- */
document.addEventListener('DOMContentLoaded', () => {
  initWeatherSettings();
});

/* ================================
   音乐组件设置面板
================================ */

// --- DB ---
function openMusicDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('LunaMusicDB', 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('music', { keyPath: 'id' });
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror = () => rej();
  });
}
async function saveMusicDB(data) {
  const db = await openMusicDB();
  const tx = db.transaction('music', 'readwrite');
  tx.objectStore('music').put({ id: 'widget', ...data });
}
async function loadMusicDB() {
  const db = await openMusicDB();
  return new Promise((res) => {
    const req = db.transaction('music').objectStore('music').get('widget');
    req.onsuccess = () => res(req.result || {});
    req.onerror = () => res({});
  });
}

// --- 内存缓存 ---
let _mpCache = {};
let _mpPickedColor = '#fb923c';

// --- 打开/关闭 ---
function openMusicPanel() {
  document.getElementById('mpOverlay').classList.add('show');
  document.getElementById('mpPanel').classList.add('show');
  loadMusicPanelData();
  drawColorWheel();
}
function closeMusicPanel() {
  document.getElementById('mpOverlay').classList.remove('show');
  document.getElementById('mpPanel').classList.remove('show');
}

// --- 把DB数据填入面板 ---
function loadMusicPanelData() {
  const d = _mpCache;
  if (d.song)    document.getElementById('mpSongInput').value = d.song;
  if (d.artist)  document.getElementById('mpArtistInput').value = d.artist;
  if (d.color)   { _mpPickedColor = d.color; updateColorUI(d.color); }
  if (d.opacity !== undefined) {
    document.getElementById('mpOpacitySlider').value = d.opacity;
    document.getElementById('mpOpacityVal').textContent = d.opacity;
  }
  if (d.coverImage) {
    const prev = document.getElementById('mpCoverPreview');
    prev.innerHTML = `<img src="${d.coverImage}" style="width:64px;height:64px;object-fit:cover;border-radius:14px"/>`;
  }
  if (d.bgImage) {
    document.getElementById('mpBgPreview').style.display = 'block';
    document.getElementById('mpBgThumb').src = d.bgImage;
  }
}

// --- 封面上传 ---
function handleMpCover(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const url = e.target.result;
    const prev = document.getElementById('mpCoverPreview');
    prev.innerHTML = `<img src="${url}" style="width:64px;height:64px;object-fit:cover;border-radius:14px"/>`;
    _mpCache.coverImage = url;
    // 实时更新组件封面
    const widgetCover = document.querySelector('.mw-cover');
    if (widgetCover) widgetCover.innerHTML = `<img src="${url}" style="width:60px;height:60px;object-fit:cover;border-radius:14px"/>`;
  };
  reader.readAsDataURL(file);
}

// --- 背景上传 ---
function handleMpBg(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const url = e.target.result;
    document.getElementById('mpBgPreview').style.display = 'block';
    document.getElementById('mpBgThumb').src = url;
    _mpCache.bgImage = url;
    applyMusicWidgetBg(url);
  };
  reader.readAsDataURL(file);
}
function removeMpBg() {
  document.getElementById('mpBgPreview').style.display = 'none';
  _mpCache.bgImage = null;
  const w = document.getElementById('musicWidget');
  if (w) { w.style.backgroundImage = ''; }
}
function applyMusicWidgetBg(url) {
  const w = document.getElementById('musicWidget');
  if (w) {
    w.style.backgroundImage = `url(${url})`;
    w.style.backgroundSize = 'cover';
    w.style.backgroundPosition = 'center';
  }
}

// --- 透明度预览 ---
function previewMpOpacity(val) {
  document.getElementById('mpOpacityVal').textContent = val;
  const w = document.getElementById('musicWidget');
  if (w) {
    const alpha = (val / 100 * 0.62).toFixed(3);
    w.style.background = `rgba(255,255,255,${alpha})`;
  }
  _mpCache.opacity = parseInt(val);
}

// --- 颜色轮 ---
function drawColorWheel() {
  const canvas = document.getElementById('mpColorWheel');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx = 90, cy = 90, r = 88;
  for (let angle = 0; angle < 360; angle++) {
    const start = (angle - 1) * Math.PI / 180;
    const end = (angle + 1) * Math.PI / 180;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'white');
    grad.addColorStop(1, `hsl(${angle},100%,50%)`);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }
  canvas.onclick = canvas.ontouchstart = function(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    const pixel = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
    _mpPickedColor = hex;
    _mpCache.color = hex;
    updateColorUI(hex);
    applyPlayBtnColor(hex);
  };
}

function rgbToHex(r, g, b) {
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}
function updateColorUI(hex) {
  document.getElementById('mpColorDot').style.background = hex;
  document.getElementById('mpColorHex').textContent = hex;
}
function applyPlayBtnColor(hex) {
  const btn = document.querySelector('.mw-play-btn');
  if (btn) btn.style.background = hex;
}

// --- 保存 ---
async function saveMusicSettings() {
  const song   = document.getElementById('mpSongInput').value.trim();
  const artist = document.getElementById('mpArtistInput').value.trim();

  if (song)   { document.querySelector('.mw-song').textContent = song; _mpCache.song = song; }
  if (artist) { document.querySelector('.mw-artist').textContent = artist; _mpCache.artist = artist; }

  await saveMusicDB(_mpCache);
  closeMusicPanel();
}

// --- 页面加载时恢复设置 ---
async function initMusicSettings() {
  _mpCache = await loadMusicDB();
  const d = _mpCache;
  if (d.song)    document.querySelector('.mw-song').textContent = d.song;
  if (d.artist)  document.querySelector('.mw-artist').textContent = d.artist;
  if (d.color)   applyPlayBtnColor(d.color);
  if (d.coverImage) {
    const wc = document.querySelector('.mw-cover');
    if (wc) wc.innerHTML = `<img src="${d.coverImage}" style="width:60px;height:60px;object-fit:cover;border-radius:14px"/>`;
  }
  if (d.bgImage)  applyMusicWidgetBg(d.bgImage);
  if (d.opacity !== undefined) previewMpOpacity(d.opacity);
}

document.addEventListener('DOMContentLoaded', () => {
  initMusicSettings();
  initWallpaper();
});

/* ================================
   壁纸接入 — 读取 wallpaper.html 写入的 IndexedDB
================================ */
let _wpDb = null;

function openWpDB() {
  return new Promise((res, rej) => {
    if (_wpDb) return res(_wpDb);
    const req = indexedDB.open('LunaWallpaperDB', 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('data', { keyPath: 'key' });
    };
    req.onsuccess = e => { _wpDb = e.target.result; res(_wpDb); };
    req.onerror = () => rej();
  });
}

async function wpDbGet(key) {
  const db = await openWpDB();
  return new Promise((res) => {
    const req = db.transaction('data').objectStore('data').get(key);
    req.onsuccess = () => res(req.result ? req.result.value : null);
    req.onerror = () => res(null);
  });
}

async function applyWallpaperToFrame(data) {
  const layer = document.getElementById('wallpaperLayer');
  if (!layer) return;

  // 清空旧内容
  layer.innerHTML = '';

  if (!data || !data.dataUrl) {
    // 没有壁纸，恢复默认渐变（清空 layer 即可，css 的 background 还在）
    return;
  }

  if (data.kind === 'image') {
    const img = document.createElement('img');
    img.src = data.dataUrl;
    layer.appendChild(img);
  } else if (data.kind === 'video') {
    const video = document.createElement('video');
    video.src = data.dataUrl;
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.play().catch(() => {});
    layer.appendChild(video);
  }
}

async function initWallpaper() {
  const applied = await wpDbGet('applied');
  await applyWallpaperToFrame(applied);

  // 监听 wallpaper.html 通过 localStorage 发出的更新信号
  window.addEventListener('storage', async (e) => {
    if (e.key === 'luna_wallpaper_update') {
      const applied = await wpDbGet('applied');
      await applyWallpaperToFrame(applied);
    }
    if (e.key === 'luna_tz_update') {
      // 时区变化后重新渲染时间（如果你的 widget 有时区相关显示可在此扩展）
      updateTime();
    }
    if (e.key === 'luna_font_update') {
      applyGlobalFont();
    }
    if (e.key === 'luna_island_update') {
      applyIsland();
    }
  });
}

// ---- 字体DB（从settings.js同步过来）----
let _fontDb = null;
function openFontDB() {
  return new Promise((res, rej) => {
    if (_fontDb) return res(_fontDb);
    const req = indexedDB.open('LunaFontDB', 2);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('fonts', { keyPath: 'id' });
    };
    req.onsuccess = e => { _fontDb = e.target.result; res(_fontDb); };
    req.onerror = () => rej();
  });
}
async function fontDbGetAll() {
  const db = await openFontDB();
  return new Promise(res => {
    const req = db.transaction('fonts').objectStore('fonts').getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror   = () => res([]);
  });
}

async function applyGlobalFont() {
  const style = JSON.parse(localStorage.getItem('luna_font_style') || '{}');
  const name  = localStorage.getItem('luna_font_active_name');
  const id    = parseInt(localStorage.getItem('luna_font_active_id'));

  // 从IndexedDB取字体数据，重新注册进浏览器
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

  // 注入 <style> + !important，覆盖所有 CSS 写死的颜色
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

/* ================================
   灵动岛状态栏同步
================================ */
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

  // 时钟样式实时更新
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

/* 图标美化同步 — 页面加载时读取自定义图标 */
async function applyCustomIcons() {
  try {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open('LunaIconBeautyDB', 1);
      req.onsuccess = e => res(e.target.result);
      req.onerror = () => rej();
    });
    const icons = await new Promise(res => {
      const r = db.transaction('icons').objectStore('icons').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => res([]);
    });
    icons.forEach(row => {
      const face = document.querySelector(`[data-app="${row.appId}"] .app-face, [data-app="${row.appId}"] .dock-face`);
      if (!face) return;
      face.innerHTML = `<img src="${row.imageData}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" alt=""/>`;
    });
  } catch(e) {}
}

// 监听 iconbeauty 保存事件
window.addEventListener('storage', e => {
  if (e.key === 'luna_icon_update') applyCustomIcons();
});