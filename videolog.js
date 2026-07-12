/* ================================================================
   videolog.js — 视频通话记录：数据层 + 居中弹窗 + 独立列表/详情页
   ------------------------------------------------------------------
   这个文件做两件事，两件事共用同一套数据读取逻辑：

   1) 【聊天室里点开那条灰色"视频通话"小条 → 居中弹窗】
      chatroom.js 里的 crBuildVideoCallLogEl 在小条可点击时会调用
      window.vcOpenLogModal(logId)，本文件负责弹出一个居中的模态框，
      按 id 查 LunaChatDB.videoLogs，把完整转录渲染出来。
      这个函数只需要 videolog.js + videolog.css 被 <script>/<link> 引入
      到 chatroom.html 里即可使用，不需要跳转页面。

   2) 【独立的"视频记录"列表/详情页 —— videolog.html】
      给"记录管理"页那个"视频记录"入口用：以角色为单位，列出这个角色
      名下所有已存档的通话，点进某一条展示完整转录。用同一份 CSS
      （videolog.css）、同一份数据读取函数，只是渲染进 videolog.html
      自己的 DOM 结构里，不是弹窗。

   两边都不重复实现"怎么读库""怎么把一条 transcript 渲染成对话气泡"，
   全部收在下面的公共函数里，靠 DOM 容器不同来区分渲染目标。
================================================================ */

/* ----------------------------------------------------------------
   0. 自动注入 videolog.css（如果宿主页面还没引入的话）
      这样 chatroom.html 只需要引入 videolog.js 一个 <script> 标签，
      不用额外记得手动加 <link>，减少接线出错的可能。
      videolog.html 会自己在 <head> 里正常 <link>，这里的自动注入
      逻辑会检测到已存在而跳过，不会重复加载。
---------------------------------------------------------------- */
(function ensureVideologCss() {
  if (document.querySelector('link[data-videolog-css]')) return;
  const link = document.createElement('link');
  link.rel  = 'stylesheet';
  link.href = 'videolog.css';
  link.setAttribute('data-videolog-css', '1');
  document.head.appendChild(link);
})();

/* ----------------------------------------------------------------
   0.5 状态栏同步 —— 只在独立页面（videolog.html）里跑：真实时钟、电量、
       灵动岛，读取的 localStorage 键和 chatroom.js / videocall.js 完全
       一致（luna_tz / luna_battery / luna_island_enabled /
       luna_island_style），这样从聊天页跳过来状态栏不会"跳变"，观感是
       同一部手机而不是切换到了另一个网页。
---------------------------------------------------------------- */
function vlTick() {
  const timeEl = document.getElementById('vlTime');
  if (!timeEl) return; /* 弹窗场景（chatroom.html）没有这个元素，静默跳过 */
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const n  = new Date();
  timeEl.textContent = n.toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz
  });

  const pct     = parseInt(localStorage.getItem('luna_battery') || '76');
  const pctEl   = document.getElementById('vlBatPct');
  const innerEl = document.getElementById('vlBatInner');
  if (pctEl)   pctEl.textContent = pct;
  if (innerEl) {
    innerEl.style.width      = pct + '%';
    innerEl.style.background = pct <= 20
      ? 'linear-gradient(90deg,#f87171,#ef4444)'
      : '#161616';
  }
}

function vlApplyIsland() {
  const el = document.getElementById('vlIsland');
  if (!el) return;
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  if (!enabled) { el.innerHTML = ''; return; }

  const styleMap = {
    minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
    clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="vlIslandClock">--:--</span></div></div>`,
    pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
    ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
    rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
    music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
    scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
  };
  el.innerHTML = styleMap[style] || styleMap.minimal;

  if (style === 'clock') {
    const t = document.getElementById('vlIslandClock');
    if (t) {
      const n = new Date();
      t.textContent = n.getHours() + ':' + String(n.getMinutes()).padStart(2, '0');
    }
  }
}

(function vlInitStatusBar() {
  if (!document.getElementById('vlTime')) return; /* 不在独立页面里，跳过 */
  vlTick();
  vlApplyIsland();
  setInterval(vlTick, 10000);
  window.addEventListener('storage', function (e) {
    if (e.key === 'luna_tz_update') vlTick();
    if (e.key === 'luna_island_update' || e.key === 'luna_island_enabled' || e.key === 'luna_island_style') vlApplyIsland();
  });
})();

/* ----------------------------------------------------------------
   1. LunaChatDB 打开入口 —— 和 chatroom.js / videocall.js 完全一致的
      实现，第三次独立复制。三个文件互相之间不 import 彼此，只能这样
      各自内联一份，保证任何一个页面单独打开时都能正常工作。
      store 列表必须和另外两份严格保持同步（尤其是新增的 videoLogs）。
---------------------------------------------------------------- */
const VL_STORES = {
  conv:     { keyPath: 'name' },
  friends:  { keyPath: 'name' },
  messages: { keyPath: 'chatKey' },
  memes:    { keyPath: 'id' },
  rewindFeedback: { keyPath: 'name' },
  videoLogs: { keyPath: 'id', autoIncrement: true },
};

function vlOpenChatDB() {
  return new Promise((res, rej) => {
    const probe = indexedDB.open('LunaChatDB');
    probe.onsuccess = e => {
      const db = e.target.result;
      const currentVer = db.version;
      const missing = Object.keys(VL_STORES).filter(name => !db.objectStoreNames.contains(name));
      db.close();

      if (missing.length === 0) {
        const reopen = indexedDB.open('LunaChatDB', currentVer);
        reopen.onsuccess = e2 => res(e2.target.result);
        reopen.onerror   = () => rej();
      } else {
        const upgrade = indexedDB.open('LunaChatDB', currentVer + 1);
        upgrade.onupgradeneeded = e2 => {
          const udb = e2.target.result;
          missing.forEach(name => {
            if (!udb.objectStoreNames.contains(name)) udb.createObjectStore(name, VL_STORES[name]);
          });
        };
        upgrade.onsuccess = e2 => res(e2.target.result);
        upgrade.onerror   = () => rej();
      }
    };
    probe.onerror = e => rej(e.target.error);
  });
}

/* 按 id 查单条通话记录 */
async function vlGetLogById(id) {
  if (id === undefined || id === null) return null;
  try {
    const db = await vlOpenChatDB();
    return await new Promise(res => {
      const r = db.transaction('videoLogs').objectStore('videoLogs').get(id);
      r.onsuccess = () => res(r.result || null);
      r.onerror   = () => res(null);
    });
  } catch (e) { return null; }
}

/* 查某个角色名下所有通话记录，按结束时间倒序（最新的在前） */
async function vlGetLogsByChar(chatKey) {
  try {
    const db = await vlOpenChatDB();
    const all = await new Promise(res => {
      const r = db.transaction('videoLogs').objectStore('videoLogs').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror   = () => res([]);
    });
    return all
      .filter(rec => rec.chatKey === chatKey)
      .sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));
  } catch (e) { return []; }
}

/* 删除一条通话记录（列表页里做"删除"操作用） */
async function vlDeleteLog(id) {
  try {
    const db = await vlOpenChatDB();
    const tx = db.transaction('videoLogs', 'readwrite');
    tx.objectStore('videoLogs').delete(id);
    return true;
  } catch (e) { return false; }
}

/* ----------------------------------------------------------------
   2. 工具函数：时长/日期格式化、动作片段解析（和 videocall.js 里的
      vcParseSegments 规则完全一致，回放转录时也要认得 *动作描写* 这种
      格式，不然存档里带星号的动作文本会原样显示出来，很难看）
---------------------------------------------------------------- */
function vlFormatDuration(ms) {
  const totalSec = Math.floor((ms || 0) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function vlFormatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${day} ${h}:${mi}`;
}

function vlStatusLabel(rec) {
  if (!rec) return '';
  if (rec.status === 'cancelled') return '未接通（已取消）';
  if (rec.status === 'declined')  return '已拒绝';
  if (rec.status === 'missed')    return '未接听';
  return '通话时长 ' + vlFormatDuration(rec.duration);
}

function vlEscHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* 与 videocall.js 的 vcParseSegments 保持一致的规则：
   *动作* 或 （动作）/(动作) 视为动作/心理描写，其余是台词原文 */
function vlParseSegments(text) {
  const segments = [];
  if (!text) return segments;
  const re = /\*([^*]+)\*|（([^（）]+)）|\(([^()]+)\)/g;
  let lastIndex = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      const spoken = text.slice(lastIndex, m.index);
      if (spoken.trim()) segments.push({ type: 'speech', text: spoken.trim() });
    }
    const action = (m[1] || m[2] || m[3] || '').trim();
    if (action) segments.push({ type: 'action', text: action });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    const rest = text.slice(lastIndex);
    if (rest.trim()) segments.push({ type: 'speech', text: rest.trim() });
  }
  if (!segments.length && text.trim()) segments.push({ type: 'speech', text: text.trim() });
  return segments;
}

/* ----------------------------------------------------------------
   3. 把一条 transcript 记录（{role,text,translated,time}）渲染成
      详情视图里的一段 DOM —— 弹窗和独立页面共用这一个函数，样式
      靠 CSS 类名统一，不需要各写一份。
---------------------------------------------------------------- */
function vlBuildTranscriptLineEl(entry, charName) {
  const isLuna = entry.role === 'luna';
  const wrap = document.createElement('div');
  wrap.className = isLuna ? 'vl-msg-luna' : 'vl-msg-you';

  if (isLuna) {
    const tag = document.createElement('span');
    tag.className = 'vl-line-speaker';
    tag.textContent = charName || 'Luna';
    wrap.appendChild(tag);
  }

  const segs = vlParseSegments(entry.text);
  segs.forEach(seg => {
    const lineEl = document.createElement('div');
    lineEl.className = (isLuna ? 'vl-line-luna' : 'vl-line-you') +
      (seg.type === 'action' ? ' vl-line-is-action' : '');
    const s = document.createElement('span');
    s.className = seg.type === 'action' ? 'vl-seg-action' : 'vl-seg-speech';
    s.textContent = seg.text;
    lineEl.appendChild(s);
    wrap.appendChild(lineEl);
  });

  if (isLuna && entry.translated) {
    const transEl = document.createElement('div');
    transEl.className = 'vl-trans-line';
    transEl.textContent = entry.translated;
    wrap.appendChild(transEl);
  }

  const ts = document.createElement('span');
  ts.className = 'vl-ts';
  ts.textContent = entry.time || '';
  wrap.appendChild(ts);

  return wrap;
}

/* 把整条记录（含头部摘要信息 + 完整转录）渲染进任意一个容器元素。
   thoughtLoading 为 true 时，心声区域显示"生成中"占位，用于 vcOpenLogModal
   自动生成心声时先展示一个过渡态，避免用户看到"什么都没有"以为没这功能。 */
function vlRenderLogDetail(container, rec, thoughtLoading) {
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'vl-detail-header';
  header.innerHTML =
    '<div class="vl-detail-date">' + vlEscHtml(vlFormatDate(rec.startedAt)) + '</div>' +
    '<div class="vl-detail-status">' + vlEscHtml(vlStatusLabel(rec)) + '</div>' +
    '<div class="vl-detail-meta">' +
      '<span class="vl-detail-tag">' + (rec.initiator === 'luna' ? '对方发起' : '我方发起') + '</span>' +
      (rec.reason ? '<span class="vl-detail-reason">' + vlEscHtml(rec.reason) + '</span>' : '') +
    '</div>';
  container.appendChild(header);

  if (rec.thought) {
    const thoughtEl = document.createElement('div');
    thoughtEl.className = 'vl-detail-thought';
    thoughtEl.innerHTML = '<span class="vl-detail-thought-label">Ta的心声</span>' + vlEscHtml(rec.thought);
    container.appendChild(thoughtEl);
  } else if (thoughtLoading) {
    const thoughtEl = document.createElement('div');
    thoughtEl.className = 'vl-detail-thought vl-detail-thought-loading';
    thoughtEl.id = 'vlDetailThoughtSlot';
    thoughtEl.innerHTML = '<span class="vl-detail-thought-label">Ta的心声</span>……';
    container.appendChild(thoughtEl);
  }

  const body = document.createElement('div');
  body.className = 'vl-detail-body';

  if (!rec.transcript || !rec.transcript.length) {
    const empty = document.createElement('div');
    empty.className = 'vl-detail-empty';
    empty.textContent = '这通电话没有留下对话内容';
    body.appendChild(empty);
  } else {
    rec.transcript.forEach(entry => {
      body.appendChild(vlBuildTranscriptLineEl(entry, rec.charName));
    });
  }

  container.appendChild(body);
}

/* ================================================================
   4. 居中弹窗 —— 供 chatroom.js 点击聊天气泡里的通话小条时调用
================================================================ */
let _vlModalOpen = false;

async function vcOpenLogModal(logId) {
  if (_vlModalOpen) return;
  _vlModalOpen = true;

  const overlay = document.createElement('div');
  overlay.className = 'vl-modal-overlay';
  overlay.innerHTML =
    '<div class="vl-modal-card">' +
      '<div class="vl-modal-topbar">' +
        '<span class="vl-modal-title">通话记录</span>' +
        '<button class="vl-modal-close" type="button" aria-label="关闭">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="vl-modal-content" id="vlModalContent">' +
        '<div class="vl-detail-loading">加载中…</div>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('vl-modal-show')));

  function closeModal() {
    overlay.classList.remove('vl-modal-show');
    overlay.classList.add('vl-modal-hide');
    setTimeout(() => { overlay.remove(); _vlModalOpen = false; }, 220);
  }
  overlay.querySelector('.vl-modal-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  const content = overlay.querySelector('#vlModalContent');
  const rec = await vlGetLogById(logId);

  if (!rec) {
    content.innerHTML = '<div class="vl-detail-empty">记录不可用，可能已被删除</div>';
    return;
  }

  /* 只有真正说上话的通话（'ended'）才有"心声"可言，'cancelled' 这种没
     接通的记录没有转录，也谈不上事后回味，不需要触发生成。
     window.crGetOrGenerateCallThought 是 chatroom.js 里定义、显式挂到
     window 上的函数（懒加载 + 缓存写回 videoLogs.thought）；这里直接
     复用同一套生成逻辑，不重复实现一份 —— 弹窗打开时如果发现还没有
     缓存，就自动触发一次生成，不用非要先跑去聊天室里对灰条做右滑手势
     才能看到心声，这是用户实际使用中最容易预期"点开详情就该看到"的
     入口，右滑那套留着做惊喜式的快速预览，两者互不排斥、共享同一份
     缓存。videolog.html 独立页面场景下 chatroom.js 未加载，该函数不
     存在时优雅跳过，不报错、只是不自动生成。 */
  const needsThought = !rec.thought && rec.vcLogStatus !== 'cancelled' &&
                        typeof window.crGetOrGenerateCallThought === 'function';

  vlRenderLogDetail(content, rec, needsThought);

  if (needsThought) {
    const text = await window.crGetOrGenerateCallThought(logId);
    if (text) rec.thought = text;
    /* 弹窗可能在生成期间已经被关闭，content 节点已从 DOM 摘除，
       这里只是往一个脱离文档的节点里写内容，不会报错也不会误显示，
       但仍加个存在性判断更清楚意图。 */
    if (document.body.contains(overlay)) {
      vlRenderLogDetail(content, rec, false);
    }
  }
}

/* 显式挂到 window，供 chatroom.js 跨文件调用 */
window.vcOpenLogModal = vcOpenLogModal;

/* ================================================================
   5. 独立列表/详情页逻辑 —— 只在 videolog.html 里跑，chatroom.html
      不会触发这一段（因为下面的初始化靠检测页面里是否存在对应的
      DOM 容器 id 来决定要不要跑，chatroom.html 里没有这些容器，
      所以在那边这段代码什么都不会做，可以放心让两边共用同一个 .js）
================================================================ */
function vlCharacterId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('char')
      || localStorage.getItem('luna_current_chat')
      || localStorage.getItem('luna_active_character')
      || 'luna';
}

async function vlInitListPage() {
  const listEl = document.getElementById('vlList');
  if (!listEl) return; /* 不在 videolog.html 页面里，跳过 */

  const detailScreen = document.getElementById('vlDetailScreen');
  const listScreen    = document.getElementById('vlListScreen');
  const detailContent = document.getElementById('vlDetailContent');
  const backBtn        = document.getElementById('vlBackBtn');
  const nameEl          = document.getElementById('vlCharName');

  const charName = vlCharacterId();
  if (nameEl) nameEl.textContent = charName;

  async function refreshList() {
    const logs = await vlGetLogsByChar(charName);
    listEl.innerHTML = '';

    if (!logs.length) {
      const empty = document.createElement('div');
      empty.className = 'vl-list-empty';
      empty.textContent = '还没有通话记录';
      listEl.appendChild(empty);
      return;
    }

    logs.forEach((rec, i) => {
      const row = document.createElement('div');
      row.className = 'vl-list-row';
      const idxLabel = String(i + 1).padStart(2, '0');
      const initiatorLabel = rec.initiator === 'luna' ? '对方发起' : '我方发起';
      row.innerHTML =
        '<div class="vl-list-index">' + idxLabel + '</div>' +
        '<div class="vl-list-icon">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none">' +
            '<rect x="2" y="6" width="14" height="12" rx="3" stroke="currentColor" stroke-width="1.6"/>' +
            '<path d="M16 10.5L22 7v10l-6-3.5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
          '</svg>' +
        '</div>' +
        '<div class="vl-list-main">' +
          '<div class="vl-list-status">' + vlEscHtml(vlStatusLabel(rec)) + '</div>' +
          '<div class="vl-list-date">' + vlEscHtml(vlFormatDate(rec.startedAt)) + '</div>' +
          '<span class="vl-list-tag">' + initiatorLabel + '</span>' +
        '</div>' +
        '<div class="vl-list-chevron">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>' +
        '</div>' +
        '<button class="vl-list-del" type="button" aria-label="删除" data-id="' + rec.id + '">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>' +
        '</button>';

      row.addEventListener('click', (e) => {
        if (e.target.closest('.vl-list-del')) return;
        openDetail(rec);
      });
      row.querySelector('.vl-list-del').addEventListener('click', async (e) => {
        e.stopPropagation();
        await vlDeleteLog(rec.id);
        refreshList();
      });

      listEl.appendChild(row);
    });
  }

  function openDetail(rec) {
    if (!detailScreen || !listScreen || !detailContent) return;
    vlRenderLogDetail(detailContent, rec);
    listScreen.classList.add('vl-screen-hidden');
    detailScreen.classList.remove('vl-screen-hidden');
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      detailScreen.classList.add('vl-screen-hidden');
      listScreen.classList.remove('vl-screen-hidden');
    });
  }

  await refreshList();
}

document.addEventListener('DOMContentLoaded', vlInitListPage);