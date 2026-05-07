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

  if (action === 'security') { wOpenSecurityPage(); return; }

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

  /* ---------- 公共初始化（不依赖 onboarding 结果）---------- */
  initTransMask();
  updateBattery();
  updateTime();
  setInterval(updateTime, 1000);
  applyIsland();
  applyGlobalFont();
  switchTab('home');
  syncMePage();

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

  /* ---------- 判断是否需要 Onboarding，再决定启动什么 ---------- */
  const alreadyDone = localStorage.getItem('luna_wallet_onboarded') === '1';

  if (alreadyDone) {
    // 老用户直接跑 Splash
    runSplash();
  } else {
    // 新用户：先查 DB，异步判断
    (async () => {
      const hasData = await _obCheckHasWalletAccount();
      if (hasData) {
        // DB 里有身份数据，视为已注册，打标记后直接跑 Splash
        localStorage.setItem('luna_wallet_onboarded', '1');
        runSplash();
      } else {
        // 真正的第一次：隐藏 Splash，显示 Onboarding
        const splashEl = document.getElementById('wSplash');
        if (splashEl) splashEl.style.display = 'none';

        const ob = document.getElementById('wOnboarding');
        if (ob) {
          ob.style.display = 'flex'; // 直接用 flex，不依赖 CSS class
        }
      }
    })();
  }

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
    const req = indexedDB.open('LunaIdentityDB', 1);
    req.onupgradeneeded = () => {}; // 避免报错，不创建任何 store
    req.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('identities')) return res([]);
      const r = db.transaction('identities').objectStore('identities').getAll();
      r.onsuccess = () => res(r.result || []);
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
    const req = indexedDB.open('LunaIdentityDB', 1);
    req.onupgradeneeded = () => {};
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

  /* —— 姓名 —— */
  const displayName = account?.name || identity?.name || '未登录';
  const nameEl = document.getElementById('wMeName');
  if (nameEl) nameEl.textContent = displayName;

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
async function _loadSecurity() {
  const db = await _openSecDB();
  return new Promise(res => {
    const r = db.transaction('security').objectStore('security').get('main');
    r.onsuccess = () => res(r.result || { enabled: false, pin: null });
    r.onerror   = () => res({ enabled: false, pin: null });
  });
}
async function _saveSecurity(data) {
  const db = await _openSecDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('security', 'readwrite');
    tx.objectStore('security').put({ id: 'main', ...data });
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
  requestAnimationFrame(() => { page.style.opacity = '1'; });

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