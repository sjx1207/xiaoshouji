/* ================================
   Luna Wallet — wallet.js
   与 index.html 体系完全同步：
   · 状态栏时间 / 电量
   · 灵动岛 applyIsland()（读取 localStorage luna_island_*）
   · 全局字体 applyGlobalFont()（读取 luna_font_* + IndexedDB）
   · 转场遮罩淡入返回
================================ */

'use strict';

/* ============================================================
   1. 状态栏 — 时间（与 script.js 完全同构）
============================================================ */
function updateTime() {
  const el = document.getElementById('statusTime');
  if (!el) return;
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const now = new Date();
  const statusTimeStr = now.toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  el.textContent = statusTimeStr;

  // 问候语随时间变化
  const greetEl = document.getElementById('wGreeting');
  if (greetEl) {
    const tzNow = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const h = tzNow.getHours();
    greetEl.textContent = h < 6 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }
}

/* ============================================================
   2. 状态栏 — 电量（与 script.js 完全同构）
============================================================ */
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
    navigator.getBattery().then(battery => {
      render(battery.level * 100);
      battery.addEventListener('levelchange', () => render(battery.level * 100));
    });
  } else {
    render(76);
  }
}

/* ============================================================
   3. 灵动岛 applyIsland() — 与 script.js 完全同构
   读取 localStorage: luna_island_enabled / luna_island_style
============================================================ */
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
      t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    };
    tick();
    window._siClockTimer = setInterval(tick, 10000);
  }
}

/* ============================================================
   4. 全局字体 applyGlobalFont() — 与 script.js 完全同构
   读取 localStorage: luna_font_style / luna_font_active_name / luna_font_active_id
   从 IndexedDB LunaFontDB 取字体数据
============================================================ */
async function applyGlobalFont() {
  const style = JSON.parse(localStorage.getItem('luna_font_style') || '{}');
  const name  = localStorage.getItem('luna_font_active_name');
  const id    = parseInt(localStorage.getItem('luna_font_active_id'));

  if (name && id) {
    try {
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open('LunaFontDB', 4);
        req.onsuccess = e => res(e.target.result);
        req.onerror   = () => rej();
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
    } catch (e) {}
  }

  // 注入 <style> 覆盖（排除特定组件，与 script.js 保持一致）
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

/* ============================================================
   5. 监听 index 体系通过 localStorage 广播的同步事件
============================================================ */
window.addEventListener('storage', (e) => {
  if (e.key === 'luna_island_update') applyIsland();
  if (e.key === 'luna_font_update')   applyGlobalFont();
  if (e.key === 'luna_tz_update')     updateTime();
});

/* ============================================================
   6. 转场遮罩 — 返回 index
============================================================ */
function goBack() {
  const mask = document.getElementById('wTransMask');
  if (!mask) { window.location.href = 'index.html'; return; }
  mask.style.opacity = '1';
  mask.style.pointerEvents = 'all';
  setTimeout(() => { window.location.href = 'index.html'; }, 300);
}

// 监听系统返回手势（Android）
window.addEventListener('popstate', goBack);

/* ============================================================
   7. Tab 切换
============================================================ */
const TAB_ORDER = ['home', 'cards', 'connect', 'bills', 'me'];
let _currentTab = 'home';

function switchTab(name) {
  if (!TAB_ORDER.includes(name)) return;
  _currentTab = name;
  const idx    = TAB_ORDER.indexOf(name);
  const wrap   = document.getElementById('wPageWrap');
  if (wrap) {
    // 每个 .w-page 宽度 = 100vw，而 wrap 宽度 = 500vw
    // translateX(-idx * 20%) 等于移动 idx 个 page
    wrap.style.transform = `translateX(-${idx * 20}%)`;
  }

  // 更新底部导航激活态
  document.querySelectorAll('.w-nav-item').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
}

/* ============================================================
   8. 操作路由占位（后续各弹层 / 页面对接）
============================================================ */
function wAction(action) {
  const routes = {
    // 跳转页（后续创建对应 html）
    'exchange':      'wallet_exchange.html',
    'transfer':      'wallet_transfer.html',
    'topup':         'wallet_topup.html',
    'mail':          'wallet_mail.html',
    'plan':          'wallet_plan.html',
    'call-bill':     'wallet_callbill.html',
    'account':       'wallet_account.html',
    'security':      'wallet_security.html',
    'kyc':           'wallet_kyc.html',
    'notify-settings': 'wallet_notify.html',
    'about':         'wallet_about.html',
    'apply-card':    'wallet_applycard.html',
  };

  // 弹层动作（暂留，后续扩展）
  const sheets = {
    'receive': true,
    'sms':     true,
    'logout':  true,
  };

  if (sheets[action]) {
    _openBottomSheet(action);
    return;
  }

  const url = routes[action];
  if (!url) return;

  // 转场跳转
  const mask = document.getElementById('wTransMask');
  if (mask) {
    mask.style.opacity = '1';
    mask.style.pointerEvents = 'all';
    setTimeout(() => { window.location.href = url; }, 300);
  } else {
    window.location.href = url;
  }
}

/* ============================================================
   9. 简易底部弹层（占位，后续替换为完整 UI）
============================================================ */
function _openBottomSheet(action) {
  // TODO: 各弹层独立实现后替换
  console.log('[wallet] open sheet:', action);
}

/* ============================================================
   10. 筛选 chip 交互（账单页）
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.w-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.w-filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });
});

/* ============================================================
   11. pageshow 禁止 bfcache 快照 + 重新同步字体（与 script.js 一致）
============================================================ */
window.addEventListener('pageshow', (e) => {
  if (e.persisted) window.location.reload();
  applyGlobalFont();
});

/* ============================================================
   12. 转场遮罩淡出（从 index 进入时恢复）
============================================================ */
function initTransMask() {
  const mask = document.getElementById('wTransMask');
  if (!mask) return;
  // 让遮罩从 index 带来的白色淡出
  requestAnimationFrame(() => {
    mask.style.opacity = '0';
    mask.style.pointerEvents = 'none';
  });
}

/* ============================================================
   初始化
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initTransMask();
  updateBattery();
  updateTime();
  setInterval(updateTime, 1000);
  applyIsland();
  applyGlobalFont();
  switchTab('home');
});