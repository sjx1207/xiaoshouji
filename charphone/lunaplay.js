/* ==========================================================================
   LUNAPLAY  —  影像社区  ·  纯前端
   依赖：LunaCharDB(chars) 角色书 / LunaWalletHomeDB(home) 钱包余额
        LunaWalletSecurityDB(security) 支付密码 / LunaWalletAccountDB(accounts)
        luna_api_current + luna_api_model  OpenAI 兼容接口
   ========================================================================== */
'use strict';

const LP = {};
window.LP = LP;

/* ============================ 基础工具 ============================ */
const $  = (id) => document.getElementById(id);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const esc = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const nfmt = (n) => {
  n = Number(n) || 0;
  if (n >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/,'') + '亿';
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/,'') + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/,'') + 'k';
  return String(n);
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const nowStr = () => {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};
const hhmm = (ts) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};
const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
};

function toast(msg, ms) {
  const t = $('lpToast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove('on'), ms || 2100);
}
function loading(on, txt) {
  const l = $('lpLoading');
  if (txt) $('ldText').textContent = txt;
  l.classList.toggle('on', !!on);
}

/* ============================ IndexedDB KV ============================ */
let _lpdb = null;
function openLPDB() {
  if (_lpdb) return Promise.resolve(_lpdb);
  return new Promise((res, rej) => {
    const req = indexedDB.open('LunaPlayDB', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'k' });
    };
    req.onsuccess = e => { _lpdb = e.target.result; res(_lpdb); };
    req.onerror   = e => rej(e.target.error);
  });
}
async function kvGet(k, def) {
  try {
    const db = await openLPDB();
    return await new Promise(res => {
      const r = db.transaction('kv').objectStore('kv').get(k);
      r.onsuccess = () => res(r.result ? r.result.v : def);
      r.onerror   = () => res(def);
    });
  } catch (e) { return def; }
}
async function kvSet(k, v) {
  try {
    const db = await openLPDB();
    return await new Promise(res => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put({ k, v });
      tx.oncomplete = () => res(true);
      tx.onerror    = () => res(false);
    });
  } catch (e) { return false; }
}

/* ============================ 全局状态 ============================ */
const S = {
  profile: null, stats: null, feed: [], dms: {}, circle: [],
  universe: null, coin: null, roles: {}, npcs: [], tasks: null, ring: []
};

function defProfile() {
  return {
    name: '未命名', handle: 'lunaplay', gender: '不透露', birth: '', loc: '', job: '',
    bio: '还没有写下任何一句话。', tags: [], theme: 'iris',
    verify: 'none', verifyTxt: '',
    follow: 0, fans: 0, liked: 0,
    avatar: '', cover: '', coverUrl: '', sbTone: 'dark', avShape: 'circle',
    archives: []
  };
}
function defStats() {
  return {
    watch: 0, watchSec: 0, like: 0, fav: 0, share: 0, rec: 0, finish: 0, comment: 0,
    days: {}, hours: new Array(24).fill(0), tags: {}, types: {}, topAuthors: {},
    first: Date.now()
  };
}
function defUniverse() {
  return {
    name: 'Lunaplay 影像宇宙',
    world: '一个与现实高度相似、但影像可以被「织出来」的世界。这里没有摄像机，创作者用记忆与情绪直接生成画面；观众看到的不是录像，而是被重新排列过的真实。',
    era: '近未来 · 城市',
    rating: 'soft',
    rules: '不描写血腥与露骨内容；不出现真实政治人物；不提供任何现实可操作的危险方法；影像可以悲伤，但不鼓励自毁。',
    pen: '克制、具体、有质感。多写细节与动作，少写形容词堆砌。对白短促、有停顿感。允许留白。',
    pov: '第三人称限制视角',
    density: '中',
    dur: '30-90秒',
    endings: '偏好开放式或轻微反转，不强行圆满。',
    banned: '说教、口号、AI 自述、破格出戏'
  };
}
function defCoin() { return { balance: 0, spent: 0, bills: [] }; }

/* ============================ 状态栏（同步 index） ============================ */
function updateTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const s = new Date().toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  $$('.status-time').forEach(el => el.textContent = s);
}
function updateBattery() {
  function render(pct) {
    const p = Math.round(pct);
    $$('.bat-pct').forEach(el => el.textContent = p);
    $$('.bat-inner').forEach(el => {
      el.style.width = p + '%';
      el.style.background = p <= 20 ? 'linear-gradient(90deg,#f87171,#ef4444)' : 'linear-gradient(90deg,#6ee7b7,#34d399)';
    });
  }
  if ('getBattery' in navigator) {
    navigator.getBattery().then(b => { render(b.level * 100); b.addEventListener('levelchange', () => render(b.level * 100)); });
  } else render(76);
}
function applyIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const m = {
    minimal:`<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:`<div class="si-glow"><div class="si-capsule"></div></div>`,
    clock:`<div class="si-clock"><div class="si-capsule"><span class="si-clock-text">--:--</span></div></div>`,
    pulse:`<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
    ripple:`<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
    rainbow:`<div class="si-rainbow"><div class="si-capsule"></div></div>`,
    music:`<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
    scan:`<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`
  };
  $$('.status-island').forEach(el => { el.innerHTML = enabled ? (m[style] || m.minimal) : ''; });
  clearInterval(window._siClockTimer);
  if (enabled && style === 'clock') {
    const tick = () => {
      const n = new Date();
      const t = n.getHours() + ':' + String(n.getMinutes()).padStart(2,'0');
      $$('.si-clock-text').forEach(el => el.textContent = t);
    };
    tick();
    window._siClockTimer = setInterval(tick, 10000);
  }
}
async function applyGlobalFont() {
  const name = localStorage.getItem('luna_font_active_name');
  const id   = parseInt(localStorage.getItem('luna_font_active_id'));
  if (name && id) {
    try {
      const db = await new Promise((res, rej) => {
        const probe = indexedDB.open('LunaFontDB');
        probe.onupgradeneeded = e => { if (!e.target.result.objectStoreNames.contains('fonts')) e.target.result.createObjectStore('fonts', { keyPath:'id', autoIncrement:true }); };
        probe.onsuccess = e => {
          const cur = e.target.result, ver = cur.version, has = cur.objectStoreNames.contains('fonts');
          cur.close();
          const r2 = indexedDB.open('LunaFontDB', has ? ver : ver + 1);
          r2.onupgradeneeded = e2 => { if (!e2.target.result.objectStoreNames.contains('fonts')) e2.target.result.createObjectStore('fonts', { keyPath:'id', autoIncrement:true }); };
          r2.onsuccess = e2 => res(e2.target.result);
          r2.onerror = () => rej(0);
        };
        probe.onerror = () => rej(0);
      });
      const all = await new Promise(res => {
        if (!db.objectStoreNames.contains('fonts')) return res([]);
        const r = db.transaction('fonts','readonly').objectStore('fonts').getAll();
        r.onsuccess = () => res(r.result || []); r.onerror = () => res([]);
      });
      const f = all.find(x => x.id === id);
      if (f) { const face = new FontFace(name, `url(${f.data})`); await face.load(); document.fonts.add(face); }
    } catch (e) {}
  }
  let tag = $('luna-font-override');
  if (!tag) { tag = document.createElement('style'); tag.id = 'luna-font-override'; document.head.appendChild(tag); }
  tag.textContent = name ? `*{font-family:'${name}',sans-serif !important;}` : '';
}
window.addEventListener('storage', (e) => {
  if (e.key === 'luna_island_update') applyIsland();
  if (e.key === 'luna_tz_update')     updateTime();
  if (e.key === 'luna_font_update')   applyGlobalFont();
  if (e.key === 'luna_char_db_update' || e.key === 'luna_characters_updated') LP.syncRoles(true);
});

/* ============================ AI 桥接 ============================ */
function aiCfg() {
  let cur = {};
  try { cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}'); } catch (e) {}
  return { baseUrl: (cur.baseUrl || '').replace(/\/$/,''), apiKey: cur.apiKey || '', model: localStorage.getItem('luna_api_model') || '' };
}
async function aiChat(messages, opt) {
  const c = aiCfg();
  if (!c.baseUrl || !c.apiKey || !c.model) throw new Error('尚未在「设置 - API」里配置接口与模型');
  const resp = await fetch(`${c.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${c.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: c.model, messages,
      temperature: (opt && opt.temp) != null ? opt.temp : 0.92,
      max_tokens: (opt && opt.max) || 2600
    })
  });
  if (!resp.ok) throw new Error(`接口返回 HTTP ${resp.status}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}
function parseJSON(text) {
  if (!text) return null;
  let t = String(text).trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/,'').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  const c = t.indexOf('['), d = t.lastIndexOf(']');
  let cand = null;
  if (c !== -1 && (c < a || a === -1)) cand = t.slice(c, d + 1);
  else if (a !== -1) cand = t.slice(a, b + 1);
  if (!cand) return null;
  try { return JSON.parse(cand); } catch (e) {}
  try { return JSON.parse(cand.replace(/,\s*([}\]])/g, '$1')); } catch (e) {}
  return null;
}

/* ============================ 角色书读取 ============================ */
function openCharDB() {
  return new Promise((res, rej) => {
    const probe = indexedDB.open('LunaCharDB');
    probe.onupgradeneeded = e => { if (!e.target.result.objectStoreNames.contains('chars')) e.target.result.createObjectStore('chars', { keyPath:'id', autoIncrement:true }); };
    probe.onsuccess = e => {
      const cur = e.target.result, ver = cur.version, has = cur.objectStoreNames.contains('chars');
      cur.close();
      const r = indexedDB.open('LunaCharDB', has ? ver : ver + 1);
      r.onupgradeneeded = e2 => { if (!e2.target.result.objectStoreNames.contains('chars')) e2.target.result.createObjectStore('chars', { keyPath:'id', autoIncrement:true }); };
      r.onsuccess = e2 => res(e2.target.result);
      r.onerror = () => rej(0);
    };
    probe.onerror = () => rej(0);
  });
}
async function getAllChars() {
  try {
    const db = await openCharDB();
    return await new Promise(res => {
      const r = db.transaction('chars','readonly').objectStore('chars').getAll();
      r.onsuccess = () => res(r.result || []); r.onerror = () => res([]);
    });
  } catch (e) { return []; }
}

/* ============================ 钱包桥接 ============================ */
function _openIDB(name, ver, store, keyPath) {
  return new Promise((res, rej) => {
    const req = ver ? indexedDB.open(name, ver) : indexedDB.open(name);
    req.onupgradeneeded = e => { if (!e.target.result.objectStoreNames.contains(store)) e.target.result.createObjectStore(store, { keyPath: keyPath || 'id' }); };
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}
async function walletAccount() {
  try {
    const db = await _openIDB('LunaWalletAccountDB', 1, 'accounts');
    return await new Promise(res => {
      const r = db.transaction('accounts').objectStore('accounts').get('main');
      r.onsuccess = () => res(r.result || null); r.onerror = () => res(null);
    });
  } catch (e) { return null; }
}
async function walletKey() {
  const a = await walletAccount();
  return 'identity_' + ((a && a.boundIdentityId) || 'default');
}
async function walletHome() {
  try {
    const db = await _openIDB('LunaWalletHomeDB', 1, 'home');
    const key = await walletKey();
    return await new Promise(res => {
      const r = db.transaction('home').objectStore('home').get(key);
      r.onsuccess = () => res(r.result || null); r.onerror = () => res(null);
    });
  } catch (e) { return null; }
}
async function walletSaveHome(data) {
  try {
    const db = await _openIDB('LunaWalletHomeDB', 1, 'home');
    const key = await walletKey();
    return await new Promise(res => {
      const tx = db.transaction('home','readwrite');
      tx.objectStore('home').put({ ...data, id: key });
      tx.oncomplete = () => res(true); tx.onerror = () => res(false);
    });
  } catch (e) { return false; }
}
async function walletSecurity() {
  try {
    const db = await _openIDB('LunaWalletSecurityDB', 1, 'security');
    const key = await walletKey();
    return await new Promise(res => {
      const r = db.transaction('security').objectStore('security').get(key);
      r.onsuccess = () => res(r.result || { enabled:false, pin:null }); r.onerror = () => res({ enabled:false, pin:null });
    });
  } catch (e) { return { enabled:false, pin:null }; }
}

/* PIN 键盘 —— 与钱包同一套支付密码 */
let _pinResolve = null, _pinInput = '';
function buildPinPad() {
  const pad = $('pinPad');
  pad.innerHTML = '';
  ['1','2','3','4','5','6','7','8','9','','0','⌫'].forEach(k => {
    const d = document.createElement('div');
    d.className = 'pk' + (k === '' ? ' blank' : '');
    d.textContent = k;
    if (k !== '') d.onclick = () => (k === '⌫' ? pinDel() : pinKey(k));
    pad.appendChild(d);
  });
  $('pinCancel').onclick = () => pinClose(false);
}
function pinCells() {
  for (let i = 0; i < 4; i++) {
    const c = $('pc' + i);
    c.className = 'pin-cell' + (i < _pinInput.length ? ' filled' : (i === _pinInput.length ? ' active' : ''));
  }
}
function pinKey(n) {
  if (_pinInput.length >= 4) return;
  _pinInput += n; pinCells();
  if (_pinInput.length === 4) pinSubmit();
}
function pinDel() { _pinInput = _pinInput.slice(0, -1); pinCells(); }
async function pinSubmit() {
  const sec = await walletSecurity();
  if (_pinInput === sec.pin) pinClose(true);
  else {
    const h = $('pinHint');
    h.textContent = '密码错误，请重新输入'; h.style.color = '#e0567f';
    _pinInput = ''; pinCells();
  }
}
function pinClose(ok) {
  closeOverlay('pinOverlay');
  const r = _pinResolve; _pinResolve = null; _pinInput = '';
  setTimeout(() => { if (r) r(ok); }, 220);
}
async function requirePayPassword() {
  const sec = await walletSecurity();
  if (!sec.enabled || !sec.pin) return true;
  return new Promise(res => {
    _pinResolve = res; _pinInput = ''; pinCells();
    const h = $('pinHint'); h.textContent = '请输入支付密码完成扣款'; h.style.color = '';
    openOverlay('pinOverlay');
  });
}

/* ==========================================================================
   徽章图形工厂 —— 全部程序化 SVG，每一级一个样式
   ========================================================================== */
const PALETTE = [
  ['#c9c6dd','#efeef6','#8d8aa8'], ['#b7c8e8','#e6eefb','#6f8fc0'], ['#a9dbe8','#e2f6fb','#5aa5b8'],
  ['#a6e6d3','#e2f9f2','#4fae9c'], ['#c2e6a8','#eef9e4','#77a95f'], ['#ffd9a3','#fff2e0','#d09a37'],
  ['#ffbfd0','#ffeaf1','#e0729c'], ['#e0b8f5','#f6e9ff','#b06bd6'], ['#b8b0ff','#eae7ff','#7c6cf5'],
  ['#8fa8ff','#e3e9ff','#4f68d8'],
];
function palOf(lv, total) {
  const fam = clamp(Math.ceil(lv / (total / 10)), 1, 10);
  const p = PALETTE[fam - 1];
  const step = ((lv - 1) % (total / 10)) / (total / 10);
  return { a: p[0], b: p[1], c: p[2], fam, step };
}
function gearPath(cx, cy, r, teeth, depth) {
  let d = '';
  const n = teeth * 2;
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r - depth;
    const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
    d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2);
  }
  return d + 'Z';
}
function polyPath(cx, cy, r, n, rot) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2 + (rot || 0);
    const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r;
    d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2);
  }
  return d + 'Z';
}
function starPath(cx, cy, r1, r2, pts) {
  let d = '';
  for (let i = 0; i < pts * 2; i++) {
    const ang = (Math.PI * i) / pts - Math.PI / 2;
    const rr = i % 2 === 0 ? r1 : r2;
    d += (i === 0 ? 'M' : 'L') + (cx + Math.cos(ang) * rr).toFixed(2) + ' ' + (cy + Math.sin(ang) * rr).toFixed(2);
  }
  return d + 'Z';
}

/* 消费等级勋章（1-50，每级独立造型） */
function medalSVG(lv, size) {
  lv = clamp(lv, 1, 50);
  const p = palOf(lv, 50);
  const gid = 'md' + lv + '_' + Math.random().toString(36).slice(2,6);
  const s = size || 60, c = s / 2, R = s * 0.42;
  const shell = (lv - 1) % 5;                 // 每族 5 种外壳变化
  const fam = p.fam;
  let core = '';
  if (fam === 1)  core = `<circle cx="${c}" cy="${c}" r="${R}" fill="url(#${gid})"/>`;
  if (fam === 2)  core = `<path d="${polyPath(c,c,R,6,0)}" fill="url(#${gid})"/>`;
  if (fam === 3)  core = `<path d="M${c} ${c-R} L${c+R*0.92} ${c-R*0.34} L${c+R*0.72} ${c+R*0.86} L${c-R*0.72} ${c+R*0.86} L${c-R*0.92} ${c-R*0.34} Z" fill="url(#${gid})"/>`;
  if (fam === 4)  core = `<path d="${starPath(c,c,R,R*0.48,5)}" fill="url(#${gid})"/>`;
  if (fam === 5)  core = `<path d="${polyPath(c,c,R,4,0)}" fill="url(#${gid})"/>`;
  if (fam === 6)  core = `<path d="${polyPath(c,c,R,8,Math.PI/8)}" fill="url(#${gid})"/>`;
  if (fam === 7)  core = `<path d="${gearPath(c,c,R,10,R*0.16)}" fill="url(#${gid})"/>`;
  if (fam === 8)  core = `<path d="M${c-R*0.86} ${c-R*0.7} H${c+R*0.86} V${c+R*0.16} Q${c} ${c+R*1.06} ${c-R*0.86} ${c+R*0.16} Z" fill="url(#${gid})"/>`;
  if (fam === 9)  core = `<path d="${starPath(c,c,R,R*0.4,8)}" fill="url(#${gid})"/>`;
  if (fam === 10) core = `<path d="M${c} ${c-R*1.02} L${c+R*0.62} ${c-R*0.3} L${c+R*0.98} ${c+R*0.62} L${c} ${c+R*0.34} L${c-R*0.98} ${c+R*0.62} L${c-R*0.62} ${c-R*0.3} Z" fill="url(#${gid})"/>`;

  let deco = '';
  if (shell >= 1) deco += `<circle cx="${c}" cy="${c}" r="${R*1.16}" fill="none" stroke="${p.c}" stroke-width="1" opacity=".55"/>`;
  if (shell >= 2) deco += `<circle cx="${c}" cy="${c}" r="${R*1.3}" fill="none" stroke="${p.c}" stroke-width=".7" stroke-dasharray="3 3" opacity=".45"/>`;
  if (shell >= 3) {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI*2*i)/6 - Math.PI/2;
      deco += `<circle cx="${(c+Math.cos(a)*R*1.3).toFixed(2)}" cy="${(c+Math.sin(a)*R*1.3).toFixed(2)}" r="1.8" fill="${p.c}" opacity=".7"/>`;
    }
  }
  if (shell >= 4) deco += `<path d="${polyPath(c,c,R*1.42,3,Math.PI)}" fill="none" stroke="${p.c}" stroke-width=".7" opacity=".38"/>`;
  const inner = `<path d="${polyPath(c,c,R*0.5,3+(lv%5),0.3)}" fill="none" stroke="#fff" stroke-width="1.1" opacity=".78"/>`;
  const num = `<text x="${c}" y="${c+3.6}" text-anchor="middle" font-family="'Space Mono',monospace" font-size="${s*0.19}" fill="#fff" opacity=".92">${lv}</text>`;

  return `<svg viewBox="0 0 ${s} ${s}" width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${p.b}"/><stop offset="46%" stop-color="${p.a}"/><stop offset="100%" stop-color="${p.c}"/>
      </linearGradient>
    </defs>
    ${deco}${core}
    <g opacity=".9">${inner}</g>${num}
  </svg>`;
}

/* 星链星阶大徽章（1-40） */
function linkBadgeSVG(lv, size) {
  lv = clamp(lv, 1, 40);
  const p = palOf(lv, 40);
  const gid = 'lk' + lv + '_' + Math.random().toString(36).slice(2,6);
  const s = size || 82, c = s/2, R = s*0.36;
  const rings = 2 + (lv % 4);
  let orb = '';
  for (let i = 0; i < rings; i++) {
    const rr = R * (1.06 + i * 0.16);
    orb += `<ellipse cx="${c}" cy="${c}" rx="${rr.toFixed(1)}" ry="${(rr*0.42).toFixed(1)}" fill="none" stroke="${p.c}" stroke-width=".8" opacity="${0.5 - i*0.09}" transform="rotate(${20+i*38} ${c} ${c})"/>`;
  }
  let dots = '';
  const dn = 3 + (lv % 6);
  for (let i = 0; i < dn; i++) {
    const a = (Math.PI*2*i)/dn - Math.PI/2;
    dots += `<circle cx="${(c+Math.cos(a)*R*1.5).toFixed(1)}" cy="${(c+Math.sin(a)*R*1.5).toFixed(1)}" r="${1.6+ (lv%3)*0.4}" fill="${p.c}" opacity=".72"/>`;
  }
  const shape = lv % 4 === 0 ? `<path d="${starPath(c,c,R,R*0.44,6)}" fill="url(#${gid})"/>`
              : lv % 4 === 1 ? `<circle cx="${c}" cy="${c}" r="${R}" fill="url(#${gid})"/>`
              : lv % 4 === 2 ? `<path d="${polyPath(c,c,R,6,0)}" fill="url(#${gid})"/>`
              : `<path d="${polyPath(c,c,R,8,Math.PI/8)}" fill="url(#${gid})"/>`;
  return `<svg viewBox="0 0 ${s} ${s}" width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="${gid}" cx="35%" cy="30%">
      <stop offset="0%" stop-color="#ffffff"/><stop offset="42%" stop-color="${p.a}"/><stop offset="100%" stop-color="${p.c}"/>
    </radialGradient></defs>
    ${orb}${dots}${shape}
    <circle cx="${c-R*0.28}" cy="${c-R*0.3}" r="${R*0.2}" fill="#fff" opacity=".5"/>
    <text x="${c}" y="${c+R*0.24}" text-anchor="middle" font-family="'Space Mono',monospace" font-size="${s*0.18}" fill="#fff" opacity=".95">${lv}</text>
  </svg>`;
}

/* 羁绊等级（1-30） */
const BOND_NAMES = ['初见','点头','搭话','留意','熟识','夜谈','共感','同频','并肩','托付','默契','引力','潮汐','恒温','长夜','回声','共振','引信','余烬','星火','连缀','结晶','轨道','双子','引潮','恒星','裂隙','共生','缄默','原点'];
function bondTier(lv) { return clamp(Math.ceil(lv / 4), 1, 8); }
function bondIconSVG(lv) {
  const t = bondTier(lv), s = 15, c = s/2;
  const shapes = [
    `<circle cx="${c}" cy="${c}" r="4" fill="currentColor" opacity=".85"/>`,
    `<path d="${polyPath(c,c,4.6,3,0)}" fill="currentColor" opacity=".85"/>`,
    `<path d="${polyPath(c,c,4.6,4,0)}" fill="currentColor" opacity=".85"/>`,
    `<path d="${starPath(c,c,5,2.2,4)}" fill="currentColor" opacity=".9"/>`,
    `<path d="${polyPath(c,c,4.8,6,0)}" fill="currentColor" opacity=".9"/>`,
    `<path d="${starPath(c,c,5.2,2.4,5)}" fill="currentColor" opacity=".92"/>`,
    `<path d="${starPath(c,c,5.4,2.2,6)}" fill="currentColor" opacity=".95"/>`,
    `<path d="${starPath(c,c,5.6,2.1,8)}" fill="currentColor"/>`
  ];
  return `<svg viewBox="0 0 ${s} ${s}" width="${s}" height="${s}">${shapes[t-1]}</svg>`;
}
function bondHTML(lv, big) {
  lv = clamp(lv || 1, 1, 30);
  const t = bondTier(lv);
  return `<span class="bond bond-t${t}${t>=5?' shine':''}${big?' big':''}">
    <span class="bond-ic">${bondIconSVG(lv)}</span>
    <span class="bond-lv">${lv}</span><span class="bond-nm">${BOND_NAMES[lv-1]}</span></span>`;
}
function bondLevelOf(pts) {
  let lv = 1;
  for (let i = 1; i <= 30; i++) if (pts >= bondNeed(i)) lv = i;
  return lv;
}
function bondNeed(lv) { return Math.round(Math.pow(lv - 1, 1.72) * 9); }

/* 认证徽标 */
const VERIFY_KIND = {
  none:   { n:'不认证', c:'' },
  blue:   { n:'个人认证', c:'#4a8ff0' },
  gold:   { n:'创作者认证', c:'#e8a33c' },
  violet: { n:'星耀认证', c:'#8b6cf0' },
  rose:   { n:'影像官方', c:'#ea6f9c' },
  mono:   { n:'匿名核验', c:'#5a5a72' }
};
function verifySVG(kind, size) {
  const k = VERIFY_KIND[kind];
  if (!k || !k.c) return '';
  const s = size || 15, c = s/2;
  const inner = kind === 'gold' ? `<path d="${starPath(c,c,s*0.2,s*0.09,5)}" fill="#fff"/>`
              : kind === 'violet' ? `<path d="${polyPath(c,c,s*0.19,6,0)}" fill="#fff"/>`
              : kind === 'rose' ? `<circle cx="${c}" cy="${c}" r="${s*0.14}" fill="#fff"/>`
              : kind === 'mono' ? `<rect x="${c-s*0.16}" y="${c-s*0.05}" width="${s*0.32}" height="${s*0.1}" rx="1" fill="#fff"/>`
              : `<path d="M${c-s*0.19} ${c} l${s*0.13} ${s*0.14} l${s*0.26} -${s*0.26}" stroke="#fff" stroke-width="${s*0.1}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<svg viewBox="0 0 ${s} ${s}" width="${s}" height="${s}">
    <path d="${starPath(c,c,c,c*0.82,12)}" fill="${k.c}"/>${inner}</svg>`;
}

/* ==========================================================================
   导航与页面切换
   ========================================================================== */
let curScreen = 'scHome';
function moveDock(idx, animate) {
  const items = $$('.dk');
  const el = items[idx];
  if (!el) return;
  const dockEl = $('lpDock');
  const dock = dockEl.getBoundingClientRect();
  if (!dock.width) return; // 舞台尚未布局完成，跳过本次校正，等待下一次调用
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2 - dock.left;
  const blob = $('dockBlob'), beam = $('dockBeam');
  blob.style.transform = `translateX(${cx - 36}px)`;
  beam.style.transform = `translateX(${cx - 1}px)`;
  blob.classList.add('placed'); beam.classList.add('placed');
  if (animate) spawnDust(cx);
}
function spawnDust(cx) {
  const host = $('dockDust');
  host.style.left = cx + 'px';
  for (let i = 0; i < 7; i++) {
    const p = document.createElement('span');
    p.className = 'dust-p';
    p.style.setProperty('--dx', (rnd(-26, 26)) + 'px');
    p.style.animationDelay = (i * 40) + 'ms';
    p.style.background = pick(['#7c6cf5','#c58cf5','#ff9fc0','#8fc0ff']);
    host.appendChild(p);
    setTimeout(() => p.remove(), 1300);
  }
}
function go(id) {
  if (curScreen === id) return;
  curScreen = id;
  $$('.lp-screen').forEach(s => s.classList.toggle('is-on', s.id === id));
  const items = $$('.dk');
  items.forEach((b, i) => {
    const on = b.dataset.s === id;
    b.classList.toggle('on', on);
    if (on) moveDock(i, true);
  });
  document.body.classList.toggle('sb-light', id === 'scMe' && S.profile && S.profile.sbTone === 'light');
  $('lpBleed').classList.toggle('on', id === 'scMe');
  if (id === 'scDM') LP.renderDMList();
  if (id === 'scMe') LP.renderMe();
  if (id === 'scCircle') LP.renderCircle();
}
LP.go = go;

function openPage(id) {
  $(id).classList.add('on');
  document.body.classList.remove('sb-light');
  if (id === 'pgChat') applyChatTone();
}
function closePage(id) {
  $(id).classList.remove('on');
  if (curScreen === 'scMe' && S.profile.sbTone === 'light') document.body.classList.add('sb-light');
}
LP.openPage = openPage; LP.closePage = closePage;

/* 暗色遮罩计数：遮罩期间状态栏自动转为浅色，保证任何页面都看得见 */
let _scrimN = 0;
function scrim(on) {
  _scrimN = Math.max(0, _scrimN + (on ? 1 : -1));
  document.body.classList.toggle('scrim', _scrimN > 0);
}
function openSheet(id) { if (!$(id).classList.contains('on')) { $(id).classList.add('on'); scrim(true); } }
function closeSheet(id) { if ($(id).classList.contains('on')) { $(id).classList.remove('on'); scrim(false); } }
LP.openSheet = openSheet; LP.closeSheet = closeSheet;
function openOverlay(id) { const e = $(id); if (!e.classList.contains('on')) { e.classList.add('on'); scrim(true); } }
function closeOverlay(id) { const e = $(id); if (e.classList.contains('on')) { e.classList.remove('on'); scrim(false); } }

function bindSeg(segId, inkId, cb) {
  const seg = $(segId), ink = $(inkId);
  const move = () => {
    const on = seg.querySelector('.sg.on');
    if (!on) return;
    const r = on.getBoundingClientRect(), sr = seg.getBoundingClientRect();
    ink.style.width = r.width + 'px';
    ink.style.transform = `translateX(${r.left - sr.left - 4}px)`;
  };
  $$('.sg', seg).forEach(s => s.onclick = () => {
    $$('.sg', seg).forEach(x => x.classList.remove('on'));
    s.classList.add('on'); move(); cb(s.dataset.g);
  });
  setTimeout(move, 60);
  return move;
}

/* 文件选择 */
function pickImage() {
  return new Promise(res => {
    const inp = $('fileInput');
    inp.value = '';
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if (!f) return res(null);
      const rd = new FileReader();
      rd.onload = () => res(rd.result);
      rd.readAsDataURL(f);
    };
    inp.click();
  });
}

/* ==========================================================================
   个人中心渲染
   ========================================================================== */
const THEME_MAP = {
  iris:  'linear-gradient(135deg,#7c6cf5,#c58cf5,#ff9fc0)',
  sky:   'linear-gradient(135deg,#8fc0ff,#a9b4ff,#c58cf5)',
  blush: 'linear-gradient(135deg,#ff9fc0,#ffc2d6,#a9e6f0)',
  mint:  'linear-gradient(135deg,#8fe3cd,#a9e6f0,#8fc0ff)',
  ink:   'linear-gradient(135deg,#2a2a3d,#4b4b68,#7c6cf5)'
};
LP.renderMe = function () {
  const p = S.profile;
  const cover = p.cover || p.coverUrl;
  const grad = THEME_MAP[p.theme] || THEME_MAP.iris;
  [$('meCoverImg'), $('lpBleedImg')].forEach(el => {
    if (!el) return;
    if (cover) {
      el.style.background = 'none';
      el.style.backgroundImage = `url("${cover}")`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
    } else {
      el.style.backgroundImage = 'none';
      el.style.background = grad;
    }
  });

  const av = $('meAv');
  av.innerHTML = p.avatar ? `<img src="${p.avatar}">` : `<span>${esc((p.name || 'L')[0])}</span>`;
  if (!p.avatar) av.style.background = THEME_MAP[p.theme] || THEME_MAP.iris;
  $('meAvWrap').classList.toggle('sq', p.avShape === 'square');

  $('meName').textContent = p.name || '未命名';
  $('meHandle').textContent = '@' + (p.handle || 'lunaplay');
  $('meVerify').innerHTML = verifySVG(p.verify, 17);
  $('meVerifyText').textContent = (p.verify !== 'none' && p.verifyTxt) ? p.verifyTxt : '';
  $('mnFollow').textContent = nfmt(p.follow);
  $('mnFans').textContent = nfmt(p.fans);
  $('mnLiked').textContent = nfmt(p.liked);
  $('mnCoin').textContent = nfmt(S.coin.balance);
  $('meBio').textContent = p.bio || '还没有写下任何一句话。';
  $('meTags').innerHTML = (p.tags || []).map(t => `<span class="me-tag">${esc(t)}</span>`).join('');
  document.body.classList.toggle('sb-light', curScreen === 'scMe' && p.sbTone === 'light');
  renderMeGrid(LP._meTab || 'like');
};
function moveMeInk() {
  const on = $('meTabs').querySelector('.mt.on');
  if (!on) return;
  const r = on.getBoundingClientRect(), pr = $('meTabs').getBoundingClientRect();
  const ink = $('mtInk');
  ink.style.width = (r.width * 0.42) + 'px';
  ink.style.transform = `translateX(${r.left - pr.left + r.width * 0.29}px)`;
}
function renderMeGrid(tab) {
  LP._meTab = tab;
  const g = $('meGrid');
  const list = S.feed.filter(v => tab === 'like' ? v.liked : tab === 'fav' ? v.faved : v.recd);
  if (!list.length) {
    const txt = tab === 'like' ? '还没有点赞过任何影像' : tab === 'fav' ? '收藏夹是空的' : '还没有推荐过影像';
    g.innerHTML = `<div class="me-empty">${txt}<br>去推荐页拉动光弦，让世界开始播放</div>`;
    return;
  }
  g.innerHTML = list.slice().reverse().map((v, i) => `
    <div class="mg" style="animation-delay:${i*0.04}s" data-vid="${v.id}">
      <div class="bgx ${v.bg}"></div>
      <div class="mg-in">
        <div class="mg-t">${esc(v.title)}</div>
        <div class="mg-n">${esc(v.author.name)} · ${nfmt(v.stat.like)}</div>
      </div>
      <div class="mg-badge">${esc(v.typeName)}</div>
    </div>`).join('');
  $$('.mg', g).forEach(el => el.onclick = () => { go('scHome'); setTimeout(() => scrollToVid(el.dataset.vid), 260); });
}

/* ==========================================================================
   档案室
   ========================================================================== */
LP.renderArchive = function () {
  const st = S.stats, p = S.profile;
  const spLv = spendLevel(S.coin.spent);
  const lkLv = linkLevel();
  const cards = [
    { cls:'arc-1', k:'01 / IDENTITY', t:'查看信息', d:'昵称、认证、头像、封面、数字——全部由你决定。写好的资料会自动存档，随时取回再改。',
      st:[[p.name.length ? '已建立' : '未填写','档案'],[String((p.archives||[]).length),'存档']], go:'pgInfo' },
    { cls:'arc-2', k:'02 / TRACES', t:'数据信息', d:'你看过什么、停在哪一秒、给谁点了赞——这里只统计你的观看与互动，不统计发布。',
      st:[[nfmt(st.watch),'观看'],[nfmt(st.like),'点赞'],[nfmt(st.fav),'收藏']], go:'pgData' },
    { cls:'arc-3', k:'03 / STELLAR LINK', t:'星链', d:'40 段星阶、30 级羁绊、21 项任务。等级不只是规则，它记着你和每一个人之间的温度。',
      st:[['Lv.' + lkLv,'星阶'],[String(taskDone()),'已完成']], go:'pgLink' },
    { cls:'arc-4', k:'04 / STARLIGHT', t:'星光币', d:'1 Lune 兑 10 星光币，从 Luna 钱包扣款并校验支付密码。50 级消费等级，每一级一枚独立勋章。',
      st:[[nfmt(S.coin.balance),'余额'],['Lv.' + spLv,'消费等级']], go:'pgCoin' },
    { cls:'arc-5', k:'05 / UNIVERSE', t:'内容宇宙', d:'影像世界的底层设定：世界观、限制规则、文笔取向、时长与结局偏好。所有生成都遵守它。',
      st:[[esc(S.universe.era),'纪元'],[esc(S.universe.density),'密度']], go:'pgUniverse' }
  ];
  $('arStamp').textContent = 'LV.' + lkLv + ' / ' + (S.profile.handle || 'lunaplay').toUpperCase();
  $('arCards').innerHTML = cards.map((c, i) => `
    <div class="arc-c ${c.cls}" data-go="${c.go}" style="animation-delay:${i*0.06}s">
      <div class="arc-in">
        <div class="arc-k">${c.k}</div>
        <div class="arc-t">${c.t}</div>
        <div class="arc-d">${c.d}</div>
        <div class="arc-stat">${c.st.map(s => `<div class="arc-s"><b>${s[0]}</b><span>${s[1]}</span></div>`).join('')}</div>
      </div>
      <div class="arc-go"><svg viewBox="0 0 24 24" width="14" height="14" fill="none"><path d="M9 5.5L15.5 12 9 18.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    </div>`).join('');
  $$('.arc-c').forEach(el => el.onclick = () => {
    const t = el.dataset.go;
    if (t === 'pgInfo') LP.openInfo();
    else if (t === 'pgData') LP.renderData();
    else if (t === 'pgLink') LP.renderLink('me');
    else if (t === 'pgCoin') LP.renderCoin('wallet');
    else if (t === 'pgUniverse') LP.renderUniverse();
    openPage(t);
  });
};

/* ==========================================================================
   查看信息（资料档案）
   ========================================================================== */
const GENDERS = ['女','男','非二元','不透露'];
const THEMES = [['iris','鸢尾'],['sky','霁蓝'],['blush','绯'],['mint','薄荷'],['ink','墨']];
function optRow(host, arr, cur, cb) {
  const el = $(host);
  el.innerHTML = arr.map(o => {
    const v = Array.isArray(o) ? o[0] : o, n = Array.isArray(o) ? o[1] : o;
    return `<span class="opt${v === cur ? ' on' : ''}" data-v="${esc(v)}">${esc(n)}</span>`;
  }).join('');
  $$('.opt', el).forEach(o => o.onclick = () => {
    $$('.opt', el).forEach(x => x.classList.remove('on'));
    o.classList.add('on'); cb(o.dataset.v);
  });
}
let _formTmp = {};
LP.openInfo = function () {
  const p = S.profile;
  _formTmp = { avatar: p.avatar, cover: p.cover, verify: p.verify, gender: p.gender, theme: p.theme, sbTone: p.sbTone, avShape: p.avShape };
  $('fName').value = p.name; $('fHandle').value = p.handle; $('fBirth').value = p.birth;
  $('fLoc').value = p.loc; $('fJob').value = p.job; $('fBio').value = p.bio;
  $('fTags').value = (p.tags || []).join(','); $('fVerifyTxt').value = p.verifyTxt;
  $('fFollow').value = p.follow; $('fFans').value = p.fans; $('fLiked').value = p.liked;
  $('fCoverUrl').value = p.coverUrl || '';
  optRow('fGender', GENDERS, p.gender, v => _formTmp.gender = v);
  optRow('fTheme', THEMES, p.theme, v => _formTmp.theme = v);
  optRow('fSbTone', [['dark','深色'],['light','浅色']], p.sbTone, v => { _formTmp.sbTone = v; });
  optRow('fAvShape', [['circle','圆形'],['square','方形']], p.avShape, v => _formTmp.avShape = v);
  $('fVerify').innerHTML = Object.keys(VERIFY_KIND).map(k => {
    const kk = VERIFY_KIND[k];
    return `<span class="vfo${k === p.verify ? ' on' : ''}" data-v="${k}">${kk.c ? verifySVG(k, 14) : ''}${kk.n}</span>`;
  }).join('');
  $$('#fVerify .vfo').forEach(o => o.onclick = () => {
    $$('#fVerify .vfo').forEach(x => x.classList.remove('on'));
    o.classList.add('on'); _formTmp.verify = o.dataset.v;
  });
  $('upAvatarPrev').style.backgroundImage = p.avatar ? `url(${p.avatar})` : '';
  $('upCoverPrev').style.backgroundImage = (p.cover || p.coverUrl) ? `url(${p.cover || p.coverUrl})` : '';
  renderArchiveLog();
  renderRoleList();
};
function renderArchiveLog() {
  const list = S.profile.archives || [];
  $('slList').innerHTML = list.length ? list.slice().reverse().map((a, i) => `
    <div class="sl-i">
      <div class="sl-dot"></div>
      <div class="sl-c"><div class="sl-t">${esc(a.summary)}</div><div class="sl-d">${esc(a.time)}</div></div>
      <div class="sl-use" data-i="${list.length - 1 - i}">取回</div>
    </div>`).join('')
    : `<div style="padding:16px 0;font-size:11px;color:var(--ink4);line-height:1.9;">还没有存档。点右上角「存档」，写好的资料会保存在这里，下次可以直接取回再改。</div>`;
  $$('.sl-use').forEach(b => b.onclick = () => restoreArchive(+b.dataset.i));
}
function restoreArchive(i) {
  const a = (S.profile.archives || [])[i];
  if (!a) return;
  const d = a.data;
  $('fName').value = d.name; $('fHandle').value = d.handle; $('fBirth').value = d.birth;
  $('fLoc').value = d.loc; $('fJob').value = d.job; $('fBio').value = d.bio;
  $('fTags').value = (d.tags || []).join(','); $('fVerifyTxt').value = d.verifyTxt;
  $('fFollow').value = d.follow; $('fFans').value = d.fans; $('fLiked').value = d.liked;
  $('fCoverUrl').value = d.coverUrl || '';
  _formTmp = { avatar: d.avatar, cover: d.cover, verify: d.verify, gender: d.gender, theme: d.theme, sbTone: d.sbTone, avShape: d.avShape };
  optRow('fGender', GENDERS, d.gender, v => _formTmp.gender = v);
  optRow('fTheme', THEMES, d.theme, v => _formTmp.theme = v);
  optRow('fSbTone', [['dark','深色'],['light','浅色']], d.sbTone, v => _formTmp.sbTone = v);
  optRow('fAvShape', [['circle','圆形'],['square','方形']], d.avShape, v => _formTmp.avShape = v);
  $('upAvatarPrev').style.backgroundImage = d.avatar ? `url(${d.avatar})` : '';
  $('upCoverPrev').style.backgroundImage = (d.cover || d.coverUrl) ? `url(${d.cover || d.coverUrl})` : '';
  toast('已取回这一版资料，可继续修改');
}
async function saveInfo(silent) {
  const p = S.profile;
  p.name = $('fName').value.trim() || '未命名';
  p.handle = ($('fHandle').value.trim() || 'lunaplay').replace(/^@/,'');
  p.birth = $('fBirth').value.trim(); p.loc = $('fLoc').value.trim(); p.job = $('fJob').value.trim();
  p.bio = $('fBio').value.trim() || '还没有写下任何一句话。';
  p.tags = $('fTags').value.split(/[,，]/).map(s => s.trim()).filter(Boolean).slice(0, 8);
  p.verifyTxt = $('fVerifyTxt').value.trim();
  p.follow = +$('fFollow').value || 0; p.fans = +$('fFans').value || 0; p.liked = +$('fLiked').value || 0;
  p.coverUrl = $('fCoverUrl').value.trim();
  Object.assign(p, _formTmp);
  const snap = JSON.parse(JSON.stringify(p)); delete snap.archives;
  p.archives = p.archives || [];
  p.archives.push({ time: nowStr(), summary: `${p.name} · @${p.handle} · ${VERIFY_KIND[p.verify].n} · ${p.tags.length} 个标签`, data: snap });
  if (p.archives.length > 12) p.archives = p.archives.slice(-12);
  await kvSet('profile', p);
  LP.renderMe(); renderArchiveLog();
  if (!silent) toast('已存档，可随时取回再改');
}

/* ==========================================================================
   角色同步 —— 角色书 → Lunaplay 身份
   人设 / prompt / 世界书内容一律不展示
   ========================================================================== */
const IDENTITIES = ['普通用户','影像作者','解说人','剪辑师','摄影','编剧','配乐','演员','策展人','独立记者','素人','匿名账号','品牌主理人','学生','夜班工作者'];
const RELATIONS  = ['陌生人','点头之交','同事','同学','朋友','老友','家人','恋人','前任','邻居','网友','合作方','导师','学生','对手'];

LP.syncRoles = async function (quiet) {
  const chars = await getAllChars();
  const roles = S.roles || {};
  let added = 0;
  chars.forEach(c => {
    const key = 'c' + c.id;
    if (!roles[key]) {
      added++;
      roles[key] = {
        key, charId: c.id, from: 'char',
        name: c.name || '未命名',
        nick: c.name || '未命名',
        handle: 'user_' + String(c.id).padStart(4, '0'),
        avatar: c.avatar || '', cover: c.cardBg || '',
        identity: pick(['普通用户','影像作者','素人','剪辑师','解说人']),
        relation: c.relation ? '朋友' : '陌生人',
        verify: 'none', verifyTxt: '',
        bio: (c.role || '') || '这个人还没有写签名。',
        fans: rnd(120, 68000), mutual: true, inDM: true, inCircle: true,
        knows: [], bond: rnd(0, 40),
        _role: c.role || '', _gender: c.gender || '', _age: c.age || '',
        _traits: c.traits || [], _lang: c.lang || '中文',
        _speech: c.speechStyle || '', _catch: c.catchphrases || [],
        _call: c.callUser || '', _relDetail: c.relationDetail || '',
        _first: c.firstMes || '', _prompt: c.prompt || '', _examples: c.dialogExamples || [],
        _never: c.neverList || [], _bound: c.boundaries || '', _len: c.replyLength || '适中'
      };
    } else {
      const r = roles[key];
      r.name = c.name || r.name;
      if (!r.avatar) r.avatar = c.avatar || '';
      if (!r.cover) r.cover = c.cardBg || '';
      r._prompt = c.prompt || r._prompt;
      r._first = c.firstMes || r._first;
      r._speech = c.speechStyle || r._speech;
      r._catch = c.catchphrases || r._catch;
      r._call = c.callUser || r._call;
      r._traits = c.traits || r._traits;
      r._lang = c.lang || r._lang;
      r._never = c.neverList || r._never;
      r._bound = c.boundaries || r._bound;
      r._len = c.replyLength || r._len;
      r._examples = c.dialogExamples || r._examples;
    }
  });
  S.roles = roles;
  await kvSet('roles', roles);
  buildGraph();
  if (!quiet) toast(added ? `已同步 ${chars.length} 个角色（新增 ${added}）` : `已同步 ${chars.length} 个角色`);
  renderRoleList();
  LP.renderDMList();
};

/* 社交关系网：谁认识谁 —— 决定好友圈里谁能推荐谁的东西 */
function buildGraph() {
  const keys = Object.keys(S.roles);
  keys.forEach(k => {
    const r = S.roles[k];
    if (!Array.isArray(r.knows)) r.knows = [];
    r.knows = r.knows.filter(x => S.roles[x] || S.npcs.find(n => n.key === x));
  });
  // 未指定认识关系时，按「同身份 / 同关系层」自动连边，保证推荐链条成立
  keys.forEach(k => {
    const r = S.roles[k];
    if (r.knows.length) return;
    const pool = keys.filter(x => x !== k);
    const n = Math.min(pool.length, rnd(1, 3));
    const shuffled = pool.slice().sort(() => Math.random() - 0.5).slice(0, n);
    r.knows = shuffled;
    shuffled.forEach(o => { if (!S.roles[o].knows.includes(k)) S.roles[o].knows.push(k); });
  });
}
function knowsEachOther(a, b) {
  const ra = S.roles[a], rb = S.roles[b];
  if (!ra || !rb) return false;
  return (ra.knows || []).includes(b) || (rb.knows || []).includes(a);
}

function renderRoleList() {
  const keys = Object.keys(S.roles);
  $('rlCount').textContent = keys.length ? `已同步 ${keys.length} 个角色 · 身份、关系、可见性全部可改` : '尚未同步。点上方按钮从角色书拉取。';
  const host = $('rlList');
  if (!keys.length) { host.innerHTML = `<div style="padding:34px 10px;text-align:center;font-size:11.5px;color:var(--ink4);line-height:1.9;">角色书里还没有角色<br>先去「角色档案」创建，再回来同步</div>`; return; }
  host.innerHTML = keys.map((k, i) => {
    const r = S.roles[k];
    return `<div class="rli" data-k="${k}" style="animation-delay:${i*0.04}s">
      <div class="rli-av">${r.avatar ? `<img src="${r.avatar}">` : esc((r.nick||'?')[0])}</div>
      <div class="rli-c">
        <div class="rli-n">${esc(r.nick)}${verifySVG(r.verify, 13)}</div>
        <div class="rli-m">@${esc(r.handle)} · ${nfmt(r.fans)} 粉丝</div>
        <div class="rli-chips">
          <span class="rli-chip">${esc(r.identity)}</span>
          <span class="rli-chip grey">${esc(r.relation)}</span>
          ${r.mutual ? '<span class="rli-chip">互关</span>' : ''}
          ${r.inDM ? '' : '<span class="rli-chip grey">私信隐藏</span>'}
        </div>
      </div>
      <div class="rli-edit"><svg viewBox="0 0 24 24" width="13" height="13" fill="none"><path d="M4 17.5V20h2.5L17 9.5 14.5 7 4 17.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></div>
    </div>`;
  }).join('');
  $$('.rli', host).forEach(el => el.onclick = () => openRoleEditor(el.dataset.k));
}

/* 随机名片（人设绝不展示） */
function openRandomCard() {
  const keys = Object.keys(S.roles);
  if (!keys.length) { toast('先同步角色书'); return; }
  const r = S.roles[pick(keys)];
  const bond = bondLevelOf(r.bond || 0);
  $('crCard').innerHTML = `
    <div class="crc-top">
      <div class="crc-top-img" style="${r.cover ? `background-image:url(${r.cover})` : `background:${pick(Object.values(THEME_MAP))}`}"></div>
      <div class="crc-av">${r.avatar ? `<img src="${r.avatar}">` : esc((r.nick||'?')[0])}</div>
    </div>
    <div class="crc-b">
      <div class="crc-n">${esc(r.nick)}${verifySVG(r.verify, 15)}</div>
      <div class="crc-h">@${esc(r.handle)}</div>
      ${r.verify !== 'none' && r.verifyTxt ? `<div style="font-size:11px;color:var(--iris);margin-top:6px;">${esc(r.verifyTxt)}</div>` : ''}
      <div class="crc-bio">${esc(r.bio)}</div>
      <div class="crc-row">
        <div class="crc-s"><b>${nfmt(r.fans)}</b><span>粉丝</span></div>
        <div class="crc-s"><b>${esc(r.identity)}</b><span>身份</span></div>
        <div class="crc-s"><b>${esc(r.relation)}</b><span>关系</span></div>
      </div>
      <div class="crc-chips">${bondHTML(bond, true)}<span class="rli-chip">${r.mutual ? '互相关注' : '单向关注'}</span></div>
      <div class="crc-seal">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none"><rect x="5" y="10.5" width="14" height="9" rx="2.4" stroke="currentColor" stroke-width="1.4"/><path d="M8.4 10.5V8a3.6 3.6 0 017.2 0v2.5" stroke="currentColor" stroke-width="1.4"/></svg>
        <span>人设与提示词已封存，名片只展示对外身份，不会泄露角色设定。</span>
      </div>
      <div class="crc-acts">
        <div class="crc-act p" data-act="dm">发私信</div>
        <div class="crc-act g" data-act="edit">改身份</div>
        <div class="crc-act g" data-act="again">换一张</div>
      </div>
    </div>`;
  openOverlay('cardRail');
  $$('.crc-act').forEach(b => b.onclick = () => {
    const a = b.dataset.act;
    if (a === 'again') return openRandomCard();
    closeOverlay('cardRail');
    if (a === 'dm') { closePage('pgInfo'); closePage('pgArchive'); go('scDM'); setTimeout(() => LP.openChat(r.key), 320); }
    if (a === 'edit') openRoleEditor(r.key);
  });
}

/* 角色在 App 内的身份编辑 */
let _editRoleKey = null;
function openRoleEditor(key) {
  const r = S.roles[key];
  if (!r) return;
  _editRoleKey = key;
  $('shRoleName').textContent = r.name + ' · 在 Lunaplay 的身份';
  $('rfNick').value = r.nick; $('rfHandle').value = r.handle; $('rfBio').value = r.bio;
  $('rfVerifyTxt').value = r.verifyTxt || ''; $('rfFans').value = r.fans;
  $('rfKnows').value = (r.knows || []).map(k => (S.roles[k] || {}).nick || '').filter(Boolean).join(',');
  optRow('rfIdentity', IDENTITIES, r.identity, v => r._tmpIdentity = v);
  optRow('rfRelation', RELATIONS, r.relation, v => r._tmpRelation = v);
  optRow('rfVerify', Object.keys(VERIFY_KIND).map(k => [k, VERIFY_KIND[k].n]), r.verify, v => r._tmpVerify = v);
  optRow('rfMutual', [['y','是'],['n','否']], r.mutual ? 'y' : 'n', v => r._tmpMutual = v);
  optRow('rfInDM', [['y','是'],['n','否']], r.inDM ? 'y' : 'n', v => r._tmpDM = v);
  optRow('rfInCircle', [['y','是'],['n','否']], r.inCircle ? 'y' : 'n', v => r._tmpCircle = v);
  r._tmpIdentity = r.identity; r._tmpRelation = r.relation; r._tmpVerify = r.verify;
  r._tmpMutual = r.mutual ? 'y':'n'; r._tmpDM = r.inDM ? 'y':'n'; r._tmpCircle = r.inCircle ? 'y':'n';
  openSheet('shRole');
}
async function saveRoleEditor() {
  const r = S.roles[_editRoleKey];
  if (!r) return;
  r.nick = $('rfNick').value.trim() || r.name;
  r.handle = ($('rfHandle').value.trim() || r.handle).replace(/^@/,'');
  r.bio = $('rfBio').value.trim() || r.bio;
  r.verifyTxt = $('rfVerifyTxt').value.trim();
  r.fans = +$('rfFans').value || r.fans;
  r.identity = r._tmpIdentity; r.relation = r._tmpRelation; r.verify = r._tmpVerify;
  r.mutual = r._tmpMutual === 'y'; r.inDM = r._tmpDM === 'y'; r.inCircle = r._tmpCircle === 'y';
  const names = $('rfKnows').value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
  if (names.length) {
    const map = {};
    Object.keys(S.roles).forEach(k => map[S.roles[k].nick] = k);
    r.knows = names.map(n => map[n]).filter(Boolean);
    r.knows.forEach(k => { if (!S.roles[k].knows.includes(_editRoleKey)) S.roles[k].knows.push(_editRoleKey); });
  }
  await kvSet('roles', S.roles);
  closeSheet('shRole');
  renderRoleList(); LP.renderDMList();
  toast('身份已更新');
}

/* ==========================================================================
   数据信息
   ========================================================================== */
function last7() {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const k = dayKey(d.getTime());
    out.push({ k, label: (d.getMonth()+1) + '/' + d.getDate(), v: (S.stats.days[k] || 0) });
  }
  return out;
}
LP.renderData = function () {
  const st = S.stats;
  const d7 = last7();
  const maxD = Math.max(1, ...d7.map(x => x.v));
  const mins = Math.round(st.watchSec / 60);
  const finishRate = st.watch ? Math.round(st.finish / st.watch * 100) : 0;
  const inter = st.watch ? Math.round((st.like + st.fav + st.share + st.rec) / st.watch * 100) : 0;
  const tagArr = Object.entries(st.tags).sort((a,b) => b[1]-a[1]).slice(0, 6);
  const tagMax = Math.max(1, ...tagArr.map(x => x[1]));
  const typeArr = Object.entries(st.types).sort((a,b) => b[1]-a[1]).slice(0, 5);
  const auArr = Object.entries(st.topAuthors).sort((a,b) => b[1]-a[1]).slice(0, 5);
  const hourMax = Math.max(1, ...st.hours);
  const colors = ['#7c6cf5','#a58cf8','#c58cf5','#ff9fc0','#8fc0ff','#8fe3cd'];

  $('dataBody').innerHTML = `
    <div class="dt-hero">
      <div class="dth-k">TOTAL WATCH TIME</div>
      <div class="dth-n">${mins}<span style="font-size:16px;opacity:.6;"> min</span></div>
      <div class="dth-u">共观看 ${nfmt(st.watch)} 条影像 · 自 ${new Date(st.first).getFullYear()}.${String(new Date(st.first).getMonth()+1).padStart(2,'0')} 起</div>
      <div class="dth-row">
        <div class="dth-s"><b>${finishRate}%</b><span>完播率</span></div>
        <div class="dth-s"><b>${inter}%</b><span>互动率</span></div>
        <div class="dth-s"><b>${nfmt(st.comment)}</b><span>互动选择</span></div>
      </div>
    </div>

    <div class="dt-grid">
      ${[['点赞', st.like, 'LIKES'],['收藏', st.fav, 'SAVED'],['转发', st.share, 'SHARED'],['推荐', st.rec, 'RECOMMEND']].map(x => `
        <div class="dt-c">
          <div class="dt-c-k">${x[2]}</div>
          <div class="dt-c-n">${nfmt(x[1])}</div>
          <div class="dt-c-d">${x[0]}总数</div>
          <div class="dt-c-bar"><i style="width:${clamp(x[1] / Math.max(1, st.watch) * 100, 3, 100)}%"></i></div>
        </div>`).join('')}
    </div>

    <div class="dt-card">
      <div class="dt-hd"><b>近 7 日观看</b><em>WEEKLY</em><i>峰值 ${maxD}</i></div>
      <div class="spark">
        ${d7.map((x, i) => `<div class="spk">
          <div class="spk-b ${i%2?'alt':''}" style="height:${clamp(x.v/maxD*62, 4, 62)}px;animation-delay:${i*0.06}s"></div>
          <div class="spk-l">${x.label}</div></div>`).join('')}
      </div>
    </div>

    <div class="dt-card">
      <div class="dt-hd"><b>题材偏好</b><em>TASTE</em></div>
      <div class="taste">
        ${tagArr.length ? tagArr.map((t, i) => `
          <div class="ts-r"><div class="ts-n">${esc(t[0])}</div>
          <div class="ts-bar"><i style="width:${Math.round(t[1]/tagMax*100)}%;background:${colors[i%colors.length]}"></i></div>
          <div class="ts-p">${t[1]}</div></div>`).join('')
          : '<div style="font-size:11px;color:var(--ink4);line-height:1.9;">还没有足够的观看记录来判断偏好。</div>'}
      </div>
    </div>

    <div class="dt-card">
      <div class="dt-hd"><b>活跃时段</b><em>RHYTHM</em><i>24h</i></div>
      <div class="heat">
        ${st.hours.map((v, h) => `<div class="ht" title="${h}:00" style="background:rgba(124,108,245,${(0.06 + v/hourMax*0.72).toFixed(2)})"></div>`).join('')}
      </div>
      <div class="heat-lg"><i style="background:rgba(124,108,245,.08)"></i>少<i style="background:rgba(124,108,245,.42)"></i><i style="background:rgba(124,108,245,.78)"></i>多</div>
    </div>

    <div class="dt-card">
      <div class="dt-hd"><b>形态分布</b><em>FORMAT</em></div>
      <div class="rec-list">
        ${typeArr.length ? typeArr.map((t, i) => `
          <div class="rc-i"><div class="rc-x" style="background:${colors[i%colors.length]}">${String(i+1).padStart(2,'0')}</div>
          <div class="rc-t">${esc(t[0])}</div><div class="rc-v">${t[1]} 条</div></div>`).join('')
          : '<div style="font-size:11px;color:var(--ink4);">暂无数据。</div>'}
      </div>
    </div>

    <div class="dt-card">
      <div class="dt-hd"><b>你最常看的人</b><em>AUTHORS</em></div>
      <div class="rec-list">
        ${auArr.length ? auArr.map((t, i) => `
          <div class="rc-i"><div class="rc-x" style="background:${colors[(i+2)%colors.length]}">${esc(t[0][0])}</div>
          <div class="rc-t">${esc(t[0])}</div><div class="rc-v">${t[1]} 次</div></div>`).join('')
          : '<div style="font-size:11px;color:var(--ink4);">暂无数据。</div>'}
      </div>
    </div>`;
};

/* ==========================================================================
   星链 —— 星阶 40 级 / 羁绊 30 级 / 任务 21 项
   ========================================================================== */
const STAGE_NAMES = ['微光','初芒','启明','拂晓','薄暮','夜航','银线','潮信','碎星','引路',
  '寒星','溯游','长庚','流萤','孤月','浮云','霜降','回望','远汐','幽篁',
  '渡口','折光','明河','雪线','极夜','初潮','连星','燃烬','纪年','观星',
  '恒温','引力','裂帛','星槎','无声','昼夜','旧梦','余音','未名','原点'];
function linkPoints() {
  const st = S.stats;
  let msg = 0;
  Object.values(S.dms).forEach(d => msg += (d.msgs || []).length);
  return st.watch * 2 + st.like * 3 + st.fav * 5 + st.share * 5 + st.rec * 8 + st.comment * 3 + msg * 2;
}
function stageNeed(lv) { return Math.round(Math.pow(lv - 1, 1.85) * 16); }
function linkLevel() {
  const p = linkPoints();
  let lv = 1;
  for (let i = 1; i <= 40; i++) if (p >= stageNeed(i)) lv = i;
  return lv;
}
function taskList() {
  const st = S.stats;
  let msgCount = 0, bondMax = 1, chatCount = 0;
  Object.values(S.dms).forEach(d => { msgCount += (d.msgs || []).filter(m => m.side === 'me').length; if ((d.msgs||[]).length) chatCount++; });
  Object.values(S.roles).forEach(r => bondMax = Math.max(bondMax, bondLevelOf(r.bond || 0)));
  const strangers = S.npcs.filter(n => n.stranger).length;
  const d = dayKey(Date.now());
  const today = S.tasks.day === d ? S.tasks.today : { watch:0, like:0, msg:0, gen:0, rec:0, fav:0 };
  return [
    { g:'daily', ic:'d', t:'今日观看 5 条影像', d:'在推荐页看满 5 条', cur:today.watch, need:5, rw:'+30 星链值' },
    { g:'daily', ic:'d', t:'今日点赞 3 次', d:'把喜欢留在这里', cur:today.like, need:3, rw:'+18 星链值' },
    { g:'daily', ic:'d', t:'今日收藏 1 条', d:'收进你的私人片库', cur:today.fav, need:1, rw:'+12 星链值' },
    { g:'daily', ic:'d', t:'今日发出 3 条私信', d:'和任何人说三句话', cur:today.msg, need:3, rw:'+20 星链值' },
    { g:'daily', ic:'d', t:'今日生成 1 次影像', d:'拉一次光弦', cur:today.gen, need:1, rw:'+25 星链值' },
    { g:'daily', ic:'d', t:'今日推荐 1 条', d:'让别人也看见', cur:today.rec, need:1, rw:'+35 星链值' },
    { g:'week', ic:'w', t:'本周观看 40 条', d:'把这一周填满', cur:Math.min(st.watch, 40), need:40, rw:'+180 星链值' },
    { g:'week', ic:'w', t:'开启 3 段新对话', d:'认识新的人', cur:chatCount, need:3, rw:'+120 星链值' },
    { g:'week', ic:'w', t:'拾取 2 个陌生信号', d:'在私信页轻触信号点', cur:strangers, need:2, rw:'+140 星链值' },
    { g:'week', ic:'w', t:'尝试 4 种影像形态', d:'解说 / 分支 / 投票 / 图文', cur:Object.keys(st.types).length, need:4, rw:'+150 星链值' },
    { g:'week', ic:'w', t:'完播 15 条', d:'看到最后一帧', cur:Math.min(st.finish, 15), need:15, rw:'+160 星链值' },
    { g:'ach', ic:'a', t:'第一次点赞', d:'一切从这里开始', cur:Math.min(st.like,1), need:1, rw:'称号 · 微光' },
    { g:'ach', ic:'a', t:'收藏满 20 条', d:'你的片库初具规模', cur:Math.min(st.fav,20), need:20, rw:'称号 · 收藏家' },
    { g:'ach', ic:'a', t:'累计观看 200 条', d:'长夜有你', cur:Math.min(st.watch,200), need:200, rw:'称号 · 夜航者' },
    { g:'ach', ic:'a', t:'羁绊达到 10 级', d:'和某个人真正熟起来', cur:Math.min(bondMax,10), need:10, rw:'称号 · 同频' },
    { g:'ach', ic:'a', t:'羁绊达到 20 级', d:'有些关系会长出重量', cur:Math.min(bondMax,20), need:20, rw:'称号 · 引力' },
    { g:'ach', ic:'a', t:'发出 300 条消息', d:'话多是一种诚意', cur:Math.min(msgCount,300), need:300, rw:'称号 · 长谈' },
    { g:'ach', ic:'a', t:'推荐 30 条影像', d:'你是别人的信源', cur:Math.min(st.rec,30), need:30, rw:'称号 · 引路' },
    { g:'ach', ic:'a', t:'消费等级达到 10 级', d:'为喜欢的东西付过费', cur:Math.min(spendLevel(S.coin.spent),10), need:10, rw:'称号 · 拾光' },
    { g:'ach', ic:'a', t:'星阶达到 20 级', d:'走到一半了', cur:Math.min(linkLevel(),20), need:20, rw:'称号 · 观星' },
    { g:'ach', ic:'a', t:'星阶达到 40 级', d:'回到原点', cur:Math.min(linkLevel(),40), need:40, rw:'称号 · 原点' }
  ];
}
function taskDone() { return taskList().filter(t => t.cur >= t.need).length; }
function bumpTask(kind, n) {
  const d = dayKey(Date.now());
  if (S.tasks.day !== d) S.tasks = { day: d, today: { watch:0, like:0, msg:0, gen:0, rec:0, fav:0 } };
  S.tasks.today[kind] = (S.tasks.today[kind] || 0) + (n || 1);
  kvSet('tasks', S.tasks);
}

LP.renderLink = function (tab) {
  const body = $('linkBody');
  const lv = linkLevel(), pts = linkPoints();
  const cur = stageNeed(lv), nxt = stageNeed(Math.min(lv + 1, 40));
  const pct = lv >= 40 ? 100 : clamp((pts - cur) / Math.max(1, nxt - cur) * 100, 0, 100);

  if (tab === 'me') {
    const rail = [];
    for (let i = Math.max(1, lv - 2); i <= Math.min(40, lv + 6); i++) {
      rail.push(`<div class="lv-c ${i === lv ? 'now' : (i > lv ? 'lock' : '')}">
        ${linkBadgeSVG(i, 46)}<b>${STAGE_NAMES[i-1]}</b><span>LV.${i}</span></div>`);
    }
    body.innerHTML = `
      <div class="lk-hero">
        <div class="lk-badge-wrap">
          <div class="lk-badge">${linkBadgeSVG(lv, 82)}</div>
          <div class="lk-info">
            <div class="lk-lv">STELLAR STAGE ${String(lv).padStart(2,'0')} / 40</div>
            <div class="lk-nm">${STAGE_NAMES[lv-1]}</div>
            <div class="lk-nx">${lv >= 40 ? '已抵达最高星阶' : `距离「${STAGE_NAMES[lv]}」还差 ${nxt - pts} 点`}</div>
          </div>
        </div>
        <div class="lk-prog">
          <div class="lk-pb"><i style="width:${pct}%"></i></div>
          <div class="lk-pn"><span>${pts} 星链值</span><span>${lv >= 40 ? 'MAX' : nxt}</span></div>
        </div>
      </div>
      <div class="dt-hd" style="padding:0 2px 10px;"><b>星阶轨道</b><em>ORBIT</em><i>共 40 阶</i></div>
      <div class="lv-rail">${rail.join('')}</div>
      <div class="dt-grid">
        <div class="dt-c"><div class="dt-c-k">TASKS</div><div class="dt-c-n">${taskDone()}<span style="font-size:13px;color:var(--ink4);">/21</span></div><div class="dt-c-d">已完成任务</div><div class="dt-c-bar"><i style="width:${taskDone()/21*100}%"></i></div></div>
        <div class="dt-c"><div class="dt-c-k">BONDS</div><div class="dt-c-n">${Object.keys(S.roles).length}</div><div class="dt-c-d">羁绊对象</div><div class="dt-c-bar"><i style="width:${clamp(Object.keys(S.roles).length*8,4,100)}%"></i></div></div>
      </div>`;
  }
  if (tab === 'bond') {
    const keys = Object.keys(S.roles).sort((a,b) => (S.roles[b].bond||0) - (S.roles[a].bond||0));
    body.innerHTML = keys.length ? `<div class="bond-list">${keys.map(k => {
      const r = S.roles[k], b = bondLevelOf(r.bond || 0);
      const cn = bondNeed(b), nn = bondNeed(Math.min(b+1, 30));
      const pp = b >= 30 ? 100 : clamp(((r.bond||0) - cn) / Math.max(1, nn - cn) * 100, 0, 100);
      return `<div class="bd-i">
        <div class="bd-av">${r.avatar ? `<img src="${r.avatar}">` : esc((r.nick||'?')[0])}</div>
        <div class="bd-c"><div class="bd-n">${esc(r.nick)}</div>
          <div class="bd-bar"><i style="width:${pp}%"></i></div>
          <div class="bd-v">${r.bond||0} 点 · ${b >= 30 ? 'MAX' : `距 ${b+1} 级还差 ${nn - (r.bond||0)}`}</div></div>
        ${bondHTML(b)}
      </div>`;
    }).join('')}</div>` : `<div style="padding:44px 12px;text-align:center;font-size:11.5px;color:var(--ink4);line-height:1.95;">还没有羁绊<br>去私信页和谁说说话，羁绊会自己长出来</div>`;
  }
  if (tab === 'task') {
    const ts = taskList();
    const sec = (g, title, key) => {
      const arr = ts.filter(t => t.g === g);
      return `<div class="dt-hd" style="padding:6px 2px 10px;"><b>${title}</b><em>${key}</em><i>${arr.filter(t=>t.cur>=t.need).length}/${arr.length}</i></div>
      <div class="task-g" style="margin-bottom:16px;">${arr.map((t, i) => `
        <div class="tk ${t.cur>=t.need?'done':''}" style="animation-delay:${i*0.04}s">
          <div class="tk-ic ${t.ic}">${t.cur>=t.need
            ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M6 12.4l4 4 8-8.6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
            : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none"><circle cx="12" cy="12" r="7.5" stroke="currentColor" stroke-width="1.5"/><path d="M12 8v4.4l2.8 1.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`}</div>
          <div class="tk-c"><div class="tk-t">${t.t}</div><div class="tk-d">${t.d}</div>
            <div class="tk-bar"><i style="width:${clamp(t.cur/t.need*100,0,100)}%"></i></div></div>
          <div class="tk-r"><b>${t.cur>=t.need?'已完成':t.cur+'/'+t.need}</b><span>${t.rw}</span></div>
        </div>`).join('')}</div>`;
    };
    body.innerHTML = sec('daily','每日任务','DAILY') + sec('week','每周任务','WEEKLY') + sec('ach','成就','ACHIEVEMENT');
  }
  if (tab === 'rule') {
    body.innerHTML = `
      <div class="rule-c"><h4>星链是什么</h4>
        <p>星链记录你在 Lunaplay 留下的所有痕迹。它由两条线组成：<b>星阶</b>是你个人的总进度，共 40 阶；<b>羁绊</b>是你和每一个具体的人之间的温度，共 30 级，会显示在私信列表和聊天页顶部。</p></div>
      <div class="rule-c"><h4>星链值怎么涨</h4>
        <p>观看 <b>+2</b> · 点赞 <b>+3</b> · 收藏 <b>+5</b> · 转发 <b>+5</b> · 推荐 <b>+8</b> · 互动选择 <b>+3</b> · 每条消息 <b>+2</b>。</p>
        <p>星阶所需值按 1.85 次幂递增，越往后越慢，40 阶「原点」是终点。</p></div>
      <div class="rule-c"><h4>羁绊怎么涨</h4>
        <p>你每发一条消息 <b>+1</b>，对方每回一条 <b>+1</b>，转发影像给对方 <b>+3</b>。羁绊分 8 个色阶，每 4 级换一次徽章造型与配色。</p>
        <p>羁绊只会增长，不会因为冷落而衰减——这里不惩罚沉默。</p></div>
      <div class="rule-c"><h4>任务</h4>
        <p>每日 6 项、每周 5 项、成就 10 项，共 <b>21 项</b>。每日任务按自然日重置，成就永久保留。</p></div>
      <div class="rule-c"><h4>你的当前数据</h4>
        <p>星阶 <b>Lv.${lv} ${STAGE_NAMES[lv-1]}</b> · 星链值 <b>${pts}</b> · 已完成任务 <b>${taskDone()}/21</b> · 羁绊对象 <b>${Object.keys(S.roles).length}</b> 人</p></div>`;
  }
};

/* ==========================================================================
   星光币  ·  1 Lune = 10 星光币
   ========================================================================== */
const RATE = 10;
const SPEND_TIER = ['拾光','微芒','初焰','浮星','流银','明砂','霜华','琉璃','鎏金','长明'];
function spendNeed(lv) { return Math.round(Math.pow(lv - 1, 1.95) * 26); }
function spendLevel(spent) {
  let lv = 1;
  for (let i = 1; i <= 50; i++) if (spent >= spendNeed(i)) lv = i;
  return lv;
}
function spendName(lv) { return SPEND_TIER[clamp(Math.ceil(lv/5),1,10)-1] + ' ' + ['壹','贰','叁','肆','伍'][(lv-1)%5]; }

LP.renderCoin = async function (tab) {
  const body = $('coinBody');
  const lv = spendLevel(S.coin.spent);
  const cur = spendNeed(lv), nxt = spendNeed(Math.min(lv+1, 50));
  const pct = lv >= 50 ? 100 : clamp((S.coin.spent - cur) / Math.max(1, nxt - cur) * 100, 0, 100);

  if (tab === 'wallet') {
    const home = await walletHome();
    const bal = home ? Number(home.balance || 0) : 0;
    const sec = await walletSecurity();
    body.innerHTML = `
      <div class="co-card">
        <div class="co-k"><span>STARLIGHT BALANCE</span><i>1 Lune = ${RATE} 星光币</i></div>
        <div class="co-n"><b>${nfmt(S.coin.balance)}</b><em>STARLIGHT</em></div>
        <div class="co-eq">约等于 ${(S.coin.balance / RATE).toFixed(2)} Lune · 钱包余额 ${bal.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})} Lune</div>
        <div class="co-acts"><div class="co-a p" id="coTopup">兑换星光币</div><div class="co-a g" id="coBill">查看流水</div></div>
      </div>
      <div class="sp-hero">
        <div class="sp-badge">${medalSVG(lv, 76)}</div>
        <div class="sp-i">
          <div class="sp-lv">SPEND LEVEL ${String(lv).padStart(2,'0')} / 50</div>
          <div class="sp-nm">${spendName(lv)}</div>
          <div class="sp-nx">${lv>=50 ? '已达最高消费等级' : `累计消费 ${S.coin.spent} · 距 Lv.${lv+1} 还差 ${nxt - S.coin.spent}`}</div>
          <div class="sp-pb"><i style="width:${pct}%"></i></div>
        </div>
      </div>
      <div class="dt-grid">
        <div class="dt-c"><div class="dt-c-k">TOTAL SPENT</div><div class="dt-c-n">${nfmt(S.coin.spent)}</div><div class="dt-c-d">累计消费星光币</div><div class="dt-c-bar"><i style="width:${pct}%"></i></div></div>
        <div class="dt-c"><div class="dt-c-k">ORDERS</div><div class="dt-c-n">${S.coin.bills.filter(b=>b.dir==='out').length}</div><div class="dt-c-d">消费笔数</div><div class="dt-c-bar"><i style="width:${clamp(S.coin.bills.length*6,4,100)}%"></i></div></div>
      </div>
      <div class="rule-c"><h4>与 Luna 钱包的关系</h4>
        <p>星光币是 Lunaplay 内部的虚拟数字，不涉及任何真实交易。兑换时按 <b>1 : ${RATE}</b> 从 Luna 钱包主余额扣款，并写入钱包的交易记录。</p>
        <p>支付密码状态：<b>${sec.enabled && sec.pin ? '已启用，兑换时需要验证' : '未启用，兑换免密'}</b>。余额不足时兑换会被拦截。</p></div>`;
    $('coTopup').onclick = openTopup;
    $('coBill').onclick = () => { $$('#coinSeg .sg').forEach(x => x.classList.toggle('on', x.dataset.g === 'bill')); LP._coinSegMove && LP._coinSegMove(); LP.renderCoin('bill'); };
  }
  if (tab === 'level') {
    let html = `<div class="sp-hero"><div class="sp-badge">${medalSVG(lv, 76)}</div>
      <div class="sp-i"><div class="sp-lv">CURRENT</div><div class="sp-nm">Lv.${lv} ${spendName(lv)}</div>
      <div class="sp-nx">50 级消费等级，每一级一枚独立造型的勋章。</div>
      <div class="sp-pb"><i style="width:${pct}%"></i></div></div></div>`;
    for (let g = 0; g < 10; g++) {
      html += `<div class="dt-hd" style="padding:8px 2px 10px;"><b>${SPEND_TIER[g]}</b><em>TIER ${String(g+1).padStart(2,'0')}</em><i>Lv.${g*5+1} - ${g*5+5}</i></div><div class="medal-grid" style="margin-bottom:14px;">`;
      for (let i = 1; i <= 5; i++) {
        const L = g * 5 + i;
        html += `<div class="md ${L===lv?'now':(L>lv?'lock':'')}">${medalSVG(L, 52)}<b>LV.${L}</b><span>${spendName(L)}</span></div>`;
      }
      html += `</div>`;
    }
    body.innerHTML = html;
  }
  if (tab === 'bill') {
    body.innerHTML = S.coin.bills.length
      ? S.coin.bills.slice().reverse().map(b => `
        <div class="bill-i">
          <div class="bl-ic ${b.dir}">${b.dir==='out'
            ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="none"><path d="M12 5v14M19 12l-7-7-7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`
            : `<svg viewBox="0 0 24 24" width="14" height="14" fill="none"><path d="M12 19V5M5 12l7 7 7-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`}</div>
          <div class="bl-c"><div class="bl-t">${esc(b.name)}</div><div class="bl-d">${esc(b.time)}</div></div>
          <div class="bl-a ${b.dir}">${b.dir==='out'?'-':'+'}${b.amount}</div>
        </div>`).join('')
      : `<div style="padding:44px 12px;text-align:center;font-size:11.5px;color:var(--ink4);line-height:1.95;">还没有任何流水<br>兑换或解锁付费影像后会出现在这里</div>`;
  }
};

let _tpAmount = 0;
async function openTopup() {
  const home = await walletHome();
  const bal = home ? Number(home.balance || 0) : 0;
  $('tpWalletBal').textContent = bal.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' Lune';
  $('tpCoinBal').textContent = nfmt(S.coin.balance) + ' 星光';
  const opts = [100, 300, 500, 1000, 3000, 6800];
  $('tpGrid').innerHTML = opts.map(o => `<div class="tpo" data-v="${o}"><b>${o}</b><span>${(o/RATE).toFixed(o%RATE?2:0)} Lune</span></div>`).join('');
  $$('.tpo').forEach(o => o.onclick = () => {
    $$('.tpo').forEach(x => x.classList.remove('on'));
    o.classList.add('on'); $('tpCustom').value = '';
    _tpAmount = +o.dataset.v; updateCalc();
  });
  $('tpCustom').oninput = () => {
    $$('.tpo').forEach(x => x.classList.remove('on'));
    _tpAmount = +$('tpCustom').value || 0; updateCalc();
  };
  _tpAmount = 0; updateCalc();
  openSheet('shTopup');
}
function updateCalc() { $('tpCalc').textContent = `将扣款 ${(_tpAmount / RATE).toFixed(2)} Lune`; }
async function doTopup() {
  const amt = _tpAmount;
  if (!amt || amt <= 0) { toast('请选择或输入星光币数量'); return; }
  if (amt % RATE !== 0) { toast(`数量必须是 ${RATE} 的倍数`); return; }
  const cost = amt / RATE;
  const home = await walletHome();
  if (!home) { toast('未找到 Luna 钱包账户，请先在钱包 App 里完成开户'); return; }
  const bal = Number(home.balance || 0);
  if (bal < cost) { toast(`余额不足，还差 ${(cost - bal).toFixed(2)} Lune`); return; }
  const ok = await requirePayPassword();
  if (!ok) { toast('已取消支付'); return; }
  const now = new Date();
  const dstr = `${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')} · ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const txs = Array.isArray(home.transactions) ? home.transactions.slice() : [];
  txs.unshift({ dir:'out', name:'Lunaplay 星光币兑换', date:dstr, ts:now.getTime(), amount:cost });
  await walletSaveHome({ ...home, balance: bal - cost, transactions: txs, spend: Number(home.spend||0) + cost });
  S.coin.balance += amt;
  S.coin.bills.push({ dir:'in', name:`兑换星光币 · 扣款 ${cost.toFixed(2)} Lune`, time: nowStr(), amount: amt });
  await kvSet('coin', S.coin);
  closeSheet('shTopup');
  toast(`兑换成功，到账 ${amt} 星光币`);
  LP.renderCoin('wallet'); LP.renderMe();
}
async function spendCoin(amount, name) {
  if (S.coin.balance < amount) { toast(`星光币不足，还差 ${amount - S.coin.balance}`); return false; }
  const ok = await requirePayPassword();
  if (!ok) { toast('已取消支付'); return false; }
  S.coin.balance -= amount;
  S.coin.spent += amount;
  S.coin.bills.push({ dir:'out', name, time: nowStr(), amount });
  await kvSet('coin', S.coin);
  LP.renderMe();
  return true;
}

/* ==========================================================================
   内容宇宙
   ========================================================================== */
LP.renderUniverse = function () {
  const u = S.universe;
  $('uvBody').innerHTML = `
    <div class="uv-c">
      <div class="uv-hd">世界观 <em>WORLDVIEW</em></div>
      <div class="fld col"><label>宇宙名称</label><input id="uName" value="${esc(u.name)}"></div>
      <div class="fld col"><label>世界设定（所有影像都发生在这里）</label><textarea id="uWorld" rows="5">${esc(u.world)}</textarea></div>
      <div class="fld"><label>纪元</label><div class="opt-row wrap" id="uEra"></div></div>
      <div class="uv-tip">世界观会被写进每一次生成的系统提示里，决定影像的物理规则与质感。</div>
    </div>
    <div class="uv-c">
      <div class="uv-hd">限制规则 <em>LIMITS</em></div>
      <div class="fld"><label>尺度</label><div class="opt-row wrap" id="uRating"></div></div>
      <div class="fld col"><label>禁止出现的内容</label><textarea id="uRules" rows="4">${esc(u.rules)}</textarea></div>
      <div class="fld col"><label>禁用的表达方式</label><input id="uBanned" value="${esc(u.banned)}"></div>
      <div class="uv-tip">这是硬约束。生成时会以最高优先级注入，违反规则的内容不会被写出来。</div>
    </div>
    <div class="uv-c">
      <div class="uv-hd">文笔 <em>PROSE</em></div>
      <div class="fld col"><label>笔触要求</label><textarea id="uPen" rows="4">${esc(u.pen)}</textarea></div>
      <div class="fld"><label>叙述人称</label><div class="opt-row wrap" id="uPov"></div></div>
      <div class="fld"><label>描写密度</label><div class="opt-row" id="uDensity"></div></div>
      <div class="uv-tip">画面、对白、环境、心理四类描写会按这里的密度分配比例。</div>
    </div>
    <div class="uv-c">
      <div class="uv-hd">节奏与结局 <em>RHYTHM</em></div>
      <div class="fld"><label>单条时长</label><div class="opt-row wrap" id="uDur"></div></div>
      <div class="fld col"><label>结局偏好</label><textarea id="uEnd" rows="3">${esc(u.endings)}</textarea></div>
    </div>`;
  optRow('uEra', ['近未来 · 城市','当代 · 现实','复古 · 九十年代','架空 · 东方','架空 · 西幻','蒸汽 · 机械','末世 · 余烬','海洋 · 岛屿'], u.era, v => u.era = v);
  optRow('uRating', [['soft','克制'],['normal','常规'],['drama','强戏剧'],['calm','日常向']], u.rating, v => u.rating = v);
  optRow('uPov', ['第一人称','第三人称限制视角','第三人称全知','镜头旁白'], u.pov, v => u.pov = v);
  optRow('uDensity', ['低','中','高'], u.density, v => u.density = v);
  optRow('uDur', ['15-30秒','30-90秒','1-3分钟','3-8分钟'], u.dur, v => u.dur = v);
};
async function saveUniverse() {
  const u = S.universe;
  u.name = $('uName').value.trim() || u.name;
  u.world = $('uWorld').value.trim();
  u.rules = $('uRules').value.trim();
  u.banned = $('uBanned').value.trim();
  u.pen = $('uPen').value.trim();
  u.endings = $('uEnd').value.trim();
  await kvSet('universe', u);
  toast('内容宇宙已保存，之后所有生成都会遵守');
}

/* ==========================================================================
   推荐页 —— 生成台 + 影像流 + 播放器
   ========================================================================== */
const BGS = ['bg-dawn','bg-mist','bg-lilac','bg-rain','bg-bloom','bg-ice','bg-neonlite','bg-paper','bg-tide','bg-dusk','bg-grid','bg-silk','bg-star','bg-glass'];
const BG_NAMES = { 'bg-dawn':'晨曦','bg-mist':'薄雾','bg-lilac':'紫烟','bg-rain':'落雨','bg-bloom':'花信','bg-ice':'冰面','bg-neonlite':'霓虹白','bg-paper':'纸感','bg-tide':'潮汐','bg-dusk':'黄昏','bg-grid':'格线','bg-silk':'丝绸','bg-star':'星点','bg-glass':'玻璃' };
const VTYPES = [
  { k:'normal',  n:'普通短片',   d:'完整的一段影像，看到最后' },
  { k:'talk',    n:'解说',       d:'画外音带你拆一个故事' },
  { k:'branch',  n:'结局分支',   d:'结尾由你选择走向' },
  { k:'paid',    n:'付费解锁',   d:'后半段需要星光币解锁' },
  { k:'vote',    n:'中途投票',   d:'看到一半停下来，投一票' },
  { k:'graphic', n:'图文',       d:'一组配文的静帧' },
  { k:'doc',     n:'纪实片段',   d:'像被偷拍到的真实' },
  { k:'still',   n:'静帧长镜',   d:'几乎不动的一段时间' },
  { k:'twist',   n:'反转微剧',   d:'最后十秒推翻前面' },
  { k:'diary',   n:'第一人称日记', d:'一个人对着镜头说话' },
  { k:'series',  n:'连载一集',   d:'某个故事的中间一集' },
  { k:'silent',  n:'无对白',     d:'只有画面与环境音描述' }
];
const MOODS = ['温柔','清冷','慵懒','锋利','潮湿','明亮','疏离','热烈','怀旧','荒诞','悬疑','治愈'];
const LENS = ['很短','适中','偏长'];
const COUNTS = ['3 条','5 条','8 条'];
let _cp = { types: ['normal'], mood: '温柔', len: '适中', count: 3 };

function buildComposer() {
  $('cpTypes').innerHTML = VTYPES.map(t => `<div class="cpt${_cp.types.includes(t.k)?' on':''}" data-k="${t.k}"><b>${t.n}</b><span>${t.d}</span></div>`).join('');
  $$('.cpt').forEach(el => el.onclick = () => {
    const k = el.dataset.k;
    if (_cp.types.includes(k)) { if (_cp.types.length > 1) _cp.types = _cp.types.filter(x => x !== k); }
    else _cp.types.push(k);
    el.classList.toggle('on', _cp.types.includes(k));
  });
  const chips = (host, arr, cur, cb) => {
    $(host).innerHTML = arr.map(a => `<span class="opt${a===cur?' on':''}" data-v="${a}">${a}</span>`).join('');
    $$('.opt', $(host)).forEach(o => o.onclick = () => {
      $$('.opt', $(host)).forEach(x => x.classList.remove('on'));
      o.classList.add('on'); cb(o.dataset.v);
    });
  };
  chips('cpMoods', MOODS, _cp.mood, v => _cp.mood = v);
  chips('cpLens', LENS, _cp.len, v => _cp.len = v);
  chips('cpCounts', COUNTS, COUNTS[0], v => _cp.count = parseInt(v));
  const u = S.universe;
  $('cpUniverseNote').innerHTML = `本次生成将遵守内容宇宙：<b>${esc(u.name)}</b> · ${esc(u.era)} · ${esc(u.pov)} · 时长 ${esc(u.dur)}<br>限制规则与文笔取向已自动注入。`;
}

function universePrompt() {
  const u = S.universe;
  const p = S.profile;
  const st = S.stats;
  const tastes = Object.entries(st.tags).sort((a,b)=>b[1]-a[1]).slice(0,5).map(x=>x[0]);
  return `【内容宇宙 —— 最高优先级，必须遵守】
宇宙名称：${u.name}
世界设定：${u.world}
纪元：${u.era}
尺度：${u.rating}
硬性限制（禁止出现）：${u.rules}
禁用表达：${u.banned}
文笔要求：${u.pen}
叙述人称：${u.pov}
描写密度：${u.density}
单条时长：${u.dur}
结局偏好：${u.endings}

【观众画像 —— 用于贴合口味，不要写进正文】
昵称：${p.name}｜签名：${p.bio}｜标签：${(p.tags||[]).join('、') || '无'}
历史偏好题材：${tastes.join('、') || '暂无'}
累计观看 ${st.watch} 条，最常完播的类型：${Object.entries(st.types).sort((a,b)=>b[1]-a[1])[0]?.[0] || '暂无'}`;
}

async function generateFeed() {
  const theme = $('cpTheme').value.trim();
  if (!theme) { toast('先写下你想看什么'); return; }
  closeSheet('shComposer');
  loading(true, '正在织出影像');
  const typeNames = _cp.types.map(k => VTYPES.find(t => t.k === k)).filter(Boolean);
  const lenMap = { '很短':'每条 4-6 个镜头', '适中':'每条 7-10 个镜头', '偏长':'每条 11-15 个镜头' };
  const sys = `你是 Lunaplay 的影像生成引擎。你不生产真实视频，你用文字"描述"出一段让人上瘾的短影像，读者读着文字就像在刷短视频。
${universePrompt()}

【写作要求】
1. 每一条影像由若干"镜头"组成，${lenMap[_cp.len]}。
2. 每个镜头必须标注类型 k，取值只能是：vis(画面描写) / line(角色对白) / mind(心理) / env(环境与声音) / nar(旁白或解说) / txt(图文类的文字卡)。
3. line 类型必须带 who 字段（说话人名字）。其它类型不需要 who。
4. 描写要具体、有质感、有动作和细节，避免形容词堆砌与说教。对白要短、口语、有停顿感。
5. 开头 hook 必须在一句话内抓住人，让人想继续看。
6. 结尾按结局偏好处理，不要强行圆满，不要写"感谢观看"这类话。
7. 作者是这个世界里的陌生创作者，由你现编：名字、handle、简介、粉丝数、认证类型。绝对不要使用用户已有的任何角色。
8. 严禁出现任何违反硬性限制的内容。严禁写出"作为AI""本视频由AI生成"之类的话。

【影像形态】本次只能使用这些形态：${typeNames.map(t => `${t.k}(${t.n}：${t.d})`).join('、')}
- type=vote：在中间某个镜头后插入 block，kind="vote"，给出问题 q 与 2-3 个选项 opts。
- type=branch：在最后插入 block，kind="branch"，q 是"你想要哪一种结局"，opts 是 2-3 个结局走向，每个选项要有 result 字段写这个结局的一小段描写。
- type=paid：在中后段插入 block，kind="lock"，price 为 30-200 之间的整数（星光币），并在 opts 里放一个 result 字段，写解锁后的后续内容（3-6 个镜头，格式同 shots）。
- 其它形态不需要 block。

【气质】${_cp.mood}

只输出 JSON 数组，不要任何解释、不要 markdown 代码块。结构：
[{"type":"normal","title":"标题","hook":"一句话钩子","tags":["标签1","标签2"],"dur":72,
"author":{"name":"作者名","handle":"英文handle","bio":"一句签名","fans":12800,"verify":"none|blue|gold|violet|rose|mono","verifyTxt":""},
"shots":[{"k":"vis","txt":"..."},{"k":"line","who":"名字","txt":"..."}],
"block":{"kind":"vote","q":"...","opts":[{"t":"选项","result":"可选"}],"price":0}}]`;

  try {
    const raw = await aiChat([
      { role:'system', content: sys },
      { role:'user', content: `我想看：${theme}\n\n生成 ${_cp.count} 条影像，形态在允许范围内自行分配，尽量不要重复。` }
    ], { max: 4000, temp: 0.98 });
    const arr = parseJSON(raw);
    if (!Array.isArray(arr) || !arr.length) throw new Error('返回格式无法解析，请重试');
    const items = arr.map(x => normalizeVideo(x, theme));
    S.feed = S.feed.concat(items);
    if (S.feed.length > 90) S.feed = S.feed.slice(-90);
    await kvSet('feed', S.feed);
    bumpTask('gen');
    renderFeed();
    setTimeout(() => scrollToVid(items[0].id), 120);
    toast(`已织出 ${items.length} 条影像`);
  } catch (e) {
    toast(e.message || '生成失败');
  } finally { loading(false); }
}

function normalizeVideo(x, theme) {
  const tk = (x.type && VTYPES.find(t => t.k === x.type)) ? x.type : 'normal';
  const shots = (Array.isArray(x.shots) ? x.shots : []).map(s => ({
    k: ['vis','line','mind','env','nar','txt'].includes(s.k) ? s.k : 'vis',
    who: s.who || '', txt: String(s.txt || '').trim()
  })).filter(s => s.txt);
  const a = x.author || {};
  return {
    id: uid(), type: tk, typeName: (VTYPES.find(t => t.k === tk) || {}).n || '短片',
    title: String(x.title || '无题').slice(0, 40),
    hook: String(x.hook || '').slice(0, 60),
    theme, tags: (Array.isArray(x.tags) ? x.tags : []).slice(0, 4).map(t => String(t).slice(0, 10)),
    dur: clamp(parseInt(x.dur) || rnd(35, 120), 12, 600),
    bg: pick(BGS),
    author: {
      name: String(a.name || '匿名创作者').slice(0, 16),
      handle: String(a.handle || 'anon_' + rnd(1000,9999)).replace(/^@/,'').slice(0, 20),
      bio: String(a.bio || '').slice(0, 40),
      fans: parseInt(a.fans) || rnd(300, 260000),
      verify: VERIFY_KIND[a.verify] ? a.verify : 'none',
      verifyTxt: String(a.verifyTxt || '').slice(0, 24),
      npc: true
    },
    shots,
    block: x.block && x.block.kind ? {
      kind: x.block.kind, q: String(x.block.q || ''),
      price: parseInt(x.block.price) || (x.block.kind === 'lock' ? rnd(30, 200) : 0),
      opts: (Array.isArray(x.block.opts) ? x.block.opts : []).map(o => ({ t: String(o.t || o.title || '选项'), result: String(o.result || ''), pct: rnd(12, 68) })),
      picked: -1, unlocked: false
    } : null,
    stat: { like: rnd(120, 98000), fav: rnd(30, 22000), share: rnd(10, 8000), cmt: rnd(20, 6000) },
    liked:false, faved:false, recd:false, followed:false, recTxt:'', recBy:null,
    t: Date.now()
  };
}

/* ---------------- 渲染影像流 ---------------- */
function renderFeed() {
  const host = $('feedTrack');
  if (!S.feed.length) return;
  host.innerHTML = S.feed.map((v, i) => videoHTML(v, i)).join('');
  S.feed.forEach(v => bindVideo(v));
  observeFeed();
}
function shotHTML(s) {
  const tagMap = { vis:'画面', line:'对白', mind:'心理', env:'环境', nar:'旁白', txt:'文字' };
  return `<div class="shot k-${s.k}">
    <div class="shot-tag">${tagMap[s.k] || '画面'}</div>
    ${s.k === 'line' && s.who ? `<div class="shot-who">${esc(s.who)}</div>` : ''}
    <div class="shot-txt">${esc(s.txt).replace(/\n/g,'<br>')}</div>
  </div>`;
}
function blockHTML(v) {
  const b = v.block;
  if (!b) return '';
  if (b.kind === 'lock') {
    if (b.unlocked) {
      return `<div class="vblock"><div class="vb-hd">UNLOCKED · 已解锁</div>
        ${(b.opts[0]?.result || '').split('\n').filter(Boolean).map(t => `<div class="shot vis"><div class="shot-txt">${esc(t)}</div></div>`).join('')}</div>`;
    }
    return `<div class="vblock"><div class="vb-hd">PAID · 付费解锁</div>
      <div class="vb-lock">
        <div class="vb-lock-ic"><svg viewBox="0 0 24 24" width="17" height="17" fill="none"><rect x="5" y="10.5" width="14" height="9" rx="2.4" stroke="currentColor" stroke-width="1.5"/><path d="M8.4 10.5V8a3.6 3.6 0 017.2 0v2.5" stroke="currentColor" stroke-width="1.5"/></svg></div>
        <div class="vb-lock-txt"><b>后半段需要解锁</b><span>${b.price} 星光币 · 一次性</span></div>
        <div class="vb-lock-btn" data-lock="${v.id}">解锁</div>
      </div></div>`;
  }
  const title = b.kind === 'branch' ? 'BRANCH · 选择结局' : 'VOTE · 中途投票';
  return `<div class="vblock"><div class="vb-hd">${title}</div>
    <div class="vb-q">${esc(b.q)}</div>
    ${b.opts.map((o, i) => `<div class="vb-opt ${b.picked === i ? 'picked' : ''} ${b.picked >= 0 ? 'done' : ''}" data-vote="${v.id}" data-i="${i}">
      <div class="vb-fill" style="width:${b.picked >= 0 ? o.pct : 0}%"></div>
      <span>${esc(o.t)}</span><span class="vb-pct">${o.pct}%</span></div>`).join('')}
    ${b.picked >= 0 && b.opts[b.picked]?.result ? `<div class="shot vis" style="margin-top:12px;"><div class="shot-tag">结果</div><div class="shot-txt">${esc(b.opts[b.picked].result)}</div></div>` : ''}
  </div>`;
}
function videoHTML(v, i) {
  const mid = Math.floor(v.shots.length * 0.62);
  const before = v.shots.slice(0, v.block ? (v.block.kind === 'branch' ? v.shots.length : mid) : v.shots.length);
  const after = v.block && v.block.kind !== 'branch' ? v.shots.slice(mid) : [];
  return `<article class="vid" data-id="${v.id}">
    <div class="vid-canvas"><div class="bgx ${v.bg}"></div><div class="vid-shade"></div></div>
    <div class="vid-type">
      <div class="vt-pill"><i></i>${esc(v.typeName)}</div>
      <div class="vt-idx">${String(i+1).padStart(2,'0')} / ${String(S.feed.length).padStart(2,'0')}</div>
    </div>
    ${v.recd || v.recBy ? recFlagHTML(v) : ''}
    <div class="vid-stage" data-stage="${v.id}">
      <div class="vid-title">${esc(v.title)}</div>
      ${v.hook ? `<div class="vid-hook">${esc(v.hook)}</div>` : ''}
      ${before.map(shotHTML).join('')}
      ${blockHTML(v)}
      ${(v.block && v.block.kind === 'lock' && !v.block.unlocked) ? '' : after.map(shotHTML).join('')}
      <div style="height:26px"></div>
    </div>
    <div class="vid-rail">
      <div class="rail-author">
        <div class="ra-av">${esc(v.author.name[0] || 'A')}</div>
        <div class="ra-plus ${v.followed ? 'followed' : ''}" data-follow="${v.id}">
          ${v.followed ? `<svg viewBox="0 0 24 24" width="10" height="10" fill="none"><path d="M6 12.4l4 4 8-8.6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
                       : `<svg viewBox="0 0 24 24" width="10" height="10" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`}
        </div>
      </div>
      <div class="rail-b ${v.liked ? 'on' : ''}" data-act="like" data-id="${v.id}">
        <div class="rb-ic"><svg viewBox="0 0 24 24" width="19" height="19" fill="${v.liked?'currentColor':'none'}"><path d="M12 20s-7.2-4.5-9.2-9A5 5 0 0112 5.8 5 5 0 0121.2 11c-2 4.5-9.2 9-9.2 9z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></div>
        <div class="rb-n">${nfmt(v.stat.like)}</div>
      </div>
      <div class="rail-b ${v.faved ? 'on' : ''}" data-act="fav" data-id="${v.id}">
        <div class="rb-ic"><svg viewBox="0 0 24 24" width="19" height="19" fill="${v.faved?'currentColor':'none'}"><path d="M6.5 3.8h11a1.2 1.2 0 011.2 1.2v15L12 16.4 5.3 20V5a1.2 1.2 0 011.2-1.2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></div>
        <div class="rb-n">${nfmt(v.stat.fav)}</div>
      </div>
      <div class="rail-b ${v.recd ? 'on' : ''}" data-act="rec" data-id="${v.id}">
        <div class="rb-ic"><svg viewBox="0 0 24 24" width="19" height="19" fill="none"><path d="M12 3.6l1.9 4.6 4.6 1.9-4.6 1.9L12 16.6l-1.9-4.6-4.6-1.9 4.6-1.9L12 3.6z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg></div>
        <div class="rb-n">推荐</div>
      </div>
      <div class="rail-b" data-act="share" data-id="${v.id}">
        <div class="rb-ic"><svg viewBox="0 0 24 24" width="19" height="19" fill="none"><path d="M4.6 11.8L19.4 5l-6.8 14.8-1.9-6.2-6.1-1.8z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg></div>
        <div class="rb-n">${nfmt(v.stat.share)}</div>
      </div>
    </div>
    <div class="vid-foot">
      <div class="vf-au"><span class="vf-nm">${esc(v.author.name)}</span><span class="vf-vf">${verifySVG(v.author.verify, 14)}</span><span class="vf-hd">@${esc(v.author.handle)} · ${nfmt(v.author.fans)}</span></div>
      ${v.author.bio ? `<div class="vf-desc">${esc(v.author.bio)}</div>` : ''}
      <div class="vf-tags">${v.tags.map(t => `<span class="vf-tag">#${esc(t)}</span>`).join('')}</div>
    </div>
    <div class="vid-ctl">
      <div class="vc-row">
        <div class="vc-btn" data-play="${v.id}"><svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M8 5.5v13M14.5 5.5v13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg></div>
        <div class="vc-time" data-time="${v.id}">00:00</div>
        <div class="vc-track" data-track="${v.id}">
          <div class="vc-rail"><div class="vc-buf" style="width:100%"></div><div class="vc-fill" data-fill="${v.id}" style="width:0%"></div></div>
          <div class="vc-marks">${v.block ? `<div class="vc-mark" style="left:${v.block.kind==='branch'?92:62}%"></div>` : ''}</div>
          <div class="vc-knob" data-knob="${v.id}" style="left:0%"></div>
        </div>
        <div class="vc-time">${fmtDur(v.dur)}</div>
        <div class="vc-rate" data-rate="${v.id}">1.0x</div>
      </div>
    </div>
  </article>`;
}
function recFlagHTML(v) {
  const who = v.recBy ? (S.roles[v.recBy] || {}).nick || '朋友' : S.profile.name;
  return `<div class="vid-rec" data-recpop="${v.id}"><span class="vr-glow"></span>
    <div class="vr-ic"><svg viewBox="0 0 24 24" width="11" height="11" fill="none"><path d="M12 4l1.8 4.4L18.2 10l-4.4 1.6L12 16l-1.8-4.4L5.8 10l4.4-1.6L12 4z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></div>
    <div class="vr-t">${esc(who)} 推荐</div></div>`;
}
function fmtDur(s) { return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }

/* ---------------- 播放器 ---------------- */
const players = {};
function bindVideo(v) {
  const art = document.querySelector(`.vid[data-id="${v.id}"]`);
  if (!art) return;
  const stage = art.querySelector('.vid-stage');
  const shots = $$('.shot', stage);
  const P = players[v.id] = players[v.id] || { t:0, playing:false, rate:1, timer:null, dur:v.dur, n:shots.length };
  P.n = shots.length; P.dur = v.dur;

  const fill = art.querySelector('[data-fill]');
  const knob = art.querySelector('[data-knob]');
  const time = art.querySelector('[data-time]');
  const track = art.querySelector('[data-track]');
  const playBtn = art.querySelector('[data-play]');

  function paint() {
    const p = clamp(P.t / P.dur, 0, 1);
    fill.style.width = (p * 100) + '%';
    knob.style.left = (p * 100) + '%';
    time.textContent = fmtDur(Math.floor(P.t));
    const show = Math.ceil(p * P.n);
    shots.forEach((s, i) => s.classList.toggle('vis', i < Math.max(1, show)));
    if (p >= 1 && !P.done) { P.done = true; markFinish(v); }
  }
  function tick() {
    if (!P.playing) return;
    P.t += 0.25 * P.rate;
    if (P.t >= P.dur) { P.t = P.dur; P.playing = false; setIcon(); }
    paint();
  }
  function setIcon() {
    playBtn.innerHTML = P.playing
      ? `<svg viewBox="0 0 24 24" width="13" height="13" fill="none"><path d="M8 5.5v13M14.5 5.5v13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`
      : `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M7.5 5l11 7-11 7V5z"/></svg>`;
  }
  P.paint = paint; P.setIcon = setIcon;
  clearInterval(P.timer); P.timer = setInterval(tick, 250);
  setIcon(); paint();

  playBtn.onclick = () => { P.playing = !P.playing; setIcon(); };
  art.querySelector('[data-rate]').onclick = (e) => {
    const rates = [1, 1.25, 1.5, 2, 0.75];
    P.rate = rates[(rates.indexOf(P.rate) + 1) % rates.length];
    e.target.textContent = P.rate.toFixed(2).replace(/0$/,'') + 'x';
  };
  const seek = (clientX) => {
    const r = track.getBoundingClientRect();
    P.t = clamp((clientX - r.left) / r.width, 0, 1) * P.dur;
    paint();
  };
  let dragging = false;
  const down = e => { dragging = true; track.classList.add('drag'); seek((e.touches ? e.touches[0] : e).clientX); e.preventDefault(); };
  const move = e => { if (dragging) seek((e.touches ? e.touches[0] : e).clientX); };
  const up = () => { dragging = false; track.classList.remove('drag'); };
  track.addEventListener('mousedown', down); track.addEventListener('touchstart', down, { passive:false });
  window.addEventListener('mousemove', move); window.addEventListener('touchmove', move, { passive:true });
  window.addEventListener('mouseup', up); window.addEventListener('touchend', up);

  $$('.rail-b', art).forEach(b => b.onclick = () => videoAct(v.id, b.dataset.act, b));
  const fo = art.querySelector('[data-follow]');
  if (fo) fo.onclick = () => {
    v.followed = !v.followed;
    S.profile.follow = Math.max(0, S.profile.follow + (v.followed ? 1 : -1));
    kvSet('feed', S.feed); kvSet('profile', S.profile);
    renderFeedItem(v);
    toast(v.followed ? `已关注 ${v.author.name}` : '已取消关注');
  };
  $$('[data-vote]', art).forEach(o => o.onclick = () => {
    if (v.block.picked >= 0) return;
    v.block.picked = +o.dataset.i;
    S.stats.comment++; kvSet('stats', S.stats); kvSet('feed', S.feed);
    renderFeedItem(v);
    toast('已投出你的一票');
  });
  const lock = art.querySelector('[data-lock]');
  if (lock) lock.onclick = async () => {
    const ok = await spendCoin(v.block.price, `解锁影像《${v.title}》`);
    if (!ok) return;
    v.block.unlocked = true;
    await kvSet('feed', S.feed);
    renderFeedItem(v);
    toast('已解锁后半段');
  };
  const rp = art.querySelector('[data-recpop]');
  if (rp) rp.onclick = () => openRecPop(v);
}
function renderFeedItem(v) {
  const i = S.feed.indexOf(v);
  const old = document.querySelector(`.vid[data-id="${v.id}"]`);
  if (!old) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = videoHTML(v, i);
  const el = wrap.firstElementChild;
  old.replaceWith(el);
  const P = players[v.id];
  bindVideo(v);
  if (P) { players[v.id].t = P.t; players[v.id].playing = P.playing; players[v.id].rate = P.rate; players[v.id].paint(); players[v.id].setIcon(); }
}
function scrollToVid(id) {
  const el = document.querySelector(`.vid[data-id="${id}"]`);
  if (el) el.scrollIntoView({ behavior:'smooth', block:'start' });
}
let _fio = null;
function observeFeed() {
  if (_fio) _fio.disconnect();
  _fio = new IntersectionObserver(ents => {
    ents.forEach(e => {
      const id = e.target.dataset.id;
      const P = players[id];
      if (!P) return;
      if (e.isIntersecting && e.intersectionRatio > 0.62) {
        P.playing = true; P.setIcon && P.setIcon();
        const v = S.feed.find(x => x.id === id);
        if (v && !v._counted) { v._counted = true; countWatch(v); }
      } else { P.playing = false; P.setIcon && P.setIcon(); }
    });
  }, { threshold: [0, .62, 1] });
  $$('.vid').forEach(el => _fio.observe(el));
}
function countWatch(v) {
  const st = S.stats;
  st.watch++;
  st.watchSec += Math.round(v.dur * 0.6);
  const k = dayKey(Date.now());
  st.days[k] = (st.days[k] || 0) + 1;
  st.hours[new Date().getHours()]++;
  (v.tags || []).forEach(t => st.tags[t] = (st.tags[t] || 0) + 1);
  st.types[v.typeName] = (st.types[v.typeName] || 0) + 1;
  st.topAuthors[v.author.name] = (st.topAuthors[v.author.name] || 0) + 1;
  bumpTask('watch');
  kvSet('stats', st);
}
function markFinish(v) { S.stats.finish++; S.stats.watchSec += Math.round(v.dur * 0.4); kvSet('stats', S.stats); }

let _shareVid = null, _recVid = null;
async function videoAct(id, act, btn) {
  const v = S.feed.find(x => x.id === id);
  if (!v) return;
  if (act === 'like') {
    v.liked = !v.liked; v.stat.like += v.liked ? 1 : -1;
    if (v.liked) { S.stats.like++; bumpTask('like'); }
    btn.classList.add('pop'); setTimeout(() => btn.classList.remove('pop'), 600);
    await kvSet('stats', S.stats);
  }
  if (act === 'fav') {
    v.faved = !v.faved; v.stat.fav += v.faved ? 1 : -1;
    if (v.faved) { S.stats.fav++; bumpTask('fav'); }
    await kvSet('stats', S.stats);
  }
  if (act === 'rec') { _recVid = v; $('recTxt').value = v.recTxt || ''; openSheet('shRec'); return; }
  if (act === 'share') { _shareVid = v; openShare(); return; }
  await kvSet('feed', S.feed);
  renderFeedItem(v);
}
function openShare() {
  const keys = Object.keys(S.roles).filter(k => S.roles[k].inDM);
  const npcs = S.npcs.filter(n => n.stranger);
  const all = keys.map(k => S.roles[k]).concat(npcs);
  $('shareList').innerHTML = all.length ? all.map(r => `
    <div class="sh-i" data-k="${r.key}">
      <div class="sh-i-av">${r.avatar ? `<img src="${r.avatar}">` : esc((r.nick||'?')[0])}</div>
      <div><div class="sh-i-n">${esc(r.nick)}</div><div class="sh-i-d">@${esc(r.handle)}${r.stranger ? ' · 陌生人' : ''}</div></div>
    </div>`).join('') : `<div style="padding:30px 10px;text-align:center;font-size:11.5px;color:var(--ink4);">还没有可以转发的会话</div>`;
  $$('.sh-i').forEach(el => el.onclick = () => shareTo(el.dataset.k));
  openSheet('shShare');
}
async function shareTo(key) {
  const v = _shareVid; if (!v) return;
  const d = ensureThread(key);
  d.msgs.push({ id: uid(), side:'me', kind:'card', card:{ title:v.title, hook:v.hook, bg:v.bg, type:v.typeName, author:v.author.name }, t: Date.now() });
  d.last = `[影像] ${v.title}`; d.lastT = Date.now();
  v.stat.share++; S.stats.share++;
  const r = S.roles[key]; if (r) { r.bond = (r.bond || 0) + 3; await kvSet('roles', S.roles); }
  await kvSet('dms', S.dms); await kvSet('stats', S.stats); await kvSet('feed', S.feed);
  closeSheet('shShare');
  renderFeedItem(v);
  toast('已转发到私信');
}
async function doRec() {
  const v = _recVid; if (!v) return;
  v.recd = true; v.recTxt = $('recTxt').value.trim(); v.recBy = null;
  S.stats.rec++; bumpTask('rec');
  await kvSet('feed', S.feed); await kvSet('stats', S.stats);
  closeSheet('shRec');
  renderFeedItem(v);
  toast('已推荐，好友圈会看到');
}
function openRecPop(v) {
  const isMe = !v.recBy;
  const r = isMe ? { nick:S.profile.name, handle:S.profile.handle, avatar:S.profile.avatar, verify:S.profile.verify } : (S.roles[v.recBy] || {});
  $('rpCard').innerHTML = `
    <div class="rp-hd">
      <div class="rp-av">${r.avatar ? `<img src="${r.avatar}">` : esc((r.nick||'?')[0])}</div>
      <div><div class="rp-n">${esc(r.nick || '朋友')}${verifySVG(r.verify, 14)}</div><div class="rp-h">@${esc(r.handle || 'user')}</div></div>
    </div>
    <div class="rp-t">${esc(v.recTxt || '推荐')}</div>
    <div class="rp-k">RECOMMENDED · ${esc(v.typeName).toUpperCase()}</div>`;
  openOverlay('recPop');
}

/* ==========================================================================
   好友圈
   ========================================================================== */
LP.renderCircle = function () {
  const keys = Object.keys(S.roles).filter(k => S.roles[k].inCircle);
  const rail = $('ringRail');
  rail.innerHTML = `
    <div class="rr-item self"><div class="rr-ring"><div class="rr-inner"><div class="rr-av">${S.profile.avatar ? `<img src="${S.profile.avatar}">` : esc((S.profile.name||'L')[0])}</div></div><div class="rr-dot"></div></div><div class="rr-nm">我</div></div>
    ` + keys.map((k, i) => {
      const r = S.roles[k];
      const seen = i % 3 === 2;
      return `<div class="rr-item ${seen?'seen':''}" data-k="${k}">
        <div class="rr-ring"><div class="rr-inner"><div class="rr-av">${r.avatar ? `<img src="${r.avatar}">` : esc((r.nick||'?')[0])}</div></div></div>
        <div class="rr-nm">${esc(r.nick)}</div></div>`;
    }).join('');
  $$('.rr-item[data-k]', rail).forEach(el => el.onclick = () => { LP.openChat(el.dataset.k); });
  $('cirSub').textContent = `CIRCLE · ${keys.length} 位好友 · ${S.circle.length} 条动态`;

  const feed = $('cirFeed');
  if (!S.circle.length) {
    feed.innerHTML = `<div class="feed-empty small"><div class="fe-orb"><span></span><span></span><span></span></div>
      <div class="fe-t">关系网还很安静</div><div class="fe-d">点击右上角的星芒，让认识的人开始发布</div></div>`;
    return;
  }
  feed.innerHTML = S.circle.slice().reverse().map((p, i) => postHTML(p, i)).join('');
  $$('.pa', feed).forEach(b => b.onclick = () => circleAct(b.dataset.pid, b.dataset.act, b));
};
function postHTML(p, i) {
  const r = S.roles[p.by] || { nick:'朋友', handle:'friend', avatar:'', verify:'none' };
  const src = p.srcBy ? (S.roles[p.srcBy] || {}) : null;
  return `<div class="post" style="animation-delay:${i*0.05}s">
    <div class="po-hd">
      <div class="po-av">${r.avatar ? `<img src="${r.avatar}">` : esc((r.nick||'?')[0])}</div>
      <div><div class="po-nm">${esc(r.nick)}${verifySVG(r.verify, 13)}</div><div class="po-sub">@${esc(r.handle)} · ${esc(p.time)}</div></div>
      <div class="po-kind">${p.kind === 'relay' ? 'RECOMMEND' : 'POST'}</div>
    </div>
    ${p.text ? `<div class="po-txt">${esc(p.text)}</div>` : ''}
    ${p.media ? `<div class="po-media"><div class="bgx ${p.media.bg}"></div>
      <div class="po-media-play"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5l11 7-11 7V5z"/></svg></div>
      <div class="po-media-in"><div class="po-media-t">${esc(p.media.title)}</div><div class="po-media-d">${esc(p.media.desc)}</div></div></div>` : ''}
    ${p.kind === 'relay' && src ? `<div class="po-relay">
      <div class="po-relay-ic"><svg viewBox="0 0 24 24" width="10" height="10" fill="none"><path d="M12 4l1.8 4.4L18.2 10l-4.4 1.6L12 16l-1.8-4.4L5.8 10l4.4-1.6L12 4z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></div>
      <div class="po-relay-t">这条来自 <b>${esc(src.nick || '朋友')}</b>${p.relation ? ` · ${esc(p.relation)}` : ''}</div></div>` : ''}
    <div class="po-act">
      <div class="pa ${p.liked?'on':''}" data-act="like" data-pid="${p.id}">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="${p.liked?'currentColor':'none'}"><path d="M12 20s-7.2-4.5-9.2-9A5 5 0 0112 5.8 5 5 0 0121.2 11c-2 4.5-9.2 9-9.2 9z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>${nfmt(p.like)}</div>
      <div class="pa" data-act="cmt" data-pid="${p.id}">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M4 6.6c0-.9.7-1.6 1.6-1.6h12.8c.9 0 1.6.7 1.6 1.6v8.2c0 .9-.7 1.6-1.6 1.6H9.4L5.2 19.6a.6.6 0 01-1-.5v-2.7H5.6c-.9 0-1.6-.7-1.6-1.6V6.6z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>${nfmt(p.cmt)}</div>
      <div class="pa" data-act="dm" data-pid="${p.id}">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M4.6 11.8L19.4 5l-6.8 14.8-1.9-6.2-6.1-1.8z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>私信</div>
      <div class="pa pa-more" data-act="open" data-pid="${p.id}">展开</div>
    </div>
    ${p.comments && p.comments.length ? `<div class="po-cmt">${p.comments.map(c => `<div class="po-cmt-i"><b>${esc(c.who)}</b>：${esc(c.txt)}</div>`).join('')}</div>` : ''}
  </div>`;
}
async function circleAct(pid, act, btn) {
  const p = S.circle.find(x => x.id === pid);
  if (!p) return;
  if (act === 'like') { p.liked = !p.liked; p.like += p.liked ? 1 : -1; await kvSet('circle', S.circle); LP.renderCircle(); }
  if (act === 'dm') { LP.openChat(p.by); }
  if (act === 'open') { toast(p.media ? `《${p.media.title}》· ${p.media.desc}` : p.text); }
}

async function generateCircle() {
  const keys = Object.keys(S.roles).filter(k => S.roles[k].inCircle);
  if (keys.length < 1) { toast('先在「查看信息 - 角色同步」里同步角色'); return; }
  loading(true, '关系网正在流动');
  const roster = keys.map(k => {
    const r = S.roles[k];
    const know = (r.knows || []).map(x => (S.roles[x] || {}).nick).filter(Boolean);
    return `- key=${k}｜昵称=${r.nick}｜身份=${r.identity}｜与用户关系=${r.relation}｜签名=${r.bio}｜认识：${know.join('、') || '无'}`;
  }).join('\n');
  const sys = `你是 Lunaplay 好友圈的内容引擎，负责生成"用户的好友们"发布的动态。
${universePrompt()}

【好友名单与关系网】
${roster}

【硬性逻辑要求 —— 必须严格遵守】
1. 动态只能由名单里的人发布，by 必须是名单中的 key。
2. 动态分两种：kind="post"（这个人自己发的影像或图文）、kind="relay"（这个人推荐别人的影像）。
3. relay 类型里，srcBy 必须是"被推荐者"的 key，并且 srcBy 与 by 之间必须在关系网里互相认识（看上面的"认识"字段）。绝对不允许出现"两个人都只认识用户、彼此不认识"却互相推荐的情况。
4. 如果某个人在关系网里没有认识的人，那他只能发 kind="post"，不能发 relay。
5. 每条动态的语气、用词、关注点必须符合这个人的身份与签名，不要千篇一律。
6. media 是这条动态附带的影像卡：title 是影像标题，desc 是一到两句画面描写，bg 从这个列表里选一个：${BGS.join('、')}。图文类动态可以没有 media。
7. comments 里的评论者也必须是名单里的人，且必须与发布者互相认识。

只输出 JSON 数组，不要解释、不要代码块：
[{"by":"c1","kind":"post","text":"动态正文","media":{"title":"","desc":"","bg":"bg-dawn"},"comments":[{"who":"昵称","txt":"评论"}]},
{"by":"c2","kind":"relay","srcBy":"c3","relation":"他们是同事","text":"推荐语","media":{"title":"","desc":"","bg":"bg-mist"},"comments":[]}]`;
  try {
    const raw = await aiChat([
      { role:'system', content: sys },
      { role:'user', content: `生成 ${Math.min(6, Math.max(3, keys.length + 1))} 条新动态。至少包含 1 条 relay（前提是关系网允许），其余为 post。` }
    ], { max: 2800, temp: 0.95 });
    const arr = parseJSON(raw);
    if (!Array.isArray(arr)) throw new Error('返回格式无法解析');
    let ok = 0;
    arr.forEach(x => {
      if (!S.roles[x.by]) return;
      if (x.kind === 'relay') {
        if (!x.srcBy || !S.roles[x.srcBy] || x.srcBy === x.by || !knowsEachOther(x.by, x.srcBy)) return; // 关系不成立就丢弃
      }
      ok++;
      S.circle.push({
        id: uid(), by: x.by, kind: x.kind === 'relay' ? 'relay' : 'post',
        srcBy: x.srcBy || null, relation: String(x.relation || '').slice(0, 20),
        text: String(x.text || '').slice(0, 220),
        media: x.media && x.media.title ? { title:String(x.media.title).slice(0,30), desc:String(x.media.desc||'').slice(0,90), bg: BGS.includes(x.media.bg) ? x.media.bg : pick(BGS) } : null,
        comments: (Array.isArray(x.comments) ? x.comments : []).slice(0, 3).map(c => ({ who:String(c.who||'').slice(0,12), txt:String(c.txt||'').slice(0,60) })),
        like: rnd(12, 2400), cmt: rnd(2, 260), liked:false, time: nowStr().slice(5)
      });
    });
    if (S.circle.length > 60) S.circle = S.circle.slice(-60);
    await kvSet('circle', S.circle);
    LP.renderCircle();
    toast(ok ? `好友圈更新了 ${ok} 条` : '这一轮没有符合关系逻辑的动态，再试一次');
  } catch (e) { toast(e.message || '生成失败'); }
  finally { loading(false); }
}

/* ==========================================================================
   私信
   ========================================================================== */
function ensureThread(key) {
  if (!S.dms[key]) S.dms[key] = { key, msgs:[], last:'', lastT:Date.now(), unread:0, bg:'bg-mist', bgImg:'', tone:'auto', deco:'deco-corner', len:'活人感', pending:0 };
  return S.dms[key];
}
function personOf(key) {
  if (S.roles[key]) return S.roles[key];
  return S.npcs.find(n => n.key === key) || null;
}
LP.renderDMList = function () {
  const q = ($('dmSearchInput') && $('dmSearchInput').value || '').trim().toLowerCase();
  const roleArr = Object.keys(S.roles).filter(k => S.roles[k].inDM).map(k => S.roles[k]);
  const npcArr = S.npcs.slice();
  const all = roleArr.concat(npcArr).filter(r => !q || (r.nick || '').toLowerCase().includes(q) || (r.handle || '').toLowerCase().includes(q));
  all.sort((a, b) => ((S.dms[b.key]?.lastT) || 0) - ((S.dms[a.key]?.lastT) || 0));
  $('dmCountTxt').textContent = all.length;
  let unreadTotal = 0;
  all.forEach(r => unreadTotal += (S.dms[r.key]?.unread || 0));
  const bd = $('dkBadge');
  bd.textContent = unreadTotal > 99 ? '99+' : unreadTotal;
  bd.classList.toggle('on', unreadTotal > 0);

  const row = (r) => {
    const d = S.dms[r.key];
    const bond = bondLevelOf(r.bond || 0);
    return `<div class="dmi" data-k="${r.key}">
      <div class="dmi-av">${r.avatar ? `<img src="${r.avatar}">` : esc((r.nick||'?')[0])}${r.online !== false ? '<div class="dmi-on"></div>' : ''}</div>
      <div class="dmi-mid">
        <div class="dmi-r1">
          <span class="dmi-nm">${esc(r.nick)}</span>
          ${verifySVG(r.verify, 13)}
          ${r.stranger ? '<span class="dmi-tag stranger">陌生人</span>' : `<span class="dmi-tag">${esc(r.relation || '好友')}</span>`}
          ${bondHTML(bond)}
          <span class="dmi-time">${d && d.lastT ? hhmm(d.lastT) : ''}</span>
        </div>
        <div class="dmi-r2">
          <span class="dmi-last">${esc((d && d.last) || (r.stranger ? '一条来自陌生人的信号' : '还没有说过话'))}</span>
          ${d && d.unread ? `<span class="dmi-unread">${d.unread}</span>` : ''}
        </div>
      </div>
    </div>`;
  };
  const strangers = all.filter(r => r.stranger);
  const known = all.filter(r => !r.stranger);
  let html = '';
  if (known.length) html += `<div class="dm-sec">ROLES · 角色</div>` + known.map(row).join('');
  if (strangers.length) html += `<div class="dm-sec">SIGNALS · 陌生信号</div>` + strangers.map(row).join('');
  if (!html) html = `<div style="padding:56px 20px;text-align:center;font-size:11.5px;color:var(--ink4);line-height:2;">还没有任何会话<br>去「查看信息 - 角色同步」拉取角色<br>或轻触右上角的信号点，拾取一个陌生人</div>`;
  $('dmList').innerHTML = html;
  $$('.dmi').forEach(el => el.onclick = () => LP.openChat(el.dataset.k));
};

/* 陌生人生成 —— 绝不从角色库取 */
const LANGS = ['英语','日语','韩语','法语','西班牙语','意大利语','德语','葡萄牙语','俄语','泰语','越南语','阿拉伯语','中文'];
async function pickStranger() {
  loading(true, '正在拾取信号');
  const existing = S.npcs.map(n => n.nick).join('、');
  const lang = pick(LANGS);
  const sys = `你是 Lunaplay 的陌生人信号引擎。你要凭空创造一个此前完全不存在的陌生人，并写出他/她发给用户的第一条私信。
${universePrompt()}

【硬性要求】
1. 这个人必须是全新的陌生人，与用户没有任何既有关系，不认识用户，也不是用户的任何角色。禁止使用以下已存在的名字：${existing || '（暂无）'}
2. 第一条消息使用【${lang}】书写（如果是中文就用中文）。同时必须给出对应的中文翻译放在 trans 字段。
3. 消息内容要像真实陌生人：可能是发错了、可能是看到用户的推荐、可能是搭讪、可能是问路、可能是在找什么人。要有具体情境，不要空泛问好。
4. 语气自然、口语化，长度 1-3 句。
5. persona 字段写这个陌生人的完整设定（性格、身份、说话习惯、来找用户的动机），这部分只给系统用，不会展示给用户。

只输出 JSON 对象，不要解释、不要代码块：
{"nick":"昵称","handle":"英文handle","bio":"一句签名","identity":"身份","fans":320,"verify":"none","lang":"${lang}","first":"第一条消息原文","trans":"中文翻译","persona":"完整人设"}`;
  try {
    const raw = await aiChat([{ role:'system', content: sys }, { role:'user', content: '生成一个陌生人和他的第一条私信。' }], { max: 900, temp: 1.0 });
    const x = parseJSON(raw);
    if (!x || !x.nick) throw new Error('返回格式无法解析');
    const key = 'n' + uid();
    const npc = {
      key, from:'npc', stranger:true,
      nick:String(x.nick).slice(0,16), name:String(x.nick).slice(0,16),
      handle:String(x.handle || 'stranger_' + rnd(1000,9999)).replace(/^@/,''),
      avatar:'', cover:'',
      bio:String(x.bio || '').slice(0,40),
      identity:String(x.identity || '陌生人').slice(0,12),
      relation:'陌生人', verify: VERIFY_KIND[x.verify] ? x.verify : 'none', verifyTxt:'',
      fans: parseInt(x.fans) || rnd(20, 9000), bond: 0, knows: [],
      _lang: String(x.lang || lang), _persona: String(x.persona || ''), _len:'适中'
    };
    S.npcs.push(npc);
    const d = ensureThread(key);
    const msg = { id:uid(), side:'them', kind:'text', txt:String(x.first||'').trim(), trans:String(x.trans||'').trim(), lang:npc._lang, t:Date.now() };
    d.msgs.push(msg);
    d.last = msg.txt; d.lastT = Date.now(); d.unread = 1;
    await kvSet('npcs', S.npcs); await kvSet('dms', S.dms);
    LP.renderDMList();
    toast(`拾取到一个陌生信号：${npc.nick}`);
  } catch (e) { toast(e.message || '拾取失败'); }
  finally { loading(false); }
}

/* ---------------- 聊天页 ---------------- */
let _chatKey = null;
const DECOS = [['deco-none','无'],['deco-corner','折角'],['deco-line','侧线'],['deco-dot','点缀'],['deco-glow','流光'],['deco-frame','内框']];
LP.openChat = async function (key) {
  const r = personOf(key);
  if (!r) return;
  _chatKey = key;
  const d = ensureThread(key);
  d.unread = 0;
  await kvSet('dms', S.dms);
  $('chatName').textContent = r.nick;
  $('chatVerify').innerHTML = verifySVG(r.verify, 14);
  $('chatAv').innerHTML = r.avatar ? `<img src="${r.avatar}">` : esc((r.nick||'?')[0]);
  $('chatState').textContent = r.stranger ? `陌生人 · ${r._lang || '中文'}` : `${r.identity} · ${r.relation}`;
  $('chatBond').innerHTML = bondHTML(bondLevelOf(r.bond || 0), true);
  applyChatBg(); applyChatTone();
  renderChat();
  openPage('pgChat');
  updateSendState();
  LP.renderDMList();
};
function applyChatBg() {
  const d = S.dms[_chatKey];
  const bg = $('chatBg');
  if (d.bgImg) { bg.className = 'chat-bg'; bg.style.backgroundImage = `url(${d.bgImg})`; }
  else { bg.className = 'chat-bg bgx ' + d.bg; bg.style.backgroundImage = ''; }
}
function applyChatTone() {
  const d = S.dms[_chatKey]; if (!d) return;
  const dark = d.tone === 'dark';
  $('pgChat').classList.toggle('tone-dark', dark);
  document.body.classList.toggle('sb-light', dark && $('pgChat').classList.contains('on'));
}
function renderChat() {
  const d = S.dms[_chatKey], r = personOf(_chatKey);
  const host = $('chatScroll');
  let html = '', lastDay = '';
  d.msgs.forEach(m => {
    const dk = dayKey(m.t);
    if (dk !== lastDay) { lastDay = dk; html += `<div class="msg-day"><span>${dk.replace(/\//g,'.')}</span></div>`; }
    html += msgHTML(m, r, d);
  });
  host.innerHTML = html || `<div style="padding:60px 20px;text-align:center;font-size:11.5px;color:var(--ink4);line-height:2;">还没有开始<br>说点什么，然后点左下角的「回声」让对方回复</div>`;
  $$('.m-lang', host).forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    const bub = b.closest('.bub');
    bub.classList.toggle('showtrans');
    b.querySelector('span').textContent = bub.classList.contains('showtrans') ? '收起翻译' : '查看翻译';
  });
  $$('.bub', host).forEach(b => {
    let tm = null;
    const start = (e) => { tm = setTimeout(() => openMsgMenu(b.dataset.mid, e), 480); };
    const end = () => clearTimeout(tm);
    b.addEventListener('touchstart', start, { passive:true });
    b.addEventListener('touchend', end); b.addEventListener('touchmove', end);
    b.addEventListener('mousedown', start); b.addEventListener('mouseup', end); b.addEventListener('mouseleave', end);
  });
  requestAnimationFrame(() => host.scrollTop = host.scrollHeight);
}
function msgHTML(m, r, d) {
  const me = m.side === 'me';
  const deco = d.deco && d.deco !== 'deco-none' ? d.deco : '';
  if (m.kind === 'card') {
    return `<div class="mrow ${me?'me':''}">
      ${me ? '' : `<div class="m-av">${r.avatar ? `<img src="${r.avatar}">` : esc((r.nick||'?')[0])}</div>`}
      <div class="m-wrap"><div class="m-card">
        <div class="mc-top"><div class="bgx ${m.card.bg}"></div></div>
        <div class="mc-b"><div class="mc-t">${esc(m.card.title)}</div><div class="mc-d">${esc(m.card.hook || '')}</div>
        <div class="mc-tag">${esc(m.card.type)} · ${esc(m.card.author)}</div></div>
      </div><div class="m-meta">${hhmm(m.t)}${me?' · 已送达':''}</div></div>
      ${me ? `<div class="m-av ghost"></div>` : ''}</div>`;
  }
  const showLang = !me && m.trans;
  return `<div class="mrow ${me?'me':''}">
    ${me ? '' : `<div class="m-av">${r.avatar ? `<img src="${r.avatar}">` : esc((r.nick||'?')[0])}</div>`}
    <div class="m-wrap">
      <div class="bub ${me?'mine':'them'} ${deco}" data-mid="${m.id}">
        ${esc(m.txt).replace(/\n/g,'<br>')}
        ${showLang ? `<div class="m-trans">${esc(m.trans)}</div><div class="m-lang"><svg viewBox="0 0 24 24" width="10" height="10" fill="none"><path d="M4 6h9M8.5 6v2.6c0 3-1.8 5.6-4.5 6.8M6.6 10.6c1 2.2 3 4 5.4 4.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M12.6 20l3.8-9 3.8 9M14 17.2h4.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><span>查看翻译</span>${m.lang?` · ${esc(m.lang)}`:''}</div>` : ''}
      </div>
      <div class="m-meta">${hhmm(m.t)}${me?' · 已送达':''}</div>
    </div>
    ${me ? `<div class="m-av ghost"></div>` : ''}</div>`;
}
let _menuMid = null;
function openMsgMenu(mid, e) {
  _menuMid = mid;
  let menu = $('msgMenu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'msgMenu'; menu.className = 'm-menu';
    menu.innerHTML = `<div class="mm-i" data-a="copy">复制</div><div class="mm-i" data-a="del">删除</div><div class="mm-i" data-a="quote">引用</div>`;
    document.body.appendChild(menu);
    $$('.mm-i', menu).forEach(b => b.onclick = () => msgMenuAct(b.dataset.a));
  }
  const p = e.touches ? e.touches[0] : e;
  menu.style.left = clamp(p.clientX - 70, 12, window.innerWidth - 190) + 'px';
  menu.style.top = clamp(p.clientY - 54, 60, window.innerHeight - 80) + 'px';
  menu.classList.add('on');
  setTimeout(() => document.addEventListener('click', closeMsgMenu, { once:true }), 40);
}
function closeMsgMenu() { const m = $('msgMenu'); if (m) m.classList.remove('on'); }
async function msgMenuAct(a) {
  const d = S.dms[_chatKey];
  const i = d.msgs.findIndex(m => m.id === _menuMid);
  if (i < 0) return closeMsgMenu();
  if (a === 'copy') { try { await navigator.clipboard.writeText(d.msgs[i].txt || ''); toast('已复制'); } catch (e) { toast('复制失败'); } }
  if (a === 'del') { d.msgs.splice(i, 1); await kvSet('dms', S.dms); renderChat(); }
  if (a === 'quote') { $('cdText').value = `「${(d.msgs[i].txt||'').slice(0,24)}」\n`; $('cdText').focus(); }
  closeMsgMenu();
}
function updateSendState() {
  const d = S.dms[_chatKey];
  if (!d) return;
  const locked = d.pending >= 1;
  $('cdSend').classList.toggle('off', locked);
  $('cdEcho').classList.toggle('ready', locked);
  $('chatLock').classList.toggle('on', locked);
  $('chatLock').textContent = locked ? '你已发出一条消息 · 点左下角「回声」召回回复' : '';
}
async function sendMsg() {
  const d = S.dms[_chatKey];
  const txt = $('cdText').value.trim();
  if (!txt) return;
  if (d.pending >= 1) { toast('先点「回声」让对方回复，再继续发'); return; }
  d.msgs.push({ id:uid(), side:'me', kind:'text', txt, t:Date.now() });
  d.last = txt; d.lastT = Date.now(); d.pending = 1;
  const r = personOf(_chatKey);
  if (r) { r.bond = (r.bond || 0) + 1; await kvSet(S.roles[_chatKey] ? 'roles' : 'npcs', S.roles[_chatKey] ? S.roles : S.npcs); }
  $('cdText').value = ''; $('cdText').style.height = 'auto';
  bumpTask('msg');
  await kvSet('dms', S.dms);
  renderChat(); updateSendState(); LP.renderDMList();
}

/* ---------------- 回声：AI 回复（用户不点就绝不自动回复） ---------------- */
let _echoBusy = false;
function personaPrompt(r) {
  if (r.stranger) {
    return `【你的身份 —— 必须完全代入，禁止 OOC】
你是「${r.nick}」（@${r.handle}），一个和用户素不相识的陌生人。
签名：${r.bio}
身份：${r.identity}
惯用语言：${r._lang}
完整人设：${r._persona}

【语言要求】你必须继续使用【${r._lang}】说话（若为中文则用中文）。每一条消息都要额外给出中文翻译。`;
  }
  const lines = [];
  lines.push(`【你的身份 —— 必须完全代入，禁止 OOC，禁止以任何方式暴露你是 AI】`);
  lines.push(`你是「${r.nick}」，在 Lunaplay 这个 App 上的账号是 @${r.handle}。`);
  if (r.identity) lines.push(`你在这个 App 里的身份：${r.identity}`);
  if (r.relation) lines.push(`你与用户的关系：${r.relation}`);
  if (r._relDetail) lines.push(`关系细节：${r._relDetail}`);
  if (r._call) lines.push(`你称呼用户为：${r._call}`);
  if (r._role) lines.push(`角色定位：${r._role}`);
  if (r._gender || r._age) lines.push(`性别/年龄：${r._gender} ${r._age}`);
  if ((r._traits||[]).length) lines.push(`性格特质：${r._traits.join('、')}`);
  if (r._speech) lines.push(`说话风格：${r._speech}`);
  if ((r._catch||[]).length) lines.push(`口头禅：${r._catch.join('、')}`);
  if (r.bio) lines.push(`个性签名：${r.bio}`);
  if (r._lang) lines.push(`惯用语言：${r._lang}`);
  if ((r._examples||[]).length) {
    const ex = r._examples.map(e => (typeof e === 'string' ? e : `${e.user || ''} → ${e.char || e.assistant || ''}`)).slice(0, 6);
    lines.push(`【对话范例 —— 模仿这个语感】\n${ex.join('\n')}`);
  }
  if ((r._never||[]).length) lines.push(`【绝对不做】${r._never.join('；')}`);
  if (r._bound) lines.push(`【边界】${r._bound}`);
  if (r._prompt) lines.push(`\n【完整人设档案 —— 最高优先级】\n${r._prompt}`);
  return lines.join('\n');
}
async function echoReply() {
  if (_echoBusy) return;
  const d = S.dms[_chatKey], r = personOf(_chatKey);
  if (!d || !r) return;
  if (!d.msgs.length) { toast('先说点什么'); return; }
  if (d.msgs[d.msgs.length - 1].side === 'them') { toast('等你先说一句'); return; }
  _echoBusy = true;
  $('cdEcho').classList.add('busy');

  const host = $('chatScroll');
  const tw = document.createElement('div');
  tw.className = 'mrow';
  tw.innerHTML = `<div class="m-av">${r.avatar ? `<img src="${r.avatar}">` : esc((r.nick||'?')[0])}</div><div class="typing"><i></i><i></i><i></i></div>`;
  host.appendChild(tw);
  host.scrollTop = host.scrollHeight;

  const lenMap = { '短':'每条 8-20 字', '适中':'每条 15-40 字', '活人感':'长短交错，短的 5-15 字，长的 30-60 字', '长':'每条 40-90 字' };
  const ctx = d.msgs.slice(-26).map(m => ({
    role: m.side === 'me' ? 'user' : 'assistant',
    content: m.kind === 'card' ? `[转发了一条影像《${m.card.title}》]` : m.txt
  }));
  const sys = `${personaPrompt(r)}

${universePrompt()}

【回复方式 —— 严格执行】
1. 你在用即时通讯软件聊天，像真人一样发消息：会分成好几条连着发，而不是一大段。
2. 除非用户明确要求你讲一个完整的故事，否则任何超过 60 字的内容都必须切分成多条消息，按语气停顿的地方切。
3. 本次回复 2-6 条消息，条数你自己判断，情绪激动或话多时可以更多。${lenMap[d.len] || lenMap['活人感']}。
4. 你必须读完并记住上面的全部对话历史，保持前后一致，不允许失忆、不允许重复问已经问过的问题、不允许重复上文说过的句子。
5. 不要写旁白、不要写动作描写的星号、不要写"（笑）"这类舞台提示，除非人设里明确要求。就是纯粹的聊天文字。
6. 绝对不能出戏：不提 AI、不提模型、不提提示词、不做总结陈述、不问"还有什么可以帮你"。
7. 语气、用词、标点习惯必须和人设一致。可以有语气词、可以打错字、可以话说一半。
${r.stranger ? '8. 每条消息必须用你的惯用语言书写，并在 trans 字段给出对应中文翻译。' : '8. trans 字段留空字符串。'}

只输出 JSON 数组，不要解释、不要代码块：
[{"txt":"第一条","trans":""},{"txt":"第二条","trans":""}]`;

  try {
    const raw = await aiChat([{ role:'system', content: sys }, ...ctx], { max: 1600, temp: 0.96 });
    let arr = parseJSON(raw);
    if (!Array.isArray(arr)) {
      const t = String(raw || '').trim();
      arr = t ? splitLong(t).map(x => ({ txt:x, trans:'' })) : [];
    }
    arr = arr.map(x => (typeof x === 'string' ? { txt:x, trans:'' } : { txt:String(x.txt||'').trim(), trans:String(x.trans||'').trim() }))
             .filter(x => x.txt).slice(0, 8);
    if (!arr.length) throw new Error('对方没有回应，再试一次');
    tw.remove();
    for (let i = 0; i < arr.length; i++) {
      const m = { id:uid(), side:'them', kind:'text', txt:arr[i].txt, trans:arr[i].trans, lang: r.stranger ? r._lang : '', t: Date.now() };
      d.msgs.push(m);
      d.last = m.txt; d.lastT = Date.now();
      r.bond = (r.bond || 0) + 1;
      renderChat();
      if (i < arr.length - 1) await new Promise(res => setTimeout(res, clamp(arr[i].txt.length * 26, 420, 1500)));
    }
    d.pending = 0;
    await kvSet('dms', S.dms);
    await kvSet(S.roles[_chatKey] ? 'roles' : 'npcs', S.roles[_chatKey] ? S.roles : S.npcs);
    $('chatBond').innerHTML = bondHTML(bondLevelOf(r.bond || 0), true);
    updateSendState(); LP.renderDMList();
  } catch (e) {
    tw.remove();
    toast(e.message || '回声失败');
  } finally {
    _echoBusy = false;
    $('cdEcho').classList.remove('busy');
  }
}
function splitLong(t) {
  const parts = String(t).split(/\n+/).filter(Boolean);
  const out = [];
  parts.forEach(p => {
    if (p.length <= 60) { out.push(p); return; }
    let buf = '';
    p.split(/(?<=[。！？!?…；;])/).forEach(seg => {
      if ((buf + seg).length > 50) { if (buf) out.push(buf); buf = seg; }
      else buf += seg;
    });
    if (buf) out.push(buf);
  });
  return out.slice(0, 8);
}

/* ---------------- 聊天设置 ---------------- */
function openChatSet() {
  const d = S.dms[_chatKey];
  $('bgGrid').innerHTML = BGS.map(b => `<div class="bgo ${!d.bgImg && d.bg === b ? 'on' : ''}" data-b="${b}"><div class="bgx ${b}" style="position:absolute;inset:0"></div><div class="bgo-n">${BG_NAMES[b]}</div></div>`).join('');
  $$('.bgo').forEach(o => o.onclick = async () => {
    d.bg = o.dataset.b; d.bgImg = '';
    $$('.bgo').forEach(x => x.classList.remove('on')); o.classList.add('on');
    $('upChatBgPrev').style.backgroundImage = '';
    applyChatBg(); await kvSet('dms', S.dms);
  });
  $('upChatBgPrev').style.backgroundImage = d.bgImg ? `url(${d.bgImg})` : '';
  $('chatBgUrl').value = (d.bgImg && d.bgImg.startsWith('http')) ? d.bgImg : '';
  optRow('chatTone', [['auto','浅色'],['dark','深色']], d.tone === 'dark' ? 'dark' : 'auto', async v => { d.tone = v; applyChatTone(); await kvSet('dms', S.dms); });
  optRow('chatDeco', DECOS, d.deco, async v => { d.deco = v; renderChat(); await kvSet('dms', S.dms); });
  optRow('chatLen', ['短','适中','活人感','长'], d.len, async v => { d.len = v; await kvSet('dms', S.dms); });
  openSheet('shChatSet');
}

/* ==========================================================================
   启动
   ========================================================================== */
async function boot() {
  S.profile  = await kvGet('profile', null)  || defProfile();
  S.stats    = await kvGet('stats', null)    || defStats();
  S.universe = Object.assign(defUniverse(), await kvGet('universe', null) || {});
  S.coin     = await kvGet('coin', null)     || defCoin();
  S.roles    = await kvGet('roles', null)    || {};
  S.npcs     = await kvGet('npcs', null)     || [];
  S.dms      = await kvGet('dms', null)      || {};
  S.feed     = await kvGet('feed', null)     || [];
  S.circle   = await kvGet('circle', null)   || [];
  S.tasks    = await kvGet('tasks', null)    || { day: dayKey(Date.now()), today:{ watch:0,like:0,msg:0,gen:0,rec:0,fav:0 } };
  if (!S.stats.hours || S.stats.hours.length !== 24) S.stats.hours = new Array(24).fill(0);
  if (!S.stats.days) S.stats.days = {};
  if (!S.stats.tags) S.stats.tags = {};
  if (!S.stats.types) S.stats.types = {};
  if (!S.stats.topAuthors) S.stats.topAuthors = {};
  if (!S.tasks || !S.tasks.today) S.tasks = { day: dayKey(Date.now()), today:{ watch:0,like:0,msg:0,gen:0,rec:0,fav:0 } };
  if (!S.coin.bills) S.coin.bills = [];
  if (!S.profile.archives) S.profile.archives = [];
  S.feed.forEach(v => { v._counted = false; });
  buildGraph();

  updateTime(); setInterval(updateTime, 20000);
  updateBattery(); applyIsland(); applyGlobalFont();

  /* 导航 */
  $$('.dk').forEach((b, i) => b.onclick = () => go(b.dataset.s));
  const syncDock = () => {
    const i = $$('.dk').findIndex(b => b.classList.contains('on'));
    moveDock(Math.max(0, i), false);
  };
  // 多次校正，避免字体/布局尚未就绪导致光球位置偏移
  syncDock();
  requestAnimationFrame(syncDock);
  setTimeout(syncDock, 80);
  setTimeout(syncDock, 300);
  window.addEventListener('load', syncDock);
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(syncDock).catch(() => {}); }
  window.addEventListener('resize', syncDock);
  window.addEventListener('orientationchange', () => setTimeout(syncDock, 120));

  /* 关闭类绑定 */
  $$('[data-close]').forEach(el => el.onclick = () => {
    const id = el.dataset.close;
    if (id === 'cardRail' || id === 'recPop') closeOverlay(id);
    else closeSheet(id);
  });
  $$('[data-back]').forEach(el => el.onclick = () => closePage(el.dataset.back));

  /* 推荐页 */
  $('hmChord').onclick = () => { buildComposer(); openSheet('shComposer'); };
  $('cpGo').onclick = generateFeed;
  if (S.feed.length) { renderFeed(); }

  /* 好友圈 */
  $('cirSpark').onclick = generateCircle;

  /* 私信 */
  $('dmSignal').onclick = pickStranger;
  $('chatBack').onclick = () => { closePage('pgChat'); document.body.classList.remove('sb-light'); LP.renderDMList(); };
  $('chatMore').onclick = openChatSet;
  $('cdSend').onclick = sendMsg;
  $('cdEcho').onclick = echoReply;
  $('cdText').addEventListener('input', e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(96, e.target.scrollHeight) + 'px'; });
  $('cdText').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } });
  $('upChatBg').onclick = async () => {
    const d = await pickImage(); if (!d) return;
    const t = S.dms[_chatKey]; t.bgImg = d;
    $('upChatBgPrev').style.backgroundImage = `url(${d})`;
    $$('.bgo').forEach(x => x.classList.remove('on'));
    applyChatBg(); await kvSet('dms', S.dms);
  };
  $('chatBgUrl').addEventListener('change', async e => {
    const u = e.target.value.trim();
    const t = S.dms[_chatKey];
    t.bgImg = u; applyChatBg(); await kvSet('dms', S.dms);
  });
  $('chatClear').onclick = async () => {
    const t = S.dms[_chatKey];
    t.msgs = []; t.last = ''; t.pending = 0;
    await kvSet('dms', S.dms);
    renderChat(); updateSendState(); closeSheet('shChatSet'); LP.renderDMList();
    toast('会话已清空');
  };

  /* 个人中心 */
  $('meSeam').onclick = () => { LP.renderArchive(); openPage('pgArchive'); };
  $('meCoverEdit').onclick = async () => {
    const d = await pickImage(); if (!d) return;
    S.profile.cover = d; await kvSet('profile', S.profile); LP.renderMe(); toast('封面已更新');
  };
  $('meAvWrap').onclick = async () => {
    const d = await pickImage(); if (!d) return;
    S.profile.avatar = d; await kvSet('profile', S.profile); LP.renderMe(); toast('头像已更新');
  };
  $('scMe').addEventListener('scroll', () => {
    const y = $('scMe').scrollTop;
    $('lpBleed').style.opacity = curScreen === 'scMe' ? String(clamp(1 - y / 120, 0, 1)) : '0';
  }, { passive: true });
  $$('.mt').forEach(t => t.onclick = () => {
    $$('.mt').forEach(x => x.classList.remove('on'));
    t.classList.add('on'); moveMeInk(); renderMeGrid(t.dataset.t);
  });
  setTimeout(moveMeInk, 200);

  /* 查看信息 */
  $('infoSave').onclick = () => saveInfo(false);
  bindSeg('infoSeg', 'segInk', g => {
    $('paneMine').classList.toggle('on', g === 'mine');
    $('paneRole').classList.toggle('on', g === 'role');
  });
  $('upAvatar').onclick = async () => { const d = await pickImage(); if (!d) return; _formTmp.avatar = d; $('upAvatarPrev').style.backgroundImage = `url(${d})`; };
  $('upCover').onclick  = async () => { const d = await pickImage(); if (!d) return; _formTmp.cover = d; $('upCoverPrev').style.backgroundImage = `url(${d})`; };
  $('rlSync').onclick = () => LP.syncRoles(false);
  $('rlRand').onclick = openRandomCard;
  $('rfSave').onclick = saveRoleEditor;
  ['fName','fHandle','fBio','fTags','fVerifyTxt','fFollow','fFans','fLiked','fBirth','fLoc','fJob','fCoverUrl'].forEach(id => {
    const el = $(id); if (!el) return;
    el.addEventListener('blur', () => { if ($('pgInfo').classList.contains('on')) autoSave(); });
  });

  /* 其它页 */
  LP._coinSegMove = bindSeg('coinSeg', 'coinInk', g => LP.renderCoin(g));
  bindSeg('linkSeg', 'linkInk', g => LP.renderLink(g));
  $('uvSave').onclick = saveUniverse;
  $('tpGo').onclick = doTopup;
  $('recGo').onclick = doRec;
  buildPinPad();

  LP.renderMe();
  LP.renderDMList();
  if (Object.keys(S.roles).length === 0) LP.syncRoles(true);
}
let _autoTm = null;
function autoSave() {
  clearTimeout(_autoTm);
  _autoTm = setTimeout(async () => {
    const p = S.profile;
    p.name = $('fName').value.trim() || p.name;
    p.handle = ($('fHandle').value.trim() || p.handle).replace(/^@/,'');
    p.bio = $('fBio').value.trim() || p.bio;
    p.tags = $('fTags').value.split(/[,，]/).map(s => s.trim()).filter(Boolean).slice(0, 8);
    p.verifyTxt = $('fVerifyTxt').value.trim();
    p.follow = +$('fFollow').value || p.follow;
    p.fans = +$('fFans').value || p.fans;
    p.liked = +$('fLiked').value || p.liked;
    p.birth = $('fBirth').value.trim(); p.loc = $('fLoc').value.trim(); p.job = $('fJob').value.trim();
    p.coverUrl = $('fCoverUrl').value.trim();
    Object.assign(p, _formTmp);
    await kvSet('profile', p);
    LP.renderMe();
  }, 900);
}
let _booted = false;
function bootOnce() { if (_booted) return; _booted = true; boot(); }
document.addEventListener('DOMContentLoaded', bootOnce);
if (document.readyState !== 'loading') bootOnce();