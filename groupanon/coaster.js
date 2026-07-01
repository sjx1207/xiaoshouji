/* ================================================================
   coaster.js — 情绪过山车
   流程：设计轨道 → 逐人选随身物品(AI生成≥5项) → 发车沿轨道行驶
        → 每个节点生成当前坐席成员的情绪独白(≥800字，居中弹窗，样式按坡度变化)
        → 可切换车厢看同节点其他成员 → 终点生成每人整体心路历程(≥800字)
================================================================ */

/* ----------------------------------------------------------------
   Status bar utilities — 1:1 复刻自 groupanon.js，保证状态栏体验一致
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

function escHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ----------------------------------------------------------------
   safeParseJSON — 兼容各模型在 JSON 前后多输出文字的情况
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

/* ----------------------------------------------------------------
   AI API — 复用设置页已配置的接口（与 groupanon.js 完全一致的调用方式）
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
    const body = { model, max_tokens: maxTokens || 600, messages: [{ role: 'user', content: prompt }] };
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
    data = await res.json();
    reply = data.content?.[0]?.text || '';
    if (!reply) throw new Error('API 返回空内容');
  } else {
    const apiBase = baseUrl.replace(/\/v1$/, '') + '/v1';
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });
    res = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens || 600, temperature: 0.95 }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error('API error ' + res.status + (errText ? ': ' + errText.slice(0, 200) : ''));
    }
    data = await res.json();
    reply = data.choices?.[0]?.message?.content ?? '';
    if (!reply) {
      const errMsg = data.error?.message || '';
      throw new Error(errMsg ? ('API 错误：' + errMsg.slice(0,100)) : 'API 返回空内容');
    }
  }
  return reply.trim();
}

function notifyApiNotConfigured() {
  gaToast('请先在「设置 → API」中配置并选择模型');
}

/* ----------------------------------------------------------------
   Demo members fallback — 与 groupanon.js 保持一致的人设范例
   仅在读取不到真实群成员数据时使用，绝不写死成正式数据源
---------------------------------------------------------------- */
const DEMO_MEMBERS = [
  {
    id:'m1', name:'萧沐白', initial:'萧', avatar:null, role:'admin',
    bio:'冷峻、寡言，外表疏离实则内心细腻。是这个群的大哥，对弟弟妹妹们有保护欲但嘴上不说。',
  },
  {
    id:'m2', name:'林清欢', initial:'林', avatar:null, role:'member',
    bio:'温柔体贴，习惯用玩笑话掩盖在意。在这个群里排行老二，最会察言观色。',
  },
  {
    id:'m3', name:'顾辞年', initial:'顾', avatar:null, role:'member',
    bio:'毒舌但护短，嘴硬心软的双子座。排行老三，嘴上最刻薄，心里最义气。',
  },
  {
    id:'m4', name:'白鹿鸣', initial:'白', avatar:null, role:'member',
    bio:'开朗活泼，藏不住情绪的透明人。群里最小，什么都写在脸上，傻白甜但心思比看起来细。',
  },
];

/* ----------------------------------------------------------------
   Load group members — 与 groupanon.js 读取方式保持一致，
   绝不写死成员，始终优先读取真实群聊数据
---------------------------------------------------------------- */
let _groupMembers   = [];
let _groupName      = 'GROUP';
let _usingDemo       = false;

function loadGroupData() {
  _usingDemo = false;
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
        _groupMembers = DEMO_MEMBERS; _usingDemo = true;
      }
    } else {
      _groupMembers = DEMO_MEMBERS; _usingDemo = true;
    }
  } catch(e) {
    _groupMembers = DEMO_MEMBERS; _usingDemo = true;
  }
  if (_groupMembers.length < 2) {
    _groupMembers = [..._groupMembers, ...DEMO_MEMBERS].slice(0, 4);
    _usingDemo = true;
  }
}

/* ----------------------------------------------------------------
   User identity — 读取 LunaIdentityDB，user 也作为一节车厢的乘客
---------------------------------------------------------------- */
let _userIdentity = null;
let _userGender   = null;

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
  const src = [identity.gender||'', identity.desc||'', (identity.tags||[]).join(' '), identity.role||''].join(' ').toLowerCase();
  if (/女|she|her|girl|lady/.test(src)) return 'female';
  if (/男|he|him|boy|guy/.test(src))    return 'male';
  return null;
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
   Build a rich persona brief for any "rider" (member or user)
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
  if (parts.length) return `${parts.join('；')}（身份：${roleLabel}）`;
  return `群内${roleLabel}，名字是「${member.name}」。请根据名字赋予一个具体一致的性格，并在整个对话中严格保持。`;
}

function renderAvatar(rider, sizeClass) {
  if (rider && rider.avatar) {
    return `<img src="${escHtml(rider.avatar)}" class="${sizeClass} av-img" alt="${escHtml(rider.name)}" onerror="this.parentElement.innerHTML='${escHtml(rider.initial||'?')}'" />`;
  }
  return escHtml(rider ? (rider.initial || (rider.name ? rider.name[0] : '?')) : '?');
}

/* ----------------------------------------------------------------
   "Riders" = 全体群成员 + 用户本人，按固定顺序依次完成选择
---------------------------------------------------------------- */
let _riders = []; // [{id, name, initial, avatar, isUser, briefText}]

function buildRiders() {
  // 群主/用户本人不参与这趟过山车，车上只坐除用户外的全部群成员，
  // 每个人的随身物品与情绪独白均由 AI 生成。
  _riders = _groupMembers.map(m => ({
    id: m.id, name: m.name, initial: m.initial, avatar: m.avatar,
    isUser: false, briefText: buildMemberBrief(m),
  }));
}

/* ----------------------------------------------------------------
   STATE — 轨道 / 物品 / 行程
---------------------------------------------------------------- */
let _trackNodes   = [];   // [{x, y}] y: 0(顶/兴奋) ~ 220(底/低落) in svg space
let _selectedNode = 0;
const TRACK_MIN_X = 18, TRACK_MAX_X = 322;
const TRACK_MIN_Y = 14, TRACK_MAX_Y = 206;

let _pickIndex   = 0;          // 当前正在选择第几位 rider
let _itemOptions = [];         // 当前 rider 的 AI 生成选项
let _chosenOptIdx = -1;
let _riderItems  = {};         // riderId -> { name, desc }

let _rideStarted   = false;
let _currentNodeIdx = 0;       // 行驶到第几个节点 (0-based)
let _moodCache      = {};      // `${riderId}_${nodeIdx}` -> { level, text }
let _journeyCache   = {};      // riderId -> text
let _activeMoodRiderId = null; // 当前弹窗显示的是谁
let _carPositions   = {};      // riderId -> {x,y} 当前像素位置（用于切换车厢列表展示）

/* ----------------------------------------------------------------
   存档 — 每趟旅程结束后自动写入 localStorage，可随时在「历史存档」中回顾
---------------------------------------------------------------- */

const ARCHIVE_STORAGE_KEY = 'luna_coaster_archives';
const ARCHIVE_MAX_COUNT   = 30; // 最多保留最近 30 趟旅程，避免 localStorage 无限增长
let _currentArchiveId = null;   // 当前这一趟旅程在存档中的 id（生成新内容时同步更新存档）

function loadArchives() {
  try {
    const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch(e) { return []; }
}

function saveArchives(list) {
  try {
    localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(list.slice(0, ARCHIVE_MAX_COUNT)));
  } catch(e) { /* 容量超限等情况下静默失败，不影响当前旅程体验 */ }
}

/* 旅程一旦进入行驶阶段就建档，此后每生成一段独白/总结都会实时补写进同一份存档，
   这样即使中途离开页面，已经生成的内容也不会丢失。 */
function createArchiveForCurrentRide() {
  const archive = {
    id: 'arc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    createdAt: Date.now(),
    groupName: _groupName,
    trackNodes: _trackNodes.map(n => ({ x: n.x, y: n.y })),
    riders: _riders.map(r => ({ id: r.id, name: r.name, initial: r.initial, avatar: r.avatar })),
    riderItems: JSON.parse(JSON.stringify(_riderItems)),
    moodTexts: {},   // `${riderId}_${nodeIdx}` -> text
    journeyTexts: {} // riderId -> text
  };
  const list = loadArchives();
  list.unshift(archive);
  saveArchives(list);
  _currentArchiveId = archive.id;
}

function patchCurrentArchive(patchFn) {
  if (!_currentArchiveId) return;
  const list = loadArchives();
  const idx = list.findIndex(a => a.id === _currentArchiveId);
  if (idx === -1) return;
  patchFn(list[idx]);
  saveArchives(list);
}

function archiveSaveMood(riderId, nodeIdx, text) {
  patchCurrentArchive(a => { a.moodTexts[`${riderId}_${nodeIdx}`] = text; });
}

function archiveSaveJourney(riderId, text) {
  patchCurrentArchive(a => { a.journeyTexts[riderId] = text; });
}

function fmtArchiveDate(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ----------------------------------------------------------------
   存档 — 列表弹窗
---------------------------------------------------------------- */
function openArchiveList() {
  const list = loadArchives();
  const wrap = document.getElementById('ecArchiveList');
  const emptyEl = document.getElementById('ecArchiveEmpty');

  if (!list.length) {
    wrap.innerHTML = '';
    emptyEl.style.display = 'block';
  } else {
    emptyEl.style.display = 'none';
    wrap.innerHTML = list.map(a => {
      const riderNames = a.riders.map(r => r.name).join('、');
      return `
        <div class="ec-archive-item" onclick="openArchiveDetail('${a.id}')">
          <div class="ec-archive-item-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 12h4l2 4 4-12 2 8h6"/></svg>
          </div>
          <div class="ec-archive-item-meta">
            <div class="ec-archive-item-date">${fmtArchiveDate(a.createdAt)}</div>
            <div class="ec-archive-item-sub">${a.trackNodes.length} 个节点 · ${escHtml(riderNames)}</div>
          </div>
          <div class="ec-archive-item-del" onclick="event.stopPropagation(); deleteArchive('${a.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </div>
        </div>
      `;
    }).join('');
  }

  document.getElementById('ecArchiveOverlay').classList.add('open');
  document.getElementById('ecArchiveModal').classList.add('open');
}
function closeArchiveList() {
  document.getElementById('ecArchiveOverlay').classList.remove('open');
  document.getElementById('ecArchiveModal').classList.remove('open');
}
function deleteArchive(id) {
  const list = loadArchives().filter(a => a.id !== id);
  saveArchives(list);
  openArchiveList();
}

/* ----------------------------------------------------------------
   存档 — 详情弹窗（只读回顾：随身物品 + 每节点独白 + 心路历程总结）
---------------------------------------------------------------- */
let _archiveDetailData = null;
let _archiveDetailRiderId = null;
let _archiveDetailNodeIdx = -1; // -1 表示查看"心路历程总结"

function openArchiveDetail(archiveId) {
  const list = loadArchives();
  const archive = list.find(a => a.id === archiveId);
  if (!archive) return;
  _archiveDetailData = archive;
  _archiveDetailRiderId = archive.riders[0]?.id || null;
  _archiveDetailNodeIdx = -1;

  document.getElementById('ecArchiveDetailDate').textContent = fmtArchiveDate(archive.createdAt) + ' · ' + archive.trackNodes.length + ' NODES';
  renderArchiveDetailRiders();
  renderArchiveDetailBody();

  document.getElementById('ecArchiveDetailOverlay').classList.add('open');
  document.getElementById('ecArchiveDetailModal').classList.add('open');
}
function closeArchiveDetail() {
  document.getElementById('ecArchiveDetailOverlay').classList.remove('open');
  document.getElementById('ecArchiveDetailModal').classList.remove('open');
}

function renderArchiveDetailRiders() {
  const wrap = document.getElementById('ecArchiveDetailRiders');
  wrap.innerHTML = _archiveDetailData.riders.map(r => `
    <div class="ec-archive-detail-rider ${r.id===_archiveDetailRiderId?'active':''}" onclick="selectArchiveRider('${r.id}')">
      <div class="ec-archive-detail-rider-av">${renderAvatar(r, '')}</div>
      <div class="ec-archive-detail-rider-name">${escHtml(r.name)}</div>
    </div>
  `).join('');
}

function selectArchiveRider(riderId) {
  _archiveDetailRiderId = riderId;
  _archiveDetailNodeIdx = -1;
  renderArchiveDetailRiders();
  renderArchiveDetailBody();
}

function renderArchiveDetailBody() {
  const archive = _archiveDetailData;
  const rider = archive.riders.find(r => r.id === _archiveDetailRiderId);
  if (!rider) return;
  const item = archive.riderItems[rider.id] || { name: '一份说不清的东西', desc: '' };

  const nodeChips = archive.trackNodes.map((n, i) => {
    const lvl = moodLevelForY(n.y);
    return `<span class="ec-archive-detail-node-chip ${i===_archiveDetailNodeIdx?'active':''}" onclick="selectArchiveNode(${i})">N${i+1} · LV${lvl}</span>`;
  }).join('');
  const journeyChip = `<span class="ec-archive-detail-node-chip ${_archiveDetailNodeIdx===-1?'active':''}" onclick="selectArchiveNode(-1)">总结</span>`;

  let sectionLabel, text;
  if (_archiveDetailNodeIdx === -1) {
    sectionLabel = '心路历程总结';
    text = archive.journeyTexts[rider.id] || '';
  } else {
    sectionLabel = `节点 ${_archiveDetailNodeIdx+1} 独白`;
    text = archive.moodTexts[`${rider.id}_${_archiveDetailNodeIdx}`] || '';
  }

  document.getElementById('ecArchiveDetailBody').innerHTML = `
    <div class="ec-archive-detail-item-tag">随身：${escHtml(item.name)}</div>
    <div class="ec-archive-detail-nodes">${journeyChip}${nodeChips}</div>
    <div class="ec-archive-detail-section-label">${sectionLabel}</div>
    <div class="ec-archive-detail-text ${text ? '' : 'empty'}">${escHtml(text || '这一段当时没有生成/查看过，没有留下记录。')}</div>
  `;
}

function selectArchiveNode(idx) {
  _archiveDetailNodeIdx = idx;
  renderArchiveDetailBody();
}

/* ----------------------------------------------------------------
   STAGE 0 — 轨道设计
---------------------------------------------------------------- */
function defaultTrack() {
  _trackNodes = [
    { x: 40,  y: 120 },
    { x: 110, y: 60  },
    { x: 180, y: 170 },
    { x: 250, y: 80  },
    { x: 312, y: 140 },
  ];
}

function trackPathD(nodes) {
  if (nodes.length < 2) return '';
  let d = `M ${nodes[0].x} ${nodes[0].y}`;
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i], b = nodes[i+1];
    const mx = (a.x + b.x) / 2;
    d += ` C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
  }
  return d;
}

function renderTrack() {
  const d = trackPathD(_trackNodes);
  document.getElementById('ecTrackPath').setAttribute('d', d);
  document.getElementById('ecTrackPath2').setAttribute('d', d);

  const wrap = document.getElementById('ecTrackNodes');
  wrap.innerHTML = _trackNodes.map((n, i) => `
    <div class="ec-track-node ${i===_selectedNode?'selected':''}"
         style="left:${(n.x/340*100)}%; top:${(n.y/220*100)}%;"
         data-idx="${i}"
         onpointerdown="onNodePointerDown(event, ${i})">${i+1}</div>
  `).join('');

  const confirmBtn = document.getElementById('ecTrackConfirm');
  confirmBtn.classList.toggle('disabled', _trackNodes.length < 3);
}

function addTrackNode() {
  if (_trackNodes.length >= 7) { gaToast('最多 7 个节点'); return; }
  const last = _trackNodes[_trackNodes.length - 1];
  const nx = Math.min(TRACK_MAX_X, (last ? last.x : 20) + 50);
  const ny = 90 + Math.random() * 80;
  _trackNodes.push({ x: nx, y: ny });
  _trackNodes.sort((a,b) => a.x - b.x);
  _selectedNode = _trackNodes.length - 1;
  renderTrack();
}

function removeTrackNode() {
  if (_trackNodes.length <= 3) { gaToast('至少保留 3 个节点'); return; }
  _trackNodes.splice(_selectedNode, 1);
  _selectedNode = Math.max(0, _selectedNode - 1);
  renderTrack();
}

let _dragState = null;
const NODE_X_GAP = 12; // 相邻节点在 x 轴上的最小间距，避免拖动后顺序错乱或重叠
function onNodePointerDown(e, idx) {
  e.preventDefault();
  _selectedNode = idx;
  const wrapEl = document.querySelector('.ec-track-canvas-wrap');
  const rect = wrapEl.getBoundingClientRect();
  _dragState = { idx, rect };
  document.getElementById('ecTrackHint').textContent = '任意方向拖动，调整该节点的位置与坡度';
  window.addEventListener('pointermove', onNodePointerMove);
  window.addEventListener('pointerup', onNodePointerUp);
  renderTrack();
}
function onNodePointerMove(e) {
  if (!_dragState) return;
  const { idx, rect } = _dragState;

  let relY = (e.clientY - rect.top) / rect.height * 220;
  relY = Math.max(TRACK_MIN_Y, Math.min(TRACK_MAX_Y, relY));

  let relX = (e.clientX - rect.left) / rect.width * 340;
  // 限制在左右相邻节点之间，防止拖动后覆盖或跨越其他节点、打乱轨道顺序
  const prevNode = _trackNodes[idx - 1];
  const nextNode = _trackNodes[idx + 1];
  const minX = prevNode ? prevNode.x + NODE_X_GAP : TRACK_MIN_X;
  const maxX = nextNode ? nextNode.x - NODE_X_GAP : TRACK_MAX_X;
  relX = Math.max(minX, Math.min(maxX, relX));

  _trackNodes[idx].x = relX;
  _trackNodes[idx].y = relY;
  renderTrack();
}
function onNodePointerUp() {
  _dragState = null;
  document.getElementById('ecTrackHint').textContent = '任意方向拖动圆点，调整该节点的位置与情绪坡度';
  window.removeEventListener('pointermove', onNodePointerMove);
  window.removeEventListener('pointerup', onNodePointerUp);
}

function confirmTrack() {
  if (_trackNodes.length < 3) { gaToast('至少需要 3 个节点'); return; }
  buildRiders();
  _pickIndex = 0;
  switchStage('stagePick');
  startPickFor(_pickIndex);
}

/* ----------------------------------------------------------------
   STAGE 1 — 物品挑选：严格按顺序，逐人完成
---------------------------------------------------------------- */
function renderPickProgress() {
  const wrap = document.getElementById('ecPickProgress');
  wrap.innerHTML = _riders.map((r, i) => {
    let cls = '';
    if (i < _pickIndex) cls = 'done';
    else if (i === _pickIndex) cls = 'current';
    return `<span class="${cls}"></span>`;
  }).join('');
}

async function startPickFor(idx) {
  if (idx >= _riders.length) { startRideStage(); return; }
  const rider = _riders[idx];
  renderPickProgress();

  document.getElementById('ecPickAv').innerHTML = renderAvatar(rider, 'ec-pick-av-img');
  document.getElementById('ecPickName').textContent = rider.name + (rider.isUser ? '（我）' : '');
  document.getElementById('ecPickDescBox').innerHTML = `<div class="ec-pick-loading" id="ecPickLoading"><div class="ec-pick-dots"><div></div><div></div><div></div></div><span>正在为 TA 构思随身之物…</span></div>`;
  document.getElementById('ecPickOptions').innerHTML = '';
  document.getElementById('ecPickCustom').style.display = 'none';
  document.getElementById('ecPickCustomInput').value = '';
  _chosenOptIdx = -1;
  _itemOptions = [];

  try {
    const { baseUrl, apiKey, model } = getLunaApiConfig();
    if (!baseUrl || !apiKey || !model) throw new Error('NO_API_CONFIG');

    const castLine = _riders.filter(r => r.id !== rider.id).map(r => r.name).join('、');
    const sys = `你是「情绪过山车」小游戏的随身物品设计师。请只输出 JSON，不要任何多余文字、不要 markdown 代码块标记。`;
    const prompt = `这是一场群组成员一起坐"情绪过山车"的活动，每人上车前要选一样随身携带的东西（可以是具体物品，也可以是一个随身携带的小事件/记忆/状态，比如"一封没寄出的信""手腕上还没消的红印"）。

当前要为这位乘客设计随身物品选项：
姓名：${rider.name}
人设：${rider.briefText}
${castLine ? '同行的其他乘客：' + castLine : ''}

请结合TA的性格、身份生成 6 个随身物品选项，要求：
1. 每个选项要具体、有画面感，能体现这个人的性格和此刻可能的心理状态，不要泛泛而谈（不要写"手机""钱包"这类无特征的东西）。
2. 6 个选项之间要有明显差异，覆盖不同情绪基调（有些轻松、有些沉重、有些暧昧、有些克制）。
3. 每个选项附一句20-40字的描述，说明TA为什么会带这个东西、它对TA意味着什么。

输出严格为 JSON 数组，格式：
[{"name":"物品/事件名称(不超过12字)","desc":"20-40字描述"}, ...] 共6个元素。`;

    const raw = await callClaude(prompt, sys, 900);
    const arr = safeParseJSON(raw, true);
    _itemOptions = Array.isArray(arr) ? arr.filter(x => x && x.name).slice(0, 8) : [];
    if (_itemOptions.length < 5) throw new Error('选项不足');
  } catch(e) {
    if (e.message === 'NO_API_CONFIG') { notifyApiNotConfigured(); }
    /* fallback：保证流程不中断，给出通用但仍体现差异度的选项 */
    _itemOptions = [
      { name: '一张旧车票', desc: '某次没说出口的离别，折痕已经发软了' },
      { name: '半块没吃完的糖', desc: '留着舍不得吃，怕一口就没了那点甜' },
      { name: '一支没墨的笔', desc: '写了一半的话，搁置到现在也没敢续上' },
      { name: '一颗磨圆的石头', desc: '攥在手里会安心，说不清为什么' },
      { name: '一条旧围巾', desc: '闻起来还有点别人的味道，舍不得洗' },
      { name: '一段没发送的语音', desc: '录了三十七秒，最后还是删了重录' },
    ];
  }

  document.getElementById('ecPickDescBox').innerHTML =
    `这是${rider.name}此刻可能会带上车的东西，选一样，也可以自己写。`;

  renderPickOptions();
}

function renderPickOptions() {
  const wrap = document.getElementById('ecPickOptions');
  wrap.innerHTML = _itemOptions.map((opt, i) => `
    <div class="ec-pick-opt ${i===_chosenOptIdx?'chosen':''}" onclick="chooseOption(${i})">
      <div class="ec-pick-opt-mark"></div>
      <div class="ec-pick-opt-body">
        <div class="ec-pick-opt-name">${escHtml(opt.name)}</div>
        <div class="ec-pick-opt-desc">${escHtml(opt.desc || '')}</div>
      </div>
    </div>
  `).join('');
}

function chooseOption(i) {
  _chosenOptIdx = i;
  renderPickOptions();
  const rider = _riders[_pickIndex];
  _riderItems[rider.id] = { name: _itemOptions[i].name, desc: _itemOptions[i].desc || '' };
  setTimeout(() => advancePick(), 260);
}

function toggleCustomPanel() {
  const el = document.getElementById('ecPickCustom');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}
function onCustomInput() {
  const v = document.getElementById('ecPickCustomInput').value.trim();
  document.getElementById('ecPickCustomConfirm').classList.toggle('active', v.length > 0);
}
function confirmCustomItem() {
  const v = document.getElementById('ecPickCustomInput').value.trim();
  if (!v) return;
  const rider = _riders[_pickIndex];
  _riderItems[rider.id] = { name: v, desc: '自定义随身物' };
  _chosenOptIdx = -1;
  advancePick();
}

function advancePick() {
  _pickIndex++;
  if (_pickIndex >= _riders.length) {
    startRideStage();
  } else {
    switchStage('stagePick');
    startPickFor(_pickIndex);
  }
}

/* ----------------------------------------------------------------
   STAGE 2 — 过山车行驶
---------------------------------------------------------------- */
function startRideStage() {
  switchStage('stageRide');
  _currentNodeIdx = 0;
  _rideStarted = false;
  createArchiveForCurrentRide();
  renderRideTrack();
  layoutCarsAtNode(0, true);
  document.getElementById('ecHudNode').textContent = `01 / ${String(_trackNodes.length).padStart(2,'0')}`;
  document.getElementById('ecHudAlt').textContent = altLabelForNode(0);
  document.getElementById('ecRideBottomHint').textContent = '轨道已就绪 · 点击「发车」开始这趟旅程';
  document.getElementById('ecRideStartBtn').classList.remove('disabled');
}

function renderRideTrack() {
  const d = trackPathD(_trackNodes);
  document.getElementById('ecRideRailShadow').setAttribute('d', d);
  document.getElementById('ecRideRailPath').setAttribute('d', d);

  const marks = document.getElementById('ecRideNodeMarks');
  marks.innerHTML = _trackNodes.map((n, i) => `
    <div class="ec-ride-node-mark" id="ecNodeMark${i}" style="left:${(n.x/340*100)}%; top:${(n.y/220*100)}%;"></div>
  `).join('');
  updateNodeMarkStates();
}

function updateNodeMarkStates() {
  _trackNodes.forEach((n, i) => {
    const el = document.getElementById('ecNodeMark' + i);
    if (!el) return;
    el.classList.toggle('passed', i < _currentNodeIdx);
    el.classList.toggle('current', i === _currentNodeIdx);
  });
}

/* 坡度等级：y 越小越靠近顶部=情绪越高昂，越大越靠近底部=情绪越低落
   level 1(谷底/平静) ~ 5(高峰/强烈) — 纯数值映射，不预设具体情绪正负 */
function moodLevelForY(y) {
  const t = 1 - (y - TRACK_MIN_Y) / (TRACK_MAX_Y - TRACK_MIN_Y); // 0 bottom .. 1 top
  return Math.max(1, Math.min(5, Math.ceil(t * 5) || 1));
}
function altLabelForNode(idx) {
  const n = _trackNodes[idx];
  if (!n) return '--';
  const lvl = moodLevelForY(n.y);
  const labels = ['谷底', '低位', '平稳', '抬升', '峰值'];
  return labels[lvl - 1] + ` · LV.${lvl}`;
}

/* 车厢排布：每个节点上，全部 riders 挤在同一节点位置，
   通过轻微错位(jitter)模拟"同一坡度的不同车厢"，点击任意车厢查看该人 */
function layoutCarsAtNode(nodeIdx, instant) {
  const n = _trackNodes[nodeIdx];
  if (!n) return;
  const wrap = document.getElementById('ecRideCars');
  const px = n.x / 340 * 100, py = n.y / 220 * 100;

  if (!wrap.dataset.built) {
    wrap.innerHTML = _riders.map((r, i) => `
      <div class="ec-car ${r.isUser?'is-self':''}" id="ecCar_${r.id}" onclick="onCarClick('${r.id}')">
        <div class="ec-car-tag">${escHtml(r.name)}</div>
        <div class="ec-car-body">
          <div class="ec-car-rider">${renderAvatar(r, '')}</div>
        </div>
        <div class="ec-car-wheels"><span></span><span></span></div>
      </div>
    `).join('');
    wrap.dataset.built = '1';
  }

  _riders.forEach((r, i) => {
    const jitterX = (i - (_riders.length-1)/2) * 2.0;
    const jitterY = (i % 2 === 0 ? -1 : 1) * 3.2;
    const x = Math.max(4, Math.min(96, px + jitterX));
    const y = Math.max(6, Math.min(94, py + jitterY));
    _carPositions[r.id] = { x, y };
    const el = document.getElementById('ecCar_' + r.id);
    if (el) {
      if (instant) el.style.transition = 'none';
      el.style.left = x + '%';
      el.style.top  = y + '%';
      if (instant) requestAnimationFrame(() => { el.style.transition = ''; });
    }
  });
}

async function launchCoaster() {
  if (_rideStarted) return;
  _rideStarted = true;
  document.getElementById('ecRideStartBtn').classList.add('disabled');
  document.getElementById('ecRideBottomHint').textContent = '车厢正在驶向第 1 个节点…';

  for (let i = 0; i < _trackNodes.length; i++) {
    _currentNodeIdx = i;
    document.getElementById('ecHudNode').textContent = `${String(i+1).padStart(2,'0')} / ${String(_trackNodes.length).padStart(2,'0')}`;
    document.getElementById('ecHudAlt').textContent = altLabelForNode(i);
    updateNodeMarkStates();
    layoutCarsAtNode(i, false);
    await sleep(900);

    document.getElementById('ecRideBottomHint').textContent = `已抵达第 ${i+1} 个节点 · 正在感受这段坡度…`;
    await openMoodModalForNode(i, _riders[0].id);

    if (i < _trackNodes.length - 1) {
      document.getElementById('ecRideBottomHint').textContent = '继续前进…';
      await sleep(400);
    }
  }

  document.getElementById('ecRideBottomHint').textContent = '旅程已抵达终点';
  await sleep(600);
  buildEndList();
  switchStage('stageEnd');
}

function onCarClick(riderId) {
  if (!_rideStarted) { gaToast('请先点击「发车」'); return; }
  openMoodModalForNode(_currentNodeIdx, riderId);
}

/* ----------------------------------------------------------------
   节点情绪弹窗 — 居中显示，按坡度等级呈现不同视觉变体
---------------------------------------------------------------- */
function openCarSwitcher() {
  if (!_rideStarted) { gaToast('请先点击「发车」'); return; }
  const sub = document.getElementById('ecSwitcherSub');
  sub.textContent = `第 ${_currentNodeIdx+1} 个节点 · ${altLabelForNode(_currentNodeIdx)}`;
  const list = document.getElementById('ecSwitcherList');
  list.innerHTML = _riders.map(r => `
    <div class="ec-switcher-item ${r.id===_activeMoodRiderId?'active':''}" onclick="pickSwitcherRider('${r.id}')">
      <div class="ec-switcher-av">${renderAvatar(r, '')}</div>
      <div class="ec-switcher-name">${escHtml(r.name)}${r.isUser?'（我）':''}</div>
    </div>
  `).join('');
  document.getElementById('ecSwitcherOverlay').classList.add('open');
  document.getElementById('ecSwitcherModal').classList.add('open');
}
function closeCarSwitcher() {
  document.getElementById('ecSwitcherOverlay').classList.remove('open');
  document.getElementById('ecSwitcherModal').classList.remove('open');
}
function pickSwitcherRider(riderId) {
  closeCarSwitcher();
  openMoodModalForNode(_currentNodeIdx, riderId);
}

function cycleMoodCard(dir) {
  const idx = _riders.findIndex(r => r.id === _activeMoodRiderId);
  const next = _riders[(idx + dir + _riders.length) % _riders.length];
  openMoodModalForNode(_currentNodeIdx, next.id);
}

async function openMoodModalForNode(nodeIdx, riderId) {
  _activeMoodRiderId = riderId;
  const rider = _riders.find(r => r.id === riderId);
  const node  = _trackNodes[nodeIdx];
  const level = moodLevelForY(node.y);
  const item  = _riderItems[riderId] || { name: '一份说不清的东西', desc: '' };

  const card = document.getElementById('ecMoodCard');
  card.className = 'ec-mood-card lvl-' + level;

  document.getElementById('ecMoodAv').innerHTML = renderAvatar(rider, 'ec-mood-av-img');
  document.getElementById('ecMoodName').textContent = rider.name + (rider.isUser ? '（我）' : '');
  document.getElementById('ecMoodNodeLabel').textContent = `NODE ${nodeIdx+1} · ${altLabelForNode(nodeIdx)}`;
  document.getElementById('ecMoodItemTag').textContent = item.name;

  const gaugeFill = document.getElementById('ecGaugeFill');
  const circumference = 157;
  gaugeFill.style.strokeDashoffset = circumference - (level/5) * circumference;
  document.getElementById('ecGaugeLabel').textContent = 'LV' + level;

  document.getElementById('ecMoodOverlay').classList.add('open');
  document.getElementById('ecMoodStage').classList.add('open');

  const cacheKey = `${riderId}_${nodeIdx}`;
  const textEl = document.getElementById('ecMoodText');
  const loadingEl = document.getElementById('ecMoodLoading');
  textEl.textContent = '';

  if (_moodCache[cacheKey]) {
    loadingEl.classList.add('hidden');
    textEl.textContent = _moodCache[cacheKey];
    return waitForModalClose();
  }

  loadingEl.classList.remove('hidden');

  try {
    const text = await generateMoodText(rider, nodeIdx, level, item);
    _moodCache[cacheKey] = text;
    archiveSaveMood(riderId, nodeIdx, text);
    if (_activeMoodRiderId === riderId && _currentNodeIdx === nodeIdx) {
      loadingEl.classList.add('hidden');
      textEl.textContent = text;
    }
  } catch(e) {
    loadingEl.classList.add('hidden');
    if (e.message === 'NO_API_CONFIG') notifyApiNotConfigured();
    const fbText = fallbackMoodText(rider, nodeIdx, level, item);
    textEl.textContent = fbText;
    archiveSaveMood(riderId, nodeIdx, fbText);
  }

  return waitForModalClose();
}

function waitForModalClose() {
  return new Promise(resolve => {
    window._ecMoodResolve = resolve;
  });
}

function closeMoodModal() {
  document.getElementById('ecMoodOverlay').classList.remove('open');
  document.getElementById('ecMoodStage').classList.remove('open');
  if (window._ecMoodResolve) {
    const r = window._ecMoodResolve;
    window._ecMoodResolve = null;
    r();
  }
}

async function generateMoodText(rider, nodeIdx, level, item) {
  const { baseUrl, apiKey, model } = getLunaApiConfig();
  if (!baseUrl || !apiKey || !model) throw new Error('NO_API_CONFIG');

  const levelDesc = ['处在情绪谷底，整个人是沉下去、收着的', '情绪偏低，安静、内敛、有点钝钝的', '情绪平稳，混杂着说不清的复杂感受', '情绪明显抬升，有点兴奋又有点慌', '情绪冲到最高点，强烈、外放、几乎压不住'][level-1];
  const prevText = nodeIdx > 0 ? (_moodCache[`${rider.id}_${nodeIdx-1}`] || '') : '';

  const sys = `你正在沉浸式扮演一位群组成员，参与一场"情绪过山车"的互动游戏。你需要以第一人称、内心独白的方式，写下此刻坐在车厢里、行驶到这个坡度节点时的真实感受。文字要细腻、有画面感、有具体的身体感受和心理活动，避免空泛的形容词堆砌，要写出"为什么会是这种感受"的因果，并自然地把随身带的东西编织进这段感受里。绝对不要出现"作为AI""我无法""扮演"等字眼，全程沉浸在角色里。`;

  const prompt = `角色：${rider.name}
人设：${rider.briefText}

当前情境：
这是一场情绪过山车，车厢正行驶到第 ${nodeIdx+1} 个节点（共 ${_trackNodes.length} 个节点），这个节点的坡度等级是 LV.${level}（1谷底~5峰值），具体来说：${levelDesc}。
TA上车前选择/写下的随身物品是「${item.name}」，关于这件物品：${item.desc || '（没有更多说明，请自行合理想象）'}。
${prevText ? '上一个节点TA的感受是：' + prevText.slice(0,120) + '……（情绪在此基础上延续/转折，要有连贯性，不要每段都从零开始）' : '这是TA坐上车后的第一段感受。'}

请以${rider.name}的第一人称视角，写一段内心独白，要求：
1. 字数不少于800字。
2. 紧扣当前坡度等级带来的具体身体感受（比如失重感、心跳、手心的温度、风声）与心理活动。
3. 必须自然地把随身携带的「${item.name}」编织进这段独白里，写出TA此刻为什么会想到它、它和此刻的情绪有什么关联。
4. 语言风格要符合TA的人设性格，不要写成通用的"心情描写模板"。
5. 只输出独白正文，不要标题、不要任何解释性文字、不要使用markdown符号。`;

  return await callClaude(prompt, sys, 1400);
}

function fallbackMoodText(rider, nodeIdx, level, item) {
  return `车厢驶到这一段的时候，${rider.name}下意识地攥紧了手里的${item.name}。坡度的起伏让胸口先是一空，接着又被什么东西填满——说不清是欣喜还是后怕，只是身体比脑子先做出了反应。\n\n（当前未连接AI接口，这是一段占位文字，用于保证流程不中断。请在「设置 → API」中配置模型后重新体验，即可生成专属于${rider.name}此刻坡度与随身物品的完整内心独白。）`;
}

/* ----------------------------------------------------------------
   STAGE 3 — 终点：心路历程总结
---------------------------------------------------------------- */
function buildEndList() {
  const wrap = document.getElementById('ecEndList');
  wrap.innerHTML = _riders.map(r => `
    <div class="ec-end-item" onclick="openJourneyModal('${r.id}')">
      <div class="ec-end-av">${renderAvatar(r, '')}</div>
      <div class="ec-end-info">
        <div class="ec-end-name">${escHtml(r.name)}${r.isUser?'（我）':''}</div>
        <div class="ec-end-status ${_journeyCache[r.id]?'ready':''}">${_journeyCache[r.id] ? '已生成 · 点击查看' : '点击生成心路历程'}</div>
      </div>
      <div class="ec-end-arrow">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9,18 15,12 9,6"/></svg>
      </div>
    </div>
  `).join('');
}

async function openJourneyModal(riderId) {
  const rider = _riders.find(r => r.id === riderId);
  const item  = _riderItems[riderId] || { name: '一份说不清的东西', desc: '' };

  document.getElementById('ecJourneyAv').innerHTML = renderAvatar(rider, 'ec-journey-av-img');
  document.getElementById('ecJourneyName').textContent = rider.name + (rider.isUser ? '（我）' : '');
  document.getElementById('ecJourneyTagline').textContent = `RIDE COMPLETE · ${_trackNodes.length} NODES`;

  const itemsWrap = document.getElementById('ecJourneyItems');
  itemsWrap.innerHTML = `<span class="ec-journey-item-chip">随身：${escHtml(item.name)}</span>` +
    _trackNodes.map((n,i) => `<span class="ec-journey-item-chip">N${i+1} · LV${moodLevelForY(n.y)}</span>`).join('');

  document.getElementById('ecJourneyOverlay').classList.add('open');
  document.getElementById('ecJourneyModal').classList.add('open');

  const textEl = document.getElementById('ecJourneyText');
  const loadingEl = document.getElementById('ecJourneyLoading');
  textEl.textContent = '';

  if (_journeyCache[riderId]) {
    loadingEl.classList.add('hidden');
    textEl.textContent = _journeyCache[riderId];
    return;
  }
  loadingEl.classList.remove('hidden');

  try {
    const text = await generateJourneyText(rider, item);
    _journeyCache[riderId] = text;
    archiveSaveJourney(riderId, text);
    loadingEl.classList.add('hidden');
    textEl.textContent = text;
    buildEndList();
  } catch(e) {
    loadingEl.classList.add('hidden');
    if (e.message === 'NO_API_CONFIG') notifyApiNotConfigured();
    const fbText = fallbackJourneyText(rider, item);
    textEl.textContent = fbText;
    archiveSaveJourney(riderId, fbText);
  }
}

function closeJourneyModal() {
  document.getElementById('ecJourneyOverlay').classList.remove('open');
  document.getElementById('ecJourneyModal').classList.remove('open');
}

async function generateJourneyText(rider, item) {
  const { baseUrl, apiKey, model } = getLunaApiConfig();
  if (!baseUrl || !apiKey || !model) throw new Error('NO_API_CONFIG');

  const moodSeq = _trackNodes.map((n,i) => {
    const key = `${rider.id}_${i}`;
    const lvl = moodLevelForY(n.y);
    const snippet = (_moodCache[key] || '').slice(0, 90);
    return `节点${i+1}(LV.${lvl})：${snippet || '（未生成片段）'}`;
  }).join('\n');

  const sys = `你正在沉浸式扮演一位群组成员，为TA刚刚经历的"情绪过山车"写一篇完整的事后心路历程总结。这是一篇回顾性的第一人称独白，要把整段旅程的起伏串联成一条完整的情绪曲线，而不是简单罗列每个节点。绝对不要出现"作为AI""我无法""扮演"等字眼，全程沉浸在角色里。`;

  const prompt = `角色：${rider.name}
人设：${rider.briefText}

这场情绪过山车一共经过了 ${_trackNodes.length} 个节点，TA全程带着随身物品「${item.name}」（${item.desc || '具体含义由你合理想象'}）。
以下是旅途中各节点的坡度等级与当时独白片段（仅供参考语气与脉络，不必逐句呼应）：
${moodSeq}

请以${rider.name}的第一人称视角，写一篇完整的事后心路历程总结，要求：
1. 字数不少于800字。
2. 要把整段旅程的起伏串成一条完整的情绪曲线，写出从开始到现在TA的心境发生了怎样的变化，而不是逐节点流水账。
3. 必须围绕随身携带的「${item.name}」展开——这趟旅程结束后，TA对这件随身物品的看法/感受是否发生了变化，要给出具体的转折或沉淀。
4. 结尾要落在一个具体、克制、属于这个角色性格的收束句上，不要喊口号、不要写成鸡汤。
5. 只输出正文，不要标题、不要任何解释性文字、不要使用markdown符号。`;

  return await callClaude(prompt, sys, 1500);
}

function fallbackJourneyText(rider, item) {
  return `这趟过山车坐下来，${rider.name}发现自己对手里的${item.name}多了一层说不清的感情。起起伏伏之间，好像有什么东西被重新摆放了位置。\n\n（当前未连接AI接口，这是一段占位文字，用于保证流程不中断。请在「设置 → API」中配置模型后重新体验，即可生成属于${rider.name}的完整心路历程总结，不少于800字。）`;
}

/* ----------------------------------------------------------------
   Restart
---------------------------------------------------------------- */
function restartCoaster() {
  _trackNodes = []; _selectedNode = 0;
  _pickIndex = 0; _itemOptions = []; _chosenOptIdx = -1; _riderItems = {};
  _rideStarted = false; _currentNodeIdx = 0; _moodCache = {}; _journeyCache = {};
  _activeMoodRiderId = null; _carPositions = {}; _currentArchiveId = null;
  const carsWrap = document.getElementById('ecRideCars');
  if (carsWrap) { carsWrap.innerHTML = ''; delete carsWrap.dataset.built; }
  defaultTrack();
  _selectedNode = 0;
  switchStage('stageTrack');
  renderTrack();
}

/* ----------------------------------------------------------------
   Stage routing
---------------------------------------------------------------- */
function switchStage(id) {
  document.querySelectorAll('.ec-stage').forEach(el => el.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

function handleBack() {
  if (document.getElementById('ecArchiveDetailModal')?.classList.contains('open')) { closeArchiveDetail(); return; }
  if (document.getElementById('ecArchiveModal')?.classList.contains('open')) { closeArchiveList(); return; }
  if (document.getElementById('ecJourneyModal')?.classList.contains('open')) { closeJourneyModal(); return; }
  if (document.getElementById('ecSwitcherModal')?.classList.contains('open')) { closeCarSwitcher(); return; }
  if (document.getElementById('ecMoodStage')?.classList.contains('open')) { return; /* 行驶中弹窗需手动继续，不允许后退跳过 */ }
  if (document.getElementById('infoSheet')?.classList.contains('open')) { hideInfo(); return; }

  const stages = ['stageTrack','stagePick','stageRide','stageEnd'];
  const activeId = stages.find(id => document.getElementById(id)?.classList.contains('active'));
  if (activeId === 'stagePick' && _pickIndex === 0) { switchStage('stageTrack'); return; }
  if (activeId === 'stageEnd') { switchStage('stageRide'); return; }
  if (activeId === 'stageTrack') {
    // coaster.html 现在位于 groupanon 子文件夹内，groupanon.html 在其上一级目录
    window.location.href = '../groupanon.html';
    return;
  }
  history.back();
}

/* ----------------------------------------------------------------
   Info sheet & toast
---------------------------------------------------------------- */
function showInfo() {
  document.getElementById('sheetOverlay')?.classList.add('open');
  document.getElementById('infoSheet')?.classList.add('open');
}
function hideInfo() {
  document.getElementById('sheetOverlay')?.classList.remove('open');
  document.getElementById('infoSheet')?.classList.remove('open');
}
function gaToast(msg) {
  const t = document.getElementById('gaToast');
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
  if (_usingDemo) {
    setTimeout(() => gaToast('未读取到群成员数据，已使用示例角色'), 800);
  }

  defaultTrack();
  switchStage('stageTrack');
  renderTrack();

  setInterval(updateTime, 10000);
});