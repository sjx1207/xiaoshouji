/* ================================
   Archive — archive.js
   从 LunaCharDB 读取角色数据并渲染明信片档案
================================ */
// 同步字体（只同步字体名，不同步颜色和字号）
(function syncFontToArchive() {
  let _fontDb = null;

  function openFontDB() {
    return new Promise((res, rej) => {
      if (_fontDb) return res(_fontDb);
      const req = indexedDB.open('LunaFontDB', 2);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('fonts')) {
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

  function applyStyleTag(name) {
    let tag = document.getElementById('archive-font-override');
    if (!tag) {
      tag = document.createElement('style');
      tag.id = 'archive-font-override';
      document.head.appendChild(tag);
    }
    if (name) {
      tag.textContent = `* { font-family: '${name}', sans-serif !important; }`;
    } else {
      tag.textContent = '';
    }
  }

  async function applyFontOnly() {
    try {
      const name = localStorage.getItem('luna_font_active_name') || '';
      if (!name) { applyStyleTag(''); return; }

      // 从 IndexedDB 取出字体数据并注册
      const fonts = await fontDbGetAll();
      const found = fonts.find(f => f.name === name);
      if (found && found.data) {
        const face = new FontFace(name, `url(${found.data})`);
        const loaded = await face.load();
        document.fonts.add(loaded);
      }

      // 注册完成后再应用样式
      applyStyleTag(name);
    } catch(e) {}
  }

  // 页面加载时立即执行
  applyFontOnly();

  // 监听设置页保存字体时的通知
  window.addEventListener('storage', function(e) {
    if (e.key === 'luna_font_update' || e.key === 'luna_font_active_name') {
      applyFontOnly();
    }
  });
})();
/* ---- 返回首页 ---- */
function goBack() {
  const mask = document.createElement('div');
  mask.style.cssText = 'position:fixed;inset:0;background:rgba(245,244,241,0.97);opacity:0;z-index:9999;transition:opacity 0.28s ease;pointer-events:all;';
  document.body.appendChild(mask);
  requestAnimationFrame(() => { mask.style.opacity = '1'; });
  setTimeout(() => { window.location.href = 'index.html'; }, 260);
}

function goToCharacters() {
  const mask = document.createElement('div');
  mask.style.cssText = 'position:fixed;inset:0;background:rgba(245,244,241,0.97);opacity:0;z-index:9999;transition:opacity 0.28s ease;pointer-events:all;';
  document.body.appendChild(mask);
  requestAnimationFrame(() => { mask.style.opacity = '1'; });
  setTimeout(() => { window.location.href = 'characters.html'; }, 260);
}

/* ================================
   状态栏时间
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
   电量
================================ */
function updateBattery() {
  function render(pct) {
    const p = Math.round(pct);
    document.querySelectorAll('.bat-pct').forEach(el => el.textContent = p);
    document.querySelectorAll('.bat-inner').forEach(el => {
      el.style.width = p + '%';
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
   灵动岛
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

window.addEventListener('storage', (e) => {
  if (e.key === 'luna_island_update') applyIsland();
  if (e.key === 'luna_tz_update')     updateTime();
});

/* ================================
   IndexedDB — 读取 LunaCharDB
================================ */
let _db = null;

function openCharDB() {
  return new Promise((res, rej) => {
    if (_db) return res(_db);
    const req = indexedDB.open('LunaCharDB', 1);
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

async function saveCharDB(data) {
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
   数据状态
================================ */
let _chars    = [];
let _activeId = null;
let _viewingId = null;

/* ================================
   条形码高度生成（装饰用）
================================ */
function barcodeHeights(seed, count) {
  const heights = [];
  let s = seed;
  for (let i = 0; i < count; i++) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    heights.push(10 + Math.abs(s % 22));
  }
  return heights;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ================================
   渲染列表
================================ */
async function renderList() {
  _chars    = await getAllChars();
  _activeId = parseInt(localStorage.getItem('luna_active_char')) || null;

  const list    = document.getElementById('arcList');
  const countEl = document.getElementById('arcCount');
  const activeEl = document.getElementById('arcActive');

  if (countEl) countEl.textContent = String(_chars.length).padStart(2, '0');

  const activeChar = _chars.find(c => c.id === _activeId);
  if (activeEl) activeEl.textContent = activeChar ? activeChar.name : '—';

  if (_chars.length === 0) {
    list.innerHTML = `
      <div class="arc-empty">
        <div class="arc-empty-line"></div>
        <div class="arc-empty-title">档案空空如也</div>
        <div class="arc-empty-desc">前往角色书创建你的第一个角色<br>再回来查看档案</div>
        <button class="arc-empty-btn" onclick="goToCharacters()">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          前往角色书
        </button>
      </div>`;
    return;
  }

  list.innerHTML = '';
  _chars.forEach((c, i) => {
    const card = buildListCard(c, i + 1);
    card.style.animationDelay = `${0.04 + i * 0.08}s`;
    list.appendChild(card);
  });
}

/* ================================
   构建列表卡片
================================ */
function buildListCard(c, idx) {
  const isActive = c.id === _activeId;
  const letter   = (c.name || '?')[0].toUpperCase();
  const idxStr   = String(idx).padStart(3, '0');
  const traits   = (c.traits || []).slice(0, 2);
  const heights  = barcodeHeights(c.id || idx, 8);

  const div = document.createElement('div');
  div.className  = 'arc-card' + (isActive ? ' arc-card-active' : '');
  div.dataset.id = c.id;

  // 顶部图片/颜色区
  const topBgStyle = c.cardBg
    ? `background-image: url(${c.cardBg}); background-size: cover; background-position: center;`
    : `background: linear-gradient(135deg, #f0ede8, #e8e4de);`;

  div.innerHTML = `
    <div class="arc-card-top">
      <div class="arc-card-top-bg" style="${topBgStyle}"></div>
      <div class="arc-card-top-overlay"></div>
      ${isActive ? `<div class="arc-card-active-dot"><div class="arc-active-pulse"></div><span class="arc-active-text">激活中</span></div>` : ''}
      <div class="arc-card-mini-stamp">
        ${c.avatar
          ? `<img class="arc-mini-stamp-img" src="${c.avatar}" alt=""/>`
          : `<span class="arc-mini-stamp-letter">${escHtml(letter)}</span>`}
      </div>
    </div>
    <div class="arc-card-body">
      <div class="arc-card-info">
        <div class="arc-card-name">${escHtml(c.name || '—')}</div>
        <div class="arc-card-role">${escHtml(c.role || '—')}</div>
        <div class="arc-card-meta">
          ${traits.map(t => `<span class="arc-card-tag">${escHtml(t)}</span>`).join('')}
          ${c.gender ? `<span class="arc-card-tag">${escHtml(c.gender)}</span>` : ''}
        </div>
      </div>
      <div class="arc-card-right">
        <div class="arc-card-serial">NO. ${idxStr}</div>
        <div class="arc-card-barcode">
          ${heights.map(h => `<span style="height:${h}px"></span>`).join('')}
        </div>
      </div>
    </div>
    <hr class="arc-card-divider"/>
    <div class="arc-card-footer">
      <button class="arc-card-view-btn" onclick="event.stopPropagation(); openDetail(${c.id})">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/>
        </svg>
        查看档案
      </button>
      <button class="arc-card-apply-btn ${isActive ? 'applied' : ''}"
        onclick="event.stopPropagation(); applyChar(${c.id})">
        ${isActive ? '已应用' : '应用'}
      </button>
    </div>`;

  return div;
}

/* ================================
   应用角色
================================ */
function applyChar(id) {
  const c = _chars.find(x => x.id === id);
  if (!c) return;
  localStorage.setItem('luna_active_char', id);
  localStorage.setItem('luna_char_prompt', c.prompt || '');
  localStorage.setItem('luna_char_name',   c.name   || '');
  _activeId = id;

  // 刷新所有卡片按钮状态
  document.querySelectorAll('.arc-card').forEach(card => {
    const cid = parseInt(card.dataset.id);
    const btn = card.querySelector('.arc-card-apply-btn');
    const dot = card.querySelector('.arc-card-active-dot');
    if (!btn) return;
    if (cid === id) {
      btn.textContent = '已应用';
      btn.classList.add('applied');
      card.classList.add('arc-card-active');
    } else {
      btn.textContent = '应用';
      btn.classList.remove('applied');
      card.classList.remove('arc-card-active');
    }
  });

  // 更新头部激活名字
  const activeEl = document.getElementById('arcActive');
  if (activeEl) activeEl.textContent = c.name || '—';

  // 如果详情页打开着，刷新状态
  if (_viewingId === id) {
    const badge = document.getElementById('detailStatusBadge');
    if (badge) { badge.textContent = '激活中'; badge.classList.add('active'); }
    const applyBtn = document.getElementById('detailApplyBtn');
    if (applyBtn) { applyBtn.textContent = '已应用'; applyBtn.classList.add('applied'); }
  }
}

/* ================================
   打开详情
================================ */
function openDetail(id) {
  const c = _chars.find(x => x.id === id);
  if (!c) return;
  _viewingId = id;

  const idx = _chars.findIndex(x => x.id === id) + 1;
  const isActive = c.id === _activeId;
  const letter   = (c.name || '?')[0].toUpperCase();
  const heights  = barcodeHeights(c.id || idx, 15);

  // 邮票
  const stampInner = document.getElementById('detailStampInner');
  if (c.avatar) {
    stampInner.innerHTML = `<img src="${c.avatar}" alt="avatar" style="width:100%;height:100%;object-fit:cover;"/>`;
  } else {
    stampInner.innerHTML = `<span class="arc-stamp-letter">${escHtml(letter)}</span>`;
  }

  // 邮戳生日
  document.getElementById('detailBirthday').textContent = c.birthday || '——';

  // 状态徽章
  const badge = document.getElementById('detailStatusBadge');
  badge.textContent = isActive ? '激活中' : '待机';
  badge.className   = 'arc-pc-status' + (isActive ? ' active' : '');

  // 基本信息
  document.getElementById('detailName').textContent   = c.name   || '—';
  document.getElementById('detailRole').textContent   = c.role   || '—';
  document.getElementById('detailGender').textContent = c.gender || '—';
  document.getElementById('detailAge').textContent    = c.age ? c.age + ' 岁' : '—';
  document.getElementById('detailSerial').textContent = String(idx).padStart(3, '0');

  // 性格标签
  const traitsEl = document.getElementById('detailTraits');
  traitsEl.innerHTML = (c.traits || []).map(t =>
    `<span class="arc-pc-trait">${escHtml(t)}</span>`
  ).join('');

  // 描述
  document.getElementById('detailDesc').textContent = c.desc || '暂无描述';

  // 条形码
  const barcode = document.getElementById('arcPostcard').querySelector('.arc-pc-barcode');
  if (barcode) {
    barcode.innerHTML = heights.map(h => `<span style="height:${h}px"></span>`).join('');
  }

  // 应用按钮
  const applyBtn = document.getElementById('detailApplyBtn');
  applyBtn.textContent = isActive ? '已应用' : '应用角色';
  applyBtn.className   = 'arc-act-apply' + (isActive ? ' applied' : '');

  // 显示
  document.getElementById('arcDetailOverlay').classList.add('show');
  document.getElementById('arcDetail').classList.add('show');
}

function closeDetail() {
  document.getElementById('arcDetailOverlay').classList.remove('show');
  document.getElementById('arcDetail').classList.remove('show');
  _viewingId = null;
}

function applyFromDetail() {
  if (!_viewingId) return;
  applyChar(_viewingId);
}

function editFromDetail() {
  if (!_viewingId) return;
  const id = _viewingId;   // ← 先把 id 存到局部变量
  closeDetail();
  setTimeout(() => {
    showCharLink(id);       // ← 用局部变量，不受 closeDetail 影响
  }, 320);
}

/* ================================
   初始化
================================ */
document.addEventListener('DOMContentLoaded', () => {
  updateTime();
  setInterval(updateTime, 1000);
  updateBattery();
  applyIsland();
  renderList();
});

/* ================================
   关系链页 — CharLink 模块
================================ */

let _clCharId   = null;
let _clChar     = null;
let _clWorldType = 'real';
let _clNpcs     = [];
let _clMapData  = null;
let _clEditNpcIdx = null;  // null=新增，否则为编辑索引
let _clPickedRel = '恋人';

/* ---- 打开 ---- */
async function showCharLink(id) {
  _clCharId = id;
  _chars    = _chars.length ? _chars : await getAllChars();
  _clChar   = _chars.find(x => x.id === id);
  if (!_clChar) return;

  // 标题
  document.getElementById('clNavTitle').textContent = _clChar.name || '关系链';

  // 读取已存数据
  _clNpcs    = JSON.parse(JSON.stringify(_clChar.charNpcs  || []));
  _clMapData = JSON.parse(JSON.stringify(_clChar.charMap   || null));

  // 恢复世界类型
  _clWorldType = _clChar.charMapType || 'real';
  switchWorldType(_clWorldType, true);

  // 渲染
  renderClNpcList();
  switchClTab(0);

  // 恢复地图已存内容
  if (_clMapData) {
    if (_clWorldType === 'real') {
      renderCityNodes(_clMapData);
      document.getElementById('clCityInput').value = _clChar.charMapCity || '';
    } else {
      renderWorldNodes(_clMapData);
      document.getElementById('clWorldName').value = _clChar.charMapWorldName || '';
      document.getElementById('clWorldDesc').value = _clChar.charMapWorldDesc || '';
    }
  }

  // 同步状态栏
  syncClStatusBar();

  // 显示
  document.getElementById('clOverlay').classList.add('show');
  document.getElementById('clPage').classList.add('show');
}

/* ---- 关闭 ---- */
function closeCharLink() {
  document.getElementById('clPage').classList.remove('show');
  document.getElementById('clOverlay').classList.remove('show');
  _clCharId = null;
  _clChar   = null;
}

/* ---- 状态栏同步 ---- */
function syncClStatusBar() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const now = new Date();
  const s = now.toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const el = document.getElementById('clStatusTime');
  if (el) el.textContent = s;

  // 电量
  function renderBat(pct) {
    const p = Math.round(pct);
    const pEl = document.getElementById('clBatPct');
    const iEl = document.getElementById('clBatInner');
    if (pEl) pEl.textContent = p;
    if (iEl) {
      iEl.style.width = p + '%';
      iEl.style.background = p <= 20
        ? 'linear-gradient(90deg,#f87171,#ef4444)'
        : 'linear-gradient(90deg,#6ee7b7,#34d399)';
    }
  }
  if ('getBattery' in navigator) {
    navigator.getBattery().then(b => renderBat(b.level * 100));
  } else { renderBat(76); }

  // 灵动岛
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
  const islandEl = document.getElementById('clStatusIsland');
  if (islandEl) islandEl.innerHTML = enabled ? (styleMap[style] || '') : '';
}

/* ---- Tab 切换 ---- */
function switchClTab(idx) {
  [0,1,2].forEach(i => {
    document.getElementById('clPanel' + i).style.display = i === idx ? '' : 'none';
    document.getElementById('clTab' + i).classList.toggle('active', i === idx);
  });
  if (idx === 2) drawNetGraph();
}

/* ---- 世界类型切换 ---- */
function switchWorldType(type, silent) {
  _clWorldType = type;
  document.getElementById('clWtypeReal').classList.toggle('active', type === 'real');
  document.getElementById('clWtypeVirtual').classList.toggle('active', type === 'virtual');
  document.getElementById('clRealPanel').style.display    = type === 'real'    ? '' : 'none';
  document.getElementById('clVirtualPanel').style.display = type === 'virtual' ? '' : 'none';
}

/* ================================
   读取 app API 配置
================================ */
function getApiConfig() {
  const cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  return { baseUrl: (cur.baseUrl || '').replace(/\/$/, ''), apiKey: cur.apiKey || '', model };
}

async function callAI(systemPrompt, userPrompt) {
  const { baseUrl, apiKey, model } = getApiConfig();
  if (!baseUrl || !apiKey || !model) {
    throw new Error('请先在设置中配置并激活 API 预设');
  }
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt }
      ],
      max_tokens: 2500
    })
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

/* ================================
   AI 生成：真实城市地图
================================ */
async function aiGenerateCity() {
  const city = document.getElementById('clCityInput').value.trim();
  if (!city) return;
  const btn     = document.getElementById('clCityAiBtn');
  const spinner = document.getElementById('clCitySpinner');
  const txtEl   = btn.querySelector('.cl-ai-btn-text');
  btn.disabled  = true;
  txtEl.style.display  = 'none';
  spinner.style.display = '';

  try {
    const charDesc = `角色名：${_clChar?.name || '未知'}，身份：${_clChar?.role || ''}，性格：${(_clChar?.traits||[]).join('、')}`;
    const raw = await callAI(
      `你是一个城市向导。根据城市名，生成10个该城市真实存在的著名地点。每个节点包含 type（地点类型，英文大写，如 CAFE / TEMPLE / MARKET / PARK / BRIDGE / DISTRICT 等）、name（真实中文地名）、desc（一句话真实介绍，20字内）。严格只返回JSON数组，不要任何说明文字，格式：[{"type":"...","name":"...","desc":"..."}]`,
      `城市：${city}`
    );
    const clean = raw.replace(/```json|```/g, '').trim();
    const nodes = JSON.parse(clean);
    _clMapData = nodes;
    renderCityNodes(nodes);
    document.getElementById('clCityResult').style.display = '';
  } catch(e) {
    alert('生成失败：' + e.message);
  } finally {
    btn.disabled = false;
    txtEl.style.display  = '';
    spinner.style.display = 'none';
  }
}

function renderCityNodes(nodes) {
  const el = document.getElementById('clCityNodes');
  el.innerHTML = nodes.map((n, i) => `
    <div class="cl-map-node" style="animation-delay:${i*0.07}s">
      <div class="cl-node-type">${escHtml(n.type || 'PLACE')}</div>
      <div class="cl-node-name">${escHtml(n.name || '—')}</div>
      <div class="cl-node-desc">${escHtml(n.desc || '')}</div>
    </div>
  `).join('');
  document.getElementById('clCityResult').style.display = '';
}

/* ================================
   AI 生成：虚拟世界
================================ */
async function aiGenerateWorld() {
  const name = document.getElementById('clWorldName').value.trim();
  const desc = document.getElementById('clWorldDesc').value.trim();
  if (!name) return;
  const btn     = document.getElementById('clWorldAiBtn');
  const spinner = document.getElementById('clWorldSpinner');
  const txtEl   = btn.querySelector('.cl-ai-btn-text');
  btn.disabled  = true;
  txtEl.style.display  = 'none';
  spinner.style.display = '';

  try {
    const charDesc = `角色名：${_clChar?.name || '未知'}，身份：${_clChar?.role || ''}，性格：${(_clChar?.traits||[]).join('、')}`;
    const raw = await callAI(
      `你是一个奇幻世界观设计师。根据世界设定和角色信息，生成10个世界地图节点。每个节点包含 type（区域类型，英文大写，如 CAPITAL / FOREST / PORT / RUIN / SHRINE 等）、name（中文地名，有文学性）、desc（一句话氛围描述，20字内）。严格只返回JSON数组，不要任何说明，格式：[{"type":"...","name":"...","desc":"..."}]`,
      `世界名：${name}\n世界描述：${desc}\n角色：${charDesc}`
    );
    const clean = raw.replace(/```json|```/g, '').trim();
    const nodes = JSON.parse(clean);
    _clMapData = nodes;
    renderWorldNodes(nodes);
  } catch(e) {
    alert('生成失败：' + e.message);
  } finally {
    btn.disabled = false;
    txtEl.style.display  = '';
    spinner.style.display = 'none';
  }
}

function renderWorldNodes(nodes) {
  const el = document.getElementById('clWorldNodes');
  el.innerHTML = nodes.map((n, i) => `
    <div class="cl-map-node" style="animation-delay:${i*0.07}s">
      <div class="cl-node-type">${escHtml(n.type || 'ZONE')}</div>
      <div class="cl-node-name">${escHtml(n.name || '—')}</div>
      <div class="cl-node-desc">${escHtml(n.desc || '')}</div>
    </div>
  `).join('');
  document.getElementById('clWorldResult').style.display = '';
}

/* ================================
   AI 生成：NPC 关系人物
================================ */
async function aiGenerateNpcs() {
  const btn     = document.getElementById('clNpcAiBtn');
  const spinner = document.getElementById('clNpcSpinner');
  const txtEl   = btn.querySelector('.cl-ai-btn-text');
  btn.disabled  = true;
  txtEl.style.display  = 'none';
  spinner.style.display = '';

  try {
    const charDesc = `角色名：${_clChar?.name || '未知'}，性别：${_clChar?.gender||''}，年龄：${_clChar?.age||''}，身份：${_clChar?.role || ''}，性格：${(_clChar?.traits||[]).join('、')}，人设描述：${_clChar?.desc||''}，与用户关系：${_clChar?.prompt||''}`;
    const raw = await callAI(
      `你是一个深度角色设定师，擅长创作有文学质感的人物。严格根据主角的人设、世界观和与用户的关系，为主角生成3个周边关系人物。姓名要有小说感、符合角色所在世界观风格，避免普通常见名字。每个人物必须包含以下所有字段：name（姓名，要有文学感和辨识度，符合世界观）、nickname（昵称或外号，亲切自然）、gender（性别：男/女/未知）、age（年龄数字）、rel（与主角关系类型，只能是：恋人/友人/宿敌/家人/其他 之一）、relDesc（与主角的关系详细描述，包括认识经过、相处模式、情感羁绊，80字以上）、personality（性格描述，包括性格特点、行为习惯、说话方式，60字以上）、desc（人物完整简介，包括外貌特征、身份背景、在故事中的角色定位，80字以上）。所有文字描述要细腻有文学感，能让扮演者充分理解这个人物。严格只返回JSON数组，不要任何说明文字，格式：[{"name":"...","nickname":"...","gender":"...","age":"...","rel":"...","relDesc":"...","personality":"...","desc":"..."}]`,
      `主角信息：${charDesc}`
    );
    const clean = raw.replace(/```json|```/g, '').trim();
    const npcs  = JSON.parse(clean);
    npcs.forEach(n => {
      if (!_clNpcs.find(x => x.name === n.name)) {
        _clNpcs.push({
          name: n.name, nickname: n.nickname, gender: n.gender,
          age: n.age, rel: n.rel, relDesc: n.relDesc,
          personality: n.personality, desc: n.desc,
          avatar: '', cardBg: '', bound: false
        });
      }
    });
    renderClNpcList();
    autoSaveCharLink();
  } catch(e) {
    alert('生成失败：' + e.message);
  } finally {
    btn.disabled = false;
    txtEl.style.display  = '';
    spinner.style.display = 'none';
  }
}

/* ================================
   NPC 列表渲染
================================ */
function renderClNpcList() {
  const el = document.getElementById('clNpcList');
  if (!_clNpcs.length) {
    el.innerHTML = `
      <div class="cl-npc-empty">
        <div class="cl-npc-empty-title">还没有关系人物</div>
        <div class="cl-npc-empty-desc">手动添加或让 AI 生成</div>
      </div>`;
    return;
  }
  el.innerHTML = _clNpcs.map((n, i) => {
    const relColor = {'恋人':'#c8a97e','友人':'#8eaec8','宿敌':'#c87e7e','家人':'#8ec8a3','其他':'#b8b8b0'}[n.rel] || '#b8b8b0';
    const bgStyle = n.cardBg ? `background-image:url(${n.cardBg});background-size:cover;background-position:center;` : '';
    return `
    <div class="cl-npc-card2" onclick="openNpcDetail(${i})" style="animation-delay:${i*0.07}s">
      <div class="cl-npc2-top" style="${bgStyle}">
        <div class="cl-npc2-top-overlay"></div>
        <div class="cl-npc2-avatar" style="${n.avatar ? `background-image:url(${n.avatar});background-size:cover;background-position:center;` : ''}">
          ${!n.avatar ? `<span class="cl-npc-avatar-letter">${escHtml((n.name||'?')[0])}</span>` : ''}
        </div>
        <div class="cl-npc2-top-info">
          <div class="cl-npc2-name">${escHtml(n.name||'—')}</div>
          ${n.nickname ? `<div class="cl-npc2-nickname">${escHtml(n.nickname)}</div>` : ''}
        </div>
        <div class="cl-npc2-rel-badge" style="border-color:${relColor};color:${relColor}">${escHtml(n.rel||'其他')}</div>
      </div>
      <div class="cl-npc2-body">
        <div class="cl-npc2-meta-row">
          ${n.gender ? `<span class="cl-npc2-meta-tag">${escHtml(n.gender)}</span>` : ''}
          ${n.age    ? `<span class="cl-npc2-meta-tag">${escHtml(n.age)} 岁</span>` : ''}
          ${n.personality ? `<span class="cl-npc2-meta-tag">${escHtml(n.personality)}</span>` : ''}
        </div>
        <div class="cl-npc2-reldesc">${escHtml(n.relDesc||n.desc||'')}</div>
      </div>
      ${n.bound ? `<div class="cl-npc2-bound-bar">已绑定</div>` : ''}
    </div>`;
  }).join('');
}

function deleteNpc(idx) {
  _clNpcs.splice(idx, 1);
  renderClNpcList();
  autoSaveCharLink();
}

/* ================================
   手动添加 NPC 弹窗
================================ */
function openAddNpcModal() {
  _clEditNpcIdx = null;
  _clPickedRel  = '恋人';
  document.getElementById('clNpcName').value        = '';
  document.getElementById('clNpcNickname').value    = '';
  document.getElementById('clNpcGender').value      = '';
  document.getElementById('clNpcAge').value         = '';
  document.getElementById('clNpcPersonality').value = '';
  document.getElementById('clNpcRelDesc').value     = '';
  document.getElementById('clNpcDesc').value        = '';
  document.getElementById('clNpcModalTitle').textContent = '添加关系人物';
  document.querySelectorAll('.cl-rel-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.rel === _clPickedRel)
  );
  document.getElementById('clNpcModalMask').classList.add('show');
}

function closeNpcModal() {
  document.getElementById('clNpcModalMask').classList.remove('show');
}

function pickRelType(btn) {
  _clPickedRel = btn.dataset.rel;
  document.querySelectorAll('.cl-rel-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function confirmAddNpc() {
  const name        = document.getElementById('clNpcName').value.trim();
  const nickname    = document.getElementById('clNpcNickname').value.trim();
  const gender      = document.getElementById('clNpcGender').value.trim();
  const age         = document.getElementById('clNpcAge').value.trim();
  const personality = document.getElementById('clNpcPersonality').value.trim();
  const relDesc     = document.getElementById('clNpcRelDesc').value.trim();
  const desc        = document.getElementById('clNpcDesc').value.trim();
  if (!name) return;
  if (_clEditNpcIdx !== null) {
    const n = _clNpcs[_clEditNpcIdx];
    n.name = name; n.nickname = nickname; n.gender = gender;
    n.age = age; n.rel = _clPickedRel; n.personality = personality;
    n.relDesc = relDesc; n.desc = desc;
    _clEditNpcIdx = null;
  } else {
    _clNpcs.push({ name, nickname, gender, age, rel: _clPickedRel, relDesc, personality, desc, avatar:'', cardBg:'', bound:false });
  }
  renderClNpcList();
  closeNpcModal();
  autoSaveCharLink();
}
/* ================================
   关系网图 Canvas
================================ */
const REL_COLORS = {
  '恋人': '#c8a97e',
  '友人': '#8eaec8',
  '宿敌': '#c87e7e',
  '家人': '#8ec8a3',
  '其他': '#b8b8b0'
};

function drawNetGraph() {
  const canvas = document.getElementById('clNetCanvas');
  if (!canvas) return;
  const wrap = canvas.parentElement;
  const W = wrap.clientWidth;
  const H = Math.max(300, Math.min(400, W));
  const DPR = window.devicePixelRatio || 1;
  canvas.width  = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);

  // 状态（只初始化一次）
  if (canvas._init !== true) {
    canvas._ox = 0; canvas._oy = 0; canvas._scale = 1;
    canvas._animNodes = [];
    canvas._init = true;
  }

  const REL_CFG = {
    '恋人': { color: '#d4956a', bg: '#fdf0e8' },
    '友人': { color: '#6a9fd4', bg: '#e8f0fd' },
    '宿敌': { color: '#d46a6a', bg: '#fde8e8' },
    '家人': { color: '#6ab87a', bg: '#e8fdef' },
    '其他': { color: '#a0a098', bg: '#f0f0ee' },
  };

  const count = _clNpcs.length;
  const cx0 = W / 2, cy0 = H / 2;

  // 计算每个节点目标位置
  const nodes = _clNpcs.map((npc, i) => {
    const angle = (i / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2;
    const r = Math.min(W, H) * 0.29;
    return {
      npc,
      tx: cx0 + r * Math.cos(angle),
      ty: cy0 + r * Math.sin(angle),
      angle,
      cfg: REL_CFG[npc.rel] || REL_CFG['其他'],
    };
  });

  // 初始化弹性动画状态
  if (canvas._animNodes.length !== count) {
    canvas._animNodes = nodes.map(n => ({
      x: cx0, y: cy0, vx: 0, vy: 0,
      scale: 0,
    }));
  }

  let _raf = null;
  function tick() {
    const ox = canvas._ox, oy = canvas._oy, sc = canvas._scale;
    const cx = cx0 + ox, cy = cy0 + oy;

    // 弹簧物理
    let moving = false;
    canvas._animNodes.forEach((an, i) => {
      const tn = nodes[i];
      const targetX = cx0 + ox + (tn.tx - cx0) * sc;
      const targetY = cy0 + oy + (tn.ty - cy0) * sc;
      const dx = targetX - an.x, dy = targetY - an.y;
      an.vx = (an.vx + dx * 0.14) * 0.72;
      an.vy = (an.vy + dy * 0.14) * 0.72;
      an.x += an.vx; an.y += an.vy;
      an.scale = Math.min(1, an.scale + 0.055);
      if (Math.abs(an.vx) + Math.abs(an.vy) > 0.15) moving = true;
    });

    ctx.clearRect(0, 0, W, H);

    // 细网格背景
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += 24) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    ctx.restore();

    // 连线 + 关系标签
    canvas._animNodes.forEach((an, i) => {
      const tn = nodes[i];
      const cfg = tn.cfg;
      const alpha = an.scale;

      // 渐变连线
      const grad = ctx.createLinearGradient(cx, cy, an.x, an.y);
      grad.addColorStop(0, cfg.color + '00');
      grad.addColorStop(0.4, cfg.color + '55');
      grad.addColorStop(1, cfg.color + 'ee');
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(an.x, an.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([]);
      ctx.stroke();

      // 关系标签写在线的中间
      const mx = (cx + an.x) / 2;
      const my = (cy + an.y) / 2;
      const labelW = 36, labelH = 16;
      // 小胶囊背景
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.08)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      const lx = mx - labelW/2, ly = my - labelH/2;
      ctx.roundRect(lx, ly, labelW, labelH, 8);
      ctx.fillStyle = cfg.bg;
      ctx.strokeStyle = cfg.color + '55';
      ctx.lineWidth = 0.8;
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.font = `500 8px 'DM Sans', sans-serif`;
      ctx.fillStyle = cfg.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tn.npc.rel || '', mx, my);
      ctx.restore();
    });

    // 主角节点
    const mainR = 34 * sc;
    ctx.save();
    // 外晕
    const glowG = ctx.createRadialGradient(cx, cy, mainR * 0.5, cx, cy, mainR * 2);
    glowG.addColorStop(0, 'rgba(26,26,24,0.12)');
    glowG.addColorStop(1, 'rgba(26,26,24,0)');
    ctx.beginPath(); ctx.arc(cx, cy, mainR * 2, 0, Math.PI*2);
    ctx.fillStyle = glowG; ctx.fill();
    // 主体
    ctx.beginPath(); ctx.arc(cx, cy, mainR, 0, Math.PI*2);
    ctx.fillStyle = '#1a1a18';
    ctx.shadowColor = 'rgba(0,0,0,0.22)';
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;
    // 高光
    ctx.beginPath(); ctx.arc(cx - mainR*0.28, cy - mainR*0.3, mainR*0.38, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,0.13)'; ctx.fill();
    // 名字
    ctx.font = `300 ${Math.max(10, 13*sc)}px 'DM Sans', sans-serif`;
    ctx.fillStyle = '#f5f4f1';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((_clChar?.name || '主角').slice(0,5), cx, cy);
    ctx.restore();

    if (!count) {
      ctx.font = `300 11px 'DM Sans', sans-serif`;
      ctx.fillStyle = '#c4c4bc';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('暂无关系人物', cx, cy + 60);
    }

    // NPC节点（弹弹球）
    canvas._animNodes.forEach((an, i) => {
      const tn = nodes[i];
      const cfg = tn.cfg;
      const nr = 24 * sc * an.scale;
      if (nr < 1) return;

      ctx.save();
      ctx.globalAlpha = an.scale;

      // 外晕
      const glow = ctx.createRadialGradient(an.x, an.y, nr*0.3, an.x, an.y, nr*2.2);
      glow.addColorStop(0, cfg.color + '35');
      glow.addColorStop(1, cfg.color + '00');
      ctx.beginPath(); ctx.arc(an.x, an.y, nr*2.2, 0, Math.PI*2);
      ctx.fillStyle = glow; ctx.fill();

      // 球体渐变
      const ballG = ctx.createRadialGradient(
        an.x - nr*0.25, an.y - nr*0.28, nr*0.05,
        an.x, an.y, nr
      );
      ballG.addColorStop(0, cfg.bg);
      ballG.addColorStop(0.4, cfg.color + 'cc');
      ballG.addColorStop(1, cfg.color + 'ff');
      ctx.beginPath(); ctx.arc(an.x, an.y, nr, 0, Math.PI*2);
      ctx.fillStyle = ballG;
      ctx.shadowColor = cfg.color;
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;

      // 高光
      ctx.beginPath();
      ctx.arc(an.x - nr*0.25, an.y - nr*0.28, nr*0.4, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill();

      // 小高光点
      ctx.beginPath();
      ctx.arc(an.x + nr*0.18, an.y + nr*0.2, nr*0.15, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill();

      // 名字
      ctx.font = `400 ${Math.max(8.5, 10.5*sc)}px 'DM Sans', sans-serif`;
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 4;
      ctx.fillText((tn.npc.name || '?').slice(0,3), an.x, an.y);
      ctx.shadowBlur = 0;
      ctx.restore();
    });

    if (moving) _raf = requestAnimationFrame(tick);
    else _raf = null;
  }

  if (_raf) cancelAnimationFrame(_raf);
  tick();

  // ====== 手势：拖拽 + 捏合缩放（不阻止页面滚动） ======
  // 先移除旧监听，防止重复绑
  const oldHandler = canvas._touchHandler;
  if (oldHandler) {
    canvas.removeEventListener('touchstart', oldHandler);
    canvas.removeEventListener('touchmove', oldHandler);
    canvas.removeEventListener('touchend', oldHandler);
  }

  let _dragging = false, _lx = 0, _ly = 0;
  let _pinching = false, _initDist = 0, _initScale = 1;
  let _touchMoved = false;

  function onTouchStart(e) {
    _touchMoved = false;
    if (e.touches.length === 1) {
      _dragging = true; _pinching = false;
      _lx = e.touches[0].clientX; _ly = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      _pinching = true; _dragging = false;
      _initDist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      _initScale = canvas._scale;
    }
  }
  function onTouchMove(e) {
    _touchMoved = true;
    if (_pinching && e.touches.length === 2) {
      e.preventDefault(); // 只在捏合时阻止
      const d = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      canvas._scale = Math.max(0.5, Math.min(2.5, _initScale * d / _initDist));
      if (_raf) cancelAnimationFrame(_raf);
      tick();
    } else if (_dragging && e.touches.length === 1) {
      const dx = e.touches[0].clientX - _lx;
      const dy = e.touches[0].clientY - _ly;
      // 横向移动多才拖拽，纵向让页面正常滚动
      if (Math.abs(dx) > Math.abs(dy) + 4) {
        e.preventDefault();
        canvas._ox += dx; canvas._oy += dy;
        _lx = e.touches[0].clientX; _ly = e.touches[0].clientY;
        if (_raf) cancelAnimationFrame(_raf);
        tick();
      }
    }
  }
  function onTouchEnd(e) {
    _dragging = false; _pinching = false;
    // 点击节点
    if (!_touchMoved && e.changedTouches.length === 1) {
      const rect = canvas.getBoundingClientRect();
      const mx = e.changedTouches[0].clientX - rect.left;
      const my = e.changedTouches[0].clientY - rect.top;
      handleTap(mx, my);
    }
  }

  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd, { passive: true });
  canvas._touchHandler = onTouchStart;

  // 鼠标拖拽
  canvas.onmousedown = (e) => { _dragging = true; _lx = e.clientX; _ly = e.clientY; };
  window.onmousemove = (e) => {
    if (!_dragging) return;
    canvas._ox += e.clientX - _lx; canvas._oy += e.clientY - _ly;
    _lx = e.clientX; _ly = e.clientY;
    if (_raf) cancelAnimationFrame(_raf);
    tick();
  };
  window.onmouseup = () => { _dragging = false; };
  canvas.onwheel = (e) => {
    e.preventDefault();
    canvas._scale = Math.max(0.5, Math.min(2.5, canvas._scale * (e.deltaY > 0 ? 0.92 : 1.09)));
    if (_raf) cancelAnimationFrame(_raf);
    tick();
  };

  // 点击检测
  function handleTap(mx, my) {
    const ox = canvas._ox, oy = canvas._oy, sc = canvas._scale;
    const cx = cx0 + ox, cy = cy0 + oy;
    let hit = null;
    canvas._animNodes.forEach((an, i) => {
      if (Math.hypot(mx - an.x, my - an.y) < 28 * sc) hit = nodes[i].npc;
    });
    const tt = document.getElementById('clNodeTooltip');
    if (hit) {
      document.getElementById('clTtName').textContent = hit.name || '';
      document.getElementById('clTtRel').textContent  = (hit.rel || '').toUpperCase();
      document.getElementById('clTtDesc').textContent = hit.relDesc || hit.desc || '暂无描述';
      tt.style.display = '';
      tt.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      tt.style.display = 'none';
    }
  }
  canvas.onclick = (e) => {
    const rect = canvas.getBoundingClientRect();
    handleTap(e.clientX - rect.left, e.clientY - rect.top);
  };
}

/* ================================
   保存到 IndexedDB
================================ */
async function autoSaveCharLink() {
  if (!_clCharId || !_clChar) return;
  const updated = {
    ..._clChar,
    charNpcs:         _clNpcs,
    charMap:          _clMapData,
    charMapType:      _clWorldType,
    charMapCity:      document.getElementById('clCityInput')?.value?.trim() || '',
    charMapWorldName: document.getElementById('clWorldName')?.value?.trim() || '',
    charMapWorldDesc: document.getElementById('clWorldDesc')?.value?.trim() || '',
  };
  await saveCharDB(updated);
  const idx = _chars.findIndex(x => x.id === _clCharId);
  if (idx !== -1) _chars[idx] = updated;
  _clChar = updated;
}

async function saveCharLink() {
  if (!_clCharId || !_clChar) return;

  const updated = {
    ..._clChar,
    charNpcs:       _clNpcs,
    charMap:        _clMapData,
    charMapType:    _clWorldType,
    charMapCity:    document.getElementById('clCityInput')?.value?.trim() || '',
    charMapWorldName: document.getElementById('clWorldName')?.value?.trim() || '',
    charMapWorldDesc: document.getElementById('clWorldDesc')?.value?.trim() || '',
  };

  await saveCharDB(updated);

  // 更新本地缓存
  const idx = _chars.findIndex(x => x.id === _clCharId);
  if (idx !== -1) _chars[idx] = updated;
  _clChar = updated;

  // 保存成功动效
  const btn = document.getElementById('clSaveBtn');
  btn.style.background = 'var(--ink)';
  btn.style.color      = 'var(--bg)';
  btn.style.borderRadius = '50%';
  setTimeout(() => {
    btn.style.background = '';
    btn.style.color      = '';
  }, 900);
}

/* ================================
   NPC 详情弹窗
================================ */
let _npcDetailIdx = null;

function openNpcDetail(idx) {
  _npcDetailIdx = idx;
  const n = _clNpcs[idx];
  if (!n) return;
  const relColor = {'恋人':'#c8a97e','友人':'#8eaec8','宿敌':'#c87e7e','家人':'#8ec8a3','其他':'#b8b8b0'}[n.rel] || '#b8b8b0';

  document.getElementById('ndAvatar').style.backgroundImage = n.avatar ? `url(${n.avatar})` : '';
  document.getElementById('ndAvatarLetter').textContent = n.avatar ? '' : (n.name||'?')[0];
  document.getElementById('ndName').textContent     = n.name || '—';
  document.getElementById('ndNickname').textContent = n.nickname ? `「${n.nickname}」` : '';
  document.getElementById('ndRelBadge').textContent = n.rel || '其他';
  document.getElementById('ndRelBadge').style.borderColor = relColor;
  document.getElementById('ndRelBadge').style.color = relColor;
  document.getElementById('ndGender').textContent = n.gender || '—';
  document.getElementById('ndAge').textContent    = n.age ? n.age + ' 岁' : '—';
  document.getElementById('ndPersonality').textContent = n.personality || '—';
  document.getElementById('ndRelDesc').textContent = n.relDesc || '—';
  document.getElementById('ndDesc').textContent   = n.desc || '—';

  const bindBtn = document.getElementById('ndBindBtn');
  bindBtn.textContent = n.bound ? '已绑定' : '绑定关系';
  bindBtn.className = 'nd-bind-btn' + (n.bound ? ' bound' : '');

  document.getElementById('npcDetailMask').classList.add('show');
}

function closeNpcDetail() {
  document.getElementById('npcDetailMask').classList.remove('show');
  _npcDetailIdx = null;
}

function toggleBindNpc() {
  if (_npcDetailIdx === null) return;
  const n = _clNpcs[_npcDetailIdx];
  n.bound = !n.bound;
  const bindBtn = document.getElementById('ndBindBtn');
  bindBtn.textContent = n.bound ? '已绑定' : '绑定关系';
  bindBtn.className = 'nd-bind-btn' + (n.bound ? ' bound' : '');
  renderClNpcList();
}

function ndUploadAvatar() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      _clNpcs[_npcDetailIdx].avatar = ev.target.result;
      document.getElementById('ndAvatar').style.backgroundImage = `url(${ev.target.result})`;
      document.getElementById('ndAvatarLetter').textContent = '';
      renderClNpcList();
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function ndUploadBg() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      _clNpcs[_npcDetailIdx].cardBg = ev.target.result;
      renderClNpcList();
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function openEditNpcModal() {
  const n = _clNpcs[_npcDetailIdx];
  if (!n) return;
  _clEditNpcIdx = _npcDetailIdx;
  _clPickedRel  = n.rel || '其他';
  document.getElementById('clNpcName').value        = n.name || '';
  document.getElementById('clNpcNickname').value    = n.nickname || '';
  document.getElementById('clNpcGender').value      = n.gender || '';
  document.getElementById('clNpcAge').value         = n.age || '';
  document.getElementById('clNpcPersonality').value = n.personality || '';
  document.getElementById('clNpcRelDesc').value     = n.relDesc || '';
  document.getElementById('clNpcDesc').value        = n.desc || '';
  document.getElementById('clNpcModalTitle').textContent = '编辑关系人物';
  document.querySelectorAll('.cl-rel-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.rel === _clPickedRel)
  );
  closeNpcDetail();
  document.getElementById('clNpcModalMask').classList.add('show');
}

function deleteNpcFromDetail() {
  if (_npcDetailIdx === null) return;
  _clNpcs.splice(_npcDetailIdx, 1);
  renderClNpcList();
  closeNpcDetail();
}