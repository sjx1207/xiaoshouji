/* ================================
   Luna Chat — chat.js
================================ */

/* ---- 状态栏时间 & 电量 ---- */
function updateTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeStr = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  ['statusTime','taStatusTime','anonStatusTime','ncTime','futureStatusTime'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = timeStr;
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
    const ids = ['taBatPct','anonBatPct'];
    const innerIds = ['taBatInner','anonBatInner'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = p; });
    innerIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.style.width = p + '%';
        el.style.background = p <= 20
          ? 'linear-gradient(90deg,#f87171,#ef4444)'
          : 'linear-gradient(90deg,#6ee7b7,#34d399)';
      }
    });
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
      <div class="ig-ci ${realType}" data-name="${d.name}" onclick="openChatroom('${d.name}')">
        ${d.pinned ? '<div class="ig-pin-dots"></div>' : ''}
        <div class="ig-ci-av">
          ${avatarHtml(d.name, d.initial)}
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
  switchNcMode('select');  // ← 加这行，默认打开选择面板
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
    createdAt: Date.now(),   // ← 新增：记录创建时间戳
    unread: 0, online: false, pinned: false, type: 'def',
    charId: newId,
  };
  convData.unshift(conv);
  dbSaveConv();
  _avatarCache = null;
  await getAvatarCache();
  renderConvList();
  renderStoryRing();
  closeAddContact();
}

async function ncSaveToCharDB(data) {
  return new Promise(res => {
    const req = indexedDB.open('LunaCharDB', 4);
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

/* ---- LunaChatDB 统一入口（自动建表，永不手动改版本号） ---- */
let _lunaChatDB = null;

const LUNA_STORES = {
  conv:      { keyPath: 'name' },
  friends:   { keyPath: 'name' },
  messages:  { keyPath: 'chatKey' },
  anonCards: { keyPath: 'id', autoIncrement: true },
  taContent: { keyPath: 'charId' },
};

/* ---- 角色头像缓存（name → avatarDataURL 或 null） ---- */
let _avatarCache = null;

async function getAvatarCache() {
  if (_avatarCache) return _avatarCache;
  _avatarCache = {};
  return new Promise(res => {
    const req = indexedDB.open('LunaCharDB');
    req.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('chars')) { res(_avatarCache); return; }
      const r = db.transaction('chars').objectStore('chars').getAll();
      r.onsuccess = () => {
        (r.result || []).forEach(c => {
          _avatarCache[c.name] = c.avatar || null;
        });
        res(_avatarCache);
      };
      r.onerror = () => res(_avatarCache);
    };
    req.onerror = () => res(_avatarCache);
  });
}

/* 根据名字生成头像 HTML：有图片用图片，没有用首字母 */
function avatarHtml(name, initial, extraStyle) {
  const avatar = _avatarCache ? _avatarCache[name] : null;
  const style = extraStyle || '';
  if (avatar) {
    return `<img src="${avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />`;
  }
  return `<span style="${style}">${initial || name[0]}</span>`;
}

function getLunaChatDB() {
  return new Promise((res, rej) => {
    if (_lunaChatDB) { res(_lunaChatDB); return; }

    /* 第一次先用版本0探一下当前版本号 */
    const probe = indexedDB.open('LunaChatDB');
    probe.onsuccess = e => {
      const db = e.target.result;
      const currentVer = db.version;
      const missing = Object.keys(LUNA_STORES).filter(
        name => !db.objectStoreNames.contains(name)
      );
      db.close();

      if (missing.length === 0) {
        /* 所有表都在，直接重新打开用 */
        const reopen = indexedDB.open('LunaChatDB', currentVer);
        reopen.onsuccess = e2 => { _lunaChatDB = e2.target.result; res(_lunaChatDB); };
        reopen.onerror   = () => rej();
      } else {
        /* 有缺失的表，升一个版本让 onupgradeneeded 触发 */
        const upgrade = indexedDB.open('LunaChatDB', currentVer + 1);
        upgrade.onupgradeneeded = e2 => {
          const udb = e2.target.result;
          missing.forEach(name => {
            if (!udb.objectStoreNames.contains(name)) {
              udb.createObjectStore(name, LUNA_STORES[name]);
            }
          });
        };
        upgrade.onsuccess = e2 => { _lunaChatDB = e2.target.result; res(_lunaChatDB); };
        upgrade.onerror   = () => rej();
      }
    };
    probe.onerror = () => rej();
  });
}

function dbSaveConv() {
  getLunaChatDB().then(db => {
    const tx = db.transaction('conv', 'readwrite');
    const store = tx.objectStore('conv');
    const clearReq = store.clear();
    clearReq.onsuccess = function() {
      convData.forEach(d => store.put(d));
    };
  }).catch(() => {});
}

async function dbLoadConv() {
  try {
    const db = await getLunaChatDB();
    return new Promise(res => {
      const r = db.transaction('conv').objectStore('conv').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror   = () => res([]);
    });
  } catch { return []; }
}

function dbSaveFriends() {
  getLunaChatDB().then(db => {
    const tx = db.transaction('friends', 'readwrite');
    const store = tx.objectStore('friends');
    store.clear();
    friendsData.forEach(d => store.put(d));
  }).catch(() => {});
}

async function dbLoadFriends() {
  try {
    const db = await getLunaChatDB();
    return new Promise(res => {
      const r = db.transaction('friends').objectStore('friends').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror   = () => res([]);
    });
  } catch { return []; }
}

function ncNowTime() {
  const now = new Date();
  return now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0');
}

/* ---- 匿名提问卡片持久化 ---- */
async function anonDbSave(card) {
  try {
    const db = await getLunaChatDB();
    return new Promise(res => {
      const tx = db.transaction('anonCards', 'readwrite');
      const req = tx.objectStore('anonCards').add({ ...card, time: Date.now() });
      req.onsuccess = () => res(req.result); // 返回自增id
      tx.onerror = () => res(null);
    });
  } catch { return null; }
}

async function anonDbLoadByChar(charName) {
  try {
    const db = await getLunaChatDB();
    return new Promise(res => {
      const r = db.transaction('anonCards').objectStore('anonCards').getAll();
      r.onsuccess = () => res((r.result || []).filter(c => c.charName === charName));
      r.onerror = () => res([]);
    });
  } catch { return []; }
}

async function anonDbDeleteById(id) {
  try {
    const db = await getLunaChatDB();
    return new Promise(res => {
      const tx = db.transaction('anonCards', 'readwrite');
      tx.objectStore('anonCards').delete(id);
      tx.oncomplete = () => res();
    });
  } catch { }
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
    const req = indexedDB.open('LunaCharDB', 4);
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
  const selCountEl = document.getElementById('ncSelCount');
  if (selCountEl) selCountEl.textContent = _ncSelected.size;
}

async function ncImportSelected() {
  if (_ncSelected.size === 0) return;

  // forEach 不支持 async，改用 for...of
  for (const key of _ncSelected) {
    const [type, ...rest] = key.split('_');
    let item;
    if (type === 'char') {
      const id = parseInt(rest[0]);
      item = _ncAllItems.find(i => i.type === 'char' && i.data.id === id);
    } else {
      item = _ncAllItems.find((i, idx) => {
        const k = `npc_${i.charId}_${idx}`;
        return k === key;
      });
    }
    if (!item) continue;
    const d = item.data;
    const name = d.name || '未命名';

    if (!convData.find(c => c.name === name)) {
      convData.unshift({
        name,
        initial: name[0],
        preview: d.role || d.relDesc?.slice(0, 18) || (type === 'npc' ? `来自 ${item.charName}` : '角色'),
        time: ncNowTime(),
        timeVal: Date.now(),
        createdAt: Date.now(),
        unread: 0, online: false, pinned: false,
        type: 'def',
      });
    }

    if (!friendsData.find(c => c.name === name)) {
      const letter = name[0].toUpperCase();
      friendsData.push({
        name,
        initial: name[0],
        bio: d.role || d.relDesc?.slice(0, 30) || (type === 'npc' ? `来自 ${item.charName}` : '角色'),
        group: letter,
        style: '',
        online: false,
        tag: '',
      });
    }
  }

  dbSaveConv();
  dbSaveFriends();
  _avatarCache = null;
  await getAvatarCache();
  renderConvList();
  renderStoryRing();
  renderFriends();
  closeAddContact();
}

function openNewPost()    { console.log('new post'); }

/* ---- 初始化 ---- */
document.addEventListener('DOMContentLoaded', async () => {
  updateTime();
  updateBattery();
  setInterval(updateTime, 1000);

  // 先加载头像缓存，再恢复列表数据，确保渲染时头像已就绪
  await getAvatarCache();

  const savedConv    = await dbLoadConv();
  const savedFriends = await dbLoadFriends();
  convData.push(...savedConv);
  friendsData.push(...savedFriends);

  /* renderConvList 由 pageshow 统一调用，这里不重复调用 */
  renderMoments();
  switchTab('messages');
  const firstBtn = document.getElementById('tabMessages');
  if (firstBtn) moveArc(firstBtn);
  applyGlobalFont();
  applyIsland();
  renderStoryRing();
  renderFriends();
  renderGroups();
  window._domReady = true;
});

/* ---- Ta眼中的我 · 页面开关 ---- */
function openTaPage() {
  const page    = document.getElementById('taPage');
  const overlay = document.getElementById('taOverlay');
  if (!page) return;

  page.classList.add('active');
  if (overlay) overlay.classList.add('active');

  // 同步时间
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeEl = document.getElementById('taStatusTime');
  if (timeEl) timeEl.textContent = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });

  // 同步电量
  const mainPct   = document.getElementById('batPct');
  const mainInner = document.getElementById('batInner');
  const taPct     = document.getElementById('taBatPct');
  const taInner   = document.getElementById('taBatInner');
  if (taPct && mainPct)     taPct.textContent       = mainPct.textContent;
  if (taInner && mainInner) {
    taInner.style.width      = mainInner.style.width;
    taInner.style.background = mainInner.style.background;
  }

  // 同步灵动岛
  const enabled  = localStorage.getItem('luna_island_enabled') === 'true';
  const style    = localStorage.getItem('luna_island_style') || 'minimal';
  const islandEl = document.getElementById('taStatusIsland');
  if (islandEl) {
    if (!enabled) { islandEl.innerHTML = ''; }
    else {
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
      islandEl.innerHTML = styleMap[style] || styleMap.minimal;
    }
  }
}

function closeTaPage() {
  const page    = document.getElementById('taPage');
  const overlay = document.getElementById('taOverlay');
  if (page)    page.classList.remove('active');
  if (overlay) overlay.classList.remove('active');
}

function applyIslandTo(targetId) {
  const src = document.getElementById('statusIsland');
  const dst = document.getElementById(targetId);
  if (!dst) return;
  dst.innerHTML = src ? src.innerHTML : '';
}

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
        const req = indexedDB.open('LunaFontDB', 4);
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

window.addEventListener('pageshow', async function(e) {
  const dirty = localStorage.getItem('luna_conv_dirty');
  if (dirty === '1') {
    /* 从chatroom返回：重新读DB刷新列表 */
    localStorage.removeItem('luna_conv_dirty');
    _avatarCache = null;
    await getAvatarCache();
    const fresh = await dbLoadConv();
    convData.length = 0;
    convData.push(...fresh);
    renderConvList();
  } else if (e.persisted) {
    /* bfcache恢复：整页reload */
    window.location.reload();
  } else {
    /* 正常首次加载：等DOMContentLoaded把数据填好再渲染 */
    const waitReady = () => new Promise(r => {
      if (window._domReady) { r(); return; }
      const t = setInterval(() => { if (window._domReady) { clearInterval(t); r(); } }, 20);
    });
    await waitReady();
    renderConvList();
  }
});

function renderStoryRing() {
  /* 显示全部好友（不过滤online，因为所有AI角色默认都在线） */
  const data = friendsData;
  const el = document.getElementById('storyRingList');
  if (!el) return;
  if (data.length === 0) {
    el.innerHTML = `<div style="color:#ccc;font-size:12px;padding:8px 4px;display:flex;align-items:center;gap:4px;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2" stroke-linecap="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
      </svg>
      暂无好友
    </div>`;
    return;
  }
  el.innerHTML = data.map(d => `
    <div class="ig-av-item" onclick="openFriendPopup('${d.name}')" style="cursor:pointer">
      <div class="ig-av-ring live">
        <div class="ig-ci-av">
          ${avatarHtml(d.name, d.initial)}
          <div class="ig-ci-dot"></div>
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
  dbSaveConv();
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
    dbSaveConv();
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
          <div class="ct-item" onclick="openCharProfile('${d.name}')" style="cursor:pointer">
            <div class="ct-av">
              <div class="ct-av-inner ${d.style}">${avatarHtml(d.name, d.initial)}</div>
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

/* 灵动岛同步 */
function crApplyIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const el      = document.getElementById('statusIsland');
  if (!el) return;
  if (!enabled) { el.innerHTML = ''; return; }
  const templates = {
    minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
    clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="siClockText">--:--</span></div></div>`,
    pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
    ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
    rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
    music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
    scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
  };
  el.innerHTML = templates[style] || templates.minimal;
}
crApplyIsland();

/* 监听 index 页面的灵动岛设置变化 */
window.addEventListener('storage', function(e) {
  if (e.key === 'luna_island_update' || e.key === 'luna_island_enabled' || e.key === 'luna_island_style') {
    crApplyIsland();
  }
});

function openChatroom(name) {
  localStorage.setItem('luna_island_enabled', localStorage.getItem('luna_island_enabled') || 'false');
  localStorage.setItem('luna_island_style',   localStorage.getItem('luna_island_style')   || 'minimal');
  localStorage.setItem('luna_font_active_name', localStorage.getItem('luna_font_active_name') || '');
  localStorage.setItem('luna_font_active_id',   localStorage.getItem('luna_font_active_id')   || '');
  localStorage.setItem('luna_current_chat', name);
  window.location.href = 'chatroom.html';
}

/* ================================
   角色资料页逻辑
================================ */

/* 从 LunaCharDB 按名字查找角色数据 */
async function getCharDataByName(name) {
  return new Promise(res => {
    const req = indexedDB.open('LunaCharDB', 4);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('chars'))
        d.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('chars')) { res(null); return; }
      const r = db.transaction('chars').objectStore('chars').getAll();
      r.onsuccess = () => {
        const found = (r.result || []).find(c => c.name === name);
        res(found || null);
      };
      r.onerror = () => res(null);
    };
    req.onerror = () => res(null);
  });
}

/* 用角色数据填充 cp-page 的各个字段 */
function fillCharProfile(charData, name) {
  // 头像
  const avatarWrap = document.querySelector('.cp-avatar-wrap');
  if (avatarWrap) {
    if (charData?.avatar) {
      avatarWrap.innerHTML = `<img src="${charData.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;"/><div class="cp-avatar-deco"></div>`;
    } else {
      avatarWrap.innerHTML = `${(name || '?')[0]}<div class="cp-avatar-deco"></div>`;
    }
  }

  // 名字 & handle/role
  const nameEl   = document.querySelector('.cp-profile-name');
  const handleEl = document.querySelector('.cp-profile-handle');
  if (nameEl)   nameEl.textContent   = charData?.name   || name || '—';
  if (handleEl) handleEl.textContent = `@ ${(charData?.name || name || '').toLowerCase()} · ${charData?.role || '角色'}`;

  // 统计栏（动态数/性别/年龄/生日）
  const statNums = document.querySelectorAll('.cp-stat-item .cp-stat-num');
  if (statNums[0]) statNums[0].textContent = charData?.postCount  || '0';
  if (statNums[1]) statNums[1].textContent = charData?.gender     || '—';
  if (statNums[2]) statNums[2].textContent = charData?.age        || '—';
  if (statNums[3]) statNums[3].textContent = charData?.birthday   || '—';

  // bio
  const bioEl = document.querySelector('.cp-bio');
  if (bioEl) bioEl.textContent = charData?.desc || '暂无介绍';

  // 性格标签
  const traitRow = document.querySelector('.cp-trait-row');
  if (traitRow) {
    const traits = charData?.traits || [];
    if (traits.length > 0) {
      traitRow.innerHTML = traits.map(t => `<div class="cp-trait-pill">${t}</div>`).join('');
    } else {
      traitRow.innerHTML = '<div class="cp-trait-pill">暂无标签</div>';
    }
  }

  // 动态卡片里的名字和头像
  const mmtAv   = document.querySelector('.cp-mmt-av');
  const mmtName = document.querySelector('.cp-mmt-name');
  if (mmtAv) {
    if (charData?.avatar) {
      mmtAv.innerHTML = `<img src="${charData.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;
      mmtAv.style.fontSize = '0';
    } else {
      mmtAv.textContent = (charData?.name || name || '?')[0];
    }
  }
  if (mmtName) mmtName.textContent = charData?.name || name || '—';

  // 近期动态内容（从 charData.moments 读取）
  const mmtText = document.querySelector('.cp-mmt-text');
  const mmtTime = document.querySelector('.cp-mmt-time');
  if (charData?.moments && charData.moments.length > 0) {
    const latest = charData.moments[0];
    if (mmtText) mmtText.innerHTML = latest.text || '暂无动态';
    if (mmtTime) mmtTime.textContent = (latest.timeLabel || '最近') + ' · ' + (latest.category || '日常');
    // 点赞数和评论数
    const reactItems = document.querySelectorAll('.cp-react-item');
    if (reactItems[0]) reactItems[0].innerHTML = `<div class="cp-react-dot"></div>${latest.likes || 0}`;
    if (reactItems[1]) reactItems[1].innerHTML = `<div class="cp-react-dot"></div>${latest.comments || 0}`;
  } else {
    if (mmtText) mmtText.innerHTML = '暂无动态内容';
    if (mmtTime) mmtTime.textContent = '— · 日常';
    const reactItems = document.querySelectorAll('.cp-react-item');
    if (reactItems[0]) reactItems[0].innerHTML = `<div class="cp-react-dot"></div>0`;
    if (reactItems[1]) reactItems[1].innerHTML = `<div class="cp-react-dot"></div>0`;
  }

  // "Ta 眼中的我" 描述里的名字
  const eyesQuote = document.querySelector('.cp-eyes-quote');
  if (eyesQuote) {
    eyesQuote.textContent = `"让 ${charData?.name || name || 'TA'} 描述你在TA眼中的样子……"`;
  }

  // 封面颜色配色（按 charData.color）
  const colorMap = {
    warm:  'linear-gradient(135deg,#c9b89a 0%,#b8a78a 100%)',
    cool:  'linear-gradient(135deg,#8fa3a8 0%,#7e9298 100%)',
    gold:  'linear-gradient(135deg,#b8a47a 0%,#a8946a 100%)',
    ash:   'linear-gradient(135deg,#9d9d9d 0%,#8d8d8d 100%)',
    mist:  'linear-gradient(135deg,#a8b5a0 0%,#98a590 100%)',
    blush: 'linear-gradient(135deg,#c4a5a0 0%,#b49590 100%)',
  };
  const cover = document.querySelector('.cp-hero-cover');
  if (cover && charData?.color && colorMap[charData.color]) {
    cover.style.background = colorMap[charData.color];
  } else if (cover) {
    cover.style.background = '';  // 恢复默认 CSS
  }

  // 背景图（如果角色有 cardBg）
  if (cover && charData?.cardBg) {
    cover.style.backgroundImage = `url(${charData.cardBg})`;
    cover.style.backgroundSize  = 'cover';
    cover.style.backgroundPosition = 'center';
  } else if (cover) {
    cover.style.backgroundImage = '';
  }

  // "与TA对话"按钮绑定该角色名
  const talkBtn = document.querySelector('.cp-follow-btn');
  if (talkBtn) {
    talkBtn.onclick = () => { closeCharProfile(); openChatroom(name); };
  }
}

async function openCharProfile(name) {
  _cpCurrentName = name;              // ← 加这一行
  const page    = document.getElementById('cpPage');
  const overlay = document.getElementById('cpOverlay');
  if (!page) return;

  // 先读角色数据，再填充，避免闪烁
  const charData = await getCharDataByName(name);
  fillCharProfile(charData, name);

  page.classList.add('active');
  if (overlay) overlay.classList.add('active');

  // 同步状态栏时间
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeEl = document.getElementById('cpStatusTime');
  if (timeEl) timeEl.textContent = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });

  // 同步电量
  const pctEl   = document.getElementById('cpBatPct');
  const innerEl = document.getElementById('cpBatInner');
  const mainPct = document.getElementById('batPct');
  const mainInner = document.getElementById('batInner');
  if (pctEl && mainPct) pctEl.textContent = mainPct.textContent;
  if (innerEl && mainInner) {
    innerEl.style.width      = mainInner.style.width;
    innerEl.style.background = mainInner.style.background;
  }

  // 同步灵动岛
  const enabled  = localStorage.getItem('luna_island_enabled') === 'true';
  const style    = localStorage.getItem('luna_island_style') || 'minimal';
  const islandEl = document.getElementById('cpStatusIsland');
  if (islandEl) {
    if (!enabled) { islandEl.innerHTML = ''; }
    else {
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
      islandEl.innerHTML = styleMap[style] || styleMap.minimal;
    }
  }
}

function closeCharProfile() {
  document.getElementById('cpPage')?.classList.remove('active');
  document.getElementById('cpOverlay')?.classList.remove('active');
}

// 打开弹窗（绑定到好友头像点击事件）
let _fwCurrentName = null;  // 记录当前弹窗打开的是哪个好友

async function openFriendPopup(name) {
  _fwCurrentName = name;  // 保存当前人名，供发消息/查看主页使用
  const charData = await getCharDataByName(name);

  // 填名字
  const nameEl = document.getElementById('fwName');
  const handleEl = document.getElementById('fwHandle');
  if (nameEl) nameEl.textContent = charData?.name || name || '—';
  if (handleEl) handleEl.textContent = `@${(charData?.name || name || '').toLowerCase()}`;

  // 填头像（如果有图片就显示图片，没有就显示首字母）
  const avatarEl = document.getElementById('fwAvatar');
  if (avatarEl) {
    if (charData?.avatar) {
      avatarEl.innerHTML = `<img src="${charData.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;
    } else {
      avatarEl.textContent = (charData?.name || name || '?')[0];
    }
  }

  // 同步封面背景颜色和背景图
  const fwCover = document.querySelector('.fw-cover');
  if (fwCover) {
    const colorMap = {
      warm:  'linear-gradient(135deg,#c9b89a 0%,#b8a78a 100%)',
      cool:  'linear-gradient(135deg,#8fa3a8 0%,#7e9298 100%)',
      gold:  'linear-gradient(135deg,#b8a47a 0%,#a8946a 100%)',
      ash:   'linear-gradient(135deg,#9d9d9d 0%,#8d8d8d 100%)',
      mist:  'linear-gradient(135deg,#a8b5a0 0%,#98a590 100%)',
      blush: 'linear-gradient(135deg,#c4a5a0 0%,#b49590 100%)',
    };
    // 先重置
    fwCover.style.background = '';
    fwCover.style.backgroundImage = '';
    // 填颜色
    if (charData?.color && colorMap[charData.color]) {
      fwCover.style.background = colorMap[charData.color];
    }
    // 填背景图（优先级最高，会覆盖颜色）
    if (charData?.cardBg) {
      fwCover.style.backgroundImage = `url(${charData.cardBg})`;
      fwCover.style.backgroundSize = 'cover';
      fwCover.style.backgroundPosition = 'center';
    }
  }

  document.getElementById('fwOverlay').classList.add('active');
}

// 发消息按钮：关闭弹窗，直接跳转聊天室
function fwSendMessage() {
  document.getElementById('fwOverlay').classList.remove('active');
  if (_fwCurrentName) openChatroom(_fwCurrentName);
}

// 查看主页按钮：关闭弹窗，打开角色主页
function fwViewProfile() {
  document.getElementById('fwOverlay').classList.remove('active');
  if (_fwCurrentName) openCharProfile(_fwCurrentName);
}

// 关闭
document.getElementById('fwClose').addEventListener('click', () => {
  document.getElementById('fwOverlay').classList.remove('active');
});
document.getElementById('fwOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    e.currentTarget.classList.remove('active');
  }
});

/* ================================
   匿名提问页逻辑
================================ */
let _anonCurrentName = null;
let _anonQCount = 1;

function openAnonPage() {
  const charName = _fwCurrentName || (typeof _cpCurrentName !== 'undefined' ? _cpCurrentName : null);
  _anonCurrentName = charName;

  const page    = document.getElementById('anonPage');
  const overlay = document.getElementById('anonOverlay');
  if (!page) return;

  // 填充提问对象头像和名字
  const avEl   = document.getElementById('anonTgtAv');
  const nameEl = document.getElementById('anonTgtName');
  if (nameEl) nameEl.textContent = charName || '—';
  if (avEl) {
    // 先写首字，保留虚线圆圈
    avEl.childNodes[0].nodeValue = charName ? charName[0] : '?';
    // 异步同步背景色
    if (charName) {
      getCharDataByName(charName).then(charData => {
        const colorMap = {
          warm:'#b8956a', cool:'#6a8fa8', gold:'#a8843a',
          ash:'#888888', mist:'#7a9870', blush:'#a87070',
        };
        avEl.style.background = (charData?.color && colorMap[charData.color]) || 'rgba(255,255,255,0.18)';
      });
    }
  }

  // NPC 卡 from 字段
  const fromEl = document.getElementById('anonNpcFrom1');
  if (fromEl) fromEl.textContent = '来自 · ' + (charName || '—');

  anonLoadHistory(charName);
  page.classList.add('active');
  if (overlay) overlay.classList.add('active');

  // 同步状态栏时间
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeEl = document.getElementById('anonStatusTime');
  if (timeEl) timeEl.textContent = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });

  // 同步电量
  const pctEl    = document.getElementById('anonBatPct');
  const innerEl  = document.getElementById('anonBatInner');
  const mainPct  = document.getElementById('batPct');
  const mainInner = document.getElementById('batInner');
  if (pctEl && mainPct) pctEl.textContent = mainPct.textContent;
  if (innerEl && mainInner) {
    innerEl.style.width      = mainInner.style.width;
    innerEl.style.background = mainInner.style.background;
  }

  // 同步灵动岛
  const enabled  = localStorage.getItem('luna_island_enabled') === 'true';
  const style    = localStorage.getItem('luna_island_style') || 'minimal';
  const islandEl = document.getElementById('anonStatusIsland');
  if (islandEl) {
    if (!enabled) { islandEl.innerHTML = ''; }
    else {
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
      islandEl.innerHTML = styleMap[style] || styleMap.minimal;
    }
  }

  // 同步字体
  const fontTag = document.getElementById('luna-font-override');
  const anonFontTag = document.getElementById('luna-font-override-anon');
  if (fontTag) {
    let tag = anonFontTag;
    if (!tag) {
      tag = document.createElement('style');
      tag.id = 'luna-font-override-anon';
      document.getElementById('anonPage').appendChild(tag);
    }
    tag.textContent = fontTag.textContent;
  }
}

function closeAnonPage() {
  document.getElementById('anonPage')?.classList.remove('active');
  document.getElementById('anonOverlay')?.classList.remove('active');
  closeAnonCompose();
}

function openAnonCompose() {
  document.getElementById('anonMask').classList.add('open');
}

function closeAnonCompose() {
  document.getElementById('anonMask')?.classList.remove('open');
}

function anonDoSend() {
  const ta = document.getElementById('anonTa');
  const v  = ta ? ta.value.trim() : '';
  if (!v) { if (ta) ta.focus(); return; }
  _anonQCount++;
  const card = document.createElement('div');
  card.className = 'anon-cu';
  card.style.animationDelay = '0s';
  card.innerHTML = `
  <div class="anon-cu-accent"></div>
  <div class="anon-cu-inner">
    <div class="anon-cu-row1">
      <div class="anon-cu-av"><div class="anon-cu-dot-b"></div><div class="anon-cu-dot-s"></div></div>
      <div style="flex:1;">
        <div class="anon-cu-who">匿名用户</div>
        <div class="anon-cu-time">刚刚</div>
      </div>
      <div class="anon-cu-idx"><div class="anon-cu-idxline"></div><div class="anon-cu-idxnum">Q · 0${_anonQCount}</div></div>
    </div>
    <div class="anon-cu-q">${v}</div>
    <div class="anon-cu-foot">
      <div class="anon-cu-ans" onclick="anonShowAnswer(this)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        查看 TA 的答案
      </div>
      <div class="anon-cu-status">待回答</div>
    </div>
    <div class="anon-ans-box" style="display:none;margin-top:10px;padding:10px 12px;background:#f7f7f7;border-radius:10px;font-size:13px;color:#333;line-height:1.7;border-top:0.5px solid rgba(0,0,0,0.05);"></div>
  </div>`;
  document.getElementById('anonFeed').prepend(card);
  anonDbSave({ charName: _anonCurrentName, type: 'user', q: v, a: '' }).then(newId => {
    if (newId) card.dataset.dbId = newId;
  });
  const tip = document.getElementById('anonEmptyTip');
  if (tip) tip.style.display = 'none';
  ta.value = '';
  document.getElementById('anonLen').textContent = '0 / 200';
  closeAnonCompose();
}

// 进入删除模式
function anonEnterDeleteMode() {
  const feed = document.getElementById('anonFeed');
  const bar  = document.getElementById('anonDeleteBar');
  const btn  = document.getElementById('anonDeleteBtn');
  if (!feed) return;

  // 操作栏显示
  bar.style.display = 'flex';
  // 删除按钮变红提示
  btn.style.background = '#fee';
  btn.style.borderColor = 'rgba(200,0,0,0.15)';
  btn.querySelector('svg').setAttribute('stroke', '#c00');

  // 给每张卡片左侧加复选框
  const cards = feed.querySelectorAll('.anon-cu, .anon-cn');
  cards.forEach(card => {
    if (card.id === 'anonEmptyTip') return;
    card.style.position = 'relative';
    card.style.paddingLeft = '36px';
    card.style.transition = 'padding 0.2s ease';
    const cb = document.createElement('div');
    cb.className = 'anon-cb';
    cb.style.cssText = 'position:absolute;left:10px;top:50%;transform:translateY(-50%);width:18px;height:18px;border-radius:50%;border:1.5px solid #ccc;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.15s ease;';
    cb.onclick = () => anonToggleCard(card, cb);
    card.insertBefore(cb, card.firstChild);
  });

  anonUpdateCount();
}

// 切换单张卡片选中状态
function anonToggleCard(card, cb) {
  const selected = card.dataset.selected === '1';
  if (selected) {
    card.dataset.selected = '0';
    card.style.opacity = '1';
    cb.style.background = '#fff';
    cb.style.borderColor = '#ccc';
    cb.innerHTML = '';
  } else {
    card.dataset.selected = '1';
    card.style.opacity = '0.6';
    cb.style.background = '#111';
    cb.style.borderColor = '#111';
    cb.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>';
  }
  anonUpdateCount();
}

// 全选
function anonSelectAll() {
  const feed = document.getElementById('anonFeed');
  const cards = feed.querySelectorAll('.anon-cu, .anon-cn');
  const allSelected = [...cards].every(c => c.dataset.selected === '1');
  cards.forEach(card => {
    const cb = card.querySelector('.anon-cb');
    if (!cb) return;
    if (allSelected) {
      card.dataset.selected = '0';
      card.style.opacity = '1';
      cb.style.background = '#fff';
      cb.style.borderColor = '#ccc';
      cb.innerHTML = '';
    } else {
      card.dataset.selected = '1';
      card.style.opacity = '0.6';
      cb.style.background = '#111';
      cb.style.borderColor = '#111';
      cb.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>';
    }
  });
  anonUpdateCount();
}

// 更新已选计数
function anonUpdateCount() {
  const feed = document.getElementById('anonFeed');
  const n = feed.querySelectorAll('[data-selected="1"]').length;
  const el = document.getElementById('anonSelectedCount');
  if (el) el.textContent = '已选 ' + n + ' 条';
}

// 取消删除模式
function anonCancelDelete() {
  const feed = document.getElementById('anonFeed');
  const bar  = document.getElementById('anonDeleteBar');
  const btn  = document.getElementById('anonDeleteBtn');

  bar.style.display = 'none';
  btn.style.background = '#fff';
  btn.style.borderColor = 'rgba(0,0,0,0.1)';
  btn.querySelector('svg').setAttribute('stroke', '#777');

  // 移除所有复选框，恢复卡片样式
  feed.querySelectorAll('.anon-cu, .anon-cn').forEach(card => {
    card.dataset.selected = '0';
    card.style.opacity = '1';
    card.style.paddingLeft = '';
    card.querySelector('.anon-cb')?.remove();
  });
}

// 确认删除选中的卡片
function anonConfirmDelete() {
  const feed = document.getElementById('anonFeed');
  const selected = feed.querySelectorAll('[data-selected="1"]');
  if (selected.length === 0) { anonCancelDelete(); return; }

  selected.forEach(card => {
      // 同步删DB
      const dbId = parseInt(card.dataset.dbId);
      if (dbId) anonDbDeleteById(dbId);

      card.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      card.style.opacity = '0';
      card.style.transform = 'translateX(20px)';
      setTimeout(() => card.remove(), 220);
  });

  setTimeout(() => {
    anonCancelDelete();
    // 如果全删完了，重新显示空状态
    const remaining = feed.querySelectorAll('.anon-cu, .anon-cn');
    if (remaining.length === 0) {
      const tip = document.getElementById('anonEmptyTip');
      if (tip) tip.style.display = '';
    }
  }, 250);
}

function anonShowAnswer(btn) {
  const card   = btn.closest('.anon-cu, .anon-cn');
  if (!card) return;
  const ansBox = card.querySelector('.anon-ans-box');
  if (!ansBox) return;

  // 已展开就折叠
  if (ansBox.style.display !== 'none') {
    ansBox.style.display = 'none';
    return;
  }

  ansBox.style.display = 'block';

  // 如果已经有文字内容（请求过）就不重复
  if (ansBox.textContent.trim() && !ansBox.querySelector('.anon-typing-dot')) return;

  // NPC卡：答案已经存在 data-preset 里，直接打字机显示，不调API
  const preset = ansBox.dataset.preset;
  if (preset) {
    const text = decodeURIComponent(preset);
    ansBox.innerHTML = '';
    let i = 0;
    const timer = setInterval(() => {
      ansBox.textContent += text[i];
      i++;
      if (i >= text.length) clearInterval(timer);
    }, 35);
    return;
  }

  // 用户卡：实时调用API生成回答
  const q = card.querySelector('.anon-cu-q, .anon-cn-q')?.textContent?.trim() || '';
  anonAskAI(q, ansBox);
}

// 防止重复点击
let _anonNpcGenerating = false;

function anonSpinNpc(btn) {
  if (_anonNpcGenerating) return;

  // 转圈动画
  btn.style.transition = 'transform 0.5s ease';
  btn.style.transform  = 'rotate(360deg)';
  setTimeout(() => { btn.style.transform = ''; btn.style.transition = ''; }, 520);

  const cur   = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  if (!cur.baseUrl || !cur.apiKey || !model) {
    alert('请先在设置页配置API');
    return;
  }

  _anonNpcGenerating = true;
  const name     = _anonCurrentName || '—';
  const charName = _anonCurrentName;

  // 先读角色数据再生成
  new Promise(res => {
    const req = indexedDB.open('LunaCharDB', 4);
    req.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('chars')) { res(null); return; }
      const r = db.transaction('chars').objectStore('chars').getAll();
      r.onsuccess = () => res((r.result || []).find(c => c.name === charName) || null);
      r.onerror = () => res(null);
    };
    req.onerror = () => res(null);
  }).then(async charData => {

    const traits = (charData?.traits || []).join('、') || '未知';
    const systemPrompt = `你是一个擅长写网感剧情的创作者，风格犀利、有爆点、有悬念感。
现在为角色【${charData?.name || name}】生成5条匿名提问+角色回答。

角色信息：
- 名字：${charData?.name || name}
- 身份：${charData?.role || '未知'}
- 性格：${traits}
- 简介：${charData?.desc || '暂无'}

提问风格要求：
- 像真实社交平台上最敢问的那种人，直接戳角色痛处、黑历史、心虚的事、关系里的疑点
- 问题要有画面感，让人看了想知道答案，有点八卦有点狠
- 可以涉及：过去的关系、做过的选择、别人对他的评价、他自己都不承认的事

回答风格要求：
- 符合角色人设，语气自然像真人
- 可以是：高冷否认、半承认、反将一军、破防一秒又收回来、用玩笑掩盖真实情绪
- 有信息量，让人看完还想追问，不能是废话

字数要求：问题30-50字，回答80-120字，要有细节和层次感

严格按以下JSON格式输出，只输出JSON不要有其他文字：
[
  {"q":"问题1","a":"回答1"},
  {"q":"问题2","a":"回答2"},
  {"q":"问题3","a":"回答3"},
  {"q":"问题4","a":"回答4"},
  {"q":"问题5","a":"回答5"}
]`;

    // 显示loading卡
    const feed = document.getElementById('anonFeed');
    const loadingCard = document.createElement('div');
    loadingCard.id = 'anonNpcLoading';
    loadingCard.style.cssText = 'text-align:center;padding:24px 0;color:#ccc;font-size:12px;letter-spacing:0.08em;';
    loadingCard.innerHTML = '<span class="anon-typing-dot"></span><span class="anon-typing-dot"></span><span class="anon-typing-dot"></span>';
    feed.prepend(loadingCard);
    const tip = document.getElementById('anonEmptyTip');
    if (tip) tip.style.display = 'none';

    try {
      const resp = await fetch(`${cur.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cur.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: systemPrompt }],
          max_tokens: 2000,
          stream: false
        })
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data  = await resp.json();
      let raw = data.choices?.[0]?.message?.content?.trim() || '[]';

      // 容错：去掉可能的markdown代码块包裹
      raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/,'').trim();
      const items = JSON.parse(raw);

      // 移除loading
      loadingCard.remove();

      // 批量插入卡片（倒序插入，最终显示顺序正常）
      [...items].reverse().forEach(item => {
        const card = document.createElement('div');
        card.className = 'anon-cn';
        card.innerHTML = `
          <div class="anon-cn-stripe"></div>
          <div class="anon-cn-inner">
            <div class="anon-cn-row1">
              <div class="anon-cn-av"><div class="anon-cn-av-grid"><div></div><div></div><div></div><div></div></div></div>
              <div style="flex:1;">
                <div class="anon-cn-name">匿名用户</div>
                <div class="anon-cn-from">来自 · 未知</div>
                <div class="anon-cn-badge">NPC QUESTION</div>
              </div>
            </div>
            <div class="anon-cn-qblock">
              <div class="anon-cn-q">${item.q}</div>
            </div>
            <div class="anon-cn-foot">
              <div class="anon-cn-ans" onclick="anonShowAnswer(this)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                查看 TA 的答案
              </div>
              <div class="anon-cn-tag">匿名 · NPC</div>
            </div>
            <div class="anon-ans-box" data-preset="${encodeURIComponent(item.a)}" style="display:none;margin-top:10px;padding:10px 12px;background:#f7f7f7;border-radius:10px;font-size:13px;color:#333;line-height:1.7;border-top:0.5px solid rgba(0,0,0,0.05);"></div>
          </div>`;
        feed.prepend(card);
        anonDbSave({ charName: _anonCurrentName, type: 'npc', q: item.q, a: item.a }).then(newId => {
          if (newId) card.dataset.dbId = newId;
        });
      });

    } catch(e) {
      loadingCard.remove();
      const errCard = document.createElement('div');
      errCard.style.cssText = 'text-align:center;padding:16px;color:#f87171;font-size:12px;';
      errCard.textContent = '生成失败：' + e.message;
      feed.prepend(errCard);
      setTimeout(() => errCard.remove(), 3000);
    } finally {
      _anonNpcGenerating = false;
    }
  });
}

// textarea 字数统计
document.addEventListener('DOMContentLoaded', () => {
  const ta  = document.getElementById('anonTa');
  const len = document.getElementById('anonLen');
  if (ta && len) {
    ta.addEventListener('input', () => { len.textContent = ta.value.length + ' / 200'; });
  }
});

async function anonLoadHistory(charName) {
  if (!charName) return;
  const feed = document.getElementById('anonFeed');
  if (!feed) return;

  const cards = await anonDbLoadByChar(charName);
  if (!cards.length) return;

  // 清空空状态提示
  const tip = document.getElementById('anonEmptyTip');
  if (tip) tip.style.display = 'none';

  // 清除上一次渲染（避免重复）
  feed.querySelectorAll('.anon-cu, .anon-cn').forEach(el => el.remove());

  // 按时间正序渲染（最新在最上用 prepend 倒着插）
  [...cards].sort((a,b) => a.time - b.time).forEach(card => {
    const el = document.createElement('div');

    if (card.type === 'user') {
      el.className = 'anon-cu';
      el.dataset.dbId = card.id;
      el.innerHTML = `
        <div class="anon-cu-accent"></div>
        <div class="anon-cu-inner">
          <div class="anon-cu-row1">
            <div class="anon-cu-av"><div class="anon-cu-dot-b"></div><div class="anon-cu-dot-s"></div></div>
            <div style="flex:1;">
              <div class="anon-cu-who">匿名用户</div>
              <div class="anon-cu-time">${new Date(card.time).toLocaleDateString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
            </div>
          </div>
          <div class="anon-cu-q">${card.q}</div>
          <div class="anon-cu-foot">
            <div class="anon-cu-ans" onclick="anonShowAnswer(this)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              查看 TA 的答案
            </div>
            <div class="anon-cu-status">待回答</div>
          </div>
          <div class="anon-ans-box" ${card.a ? `data-preset="${encodeURIComponent(card.a)}"` : ''} style="display:none;margin-top:10px;padding:10px 12px;background:#f7f7f7;border-radius:10px;font-size:13px;color:#333;line-height:1.7;border-top:0.5px solid rgba(0,0,0,0.05);"></div>
        </div>`;
    } else {
      el.className = 'anon-cn';
      el.dataset.dbId = card.id;
      el.innerHTML = `
        <div class="anon-cn-stripe"></div>
        <div class="anon-cn-inner">
          <div class="anon-cn-row1">
            <div class="anon-cn-av"><div class="anon-cn-av-grid"><div></div><div></div><div></div><div></div></div></div>
            <div style="flex:1;">
              <div class="anon-cn-name">匿名用户</div>
              <div class="anon-cn-from">来自 · 未知</div>
              <div class="anon-cn-badge">NPC QUESTION</div>
            </div>
          </div>
          <div class="anon-cn-qblock">
            <div class="anon-cn-q">${card.q}</div>
          </div>
          <div class="anon-cn-foot">
            <div class="anon-cn-ans" onclick="anonShowAnswer(this)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              查看 TA 的答案
            </div>
            <div class="anon-cn-tag">匿名 · NPC</div>
          </div>
          <div class="anon-ans-box" data-preset="${encodeURIComponent(card.a)}" style="display:none;margin-top:10px;padding:10px 12px;background:#f7f7f7;border-radius:10px;font-size:13px;color:#333;line-height:1.7;border-top:0.5px solid rgba(0,0,0,0.05);"></div>
        </div>`;
    }

    feed.prepend(el);
  });
}

/* ================================
   匿名提问 → 调用AI生成角色回答
================================ */
async function anonAskAI(question, answerEl) {
  // 1. 读API配置
  const cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  if (!cur.baseUrl || !cur.apiKey || !model) {
    answerEl.innerHTML = '<span style="color:#aaa;font-size:12px;">未配置API，请前往设置页配置</span>';
    return;
  }

  // 2. 读角色数据（从LunaCharDB）
  const charName = _anonCurrentName;
  let charData = null;
  if (charName) {
    charData = await new Promise(res => {
      const req = indexedDB.open('LunaCharDB', 4);
      req.onsuccess = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('chars')) { res(null); return; }
        const r = db.transaction('chars').objectStore('chars').getAll();
        r.onsuccess = () => res((r.result || []).find(c => c.name === charName) || null);
        r.onerror = () => res(null);
      };
      req.onerror = () => res(null);
    });
  }

  // 3. 拼装角色人设 system prompt
  const traits = (charData?.traits || []).join('、') || '未知';
  const systemPrompt = `你现在扮演角色【${charData?.name || charName || '未知'}】，请严格按照以下人设回答问题，禁止出戏(OOC)，禁止以AI身份回复，只能以角色第一人称回答。
角色名：${charData?.name || charName || '未知'}
身份/职业：${charData?.role || '未知'}
性格标签：${traits}
人物简介：${charData?.desc || '暂无'}
${charData?.extra ? '补充信息：' + charData.extra : ''}
回答要求：语气符合角色性格，简洁自然，100字以内，不要说"作为角色XXX"这类元叙述。`;

  // 4. 显示加载状态
  answerEl.innerHTML = '<span class="anon-typing-dot"></span><span class="anon-typing-dot"></span><span class="anon-typing-dot"></span>';

  // 5. 调用API
  try {
    const resp = await fetch(`${cur.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cur.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        max_tokens: 300,
        stream: false
      })
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || '（无回复）';

    // 6. 打字机效果显示，完成后回写DB
    answerEl.innerHTML = '';
    let i = 0;
    const timer = setInterval(() => {
      answerEl.textContent += reply[i];
      i++;
      if (i >= reply.length) {
        clearInterval(timer);
        // 把答案写进 data-preset，下次直接读不再调API
        answerEl.dataset.preset = encodeURIComponent(reply);
        // 同步更新DB里这条卡片的 a 字段
        const card = answerEl.closest('.anon-cu, .anon-cn');
        if (card) {
          const dbId = parseInt(card.dataset.dbId);
          if (dbId) anonDbUpdateAnswer(dbId, reply);
        }
      }
    }, 35);

  } catch(e) {
    answerEl.innerHTML = `<span style="color:#f87171;font-size:12px;">请求失败：${e.message}</span>`;
  }
}

async function anonDbUpdateAnswer(id, answer) {
  try {
    const db = await getLunaChatDB();
    return new Promise(res => {
      const tx = db.transaction('anonCards', 'readwrite');
      const store = tx.objectStore('anonCards');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const record = getReq.result;
        if (!record) { res(); return; }
        record.a = answer;
        store.put(record);
        tx.oncomplete = () => res();
      };
      getReq.onerror = () => res();
    });
  } catch { }
}

/* ================================
   过去的 Ta · 全屏页逻辑
================================ */
function openPastPage() {
  const page    = document.getElementById('pastPage');
  const overlay = document.getElementById('pastOverlay');
  if (!page) return;
  page.classList.add('active');
  if (overlay) overlay.classList.add('active');

  // 同步时间
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeEl = document.getElementById('pastStatusTime');
  if (timeEl) timeEl.textContent = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });

  // 同步电量
  const mainPct   = document.getElementById('batPct');
  const mainInner = document.getElementById('batInner');
  const pPct      = document.getElementById('pastBatPct');
  const pInner    = document.getElementById('pastBatInner');
  if (pPct && mainPct)     pPct.textContent      = mainPct.textContent;
  if (pInner && mainInner) {
    pInner.style.width      = mainInner.style.width;
    pInner.style.background = mainInner.style.background;
  }

  // 同步灵动岛
  const enabled  = localStorage.getItem('luna_island_enabled') === 'true';
  const style    = localStorage.getItem('luna_island_style') || 'minimal';
  const islandEl = document.getElementById('pastStatusIsland');
  if (islandEl) {
    if (!enabled) { islandEl.innerHTML = ''; }
    else {
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
      islandEl.innerHTML = styleMap[style] || styleMap.minimal;
    }
  }

  // ── 读库，有内容就渲染，没有就显示空态 ──
  const charName = (typeof _cpCurrentName !== 'undefined' && _cpCurrentName) ? _cpCurrentName : '';
  pastLoadContent(charName);
}

function closePastPage() {
  const page    = document.getElementById('pastPage');
  const overlay = document.getElementById('pastOverlay');
  if (page)    page.classList.remove('active');
  if (overlay) overlay.classList.remove('active');
}

(function() {
  let pastDone = [false, false, false, false];

  window.pastUpdateTop = function() {
    const n = pastDone.filter(Boolean).length;
    const resEl   = document.getElementById('pastTcRes');
    const heartEl = document.getElementById('pastTcHeart');
    if (resEl)   resEl.textContent   = n;
    if (heartEl) heartEl.textContent = n > 0 ? n + ' 段' : '— —';
    for (let i = 0; i < 4; i++) {
      const dot = document.getElementById('pbd' + i);
      if (dot) dot.classList.toggle('on', pastDone[i]);
    }
  }

  function pastParticles(idx) {
    const canvas = document.getElementById('ppc' + idx);
    if (!canvas) return;
    for (let i = 0; i < 22; i++) {
      const p = document.createElement('div');
      p.style.cssText = [
        'position:absolute','border-radius:50%','background:#111','opacity:0','pointer-events:none',
        'width:' + (2 + Math.random() * 5) + 'px',
        'height:' + (2 + Math.random() * 5) + 'px',
        'left:' + (5 + Math.random() * 90) + '%',
        'top:'  + (20 + Math.random() * 70) + '%',
        '--ptx:' + ((Math.random() - .5) * 70) + 'px',
        '--pty:-' + (25 + Math.random() * 70) + 'px',
        'animation:pastPtUp ' + (.6 + Math.random() * .7) + 's ' + (Math.random() * .3) + 's ease-out forwards'
      ].join(';');
      canvas.appendChild(p);
      setTimeout(() => p.remove(), 1100);
    }
  }

  window.pastRes = function(idx, e) {
    if (pastDone[idx]) return;
    pastDone[idx] = true;

    const btn = document.getElementById('prb' + idx);
    if (btn) { btn.classList.add('done'); btn.textContent = '已共鸣'; }

    // ripple
    if (btn) {
      const r = document.createElement('div');
      r.className = 'past-ripple';
      const rect = btn.getBoundingClientRect();
      const sz   = Math.max(btn.offsetWidth, btn.offsetHeight) * 2.8;
      r.style.cssText = 'width:' + sz + 'px;height:' + sz + 'px;left:' + (e.clientX - rect.left - sz/2) + 'px;top:' + (e.clientY - rect.top - sz/2) + 'px';
      btn.appendChild(r);
      setTimeout(() => r.remove(), 750);
    }

    pastParticles(idx);

    // stamp
    const sw = document.getElementById('psw' + idx);
    const st = document.getElementById('pst' + idx);
    if (sw) sw.classList.add('open');
    setTimeout(() => { if (st) st.classList.add('show'); }, 80);

    // hint
    const rh = document.getElementById('prh' + idx);
    if (rh) { rh.textContent = 'Ta 的心声已为你展开'; rh.classList.add('lit'); }

    // heart reveal
    setTimeout(() => {
      const hr = document.getElementById('phr' + idx);
      if (hr) hr.classList.add('open');
    }, 180);

    pastUpdateTop();
  };

  pastUpdateTop();
})();

/* ================================
   过去的 Ta · 生成页逻辑
================================ */
function openPastGenPage() {
  const page    = document.getElementById('pastGenPage');
  const overlay = document.getElementById('pastGenOverlay');
  if (!page) return;
  page.classList.add('active');
  if (overlay) { overlay.style.display = ''; overlay.classList.add('active'); }

  // 同步状态栏
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeEl = document.getElementById('pastGenTime');
  if (timeEl) timeEl.textContent = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const mainPct   = document.getElementById('batPct');
  const mainInner = document.getElementById('batInner');
  const gPct      = document.getElementById('pastGenBatPct');
  const gInner    = document.getElementById('pastGenBatInner');
  if (gPct && mainPct) gPct.textContent = mainPct.textContent;
  if (gInner && mainInner) {
    gInner.style.width      = mainInner.style.width;
    gInner.style.background = mainInner.style.background;
  }

  // 同步灵动岛
  const enabled  = localStorage.getItem('luna_island_enabled') === 'true';
  const style    = localStorage.getItem('luna_island_style') || 'minimal';
  const islandEl = document.getElementById('pastGenIsland');
  if (islandEl) {
    if (!enabled) { islandEl.innerHTML = ''; }
    else {
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
      islandEl.innerHTML = styleMap[style] || styleMap.minimal;
    }
  }

  // 重置到初始态
  document.getElementById('pastGenIdle').style.display    = 'flex';
  document.getElementById('pastGenLoading').style.display = 'none';
  document.getElementById('pastGenResult').style.display  = 'none';
}

function closePastGenPage() {
  const page    = document.getElementById('pastGenPage');
  const overlay = document.getElementById('pastGenOverlay');
  if (page)    page.classList.remove('active');
  if (overlay) { overlay.classList.remove('active'); overlay.style.display = ''; }
}

async function startPastGen() {
  // 切换到加载态
  document.getElementById('pastGenIdle').style.display    = 'none';
  document.getElementById('pastGenResult').style.display  = 'none';
  document.getElementById('pastGenLoading').style.display = 'flex';

  try {
    // ── 读取当前角色信息（从 IndexedDB + _cpCurrentName）──
    let charName    = '她';
    let charPersona = '';
    let userPersona = '';

    // 用 _cpCurrentName（openCharProfile 时已赋值）从 IndexedDB 读完整角色数据
    const currentCharName = (typeof _cpCurrentName !== 'undefined' && _cpCurrentName)
      ? _cpCurrentName
      : (document.querySelector('#cpPage .cp-profile-name')?.textContent?.trim() || '');

    const currentChar = currentCharName ? await getCharDataByName(currentCharName) : null;

    if (currentChar) {
      charName = currentChar.name || charName;
      charPersona = [
        currentChar.role   ? `定位/身份：${currentChar.role}`   : '',
        currentChar.gender ? `性别：${currentChar.gender}`       : '',
        currentChar.age    ? `年龄：${currentChar.age}`          : '',
        currentChar.desc   ? `人设描述：${currentChar.desc}`     : '',
        currentChar.traits?.length
          ? `性格标签：${Array.isArray(currentChar.traits) ? currentChar.traits.join('、') : currentChar.traits}` : '',
        currentChar.prompt ? `系统提示词：${currentChar.prompt}` : '',
      ].filter(Boolean).join('\n');
    }

    // 检查有没有绑定这个角色的 user 人设
    // 结构：luna_user_personas = [{charId, content}, ...]  存在 localStorage
    const userPersonas = JSON.parse(localStorage.getItem('luna_user_personas') || '[]');
    if (currentChar?.id) {
      const bound = userPersonas.find(p => String(p.charId) === String(currentChar.id));
      if (bound?.content) userPersona = bound.content;
    }
    // 兜底：全局 user 档案
    if (!userPersona) {
      userPersona = localStorage.getItem('luna_user_profile') || '';
    }

    // ── 构建 prompt ───────────────────────────────────
    const hasUserPersona = userPersona && userPersona.trim().length > 10;

    let systemPrompt = `你是一个擅长写细腻情感散文的 AI。
你的任务：以 AI 角色「${charName}」的第一人称视角（"我"），写出 Ta 眼中的 user（"你"）的样子。

输出格式要求（非常重要，严格遵守）：
将内容分成4个段落，每个段落输出如下结构，用 ---SPLIT--- 分隔每组：

正文：（这里写正文，150-250字，细腻有故事感，像在回忆某个具体的场景或细节）
心声：（这里写Ta藏在心里没说出口的话，80-120字，更私密、更直白、更脆弱，是正文背后真正想说的）

---SPLIT---

（下一组正文和心声）

文章整体要求：
- 第一人称，以角色「${charName}」的口吻
- 总正文不少于1500字
- 细腻有故事感，接地气，不文绉绉
- 有具体场景、细节、记忆片段
- 心声比正文更私密，是没敢说出口的那一层
- 结尾最后一组要有余韵`;

    let userPrompt = '';
    if (hasUserPersona) {
      userPrompt = `角色「${charName}」的人设信息：\n${charPersona || '（暂无详细人设）'}\n\n用户的人设档案：\n${userPersona}\n\n请以「${charName}」的视角，用第一人称，写出 Ta 眼中的 user 的样子。结合以上两份信息，充分发挥，写出有血有肉的文章。`;
    } else {
      userPrompt = `角色「${charName}」的人设信息：\n${charPersona || '（这是一个温柔感性、善于观察的角色）'}\n\n没有用户的具体档案，请你以「${charName}」的视角和性格，自由想象并构建出 Ta 眼中的用户形象——那个曾经出现在 Ta 生命里的人，写出 Ta 对 user 的观察和感受。`;
    }

    // ── 调用 API ──────────────────────────────────────
    // ── 调用 API ──────────────────────────────────────
    const cur   = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
    const model = localStorage.getItem('luna_api_model') || '';
    if (!cur.baseUrl || !cur.apiKey || !model) throw new Error('请先在设置里配置 API');

    const response = await fetch(`${cur.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cur.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   }
        ],
      })
    });

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || '';

    if (!text) throw new Error('生成失败，返回为空');

    // ── 渲染结果 ──────────────────────────────────────
    const charNameEl = document.getElementById('pastGenCharName');
    if (charNameEl) charNameEl.textContent = charName;

    // 解析正文 + 心声
    const blocks = text.split(/---SPLIT---/);
    const paragraphs = []; // 正文
    const hearts     = []; // 心声

    blocks.forEach(block => {
      const bodyMatch  = block.match(/正文：([\s\S]*?)(?=心声：|$)/);
      const heartMatch = block.match(/心声：([\s\S]*?)(?=---|$)/);
      const body  = bodyMatch?.[1]?.trim()  || '';
      const heart = heartMatch?.[1]?.trim() || '';
      if (body) {
        paragraphs.push(body);
        hearts.push(heart);
      }
    });

    if (paragraphs.length === 0) throw new Error('生成失败，返回为空');

    // ── pastGenPage 展示正文 ──────────────────────────
    const bodyEl = document.getElementById('pastGenBody');
    if (bodyEl) {
      bodyEl.innerHTML = paragraphs.map(p =>
        `<p>${p.replace(/\n/g, '<br>')}</p>`
      ).join('');
    }
    if (charNameEl) charNameEl.textContent = charName;

    // ── 存库 ─────────────────────────────────────────
    if (currentChar?.id) {
      await pastDbSave(currentChar.id, charName, paragraphs, hearts);
    }

    // ── 渲染到 pastPage（含共鸣+心声） ───────────────
    pastRenderSections(charName, paragraphs, hearts);

    document.getElementById('pastGenLoading').style.display = 'none';
    document.getElementById('pastGenResult').style.display  = 'block';

    const scroll = document.querySelector('#pastGenPage .cp-scroll');
    if (scroll) scroll.scrollTop = 0;

  } catch (err) {
    console.error('startPastGen error:', err);
    document.getElementById('pastGenLoading').style.display = 'none';
    document.getElementById('pastGenIdle').style.display    = 'flex';
    // 简单提示
    alert('生成失败，请检查网络或重试');
  }
}

/* ================================
   过去的 Ta · 内容存读库
================================ */

// 读库并渲染到 pastPage
async function pastLoadContent(charName) {
  const emptyEl   = document.getElementById('pastEmpty');
  const contentEl = document.getElementById('pastHasContent');
  if (!emptyEl || !contentEl) return;

  if (!charName) {
    emptyEl.style.display   = 'flex';
    contentEl.style.display = 'none';
    return;
  }

  // 先拿角色 id
  const charData = await getCharDataByName(charName);
  const charId   = charData?.id;
  if (!charId) {
    emptyEl.style.display   = 'flex';
    contentEl.style.display = 'none';
    return;
  }

  const record = await pastDbGet(charId);
  if (record && record.paragraphs && record.paragraphs.length > 0) {
    pastRenderSections(record.charName || charName, record.paragraphs, record.hearts || []);
  } else {
    emptyEl.style.display   = 'flex';
    contentEl.style.display = 'none';
  }
}

// 从 taContent 表读一条
function pastDbGet(charId) {
  return getLunaChatDB().then(db => new Promise(res => {
    const r = db.transaction('taContent').objectStore('taContent').get(charId);
    r.onsuccess = () => res(r.result || null);
    r.onerror   = () => res(null);
  }));
}

// 存一条到 taContent 表
function pastDbSave(charId, charName, paragraphs, hearts) {
  return getLunaChatDB().then(db => new Promise(res => {
    const tx = db.transaction('taContent', 'readwrite');
    tx.objectStore('taContent').put({ charId, charName, paragraphs, hearts: hearts || [], createdAt: Date.now() });
    tx.oncomplete = () => res();
    tx.onerror    = () => res();
  }));
}

// 渲染段落到 pastPage
function pastRenderSections(charName, paragraphs, hearts) {
  hearts = hearts || [];
  const emptyEl     = document.getElementById('pastEmpty');
  const contentEl   = document.getElementById('pastHasContent');
  const sectionsEl  = document.getElementById('pastSections');
  const dotsEl      = document.getElementById('pastBDots');
  const paraCountEl = document.getElementById('pastTcPara');
  const coverTitle  = document.getElementById('pastCoverTitle');

  if (sectionsEl) {
    sectionsEl.innerHTML = paragraphs.map((p, i) => `
      <div class="past-sec" id="ps${i}">
        <div class="past-pc" id="ppc${i}"></div>
        <div class="past-sec-num">0 ${i + 1}</div>
        <div class="past-s-text"><p>${p.replace(/\n/g, '<br>')}</p></div>
        ${hearts[i] ? `
        <div class="past-heart-reveal" id="phr${i}">
          <div class="past-heart-inner">
            <div class="past-heart-tag"><div class="past-heart-tag-dot"></div>Ta 的内心</div>
            <div class="past-heart-text">${hearts[i].replace(/\n/g, '<br>')}</div>
          </div>
        </div>
        <div class="past-stamp-wrap" id="psw${i}"><div class="past-stamp" id="pst${i}">已共鸣</div></div>
        <div class="past-res-row">
          <div class="past-res-hint" id="prh${i}">共鸣后心声解锁</div>
          <button class="past-res-btn" id="prb${i}" onclick="pastRes(${i},event)">我也这么觉得</button>
        </div>` : ''}
      </div>
    `).join('');
  }

  if (dotsEl) {
    dotsEl.innerHTML = paragraphs.map((_, i) =>
      `<div class="past-b-dot" id="pbd${i}"></div>`
    ).join('');
  }
  if (paraCountEl) paraCountEl.textContent = paragraphs.length;
  if (coverTitle)  coverTitle.textContent  = `${charName} 眼中的我`;
  if (emptyEl)     emptyEl.style.display   = 'none';
  if (contentEl)   contentEl.style.display = 'block';

  // 重置共鸣状态
  window._pastDone = new Array(paragraphs.length).fill(false);
  if (typeof window.pastUpdateTop === 'function') window.pastUpdateTop();
}

/* ================================
   现在的 Ta · 信号频率页逻辑
================================ */

const NOW_FREQ_POINTS = [95, 200, 320, 450, 570, 700, 860];
const NOW_HZ_LABELS   = ['89.1','91.0','93.2','95.5','97.4','99.3','101.9'];
let _nowSegments      = [];
let _nowCollected     = new Set();
let _nowLocked        = null;
let _nowNoiseTimer    = null;
let _nowWaveTimer     = null;
let _nowInited        = false;

function openNowPage() {
  const page    = document.getElementById('nowPage');
  const overlay = document.getElementById('nowOverlay');
  if (!page) return;
  page.classList.add('active');
  if (overlay) { overlay.style.display = ''; overlay.classList.add('active'); }

  // 同步时间
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeEl = document.getElementById('nowStatusTime');
  if (timeEl) timeEl.textContent = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });

  // 同步电量
  const mainPct   = document.getElementById('batPct');
  const mainInner = document.getElementById('batInner');
  const nPct      = document.getElementById('nowBatPct');
  const nInner    = document.getElementById('nowBatInner');
  if (nPct && mainPct)     nPct.textContent       = mainPct.textContent;
  if (nInner && mainInner) {
    nInner.style.width      = mainInner.style.width;
    nInner.style.background = mainInner.style.background;
  }

  // 同步灵动岛
  const enabled  = localStorage.getItem('luna_island_enabled') === 'true';
  const style    = localStorage.getItem('luna_island_style') || 'minimal';
  const islandEl = document.getElementById('nowStatusIsland');
  if (islandEl) {
    if (!enabled) { islandEl.innerHTML = ''; }
    else {
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
      islandEl.innerHTML = styleMap[style] || styleMap.minimal;
    }
  }

  // 第一次打开才生成内容
  if (!_nowInited) {
    _nowInited = true;
    nowGenerate();
  }
}

function closeNowPage() {
  const page    = document.getElementById('nowPage');
  const overlay = document.getElementById('nowOverlay');
  if (page)    page.classList.remove('active');
  if (overlay) { overlay.classList.remove('active'); overlay.style.display = 'none'; }
}

async function nowClearAndRegenerate() {
  // 清除缓存，重置状态，重新生成
  try {
    const db = await nowOpenDB();
    const tx = db.transaction(NOW_DB_STORE, 'readwrite');
    tx.objectStore(NOW_DB_STORE).delete(NOW_CACHE_KEY);
  } catch(e) {}
  _nowSegments  = [];
  _nowCollected = new Set();
  _nowLocked    = null;
  clearInterval(_nowNoiseTimer);
  clearInterval(_nowWaveTimer);

  const loading = document.getElementById('nowLoading');
  const main    = document.getElementById('nowMain');
  if (loading) { loading.style.display = 'flex'; loading.innerHTML = `<div style="display:flex;gap:4px;align-items:flex-end;height:28px;"><div style="width:2px;background:#ccc;animation:nowBar 1.2s ease-in-out infinite;animation-delay:0s"></div><div style="width:2px;background:#ccc;animation:nowBar 1.2s ease-in-out infinite;animation-delay:0.1s"></div><div style="width:2px;background:#ccc;animation:nowBar 1.2s ease-in-out infinite;animation-delay:0.2s"></div><div style="width:2px;background:#ccc;animation:nowBar 1.2s ease-in-out infinite;animation-delay:0.3s"></div><div style="width:2px;background:#ccc;animation:nowBar 1.2s ease-in-out infinite;animation-delay:0.4s"></div></div><div style="font-size:11px;letter-spacing:0.15em;color:#bbb;">正在生成信号频道...</div>`; }
  if (main)    main.style.display    = 'none';

  await nowGenerate();
}

function nowMkNoise() {
  const pool = ['·','—',' ','·','—','·',' ','—'];
  const r = [];
  for (let i = 0; i < 46; i++) r.push(pool[Math.floor(Math.random() * pool.length)]);
  return r.join(' ');
}

function nowGetFreq(v) { return (87.5 + (v / 1000) * 17.5).toFixed(1); }

function nowWave(v, locked) {
  const W = 335, H = 60, pts = 160;
  let d = 'M 0 30';
  for (let i = 1; i <= pts; i++) {
    const x = (i / pts) * W, nx = i / pts;
    let amp;
    if (locked) {
      amp = 11 * Math.sin(nx * Math.PI * 6) + 4 * Math.sin(nx * Math.PI * 14) + 1.5 * Math.sin(nx * Math.PI * 22);
    } else {
      amp = (Math.random() - 0.5) * 24 * Math.exp(-Math.pow(nx - 0.5, 2) / 0.1)
           + 6 * Math.sin(nx * Math.PI * 5 + v * 0.015)
           + 3 * Math.sin(nx * Math.PI * 11 + v * 0.03)
           + (Math.random() - 0.5) * 4;
    }
    d += ` L ${x.toFixed(1)} ${(30 + amp).toFixed(1)}`;
  }
  return d;
}

function nowRenderSediment() {
  const el = document.getElementById('nowSediment');
  if (!el) return;
  el.innerHTML = '';

  // 用于沉淀区心声切换
  window.nowSedimentToggleHeart = function(btn, idx) {
    const box = document.getElementById('nowSedHeart_' + idx);
    if (!box) return;
    const isOpen = btn.dataset.open === '1';
    if (isOpen) {
      box.style.maxHeight = '0'; box.style.opacity = '0';
      btn.dataset.open = '0';
      btn.querySelector('.sed-btn-txt').textContent = '听听 Ta 的心声';
    } else {
      box.style.maxHeight = '800px'; box.style.opacity = '1';
      btn.dataset.open = '1';
      btn.querySelector('.sed-btn-txt').textContent = '收起心声';
    }
  };

  for (let i = 0; i < 7; i++) {
    const has = _nowCollected.has(i);
    const seg = _nowSegments[i];
    const div = document.createElement('div');
    div.style.cssText = 'padding:20px 0;border-bottom:0.5px solid #f0f0f0;';

    if (has && seg) {
      const hasHeart = seg.heart && seg.heart.trim().length > 0;
      div.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <div style="width:5px;height:5px;border-radius:50%;background:#333;flex-shrink:0;"></div>
          <div style="font-size:9px;color:#999;font-family:monospace;letter-spacing:0.1em;">${NOW_HZ_LABELS[i]} MHz</div>
        </div>
        <div style="font-size:15px;color:#1a1a1a;line-height:2;letter-spacing:0.03em;">${seg.body.replace(/\n/g,'<br>')}</div>
        ${hasHeart ? `
        <button data-open="0" onclick="nowSedimentToggleHeart(this,${i})"
          style="margin-top:14px;display:flex;align-items:center;gap:7px;background:none;border:0.5px solid #ddd;border-radius:20px;padding:7px 14px;cursor:pointer;font-size:11px;color:#999;letter-spacing:0.08em;">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span class="sed-btn-txt">听听 Ta 的心声</span>
        </button>
        <div id="nowSedHeart_${i}" style="overflow:hidden;max-height:0;opacity:0;transition:max-height 0.4s ease,opacity 0.4s ease;">
          <div style="margin-top:12px;padding:16px 18px;border-left:2px solid #ccc;background:#f7f7f7;border-radius:0 8px 8px 0;">
            <div style="font-size:9px;letter-spacing:0.16em;color:#bbb;margin-bottom:8px;">心声</div>
            <div style="font-size:15px;color:#333;line-height:1.9;letter-spacing:0.03em;font-style:italic;">${seg.heart.replace(/\n/g,'<br>')}</div>
          </div>
        </div>` : ''}`;
    } else {
      div.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:5px;height:5px;border-radius:50%;background:#e8e8e8;flex-shrink:0;"></div>
          <div style="font-size:9px;color:#ddd;font-family:monospace;letter-spacing:0.1em;">— — MHz</div>
        </div>
        <div style="padding-left:13px;margin-top:8px;font-size:13px;color:#ddd;font-style:italic;letter-spacing:0.06em;">· · · 待解锁 · · ·</div>`;
    }
    el.appendChild(div);
  }
}

function nowUpdateProgress() {
  const n = _nowCollected.size, t = 7;
  const fill  = document.getElementById('nowCbFill');
  const count = document.getElementById('nowCbCount');
  if (fill)  fill.style.width  = (n / t * 100) + '%';
  if (count) count.textContent = n + ' / ' + t;
}

function nowUpdate() {
  const slider = document.getElementById('nowSlider');
  if (!slider) return;
  const v   = parseInt(slider.value);
  const pct = v / 1000;

  const freqEl  = document.getElementById('nowFreqNum');
  const needle  = document.getElementById('nowNeedle');
  const waveLine= document.getElementById('nowWaveLine');
  const badge   = document.getElementById('nowBadge');
  const noiseTxt= document.getElementById('nowNoiseTxt');
  const clearWrap=document.getElementById('nowClearWrap');
  const clearMain=document.getElementById('nowClearMain');
  const lockTag = document.getElementById('nowLockTag');
  const wavePath= document.getElementById('nowWavePath');

  if (freqEl)   freqEl.textContent    = nowGetFreq(v);
  if (needle)   needle.style.left     = (pct * 100) + '%';
  if (waveLine) { waveLine.setAttribute('x1', pct * 335); waveLine.setAttribute('x2', pct * 335); }

  let found = null;
  NOW_FREQ_POINTS.forEach((fp, i) => { if (Math.abs(v - fp) <= 14) found = i; });

  if (found !== null && _nowSegments[found]) {
    if (_nowLocked !== found) {
      _nowLocked = found;
      clearInterval(_nowNoiseTimer);

      const seg = _nowSegments[found];

      // 噪音隐藏，内容显示
      if (noiseTxt)  { noiseTxt.style.opacity = '0'; setTimeout(()=>{ noiseTxt.style.display='none'; }, 250); }
      if (clearWrap) {
        clearWrap.style.display = 'block';
        setTimeout(()=>{ clearWrap.style.opacity='1'; }, 10);
      }
      if (clearMain) clearMain.textContent = seg.body;

      // 重置心声为隐藏状态（切换频道时收起）
      const heartDiv = document.getElementById('nowClearHeart');
      const heartBtn = document.getElementById('nowHeartBtn');
      const heartTxt = document.getElementById('nowHeartTxt');
      if (heartTxt) heartTxt.textContent = seg.heart || '';
      if (heartDiv) { heartDiv.style.maxHeight = '0'; heartDiv.style.opacity = '0'; }
      if (heartBtn) {
        heartBtn.dataset.open = '0';
        const btnTxt = document.getElementById('nowHeartBtnTxt');
        if (btnTxt) btnTxt.textContent = '听听 Ta 的心声';
        heartBtn.style.display = seg.heart ? 'flex' : 'none';
      }

      if (lockTag)  lockTag.style.color = '#888';
      if (badge)    badge.textContent   = 'LOCKED';
      if (wavePath) { wavePath.setAttribute('stroke','#555'); wavePath.setAttribute('stroke-width','1.1'); wavePath.setAttribute('d', nowWave(v, true)); }

      if (!_nowCollected.has(found)) {
        setTimeout(() => {
          _nowCollected.add(found);
          nowRenderSediment();
          nowUpdateProgress();
          nowSaveCache();
        }, 800);
      }
    }
  } else {
    if (_nowLocked !== null) {
      _nowLocked = null;

      // 内容隐藏，噪音显示
      if (clearWrap) { clearWrap.style.opacity='0'; setTimeout(()=>{ clearWrap.style.display='none'; },250); }
      if (noiseTxt)  { noiseTxt.style.display=''; setTimeout(()=>{ noiseTxt.style.opacity='1'; },10); }
      if (lockTag)   lockTag.style.color  = '#d0d0d0';
      if (badge)     badge.textContent    = 'SCANNING';
      if (wavePath)  { wavePath.setAttribute('stroke','#ccc'); wavePath.setAttribute('stroke-width','0.9'); }
    }
    clearInterval(_nowNoiseTimer);
    _nowNoiseTimer = setInterval(() => {
      const el = document.getElementById('nowNoiseTxt');
      if (el) el.textContent = nowMkNoise();
    }, 80);
  }
}

/* ---- NOW 页：心声展开/收起 ---- */
function nowToggleHeart() {
  const heartDiv = document.getElementById('nowClearHeart');
  const heartBtn = document.getElementById('nowHeartBtn');
  if (!heartDiv || !heartBtn) return;
  const isOpen = heartBtn.dataset.open === '1';
  if (isOpen) {
    heartDiv.style.maxHeight = '0';
    heartDiv.style.opacity   = '0';
    heartBtn.dataset.open = '0';
    const btnTxt = document.getElementById('nowHeartBtnTxt');
    if (btnTxt) btnTxt.textContent = '听听 Ta 的心声';
  } else {
    heartDiv.style.maxHeight = '800px';
    heartDiv.style.opacity   = '1';
    heartBtn.dataset.open = '1';
    const btnTxt = document.getElementById('nowHeartBtnTxt');
    if (btnTxt) btnTxt.textContent = '收起心声';
  }
}

/* ---- NOW 页：IndexedDB 缓存 ---- */
const NOW_DB_NAME    = 'luna_now_db';
const NOW_DB_STORE   = 'now_segments';
const NOW_CACHE_KEY  = 'now_cache';

function nowOpenDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NOW_DB_NAME, 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(NOW_DB_STORE, { keyPath: 'id' });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = () => reject(req.error);
  });
}

async function nowLoadCache() {
  try {
    const db  = await nowOpenDB();
    const tx  = db.transaction(NOW_DB_STORE, 'readonly');
    const store = tx.objectStore(NOW_DB_STORE);
    return await new Promise((resolve) => {
      const req = store.get(NOW_CACHE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = () => resolve(null);
    });
  } catch { return null; }
}

async function nowSaveCache() {
  try {
    const db  = await nowOpenDB();
    const tx  = db.transaction(NOW_DB_STORE, 'readwrite');
    tx.objectStore(NOW_DB_STORE).put({
      id:         NOW_CACHE_KEY,
      segments:   _nowSegments,
      collected:  [..._nowCollected],
      savedAt:    Date.now(),
    });
  } catch(e) { console.warn('nowSaveCache error:', e); }
}

async function nowGenerate() {
  // ---- 先查 IndexedDB 缓存，有数据直接恢复，不调 API ----
  const cached = await nowLoadCache();
  if (cached && Array.isArray(cached.segments) && cached.segments.length > 0) {
    _nowSegments  = cached.segments;
    _nowCollected = new Set(cached.collected || []);
    nowInitUI();
    return;
  }

  // ---- 无缓存，调 API 生成 ----
  let charName    = 'Ta';
  let charPersona = '';
  let userPersona = '';

  try {
    const currentCharName = (typeof _cpCurrentName !== 'undefined' && _cpCurrentName) ? _cpCurrentName : '';
    const currentChar = currentCharName ? await getCharDataByName(currentCharName) : null;
    if (currentChar) {
      charName = currentChar.name || charName;
      charPersona = [
        currentChar.role   ? `定位/身份：${currentChar.role}`   : '',
        currentChar.gender ? `性别：${currentChar.gender}`       : '',
        currentChar.age    ? `年龄：${currentChar.age}`          : '',
        currentChar.desc   ? `人设描述：${currentChar.desc}`     : '',
        currentChar.traits?.length
          ? `性格标签：${Array.isArray(currentChar.traits) ? currentChar.traits.join('、') : currentChar.traits}` : '',
        currentChar.prompt ? `系统提示词：${currentChar.prompt}` : '',
      ].filter(Boolean).join('\n');
    }
    const userPersonas = JSON.parse(localStorage.getItem('luna_user_personas') || '[]');
    if (currentChar?.id) {
      const bound = userPersonas.find(p => String(p.charId) === String(currentChar.id));
      if (bound?.content) userPersona = bound.content;
    }
    if (!userPersona) userPersona = localStorage.getItem('luna_user_profile') || '';
  } catch(e) {}

  const systemPrompt = `你是一个擅长写细腻情感散文的 AI。
任务：以角色「${charName}」的第一人称视角，写出 Ta 现在眼中的 user（"你"）。
格式要求（严格遵守）：分成恰好 7 组，每组包含正文和心声，用 ---SPLIT--- 分隔：

正文：（150-220字，当下的观察、细节、具体场景，有故事感）
心声：（40-70字，比正文更私密、更直白、没说出口的那一层）

---SPLIT---

（下一组）

整体要求：
- 第一人称，以「${charName}」的口吻
- 7组正文总字数不少于1500字
- 有具体场景和细节，不空泛
- 心声比正文更脆弱，是那层没敢说的
- 最后一组要有余韵`;

  const userPrompt = userPersona
    ? `角色人设：\n${charPersona || '（温柔感性、善于观察）'}\n\n用户档案：\n${userPersona}\n\n请生成7组正文+心声，总字数1500字以上。`
    : `角色人设：\n${charPersona || '（温柔感性、善于观察）'}\n\n没有用户档案，请自由想象用户形象，生成7组正文+心声，总字数1500字以上。`;

  try {
    const cur   = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
    const model = localStorage.getItem('luna_api_model') || '';
    if (!cur.baseUrl || !cur.apiKey || !model) throw new Error('未配置 API');

    const response = await fetch(`${cur.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cur.apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] })
    });

    const data   = await response.json();
    const text   = data?.choices?.[0]?.message?.content || '';
    if (!text) throw new Error('返回为空');

    // 解析——兼容多种格式
    console.log('AI原始返回：', text);
    _nowSegments = [];

    // 先尝试 ---SPLIT--- 分割
    let blocks = text.split(/---SPLIT---|—{3,}SPLIT—{3,}|={3,}/);

    // 如果只有1块，说明没用分隔符，改用编号分割（1. 2. 一、二、）
    if (blocks.length <= 1) {
      blocks = text.split(/\n(?=\d+[\.、]|\【\d|第[一二三四五六七])/);
    }

    blocks.forEach(block => {
      if (!block.trim()) return;
      // 尝试匹配 正文：心声：格式
      let bodyMatch  = block.match(/正文[：:]([\s\S]*?)(?=心声[：:]|$)/);
      let heartMatch = block.match(/心声[：:]([\s\S]*?)(?=正文[：:]|---|$)/);
      let body  = bodyMatch?.[1]?.trim()  || '';
      let heart = heartMatch?.[1]?.trim() || '';

      // 如果没匹配到正文：格式，把整块当正文
      if (!body) {
        const lines = block.trim().split('\n').filter(l => l.trim());
        body  = lines.slice(0, Math.ceil(lines.length * 0.75)).join('\n').trim();
        heart = lines.slice(Math.ceil(lines.length * 0.75)).join('\n').trim();
      }

      const cleanText = t => t.replace(/\*\*/g,'').replace(/\*/g,'').replace(/#+\s/g,'').trim();
    if (body.length > 20) _nowSegments.push({ body: cleanText(body), heart: cleanText(heart) });
    });

    // 如果还是解析不出来，按字数平均切割
    if (_nowSegments.length === 0 && text.length > 100) {
      const clean = text.replace(/正文[：:]|心声[：:]|---SPLIT---|[\r]/g, '').trim();
      const paraSize = Math.ceil(clean.length / 7);
      for (let i = 0; i < 7; i++) {
        const body = clean.slice(i * paraSize, (i + 1) * paraSize).trim();
        if (body.length > 10) _nowSegments.push({ body, heart: '' });
      }
    }

    if (_nowSegments.length === 0) throw new Error('内容为空，请重试');

    // 存缓存
    await nowSaveCache();

    // 初始化 UI
    nowInitUI();

  } catch(err) {
    console.error('nowGenerate error:', err);
    document.getElementById('nowLoading').innerHTML =
      `<div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:20px;">
        <div style="font-size:12px;color:#bbb;letter-spacing:0.1em;">信号中断</div>
        <div style="font-size:11px;color:#f87171;text-align:center;line-height:1.6;max-width:240px;">${err.message}</div>
        <div style="font-size:10px;color:#ccc;text-align:center;line-height:1.8;max-width:260px;" id="nowDebugInfo">检查中...</div>
      </div>`;
    const cur   = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
    const model = localStorage.getItem('luna_api_model') || '';
    const debugEl = document.getElementById('nowDebugInfo');
    if (debugEl) debugEl.innerHTML =
      `baseUrl: ${cur.baseUrl || '❌ 未设置'}<br>
       apiKey: ${cur.apiKey ? '✅ 已设置' : '❌ 未设置'}<br>
       model: ${model || '❌ 未设置'}`;
  }
}

/* ---- NOW 页：UI 初始化（生成/缓存恢复后共用） ---- */
function nowInitUI() {
  const loading = document.getElementById('nowLoading');
  const main    = document.getElementById('nowMain');
  if (loading) loading.style.display = 'none';
  if (main)    main.style.display    = 'block';

  nowRenderSediment();
  nowUpdateProgress();

  // 绑定滑块（防止重复绑定）
  const slider = document.getElementById('nowSlider');
  if (slider) {
    slider.removeEventListener('input', nowUpdate);
    slider.addEventListener('input', nowUpdate);
  }

  // 停掉旧定时器
  clearInterval(_nowNoiseTimer);
  clearInterval(_nowWaveTimer);

  // 噪音动画
  _nowNoiseTimer = setInterval(() => {
    const el = document.getElementById('nowNoiseTxt');
    if (el) el.textContent = nowMkNoise();
  }, 80);

  // 波形动画
  _nowWaveTimer = setInterval(() => {
    if (_nowLocked === null) {
      const wp = document.getElementById('nowWavePath');
      const sv = document.getElementById('nowSlider');
      if (wp && sv) wp.setAttribute('d', nowWave(parseInt(sv.value), false));
    }
  }, 110);

  nowUpdate();
}

/* ================================
   未来的 Ta · 深空扫描页逻辑
================================ */

const FUTURE_FREQ_POINTS = [95, 200, 320, 450, 570, 700, 860];
const FUTURE_DB_NAME  = 'luna_future_db';
const FUTURE_DB_STORE = 'future_segments';
const FUTURE_CACHE_KEY = 'future_cache';

let _futureSegments   = [];
let _futureCollected  = new Set();
let _futureLocked     = null;
let _futureNoiseTimer = null;
let _futureInited     = false;
let _futureStars      = [];
let _futurePulsePhase = 0;
let _futureScanLine   = 0.05;
let _futureAnimFrame  = null;

/* ---- 打开 / 关闭 ---- */
function openFuturePage() {
  const page    = document.getElementById('futurePage');
  const overlay = document.getElementById('futureOverlay');
  if (!page) return;
  page.classList.add('active');
  if (overlay) { overlay.style.display = ''; overlay.classList.add('active'); }

  // 同步时间
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeEl = document.getElementById('futureStatusTime');
  if (timeEl) timeEl.textContent = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });

  // 同步电量
  const mainPct   = document.getElementById('batPct');
  const mainInner = document.getElementById('batInner');
  const nPct      = document.getElementById('futureBatPct');
  const nInner    = document.getElementById('futureBatInner');
  if (nPct && mainPct)     nPct.textContent       = mainPct.textContent;
  if (nInner && mainInner) {
    nInner.style.width      = mainInner.style.width;
    nInner.style.background = mainInner.style.background;
  }

  // 同步灵动岛（和 openNowPage 完全一致）
  const enabled  = localStorage.getItem('luna_island_enabled') === 'true';
  const style    = localStorage.getItem('luna_island_style') || 'minimal';
  const islandEl = document.getElementById('futureStatusIsland');
  if (islandEl) {
    if (!enabled) { islandEl.innerHTML = ''; }
    else {
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
      islandEl.innerHTML = styleMap[style] || styleMap.minimal;
    }
  }

  if (!_futureInited) {
    _futureInited = true;
    futureGenerate();
  }
}

function closeFuturePage() {
  const page    = document.getElementById('futurePage');
  const overlay = document.getElementById('futureOverlay');
  if (page)    page.classList.remove('active');
  if (overlay) { overlay.classList.remove('active'); overlay.style.display = 'none'; }
  if (_futureAnimFrame) { cancelAnimationFrame(_futureAnimFrame); _futureAnimFrame = null; }
}

async function futureClearAndRegenerate() {
  try {
    const db = await futureOpenDB();
    const tx = db.transaction(FUTURE_DB_STORE, 'readwrite');
    tx.objectStore(FUTURE_DB_STORE).delete(FUTURE_CACHE_KEY);
  } catch(e) {}
  _futureSegments  = [];
  _futureCollected = new Set();
  _futureLocked    = null;
  clearInterval(_futureNoiseTimer);

  const loading = document.getElementById('futureLoading');
  const main    = document.getElementById('futureMain');
  if (loading) {
    loading.style.display = 'flex';
    loading.innerHTML = `
      <div style="display:flex;gap:4px;align-items:flex-end;height:28px;">
        <div style="width:2px;background:#ccc;animation:nowBar 1.2s ease-in-out infinite;animation-delay:0s"></div>
        <div style="width:2px;background:#ccc;animation:nowBar 1.2s ease-in-out infinite;animation-delay:0.1s"></div>
        <div style="width:2px;background:#ccc;animation:nowBar 1.2s ease-in-out infinite;animation-delay:0.2s"></div>
        <div style="width:2px;background:#ccc;animation:nowBar 1.2s ease-in-out infinite;animation-delay:0.3s"></div>
        <div style="width:2px;background:#ccc;animation:nowBar 1.2s ease-in-out infinite;animation-delay:0.4s"></div>
      </div>
      <div style="font-size:13px;letter-spacing:0.15em;color:#111;">正在捕捉未来的光...</div>`;
  }
  if (main) main.style.display = 'none';
  await futureGenerate();
}

/* ---- 噪音 ---- */
function futureMkNoise() {
  const pool = ['·','—',' ','·','—','·',' ','—'];
  const r = [];
  for (let i = 0; i < 46; i++) r.push(pool[Math.floor(Math.random() * pool.length)]);
  return r.join(' ');
}

/* ---- 角度字符串 ---- */
function futureDegStr(v) {
  const d = ((v / 1000) * 90 - 45).toFixed(1);
  return (d >= 0 ? '+' : '') + d + '°';
}

/* ---- 星图 ---- */
function futureInitStars(canvas) {
  _futureStars = [];
  const w = canvas.width, h = canvas.height;
  for (let i = 0; i < 90; i++) {
    _futureStars.push({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() * 1.2 + 0.2,
      tw: Math.random() * Math.PI * 2,
      speed: 0.01 + Math.random() * 0.02
    });
  }
  FUTURE_FREQ_POINTS.forEach((fp, i) => {
    const px = (fp / 1000) * (w - 20) + 10;
    const py = 20 + Math.random() * (h - 50);
    _futureStars.push({ x: px, y: py, r: 1.8, tw: 0, speed: 0.04, bright: true, idx: i });
  });
}

function futureDrawMap(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#f0f0f0'; ctx.lineWidth = 0.4;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath(); ctx.moveTo(0, (i+1)*h/6); ctx.lineTo(w, (i+1)*h/6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo((i+1)*w/6, 0); ctx.lineTo((i+1)*w/6, h); ctx.stroke();
  }
  ctx.strokeStyle = '#ececec'; ctx.lineWidth = 0.3; ctx.setLineDash([3,6]);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.arc(w/2, h/2, (i+1)*45, 0, Math.PI*2); ctx.stroke();
  }
  ctx.setLineDash([]);

  _futurePulsePhase += 0.03;
  _futureStars.forEach(s => {
    s.tw += s.speed;
    const alpha = s.bright
      ? 0.5 + 0.5 * Math.sin(s.tw + _futurePulsePhase * 2)
      : 0.3 + 0.3 * Math.sin(s.tw);
    if (s.bright) {
      const isLocked = _futureLocked === s.idx;
      const col = isLocked ? '#333' : '#bbb';
      ctx.beginPath(); ctx.arc(s.x, s.y, isLocked ? 3.5 : 2.2, 0, Math.PI*2);
      ctx.fillStyle = col; ctx.globalAlpha = isLocked ? 1 : alpha; ctx.fill();
      if (isLocked) {
        ctx.beginPath(); ctx.arc(s.x, s.y, 7 + 2*Math.sin(_futurePulsePhase*3), 0, Math.PI*2);
        ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.5; ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const cs = 4;
      ctx.strokeStyle = isLocked ? '#888' : '#ddd'; ctx.lineWidth = 0.5; ctx.globalAlpha = isLocked ? 0.9 : 0.5;
      ctx.beginPath(); ctx.moveTo(s.x - cs, s.y); ctx.lineTo(s.x + cs, s.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s.x, s.y - cs); ctx.lineTo(s.x, s.y + cs); ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx.fillStyle = '#ccc'; ctx.globalAlpha = alpha; ctx.fill(); ctx.globalAlpha = 1;
    }
  });

  const sx = _futureScanLine * (w - 20) + 10;
  ctx.strokeStyle = '#111'; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.12;
  ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(sx, h - 10, 3, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#ddd'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.arc(sx, h - 10, 8, 0, Math.PI*2); ctx.stroke();

  _futureAnimFrame = requestAnimationFrame(() => futureDrawMap(canvas));
}

/* ---- 滑块更新 ---- */
function futureUpdate() {
  const slider = document.getElementById('futureSlider');
  if (!slider) return;
  const v = parseInt(slider.value);
  _futureScanLine = v / 1000;

  const declVal   = document.getElementById('futureDeclVal');
  const lockTag   = document.getElementById('futureLockTag');
  const noiseTxt  = document.getElementById('futureNoiseTxt');
  const clearWrap = document.getElementById('futureClearWrap');
  const clearMain = document.getElementById('futureClearMain');

  if (declVal) declVal.textContent = futureDegStr(v);

  let found = null;
  FUTURE_FREQ_POINTS.forEach((fp, i) => { if (Math.abs(v - fp) <= 18) found = i; });

  if (found !== null && _futureSegments[found]) {
    if (_futureLocked !== found) {
      _futureLocked = found;
      clearInterval(_futureNoiseTimer);
      const seg = _futureSegments[found];

      if (noiseTxt)  { noiseTxt.style.opacity = '0'; setTimeout(()=>{ noiseTxt.style.display='none'; }, 250); }
      if (clearWrap) { clearWrap.style.display = 'block'; setTimeout(()=>{ clearWrap.style.opacity='1'; }, 10); }
      if (clearMain) clearMain.textContent = seg.body;
      if (lockTag)   lockTag.textContent = 'LOCKED';

      const heartTxt = document.getElementById('futureHeartTxt');
      const heartDiv = document.getElementById('futureClearHeart');
      const heartBtn = document.getElementById('futureHeartBtn');
      if (heartTxt) heartTxt.textContent = seg.heart || '';
      if (heartDiv) { heartDiv.style.maxHeight = '0'; heartDiv.style.opacity = '0'; }
      if (heartBtn) {
        heartBtn.dataset.open = '0';
        const btnTxt = document.getElementById('futureHeartBtnTxt');
        if (btnTxt) btnTxt.textContent = '听听 Ta 的心声';
        heartBtn.style.display = seg.heart ? 'flex' : 'none';
      }

      const sigBar = document.getElementById('futureSigBar');
      const sigPct = document.getElementById('futureSigPct');
      const sigVal = seg.sig || Math.floor(75 + Math.random() * 25);
      if (sigBar) sigBar.style.width = sigVal + '%';
      if (sigPct) sigPct.textContent = sigVal + '%';

      if (!_futureCollected.has(found)) {
        setTimeout(() => {
          _futureCollected.add(found);
          futureRenderSediment();
          futureUpdateProgress();
          futureSaveCache();
        }, 800);
      }
    }
  } else {
    if (_futureLocked !== null) {
      _futureLocked = null;
      if (clearWrap) { clearWrap.style.opacity='0'; setTimeout(()=>{ clearWrap.style.display='none'; },250); }
      if (noiseTxt)  { noiseTxt.style.display=''; setTimeout(()=>{ noiseTxt.style.opacity='1'; },10); }
      if (lockTag)   lockTag.textContent = 'SCANNING';
    }
    clearInterval(_futureNoiseTimer);
    _futureNoiseTimer = setInterval(() => {
      const el = document.getElementById('futureNoiseTxt');
      if (el) el.textContent = futureMkNoise();
    }, 80);
  }
}

/* ---- 心声展开/收起 ---- */
function futureToggleHeart() {
  const heartDiv = document.getElementById('futureClearHeart');
  const heartBtn = document.getElementById('futureHeartBtn');
  if (!heartDiv || !heartBtn) return;
  const isOpen = heartBtn.dataset.open === '1';
  if (isOpen) {
    heartDiv.style.maxHeight = '0'; heartDiv.style.opacity = '0';
    heartBtn.dataset.open = '0';
    document.getElementById('futureHeartBtnTxt').textContent = '听听 Ta 的心声';
  } else {
    heartDiv.style.maxHeight = '800px'; heartDiv.style.opacity = '1';
    heartBtn.dataset.open = '1';
    document.getElementById('futureHeartBtnTxt').textContent = '收起心声';
  }
}

/* ---- 沉淀区渲染 ---- */
function futureRenderSediment() {
  const el = document.getElementById('futureSediment');
  if (!el) return;
  el.innerHTML = '';

  window.futureSedimentToggleHeart = function(btn, idx) {
    const box = document.getElementById('futureSedHeart_' + idx);
    if (!box) return;
    const isOpen = btn.dataset.open === '1';
    if (isOpen) {
      box.style.maxHeight = '0'; box.style.opacity = '0';
      btn.dataset.open = '0';
      btn.querySelector('.sed-btn-txt').textContent = '听听 Ta 的心声';
    } else {
      box.style.maxHeight = '800px'; box.style.opacity = '1';
      btn.dataset.open = '1';
      btn.querySelector('.sed-btn-txt').textContent = '收起心声';
    }
  };

  for (let i = 0; i < 7; i++) {
    const has = _futureCollected.has(i);
    const seg = _futureSegments[i];
    const div = document.createElement('div');
    div.style.cssText = 'padding:20px 0;border-bottom:0.5px solid #f0f0f0;';
    if (has && seg) {
      const hasHeart = seg.heart && seg.heart.trim().length > 0;
      div.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <div style="width:5px;height:5px;border-radius:50%;background:#333;flex-shrink:0;"></div>
          <div style="font-size:9px;color:#aaa;font-family:monospace;letter-spacing:0.1em;">SIGNAL · ${String(i+1).padStart(2,'0')}</div>
        </div>
        <div style="font-size:15px;color:#111;line-height:2;letter-spacing:0.03em;">${seg.body.replace(/\n/g,'<br>')}</div>
        ${hasHeart ? `
        <button data-open="0" onclick="futureSedimentToggleHeart(this,${i})"
          style="margin-top:10px;display:flex;align-items:center;gap:6px;background:none;border:0.5px solid #e8e8e8;border-radius:20px;padding:5px 12px;cursor:pointer;font-size:12px;color:#aaa;letter-spacing:0.06em;">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span class="sed-btn-txt">听听 Ta 的心声</span>
        </button>
        <div id="futureSedHeart_${i}" style="overflow:hidden;max-height:0;opacity:0;transition:max-height 0.4s ease,opacity 0.4s ease;">
          <div style="margin-top:10px;padding:14px 16px;border-left:2px solid #ccc;background:#f7f7f7;border-radius:0 8px 8px 0;">
            <div style="font-size:9px;letter-spacing:0.16em;color:#bbb;margin-bottom:8px;">心声</div>
            <div style="font-size:15px;color:#333;line-height:1.9;letter-spacing:0.03em;font-style:italic;">${seg.heart.replace(/\n/g,'<br>')}</div>
          </div>
        </div>` : ''}`;
    } else {
      div.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:5px;height:5px;border-radius:50%;background:#e8e8e8;flex-shrink:0;"></div>
          <div style="font-size:9px;color:#ddd;font-family:monospace;letter-spacing:0.1em;">— — LIGHT YEAR</div>
        </div>
        <div style="padding-left:13px;margin-top:8px;font-size:13px;color:#ddd;font-style:italic;letter-spacing:0.06em;">· · · 待捕捉 · · ·</div>`;
    }
    el.appendChild(div);
  }
}

/* ---- 进度条 ---- */
function futureUpdateProgress() {
  const n = _futureCollected.size, t = 7;
  const fill  = document.getElementById('futureCbFill');
  const count = document.getElementById('futureCbCount');
  if (fill)  fill.style.width  = (n / t * 100) + '%';
  if (count) count.textContent = n + ' / ' + t;
}

/* ---- IndexedDB ---- */
function futureOpenDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FUTURE_DB_NAME, 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(FUTURE_DB_STORE, { keyPath: 'id' });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = () => reject(req.error);
  });
}

async function futureLoadCache() {
  try {
    const db = await futureOpenDB();
    const tx = db.transaction(FUTURE_DB_STORE, 'readonly');
    return await new Promise(resolve => {
      const req = tx.objectStore(FUTURE_DB_STORE).get(FUTURE_CACHE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = () => resolve(null);
    });
  } catch { return null; }
}

async function futureSaveCache() {
  try {
    const db = await futureOpenDB();
    const tx = db.transaction(FUTURE_DB_STORE, 'readwrite');
    tx.objectStore(FUTURE_DB_STORE).put({
      id:        FUTURE_CACHE_KEY,
      segments:  _futureSegments,
      collected: [..._futureCollected],
      savedAt:   Date.now(),
    });
  } catch(e) { console.warn('futureSaveCache error:', e); }
}

/* ---- UI 初始化 ---- */
function futureInitUI() {
  const loading = document.getElementById('futureLoading');
  const main    = document.getElementById('futureMain');
  if (loading) loading.style.display = 'none';
  if (main)    main.style.display    = 'block';

  futureRenderSediment();
  futureUpdateProgress();

  // 绑定滑块
  const slider = document.getElementById('futureSlider');
  if (slider) {
    slider.removeEventListener('input', futureUpdate);
    slider.addEventListener('input', futureUpdate);
  }

  // 启动噪音
  clearInterval(_futureNoiseTimer);
  _futureNoiseTimer = setInterval(() => {
    const el = document.getElementById('futureNoiseTxt');
    if (el) el.textContent = futureMkNoise();
  }, 80);

  // 启动星图
  const canvas = document.getElementById('futureStarCanvas');
  if (canvas) {
    futureInitStars(canvas);
    if (_futureAnimFrame) cancelAnimationFrame(_futureAnimFrame);
    futureDrawMap(canvas);
  }
}

/* ---- 主生成函数 ---- */
async function futureGenerate() {
  // 先查缓存
  const cached = await futureLoadCache();
  if (cached && Array.isArray(cached.segments) && cached.segments.length > 0) {
    _futureSegments  = cached.segments;
    _futureCollected = new Set(cached.collected || []);
    futureInitUI();
    return;
  }

  // 无缓存，调 AI
  let charName    = 'Ta';
  let charPersona = '';
  let userPersona = '';

  try {
    const currentCharName = (typeof _cpCurrentName !== 'undefined' && _cpCurrentName) ? _cpCurrentName : '';
    const currentChar = currentCharName ? await getCharDataByName(currentCharName) : null;
    if (currentChar) {
      charName = currentChar.name || charName;
      charPersona = [
        currentChar.role   ? `定位/身份：${currentChar.role}`   : '',
        currentChar.gender ? `性别：${currentChar.gender}`       : '',
        currentChar.age    ? `年龄：${currentChar.age}`          : '',
        currentChar.desc   ? `人设描述：${currentChar.desc}`     : '',
        currentChar.traits?.length
          ? `性格标签：${Array.isArray(currentChar.traits) ? currentChar.traits.join('、') : currentChar.traits}` : '',
        currentChar.prompt ? `系统提示词：${currentChar.prompt}` : '',
      ].filter(Boolean).join('\n');
    }
    const userPersonas = JSON.parse(localStorage.getItem('luna_user_personas') || '[]');
    if (currentChar?.id) {
      const bound = userPersonas.find(p => String(p.charId) === String(currentChar.id));
      if (bound?.content) userPersona = bound.content;
    }
    if (!userPersona) userPersona = localStorage.getItem('luna_user_profile') || '';
  } catch(e) {}

  const systemPrompt = `你是一个擅长写细腻情感散文的 AI。
任务：以角色「${charName}」的视角，想象并写出若干年后的未来，Ta 回望现在，眼中看到的 user（"你"）。
格式要求（严格遵守）：分成恰好 7 组，每组包含正文和心声，用 ---SPLIT--- 分隔：

正文：（150-220字，未来的视角回望，有具体画面和时间感，像一束来自未来的光）
心声：（40-70字，比正文更私密、更直白，那层在未来才终于敢说的话）

---SPLIT---

（下一组）

整体要求：
- 以「${charName}」的口吻，带有时光距离感
- 7组正文总字数不少于1500字
- 有具体场景和细节，不空泛
- 心声比正文更脆弱，是那层在未来才终于说出的话
- 最后一组要有余韵，像星光抵达`;

  const userPrompt = userPersona
    ? `角色人设：\n${charPersona || '（温柔感性、善于观察）'}\n\n用户档案：\n${userPersona}\n\n请生成7组正文+心声，总字数1500字以上。`
    : `角色人设：\n${charPersona || '（温柔感性、善于观察）'}\n\n没有用户档案，请自由想象用户形象，生成7组正文+心声，总字数1500字以上。`;

  try {
    const cur   = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
    const model = localStorage.getItem('luna_api_model') || '';
    if (!cur.baseUrl || !cur.apiKey || !model) throw new Error('未配置 API');

    const response = await fetch(`${cur.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cur.apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] })
    });

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || '';
    if (!text) throw new Error('返回为空');

    _futureSegments = [];
    let blocks = text.split(/---SPLIT---|—{3,}SPLIT—{3,}|={3,}/);
    if (blocks.length <= 1) {
      blocks = text.split(/\n(?=\d+[\.、]|\【\d|第[一二三四五六七])/);
    }

    blocks.forEach(block => {
      if (!block.trim()) return;
      let bodyMatch  = block.match(/正文[：:]([\s\S]*?)(?=心声[：:]|$)/);
      let heartMatch = block.match(/心声[：:]([\s\S]*?)(?=正文[：:]|---|$)/);
      let body  = bodyMatch?.[1]?.trim()  || '';
      let heart = heartMatch?.[1]?.trim() || '';
      if (!body) {
        const lines = block.trim().split('\n').filter(l => l.trim());
        body  = lines.slice(0, Math.ceil(lines.length * 0.75)).join('\n').trim();
        heart = lines.slice(Math.ceil(lines.length * 0.75)).join('\n').trim();
      }
      const cleanText = t => t.replace(/\*\*/g,'').replace(/\*/g,'').replace(/#+\s/g,'').trim();
      if (body.length > 20) _futureSegments.push({ body: cleanText(body), heart: cleanText(heart), sig: Math.floor(75 + Math.random() * 25) });
    });

    if (_futureSegments.length === 0 && text.length > 100) {
      const clean = text.replace(/正文[：:]|心声[：:]|---SPLIT---|[\r]/g, '').trim();
      const paraSize = Math.ceil(clean.length / 7);
      for (let i = 0; i < 7; i++) {
        const body = clean.slice(i * paraSize, (i + 1) * paraSize).trim();
        if (body.length > 10) _futureSegments.push({ body, heart: '', sig: Math.floor(75 + Math.random() * 25) });
      }
    }

    if (_futureSegments.length === 0) throw new Error('内容为空，请重试');

    await futureSaveCache();
    futureInitUI();

  } catch(err) {
    console.error('futureGenerate error:', err);
    const loadingEl = document.getElementById('futureLoading');
    if (loadingEl) loadingEl.innerHTML =
      `<div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:20px;">
        <div style="font-size:12px;color:#bbb;letter-spacing:0.1em;">信号中断</div>
        <div style="font-size:11px;color:#f87171;text-align:center;line-height:1.6;max-width:240px;">${err.message}</div>
        <div style="font-size:10px;color:#ccc;text-align:center;line-height:1.8;max-width:260px;">
          baseUrl: ${JSON.parse(localStorage.getItem('luna_api_current')||'{}').baseUrl || '❌ 未设置'}<br>
          apiKey: ${JSON.parse(localStorage.getItem('luna_api_current')||'{}').apiKey ? '✅ 已设置' : '❌ 未设置'}<br>
          model: ${localStorage.getItem('luna_api_model') || '❌ 未设置'}
        </div>
      </div>`;
  }
}

async function openMiyouPage() {
  const page    = document.getElementById('miyouPage');
  const overlay = document.getElementById('miyouOverlay');
  if (!page) return;

  page.classList.add('active');
  if (overlay) { overlay.style.display = ''; overlay.classList.add('active'); }

  // 同步时间
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeEl = document.getElementById('miyouStatusTime');
  if (timeEl) timeEl.textContent = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });

  // 同步电量
  const mainPct   = document.getElementById('batPct');
  const mainInner = document.getElementById('batInner');
  const myPct     = document.getElementById('miyouBatPct');
  const myInner   = document.getElementById('miyouBatInner');
  if (myPct && mainPct)     myPct.textContent      = mainPct.textContent;
  if (myInner && mainInner) {
    myInner.style.width      = mainInner.style.width;
    myInner.style.background = mainInner.style.background;
  }

  // 同步灵动岛
  const enabled  = localStorage.getItem('luna_island_enabled') === 'true';
  const style    = localStorage.getItem('luna_island_style') || 'minimal';
  const islandEl = document.getElementById('miyouStatusIsland');
  if (islandEl) {
    if (!enabled) { islandEl.innerHTML = ''; }
    else {
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
      islandEl.innerHTML = styleMap[style] || styleMap.minimal;
    }
  }

  // ── 读取当前角色数据并填充密友圈信息条 ──
  const name = typeof _cpCurrentName !== 'undefined' ? _cpCurrentName : null;
  if (!name) return;

  const charData = await getCharDataByName(name);

  // 头像
  const avatarEl = document.getElementById('miyouCharAvatar');
  if (avatarEl) {
    if (charData?.avatar) {
      avatarEl.innerHTML = `<img src="${charData.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:14px;display:block;"/>`;
      avatarEl.style.fontSize = '0';
      avatarEl.style.padding  = '0';
    } else {
      avatarEl.textContent    = (charData?.name || name || '?')[0];
      avatarEl.style.fontSize = '';
      avatarEl.style.padding  = '';
    }
  }

  // 角色名
  const nameEl = document.getElementById('miyouCharName');
  if (nameEl) nameEl.textContent = charData?.name || name || '—';

  // 身份/职业（role）
  const titleEl = document.getElementById('miyouCharTitle');
  if (titleEl) titleEl.textContent = charData?.role || '神秘角色';

  // 性格标签（traits）
  const tagsEl = document.getElementById('miyouCharTags');
  if (tagsEl) {
    const traits = charData?.traits || [];
    if (traits.length > 0) {
      tagsEl.innerHTML = traits.map(t => `<div class="miyou-cs-tag">${t}</div>`).join('');
    } else {
      tagsEl.innerHTML = '<div class="miyou-cs-tag">暂无标签</div>';
      const friendsEl  = document.getElementById('miyouStatFriends');
      const eventsEl   = document.getElementById('miyouStatEvents');
      const unlockedEl = document.getElementById('miyouStatUnlocked');
      const lockedEl   = document.getElementById('miyouStatLocked');
      if (friendsEl)  friendsEl.textContent  = charData?.friendCount   ?? 0;
      if (eventsEl)   eventsEl.textContent   = charData?.eventCount    ?? 0;
      if (unlockedEl) unlockedEl.textContent = charData?.unlockedCount ?? 0;
      if (lockedEl)   lockedEl.textContent   = charData?.lockedCount   ?? 0;
    }
  }
}

function closeMiyouPage() {
  const page    = document.getElementById('miyouPage');
  const overlay = document.getElementById('miyouOverlay');
  if (page)    page.classList.remove('active');
  if (overlay) { overlay.classList.remove('active'); overlay.style.display = 'none'; }
}

/* ---- Social Map 全屏页 ---- */
function openSocialMapPage() {
  document.getElementById('smOverlay').classList.add('open');
  document.getElementById('smFullpage').classList.add('open');

  // 同步状态栏时间
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeStr = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const smTime = document.getElementById('smStatusTime');
  if (smTime) smTime.textContent = timeStr;

  // 同步电量
  const mainPct = document.getElementById('batPct');
  const smPct = document.getElementById('smBatPct');
  const smInner = document.getElementById('smBatInner');
  if (mainPct && smPct) {
    smPct.textContent = mainPct.textContent;
    const p = parseInt(mainPct.textContent);
    if (smInner) {
      smInner.style.width = p + '%';
      smInner.style.background = p <= 20
        ? 'linear-gradient(90deg,#f87171,#ef4444)'
        : 'linear-gradient(90deg,#6ee7b7,#34d399)';
    }
  }

  // 同步灵动岛
  const smEnabled = localStorage.getItem('luna_island_enabled') === 'true';
  const smStyle   = localStorage.getItem('luna_island_style') || 'minimal';
  const smIsland  = document.getElementById('smStatusIsland');
  if (smIsland) {
    if (!smEnabled) { smIsland.innerHTML = ''; }
    else {
      const smStyleMap = {
        minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
        glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
        clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text">--:--</span></div></div>`,
        pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
        ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
        rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
        music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
        scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
      };
      smIsland.innerHTML = smStyleMap[smStyle] || smStyleMap.minimal;
    }
  }

  // filter按钮交互
  document.querySelectorAll('.sm-filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.sm-filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
    });
  });

  // 动态渲染数据
  smRenderAll();
}

function closeSocialMapPage() {
  document.getElementById('smOverlay').classList.remove('open');
  document.getElementById('smFullpage').classList.remove('open');
}

/* ================================
   Social Map 动态渲染
================================ */

// 封面装饰SVG循环（5种）
const SM_COVER_SVGS = [
  `<svg style="position:absolute;inset:0;width:100%;height:100%;opacity:0.3" viewBox="0 0 160 52"><line x1="0" y1="26" x2="160" y2="26" stroke="#555" stroke-width="0.4"/><line x1="80" y1="0" x2="80" y2="52" stroke="#555" stroke-width="0.4"/><circle cx="80" cy="26" r="18" stroke="#555" stroke-width="0.4" fill="none"/></svg>`,
  `<svg style="position:absolute;inset:0;width:100%;height:100%;opacity:0.3" viewBox="0 0 160 52"><rect x="30" y="10" width="100" height="32" rx="3" stroke="#555" stroke-width="0.4" fill="none"/><line x1="30" y1="26" x2="130" y2="26" stroke="#555" stroke-width="0.4"/></svg>`,
  `<svg style="position:absolute;inset:0;width:100%;height:100%;opacity:0.3" viewBox="0 0 160 52"><circle cx="40" cy="26" r="14" stroke="#555" stroke-width="0.4" fill="none"/><circle cx="120" cy="26" r="14" stroke="#555" stroke-width="0.4" fill="none"/><line x1="54" y1="26" x2="106" y2="26" stroke="#555" stroke-width="0.4"/></svg>`,
  `<svg style="position:absolute;inset:0;width:100%;height:100%;opacity:0.3" viewBox="0 0 160 52"><polygon points="80,8 130,44 30,44" stroke="#555" stroke-width="0.4" fill="none"/><line x1="80" y1="8" x2="80" y2="44" stroke="#555" stroke-width="0.3"/></svg>`,
  `<svg style="position:absolute;inset:0;width:100%;height:100%;opacity:0.25" viewBox="0 0 160 52"><line x1="0" y1="0" x2="160" y2="52" stroke="#555" stroke-width="0.5"/><line x1="160" y1="0" x2="0" y2="52" stroke="#555" stroke-width="0.5"/></svg>`,
];

// 封面背景色（按index循环）
const SM_COVER_COLORS = ['#e8e6e4','#e4e8ec','#e8e4ec','#ece8e4','#e4e2e0'];

// 格式化时间戳为 MM.DD.YYYY
function smFormatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  const yy = d.getFullYear();
  return `${mm}.${dd}.${yy}`;
}

// 生成角色卡片 HTML
function smBuildCharCard(char, idx) {
  const coverSvg   = SM_COVER_SVGS[idx % SM_COVER_SVGS.length];
  const coverColor = SM_COVER_COLORS[idx % SM_COVER_COLORS.length];
  const coverBg    = char.cardBg
    ? `background-image:url(${char.cardBg});background-size:cover;background-position:center;`
    : `background:${coverColor};`;

  const avatarContent = char.avatar
    ? `<img src="${char.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;display:block;"/>`
    : (char.name||'?')[0];

  const tagsHtml = (char.traits||[]).slice(0,2).map(t =>
    `<span class="sm-tag">${t}</span>`
  ).join('');

  const roleLine = [char.role, char.age ? char.age+'岁' : '', char.gender].filter(Boolean).join(' · ');
  const since    = smFormatDate(char.createdAt);
  const onlineDot = char.online
    ? `<div class="sm-online-dot on"></div>`
    : '';
  const relBadge = char.rel
    ? `<div class="sm-card-rel-badge">${char.rel}</div>`
    : '';

  return `
  <div class="sm-card" onclick="smOpenChat('${(char.name||'').replace(/'/g,"\\'")}')">
    <div class="sm-card-cover" style="${coverBg}">${coverSvg}
      <div class="sm-card-type-badge">CHARACTER</div>
    </div>
    <div class="sm-card-body">
      <div class="sm-card-avatar-row">
        <div class="sm-avatar">${avatarContent}</div>
        ${onlineDot}
        ${relBadge}
      </div>
      <div class="sm-card-name">${char.name||'—'}</div>
      <div class="sm-card-role">${roleLine||'—'}</div>
      <div class="sm-card-tags">${tagsHtml}</div>
    </div>
    <div class="sm-card-footer">
      <span class="sm-card-since">${since}</span>
      <div class="sm-card-actions">
        <div class="sm-card-action"><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></div>
        <div class="sm-card-action"><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/><circle cx="5" cy="12" r="1.5" fill="currentColor"/></svg></div>
      </div>
    </div>
  </div>`;
}

// 生成 NPC 卡片 HTML
function smBuildNpcCard(npc, fromCharName, idx, charId, npcIdx) {
  // 封面背景：优先用户上传，没有则用默认色
  const coverBg = npc.cardBg
    ? `background-image:url(${npc.cardBg});background-size:cover;background-position:center;`
    : `background:${SM_COVER_COLORS[(idx + 2) % SM_COVER_COLORS.length]};`;
  const coverSvg = npc.cardBg ? '' : SM_COVER_SVGS[(idx + 2) % SM_COVER_SVGS.length];

  // 头像：优先用户上传，没有则用首字
  const avatarContent = npc.avatar
    ? `<img src="${npc.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;display:block;"/>`
    : ((npc.name||'?').length > 1
        ? `<span style="font-size:11px;">${(npc.name||'?').slice(0,2)}</span>`
        : (npc.name||'?')[0]);

  const tagsHtml = (npc.traits||[]).slice(0,2).map(t =>
    `<span class="sm-tag">${t}</span>`
  ).join('');

  const relBadge = npc.rel
    ? `<div class="sm-card-rel-badge">${npc.rel}</div>`
    : `<div class="sm-card-rel-badge">其他</div>`;

  // AI NPC 判断：显式标记 或 缺少手动创建才有的表单字段（兼容旧数据）
  const _isAiNpc = npc.isAiNpc === true || (npc.hook !== undefined && npc.vibe !== undefined && !npc.fromManual);
  return `
  <div class="sm-card" data-charid="${charId}" data-npcidx="${npcIdx}"
    onclick="smNpcCardClick(event, this, '${_isAiNpc ? 'smAiNpcDetailOpen' : 'smOpenEdit'}', ${charId}, ${npcIdx})"
    style="cursor:pointer;position:relative;transition:outline 0.15s;">
    <div class="sm-card-select-check" style="display:none;position:absolute;top:8px;right:8px;width:20px;height:20px;border-radius:50%;border:2px solid #111;background:#fff;z-index:10;align-items:center;justify-content:center;">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="#111" stroke-width="2.5" stroke-linecap="round"/></svg>
    </div>
    <div class="sm-card-cover" style="${coverBg}">${coverSvg}
      <div class="sm-card-type-badge">NPC</div>
    </div>
    <div class="sm-card-body">
      <div class="sm-card-avatar-row">
        <div class="sm-avatar" style="background:#dcdad8;">${avatarContent}</div>
        ${relBadge}
      </div>
      <div class="sm-card-name">${npc.name||'—'}</div>
      <div class="sm-card-role">来自 · ${fromCharName}</div>
      <div class="sm-card-tags">${tagsHtml}</div>
    </div>
    <div class="sm-card-footer">
      <span class="sm-card-since">NPC · ${fromCharName}</span>
      <div class="sm-card-actions">
        <div class="sm-card-action"><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></div>
      </div>
    </div>
  </div>`;
}

// 添加卡片（末尾占位）
const SM_ADD_CARD = `
  <div class="sm-card" onclick="openAddContact()" style="border:1px dashed rgba(0,0,0,0.1);background:rgba(255,255,255,0.5);display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:160px;cursor:pointer;">
    <div style="width:36px;height:36px;border-radius:9px;border:0.8px dashed rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;margin-bottom:8px;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="rgba(0,0,0,0.3)" stroke-width="1.6" stroke-linecap="round"/></svg>
    </div>
    <div style="font-size:10px;color:#c0c0c0;letter-spacing:0.1em;">添加角色</div>
    <div style="font-size:9px;color:#d5d5d5;letter-spacing:0.06em;margin-top:3px;">ADD CHARACTER</div>
  </div>`;

// 动态渲染节点图谱SVG
let _smNodePhysics = null;
let _smNodePhysicsFull = null;

// 全屏展开/收起
function smNodeMapExpand() {
  const fs = document.getElementById('smNodeFullscreen');
  if (!fs) return;
  fs.classList.add('open');
  // 用全屏canvas重新跑一次物理引擎
  if (_smNodePhysicsFull) { _smNodePhysicsFull.destroy(); _smNodePhysicsFull = null; }
  const lastChars = window._smLastChars || [];
  _smNodePhysicsFull = smBuildNodePhysics('smNodeCanvasFull', lastChars, true);
}
function smNodeMapCollapse() {
  const fs = document.getElementById('smNodeFullscreen');
  if (!fs) return;
  fs.classList.remove('open');
  if (_smNodePhysicsFull) { _smNodePhysicsFull.destroy(); _smNodePhysicsFull = null; }
}

function smRenderNodeMap(chars) {
  window._smLastChars = chars; // 缓存供全屏用
  if (_smNodePhysics) { _smNodePhysics.destroy(); _smNodePhysics = null; }
  _smNodePhysics = smBuildNodePhysics('smNodeCanvas', chars, false);
}

function smBuildNodePhysics(canvasId, chars, isFullscreen) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  // 等canvas渲染完再取尺寸
  const dpr = window.devicePixelRatio || 2;
  const W = Math.max(canvas.offsetWidth || 300, isFullscreen ? window.innerWidth : 280);
  const H = isFullscreen ? (window.innerHeight - 80) : 260;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // NPC数据包含rel字段
  const charData = chars.map(ch => ({
    label: (ch.name || '?')[0].toUpperCase(),
    name: ch.name || '?',
    npcs: (ch.charNpcs || []).map(n => ({
      label: (n.name || '?')[0].toUpperCase(),
      name: n.name || '?',
      rel: n.rel || n.relType || '',       // 关系类型（恋人/友人/家人等）
      role: n.role || '',                   // 职业
    })),
  }));

  const badge = document.getElementById('smNodeMapBadge');
  const totalNpcs = charData.reduce((s, c) => s + c.npcs.length, 0);
  if (badge) badge.textContent = charData.length > 0 ? `${charData.length} chars · ${totalNpcs} npc` : '暂无数据';

  const nodes = [];
  const edges = [];

  if (charData.length === 0) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.13)';
    ctx.font = `${isFullscreen ? 14 : 10}px "DM Mono",monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('NO CONNECTIONS', W/2, H/2 - 10);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.font = `${isFullscreen ? 11 : 8}px "DM Mono",monospace`;
    ctx.fillText('添加角色与NPC开始', W/2, H/2 + 12);
    return null;
  }

  const charCount = charData.length;
  const cx = W / 2, cy = H / 2;
  // 全屏时半径更大
  const charRingR = isFullscreen
    ? Math.min(W, H) * (charCount === 1 ? 0 : 0.22)
    : Math.min(W, H) * (charCount === 1 ? 0 : 0.28);

  // 节点尺寸随全屏放大
  const charNodeR = isFullscreen ? 28 : 20;
  const npcNodeR  = isFullscreen ? 16 : 11;
  const fontSize  = isFullscreen ? 12 : 8;
  const npcFontSize = isFullscreen ? 9 : 6;
  const labelFontSize = isFullscreen ? 9 : 6.5;
  const relFontSize = isFullscreen ? 8 : 5.5;

  // 角色节点
  charData.forEach((ch, i) => {
    const angle = charCount === 1 ? 0 : (2 * Math.PI * i / charCount) - Math.PI / 2;
    nodes.push({
      id: 'char_' + i, type: 'char', charIdx: i,
      label: ch.label, name: ch.name,
      x: cx + charRingR * Math.cos(angle) + (Math.random()-0.5)*4,
      y: cy + charRingR * Math.sin(angle) + (Math.random()-0.5)*4,
      vx: 0, vy: 0, r: charNodeR, mass: 3,
      color: '#1a1a1a', textColor: '#fff',
      _sx: 1, _sy: 1, _sv: 0, _s: 0,
    });
  });

  // 角色间排斥弹簧
  for (let i = 0; i < charCount; i++) {
    for (let j = i+1; j < charCount; j++) {
      edges.push({ a: i, b: j, restLen: charRingR * 1.8, k: 0.006, isCharEdge: true });
    }
  }

  // NPC节点
  charData.forEach((ch, ci) => {
    const charNode = nodes[ci];
    const npcCount = ch.npcs.length;
    ch.npcs.forEach((npc, ni) => {
      const baseAngle = charCount === 1 ? 0 : (2 * Math.PI * ci / charCount) - Math.PI / 2;
      const spread = npcCount <= 1 ? 0 : (ni / (npcCount-1) - 0.5) * (npcCount <= 2 ? 1.2 : 2.0);
      const angle = baseAngle + spread;
      const dist = (charNodeR + npcNodeR + (isFullscreen ? 55 : 38)) + (Math.random()-0.5)*6;
      const nodeIdx = nodes.length;
      nodes.push({
        id: `npc_${ci}_${ni}`, type: 'npc', charIdx: ci,
        label: npc.label, name: npc.name,
        rel: npc.rel, role: npc.role,
        x: charNode.x + dist * Math.cos(angle),
        y: charNode.y + dist * Math.sin(angle),
        vx: 0, vy: 0, r: npcNodeR, mass: 1,
        color: '#f0ede8', textColor: '#777',
        _sx: 1, _sy: 1, _sv: 0, _s: 0,
      });
      edges.push({ a: ci, b: nodeIdx, restLen: dist * 0.9, k: 0.035, rel: npc.rel });
    });
  });

  // 拖拽
  let dragging = null, dragOX = 0, dragOY = 0;
  let running = true, animId = null;

  function getXY(e) {
    const r = canvas.getBoundingClientRect();
    const s = e.touches ? e.touches[0] : e;
    return {
      x: (s.clientX - r.left) * (W / r.width),
      y: (s.clientY - r.top) * (H / r.height),
    };
  }
  function hit(x, y) {
    for (let i = nodes.length-1; i >= 0; i--) {
      const n = nodes[i];
      if ((x-n.x)**2 + (y-n.y)**2 < (n.r+8)**2) return i;
    }
    return -1;
  }
  function onDown(e) {
    const p = getXY(e);
    const idx = hit(p.x, p.y);
    if (idx >= 0) {
      dragging = idx; dragOX = nodes[idx].x - p.x; dragOY = nodes[idx].y - p.y;
      nodes[idx]._sv = 0.35;
      canvas.style.cursor = 'grabbing';
      e.preventDefault();
    }
  }
  function onMove(e) {
    if (dragging === null) return;
    const p = getXY(e);
    const n = nodes[dragging];
    const nx = p.x + dragOX, ny = p.y + dragOY;
    const spd = Math.hypot(nx - n.x, ny - n.y);
    n.x = nx; n.y = ny; n.vx = 0; n.vy = 0;
    n._sv = Math.min(spd * 0.05, 0.45);
    e.preventDefault();
  }
  function onUp() {
    if (dragging !== null) { nodes[dragging]._sv = 0.28; dragging = null; }
    canvas.style.cursor = 'grab';
  }

  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseup', onUp);
  canvas.addEventListener('mouseleave', onUp);
  canvas.addEventListener('touchstart', onDown, {passive:false});
  canvas.addEventListener('touchmove', onMove, {passive:false});
  canvas.addEventListener('touchend', onUp);

  // 物理
  function step() {
    // 弹簧
    edges.forEach(e => {
      const a = nodes[e.a], b = nodes[e.b];
      const dx = b.x-a.x, dy = b.y-a.y;
      const d = Math.hypot(dx,dy) || 0.01;
      const f = (d - e.restLen) * e.k;
      const fx = dx/d*f, fy = dy/d*f;
      if (dragging !== e.a) { a.vx += fx/a.mass; a.vy += fy/a.mass; }
      if (dragging !== e.b) { b.vx -= fx/b.mass; b.vy -= fy/b.mass; }
    });
    // 排斥
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i+1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x-a.x, dy = b.y-a.y;
        const d2 = dx*dx+dy*dy || 0.01;
        const minD = a.r + b.r + 10;
        if (d2 < minD*minD) {
          const d = Math.sqrt(d2);
          const f = 700/d2;
          const fx = dx/d*f, fy = dy/d*f;
          if (dragging !== i) { a.vx -= fx/a.mass; a.vy -= fy/a.mass; }
          if (dragging !== j) { b.vx += fx/b.mass; b.vy += fy/b.mass; }
        }
      }
    }
    // 更新
    nodes.forEach((n, i) => {
      if (i === dragging) return;
      n.vx *= 0.80; n.vy *= 0.80;
      n.x += n.vx; n.y += n.vy;
      const pad = n.r + 6;
      if (n.x < pad) { n.x = pad; n.vx *= -0.35; }
      if (n.x > W-pad) { n.x = W-pad; n.vx *= -0.35; }
      if (n.y < pad) { n.y = pad; n.vy *= -0.35; }
      if (n.y > H-pad) { n.y = H-pad; n.vy *= -0.35; }
    });
    // 果冻
    nodes.forEach(n => {
      const spd = Math.hypot(n.vx, n.vy);
      if (spd > 0.4) n._sv += spd * 0.01;
      n._s += n._sv;
      n._sv -= n._s * 0.22;
      n._sv *= 0.76;
      const sq = Math.sin(n._s) * 0.13;
      n._sx = 1 + sq; n._sy = 1 - sq * 0.65;
    });
  }

  // 绘制关系标签（在连线中点）
  function drawEdgeLabel(a, b, rel) {
    if (!rel) return;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const text = rel.length > 4 ? rel.slice(0,4) : rel;
    ctx.save();
    // 小背景胶囊
    ctx.font = `${relFontSize}px "DM Mono",monospace`;
    const tw = ctx.measureText(text).width;
    const pw = tw + 6, ph = relFontSize + 4;
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.beginPath();
    ctx.roundRect(mx - pw/2, my - ph/2, pw, ph, ph/2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, mx, my);
    ctx.restore();
  }

  function drawNode(n) {
    ctx.save();
    ctx.translate(n.x, n.y);
    ctx.scale(n._sx, n._sy);
    // 阴影
    ctx.shadowColor = n.type==='char' ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = n.type==='char' ? 14 : 6;
    ctx.shadowOffsetY = n.type==='char' ? 3 : 1;
    // 主圆
    ctx.beginPath(); ctx.arc(0,0,n.r,0,Math.PI*2);
    ctx.fillStyle = n.color; ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    // 高光
    const g = ctx.createRadialGradient(-n.r*0.3,-n.r*0.4,0,0,0,n.r);
    g.addColorStop(0,'rgba(255,255,255,0.25)');
    g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.beginPath(); ctx.arc(0,0,n.r,0,Math.PI*2);
    ctx.fillStyle = g; ctx.fill();
    // NPC边框
    if (n.type==='npc') {
      ctx.beginPath(); ctx.arc(0,0,n.r,0,Math.PI*2);
      ctx.strokeStyle='rgba(0,0,0,0.08)'; ctx.lineWidth=0.8; ctx.stroke();
    }
    // 文字
    ctx.fillStyle = n.textColor;
    ctx.font = `${n.type==='char'?600:500} ${n.type==='char'?fontSize:npcFontSize}px "DM Mono",monospace`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(n.label, 0, 0.5);
    ctx.restore();

    // 角色名（圆下方）
    if (n.type==='char') {
      ctx.save();
      ctx.fillStyle='rgba(0,0,0,0.5)';
      ctx.font=`500 ${labelFontSize}px "DM Mono",monospace`;
      ctx.textAlign='center'; ctx.textBaseline='top';
      const displayName = n.name.length > 5 ? n.name.slice(0,5) : n.name;
      ctx.fillText(displayName, n.x, n.y + n.r + 5);
      ctx.restore();
    }

    // NPC名（圆下方）+ rel标签（圆上方）
    if (n.type==='npc') {
      ctx.save();
      ctx.fillStyle='rgba(0,0,0,0.38)';
      ctx.font=`${labelFontSize}px "DM Mono",monospace`;
      ctx.textAlign='center'; ctx.textBaseline='top';
      const nname = n.name.length > 4 ? n.name.slice(0,4) : n.name;
      ctx.fillText(nname, n.x, n.y + n.r + 3);
      ctx.restore();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // 连线 + 关系标签
    edges.forEach(e => {
      const a = nodes[e.a], b = nodes[e.b];
      if (!a || !b) return;
      ctx.save();
      const isCharEdge = e.isCharEdge;
      ctx.strokeStyle = isCharEdge ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.15)';
      ctx.lineWidth = isCharEdge ? 0.6 : 1.2;
      ctx.setLineDash(isCharEdge ? [3,7] : [5,4]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.restore();
      // 在连线中点画关系标签
      if (!isCharEdge && e.rel) drawEdgeLabel(a, b, e.rel);
    });

    nodes.forEach(drawNode);
  }

  function loop() {
    if (!running) return;
    step(); draw();
    animId = requestAnimationFrame(loop);
  }
  loop();

  return {
    destroy() {
      running = false;
      if (animId) cancelAnimationFrame(animId);
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('mouseleave', onUp);
      canvas.removeEventListener('touchstart', onDown);
      canvas.removeEventListener('touchmove', onMove);
      canvas.removeEventListener('touchend', onUp);
    }
  };
}

// 主渲染函数：读取IndexedDB后刷新整个Social Map
async function smRenderAll() {
  // 1. 读取所有角色
  const chars = await new Promise(res => {
    const req = indexedDB.open('LunaCharDB', 4);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('chars'))
        d.createObjectStore('chars', { keyPath:'id', autoIncrement:true });
    };
    req.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('chars')) { res([]); return; }
      const r = db.transaction('chars').objectStore('chars').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror   = () => res([]);
    };
    req.onerror = () => res([]);
  });

  // 2. 用 convData 补充 createdAt / online / rel 信息到角色
  const convMap = {};
  (convData || []).forEach(c => { convMap[c.name] = c; });
  chars.forEach(ch => {
    const conv = convMap[ch.name];
    if (conv) {
      ch.createdAt = ch.createdAt || conv.createdAt || conv.timeVal;
      ch.online    = conv.online || false;
    }
  });

  // 3. 收集所有NPC
  const npcs = [];
  chars.forEach(ch => {
    (ch.charNpcs || []).forEach((n, npcIdx) => {
      npcs.push({ npc: n, fromCharName: ch.name, charId: ch.id, npcIdx });
    });
  });

  // 4. 更新统计数字
  const fmt = n => String(n).padStart(2,'0');
  const statChar  = document.getElementById('smStatChar');
  const statNpc   = document.getElementById('smStatNpc');
  const statTotal = document.getElementById('smStatTotal');
  const smCharCnt = document.getElementById('smCharCount');
  const smNpcCnt  = document.getElementById('smNpcCount');
  // 有NPC的角色数量（去重）
  const charsWithNpc = new Set(npcs.map(item => item.fromCharName)).size;
  if (statChar)  statChar.textContent  = fmt(charsWithNpc);
  if (statNpc)   statNpc.textContent   = fmt(npcs.length);
  if (statTotal) statTotal.textContent = fmt(npcs.length);
  if (smCharCnt) smCharCnt.textContent = fmt(chars.length);
  if (smNpcCnt)  smNpcCnt.textContent  = fmt(npcs.length);

  // 5. 渲染节点图谱
  smRenderNodeMap(chars);

  // 6. 角色区永远不显示（Social Map只展示NPC关系）
  const charSection = document.getElementById('smCharSection');
  if (charSection) charSection.style.display = 'none';

  // 7. 渲染NPC区：按来源角色分组显示
  const npcSection = document.getElementById('smNpcSection');
  const npcGrid    = document.getElementById('smNpcGrid');
  if (npcGrid) {
    if (npcs.length > 0) {
      npcSection.style.display = '';
      npcGrid.innerHTML = npcs.map((item, i) => smBuildNpcCard(item.npc, item.fromCharName, i, item.charId, item.npcIdx)).join('') + SM_ADD_CARD;
    } else {
      npcSection.style.display = 'none';
    }
  }

  // 8. 没有NPC时显示空状态
  const emptyTip = document.getElementById('smEmptyTip');
  if (emptyTip) emptyTip.style.display = npcs.length === 0 ? '' : 'none';
}

// ===== NPC 批量选择删除功能 =====
let _smSelectMode = false;
let _smSelectedNpcs = new Set(); // 存 "charId_npcIdx" 字符串

function smToggleSelectMode() {
  _smSelectMode = !_smSelectMode;
  _smSelectedNpcs.clear();

  const btn = document.getElementById('smSelectModeBtn');
  const bar = document.getElementById('smBatchDeleteBar');
  const checks = document.querySelectorAll('.sm-card-select-check');
  const cards = document.querySelectorAll('#smNpcGrid .sm-card');

  if (_smSelectMode) {
    btn.style.background = '#111';
    btn.querySelector('svg rect, svg path, svg polyline, svg circle') && null;
    btn.style.borderRadius = '10px';
    checks.forEach(c => c.style.display = 'flex');
    bar.style.display = 'block';
    document.getElementById('smSelectedCount').textContent = '0';
  } else {
    btn.style.background = '';
    btn.style.borderRadius = '';
    checks.forEach(c => { c.style.display = 'none'; });
    cards.forEach(c => { c.style.outline = ''; });
    bar.style.display = 'none';
    _smSelectedNpcs.clear();
  }
}

function smNpcCardClick(event, el, fn, charId, npcIdx) {
  if (_smSelectMode) {
    event.stopPropagation();
    const key = charId + '_' + npcIdx;
    const check = el.querySelector('.sm-card-select-check');
    if (_smSelectedNpcs.has(key)) {
      _smSelectedNpcs.delete(key);
      el.style.outline = '';
      check.style.background = '#fff';
    } else {
      _smSelectedNpcs.add(key);
      el.style.outline = '2.5px solid #111';
      check.style.background = '#111';
      check.querySelector('svg polyline') && (check.querySelector('svg polyline').style.stroke = '#fff');
    }
    document.getElementById('smSelectedCount').textContent = _smSelectedNpcs.size;
  } else {
    window[fn](charId, npcIdx);
  }
}

async function smConfirmBatchDelete() {
  if (_smSelectedNpcs.size === 0) return;
  if (!confirm(`确定删除选中的 ${_smSelectedNpcs.size} 个 NPC？此操作不可恢复。`)) return;

  // 按 charId 分组，收集要删除的 npcIdx
  const grouped = {};
  _smSelectedNpcs.forEach(key => {
    const [charId, npcIdx] = key.split('_').map(Number);
    if (!grouped[charId]) grouped[charId] = [];
    grouped[charId].push(npcIdx);
  });

  // 逐个角色：从 IndexedDB 读出 → splice charNpcs → 写回
  await new Promise(res => {
    const req = indexedDB.open('LunaCharDB', 4);
    req.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('chars', 'readwrite');
      const store = tx.objectStore('chars');
      const charIds = Object.keys(grouped).map(Number);
      let done = 0;
      charIds.forEach(charId => {
        const getReq = store.get(charId);
        getReq.onsuccess = () => {
          const char = getReq.result;
          if (char && Array.isArray(char.charNpcs)) {
            // 倒序删除，避免下标偏移
            grouped[charId].sort((a, b) => b - a).forEach(idx => {
              char.charNpcs.splice(idx, 1);
            });
            store.put(char);
          }
          done++;
          if (done === charIds.length) res();
        };
        getReq.onerror = () => { done++; if (done === charIds.length) res(); };
      });
      if (charIds.length === 0) res();
    };
    req.onerror = () => res();
  });

  // 重置状态
  _smSelectMode = false;
  _smSelectedNpcs.clear();
  document.getElementById('smBatchDeleteBar').style.display = 'none';
  document.getElementById('smSelectModeBtn').style.background = '';
  document.getElementById('smSelectModeBtn').style.borderRadius = '';
  smRenderAll();
}
// ===== END 批量选择删除 =====

// 点击卡片跳转到对话（复用现有逻辑）
function smOpenChat(name) {
  closeSocialMapPage();
  const conv = (convData || []).find(c => c.name === name);
  if (conv) {
    setTimeout(() => openChat(conv), 350);
  }
}

function smOpenAddModal() {
  document.getElementById('smAddModal').classList.add('open');
  document.getElementById('smAddModalMask').classList.add('open');
}

function smCloseAddModal() {
  document.getElementById('smAddModal').classList.remove('open');
  document.getElementById('smAddModalMask').classList.remove('open');
}

let _smAiGenSelected = new Set();
let _smAiGenResults  = [];
let _smAiGenCharId   = null;
let _smAiGenCharData = null;

async function smAddByAI() {
  smCloseAddModal();
  _smAiGenSelected = new Set();
  _smAiGenResults  = [];
  _smAiGenCharId   = null;
  _smAiGenCharData = null;

  // 加载角色列表
  const chars = await ncGetAllChars();
  const sel   = document.getElementById('smAiGenCharSel');
  if (sel) {
    sel.innerHTML = '<option value="">-- 选择绑定角色 --</option>' +
      chars.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }

  // 重置状态
  document.getElementById('smAiGenSub').textContent     = '选择角色，生成与 Ta 相关的人物';
  document.getElementById('smAiGenSelectRow').style.display = '';
  document.getElementById('smAiGenLoading').style.display   = 'none';
  document.getElementById('smAiGenResult').style.display    = 'none';
  document.getElementById('smAiGenGrid').innerHTML          = '';

  document.getElementById('smAiGenMask').classList.add('open');
  document.getElementById('smAiGenModal').classList.add('open');
}

function smAiGenClose() {
  document.getElementById('smAiGenModal').classList.remove('open');
  document.getElementById('smAiGenMask').classList.remove('open');
}

async function smAiGenStart() {
  const sel      = document.getElementById('smAiGenCharSel');
  const charId   = sel?.value;
  if (!charId) { sel?.focus(); return; }

  const cur   = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  if (!cur.baseUrl || !cur.apiKey || !model) {
    alert('请先在设置页配置 API'); return;
  }

  // 读取角色数据
  const chars    = await ncGetAllChars();
  const charData = chars.find(c => String(c.id) === String(charId));
  if (!charData) return;
  _smAiGenCharId   = charId;
  _smAiGenCharData = charData;

  // 读取 user 人设
  let userPersona = '';
  const userPersonas = JSON.parse(localStorage.getItem('luna_user_personas') || '[]');
  const bound = userPersonas.find(p => String(p.charId) === String(charData.id));
  if (bound?.content) userPersona = bound.content;
  if (!userPersona) userPersona = localStorage.getItem('luna_user_profile') || '';

  // 显示加载
  document.getElementById('smAiGenSelectRow').style.display = 'none';
  document.getElementById('smAiGenResult').style.display    = 'none';
  document.getElementById('smAiGenLoading').style.display   = 'flex';
  _smAiGenSelected = new Set();

  const loadingTxts = ['正在构建关系网络…','分析人物脉络中…','梳理世界线联结…','提取隐藏关系链…'];
  let   li = 0;
  const ltimer = setInterval(() => {
    document.getElementById('smAiGenLoadingTxt').textContent = loadingTxts[li++ % loadingTxts.length];
  }, 1200);

  // 构建 prompt
  const charInfo = [
    `角色名：${charData.name}`,
    charData.role   ? `身份：${charData.role}`   : '',
    charData.gender ? `性别：${charData.gender}` : '',
    charData.age    ? `年龄：${charData.age}`    : '',
    charData.desc   ? `背景：${charData.desc}`   : '',
    (charData.traits||[]).length ? `性格：${charData.traits.join('、')}` : '',
  ].filter(Boolean).join('\n');

  const userInfo = userPersona ? `\nUser档案：\n${userPersona}` : '';

  const systemPrompt = `你是一位深谙人性与情感的言情小说编辑，擅长构建有张力、有温度、有故事感的人物关系网。

根据给定的角色信息，生成6个与该角色有深度关联的人物。每个人物都要像真实存在于这段故事里——有来路，有心结，有与主角之间说不清道不明的牵扯。

**生成要求：**
- **名字**：有文学气息，像民国、现代都市或古风言情里的名字，避免过于大众或网络感
- **rel**：用一个词点明关系身份，但要带一点模糊暧昧（如"旧识"比"朋友"更有味道，"前任"比"恋人"更有故事）
- **relType**：从以下选择：恋人、友人、家人、宿敌、其他
- **hook**：一句话写出这个人物和主角之间最核心的"情感钩子"——是什么让他们纠缠，是什么让人想继续看下去。要有画面感、情绪感，像小说里第一次介绍这个角色时的那句话。控制在30字以内，不要用"他/她是"开头
- **vibe**：用2-3个词描述这个人物的气质标签，带一点文艺腔（如：沉默温柔、野心勃勃却孤独、笑里藏刀的体面人）

要有层次感：6个人物里，关系类型要有混搭，情感浓度要有轻有重，避免都是"温暖善良"这种扁平设定。

只返回JSON数组，不要任何多余文字：
[{"name":"","rel":"","relType":"恋人|友人|家人|宿敌|其他","hook":"","vibe":"","desc":""}]

其中desc = hook（用于兼容后续保存）`;

  const userPrompt = `角色信息：\n${charInfo}${userInfo}\n\n请生成6个人物，注意情感层次和关系张力的多样性。`;

  try {
    const resp = await fetch(`${cur.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cur.apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   }
        ],
        max_tokens: 800,
        stream: false
      })
    });

    clearInterval(ltimer);
    const data  = await resp.json();
    const text  = data?.choices?.[0]?.message?.content?.trim() || '';
    // 更强的清洗：去掉代码块、截取第一个完整JSON数组
    let clean = text.replace(/```json|```/g, '').trim();
    // 只取 [ ... ] 之间的内容，防止前后有多余文字
    const arrStart = clean.indexOf('[');
    const arrEnd   = clean.lastIndexOf(']');
    if (arrStart !== -1 && arrEnd !== -1) {
      clean = clean.slice(arrStart, arrEnd + 1);
    }
    // 修复常见JSON问题：中文引号、单引号key、末尾多余逗号
    clean = clean
      .replace(/[\u201c\u201d]/g, '"')   // 中文双引号 → 英文
      .replace(/[\u2018\u2019]/g, "'")   // 中文单引号
      .replace(/,\s*([\]}])/g, '$1')     // 末尾多余逗号
      .replace(/([{,]\s*)'([^']+)'\s*:/g, '$1"$2":')  // 单引号key → 双引号
      .replace(/:\s*'([^']*)'/g, ': "$1"');            // 安全解析：先修复JSON，失败则正则逐块提取
    function extractNpcField(block, key) {
      const re = new RegExp('"' + key + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"');
      const m = block.match(re);
      return m ? m[1].replace(/\\n/g,' ').replace(/\\"/g,'"').trim() : '';
    }
    function safeParseNpcList(raw) {
      let s = raw
        .replace(/```json|```/g, '')
        .replace(/[\u201c\u201d\u300c\u300d]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .trim();
      const a = s.indexOf('['), b = s.lastIndexOf(']');
      if (a !== -1 && b !== -1) s = s.slice(a, b + 1);
      // 先试直接parse
      try {
        const fixed = s.replace(/,\s*([\]}])/g, '$1');
        const arr = JSON.parse(fixed);
        if (Array.isArray(arr) && arr.length > 0) return arr;
      } catch(_) {}
      // parse失败，按大括号块逐个提取
      const results = [];
      const blockRe = /\{[\s\S]*?\}/g;
      let bm;
      while ((bm = blockRe.exec(s)) !== null) {
        const blk = bm[0];
        const name = extractNpcField(blk, 'name');
        if (!name) continue;
        results.push({
          name,
          rel:     extractNpcField(blk, 'rel')     || extractNpcField(blk, 'relType') || '\u5176\u4ed6',
          relType: extractNpcField(blk, 'relType') || extractNpcField(blk, 'rel')     || '\u5176\u4ed6',
          hook:    extractNpcField(blk, 'hook')    || extractNpcField(blk, 'desc')    || '',
          vibe:    extractNpcField(blk, 'vibe')    || '',
          desc:    extractNpcField(blk, 'hook')    || extractNpcField(blk, 'desc')    || '',
        });
      }
      return results;
    }
    _smAiGenResults = safeParseNpcList(text);
    if (!Array.isArray(_smAiGenResults) || _smAiGenResults.length === 0) throw new Error('\u683c\u5f0f\u9519\u8bef');
    smAiGenRender();
  } catch(e) {
    clearInterval(ltimer);
    document.getElementById('smAiGenLoading').style.display = 'none';
    document.getElementById('smAiGenSelectRow').style.display = '';
    document.getElementById('smAiGenSub').textContent = '生成失败，请重试';
    console.error(e);
  }
}

function smAiGenRender() {
  document.getElementById('smAiGenLoading').style.display = 'none';
  document.getElementById('smAiGenResult').style.display  = '';
  document.getElementById('smAiGenSelectRow').style.display = 'none';

  const grid = document.getElementById('smAiGenGrid');
  grid.innerHTML = _smAiGenResults.map((item, i) => `
    <div class="sm-ai-npc-item" id="smAiItem_${i}" onclick="smAiToggleItem(${i})">
      <div class="sm-ai-npc-avatar">${(item.name||'?')[0]}</div>
      <div class="sm-ai-npc-info">
        <div class="sm-ai-npc-name-row">
          <span class="sm-ai-npc-name">${item.name||'—'}</span>
          <span class="sm-ai-npc-rel-badge">${item.rel || item.relType || '—'}</span>
        </div>
        ${item.vibe ? `<div class="sm-ai-npc-vibe">${item.vibe}</div>` : ''}
        <div class="sm-ai-npc-hook">${item.hook || item.desc||''}</div>
      </div>
    </div>
  `).join('');

  smAiUpdateAddBtn();
}

function smAiToggleItem(i) {
  if (_smAiGenSelected.has(i)) {
    _smAiGenSelected.delete(i);
    document.getElementById(`smAiItem_${i}`)?.classList.remove('selected');
  } else {
    _smAiGenSelected.add(i);
    document.getElementById(`smAiItem_${i}`)?.classList.add('selected');
  }
  smAiUpdateAddBtn();
}

function smAiUpdateAddBtn() {
  const btn = document.getElementById('smAiGenAddBtn');
  if (!btn) return;
  const n = _smAiGenSelected.size;
  btn.textContent = n > 0 ? `添加选中 (${n})` : '添加选中';
  btn.disabled    = n === 0;
}

async function smAiGenAdd() {
  if (_smAiGenSelected.size === 0 || !_smAiGenCharId) return;

  const toAdd = [..._smAiGenSelected].map(i => _smAiGenResults[i]).filter(Boolean);

  await new Promise(res => {
    const req = indexedDB.open('LunaCharDB', 4);
    req.onsuccess = e => {
      const db    = e.target.result;
      const tx    = db.transaction('chars', 'readwrite');
      const store = tx.objectStore('chars');
      const getReq = store.get(parseInt(_smAiGenCharId));
      getReq.onsuccess = () => {
        const char = getReq.result;
        if (!char) { res(); return; }
        if (!Array.isArray(char.charNpcs)) char.charNpcs = [];
        toAdd.forEach(item => {
          char.charNpcs.push({
            name:    item.name   || '未命名',
            rel:     item.rel    || item.relType || '其他',
            relType: item.relType|| item.rel     || '其他',
            desc:    item.desc   || item.hook    || '',
            hook:    item.hook   || '',
            vibe:    item.vibe   || '',
            isAiNpc: true,
            traits:  [],
            role:    '',
            gender:  '未知',
            age:     '',
            relDesc: item.desc   || item.hook    || '',
            color:   'warm',
            avatar:  null,
            cardBg:  null,
          });
        });
        store.put(char);
        tx.oncomplete = () => res();
      };
    };
    req.onerror = () => res();
  });

  smAiGenClose();
  smRenderAll();
}

/* ================================
   NPC 手动创建页
================================ */
let _smNpcGender  = '女';
let _smNpcRel     = '其他';
let _smNpcColor   = 'warm';
let _smNpcAvatar  = null;
let _smNpcBg      = null;

function smAddByManual() {
  smCloseAddModal();

  // 同步状态栏时间
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const smNpcTime = document.getElementById('smNpcStatusTime');
  if (smNpcTime) smNpcTime.textContent = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });

  // 同步电量
  const mainPct   = document.getElementById('batPct');
  const mainInner = document.getElementById('batInner');
  const nPct      = document.getElementById('smNpcBatPct');
  const nInner    = document.getElementById('smNpcBatInner');
  if (nPct && mainPct) {
    nPct.textContent = mainPct.textContent;
    const p = parseInt(mainPct.textContent);
    if (nInner) {
      nInner.style.width      = p + '%';
      nInner.style.background = p <= 20
        ? 'linear-gradient(90deg,#f87171,#ef4444)'
        : 'linear-gradient(90deg,#6ee7b7,#34d399)';
    }
  }

  // 同步灵动岛
  const enabled  = localStorage.getItem('luna_island_enabled') === 'true';
  const style    = localStorage.getItem('luna_island_style') || 'minimal';
  const islandEl = document.getElementById('smNpcStatusIsland');
  if (islandEl) {
    if (!enabled) { islandEl.innerHTML = ''; }
    else {
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
      islandEl.innerHTML = styleMap[style] || styleMap.minimal;
    }
  }

  // 重置表单
  _smNpcGender = '女'; _smNpcRel = '其他'; _smNpcColor = 'warm';
  _smNpcAvatar = null; _smNpcBg = null;
  ['smNpcFName','smNpcFRole','smNpcFAge','smNpcFRelDesc','smNpcFTraits','smNpcFRelCustom'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('smNpcPvName').textContent = 'NPC 名称';
  document.getElementById('smNpcPvMeta').textContent = '关系 · 性别';
  document.getElementById('smNpcPvBg').style.backgroundImage = '';
  const av = document.getElementById('smNpcPvAvatar');
  if (av) av.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none"><circle cx="12" cy="8" r="4" stroke="rgba(247,246,243,0.5)" stroke-width="1.4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(247,246,243,0.5)" stroke-width="1.4" stroke-linecap="round"/></svg><div class="nc-pv-av-hint">头像</div>`;

  // 重置性别/关系/颜色按钮选中状态
  document.querySelectorAll('#smNpcPage .nc-gender-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('#smNpcPage [data-g="女"]')?.classList.add('active');
  document.querySelector('#smNpcPage [data-r="其他"]')?.classList.add('active');
  const customInput = document.getElementById('smNpcFRelCustom');
  if (customInput) customInput.style.display = 'none';
  document.querySelectorAll('#smNpcPage .nc-co').forEach(b => b.classList.remove('selected'));
  document.querySelector('#smNpcPage [data-color="warm"]')?.classList.add('selected');

  // 加载角色列表到下拉框
  smNpcLoadChars();

  // 打开页面
  document.getElementById('smNpcPage').classList.add('show');
  document.getElementById('smNpcOverlay').classList.add('show');
}

function smCloseManual() {
  document.getElementById('smNpcPage').classList.remove('show');
  document.getElementById('smNpcOverlay').classList.remove('show');
}

function smNpcUpdateMeta() {
  const rel    = _smNpcRel    || '关系';
  const gender = _smNpcGender || '性别';
  const age    = document.getElementById('smNpcFAge')?.value || '';
  document.getElementById('smNpcPvMeta').textContent =
    `${rel} · ${gender}${age ? ' · ' + age : ''}`;
}

function smNpcPickGender(btn) {
  document.querySelectorAll('#smNpcPage [data-g]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _smNpcGender = btn.dataset.g;
  smNpcUpdateMeta();
}

function smNpcPickRel(btn) {
  document.querySelectorAll('#smNpcPage [data-r]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _smNpcRel = btn.dataset.r;
  // 其他：显示自定义输入框
  const customInput = document.getElementById('smNpcFRelCustom');
  if (customInput) customInput.style.display = _smNpcRel === '其他' ? 'block' : 'none';
  smNpcUpdateMeta();
}

function smNpcPickColor(el) {
  document.querySelectorAll('#smNpcPage .nc-co').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  _smNpcColor = el.dataset.color;
}

function smNpcHandleAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _smNpcAvatar = e.target.result;
    const av = document.getElementById('smNpcPvAvatar');
    if (av) av.innerHTML = `<img src="${_smNpcAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;"/>`;
  };
  reader.readAsDataURL(file);
}

function smNpcHandleBg(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _smNpcBg = e.target.result;
    document.getElementById('smNpcPvBg').style.backgroundImage = `url(${_smNpcBg})`;
  };
  reader.readAsDataURL(file);
}

async function smNpcLoadChars() {
  const sel = document.getElementById('smNpcFBindChar');
  if (!sel) return;
  const chars = await ncGetAllChars();
  sel.innerHTML = '<option value="">-- 选择角色 --</option>' +
    chars.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

async function smNpcSave() {
  const name = document.getElementById('smNpcFName').value.trim();
  if (!name) { document.getElementById('smNpcFName').focus(); return; }

  const bindCharId = document.getElementById('smNpcFBindChar').value;
  if (!bindCharId) { alert('请选择绑定的角色'); return; }

  const npcData = {
    name,
    role:    document.getElementById('smNpcFRole').value.trim(),
    gender:  _smNpcGender,
    age:     document.getElementById('smNpcFAge').value.trim(),
    rel: _smNpcRel === '其他'
      ? (document.getElementById('smNpcFRelCustom')?.value.trim() || '其他')
      : _smNpcRel,
    relDesc: document.getElementById('smNpcFRelDesc').value.trim(),
    traits:  document.getElementById('smNpcFTraits').value.split(',').map(s => s.trim()).filter(Boolean),
    color:   _smNpcColor,
    avatar:  _smNpcAvatar,
    cardBg:  _smNpcBg,
    isAiNpc:    false,
    fromManual: true,
  };

  // 写入对应角色的 charNpcs 数组
  await new Promise(res => {
    const req = indexedDB.open('LunaCharDB', 4);
    req.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('chars', 'readwrite');
      const store = tx.objectStore('chars');
      const getReq = store.get(parseInt(bindCharId));
      getReq.onsuccess = () => {
        const char = getReq.result;
        if (!char) { res(); return; }
        if (!Array.isArray(char.charNpcs)) char.charNpcs = [];
        char.charNpcs.push(npcData);
        store.put(char);
        tx.oncomplete = () => res();
      };
      getReq.onerror = () => res();
    };
    req.onerror = () => res();
  });

  smCloseManual();
  // 刷新 Social Map
  smRenderAll();
}

/* ================================
   NPC 编辑页
================================ */
let _smNpcEditGender  = '女';
let _smNpcEditRel     = '其他';
let _smNpcEditColor   = 'warm';
let _smNpcEditAvatar  = null;
let _smNpcEditBg      = null;
let _smNpcEditCharId  = null;  // 所属角色 id
let _smNpcEditNpcIdx  = null;  // 在 charNpcs 数组里的下标

function smOpenEdit(charId, npcIdx) {
  _smNpcEditCharId = charId;
  _smNpcEditNpcIdx = npcIdx;

  // 先读数据，成功后再打开页面
  const req = indexedDB.open('LunaCharDB', 4);
  req.onupgradeneeded = e => {
    const d = e.target.result;
    if (!d.objectStoreNames.contains('chars'))
      d.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
  };
  req.onsuccess = e => {
    const db = e.target.result;
    const r  = db.transaction('chars').objectStore('chars').get(parseInt(charId));
    r.onsuccess = () => {
      const char = r.result;
      if (!char) { console.error('[smOpenEdit] 找不到 char，charId=', charId); return; }
      const npc = (char.charNpcs || [])[npcIdx];
      if (!npc)  { console.error('[smOpenEdit] 找不到 npc，npcIdx=', npcIdx); return; }
      smNpcEditFill(npc);
      // 数据确认后再打开页面
      document.getElementById('smNpcEditPage').classList.add('show');
      document.getElementById('smNpcEditOverlay').classList.add('show');
    };
    r.onerror = () => console.error('[smOpenEdit] IndexedDB get 出错');
  };
  req.onerror = () => console.error('[smOpenEdit] 打开数据库失败');

  // 同步状态栏
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const el = document.getElementById('smNpcEditStatusTime');
  if (el) el.textContent = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const mainPct   = document.getElementById('batPct');
  const mainInner = document.getElementById('batInner');
  const ePct      = document.getElementById('smNpcEditBatPct');
  const eInner    = document.getElementById('smNpcEditBatInner');
  if (ePct && mainPct) {
    ePct.textContent = mainPct.textContent;
    const p = parseInt(mainPct.textContent);
    if (eInner) {
      eInner.style.width      = p + '%';
      eInner.style.background = p <= 20
        ? 'linear-gradient(90deg,#f87171,#ef4444)'
        : 'linear-gradient(90deg,#6ee7b7,#34d399)';
    }
  }
  const enabled  = localStorage.getItem('luna_island_enabled') === 'true';
  const style    = localStorage.getItem('luna_island_style') || 'minimal';
  const islandEl = document.getElementById('smNpcEditStatusIsland');
  if (islandEl) {
    if (!enabled) { islandEl.innerHTML = ''; }
    else {
      const styleMap = {
        minimal:`<div class="si-minimal"><div class="si-capsule"></div></div>`,
        glow:   `<div class="si-glow"><div class="si-capsule"></div></div>`,
        clock:  `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text">--:--</span></div></div>`,
        pulse:  `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
        ripple: `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
        rainbow:`<div class="si-rainbow"><div class="si-capsule"></div></div>`,
        music:  `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
        scan:   `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
      };
      islandEl.innerHTML = styleMap[style] || styleMap.minimal;
    }
  }

}

function smNpcEditFill(npc) {
  _smNpcEditAvatar = npc.avatar || null;
  _smNpcEditBg     = npc.cardBg || null;
  _smNpcEditColor  = npc.color  || 'warm';

  // 预览
  document.getElementById('smNpcEditPvName').textContent = npc.name || 'NPC 名称';
  const bg = document.getElementById('smNpcEditPvBg');
  if (bg) bg.style.backgroundImage = _smNpcEditBg ? `url(${_smNpcEditBg})` : '';
  const av = document.getElementById('smNpcEditPvAvatar');
  if (av) {
    av.innerHTML = _smNpcEditAvatar
      ? `<img src="${_smNpcEditAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;"/>`
      : `<svg viewBox="0 0 24 24" width="22" height="22" fill="none"><circle cx="12" cy="8" r="4" stroke="rgba(247,246,243,0.5)" stroke-width="1.4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(247,246,243,0.5)" stroke-width="1.4" stroke-linecap="round"/></svg><div class="nc-pv-av-hint">头像</div>`;
  }

  // 表单填值
  document.getElementById('smNpcEditFName').value    = npc.name    || '';
  document.getElementById('smNpcEditFRole').value    = npc.role    || '';
  document.getElementById('smNpcEditFAge').value     = npc.age     || '';
  document.getElementById('smNpcEditFRelDesc').value = npc.relDesc || '';
  document.getElementById('smNpcEditFTraits').value  = (npc.traits || []).join(', ');

  // 性别按钮
  _smNpcEditGender = npc.gender || '女';
  document.querySelectorAll('#smNpcEditPage [data-eg]').forEach(b => {
    b.classList.toggle('active', b.dataset.eg === _smNpcEditGender);
  });

  // 关系按钮
  const fixedRels = ['恋人','友人','家人','宿敌'];
  const isFixed   = fixedRels.includes(npc.rel);
  _smNpcEditRel   = isFixed ? npc.rel : '其他';
  document.querySelectorAll('#smNpcEditPage [data-er]').forEach(b => {
    b.classList.toggle('active', b.dataset.er === _smNpcEditRel);
  });
  const customInput = document.getElementById('smNpcEditFRelCustom');
  if (customInput) {
    if (!isFixed) {
      customInput.style.display = 'block';
      customInput.value = npc.rel || '';
    } else {
      customInput.style.display = 'none';
      customInput.value = '';
    }
  }

  // 颜色
  document.querySelectorAll('#smNpcEditPage .nc-co').forEach(o => {
    o.classList.toggle('selected', o.dataset.ecolor === _smNpcEditColor);
  });

  smNpcEditUpdateMeta();
}

function smCloseEdit() {
  document.getElementById('smNpcEditPage').classList.remove('show');
  document.getElementById('smNpcEditOverlay').classList.remove('show');
}

function smNpcEditUpdateMeta() {
  const rel    = _smNpcEditRel    || '关系';
  const gender = _smNpcEditGender || '性别';
  const age    = document.getElementById('smNpcEditFAge')?.value || '';
  document.getElementById('smNpcEditPvMeta').textContent =
    `${rel} · ${gender}${age ? ' · ' + age : ''}`;
}

function smNpcEditPickGender(btn) {
  document.querySelectorAll('#smNpcEditPage [data-eg]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _smNpcEditGender = btn.dataset.eg;
  smNpcEditUpdateMeta();
}

function smNpcEditPickRel(btn) {
  document.querySelectorAll('#smNpcEditPage [data-er]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _smNpcEditRel = btn.dataset.er;
  const customInput = document.getElementById('smNpcEditFRelCustom');
  if (customInput) customInput.style.display = _smNpcEditRel === '其他' ? 'block' : 'none';
  smNpcEditUpdateMeta();
}

function smNpcEditPickColor(el) {
  document.querySelectorAll('#smNpcEditPage .nc-co').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  _smNpcEditColor = el.dataset.ecolor;
}

function smNpcEditHandleAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _smNpcEditAvatar = e.target.result;
    const av = document.getElementById('smNpcEditPvAvatar');
    if (av) av.innerHTML = `<img src="${_smNpcEditAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;"/>`;
  };
  reader.readAsDataURL(file);
}

function smNpcEditHandleBg(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _smNpcEditBg = e.target.result;
    document.getElementById('smNpcEditPvBg').style.backgroundImage = `url(${_smNpcEditBg})`;
  };
  reader.readAsDataURL(file);
}

async function smNpcEditSave() {
  const name = document.getElementById('smNpcEditFName').value.trim();
  if (!name) { document.getElementById('smNpcEditFName').focus(); return; }

  const updatedNpc = {
    name,
    role:    document.getElementById('smNpcEditFRole').value.trim(),
    gender:  _smNpcEditGender,
    age:     document.getElementById('smNpcEditFAge').value.trim(),
    rel:     _smNpcEditRel === '其他'
               ? (document.getElementById('smNpcEditFRelCustom')?.value.trim() || '其他')
               : _smNpcEditRel,
    relDesc: document.getElementById('smNpcEditFRelDesc').value.trim(),
    traits:  document.getElementById('smNpcEditFTraits').value.split(',').map(s => s.trim()).filter(Boolean),
    color:   _smNpcEditColor,
    avatar:  _smNpcEditAvatar,
    cardBg:  _smNpcEditBg,
  };

  await new Promise(res => {
    const req = indexedDB.open('LunaCharDB', 4);
    req.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('chars', 'readwrite');
      const store = tx.objectStore('chars');
      const getReq = store.get(parseInt(_smNpcEditCharId));
      getReq.onsuccess = () => {
        const char = getReq.result;
        if (!char) { res(); return; }
        if (!Array.isArray(char.charNpcs)) char.charNpcs = [];
        char.charNpcs[_smNpcEditNpcIdx] = updatedNpc;
        store.put(char);
        tx.oncomplete = () => res();
      };
    };
    req.onerror = () => res();
  });

  smCloseEdit();
  smRenderAll();
}

async function smNpcEditDelete() {
  if (!confirm('确定删除这个 NPC 吗？此操作不可恢复。')) return;

  await new Promise(res => {
    const req = indexedDB.open('LunaCharDB', 4);
    req.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('chars', 'readwrite');
      const store = tx.objectStore('chars');
      const getReq = store.get(parseInt(_smNpcEditCharId));
      getReq.onsuccess = () => {
        const char = getReq.result;
        if (!char) { res(); return; }
        if (Array.isArray(char.charNpcs)) {
          char.charNpcs.splice(_smNpcEditNpcIdx, 1);
        }
        store.put(char);
        tx.oncomplete = () => res();
      };
    };
    req.onerror = () => res();
  });

  smCloseEdit();
  smRenderAll();
}

/* ================================
   AI NPC 详情页
================================ */
let _smAiNpcDetail_charId  = null;
let _smAiNpcDetail_npcIdx  = null;
let _smAiNpcDetail_npc     = null;  // 当前 npc 数据副本
let _smAiNpcDetail_color   = 'warm';
let _smAiNpcDetail_avatar  = null;
let _smAiNpcDetail_bg      = null;

// 打开 AI NPC 详情页
function smAiNpcDetailOpen(charId, npcIdx) {
  _smAiNpcDetail_charId = charId;
  _smAiNpcDetail_npcIdx = npcIdx;

  // 状态栏同步
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const el = document.getElementById('smAiNpcDetailStatusTime');
  if (el) el.textContent = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const mainPct = document.getElementById('batPct');
  const ePct    = document.getElementById('smAiNpcDetailBatPct');
  const eInner  = document.getElementById('smAiNpcDetailBatInner');
  if (ePct && mainPct) {
    ePct.textContent = mainPct.textContent;
    const p = parseInt(mainPct.textContent);
    if (eInner) {
      eInner.style.width = p + '%';
      eInner.style.background = p <= 20
        ? 'linear-gradient(90deg,#f87171,#ef4444)'
        : 'linear-gradient(90deg,#6ee7b7,#34d399)';
    }
  }
  const enabled  = localStorage.getItem('luna_island_enabled') === 'true';
  const isStyle  = localStorage.getItem('luna_island_style') || 'minimal';
  const islandEl = document.getElementById('smAiNpcDetailStatusIsland');
  if (islandEl) {
    if (!enabled) { islandEl.innerHTML = ''; }
    else {
      const styleMap = {
        minimal:`<div class="si-minimal"><div class="si-capsule"></div></div>`,
        glow:   `<div class="si-glow"><div class="si-capsule"></div></div>`,
        clock:  `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text">--:--</span></div></div>`,
        pulse:  `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
        ripple: `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
        rainbow:`<div class="si-rainbow"><div class="si-capsule"></div></div>`,
        music:  `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
        scan:   `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
      };
      islandEl.innerHTML = styleMap[isStyle] || styleMap.minimal;
    }
  }

  // 先读数据，成功后再打开页面
  const req = indexedDB.open('LunaCharDB', 4);
  req.onupgradeneeded = e => {
    const d = e.target.result;
    if (!d.objectStoreNames.contains('chars'))
      d.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
  };
  req.onsuccess = e => {
    const db = e.target.result;
    // 用 readwrite 事务，这样可以在同一个事务里读+修复写，不会嵌套
    const tx    = db.transaction('chars', 'readwrite');
    const store = tx.objectStore('chars');
    const r     = store.get(parseInt(charId));
    r.onsuccess = () => {
      const char = r.result;
      if (!char) {
        console.error('[smAiNpcDetailOpen] 找不到 char，charId=', charId);
        return;
      }
      const npc = (char.charNpcs || [])[npcIdx];
      if (!npc) {
        console.error('[smAiNpcDetailOpen] 找不到 npc，charId=', charId,
          'npcIdx=', npcIdx, 'charNpcs长度=', (char.charNpcs || []).length);
        return;
      }
      // 在同一事务里修复旧数据的 isAiNpc 字段
      if (!npc.isAiNpc) {
        char.charNpcs[npcIdx].isAiNpc = true;
        store.put(char);
      }
      // 填充状态，打开页面
      _smAiNpcDetail_npc    = Object.assign({}, npc, { isAiNpc: true });
      _smAiNpcDetail_color  = npc.color  || 'warm';
      _smAiNpcDetail_avatar = npc.avatar || null;
      _smAiNpcDetail_bg     = npc.cardBg || null;
      document.getElementById('smAiNpcDetailPage').classList.add('show');
      document.getElementById('smAiNpcDetailOverlay').classList.add('show');
      _smAiNpcDetailFill();
    };
    r.onerror = () => console.error('[smAiNpcDetailOpen] IndexedDB get 出错');
  };
  req.onerror = () => console.error('[smAiNpcDetailOpen] 打开数据库失败');
}

function _smAiNpcDetailFill() {
  const npc = _smAiNpcDetail_npc;
  if (!npc) return;

  // 预览卡
  document.getElementById('smAiNpcDetailPvName').textContent = npc.name || 'NPC 名称';
  document.getElementById('smAiNpcDetailPvMeta').textContent =
    `${npc.rel || '关系'} · ${npc.gender || '性别'}${npc.age ? ' · ' + npc.age : ''}`;

  const bg = document.getElementById('smAiNpcDetailPvBg');
  if (bg) bg.style.backgroundImage = _smAiNpcDetail_bg ? `url(${_smAiNpcDetail_bg})` : '';

  const av = document.getElementById('smAiNpcDetailPvAvatar');
  if (av) {
    av.innerHTML = _smAiNpcDetail_avatar
      ? `<img src="${_smAiNpcDetail_avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;"/>`
      : `<svg viewBox="0 0 24 24" width="22" height="22" fill="none"><circle cx="12" cy="8" r="4" stroke="rgba(247,246,243,0.5)" stroke-width="1.4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(247,246,243,0.5)" stroke-width="1.4" stroke-linecap="round"/></svg><div class="nc-pv-av-hint">点击上传头像</div>`;
  }

  // AI 已生成区域
  document.getElementById('smAiNpcDetailDName').textContent = npc.name  || '—';
  document.getElementById('smAiNpcDetailDRel').textContent  = npc.rel   || '—';
  document.getElementById('smAiNpcDetailDVibe').textContent = npc.vibe  || '—';
  document.getElementById('smAiNpcDetailDHook').textContent = npc.hook  || npc.desc || '—';

  // AI 补全字段（已有则显示，没有则"尚未生成"）
  _smAiNpcDetailSetField('role',    npc.role);
  _smAiNpcDetailSetField('gender',  npc.gender);
  _smAiNpcDetailSetField('age',     npc.age);
  _smAiNpcDetailSetField('relDesc', npc.relDesc);
  _smAiNpcDetailSetField('traits',  Array.isArray(npc.traits) ? npc.traits.join('、') : npc.traits);

  // 配色
  document.querySelectorAll('#smAiNpcDetailPage .nc-co').forEach(o => {
    o.classList.toggle('selected', o.dataset.adcolor === _smAiNpcDetail_color);
  });
}

function _smAiNpcDetailSetField(field, val) {
  const idMap = {
    role: 'smAiNpcDetailRole', gender: 'smAiNpcDetailGender',
    age: 'smAiNpcDetailAge', relDesc: 'smAiNpcDetailRelDesc', traits: 'smAiNpcDetailTraits'
  };
  const el = document.getElementById(idMap[field]);
  if (!el) return;
  if (val && String(val).trim()) {
    el.textContent = val;
    el.classList.add('generated');
    el.classList.remove('ainpc-loading');
  } else {
    el.textContent = '尚未生成';
    el.classList.remove('generated', 'ainpc-loading');
  }
}

function smAiNpcDetailClose() {
  document.getElementById('smAiNpcDetailPage').classList.remove('show');
  document.getElementById('smAiNpcDetailOverlay').classList.remove('show');
}

function smAiNpcDetailPickColor(el) {
  document.querySelectorAll('#smAiNpcDetailPage .nc-co').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  _smAiNpcDetail_color = el.dataset.adcolor;
}

function smAiNpcDetailHandleAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _smAiNpcDetail_avatar = e.target.result;
    const av = document.getElementById('smAiNpcDetailPvAvatar');
    if (av) av.innerHTML = `<img src="${_smAiNpcDetail_avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;"/>`;
  };
  reader.readAsDataURL(file);
}

function smAiNpcDetailHandleBg(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _smAiNpcDetail_bg = e.target.result;
    document.getElementById('smAiNpcDetailPvBg').style.backgroundImage = `url(${_smAiNpcDetail_bg})`;
  };
  reader.readAsDataURL(file);
}

// AI 单字段补全
async function smAiNpcFillField(field) {
  const cur   = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  if (!cur.baseUrl || !cur.apiKey || !model) { alert('请先配置 API'); return; }

  const npc = _smAiNpcDetail_npc;
  if (!npc) return;

  const idMap = {
    role: 'smAiNpcDetailRole', gender: 'smAiNpcDetailGender',
    age: 'smAiNpcDetailAge', relDesc: 'smAiNpcDetailRelDesc', traits: 'smAiNpcDetailTraits'
  };
  const fieldNameMap = {
    role: '身份/职业（2-6字）',
    gender: '性别（只回答：男 或 女 或 未知）',
    age: '年龄（只回答数字，如：28）',
    relDesc: '关系背景描述（200字以内，细腻有层次，描写两人之间的情感与故事背景）',
    traits: '性格标签（3-4个词，逗号分隔，有文学气息）'
  };

  const el = document.getElementById(idMap[field]);
  if (!el) return;
  const btn = el.previousElementSibling?.querySelector('.ainpc-ai-btn') ||
    el.closest('.nc-fg')?.querySelector('.ainpc-ai-btn');
  if (btn) btn.classList.add('loading');
  el.textContent = '生成中…';
  el.classList.add('ainpc-loading');
  el.classList.remove('generated');

  const context = `NPC名称：${npc.name}
关系：${npc.rel}
气质：${npc.vibe || ''}
情感钩子：${npc.hook || npc.desc || ''}`;

  const prompt = `根据以下NPC信息，生成"${fieldNameMap[field]}"字段的内容。
只返回该字段的值，不要任何解释、标点包裹或多余文字。

${context}`;

  try {
    const resp = await fetch(`${cur.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cur.apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        stream: false
      })
    });
    const data = await resp.json();
    console.log('[AI生成调试] API返回:', JSON.stringify(data).slice(0, 500));
    const val  = data?.choices?.[0]?.message?.content?.trim() || '';
    if (!val) console.warn('[AI生成调试] val为空！data结构:', data);
    npc[field] = field === 'traits'
      ? val.split(/[,，、]/).map(s => s.trim()).filter(Boolean)
      : val;
    _smAiNpcDetailSetField(field, field === 'traits' ? (npc.traits||[]).join('、') : val);
  } catch(e) {
    el.textContent = '生成失败，点按钮重试';
    el.classList.remove('ainpc-loading');
  }
  if (btn) btn.classList.remove('loading');
}

// 一键补全全部字段
async function smAiNpcFillAll() {
  const btn = document.getElementById('smAiNpcGenAllBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'AI 补全中…'; }
  for (const field of ['role','gender','age','relDesc','traits']) {
    await smAiNpcFillField(field);
  }
  if (btn) { btn.disabled = false; btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="currentColor"/></svg> 一键 AI 补全所有信息`; }
}

// 保存
async function smAiNpcDetailSave() {
  const npc = _smAiNpcDetail_npc;
  if (!npc) return;

  const updatedNpc = Object.assign({}, npc, {
    color:  _smAiNpcDetail_color,
    avatar: _smAiNpcDetail_avatar,
    cardBg: _smAiNpcDetail_bg,
    relType: npc.relType || npc.rel,
  });

  await new Promise(res => {
    const req = indexedDB.open('LunaCharDB', 4);
    req.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('chars', 'readwrite');
      const store = tx.objectStore('chars');
      const getReq = store.get(parseInt(_smAiNpcDetail_charId));
      getReq.onsuccess = () => {
        const char = getReq.result;
        if (!char) { res(); return; }
        if (!Array.isArray(char.charNpcs)) char.charNpcs = [];
        char.charNpcs[_smAiNpcDetail_npcIdx] = updatedNpc;
        store.put(char);
        tx.oncomplete = () => res();
      };
    };
    req.onerror = () => res();
  });

  smAiNpcDetailClose();
  smRenderAll();
}