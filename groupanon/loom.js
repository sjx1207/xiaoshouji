/* ================================
   loom.js — 因果纺织机
   起因 / 转折 / 结果 三线定局 → AI 拆解人物关系 → 逐幕短剧演绎 → 加入命运星系
================================ */

/* ----------------------------------------------------------------
   Status bar utilities (1:1 复刻 groupanon.js)
---------------------------------------------------------------- */
function updateTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeStr = new Date().toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  const el = document.getElementById('statusTime');
  if (el) el.textContent = timeStr;
}
function updateBattery() {
  const pctEl = document.getElementById('batPct');
  const innerEl = document.getElementById('batInner');
  function render(p) {
    p = Math.round(p);
    if (pctEl) pctEl.textContent = p;
    if (innerEl) {
      innerEl.style.width = p + '%';
      innerEl.style.background = p <= 20 ? 'linear-gradient(90deg,#f87171,#ef4444)' : 'linear-gradient(90deg,#6ee7b7,#34d399)';
    }
  }
  if ('getBattery' in navigator) {
    navigator.getBattery().then(b => { render(b.level * 100); b.addEventListener('levelchange', () => render(b.level * 100)); });
  } else { render(76); }
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
      const t = document.getElementById('siClockText'); if (!t) return;
      const now = new Date();
      t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0');
    };
    tick();
    window._siClockTimer = setInterval(tick, 10000);
  }
}
window.addEventListener('storage', e => {
  if (e.key === 'luna_island_update') applyIsland();
  if (e.key === 'luna_tz_update') updateTime();
});

/* ----------------------------------------------------------------
   Fallback demo members — used when no real group data present
---------------------------------------------------------------- */
const DEMO_MEMBERS = [
  { id:'m1', name:'萧沐白', initial:'萧', avatar:null, role:'admin',
    bio:'冷峻、寡言，外表疏离实则内心细腻。是这个群的大哥，对弟弟妹妹们有保护欲但嘴上不说。',
    relations: {
      m2: { callName:'清欢', relationship:'青梅竹马，从小认识，心里有点特别但绝口不提' },
      m3: { callName:'老三', relationship:'发小，互相看不顺眼但关键时刻都挺对方' },
      m4: { callName:'小四', relationship:'最小的弟弟，暗中关照，表面淡漠' },
    } },
  { id:'m2', name:'林清欢', initial:'林', avatar:null, role:'member',
    bio:'温柔体贴，习惯用玩笑话掩盖在意。在这个群里排行老二，最会察言观色。',
    relations: {
      m1: { callName:'沐白哥', relationship:'青梅竹马，从小认识，对他有说不清的情愫' },
      m3: { callName:'辞年', relationship:'室友般的关系，什么都聊，但经常被他气到' },
      m4: { callName:'鹿鸣', relationship:'像对小弟弟，看他开心就开心' },
    } },
  { id:'m3', name:'顾辞年', initial:'顾', avatar:null, role:'member',
    bio:'毒舌但护短，嘴硬心软的双子座。排行老三，嘴上最刻薄，心里最义气。',
    relations: {
      m1: { callName:'大哥', relationship:'死党，明面上互怼，私下最能说心里话' },
      m2: { callName:'二姐', relationship:'经常被她说教，但其实很信任她' },
      m4: { callName:'小白', relationship:'时常欺负他，其实最怕他受委屈' },
    } },
  { id:'m4', name:'白鹿鸣', initial:'白', avatar:null, role:'member',
    bio:'开朗活泼，藏不住情绪的透明人。群里最小，什么都写在脸上，傻白甜但心思比看起来细。',
    relations: {
      m1: { callName:'沐白哥', relationship:'最崇拜的人，一直想在他面前显得成熟一点' },
      m2: { callName:'清欢姐', relationship:'最亲的姐姐，什么都跟她说' },
      m3: { callName:'辞年哥', relationship:'表面上怕他，其实根本没在怕' },
    } },
];

let _groupMembers = [];
let _groupName    = 'GROUP';
let _usingDemoMembers = false;

function loadGroupData() {
  _usingDemoMembers = false;
  try {
    const raw = localStorage.getItem('luna_groupanon_data')
             || localStorage.getItem('luna_group_data')
             || localStorage.getItem('luna_groupchat_data');
    if (raw) {
      const data = JSON.parse(raw);
      _groupName = data.name || 'GROUP';
      const members = data.members && data.members.length > 0 ? data.members : null;
      if (members) {
        _groupMembers = members.map(m => ({ ...m, initial: m.initial || (m.name ? m.name[0] : '?'), avatar: m.avatar || m.avatarUrl || m.icon || null }));
      } else { _groupMembers = DEMO_MEMBERS; _usingDemoMembers = true; }
    } else { _groupMembers = DEMO_MEMBERS; _usingDemoMembers = true; }
  } catch(e) { _groupMembers = DEMO_MEMBERS; _usingDemoMembers = true; }
  if (_groupMembers.length < 2) {
    _groupMembers = [..._groupMembers, ...DEMO_MEMBERS].slice(0, 4);
    _usingDemoMembers = true;
  }
}

/* ----------------------------------------------------------------
   User identity (persona) — same IndexedDB source as groupanon.js
---------------------------------------------------------------- */
let _userIdentity = null;

async function loadUserIdentity() {
  try {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open('LunaIdentityDB');
      req.onsuccess = e => res(e.target.result);
      req.onerror = () => rej(new Error('no db'));
    });
    if (!db.objectStoreNames.contains('identities')) { db.close(); return null; }
    const list = await new Promise(res => {
      const r = db.transaction('identities').objectStore('identities').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => res([]);
    });
    db.close();
    if (!list.length) return null;
    return list.find(i => i.active !== false) || list[0];
  } catch(e) { return null; }
}
function userDisplayName() { return _userIdentity?.name || '群主'; }
function buildUserBrief() {
  if (!_userIdentity) return '群组的创建者，其他信息未知。';
  const parts = [];
  if (_userIdentity.role) parts.push(_userIdentity.role);
  if (_userIdentity.desc) parts.push(_userIdentity.desc);
  if (_userIdentity.tags && _userIdentity.tags.length) parts.push('标签：' + _userIdentity.tags.join('、'));
  if (_userIdentity.gender) parts.push(_userIdentity.gender);
  return parts.length ? parts.join('；') : '群组的创建者。';
}

/* ----------------------------------------------------------------
   Character brief + relation context builders (同 groupanon.js 逻辑)
---------------------------------------------------------------- */
function buildMemberBrief(member) {
  const roleLabel = member.role === 'admin' ? '群管理员' : '普通群成员';
  const parts = [];
  const mainDesc = (member.desc || member.bio || '').trim();
  if (mainDesc) parts.push(mainDesc);
  if (member.traits && member.traits.length) parts.push('性格标签：' + member.traits.join('、'));
  if (member.gender) parts.push(member.gender);
  if (member.age) parts.push(member.age + '岁');
  const customPrompt = (member.prompt || '').trim();
  if (customPrompt) parts.push('角色设定：' + customPrompt);
  if (parts.length > 0) return `${parts.join('；')}（身份：${roleLabel}）`;
  return `群内${roleLabel}，名字是「${member.name}」。请根据名字赋予一个具体一致的性格，并在整个演绎中严格保持。`;
}
function buildGroupCastLine(excludeId) {
  return _groupMembers.filter(m => m.id !== excludeId).map(m => m.name).join('、');
}
function buildRelationContext(member) {
  const others = _groupMembers.filter(m => m.id !== member.id);
  if (!others.length) return '';
  const lines = others.map(other => {
    const rel = member.relations && member.relations[other.id];
    if (rel) {
      const callPart = rel.callName ? `叫TA「${rel.callName}」` : `叫TA「${other.name}」`;
      const relPart = rel.relationship ? `，${rel.relationship}` : '';
      return `- 对「${other.name}」：${callPart}${relPart}`;
    }
    return `- 对「${other.name}」：直接叫「${other.name}」`;
  });
  return `\n【你和群内其他人的称呼与关系——演绎时必须用这里的称呼，不能乱叫】\n${lines.join('\n')}`;
}

/* ----------------------------------------------------------------
   AI API — 复用设置页已配置好的接口（同 groupanon.js callClaude）
---------------------------------------------------------------- */
function getLunaApiConfig() {
  let cur = {};
  try { cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}'); } catch(e) {}
  const baseUrl = (cur.baseUrl || '').trim().replace(/\/$/, '');
  const apiKey  = (cur.apiKey || '').trim();
  const model   = (localStorage.getItem('luna_api_model') || cur.model || '').trim();
  return { baseUrl, apiKey, model };
}

/* 返回 { text, truncated }，truncated=true 表示是因为达到 max_tokens 而被截断
   （Anthropic: stop_reason === 'max_tokens'；OpenAI兼容: finish_reason === 'length'）
   supportsPrefill：Anthropic 原生接口下，是否把 assistant 消息作为最后一条传入实现续写（用于长文续写） */
async function callClaudeRaw(prompt, systemPrompt, maxTokens, prefillText) {
  const { baseUrl, apiKey, model } = getLunaApiConfig();
  if (!baseUrl || !apiKey || !model) throw new Error('NO_API_CONFIG');
  const isAnthropic = baseUrl.includes('anthropic.com');
  let res, data, reply, truncated = false;

  if (isAnthropic) {
    const messages = [{ role: 'user', content: prompt }];
    if (prefillText) messages.push({ role: 'assistant', content: prefillText });
    const body = { model, max_tokens: maxTokens || 500, messages };
    if (systemPrompt) body.system = systemPrompt;
    res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const errText = await res.text().catch(() => ''); throw new Error('API error ' + res.status + (errText ? ': ' + errText.slice(0,200) : '')); }
    data = await res.json();
    reply = data.content?.[0]?.text || '';
    const stopReason = data.stop_reason || '';
    truncated = stopReason === 'max_tokens';
    if (!reply) { throw new Error('API 返回空内容' + (stopReason ? `（stop_reason: ${stopReason}）` : '') + '，请检查模型配置或重试'); }
  } else {
    const apiBase = baseUrl.replace(/\/v1$/, '') + '/v1';
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });
    if (prefillText) messages.push({ role: 'assistant', content: prefillText });
    res = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens || 500, temperature: 0.95 }),
    });
    if (!res.ok) { const errText = await res.text().catch(() => ''); throw new Error('API error ' + res.status + (errText ? ': ' + errText.slice(0,200) : '')); }
    data = await res.json();
    reply = data.choices?.[0]?.message?.content ?? '';
    const finishReason = data.choices?.[0]?.finish_reason || '';
    truncated = finishReason === 'length';
    if (reply === null || reply === undefined || reply === '') {
      const errMsg = data.error?.message || '';
      if (errMsg) throw new Error('API 错误：' + errMsg.slice(0,100));
      throw new Error('API 返回空内容' + (finishReason ? `（finish_reason: ${finishReason}）` : '') + '，可能被内容过滤或 max_tokens 过小');
    }
  }
  return { text: reply.trim(), truncated };
}

/* 兼容旧调用点：只要文本，不关心是否截断 */
async function callClaude(prompt, systemPrompt, maxTokens) {
  const { text } = await callClaudeRaw(prompt, systemPrompt, maxTokens, null);
  return text;
}

/* 长文生成专用：如果单次返回被截断（触达 max_tokens），自动带着已生成内容
   作为前缀继续请求"接着写"，最多续写若干轮，直到收完整或达到轮次上限，
   从根源上避免"写到一半突然断掉"的问题。 */
async function callClaudeLong(prompt, systemPrompt, maxTokensPerRound, maxRounds) {
  maxRounds = maxRounds || 4;
  let full = '';
  let round = 0;
  let lastTruncated = true;

  while (lastTruncated && round < maxRounds) {
    const continuePrompt = round === 0
      ? prompt
      : `${prompt}\n\n（注意：以下是你已经写好的部分，请直接从断开处紧接着往下写，不要重复已写内容，不要加任何"续写""接上文"之类的提示语，写到情节自然收束为止）`;

    const { text, truncated } = await callClaudeRaw(continuePrompt, systemPrompt, maxTokensPerRound, round === 0 ? null : full);
    /* Anthropic prefill 续写模式下，返回的 text 是"新增部分"（因为 assistant 消息已包含 full 作为前缀，
       API 只续写后续 token），OpenAI 兼容模式部分实现可能会把 prefill 内容重复吐出，做一次安全去重前缀处理 */
    let addition = text;
    if (round > 0 && addition.startsWith(full)) addition = addition.slice(full.length);
    full = round === 0 ? text : (full + addition);

    lastTruncated = truncated;
    round++;
  }
  return full.trim();
}

function notifyApiNotConfigured() { gaToast('请先在「设置 → API」中配置并选择模型'); }

/* ----------------------------------------------------------------
   Misc helpers
---------------------------------------------------------------- */
function escHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function gaToast(msg) {
  const el = document.getElementById('gaToast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(window._gaToastTimer);
  window._gaToastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
function handleBack() {
  if (window.parent !== window) { try { window.parent.postMessage({ type: 'luna_back' }, '*'); return; } catch(e) {} }
  history.back();
}
function showLoomInfo() {
  document.getElementById('loomInfoOverlay').classList.add('show');
  document.getElementById('loomInfoSheet').classList.add('show');
}
function closeLoomInfo() {
  document.getElementById('loomInfoOverlay').classList.remove('show');
  document.getElementById('loomInfoSheet').classList.remove('show');
}

/* ----------------------------------------------------------------
   STAGE 1 — 织机台：拖拽绑定
---------------------------------------------------------------- */
let _slots = { cause: null, twist: null, result: null };   // filled text per slot
let _cardEls = {};   // slot -> card DOM el

/* 真实指针拖拽（Pointer Events）——同时兼容触屏和鼠标，卡片跟手移动，
   松手时检测停在哪根丝线上方，命中就放入，未命中就弹回原位。
   注意：原生 HTML5 dragstart/drop 在触屏设备上不会触发，所以这里不用它。 */
function initLoomStage() {
  const cards = document.querySelectorAll('.loom-card');
  const pool = document.getElementById('loomPool');

  cards.forEach(card => {
    const slot = card.dataset.slot;
    _cardEls[slot] = card;
    card.removeAttribute('draggable');

    const input = card.querySelector('.lc-input');
    input.addEventListener('input', () => checkWeaveReady());
    /* 防止在输入框里按下时触发拖拽 */
    input.addEventListener('pointerdown', e => e.stopPropagation());

    let dragState = null;

    card.addEventListener('pointerdown', e => {
      if (_slots[slot]) return;              // 已放置的卡片不可再拖
      if (e.target === input) return;
      const val = getCardValue(slot);
      if (!val) { gaToast('先写点内容吧'); pulseCard(card); return; }

      const rect = card.getBoundingClientRect();
      dragState = {
        startX: e.clientX, startY: e.clientY,
        rectW: rect.width, rectH: rect.height,
        originLeft: rect.left, originTop: rect.top,
        moved: false,
      };
      card.setPointerCapture(e.pointerId);
      card.classList.add('dragging');
      card.style.width = rect.width + 'px';
      card.style.zIndex = 50;
    });

    card.addEventListener('pointermove', e => {
      if (!dragState) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      if (!dragState.moved && Math.hypot(dx, dy) > 4) dragState.moved = true;
      if (!dragState.moved) return;

      card.style.position = 'fixed';
      card.style.left = (dragState.originLeft + dx) + 'px';
      card.style.top = (dragState.originTop + dy) + 'px';
      card.style.pointerEvents = 'none';

      /* 检测当前指针悬停在哪根丝线的槽位上 */
      const under = document.elementFromPoint(e.clientX, e.clientY);
      document.querySelectorAll('.lt-slot').forEach(s => s.classList.remove('dragover'));
      const hoverSlotEl = under && under.closest ? under.closest('.lt-slot') : null;
      if (hoverSlotEl) hoverSlotEl.classList.add('dragover');
    });

    function endDrag(e) {
      if (!dragState) return;
      card.releasePointerCapture(e.pointerId);
      card.classList.remove('dragging');
      card.style.pointerEvents = '';
      document.querySelectorAll('.lt-slot').forEach(s => s.classList.remove('dragover'));

      if (dragState.moved) {
        const under = document.elementFromPoint(e.clientX, e.clientY);
        const hoverThread = under && under.closest ? under.closest('.loom-thread') : null;
        if (hoverThread && hoverThread.dataset.accept === slot) {
          placeCard(slot);
        } else if (hoverThread) {
          gaToast('这张卡片不属于这根线');
          snapBack(card);
        } else {
          snapBack(card);
        }
      } else {
        snapBack(card);
      }
      dragState = null;
    }
    card.addEventListener('pointerup', endDrag);
    card.addEventListener('pointercancel', endDrag);
  });

  function snapBack(card) {
    /* FLIP：先记录当前(拖拽中)的屏幕位置，再清空内联样式让它回到文档流原位，
       计算两者差值，用 transform 从差值位置动画归零，实现"滑回"手感 */
    const draggedRect = card.getBoundingClientRect();
    card.style.position = '';
    card.style.left = '';
    card.style.top = '';
    card.style.width = '';
    card.style.zIndex = '';
    const restRect = card.getBoundingClientRect();
    const dx = draggedRect.left - restRect.left;
    const dy = draggedRect.top - restRect.top;
    card.style.transition = 'none';
    card.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(() => {
      card.style.transition = 'transform 0.32s cubic-bezier(0.22,1,0.36,1)';
      card.style.transform = '';
      setTimeout(() => { card.style.transition = ''; }, 340);
    });
  }

  function pulseCard(card) {
    card.style.transition = 'transform 0.12s';
    card.style.transform = 'scale(0.97)';
    setTimeout(() => { card.style.transform = ''; }, 140);
  }
}

/* AI 帮想因果三线：结合群内真实人设与关系网，一次性建议一组彼此呼应的
   起因/转折/结果关键词，填入输入框（不直接放上丝线，用户可再编辑/确认后自己拖动）。 */
async function aiSuggestThreads() {
  const { baseUrl, apiKey, model } = getLunaApiConfig();
  if (!baseUrl || !apiKey || !model) { notifyApiNotConfigured(); return; }

  const btn = document.getElementById('loomAiSuggestBtn');
  const label = document.getElementById('loomAiSuggestLabel');
  if (btn.classList.contains('loading')) return;
  btn.classList.add('loading');
  label.textContent = '正在构思…';

  try {
    const castBrief = _groupMembers.map(m => `- ${m.name}：${buildMemberBrief(m)}`).join('\n');
    const relationLines = _groupMembers.map(m => buildRelationContext(m)).join('\n');

    const systemPrompt = `你要为一个"因果纺织机"小游戏构思一组种子关键词：起因、转折、结果，各自不超过16个字，三者之间要有清晰的因果链条，并且要能让下面这个群聊阵容里的人物自然地卷入其中（不需要在关键词里点名具体成员，关键词本身是场景/事件的浓缩概括）。

只输出严格合法的JSON，不要markdown代码块标记，不要任何多余文字：
{"cause":"起因关键词","twist":"转折关键词","result":"结果关键词"}`;

    const prompt = `【群聊阵容】\n${castBrief}\n\n【关系网】${relationLines}\n\n请构思一组适合这个阵容演绎的起因/转折/结果关键词。`;

    const raw = await callClaude(prompt, systemPrompt, 300);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!parsed.cause || !parsed.twist || !parsed.result) throw new Error('生成内容不完整');

    document.getElementById('inputCause').value = parsed.cause.slice(0, 40);
    document.getElementById('inputTwist').value = parsed.twist.slice(0, 40);
    document.getElementById('inputResult').value = parsed.result.slice(0, 40);
    checkWeaveReady();
    gaToast('已为你构思一段因果，可编辑后拖到丝线上');

  } catch (err) {
    gaToast(err.message === 'NO_API_CONFIG' ? '请先配置 API' : ('构思失败：' + (err.message || '未知错误')));
  } finally {
    btn.classList.remove('loading');
    label.textContent = 'AI 帮我想一段因果';
  }
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function getCardValue(slot) {
  const id = { cause: 'inputCause', twist: 'inputTwist', result: 'inputResult' }[slot];
  return document.getElementById(id).value.trim();
}

function placeCard(slot) {
  const val = getCardValue(slot);
  if (!val) return;
  _slots[slot] = val;

  const slotEl = document.getElementById('slot' + capitalize(slot));
  const markMap = { cause: '起', twist: '转', result: '果' };
  slotEl.classList.add('filled');
  slotEl.innerHTML = `
    <div class="lt-slot-filled-mark">${markMap[slot]}</div>
    <div class="lt-slot-filled-text">${escHtml(val)}</div>
    <div class="lt-slot-clear" onclick="event.stopPropagation(); clearSlot('${slot}')">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </div>`;

  const card = _cardEls[slot];
  card.classList.add('placed');
  card.style.boxShadow = '';
  /* 清除拖拽期间加上的内联定位样式，让卡片回到文档流（会被 .placed 的灰化样式接管） */
  card.style.position = '';
  card.style.left = '';
  card.style.top = '';
  card.style.width = '';
  card.style.zIndex = '';
  card.style.pointerEvents = '';

  checkWeaveReady();
}

function clearSlot(slot) {
  _slots[slot] = null;
  const slotEl = document.getElementById('slot' + capitalize(slot));
  slotEl.classList.remove('filled');
  const ph = { cause: '拖入起因卡片', twist: '拖入转折卡片', result: '拖入结果卡片' }[slot];
  slotEl.innerHTML = `<span class="lt-slot-ph">${ph}</span>`;
  const card = _cardEls[slot];
  card.classList.remove('placed');
  checkWeaveReady();
}

function checkWeaveReady() {
  const btn = document.getElementById('loomWeaveBtn');
  const ready = _slots.cause && _slots.twist && _slots.result;
  btn.classList.toggle('disabled', !ready);
}

/* ----------------------------------------------------------------
   Stage transition helper
---------------------------------------------------------------- */
function switchStage(id) {
  document.querySelectorAll('.loom-view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/* ----------------------------------------------------------------
   STAGE 2 — 纺织动画：拆解因果 + 人物关系分析
---------------------------------------------------------------- */
const WEAVE_LOG_STEPS = [
  '正在拆解因果结构…',
  '正在锁定角色坐标…',
  '正在核对人物关系网…',
  '正在分配角色职能…',
  '经纬即将交织成篇…',
];

function drawWeavingLines() {
  const g = document.getElementById('weavingLines');
  g.innerHTML = '';
  const n = _groupMembers.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a1 = (Math.PI * 2 * i) / n - Math.PI / 2;
      const a2 = (Math.PI * 2 * j) / n - Math.PI / 2;
      const r = 90;
      const x1 = 150 + r * Math.cos(a1), y1 = 150 + r * Math.sin(a1);
      const x2 = 150 + r * Math.cos(a2), y2 = 150 + r * Math.sin(a2);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1); line.setAttribute('y1', y1);
      line.setAttribute('x2', x2); line.setAttribute('y2', y2);
      g.appendChild(line);
    }
  }
}
function pulseRandomLines() {
  const lines = document.querySelectorAll('#weavingLines line');
  lines.forEach(l => l.classList.remove('wl-active'));
  const count = Math.min(3, lines.length);
  const picked = new Set();
  while (picked.size < count && picked.size < lines.length) picked.add(Math.floor(Math.random() * lines.length));
  picked.forEach(idx => lines[idx].classList.add('wl-active'));
}

let _castAnalysis = null;   // AI-produced JSON: role assignments + relation summary
let _dramaScenes = [];      // built scene data with generated persona texts (filled progressively)

async function startWeaving() {
  if (document.getElementById('loomWeaveBtn').classList.contains('disabled')) return;
  const { baseUrl, apiKey, model } = getLunaApiConfig();
  if (!baseUrl || !apiKey || !model) { notifyApiNotConfigured(); return; }

  switchStage('stageWeaving');
  drawWeavingLines();
  const pulseTimer = setInterval(pulseRandomLines, 550);

  const label = document.getElementById('weavingLabel');
  const logEl = document.getElementById('weavingLog');
  logEl.innerHTML = '';
  let stepI = 0;
  const stepTimer = setInterval(() => {
    if (stepI >= WEAVE_LOG_STEPS.length) return;
    label.style.opacity = '0';
    setTimeout(() => { label.textContent = WEAVE_LOG_STEPS[stepI]; label.style.opacity = '1'; }, 220);
    const item = document.createElement('div');
    item.className = 'weaving-log-item';
    item.textContent = '· ' + WEAVE_LOG_STEPS[stepI];
    logEl.appendChild(item);
    while (logEl.children.length > 4) logEl.removeChild(logEl.firstChild);
    stepI++;
  }, 900);

  try {
    _castAnalysis = await analyzeCastAndAssignRoles();
    buildDramaChainHeader();
    initDramaScenes();
  } catch (err) {
    clearInterval(pulseTimer); clearInterval(stepTimer);
    gaToast(err && err.message === 'NO_API_CONFIG' ? '请先配置 API' : ('生成失败：' + (err.message || '未知错误')));
    switchStage('stageLoom');
    return;
  }

  clearInterval(pulseTimer); clearInterval(stepTimer);
  switchStage('stageDrama');
}

/* Ask AI to analyze the full member roster + relation web, and assign
   who plays "起因驱动者 / 转折搅局者 / 结果承受者" etc. Keeps relations locked. */
async function analyzeCastAndAssignRoles() {
  const castBrief = _groupMembers.map(m => `- ${m.name}（${m.id}）：${buildMemberBrief(m)}`).join('\n');
  const relationLines = _groupMembers.map(m => buildRelationContext(m)).join('\n');
  const userName = userDisplayName();
  const userBrief = buildUserBrief();

  const systemPrompt = `你是一个精密的短剧编排引擎，负责把用户给出的「起因／转折／结果」三段因果，安排进一个已有的、关系网完全固定的群聊角色阵容里演绎成一段短剧的骨架分析。

【铁律】
1. 人物关系网是已经写死的事实，你只能使用、不能修改、不能新增、不能颠倒。谁叫谁什么、什么关系，必须严格照抄下面提供的关系数据。
2. 每一个出场角色都必须在因果链条里起到实际作用——不能有摆设角色。没有作用的角色宁可不安排出场。
3. 起因、转折、结果三个阶段，各自至少安排1名角色主导、可以有1-2名角色辅助或作为影响对象，但每个阶段的主导角色最好不同，形成链条感。
4. 只输出严格合法的JSON，不要任何前后缀文字、不要markdown代码块标记。

【JSON结构】
{
  "theme": "对这段因果的一句话主题概括（不超过20字）",
  "scenes": [
    {
      "phase": "cause",
      "phaseLabel": "起因",
      "leadId": "主导这一幕的成员id",
      "supportIds": ["辅助或被影响的成员id，可为空数组"],
      "briefBeat": "这一幕大致会发生什么，给20-40字的编排提示，供后续生成正文参考"
    },
    { "phase": "twist", "phaseLabel": "转折", "leadId": "...", "supportIds": [...], "briefBeat": "..." },
    { "phase": "result", "phaseLabel": "结果", "leadId": "...", "supportIds": [...], "briefBeat": "..." }
  ]
}`;

  const prompt = `【群成员阵容】\n${castBrief}\n\n【群内人物关系网——固定不可变】${relationLines}\n\n【提问的群主】\n${userName}：${userBrief}\n\n【用户给出的因果三线】\n起因：${_slots.cause}\n转折：${_slots.twist}\n结果：${_slots.result}\n\n请分析这个阵容，判断谁最适合主导起因、谁最适合搅出转折、谁最适合承受结果，给出JSON编排方案。`;

  const raw = await callClaude(prompt, systemPrompt, 900);
  const cleaned = raw.replace(/```json|```/g, '').trim();
  let parsed;
  try { parsed = JSON.parse(cleaned); }
  catch(e) {
    /* fallback: naive round-robin assignment if AI didn't return clean JSON */
    parsed = buildFallbackCast();
  }
  if (!parsed || !parsed.scenes || parsed.scenes.length < 3) parsed = buildFallbackCast();
  return parsed;
}

function buildFallbackCast() {
  const ids = _groupMembers.map(m => m.id);
  return {
    theme: '一段因果的三幕演绎',
    scenes: [
      { phase: 'cause',  phaseLabel: '起因', leadId: ids[0] || null, supportIds: ids.slice(1,2), briefBeat: _slots.cause },
      { phase: 'twist',  phaseLabel: '转折', leadId: ids[1] || ids[0] || null, supportIds: ids.slice(2,3), briefBeat: _slots.twist },
      { phase: 'result', phaseLabel: '结果', leadId: ids[2] || ids[0] || null, supportIds: ids.slice(3,4), briefBeat: _slots.result },
    ]
  };
}

function buildDramaChainHeader() {
  const chainEl = document.getElementById('dramaChain');
  const theme = _castAnalysis.theme || '因果链';
  chainEl.innerHTML = `
    <span class="dc-node">${escHtml(_slots.cause)}</span>
    <span class="dc-arrow">→</span>
    <span class="dc-node">${escHtml(_slots.twist)}</span>
    <span class="dc-arrow">→</span>
    <span class="dc-node">${escHtml(_slots.result)}</span>`;
}

/* ----------------------------------------------------------------
   STAGE 3 — 短剧演绎：逐幕揭示
---------------------------------------------------------------- */
let _revealedCount = 0;

function initDramaScenes() {
  _dramaScenes = _castAnalysis.scenes.map((s, i) => ({ ...s, idx: i, generated: false, text: null }));
  _revealedCount = 0;
  document.getElementById('dramaScroll').innerHTML = '';
  document.getElementById('dramaProgTotal').textContent = _dramaScenes.length;
  document.getElementById('dramaProgIdx').textContent = '0';
  document.getElementById('dramaNextLabel').textContent = '展开第一幕 · ' + (_dramaScenes[0]?.phaseLabel || '起因');
  document.getElementById('dramaNextBtn').classList.remove('hidden', 'disabled');
}

function findMember(id) { return _groupMembers.find(m => m.id === id) || null; }

async function revealNextScene() {
  if (_revealedCount >= _dramaScenes.length) return;
  const btn = document.getElementById('dramaNextBtn');
  btn.classList.add('disabled');

  const scene = _dramaScenes[_revealedCount];
  const scroll = document.getElementById('dramaScroll');

  const lead = findMember(scene.leadId);
  const supports = (scene.supportIds || []).map(findMember).filter(Boolean);

  const card = document.createElement('div');
  card.className = 'scene-card';
  card.innerHTML = `
    <div class="scene-tag-row">
      <span class="scene-tag">${escHtml(scene.phaseLabel.toUpperCase())} · ${scene.phase === 'cause' ? 'CAUSE' : scene.phase === 'twist' ? 'TWIST' : 'RESULT'}</span>
      <span class="scene-idx">No. 0${scene.idx + 1}</span>
    </div>
    <div class="scene-loading"><div class="rv-dots"><div></div><div></div><div></div></div><span>正在演绎「${escHtml(lead ? lead.name : '未知角色')}」的这一幕，篇幅较长请稍候…</span></div>
    <div class="scene-body" style="display:none;"></div>
  `;
  scroll.appendChild(card);
  scroll.scrollTop = scroll.scrollHeight;

  try {
    const text = await generateSceneNarrative(scene, lead, supports);
    scene.text = text;
    scene.generated = true;
    if (text.length < 1400) {
      console.warn('[loom] scene text shorter than expected:', text.length, 'chars');
    }

    const loadingEl = card.querySelector('.scene-loading');
    const bodyEl = card.querySelector('.scene-body');
    loadingEl.remove();
    bodyEl.style.display = 'block';

    const roleClass = scene.phase === 'twist' ? 'persona-twist' : (scene.phase === 'result' ? 'persona-result' : '');
    const mark = lead ? (lead.initial || lead.name[0]) : '?';
    const relLine = supports.length
      ? `此幕关联角色：${supports.map(s => s.name).join('、')}`
      : `此幕由「${lead ? lead.name : '未知'}」独自主导`;

    bodyEl.innerHTML = `
      <div class="persona-card ${roleClass}">
        <div class="persona-head">
          <div class="persona-avatar">${escHtml(mark)}</div>
          <div>
            <div class="persona-name">${escHtml(lead ? lead.name : '未知角色')}</div>
            <div class="persona-role">${escHtml(scene.phaseLabel)}主导 · ${lead && lead.role === 'admin' ? '群管理员' : '群成员'}</div>
          </div>
        </div>
        <div class="persona-text" id="sceneText${scene.idx}"></div>
      </div>
      <div class="scene-relation-note">${escHtml(relLine)}</div>
    `;
    typeWriter(document.getElementById('sceneText' + scene.idx), text);

  } catch (err) {
    const loadingEl = card.querySelector('.scene-loading');
    loadingEl.innerHTML = `<span style="color:var(--gray-500)">这一幕生成失败：${escHtml(err.message || '未知错误')}，点击下方重试</span>`;
    btn.classList.remove('disabled');
    return;
  }

  _revealedCount++;
  document.getElementById('dramaProgIdx').textContent = _revealedCount;

  if (_revealedCount < _dramaScenes.length) {
    const next = _dramaScenes[_revealedCount];
    document.getElementById('dramaNextLabel').textContent = '展开下一幕 · ' + next.phaseLabel;
    btn.classList.remove('disabled');
  } else {
    document.getElementById('dramaNextLabel').textContent = '完成 · 进入命运网';
    btn.classList.remove('disabled');
    btn.onclick = goToGalaxy;
  }
}

/* Typewriter reveal for generated persona text — interactive pacing, not dumped all at once */
function typeWriter(el, text) {
  el.textContent = '';
  const cursor = document.createElement('span');
  cursor.className = 'typing-cursor';
  el.appendChild(cursor);
  let i = 0;
  const chunk = 3;
  const speed = 8;
  function step() {
    if (i >= text.length) { cursor.remove(); return; }
    const next = text.slice(i, i + chunk);
    i += chunk;
    cursor.insertAdjacentText('beforebegin', next);
    document.getElementById('dramaScroll').scrollTop = document.getElementById('dramaScroll').scrollHeight;
    setTimeout(step, speed);
  }
  step();
}

/* Generate ≥2000-character narrative for one scene, staying strictly in-character
   and honoring the locked relation web. Every persona invoked must serve the plot. */
async function generateSceneNarrative(scene, lead, supports) {
  if (!lead) throw new Error('未能确定主导角色');

  const brief = buildMemberBrief(lead);
  const relationCtx = buildRelationContext(lead);
  const castLine = buildGroupCastLine(lead.id);
  const userName = userDisplayName();
  const userBrief = buildUserBrief();

  const supportBriefs = supports.map(s => `- ${s.name}：${buildMemberBrief(s)}${buildRelationContext(s).replace(/\n/g, ' ')}`).join('\n') || '（此幕无额外辅助角色，独角戏）';

  const phaseGuide = {
    cause:  '这是因果链条的起点——把用户写下的起因，具象成一段真实发生在群里/生活中的场景。要交代清楚是什么让这件事开始的，人物的动机和处境要立住。',
    twist:  '这是因果链条的转折——承接上一幕的起因，把用户写下的转折，演绎成让局面发生偏转的关键时刻。要有张力，要让人感觉"事情不一样了"。',
    result: '这是因果链条的收束——把用户写下的结果，演绎成整件事最终落地的样子。要让前面的起因和转折在这里得到呼应，但不必刻意升华说教。',
  }[scene.phase];

  const systemPrompt = `你正在为一段「因果短剧」撰写其中一幕的正文，第一视角/第三视角均可，但必须像真实的群聊故事片段，绝不能有AI感。

【背景设定】
群名：${_groupName}
这是「${userName}」（${userBrief}）发起的一场因果推演游戏，TA给出了起因、转折、结果三个关键词，AI需要把它们演绎成具体情节，安排群成员在其中扮演各自该扮演的角色。

【这一幕的主导角色】
${lead.name}：${brief}${relationCtx}

【本幕关联的其他角色（若有，必须让TA们的行为符合各自人设与关系）】
${supportBriefs}

【群内其他未出场成员（不要强行安排出场，但如自然提及要用对的称呼）】
${castLine || '无'}

【这一幕的定位】
${phaseGuide}
用户给出的这一幕关键词是：「${scene.briefBeat || ''}」，必须紧扣这个关键词展开，不能跑题另写一套。

【核心创作要求——必须严格遵守】
1. 字数不少于2000字，这是硬性要求，写得单薄绝对不合格，必须有完整的场景、对话、心理、细节铺陈。
2. 人物绝对不能OOC：${lead.name}的每一句话、每一个反应都必须符合上面给出的性格设定，语气、用词习惯要有辨识度，和其他成员必须区分开。
3. 如果多个角色同时出场，每个角色都必须在情节里起到实质作用——真实推动、真实回应、真实产生影响，不能是摆设或工具人。
4. 人物关系必须严格遵照上方标注的称呼和关系，绝不能乱叫、颠倒辈分、编造关系。
5. 情节要具体，要有画面感的场景描写、有来有回的对话、有内心活动的转折，避免空洞的概括陈述。
6. 允许出现群聊对话形式穿插，也允许纯叙事，但整体要像一段能拍成短剧的文字脚本，有起承转合的节奏感。
7. 不要在结尾强行升华、讲大道理、喊口号，保持故事本身该有的余韵即可。
8. 禁止出现"AI""模型""程序""生成""扮演"等破坏沉浸感的词汇。
9. 不要使用任何表情符号（emoji）。

直接输出这一幕的正文内容，不要加标题、不要加"第一幕""起因"这类标签前缀，不要加任何解释性文字。`;

  const prompt = `请撰写「${scene.phaseLabel}」这一幕的完整正文，字数不少于2000字。关键词：「${scene.briefBeat || (scene.phase === 'cause' ? _slots.cause : scene.phase === 'twist' ? _slots.twist : _slots.result)}」。`;

  /* 中文长文一个token大约对应1.3-1.8个字，2000字保守估计需要约1600-2400 token，
     单轮给到4000 token留足余量；若仍被截断，自动续写最多3轮，
     从根源避免"写到一半突然断掉"。 */
  return await callClaudeLong(prompt, systemPrompt, 4000, 4);
}

/* ----------------------------------------------------------------
   STAGE 4 — 命运网 / 星系
---------------------------------------------------------------- */
function loadGalaxyStars() {
  try {
    const raw = localStorage.getItem('luna_loom_galaxy');
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}
function saveGalaxyStars(stars) {
  try { localStorage.setItem('luna_loom_galaxy', JSON.stringify(stars)); } catch(e) {}
}

function goToGalaxy() {
  switchStage('stageGalaxy');
  renderGalaxy(false);
  document.getElementById('galaxyActionsPre').classList.remove('hidden');
  document.getElementById('galaxyActionsPost').classList.add('hidden');
  document.getElementById('galaxyActionsBrowse').classList.add('hidden');
  document.getElementById('galaxyStarName').classList.remove('show');
  document.getElementById('galaxyCaption').textContent = '这段因果，是否值得成为命运网里的一颗星？';
}

/* 入口：从织机台头部图标直接进入星系，纯浏览已收集的星（不会重复"加入"） */
function openGalaxyBrowse() {
  const stars = loadGalaxyStars();
  switchStage('stageGalaxy');
  renderGalaxy(false);
  document.getElementById('galaxyActionsPre').classList.add('hidden');
  document.getElementById('galaxyActionsPost').classList.add('hidden');
  document.getElementById('galaxyActionsBrowse').classList.remove('hidden');
  document.getElementById('galaxyStarName').classList.remove('show');
  document.getElementById('galaxyCaption').textContent = stars.length
    ? `命运网中已有 ${stars.length} 颗星`
    : '命运网还是空的，去织一段因果吧';
}

function updateGalaxyEntryBadge() {
  const stars = loadGalaxyStars();
  const badge = document.getElementById('galaxyEntryBadge');
  if (!badge) return;
  if (stars.length > 0) {
    badge.textContent = stars.length > 99 ? '99+' : stars.length;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function openStarDetail(star) {
  document.getElementById('starDetailName').textContent = star.name;
  const d = new Date(star.createdAt);
  document.getElementById('starDetailTime').textContent =
    `织于 ${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  const chainEl = document.getElementById('starDetailChain');
  chainEl.innerHTML = `
    <div class="star-detail-row"><div class="star-detail-mark">起</div><div class="star-detail-text">${escHtml(star.cause || '')}</div></div>
    <div class="star-detail-row"><div class="star-detail-mark">转</div><div class="star-detail-text">${escHtml(star.twist || '')}</div></div>
    <div class="star-detail-row"><div class="star-detail-mark">果</div><div class="star-detail-text">${escHtml(star.result || '')}</div></div>
  `;

  /* 把当时保存下来的完整剧情正文渲染出来，不只是三个关键词 */
  const scenesEl = document.getElementById('starDetailScenes');
  if (scenesEl) {
    if (star.scenes && star.scenes.length) {
      scenesEl.innerHTML = star.scenes.map((s, i) => {
        const roleClass = s.phase === 'twist' ? 'persona-twist' : (s.phase === 'result' ? 'persona-result' : '');
        const mark = s.leadName ? s.leadName[0] : '?';
        const relLine = (s.supportNames && s.supportNames.length)
          ? `此幕关联角色：${s.supportNames.join('、')}`
          : `此幕由「${s.leadName || '未知'}」独自主导`;
        return `
          <div class="scene-card">
            <div class="scene-tag-row">
              <span class="scene-tag">${escHtml((s.phaseLabel || '').toUpperCase())} · ${s.phase === 'cause' ? 'CAUSE' : s.phase === 'twist' ? 'TWIST' : 'RESULT'}</span>
              <span class="scene-idx">No. 0${i + 1}</span>
            </div>
            <div class="scene-body">
              <div class="persona-card ${roleClass}">
                <div class="persona-head">
                  <div class="persona-avatar">${escHtml(mark)}</div>
                  <div>
                    <div class="persona-name">${escHtml(s.leadName || '未知角色')}</div>
                    <div class="persona-role">${escHtml(s.phaseLabel || '')}主导</div>
                  </div>
                </div>
                <div class="persona-text">${escHtml(s.text || '')}</div>
              </div>
              <div class="scene-relation-note">${escHtml(relLine)}</div>
            </div>
          </div>`;
      }).join('');
    } else {
      scenesEl.innerHTML = `<div class="drama-locked-hint">这颗星没有保存完整正文，只留下了因果关键词。</div>`;
    }
  }

  document.getElementById('starDetailOverlay').classList.add('show');
  document.getElementById('starDetailSheet').classList.add('show');
}
function closeStarDetail() {
  document.getElementById('starDetailOverlay').classList.remove('show');
  document.getElementById('starDetailSheet').classList.remove('show');
}

function renderGalaxy(highlightNew) {
  const svg = document.getElementById('galaxySvg');
  const gExisting = document.getElementById('galaxyExisting');
  const stars = loadGalaxyStars();
  gExisting.innerHTML = '';

  const cx = 195, cy = 280;
  /* core glow */
  const core = document.createElementNS('http://www.w3.org/2000/svg','circle');
  core.setAttribute('cx', cx); core.setAttribute('cy', cy); core.setAttribute('r', 70);
  core.setAttribute('fill', 'url(#galaxyCoreGlow)');
  gExisting.appendChild(core);

  stars.forEach((star, i) => {
    const angle = (star.angle != null) ? star.angle : (i * 47) % 360;
    const dist = 40 + (i % 6) * 32 + Math.floor(i / 6) * 8;
    const rad = angle * Math.PI / 180;
    const x = cx + dist * Math.cos(rad);
    const y = cy + dist * 0.72 * Math.sin(rad) - 10;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'galaxy-star-hit');
    const hitArea = document.createElementNS('http://www.w3.org/2000/svg','circle');
    hitArea.setAttribute('cx', x); hitArea.setAttribute('cy', y); hitArea.setAttribute('r', 14);
    hitArea.setAttribute('fill', 'transparent');
    const glow = document.createElementNS('http://www.w3.org/2000/svg','circle');
    glow.setAttribute('cx', x); glow.setAttribute('cy', y); glow.setAttribute('r', 9);
    glow.setAttribute('fill', 'url(#starGlow)'); glow.setAttribute('opacity', '0.5');
    const dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
    dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('r', 2.4);
    dot.setAttribute('fill', '#0a0a0a'); dot.setAttribute('class', 'galaxy-star');
    g.appendChild(hitArea); g.appendChild(glow); g.appendChild(dot);
    g.addEventListener('click', () => openStarDetail(star));
    gExisting.appendChild(g);
  });

  /* Scattered ambient micro-stars for texture */
  for (let i = 0; i < 26; i++) {
    const sx = 20 + Math.random() * 350;
    const sy = 20 + Math.random() * 520;
    const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
    c.setAttribute('cx', sx); c.setAttribute('cy', sy); c.setAttribute('r', Math.random() * 0.8 + 0.4);
    c.setAttribute('fill', '#c8c0d8'); c.setAttribute('opacity', (0.2 + Math.random() * 0.3).toFixed(2));
    gExisting.insertBefore(c, gExisting.firstChild.nextSibling);
  }
}

function joinGalaxy() {
  const stars = loadGalaxyStars();
  const theme = _castAnalysis?.theme || (_slots.cause + ' → ' + _slots.twist + ' → ' + _slots.result);
  const starName = generateStarName(theme);
  const angle = (stars.length * 47 + Math.random() * 20) % 360;

  /* 把这一段因果完整的剧情正文（每一幕的角色 + 文本）随星星一起存下来，
     这样之后点开这颗星的详情，还能完整回顾当时演绎出的内容 */
  const scenesSnapshot = (_dramaScenes || []).filter(s => s.generated && s.text).map(s => {
    const lead = findMember(s.leadId);
    const supports = (s.supportIds || []).map(findMember).filter(Boolean);
    return {
      phase: s.phase,
      phaseLabel: s.phaseLabel,
      leadName: lead ? lead.name : '未知角色',
      supportNames: supports.map(m => m.name),
      text: s.text,
    };
  });

  stars.push({
    id: 'star_' + Date.now(),
    name: starName,
    theme,
    cause: _slots.cause, twist: _slots.twist, result: _slots.result,
    createdAt: Date.now(),
    angle,
    scenes: scenesSnapshot,
  });
  saveGalaxyStars(stars);

  renderGalaxy(true);

  /* animate new star birth */
  const gNew = document.getElementById('galaxyNewStar');
  gNew.innerHTML = '';
  const cx = 195, cy = 280;
  const dist = 40 + ((stars.length - 1) % 6) * 32 + Math.floor((stars.length - 1) / 6) * 8;
  const rad = angle * Math.PI / 180;
  const x = cx + dist * Math.cos(rad);
  const y = cy + dist * 0.72 * Math.sin(rad) - 10;

  const ring = document.createElementNS('http://www.w3.org/2000/svg','circle');
  ring.setAttribute('cx', x); ring.setAttribute('cy', y); ring.setAttribute('r', 1);
  ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', '#0a0a0a'); ring.setAttribute('stroke-width', '1');
  ring.setAttribute('opacity', '0.8');
  gNew.appendChild(ring);

  let r = 1;
  const grow = setInterval(() => {
    r += 2.4;
    ring.setAttribute('r', r);
    ring.setAttribute('opacity', Math.max(0, 0.8 - r / 40));
    if (r > 32) clearInterval(grow);
  }, 30);

  const dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
  dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('r', 0);
  dot.setAttribute('fill', '#0a0a0a');
  gNew.appendChild(dot);
  setTimeout(() => { dot.style.transition = 'r 0.6s cubic-bezier(0.34,1.5,0.64,1)'; dot.setAttribute('r', 3); }, 200);

  document.getElementById('galaxyStarName').textContent = '· ' + starName + ' ·';
  document.getElementById('galaxyStarName').classList.add('show');
  document.getElementById('galaxyCaption').textContent = '这颗星，属于「' + theme + '」';

  document.getElementById('galaxyActionsPre').classList.add('hidden');
  document.getElementById('galaxyActionsPost').classList.remove('hidden');

  updateGalaxyEntryBadge();
  gaToast('已并入命运星系');
}

function generateStarName(theme) {
  const short = (theme || '').replace(/[「」]/g, '').slice(0, 6);
  return short ? short + '星' : '无名星';
}

function restartLoom() {
  _slots = { cause: null, twist: null, result: null };
  ['cause','twist','result'].forEach(s => {
    const id = { cause:'inputCause', twist:'inputTwist', result:'inputResult' }[s];
    document.getElementById(id).value = '';
    const slotEl = document.getElementById('slot' + capitalize(s));
    slotEl.classList.remove('filled');
    const ph = { cause: '拖入起因卡片', twist: '拖入转折卡片', result: '拖入结果卡片' }[s];
    slotEl.innerHTML = `<span class="lt-slot-ph">${ph}</span>`;
    _cardEls[s].classList.remove('placed');
  });
  document.getElementById('loomWeaveBtn').classList.add('disabled');
  _castAnalysis = null;
  _dramaScenes = [];
  switchStage('stageLoom');
}

/* ----------------------------------------------------------------
   Boot
---------------------------------------------------------------- */
async function boot() {
  updateTime(); setInterval(updateTime, 30000);
  updateBattery();
  applyIsland();
  loadGroupData();
  _userIdentity = await loadUserIdentity();
  initLoomStage();
  checkWeaveReady();
  updateGalaxyEntryBadge();
}
document.addEventListener('DOMContentLoaded', boot);