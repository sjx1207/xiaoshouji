/* ================================
   postoffice.js — 时空邮局
   玩法：选方向 → 邮箱墙随机指派成员 → 抽信/拆信/展信动画 → AI按人设生成长信 → 存档
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
let _currentView   = 'hall';   // 'hall' | 'wall' | 'stage'
let _groupMembers  = [];
let _groupName     = 'GROUP';
let _usingDemoMembers = false;

let _selectedCat   = null;     // current category key
let _wallSlots     = [];       // [{member, slotKey, done}]
let _activeSlot    = null;     // slot currently open in stage
let _letters       = {};       // cache: slotKey -> letter object
let _archiveIndex  = [];       // list of slotKeys read, newest first
let _cameFromArchive = false;  // true when current stage view was opened from the hall archive (no wall to return to)

/* ----------------------------------------------------------------
   Category definitions — writing direction + prompt guidance
---------------------------------------------------------------- */
const PO_CATEGORIES = {
  work:   { label: '工作来信', tag: 'WORK',   promptHint: '围绕职场：手头没写完的方案、和同事或上级之间没说透的话、对当下岗位/忙碌状态的真实心情、某个具体的工作场景或决定。' },
  love:   { label: '情书来信', tag: 'LOVE',   promptHint: '围绕情感：一个没说出口的心意、对某个人（可以是暗恋对象、恋人、或过去某段关系）的真实感受，要有具体的画面感和细节，不要空泛地说"我喜欢你"。' },
  life:   { label: '生活来信', tag: 'LIFE',   promptHint: '围绕日常：最近生活里的一件具体小事、一地鸡毛的琐碎、一顿饭一个天气一次通勤引发的感触，要有生活质感和具体细节。' },
  growth: { label: '成长来信', tag: 'GROWTH', promptHint: '写给过去或未来的自己：一段对自己处境的真实审视，可以是某个具体转折点、一次后悔或释然，要有真实的成长质感，不要写成鸡汤语录。' },
  secret: { label: '秘密来信', tag: 'SECRET', promptHint: '一件平时不会主动提起的心事：一个小秘密、一个从未说出口的想法或纠结，语气应该比平时更放松更私人，像只写给纸的话。' },
  random: { label: '随机来信', tag: 'RANDOM', promptHint: '不设固定方向，任选一个此刻最贴近这个人真实状态的话题——可以是工作、感情、生活里的任意一件事，自然真实即可。' },
};

/* ----------------------------------------------------------------
   Fallback demo members (identical shape to groupanon.js)
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
   Load user identity (persona) — used so letters can be addressed to user
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
    const active = list.find(i => i.active !== false) || list[0];
    return active;
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

function userDisplayName() {
  return _userIdentity?.name || '群主';
}

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
  if (_groupMembers.length < 1) {
    _groupMembers = DEMO_MEMBERS;
    _usingDemoMembers = true;
  }
}

function renderAvatar(member, sizeClass) {
  if (member && member.avatar) {
    return `<img src="${escHtml(member.avatar)}" class="${sizeClass} av-img" alt="${escHtml(member.name)}" onerror="this.parentElement.innerHTML='${escHtml(member.initial||'?')}'" />`;
  }
  return escHtml(member ? (member.initial || '?') : '?');
}

function escHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ----------------------------------------------------------------
   Rich member brief (identical logic to groupanon.js)
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
  return `\n【你和群内其他人的称呼与关系——如果信里提到他们，必须用这里的称呼，不能乱叫】\n${lines.join('\n')}`;
}

/* ----------------------------------------------------------------
   AI API calls — 复用设置页已配置好的接口（同 groupanon.js）
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
    data = await res.json();
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
      body: JSON.stringify({ model, messages, max_tokens: maxTokens || 500, temperature: 0.97 }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error('API error ' + res.status + (errText ? ': ' + errText.slice(0, 200) : ''));
    }
    data = await res.json();
    reply = data.choices?.[0]?.message?.content ?? '';
    if (reply === null || reply === undefined || reply === '') {
      const finishReason = data.choices?.[0]?.finish_reason || '';
      const errMsg = data.error?.message || '';
      if (errMsg) throw new Error('API 错误：' + errMsg.slice(0, 100));
      throw new Error('API 返回空内容' + (finishReason ? `（finish_reason: ${finishReason}）` : '') + '，可能被内容过滤或 max_tokens 过小');
    }
  }
  return reply.trim();
}

function notifyApiNotConfigured() {
  poToast('请先在「设置 → API」中配置并选择模型');
}

/* ----------------------------------------------------------------
   View routing
---------------------------------------------------------------- */
function showHall() {
  _currentView = 'hall';
  document.getElementById('viewWall')?.classList.remove('active');
  document.getElementById('viewStage')?.classList.remove('active');
  document.getElementById('viewHall')?.classList.add('active');
  document.getElementById('headerEyebrow').textContent = 'GROUP · FEATURE';
  document.getElementById('headerTitleText').innerHTML = '时空邮局 <span class="header-badge">PAR AVION</span>';
}

function showWall(catKey) {
  _currentView = 'wall';
  document.getElementById('viewHall')?.classList.remove('active');
  document.getElementById('viewStage')?.classList.remove('active');
  document.getElementById('viewWall')?.classList.add('active');
  const cat = PO_CATEGORIES[catKey] || PO_CATEGORIES[_selectedCat];
  if (!cat) return;
  document.getElementById('headerEyebrow').textContent = 'GROUP · ' + cat.tag;
  document.getElementById('headerTitleText').innerHTML = cat.label + ' <span class="header-badge">' + cat.tag + '</span>';
  const chipEl = document.getElementById('wallCatChip');
  if (chipEl) chipEl.textContent = cat.label;
}

function showStage() {
  _currentView = 'stage';
  document.getElementById('viewHall')?.classList.remove('active');
  document.getElementById('viewWall')?.classList.remove('active');
  document.getElementById('viewStage')?.classList.add('active');
}

function handleBack() {
  if (document.getElementById('poInfoSheet')?.classList.contains('open')) { closePoInfo(); return; }
  if (_currentView === 'stage') { backToWallFromStage(); return; }
  if (_currentView === 'wall')  { showHall(); return; }
  if (localStorage.getItem('luna_groupanon_from') === 'groupchat') { history.back(); return; }
  history.back();
}

/* ----------------------------------------------------------------
   HALL — category selection
---------------------------------------------------------------- */
function selectCategory(catKey) {
  _selectedCat = catKey;
  buildWallSlots(catKey);
  document.getElementById('wallCatChip').textContent = PO_CATEGORIES[catKey].label;
  showWall(catKey);
  renderWallGrid();
}

/* 每个分类固定生成 6 个邮箱格，随机指派成员（同一分类下每个成员可能重复出现在不同格，
   但每个格子代表一个独立的「时段」投递） */
function buildWallSlots(catKey) {
  _wallSlots = [];
  const now = new Date();
  const hourKey = getHourKey(now);
  const cellCount = 6;
  for (let i = 0; i < cellCount; i++) {
    const member = _groupMembers[Math.floor(Math.random() * _groupMembers.length)];
    /* slotKey 用于判重：分类 + 成员 + 当前小时时段 + 格位序号
       同一小时内，同一分类同一成员同一格位 → 视为同一封信，不重复生成 */
    const slotKey = `${catKey}__${member.id}__${hourKey}__slot${i}`;
    _wallSlots.push({
      idx: i,
      catKey,
      member,
      slotKey,
      done: !!getStoredLetter(slotKey),
    });
  }
}

function getHourKey(d) {
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}${String(d.getHours()).padStart(2,'0')}`;
}

function renderWallGrid() {
  const grid = document.getElementById('wallMailGrid');
  if (!grid) return;
  grid.innerHTML = _wallSlots.map((slot, i) => {
    const num = String(i + 1).padStart(2, '0');
    const doneCls = slot.done ? ' wm-done' : ' wm-glow-target';
    const checkIcon = slot.done
      ? `<div class="wm-check"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>`
      : `<div class="wm-flag">NEW</div>`;
    return `
    <div class="wm-cell${doneCls}" onclick="enterStage(${i})" style="animation-delay:${Math.min(i*0.05,0.3)}s">
      <div class="wm-num">${num}</div>
      <div class="wm-slot"></div>
      ${checkIcon}
    </div>`;
  }).join('');
}

/* ----------------------------------------------------------------
   STAGE — draw / open / read sequence
---------------------------------------------------------------- */
function enterStage(slotIdx) {
  _activeSlot = _wallSlots[slotIdx];
  if (!_activeSlot) return;
  _cameFromArchive = false;
  showStage();
  resetStageScenes();
  document.getElementById('sbsPlate').textContent = 'NO. ' + String(slotIdx + 1).padStart(2, '0');
  document.getElementById('stageBoxScene').classList.remove('hidden');
}

function resetStageScenes() {
  document.getElementById('stageBoxScene').classList.add('hidden');
  document.getElementById('stageEnvelopeScene').classList.add('hidden');
  document.getElementById('stageLetterScene').classList.add('hidden');
  document.getElementById('letterActions').style.display = 'none';
  const env = document.getElementById('envCard');
  env.classList.remove('opening');
  document.getElementById('lpBody').innerHTML = '';
  document.getElementById('lpSign').innerHTML = '';
  document.getElementById('lpLoading').style.display = 'flex';
}

function backToWallFromStage() {
  /* 如果是从档案柜直接打开的信（没有经过邮箱墙），折起后应该回到大厅，
     并刷新档案柜列表；否则回到邮箱墙，并刷新格子完成状态 */
  if (_cameFromArchive) {
    _cameFromArchive = false;
    renderArchive();
    showHall();
    return;
  }
  /* 保险：如果当前分类还没有生成过邮箱格（理论上不会发生，但防御一下），
     重新生成一遍，避免出现空白邮箱墙 */
  if (!_wallSlots.length || _wallSlots[0].catKey !== _selectedCat) {
    buildWallSlots(_selectedCat);
  }
  renderWallGrid();
  showWall(_selectedCat);
}

/* 阶段 0 → 1：从邮箱抽出信封 */
function drawLetter() {
  const box = document.getElementById('stageBoxScene');
  const env = document.getElementById('stageEnvelopeScene');
  box.style.animation = 'none';
  box.style.transition = 'opacity 0.25s, transform 0.25s';
  box.style.opacity = '0';
  box.style.transform = 'scale(0.85) translateY(-14px)';
  setTimeout(() => {
    box.classList.add('hidden');
    box.style.opacity = ''; box.style.transform = ''; box.style.transition = ''; box.style.animation = '';

    const member = _activeSlot.member;
    const cat = PO_CATEGORIES[_activeSlot.catKey];
    document.getElementById('envPostmarkText').textContent = cat.tag + ' · ' + getHourKey(new Date()).slice(0,8);
    document.getElementById('envAddrTo').textContent = '致 ' + userDisplayName();
    document.getElementById('envAddrFrom').textContent = '寄件人：' + member.name;

    env.classList.remove('hidden');
  }, 260);
}

/* 阶段 1 → 2：拆封 → 展信 → 触发生成/读取 */
function openEnvelope() {
  const envCard = document.getElementById('envCard');
  if (envCard.classList.contains('opening')) return;
  envCard.classList.add('opening');

  setTimeout(() => {
    document.getElementById('stageEnvelopeScene').classList.add('hidden');
    document.getElementById('stageLetterScene').classList.remove('hidden');
    document.getElementById('letterPaper').style.animation = 'none';
    void document.getElementById('letterPaper').offsetWidth;
    document.getElementById('letterPaper').style.animation = '';
    populateLetterHeader();
    loadOrGenerateLetter();
  }, 560);
}

function populateLetterHeader() {
  const member = _activeSlot.member;
  const cat = PO_CATEGORIES[_activeSlot.catKey];
  document.getElementById('lpFromName').textContent = member.name;
  document.getElementById('lpCatTag').textContent = cat.tag;
  const now = new Date();
  document.getElementById('lpTimestamp').textContent =
    `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')} · ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}

/* 折起收好：动画后返回邮箱墙 */
function foldLetterBack() {
  const paper = document.getElementById('letterPaper');
  paper.classList.add('folding');
  setTimeout(() => { backToWallFromStage(); }, 420);
}

function drawAnotherFromStage() {
  /* Re-roll this slot's member so user can peek another mailbox from within stage */
  backToWallFromStage();
}

/* ----------------------------------------------------------------
   存档判重：同一 slotKey（分类+成员+小时时段+格位）只生成一次
---------------------------------------------------------------- */
function getStoredLetter(slotKey) {
  if (_letters[slotKey]) return _letters[slotKey];
  try {
    const raw = localStorage.getItem(getLetterStorageKey(slotKey));
    if (raw) {
      const parsed = JSON.parse(raw);
      _letters[slotKey] = parsed;
      return parsed;
    }
  } catch(e) {}
  return null;
}

function storeLetter(slotKey, letterObj) {
  _letters[slotKey] = letterObj;
  try {
    localStorage.setItem(getLetterStorageKey(slotKey), JSON.stringify(letterObj));
    addToArchiveIndex(slotKey);
    /* 立即刷新大厅档案柜的 DOM，这样用户折起信件回到大厅时，
       档案柜列表已经是最新的，不需要手动刷新页面 */
    renderArchive();
  } catch(e) { console.warn('storeLetter failed', e); }
}

function getLetterStorageKey(slotKey) {
  const gid = localStorage.getItem('luna_current_group_id') || 'default';
  return `luna_po_letter_${gid}_${slotKey}`;
}

function addToArchiveIndex(slotKey) {
  const gid = localStorage.getItem('luna_current_group_id') || 'default';
  const key = `luna_po_archive_${gid}`;
  try {
    let idx = JSON.parse(localStorage.getItem(key) || '[]');
    idx = idx.filter(k => k !== slotKey);
    idx.unshift(slotKey);
    if (idx.length > 60) idx = idx.slice(0, 60);
    localStorage.setItem(key, JSON.stringify(idx));
    _archiveIndex = idx;
  } catch(e) {}
}

function loadArchiveIndex() {
  const gid = localStorage.getItem('luna_current_group_id') || 'default';
  const key = `luna_po_archive_${gid}`;
  try { _archiveIndex = JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) { _archiveIndex = []; }
}

/* ----------------------------------------------------------------
   核心：加载已存档的信 或 调用AI生成新信（严格按人设、>=1000字、带落款）
---------------------------------------------------------------- */
async function loadOrGenerateLetter() {
  const slot = _activeSlot;
  const cached = getStoredLetter(slot.slotKey);

  document.getElementById('letterActions').style.display = 'none';

  if (cached) {
    /* 已存档：直接读取，不重复生成 */
    document.getElementById('lpLoading').style.display = 'none';
    renderLetterBody(cached);
    slot.done = true;
    document.getElementById('letterActions').style.display = 'flex';
    return;
  }

  /* 未存档：调用AI生成 */
  const loadingTextEl = document.getElementById('lpLoadingText');
  const loadingMsgs = ['信件正在穿越时空…', '邮差正在辨认笔迹…', '油墨正在风干…'];
  let msgIdx = 0;
  loadingTextEl.textContent = loadingMsgs[0];
  const loadingTimer = setInterval(() => {
    msgIdx = (msgIdx + 1) % loadingMsgs.length;
    loadingTextEl.textContent = loadingMsgs[msgIdx];
  }, 1400);

  try {
    const letterObj = await generateLetter(slot);
    clearInterval(loadingTimer);
    document.getElementById('lpLoading').style.display = 'none';
    renderLetterBody(letterObj);
    storeLetter(slot.slotKey, letterObj);
    slot.done = true;
    document.getElementById('letterActions').style.display = 'flex';
  } catch(err) {
    clearInterval(loadingTimer);
    document.getElementById('lpLoading').style.display = 'none';
    if (err.message === 'NO_API_CONFIG') {
      notifyApiNotConfigured();
      document.getElementById('lpBody').innerHTML = `<p style="color:var(--gray-500);">尚未配置 AI 接口，请先在「设置 → API」中完成配置后再来取信。</p>`;
    } else {
      poToast('生成失败：' + (err.message || err));
      document.getElementById('lpBody').innerHTML = `<p style="color:var(--gray-500);">信件在传递途中遗失了（生成失败），可以折起后重新取一次。</p>`;
    }
    console.error('[loadOrGenerateLetter]', err);
    document.getElementById('letterActions').style.display = 'flex';
  }
}

function renderLetterBody(letterObj) {
  const bodyEl = document.getElementById('lpBody');
  const signEl = document.getElementById('lpSign');
  const paras = String(letterObj.body || '').split(/\n{1,}/).filter(p => p.trim());
  bodyEl.innerHTML = paras.map(p => `<p>${escHtml(p)}</p>`).join('');
  signEl.textContent = letterObj.signature || '';
}

/* ----------------------------------------------------------------
   AI 生成：严格贴合人设 + 言情小说风格文笔 + >=1000字 + 落款
---------------------------------------------------------------- */
async function generateLetter(slot) {
  const member = slot.member;
  const cat = PO_CATEGORIES[slot.catKey];
  const brief = buildMemberBrief(member);
  const castLine = buildGroupCastLine(member.id);
  const relationCtx = buildRelationContext(member);
  const userName = userDisplayName();
  const userBrief = buildUserBrief();
  const pronoun = userPronoun();

  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日`;

  const systemPrompt = `你正在扮演群聊成员「${member.name}」，此刻TA正在给「${userName}」写一封私人的信，投进「时空邮局」寄出。绝对不能让人感觉是AI在写信，必须严格保持这个人的口吻、性格、说话习惯，不能出戏（不能OOC）。

【这个人是谁——你必须严格按照这个人设来写，不能偏离】
${brief}${relationCtx}

【群里的其他成员，如果信中提到必须用正确称呼】
${castLine || '暂无其他成员'}

【收信人是谁】
收信人是「${userName}」。${userBrief}
这封信是「${member.name}」写给${pronoun}的，不是写给AI、不是写给读者，是写给一个具体的、TA认识的人。

【这封信的方向】
${cat.promptHint}

【文笔风格——非常重要】
整体文笔要偏言情小说的方向：细腻、有画面感、注重情绪的层次和留白，善用具体的感官细节（光线、气味、声音、触感、动作的细微处）来代替直白的抒情，句子有呼吸感、长短错落，不要写成新闻稿或工作总结式的平铺直叙。但内容和情绪必须完全服务于「${member.name}」这个人的真实性格——如果这个人本身冷淡疏离，文笔可以克制留白；如果这个人本身热烈直接，文笔可以更炽烈直白。风格要为人设服务，不能所有人写得像同一个人。

【结构要求】
1. 信件正文需要有完整的起承转合：开头一段自然的引入（不要用"亲爱的TA"这种通用开头，要符合这个人平时说话/写字的习惯），中段至少展开两到三层内容或场景（不能只是一段空泛的抒情，要有具体的事件、画面、细节支撑），结尾要落到一个真实的情绪或态度上，不需要刻意升华或说教。
2. 字数要求：正文不少于1000个汉字（不包括落款），这是硬性要求，请充分展开、不要写得单薄、可以适当增加具体的场景描写、心理活动、细节铺陈来达到字数，但不能注水式地重复同一个意思。
3. 结尾必须有落款，另起一行，格式类似"——${member.name}"或"${member.name}\\n${dateStr}"这样的手写信落款感，落款要符合这个人的语气（比如冷淡的人落款也简短，热情的人落款可能带一句俏皮话），日期可以参考${dateStr}但不必生硬照抄。

【严禁清单——一条都不能犯】
- 禁止出现"AI""模型""程序"等破坏沉浸感的词
- 禁止开头用"亲爱的${userName}"这种模板化称呼，除非这确实符合这个人平时的说话习惯
- 禁止写成鸡汤语录或说教式收尾
- 禁止空洞抒情堆砌形容词而没有具体画面和细节
- 禁止人设漂移：全篇必须让人一眼看出"这就是${member.name}会写的信"，语气、用词、态度必须和人设描述完全吻合，不能因为要凑字数就写出不符合这个人性格的桥段
- 禁止提及群内其他成员时用错称呼，必须严格按照上方关系说明
- 禁止在信中出现任何括号批注、任何"（此处省略）"之类的元信息

【输出格式】
只输出信件正文和落款，不要加任何前缀、说明、标题或引导语。正文和落款之间空一行。`;

  const prompt = `请以「${member.name}」的身份，写一封投进时空邮局、寄给「${userName}」的信。这封信的方向是「${cat.label}」。正文不少于1000字，结尾要有落款。直接开始写信正文，不要任何多余的话。`;

  const raw = await callClaude(prompt, systemPrompt, 3200);

  /* 拆分正文与落款：约定最后一个空行之后的内容视为落款 */
  const { body, signature } = splitBodyAndSignature(raw, member.name);

  return {
    slotKey: slot.slotKey,
    catKey: slot.catKey,
    memberId: member.id,
    memberName: member.name,
    body,
    signature,
    createdAt: Date.now(),
  };
}

function splitBodyAndSignature(raw, memberName) {
  const text = raw.trim();
  const lines = text.split('\n');
  /* 从末尾往前找，寻找疑似落款行：包含人名 / 以"——"开头 / 是日期格式 */
  let sigStartIdx = -1;
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 4); i--) {
    const l = lines[i].trim();
    if (!l) continue;
    if (l.startsWith('——') || l.startsWith('—') || l.includes(memberName) || /\d{4}[.年]/.test(l)) {
      sigStartIdx = i;
    } else {
      break;
    }
  }
  if (sigStartIdx === -1) {
    /* 没找到明显落款格式，退化为最后一行作为落款 */
    const lastNonEmpty = [...lines].reverse().find(l => l.trim());
    const idx = lines.lastIndexOf(lastNonEmpty);
    sigStartIdx = idx >= 0 ? idx : lines.length - 1;
  }
  const bodyLines = lines.slice(0, sigStartIdx).join('\n').trim();
  const sigLines  = lines.slice(sigStartIdx).join('\n').trim();
  return {
    body: bodyLines || text,
    signature: sigLines || `——${memberName}`,
  };
}

/* ----------------------------------------------------------------
   HALL — 档案柜（存档信件列表）
---------------------------------------------------------------- */
function renderArchive() {
  loadArchiveIndex();
  const listEl  = document.getElementById('hallArchiveList');
  const emptyEl = document.getElementById('hallArchiveEmpty');
  const countEl = document.getElementById('hallArchiveCount');
  if (!listEl) return;

  const letters = _archiveIndex
    .map(slotKey => {
      let obj = _letters[slotKey];
      if (!obj) {
        try {
          const raw = localStorage.getItem(getLetterStorageKey(slotKey));
          if (raw) obj = JSON.parse(raw);
        } catch(e) {}
      }
      return obj;
    })
    .filter(Boolean);

  countEl.textContent = letters.length + ' 封';

  if (!letters.length) {
    emptyEl.style.display = 'block';
    listEl.innerHTML = '';
    return;
  }
  emptyEl.style.display = 'none';

  listEl.innerHTML = letters.map(letter => {
    const member = _groupMembers.find(m => m.id === letter.memberId) || { name: letter.memberName, initial: (letter.memberName||'?')[0] };
    const cat = PO_CATEGORIES[letter.catKey] || { label: '来信', tag: 'MAIL' };
    const preview = String(letter.body || '').slice(0, 26).replace(/\n/g, ' ');
    const d = new Date(letter.createdAt);
    const timeStr = `${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
    return `
    <div class="harc-item" onclick="openArchiveLetter('${letter.slotKey}')">
      <div class="harc-av">${renderAvatar(member, 'harc-av-img')}</div>
      <div class="harc-mid">
        <div class="harc-name-row">
          <span class="harc-name">${escHtml(member.name)}</span>
          <span class="harc-cat-pill">${cat.tag}</span>
        </div>
        <div class="harc-preview">${escHtml(preview)}${preview.length >= 26 ? '…' : ''}</div>
      </div>
      <div class="harc-time">${timeStr}</div>
    </div>`;
  }).join('');
}

/* 从档案柜直接重新展信阅读（不需要走邮箱墙的抽信/拆封动画，直接展信） */
function openArchiveLetter(slotKey) {
  let obj = _letters[slotKey];
  if (!obj) {
    try {
      const raw = localStorage.getItem(getLetterStorageKey(slotKey));
      if (raw) obj = JSON.parse(raw);
    } catch(e) {}
  }
  if (!obj) { poToast('这封信已经找不到了'); return; }

  const member = _groupMembers.find(m => m.id === obj.memberId) || { id: obj.memberId, name: obj.memberName, initial: (obj.memberName||'?')[0] };
  _activeSlot = { slotKey: obj.slotKey, catKey: obj.catKey, member };
  _selectedCat = obj.catKey;
  _cameFromArchive = true;

  /* 同步header标题为该信件所属的分类，避免残留上一个视图的标题 */
  const cat = PO_CATEGORIES[obj.catKey] || { label: '来信', tag: 'MAIL' };
  document.getElementById('headerEyebrow').textContent = 'GROUP · ' + cat.tag;
  document.getElementById('headerTitleText').innerHTML = cat.label + ' <span class="header-badge">' + cat.tag + '</span>';

  showStage();
  resetStageScenes();
  document.getElementById('stageEnvelopeScene').classList.add('hidden');
  document.getElementById('stageBoxScene').classList.add('hidden');
  document.getElementById('stageLetterScene').classList.remove('hidden');
  populateLetterHeader();
  document.getElementById('lpLoading').style.display = 'none';
  renderLetterBody(obj);
  document.getElementById('letterActions').style.display = 'flex';
}

/* ----------------------------------------------------------------
   Info sheet
---------------------------------------------------------------- */
function showPoInfo() {
  document.getElementById('poSheetOverlay')?.classList.add('open');
  document.getElementById('poInfoSheet')?.classList.add('open');
}
function closePoInfo() {
  document.getElementById('poSheetOverlay')?.classList.remove('open');
  document.getElementById('poInfoSheet')?.classList.remove('open');
}

/* ----------------------------------------------------------------
   Toast
---------------------------------------------------------------- */
function poToast(msg) {
  const t = document.getElementById('poToast');
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
  setInterval(updateTime, 30000);

  loadGroupData();
  loadArchiveIndex();

  try {
    _userIdentity = await loadUserIdentity();
    _userGender = deriveGender(_userIdentity);
  } catch(e) {}

  renderArchive();
  showHall();
});