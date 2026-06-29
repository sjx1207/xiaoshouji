/* ================================
   Luna Chat — chat.js
================================ */

/* ---- 状态栏时间 & 电量 ---- */
function updateTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeStr = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  ['statusTime','taStatusTime','anonStatusTime','ncTime','futureStatusTime','storyEditorTime'].forEach(id => {
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
    const ids = ['taBatPct','anonBatPct','storyEditorBatPct'];
    const innerIds = ['taBatInner','anonBatInner','storyEditorBatInner'];
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
  renderFriendStories();
  closeAddContact();
}

async function ncSaveToCharDB(data) {
  return new Promise(res => {
    /* 探测当前真实版本，不硬编码版本号，避免与 characters.js 冲突 */
    const probe = indexedDB.open('LunaCharDB');
    probe.onupgradeneeded = e => {
      const db0 = e.target.result;
      if (!db0.objectStoreNames.contains('chars'))
        db0.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
    };
    probe.onsuccess = e => {
      const cur = e.target.result;
      const ver = cur.version;
      const hasChars = cur.objectStoreNames.contains('chars');
      cur.close();
      const open = hasChars
        ? indexedDB.open('LunaCharDB', ver)
        : indexedDB.open('LunaCharDB', ver + 1);
      if (!hasChars) {
        open.onupgradeneeded = e2 => {
          const db2 = e2.target.result;
          if (!db2.objectStoreNames.contains('chars'))
            db2.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
        };
      }
      open.onsuccess = e2 => {
        const db = e2.target.result;
        const tx = db.transaction('chars', 'readwrite');
        const r  = tx.objectStore('chars').add(data);
        r.onsuccess = () => { db.close(); res(r.result); };
        r.onerror   = () => { db.close(); res(null); };
      };
      open.onerror = () => res(null);
    };
    probe.onerror = () => res(null);
  });
}

/* ---- LunaCharDB 统一打开入口（不硬编码版本号，与 characters.js 保持一致） ---- */
function openLunaCharDB() {
  return new Promise((res, rej) => {
    const probe = indexedDB.open('LunaCharDB');
    probe.onupgradeneeded = e => {
      const db0 = e.target.result;
      if (!db0.objectStoreNames.contains('chars'))
        db0.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
    };
    probe.onsuccess = e => {
      const cur = e.target.result;
      const ver = cur.version;
      const hasChars = cur.objectStoreNames.contains('chars');
      cur.close();
      if (hasChars) {
        const req2 = indexedDB.open('LunaCharDB', ver);
        req2.onsuccess = e2 => res(e2.target.result);
        req2.onerror   = e2 => rej(e2.target.error);
      } else {
        const req3 = indexedDB.open('LunaCharDB', ver + 1);
        req3.onupgradeneeded = e3 => {
          const db3 = e3.target.result;
          if (!db3.objectStoreNames.contains('chars'))
            db3.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
        };
        req3.onsuccess = e3 => res(e3.target.result);
        req3.onerror   = e3 => rej(e3.target.error);
      }
    };
    probe.onerror = e => rej(e.target.error);
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
  groups:    { keyPath: 'id' },
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
    /* 探测当前真实版本，不硬编码版本号，与 characters.js 保持一致 */
    const probe = indexedDB.open('LunaCharDB');
    probe.onupgradeneeded = e => {
      const db0 = e.target.result;
      if (!db0.objectStoreNames.contains('chars'))
        db0.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
    };
    probe.onsuccess = e => {
      const cur = e.target.result;
      const ver = cur.version;
      const hasChars = cur.objectStoreNames.contains('chars');
      cur.close();

      if (!hasChars) { res([]); return; }

      const req2 = indexedDB.open('LunaCharDB', ver);
      req2.onsuccess = e2 => {
        const db = e2.target.result;
        if (!db.objectStoreNames.contains('chars')) { db.close(); res([]); return; }
        const r = db.transaction('chars').objectStore('chars').getAll();
        r.onsuccess = () => { db.close(); res(r.result || []); };
        r.onerror   = () => { db.close(); res([]); };
      };
      req2.onerror = () => res([]);
    };
    probe.onerror = () => res([]);
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

/* ════════════════════════════════════════
   创建方式选择弹窗（单聊 / 群聊）
════════════════════════════════════════ */
function openCreateChoice() {
  document.getElementById('ccOverlay').classList.add('show');
  document.getElementById('ccSheet').classList.add('show');
}
function closeCreateChoice() {
  document.getElementById('ccOverlay').classList.remove('show');
  document.getElementById('ccSheet').classList.remove('show');
}

/* ════════════════════════════════════════
   群聊创建全屏页（gc-）
════════════════════════════════════════ */
let _gcAvatarData = null;     // 上传的群头像图片
let _gcAvatarMode = 'image';  // 'image' | 'text'
let _gcEmblemText = '';       // 文字头衔
let _gcColor = 'ink';
let _gcAllItems = [];         // 同 _ncAllItems 结构：{type:'char'|'npc', data, charName, charId}
let _gcSelected = new Set();
let _gcSubTab = 'all';

function gcRandomId() {
  // 7位群号，避免以0开头
  let id = String(Math.floor(Math.random() * 9 + 1));
  for (let i = 0; i < 6; i++) id += String(Math.floor(Math.random() * 10));
  return id;
}

function gcRequiredOthers() {
  // 群人数含本人，所以需要从角色书同步的人数 = 总人数 - 1，最少需要 2 位他人角色（总人数最少 3）
  const count = parseInt(document.getElementById('gcFCount')?.value, 10) || 3;
  return Math.max(2, count - 1);
}

function openCreateGroup() {
  // 重置状态
  _gcAvatarData = null;
  _gcAvatarMode = 'image';
  _gcEmblemText = '';
  _gcColor = 'ink';
  _gcSelected = new Set();
  _gcSubTab = 'all';

  document.getElementById('gcFName').value = '';
  document.getElementById('gcFDesc').value = '';
  document.getElementById('gcFCount').value = 3;
  document.getElementById('gcFGroupId').value = gcRandomId();
  document.getElementById('gcEmblemInput').value = '';
  document.getElementById('gcSearchInput').value = '';

  document.getElementById('gcAModeImg').classList.add('active');
  document.getElementById('gcAModeText').classList.remove('active');
  document.getElementById('gcTextEmblemRow').style.display = 'none';

  document.querySelectorAll('#gcPage .nc-co').forEach((o, i) => o.classList.toggle('selected', i === 0));
  document.querySelectorAll('#gcPage .nc-stab').forEach(b => b.classList.toggle('active', b.id === 'gcStabAll'));

  const av = document.getElementById('gcPvAvatar');
  av.innerHTML = `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
      <path d="M17 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M13 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="rgba(247,246,243,0.5)" stroke-width="1.4" stroke-linecap="round"/>
      <circle cx="9" cy="7" r="4" stroke="rgba(247,246,243,0.5)" stroke-width="1.4"/>
    </svg>
    <div class="gc-pv-av-hint">群头像</div>`;

  gcUpdateCard();
  gcLoadSelectData();

  document.getElementById('gcOverlay').classList.add('show');
  document.getElementById('gcPage').classList.add('show');
  document.getElementById('gcStatusBar').classList.add('show');
  document.getElementById('gcPageFooter').classList.add('show');

  const el = document.getElementById('gcTime');
  if (el) {
    const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
    el.textContent = new Date().toLocaleTimeString('zh-CN',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false});
  }
}

function closeCreateGroup() {
  document.getElementById('gcOverlay').classList.remove('show');
  document.getElementById('gcPage').classList.remove('show');
  document.getElementById('gcStatusBar').classList.remove('show');
  document.getElementById('gcPageFooter').classList.remove('show');
}

/* ── 群头像：图片 / 文字头衔切换 ── */
function gcSwitchAvatarMode(mode) {
  _gcAvatarMode = mode;
  document.getElementById('gcAModeImg').classList.toggle('active', mode === 'image');
  document.getElementById('gcAModeText').classList.toggle('active', mode === 'text');
  document.getElementById('gcTextEmblemRow').style.display = mode === 'text' ? 'block' : 'none';
  gcRenderAvatarPreview();
}

function gcAvatarTap() {
  if (_gcAvatarMode === 'image') {
    document.getElementById('gcAvatarInput').click();
  }
}

function gcHandleAvatar(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _gcAvatarData = e.target.result;
    gcRenderAvatarPreview();
  };
  reader.readAsDataURL(file);
}

function gcUpdateEmblem() {
  _gcEmblemText = document.getElementById('gcEmblemInput').value.trim().slice(0, 2);
  gcRenderAvatarPreview();
}

function gcRenderAvatarPreview() {
  const av = document.getElementById('gcPvAvatar');
  if (_gcAvatarMode === 'image' && _gcAvatarData) {
    av.innerHTML = `<img src="${_gcAvatarData}"/>`;
  } else if (_gcAvatarMode === 'text') {
    const name = document.getElementById('gcFName').value.trim();
    const text = _gcEmblemText || (name ? name[0] : '群');
    av.innerHTML = `<span class="gc-pv-av-emblem">${text}</span>`;
  } else {
    av.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
        <path d="M17 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M13 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="rgba(247,246,243,0.5)" stroke-width="1.4" stroke-linecap="round"/>
        <circle cx="9" cy="7" r="4" stroke="rgba(247,246,243,0.5)" stroke-width="1.4"/>
      </svg>
      <div class="gc-pv-av-hint">群头像</div>`;
  }
}

function gcPickColor(el) {
  document.querySelectorAll('#gcPage .nc-co').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  _gcColor = el.dataset.color;
}

function gcRegenId() {
  document.getElementById('gcFGroupId').value = gcRandomId();
  gcUpdateCard();
}

/* ── 人数步进器 ── */
function gcStepCount(delta) {
  const input = document.getElementById('gcFCount');
  let v = parseInt(input.value, 10) || 3;
  v += delta;
  if (v < 3) v = 3;
  if (v > 200) v = 200;
  input.value = v;
  gcUpdateCard();
  gcUpdateSyncStatus();
}

function gcHandleCountInput(input) {
  let v = parseInt(input.value, 10);
  if (isNaN(v) || v < 3) v = 3;
  if (v > 200) v = 200;
  input.value = v;
  gcUpdateCard();
  gcUpdateSyncStatus();
}

/* ── 预览卡同步更新 ── */
function gcUpdateCard() {
  const name = document.getElementById('gcFName').value.trim() || '未命名群聊';
  const gid  = document.getElementById('gcFGroupId').value.trim() || '——';
  const count = parseInt(document.getElementById('gcFCount').value, 10) || 3;
  document.getElementById('gcPvName').textContent = name;
  document.getElementById('gcPvMeta').textContent = `群号 · ${gid} · ${count} 人`;
  if (_gcAvatarMode === 'text' && !_gcEmblemText) gcRenderAvatarPreview();
}

/* ── 同步进度状态 ── */
function gcUpdateSyncStatus() {
  const need = gcRequiredOthers();
  const have = _gcSelected.size;
  document.getElementById('gcHeroNeed').textContent = need + 1; // 总人数（含本人）
  document.getElementById('gcHeroSynced').textContent = have;
  document.getElementById('gcSyncCountLabel').textContent = `${have} / ${need}`;

  const pct = Math.min(100, Math.round((have / need) * 100));
  const fill = document.getElementById('gcSyncFill');
  const text = document.getElementById('gcSyncText');
  const deco = document.getElementById('gcSubmitDeco');
  const submitBtn = document.getElementById('gcFooterSubmit');

  fill.style.width = pct + '%';

  if (have >= need) {
    fill.classList.add('complete');
    text.classList.add('complete');
    text.textContent = `已同步 ${have} 位角色，可以创建群聊了`;
    if (deco) deco.textContent = `${have}/${need}`;
    submitBtn.style.opacity = '1';
    submitBtn.style.pointerEvents = 'auto';
  } else {
    fill.classList.remove('complete');
    text.classList.remove('complete');
    text.textContent = `还需选择 ${need - have} 位角色（不含本人）才能创建`;
    if (deco) deco.textContent = `${have}/${need}`;
    submitBtn.style.opacity = '.45';
    submitBtn.style.pointerEvents = 'none';
  }
}

/* ── 同步列表加载（与单聊"选择同步"复用同一份角色书数据源） ── */
async function gcLoadSelectData() {
  _gcAllItems = []; _gcSelected = new Set();
  const chars = await ncGetAllChars();
  chars.forEach(c => {
    _gcAllItems.push({ type: 'char', data: c, charName: c.name });
    (c.charNpcs || []).forEach(n => {
      _gcAllItems.push({ type: 'npc', data: n, charName: c.name, charId: c.id });
    });
  });
  gcRenderSelList();
  gcUpdateSyncStatus();
}

function gcSwitchSubTab(tab) {
  _gcSubTab = tab;
  ['all','char','npc'].forEach(t => {
    document.getElementById('gcStab' + t.charAt(0).toUpperCase() + t.slice(1))
      ?.classList.toggle('active', t === tab);
  });
  gcRenderSelList();
}

function gcFilterSelect(q) {
  gcRenderSelList(q.trim().toLowerCase());
}

function gcRenderSelList(q) {
  const list = document.getElementById('gcSelList');
  let items = _gcAllItems;
  if (_gcSubTab === 'char') items = items.filter(i => i.type === 'char');
  if (_gcSubTab === 'npc')  items = items.filter(i => i.type === 'npc');
  if (q) items = items.filter(i => (i.data.name||'').toLowerCase().includes(q));
  if (items.length === 0) {
    list.innerHTML = `<div class="nc-sel-empty"><div class="nc-sel-empty-title">没有找到</div><div class="nc-sel-empty-desc">角色书里还没有角色或 NPC，先去新建一个角色吧</div></div>`;
    return;
  }
  const relColor = {'恋人':'#c8a97e','友人':'#8eaec8','宿敌':'#c87e7e','家人':'#8ec8a3','其他':'#b8b8b0'};
  list.innerHTML = items.map((item, idx) => {
    const d = item.data;
    const letter = (d.name||'?')[0];
    const isChar = item.type === 'char';
    const key = isChar ? `char_${d.id}` : `npc_${item.charId}_${idx}`;
    const sel = _gcSelected.has(key);
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
    <div class="nc-sel-card${sel?' selected':''}" onclick="gcToggleSelect('${key}',this)" style="animation-delay:${idx*0.05}s">
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
}

function gcToggleSelect(key, cardEl) {
  const need = gcRequiredOthers();
  if (_gcSelected.has(key)) {
    _gcSelected.delete(key);
    cardEl.classList.remove('selected');
  } else {
    if (_gcSelected.size >= need) {
      gcShowToast(`最多同步 ${need} 位角色，可先调整群人数`);
      return;
    }
    _gcSelected.add(key);
    cardEl.classList.add('selected');
  }
  gcUpdateSyncStatus();
}

function gcShowToast(msg) {
  const t = document.getElementById('gcToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ── 创建群聊 ── */
async function gcCreateGroup() {
  const name = document.getElementById('gcFName').value.trim();
  if (!name) {
    document.getElementById('gcFName').focus();
    gcShowToast('请先填写群名称');
    return;
  }

  const groupId = document.getElementById('gcFGroupId').value.trim() || gcRandomId();
  const count = parseInt(document.getElementById('gcFCount').value, 10) || 3;
  const need = gcRequiredOthers();

  if (count < 3) {
    gcShowToast('群人数最少为 3 人（含本人）');
    return;
  }
  if (_gcSelected.size < need) {
    gcShowToast(`还需选择 ${need - _gcSelected.size} 位角色才能创建`);
    return;
  }

  // 收集已选成员
  const members = [];
  for (const key of _gcSelected) {
    const [type, ...rest] = key.split('_');
    let item;
    if (type === 'char') {
      const id = parseInt(rest[0]);
      item = _gcAllItems.find(i => i.type === 'char' && i.data.id === id);
    } else {
      item = _gcAllItems.find((i, idx) => `npc_${i.charId}_${idx}` === key);
    }
    if (!item) continue;
    members.push({
      name: item.data.name || '未命名',
      type: item.type,
      avatar: item.data.avatar || null,
      role: item.data.role || item.data.relDesc?.slice(0,20) || '',
      charId: item.type === 'char' ? item.data.id : item.charId,
    });
  }

  // 头像缩略：取前4位成员名首字作为蒙太奇格子
  const cells = members.slice(0, 4).map(m => m.name[0]);
  while (cells.length < 4) cells.push('');
  const cellStyles = cells.map((_, i) => (i % 2 === 1 ? 'dk' : ''));

  const groupRecord = {
    id: 'grp_' + Date.now(),
    name,
    groupId,
    desc: document.getElementById('gcFDesc').value.trim(),
    count,
    color: _gcColor,
    avatarMode: _gcAvatarMode,
    avatar: _gcAvatarMode === 'image' ? _gcAvatarData : null,
    emblem: _gcAvatarMode === 'text' ? (_gcEmblemText || name[0]) : null,
    members,
    section: 'My Groups',
    sub: `${members.length + 1} 位成员 · 群号 ${groupId}`,
    cells, cellStyles,
    badge: 0,
    createdAt: Date.now(),
  };

  groupsData.unshift(groupRecord);
  gcSaveGroupsToDB();

  // 同时写入会话列表，可点击进入群聊
  if (!convData.find(c => c.name === name)) {
    convData.unshift({
      name,
      initial: name[0],
      preview: `创建了群聊 · ${members.length + 1} 位成员`,
      time: ncNowTime(),
      timeVal: Date.now(),
      createdAt: Date.now(),
      unread: 0, online: false, pinned: false,
      type: 'grp',
      groupId: groupRecord.id,
    });
    dbSaveConv();
  }

  renderGroups();
  renderConvList();
  gcShowToast('群聊创建成功');
  closeCreateGroup();
}

/* ── 群聊数据持久化（复用 LunaChatDB，新建 groups 表） ── */
function gcSaveGroupsToDB() {
  getLunaChatDB().then(db => {
    if (!db.objectStoreNames.contains('groups')) return; // 表不存在时跳过，下次启动会自动建表
    const tx = db.transaction('groups', 'readwrite');
    const store = tx.objectStore('groups');
    store.clear();
    groupsData.forEach(g => store.put(g));
  }).catch(() => {});
}

async function gcLoadGroupsFromDB() {
  try {
    const db = await getLunaChatDB();
    if (!db.objectStoreNames.contains('groups')) return [];
    return new Promise(res => {
      const r = db.transaction('groups').objectStore('groups').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => res([]);
    });
  } catch { return []; }
}


/* ---- 初始化 ---- */
document.addEventListener('DOMContentLoaded', async () => {
  updateTime();
  updateBattery();
  setInterval(updateTime, 1000);

  // 先加载头像缓存，再恢复列表数据，确保渲染时头像已就绪
  await getAvatarCache();

  const savedConv    = await dbLoadConv();
  const savedFriends = await dbLoadFriends();
  const savedGroups  = await gcLoadGroupsFromDB();
  convData.push(...savedConv);
  friendsData.push(...savedFriends);
  groupsData.push(...savedGroups);

  /* renderConvList 由 pageshow 统一调用，这里不重复调用 */
  renderMoments();

  // 等 ProfileSnapshot 加载完再渲染故事环，确保头像已就绪
  loadProfileSnapshot().then(snap => {
    applyProfileSnap(snap);
    renderFriendStories();
    renderStoryRing();
  });

  const _returnTab = window.location.hash === '#profile' ? 'profile' : 'messages';
  switchTab(_returnTab);
  if (_returnTab === 'profile') history.replaceState(null, '', window.location.pathname);
  if (_returnTab === 'messages') {
    const firstBtn = document.getElementById('tabMessages');
    if (firstBtn) moveArc(firstBtn);
  }
  applyGlobalFont();
  applyIsland();
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
    const freshGroups = await gcLoadGroupsFromDB();
    groupsData.length = 0;
    groupsData.push(...freshGroups);
    renderGroups();
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
    renderGroups();
  }
});

function renderStoryRing() {
  const data = friendsData;
  const el = document.getElementById('storyRingList');
  if (!el) return;
  if (data.length === 0) { el.innerHTML = ''; return; }

  // 只渲染好友，不显示"我"
  const friendsHtml = data.map(d => {
    const cached = _avatarCache ? _avatarCache[d.name] : null;
    const initial = d.initial || (d.name||'?')[0].toUpperCase();
    const innerHtml = cached
      ? `<img src="${cached}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%;" alt=""/>`
      : `<span style="font-size:13px;color:#ccc;font-weight:600;">${initial}</span>`;
    return `
    <div class="ig-av-item" onclick="openFriendPopup('${d.name}')" style="cursor:pointer">
      <div class="ig-av-ring live">
        <div style="width:100%;height:100%;border-radius:50%;background:#1a1a22;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;">
          ${innerHtml}
          <div class="ig-ci-dot"></div>
        </div>
      </div>
      <div class="ig-av-name">${d.name}</div>
    </div>`;
  }).join('');

  el.innerHTML = friendsHtml;
}

function renderFriendStories() {
  // 优先读 ProfileSnapshot，为空则直接从 LunaIdentityDB 取最新身份
  function getActiveSnap() {
    return new Promise(res => {
      loadProfileSnapshot().then(snap => {
        // snap 有头像图才直接用，否则去 IdentityDB 拿完整数据
        if (snap && snap.avatarImg && snap.avatarImg.trim()) { res(snap); return; }
        const req = indexedDB.open('LunaIdentityDB');
        req.onsuccess = e => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('identities')) {
            db.close();
            // IdentityDB 里没数据，至少用 ProfileSnapshot 里的名字
            res(snap || null);
            return;
          }
          const r = db.transaction('identities').objectStore('identities').getAll();
          r.onsuccess = () => {
            db.close();
            const list = r.result || [];
            if (list.length === 0) { res(snap || null); return; }
            // 取 id 最大的（最近创建/选择的身份）
            const identity = list.sort((a, b) => (Number(b.id)||0) - (Number(a.id)||0))[0];
            // 如果 IdentityDB 里有头像就用它，否则合并 snap 的名字
            if (identity.avatarImg && identity.avatarImg.trim()) {
              res(identity);
            } else if (snap && snap.name) {
              res(snap);
            } else {
              res(identity);
            }
          };
          r.onerror = () => { db.close(); res(snap || null); };
        };
        req.onerror = () => { db.close(); res(snap || null); };
      });
    });
  }

  getActiveSnap().then(snap => {

    // ── 1a. My Story 圆圈（有 + 号，点击进编辑）ring 状态根据是否已发布 ──
    const av   = document.getElementById('mmtMyStoryAv');
    const ring = document.getElementById('mmtMyStoryRing');
    if (av && ring) {
      const published = localStorage.getItem('luna_my_story_published') === 'true';
      ring.classList.toggle('ring-active', published);
      ring.classList.toggle('ring-dash',   !published);

      // 填充 user 头像到 av
      av.innerHTML = '';
      if (snap && snap.avatarImg && snap.avatarImg.trim()) {
        const img = document.createElement('img');
        img.src = snap.avatarImg;
        img.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;border-radius:50%;';
        av.appendChild(img);
        if (snap.avatarColor) av.style.background = snap.avatarColor;
      } else if (snap) {
        av.style.background = snap.avatarColor && snap.avatarColor.trim() ? snap.avatarColor : '#222';
        const letter = document.createElement('span');
        letter.style.cssText = 'font-size:14px;color:#fff;font-weight:600;position:relative;z-index:1;';
        letter.textContent = (snap.name || '我')[0].toUpperCase();
        av.appendChild(letter);
      }

      // + 按钮挂在 arc-wrap 上（position:absolute 相对 arc-wrap 定位）
      let addBtn = document.getElementById('mmtMyStoryAdd');
      if (!addBtn) {
        addBtn = document.createElement('div');
        addBtn.id = 'mmtMyStoryAdd';
        addBtn.className = 'mmt-sc-add';
        addBtn.innerHTML = `<svg width="7" height="7" viewBox="0 0 12 12" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><path d="M6 2v8M2 6h8"/></svg>`;
        ring.appendChild(addBtn);   // ← 挂 arc-wrap，不是 av
      }
    }

    // ── 1b. 用户昵称圆圈（无 + 号，显示头像+昵称，点击查看自己发布的动态）──
    const userSlot = document.getElementById('mmtUserStory');
    if (userSlot && snap) {
      const bg = snap.avatarColor && snap.avatarColor.trim() ? snap.avatarColor : '#222';
      const shortName = snap.name ? (snap.name.length > 4 ? snap.name.slice(0,4) : snap.name) : '我';
      const published = localStorage.getItem('luna_my_story_published') === 'true';
      const ringClass = published ? 'ring-active' : 'ring-dash';
      const avatarHtml = snap.avatarImg && snap.avatarImg.trim()
        ? `<img src="${snap.avatarImg}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;border-radius:50%;" alt=""/>`
        : `<span style="font-size:13px;color:#fff;font-weight:600;position:relative;z-index:1;">${(snap.name||'我')[0].toUpperCase()}</span>`;
      userSlot.className = 'mmt-sc-item';
      userSlot.style.cursor = 'pointer';
      userSlot.onclick = () => {
        const raw = localStorage.getItem('luna_my_story_db');
        if (!raw) return;
        const data = JSON.parse(raw);
        /* 检查是否已过期 */
        if (data.expireAt && Date.now() > data.expireAt) {
          localStorage.removeItem('luna_my_story_db');
          localStorage.removeItem('luna_my_story_published');
          return;
        }
        storyViewerOpen(data);
      };
      userSlot.innerHTML = `
        <div class="mmt-sc-arc-wrap ${ringClass}">
          <div class="mmt-sc-av" style="background:${bg};">
            ${avatarHtml}
          </div>
        </div>
        <span class="mmt-sc-name mmt-sc-name-bold">${shortName}</span>`;
    }

    // ── 2. 好友故事环 ── 同步 friendsData，实时反映新加好友和头像
    const el = document.getElementById('mmtFriendStories');
    if (!el) return;
    if (friendsData.length === 0) { el.innerHTML = ''; return; }

    el.innerHTML = friendsData.map(d => {
      const initial = d.initial || (d.name || '?')[0].toUpperCase();
      const cachedAvatar = _avatarCache ? _avatarCache[d.name] : null;
      // Friends with avatar → solid dark ring (active); without → dashed grey ring
      const ringClass = cachedAvatar ? 'ring-active' : 'ring-dash';
      const avBg = cachedAvatar ? '#111' : '#e8e8e8';
      const textColor = cachedAvatar ? '#fff' : '#999';
      const avatarInner = cachedAvatar
        ? `<img src="${cachedAvatar}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;border-radius:50%;" alt=""/>`
        : `<span style="font-size:13px;color:${textColor};font-weight:600;position:relative;z-index:1;">${initial}</span>`;
      const displayName = d.name.length > 4 ? d.name.slice(0,4) : d.name;
      return `
        <div class="mmt-sc-item" onclick="openFriendPopup('${d.name.replace(/'/g,"\\'")}')">
          <div class="mmt-sc-arc-wrap ${ringClass}">
            <div class="mmt-sc-av" style="background:${avBg};">
              ${avatarInner}
            </div>
          </div>
          <span class="mmt-sc-name">${displayName}</span>
        </div>`;
    }).join('');
  });
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
        ${items.map(d => {
          let avHtml;
          if (d.avatarMode === 'image' && d.avatar) {
            avHtml = `<div class="ct-grp-av" style="display:block;"><img src="${d.avatar}" style="width:100%;height:100%;object-fit:cover;"/></div>`;
          } else if (d.avatarMode === 'text' && d.emblem) {
            avHtml = `<div class="ct-grp-av" style="display:flex;align-items:center;justify-content:center;background:#1a1a16;grid-template-columns:none;">
              <span style="font-family:'Cormorant Garamond',serif;font-size:16px;color:#f7f6f3;">${d.emblem}</span>
            </div>`;
          } else {
            avHtml = `<div class="ct-grp-av">${(d.cells||[]).map((c, i) => `<div class="ct-grp-cell ${(d.cellStyles||[])[i] === 'dk' ? 'dk' : ''}">${c}</div>`).join('')}</div>`;
          }

          const members = d.members || [];
          const visibleMembers = members.slice(0, 5);
          const memberStripHtml = visibleMembers.map(m => {
            const inner = m.avatar
              ? `<img src="${m.avatar}"/>`
              : `<span>${(m.name||'?')[0]}</span>`;
            return `<div class="ct-grp-mini-av">${inner}</div>`;
          }).join('');
          const moreCount = members.length - visibleMembers.length;
          const moreHtml = moreCount > 0
            ? `<span class="ct-grp-member-more">+${moreCount}</span>`
            : `<span class="ct-grp-member-more">含本人 共 ${members.length + 1} 人</span>`;

          return `
          <div class="ct-grp-item" onclick="openGroupChat('${d.name}', '${d.groupId || ''}')">
            <div class="ct-grp-top-row">
              ${avHtml}
              <div class="ct-grp-head-info">
                <div class="ct-grp-name-row">
                  <span class="ct-grp-name">${d.name}</span>
                  <span class="ct-grp-idtag">#${d.groupId || '——'}</span>
                </div>
                <div class="ct-grp-sub">${d.sub}</div>
              </div>
              <div class="ct-grp-status">
                ${d.badge > 0
                  ? `<div class="ct-grp-badge">${d.badge}</div>`
                  : `<div class="ct-grp-muted">Muted</div>`}
              </div>
            </div>
            <div class="ct-grp-member-strip">
              ${memberStripHtml}
              ${moreHtml}
            </div>
          </div>`;
        }).join('')}
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
    renderGroups(); // 每次切到群聊 Tab 都强制重渲染，确保新建群聊能即时显示
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

function openGroupChat(name, groupId) {
  localStorage.setItem('luna_island_enabled', localStorage.getItem('luna_island_enabled') || 'false');
  localStorage.setItem('luna_island_style',   localStorage.getItem('luna_island_style')   || 'minimal');
  localStorage.setItem('luna_current_group_name', name);
  localStorage.setItem('luna_current_group_id',   groupId || '');
  window.location.href = 'groupchat.html';
}

/* ================================
   角色资料页逻辑
================================ */

/* 从 LunaCharDB 按名字查找角色数据 */
async function getCharDataByName(name) {
  return new Promise(res => {
    openLunaCharDB().then(db => {
      if (!db.objectStoreNames.contains('chars')) { res(null); return; }
      const r = db.transaction('chars').objectStore('chars').getAll();
      r.onsuccess = () => {
        const found = (r.result || []).find(c => c.name === name);
        res(found || null);
      };
      r.onerror = () => res(null);
    }).catch(() => res(null));
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
    openLunaCharDB().then(db => {
      if (!db.objectStoreNames.contains('chars')) { res(null); return; }
      const r = db.transaction('chars').objectStore('chars').getAll();
      r.onsuccess = () => res((r.result || []).find(c => c.name === charName) || null);
      r.onerror = () => res(null);
    }).catch(() => res(null));
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
      openLunaCharDB().then(db => {
        if (!db.objectStoreNames.contains('chars')) { res(null); return; }
        const r = db.transaction('chars').objectStore('chars').getAll();
        r.onsuccess = () => res((r.result || []).find(c => c.name === charName) || null);
        r.onerror = () => res(null);
      }).catch(() => res(null));
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
    openLunaCharDB().then(db => {
      if (!db.objectStoreNames.contains('chars')) { res([]); return; }
      const r = db.transaction('chars').objectStore('chars').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror   = () => res([]);
    }).catch(() => res([]));
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
    openLunaCharDB().then(db => {
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
    }).catch(() => res());
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
    openLunaCharDB().then(db => {
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
    }).catch(() => res());
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
    openLunaCharDB().then(db => {
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
    }).catch(() => res());
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
  openLunaCharDB().then(db => {
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
  }).catch(() => console.error('[smOpenEdit] 打开数据库失败'));

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
    openLunaCharDB().then(db => {
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
    }).catch(() => res());
  });

  smCloseEdit();
  smRenderAll();
}

async function smNpcEditDelete() {
  if (!confirm('确定删除这个 NPC 吗？此操作不可恢复。')) return;

  await new Promise(res => {
    openLunaCharDB().then(db => {
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
    }).catch(() => res());
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
  openLunaCharDB().then(db => {
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
  }).catch(() => console.error('[smAiNpcDetailOpen] 打开数据库失败'));
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
    openLunaCharDB().then(db => {
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
    }).catch(() => res());
  });

  smAiNpcDetailClose();
  smRenderAll();
}

/* ================================
   Story 编辑器
================================ */
const SE_BG = [
  '#111','#1c1c1c','#2a2826','#1a1a2e','#0d1b2a',
  '#1b1b1b','#242424','#1e1a18','#18181a','#f5f5f3',
  '#eeece8','#e8e6e1','#dddbd6','#e5e5e5','#d6d6d6',
];

function storyEditorOpen() {
  const overlay = document.getElementById('storyEditorOverlay');
  const page    = document.getElementById('storyEditorPage');
  overlay.classList.add('show');
  page.classList.add('show');
  /* 同步状态栏时间 */
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const t  = new Date().toLocaleTimeString('zh-CN',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false});
  const el = document.getElementById('storyEditorTime');
  if (el) el.textContent = t;
  /* 同步电量 */
  const mainPct   = document.getElementById('batPct');
  const mainInner = document.getElementById('batInner');
  const sePct     = document.getElementById('storyEditorBatPct');
  const seInner   = document.getElementById('storyEditorBatInner');
  if (mainPct && sePct)     sePct.textContent = mainPct.textContent;
  if (mainInner && seInner) seInner.style.width = mainInner.style.width;
  /* 同步灵动岛 */
  const enabled  = localStorage.getItem('luna_island_enabled') === 'true';
  const style    = localStorage.getItem('luna_island_style') || 'minimal';
  const islandEl = document.getElementById('storyEditorIsland');
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
  /* 渲染背景色格子 */
  seBuildBgGrid();
}

function storyEditorClose() {
  document.getElementById('storyEditorOverlay').classList.remove('show');
  document.getElementById('storyEditorPage').classList.remove('show');
}

function seBuildBgGrid() {
  const grid = document.getElementById('seBgGrid');
  if (!grid || grid.childElementCount > 0) return;
  SE_BG.forEach((color, i) => {
    const el = document.createElement('div');
    el.className = 'se-bg-item' + (i === 0 ? ' active' : '');
    el.style.background = color;
    el.onclick = () => seSetBg(color, el);
    grid.appendChild(el);
  });
}

function seSetBg(color, el) {
  document.getElementById('seCanvasBg').style.background = color;
  document.querySelectorAll('.se-bg-item').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  const dark = ['#111','#1c1c1c','#2a2826','#1a1a2e','#0d1b2a','#1b1b1b','#242424','#1e1a18','#18181a'].includes(color);
  document.getElementById('sePrevText').style.color     = dark ? '#fff' : '#111';
  document.getElementById('sePrevDivider').style.background = dark ? 'rgba(255,255,255,.28)' : 'rgba(0,0,0,.2)';
  document.getElementById('seCanvasGrid') && (document.querySelector('.se-canvas-grid').style.opacity = dark ? '1' : '0');
}

function seUpdateText(el) {
  const val = el.value.slice(0, 150);
  if (el.value.length > 150) el.value = val;
  document.getElementById('seCharCount').textContent = val.length;
  const prev = document.getElementById('sePrevText');
  prev.innerHTML = val.trim()
    ? val.replace(/\n/g, '<br>')
    : '<span class="se-prev-ph">开始输入你的动态...</span>';
}

function seMode(mode, el) {
  document.querySelectorAll('.se-mpill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('seUploadZone').style.display = mode === 'photo' ? 'block' : 'none';
}

function seStyle(s, el) {} // 已废弃，保留空函数防报错

// 预览文字拖动
(function(){
  const el = document.getElementById('sePrevText');
  if (!el) return;
  el.style.pointerEvents = 'all';
  let dragging = false, ox = 0, oy = 0, sx = 0, sy = 0;

  function getXY(e) {
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX, y: t.clientY };
  }
  function onStart(e) {
    dragging = true;
    const { x, y } = getXY(e);
    const rect = el.getBoundingClientRect();
    ox = x - rect.left - rect.width / 2;
    oy = y - rect.top  - rect.height / 2;
    const layer = el.parentElement.getBoundingClientRect();
    sx = rect.left + rect.width / 2  - layer.left;
    sy = rect.top  + rect.height / 2 - layer.top;
    el.style.cursor = 'grabbing';
    e.preventDefault();
  }
  function onMove(e) {
    if (!dragging) return;
    const { x, y } = getXY(e);
    const layer = el.parentElement.getBoundingClientRect();
    const hw = el.offsetWidth  / 2;
    const hh = el.offsetHeight / 2;
    const nx = Math.min(Math.max(x - layer.left - ox, hw), layer.width  - hw);
    const ny = Math.min(Math.max(y - layer.top  - oy, hh), layer.height - hh);
    el.style.left      = nx + 'px';
    el.style.top       = ny + 'px';
    el.style.transform = 'translate(-50%,-50%)';
    e.preventDefault();
  }
  function onEnd() { dragging = false; el.style.cursor = 'grab'; }

  el.addEventListener('mousedown',  onStart, { passive: false });
  el.addEventListener('touchstart', onStart, { passive: false });
  window.addEventListener('mousemove',  onMove, { passive: false });
  window.addEventListener('touchmove',  onMove, { passive: false });
  window.addEventListener('mouseup',  onEnd);
  window.addEventListener('touchend', onEnd);
})();

function seAud(el) {
  document.querySelectorAll('.se-aud-item').forEach(a => a.classList.remove('active'));
  el.classList.add('active');
}

function seDurUpdate(v) {
  document.getElementById('seDurVal').textContent = v + 's';
}

function seImgUpload(e) {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    const layer = document.getElementById('seImgLayer');
    layer.style.backgroundImage = 'url(' + ev.target.result + ')';
    layer.classList.add('on');
  };
  r.readAsDataURL(file);
}

function sePublish() {
  /* 收集编辑器内容 */
  const text     = (document.getElementById('seTextarea') || {}).value || '';
  const bgEl     = document.getElementById('seCanvasBg');
  /* 背景：优先用 inline style，兜底用 #111 */
  const bg       = (bgEl && bgEl.style.background) ? bgEl.style.background : '#111';
  const imgLayer = document.getElementById('seImgLayer');
  const img      = imgLayer ? imgLayer.style.backgroundImage : '';

  /* 获取有效期（默认24h） */
  const activeChip = document.querySelector('.se-exp-chip.active');
  const hours      = activeChip ? parseInt(activeChip.textContent) : 24;
  const expireAt   = Date.now() + hours * 3600 * 1000;

  /* 获取浏览时长（白条填充秒数，默认7s） */
  const durSlider    = document.getElementById('seDurSlider');
  const viewDuration = durSlider ? Math.max(1, parseInt(durSlider.value)) : 7;

  /* 获取可见性 */
  const activeAud  = document.querySelector('.se-aud-item.active .se-aud-name');
  const audience   = activeAud ? activeAud.textContent : '所有人';

  /* 收集预览文字的内容、样式和位置 */
  const sePrev = document.getElementById('sePrevText');
  const bgDark = ['#111','#1c1c1c','#2a2826','#1a1a2e','#0d1b2a','#1b1b1b','#242424','#1e1a18','#18181a'].includes(bg);
  const textStyle = sePrev ? {
    color:         sePrev.style.color || (bgDark ? '#ffffff' : '#111111'),
    fontSize:      sePrev.style.fontSize || '',
    fontFamily:    sePrev.style.fontFamily || '',
    textAlign:     sePrev.style.textAlign || 'center',
    fontStyle:     sePrev.style.fontStyle || '',
    fontWeight:    sePrev.style.fontWeight || '',
    letterSpacing: sePrev.style.letterSpacing || '',
    lineHeight:    sePrev.style.lineHeight || '',
    /* 保存拖动后的位置 */
    left:          sePrev.style.left || '50%',
    top:           sePrev.style.top  || '50%',
  } : { color: '#ffffff', left: '50%', top: '50%' };

  /* 异步读取用户信息（从 ProfileSnapshot IndexedDB 或 LunaIdentityDB）*/
  function _getUserThenSave(username, avatarImg, avatarColor) {
    const now = Date.now();
    const storyData = {
      id:          now,
      text,
      bg,
      img,
      textStyle,
      audience,
      expireAt,
      expireHours: hours,
      viewDuration,
      publishedAt: now,
      username,
      avatarImg,
      avatarColor,
      watched:  false,
      views:    0,
      likes:    0,
      saves:    0,
      shares:   0,
      comments_list: [],
    };
    localStorage.setItem('luna_my_story_db', JSON.stringify(storyData));
    localStorage.setItem('luna_my_story_published', 'true');

    const ring = document.getElementById('mmtMyStoryRing');
    if (ring) { ring.classList.remove('ring-dash'); ring.classList.add('ring-active'); }
    if (typeof renderFriendStories === 'function') renderFriendStories();
    storyEditorClose();
    seToast('动态已发布 ✦');

    // 发布后自动触发好友互动（异步，不阻塞UI）
    setTimeout(() => svAutoFriendInteract(storyData).catch(() => {}), 800);
  }

  /* 先从 ProfileSnapshot DB 取，再从 IdentityDB 取，都失败则用 DOM 上的值 */
  loadProfileSnapshot().then(snap => {
    if (snap && snap.name) {
      _getUserThenSave(snap.name, snap.avatarImg || '', snap.avatarColor || '#444');
      return;
    }
    const req = indexedDB.open('LunaIdentityDB');
    req.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('identities')) {
        db.close();
        /* 从页面DOM取 */
        const domName = document.getElementById('profileName')?.textContent || 'luna_user';
        const domColor = document.getElementById('profileAvatar')?.style.background || '#444';
        const domImg = document.getElementById('profileAvatar')?.querySelector('img')?.src || '';
        _getUserThenSave(domName, domImg, domColor);
        return;
      }
      const r = db.transaction('identities').objectStore('identities').getAll();
      r.onsuccess = () => {
        db.close();
        const list = (r.result || []).sort((a,b)=>(Number(b.id)||0)-(Number(a.id)||0));
        if (list.length > 0) {
          const id = list[0];
          _getUserThenSave(id.name || 'luna_user', id.avatarImg || '', id.avatarColor || '#444');
        } else {
          const domName = document.getElementById('profileName')?.textContent || 'luna_user';
          _getUserThenSave(domName, '', '#444');
        }
      };
      r.onerror = () => { db.close(); _getUserThenSave('luna_user','','#444'); };
    };
    req.onerror = () => _getUserThenSave('luna_user','','#444');
  }).catch(() => _getUserThenSave('luna_user','','#444'));
}

function seToast(msg) {
  const t = document.getElementById('seToast');
  if (!t) return;
  t.textContent = msg; t.classList.add('on');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('on'), 2000);
}

function seTab(tab, el) {
  document.querySelectorAll('.se-ptab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.se-tc').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('se-tab-' + tab).classList.add('active');
}

function seExp(el) {
  document.querySelectorAll('.se-exp-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

let seToggleStates = { tog1: false, tog2: false, tog3: true };
function seToggle(id) {
  seToggleStates[id] = !seToggleStates[id];
  const el   = document.getElementById(id);
  const knob = document.getElementById(id + '-knob');
  if (seToggleStates[id]) {
    el.style.background = 'rgba(255,255,255,0.55)';
    knob.style.left = '18px';
  } else {
    el.style.background = 'rgba(255,255,255,0.12)';
    knob.style.left = '2px';
  }
}

/* ===== Story Viewer ===== */
function storyViewerOpen(data) {
  data = data || {};

  // ── 从 localStorage 读取最新 db（保证数据最新）──
  const rawDb = localStorage.getItem('luna_my_story_db');
  const db    = rawDb ? JSON.parse(rawDb) : data;

  const overlay = document.getElementById('storyViewerOverlay');
  const page    = document.getElementById('storyViewerPage');
  overlay.classList.add('show');
  page.classList.add('show');

  // ── 同步状态栏时间 ──
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const t  = new Date().toLocaleTimeString('zh-CN',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false});
  const timeEl = document.getElementById('storyViewerTime');
  if (timeEl) timeEl.textContent = t;

  // ── 同步电量 ──
  const mainPct   = document.getElementById('batPct');
  const mainInner = document.getElementById('batInner');
  const svPct     = document.getElementById('storyViewerBatPct');
  const svInner   = document.getElementById('storyViewerBatInner');
  if (mainPct && svPct)     svPct.textContent  = mainPct.textContent;
  if (mainInner && svInner) svInner.style.width = mainInner.style.width;

  // ── 同步灵动岛 ──
  const enabled  = localStorage.getItem('luna_island_enabled') === 'true';
  const islandStyle = localStorage.getItem('luna_island_style') || 'minimal';
  const islandEl = document.getElementById('storyViewerIsland');
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
      islandEl.innerHTML = styleMap[islandStyle] || styleMap.minimal;
    }
  }

  // ── 背景颜色强制同步 ──
  const svBgEl = document.getElementById('svBg');
  if (svBgEl) svBgEl.style.background = db.bg || '#111';

  // ── 图片层同步 ──
  const svImgLayerEl = document.getElementById('svImgLayer');
  if (svImgLayerEl) {
    if (db.img && db.img.trim()) {
      svImgLayerEl.style.backgroundImage = db.img;
      svImgLayerEl.classList.add('on');
    } else {
      svImgLayerEl.style.backgroundImage = '';
      svImgLayerEl.classList.remove('on');
    }
  }

  // ── 文字内容 + 样式 + 位置同步 ──
  const svTextEl = document.getElementById('svText');
  if (svTextEl) {
    svTextEl.innerHTML = (db.text || '').replace(/\n/g, '<br>');
    const ts = db.textStyle || {};
    svTextEl.style.color         = ts.color         || '#ffffff';
    svTextEl.style.fontSize      = ts.fontSize       || '';
    svTextEl.style.fontFamily    = ts.fontFamily     || '';
    svTextEl.style.textAlign     = ts.textAlign      || 'center';
    svTextEl.style.fontStyle     = ts.fontStyle      || '';
    svTextEl.style.fontWeight    = ts.fontWeight     || '';
    svTextEl.style.letterSpacing = ts.letterSpacing  || '';
    svTextEl.style.lineHeight    = ts.lineHeight     || '';
    /* 恢复拖动位置 */
    svTextEl.style.left      = ts.left || '50%';
    svTextEl.style.top       = ts.top  || '50%';
    svTextEl.style.transform = 'translate(-50%,-50%)';
  }

  // ── 隐藏 sv-subtext（文字下方的副标题，不再显示）──
  const svSubtextEl = document.getElementById('svSubtext');
  if (svSubtextEl) svSubtextEl.style.display = 'none';

  // ── 隐藏 sv-divider（文字上方的分割线，不再显示）──
  const svDividerEl = document.querySelector('.sv-divider');
  if (svDividerEl) svDividerEl.style.display = 'none';

  // ── 头像同步（清除CSS默认渐变，用db数据）──
  const svAvatarEl = document.getElementById('svAvatarInner');
  if (svAvatarEl) {
    svAvatarEl.innerHTML = '';
    svAvatarEl.style.cssText = 'width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:#fff;font-family:Inter,-apple-system,sans-serif;';
    if (db.avatarImg && db.avatarImg.trim()) {
      svAvatarEl.innerHTML = `<img src="${db.avatarImg}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else {
      svAvatarEl.textContent = (db.username || '我')[0].toUpperCase();
      svAvatarEl.style.background = db.avatarColor || '#444';
    }
  }

  // ── 用户名同步（优先从 ProfileSnapshot / IdentityDB 读，而非写死 luna_user）──
  const svUserEl = document.getElementById('svUsername');
  if (svUserEl) {
    // 先用 db 里发布时存的用户名（sePublish 已写入），同时异步刷新最新的
    svUserEl.textContent = db.username || (document.getElementById('profileName')?.textContent) || 'User';
    // 异步用最新 profile 覆盖，保证始终同步
    loadProfileSnapshot().then(snap => {
      if (snap && snap.name && svUserEl) svUserEl.textContent = snap.name;
    }).catch(() => {});
  }

  // ── 头像也实时刷新（保证与 profile 一致）──
  loadProfileSnapshot().then(snap => {
    const svAv = document.getElementById('svAvatarInner');
    if (!svAv) return;
    if (snap && snap.name) {
      svAv.innerHTML = '';
      svAv.style.cssText = 'width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:#fff;font-family:Inter,-apple-system,sans-serif;';
      if (snap.avatarImg && snap.avatarImg.trim()) {
        svAv.innerHTML = `<img src="${snap.avatarImg}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
      } else {
        svAv.textContent = (snap.name || '我')[0].toUpperCase();
        svAv.style.background = snap.avatarColor || '#444';
      }
    }
  }).catch(() => {});

  // ── 计算实际时长：优先从 expireAt-publishedAt 反推，兜底用 expireHours，再兜底 24 ──
  // 这样对旧数据（无 expireHours 字段）也能正确显示实际设置的时长
  let _totalMs;
  if (db.expireAt && db.publishedAt) {
    _totalMs = db.expireAt - db.publishedAt; // 精确反推
  } else if (db.expireHours) {
    _totalMs = db.expireHours * 3600 * 1000;
  } else {
    _totalMs = 24 * 3600 * 1000;
  }
  const _totalHours = Math.round(_totalMs / 3600000); // 四舍五入到整小时

  // ── meta：有效期 + 发布时间（从实际时长反推，新旧数据都准确）──
  const svMetaEl = document.getElementById('svMeta');
  if (svMetaEl) {
    svMetaEl.textContent = _totalHours + 'h 限时 · ' + _svTimeAgo(db.publishedAt);
  }

  // ── 剩余时间（根据 expireAt 实时计算，并启动实时更新）──
  const svTimerEl = document.getElementById('svTimerText');
  if (window._svTimerInterval) { clearInterval(window._svTimerInterval); window._svTimerInterval = null; }
  function _updateSvTimer() {
    if (!svTimerEl) return;
    if (db.expireAt) {
      const remain = db.expireAt - Date.now();
      if (remain > 0) {
        const rh = Math.floor(remain / 3600000);
        const rm = Math.floor((remain % 3600000) / 60000);
        svTimerEl.textContent = '剩余 ' + rh + 'h ' + rm + 'm';
      } else {
        svTimerEl.textContent = '已过期';
        if (window._svTimerInterval) { clearInterval(window._svTimerInterval); window._svTimerInterval = null; }
      }
    } else {
      svTimerEl.textContent = '';
    }
  }
  _updateSvTimer();
  window._svTimerInterval = setInterval(_updateSvTimer, 60000);

  // ── 进度条：根据是否已看过决定行为 ──
  // 第一次看：动画填充 → 自动关闭；再次看：直接显示满条，不自动关闭
  (function() {
    var wrap = document.getElementById('svProgressWrap');
    if (!wrap) return;

    var slides    = (db.slides && db.slides.length > 0) ? db.slides : [db];
    var totalCount = slides.length;
    var currentIdx = (typeof db.currentSlideIdx === 'number') ? db.currentSlideIdx : 0;
    var durSec     = (db.viewDuration && db.viewDuration > 0) ? db.viewDuration : 7;

    // 是否已经看过（db里记录）
    var alreadyWatched = db.watched === true;

    // 动态生成 bar HTML
    var html = '';
    for (var i = 0; i < totalCount; i++) {
      if (alreadyWatched || i < currentIdx) {
        // 已看过 或 之前的slide：直接填满
        html += '<div class="sv-prog-bar"><div class="sv-prog-done"></div></div>';
      } else if (i === currentIdx) {
        // 当前播放：从0%开始（第一次）或满（已看）
        var initW = alreadyWatched ? '100%' : '0%';
        html += '<div class="sv-prog-bar"><div class="sv-prog-fill" id="svProgFill" style="width:' + initW + ';transition:none;"></div></div>';
      } else {
        html += '<div class="sv-prog-bar"></div>';
      }
    }
    wrap.innerHTML = html;

    // 已看过：直接结束，不播放动画，不自动关闭
    if (alreadyWatched) return;

    // 第一次看：播放动画，结束后标记已看 + 自动关闭
    var svPage = document.getElementById('storyViewerPage');
    var started = false;

    function startFill() {
      if (started) return;
      started = true;
      var f = document.getElementById('svProgFill');
      if (!f) return;
      void f.offsetWidth;
      f.style.transition = 'width ' + durSec + 's linear';
      f.style.width = '100%';

      // 动画结束后：标记watched，自动关闭
      setTimeout(function() {
        // 写回 watched 状态
        var raw = localStorage.getItem('luna_my_story_db');
        if (raw) {
          try {
            var d = JSON.parse(raw);
            d.watched = true;
            localStorage.setItem('luna_my_story_db', JSON.stringify(d));
          } catch(e) {}
        }
        storyViewerClose();
      }, durSec * 1000);
    }

    if (svPage) {
      function onSlideEnd(e) {
        if (e.target !== svPage) return;
        svPage.removeEventListener('transitionend', onSlideEnd);
        startFill();
      }
      svPage.addEventListener('transitionend', onSlideEnd);
      setTimeout(startFill, 500);
    } else {
      setTimeout(startFill, 100);
    }
  })();

  // ── 浏览量：+1 写回 db ──
  const svViewsEl = document.getElementById('svViews');
  if (svViewsEl) {
    db.views = (db.views || 0) + 1;
    localStorage.setItem('luna_my_story_db', JSON.stringify(db));
    svViewsEl.textContent = db.views.toLocaleString();
  }

  // ── 评论区：清空，只渲染 db 里真实数据，并初始化手动滑动+自动滚动 ──
  const cmtScroll = document.getElementById('svCmtScroll');
  if (cmtScroll) {
    (async () => {
      // avatarCache[name] = 图片URL字符串 或 null
      let avatarCache = {};
      try { avatarCache = await getAvatarCache(); } catch(e) {}
      cmtScroll.innerHTML = '';
      const cmts = db.comments_list || [];
      cmts.forEach(c => {
        const el = document.createElement('div');
        el.className = 'sv-cmt';
        const imgUrl  = !c.isNpc ? (avatarCache[c.name] || c.avatarImg || '') : (c.avatarImg || '');
        const bgColor = c.color || '#555';
        const avStyle = imgUrl ? `background:${bgColor};overflow:hidden;padding:0;` : `background:${bgColor};`;
        const avContent = imgUrl
          ? `<img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
          : (c.initial || (c.name||'?')[0]);
        const avClass   = 'sv-cmt-av' + (c.isNpc ? ' npc-av' : '');
        const nameStyle = c.isNpc ? `color:${c.npcTextColor || c.color || '#ccc'};` : '';
        el.innerHTML = `<div class="${avClass}" style="${avStyle}">${avContent}</div><div><span class="sv-cmt-name" style="${nameStyle}">${c.name||''}</span><span class="sv-cmt-txt">${c.text||''}</span><div class="sv-cmt-lk">${c.likes||0} 个赞</div></div>`;
        cmtScroll.appendChild(el);
      });
      svInitCmtScroll(cmtScroll);
    })();
  }

  // ── 点赞/收藏/分享数从db读取，不写死 ──
  svLiked = false;
  svSaved = false;
  const likeIcon  = document.getElementById('svLikeIcon');
  const likeNum   = document.getElementById('svLikeNum');
  const saveIcon  = document.getElementById('svSaveIcon');
  const saveNum   = document.getElementById('svSaveNum');
  const shareNum  = document.getElementById('svShareNum');
  if (likeIcon) likeIcon.className = 'sv-act-icon';
  if (saveIcon) saveIcon.className = 'sv-act-icon';
  if (likeNum)  likeNum.textContent  = String(db.likes  || 0);
  if (saveNum)  saveNum.textContent  = String(db.saves  || 0);
  if (shareNum) shareNum.textContent = String(db.shares || 0);
}

// 辅助：发布时间转"刚刚/x分钟前/x小时前"
function _svTimeAgo(ts) {
  if (!ts) return '刚刚';
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return mins + ' 分钟前';
  return Math.floor(mins / 60) + ' 小时前';
}

/* ── 评论区：手动滑动 + 自动滚动 ── */
function svInitCmtScroll(el) {
  if (!el) return;

  // 停止旧动画
  if (window._svCmtRafId) { cancelAnimationFrame(window._svCmtRafId); window._svCmtRafId = null; }
  if (window._svCmtAutoIv) { clearInterval(window._svCmtAutoIv); window._svCmtAutoIv = null; }

  // 重置
  el.style.animation = 'none';
  el.style.transform = 'translateY(0px)';
  el.style.willChange = 'transform';

  const container = el.parentElement; // .sv-comments, overflow:hidden, height:130px

  const items = el.querySelectorAll('.sv-cmt');
  if (items.length === 0) return;

  // 内容总高 vs 容器高，判断是否需要滚动
  const containerH = container ? container.clientHeight : 130;
  const contentH   = el.scrollHeight || el.offsetHeight;
  const canScroll  = contentH > containerH + 4;

  let currentY  = 0;     // 当前 translateY（负值 = 向上）
  let isPaused  = false;
  let resumeTimer = null;
  let isDragging  = false;
  let startY      = 0;
  let startTransY = 0;
  let velocity    = 0;
  let lastY       = 0;
  let lastTs      = 0;
  let rafId       = null;

  function setY(y) {
    currentY = y;
    el.style.transform = 'translateY(' + y + 'px)';
  }

  // ── 自动向上滚动 ──
  const SPEED = 22; // px/s
  let lastRafTs = 0;
  function rafStep(ts) {
    if (!isPaused && canScroll) {
      const dt = ts - lastRafTs;
      if (dt > 0 && dt < 200) {
        const newY = currentY - SPEED * dt / 1000;
        // 到底后回顶（无缝循环）
        const minY = -(contentH - containerH);
        setY(newY <= minY ? 0 : newY);
      }
    }
    lastRafTs = ts;
    window._svCmtRafId = requestAnimationFrame(rafStep);
  }
  lastRafTs = performance.now();
  window._svCmtRafId = requestAnimationFrame(rafStep);

  function pause() {
    isPaused = true;
    if (resumeTimer) { clearTimeout(resumeTimer); resumeTimer = null; }
  }
  function scheduleResume() {
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => { isPaused = false; }, 2000);
  }

  // 惯性
  function applyMomentum() {
    if (Math.abs(velocity) < 0.3) { velocity = 0; return; }
    const minY = -(contentH - containerH);
    let newY = currentY + velocity;
    newY = Math.max(minY, Math.min(0, newY));
    setY(newY);
    velocity *= 0.88;
    rafId = requestAnimationFrame(applyMomentum);
  }
  function stopMomentum() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    velocity = 0;
  }

  function clampY(y) {
    const minY = canScroll ? -(contentH - containerH) : 0;
    return Math.max(minY, Math.min(0, y));
  }

  // ── Touch ──
  el.addEventListener('touchstart', e => {
    stopMomentum();
    pause();
    startY = e.touches[0].clientY;
    startTransY = currentY;
    lastY = startY;
    lastTs = e.timeStamp;
    isDragging = true;
    e.stopPropagation();
  }, { passive: false });

  el.addEventListener('touchmove', e => {
    if (!isDragging) return;
    const dy = e.touches[0].clientY - startY;
    const newY = clampY(startTransY + dy);
    // 速度采样
    const dts = e.timeStamp - lastTs;
    if (dts > 0) velocity = (e.touches[0].clientY - lastY) / dts * 16;
    lastY = e.touches[0].clientY;
    lastTs = e.timeStamp;
    setY(newY);
    e.stopPropagation();
    e.preventDefault();
  }, { passive: false });

  el.addEventListener('touchend', e => {
    isDragging = false;
    e.stopPropagation();
    applyMomentum();
    scheduleResume();
  }, { passive: false });

  // ── Mouse ──
  el.addEventListener('mousedown', e => {
    stopMomentum();
    pause();
    startY = e.clientY;
    startTransY = currentY;
    lastY = startY;
    lastTs = performance.now();
    isDragging = true;
    e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const dy = e.clientY - startY;
    const now = performance.now();
    const dts = now - lastTs;
    if (dts > 0) velocity = (e.clientY - lastY) / dts * 16;
    lastY = e.clientY;
    lastTs = now;
    setY(clampY(startTransY + dy));
  });
  window.addEventListener('mouseup', e => {
    if (!isDragging) return;
    isDragging = false;
    applyMomentum();
    scheduleResume();
  });
}

function storyViewerClose() {
  document.getElementById('storyViewerOverlay').classList.remove('show');
  document.getElementById('storyViewerPage').classList.remove('show');
  if (window._svTimerInterval) { clearInterval(window._svTimerInterval); window._svTimerInterval = null; }
  if (window._svCmtAutoIv)    { clearInterval(window._svCmtAutoIv);    window._svCmtAutoIv = null; }
  if (window._svCmtRafId)     { cancelAnimationFrame(window._svCmtRafId); window._svCmtRafId = null; }
}

let svLiked = false;
let svSaved = false;
function svToggleLike() {
  svLiked = !svLiked;
  const icon = document.getElementById('svLikeIcon');
  const num  = document.getElementById('svLikeNum');
  if (icon) icon.className = 'sv-act-icon' + (svLiked ? ' sv-liked' : '');
  const raw = localStorage.getItem('luna_my_story_db');
  if (raw) {
    const db = JSON.parse(raw);
    db.likes = Math.max(0, (db.likes || 0) + (svLiked ? 1 : -1));
    localStorage.setItem('luna_my_story_db', JSON.stringify(db));
    if (num) num.textContent = String(db.likes);
  }
}
function svToggleSave() {
  svSaved = !svSaved;
  const icon = document.getElementById('svSaveIcon');
  const num  = document.getElementById('svSaveNum');
  if (icon) icon.className = 'sv-act-icon' + (svSaved ? ' sv-liked' : '');
  const raw = localStorage.getItem('luna_my_story_db');
  if (raw) {
    const db = JSON.parse(raw);
    db.saves = Math.max(0, (db.saves || 0) + (svSaved ? 1 : -1));
    localStorage.setItem('luna_my_story_db', JSON.stringify(db));
    if (num) num.textContent = String(db.saves);
  }
}
function svDoShare() {
  // 已改为弹窗，保留空函数避免旧引用报错
}

/* ================================================
   转发弹窗 Forward Modal
================================================ */
let _fwdSelected = new Set();

function fwdOpen() {
  const raw = localStorage.getItem('luna_my_story_db');
  const db  = raw ? JSON.parse(raw) : {};

  // ── 1. 填充内容预览 ──
  const previewText = document.getElementById('fwdPreviewText');
  const previewMeta = document.getElementById('fwdPreviewMeta');
  const previewNum  = document.getElementById('fwdPreviewNum');
  const thumb       = document.getElementById('fwdThumb');

  if (previewText) {
    const txt = (db.text || '').replace(/<[^>]+>/g, '').trim();
    previewText.textContent = txt || '（无文字内容）';
  }
  if (previewNum) {
    previewNum.textContent = String(db.shares || 0);
  }
  if (thumb) {
    if (db.bgImage && db.bgImage.trim()) {
      thumb.innerHTML = '<img src="' + db.bgImage + '">';
    } else if (db.bgColor) {
      thumb.style.background = db.bgColor;
      thumb.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.6" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
    } else {
      thumb.style.background = '';
      thumb.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#444" stroke-width="1.6" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
    }
  }

  // 用户名从 ProfileSnapshot 同步（异步）
  if (previewMeta) {
    loadProfileSnapshot().then(snap => {
      const username = snap?.name || db.username
        || document.getElementById('svUsername')?.textContent
        || 'User';
      const timeAgo = _svTimeAgo(db.publishedAt);
      previewMeta.textContent = 'Story · @' + username + ' · ' + timeAgo;
    }).catch(() => {
      const username = db.username || 'User';
      if (previewMeta) previewMeta.textContent = 'Story · @' + username + ' · ' + _svTimeAgo(db.publishedAt);
    });
  }

  // ── 2. 渲染好友环（含角色头像异步加载） ──
  _fwdSelected = new Set();
  _fwdRenderRings(); // async，内部已 await avatarCache

  // ── 3. 核对转发数据完整性 ──
  const shares  = db.shares || 0;
  const records = db.forward_records || [];
  const listEl  = document.getElementById('fwdRecordsList');
  const totalEl = document.getElementById('fwdRecordsTotal');

  if (shares > 0 && records.length === 0) {
    if (totalEl) totalEl.textContent = '共 ' + shares + ' 次转发';
    if (listEl) listEl.innerHTML = `
      <div class="fwd-records-empty" style="line-height:1.8;">
        <span style="font-size:11px;color:#666;">正在重新生成转发记录…</span>
      </div>`;
    setTimeout(() => fwdRefreshRecords(true), 300);
  } else {
    _fwdRenderRecords(db);
  }

  // ── 4. 重置底部 ──
  const msgInput = document.getElementById('fwdMsgInput');
  if (msgInput) msgInput.value = '';
  _fwdUpdateSendBtn();

  // ── 5. 打开弹窗 ──
  document.getElementById('fwdOverlay')?.classList.add('active');
  document.getElementById('fwdSheet')?.classList.add('active');
}

function fwdClose() {
  document.getElementById('fwdOverlay')?.classList.remove('active');
  document.getElementById('fwdSheet')?.classList.remove('active');
}

/* ── 刷新/重新生成转发记录 ── */
async function fwdRefreshRecords(silent) {
  const listEl  = document.getElementById('fwdRecordsList');
  const totalEl = document.getElementById('fwdRecordsTotal');
  const btn     = document.getElementById('fwdRefreshBtn');

  // 防止重复点击
  if (btn && btn._refreshing) return;
  if (btn) { btn._refreshing = true; btn.style.opacity = '0.4'; }

  if (!silent) {
    if (listEl) listEl.innerHTML = '<div class="fwd-records-empty">重新生成中…</div>';
  }

  try {
    let db = _svGetDb();
    if (!db) { if (!silent) _svShowToast('还没有发布动态哦'); return; }

    // 清空旧的转发记录和转发数（重新生成）
    db.forward_records = [];
    db.shares = 0;
    db.friends_interacted = false;
    db.friends_interacted_names = [];
    db.npc_interacted = false;
    _svSaveDb(db);

    // Step 1：确保有好友，没有就先生成
    let realFriends = [...friendsData];
    if (realFriends.length === 0) {
      if (listEl) listEl.innerHTML = '<div class="fwd-records-empty">正在生成好友角色…</div>';
      realFriends = await _svGenerateFriendsList();
      _fwdRenderRings(); // 刷新好友环
    }

    // Step 2：好友互动（含转发文案）
    if (realFriends.length > 0) {
      if (listEl) listEl.innerHTML = '<div class="fwd-records-empty">好友互动生成中…</div>';
      const audience = db.audience || '所有人';
      let targetFriends = realFriends;
      if (audience === '限定好友') {
        const shuffled = [...realFriends].sort(() => Math.random() - 0.5);
        targetFriends = shuffled.slice(0, Math.min(3, shuffled.length));
      }
      db = await _svGenerateFriendInteractions(db, targetFriends);
      _svRefreshUI(db);
    }

    // Step 3：所有人模式 → 追加 NPC 互动
    const audience2 = db.audience || '所有人';
    if (audience2 === '所有人') {
      if (listEl) listEl.innerHTML = '<div class="fwd-records-empty">NPC 互动生成中…</div>';
      db = await _svGenerateNPCInteractions(db);
      _svRefreshUI(db);
    }

    // 刷新弹窗预览数字
    const previewNum = document.getElementById('fwdPreviewNum');
    if (previewNum) previewNum.textContent = String(db.shares || 0);

    // 刷新记录列表
    _fwdRenderRecords(db);
    if (!silent) _svShowToast('✦ 转发记录已重新生成');

  } catch(e) {
    console.error('fwdRefreshRecords error:', e);
    if (!silent) _svShowToast('生成失败：' + (e.message || '未知错误'));
    // 失败时恢复显示原有记录
    const db2 = _svGetDb();
    if (db2) _fwdRenderRecords(db2);
  } finally {
    if (btn) { btn._refreshing = false; btn.style.opacity = ''; }
  }
}

async function _fwdRenderRings() {
  const container = document.getElementById('fwdRingScroll');
  if (!container) return;

  const list = (typeof friendsData !== 'undefined' && friendsData.length > 0)
    ? friendsData
    : [];

  if (list.length === 0) {
    container.innerHTML = '<div style="font-size:12px;color:#333;padding:8px 0;">暂无好友</div>';
    return;
  }

  // 获取头像缓存（LunaCharDB 中的角色头像）
  let cache = {};
  try { cache = await getAvatarCache(); } catch(e) {}

  container.innerHTML = list.map(f => {
    const sel     = _fwdSelected.has(f.name);
    const initial = (f.name || '?')[0].toUpperCase();
    // 优先用角色头像缓存，其次用 friendsData 里存的头像，再用首字母
    const imgUrl  = cache[f.name] || f.avatarImg || '';
    const avContent = imgUrl
      ? `<img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
      : initial;
    return `
      <div class="fwd-ring-item" onclick="fwdToggle('${f.name}')">
        <div class="fwd-ring-wrap">
          <div class="fwd-ring-border${sel ? ' fwd-sel' : ''}" id="fwdRb-${f.name}"></div>
          <div class="fwd-ring-av${sel ? ' fwd-sel' : ''}" id="fwdRa-${f.name}">${avContent}</div>
          ${f.online ? '<div class="fwd-ring-online-dot"></div>' : ''}
          <div class="fwd-ring-check${sel ? ' fwd-show' : ''}" id="fwdRc-${f.name}">
            <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="3.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </div>
        <div class="fwd-ring-name${sel ? ' fwd-sel' : ''}" id="fwdRn-${f.name}">${f.name}</div>
      </div>`;
  }).join('');
}

function fwdToggle(name) {
  if (_fwdSelected.has(name)) {
    _fwdSelected.delete(name);
  } else {
    _fwdSelected.add(name);
  }
  // 更新该好友的环状态
  const sel = _fwdSelected.has(name);
  const rb = document.getElementById('fwdRb-' + name);
  const ra = document.getElementById('fwdRa-' + name);
  const rc = document.getElementById('fwdRc-' + name);
  const rn = document.getElementById('fwdRn-' + name);
  if (rb) rb.className = 'fwd-ring-border' + (sel ? ' fwd-sel' : '');
  if (ra) ra.className = 'fwd-ring-av'     + (sel ? ' fwd-sel' : '');
  if (rc) rc.className = 'fwd-ring-check'  + (sel ? ' fwd-show' : '');
  if (rn) rn.className = 'fwd-ring-name'   + (sel ? ' fwd-sel' : '');
  _fwdUpdateSendBtn();
}

function _fwdUpdateSendBtn() {
  const btn  = document.getElementById('fwdSendBtn');
  const hint = document.getElementById('fwdSelHint');
  const n    = _fwdSelected.size;
  if (btn) {
    if (n > 0) {
      btn.className = 'fwd-send-btn fwd-active';
    } else {
      btn.className = 'fwd-send-btn';
    }
  }
  if (hint) {
    hint.textContent = n > 0 ? '已选 ' + n + ' 人' : '点击头像选择好友';
  }
}

function _fwdRenderRecords(db) {
  const list     = document.getElementById('fwdRecordsList');
  const totalEl  = document.getElementById('fwdRecordsTotal');
  const records  = (db && db.forward_records) ? db.forward_records : [];

  if (totalEl) totalEl.textContent = '共 ' + records.length + ' 次转发';

  if (!list) return;
  if (records.length === 0) {
    list.innerHTML = '<div class="fwd-records-empty">暂无转发记录</div>';
    return;
  }

  list.innerHTML = records.map(r => {
    const initial   = r.initial || (r.name || '?')[0].toUpperCase();
    const hasImg    = r.avatarImg && r.avatarImg.trim();
    const avContent = hasImg ? '<img src="' + r.avatarImg + '">' : initial;
    const caption   = (r.caption || '').trim();
    const toChips   = (r.to || []).map(n => '<span class="fwd-record-chip">' + n + '</span>').join('');
    return `
      <div class="fwd-record-item">
        <div class="fwd-record-av">${avContent}</div>
        <div class="fwd-record-body">
          <div class="fwd-record-top">
            <span class="fwd-record-name">${r.name || '未知'}</span>
            <span class="fwd-record-time">${r.time || ''}</span>
          </div>
          ${caption
            ? '<div class="fwd-record-caption">' + caption + '</div>'
            : '<div class="fwd-record-caption fwd-no-caption">未附留言</div>'
          }
          <div class="fwd-record-to">
            <span class="fwd-record-to-label">转给</span>
            ${toChips || '<span class="fwd-record-chip">—</span>'}
          </div>
        </div>
      </div>`;
  }).join('');
}

function fwdDoSend() {
  if (_fwdSelected.size === 0) return;

  const raw = localStorage.getItem('luna_my_story_db');
  if (!raw) return;
  const db  = JSON.parse(raw);

  const caption = (document.getElementById('fwdMsgInput')?.value || '').trim();

  // 按钮立即进入已发送状态
  const btn = document.getElementById('fwdSendBtn');
  if (btn) {
    btn.textContent = '发送中…';
    btn.style.opacity = '0.6';
    btn.style.cursor = 'not-allowed';
  }

  // 异步从 ProfileSnapshot 读取真实用户信息
  loadProfileSnapshot().then(snap => {
    const username  = snap?.name  || db.username || '我';
    const avatarImg = snap?.avatarImg  || db.avatarImg  || '';
    const avatarColor = snap?.avatarColor || db.avatarColor || '#555';
    const initial   = (username || '?')[0].toUpperCase();

    const newRecord = {
      name:      username,
      initial:   initial,
      avatarImg: avatarImg,
      time:      '刚刚',
      caption:   caption,
      to:        [..._fwdSelected]
    };

    if (!db.forward_records) db.forward_records = [];
    db.forward_records.unshift(newRecord);

    // 更新转发数
    db.shares = (db.shares || 0) + 1;
    localStorage.setItem('luna_my_story_db', JSON.stringify(db));

    // 更新页面上的转发数字
    const shareNumEl = document.getElementById('svShareNum');
    if (shareNumEl) shareNumEl.textContent = String(db.shares);

    // 刷新弹窗数字 & 记录列表
    const previewNum = document.getElementById('fwdPreviewNum');
    if (previewNum) previewNum.textContent = String(db.shares);
    _fwdRenderRecords(db);

    // ── 计算剩余分钟（从 publishedAt + expireHours 动态算） ──
    const publishedAt  = db.publishedAt || Date.now();
    const expireHours  = db.expireHours || 24;
    const totalMinutes = expireHours * 60;
    const elapsedMin   = Math.floor((Date.now() - publishedAt) / 60000);
    const minLeft      = Math.max(0, totalMinutes - elapsedMin);

    // ── 判断有无图片（用 db.img 或 db.bg.type） ──
    const hasBgImg = db.img || (db.bg && db.bg.type === 'image' && db.bg.src);
    const bgImgSrc = db.img || (db.bg && db.bg.src) || '';

    // ── story card 消息体 ──
    const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
    const nowStr = new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz
    });

    const storyCardMsg = {
      role:          'mine',
      isStoryCard:   true,
      time:          nowStr,
      // story 内容字段（完整同步）
      scType:        hasBgImg ? 'image' : 'text',
      scText:        (db.text || '').replace(/<[^>]+>/g, '').trim(),
      scUsername:    username,
      scAvatarImg:   avatarImg,
      scAvatarColor: avatarColor,
      scCaption:     caption,
      scBgImage:     bgImgSrc,
      scBgColor:     db.bgColor || (db.bg && db.bg.color) || '',
      scMinLeft:     minLeft,         // 实时剩余分钟
      scTotalMin:    totalMinutes,    // 总时长（用于燃烧条比例）
      scPublishedAt: publishedAt,
      scExpireHours: expireHours,
      scViews:       db.views || db.likes || 0,
      scNo:          'No. ' + String(Math.floor(Math.random() * 900 + 100)),
      // 转发人
      fwdFrom:       username,
      fwdCaption:    caption,
    };

    // ── 写入目标好友的 LunaChatDB messages ──
    _fwdWriteStoryCardToChats([..._fwdSelected], storyCardMsg);

    // 按钮反馈
    if (btn) {
      btn.textContent  = '已发送 ✦';
      btn.style.opacity = '1';
      btn.style.background = '#2a2a2a';
      btn.style.color  = '#888';
      btn.style.cursor = 'not-allowed';
    }

    setTimeout(() => {
      _fwdSelected = new Set();
      const msgInput = document.getElementById('fwdMsgInput');
      if (msgInput) msgInput.value = '';
      _fwdUpdateSendBtn();
      if (btn) {
        btn.textContent  = '发送';
        btn.style.background = '';
        btn.style.color  = '';
        btn.style.cursor = '';
      }
    }, 1800);
  }).catch(() => {
    if (btn) { btn.textContent = '发送'; btn.style.opacity = '1'; btn.style.cursor = ''; }
  });
}

/* ── 将 story card 消息追加进各好友的 LunaChatDB messages 记录 ── */
function _fwdWriteStoryCardToChats(friends, storyCardMsg) {
  function openDB() {
    return new Promise((res, rej) => {
      const probe = indexedDB.open('LunaChatDB');
      probe.onsuccess = e => {
        const db  = e.target.result;
        const ver = db.version;
        const ok  = db.objectStoreNames.contains('messages');
        db.close();
        const r = indexedDB.open('LunaChatDB', ok ? ver : ver + 1);
        if (!ok) {
          r.onupgradeneeded = e2 => {
            if (!e2.target.result.objectStoreNames.contains('messages')) {
              e2.target.result.createObjectStore('messages', { keyPath: 'chatKey' });
            }
          };
        }
        r.onsuccess = e2 => res(e2.target.result);
        r.onerror   = () => rej();
      };
      probe.onerror = () => rej();
    });
  }

  openDB().then(db => {
    friends.forEach(friendName => {
      const tx1 = db.transaction('messages', 'readonly');
      const req  = tx1.objectStore('messages').get(friendName);
      req.onsuccess = () => {
        const msgs = (req.result && req.result.msgs) ? [...req.result.msgs] : [];
        // 每个接收好友获得独立的消息副本
        msgs.push({ ...storyCardMsg, _fwdTo: friendName });
        const tx2 = db.transaction('messages', 'readwrite');
        tx2.objectStore('messages').put({ chatKey: friendName, msgs });
      };
    });
  }).catch(e => console.warn('[fwd] story card write failed', e));
}

/* ================================================
   AI 模拟互动系统
   - sePublish 后自动触发好友互动生成
   - svTriggerAI 按钮：好友未完成→先生成好友，完成后生成NPC（所有人模式）
================================================ */

// 马卡龙浅色系色盘（NPC头像背景）
const _NPC_PASTEL = [
  '#FFD6E0','#FFDDD2','#FFF3CD','#D8F3DC','#C8E6FA','#E8D5F5',
  '#FFE5EC','#FFF0E6','#E6FAF5','#F0E6FF','#FAF0E6','#E6F0FF',
  '#FADADD','#F5E6CC','#CCF5E6','#CCE5F5','#F0CCF5','#F5CCE5',
];
function _npcPastel(idx) { return _NPC_PASTEL[idx % _NPC_PASTEL.length]; }

// 从 localStorage 读取 story db（helper）
function _svGetDb() {
  const raw = localStorage.getItem('luna_my_story_db');
  return raw ? JSON.parse(raw) : null;
}
function _svSaveDb(db) {
  localStorage.setItem('luna_my_story_db', JSON.stringify(db));
}

// 刷新 UI 中的互动数字
function _svRefreshUI(db) {
  const likeNum  = document.getElementById('svLikeNum');
  const saveNum  = document.getElementById('svSaveNum');
  const shareNum = document.getElementById('svShareNum');
  if (likeNum)  likeNum.textContent  = String(db.likes  || 0);
  if (saveNum)  saveNum.textContent  = String(db.saves  || 0);
  if (shareNum) shareNum.textContent = String(db.shares || 0);
}

// 刷新评论区 UI（带头像缓存同步）
function _svRefreshComments(db) {
  const cmtScroll = document.getElementById('svCmtScroll');
  if (!cmtScroll) return;
  (async () => {
    // avatarCache[name] = 图片URL字符串 或 null
    let avatarCache = {};
    try { avatarCache = await getAvatarCache(); } catch(e) {}
    cmtScroll.innerHTML = '';
    const cmts = db.comments_list || [];
    cmts.forEach(c => {
      const el = document.createElement('div');
      el.className = 'sv-cmt';
      const imgUrl  = !c.isNpc ? (avatarCache[c.name] || c.avatarImg || '') : (c.avatarImg || '');
      const bgColor = c.color || '#555';
      const avStyle = imgUrl ? `background:${bgColor};overflow:hidden;padding:0;` : `background:${bgColor};`;
      const avContent = imgUrl
        ? `<img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : (c.initial || (c.name||'?')[0]);
      const avClass   = 'sv-cmt-av' + (c.isNpc ? ' npc-av' : '');
      const nameStyle = c.isNpc ? `color:${c.npcTextColor || c.color || '#ccc'};` : '';
      el.innerHTML = `<div class="${avClass}" style="${avStyle}">${avContent}</div><div><span class="sv-cmt-name" style="${nameStyle}">${c.name||''}</span><span class="sv-cmt-txt">${c.text||''}</span><div class="sv-cmt-lk">${c.likes||0} 个赞</div></div>`;
      cmtScroll.appendChild(el);
    });
    svInitCmtScroll(cmtScroll);
  })();
}

// 动画增加浏览量
function _svAnimateViews(db, addCount) {
  const el = document.getElementById('svViews');
  if (!el) return;
  const start = db.views || 0;
  const end   = start + addCount;
  db.views = end;
  _svSaveDb(db);
  let cur = start;
  const step = Math.max(1, Math.round(addCount / 30));
  const iv = setInterval(() => {
    cur = Math.min(cur + step, end);
    el.textContent = cur.toLocaleString();
    if (cur >= end) clearInterval(iv);
  }, 60);
}

// 调用 AI 的通用函数（沿用 chat.js 已有的 openai-compat 接口）
async function _svCallAI(systemPrompt, userPrompt, maxTokens) {
  const cur   = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  if (!cur.baseUrl || !cur.apiKey || !model) throw new Error('请先配置 API');
  const resp = await fetch(`${cur.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cur.apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
      max_tokens: maxTokens || 800,
      stream: false,
    }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// 安全 JSON 解析，去除 markdown 代码块
function _svParseJson(text) {
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch(e) {
    // 尝试提取第一个 [...] 或 {...}
    const m = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (m) { try { return JSON.parse(m[1]); } catch(e2) {} }
    return null;
  }
}

// 生成好友互动（评论、点赞、收藏、转发）
async function _svGenerateFriendInteractions(db, friends) {
  if (!friends || friends.length === 0) return db;

  const storyText   = db.text || '（图片动态，无文字）';
  const audience    = db.audience || '所有人';
  const friendsDesc = friends.map(f =>
    `昵称:${f.name} 人设简介:${f.bio || '无'}`
  ).join('\n');

  const systemPrompt = `你是一个社交平台模拟引擎，根据用户发布的限时动态内容和好友人设，模拟每个好友的真实互动行为。
返回严格的 JSON 数组，每个元素对应一个好友：
[
  {
    "name": "好友昵称（必须与输入完全一致）",
    "action_like": true/false,
    "action_save": true/false,
    "action_share": true/false,
    "forward_caption": "若 action_share 为 true，转发时附带的文案（符合该好友性格，15字以内，口语化自然），action_share 为 false 则为空字符串",
    "forward_to": ["转发给的1-2个虚构好友昵称，若不转发则为空数组"],
    "comment": "评论内容，符合该好友性格，不超过30字，若不评论则为空字符串"
  }
]
只返回 JSON，不要说任何其他内容。`;

  const userPrompt = `动态内容：${storyText}
可见范围：${audience}
好友列表：
${friendsDesc}`;

  const raw  = await _svCallAI(systemPrompt, userPrompt, 1200);
  const list = _svParseJson(raw);
  if (!Array.isArray(list)) return db;

  let avatarCache = {};
  try { avatarCache = await getAvatarCache(); } catch(e) {}

  let likesAdd = 0, savesAdd = 0, sharesAdd = 0;
  const newCmts       = [];
  const newFwdRecords = [];
  let   timeOffset    = 0;

  list.forEach(item => {
    const friend = friends.find(f => f.name === item.name);
    if (!friend) return;
    if (item.action_like) likesAdd++;
    if (item.action_save) savesAdd++;
    if (item.action_share) {
      sharesAdd++;
      const imgUrl = avatarCache[friend.name] || '';
      const mins   = timeOffset + Math.floor(Math.random() * 8) + 1;
      timeOffset   = mins;
      newFwdRecords.push({
        name:      friend.name,
        initial:   friend.initial || friend.name[0],
        avatarImg: imgUrl,
        color:     friend.avatarColor || '#555',
        caption:   (item.forward_caption || '').trim(),
        to:        Array.isArray(item.forward_to) ? item.forward_to.slice(0, 2) : [],
        time:      mins < 60 ? mins + ' 分钟前' : Math.floor(mins / 60) + ' 小时前',
        isNpc:     false,
      });
    }
    if (item.comment && item.comment.trim()) {
      const imgUrl = avatarCache[friend.name] || '';
      newCmts.push({
        name:      friend.name,
        initial:   friend.initial || friend.name[0],
        color:     friend.avatarColor || '#555',
        avatarImg: imgUrl,
        text:      item.comment.trim(),
        likes:     Math.floor(Math.random() * 5),
        isNpc:     false,
      });
    }
  });

  db.likes           = (db.likes  || 0) + likesAdd;
  db.saves           = (db.saves  || 0) + savesAdd;
  db.shares          = (db.shares || 0) + sharesAdd;
  db.comments_list   = [...(db.comments_list  || []), ...newCmts];
  // 好友转发记录插到最前面
  db.forward_records = [...newFwdRecords, ...(db.forward_records || [])];
  db.friends_interacted       = true;
  db.friends_interacted_names = friends.map(f => f.name);
  _svSaveDb(db);
  return db;
}

// 生成好友列表（如果 friendsData 为空）
async function _svGenerateFriendsList() {
  const systemPrompt = `你是一个虚拟社交平台的好友生成器。生成5个有个性的好友角色，返回严格 JSON 数组：
[
  {
    "name": "好友昵称（2-4个中文字或英文名）",
    "bio": "人设简介，20字以内，描述性格和爱好",
    "initial": "昵称首字母或首字"
  }
]
昵称要有个性，不要太普通，风格各异。只返回JSON。`;

  const raw = await _svCallAI(systemPrompt, '请生成5个好友角色', 600);
  const list = _svParseJson(raw);
  if (!Array.isArray(list)) return [];

  list.forEach(item => {
    if (!item.name) return;
    if (friendsData.find(f => f.name === item.name)) return;
    const letter = (item.initial || item.name[0] || 'A').toUpperCase();
    friendsData.push({
      name:    item.name,
      initial: item.name[0] || 'F',
      bio:     item.bio || '神秘好友',
      group:   letter,
      style:   '',
      online:  Math.random() > 0.5,
      tag:     '',
    });
  });

  dbSaveFriends();
  renderFriends();
  renderStoryRing();
  return friendsData;
}

// 生成 NPC 互动（所有人模式）
async function _svGenerateNPCInteractions(db) {
  const storyText = db.text || '（图片动态）';

  const systemPrompt = `你是一个社交平台模拟引擎，为用户的公开限时动态生成来自陌生人NPC的互动数据。
返回严格的 JSON 对象：
{
  "views_add": 数字（增加的浏览量，50到300之间），
  "likes_add": 数字（增加的点赞数，5到40之间），
  "saves_add": 数字（增加的收藏数，1到15之间）,
  "npcs": [
    {
      "nickname": "NPC昵称（2-5个字，有个性，风格多样）",
      "comment": "评论内容，不超过25字，口语化自然，符合该NPC风格",
      "action_share": true/false,
      "forward_caption": "若 action_share 为 true，转发时附带的一句话文案（10字以内，自然口语），否则为空字符串",
      "forward_to": ["转发给的1-2个虚构昵称，不转发则为空数组"],
      "pastel_text_color": "一个浅色马卡龙色值如#FFB3C1（用于昵称和评论文字颜色）",
      "bg_color": "头像背景色，比文字色略深的马卡龙色"
    }
  ]（4到8个NPC，每人都有评论，约30%的NPC会转发）
}
昵称要多样：有二次元风、文艺风、可爱风、酷盖风等。只返回JSON。`;

  const raw    = await _svCallAI(systemPrompt, `动态内容：${storyText}`, 1200);
  const result = _svParseJson(raw);
  if (!result) return db;

  const npcs      = result.npcs || [];
  const newCmts   = [];
  const newFwdRec = [];
  let   sharesAdd = 0;
  let   timeOff   = 0;

  npcs.forEach((npc, i) => {
    newCmts.push({
      name:         npc.nickname || `路人${i+1}`,
      initial:      (npc.nickname || 'N')[0],
      color:        npc.bg_color || _npcPastel(i),
      avatarImg:    '',
      text:         npc.comment || '',
      likes:        Math.floor(Math.random() * 12),
      isNpc:        true,
      npcTextColor: npc.pastel_text_color || npc.bg_color || _npcPastel(i),
    });
    if (npc.action_share) {
      sharesAdd++;
      const mins = timeOff + Math.floor(Math.random() * 15) + 2;
      timeOff    = mins;
      newFwdRec.push({
        name:      npc.nickname || `路人${i+1}`,
        initial:   (npc.nickname || 'N')[0],
        avatarImg: '',
        color:     npc.bg_color || _npcPastel(i),
        caption:   (npc.forward_caption || '').trim(),
        to:        Array.isArray(npc.forward_to) ? npc.forward_to.slice(0, 2) : [],
        time:      mins < 60 ? mins + ' 分钟前' : Math.floor(mins / 60) + ' 小时前',
        isNpc:     true,
        npcTextColor: npc.pastel_text_color || npc.bg_color || _npcPastel(i),
      });
    }
  });

  const viewsAdd = result.views_add || Math.floor(Math.random() * 150) + 50;
  const likesAdd = result.likes_add || Math.floor(Math.random() * 25) + 5;
  const savesAdd = result.saves_add || Math.floor(Math.random() * 8) + 1;

  db.likes           = (db.likes  || 0) + likesAdd;
  db.saves           = (db.saves  || 0) + savesAdd;
  db.shares          = (db.shares || 0) + sharesAdd;
  db.comments_list   = [...(db.comments_list  || []), ...newCmts];
  // NPC 转发记录追加到末尾（好友在前 NPC 在后）
  db.forward_records = [...(db.forward_records || []), ...newFwdRec];
  db.npc_interacted  = true;
  _svSaveDb(db);

  _svAnimateViews(db, viewsAdd);
  return db;
}

// 显示/隐藏 AI 加载层
function _svShowAiLoading(msg) {
  const overlay = document.getElementById('svAiOverlay');
  const label   = document.getElementById('svAiLabel');
  if (!overlay) return;
  if (label) label.textContent = msg || 'AI 生成互动中…';
  overlay.style.display = 'flex';
}
function _svHideAiLoading() {
  const overlay = document.getElementById('svAiOverlay');
  if (overlay) overlay.style.display = 'none';
}

// 自动在发布时触发好友互动（sePublish 调用）
async function svAutoFriendInteract(storyDb) {
  try {
    const audience = storyDb.audience || '所有人';
    let friends = [...friendsData];

    // 仅好友 / 限定好友 / 所有人 都先做好友互动
    if (friends.length === 0) return; // 没好友就跳过，等用户手动触发

    // 限定好友：只取一部分（随机2-3个）
    let targetFriends = friends;
    if (audience === '限定好友') {
      const shuffled = [...friends].sort(() => Math.random() - 0.5);
      targetFriends = shuffled.slice(0, Math.min(3, shuffled.length));
    }

    storyDb = await _svGenerateFriendInteractions(storyDb, targetFriends);

    // 同步 UI（如果 viewer 已打开）
    const viewerPage = document.getElementById('storyViewerPage');
    if (viewerPage && viewerPage.classList.contains('show')) {
      _svRefreshUI(storyDb);
      _svRefreshComments(storyDb);
    }
  } catch(e) {
    console.warn('svAutoFriendInteract error:', e);
  }
}

// 按钮点击：AI 模拟互动
async function svTriggerAI() {
  const btn = document.getElementById('svAiBtn');
  let db = _svGetDb();
  if (!db) { _svShowToast('还没有发布动态哦'); return; }

  const audience = db.audience || '所有人';
  const friends  = [...friendsData];

  btn && btn.classList.add('ai-pulse');
  _svShowAiLoading('AI 思考中…');

  try {
    // Step 1: 确保好友列表存在
    let realFriends = friends;
    if (realFriends.length === 0) {
      _svShowAiLoading('AI 生成好友角色…');
      realFriends = await _svGenerateFriendsList();
    }

    // Step 2: 确保每个好友都参与了
    const alreadyNames = db.friends_interacted_names || [];
    const uninteracted = realFriends.filter(f => !alreadyNames.includes(f.name));

    if (uninteracted.length > 0) {
      _svShowAiLoading(`${uninteracted.length} 位好友互动中…`);
      // 限定好友只用部分
      let targetFriends = uninteracted;
      if (audience === '限定好友') {
        const shuffled = [...uninteracted].sort(() => Math.random() - 0.5);
        targetFriends = shuffled.slice(0, Math.min(3, shuffled.length));
      }
      db = await _svGenerateFriendInteractions(db, targetFriends);
      _svRefreshUI(db);
      _svRefreshComments(db);
    }

    // Step 3: 所有人模式 → 额外生成 NPC 互动
    if (audience === '所有人' && !db.npc_interacted) {
      _svShowAiLoading('陌生人路过中…');
      db = await _svGenerateNPCInteractions(db);
      _svRefreshUI(db);
      _svRefreshComments(db);
    } else if (audience === '所有人' && db.npc_interacted) {
      // 可再次追加NPC（每次点击都新增一波）
      _svShowAiLoading('更多路人经过…');
      db = await _svGenerateNPCInteractions(db);
      _svRefreshUI(db);
      _svRefreshComments(db);
    }

    _svHideAiLoading();
    btn && btn.classList.remove('ai-pulse');
    btn && btn.classList.add('ai-active');
    _svShowToast(audience === '所有人' ? '✦ NPC & 好友互动已生成' : '✦ 好友互动已生成');
  } catch(e) {
    _svHideAiLoading();
    btn && btn.classList.remove('ai-pulse');
    console.error('svTriggerAI error:', e);
    _svShowToast('AI 生成失败：' + (e.message || '未知错误'));
  }
}

// Story Viewer 内 Toast
function _svShowToast(msg) {
  let t = document.getElementById('svInlineToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'svInlineToast';
    t.style.cssText = 'position:absolute;bottom:90px;left:50%;transform:translateX(-50%) translateY(8px);background:rgba(20,20,26,0.88);border:0.5px solid rgba(255,255,255,0.12);border-radius:16px;padding:6px 14px;font-size:10px;color:rgba(255,255,255,0.75);letter-spacing:0.05em;white-space:nowrap;opacity:0;pointer-events:none;z-index:99;transition:all 0.25s ease;font-family:Inter,sans-serif;';
    const svScreen = document.querySelector('.sv-screen');
    if (svScreen) svScreen.appendChild(t);
    else document.getElementById('storyViewerPage')?.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(t._tid);
  t._tid = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(8px)';
  }, 2200);
}

/* ================================================
   身份扇形弹窗 — 读取 LunaIdentityDB
================================================ */
let _ifmIdentities = [];
let _ifmIdx = 0;
let _ifmDragStartX = 0;
let _ifmDragging = false;
const IFM_CARD_W = 280;
const IFM_GAP    = 10;

function _ifmEsc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function _ifmFmtDate(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '.' +
    String(d.getMonth()+1).padStart(2,'0') + '.' +
    String(d.getDate()).padStart(2,'0');
}

async function _ifmLoadIdentities() {
  return new Promise(res => {
    const probe = indexedDB.open('LunaIdentityDB');
    probe.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('identities')) { db.close(); return res([]); }
      const r = db.transaction('identities').objectStore('identities').getAll();
      r.onsuccess = () => res((r.result||[]).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)));
      r.onerror   = () => res([]);
    };
    probe.onerror = () => res([]);
  });
}

function _ifmBuildCard(identity) {
  const initial  = identity.name ? identity.name[0].toUpperCase() : '?';
  const isActive = identity.active !== false;
  const idShort  = String(identity.id).toUpperCase().slice(-6);
  const dateStr  = _ifmFmtDate(identity.createdAt || Date.now());
  const tagsHtml = (identity.tags || []).slice(0,4)
    .map(t => `<span class="ifm-tag">${_ifmEsc(t)}</span>`).join('');

  const avatarInner = identity.avatarImg
    ? `<img src="${_ifmEsc(identity.avatarImg)}" alt=""/>`
    : initial;

  const bgInner = identity.bgImg
    ? `<img class="ifm-bg-img" src="${_ifmEsc(identity.bgImg)}" alt=""/>`
    : identity.avatarImg
      ? `<img class="ifm-bg-img" src="${_ifmEsc(identity.avatarImg)}" alt=""/>`
      : `<div class="ifm-bg-letter">${_ifmEsc(initial)}</div>`;

  return `<div class="ifm-card side" data-id="${_ifmEsc(identity.id)}">
    <div class="ifm-bg" style="background:${_ifmEsc(identity.avatarColor||'#1a1a22')}">
      ${bgInner}
      <div class="ifm-bg-noise"></div>
      <div class="ifm-bg-arc"></div>
    </div>
    <div class="ifm-body">
      <div class="ifm-av-row">
        <div class="ifm-av" style="background:${_ifmEsc(identity.avatarColor||'#1a1a22')}">${avatarInner}</div>
        <div class="ifm-pill">
          <div class="ifm-pill-dot ${isActive?'live':''}"></div>
          <span>${isActive?'LIVE':'OFF'}</span>
        </div>
      </div>
      <div class="ifm-name">${_ifmEsc(identity.name)}</div>
      ${identity.role ? `<div class="ifm-role">${_ifmEsc(identity.role)}</div>` : ''}
      ${identity.desc ? `<div class="ifm-desc">${_ifmEsc(identity.desc)}</div>` : ''}
      ${tagsHtml ? `<div class="ifm-tags">${tagsHtml}</div>` : ''}
      <div class="ifm-stats">
        <div class="ifm-stat-item">
          <div class="ifm-stat-label">Status</div>
          <div class="ifm-stat-val">${isActive?'Active':'Off'}</div>
        </div>
        <div class="ifm-divider"></div>
        <div class="ifm-stat-item">
          <div class="ifm-stat-label">Archive</div>
          <div class="ifm-stat-id">#${idShort}</div>
        </div>
        <div class="ifm-divider"></div>
        <div class="ifm-stat-item">
          <div class="ifm-stat-label">Joined</div>
          <div class="ifm-stat-id">${dateStr}</div>
        </div>
      </div>
      <div class="ifm-actions">
        <button class="ifm-sync-btn" onclick="ifmSyncIdentity('${_ifmEsc(identity.id)}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          同步此身份
        </button>
        <button class="ifm-info-btn" onclick="ifmOpenUser()" aria-label="管理身份">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </button>
      </div>
    </div>
  </div>`;
}

function _ifmBuildEmpty() {
  return `<div class="ifm-card center" style="flex:0 0 280px">
    <div class="ifm-empty">
      <div class="ifm-empty-icon">
        <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="14" width="32" height="22" rx="4" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="18" cy="24" r="4" stroke="currentColor" stroke-width="1.5"/>
          <line x1="26" y1="21" x2="36" y2="21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="26" y1="26" x2="33" y2="26" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="ifm-empty-title">暂无身份档案</div>
      <div class="ifm-empty-sub">请前往「身份管理」创建你的第一个身份，才能在此同步资料</div>
      <button class="ifm-empty-go" onclick="ifmGoToUser()">前往创建</button>
    </div>
  </div>`;
}

function _ifmRenderDots() {
  const el = document.getElementById('ifmDots');
  if (!el) return;
  el.innerHTML = _ifmIdentities.map((_,i) =>
    `<div class="ifm-dot${i===_ifmIdx?' active':''}"></div>`
  ).join('');
}

function _ifmUpdatePos(animate) {
  const row   = document.getElementById('ifmRow');
  const track = document.getElementById('ifmTrack');
  if (!row || !track) return;
  const tw     = track.offsetWidth || 300;
  const offset = (tw/2) - (IFM_CARD_W/2) - _ifmIdx*(IFM_CARD_W+IFM_GAP);
  row.style.transition = animate ? 'transform 0.38s cubic-bezier(0.4,0,0.2,1)' : 'none';
  row.style.transform  = `translateX(${offset}px)`;
  document.querySelectorAll('#ifmRow .ifm-card').forEach((c,i) => {
    c.className = 'ifm-card ' + (i===_ifmIdx?'center':'side');
  });
  const prev = document.getElementById('ifmPrev');
  const next = document.getElementById('ifmNext');
  if (prev) prev.disabled = _ifmIdx === 0;
  if (next) next.disabled = _ifmIdx === _ifmIdentities.length-1;
  _ifmRenderDots();
}

function ifmSlide(dir) {
  const next = _ifmIdx + dir;
  if (next < 0 || next >= _ifmIdentities.length) return;
  _ifmIdx = next;
  _ifmUpdatePos(true);
}

async function openIdentityFanModal() {
  _ifmIdentities = await _ifmLoadIdentities();
  _ifmIdx = 0;

  const row  = document.getElementById('ifmRow');
  const nav  = document.querySelector('.ifm-nav');
  const dots = document.getElementById('ifmDots');

  if (_ifmIdentities.length === 0) {
    row.innerHTML  = _ifmBuildEmpty();
    dots.innerHTML = '';
    if (nav) nav.style.display = 'none';
  } else {
    row.innerHTML = _ifmIdentities.map(_ifmBuildCard).join('');
    if (nav) nav.style.display = 'flex';
    _ifmUpdatePos(false);
    _ifmInitDrag();
  }

  document.getElementById('ifmOverlay').classList.add('active');
  setTimeout(() => document.getElementById('ifmShell').classList.add('active'), 10);
}

function closeIdentityFanModal() {
  document.getElementById('ifmShell').classList.remove('active');
  document.getElementById('ifmOverlay').classList.remove('active');
  // 重置 Follow 按钮为未关注状态
  const btn  = document.getElementById('pfFollowBtn');
  const text = document.getElementById('pfFollowBtnText');
  const dot  = document.getElementById('pfFollowBtnDot');
  if (btn)  btn.style.cssText = '';
  if (text) text.textContent = 'Follow';
  if (dot)  dot.style.background = '';
}


/* ── 资料页持久化 ── */
let _currentProfileId = null; // 当前绑定的 identity id

function saveProfileSnapshot(identity) {
  _currentProfileId = identity.id;
  return new Promise(res => {
    const probe = indexedDB.open('LunaChatProfileDB', 1);
    probe.onupgradeneeded = e => e.target.result.createObjectStore('profile', { keyPath: 'key' });
    probe.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('profile', 'readwrite');
      tx.objectStore('profile').put({
        key:         'current',
        id:          identity.id        || '',
        name:        identity.name      || '',
        role:        identity.role      || '',
        avatarImg:   identity.avatarImg || '',
        avatarColor: identity.avatarColor || '#1a1a22',
        bgImg:       identity.bgImg     || identity.avatarImg || '',
        bio:         identity.bio       || '',
        location:    identity.location  || '',
        website:     identity.website   || '',
        joined:      identity.joined    || '',
        following:   identity.following || '',
        followers:   identity.followers || '',
        posts:       identity.posts     || '',
        likes:       identity.likes     || '',
      });
      tx.oncomplete = () => { db.close(); res(); };
      tx.onerror    = () => { db.close(); res(); };
    };
    probe.onerror = () => res();
  });
}

async function loadProfileSnapshot() {
  return new Promise(res => {
    const probe = indexedDB.open('LunaChatProfileDB', 1);
    probe.onupgradeneeded = e => e.target.result.createObjectStore('profile', { keyPath: 'key' });
    probe.onsuccess = e => {
      const db = e.target.result;
      const r = db.transaction('profile').objectStore('profile').get('current');
      r.onsuccess = () => { db.close(); res(r.result || null); };
      r.onerror   = () => { db.close(); res(null); };
    };
    probe.onerror = () => res(null);
  });
}

function applyProfileSnap(snap) {
  if (!snap) return;
  _currentProfileId = snap.id || null;

  const av = document.getElementById('profileAvatar');
  if (av) {
    av.style.background = snap.avatarColor || '#1a1a22';
    av.style.position = 'relative';
    av.innerHTML = '';
    if (snap.avatarImg && snap.avatarImg.trim() !== '') {
      const img = document.createElement('img');
      img.src = snap.avatarImg;
      img.className = 'ifm-synced-img';
      img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:13px;';
      av.appendChild(img);
    } else {
      const letter = document.createElement('span');
      letter.textContent = (snap.name || '?')[0].toUpperCase();
      av.appendChild(letter);
    }
    const online = document.createElement('div');
    online.className = 'pf-av-online';
    av.appendChild(online);
  }

  const name = document.getElementById('profileName');
  if (name && snap.name) name.textContent = snap.name;

  const handle = document.getElementById('profileHandle');
  if (handle && snap.role) handle.textContent = '@' + snap.role.replace(/\s+/g,'_').toLowerCase().slice(0,16);

  const idTag = document.getElementById('profileIdTag');
  if (idTag && snap.id) idTag.textContent = 'ID · ' + String(snap.id).toUpperCase().slice(-6);

  const cover = document.querySelector('.pf-card-cover');
  if (cover) {
    const existing = cover.querySelector('img.ifm-synced-cover');
    if (snap.bgImg) {
      if (existing) { existing.src = snap.bgImg; }
      else {
        const bgImg = document.createElement('img');
        bgImg.src = snap.bgImg;
        bgImg.className = 'ifm-synced-cover';
        bgImg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.85;';
        cover.insertBefore(bgImg, cover.firstChild);
      }
    } else if (existing) { existing.remove(); }
  }

  const bio = document.getElementById('profileBio');
  if (bio) bio.textContent = snap.bio || '设计师 · 创作者 · 记录日常美好';

  const loc = document.getElementById('profileLocation');
  if (loc) loc.textContent = snap.location || 'Shanghai, CN';

  const web = document.getElementById('profileWebsite');
  if (web) web.textContent = snap.website || 'luna.design';

  const joined = document.getElementById('profileJoined');
  if (joined) joined.textContent = snap.joined || 'Joined Jan 2024';
  const followingEl = document.getElementById('profileFollowing');
  if (followingEl) followingEl.textContent = snap.following || '128';
  const followersEl = document.getElementById('profileFollowers');
  if (followersEl) followersEl.textContent = snap.followers || '364';
  const postsEl = document.getElementById('profilePosts');
  if (postsEl) postsEl.textContent = snap.posts || '42';
  const likesEl = document.getElementById('profileLikes');
  if (likesEl) likesEl.textContent = snap.likes || '1.2k';
}

/* ── 编辑弹窗 ── */
function openProfileEditModal(e) {
  if (e.target.closest('#pfFollowBtn')) return; // 点的是follow按钮不触发
  const overlay = document.getElementById('pfEditOverlay');
  if (!overlay) return;
  // 填入当前值
  document.getElementById('pfEditBio').value       = document.getElementById('profileBio')?.textContent || '';
  document.getElementById('pfEditLocation').value  = document.getElementById('profileLocation')?.textContent || '';
  document.getElementById('pfEditWebsite').value   = document.getElementById('profileWebsite')?.textContent || '';
  document.getElementById('pfEditJoined').value    = document.getElementById('profileJoined')?.textContent || '';
  document.getElementById('pfEditFollowing').value = document.getElementById('profileFollowing')?.textContent || '';
  document.getElementById('pfEditFollowers').value = document.getElementById('profileFollowers')?.textContent || '';
  document.getElementById('pfEditPosts').value     = document.getElementById('profilePosts')?.textContent || '';
  document.getElementById('pfEditLikes').value     = document.getElementById('profileLikes')?.textContent || '';
  overlay.style.display = 'flex';
}

function closePfEditModal() {
  const overlay = document.getElementById('pfEditOverlay');
  if (overlay) overlay.style.display = 'none';
}

async function savePfEditModal() {
  const bio       = document.getElementById('pfEditBio').value.trim();
  const loc       = document.getElementById('pfEditLocation').value.trim();
  const web       = document.getElementById('pfEditWebsite').value.trim();
  const joined    = document.getElementById('pfEditJoined').value.trim();
  const following = document.getElementById('pfEditFollowing').value.trim();
  const followers = document.getElementById('pfEditFollowers').value.trim();
  const posts     = document.getElementById('pfEditPosts').value.trim();
  const likes     = document.getElementById('pfEditLikes').value.trim();

  // 更新 DOM
  const bioEl = document.getElementById('profileBio');
  if (bioEl) bioEl.textContent = bio;
  const locEl = document.getElementById('profileLocation');
  if (locEl) locEl.textContent = loc;
  const webEl = document.getElementById('profileWebsite');
  if (webEl) webEl.textContent = web;
  const joinEl = document.getElementById('profileJoined');
  if (joinEl) joinEl.textContent = joined;
  const followingEl = document.getElementById('profileFollowing');
  if (followingEl && following) followingEl.textContent = following;
  const followersEl = document.getElementById('profileFollowers');
  if (followersEl && followers) followersEl.textContent = followers;
  const postsEl = document.getElementById('profilePosts');
  if (postsEl && posts) postsEl.textContent = posts;
  const likesEl = document.getElementById('profileLikes');
  if (likesEl && likes) likesEl.textContent = likes;

  // 更新 ProfileDB
  const snap = await loadProfileSnapshot();
  if (snap) {
    snap.bio = bio; snap.location = loc; snap.website = web; snap.joined = joined;
    snap.following = following; snap.followers = followers; snap.posts = posts; snap.likes = likes;
    await saveProfileSnapshot(snap);
  }

  // 同步写回 identity DB
  if (_currentProfileId) {
    const probe = indexedDB.open('LunaIdentityDB');
    probe.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('identities')) { db.close(); return; }
      const tx = db.transaction('identities', 'readwrite');
      const store = tx.objectStore('identities');
      const req = store.get(_currentProfileId);
      req.onsuccess = () => {
        const identity = req.result;
        if (!identity) { db.close(); return; }
        identity.bio = bio; identity.location = loc; identity.website = web; identity.joined = joined;identity.following = following; identity.followers = followers;
        identity.posts = posts; identity.likes = likes;
        store.put(identity);
        tx.oncomplete = () => db.close();
      };
    };
  }

  closePfEditModal();
}

function ifmSyncIdentity(id) {
  const identity = _ifmIdentities.find(i => String(i.id) === String(id));
  if (!identity) return;

  // 同步头像
  const av = document.getElementById('profileAvatar');
  if (av) {
    av.style.background = identity.avatarColor || '#1a1a22';
    av.style.position = 'relative';
    av.innerHTML = '';
    if (identity.avatarImg) {
      const img = document.createElement('img');
      img.src = identity.avatarImg;
      img.className = 'ifm-synced-img';
      img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:13px;';
      av.appendChild(img);
    } else {
      const letter = document.createElement('span');
      letter.textContent = (identity.name || '?')[0].toUpperCase();
      av.appendChild(letter);
    }
    const online = document.createElement('div');
    online.className = 'pf-av-online';
    av.appendChild(online);
  }

  // 同步名字
  const name = document.getElementById('profileName');
  if (name) name.textContent = identity.name || 'Luna User';

  // 同步handle
  const handle = document.getElementById('profileHandle');
  if (handle && identity.role) handle.textContent = '@' + identity.role.replace(/\s+/g,'_').toLowerCase().slice(0,16);

  // 同步背景封面
  const cover = document.querySelector('.pf-card-cover');
  if (cover) {
    const bgSrc = identity.bgImg || identity.avatarImg;
    const existingBgImg = cover.querySelector('img.ifm-synced-cover');
    if (bgSrc) {
      if (existingBgImg) {
        existingBgImg.src = bgSrc;
      } else {
        const bgImg = document.createElement('img');
        bgImg.src = bgSrc;
        bgImg.className = 'ifm-synced-cover';
        bgImg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.85;';
        cover.insertBefore(bgImg, cover.firstChild);
      }
    } else {
      if (existingBgImg) existingBgImg.remove();
    }
  }

  // Follow 按钮变为已关注态
  const fbtn  = document.getElementById('pfFollowBtn');
  const ftext = document.getElementById('pfFollowBtnText');
  const fdot  = document.getElementById('pfFollowBtnDot');
  if (fbtn)  { fbtn.style.background='#e8e8ec'; fbtn.style.color='#0a0a0a'; }
  if (ftext) ftext.textContent = 'Following';
  if (fdot)  fdot.style.background = 'rgba(0,0,0,0.22)';

  saveProfileSnapshot(identity);
  saveProfileSnapshot(identity).then(() => {
    applyProfileSnap({
      id: identity.id, name: identity.name, role: identity.role,
      avatarImg: identity.avatarImg, avatarColor: identity.avatarColor,
      bgImg: identity.bgImg || identity.avatarImg,
      bio: identity.bio || '', location: identity.location || '',
      website: identity.website || '', joined: identity.joined || '',
    });
    // 同步完后立即刷新故事环头像
    renderFriendStories();
    renderStoryRing();
  });
  ifmShowToast('已同步：' + identity.name);
  setTimeout(closeIdentityFanModal, 1200);
}

function ifmShowToast(msg) {
  const t = document.getElementById('ifmToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window._ifmToastTimer);
  window._ifmToastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

function _ifmInitDrag() {
  const row = document.getElementById('ifmRow');
  if (!row || row._ifmDragBound) return;
  row._ifmDragBound = true;
  row.addEventListener('mousedown', e => { _ifmDragStartX = e.clientX; _ifmDragging = true; });
  row.addEventListener('mouseup',   e => {
    if (!_ifmDragging) return; _ifmDragging = false;
    const dx = e.clientX - _ifmDragStartX;
    if (Math.abs(dx) > 40) ifmSlide(dx < 0 ? 1 : -1);
  });
  row.addEventListener('mouseleave', () => { _ifmDragging = false; });
  row.addEventListener('touchstart', e => { _ifmDragStartX = e.touches[0].clientX; }, { passive: true });
  row.addEventListener('touchend',   e => {
    const dx = e.changedTouches[0].clientX - _ifmDragStartX;
    if (Math.abs(dx) > 40) ifmSlide(dx < 0 ? 1 : -1);
  });
}

function ifmGoToUser() {
  localStorage.setItem('luna_return_to', 'chat_profile');
  const mask = document.createElement('div');
  mask.style.cssText = 'position:fixed;inset:0;background:rgba(238,241,255,0.97);opacity:0;z-index:9999;transition:opacity 0.28s ease;pointer-events:all;';
  document.body.appendChild(mask);
  requestAnimationFrame(() => { mask.style.opacity = '1'; });
  setTimeout(() => { window.location.href = 'user.html'; }, 260);
}

function ifmOpenUser() {
  localStorage.setItem('luna_return_to', 'chat_profile');
  const mask = document.createElement('div');
  mask.style.cssText = 'position:fixed;inset:0;background:rgba(238,241,255,0.97);opacity:0;z-index:9999;transition:opacity 0.28s ease;pointer-events:all;';
  document.body.appendChild(mask);
  requestAnimationFrame(() => { mask.style.opacity = '1'; });
  setTimeout(() => { window.location.href = 'user.html'; }, 260);
}