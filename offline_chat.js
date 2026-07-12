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
   角色信息同步（参照 chatroom.js crInitHeader / crInitStats）
================================ */
const CR_NAME = localStorage.getItem('luna_current_chat') || 'Luna';

/* 全局头像缓存 */
let _offlineAvatarUrl = null;

function loadCharProfile() {
  return new Promise(resolve => {
    const req = indexedDB.open('LunaCharDB', 4);
    req.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('chars')) { resolve(null); return; }
      const r = db.transaction('chars').objectStore('chars').getAll();
      r.onsuccess = () => {
        const found = (r.result || []).find(c => c.name === CR_NAME);
        if (found?.avatar) _offlineAvatarUrl = found.avatar;
        resolve(found || null);
      };
      r.onerror = () => resolve(null);
    };
    req.onerror = () => resolve(null);
  });
}

function applyCharToHeader(char) {
  const name    = char?.name   || CR_NAME;
  const role    = char?.role   || 'The Watcher · 守夜者';
  const initial = (name[0] || 'L').toUpperCase();
  const avatar  = _offlineAvatarUrl;

  /* 标题名 */
  const nameEl = document.querySelector('.hd-name');
  if (nameEl) nameEl.textContent = name;

  /* 英文副标题 */
  const enEl = document.querySelector('.hd-en');
  if (enEl) enEl.textContent = role;

  /* 描述 —— 人设简介属于私密信息，不在此处展示 */
  const descEl = document.querySelector('.hd-desc');
  if (descEl) { descEl.textContent = ''; descEl.style.display = 'none'; }

  /* 头像首字母 */
  const avL = document.querySelector('.hd-av-l');
  if (avL) avL.textContent = initial;

  /* 头像图片 */
  const avEl = document.querySelector('.hd-av');
  if (avEl && avatar) {
    avEl.style.backgroundImage = 'url(' + avatar + ')';
    avEl.style.backgroundSize  = 'cover';
    avEl.style.backgroundPosition = 'center';
    avEl.style.backgroundRepeat   = 'no-repeat';
    const avLEl = avEl.querySelector('.hd-av-l');
    if (avLEl) avLEl.style.display = 'none';
  }

  /* 页面标题 */
  document.title = name + ' — 离线聊天';

  /* 存到全局给消息渲染用 */
  window._offlineCharName    = name;
  window._offlineCharInitial = initial;
  window._offlineCharAvatar  = avatar;
}

async function initCharInfo() {
  const char = await loadCharProfile();
  applyCharToHeader(char);

  /* 同步对话数（从 LunaChatDB messages store） */
  try {
    const p = indexedDB.open('LunaChatDB');
    p.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('messages')) return;
      const r = db.transaction('messages').objectStore('messages').get(CR_NAME);
      r.onsuccess = () => {
        const msgs = r.result ? (r.result.msgs || []) : [];
        const convEl = document.getElementById('convCount');
        if (convEl && msgs.length > 0) convEl.textContent = msgs.length;
      };
    };
  } catch(e) {}

  /* 同步相识天数（从 LunaChatDB conv store） */
  try {
    const p2 = indexedDB.open('LunaChatDB');
    p2.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('conv')) return;
      const r = db.transaction('conv').objectStore('conv').get(CR_NAME);
      r.onsuccess = () => {
        const item = r.result;
        const daysEl = document.getElementById('daysCount');
        if (daysEl && item && item.createdAt) {
          const days = Math.floor((Date.now() - item.createdAt) / (1000 * 60 * 60 * 24));
          daysEl.textContent = days + 'd';
        }
      };
    };
  } catch(e) {}
}

/* ================================
   消息数据存储（按角色隔离）
================================ */
const DB_KEY = 'luna_offline_messages_' + CR_NAME;

function loadMessages() {
  try { return JSON.parse(localStorage.getItem(DB_KEY)) || []; }
  catch(e) { return []; }
}

function saveMessages(msgs) {
  localStorage.setItem(DB_KEY, JSON.stringify(msgs));
}

/* ================================================================
   离线 AI 回复引擎
   —— 复用 chatroom.js 的 API 调用方式（同一套 luna_api_current /
      luna_api_model 配置），并结合「基础设置」里的文风、人称、
      线下世界书、记忆条数、是否同步线上记忆等设定，
      构建贴合人设、不 OOC 的 system prompt。
================================================================ */

/* ---- 统一 API 调用（与 chatroom.js crCallApi 完全一致的协议） ---- */
async function offlineCallApi(systemPrompt, messages) {
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
    throw new Error(err?.error?.message || `HTTP ${response.status}`);
  }
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('回复为空');
  return text;
}

/* ---- 读取双语设置（与 chatroom.js 共用同一个 localStorage 键） ---- */
function offlineGetBilingualConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('luna_bilingual') || '{}');
    return {
      on: saved.mode === 'on',
      lang: saved.lang || '',
      langSub: saved.langSub || '',
    };
  } catch (e) {
    return { on: false, lang: '', langSub: '' };
  }
}

/* ---- 人称说明文字 ---- */
function offlinePovLabel(pov) {
  return pov === '1' ? '第一人称' : pov === '3' ? '第三人称' : '第二人称';
}

/* ---- 读取线上 chatroom 记忆（仅在「同步线上记忆」开启时使用） ----
   线上聊天记录存储在 LunaChatDB.messages，按角色名(CR_NAME)取出，
   截取最近若干条拼成简短摘要，作为「过去发生过的事」注入 system prompt，
   不直接把大段线上原文糊进上下文，避免和线下叙事产生风格冲突。 */
function offlineLoadOnlineMemorySummary(memCount) {
  return new Promise(resolve => {
    try {
      const req = indexedDB.open('LunaChatDB');
      req.onsuccess = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('messages')) { resolve(''); return; }
        const r = db.transaction('messages').objectStore('messages').get(CR_NAME);
        r.onsuccess = () => {
          const all = r.result ? (r.result.msgs || []) : [];
          if (!all.length) { resolve(''); return; }
          const recent = all.slice(-Math.max(4, Math.min(memCount, 20)));
          const lines = recent.map(m => {
            const who = (m.role === 'mine' || m.role === 'user') ? '用户' : CR_NAME;
            const text = (m.text || m.voiceText || '').toString().replace(/\n/g, ' ').slice(0, 60);
            return text ? `${who}：${text}` : '';
          }).filter(Boolean);
          resolve(lines.join('\n'));
        };
        r.onerror = () => resolve('');
      };
      req.onerror = () => resolve('');
    } catch (e) { resolve(''); }
  });
}

/* ---- 构建离线叙事的 system prompt ----
   与 chatroom.js 的 crBuildSystemPrompt 同源思路：
   人设（人物简介/性格/背景）来自 LunaCharDB 的角色档案，
   叙事层的文风、人称、世界书来自「基础设置」，两者叠加，
   任何设置都不允许覆盖或稀释角色的核心人设 —— 严禁 OOC。 */
function offlineBuildSystemPrompt(char, osState, onlineMemorySummary) {
  const name    = char?.name    || CR_NAME;
  const role    = char?.role    || '';
  const persona = char?.persona || char?.description || char?.desc || '';
  const traits  = char?.traits  || char?.personality || '';
  const bg      = char?.background || char?.story || '';

  const styleBlock = osState.styleDesc
    ? `\n【文风设定 —— 仅影响你叙述与对白的语言质感，不改变你的人格】\n标题：${osState.styleName || '（未命名）'}\n描述：${osState.styleDesc}\n这份文风只决定你"怎么说"，不决定你"是谁"或"会怎么想"——你的性格、态度、底线，一切仍以角色人设为准，文风与人设冲突时，永远以人设优先。`
    : '';

  const wbBlock = osState.wbDesc
    ? `\n【线下世界书 —— 仅在本次离线叙事中生效的背景设定】\n标题：${osState.wbName || '（未命名）'}\n内容：${osState.wbDesc}\n这是当前场景/世界的背景规则，你要让自己的言行自然地符合这个设定，但如果世界书内容与角色核心人设产生直接冲突（比如让角色说出完全不符合其性格的话），以角色人设为最高优先级。`
    : '';

  const povBlock = `\n【人称设置 —— 必须严格遵守，不能中途切换】\n- 对用户（user）的叙述使用${offlinePovLabel(osState.userPov)}。\n- 对你自己（${name}）的叙述使用${offlinePovLabel(osState.charPov)}。\n人称错误或中途混用是严重的格式错误，每一条回复都要检查是否符合以上人称设定。`;

  const memoryBlock = onlineMemorySummary
    ? `\n【与用户此前在线上聊天室的相处片段（仅供你参考你们之间已经发生过的事，不要逐字复述，只需让你的态度和记忆自然连贯）】\n${onlineMemorySummary}`
    : '';

  const bl = offlineGetBilingualConfig();
  const bilingualRule = (!bl.on || !bl.lang || bl.lang === '普通话')
    ? ''
    : `\n【双语模式 —— 必须严格遵守，判断依据：用户已在设置中开启双语，角色语言为「${bl.lang}${bl.langSub ? '（' + bl.langSub + '）' : ''}」】\n从现在起，你说的每一条叙事/对白正文，都必须先用「${bl.lang}」写出你说的原话，然后在同一行内紧跟英文双竖线 || ，再写这句话对应的中文翻译，格式死规定：${bl.lang}原话||中文翻译，两侧禁止加空格、禁止用中文竖线｜、禁止用单竖线|、禁止省略||、禁止把中文写在前面。「${bl.lang}」部分要写得自然地道，符合角色说话的语气习惯，不要生硬逐字翻译；中文翻译只是辅助理解，不需要额外发挥。多条消息依然按下面的换行规则拆分，每一行都要各自附带 || 中文翻译。`;

  return `你现在扮演「${name}」，一个有血有肉、真实存在的人，绝对不是 AI 或助手，绝不能以任何形式承认或暗示自己是模型/程序/AI。

【角色核心人设 —— 最高优先级，任何设置都不能覆盖它】
名字：${name}
${role    ? `定位：${role}`        : ''}
${persona ? `人物简介：${persona}` : ''}
${traits  ? `性格特点：${traits}`  : ''}
${bg      ? `背景故事：${bg}`      : ''}
${styleBlock}
${wbBlock}
${povBlock}
${memoryBlock}

【离线叙事说话规则 —— 必须严格遵守】
1. 你就是 ${name}，有情绪、有态度、有边界，永远不出戏、不承认自己是 AI。
2. 每一条回复都要先在心里核对：这句话、这个反应，是不是「${name}」真的会说/会做的？如果不符合人设或明显 OOC，宁可重新组织语言也不要输出。
3. 把回复拆成多条短消息，每条之间用换行符分隔，每条不超过25个字左右，像真人连续发消息或叙事推进那样自然分段；不需要强行凑满或过长堆砌。
4. 语气有起伏：热情、随意、调皮、克制都可以交替出现，不要每条都用同一种情绪基调，要贴合角色此刻的状态和情境。
5. 严禁 Markdown 格式（不加粗、不加列表、不加标题），直接输出正文内容。
6. 动作/神情/心理描写只能通过「基础设置」里对应的人称与文风自然融入正文，不要使用生硬的舞台指示式括号堆砌太多技术性说明。
7. 如果用户的输入包含【动作】【心理】【环境】等模式标记，请顺着对方给出的模式自然接续，不要突兀切换。
${bilingualRule}`;
}

/* ---- 把本地离线消息历史转换为 API 消息格式 ----
   记忆条数由「基础设置」里的 memCount 控制：条数太少角色会失忆，
   太多会浪费 token，这里严格按用户设置的条数截取。 */
function offlineBuildApiMessages(historyMsgs, memCount) {
  const modeLabel = { action: '【动作】', thought: '【心理】', env: '【环境】', dialogue: '' };
  const n = Math.max(2, Math.min(memCount || 12, 60));
  const recent = historyMsgs.slice(-n);

  const result = recent.map(m => {
    const prefix = modeLabel[m.mode] || '';
    return {
      role: m.role === 'user' ? 'user' : 'assistant',
      content: prefix ? `${prefix}${m.text}` : m.text
    };
  });

  while (result.length > 0 && result[0].role === 'assistant') result.shift();
  if (result.length === 0) result.push({ role: 'user', content: '（这里没有任何文字，请你用角色口吻自然地开口说一两句，主动破冰）' });
  return result;
}

/* ---- 判断当前情况：破冰 / 正常回复 / 催续 —— 与 chatroom.js crGetSituation 同思路 ---- */
function offlineGetSituation(msgs) {
  if (!msgs.some(m => m.role === 'user')) return 'initiative';
  let lastUserIdx = -1;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'user') { lastUserIdx = i; break; }
  }
  const repliedAfter = msgs.slice(lastUserIdx + 1).some(m => m.role === 'assistant');
  return repliedAfter ? 'continue' : 'reply';
}

/* ---- 解析双语回复行「原文||译文」，拆分渲染 ---- */
function offlineSplitBilingualLine(line) {
  const idx = line.indexOf('||');
  if (idx === -1) return { orig: line, trans: '' };
  return { orig: line.slice(0, idx), trans: line.slice(idx + 2) };
}

/* ---- typing 指示器 ---- */
function offlineShowTyping() {
  const list = document.getElementById('msgList');
  if (!list || document.getElementById('offlineTyping')) return;
  const wrap = document.createElement('div');
  wrap.id = 'offlineTyping';
  wrap.className = 'typing-card';
  wrap.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  list.appendChild(wrap);
  list.scrollTop = list.scrollHeight;
}
function offlineHideTyping() {
  const el = document.getElementById('offlineTyping');
  if (el) el.remove();
}

/* ---- 出错提示条 ---- */
function offlineShowErrTip(msg, ms) {
  ms = ms || 2600;
  const list = document.getElementById('msgList');
  if (!list) return;
  const tip = document.createElement('div');
  tip.className = 'offline-err-tip';
  tip.textContent = msg;
  list.appendChild(tip);
  list.scrollTop = list.scrollHeight;
  setTimeout(function () { tip.remove(); }, ms);
}

/* ---- 发送按钮 loading 态 ---- */
let _offlineAiLoading = false;
function offlineSetSendLoading(loading) {
  _offlineAiLoading = loading;
  const btn = document.getElementById('sendBtn');
  if (!btn) return;
  btn.disabled = loading;
  btn.classList.toggle('loading', loading);
}

/* ---- 逐条追加 AI 回复到本地存储 + 渲染（支持双语拆分） ---- */
function offlineAppendAiLine(rawLine) {
  const bl = offlineGetBilingualConfig();
  let text = rawLine, translated = '';
  if (bl.on && bl.lang && bl.lang !== '普通话' && rawLine.indexOf('||') !== -1) {
    const parsed = offlineSplitBilingualLine(rawLine);
    text = parsed.orig;
    translated = parsed.trans;
  }
  const msgs = loadMessages();
  const entry = { role: 'assistant', text, mode: 'dialogue', time: Date.now() };
  if (translated) entry.translated = translated;
  msgs.push(entry);
  saveMessages(msgs);
  const convEl = document.getElementById('convCount');
  if (convEl) convEl.textContent = msgs.length;
  renderMessages();
}

/* ---- 核心入口：请求 AI 回复 ---- */
async function offlineRequestAiReply() {
  if (_offlineAiLoading) return;

  const cur   = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  if (!cur.baseUrl || !cur.apiKey || !model) {
    offlineShowErrTip('请先在设置页配置 API');
    return;
  }

  offlineSetSendLoading(true);
  offlineShowTyping();

  try {
    const char    = await loadCharProfile();
    const osState = (typeof window.osGetBasicSettings === 'function') ? window.osGetBasicSettings() : {};

    let onlineMemorySummary = '';
    if (osState.syncOnline) {
      onlineMemorySummary = await offlineLoadOnlineMemorySummary(osState.memCount);
    }

    const systemPrompt = offlineBuildSystemPrompt(char, osState, onlineMemorySummary);
    const historyMsgs  = loadMessages();
    const apiMessages  = offlineBuildApiMessages(historyMsgs, osState.memCount);

    const replyText = await offlineCallApi(systemPrompt, apiMessages);

    offlineHideTyping();
    const lines = replyText.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      offlineAppendAiLine(lines[i]);
    }
  } catch (err) {
    offlineHideTyping();
    console.error('[offlineRequestAiReply]', err);
    if (err && err.message === 'NO_API_CONFIG') {
      offlineShowErrTip('请先在设置页配置 API');
    } else {
      offlineShowErrTip('消息好像没发出去，稍后再试～');
    }
  } finally {
    offlineSetSendLoading(false);
  }
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

  if (!list) return;

  const floor = msgs.length;
  if (floorEl)  floorEl.textContent = '#' + floor;

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

    /* 格式化正文（含双语翻译附加行，若存在） */
    const bodyHtml = formatBody(msg.text, msg.mode, msg.translated);

    /* 标签 */
    const tagsHtml = buildTags(msg.mode, isUser);

    /* 情绪主标 */
    const moodLabel = moodFromMode(msg.mode);

    /* 动态角色信息 */
    const charName    = window._offlineCharName    || CR_NAME;
    const charInitial = window._offlineCharInitial || charName[0].toUpperCase();
    const charAvatar  = window._offlineCharAvatar  || null;
    const aiAvHtml    = charAvatar
      ? `<div class="ch-av" style="background-image:url(${charAvatar});background-size:cover;background-position:center;border-radius:50%;"><span class="ch-av-l" style="display:none"></span></div>`
      : `<div class="ch-av"><span class="ch-av-l">${charInitial}</span></div>`;

    card.innerHTML = `
      <div class="card-header">
        ${isUser ? `<div class="ch-av u"><span class="ch-av-l u">我</span></div>` : aiAvHtml}
        <div class="ch-info">
          <div class="ch-row1">
            <span class="ch-name">${isUser ? '你' : charName}</span>
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
function formatBody(text, mode, translated) {
  /* 简单转义 */
  const safe = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  let mainHtml;
  if (mode === 'action') {
    mainHtml = `<em>*${safe}*</em>`;
  } else if (mode === 'thought') {
    mainHtml = `<span class="thought">${safe}</span>`;
  } else if (mode === 'env') {
    mainHtml = `<span class="env">·· ${safe} ··</span>`;
  } else {
    /* dialogue — 默认 */
    mainHtml = `「${safe}」`;
  }

  /* 双语模式：若这条消息带有翻译，附加在原文下方，样式区分 */
  if (translated) {
    const safeTrans = translated.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `<span class="bl-orig">${mainHtml}</span><span class="bl-trans">${safeTrans}</span>`;
  }
  return mainHtml;
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

/* 单条输入的建议上限：太长的单条输入既不利于角色扮演式的短句往返，
   也会挤占「记忆条数」里能装下的有效轮次，所以给出软性提示而非强制拦截。 */
const INPUT_SOFT_LIMIT = 500;
const INPUT_WARN_AT     = 400;

const _inpTa = document.getElementById('inputText');
_inpTa.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendMessage();
});
_inpTa.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 130) + 'px';
  const len = this.value.length;
  const cc = document.getElementById('charCount');
  if (cc) {
    cc.textContent = len + ' / ' + INPUT_SOFT_LIMIT;
    cc.classList.toggle('warn', len >= INPUT_WARN_AT && len < INPUT_SOFT_LIMIT);
    cc.classList.toggle('over', len >= INPUT_SOFT_LIMIT);
  }
  this.classList.toggle('over-limit', len >= INPUT_SOFT_LIMIT);
});

function sendMessage() {
  if (_offlineAiLoading) return; // AI 正在生成回复时，避免连续提交打断上下文

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
  ta.style.height = 'auto';
  const cc = document.getElementById('charCount');
  if (cc) { cc.textContent = '0 / ' + INPUT_SOFT_LIMIT; cc.classList.remove('warn', 'over'); }
  ta.classList.remove('over-limit');

  renderMessages();

  /* 触发角色的离线 AI 回复 —— 严格贴合人设、按当前设置的文风/人称/世界书/双语规则生成 */
  offlineRequestAiReply();
}

/* ---- 重新生成：撤回本轮所有 assistant 回复，重新请求一次 ---- */
document.getElementById('regenBtn')?.addEventListener('click', function () {
  if (_offlineAiLoading) return;
  const msgs = loadMessages();
  let i = msgs.length - 1;
  while (i >= 0 && msgs[i].role === 'assistant') i--;
  if (i === msgs.length - 1) { offlineShowErrTip('还没有可以重新生成的回复'); return; }
  msgs.length = i + 1;
  saveMessages(msgs);
  const convEl = document.getElementById('convCount');
  if (convEl) convEl.textContent = msgs.length;
  renderMessages();
  offlineRequestAiReply();
});

/* ---- 继续：不新增用户输入，直接让角色续说（对应「催续」情境） ---- */
document.getElementById('continueBtn')?.addEventListener('click', function () {
  if (_offlineAiLoading) return;
  offlineRequestAiReply();
});

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
/* 先加载角色信息，加载完再渲染消息（保证卡片内角色名/头像正确） */
initCharInfo().then(() => renderMessages());
/* ================================================================
   基础设置 / 美化设置 —— 「···」菜单 + 全屏设置页
   数据均按角色（CR_NAME）隔离存储在 localStorage
================================================================ */
(function () {
  const OS_KEY = 'luna_offline_basic_settings_' + CR_NAME;
  const OS_STYLE_PRESETS_KEY = 'luna_offline_style_presets_' + CR_NAME;
  const OS_WB_PRESETS_KEY    = 'luna_offline_worldbook_presets_' + CR_NAME;

  const OS_STYLE_BUILTIN = {
    '活泼口语':   '轻快随意的口语化表达，多用短句和语气词，像朋友间随口聊天，偶尔带点俏皮的网络用语。',
    '文艺抖音风': '短句分行、节奏感强，善用留白与意象化的比喻，带点轻微的伤感或治愈氛围，适合配文风格的叙述。',
    '冷酷简约':   '惜字如金，陈述式短句为主，不带多余情绪修饰，克制、疏离，留大量空白让读者自行体会。',
    '撒娇可爱':   '语气软糯黏人，多用叠词、拟声词和可爱的语尾，情绪外露，喜欢用"呀""啦""嘛"收尾。',
    '深情文学风': '句式绵长考究，善用比喻与意象，情感浓度高但表达含蓄克制，带有古典文学的韵律感。'
  };

  const DEFAULTS = {
    styleName: '', styleDesc: '',
    userPov: '2', charPov: '3',
    wbName: '', wbDesc: '',
    syncOnline: false,
    memCount: 12
  };

  function osLoad() {
    try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(OS_KEY) || '{}')); }
    catch (e) { return Object.assign({}, DEFAULTS); }
  }
  function osSave(state) {
    try { localStorage.setItem(OS_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function osLoadPresets(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { return {}; }
  }
  function osSavePresets(key, obj) {
    try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) {}
  }

  /* 双语设置与 chatroom.js 共用同一个 localStorage 键 luna_bilingual，
     这样无论用户在「聊天设置」页还是这里改动，两处显示都保持同步。 */
  function osLoadBilingual() {
    try {
      const saved = JSON.parse(localStorage.getItem('luna_bilingual') || '{}');
      return { on: saved.mode === 'on', lang: saved.lang || '' };
    } catch (e) { return { on: false, lang: '' }; }
  }
  function osSaveBilingual(bl) {
    try {
      const prev = JSON.parse(localStorage.getItem('luna_bilingual') || '{}');
      const next = Object.assign({}, prev, { mode: bl.on ? 'on' : 'off', lang: bl.lang });
      localStorage.setItem('luna_bilingual', JSON.stringify(next));
    } catch (e) {}
  }

  let state = osLoad();

  /* ---------- 「···」小菜单 ---------- */
  const moreBtn      = document.getElementById('hdMoreBtn');
  const moreMenu      = document.getElementById('hdMoreMenu');
  const moreBackdrop  = document.getElementById('hdMoreBackdrop');
  const basicPage     = document.getElementById('osBasicPage');
  const beautyPage    = document.getElementById('osBeautyPage');

  function closeMoreMenu() {
    moreMenu.classList.remove('show');
    moreBackdrop.classList.remove('show');
  }
  moreBtn?.addEventListener('click', () => {
    moreMenu.classList.toggle('show');
    moreBackdrop.classList.toggle('show');
  });
  moreBackdrop?.addEventListener('click', closeMoreMenu);

  document.getElementById('hdMoreBasic')?.addEventListener('click', () => {
    closeMoreMenu();
    openBasicPage();
  });
  document.getElementById('hdMoreBeauty')?.addEventListener('click', () => {
    closeMoreMenu();
    beautyPage.classList.add('show');
  });
  document.getElementById('osBasicBack')?.addEventListener('click', () => basicPage.classList.remove('show'));
  document.getElementById('osBeautyBack')?.addEventListener('click', () => beautyPage.classList.remove('show'));

  /* ---------- 打开基础设置页：把 state 渲染进各控件 ---------- */
  function openBasicPage() {
    state = osLoad();

    document.getElementById('osStyleName').value = state.styleName || '';
    document.getElementById('osStyleDesc').value = state.styleDesc || '';
    document.getElementById('osWbName').value = state.wbName || '';
    document.getElementById('osWbDesc').value = state.wbDesc || '';

    osSyncPovUI('osUserPov', state.userPov);
    osSyncPovUI('osCharPov', state.charPov);

    document.getElementById('osSyncToggle').classList.toggle('on', !!state.syncOnline);
    document.getElementById('osMemVal').textContent = state.memCount;

    const bl = osLoadBilingual();
    document.getElementById('osBilingualToggle').classList.toggle('on', bl.on);
    document.getElementById('osBilingualLang').value = bl.lang;
    document.getElementById('osBilingualLangRow').style.display = bl.on ? 'flex' : 'none';

    osRefreshChipActive();
    osRefreshPresetSelect('osStyleLoadSelect', osLoadPresets(OS_STYLE_PRESETS_KEY));
    osRefreshPresetSelect('osWbLoadSelect', osLoadPresets(OS_WB_PRESETS_KEY));

    basicPage.classList.add('show');
  }

  /* ---------- 人称分段控制 ---------- */
  function osSyncPovUI(groupId, val) {
    document.querySelectorAll('#' + groupId + ' .os-seg-item').forEach(el => {
      el.classList.toggle('active', el.dataset.pov === String(val));
    });
  }
  document.getElementById('osUserPov')?.addEventListener('click', e => {
    const item = e.target.closest('.os-seg-item');
    if (!item) return;
    state.userPov = item.dataset.pov;
    osSyncPovUI('osUserPov', state.userPov);
    osSave(state);
  });
  document.getElementById('osCharPov')?.addEventListener('click', e => {
    const item = e.target.closest('.os-seg-item');
    if (!item) return;
    state.charPov = item.dataset.pov;
    osSyncPovUI('osCharPov', state.charPov);
    osSave(state);
  });

  /* ---------- 文风：内置预设 chip 点击 → 填充标题+内容 ---------- */
  function osRefreshChipActive() {
    document.querySelectorAll('#osStyleChips .os-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.stylePreset === state.styleName);
    });
  }
  document.getElementById('osStyleChips')?.addEventListener('click', e => {
    const chip = e.target.closest('.os-chip');
    if (!chip) return;
    const name = chip.dataset.stylePreset;
    document.getElementById('osStyleName').value = name;
    document.getElementById('osStyleDesc').value = OS_STYLE_BUILTIN[name] || '';
    state.styleName = name;
    state.styleDesc = OS_STYLE_BUILTIN[name] || '';
    osSave(state);
    osRefreshChipActive();
  });

  /* 手动编辑标题/内容时，取消 chip 高亮并即时保存 */
  document.getElementById('osStyleName')?.addEventListener('input', function () {
    state.styleName = this.value;
    osSave(state);
    osRefreshChipActive();
  });
  document.getElementById('osStyleDesc')?.addEventListener('input', function () {
    state.styleDesc = this.value;
    osSave(state);
  });
  document.getElementById('osWbName')?.addEventListener('input', function () {
    state.wbName = this.value;
    osSave(state);
  });
  document.getElementById('osWbDesc')?.addEventListener('input', function () {
    state.wbDesc = this.value;
    osSave(state);
  });

  /* ---------- 通用：预设下拉刷新 ---------- */
  function osRefreshPresetSelect(selectId, presets) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const keep = '<option value="">从已保存的' + (selectId === 'osStyleLoadSelect' ? '文风' : '世界书') + '中载入…</option>';
    sel.innerHTML = keep + Object.keys(presets).map(name =>
      `<option value="${name.replace(/"/g,'&quot;')}">${name}</option>`
    ).join('');
  }

  /* ---------- 文风：保存 / 载入 / 删除留档 ---------- */
  document.getElementById('osStyleSaveBtn')?.addEventListener('click', () => {
    const name = (document.getElementById('osStyleName').value || '').trim();
    const desc = document.getElementById('osStyleDesc').value || '';
    if (!name) { osToast('请先给文风起个标题再保存'); return; }
    const presets = osLoadPresets(OS_STYLE_PRESETS_KEY);
    presets[name] = desc;
    osSavePresets(OS_STYLE_PRESETS_KEY, presets);
    osRefreshPresetSelect('osStyleLoadSelect', presets);
    osToast('文风「' + name + '」已保存留档');
  });
  document.getElementById('osStyleLoadBtn')?.addEventListener('click', () => {
    const sel = document.getElementById('osStyleLoadSelect');
    const name = sel.value;
    if (!name) return;
    const presets = osLoadPresets(OS_STYLE_PRESETS_KEY);
    if (!(name in presets)) return;
    document.getElementById('osStyleName').value = name;
    document.getElementById('osStyleDesc').value = presets[name];
    state.styleName = name;
    state.styleDesc = presets[name];
    osSave(state);
    osRefreshChipActive();
    osToast('已载入「' + name + '」');
  });
  document.getElementById('osStyleDeleteBtn')?.addEventListener('click', () => {
    const sel = document.getElementById('osStyleLoadSelect');
    const name = sel.value;
    if (!name) { osToast('请先选择要删除的留档'); return; }
    const presets = osLoadPresets(OS_STYLE_PRESETS_KEY);
    delete presets[name];
    osSavePresets(OS_STYLE_PRESETS_KEY, presets);
    osRefreshPresetSelect('osStyleLoadSelect', presets);
    osToast('已删除「' + name + '」');
  });

  /* ---------- 世界书：保存 / 载入 / 删除留档 ---------- */
  document.getElementById('osWbSaveBtn')?.addEventListener('click', () => {
    const name = (document.getElementById('osWbName').value || '').trim();
    const desc = document.getElementById('osWbDesc').value || '';
    if (!name) { osToast('请先给世界书起个标题再保存'); return; }
    const presets = osLoadPresets(OS_WB_PRESETS_KEY);
    presets[name] = desc;
    osSavePresets(OS_WB_PRESETS_KEY, presets);
    osRefreshPresetSelect('osWbLoadSelect', presets);
    osToast('世界书「' + name + '」已保存留档');
  });
  document.getElementById('osWbLoadBtn')?.addEventListener('click', () => {
    const sel = document.getElementById('osWbLoadSelect');
    const name = sel.value;
    if (!name) return;
    const presets = osLoadPresets(OS_WB_PRESETS_KEY);
    if (!(name in presets)) return;
    document.getElementById('osWbName').value = name;
    document.getElementById('osWbDesc').value = presets[name];
    state.wbName = name;
    state.wbDesc = presets[name];
    osSave(state);
    osToast('已载入「' + name + '」');
  });
  document.getElementById('osWbDeleteBtn')?.addEventListener('click', () => {
    const sel = document.getElementById('osWbLoadSelect');
    const name = sel.value;
    if (!name) { osToast('请先选择要删除的留档'); return; }
    const presets = osLoadPresets(OS_WB_PRESETS_KEY);
    delete presets[name];
    osSavePresets(OS_WB_PRESETS_KEY, presets);
    osRefreshPresetSelect('osWbLoadSelect', presets);
    osToast('已删除「' + name + '」');
  });

  /* ---------- 同步线上记忆 开关 ---------- */
  document.getElementById('osSyncToggle')?.addEventListener('click', function () {
    state.syncOnline = !state.syncOnline;
    this.classList.toggle('on', state.syncOnline);
    osSave(state);
  });

  /* ---------- 双语模式 开关 + 目标语言输入 ----------
     这里判断"是否为双语"：开关状态 + 是否填写了非"普通话"的目标语言，
     两者同时满足时，offlineBuildSystemPrompt 才会真正注入双语规则。 */
  document.getElementById('osBilingualToggle')?.addEventListener('click', function () {
    const bl = osLoadBilingual();
    bl.on = !bl.on;
    osSaveBilingual(bl);
    this.classList.toggle('on', bl.on);
    const row = document.getElementById('osBilingualLangRow');
    if (row) row.style.display = bl.on ? 'flex' : 'none';
  });
  document.getElementById('osBilingualLang')?.addEventListener('input', function () {
    const bl = osLoadBilingual();
    bl.lang = this.value.trim();
    osSaveBilingual(bl);
  });

  /* ---------- 上下文记忆条数 加减 ---------- */
  const MEM_MIN = 2, MEM_MAX = 60;
  document.getElementById('osMemMinus')?.addEventListener('click', () => {
    state.memCount = Math.max(MEM_MIN, (state.memCount || DEFAULTS.memCount) - 1);
    document.getElementById('osMemVal').textContent = state.memCount;
    osSave(state);
  });
  document.getElementById('osMemPlus')?.addEventListener('click', () => {
    state.memCount = Math.min(MEM_MAX, (state.memCount || DEFAULTS.memCount) + 1);
    document.getElementById('osMemVal').textContent = state.memCount;
    osSave(state);
  });

  /* ---------- 轻量 toast 提示 ---------- */
  function osToast(msg) {
    let el = document.getElementById('osToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'osToast';
      el.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);' +
        'background:rgba(20,20,20,0.9);color:#fff;padding:9px 16px;border-radius:20px;' +
        'font-family:"Cormorant Garamond",serif;font-size:13px;z-index:999;opacity:0;' +
        'transition:opacity .2s;pointer-events:none;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 1800);
  }

  /* 暴露给外部（未来接 AI 调用时读取此函数即可获取完整设置） */
  window.osGetBasicSettings = osLoad;
})();