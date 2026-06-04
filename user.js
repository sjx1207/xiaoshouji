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
let pendingTags      = [];
let selectedAvatarColor  = '#1a1a22';
let avatarImageData  = null;  // base64 上传图片
let editingId        = null;  // 编辑模式下的 id
let boundCharId      = null;  // 绑定的角色 id
let _allChars        = [];    // 从 DB 读出的所有角色
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
  const mainRole = identities.length > 0 ? (identities[0].role || '—') : '—';
  const roleEl   = document.getElementById('statRole');
  roleEl.textContent = mainRole.length > 5
    ? mainRole.slice(0, 5) + '…'
    : (mainRole || '—');

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

  const tagsHtml = (identity.tags || []).slice(0, 3)
    .map(t => `<span class="card-tag">${escHtml(t)}</span>`)
    .join('');

  // 绑定角色信息
  let bindHtml = '';
  if (identity.boundCharId) {
    const bc = _allChars.find(c => c.id === identity.boundCharId);
    if (bc) {
      bindHtml = `
        <div class="card-bind">
          <div class="card-bind-dot"></div>
          <span>绑定：${escHtml(bc.name)}</span>
        </div>`;
    }
  }

  // 头像 HTML
  const avatarInner = identity.avatarImg
    ? `<img src="${escHtml(identity.avatarImg)}" alt="" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;border-radius:inherit;">`
    : initial;

  card.innerHTML = `
    <div class="card-topbar ${isActive ? '' : 'inactive'}"></div>
    <div class="card-inner">
      <div class="card-avatar" style="background:${escHtml(identity.avatarColor || '#1a1a22')}">
        ${avatarInner}
      </div>
      <div class="card-info">
        <div class="card-name">${escHtml(identity.name)}</div>
        ${identity.role  ? `<div class="card-role">${escHtml(identity.role)}</div>` : ''}
        ${identity.desc  ? `<div class="card-desc">${escHtml(identity.desc)}</div>` : ''}
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
   绑定角色下拉 — 填充选项
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
    opt.onclick = () => selectBoundChar(opt);

    const letter = (c.name || '?')[0].toUpperCase();
    const avatarInner = c.avatar
      ? `<img src="${escHtml(c.avatar)}" alt=""/>`
      : letter;

    opt.innerHTML = `
      <div class="bind-opt-avatar" style="background:#1e1a14">${avatarInner}</div>
      <span>${escHtml(c.name || '未命名')}</span>
    `;
    dropdown.appendChild(opt);
  });
}

function toggleBindDropdown() {
  const dd = document.getElementById('bindDropdown');
  const chv = document.getElementById('bindChevron');
  const isOpen = dd.classList.toggle('open');
  chv.style.transform = isOpen ? 'rotate(180deg)' : '';
}

function selectBoundChar(el) {
  const id = el.dataset.id ? parseInt(el.dataset.id) : null;
  boundCharId = id || null;

  // 更新按钮显示
  const nameEl   = document.getElementById('bindSelectName');
  const avatarEl = document.getElementById('bindSelectAvatar');

  if (!id) {
    nameEl.textContent   = '未绑定';
    avatarEl.style.background = '#c8c8d0';
    avatarEl.innerHTML   = '?';
  } else {
    const c = _allChars.find(x => x.id === id);
    if (c) {
      nameEl.textContent = c.name || '未命名';
      const letter = (c.name || '?')[0].toUpperCase();
      avatarEl.style.background = '#1e1a14';
      avatarEl.innerHTML = c.avatar
        ? `<img src="${escHtml(c.avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" alt=""/>`
        : letter;
    }
  }

  // 选中态
  document.querySelectorAll('#bindDropdown .bind-option').forEach(o => {
    o.classList.toggle('selected', o === el);
  });

  // 关闭下拉
  document.getElementById('bindDropdown').classList.remove('open');
  document.getElementById('bindChevron').style.transform = '';
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
  preview.style.background = '#1a1a22';
  img.src            = '';
  img.style.display  = 'none';
  letter.textContent = 'A';
  letter.style.display = '';
}

function restoreAvatarPreview(identity) {
  const preview = document.getElementById('avatarPreview');
  const img     = document.getElementById('avatarPreviewImg');
  const letter  = document.getElementById('avatarPreviewLetter');
  preview.style.background = identity.avatarColor || '#1a1a22';
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
  document.getElementById('avatarPreview').style.background = '#1a1a22';
}

function restoreColorChips(color) {
  document.querySelectorAll('.color-chip[data-color]').forEach(c => {
    c.classList.toggle('selected', c.dataset.color === color);
  });
  document.getElementById('avatarPreview').style.background = color || '#1a1a22';
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
   绑定选择器 重置 / 恢复
================================================ */
function resetBindSelector() {
  document.getElementById('bindSelectName').textContent    = '未绑定';
  const av = document.getElementById('bindSelectAvatar');
  av.style.background = '#c8c8d0';
  av.innerHTML        = '?';
  document.querySelectorAll('#bindDropdown .bind-option').forEach(o => {
    o.classList.toggle('selected', o.classList.contains('bind-option-none'));
  });
}

function restoreBindSelector(charId) {
  if (!charId) { resetBindSelector(); return; }
  const opt = document.querySelector(`#bindDropdown .bind-option[data-id="${charId}"]`);
  if (opt) selectBoundChar(opt);
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
    desc:        document.getElementById('profileInputDesc').value.trim(),
    username:    editingId ? (identities.find(i => i.id === editingId)?.username || '') : '',
    email:       editingId ? (identities.find(i => i.id === editingId)?.email    || '') : '',
    phone:       editingId ? (identities.find(i => i.id === editingId)?.phone    || '') : '',
    tags:        [...pendingTags],
    active:      document.getElementById('profileToggleActive').checked,
    avatarColor: selectedAvatarColor,
    avatarImg:   avatarImageData || null,
    bgImg:       bgImageData || null,
    boundCharId: boundCharId || null,
  };

  if (editingId) {
    const idx = identities.findIndex(i => i.id === editingId);
    if (idx !== -1) {
      identities[idx] = { ...identities[idx], ...data };
    }
  } else {
    data.id        = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    data.createdAt = Date.now();
    identities.unshift(data);
  }

  saveIdentities(identities);
  renderCards();
  closeProfilePage();
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
function openDetail(id) {
  const identity = identities.find(i => i.id === id);
  if (!identity) return;
  currentDetailId = id;

  const initial  = identity.name ? identity.name[0].toUpperCase() : '?';
  const isActive = identity.active !== false;
  const date     = new Date(identity.createdAt);
  const dateStr  = `${date.getFullYear()} 年 ${date.getMonth()+1} 月 ${date.getDate()} 日`;
  const idNum    = `ID · ${identity.id.toUpperCase()}`;

  // 绑定角色
  let bindHtml = '';
  if (identity.boundCharId) {
    const bc = _allChars.find(c => c.id === identity.boundCharId);
    if (bc) {
      const letter = (bc.name || '?')[0].toUpperCase();
      const avatarInner = bc.avatar ? `<img src="${escHtml(bc.avatar)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;"/>` : letter;
      bindHtml = `
        <div class="detail-section-gap"></div>
        <div class="profile-section-label" style="padding:0 22px 10px">绑定 AI 角色</div>
        <div class="detail-info-block">
          <div class="detail-info-row">
            <div style="display:flex;align-items:center;gap:12px">
              <div style="width:40px;height:40px;border-radius:10px;background:#1e1a14;display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:18px;color:#fff;overflow:hidden;flex-shrink:0">${avatarInner}</div>
              <div>
                <div style="font-size:15px;font-weight:600;color:var(--ink-7)">${escHtml(bc.name || '未命名')}</div>
                ${bc.role ? `<div style="font-size:11px;color:var(--ink-4);margin-top:2px">${escHtml(bc.role)}</div>` : ''}
              </div>
            </div>
          </div>
        </div>`;
    }
  }

  // 标签
  const tagsHtml = (identity.tags || []).length > 0
    ? `<div class="detail-section-gap"></div>
       <div class="profile-section-label" style="padding:0 22px 10px">身份标签</div>
       <div style="padding:0 20px;display:flex;flex-wrap:wrap;gap:6px">
         ${identity.tags.map(t => `<span class="card-tag" style="font-size:11px;padding:4px 11px">${escHtml(t)}</span>`).join('')}
       </div>`
    : '';

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

  document.getElementById('detailPageContent').innerHTML = `
    <!-- 英雄头像区 -->
    <div class="profile-hero" style="margin-bottom:0">
      <div class="profile-hero-bg"></div>
      <div class="profile-avatar-ring" style="width:90px;height:90px">
        <div class="profile-avatar" style="background:${escHtml(identity.avatarColor || '#1a1a22')}">${avatarInner}</div>
      </div>
      <div class="profile-hero-name">${escHtml(identity.name)}</div>
      ${identity.role ? `<div class="profile-hero-role">${escHtml(identity.role)}</div>` : ''}
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
      </div>
    </div>

    ${bindHtml}
    ${tagsHtml}
    ${descHtml}

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

    pendingTags         = [...(identity.tags || [])];
    selectedAvatarColor = identity.avatarColor || '#1a1a22';
    avatarImageData     = identity.avatarImg || null;
    boundCharId         = identity.boundCharId || null;

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

    pendingTags         = [];
    selectedAvatarColor = '#1a1a22';
    avatarImageData     = null;
    bgImageData         = null;
    boundCharId         = null;
    resetBgPreview();

    const pAvatar = document.getElementById('profileAvatarPreview');
    const pImg    = document.getElementById('profileAvatarImg');
    const pLetter = document.getElementById('profileAvatarLetter');
    pAvatar.style.background = '#1a1a22';
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
    if (boundCharId) profileRestoreBindSelector(boundCharId);
    else profileResetBindSelector();
  });

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
function profileAddTagOnEnter(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value.trim().replace(/,$/, '');
    if (val && pendingTags.length < 6 && !pendingTags.includes(val)) {
      pendingTags.push(val);
      profileRenderTagList();
    }
    e.target.value = '';
  }
}

function profileRenderTagList() {
  const list = document.getElementById('profileTagList');
  if (!list) return;
  list.innerHTML = pendingTags.map((t, i) =>
    `<div class="tag-pill">${escHtml(t)}<span class="tag-del" onclick="profileRemoveTag(${i})">×</span></div>`
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
    opt.onclick = () => profileSelectBoundChar(opt);
    const letter = (c.name || '?')[0].toUpperCase();
    const avatarInner = c.avatar ? `<img src="${escHtml(c.avatar)}" alt=""/>` : letter;
    opt.innerHTML = `<div class="bind-opt-avatar" style="background:#1e1a14">${avatarInner}</div><span>${escHtml(c.name || '未命名')}</span>`;
    dropdown.appendChild(opt);
  });
}

function toggleProfileBindDropdown() {
  const dd  = document.getElementById('profileBindDropdown');
  const chv = document.getElementById('profileBindChevron');
  const isOpen = dd.classList.toggle('open');
  chv.style.transform = isOpen ? 'rotate(180deg)' : '';
}

function profileSelectBoundChar(el) {
  const id = el.dataset.id ? parseInt(el.dataset.id) : null;
  boundCharId = id || null;

  const nameEl   = document.getElementById('profileBindSelectName');
  const avatarEl = document.getElementById('profileBindSelectAvatar');

  if (!id) {
    nameEl.textContent = '未绑定';
    avatarEl.style.background = '#c8c8d0';
    avatarEl.innerHTML = '?';
  } else {
    const c = _allChars.find(x => x.id === id);
    if (c) {
      nameEl.textContent = c.name || '未命名';
      avatarEl.style.background = '#1e1a14';
      avatarEl.innerHTML = c.avatar
        ? `<img src="${escHtml(c.avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" alt=""/>`
        : (c.name || '?')[0].toUpperCase();
    }
  }

  document.querySelectorAll('#profileBindDropdown .bind-option').forEach(o => {
    o.classList.toggle('selected', o === el);
  });

  document.getElementById('profileBindDropdown').classList.remove('open');
  document.getElementById('profileBindChevron').style.transform = '';
}

function profileResetBindSelector() {
  document.getElementById('profileBindSelectName').textContent = '未绑定';
  const av = document.getElementById('profileBindSelectAvatar');
  av.style.background = '#c8c8d0'; av.innerHTML = '?';
  document.querySelectorAll('#profileBindDropdown .bind-option').forEach(o => {
    o.classList.toggle('selected', o.classList.contains('bind-option-none'));
  });
}

function profileRestoreBindSelector(charId) {
  if (!charId) { profileResetBindSelector(); return; }
  const opt = document.querySelector(`#profileBindDropdown .bind-option[data-id="${charId}"]`);
  if (opt) profileSelectBoundChar(opt);
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