/* ================================
   Luna 离线聊天 — offline_chat.js
================================ */

/* ---- 状态栏时间（一比一复刻 chat.js） ---- */
function updateTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeStr = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const el = document.getElementById('offlineStatusTime');
  if (el) el.textContent = timeStr;
}

/* ---- 电量（一比一复刻 chat.js） ---- */
function updateBattery() {
  const pctEl   = document.getElementById('offlineBatPct');
  const innerEl = document.getElementById('offlineBatInner');
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

/* ---- 灵动岛（一比一复刻 chat.js applyIsland） ---- */
function applyIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const el      = document.getElementById('offlineStatusIsland');
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

/* ---- 字体同步（一比一复刻 chat.js applyGlobalFont） ---- */
async function applyGlobalFont() {
  const name = localStorage.getItem('luna_font_active_name');
  const id   = parseInt(localStorage.getItem('luna_font_active_id'));
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
  let tag = document.getElementById('luna-font-override');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'luna-font-override';
    document.head.appendChild(tag);
  }
  const familyRule = name ? `font-family: '${name}', sans-serif !important;` : '';
  tag.textContent = `* { ${familyRule} }`;
}

/* ---- 监听 chat.js 设置变化，实时同步 ---- */
window.addEventListener('storage', e => {
  if (e.key === 'luna_font_update')   applyGlobalFont();
  if (e.key === 'luna_island_update' || e.key === 'luna_island_enabled' || e.key === 'luna_island_style') applyIsland();
  if (e.key === 'luna_tz_update')     updateTime();
});

/* ================================
   消息数据存储
================================ */
const DB_KEY = 'luna_offline_messages';

function loadMessages() {
  try { return JSON.parse(localStorage.getItem(DB_KEY)) || []; }
  catch(e) { return []; }
}

function saveMessages(msgs) {
  localStorage.setItem(DB_KEY, JSON.stringify(msgs));
}

/* ================================
   当前输入模式
================================ */
let currentMode = 'dialogue';

document.querySelectorAll('.inp-mode').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.inp-mode').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    currentMode = this.dataset.mode;
  });
});

/* ================================
   渲染消息列表
================================ */
function renderMessages() {
  const msgs   = loadMessages();
  const list   = document.getElementById('msgList');
  const floorEl  = document.getElementById('floorNum');
  const floorTag = document.getElementById('floorTag');

  if (!list) return;

  const floor = msgs.length;
  if (floorEl)  floorEl.textContent = '#' + floor;
  if (floorTag) floorTag.querySelector('.hd-stag-t').textContent = '楼 #' + floor;

  list.innerHTML = '';

  msgs.forEach((msg, idx) => {
    const floorNum = idx + 1;
    const isUser   = msg.role === 'user';

    /* 楼层分隔 */
    const sep = document.createElement('div');
    sep.className = 'floor-sep';
    sep.innerHTML = `
      <div class="floor-sep-line"></div>
      <div class="floor-sep-txt">第${cnFloor(floorNum)}楼${idx === 0 ? ' · 开篇' : ''}</div>
      <div class="floor-sep-line"></div>`;
    list.appendChild(sep);

    /* 卡片 */
    const card = document.createElement('div');
    card.className = 'card' + (isUser ? ' user' : '');

    /* 格式化正文 */
    const bodyHtml = formatBody(msg.text, msg.mode);

    /* 标签 */
    const tagsHtml = buildTags(msg.mode, isUser);

    /* 情绪主标 */
    const moodLabel = moodFromMode(msg.mode);

    card.innerHTML = `
      <div class="card-header">
        <div class="ch-av${isUser ? ' u' : ''}">
          <span class="ch-av-l${isUser ? ' u' : ''}">${isUser ? '我' : 'L'}</span>
        </div>
        <div class="ch-info">
          <div class="ch-row1">
            <span class="ch-name">${isUser ? '你' : 'Luna'}</span>
            ${moodLabel ? `<span class="ch-mood">· ${moodLabel}</span>` : ''}
          </div>
          <div class="ch-tags">${tagsHtml}</div>
        </div>
        <div class="ch-floor">#${floorNum}</div>
      </div>
      <div class="card-body">
        <div class="panel-text">${bodyHtml}</div>
      </div>
      <div class="card-foot">
        <div class="cf-left">
          <span class="cf-time">${formatTime(msg.time)}</span>
          <div class="cf-dot"></div>
          <span class="cf-status">${isUser ? '已发送' : '已送达'}</span>
        </div>
        <div class="cf-acts">
          ${isUser
            ? `<button class="cf-act" onclick="editMsg(${idx})">编辑</button>`
            : `<button class="cf-act" onclick="quoteMsg(${idx})">引用</button>
               <button class="cf-act" onclick="deleteMsg(${idx})">删除</button>`
          }
        </div>
      </div>`;

    list.appendChild(card);
  });

  /* 滚到底 */
  list.scrollTop = list.scrollHeight;
}

/* ================================
   正文格式化
================================ */
function formatBody(text, mode) {
  /* 简单转义 */
  const safe = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  if (mode === 'action') {
    return `<em>*${safe}*</em>`;
  }
  if (mode === 'thought') {
    return `<span class="thought">${safe}</span>`;
  }
  if (mode === 'env') {
    return `<span class="env">·· ${safe} ··</span>`;
  }
  /* dialogue — 默认 */
  return `「${safe}」`;
}

function buildTags(mode, isUser) {
  const modeTagMap = {
    dialogue: ['tag-neutral', '对白'],
    action:   ['tag-action',  '动作'],
    thought:  ['tag-heart',   '心理'],
    env:      ['tag-scene',   '环境'],
  };
  const [cls, label] = modeTagMap[mode] || ['tag-neutral', '对白'];
  return `<span class="ch-tag ${isUser ? 'tag-neutral' : cls}">${label}</span>`;
}

function moodFromMode(mode) {
  const map = { dialogue: '', action: '行动中', thought: '所思所想', env: '环境描写' };
  return map[mode] || '';
}

/* ================================
   发送消息
================================ */
document.getElementById('sendBtn').addEventListener('click', sendMessage);

const _inpTa = document.getElementById('inputText');
_inpTa.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendMessage();
});
_inpTa.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 130) + 'px';
  const cc = document.getElementById('charCount');
  if (cc) cc.textContent = this.value.length;
});

function sendMessage() {
  const ta   = document.getElementById('inputText');
  const text = ta.value.trim();
  if (!text) return;

  const msgs = loadMessages();
  msgs.push({ role: 'user', text, mode: currentMode, time: Date.now() });
  saveMessages(msgs);

  /* 更新对话数 */
  const convEl = document.getElementById('convCount');
  if (convEl) convEl.textContent = msgs.length;

  ta.value = '';
  renderMessages();
}

/* ================================
   操作：编辑 / 引用 / 删除
================================ */
function editMsg(idx) {
  const msgs = loadMessages();
  const msg  = msgs[idx];
  if (!msg) return;
  const ta = document.getElementById('inputText');
  ta.value = msg.text;
  /* 切换模式 */
  document.querySelectorAll('.inp-mode').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === msg.mode);
  });
  currentMode = msg.mode;
  msgs.splice(idx, 1);
  saveMessages(msgs);
  renderMessages();
  ta.focus();
}

function quoteMsg(idx) {
  const msgs = loadMessages();
  const msg  = msgs[idx];
  if (!msg) return;
  const ta = document.getElementById('inputText');
  ta.value = `（引用第${idx+1}楼）\n`;
  ta.focus();
}

function deleteMsg(idx) {
  const msgs = loadMessages();
  msgs.splice(idx, 1);
  saveMessages(msgs);
  renderMessages();
}

/* ================================
   工具函数
================================ */
function formatTime(ts) {
  const d = new Date(ts);
  return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
}

const CN_FLOORS = ['零','一','二','三','四','五','六','七','八','九','十',
  '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
  '二十一','二十二','二十三','二十四','二十五','二十六','二十七','二十八','二十九','三十'];

function cnFloor(n) {
  return CN_FLOORS[n] || String(n);
}

/* ================================
   初始化
================================ */
updateTime();
setInterval(updateTime, 1000);
updateBattery();
applyIsland();
applyGlobalFont();
renderMessages();