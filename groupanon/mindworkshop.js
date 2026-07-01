/* ================================
   mindworkshop.js — 思维工坊
   玩法：用户在画布中心写下一个中心词 → 每个群成员按人设延伸出
         自己的分支 → 分支下再联想出若干子节点（数量随机不固定）
         → 拼成一张可拖动缩放的巨型思维导图 → 点击节点看具体联想内容
================================ */

/* ----------------------------------------------------------------
   Status bar utilities (1:1 from groupanon.js)
---------------------------------------------------------------- */
function updateTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeStr = new Date().toLocaleTimeString('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const el = document.getElementById('statusTime');
  if (el) el.textContent = timeStr;
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
  if (e.key === 'luna_tz_update')     updateTime();
});

/* ----------------------------------------------------------------
   State
---------------------------------------------------------------- */
let _groupMembers = [];
let _groupName    = 'GROUP';
let _usingDemoMembers = false;
let _userIdentity = null;
let _userGender   = null;

let _seedWord     = '';
let _seedTopic    = '';
let _mwNodes      = [];   // flat list: { id, type:'seed'|'member'|'leaf', parentId, member, text, angle, radius, x, y, detail, detailLoading, children:[] }
let _mwNextId     = 1;

/* History: every completed/in-progress workshop is kept, keyed by session id,
   so switching between past mind maps never re-triggers generation for
   content that was already produced. Only nodes without a cached `detail`
   (or member branches not yet expanded) will call the API again. */
let _mwSessionId  = null;
let _mwHistory    = [];   // [{ id, seedWord, seedTopic, createdAt, nodes: [...] }]

/* Canvas transform state */
let _mwScale  = 1;
let _mwTx     = 0;
let _mwTy     = 0;
let _mwDragging = false;
let _mwLastPointer = null;
let _mwPinchStartDist = null;
let _mwPinchStartScale = 1;

/* Palette for member branch accent colors — desaturated pastels, no beige */
const MW_PALETTE = ['#b9c6e0', '#d3bcd6', '#bcd6c9', '#c3c9e6', '#dbc2c8', '#c9d1b8', '#b8cdd6', '#d6c3e0'];

/* ----------------------------------------------------------------
   Fallback demo members (kept consistent with groupanon.js)
---------------------------------------------------------------- */
const DEMO_MEMBERS = [
  {
    id:'m1', name:'萧沐白', initial:'萧', avatar:null, role:'admin',
    bio:'冷峻、寡言，外表疏离实则内心细腻。是这个群的大哥，对弟弟妹妹们有保护欲但嘴上不说。',
    relations: {
      m2: { callName:'清欢', relationship:'青梅竹马，从小认识，心里有点特别但绝口不提' },
      m3: { callName:'老三', relationship:'发小，互相看不顺眼但关键时刻都挺对方' },
      m4: { callName:'小四', relationship:'最小的弟弟，暗中关照，表面淡漠' },
    }
  },
  {
    id:'m2', name:'林清欢', initial:'林', avatar:null, role:'member',
    bio:'温柔体贴，习惯用玩笑话掩盖在意。在这个群里排行老二，最会察言观色。',
    relations: {
      m1: { callName:'沐白哥', relationship:'青梅竹马，从小认识，对他有说不清的情愫' },
      m3: { callName:'辞年', relationship:'室友般的关系，什么都聊，但经常被他气到' },
      m4: { callName:'鹿鸣', relationship:'像对小弟弟，看他开心就开心' },
    }
  },
  {
    id:'m3', name:'顾辞年', initial:'顾', avatar:null, role:'member',
    bio:'毒舌但护短，嘴硬心软的双子座。排行老三，嘴上最刻薄，心里最义气。',
    relations: {
      m1: { callName:'大哥', relationship:'死党，明面上互怼，私下最能说心里话' },
      m2: { callName:'二姐', relationship:'经常被她说教，但其实很信任她' },
      m4: { callName:'小白', relationship:'时常欺负他，其实最怕他受委屈' },
    }
  },
  {
    id:'m4', name:'白鹿鸣', initial:'白', avatar:null, role:'member',
    bio:'开朗活泼，藏不住情绪的透明人。群里最小，什么都写在脸上，傻白甜但心思比看起来细。',
    relations: {
      m1: { callName:'沐白哥', relationship:'最崇拜的人，一直想在他面前显得成熟一点' },
      m2: { callName:'清欢姐', relationship:'最亲的姐姐，什么都跟她说' },
      m3: { callName:'辞年哥', relationship:'表面上怕他，其实根本没在怕' },
    }
  },
];

/* ----------------------------------------------------------------
   Load user identity (persona) from IndexedDB LunaIdentityDB
---------------------------------------------------------------- */
async function loadUserIdentity() {
  try {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open('LunaIdentityDB');
      req.onsuccess = e => res(e.target.result);
      req.onerror   = () => rej(new Error('no db'));
    });
    if (!db.objectStoreNames.contains('identities')) { db.close(); return null; }
    const list = await new Promise(res => {
      const r = db.transaction('identities').objectStore('identities').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror   = () => res([]);
    });
    db.close();
    if (!list.length) return null;
    return list.find(i => i.active !== false) || list[0];
  } catch(e) { return null; }
}

function deriveGender(identity) {
  if (!identity) return null;
  const src = [
    identity.gender || '', identity.desc || '',
    (identity.tags || []).join(' '), identity.role || '',
  ].join(' ').toLowerCase();
  if (/女|she|her|girl|lady/.test(src))  return 'female';
  if (/男|he|him|boy|guy/.test(src))     return 'male';
  return null;
}

function userPronoun() {
  if (_userGender === 'female') return '她';
  if (_userGender === 'male')   return '他';
  return 'TA';
}

function userDisplayName() { return _userIdentity?.name || '群主'; }

function buildUserBrief() {
  if (!_userIdentity) return '群组的创建者，其他信息未知。';
  const parts = [];
  if (_userIdentity.role)  parts.push(_userIdentity.role);
  if (_userIdentity.desc)  parts.push(_userIdentity.desc);
  if (_userIdentity.tags && _userIdentity.tags.length) parts.push('标签：' + _userIdentity.tags.join('、'));
  if (_userIdentity.gender) parts.push(_userIdentity.gender);
  return parts.length ? parts.join('；') : '群组的创建者。';
}

/* ----------------------------------------------------------------
   Load group data from localStorage (written by groupchat.js)
---------------------------------------------------------------- */
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
        _groupMembers = members.map(m => ({
          ...m,
          initial: m.initial || (m.name ? m.name[0] : '?'),
          avatar:  m.avatar  || m.avatarUrl || m.icon || null,
        }));
      } else {
        _groupMembers = DEMO_MEMBERS;
        _usingDemoMembers = true;
      }
    } else {
      _groupMembers = DEMO_MEMBERS;
      _usingDemoMembers = true;
    }
  } catch(e) {
    _groupMembers = DEMO_MEMBERS;
    _usingDemoMembers = true;
  }
  if (_groupMembers.length < 2) {
    _groupMembers = [..._groupMembers, ...DEMO_MEMBERS].slice(0, 4);
    _usingDemoMembers = true;
  }
}

/* ----------------------------------------------------------------
   Character brief + relationship context (1:1 logic from groupanon.js)
---------------------------------------------------------------- */
function buildMemberBrief(member) {
  const roleLabel = member.role === 'admin' ? '群管理员' : '普通群成员';
  const parts = [];
  const mainDesc = (member.desc || member.bio || '').trim();
  if (mainDesc) parts.push(mainDesc);
  if (member.traits && member.traits.length) parts.push('性格标签：' + member.traits.join('、'));
  if (member.gender) parts.push(member.gender);
  if (member.age)    parts.push(member.age + '岁');
  const customPrompt = (member.prompt || '').trim();
  if (customPrompt) parts.push('角色设定：' + customPrompt);
  if (parts.length > 0) return `${parts.join('；')}（身份：${roleLabel}）`;
  return `群内${roleLabel}，名字是「${member.name}」。请根据名字赋予一个具体一致的性格，并在整个对话中严格保持。`;
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
      const relPart  = rel.relationship ? `，${rel.relationship}` : '';
      return `- 对「${other.name}」：${callPart}${relPart}`;
    }
    return `- 对「${other.name}」：直接叫「${other.name}」`;
  });
  return `\n【你和群内其他人的称呼与关系——说话时必须用这里的称呼，不能乱叫】\n${lines.join('\n')}`;
}

/* Short one-line "怎么称呼你、什么关系" summary used inside sheet UI (relative to user) */
function relationLineForUser(member) {
  /* We don't necessarily have an explicit relations entry for the user persona,
     so degrade gracefully: prefer explicit relation set by groupchat.js under
     a synthetic 'user' key, otherwise just state role. */
  const relToUser = member.relations && (member.relations['user'] || member.relations['USER']);
  if (relToUser) {
    const call = relToUser.callName ? `叫你「${relToUser.callName}」` : '';
    const rel  = relToUser.relationship || '';
    return [call, rel].filter(Boolean).join(' · ');
  }
  return member.role === 'admin' ? '群管理员' : '群成员';
}

/* ----------------------------------------------------------------
   AI API call — reuses settings written by settings.js
---------------------------------------------------------------- */
function getLunaApiConfig() {
  let cur = {};
  try { cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}'); } catch(e) {}
  const baseUrl = (cur.baseUrl || '').trim().replace(/\/$/, '');
  const apiKey  = (cur.apiKey  || '').trim();
  const model   = (localStorage.getItem('luna_api_model') || cur.model || '').trim();
  return { baseUrl, apiKey, model };
}

async function callClaude(prompt, systemPrompt, maxTokens) {
  const { baseUrl, apiKey, model } = getLunaApiConfig();
  if (!baseUrl || !apiKey || !model) throw new Error('NO_API_CONFIG');

  const isAnthropic = baseUrl.includes('anthropic.com');
  let res, data, reply;

  if (isAnthropic) {
    const body = { model, max_tokens: maxTokens || 500, messages: [{ role: 'user', content: prompt }] };
    if (systemPrompt) body.system = systemPrompt;
    res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error('API error ' + res.status + (errText ? ': ' + errText.slice(0, 200) : ''));
    }
    data  = await res.json();
    reply = data.content?.[0]?.text || '';
    if (!reply) {
      const stopReason = data.stop_reason || '';
      throw new Error('API 返回空内容' + (stopReason ? `（stop_reason: ${stopReason}）` : '') + '，请检查模型配置或重试');
    }
  } else {
    const apiBase = baseUrl.replace(/\/v1$/, '') + '/v1';
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });
    res = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens || 500, temperature: 0.95 }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error('API error ' + res.status + (errText ? ': ' + errText.slice(0, 200) : ''));
    }
    data  = await res.json();
    reply = data.choices?.[0]?.message?.content ?? '';
    if (reply === null || reply === undefined || reply === '') {
      const finishReason = data.choices?.[0]?.finish_reason || '';
      const errMsg = data.error?.message || '';
      if (errMsg) throw new Error('API 错误：' + errMsg.slice(0, 100));
      if (finishReason === 'length') {
        throw new Error('API 返回内容为空（max_tokens 太小，模型还没来得及输出正文就被截断了），请调大 max_tokens 后重试');
      }
      throw new Error('API 返回空内容' + (finishReason ? `（finish_reason: ${finishReason}）` : '') + '，可能被内容过滤或 max_tokens 过小');
    }
  }
  return reply.trim();
}

function notifyApiNotConfigured() {
  mwToast('请先在「设置 → API」中配置并选择模型');
}

/* ----------------------------------------------------------------
   Workshop history — persists every generated mind map (including
   already-fetched node detail text) to localStorage, scoped to the
   current group, so nothing generated before is ever lost or
   re-generated. Only nodes that were never expanded/detailed will
   trigger a fresh API call when revisited.
---------------------------------------------------------------- */
let _mwSessionCreatedAt = null;

function mwHistoryStorageKey() {
  return 'luna_mindworkshop_history__' + (_groupName || 'default');
}

function loadMwHistory() {
  try {
    const raw = localStorage.getItem(mwHistoryStorageKey());
    _mwHistory = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(_mwHistory)) _mwHistory = [];
  } catch(e) {
    _mwHistory = [];
  }
}

function saveMwHistory() {
  try {
    localStorage.setItem(mwHistoryStorageKey(), JSON.stringify(_mwHistory));
  } catch(e) {
    console.error('[saveMwHistory] failed to persist history', e);
  }
}

/* Save/update the current in-progress or finished session into history.
   Called after every meaningful change (branch generated, detail fetched)
   so nothing is lost even if the user leaves mid-generation. */
function persistCurrentSession() {
  if (!_mwSessionId) return;
  const record = {
    id: _mwSessionId,
    seedWord: _seedWord,
    seedTopic: _seedTopic,
    createdAt: _mwSessionCreatedAt || Date.now(),
    updatedAt: Date.now(),
    nodes: _mwNodes,
  };
  const idx = _mwHistory.findIndex(h => h.id === _mwSessionId);
  if (idx >= 0) _mwHistory[idx] = record;
  else _mwHistory.unshift(record);
  saveMwHistory();
  renderHistoryPreviewBtn();
}

function deleteHistoryEntry(id) {
  _mwHistory = _mwHistory.filter(h => h.id !== id);
  saveMwHistory();
  renderHistoryList();
  renderHistoryPreviewBtn();
}

/* Restore a past session from history onto the canvas. All cached node
   detail text comes along, so reopening any node that was previously
   viewed shows instantly with zero API calls. */
function openHistoryEntry(id) {
  const record = _mwHistory.find(h => h.id === id);
  if (!record) return;
  _mwSessionId = record.id;
  _mwSessionCreatedAt = record.createdAt;
  _seedWord = record.seedWord;
  _seedTopic = record.seedTopic || '';
  _mwNodes = (record.nodes || []).map(n => ({ ...n }));
  _mwNextId = 1;
  switchMwView('canvas');
  renderCanvas();
  mwRecenter(true);
  closeHistorySheet();
  mwToast('已还原历史思维地图，之前生成过的内容都会直接显示');
}

/* ----------------------------------------------------------------
   safeParseJSON (1:1 from groupanon.js)
---------------------------------------------------------------- */
function safeParseJSON(raw, isArray) {
  if (!raw) throw new Error('empty response');
  let s = raw.replace(/```json[\s\S]*?```|```[\s\S]*?```/g, m => m.replace(/```json|```/g, '')).trim();
  try { return JSON.parse(s); } catch(e) {}
  const opener = isArray ? '[' : '{';
  const closer = isArray ? ']' : '}';
  const start = s.indexOf(opener);
  const end   = s.lastIndexOf(closer);
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(s.slice(start, end + 1)); } catch(e) {}
  }
  const m1 = s.match(/(\{[\s\S]*\})/);
  const m2 = s.match(/(\[[\s\S]*\])/);
  const candidate = isArray ? (m2?.[1] || m1?.[1]) : (m1?.[1] || m2?.[1]);
  if (candidate) return JSON.parse(candidate);
  throw new Error('JSON not found in: ' + s.slice(0, 100));
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ----------------------------------------------------------------
   Seed input UI
---------------------------------------------------------------- */
function onSeedInput(el) {
  const remaining = 16 - el.value.length;
  const countEl = document.getElementById('mwSeedCount');
  if (countEl) countEl.textContent = remaining;
  const btn = document.getElementById('mwSeedGoBtn');
  if (btn) btn.classList.toggle('disabled', el.value.trim().length === 0);
}

function onSeedKeydown(e) {
  if (e.key === 'Enter') { e.preventDefault(); startWorkshop(); }
}

function renderMemberPreview() {
  const el = document.getElementById('mwMemberPreview');
  if (!el) return;
  const avatars = _groupMembers.slice(0, 5).map(m => {
    const inner = m.avatar
      ? `<img src="${escHtml(m.avatar)}" alt="${escHtml(m.initial)}" onerror="this.parentElement.textContent='${escHtml(m.initial)}'"/>`
      : escHtml(m.initial);
    return `<div class="mw-mp-av">${inner}</div>`;
  }).join('');
  el.innerHTML = avatars + `<span class="mw-mp-label">${_groupMembers.length} 位成员待命</span>`;
}

/* ----------------------------------------------------------------
   Workshop lifecycle
---------------------------------------------------------------- */
function switchMwView(name) {
  document.getElementById('viewSeed')?.classList.toggle('active', name === 'seed');
  document.getElementById('viewCanvas')?.classList.toggle('active', name === 'canvas');
  const eyebrow = document.getElementById('headerEyebrow');
  const title   = document.getElementById('headerTitleText');
  if (name === 'seed') {
    if (eyebrow) eyebrow.textContent = 'GROUP · FEATURE';
    if (title)   title.innerHTML = '思维工坊 <span class="header-badge">MIND MAP</span>';
  } else {
    if (eyebrow) eyebrow.textContent = 'GROUP · CANVAS';
    if (title)   title.innerHTML = '思维地图 <span class="header-badge">LIVE</span>';
  }
}

function handleBack() {
  if (document.getElementById('mwNodeSheet')?.classList.contains('open')) { closeNodeSheet(); return; }
  if (document.getElementById('viewCanvas')?.classList.contains('active')) { resetWorkshop(); return; }
  if (localStorage.getItem('luna_groupanon_from') === 'groupchat') { history.back(); return; }
  history.back();
}

function resetWorkshop() {
  _mwNodes = [];
  _mwNextId = 1;
  _mwSessionId = null;
  _mwSessionCreatedAt = null;
  switchMwView('seed');
  const input = document.getElementById('mwSeedInput');
  if (input) { input.value = ''; onSeedInput(input); input.focus(); }
  renderHistoryList();
}

async function startWorkshop() {
  const input = document.getElementById('mwSeedInput');
  const word  = (input?.value || '').trim();
  if (!word) return;
  _seedWord  = word;
  _seedTopic = (document.getElementById('mwTopicInput')?.value || '').trim();

  openGenOverlay('正在为每个人铺开思路…', 0, _groupMembers.length);
  switchMwView('canvas');

  /* Every new seed word starts a brand-new session id so it's saved as its
     own entry in history, never overwriting previously generated maps. */
  _mwSessionId = 'mw_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  _mwSessionCreatedAt = Date.now();
  _mwNodes = [];
  _mwNextId = 1;
  const seed = {
    id: 'seed', type: 'seed', parentId: null,
    text: _seedWord, x: 0, y: 0,
  };
  _mwNodes.push(seed);
  renderCanvas();
  mwRecenter(true);
  persistCurrentSession();

  /* Generate one branch per member, staggered so the canvas fills in visibly */
  const total = _groupMembers.length;
  let done = 0;
  const memberAngleStep = (Math.PI * 2) / Math.max(total, 1);

  for (let i = 0; i < total; i++) {
    const member = _groupMembers[i];
    const angle  = -Math.PI / 2 + i * memberAngleStep; // start pointing up, go clockwise
    updateGenOverlay(`${member.name} 正在从「${_seedWord}」联想…`, done, total);
    try {
      await generateMemberBranch(member, angle, i);
    } catch(err) {
      console.error('[startWorkshop] branch failed for', member.name, err);
      if (err.message === 'NO_API_CONFIG') { closeGenOverlay(); notifyApiNotConfigured(); return; }
    }
    done++;
    updateGenOverlay(`${member.name} 已完成`, done, total);
    renderCanvas();
    persistCurrentSession();
  }

  closeGenOverlay();
  mwToast('思维地图已展开，点击任意节点查看细节');
}

/* ----------------------------------------------------------------
   Generate one member's branch: member node + a random set (>=2) of
   leaf/derived-word nodes, positioned radially around the seed.
---------------------------------------------------------------- */
async function generateMemberBranch(member, baseAngle, memberIdx) {
  const brief    = buildMemberBrief(member);
  const castLine = buildGroupCastLine(member.id);
  const relCtx   = buildRelationContext(member);
  const userName = userDisplayName();
  const userBrief = buildUserBrief();
  const pronoun  = userPronoun();

  const systemPrompt = `你正在扮演群聊成员「${member.name}」，参与一个叫「思维工坊」的群体思维导图游戏。
玩法：群主「${userName}」在画布中心写下一个词，你要顺着这个词，按照你自己的性格、说话习惯、思维方式去自由联想延伸出若干个词或短语，作为你这条分支下的子节点。

【这个人是谁】
${brief}

【群里的其他成员】（你认识他们，联想角度和他们完全不一样）
${castLine || '暂无其他成员'}${relCtx}

【发起这个中心词的群主是谁】
群主叫「${userName}」。${userBrief}
这个中心词就是${pronoun}写下的，你在心里知道这一点。

【绝对不能OOC——这是最高优先级要求】
你联想出来的每一个词、说话的口吻，都必须严格符合你自己的性格设定。冷峻的人不会突然感性抒情，毒舌的人不会突然温柔，活泼的人不会突然沉闷。宁可联想角度收窄，也不能让语气或用词偏离人设。`;

  const topicHint = _seedTopic ? `\n群主给了一个方向提示："${_seedTopic}"，可以参考，但不要生硬照搬。` : '';

  const prompt = `中心词是："${_seedWord}"${topicHint}

请你以「${member.name}」的身份和性格，围绕这个中心词自由联想延伸。
要求：
- 联想出的分支词数量不固定，由你自己决定，但不能少于3个，也不要超过7个，具体几个由你根据这个词能激发出多少真实的念头来定，不要为了凑数硬编
- 每个分支词要短（2-8个字最佳），是一个词、短语或者一句很短的念头，不是句子
- 分支词之间要体现真实的联想跳跃感（可以从画面、回忆、情绪、具体的人或事、感官细节等不同角度切入），不要都停留在同一个层面
- 联想角度必须和你的性格强相关，要能让人一眼看出"这是${member.name}会想到的东西"，换成群里任何一个其他人来想，结果都应该明显不一样
- 不要出现任何解释性文字、不要标点符号收尾、不要emoji

只输出一个JSON数组，格式如下，不要有任何多余文字、前缀、解释或markdown代码块标记：
["分支词1","分支词2","分支词3"]`;

  const raw = await callClaude(prompt, systemPrompt, 500);
  let leaves;
  try {
    leaves = safeParseJSON(raw, true);
    if (!Array.isArray(leaves)) throw new Error('not array');
  } catch(e) {
    /* fallback: split by common delimiters */
    leaves = raw.split(/[，,、\n]+/).map(s => s.trim()).filter(Boolean).slice(0, 5);
  }
  leaves = leaves.map(s => String(s).trim()).filter(Boolean);
  if (leaves.length < 2) leaves = [...leaves, '（暂无更多联想）'].slice(0, 2);
  if (leaves.length > 8) leaves = leaves.slice(0, 8);

  /* Position: member node sits at fixed radius around seed; leaves fan out further */
  const memberRadius = 210;
  const mx = Math.cos(baseAngle) * memberRadius;
  const my = Math.sin(baseAngle) * memberRadius;

  const memberNodeId = 'mem_' + member.id;
  const memberNode = {
    id: memberNodeId, type: 'member', parentId: 'seed',
    member, text: member.name, x: mx, y: my,
    colorIdx: memberIdx % MW_PALETTE.length,
  };
  _mwNodes.push(memberNode);

  const leafRadius = 130;
  const spreadAngle = Math.min(Math.PI * 0.62, 0.34 * leaves.length);
  leaves.forEach((word, li) => {
    const t = leaves.length === 1 ? 0.5 : li / (leaves.length - 1);
    const leafAngle = baseAngle + (t - 0.5) * spreadAngle;
    const lx = mx + Math.cos(leafAngle) * leafRadius;
    const ly = my + Math.sin(leafAngle) * leafRadius;
    _mwNodes.push({
      id: memberNodeId + '_leaf_' + li, type: 'leaf', parentId: memberNodeId,
      member, text: word, x: lx, y: ly,
      colorIdx: memberIdx % MW_PALETTE.length,
    });
  });
}

/* ----------------------------------------------------------------
   Generation overlay
---------------------------------------------------------------- */
function openGenOverlay(text, done, total) {
  const ov = document.getElementById('mwGenOverlay');
  if (ov) ov.classList.add('open');
  updateGenOverlay(text, done, total);
}
function updateGenOverlay(text, done, total) {
  const t = document.getElementById('mwGenText');
  const s = document.getElementById('mwGenSub');
  const f = document.getElementById('mwGenProgressFill');
  if (t) t.textContent = text;
  if (s) s.textContent = `${done} / ${total}`;
  if (f) f.style.width = total > 0 ? Math.round((done / total) * 100) + '%' : '0%';
}
function closeGenOverlay() {
  document.getElementById('mwGenOverlay')?.classList.remove('open');
}

/* ----------------------------------------------------------------
   Canvas rendering
---------------------------------------------------------------- */
function renderCanvas() {
  const nodesLayer = document.getElementById('mwNodesLayer');
  const svg = document.getElementById('mwSvg');
  if (!nodesLayer || !svg) return;

  /* Nodes */
  nodesLayer.innerHTML = _mwNodes.map(n => buildNodeHtml(n)).join('');

  /* Connector lines */
  const lines = _mwNodes.filter(n => n.parentId).map(n => {
    const parent = _mwNodes.find(p => p.id === n.parentId);
    if (!parent) return '';
    const color = n.colorIdx !== undefined ? MW_PALETTE[n.colorIdx] : '#c7c7ca';
    return `<line x1="${parent.x}" y1="${parent.y}" x2="${n.x}" y2="${n.y}" stroke="${color}" stroke-width="${n.type === 'member' ? 1.4 : 1}" stroke-dasharray="${n.type === 'member' ? 'none' : '2 5'}" opacity="${n.type === 'member' ? 0.75 : 0.55}"/>`;
  }).join('');
  svg.innerHTML = lines;
  svg.setAttribute('width', 4000);
  svg.setAttribute('height', 4000);
  svg.style.left = '-2000px';
  svg.style.top  = '-2000px';
  svg.setAttribute('viewBox', '-2000 -2000 4000 4000');

  /* Stats */
  const total = _mwNodes.length;
  const countChip = document.getElementById('mwCountChip');
  const footerCount = document.getElementById('mwFooterCount');
  if (countChip) countChip.textContent = total + ' 个节点';
  if (footerCount) footerCount.textContent = total;
  const seedChipText = document.getElementById('mwSeedChipText');
  if (seedChipText) seedChipText.textContent = _seedWord;
}

function buildNodeHtml(n) {
  const style = `left:${n.x}px; top:${n.y}px;`;
  if (n.type === 'seed') {
    return `
    <div class="mw-node" style="${style}" onclick="openNodeSheet('${n.id}')">
      <div class="mw-node-core">
        <span class="mw-node-core-tag">CENTER</span>
        ${escHtml(n.text)}
      </div>
    </div>`;
  }
  if (n.type === 'member') {
    const color = MW_PALETTE[n.colorIdx];
    const avInner = n.member.avatar
      ? `<img src="${escHtml(n.member.avatar)}" alt="${escHtml(n.member.initial || '?')}" onerror="this.parentElement.textContent='${escHtml(n.member.initial||'?')}'"/>`
      : escHtml(n.member.initial || n.member.name?.[0] || '?');
    const roleLabel = n.member.role === 'admin' ? 'ADMIN' : 'MEMBER';
    return `
    <div class="mw-node" style="${style}" onclick="openNodeSheet('${n.id}')">
      <div class="mw-node-member" style="border-color:${color};">
        <div class="mw-node-member-av" style="box-shadow:0 0 0 2px ${color}, 0 2px 6px rgba(0,0,0,0.08);">${avInner}</div>
        <div class="mw-node-member-name">${escHtml(n.member.name)}</div>
        <div class="mw-node-member-role">${roleLabel}</div>
      </div>
    </div>`;
  }
  /* leaf */
  const color = MW_PALETTE[n.colorIdx] || '#c7c7ca';
  return `
  <div class="mw-node" style="${style}" onclick="openNodeSheet('${n.id}')">
    <div class="mw-node-leaf">
      <div class="mw-node-leaf-dot" style="background:${color};"></div>
      ${escHtml(n.text)}
    </div>
  </div>`;
}

/* ----------------------------------------------------------------
   Canvas transform (pan + zoom) — pointer + wheel + touch pinch
---------------------------------------------------------------- */
function applyMwTransform() {
  const stage = document.getElementById('mwStage');
  const grid  = document.getElementById('mwGrid');
  if (stage) stage.style.transform = `translate(${_mwTx}px, ${_mwTy}px) scale(${_mwScale})`;
  if (grid)  grid.style.transform  = `translate(${_mwTx}px, ${_mwTy}px) scale(${_mwScale})`;
}

function mwRecenter(instant) {
  const viewport = document.getElementById('mwViewport');
  if (!viewport) return;
  const rect = viewport.getBoundingClientRect();
  _mwScale = 1;
  _mwTx = rect.width / 2;
  _mwTy = rect.height / 2;
  applyMwTransform();
}

function mwZoomBy(factor) {
  const viewport = document.getElementById('mwViewport');
  if (!viewport) return;
  const rect = viewport.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const newScale = Math.min(2.5, Math.max(0.35, _mwScale * factor));
  /* zoom around viewport center, keep the point under center fixed */
  const wx = (cx - _mwTx) / _mwScale;
  const wy = (cy - _mwTy) / _mwScale;
  _mwScale = newScale;
  _mwTx = cx - wx * _mwScale;
  _mwTy = cy - wy * _mwScale;
  applyMwTransform();
}

function setupCanvasInteraction() {
  const viewport = document.getElementById('mwViewport');
  if (!viewport) return;

  viewport.addEventListener('pointerdown', e => {
    if (e.target.closest('.mw-node')) return; /* let node clicks through */
    _mwDragging = true;
    _mwLastPointer = { x: e.clientX, y: e.clientY };
    viewport.classList.add('dragging');
    viewport.setPointerCapture(e.pointerId);
  });
  viewport.addEventListener('pointermove', e => {
    if (!_mwDragging || !_mwLastPointer) return;
    const dx = e.clientX - _mwLastPointer.x;
    const dy = e.clientY - _mwLastPointer.y;
    _mwTx += dx; _mwTy += dy;
    _mwLastPointer = { x: e.clientX, y: e.clientY };
    applyMwTransform();
  });
  const endDrag = e => {
    _mwDragging = false;
    _mwLastPointer = null;
    viewport.classList.remove('dragging');
  };
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);
  viewport.addEventListener('pointerleave', endDrag);

  viewport.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.08 : 0.93;
    const newScale = Math.min(2.5, Math.max(0.35, _mwScale * factor));
    const wx = (cx - _mwTx) / _mwScale;
    const wy = (cy - _mwTy) / _mwScale;
    _mwScale = newScale;
    _mwTx = cx - wx * _mwScale;
    _mwTy = cy - wy * _mwScale;
    applyMwTransform();
  }, { passive: false });

  /* Touch pinch-to-zoom */
  viewport.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      _mwPinchStartDist = touchDist(e.touches);
      _mwPinchStartScale = _mwScale;
    }
  }, { passive: true });
  viewport.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && _mwPinchStartDist) {
      e.preventDefault();
      const dist = touchDist(e.touches);
      const factor = dist / _mwPinchStartDist;
      _mwScale = Math.min(2.5, Math.max(0.35, _mwPinchStartScale * factor));
      applyMwTransform();
    }
  }, { passive: false });
  viewport.addEventListener('touchend', e => {
    if (e.touches.length < 2) _mwPinchStartDist = null;
  });

  window.addEventListener('resize', () => {
    if (_mwNodes.length <= 1) mwRecenter();
  });
}

function touchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx*dx + dy*dy);
}

/* ----------------------------------------------------------------
   Node detail sheet — generates >=500-char discussion text per node
---------------------------------------------------------------- */
let _mwActiveNodeId = null;

function openNodeSheet(nodeId) {
  const node = _mwNodes.find(n => n.id === nodeId);
  if (!node) return;
  _mwActiveNodeId = nodeId;

  const overlay = document.getElementById('mwSheetOverlay');
  const sheet   = document.getElementById('mwNodeSheet');
  overlay?.classList.add('open');
  sheet?.classList.add('open');

  const avEl       = document.getElementById('mwNsAv');
  const eyebrowEl  = document.getElementById('mwNsEyebrow');
  const titleEl    = document.getElementById('mwNsTitle');
  const badgeEl    = document.getElementById('mwNsBadge');
  const relTagEl   = document.getElementById('mwNsRelation');
  const relTextEl  = document.getElementById('mwNsRelationText');
  const loadingEl  = document.getElementById('mwNsLoading');
  const textEl     = document.getElementById('mwNsText');
  const deriveRow  = document.getElementById('mwNsDeriveRow');

  /* Reset derive chips (keep label) */
  if (deriveRow) {
    deriveRow.querySelectorAll('.mw-ns-derive-chip').forEach(c => c.remove());
  }

  if (node.type === 'seed') {
    if (avEl) avEl.textContent = '·';
    if (eyebrowEl) eyebrowEl.textContent = 'CENTER WORD';
    if (titleEl) titleEl.textContent = node.text;
    if (badgeEl) badgeEl.textContent = 'L0';
    if (relTagEl) relTagEl.style.display = 'none';
    if (loadingEl) loadingEl.style.display = 'none';
    if (textEl) textEl.innerHTML = `<p>这是本次思维工坊的中心词，由「${escHtml(userDisplayName())}」写下。围绕它，群里每个人都会顺着自己的性格延伸出完全不同的联想分支——点击外圈的头像节点，看看每个人各自都想到了什么。</p>`;
    if (deriveRow) {
      const childCount = _mwNodes.filter(n => n.parentId === 'seed').length;
      deriveRow.style.display = childCount ? 'flex' : 'none';
      _mwNodes.filter(n => n.parentId === 'seed').forEach(c => {
        const chip = document.createElement('div');
        chip.className = 'mw-ns-derive-chip';
        chip.textContent = c.text;
        deriveRow.appendChild(chip);
      });
    }
    return;
  }

  const member = node.member;
  const avInner = member.avatar
    ? `<img src="${escHtml(member.avatar)}" alt="${escHtml(member.initial||'?')}" onerror="this.parentElement.textContent='${escHtml(member.initial||'?')}'"/>`
    : escHtml(member.initial || member.name?.[0] || '?');
  if (avEl) avEl.innerHTML = avInner;
  if (eyebrowEl) eyebrowEl.textContent = node.type === 'member' ? 'MAIN BRANCH' : 'DERIVED NODE';
  if (titleEl) titleEl.textContent = node.type === 'member' ? member.name : node.text;
  if (badgeEl) badgeEl.textContent = node.type === 'member' ? 'L1' : 'L2';

  const relLine = relationLineForUser(member);
  if (relTagEl && relTextEl) {
    if (relLine) { relTextEl.textContent = relLine; relTagEl.style.display = 'inline-flex'; }
    else relTagEl.style.display = 'none';
  }

  /* Derived children chips (for member nodes, show its leaves) */
  if (deriveRow) {
    const children = _mwNodes.filter(n => n.parentId === node.id);
    deriveRow.style.display = children.length ? 'flex' : 'none';
    children.forEach(c => {
      const chip = document.createElement('div');
      chip.className = 'mw-ns-derive-chip';
      chip.textContent = c.text;
      deriveRow.appendChild(chip);
    });
  }

  /* Use cached detail if present, else generate */
  if (node.detail) {
    if (loadingEl) loadingEl.style.display = 'none';
    if (textEl) textEl.innerHTML = formatDetailText(node.detail);
  } else {
    if (loadingEl) loadingEl.style.display = 'flex';
    if (textEl) textEl.innerHTML = '';
    generateNodeDetail(node);
  }
}

function closeNodeSheet() {
  document.getElementById('mwSheetOverlay')?.classList.remove('open');
  document.getElementById('mwNodeSheet')?.classList.remove('open');
  _mwActiveNodeId = null;
}

function formatDetailText(raw) {
  const paras = String(raw).split(/\n+/).map(p => p.trim()).filter(Boolean);
  if (!paras.length) return `<p>${escHtml(raw)}</p>`;
  return paras.map(p => `<p>${escHtml(p)}</p>`).join('');
}

async function generateNodeDetail(node) {
  const member = node.member;
  const brief    = buildMemberBrief(member);
  const castLine = buildGroupCastLine(member.id);
  const relCtx   = buildRelationContext(member);
  const userName = userDisplayName();
  const userBrief = buildUserBrief();
  const pronoun  = userPronoun();

  const focusWord = node.type === 'member' ? _seedWord : node.text;
  const contextLine = node.type === 'member'
    ? `你正在展开你对中心词"${_seedWord}"的第一层联想。`
    : `路径是："${_seedWord}" → 你的分支「${member.name}」 → 这个具体的联想词"${node.text}"。现在要展开的就是这个具体联想词。`;

  const systemPrompt = `你正在扮演群聊成员「${member.name}」，参与「思维工坊」思维导图游戏，此刻要对你自己写下的一个联想节点做详细展开说明，写给正在点开这个节点查看的群主「${userName}」看。

【这个人是谁】
${brief}

【群里的其他成员】
${castLine || '暂无其他成员'}${relCtx}

【正在查看这段内容的群主是谁】
群主叫「${userName}」。${userBrief}
你在心里知道是${pronoun}点开了这个节点，语气可以带一点"说给TA听"的自然感，但不要刻意呼喊群主名字或显得在表演。

【绝对不能OOC——这是最高优先级要求】
展开说明的每一句话、用词习惯、情绪浓度、句子长短，都必须严格贴合你的性格设定。冷峻的人写出来仍然是克制的、留白的；毒舌的人写出来仍然带刺但护短；活泼的人写出来仍然是跳跃松散、藏不住情绪的。绝不能让内容读起来像一段通用的、任何人都能说出来的文字。`;

  const prompt = `${contextLine}

请以「${member.name}」的第一人称视角，围绕"${focusWord}"这个念头，写一段展开说明——具体讲讲你为什么会想到这个、它让你联想到什么画面/回忆/人/感受，可以适度延展到一两个具体细节或小故事，但始终要扣住这个词，不要跑题到完全无关的地方。

硬性要求：
- 字数不少于500字，可以适当多一些，但不要注水堆砌，每一句都要有实际内容
- 全篇第一人称，像是你在认真回应群主"你为什么会想到这个"的追问，但不要用对话体、不要加引号说"我说"，就是一段自然的内心独白式文字
- 语气、用词、情绪表达方式必须百分百符合你的性格，避免使用与你人设不符的抒情腔或书面语
- 可以自然带出你和群里其他成员的关系或小细节，但不要生硬插入人物介绍
- 分2到4个自然段，段落之间用换行分隔
- 不要使用任何emoji、不要使用列表符号、不要加粗记号

只输出这段展开说明本身，不要加任何前缀、标题、引号或解释。`;

  try {
    const detail = await callClaude(prompt, systemPrompt, 3000);
    node.detail = detail;
    persistCurrentSession(); // cache immediately: this node will never call the API again
    if (_mwActiveNodeId === node.id) {
      document.getElementById('mwNsLoading').style.display = 'none';
      document.getElementById('mwNsText').innerHTML = formatDetailText(detail);
    }
  } catch(err) {
    console.error('[generateNodeDetail]', err);
    if (_mwActiveNodeId === node.id) {
      document.getElementById('mwNsLoading').style.display = 'none';
      if (err.message === 'NO_API_CONFIG') {
        document.getElementById('mwNsText').innerHTML = `<p>还没有配置好 AI 接口，请先在「设置 → API」中完成配置后再来查看这段联想。</p>`;
        notifyApiNotConfigured();
      } else {
        document.getElementById('mwNsText').innerHTML = `<p>生成失败：${escHtml(err.message || String(err))}，点击节点可以重试。</p>`;
      }
    }
  }
}

/* ----------------------------------------------------------------
   History sheet — lists every past workshop, all previously generated
   content preserved. Opening any entry restores it instantly with no
   API calls; only genuinely new nodes (added later) would generate.
---------------------------------------------------------------- */
function showHistory() {
  renderHistoryList();
  document.getElementById('sheetOverlay')?.classList.add('open');
  document.getElementById('mwHistorySheet')?.classList.add('open');
}
function closeHistorySheet() {
  document.getElementById('sheetOverlay')?.classList.remove('open');
  document.getElementById('mwHistorySheet')?.classList.remove('open');
}

function mwHistoryCountLabel(record) {
  const total = (record.nodes || []).length;
  const withDetail = (record.nodes || []).filter(n => n.detail).length;
  return `${total} 个节点 · 已生成详情 ${withDetail} 条`;
}

function renderHistoryPreviewBtn() {
  const btn = document.getElementById('mwHistoryEntryBtn');
  if (!btn) return;
  btn.style.display = 'flex';
  const countEl = document.getElementById('mwHistoryEntryCount');
  if (countEl) countEl.textContent = _mwHistory.length;
}

function renderHistoryList() {
  const listEl = document.getElementById('mwHistoryList');
  const emptyEl = document.getElementById('mwHistoryEmpty');
  if (!listEl) return;
  if (!_mwHistory.length) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'flex';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  listEl.innerHTML = _mwHistory.map(record => {
    const date = new Date(record.updatedAt || record.createdAt || Date.now());
    const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
    const isCurrent = record.id === _mwSessionId;
    return `
    <div class="mw-history-item${isCurrent ? ' current' : ''}" onclick="openHistoryEntry('${record.id}')">
      <div class="mw-history-item-main">
        <div class="mw-history-item-word">${escHtml(record.seedWord)}</div>
        <div class="mw-history-item-meta">${dateStr} · ${mwHistoryCountLabel(record)}</div>
      </div>
      <div class="mw-history-item-del" onclick="event.stopPropagation(); deleteHistoryEntry('${record.id}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
      </div>
    </div>`;
  }).join('');
}

/* ----------------------------------------------------------------
   Info sheet
---------------------------------------------------------------- */
function showInfo() {
  document.getElementById('sheetOverlay')?.classList.add('open');
  document.getElementById('infoSheet')?.classList.add('open');
}
function hideInfo() {
  document.getElementById('sheetOverlay')?.classList.remove('open');
  document.getElementById('infoSheet')?.classList.remove('open');
}

/* ----------------------------------------------------------------
   Toast
---------------------------------------------------------------- */
function mwToast(msg) {
  const t = document.getElementById('mwToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ----------------------------------------------------------------
   INIT
---------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
  updateTime();
  updateBattery();
  applyIsland();

  _userIdentity = await loadUserIdentity();
  _userGender   = deriveGender(_userIdentity);

  loadGroupData();
  renderMemberPreview();
  loadMwHistory();
  renderHistoryPreviewBtn();

  if (_usingDemoMembers) {
    setTimeout(() => {
      mwToast('未读取到群成员数据，已使用示例成员');
    }, 800);
  }

  setupCanvasInteraction();
  mwRecenter();

  setInterval(updateTime, 10000);

  const input = document.getElementById('mwSeedInput');
  if (input) setTimeout(() => input.focus(), 300);
});