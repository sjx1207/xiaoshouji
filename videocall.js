/* ================================
   Video Call — videocall.js
   与 chatroom 完全同步：状态栏 / 灵动岛 / 字体
================================ */

/* ================================================================
   1. 实时时钟 + 电量（与 chatroom crTick 完全一致）
================================================================ */
function vcTick() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const n  = new Date();
  const timeStr = n.toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit',
    hour12: false, timeZone: tz
  });
  const el = document.getElementById('vcTime');
  if (el) el.textContent = timeStr;

  const pct     = parseInt(localStorage.getItem('luna_battery') || '76');
  const pctEl   = document.getElementById('batPct');
  const innerEl = document.getElementById('batInner');
  if (pctEl)   pctEl.textContent = pct;
  if (innerEl) {
    innerEl.style.width      = pct + '%';
    innerEl.style.background = pct <= 20
      ? 'linear-gradient(90deg,#f87171,#ef4444)'
      : 'rgba(255,255,255,0.75)';  /* 暗色主题用白色 */
  }
}
vcTick();
setInterval(vcTick, 10000);

/* ================================================================
   2. 灵动岛（与 chatroom applyIsland 完全一致，id 指向 statusIsland）
================================================================ */
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

  clearInterval(window._vcSiClockTimer);
  if (style === 'clock') {
    const tick = () => {
      const t = document.getElementById('siClockText');
      if (!t) return;
      const now = new Date();
      t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    };
    tick();
    window._vcSiClockTimer = setInterval(tick, 10000);
  }
}

/* ================================================================
   3. 字体同步（与 chatroom applyGlobalFont 完全一致）
================================================================ */
async function applyGlobalFont() {
  const name = localStorage.getItem('luna_font_active_name');
  const id   = parseInt(localStorage.getItem('luna_font_active_id'));
  if (name && id) {
    try {
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open('LunaFontDB', 4);
        req.onupgradeneeded = e => {
          const d = e.target.result;
          if (!d.objectStoreNames.contains('fonts'))
            d.createObjectStore('fonts', { keyPath: 'id', autoIncrement: true });
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
    } catch (e) {}
  }
  let tag = document.getElementById('luna-font-override');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'luna-font-override';
    document.head.appendChild(tag);
  }
  const familyRule = name ? `font-family:'${name}',sans-serif !important;` : '';
  tag.textContent = `* { ${familyRule} }`;
}

/* ================================================================
   4. 通话计时器
================================================================ */
let _vcStartTime = Date.now();
let _vcEnded     = false;

function vcFormatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h  = Math.floor(totalSec / 3600);
  const m  = Math.floor((totalSec % 3600) / 60);
  const s  = totalSec % 60;
  if (h > 0) {
    return h + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  }
  return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
}

function vcStartTimer() {
  _vcStartTime = Date.now();
  const el = document.getElementById('vcDuration');
  window._vcTimerInterval = setInterval(() => {
    if (_vcEnded) return;
    if (el) el.textContent = vcFormatDuration(Date.now() - _vcStartTime);
  }, 1000);
}

/* ================================================================
   5. 消息列表
================================================================ */
/*
 * VC_MESSAGES 已清空写死内容。
 * 后续在此处注入真实逻辑（AI 接通自动打招呼、历史消息回放等）。
 * 格式参考：{ role: 'luna'|'you', text: '...', delay: ms }
 */
const VC_MESSAGES = []; // 留空，由后续逻辑填充

function vcNow() {
  const n = new Date();
  return String(n.getHours()).padStart(2,'0') + ':' + String(n.getMinutes()).padStart(2,'0');
}

function vcAppendMessage(role, text) {
  const area = document.getElementById('vcMessages');
  if (!area) return;

  const isLuna = role === 'luna';
  const wrap   = document.createElement('div');
  wrap.className = isLuna ? 'vc-msg-luna' : 'vc-msg-you';

  const bubble = document.createElement('div');
  bubble.className = isLuna ? 'vc-bubble-luna' : 'vc-bubble-you';
  const p = document.createElement('p');
  p.textContent = text;
  bubble.appendChild(p);

  const ts = document.createElement('span');
  ts.className   = 'vc-ts';
  ts.textContent = vcNow();

  wrap.appendChild(bubble);
  wrap.appendChild(ts);
  area.appendChild(wrap);
  area.scrollTop = area.scrollHeight;
}

/* 正在输入 typing 指示器 */
function vcShowTyping() {
  const area = document.getElementById('vcMessages');
  if (!area) return;
  let t = document.getElementById('vcTyping');
  if (t) return;
  t = document.createElement('div');
  t.id = 'vcTyping';
  t.className = 'vc-msg-luna vc-typing';
  t.innerHTML = `<div class="vc-typing-dots"><span></span><span></span><span></span></div>`;
  area.appendChild(t);
  area.scrollTop = area.scrollHeight;
}
function vcHideTyping() {
  const t = document.getElementById('vcTyping');
  if (t) t.remove();
}

function vcScheduleMessages() {
  VC_MESSAGES.forEach(({ role, text, delay }) => {
    if (role === 'luna') {
      setTimeout(() => { vcShowTyping(); }, delay - 900 < 0 ? 0 : delay - 900);
      setTimeout(() => { vcHideTyping(); vcAppendMessage('luna', text); }, delay);
    } else {
      setTimeout(() => { vcAppendMessage('you', text); }, delay);
    }
  });
}

/* ================================================================
   6. 键盘输入面板 — 全宽覆盖底部控制栏，含 AI 按钮 + 发送按钮
================================================================ */
function vcBuildKeyboard() {
  const existing = document.getElementById('vcKeyboardPanel');
  if (existing) {
    /* 再次点击：收起并销毁 */
    existing.style.transform = 'translateY(100%)';
    setTimeout(() => existing.remove(), 320);
    /* 恢复底部控制栏 */
    const ctrl = document.querySelector('.vc-controls');
    if (ctrl) ctrl.style.opacity = '1';
    return;
  }

  /* 隐藏底部控制栏（面板会盖在上面） */
  const ctrl = document.querySelector('.vc-controls');
  if (ctrl) ctrl.style.opacity = '0';

  const panel = document.createElement('div');
  panel.id = 'vcKeyboardPanel';
  panel.style.cssText = `
    position:fixed;
    bottom:0;left:0;right:0;
    background:rgba(14,14,18,0.98);
    backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);
    border-top:0.5px solid rgba(255,255,255,0.09);
    border-radius:22px 22px 0 0;
    padding:14px 18px calc(env(safe-area-inset-bottom,0px) + 18px);
    z-index:500;
    transform:translateY(100%);
    transition:transform 0.32s cubic-bezier(0.34,1.1,0.64,1);
    box-shadow:0 -8px 40px rgba(0,0,0,0.55);
  `;

  panel.innerHTML = `
    <!-- 顶部把手（可点击收起） -->
    <div id="vcKbHandle" style="width:36px;height:4px;background:rgba(255,255,255,0.22);border-radius:2px;margin:0 auto 14px;cursor:pointer;"></div>

    <!-- 装饰分割线（参考 chatroom cr-const-div） -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
      <div style="flex:1;height:0.5px;background:linear-gradient(to right,transparent,rgba(255,255,255,0.08),transparent);"></div>
      <svg width="48" height="10" viewBox="0 0 48 10" style="flex-shrink:0;">
        <circle cx="5"  cy="5" r="1.5" fill="rgba(255,255,255,0.18)"/>
        <line x1="7" y1="5" x2="11" y2="5" stroke="rgba(255,255,255,0.08)" stroke-width=".5"/>
        <circle cx="24" cy="5" r="2.2" fill="rgba(255,255,255,0.22)"/>
        <path d="M24 2l.6 2H27l-1.8 1.3.7 2.1L24 6.1l-1.9 1.2.7-2.1L21 4H23.4L24 2Z" fill="rgba(0,0,0,0.3)"/>
        <line x1="26.5" y1="5" x2="37" y2="5" stroke="rgba(255,255,255,0.08)" stroke-width=".5"/>
        <circle cx="43" cy="5" r="1.5" fill="rgba(255,255,255,0.18)"/>
      </svg>
      <div style="flex:1;height:0.5px;background:linear-gradient(to left,transparent,rgba(255,255,255,0.08),transparent);"></div>
    </div>

    <!-- 输入行 -->
    <div style="display:flex;align-items:flex-end;gap:10px;">

      <!-- AI 按钮（左侧） -->
      <button id="vcKbAI" style="
        position:relative;
        width:40px;height:40px;border-radius:50%;border:none;
        background:rgba(255,255,255,0.06);
        border:0.5px solid rgba(255,255,255,0.11);
        display:flex;align-items:center;justify-content:center;
        cursor:pointer;transition:background 0.15s;
        overflow:visible;flex-shrink:0;
        margin-bottom:1px;
      ">
        <!-- 旋转虚线圆（与 chatroom cr-ai-ring 一致） -->
        <svg style="position:absolute;inset:-6px;width:52px;height:52px;pointer-events:none;" viewBox="0 0 52 52">
          <circle cx="26" cy="26" r="23" fill="none"
            stroke="rgba(255,255,255,0.10)" stroke-width=".8" stroke-dasharray="6 5"
            style="animation:spin-dash 6s linear infinite;transform-origin:26px 26px;"/>
        </svg>
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
          <path d="M10 1L11.8 7H18L12.9 10.7L14.7 16.7L10 13L5.3 16.7L7.1 10.7L2 7H8.2L10 1Z"
            stroke="rgba(255,255,255,0.5)" stroke-width="1.3" stroke-linejoin="round" fill="rgba(255,255,255,0.04)"/>
          <circle cx="10" cy="10" r="2.2" fill="rgba(255,255,255,0.35)"/>
        </svg>
      </button>

      <!-- 输入框 -->
      <div id="vcKbInput" contenteditable="true"
        data-ph="${vcCharacterId()} 发送消息"
        style="
          flex:1;min-height:40px;max-height:110px;overflow-y:auto;
          background:rgba(255,255,255,0.06);
          border:0.5px solid rgba(255,255,255,0.11);
          border-radius:14px;
          padding:10px 14px;
          font-size:14px;color:rgba(255,255,255,0.82);
          font-family:'Inter',sans-serif;
          outline:none;line-height:1.55;
          transition:border-color 0.18s;
          word-break:break-word;
        ">
      </div>

      <!-- 发送按钮（右侧） -->
      <button id="vcKbSend" style="
        width:40px;height:40px;border-radius:50%;border:none;
        background:rgba(140,115,220,0.80);
        display:flex;align-items:center;justify-content:center;
        cursor:pointer;flex-shrink:0;
        transition:background 0.15s,transform 0.12s;
        box-shadow:0 2px 12px rgba(120,90,200,0.35);
        margin-bottom:1px;
      ">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path d="M18 2L10 10" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M18 2L12.5 18L10 10L2 7.5L18 2Z" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

    </div>
  `;

  document.body.appendChild(panel);

  /* 滑入动画 */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { panel.style.transform = 'translateY(0)'; });
  });

  /* ── 把手点击收起 ── */
  const kbHandle = panel.querySelector('#vcKbHandle');
  if (kbHandle) {
    kbHandle.addEventListener('click', () => {
      panel.style.transform = 'translateY(100%)';
      setTimeout(() => panel.remove(), 320);
      const ctrl = document.querySelector('.vc-controls');
      if (ctrl) ctrl.style.opacity = '1';
    });
  }

  /* ── placeholder 逻辑 ── */
  const kbInput = panel.querySelector('#vcKbInput');
  /* 用动态角色名更新 placeholder */
  if (kbInput) kbInput.setAttribute('data-ph', '向 ' + vcCharacterId() + ' 发送消息');
  function showPh() {
    if (!kbInput.textContent.trim()) {
      kbInput.setAttribute('data-empty', '1');
    } else {
      kbInput.removeAttribute('data-empty');
    }
  }
  showPh();
  kbInput.addEventListener('input', showPh);
  kbInput.addEventListener('focus', () => kbInput.removeAttribute('data-empty'));
  kbInput.addEventListener('blur', showPh);

  /* placeholder CSS 注入 */
  if (!document.getElementById('vcKbPhStyle')) {
    const s = document.createElement('style');
    s.id = 'vcKbPhStyle';
    s.textContent = `
      #vcKbInput[data-empty="1"]:not(:focus)::before {
        content: attr(data-ph);
        color: rgba(255,255,255,0.22);
        pointer-events: none;
        position: absolute;
      }
      #vcKbInput { position: relative; }
    `;
    document.head.appendChild(s);
  }

  /* ── AI 按钮：触发角色主动发言（逻辑待接入） ── */
  const kbAI = panel.querySelector('#vcKbAI');
  kbAI.addEventListener('click', () => {
    kbAI.style.background = 'rgba(140,115,220,0.25)';
    setTimeout(() => { kbAI.style.background = ''; }, 300);
    /* TODO: 后续在此接入真实 AI 主动发言逻辑（调用角色 API / 触发 vcAISpeak()） */
    vcShowTyping();
    setTimeout(() => { vcHideTyping(); }, 1600); // 占位：接入后替换此行
  });

  /* ── 发送按钮 ── */
  const kbSend = panel.querySelector('#vcKbSend');
  function doSend() {
    const txt = kbInput.textContent.trim();
    if (!txt) return;
    vcAppendMessage('you', txt);
    kbInput.textContent = '';
    showPh();
    kbSend.style.transform = 'scale(0.88)';
    setTimeout(() => { kbSend.style.transform = ''; }, 150);
    /* TODO: 后续在此接入真实 AI 回复逻辑（调用角色 API / vcAIReply(txt)） */
    setTimeout(vcShowTyping, 700);
    setTimeout(() => { vcHideTyping(); }, 1900); // 占位：接入后替换此行
  }
  kbSend.addEventListener('click', doSend);

  /* Enter 发送，Shift+Enter 换行 */
  kbInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  });

  /* 自动聚焦 */
  setTimeout(() => kbInput.focus(), 350);
}

/* ================================================================
   7. 挂断逻辑
================================================================ */
function vcHangup() {
  _vcEnded = true;
  clearInterval(window._vcTimerInterval);
  vcHideTyping();

  const btn = document.getElementById('vcHangupBtn');
  if (btn) btn.classList.add('ended');

  /* 告别消息（TODO：后续可接入角色 AI 生成告别语，或直接省略） */
  // vcAppendMessage('luna', '...'); // 已清空写死内容

  /* 2.5 秒后跳转回 chatroom（若不存在则提示） */
  setTimeout(() => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = 'chatroom.html';
    }
  }, 2500);
}

/* ================================================================
   8. 设置面板 — 居中弹窗，背景+小框媒体，IndexedDB，绑定角色
================================================================ */

function vcCharacterId() {
  /* 优先用 luna_current_chat（角色名），回退 luna_active_character，再回退 'luna' */
  return localStorage.getItem('luna_current_chat')
      || localStorage.getItem('luna_active_character')
      || 'luna';
}

/* ================================================================
   vcSyncCharacterInfo — 把当前角色的名字 / 头像填充到视频通话页面
================================================================ */
function vcSyncCharacterInfo() {
  const charName   = vcCharacterId();
  const avatarData = localStorage.getItem('luna_vc_avatar') || null;

  /* ── 1. 填充所有名字文本节点 ── */
  /* 通话页 hero 名字 */
  const vcNameEl  = document.querySelector('.vc-name');
  if (vcNameEl) vcNameEl.textContent = charName;

  /* 拨号屏名字 */
  const vcdNameEl = document.getElementById('vcdName');
  if (vcdNameEl) vcdNameEl.textContent = charName;

  /* 输入框 placeholder */
  const kbPhEl = document.getElementById('vcKbInput');
  if (kbPhEl) kbPhEl.setAttribute('data-ph', '向 ' + charName + ' 发送消息');

  /* 页面 title */
  document.title = charName + ' · Video Call';

  /* ── 2. 填充头像 ── */
  if (avatarData) {
    /* 替换通话页 hero 头像 SVG → img */
    const vcAvatarEl = document.querySelector('.vc-avatar');
    if (vcAvatarEl) {
      vcAvatarEl.innerHTML = '';
      const img = document.createElement('img');
      img.src = avatarData;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;';
      vcAvatarEl.appendChild(img);
    }

    /* 替换拨号屏头像 SVG → img */
    const vcdAvatarEl = document.querySelector('.vcd-avatar-inner');
    if (vcdAvatarEl) {
      vcdAvatarEl.innerHTML = '';
      const img2 = document.createElement('img');
      img2.src = avatarData;
      img2.style.cssText = 'width:64px;height:64px;object-fit:cover;border-radius:50%;display:block;';
      vcdAvatarEl.appendChild(img2);
    }
  }

  /* ── 3. 消息区：替换 'luna' 角色标识里的硬编码名字（typing 气泡等在渲染时读此变量） ── */
  window._vcCharName = charName;
  window._vcAvatarData = avatarData;
}

function vcOpenMediaDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('LunaMediaDB', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('media'))
        db.createObjectStore('media', { keyPath: 'key' });
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror   = () => rej(new Error('DB open failed'));
  });
}

async function vcSaveMedia(slot, dataUrl, mimeType) {
  const key = `${vcCharacterId()}_${slot}`;
  const db  = await vcOpenMediaDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('media', 'readwrite');
    tx.objectStore('media').put({ key, dataUrl, mimeType });
    tx.oncomplete = () => res();
    tx.onerror    = () => rej();
  });
}

async function vcLoadMedia(slot) {
  const key = `${vcCharacterId()}_${slot}`;
  const db  = await vcOpenMediaDB();
  return new Promise(res => {
    const req = db.transaction('media').objectStore('media').get(key);
    req.onsuccess = () => res(req.result || null);
    req.onerror   = () => res(null);
  });
}

async function vcDeleteMedia(slot) {
  const key = `${vcCharacterId()}_${slot}`;
  const db  = await vcOpenMediaDB();
  return new Promise(res => {
    const tx = db.transaction('media', 'readwrite');
    tx.objectStore('media').delete(key);
    tx.oncomplete = () => res();
  });
}

function vcReadFile(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result);
    r.onerror = () => rej();
    r.readAsDataURL(file);
  });
}

async function vcApplySavedMedia() {
  const bg = await vcLoadMedia('bg');
  if (bg) {
    const frame = document.querySelector('.vc-frame');
    if (frame) {
      if (bg.mimeType.startsWith('video/')) {
        let vid = document.getElementById('vcBgVideo');
        if (!vid) {
          vid = document.createElement('video');
          vid.id = 'vcBgVideo';
          vid.autoplay = true; vid.loop = true; vid.muted = true; vid.playsInline = true;
          vid.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;opacity:0.35;pointer-events:none;';
          frame.insertBefore(vid, frame.firstChild);
        }
        vid.src = bg.dataUrl;
        frame.style.background = 'transparent';
      } else {
        frame.style.background = `url('${bg.dataUrl}') center/cover no-repeat`;
        const vid = document.getElementById('vcBgVideo');
        if (vid) vid.remove();
      }
    }
  }

  const sv = await vcLoadMedia('selfview');
  const selfView = document.querySelector('.vc-self-view');
  if (selfView && sv) {
    if (sv.mimeType.startsWith('video/')) {
      selfView.innerHTML = '';
      const vid = document.createElement('video');
      vid.autoplay = true; vid.loop = true; vid.muted = true; vid.playsInline = true;
      vid.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:inherit;';
      vid.src = sv.dataUrl;
      selfView.appendChild(vid);
    } else {
      selfView.style.backgroundImage = `url('${sv.dataUrl}')`;
      selfView.style.backgroundSize  = 'cover';
      selfView.style.backgroundPosition = 'center';
      selfView.innerHTML = '';
    }
  }
}

async function vcBuildSettings() {
  let overlay = document.getElementById('vcSettingsOverlay');
  if (overlay) { overlay.remove(); return; }

  const charId = vcCharacterId();

  overlay = document.createElement('div');
  overlay.id = 'vcSettingsOverlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:400;
    display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,0.65);
    backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
    padding:24px;
  `;

  overlay.innerHTML = `
  <style>
    @keyframes vcModalIn {
      from { transform:scale(0.92) translateY(12px); opacity:0; }
      to   { transform:scale(1) translateY(0); opacity:1; }
    }
    .vc-set-modal {
      width:100%;max-width:340px;
      background:linear-gradient(160deg,#1a1a22,#111116);
      border:0.5px solid rgba(255,255,255,0.09);
      border-radius:24px;
      padding:24px 20px 20px;
      animation:vcModalIn .26s cubic-bezier(.34,1.1,.64,1) both;
      max-height:85vh;overflow-y:auto;
    }
    .vc-set-modal::-webkit-scrollbar { display:none; }
    .vc-set-section { margin-bottom:20px; }
    .vc-set-label {
      font-family:'Space Mono',monospace;font-size:8.5px;letter-spacing:2px;
      color:rgba(255,255,255,0.22);text-transform:uppercase;margin-bottom:10px;
    }
    .vc-set-preview {
      width:100%;height:96px;border-radius:14px;
      border:0.5px solid rgba(255,255,255,0.09);background:#0d0d12;
      display:flex;align-items:center;justify-content:center;
      overflow:hidden;position:relative;margin-bottom:8px;
    }
    .vc-set-preview img, .vc-set-preview video {
      width:100%;height:100%;object-fit:cover;border-radius:14px;
    }
    .vc-set-ph { font-size:11px;color:rgba(255,255,255,0.18);font-family:'Inter',sans-serif; }
    .vc-set-btn-row { display:flex;gap:8px; }
    .vc-set-upload-btn {
      flex:1;padding:9px 0;border-radius:11px;border:none;
      background:rgba(255,255,255,0.06);border:0.5px solid rgba(255,255,255,0.10);
      color:rgba(255,255,255,0.55);font-size:12px;font-family:'Inter',sans-serif;
      cursor:pointer;transition:background .15s;display:flex;align-items:center;justify-content:center;gap:5px;
    }
    .vc-set-upload-btn:active { background:rgba(255,255,255,0.12); }
    .vc-set-del-btn {
      width:36px;height:36px;border-radius:10px;border:none;
      background:rgba(220,60,60,0.10);border:0.5px solid rgba(220,60,60,0.18);
      color:rgba(220,80,80,0.7);font-size:14px;cursor:pointer;
      display:flex;align-items:center;justify-content:center;
      transition:background .15s;flex-shrink:0;
    }
    .vc-set-del-btn:active { background:rgba(220,60,60,0.22); }
    .vc-set-char-tag {
      display:inline-block;font-family:'Space Mono',monospace;font-size:9px;
      color:rgba(175,155,240,0.6);background:rgba(140,115,220,0.10);
      border:0.5px solid rgba(140,115,220,0.20);border-radius:20px;
      padding:2px 9px;margin-bottom:18px;
    }
    .vc-set-close {
      width:100%;padding:13px;border-radius:14px;border:none;
      background:rgba(255,255,255,0.06);border:0.5px solid rgba(255,255,255,0.08);
      color:rgba(255,255,255,0.4);font-size:13px;font-family:'Inter',sans-serif;
      cursor:pointer;margin-top:4px;transition:background .15s;
    }
    .vc-set-close:active { background:rgba(255,255,255,0.11); }
    .vc-set-save-tip {
      text-align:center;font-size:11px;font-family:'Inter',sans-serif;
      margin-top:10px;min-height:16px;transition:opacity .3s;
    }
  </style>

  <div class="vc-set-modal">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
      <span style="font-size:15px;font-weight:600;color:rgba(255,255,255,0.85);font-family:'Inter',sans-serif;">通话外观</span>
      <button id="vcSetCloseX" style="width:28px;height:28px;border-radius:50%;border:none;
        background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.4);
        font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;">&#x2715;</button>
    </div>
    <div class="vc-set-char-tag">@ ${charId}</div>

    <div class="vc-set-section">
      <div class="vc-set-label">通话背景</div>
      <div class="vc-set-preview" id="vcBgPreview"><span class="vc-set-ph">未设置背景</span></div>
      <div class="vc-set-btn-row">
        <button class="vc-set-upload-btn" id="vcBgImgBtn">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1" y="3" width="14" height="10" rx="2"/><circle cx="5.5" cy="7" r="1.2" fill="currentColor" stroke="none"/><path d="M1 10l4-3 3 2.5 2.5-2 4.5 3.5"/></svg>
          图片
        </button>
        <button class="vc-set-upload-btn" id="vcBgVidBtn">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1" y="3" width="10" height="10" rx="2"/><path d="M11 6l4-2v8l-4-2V6Z"/></svg>
          视频
        </button>
        <button class="vc-set-del-btn" id="vcBgDelBtn">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><polyline points="2,4 14,4"/><path d="M5 4V2h6v2"/><path d="M6 7v5M10 7v5"/><rect x="3" y="4" width="10" height="10" rx="1.5"/></svg>
        </button>
      </div>
      <input type="file" id="vcBgImgInput" accept="image/*" style="display:none"/>
      <input type="file" id="vcBgVidInput" accept="video/*" style="display:none"/>
    </div>

    <div class="vc-set-section">
      <div class="vc-set-label">自拍小框</div>
      <div class="vc-set-preview" id="vcSvPreview" style="height:76px;"><span class="vc-set-ph">未设置</span></div>
      <div class="vc-set-btn-row">
        <button class="vc-set-upload-btn" id="vcSvImgBtn">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1" y="3" width="14" height="10" rx="2"/><circle cx="5.5" cy="7" r="1.2" fill="currentColor" stroke="none"/><path d="M1 10l4-3 3 2.5 2.5-2 4.5 3.5"/></svg>
          图片
        </button>
        <button class="vc-set-upload-btn" id="vcSvVidBtn">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1" y="3" width="10" height="10" rx="2"/><path d="M11 6l4-2v8l-4-2V6Z"/></svg>
          视频
        </button>
        <button class="vc-set-del-btn" id="vcSvDelBtn">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><polyline points="2,4 14,4"/><path d="M5 4V2h6v2"/><path d="M6 7v5M10 7v5"/><rect x="3" y="4" width="10" height="10" rx="1.5"/></svg>
        </button>
      </div>
      <input type="file" id="vcSvImgInput" accept="image/*" style="display:none"/>
      <input type="file" id="vcSvVidInput" accept="video/*" style="display:none"/>
    </div>

    <div class="vc-set-save-tip" id="vcSetTip"></div>
    <button class="vc-set-close" id="vcSetClosBtn">完成</button>
  </div>
  `;

  document.body.appendChild(overlay);

  function renderPreview(slot, previewId) {
    vcLoadMedia(slot).then(data => {
      const box = document.getElementById(previewId);
      if (!box) return;
      if (!data) { box.innerHTML = `<span class="vc-set-ph">${slot === 'bg' ? '未设置背景' : '未设置'}</span>`; return; }
      if (data.mimeType.startsWith('video/')) {
        box.innerHTML = `<video src="${data.dataUrl}" autoplay loop muted playsinline></video>`;
      } else {
        box.innerHTML = `<img src="${data.dataUrl}"/>`;
      }
    });
  }
  renderPreview('bg',       'vcBgPreview');
  renderPreview('selfview', 'vcSvPreview');

  function showTip(msg, ok = true) {
    const t = document.getElementById('vcSetTip');
    if (!t) return;
    t.style.color = ok ? 'rgba(100,220,140,0.8)' : 'rgba(240,100,100,0.8)';
    t.textContent = msg;
    setTimeout(() => { if (t) t.textContent = ''; }, 2200);
  }

  async function handleUpload(slot, file, previewId) {
    if (!file) return;
    if (file.size > 80 * 1024 * 1024) { showTip('文件太大，请选 80MB 以内', false); return; }
    try {
      const dataUrl = await vcReadFile(file);
      await vcSaveMedia(slot, dataUrl, file.type);
      renderPreview(slot, previewId);
      await vcApplySavedMedia();
      showTip('已保存');
    } catch(e) { showTip('保存失败，请重试', false); }
  }

  overlay.querySelector('#vcBgImgBtn').addEventListener('click', () => overlay.querySelector('#vcBgImgInput').click());
  overlay.querySelector('#vcBgVidBtn').addEventListener('click', () => overlay.querySelector('#vcBgVidInput').click());
  overlay.querySelector('#vcBgImgInput').addEventListener('change', e => handleUpload('bg', e.target.files[0], 'vcBgPreview'));
  overlay.querySelector('#vcBgVidInput').addEventListener('change', e => handleUpload('bg', e.target.files[0], 'vcBgPreview'));
  overlay.querySelector('#vcBgDelBtn').addEventListener('click', async () => {
    await vcDeleteMedia('bg');
    const frame = document.querySelector('.vc-frame');
    if (frame) frame.style.background = 'linear-gradient(180deg,#1c1c1c 0%,#222222 20%,#181818 50%,#0f0f0f 80%,#080808 100%)';
    const vid = document.getElementById('vcBgVideo');
    if (vid) vid.remove();
    renderPreview('bg', 'vcBgPreview');
    showTip('背景已清除');
  });

  overlay.querySelector('#vcSvImgBtn').addEventListener('click', () => overlay.querySelector('#vcSvImgInput').click());
  overlay.querySelector('#vcSvVidBtn').addEventListener('click', () => overlay.querySelector('#vcSvVidInput').click());
  overlay.querySelector('#vcSvImgInput').addEventListener('change', e => handleUpload('selfview', e.target.files[0], 'vcSvPreview'));
  overlay.querySelector('#vcSvVidInput').addEventListener('change', e => handleUpload('selfview', e.target.files[0], 'vcSvPreview'));
  overlay.querySelector('#vcSvDelBtn').addEventListener('click', async () => {
    await vcDeleteMedia('selfview');
    const sv = document.querySelector('.vc-self-view');
    if (sv) {
      sv.style.backgroundImage = '';
      sv.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.3" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    }
    renderPreview('selfview', 'vcSvPreview');
    showTip('小框已清除');
  });

  const closeModal = () => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity .18s';
    setTimeout(() => overlay.remove(), 180);
  };
  overlay.querySelector('#vcSetCloseX').addEventListener('click', closeModal);
  overlay.querySelector('#vcSetClosBtn').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
}

/* ================================================================
   9. 拨号等待屏逻辑
================================================================ */

/* ── 拨号屏状态栏时钟（独立，id 前缀 vcd） ── */
function vcdTick() {
  const tz  = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const now = new Date();
  const str = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz
  });
  const el = document.getElementById('vcdTime');
  if (el) el.textContent = str;

  const pct = parseInt(localStorage.getItem('luna_battery') || '76');
  const pe  = document.getElementById('vcdBatPct');
  const ie  = document.getElementById('vcdBatInner');
  if (pe) pe.textContent = pct;
  if (ie) {
    ie.style.width      = pct + '%';
    ie.style.background = pct <= 20
      ? 'linear-gradient(90deg,#f87171,#ef4444)'
      : 'rgba(255,255,255,0.75)';
  }
}

/* ── 拨号屏灵动岛（复刻 applyIsland，指向 vcdIsland） ── */
function vcdApplyIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const el      = document.getElementById('vcdIsland');
  if (!el) return;
  if (!enabled) { el.innerHTML = ''; return; }

  const styleMap = {
    minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
    clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="vcdClockText">--:--</span></div></div>`,
    pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
    ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
    rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
    music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
    scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
  };
  el.innerHTML = styleMap[style] || styleMap.minimal;

  if (style === 'clock') {
    const tick = () => {
      const t = document.getElementById('vcdClockText');
      if (!t) return;
      const n = new Date();
      t.textContent = n.getHours() + ':' + String(n.getMinutes()).padStart(2, '0');
    };
    tick();
  }
}

/* ── 拨号屏初始化 + 接通倒计时 ── */
function vcInitDialScreen() {
  const screen = document.getElementById('vcDialScreen');
  if (!screen) return;

  /* 时钟同步 */
  vcdTick();
  const vcdTickTimer = setInterval(vcdTick, 10000);

  /* 灵动岛 */
  vcdApplyIsland();

  /* 字体同步（复用 applyGlobalFont，作用于整个 document） */
  applyGlobalFont();

  /* 状态文字切换：Calling… → Connecting… */
  const statusEl = document.getElementById('vcdStatusText');
  const statusTimer = setTimeout(() => {
    if (statusEl) {
      statusEl.style.transition = 'opacity 0.4s';
      statusEl.style.opacity    = '0';
      setTimeout(() => {
        if (statusEl) {
          statusEl.textContent = 'Connecting...';
          statusEl.style.opacity = '1';
        }
      }, 420);
    }
  }, 1800);

  /* 拨号屏挂断按钮 */
  const vcdHangup = document.getElementById('vcdHangupBtn');
  if (vcdHangup) {
    vcdHangup.addEventListener('click', () => {
      clearInterval(vcdTickTimer);
      clearTimeout(statusTimer);
      clearTimeout(connectTimer);
      /* 直接回跳 */
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = 'chatroom.html';
      }
    });
  }

  /* 3.5 秒后接通：淡出拨号屏，展示通话页 */
  const connectTimer = setTimeout(() => {
    clearInterval(vcdTickTimer);
    screen.classList.add('vcd-hidden');
    setTimeout(() => {
      screen.remove();
    }, 580);
  }, 3500);
}

/* ================================================================
   10. DOMContentLoaded — 主入口
================================================================ */
document.addEventListener('DOMContentLoaded', async function () {
  /* ── 0. 角色信息同步：从 localStorage 读取当前角色并填充页面 ── */
  vcSyncCharacterInfo();

  /* 同步灵动岛 + 字体（与 chatroom 完全一致） */
  applyIsland();
  await applyGlobalFont();

  /* ✅ 恢复已保存的背景 & 自拍框（刷新后保持） */
  await vcApplySavedMedia();

  /* 先跑拨号屏，不影响通话页在后台初始化 */
  vcInitDialScreen();

  /* 启动通话计时器 */
  vcStartTimer();

  /* 预设消息 */
  vcScheduleMessages();

  /* 挂断按钮 */
  const hangupBtn = document.getElementById('vcHangupBtn');
  if (hangupBtn) hangupBtn.addEventListener('click', vcHangup);

  /* 键盘按钮 */
  const kbBtn = document.getElementById('vcKeyboardBtn');
  if (kbBtn) kbBtn.addEventListener('click', vcBuildKeyboard);

  /* 设置按钮 */
  const setBtn = document.getElementById('vcSettingsBtn');
  if (setBtn) setBtn.addEventListener('click', vcBuildSettings);
});

/* ================================================================
   11. 跨页面 storage 同步（与 chatroom 完全一致）
================================================================ */
window.addEventListener('storage', function (e) {
  if (e.key === 'luna_font_update' || e.key === 'luna_font_style') applyGlobalFont();
  if (e.key === 'luna_island_update' || e.key === 'luna_island_enabled' || e.key === 'luna_island_style') applyIsland();
  if (e.key === 'luna_tz_update') vcTick();
});

window.addEventListener('pageshow', function (e) {
  if (e.persisted) window.location.reload();
});