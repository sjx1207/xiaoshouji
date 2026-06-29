/* ================================
   GroupChat — groupchat.js
   Syncs group data from chat.js via
   localStorage + IndexedDB (LunaChatDB)
================================ */

/* ---- Status bar: real-time clock ---- */
function updateTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeStr = new Date().toLocaleTimeString('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const el = document.getElementById('statusTime');
  if (el) el.textContent = timeStr;
}

/* ---- Status bar: battery ---- */
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

/* ---- Dynamic Island — 1:1 from chat.js ---- */
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

window.addEventListener('storage', e => {
  if (e.key === 'luna_island_update') applyIsland();
  if (e.key === 'luna_tz_update')     { updateTime(); renderDateChip(); }
});

/* ---- Typing indicator ---- */
let _typingInterval = null;
let _typingTimer    = null;
let _typingDotIdx   = 0;

function startTyping(name, initial, avatar) {
  const row = document.getElementById('typingRow');
  const av  = document.getElementById('typingAvatar');
  const lbl = document.getElementById('typingName');
  if (row) row.style.display = 'flex';
  if (av) {
    if (avatar) {
      av.style.padding = '0';
      av.style.overflow = 'hidden';
      av.innerHTML = `<img src="${avatar}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:9px;display:block;" onerror="this.parentElement.style.padding='';this.remove();" />`;
    } else {
      av.style.padding = '';
      av.style.overflow = '';
      av.textContent = initial || (name[0] || '?').toUpperCase();
    }
  }
  if (lbl) lbl.textContent   = name.toUpperCase() + ' · TYPING';

  clearInterval(_typingInterval);
  const dots = ['td1','td2','td3'].map(id => document.getElementById(id));
  _typingDotIdx = 0;
  _typingInterval = setInterval(() => {
    dots.forEach((d, i) => {
      if (d) d.style.background = i === _typingDotIdx % 3 ? '#999' : '#e0e0e0';
    });
    _typingDotIdx++;
  }, 420);
}

function stopTyping() {
  const row = document.getElementById('typingRow');
  if (row) row.style.display = 'none';
  clearInterval(_typingInterval);
}

/* ---- Message store (always starts empty) ---- */
let _messages = [];
let _nextId   = 100;
let _groupData = null;

/* ================================================================
   IndexedDB: open LunaChatDB (read-only, no version bump needed)
   We only need to read; we never write from groupchat page.
================================================================ */
function openGroupsDB() {
  return new Promise((res) => {
    const probe = indexedDB.open('LunaChatDB');
    probe.onsuccess = e => {
      const db  = e.target.result;
      const ver = db.version;
      const hasGroups = db.objectStoreNames.contains('groups');
      db.close();
      if (!hasGroups) { res(null); return; }
      /* re-open at same version, no upgrade */
      const reopen = indexedDB.open('LunaChatDB', ver);
      reopen.onsuccess = e2 => res(e2.target.result);
      reopen.onerror   = () => res(null);
    };
    probe.onerror = () => res(null);
  });
}

/*
  chat.js stores:
    groupRecord.id       = 'grp_' + Date.now()   ← DB primary key (keyPath:'id')
    groupRecord.groupId  = user-set group number  ← e.g. "3502748"
    groupRecord.name     = group display name     ← e.g. "家族群"

  openGroupChat() writes to localStorage:
    luna_current_group_name  = groupRecord.name
    luna_current_group_id    = groupRecord.groupId   ← NOT the DB primary key!

  So we must getAll() and match by .groupId field (and name as fallback).
*/
async function loadGroupRecord() {
  const lsName    = localStorage.getItem('luna_current_group_name') || '';
  const lsGroupId = localStorage.getItem('luna_current_group_id')   || '';

  const db = await openGroupsDB();
  if (!db) return null;

  return new Promise(res => {
    try {
      const tx    = db.transaction('groups', 'readonly');
      const store = tx.objectStore('groups');
      const req   = store.getAll();

      req.onsuccess = () => {
        const all = req.result || [];
        db.close();

        /* Priority 1: match by groupId field + name */
        let found = all.find(g =>
          String(g.groupId) === String(lsGroupId) && g.name === lsName
        );
        /* Priority 2: groupId field only */
        if (!found && lsGroupId) {
          found = all.find(g => String(g.groupId) === String(lsGroupId));
        }
        /* Priority 3: name only */
        if (!found && lsName) {
          found = all.find(g => g.name === lsName);
        }

        res(found || null);
      };
      req.onerror = () => { db.close(); res(null); };
    } catch(e) { res(null); }
  });
}

/* ---- Populate header from group record ---- */
function applyGroupHeader(group) {
  const lsName    = localStorage.getItem('luna_current_group_name') || 'GROUP';
  const lsGroupId = localStorage.getItem('luna_current_group_id')   || '';

  const name     = group?.name     || lsName;
  const members  = group?.members  || [];
  /* count = members + 自己(1)，与 chat.js 创建时一致 */
  const count    = group?.count    != null
    ? group.count
    : (members.length > 0 ? members.length + 1 : null);
  const groupId  = group?.groupId  || lsGroupId;

  /* ── Group name ── */
  const nameEl = document.getElementById('gName');
  if (nameEl) {
    const badge = nameEl.querySelector('.g-badge');
    /* clear text node but keep badge element */
    nameEl.childNodes[0].textContent = name + ' ';
  }

  /* ── Sub-line: member count + group number ── */
  const subEl = document.getElementById('gSub');
  if (subEl) {
    let subText = count != null
      ? count + (count === 1 ? ' MEMBER' : ' MEMBERS')
      : '— MEMBERS';
    if (groupId) subText += ' · #' + groupId;
    subEl.textContent = subText;
  }

  /* ── Avatar stack: first 3 members, real avatar image if present else initial ── */
  const stack = document.getElementById('avatarStack');
  if (stack) {
    const avatarBg = ['#f0f0f0', '#e8e8e8', '#ececec'];
    let shown = members.slice(0, 3);
    /* pad to at least 1 placeholder slot if no member data is available */
    const minSlots = Math.min(3, Math.max(1, (count || 1) - 1));
    while (shown.length < minSlots) shown.push(null);
    if (shown.length === 0) shown = [null, null, null];

    stack.innerHTML = shown.map((m, i) => {
      const bg = avatarBg[i] || '#f0f0f0';
      if (m && m.avatar) {
        return `<div class="av" style="background:${bg};padding:0;overflow:hidden;">
          <img src="${m.avatar}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" onerror="this.parentElement.style.padding='';this.remove();this.parentElement.textContent='${escHtml((m.name||'?')[0])}';" />
        </div>`;
      }
      const letter = m ? (m.name || '?')[0] : '·';
      return `<div class="av" style="background:${bg}">${escHtml(letter)}</div>`;
    }).join('');
  }
}

/* ---- Render messages ---- */
function renderMessages() {
  const list = document.getElementById('msgList');
  if (!list) return;

  list.innerHTML = _messages.length === 0
    ? buildEmptyState()
    : _messages.map(m => buildMsgHtml(m)).join('');

  requestAnimationFrame(() => {
    const body = document.getElementById('gcBody');
    if (body) body.scrollTop = body.scrollHeight;
  });
}

function buildEmptyState() {
  return `
  <div class="empty-state">
    <div class="empty-icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    </div>
    <div class="empty-title">NO MESSAGES YET</div>
    <div class="empty-sub">START THE CONVERSATION —<br>SEND THE FIRST MESSAGE</div>
  </div>`;
}

function buildMsgHtml(m) {
  const isRight = m.side === 'r';
  let content = '';

  if (m.img) {
    const imgInner = m.img.src
      ? `<img src="${m.img.src}" alt="" onerror="this.style.display='none'" />`
      : `<div class="img-top-deco-h"></div>
         <div class="img-top-deco-v"></div>
         <div class="img-tag">PHOTO</div>
         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.6" stroke-linecap="round">
           <rect x="3" y="3" width="18" height="18" rx="3"/>
           <circle cx="8.5" cy="8.5" r="1.5" fill="#ccc"/>
           <polyline points="21,15 16,10 5,21"/>
         </svg>`;

    content = isRight
      ? `<div class="msg-row r">
          ${m.read ? `<span class="b-read" style="margin-bottom:4px">${m.read}</span>` : ''}
          <div class="img-card"><div class="img-top">${imgInner}</div>
            <div class="img-bottom">
              <span class="img-fname">${m.img.name || 'photo.jpg'}</span>
              <span class="img-size">${m.img.size || ''}</span>
            </div></div>
          <span class="b-time" style="margin-bottom:2px">${m.time || ''}</span>
         </div>`
      : `<div class="msg-row">
          ${miniAvHtml(m)}
          <div class="img-card"><div class="img-top">${imgInner}</div>
            <div class="img-bottom">
              <span class="img-fname">${m.img.name || 'photo.jpg'}</span>
              <span class="img-size">${m.img.size || ''}</span>
            </div></div>
          <span class="b-time" style="margin-bottom:2px">${m.time || ''}</span>
         </div>`;

  } else if (m.bubbles && m.bubbles.length) {
    const bubblesHtml = m.bubbles.map(b =>
      `<div class="bubble ${isRight ? 'r' : 'l'}">
         ${isRight ? '<div class="b-deco"></div>' : ''}
         ${escHtml(b)}
       </div>`
    ).join('');

    content = isRight
      ? `<div class="msg-row r">
          ${m.read ? `<span class="b-read" style="margin-bottom:4px">${m.read}</span>` : ''}
          <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">${bubblesHtml}</div>
          <span class="b-time">${m.time || ''}</span>
         </div>`
      : `<div class="msg-row" style="align-items:flex-start">
          ${miniAvHtml(m)}
          <div style="display:flex;flex-direction:column;gap:4px">${bubblesHtml}</div>
          <span class="b-time">${m.time || ''}</span>
         </div>`;
  }

  const labelHtml = isRight
    ? `<div class="msg-row-r-label"><span>${escHtml(m.sender)}</span></div>`
    : `<div class="sender-label">${escHtml(m.sender)}</div>`;

  return `<div class="msg-block" data-id="${m.id}">${labelHtml}${content}</div>`;
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ---- Mini avatar for message rows: real image if available, else initial ---- */
function miniAvHtml(m) {
  if (m.avatar) {
    return `<div class="mini-av" style="padding:0;overflow:hidden;">
      <img src="${m.avatar}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:9px;display:block;" onerror="this.parentElement.style.padding='';this.remove();" />
    </div>`;
  }
  return `<div class="mini-av">${escHtml(m.initial)}</div>`;
}

/* ---- Input ---- */
function onInputChange(el) {
  document.getElementById('sendBtn')?.classList.toggle('active', !!el.value.trim());
}

function onInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function sendMessage() {
  const input = document.getElementById('inputField');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  document.getElementById('sendBtn')?.classList.remove('active');

  const timeStr = new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:false });
  _messages.push({ id: _nextId++, side:'r', sender:'ME', initial:'ME', bubbles:[text], time:timeStr, read:'' });
  renderMessages();
  simulateReply();
}

/* ---- Simulated replies using real members from DB ---- */
function getMemberPool() {
  const members = _groupData?.members || [];
  if (members.length > 0) {
    return members.map(m => ({
      name:    m.name    || '?',
      initial: (m.name  || '?')[0].toUpperCase(),
      avatar:  m.avatar  || null
    }));
  }
  return [
    { name:'Soyeon',  initial:'SY', avatar:null },
    { name:'Jimin',   initial:'JM', avatar:null },
    { name:'Hyunwoo', initial:'HW', avatar:null },
  ];
}

const REPLIES = [
  ['Got it! 🙂', 'See you soon'],
  ['Noted, thanks', 'Talk later!'],
  ['Sounds good~', 'Will be ready'],
  ['Thanks ✦', 'Looking forward to it'],
  ['Exactly, let\'s discuss'],
  ['Sure, let\'s do it!'],
  ['👍'],
];

function simulateReply() {
  const pool   = getMemberPool();
  const member = pool[Math.floor(Math.random() * pool.length)];
  clearTimeout(_typingTimer);
  _typingTimer = setTimeout(() => {
    startTyping(member.name, member.initial, member.avatar);
    setTimeout(() => {
      stopTyping();
      const replyPool = REPLIES[Math.floor(Math.random() * REPLIES.length)];
      const bubbles   = Array.isArray(replyPool) ? replyPool : [replyPool];
      const timeStr   = new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:false });
      _messages.push({ id:_nextId++, side:'l', sender:member.name, initial:member.initial, avatar:member.avatar, bubbles, time:timeStr });
      renderMessages();
    }, 1200 + Math.random() * 800);
  }, 1400 + Math.random() * 800);
}

/* ---- Image upload ---- */
function handleImgUpload(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const timeStr = new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:false });
    _messages.push({ id:_nextId++, side:'r', sender:'ME', initial:'ME',
      img:{ src:e.target.result, name:file.name, size:(file.size/1024).toFixed(0)+' KB' }, time:timeStr });
    renderMessages();
    input.value = '';
  };
  reader.readAsDataURL(file);
}

/* ---- Function panel ---- */
function toggleFnPanel() {
  const panel = document.getElementById('fnPanel');
  const btn   = document.getElementById('fnBtn');
  if (!panel || !btn) return;
  const open = panel.classList.toggle('open');
  btn.classList.toggle('active', open);
}

/* ---- Function panel: 8 actions (placeholders show a toast for now) ---- */
function fnSendImage() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = e => handleImgUpload(e.target);
  input.click(); toggleFnPanel();
}
function fnSendVoice() {
  gcToast('Voice messages — coming soon');
  toggleFnPanel();
}
function fnVoiceCall() {
  gcToast('Voice call — coming soon');
  toggleFnPanel();
}
function fnVideoCall() {
  gcToast('Video call — coming soon');
  toggleFnPanel();
}
function fnTransfer() {
  gcToast('Transfer — coming soon');
  toggleFnPanel();
}
function fnRedPacket() {
  gcToast('Red packet — coming soon');
  toggleFnPanel();
}
function fnSticker() {
  gcToast('Stickers — coming soon');
  toggleFnPanel();
}
function fnGroupInteract() {
  toggleFnPanel();
  /* Pass current group members + name to groupanon via localStorage */
  const members  = _groupData?.members || [];
  const grpName  = _groupData?.name || localStorage.getItem('luna_current_group_name') || 'GROUP';
  const grpId    = _groupData?.groupId || localStorage.getItem('luna_current_group_id') || '';
  const payload  = {
    name:    grpName,
    groupId: grpId,
    members: members.map((m, i) => ({
      id:      m.id      || ('m_' + i),
      name:    m.name    || ('成员' + (i + 1)),
      initial: (m.name   || '?')[0].toUpperCase(),
      avatar:  m.avatar  || null,
      role:    m.role    || (i === 0 ? 'admin' : 'member'),
      bio:     m.bio     || '',
    }))
  };
  localStorage.setItem('luna_groupanon_data', JSON.stringify(payload));
  localStorage.setItem('luna_groupanon_from', 'groupchat');
  window.location.href = 'groupanon.html';
}

/* ---- AI message restore (placeholder) ---- */
function fnAiRestore() {
  const btn = document.getElementById('aiRestoreBtn');
  if (btn) {
    btn.classList.remove('spinning');
    requestAnimationFrame(() => btn.classList.add('spinning'));
  }
  gcToast('AI message restore — coming soon');
}

/* ---- Lightweight toast ---- */
function gcToast(msg) {
  const t = document.getElementById('gcToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), 2000);
}

/* ---- Date chip: dynamic English date, auto-refreshes at local midnight ---- */
function renderDateChip() {
  const el = document.getElementById('gcDateChip');
  if (!el) return;
  const tz   = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const now  = new Date();
  const days   = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  /* Resolve the date's parts in the configured timezone (falls back silently) */
  let y, mo, d, dow;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year:'numeric', month:'numeric', day:'numeric', weekday:'short'
    }).formatToParts(now);
    const map = {};
    parts.forEach(p => map[p.type] = p.value);
    y  = parseInt(map.year, 10);
    mo = parseInt(map.month, 10) - 1;
    d  = parseInt(map.day, 10);
    dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(map.weekday);
  } catch (e) {
    y = now.getFullYear(); mo = now.getMonth(); d = now.getDate(); dow = now.getDay();
  }
  if (dow < 0 || dow == null) dow = now.getDay();

  el.textContent = `${months[mo]} ${d}, ${y} · ${days[dow]}`;
}

function initDate() {
  renderDateChip();
  /* Re-render once a minute so the chip rolls over to the next day
     automatically if the chat stays open past local midnight. */
  clearInterval(window._dateChipTimer);
  window._dateChipTimer = setInterval(renderDateChip, 60000);
}

/* ---- Close fn panel on outside click ---- */
document.addEventListener('click', e => {
  const panel = document.getElementById('fnPanel');
  const btn   = document.getElementById('fnBtn');
  if (panel?.classList.contains('open')) {
    if (!panel.contains(e.target) && !btn?.contains(e.target)) {
      panel.classList.remove('open');
      btn?.classList.remove('active');
    }
  }
});

/* ================================================================
   INIT — load group from IndexedDB, then render
================================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  updateTime();
  updateBattery();
  applyIsland();
  initDate();

  /* Load group record from DB; match by groupId field, not DB primary key */
  const group = await loadGroupRecord();
  _groupData  = group;

  /* Apply header with real data */
  applyGroupHeader(group);

  /* Messages always start fresh (no history persistence yet) */
  _messages = [];
  renderMessages();

  setInterval(updateTime, 10000);
});