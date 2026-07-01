/* ================================================================
   fortune.js — 命运抽签
   流程：摇签 → 开出签文 → 逐一请群内角色解签(回应+心声) →
        全部问完后选出最贴心的一支 → 存入签筒档案
================================================================ */

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
   Toast
---------------------------------------------------------------- */
let _toastTimer = null;
function ftToast(msg) {
  const el = document.getElementById('ftToast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ----------------------------------------------------------------
   Group members + user identity (same loading convention as groupanon.js)
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

let _groupMembers = [];
let _groupName    = 'GROUP';

function loadGroupData() {
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
      }
    } else {
      _groupMembers = DEMO_MEMBERS;
    }
  } catch(e) {
    _groupMembers = DEMO_MEMBERS;
  }
  if (_groupMembers.length < 1) _groupMembers = DEMO_MEMBERS;
}

function renderAvatar(member, sizeClass) {
  if (member && member.avatar) {
    return `<img src="${escHtml(member.avatar)}" class="${sizeClass} av-img" alt="${escHtml(member.name)}" onerror="this.parentElement.innerHTML='${escHtml(member.initial||'?')}'" />`;
  }
  return escHtml(member ? (member.initial || '?') : '?');
}

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
  const src = [
    identity.gender || '', identity.desc || '',
    (identity.tags || []).join(' '), identity.role || '',
  ].join(' ').toLowerCase();
  if (/女|she|her|girl|lady/.test(src)) return 'female';
  if (/男|he|him|boy|guy/.test(src))    return 'male';
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
  return `\n【你和群内其他人的称呼与关系——必须严格遵守】\n${lines.join('\n')}`;
}

/* ----------------------------------------------------------------
   AI API call — 复用设置页已配置好的接口
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
    if (!reply) throw new Error('API 返回空内容，请检查模型配置或重试');
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
    if (!reply) {
      const errMsg = data.error?.message || '';
      throw new Error(errMsg ? 'API 错误：' + errMsg.slice(0,100) : 'API 返回空内容，可能被内容过滤或 max_tokens 过小');
    }
  }
  return reply.trim();
}

function notifyApiNotConfigured() {
  ftToast('请先在「设置 → API」中配置并选择模型');
}

/* ----------------------------------------------------------------
   Fortune stick pool — 60 支签（签序号 / 等级 / 签文 / 白话）
---------------------------------------------------------------- */
/* 签的"等级"仍然用固定库（上上签/上吉签.../末签），保证概率分布可控、不会抽到奇怪的等级；
   但具体的签文内容（四句诗 + 白话解读）每次都现场调用 AI 重新创作，不会两次抽到一模一样的签 */
const FORTUNE_TIERS = [
  { rank:'上上签', en:'SUPREME FORTUNE', weight: 6 },
  { rank:'上吉签', en:'GREAT FORTUNE',   weight: 14 },
  { rank:'中吉签', en:'FAIR FORTUNE',    weight: 18 },
  { rank:'中平签', en:'MODERATE FORTUNE',weight: 22 },
  { rank:'平签',   en:'NEUTRAL FORTUNE', weight: 18 },
  { rank:'中下签', en:'CAUTION FORTUNE', weight: 16 },
  { rank:'未定签', en:'UNRESOLVED FORTUNE', weight: 6 },
];

function pickRandomTier() {
  const total = FORTUNE_TIERS.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * total;
  for (const t of FORTUNE_TIERS) {
    if (r < t.weight) return t;
    r -= t.weight;
  }
  return FORTUNE_TIERS[FORTUNE_TIERS.length - 1];
}

/* 本地兜底库：仅在 AI 不可用（未配置/请求失败）时使用，保证功能不中断；
   正常情况下每次抽签都应该走 AI 现场创作，不会用到这里 */
const FORTUNE_FALLBACK_POOL = [
  { rank:'上上签', en:'SUPREME FORTUNE', poem:'云开月正圆\n旧雨化新缘\n莫问归期早\n自有暗香传', vern:'阴霾终将散去，圆满正在路上。不必急于求证结果，缘分自会在恰当的时刻悄然靠近。' },
  { rank:'上吉签', en:'GREAT FORTUNE', poem:'梅蕊待春深\n孤芳暗自寻\n莫嫌花期晚\n来日满枝阴', vern:'眼下的等待并非空耗，而是积蓄。时机未到不代表落空，耐心会换来满树繁花。' },
  { rank:'中吉签', en:'FAIR FORTUNE', poem:'雾里看花影\n犹疑两三分\n且将心放定\n自见路上人', vern:'当下的局面有些朦胧，难以一眼看透。先安住自己的心，答案会随时间逐渐清晰。' },
  { rank:'中平签', en:'MODERATE FORTUNE', poem:'静水深流处\n不语自分明\n勿急于一时\n缓缓见真情', vern:'此事急不得，真心和真相都需要时间沉淀才能显现，平静等待比仓促行动更有效。' },
  { rank:'平签', en:'NEUTRAL FORTUNE', poem:'井中观天小\n出井见天宽\n莫困一隅地\n放眼自从容', vern:'你可能被眼前的局限困住了视野，跳出当下的执念，会看见更宽阔的可能性。' },
  { rank:'中下签', en:'CAUTION FORTUNE', poem:'路有荆棘处\n行人当慎行\n非是无归途\n只缘步未明', vern:'前路有些坎坷，不代表走不通，而是需要更谨慎地辨认方向，急于求成反而容易迷路。' },
  { rank:'未定签', en:'UNRESOLVED FORTUNE', poem:'此签未分明\n答案在己心\n问神不如问\n那个犹豫人', vern:'这支签没有给出明确的指向，因为答案本就藏在你自己心里——去问问那个还在犹豫的自己。' },
];

function pickFallbackFortune(tier) {
  const matches = FORTUNE_FALLBACK_POOL.filter(f => f.rank === (tier && tier.rank));
  const pool = matches.length ? matches : FORTUNE_FALLBACK_POOL;
  return pool[Math.floor(Math.random() * pool.length)];
}

/* 现场调用 AI，依据抽到的等级，创作一支全新的签文（四句诗 + 白话解读），
   每次措辞、意象都不同，避免和之前抽到的重复 */
async function generateFortuneText(tier) {
  const systemPrompt = `你是中国传统签文（求签/抽签）的创作者，请为用户创作一支全新的签文。

【等级要求】
这支签的等级是「${tier.rank}」（${tier.en}），签文的吉凶基调必须和这个等级相符。

【格式要求——必须严格按以下 JSON 格式输出，不要输出任何 JSON 之外的文字、不要用代码块包裹】
{"poem": "四句诗，每句4到6个字，用 \\n 分隔成四行，意境含蓄、有古典韵味，不要直白说教", "vern": "一句40到70字的白话解读，把诗意翻译成现代人能懂的人生提示，语气温和不说教，不要逐字翻译，要有引导性"}

【创作要求】
1. 诗句要有意象（云、月、风、花、水、舟、灯、雪等自然或生活意象皆可），避免空话套话
2. 不同等级的诗句基调要有明显区分：等级越高，意境越开阔顺遂；等级越低/越中性，意境越内敛、强调耐心或谨慎，但即使是"中下签"也不要写得过于绝望，要留有转机
3. 每次创作都要和常见的求签诗句不一样，避免使用过于俗套的"否极泰来""守得云开见月明"这类已经被用烂的表达，要有新鲜的意象组合
4. 输出必须是合法 JSON，字符串内的换行用 \\n 转义，不要用真实换行符`;

  const prompt = `请创作一支「${tier.rank}」等级的全新签文，按要求输出 JSON。`;

  const reply = await callClaude(prompt, systemPrompt, 400);
  const cleaned = String(reply || '').trim().replace(/^```json\s*|```$/g, '').trim();
  const parsed = JSON.parse(cleaned);
  if (!parsed.poem || !parsed.vern) throw new Error('AI 返回内容不完整');
  return {
    rank: tier.rank,
    en: tier.en,
    poem: String(parsed.poem).trim(),
    vern: String(parsed.vern).trim(),
  };
}

/* ----------------------------------------------------------------
   State
---------------------------------------------------------------- */
let _currentFortune  = null;    // { rank, en, poem, vern, num, ts, readings:{memberId:{interp,segments,heart}}, bestMemberId }
let _archive          = [];     // saved fortunes
let _activeReadMember = null;   // member currently shown in reading sheet
let _activeReadTab    = 'interp';
let _archiveDetailId  = null;
let _isDrawing        = false;
let _readingSource    = null;   // { fortune, readOnly } — which fortune/readings set the reading modal is currently showing

const ARCHIVE_KEY = 'luna_fortune_archive';

function loadArchive() {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    _archive = raw ? JSON.parse(raw) : [];
  } catch(e) { _archive = []; }
}
function saveArchive() {
  try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(_archive)); } catch(e) {}
}

/* ----------------------------------------------------------------
   Boot
---------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
  updateTime(); setInterval(updateTime, 30000);
  updateBattery(); applyIsland();

  loadGroupData();
  loadArchive();

  buildCanisterSticks();

  _userIdentity = await loadUserIdentity();
  _userGender   = deriveGender(_userIdentity);
});

/* ----------------------------------------------------------------
   View routing / back handling
---------------------------------------------------------------- */
function showFtView(name) {
  document.querySelectorAll('.ft-view').forEach(v => v.classList.remove('active'));
  document.getElementById('view' + name).classList.add('active');
}

function handleFtBack() {
  if (document.getElementById('adetailSheet')?.classList.contains('open')) { closeArchiveDetail(); return; }
  if (document.getElementById('bestpickSheet')?.classList.contains('open')) { closeBestPick(); return; }
  if (document.getElementById('heartPop')?.classList.contains('open')) { closeHeartPop(); return; }
  if (document.getElementById('readingSheet')?.classList.contains('open')) { closeReading(); return; }
  const archiveActive = document.getElementById('viewArchive')?.classList.contains('active');
  const resultActive  = document.getElementById('viewResult')?.classList.contains('active');
  if (archiveActive || resultActive) { showFtView('Draw'); return; }
  /* At root — try to leave the page/iframe context */
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'luna-nav-back' }, '*');
  } else if (window.history.length > 1) {
    window.history.back();
  }
}

/* ----------------------------------------------------------------
   Canister stick visuals — static at-rest array (fan layout)
---------------------------------------------------------------- */
function buildCanisterSticks(container) {
  const el = container || document.getElementById('canisterSticks');
  if (!el) return;
  const COUNT = 9;
  let html = '';
  for (let i = 0; i < COUNT; i++) {
    const offset = (i - (COUNT - 1) / 2);
    const rot   = offset * 3.2;
    const xShift = offset * 5.4;
    const h = 122 + Math.abs(offset) * -2;
    html += `<div class="cn-stick" style="transform:translateX(calc(-50% + ${xShift}px)) rotate(${rot}deg); height:${h}px;"></div>`;
  }
  el.innerHTML = html;
}

/* ----------------------------------------------------------------
   Draw flow — 摇签 → 弹出签子动画 → 显示结果
---------------------------------------------------------------- */
function startDraw() {
  if (_isDrawing) return;
  _isDrawing = true;

  document.getElementById('canisterStage')?.classList.add('shaking');
  const overlay = document.getElementById('shakeOverlay');
  overlay.classList.add('open');

  const innerSticks = document.getElementById('shakeSticksInner');
  buildCanisterSticks(innerSticks);
  const canister = document.getElementById('shakeCanister');
  canister.classList.add('shaking');

  const statusText = document.getElementById('shakeStatusText');
  statusText.textContent = '摇 签 中';

  /* Phase 1: shake for a moment */
  setTimeout(() => {
    canister.classList.remove('shaking');
    document.getElementById('canisterStage')?.classList.remove('shaking');
    statusText.textContent = '签 已 现 形';

    /* Phase 2: pop a stick out */
    const stick = document.getElementById('shakeEmergeStick');
    stick.classList.add('popping');

    setTimeout(() => {
      finishDraw();
    }, 1050);
  }, 1450);
}

async function finishDraw() {
  const overlay = document.getElementById('shakeOverlay');
  overlay.classList.remove('open');

  /* reset for next time */
  const stick = document.getElementById('shakeEmergeStick');
  stick.classList.remove('popping');

  const tier = pickRandomTier();
  const num  = String(Math.floor(Math.random()*88)+1).padStart(2,'0');

  /* 先用等级骨架占位切到结果页，正文（诗句+白话）现场生成后再填入 */
  _currentFortune = {
    rank: tier.rank,
    en: tier.en,
    poem: '',
    vern: '',
    num,
    ts: Date.now(),
    readings: {},
    bestMemberId: null,
  };

  showFtView('Result');
  setResultLoading(true);
  document.getElementById('resultRank').textContent = tier.rank;
  document.getElementById('resultRankEn').textContent = tier.en;
  document.getElementById('resultStickArt').setAttribute('data-num', '第 ' + num + ' 签');
  document.querySelector('.result-stick').setAttribute('data-num', '第' + num + '签');

  try {
    const generated = await generateFortuneText(tier);
    _currentFortune.poem = generated.poem;
    _currentFortune.vern = generated.vern;
  } catch (e) {
    /* AI 不可用时兜底，保证功能不中断，但只在失败时才会用到本地库 */
    const fb = pickFallbackFortune(tier);
    _currentFortune.poem = fb.poem;
    _currentFortune.vern = fb.vern;
    if (e && e.message === 'NO_API_CONFIG') notifyApiNotConfigured();
  }

  setResultLoading(false);
  renderResult();
  _isDrawing = false;
}

function setResultLoading(on) {
  const loadEl = document.getElementById('resultCardLoading');
  const contentEl = document.getElementById('resultCardContent');
  if (!loadEl || !contentEl) return;
  loadEl.classList.toggle('show', on);
  contentEl.classList.toggle('hidden', on);
}

/* ----------------------------------------------------------------
   Result rendering
---------------------------------------------------------------- */
function renderResult() {
  const f = _currentFortune;
  if (!f) return;

  document.getElementById('resultStickArt').setAttribute('data-num', '第 ' + f.num + ' 签');
  document.querySelector('.result-stick').setAttribute('data-num', '第' + f.num + '签');
  document.getElementById('resultRank').textContent = f.rank;
  document.getElementById('resultRankEn').textContent = f.en;
  document.getElementById('resultPoem').textContent = f.poem;
  document.getElementById('resultVernacular').textContent = f.vern;

  renderCharPickList();
  updateFinishRow();
}

function renderCharPickList() {
  const el = document.getElementById('charPickList');
  if (!el) return;
  const f = _currentFortune;
  el.innerHTML = _groupMembers.map(m => {
    const done = f.readings[m.id] && f.readings[m.id].interp;
    const subLine = (m.desc || m.bio || '').trim();
    const sub = subLine ? subLine.slice(0, 20) : (m.role === 'admin' ? '群管理员' : '群成员');
    /* done 状态的卡片：以只读模式打开（不重新生成，不显示"收下"按钮），传入 _currentFortune 避免歧义 */
    const onclickAttr = done
      ? `pickCharacterForReading('${m.id}', _currentFortune, true)`
      : `pickCharacterForReading('${m.id}')`;
    return `
      <div class="char-pick-card ${done ? 'done' : ''}" onclick="${onclickAttr}">
        <div class="cpc-avatar">${renderAvatar(m, 'cpc-av')}</div>
        <div class="cpc-info">
          <div class="cpc-name">${escHtml(m.name)}</div>
          <div class="cpc-sub">${escHtml(sub)}</div>
        </div>
        <div class="cpc-status ${done ? 'done' : ''}">
          ${done
            ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20,6 9,17 4,12"/></svg> 已解'
            : '请TA解签 →'}
        </div>
      </div>`;
  }).join('');
}

function updateFinishRow() {
  const f = _currentFortune;
  if (!f) return;
  const total = _groupMembers.length;
  const done  = Object.keys(f.readings).filter(id => f.readings[id] && f.readings[id].interp).length;
  const row = document.getElementById('resultFinishRow');
  if (row) row.style.display = (done >= total && total > 0) ? 'block' : 'none';
}

/* ----------------------------------------------------------------
   Reading sheet — 角色解签（AI 生成 解读 + 心声）
---------------------------------------------------------------- */
function pickCharacterForReading(memberId, fortuneOverride, readOnly) {
  const member = _groupMembers.find(m => m.id === memberId)
              || { id: memberId, name: '未知成员', initial: '?' };
  _activeReadMember = member;
  _activeReadTab = 'interp';

  const f = fortuneOverride || _currentFortune;
  _readingSource = { fortune: f, readOnly: !!readOnly };

  document.getElementById('readingAvatar').innerHTML = renderAvatar(member, 'rd-av');
  document.getElementById('readingName').textContent = member.name;
  document.getElementById('readingRole').textContent = readOnly
    ? (member.role === 'admin' ? '群管理员 · 曾为你解签' : '群成员 · 曾为你解签')
    : (member.role === 'admin' ? '群管理员 · 为你解签' : '群成员 · 为你解签');

  const overlay = document.getElementById('readingOverlay');
  const modal   = document.getElementById('readingSheet');
  overlay.classList.add('open');
  requestAnimationFrame(() => modal.classList.add('open'));

  /* 只读模式（从档案回看）：永远不重新生成，只展示已保存内容 */
  const footBtn = document.getElementById('readingFootBtn');
  if (footBtn) {
    footBtn.querySelector('span').textContent = readOnly ? '合上这段回忆' : '收下这份解读';
  }

  const existing = f && f.readings ? f.readings[memberId] : null;
  if (existing && existing.segments && existing.segments.length) {
    showReadingSegments(existing.segments);
  } else if (existing && existing.interp) {
    /* 兼容旧档案：没有 segments 字段时退化为纯文本展示 */
    showReadingSegments([{ type: 'text', text: existing.interp }]);
  } else if (readOnly) {
    showReadingLoading(false);
    document.getElementById('textInterp').textContent = '（这段解读没有被完整保存下来）';
  } else {
    generateInterpretation(member);
  }
}

/* 渲染：将段落数组渲染为正文，被标记的句子加上可点击的行内高亮样式。
   标记句子本身原样可读（就是正文的一部分），点击后才会单独调用 AI，
   依据"这句话"+"完整解签上下文"现场生成这句话背后没说出口的心声 */
function showReadingSegments(segments) {
  const loadEl = document.getElementById('loadInterp');
  const textEl = document.getElementById('textInterp');
  loadEl.classList.remove('show');

  let html = '';
  let heartIdx = 0;

  segments.forEach(seg => {
    if (seg.type === 'heart') {
      const idx = heartIdx++;
      const sentence = String(seg.text || '').trim();
      const skin = idx % 5; // 5 种心声标记样式轮替，避免单调
      html += `<span class="heart-inline heart-skin-${skin}" onclick="openHeartPop(${idx})" role="button" aria-label="点击窥见这句话背后的心声">${escHtml(sentence)}</span>`;
    } else {
      /* normal text — split on blank lines into paragraphs for breathing room */
      const paras = String(seg.text || '').split(/\n{2,}/).filter(Boolean);
      if (paras.length > 1) {
        html += paras.map(p => `<p>${escHtml(p).replace(/\n/g,'<br/>')}</p>`).join('');
      } else {
        html += escHtml(seg.text).replace(/\n/g, '<br/>');
      }
    }
  });

  textEl.innerHTML = html;
  /* 每个标记句子对应一个待生成的心声槽位：
     text = 这句话本身（用于生成时的上下文）；heart = 生成结果缓存（懒加载，点开才生成，生成过一次后缓存复用）
     如果 segments 里这句话之前已经生成过（generatedHeart，比如来自归档或本次会话内点开过），直接预填进缓存 */
  window._currentHeartSlots = segments
    .filter(s => s.type === 'heart')
    .map(s => ({ text: s.text, heart: s.generatedHeart || null, loading: false }));
  /* 完整正文（含标记），供生成心声时提供上下文 */
  window._currentReadingFullText = segments.map(s => s.text).join('\n');
}

function showReadingLoading(on) {
  const loadEl = document.getElementById('loadInterp');
  const textEl = document.getElementById('textInterp');
  if (on) { loadEl.classList.add('show'); textEl.innerHTML = ''; }
  else { loadEl.classList.remove('show'); }
}

/* 解析 AI 返回的带 [[heart]]...[[/heart]] 标记的正文，切分为段落数组 */
/* 解析 AI 返回的带 [[mark]]...[[/mark]] 标记的正文，切分为段落数组。
   注意：mark 标记只是"标出这句话是心声"，标记内的文字本身就是要展示在正文里的可读内容，
   并不包含额外的隐藏内容——隐藏的潜台词需要在用户点击时单独调用 AI 生成 */
function parseSegments(raw) {
  const segments = [];
  let re = /\[\[mark\]\]([\s\S]*?)\[\[\/mark\]\]/g;
  /* 容错：如果模型没有严格按 [[mark]]...[[/mark]] 输出，
     而是偷懒写成裸的 [[这句话]]，也按标记句子处理，避免方括号原样露在正文里 */
  if (!re.test(raw)) {
    re = /\[\[([^\[\]]+)\]\]/g;
  }
  re.lastIndex = 0;
  let lastIndex = 0;
  let m;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > lastIndex) {
      const plain = raw.slice(lastIndex, m.index).trim();
      if (plain) segments.push({ type: 'text', text: plain });
    }
    const heartText = m[1].trim();
    if (heartText) segments.push({ type: 'heart', text: heartText });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < raw.length) {
    const plain = raw.slice(lastIndex).trim();
    if (plain) segments.push({ type: 'text', text: plain });
  }
  /* fallback: no markers found at all → treat whole thing as text */
  if (!segments.length && raw.trim()) segments.push({ type: 'text', text: raw.trim() });
  return segments;
}

async function generateInterpretation(member) {
  showReadingLoading(true);
  const f = _currentFortune;

  const brief       = buildMemberBrief(member);
  const relationCtx = buildRelationContext(member);
  const userName    = userDisplayName();
  const userBrief   = buildUserBrief();
  const pronoun     = userPronoun();

  const systemPrompt = `你正在扮演群聊成员「${member.name}」，绝对不能让人感觉是AI在说话。你正在为群主解读TA刚抽到的一支签。

【这个人是谁】
${brief}${relationCtx}

【眼前发生的事】
群主「${userName}」（${userBrief}）刚刚抽到了一支签，向你求解。请你结合自己跟${pronoun}的关系、自己的性格，给出一段完整、有层次、有真情实感的解签长文。

【签文信息】
等级：${f.rank}（${f.en}）
签文：${f.poem}
白话提示（仅供你理解，不要照抄）：${f.vern}

【极重要——输出格式规则，必须严格遵守】
正文是完整连贯、可以直接阅读的一段话。其中有些句子，是「${member.name}」自己当时没太意识到、但其实话里有话、藏着没明说的潜台词的句子——把这些句子用 [[mark]]这句话[[/mark]] 完整包裹起来标出来，标记必须写满 [[mark]] 和 [[/mark]] 这两个完整词，不能只写方括号。
- 正确示例：今天天气是真不错。[[mark]]别管什么天气了，我是想找个理由约你出来。[[/mark]] 你说呢？
- 错误示例（禁止这样写）：今天天气是真不错。[[别管什么天气了，我是想找个理由约你出来。]] 你说呢？　←　这样写方括号会原样显示在屏幕上，绝对不允许
- 注意：标记本身不改变这句话的内容，标记内的文字就是正文的一部分，原样朗读出来，不要写成两套文字
- 整段文字里至少要标出4到7处这样的句子，分散在全文不同位置，不要堆在开头或结尾
- 被标记的句子要选得自然——本身读起来是正常解签的一部分，但细品会发现话里有话，留有可以深挖的余地（比如看似随口一句吐槽，背后其实是在意；看似调侃，背后其实是关心）

【内容要求——必须做到】
1. 用「${member.name}」这个具体的人会有的口吻说话，措辞、节奏、口头禅要有强辨识度，贯穿全文保持一致
2. 解签必须紧密结合你和「${userName}」之间的具体关系——你们的称呼、相处方式、平时的相处模式、你对${pronoun}真实的态度——解读角度要带着你们之间独有的情感色彩和私人记忆，不能写成对陌生人说的通用解签
3. 解签要分几个层次展开，不要平铺直叙：可以先调侃几句签文本身，再联系到${pronoun}最近的具体状态或你们之间发生过的事，再说说你对这件事/这段关系的真实看法，最后用一句很有「${member.name}」性格的话收尾
4. 可以引用或想象${pronoun}最近可能经历的具体场景细节，让解读显得不是泛泛而谈，而是真的了解${pronoun}
5. 语气要像在手机上认真打字说一段长长的话，允许停顿、转折、自我打断，不要写成一篇正经的"解签报告"或新闻通稿
6. 如果提到群里其他人，必须用你和TA之间专属的称呼

【严禁清单——一条都不能犯】
- 禁止以"作为一个XX""这支签的意思是""说实话"这种公文式或套话开场
- 禁止逐字翻译签文，要用「${member.name}」自己的话重新讲一遍
- 禁止鸡汤式、说教式总结收尾
- 禁止出现"AI""模型""程序"等破坏沉浸感的词
- 禁止人设漂移，全文必须保持「${member.name}」一致的语气、立场和说话习惯
- 禁止把所有 [[mark]] 标记堆在同一处，必须分散在全文不同位置
- 禁止在 [[mark]] 标记内写额外补充内容，标记内必须是原本就会说出口的那句话本身

【字数要求】
正文总字数不少于1000字，要有真正的内容密度，不能注水重复。`;

  const prompt = `「${userName}」抽到了「${f.rank}」，签文是：\n${f.poem}\n\n用你（${member.name}）的方式，结合你们的关系，给${pronoun}写一段完整详尽的解签长文，按要求用 [[mark]]...[[/mark]] 标出其中4到7处话里有话、藏着潜台词的句子。`;

  try {
    const reply = await callClaude(prompt, systemPrompt, 2200);
    const segments = parseSegments(reply);
    if (!_currentFortune.readings[member.id]) _currentFortune.readings[member.id] = {};
    _currentFortune.readings[member.id].raw = reply;
    _currentFortune.readings[member.id].segments = segments;
    _currentFortune.readings[member.id].interp = segments.map(s => s.text).join('\n\n'); // plain fallback for archive snippets
    if (_activeReadMember && _activeReadMember.id === member.id) showReadingSegments(segments);
    renderCharPickList();
    updateFinishRow();
  } catch(e) {
    showReadingLoading(false);
    if (e.message === 'NO_API_CONFIG') { notifyApiNotConfigured(); }
    else { ftToast('解签失败：' + e.message); }
    document.getElementById('textInterp').textContent = '（解签暂时失败，请重试一次）';
  }
}

/* 弹层有 3 种基调皮肤 + 3 种印章图形，按点击的心声序号轮替，
   让每次点开的"心声"弹窗都不完全一样 */
const HP_SEAL_ICONS = [
  // 0 — 心形（默认）
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2 12c2-5 6-8 10-8s8 3 10 8c-2 5-6 8-10 8s-8-3-10-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  // 1 — 月牙
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/></svg>',
  // 2 — 印章方框
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z" stroke-width="1"/></svg>'
];

function openHeartPop(idx) {
  const slots = window._currentHeartSlots || [];
  const slot = slots[idx];
  if (!slot) return;

  const skin = idx % 3;
  const popEl = document.getElementById('heartPop');
  popEl.classList.remove('hp-panel-0', 'hp-panel-1', 'hp-panel-2');
  popEl.classList.add('hp-panel-' + skin);
  document.getElementById('hpSealIcon').innerHTML = HP_SEAL_ICONS[skin];

  document.getElementById('heartPopOverlay').classList.add('open');
  requestAnimationFrame(() => popEl.classList.add('open'));

  if (slot.heart) {
    /* 已经生成过（本次会话内点开过一次），直接复用，不用重复请求 */
    renderHeartPopText(slot.heart, false);
    return;
  }

  if (slot.loading) return; // 正在生成中，避免重复点击触发多次请求

  /* 只读模式（从档案回看），如果当时没有点开生成过、也没有缓存，
     就没有这句话背后的心声可看了——不能假装生成一个新的，要如实告知 */
  if (_readingSource && _readingSource.readOnly) {
    renderHeartPopText('（当时没有点开看过这句话背后的心声，这段念头已经随时间散去了）', false, true);
    return;
  }

  generateHeartVoice(idx, slot);
}

function renderHeartPopText(text, loading, faded) {
  const textEl = document.getElementById('heartPopText');
  textEl.textContent = text;
  textEl.classList.toggle('hp-text-loading', !!loading);
  textEl.classList.toggle('hp-text-faded', !!faded);
}

/* 点击某句被标记的话后，现场调用 AI：依据"这句话本身" + "完整解签上下文" + "角色人设/关系"，
   单独生成这句话当时没说出口、藏在背后的真实心思——不是复用正文里已有的文字 */
async function generateHeartVoice(idx, slot) {
  slot.loading = true;
  renderHeartPopText('', true);

  const member = _activeReadMember;
  const f = (_readingSource && _readingSource.fortune) || _currentFortune;
  if (!member || !f) { slot.loading = false; renderHeartPopText('（无法生成，缺少上下文）', false); return; }

  const brief       = buildMemberBrief(member);
  const relationCtx = buildRelationContext(member);
  const userName    = userDisplayName();
  const pronoun      = userPronoun();
  const fullText    = window._currentReadingFullText || '';

  const systemPrompt = `你正在扮演群聊成员「${member.name}」。TA刚刚给「${userName}」解读了一支签，下面这句话是TA解签原话里的一句：

「${slot.text}」

【这个人是谁】
${brief}${relationCtx}

【任务】
这句话「${member.name}」说出口的时候，其实心里转过一个没有真的说出来的念头——可能是话说得比想的更轻描淡写、可能是趁机夹带了私心、可能是自己都没完全意识到的真实情绪。请你站在「${member.name}」的视角，写出TA说这句话时心里真正闪过的那个念头。

【完整解签上下文，帮助你理解这句话出现的场景】
${fullText.slice(0, 1500)}

【要求】
1. 只写这一句话背后的心声，控制在30到70字，具体、有画面感，不要写成空泛的感叹
2. 必须用「${member.name}」的口吻和措辞，跟TA说话的方式保持一致
3. 不要重复或改写原句，要写的是原句没有说出来的那一层真实想法
4. 不要带"AI""模型"等字眼，不要写成旁白式的心理活动描写（比如不要用"TA心想"开头），直接写第一人称的念头本身
5. 不要加引号、不要加任何前后缀说明文字，只输出这段心声本身`;

  const prompt = `针对你刚才说的这句话「${slot.text}」，写出你当时心里真正闪过、但没说出口的那个念头。`;

  try {
    const reply = await callClaude(prompt, systemPrompt, 380);
    const heartText = String(reply || '').trim().replace(/^["“]|["”]$/g, '');
    slot.heart = heartText || '（这个念头一闪而过，没抓住）';
    slot.loading = false;
    renderHeartPopText(slot.heart, false);

    /* 把生成结果缓存进当前 reading 的 segments，方便"收下"时一并存进档案 */
    persistHeartResult(idx, slot.heart);
  } catch (e) {
    slot.loading = false;
    if (e.message === 'NO_API_CONFIG') {
      notifyApiNotConfigured();
      renderHeartPopText('（未配置生成服务，暂时看不到这句心声）', false, true);
    } else {
      renderHeartPopText('（这句心声生成失败，再点一次试试）', false, true);
    }
  }
}

/* 把某句心声的生成结果写回 _currentFortune.readings[member].segments，
   这样"收下"归档时，已经点开看过的心声会被一并保存，回档案再点开还能看到 */
function persistHeartResult(idx, heartText) {
  const f = _currentFortune;
  const member = _activeReadMember;
  if (!f || !member || !f.readings || !f.readings[member.id]) return;
  const segs = f.readings[member.id].segments;
  if (!Array.isArray(segs)) return;
  let heartCursor = -1;
  for (let i = 0; i < segs.length; i++) {
    if (segs[i].type === 'heart') {
      heartCursor++;
      if (heartCursor === idx) { segs[i].generatedHeart = heartText; break; }
    }
  }
}

function closeHeartPop(evt) {
  if (evt && evt.target !== evt.currentTarget) return;
  document.getElementById('heartPopOverlay')?.classList.remove('open');
  document.getElementById('heartPop')?.classList.remove('open');
}

function closeReading(evt) {
  if (evt && evt.target !== evt.currentTarget) return;
  document.getElementById('readingOverlay')?.classList.remove('open');
  document.getElementById('readingSheet')?.classList.remove('open');
  /* 清空 active 状态，不清空 _currentFortune（结果页还可能需要再次点开其他人） */
  _readingSource    = null;
  _activeReadMember = null;
}

/* ----------------------------------------------------------------
   Best pick — 选出最贴心的一支解读
---------------------------------------------------------------- */
function openBestPick() {
  const f = _currentFortune;
  const list = document.getElementById('bestpickList');
  const readyMembers = _groupMembers.filter(m => f.readings[m.id] && f.readings[m.id].interp);

  list.innerHTML = readyMembers.map(m => {
    const snippet = (f.readings[m.id].interp || '').slice(0, 60);
    return `
      <div class="bestpick-card" onclick="confirmBestPick('${m.id}')">
        <div class="bp-avatar">${renderAvatar(m, 'bp-av')}</div>
        <div class="bp-body">
          <div class="bp-name">${escHtml(m.name)}</div>
          <div class="bp-snippet">${escHtml(snippet)}${snippet.length >= 60 ? '…' : ''}</div>
        </div>
      </div>`;
  }).join('');

  document.getElementById('bestpickOverlay').classList.add('open');
  document.getElementById('bestpickSheet').classList.add('open');
}

function closeBestPick(evt) {
  if (evt && evt.target !== evt.currentTarget) return;
  document.getElementById('bestpickOverlay')?.classList.remove('open');
  document.getElementById('bestpickSheet')?.classList.remove('open');
}

function confirmBestPick(memberId) {
  const f = _currentFortune;
  f.bestMemberId = memberId;

  /* 深拷贝 readings，确保 segments（用于还原心声标记样式）也完整保存进档案 */
  const readingsClone = {};
  Object.keys(f.readings).forEach(id => {
    const r = f.readings[id] || {};
    readingsClone[id] = {
      raw: r.raw,
      interp: r.interp,
      segments: Array.isArray(r.segments) ? r.segments.map(s => ({ ...s })) : undefined
    };
  });

  _archive.unshift({ ...f, readings: readingsClone });
  saveArchive();

  closeBestPick();
  ftToast('这支签已珍藏入签筒档案');

  setTimeout(() => {
    showFtView('Archive');
    renderArchiveList();
  }, 380);
}

/* ----------------------------------------------------------------
   Archive list + detail (best reading unlocked first; others
   require having opened the best one first)
---------------------------------------------------------------- */
function openArchive() {
  renderArchiveList();
  showFtView('Archive');
}

function renderArchiveList() {
  const listEl  = document.getElementById('archiveList');
  const emptyEl = document.getElementById('archiveEmpty');
  const countEl = document.getElementById('archiveCount');
  if (!listEl) return;

  countEl.textContent = _archive.length + ' 支';

  if (!_archive.length) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';

  listEl.innerHTML = _archive.map((f, idx) => {
    const dateStr = new Date(f.ts).toLocaleDateString('zh-CN', { month:'2-digit', day:'2-digit' });
    const poemSnip = (f.poem || '').replace(/\n/g, ' ');
    return `
      <div class="archive-item" onclick="openArchiveDetail(${idx})">
        <div class="ai-stick-mini"></div>
        <div class="ai-body">
          <div class="ai-rank">${escHtml(f.rank)}</div>
          <div class="ai-poem-snip">${escHtml(poemSnip)}</div>
          <div class="ai-meta">
            <span class="ai-best-tag">最佳解读已封存</span>
            <span class="ai-date">${dateStr}</span>
          </div>
        </div>
        <div class="ai-arrow">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="9,18 15,12 9,6"/></svg>
        </div>
      </div>`;
  }).join('');
}

function openArchiveDetail(idx) {
  _archiveDetailId = idx;
  const f = _archive[idx];
  if (!f) return;

  const bestMember = _groupMembers.find(m => m.id === f.bestMemberId)
                   || { id: f.bestMemberId, name: '未知成员', initial: '?' };
  const bestReading = f.readings[f.bestMemberId] || {};
  const otherEntries = Object.keys(f.readings).filter(id => id !== f.bestMemberId);

  /* unlocked flag stored per-archive-item so re-opening keeps state */
  const unlocked = !!f._bestSeen;

  const bestSnippet = (bestReading.interp || '').slice(0, 78);

  let html = `
    <div class="adetail-card">
      <div class="adetail-rank">${escHtml(f.rank)}</div>
      <div class="adetail-divider"><span></span><i></i><span></span></div>
      <div class="adetail-poem">${escHtml(f.poem)}</div>
    </div>

    <div class="adetail-best-block" onclick="reopenArchiveReading(${idx}, '${f.bestMemberId}')">
      <div class="adetail-best-head">
        <div class="adetail-best-avatar">${renderAvatar(bestMember, 'adb-av')}</div>
        <div>
          <div class="adetail-best-name">${escHtml(bestMember.name)}</div>
          <div class="adetail-best-tagline">最贴心的解读 · 已珍藏</div>
        </div>
      </div>
      <div class="adetail-best-text">${escHtml(bestSnippet)}${(bestReading.interp || '').length > 78 ? '…' : ''}</div>
      <div class="adetail-reopen-hint">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <span>点击重新展开完整解读与心声</span>
      </div>
    </div>
  `;

  if (!unlocked) {
    html += `<div class="adetail-locked-hint">先回顾上面这支最贴心的解读，其余成员的解签内容才会向你展开</div>`;
  } else {
    html += `<div class="adetail-other-list">`;
    html += otherEntries.map(id => {
      const m = _groupMembers.find(mm => mm.id === id) || { id, name: '未知成员', initial: '?' };
      const r = f.readings[id] || {};
      const snippet = (r.interp || '').slice(0, 50);
      return `
        <div class="adetail-other-card" onclick="reopenArchiveReading(${idx}, '${id}')">
          <div class="adetail-other-head">
            <div class="adetail-other-avatar">${renderAvatar(m, 'ado-av')}</div>
            <div class="adetail-other-name">${escHtml(m.name)}</div>
          </div>
          <div class="adetail-other-text">${escHtml(snippet)}${(r.interp || '').length > 50 ? '…' : ''}</div>
        </div>`;
    }).join('');
    html += `</div>`;
  }

  html += `<div class="adetail-close-btn" onclick="closeArchiveDetail()">收起</div>`;

  document.getElementById('adetailScroll').innerHTML = html;

  document.getElementById('adetailOverlay').classList.add('open');
  document.getElementById('adetailSheet').classList.add('open');

  /* mark best as seen so next open reveals everything */
  if (!f._bestSeen) {
    f._bestSeen = true;
    saveArchive();
  }
}

/* 从档案详情里点开某个人的解读 — 复用同一套带心声标记样式的解签弹层，
   只读模式：不会重新生成，永远展示当时保存下来的完整内容 */
function reopenArchiveReading(archiveIdx, memberId) {
  const f = _archive[archiveIdx];
  if (!f) return;
  pickCharacterForReading(memberId, f, true);
}

function closeArchiveDetail(evt) {
  if (evt && evt.target !== evt.currentTarget) return;
  document.getElementById('adetailOverlay')?.classList.remove('open');
  document.getElementById('adetailSheet')?.classList.remove('open');
  _archiveDetailId = null;
  /* re-render list (in case lock state changed) */
  renderArchiveList();
}