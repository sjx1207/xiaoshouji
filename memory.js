/* ================================================================
   Luna Memory — memory.js
   记忆档案系统核心逻辑（v2 完整版）

   数据库：LunaMemoryDB / store: memories
   字段规范：
     id          string   唯一ID
     charId      string   所属角色ID（对应 LunaCharDB 中 char 的 id）
     charName    string   角色名快照
     scope       string   记忆所属 App 场景：
                          'general'（通用·跨App生效）
                          'chat'   （聊天/短信/电话，共用对话类场景）
                          'forum'  （论坛动态）
                          'diary'  （日记）
                          'photos' （相册）
                          'novel'  （小说/对话小说）
     term        string   'long'（长期，持久沉淀，永不因对话而衰减）
                          'short'（短期，当前阶段的临时状态，仅被新短期记忆覆盖）
     type        string   'core' | 'relation' | 'emotion' | 'event'   二级分类，决定注入优先级
     title       string   记忆标题
     content     string   记忆详情（客观叙述）
     prompt      string   注入指令（可选）
     intensity   number   1-5，强度/重要度
     alwaysOn    bool     是否常驻锚点，最高优先级
     createdAt   number   时间戳
     updatedAt   number   时间戳
================================================================ */

/* ---------------- 返回 Luna Phone 主屏 ---------------- */
function goBackToPhone() {
  const mask = document.createElement('div');
  mask.style.cssText = 'position:fixed;inset:0;background:rgba(250,249,248,0.97);opacity:0;z-index:9999;transition:opacity 0.28s ease;pointer-events:all;';
  document.body.appendChild(mask);
  requestAnimationFrame(() => { mask.style.opacity = '1'; });
  setTimeout(() => { window.location.href = 'index.html'; }, 260);
}

/* ---------------- App 场景元数据（对应 index.html 中真实存在的 app 图标） ---------------- */
const MEM_SCOPES = [
  {
    key: 'general', label: '通用', sub: 'GENERAL',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/></svg>`,
    desc: '跨App生效，任何场景都会参考',
  },
  {
    key: 'chat', label: '聊天/通讯', sub: 'CHAT · SMS · CALL',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    desc: '聊天、短信、电话共用的对话类记忆',
  },
  {
    key: 'forum', label: '论坛动态', sub: 'FORUM',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M17 8H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h1v3l3-3h8a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    desc: '角色在论坛发布过的动态与人设立场',
  },
  {
    key: 'diary', label: '日记', sub: 'DIARY',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="4" y="2" width="13" height="20" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M8 10h6M8 14h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    desc: '角色自己写下的内心独白与心情记录',
  },
  {
    key: 'photos', label: '相册', sub: 'PHOTOS',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" stroke-width="1.6"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="M3 15l5-5 4 4 3-3 6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    desc: '照片背后的场景、情境与拍摄时的状态',
  },
  {
    key: 'novel', label: '小说', sub: 'NOVEL',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    desc: '长篇/对话小说中的剧情记忆，含伏笔与人物关系',
  },
];
function scopeMeta(key) { return MEM_SCOPES.find(s => s.key === key) || MEM_SCOPES[0]; }

/* ---------------- 记忆二级类型（决定优先级排序） ---------------- */
const MEM_TYPES = [
  { key: 'core',     label: '核心设定', sub: 'CORE',     badge: 'badge-core',     desc: '角色背景类记忆，兜底信息' },
  { key: 'relation', label: '关系状态', sub: 'RELATION', badge: 'badge-relation', desc: '决定称呼与亲密阶段' },
  { key: 'emotion',  label: '情绪基调', sub: 'EMOTION',  badge: 'badge-emotion',  desc: '近期情绪，防止跳变' },
  { key: 'event',    label: '事件经历', sub: 'EVENT',    badge: 'badge-event',    desc: '具体发生过的事' },
];
function typeMeta(key) { return MEM_TYPES.find(t => t.key === key) || MEM_TYPES[0]; }

/* ================================================================
   IndexedDB：记忆库
================================================================ */
function openMemDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('LunaMemoryDB', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('memories')) {
        const store = db.createObjectStore('memories', { keyPath: 'id' });
        store.createIndex('charId', 'charId', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e.target.error);
  });
}

async function getAllMemories() {
  try {
    const db = await openMemDB();
    return new Promise((res, rej) => {
      const req = db.transaction('memories', 'readonly').objectStore('memories').getAll();
      req.onsuccess = () => res((req.result || []).map(normalizeMemory));
      req.onerror = () => rej(req.error);
    });
  } catch (e) { console.error('读取记忆库失败', e); return []; }
}

/* 兼容旧数据：老记忆没有 scope/term 字段时，给出合理默认值，避免"消失" */
function normalizeMemory(m) {
  if (!m.scope) m.scope = 'general';
  if (!m.term) m.term = m.alwaysOn ? 'long' : 'short';
  return m;
}

async function putMemory(mem) {
  const db = await openMemDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('memories', 'readwrite');
    tx.objectStore('memories').put(mem);
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  });
}

async function deleteMemoryById(id) {
  const db = await openMemDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('memories', 'readwrite');
    tx.objectStore('memories').delete(id);
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  });
}

/* ================================================================
   IndexedDB：角色库（只读）
================================================================ */
function openCharDBReadonly() {
  return new Promise((res, rej) => {
    const probe = indexedDB.open('LunaCharDB');
    probe.onsuccess = e => res(e.target.result);
    probe.onerror = e => rej(e.target.error);
  });
}
async function getAllCharsReadonly() {
  try {
    const db = await openCharDBReadonly();
    if (!db.objectStoreNames.contains('chars')) return [];
    return new Promise(res => {
      const req = db.transaction('chars', 'readonly').objectStore('chars').getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    });
  } catch (e) { return []; }
}

/* ================================================================
   全局状态
================================================================ */
let _allChars = [];
let _allMems  = [];
let _currentCharId = null;   // 当前进入详情页查看的角色
let _activeTerm  = 'all';    // 'all' | 'long' | 'short'
let _activeScope = 'all';    // 'all' | general/chat/forum/diary/photos/novel
let _editingId = null;
let _editingType = 'core';
let _editingScope = 'general';
let _editingTerm = 'long';
let _editingIntensity = 3;
let _editingAlwaysOn = false;

/* ================================================================
   初始化
================================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  updateStatusTime();
  setInterval(updateStatusTime, 1000);

  _allChars = await getAllCharsReadonly();
  _allMems  = await getAllMemories();

  buildScopeGridInEditor();
  buildTypeGrid();
  buildIntensityPicker();
  renderScopeRow();

  renderHome();

  // 支持外部（如角色档案页）通过 ?char=xxx 直接跳转进入某角色的记忆详情页
  const params = new URLSearchParams(window.location.search);
  const jumpChar = params.get('char');
  if (jumpChar && _allChars.some(c => charKeyOf(c) === jumpChar)) {
    openCharDetail(jumpChar, true);
  }
});

function updateStatusTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const now = new Date();
  const s = now.toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  document.querySelectorAll('.status-time').forEach(el => el.textContent = s);
}

/* ---------------- 工具 ---------------- */
function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function charKeyOf(c) { return String(c.id); }
function charDisplayName(charId) {
  const c = _allChars.find(x => charKeyOf(x) === String(charId));
  return c ? (c.name || '未命名角色') : '未知角色';
}
function charDisplayRole(charId) {
  const c = _allChars.find(x => charKeyOf(x) === String(charId));
  return c ? (c.role || '') : '';
}
function timeAgoLabel(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const day = 86400000;
  if (diff < 3600000) return '刚刚';
  if (diff < day) return Math.floor(diff/3600000) + '小时前';
  if (diff < day*30) return Math.floor(diff/day) + '天前';
  return new Date(ts).toLocaleDateString('zh-CN', { month:'2-digit', day:'2-digit' });
}
function memsOfChar(charId) {
  return _allMems.filter(m => String(m.charId) === String(charId));
}

/* ================================================================
   首页：角色卡片网格
================================================================ */
function renderHome() {
  renderOverview();
  renderCharGrid();
}

function renderOverview() {
  document.getElementById('ovCharCount').textContent = _allChars.length;
  document.getElementById('ovMemCount').textContent = _allMems.length;
  document.getElementById('ovLongCount').textContent = _allMems.filter(m => m.term === 'long').length;
  document.getElementById('ovAlwaysCount').textContent = _allMems.filter(m => m.alwaysOn).length;
}

function renderCharGrid() {
  const grid = document.getElementById('charGrid');

  if (_allChars.length === 0) {
    grid.innerHTML = `
      <div class="mem-empty">
        <div class="mem-empty-ring">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="#8a8a90" stroke-width="1.4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#8a8a90" stroke-width="1.4" stroke-linecap="round"/></svg>
        </div>
        <div class="mem-empty-title">还没有角色</div>
        <div class="mem-empty-desc">请先前往「角色档案」创建一个 AI 角色，再回来为TA建立记忆</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = _allChars.map((c, idx) => {
    const key = charKeyOf(c);
    const mems = memsOfChar(key);
    const longCount = mems.filter(m => m.term === 'long').length;
    const shortCount = mems.filter(m => m.term === 'short').length;
    const alwaysCount = mems.filter(m => m.alwaysOn).length;
    const fileNo = String(idx + 1).padStart(3, '0');

    return `
      <div class="mem-char-card" onclick="openCharDetail('${key}')">
        <div class="mem-char-card-fileno">FILE · ${fileNo}</div>
        <div class="mem-char-card-avatar">${escHtml((c.name||'?')[0])}</div>
        <div class="mem-char-card-name">${escHtml(c.name || '未命名')}</div>
        <div class="mem-char-card-role">${escHtml(c.role || '暂无角色定位')}</div>
        <div class="mem-char-card-stats">
          <span class="mem-char-stat-chip"><span class="chip-dot" style="background:var(--mem-long);"></span>长期 ${longCount}</span>
          <span class="mem-char-stat-chip"><span class="chip-dot" style="background:var(--mem-short);"></span>短期 ${shortCount}</span>
          ${alwaysCount ? `<span class="mem-char-stat-chip"><span class="chip-dot" style="background:var(--mem-gold);"></span>锚点 ${alwaysCount}</span>` : ''}
        </div>
        <div class="mem-char-card-arrow">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#4a4a50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
      </div>
    `;
  }).join('');
}

function quickCreateGuard() {
  if (_allChars.length === 0) {
    showToast('请先在「角色档案」创建一个角色');
    return;
  }
  openEditor(null);
}

/* ================================================================
   视图切换：首页 <-> 详情页
================================================================ */
function openCharDetail(charId, skipAnim) {
  _currentCharId = charId;
  _activeTerm = 'all';
  _activeScope = 'all';

  document.getElementById('detailCharName').textContent = charDisplayName(charId);
  const role = charDisplayRole(charId);
  document.getElementById('detailEyebrow').textContent = role ? role : 'Character Memory';

  renderDetailHero();
  renderTermSwitch();
  renderScopeRow();
  renderMemList();

  const home = document.getElementById('viewHome');
  const detail = document.getElementById('viewDetail');
  if (skipAnim) {
    home.classList.add('pushed');
    detail.classList.add('show');
  } else {
    home.classList.add('pushed');
    requestAnimationFrame(() => detail.classList.add('show'));
  }
}

function backToHome() {
  document.getElementById('viewDetail').classList.remove('show');
  document.getElementById('viewHome').classList.remove('pushed');
  _currentCharId = null;
  renderHome();
}

function renderDetailHero() {
  const c = _allChars.find(x => charKeyOf(x) === String(_currentCharId));
  const mems = memsOfChar(_currentCharId);
  const hero = document.getElementById('memDetailHero');
  hero.innerHTML = `
    <div class="mem-detail-hero-avatar">${escHtml(((c&&c.name)||'?')[0])}</div>
    <div class="mem-detail-hero-info">
      <div class="mem-detail-hero-name">${escHtml((c&&c.name)||'未命名角色')}</div>
      <div class="mem-detail-hero-desc">${escHtml((c&&c.desc)||'暂无简介')}</div>
    </div>
    <div class="mem-detail-hero-count">
      <div class="mem-detail-hero-count-num">${mems.length}</div>
      <div class="mem-detail-hero-count-label">MEMORIES</div>
    </div>
  `;
}

/* ================================================================
   长期/短期 切换
================================================================ */
function renderTermSwitch() {
  document.querySelectorAll('.mem-term-opt').forEach(el => {
    el.classList.toggle('active', el.dataset.term === _activeTerm);
  });
}
function selectTerm(term) {
  _activeTerm = term;
  renderTermSwitch();
  renderMemList();
}

/* ================================================================
   App 场景筛选条（详情页内）
================================================================ */
function renderScopeRow() {
  const row = document.getElementById('memScopeRow');
  if (!row) return;
  const tabs = [{ key:'all', label:'全部场景', icon:'', desc:'' }, ...MEM_SCOPES];
  row.innerHTML = tabs.map(s => `
    <div class="mem-scope-tab ${_activeScope===s.key?'active':''}" onclick="selectScope('${s.key}')">
      ${s.icon || ''}${escHtml(s.label)}
    </div>
  `).join('');
}
function selectScope(key) {
  _activeScope = key;
  renderScopeRow();
  renderMemList();
}

/* ================================================================
   记忆列表渲染（详情页）
================================================================ */
function renderMemList() {
  const scroll = document.getElementById('memScroll');
  if (!scroll) return;

  let mems = memsOfChar(_currentCharId);

  if (_activeTerm !== 'all') mems = mems.filter(m => m.term === _activeTerm);
  if (_activeScope !== 'all') mems = mems.filter(m => m.scope === _activeScope);

  if (mems.length === 0) {
    scroll.innerHTML = `
      <div class="mem-empty">
        <div class="mem-empty-ring">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 3a9 9 0 100 18 9 9 0 000-18z" stroke="#8a8a90" stroke-width="1.3"/><path d="M12 7v5l3 3" stroke="#8a8a90" stroke-width="1.3" stroke-linecap="round"/></svg>
        </div>
        <div class="mem-empty-title">这里还没有记忆</div>
        <div class="mem-empty-desc">为TA写下第一段记忆，让回应更贴近你们的关系与故事，不再"失忆"</div>
      </div>
    `;
    return;
  }

  const pinned = mems.filter(m => m.alwaysOn).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const rest   = mems.filter(m => !m.alwaysOn);

  let html = '';

  if (pinned.length) {
    html += groupTitle('常驻锚点 · 最高优先级', 'badge-alwaysOn');
    html += pinned.map(renderCard).join('');
  }

  // 其余按 type 分组展示，组内按强度+时间排序
  MEM_TYPES.forEach(t => {
    const group = rest.filter(m => (m.type||'core') === t.key)
      .sort((a,b)=>(b.intensity||0)-(a.intensity||0) || (b.createdAt||0)-(a.createdAt||0));
    if (!group.length) return;
    html += groupTitle(t.label, t.badge);
    html += group.map(renderCard).join('');
  });

  scroll.innerHTML = html || `<div class="mem-empty"><div class="mem-empty-title">没有匹配的记忆</div></div>`;
}

function groupTitle(text, badgeClass) {
  return `
    <div class="mem-group-title">
      <span class="mem-group-title-text"><span class="mem-group-badge ${badgeClass}"></span>${text}</span>
      <div class="line"></div>
    </div>
  `;
}

function renderCard(m) {
  const meta = typeMeta(m.type || 'core');
  const scMeta = scopeMeta(m.scope || 'general');
  const intensity = m.intensity || 3;
  const dots = Array.from({length:5}, (_,i) => `<span class="mem-intensity-dot ${i<intensity?'on':''}"></span>`).join('');

  return `
    <div class="mem-card ${m.alwaysOn?'pinned':''}" onclick="openEditor('${m.id}')">
      <div class="mem-card-top">
        <div class="mem-card-title-wrap">
          ${m.alwaysOn ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5L12 2z" fill="#131315"/></svg>` : ''}
          <span class="mem-card-title">${escHtml(m.title || '未命名记忆')}</span>
        </div>
        <div class="mem-card-tags">
          <span class="mem-card-term-tag term-${m.term}">${m.term==='long'?'长期':'短期'}</span>
          <span class="mem-card-type-tag">${meta.sub}</span>
        </div>
      </div>
      <div class="mem-card-content">${escHtml(m.content || m.prompt || '')}</div>
      <div class="mem-card-bottom">
        <div class="mem-intensity">${dots}</div>
        <span class="mem-card-time"><span class="mem-card-scope-label">${escHtml(scMeta.label)}</span> · ${timeAgoLabel(m.createdAt)}</span>
      </div>
    </div>
  `;
}

/* ================================================================
   编辑面板
================================================================ */
function buildScopeGridInEditor() {
  const grid = document.getElementById('fScopeGrid');
  grid.innerHTML = MEM_SCOPES.map(s => `
    <div class="mem-scope-opt" data-scope="${s.key}" onclick="pickScope('${s.key}')">
      ${s.icon}
      <div class="mem-scope-opt-label">${s.label}</div>
    </div>
  `).join('');
}
function pickScope(key) {
  _editingScope = key;
  document.querySelectorAll('.mem-scope-opt').forEach(el => {
    el.classList.toggle('active', el.dataset.scope === key);
  });
}
function pickTerm(term) {
  _editingTerm = term;
  document.querySelectorAll('.mem-term-picker-opt').forEach(el => {
    el.classList.toggle('active', el.dataset.term === term);
  });
}

function buildTypeGrid() {
  const grid = document.getElementById('fTypeGrid');
  grid.innerHTML = MEM_TYPES.map(t => `
    <div class="mem-type-opt" data-type="${t.key}" onclick="pickType('${t.key}')">
      <div class="mem-type-opt-sub">${t.sub}</div>
      <div class="mem-type-opt-label">${t.label}</div>
    </div>
  `).join('');
}
function pickType(key) {
  _editingType = key;
  document.querySelectorAll('.mem-type-opt').forEach(el => {
    el.classList.toggle('active', el.dataset.type === key);
  });
}

function buildIntensityPicker() {
  const picker = document.getElementById('fIntensityPicker');
  picker.innerHTML = [1,2,3,4,5].map(n => `
    <div class="mem-intensity-opt" data-val="${n}" onclick="pickIntensity(${n})">${n}</div>
  `).join('');
}
function pickIntensity(n) {
  _editingIntensity = n;
  document.querySelectorAll('.mem-intensity-opt').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.val) === n);
  });
}

function toggleAlwaysOn() {
  _editingAlwaysOn = !_editingAlwaysOn;
  document.getElementById('fAlwaysSwitch').classList.toggle('on', _editingAlwaysOn);
  // 常驻锚点在语义上等同于长期记忆，勾选时自动同步时效为"长期"，避免逻辑冲突
  if (_editingAlwaysOn) pickTerm('long');
}

function populateCharSelect(selectedKey) {
  const sel = document.getElementById('fCharSelect');
  if (_allChars.length === 0) {
    sel.innerHTML = `<option value="">请先创建角色</option>`;
    return;
  }
  sel.innerHTML = _allChars.map(c => {
    const key = charKeyOf(c);
    return `<option value="${key}" ${key===String(selectedKey)?'selected':''}>${escHtml(c.name||'未命名')}</option>`;
  }).join('');
}

function openEditor(id) {
  _editingId = id;
  const isNew = !id;
  const mem = isNew ? null : _allMems.find(m => m.id === id);

  document.getElementById('editorHeadTitle').textContent = isNew ? '新建记忆' : '编辑记忆';
  document.getElementById('editorDeleteBtn').style.display = isNew ? 'none' : 'flex';

  const defaultCharKey = _currentCharId || (_allChars[0] ? charKeyOf(_allChars[0]) : '');
  populateCharSelect(mem ? mem.charId : defaultCharKey);

  document.getElementById('fTitle').value = mem ? (mem.title || '') : '';
  document.getElementById('fContent').value = mem ? (mem.content || '') : '';
  document.getElementById('fPrompt').value = mem ? (mem.prompt || '') : '';

  _editingType = mem ? (mem.type || 'core') : 'core';
  _editingScope = mem ? (mem.scope || 'general') : (_activeScope !== 'all' ? _activeScope : 'general');
  _editingTerm = mem ? (mem.term || 'long') : 'long';
  _editingIntensity = mem ? (mem.intensity || 3) : 3;
  _editingAlwaysOn = mem ? !!mem.alwaysOn : false;

  pickType(_editingType);
  pickScope(_editingScope);
  pickTerm(_editingTerm);
  pickIntensity(_editingIntensity);
  document.getElementById('fAlwaysSwitch').classList.toggle('on', _editingAlwaysOn);

  document.getElementById('editorPanel').classList.add('show');
}

function closeEditor() {
  document.getElementById('editorPanel').classList.remove('show');
  _editingId = null;
}

async function saveMemory() {
  const charId = document.getElementById('fCharSelect').value;
  const title = document.getElementById('fTitle').value.trim();
  const content = document.getElementById('fContent').value.trim();
  const prompt = document.getElementById('fPrompt').value.trim();

  if (!charId) { showToast('请先在「角色档案」创建一个角色'); return; }
  if (!title) { showToast('请填写记忆标题'); return; }
  if (!content && !prompt) { showToast('记忆详情或注入指令至少填写一项'); return; }

  const mem = {
    id: _editingId || ('mem_' + Date.now() + '_' + Math.random().toString(36).slice(2,8)),
    charId: charId,
    charName: charDisplayName(charId),
    scope: _editingScope,
    term: _editingAlwaysOn ? 'long' : _editingTerm,
    type: _editingType,
    title, content, prompt,
    intensity: _editingIntensity,
    alwaysOn: _editingAlwaysOn,
    createdAt: (_editingId && _allMems.find(m=>m.id===_editingId)?.createdAt) || Date.now(),
    updatedAt: Date.now(),
  };

  await putMemory(mem);
  _allMems = await getAllMemories();

  if (_currentCharId) {
    renderDetailHero();
    renderMemList();
  }
  renderHome();
  closeEditor();
  showToast(_editingId ? '记忆已更新' : '记忆已保存');
  notifyMemoryUpdate();
}

async function deleteMemory() {
  if (!_editingId) return;
  await deleteMemoryById(_editingId);
  _allMems = await getAllMemories();

  if (_currentCharId) {
    renderDetailHero();
    renderMemList();
  }
  renderHome();
  closeEditor();
  showToast('记忆已删除');
  notifyMemoryUpdate();
}

function notifyMemoryUpdate() {
  localStorage.setItem('luna_memory_db_update', Date.now());
}

/* ================================================================
   Toast
================================================================ */
let _toastTimer = null;
function showToast(text) {
  const t = document.getElementById('memToast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

/* ================================================================
   注入预览面板
   —— 与 characters.js 的 buildMemoryPromptStandalone 完全对齐，
      并新增：长期/短期分区 + 按当前详情页选中场景过滤展示
================================================================ */
function memTypeLabel(type) {
  return { core: '核心记忆', relation: '关系', emotion: '情绪', event: '事件' }[type] || '记忆';
}

function buildMemoryPromptPreview(charId) {
  const mems = memsOfChar(charId);
  if (!mems.length) return '（该角色暂无记忆，AI 将仅依据角色档案本身的人设进行扮演）';

  const alwaysOn = mems.filter(m => m.alwaysOn);
  const longTerm = mems.filter(m => !m.alwaysOn && m.term === 'long');
  const shortTerm = mems.filter(m => m.term === 'short');

  const byType = (arr, t) => arr
    .filter(m => (m.type || 'core') === t)
    .sort((a, b) => (b.intensity || 0) - (a.intensity || 0));

  const relationMems = byType(shortTerm.concat(longTerm), 'relation').slice(0, 3);
  const emotionMems  = byType(shortTerm, 'emotion').slice(0, 3);
  const eventMems    = byType(longTerm, 'event').concat(byType(longTerm, 'core')).slice(0, 5);

  const lines = [`[记忆档案注入 · ${charDisplayName(charId)}]`];

  if (alwaysOn.length) {
    lines.push('\n【核心常驻记忆 · 每次对话必定生效，具有最高优先级，永不因对话轮次遗忘】');
    alwaysOn.slice(0, 6).forEach(m => {
      lines.push(`- ${m.title}（${memTypeLabel(m.type)} · ${scopeMeta(m.scope).label}）`);
      if (m.prompt) lines.push(`  → ${m.prompt}`);
      else if (m.content) lines.push(`  → ${m.content.slice(0, 120)}`);
    });
  }
  if (relationMems.length) {
    lines.push('\n【当前关系状态 · 请据此判断称呼与亲密程度，不要回退到更早的关系阶段】');
    relationMems.forEach(m => lines.push(`- ${m.title}：${(m.prompt || m.content || '').slice(0, 90)}`));
  }
  if (emotionMems.length) {
    lines.push('\n【近期情绪基调（短期） · 情绪表达应与此保持连贯，不要无故跳变】');
    emotionMems.forEach(m => lines.push(`- ${m.title}（强度${m.intensity || 3}/5）：${(m.prompt || m.content || '').slice(0, 70)}`));
  }
  if (eventMems.length) {
    lines.push('\n【长期背景记忆 · 可作为细节引用，非必须逐条复述】');
    eventMems.forEach(m => lines.push(`- ${m.title}（${scopeMeta(m.scope).label}）：${(m.prompt || m.content || '').slice(0, 70)}`));
  }

  lines.push('\n【格式与人设锚点 · 无论对话进行多久、切换到哪个App都必须遵守】');
  lines.push('- 全程保持第一人称的角色身份，不得以"AI助手""语言模型"等身份自称或跳出角色解释');
  lines.push('- 以上记忆是角色本身已知的过去，不是外部资料，回应时应像自然想起，而非罗列信息');
  lines.push('- 若记忆与用户当前所说内容冲突，以维持角色人设一致性为优先，不随意"失忆"或人设漂移');
  lines.push('- 短期记忆代表当前阶段状态，仅在产生新的短期记忆时才更新，绝不无故消失');

  return lines.join('\n');
}

function openPreview() {
  const panel = document.getElementById('previewPanel');
  const textEl = document.getElementById('previewText');

  if (!_currentCharId) {
    textEl.textContent = '请先从首页进入某个角色的记忆详情页，再查看注入预览。';
  } else {
    textEl.textContent = buildMemoryPromptPreview(_currentCharId);
  }

  panel.classList.add('show');
}
function closePreview() {
  document.getElementById('previewPanel').classList.remove('show');
}

/* ================================================================
   供外部调用：从角色档案页跳转到该角色的记忆详情页
   用法（在 characters.js 里）：window.location.href = 'memory.html?char=' + charId;
================================================================ */
function goToCharMemory(charId) {
  window.location.href = 'memory.html?char=' + encodeURIComponent(charId);
}

/* ================================================================
   跨页同步：角色库变更时刷新
================================================================ */
window.addEventListener('storage', async (e) => {
  if (e.key === 'luna_char_db_update' || e.key === 'luna_characters_updated') {
    _allChars = await getAllCharsReadonly();
    if (_currentCharId) {
      renderDetailHero();
    } else {
      renderCharGrid();
    }
  }
});
/* ================================================================
   状态栏：电量（与 index.html script.js 保持一致逻辑）
================================================================ */
function updateMemBattery() {
  function render(pct) {
    const p = Math.round(pct);
    const grad = p <= 20
      ? 'linear-gradient(90deg, #f87171, #ef4444)'
      : 'linear-gradient(90deg, #6ee7b7, #34d399)';
    document.querySelectorAll('.bat-pct').forEach(el => el.textContent = p);
    document.querySelectorAll('.bat-inner').forEach(el => { el.style.width = p + '%'; el.style.background = grad; });
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
updateMemBattery();