/* =========================================================
   论坛 · 核心层  forum-core.js
   数据存储（IndexedDB）/ 读取角色库与世界书 / 状态栏同步 / 通用工具
========================================================= */
window.F = window.F || {};

/* ---------------- 通用工具 ---------------- */
F.uid = (p = 'x') => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
F.esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
F.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
F.num = n => {
  n = Math.max(0, Math.round(+n || 0));
  if (n >= 1e8) return (n / 1e8).toFixed(n >= 1e9 ? 0 : 1).replace(/\.0$/, '') + '亿';
  if (n >= 1e4) return (n / 1e4).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'w';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
};
F.ago = t => {
  const d = (Date.now() - t) / 1000;
  if (d < 60) return '刚刚';
  if (d < 3600) return Math.floor(d / 60) + '分钟前';
  if (d < 86400) return Math.floor(d / 3600) + '小时前';
  if (d < 86400 * 7) return Math.floor(d / 86400) + '天前';
  const dt = new Date(t);
  return (dt.getMonth() + 1) + '月' + dt.getDate() + '日';
};
F.fullDate = t => {
  const d = new Date(t);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};
F.hash = str => {
  let h = 2166136261;
  str = String(str);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
F.rng = seed => {
  let a = typeof seed === 'number' ? seed : F.hash(seed);
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
};
F.sleep = ms => new Promise(r => setTimeout(r, ms));
F.debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
F.deepClone = o => JSON.parse(JSON.stringify(o));

/* 图片压缩：统一转为 dataURL，控制体积以便 IndexedDB 存储 */
F.readImage = (file, max = 1440, q = 0.86) => new Promise((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      let { width: w, height: h } = img;
      const s = Math.min(1, max / Math.max(w, h));
      w = Math.round(w * s); h = Math.round(h * s);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      res(c.toDataURL('image/jpeg', q));
    };
    img.onerror = rej;
    img.src = fr.result;
  };
  fr.onerror = rej;
  fr.readAsDataURL(file);
});
F.pickImages = (multiple = false) => new Promise(res => {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = multiple;
  inp.onchange = () => res(Array.from(inp.files || []));
  inp.click();
});

/* ---------------- IndexedDB：论坛自有数据库 ---------------- */
F.idb = {
  _db: null,
  open() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('LunaForumDB', 1);
      r.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      r.onsuccess = e => { this._db = e.target.result; res(this._db); };
      r.onerror = e => rej(e.target.error);
    });
  },
  async get(k) {
    const db = await this.open();
    return new Promise(res => {
      const q = db.transaction('kv', 'readonly').objectStore('kv').get(k);
      q.onsuccess = () => res(q.result);
      q.onerror = () => res(undefined);
    });
  },
  async set(k, v) {
    const db = await this.open();
    return new Promise(res => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(v, k);
      tx.oncomplete = () => res(true);
      tx.onerror = () => res(false);
    });
  }
};

/* ---------------- 全局状态 ---------------- */
F.KEYS = ['identities', 'activeIdentityId', 'charProfiles', 'worlds', 'posts', 'npcs', 'dms', 'settings', 'draft'];
F.state = {
  identities: [], activeIdentityId: null, charProfiles: [], worlds: [], posts: [], npcs: [], dms: [],
  settings: { vision: false, maxTokens: 8192, temperature: 0.9, stream: true, lastAutoCheck: 0 },
  draft: null
};
F.load = async () => {
  for (const k of F.KEYS) {
    const v = await F.idb.get(k);
    if (v !== undefined) F.state[k] = (k === 'settings') ? Object.assign({}, F.state.settings, v) : v;
  }
  if (!F.state.identities.length) {
    const id = F.newIdentity({ nickname: localStorage.getItem('luna_user_name') || '新用户' });
    F.state.identities.push(id);
    F.state.activeIdentityId = id.id;
    await F.save('identities', 'activeIdentityId');
  }
  if (!F.me()) { F.state.activeIdentityId = F.state.identities[0].id; await F.save('activeIdentityId'); }
};
F.save = async (...keys) => {
  for (const k of keys) await F.idb.set(k, F.state[k]);
  F.bus.emit('change', keys);
};

/* 简易事件总线：保证所有页面数据同步刷新 */
F.bus = {
  map: {},
  on(ev, fn) { (this.map[ev] = this.map[ev] || []).push(fn); return () => this.off(ev, fn); },
  off(ev, fn) { this.map[ev] = (this.map[ev] || []).filter(f => f !== fn); },
  emit(ev, data) { (this.map[ev] || []).slice().forEach(f => { try { f(data); } catch (e) { console.error(e); } }); }
};

/* ---------------- 实体工厂 ---------------- */
F.newVerify = () => ({
  status: 'none', type: '个人博主', field: '', title: '', intro: '', since: 0,
  fanClub: { enabled: false, name: '', badge: '', levels: '路人,新粉,铁粉,挚友', intro: '', joinRule: '关注即可加入' },
  circles: []
});
F.newIdentity = (o = {}) => Object.assign({
  id: F.uid('u'), kind: 'user',
  nickname: '新用户', handle: 'user' + Math.floor(Math.random() * 90000 + 10000),
  avatar: null, cover: null, bio: '',
  gender: '', birthday: '', location: '', occupation: '', school: '', website: '', tags: [],
  persona: '', aiAddress: '', relationToChars: '',
  privacy: { showLikes: true, showFavs: true, dm: 'all' },
  verify: F.newVerify(),
  base: { followers: 0, following: 0 },
  following: [],
  createdAt: Date.now()
}, o);
F.newCharProfile = (char) => ({
  id: F.uid('c'), kind: 'char', charId: char.id,
  nickname: char.name || '角色', handle: 'c' + (F.hash(char.name || char.id) % 900000 + 100000),
  avatar: null, cover: null, bio: char.desc || '', location: '', tags: [],
  sync: { name: true, avatar: true, persona: true, desc: true, appearance: true, traits: true, speechStyle: true, likes: true, backstory: false, relation: true, worldbook: true, memory: false },
  post: { style: '', tone: '', topics: '', taboo: '', length: '适中', hashtag: '偶尔', emoji: '不用', perspective: '第一人称', mentionUser: '偶尔', sample: '' },
  auto: { enabled: false, freq: 'daily', worldId: null, types: ['moment'], lastAt: 0 },
  gen: { joinDefault: true, role: 'both', commentActive: '适中', replyUser: true },
  relationToUser: '',
  verify: F.newVerify(),
  base: { followers: Math.floor(800 + Math.random() * 20000), following: Math.floor(40 + Math.random() * 300) },
  savedAt: 0, createdAt: Date.now()
});
F.newWorld = () => ({
  id: F.uid('w'), name: '', cover: null, theme: '', tone: '', style: '', worldview: '', content: '', era: '',
  platform: '综合广场', audience: '', npc: '', keywords: '', taboo: '', lang: '简体中文', length: '适中',
  commentStyle: '', heat: '中等热度', realism: '贴近真实社交平台', userRole: '', userMention: '偶尔',
  worldbook: [], defaultChars: [], createdAt: Date.now(), updatedAt: Date.now(), lastGenAt: 0
});

/* ---------------- 查询 ---------------- */
F.me = () => F.state.identities.find(i => i.id === F.state.activeIdentityId);
F.identity = id => F.state.identities.find(i => i.id === id);
F.charProfile = id => F.state.charProfiles.find(c => c.id === id);
F.charProfileByChar = cid => F.state.charProfiles.find(c => c.charId === cid);
F.world = id => F.state.worlds.find(w => w.id === id);
F.post = id => F.state.posts.find(p => p.id === id);
F.npc = id => F.state.npcs.find(n => n.id === id);

/* 统一解析作者引用 {kind,id} → 可展示的档案 */
F.person = ref => {
  if (!ref) return null;
  if (ref.kind === 'user') { const u = F.identity(ref.id); return u ? { ...u, kind: 'user' } : { kind: 'user', id: ref.id, nickname: '已注销用户', handle: 'deleted', verify: F.newVerify(), base: {} }; }
  if (ref.kind === 'char') { const c = F.charProfile(ref.id); return c ? { ...c, kind: 'char' } : { kind: 'char', id: ref.id, nickname: '角色', handle: 'char', verify: F.newVerify(), base: {} }; }
  const n = F.npc(ref.id);
  return n ? { ...n, kind: 'npc' } : { kind: 'npc', id: ref.id, nickname: '网友', handle: 'user', verify: F.newVerify(), base: {} };
};
F.isVerified = p => !!p && ((p.verify && p.verify.status === 'verified') || p.verified === true);
F.verifyTitle = p => p ? ((p.verify && p.verify.status === 'verified' && p.verify.title) || p.verifiedTitle || '') : '';
F.refEq = (a, b) => a && b && a.kind === b.kind && a.id === b.id;

/* 关注关系：以当前身份为主体 */
F.isFollowing = ref => (F.me().following || []).some(r => F.refEq(r, ref));
F.followerCount = person => {
  const ref = { kind: person.kind, id: person.id };
  const extra = F.state.identities.filter(i => (i.following || []).some(r => F.refEq(r, ref))).length;
  const base = person.kind === 'npc' ? (person.followers || 0) : ((person.base && person.base.followers) || 0);
  return base + extra;
};
F.followingCount = person => {
  if (person.kind === 'user') return (person.following || []).length + ((person.base && person.base.following) || 0);
  if (person.kind === 'npc') return person.following || 0;
  return (person.base && person.base.following) || 0;
};
F.postsBy = ref => F.state.posts.filter(p => F.refEq(p.author, ref)).sort((a, b) => b.createdAt - a.createdAt);
F.likesReceived = ref => F.postsBy(ref).reduce((s, p) => s + F.likeCount(p), 0) + (ref.kind === 'npc' ? ((F.npc(ref.id) || {}).likes || 0) : 0);
F.likeCount = p => (p.stats.likes || 0) + (p.likedBy || []).length;
F.favCount = p => (p.stats.favorites || 0) + (p.favBy || []).length;
F.commentCount = p => (p.comments || []).reduce((s, c) => s + 1 + (c.replies || []).length, 0);

/* ---------------- 外部数据库：角色档案 / 世界书（只读，不改动版本） ---------------- */
F.ext = {
  _openRO(name) {
    return new Promise(res => {
      let r;
      try { r = indexedDB.open(name); } catch (e) { return res(null); }
      r.onsuccess = e => res(e.target.result);
      r.onerror = () => res(null);
      r.onupgradeneeded = () => {}; // 全新库由原应用负责建表，这里不建
    });
  },
  async all(dbName, store) {
    const db = await this._openRO(dbName);
    if (!db || !db.objectStoreNames.contains(store)) { db && db.close(); return []; }
    return new Promise(res => {
      const q = db.transaction(store, 'readonly').objectStore(store).getAll();
      q.onsuccess = () => { res(q.result || []); db.close(); };
      q.onerror = () => { res([]); db.close(); };
    });
  },
  chars() { return this.all('LunaCharDB', 'chars'); },
  worldbook() { return this.all('LunaWorldBookDB', 'entries'); },
  async memories(charKey) {
    const db = await this._openRO('LunaMemoryDB');
    if (!db) return [];
    const stores = Array.from(db.objectStoreNames);
    db.close();
    const out = [];
    for (const s of stores) {
      const rows = await this.all('LunaMemoryDB', s);
      rows.forEach(r => {
        const owner = r.charId ?? r.charKey ?? r.char ?? r.owner;
        if (owner == null || String(owner) === String(charKey)) out.push(r);
      });
    }
    return out;
  }
};

/* ---------------- 状态栏：与桌面 index 同步（时间 / 电量 / 灵动岛 / 字体） ---------------- */
F.statusbar = {
  init() {
    this.time(); setInterval(() => this.time(), 1000 * 15);
    this.battery(); this.island(); this.font();
    window.addEventListener('storage', e => {
      if (e.key === 'luna_island_update') this.island();
      if (e.key === 'luna_tz_update') this.time();
      if (e.key === 'luna_font_update') this.font();
    });
  },
  time() {
    const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
    let s;
    try { s = new Date().toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }); }
    catch (e) { s = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }); }
    document.querySelectorAll('.status-time').forEach(el => el.textContent = s);
  },
  battery() {
    const render = pct => {
      const p = Math.round(pct);
      document.querySelectorAll('.bat-pct').forEach(el => el.textContent = p);
      document.querySelectorAll('.bat-inner').forEach(el => {
        el.style.width = p + '%';
        el.style.background = p <= 20 ? 'linear-gradient(90deg,#f87171,#ef4444)' : 'linear-gradient(90deg,#6ee7b7,#34d399)';
      });
    };
    if ('getBattery' in navigator) navigator.getBattery().then(b => { render(b.level * 100); b.addEventListener('levelchange', () => render(b.level * 100)); });
    else render(76);
  },
  island() {
    const enabled = localStorage.getItem('luna_island_enabled') === 'true';
    const style = localStorage.getItem('luna_island_style') || 'minimal';
    const map = {
      minimal: '<div class="si-minimal"><div class="si-capsule"></div></div>',
      glow: '<div class="si-glow"><div class="si-capsule"></div></div>',
      clock: '<div class="si-clock"><div class="si-capsule"><span class="si-clock-text">--:--</span></div></div>',
      pulse: '<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>',
      ripple: '<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>',
      rainbow: '<div class="si-rainbow"><div class="si-capsule"></div></div>',
      music: '<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>',
      scan: '<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>'
    };
    document.querySelectorAll('.status-island').forEach(el => el.innerHTML = enabled ? (map[style] || map.minimal) : '');
    clearInterval(window._siClockTimer);
    if (enabled && style === 'clock') {
      const tick = () => { const n = new Date(); document.querySelectorAll('.si-clock-text').forEach(el => el.textContent = n.getHours() + ':' + String(n.getMinutes()).padStart(2, '0')); };
      tick(); window._siClockTimer = setInterval(tick, 10000);
    }
  },
  async font() {
    const name = localStorage.getItem('luna_font_active_name');
    const id = parseInt(localStorage.getItem('luna_font_active_id'));
    if (name && id) {
      try {
        const all = await F.ext.all('LunaFontDB', 'fonts');
        const f = all.find(x => x.id === id);
        if (f) { const face = new FontFace(name, `url(${f.data})`); await face.load(); document.fonts.add(face); }
      } catch (e) {}
    }
    let tag = document.getElementById('luna-font-override');
    if (!tag) { tag = document.createElement('style'); tag.id = 'luna-font-override'; document.head.appendChild(tag); }
    tag.textContent = name ? `body,button,input,textarea{font-family:'${name}',var(--f-ui)!important}` : '';
  },
  tone(dark) { document.getElementById('statusBar').classList.toggle('on-dark', !!dark); }
};

/* ---------------- 生成式视觉：没有图片时的头像 / 封面 / 图片占位 ---------------- */
F.art = {
  palette: ['#1e1e22', '#34343a', '#4c4c54', '#6a6a72', '#8e8e96', '#b4b4bb', '#d6d6db', '#ececef'],
  avatarSVG(seed, name) {
    const r = F.rng(seed + 'av');
    const a = this.palette[Math.floor(r() * 4)], b = this.palette[3 + Math.floor(r() * 4)];
    const ang = Math.floor(r() * 360);
    const ch = F.esc((name || '·').trim().slice(0, 1).toUpperCase());
    const cx = 20 + r() * 60, cy = 20 + r() * 60;
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g${F.hash(seed)}" gradientTransform="rotate(${ang} .5 .5)"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="100" height="100" fill="url(#g${F.hash(seed)})"/><circle cx="${cx}" cy="${cy}" r="${30 + r() * 24}" fill="#fff" opacity=".13"/><text x="50" y="50" dy=".36em" text-anchor="middle" font-family="Fraunces,Noto Serif SC,serif" font-size="42" fill="#fff" opacity=".94">${ch}</text></svg>`;
  },
  coverSVG(seed) {
    const r = F.rng(seed + 'cv');
    let paths = '';
    for (let i = 0; i < 5; i++) {
      const y = 20 + i * 18 + r() * 12, amp = 10 + r() * 26, c = this.palette[2 + Math.floor(r() * 6)];
      paths += `<path d="M-10 ${y} C 80 ${y - amp}, 140 ${y + amp}, 210 ${y - amp / 2} S 330 ${y + amp}, 420 ${y}" stroke="${c}" stroke-width="${8 + r() * 24}" fill="none" opacity="${.18 + r() * .35}" stroke-linecap="round"/>`;
    }
    const g = F.hash(seed);
    return `<svg viewBox="0 0 400 160" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="cv${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f4f6"/><stop offset=".55" stop-color="#cfcfd5"/><stop offset="1" stop-color="#8f8f98"/></linearGradient><radialGradient id="cr${g}" cx="${.2 + r() * .6}" cy="0" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="400" height="160" fill="url(#cv${g})"/>${paths}<rect width="400" height="160" fill="url(#cr${g})"/></svg>`;
  },
  photoSVG(seed) {
    const r = F.rng(seed + 'ph');
    const g = F.hash(seed);
    const hz = 45 + r() * 30;
    let shapes = '';
    const kind = Math.floor(r() * 3);
    if (kind === 0) { for (let i = 0; i < 3; i++) shapes += `<circle cx="${r() * 100}" cy="${20 + r() * 60}" r="${10 + r() * 30}" fill="#fff" opacity="${.08 + r() * .2}"/>`; }
    if (kind === 1) { for (let i = 0; i < 6; i++) shapes += `<rect x="${i * 17 + r() * 4}" y="${hz - 10 - r() * 40}" width="${6 + r() * 10}" height="${60}" fill="#000" opacity="${.08 + r() * .14}"/>`; }
    if (kind === 2) { shapes += `<path d="M0 ${hz} Q 30 ${hz - 20 - r() * 20} 55 ${hz - 5} T 100 ${hz - 12} V100 H0Z" fill="#000" opacity=".22"/>`; }
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="ph${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${this.palette[5 + Math.floor(r() * 3)]}"/><stop offset="1" stop-color="${this.palette[1 + Math.floor(r() * 3)]}"/></linearGradient><radialGradient id="pl${g}" cx="${r()}" cy="${r() * .5}" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="100" height="100" fill="url(#ph${g})"/>${shapes}<rect width="100" height="100" fill="url(#pl${g})"/></svg>`;
  }
};

/* 头像 HTML：优先真实头像，其次生成式 */
F.avatarHTML = (person, size = 40, extraCls = '') => {
  const p = person || {};
  const inner = p.avatar ? `<img src="${p.avatar}" alt="">` : F.art.avatarSVG(p.handle || p.id || p.nickname, p.nickname);
  return `<div class="av ${extraCls}" style="width:${size}px;height:${size}px">${inner}</div>`;
};
F.coverHTML = person => person && person.cover ? `<img src="${person.cover}" alt="">` : F.art.coverSVG((person && (person.handle || person.id)) || 'cover');
