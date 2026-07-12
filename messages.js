/* ================================
   Messages App — messages.js
   同步身份库(LunaIdentityDB)与角色库(LunaCharDB)
================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ================================================
     工具
  ================================================ */
  function escHtml(str) {
    return String(str || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  const DEFAULT_PERSON_SVG = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="#f4f4f6" stroke-width="1.6"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#f4f4f6" stroke-width="1.6" stroke-linecap="round"/>
    </svg>`;

  const CHECK_SVG = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20,6 9,17 4,12"/>
    </svg>`;

  /* ================================================
     状态栏时间 / 电量 / 灵动岛 — 同步 index / user / characters
  ================================================ */
  function updateStatusTime() {
    const tz  = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
    const now = new Date();
    const s   = now.toLocaleTimeString('zh-CN', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
    });
    document.querySelectorAll('.status-time').forEach(el => el.textContent = s);
  }

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

  window.addEventListener('storage', e => {
    if (e.key === 'luna_island_update') applyIsland();
    if (e.key === 'luna_tz_update')     updateStatusTime();
  });

  updateStatusTime();
  setInterval(updateStatusTime, 30000);
  updateBattery();
  applyIsland();

  /* ================================================
     IndexedDB — 身份库（与 user.js 共用 LunaIdentityDB）
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
    if (!db || !db.objectStoreNames.contains('identities')) return [];
    return new Promise(res => {
      const r = db.transaction('identities').objectStore('identities').getAll();
      r.onsuccess = () => res((r.result || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      r.onerror   = () => res([]);
    });
  }

  /* ================================================
     IndexedDB — 角色库（与 characters.js 共用 LunaCharDB）
  ================================================ */
  let _charDB = null;
  function openCharDB() {
    if (_charDB) return Promise.resolve(_charDB);
    return new Promise((res, rej) => {
      const probe = indexedDB.open('LunaCharDB');
      probe.onsuccess = e => {
        const cur = e.target.result;
        const ver = cur.version;
        const hasChars = cur.objectStoreNames.contains('chars');
        cur.close();
        if (hasChars) {
          const req2 = indexedDB.open('LunaCharDB', ver);
          req2.onsuccess = e2 => { _charDB = e2.target.result; res(_charDB); };
          req2.onerror   = e2 => rej(e2.target.error);
        } else {
          const req3 = indexedDB.open('LunaCharDB', ver + 1);
          req3.onupgradeneeded = e3 => {
            const db3 = e3.target.result;
            if (!db3.objectStoreNames.contains('chars'))
              db3.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
          };
          req3.onsuccess = e3 => { _charDB = e3.target.result; res(_charDB); };
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

  async function getAllChars() {
    const db = await openCharDB().catch(() => null);
    if (!db) return [];
    return new Promise(res => {
      const r = db.transaction('chars', 'readonly').objectStore('chars').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror   = () => res([]);
    });
  }

  /* ================================================
     全局状态
  ================================================ */
  let identities = [];
  let chars      = [];

  function getActiveIdentity() {
    const savedId = localStorage.getItem('luna_active_identity');
    if (savedId) {
      const found = identities.find(i => String(i.id) === String(savedId));
      if (found) return found;
    }
    return identities[0] || null;
  }

  function setActiveIdentity(id) {
    localStorage.setItem('luna_active_identity', id);
  }

  /* ================================================
     渲染：顶部账户区 + 面板头部
  ================================================ */
  function renderAccountDisplays(identity) {
    const nameEl    = document.getElementById('accountNameDisplay');
    const subEl     = document.getElementById('accountSubDisplay');
    const avatarEl  = document.getElementById('topbarAvatar');
    const panelName = document.getElementById('panelNameDisplay');
    const panelId   = document.getElementById('panelIdDisplay');
    const panelAv   = document.getElementById('panelAvatarBig');

    if (!identity) {
      nameEl.textContent = '未设置身份';
      subEl.textContent  = '点击创建你的登录身份';
      avatarEl.innerHTML = DEFAULT_PERSON_SVG;
      panelName.textContent = '未设置身份';
      panelId.textContent   = 'ID · 未同步';
      panelAv.innerHTML     = DEFAULT_PERSON_SVG;
      return;
    }

    const letter = (identity.name || '?')[0].toUpperCase();
    const avatarInner = identity.avatarImg
      ? `<img src="${identity.avatarImg}" alt=""/>`
      : `<span class="avatar-letter">${letter}</span>`;

    nameEl.textContent = identity.name || '未命名';
    subEl.textContent  = '在线 · iCloud 已同步';
    avatarEl.innerHTML = avatarInner;

    panelName.textContent = identity.name || '未命名';
    panelId.textContent   = `ID · #${String(identity.id).slice(-6).toUpperCase()}`;
    panelAv.innerHTML     = avatarInner;
  }

  /* ================================================
     渲染：身份切换列表（账户面板核心功能）
  ================================================ */
  function renderIdentityList() {
    const container = document.getElementById('identityList');
    if (identities.length === 0) {
      container.innerHTML = `
        <div class="identity-empty">
          还没有创建任何身份<br>前往「我的」页面创建第一个登录身份吧
          <button class="empty-action-btn" id="btnGoCreateIdentity">去创建身份</button>
        </div>`;
      const btn = document.getElementById('btnGoCreateIdentity');
      if (btn) btn.addEventListener('click', () => { window.location.href = 'user.html'; });
      return;
    }

    const active = getActiveIdentity();

    container.innerHTML = identities.map(idn => {
      const isActive = active && String(idn.id) === String(active.id);
      const letter = (idn.name || '?')[0].toUpperCase();
      const avatarInner = idn.avatarImg
        ? `<img src="${idn.avatarImg}" alt=""/>`
        : letter;
      return `
        <button class="identity-row${isActive ? ' is-active' : ''}" data-id="${escHtml(idn.id)}">
          <div class="identity-avatar">${avatarInner}</div>
          <div class="identity-meta">
            <span class="identity-name">${escHtml(idn.name || '未命名')}</span>
            <span class="identity-role">${escHtml(idn.role || '身份')}</span>
          </div>
          <div class="identity-check">${isActive ? CHECK_SVG : ''}</div>
        </button>`;
    }).join('');

    container.querySelectorAll('.identity-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.dataset.id;
        setActiveIdentity(id);
        const chosen = identities.find(i => String(i.id) === String(id));
        renderAccountDisplays(chosen);
        renderIdentityList();
        closeAccountPanel();
      });
    });
  }

  /* ================================================
     渲染：好友列表（同步角色库头像 / 名称）
     — 陌生人分组保持匿名，不做同步
  ================================================ */
  const TONE_CLASSES = ['tone-1', 'tone-2', 'tone-3', 'tone-4'];

  function renderFriendThreads() {
    const container = document.getElementById('friendsThreadContainer');
    const label = document.getElementById('friendsSectionLabel');

    if (chars.length === 0) {
      label.style.display = 'block';
      container.innerHTML = `
        <div class="friends-empty">
          <div class="friends-empty-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke-linecap="round"/></svg>
          </div>
          还没有添加任何角色<br>前往「人设」页面创建你的第一个角色吧
          <button class="empty-action-btn" id="btnGoCreateChar">去创建角色</button>
        </div>`;
      const btn = document.getElementById('btnGoCreateChar');
      if (btn) btn.addEventListener('click', () => { window.location.href = 'characters.html'; });
      return;
    }

    label.style.display = 'block';
    const activeCharId = parseInt(localStorage.getItem('luna_active_char')) || null;

    container.innerHTML = chars.map((c, idx) => {
      const tone = TONE_CLASSES[idx % TONE_CLASSES.length];
      const isOnline = activeCharId && c.id === activeCharId;
      const avatarInner = c.avatar
        ? `<img src="${c.avatar}" alt=""/>`
        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="#fff" stroke-width="1.6"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>`;

      // 有真实聊天记录时展示最近一条消息预览与时间，否则保持"暂无消息"的空态提示
      const log = _tdReadLog(c.id);
      const last = log.length ? log[log.length - 1] : null;
      const preview = last ? (last.dir === 'out' ? '我：' + last.text : last.text) : '暂无消息';
      const time    = last ? _sysFormatTime(last.time) : '';
      const unread  = false; // 用户自己发出/查看的对话，进入过详情页即视为已读

      return `
        <div class="thread-item${unread ? ' unread' : ''}" data-cat="friends" data-unread="${unread}" data-char-id="${c.id}" style="animation-delay:${(idx * 0.05).toFixed(2)}s">
          <div class="thread-avatar ${c.avatar ? 'has-img' : tone}">
            ${avatarInner}
            ${isOnline ? '<span class="presence-dot"></span>' : ''}
          </div>
          <div class="thread-body">
            <div class="thread-row-top">
              <span class="thread-name">${escHtml(c.name || '未命名')}</span>
              <span class="thread-time">${time}</span>
            </div>
            <div class="thread-row-bottom">
              <span class="thread-preview${last ? '' : ' is-empty'}">${escHtml(preview)}</span>
              ${unread ? '<span class="unread-dot"></span>' : ''}
            </div>
          </div>
        </div>`;
    }).join('');

    bindThreadClickToRead();
    bindThreadOpenChat();
  }

  function renderSubtitle() {
    const el = document.getElementById('msgSubtitleText');
    if (!el) return;
    el.textContent = chars.length > 0
      ? `与 ${chars.length} 位角色保持联系`
      : '还没有联系人，先去创建一个角色吧';
  }

  /* ================================================
     分类筛选（对动态生成的好友项同样生效）
  ================================================ */
  function applyFilter(filter) {
    document.querySelectorAll('.thread-item').forEach(item => {
      const cat = item.dataset.cat;
      const isUnread = item.dataset.unread === 'true';
      let show = true;
      if (filter === 'unread') show = isUnread;
      else if (filter === 'friends') show = cat === 'friends';
      else if (filter === 'strangers') show = cat === 'strangers';
      else if (filter === 'system') show = cat === 'system';
      item.style.display = show ? 'flex' : 'none';
    });

    document.querySelectorAll('.section-empty').forEach(card => {
      const cat = card.closest('.thread-container').dataset.cat;
      // 未读筛选下，空分组必定没有未读，直接隐藏空状态卡片
      const show = filter === 'all' || filter === cat;
      card.style.display = show ? 'flex' : 'none';
    });

    document.querySelectorAll('.section-label').forEach(label => {
      const next = label.nextElementSibling;
      let hasVisible = false;
      if (next && next.classList && next.classList.contains('thread-container')) {
        hasVisible = Array.from(next.children).some(el => el.style.display !== 'none');
      }
      label.style.display = hasVisible ? 'block' : 'none';
    });
  }

  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      applyFilter(chip.dataset.filter);
    });
  });

  /* ---------- 已读标记：点击会话项后转为已读 ---------- */
  function bindThreadClickToRead() {
    document.querySelectorAll('.thread-item').forEach(item => {
      if (item.dataset.bound === 'true') return;
      item.dataset.bound = 'true';
      item.addEventListener('click', () => {
        if (item.dataset.unread === 'true') {
          item.dataset.unread = 'false';
          item.classList.remove('unread');
          const dot = item.querySelector('.unread-dot');
          if (dot) dot.remove();
          updateUnreadCount();
        }
      });
    });
  }

  function updateUnreadCount() {
    const unreadCountEl = document.getElementById('countUnread');
    if (!unreadCountEl) return;
    const remaining = document.querySelectorAll('.thread-item[data-unread="true"]').length;
    unreadCountEl.textContent = remaining;
    unreadCountEl.style.display = remaining === 0 ? 'none' : '';
  }

  /* ---------- 账户面板（仅身份切换） ---------- */
  const accountChip      = document.getElementById('accountChip');
  const accountPanel     = document.getElementById('accountPanel');
  const accountScrim     = document.getElementById('accountScrim');
  const btnCloseAccount  = document.getElementById('btnCloseAccount');
  const btnManageIdentity = document.getElementById('btnManageIdentity');

  function openAccountPanel() {
    renderIdentityList();
    accountPanel.style.display = 'block';
    requestAnimationFrame(() => accountPanel.classList.add('is-open'));
  }
  function closeAccountPanel() {
    accountPanel.classList.remove('is-open');
    setTimeout(() => { accountPanel.style.display = 'none'; }, 320);
  }

  accountChip.addEventListener('click', openAccountPanel);
  accountScrim.addEventListener('click', closeAccountPanel);
  btnCloseAccount.addEventListener('click', closeAccountPanel);
  btnManageIdentity.addEventListener('click', () => { window.location.href = 'user.html'; });

  /* ---------- 新建信息面板 ---------- */
  const composePanel     = document.getElementById('composePanel');
  const btnEdit           = document.getElementById('btnEdit');
  const btnComposeMini    = document.getElementById('btnComposeMini');
  const fabCompose        = document.getElementById('fabCompose');
  const btnComposeCancel  = document.getElementById('btnComposeCancel');
  const composeToInput    = document.getElementById('composeToInput');
  const btnSend           = document.getElementById('btnSend');

  function openComposePanel() {
    composePanel.classList.add('is-open');
    setTimeout(() => composeToInput.focus(), 320);
  }
  function closeComposePanel() {
    composePanel.classList.remove('is-open');
    composeToInput.value = '';
    btnSend.disabled = true;
    btnSend.classList.remove('is-ready');
  }

  btnEdit.addEventListener('click', openComposePanel);
  fabCompose.addEventListener('click', openComposePanel);
  btnComposeCancel.addEventListener('click', closeComposePanel);

  composeToInput.addEventListener('input', () => {
    const hasValue = composeToInput.value.trim().length > 0;
    btnSend.disabled = !hasValue;
    btnSend.classList.toggle('is-ready', hasValue);
  });

  btnSend.addEventListener('click', () => {
    if (btnSend.disabled) return;
    closeComposePanel();
  });

  /* ---------- 返回按钮：回到桌面 index.html ---------- */
  btnComposeMini.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  /* ================================================
     聊天详情页（仿 iMessage · 黑白灰韩系高级风）
     消息记录以 localStorage 按角色 id 存储，key: luna_chat_msgs_<charId>
     这样「信息」列表页的最近预览也能读取到真实对话内容。
  ================================================ */
  let _tdCurrentChar = null; // 当前打开的聊天对象（角色对象）

  function _tdLogKey(charId) {
    return 'luna_chat_msgs_' + charId;
  }

  function _tdReadLog(charId) {
    try {
      const raw = localStorage.getItem(_tdLogKey(charId));
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function _tdWriteLog(charId, list) {
    localStorage.setItem(_tdLogKey(charId), JSON.stringify(list));
  }

  function _tdAppendMsg(charId, dir, text) {
    const list = _tdReadLog(charId);
    list.push({ dir, text, time: Date.now() });
    _tdWriteLog(charId, list);
    return list;
  }

  const viewThread    = document.getElementById('viewThread');
  const btnThreadBack = document.getElementById('btnThreadBack');
  const threadAvatar  = document.getElementById('threadAvatar');
  const threadName    = document.getElementById('threadName');
  const threadMessages   = document.getElementById('threadMessages');
  const threadEmptyState = document.getElementById('threadEmptyState');
  const threadInputField = document.getElementById('threadInputField');
  const btnThreadSend     = document.getElementById('btnThreadSend');
  const btnThreadAI       = document.getElementById('btnThreadAI');
  const threadMsgScroll   = document.getElementById('threadMsgScroll');

  function _tdFormatDateLabel(ts) {
    const d = new Date(ts);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return '今天';
    return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
  }

  function renderThreadMessages(charId) {
    const log = _tdReadLog(charId);

    if (log.length === 0) {
      threadMessages.innerHTML = '';
      threadEmptyState.style.display = 'flex';
      return;
    }
    threadEmptyState.style.display = 'none';

    let html = '';
    let lastDateLabel = null;
    log.forEach(m => {
      const dateLabel = _tdFormatDateLabel(m.time);
      if (dateLabel !== lastDateLabel) {
        html += `
          <div class="td-date-divider">
            <span class="td-meta-line"></span>
            <span>${dateLabel}</span>
            <span class="td-meta-line"></span>
          </div>`;
        lastDateLabel = dateLabel;
      }
      const timeStr = new Date(m.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
      html += `
        <div class="td-bubble-row ${m.dir}">
          <div class="td-bubble">${escHtml(m.text)}</div>
          <span class="td-bubble-time">${timeStr}</span>
        </div>`;
    });
    threadMessages.innerHTML = html;
  }

  function scrollThreadToBottom(smooth) {
    requestAnimationFrame(() => {
      threadMsgScroll.scrollTo({ top: threadMsgScroll.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    });
  }

  function openThread(charId) {
    const c = chars.find(ch => ch.id === charId);
    if (!c) return;
    _tdCurrentChar = c;

    threadName.textContent = c.name || '未命名';
    threadAvatar.innerHTML = c.avatar
      ? `<img src="${c.avatar}" alt=""/>`
      : `<span>${(c.name || '?')[0].toUpperCase()}</span>`;

    renderThreadMessages(charId);
    viewThread.classList.add('is-open');
    scrollThreadToBottom(false);
  }

  function closeThread() {
    viewThread.classList.remove('is-open');
    _tdCurrentChar = null;
    // 返回列表时刷新预览（可能已发送新消息）
    renderFriendThreads();
  }

  function bindThreadOpenChat() {
    document.querySelectorAll('.thread-item[data-char-id]').forEach(item => {
      if (item.dataset.chatBound === 'true') return;
      item.dataset.chatBound = 'true';
      item.addEventListener('click', () => {
        const charId = parseInt(item.dataset.charId);
        openThread(charId);
      });
    });
  }

  btnThreadBack.addEventListener('click', closeThread);

  threadInputField.addEventListener('input', () => {
    const hasValue = threadInputField.value.trim().length > 0;
    btnThreadSend.disabled = !hasValue;
    btnThreadSend.classList.toggle('is-ready', hasValue);
    // 自适应高度（多行输入）
    threadInputField.style.height = 'auto';
    threadInputField.style.height = Math.min(threadInputField.scrollHeight, 90) + 'px';
  });

  function sendThreadMessage() {
    const text = threadInputField.value.trim();
    if (!text || !_tdCurrentChar) return;
    _tdAppendMsg(_tdCurrentChar.id, 'out', text);
    threadInputField.value = '';
    threadInputField.style.height = 'auto';
    btnThreadSend.disabled = true;
    btnThreadSend.classList.remove('is-ready');
    renderThreadMessages(_tdCurrentChar.id);
    scrollThreadToBottom(true);
  }

  btnThreadSend.addEventListener('click', () => {
    if (btnThreadSend.disabled) return;
    sendThreadMessage();
  });

  threadInputField.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!btnThreadSend.disabled) sendThreadMessage();
    }
  });

  /* ---------- AI 回复按钮：占位交互，暂未接入实际能力 ---------- */
  btnThreadAI.addEventListener('click', () => {
    btnThreadAI.style.transform = 'scale(0.88)';
    setTimeout(() => { btnThreadAI.style.transform = ''; }, 140);
  });

  /* ================================================
     初始化
  ================================================ */
  function renderEmptySection(containerId, labelId, icon, text) {
    const container = document.getElementById(containerId);
    const label = document.getElementById(labelId);
    if (!container) return;
    container.innerHTML = `
      <div class="section-empty">
        <div class="section-empty-icon">${icon}</div>
        <span>${escHtml(text)}</span>
      </div>`;
    if (label) label.style.display = 'block';
  }

  const STRANGER_EMPTY_SVG = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke-linecap="round"/></svg>`;
  const SYSTEM_EMPTY_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v5" stroke-linecap="round"/><circle cx="12" cy="16" r="0.8" fill="currentColor" stroke="none"/></svg>`;
  const SYSTEM_ITEM_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v5" stroke-linecap="round"/><circle cx="12" cy="16" r="0.8" fill="#fff" stroke="none"/></svg>`;

  /* ================================================
     渲染：系统分组（来自 luna-system-messages.js 共享的真实系统通知，
     例如钱包 App 办卡成功后同步过来的提醒）
     — 暂无数据时保留原有带图标的空状态卡片，不编造内容
  ================================================ */
  function _sysFormatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay
      ? d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
      : d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
  }

  function renderSystemThreads() {
    const container = document.getElementById('systemThreadContainer');
    const label = document.getElementById('systemSectionLabel');
    if (!container) return;

    const list = (window.LunaSystemMessages && window.LunaSystemMessages.getAll()) || [];

    if (list.length === 0) {
      renderEmptySection('systemThreadContainer', 'systemSectionLabel', SYSTEM_EMPTY_SVG, '暂无系统通知');
      return;
    }

    label.style.display = 'block';
    container.innerHTML = list.map((m, idx) => {
      const unread = !m.read;
      const preview = m.message || '';
      return `
        <div class="thread-item${unread ? ' unread' : ''}" data-cat="system" data-unread="${unread}" data-sysmsg-id="${escHtml(m.id)}" style="animation-delay:${(idx * 0.05).toFixed(2)}s">
          <div class="thread-avatar tone-2">
            ${SYSTEM_ITEM_SVG}
          </div>
          <div class="thread-body">
            <div class="thread-row-top">
              <span class="thread-name">${escHtml(m.title || m.app || '系统通知')}</span>
              <span class="thread-time">${_sysFormatTime(m.time)}</span>
            </div>
            <div class="thread-row-bottom">
              <span class="thread-preview">${escHtml(preview)}</span>
              ${unread ? '<span class="unread-dot"></span>' : ''}
            </div>
          </div>
        </div>`;
    }).join('');

    // 点击系统消息 → 打开独立的「系统通知详情页」，并标记为已读（同步回共享存储）
    container.querySelectorAll('.thread-item[data-sysmsg-id]').forEach(item => {
      if (item.dataset.bound === 'true') return;
      item.dataset.bound = 'true';
      item.addEventListener('click', () => {
        const id = item.dataset.sysmsgId;
        const msg = list.find(m => m.id === id);

        if (window.LunaSystemMessages) window.LunaSystemMessages.markRead(id);
        if (item.dataset.unread === 'true') {
          item.dataset.unread = 'false';
          item.classList.remove('unread');
          const dot = item.querySelector('.unread-dot');
          if (dot) dot.remove();
          updateUnreadCount();
        }

        if (msg) openSystemDetail(msg);
      });
    });
  }

  /* ---------- 系统通知详情页：独立视图，与角色聊天页样式区分 ---------- */
  const viewSystemDetail = document.getElementById('viewSystemDetail');
  const btnSysBack   = document.getElementById('btnSysBack');
  const sdCardApp     = document.getElementById('sdCardApp');
  const sdCardTitle   = document.getElementById('sdCardTitle');
  const sdCardMessage = document.getElementById('sdCardMessage');
  const sdCardTime    = document.getElementById('sdCardTime');

  function _sdFormatFullTime(ts) {
    const d = new Date(ts);
    return d.toLocaleString('zh-CN', {
      month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
  }

  function openSystemDetail(msg) {
    sdCardApp.textContent     = msg.app || '系统';
    sdCardTitle.textContent   = msg.title || '系统通知';
    sdCardMessage.textContent = msg.message || '';
    sdCardTime.textContent    = _sdFormatFullTime(msg.time);
    viewSystemDetail.classList.add('is-open');
  }

  function closeSystemDetail() {
    viewSystemDetail.classList.remove('is-open');
  }

  btnSysBack.addEventListener('click', closeSystemDetail);

  async function init() {
    [identities, chars] = await Promise.all([
      loadIdentitiesFromDB(),
      getAllChars()
    ]);

    renderAccountDisplays(getActiveIdentity());
    renderFriendThreads();
    renderSubtitle();
    // 陌生人分组默认没有真实数据，用带图标的空状态卡片区分类别，而非编造内容
    renderEmptySection('strangersThreadContainer', 'strangersSectionLabel', STRANGER_EMPTY_SVG, '暂无陌生人消息');
    // 系统分组：读取真实的跨 App 系统消息（例如钱包办卡成功通知），没有数据时才回退到空状态
    renderSystemThreads();
    bindThreadClickToRead();
    updateUnreadCount();
    applyFilter(document.querySelector('.filter-chip.is-active')?.dataset.filter || 'all');
  }

  // 其他 App（例如钱包）写入新系统消息后，通过 storage 事件实时同步刷新本页
  window.addEventListener('storage', e => {
    if (e.key === 'luna_system_messages_update') {
      renderSystemThreads();
      updateUnreadCount();
      applyFilter(document.querySelector('.filter-chip.is-active')?.dataset.filter || 'all');
    }
  });

  init();

});