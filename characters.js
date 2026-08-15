/* ================================
   角色档案 — characters.js
   状态栏 / 灵动岛 完整同步 index
================================ */

/* ---- 返回首页 ---- */
function goBack() {
  const mask = document.createElement('div');
  mask.style.cssText = 'position:fixed;inset:0;background:rgba(238,234,227,0.97);opacity:0;z-index:9999;transition:opacity 0.28s ease;pointer-events:all;';
  document.body.appendChild(mask);
  requestAnimationFrame(() => { mask.style.opacity = '1'; });
  setTimeout(() => { window.location.href = 'index.html'; }, 260);
}

/* ================================
   状态栏时间 — 同步 index 逻辑
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
   电量 — 同步 index 逻辑
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
   灵动岛 — 完整同步 index 逻辑
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
  if (e.key === 'luna_font_update')   applyGlobalFont();  // ← 加这行
});

/* ================================
   Tab 切换（仅视觉）
================================ */
function switchTab(el) {
  document.querySelectorAll('.ch-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

/* ================================
   颜色方案
================================ */
const COLOR_MAP = {
  ink:    { strip: 'linear-gradient(180deg,#3a3a40,#16161a)', topC1:'#ececed', topC2:'#dcdcdf', avBg:'#101012', avCol:'#c9c9cd' },
  slate:  { strip: 'linear-gradient(180deg,#7a7a82,#54545c)', topC1:'#eef0f1', topC2:'#dfe1e3', avBg:'#141416', avCol:'#b8bac0' },
  silver: { strip: 'linear-gradient(180deg,#b8b8bc,#8c8c92)', topC1:'#f2f2f2', topC2:'#e4e4e4', avBg:'#1a1a1c', avCol:'#d4d4d8' },
  frost:  { strip: 'linear-gradient(180deg,#c4c8cc,#9aa0a6)', topC1:'#eef1f3', topC2:'#dfe4e7', avBg:'#111316', avCol:'#c8ccd0' },
  smoke:  { strip: 'linear-gradient(180deg,#6a6a70,#3c3c42)', topC1:'#e9e9ea', topC2:'#dadada', avBg:'#0e0e10', avCol:'#bdbdc2' },
  pearl:  { strip: 'linear-gradient(180deg,#d6d6d8,#adadb2)', topC1:'#f5f5f5', topC2:'#e8e8e8', avBg:'#1c1c1e', avCol:'#e0e0e3' },
};

/* ================================
   IndexedDB — 完全自治，自己建库建 store
   策略：先不带版本号探测当前版本，
         再以 当前版本+1 重新打开并在
         onupgradeneeded 里补建缺失的 store，
         从而既兼容主应用已有数据，又保证
         chars / fonts 两个 store 一定存在。
================================ */
let _db = null;

function openCharDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((res, rej) => {
    /* 第一步：不带版本号探测，拿到当前真实版本 */
    const probe = indexedDB.open('LunaCharDB');
    probe.onsuccess = e => {
      const cur = e.target.result;
      const ver = cur.version;
      const hasChars = cur.objectStoreNames.contains('chars');
      cur.close();

      if (hasChars) {
        /* store 已存在 → 直接按当前版本重新打开（不触发 upgrade） */
        const req2 = indexedDB.open('LunaCharDB', ver);
        req2.onsuccess = e2 => { _db = e2.target.result; res(_db); };
        req2.onerror   = e2 => rej(e2.target.error);
        req2.onupgradeneeded = () => {}; // 防御性空处理
      } else {
        /* store 不存在 → 以 ver+1 打开，在 upgrade 里创建 */
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
    /* probe 本身触发 upgrade 说明是全新 DB，顺手建 store */
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

async function saveChar(data) {
  const db = await openCharDB().catch(err => { console.error('CharDB打开失败:', err); return null; });
  if (!db) return null;
  return new Promise(res => {
    const tx    = db.transaction('chars', 'readwrite');
    const store = tx.objectStore('chars');
    const req   = data.id ? store.put(data) : store.add(data);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => res(null);
  });
}

/* ================================
   世界书读写 — 与 worldbook.js 共用同一个
   IndexedDB「LunaWorldBookDB / entries」store，
   确保角色档案与世界书两端读到的是同一份数据，
   而不是各自维护一份互不相干的副本。
================================ */
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
    req.onerror   = () => rej('WB DB Error');
  });
}

async function getAllWbEntries() {
  try {
    const db = await openWbDB();
    return new Promise(res => {
      const req = db.transaction('entries', 'readonly').objectStore('entries').getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror   = () => res([]);
    });
  } catch (e) { return []; }
}

async function saveWbEntry_db(entry) {
  const db = await openWbDB();
  return new Promise(res => {
    const tx    = db.transaction('entries', 'readwrite');
    const store = tx.objectStore('entries');
    const req   = store.put(entry);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => res(null);
  });
}

/* 双向同步核心：
   角色保存时选中的世界书条目 = charId 必须出现在
   entry.chars 里；未选中的条目里若之前含有该 charId
   则要摘除。这样无论用户是在「角色档案」还是「世界书」
   哪一侧做的勾选，两边看到的关联关系永远一致。 */
async function syncWorldEntriesForChar(charId, selectedEntryIds) {
  if (charId == null) return; // 新建角色首次保存前没有 id，等下一次编辑再同步
  const allEntries = await getAllWbEntries();
  const selectedSet = new Set(selectedEntryIds || []);
  const writes = [];

  allEntries.forEach(entry => {
    const chars = Array.isArray(entry.chars) ? entry.chars.slice() : [];
    const has   = chars.includes(charId);
    const should = selectedSet.has(entry.id);
    if (should && !has) {
      chars.push(charId);
      writes.push(saveWbEntry_db({ ...entry, chars }));
    } else if (!should && has) {
      writes.push(saveWbEntry_db({ ...entry, chars: chars.filter(id => id !== charId) }));
    }
  });

  if (writes.length) await Promise.all(writes);
  /* 通知世界书页（若在其他标签页打开）刷新关联展示 */
  localStorage.setItem('luna_worldbook_db_update', Date.now());
}

/* ================================
   渲染列表
================================ */
let _chars   = [];
let _activeId = null;

async function renderList() {
  _chars    = await getAllChars();
  const list = document.getElementById('chList');
  _activeId = parseInt(localStorage.getItem('luna_active_char')) || null;

  if (_chars.length === 0) {
    list.innerHTML = `
      <div class="ch-empty">
        <div class="ch-empty-icon">
          <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
            <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="1.5" opacity="0.3"/>
            <circle cx="18" cy="20" r="3" fill="currentColor" opacity="0.4"/>
            <circle cx="30" cy="20" r="3" fill="currentColor" opacity="0.4"/>
            <path d="M16 30c2-3 6-5 8-5s6 2 8 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
            <path d="M24 4v4M24 40v4M4 24h4M40 24h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.2"/>
          </svg>
        </div>
        <div class="ch-empty-title">还没有角色</div>
        <div class="ch-empty-desc">点击右上角 <strong>+</strong> 创建你的第一个 AI 角色</div>
        <button class="ch-empty-btn" onclick="openNewCard()">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          立即创建
        </button>
      </div>`;
    return;
  }
  list.innerHTML = '';
  _chars.forEach((c, i) => {
    const card = buildCard(c, i + 1);
    card.style.animation = `fadeUp 0.5s ease both ${0.05 + i * 0.1}s`;
    list.appendChild(card);
  });
  list.appendChild(Object.assign(document.createElement('div'), { style: 'height:40px' }));

  const countEl = document.getElementById('statCount');
  if (countEl) countEl.textContent = String(_chars.length).padStart(2, '0');
}

function buildCard(c, idx) {
  const col      = COLOR_MAP[c.color] || COLOR_MAP.ink;
  const isActive = c.id === _activeId;
  const letter   = (c.name || '?')[0].toUpperCase();
  const idxStr   = String(idx).padStart(2, '0');
  const promptPrev = (c.prompt || '').slice(0, 28) + (c.prompt && c.prompt.length > 28 ? '...' : '');

  const div = document.createElement('div');
  div.className  = 'ch-card' + (isActive ? ' ch-card-active' : '');
  div.onclick = () => toggleCard(div);
  div.dataset.id = c.id;
  div.innerHTML = `
  <div class="ch-card-banner" style="
  --card-c1:${col.topC1};--card-c2:${col.topC2};
  ${c.cardBg ? `background-image:url(${c.cardBg});background-size:cover;background-position:center;` : ''}
">
    <div class="ch-card-banner-deco"></div>
    <div class="ch-card-banner-deco2"></div>
    <div class="ch-card-banner-status">
      <div class="ch-status-pill${isActive ? ' active' : ''}">${isActive ? '激活中' : '待机'}</div>
    </div>
  </div>
  <div class="ch-card-peek">
    <div class="ch-card-peek-avatar">
      <div class="ch-avatar" style="--av-bg:${col.avBg};--av-col:${col.avCol}">
        ${c.avatar
          ? `<img src="${c.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:11px;" />`
          : `<span class="ch-av-letter">${letter}</span>`
        }
      </div>
    </div>
    <div class="ch-card-peek-info">
      <div class="ch-card-peek-name">${escHtml(c.name || '')}</div>
      <div class="ch-card-peek-role">${escHtml(c.role || '')}</div>
    </div>
    <div class="ch-card-peek-arrow">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none">
        <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  </div>
  <div class="ch-card-expand">
    <div class="ch-card-body">
      <div class="ch-card-divider"></div>
      <div class="ch-trait-row">
        ${(c.traits || []).map(t => `<span class="ch-trait">${escHtml(t)}</span>`).join('')}
      </div>
      <div class="ch-card-desc">${escHtml((c.desc || '').slice(0, 60))}${c.desc && c.desc.length > 60 ? '...' : ''}</div>
      <div class="ch-prompt-box">
        <span class="ch-prompt-tag">PROMPT</span>
        <span class="ch-prompt-snippet">${escHtml(promptPrev || '（未设置提示词）')}</span>
      </div>
    </div>
    <div class="ch-card-actions">
      <button class="ch-btn-edit" onclick="event.stopPropagation();openView(${c.id})">查看</button>
      <button class="ch-btn-export" onclick="event.stopPropagation();exportSingleChar(${c.id})" title="导出此角色">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none">
          <path d="M12 15V3M12 15l-3.5-3.5M12 15l3.5-3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <button class="ch-btn-apply${isActive ? ' applied' : ''}" onclick="event.stopPropagation();applyCard(${c.id})">
        ${isActive ? '✓ 已应用' : '应用'}
      </button>
    </div>
  </div>`;
  return div;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* 从角色详情页跳转到世界书对应条目 */
function goToWorldbookEntry(entryId) {
  window.location.href = `worldbook.html?entry=${entryId}`;
}

/* ================================
   世界书内容注入
   应用角色时，把与该角色关联的「常驻」世界书条目
   （以及未关联任何角色、对全体角色生效的全局常驻条目）
   拼接进最终 prompt。关键词触发型条目依赖对话上下文扫描，
   不在这里做静态注入，交由对话引擎在运行时按关键词命中处理；
   这里只保证"角色档案页看到关联了什么，应用后 AI 就真的拿到什么"。
================================ */
async function buildWorldbookPromptForChar(charId) {
  const allEntries = await getAllWbEntries();
  const relevant = allEntries.filter(e => {
    if (e.enabled === false) return false;
    if (e.mode !== 'constant') return false; // 关键词触发条目交给对话引擎按需注入
    const chars = Array.isArray(e.chars) ? e.chars : [];
    // 未关联任何角色 = 全局常驻，对所有角色生效；否则必须显式关联到当前角色
    return chars.length === 0 || chars.includes(charId);
  });
  if (!relevant.length) return '';

  relevant.sort((a, b) => (b.priority ?? 5) - (a.priority ?? 5));

  let block = `【世界设定 —— 来自关联世界书，请作为背景真实世界规则遵守】\n`;
  relevant.forEach(e => {
    block += `◆ ${e.title || '未命名'}`;
    if (e.sub) block += `（${e.sub}）`;
    block += `\n${e.detail || ''}\n\n`;
  });
  return block.trim();
}

/* ================================
   应用角色
================================ */
async function applyCard(id) {
  const c = _chars.find(x => x.id === id);
  if (!c) return;
  localStorage.setItem('luna_active_char', id);
  localStorage.setItem('luna_char_name',   c.name   || '');

  /* ── 拼接记忆档案：从 LunaMemoryDB 读取该角色的记忆，
     注入到人设 prompt 之后，让 AI 同时拿到"设定"与"记忆" ── */
  const charKey     = c.id != null ? c.id : c.name;
  const memoryPrompt = await buildMemoryPromptStandalone(charKey);
  const worldPrompt  = await buildWorldbookPromptForChar(c.id);

  let fullPrompt = c.prompt || '';
  if (worldPrompt)  fullPrompt += `\n\n${worldPrompt}`;
  if (memoryPrompt) fullPrompt += `\n\n${memoryPrompt}`;

  localStorage.setItem('luna_char_prompt', fullPrompt);
  _activeId = id;
  /* 通知 album 页刷新 char folder */
  localStorage.setItem('luna_char_db_update', Date.now());

  document.querySelectorAll('.ch-card').forEach(card => {
    const cid    = parseInt(card.dataset.id);
    const btn    = card.querySelector('.ch-btn-apply');
    const status = card.querySelector('.ch-status-pill');
    if (!btn) return;

    if (cid === id) {
      btn.textContent = '已应用';
      btn.classList.add('applied');
      card.classList.add('ch-card-active');
      if (status) { status.textContent = '激活中'; status.classList.add('active'); }
    } else {
      btn.textContent = '应用';
      btn.classList.remove('applied');
      card.classList.remove('ch-card-active');
      if (status) { status.textContent = '待机'; status.classList.remove('active'); }
    }
  });
}

/* ================================
   弹窗 — 新建 / 编辑
================================ */
let _editingId = null;

function openNewCard() {
  _editingId = null;
  _formAvatarData = null;
  _formBgData = null;
  _formGender = '女';
  _formColor = 'ink';
  _pillState = { langSelect: '中文', povSelect: '第一人称', lengthSelect: '适中', actionSelect: '星号' };
  _switchState = { swNoBreak: true, swNoRepeat: true, swNoDisclaimer: true };
  _dialogExampleCount = 0;
  _selWbEntries = [];
  buildWbPicker();

  document.getElementById('chModalTitle').textContent = '新建角色';
  ['formName','formRole','formDesc','formTraits','formPrompt','formAge','formBirthday',
   'formSpecies','formAppearance','formOutfit','formFears','formSpeechStyle','formCatchphrases',
   'formBackstory','formScenario','formRelation','formCallUser','formRelationDetail',
   'formFirstMes','formBoundaries'
  ].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  document.getElementById('previewName').textContent = '角色名称';
  document.getElementById('previewMeta').textContent = '定位 · 性别 · 年龄';
  setAvatarPreview(null);
  document.getElementById('previewBg').style.backgroundImage = '';
  document.getElementById('descCount').textContent = '0';
  document.querySelectorAll('.ch-gender-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  document.querySelectorAll('.ch-color-opt').forEach((o, i) => o.classList.toggle('selected', i === 0));

  clearDynList('likesList');
  clearDynList('dislikesList');
  clearDynList('neverList');
  document.getElementById('dialogExamples').innerHTML = '';

  ['langSelect','povSelect','lengthSelect','actionSelect'].forEach(gid => {
    const group = document.getElementById(gid);
    if (!group) return;
    group.querySelectorAll('.ch-pill-opt').forEach((p, i) => p.classList.toggle('active', p.dataset.val === _pillState[gid]));
  });
  ['swNoBreak','swNoRepeat','swNoDisclaimer'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('on');
  });

  // 只展开第一个分组
  document.querySelectorAll('.ch-form-section').forEach((s, i) => s.classList.toggle('open', i === 0));

  updateCompleteness();
  showModal();
}

async function editCard(id) {
  const c = _chars.find(x => x.id === id);
  if (!c) return;
  _editingId = id;
  _dialogExampleCount = 0;

  // 文字字段
  document.getElementById('chModalTitle').textContent  = '编辑角色';
  document.getElementById('formName').value            = c.name     || '';
  document.getElementById('formRole').value            = c.role     || '';
  document.getElementById('formDesc').value            = c.desc     || '';
  document.getElementById('formTraits').value          = (c.traits || []).join(', ');
  document.getElementById('formPrompt').value          = c.prompt   || '';
  document.getElementById('formAge').value             = c.age      || '';
  document.getElementById('formBirthday').value        = c.birthday || '';
  document.getElementById('descCount').textContent     = (c.desc || '').length;

  document.getElementById('formSpecies').value         = c.species || '';
  document.getElementById('formAppearance').value      = c.appearance || '';
  document.getElementById('formOutfit').value          = c.outfit || '';
  document.getElementById('formFears').value           = c.fears || '';
  document.getElementById('formSpeechStyle').value     = c.speechStyle || '';
  document.getElementById('formCatchphrases').value    = (c.catchphrases || []).join(', ');
  document.getElementById('formBackstory').value       = c.backstory || '';
  document.getElementById('formScenario').value        = c.scenario || '';
  document.getElementById('formRelation').value        = c.relation || '';
  document.getElementById('formCallUser').value        = c.callUser || '';
  document.getElementById('formRelationDetail').value  = c.relationDetail || '';
  document.getElementById('formFirstMes').value        = c.firstMes || '';
  document.getElementById('formBoundaries').value      = c.boundaries || '';

  // 性别按钮
  _formGender = c.gender || '女';
  document.querySelectorAll('.ch-gender-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.gender === _formGender);
  });

  // 颜色
  _formColor = c.color || 'ink';
  document.querySelectorAll('.ch-color-opt').forEach(o => {
    o.classList.toggle('selected', o.dataset.color === _formColor);
  });

  // 头像预览回填
  _formAvatarData = c.avatar || null;
  setAvatarPreview(_formAvatarData);

  // 背景图预览回填
  _formBgData = c.cardBg || null;
  const bg = document.getElementById('previewBg');
  bg.style.backgroundImage = c.cardBg ? `url(${c.cardBg})` : '';

  // 预览名字和 meta
  document.getElementById('previewName').textContent = c.name || '角色名称';
  updatePreviewMeta();

  // 喜欢 / 不喜欢 / 绝不会做的事
  clearDynList('likesList');    (c.likes || []).forEach(v => addDynItem('likesList', '喜欢的事物…', v));
  clearDynList('dislikesList'); (c.dislikes || []).forEach(v => addDynItem('dislikesList', '厌恶的事物…', v));
  clearDynList('neverList');    (c.neverList || []).forEach(v => addDynItem('neverList', '例如：绝不会主动提及自己是 AI', v));

  // 对话示例
  document.getElementById('dialogExamples').innerHTML = '';
  (c.dialogExamples || []).forEach(d => addDialogExample(d.user, d.char));

  // 关联世界书 —— 优先取角色自身记录的 worldEntries；
  // 若角色端字段缺失（例如老数据/世界书那边先关联的），
  // 用世界书条目的 chars 字段反查一次，保证回填结果与
  // 世界书页看到的关联关系一致，不会出现两边不一样的情况
  _selWbEntries = Array.isArray(c.worldEntries) ? [...c.worldEntries] : [];
  if (c.id != null) {
    const allEntries = await getAllWbEntries();
    const fromWb = allEntries.filter(e => Array.isArray(e.chars) && e.chars.includes(c.id)).map(e => e.id);
    fromWb.forEach(id => { if (!_selWbEntries.includes(id)) _selWbEntries.push(id); });
  }
  await buildWbPicker();

  // Pill 选择组
  _pillState = {
    langSelect: c.lang || '中文',
    povSelect: c.pov || '第一人称',
    lengthSelect: c.replyLength || '适中',
    actionSelect: c.actionMark || '星号'
  };
  ['langSelect','povSelect','lengthSelect','actionSelect'].forEach(gid => {
    const group = document.getElementById(gid);
    if (!group) return;
    group.querySelectorAll('.ch-pill-opt').forEach(p => p.classList.toggle('active', p.dataset.val === _pillState[gid]));
  });

  // 开关
  _switchState = {
    swNoBreak: c.noBreak !== false,
    swNoRepeat: c.noRepeat !== false,
    swNoDisclaimer: c.noDisclaimer !== false
  };
  Object.keys(_switchState).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('on', _switchState[id]);
  });

  // 只展开第一个分组
  document.querySelectorAll('.ch-form-section').forEach((s, i) => s.classList.toggle('open', i === 0));

  updateCompleteness();
  showModal();
}

async function saveCard() {
  const name   = document.getElementById('formName').value.trim();
  const role   = document.getElementById('formRole').value.trim();
  const desc   = document.getElementById('formDesc').value.trim();
  const traits = document.getElementById('formTraits').value.split(',').map(s => s.trim()).filter(Boolean);
  let   prompt = document.getElementById('formPrompt').value.trim();

  if (!name) {
    document.getElementById('formName').focus();
    document.querySelectorAll('.ch-form-section')[0].classList.add('open');
    return;
  }

  const age      = document.getElementById('formAge').value.trim();
  const birthday = document.getElementById('formBirthday').value.trim();

  const data = {
    name, role, desc, traits, prompt,
    gender: _formGender, age, birthday,
    avatar: _formAvatarData, cardBg: _formBgData,
    color: _formColor,

    species:     document.getElementById('formSpecies').value.trim(),
    appearance:  document.getElementById('formAppearance').value.trim(),
    outfit:      document.getElementById('formOutfit').value.trim(),

    likes:       getDynListValues('likesList'),
    dislikes:    getDynListValues('dislikesList'),
    fears:       document.getElementById('formFears').value.trim(),

    speechStyle:   document.getElementById('formSpeechStyle').value.trim(),
    catchphrases:  document.getElementById('formCatchphrases').value.split(',').map(s => s.trim()).filter(Boolean),
    lang:          _pillState.langSelect,

    backstory:   document.getElementById('formBackstory').value.trim(),
    scenario:    document.getElementById('formScenario').value.trim(),

    worldEntries: [..._selWbEntries],

    relation:        document.getElementById('formRelation').value.trim(),
    callUser:        document.getElementById('formCallUser').value.trim(),
    relationDetail:  document.getElementById('formRelationDetail').value.trim(),

    firstMes:       document.getElementById('formFirstMes').value.trim(),
    dialogExamples: getDialogExamples(),

    neverList:    getDynListValues('neverList'),
    boundaries:   document.getElementById('formBoundaries').value.trim(),

    pov:            _pillState.povSelect,
    replyLength:    _pillState.lengthSelect,
    actionMark:     _pillState.actionSelect,
    noBreak:        _switchState.swNoBreak,
    noRepeat:       _switchState.swNoRepeat,
    noDisclaimer:   _switchState.swNoDisclaimer,
  };

  // 若未手动填写/生成提示词，保存时自动生成，确保应用角色时始终有完整指令
  if (!prompt) {
    prompt = buildPromptFromFields();
    data.prompt = prompt;
  }

  if (_editingId) data.id = _editingId;

  const savedId = await saveChar(data);
  const charId  = _editingId || savedId;

  // 把这次勾选结果写回世界书条目的 chars 字段，
  // 保证「角色档案」和「世界书」两端看到的关联关系始终一致，
  // 不会出现一边显示关联、另一边显示未关联的情况
  await syncWorldEntriesForChar(charId, _selWbEntries);

  closeModal();
  await renderList();
  if (_viewingId) openView(_viewingId);
  /* 通知 album 页刷新 char folder */
  localStorage.setItem('luna_char_db_update', Date.now());
  /* 通知 phone 页联系人同步 */
  localStorage.setItem('luna_characters_updated', Date.now());
}

function showModal() {
  document.getElementById('chModalOverlay').classList.add('show');
  document.getElementById('chModal').classList.add('show');
}

function closeModal() {
  document.getElementById('chModalOverlay').classList.remove('show');
  document.getElementById('chModal').classList.remove('show');
}

function selectColor(el) {
  document.querySelectorAll('.ch-color-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}

/* ================================
   初始化
================================ */
document.addEventListener('DOMContentLoaded', () => {
  updateTime();
  setInterval(updateTime, 1000);
  updateBattery();
  applyIsland();
  applyGlobalFont();  // ← 加这行
  renderList();
});

/* ================================
   字体同步
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

function toggleCard(el) {
  const isExpanded = el.classList.contains('expanded');
  // 关闭所有
  document.querySelectorAll('.ch-card').forEach(c => c.classList.remove('expanded'));
  // 如果点的不是已展开的，就展开它
  if (!isExpanded) el.classList.add('expanded');
}

/* ================================
   弹窗辅助函数
================================ */
let _formAvatarData = null;
let _formBgData = null;
let _formGender = '女';
let _formColor = 'ink';
let _selWbEntries = []; // 当前编辑角色所勾选的世界书条目 id 列表
let _pillState = { langSelect: '中文', povSelect: '第一人称', lengthSelect: '适中', actionSelect: '星号' };
let _switchState = { swNoBreak: true, swNoRepeat: true, swNoDisclaimer: true };

/* ---- 分组折叠 ---- */
function toggleSection(headEl) {
  const section = headEl.closest('.ch-form-section');
  section.classList.toggle('open');
}

/* ---- 主题色选择 ---- */
function selectColor(el) {
  document.querySelectorAll('.ch-color-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  _formColor = el.dataset.color;
}

/* ---- Pill 单选组 ---- */
function selectPill(el, groupId) {
  const group = document.getElementById(groupId);
  group.querySelectorAll('.ch-pill-opt').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  _pillState[groupId] = el.dataset.val;
}

/* ---- 开关 Toggle ---- */
function toggleSwitch(el) {
  const isOn = el.classList.toggle('on');
  _switchState[el.id] = isOn;
}

/* ---- 动态列表（喜欢/不喜欢/绝不会做的事）---- */
function addDynItem(listId, placeholder, value) {
  const list = document.getElementById(listId);
  const row = document.createElement('div');
  row.className = 'ch-dynlist-row';
  row.innerHTML = `
    <input class="ch-form-input" type="text" placeholder="${escHtml(placeholder)}" value="${value ? escHtml(value) : ''}"/>
    <button class="ch-dynlist-del" onclick="this.parentElement.remove()">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    </button>`;
  list.appendChild(row);
}
function getDynListValues(listId) {
  return Array.from(document.querySelectorAll(`#${listId} input`))
    .map(i => i.value.trim()).filter(Boolean);
}
function clearDynList(listId) {
  document.getElementById(listId).innerHTML = '';
}

/* ---- 对话示例（用户/角色 成对）---- */
let _dialogExampleCount = 0;
function addDialogExample(userVal, charVal) {
  _dialogExampleCount++;
  const list = document.getElementById('dialogExamples');
  const pair = document.createElement('div');
  pair.className = 'ch-dialog-pair';
  pair.innerHTML = `
    <div class="ch-dialog-pair-head">
      <span class="ch-dialog-pair-label">EXAMPLE ${String(_dialogExampleCount).padStart(2,'0')}</span>
      <button class="ch-dynlist-del" onclick="this.closest('.ch-dialog-pair').remove()">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      </button>
    </div>
    <div class="ch-dialog-pair-body">
      <div class="ch-dialog-line">
        <span class="ch-dialog-tag">用户</span>
        <textarea class="ch-form-textarea dlg-user" style="min-height:44px;" placeholder="用户可能说的话…">${userVal ? escHtml(userVal) : ''}</textarea>
      </div>
      <div class="ch-dialog-line">
        <span class="ch-dialog-tag char">角色</span>
        <textarea class="ch-form-textarea dlg-char" style="min-height:56px;" placeholder="角色的回应，展示语气与用词风格…">${charVal ? escHtml(charVal) : ''}</textarea>
      </div>
    </div>`;
  list.appendChild(pair);
}
function getDialogExamples() {
  return Array.from(document.querySelectorAll('#dialogExamples .ch-dialog-pair')).map(pair => ({
    user: pair.querySelector('.dlg-user').value.trim(),
    char: pair.querySelector('.dlg-char').value.trim()
  })).filter(d => d.user || d.char);
}

/* ---- 完整度计算（预览卡圆环）---- */
function updateCompleteness() {
  const fields = ['formName','formRole','formDesc','formTraits'];
  let filled = 0;
  fields.forEach(id => { if (document.getElementById(id) && document.getElementById(id).value.trim()) filled++; });
  const extra = ['formAppearance','formSpeechStyle','formBackstory','formFirstMes'];
  extra.forEach(id => { if (document.getElementById(id) && document.getElementById(id).value.trim()) filled += 0.5; });
  const pct = Math.min(100, Math.round((filled / (fields.length + extra.length * 0.5)) * 100));
  const circumference = 40.8;
  const offset = circumference - (circumference * pct / 100);
  const arc = document.getElementById('completenessArc');
  if (arc) arc.style.strokeDashoffset = offset;
  const txt = document.getElementById('completenessText');
  if (txt) txt.textContent = pct + '%';
}

/* ---- 自动生成系统提示词 ---- */
function buildPromptFromFields() {
  const g = id => (document.getElementById(id)?.value || '').trim();
  const name = g('formName') || '该角色';
  const role = g('formRole');
  const gender = _formGender;
  const age = g('formAge');
  const species = g('formSpecies');
  const appearance = g('formAppearance');
  const outfit = g('formOutfit');
  const desc = g('formDesc');
  const traits = g('formTraits');
  const likes = getDynListValues('likesList');
  const dislikes = getDynListValues('dislikesList');
  const fears = g('formFears');
  const speechStyle = g('formSpeechStyle');
  const catchphrases = g('formCatchphrases');
  const lang = _pillState.langSelect;
  const backstory = g('formBackstory');
  const scenario = g('formScenario');
  const relation = g('formRelation');
  const callUser = g('formCallUser');
  const relationDetail = g('formRelationDetail');
  const firstMes = g('formFirstMes');
  const dialogs = getDialogExamples();
  const neverList = getDynListValues('neverList');
  const boundaries = g('formBoundaries');
  const pov = _pillState.povSelect;
  const length = _pillState.lengthSelect;
  const actionMark = _pillState.actionSelect;

  let p = '';
  p += `你将完全代入并扮演角色"${name}"，在整个对话中始终保持第一人称的角色身份，不得跳出角色、不得以"AI助手"的身份自称或解释。\n\n`;

  p += `【角色身份】\n`;
  p += `姓名：${name}\n`;
  if (role) p += `定位：${role}\n`;
  p += `性别：${gender}${age ? ' ｜ 年龄：' + age : ''}\n`;
  if (species) p += `身份类型：${species}\n`;
  p += `\n`;

  if (appearance || outfit) {
    p += `【外貌】\n`;
    if (appearance) p += `${appearance}\n`;
    if (outfit) p += `穿搭/标志物：${outfit}\n`;
    p += `\n`;
  }

  p += `【性格】\n`;
  if (traits) p += `核心特质：${traits}\n`;
  if (desc) p += `${desc}\n`;
  if (likes.length) p += `喜欢：${likes.join('、')}\n`;
  if (dislikes.length) p += `不喜欢：${dislikes.join('、')}\n`;
  if (fears) p += `隐藏面/弱点：${fears}\n`;
  p += `\n`;

  if (speechStyle || catchphrases) {
    p += `【语言风格】\n`;
    if (speechStyle) p += `${speechStyle}\n`;
    if (catchphrases) p += `常用口头禅：${catchphrases}\n`;
    p += `使用语言：${lang}\n`;
    p += `\n`;
  }

  if (backstory || scenario) {
    p += `【背景与场景】\n`;
    if (backstory) p += `背景故事：${backstory}\n`;
    if (scenario) p += `当前场景：${scenario}\n`;
    p += `\n`;
  }

  if (relation || callUser || relationDetail) {
    p += `【与用户的关系】\n`;
    if (relation) p += `关系：${relation}\n`;
    if (callUser) p += `对用户的称呼：${callUser}\n`;
    if (relationDetail) p += `${relationDetail}\n`;
    p += `\n`;
  }

  if (dialogs.length) {
    p += `【对话示例 —— 请模仿以下语气、句式与节奏】\n`;
    dialogs.forEach(d => {
      if (d.user) p += `用户：${d.user}\n`;
      if (d.char) p += `${name}：${d.char}\n`;
    });
    p += `\n`;
  }

  p += `【格式规范】\n`;
  p += `- 叙事视角：${pov}\n`;
  p += `- 回复长度：${length}\n`;
  p += `- 动作/心理描写：${actionMark === '星号' ? '使用 *星号* 包裹' : actionMark === '括号' ? '使用（括号）包裹' : '融入叙述文字中，不额外标注'}\n`;
  if (_switchState.swNoBreak) p += `- 全程保持角色视角，禁止出现"作为AI"、"我不能"、"我是语言模型"等跳出角色的表达\n`;
  if (_switchState.swNoRepeat) p += `- 回复中不复述或总结用户刚说过的话，直接以角色身份回应/推进对话\n`;
  if (_switchState.swNoDisclaimer) p += `- 不插入现实世界的免责声明、安全提示或说教口吻，保持角色沉浸感\n`;
  p += `\n`;

  if (neverList.length || boundaries) {
    p += `【绝对禁止事项】\n`;
    neverList.forEach((n, i) => { p += `${i + 1}. ${n}\n`; });
    if (boundaries) p += `情绪/行为边界：${boundaries}\n`;
    p += `\n`;
  }

  p += `请严格依据以上设定进行角色扮演，保持人设的连贯性与一致性，不随对话拉长而"失忆"或"人设漂移"。`;

  return p;
}

function generatePromptFromFields() {
  const prompt = buildPromptFromFields();
  document.getElementById('formPrompt').value = prompt;
  // 展开提示词分组，滚动到可见
  const section = document.querySelector('.ch-form-section[data-section="prompt"]');
  if (section && !section.classList.contains('open')) section.classList.add('open');
}

function handleAvatarUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _formAvatarData = e.target.result;
    setAvatarPreview(_formAvatarData);
  };
  reader.readAsDataURL(file);
  // 允许连续选择同一张图片也能触发 change
  input.value = '';
}

function setAvatarPreview(dataUrl) {
  const av    = document.getElementById('previewAvatar');
  const hint  = document.getElementById('previewAvatarHint');
  const remBt = document.getElementById('previewAvatarRemove');
  if (dataUrl) {
    av.innerHTML = `<img src="${dataUrl}" alt="avatar"/>`;
    if (hint)  hint.textContent = '更换头像';
    if (remBt) remBt.style.display = 'flex';
  } else {
    av.innerHTML = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.5"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
    if (hint)  hint.textContent = '上传头像';
    if (remBt) remBt.style.display = 'none';
  }
}

function removeAvatar(evt) {
  if (evt) evt.stopPropagation();
  _formAvatarData = null;
  const input = document.getElementById('avatarInput');
  if (input) input.value = '';
  setAvatarPreview(null);
  updateCompleteness();
}

function handleBgUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _formBgData = e.target.result;
    document.getElementById('previewBg').style.backgroundImage = `url(${e.target.result})`;
  };
  reader.readAsDataURL(file);
}

function selectGender(el) {
  document.querySelectorAll('.ch-gender-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  _formGender = el.dataset.gender;
  updatePreviewMeta();
}

function updatePreviewMeta() {
  const role = document.getElementById('formRole').value || '定位';
  const age  = document.getElementById('formAge').value  || '年龄';
  document.getElementById('previewMeta').textContent = `${role} · ${_formGender} · ${age}`;
}

/* ================================
   关联世界书 — 表单选择器
   与 worldbook.js 的 buildCharPicker / toggleCharSel 对称实现，
   保证两侧的交互体验和数据结构完全一致
================================ */
async function buildWbPicker() {
  const entries = await getAllWbEntries();
  const picker = document.getElementById('chWbPicker');
  if (!picker) return;
  if (entries.length === 0) {
    picker.innerHTML = `<div class="ch-wb-empty-hint">暂无世界书条目，请先在世界书中创建</div>`;
    return;
  }
  picker.innerHTML = entries.map(e => {
    const selected = _selWbEntries.includes(e.id);
    const isConst  = e.mode === 'constant';
    return `
      <div class="ch-wb-chip ${selected ? 'selected' : ''}" onclick="toggleWbSel(this, ${e.id})">
        <span class="ch-wb-chip-dot"></span>
        ${escHtml(e.title || '未命名')}
        ${isConst ? `<span class="ch-wb-chip-const">常驻</span>` : ''}
      </div>`;
  }).join('');
}

function toggleWbSel(el, id) {
  el.classList.toggle('selected');
  if (el.classList.contains('selected')) {
    if (!_selWbEntries.includes(id)) _selWbEntries.push(id);
  } else {
    _selWbEntries = _selWbEntries.filter(x => x !== id);
  }
}

/* ================================
   详情页
================================ */
let _viewingId = null;

async function openView(id) {
  const c = _chars.find(x => x.id === id);
  if (!c) return;
  _viewingId = id;

  // 背景图
  const bg = document.getElementById('cvHeroBg');
  if (c.cardBg) {
    bg.style.background = 'none';
    bg.style.backgroundImage = `url(${c.cardBg})`;
    bg.style.backgroundSize = 'cover';
    bg.style.backgroundPosition = 'center';
  } else {
    const col = COLOR_MAP[c.color] || COLOR_MAP.ink;
    bg.style.backgroundImage = 'none';
    bg.style.background = col.strip || `linear-gradient(180deg, #3a3a40, #1c1c1f)`;
  }

  // 头像
  const av = document.getElementById('cvAvatar');
  if (c.avatar) {
    av.innerHTML = `<img src="${c.avatar}" alt="avatar"/>`;
  } else {
    const col = COLOR_MAP[c.color] || COLOR_MAP.ink;
    av.innerHTML = `<div class="cv-hero-avatar-letter" style="color:${col.avCol}">${(c.name||'?')[0].toUpperCase()}</div>`;
    av.style.background = col.avBg;
  }

  // 基本信息
  document.getElementById('cvName').textContent     = c.name     || '—';
  document.getElementById('cvRole').textContent     = c.role     || '—';
  document.getElementById('cvGender').textContent   = c.gender   || '—';
  document.getElementById('cvAge').textContent      = c.age ? c.age + ' 岁' : '—';
  document.getElementById('cvBirthday').textContent = c.birthday || '—';
  document.getElementById('cvDesc').textContent     = c.desc     || '暂无描述';
  document.getElementById('cvPrompt').textContent   = c.prompt   || '（未设置，将自动生成）';

  // 状态胶囊
  const isActive = c.id === _activeId;
  const statusEl = document.getElementById('cvStatus');
  statusEl.innerHTML = `<div class="ch-status-pill${isActive ? ' active' : ''}">${isActive ? '激活中' : '待机'}</div>`;

  // 应用按钮状态
  const applyBtn = document.getElementById('cvApplyBtn');
  if (isActive) {
    applyBtn.classList.add('applied');
    applyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 已应用`;
  } else {
    applyBtn.classList.remove('applied');
    applyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 应用角色`;
  }

  // 性格标签
  const traitsEl = document.getElementById('cvTraits');
  traitsEl.innerHTML = (c.traits||[]).map(t =>
    `<span class="cv-trait">${escHtml(t)}</span>`
  ).join('') || `<span class="cv-section-empty">暂未设置性格标签</span>`;

  // 外貌
  const showOrEmpty = (id, val, empty) => {
    const el = document.getElementById(id);
    if (val) { el.textContent = val; el.classList.remove('cv-kv-empty'); }
    else { el.textContent = empty; el.classList.add('cv-kv-empty'); }
  };
  showOrEmpty('cvAppearance', c.appearance, '暂未填写');
  showOrEmpty('cvOutfit', c.outfit, '暂未填写');
  toggleSectionVisible('cvAppearanceSection', c.appearance || c.outfit);

  // 喜欢 / 不喜欢
  const likesEl = document.getElementById('cvLikes');
  const dislikesEl = document.getElementById('cvDislikes');
  likesEl.innerHTML = (c.likes||[]).map(v => `<div class="cv-pref-item">${escHtml(v)}</div>`).join('') || `<span class="cv-section-empty">暂无</span>`;
  dislikesEl.innerHTML = (c.dislikes||[]).map(v => `<div class="cv-pref-item">${escHtml(v)}</div>`).join('') || `<span class="cv-section-empty">暂无</span>`;
  toggleSectionVisible('cvPrefSection', (c.likes && c.likes.length) || (c.dislikes && c.dislikes.length));

  // 恐惧/弱点
  showOrEmpty('cvFears', c.fears, '暂未填写');
  toggleSectionVisible('cvFearsSection', c.fears);

  // 语言风格
  showOrEmpty('cvSpeechStyle', c.speechStyle, '暂未填写');
  showOrEmpty('cvCatchphrases', (c.catchphrases||[]).join(' ／ '), '暂无');
  toggleSectionVisible('cvSpeechSection', c.speechStyle || (c.catchphrases && c.catchphrases.length));

  // 背景故事
  showOrEmpty('cvBackstory', c.backstory, '暂未填写');
  showOrEmpty('cvScenario', c.scenario, '暂未填写');
  toggleSectionVisible('cvBackstorySection', c.backstory || c.scenario);

  // 关联世界书 —— 与世界书页的关联角色展示保持同源同构：
  // 都是从「世界书条目.chars 是否包含当前角色id」这个唯一
  // 真值来源判断，而不是分别读两份可能不一致的数据
  const allWbEntries = await getAllWbEntries();
  const linkedWb = allWbEntries.filter(e => Array.isArray(e.chars) && e.chars.includes(c.id));
  const wbRow = document.getElementById('cvWbRow');
  if (wbRow) {
    wbRow.innerHTML = linkedWb.length
      ? linkedWb.map(e => `
          <div class="cv-wb-chip" onclick="goToWorldbookEntry(${e.id})">
            <span class="cv-wb-chip-cat">${escHtml(e.cat || '其他')}</span>
            <span class="cv-wb-chip-title">${escHtml(e.title || '未命名')}</span>
            ${e.mode === 'constant' ? `<span class="cv-wb-chip-const">常驻</span>` : ''}
          </div>`).join('')
      : `<span class="cv-section-empty">暂未关联世界书条目</span>`;
  }
  toggleSectionVisible('cvWbSection', linkedWb.length);

  // 与用户关系
  showOrEmpty('cvRelation', c.relation, '暂未设置');
  showOrEmpty('cvCallUser', c.callUser, '暂未设置');
  showOrEmpty('cvRelationDetail', c.relationDetail, '暂未填写');
  toggleSectionVisible('cvRelationSection', c.relation || c.callUser || c.relationDetail);

  // 开场白
  document.getElementById('cvFirstMes').textContent = c.firstMes || '暂未设置开场白';
  toggleSectionVisible('cvFirstMesSection', c.firstMes);

  // 对话示例
  const dlgList = document.getElementById('cvDialogList');
  if (c.dialogExamples && c.dialogExamples.length) {
    dlgList.innerHTML = c.dialogExamples.map(d => `
      <div class="cv-dialog-card">
        ${d.user ? `<div class="cv-dialog-bubble user"><div class="cv-dialog-avatar user">U</div><div class="cv-dialog-text">${escHtml(d.user)}</div></div>` : ''}
        ${d.char ? `<div class="cv-dialog-bubble char"><div class="cv-dialog-avatar char">${escHtml((c.name||'?')[0])}</div><div class="cv-dialog-text">${escHtml(d.char)}</div></div>` : ''}
      </div>`).join('');
  } else {
    dlgList.innerHTML = `<span class="cv-section-empty">暂无对话示例</span>`;
  }
  toggleSectionVisible('cvDialogSection', c.dialogExamples && c.dialogExamples.length);

  // 行为边界
  const neverEl = document.getElementById('cvNeverList');
  neverEl.innerHTML = (c.neverList||[]).map((n,i) => `
    <div class="cv-rule-item"><span class="cv-rule-num">${String(i+1).padStart(2,'0')}</span><span>${escHtml(n)}</span></div>
  `).join('') || `<span class="cv-section-empty">暂未设置禁止事项</span>`;
  showOrEmpty('cvBoundaries', c.boundaries, '暂未填写');
  document.getElementById('cvBoundariesWrap').style.display = c.boundaries ? '' : 'none';
  toggleSectionVisible('cvRulesSection', (c.neverList && c.neverList.length) || c.boundaries);

  // 格式规范
  const fmtEl = document.getElementById('cvFormatChips');
  const fmtChips = [];
  if (c.pov) fmtChips.push(c.pov);
  if (c.replyLength) fmtChips.push(c.replyLength);
  if (c.actionMark) fmtChips.push(c.actionMark === '星号' ? '*星号*标注' : c.actionMark === '括号' ? '（括号）标注' : '无标注融入叙述');
  if (c.noBreak) fmtChips.push('禁止跳出角色');
  if (c.noRepeat) fmtChips.push('禁止复述输入');
  if (c.noDisclaimer) fmtChips.push('禁止说教/免责声明');
  fmtEl.innerHTML = fmtChips.map(f => `<span class="cv-format-chip">${escHtml(f)}</span>`).join('') || `<span class="cv-section-empty">使用默认格式规范</span>`;

  // 打开页面
  document.getElementById('cvPage').classList.add('show');
}

function toggleSectionVisible(sectionId, hasContent) {
  const el = document.getElementById(sectionId);
  if (!el) return;
  // 始终显示分区标题以保持结构完整感，仅当完全无内容时才淡化（不隐藏，保持可预期的信息架构）
  el.style.opacity = hasContent ? '1' : '0.55';
}

function closeView() {
  document.getElementById('cvPage').classList.remove('show');
  _viewingId = null;
}

function openMoreMenu() {
  document.getElementById('cvMenuOverlay').classList.add('show');
  document.getElementById('cvMenu').classList.add('show');
}
function closeMoreMenu() {
  document.getElementById('cvMenuOverlay').classList.remove('show');
  document.getElementById('cvMenu').classList.remove('show');
}

function openDeleteConfirm() {
  document.getElementById('cvConfirmOverlay').classList.add('show');
  document.getElementById('cvConfirm').classList.add('show');
}
function closeDeleteConfirm() {
  document.getElementById('cvConfirmOverlay').classList.remove('show');
  document.getElementById('cvConfirm').classList.remove('show');
}

async function confirmDelete() {
  if (!_viewingId) return;
  const deletedId = _viewingId;
  const db = await openCharDB();
  await new Promise(res => {
    const tx = db.transaction('chars', 'readwrite');
    tx.objectStore('chars').delete(deletedId);
    tx.oncomplete = res;
  });
  // 角色被删后，把它从所有世界书条目的 chars 里摘除，
  // 否则世界书那边会残留一个指向已删除角色的死引用
  await syncWorldEntriesForChar(deletedId, []);
  // 如果删的是激活角色，清掉 localStorage
  if (deletedId === _activeId) {
    localStorage.removeItem('luna_active_char');
    localStorage.removeItem('luna_char_prompt');
    localStorage.removeItem('luna_char_name');
  }
  closeDeleteConfirm();
  closeView();
  await renderList();
  /* 通知 album 页刷新 char folder */
  localStorage.setItem('luna_char_db_update', Date.now());
  /* 通知 phone 页联系人同步 */
  localStorage.setItem('luna_characters_updated', Date.now());
}

function openEditFromView() {
  if (!_viewingId) return;
  const id = _viewingId;   // 先把 id 存下来
  setTimeout(() => editCard(id), 380);  // 用局部变量，不受 closeView 影响
}

function applyFromView() {
  if (!_viewingId) return;
  applyCard(_viewingId);
  // 刷新详情页状态
  openView(_viewingId);
}

/* ================================================
   记忆档案 · 独立读取版（characters.js 不加载 memory.js，
   因此这里镜像同一套逻辑，直接读取 LunaMemoryDB）
   —— 保证「应用角色」时，记忆与人设被拼接为同一份 prompt
================================================ */
function _openMemDBStandalone() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('LunaMemoryDB', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('memories')) {
        const store = db.createObjectStore('memories', { keyPath: 'id' });
        store.createIndex('charId', 'charId', { unique: false });
        store.createIndex('type',   'type',   { unique: false });
      }
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

async function _getAllMemoriesStandalone() {
  try {
    const db = await _openMemDBStandalone();
    return new Promise((res, rej) => {
      if (!db.objectStoreNames.contains('memories')) { res([]); return; }
      const req = db.transaction('memories', 'readonly').objectStore('memories').getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror   = () => rej(req.error);
    });
  } catch (e) { return []; }
}

function _memTypeLabelStandalone(type) {
  return { core: '核心记忆', relation: '关系', emotion: '情绪', event: '事件' }[type] || '记忆';
}

async function buildMemoryPromptStandalone(charId) {
  const all = await _getAllMemoriesStandalone();
  const mems = all.filter(m => m.charId === charId || m.charName === charId);
  if (!mems.length) return '';

  const alwaysOn = mems.filter(m => m.alwaysOn);
  const rest     = mems.filter(m => !m.alwaysOn);
  const byType = t => rest
    .filter(m => (m.type || 'core') === t)
    .sort((a, b) => (b.intensity || 0) - (a.intensity || 0));

  const relationMems = byType('relation').slice(0, 3);
  const emotionMems  = byType('emotion').slice(0, 3);
  const eventMems    = byType('event').concat(byType('core')).slice(0, 5);

  const lines = [`[记忆档案注入 · ${charId}]`];

  if (alwaysOn.length) {
    lines.push('\n【核心常驻记忆 · 每次对话必定生效，具有最高优先级】');
    alwaysOn.slice(0, 6).forEach(m => {
      lines.push(`- ${m.title}（${_memTypeLabelStandalone(m.type)}）`);
      if (m.prompt) lines.push(`  → ${m.prompt}`);
      else if (m.content) lines.push(`  → ${m.content.slice(0, 120)}`);
    });
  }
  if (relationMems.length) {
    lines.push('\n【当前关系状态 · 请据此判断称呼与亲密程度，不要回退到更早的关系阶段】');
    relationMems.forEach(m => lines.push(`- ${m.title}：${(m.prompt || m.content || '').slice(0, 90)}`));
  }
  if (emotionMems.length) {
    lines.push('\n【近期情绪基调 · 情绪表达应与此保持连贯，不要无故跳变】');
    emotionMems.forEach(m => lines.push(`- ${m.title}（强度${m.intensity || 3}/5）：${(m.prompt || m.content || '').slice(0, 70)}`));
  }
  if (eventMems.length) {
    lines.push('\n【背景记忆参考 · 可作为细节引用，非必须逐条复述】');
    eventMems.forEach(m => lines.push(`- ${m.title}：${(m.prompt || m.content || '').slice(0, 70)}`));
  }

  lines.push('\n【格式与人设锚点 · 无论对话进行多久都必须遵守】');
  lines.push('- 全程保持第一人称的角色身份，不得以"AI助手""语言模型"等身份自称或跳出角色解释');
  lines.push('- 以上记忆是角色本身已知的过去，不是外部资料，回应时应像自然想起，而非罗列信息');
  lines.push('- 若记忆与用户当前所说内容冲突，以维持角色人设一致性为优先，不随意"失忆"或人设漂移');

  return lines.join('\n');
}
/* ================================================
   导入 / 导出
   - 单个导出：卡片上的导出按钮
   - 批量导出：勾选任意数量角色，打包成一个 JSON 文件下载
   - 导入：选择 JSON 文件（单个角色 或 批量合集均可识别），
     预览后勾选需要导入的角色，可选择“作为新角色”或“同名覆盖”
   - 全程不使用浏览器原生 alert/confirm/prompt，用自定义
     Toast + 面板交互代替
================================================ */

const IO_EXPORT_VERSION = 1;
let _ioExportSel = new Set();   // 导出面板：选中的角色 id
let _ioImportData = [];         // 导入面板：从文件解析出的角色数组
let _ioImportSel = new Set();   // 导入面板：选中的索引

/* ---- Toast ---- */
let _ioToastTimer = null;
function showToast(msg) {
  const el = document.getElementById('ioToast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_ioToastTimer);
  _ioToastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ---- 打开 / 关闭弹窗 ---- */
async function openIOModal() {
  document.getElementById('ioOverlay').classList.add('show');
  document.getElementById('ioModal').classList.add('show');
  switchIOTab('export');
  await renderIOExportList();
}
function closeIOModal() {
  document.getElementById('ioOverlay').classList.remove('show');
  document.getElementById('ioModal').classList.remove('show');
}
function switchIOTab(tab) {
  document.querySelectorAll('.io-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.getElementById('ioPanelExport').style.display = tab === 'export' ? '' : 'none';
  document.getElementById('ioPanelImport').style.display = tab === 'import' ? '' : 'none';
}

/* ---- 导出：渲染角色选择列表 ---- */
function ioCharAvatarHtml(c) {
  const letter = (c.name || '?')[0].toUpperCase();
  return c.avatar
    ? `<img src="${c.avatar}" alt=""/>`
    : `<span>${escHtml(letter)}</span>`;
}

async function renderIOExportList() {
  const chars = await getAllChars();
  _chars = chars; // 保持全局列表同步，便于单个导出按钮使用
  _ioExportSel = new Set(chars.map(c => c.id)); // 默认全选，方便一键导出全部
  const wrap = document.getElementById('ioExportList');
  document.getElementById('ioTotalCount').textContent = chars.length;

  if (!chars.length) {
    wrap.innerHTML = `<div class="io-empty">还没有可导出的角色</div>`;
    updateIOExportCount();
    return;
  }

  wrap.innerHTML = chars.map(c => `
    <div class="io-char-row selected" data-id="${c.id}" onclick="ioToggleExportRow(${c.id})">
      <div class="io-checkbox"><svg viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div class="io-char-avatar">${ioCharAvatarHtml(c)}</div>
      <div class="io-char-info">
        <div class="io-char-name">${escHtml(c.name || '未命名角色')}</div>
        <div class="io-char-role">${escHtml(c.role || '未设定定位')}</div>
      </div>
    </div>
  `).join('');
  updateIOExportCount();
}

function ioToggleExportRow(id) {
  const row = document.querySelector(`#ioExportList .io-char-row[data-id="${id}"]`);
  if (!row) return;
  if (_ioExportSel.has(id)) { _ioExportSel.delete(id); row.classList.remove('selected'); }
  else { _ioExportSel.add(id); row.classList.add('selected'); }
  updateIOExportCount();
}

function updateIOExportCount() {
  document.getElementById('ioSelCount').textContent = _ioExportSel.size;
  const allSelected = _chars.length > 0 && _ioExportSel.size === _chars.length;
  document.getElementById('ioSelectAllBtn').textContent = allSelected ? '取消全选' : '全选';
}

function ioToggleSelectAll() {
  const allSelected = _chars.length > 0 && _ioExportSel.size === _chars.length;
  _ioExportSel = allSelected ? new Set() : new Set(_chars.map(c => c.id));
  document.querySelectorAll('#ioExportList .io-char-row').forEach(row => {
    row.classList.toggle('selected', _ioExportSel.has(parseInt(row.dataset.id)));
  });
  updateIOExportCount();
}

/* ---- 触发浏览器文件下载（非弹窗，仅生成本地文件） ---- */
function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sanitizeFileName(name) {
  return String(name || '角色').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 40) || '角色';
}

function buildExportPayload(chars) {
  return {
    app: 'LunaCharacterStudio',
    type: 'character-export',
    version: IO_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    count: chars.length,
    characters: chars,
  };
}

/* 单个角色导出（卡片按钮触发） */
async function exportSingleChar(id) {
  const chars = _chars && _chars.length ? _chars : await getAllChars();
  const c = chars.find(x => x.id === id);
  if (!c) { showToast('未找到该角色'); return; }
  const payload = buildExportPayload([c]);
  downloadJSON(payload, `角色_${sanitizeFileName(c.name)}.json`);
  showToast(`已导出「${c.name || '未命名角色'}」`);
}

/* 批量导出：选中的角色 */
async function exportSelectedChars() {
  if (!_ioExportSel.size) { showToast('请至少选择一个角色'); return; }
  const chars = _chars.filter(c => _ioExportSel.has(c.id));
  const payload = buildExportPayload(chars);
  const filename = chars.length === 1
    ? `角色_${sanitizeFileName(chars[0].name)}.json`
    : `角色合集_${chars.length}个_${Date.now()}.json`;
  downloadJSON(payload, filename);
  showToast(`已导出 ${chars.length} 个角色`);
}

/* 批量导出：全部角色 */
async function exportAllChars() {
  const chars = await getAllChars();
  if (!chars.length) { showToast('还没有可导出的角色'); return; }
  const payload = buildExportPayload(chars);
  downloadJSON(payload, `角色全部备份_${chars.length}个_${Date.now()}.json`);
  showToast(`已导出全部 ${chars.length} 个角色`);
}

/* ---- 导入：解析所选文件 ---- */
function handleIOFileSelect(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  document.getElementById('ioDropzoneText').textContent = file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    let parsed;
    try {
      parsed = JSON.parse(e.target.result);
    } catch (err) {
      showToast('文件解析失败，请确认是有效的 JSON 备份文件');
      return;
    }

    let list = [];
    if (Array.isArray(parsed)) {
      list = parsed; // 兼容纯数组格式
    } else if (parsed && Array.isArray(parsed.characters)) {
      list = parsed.characters; // 批量导出格式
    } else if (parsed && typeof parsed === 'object' && (parsed.name || parsed.prompt || parsed.desc)) {
      list = [parsed]; // 单个角色导出格式
    }

    list = list.filter(x => x && typeof x === 'object');
    if (!list.length) {
      showToast('文件中没有可识别的角色数据');
      return;
    }

    _ioImportData = list;
    _ioImportSel = new Set(list.map((_, i) => i));
    renderIOImportList();
    document.getElementById('ioImportPreviewWrap').style.display = '';
    showToast(`识别到 ${list.length} 个角色`);
  };
  reader.onerror = () => showToast('文件读取失败，请重试');
  reader.readAsText(file, 'utf-8');
}

function renderIOImportList() {
  const wrap = document.getElementById('ioImportList');
  document.getElementById('ioImportTotalCount').textContent = _ioImportData.length;

  wrap.innerHTML = _ioImportData.map((c, i) => `
    <div class="io-char-row selected" data-idx="${i}" onclick="ioToggleImportRow(${i})">
      <div class="io-checkbox"><svg viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div class="io-char-avatar">${ioCharAvatarHtml(c)}</div>
      <div class="io-char-info">
        <div class="io-char-name">${escHtml(c.name || '未命名角色')}</div>
        <div class="io-char-role">${escHtml(c.role || '未设定定位')}</div>
      </div>
    </div>
  `).join('');
  updateIOImportCount();
}

function ioToggleImportRow(idx) {
  const row = document.querySelector(`#ioImportList .io-char-row[data-idx="${idx}"]`);
  if (!row) return;
  if (_ioImportSel.has(idx)) { _ioImportSel.delete(idx); row.classList.remove('selected'); }
  else { _ioImportSel.add(idx); row.classList.add('selected'); }
  updateIOImportCount();
}

function updateIOImportCount() {
  document.getElementById('ioImportSelCount').textContent = _ioImportSel.size;
  const allSelected = _ioImportData.length > 0 && _ioImportSel.size === _ioImportData.length;
  document.getElementById('ioImportSelectAllBtn').textContent = allSelected ? '取消全选' : '全选';
}

function ioToggleImportSelectAll() {
  const allSelected = _ioImportData.length > 0 && _ioImportSel.size === _ioImportData.length;
  _ioImportSel = allSelected ? new Set() : new Set(_ioImportData.map((_, i) => i));
  document.querySelectorAll('#ioImportList .io-char-row').forEach(row => {
    row.classList.toggle('selected', _ioImportSel.has(parseInt(row.dataset.idx)));
  });
  updateIOImportCount();
}

function resetIOImport() {
  _ioImportData = [];
  _ioImportSel = new Set();
  document.getElementById('ioImportPreviewWrap').style.display = 'none';
  document.getElementById('ioFileInput').value = '';
  document.getElementById('ioDropzoneText').textContent = '点击选择 JSON 文件';
}

/* 清理导入数据里不该带入新库的字段（如旧 id，避免和已有数据冲突） */
function sanitizeImportChar(raw, keepId) {
  const c = Object.assign({}, raw);
  if (!keepId) delete c.id;
  // worldEntries 里存的是旧库世界书条目 id，跨设备/跨库不一定还存在，
  // 保留字段但不做强校验，交由用户在角色详情页里自行确认关联是否仍有效
  return c;
}

async function confirmImportChars() {
  if (!_ioImportSel.size) { showToast('请至少选择一个要导入的角色'); return; }

  const mode = (_pillState && _pillState.ioModeSelect) || 'new';
  const existing = await getAllChars();
  const byName = new Map(existing.map(c => [c.name, c]));

  let added = 0, overwritten = 0;
  for (const idx of _ioImportSel) {
    const raw = _ioImportData[idx];
    if (!raw) continue;

    if (mode === 'overwrite' && raw.name && byName.has(raw.name)) {
      const target = byName.get(raw.name);
      const data = sanitizeImportChar(raw, false);
      data.id = target.id;
      await saveChar(data);
      overwritten++;
    } else {
      const data = sanitizeImportChar(raw, false);
      await saveChar(data);
      added++;
    }
  }

  resetIOImport();
  await renderList();
  await renderIOExportList();

  /* 通知其它页面同步 */
  localStorage.setItem('luna_char_db_update', Date.now());
  localStorage.setItem('luna_characters_updated', Date.now());

  const parts = [];
  if (added) parts.push(`新增 ${added} 个`);
  if (overwritten) parts.push(`覆盖 ${overwritten} 个`);
  showToast(parts.length ? `导入完成：${parts.join('，')}` : '导入完成');
  switchIOTab('export');
}