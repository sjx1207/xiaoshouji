/* ================================================================
   心事局 · xinshiju.js
   状态栏/灵动岛/字体 — 与 characters.js / worldbook.js / user.js 同步
   数据优先级：角色基本信息 > 世界书 > 用户信息

   本版视觉改为"深海梦境"静态展示态：
   - 角色遴选 / AI 调用 / 存档等逻辑全部保留，供后续接入
   - 当前仅呈现：待命发光核心 → 点击唤醒 → 书写深处 的极简交互
================================================================ */

/* ---------------- 返回 ---------------- */
function goBack() {
  const mask = document.createElement('div');
  mask.style.cssText = 'position:fixed;inset:0;background:#010509;opacity:0;z-index:9999;transition:opacity 0.28s ease;pointer-events:all;';
  document.body.appendChild(mask);
  requestAnimationFrame(() => { mask.style.opacity = '1'; });
  setTimeout(() => { window.location.href = 'index.html'; }, 260);
}

/* ================================================================
   深海背景生成 —— 漂浮微粒 + 远景水母
================================================================ */
function spawnMotes(fieldId, count) {
  const field = document.getElementById(fieldId || 'xjMotes');
  if (!field) return;
  const n = count || 26;
  for (let i = 0; i < n; i++) {
    const m = document.createElement('div');
    m.className = 'xj-mote';
    const size = 1.5 + Math.random() * 3;
    m.style.width = size + 'px';
    m.style.height = size + 'px';
    m.style.left = (Math.random() * 100) + '%';
    m.style.setProperty('--mo', (0.25 + Math.random() * 0.55).toFixed(2));
    m.style.setProperty('--sway', (Math.random() * 26 - 13) + 'px');
    const dur = 14 + Math.random() * 18;
    m.style.animationDuration = dur + 's, ' + (3 + Math.random() * 4) + 's';
    m.style.animationDelay = (-Math.random() * dur) + 's, ' + (-Math.random() * 4) + 's';
    field.appendChild(m);
  }
}
function spawnMotesInto(fieldId, count) { spawnMotes(fieldId, count || 16); }

function jellySvg() {
  return `
    <svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
      <g class="xj-jelly-pulse">
        <ellipse cx="50" cy="42" rx="34" ry="26" fill="url(#jellyBell)"/>
        <path d="M18 44 Q50 66 82 44 Q50 58 18 44 Z" fill="rgba(180,225,255,0.18)"/>
      </g>
      <path d="M32 62 Q30 90 26 112" stroke="rgba(159,184,255,0.28)" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      <path d="M44 66 Q43 96 40 116" stroke="rgba(159,184,255,0.24)" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <path d="M56 66 Q58 96 61 116" stroke="rgba(159,184,255,0.24)" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <path d="M68 62 Q71 90 76 112" stroke="rgba(159,184,255,0.28)" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    </svg>`;
}

function spawnJellies(fieldId, count) {
  const field = document.getElementById(fieldId || 'xjJellies');
  if (!field) return;
  const n = count || 5;
  for (let i = 0; i < n; i++) {
    const j = document.createElement('div');
    j.className = 'xj-jelly';
    const size = 40 + Math.random() * 62;
    j.style.width = size + 'px';
    j.style.height = (size * 1.2) + 'px';
    j.style.left = (Math.random() * 90) + '%';
    j.style.top = (6 + Math.random() * 72) + '%';
    j.style.setProperty('--jx', (Math.random() * 30 - 15) + 'px');
    j.style.setProperty('--jy', (Math.random() * 18 - 9) + 'px');
    const durFloat = 10 + Math.random() * 8;
    const durBob = 7 + Math.random() * 6;
    j.style.animationDuration = durFloat + 's, ' + durBob + 's';
    j.style.animationDelay = (-Math.random() * durFloat) + 's, ' + (-Math.random() * durBob) + 's';
    j.style.opacity = (0.32 + Math.random() * 0.32).toFixed(2);
    j.innerHTML = jellySvg();
    const pulseEl = j.querySelector('.xj-jelly-pulse');
    if (pulseEl) {
      const pd = 2.6 + Math.random() * 1.8;
      pulseEl.style.animationDuration = pd + 's';
      pulseEl.style.animationDelay = (-Math.random() * pd) + 's';
    }
    field.appendChild(j);
  }
}
function spawnJelliesInto(fieldId, count) { spawnJellies(fieldId, count); }

/* 鱼群剪影：小巧的暗色鱼形，穿行制造纵深与生命感 */
function fishSvg() {
  return `
    <svg viewBox="0 0 30 16" width="1" height="1">
      <path d="M1 8 Q9 1 22 4 L29 1 L25 8 L29 15 L22 12 Q9 15 1 8 Z" fill="rgba(70,120,160,0.5)"/>
      <circle cx="8" cy="7" r="0.8" fill="rgba(200,230,255,0.55)"/>
    </svg>`;
}
function spawnFishes(fieldId, count) {
  const field = document.getElementById(fieldId || 'xjFishes');
  if (!field) return;
  const n = count || 7;
  for (let i = 0; i < n; i++) {
    const f = document.createElement('div');
    const rev = Math.random() < 0.5;
    f.className = 'xj-fish' + (rev ? ' xj-fish--rev' : '');
    const size = 16 + Math.random() * 20;
    f.style.width = size + 'px';
    f.style.height = (size * 16 / 30) + 'px';
    f.style.top = (14 + Math.random() * 68) + '%';
    f.style.setProperty('--fo', (0.25 + Math.random() * 0.35).toFixed(2));
    f.style.setProperty('--fdip', (Math.random() * 30 - 15) + 'px');
    const dur = 20 + Math.random() * 22;
    f.style.animationDuration = dur + 's';
    f.style.animationDelay = (-Math.random() * dur) + 's';
    f.innerHTML = fishSvg();
    field.appendChild(f);
  }
}
function spawnFishesInto(fieldId, count) { spawnFishes(fieldId, count); }

/* 上升气泡 */
function spawnBubbles(fieldId, count) {
  const field = document.getElementById(fieldId || 'xjBubbles');
  if (!field) return;
  const n = count || 16;
  for (let i = 0; i < n; i++) {
    const b = document.createElement('div');
    b.className = 'xj-bubble';
    const size = 3 + Math.random() * 9;
    b.style.width = size + 'px';
    b.style.height = size + 'px';
    b.style.left = (Math.random() * 100) + '%';
    b.style.setProperty('--bo', (0.2 + Math.random() * 0.45).toFixed(2));
    b.style.setProperty('--bsway', (Math.random() * 24 - 12) + 'px');
    const dur = 9 + Math.random() * 12;
    b.style.animationDuration = dur + 's';
    b.style.animationDelay = (-Math.random() * dur) + 's';
    field.appendChild(b);
  }
}
function spawnBubblesInto(fieldId, count) { spawnBubbles(fieldId, count || 10); }

/* 海底水草：固定于底部两侧，轻轻摇曳，填补边角空旷感 */
function kelpSvg(h, color) {
  const sway = 6 + Math.random() * 10;
  return `
    <svg viewBox="0 0 20 ${h}" width="20" height="${h}">
      <path d="M10 ${h} C 4 ${h*0.7}, ${16-sway} ${h*0.55}, 10 ${h*0.32} C ${4+sway} ${h*0.15}, ${16-sway} ${h*0.05}, 10 0"
        stroke="${color}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    </svg>`;
}
function spawnKelp() {
  const field = document.getElementById('xjSeabed');
  if (!field) return;
  const positions = [
    { left:'4%',  h:70,  color:'rgba(20,60,80,0.65)' },
    { left:'11%', h:48,  color:'rgba(16,48,66,0.6)'  },
    { left:'86%', h:60,  color:'rgba(20,60,80,0.6)'  },
    { left:'93%', h:42,  color:'rgba(16,48,66,0.55)' },
  ];
  positions.forEach(p => {
    const k = document.createElement('div');
    k.className = 'xj-kelp xj-kelp--sway';
    k.style.left = p.left;
    k.style.bottom = '0';
    k.style.animationDuration = (4 + Math.random() * 3) + 's';
    k.style.animationDelay = (-Math.random() * 4) + 's';
    k.innerHTML = kelpSvg(p.h, p.color);
    field.appendChild(k);
  });
}

/* ================================================================
   待命核心 · 点击唤醒 → 展开书写深处
================================================================ */
function awakenOrb() {
  const orb = document.getElementById('xjOrb');
  const stage = document.getElementById('xjStage');
  if (!orb || !stage) return;

  spawnOrbSparks();
  orb.classList.add('opening');

  setTimeout(() => {
    stage.classList.add('awake');
    orb.classList.remove('opening');
    const ta = document.getElementById('xjInput');
    if (ta) setTimeout(() => ta.focus(), 300);
  }, 420);
}

function closeAbyss() {
  const stage = document.getElementById('xjStage');
  if (!stage) return;
  stage.classList.remove('awake');
  const orb = document.getElementById('xjOrb');
  if (orb) {
    orb.style.transform = 'scale(0)';
    orb.style.opacity = '0';
    requestAnimationFrame(() => {
      orb.style.transition = 'transform .5s cubic-bezier(.2,.9,.25,1), opacity .5s ease';
      orb.style.transform = '';
      orb.style.opacity = '';
    });
    setTimeout(() => { orb.style.transition = ''; }, 550);
  }
}

/* 从沉浸回响舞台浮回水面：回响画布保留（返回后可再次进入书写），
   状态复位到待命核心 */
function surfaceFromEcho() {
  const stage = document.getElementById('xjStage');
  if (!stage) return;
  stage.classList.remove('reading');
  stage.classList.remove('awake');
  const orb = document.getElementById('xjOrb');
  if (orb) {
    orb.style.transform = 'scale(0)';
    orb.style.opacity = '0';
    requestAnimationFrame(() => {
      orb.style.transition = 'transform .5s cubic-bezier(.2,.9,.25,1), opacity .5s ease';
      orb.style.transform = '';
      orb.style.opacity = '';
    });
    setTimeout(() => { orb.style.transition = ''; }, 550);
  }
}

function spawnOrbSparks() {
  const holder = document.getElementById('xjOrbSparks');
  if (!holder) return;
  const count = 14;
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'xj-orb-spark';
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 70;
    s.style.left = '50%';
    s.style.top = '50%';
    s.style.setProperty('--sx', Math.cos(angle) * dist + 'px');
    s.style.setProperty('--sy', Math.sin(angle) * dist + 'px');
    s.style.animationDelay = (Math.random() * 0.15) + 's';
    holder.appendChild(s);
    setTimeout(() => s.remove(), 1000);
  }
}

/* ================================================================
   状态栏时间 — 同步 index 逻辑
================================================================ */
function updateTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const now = new Date();
  const s = now.toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  document.querySelectorAll('.status-time').forEach(el => el.textContent = s);
}

/* ================================================================
   电量 — 同步 index 逻辑
================================================================ */
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

/* ================================================================
   灵动岛 — 完整同步 index 逻辑
================================================================ */
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

/* ================================================================
   全局字体同步 — 与 user.js / characters.js applyGlobalFont 一致
================================================================ */
async function applyGlobalFont() {
  const name = localStorage.getItem('luna_font_active_name');
  const id   = parseInt(localStorage.getItem('luna_font_active_id'));

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
    } catch(e) {}
  }

  let tag = document.getElementById('luna-font-override');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'luna-font-override';
    document.head.appendChild(tag);
  }
  const familyRule = name ? `font-family: '${name}', serif !important;` : '';
  tag.textContent = familyRule ? `* { ${familyRule} }` : '';
}

/* 跨页 localStorage 同步 */
window.addEventListener('storage', (e) => {
  if (e.key === 'luna_island_update') applyIsland();
  if (e.key === 'luna_tz_update')     updateTime();
  if (e.key === 'luna_font_update')   applyGlobalFont();
  if (e.key === 'luna_characters_updated' || e.key === 'luna_char_db_update') { renderRoster(); updateDiverBar(); }
});

/* ================================================================
   IndexedDB — 角色库（与 characters.js 同一套安全探测逻辑）
================================================================ */
let _charDb = null;
function openCharDB() {
  if (_charDb) return Promise.resolve(_charDb);
  return new Promise((res, rej) => {
    const probe = indexedDB.open('LunaCharDB');
    probe.onsuccess = e => {
      const cur = e.target.result;
      const ver = cur.version;
      const hasChars = cur.objectStoreNames.contains('chars');
      cur.close();
      if (hasChars) {
        const req2 = indexedDB.open('LunaCharDB', ver);
        req2.onsuccess = e2 => { _charDb = e2.target.result; res(_charDb); };
        req2.onerror   = e2 => rej(e2.target.error);
      } else {
        const req3 = indexedDB.open('LunaCharDB', ver + 1);
        req3.onupgradeneeded = e3 => {
          const db3 = e3.target.result;
          if (!db3.objectStoreNames.contains('chars'))
            db3.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
        };
        req3.onsuccess = e3 => { _charDb = e3.target.result; res(_charDb); };
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
  const db = await openCharDB().catch(() => null);
  if (!db) return [];
  return new Promise(res => {
    const req = db.transaction('chars', 'readonly').objectStore('chars').getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror   = () => res([]);
  });
}

/* ================================================================
   IndexedDB — 世界书（与 characters.js 共用 LunaWorldBookDB/entries）
================================================================ */
let _wbDb = null;
function openWbDB() {
  return new Promise((res, rej) => {
    if (_wbDb) return res(_wbDb);
    const req = indexedDB.open('LunaWorldBookDB', 2);
    req.onupgradeneeded = e => {
      if (!e.target.result.objectStoreNames.contains('entries'))
        e.target.result.createObjectStore('entries', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = e => { _wbDb = e.target.result; res(_wbDb); };
    req.onerror   = e => rej(e.target.error);
  });
}
async function getAllWbEntries() {
  const db = await openWbDB().catch(() => null);
  if (!db) return [];
  if (!db.objectStoreNames.contains('entries')) return [];
  return new Promise(res => {
    const req = db.transaction('entries', 'readonly').objectStore('entries').getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror   = () => res([]);
  });
}

/* ================================================================
   IndexedDB — 用户身份（与 user.js 共用 LunaIdentityDB/identities）
================================================================ */
let _idDb = null;
function openIdentityDB() {
  if (_idDb) return Promise.resolve(_idDb);
  return new Promise((res, rej) => {
    const probe = indexedDB.open('LunaIdentityDB');
    probe.onsuccess = e => {
      const cur = e.target.result;
      const ver = cur.version;
      const has = cur.objectStoreNames.contains('identities');
      cur.close();
      if (has) {
        const req2 = indexedDB.open('LunaIdentityDB', ver);
        req2.onsuccess = e2 => { _idDb = e2.target.result; res(_idDb); };
        req2.onerror   = e2 => rej(e2.target.error);
      } else {
        const req3 = indexedDB.open('LunaIdentityDB', ver + 1);
        req3.onupgradeneeded = e3 => {
          if (!e3.target.result.objectStoreNames.contains('identities'))
            e3.target.result.createObjectStore('identities', { keyPath: 'id' });
        };
        req3.onsuccess = e3 => { _idDb = e3.target.result; res(_idDb); };
        req3.onerror   = e3 => rej(e3.target.error);
      }
    };
    probe.onerror = e => rej(e.target.error);
    probe.onupgradeneeded = e => {
      if (!e.target.result.objectStoreNames.contains('identities'))
        e.target.result.createObjectStore('identities', { keyPath: 'id' });
    };
  });
}
async function getAllIdentities() {
  const db = await openIdentityDB().catch(() => null);
  if (!db) return [];
  if (!db.objectStoreNames.contains('identities')) return [];
  return new Promise(res => {
    const req = db.transaction('identities', 'readonly').objectStore('identities').getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror   = () => res([]);
  });
}

/* ================================================================
   IndexedDB — 心事局存档（本页独立库）
================================================================ */
const XJ_DB_NAME = 'XinshijuDB';
let _xjDb = null;
function openXjDB() {
  if (_xjDb) return Promise.resolve(_xjDb);
  return new Promise((res, rej) => {
    const req = indexedDB.open(XJ_DB_NAME, 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('entries')) {
        const store = db.createObjectStore('entries', { keyPath: 'id', autoIncrement: true });
        store.createIndex('time', 'time', { unique: false });
      }
    };
    req.onsuccess = e => { _xjDb = e.target.result; res(_xjDb); };
    req.onerror   = e => rej(e.target.error);
  });
}
async function xjGetAll() {
  const db = await openXjDB().catch(() => null);
  if (!db) return [];
  return new Promise(res => {
    const req = db.transaction('entries', 'readonly').objectStore('entries').getAll();
    req.onsuccess = () => res((req.result || []).sort((a,b) => (b.time||0) - (a.time||0)));
    req.onerror   = () => res([]);
  });
}
async function xjAdd(item) {
  const db = await openXjDB().catch(() => null);
  if (!db) return null;
  return new Promise(res => {
    const tx = db.transaction('entries', 'readwrite');
    const req = tx.objectStore('entries').add(item);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => res(null);
  });
}
async function xjDelete(id) {
  const db = await openXjDB().catch(() => null);
  if (!db) return;
  return new Promise(res => {
    const tx = db.transaction('entries', 'readwrite');
    tx.objectStore('entries').delete(id);
    tx.oncomplete = res;
  });
}

/* ================================================================
   全局状态
================================================================ */
let _allChars   = [];
let _activeChar  = null;   // 当前选中的角色对象
let _sending     = false;
let _archiveList = [];
let _detailEntry = null;

/* ================================================================
   Toast
================================================================ */
let _toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('xjToast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ================================================================
   角色遴选卷渲染
================================================================ */
async function renderRoster() {
  _allChars = await getAllChars();
  const track = document.getElementById('xjRosterTrack');
  const empty = document.getElementById('xjRosterEmpty');
  const count = document.getElementById('xjRosterCount');

  count.textContent = _allChars.length + ' 位';

  if (!_allChars.length) {
    track.innerHTML = '';
    track.appendChild(empty);
    empty.style.display = '';
    updateActiveCharBar();
    return;
  }
  empty.style.display = 'none';

  // 若尚未选择，默认取 characters.js 中已"应用"的角色，否则取第一位
  if (!_activeChar) {
    const appliedId = parseInt(localStorage.getItem('luna_active_char'));
    _activeChar = _allChars.find(c => c.id === appliedId) || _allChars[0];
  } else {
    // 保持引用同步（防止旧数据）
    const fresh = _allChars.find(c => c.id === _activeChar.id);
    if (fresh) _activeChar = fresh;
  }

  track.innerHTML = _allChars.map(c => {
    const avatar = c.avatar || c.avatarImg || '';
    const initial = escHtml((c.name || '?')[0] || '?');
    const isActive = _activeChar && c.id === _activeChar.id;
    return `
      <div class="xj-roster-card ${isActive ? 'active' : ''}" data-id="${c.id}" onclick="selectChar(${c.id})">
        <div class="xj-roster-seal" style="${avatar ? `background-image:url('${avatar}')` : ''}">
          ${avatar ? '' : initial}
        </div>
        <div class="xj-roster-name">${escHtml(c.name || '未命名')}</div>
      </div>`;
  }).join('');

  updateActiveCharBar();
}

function selectChar(id) {
  const c = _allChars.find(x => x.id === id);
  if (!c) return;
  _activeChar = c;
  document.querySelectorAll('.xj-roster-card').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.id) === id);
  });
  updateActiveCharBar();
}

function updateActiveCharBar() {
  const sealEl = document.getElementById('xjActiveCharSeal');
  const nameEl = document.getElementById('xjActiveCharName');
  if (!_activeChar) {
    sealEl.style.backgroundImage = '';
    sealEl.textContent = '未';
    nameEl.textContent = '未择人';
    return;
  }
  const avatar = _activeChar.avatar || _activeChar.avatarImg || '';
  if (avatar) {
    sealEl.style.backgroundImage = `url('${avatar}')`;
    sealEl.textContent = '';
  } else {
    sealEl.style.backgroundImage = '';
    sealEl.textContent = (_activeChar.name || '?')[0] || '?';
  }
  nameEl.textContent = _activeChar.name || '未命名';
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ================================================================
   Prompt 拼装 —— 角色基本信息 > 世界书 > 用户信息
================================================================ */
async function buildWorldbookPromptForChar(charId) {
  const allEntries = await getAllWbEntries();
  const relevant = allEntries.filter(e => {
    if (e.enabled === false) return false;
    if (e.mode !== 'constant') return false;
    const chars = Array.isArray(e.chars) ? e.chars : [];
    return chars.length === 0 || chars.includes(charId);
  });
  if (!relevant.length) return '';
  relevant.sort((a, b) => (b.priority ?? 5) - (a.priority ?? 5));
  let block = `【世界设定 —— 来自关联世界书，请作为背景真实世界规则遵守，优先级低于角色本身设定】\n`;
  relevant.forEach(e => {
    block += `◆ ${e.title || '未命名'}`;
    if (e.sub) block += `（${e.sub}）`;
    block += `\n${e.detail || ''}\n\n`;
  });
  return block.trim();
}

async function buildUserPrompt() {
  const list = await getAllIdentities();
  if (!list.length) return '';
  const primary = list.find(i => i.isPrimary) || list.find(i => i.active) || list[0];
  if (!primary) return '';

  const lines = [`【用户信息 —— 关于此刻与你对话的人，仅供参考，优先级低于角色设定与世界设定，不得覆盖角色人设】`];
  if (primary.name)        lines.push(`- 称呼/姓名：${primary.name}`);
  if (primary.selfCall)    lines.push(`- 希望被如何称呼：${primary.selfCall}`);
  if (primary.role)        lines.push(`- 身份/角色：${primary.role}`);
  if (primary.gender)      lines.push(`- 性别：${primary.gender}`);
  if (primary.occupation)  lines.push(`- 职业：${primary.occupation}`);
  if (primary.personality) lines.push(`- 性格：${primary.personality}`);
  if (primary.desc)        lines.push(`- 简介：${primary.desc}`);
  if (primary.tags && primary.tags.length)
    lines.push(`- 标签：${primary.tags.map(t => t.text || t).join('、')}`);

  return lines.length > 1 ? lines.join('\n') : '';
}

/* 角色档案页应用角色时已经把 角色prompt+世界书+记忆 拼好存进
   luna_char_prompt；此处若选中的角色恰好是"已应用角色"，优先复用它，
   否则临时现拼（角色 > 世界书 > 用户信息 的顺序）*/
async function buildFullSystemPrompt(c) {
  const appliedId = parseInt(localStorage.getItem('luna_active_char'));
  const cachedPrompt = localStorage.getItem('luna_char_prompt') || '';

  let base;
  if (c.id === appliedId && cachedPrompt) {
    base = cachedPrompt; // 已包含 角色 + 世界书 + 记忆
  } else {
    const worldPrompt = await buildWorldbookPromptForChar(c.id);
    base = c.prompt || '';
    if (worldPrompt) base += `\n\n${worldPrompt}`;
  }

  const userPrompt = await buildUserPrompt();
  if (userPrompt) base += `\n\n${userPrompt}`;

  base += `\n\n【回应格式 —— 请严格遵守，只输出一个 JSON 对象，不要任何 JSON 之外的文字、不要使用 Markdown 代码块包裹】

请以第一人称完全代入角色作答，不进行任何"作为AI助手"式的跳出，不提及"AI""模型""系统"等字眼，不要复述用户的原话。

输出的 JSON 结构如下：
{
  "mood": "此刻回应的整体情绪基调，只能是以下之一：沉郁 / 温柔 / 眷恋 / 释然 / 孤独 / 欣喜",
  "lines": [
    { "text": "正文中的一句话（含标点，一句为一个自然语意单元，不要过长）", "motion": "泡沫上浮" },
    { "text": "……", "motion": "潮水涌入" },
    { "type": "parabreak" },
    { "text": "……", "motion": "缓缓沉降", "heart": "此处对应的一句未说出口的心声，与这句正文形成微妙反差" },
    { "text": "……", "motion": "光丝聚拢" }
  ]
}

关于 lines 数组的规则：
- 依次给出角色回应的每一句话，按朗读顺序排列；一句为一个语意完整的短句，不要把整段话塞进一句
- 每一句都必须指定 "motion"（该句登场时的运动方式），从以下词库中选取，且要依据这句话此刻的情绪与画面感来挑选，同一次回应里应交替使用多种，不要通篇只用一种：
  · 泡沫上浮 —— 适合轻盈、上扬、略带释然或希望的语句
  · 潮水涌入 —— 适合情绪陡然涌起、冲击感强的语句
  · 碎裂聚拢 —— 适合破碎后重新凝聚、纠结后想通的语句
  · 缓缓沉降 —— 适合沉重、迟疑、欲言又止的语句
  · 光丝聚拢 —— 适合温柔、明亮、如告白般郑重的语句
  · 漩涡卷入 —— 适合思绪翻涌、混乱、被往事卷入的语句
- 需要分段落换气的地方，插入一个 { "type": "parabreak" } 项（不需要 text/motion）
- 全部 lines 中 text 字段拼接起来的总字数（不含心声）不得少于500字，需有完整的起承转合，可分3-6段
- 在最能体现角色内心张力的 2-4 句正文上，额外附加 "heart" 字段，写这句表面话语之下角色真正未说出口的心思，语气应与该句正文形成微妙反差；其余句子不需要 heart 字段
- "mood" 请根据整段回应最主要的情绪基调选择，会用于影响整体色调，请如实反映内容基调而非固定选择

【重要 —— 关于唯一性】
即使用户这一次说的话题与以往某次相似甚至完全相同，你也必须视其为一次全新的、独立的倾诉时刻来回应：
- 禁止照搬、复述、或轻微改写你可能"记得"的任何以往回应内容
- 每次都要从不同的切入角度、不同的具体细节、不同的意象与用词重新组织语言，仿佛角色此刻是第一次听见、第一次思考这件事
- 可以调整这次回应的侧重点（例如这次更专注在某个细节、某种回忆、某个具体场景），避免与"标准答案"式的套话雷同
- 具体的比喻、场景描写、心声措辞都应当为此刻重新构思，不要使用模板化或公式化的句子结构`;

  return base;
}

/* ================================================================
   解析 AI 的 JSON 结构化回复 → 渲染单元数组
   兼容：模型偶尔仍返回纯文本、或用 ```json 包裹、或字段缺失的情况
================================================================ */
const MOTION_KEYWORDS = ['泡沫上浮', '潮水涌入', '碎裂聚拢', '缓缓沉降', '光丝聚拢', '漩涡卷入'];
const MOTION_CLASS_MAP = {
  '泡沫上浮': 'xj-motion-bubble-rise',
  '潮水涌入': 'xj-motion-tide-in',
  '碎裂聚拢': 'xj-motion-shatter-form',
  '缓缓沉降': 'xj-motion-slow-sink',
  '光丝聚拢': 'xj-motion-light-gather',
  '漩涡卷入': 'xj-motion-whirl-in'
};
function motionToClass(motion) {
  return MOTION_CLASS_MAP[motion] || 'xj-motion-default';
}

function extractJsonBlock(raw) {
  let t = String(raw || '').trim();
  // 去除可能的 markdown 代码块包裹
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return t.slice(start, end + 1);
}

function parseEchoContent(raw) {
  const jsonStr = extractJsonBlock(raw);
  let parsed = null;
  if (jsonStr) {
    try { parsed = JSON.parse(jsonStr); } catch (e) { parsed = null; }
  }

  // 结构化解析成功
  if (parsed && Array.isArray(parsed.lines)) {
    const mood = typeof parsed.mood === 'string' ? parsed.mood.trim() : '';
    const units = [];
    let anchorSeq = 0;
    parsed.lines.forEach(item => {
      if (!item || typeof item !== 'object') return;
      if (item.type === 'parabreak') { units.push({ type: 'parabreak' }); return; }
      const text = String(item.text || '').trim();
      if (!text) return;
      const motion = MOTION_KEYWORDS.includes(item.motion) ? item.motion : '';
      const unit = { type: 'line', text, motionClass: motionToClass(motion) };
      if (item.heart && String(item.heart).trim()) {
        anchorSeq++;
        unit.heart = String(item.heart).trim();
        unit.anchorId = 'anchor-' + Date.now() + '-' + anchorSeq;
      }
      units.push(unit);
    });
    return { mood: mood || '', units };
  }

  // 兜底：模型未按 JSON 格式返回，退化为纯文本句子切分，使用默认运动
  const text = String(raw || '').trim();
  const cleaned = text.replace(/\[心声\]([\s\S]*?)\[\/心声\]/g, ''); // 防止旧格式泄露
  const paras = cleaned.split(/\n+/).map(p => p.trim()).filter(Boolean);
  const units = [];
  paras.forEach((para, pi) => {
    const pieces = para.match(/[^。！？；\n]+[。！？；]?/g) || [para];
    pieces.forEach(piece => {
      const t = piece.trim();
      if (t) units.push({ type: 'line', text: t, motionClass: 'xj-motion-default' });
    });
    if (pi < paras.length - 1) units.push({ type: 'parabreak' });
  });
  return { mood: '', units };
}

/* 统计正文（不含心声）字数，用于校验是否达到 500 字要求 */
function countBodyChars(units) {
  return units
    .filter(u => u.type === 'line')
    .reduce((sum, u) => sum + Array.from(u.text).length, 0);
}

/* ================================================================
   API 调用 —— 复用 settings.js 中保存的 luna_api_current / luna_api_model
================================================================ */
async function callAIRaw(systemPrompt, messages) {
  const cfg = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  const baseUrl = (cfg.baseUrl || '').replace(/\/$/, '');
  const apiKey = cfg.apiKey || '';

  if (!baseUrl || !apiKey || !model) {
    throw new Error('尚未配置 API，请前往「设置」完成接口与模型配置');
  }

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 2600,
      temperature: 1.0,
      presence_penalty: 0.35,
      frequency_penalty: 0.15
    })
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`接口返回 ${resp.status}${t ? '：' + t.slice(0,120) : ''}`);
  }
  const data = await resp.json();
  const reply = data.choices?.[0]?.message?.content;
  if (!reply) throw new Error('未获得有效回应内容');
  return reply.trim();
}

/* 生成一个不可见的随机化标记，随请求一同发送，确保接口不会因输入完全相同
   而返回缓存/固定的回复；同时在 system 层面提示这是新的独立时刻 */
function buildNonceHint() {
  const now = new Date();
  const stamp = now.toLocaleString('zh-CN', { hour12: false });
  const rand = Math.random().toString(36).slice(2, 10);
  return `[此刻独立标记 · 请勿参考任何以往回应 · 时间:${stamp} · 随机种子:${rand}]`;
}

/* 调用 AI 并确保正文（不含心声）达到最低字数要求，不足则追加一次续写/重写请求 */
async function callAI(systemPrompt, userText) {
  const MIN_CHARS = 500;
  const userContent = `${userText}\n\n${buildNonceHint()}`;
  let messages = [{ role: 'user', content: userContent }];
  let reply = await callAIRaw(systemPrompt, messages);
  let parsedResult = parseEchoContent(reply);

  let attempts = 0;
  while (countBodyChars(parsedResult.units) < MIN_CHARS && attempts < 2) {
    attempts++;
    messages = [
      { role: 'user', content: userContent },
      { role: 'assistant', content: reply },
      { role: 'user', content: `刚才的 JSON 回应中 lines 里 text 拼接起来的总字数不够，请严格保持同样的 JSON 结构、同样人设与语气，重新输出一版，确保正文总字数不少于500字，段落更充分地展开，依然只输出 JSON 本身。` }
    ];
    reply = await callAIRaw(systemPrompt, messages);
    parsedResult = parseEchoContent(reply);
  }
  return { raw: reply, mood: parsedResult.mood, units: parsedResult.units };
}

/* ================================================================
   输入框自适应高度 + 计数
================================================================ */
function bindInputAutosize() {
  const ta = document.getElementById('xjInput');
  const countEl = document.getElementById('xjInputCount');
  ta.addEventListener('input', () => {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    countEl.textContent = ta.value.length + ' / 2000';
  });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      submitEntry();
    }
  });
}

/* ================================================================
   深潜对象选择：抽屉展示全部角色，点击即切换 _activeChar
================================================================ */
async function openDiverPicker() {
  _allChars = await getAllChars();
  const grid = document.getElementById('xjDiverGrid');
  document.getElementById('xjDiverCount').textContent = _allChars.length;

  if (!_allChars.length) {
    grid.innerHTML = `<div class="xj-diver-empty">尚未创建任何角色 · 请先前往角色页新建</div>`;
  } else {
    if (!_activeChar) {
      const appliedId = parseInt(localStorage.getItem('luna_active_char'));
      _activeChar = _allChars.find(c => c.id === appliedId) || _allChars[0];
    }
    grid.innerHTML = _allChars.map(c => {
      const avatar = c.avatar || c.avatarImg || '';
      const initial = escHtml((c.name || '?')[0] || '?');
      const isActive = _activeChar && c.id === _activeChar.id;
      return `
        <div class="xj-diver-card ${isActive ? 'active' : ''}" data-id="${c.id}" onclick="pickDiver(${c.id})">
          <div class="xj-diver-card-seal" style="${avatar ? `background-image:url('${avatar}')` : ''}">${avatar ? '' : initial}</div>
          <div class="xj-diver-card-name">${escHtml(c.name || '未命名')}</div>
        </div>`;
    }).join('');
  }
  document.getElementById('xjDiverMask').classList.add('show');
}
function closeDiverPicker(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('xjDiverMask').classList.remove('show');
}
function pickDiver(id) {
  const c = _allChars.find(x => x.id === id);
  if (!c) return;
  _activeChar = c;
  updateDiverBar();
  document.querySelectorAll('.xj-diver-card').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.id) === id);
  });
  setTimeout(closeDiverPicker, 180);
}
function updateDiverBar() {
  const bar = document.getElementById('xjDiverBar');
  const seal = document.getElementById('xjDiverSeal');
  const nameEl = document.getElementById('xjDiverName');
  if (!_activeChar) { bar.style.display = 'none'; return; }
  bar.style.display = 'inline-flex';
  const avatar = _activeChar.avatar || _activeChar.avatarImg || '';
  if (avatar) {
    seal.style.backgroundImage = `url('${avatar}')`;
    seal.textContent = '';
  } else {
    seal.style.backgroundImage = '';
    seal.textContent = (_activeChar.name || '?')[0] || '?';
  }
  nameEl.textContent = _activeChar.name || '未命名';
}

/* ================================================================
   提交心事 · 用户原文碎散入海 → 调用 AI(JSON结构化) → 沉浸回响舞台渲染
   —— 无对话气泡、无打字机效果：AI 自行为每句指定"运动方式"，
   前端据此从运动指令词典中取用对应动画，逐句在画布中显影铺陈；
   心声默认隐藏于锚点词之下，点击才浮现，可再次点击收起。
================================================================ */
async function submitEntry() {
  if (_sending) return;
  const ta = document.getElementById('xjInput');
  const text = ta.value.trim();
  if (!text) { shakeInput(); return; }

  if (!_activeChar) {
    _allChars = await getAllChars();
    if (_allChars && _allChars.length) {
      const appliedId = parseInt(localStorage.getItem('luna_active_char'));
      _activeChar = _allChars.find(c => c.id === appliedId) || _allChars[0];
      updateDiverBar();
    } else {
      showToast('请先前往角色页创建一位角色，才能沉入对话');
      return;
    }
  }

  _sending = true;
  const sendBtn = document.getElementById('xjSendBtn');
  sendBtn.classList.add('sending');

  const stage = document.getElementById('xjStage');
  const abyss = document.getElementById('xjAbyss');
  const canvas = document.getElementById('xjEchoCanvas');

  // 原文碎散入海：先在原输入位置生成逐字飘散层，再让整个书写空间淡出
  scatterTextIntoSea(text);
  // 长驻漂浮层：部分文字持续悬浮于深海背景中，直到 AI 回应抵达才退场
  const driftLayer = spawnPersistentDrift(text);
  ta.value = '';
  ta.style.height = 'auto';
  document.getElementById('xjInputCount').textContent = '0 / 2000';

  abyss.classList.add('dissolving');
  await wait(650);
  abyss.classList.remove('dissolving');
  stage.classList.remove('awake');

  // 进入沉浸回响舞台
  canvas.innerHTML = '';
  stage.classList.add('reading');

  const avatar = _activeChar.avatar || _activeChar.avatarImg || '';
  const summonWrap = document.createElement('div');
  summonWrap.className = 'xj-summon-wrap';
  summonWrap.innerHTML = `
    <div class="xj-echo-summon">
      <div class="xj-summon-ring"></div>
      <div class="xj-summon-ring"></div>
      <div class="xj-summon-ring"></div>
      <div class="xj-summon-threads"></div>
      <div class="xj-summon-core"></div>
    </div>
    <div class="xj-echo-summon-label">回响正从深处浮起</div>
  `;
  canvas.appendChild(summonWrap);
  spawnSummonThreads(summonWrap.querySelector('.xj-echo-summon'));

  let result = null;
  let errorMsg = '';
  try {
    const systemPrompt = await buildFullSystemPrompt(_activeChar);
    result = await callAI(systemPrompt, text);
  } catch (e) {
    errorMsg = e.message || '生成失败，请稍后再试';
  }

  summonWrap.remove();

  if (errorMsg) {
    dismissDriftLayer(driftLayer, false);
    const errEl = document.createElement('div');
    errEl.className = 'xj-echo-error';
    errEl.textContent = `◆ 回响未能浮起 —— ${errorMsg}`;
    canvas.appendChild(errEl);
    showToast(errorMsg);
  } else {
    dismissDriftLayer(driftLayer, true);
    const field = document.createElement('div');
    field.className = 'xj-echo-field';
    field.dataset.mood = result.mood || '';
    field.innerHTML = `
      <div class="xj-echo-meta">
        <div class="xj-echo-seal-mini" style="${avatar ? `background-image:url('${avatar}');background-size:cover;background-position:center;` : ''}">${avatar ? '' : escHtml((_activeChar.name||'?')[0]||'?')}</div>
        <div class="xj-echo-name">${escHtml(_activeChar.name || '未命名')}</div>
        <div class="xj-echo-time">${nowStamp()}</div>
      </div>
      <div class="xj-echo-paper" id="echoPaper-${Date.now()}"></div>
    `;
    canvas.appendChild(field);
    const paperEl = field.querySelector('.xj-echo-paper');

    await renderEchoUnits(paperEl, result.units, canvas);

    const closeEl = document.createElement('div');
    closeEl.className = 'xj-echo-close';
    closeEl.title = '按住片刻，让这段心事静静沉入信匣';
    closeEl.innerHTML = `<span class="xj-echo-close-mark"></span><span class="xj-echo-close-text">回响已沉入水面之下 · 点击微光字词可听见未说出口的话</span><span class="xj-echo-close-progress"></span>`;
    field.appendChild(closeEl);
    canvas.scrollTop = canvas.scrollHeight;

    // 存档（保存原始 JSON 文本，供详情页还原结构化渲染）— 生成即自动存入信匣
    const record = {
      time: Date.now(),
      charId: _activeChar.id,
      charName: _activeChar.name || '未命名',
      avatar: avatar || '',
      question: text,
      answer: result.raw,
      mood: result.mood || ''
    };
    await xjAdd(record);
    refreshArchiveBadge();

    // 隐藏交互：长按落款处蓄力，触发全篇文字消散沉入海底的封存仪式
    bindArchiveDismissGesture(closeEl, field, canvas);
  }

  sendBtn.classList.remove('sending');
  _sending = false;
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ================================================================
   隐藏交互：长按回响落款 —— 蓄力约 900ms 后，触发整篇回响的
   "文字消散、沉入海底" 封存动画，动画结束后自动浮回水面。
   这是一个不常见的操作点：不写明按钮文字提示"长按"，
   只在按住时才逐渐显露蓄力反馈（呼吸光点 + 进度细线），
   松开过早则蓄力归零、无事发生。
================================================================ */
function bindArchiveDismissGesture(closeEl, fieldEl, canvasEl) {
  const HOLD_MS = 900;
  const progressEl = closeEl.querySelector('.xj-echo-close-progress');
  let holdTimer = null;
  let startTs = 0;
  let raf = null;
  let triggered = false;

  function tickProgress() {
    if (!startTs) return;
    const elapsed = performance.now() - startTs;
    const pct = Math.min(100, (elapsed / HOLD_MS) * 100);
    if (progressEl) progressEl.style.width = pct + '%';
    if (pct < 100) {
      raf = requestAnimationFrame(tickProgress);
    }
  }

  function startHold(e) {
    if (triggered) return;
    startTs = performance.now();
    closeEl.classList.add('charging');
    raf = requestAnimationFrame(tickProgress);
    holdTimer = setTimeout(() => {
      triggered = true;
      closeEl.classList.remove('charging');
      performArchiveDissolve(fieldEl, canvasEl);
    }, HOLD_MS);
  }

  function cancelHold() {
    if (triggered) return;
    clearTimeout(holdTimer);
    cancelAnimationFrame(raf);
    startTs = 0;
    closeEl.classList.remove('charging');
    if (progressEl) progressEl.style.width = '0%';
  }

  closeEl.addEventListener('pointerdown', startHold);
  closeEl.addEventListener('pointerup', cancelHold);
  closeEl.addEventListener('pointerleave', cancelHold);
  closeEl.addEventListener('pointercancel', cancelHold);
}

/* 执行封存消散动画：field 内每一行/每个心声浮层各自赋予随机方向的
   下沉参数，制造"逐字先后碎散沉没"的错落感；动画结束后提示已封存，
   并引导回到待命核心（浮回水面）。*/
function performArchiveDissolve(fieldEl, canvasEl) {
  const lineEls = Array.from(fieldEl.querySelectorAll('.xj-echo-line, .xj-heart-pop, .xj-echo-meta'));
  lineEls.forEach((el, i) => {
    el.style.setProperty('--flsx', (Math.random() * 50 - 25).toFixed(1) + 'px');
    el.style.setProperty('--flsy', (70 + Math.random() * 90).toFixed(1) + 'px');
    el.style.setProperty('--flsrot', (Math.random() * 30 - 15).toFixed(1) + 'deg');
    el.style.setProperty('--flsdur', (0.8 + Math.random() * 0.5).toFixed(2) + 's');
    el.style.setProperty('--flsdelay', (i * 0.028).toFixed(3) + 's');
  });

  fieldEl.classList.add('archiving');

  const toast = document.createElement('div');
  toast.className = 'xj-archive-confirm-toast';
  toast.textContent = '◆ 已静静封存于信匣深处';
  fieldEl.appendChild(toast);

  const totalMs = lineEls.length * 28 + 1300;
  setTimeout(() => {
    surfaceFromEcho();
    showToast('这段心事已收入信匣');
  }, totalMs);
}

function nowStamp() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function shakeInput() {
  const bar = document.querySelector('.xj-abyss-field');
  if (!bar) return;
  bar.style.animation = 'none';
  void bar.offsetWidth;
  bar.style.animation = 'xjShake 0.4s ease';
}
if (!document.getElementById('xjShakeKeyframe')) {
  const st = document.createElement('style');
  st.id = 'xjShakeKeyframe';
  st.textContent = `@keyframes xjShake { 0%,100%{transform:translateX(0);} 25%{transform:translateX(-6px);} 75%{transform:translateX(6px);} }`;
  document.head.appendChild(st);
}

/* ================================================================
   用户原文碎散入海：分两段进行——
   1) 起手飞散：文字从输入处炸开，作为提交的即时反馈（沿用原有效果）
   2) 长驻漂浮：抽取原文部分字符，作为背景中持续漂浮的碎字微光，
      不会自行消失，会一直悬浮在深海中，直到 AI 回应抵达才引导它们
      "聚拢退场"（成功）或"沉没消散"（失败），呼应「文字仍在深海漂浮
      直到被听见」的意象。
================================================================ */
function scatterTextIntoSea(text) {
  const layer = document.createElement('div');
  layer.className = 'xj-scatter-layer';
  document.body.appendChild(layer);

  const chars = Array.from(text).filter(c => c.trim());
  const maxChars = 140; // 过长文本仅取样呈现，避免过度拥挤
  const sample = chars.length > maxChars
    ? chars.filter((_, i) => i % Math.ceil(chars.length / maxChars) === 0)
    : chars;

  sample.forEach((ch, i) => {
    const g = document.createElement('span');
    g.className = 'xj-scatter-glyph';
    g.textContent = ch;
    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 120;
    g.style.setProperty('--sx', (Math.cos(angle) * dist).toFixed(1) + 'px');
    g.style.setProperty('--sy', (100 + Math.random() * 160).toFixed(1) + 'px');
    g.style.setProperty('--srot', (Math.random() * 60 - 30).toFixed(1) + 'deg');
    g.style.setProperty('--sscale', (0.4 + Math.random() * 0.4).toFixed(2));
    g.style.setProperty('--sdur', (2 + Math.random() * 1.4).toFixed(2) + 's');
    g.style.setProperty('--sdelay', (i * 0.012).toFixed(3) + 's');
    layer.appendChild(g);
  });

  setTimeout(() => layer.remove(), 4200);
}

/* 长驻漂浮层：从原文中抽样字符，随机撒在画面各处持续漂浮（不会自动消失）。
   返回该层元素，调用方在 AI 回应抵达后调用 dismissDriftLayer() 令其退场。 */
function spawnPersistentDrift(text) {
  const layer = document.createElement('div');
  layer.className = 'xj-drift-layer';
  layer.id = 'xjDriftLayer-' + Date.now();
  document.body.appendChild(layer);

  const chars = Array.from(text).filter(c => c.trim());
  const maxGlyphs = 26; // 长驻漂浮不宜过密，取样即可
  const sample = chars.length > maxGlyphs
    ? chars.filter((_, i) => i % Math.ceil(chars.length / maxGlyphs) === 0)
    : chars;

  sample.forEach((ch, i) => {
    const g = document.createElement('span');
    g.className = 'xj-drift-glyph';
    g.textContent = ch;
    g.style.left = (6 + Math.random() * 88) + '%';
    g.style.top = (10 + Math.random() * 76) + '%';
    g.style.setProperty('--dfop', (0.28 + Math.random() * 0.34).toFixed(2));
    g.style.setProperty('--dfx', (Math.random() * 26 - 13).toFixed(1) + 'px');
    g.style.setProperty('--dfy', (Math.random() * -30 - 10).toFixed(1) + 'px');
    g.style.setProperty('--dfrot', (Math.random() * 14 - 7).toFixed(1) + 'deg');
    g.style.setProperty('--dfdur', (5 + Math.random() * 5).toFixed(2) + 's');
    g.style.setProperty('--dfdelay', (i * 0.05 + Math.random() * 0.4).toFixed(3) + 's');
    layer.appendChild(g);
  });

  return layer;
}

/* 长驻漂浮层退场：success=true 时每个字向中心聚拢消失（呼应回响升起）；
   否则向下碎散沉没（呼应生成失败/放弃） */
function dismissDriftLayer(layer, success) {
  if (!layer || !layer.isConnected) return;
  const glyphs = layer.querySelectorAll('.xj-drift-glyph');
  const cx = window.innerWidth / 2, cy = window.innerHeight * 0.4;
  glyphs.forEach((g, i) => {
    const rect = g.getBoundingClientRect();
    if (success) {
      // 聚拢：朝画面中上方向汇集后淡出
      g.style.setProperty('--ddx', ((cx - rect.left) * 0.7).toFixed(1) + 'px');
      g.style.setProperty('--ddy', ((cy - rect.top) * 0.7).toFixed(1) + 'px');
      g.style.setProperty('--ddrot', (Math.random() * 30 - 15).toFixed(1) + 'deg');
    } else {
      // 沉没：向下碎散
      g.style.setProperty('--ddx', (Math.random() * 40 - 20).toFixed(1) + 'px');
      g.style.setProperty('--ddy', (80 + Math.random() * 90).toFixed(1) + 'px');
      g.style.setProperty('--ddrot', (Math.random() * 40 - 20).toFixed(1) + 'deg');
    }
    g.style.animationDelay = (i * 0.02) + 's, 0s';
    g.classList.add('dismiss');
  });
  setTimeout(() => layer.remove(), 1300);
}

/* 生成中态：声呐光丝，随机角度与相位 */
function spawnSummonThreads(summonEl) {
  const holder = summonEl.querySelector('.xj-summon-threads');
  if (!holder) return;
  const count = 8;
  for (let i = 0; i < count; i++) {
    const t = document.createElement('div');
    t.className = 'xj-summon-thread';
    const angle = (360 / count) * i + (Math.random() * 14 - 7);
    t.style.setProperty('--ta', angle + 'deg');
    t.style.animationDuration = (1.4 + Math.random() * 0.9) + 's';
    t.style.animationDelay = (-Math.random() * 1.8) + 's';
    holder.appendChild(t);
  }
}

/* ================================================================
   核心渲染：逐句将 JSON 生成的 units 显影到画布
   —— 每个 line 单元依据 AI 指定的 motionClass 播放对应入场动画
   —— 带 heart 的句子渲染为可点击锚点，默认呼吸微光，点击后就地
      展开一段"飘散状"的心声浮层（运动方式区别于正文的聚焦显形）
================================================================ */
async function renderEchoUnits(paperEl, units, canvas) {
  const motesLayer = document.createElement('div');
  motesLayer.className = 'xj-echo-motes-layer';
  paperEl.appendChild(motesLayer);
  const moteTimer = setInterval(() => spawnEchoMote(motesLayer), 460);

  for (let idx = 0; idx < units.length; idx++) {
    const unit = units[idx];

    if (unit.type === 'parabreak') {
      const brk = document.createElement('span');
      brk.className = 'xj-echo-parabreak';
      paperEl.insertBefore(brk, motesLayer);
      await wait(200);
      continue;
    }

    const wrapEl = document.createElement('span');
    wrapEl.className = 'xj-echo-line in';

    const motionEl = document.createElement('span');
    motionEl.className = unit.motionClass || 'xj-motion-default';
    // 为部分动效随机化方向参数，使同一motion在多次出现时仍有细微差异
    randomizeMotionVars(motionEl, unit.motionClass);

    if (unit.heart) {
      const anchor = document.createElement('span');
      anchor.className = 'xj-anchor';
      anchor.textContent = unit.text;
      anchor.dataset.heart = unit.heart;
      anchor.dataset.anchorId = unit.anchorId;
      anchor.setAttribute('role', 'button');
      anchor.setAttribute('aria-label', '点击听见心声');
      anchor.onclick = () => toggleHeart(anchor, wrapEl);
      motionEl.appendChild(anchor);
    } else {
      motionEl.textContent = unit.text;
    }

    wrapEl.appendChild(motionEl);
    paperEl.insertBefore(wrapEl, motesLayer);
    canvas.scrollTop = canvas.scrollHeight;

    // 依据句子长度与末尾标点决定停顿，形成呼吸感的整体节奏
    const lastCh = unit.text[unit.text.length - 1];
    const isPunct = /[，。！？；：、]/.test(lastCh);
    const baseWait = 520 + Math.min(unit.text.length * 22, 480);
    await wait(baseWait);
    await wait((isPunct ? 220 : 90) + Math.random() * 160);
  }

  clearInterval(moteTimer);
  setTimeout(() => motesLayer.remove(), 900);
}

/* 为不同运动类型注入随机化的方向/角度变量，避免同类动效机械重复 */
function randomizeMotionVars(el, motionClass) {
  switch (motionClass) {
    case 'xj-motion-tide-in':
      el.style.setProperty('--tidefrom', (Math.random() < 0.5 ? -1 : 1) * (36 + Math.random() * 26) + 'px');
      break;
    case 'xj-motion-shatter-form':
      el.style.setProperty('--shx', (Math.random() * 36 - 18) + 'px');
      el.style.setProperty('--shy', (Math.random() * 30 - 22) + 'px');
      el.style.setProperty('--shrot', (Math.random() * 24 - 12) + 'deg');
      break;
    case 'xj-motion-whirl-in':
      el.style.setProperty('--wrot', (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 26) + 'deg');
      el.style.setProperty('--wx', (Math.random() * 30 - 15) + 'px');
      el.style.setProperty('--wy', (Math.random() * 16 - 4) + 'px');
      break;
  }
}

/* 心声开合：点击锚点词，在其后就地插入/移除一段心声浮层，
   浮层内附带若干微粒漂移动画，运动语言与正文的"聚焦显形"明显区分 */
function toggleHeart(anchor, wrapEl) {
  const existing = wrapEl.parentElement.querySelector(`.xj-heart-pop[data-for="${anchor.dataset.anchorId}"]`);
  if (existing) {
    anchor.classList.remove('opened');
    sinkHeartPop(existing);
    return;
  }

  // 关闭画布中其它已展开的心声，保持同一时刻只专注一处
  document.querySelectorAll('.xj-anchor.opened').forEach(a => {
    if (a === anchor) return;
    a.classList.remove('opened');
  });
  document.querySelectorAll('.xj-heart-pop:not(.sinking)').forEach(h => {
    sinkHeartPop(h);
  });

  anchor.classList.add('opened');
  const pop = document.createElement('span');
  pop.className = 'xj-heart-pop';
  pop.dataset.for = anchor.dataset.anchorId;

  const tag = document.createElement('span');
  tag.className = 'xj-heart-pop-tag';
  tag.textContent = '心声';
  pop.appendChild(tag);

  const body = document.createElement('span');
  body.className = 'xj-heart-body';
  pop.appendChild(body);

  // 逐字构造：每个字独立从四周碎粒状汇聚显影，形成"散落汇聚"的显影感
  const glyphs = Array.from(String(anchor.dataset.heart || ''));
  glyphs.forEach((ch, i) => {
    const g = document.createElement('span');
    g.className = 'xj-heart-glyph';
    g.textContent = ch;
    const angle = Math.random() * Math.PI * 2;
    const dist = 14 + Math.random() * 30;
    g.style.setProperty('--hgx', (Math.cos(angle) * dist).toFixed(1) + 'px');
    g.style.setProperty('--hgy', (Math.sin(angle) * dist - 6).toFixed(1) + 'px');
    g.style.setProperty('--hgrot', (Math.random() * 50 - 25).toFixed(1) + 'deg');
    g.style.setProperty('--hgscale', (1.3 + Math.random() * 0.5).toFixed(2));
    g.style.setProperty('--hgdur', (0.5 + Math.random() * 0.3).toFixed(2) + 's');
    g.style.setProperty('--hgdelay', (0.12 + i * 0.026).toFixed(3) + 's');
    body.appendChild(g);
  });

  // 附带 3-5 枚漂移微粒
  const driftCount = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < driftCount; i++) {
    const d = document.createElement('span');
    d.className = 'xj-heart-drift';
    d.style.left = (10 + Math.random() * 80) + '%';
    d.style.top = (20 + Math.random() * 60) + '%';
    d.style.setProperty('--hdx', (Math.random() * 16 - 8) + 'px');
    d.style.setProperty('--hdy', (Math.random() * -16 - 4) + 'px');
    d.style.animationDelay = (Math.random() * 1.2) + 's';
    pop.appendChild(d);
  }

  wrapEl.insertAdjacentElement('afterend', pop);
  const canvas = document.getElementById('xjEchoCanvas');
  if (canvas) {
    const popRect = pop.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    if (popRect.bottom > canvasRect.bottom) {
      canvas.scrollTop += (popRect.bottom - canvasRect.bottom) + 20;
    }
  }
}

/* 心声收起：逐字重新碎散，各自带不同方向/速度下沉，呼应"潜入深海"的整体语言 */
function sinkHeartPop(pop) {
  if (!pop || pop.classList.contains('sinking')) return;
  pop.classList.add('sinking');
  const glyphs = pop.querySelectorAll('.xj-heart-glyph');
  glyphs.forEach((g, i) => {
    g.style.setProperty('--hsx', (Math.random() * 30 - 15).toFixed(1) + 'px');
    g.style.setProperty('--hsy', (50 + Math.random() * 50).toFixed(1) + 'px');
    g.style.setProperty('--hsrot', (Math.random() * 50 - 25).toFixed(1) + 'deg');
    g.style.setProperty('--hsscale', (0.4 + Math.random() * 0.3).toFixed(2));
    g.style.setProperty('--hsdur', (0.6 + Math.random() * 0.35).toFixed(2) + 's');
    g.style.setProperty('--hsdelay', (i * 0.018).toFixed(3) + 's');
  });
  const totalDelay = glyphs.length * 18 + 850;
  setTimeout(() => pop.remove(), totalDelay);
}

function spawnEchoMote(layer) {
  if (!layer.isConnected) return;
  const m = document.createElement('div');
  m.className = 'xj-echo-mote-p';
  const size = 2 + Math.random() * 3;
  m.style.width = size + 'px';
  m.style.height = size + 'px';
  m.style.left = (Math.random() * 96) + '%';
  m.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
  layer.appendChild(m);
  setTimeout(() => m.remove(), 3200);
}

/* ================================================================
   信匣 · 深海漂浮档案
   —— 每一函以一行散落漂浮的碎字呈现（取回响正文摘要），字与字
      不再自由环绕折行，而是排成一行、逐字明灭，避免交叠成一团；
      触碰后整行文字停止漂浮并汇聚成清晰的一句，随后浮起过渡到
      信函详情。每次打开信匣都会重新构建，因此任意一函都可反复查看。
================================================================ */
let _archiveBgSpawned = false;
function spawnArchiveBackground() {
  if (_archiveBgSpawned) return;
  _archiveBgSpawned = true;
  spawnMotesInto('xjArchiveMotes');
  spawnJelliesInto('xjArchiveJellies', 3);
  spawnFishesInto('xjArchiveFishes', 4);
  spawnBubblesInto('xjArchiveBubbles');
}
let _detailBgSpawned = false;
function spawnDetailBackground() {
  if (_detailBgSpawned) return;
  _detailBgSpawned = true;
  spawnMotesInto('xjDetailMotes');
  spawnJelliesInto('xjDetailJellies', 2);
  spawnFishesInto('xjDetailFishes', 3);
  spawnBubblesInto('xjDetailBubbles');
}

async function openArchive() {
  document.getElementById('xjArchiveMask').classList.add('show');
  spawnArchiveBackground();
  await refreshArchiveList();
}
function closeArchive() {
  document.getElementById('xjArchiveMask').classList.remove('show');
}

/* 从存档的 JSON 结构（或兜底纯文本）中提取用于漂浮呈现的一段摘要纯文字 */
function extractPreviewText(rawAnswer) {
  const { units } = parseEchoContent(rawAnswer);
  const text = units.filter(u => u.type === 'line').map(u => u.text).join('').replace(/\s+/g, ' ').trim();
  return text.length > 26 ? text.slice(0, 26) + '……' : text;
}

async function refreshArchiveList() {
  _archiveList = await xjGetAll();
  _archiveList.sort((a, b) => b.time - a.time);
  const seaEl = document.getElementById('xjArchiveSea');
  document.getElementById('xjArchiveTotal').textContent = _archiveList.length;
  seaEl.innerHTML = '';

  if (!_archiveList.length) {
    seaEl.innerHTML = `<div class="xj-archive-empty">此匣尚空 · 信函寄出后将自动漂沉于此</div>`;
    return;
  }

  _archiveList.forEach(entry => {
    const avatar = entry.avatar || '';
    const initial = escHtml((entry.charName || '?')[0] || '?');
    const d = new Date(entry.time);
    const timeStr = `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    const text = extractPreviewText(entry.answer);

    // 每次重新渲染都是全新的 DOM 节点，不存在"只能查看一次"的残留状态
    const wrap = document.createElement('div');
    wrap.className = 'xj-archive-drift-entry';
    wrap.dataset.id = entry.id;

    wrap.innerHTML = `
      <div class="xj-archive-drift-meta">
        <div class="xj-archive-drift-seal" style="${avatar ? `background-image:url('${avatar}')` : ''}">${avatar ? '' : initial}</div>
        <div class="xj-archive-drift-time">${timeStr}</div>
      </div>
      <div class="xj-archive-drift-glyphs"></div>
    `;
    seaEl.appendChild(wrap);

    const glyphHolder = wrap.querySelector('.xj-archive-drift-glyphs');
    const chars = Array.from(text);
    chars.forEach(ch => {
      const g = document.createElement('span');
      g.className = 'xj-archive-glyph';
      g.textContent = ch === '\n' ? ' ' : ch;
      // 深度错落：每字独立的基线不透明度/模糊，越"深"越淡越虚，
      // 但只作用于纵向轻微浮动与明灭，不再做水平位移，避免相互侵入
      const localDepth = 0.32 + Math.random() * 0.5;
      g.style.setProperty('--ago', localDepth.toFixed(2));
      g.style.setProperty('--ablur', (1.3 - localDepth * 1.1).toFixed(2) + 'px');
      g.style.setProperty('--ady', (Math.random() * 4 - 2).toFixed(1) + 'px');
      g.style.setProperty('--afdur', (2.6 + Math.random() * 2.6).toFixed(2) + 's');
      g.style.setProperty('--afdelay', (-Math.random() * 4).toFixed(2) + 's');
      glyphHolder.appendChild(g);
    });

    wrap.addEventListener('click', () => gatherArchiveEntry(wrap, entry.id));
  });
}

/* 点触碎字行：先汇聚成句，短暂静置令其可读，再整行浮起消散，过渡到信函详情 */
function gatherArchiveEntry(wrap, id) {
  if (wrap.classList.contains('gathering')) return;
  wrap.classList.add('gathering');
  setTimeout(() => {
    wrap.classList.add('risen');
    setTimeout(() => openDetail(id), 460);
  }, 620);
}

function refreshArchiveBadge() {
  xjGetAll().then(list => {
    const dot = document.getElementById('xjArchiveDot');
    dot.style.display = list.length ? '' : 'none';
    const sc = document.getElementById('xjSessionCount');
    sc.textContent = `第${cnNum(list.length)}函`;
  });
}

const CN_DIGITS = ['〇','一','二','三','四','五','六','七','八','九'];
function cnNum(n) {
  if (n <= 0) return '〇';
  if (n < 10) return CN_DIGITS[n];
  if (n < 100) {
    const tens = Math.floor(n/10), ones = n%10;
    return (tens === 1 ? '十' : CN_DIGITS[tens] + '十') + (ones ? CN_DIGITS[ones] : '');
  }
  return String(n);
}

/* ================================================================
   信函详情 —— 全屏深海显影
   打开时：先让问句原文如当初"投入深海"般碎散于画面中央，
   碎字循光汇聚归位成一段引句；随后回响正文以与主舞台完全相同的
   排版（xj-echo-field / xj-echo-paper / xj-anchor 心声锚点）静置显影。
================================================================ */
async function openDetail(id) {
  const entry = _archiveList.find(e => e.id === id);
  if (!entry) return;
  _detailEntry = entry;

  document.getElementById('xjDetailTitle').textContent = entry.charName || '未命名';
  const body = document.getElementById('xjDetailBody');
  const d = new Date(entry.time);
  const timeStr = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

  const { mood, units } = parseEchoContent(entry.answer || '');
  const questionText = entry.question || '';
  const hasHeart = units.some(u => u.heart);

  body.innerHTML = `
    <div class="xj-detail-question-wrap">
      <div class="xj-detail-question-hint" id="detailQuestionHint">深处漂着零落的字迹 · 逐一触碰，将其拾回原位</div>
      <div class="xj-detail-question" id="detailQuestion"></div>
    </div>
    <div class="xj-echo-field" id="detailEchoField" data-mood="${escHtml(mood || '')}" style="min-height:auto; padding:6px 22px 40px; display:none;">
      <div class="xj-echo-meta" style="opacity:1; animation:none;">
        <div class="xj-echo-seal-mini" style="${entry.avatar ? `background-image:url('${entry.avatar}');background-size:cover;background-position:center;` : ''}">${entry.avatar ? '' : escHtml((entry.charName||'?')[0]||'?')}</div>
        <div class="xj-echo-name">${escHtml(entry.charName || '未命名')}</div>
        <div class="xj-echo-time">${timeStr}</div>
      </div>
      <div class="xj-echo-paper" id="detailPaper"></div>
      ${hasHeart ? `<div class="xj-detail-heart-hint" id="detailHeartHint"><span class="xj-detail-heart-hint-dot"></span>字里有微光闪动之处，藏着一句未说出口的心声，触碰即可听见</div>` : ''}
    </div>
  `;

  document.getElementById('xjDetailMask').classList.add('show');
  spawnDetailBackground();

  const paperEl = document.getElementById('detailPaper');
  const canvasEl = document.getElementById('xjDetailBody');
  const echoField = document.getElementById('detailEchoField');

  // 问句先以散字形式漂浮于深海中，需用户逐字触碰拾回，方能拼出原句；
  // 待问句被完整拾回后，回响正文才以与主舞台完全相同的运动方式逐句浮现
  await scatterFloatQuestion(questionText);

  echoField.style.display = '';
  await wait(160);
  await renderEchoUnits(paperEl, units, canvasEl);

  const hint = document.getElementById('detailHeartHint');
  if (hint) {
    hint.classList.add('in');
  }
}

/* 问句散字漂浮：不再自动归位，而是将问句拆成字，随机散落漂浮于
   详情页画面各处（xj-detail-scatter-layer 内，绝对定位，持续飘荡）。
   用户需要逐一点触每个散落的字，令其飞回引句该字所在的位置并"落定"；
   全部拾回后，引句区域整体点亮，Promise 才 resolve，继续渲染正文。
   若原文过长，仅取样部分字符参与"拾取"玩法，其余字符直接补全在
   最终引句中，避免游戏过程过于冗长。 */
function scatterFloatQuestion(text) {
  return new Promise(resolve => {
    const targetEl = document.getElementById('detailQuestion');
    const hintEl = document.getElementById('detailQuestionHint');
    if (!targetEl) { resolve(); return; }

    const allChars = Array.from(text);
    if (!allChars.some(c => c.trim())) {
      targetEl.textContent = text;
      targetEl.classList.add('in');
      if (hintEl) hintEl.style.display = 'none';
      resolve();
      return;
    }

    // 先在引句容器中铺好"空位"占位字（不可见），用于精确得知每个字
    // 最终应当落在屏幕上的坐标；随后再于其之上覆盖散落漂浮层
    targetEl.textContent = '';
    targetEl.classList.add('in', 'assembling');
    const slotEls = allChars.map(ch => {
      const s = document.createElement('span');
      s.className = 'xj-qslot';
      s.textContent = ch === '\n' ? ' ' : ch;
      if (ch === '\n') s.classList.add('xj-qslot-br');
      targetEl.appendChild(s);
      return s;
    });

    // 参与"拾取"玩法的字符：过多则取样，其余占位字直接标记为已拾回
    const pickIdx = [];
    allChars.forEach((ch, i) => { if (ch.trim()) pickIdx.push(i); });
    const maxPick = 34;
    let sampleIdx = pickIdx;
    if (pickIdx.length > maxPick) {
      const step = Math.ceil(pickIdx.length / maxPick);
      sampleIdx = pickIdx.filter((_, k) => k % step === 0);
    }
    const sampleSet = new Set(sampleIdx);
    // 未被抽中参与玩法的字，直接静置显现在引句中（避免大段文字空缺过久）
    pickIdx.forEach(i => { if (!sampleSet.has(i)) slotEls[i].classList.add('settled'); });

    if (!sampleIdx.length) {
      targetEl.classList.remove('assembling');
      if (hintEl) hintEl.style.display = 'none';
      resolve();
      return;
    }

    requestAnimationFrame(() => {
      const layer = document.createElement('div');
      layer.className = 'xj-detail-scatter-layer xj-detail-scatter-layer--float';
      document.body.appendChild(layer);

      let remaining = sampleIdx.length;
      const shuffled = sampleIdx.slice().sort(() => Math.random() - 0.5);

      shuffled.forEach((charIdx, order) => {
        const slot = slotEls[charIdx];
        const rect = slot.getBoundingClientRect();
        const targetX = rect.left + rect.width / 2;
        const targetY = rect.top + rect.height / 2;

        const g = document.createElement('span');
        g.className = 'xj-qfloat-glyph';
        g.textContent = allChars[charIdx];
        g.setAttribute('role', 'button');
        g.setAttribute('aria-label', '触碰拾回此字');

        // 随机散落起始位置：铺满可视区域，避开顶部状态栏
        const startX = 24 + Math.random() * (window.innerWidth - 48);
        const startY = window.innerHeight * 0.16 + Math.random() * (window.innerHeight * 0.62);
        g.style.left = startX + 'px';
        g.style.top = startY + 'px';
        g.style.setProperty('--qfx', (Math.random() * 22 - 11).toFixed(1) + 'px');
        g.style.setProperty('--qfy', (Math.random() * 26 - 13).toFixed(1) + 'px');
        g.style.setProperty('--qfrot', (Math.random() * 16 - 8).toFixed(1) + 'deg');
        const floatDur = (4.5 + Math.random() * 3.5).toFixed(2) + 's';
        const floatDelay = (-Math.random() * 4).toFixed(2) + 's';
        g.style.setProperty('--qfdur', floatDur);
        g.style.animationDelay = floatDelay;
        layer.appendChild(g);
        requestAnimationFrame(() => { g.classList.add('drift-in'); });

        const collect = () => {
          if (g.classList.contains('collected')) return;
          g.classList.add('collected');
          g.style.pointerEvents = 'none';
          const curRect = g.getBoundingClientRect();
          const dx = targetX - (curRect.left + curRect.width / 2);
          const dy = targetY - (curRect.top + curRect.height / 2);
          g.style.setProperty('--fdx', dx.toFixed(1) + 'px');
          g.style.setProperty('--fdy', dy.toFixed(1) + 'px');
          g.classList.add('flying');

          setTimeout(() => {
            slot.classList.add('settled');
            g.remove();
            remaining--;
            if (remaining <= 0) {
              targetEl.classList.remove('assembling');
              if (hintEl) {
                hintEl.classList.add('done');
                setTimeout(() => { hintEl.style.display = 'none'; }, 900);
              }
              setTimeout(() => {
                if (layer.isConnected) layer.remove();
                resolve();
              }, 260);
            }
          }, 420);
        };

        g.addEventListener('click', collect);
        g.addEventListener('touchstart', (e) => { e.preventDefault(); collect(); }, { passive: false });
      });
    });
  });
}

function closeDetail(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('xjDetailMask').classList.remove('show');
  const q = document.getElementById('detailQuestion');
  if (q) q.classList.remove('in');
  // 若用户在拾字玩法未完成时提前退出，清理仍漂浮在屏幕上的散字层
  document.querySelectorAll('.xj-detail-scatter-layer--float').forEach(l => l.remove());
  _detailEntry = null;
  // 详情页只是覆盖在信匣之上，并未真正关闭信匣；返回时若信匣仍处于
  // 展示状态，需刷新其列表，让刚才"汇聚·浮起"过的那一行恢复为
  // 可再次点击的散字态，而不是停留在消失后的残留状态
  const archiveMask = document.getElementById('xjArchiveMask');
  if (archiveMask && archiveMask.classList.contains('show')) {
    refreshArchiveList();
  }
}
async function deleteCurrentArchiveEntry() {
  if (!_detailEntry) return;
  await xjDelete(_detailEntry.id);
  closeDetail();
  await refreshArchiveList();
  refreshArchiveBadge();
  showToast('已从信匣中移除');
}

/* ================================================================
   初始化
================================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  updateTime();
  updateBattery();
  applyIsland();
  applyGlobalFont();
  setInterval(updateTime, 30000);

  spawnMotes();
  spawnJellies();
  spawnFishes();
  spawnBubbles();
  spawnKelp();

  bindInputAutosize();
  await renderRoster();       // 逻辑保留：角色数据仍会加载，供后续接入
  updateDiverBar();
  refreshArchiveBadge();
});