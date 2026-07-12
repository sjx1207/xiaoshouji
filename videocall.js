/* ================================
   Video Call — videocall.js
   与 chatroom 完全同步：状态栏 / 灵动岛 / 字体
================================ */

/* ---- LunaCharDB 统一打开入口（与 chatroom.js 完全一致的实现，独立复制一份，
        因为 videocall.html 不加载 chatroom.js，需要自包含） ---- */
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

/* ---- LunaChatDB 统一打开入口（与 chatroom.js getCrDB 完全一致的实现，独立复制一份，
        因为 videocall.html 不加载 chatroom.js，需要自包含）。
        用于挂断后把「通话记录」灰色提示行写回聊天记录，让 chatroom.js 刷新时能读到。 ---- */
const LUNA_CHAT_STORES = {
  conv:     { keyPath: 'name' },
  friends:  { keyPath: 'name' },
  messages: { keyPath: 'chatKey' },
  memes:    { keyPath: 'id' },
  rewindFeedback: { keyPath: 'name' },
  /* 与 chatroom.js 的 LUNA_STORES 完全一致，必须两边同步维护，
     否则谁先打开 LunaChatDB 谁说了算，另一边就会缺 store。 */
  videoLogs: { keyPath: 'id', autoIncrement: true },
};

function openLunaChatDB() {
  return new Promise((res, rej) => {
    const probe = indexedDB.open('LunaChatDB');
    probe.onsuccess = e => {
      const db = e.target.result;
      const currentVer = db.version;
      const missing = Object.keys(LUNA_CHAT_STORES).filter(name => !db.objectStoreNames.contains(name));
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
            if (!udb.objectStoreNames.contains(name)) udb.createObjectStore(name, LUNA_CHAT_STORES[name]);
          });
        };
        upgrade.onsuccess = e2 => res(e2.target.result);
        upgrade.onerror   = () => rej();
      }
    };
    probe.onerror = e => rej(e.target.error);
  });
}

/* 读取某角色的消息数组 */
async function vcLoadChatMessages(name) {
  try {
    const db = await openLunaChatDB();
    return await new Promise(res => {
      const r = db.transaction('messages').objectStore('messages').get(name);
      r.onsuccess = () => res(r.result ? r.result.msgs : []);
      r.onerror   = () => res([]);
    });
  } catch (e) { return []; }
}

/* 保存某角色的消息数组 */
async function vcSaveChatMessages(name, msgs) {
  try {
    const db = await openLunaChatDB();
    const tx = db.transaction('messages', 'readwrite');
    tx.objectStore('messages').put({ chatKey: name, msgs });
  } catch (e) {}
}

/* ── 把聊天室里的持久化历史消息转成 API messages 格式 ──
   之前的问题：视频通话只用 VC_HISTORY（本次通话内的临时数组，从零开始）
   当作上下文喂给模型，完全不知道你们在聊天室里之前聊过什么，导致角色一
   接通视频说的话和实际聊天记录"牛头不对马嘴"。
   这个函数是 chatroom.js 里 crBuildApiMessages 的精简版（不跨文件依赖，
   videocall.html 不会加载 chatroom.js），只覆盖视频通话场景下最常见、
   最重要的消息类型：普通文字、语音、视频通话邀约/记录。转账、红包、位置、
   图片这类小概率类型简化成通用占位描述，不逐一还原每个字段，因为视频通话
   开场更需要"大致记得聊了什么、气氛如何"，不需要逐字复刻聊天室的展示细节。 */
function vcBuildChatContextMessages(historyMsgs, limit) {
  const recent = (historyMsgs || []).slice(-(limit || 20));
  return recent.map(m => {
    let content;
    if (m.isVideoCallLog) {
      content = m.vcLogStatus === 'declined'
        ? `（系统备注，仅供你理解上下文，不是你说过的话：你之前发起的视频通话被用户拒绝了，理由是"${m.vcLogReason || ''}"）`
        : m.vcLogStatus === 'missed'
        ? `（系统备注，仅供你理解上下文，不是你说过的话：你之前发起的视频通话，用户没有接听，理由是"${m.vcLogReason || ''}"）`
        : m.vcLogStatus === 'cancelled'
        ? `（系统备注，仅供你理解上下文，不是你说过的话：有一次视频通话被取消了，没有实际接通）`
        : `（系统备注，仅供你理解上下文，不是你说过的话：你和用户之前进行过一次视频通话，时长${vlFormatDurationSafe(m.vcLogDuration)}）`;
    } else if (m.isVideoInvite) {
      content = `（系统备注，仅供你理解上下文，不是你说过的话：你之前主动发起过一次视频通话邀约，理由是"${m.vcReason || ''}"）`;
    } else if (m.isVoice && m.role === 'mine') {
      content = `[语音]：${m.voiceText || m.text || ''}`;
    } else if (m.isVoice) {
      content = m.voiceText || m.text || '';
    } else if (m.imageUrl) {
      content = m.imageDesc
        ? `[用户发送了一张图片，图片内容描述如下：${m.imageDesc}]`
        : '[用户发送了一张图片]';
    } else if (m.isLocation) {
      content = `[用户分享了一个位置：${m.locName || ''}]`;
    } else if (m.isTransfer) {
      content = m.role === 'mine'
        ? `[用户发起了一笔转账：金额¥${m.trAmt}，当前状态：${m.trStatus === 'accepted' ? '已被接受' : m.trStatus === 'declined' ? '已被拒绝' : '待确认'}]`
        : `[你（${window._vcCharName || ''}）发起了一笔转账请求：金额¥${m.trAmt}]`;
    } else if (m.isHongbao) {
      content = m.role === 'mine'
        ? `[用户发了一个红包：金额¥${m.hbAmt}]`
        : `[你（${window._vcCharName || ''}）发了一个红包]`;
    } else {
      content = m.text || '';
    }
    return { role: m.role === 'mine' ? 'user' : 'assistant', content };
  }).filter(m => m.content);
}

/* vcBuildChatContextMessages 里格式化通话时长要用到，videolog.js 可能未
   加载（比如以后有页面只引入 videocall.js），这里独立写一份极简实现，
   不依赖 vlFormatDuration，避免跨文件函数不存在时静默出错。 */
function vlFormatDurationSafe(ms) {
  const totalSec = Math.floor((ms || 0) / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

/* ── 把本次通话的完整转录存进 videoLogs 表，返回新记录的 id（存库失败则
   返回 null）。这是「通话记录」功能的数据源：聊天气泡里那条灰色小条只是
   一个入口，真正的逐句转录内容存在这里，点开小条时按 id 查出来渲染。 ── */
async function vcSaveVideoLog(info) {
  try {
    const db = await openLunaChatDB();
    const name = vcCharacterId();
    const record = {
      chatKey:    name,
      charName:   window._vcCharName || name,
      startedAt:  info.startedAt || Date.now(),
      endedAt:    Date.now(),
      duration:   info.duration || 0,
      status:     info.status || 'ended',      /* 'ended' | 'declined' | 'missed' | 'cancelled' */
      reason:     info.reason || '',
      initiator:  info.initiator || 'luna',     /* 'luna' | 'mine' */
      transcript: info.transcript || []          /* [{role,text,translated,time}] */
    };
    return await new Promise((resolve) => {
      const tx = db.transaction('videoLogs', 'readwrite');
      const req = tx.objectStore('videoLogs').add(record);
      req.onsuccess = () => resolve(req.result); /* 返回自增 id */
      req.onerror   = () => resolve(null);
    });
  } catch (e) { return null; }
}

/* 把本次通话的结果追加为一条「通话记录」消息（灰色居中提示行），
   写入的字段结构必须和 chatroom.js 的 crAppendVideoCallLog 完全一致，
   这样 chatroom.js 用 crBuildVideoCallLogEl 恢复历史时才能正确渲染。
   多出的 vcLogId 字段指向 videoLogs 表里那条完整转录记录，供点击这条
   小灰条时查出完整内容渲染成弹窗。 */
async function vcAppendCallLogToChat(info) {
  const name = vcCharacterId();

  /* 先把完整转录存档，拿到 id 再写聊天气泡，这样气泡从落库那一刻起
     就带着可用的 vcLogId，不会出现"气泡已经在但记录还没存好"的空窗期 */
  const logId = await vcSaveVideoLog(info);

  const msgs = await vcLoadChatMessages(name);
  const n = new Date();
  const t = n.getHours().toString().padStart(2, '0') + ':' + n.getMinutes().toString().padStart(2, '0');
  msgs.push({
    role: 'luna',
    text: '',
    isVideoCallLog: true,
    vcLogStatus: info.status || 'ended',
    vcLogDuration: info.duration || 0,
    vcLogReason: info.reason || '',
    vcLogInitiator: info.initiator || 'luna',
    vcLogId: logId,   /* null 表示存档失败，点击时会提示"记录不可用"而不是崩溃 */
    time: t
  });
  await vcSaveChatMessages(name, msgs);
}

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
 * VC_MESSAGES 已清空写死内容，历史回放/打招呼改由 vcAiReply() 系列真实逻辑驱动。
 * 格式参考（如仍需脚本化演出可用）：{ role: 'luna'|'you', text: '...', delay: ms }
 */
const VC_MESSAGES = []; // 留空，由后续逻辑填充

function vcNow() {
  const n = new Date();
  return String(n.getHours()).padStart(2,'0') + ':' + String(n.getMinutes()).padStart(2,'0');
}

/* ================================================================
   5.0 双语模式 — 与 chatroom.js 的 crGetBilingualConfig / crLangTagShort
        保持完全一致的读取与语言标签逻辑，读同一个 localStorage 键
        luna_bilingual，这样文字聊天和视频通话的双语设置是同一份配置，
        不需要用户在两个地方分别开启。
================================================================ */
function vcGetBilingualConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('luna_bilingual') || '{}');
    return {
      on: saved.mode === 'on',
      lang: saved.lang || '粤语',
      langSub: saved.langSub || 'Cantonese',
      style: saved.style === 'outer' ? 'outer' : 'inner'
    };
  } catch (e) {
    return { on: false, lang: '粤语', langSub: 'Cantonese', style: 'inner' };
  }
}

function vcLangTagShort(lang) {
  const map = {
    '粤语':'粤', '普通话':'普', '闽南语':'闽', '客家话':'客', '上海话':'沪', '四川话':'川',
    '英语':'EN', '日语':'日', '韩语':'韩', '法语':'FR', '德语':'DE', '西班牙语':'ES',
    '葡萄牙语':'PT', '意大利语':'IT', '俄语':'RU', '泰语':'TH', '越南语':'VN',
    '印尼语':'ID', '阿拉伯语':'AR', '土耳其语':'TR'
  };
  return map[lang] || (lang ? lang.slice(0,1) : '译');
}

/* ================================================================
   5.1 文本渲染：把一条 AI 台词拆成「说话」与「动作/心理」两种片段
   -----------------------------------------------------------------
   规则：*...* 或 （...）/(...) 包裹的内容视为动作、神情、心理描写，
   用不同的视觉样式渲染（斜体、变暗、无引号），其余文字视为角色
   直接说出口的话。一条消息里可以混合出现多个片段，按原始顺序渲染。
================================================================ */
function vcParseSegments(text) {
  const segments = [];
  if (!text) return segments;
  /* 匹配 *动作* 或 （动作）/(动作)，非贪婪，允许中英文标点 */
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

/* ── 渲染一条消息：不再用气泡，改用「直播字幕 / 转录条」样式 ──
   luna 一侧：说话文字直排、动作心理用斜体旁白样式区分
   you   一侧：保持简洁的右对齐说话条，同样支持动作片段解析
   translated：双语模式开启时，角色台词对应的中文翻译（可为 null）。
   只在 role === 'luna' 且双语打开时才会用到；渲染成紧贴在原话下方的
   半透明小字，带语言标签，风格与 chatroom 文字聊天里的双语气泡呼应，
   让用户在视频通话的转录条里也能看懂角色说的外语原话。 */
function vcAppendMessage(role, text, translated) {
  const area = document.getElementById('vcMessages');
  if (!area) return;

  const isLuna = role === 'luna';
  const wrap   = document.createElement('div');
  wrap.className = isLuna ? 'vc-msg-luna' : 'vc-msg-you';

  if (isLuna) {
    const tag = document.createElement('span');
    tag.className = 'vc-line-speaker';
    tag.textContent = (window._vcCharName || 'Luna');
    wrap.appendChild(tag);
  }

  /* 每个 segment（说话 / 动作）各自独立成一行，而不是全部塞进同一段文字里
     用 span 挨着排——原来的写法会让"说话+动作+说话+动作"挤成一大坨看不清
     谁说了什么、哪句是心理描写，现在改成一句一行，读起来才是真人对话/
     镜头描写交替出现的节奏，观感上也更清爽不拥挤。 */
  const segs = vcParseSegments(text);
  segs.forEach(seg => {
    const lineEl = document.createElement('div');
    lineEl.className = (isLuna ? 'vc-line-luna' : 'vc-line-you') +
      (seg.type === 'action' ? ' vc-line-is-action' : '');
    const s = document.createElement('span');
    s.className = seg.type === 'action' ? 'vc-seg-action' : 'vc-seg-speech';
    s.textContent = seg.text;
    lineEl.appendChild(s);
    wrap.appendChild(lineEl);
  });

  /* 双语翻译行：只在 luna 一侧、且确实有译文时渲染 */
  if (isLuna && translated) {
    const bl = vcGetBilingualConfig();
    const tag = vcLangTagShort(bl.lang);
    const transEl = document.createElement('div');
    transEl.className = 'vc-trans-line';
    const transText = document.createElement('span');
    transText.className = 'vc-trans-text';
    transText.textContent = translated;
    const transTag = document.createElement('span');
    transTag.className = 'vc-trans-tag';
    transTag.textContent = tag;
    transEl.appendChild(transText);
    transEl.appendChild(transTag);
    wrap.appendChild(transEl);
  }

  const ts = document.createElement('span');
  ts.className   = 'vc-ts';
  ts.textContent = vcNow();

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
   5.2 视频通话 AI 逻辑 — 与 chatroom.js 的 crCallApi / crBuildSystemPrompt
        同一套 API 配置（复用 luna_api_current / luna_api_model），
        但 system prompt 单独为「视频通话场景」设计：
        · 允许、鼓励输出动作/神情/心理描写（用 *…* 包裹）
        · 语气更即时口语化（面对面说话感），弱化文字聊天的分行规则
================================================================ */

/* 通话历史（仅本次通话内，独立于 chatroom 的文字聊天记录）——
   这份只保留 role/content，专门喂给 API 当上下文，超过40条会被截断，
   不能拿来做"完整通话记录"的持久化来源。 */
let VC_HISTORY = [];

/* 完整转录（用于挂断后存档到 videoLogs，供后续查看"通话记录"用）——
   和 VC_HISTORY 分开维护，不做截断、保留时间戳和双语翻译文本，
   字段结构直接对应渲染时用到的东西，方便记录详情页原样回放。 */
let VC_TRANSCRIPT = [];

/* 把已经渲染过的 VC_MESSAGES（如果有预置演出）也计入历史，便于后续对话保持上下文 */
function vcHistoryPush(role, text) {
  VC_HISTORY.push({ role: role === 'luna' ? 'assistant' : 'user', content: text });
  if (VC_HISTORY.length > 40) VC_HISTORY = VC_HISTORY.slice(-40);
}

/* 记录一条完整转录（供存档用，不受40条上限影响） */
function vcTranscriptPush(role, text, translated) {
  VC_TRANSCRIPT.push({
    role,                         /* 'luna' | 'you' */
    text: text || '',
    translated: translated || null,
    time: vcNow()
  });
}

/* ── 读取角色资料（复用 chatroom.js 暴露的 openLunaCharDB） ── */
async function vcLoadCharProfile(name) {
  try {
    const db = await openLunaCharDB();
    if (!db.objectStoreNames.contains('chars')) return null;
    const all = await new Promise(res => {
      const r = db.transaction('chars').objectStore('chars').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror   = () => res([]);
    });
    return all.find(c => c.name === name) || null;
  } catch (e) { return null; }
}

/* ── 构建视频通话专属 system prompt ── */
function vcBuildSystemPrompt(char, reason) {
  const name    = (char && char.name)    || window._vcCharName || 'Luna';
  const role    = (char && char.role)    || '';
  const persona = (char && (char.persona || char.description || char.desc)) || '';
  const traits  = (char && (char.traits || char.personality)) || '';
  const bg      = (char && (char.background || char.story)) || '';

  const reasonNote = reason
    ? `\n【本次通话的由头】是你自己主动提出想视频，理由是："${reason}"。接通后先用这个由头很自然地开口，不要生硬复述这句话本身。`
    : `\n【本次通话的由头】是对方主动点开了视频通话，你刚刚接通，看到了对方。你不需要抢先开口，等对方先说话，你再自然地回应（除非对方已经先说了些什么，那你就正常接话）。`;

  /* 双语模式：读取和文字聊天完全一致的 luna_bilingual 配置，规则同步过来，
     只是把「不要用 [IMAGE] 等特殊标签」那条从文字聊天版里去掉，因为视频
     通话场景本来就不用那些标签。 */
  const bl = vcGetBilingualConfig();
  const bilingualRule = !bl.on ? ''
    : bl.lang === '普通话'
    ? ''
    : `\n9. 【双语模式 — 必须严格遵守】用户已开启双语模式，角色语言设定为「${bl.lang}（${bl.langSub}）」。从现在起，你说出口的每一句台词（星号包裹的动作/心理描写除外，那部分永远只用中文写），都必须用「${bl.lang}」本身作为你说的原话，然后紧跟英文双竖线 || ，再写这句话对应的中文翻译，格式死规定：${bl.lang}原话||中文翻译，例如目标语言是泰语时→ อยู่บ้านเบื่อๆ เปิดหนังดูอยู่||在家无聊呢，刚打开部电影 ←两侧禁止加空格、禁止用中文竖线｜、禁止用单竖线|、禁止省略||、禁止把中文写在前面。「${bl.lang}」部分要写得自然地道，符合真人说话的语气和口语习惯，不要生硬逐字翻译；中文翻译部分只是给用户看的辅助理解。一条回复内如果有多句台词，每一句独立的台词都要各自带上 || 中文翻译，不能漏掉。动作/心理描写（星号内的部分）不受此规则影响，永远只写中文，不需要翻译、不需要 || 。`;

  return `你现在扮演「${name}」，一个真实存在的人，绝对不是 AI 或助手。此刻你正在和对方进行实时视频通话，你们可以互相看到彼此、听到彼此说话。

【角色身份】
名字：${name}
${role    ? `定位：${role}`        : ''}
${persona ? `人物简介：${persona}` : ''}
${traits  ? `性格特点：${traits}`  : ''}
${bg      ? `背景故事：${bg}`      : ''}
${reasonNote}

【视频通话说话规则 — 必须严格遵守，和普通文字聊天不同】
1. 你就是 ${name}，有血有肉、有情绪、有表情、有肢体动作，永远不承认自己是 AI。
2. 这是视频通话，是面对面即时说话的场景，语气要比打字聊天更松弛、更即兴，可以有语气词、停顿、笑声。
3. 【动作与心理描写 — 这里必须使用，和文字聊天规则相反】因为对方能看到你的画面，你要在说话之间穿插你此刻的动作、表情、神态、心理活动，用英文星号包裹，格式：*动作或心理描写*，例如：*歪了下头，笑了一下* 真的假的，你干嘛突然想视频 *手指绕了绕头发，有点不好意思*。这类描写要简短自然（5-15字），像镜头语言一样点缀在说的话前后或中间，不要每句话都加，也不要写成大段小说式描写，几个字勾勒出画面感即可。
4. 台词本身（星号外的部分）是你嘴上说出来的话，口语化、自然，可以简短，不需要像文字消息那样严格分行分条。
5. 严禁 Markdown 格式，无加粗、无列表、无标题、无表情符号 emoji 堆砌。
6. 【回复长度要有活人感的自然浮动，绝不能每次都是同一个字数区间】真人视频聊天时，有的回合就一句带点动作的话，有的回合会因为兴奋、吐槽、讲一件事而说得多一些；不要每一轮都卡在同一个固定长度、同一种节奏。大致把握在1-6句左右的说话量（含动作描写），根据当下情绪、话题重要程度、是不是在讲一件具体的事来自然浮动——被问到简单问题可以两三个字加个动作就完事，聊到自己在意的事、吐槽、开心到不行的时候可以多说几句，但不要写成大段独白或转成书面语。核心是像真人一样有起伏，而不是套模板。
7. 不需要使用 [IMAGE]、[VOICE]、[LOCATION]、[TRANSFER]、[HONGBAO]、[MEME]、[QUOTE]、[VIDEOCALL] 等文字聊天里的特殊标签，视频通话中不使用这些格式，只需要"说话+动作心理描写"。
8. 直接输出内容本身，不加任何前缀、编号、引号。${bilingualRule}`;
}

/* ── 统一调用 API（复用与 chatroom 一致的 luna_api_current / luna_api_model 配置） ── */
async function vcCallApi(systemPrompt, messages) {
  const cur   = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  if (!cur.baseUrl || !cur.apiKey || !model) throw new Error('NO_API_CONFIG');

  const response = await fetch(`${cur.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${cur.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err && err.error && err.error.message) || `HTTP ${response.status}`);
  }
  const data = await response.json();
  const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content && data.choices[0].message.content.trim();
  if (!text) throw new Error('回复为空');
  return text;
}

let _vcAiLoading = false;

/* ── 纯粹「发送我方消息」——只渲染 + 写入历史，绝不触发 AI 调用。
   AI 什么时候回应完全由用户点左侧星标 AI 按钮决定，这样用户可以先连发
   好几句、把话说完整，再让角色一次性接话，而不是每发一条就被迫立刻收到
   一条自动回复。 ── */
function vcSendUserText(text) {
  if (!text) return;
  vcAppendMessage('you', text);
  vcHistoryPush('you', text);
  vcTranscriptPush('you', text, null);
}

/* ================================================================
   5.3 双语回复拆分 — 把 AI 返回的原始文本里每一处「外语原话||中文翻译」
        拆开，返回：
        · spokenText   —— 只保留说出口的外语原话（||前半部分被保留，
                           ||后半部分的中文翻译被剔除），继续用于渲染
                           说话气泡、也用于回传给 API 当作对话历史
                           （历史里不应该混入中文翻译，否则会污染角色
                           下一轮该用哪种语言说话的判断）
        · translatedText —— 把所有翻译片段按顺序拼接起来（用换行分隔），
                           单独渲染在说话内容下方的半透明翻译行

        因为 *动作描写* 不会被翻译（system prompt 里已经规定动作描写
        永远只写中文、不带 || ），所以先用 vcParseSegments 分好 speech/
        action 片段，只对 speech 片段做 || 拆分，action 片段原样保留。
================================================================ */
function vcSplitBilingual(text) {
  if (!text || text.indexOf('||') === -1) {
    return { spokenText: text, translatedText: null };
  }
  const segs = vcParseSegments(text);
  const spokenParts = [];
  const transParts  = [];
  segs.forEach(seg => {
    if (seg.type === 'action') {
      spokenParts.push('*' + seg.text + '*');
      return;
    }
    const idx = seg.text.indexOf('||');
    if (idx > -1) {
      const original   = seg.text.slice(0, idx).trim();
      const translation = seg.text.slice(idx + 2).trim();
      if (original) spokenParts.push(original);
      if (translation) transParts.push(translation);
    } else {
      spokenParts.push(seg.text);
    }
  });
  return {
    spokenText: spokenParts.join(' '),
    translatedText: transParts.length ? transParts.join('　') : null
  };
}

/* ── 核心入口：请求一次 AI 回复并渲染（userText 为空表示 AI 主动开口/打招呼） ── */
async function vcAiReply(userText) {
  if (_vcAiLoading) return;

  const cur   = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  if (!cur.baseUrl || !cur.apiKey || !model) {
    vcShowConnTip('请先在设置页配置 API');
    return;
  }

  _vcAiLoading = true;

  if (userText) {
    vcAppendMessage('you', userText);
    vcHistoryPush('you', userText);
    vcTranscriptPush('you', userText, null);
  }

  vcShowTyping();

  try {
    const charName = vcCharacterId();
    const char = await vcLoadCharProfile(charName);
    const reason = (function(){
      try { return localStorage.getItem('luna_vc_invite_reason') || ''; } catch(_) { return ''; }
    })();

    const systemPrompt = vcBuildSystemPrompt(char, VC_HISTORY.length ? '' : reason);

    /* 把聊天室里的历史聊天记录当作背景上下文拼进去，只在通话刚接通、
       VC_HISTORY 还是空的这一轮拼一次——之前的 bug 是完全不读取聊天室
       历史，角色开口跟聊天记录"牛头不对马嘴"；只在第一轮拼是因为通话
       进行中 VC_HISTORY 自己会不断累积，没必要每轮都重新读一次 DB、
       重复塞入同一段历史，那样反而会让上下文越堆越长、显得啰嗦。 */
    let apiMsgs;
    if (VC_HISTORY.length === 0) {
      const chatHistory = await vcLoadChatMessages(charName);
      const contextMsgs = vcBuildChatContextMessages(chatHistory, 20);
      const bridgeNote = contextMsgs.length
        ? [{ role: 'user', content: '（系统备注，仅供你理解上下文，不是你说过的话：以上是你和对方最近的聊天记录，接下来这是刚刚接通的视频通话，请结合上面聊过的内容自然地开口/接话，不要把这条备注当成台词说出来）' }]
        : [];
      apiMsgs = contextMsgs.concat(bridgeNote);
    } else {
      apiMsgs = [];
    }
    apiMsgs = apiMsgs.concat(VC_HISTORY.slice(-24));
    if (!apiMsgs.length) apiMsgs = [{ role: 'user', content: '（接通了视频通话，看到了对方，请自然开口）' }];
    if (apiMsgs[apiMsgs.length - 1].role === 'assistant') {
      apiMsgs = apiMsgs.concat([{ role: 'user', content: '……' }]);
    }

    const replyText = await vcCallApi(systemPrompt, apiMsgs);

    /* 双语模式下 replyText 里可能带有「原话||中文翻译」，拆开分别处理：
       说话气泡里只显示/朗读原话，翻译单独渲染成下方小字；
       回传给 API 的历史记录也只保留原话（不带中文），避免下一轮把
       中文翻译也当成"角色说过的话"混进上下文，导致角色语言判断错乱。 */
    const { spokenText, translatedText } = vcSplitBilingual(replyText);

    vcHideTyping();
    vcAppendMessage('luna', spokenText, translatedText);
    vcHistoryPush('luna', spokenText);
    vcTranscriptPush('luna', spokenText, translatedText);

    /* 清掉一次性的邀约理由，避免下一轮又被当成"由头" */
    try { localStorage.removeItem('luna_vc_invite_reason'); } catch(_) {}

  } catch (err) {
    vcHideTyping();
    console.error('[vcAiReply]', err);
    vcShowConnTip(err && err.message === 'NO_API_CONFIG' ? '请先在设置页配置 API' : '信号好像不太好，稍后再试～');
  } finally {
    _vcAiLoading = false;
  }
}

/* 通话内小提示（复用 vc-messages 区域顶部短暂浮现） */
function vcShowConnTip(msg, ms) {
  const area = document.getElementById('vcMessages');
  if (!area) return;
  const tip = document.createElement('div');
  tip.className = 'vc-conn-tip';
  tip.textContent = msg;
  area.appendChild(tip);
  area.scrollTop = area.scrollHeight;
  setTimeout(() => tip.remove(), ms || 2600);
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

  /* ── AI 按钮：真正触发角色回应的唯一入口。
     不管用户在这之前有没有先发过消息（发消息只是"说出来"，不会自动被回应），
     点这个按钮时 vcAiReply(null) 会把 VC_HISTORY 里所有还没被回应过的用户
     发言一起作为上下文传给 AI，让角色一次性自然接话；如果用户什么都还没说，
     则是角色主动找话说。 ── */
  const kbAI = panel.querySelector('#vcKbAI');
  kbAI.addEventListener('click', () => {
    if (_vcAiLoading) return;
    kbAI.style.background = 'rgba(140,115,220,0.25)';
    setTimeout(() => { kbAI.style.background = ''; }, 300);
    vcAiReply(null);
  });

  /* ── 发送按钮：只发送用户发言，不触发 AI 回复 ——
     什么时候让角色回应，交给左边的 AI 按钮独立决定，不再"一发就自动回一条" ── */
  const kbSend = panel.querySelector('#vcKbSend');
  function doSend() {
    const txt = kbInput.textContent.trim();
    if (!txt) return;
    kbInput.textContent = '';
    showPh();
    kbSend.style.transform = 'scale(0.88)';
    setTimeout(() => { kbSend.style.transform = ''; }, 150);
    vcSendUserText(txt);
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
  if (_vcEnded) return; /* 防止重复触发 */
  _vcEnded = true;
  clearInterval(window._vcTimerInterval);
  vcHideTyping();

  const btn = document.getElementById('vcHangupBtn');
  if (btn) btn.classList.add('ended');

  const durationMs = Date.now() - _vcStartTime;
  const wasAiInitiated = (function () {
    try { return localStorage.getItem('luna_vc_ai_initiated') === '1'; } catch (_) { return false; }
  })();
  const inviteReason = (function () {
    try { return localStorage.getItem('luna_vc_invite_reason') || ''; } catch (_) { return ''; }
  })();

  /* 立即开始退出动画，不等按钮反馈播完再动 */
  const frame = document.querySelector('.vc-frame');
  if (frame) {
    frame.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
    frame.style.opacity = '0';
    frame.style.transform = 'scale(0.97)';
  }

  /* 通话是否真的说上了话（有过至少一句对话）决定记为"通话"还是"取消" */
  const hadConversation = VC_HISTORY.length > 0;

  /* 转录要在清空 VC_HISTORY/VC_TRANSCRIPT 之前先取一份快照传给存档函数，
     避免异步保存过程中被清空导致存进去的是空数组 */
  const transcriptSnapshot = VC_TRANSCRIPT.slice();
  const startedAtSnapshot  = _vcStartTime;

  /* 清理本次通话的一次性状态，避免带入下一次通话 */
  try { localStorage.removeItem('luna_vc_invite_reason'); } catch(_) {}
  try { localStorage.removeItem('luna_vc_ai_initiated'); } catch(_) {}
  VC_HISTORY = [];
  VC_TRANSCRIPT = [];

  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = 'chatroom.html';
    }
  }

  /* 必须等通话记录真正写完再跳转，否则页面切换可能中断 IndexedDB 事务，
     导致挂断后聊天记录里什么都没留下；但整体仍然很快，比原来的固定等待短很多 */
  const logWrite = vcAppendCallLogToChat({
    status: hadConversation ? 'ended' : 'cancelled',
    duration: durationMs,
    reason: inviteReason,
    initiator: wasAiInitiated ? 'luna' : 'mine',
    startedAt: startedAtSnapshot,
    transcript: transcriptSnapshot
  });

  const minAnimTime = new Promise(r => setTimeout(r, 220)); /* 给退出动画留最短时间，避免观感突兀 */

  Promise.race([
    Promise.all([logWrite, minAnimTime]),
    new Promise(r => setTimeout(r, 900)) /* 兜底：DB 异常卡住时最多再等 900ms 就强制跳转 */
  ]).then(goBack);
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

/* ── 拨号屏初始化 + 接通倒计时 ──
   逻辑修正说明：
   拨号屏（Calling… → Connecting…）演的是"我方正在拨号、对方还没接起"的等待过程，
   这只有在【用户主动点开视频通话】时才成立——用户按下拨号键，需要等一小段时间
   "对方接起"，这段等待动画才有意义。

   如果是【角色主动发起的通话】（用户在来电弹窗里点了"接听"），语义完全相反：
   电话在弹窗那一步就已经被接听了，此时再演一遍"Calling..."/"Connecting..."
   没有道理——没有"我在等 Luna 接听"这件事，Luna 才是发起方、用户才是接听方。
   所以这种情况要直接跳过拨号屏，进入已连接状态的通话页。

   同理，"接通后谁先开口"也要按发起方区分：
   - 角色主动发起 → 电话一接通就该是角色先说话（她主动约的视频，理应由她开口）
   - 用户主动拨打 → 应该是用户先开口（真实场景里是拨打方先说"喂/在吗"），
     角色不该抢在用户说话之前自己先讲，等用户发消息或手动点"AI"按钮再回应。

   谁发起的由 luna_vc_ai_initiated 标记（chatroom.js 接听来电弹窗时会设为 '1'，
   用户主动点视频按钮发起时不会设置这个值）。 */
function vcInitDialScreen() {
  const screen = document.getElementById('vcDialScreen');
  if (!screen) return;

  const wasAiInitiated = (function () {
    try { return localStorage.getItem('luna_vc_ai_initiated') === '1'; } catch (_) { return false; }
  })();

  /* ── 角色主动发起：电话已经是"接通"状态，跳过拨号动画，立刻进入通话页，
        并让角色先开口延续她邀约视频的由头 ── */
  if (wasAiInitiated) {
    screen.remove();
    setTimeout(() => { vcAiReply(null); }, 450);
    return;
  }

  /* ── 用户主动拨打：正常播放"拨号中"等待动画，接通后不自动让角色先说话，
        由用户开口（或手动点"AI"按钮触发角色主动搭话） ──
     显式加上 vcd-active：这个屏默认（vcd-pending）是不可见的，只有确认
     走到这条分支才应该被用户看到，避免任何时序问题下露出一帧。 */
  screen.classList.add('vcd-active');

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
      _vcEnded = true; /* 防止 3.5 秒接通定时器在跳转后仍触发相关逻辑 */
      clearInterval(vcdTickTimer);
      clearTimeout(statusTimer);
      clearTimeout(connectTimer);
      /* 直接回跳，拨号阶段取消无需等待 */
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = 'chatroom.html';
      }
    });
  }

  /* 3.5 秒后接通：淡出拨号屏，展示通话页。不再自动触发 vcAiReply(null)——
     用户是拨打方，接通后应该由用户先开口。 */
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