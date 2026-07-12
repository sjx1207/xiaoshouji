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
  const familyRule = name        ? `font-family: '${name}', sans-serif !important;` : '';
  tag.textContent  = `* { ${familyRule} }`;
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
  const idx    = TAB_ORDER.indexOf(name); // 页面位置仍按 5 页网格算（首页依然是落地页，只是导航栏不再显示入口）
  const wrap   = document.getElementById('wPageWrap');
  if (wrap) {
    // 每个 .w-page 宽度 = 100vw，而 wrap 宽度 = 500vw
    // translateX(-idx * 20%) 等于移动 idx 个 page
    wrap.style.transform = `translateX(-${idx * 20}%)`;
  }

  // 更新底部导航激活态（导航栏只有 4 个按钮：卡包/通讯/账单/我的，首页没有对应按钮）
  const targetId = 'nav' + name.charAt(0).toUpperCase() + name.slice(1);
  document.querySelectorAll('.w-nav-item').forEach(el => {
    el.classList.toggle('active', el.id === targetId);
  });

  if (name === 'bills')   renderBillsPage();
  if (name === 'connect') renderConnectPage();
}

/* ============================================================
   8. 操作路由占位（后续各弹层 / 页面对接）
============================================================ */
function wAction(action) {
  const routes = {
    // 跳转页（后续创建对应 html）
    'exchange':      'wallet_exchange.html',
    'transfer':      'wallet_transfer.html',
    'account':       'wallet_account.html',
    'kyc':           'wallet_kyc.html',
    'notify-settings': 'wallet_notify.html',
    'about':         'wallet_about.html',
  };

  // 弹层动作（暂留，后续扩展）
  const sheets = {
    'receive': true,
    'logout':  true,
  };

  if (action === 'security')  { wOpenSecurityPage();       return; }
  if (action === 'topup')     { wOpenTopupPage();           return; }
  if (action === 'plan')      { wOpenPhonePage();           return; }
  if (action === 'sms')       { wOpenPhonePage('history');  return; }
  if (action === 'call-bill') { wOpenPhonePage('history');  return; }

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
   10. （筛选 chip 交互已迁移至账单页专属逻辑 _blRenderFilterRow，
       见文件后段"账单页"模块，这里不再需要通用监听）
============================================================ */

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

  /* ---------- 公共初始化（不依赖 onboarding 结果）---------- */
  initTransMask();
  updateBattery();
  updateTime();
  setInterval(updateTime, 1000);
  applyIsland();
  applyGlobalFont();
  switchTab('home');
  syncMePage();
  renderHomeData();

  /* ---------- Splash 动画函数（供两处调用）---------- */
  function runSplash() {
    const splashEl = document.getElementById('wSplash');
    const barEl    = document.getElementById('wSplashBar');
    const statusEl = document.getElementById('wSplashStatus');
    const pctEl    = document.getElementById('wSplashPct');

    // 确保 Splash 可见
    if (splashEl) {
      splashEl.style.display = 'flex';
      splashEl.classList.remove('ws-hidden');
    }

    const steps = [
      { pct: 18,  label: '正在连接' },
      { pct: 36,  label: '验证密钥' },
      { pct: 55,  label: '同步账本' },
      { pct: 74,  label: '加载资产' },
      { pct: 90,  label: '即将就绪' },
      { pct: 100, label: '欢迎回来' },
    ];

    let stepIdx = 0;

    function tick() {
      if (stepIdx >= steps.length) {
        setTimeout(() => {
          if (splashEl) splashEl.classList.add('ws-hidden');
          setTimeout(() => { if (splashEl) splashEl.style.display = 'none'; }, 520);
        }, 600);
        return;
      }
      const s = steps[stepIdx];
      if (barEl)    barEl.style.width      = s.pct + '%';
      if (statusEl) statusEl.textContent   = s.label;
      if (pctEl)    pctEl.textContent      = s.pct + '%';
      stepIdx++;
      setTimeout(tick, stepIdx === steps.length ? 800 : 480);
    }

    setTimeout(tick, 300);
  }

  // 把 runSplash 挂到全局，让 obSubmit 完成注册后也能调用
  window._walletRunSplash = runSplash;

  /* ---------- 判断是否需要 Onboarding，再决定启动什么 ----------
     每次进入都以 DB 为准（localStorage 标记只作为已见过 onboarding 的快速提示，
     不能单独作为"已登录"的依据），确保账号信息真实存在才跳过登录页 */
  (async () => {
    const account = await _loadWalletAccount();
    const isLoggedIn = !!(account && account.boundIdentityId);

    if (isLoggedIn) {
      // 已登录：打标记，直接跑 Splash 进入钱包主页
      localStorage.setItem('luna_wallet_onboarded', '1');
      runSplash();
    } else {
      // 未登录（无账号，或账号未绑定任何身份）：显示登录/创建账号页
      localStorage.removeItem('luna_wallet_onboarded');
      const splashEl = document.getElementById('wSplash');
      if (splashEl) splashEl.style.display = 'none';

      const ob = document.getElementById('wOnboarding');
      if (ob) {
        ob.style.display = 'flex'; // 直接用 flex，不依赖 CSS class
      }
    }
  })();

});

/* ============================================================
   Onboarding — 首次引导逻辑
============================================================ */

// 检查 LunaWalletAccountDB 里是否有钱包账号（唯一正确的判断依据）
async function _obCheckHasWalletAccount() {
  return new Promise(res => {
    const req = indexedDB.open('LunaWalletAccountDB', 1);
    req.onupgradeneeded = e => {
      // 库不存在时创建，onupgradeneeded 触发说明是全新库 → 肯定没数据
      e.target.result.createObjectStore('accounts', { keyPath: 'id' });
    };
    req.onsuccess = e => {
      const db = e.target.result;
      const r = db.transaction('accounts').objectStore('accounts').getAll();
      r.onsuccess = () => res((r.result || []).length > 0);
      r.onerror   = () => res(false);
    };
    req.onerror = () => res(false);
  });
}

// 从 LunaIdentityDB 读取所有身份（供用户选择绑定，只读）
async function _obLoadIdentities() {
  return new Promise(res => {
    const req = indexedDB.open('LunaIdentityDB'); // 不写死版本号，避免与其他页面创建的库版本冲突
    req.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('identities')) return res([]);
      const r = db.transaction('identities').objectStore('identities').getAll();
      r.onsuccess = () => res((r.result || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      r.onerror   = () => res([]);
    };
    req.onerror = () => res([]);
  });
}

// 将账号数据写入 LunaIdentityDB（绑定选中身份或新建）
// 将钱包账号写入专属的 LunaWalletAccountDB
// boundIdentityId 是用户在 user.html 里选择的身份 id（可为空）
async function _obSaveAccount(name, email, password, boundIdentityId) {
  return new Promise(res => {
    const req = indexedDB.open('LunaWalletAccountDB', 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('accounts', { keyPath: 'id' });
    };
    req.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('accounts', 'readwrite');
      tx.objectStore('accounts').put({
        id:              'main',           // 主账号固定 id
        name:            name,
        email:           email,
        password:        password,         // 实际项目应哈希，这里原样存
        boundIdentityId: boundIdentityId || null,
        createdAt:       Date.now(),
      });
      tx.oncomplete = () => res(true);
      tx.onerror    = () => res(false);
    };
    req.onerror = () => res(false);
  });
}

// 当前选中的身份 id
let _obSelectedIdentityId = null;

// 渲染身份列表
async function _obRenderIdentities() {
  const list = await _obLoadIdentities();
  const el   = document.getElementById('obIdentityList');
  if (!el) return;

  if (list.length === 0) {
    el.innerHTML = '<div style="font-size:11px;color:#c0bfb8;text-align:center;padding:12px 0">暂无身份档案——将自动创建新身份</div>';
    return;
  }

  el.innerHTML = '';
  list.forEach(identity => {
    const letter = (identity.name || '?')[0].toUpperCase();
    const color  = identity.avatarColor || '#5a5a52';
    const div    = document.createElement('div');
    div.className = 'ob-identity-item';
    div.dataset.id = identity.id;
    div.innerHTML = `
      <div class="ob-identity-avatar" style="background:${color}">${letter}</div>
      <div>
        <div class="ob-identity-name">${identity.name || '未命名'}</div>
        <div class="ob-identity-role">${identity.role || ''}</div>
      </div>
      <div class="ob-identity-check"></div>
    `;
    div.onclick = () => {
      document.querySelectorAll('.ob-identity-item').forEach(d => d.classList.remove('selected'));
      div.classList.add('selected');
      _obSelectedIdentityId = identity.id;
      // 自动填入姓名
      const nameInput = document.getElementById('obInputName');
      if (nameInput && !nameInput.value) nameInput.value = identity.name || '';
    };
    el.appendChild(div);
  });
}

// 切换屏幕
let _obCur = 0;
function obGoTo(n) {
  const screens = document.querySelectorAll('.ob-screen');
  const prev = _obCur;
  _obCur = n;

  screens[prev].classList.add('exit');
  screens[prev].classList.remove('active');
  setTimeout(() => { screens[prev].classList.remove('exit'); }, 400);

  setTimeout(() => { screens[_obCur].classList.add('active'); }, 50);

  // 进入屏幕3时加载身份列表
  if (n === 3) _obRenderIdentities();

  // 跳过按钮：屏幕3时隐藏
  const skipBtn = document.getElementById('obSkipBtn');
  if (skipBtn) skipBtn.style.visibility = n === 3 ? 'hidden' : 'visible';
}

// 切换条款勾选
function obToggleChk() {
  const c = document.getElementById('obChk');
  c.classList.toggle('ob-checked');
  if (c.classList.contains('ob-checked')) {
    c.style.background = '#2e2e28';
    c.style.borderColor = '#2e2e28';
    c.innerHTML = '<svg width="8" height="6" viewBox="0 0 10 8" fill="none"><polyline points="1 4 4 7 9 1" stroke="#edecea" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  } else {
    c.style.background = 'rgba(255,255,255,.6)';
    c.style.borderColor = '#c4c3bc';
    c.innerHTML = '';
  }
}

// 提交创建账号
async function obSubmit() {
  const name  = (document.getElementById('obInputName')  || {}).value || '';
  const chk   = document.getElementById('obChk');

  if (!name.trim())  { alert('请填写姓名'); return; }
  if (!chk || !chk.classList.contains('ob-checked')) { alert('请勾选服务条款'); return; }

  const ok = await _obSaveAccount(name.trim(), '', '', _obSelectedIdentityId);
  if (ok) {
    localStorage.setItem('luna_wallet_onboarded', '1');
    const ob = document.getElementById('wOnboarding');
    if (ob) {
      ob.style.opacity = '0';
      ob.style.transition = 'opacity .4s';
      setTimeout(() => {
        ob.style.display = 'none';
        // 注册完成后启动 Splash 动画进入 App
        const splashEl2 = document.getElementById('wSplash');
        if (splashEl2) splashEl2.style.display = 'flex';
        let idx2 = 0;
        const steps2 = [
          { pct: 18,  label: '正在连接' },
          { pct: 36,  label: '验证密钥' },
          { pct: 55,  label: '同步账本' },
          { pct: 74,  label: '加载资产' },
          { pct: 90,  label: '即将就绪' },
          { pct: 100, label: '欢迎加入' },
        ];
        const bar2    = document.getElementById('wSplashBar');
        const status2 = document.getElementById('wSplashStatus');
        const pct2    = document.getElementById('wSplashPct');
        function runSplash2() {
          if (idx2 >= steps2.length) {
            setTimeout(() => {
              if (splashEl2) splashEl2.classList.add('ws-hidden');
              setTimeout(() => { if (splashEl2) splashEl2.style.display = 'none'; }, 520);
            }, 600);
            return;
          }
          const s = steps2[idx2];
          if (bar2)    bar2.style.width       = s.pct + '%';
          if (status2) status2.textContent    = s.label;
          if (pct2)    pct2.textContent       = s.pct + '%';
          idx2++;
          setTimeout(runSplash2, idx2 === steps2.length ? 800 : 480);
        }
        setTimeout(runSplash2, 300);
      }, 400);
    }
  } else {
    alert('保存失败，请重试');
  }
}

// 入口：判断是否需要显示 onboarding
async function initOnboarding() {
  // 优先检查 localStorage 标记
  if (localStorage.getItem('luna_wallet_onboarded') === '1') return false;
  // 再检查 DB 里有没有身份数据
  const hasData = await _obCheckHasWalletAccount();
  if (hasData) {
    localStorage.setItem('luna_wallet_onboarded', '1');
    return false; // 不需要 onboarding
  }
  // 需要显示 onboarding
  const ob = document.getElementById('wOnboarding');
  if (ob) ob.classList.add('ob-visible');
  return true; // 需要 onboarding
}

/* ============================================================
   13. 读取主账号 + 绑定身份 → 渲染「我的」页面
============================================================ */
async function _loadWalletAccount() {
  return new Promise(res => {
    const req = indexedDB.open('LunaWalletAccountDB', 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('accounts', { keyPath: 'id' });
    };
    req.onsuccess = e => {
      const db = e.target.result;
      const r  = db.transaction('accounts').objectStore('accounts').get('main');
      r.onsuccess = () => res(r.result || null);
      r.onerror   = () => res(null);
    };
    req.onerror = () => res(null);
  });
}

async function _loadIdentityById(id) {
  if (!id) return null;
  return new Promise(res => {
    const req = indexedDB.open('LunaIdentityDB'); // 不写死版本号，避免与其他页面创建的库版本冲突（这正是刷新后身份信息读取失败的原因）
    req.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('identities')) return res(null);
      const r = db.transaction('identities').objectStore('identities').get(id);
      r.onsuccess = () => res(r.result || null);
      r.onerror   = () => res(null);
    };
    req.onerror = () => res(null);
  });
}

/* 读取钱包数据（资产/卡/交易笔数），不存在则返回 0 */
async function _loadWalletStats() {
  return new Promise(res => {
    const req = indexedDB.open('LunaWalletStatsDB', 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('stats', { keyPath: 'id' });
    };
    req.onsuccess = e => {
      const db = e.target.result;
      const r  = db.transaction('stats').objectStore('stats').get('main');
      r.onsuccess = () => res(r.result || { assets: 0, cards: 0, txCount: 0 });
      r.onerror   = () => res({ assets: 0, cards: 0, txCount: 0 });
    };
    req.onerror = () => res({ assets: 0, cards: 0, txCount: 0 });
  });
}

async function syncMePage() {
  const account  = await _loadWalletAccount();
  const identity = account?.boundIdentityId
    ? await _loadIdentityById(account.boundIdentityId)
    : null;
  const stats    = await _loadWalletStats();

  /* —— 姓名（优先用绑定身份的名字，其次才用注册名）—— */
  const displayName = identity?.name || account?.name || '未登录';

  // 「我的」页姓名
  const nameEl = document.getElementById('wMeName');
  if (nameEl) nameEl.textContent = displayName;

  // ★ 首页顶部用户名同步
  const homeUsernameEl = document.getElementById('wHomeUsername');
  if (homeUsernameEl) homeUsernameEl.textContent = displayName;

  /* —— 头像字母 —— */
  const avatarEl = document.getElementById('wMeAvatar');
  if (avatarEl) {
    if (identity?.avatarImg) {
      avatarEl.innerHTML = `<img src="${identity.avatarImg}" style="width:100%;height:100%;object-fit:cover;border-radius:17px;" alt=""/>`;
    } else {
      avatarEl.textContent = displayName ? displayName[0].toUpperCase() : '?';
    }
    if (identity?.avatarColor) avatarEl.style.background = identity.avatarColor;
  }

  /* —— ID 行 —— */
  const idEl = document.getElementById('wMeUserId');
  if (idEl && account?.id) {
    idEl.textContent = 'LN · ' + String(account.createdAt || Date.now()).slice(-8).toUpperCase();
  }

  /* —— 加入时间 —— */
  const joinEl = document.getElementById('wMeJoinDate');
  if (joinEl && account?.createdAt) {
    const d = new Date(account.createdAt);
    joinEl.textContent = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}`;
  }

  /* —— 统计三格 —— */
  const assetsEl  = document.getElementById('wMeAssets');
  const cardsEl   = document.getElementById('wMeCards');
  const txEl      = document.getElementById('wMeTxCount');
  if (assetsEl) assetsEl.textContent = '¥' + Number(stats.assets).toLocaleString('zh-CN', { minimumFractionDigits: 0 });
  if (cardsEl)  cardsEl.textContent  = stats.cards;
  if (txEl)     txEl.textContent     = stats.txCount;
}

/* ============================================================
   首页数据初始化与渲染
   —— 余额 / 收支 / 默认卡 / 最近交易 / 支出概览
   数据存储于 IndexedDB(LunaWalletHomeDB)，按身份隔离（与支付设置的
   _secIdentityKey 同一套 key 规则），首次进入某身份时自动播种默认数据。
============================================================ */

function _openHomeDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('LunaWalletHomeDB', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('home', { keyPath: 'id' });
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

/* 独立获取“当前身份 key”，与支付设置页的 _secIdentityKey 规则一致，
   但不依赖该变量（因为它只在打开支付设置页时才更新）。 */
async function _currentHomeIdentityKey() {
  try {
    const account = await _loadWalletAccount();
    const boundId = account?.boundIdentityId || 'default';
    return 'identity_' + boundId;
  } catch (e) {
    return 'identity_default';
  }
}

/* 首页初始状态 —— 每个身份第一次使用时的真实起点：
   余额为 0、无收支、无交易记录、卡片信息留空由用户后续绑卡填写。
   不使用任何"假种子数据"，所以不存在新旧版本冲突的问题，
   发布更新时也无需再改动任何版本号。 */
function _emptyHomeData() {
  return {
    balance: 0,
    income: 0,
    spend: 0,
    card: {
      brand: 'LUNA',
      type: 'Standard',
      numberLast4: '----',
      holder: '未绑定持卡人',
      expire: '-- / --'
    },
    transactions: [],
    spendOverview: {
      label: '本月支出概览',
      sub: '暂无支出记录',
      pct: 0
    }
  };
}

async function _loadHomeData() {
  const db  = await _openHomeDB();
  const key = await _currentHomeIdentityKey();
  const existing = await new Promise(res => {
    const r = db.transaction('home').objectStore('home').get(key);
    r.onsuccess = () => res(r.result || null);
    r.onerror   = () => res(null);
  });

  // 已有该身份的真实数据 —— 直接使用，不做任何覆盖
  if (existing) return existing;

  // 该身份首次使用 —— 写入真实的空白初始状态（非假数据）
  const initial = { id: key, ...(_emptyHomeData()) };
  await new Promise((res, rej) => {
    const tx = db.transaction('home', 'readwrite');
    tx.objectStore('home').put(initial);
    tx.oncomplete = () => res(true);
    tx.onerror    = () => rej(false);
  });
  return initial;
}

async function _saveHomeData(data) {
  const db  = await _openHomeDB();
  const key = await _currentHomeIdentityKey();
  return new Promise((res, rej) => {
    const tx = db.transaction('home', 'readwrite');
    tx.objectStore('home').put({ id: key, ...data });
    tx.oncomplete = () => res(true);
    tx.onerror    = () => rej(false);
  });
}

function _fmtAmount(n) {
  const abs = Math.abs(n);
  return abs.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* 渲染最近交易列表 */
function _renderTxList(transactions) {
  const list = document.getElementById('wTxList');
  if (!list) return;
  if (!transactions || !transactions.length) {
    list.innerHTML = `<div style="padding:24px 0;text-align:center;font-size:12.5px;color:#b0b0b8;">暂无交易记录</div>`;
    return;
  }
  list.innerHTML = transactions.map(tx => {
    const isOut = tx.dir === 'out';
    const iconSvg = isOut
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M19 12l-7-7-7 7"/></svg>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7 7 7-7"/></svg>`;
    const sign = isOut ? '-' : '+';
    return `
      <div class="w-tx-item">
        <div class="w-tx-icon ${isOut ? 'w-tx-out' : 'w-tx-in'}">${iconSvg}</div>
        <div class="w-tx-info">
          <div class="w-tx-name">${tx.name}</div>
          <div class="w-tx-date">${tx.date}</div>
        </div>
        <div class="w-tx-amount ${isOut ? 'out' : 'in'}">${sign}${_fmtAmount(tx.amount)}</div>
      </div>`;
  }).join('');
}

/* 主渲染入口：读取（或播种）首页数据并写入所有首页元素 */
async function renderHomeData() {
  let data;
  try {
    data = await _loadHomeData();
  } catch (e) {
    data = _emptyHomeData();
  }

  // 余额
  const balEl = document.getElementById('wBalanceNum');
  if (balEl) balEl.textContent = Number(data.balance || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // 本月收支
  const incomeEl = document.getElementById('wIncomeNum');
  const spendEl  = document.getElementById('wSpendNum');
  if (incomeEl) incomeEl.textContent = '+' + Number(data.income || 0).toLocaleString('zh-CN');
  if (spendEl)  spendEl.textContent  = '-' + Number(data.spend  || 0).toLocaleString('zh-CN');

  // 卡片标识徽章 + 默认卡预览：由 renderHomeDefaultCard() 统一处理（读取真实卡数据，含工艺样式渲染）
  await renderHomeDefaultCard();

  // 最近交易
  _renderTxList(data.transactions);

  // 支出概览横幅
  const ov = data.spendOverview || {};
  const planLabelEl = document.getElementById('wPlanLabel');
  const planSubEl   = document.getElementById('wPlanSub');
  const planFillEl  = document.getElementById('wPlanFill');
  const planPctEl   = document.getElementById('wPlanPct');
  if (planLabelEl) planLabelEl.textContent = ov.label || '本月支出概览';
  if (planSubEl)   planSubEl.textContent   = ov.sub || '';
  const pct = Math.max(0, Math.min(100, Number(ov.pct) || 0));
  if (planFillEl) planFillEl.style.width = pct + '%';
  if (planPctEl)  planPctEl.textContent  = pct + '%';
}

/* ============================================================
   支付设置页 — 内嵌全屏逻辑
============================================================ */

/* DB */
function _openSecDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('LunaWalletSecurityDB', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('security', { keyPath: 'id' });
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

/* 当前打开安全页时绑定的身份 id，用作 DB key 前缀，确保各身份密码互相隔离 */
let _secIdentityKey = 'identity_default';

async function _loadSecurity() {
  const db = await _openSecDB();
  return new Promise(res => {
    const r = db.transaction('security').objectStore('security').get(_secIdentityKey);
    r.onsuccess = () => res(r.result || { enabled: false, pin: null });
    r.onerror   = () => res({ enabled: false, pin: null });
  });
}
async function _saveSecurity(data) {
  const db = await _openSecDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('security', 'readwrite');
    tx.objectStore('security').put({ id: _secIdentityKey, ...data });
    tx.oncomplete = () => res(true);
    tx.onerror    = () => rej(false);
  });
}

/* 状态 */
let _secEnabled  = false;
let _secPin      = null;
let _secInput    = '';
let _secConfirm  = '';
// phase: 'set' | 'confirm' | 'change-old' | 'change-new' | 'change-confirm'
let _secPhase    = 'set';

/* 打开页面 */
async function wOpenSecurityPage() {
  const page = document.getElementById('wSecurityPage');
  page.style.display = 'flex';
  // 同步状态栏数据到支付设置页
  const mainTime = document.getElementById('statusTime');
  const secTime  = document.getElementById('secStatusTime');
  if (mainTime && secTime) secTime.textContent = mainTime.textContent;

  const mainPct  = document.getElementById('batPct');
  const secPct   = document.getElementById('secBatPct');
  if (mainPct && secPct) secPct.textContent = mainPct.textContent;

  const mainInner = document.getElementById('batInner');
  const secInner  = document.getElementById('secBatInner');
  if (mainInner && secInner) secInner.style.width = mainInner.style.width;

  const mainIsland = document.getElementById('statusIsland');
  const secIsland  = document.getElementById('secStatusIsland');
  if (mainIsland && secIsland) secIsland.innerHTML = mainIsland.innerHTML;
  requestAnimationFrame(() => { page.style.opacity = '1'; });

  // ★ 以当前绑定的身份 id 作为密码隔离 key，保证各身份密码互不干扰
  const currentAccount = await _loadWalletAccount();
  const boundId = currentAccount?.boundIdentityId || 'default';
  _secIdentityKey = 'identity_' + boundId;

  const saved = await _loadSecurity();
  _secEnabled = saved.enabled || false;
  _secPin     = saved.pin    || null;
  _secPhase   = 'set';
  _secInput   = '';
  _secConfirm = '';

  _secRenderState();
  _secUpdateCells('');
}

/* 关闭页面 */
function wCloseSecurityPage() {
  const page = document.getElementById('wSecurityPage');
  page.style.opacity = '0';
  setTimeout(() => { page.style.display = 'none'; }, 260);
}

/* 渲染开关 + 区域显示 */
function _secRenderState() {
  const toggle     = document.getElementById('wSecToggle');
  const thumb      = document.getElementById('wSecToggleThumb');
  const pinSetRow  = document.getElementById('wSecPinSetRow');
  const inputArea  = document.getElementById('wSecPinInputArea');

  // 开关颜色+滑块位移
  toggle.style.background = _secEnabled ? '#252830' : '#c8cad0';
  thumb.style.transform   = _secEnabled ? 'translateX(18px)' : 'translateX(0)';

  if (!_secEnabled) {
    pinSetRow.style.display = 'none';
    inputArea.style.display = 'none';
    return;
  }

  if (_secPin && _secPhase === 'set') {
    // 有密码且不在修改流程：显示已设置行，隐藏输入区
    pinSetRow.style.display = 'block';
    inputArea.style.display = 'none';
  } else {
    // 无密码 或 修改流程：显示输入区
    pinSetRow.style.display = _secPin ? 'block' : 'none';
    inputArea.style.display = 'block';
    // 更新标题提示
    const label = document.getElementById('wSecAreaLabel');
    const hint  = document.getElementById('wSecHint');
    const phaseMap = {
      'set':            ['设置密码',   '请输入 4 位数字密码'],
      'confirm':        ['确认密码',   '请再次输入密码确认'],
      'change-old':     ['修改密码',   '请输入当前密码'],
      'change-new':     ['修改密码',   '请输入新密码'],
      'change-confirm': ['修改密码',   '再次输入新密码确认'],
    };
    const [l, h] = phaseMap[_secPhase] || ['设置密码', '请输入 4 位数字密码'];
    if (label) label.textContent = l;
    if (hint)  { hint.textContent = h; hint.style.color = '#aab0bc'; }
  }
}

/* 更新4格显示 */
function _secUpdateCells(val) {
  for (let i = 0; i < 4; i++) {
    const cell = document.getElementById('wpc' + i);
    if (!cell) continue;
    cell.className = 'w-pin-cell';
    if (i < val.length)      cell.classList.add('filled');
    else if (i === val.length) cell.classList.add('active');
  }
  const btn = document.getElementById('wSecSaveBtn');
  if (btn) {
    btn.disabled = val.length < 4;
    btn.style.opacity = val.length < 4 ? '.35' : '1';
    btn.style.cursor  = val.length < 4 ? 'not-allowed' : 'pointer';
  }
}

/* 按键 */
function wSecKey(n) {
  if (_secInput.length >= 4) return;
  _secInput += n;
  _secUpdateCells(_secInput);
}
function wSecDel() {
  _secInput = _secInput.slice(0, -1);
  _secUpdateCells(_secInput);
}

/* 开关切换 */
function wSecTogglePin() {
  _secEnabled = !_secEnabled;
  if (!_secEnabled) {
    _secPin    = null;
    _secInput  = '';
    _secConfirm = '';
    _secPhase  = 'set';
    _saveSecurity({ enabled: false, pin: null });
  }
  _secRenderState();
  _secUpdateCells('');
  _secInput = '';
}

/* 修改密码入口 */
function wSecStartChange() {
  _secPhase  = 'change-old';
  _secInput  = '';
  _secConfirm = '';
  _secRenderState();
  _secUpdateCells('');
}

/* 保存 / 下一步 */
async function wSecSave() {
  if (_secInput.length < 4) return;
  const hint = document.getElementById('wSecHint');

  if (_secPhase === 'set') {
    // 第一次输入 → 进入确认阶段
    _secConfirm = '';
    _secPhase   = 'confirm';
    _secRenderState();
    _secInput = '';
    _secUpdateCells('');

  } else if (_secPhase === 'confirm') {
    if (_secInput !== _secConfirm && _secConfirm === '') {
      // 记录第一次，等待第二次
      _secConfirm = _secInput;
      _secInput   = '';
      _secPhase   = 'confirm';
      _secRenderState();
      _secUpdateCells('');
    } else {
      // 第二次输入，比对
      if (_secInput === _secConfirm) {
        _secPin     = _secInput;
        _secEnabled = true;
        await _saveSecurity({ enabled: true, pin: _secPin });
        _secPhase = 'set';
        _secInput = '';
        _secConfirm = '';
        _secRenderState();
        _secUpdateCells('');
        if (hint) { hint.textContent = '✓ 密码设置成功'; hint.style.color = '#34d399'; }
      } else {
        if (hint) { hint.textContent = '两次密码不一致，请重新输入'; hint.style.color = '#f87171'; }
        _secInput   = '';
        _secConfirm = '';
        _secUpdateCells('');
      }
    }

  } else if (_secPhase === 'change-old') {
    if (_secInput === _secPin) {
      _secPhase  = 'change-new';
      _secInput  = '';
      _secConfirm = '';
      _secRenderState();
      _secUpdateCells('');
    } else {
      if (hint) { hint.textContent = '密码错误，请重试'; hint.style.color = '#f87171'; }
      _secInput = '';
      _secUpdateCells('');
    }

  } else if (_secPhase === 'change-new') {
    _secConfirm = _secInput;
    _secPhase   = 'change-confirm';
    _secInput   = '';
    _secRenderState();
    _secUpdateCells('');

  } else if (_secPhase === 'change-confirm') {
    if (_secInput === _secConfirm) {
      _secPin = _secInput;
      await _saveSecurity({ enabled: true, pin: _secPin });
      _secPhase   = 'set';
      _secInput   = '';
      _secConfirm = '';
      _secRenderState();
      _secUpdateCells('');
      if (hint) { hint.textContent = '✓ 密码修改成功'; hint.style.color = '#34d399'; }
    } else {
      if (hint) { hint.textContent = '两次密码不一致，请重新输入'; hint.style.color = '#f87171'; }
      _secInput   = '';
      _secConfirm = '';
      _secPhase   = 'change-new';
      _secRenderState();
      _secUpdateCells('');
    }
  }
}

/* ============================================================
   身份选择器 — 扇形弹层
============================================================ */
let _wiIdentities  = [];
let _wiActiveIdx   = 0;
let _wiStartX      = 0;

// 从 LunaIdentityDB 读所有身份
function _wiLoadIdentities() {
  return new Promise(res => {
    const req = indexedDB.open('LunaIdentityDB');
    req.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('identities')) return res([]);
      const r = db.transaction('identities').objectStore('identities').getAll();
      r.onsuccess = () => res((r.result || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      r.onerror = () => res([]);
    };
    req.onerror = () => res([]);
  });
}

// 把选中的身份 id 写入 LunaWalletAccountDB
function _wiSaveBoundIdentity(identityId) {
  return new Promise(res => {
    const req = indexedDB.open('LunaWalletAccountDB', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('accounts', { keyPath: 'id' });
    req.onsuccess = e => {
      const db = e.target.result;
      // 先读出旧 account，保留其他字段，只更新 boundIdentityId
      const r = db.transaction('accounts').objectStore('accounts').get('main');
      r.onsuccess = () => {
        const old = r.result || { id: 'main', name: '', email: '', password: '', createdAt: Date.now() };
        old.boundIdentityId = identityId;
        const tx = db.transaction('accounts', 'readwrite');
        tx.objectStore('accounts').put(old);
        tx.oncomplete = () => res(true);
        tx.onerror    = () => res(false);
      };
      r.onerror = () => res(false);
    };
    req.onerror = () => res(false);
  });
}

// 构建单张卡片 HTML
function _wiCardHTML(identity, stats) {
  const initial = (identity.name || '?')[0].toUpperCase();
  const avatarInner = identity.avatarImg
    ? `<img src="${identity.avatarImg}" alt=""/>`
    : initial;
  const avatarStyle = identity.avatarImg ? '' : `background:${identity.avatarColor || '#2a2a2e'};`;
  const idStr = String(identity.id).slice(-6).toUpperCase();
  const tagsHtml = (identity.tags || []).slice(0, 2)
    .map(t => `<span class="wi-card-tag">${t}</span>`).join('');
  return `
    <div class="wi-card-toprow">
      <div style="position:relative;">
        <div class="wi-card-avatar" style="${avatarStyle}">${avatarInner}</div>
        <div class="wi-card-status ${identity.active ? 'on' : 'off'}"></div>
      </div>
      <div class="wi-card-id">ID · ${idStr}</div>
    </div>
    <div class="wi-card-name">${identity.name || '未命名'}</div>
    <div class="wi-card-role">${identity.role || '—'}</div>
    <div class="wi-card-divider"></div>
    <div class="wi-card-stats">
      <div class="wi-card-stat"><span class="wi-card-stat-num">¥${Number(stats.assets||0).toLocaleString()}</span><span class="wi-card-stat-lbl">资产</span></div>
      <div class="wi-card-stat"><span class="wi-card-stat-num">${stats.cards||0}</span><span class="wi-card-stat-lbl">绑定卡</span></div>
      <div class="wi-card-stat"><span class="wi-card-stat-num">${stats.txCount||0}</span><span class="wi-card-stat-lbl">交易</span></div>
    </div>
    ${tagsHtml ? `<div class="wi-card-tags">${tagsHtml}</div>` : ''}
    <div class="wi-card-dots">${'<span></span>'.repeat(9)}</div>
  `;
}

// ★ 渲染扇形 — 终极修复：mouseup 判选中，手势只绑一次
window._wiFanDrag = window._wiFanDrag || { down: false, sx: 0, moved: false };

function _wiRender() {
  const stage = document.getElementById('wiFanStage');
  const dots  = document.getElementById('wiFanDots');
  if (!stage || !dots) return;

  stage.innerHTML = '';
  dots.innerHTML  = '';

  const n = _wiIdentities.length;
  if (n === 0) return;

  _wiIdentities.forEach((identity, i) => {
    const diff     = i - _wiActiveIdx;
    const absDiff  = Math.abs(diff);
    const isActive = (i === _wiActiveIdx);
    const rot  = diff * 13;
    const xOff = diff * 24;
    const sc   = isActive ? 1 : Math.max(0.80, 1 - absDiff * 0.10);
    const op   = isActive ? 1 : Math.max(0.30, 1 - absDiff * 0.30);
    const z    = isActive ? 100 : 100 - absDiff * 10;

    const card = document.createElement('div');
    card.className = 'wi-fan-card' + (isActive ? ' wi-active' : '');
    card.dataset.idx = String(i);
    card.style.cssText = `left:50%;bottom:20px;transform:translateX(calc(-50% + ${xOff}px)) rotate(${rot}deg) scale(${sc});opacity:${op};z-index:${z};pointer-events:auto;cursor:pointer;`;
    card.innerHTML = _wiCardHTML(identity, { assets: 0, cards: 0, txCount: 0 });

    // ★ mouseup：抬起时没有拖拽 → 选中
    card.addEventListener('mouseup', (e) => {
      if (window._wiFanDrag.moved) return;
      e.stopPropagation();
      if (_wiActiveIdx !== i) { _wiActiveIdx = i; _wiRender(); }
    });
    card.addEventListener('touchend', (e) => {
      if (window._wiFanDrag.moved) return;
      e.stopPropagation();
      if (_wiActiveIdx !== i) { _wiActiveIdx = i; _wiRender(); }
    }, { passive: true });

    stage.appendChild(card);

    const dot = document.createElement('div');
    dot.className = 'wi-fan-dot' + (isActive ? ' active' : '');
    dot.style.cursor = 'pointer';
    dot.addEventListener('mouseup', (e) => { e.stopPropagation(); _wiActiveIdx = i; _wiRender(); });
    dots.appendChild(dot);
  });

  // ★ 手势：标记防重复绑定
  if (!stage._wiBound) {
    stage._wiBound = true;
    stage.addEventListener('mousedown', (e) => {
      window._wiFanDrag = { down: true, sx: e.clientX, moved: false };
    });
    stage.addEventListener('mousemove', (e) => {
      if (!window._wiFanDrag.down) return;
      if (Math.abs(e.clientX - window._wiFanDrag.sx) > 8) window._wiFanDrag.moved = true;
    });
    stage.addEventListener('mouseup', (e) => {
      const { moved, sx } = window._wiFanDrag;
      if (moved && Math.abs(e.clientX - sx) > 30) {
        _wiActiveIdx = (e.clientX - sx) < 0
          ? Math.min(_wiActiveIdx + 1, _wiIdentities.length - 1)
          : Math.max(_wiActiveIdx - 1, 0);
        _wiRender();
      }
      setTimeout(() => { window._wiFanDrag = { down: false, sx: 0, moved: false }; }, 40);
    });
    stage.addEventListener('touchstart', (e) => {
      window._wiFanDrag = { down: true, sx: e.touches[0].clientX, moved: false };
    }, { passive: true });
    stage.addEventListener('touchmove', (e) => {
      if (Math.abs(e.touches[0].clientX - window._wiFanDrag.sx) > 8) window._wiFanDrag.moved = true;
    }, { passive: true });
    stage.addEventListener('touchend', (e) => {
      const { moved, sx } = window._wiFanDrag;
      if (moved && Math.abs(e.changedTouches[0].clientX - sx) > 30) {
        _wiActiveIdx = (e.changedTouches[0].clientX - sx) < 0
          ? Math.min(_wiActiveIdx + 1, _wiIdentities.length - 1)
          : Math.max(_wiActiveIdx - 1, 0);
        _wiRender();
      }
      setTimeout(() => { window._wiFanDrag = { down: false, sx: 0, moved: false }; }, 40);
    }, { passive: true });
  }
}

// 打开弹层
async function wIdentityOpen() {
  const overlay = document.getElementById('wIdentityOverlay');
  const sheet   = document.getElementById('wIdentitySheet');
  const empty   = document.getElementById('wiEmptyState');
  const fanWrap = document.getElementById('wiFanStage');
  const dotWrap = document.getElementById('wiFanDots');
  const btnArea = sheet.querySelector('div:last-child'); // 按钮行

  if (!overlay) return;

  _wiIdentities = await _wiLoadIdentities();

  overlay.style.display = 'block';
  overlay.style.pointerEvents = 'all';
  requestAnimationFrame(() => {
    overlay.style.background = 'rgba(0,0,0,0.72)';
    overlay.style.backdropFilter = 'blur(24px)';
    overlay.style.webkitBackdropFilter = 'blur(24px)';
    sheet.style.opacity  = '1';
    sheet.style.transform = 'scale(1)';
  });

  if (_wiIdentities.length === 0) {
    fanWrap.style.display  = 'none';
    dotWrap.style.display  = 'none';
    // 找到按钮那行隐藏
    document.getElementById('wiBtnCancel').parentElement.style.display = 'none';
    empty.style.display = 'block';
  } else {
    fanWrap.style.display  = '';
    dotWrap.style.display  = 'flex';
    document.getElementById('wiBtnCancel').parentElement.style.display = 'flex';
    empty.style.display = 'none';
    // ★ 重置手势绑定标记（每次打开弹层重新绑定）
    if (fanWrap) fanWrap._wiBound = false;
    // 默认选中当前已绑定的身份
    const account = await _loadWalletAccount();
    if (account?.boundIdentityId) {
      const idx = _wiIdentities.findIndex(i => i.id === account.boundIdentityId);
      if (idx !== -1) _wiActiveIdx = idx;
    } else {
      _wiActiveIdx = 0;
    }
    _wiRender();
  }
}

// 关闭弹层
function wIdentityClose() {
  const overlay = document.getElementById('wIdentityOverlay');
  const sheet   = document.getElementById('wIdentitySheet');
  if (!overlay) return;
  overlay.style.background = 'rgba(0,0,0,0)';
  overlay.style.backdropFilter = 'blur(0px)';
  overlay.style.webkitBackdropFilter = 'blur(0px)';
  sheet.style.opacity   = '0';
  sheet.style.transform = 'scale(0.96)';
  setTimeout(() => {
    overlay.style.display = 'none';
    overlay.style.pointerEvents = 'none';
  }, 320);
}

async function wIdentityConfirm() {
  if (!_wiIdentities.length) return;
  const identity = _wiIdentities[_wiActiveIdx];

  // 按钮短暂反馈
  const btn = document.getElementById('wiBtnConfirm');
  if (btn) { btn.textContent = '登录中…'; btn.disabled = true; }

  // 写 DB（后台异步，不等待结果）
  _wiSaveBoundIdentity(identity.id);

  // ★ 立即用内存中的 identity 直接刷新所有 UI，不依赖 DB 读取
  _applyIdentityToUI(identity);

  // ★ 身份已切换，重新加载（或播种）该身份专属的首页数据
  renderHomeData();

  wIdentityClose();

  setTimeout(() => {
    switchTab('me');
    if (btn) { btn.textContent = '登录此身份'; btn.disabled = false; }
  }, 350);
}

/* ★ 直接把身份数据写入页面，完全不经过 DB */
function _applyIdentityToUI(identity) {
  const name = identity?.name || '未命名';

  // 「我的」页 — 姓名
  const nameEl = document.getElementById('wMeName');
  if (nameEl) nameEl.textContent = name;

  // 首页顶部用户名
  const homeEl = document.getElementById('wHomeUsername');
  if (homeEl) homeEl.textContent = name;

  // 头像
  const avatarEl = document.getElementById('wMeAvatar');
  if (avatarEl) {
    if (identity?.avatarImg) {
      avatarEl.innerHTML = `<img src="${identity.avatarImg}" style="width:100%;height:100%;object-fit:cover;border-radius:17px;" alt=""/>`;
      avatarEl.style.background = '';
    } else {
      avatarEl.innerHTML = '';
      avatarEl.textContent = name[0]?.toUpperCase() || '?';
      avatarEl.style.background = identity?.avatarColor || '#d0d3d8';
      avatarEl.style.color = '#fff';
    }
  }

  // ID 行（用 identity.id 后6位）
  const idEl = document.getElementById('wMeUserId');
  if (idEl) {
    idEl.textContent = 'LN · ' + String(identity?.id ?? '000000').slice(-6).toUpperCase();
  }

  // 加入时间（显示当前年月）
  const joinEl = document.getElementById('wMeJoinDate');
  if (joinEl) {
    const d = new Date();
    joinEl.textContent = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}

// 去 user.html 创建
function wIdentityGoCreate() {
  localStorage.setItem('luna_return_to', 'wallet_me');  // 告诉 user.js 回哪里
  const mask = document.getElementById('wTransMask');
  if (mask) {
    mask.style.opacity = '1';
    mask.style.pointerEvents = 'all';
    setTimeout(() => { window.location.href = 'user.html'; }, 300);
  } else {
    window.location.href = 'user.html';
  }
}

/* ============================================================
   申请新卡 · 完整业务逻辑
   —— 卡级门槛 / 货币 / 额度规则固定，不可被用户修改；
   —— 卡号、工艺样式、持卡人展示名、绑定角色等为用户自定义项；
   —— 数据按「当前绑定身份」隔离，保存到 IndexedDB(LunaWalletCardsDB)，
      首页与卡包页随时读取展示。
============================================================ */

/* ---------- 固定规则表（依据钱包使用说明文档，不可被前端随意改动） ---------- */
const AC_TIERS = {
  std: {
    key: 'std', name: '普通卡', en: 'Luna Standard', currency: 'Lune',
    desc: '注册即得 · 日常储蓄',
    requireText: '无门槛，注册即自动开通',
    check: () => ({ ok: true, reason: '' }),
    rules: [
      ['开通条件', '注册即得'],
      ['货币', 'Lune（主币）'],
      ['兑换手续费', '1%'],
      ['Mond 兑换上限', '10 Mond / 周'],
      ['汇率锁定', '不支持'],
    ],
  },
  gold: {
    key: 'gold', name: '金卡', en: 'Luna Gold', currency: 'Lune',
    desc: '中级 · 累计收入 ≥ 500 · 信用 ≥ 550',
    requireText: '累计收入 ≥ 500 Lune，信用分 ≥ 550 分',
    check: (ctx) => {
      if (ctx.totalIncome < 500) return { ok: false, reason: `累计收入还差 ${(500 - ctx.totalIncome).toLocaleString('zh-CN')} Lune` };
      if (ctx.creditScore < 550) return { ok: false, reason: `信用分还差 ${550 - ctx.creditScore} 分` };
      return { ok: true, reason: '' };
    },
    rules: [
      ['升级门槛', '累计收入 ≥ 500 Lune · 信用 ≥ 550'],
      ['货币', 'Lune（主币）'],
      ['信用卡额度', '200 Lune（先消费后还款）'],
      ['兑换手续费', '0.5%'],
      ['Mond 兑换上限', '50 Mond / 周'],
      ['亲属副卡', '最多开通 1 张'],
    ],
  },
  plat: {
    key: 'plat', name: '白金卡', en: 'Luna Platinum', currency: 'Syl',
    desc: '高级 · 累计收入 ≥ 2000 · 信用 ≥ 700',
    requireText: '累计收入 ≥ 2000 Lune，信用分 ≥ 700 分',
    check: (ctx) => {
      if (ctx.totalIncome < 2000) return { ok: false, reason: `累计收入还差 ${(2000 - ctx.totalIncome).toLocaleString('zh-CN')} Lune` };
      if (ctx.creditScore < 700) return { ok: false, reason: `信用分还差 ${700 - ctx.creditScore} 分` };
      return { ok: true, reason: '' };
    },
    rules: [
      ['升级门槛', '累计收入 ≥ 2000 Lune · 信用 ≥ 700'],
      ['货币', 'Syl（1 Syl = 10 Lune）'],
      ['信用卡额度', '500 Lune（先消费后还款）'],
      ['兑换手续费', '0.2%'],
      ['汇率锁定', '每周 1 次'],
      ['亲属副卡', '最多开通 2 张'],
      ['每月利息奖励', '10 Syl'],
    ],
  },
  noir: {
    key: 'noir', name: '黑卡', en: 'Luna Noir', currency: 'Mond',
    desc: '顶级 · 极稀有 · 累计收入 ≥ 10000',
    requireText: '累计收入 ≥ 10000 Lune，当前余额 ≥ 5000 Lune，信用分 ≥ 800 分',
    check: (ctx) => {
      if (ctx.totalIncome < 10000) return { ok: false, reason: `累计收入还差 ${(10000 - ctx.totalIncome).toLocaleString('zh-CN')} Lune` };
      if (ctx.balance < 5000) return { ok: false, reason: `当前余额还差 ${(5000 - ctx.balance).toLocaleString('zh-CN')} Lune` };
      if (ctx.creditScore < 800) return { ok: false, reason: `信用分还差 ${800 - ctx.creditScore} 分` };
      return { ok: true, reason: '' };
    },
    rules: [
      ['升级门槛', '累计收入 ≥ 10000 · 余额 ≥ 5000 · 信用 ≥ 800'],
      ['货币', 'Mond（稀有币，1 Mond = 100 Lune）'],
      ['信用卡额度', '2000 Lune（先消费后还款）'],
      ['兑换手续费', '全免'],
      ['汇率锁定', '每周 3 次'],
      ['亲属副卡', '最多开通 3 张'],
      ['每月尊享奖励', '1 Mond'],
    ],
  },
  family: {
    key: 'family', name: '亲属副卡', en: 'Luna Family', currency: 'Lune',
    desc: '需持有金卡及以上 · 共享主卡额度',
    requireText: '持有金卡及以上等级的主卡',
    check: (ctx) => {
      const mainTier = ctx.highestMainTier;
      if (!mainTier || mainTier === 'std') return { ok: false, reason: '需先升级到金卡及以上才能开通亲属副卡' };
      const cap = { gold: 1, plat: 2, noir: 3 }[mainTier] || 0;
      const already = ctx.cardCounts.family || 0;
      if (already >= cap) return { ok: false, reason: `当前主卡等级最多开通 ${cap} 张副卡，已用完` };
      if (!ctx.identities || ctx.identities.length === 0) return { ok: false, reason: '副卡必须绑定一个身份/角色，请先创建身份' };
      return { ok: true, reason: '', cap, already };
    },
    rules: [
      ['开通条件', '持有金卡及以上等级'],
      ['副卡张数', '金卡 1 张 / 白金卡 2 张 / 黑卡 3 张'],
      ['货币', '与主卡一致（Lune）'],
      ['额度共享', '所有副卡共享主卡信用额度，不单独计算'],
      ['号码绑定', '每张副卡必须绑定一个角色/身份'],
      ['管理权限', '主卡持有人可设每日限额、随时停用解绑'],
    ],
  },
  credit: {
    key: 'credit', name: '信用卡', en: 'Luna Credit', currency: 'Lune',
    desc: '需持有金卡及以上 · 先消费后还款',
    requireText: '持有金卡及以上等级的主卡',
    check: (ctx) => {
      const mainTier = ctx.highestMainTier;
      if (!mainTier || mainTier === 'std') return { ok: false, reason: '需先升级到金卡及以上才能开通信用卡' };
      if (ctx.cardCounts.credit > 0) return { ok: false, reason: '每个身份仅可开通一张信用卡' };
      const quota = { gold: 200, plat: 500, noir: 2000 }[mainTier];
      return { ok: true, reason: '', quota };
    },
    rules: [
      ['开通条件', '持有金卡及以上等级'],
      ['初始额度', '金卡 200 / 白金卡 500 / 黑卡 2000 Lune（按主卡等级固定）'],
      ['货币', 'Lune（主币）'],
      ['还款方式', '每月结算日自动从余额扣款'],
      ['逾期后果', '信用分扣 20 分'],
      ['提额规则', '连续 3 个月按时还款自动 +50 Lune'],
    ],
  },
};

const AC_TIER_ORDER = ['std', 'gold', 'plat', 'noir', 'family', 'credit'];

/* ---------- 4 种卡面工艺风格（纯外观，用户自由选择，不影响规则） ---------- */
const AC_STYLES = {
  foil:  { key: 'foil',  label: '箔纹', tag: 'FOIL-LINE' },
  pearl: { key: 'pearl', label: '珠光', tag: 'NACRE-PEARL' },
  hanji: { key: 'hanji', label: '韩纸', tag: 'HANJI-TEXTURE' },
  cut:   { key: 'cut',   label: '钻切', tag: 'DIAMOND-CUT' },
};

/* 每档卡的身份底色（跨风格保持一致的识别色） */
const AC_TIER_BASE_BG = {
  std:    'linear-gradient(150deg,#3a3a46,#232228 55%,#151419)',
  gold:   'linear-gradient(150deg,#4a3a14,#2c2208 55%,#160f04)',
  plat:   'linear-gradient(150deg,#1c3345,#122232 55%,#0a141f)',
  noir:   'linear-gradient(150deg,#232228,#101012 55%,#000000)',
  family: 'linear-gradient(150deg,#123527,#0c2419 55%,#061410)',
  credit: 'linear-gradient(150deg,#33204a,#20142e 55%,#120a1a)',
};
const AC_TIER_BASE_BG_PEARL = {
  std:    'linear-gradient(150deg,#eef0f5,#e2e0ec 55%,#d8d4e6)',
  gold:   'linear-gradient(150deg,#f7ecd8,#f0decf 55%,#e8d2c0)',
  plat:   'linear-gradient(150deg,#e6f1f6,#d9ebf2 55%,#c9dfec)',
  noir:   'linear-gradient(150deg,#dcdce4,#c8c6d6 55%,#b4b0c8)',
  family: 'linear-gradient(150deg,#e4f2ec,#d5ecdf 55%,#c2e0d0)',
  credit: 'linear-gradient(150deg,#efe4f7,#e2d0f0 55%,#d4bcea)',
};
const AC_TIER_ACCENT = {
  std: '#8b8698', gold: '#e3c476', plat: '#7fb4dd',
  noir: '#b39ee8', family: '#6fcaa3', credit: '#c9a0e8',
};
const AC_TIER_DOT_BG = {
  std: 'linear-gradient(135deg,#5a5a62,#333338)',
  gold: 'linear-gradient(135deg,#e3c476,#8a6a2e)',
  plat: 'linear-gradient(135deg,#a8d4f2,#3d6f96)',
  noir: 'linear-gradient(135deg,#c9b4f0,#4a3a70)',
  family: 'linear-gradient(135deg,#8fe0bb,#1e6b4a)',
  credit: 'linear-gradient(135deg,#dcb8f2,#5a3a80)',
};

/* ---------- DB：LunaWalletCardsDB，按身份隔离存全部卡片数组 ---------- */
function _openCardsDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('LunaWalletCardsDB', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('cards', { keyPath: 'id' });
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

async function _acIdentityKey() {
  try {
    const account = await _loadWalletAccount();
    const boundId = account?.boundIdentityId || 'default';
    return 'identity_' + boundId;
  } catch (e) {
    return 'identity_default';
  }
}

/* 读取当前身份名下所有卡片（不存在则返回空数组，不写假数据） */
async function _acLoadCards() {
  const db  = await _openCardsDB();
  const key = await _acIdentityKey();
  return new Promise(res => {
    const r = db.transaction('cards').objectStore('cards').get(key);
    r.onsuccess = () => res((r.result && r.result.list) || []);
    r.onerror   = () => res([]);
  });
}

async function _acSaveCards(list) {
  const db  = await _openCardsDB();
  const key = await _acIdentityKey();
  return new Promise((res, rej) => {
    const tx = db.transaction('cards', 'readwrite');
    tx.objectStore('cards').put({ id: key, list });
    tx.oncomplete = () => res(true);
    tx.onerror    = () => rej(false);
  });
}

/* 组装资格判定所需的上下文：累计收入 / 信用分 / 余额 / 已持有卡 / 可绑定身份列表 */
async function _acBuildContext() {
  const home  = await _loadHomeData();               // 复用首页已有的 IndexedDB 读取
  const cards = await _acLoadCards();

  const totalIncome = Number(home.totalIncome ?? home.income ?? 0);
  const creditScore = Number(home.creditScore ?? 550);
  const balance     = Number(home.balance ?? 0);

  const cardCounts = { std: 0, gold: 0, plat: 0, noir: 0, family: 0, credit: 0 };
  cards.forEach(c => { if (cardCounts[c.tier] !== undefined) cardCounts[c.tier]++; });

  // 当前身份持有的最高主卡等级（用于亲属副卡/信用卡的开通资格与额度）
  const mainOrder = ['noir', 'plat', 'gold', 'std'];
  let highestMainTier = null;
  for (const t of mainOrder) { if (cardCounts[t] > 0) { highestMainTier = t; break; } }

  const identities = await _obLoadIdentities();

  return { totalIncome, creditScore, balance, cardCounts, highestMainTier, identities, existingCards: cards };
}

/* ---------- 面板状态 ---------- */
let _acCtx = null;
let _acCurrentTier = null;
let _acCurrentStyle = 'foil';
let _acCurrentBindId = null;

async function wOpenApplyCard() {
  const page = document.getElementById('wApplyCardPage');
  if (!page) return;
  page.style.display = 'flex';

  // 同步状态栏
  const mainTime = document.getElementById('statusTime');
  const acTime   = document.getElementById('acStatusTime');
  if (mainTime && acTime) acTime.textContent = mainTime.textContent;
  const mainPct  = document.getElementById('batPct');
  const acPct    = document.getElementById('acBatPct');
  if (mainPct && acPct) acPct.textContent = mainPct.textContent;
  const mainInner = document.getElementById('batInner');
  const acInner    = document.getElementById('acBatInner');
  if (mainInner && acInner) acInner.style.width = mainInner.style.width;
  const mainIsland = document.getElementById('statusIsland');
  const acIsland    = document.getElementById('acStatusIsland');
  if (mainIsland && acIsland) acIsland.innerHTML = mainIsland.innerHTML;

  requestAnimationFrame(() => { page.style.opacity = '1'; });

  _acCtx = await _acBuildContext();
  _acShowListView();
}

function wCloseApplyCard() {
  const page = document.getElementById('wApplyCardPage');
  if (!page) return;
  page.style.opacity = '0';
  setTimeout(() => { page.style.display = 'none'; }, 260);
}

/* 顶部返回按钮：在自定义视图里先回到列表，在列表视图里直接关闭面板 */
function wApplyCardBack() {
  const customView = document.getElementById('acViewCustom');
  if (customView && customView.style.display !== 'none') {
    _acShowListView();
  } else {
    wCloseApplyCard();
  }
}

/* ---------- 视图一：卡级列表 ---------- */
function _acShowListView() {
  document.getElementById('acTitle').textContent = '申请新卡';
  document.getElementById('acViewList').style.display   = 'flex';
  document.getElementById('acViewCustom').style.display = 'none';
  _acRenderTierList();
}

function _acRenderTierList() {
  const box = document.getElementById('acTierList');
  if (!box || !_acCtx) return;

  box.innerHTML = AC_TIER_ORDER.map(key => {
    const tier   = AC_TIERS[key];
    const result = tier.check(_acCtx);
    const owned  = _acCtx.cardCounts[key] || 0;
    const dotBg  = AC_TIER_DOT_BG[key];

    let subText = tier.desc;
    if (!result.ok) subText = result.reason;
    else if (key === 'family' || key === 'credit') subText = tier.desc + (owned ? ` · 已开通 ${owned} 张` : '');
    else if (owned > 0) subText = tier.desc + ` · 已开通 ${owned} 张`;

    const badge = result.ok
      ? `<span class="ac-tier-badge ok">可开卡</span>`
      : `<span class="ac-tier-badge no">未达标</span>`;

    return `
      <div class="ac-tier-card ${result.ok ? 'unlocked' : 'locked'}"
           onclick="${result.ok ? `wApplyCardEnterCustom('${key}')` : ''}">
        <div class="ac-tier-dot" style="background:${dotBg};color:#fff;">${tier.name[0]}</div>
        <div class="ac-tier-mid">
          <div class="ac-tier-name">${tier.name} <span style="font-size:11px;color:#aab0bc;font-weight:400;">${tier.en}</span></div>
          <div class="ac-tier-sub">${subText}</div>
        </div>
        ${badge}
      </div>`;
  }).join('');
}

/* ---------- 视图二：自定义卡面 ---------- */
function wApplyCardEnterCustom(tierKey) {
  const tier = AC_TIERS[tierKey];
  const result = tier.check(_acCtx);
  if (!result.ok) return; // 双重保险，未达标不可进入

  _acCurrentTier  = tierKey;
  _acCurrentStyle = 'foil';
  _acCurrentBindId = null;

  document.getElementById('acTitle').textContent = tier.name + ' · 自定义';
  document.getElementById('acViewList').style.display   = 'none';
  document.getElementById('acViewCustom').style.display = 'flex';

  // 清空输入
  document.getElementById('acInputNumber').value   = '';
  document.getElementById('acInputHolder').value   = '';
  document.getElementById('acInputNickname').value = '';
  document.getElementById('acErrorMsg').style.display = 'none';

  _acRenderStyleRow();
  _acRenderRuleBox(tierKey, result);
  _acRenderBindRow(tierKey);
  wApplyCardRenderPreview();
}

function _acRenderStyleRow() {
  const box = document.getElementById('acStyleRow');
  box.innerHTML = Object.values(AC_STYLES).map(s => `
    <div class="ac-style-chip ${s.key === _acCurrentStyle ? 'active' : ''}" onclick="wApplyCardPickStyle('${s.key}')">
      <div class="ac-style-chip-label">${s.label}</div>
      <div class="ac-style-chip-tag">${s.tag}</div>
    </div>`).join('');
}

function wApplyCardPickStyle(styleKey) {
  _acCurrentStyle = styleKey;
  _acRenderStyleRow();
  wApplyCardRenderPreview();
}

function _acRenderRuleBox(tierKey, result) {
  const tier = AC_TIERS[tierKey];
  const box = document.getElementById('acRuleBox');
  let rows = tier.rules.slice();

  // 信用卡/亲属副卡的额度或张数是动态算出的，追加显示实际生效值
  if (tierKey === 'credit' && result.quota) {
    rows = rows.concat([['本次实际额度', result.quota + ' Lune（按当前主卡等级）']]);
  }
  if (tierKey === 'family' && result.cap !== undefined) {
    rows = rows.concat([['剩余可开数', (result.cap - result.already) + ' 张']]);
  }

  box.innerHTML = rows.map(([k, v]) => `
    <div class="ac-rule-row"><span class="ac-rule-key">${k}</span><span class="ac-rule-val">${v}</span></div>
  `).join('');
}

/* 绑定角色：亲属副卡强制要求选择一个身份；其余卡级为可选展示（默认当前身份） */
function _acRenderBindRow(tierKey) {
  const row   = document.getElementById('acBindRow');
  const label = document.getElementById('acBindLabel');
  const box   = document.getElementById('acBindPicker');
  const identities = _acCtx.identities || [];

  if (tierKey === 'family') {
    label.textContent = '绑定角色（必选，副卡专属持有人）';
    row.style.display = 'block';
    if (identities.length === 0) {
      box.innerHTML = `<div style="font-size:12.5px;color:#9aa0ac;">暂无可绑定的身份，请先在「用户」页创建</div>`;
      return;
    }
    box.innerHTML = identities.map(id => {
      const letter = (id.name || '?')[0].toUpperCase();
      const color  = id.avatarColor || '#5a5a62';
      return `
        <div class="ac-bind-item ${id.id === _acCurrentBindId ? 'active' : ''}" onclick="wApplyCardPickBind('${id.id}')">
          <div class="ac-bind-avatar" style="background:${color}">
            ${id.avatarImg ? `<img src="${id.avatarImg}" style="width:100%;height:100%;object-fit:cover;" alt=""/>` : letter}
          </div>
          <div>
            <div class="ac-bind-name">${id.name || '未命名'}</div>
            <div class="ac-bind-role">${id.role || '—'}</div>
          </div>
        </div>`;
    }).join('');
  } else {
    label.textContent = '绑定角色（可选，用于在卡面标注持卡身份）';
    row.style.display = 'block';
    const noneChip = `
      <div class="ac-bind-item ${_acCurrentBindId === null ? 'active' : ''}" onclick="wApplyCardPickBind(null)">
        <div class="ac-bind-avatar" style="background:#4a4a54">—</div>
        <div><div class="ac-bind-name">不绑定角色</div><div class="ac-bind-role">仅使用下方展示名</div></div>
      </div>`;
    const idChips = identities.map(id => {
      const letter = (id.name || '?')[0].toUpperCase();
      const color  = id.avatarColor || '#5a5a62';
      return `
        <div class="ac-bind-item ${id.id === _acCurrentBindId ? 'active' : ''}" onclick="wApplyCardPickBind('${id.id}')">
          <div class="ac-bind-avatar" style="background:${color}">
            ${id.avatarImg ? `<img src="${id.avatarImg}" style="width:100%;height:100%;object-fit:cover;" alt=""/>` : letter}
          </div>
          <div>
            <div class="ac-bind-name">${id.name || '未命名'}</div>
            <div class="ac-bind-role">${id.role || '—'}</div>
          </div>
        </div>`;
    }).join('');
    box.innerHTML = noneChip + idChips;
  }
}

function wApplyCardPickBind(id) {
  _acCurrentBindId = id;
  _acRenderBindRow(_acCurrentTier);
  wApplyCardRenderPreview();
}

/* 卡号输入：自动格式化为 4-4-4-4 展示，内部保留纯数字 */
function wApplyCardOnNumberInput(el) {
  let digits = el.value.replace(/\D/g, '').slice(0, 16);
  el.value = digits.replace(/(.{4})/g, '$1 ').trim();
  const hint = document.getElementById('acNumberHint');
  if (digits.length === 16) {
    hint.textContent = '✓ 卡号格式正确';
    hint.style.color = '#7fe3b4';
  } else {
    hint.textContent = `请输入完整 16 位卡号（还差 ${16 - digits.length} 位）`;
    hint.style.color = '#aab0bc';
  }
  wApplyCardRenderPreview();
}

/* ---------- 卡面实时预览渲染（复刻 card_designs.html 的 4 种工艺 x 6 种卡级） ---------- */
function _acCardFaceCSSVars(tierKey, styleKey) {
  const accent = AC_TIER_ACCENT[tierKey];
  const bg = styleKey === 'pearl' ? AC_TIER_BASE_BG_PEARL[tierKey] : AC_TIER_BASE_BG[tierKey];
  const isPearl = styleKey === 'pearl';
  return { accent, bg, textColor: isPearl ? '#211f2b' : '#f3efe4' };
}

function _acDecoLayerHTML(styleKey) {
  if (styleKey === 'foil') {
    return `
      <div style="position:absolute;inset:0;opacity:.5;pointer-events:none;background-image:repeating-linear-gradient(115deg, rgba(255,255,255,.05) 0px, rgba(255,255,255,.05) 1px, transparent 1px, transparent 26px);"></div>
      <div style="position:absolute;inset:10px;border:1px solid rgba(233,216,164,.35);border-radius:10px;pointer-events:none;"></div>
      <div style="position:absolute;width:120px;height:120px;top:-40px;right:-30px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.16),transparent 70%);pointer-events:none;"></div>`;
  }
  if (styleKey === 'pearl') {
    return `
      <div style="position:absolute;inset:0;pointer-events:none;background:
        radial-gradient(ellipse 260px 140px at 15% 10%, rgba(255,255,255,.55), transparent 60%),
        radial-gradient(ellipse 220px 160px at 90% 90%, rgba(255,220,240,.35), transparent 55%),
        radial-gradient(ellipse 200px 140px at 75% 15%, rgba(200,230,255,.3), transparent 55%);
        mix-blend-mode:overlay;"></div>`;
  }
  if (styleKey === 'hanji') {
    return `
      <div style="position:absolute;inset:0;pointer-events:none;opacity:.18;background-image:
        radial-gradient(rgba(255,255,255,.5) .5px, transparent .5px),
        radial-gradient(rgba(0,0,0,.35) .5px, transparent .5px);
        background-size:3px 3px, 5px 5px; background-position:0 0, 1.5px 2px;"></div>
      <div style="position:absolute;inset:9px;border:1px solid rgba(230,200,120,.3);border-radius:8px;pointer-events:none;"></div>`;
  }
  if (styleKey === 'cut') {
    return `
      <div style="position:absolute;inset:0;pointer-events:none;background:linear-gradient(125deg, transparent 40%, rgba(255,255,255,.22) 48%, transparent 56%);"></div>
      <svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:.5;" viewBox="0 0 400 250" preserveAspectRatio="none">
        <polyline points="0,0 140,0 90,90 0,60" fill="rgba(255,255,255,.06)"/>
        <polyline points="400,250 260,250 310,160 400,190" fill="rgba(255,255,255,.05)"/>
      </svg>`;
  }
  return '';
}

function _acChipHTML(styleKey) {
  const bgMap = {
    foil:  'linear-gradient(135deg,#e9d8a4,#b6934f 60%,#8a6a34)',
    pearl: 'linear-gradient(135deg,#fdf6ff,#e3d8f5 50%,#c9b8e8)',
    hanji: 'linear-gradient(135deg,#d9bd7c,#a9814a)',
    cut:   'linear-gradient(135deg,#e6ecff,#9fb0e6 55%,#5c6bc4)',
  };
  const clip = styleKey === 'cut' ? 'clip-path:polygon(12% 0,100% 0,100% 78%,88% 100%,0 100%,0 22%);' : '';
  return `<div style="width:34px;height:26px;border-radius:5px;background:${bgMap[styleKey]};box-shadow:inset 0 0 0 1px rgba(0,0,0,.25);${clip}"></div>`;
}

function wApplyCardRenderPreview() {
  if (!_acCurrentTier) return;
  const tier  = AC_TIERS[_acCurrentTier];
  const vars  = _acCardFaceCSSVars(_acCurrentTier, _acCurrentStyle);
  const styleTag = AC_STYLES[_acCurrentStyle].tag;

  const digits  = document.getElementById('acInputNumber').value.replace(/\D/g, '');
  const numDisp = (digits + '················'.slice(0, 16)).slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

  let holderDisp = document.getElementById('acInputHolder').value.trim();
  if (!holderDisp && _acCurrentBindId) {
    const id = (_acCtx.identities || []).find(i => i.id === _acCurrentBindId);
    if (id) holderDisp = (id.name || '').toUpperCase();
  }
  if (!holderDisp) holderDisp = 'LUNA WALLET USER';

  const card = document.getElementById('acPreviewCard');
  card.style.background = vars.bg;
  card.innerHTML = `
    <div style="position:absolute;inset:0;padding:22px 24px;display:flex;flex-direction:column;justify-content:space-between;color:${vars.textColor};">
      ${_acDecoLayerHTML(_acCurrentStyle)}
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-family:'Noto Serif SC',serif;font-weight:700;font-size:15px;letter-spacing:.02em;">${tier.en}</div>
          <div style="font-family:'Space Mono',monospace;font-size:9px;letter-spacing:.18em;text-transform:uppercase;opacity:.8;margin-top:3px;color:${vars.accent};">${tier.name.toUpperCase()} · ${styleTag}</div>
        </div>
        <div style="width:30px;height:30px;border-radius:50%;flex-shrink:0;background:${_acCurrentStyle==='cut' ? `linear-gradient(155deg,#dfe6ff,#8fa0e8 45%,#4c5cad)` : _acCurrentStyle==='hanji' ? 'transparent' : _acCurrentStyle==='pearl' ? 'conic-gradient(from 210deg,#f6d4e6,#cfe8f2,#e8e0fb,#d7f2e6,#f6d4e6)' : 'conic-gradient(from 180deg,#e8cf8a,#fff6d8,#c9a355,#fff6d8,#e8cf8a)'};${_acCurrentStyle==='hanji' ? `border:1.4px solid rgba(230,200,120,.85);` : ''}${_acCurrentStyle==='cut' ? `clip-path:polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%);` : ''}"></div>
      </div>
      <div>
        ${_acChipHTML(_acCurrentStyle)}
        <div style="height:10px"></div>
        <div style="font-family:'Space Mono',monospace;font-size:14.5px;letter-spacing:.14em;">${numDisp}</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          <div style="font-family:'Space Mono',monospace;font-size:10.5px;letter-spacing:.08em;opacity:.8;">${holderDisp.toUpperCase()}</div>
          <div style="font-size:8.5px;letter-spacing:.1em;opacity:.55;margin-top:3px;font-family:'Space Mono',monospace;">VALID THRU 12/∞</div>
        </div>
        <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-size:13px;opacity:.7;">Luna</div>
      </div>
    </div>`;
}

/* ---------- 保存：写入 IndexedDB，立即同步首页默认卡与卡包列表 ---------- */
async function wApplyCardSave() {
  const errBox = document.getElementById('acErrorMsg');
  errBox.style.display = 'none';

  const tierKey = _acCurrentTier;
  const tier = AC_TIERS[tierKey];

  // 再次校验资格（防止面板停留期间数据变化）
  _acCtx = await _acBuildContext();
  const result = tier.check(_acCtx);
  if (!result.ok) {
    errBox.textContent = result.reason || '当前不满足该卡级的开卡条件';
    errBox.style.display = 'block';
    return;
  }

  const digits = document.getElementById('acInputNumber').value.replace(/\D/g, '');
  if (digits.length !== 16) {
    errBox.textContent = '请输入完整的 16 位卡号';
    errBox.style.display = 'block';
    return;
  }

  if (tierKey === 'family' && !_acCurrentBindId) {
    errBox.textContent = '亲属副卡必须绑定一个角色/身份';
    errBox.style.display = 'block';
    return;
  }

  const holder = document.getElementById('acInputHolder').value.trim() || 'LUNA WALLET USER';
  const nickname = document.getElementById('acInputNickname').value.trim() || (tier.name + ' ' + digits.slice(-4));

  const newCard = {
    id: 'card_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    tier: tierKey,
    tierName: tier.name,
    currency: tier.currency,
    styleKey: _acCurrentStyle,
    numberFull: digits,
    numberLast4: digits.slice(-4),
    holder: holder,
    nickname: nickname,
    boundIdentityId: _acCurrentBindId || null,
    quota: tierKey === 'credit' ? result.quota : null,
    isDefault: _acCtx.existingCards.length === 0,   // 第一张卡自动设为首页默认展示卡
    createdAt: Date.now(),
  };

  const list = _acCtx.existingCards.concat([newCard]);
  await _acSaveCards(list);

  // 同步统计卡数（LunaWalletStatsDB.cards）
  await _acSyncStatsCardCount(list.length);

  // 刷新卡包页 + 首页（首页会直接从 LunaWalletCardsDB 读取真实卡面渲染，无需再同步文字占位数据）
  await renderCardsPage();
  await renderHomeData();

  // ---- 办卡成功联动：横幅通知 + 信息 App「系统」消息同步 ----
  _acNotifyCardIssued(newCard);

  wCloseApplyCard();
}

/* 办卡成功后的通知联动：
   1) 若用户在「设置 → 消息横幅」中开启了横幅并选择了样式，立即按该样式弹出一条横幅
   2) 无论横幅是否开启，都写入一条系统消息，供「信息」App 的「系统」分组同步展示 */
function _acNotifyCardIssued(card) {
  const cardLabel = card.nickname || card.tierName;
  const bannerMsg = `${cardLabel}（**** ${card.numberLast4}）已成功添加到你的卡包`;

  if (window.LunaBanner) {
    window.LunaBanner.show({
      app: 'Wallet',
      title: '办卡成功',
      message: bannerMsg
    });
  }

  if (window.LunaSystemMessages) {
    window.LunaSystemMessages.push({
      app: 'Wallet',
      title: '办卡成功',
      message: bannerMsg
    });
  }
}

async function _acSyncStatsCardCount(count) {
  return new Promise(res => {
    const req = indexedDB.open('LunaWalletStatsDB', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('stats', { keyPath: 'id' });
    req.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('stats', 'readwrite');
      const store = tx.objectStore('stats');
      const r = store.get('main');
      r.onsuccess = () => {
        const cur = r.result || { id: 'main', assets: 0, cards: 0, txCount: 0 };
        cur.cards = count;
        store.put(cur);
      };
      tx.oncomplete = () => res(true);
      tx.onerror    = () => res(false);
    };
    req.onerror = () => res(false);
  });
}

/* ---------- 卡包页渲染：展示当前身份名下所有已保存的卡片 ---------- */
async function renderCardsPage() {
  const box = document.getElementById('wCardsStack');
  if (!box) return;
  const cards = await _acLoadCards();

  if (!cards.length) {
    box.innerHTML = `<div style="padding:30px 0;text-align:center;font-size:12.5px;color:#b0b0b8;">暂无卡片，点击下方按钮申请第一张卡</div>`;
    return;
  }

  box.innerHTML = cards.map(c => {
    const dotBg = AC_TIER_DOT_BG[c.tier] || '#c8cdd6';
    let rightText = '';
    if (c.tier === 'credit') rightText = `额度 ${Number(c.quota || 0).toLocaleString('zh-CN')} ${c.currency}`;
    else if (c.tier === 'family') rightText = '共享主卡额度';
    else rightText = c.currency;
    const defaultTag = c.isDefault ? `<span style="font-size:9.5px;color:#1a9a5e;background:#d6f2e3;padding:2px 7px;border-radius:20px;margin-left:6px;vertical-align:1px;">首页展示</span>` : '';
    return `
      <div class="w-card-item" onclick="wCardDetailOpen('${c.id}')">
        <div class="w-ci-left">
          <div class="w-ci-dot" style="background:${dotBg}"></div>
          <div>
            <div class="w-ci-name">${c.nickname || c.tierName}${defaultTag}</div>
            <div class="w-ci-num">**** ${c.numberLast4}</div>
          </div>
        </div>
        <div class="w-ci-right">${rightText}</div>
      </div>`;
  }).join('');
}

/* 点击卡包里的某张卡 → 设为首页展示的默认卡 */
async function wCardsSetDefault(cardId) {
  const cards = await _acLoadCards();
  if (!cards.length) return;
  const target = cards.find(c => c.id === cardId);
  if (!target || target.isDefault) return; // 已经是默认卡，无需重复设置
  cards.forEach(c => { c.isDefault = (c.id === cardId); });
  await _acSaveCards(cards);
  await renderCardsPage();
  await renderHomeDefaultCard();
}

/* ---------- 首页「我的卡」真实渲染：复用申请新卡的工艺样式系统，实时同步用户实际保存的默认卡 ---------- */
async function renderHomeDefaultCard() {
  const box = document.getElementById('wDefaultCard');
  if (!box) return;

  const cards = await _acLoadCards();
  const badgeEl = document.getElementById('wBcBadge');

  if (!cards.length) {
    // 空态：引导用户去申请第一张卡
    if (badgeEl) badgeEl.textContent = '未开卡';
    box.innerHTML = `
      <div class="w-default-card-empty" onclick="wOpenApplyCard()">
        <div class="w-default-card-empty-title">还没有任何卡片</div>
        <div class="w-default-card-empty-sub">点击这里申请你的第一张卡</div>
      </div>`;
    return;
  }

  const card = cards.find(c => c.isDefault) || cards[0];
  if (badgeEl) badgeEl.textContent = card.tierName;

  box.innerHTML = `<div class="w-default-card-inner">${_acFrontFaceHTML(card)}</div>`;
}

/* =====================================================================
   卡片详情虚化弹层：点击卡包列表中的卡触发
   —— 复刻 card_designs.html 的正反面工艺系统，支持翻转查看背面、
      设为首页展示卡、编辑卡片信息（工艺/卡号/持卡人/备注名）、注销卡片
   ===================================================================== */

/* ---------- 卡片正面完整 HTML（首页默认卡与详情弹层共用同一套渲染规则） ---------- */
function _acFrontFaceHTML(card) {
  const vars = _acCardFaceCSSVars(card.tier, card.styleKey);
  const styleTag = (AC_STYLES[card.styleKey] || AC_STYLES.foil).tag;
  const tier = AC_TIERS[card.tier];
  const numDisp = (card.numberFull || '').replace(/(.{4})/g, '$1 ').trim();
  return `
    <div style="position:absolute;inset:0;background:${vars.bg};">
      <div style="position:absolute;inset:0;padding:22px 24px;display:flex;flex-direction:column;justify-content:space-between;color:${vars.textColor};">
        ${_acDecoLayerHTML(card.styleKey)}
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div style="font-family:'Noto Serif SC',serif;font-weight:700;font-size:15px;letter-spacing:.02em;">${tier.en}</div>
            <div style="font-family:'Space Mono',monospace;font-size:9px;letter-spacing:.18em;text-transform:uppercase;opacity:.8;margin-top:3px;color:${vars.accent};">${card.tierName.toUpperCase()} · ${styleTag}</div>
          </div>
          ${_acChipHTML(card.styleKey)}
        </div>
        <div>
          <div style="font-family:'Space Mono',monospace;font-size:14.5px;letter-spacing:.14em;">${numDisp}</div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:flex-end;">
          <div>
            <div style="font-family:'Space Mono',monospace;font-size:10.5px;letter-spacing:.08em;opacity:.8;">${(card.holder || 'LUNA WALLET USER').toUpperCase()}</div>
            <div style="font-size:8.5px;letter-spacing:.1em;opacity:.55;margin-top:3px;font-family:'Space Mono',monospace;">VALID THRU 12/∞</div>
          </div>
          <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-size:13px;opacity:.7;">Luna</div>
        </div>
      </div>
    </div>`;
}

/* ---------- 卡片背面完整 HTML（磁条 + 签名条 + CVV + 免责声明，复刻 card_designs.html） ---------- */
function _acBackFaceHTML(card) {
  const vars = _acCardFaceCSSVars(card.tier, card.styleKey);
  const isPearl = card.styleKey === 'pearl';
  const stripeBg = 'linear-gradient(90deg,#141116,#0a0810)';
  const sigBg = 'repeating-linear-gradient(115deg,#e9e5da,#e9e5da 3px,#dcd7c8 3px,#dcd7c8 6px)';
  const footerColor = isPearl ? 'rgba(50,40,60,.55)' : 'rgba(255,255,255,.4)';
  return `
    <div style="position:absolute;inset:0;background:${vars.bg};">
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;color:${vars.textColor};">
        ${_acDecoLayerHTML(card.styleKey)}
        <div style="width:100%;height:34px;margin-top:20px;background:${stripeBg};"></div>
        <div style="margin:18px 24px 0;display:flex;align-items:center;gap:10px;">
          <div style="flex:1;height:30px;border-radius:4px;background:${sigBg};"></div>
          <div style="width:44px;height:30px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-family:'Space Mono',monospace;font-size:11px;background:#f4f1e8;color:#1a1814;">•••</div>
        </div>
        <div style="margin:auto 24px 20px;font-size:8px;line-height:1.8;letter-spacing:.03em;color:${footerColor};">此卡为 LUNA WALLET 虚拟世界观内资产，不具备任何现实货币价值。<br>如遇号码遗失请在钱包设置中挂失重置。</div>
        <div style="position:absolute;bottom:16px;right:22px;font-family:'Noto Serif SC',serif;font-weight:700;font-size:11px;color:${footerColor};">Luna Wallet</div>
      </div>
    </div>`;
}

/* ---------- 弹层状态 ---------- */
let _wCdCards = [];
let _wCdCurrentId = null;
let _wCdEditStyle = 'foil';

/* 打开详情弹层：虚化背景 + 展示真实正反面卡片 */
async function wCardDetailOpen(cardId) {
  const overlay = document.getElementById('wCardDetailOverlay');
  const sheet   = document.getElementById('wCardDetailSheet');
  if (!overlay) return;

  _wCdCards = await _acLoadCards();
  const card = _wCdCards.find(c => c.id === cardId);
  if (!card) return;
  _wCdCurrentId = cardId;

  document.getElementById('wCdScene').classList.remove('flipped');
  _wCdRenderView(card);

  document.getElementById('wCdView').style.display = 'flex';
  document.getElementById('wCdEdit').style.display = 'none';
  document.getElementById('wCdCancelConfirm').style.display = 'none';

  overlay.style.display = 'block';
  overlay.style.pointerEvents = 'all';
  requestAnimationFrame(() => {
    overlay.style.background = 'rgba(0,0,0,0.72)';
    overlay.style.backdropFilter = 'blur(24px)';
    overlay.style.webkitBackdropFilter = 'blur(24px)';
    sheet.style.opacity = '1';
    sheet.style.transform = 'scale(1)';
  });
}

function wCardDetailClose() {
  const overlay = document.getElementById('wCardDetailOverlay');
  const sheet   = document.getElementById('wCardDetailSheet');
  if (!overlay) return;
  overlay.style.background = 'rgba(0,0,0,0)';
  overlay.style.backdropFilter = 'blur(0px)';
  overlay.style.webkitBackdropFilter = 'blur(0px)';
  sheet.style.opacity = '0';
  sheet.style.transform = 'scale(0.94)';
  setTimeout(() => {
    overlay.style.display = 'none';
    overlay.style.pointerEvents = 'none';
    _wCdCurrentId = null;
  }, 320);
}

/* 点击虚化背景（非卡片/面板本身）关闭弹层 */
function wCardDetailBackdropClick(event) {
  if (event.target && event.target.id === 'wCardDetailOverlay') wCardDetailClose();
}

/* 点击卡片本体：翻转查看背面 */
function wCardDetailFlip() {
  const scene = document.getElementById('wCdScene');
  if (scene) scene.classList.toggle('flipped');
}

/* 渲染展示态：正反面卡面 + 信息行 + 首页展示状态 */
function _wCdRenderView(card) {
  document.getElementById('wCdFront').innerHTML = _acFrontFaceHTML(card);
  document.getElementById('wCdBack').innerHTML  = _acBackFaceHTML(card);

  const tier = AC_TIERS[card.tier];
  let extraRow = '';
  if (card.tier === 'credit') {
    extraRow = `<div class="w-cd-meta-row"><span class="w-cd-meta-key">信用额度</span><span class="w-cd-meta-val">${Number(card.quota || 0).toLocaleString('zh-CN')} ${card.currency}</span></div>`;
  } else if (card.tier === 'family') {
    extraRow = `<div class="w-cd-meta-row"><span class="w-cd-meta-key">额度规则</span><span class="w-cd-meta-val" style="font-family:inherit;">共享主卡额度</span></div>`;
  }

  document.getElementById('wCdMeta').innerHTML = `
    <div class="w-cd-meta-row"><span class="w-cd-meta-key">卡片备注名</span><span class="w-cd-meta-val" style="font-family:inherit;">${card.nickname || tier.name}</span></div>
    <div class="w-cd-meta-row"><span class="w-cd-meta-key">卡级</span><span class="w-cd-meta-val" style="font-family:inherit;">${tier.name}</span></div>
    <div class="w-cd-meta-row"><span class="w-cd-meta-key">卡号</span><span class="w-cd-meta-val">**** ${card.numberLast4}</span></div>
    ${extraRow}
  `;

  const zone = document.getElementById('wCdDefaultZone');
  zone.innerHTML = card.isDefault
    ? `<div class="w-cd-default-tag">✓ 当前首页展示中</div>`
    : `<div class="w-cd-default-btn" onclick="wCardDetailSetDefault()">设为首页展示卡</div>`;
}

/* 弹层内「设为首页展示卡」：复用卡包页已有的 wCardsSetDefault 逻辑 */
async function wCardDetailSetDefault() {
  if (!_wCdCurrentId) return;
  await wCardsSetDefault(_wCdCurrentId);
  _wCdCards = await _acLoadCards();
  const card = _wCdCards.find(c => c.id === _wCdCurrentId);
  if (card) _wCdRenderView(card);
}

/* ---------- 编辑信息：卡面工艺 / 卡号 / 持卡人展示名 / 备注名 ---------- */
function wCardDetailEnterEdit() {
  const card = _wCdCards.find(c => c.id === _wCdCurrentId);
  if (!card) return;
  _wCdEditStyle = card.styleKey;

  document.getElementById('wCdInputNumber').value = (card.numberFull || '').replace(/(.{4})/g, '$1 ').trim();
  document.getElementById('wCdInputHolder').value = card.holder || '';
  document.getElementById('wCdInputNickname').value = card.nickname || '';
  document.getElementById('wCdEditErr').style.display = 'none';
  _wCdNumberHintUpdate((card.numberFull || '').length);

  _wCdRenderStyleRow();
  wCardDetailRenderEditPreview();

  document.getElementById('wCdView').style.display = 'none';
  document.getElementById('wCdEdit').style.display = 'block';
}

function _wCdRenderStyleRow() {
  const box = document.getElementById('wCdStyleRow');
  box.innerHTML = Object.values(AC_STYLES).map(s => `
    <div class="w-cd-style-chip ${s.key === _wCdEditStyle ? 'active' : ''}" onclick="wCardDetailPickStyle('${s.key}')">
      <div class="w-cd-style-chip-label">${s.label}</div>
      <div class="w-cd-style-chip-tag">${s.tag}</div>
    </div>`).join('');
}

function wCardDetailPickStyle(styleKey) {
  _wCdEditStyle = styleKey;
  _wCdRenderStyleRow();
  wCardDetailRenderEditPreview();
}

function wCardDetailOnNumberInput(el) {
  let digits = el.value.replace(/\D/g, '').slice(0, 16);
  el.value = digits.replace(/(.{4})/g, '$1 ').trim();
  _wCdNumberHintUpdate(digits.length);
  wCardDetailRenderEditPreview();
}

function _wCdNumberHintUpdate(len) {
  const hint = document.getElementById('wCdNumberHint');
  if (!hint) return;
  if (len === 16) {
    hint.textContent = '✓ 卡号格式正确';
    hint.style.color = '#7fe3b4';
  } else {
    hint.textContent = `请输入完整 16 位卡号（还差 ${16 - len} 位）`;
    hint.style.color = 'rgba(255,255,255,0.35)';
  }
}

/* 编辑态下的实时预览：临时组装一张「草稿卡」，不影响已保存数据 */
function wCardDetailRenderEditPreview() {
  const card = _wCdCards.find(c => c.id === _wCdCurrentId);
  if (!card) return;
  const digits = document.getElementById('wCdInputNumber').value.replace(/\D/g, '');
  const holder = document.getElementById('wCdInputHolder').value.trim() || 'LUNA WALLET USER';
  const draft = Object.assign({}, card, {
    styleKey: _wCdEditStyle,
    numberFull: (digits + '················'.slice(0, 16)).slice(0, 16),
    holder,
  });
  const el = document.getElementById('wCdEditPreview');
  if (el) el.innerHTML = _acFrontFaceHTML(draft);
}

function wCardDetailCancelEdit() {
  document.getElementById('wCdEdit').style.display = 'none';
  document.getElementById('wCdView').style.display = 'flex';
}

/* 保存编辑：写回 IndexedDB，并同步刷新卡包页 / 首页默认卡 / 弹层展示态 */
async function wCardDetailSaveEdit() {
  const errBox = document.getElementById('wCdEditErr');
  errBox.style.display = 'none';

  const digits = document.getElementById('wCdInputNumber').value.replace(/\D/g, '');
  if (digits.length !== 16) {
    errBox.textContent = '请输入完整的 16 位卡号';
    errBox.style.display = 'block';
    return;
  }

  const cards = await _acLoadCards();
  const idx = cards.findIndex(c => c.id === _wCdCurrentId);
  if (idx === -1) return;

  const tier = AC_TIERS[cards[idx].tier];
  const holder = document.getElementById('wCdInputHolder').value.trim() || 'LUNA WALLET USER';
  const nickname = document.getElementById('wCdInputNickname').value.trim() || (tier.name + ' ' + digits.slice(-4));

  cards[idx] = Object.assign({}, cards[idx], {
    styleKey: _wCdEditStyle,
    numberFull: digits,
    numberLast4: digits.slice(-4),
    holder,
    nickname,
  });

  await _acSaveCards(cards);
  _wCdCards = cards;

  await renderCardsPage();
  await renderHomeDefaultCard();

  _wCdRenderView(cards[idx]);
  document.getElementById('wCdEdit').style.display = 'none';
  document.getElementById('wCdView').style.display = 'flex';
}

/* ---------- 注销卡片 ---------- */
function wCardDetailAskCancelCard() {
  document.getElementById('wCdView').style.display = 'none';
  document.getElementById('wCdCancelConfirm').style.display = 'block';
}

function wCardDetailBackFromCancelConfirm() {
  document.getElementById('wCdCancelConfirm').style.display = 'none';
  document.getElementById('wCdView').style.display = 'flex';
}

/* 确认注销：从卡包移除；若注销的是首页展示卡，自动把剩余第一张卡设为新的展示卡 */
async function wCardDetailConfirmCancelCard() {
  const cards = await _acLoadCards();
  const idx = cards.findIndex(c => c.id === _wCdCurrentId);
  if (idx === -1) { wCardDetailClose(); return; }

  const wasDefault = cards[idx].isDefault;
  cards.splice(idx, 1);
  if (wasDefault && cards.length > 0) cards[0].isDefault = true;

  await _acSaveCards(cards);
  await _acSyncStatsCardCount(cards.length);

  await renderCardsPage();
  await renderHomeDefaultCard();

  wCardDetailClose();
}

/* 页面初次加载时，若卡包页 / 首页默认卡存在就先渲染一次真实数据（覆盖占位内容） */
document.addEventListener('DOMContentLoaded', () => {
  renderCardsPage();
  renderHomeDefaultCard();
});

/* ============================================================
   12. 充值面板（首页"充值"快捷入口）
   逻辑：
   1) 选卡视图 —— 列出当前身份卡包内的所有真实卡片（无卡则提示先去申请）
   2) 金额视图 —— 展示选中卡片 + 当前余额 + 快捷金额 chip + 自由输入框
   3) 确认后：把充值金额计入当前身份的账户余额（_saveHomeData），
      并在"最近交易"里插入一条入账记录，然后回到首页刷新显示。
   说明：钱包内所有余额、卡片、货币均为虚拟世界观数字，无真实价值，
   因此充值金额不做任何上限校验，只要求是大于 0 的合法数字。
============================================================ */

let _tuCards = [];
let _tuSelectedCardId = null;
const TU_QUICK_AMOUNTS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];

async function wOpenTopupPage() {
  const page = document.getElementById('wTopupPage');
  if (!page) return;
  page.style.display = 'flex';

  // 同步状态栏
  const mainTime = document.getElementById('statusTime');
  const tuTime   = document.getElementById('tuStatusTime');
  if (mainTime && tuTime) tuTime.textContent = mainTime.textContent;
  const mainPct  = document.getElementById('batPct');
  const tuPct    = document.getElementById('tuBatPct');
  if (mainPct && tuPct) tuPct.textContent = mainPct.textContent;
  const mainInner = document.getElementById('batInner');
  const tuInner    = document.getElementById('tuBatInner');
  if (mainInner && tuInner) tuInner.style.width = mainInner.style.width;
  const mainIsland = document.getElementById('statusIsland');
  const tuIsland    = document.getElementById('tuStatusIsland');
  if (mainIsland && tuIsland) tuIsland.innerHTML = mainIsland.innerHTML;

  requestAnimationFrame(() => { page.style.opacity = '1'; });

  _tuSelectedCardId = null;
  _tuShowPickView();
  _tuCards = await _acLoadCards();
  _tuRenderCardList();
}

function wCloseTopupPage() {
  const page = document.getElementById('wTopupPage');
  if (!page) return;
  page.style.opacity = '0';
  setTimeout(() => { page.style.display = 'none'; }, 260);
}

/* 顶部返回：金额视图返回=回到选卡；选卡视图返回=直接关闭 */
function wTopupBack() {
  const amountView = document.getElementById('tuViewAmount');
  if (amountView && amountView.style.display !== 'none') {
    _tuShowPickView();
  } else {
    wCloseTopupPage();
  }
}

function _tuShowPickView() {
  document.getElementById('tuTitle').textContent = '选择充值银行卡';
  document.getElementById('tuViewPick').style.display    = 'flex';
  document.getElementById('tuViewAmount').style.display  = 'none';
  document.getElementById('tuViewSuccess').style.display = 'none';
}

/* ---------- 视图一：选卡列表 ---------- */
function _tuRenderCardList() {
  const box = document.getElementById('tuCardList');
  if (!box) return;

  if (!_tuCards.length) {
    box.innerHTML = `
      <div style="text-align:center;padding:36px 8px;">
        <div style="font-size:14px;color:#6a6e78;font-weight:500;margin-bottom:8px;">当前身份还没有银行卡</div>
        <div style="font-size:12.5px;color:#9aa0ac;line-height:1.7;margin-bottom:18px;">请先申请一张卡，之后就能为它充值了。</div>
        <button onclick="wCloseTopupPage();wOpenApplyCard();" style="width:100%;height:48px;border-radius:14px;background:#252830;color:#eaebed;font-size:14px;font-weight:600;border:none;cursor:pointer;">去申请新卡</button>
      </div>`;
    return;
  }

  box.innerHTML = _tuCards.map(card => {
    const tier = AC_TIERS[card.tier] || AC_TIERS.std;
    const dotBg = AC_TIER_DOT_BG[card.tier] || AC_TIER_DOT_BG.std;
    const last4 = (card.numberFull || '').slice(-4) || '····';
    const nickname = card.nickname ? card.nickname : tier.name;
    const defaultTag = card.isDefault ? `<span class="ac-tier-badge ok" style="margin-left:6px;">默认展示</span>` : '';
    return `
      <div class="ac-tier-card unlocked" onclick="wTopupSelectCard('${card.id}')">
        <div class="ac-tier-dot" style="background:${dotBg};color:#fff;">${tier.name[0]}</div>
        <div class="ac-tier-mid">
          <div class="ac-tier-name">${nickname}${defaultTag}</div>
          <div class="ac-tier-sub">${tier.en} · 尾号 ${last4} · ${card.holder || 'LUNA WALLET USER'}</div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#aab0bc" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>
      </div>`;
  }).join('');
}

/* ---------- 选中一张卡 → 进入金额视图 ---------- */
async function wTopupSelectCard(cardId) {
  const card = _tuCards.find(c => c.id === cardId);
  if (!card) return;
  _tuSelectedCardId = cardId;

  document.getElementById('tuTitle').textContent = '充值金额';
  document.getElementById('tuViewPick').style.display   = 'none';
  document.getElementById('tuViewAmount').style.display = 'flex';
  document.getElementById('tuViewSuccess').style.display = 'none';

  // 渲染选中卡片真实预览（复用申请新卡/卡包同款正面渲染函数）
  const previewEl = document.getElementById('tuPreviewCard');
  if (previewEl) previewEl.innerHTML = _acFrontFaceHTML(card);

  // 读取并展示当前余额
  const home = await _loadHomeData();
  const balEl = document.getElementById('tuCurBalance');
  if (balEl) balEl.textContent = Number(home.balance || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // 重置输入
  const input = document.getElementById('tuInputAmount');
  if (input) input.value = '';
  document.getElementById('tuErrorMsg').style.display = 'none';
  _tuRenderQuickRow(null);
}

/* ---------- 快捷金额 chip ---------- */
function _tuRenderQuickRow(activeAmount) {
  const box = document.getElementById('tuQuickRow');
  if (!box) return;
  box.innerHTML = TU_QUICK_AMOUNTS.map(v => `
    <div class="ac-style-chip ${activeAmount === v ? 'active' : ''}" onclick="wTopupPickQuick(${v})">
      <div class="ac-style-chip-label">${v.toLocaleString('zh-CN')}</div>
    </div>`).join('');
}

function wTopupPickQuick(amount) {
  const input = document.getElementById('tuInputAmount');
  if (input) input.value = amount;
  _tuRenderQuickRow(amount);
  document.getElementById('tuErrorMsg').style.display = 'none';
}

/* 输入框：只允许数字与最多两位小数；手动输入时取消快捷 chip 的高亮 */
function wTopupOnAmountInput(el) {
  let v = el.value.replace(/[^\d.]/g, '');
  const parts = v.split('.');
  if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
  const dotIdx = v.indexOf('.');
  if (dotIdx !== -1 && v.length - dotIdx - 1 > 2) v = v.slice(0, dotIdx + 3);
  el.value = v;

  const num = parseFloat(v);
  _tuRenderQuickRow(TU_QUICK_AMOUNTS.includes(num) ? num : null);
  document.getElementById('tuErrorMsg').style.display = 'none';
}

/* ---------- 确认充值：写入余额 + 交易记录，展示成功态 ---------- */
async function wTopupConfirm() {
  const input = document.getElementById('tuInputAmount');
  const errEl = document.getElementById('tuErrorMsg');
  const amount = parseFloat(input.value);

  if (!amount || isNaN(amount) || amount <= 0) {
    errEl.textContent = '请输入大于 0 的有效金额';
    errEl.style.display = 'block';
    return;
  }

  const card = _tuCards.find(c => c.id === _tuSelectedCardId);
  if (!card) { errEl.textContent = '未找到选中的卡片，请返回重新选择'; errEl.style.display = 'block'; return; }

  const btn = document.getElementById('tuConfirmBtn');
  btn.disabled = true;
  btn.style.opacity = '.6';

  try {
    const home = await _loadHomeData();
    const newBalance = Number(home.balance || 0) + amount;

    const now = new Date();
    const dateStr = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} · ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const last4 = (card.numberFull || '').slice(-4) || '····';
    const tierName = (AC_TIERS[card.tier] || AC_TIERS.std).name;

    const txList = Array.isArray(home.transactions) ? home.transactions.slice() : [];
    txList.unshift({
      dir: 'in',
      name: `充值至 ${card.nickname || tierName}（尾号${last4}）`,
      date: dateStr,
      ts: now.getTime(),
      amount: amount
    });

    await _saveHomeData({ ...home, balance: newBalance, transactions: txList });

    // 展示成功态
    document.getElementById('tuViewAmount').style.display  = 'none';
    document.getElementById('tuViewSuccess').style.display = 'flex';
    document.getElementById('tuSuccessAmount').textContent = '+' + amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('tuSuccessDesc').textContent = `已计入「${card.nickname || tierName}（尾号${last4}）」所属账户余额`;

    // 同步刷新首页数据（余额、交易列表等）
    await renderHomeData();
  } catch (e) {
    errEl.textContent = '充值失败，请重试';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

/* ============================================================
   13. 账单页 —— 按「年 → 月 → 日」真实分组展示收支记录
   数据来源：home.transactions（首页/充值等场景写入的真实记录）
   排序规则：新的在前；筛选：全部 / 收入 / 支出
   点击任意一笔 → 打开票根回执弹层（wReceiptOpen）
============================================================ */

const WK_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
let _blAllTx = [];       // 归一化后的全部交易（含解析出的年/月/日）
let _blYears = [];       // 有记录的年份列表（新→旧）
let _blActiveYear = null;
let _blActiveFilter = 'all';

/* 把交易记录标准化：优先用 ts（真实时间戳），没有的话尝试从 date 字符串解析，
   实在解析不出来就归入"未知日期"分组，不丢弃任何一条真实记录。 */
function _blNormalizeTx(list) {
  const now = new Date();
  return (list || []).map((tx, idx) => {
    let d = null;
    if (tx.ts) {
      d = new Date(tx.ts);
    } else if (tx.date) {
      // 形如 "05/04 · 14:32" —— 没有年份信息，默认归入今年
      const m = String(tx.date).match(/(\d{1,2})\/(\d{1,2})(?:\D+(\d{1,2}):(\d{1,2}))?/);
      if (m) {
        d = new Date(now.getFullYear(), parseInt(m[1], 10) - 1, parseInt(m[2], 10), parseInt(m[3] || '0', 10), parseInt(m[4] || '0', 10));
      }
    }
    if (!d || isNaN(d.getTime())) d = now; // 兜底：解析失败时按当前时间归档，仍然保留记录本身
    return {
      ...tx,
      _idx: idx,
      _year: d.getFullYear(),
      _month: d.getMonth() + 1,
      _day: d.getDate(),
      _wk: d.getDay(),
      _hh: String(d.getHours()).padStart(2, '0'),
      _mm: String(d.getMinutes()).padStart(2, '0'),
      _sortKey: tx.ts || d.getTime()
    };
  }).sort((a, b) => b._sortKey - a._sortKey);
}

async function renderBillsPage() {
  const home = await _loadHomeData();
  _blAllTx = _blNormalizeTx(home.transactions);

  _blYears = [...new Set(_blAllTx.map(t => t._year))].sort((a, b) => b - a);
  if (!_blYears.length) _blYears = [new Date().getFullYear()];
  if (!_blActiveYear || !_blYears.includes(_blActiveYear)) _blActiveYear = _blYears[0];

  _blRenderYearPicker();
  _blRenderSummary(home);
  _blRenderFilterRow();
  _blRenderGroups();
}

function _blRenderYearPicker() {
  const box = document.getElementById('wBlYearPicker');
  if (!box) return;
  box.innerHTML = _blYears.map(y => `
    <div class="w-bl-year-chip ${y === _blActiveYear ? 'active' : ''}" onclick="wBlPickYear(${y})">${y}</div>
  `).join('');
}

function wBlPickYear(year) {
  _blActiveYear = year;
  _blRenderYearPicker();
  _blRenderGroups();
}

/* 汇总卡：统计"当前选中年份"的收入/支出/结余比，环形进度条动态填充 */
function _blRenderSummary() {
  const yearTx = _blAllTx.filter(t => t._year === _blActiveYear);
  const income = yearTx.filter(t => t.dir === 'in').reduce((s, t) => s + Number(t.amount || 0), 0);
  const spend  = yearTx.filter(t => t.dir === 'out').reduce((s, t) => s + Number(t.amount || 0), 0);
  const net = income - spend;
  const total = income + spend;
  const pct = total > 0 ? Math.round((net / total) * 100) : 0;
  const pctClamped = Math.max(0, Math.min(100, pct));

  document.getElementById('wBlIncomeVal').textContent = '+' + income.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById('wBlSpendVal').textContent  = '-' + spend.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const netEl = document.getElementById('wBlNetVal');
  netEl.textContent = (net >= 0 ? '+' : '') + net.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  netEl.className = 'w-bl-fig-value ' + (net >= 0 ? 'in' : 'out');

  document.getElementById('wBlRingPct').textContent = pct + '%';
  const ring = document.getElementById('wBlRingFill');
  const circumference = 264; // 2 * PI * r(42)
  const offset = circumference - (circumference * pctClamped / 100);
  ring.style.strokeDashoffset = offset;
  ring.style.stroke = net >= 0 ? '#7fd9a8' : '#e8a5a5';
}

function _blRenderFilterRow() {
  const row = document.getElementById('wBlFilterRow');
  if (!row) return;
  row.querySelectorAll('.w-filter-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.f === _blActiveFilter);
    chip.onclick = () => {
      _blActiveFilter = chip.dataset.f;
      _blRenderFilterRow();
      _blRenderGroups();
    };
  });
}

/* 主列表：当前年份 → 按月分组 → 每月再按日分组 */
function _blRenderGroups() {
  const box = document.getElementById('wBlGroups');
  const emptyEl = document.getElementById('wBlEmpty');
  if (!box) return;

  let list = _blAllTx.filter(t => t._year === _blActiveYear);
  if (_blActiveFilter !== 'all') list = list.filter(t => t.dir === _blActiveFilter);

  if (!list.length) {
    box.innerHTML = '';
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';

  // 分组：月 -> 日 -> 交易数组
  const monthMap = new Map();
  list.forEach(t => {
    if (!monthMap.has(t._month)) monthMap.set(t._month, new Map());
    const dayMap = monthMap.get(t._month);
    if (!dayMap.has(t._day)) dayMap.set(t._day, []);
    dayMap.get(t._day).push(t);
  });

  const months = [...monthMap.keys()].sort((a, b) => b - a);

  box.innerHTML = months.map(month => {
    const dayMap = monthMap.get(month);
    const days = [...dayMap.keys()].sort((a, b) => b - a);

    const monthTx = days.flatMap(d => dayMap.get(d));
    const monthIncome = monthTx.filter(t => t.dir === 'in').reduce((s, t) => s + Number(t.amount || 0), 0);
    const monthSpend  = monthTx.filter(t => t.dir === 'out').reduce((s, t) => s + Number(t.amount || 0), 0);
    const monthNet = monthIncome - monthSpend;

    const daysHTML = days.map(day => {
      const txs = dayMap.get(day);
      const wk = WK_NAMES[txs[0]._wk];
      const itemsHTML = txs.map(t => _blTxItemHTML(t)).join('');
      return `
        <div class="w-bl-day-group">
          <div class="w-bl-day-head">
            <div class="w-bl-day-num">${day}</div>
            <div class="w-bl-day-wk">${wk}</div>
            <div class="w-bl-day-line"></div>
          </div>
          <div class="w-bl-day-list">${itemsHTML}</div>
        </div>`;
    }).join('');

    return `
      <div class="w-bl-month-group">
        <div class="w-bl-month-head">
          <div class="w-bl-month-title"><span class="w-bl-month-title-mark"></span>${_blActiveYear} 年 ${month} 月</div>
          <div class="w-bl-month-net ${monthNet >= 0 ? 'pos' : 'neg'}">${monthNet >= 0 ? '+' : ''}${monthNet.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        ${daysHTML}
      </div>`;
  }).join('');
}

function _blTxItemHTML(t) {
  const isOut = t.dir === 'out';
  const iconSvg = isOut
    ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M19 12l-7-7-7 7"/></svg>`
    : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7 7 7-7"/></svg>`;
  const sign = isOut ? '-' : '+';
  return `
    <div class="w-bl-tx-item" onclick="wReceiptOpen(${t._idx})">
      <div class="w-bl-tx-icon ${isOut ? 'out' : 'in'}">${iconSvg}</div>
      <div class="w-bl-tx-mid">
        <div class="w-bl-tx-name">${t.name}</div>
        <div class="w-bl-tx-time">${t._hh}:${t._mm}</div>
      </div>
      <div class="w-bl-tx-amt ${isOut ? 'out' : 'in'}">${sign}${Number(t.amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      <svg class="w-bl-tx-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>
    </div>`;
}

/* ============================================================
   14. 票根回执弹层 —— 生成票根式回执，用户先预览再自行选择是否保存
   保存方式：把票根 DOM 用 SVG foreignObject 序列化后画到 canvas，
   再导出为 PNG 并触发浏览器下载 —— 全程本地生成，不经过任何服务器，
   且只有用户主动点击"保存票根图片"才会触发下载，不会自动保存。
============================================================ */
let _rcptCurrentTx = null;

async function wReceiptOpen(txIdx) {
  const tx = _blAllTx.find(t => t._idx === txIdx);
  if (!tx) return;
  _rcptCurrentTx = tx;

  const overlay = document.getElementById('wReceiptOverlay');
  const sheet   = document.getElementById('wReceiptSheet');
  if (!overlay) return;

  const isOut = tx.dir === 'out';

  // 徽标 + 金额
  const badgeEl = document.getElementById('wRcptDirBadge');
  badgeEl.textContent = isOut ? '支出' : '收入';
  badgeEl.className = 'w-rcpt-badge' + (isOut ? '' : ' in');

  document.getElementById('wRcptAmountLbl').textContent = isOut ? '支出金额' : '收入金额';
  const amtEl = document.getElementById('wRcptAmount');
  amtEl.textContent = (isOut ? '-' : '+') + Number(tx.amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  amtEl.style.color = isOut ? '#a85c4a' : '#3d8a5e';

  // 明细行：摘要 / 日期时间 / 分类 / 当前身份持卡人 / 流水号
  let holder = 'LUNA WALLET USER';
  try {
    const cards = await _acLoadCards();
    const defaultCard = cards.find(c => c.isDefault) || cards[0];
    if (defaultCard && defaultCard.holder) holder = defaultCard.holder;
  } catch (e) { /* 保持默认值 */ }

  const dateDisp = `${tx._year} 年 ${String(tx._month).padStart(2, '0')} 月 ${String(tx._day).padStart(2, '0')} 日  ${tx._hh}:${tx._mm}`;
  const serial = 'NO. ' + String(tx.ts || (tx._year * 10000 + tx._month * 100 + tx._day)).slice(-10).padStart(10, '0');

  document.getElementById('wRcptRows').innerHTML = `
    <div class="w-rcpt-row"><span class="w-rcpt-row-key">摘要</span><span class="w-rcpt-row-val">${tx.name}</span></div>
    <div class="w-rcpt-row"><span class="w-rcpt-row-key">交易时间</span><span class="w-rcpt-row-val">${dateDisp}</span></div>
    <div class="w-rcpt-row"><span class="w-rcpt-row-key">交易类型</span><span class="w-rcpt-row-val">${isOut ? '支出 · 转出' : '收入 · 转入'}</span></div>
    <div class="w-rcpt-row"><span class="w-rcpt-row-key">持卡人</span><span class="w-rcpt-row-val">${holder}</span></div>
  `;
  document.getElementById('wRcptSerial').textContent = serial;

  // 每次打开都重新生成一段"随机"条码宽度节奏，观感上像真实条码
  const barcodeEl = document.getElementById('wRcptBarcode');
  barcodeEl.style.backgroundSize = `${60 + (Math.abs(hashCode(serial)) % 40)}px 100%`;

  // 重置保存按钮状态
  const saveBtn = document.getElementById('wRcptSaveBtn');
  saveBtn.classList.remove('saved');
  saveBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg> 保存票根图片`;

  overlay.style.display = 'flex';
  overlay.style.pointerEvents = 'all';
  requestAnimationFrame(() => {
    overlay.style.background = 'rgba(18,17,22,0.62)';
    sheet.style.opacity = '1';
    sheet.style.transform = 'scale(1) translateY(0)';
  });
}

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
  return h;
}

function wReceiptBackdropClick(e) {
  if (e.target.id === 'wReceiptOverlay') wReceiptClose();
}

function wReceiptClose() {
  const overlay = document.getElementById('wReceiptOverlay');
  const sheet   = document.getElementById('wReceiptSheet');
  if (!overlay) return;
  sheet.style.opacity = '0';
  sheet.style.transform = 'scale(.94) translateY(10px)';
  overlay.style.background = 'rgba(18,17,22,0)';
  overlay.style.pointerEvents = 'none';
  setTimeout(() => {
    overlay.style.display = 'none';
    _rcptCurrentTx = null;
  }, 300);
}

/* 把票根 DOM 转成图片：用 SVG <foreignObject> 包裹当前票根节点的 outerHTML，
   再交给 <img> 解码、绘制到 canvas，最后 toDataURL 导出 —— 纯前端、零依赖。
   触发时机：用户已经在预览里看到完整票根内容，主动点击"保存票根图片"后才执行，
   不会在打开回执时就自动下载。 */
async function wReceiptSaveImage() {
  const stub = document.getElementById('wReceiptStub');
  const saveBtn = document.getElementById('wRcptSaveBtn');
  if (!stub) return;

  saveBtn.disabled = true;
  const originalHTML = saveBtn.innerHTML;
  saveBtn.innerHTML = '生成中…';

  try {
    const rect = stub.getBoundingClientRect();
    const width = Math.ceil(rect.width);
    const height = Math.ceil(rect.height);

    // 克隆节点并内联当前计算样式的关键属性，保证 foreignObject 内渲染观感与页面一致
    const clone = stub.cloneNode(true);
    clone.style.margin = '0';
    clone.style.boxShadow = 'none';

    const svgNS = 'http://www.w3.org/2000/svg';
    const svgMarkup = `
      <svg xmlns="${svgNS}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;font-family:'Inter','Space Mono',monospace,sans-serif;">
            ${clone.outerHTML}
          </div>
        </foreignObject>
      </svg>`;

    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });

    const scale = 2; // 提升导出清晰度
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#f7f2e6';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);

    const pngUrl = canvas.toDataURL('image/png');

    // 触发浏览器下载 —— 由用户点击后主动发起，而非页面自动保存
    const a = document.createElement('a');
    const tx = _rcptCurrentTx;
    const fname = tx ? `Luna票根_${tx._year}${String(tx._month).padStart(2,'0')}${String(tx._day).padStart(2,'0')}_${tx._hh}${tx._mm}.png` : 'Luna票根.png';
    a.href = pngUrl;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    saveBtn.classList.add('saved');
    saveBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> 已保存到本地`;
  } catch (e) {
    saveBtn.innerHTML = '保存失败，请重试';
  } finally {
    saveBtn.disabled = false;
    setTimeout(() => {
      if (saveBtn.innerHTML.includes('失败')) saveBtn.innerHTML = originalHTML;
    }, 1600);
  }
}

/* ============================================================
   专属号码 · 套餐系统
   —— 号码 / 套餐数据存储于 IndexedDB(LunaWalletPhoneDB)，
      按身份隔离（与首页 _currentHomeIdentityKey 同一套 key 规则）。
   —— 号码买断费、套餐月租、任意金额充值话费，均从
      Luna 钱包主余额（home.balance）扣款，与银行卡余额同源，
      因此走同一套“先验证支付密码、再扣款”的安全逻辑。
============================================================ */

/* ---------- 数据库 ---------- */
function _openPhoneDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('LunaWalletPhoneDB', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('phone', { keyPath: 'id' });
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

function _emptyPhoneData() {
  return {
    number: null,   // { seg, per, rarityLabel, price, purchasedAt }
    plan: null,     // { key, name, price, sms, call, activatedAt, expireAt }
    usage: { cycleStart: 0, smsUsed: 0, callUsed: 0 },
    history: []      // { type:'number'|'plan'|'topup', name, amount, date, ts }
  };
}

async function _loadPhoneData() {
  const db  = await _openPhoneDB();
  const key = await _currentHomeIdentityKey();
  const existing = await new Promise(res => {
    const r = db.transaction('phone').objectStore('phone').get(key);
    r.onsuccess = () => res(r.result || null);
    r.onerror   = () => res(null);
  });
  if (existing) return existing;
  const initial = { id: key, ...(_emptyPhoneData()) };
  await new Promise((res, rej) => {
    const tx = db.transaction('phone', 'readwrite');
    tx.objectStore('phone').put(initial);
    tx.oncomplete = () => res(true);
    tx.onerror    = () => rej(false);
  });
  return initial;
}

async function _savePhoneData(data) {
  const db  = await _openPhoneDB();
  const key = await _currentHomeIdentityKey();
  return new Promise((res, rej) => {
    const tx = db.transaction('phone', 'readwrite');
    tx.objectStore('phone').put({ id: key, ...data });
    tx.oncomplete = () => res(true);
    tx.onerror    = () => rej(false);
  });
}

/* ---------- 套餐档位定义（与说明书四档一致） ---------- */
const PHONE_PLANS = {
  star:     { key: 'star',     name: '星光套餐', price: 30,  sms: 50,    call: 30,    tag: '入门' },
  moon:     { key: 'moon',     name: '月华套餐', price: 80,  sms: 200,   call: 120,   tag: '推荐' },
  core:     { key: 'core',     name: '星核套餐', price: 150, sms: 500,   call: 300,   tag: '畅享' },
  infinite: { key: 'infinite', name: '无界套餐', price: 300, sms: Infinity, call: Infinity, tag: '无限' },
};
const PHONE_PLAN_ORDER = ['star', 'moon', 'core', 'infinite'];

/* 超出套餐 / 无套餐 计费费率 */
const PHONE_RATE = {
  smsIn:   0.5,  // 有套餐超出：每条
  callIn:  1,    // 有套餐超出：每分钟
  smsOut:  1,    // 无套餐：每条
  callOut: 2,    // 无套餐：每分钟
};

/* ---------- 号码稀有度判定（与专属号码说明书一致） ---------- */
function _phoneCalcPrice(seg, per) {
  if (!seg || !per || seg.length < 4 || per.length < 4) return null;
  const allSame = s => /^(\d)\1{3}$/.test(s);
  const seqList = ['0123','1234','2345','3456','4567','5678','6789','9876','8765','7654','6543','5432','4321','3210'];
  const allSeq = s => seqList.includes(s);
  const hasSeq = s => { for (let i = 0; i < s.length - 1; i++) if (parseInt(s[i+1], 10) - parseInt(s[i], 10) === 1) return true; return false; };

  if (allSame(per) && allSame(seg)) return { price: 2000, label: '极稀有 · 全豹子号' };
  if (allSeq(seg) && allSeq(per))    return { price: 2000, label: '极稀有 · 全顺号' };
  if (allSame(per))  return { price: 1000, label: '稀有 · 豹子号' };
  if (allSeq(per))   return { price: 300,  label: '进阶 · 顺子号' };
  if (hasSeq(per))   return { price: 300,  label: '进阶 · 含连续数字' };
  return { price: 100, label: '标准 · 普通自选号' };
}

function _phoneRandomSegOrPer() {
  return String(Math.floor(Math.random() * 9000) + 1000);
}

/* ---------- 支付密码校验（复用支付设置页同一套 PIN） ----------
   若用户已启用支付密码：弹出输入键盘，验证通过后才 resolve(true)；
   若未启用：直接 resolve(true)，视为免密支付。
   取消输入则 resolve(false)。 */
let _payVerifyResolve = null;
let _payVerifyInput = '';

async function _requirePayPassword() {
  // 与支付设置页保持一致的身份隔离 key
  const account = await _loadWalletAccount();
  const boundId = account?.boundIdentityId || 'default';
  _secIdentityKey = 'identity_' + boundId;
  const saved = await _loadSecurity();

  if (!saved.enabled || !saved.pin) return true; // 未设置支付密码，直接放行

  return new Promise(resolve => {
    _payVerifyResolve = resolve;
    _payVerifyInput = '';
    _pvUpdateCells();
    const hint = document.getElementById('pvHint');
    if (hint) { hint.textContent = '请输入支付密码完成扣款'; hint.style.color = '#9aa0ac'; }
    const overlay = document.getElementById('wPayVerifyOverlay');
    const sheet   = document.getElementById('wPayVerifySheet');
    if (!overlay || !sheet) { resolve(true); return; } // 容错：弹层不存在时不阻塞支付
    overlay.style.pointerEvents = 'all';
    overlay.style.background = 'rgba(20,20,24,0.32)';
    requestAnimationFrame(() => {
      sheet.style.opacity = '1';
      sheet.style.transform = 'scale(1)';
    });
  });
}

function _pvUpdateCells() {
  for (let i = 0; i < 4; i++) {
    const cell = document.getElementById('pvc' + i);
    if (!cell) continue;
    cell.className = 'w-pin-cell';
    if (i < _payVerifyInput.length) cell.classList.add('filled');
    else if (i === _payVerifyInput.length) cell.classList.add('active');
  }
}

function pvKey(n) {
  if (_payVerifyInput.length >= 4) return;
  _payVerifyInput += n;
  _pvUpdateCells();
  if (_payVerifyInput.length === 4) _pvSubmit();
}
function pvDel() {
  _payVerifyInput = _payVerifyInput.slice(0, -1);
  _pvUpdateCells();
}

async function _pvSubmit() {
  const saved = await _loadSecurity();
  const hint = document.getElementById('pvHint');
  if (_payVerifyInput === saved.pin) {
    _pvClose(true);
  } else {
    if (hint) { hint.textContent = '密码错误，请重新输入'; hint.style.color = '#c04040'; }
    _payVerifyInput = '';
    _pvUpdateCells();
  }
}

function pvCancel() { _pvClose(false); }

function _pvClose(result) {
  const overlay = document.getElementById('wPayVerifyOverlay');
  const sheet   = document.getElementById('wPayVerifySheet');
  if (sheet)   { sheet.style.opacity = '0'; sheet.style.transform = 'scale(.94)'; }
  if (overlay) { overlay.style.background = 'rgba(20,20,24,0)'; overlay.style.pointerEvents = 'none'; }
  const resolve = _payVerifyResolve;
  _payVerifyResolve = null;
  _payVerifyInput = '';
  setTimeout(() => { if (resolve) resolve(result); }, 200);
}

/* ---------- 通用扣款：从主余额扣除，写入交易记录，余额不足则失败 ---------- */
async function _phoneCharge(amount, txName) {
  const home = await _loadHomeData();
  const balance = Number(home.balance || 0);
  if (balance < amount) {
    return { ok: false, reason: '余额不足，请先为账户充值' };
  }
  const passed = await _requirePayPassword();
  if (!passed) return { ok: false, reason: '已取消支付' };

  const now = new Date();
  const dateStr = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} · ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const txList = Array.isArray(home.transactions) ? home.transactions.slice() : [];
  txList.unshift({ dir: 'out', name: txName, date: dateStr, ts: now.getTime(), amount: amount });
  await _saveHomeData({ ...home, balance: balance - amount, transactions: txList });
  await renderHomeData();
  return { ok: true };
}

/* ============================================================
   通讯页（pageConnect）—— 顶部号码状态卡渲染
============================================================ */
/* 本月用量：这个 app 里目前没有任何"发短信 / 打电话"的真实动作，
   所以用量必须如实反映 phone.usage 里存的真实数字（新开号码时为 0），
   不允许再用时间戳伪造出一个看起来正在使用的假数字。
   以后如果加上真实的发短信/通话动作，才应该去递增
   phone.usage.smsUsed / callUsed 并写回数据库。 */
function _ppSimUsage(phone) {
  if (!phone.number) return { sms: 0, call: 0 };
  const usage = phone.usage || { smsUsed: 0, callUsed: 0 };
  return {
    sms: usage.smsUsed || 0,
    call: usage.callUsed || 0
  };
}

async function renderConnectPage() {
  const phone = await _loadPhoneData();

  const numEl   = document.getElementById('wCcNumber');
  const planEl  = document.getElementById('wCcPlanLine');
  const badgeEl = document.getElementById('wCcBadge');
  if (!numEl) return;

  const hasPlan = !!phone.plan;
  const expired = hasPlan ? Date.now() > phone.plan.expireAt : false;
  const planActive = hasPlan && !expired;

  // 套餐到期（欠费）提醒：只在“刚好过期”这一刻发一次，避免每次刷新页面都重复弹
  if (hasPlan && expired && !phone.plan.expiredNotified) {
    phone.plan.expiredNotified = true;
    await _savePhoneData(phone);
    _ppNotifyPlanExpired(phone);
  }

  if (!phone.number) {
    numEl.textContent = '尚未开通专属号码';
    if (planEl) planEl.textContent = '开通后即可选购套餐、支付话费';
    if (badgeEl) badgeEl.textContent = '未开通';
  } else {
    numEl.textContent = `LN · ${phone.number.seg} · ${phone.number.per}`;
    if (hasPlan) {
      const expireDate = new Date(phone.plan.expireAt);
      const expireStr = `${expireDate.getFullYear()}.${String(expireDate.getMonth()+1).padStart(2,'0')}.${String(expireDate.getDate()).padStart(2,'0')}`;
      if (planEl) planEl.textContent = expired
        ? `${phone.plan.name} 已到期 · 按无套餐费率计费`
        : `${phone.plan.name} · 有效至 ${expireStr}`;
      if (badgeEl) badgeEl.textContent = expired ? '已过期' : '生效中';
    } else {
      if (planEl) planEl.textContent = '未订阅套餐 · 按无套餐费率计费';
      if (badgeEl) badgeEl.textContent = '无套餐';
    }
  }

  /* ---------- 本月用量 ---------- */
  const sim = _ppSimUsage(phone);
  const smsCap  = planActive ? phone.plan.sms  : Infinity;
  const callCap = planActive ? phone.plan.call : Infinity;
  const smsValEl  = document.getElementById('wUsageSmsVal');
  const callValEl = document.getElementById('wUsageCallVal');
  const smsFillEl = document.getElementById('wUsageSmsFill');
  const callFillEl = document.getElementById('wUsageCallFill');
  const noteEl = document.getElementById('wUsageNote');

  if (!phone.number) {
    if (smsValEl)  smsValEl.textContent  = '— / — 条';
    if (callValEl) callValEl.textContent = '— / — 分钟';
    if (smsFillEl)  smsFillEl.style.width  = '0%';
    if (callFillEl) callFillEl.style.width = '0%';
    if (noteEl) noteEl.textContent = '开通号码后开始计算本月用量';
  } else {
    const smsPct  = smsCap === Infinity ? Math.min(100, sim.sms / 3) : Math.min(100, Math.round(sim.sms / smsCap * 100));
    const callPct = callCap === Infinity ? Math.min(100, sim.call / 3) : Math.min(100, Math.round(sim.call / callCap * 100));
    if (smsValEl)  smsValEl.textContent  = smsCap === Infinity  ? `${sim.sms} 条 · 不限量`   : `${sim.sms} / ${smsCap} 条`;
    if (callValEl) callValEl.textContent = callCap === Infinity ? `${sim.call} 分钟 · 不限时` : `${sim.call} / ${callCap} 分钟`;
    if (smsFillEl)  { smsFillEl.style.width  = smsPct + '%';  smsFillEl.classList.toggle('warn', smsCap !== Infinity && sim.sms >= smsCap); }
    if (callFillEl) { callFillEl.style.width = callPct + '%'; callFillEl.classList.toggle('warn', callCap !== Infinity && sim.call >= callCap); }
    if (noteEl) noteEl.textContent = planActive ? '验证码始终免费，不计入用量' : '当前无生效套餐，短信/通话按无套餐费率计费';
  }

  /* ---------- 本月话费小结 ---------- */
  const planFee = planActive ? phone.plan.price : 0;
  let overFee = 0;
  if (phone.number) {
    const smsOver  = smsCap === Infinity ? 0 : Math.max(0, sim.sms - smsCap);
    const callOver = callCap === Infinity ? 0 : Math.max(0, sim.call - callCap);
    const smsRate  = planActive ? PHONE_RATE.smsIn  : PHONE_RATE.smsOut;
    const callRate = planActive ? PHONE_RATE.callIn : PHONE_RATE.callOut;
    if (planActive) {
      overFee = smsOver * smsRate + callOver * callRate;
    } else {
      overFee = sim.sms * smsRate + sim.call * callRate;
    }
  }
  const planFeeEl  = document.getElementById('wBillSumPlan');
  const overFeeEl  = document.getElementById('wBillSumOver');
  const totalFeeEl = document.getElementById('wBillSumTotal');
  if (planFeeEl)  planFeeEl.textContent  = planFee.toLocaleString('zh-CN') + ' Lune';
  if (overFeeEl)  overFeeEl.textContent  = Math.round(overFee).toLocaleString('zh-CN') + ' Lune';
  if (totalFeeEl) totalFeeEl.textContent = Math.round(planFee + overFee).toLocaleString('zh-CN') + ' Lune';

  /* ---------- 最近消费 ---------- */
  const listEl = document.getElementById('wRecentList');
  if (listEl) {
    const history = Array.isArray(phone.history) ? phone.history.slice(0, 3) : [];
    if (!history.length) {
      listEl.innerHTML = `<div style="padding:22px 4px;text-align:center;font-size:12.5px;color:#9aa0ac;">暂无通讯消费记录</div>`;
    } else {
      const iconMap = {
        number: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>`,
        plan:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
        topup:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 2v20M17 7H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H7"/></svg>`
      };
      listEl.innerHTML = history.map(h => `
        <div class="w-recent-item">
          <div class="w-recent-icon">${iconMap[h.type] || iconMap.topup}</div>
          <div class="w-recent-mid">
            <div class="w-recent-name">${h.name}</div>
            <div class="w-recent-date">${h.date}</div>
          </div>
          <div class="w-recent-amount">-${Number(h.amount).toLocaleString('zh-CN')}</div>
        </div>`).join('');
    }
  }
}

/* 通讯页“快捷充值”入口：已有号码直接进入充值区，否则先引导开通号码 */
async function ppQuickTopupFromConnect() {
  const phone = await _loadPhoneData();
  if (!phone.number) { wAction('plan'); return; }
  await wOpenPhonePage();
  const input = document.getElementById('ppTopupInput');
  if (input) setTimeout(() => input.focus(), 320);
}

/* ============================================================
   副卡与设备管理 · 全屏面板（wSimManagePage）
   —— 主号码区域读取真实 LunaWalletPhoneDB 数据；
      副卡列表 = 读取 LunaCharDB（角色档案页维护的库）里的
      每一个角色，渲染成一张可分配号码的"电话卡"，号码本身
      存在独立的 LunaWalletCharPhoneDB 里（按 charId 关联），
      全部动态生成，没有任何写死数据。
============================================================ */

/* ---------- 只读接入 LunaCharDB（角色档案页的库，这里不建库、不写入） ---------- */
function _openCharDBReadOnly() {
  return new Promise((res) => {
    const probe = indexedDB.open('LunaCharDB');
    probe.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('chars')) { db.close(); res(null); return; }
      res(db);
    };
    probe.onerror = () => res(null);
    // 若 LunaCharDB 从未被创建过，这里会触发首次建库；不主动创建 chars store，
    // 避免污染角色页自己的建库逻辑——正常情况下角色页会先创建好这个库。
    probe.onupgradeneeded = () => {};
  });
}

async function _getAllCharsForWallet() {
  const db = await _openCharDBReadOnly();
  if (!db) return [];
  return new Promise(res => {
    try {
      const req = db.transaction('chars', 'readonly').objectStore('chars').getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror   = () => res([]);
    } catch (e) { res([]); }
  });
}

/* ---------- 角色号码分配库：LunaWalletCharPhoneDB { charId -> {number, updatedAt} } ---------- */
function _openCharPhoneDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('LunaWalletCharPhoneDB', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('assign'))
        db.createObjectStore('assign', { keyPath: 'charId' });
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

async function _getAllCharPhoneAssignments() {
  const db = await _openCharPhoneDB().catch(() => null);
  if (!db) return [];
  return new Promise(res => {
    const req = db.transaction('assign', 'readonly').objectStore('assign').getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror   = () => res([]);
  });
}

async function _getCharPhoneAssignment(charId) {
  const db = await _openCharPhoneDB().catch(() => null);
  if (!db) return null;
  return new Promise(res => {
    const req = db.transaction('assign', 'readonly').objectStore('assign').get(charId);
    req.onsuccess = () => res(req.result || null);
    req.onerror   = () => res(null);
  });
}

async function _setCharPhoneAssignment(charId, number) {
  const db = await _openCharPhoneDB().catch(() => null);
  if (!db) return false;
  return new Promise(res => {
    const tx = db.transaction('assign', 'readwrite');
    tx.objectStore('assign').put({ charId, number, updatedAt: Date.now() });
    tx.oncomplete = () => res(true);
    tx.onerror    = () => res(false);
  });
}

async function _clearCharPhoneAssignment(charId) {
  const db = await _openCharPhoneDB().catch(() => null);
  if (!db) return false;
  return new Promise(res => {
    const tx = db.transaction('assign', 'readwrite');
    tx.objectStore('assign').delete(charId);
    tx.oncomplete = () => res(true);
    tx.onerror    = () => res(false);
  });
}

/* 角色卡配色（与角色档案页 COLOR_MAP 保持一致，找不到时回退到默认色） */
const SM_COLOR_MAP = {
  warm:  { avBg: '#1e1a14', avCol: '#c9b89a' },
  cool:  { avBg: '#101618', avCol: '#8fa3a8' },
  gold:  { avBg: '#181410', avCol: '#b8a47a' },
  ash:   { avBg: '#141414', avCol: '#9d9d9d' },
  mist:  { avBg: '#111512', avCol: '#a8b5a0' },
  blush: { avBg: '#180f0e', avCol: '#c4a5a0' },
};

/* 校验号码格式：允许数字、空格、短横线、加号，长度 5~20，避免完全无限制的乱输入 */
function _validateCharPhoneNumber(raw) {
  const v = String(raw || '').trim();
  if (!v) return { ok: false, msg: '号码不能为空' };
  if (!/^[0-9+\-\s]{5,20}$/.test(v)) return { ok: false, msg: '请输入 5-20 位数字（可含 + - 空格）' };
  return { ok: true, value: v };
}

let _smChars = [];          // 当前角色列表缓存
let _smAssignMap = {};      // charId -> number

async function _smLoadCharsAndAssignments() {
  const [chars, assigns] = await Promise.all([
    _getAllCharsForWallet(),
    _getAllCharPhoneAssignments()
  ]);
  _smChars = chars;
  _smAssignMap = {};
  assigns.forEach(a => { _smAssignMap[a.charId] = a.number; });
}

function _smRenderCharList() {
  const wrap = document.getElementById('smCharCardList');
  const emptyEl = document.getElementById('smCharEmpty');
  if (!wrap) return;

  if (!_smChars.length) {
    wrap.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'flex';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  wrap.innerHTML = _smChars.map(c => {
    const col = SM_COLOR_MAP[c.color] || SM_COLOR_MAP.warm;
    const letter = (c.name || '?')[0].toUpperCase();
    const number = _smAssignMap[c.id];
    const avatarInner = c.avatar
      ? `<img src="${c.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;" />`
      : `<span style="color:${col.avCol};font-size:16px;font-weight:600;">${escHtmlWallet(letter)}</span>`;

    return `
    <div class="sm-char-card" data-char-id="${c.id}">
      <div class="sm-char-top">
        <div class="sm-char-avatar" style="background:${col.avBg}">${avatarInner}</div>
        <div class="sm-char-mid">
          <div class="sm-char-name">${escHtmlWallet(c.name || '未命名角色')}</div>
          <div class="sm-char-role">${escHtmlWallet(c.role || '未设定定位')}</div>
        </div>
        ${number ? `<span class="sm-char-tag has-num">已绑定</span>` : `<span class="sm-char-tag">未绑定</span>`}
      </div>
      <div class="sm-char-num-row">
        <div class="sm-char-num${number ? '' : ' empty'}">${number ? escHtmlWallet(number) : '尚未设置电话号码'}</div>
        <button class="sm-char-btn" onclick="wOpenCharPhoneEditor(${c.id})">${number ? '编辑' : '设置号码'}</button>
      </div>
    </div>`;
  }).join('');
}

function escHtmlWallet(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function wOpenSimManagePage() {
  const page = document.getElementById('wSimManagePage');
  if (!page) return;
  page.style.display = 'flex';

  // 同步状态栏
  const mainTime = document.getElementById('statusTime');
  const smTime   = document.getElementById('smStatusTime');
  if (mainTime && smTime) smTime.textContent = mainTime.textContent;

  const mainPct = document.getElementById('batPct');
  const smPct   = document.getElementById('smBatPct');
  if (mainPct && smPct) smPct.textContent = mainPct.textContent;

  const mainInner = document.getElementById('batInner');
  const smInner   = document.getElementById('smBatInner');
  if (mainInner && smInner) smInner.style.width = mainInner.style.width;

  const mainIsland = document.getElementById('statusIsland');
  const smIsland   = document.getElementById('smStatusIsland');
  if (mainIsland && smIsland) smIsland.innerHTML = mainIsland.innerHTML;

  requestAnimationFrame(() => { page.style.opacity = '1'; });

  // 动态渲染主号码信息（与通讯页同一数据源，绝不写死）
  const phone = await _loadPhoneData();
  const numEl   = document.getElementById('smPrimaryNum');
  const subEl   = document.getElementById('smPrimarySub');
  const badgeEl = document.getElementById('smPrimaryBadge');

  if (!phone.number) {
    if (numEl)   numEl.textContent = '尚未开通专属号码';
    if (subEl)   subEl.textContent = '前往"号码与套餐"开通后将展示于此';
    if (badgeEl) badgeEl.textContent = '未开通';
  } else {
    if (numEl) numEl.textContent = `LN · ${phone.number.seg} · ${phone.number.per}`;
    const hasPlan = !!phone.plan;
    const expired = hasPlan ? Date.now() > phone.plan.expireAt : false;
    if (badgeEl) badgeEl.textContent = (hasPlan && !expired) ? '生效中' : (hasPlan ? '已过期' : '无套餐');
    if (subEl) {
      subEl.textContent = (hasPlan && !expired)
        ? `${phone.plan.name} · 主体账户统一扣费`
        : '暂无生效套餐 · 按无套餐费率计费';
    }
  }

  // 角色电话卡列表：完全来自 LunaCharDB + LunaWalletCharPhoneDB，实时读取
  await _smLoadCharsAndAssignments();
  _smRenderCharList();

  const countEl = document.getElementById('smCharCount');
  if (countEl) countEl.textContent = String(_smChars.length);

  // 设备信息：读取真实浏览器 UA / 平台，避免写死设备名
  const deviceDesc = document.getElementById('smDeviceDesc');
  if (deviceDesc) {
    const ua = navigator.userAgent || '';
    let platform = '未知设备';
    if (/iPhone|iPad|iPod/.test(ua)) platform = 'iOS 设备';
    else if (/Android/.test(ua)) platform = 'Android 设备';
    else if (/Macintosh/.test(ua)) platform = 'Mac 设备';
    else if (/Windows/.test(ua)) platform = 'Windows 设备';
    deviceDesc.textContent = `当前登录设备 · ${platform} · 默认信任`;
  }
}

function wCloseSimManagePage() {
  const page = document.getElementById('wSimManagePage');
  if (!page) return;
  page.style.opacity = '0';
  setTimeout(() => { page.style.display = 'none'; }, 260);
}

/* 跨页同步：角色档案页新增/编辑/删除角色时会写入这个 key，
   若副卡管理面板正打开，立即重新拉取真实数据刷新列表 */
window.addEventListener('storage', (e) => {
  if (e.key === 'luna_characters_updated') {
    const page = document.getElementById('wSimManagePage');
    if (page && page.style.display === 'flex') {
      _smLoadCharsAndAssignments().then(_smRenderCharList);
    }
  }
});

/* ---------- 号码编辑弹层：设置 / 修改 / 清除某个角色的电话号码 ---------- */
let _smEditingCharId = null;

function wOpenCharPhoneEditor(charId) {
  const c = _smChars.find(x => x.id === charId);
  if (!c) return;
  _smEditingCharId = charId;

  const overlay = document.getElementById('smPhoneEditOverlay');
  const sheet   = document.getElementById('smPhoneEditSheet');
  if (!overlay || !sheet) return;

  document.getElementById('smPeName').textContent = c.name || '未命名角色';
  document.getElementById('smPeRole').textContent = c.role || '未设定定位';
  const col = SM_COLOR_MAP[c.color] || SM_COLOR_MAP.warm;
  const avatarEl = document.getElementById('smPeAvatar');
  avatarEl.style.background = col.avBg;
  avatarEl.innerHTML = c.avatar
    ? `<img src="${c.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:14px;" />`
    : `<span style="color:${col.avCol};font-size:19px;font-weight:600;">${escHtmlWallet((c.name||'?')[0].toUpperCase())}</span>`;

  const input = document.getElementById('smPeInput');
  input.value = _smAssignMap[charId] || '';
  const errEl = document.getElementById('smPeError');
  errEl.style.display = 'none';
  errEl.textContent = '';

  const clearBtn = document.getElementById('smPeClearBtn');
  clearBtn.style.display = _smAssignMap[charId] ? 'block' : 'none';

  overlay.style.pointerEvents = 'all';
  overlay.style.background = 'rgba(20,20,24,0.32)';
  requestAnimationFrame(() => {
    sheet.style.opacity = '1';
    sheet.style.transform = 'scale(1)';
    setTimeout(() => input.focus(), 200);
  });
}

function wCloseCharPhoneEditor() {
  const overlay = document.getElementById('smPhoneEditOverlay');
  const sheet   = document.getElementById('smPhoneEditSheet');
  if (sheet)   { sheet.style.opacity = '0'; sheet.style.transform = 'scale(.94)'; }
  if (overlay) { overlay.style.background = 'rgba(20,20,24,0)'; overlay.style.pointerEvents = 'none'; }
  _smEditingCharId = null;
}

async function wSaveCharPhoneNumber() {
  if (_smEditingCharId == null) return;
  const input = document.getElementById('smPeInput');
  const errEl = document.getElementById('smPeError');
  const check = _validateCharPhoneNumber(input.value);

  if (!check.ok) {
    errEl.textContent = check.msg;
    errEl.style.display = 'block';
    return;
  }

  // 唯一性校验：同一号码不能绑定给两个不同角色
  const dupe = Object.entries(_smAssignMap).find(([cid, num]) =>
    num === check.value && Number(cid) !== _smEditingCharId
  );
  if (dupe) {
    errEl.textContent = '该号码已绑定给其他角色，请更换一个';
    errEl.style.display = 'block';
    return;
  }

  await _setCharPhoneAssignment(_smEditingCharId, check.value);
  _smAssignMap[_smEditingCharId] = check.value;
  _smRenderCharList();
  wCloseCharPhoneEditor();
}

async function wClearCharPhoneNumber() {
  if (_smEditingCharId == null) return;
  await _clearCharPhoneAssignment(_smEditingCharId);
  delete _smAssignMap[_smEditingCharId];
  _smRenderCharList();
  wCloseCharPhoneEditor();
}

/* ============================================================
   号码与套餐中心 · 全屏面板（wPhonePage）
   视图：pick(购号) / manage(号码总览+套餐+充值) / history(账单)
============================================================ */
let _ppView = 'auto';     // 打开时自动判定：无号码→pick，有号码→manage
let _ppBuyMode = 'random'; // 'random' | 'custom'
let _ppCustomSeg = '';
let _ppCustomPer = '';
let _ppTopupAmount = null;

async function wOpenPhonePage(forceView) {
  const page = document.getElementById('wPhonePage');
  if (!page) return;
  page.style.display = 'flex';

  // 状态栏同步
  const mainTime = document.getElementById('statusTime');
  const ppTime   = document.getElementById('ppStatusTime');
  if (mainTime && ppTime) ppTime.textContent = mainTime.textContent;
  const mainPct  = document.getElementById('batPct');
  const ppPct    = document.getElementById('ppBatPct');
  if (mainPct && ppPct) ppPct.textContent = mainPct.textContent;
  const mainInner = document.getElementById('batInner');
  const ppInner    = document.getElementById('ppBatInner');
  if (mainInner && ppInner) ppInner.style.width = mainInner.style.width;
  const mainIsland = document.getElementById('statusIsland');
  const ppIsland    = document.getElementById('ppStatusIsland');
  if (mainIsland && ppIsland) ppIsland.innerHTML = mainIsland.innerHTML;

  requestAnimationFrame(() => { page.style.opacity = '1'; });

  const phone = await _loadPhoneData();

  if (forceView === 'history') {
    _ppShowHistory(phone);
  } else if (!phone.number) {
    _ppShowBuy(phone);
  } else {
    _ppShowManage(phone);
  }
}

function wClosePhonePage() {
  const page = document.getElementById('wPhonePage');
  if (!page) return;
  page.style.opacity = '0';
  setTimeout(() => { page.style.display = 'none'; }, 260);
}

function _ppSetTitle(t) {
  const el = document.getElementById('ppTitle');
  if (el) el.textContent = t;
}

function _ppHideAllViews() {
  ['ppViewBuy', 'ppViewManage', 'ppViewHistory'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

/* 顶部返回：任何子视图返回都直接关闭面板（面板内部另有“返回号码总览”按钮处理二级跳转） */
function wPhoneBack() {
  wClosePhonePage();
}

/* ---------- 视图：购号 ---------- */
function _ppShowBuy(phone) {
  _ppHideAllViews();
  _ppSetTitle('开通专属号码');
  const view = document.getElementById('ppViewBuy');
  if (view) view.style.display = 'flex';

  _ppBuyMode = 'random';
  _ppCustomSeg = '';
  _ppCustomPer = '';
  _ppRenderBuyMode();
  _ppRenderRandomPreview();
}

function ppSwitchBuyMode(mode) {
  _ppBuyMode = mode;
  _ppRenderBuyMode();
}

function _ppRenderBuyMode() {
  const tabRandom = document.getElementById('ppTabRandom');
  const tabCustom = document.getElementById('ppTabCustom');
  const paneRandom = document.getElementById('ppPaneRandom');
  const paneCustom = document.getElementById('ppPaneCustom');
  if (tabRandom) tabRandom.classList.toggle('active', _ppBuyMode === 'random');
  if (tabCustom) tabCustom.classList.toggle('active', _ppBuyMode === 'custom');
  if (paneRandom) paneRandom.style.display = _ppBuyMode === 'random' ? 'flex' : 'none';
  if (paneCustom) paneCustom.style.display = _ppBuyMode === 'custom' ? 'flex' : 'none';
}

function _ppRenderRandomPreview() {
  const seg = _phoneRandomSegOrPer();
  const per = _phoneRandomSegOrPer();
  const el = document.getElementById('ppRandomNumber');
  if (!el) return;
  el.textContent = `LN · ${seg} · ${per}`;
  el.dataset.seg = seg;
  el.dataset.per = per;
}

function ppRerollRandom() { _ppRenderRandomPreview(); }

async function ppConfirmRandomBuy() {
  const el = document.getElementById('ppRandomNumber');
  const seg = el?.dataset.seg;
  const per = el?.dataset.per;
  if (!seg || !per) return;

  const errEl = document.getElementById('ppBuyError');
  if (errEl) errEl.style.display = 'none';

  const price = 50;
  const result = await _phoneCharge(price, `开通专属号码 LN·${seg}·${per}`);
  if (!result.ok) {
    if (errEl) { errEl.textContent = result.reason; errEl.style.display = 'block'; }
    return;
  }

  const phone = await _loadPhoneData();
  phone.number = { seg, per, rarityLabel: '随机分配', price, purchasedAt: Date.now() };
  phone.history = Array.isArray(phone.history) ? phone.history : [];
  phone.history.unshift({ type: 'number', name: `开通号码 LN·${seg}·${per}`, amount: price, date: _ppNowStr(), ts: Date.now() });
  await _savePhoneData(phone);

  await renderConnectPage();
  _ppShowManage(phone);
  _ppNotifyNumberIssued(phone);
}

function ppOnCustomInput(which, el) {
  const v = el.value.replace(/\D/g, '').slice(0, 4);
  el.value = v;
  if (which === 'seg') _ppCustomSeg = v; else _ppCustomPer = v;
  _ppRenderCustomResult();
}

function _ppRenderCustomResult() {
  const labelEl = document.getElementById('ppCustomLabel');
  const priceEl = document.getElementById('ppCustomPrice');
  const btnEl   = document.getElementById('ppCustomBuyBtn');
  const previewEl = document.getElementById('ppCustomPreview');
  if (previewEl) previewEl.textContent = `LN · ${_ppCustomSeg || '____'} · ${_ppCustomPer || '____'}`;

  if (_ppCustomSeg.length === 4 && _ppCustomPer.length === 4) {
    const r = _phoneCalcPrice(_ppCustomSeg, _ppCustomPer);
    if (labelEl) { labelEl.textContent = r.label; labelEl.style.color = '#252830'; }
    if (priceEl) priceEl.textContent = r.price + ' Lune';
    if (btnEl) { btnEl.disabled = false; btnEl.style.opacity = '1'; }
  } else {
    if (labelEl) { labelEl.textContent = '请输入完整的 4 位区段码和 4 位个人号'; labelEl.style.color = '#9aa0ac'; }
    if (priceEl) priceEl.textContent = '— Lune';
    if (btnEl) { btnEl.disabled = true; btnEl.style.opacity = '.4'; }
  }
}

async function ppConfirmCustomBuy() {
  if (_ppCustomSeg.length !== 4 || _ppCustomPer.length !== 4) return;
  const r = _phoneCalcPrice(_ppCustomSeg, _ppCustomPer);
  const errEl = document.getElementById('ppBuyError');
  if (errEl) errEl.style.display = 'none';

  const result = await _phoneCharge(r.price, `开通专属号码 LN·${_ppCustomSeg}·${_ppCustomPer}（自选）`);
  if (!result.ok) {
    if (errEl) { errEl.textContent = result.reason; errEl.style.display = 'block'; }
    return;
  }

  const phone = await _loadPhoneData();
  phone.number = { seg: _ppCustomSeg, per: _ppCustomPer, rarityLabel: r.label, price: r.price, purchasedAt: Date.now() };
  phone.history = Array.isArray(phone.history) ? phone.history : [];
  phone.history.unshift({ type: 'number', name: `开通号码 LN·${_ppCustomSeg}·${_ppCustomPer}（自选）`, amount: r.price, date: _ppNowStr(), ts: Date.now() });
  await _savePhoneData(phone);

  await renderConnectPage();
  _ppShowManage(phone);
  _ppNotifyNumberIssued(phone);
}

/* ---------- 通讯 App 联动通知：横幅 + 信息 App「系统」消息同步 ----------
   与钱包办卡成功的联动（_acNotifyCardIssued）保持同一套调用方式：
   1) 若用户在「设置 → 消息横幅」中开启了横幅，立即按所选样式弹出横幅
   2) 无论横幅是否开启，都写入一条系统消息，供「信息」App 的「系统」分组同步展示 */
function _ppNotify(title, message) {
  if (window.LunaBanner) {
    window.LunaBanner.show({ app: 'Wallet', title, message });
  }
  if (window.LunaSystemMessages) {
    window.LunaSystemMessages.push({ app: 'Wallet', title, message });
  }
}

function _ppNotifyNumberIssued(phone) {
  const num = `LN · ${phone.number.seg} · ${phone.number.per}`;
  _ppNotify('号码开通成功', `你的专属号码 ${num} 已开通，可前往「通讯」查看套餐与话费`);
}

function _ppNotifyPlanSubscribed(phone, p) {
  const d = new Date(phone.plan.expireAt);
  const expireStr = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
  _ppNotify('套餐订阅成功', `已订阅 ${p.name}，有效期至 ${expireStr}，${p.sms === Infinity ? '短信不限量' : '短信 ' + p.sms + ' 条'} · ${p.call === Infinity ? '通话不限时' : '通话 ' + p.call + ' 分钟'}`);
}

function _ppNotifyTopupSuccess(phone, amount) {
  const num = `LN · ${phone.number.seg} · ${phone.number.per}`;
  _ppNotify('话费充值成功', `${num} 已成功充值 ${amount.toLocaleString('zh-CN')} Lune`);
}

function _ppNotifyPlanExpired(phone) {
  const num = `LN · ${phone.number.seg} · ${phone.number.per}`;
  _ppNotify('套餐已到期', `${num} 的「${phone.plan.name}」已到期，当前已自动切换为无套餐费率，短信/通话资费翻倍，请及时续费以免产生较多费用`);
}

/* 发一条模拟的验证码短信（用户主动点击触发，不在后台自行编造）：
   验证码本身与「验证码始终免费」的费率说明一致，只是让用户能实际看到
   一条系统短信长什么样，并同步进「信息」App 的系统分组。 */
async function ppSendTestVerificationCode() {
  const phone = await _loadPhoneData();
  if (!phone.number) return;
  const num = `LN · ${phone.number.seg} · ${phone.number.per}`;
  const code = String(Math.floor(Math.random() * 900000) + 100000);
  _ppNotify('验证码', `【Luna】您的验证码是 ${code}，5 分钟内有效，请勿泄露给他人。（${num} 接收，验证码不计入短信用量）`);
  _ppFlashSuccess('已发送测试验证码短信');
}

/* ---------- 视图：号码总览 + 套餐 + 充值（管理主视图） ---------- */
function _ppShowManage(phone) {
  _ppHideAllViews();
  _ppSetTitle('我的号码');
  const view = document.getElementById('ppViewManage');
  if (view) view.style.display = 'flex';
  _ppRenderManage(phone);
}

async function _ppRefreshManage() {
  const phone = await _loadPhoneData();
  _ppRenderManage(phone);
}

function _ppRenderManage(phone) {
  const numEl = document.getElementById('ppMgrNumber');
  const rarityEl = document.getElementById('ppMgrRarity');
  if (numEl) numEl.textContent = `LN · ${phone.number.seg} · ${phone.number.per}`;
  if (rarityEl) rarityEl.textContent = phone.number.rarityLabel + ' · 买断永久持有';

  // 当前套餐状态条
  const statusEl = document.getElementById('ppPlanStatus');
  const expired = phone.plan ? Date.now() > phone.plan.expireAt : false;
  if (statusEl) {
    if (!phone.plan) {
      statusEl.innerHTML = `<div class="pp-status-title">未订阅任何套餐</div><div class="pp-status-sub">短信 ${PHONE_RATE.smsOut} Lune/条 · 通话 ${PHONE_RATE.callOut} Lune/分钟 · 验证码始终免费</div>`;
    } else {
      const d = new Date(phone.plan.expireAt);
      const expireStr = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
      statusEl.innerHTML = expired
        ? `<div class="pp-status-title">${phone.plan.name} 已到期</div><div class="pp-status-sub">已自动切换为无套餐费率，短信/通话费用翻倍，建议尽快续费</div>`
        : `<div class="pp-status-title">${phone.plan.name} 生效中</div><div class="pp-status-sub">每月 ${phone.plan.sms === Infinity ? '短信不限量' : '短信 ' + phone.plan.sms + ' 条'} · ${phone.plan.call === Infinity ? '通话不限时' : '通话 ' + phone.plan.call + ' 分钟'} · 有效至 ${expireStr}</div>`;
    }
    statusEl.classList.toggle('warn', expired || !phone.plan);
  }

  // 四档套餐卡片
  const listEl = document.getElementById('ppPlanList');
  if (listEl) {
    listEl.innerHTML = PHONE_PLAN_ORDER.map(k => {
      const p = PHONE_PLANS[k];
      const isCurrent = phone.plan && phone.plan.key === k && !expired;
      return `
        <div class="pp-plan-card ${isCurrent ? 'current' : ''}" onclick="ppSelectPlan('${k}')">
          <div class="pp-plan-top">
            <span class="pp-plan-name">${p.name}</span>
            <span class="pp-plan-tag">${isCurrent ? '当前生效' : p.tag}</span>
          </div>
          <div class="pp-plan-price">${p.price} <span>Lune / 月</span></div>
          <div class="pp-plan-feat">${p.sms === Infinity ? '短信不限量' : '短信 ' + p.sms + ' 条'} · ${p.call === Infinity ? '通话不限时' : '通话 ' + p.call + ' 分钟'}</div>
        </div>`;
    }).join('');
  }
}

/* 选择套餐 → 二次确认后扣款订阅（可反复续费/更换，任何时候点击都视为“购买/续费当前档位”） */
async function ppSelectPlan(planKey) {
  const p = PHONE_PLANS[planKey];
  if (!p) return;

  const errEl = document.getElementById('ppMgrError');
  if (errEl) errEl.style.display = 'none';

  const result = await _phoneCharge(p.price, `订阅 ${p.name}`);
  if (!result.ok) {
    if (errEl) { errEl.textContent = result.reason; errEl.style.display = 'block'; }
    return;
  }

  const phone = await _loadPhoneData();
  const now = Date.now();
  const base = (phone.plan && phone.plan.key === planKey && phone.plan.expireAt > now) ? phone.plan.expireAt : now;
  phone.plan = {
    key: p.key, name: p.name, price: p.price, sms: p.sms, call: p.call,
    activatedAt: now, expireAt: base + 30 * 24 * 60 * 60 * 1000
  };
  phone.history = Array.isArray(phone.history) ? phone.history : [];
  phone.history.unshift({ type: 'plan', name: `订阅 ${p.name}`, amount: p.price, date: _ppNowStr(), ts: now });
  await _savePhoneData(phone);

  await renderConnectPage();
  await _ppRefreshManage();
  _ppFlashSuccess(`已订阅 ${p.name}`);
  _ppNotifyPlanSubscribed(phone, p);
}

/* 任意金额充值话费（不绑定套餐，直接作为话费余量的等价扣款示意，同样走支付密码校验） */
function ppOnTopupInput(el) {
  let v = el.value.replace(/[^\d.]/g, '');
  const parts = v.split('.');
  if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
  const dotIdx = v.indexOf('.');
  if (dotIdx !== -1 && v.length - dotIdx - 1 > 2) v = v.slice(0, dotIdx + 3);
  el.value = v;
  const num = parseFloat(v);
  _ppTopupAmount = isNaN(num) ? null : num;
  const errEl = document.getElementById('ppTopupError');
  if (errEl) errEl.style.display = 'none';
}

function ppPickTopupQuick(amount) {
  const input = document.getElementById('ppTopupInput');
  if (input) input.value = amount;
  _ppTopupAmount = amount;
  const errEl = document.getElementById('ppTopupError');
  if (errEl) errEl.style.display = 'none';
}

async function ppConfirmTopup() {
  const errEl = document.getElementById('ppTopupError');
  const amount = _ppTopupAmount;
  if (!amount || amount <= 0) {
    if (errEl) { errEl.textContent = '请输入大于 0 的有效金额'; errEl.style.display = 'block'; }
    return;
  }

  const phone = await _loadPhoneData();
  const result = await _phoneCharge(amount, `话费充值 LN·${phone.number.seg}·${phone.number.per}`);
  if (!result.ok) {
    if (errEl) { errEl.textContent = result.reason; errEl.style.display = 'block'; }
    return;
  }

  phone.history = Array.isArray(phone.history) ? phone.history : [];
  phone.history.unshift({ type: 'topup', name: '话费充值', amount, date: _ppNowStr(), ts: Date.now() });
  await _savePhoneData(phone);

  const input = document.getElementById('ppTopupInput');
  if (input) input.value = '';
  _ppTopupAmount = null;

  await renderConnectPage();
  _ppFlashSuccess(`充值成功，已支付 ${amount.toLocaleString('zh-CN')} Lune`);
  _ppNotifyTopupSuccess(phone, amount);
}

function _ppFlashSuccess(msg) {
  const el = document.getElementById('ppSuccessToast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

/* ---------- 视图：账单 / 消费记录 ---------- */
async function _ppShowHistory(phone) {
  _ppHideAllViews();
  _ppSetTitle('通讯账单');
  const view = document.getElementById('ppViewHistory');
  if (view) view.style.display = 'flex';

  const listEl = document.getElementById('ppHistoryList');
  if (!listEl) return;
  const history = Array.isArray(phone.history) ? phone.history : [];
  if (!history.length) {
    listEl.innerHTML = `<div style="padding:40px 0;text-align:center;font-size:12.5px;color:#9aa0ac;">暂无通讯消费记录</div>`;
    return;
  }
  listEl.innerHTML = history.map(h => `
    <div class="pp-hist-item">
      <div class="pp-hist-dot"></div>
      <div class="pp-hist-mid">
        <div class="pp-hist-name">${h.name}</div>
        <div class="pp-hist-date">${h.date}</div>
      </div>
      <div class="pp-hist-amount">-${Number(h.amount).toLocaleString('zh-CN')}</div>
    </div>`).join('');
}

function _ppNowStr() {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} · ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}