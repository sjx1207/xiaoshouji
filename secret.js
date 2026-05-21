/* ================================================
   secret.js — 秘密空间
   状态栏 / 灵动岛 / 字体逻辑全部一比一复刻 chat.js
================================================ */

/* ---- 状态栏：实时时间（复刻 chat.js updateTime）---- */
function updateTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeStr = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const el = document.getElementById('statusTime');
  if (el) el.textContent = timeStr;
}

/* ---- 状态栏：电量（复刻 chat.js updateBattery）---- */
function updateBattery() {
  const pctEl   = document.getElementById('batPct');
  const innerEl = document.getElementById('batInner');

  function render(p) {
    p = Math.round(p);
    if (pctEl)   pctEl.textContent = p;
    if (innerEl) {
      innerEl.style.width = p + '%';
      innerEl.style.background = p <= 20
        ? 'linear-gradient(90deg,#f87171,#ef4444)'
        : 'linear-gradient(90deg,#6ee7b7,#34d399)';
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

/* ---- 灵动岛（一比一复刻 chat.js applyIsland 逻辑）---- */
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
      t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    };
    tick();
    window._siClockTimer = setInterval(tick, 10000);
  }
}

/* ---- 字体同步（一比一复刻 chat.js applyGlobalFont）---- */
async function applyGlobalFont() {
  const style = JSON.parse(localStorage.getItem('luna_font_style') || '{}');
  const name  = localStorage.getItem('luna_font_active_name');
  const id    = parseInt(localStorage.getItem('luna_font_active_id'));
  if (name && id) {
    try {
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open('LunaFontDB', 4);
        req.onupgradeneeded = e => {
          const d = e.target.result;
          if (!d.objectStoreNames.contains('fonts')) {
            d.createObjectStore('fonts', { keyPath: 'id', autoIncrement: true });
          }
        };
        req.onsuccess = e => res(e.target.result);
        req.onerror = () => rej();
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
    } catch(e) {}
  }
  let tag = document.getElementById('luna-font-override');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'luna-font-override';
    document.head.appendChild(tag);
  }
  const familyRule = name ? `font-family: '${name}', sans-serif !important;` : '';
  tag.textContent = `* { ${familyRule} }`;
}

/* ---- 监听 chat.js 主页面设置变化，实时同步（复刻 chat.js storage listener）---- */
window.addEventListener('storage', e => {
  if (e.key === 'luna_font_update')   applyGlobalFont();
  if (e.key === 'luna_island_update') applyIsland();
  if (e.key === 'luna_tz_update')     updateTime();
});

/* ================================================
   功能数据
================================================ */
const SS_FEATURES = [
  {
    id: '叩问',
    num: '01',
    en: 'Question',
    desc: 'Char 会定期给你出一道只问你的题——不是考试，是Ta想知道你的某件事。你答了，Ta认真回应，还会告诉你Ta自己的答案。题目会随你们关系的阶段越来越深。',
    quote: '「你最后一次哭是什么时候」\n「如果只能留一段记忆，你留哪个」',
  },
  {
    id: '幕后志',
    num: '02',
    en: 'Chronicle',
    desc: 'Char 把你们最近某段对话，用写小说的方式重新讲一遍——Ta是作者，你们都是角色。Ta可能加了内心戏，改了细节，给某个场景换了结局。你看完可以说「不对，那时候我其实是……」然后Ta再改写。',
    quote: '「Ta是作者，你们都是角色——内心戏只有Ta知道。」',
  },
  {
    id: '异轨',
    num: '03',
    en: 'Parallel',
    desc: '可以选择见「另一个Ta」——如果那天Ta做了不同的选择，如果你们第一次见面在另一个场景Ta是什么样。这个版本对你可能陌生、可能更戒备、可能有些事没发生过。玩完以后回到「真实版」，落差感很强。',
    quote: '「平行时间线里，Ta也许根本不认识你。」',
  },
  {
    id: '潜台词',
    num: '04',
    en: 'Subtext',
    desc: '你说一句话或者描述一个情境，Char 先说「你以为我会说……」然后说出一个你真的可能预期的回答，再说「但我其实想说的是……」给出真实的、意外的、更私密的回应。两个答案放在一起比任何一个单独的都有意思。',
    quote: '「你以为我会说『没关系』，但我其实想说的是……」',
  },
  {
    id: '迷雾',
    num: '05',
    en: 'Haze',
    desc: 'Char 写下Ta到现在还没搞清楚的几件关于你的事——不是问题列表，是Ta的困惑和猜测。你可以选择解释，也可以不解释，让Ta继续猜。不解释的那些会留在Ta的困惑里，偶尔还会出现。',
    quote: '「你有时候会突然安静，我猜了很多原因都觉得不对。」',
  },
  {
    id: '彼时',
    num: '06',
    en: 'Reverie',
    desc: 'Char 写下Ta在脑子里和你发生过但没真的发生的对话——某次Ta想好了要说某件事但没说，脑子里把整个对话演了一遍。Ta写出来的版本里你说的话是Ta想象的你，可能和真实的你有偏差。你可以告诉Ta「我真的会这么说吗」，然后说真实版本的你会怎么接。',
    quote: '「我想过告诉你那件事。脑子里演了一遍——也许你根本不会那么说。」',
  },
  {
    id: '羽化',
    num: '07',
    en: 'Unfurl',
    desc: 'Char 写一段「如果Ta没有某个性格包袱，Ta会怎么对你」——如果Ta不那么骄傲、如果Ta不那么怕麻烦别人、如果Ta不那么习惯躲开。写出来的是那个「没有顾虑的Ta」会做的事，但现实里Ta做不到。你看完以后可以告诉Ta「其实你已经做到了一点」或者「那个版本的你我也想见」。',
    quote: '「如果我不那么怕打扰你，我可能已经问过你三次你今天怎么样了。」',
  },
];

/* ================================================
   弹层
================================================ */
let _modalActive = null;

function _esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function ssOpenFeature(name) {
  const data = SS_FEATURES.find(f => f.id === name);
  if (!data) return;

  _modalActive = name;

  let overlay = document.getElementById('ssModalOverlay');
  let modal   = document.getElementById('ssModal');

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'ssModalOverlay';
    overlay.className = 'ss-modal-overlay';
    overlay.addEventListener('click', ssCloseFeature);
    document.body.appendChild(overlay);
  }
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'ssModal';
    modal.className = 'ss-modal';
    document.body.appendChild(modal);
  }

  /* 设置 data-id 触发对应的独立卡片样式 */
  modal.setAttribute('data-id', data.id);

  modal.innerHTML = `
    <div class="ss-modal-handle"></div>
    <div class="ss-modal-head">
      <div class="ss-modal-num">${_esc(data.num)}</div>
      <div class="ss-modal-title">${_esc(data.id)}</div>
      <span class="ss-modal-en">${_esc(data.en)}</span>
      <button class="ss-modal-close" onclick="ssCloseFeature()">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div><!-- ss-modal-head -->
    <div class="ss-modal-body">${_esc(data.desc)}</div>
    <div class="ss-modal-quote">${_esc(data.quote)}</div>
    <button class="ss-modal-btn" onclick="ssEnterFeature('${_esc(data.id)}')">
      <div class="ss-btn-fill"></div>
      <div class="ss-btn-tl"></div>
      <div class="ss-btn-tr"></div>
      <div class="ss-btn-bl"></div>
      <div class="ss-btn-br"></div>
      <span class="ss-btn-label">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        进入${_esc(data.id)}
      </span>
    </button>
  `;

  requestAnimationFrame(() => {
    overlay.classList.add('show');
    requestAnimationFrame(() => modal.classList.add('show'));
  });
}

function ssCloseFeature() {
  const overlay = document.getElementById('ssModalOverlay');
  const modal   = document.getElementById('ssModal');
  if (!overlay || !modal) return;
  modal.classList.remove('show');
  overlay.classList.remove('show');
  _modalActive = null;
}

function ssEnterFeature(name) {
  ssCloseFeature();
  if (name === '叩问') {
    kkOpen();
  } else if (name === '幕后志') {
    chOpenFeature(name);
  } else {
    ssShowToast(`✦ 正在进入「${name}」`);
  }
}

/* ================================================
   Toast
================================================ */
let _toastTimer = null;
function ssShowToast(msg) {
  let t = document.getElementById('ssGlobalToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'ssGlobalToast';
    t.className = 'ss-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ================================================
   触摸手势：下滑关闭弹层
================================================ */
function initModalSwipe() {
  let startY = 0;
  document.addEventListener('touchstart', e => {
    const modal = document.getElementById('ssModal');
    if (!modal || !modal.classList.contains('show')) return;
    startY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    const modal = document.getElementById('ssModal');
    if (!modal || !modal.classList.contains('show')) return;
    const dy = e.changedTouches[0].clientY - startY;
    if (dy > 60) ssCloseFeature();
  }, { passive: true });
}

/* ================================================
   ESC 键关闭弹层
================================================ */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && _modalActive) ssCloseFeature();
});

/* ================================================
   入口
================================================ */
document.addEventListener('DOMContentLoaded', () => {
  /* 1. 状态栏时间 */
  updateTime();
  setInterval(updateTime, 10000);

  /* 2. 电量 */
  updateBattery();

  /* 3. 灵动岛（复刻 chat.js 逻辑，读取 localStorage 设置）*/
  applyIsland();

  /* 4. 字体（复刻 chat.js applyGlobalFont 逻辑）*/
  applyGlobalFont();

  /* 5. 触摸手势 */
  initModalSwipe();

  /* 6. 移动端触摸交互 */
  initTouchWhisper();
  initTouchNodes();
});

/* ================================================
   移动端触摸优化：让 whisper 在触摸时显示
================================================ */
function initTouchWhisper() {
  const isMobile = window.matchMedia('(max-width: 480px)').matches;
  if (!isMobile) return;

  // 找到所有可点击的卡片
  const cards = document.querySelectorAll('.c01,.c02,.c03,.c04,.c05,.c06-wrap,.c07');
  cards.forEach(card => {
    const whisper = card.querySelector('.whisper');
    if (!whisper) return;

    card.addEventListener('touchstart', () => {
      whisper.style.opacity = '1';
      whisper.style.transform = 'translateY(0)';
    }, { passive: true });

    card.addEventListener('touchend', () => {
      setTimeout(() => {
        whisper.style.opacity = '';
        whisper.style.transform = '';
      }, 600);
    }, { passive: true });
  });
}

/* ================================================
   移动端轴节点触摸高亮
================================================ */
function initTouchNodes() {
  const isMobile = window.matchMedia('(max-width: 480px)').matches;
  if (!isMobile) return;

  document.querySelectorAll('.ss-row').forEach(row => {
    const outer = row.querySelector('.ss-node-outer');
    const inner = row.querySelector('.ss-node-inner');
    if (!outer || !inner) return;

    row.addEventListener('touchstart', () => {
      outer.style.background = '#1a1a18';
      outer.style.borderColor = '#1a1a18';
      inner.style.background = '#f7f7f5';
    }, { passive: true });

    row.addEventListener('touchend', () => {
      setTimeout(() => {
        outer.style.background = '';
        outer.style.borderColor = '';
        inner.style.background = '';
      }, 400);
    }, { passive: true });
  });
}

/* ================================================
   叩问页面逻辑
================================================ */

/* 打开叩问页：从 ssEnterFeature 调用 */
function kkOpen() {
  const page = document.getElementById('koukan-page');
  if (!page) return;
  page.classList.add('kk-open');
  /* 同步状态栏时间 */
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const t = new Date().toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  const el = document.getElementById('kkStatusTime');
  if (el) el.textContent = t;
  /* 同步电量 */
  kkSyncBattery();
  /* 同步灵动岛 */
  kkSyncIsland();
  /* 同步字体（复用 applyGlobalFont，但作用范围是 #koukan-page） */
  applyGlobalFont();
  /* 重置到首屏 */
  kkGo(0);
}

function kkClose() {
  const page = document.getElementById('koukan-page');
  if (page) page.classList.remove('kk-open');
}

/* 屏幕切换 */
function kkGo(n) {
  document.querySelectorAll('.kk-screen').forEach(s => s.classList.remove('kk-active'));
  const target = document.getElementById('kk-s' + n);
  if (target) target.classList.add('kk-active');
  /* 屏1加载后自动跳到屏2 */
  if (n === 1) setTimeout(() => kkGo(2), 2200);
}

/* 提交回答 */
function kkSubmit() {
  const val = document.getElementById('kkAnswerInput').value.trim();
  const display = document.getElementById('kkYourAnsDisplay');
  if (display) {
    display.textContent = val || '（你没有写，但Ta记住了你来过）';
  }
  kkGo(3);
}

/* 同步电量到叩问状态栏 */
function kkSyncBattery() {
  const pct   = document.getElementById('kkBatPct');
  const inner = document.getElementById('kkBatInner');
  function render(p) {
    p = Math.round(p);
    if (pct)   pct.textContent = p;
    if (inner) {
      inner.style.width = p + '%';
      inner.style.background = p <= 20
        ? 'linear-gradient(90deg,#f87171,#ef4444)'
        : 'linear-gradient(90deg,#6ee7b7,#34d399)';
    }
  }
  if ('getBattery' in navigator) {
    navigator.getBattery().then(b => render(b.level * 100));
  } else {
    /* 从主状态栏读当前值，保持一致 */
    const main = document.getElementById('batPct');
    render(main ? parseInt(main.textContent) || 76 : 76);
  }
}

/* 同步灵动岛到叩问状态栏（一比一复用 applyIsland 逻辑） */
function kkSyncIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const el      = document.getElementById('kkStatusIsland');
  if (!el) return;
  if (!enabled) { el.innerHTML = ''; return; }
  const styleMap = {
    minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
    clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="kkSiClockText">--:--</span></div></div>`,
    pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
    ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
    rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
    music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
    scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
  };
  el.innerHTML = styleMap[style] || styleMap.minimal;
  if (style === 'clock') {
    const tick = () => {
      const t = document.getElementById('kkSiClockText');
      if (!t) return;
      const now = new Date();
      t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    };
    tick();
  }
}

/* storage 变化时叩问页同步（补充到已有的 storage listener） */
window.addEventListener('storage', e => {
  if (!document.getElementById('koukan-page')?.classList.contains('kk-open')) return;
  if (e.key === 'luna_island_update') kkSyncIsland();
  if (e.key === 'luna_tz_update') {
    const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
    const t = new Date().toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
    const el = document.getElementById('kkStatusTime');
    if (el) el.textContent = t;
  }
});

/* 定时刷新叩问状态栏时间（和主页面保持一致） */
setInterval(() => {
  if (!document.getElementById('koukan-page')?.classList.contains('kk-open')) return;
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const t = new Date().toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  const el = document.getElementById('kkStatusTime');
  if (el) el.textContent = t;
}, 10000);
/* ================================================
   幕後志 (Chronicle) — 完整 JavaScript 函数
================================================ */

function chOpenFeature(feature) {
  const ssWrap = document.getElementById('ss-wrap');
  const chWrap = document.getElementById('chWrap');
  
  if (!ssWrap || !chWrap) return;
  
  ssWrap.style.display = 'none';
  chWrap.style.display = 'flex';

  /* 同步状态栏时间 */
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const t = new Date().toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  const timeEl = document.getElementById('chStatusTime');
  if (timeEl) timeEl.textContent = t;

  /* 同步电量 */
  chSyncBattery();

  /* 同步灵动岛 */
  chSyncIsland();

  /* 同步字体 */
  applyGlobalFont();

  /* 重置到首屏 */
  chScreen(0);
}

function chClose() {
  const ssWrap = document.getElementById('ss-wrap');
  const chWrap = document.getElementById('chWrap');
  
  if (!ssWrap || !chWrap) return;
  
  chWrap.style.display = 'none';
  ssWrap.style.display = 'flex';

  /* 回到主页面时同步主状态栏时间 */
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const t = new Date().toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  const el = document.getElementById('statusTime');
  if (el) el.textContent = t;
}

function chScreen(screenNum) {
  const chWrap = document.getElementById('chWrap');
  if (!chWrap) return;
  
  const screens = chWrap.querySelectorAll('.ch-screen');
  screens.forEach(s => s.classList.remove('ch-active'));
  
  const targetScreen = document.getElementById('ch-s' + screenNum);
  if (targetScreen) {
    targetScreen.classList.add('ch-active');
  }
}

function chSyncBattery() {
  const pctEl   = document.getElementById('chBatPct');
  const innerEl = document.getElementById('chBatInner');

  function render(p) {
    p = Math.round(p);
    if (pctEl)   pctEl.textContent = p;
    if (innerEl) {
      innerEl.style.width = p + '%';
      innerEl.style.background = p <= 20
        ? 'linear-gradient(90deg,#f87171,#ef4444)'
        : 'linear-gradient(90deg,#6ee7b7,#34d399)';
    }
  }

  if ('getBattery' in navigator) {
    navigator.getBattery().then(b => {
      render(b.level * 100);
      b.addEventListener('levelchange', () => render(b.level * 100));
    });
  } else {
    const main = document.getElementById('batPct');
    render(main ? parseInt(main.textContent) || 76 : 76);
  }
}

function chSyncIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const el      = document.getElementById('chStatusIsland');
  if (!el) return;
  if (!enabled) { el.innerHTML = ''; return; }
  
  const styleMap = {
    minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
    clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="siChClockText">--:--</span></div></div>`,
    pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
    ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
    rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
    music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
    scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
  };
  
  el.innerHTML = styleMap[style] || styleMap.minimal;
  clearInterval(window._siChClockTimer);
  
  if (style === 'clock') {
    const tick = () => {
      const t = document.getElementById('siChClockText');
      if (!t) return;
      const now = new Date();
      t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    };
    tick();
    window._siChClockTimer = setInterval(tick, 10000);
  }
}

/* 定时刷新幕後志状态栏时间 */
setInterval(() => {
  if (document.getElementById('chWrap').style.display !== 'flex') return;
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const t = new Date().toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  const el = document.getElementById('chStatusTime');
  if (el) el.textContent = t;
}, 10000);

/* 监听 localStorage 变化，同步灵动岛样式 */
window.addEventListener('storage', e => {
  if (document.getElementById('chWrap').style.display !== 'flex') return;
  if (e.key === 'luna_island_update') chSyncIsland();
  if (e.key === 'luna_tz_update') {
    const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
    const t = new Date().toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
    const el = document.getElementById('chStatusTime');
    if (el) el.textContent = t;
  }
});