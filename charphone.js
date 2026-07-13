/* ================================
   보관함 — charphone.js
   角色手机入口页

   数据来源：复用 characters.js 已建立的
   LunaCharDB / chars store，不重建、不改写
   任何字段结构。

   本页只读取 name / avatar / color 三个
   与"人设"无关的展示字段，用于识别是
   谁的手机；desc / prompt / traits 等
   人设字段不在本页读取，也不渲染。
================================ */

/* ---- 返回首页 ---- */
function goBack() {
  const mask = document.createElement('div');
  mask.style.cssText = 'position:fixed;inset:0;background:rgba(245,245,245,0.97);opacity:0;z-index:9999;transition:opacity 0.28s ease;pointer-events:all;';
  document.body.appendChild(mask);
  requestAnimationFrame(() => { mask.style.opacity = '1'; });
  setTimeout(() => { window.location.href = 'index.html'; }, 260);
}

/* ================================
   状态栏时间 — 同步 index / characters 逻辑
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
   电量 — 同步 index / characters 逻辑
================================ */
function updateBattery() {
  function render(pct) {
    const p = Math.round(pct);
    document.querySelectorAll('.bat-pct').forEach(el => el.textContent = p);
    document.querySelectorAll('.bat-inner').forEach(el => {
      el.style.width      = p + '%';
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
   灵动岛 — 同步 index / characters 逻辑
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

/* localStorage 跨页同步 */
window.addEventListener('storage', (e) => {
  if (e.key === 'luna_island_update') applyIsland();
  if (e.key === 'luna_tz_update')     updateTime();
  if (e.key === 'luna_font_update')   applyGlobalFont();
  /* characters.html 那边新增/编辑/删除角色后会写这个 key，
     本页监听到就重新拉取列表，保持数据同步 */
  if (e.key === 'luna_characters_updated' || e.key === 'luna_char_db_update') {
    renderGallery();
  }
});

/* ================================
   颜色方案 — 与 characters.js 保持一致
   （仅用于头像兜底底色，不涉及人设）
================================ */
const COLOR_MAP = {
  warm:  { avBg:'#1C1C1C', avCol:'#B4B4B4' },
  cool:  { avBg:'#141414', avCol:'#9C9C9C' },
  gold:  { avBg:'#181818', avCol:'#A8A8A8' },
  ash:   { avBg:'#141414', avCol:'#9D9D9D' },
  mist:  { avBg:'#151515', avCol:'#A5A5A5' },
  blush: { avBg:'#171717', avCol:'#ADADAD' },
};

/* ================================
   IndexedDB — 只读取，复用 characters.js
   建立的同一个 LunaCharDB / chars store，
   不新建库、不改字段。
================================ */
let _db = null;

function openCharDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const probe = indexedDB.open('LunaCharDB');
    probe.onsuccess = e => {
      const cur = e.target.result;
      const ver = cur.version;
      const hasChars = cur.objectStoreNames.contains('chars');
      cur.close();

      if (hasChars) {
        const req2 = indexedDB.open('LunaCharDB', ver);
        req2.onsuccess = e2 => { _db = e2.target.result; res(_db); };
        req2.onerror   = e2 => rej(e2.target.error);
        req2.onupgradeneeded = () => {};
      } else {
        const req3 = indexedDB.open('LunaCharDB', ver + 1);
        req3.onupgradeneeded = e3 => {
          const db3 = e3.target.result;
          if (!db3.objectStoreNames.contains('chars'))
            db3.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
        };
        req3.onsuccess = e3 => { _db = e3.target.result; res(_db); };
        req3.onerror   = e3 => rej(e3.target.error);
      }
    };
    probe.onerror = e => rej(e.target.error);
    probe.onupgradeneeded = e => {
      const db0 = e.target.result;
      if (!db0.objectStoreNames.contains('chars'))
        db0.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
    };
  });
}

async function getAllChars() {
  const db = await openCharDB().catch(err => { console.error('CharDB打开失败:', err); return null; });
  if (!db) return [];
  return new Promise(res => {
    const req = db.transaction('chars', 'readonly').objectStore('chars').getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror   = () => res([]);
  });
}

/* ================================
   屏幕内部纹理（纯几何线条装饰，
   与人设无关，仅用于视觉区分卡片）
================================ */
function buildTexture(seed) {
  const angle  = 16 + (seed % 5) * 7;
  const offset = seed * 6;
  return `
    <svg viewBox="0 0 120 220" preserveAspectRatio="none" aria-hidden="true">
      <g transform="rotate(${angle} 60 110)">
        <line class="tx-line" x1="-40" y1="${18 + offset}" x2="200" y2="${18 + offset}"/>
        <line class="tx-line" x1="-40" y1="${64 + offset}" x2="200" y2="${64 + offset}"/>
        <line class="tx-line tx-line--strong" x1="-40" y1="${110 + offset}" x2="200" y2="${110 + offset}"/>
        <line class="tx-line" x1="-40" y1="${156 + offset}" x2="200" y2="${156 + offset}"/>
        <line class="tx-line" x1="-40" y1="${202 + offset}" x2="200" y2="${202 + offset}"/>
      </g>
    </svg>
  `;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ================================
   渲染陈列区
================================ */
let _chars    = [];
let _activeId = null;

async function renderGallery() {
  _chars    = await getAllChars();
  _activeId = parseInt(localStorage.getItem('luna_active_char')) || null;

  const gallery = document.getElementById('cpGallery');
  const countEl = document.getElementById('cpCount');
  if (countEl) countEl.textContent = String(_chars.length).padStart(2, '0') + ' · 台设备';

  if (_chars.length === 0) {
    gallery.innerHTML = `
      <div class="cp-empty">
        <div class="cp-empty-icon">
          <svg viewBox="0 0 48 48" width="44" height="44" fill="none">
            <rect x="14" y="6" width="20" height="36" rx="4" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>
            <circle cx="24" cy="34" r="1.5" fill="currentColor" opacity="0.35"/>
          </svg>
        </div>
        <div class="cp-empty-title">暂无收纳的设备</div>
        <div class="cp-empty-desc">请先前往 <strong>角色档案</strong> 创建一个角色</div>
      </div>`;
    return;
  }

  gallery.innerHTML = '';
  _chars.forEach((c, i) => {
    gallery.appendChild(buildDeviceCard(c, i));
  });
}

function buildDeviceCard(c, index) {
  const isActive = c.id === _activeId;
  const col      = COLOR_MAP[c.color] || COLOR_MAP.warm;
  const letter   = (c.name || '?')[0].toUpperCase();
  const idxStr   = String(index + 1).padStart(2, '0');

  const el = document.createElement('article');
  el.className = 'cp-device' + (isActive ? ' is-active' : '');
  el.setAttribute('role', 'listitem');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', `打开${c.name || '设备'}`);
  el.style.animationDelay = `${0.08 + index * 0.07}s`;
  el.dataset.charId = c.id;

  el.innerHTML = `
    <div class="cp-device-frame">
      <span class="cp-device-notch"></span>
      <div class="cp-device-screen">
        <div class="cp-device-texture">${buildTexture(index + 1)}</div>

        <!-- 迷你状态栏，营造"真实截屏"感，不含任何人设文字 -->
        <div class="cp-device-minibar">
          <span class="cp-device-minibar-time">9:41</span>
          <span class="cp-device-minibar-icons">
            <i class="cp-mb-signal"></i>
            <i class="cp-mb-batt"></i>
          </span>
        </div>

        <div class="cp-device-status"><span></span><span></span></div>

        <div class="cp-device-core">
          <div class="cp-device-avatar" style="background:${col.avBg}">
            ${c.avatar
              ? `<img src="${c.avatar}" alt=""/>`
              : `<span class="cp-device-avatar-letter" style="color:${col.avCol}">${letter}</span>`}
            <span class="cp-device-avatar-ring"></span>
          </div>
          <div class="cp-device-name">${escHtml(c.name || '')}</div>
          <div class="cp-device-tag">${isActive ? '· 最近使用 ·' : '· 锁屏状态 ·'}</div>
        </div>

        <!-- 底部仿消息条纹占位，暗示屏幕内有记录，不渲染任何人设内容 -->
        <div class="cp-device-stripes">
          <span class="cp-stripe cp-stripe--l"></span>
          <span class="cp-stripe cp-stripe--r"></span>
          <span class="cp-stripe cp-stripe--l cp-stripe--sm"></span>
        </div>

        <div class="cp-device-corner cp-device-corner--tl"></div>
        <div class="cp-device-corner cp-device-corner--br"></div>
      </div>
    </div>
    <div class="cp-device-meta">
      <div class="cp-device-id"><span class="cp-device-id-dash"></span>NO.${idxStr}</div>
      <div class="cp-device-status-pill${isActive ? ' active' : ''}">${isActive ? '已连接' : '待机中'}</div>
    </div>
  `;

  // 点击 / 回车 进入该角色的手机
  // 与 chatroom.js 共用同一套"当前角色"标识：
  // - luna_current_chat：chatroom.js 里 CR_NAME 的读取 key，值是角色 name
  // - luna_active_char / luna_active_phone_char：本页 & phonechar.js 用来定位角色 id
  const enterDevice = () => {
    try {
      localStorage.setItem('luna_current_chat', c.name || '');
      localStorage.setItem('luna_active_char', String(c.id));
      localStorage.setItem('luna_active_phone_char', String(c.id));
    } catch (e) {}

    const mask = document.createElement('div');
    mask.style.cssText = 'position:fixed;inset:0;background:rgba(245,245,245,0.97);opacity:0;z-index:9999;transition:opacity 0.28s ease;pointer-events:all;';
    document.body.appendChild(mask);
    requestAnimationFrame(() => { mask.style.opacity = '1'; });
    setTimeout(() => {
      window.location.href = `phonechar.html?char=${encodeURIComponent(c.id)}`;
    }, 260);
  };

  el.addEventListener('click', enterDevice);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      enterDevice();
    }
  });

  return el;
}

/* ================================
   初始化
================================ */
document.addEventListener('DOMContentLoaded', () => {
  updateTime();
  setInterval(updateTime, 1000);
  updateBattery();
  applyIsland();
  applyGlobalFont();
  renderGallery();
});

/* ================================
   字体同步 — 与 characters.js 保持一致
================================ */
async function applyGlobalFont() {
  const style = JSON.parse(localStorage.getItem('luna_font_style') || '{}');
  const name  = localStorage.getItem('luna_font_active_name');
  const id    = parseInt(localStorage.getItem('luna_font_active_id'));
  if (name && id) {
    try {
      const db = await new Promise((res, rej) => {
        const probe = indexedDB.open('LunaFontDB');
        probe.onupgradeneeded = e => {
          if (!e.target.result.objectStoreNames.contains('fonts'))
            e.target.result.createObjectStore('fonts', { keyPath: 'id', autoIncrement: true });
        };
        probe.onsuccess = e => {
          const cur = e.target.result;
          const ver = cur.version;
          const has = cur.objectStoreNames.contains('fonts');
          cur.close();
          const req2 = indexedDB.open('LunaFontDB', has ? ver : ver + 1);
          req2.onupgradeneeded = e2 => {
            if (!e2.target.result.objectStoreNames.contains('fonts'))
              e2.target.result.createObjectStore('fonts', { keyPath: 'id', autoIncrement: true });
          };
          req2.onsuccess = e2 => res(e2.target.result);
          req2.onerror   = () => rej(new Error('LunaFontDB open failed'));
        };
        probe.onerror = () => rej(new Error('LunaFontDB probe failed'));
      });
      const all = await new Promise(res => {
        if (!db.objectStoreNames.contains('fonts')) return res([]);
        const r = db.transaction('fonts', 'readonly').objectStore('fonts').getAll();
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
  tag.textContent  = `* { ${familyRule} }`;
}