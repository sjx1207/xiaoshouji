/* ================================
   Luna Phone — settings.js
   设置页逻辑
================================ */

/* ================================
   状态栏同步（时间 + 电量）
================================ */
function updateTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const el = document.getElementById('statusTime');
  if (el) el.textContent = timeStr;
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
    navigator.getBattery().then(b => {
      render(b.level * 100);
      b.addEventListener('levelchange', () => render(b.level * 100));
    });
  } else {
    render(76);
  }
}

/* ================================
   返回 index
================================ */
function goBack() {
  const frame = document.querySelector('.luna-frame');
  frame.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
  frame.style.opacity = '0';
  frame.style.transform = 'scale(0.96)';
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 200);
}

// 阻止浏览器缓存快照（和index.html一致）
window.addEventListener('pageshow', (e) => {
  if (e.persisted) window.location.reload();
});

/* ================================
   搜索过滤（基础版）
================================ */
function filterSettings(val) {
  const sections = document.querySelectorAll('.st-section');
  const q = val.trim().toLowerCase();

  if (!q) {
    sections.forEach(s => s.style.display = '');
    return;
  }

  sections.forEach(section => {
    const rows = section.querySelectorAll('.st-row-title');
    let found = false;
    rows.forEach(r => {
      if (r.textContent.toLowerCase().includes(q)) found = true;
    });
    section.style.display = found ? '' : 'none';
  });
}

/* ================================
   深色模式 Toggle（演示）
================================ */
function toggleDarkMode() {
  const checked = document.getElementById('darkToggle').checked;
  // 此处可扩展真实深色逻辑
  console.log('Dark mode:', checked);
}

/* ================================
   时区数据（35个常见城市）
================================ */
const TZ_DATA = [
  { group: '中国', zones: [
    { name: '北京 / 上海',  tz: 'Asia/Shanghai',       offset: 'UTC+8',      short: '北京' },
    { name: '香港',          tz: 'Asia/Hong_Kong',      offset: 'UTC+8',      short: '香港' },
    { name: '台北',          tz: 'Asia/Taipei',         offset: 'UTC+8',      short: '台北' },
    { name: '乌鲁木齐',     tz: 'Asia/Urumqi',         offset: 'UTC+6',      short: '乌鲁木齐' },
  ]},
  { group: '东亚', zones: [
    { name: '东京',          tz: 'Asia/Tokyo',          offset: 'UTC+9',      short: '东京' },
    { name: '首尔',          tz: 'Asia/Seoul',          offset: 'UTC+9',      short: '首尔' },
    { name: '大阪',          tz: 'Asia/Tokyo',          offset: 'UTC+9',      short: '大阪' },
  ]},
  { group: '东南亚', zones: [
    { name: '新加坡',        tz: 'Asia/Singapore',      offset: 'UTC+8',      short: '新加坡' },
    { name: '曼谷',          tz: 'Asia/Bangkok',        offset: 'UTC+7',      short: '曼谷' },
    { name: '雅加达',        tz: 'Asia/Jakarta',        offset: 'UTC+7',      short: '雅加达' },
    { name: '吉隆坡',        tz: 'Asia/Kuala_Lumpur',   offset: 'UTC+8',      short: '吉隆坡' },
    { name: '马尼拉',        tz: 'Asia/Manila',         offset: 'UTC+8',      short: '马尼拉' },
    { name: '河内',          tz: 'Asia/Ho_Chi_Minh',    offset: 'UTC+7',      short: '河内' },
  ]},
  { group: '南亚 / 中东', zones: [
    { name: '孟买',          tz: 'Asia/Kolkata',        offset: 'UTC+5:30',   short: '孟买' },
    { name: '新德里',        tz: 'Asia/Kolkata',        offset: 'UTC+5:30',   short: '新德里' },
    { name: '迪拜',          tz: 'Asia/Dubai',          offset: 'UTC+4',      short: '迪拜' },
    { name: '利雅得',        tz: 'Asia/Riyadh',         offset: 'UTC+3',      short: '利雅得' },
    { name: '伊斯坦布尔',   tz: 'Europe/Istanbul',     offset: 'UTC+3',      short: '伊斯坦布尔' },
  ]},
  { group: '欧洲', zones: [
    { name: '伦敦',          tz: 'Europe/London',       offset: 'UTC+0/+1',   short: '伦敦' },
    { name: '巴黎',          tz: 'Europe/Paris',        offset: 'UTC+1/+2',   short: '巴黎' },
    { name: '柏林',          tz: 'Europe/Berlin',       offset: 'UTC+1/+2',   short: '柏林' },
    { name: '罗马',          tz: 'Europe/Rome',         offset: 'UTC+1/+2',   short: '罗马' },
    { name: '马德里',        tz: 'Europe/Madrid',       offset: 'UTC+1/+2',   short: '马德里' },
    { name: '莫斯科',        tz: 'Europe/Moscow',       offset: 'UTC+3',      short: '莫斯科' },
    { name: '阿姆斯特丹',   tz: 'Europe/Amsterdam',    offset: 'UTC+1/+2',   short: '阿姆斯特丹' },
  ]},
  { group: '非洲', zones: [
    { name: '开罗',          tz: 'Africa/Cairo',        offset: 'UTC+2',      short: '开罗' },
    { name: '约翰内斯堡',   tz: 'Africa/Johannesburg', offset: 'UTC+2',      short: '约翰内斯堡' },
    { name: '拉各斯',        tz: 'Africa/Lagos',        offset: 'UTC+1',      short: '拉各斯' },
  ]},
  { group: '北美洲', zones: [
    { name: '纽约',          tz: 'America/New_York',    offset: 'UTC-5/-4',   short: '纽约' },
    { name: '芝加哥',        tz: 'America/Chicago',     offset: 'UTC-6/-5',   short: '芝加哥' },
    { name: '洛杉矶',        tz: 'America/Los_Angeles', offset: 'UTC-8/-7',   short: '洛杉矶' },
    { name: '多伦多',        tz: 'America/Toronto',     offset: 'UTC-5/-4',   short: '多伦多' },
    { name: '温哥华',        tz: 'America/Vancouver',   offset: 'UTC-8/-7',   short: '温哥华' },
    { name: '墨西哥城',     tz: 'America/Mexico_City', offset: 'UTC-6/-5',   short: '墨西哥城' },
  ]},
  { group: '南美洲', zones: [
    { name: '圣保罗',        tz: 'America/Sao_Paulo',   offset: 'UTC-3',      short: '圣保罗' },
    { name: '布宜诺斯艾利斯', tz: 'America/Argentina/Buenos_Aires', offset: 'UTC-3', short: '布宜诺斯艾利斯' },
  ]},
  { group: '大洋洲', zones: [
    { name: '悉尼',          tz: 'Australia/Sydney',    offset: 'UTC+10/+11', short: '悉尼' },
    { name: '墨尔本',        tz: 'Australia/Melbourne', offset: 'UTC+10/+11', short: '墨尔本' },
    { name: '奥克兰',        tz: 'Pacific/Auckland',    offset: 'UTC+12/+13', short: '奥克兰' },
    { name: '檀香山',        tz: 'Pacific/Honolulu',    offset: 'UTC-10',     short: '檀香山' },
  ]},
  { group: 'UTC', zones: [
    { name: '协调世界时',    tz: 'UTC',                 offset: 'UTC+0',      short: 'UTC' },
  ]},
];

/* ================================
   时区状态
================================ */
let currentTz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
let tzClockTimer = null;

function getTzItem(tz) {
  for (const g of TZ_DATA) {
    const f = g.zones.find(z => z.tz === tz);
    if (f) return f;
  }
  return null;
}

// 获取某时区当前时间字符串
function getTimeInTz(tz) {
  try {
    return new Date().toLocaleTimeString('zh-CN', {
      timeZone: tz,
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    });
  } catch(e) { return '--:--:--'; }
}

// 同步设置页时区行显示
function applyTzDisplay(tz) {
  const item = getTzItem(tz);
  if (!item) return;
  const valEl = document.getElementById('tzCurrentVal');
  const subEl = document.getElementById('tzCurrentSub');
  if (valEl) valEl.textContent = item.short;
  if (subEl) subEl.textContent = `${item.tz} · ${item.offset}`;
}

// 时区页顶部实时时钟
function startTzClock() {
  function tick() {
    const timeEl = document.getElementById('tzLiveTime');
    const nameEl = document.getElementById('tzLiveName');
    const item = getTzItem(currentTz);
    if (timeEl) timeEl.textContent = getTimeInTz(currentTz);
    if (nameEl && item) nameEl.textContent = `${item.tz} · ${item.offset} · ${item.short}`;
  }
  tick();
  tzClockTimer = setInterval(tick, 1000);
}

function stopTzClock() {
  if (tzClockTimer) { clearInterval(tzClockTimer); tzClockTimer = null; }
}

/* ================================
   时区子页面开关
================================ */
function openTzPanel() {
  const page = document.getElementById('tzPage');
  page.classList.add('show');
  document.getElementById('tzSearchInput').value = '';
  renderTzList(TZ_DATA);
  startTzClock();
}

function closeTzPage() {
  const page = document.getElementById('tzPage');
  page.style.transition = 'transform 0.28s cubic-bezier(0.32,0.72,0,1)';
  page.classList.remove('show');
  stopTzClock();
}

/* ================================
   选择时区 → 存 localStorage + IndexedDB
================================ */
async function selectTz(tz) {
  currentTz = tz;
  localStorage.setItem('luna_tz', tz);

  // 同时写入 IndexedDB（供 index.html / widget 读取）
  try {
    const db = await openTzDB();
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ id: 'timezone', tz });
  } catch(e) {}

  // 更新顶部实时时钟显示
  const timeEl = document.getElementById('tzLiveTime');
  const nameEl = document.getElementById('tzLiveName');
  const item = getTzItem(tz);
  if (timeEl) timeEl.textContent = getTimeInTz(tz);
  if (nameEl && item) nameEl.textContent = `${item.tz} · ${item.offset} · ${item.short}`;

  // 更新设置行的值
  applyTzDisplay(tz);

  // 刷新列表选中状态
  renderTzList(currentFilter ? filterTzData(currentFilter) : TZ_DATA);

  // 通知 index.html 更新
  try { localStorage.setItem('luna_tz_update', Date.now().toString()); } catch(e) {}
}

/* ================================
   IndexedDB（时区专用）
================================ */
let _tzDb = null;
function openTzDB() {
  return new Promise((res, rej) => {
    if (_tzDb) return res(_tzDb);
    const req = indexedDB.open('LunaTzDB', 2);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('settings', { keyPath: 'id' });
    };
    req.onsuccess = e => { _tzDb = e.target.result; res(_tzDb); };
  });
}

/* ================================
   渲染列表（每项显示当地实时时间）
================================ */
function renderTzList(data) {
  const list = document.getElementById('tzList');
  if (!list) return;

  list.innerHTML = data.map(group => `
    <div class="tz-group-label">${group.group}</div>
    <div class="tz-group">
      ${group.zones.map(z => `
        <div class="tz-item ${z.tz === currentTz ? 'selected' : ''}" onclick="selectTz('${z.tz}')">
          <div class="tz-item-text">
            <div class="tz-item-name">${z.name}</div>
            <div class="tz-item-detail">${z.tz} · ${z.offset}</div>
          </div>
          <div class="tz-item-right">
            <div class="tz-item-time">${getTimeInTz(z.tz).slice(0,5)}</div>
            <svg class="tz-item-check" viewBox="0 0 24 24" width="15" height="15" fill="none">
              <polyline points="20 6 9 17 4 12" stroke="#007aff" stroke-width="2.2"
                stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

/* ================================
   搜索过滤
================================ */
let currentFilter = '';
function filterTzData(q) {
  return TZ_DATA.map(g => ({
    ...g,
    zones: g.zones.filter(z =>
      z.name.includes(q) || z.short.includes(q) ||
      z.tz.toLowerCase().includes(q.toLowerCase())
    )
  })).filter(g => g.zones.length > 0);
}
function filterTz(val) {
  currentFilter = val.trim();
  renderTzList(currentFilter ? filterTzData(currentFilter) : TZ_DATA);
}

async function applyGlobalFont() {
  const style = JSON.parse(localStorage.getItem('luna_font_style') || '{}');
  const name  = localStorage.getItem('luna_font_active_name');
  const id    = parseInt(localStorage.getItem('luna_font_active_id'));

  // 注入 !important style 覆盖 CSS 写死的颜色（与 script.js 保持一致）
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

  // 再处理字体
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
    document.body.style.fontFamily = `'${name}', sans-serif`;
  }
}

/* ================================
   初始化
================================ */
document.addEventListener('DOMContentLoaded', () => {
  updateTime();
  updateBattery();
  setInterval(updateTime, 1000);
  applyTzDisplay(currentTz);
  applyGlobalFont();
  applyIsland();
  updateApiSubtitle();

  // ✅ 新增：监听灵动岛变化，实时同步设置页状态栏
  window.addEventListener('storage', (e) => {
    if (e.key === 'luna_island_update') {
      applyIsland();
    }
  });
});

/* ================================
   字体设置页
================================ */

// 当前预览状态
let fontPickedColor = '#1a1a2e';
let fontPickedSize  = 16;
let fontPickedName  = '';      // 当前载入的字体名（FontFace name）
let fontPickedLabel = '';
let fontPickedData  = null;    // base64 或 url
let activeFontId    = null;    // 已保存列表中正在使用的id

/* 开关页面 */
function openFontPage() {
  document.getElementById('fontPage').classList.add('show');
  loadFontSavedList();
  applyFontPreview();
  // 读取已保存的颜色/大小
  const saved = JSON.parse(localStorage.getItem('luna_font_style') || '{}');
  if (saved.color) {
    fontPickedColor = saved.color;
    updateFontColorUI(saved.color);
    // 恢复色块选中状态
    document.querySelectorAll('.font-swatch').forEach(s => {
      s.classList.toggle('selected', s.dataset.color === saved.color);
    });
  }
  if (saved.size) {
    fontPickedSize = saved.size;
    document.getElementById('fontSizeSlider').value = saved.size;
    document.getElementById('fontSizeVal').textContent = saved.size + 'px';
  }
  activeFontId = localStorage.getItem('luna_font_active_id') || null;
  applyFontPreview();
}

function closeFontPage() {
  const page = document.getElementById('fontPage');
  page.style.transition = 'transform 0.28s cubic-bezier(0.32,0.72,0,1)';
  page.classList.remove('show');
}

/* tab 切换 */
function switchFontTab(tab) {
  document.getElementById('fontTabFile').classList.toggle('active', tab === 'file');
  document.getElementById('fontTabUrl').classList.toggle('active', tab === 'url');
  document.getElementById('fontPanelFile').style.display = tab === 'file' ? 'block' : 'none';
  document.getElementById('fontPanelUrl').style.display  = tab === 'url'  ? 'block' : 'none';
}

/* 实时预览 */
function applyFontPreview() {
  const el  = document.getElementById('fontPreviewText');
  const sub = document.getElementById('fontPreviewSub');
  if (!el) return;
  el.style.color    = fontPickedColor;
  el.style.fontSize = fontPickedSize + 'px';
  sub.style.color   = fontPickedColor;
  sub.style.fontSize = Math.max(10, fontPickedSize - 12) + 'px';
  if (fontPickedName) {
    el.style.fontFamily  = `'${fontPickedName}', sans-serif`;
    sub.style.fontFamily = `'${fontPickedName}', sans-serif`;
  }
}

/* 大小滑块 */
function onFontSizeChange(val) {
  fontPickedSize = parseInt(val);
  document.getElementById('fontSizeVal').textContent = val + 'px';
  // 更新滑块渐变进度
  const slider = document.getElementById('fontSizeSlider');
  const pct = ((val - 10) / (24 - 10) * 100).toFixed(1);
  slider.style.background =
    `linear-gradient(90deg, #007aff ${pct}%, rgba(100,100,200,0.15) ${pct}%)`;
  applyFontPreview();
}

/* ---- 颜色色块选择 ---- */
function pickSwatch(el) {
  const hex = el.dataset.color;
  fontPickedColor = hex;
  // 更新选中状态
  document.querySelectorAll('.font-swatch').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
  updateFontColorUI(hex);
  applyFontPreview();
}

function updateFontColorUI(hex) {
  const dot = document.getElementById('fontColorDot');
  const hexEl = document.getElementById('fontColorHex');
  if (dot)   dot.style.background = hex;
  if (hexEl) hexEl.textContent     = hex;
}

/* ---- 页面内输入弹窗（替代 prompt）---- */
function showInputModal(title, defaultVal) {
  return new Promise(res => {
    const mask    = document.getElementById('lunaInputMask');
    const input   = document.getElementById('lunaInputField');
    const titleEl = document.getElementById('lunaInputTitle');
    const cancelBtn  = document.getElementById('lunaInputCancel');
    const confirmBtn = document.getElementById('lunaInputConfirm');
    titleEl.textContent = title;
    input.value = defaultVal || '';
    mask.classList.add('show');
    setTimeout(() => input.focus(), 100);
    function close(val) {
      mask.classList.remove('show');
      cancelBtn.onclick = null; confirmBtn.onclick = null;
      res(val);
    }
    cancelBtn.onclick  = () => close(null);
    confirmBtn.onclick = () => close(input.value.trim() || defaultVal);
  });
}

/* ---- 页面内确认弹窗（替代 confirm）---- */
function showConfirmModal(title, desc) {
  return new Promise(res => {
    const mask    = document.getElementById('lunaConfirmMask');
    const titleEl = document.getElementById('lunaConfirmTitle');
    const descEl  = document.getElementById('lunaConfirmDesc');
    const cancelBtn = document.getElementById('lunaConfirmCancel');
    const okBtn     = document.getElementById('lunaConfirmOk');
    titleEl.textContent = title;
    descEl.textContent  = desc;
    mask.classList.add('show');
    function close(val) {
      mask.classList.remove('show');
      cancelBtn.onclick = null; okBtn.onclick = null;
      res(val);
    }
    cancelBtn.onclick = () => close(false);
    okBtn.onclick     = () => close(true);
  });
}

/* ---- 文件上传 ---- */
function handleFontFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    const dataUrl = e.target.result;
    const userInput = await showInputModal('请输入字体名称', file.name.replace(/\.[^.]+$/, ''));
    if (userInput === null) return;
    const label = userInput.trim() || ('字体_' + Date.now());
    const name = 'LunaFont_' + Date.now();
    registerFont(name, dataUrl);
    fontPickedName = name;
    fontPickedData = dataUrl;
    fontPickedLabel = label;
    applyFontPreview();
  };
  reader.readAsDataURL(file);
}

/* ---- URL 载入 ---- */
async function loadFontFromUrl() {
  const url = document.getElementById('fontUrlInput').value.trim();
  if (!url) return;
  const userInput = await showInputModal('请输入字体名称', '自定义字体');
  if (userInput === null) return;
  const label = userInput.trim() || ('字体_' + Date.now());
  const name = 'LunaFont_' + Date.now();
  try {
    registerFont(name, url);
    fontPickedName = name;
    fontPickedData = url;
    fontPickedLabel = label;
    applyFontPreview();
  } catch(e) {
    alert('字体载入失败，请检查链接');
  }
}

/* ---- 注册 FontFace ---- */
function registerFont(name, src) {
  const face = new FontFace(name, `url(${src})`);
  face.load().then(f => {
    document.fonts.add(f);
    applyFontPreview();
  });
}

/* ---- IndexedDB 字体存储 ---- */
let _fontDb = null;
function openFontDB() {
  return new Promise((res, rej) => {
    if (_fontDb) return res(_fontDb);
    const req = indexedDB.open('LunaFontDB', 3);  // ← 只改这里，1 → 2
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('fonts')) {  // ← 加这个判断，防止重复创建报错
        db.createObjectStore('fonts', { keyPath: 'id' });
      }
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
async function fontDbSave(item) {
  const db = await openFontDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('fonts', 'readwrite');
    tx.objectStore('fonts').put(item);
    tx.oncomplete = res; tx.onerror = rej;
  });
}
async function fontDbDelete(id) {
  const db = await openFontDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('fonts', 'readwrite');
    tx.objectStore('fonts').delete(id);
    tx.oncomplete = res; tx.onerror = rej;
  });
}

/* ---- 保存并应用 ---- */
async function saveFontSettings() {
  // 保存颜色和大小到 localStorage（全局同步用）
  const style = { color: fontPickedColor, size: fontPickedSize };
  localStorage.setItem('luna_font_style', JSON.stringify(style));

  // 如果有新载入的字体，存入DB
  if (fontPickedData && fontPickedName) {
    const id = Date.now();
    await fontDbSave({
      id,
      name: fontPickedName,
      label: fontPickedLabel || fontPickedName,
      data: fontPickedData,
      savedAt: new Date().toLocaleString()
    });
    activeFontId = id;
    localStorage.setItem('luna_font_active_id', id);
    localStorage.setItem('luna_font_active_name', fontPickedName);
    fontPickedData = null; // 防止重复保存
    loadFontSavedList();
  } else if (activeFontId) {
    localStorage.setItem('luna_font_active_id', activeFontId);
  }

  // 通知其他页面
  localStorage.setItem('luna_font_update', Date.now().toString());

  // 设置页自身也立刻同步
  applyGlobalFont();

  // 按钮反馈
  const btn = document.querySelector('.font-save-btn');
  btn.textContent = '✓ 已保存';
  setTimeout(() => { btn.textContent = '保存并应用'; }, 1800);
}

/* ---- 已保存字体列表 ---- */
async function loadFontSavedList() {
  const list = document.getElementById('fontSavedList');
  if (!list) return;
  const fonts = await fontDbGetAll();
  activeFontId = parseInt(localStorage.getItem('luna_font_active_id')) || null;

  if (!fonts.length) {
    list.innerHTML = '<div class="font-empty">还没有保存的字体</div>';
    return;
  }

  list.innerHTML = fonts.map(f => `
    <div class="font-saved-item ${f.id === activeFontId ? 'active-font' : ''}"
      id="fsitem-${f.id}" onclick="selectSavedFont(${f.id})">
      <div class="font-saved-name">${f.label || f.name.replace(/^LunaFont_\d+$/, '自定义字体')}</div>
      <div class="font-saved-preview" style="font-family:'${f.name}',sans-serif;">Aa</div>
      <svg class="font-saved-check" viewBox="0 0 24 24" width="15" height="15" fill="none">
        <polyline points="20 6 9 17 4 12" stroke="#007aff" stroke-width="2.2"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <button class="font-saved-del" onclick="deleteSavedFont(event,${f.id})">✕</button>
    </div>
  `).join('');

  // 重新注册已存字体（页面刷新后需要）
  fonts.forEach(f => registerFont(f.name, f.data));
}

async function selectSavedFont(id) {
  const fonts = await fontDbGetAll();
  const f = fonts.find(x => x.id === id);
  if (!f) return;
  activeFontId   = id;
  fontPickedName = f.name;
  registerFont(f.name, f.data);
  applyFontPreview();
  // 刷新列表选中
  document.querySelectorAll('.font-saved-item').forEach(el => {
    el.classList.toggle('active-font', el.id === 'fsitem-' + id);
  });
}

async function deleteSavedFont(e, id) {
  e.stopPropagation();
  const ok = await showConfirmModal('删除字体', '确定要删除这个字体吗？删除后无法恢复。');
  if (!ok) return;
  await fontDbDelete(id);
  if (activeFontId === id) {
    activeFontId = null;
    localStorage.removeItem('luna_font_active_id');
    localStorage.removeItem('luna_font_active_name');
  }
  loadFontSavedList();
}

/* ================================
   灵动岛页面
================================ */
function openIslandPage() {
  const page = document.getElementById('islandPage');
  page.classList.add('show');
  // 恢复开关和样式状态
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  document.getElementById('islandToggle').checked = enabled;
  document.getElementById('islandPreviewSection').style.display = enabled ? '' : 'none';
  document.getElementById('islandStyleSection').style.display   = enabled ? '' : 'none';
  if (enabled) {
    document.querySelectorAll('.di-style-card').forEach(c =>
      c.classList.toggle('selected', c.dataset.style === style));
    document.querySelectorAll('.di-style-check').forEach(c => c.style.opacity = '0');
    const chk = document.getElementById('check-' + style);
    if (chk) chk.style.opacity = '1';
  }
  updateIslandPreview(style);
}

function closeIslandPage() {
  document.getElementById('islandPage').classList.remove('show');
}

function onIslandToggle(enabled) {
  localStorage.setItem('luna_island_enabled', enabled);
  document.getElementById('islandPreviewSection').style.display = enabled ? '' : 'none';
  document.getElementById('islandStyleSection').style.display   = enabled ? '' : 'none';
  if (!enabled) localStorage.removeItem('luna_island_style');
  applyIsland(); // ✅ 开关切换也立刻同步
}

function selectIslandStyle(style) {
  localStorage.setItem('luna_island_style', style);
  // 卡片选中态
  document.querySelectorAll('.di-style-card').forEach(c =>
    c.classList.toggle('selected', c.dataset.style === style));
  document.querySelectorAll('.di-style-check').forEach(c => c.style.opacity = '0');
  const chk = document.getElementById('check-' + style);
  if (chk) chk.style.opacity = '1';
  updateIslandPreview(style);
  localStorage.setItem('luna_island_update', Date.now().toString());
  applyIsland(); // ✅ 新增这一行，立刻同步状态栏
}

function updateIslandPreview(style) {
  const allStyles = ['minimal','glow','clock','pulse','ripple','rainbow','music','scan'];

  // 隐藏所有预览元素
  ['pvGlowRing','pvRippleRing','pvRainbowPill','pvScanPill','pvClockWrap','pvMusicBars','pvPulseDots']
    .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });

  // 重置预览框发光
  const frame = document.getElementById('islandPreviewEl');
  if (frame) frame.style.boxShadow = '0 8px 32px rgba(0,0,0,0.28)';

  // 按样式显示对应元素
  if (style === 'glow') {
    document.getElementById('pvGlowRing').style.display = '';
    frame.style.boxShadow = '0 0 24px 10px rgba(255,255,255,0.4), 0 8px 32px rgba(0,0,0,0.28)';
  } else if (style === 'clock') {
    document.getElementById('pvClockWrap').style.display = 'flex';
    clearInterval(window._pvClockTimer);
    const tick = () => {
      const el = document.getElementById('pvClockTime');
      if (!el) return;
      const now = new Date();
      el.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0');
    };
    tick();
    window._pvClockTimer = setInterval(tick, 10000);
  } else if (style === 'pulse') {
    document.getElementById('pvPulseDots').style.display = 'flex';
  } else if (style === 'ripple') {
    document.getElementById('pvRippleRing').style.display = '';
  } else if (style === 'rainbow') {
    document.getElementById('pvRainbowPill').style.display = '';
  } else if (style === 'music') {
    document.getElementById('pvMusicBars').style.display = 'flex';
  } else if (style === 'scan') {
    document.getElementById('pvScanPill').style.display = '';
  }
  // minimal 什么都不加，就是纯黑胶囊

  if (style !== 'clock') clearInterval(window._pvClockTimer);
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
   AI 模型页面
================================ */

// IndexedDB
const apiDbName = 'LunaApiDB';
const apiStoreName = 'presets';
let apiDb = null;

function openApiDb() {
  return new Promise((res, rej) => {
    if (apiDb) return res(apiDb);
    const req = indexedDB.open(apiDbName, 2);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(apiStoreName, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = e => { apiDb = e.target.result; res(apiDb); };
    req.onerror = () => rej(req.error);
  });
}

async function apiDbGetAll() {
  const db = await openApiDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(apiStoreName, 'readonly');
    const req = tx.objectStore(apiStoreName).getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function apiDbAdd(item) {
  const db = await openApiDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(apiStoreName, 'readwrite');
    const req = tx.objectStore(apiStoreName).add(item);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function apiDbDelete(id) {
  const db = await openApiDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(apiStoreName, 'readwrite');
    const req = tx.objectStore(apiStoreName).delete(id);
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}

// 页面状态
let apiSelectedModel = '';
let apiDeleteTargetId = null;

function openApiPage() {
  document.getElementById('apiPage').classList.add('show');
  loadApiPresetList();
  // 恢复上次输入
  const saved = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  if (saved.baseUrl) document.getElementById('apiBaseUrl').value = saved.baseUrl;
  if (saved.apiKey)  document.getElementById('apiKey').value  = saved.apiKey;
  onApiConfigInput();
}

function closeApiPage() {
  document.getElementById('apiPage').classList.remove('show');
}

function onApiConfigInput() {
  const url = document.getElementById('apiBaseUrl').value.trim();
  const key = document.getElementById('apiKey').value.trim();
  document.getElementById('apiFetchBtn').disabled = !(url && key);
}

function toggleApiKeyVisible() {
  const inp = document.getElementById('apiKey');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

async function fetchModels() {
  const baseUrl = document.getElementById('apiBaseUrl').value.trim().replace(/\/$/, '');
  const apiKey  = document.getElementById('apiKey').value.trim();
  if (!baseUrl || !apiKey) return;

  const btn = document.getElementById('apiFetchBtn');
  btn.disabled = true;
  btn.textContent = '获取中...';

  const modelSection = document.getElementById('apiModelSection');
  const loading      = document.getElementById('apiModelLoading');
  const listEl       = document.getElementById('apiModelList');

  modelSection.style.display = '';
  loading.style.display = 'flex';
  listEl.innerHTML = '';

  try {
    const resp = await fetch(`${baseUrl}/models`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const models = (data.data || []).map(m => m.id).sort();

    loading.style.display = 'none';

    if (!models.length) {
      listEl.innerHTML = '<div class="font-empty">未获取到模型，请检查配置</div>';
      return;
    }

    listEl.innerHTML = models.map(id => `
      <div class="api-model-item" id="model-${id.replace(/[^a-zA-Z0-9]/g,'-')}" onclick="selectModel('${id}')">
        <div class="api-model-dot"></div>
        <div class="api-model-name">${id}</div>
        <svg class="api-model-check" viewBox="0 0 24 24" width="14" height="14" fill="none">
          <polyline points="20 6 9 17 4 12" stroke="#6366f1" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    `).join('');

    // 存当前配置
    localStorage.setItem('luna_api_current', JSON.stringify({ baseUrl, apiKey }));

  } catch(e) {
    loading.style.display = 'none';
    listEl.innerHTML = `<div class="font-empty" style="color:#ff3b30;">获取失败：${e.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = '获取可用模型';
  }
}

function selectModel(id) {
  apiSelectedModel = id;
  document.querySelectorAll('.api-model-item').forEach(el => {
    el.classList.toggle('selected', el.onclick.toString().includes(`'${id}'`));
  });
  // 用更稳定的方式重新标记选中
  document.querySelectorAll('.api-model-item').forEach(el => {
    el.classList.remove('selected');
  });
  const safeId = id.replace(/[^a-zA-Z0-9]/g,'-');
  const target = document.getElementById('model-' + safeId);
  if (target) target.classList.add('selected');

  document.getElementById('apiTestSection').style.display = '';
  document.getElementById('apiSaveSection').style.display = '';
}

async function sendApiTest() {
  const baseUrl = document.getElementById('apiBaseUrl').value.trim().replace(/\/$/, '');
  const apiKey  = document.getElementById('apiKey').value.trim();
  const msg     = document.getElementById('apiTestInput').value.trim();
  const output  = document.getElementById('apiTestOutput');

  if (!msg || !apiSelectedModel) return;

  const btn = document.getElementById('apiSendBtn');
  btn.disabled = true;
  output.innerHTML = '<div class="api-spinner" style="margin:auto;"></div>';

  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: apiSelectedModel,
        messages: [{ role: 'user', content: msg }],
        max_tokens: 512
      })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const reply = data.choices?.[0]?.message?.content || '（无回复）';
    output.innerHTML = `
      <div style="font-size:11px;color:rgba(60,60,90,0.35);margin-bottom:6px;">${apiSelectedModel}</div>
      <div>${reply.replace(/\n/g,'<br>')}</div>
    `;
    document.getElementById('apiTestInput').value = '';
  } catch(e) {
    output.innerHTML = `<div style="color:#ff3b30;font-size:13px;">请求失败：${e.message}</div>`;
  } finally {
    btn.disabled = false;
  }
}

// 保存预设弹窗
function openSaveApiModal() {
  document.getElementById('apiPresetNameInput').value = '';
  document.getElementById('apiSaveMask').classList.add('show');
  setTimeout(() => document.getElementById('apiPresetNameInput').focus(), 200);
}
function closeSaveApiModal() {
  document.getElementById('apiSaveMask').classList.remove('show');
}
async function confirmSaveApi() {
  const name    = document.getElementById('apiPresetNameInput').value.trim();
  const baseUrl = document.getElementById('apiBaseUrl').value.trim();
  const apiKey  = document.getElementById('apiKey').value.trim();
  if (!name) return;
  await apiDbAdd({ name, baseUrl, apiKey, model: apiSelectedModel, time: Date.now() });
  closeSaveApiModal();
  loadApiPresetList();
}

// 删除预设弹窗
function openDeleteApiModal(id, name) {
  apiDeleteTargetId = id;
  document.getElementById('apiDeleteDesc').textContent = `确定要删除预设「${name}」吗？删除后无法恢复。`;
  document.getElementById('apiDeleteMask').classList.add('show');
}
function closeDeleteApiModal() {
  document.getElementById('apiDeleteMask').classList.remove('show');
  apiDeleteTargetId = null;
}
async function confirmDeleteApi() {
  if (!apiDeleteTargetId) return;
  await apiDbDelete(apiDeleteTargetId);
  closeDeleteApiModal();
  loadApiPresetList();
}

// 加载预设列表
async function loadApiPresetList() {
  const list    = document.getElementById('apiPresetList');
  if (!list) return;
  const presets = await apiDbGetAll();
  const activeId = parseInt(localStorage.getItem('luna_api_active_id')) || null;

  if (!presets.length) {
    list.innerHTML = '<div class="font-empty">还没有保存的预设</div>';
    return;
  }

  list.innerHTML = presets.map(p => `
    <div class="api-preset-item ${p.id === activeId ? 'active-preset' : ''}" onclick="applyApiPreset(${p.id})">
      <div class="api-preset-icon">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
          <circle cx="12" cy="12" r="3" stroke="#6366f1" stroke-width="1.6"/>
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="#6366f1" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="api-preset-info">
        <div class="api-preset-name">${p.name}</div>
        <div class="api-preset-meta">${p.model || '未选择模型'} · ${p.baseUrl ? new URL(p.baseUrl).hostname : '-'}</div>
      </div>
      ${p.id === activeId ? '<span class="api-preset-active-tag">使用中</span>' : ''}
      <button class="api-preset-del" onclick="event.stopPropagation();openDeleteApiModal(${p.id},'${p.name.replace(/'/g,"\\'")}')">✕</button>
    </div>
  `).join('');

  updateApiSubtitle();
}

async function applyApiPreset(id) {
  const presets = await apiDbGetAll();
  const p = presets.find(x => x.id === id);
  if (!p) return;
  localStorage.setItem('luna_api_active_id', id);
  localStorage.setItem('luna_api_current', JSON.stringify({ baseUrl: p.baseUrl, apiKey: p.apiKey }));
  localStorage.setItem('luna_api_model', p.model || '');   // ← 加这一行
  // 填入表单
  document.getElementById('apiBaseUrl').value = p.baseUrl;
  document.getElementById('apiKey').value = p.apiKey;
  apiSelectedModel = p.model || '';
  onApiConfigInput();
  loadApiPresetList();
}

function updateApiSubtitle() {
  const sub = document.getElementById('apiCurrentSub');
  if (!sub) return;
  const activeId = parseInt(localStorage.getItem('luna_api_active_id')) || null;
  if (!activeId) { sub.textContent = '未配置'; return; }
  const cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  sub.textContent = model || (cur.baseUrl ? new URL(cur.baseUrl).hostname : '已配置');
}