/* ================================
   topicbomb.js — 话题炸弹
   玩法：输入/随机主题词 → AI炸出话题气泡 → 选一个引爆
        → 群成员逐个发言 → AI浓缩一句话共识 → 用户判定
================================ */

/* ----------------------------------------------------------------
   Status bar utilities (1:1 来自 groupanon.js)
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
let _groupMembers   = [];
let _groupName      = 'GROUP';
let _usingDemoMembers = false;

let _userIdentity = null;
let _userGender   = null;

let _currentStage   = 'input';
let _lastTopicSeed  = '';
let _lastWasRandom  = false;
let _bubbleOptions  = [];      // [{word, angle}]
let _activeTopic    = null;    // {seedWord, angle, question}
let _roundNum       = 0;       // current round number within this topic
let _fuseEntries    = [];      // [{member, text}] — current round only
let _topicTranscript = [];     // [{round, member, text}] — full topic history across rounds
let _fuseTimerHandle = null;
let _fuseStartTime   = 0;
let _fuseSkipped     = false;
let _resultLine      = '';
let _resultLinesByRound = [];  // consensus line per round, for history record

let _chosenBlastMember = null; // member currently being processed (legacy single-target ref, kept for appeal/reply-assist reuse)
let _chosenPunish      = null; // chosen punishment text for current member
let _pendingPunish     = null; // { member, punishText, resultLine, round } — staged punishment awaiting appeal outcome, not yet committed to black-history log
let _punishOptions     = [];   // current punishment options for current member
let _appealEntries     = [];   // [{who:'user'|'member', text}] for current appeal thread
let _usedReplyDrafts    = [];  // dedupe pool for "帮我回复" across the whole appeal thread
let _topicBlastLog      = [];  // [{round, member, line, punish}] — black-history entries for this topic

/* 多选/全员引爆 + 逐人处理队列 */
let _multiSelectedIds   = new Set();  // member ids selected in this round's judge grid
let _essayReopenMode    = false;      // true when essay overlay is opened from summary replay, not live punishment flow
let _appealReopenMode   = false;      // true when appeal panel is opened from summary replay, not live punishment flow
let _blastQueue         = [];         // member objects queued for punishment this round, processed one at a time
let _blastQueueIndex    = 0;          // index into _blastQueue currently being handled
let _usedPunishLines    = [];         // dedupe pool of punishment text already used (whole session), to avoid repeats
let _appealRetryCount   = 0;          // how many times appeal generation has fallen back, for varied fallback lines

/* 开局转盘 + 逐人查看接龙 */
let _starterWheelSpinning = false;
let _starterWheelResultId = null;
let _fuseOrder       = [];    // 本轮发言顺序（由转盘决定起点）
let _fuseCursor      = -1;    // 当前已展示到第几个人（-1 表示还没开始）
let _fuseAllSeen     = false; // 是否所有人都已展示过
let _currentFuseEntryRow = null; // 当前正在展示的人，最初那条气泡的DOM行（用于"继续说"时追加内容）

let _tension       = 0;        // 0-100
let _detonateStreak = 0;       // consecutive non-"bomb" picks

const ESSAY_KEYWORDS = ['作文','检讨','认错信','道歉信','小作文','检讨书','检讨信','自白书','悔过书','反思'];
function looksLikeEssayPunish(text) {
  return ESSAY_KEYWORDS.some(k => text.includes(k));
}


/* ----------------------------------------------------------------
   Fallback demo members (与 groupanon.js 保持一致)
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
   User identity (1:1 来自 groupanon.js)
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
    const active = list.find(i => i.active !== false) || list[0];
    return active;
  } catch(e) { return null; }
}

function deriveGender(identity) {
  if (!identity) return null;
  const src = [
    identity.gender || '',
    identity.desc   || '',
    (identity.tags  || []).join(' '),
    identity.role   || '',
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
  if (_userIdentity.tags && _userIdentity.tags.length) {
    parts.push('标签：' + _userIdentity.tags.join('、'));
  }
  if (_userIdentity.gender) parts.push(_userIdentity.gender);
  return parts.length ? parts.join('；') : '群组的创建者。';
}

/* ----------------------------------------------------------------
   Group data (1:1 来自 groupanon.js)
---------------------------------------------------------------- */
function loadGroupData() {
  _usingDemoMembers = false;
  try {
    const raw = localStorage.getItem('luna_groupanon_data')
             || localStorage.getItem('luna_group_data')
             || localStorage.getItem('luna_groupchat_data');
    if (raw) {
      const data = JSON.parse(raw);
      _groupName    = data.name    || 'GROUP';
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

function renderAvatar(member, sizeClass) {
  if (member && member.avatar) {
    return `<img src="${escHtml(member.avatar)}" class="${sizeClass} av-img" alt="${escHtml(member.name)}" onerror="this.parentElement.innerHTML='${escHtml(member.initial||'?')}'" />`;
  }
  return escHtml(member ? (member.initial || '?') : '?');
}

function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ----------------------------------------------------------------
   AI call (1:1 来自 groupanon.js)
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
    const body = { model, max_tokens: maxTokens || 500, temperature: 1, messages: [{ role: 'user', content: prompt }] };
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
      throw new Error('API 返回空内容' + (finishReason ? `（finish_reason: ${finishReason}）` : '') + '，可能被内容过滤或 max_tokens 过小');
    }
  }
  return reply.trim();
}

function notifyApiNotConfigured() {
  tbToast('请先在「设置 → API」中配置并选择模型');
}

/* ----------------------------------------------------------------
   Member persona helpers (1:1 来自 groupanon.js)
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

/* 构建"全群关系网"——不再只告诉AI"我和别人的关系"，
   而是把群里所有人彼此之间的称呼/关系也一起列出来，
   避免不同成员各自发言时编出互相矛盾的称呼（比如凭空冒出一个"嫂子"）。 */
function buildFullRelationMap(excludeForSelf) {
  if (_groupMembers.length < 2) return '';
  const lines = [];
  _groupMembers.forEach(a => {
    /* excludeForSelf 之前没生效：当前角色"我对别人"的关系已经在上面那段单独列过了，
       这里如果再用另一种措辞重复一遍同样的关系，等于把同一份事实喂给AI两次、
       格式还不完全一样，容易在长对话里被读串、读出"两套关系"的错觉。
       这里跳过当前角色自己作为"a"的部分，只保留"群里其他人之间互相怎么称呼"这部分新信息。 */
    if (excludeForSelf && a.id === excludeForSelf) return;
    _groupMembers.forEach(b => {
      if (a.id === b.id) return;
      const rel = a.relations && a.relations[b.id];
      if (rel && (rel.callName || rel.relationship)) {
        const callPart = rel.callName ? `称呼TA「${rel.callName}」` : '';
        const relPart  = rel.relationship ? rel.relationship : '';
        lines.push(`- 「${a.name}」对「${b.name}」：${[callPart, relPart].filter(Boolean).join('，')}`);
      }
    });
  });
  if (!lines.length) {
    /* 群里完全没有配置任何人物关系：明确告诉AI不要自己编造亲属/恋人等关系称呼 */
    return `\n【群内人物关系】本群成员之间没有设定特殊的亲属/恋人关系，互相之间用「群友」「哥们」这类泛称即可，绝对不能凭空编造"嫂子""媳妇""老婆"这类亲属/伴侣称呼，也不要给任何人编造原本没有的身份关系。`;
  }
  return `\n【群内人物关系——这是整个群已知的关系网（不含你自己对别人的部分，那部分见上方），所有成员的发言都必须和这张关系网保持一致，谁该叫谁什么、是什么关系，不能凭感觉乱编，也不能编出这里没有的关系（比如不能凭空说谁是谁的"嫂子""媳妇"）】\n${lines.join('\n')}`;
}

function buildRelationContext(member) {
  const others = _groupMembers.filter(m => m.id !== member.id);
  if (!others.length) return '';
  const lines = others.map(other => {
    const rel = member.relations && member.relations[other.id];
    if (rel) {
      const callPart = rel.callName ? `叫TA「${rel.callName}」` : `叫TA「${other.name}」`;
      const relPart  = rel.relationship ? `，${rel.relationship}` : '';
      return `- 对「${other.name}」：${callPart}${relPart}。说话时要让人一听就感觉到这层关系（比如该亲近的就别端着，该有分寸的就别太随便）。`;
    }
    return `- 对「${other.name}」：直接叫「${other.name}」，群里没有给你们设定特殊关系，不要自己编造亲属/恋人关系。`;
  });
  return `\n【你和群内其他人的称呼与关系——说话时必须用这里的称呼，不能乱叫，更不能把关系写得比设定淡，也不能给自己或别人编造这里没有提到的身份关系】\n${lines.join('\n')}${buildFullRelationMap(member.id)}`;
}

/* 把用户对TA的称呼/关系也提取出来，让角色对用户说话时带上这层亲疏感 */
function buildUserRelationContext(member) {
  const rel = member.relations && member.relations.__user;
  const userName = userDisplayName();
  if (rel) {
    const callPart = rel.callName ? `称呼TA为「${rel.callName}」` : `称呼TA为「${userName}」`;
    const relPart  = rel.relationship ? `，关系是：${rel.relationship}` : '';
    return `\n【你和群主「${userName}」之间】${callPart}${relPart}。这是你们之间的真实分寸，发言里要透出这种熟悉/亲近/客气程度的差异，不能写得跟对陌生人说话一样。`;
  }
  return `\n【你和群主「${userName}」之间】群主是这个群的创建者，按你的性格习惯去对待TA即可。`;
}

/* 提取角色的语言习惯线索：口头禅、句式偏好，避免千人一面 */
function buildVoiceHint(member) {
  const bio = (member.desc || member.bio || '').trim();
  return `\n【说话方式要求】
1. 这个人有自己一套固定的说话习惯（用词偏好、句子长短、是否爱用反问/省略/语气词），不要写成通用的"礼貌AI腔"；
2. 同一个人在不同话题下说话的"骨架"应该是稳定的——如果TA平时话少，这次也不能突然变成话痨；如果TA刻薄，这次也不能突然变得温和讲道理；
3. 可以适当带点小说里的细节感（一个动作、一个停顿、一句没说完的话），但别写成大段心理描写，整体还是要像群聊消息，1-2句话内完成。`;
}



/* ----------------------------------------------------------------
   STAGE control
---------------------------------------------------------------- */
function showStage(name) {
  _currentStage = name;
  document.querySelectorAll('.tb-stage').forEach(el => el.classList.remove('active'));
  const map = {
    input:     'stageInput',
    bubbles:   'stageBubbles',
    detonate:  'stageDetonate',
    fuse:      'stageFuse',
    result:    'stageResult',
  };
  document.getElementById(map[name])?.classList.add('active');
}

function handleBack() {
  if (document.getElementById('replyAssistSheet')?.classList.contains('open')) {
    closeReplyAssistSheet(); return;
  }
  if (document.getElementById('transcriptSheet')?.classList.contains('open')) {
    closeFullTranscript(); return;
  }
  if (document.getElementById('historySheet')?.classList.contains('open')) {
    closeHistorySheet(); return;
  }
  if (document.getElementById('infoSheet')?.classList.contains('open')) {
    closeInfoSheet(); return;
  }
  if (_currentStage === 'fuse' || _currentStage === 'detonate') {
    /* mid-game: confirm exit by just returning to input, stopping timers */
    clearInterval(_fuseTimerHandle);
    _activeTopic = null;
    _fuseEntries = [];
    _topicTranscript = [];
    _topicBlastLog = [];
    _roundNum = 0;
    showStage('input');
    setHeaderForInput();
    return;
  }
  if (_currentStage === 'bubbles' || _currentStage === 'result') {
    _activeTopic = null;
    _fuseEntries = [];
    _topicTranscript = [];
    _topicBlastLog = [];
    _roundNum = 0;
    showStage('input');
    setHeaderForInput();
    return;
  }
  /* at input stage: navigate back to hub page if present, else no-op */
  if (window.history.length > 1) window.history.back();
}

function setHeaderForInput() {
  document.getElementById('headerEyebrow').textContent = 'GROUP · BOMB';
  document.getElementById('headerTitleText').innerHTML = '话题炸弹 <span class="header-badge">DETONATE</span>';
}

/* ----------------------------------------------------------------
   STAGE 1 — Topic input
---------------------------------------------------------------- */
function onTopicInput(el) {
  const remain = 16 - el.value.length;
  document.getElementById('topicCount').textContent = Math.max(0, remain);
}

function onTopicKeydown(e) {
  if (e.key === 'Enter') generateBubbles(false);
}

/* ----------------------------------------------------------------
   STAGE 2 — Generate & render bubbles
---------------------------------------------------------------- */
const RANDOM_SEED_WORDS = [
  '恋爱脑','加班','异地恋','存款','原生家庭','摆烂','发朋友圈被屏蔽',
  '相亲','彩礼','躺平','内卷','人设崩塌','社交牛逼症','已读不回',
  '同居','催婚','分手','暗恋','PUA','情绪稳定',
];

async function generateBubbles(useRandom) {
  _lastWasRandom = !!useRandom;
  const inputEl = document.getElementById('topicInput');
  let seed = (inputEl?.value || '').trim();

  if (useRandom || !seed) {
    seed = RANDOM_SEED_WORDS[Math.floor(Math.random() * RANDOM_SEED_WORDS.length)];
    if (inputEl) inputEl.value = '';
  }
  _lastTopicSeed = seed;

  showStage('bubbles');
  const field = document.getElementById('bubbleField');
  field.innerHTML = `
    <div class="bubble-loading" id="bubbleLoading">
      <div class="bl-orb"></div>
      <div class="bl-text">正在炸开「${escHtml(seed)}」相关的话题…</div>
    </div>`;

  try {
    const angles = await aiGenerateTopicAngles(seed);
    _bubbleOptions = angles;
    renderBubbleField(angles);
  } catch(err) {
    if (err.message === 'NO_API_CONFIG') {
      notifyApiNotConfigured();
      _bubbleOptions = buildFallbackAngles(seed);
      renderBubbleField(_bubbleOptions);
    } else {
      tbToast('生成失败：' + (err.message || err));
      _bubbleOptions = buildFallbackAngles(seed);
      renderBubbleField(_bubbleOptions);
    }
  }
}

function buildFallbackAngles(seed) {
  return [
    { word: seed, tag: 'CORE' },
    { word: seed + '的边界感', tag: 'ANGLE' },
    { word: '谁该为' + seed + '买单', tag: 'ANGLE' },
    { word: seed + '是不是矫情', tag: 'ANGLE' },
    { word: seed + '的真实代价', tag: 'ANGLE' },
  ];
}

async function aiGenerateTopicAngles(seed) {
  const castLine = _groupMembers.map(m => m.name).join('、');
  const system = `你是一个善于制造群聊话题的策划。给定一个种子词，输出 5 个能让群聊吵起来或聊开的具体话题角度（每个角度是一句可以直接抛进群里讨论的短句，8-16字，不要带标点结尾）。
群成员：${castLine || '未知'}。
只输出 JSON 数组，不要任何其他文字，不要 markdown 代码块，格式：
[{"word":"角度短句1"},{"word":"角度短句2"},{"word":"角度短句3"},{"word":"角度短句4"},{"word":"角度短句5"}]`;
  const prompt = `种子词：${seed}`;
  const raw = await callClaude(prompt, system, 400);
  const cleaned = raw.replace(/```json|```/g, '').trim();
  let arr;
  try { arr = JSON.parse(cleaned); } catch(e) {
    /* try to extract array substring */
    const m = cleaned.match(/\[[\s\S]*\]/);
    if (m) arr = JSON.parse(m[0]);
    else throw new Error('AI 返回格式无法解析');
  }
  if (!Array.isArray(arr) || !arr.length) throw new Error('AI 未返回有效话题');
  return arr.slice(0, 6).map(item => ({
    word: (item.word || item.text || '').toString().slice(0, 20) || seed,
    tag: 'ANGLE',
  }));
}

/* Position bubbles loosely scattered, varying size */
function renderBubbleField(angles) {
  const field = document.getElementById('bubbleField');
  field.innerHTML = '';
  const fw = field.clientWidth  || 320;
  const fh = field.clientHeight || 420;

  const sizes = [104, 92, 116, 86, 98, 78];
  const placed = [];

  angles.forEach((item, idx) => {
    const size = sizes[idx % sizes.length];
    let x, y, tries = 0;
    do {
      x = 14 + Math.random() * Math.max(10, fw - size - 28);
      y = 14 + Math.random() * Math.max(10, fh - size - 28);
      tries++;
    } while (tries < 24 && placed.some(p => {
      const dx = (p.x + p.size/2) - (x + size/2);
      const dy = (p.y + p.size/2) - (y + size/2);
      return Math.sqrt(dx*dx + dy*dy) < (p.size/2 + size/2 + 6);
    }));
    placed.push({ x, y, size });

    const bubble = document.createElement('div');
    bubble.className = 'bubble-pop' + (idx === 0 ? ' bp-accent' : '');
    bubble.style.width  = size + 'px';
    bubble.style.height = size + 'px';
    bubble.style.left = x + 'px';
    bubble.style.top  = y + 'px';
    bubble.style.animationDelay = (idx * 0.06) + 's, ' + (idx * 0.3) + 's';
    bubble.style.fontSize = Math.max(11, Math.min(14.5, size / 7.2)) + 'px';
    bubble.innerHTML = `<span class="bp-word">${escHtml(item.word)}</span><span class="bp-tag">TAP TO BLAST</span>`;
    bubble.onclick = () => onBubblePicked(item, bubble);
    field.appendChild(bubble);
  });
}

function onBubblePicked(item, bubbleEl) {
  document.querySelectorAll('.bubble-pop').forEach(b => { if (b !== bubbleEl) b.style.pointerEvents = 'none'; });
  bubbleEl.classList.add('bubble-popped');
  _activeTopic = { seedWord: _lastTopicSeed, angle: item.word };
  _roundNum = 0;
  _topicTranscript = [];
  _topicBlastLog = [];
  _resultLinesByRound = [];
  setTimeout(() => runDetonateAnimation(item.word), 280);
}

/* ----------------------------------------------------------------
   STAGE 3 — Detonation animation
---------------------------------------------------------------- */
function runDetonateAnimation(word) {
  showStage('detonate');
  document.getElementById('detonateWord').textContent = word;
  document.getElementById('detonateCaption').textContent = '引爆中…';

  const particlesEl = document.getElementById('detonateParticles');
  particlesEl.innerHTML = '';
  const n = 16;
  for (let i = 0; i < n; i++) {
    const sp = document.createElement('div');
    sp.className = 'det-spark';
    const angle = (i / n) * Math.PI * 2;
    const dist = 60 + Math.random() * 50;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;
    sp.style.setProperty('--tx', tx + 'px');
    sp.style.setProperty('--ty', ty + 'px');
    sp.style.opacity = '0';
    sp.style.animation = `detSparkFly 0.8s ease-out ${0.15 + Math.random()*0.15}s forwards`;
    sp.style.setProperty('transform', `translate(${tx}px, ${ty}px)`);
    particlesEl.appendChild(sp);
  }
  /* inject keyframes once */
  if (!document.getElementById('detSparkKeyframes')) {
    const style = document.createElement('style');
    style.id = 'detSparkKeyframes';
    style.textContent = `@keyframes detSparkFly {
      0%   { opacity: 1; transform: translate(0,0) scale(1); }
      100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0.3); }
    }`;
    document.head.appendChild(style);
  }

  setTimeout(() => {
    document.getElementById('detonateCaption').textContent = '话题已抛入群聊…';
  }, 600);

  setTimeout(() => {
    openStarterWheel();
  }, 1450);
}

/* ----------------------------------------------------------------
   开局转盘 — 等概率随机决定本轮接龙谁第一个发言
   （扇区数 = 群成员数，纯 Math.random() 抽取，不含用户本人）
---------------------------------------------------------------- */
function openStarterWheel() {
  _starterWheelSpinning = false;
  _starterWheelResultId = null;
  buildStarterWheelSvg();
  document.getElementById('starterWheelResult').textContent = '\u00a0';
  document.getElementById('starterWheelBtn').classList.remove('disabled');
  document.getElementById('starterWheelBtn').querySelector('span').textContent = '开始转动';
  const svg = document.getElementById('starterWheelSvg');
  svg.style.transition = 'none';
  svg.style.transform = 'rotate(0deg)';
  void svg.offsetWidth;
  document.getElementById('starterWheelOverlay').classList.add('show');
}

const WHEEL_COLORS = ['#1c1c1e', '#3a3a3d', '#5a5a5d', '#7a7a7e', '#c4504a', '#9a93ac', '#b8835e', '#5f8a7a'];

function buildStarterWheelSvg() {
  const svg = document.getElementById('starterWheelSvg');
  const n = _groupMembers.length;
  const cx = 120, cy = 120, r = 112;
  const slice = 360 / n;
  let html = '';
  for (let i = 0; i < n; i++) {
    const startAngle = i * slice - 90;
    const endAngle = startAngle + slice;
    const x1 = cx + r * Math.cos(startAngle * Math.PI / 180);
    const y1 = cy + r * Math.sin(startAngle * Math.PI / 180);
    const x2 = cx + r * Math.cos(endAngle * Math.PI / 180);
    const y2 = cy + r * Math.sin(endAngle * Math.PI / 180);
    const largeArc = slice > 180 ? 1 : 0;
    const color = WHEEL_COLORS[i % WHEEL_COLORS.length];
    html += `<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${largeArc} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${color}" stroke="#fff" stroke-width="1.5"/>`;

    const midAngle = startAngle + slice / 2;
    const labelR = r * 0.62;
    const lx = cx + labelR * Math.cos(midAngle * Math.PI / 180);
    const ly = cy + labelR * Math.sin(midAngle * Math.PI / 180);
    const name = _groupMembers[i].name;
    const label = name.length > 4 ? name.slice(0, 4) + '…' : name;
    html += `<text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" fill="#fff" font-size="11" font-weight="700" font-family="Syne, sans-serif" text-anchor="middle" dominant-baseline="middle" transform="rotate(${(midAngle+90).toFixed(2)}, ${lx.toFixed(2)}, ${ly.toFixed(2)})">${escHtml(label)}</text>`;
  }
  svg.innerHTML = html;
  svg.dataset.sliceDeg = slice;
}

function spinStarterWheel() {
  if (_starterWheelSpinning) return;
  _starterWheelSpinning = true;
  document.getElementById('starterWheelBtn').classList.add('disabled');
  document.getElementById('starterWheelResult').textContent = '转动中…';

  const n = _groupMembers.length;
  const slice = 360 / n;
  /* 真正等概率抽取：每个成员被抽中的概率均为 1/n */
  const winnerIndex = Math.floor(Math.random() * n);

  /* 让指针（固定在正上方）最终停在 winnerIndex 这个扇区的中心。
     扇区 i 的中心角度（相对转盘自身、起点在正上方）= i*slice + slice/2
     转盘需要旋转的角度 = 360*圈数 - 该中心角度（顺时针转，扇区中心转到指针处） */
  const fullSpins = 5 + Math.floor(Math.random() * 3); // 5~7圈，纯视觉效果
  const targetCenterAngle = winnerIndex * slice + slice / 2;
  const finalRotation = fullSpins * 360 + (360 - targetCenterAngle);

  const svg = document.getElementById('starterWheelSvg');
  svg.style.transition = 'transform 4.2s cubic-bezier(0.12, 0.78, 0.13, 1)';
  void svg.offsetWidth;
  svg.style.transform = `rotate(${finalRotation}deg)`;

  setTimeout(() => {
    const winner = _groupMembers[winnerIndex];
    _starterWheelResultId = winner.id;
    document.getElementById('starterWheelResult').textContent = `「${winner.name}」第一个发言！`;
    const btn = document.getElementById('starterWheelBtn');
    btn.classList.remove('disabled');
    btn.querySelector('span').textContent = '开始接龙';
    btn.onclick = confirmStarterWheelAndEnterFuse;
    _starterWheelSpinning = false;
  }, 4300);
}

function confirmStarterWheelAndEnterFuse() {
  document.getElementById('starterWheelOverlay').classList.remove('show');
  /* 恢复按钮默认行为，供下一轮转盘使用 */
  const btn = document.getElementById('starterWheelBtn');
  btn.onclick = spinStarterWheel;
  startFuseStage(_starterWheelResultId);
}


async function startFuseStage(starterMemberId) {
  showStage('fuse');
  _roundNum += 1;
  _fuseEntries = [];
  _fuseCursor = -1;
  _fuseAllSeen = false;
  _fuseStartTime = Date.now();

  document.getElementById('headerEyebrow').textContent = 'GROUP · LIVE';
  document.getElementById('headerTitleText').innerHTML = '正在接龙 <span class="header-badge">LIVE</span>';

  const question = await resolveFuseQuestion(_activeTopic);
  _activeTopic.question = question;

  document.getElementById('fuseRoundNum').textContent = _roundNum;
  document.getElementById('fuseTopicText').textContent = question;
  document.getElementById('fuseMemberCount').textContent = _groupMembers.length;
  document.getElementById('fuseProgressText').textContent = '0';
  document.getElementById('fuseStream').innerHTML = '';
  document.getElementById('fuseNextBar').style.display = 'flex';
  document.getElementById('fuseNextBtn').style.display = 'flex';
  document.getElementById('fuseNextBtnText').textContent = '下一个';
  document.getElementById('fuseContinueBtn').style.display = 'flex';
  document.getElementById('fuseContinueBtnText').textContent = '让TA继续说';
  syncFuseBlastBtn();

  clearInterval(_fuseTimerHandle);
  _fuseTimerHandle = setInterval(updateFuseTimer, 500);
  updateFuseTimer();

  /* 顺序由转盘结果决定起点：从转盘抽中的人开始，后面的人按打乱顺序接龙，
     这样"谁先发言"每次都不固定，不会总是数组里的第一个人。 */
  const starterIdx = starterMemberId
    ? _groupMembers.findIndex(m => m.id === starterMemberId)
    : Math.floor(Math.random() * _groupMembers.length);
  const safeIdx = starterIdx >= 0 ? starterIdx : 0;
  const rotated = [..._groupMembers.slice(safeIdx), ..._groupMembers.slice(0, safeIdx)];
  const rest = shuffleArray(rotated.slice(1));
  _fuseOrder = [rotated[0], ...rest];

  /* 自动展示第一个人的发言，后续由用户点"下一个"推进 */
  await advanceFuseToNextMember();
}

async function advanceFuseToNextMember() {
  if (_fuseCursor >= _fuseOrder.length - 1) return; // 已经全部展示完
  _fuseCursor += 1;
  const member = _fuseOrder[_fuseCursor];
  const prevEntry = _fuseEntries[_fuseEntries.length - 1] || null;

  const nextBtn = document.getElementById('fuseNextBtn');
  nextBtn.style.pointerEvents = 'none';
  nextBtn.style.opacity = '0.5';

  await streamMemberFuseReply(member, _activeTopic.question, prevEntry);

  document.getElementById('fuseProgressText').textContent = String(_fuseEntries.length);

  nextBtn.style.pointerEvents = '';
  nextBtn.style.opacity = '';

  if (_fuseCursor >= _fuseOrder.length - 1) {
    _fuseAllSeen = true;
    /* 修复：之前最后一个人发言完会把"下一个"和"让TA继续说"都隐藏掉，
       导致刚说完的最后一个人反而没法用"继续说"这个最自然的入口，
       只能去翻头像点击这种没人会想到的方式。现在只隐藏"下一个"
       （因为确实没有下一个人了），"让TA继续说"对最后这个人继续保留可用。 */
    nextBtn.style.display = 'none';
    tbToast('所有人都发言完了，还想让谁多说可以点TA头像，或者继续听最后这位说，想好了再点「去引爆」');
  }
  syncFuseBlastBtn();
}

/* 全部人发言完后，用户可以点流里任意一个人的头像，让TA再多说几句——
   不再局限于"只能让当前最后发言的人继续"，也不强制立刻去引爆。

   关键修复：之前不管点的是谁，追加的气泡都长得一样（没头像没名字，
   直接糊在流的最末尾），这样一来只要被点的人不是"当前最后发言的那个人"，
   TA继续说的内容看起来就会变成是挂在最后发言者身上——角色对不上、
   关系网跟着显得乱。现在区分两种情况：
   - 如果点的就是当前最后发言的人（紧接着的延续）→ 保持原来的"无头像续接"样式；
   - 如果点的是更早发言的人（中间隔着别人）→ 必须重新带上头像+名字，
     并加一个「接着说」小标签，确保不管它出现在流的哪个位置，都一眼能看出是谁在说。 */
async function continueMemberFromStream(memberId) {
  const member = _fuseOrder.find(m => m.id === memberId) || _groupMembers.find(m => m.id === memberId);
  if (!member) return;
  /* 找到这个人在本轮已有的发言，作为继续的上下文；如果还没轮到TA说过，则忽略点击 */
  const entry = [..._fuseEntries].reverse().find(e => e.member.id === memberId);
  if (!entry) return;

  const stream = document.getElementById('fuseStream');
  const lastEntry = _fuseEntries[_fuseEntries.length - 1];
  const isContiguous = !!lastEntry && lastEntry.member.id === memberId;

  const typingRow = document.createElement('div');
  if (isContiguous) {
    typingRow.className = 'fuse-bubble fuse-bubble-cont';
    typingRow.innerHTML = `
      <div class="fuse-av fuse-av-spacer"></div>
      <div class="fuse-content"><div class="fuse-typing"><span></span><span></span><span></span></div></div>`;
  } else {
    typingRow.className = 'fuse-bubble';
    typingRow.innerHTML = `
      <div class="fuse-av fuse-av-clickable" title="点头像让TA继续说" onclick="continueMemberFromStream('${escHtml(member.id)}')">${renderAvatar(member, 'fuse-av-inner')}</div>
      <div class="fuse-content">
        <div class="fuse-name">${escHtml(member.name)}<span class="fuse-name-cont-tag"> · 接着说</span></div>
        <div class="fuse-typing"><span></span><span></span><span></span></div>
      </div>`;
  }
  stream.appendChild(typingRow);
  stream.scrollTop = stream.scrollHeight;

  let lines = [];
  try {
    lines = await generateMemberFuseContinue(member, _activeTopic.question, entry.text);
  } catch (err) {
    lines = [];
  }

  if (!lines.length) {
    typingRow.remove();
    tbToast('TA好像没有更多想说的了');
    return;
  }

  /* 第一条用来替换typing占位；非连续的情况要重新带上名字 */
  const firstContentEl = typingRow.querySelector('.fuse-content');
  firstContentEl.innerHTML = isContiguous
    ? `<div class="fuse-text-wrap">${escHtml(lines[0])}</div>`
    : `<div class="fuse-name">${escHtml(member.name)}<span class="fuse-name-cont-tag"> · 接着说</span></div>
       <div class="fuse-text-wrap">${escHtml(lines[0])}</div>`;
  stream.scrollTop = stream.scrollHeight;

  for (let i = 1; i < lines.length; i++) {
    const extraRow = document.createElement('div');
    extraRow.className = 'fuse-bubble fuse-bubble-cont';
    extraRow.innerHTML = `
      <div class="fuse-av fuse-av-spacer"></div>
      <div class="fuse-content">
        <div class="fuse-text-wrap">${escHtml(lines[i])}</div>
      </div>`;
    stream.appendChild(extraRow);
    stream.scrollTop = stream.scrollHeight;
  }

  /* 合并进该成员在本轮的发言记录，确保引爆判定/惩罚阶段也能看到追加内容 */
  entry.text = entry.text + '\n' + lines.join('\n');
  const transcriptEntry = [..._topicTranscript].reverse()
    .find(t => t.round === _roundNum && t.member.id === memberId);
  if (transcriptEntry) transcriptEntry.text = entry.text;
}

function syncFuseBlastBtn() {
  const btn = document.getElementById('fuseBlastBtn');
  if (!btn) return;
  btn.classList.toggle('disabled', !_fuseAllSeen);
}

/* "让TA继续说" — 用户对当前这个人还没看够，再让TA接着发几条，
   内容要承接已经说过的话往下延伸，不能和前面重复。可以反复点。 */
async function continueCurrentFuseMember() {
  if (_fuseCursor < 0 || !_fuseOrder[_fuseCursor]) return;
  const member = _fuseOrder[_fuseCursor];
  const entry = _fuseEntries[_fuseEntries.length - 1];
  if (!entry || entry.member.id !== member.id) return; // 安全校验：当前entry必须就是这个人

  const continueBtn = document.getElementById('fuseContinueBtn');
  const nextBtn = document.getElementById('fuseNextBtn');
  continueBtn.classList.add('loading');
  document.getElementById('fuseContinueBtnText').textContent = '正在多说几句…';
  if (nextBtn) { nextBtn.style.pointerEvents = 'none'; nextBtn.style.opacity = '0.5'; }

  const stream = document.getElementById('fuseStream');
  const typingRow = document.createElement('div');
  typingRow.className = 'fuse-bubble fuse-bubble-cont';
  typingRow.innerHTML = `
    <div class="fuse-av fuse-av-spacer"></div>
    <div class="fuse-content"><div class="fuse-typing"><span></span><span></span><span></span></div></div>`;
  stream.appendChild(typingRow);
  stream.scrollTop = stream.scrollHeight;

  let lines = [];
  try {
    lines = await generateMemberFuseContinue(member, _activeTopic.question, entry.text);
  } catch(err) {
    lines = [];
  }

  typingRow.remove();

  if (!lines.length) {
    tbToast('TA好像没有更多想说的了');
  } else {
    lines.forEach(line => {
      const extraRow = document.createElement('div');
      extraRow.className = 'fuse-bubble fuse-bubble-cont';
      extraRow.innerHTML = `
        <div class="fuse-av fuse-av-spacer"></div>
        <div class="fuse-content">
          <div class="fuse-text-wrap">${escHtml(line)}</div>
        </div>`;
      stream.appendChild(extraRow);
      stream.scrollTop = stream.scrollHeight;
    });
    /* 合并进当前entry，让判定/惩罚阶段也能看到这些追加内容 */
    entry.text = entry.text + '\n' + lines.join('\n');
    const transcriptEntry = _topicTranscript[_topicTranscript.length - 1];
    if (transcriptEntry && transcriptEntry.member.id === member.id) {
      transcriptEntry.text = entry.text;
    }
  }

  continueBtn.classList.remove('loading');
  document.getElementById('fuseContinueBtnText').textContent = '让TA继续说';
  if (nextBtn) { nextBtn.style.pointerEvents = ''; nextBtn.style.opacity = ''; }
}

async function generateMemberFuseContinue(member, question, saidSoFar) {
  const brief       = buildMemberBrief(member);
  const castLine    = buildGroupCastLine(member.id);
  const relationCtx = buildRelationContext(member);
  const userRelCtx  = buildUserRelationContext(member);
  const voiceHint   = buildVoiceHint(member);

  const system = `你正在扮演群聊成员「${member.name}」，绝对不能让人感觉是AI在说话，更不能OOC。

【这个人是谁】
${brief}

【群里的其他成员】
${castLine || '暂无其他成员'}${relationCtx}${userRelCtx}${voiceHint}

【场景】
你刚才已经针对话题"${question}"说了这些话：
${saidSoFar}

现在群主还想再听你多说两句，你需要接着刚才的内容继续往下说——可以是补充新的理由、举新的例子、讲得更具体、或者情绪更进一步，但绝对不能重复刚才已经说过的内容，也不能说一些和刚才立场矛盾的话（除非你的人设就是善变/口是心非）。

【输出要求】
1. 发 2-4 条连续的群聊消息，每条不超过35字；
2. 语言要像普通人发微信群消息的口语，不要写成小说台词或书面化排比句；
3. 不要解释你在扮演角色，不要出现任何元信息。
只输出 JSON 数组，不要任何其他文字，不要 markdown 代码块，格式：
["消息1","消息2"]`;

  const prompt = `请以「${member.name}」的身份，接着刚才说的继续往下说，别重复。`;
  const raw = await callClaude(prompt, system, 400);
  const cleaned = raw.replace(/```json|```/g, '').trim();
  let arr;
  try { arr = JSON.parse(cleaned); } catch(e) {
    const m = cleaned.match(/\[[\s\S]*\]/);
    if (m) { try { arr = JSON.parse(m[0]); } catch(e2) {} }
  }
  if (!Array.isArray(arr)) {
    const fallbackSplit = raw.split(/\n+/).map(s => s.trim()).filter(Boolean);
    arr = fallbackSplit;
  }
  return arr.slice(0, 4).map(s => String(s).replace(/^["「『]|["」』]$/g, '').trim()).filter(Boolean);
}

function goToBlastFromFuse() {
  if (!_fuseAllSeen) {
    tbToast('还有人没发言呢，先点「下一个」看完所有人');
    return;
  }
  clearInterval(_fuseTimerHandle);
  finishFuseToResult();
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function startNextFuseRound() {
  document.getElementById('resultActions').style.display = 'none';
  document.getElementById('punishPanel').style.display = 'none';
  document.getElementById('appealPanel').style.display = 'none';
  document.getElementById('essayOverlay').classList.remove('show');
  resetJudgeMemberGrid();
  openStarterWheel();
}

async function resolveFuseQuestion(topic) {
  if (_roundNum === 1) return topic.angle;
  /* 后续轮次：把话题角度和上一轮的共识拼一句，让接龙有延续感 */
  const prevLine = _resultLinesByRound[_resultLinesByRound.length - 1];
  return prevLine ? `${topic.angle}（接上一轮：${prevLine}）` : topic.angle;
}

function updateFuseTimer() {
  const sec = Math.floor((Date.now() - _fuseStartTime) / 1000);
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  const el = document.getElementById('fuseTimer');
  if (el) el.textContent = `${m}:${s}`;
}

async function streamMemberFuseReply(member, question, prevEntry) {
  const stream = document.getElementById('fuseStream');

  const row = document.createElement('div');
  row.className = 'fuse-bubble';
  row.innerHTML = `
    <div class="fuse-av fuse-av-clickable" title="点头像让TA继续说" onclick="continueMemberFromStream('${escHtml(member.id)}')">${renderAvatar(member, 'fuse-av-inner')}</div>
    <div class="fuse-content">
      <div class="fuse-name">${escHtml(member.name)}</div>
      <div class="fuse-typing"><span></span><span></span><span></span></div>
    </div>`;
  stream.appendChild(row);
  stream.scrollTop = stream.scrollHeight;

  let lines = [];
  try {
    lines = await generateMemberFuseTake(member, question, prevEntry);
  } catch(err) {
    lines = buildFallbackTake(member, question);
  }
  if (!lines.length) lines = buildFallbackTake(member, question);

  /* 第一条复用最初的气泡，后续几条作为同一个人的连续多条消息追加展示，
     更接近真实聊天里"一个人连发好几条"的感觉，内容也更充分。 */
  const contentEl = row.querySelector('.fuse-content');
  contentEl.innerHTML = `
    <div class="fuse-name">${escHtml(member.name)}</div>
    <div class="fuse-text-wrap">${escHtml(lines[0])}</div>`;
  stream.scrollTop = stream.scrollHeight;

  const fullText = lines.join('\n');
  for (let i = 1; i < lines.length; i++) {
    await sleep(380);
    const extraRow = document.createElement('div');
    extraRow.className = 'fuse-bubble fuse-bubble-cont';
    extraRow.innerHTML = `
      <div class="fuse-av fuse-av-spacer"></div>
      <div class="fuse-content">
        <div class="fuse-text-wrap">${escHtml(lines[i])}</div>
      </div>`;
    stream.appendChild(extraRow);
    stream.scrollTop = stream.scrollHeight;
  }

  _fuseEntries.push({ member, text: fullText });
  _topicTranscript.push({ round: _roundNum, member, text: fullText });
  _currentFuseEntryRow = row; // 记录当前这个人最初的气泡行，continue时在其后追加
  await sleep(200);
}

function buildFallbackTake(member, question) {
  const pools = [
    [`这事吧我是真有想法的。`, `得看具体情况，不能一概而论。`, `换个角度想，可能没那么简单。`, `反正我自己是这么觉得的。`],
    [`我觉得「${question}」这种事见仁见智。`, `每个人的处境不一样。`, `没必要非要统一答案吧。`, `大家随便聊聊就好。`],
    [`说实话我对这个问题挺有感触的。`, `不过具体说起来有点复杂。`, `我支持大家各自的选择。`, `不必强求一致。`],
    [`这话题有点意思，值得好好聊聊。`, `我先抛个想法。`, `大家可以接着说说自己的看法。`, `挺好奇别人怎么想的。`],
  ];
  return pools[Math.floor(Math.random() * pools.length)];
}

async function generateMemberFuseTake(member, question, prevEntry) {
  const brief       = buildMemberBrief(member);
  const castLine    = buildGroupCastLine(member.id);
  const relationCtx = buildRelationContext(member);
  const userRelCtx  = buildUserRelationContext(member);
  const voiceHint   = buildVoiceHint(member);
  const userName    = userDisplayName();
  const userBrief   = buildUserBrief();

  const chainCtx = prevEntry
    ? `\n【接话对象】上一句是「${prevEntry.member.name}」刚说的：「${prevEntry.text}」。这条信息优先级最低，仅供参考，不是你这条发言的重点。你这条发言的重点排序是：①先说清楚你自己对这个话题的真实想法和理由；②如果合适，可以顺带跟群主「${userName}」搭句话、问句话、或者回应群主——毕竟是群主抛出来的话题，群主才是这场对话真正的对象；③最后才轮到要不要搭理「${prevEntry.member.name}」刚说的内容，可以完全不提TA，也可以就一两句话带过，绝不能把整条发言变成"点评/复述/吐槽TA说了什么"，那样会显得你没有自己的立场，只会看戏接话茬。`
    : `\n【场景】群主突然在群里抛出这个话题，你是这一轮第一个发言的人，要定下这轮讨论的调子。可以直接对着群主「${userName}」说，把TA当成这场对话真正在听你说话的人。`;

  const systemPrompt = `你正在扮演群聊成员「${member.name}」，绝对不能让人感觉是AI在说话，更不能写成和这个人设不符的、千人一面的客套话（OOC是大忌）。这是一个有多个性格各异成员的群聊互动场景，每个人说话的方式、立场、情绪都必须有明显区分度，绝不能写成"通用群友发言"。

【这个人是谁】
${brief}

【这场对话真正的对象】
这是群主「${userName}」开的话题，群主才是你说话时心里装着的那个人——你是在跟群主互动、想让群主看到你的态度，不是在单纯点评其他群友的发言。${userBrief ? `关于群主：${userBrief}` : ''}

【群里的其他成员】（你认识他们，对每个人的说话方式都不一样，但他们不是你这条发言的重点）
${castLine || '暂无其他成员'}${relationCtx}${userRelCtx}${voiceHint}
${chainCtx}

【内容要求——这一点是硬性的，不能违反】
1. 这条发言必须真正回应"${question}"这个话题本身——要让人能看出你对这件事的具体态度/立场/经历/理由，不能整条都在调侃、点评、起哄别人说了什么，那不叫参与讨论，叫看戏；
2. 可以举例子、可以讲一段自己的真实/虚构经历、可以列出你的理由，把"为什么这么想"说清楚，不要只丢一句结论就完事；
3. 优先级是：自己的观点 > 跟群主的互动 > 接其他群友的话茬。如果要接别人的话，必须先讲完自己的观点（可以再带一两句对群主说的话），最后才可选地捎带一两句回应/怼/调侃别人，篇幅不能超过整条发言的四分之一，不能反过来通篇都是在说别人；
4. 发 4-6 条连续的群聊消息（类似连发好几条小消息），内容要有信息量、有具体细节，不要写成几句空话的拼接；每条消息不超过35字；
5. 【人设里贯穿始终的核心关系/性格底色不能丢】如果"这个人是谁"里写了某种对待特定对象的固定态度（比如对某个人格外保护/宠溺/放心不下，或者对某件事有执念），哪怕这次的话题表面上跟那个对象/那件事没有直接关系，也要让这层底色自然地渗进你的举例、立场或语气里（哪怕只是顺嘴提一句、举个相关的例子），不能因为换了个话题就表现得像换了个人；但也不要为了硬塞这条而显得跑题，分寸自己把握。

【语言风格要求——避免"网文男主感"】
1. 这是普通人发微信群消息，不是小说台词，不要用书面化、押韵感强、排比句、"装腔作势耍帅"的语气，不要出现"那趁早""莫要""休得"这类文绉绉/装X的措辞，除非这个人设本来就是这种说话方式；
2. 多用口语化的词、不完整的短句、真实人会用的语气词（"啊""吧""呃""那个""怎么说呢"），可以有点啰嗦、有点重复、有点语无伦次，这才像活人随手打字，而不是精心设计的台词；
3. 不要每条消息都金句感很强、都像是在押韵或对仗，正常人发消息是想到哪说到哪，允许有的消息很短、很口水（比如"是这样的""嗯对""真的假的"）；
4. 完全符合你的人设、说话习惯和你跟接话对象/群主之间的关系分寸；
5. 不要解释你在扮演角色，不要出现任何元信息；
6. 可以带情绪、立场鲜明，但情绪要服务于"你对这个话题的真实态度"，不是为了吵架而吵架、为了调侃而调侃。
只输出 JSON 数组，每个元素是一条消息，不要任何其他文字，不要 markdown 代码块，格式：
["消息1","消息2","消息3","消息4"]`;

  const prompt = `话题：${question}\n请以「${member.name}」的身份，先说出你自己对这个话题的真实想法和理由，再视情况接别人的话，连续发几条群聊消息，把想法说充分、说具体。`;
  const raw = await callClaude(prompt, systemPrompt, 650);
  const cleaned = raw.replace(/```json|```/g, '').trim();
  let arr;
  try { arr = JSON.parse(cleaned); } catch(e) {
    const m = cleaned.match(/\[[\s\S]*\]/);
    if (m) { try { arr = JSON.parse(m[0]); } catch(e2) {} }
  }
  if (!Array.isArray(arr) || !arr.length) {
    /* AI 没有按数组格式返回时，退化为按行/句拆分，保证依然有多条内容 */
    const fallbackSplit = raw.split(/\n+/).map(s => s.trim()).filter(Boolean);
    arr = fallbackSplit.length > 1 ? fallbackSplit : [raw.trim()];
  }
  return arr.slice(0, 6).map(s => String(s).replace(/^["「『]|["」』]$/g, '').trim()).filter(Boolean);
}

let _fuseFinishing = false;
async function finishFuseToResult() {
  if (_fuseFinishing) return;
  _fuseFinishing = true;
  clearInterval(_fuseTimerHandle);

  if (_fuseEntries.length < _groupMembers.length) {
    const covered = new Set(_fuseEntries.map(e => e.member.id));
    _groupMembers.forEach(m => {
      if (!covered.has(m.id)) {
        const text = buildFallbackTake(m, _activeTopic.question).join('\n');
        _fuseEntries.push({ member: m, text });
        _topicTranscript.push({ round: _roundNum, member: m, text });
      }
    });
  }

  await generateResultLine();
  _fuseFinishing = false;
}

/* ----------------------------------------------------------------
   STAGE 5a — Result: condense this round into one consensus line
---------------------------------------------------------------- */
async function generateResultLine() {
  showStage('result');
  document.getElementById('headerEyebrow').textContent = 'GROUP · RESULT';
  document.getElementById('headerTitleText').innerHTML = '本轮战况 <span class="header-badge">RESULT</span>';

  document.getElementById('resultRoundNum').textContent = _roundNum;
  document.getElementById('resultLine').textContent = '正在浓缩成一句话…';
  document.getElementById('resultMemberCount').textContent = _fuseEntries.length;
  document.getElementById('resultSource').style.opacity = '0.6';
  document.getElementById('resultJudgeTitle').textContent = '这轮接龙里，谁的发言最该被炸？';

  resetJudgeMemberGrid();
  document.getElementById('punishPanel').style.display = 'none';
  document.getElementById('appealPanel').style.display = 'none';
  document.getElementById('resultActions').style.display = 'none';
  document.getElementById('resultActionsRow2').style.display = 'none';

  try {
    _resultLine = await aiCondenseConsensus();
  } catch(err) {
    _resultLine = buildFallbackConsensus();
  }
  _resultLinesByRound.push(_resultLine);
  document.getElementById('resultLine').textContent = _resultLine;
  document.getElementById('resultSource').style.opacity = '1';

  const blast = document.getElementById('resultBlast');
  blast.classList.remove('go');
  void blast.offsetWidth;
  blast.classList.add('go');

  renderJudgeMemberGrid();
}

function buildFallbackConsensus() {
  return '大家意见不太一致，但都觉得这事得自己拿主意。';
}

async function aiCondenseConsensus() {
  const lines = _fuseEntries.map(e => `${e.member.name}：${e.text}`).join('\n');
  const system = `你是一个擅长总结群聊的人。下面是群里针对某个话题，这一轮每个成员各自发表的看法。请把这些观点浓缩成一句话（20字以内，不超过30字），这句话要体现群里讨论后落地的共识、分歧点或最犀利的结论之一，要有态度、不要和稀泥。
只输出这一句话本身，不要加引号，不要加任何解释或前缀。`;
  const prompt = `话题：${_activeTopic.question}\n\n本轮群成员发言：\n${lines}\n\n请输出浓缩后的一句话共识。`;
  const reply = await callClaude(prompt, system, 120);
  return reply.replace(/^["「『]|["」』]$/g, '').trim();
}

/* ----------------------------------------------------------------
   STAGE 5b — Member judge grid: pick who gets blasted this round
---------------------------------------------------------------- */
function resetJudgeMemberGrid() {
  _chosenBlastMember = null;
  _chosenPunish = null;
  _multiSelectedIds = new Set();
  _blastQueue = [];
  _blastQueueIndex = 0;
  document.getElementById('judgeMemberGrid').innerHTML = '';
  document.getElementById('judgeMultiBar').style.display = 'flex';
  document.getElementById('judgeSkipRow').style.display = 'flex';
  document.getElementById('judgeConfirmRow').style.display = 'none';
  document.getElementById('blastQueueBar').style.display = 'none';
  const allBtn = document.getElementById('judgeAllBtn');
  if (allBtn) allBtn.classList.remove('active');
  const allBtnText = document.getElementById('judgeAllBtnText');
  if (allBtnText) allBtnText.textContent = '全员炸';
  const summaryPanel = document.getElementById('blastSummaryPanel');
  if (summaryPanel) summaryPanel.style.display = 'none';
}

function renderJudgeMemberGrid() {
  const grid = document.getElementById('judgeMemberGrid');
  grid.innerHTML = _fuseEntries.map(e => `
    <div class="judge-opt judge-opt-member" data-member-id="${escHtml(e.member.id)}" onclick="toggleBlastMember('${escHtml(e.member.id)}')">
      <div class="judge-check">✓</div>
      <div class="judge-icon judge-icon-av">${renderAvatar(e.member, 'judge-av-inner')}</div>
      <div class="judge-name">${escHtml(e.member.name)}</div>
      <div class="judge-desc">${escHtml(e.text)}</div>
    </div>`).join('');
}

function syncJudgeConfirmUI() {
  const n = _multiSelectedIds.size;
  const row = document.getElementById('judgeConfirmRow');
  const btn = document.getElementById('judgeConfirmBtn');
  const text = document.getElementById('judgeConfirmText');
  row.style.display = n > 0 ? 'block' : 'none';
  text.textContent = `确认引爆 ${n} 人`;
  btn.classList.toggle('disabled', n === 0);

  const allBtn = document.getElementById('judgeAllBtn');
  const allBtnText = document.getElementById('judgeAllBtnText');
  const isAll = n === _fuseEntries.length && n > 0;
  allBtn.classList.toggle('active', isAll);
  allBtnText.textContent = isAll ? '取消全选' : '全员炸';
}

function toggleBlastMember(memberId) {
  const el = document.querySelector(`.judge-opt-member[data-member-id="${CSS.escape(memberId)}"]`);
  if (_multiSelectedIds.has(memberId)) {
    _multiSelectedIds.delete(memberId);
    if (el) el.classList.remove('multi-selected');
  } else {
    _multiSelectedIds.add(memberId);
    if (el) el.classList.add('multi-selected');
  }
  syncJudgeConfirmUI();
}

function toggleBlastAll() {
  const allSelected = _multiSelectedIds.size === _fuseEntries.length && _fuseEntries.length > 0;
  if (allSelected) {
    _multiSelectedIds = new Set();
    document.querySelectorAll('.judge-opt-member').forEach(el => el.classList.remove('multi-selected'));
  } else {
    _multiSelectedIds = new Set(_fuseEntries.map(e => e.member.id));
    document.querySelectorAll('.judge-opt-member').forEach(el => el.classList.add('multi-selected'));
  }
  syncJudgeConfirmUI();
}

function confirmBlastSelection() {
  if (!_multiSelectedIds.size) return;
  _blastQueue = _fuseEntries.filter(e => _multiSelectedIds.has(e.member.id));
  _blastQueueIndex = 0;

  document.getElementById('judgeMultiBar').style.display = 'none';
  document.getElementById('judgeSkipRow').style.display = 'none';
  document.getElementById('judgeConfirmRow').style.display = 'none';
  document.querySelectorAll('.judge-opt-member').forEach(el => el.classList.add('dimmed'));

  if (_blastQueue.length > 1) {
    const bar = document.getElementById('blastQueueBar');
    bar.style.display = 'block';
  }
  processNextInBlastQueue();
}

/* 放过本轮：用户可以明确选择"这轮没人该被炸"，跳过整个判定/惩罚/申诉流程，
   直接进到"继续接龙 / 结束本话题"。之前没有这条路径，只能被迫选至少一个人。 */
function skipBlastThisRound() {
  document.getElementById('judgeMultiBar').style.display = 'none';
  document.getElementById('judgeSkipRow').style.display = 'none';
  document.getElementById('judgeConfirmRow').style.display = 'none';
  document.querySelectorAll('.judge-opt-member').forEach(el => el.classList.add('dimmed'));

  _blastQueue = [];
  _blastQueueIndex = 0;
  document.getElementById('blastQueueBar').style.display = 'none';
  document.getElementById('resultActions').style.display = 'flex';
  document.getElementById('resultActionsRow2').style.display = 'flex';
  tbToast('这轮放过了，没人被炸');
  renderBlastSummaryPanel();
}

function updateBlastQueueBar() {
  const bar = document.getElementById('blastQueueBar');
  const textEl = document.getElementById('blastQueueText');
  if (_blastQueue.length <= 1) { bar.style.display = 'none'; return; }
  bar.style.display = 'block';
  textEl.textContent = `正在处理 ${_blastQueueIndex + 1}/${_blastQueue.length} 个被炸的人`;
}

function processNextInBlastQueue() {
  if (_blastQueueIndex >= _blastQueue.length) {
    finishAllBlastsThisRound();
    return;
  }
  updateBlastQueueBar();
  const entry = _blastQueue[_blastQueueIndex];
  _chosenBlastMember = entry.member;
  _chosenPunish = null;
  tbToast(`「${entry.member.name}」被炸了，正在生成惩罚选项…`);
  loadPunishOptions(entry.member, entry.text);
}

function finishAllBlastsThisRound() {
  document.getElementById('blastQueueBar').style.display = 'none';
  document.getElementById('resultActions').style.display = 'flex';
  document.getElementById('resultActionsRow2').style.display = 'flex';
  tbToast(`本轮判定结束，共 ${_blastQueue.length} 人被炸`);
  renderBlastSummaryPanel();
}

/* 把本轮所有被炸的人和他们的惩罚内容列出来，点开还能看到当时生成的具体内容
   （作文稿纸 或 申诉对话），避免"炸完就没了、看不到生成内容"的感觉。 */
function renderBlastSummaryPanel() {
  const panel = document.getElementById('blastSummaryPanel');
  const list = document.getElementById('blastSummaryList');
  const roundLog = _topicBlastLog.filter(b => b.round === _roundNum);
  if (!roundLog.length) { panel.style.display = 'none'; list.innerHTML = ''; return; }

  list.innerHTML = roundLog.map((b, idx) => {
    const member = _groupMembers.find(m => m.id === b.memberId);
    const av = member ? renderAvatar(member, 'blast-summary-av-inner') : '';
    return `
    <div class="blast-summary-item" onclick="reopenBlastDetail(${idx})">
      <div class="blast-summary-av">${av}</div>
      <div class="blast-summary-body">
        <div class="blast-summary-name">${escHtml(b.memberName)}</div>
        <div class="blast-summary-punish">${escHtml(b.punish)}</div>
      </div>
      <div class="blast-summary-view">查看 ›</div>
    </div>`;
  }).join('');
  panel.style.display = 'block';
}

/* 点击汇总清单里的某一项，重新打开当时生成的内容（作文稿纸 / 申诉对话回放） */
function reopenBlastDetail(idx) {
  const roundLog = _topicBlastLog.filter(b => b.round === _roundNum);
  const entry = roundLog[idx];
  if (!entry) return;

  if (entry.essayHtml) {
    const titleEl = document.getElementById('essayModalTitle');
    titleEl.textContent = `${entry.memberName} 的「${entry.punish}」`;
    renderEssayInIframe(entry.essayHtml);
    _essayReopenMode = true;
    document.getElementById('essayOverlay').classList.add('show');
    return;
  }

  if (entry.appealEntries && entry.appealEntries.length) {
    const member = _groupMembers.find(m => m.id === entry.memberId);
    const userName = userDisplayName();
    document.getElementById('appealName').textContent = entry.memberName;
    document.getElementById('appealAv').innerHTML = member ? renderAvatar(member, 'appeal-av-inner') : '';
    const stream = document.getElementById('appealStream');
    stream.innerHTML = '';
    entry.appealEntries.forEach(e => {
      if (e.who === 'user') {
        appendAppealBubble('user', null, e.text, false);
      } else {
        appendAppealBubble('member', member, e.text, false);
      }
    });
    document.getElementById('appealInput').value = '';
    document.getElementById('appealVerdictRow').style.display = 'none';
    document.getElementById('appealCloseRowText').textContent = '关闭回放';
    _appealReopenMode = true;
    document.getElementById('appealPanel').style.display = 'block';
    return;
  }

  tbToast(`「${entry.memberName}」的惩罚：${entry.punish}`);
}

/* ----------------------------------------------------------------
   STAGE 5c — Punishment: AI generates 4 options, user picks one
---------------------------------------------------------------- */
const FALLBACK_PUNISH_TEMPLATES = [
  '罚连续三天早安问候群主，一句都不能少',
  '罚用本名写一段小作文公开认错，不许甩锅',
  '罚下一轮接龙必须先夸群主再说话',
  '罚写一条夸群主的彩虹屁，要超过30字还要押韵',
  '罚用文言文给群主道歉一段',
  '罚现编一句顺口溜自嘲，发到群里',
  '罚下一轮接龙只能用疑问句对群主说话',
  '罚用三个比喻句形容自己这次有多离谱，说给群主听',
  '罚给群主写一封简短的道歉信，态度要诚恳',
  '罚模仿群里另一个人的语气说一句话给大家看',
  '罚用群主的口吻夸自己被罚得很合理',
  '罚编一个小故事，主角是自己这次的发言事故',
  '罚连发三句不同语气的"对不起群主"',
  '罚把这次的发言改写成一句押韵的检讨',
  '罚用客服话术风格向群主道歉',
];

function buildFallbackPunishOptions(member) {
  const userName = userDisplayName();
  const pool = FALLBACK_PUNISH_TEMPLATES
    .map(t => t.replace('群主', userName))
    .filter(t => !_usedPunishLines.includes(t));
  const source = pool.length >= 4 ? pool : FALLBACK_PUNISH_TEMPLATES.map(t => t.replace('群主', userName));
  const shuffled = shuffleArray(source.slice());
  return shuffled.slice(0, 4);
}

async function loadPunishOptions(member, badLine) {
  const panel = document.getElementById('punishPanel');
  const targetEl = document.getElementById('punishTargetName');
  const gridEl = document.getElementById('punishGrid');
  targetEl.textContent = member.name;
  panel.style.display = 'block';
  gridEl.innerHTML = `<div class="punish-loading">正在想惩罚…</div>`;

  let options;
  try {
    options = await aiGeneratePunishOptions(member, badLine);
  } catch(err) {
    options = buildFallbackPunishOptions(member);
  }
  _punishOptions = options;
  renderPunishGrid(options);
}

async function aiGeneratePunishOptions(member, badLine) {
  const brief = buildMemberBrief(member);
  const userName = userDisplayName();
  const userBrief = buildUserBrief();

  /* 把历史已经出现过的惩罚都喂给AI，明确要求不能重复/不能换皮重复 */
  const historyPunishes = _topicBlastLog.map(b => b.punish).concat(_usedPunishLines);
  const avoidBlock = historyPunishes.length
    ? `\n这些惩罚本局已经出现过，这次必须想完全不同的角度，不能是同义改写或换汤不换药：\n${[...new Set(historyPunishes)].map(t => '- ' + t).join('\n')}`
    : '';

  const seedTag = Math.random().toString(36).slice(2, 8); // 防止同一prompt结构被缓存式复用

  const system = `你是一个擅长给群聊整活的人。群成员「${member.name}」这轮接龙说的话被群主「${userName}」判定为最该被炸的发言。请给TA想 4 条好笑、有梗、群聊感强但不过分恶意的惩罚。

【被罚的人】${brief}
【判罚的群主】${userBrief}

要求：
1. 每条惩罚 10-25 字，是一个具体可执行的小动作或小任务，不要抽象的话（比如不要写"反思自己"）；
2. 惩罚要结合被罚的人的人设来设计，同时要让这条惩罚显得"是冲着群主「${userName}」这个具体的人来的"——比如惩罚里可以指名道姓对群主做什么、说什么、回应什么，要让群主在这次惩罚里有参与感，而不是惩罚内容和群主毫无关系；
3. 【重要：可执行性边界】你只是一个文字AI，惩罚最终也是由AI扮演被罚的人用文字完成的，所以惩罚内容必须是"纯文字就能完成"的事——比如写一段话、编一个故事、模拟一段语气、打一段认错/吹捧/顺口溜文案、用某种特定文风说话、虚拟描述一个动作或场景。绝对不能要求"发自拍/发照片/发语音/发视频/截图/实际转账"这类AI无法真正执行的事，如果要涉及"发XX"，必须改写成"用文字生动描述/虚构出这条要发的内容"的形式；
4. 可以是"写一篇小作文/检讨/道歉信/吹捧群主的彩虹屁长文"这类需要TA现场创作大段文字内容的惩罚，也可以是简短的文字任务，但不能涉及人身攻击、隐私、money、违法或者真正伤害性的内容；
5. 4条之间风格要有明显区别，不要重复，也不要和历史惩罚撞车；
6. 每次生成都要有新意，不要总是想到差不多的几个套路。${avoidBlock}
（内部随机种子：${seedTag}，仅用于提醒你这是独立的一次生成，不要输出这个种子）
只输出 JSON 数组，不要任何其他文字，不要 markdown 代码块，格式：
["惩罚1","惩罚2","惩罚3","惩罚4"]`;
  const prompt = `被罚的人：${member.name}\nTA这轮说的话：${badLine}\n判罚的群主：${userName}`;
  const raw = await callClaude(prompt, system, 400);
  const cleaned = raw.replace(/```json|```/g, '').trim();
  let arr;
  try { arr = JSON.parse(cleaned); } catch(e) {
    const m = cleaned.match(/\[[\s\S]*\]/);
    if (m) arr = JSON.parse(m[0]);
    else throw new Error('AI 返回格式无法解析');
  }
  if (!Array.isArray(arr) || !arr.length) throw new Error('AI 未返回有效惩罚');
  return arr.slice(0, 4).map(s => String(s).slice(0, 40));
}

function renderPunishGrid(options) {
  const gridEl = document.getElementById('punishGrid');
  gridEl.innerHTML = options.map((text, idx) => `
    <div class="punish-opt" data-idx="${idx}" onclick="choosePunish(${idx})">
      <div class="punish-opt-num">0${idx+1}</div>
      <div class="punish-opt-text">${escHtml(text)}</div>
    </div>`).join('');
}

function choosePunish(idx) {
  if (_chosenPunish) return;
  const text = _punishOptions[idx];
  if (!text) return;
  _chosenPunish = text;
  _usedPunishLines.push(text);

  document.querySelectorAll('.punish-opt').forEach(el => {
    if (Number(el.dataset.idx) === idx) el.classList.add('chosen');
    else el.classList.add('dimmed');
  });

  runPunishBlastAnimation(_chosenBlastMember, text);
}

function runPunishBlastAnimation(member, punishText) {
  document.getElementById('pbName').textContent = member.name;
  document.getElementById('pbText').textContent = punishText;

  const overlay = document.getElementById('punishBlastOverlay');
  overlay.classList.add('show');

  setTimeout(() => {
    overlay.classList.remove('show');
    presentPunishment(member, punishText);
  }, 1500);
}

/* 修复：之前这里一上来就把惩罚写进永久黑历史记录、扣了张力值，
   申诉是在这之后才发生的——也就是说不管TA申诉得多有道理，
   结果都已经定了，申诉只是摆设，说服你也没有意义。
   现在改成：这里只是"展示"惩罚、把它标记为待定（pending），
   真正写入黑历史 / 计入张力的动作，挪到申诉结束之后，
   由 commitPendingPunishment() 或 revokePendingPunishment() 决定。 */
function presentPunishment(member, punishText) {
  _pendingPunish = { member, punishText, resultLine: _resultLine, round: _roundNum };

  tbToast(`「${member.name}」被判了「${punishText}」，TA可能会申诉，申诉成立的话这次就不算数`);

  document.getElementById('punishPanel').style.display = 'none';

  if (looksLikeEssayPunish(punishText)) {
    runEssayPunishment(member, punishText);
  } else {
    startAppeal(member, punishText);
  }
}

/* 申诉成立：撤销这次判定，不写入黑历史，不扣/加张力，TA本轮当作没被炸过 */
function revokePendingPunishment() {
  if (!_pendingPunish) { advanceBlastQueue(); return; }
  const { member } = _pendingPunish;
  tbToast(`申诉成立，「${member.name}」这次被放过了`);
  _pendingPunish = null;
  document.getElementById('appealPanel').style.display = 'none';
  document.getElementById('essayOverlay').classList.remove('show');
  advanceBlastQueue();
}

/* 申诉不成立 / 用户坚持判定：这时候才真正写入黑历史、扣张力 */
function commitPendingPunishment() {
  if (!_pendingPunish) { advanceBlastQueue(); return; }
  const { member, punishText, round, resultLine, essayText, essayHtml } = _pendingPunish;

  _topicBlastLog.push({
    round,
    memberId: member.id,
    memberName: member.name,
    line: resultLine,
    punish: punishText,
    appealEntries: _appealEntries.slice(),
    essayText,
    essayHtml,
  });

  applyTensionForBlast();
  saveHistoryEntry();
  tbToast(`「${member.name}」维持原判，黑历史 +1`);

  _pendingPunish = null;
  advanceBlastQueue();
}

/* ----------------------------------------------------------------
   "写小作文"类惩罚 — 先让AI按人设写出作文内容，
   再让AI自由发挥设计一份专属稿纸/信纸的 HTML+CSS，
   最后把两者拼合，放进沙箱 iframe 里安全展示。
---------------------------------------------------------------- */
async function runEssayPunishment(member, punishText) {
  const overlay = document.getElementById('essayOverlay');
  const body = document.getElementById('essayModalBody');
  const titleEl = document.getElementById('essayModalTitle');
  titleEl.textContent = `${member.name} 的「${punishText}」`;
  body.innerHTML = `
    <div class="essay-loading">
      <div class="essay-loading-orb"></div>
      <div id="essayLoadingText">正在按TA的人设写内容…</div>
    </div>`;
  overlay.classList.add('show');

  let essayText;
  try {
    essayText = await aiGenerateEssayContent(member, punishText);
  } catch(err) {
    essayText = buildFallbackEssay(member, punishText);
  }

  const loadingTextEl = document.getElementById('essayLoadingText');
  if (loadingTextEl) loadingTextEl.textContent = '内容写好了，正在设计专属稿纸样式…';

  let paperHtml;
  try {
    paperHtml = await aiGenerateEssayPaperHtml(member, punishText, essayText);
  } catch(err) {
    paperHtml = buildFallbackPaperHtml(member, punishText, essayText);
  }

  /* 修复：之前这里假设黑历史记录已经写进 _topicBlastLog 了，直接回填essay内容；
     现在惩罚要等申诉结束才会真正写进log，所以先把生成好的内容存在
     _pendingPunish 上，commitPendingPunishment 提交时再一起带过去。 */
  if (_pendingPunish && _pendingPunish.member.id === member.id && _pendingPunish.punishText === punishText) {
    _pendingPunish.essayText = essayText;
    _pendingPunish.essayHtml = paperHtml;
  }

  renderEssayInIframe(paperHtml);
}

async function aiGenerateEssayContent(member, punishText) {
  const brief       = buildMemberBrief(member);
  const relationCtx = buildRelationContext(member);
  const userRelCtx  = buildUserRelationContext(member);
  const voiceHint   = buildVoiceHint(member);
  const userName    = userDisplayName();
  const userBrief   = buildUserBrief();

  const system = `你正在扮演群聊成员「${member.name}」，绝对不能OOC，更不能写成一份通用、客套、AI腔的检讨/作文。

【这个人是谁】
${brief}${relationCtx}${userRelCtx}${voiceHint}

【判罚的群主】「${userName}」，${userBrief}

【场景】
你这轮接龙发言被群主「${userName}」判定最差，被罚的内容是："${punishText}"。现在你必须老老实实写出这篇文字内容交差。

【写作要求】
1. 内容必须是这个具体的人会写出来的东西——遣词造句、认错的态度（可能是嘴硬认错、可能是阴阳怪气地认错、可能是真心实意、可能是夹带私货反过来内涵别人，取决于性格）都要贴合人设，不能写成一份放谁身上都通用的检讨模板；
2. 内容要明确针对群主「${userName}」这个具体的人来写——结合你和TA的关系分寸，直接称呼TA、对TA表态，不能写成一篇泛泛而谈、换个名字也能用的通用文字；
3. 字数 80-180 字之间，分 2-4 个自然段；
4. 要提到这次被炸的话题、被炸的理由，让内容显得是"真的针对这件事写的"，而不是泛泛而谈；
5. 不要出现任何AI/扮演/系统提示相关的元信息，只输出正文内容本身。`;
  const prompt = `请以「${member.name}」的身份，写出这篇"${punishText}"的完整文字内容，对象是群主「${userName}」。`;
  const reply = await callClaude(prompt, system, 500);
  return reply.trim();
}

function buildFallbackEssay(member, punishText) {
  return `我是${member.name}，这次接龙我说的话确实欠考虑，被炸也说不出什么反驳的理由。\n\n关于"${punishText}"，我认了，下次说话之前会再想想分寸，别让自己又变成被点名的那一个。\n\n这篇就当是个交代，态度先摆在这里。`;
}

async function aiGenerateEssayPaperHtml(member, punishText, essayText) {
  const seedTag = Math.random().toString(36).slice(2, 10);
  const system = `你是一个非常有创意的网页视觉设计师，现在要为一份"惩罚作文/检讨信"设计一份独一无二的展示稿纸。

【设计要求——完全自由发挥，但每次都要不一样】
1. 输出一个完整、独立的 HTML 片段（可以包含内联 <style>），不需要 <html>/<head>/<body> 外壳，直接是稿纸本体的 HTML+CSS；
2. 视觉风格请你自己创意决定（可以是复古方格作文纸、横线信纸、便签纸、卷宗档案风、手写信风格、撕边纸张、打字机风格等等，自行发挥，不要每次都用同一种），但要有质感、有设计感，不要做成普通网页表单的样子；
3. 必须把作文标题（可以自拟一个有意思的标题）、作者署名"${member.name}"、正文内容完整呈现在稿纸上，正文请保留原有的分段；
4. 整体宽度建议在 320-340px 左右（会被嵌入一个手机宽度的弹窗里），允许内容撑高，纵向可以滚动；
5. 颜色、字体、装饰元素（格子线/信纸横线/邮票/印章/胶带/折痕阴影等）都可以自由组合，但要保证文字清晰可读，不要让装饰盖住文字；
6. 不要使用任何外部网络资源（不要 <img src="http...">、不要外链字体/CSS/JS），所有视觉效果用纯CSS实现；
7. 不要输出任何解释、注释说明或 markdown 代码块标记，只输出这一段 HTML 本身。
（设计种子：${seedTag}，每次都要给出明显不同的设计方案，不要重复用过的风格）`;
  const prompt = `请为这篇惩罚作文设计稿纸并嵌入内容：

作者：${member.name}
惩罚类型：${punishText}
正文内容：
${essayText}`;
  const raw = await callClaude(prompt, system, 1800);
  return sanitizeEssayHtml(raw);
}

/* 简单清洗AI返回的HTML：去掉markdown围栏、剥离<script>/事件属性/外链等潜在风险，
   即便后面用沙箱iframe渲染，也做一层基本防护 */
function sanitizeEssayHtml(raw) {
  let html = raw.replace(/```html|```/gi, '').trim();
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  html = html.replace(/\son\w+="[^"]*"/gi, '').replace(/\son\w+='[^']*'/gi, '');
  html = html.replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '');
  html = html.replace(/(href|src)\s*=\s*["']https?:\/\/[^"']*["']/gi, '$1="#"');
  return html;
}

function buildFallbackPaperHtml(member, punishText, essayText) {
  const paras = essayText.split(/\n+/).filter(Boolean)
    .map(p => `<p style="margin:0 0 12px;">${escHtml(p)}</p>`).join('');
  return `
  <div style="font-family:'Syne',sans-serif;background:#fbf8f1;padding:28px 22px;min-height:380px;
    background-image:repeating-linear-gradient(180deg, transparent, transparent 27px, #e4ddc8 28px);
    box-shadow:inset 0 0 0 1px #e9e3d2;">
    <div style="font-size:9px;letter-spacing:2px;color:#a8987a;font-family:'DM Mono',monospace;margin-bottom:10px;">检讨小作文 · 黑历史存档</div>
    <div style="font-size:16px;font-weight:700;color:#3a3326;margin-bottom:16px;">${escHtml(punishText)}</div>
    <div style="font-size:13px;line-height:1.9;color:#4a4334;">${paras}</div>
    <div style="margin-top:18px;text-align:right;font-size:12px;color:#8a7d5e;">—— ${escHtml(member.name)}</div>
  </div>`;
}

function renderEssayInIframe(innerHtml) {
  const body = document.getElementById('essayModalBody');
  body.innerHTML = '';
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-scripts'); // 仅允许执行内部高度上报脚本，不给同源/表单/弹窗权限，无法访问父页面或外部资源
  iframe.setAttribute('referrerpolicy', 'no-referrer');
  iframe.style.height = '380px';

  /* 用 srcdoc 直接设置内容，避免 contentWindow.document.write 在
     sandbox（无 allow-same-origin）下被当作跨域访问而抛 SecurityError。
     高度自适应改用 postMessage 上报，同样不需要跨域读取 iframe 内部 DOM。 */
  const fullDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;} html,body{margin:0;padding:0;}
  </style></head><body>${innerHtml}
  <script>
    function reportHeight(){
      try {
        var h = document.body.scrollHeight;
        parent.postMessage({ __essayPaperHeight: h }, '*');
      } catch(e) {}
    }
    window.addEventListener('load', reportHeight);
    setTimeout(reportHeight, 80);
    setTimeout(reportHeight, 400);
    if (window.ResizeObserver) {
      new ResizeObserver(reportHeight).observe(document.body);
    }
  </script>
  </body></html>`;

  iframe.srcdoc = fullDoc;
  body.appendChild(iframe);
}

/* 监听作文稿纸 iframe 上报的高度，自适应弹窗内容高度 */
window.addEventListener('message', (e) => {
  if (e.data && typeof e.data.__essayPaperHeight === 'number') {
    const body = document.getElementById('essayModalBody');
    const iframe = body && body.querySelector('iframe');
    if (iframe) iframe.style.height = Math.max(380, e.data.__essayPaperHeight + 20) + 'px';
  }
});

function closeEssayModal() {
  document.getElementById('essayOverlay').classList.remove('show');
  if (_essayReopenMode) { _essayReopenMode = false; return; }
  const member = _blastQueue[_blastQueueIndex] ? _blastQueue[_blastQueueIndex].member : _chosenBlastMember;
  const punishText = _chosenPunish;
  /* 作文展示完，仍然走申诉流程，让TA有机会为这篇作文/这次惩罚argue */
  startAppeal(member, punishText);
}

/* ----------------------------------------------------------------
   队列推进：appeal结束后，进入队列里的下一个人
---------------------------------------------------------------- */
function advanceBlastQueue() {
  document.getElementById('appealPanel').style.display = 'none';
  _blastQueueIndex += 1;
  processNextInBlastQueue();
}

/* ----------------------------------------------------------------
   STAGE 5d — Appeal: the blasted member pushes back, user can reply
---------------------------------------------------------------- */
function startAppeal(member, punishText) {
  _appealEntries = [];
  _usedReplyDrafts = [];
  _appealRetryCount = 0;

  document.getElementById('appealName').textContent = member.name;
  document.getElementById('appealAv').innerHTML = renderAvatar(member, 'appeal-av-inner');
  document.getElementById('appealStream').innerHTML = '';
  document.getElementById('appealInput').value = '';
  document.getElementById('appealPanel').style.display = 'block';
  document.getElementById('appealVerdictRow').style.display = 'flex';
  document.getElementById('appealCloseRowText').textContent =
    (_blastQueueIndex < _blastQueue.length - 1) ? '维持原判，处理下一个' : '维持原判，继续';

  appendAppealBubble('member', member, '正在打字…', true);

  generateAppealOpening(member, punishText).then(lines => {
    renderAppealLines(member, lines);
  }).catch(() => {
    const fallback = [pickAppealFallback()];
    renderAppealLines(member, fallback);
  });
}

/* 把typing占位替换成第一条消息，剩下的几条作为同一个人连发的后续气泡追加 */
function renderAppealLines(member, lines) {
  if (!lines || !lines.length) lines = [pickAppealFallback()];
  updateLastAppealBubble(lines[0]);
  _appealEntries.push({ who: 'member', member, text: lines[0] });
  for (let i = 1; i < lines.length; i++) {
    appendAppealBubble('member', member, lines[i], false);
    _appealEntries.push({ who: 'member', member, text: lines[i] });
  }
}

async function generateAppealOpening(member, punishText) {
  const brief       = buildMemberBrief(member);
  const relationCtx = buildRelationContext(member);
  const userRelCtx  = buildUserRelationContext(member);
  const voiceHint   = buildVoiceHint(member);
  const userName    = userDisplayName();

  const system = `你正在扮演群聊成员「${member.name}」，绝对不能让人感觉是AI在说话，更不能OOC，也绝不能因为"礼貌"或"配合"而显得敷衍、高冷、一句带过。

【这个人是谁】
${brief}${relationCtx}${userRelCtx}${voiceHint}

【场景】
你这轮接龙的发言被群主「${userName}」判定为最差，还给你安排了一个惩罚——"${punishText}"。你不太服这个判定，想跟群主argue两句。

【态度要求——这一点最重要】
1. 你的态度尺度必须由你和群主的实际关系（见上面【群主信息/关系】部分）决定，不能脱离关系背景去演一个"对谁都很冲"的通用刺头角色。关系亲近随便、平辈打闹，可以怼得欢、玩笑感重；如果你对群主本来是尊敬、客气、有点怕、或者单方面仰慕这类关系，就应该是撒娇、讨好式抱怨、小声嘀咕、阴阳怪气地认怂这种分寸，而不是正面顶撞、教训群主、或者把群主当对立面/仇人来怼——这种"不分关系一律开怼"才是真正的OOC；
2. 你是真的觉得委屈/不忿/想为自己辩护，要有真实的情绪和具体理由，不能说一句空泛的话就完了，但情绪表达方式要服从第1条的关系分寸；
3. 根据你的人设独立思考一个具体的反驳角度——可以是质疑判定标准本身、可以是甩锅给别人、可以是指出别人说得更过分、可以是撒娇卖惨、可以是讲歪理但讲得理直气壮，必须结合你的性格和关系分寸来选；
4. 绝对不能是"哦好的""行吧"这种没有态度的敷衍话，但也不能无差别地凶/教训群主——除非你的人设和你跟群主的关系真的支持这种强硬态度；
5. 这只是申诉的开场，后面群主会继续跟你来回argue，所以话不要说死说完，留有继续聊下去的空间；
6. 语言要像普通人发微信吵架/撒娇/嘀咕时的口语，不要写成小说台词或书面化排比句，不要用"莫要""休得""那趁早"这类装腔作势的措辞（除非人设本身就这样说话），可以有点语无伦次、可以重复用词，这才像真人在打字。

【输出要求】
发 1-3 条连续的群聊消息（像真人连发好几条小消息那样），每条不超过35字，不要把所有内容硬塞进一条长消息里。
只输出 JSON 数组，不要任何其他文字，不要 markdown 代码块，格式：
["消息1","消息2"]`;
  const prompt = `请以「${member.name}」的身份，对这次判定和惩罚回应群主，态度要符合你和群主的关系，别说敷衍话也别无端发飙。`;
  const raw = await callClaude(prompt, system, 260);
  return parseAppealJsonLines(raw);
}

function parseAppealJsonLines(raw) {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  let arr;
  try { arr = JSON.parse(cleaned); } catch(e) {
    const m = cleaned.match(/\[[\s\S]*\]/);
    if (m) { try { arr = JSON.parse(m[0]); } catch(e2) {} }
  }
  if (!Array.isArray(arr) || !arr.length) {
    const fallbackSplit = raw.split(/\n+/).map(s => s.trim()).filter(Boolean);
    arr = fallbackSplit.length ? fallbackSplit : [raw.trim()];
  }
  return arr.slice(0, 3).map(s => String(s).replace(/^["「『]|["」』]$/g, '').trim()).filter(Boolean);
}

const APPEAL_OPENING_FALLBACKS = [
  '凭什么是我？我这话怎么就该被炸了，你倒是说说理由。',
  '我不服，刚才{others}说得比我离谱多了，凭什么单挑我。',
  '这判定根本不公平，我就是说了句实话而已。',
  '惩罚我可以，但这事我没错，你听我解释。',
  '不是我矫情，这次真的是冤枉我了。',
];
function pickAppealFallback() {
  _appealRetryCount += 1;
  const others = _groupMembers.filter(m => !_chosenBlastMember || m.id !== _chosenBlastMember.id).map(m => m.name)[0] || '别人';
  const idx = (_appealRetryCount - 1) % APPEAL_OPENING_FALLBACKS.length;
  return APPEAL_OPENING_FALLBACKS[idx].replace('{others}', others);
}

function appendAppealBubble(who, member, text, isTyping) {
  const stream = document.getElementById('appealStream');
  const row = document.createElement('div');
  row.className = 'appeal-bubble ' + (who === 'user' ? 'appeal-bubble-user' : 'appeal-bubble-member');
  if (who === 'user') {
    row.innerHTML = `<div class="appeal-msg appeal-msg-user">${escHtml(text)}</div>`;
  } else {
    row.innerHTML = isTyping
      ? `<div class="appeal-av-sm">${renderAvatar(member, 'appeal-av-sm-inner')}</div><div class="appeal-typing"><span></span><span></span><span></span></div>`
      : `<div class="appeal-av-sm">${renderAvatar(member, 'appeal-av-sm-inner')}</div><div class="appeal-msg appeal-msg-member">${escHtml(text)}</div>`;
  }
  stream.appendChild(row);
  stream.scrollTop = stream.scrollHeight;
  return row;
}

function updateLastAppealBubble(text) {
  const stream = document.getElementById('appealStream');
  const row = stream.lastElementChild;
  if (!row) return;
  const member = _chosenBlastMember;
  row.innerHTML = `<div class="appeal-av-sm">${renderAvatar(member, 'appeal-av-sm-inner')}</div><div class="appeal-msg appeal-msg-member">${escHtml(text)}</div>`;
  stream.scrollTop = stream.scrollHeight;
}

function onAppealKeydown(e) {
  if (e.key === 'Enter') sendAppealReply();
}

async function sendAppealReply() {
  const inputEl = document.getElementById('appealInput');
  const text = (inputEl.value || '').trim();
  if (!text) return;
  inputEl.value = '';
  appendAppealBubble('user', null, text, false);
  _appealEntries.push({ who: 'user', text });

  const member = _chosenBlastMember;
  appendAppealBubble('member', member, '正在打字…', true);
  try {
    const lines = await generateAppealFollowup(member, text);
    renderAppealLines(member, lines);
  } catch(err) {
    const fallback = [pickAppealFollowupFallback()];
    renderAppealLines(member, fallback);
  }
}

async function generateAppealFollowup(member, userText) {
  const brief       = buildMemberBrief(member);
  const relationCtx = buildRelationContext(member);
  const userRelCtx  = buildUserRelationContext(member);
  const voiceHint   = buildVoiceHint(member);
  const userName    = userDisplayName();
  const userBrief   = buildUserBrief();

  const history = _appealEntries.map(e =>
    e.who === 'user' ? `${userName}：${e.text}` : `${e.member.name}：${e.text}`
  ).join('\n');

  const system = `你正在扮演群聊成员「${member.name}」，正在和群主「${userName}」就刚才的判定/惩罚来回argue，绝对不能OOC、不能突然变成讲道理的AI腔。

【这个人是谁】
${brief}${relationCtx}${userRelCtx}${voiceHint}

【群主信息】${userBrief}

【到目前为止的对话】
${history}

【回应要求】
1. 态度尺度必须服从你和群主的实际关系——关系好/平辈可以怼得欢，但如果你对群主本该是尊敬、依赖、有点怕、仰慕这类关系，就不能正面教训/对立攻击群主，应该是撒娇、嘀咕、阴阳怪气式服软等更贴合关系的方式，绝不能演成把群主当仇人怼的通用刺头；
2. 根据你的人设独立判断该怎么接这句话——可以继续辩解/可以反问/可以举新理由/可以情绪起伏/也可以在确实说不过或关系上本该顺从时让步，但具体怎么接必须由你的性格+关系决定，不能是默认走向"硬刚到底"；
3. 不要用空洞的客套话敷衍（比如不要说"好的""算了""你说得对"这种没有信息量的话），要带着具体内容回应对方刚才说的点；
4. 语言要像普通人聊天/argue/撒娇时的口语，不要写成小说台词或书面化的排比句，别用"莫要""休得"这类装腔作势的措辞（除非人设本身就这样说话）；
5. 保持你的立场和说话方式的一致性。

【输出要求】
发 1-2 条连续的群聊消息，每条不超过35字。
只输出 JSON 数组，不要任何其他文字，不要 markdown 代码块，格式：
["消息1","消息2"]`;
  const prompt = `继续这段对话，回应群主刚才说的：「${userText}」`;
  const raw = await callClaude(prompt, system, 220);
  return parseAppealJsonLines(raw);
}

const APPEAL_FOLLOWUP_FALLBACKS = [
  '我话还没说完呢，你听我说完再下结论嘛。',
  '行吧……这次算你说得有道理，下次我注意点。',
  '哦是吗，那你倒是评评理，到底谁更过分。',
  '随你怎么说吧，反正我心里有数。',
  '哎呀就这么一次，别老盯着我一个人说嘛。',
];
function pickAppealFollowupFallback() {
  _appealRetryCount += 1;
  const idx = (_appealRetryCount - 1) % APPEAL_FOLLOWUP_FALLBACKS.length;
  return APPEAL_FOLLOWUP_FALLBACKS[idx];
}


function closeAppealPanel() {
  if (_appealReopenMode) {
    _appealReopenMode = false;
    document.getElementById('appealPanel').style.display = 'none';
    document.getElementById('appealCloseRowText').textContent = '结束申诉，继续';
    return;
  }
  /* 用户没有点"申诉成立/撤销"，说明判定维持原判——这时才真正提交进黑历史 */
  commitPendingPunishment();
}

/* ----------------------------------------------------------------
   "帮我回复" — generate 3 reply drafts in user's persona voice,
   click one to send immediately into the appeal thread
---------------------------------------------------------------- */
function openReplyAssist() {
  visualizeReplyAssist();
}

async function visualizeReplyAssist() {
  tbToast('正在生成三种回复…');
  let drafts;
  try {
    drafts = await aiGenerateReplyDrafts();
  } catch(err) {
    drafts = buildFallbackReplyDrafts();
  }
  showReplyAssistSheet(drafts);
}

function buildFallbackReplyDrafts() {
  return [
    '行了行了，这次就算你过关。',
    '你倒是会找理由，下次可没这么容易。',
    '哎呀别闹了，我也是随口判的啦。',
  ];
}

async function aiGenerateReplyDrafts() {
  const member = _chosenBlastMember;
  const userName  = userDisplayName();
  const userBrief = buildUserBrief();
  const history = _appealEntries.map(e =>
    e.who === 'user' ? `${userName}：${e.text}` : `${e.member.name}：${e.text}`
  ).join('\n');
  const usedLine = _usedReplyDrafts.length
    ? `\n以下说法已经生成过，这次必须换成完全不同的角度和措辞，不能是同义改写：\n${_usedReplyDrafts.map(t => '- ' + t).join('\n')}`
    : '';

  const system = `你在帮一个真实的群主「${userName}」想怎么回复群成员「${member.name}」（${userBrief}）。
当前场景：「${member.name}」因为接龙发言被判定最差并被惩罚，正在跟群主argue/申诉，下面是目前的对话记录。
请给出 3 条群主可以直接发出去的回复草稿，三条之间语气/视角要有明显区别（比如：强硬坚持判定 / 半开玩笑地敷衍 / 退让和解），但都要简短自然，像真实聊天，不超过30字，不要加引号。${usedLine}
只输出 JSON 数组，不要任何其他文字，不要 markdown 代码块，格式：
["回复1","回复2","回复3"]`;
  const prompt = `对话记录：\n${history}\n\n请给群主生成3条不同类型的回复草稿。`;
  const raw = await callClaude(prompt, system, 360);
  const cleaned = raw.replace(/```json|```/g, '').trim();
  let arr;
  try { arr = JSON.parse(cleaned); } catch(e) {
    const m = cleaned.match(/\[[\s\S]*\]/);
    if (m) arr = JSON.parse(m[0]);
    else throw new Error('AI 返回格式无法解析');
  }
  if (!Array.isArray(arr) || !arr.length) throw new Error('AI 未返回有效回复');
  return arr.slice(0, 3).map(s => String(s).replace(/^["「『]|["」』]$/g, '').trim());
}

function showReplyAssistSheet(drafts) {
  _usedReplyDrafts.push(...drafts);
  const container = document.getElementById('replyAssistList');
  container.innerHTML = drafts.map((text, idx) => `
    <div class="reply-draft-opt" onclick="pickReplyDraft(${idx})">
      <div class="reply-draft-text">${escHtml(text)}</div>
      <div class="reply-draft-arrow">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>`).join('');
  container.dataset.drafts = JSON.stringify(drafts);
  document.getElementById('replyAssistOverlay').classList.add('open');
  document.getElementById('replyAssistSheet').classList.add('open');
}

function closeReplyAssistSheet() {
  document.getElementById('replyAssistOverlay').classList.remove('open');
  document.getElementById('replyAssistSheet').classList.remove('open');
}

async function rerollReplyDrafts() {
  const btn = document.getElementById('replyAssistReroll');
  if (btn) btn.classList.add('spinning');
  let drafts;
  try {
    drafts = await aiGenerateReplyDrafts();
  } catch(err) {
    drafts = buildFallbackReplyDrafts();
  }
  if (btn) btn.classList.remove('spinning');
  showReplyAssistSheet(drafts);
}

function pickReplyDraft(idx) {
  const container = document.getElementById('replyAssistList');
  let drafts = [];
  try { drafts = JSON.parse(container.dataset.drafts || '[]'); } catch(e) {}
  const text = drafts[idx];
  if (!text) return;
  closeReplyAssistSheet();

  /* 直接发出，不需要二次确认 */
  appendAppealBubble('user', null, text, false);
  _appealEntries.push({ who: 'user', text });

  const member = _chosenBlastMember;
  appendAppealBubble('member', member, '正在打字…', true);
  generateAppealFollowup(member, text).then(lines => {
    renderAppealLines(member, lines);
  }).catch(() => {
    const fallback = [pickAppealFollowupFallback()];
    renderAppealLines(member, fallback);
  });
}

/* ----------------------------------------------------------------
   Topic-level controls: end topic / continue round
---------------------------------------------------------------- */
function endTopicToInput() {
  /* 把整个话题的完整记录存进历史（聚合本话题所有轮次和黑历史） */
  saveTopicHistoryEntry();
  const inputEl = document.getElementById('topicInput');
  if (inputEl) { inputEl.value = ''; document.getElementById('topicCount').textContent = '16'; }
  _activeTopic = null;
  _fuseEntries = [];
  _topicTranscript = [];
  _topicBlastLog = [];
  _roundNum = 0;
  _multiSelectedIds = new Set();
  _blastQueue = [];
  _blastQueueIndex = 0;
  showStage('input');
  setHeaderForInput();
}

function applyTensionForBlast() {
  /* 每次有真正维持原判的惩罚被提交，张力值上升；
     用户放过整轮、或申诉成立被撤销的惩罚，都不会走到这里，张力不受影响 */
  _tension = Math.max(0, Math.min(100, _tension + 12));
  _detonateStreak += 1;
  saveTensionToStorage();
  renderTensionBar();
}

function renderTensionBar() {
  const fillEl = document.getElementById('tensionFill');
  const numEl  = document.getElementById('tensionNum');
  const streakEl = document.getElementById('tensionStreak');
  if (fillEl) fillEl.style.width = _tension + '%';
  if (numEl)  numEl.textContent = _tension;
  if (streakEl) streakEl.textContent = `连续引爆 ${_detonateStreak}`;
}

function saveTensionToStorage() {
  try {
    localStorage.setItem(getStorageKey('tension'), String(_tension));
    localStorage.setItem(getStorageKey('streak'), String(_detonateStreak));
  } catch(e) {}
}

function loadTensionFromStorage() {
  try {
    _tension = parseInt(localStorage.getItem(getStorageKey('tension')) || '0', 10) || 0;
    _detonateStreak = parseInt(localStorage.getItem(getStorageKey('streak')) || '0', 10) || 0;
  } catch(e) { _tension = 0; _detonateStreak = 0; }
}

/* ----------------------------------------------------------------
   History (localStorage)
---------------------------------------------------------------- */
function getStorageKey(suffix) {
  const gid = localStorage.getItem('luna_current_group_id') || 'default';
  return `luna_tb_${gid}_${suffix}`;
}

/* 单轮记录（保留兼容：每轮判定后也写一条，方便在历史里看到逐轮黑历史） */
function saveHistoryEntry() {
  try {
    const last = _topicBlastLog[_topicBlastLog.length - 1];
    if (!last) return;
    const raw = localStorage.getItem(getStorageKey('history'));
    const list = raw ? JSON.parse(raw) : [];
    list.unshift({
      topic: _activeTopic.angle,
      round: last.round,
      line: last.line,
      blastedName: last.memberName,
      punish: last.punish,
      time: Date.now(),
      transcript: _fuseEntries.map(e => ({ name: e.member.name, text: e.text })),
    });
    localStorage.setItem(getStorageKey('history'), JSON.stringify(list.slice(0, 80)));
  } catch(e) { console.warn('saveHistoryEntry failed', e); }
}

/* 话题级汇总记录（点"结束本话题"时写入，包含本话题所有轮次的黑历史） */
function saveTopicHistoryEntry() {
  if (!_activeTopic || !_topicBlastLog.length) return;
  try {
    const raw = localStorage.getItem(getStorageKey('topicHistory'));
    const list = raw ? JSON.parse(raw) : [];
    list.unshift({
      topic: _activeTopic.angle,
      rounds: _roundNum,
      blastLog: _topicBlastLog.slice(),
      time: Date.now(),
    });
    localStorage.setItem(getStorageKey('topicHistory'), JSON.stringify(list.slice(0, 30)));
  } catch(e) { console.warn('saveTopicHistoryEntry failed', e); }
}

function loadHistoryList() {
  try {
    const raw = localStorage.getItem(getStorageKey('history'));
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

function openHistorySheet() {
  const list = loadHistoryList();
  const container = document.getElementById('historyList');
  if (!list.length) {
    container.innerHTML = `<div class="history-empty">还没有引爆记录，去炸一个话题吧</div>`;
  } else {
    container.innerHTML = list.map(item => {
      const d = new Date(item.time);
      const timeStr = `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      return `
        <div class="history-item">
          <div class="history-topic">${escHtml(item.topic)} <span class="history-round-tag">第${item.round}轮</span></div>
          <div class="history-line">${escHtml(item.line)}</div>
          <div class="history-blackmark">
            <span class="history-judge-chip bomb">黑历史</span>
            <span class="history-blast-name">${escHtml(item.blastedName)}</span>
            <span class="history-punish-text">${escHtml(item.punish)}</span>
          </div>
          <div class="history-meta">
            <span class="history-time">${timeStr}</span>
          </div>
        </div>`;
    }).join('');
  }
  document.getElementById('historyOverlay').classList.add('open');
  document.getElementById('historySheet').classList.add('open');
}

function closeHistorySheet() {
  document.getElementById('historyOverlay').classList.remove('open');
  document.getElementById('historySheet').classList.remove('open');
}

/* ----------------------------------------------------------------
   Full transcript sheet
---------------------------------------------------------------- */
function openFullTranscript() {
  const container = document.getElementById('transcriptList');
  let lastRound = null;
  container.innerHTML = _topicTranscript.map(e => {
    const roundHeader = e.round !== lastRound
      ? `<div class="transcript-round-divider">第 ${e.round} 轮接龙</div>`
      : '';
    lastRound = e.round;
    return `${roundHeader}
    <div class="fuse-bubble" style="animation:none;">
      <div class="fuse-av">${renderAvatar(e.member, 'fuse-av-inner')}</div>
      <div class="fuse-content">
        <div class="fuse-name">${escHtml(e.member.name)}</div>
        <div class="fuse-text-wrap">${escHtml(e.text)}</div>
      </div>
    </div>`;
  }).join('');
  document.getElementById('transcriptOverlay').classList.add('open');
  document.getElementById('transcriptSheet').classList.add('open');
}

function closeFullTranscript() {
  document.getElementById('transcriptOverlay').classList.remove('open');
  document.getElementById('transcriptSheet').classList.remove('open');
}

/* ----------------------------------------------------------------
   Info sheet
---------------------------------------------------------------- */
function showInfo() {
  document.getElementById('infoOverlay').classList.add('open');
  document.getElementById('infoSheet').classList.add('open');
}
function closeInfoSheet() {
  document.getElementById('infoOverlay').classList.remove('open');
  document.getElementById('infoSheet').classList.remove('open');
}

/* ----------------------------------------------------------------
   Go again
---------------------------------------------------------------- */
function goAgain() {
  const inputEl = document.getElementById('topicInput');
  if (inputEl) { inputEl.value = ''; document.getElementById('topicCount').textContent = '16'; }
  _activeTopic = null;
  _fuseEntries = [];
  _topicTranscript = [];
  _topicBlastLog = [];
  _roundNum = 0;
  showStage('input');
  setHeaderForInput();
}

/* ----------------------------------------------------------------
   Utilities
---------------------------------------------------------------- */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function tbToast(msg) {
  const t = document.getElementById('tbToast');
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
  loadTensionFromStorage();
  renderTensionBar();

  if (_usingDemoMembers) {
    setTimeout(() => {
      tbToast('未读取到群成员数据，请从群聊页面的「群互动」入口进入');
    }, 800);
  }

  showStage('input');
  setInterval(updateTime, 10000);
});