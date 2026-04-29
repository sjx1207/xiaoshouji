/* ================================
   Luna Chat — chat.js
================================ */

/* ---- 状态栏时间 & 电量 ---- */
function updateTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const el = document.getElementById('statusTime');
  if (el) el.textContent = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
}

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
  } else { render(76); }
}

/* ---- Tab 切换 ---- */
const TAB_MAP = {
  messages: { btn: 'tabMessages', page: 'pageMessages' },
  contacts: { btn: 'tabContacts', page: 'pageContacts' },
  moments:  { btn: 'tabMoments',  page: 'pageMoments'  },
  profile:  { btn: 'tabProfile',  page: 'pageProfile'  },
};

function switchTab(name) {
  Object.entries(TAB_MAP).forEach(([key, { btn, page }]) => {
    const active = key === name;
    const btnEl = document.getElementById(btn);
    const wasActive = btnEl?.classList.contains('active');
    btnEl?.classList.toggle('active', active);
    document.getElementById(page)?.classList.toggle('active', active);

    if (btnEl) {
      const stroke = btnEl.querySelector('.icon-stroke');
      const fill   = btnEl.querySelector('.icon-fill');
      if (stroke) stroke.style.display = active ? 'none' : 'block';
      if (fill)   fill.style.display   = active ? 'block' : 'none';
    }

    if (active && !wasActive && btnEl) {
      btnEl.classList.remove('arc-lift');
      void btnEl.offsetWidth;
      btnEl.classList.add('arc-lift');
      setTimeout(() => btnEl.classList.remove('arc-lift'), 600);
      moveArc(btnEl);
    }
  });
}

function moveArc(btnEl) {
  const arc = document.getElementById('tabArc');
  if (!arc || !btnEl) return;
  const bar = btnEl.closest('.tab-bar');
  if (!bar) return;
  const barRect = bar.getBoundingClientRect();
  const btnRect = btnEl.getBoundingClientRect();
  const cx = btnRect.left - barRect.left + btnRect.width / 2;
  arc.style.left = (cx - 36) + 'px';
}

/* ---- 示例数据渲染 ---- */
/* ---- 会话数据（统一管理） ---- */
let convData = [];

function getSortedConvData() {
  const pinned   = convData.filter(d => d.pinned).sort((a,b) => b.timeVal - a.timeVal);
  const unpinned = convData.filter(d => !d.pinned).sort((a,b) => b.timeVal - a.timeVal);
  return [...pinned, ...unpinned];
}

function renderConvList() {
  const list = document.getElementById('convList');
  if (!list) return;
  const sorted = getSortedConvData();
  if (sorted.length === 0) {
    list.innerHTML = `
      <div style="text-align:center;padding:48px 24px;color:#999;">
        <div style="margin-bottom:12px;">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <div style="font-size:15px;font-weight:500;margin-bottom:6px;color:#bbb;">还没有任何对话</div>
        <div style="font-size:13px;line-height:1.6;color:#ccc;">去联系人页面找好友发起聊天吧</div>
      </div>`;
    return;
  }
  list.innerHTML = sorted.map((d, i) => {
    const realType = d.pinned ? 'pin' : (d.type === 'grp' ? 'grp' : 'def');
    return `
    <div class="ig-ci-wrap" data-name="${d.name}">
      <div class="ig-ci-actions">
        <button class="ig-ci-action-btn pin-btn" onclick="convPin('${d.name}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          ${d.pinned ? 'Unpin' : 'Pin'}
        </button>
        <button class="ig-ci-action-btn del-btn" onclick="convDelete('${d.name}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          Delete
        </button>
      </div>
      <div class="ig-ci ${realType}" data-name="${d.name}">
        ${d.pinned ? '<div class="ig-pin-dots"></div>' : ''}
        <div class="ig-ci-av">
          ${d.initial}
          ${d.online ? `<div class="ig-ci-dot" style="${d.pinned ? 'border-color:#0d0d0d' : ''}"></div>` : ''}
        </div>
        <div class="ig-ci-body">
          <div class="ig-ci-r1">
            <div class="ig-ci-name">${d.name}</div>
            ${d.pinned ? '<div class="ig-chip ig-chip-p">Pinned</div>' : ''}
            ${(!d.pinned && d.type === 'grp') ? '<div class="ig-chip ig-chip-g">Group</div>' : ''}
          </div>
          <div class="ig-ci-prev">${d.preview}</div>
        </div>
        <div class="ig-ci-end">
          <div class="ig-ci-time">${d.time}</div>
          ${d.unread ? `<div class="ig-ci-badge">${d.unread}</div>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
  initSwipe();
}

function renderMoments() {
  const data = [
    { user: '陈晓雨', initial: '陈', time: '10分钟前', text: '今天天气真好，出去走了一圈，整个人都放松了。', likes: 24, comments: 6 },
    { user: 'Aria',  initial: 'A',  time: '1小时前',  text: '新买的相机，试拍了几张，感觉还不错。',         likes: 58, comments: 12 },
    { user: '林默',   initial: '林', time: '3小时前',  text: '推荐一本书《置身事内》，读完很有收获。',       likes: 31, comments: 8  },
  ];
  const feed = document.getElementById('momentsFeed');
  if (!feed) return;
  feed.innerHTML = data.map(d => `
    <div class="moment-card">
      <div class="moment-header">
        <div class="moment-avatar">${d.initial}</div>
        <div class="moment-user">
          <div class="moment-username">${d.user}</div>
          <div class="moment-time">${d.time}</div>
        </div>
        <button class="moment-more">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
            <circle cx="5" cy="12" r="1.5" fill="currentColor"/>
            <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
            <circle cx="19" cy="12" r="1.5" fill="currentColor"/>
          </svg>
        </button>
      </div>
      <div class="moment-text">${d.text}</div>
      <div class="moment-actions">
        <button class="moment-action-btn" onclick="toggleLike(this)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" stroke-width="1.6"/>
          </svg>
          ${d.likes}
        </button>
        <button class="moment-action-btn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.6"/>
          </svg>
          ${d.comments}
        </button>
        <button class="moment-action-btn" style="margin-left:auto;">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');
}

function toggleLike(btn) {
  btn.classList.toggle('liked');
  const svg = btn.querySelector('svg path');
  if (btn.classList.contains('liked')) {
    svg.setAttribute('fill', '#f43f5e');
    svg.setAttribute('stroke', '#f43f5e');
  } else {
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
  }
}

/* ---- 占位函数 ---- */
function openNewChat()    { console.log('new chat'); }
function openAddContact() {
  ncResetCreate();
  ncLoadSelectData();
  document.getElementById('ncOverlay').classList.add('show');
  document.getElementById('ncPage').classList.add('show');
  document.getElementById('ncStatusBar').classList.add('show');
  document.getElementById('ncPageFooter').classList.add('show');
  // 同步状态栏时间
  const el = document.getElementById('ncTime');
  if (el) {
    const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
    el.textContent = new Date().toLocaleTimeString('zh-CN',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false});
  }
}

function closeAddContact() {
  document.getElementById('ncOverlay').classList.remove('show');
  document.getElementById('ncPage').classList.remove('show');
  document.getElementById('ncStatusBar').classList.remove('show');
  document.getElementById('ncPageFooter').classList.remove('show');
}

/* ── 模式切换 ── */
function switchNcMode(mode) {
  const bg = document.getElementById('ncModeBg');
  const btnA = document.getElementById('ncModeA');
  const btnB = document.getElementById('ncModeB');
  const panelA = document.getElementById('ncPanelCreate');
  const panelB = document.getElementById('ncPanelSelect');
  const submitBtn = document.getElementById('ncFooterSubmit');
  const submitDeco = document.getElementById('ncSubmitDeco');
  if (mode === 'create') {
    bg.classList.remove('right');
    btnA.classList.add('active'); btnB.classList.remove('active');
    panelA.classList.add('active'); panelB.classList.remove('active');
    if (submitBtn) {
      submitBtn.onclick = ncCreateAndSync;
      submitBtn.childNodes[0].textContent = '创建并同步到角色书 ';
      if (submitDeco) submitDeco.textContent = 'SYNC';
    }
  } else {
    bg.classList.add('right');
    btnB.classList.add('active'); btnA.classList.remove('active');
    panelB.classList.add('active'); panelA.classList.remove('active');
    if (submitBtn) {
      submitBtn.onclick = ncImportSelected;
      submitBtn.childNodes[0].textContent = '加入联系人 ';
      if (submitDeco) submitDeco.textContent = '0';
    }
  }
}

/* ── 面板A：新建角色 ── */
let _ncAvatarData = null;
let _ncBgData = null;
let _ncGender = '女';
let _ncColor = 'warm';

function ncResetCreate() {
  _ncAvatarData = null; _ncBgData = null;
  _ncGender = '女'; _ncColor = 'warm';
  ['ncFName','ncFRole','ncFAge','ncFDesc','ncFTraits','ncFPrompt'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = '';
  });
  document.getElementById('ncPvName').textContent = '角色名称';
  document.getElementById('ncPvMeta').textContent = '定位 · 性别';
  document.getElementById('ncPvBg').style.backgroundImage = '';
  const av = document.getElementById('ncPvAvatar');
  av.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none"><circle cx="12" cy="8" r="4" stroke="rgba(247,246,243,0.5)" stroke-width="1.4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(247,246,243,0.5)" stroke-width="1.4" stroke-linecap="round"/></svg><div class="nc-pv-av-hint">头像</div>`;
  document.querySelectorAll('.nc-gender-btn').forEach((b,i) => b.classList.toggle('active', i===0));
  document.querySelectorAll('.nc-co').forEach((o,i) => o.classList.toggle('selected', i===0));
}

function ncHandleAvatar(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _ncAvatarData = e.target.result;
    const av = document.getElementById('ncPvAvatar');
    av.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:11px"/>`;
  };
  reader.readAsDataURL(file);
}

function ncHandleBg(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _ncBgData = e.target.result;
    document.getElementById('ncPvBg').style.backgroundImage = `url(${e.target.result})`;
  };
  reader.readAsDataURL(file);
}

function ncPickGender(btn) {
  document.querySelectorAll('.nc-gender-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _ncGender = btn.dataset.g;
  ncUpdateMeta();
}

function ncPickColor(el) {
  document.querySelectorAll('.nc-co').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  _ncColor = el.dataset.color;
}

function ncUpdateMeta() {
  const role = document.getElementById('ncFRole').value || '定位';
  const age  = document.getElementById('ncFAge').value  || '';
  document.getElementById('ncPvMeta').textContent = `${role} · ${_ncGender}${age ? ' · ' + age : ''}`;
}

async function ncCreateAndSync() {
  const name = document.getElementById('ncFName').value.trim();
  if (!name) { document.getElementById('ncFName').focus(); return; }
  const data = {
    name, role: document.getElementById('ncFRole').value.trim(),
    desc: document.getElementById('ncFDesc').value.trim(),
    traits: document.getElementById('ncFTraits').value.split(',').map(s=>s.trim()).filter(Boolean),
    prompt: document.getElementById('ncFPrompt').value.trim(),
    gender: _ncGender, age: document.getElementById('ncFAge').value.trim(),
    color: _ncColor, avatar: _ncAvatarData, cardBg: _ncBgData,
  };
  // 写入 LunaCharDB（同角色书）
  const newId = await ncSaveToCharDB(data);
  // 同时加入联系人列表
  const conv = {
    name: data.name,
    initial: data.name[0],
    preview: data.role || '新角色',
    time: ncNowTime(),
    timeVal: Date.now(),
    unread: 0, online: false, pinned: false, type: 'def',
    charId: newId,
  };
  convData.unshift(conv);
  renderConvList();
  closeAddContact();
}

async function ncSaveToCharDB(data) {
  return new Promise(res => {
    const req = indexedDB.open('LunaCharDB', 2);
    req.onupgradeneeded = e => e.target.result.createObjectStore('chars',{keyPath:'id',autoIncrement:true});
    req.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('chars','readwrite');
      const r  = tx.objectStore('chars').add(data);
      r.onsuccess = () => res(r.result);
      r.onerror   = () => res(null);
    };
  });
}

function ncNowTime() {
  const now = new Date();
  return now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0');
}

/* ── 面板B：选择同步 ── */
let _ncAllItems = [];   // {type:'char'|'npc', data, charName}
let _ncSelected = new Set();
let _ncSubTab = 'all';

async function ncLoadSelectData() {
  _ncAllItems = []; _ncSelected = new Set();
  const selCountEl = document.getElementById('ncSelCount');
if (selCountEl) selCountEl.textContent = '0';
  const chars = await ncGetAllChars();
  document.getElementById('ncHeroCharCount').textContent = String(chars.length).padStart(2,'0');
  let npcTotal = 0;
  chars.forEach(c => {
    _ncAllItems.push({ type: 'char', data: c, charName: c.name });
    (c.charNpcs || []).forEach(n => {
      _ncAllItems.push({ type: 'npc', data: n, charName: c.name, charId: c.id });
      npcTotal++;
    });
  });
  document.getElementById('ncHeroNpcCount').textContent = String(npcTotal).padStart(2,'0');
  ncRenderSelList();
}

async function ncGetAllChars() {
  return new Promise(res => {
    const req = indexedDB.open('LunaCharDB', 2);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('chars')) {
        d.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('chars')) {
        res([]);
        return;
      }
      const r = db.transaction('chars').objectStore('chars').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror   = () => res([]);
    };
  });
}

function ncSwitchSubTab(tab) {
  _ncSubTab = tab;
  ['all','char','npc'].forEach(t => {
    document.getElementById('ncStab' + t.charAt(0).toUpperCase() + t.slice(1))
      ?.classList.toggle('active', t === tab);
  });
  ncRenderSelList();
}

function ncFilterSelect(q) {
  ncRenderSelList(q.trim().toLowerCase());
}

function ncRenderSelList(q) {
  const list = document.getElementById('ncSelList');
  let items = _ncAllItems;
  if (_ncSubTab === 'char') items = items.filter(i => i.type === 'char');
  if (_ncSubTab === 'npc')  items = items.filter(i => i.type === 'npc');
  if (q) items = items.filter(i => (i.data.name||'').toLowerCase().includes(q));
  if (items.length === 0) {
    list.innerHTML = `<div class="nc-sel-empty"><div class="nc-sel-empty-title">没有找到</div><div class="nc-sel-empty-desc">角色书里还没有角色或 NPC</div></div>`;
    return;
  }
  const relColor = {'恋人':'#c8a97e','友人':'#8eaec8','宿敌':'#c87e7e','家人':'#8ec8a3','其他':'#b8b8b0'};
  list.innerHTML = items.map((item, idx) => {
    const d = item.data;
    const letter = (d.name||'?')[0];
    const isChar = item.type === 'char';
    const key = isChar ? `char_${d.id}` : `npc_${item.charId}_${idx}`;
    const sel = _ncSelected.has(key);
    const bgStyle = d.cardBg ? `background-image:url(${d.cardBg});background-size:cover;background-position:center;` : '';
    const avatarHtml = d.avatar
      ? `<img src="${d.avatar}"/>`
      : `<span class="nc-sel-av-letter">${letter}</span>`;
    const tagsHtml = (d.traits||[]).slice(0,3).map(t=>`<span class="nc-sel-tag">${t}</span>`).join('');
    const relBadge = !isChar && d.rel
      ? `<div class="nc-sel-rel-badge" style="border-color:${relColor[d.rel]||'#b8b8b0'};color:${relColor[d.rel]||'#b8b8b0'}">${d.rel}</div>`
      : '';
    const fromLabel = !isChar ? `<div class="nc-sel-npc-from">来自 · ${item.charName}</div>` : '';
    return `
    <div class="nc-sel-card${sel?' selected':''}" onclick="ncToggleSelect('${key}',this)" style="animation-delay:${idx*0.05}s">
      <div class="nc-sel-top">
        <div class="nc-sel-top-img" style="${bgStyle}"></div>
        <div class="nc-sel-top-overlay"></div>
        <div class="nc-sel-type-tag">${isChar ? 'CHARACTER' : 'NPC'}</div>
        <div class="nc-sel-check">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="#f7f6f3" stroke-width="2.2" stroke-linecap="round"/>
          </svg>
        </div>
      </div>
      <div class="nc-sel-body">
        <div class="nc-sel-avatar">${avatarHtml}</div>
        <div class="nc-sel-info">
          <div class="nc-sel-name">${d.name||'—'}</div>
          <div class="nc-sel-role">${d.role||d.relDesc?.slice(0,20)||'—'}</div>
          <div class="nc-sel-tags">${tagsHtml}${relBadge}</div>
          ${fromLabel}
        </div>
      </div>
    </div>`;
  }).join('');
  // 存key映射供toggle用
  list._itemKeys = items.map((item,idx) => {
    const d = item.data;
    return item.type === 'char' ? `char_${d.id}` : `npc_${item.charId}_${idx}`;
  });
}

function ncToggleSelect(key, cardEl) {
  if (_ncSelected.has(key)) {
    _ncSelected.delete(key);
    cardEl.classList.remove('selected');
  } else {
    _ncSelected.add(key);
    cardEl.classList.add('selected');
  }
  document.getElementById('ncSelCount').textContent = _ncSelected.size;
}

function ncImportSelected() {
  if (_ncSelected.size === 0) return;
  _ncSelected.forEach(key => {
    const [type, ...rest] = key.split('_');
    let item;
    if (type === 'char') {
      const id = parseInt(rest[0]);
      item = _ncAllItems.find(i => i.type === 'char' && i.data.id === id);
    } else {
      item = _ncAllItems.find((i,idx) => {
        const k = `npc_${i.charId}_${idx}`;
        return k === key;
      });
    }
    if (!item) return;
    const d = item.data;
    const name = d.name || '未命名';
    if (convData.find(c => c.name === name)) return; // 去重
    convData.unshift({
      name,
      initial: name[0],
      preview: d.role || d.relDesc?.slice(0,18) || (type === 'npc' ? `来自 ${item.charName}` : '角色'),
      time: ncNowTime(),
      timeVal: Date.now(),
      unread: 0, online: false, pinned: false,
      type: 'def',
    });
  });
  renderConvList();
  closeAddContact();
}
function openNewPost()    { console.log('new post'); }

/* ---- 初始化 ---- */
document.addEventListener('DOMContentLoaded', () => {
  updateTime();
  updateBattery();
  setInterval(updateTime, 1000);
  renderConvList();
  renderMoments();
  switchTab('messages');
  const firstBtn = document.getElementById('tabMessages');
  if (firstBtn) moveArc(firstBtn);
  applyGlobalFont();   // ← 加这行
  applyIsland();       // ← 加这行
  renderStoryRing();
  renderFriends();
  renderGroups();
});
/* ---- 灵动岛同步 ---- */
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
      t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0');
    };
    tick();
    window._siClockTimer = setInterval(tick, 10000);
  }
}

/* ---- 字体同步 ---- */
async function applyGlobalFont() {
  const style  = JSON.parse(localStorage.getItem('luna_font_style') || '{}');
  const name   = localStorage.getItem('luna_font_active_name');
  const id     = parseInt(localStorage.getItem('luna_font_active_id'));
  if (name && id) {
    try {
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open('LunaFontDB', 3);
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
tag.textContent  = `* { ${familyRule} }`;
}

/* ---- 监听主页面设置变化，实时同步 ---- */
window.addEventListener('storage', e => {
  if (e.key === 'luna_font_update')   applyGlobalFont();
  if (e.key === 'luna_island_update') applyIsland();
  if (e.key === 'luna_tz_update')     updateTime();
});

window.addEventListener('pageshow', e => {
  if (e.persisted) window.location.reload();
});

function renderStoryRing() {
  const data = [];
  const el = document.getElementById('storyRingList');
  if (!el) return;
  if (data.length === 0) {
    el.innerHTML = `<div style="color:#ccc;font-size:12px;padding:8px 4px;display:flex;align-items:center;gap:4px;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2" stroke-linecap="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
      </svg>
      暂无在线好友
    </div>`;
    return;
  }
  el.innerHTML = data.map(d => `
    <div class="ig-av-item">
      <div class="ig-av-ring ${d.online ? 'live' : 'idle'}">
        <div class="ig-av-in">
          ${d.initial}
          ${d.online ? '<div class="ig-av-dot"></div>' : ''}
        </div>
      </div>
      <div class="ig-av-name">${d.name}</div>
    </div>
  `).join('');
}

function switchConvTab(btn, type) {
  document.querySelectorAll('.ig-conv-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

/* ---- 滑动操作 ---- */
function initSwipe() {
  document.querySelectorAll('.ig-ci-wrap').forEach(wrap => {
    const ci = wrap.querySelector('.ig-ci');
    let startX = 0;
    let startY = 0;
    let isDragging = false;
    let isHorizontal = null;

    ci.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isDragging = true;
      isHorizontal = null;
    }, { passive: true });

    ci.addEventListener('touchmove', e => {
      if (!isDragging) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (isHorizontal === null) {
        isHorizontal = Math.abs(dx) > Math.abs(dy);
      }
      if (isHorizontal) e.preventDefault();
    }, { passive: false });

    ci.addEventListener('touchend', e => {
      if (!isDragging || !isHorizontal) return;
      isDragging = false;
      const dx = e.changedTouches[0].clientX - startX;
      // 向左滑超过 60px 展开，向右滑收回
      if (dx < -60) {
        closeAllSwipe();
        ci.classList.add('swiped');
      } else if (dx > 30) {
        ci.classList.remove('swiped');
      }
    });
  });

  // 点击其他地方收回
  document.addEventListener('touchstart', e => {
    if (!e.target.closest('.ig-ci-wrap')) closeAllSwipe();
  }, { passive: true });
}

function closeAllSwipe() {
  document.querySelectorAll('.ig-ci.swiped').forEach(el => el.classList.remove('swiped'));
}

function convPin(name) {
  closeAllSwipe();
  const item = convData.find(d => d.name === name);
  if (!item) return;
  item.pinned = !item.pinned;
  renderConvList();
}

function convDelete(name) {
  closeAllSwipe();
  const item = convData.find(d => d.name === name);
  if (!item) return;
  showDeleteModal(name);
}

function showDeleteModal(name) {
  let mask = document.getElementById('igModalMask');
  if (!mask) {
    mask = document.createElement('div');
    mask.className = 'ig-modal-mask';
    mask.id = 'igModalMask';
    mask.innerHTML = `
      <div class="ig-modal">
        <div class="ig-modal-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </div>
        <div class="ig-modal-title">Delete Conversation</div>
        <div class="ig-modal-sub" id="igModalSub"></div>
        <div class="ig-modal-btns">
          <button class="ig-modal-btn cancel" onclick="hideDeleteModal()">Cancel</button>
          <button class="ig-modal-btn confirm" id="igModalConfirm">Delete</button>
        </div>
      </div>`;
    document.body.appendChild(mask);
    mask.addEventListener('click', e => {
      if (e.target === mask) hideDeleteModal();
    });
  }
  document.getElementById('igModalSub').textContent = `确定要删除与 "${name}" 的对话吗？删除后无法恢复。`;
  document.getElementById('igModalConfirm').onclick = () => {
    convData = convData.filter(d => d.name !== name);
    hideDeleteModal();
    renderConvList();
  };
  requestAnimationFrame(() => {
    mask.classList.add('show');
  });
}

function hideDeleteModal() {
  const mask = document.getElementById('igModalMask');
  if (mask) mask.classList.remove('show');
}

/* ---- 联系人页数据 ---- */
const friendsData = [];

const groupsData = [];

function renderFriends(list) {
  list = list || friendsData;
  const el = document.getElementById('ctFriendsContent');
  if (!el) return;
  if (!list || list.length === 0) {
    el.innerHTML = `
      <div style="text-align:center;padding:56px 24px;">
        <div style="margin-bottom:12px;">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.4" stroke-linecap="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div style="font-size:15px;font-weight:500;margin-bottom:6px;color:#bbb;">还没有好友</div>
        <div style="font-size:13px;line-height:1.6;color:#ccc;">点击右上角加号按钮添加好友吧</div>
      </div>`;
    return;
  }
  const groups = {};
  list.forEach(d => {
    if (!groups[d.group]) groups[d.group] = [];
    groups[d.group].push(d);
  });
  el.innerHTML = Object.entries(groups).map(([letter, items]) => `
    <div class="ct-group-card">
      <div class="ct-group-card-hd" onclick="toggleGroup(this)">
        <span class="ct-group-card-letter">${letter}</span>
        <span class="ct-group-card-count">${items.length} ${items.length > 1 ? 'people' : 'person'}</span>
        <div class="ct-collapse-icon">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(15,15,26,0.3)" stroke-width="2.5" stroke-linecap="round">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>
      </div>
      <div class="ct-group-body">
        ${items.map(d => `
          <div class="ct-item">
            <div class="ct-av">
              <div class="ct-av-inner ${d.style}">${d.initial}</div>
              ${d.online ? '<div class="ct-av-dot"></div>' : ''}
            </div>
            <div class="ct-info">
              <div class="ct-name">${d.name}</div>
              <div class="ct-bio">${d.bio}</div>
            </div>
            ${d.tag === 'online'
              ? '<span class="ct-tag ct-online">Online</span>'
              : d.tag ? `<span class="ct-tag">${d.tag}</span>` : ''}
          </div>`).join('')}
      </div>
    </div>
  `).join('');
}

function renderGroups() {
  const el = document.getElementById('ctGroupsContent');
  if (!el) return;
  if (!groupsData || groupsData.length === 0) {
    el.innerHTML = `
      <div style="text-align:center;padding:56px 24px;">
        <div style="margin-bottom:12px;">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.4" stroke-linecap="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
            <line x1="19" y1="8" x2="19" y2="14"/>
            <line x1="16" y1="11" x2="22" y2="11"/>
          </svg>
        </div>
        <div style="font-size:15px;font-weight:500;margin-bottom:6px;color:#bbb;">还没有群聊</div>
        <div style="font-size:13px;line-height:1.6;color:#ccc;">点击右上角加号按钮创建群聊吧</div>
      </div>`;
    return;
  }
  const sections = {};
  groupsData.forEach(d => {
    if (!sections[d.section]) sections[d.section] = [];
    sections[d.section].push(d);
  });
  el.innerHTML = Object.entries(sections).map(([sec, items]) => `
    <div class="ct-grp-card">
      <div class="ct-group-card-hd" onclick="toggleGroup(this)">
        <span class="ct-grp-card-sec">${sec}</span>
        <span class="ct-group-card-count">${items.length} groups</span>
        <div class="ct-collapse-icon">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(15,15,26,0.3)" stroke-width="2.5" stroke-linecap="round">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>
      </div>
      <div class="ct-group-body">
        ${items.map(d => `
          <div class="ct-grp-item">
            <div class="ct-grp-av">
              ${d.cells.map((c, i) => `<div class="ct-grp-cell ${d.cellStyles[i] === 'dk' ? 'dk' : ''}">${c}</div>`).join('')}
            </div>
            <div>
              <div class="ct-grp-name">${d.name}</div>
              <div class="ct-grp-sub">${d.sub}</div>
            </div>
            ${d.badge > 0
              ? `<div class="ct-grp-badge">${d.badge}</div>`
              : `<div class="ct-grp-muted">Muted</div>`}
          </div>`).join('')}
      </div>
    </div>
  `).join('');
}

function switchContactTab(tab) {
  const bg = document.getElementById('ctRailBg');
  const f  = document.getElementById('ctRailFriends');
  const g  = document.getElementById('ctRailGroups');
  const fc = document.getElementById('ctFriendsContent');
  const gc = document.getElementById('ctGroupsContent');
  if (!bg) return;
  if (tab === 'friends') {
    bg.classList.remove('right');
    f.classList.add('active');
    g.classList.remove('active');
    fc.style.display = 'block';
    gc.style.display = 'none';
  } else {
    bg.classList.add('right');
    g.classList.add('active');
    f.classList.remove('active');
    fc.style.display = 'none';
    gc.style.display = 'block';
  }
}

function filterContacts(q) {
  q = q.trim().toLowerCase();
  if (!q) { renderFriends(); return; }
  const filtered = friendsData.filter(d =>
    d.name.toLowerCase().includes(q) || d.bio.toLowerCase().includes(q)
  );
  renderFriends(filtered);
}

function toggleGroup(hd) {
  const card = hd.parentElement;
  const body = card.querySelector('.ct-group-body');
  const icon = hd.querySelector('.ct-collapse-icon');
  const isCollapsed = card.classList.contains('collapsed');
  if (isCollapsed) {
    card.classList.remove('collapsed');
    body.style.maxHeight = body.scrollHeight + 'px';
    setTimeout(() => { body.style.maxHeight = 'none'; }, 320);
  } else {
    body.style.maxHeight = body.scrollHeight + 'px';
    requestAnimationFrame(() => {
      body.style.maxHeight = '0px';
    });
    card.classList.add('collapsed');
  }
}