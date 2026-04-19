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
function renderConvList() {
  const data = [
    { name: '陈晓雨', initial: '陈', preview: '好的，明天见！', time: '10:24', unread: 2, online: true,  type: 'dm'    },
    { name: '林默',   initial: '林', preview: '照片发你了',     time: '昨天',  unread: 0, online: false, type: 'dm'    },
    { name: 'Luna小队', initial: 'L', preview: 'Aria：哈哈哈真的吗', time: '昨天', unread: 5, online: false, type: 'group' },
    { name: 'Aria',  initial: 'A',  preview: '在吗？',          time: '周一',  unread: 0, online: true,  type: 'dm'    },
    { name: '设计组',  initial: '设', preview: '王：新稿发出来了', time: '周一', unread: 3, online: false, type: 'group' },
  ];
  const list = document.getElementById('convList');
  if (!list) return;
  list.innerHTML = data.map(d => `
    <div class="conv-item ${d.type}">
      <div class="conv-avatar">
        ${d.initial}
        ${d.online ? '<div class="conv-online"></div>' : ''}
      </div>
      <div class="conv-info">
        <div class="conv-name">${d.name}</div>
        <div class="conv-preview ${d.unread ? 'unread' : ''}">${d.preview}</div>
      </div>
      <div class="conv-meta">
        <div class="conv-time">${d.time}</div>
        ${d.unread ? `<div class="conv-badge">${d.unread}</div>` : ''}
      </div>
    </div>
  `).join('');
}

function renderContactList() {
  const data = [
    { name: '陈晓雨', initial: '陈', status: '在线', color: '#6366f1', bg: '#e0e7ff' },
    { name: 'Aria',  initial: 'A',  status: '刚刚活跃', color: '#ec4899', bg: '#fce7f3' },
    { name: '林默',   initial: '林', status: '离线',   color: '#f59e0b', bg: '#fef3c7' },
    { name: '王一博', initial: '王', status: '2小时前', color: '#10b981', bg: '#d1fae5' },
  ];
  const list = document.getElementById('contactList');
  if (!list) return;
  list.innerHTML = data.map(d => `
    <div class="contact-item">
      <div class="contact-avatar" style="background:${d.bg};color:${d.color};">${d.initial}</div>
      <div>
        <div class="contact-name">${d.name}</div>
        <div class="contact-status">${d.status}</div>
      </div>
    </div>
  `).join('');
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
function openAddContact() { console.log('add contact'); }
function openNewPost()    { console.log('new post'); }

/* ---- 初始化 ---- */
document.addEventListener('DOMContentLoaded', () => {
  updateTime();
  updateBattery();
  setInterval(updateTime, 1000);
  renderConvList();
  renderContactList();
  renderMoments();
  switchTab('messages');
  const firstBtn = document.getElementById('tabMessages');
  if (firstBtn) moveArc(firstBtn);
  applyGlobalFont();   // ← 加这行
  applyIsland();       // ← 加这行
  renderStoryRing();
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
        const req = indexedDB.open('LunaFontDB', 1);
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
  const colorRule  = style.color ? `color: ${style.color} !important;` : '';
  const sizeRule   = style.size  ? `font-size: ${style.size}px !important;` : '';
  const familyRule = name        ? `font-family: '${name}', sans-serif !important;` : '';
  tag.textContent  = `* { ${colorRule} ${sizeRule} ${familyRule} }`;
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
  const data = [
    { initial: '陈', online: true,  name: '晓雨' },
    { initial: 'A',  online: true,  name: 'Aria'  },
    { initial: '林', online: false, name: '林默'  },
    { initial: '王', online: false, name: '一博'  },
    { initial: 'M',  online: true,  name: 'Moon'  },
  ];
  const el = document.getElementById('storyRingList');
  if (!el) return;
  el.innerHTML = data.map(d => `
    <div class="story-item">
      <div class="story-ring-outer ${d.online ? '' : 'inactive'}">
        <div class="story-ring-inner">
          ${d.initial}
          ${d.online ? '<div class="story-online-dot"></div>' : ''}
        </div>
      </div>
      <div class="story-name">${d.name}</div>
    </div>
  `).join('');
}

function switchConvTab(btn, type) {
  document.querySelectorAll('.conv-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}