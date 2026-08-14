/* ================================
   世界书 — worldbook.js
   状态栏 / 灵动岛 / 字体 完整同步 index
   功能体系：分类 · 常驻/触发 · 优先级 · 概率 · 扫描深度 · 递归 · 互斥组 · 导入导出 · 模板
================================ */

/* ================================
   分类样式 map
================================ */
const CAT_CLASS = {
  '人物': 'cat-char',
  '地点': 'cat-location',
  '势力': 'cat-faction',
  '事件': 'cat-event',
  '关系': 'cat-rel',
  '物品': 'cat-item',
  '规则': 'cat-rule',
  '其他': 'cat-other',
};

/* 条目模板：预填内容，帮助用户快速搭建结构完整的设定 */
const ENTRY_TEMPLATES = {
  '人物': {
    sub: '一句话概括这个角色的核心反差或标签',
    keywords: '角色名, 别称, 昵称',
    detail:
`【外貌】身高体态、标志性穿着或配饰、气质给人的第一印象
【性格底色】表面性格 vs 内在性格的反差，价值观与恐惧
【说话方式】口头禅、句式习惯、称呼用户的方式、语气词
【行为模式】遇到开心/生气/尴尬时的具体反应，小动作
【绝对底线】无论如何不会做/不会说的事情（防止OOC的关键）
【与用户的关系锚点】当前关系阶段、称呼方式、心理距离`,
    mode: 'keyword', priority: 6, pos: 'before'
  },
  '关系': {
    sub: '两个或多个角色之间的立场与情感状态',
    keywords: '角色A, 角色B, 关系',
    detail:
`【关系性质】明面上的关系 / 私下真实的关系
【历史节点】关系是如何建立、发生过什么关键事件
【当前状态】现在互相的态度、称呼、有无隔阂
【禁忌话题】提到什么会让关系紧张，绝不能主动提起的事`,
    mode: 'keyword', priority: 6, pos: 'before'
  },
  '规则': {
    sub: '常驻注入的行为准则，防止AI掉人设、跑偏格式',
    keywords: '',
    detail:
`【人设铁律】始终保持第一人称扮演，禁止出现"作为AI/作为语言模型"等表述
【格式规范】每次回复控制在 [ ] 字以内；禁止使用markdown加粗/标题符号；对话与动作描写用 * 包裹动作，其余为对话原文
【禁止行为】不得跳出角色视角进行解说或总结；不得替用户做出选择或代写用户台词；不主动结束对话或催促用户
【语气基调】始终贴合角色设定的说话习惯，禁止使用过于书面化、AI助手式的礼貌用语`,
    mode: 'constant', priority: 10, pos: 'system'
  },
  '地点': {
    sub: '场景的空间细节与氛围描述',
    keywords: '地名, 别称',
    detail:
`【空间结构】大致布局、标志性建筑或角落
【感官细节】光线、气味、声音、温度带来的氛围
【常见活动】谁会出现在这里、通常在做什么
【隐藏信息】只有特定角色才知道的秘密角落或用途`,
    mode: 'keyword', priority: 4, pos: 'before'
  },
  '事件': {
    sub: '已发生的关键剧情节点，供AI保持时间线一致',
    keywords: '事件名称, 相关关键词',
    detail:
`【时间】发生在什么时间点/第几次对话之后
【经过】关键节点的简要描述
【结果】对角色关系/世界状态造成的影响
【后续】角色是否还记得、是否会主动提起`,
    mode: 'keyword', priority: 5, pos: 'before'
  }
};

/* ---- 返回首页 ---- */
function goBack() {
  const mask = document.createElement('div');
  mask.style.cssText = 'position:fixed;inset:0;background:rgba(250,250,250,0.97);opacity:0;z-index:9999;transition:opacity 0.28s ease;pointer-events:all;';
  document.body.appendChild(mask);
  requestAnimationFrame(() => { mask.style.opacity = '1'; });
  setTimeout(() => { window.location.href = 'index.html'; }, 260);
}

/* ================================
   状态栏时间 — 同步 index
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
   电量 — 同步 index
================================ */
function updateBattery() {
  function render(pct) {
    const p = Math.round(pct);
    document.querySelectorAll('.bat-pct').forEach(el => el.textContent = p);
    document.querySelectorAll('.bat-inner').forEach(el => {
      el.style.width      = p + '%';
      el.style.background = p <= 20 ? '#8a3b3b' : (el.closest('.wv-status-bar') ? '#ffffff' : '#17181a');
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
   灵动岛 — 完整同步 index
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
});

/* ================================
   字体同步 — 完整同步 index
================================ */
async function applyGlobalFont() {
  const style = JSON.parse(localStorage.getItem('luna_font_style') || '{}');
  const name  = localStorage.getItem('luna_font_active_name');
  const id    = parseInt(localStorage.getItem('luna_font_active_id'));
  if (name && id) {
    try {
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open('LunaFontDB',3 );
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
  tag.textContent  = `* { ${familyRule} }`;
}

/* ================================
   IndexedDB — 世界书数据
================================ */
let _wbDb = null;

function openWbDB() {
  return new Promise((res, rej) => {
    if (_wbDb) return res(_wbDb);
    const req = indexedDB.open('LunaWorldBookDB', 2);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('entries', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = e => { _wbDb = e.target.result; res(_wbDb); };
    req.onerror   = () => rej('WB DB Error');
  });
}

async function getAllEntries() {
  const db = await openWbDB();
  return new Promise(res => {
    const req = db.transaction('entries').objectStore('entries').getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror   = () => res([]);
  });
}

async function saveEntry_db(data) {
  const db = await openWbDB();
  return new Promise(res => {
    const tx    = db.transaction('entries', 'readwrite');
    const store = tx.objectStore('entries');
    const req   = data.id ? store.put(data) : store.add(data);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => res(null);
  });
}

async function deleteEntry_db(id) {
  const db = await openWbDB();
  return new Promise(res => {
    const tx = db.transaction('entries', 'readwrite');
    tx.objectStore('entries').delete(id);
    tx.oncomplete = () => res();
  });
}

/* ================================
   角色读写 — 与角色档案 IndexedDB
   （characters.js 的 openCharDB / saveChar 同一份数据）
   之前这里只读不写，导致世界书这一侧勾选角色后，
   角色档案自己的 worldEntries 字段永远不会更新，
   两边各记一份、互不同步。现在补上可写版本。
================================ */
let _charDb = null;

function openCharDBWritable() {
  return new Promise((res, rej) => {
    if (_charDb) return res(_charDb);
    /* 与 characters.js 探测版本号的策略一致：先不带版本号打开，
       拿到当前真实版本，若 chars store 已存在则直接复用，
       避免用固定版本号打开导致版本冲突报错 */
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

async function saveChar_db(charData) {
  try {
    const db = await openCharDBWritable();
    return new Promise(res => {
      const tx    = db.transaction('chars', 'readwrite');
      const store = tx.objectStore('chars');
      const req   = store.put(charData);
      req.onsuccess = () => res(req.result);
      req.onerror   = () => res(null);
    });
  } catch (e) { return null; }
}

async function getAllChars() {
  try {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open('LunaCharDB', 2);
      req.onsuccess = e => res(e.target.result);
      req.onerror   = () => rej();
    });
    return new Promise(res => {
      const r = db.transaction('chars').objectStore('chars').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror   = () => res([]);
    });
  } catch(e) { return []; }
}

/* 双向同步核心：保存世界书条目时，把这次勾选的角色
   写回各自角色的 worldEntries 字段——凡是本条目新增
   关联的角色，把 entry.id 加进它的 worldEntries；
   凡是本条目取消关联的角色，把 entry.id 从它的
   worldEntries 里摘除。与 characters.js 的
   syncWorldEntriesForChar 互为镜像，两端各自保存时
   都会把另一端的数据一起理顺，不会出现单向覆盖。 */
async function syncCharsForEntry(entryId, selectedCharIds) {
  if (entryId == null) return; // 新建条目首次保存前没有 id
  const allChars = await getAllChars();
  const selectedSet = new Set(selectedCharIds || []);
  const writes = [];

  allChars.forEach(ch => {
    const we  = Array.isArray(ch.worldEntries) ? ch.worldEntries.slice() : [];
    const has = we.includes(entryId);
    const should = selectedSet.has(ch.id);
    if (should && !has) {
      we.push(entryId);
      writes.push(saveChar_db({ ...ch, worldEntries: we }));
    } else if (!should && has) {
      writes.push(saveChar_db({ ...ch, worldEntries: we.filter(id => id !== entryId) }));
    }
  });

  if (writes.length) await Promise.all(writes);
  /* 通知角色档案页（若在其他标签页打开）刷新关联展示 */
  localStorage.setItem('luna_char_db_update', Date.now());
}

/* ================================
   状态管理
================================ */
let _entries    = [];
let _chars      = [];
let _editingId  = null;
let _viewingId  = null;
let _filterCat  = 'all';
let _searchQ    = '';
let _selChars   = [];
let _formBgData = null;
let _formPos    = 'before';
let _formMode   = 'keyword';
let _advOpen    = false;

/* ================================
   Toast 提示
================================ */
let _toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('wbToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ================================
   渲染列表
================================ */
async function renderList() {
  _entries = await getAllEntries();
  _chars   = await getAllChars();
  updateStats();

  const list = document.getElementById('wbList');
  list.innerHTML = '';

  let filtered = _entries;
  if (_filterCat !== 'all') filtered = filtered.filter(e => e.cat === _filterCat);
  if (_searchQ) {
    const q = _searchQ.toLowerCase();
    filtered = filtered.filter(e =>
      (e.title || '').toLowerCase().includes(q) ||
      (e.keywords || '').toLowerCase().includes(q) ||
      (e.keywordsSec || '').toLowerCase().includes(q) ||
      (e.sub || '').toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="wb-empty">
        <div class="wb-empty-icon">
          <svg viewBox="0 0 48 48" width="34" height="34" fill="none">
            <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="1.2" opacity="0.5"/>
            <path d="M16 20h16M16 26h10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity="0.5"/>
            <circle cx="35" cy="35" r="6" fill="currentColor" opacity="0.08"/>
            <path d="M33 35h4M35 33v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity="0.6"/>
          </svg>
        </div>
        <div class="wb-empty-title">${_searchQ ? '未找到匹配的条目' : '还没有世界书条目'}</div>
        <div class="wb-empty-desc">${_searchQ ? '换个关键词试试？' : '点击右上角 + 创建，或使用「条目模板」<br>快速搭建人物设定 / OOC 防护规则'}</div>
        ${!_searchQ ? `<button class="wb-empty-btn" onclick="openNewEntry()">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          立即创建
        </button>` : ''}
      </div>`;
    return;
  }

  // 常驻条目置顶排序（不改变用户对同类的相对顺序太多，只做分组）
  const sorted = [...filtered].sort((a, b) => {
    const ac = a.mode === 'constant' ? 0 : 1;
    const bc = b.mode === 'constant' ? 0 : 1;
    if (ac !== bc) return ac - bc;
    return (b.priority ?? 5) - (a.priority ?? 5);
  });

  sorted.forEach((entry, i) => {
    const card = buildCard(entry);
    card.style.animationDelay = `${0.04 + i * 0.06}s`;
    list.appendChild(card);
  });
  list.appendChild(Object.assign(document.createElement('div'), { style: 'height:40px' }));
}

/* ================================
   构建卡片
================================ */
function buildCard(entry) {
  const catCls  = CAT_CLASS[entry.cat] || 'cat-other';
  const kwFirst = (entry.keywords || '').split(',').map(s=>s.trim()).filter(Boolean)[0] || '';
  const isConst = entry.mode === 'constant';

  const charIds = entry.chars || [];
  const linkedChars = charIds.map(id => _chars.find(c => c.id === id)).filter(Boolean);

  let avatarHTML = '';
  if (linkedChars.length === 0) {
    avatarHTML = `
      <div class="wb-avatar-slot empty">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
          <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.5"/>
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>`;
  } else {
    const show = linkedChars.slice(0, 2);
    avatarHTML = show.map(c => {
      const letter = (c.name || '?')[0].toUpperCase();
      return `<div class="wb-avatar-slot" style="margin-bottom:4px">
        ${c.avatar
          ? `<img src="${c.avatar}" alt="${escHtml(c.name)}"/>`
          : `<span style="font-size:14px;font-weight:700">${letter}</span>`
        }
      </div>`;
    }).join('');
    if (linkedChars.length > 2) {
      avatarHTML += `<div class="wb-avatar-more">+${linkedChars.length - 2}</div>`;
    }
  }

  const div = document.createElement('div');
  div.className = 'wb-card';
  div.dataset.id = entry.id;
  div.innerHTML = `
    <div class="wb-card-stripe ${catCls}"></div>
    <div class="wb-card-body">
      <div class="wb-card-avatars">${avatarHTML}</div>
      <div class="wb-card-main">
        <div class="wb-card-top">
          <div class="wb-cat-pill ${catCls}">${entry.cat || '其他'}</div>
          ${isConst ? `<div class="wb-const-badge">
            <svg viewBox="0 0 24 24" width="9" height="9" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/></svg>
            常驻
          </div>` : ''}
        </div>
        <div class="wb-card-title">${escHtml(entry.title || '未命名')}</div>
        <div class="wb-card-sub">${escHtml(entry.sub || '无描述')}</div>
        <div class="wb-card-footer">
          <div class="wb-card-meta">
            <div class="wb-status-dot ${entry.enabled !== false ? 'on' : 'off'}"></div>
            ${!isConst && kwFirst ? `<div class="wb-card-kw">${escHtml(kwFirst)}</div>` : ''}
            ${isConst ? `<div class="wb-card-kw">P${entry.priority ?? 5}</div>` : ''}
          </div>
          <div class="wb-card-arrow">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none">
              <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
    </div>`;
  div.onclick = () => openView(entry.id);
  return div;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ================================
   统计数据
================================ */
function updateStats() {
  const cats     = new Set(_entries.map(e => e.cat)).size;
  const enabled  = _entries.filter(e => e.enabled !== false).length;
  const constant = _entries.filter(e => e.mode === 'constant' && e.enabled !== false).length;
  const countEl   = document.getElementById('statCount');
  const catsEl    = document.getElementById('statCats');
  const enabledEl = document.getElementById('statEnabled');
  const constEl   = document.getElementById('statConst');
  if (countEl)   countEl.textContent   = String(_entries.length).padStart(2,'0');
  if (catsEl)    catsEl.textContent    = String(cats).padStart(2,'0');
  if (enabledEl) enabledEl.textContent = String(enabled).padStart(2,'0');
  if (constEl)   constEl.textContent   = String(constant).padStart(2,'0');
}

/* ================================
   筛选 & 搜索
================================ */
function filterBy(btn) {
  document.querySelectorAll('.wb-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _filterCat = btn.dataset.cat;
  renderList();
}

function onSearch(val) {
  _searchQ = val.trim();
  renderList();
}

/* ================================
   新建 / 编辑 弹窗
================================ */
async function openNewEntry() {
  _editingId  = null;
  _formBgData = null;
  _selChars   = [];
  _formPos    = 'before';
  _formMode   = 'keyword';
  _advOpen    = false;

  document.getElementById('wbModalTitle').textContent        = '新建条目';
  document.getElementById('formTitle').value                 = '';
  document.getElementById('formSub').value                   = '';
  document.getElementById('formKeywords').value               = '';
  document.getElementById('formKeywordsSec').value            = '';
  document.getElementById('formDetail').value                 = '';
  document.getElementById('detailCount').textContent          = '0';
  document.getElementById('formEnabled').checked               = true;
  document.getElementById('formPriority').value                = 5;
  document.getElementById('priorityVal').textContent           = '5';
  document.getElementById('formProbability').value             = 100;
  document.getElementById('probabilityVal').textContent        = '100%';
  document.getElementById('formScanDepth').value                = 4;
  document.getElementById('scanDepthVal').textContent           = '4';
  document.getElementById('formRecursion').checked              = false;
  document.getElementById('formGroup').value                    = '';
  document.getElementById('wbPreviewBg').style.backgroundImage = '';
  document.getElementById('previewTitle').textContent        = '条目名称';
  document.getElementById('previewSub').textContent          = '简短描述';
  document.getElementById('previewCat').textContent          = '人物';
  syncCatDropdown('人物');

  document.querySelectorAll('.wb-pos-btn').forEach(b => b.classList.toggle('active', b.dataset.pos === 'before'));
  document.querySelectorAll('.wb-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'keyword'));
  applyModeUI();
  setAdvanced(false);

  await buildCharPicker();
  showModal();
}

async function editEntry(id) {
  const e = _entries.find(x => x.id === id);
  if (!e) return;
  _editingId  = id;
  _formBgData = e.bg || null;
  _selChars   = e.chars ? [...e.chars] : [];
  _formPos    = e.pos || 'before';
  _formMode   = e.mode || 'keyword';

  document.getElementById('wbModalTitle').textContent = '编辑条目';
  document.getElementById('formTitle').value          = e.title       || '';
  document.getElementById('formSub').value             = e.sub         || '';
  document.getElementById('formKeywords').value        = e.keywords    || '';
  document.getElementById('formKeywordsSec').value     = e.keywordsSec || '';
  document.getElementById('formDetail').value          = e.detail      || '';
  document.getElementById('detailCount').textContent   = (e.detail || '').length;
  document.getElementById('formEnabled').checked       = e.enabled !== false;
  document.getElementById('formPriority').value         = e.priority ?? 5;
  document.getElementById('priorityVal').textContent    = String(e.priority ?? 5);
  document.getElementById('formProbability').value      = e.probability ?? 100;
  document.getElementById('probabilityVal').textContent = String(e.probability ?? 100) + '%';
  document.getElementById('formScanDepth').value         = e.scanDepth ?? 4;
  document.getElementById('scanDepthVal').textContent    = String(e.scanDepth ?? 4);
  document.getElementById('formRecursion').checked       = !!e.recursion;
  document.getElementById('formGroup').value              = e.group || '';
  syncCatDropdown(e.cat || '人物');
  document.getElementById('previewTitle').textContent  = e.title       || '条目名称';
  document.getElementById('previewSub').textContent    = e.sub         || '简短描述';
  document.getElementById('previewCat').textContent    = e.cat         || '人物';

  const bg = document.getElementById('wbPreviewBg');
  bg.style.backgroundImage = e.bg ? `url(${e.bg})` : '';

  document.querySelectorAll('.wb-pos-btn').forEach(b => b.classList.toggle('active', b.dataset.pos === _formPos));
  document.querySelectorAll('.wb-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === _formMode));
  applyModeUI();
  setAdvanced(false);

  await buildCharPicker();
  showModal();
}

/* 从模板创建 */
function createFromTemplate(cat) {
  closeTemplateMenu();
  const tpl = ENTRY_TEMPLATES[cat];
  openNewEntry().then(() => {
    if (!tpl) return;
    syncCatDropdown(cat);
    document.getElementById('previewCat').textContent = cat;
    document.getElementById('formSub').value = tpl.sub || '';
    document.getElementById('previewSub').textContent = tpl.sub || '简短描述';
    document.getElementById('formKeywords').value = tpl.keywords || '';
    document.getElementById('formDetail').value = tpl.detail || '';
    document.getElementById('detailCount').textContent = (tpl.detail || '').length;
    document.getElementById('formPriority').value = tpl.priority ?? 5;
    document.getElementById('priorityVal').textContent = String(tpl.priority ?? 5);

    _formMode = tpl.mode || 'keyword';
    document.querySelectorAll('.wb-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === _formMode));
    applyModeUI();

    _formPos = tpl.pos || 'before';
    document.querySelectorAll('.wb-pos-btn').forEach(b => b.classList.toggle('active', b.dataset.pos === _formPos));

    document.getElementById('formTitle').focus();
  });
}

/* 模板菜单 */
function openTemplateMenu() {
  document.getElementById('wbTplOverlay').classList.add('show');
  document.getElementById('wbTplMenu').classList.add('show');
}
function closeTemplateMenu() {
  document.getElementById('wbTplOverlay').classList.remove('show');
  document.getElementById('wbTplMenu').classList.remove('show');
}

/* 构建关联角色选择器 */
async function buildCharPicker() {
  _chars = await getAllChars();
  const picker = document.getElementById('wbCharPicker');
  if (_chars.length === 0) {
    picker.innerHTML = `<div class="wb-char-empty-hint">暂无角色，请先在角色档案中创建</div>`;
    return;
  }
  picker.innerHTML = _chars.map(c => {
    const letter   = (c.name || '?')[0].toUpperCase();
    const selected = _selChars.includes(c.id);
    return `
      <div class="wb-char-chip ${selected ? 'selected' : ''}" onclick="toggleCharSel(this, ${c.id})">
        <div class="wb-char-chip-av">
          ${c.avatar
            ? `<img src="${c.avatar}" alt="${escHtml(c.name)}"/>`
            : `<span>${letter}</span>`
          }
        </div>
        ${escHtml(c.name || '')}
      </div>`;
  }).join('');
}

function toggleCharSel(el, id) {
  el.classList.toggle('selected');
  if (el.classList.contains('selected')) {
    if (!_selChars.includes(id)) _selChars.push(id);
  } else {
    _selChars = _selChars.filter(x => x !== id);
  }
}

function onCatChange(sel) {
  document.getElementById('previewCat').textContent = sel.value;
}

/* ================================
   分类下拉（自定义样式的 select）
   原生 <select id="formCat"> 被隐藏，仅用于持有真实值；
   下面这套函数负责展开/收起面板、勾选高亮、
   以及把选择结果写回原生 select 并触发预览更新。
================================ */
const CAT_LABELS = {
  '人物': '人物设定', '地点': '地点', '势力': '势力', '事件': '事件',
  '关系': '关系网', '物品': '物品/概念', '规则': '规则/OOC防护', '其他': '其他'
};

function toggleCatDropdown() {
  const wrap = document.getElementById('formCatSelect');
  const isOpen = wrap.classList.contains('open');
  if (isOpen) {
    closeCatDropdown();
  } else {
    wrap.classList.add('open');
    document.addEventListener('click', _catDropdownOutsideClick, true);
  }
}

function closeCatDropdown() {
  document.getElementById('formCatSelect').classList.remove('open');
  document.removeEventListener('click', _catDropdownOutsideClick, true);
}

function _catDropdownOutsideClick(e) {
  const wrap = document.getElementById('formCatSelect');
  if (wrap && !wrap.contains(e.target)) closeCatDropdown();
}

function pickCatOption(el) {
  const value = el.dataset.value;
  syncCatDropdown(value);
  document.getElementById('previewCat').textContent = value;
  closeCatDropdown();
}

/* 供「新建/编辑/模板」等直接修改 formCat.value 的地方调用，
   保证自定义下拉的显示文字和高亮状态跟原生 select 同步 */
function syncCatDropdown(value) {
  const select = document.getElementById('formCat');
  select.value = value;
  const label = CAT_LABELS[value] || value;
  const textEl = document.getElementById('formCatTriggerText');
  if (textEl) textEl.textContent = label;
  document.querySelectorAll('#formCatPanel .wb-select-opt').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.value === value);
  });
}

function selectPos(btn) {
  document.querySelectorAll('.wb-pos-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _formPos = btn.dataset.pos;
}

function selectMode(btn) {
  document.querySelectorAll('.wb-mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _formMode = btn.dataset.mode;
  applyModeUI();
}

function applyModeUI() {
  const kwGroup    = document.getElementById('wbKeywordGroup');
  const kwSecGroup = document.getElementById('wbKeywordSecGroup');
  const hintText   = document.getElementById('wbModeHintText');
  if (_formMode === 'constant') {
    kwGroup.style.display = 'none';
    kwSecGroup.style.display = 'none';
    hintText.textContent = '不依赖关键词，只要条目「启用」即会持续注入到每一次对话中；适合人设铁律、格式规范、OOC 防护等最重要的常驻规则。请谨慎使用，过多常驻条目会占用大量 Token。';
  } else {
    kwGroup.style.display = '';
    kwSecGroup.style.display = '';
    hintText.textContent = '对话中出现关键词才会注入，节省 Token；适合地点、物品、次要角色等非核心设定。';
  }
}

function toggleAdvanced() {
  setAdvanced(!_advOpen);
}
function setAdvanced(open) {
  _advOpen = open;
  document.getElementById('wbAdvToggle').classList.toggle('open', open);
  document.getElementById('wbAdvBody').classList.toggle('open', open);
}

function handleBgUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _formBgData = e.target.result;
    document.getElementById('wbPreviewBg').style.backgroundImage = `url(${e.target.result})`;
  };
  reader.readAsDataURL(file);
}

/* ================================
   保存条目
================================ */
async function saveEntry() {
  const title        = document.getElementById('formTitle').value.trim();
  const sub          = document.getElementById('formSub').value.trim();
  const cat          = document.getElementById('formCat').value;
  const keywords     = document.getElementById('formKeywords').value.trim();
  const keywordsSec  = document.getElementById('formKeywordsSec').value.trim();
  const detail       = document.getElementById('formDetail').value.trim();
  const enabled      = document.getElementById('formEnabled').checked;
  const priority     = parseInt(document.getElementById('formPriority').value, 10);
  const probability  = parseInt(document.getElementById('formProbability').value, 10);
  const scanDepth    = parseInt(document.getElementById('formScanDepth').value, 10);
  const recursion    = document.getElementById('formRecursion').checked;
  const group        = document.getElementById('formGroup').value.trim();

  if (!title) { document.getElementById('formTitle').focus(); return; }
  if (_formMode === 'keyword' && !keywords) {
    document.getElementById('formKeywords').focus();
    showToast('关键词触发模式需要至少填写一个关键词');
    return;
  }

  const data = {
    title, sub, cat, keywords, keywordsSec, detail, enabled,
    chars: [..._selChars], pos: _formPos, bg: _formBgData,
    mode: _formMode, priority, probability, scanDepth, recursion, group,
    updatedAt: Date.now()
  };
  if (_editingId) data.id = _editingId;

  const savedId = await saveEntry_db(data);
  const entryId = _editingId || savedId;

  // 把这次勾选结果写回所有相关角色的 worldEntries 字段，
  // 保证「世界书」和「角色档案」两端看到的关联关系始终一致
  await syncCharsForEntry(entryId, _selChars);

  closeModal();
  await renderList();
  showToast(_editingId ? '条目已更新' : '条目已保存');
  if (_viewingId) openView(_viewingId);
}

function showModal() {
  document.getElementById('wbModalOverlay').classList.add('show');
  document.getElementById('wbModal').classList.add('show');
}

function closeModal() {
  document.getElementById('wbModalOverlay').classList.remove('show');
  document.getElementById('wbModal').classList.remove('show');
}

/* ================================
   详情页
================================ */
async function openView(id) {
  _entries = await getAllEntries();
  _chars   = await getAllChars();
  const e  = _entries.find(x => x.id === id);
  if (!e) return;
  _viewingId = id;

  const bg = document.getElementById('wvHeroBg');
  bg.style.backgroundImage = e.bg ? `url(${e.bg})` : '';

  const catCls = CAT_CLASS[e.cat] || 'cat-other';
  document.getElementById('wvCatBadge').textContent = e.cat || '其他';
  document.getElementById('wvTitle').textContent    = e.title   || '—';
  document.getElementById('wvSub').textContent      = e.sub     || '—';
  document.getElementById('wvCat').textContent      = e.cat     || '—';
  document.getElementById('wvPos').textContent      = posLabel(e.pos);
  document.getElementById('wvModeVal').textContent  = e.mode === 'constant' ? '常驻' : '触发';
  document.getElementById('wvDetail').textContent   = e.detail  || '（暂无详细设定）';

  document.getElementById('wvPriority').textContent    = String(e.priority ?? 5);
  document.getElementById('wvProbability').textContent = String(e.probability ?? 100) + '%';
  document.getElementById('wvScanDepth').textContent    = e.mode === 'constant' ? '—' : String(e.scanDepth ?? 4);
  document.getElementById('wvRecursion').textContent    = e.recursion ? '已开启' : '未开启';

  const pill = document.getElementById('wvStatusPill');
  pill.textContent = e.enabled !== false ? '启用中' : '已禁用';
  pill.className   = 'wv-status-pill' + (e.enabled !== false ? '' : ' disabled');

  const toggleBtn = document.getElementById('wvToggleBtn');
  toggleBtn.innerHTML = e.enabled !== false
    ? `<svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> 禁用条目`
    : `<svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 启用条目`;
  toggleBtn.className = 'wv-act-apply' + (e.enabled !== false ? '' : ' disabled-state');

  const charIds     = e.chars || [];
  const linkedChars = charIds.map(cid => _chars.find(c => c.id === cid)).filter(Boolean);
  const charsSection = document.getElementById('wvCharsSection');
  const charsRow     = document.getElementById('wvCharsRow');
  if (linkedChars.length === 0) {
    charsSection.style.display = 'none';
  } else {
    charsSection.style.display = '';
    charsRow.innerHTML = linkedChars.map(c => {
      const letter = (c.name || '?')[0].toUpperCase();
      return `<div class="wv-char-chip">
        <div class="wv-char-av">
          ${c.avatar
            ? `<img src="${c.avatar}" alt="${escHtml(c.name)}"/>`
            : `<span>${letter}</span>`}
        </div>
        ${escHtml(c.name || '')}
      </div>`;
    }).join('');
  }

  const kws     = (e.keywords || '').split(',').map(s=>s.trim()).filter(Boolean);
  const kwsSec  = (e.keywordsSec || '').split(',').map(s=>s.trim()).filter(Boolean);
  const kwSection = document.getElementById('wvKwSection');
  const kwRow     = document.getElementById('wvKwRow');
  if (e.mode === 'constant' || (kws.length === 0 && kwsSec.length === 0)) {
    kwSection.style.display = 'none';
  } else {
    kwSection.style.display = '';
    kwRow.innerHTML =
      kws.map(k => `<div class="wv-kw-tag">${escHtml(k)}</div>`).join('') +
      kwsSec.map(k => `<div class="wv-kw-tag secondary">${escHtml(k)}</div>`).join('');
  }

  document.getElementById('wvPage').classList.add('show');
  document.getElementById('wvPage').scrollTop = 0;
}

function posLabel(pos) {
  const map = { before: '对话前', after: '对话后', system: '系统层' };
  return map[pos] || pos || '—';
}

function closeView() {
  document.getElementById('wvPage').classList.remove('show');
  _viewingId = null;
}

/* ================================
   详情页操作
================================ */
async function toggleFromView() {
  const e = _entries.find(x => x.id === _viewingId);
  if (!e) return;
  e.enabled = e.enabled === false ? true : false;
  await saveEntry_db(e);
  await renderList();
  openView(_viewingId);
  showToast(e.enabled ? '条目已启用' : '条目已禁用');
}

function openEditFromView() {
  editEntry(_viewingId);
}

async function duplicateFromView() {
  const e = _entries.find(x => x.id === _viewingId);
  if (!e) return;
  const copy = { ...e };
  delete copy.id;
  copy.title = (copy.title || '未命名') + ' 副本';
  await saveEntry_db(copy);
  await renderList();
  showToast('已创建副本');
}

function openMoreMenu() {
  document.getElementById('wvMenuOverlay').classList.add('show');
  document.getElementById('wvMenu').classList.add('show');
}

function closeMoreMenu() {
  document.getElementById('wvMenuOverlay').classList.remove('show');
  document.getElementById('wvMenu').classList.remove('show');
}

function openDeleteConfirm() {
  document.getElementById('wvConfirmOverlay').classList.add('show');
  document.getElementById('wvConfirm').classList.add('show');
}

function closeDeleteConfirm() {
  document.getElementById('wvConfirmOverlay').classList.remove('show');
  document.getElementById('wvConfirm').classList.remove('show');
}

async function confirmDelete() {
  if (!_viewingId) return;
  const deletedId = _viewingId;
  await deleteEntry_db(deletedId);
  // 条目被删后，把它从所有角色的 worldEntries 里摘除，
  // 否则角色档案那边会残留一个指向已删除条目的死引用
  await syncCharsForEntry(deletedId, []);
  closeDeleteConfirm();
  closeView();
  await renderList();
  showToast('条目已删除');
}

/* ================================
   导入 / 导出 存档
   支持用户自建条目的完整备份与迁移
================================ */
async function exportEntries() {
  const entries = await getAllEntries();
  if (entries.length === 0) {
    showToast('暂无条目可导出');
    return;
  }
  const payload = {
    app: 'LunaWorldBook',
    version: 2,
    exportedAt: new Date().toISOString(),
    entries
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const stamp = new Date().toISOString().slice(0,10);
  a.href = url;
  a.download = `worldbook-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`已导出 ${entries.length} 条条目`);
}

function importEntries(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const list = Array.isArray(data) ? data : (data.entries || []);
      if (!Array.isArray(list) || list.length === 0) {
        showToast('文件中没有可导入的条目');
        return;
      }
      let count = 0;
      for (const item of list) {
        const clean = { ...item };
        delete clean.id; // 避免 id 冲突，作为新条目导入
        if (!clean.title) continue;
        await saveEntry_db(clean);
        count++;
      }
      await renderList();
      showToast(`成功导入 ${count} 条条目`);
    } catch (err) {
      showToast('导入失败，文件格式不正确');
    } finally {
      input.value = '';
    }
  };
  reader.readAsText(file);
}

/* ================================
   使用说明书
   点标签只显示对应分节，其他隐藏——真正切换，不是滚动定位。
   HTML 里第一个标签和第一节已经写死 .active，所以哪怕 JS
   没跑起来，打开时看到的也是"基本概念"这一节，不会空白。
================================ */
function openHelp() {
  document.getElementById('wbHelpOverlay').classList.add('show');
  document.getElementById('wbHelpSheet').classList.add('show');
  const firstTab = document.querySelector('.wb-help-tab');
  if (firstTab) jumpHelpSection(firstTab);
}

function closeHelp() {
  document.getElementById('wbHelpOverlay').classList.remove('show');
  document.getElementById('wbHelpSheet').classList.remove('show');
}

function jumpHelpSection(btn) {
  document.querySelectorAll('.wb-help-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.wb-help-sec').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(btn.dataset.sec);
  if (target) target.classList.add('active');
  const body = document.getElementById('wbHelpBody');
  if (body) body.scrollTop = 0;
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
  renderList();
});