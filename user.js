/* ================================
   Identity Page — user.js
   完整同步 index / characters
================================ */

/* ================================================
   返回首页 — 同 characters.js 转场
================================================ */
function goBack() {
  const returnTo = localStorage.getItem('luna_return_to');
  localStorage.removeItem('luna_return_to');
  const dest = returnTo === 'chat_profile'
    ? 'chat.html#profile'
    : returnTo === 'wallet_me'
      ? 'wallet.html#me'
      : 'index.html';
  const mask = document.createElement('div');
  mask.style.cssText =
    'position:fixed;inset:0;' +
    'background:rgba(238,241,255,0.97);' +
    'opacity:0;z-index:9999;' +
    'transition:opacity 0.28s ease;pointer-events:all;';
  document.body.appendChild(mask);
  requestAnimationFrame(() => { mask.style.opacity = '1'; });
  setTimeout(() => { window.location.href = dest; }, 260);
}

/* ================================================
   状态栏时间 — 同步 index / characters
================================================ */
function updateTime() {
  const tz  = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const now = new Date();
  const s   = now.toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  document.querySelectorAll('.status-time').forEach(el => el.textContent = s);
}

/* ================================================
   电量 — 同步 index / characters
================================================ */
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

/* ================================================
   灵动岛 — 完整同步 index
================================================ */
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

/* ================================================
   字体同步 — 同步 index，但禁止覆盖大小/颜色
   只同步 font-family
================================================ */
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

  // 只同步 font-family，不覆盖 font-size / color
  let tag = document.getElementById('luna-font-override');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'luna-font-override';
    document.head.appendChild(tag);
  }
  const familyRule = name ? `font-family: '${name}', sans-serif !important;` : '';
  // 仅当有自定义字体时才注入，且不注入 color / size
  tag.textContent = familyRule
    ? `* { ${familyRule} }`
    : '';
}

/* ================================================
   跨页 localStorage 同步
================================================ */
window.addEventListener('storage', e => {
  if (e.key === 'luna_island_update') applyIsland();
  if (e.key === 'luna_tz_update')     updateTime();
  if (e.key === 'luna_font_update')   applyGlobalFont();
});

/* ================================================
   IndexedDB — 角色库（与 characters.js 共用）
================================================ */
let _charDB = null;

function openCharDB() {
  return new Promise((res, rej) => {
    if (_charDB) return res(_charDB);
    const req = indexedDB.open('LunaCharDB', 4);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('chars')) {
        db.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = e => { _charDB = e.target.result; res(_charDB); };
    req.onerror   = e => rej(e.target.error);
  });
}

async function getAllChars() {
  const db = await openCharDB().catch(() => null);
  if (!db) return [];
  return new Promise(res => {
    const r = db.transaction('chars').objectStore('chars').getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror   = () => res([]);
  });
}

/* ================================================
   数据存储 — 身份列表
================================================ */
/* ================================================
   IndexedDB — 身份数据（刷新永久保存）
================================================ */
let _identityDB = null;

function openIdentityDB() {
  return new Promise((res, rej) => {
    if (_identityDB) return res(_identityDB);
    const probe = indexedDB.open('LunaIdentityDB');
    probe.onsuccess = e => {
      const db = e.target.result;
      if (db.objectStoreNames.contains('identities')) {
        _identityDB = db; return res(_identityDB);
      }
      const ver = db.version + 1; db.close();
      const req2 = indexedDB.open('LunaIdentityDB', ver);
      req2.onupgradeneeded = ev => {
        if (!ev.target.result.objectStoreNames.contains('identities'))
          ev.target.result.createObjectStore('identities', { keyPath: 'id' });
      };
      req2.onsuccess = ev => { _identityDB = ev.target.result; res(_identityDB); };
      req2.onerror   = ev => rej(ev.target.error);
    };
    probe.onerror = e => rej(e.target.error);
  });
}

async function loadIdentitiesFromDB() {
  const db = await openIdentityDB().catch(() => null);
  if (!db) return [];
  if (!db.objectStoreNames.contains('identities')) return [];
  return new Promise(res => {
    const r = db.transaction('identities').objectStore('identities').getAll();
    r.onsuccess = () => {
      let list = r.result || [];
      // 一次性迁移旧 localStorage 数据
      try {
        const old = JSON.parse(localStorage.getItem('luna_identities_v1')) || [];
        if (old.length > 0 && list.length === 0) {
          list = old;
          const tx = db.transaction('identities', 'readwrite');
          old.forEach(item => tx.objectStore('identities').put(item));
          localStorage.removeItem('luna_identities_v1');
        }
      } catch(e) {}
      res(list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    };
    r.onerror = () => res([]);
  });
}

function saveIdentities(list) {
  openIdentityDB().then(db => {
    const tx = db.transaction('identities', 'readwrite');
    const st = tx.objectStore('identities');
    // 先清空再全量写入
    st.clear();
    list.forEach(item => st.put(item));
  }).catch(() => {});
}

function loadIdentities() { return []; }

/* ================================================
   全局状态
================================================ */
let identities       = loadIdentities();
let pendingTags      = [];    // { text, cat } 数组，cat: 性格/兴趣/关系/自定义
let currentTagCat    = '性格';
let selectedAvatarColor  = '#17171d';
let avatarImageData  = null;  // base64 上传图片
let editingId        = null;  // 编辑模式下的 id
let boundCharIds     = [];    // 绑定的角色 id 列表（多选）
let linkedIdentities  = [];   // 关联身份：[{ id, type, custom }] type 为预设关系类型或 '自定义'
let _allChars        = [];    // 从 DB 读出的所有角色

// 预设关联关系类型
const LINK_TYPE_PRESETS = ['小号', '主号', '平行身份', '工作马甲', '前身份', '备用身份'];
let currentDetailId  = null;

/* ================================================
   工具
================================================ */
function escHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ================================================
   渲染卡片列表
================================================ */
function renderCards() {
  const grid  = document.getElementById('cardsGrid');
  const empty = document.getElementById('emptyState');

  // 统计
  document.getElementById('statTotal').textContent  = identities.length;
  const activeCount = identities.filter(i => i.active).length;
  document.getElementById('statActive').textContent = activeCount;
  const boundCount = identities.filter(i => {
    const ids = Array.isArray(i.boundCharIds) ? i.boundCharIds : (i.boundCharId ? [i.boundCharId] : []);
    return ids.length > 0;
  }).length;
  const boundEl = document.getElementById('statBound');
  if (boundEl) boundEl.textContent = boundCount;

  // 清旧卡片
  Array.from(grid.querySelectorAll('.id-card')).forEach(el => el.remove());

  if (identities.length === 0) {
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  identities.forEach((identity, idx) => {
    const card = buildCard(identity, idx);
    grid.appendChild(card);
  });
}

function buildCard(identity, idx) {
  const card = document.createElement('div');
  card.className = 'id-card';
  card.style.animationDelay = `${idx * 0.06}s`;
  card.onclick = () => openDetail(identity.id);

  const initial  = identity.name ? identity.name[0].toUpperCase() : '?';
  const isActive = identity.active !== false;

  const date    = new Date(identity.createdAt);
  const dateStr = `${date.getFullYear()}.${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')}`;
  const idNum   = `#${String(identity.id).slice(-6).toUpperCase()}`;

  const tagsHtml = (identity.tags || []).slice(0, 4)
    .map(t => {
      const obj = typeof t === 'string' ? { text: t, cat: '自定义' } : t;
      return `<span class="card-tag" data-cat="${escHtml(obj.cat || '自定义')}">${escHtml(obj.text)}</span>`;
    })
    .join('');

  // 绑定角色信息（支持多个）
  let bindHtml = '';
  const boundIds = Array.isArray(identity.boundCharIds)
    ? identity.boundCharIds
    : (identity.boundCharId ? [identity.boundCharId] : []);
  if (boundIds.length > 0) {
    const names = boundIds
      .map(id => _allChars.find(c => c.id === id))
      .filter(Boolean)
      .map(c => escHtml(c.name))
      .join('、');
    if (names) {
      bindHtml = `
        <div class="card-bind">
          <div class="card-bind-dot"></div>
          <span>绑定：${names}</span>
        </div>`;
    }
  }

  // 头像 HTML
  const avatarInner = identity.avatarImg
    ? `<img src="${escHtml(identity.avatarImg)}" alt="" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;border-radius:inherit;">`
    : initial;

  const primaryBadge = identity.isPrimary
    ? `<div class="card-primary-badge"><svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.6L22 9.3l-5 4.9 1.2 7.1L12 17.9l-6.2 3.4L7 14.2 2 9.3l7.1-.7L12 2z"/></svg></div>`
    : '';

  const descOrMotto = identity.motto
    ? `<div class="card-desc" style="font-family:var(--font-serif);font-style:italic;font-size:13px;">${escHtml(identity.motto)}</div>`
    : (identity.desc ? `<div class="card-desc">${escHtml(identity.desc)}</div>` : '');

  card.innerHTML = `
    <div class="card-topbar ${isActive ? '' : 'inactive'}"></div>
    <div class="card-inner">
      <div class="card-avatar" style="background:${escHtml(identity.avatarColor || '#17171d')};position:relative">
        ${avatarInner}
        ${primaryBadge}
      </div>
      <div class="card-info">
        <div class="card-name-row">
          <div class="card-name">${escHtml(identity.name)}</div>
          ${identity.isPrimary ? `<span class="card-primary-tag">主身份</span>` : ''}
        </div>
        ${identity.role  ? `<div class="card-role">${escHtml(identity.role)}</div>` : ''}
        ${descOrMotto}
        ${bindHtml}
        ${tagsHtml ? `<div class="card-tags">${tagsHtml}</div>` : ''}
      </div>
      <div class="card-right">
        <div class="card-status">
          <div class="status-dot ${isActive ? '' : 'inactive'}"></div>
          <span>${isActive ? 'LIVE' : 'OFF'}</span>
        </div>
        <div class="card-chevron">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
      </div>
    </div>
    <div class="card-footer">
      <div class="card-date">${dateStr}</div>
      <div class="card-id-num">${idNum}</div>
    </div>
  `;
  return card;
}

/* ================================================
   绑定角色下拉 — 多选逻辑
================================================ */
async function populateBindDropdown() {
  _allChars = await getAllChars();
  const dropdown = document.getElementById('bindDropdown');

  // 移除旧的动态选项（保留第一个"不绑定"）
  Array.from(dropdown.querySelectorAll('.bind-option:not(.bind-option-none)'))
    .forEach(el => el.remove());

  _allChars.forEach(c => {
    const opt = document.createElement('div');
    opt.className = 'bind-option';
    opt.dataset.id = c.id;
    opt.onclick = () => toggleBoundChar(opt);

    const letter = (c.name || '?')[0].toUpperCase();
    const avatarInner = c.avatar
      ? `<img src="${escHtml(c.avatar)}" alt=""/>`
      : letter;
    const relSnippet = (c.relation || '').trim();

    // 多选勾选框
    opt.innerHTML = `
      <div class="bind-opt-avatar" style="background:${escHtml(c.color || '#17171d')}">${avatarInner}</div>
      <div class="bind-opt-meta">
        <span class="bind-opt-name">${escHtml(c.name || '未命名')}</span>
        ${relSnippet ? `<span class="bind-opt-rel">${escHtml(relSnippet)}</span>` : ''}
      </div>
      <div class="bind-opt-check" id="bindcheck_${c.id}">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20,6 9,17 4,12"/></svg>
      </div>
    `;
    dropdown.appendChild(opt);
  });

  // 同步当前 boundCharIds 的选中状态
  syncBindCheckmarks();
}

/* 切换单个角色的选中状态（多选） */
function toggleBoundChar(el) {
  const id = el.dataset.id ? parseInt(el.dataset.id) : null;
  if (!id) {
    // 点了「不绑定」→ 清空全部
    boundCharIds = [];
    syncBindCheckmarks();
    updateBindSelectDisplay();
    return;
  }
  const idx = boundCharIds.indexOf(id);
  if (idx === -1) {
    boundCharIds.push(id);
  } else {
    boundCharIds.splice(idx, 1);
  }
  syncBindCheckmarks();
  updateBindSelectDisplay();
  // 多选不关闭下拉，让用户继续选
}

/* 同步各选项的勾选样式 */
function syncBindCheckmarks() {
  _allChars.forEach(c => {
    const checkEl = document.getElementById('bindcheck_' + c.id);
    const optEl   = document.querySelector(`#bindDropdown .bind-option[data-id="${c.id}"]`);
    const selected = boundCharIds.includes(c.id);
    if (checkEl) checkEl.style.opacity = selected ? '1' : '0';
    if (optEl)   optEl.classList.toggle('selected', selected);
  });
  // 「不绑定」选项：当没有任何绑定时高亮
  const noneOpt = document.querySelector('#bindDropdown .bind-option-none');
  if (noneOpt) noneOpt.classList.toggle('selected', boundCharIds.length === 0);
}

/* 更新按钮显示文字 */
function updateBindSelectDisplay() {
  const nameEl   = document.getElementById('bindSelectName');
  const avatarEl = document.getElementById('bindSelectAvatar');
  if (boundCharIds.length === 0) {
    if (nameEl)   nameEl.textContent = '未绑定';
    if (avatarEl) { avatarEl.style.background = '#c7c7ce'; avatarEl.innerHTML = '?'; }
  } else {
    const chars = boundCharIds.map(id => _allChars.find(x => x.id === id)).filter(Boolean);
    if (nameEl) nameEl.textContent = chars.map(c => c.name || '未命名').join('、');
    if (avatarEl && chars.length > 0) {
      const first = chars[0];
      const letter = (first.name || '?')[0].toUpperCase();
      avatarEl.style.background = '#17171d';
      avatarEl.innerHTML = first.avatar
        ? `<img src="${escHtml(first.avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" alt=""/>`
        : letter;
    }
  }
}

function toggleBindDropdown() {
  const dd  = document.getElementById('bindDropdown');
  const chv = document.getElementById('bindChevron');
  const isOpen = dd.classList.toggle('open');
  chv.style.transform = isOpen ? 'rotate(180deg)' : '';
}

// 点击外部关闭下拉
document.addEventListener('click', e => {
  const wrap = document.getElementById('bindSelectWrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('bindDropdown')?.classList.remove('open');
    const chv = document.getElementById('bindChevron');
    if (chv) chv.style.transform = '';
  }
});

/* ================================================
   添加/编辑面板
================================================ */
function openAddPanel() {
  openProfilePage(null);
}

function openEditPanel(id) {
  closeDetail();
  openProfilePage(id);
}

function closeAddPanel() {
  document.getElementById('panelOverlay').classList.remove('active');
  document.getElementById('addPanel').classList.remove('active');
}

function closePanelCheck(e) {
  if (e.target === document.getElementById('panelOverlay')) closeAddPanel();
}

/* ================================================
   头像上传
================================================ */
function triggerAvatarUpload() {
  document.getElementById('avatarFileInput').click();
}

function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    avatarImageData = ev.target.result;
    const img = document.getElementById('avatarPreviewImg');
    const letter = document.getElementById('avatarPreviewLetter');
    img.src = avatarImageData;
    img.style.display = 'block';
    letter.style.display = 'none';
  };
  reader.readAsDataURL(file);
  // 清空 input，允许重复上传同一文件
  e.target.value = '';
}

function clearAvatarImage() {
  avatarImageData = null;
  const img    = document.getElementById('avatarPreviewImg');
  const letter = document.getElementById('avatarPreviewLetter');
  img.src          = '';
  img.style.display = 'none';
  letter.style.display = '';
}

function resetAvatarPreview() {
  const preview = document.getElementById('avatarPreview');
  const img     = document.getElementById('avatarPreviewImg');
  const letter  = document.getElementById('avatarPreviewLetter');
  preview.style.background = '#17171d';
  img.src            = '';
  img.style.display  = 'none';
  letter.textContent = 'A';
  letter.style.display = '';
}

function restoreAvatarPreview(identity) {
  const preview = document.getElementById('avatarPreview');
  const img     = document.getElementById('avatarPreviewImg');
  const letter  = document.getElementById('avatarPreviewLetter');
  preview.style.background = identity.avatarColor || '#17171d';
  letter.textContent = identity.name ? identity.name[0].toUpperCase() : 'A';
  if (identity.avatarImg) {
    img.src = identity.avatarImg;
    img.style.display = 'block';
    letter.style.display = 'none';
  } else {
    img.src = '';
    img.style.display = 'none';
    letter.style.display = '';
  }
}

/* ================================================
   颜色选择
================================================ */
function selectColor(el) {
  document.querySelectorAll('.color-chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedAvatarColor = el.dataset.color;
  document.getElementById('avatarPreview').style.background = selectedAvatarColor;
}

function resetColorChips() {
  const chips = document.querySelectorAll('.color-chip[data-color]');
  chips.forEach((c, i) => c.classList.toggle('selected', i === 0));
  document.getElementById('avatarPreview').style.background = '#17171d';
}

function restoreColorChips(color) {
  document.querySelectorAll('.color-chip[data-color]').forEach(c => {
    c.classList.toggle('selected', c.dataset.color === color);
  });
  document.getElementById('avatarPreview').style.background = color || '#17171d';
}

/* ================================================
   同步头像字母
================================================ */
function syncAvatarLetter(val) {
  const letter = val ? val[0].toUpperCase() : 'A';
  const el = document.getElementById('avatarPreviewLetter');
  if (el) el.textContent = letter;
}

/* ================================================
   绑定选择器 重置 / 恢复（多选版本）
================================================ */
function resetBindSelector() {
  boundCharIds = [];
  syncBindCheckmarks();
  updateBindSelectDisplay();
}

function restoreBindSelector(charIdsOrId) {
  // 兼容旧数据：单个 id (number) 或新数组
  if (!charIdsOrId || (Array.isArray(charIdsOrId) && charIdsOrId.length === 0)) {
    resetBindSelector(); return;
  }
  boundCharIds = Array.isArray(charIdsOrId) ? charIdsOrId : [charIdsOrId];
  syncBindCheckmarks();
  updateBindSelectDisplay();
}

/* ================================================
   标签
================================================ */
function addTagOnEnter(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value.trim().replace(/,$/, '');
    if (val && pendingTags.length < 6 && !pendingTags.includes(val)) {
      pendingTags.push(val);
      renderTagList();
    }
    e.target.value = '';
  }
}

function renderTagList() {
  const list = document.getElementById('tagList');
  list.innerHTML = pendingTags.map((t, i) =>
    `<div class="tag-pill">
      ${escHtml(t)}
      <span class="tag-del" onclick="removeTag(${i})">×</span>
    </div>`
  ).join('');
}

function removeTag(i) {
  pendingTags.splice(i, 1);
  renderTagList();
}

/* ================================================
   提交身份
================================================ */
function submitIdentity() {
  const name = document.getElementById('profileInputName').value.trim();
  if (!name) { shakeProfileInput('profileInputName'); return; }

  const data = {
    name,
    role:        document.getElementById('profileInputRole').value.trim(),
    motto:       document.getElementById('profileInputMotto')?.value.trim() || '',
    desc:        document.getElementById('profileInputDesc').value.trim(),
    gender:      document.getElementById('profileInputGender')?.value || '',
    birthday:    document.getElementById('profileInputBirthday')?.value.trim() || '',
    zodiac:      document.getElementById('profileInputZodiac')?.value || '',
    lang:        document.getElementById('profileInputLang')?.value.trim() || '',
    identityType: document.getElementById('profileInputType')?.value || '日常',
    location:    document.getElementById('profileInputLocation')?.value.trim() || '',
    occupation:  document.getElementById('profileInputOccupation')?.value.trim() || '',
    personality: document.getElementById('profileInputPersonality')?.value.trim() || '',
    selfCall:    document.getElementById('profileInputSelfCall')?.value.trim() || '',
    username:    editingId ? (identities.find(i => i.id === editingId)?.username || '') : '',
    email:       editingId ? (identities.find(i => i.id === editingId)?.email    || '') : '',
    phone:       editingId ? (identities.find(i => i.id === editingId)?.phone    || '') : '',
    tags:        [...pendingTags],
    active:      document.getElementById('profileToggleActive').checked,
    isPrimary:   document.getElementById('profileTogglePrimary')?.checked || false,
    avatarColor: selectedAvatarColor,
    avatarImg:   avatarImageData || null,
    bgImg:       bgImageData || null,
    boundCharIds: [...boundCharIds],   // 多选数组
    boundCharId:  boundCharIds.length > 0 ? boundCharIds[0] : null,  // 向下兼容旧代码
    linkedIdentities: linkedIdentities.map(l => ({ ...l })),  // 关联身份关系网络
  };

  if (editingId) {
    // 防止身份关联到自己
    data.linkedIdentities = data.linkedIdentities.filter(l => l.id !== editingId);
    const idx = identities.findIndex(i => i.id === editingId);
    if (idx !== -1) {
      identities[idx] = { ...identities[idx], ...data };
    }
  } else {
    data.id        = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    data.createdAt = Date.now();
    identities.unshift(data);
  }

  // 主身份互斥：同一时间只允许一个主身份
  if (data.isPrimary) {
    identities.forEach(i => { if (i.id !== data.id) i.isPrimary = false; });
  }

  saveIdentities(identities);
  renderCards();
  closeProfilePage();
}

/* ================================================
   设为 / 取消主身份（详情页按钮调用）
================================================ */
function setPrimaryIdentity(id) {
  const target = identities.find(i => i.id === id);
  if (!target) return;
  const makingPrimary = !target.isPrimary;
  identities.forEach(i => { i.isPrimary = (i.id === id) ? makingPrimary : false; });
  saveIdentities(identities);
  renderCards();
  openDetail(id);
}

/* ================================================
   自定义下拉选择器（性别 / 星座 / 身份类型）
================================================ */
function toggleMiniSelect(key) {
  const wrap = document.getElementById(key + 'SelectWrap');
  if (!wrap) return;
  const isOpen = wrap.classList.contains('open');
  // 关闭其它已展开的 mini-select，并清理它们提升过的父级层叠
  document.querySelectorAll('.mini-select-wrap.open').forEach(w => {
    w.classList.remove('open');
    w.closest('.profile-field-item')?.classList.remove('field-raised');
    w.closest('.profile-field-block')?.classList.remove('field-raised');
    w.closest('.profile-section')?.classList.remove('field-raised');
  });
  if (!isOpen) {
    wrap.classList.add('open');
    // 兜底方案：不依赖 :has() 选择器，直接打标记提升层叠优先级
    wrap.closest('.profile-field-item')?.classList.add('field-raised');
    wrap.closest('.profile-field-block')?.classList.add('field-raised');
    wrap.closest('.profile-section')?.classList.add('field-raised');
  }
}

function selectMiniOption(key, el) {
  const value = el.dataset.value || '';
  const label = el.textContent;
  const hiddenInput = document.getElementById('profileInput' + key.charAt(0).toUpperCase() + key.slice(1));
  if (hiddenInput) {
    hiddenInput.value = value;
    if (key === 'zodiac') hiddenInput.dataset.manual = '1';
  }

  const labelEl = document.getElementById(key + 'SelectLabel');
  if (labelEl) labelEl.textContent = label;

  const btnEl = document.getElementById(key + 'SelectBtn');
  if (btnEl) btnEl.classList.toggle('placeholder', !value);

  document.querySelectorAll(`#${key}SelectDropdown .mini-option`).forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');

  document.getElementById(key + 'SelectWrap')?.classList.remove('open');
}

function setMiniSelectValue(key, value, fallbackLabel, isAuto) {
  const dropdown = document.getElementById(key + 'SelectDropdown');
  const hiddenInput = document.getElementById('profileInput' + key.charAt(0).toUpperCase() + key.slice(1));
  if (hiddenInput) {
    hiddenInput.value = value || '';
    if (key === 'zodiac' && !isAuto) hiddenInput.dataset.manual = '1';
  }
  if (!dropdown) return;
  let matched = null;
  dropdown.querySelectorAll('.mini-option').forEach(o => {
    const match = (o.dataset.value || '') === (value || '');
    o.classList.toggle('selected', match);
    if (match) matched = o;
  });
  const labelEl = document.getElementById(key + 'SelectLabel');
  if (labelEl) labelEl.textContent = matched ? matched.textContent : (fallbackLabel || '未设置');
  const btnEl = document.getElementById(key + 'SelectBtn');
  if (btnEl) btnEl.classList.toggle('placeholder', !value);
}

/* 点击外部关闭 mini-select 下拉 */
document.addEventListener('click', e => {
  document.querySelectorAll('.mini-select-wrap.open').forEach(wrap => {
    if (!wrap.contains(e.target)) {
      wrap.classList.remove('open');
      wrap.closest('.profile-field-item')?.classList.remove('field-raised');
      wrap.closest('.profile-field-block')?.classList.remove('field-raised');
      wrap.closest('.profile-section')?.classList.remove('field-raised');
    }
  });
});

/* 由生日自动推算星座（不覆盖用户已手动选择的星座） */
const ZODIAC_RANGES = [
  ['摩羯座', 1, 1, 1, 19], ['水瓶座', 1, 20, 2, 18], ['双鱼座', 2, 19, 3, 20],
  ['白羊座', 3, 21, 4, 19], ['金牛座', 4, 20, 5, 20], ['双子座', 5, 21, 6, 21],
  ['巨蟹座', 6, 22, 7, 22], ['狮子座', 7, 23, 8, 22], ['处女座', 8, 23, 9, 22],
  ['天秤座', 9, 23, 10, 23], ['天蝎座', 10, 24, 11, 22], ['射手座', 11, 23, 12, 21],
  ['摩羯座', 12, 22, 12, 31],
];

function calcZodiac(month, day) {
  for (const [name, sm, sd, em, ed] of ZODIAC_RANGES) {
    if ((month === sm && day >= sd) || (month === em && day <= ed)) return name;
  }
  return '';
}

function syncZodiacFromBirthday() {
  const raw = document.getElementById('profileInputBirthday')?.value || '';
  const m = raw.match(/(\d{1,2})\s*[\/\-\.月]\s*(\d{1,2})/);
  if (!m) return;
  const month = parseInt(m[1]), day = parseInt(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return;
  const zodiac = calcZodiac(month, day);
  // 仅在星座尚未手动设置时自动填充
  const zodiacInput = document.getElementById('profileInputZodiac');
  if (zodiac && zodiacInput && !zodiacInput.dataset.manual) {
    setMiniSelectValue('zodiac', zodiac, null, true);
  }
}

function shakeProfileInput(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.color = '#ff3b30';
  el.style.animation = 'shake 0.35s ease';
  setTimeout(() => {
    el.style.color = '';
    el.style.animation = '';
  }, 400);
}

function shakeInput(id) {
  const el = document.getElementById(id);
  el.style.borderColor = '#ff3b30';
  el.style.animation   = 'shake 0.35s ease';
  setTimeout(() => {
    el.style.borderColor = '';
    el.style.animation   = '';
  }, 400);
}

// 抖动动画
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
@keyframes shake {
  0%,100% { transform: translateX(0); }
  20%      { transform: translateX(-6px); }
  40%      { transform: translateX(6px); }
  60%      { transform: translateX(-4px); }
  80%      { transform: translateX(4px); }
}`;
document.head.appendChild(shakeStyle);

/* ================================================
   详情 — 全屏页
================================================ */
/* 档案完善度提示：列出关键字段缺失情况，帮助 AI 更精准识别身份信息 */
function buildProfileHintHtml(identity) {
  const checks = [
    ['性别', identity.gender],
    ['生日', identity.birthday],
    ['居住地', identity.location],
    ['职业详情', identity.occupation],
    ['性格关键词', identity.personality],
    ['身份标签', (identity.tags || []).length > 0],
  ];
  const missing = checks.filter(([, v]) => !v).map(([label]) => label);
  if (missing.length === 0) return '';

  return `
    <div class="detail-section-gap"></div>
    <div style="padding:0 20px">
      <div class="profile-hint-bar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>档案还不够完整，补全 <b>${missing.map(escHtml).join('、')}</b> 能让绑定的 AI 角色更准确地理解这个身份。</span>
      </div>
    </div>`;
}

function openDetail(id) {
  const identity = identities.find(i => i.id === id);
  if (!identity) return;
  currentDetailId = id;

  const initial  = identity.name ? identity.name[0].toUpperCase() : '?';
  const isActive = identity.active !== false;
  const date     = new Date(identity.createdAt);
  const dateStr  = `${date.getFullYear()} 年 ${date.getMonth()+1} 月 ${date.getDate()} 日`;
  const idNum    = `ID · ${identity.id.toUpperCase()}`;

  // 绑定角色（支持多个）— 展示角色对用户的关系设定 / 称呼 / 互动细节
  let bindHtml = '';
  const boundIds = Array.isArray(identity.boundCharIds)
    ? identity.boundCharIds
    : (identity.boundCharId ? [identity.boundCharId] : []);
  {
    const boundChars = boundIds
      .map(bid => _allChars.find(c => c.id === bid))
      .filter(Boolean);

    if (boundChars.length > 0) {
      const cardsHtml = boundChars.map(bc => {
        const letter = (bc.name || '?')[0].toUpperCase();
        const avatarInner = bc.avatar
          ? `<img src="${escHtml(bc.avatar)}" alt=""/>`
          : letter;
        const avatarBg = bc.color || '#17171d';

        const relation = (bc.relation || '').trim();
        const callUser = (bc.callUser || '').trim();
        const relationDetail = (bc.relationDetail || '').trim();

        return `
          <div class="rel-card">
            <div class="rel-card-top" style="cursor:pointer" onclick="window.location.href='characters.html#view=${bc.id}'">
              <div class="rel-card-avatar" style="background:${escHtml(avatarBg)}">${avatarInner}</div>
              <div>
                <div class="rel-card-name">${escHtml(bc.name || '未命名')}</div>
                ${bc.role ? `<div class="rel-card-role">${escHtml(bc.role)}</div>` : ''}
              </div>
              <div class="rel-card-arrow">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </div>
            </div>
            <div class="rel-card-body">
              <div class="rel-line">
                <div class="rel-line-label">关系设定</div>
                <div class="rel-line-value ${relation ? '' : 'empty'}">${relation ? escHtml(relation) : '角色尚未设定与此身份的关系'}</div>
              </div>
              <div class="rel-line">
                <div class="rel-line-label">TA 称呼你</div>
                <div class="rel-line-value quote ${callUser ? '' : 'empty'}">${callUser ? '“' + escHtml(callUser) + '”' : '未设定专属称呼'}</div>
              </div>
              ${relationDetail ? `
              <div class="rel-line">
                <div class="rel-line-label">互动细节</div>
                <div class="rel-line-value">${escHtml(relationDetail)}</div>
              </div>` : ''}
            </div>
          </div>`;
      }).join('');

      bindHtml = `
        <div class="detail-section-gap"></div>
        <div class="profile-section-label" style="padding:0 22px 10px">绑定 AI 角色 · 关系档案</div>
        <div style="padding:0 20px">
          <div class="rel-card-list">${cardsHtml}</div>
        </div>`;
    } else {
      bindHtml = `
        <div class="detail-section-gap"></div>
        <div class="profile-section-label" style="padding:0 22px 10px">绑定 AI 角色</div>
        <div class="detail-info-block">
          <div class="rel-empty-hint">此身份尚未绑定任何角色<br/>编辑身份即可选择绑定</div>
        </div>`;
    }
  }

  // 标签
  const tagsHtml = (identity.tags || []).length > 0
    ? `<div class="detail-section-gap"></div>
       <div class="profile-section-label" style="padding:0 22px 10px">身份标签</div>
       <div style="padding:0 20px;display:flex;flex-wrap:wrap;gap:6px">
         ${identity.tags.map(t => {
           const obj = typeof t === 'string' ? { text: t, cat: '自定义' } : t;
           return `<span class="card-tag" data-cat="${escHtml(obj.cat || '自定义')}" style="font-size:11px;padding:4px 11px">${escHtml(obj.text)}</span>`;
         }).join('')}
       </div>`
    : '';

  // 关联身份 · 关系网络
  let linkHtml = '';
  {
    const links = Array.isArray(identity.linkedIdentities) ? identity.linkedIdentities : [];
    const linkCards = links.map(l => {
      const target = identities.find(i => i.id === l.id);
      if (!target) return '';
      const letter = (target.name || '?')[0].toUpperCase();
      const avatarInner = target.avatarImg ? `<img src="${escHtml(target.avatarImg)}" alt=""/>` : letter;
      const typeLabel = l.type === '自定义' ? (l.custom || '自定义关系') : l.type;
      return `
        <div class="rel-card">
          <div class="rel-card-top" style="cursor:pointer" onclick="openDetail('${target.id}')">
            <div class="rel-card-avatar" style="background:${escHtml(target.avatarColor || '#17171d')}">${avatarInner}</div>
            <div>
              <div class="rel-card-name">${escHtml(target.name || '未命名')}<span class="rel-type-badge">${escHtml(typeLabel)}</span></div>
              ${target.role ? `<div class="rel-card-role">${escHtml(target.role)}</div>` : ''}
            </div>
            <div class="rel-card-arrow">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </div>
        </div>`;
    }).filter(Boolean).join('');

    if (linkCards) {
      linkHtml = `
        <div class="detail-section-gap"></div>
        <div class="profile-section-label" style="padding:0 22px 10px">关联身份 · 关系网络</div>
        <div style="padding:0 20px">
          <div class="rel-card-list">${linkCards}</div>
        </div>`;
    }
  }

  // 备注
  const descHtml = identity.desc
    ? `<div class="detail-section-gap"></div>
       <div class="profile-section-label" style="padding:0 22px 10px">备注描述</div>
       <div class="detail-info-block">
         <div class="detail-info-row">
           <div style="font-size:14px;color:var(--ink-6);line-height:1.6">${escHtml(identity.desc)}</div>
         </div>
       </div>`
    : '';

  // 头像
  const avatarInner = identity.avatarImg
    ? `<img src="${escHtml(identity.avatarImg)}" alt="" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;border-radius:50%;"/>`
    : initial;

  const personalFields = [
    ['性别', identity.gender],
    ['生日', identity.birthday],
    ['星座', identity.zodiac],
    ['常用语言', identity.lang],
    ['身份类型', identity.identityType || '日常身份'],
    ['居住地', identity.location],
    ['职业详情', identity.occupation],
    ['性格关键词', identity.personality],
  ];
  if (identity.selfCall) personalFields.push(['角色对你的称呼', identity.selfCall]);

  const personalHtml = personalFields.some(([, v]) => v) ? `
    <div class="detail-section-gap"></div>
    <div class="profile-section-label" style="padding:0 22px 10px">个人资料</div>
    <div class="detail-info-block">
      ${personalFields.map(([label, value], i) => `
      ${i > 0 ? '<div style="height:1px;background:linear-gradient(90deg,transparent 16px,var(--ink-2) 16px,var(--ink-2) calc(100% - 16px),transparent calc(100% - 16px))"></div>' : ''}
      <div class="detail-info-row" style="flex-direction:column;align-items:flex-start;gap:4px">
        <div class="detail-info-label">${label}</div>
        <div class="detail-info-value">${value ? escHtml(value) : '<span style="color:var(--ink-3)">未设置</span>'}</div>
      </div>`).join('')}
    </div>` : '';

  document.getElementById('detailPageContent').innerHTML = `
    <!-- 英雄头像区 -->
    <div class="profile-hero" style="margin-bottom:0">
      <div class="profile-hero-bg"></div>
      <div class="profile-avatar-ring" style="width:90px;height:90px">
        <div class="profile-avatar" style="background:${escHtml(identity.avatarColor || '#17171d')}">${avatarInner}</div>
      </div>
      <div class="profile-hero-name">${escHtml(identity.name)}</div>
      ${identity.role ? `<div class="profile-hero-role">${escHtml(identity.role)}</div>` : ''}
      ${identity.motto ? `<div style="font-family:var(--font-serif);font-style:italic;font-size:14px;color:var(--ink-5);text-align:center;z-index:1">“${escHtml(identity.motto)}”</div>` : ''}
    </div>

    <div class="detail-section-gap"></div>

    <!-- 状态 -->
    <div class="profile-section-label" style="padding:0 22px 10px">状态</div>
    <div class="detail-info-block">
      <div class="detail-info-row">
        <div style="display:flex;align-items:center;gap:6px">
          <div class="status-dot ${isActive ? '' : 'inactive'}"></div>
          <span style="font-size:14px;color:var(--ink-6)">${isActive ? '激活中' : '已停用'}</span>
        </div>
        ${identity.isPrimary ? `<span class="card-primary-tag">主身份</span>` : ''}
      </div>
    </div>

    <div class="detail-section-gap"></div>
    <div class="detail-primary-row">
      <button class="detail-primary-btn ${identity.isPrimary ? 'is-primary' : ''}" onclick="setPrimaryIdentity('${identity.id}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="${identity.isPrimary ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.9 6.6L22 9.3l-5 4.9 1.2 7.1L12 17.9l-6.2 3.4L7 14.2 2 9.3l7.1-.7L12 2z"/></svg>
        ${identity.isPrimary ? '当前为主身份' : '设为主身份'}
      </button>
    </div>

    ${bindHtml}
    ${linkHtml}
    ${tagsHtml}
    ${descHtml}
    ${personalHtml}
    ${buildProfileHintHtml(identity)}

    <div class="detail-section-gap"></div>

    <!-- 账号信息占位 -->
    <div class="profile-section-label" style="padding:0 22px 10px">账号信息</div>
    <div class="detail-info-block">
      <div class="detail-info-row" style="flex-direction:column;align-items:flex-start;gap:4px">
        <div class="detail-info-label">邮箱</div>
        <div style="display:flex;align-items:center;justify-content:space-between;width:100%">
          <div class="detail-info-value">${identity.email ? escHtml(identity.email) : '<span style="color:var(--ink-3)">未绑定</span>'}</div>
          <span class="display-badge">邮箱 App 同步</span>
        </div>
      </div>
      <div style="height:1px;background:linear-gradient(90deg,transparent 16px,var(--ink-2) 16px,var(--ink-2) calc(100% - 16px),transparent calc(100% - 16px))"></div>
      <div class="detail-info-row" style="flex-direction:column;align-items:flex-start;gap:4px">
        <div class="detail-info-label">手机号</div>
        <div style="display:flex;align-items:center;justify-content:space-between;width:100%">
          <div class="detail-info-value">${identity.phone ? escHtml(identity.phone) : '<span style="color:var(--ink-3)">未绑定</span>'}</div>
          <span class="display-badge">钱包 App 同步</span>
        </div>
      </div>
      <div style="height:1px;background:linear-gradient(90deg,transparent 16px,var(--ink-2) 16px,var(--ink-2) calc(100% - 16px),transparent calc(100% - 16px))"></div>
      <div class="detail-info-row" style="flex-direction:column;align-items:flex-start;gap:4px">
        <div class="detail-info-label">密码管理</div>
        <div style="display:flex;align-items:center;justify-content:space-between;width:100%">
          <div class="detail-info-value" style="color:var(--ink-3)">暂无绑定账号</div>
          <span class="display-badge display-badge-lock">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            待接入
          </span>
        </div>
      </div>
    </div>

    <div class="detail-section-gap"></div>

    <!-- 档案信息 -->
    <div class="profile-section-label" style="padding:0 22px 10px">档案信息</div>
    <div class="detail-info-block">
      <div class="detail-info-row" style="flex-direction:column;align-items:flex-start;gap:4px">
        <div class="detail-info-label">创建时间</div>
        <div class="detail-info-value">${dateStr}</div>
      </div>
      <div style="height:1px;background:linear-gradient(90deg,transparent 16px,var(--ink-2) 16px,var(--ink-2) calc(100% - 16px),transparent calc(100% - 16px))"></div>
      <div class="detail-info-row" style="flex-direction:column;align-items:flex-start;gap:4px">
        <div class="detail-info-label">档案编号</div>
        <div class="detail-info-value mono">${idNum}</div>
      </div>
    </div>

    <!-- 删除按钮 -->
    <div class="detail-delete-row">
      <button class="detail-delete-full-btn" onclick="deleteIdentity('${identity.id}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        删除此身份档案
      </button>
    </div>
    <div style="height:32px"></div>
  `;

  // 同步状态栏
  const pct = document.getElementById('batPct')?.textContent || '76';
  const dp  = document.getElementById('detailBatPct');
  const di  = document.getElementById('detailBatInner');
  if (dp) dp.textContent = pct;
  if (di) {
    const src = document.getElementById('batInner');
    if (src) { di.style.width = src.style.width; di.style.background = src.style.background; }
  }
  const dt = document.getElementById('detailStatusTime');
  if (dt) dt.textContent = document.getElementById('statusTime')?.textContent || '';

  const detailIsland = document.getElementById('detailStatusIsland');
  if (detailIsland) {
    const enabled = localStorage.getItem('luna_island_enabled') === 'true';
    const style   = localStorage.getItem('luna_island_style') || 'minimal';
    if (!enabled) { detailIsland.innerHTML = ''; } else {
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
      detailIsland.innerHTML = styleMap[style] || styleMap.minimal;
    }
  }

  document.getElementById('detailPageTitle').textContent = identity.name || '身份详情';
  document.getElementById('detailFullPage').classList.add('active');
}

function closeDetailPage() {
  document.getElementById('detailFullPage').classList.remove('active');
}

function openEditFromDetail() {
  closeDetailPage();
  openProfilePage(currentDetailId);
}

function closeDetail() {
  closeDetailPage();
}

function deleteIdentity(id) {
  if (!confirm('确定要删除这个身份档案吗？')) return;
  identities = identities.filter(i => i.id !== id);
  saveIdentities(identities);
  renderCards();
  closeDetailPage();
}

/* ================================================
   资料页 — 全屏页面逻辑
================================================ */
function openProfilePage(editId) {
  editingId = editId;

  // 标题
  document.getElementById('profilePageTitle').textContent = editId ? '编辑身份' : '新建身份';
  document.getElementById('profileSaveBtnText').textContent = '保存';
  document.getElementById('profileSubmitText').textContent = editId ? '保存更改' : '创建身份档案';

  // 重置/填充表单
  if (editId) {
    const identity = identities.find(i => i.id === editId);
    if (!identity) return;

    document.getElementById('profileInputName').value     = identity.name     || '';
    document.getElementById('profileInputRole').value     = identity.role     || '';
    document.getElementById('profileInputDesc').value     = identity.desc     || '';
    document.getElementById('profileToggleActive').checked = identity.active !== false;
    if (document.getElementById('profileInputMotto'))    document.getElementById('profileInputMotto').value    = identity.motto    || '';
    if (document.getElementById('profileInputBirthday')) document.getElementById('profileInputBirthday').value = identity.birthday || '';
    if (document.getElementById('profileInputLang'))     document.getElementById('profileInputLang').value     = identity.lang     || '';
    if (document.getElementById('profileInputLocation'))    document.getElementById('profileInputLocation').value    = identity.location    || '';
    if (document.getElementById('profileInputOccupation'))  document.getElementById('profileInputOccupation').value  = identity.occupation  || '';
    if (document.getElementById('profileInputPersonality')) document.getElementById('profileInputPersonality').value = identity.personality || '';
    if (document.getElementById('profileInputSelfCall')) document.getElementById('profileInputSelfCall').value = identity.selfCall || '';
    if (document.getElementById('profileTogglePrimary')) document.getElementById('profileTogglePrimary').checked = !!identity.isPrimary;

    // 自定义下拉：性别 / 星座 / 身份类型
    setMiniSelectValue('gender', identity.gender || '');
    document.getElementById('profileInputZodiac') && (document.getElementById('profileInputZodiac').dataset.manual = identity.zodiac ? '1' : '');
    setMiniSelectValue('zodiac', identity.zodiac || '', '未设置（可由生日自动推算）', !identity.zodiac);
    setMiniSelectValue('type', identity.identityType || '日常', '日常身份');

    // 标签：兼容旧的纯字符串数组
    pendingTags = (identity.tags || []).map(t => typeof t === 'string' ? { text: t, cat: '自定义' } : { ...t });
    selectedAvatarColor = identity.avatarColor || '#17171d';
    avatarImageData     = identity.avatarImg || null;
    // 兼容旧数据：优先读 boundCharIds 数组，没有则从 boundCharId 迁移
    boundCharIds = Array.isArray(identity.boundCharIds)
      ? [...identity.boundCharIds]
      : (identity.boundCharId ? [identity.boundCharId] : []);
    linkedIdentities = Array.isArray(identity.linkedIdentities) ? identity.linkedIdentities.map(l => ({ ...l })) : [];

    // 头像
    const pAvatar = document.getElementById('profileAvatarPreview');
    const pImg    = document.getElementById('profileAvatarImg');
    const pLetter = document.getElementById('profileAvatarLetter');
    pAvatar.style.background = selectedAvatarColor;
    pLetter.textContent = identity.name ? identity.name[0].toUpperCase() : 'A';
    if (identity.avatarImg) {
      pImg.src = identity.avatarImg; pImg.style.display = 'block'; pLetter.style.display = 'none';
    } else {
      pImg.src = ''; pImg.style.display = 'none'; pLetter.style.display = '';
    }

    // 还原背景图
    bgImageData = identity.bgImg || null;
    const bgPreview = document.getElementById('profileHeroBgPreview');
    const bgHint    = document.getElementById('profileHeroBgHint');
    if (bgPreview) bgPreview.style.backgroundImage = bgImageData ? `url(${bgImageData})` : '';
    if (bgHint)    bgHint.style.display = bgImageData ? 'none' : 'flex';

    // 颜色
    document.querySelectorAll('.profile-color-chip[data-color]').forEach(c => {
      c.classList.toggle('selected', c.dataset.color === selectedAvatarColor);
    });

    // ID 条
    const strip = document.getElementById('profileIdStrip');
    strip.style.display = 'flex';
    document.getElementById('profileIdValue').textContent = 'ID · ' + identity.id.toUpperCase();

  } else {
    // 新建：重置
    document.getElementById('profileInputName').value     = '';
    document.getElementById('profileInputRole').value     = '';
    document.getElementById('profileInputDesc').value     = '';
    document.getElementById('profileToggleActive').checked = true;
    if (document.getElementById('profileInputMotto'))    document.getElementById('profileInputMotto').value    = '';
    if (document.getElementById('profileInputBirthday')) document.getElementById('profileInputBirthday').value = '';
    if (document.getElementById('profileInputLang'))     document.getElementById('profileInputLang').value     = '';
    if (document.getElementById('profileInputLocation'))    document.getElementById('profileInputLocation').value    = '';
    if (document.getElementById('profileInputOccupation'))  document.getElementById('profileInputOccupation').value  = '';
    if (document.getElementById('profileInputPersonality')) document.getElementById('profileInputPersonality').value = '';
    if (document.getElementById('profileInputSelfCall')) document.getElementById('profileInputSelfCall').value = '';
    if (document.getElementById('profileTogglePrimary')) document.getElementById('profileTogglePrimary').checked = false;

    setMiniSelectValue('gender', '');
    document.getElementById('profileInputZodiac') && (document.getElementById('profileInputZodiac').dataset.manual = '');
    setMiniSelectValue('zodiac', '', '未设置（可由生日自动推算）', true);
    setMiniSelectValue('type', '日常', '日常身份');

    pendingTags         = [];
    currentTagCat       = '性格';
    document.querySelectorAll('#profileTagCatRow .tag-cat-chip').forEach((c, idx) => c.classList.toggle('active', idx === 0));
    selectedAvatarColor = '#17171d';
    avatarImageData     = null;
    bgImageData         = null;
    boundCharIds        = [];
    linkedIdentities     = [];
    resetBgPreview();

    const pAvatar = document.getElementById('profileAvatarPreview');
    const pImg    = document.getElementById('profileAvatarImg');
    const pLetter = document.getElementById('profileAvatarLetter');
    pAvatar.style.background = '#17171d';
    pImg.src = ''; pImg.style.display = 'none';
    pLetter.textContent = 'A'; pLetter.style.display = '';

    document.querySelectorAll('.profile-color-chip[data-color]').forEach((c, i) => {
      c.classList.toggle('selected', i === 0);
    });

    document.getElementById('profileIdStrip').style.display = 'none';
  }

  profileRenderTagList();
  syncProfileHero();
  profilePopulateBindDropdown().then(() => {
    if (boundCharIds.length > 0) profileRestoreBindSelector(boundCharIds);
    else profileResetBindSelector();
  });

  // 关联身份下拉（同步，identities 已在内存中）
  profilePopulateLinkDropdown();
  if (linkedIdentities.length > 0) profileRestoreLinkSelector(linkedIdentities);
  else profileResetLinkSelector();

  // 同步状态栏
  profileSyncStatusBar();

  document.getElementById('profilePage').classList.add('active');
  setTimeout(() => document.getElementById('profileInputName').focus(), 450);
}

function closeProfilePage() {
  document.getElementById('profilePage').classList.remove('active');
}

/* 实时同步英雄区 */
function syncProfileHero() {
  const name = document.getElementById('profileInputName').value.trim();
  const role = document.getElementById('profileInputRole').value.trim();
  document.getElementById('profileHeroName').textContent = name || '— 未填写 —';
  document.getElementById('profileHeroRole').textContent = role || '角色 / 职位';

  // 同步头像字母
  const pLetter = document.getElementById('profileAvatarLetter');
  if (pLetter && document.getElementById('profileAvatarImg').style.display === 'none') {
    pLetter.textContent = name ? name[0].toUpperCase() : 'A';
  }
}

/* 颜色选择 */
function profileSelectColor(el) {
  document.querySelectorAll('.profile-color-chip[data-color]').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedAvatarColor = el.dataset.color;
  document.getElementById('profileAvatarPreview').style.background = selectedAvatarColor;
}

/* 清除头像图 */
function clearProfileAvatarImage() {
  avatarImageData = null;
  const img    = document.getElementById('profileAvatarImg');
  const letter = document.getElementById('profileAvatarLetter');
  img.src = ''; img.style.display = 'none';
  letter.style.display = '';
  syncProfileHero();
}

/* 头像上传（复用 handleAvatarUpload，但更新资料页预览） */
function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    avatarImageData = ev.target.result;
    // 资料页预览
    const img    = document.getElementById('profileAvatarImg');
    const letter = document.getElementById('profileAvatarLetter');
    if (img) { img.src = avatarImageData; img.style.display = 'block'; letter.style.display = 'none'; }
    // 旧面板预览（兼容）
    const img2 = document.getElementById('avatarPreviewImg');
    if (img2) { img2.src = avatarImageData; img2.style.display = 'block'; }
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

/* 背景图上传 */
let bgImageData = null;

function triggerBgUpload() {
  document.getElementById('bgFileInput').click();
}

function handleBgUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    bgImageData = ev.target.result;
    const preview = document.getElementById('profileHeroBgPreview');
    const hint    = document.getElementById('profileHeroBgHint');
    if (preview) preview.style.backgroundImage = `url(${bgImageData})`;
    if (hint) {
      hint.querySelector('div').textContent = '';
      hint.querySelector('div').innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> 更换背景';
    }
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

function resetBgPreview() {
  bgImageData = null;
  const preview = document.getElementById('profileHeroBgPreview');
  const hint    = document.getElementById('profileHeroBgHint');
  if (preview) preview.style.backgroundImage = '';
  if (hint)    hint.style.display = 'flex';
}

/* 标签 */
function profileSelectTagCat(el) {
  currentTagCat = el.dataset.cat;
  document.querySelectorAll('#profileTagCatRow .tag-cat-chip').forEach(c => c.classList.toggle('active', c === el));
}

function profileAddTagOnEnter(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value.trim().replace(/,$/, '');
    const exists = pendingTags.some(t => t.text === val);
    if (val && pendingTags.length < 8 && !exists) {
      pendingTags.push({ text: val, cat: currentTagCat });
      profileRenderTagList();
    }
    e.target.value = '';
  }
}

function profileRenderTagList() {
  const list = document.getElementById('profileTagList');
  if (!list) return;
  list.innerHTML = pendingTags.map((t, i) =>
    `<div class="tag-pill" data-cat="${escHtml(t.cat || '自定义')}">${escHtml(t.text)}<span class="tag-del" onclick="profileRemoveTag(${i})">×</span></div>`
  ).join('');
}

function profileRemoveTag(i) {
  pendingTags.splice(i, 1);
  profileRenderTagList();
}

/* 绑定下拉 */
async function profilePopulateBindDropdown() {
  _allChars = await getAllChars();
  const dropdown = document.getElementById('profileBindDropdown');
  Array.from(dropdown.querySelectorAll('.bind-option:not(.bind-option-none)')).forEach(el => el.remove());

  _allChars.forEach(c => {
    const opt = document.createElement('div');
    opt.className = 'bind-option';
    opt.dataset.id = c.id;
    opt.onclick = () => profileToggleBoundChar(opt);
    const letter = (c.name || '?')[0].toUpperCase();
    const avatarInner = c.avatar ? `<img src="${escHtml(c.avatar)}" alt=""/>` : letter;
    const relSnippet = (c.relation || '').trim();
    opt.innerHTML = `
      <div class="bind-opt-avatar" style="background:${escHtml(c.color || '#17171d')}">${avatarInner}</div>
      <div class="bind-opt-meta">
        <span class="bind-opt-name">${escHtml(c.name || '未命名')}</span>
        ${relSnippet ? `<span class="bind-opt-rel">${escHtml(relSnippet)}</span>` : ''}
      </div>
      <div class="bind-opt-check" id="profilebindcheck_${c.id}">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20,6 9,17 4,12"/></svg>
      </div>`;
    dropdown.appendChild(opt);
  });
  syncProfileBindCheckmarks();
}

function profileToggleBoundChar(el) {
  const id = el.dataset.id ? parseInt(el.dataset.id) : null;
  if (!id) {
    boundCharIds = [];
    syncProfileBindCheckmarks();
    profileUpdateBindSelectDisplay();
    return;
  }
  const idx = boundCharIds.indexOf(id);
  if (idx === -1) boundCharIds.push(id);
  else boundCharIds.splice(idx, 1);
  syncProfileBindCheckmarks();
  profileUpdateBindSelectDisplay();
}

function syncProfileBindCheckmarks() {
  _allChars.forEach(c => {
    const checkEl = document.getElementById('profilebindcheck_' + c.id);
    const optEl   = document.querySelector(`#profileBindDropdown .bind-option[data-id="${c.id}"]`);
    const selected = boundCharIds.includes(c.id);
    if (checkEl) checkEl.style.opacity = selected ? '1' : '0';
    if (optEl)   optEl.classList.toggle('selected', selected);
  });
  const noneOpt = document.querySelector('#profileBindDropdown .bind-option-none');
  if (noneOpt) noneOpt.classList.toggle('selected', boundCharIds.length === 0);
}

function profileUpdateBindSelectDisplay() {
  const nameEl   = document.getElementById('profileBindSelectName');
  const avatarEl = document.getElementById('profileBindSelectAvatar');
  if (boundCharIds.length === 0) {
    if (nameEl)   nameEl.textContent = '未绑定';
    if (avatarEl) { avatarEl.style.background = '#c7c7ce'; avatarEl.innerHTML = '?'; }
  } else {
    const chars = boundCharIds.map(id => _allChars.find(x => x.id === id)).filter(Boolean);
    if (nameEl) nameEl.textContent = chars.map(c => c.name || '未命名').join('、');
    if (avatarEl && chars.length > 0) {
      const first = chars[0];
      const letter = (first.name || '?')[0].toUpperCase();
      avatarEl.style.background = '#17171d';
      avatarEl.innerHTML = first.avatar
        ? `<img src="${escHtml(first.avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" alt=""/>`
        : letter;
    }
  }
}

function toggleProfileBindDropdown() {
  const dd  = document.getElementById('profileBindDropdown');
  const chv = document.getElementById('profileBindChevron');
  const isOpen = dd.classList.toggle('open');
  chv.style.transform = isOpen ? 'rotate(180deg)' : '';
}

function profileResetBindSelector() {
  boundCharIds = [];
  syncProfileBindCheckmarks();
  profileUpdateBindSelectDisplay();
}

function profileRestoreBindSelector(charIdsOrId) {
  if (!charIdsOrId || (Array.isArray(charIdsOrId) && charIdsOrId.length === 0)) {
    profileResetBindSelector(); return;
  }
  boundCharIds = Array.isArray(charIdsOrId) ? charIdsOrId : [charIdsOrId];
  syncProfileBindCheckmarks();
  profileUpdateBindSelectDisplay();
}

/* 点击外部关闭资料页绑定下拉 */
document.addEventListener('click', e => {
  const wrap = document.getElementById('profileBindSelectWrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('profileBindDropdown')?.classList.remove('open');
    const chv = document.getElementById('profileBindChevron');
    if (chv) chv.style.transform = '';
  }
});

/* ================================================
   关联身份 — 身份关系网络（新）
================================================ */
function profilePopulateLinkDropdown() {
  const dropdown = document.getElementById('profileLinkDropdown');
  if (!dropdown) return;
  Array.from(dropdown.querySelectorAll('.bind-option:not(.bind-option-none)')).forEach(el => el.remove());

  // 可关联对象：除当前正在编辑的身份之外的所有身份
  const candidates = identities.filter(i => i.id !== editingId);

  candidates.forEach(idt => {
    const opt = document.createElement('div');
    opt.className = 'bind-option';
    opt.dataset.id = idt.id;
    opt.onclick = () => profileToggleLinkedIdentity(opt);
    const letter = (idt.name || '?')[0].toUpperCase();
    const avatarInner = idt.avatarImg ? `<img src="${escHtml(idt.avatarImg)}" alt=""/>` : letter;
    opt.innerHTML = `
      <div class="bind-opt-avatar" style="background:${escHtml(idt.avatarColor || '#17171d')}">${avatarInner}</div>
      <div class="bind-opt-meta">
        <span class="bind-opt-name">${escHtml(idt.name || '未命名')}</span>
        ${idt.role ? `<span class="bind-opt-rel">${escHtml(idt.role)}</span>` : ''}
      </div>
      <div class="bind-opt-check" id="profilelinkcheck_${idt.id}">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20,6 9,17 4,12"/></svg>
      </div>`;
    dropdown.appendChild(opt);
  });
  syncProfileLinkCheckmarks();
}

function profileToggleLinkedIdentity(el) {
  const id = el.dataset.id || '';
  if (!id) {
    linkedIdentities = [];
    syncProfileLinkCheckmarks();
    profileUpdateLinkSelectDisplay();
    profileRenderLinkDetailList();
    return;
  }
  const idx = linkedIdentities.findIndex(l => l.id === id);
  if (idx === -1) linkedIdentities.push({ id, type: LINK_TYPE_PRESETS[0], custom: '' });
  else linkedIdentities.splice(idx, 1);
  syncProfileLinkCheckmarks();
  profileUpdateLinkSelectDisplay();
  profileRenderLinkDetailList();
}

function syncProfileLinkCheckmarks() {
  identities.forEach(idt => {
    const checkEl = document.getElementById('profilelinkcheck_' + idt.id);
    const optEl   = document.querySelector(`#profileLinkDropdown .bind-option[data-id="${idt.id}"]`);
    const selected = linkedIdentities.some(l => l.id === idt.id);
    if (checkEl) checkEl.style.opacity = selected ? '1' : '0';
    if (optEl)   optEl.classList.toggle('selected', selected);
  });
  const noneOpt = document.querySelector('#profileLinkDropdown .bind-option-none');
  if (noneOpt) noneOpt.classList.toggle('selected', linkedIdentities.length === 0);
}

function profileUpdateLinkSelectDisplay() {
  const nameEl   = document.getElementById('profileLinkSelectName');
  const avatarEl = document.getElementById('profileLinkSelectAvatar');
  if (linkedIdentities.length === 0) {
    if (nameEl)   nameEl.textContent = '未关联';
    if (avatarEl) { avatarEl.style.background = '#c7c7ce'; avatarEl.innerHTML = '?'; }
  } else {
    const linked = linkedIdentities.map(l => identities.find(x => x.id === l.id)).filter(Boolean);
    if (nameEl) nameEl.textContent = linked.map(i => i.name || '未命名').join('、');
    if (avatarEl && linked.length > 0) {
      const first = linked[0];
      const letter = (first.name || '?')[0].toUpperCase();
      avatarEl.style.background = first.avatarColor || '#17171d';
      avatarEl.innerHTML = first.avatarImg
        ? `<img src="${escHtml(first.avatarImg)}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" alt=""/>`
        : letter;
    }
  }
}

function toggleProfileLinkDropdown() {
  const dd  = document.getElementById('profileLinkDropdown');
  const chv = document.getElementById('profileLinkChevron');
  const isOpen = dd.classList.toggle('open');
  chv.style.transform = isOpen ? 'rotate(180deg)' : '';
}

function profileResetLinkSelector() {
  linkedIdentities = [];
  syncProfileLinkCheckmarks();
  profileUpdateLinkSelectDisplay();
  profileRenderLinkDetailList();
}

function profileRestoreLinkSelector(list) {
  linkedIdentities = Array.isArray(list) ? list.map(l => ({ ...l })) : [];
  syncProfileLinkCheckmarks();
  profileUpdateLinkSelectDisplay();
  profileRenderLinkDetailList();
}

/* 为每个已选关联身份渲染关系类型设定卡（预设 chip + 自定义输入） */
function profileRenderLinkDetailList() {
  const container = document.getElementById('profileLinkDetailList');
  if (!container) return;
  if (linkedIdentities.length === 0) { container.innerHTML = ''; return; }

  container.innerHTML = linkedIdentities.map((link, i) => {
    const target = identities.find(x => x.id === link.id);
    if (!target) return '';
    const letter = (target.name || '?')[0].toUpperCase();
    const avatarInner = target.avatarImg ? `<img src="${escHtml(target.avatarImg)}" alt=""/>` : letter;
    const chipsHtml = LINK_TYPE_PRESETS.map(t =>
      `<div class="link-type-chip ${link.type === t ? 'selected' : ''}" onclick="profileSetLinkType(${i}, '${t}')">${t}</div>`
    ).join('') + `<div class="link-type-chip ${link.type === '自定义' ? 'selected' : ''}" onclick="profileSetLinkType(${i}, '自定义')">自定义</div>`;

    return `
      <div class="link-detail-card">
        <div class="link-detail-head">
          <div class="link-detail-avatar" style="background:${escHtml(target.avatarColor || '#17171d')}">${avatarInner}</div>
          <div class="link-detail-name">${escHtml(target.name || '未命名')}</div>
        </div>
        <div class="link-type-row">${chipsHtml}</div>
        ${link.type === '自定义' ? `
        <input class="link-detail-custom-input" placeholder="输入自定义关系，例如「同一世界观的另一面」"
          value="${escHtml(link.custom || '')}" maxlength="20"
          oninput="profileSetLinkCustom(${i}, this.value)"/>` : ''}
      </div>`;
  }).join('');
}

function profileSetLinkType(i, type) {
  if (!linkedIdentities[i]) return;
  linkedIdentities[i].type = type;
  if (type !== '自定义') linkedIdentities[i].custom = '';
  profileRenderLinkDetailList();
}

function profileSetLinkCustom(i, value) {
  if (!linkedIdentities[i]) return;
  linkedIdentities[i].custom = value;
}

/* 点击外部关闭关联身份下拉 */
document.addEventListener('click', e => {
  const wrap = document.getElementById('profileLinkSelectWrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('profileLinkDropdown')?.classList.remove('open');
    const chv = document.getElementById('profileLinkChevron');
    if (chv) chv.style.transform = '';
  }
});

/* 资料页状态栏同步 */
function profileSyncStatusBar() {
  // 时间
  const tz  = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const now = new Date();
  const s   = now.toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  const t   = document.getElementById('profileStatusTime');
  if (t) t.textContent = s;

  // 电量
  const pct = document.getElementById('batPct')?.textContent || '76';
  const pp  = document.getElementById('profileBatPct');
  const pi  = document.getElementById('profileBatInner');
  if (pp) pp.textContent = pct;
  if (pi) {
    const src = document.getElementById('batInner');
    if (src) { pi.style.width = src.style.width; pi.style.background = src.style.background; }
  }

  // 灵动岛
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const el      = document.getElementById('profileStatusIsland');
  if (!el) return;
  if (!enabled) { el.innerHTML = ''; return; }

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
  el.innerHTML = styleMap[style] || styleMap.minimal;
}

/* ================================================
   初始化
================================================ */
async function init() {
  updateTime();
  setInterval(updateTime, 10000);
  updateBattery();
  applyIsland();
  // 从 user.html 返回时跳到 me tab
  if (window.location.hash === '#me') {
    switchTab('me');
    history.replaceState(null, '', window.location.pathname);
  }
  await applyGlobalFont();

  // 预加载角色列表（用于卡片显示绑定名称 & 下拉选择）
  _allChars = await getAllChars();

  identities = await loadIdentitiesFromDB();
  renderCards();
}

init();