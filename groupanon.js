/* ================================
   groupanon.js — 群互动·匿名问答
   玩法：发问 → 全员AI作答 → 猜谁的答案 → 揭晓+独白
================================ */

/* ----------------------------------------------------------------
   Status bar utilities (1:1 from groupchat.js)
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
let _currentView  = 'hub';
let _anonMode     = true;
let _currentTab   = 'all';
let _questions    = [];
let _nextId       = 1;
let _askMode      = 'manual';   // 'manual' | 'ai'
let _groupMembers = [];         // populated from localStorage
let _groupName    = 'GROUP';

/* Active game state */
let _activeQuestion  = null;   // question object currently in game phase
let _pendingAnswers  = [];     // answers collected from all members
let _selectedAnswer  = null;   // answer user tapped to guess
let _currentRvTab    = 'response';

/* ----------------------------------------------------------------
   Fallback demo members (used when no real group data)
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
   Returns the active identity object, or null if none found.
   Fields we care about: name, role, desc, tags, gender, avatarImg, avatarColor, bgImg
---------------------------------------------------------------- */
let _userIdentity = null;   // active user persona
let _userGender   = null;   // 'female'|'male'|'other'|null  — derived from identity

async function loadUserIdentity() {
  try {
    /* Probe LunaIdentityDB */
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
    /* Prefer the first active identity; fall back to first in list */
    const active = list.find(i => i.active !== false) || list[0];
    return active;
  } catch(e) { return null; }
}

/* Derive pronoun / gender label from identity.
   Heuristic: check gender field, desc, tags for clues.
   Returns 'female' | 'male' | 'other' | null */
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
  return null;   // unknown → prompts will avoid hard-coded pronoun
}

/* Returns Chinese pronoun for AI prompts */
function userPronoun() {
  if (_userGender === 'female') return '她';
  if (_userGender === 'male')   return '他';
  return 'TA';   // gender-neutral
}

/* Returns the user's display name for AI prompts */
function userDisplayName() {
  return _userIdentity?.name || '群主';
}

/* Build a persona brief for the user (used in MAQ prompts so AI knows who is answering) */
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
   Load group data from localStorage (written by groupchat.js)
---------------------------------------------------------------- */
let _usingDemoMembers = false;

function loadGroupData() {
  _usingDemoMembers = false;
  try {
    /* Try both key names used by groupchat.js */
    const raw = localStorage.getItem('luna_groupanon_data')
             || localStorage.getItem('luna_group_data')
             || localStorage.getItem('luna_groupchat_data');
    if (raw) {
      const data = JSON.parse(raw);
      _groupName    = data.name    || 'GROUP';
      const members = data.members && data.members.length > 0 ? data.members : null;
      if (members) {
        /* Normalise: ensure each member has initial + avatar fields */
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
  /* Ensure at least 2 members for the game to be interesting */
  if (_groupMembers.length < 2) {
    _groupMembers = [..._groupMembers, ...DEMO_MEMBERS].slice(0, 4);
    _usingDemoMembers = true;
  }
}

/* Helper: render an avatar element — img if available, else text initial */
function renderAvatar(member, sizeClass) {
  if (member && member.avatar) {
    return `<img src="${escHtml(member.avatar)}" class="${sizeClass} av-img" alt="${escHtml(member.name)}" onerror="this.parentElement.innerHTML='${escHtml(member.initial||'?')}'" />`;
  }
  return escHtml(member ? (member.initial || '?') : '?');
}

/* ----------------------------------------------------------------
   Cross-page navigation — seamless jump to standalone feature pages
   (coaster.html / fortune.html / topicbomb.html / etc.)

   Strategy:
   1. preloadPage() — fired on hover/touchstart, *before* the click
      actually happens. Warms the browser's HTTP cache for the target
      page + its own .css/.js by requesting it in the background, so
      by the time the user actually taps, the bytes are already local.
   2. navigateToPage() — fired on click. Fades in a full-screen white
      overlay over ~180ms (matches the target page's own fade-in),
      then swaps location.href. Because step 1 already warmed the
      cache, the new page paints almost immediately, so the overlay
      reads as one continuous transition instead of a blank flash.
---------------------------------------------------------------- */
const _preloadedPages = new Set();

function preloadPage(url) {
  if (_preloadedPages.has(url)) return;
  _preloadedPages.add(url);
  try {
    /* Warm the page itself */
    const linkHtml = document.createElement('link');
    linkHtml.rel = 'prefetch';
    linkHtml.href = url;
    linkHtml.as = 'document';
    document.head.appendChild(linkHtml);

    /* Also warm its sibling .css / .js, since every feature page
       in this project follows the same name.html/.css/.js pattern */
    const base = url.replace(/\.html?$/, '');
    ['.css', '.js'].forEach(ext => {
      const l = document.createElement('link');
      l.rel = 'prefetch';
      l.href = base + ext;
      l.as = ext === '.css' ? 'style' : 'script';
      document.head.appendChild(l);
    });

    /* Fallback for browsers that ignore <link rel=prefetch>: a plain
       fetch still populates the HTTP cache in most cases. */
    fetch(url, { mode: 'no-cors', priority: 'low' }).catch(() => {});
  } catch (e) { /* prefetch is best-effort, never block on it */ }
}

function navigateToPage(url) {
  preloadPage(url); /* in case click fires before hover/touchstart did */
  const overlay = document.getElementById('pageTransition');
  if (!overlay) { location.href = url; return; }

  overlay.innerHTML = '<div class="pt-spinner"></div>';
  overlay.classList.add('active');

  /* Give the browser one paint frame to show the overlay, then jump.
     220ms mirrors the .ga-frame entrance fade already used across
     these pages, so the swap feels like a single motion rather than
     "page A disappears, blank gap, page B appears". */
  setTimeout(() => { location.href = url; }, 180);
}

/* ----------------------------------------------------------------
   View routing
---------------------------------------------------------------- */
function openAnonQA() {
  _currentView = 'anon';
  document.getElementById('viewHub')?.classList.remove('active');
  document.getElementById('viewMaq')?.classList.remove('active');
  document.getElementById('viewAnon')?.classList.add('active');
  document.getElementById('headerEyebrow').textContent = 'GROUP · FEATURE';
  document.getElementById('headerTitleText').innerHTML = '匿名问答 <span class="header-badge">ANON Q&A</span>';
  requestAnimationFrame(() => positionTabIndicator(_currentTab));
}

function openMemberAsk() {
  _currentView = 'maq';
  document.getElementById('viewHub')?.classList.remove('active');
  document.getElementById('viewAnon')?.classList.remove('active');
  document.getElementById('viewMaq')?.classList.add('active');
  document.getElementById('headerEyebrow').textContent = 'GROUP · FEATURE';
  document.getElementById('headerTitleText').innerHTML = '成员提问 <span class="header-badge">ASK ME</span>';
  updateMaqStats();
  renderMaqFeed();
}

function showHub() {
  _currentView = 'hub';
  document.getElementById('viewAnon')?.classList.remove('active');
  document.getElementById('viewMaq')?.classList.remove('active');
  document.getElementById('viewHub')?.classList.add('active');
  document.getElementById('headerEyebrow').textContent = 'GROUP · HUB';
  document.getElementById('headerTitleText').innerHTML = '群互动 <span class="header-badge">INTERACT</span>';
}

function handleBack() {
  /* Close any open overlay first */
  if (document.getElementById('maqRevealModal')?.classList.contains('open')) {
    closeMaqRevealModal(); return;
  }
  if (document.getElementById('maqReactSheet')?.classList.contains('open')) {
    closeMaqReactSheet(); return;
  }
  if (document.getElementById('maqAnswerSheet')?.classList.contains('open')) {
    closeMaqAnswerSheet(); return;
  }
  if (document.getElementById('maqQviewSheet')?.classList.contains('open')) {
    closeMaqQview(); return;
  }
  if (document.getElementById('revealModal')?.classList.contains('open')) {
    closeRevealModal(); return;
  }
  if (document.getElementById('guessModal')?.classList.contains('open')) {
    closeGuessModal(); return;
  }
  if (document.getElementById('gameOverlay')?.classList.contains('open')) {
    closeGameOverlay(); return;
  }
  if (_currentView === 'anon') { showHub(); return; }
  if (_currentView === 'maq')  { showHub(); return; }
  if (localStorage.getItem('luna_groupanon_from') === 'groupchat') {
    history.back(); return;
  }
  history.back();
}

/* ----------------------------------------------------------------
   Tab switching
---------------------------------------------------------------- */
function switchTab(tab) {
  _currentTab = tab;
  ['all','pending','answered'].forEach(t => {
    document.getElementById('tab-' + t)?.classList.toggle('active', t === tab);
  });
  positionTabIndicator(tab);
  renderFeed();
}

function positionTabIndicator(tab) {
  const indicator = document.getElementById('tabIndicator');
  const tabEl     = document.getElementById('tab-' + tab);
  const track     = document.querySelector('.tab-track');
  if (!indicator || !tabEl || !track) return;
  const trackRect = track.getBoundingClientRect();
  const tabRect   = tabEl.getBoundingClientRect();
  indicator.style.transform = `translateX(${tabRect.left - trackRect.left - 3}px)`;
  indicator.style.width = tabRect.width + 'px';
}

/* ----------------------------------------------------------------
   Ask mode: manual vs AI
---------------------------------------------------------------- */
function setAskMode(mode) {
  _askMode = mode;
  document.getElementById('modeManual')?.classList.toggle('active', mode === 'manual');
  document.getElementById('modeAI')?.classList.toggle('active', mode === 'ai');
  document.getElementById('askRow').style.display    = mode === 'manual' ? 'flex' : 'none';
  document.getElementById('aiGenRow').style.display  = mode === 'ai'     ? 'flex' : 'none';
}

/* ----------------------------------------------------------------
   Anonymous toggle
---------------------------------------------------------------- */
function toggleAnon() {
  _anonMode = !_anonMode;
  const toggle   = document.getElementById('anonToggle');
  const hint     = document.getElementById('askHint');
  const maskIcon = document.getElementById('askMaskIndicator');
  if (toggle)   toggle.classList.toggle('off', !_anonMode);
  if (hint) {
    hint.textContent = _anonMode
      ? 'YOUR IDENTITY IS HIDDEN FROM ALL MEMBERS'
      : '实名提问 · YOUR NAME WILL BE VISIBLE';
    hint.classList.toggle('revealed', !_anonMode);
  }
  if (maskIcon) maskIcon.classList.toggle('revealed', !_anonMode);
}

/* ----------------------------------------------------------------
   Input handling
---------------------------------------------------------------- */
function onAskInput(el) {
  const remaining = 200 - el.value.length;
  const countEl   = document.getElementById('askCharCount');
  const sendBtn   = document.getElementById('askSendBtn');
  if (countEl) {
    countEl.textContent = remaining;
    countEl.classList.toggle('warn',  remaining <= 50);
    countEl.classList.toggle('limit', remaining <= 20);
  }
  if (sendBtn) sendBtn.classList.toggle('active', el.value.length > 0);
}

function onAskKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitQuestion(); }
}

/* ----------------------------------------------------------------
   AI Generate question
---------------------------------------------------------------- */
async function aiGenerateQuestion() {
  const btn     = document.getElementById('aiGenBtn');
  const topicEl = document.getElementById('aiTopic');
  const topic   = topicEl?.value.trim() || '';

  if (btn) { btn.classList.add('loading'); btn.innerHTML = '<span>生成中…</span>'; }

  const memberNames = _groupMembers.map(m => m.name).join('、');
  const memberDesc  = _groupMembers.map(m => `${m.name}（${buildMemberBrief(m)}）`).join('；');
  const userName    = userDisplayName();
  const userBrief   = buildUserBrief();
  const prompt = `群成员有：${memberDesc}。群主是「${userName}」（${userBrief}）。
请想一个适合在群里匿名抛出来问大家的问题，目的是让${memberNames}各自答出来时风格差异明显、能看出性格区别。
要求：
- 问题要具体、有抓手，避免"你怎么看XX"这种泛泛的提法，最好能带出一个具体场景或选择
- 不涉及隐私、敏感、攻击性话题
- 口语化，像群里随手发的一句话，不要书面语，25字以内
${topic ? `- 围绕这个方向来想：${topic}` : '- 话题方向自定，日常、喜好、习惯、小毛病、人生态度都可以'}
只输出问题本身，不要加引号、不要任何前缀或解释。`;

  try {
    const res  = await callClaude(prompt, null, 300);
    const text = res.trim().replace(/^[「"']|[」"']$/g, '');
    if (text) {
      /* Auto-fill the manual input and switch to manual mode */
      setAskMode('manual');
      const field = document.getElementById('askField');
      if (field) { field.value = text; onAskInput(field); }
      gaToast('AI 已生成问题，可直接发送');
    } else {
      gaToast('生成失败：AI 返回空内容，请重试');
    }
  } catch(err) {
    if (err.message === 'NO_API_CONFIG') notifyApiNotConfigured();
    else gaToast('生成失败：' + (err.message || err));
    console.error('[aiGenerateQuestion]', err);
  }

  if (btn) { btn.classList.remove('loading'); btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>生成问题</span>'; }
}

/* ----------------------------------------------------------------
   Submit question → publish card → trigger game
---------------------------------------------------------------- */
function submitQuestion() {
  const field = document.getElementById('askField');
  if (!field) return;
  const text = field.value.trim();
  if (!text) return;

  field.value = '';
  onAskInput(field);

  const now     = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:false });

  const q = {
    id:      _nextId++,
    text,
    time:    timeStr,
    status:  'pending',
    likes:   0,
    liked:   false,
    answer:  null,
    /* Game data */
    answers:       [],   // [{memberId, memberName, memberInitial, memberAvatar, text}]
    guessResults:  {},   // {answerId: 'correct'|'wrong'}
    gameStarted:   false,
    gameComplete:  false,
  };

  _questions.unshift(q);
  saveQuestionsToStorage();
  updateStats();
  renderFeed();
  gaToast('问题已匿名发布，点击卡片查看成员答案');

  /* Switch to "all" tab so user sees it */
  if (_currentTab !== 'all') switchTab('all');
}

/* ----------------------------------------------------------------
   Like toggle
---------------------------------------------------------------- */
function toggleLike(id) {
  const q = _questions.find(q => q.id === id);
  if (!q) return;
  q.liked = !q.liked;
  q.likes += q.liked ? 1 : -1;
  saveQuestionsToStorage();
  renderFeed();
}

/* ----------------------------------------------------------------
   Stats
---------------------------------------------------------------- */
function updateStats() {
  const all      = _questions.length;
  const answered = _questions.filter(q => q.gameComplete).length;
  const pending  = all - answered;
  animateNum('statTotal',    all);
  animateNum('statAnswered', answered);
  animateNum('statPending',  pending);
  animateNum('hubStatTotal', all);
}

function animateNum(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const current = parseInt(el.textContent, 10) || 0;
  if (current === target) return;
  const step = target > current ? 1 : -1;
  let val = current;
  const timer = setInterval(() => {
    val += step;
    el.textContent = val;
    if (val === target) clearInterval(timer);
  }, 40);
}

/* ----------------------------------------------------------------
   Render feed
---------------------------------------------------------------- */
function renderFeed() {
  const list = document.getElementById('qaList');
  if (!list) return;

  let filtered = _questions;
  if (_currentTab === 'pending')  filtered = _questions.filter(q => !q.gameComplete);
  if (_currentTab === 'answered') filtered = _questions.filter(q => q.gameComplete);

  if (filtered.length === 0) {
    list.innerHTML = buildEmptyState(_currentTab);
    return;
  }

  list.innerHTML = filtered.map((q, i) => buildCardHtml(q, i)).join('');
}

function buildEmptyState(tab) {
  const msgs = {
    all:      ['NO QUESTIONS YET', '成为第一个提问的人\nBE THE FIRST TO ASK'],
    pending:  ['ALL CAUGHT UP', '没有进行中的问答\nNO ACTIVE QUESTIONS'],
    answered: ['NOTHING HERE', '还没有完成的问答\nNO COMPLETED ROUNDS YET'],
  };
  const [title, sub] = msgs[tab] || msgs.all;
  return `
  <div class="qa-empty">
    <div class="qa-empty-icon">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <path d="M12 8v4M12 16h.01" stroke-width="1.8"/>
      </svg>
    </div>
    <div class="qa-empty-title">${escHtml(title)}</div>
    <div class="qa-empty-sub">${escHtml(sub).replace(/\n/g,'<br>')}</div>
  </div>`;
}

function buildCardHtml(q, idx) {
  const delay = Math.min(idx * 0.06, 0.45);
  const statusLabel = q.gameComplete ? 'PLAYED' : q.gameStarted ? 'LIVE' : 'OPEN';
  const statusClass = q.gameComplete ? 'answered' : q.gameStarted ? 'live' : 'pending';
  const answersCount = q.answers ? q.answers.length : 0;
  const clickAttr = `onclick="onCardClick(${q.id})"`;

  const membersLine = q.gameComplete
    ? `<div class="qa-members-row">${_groupMembers.slice(0,4).map(m =>
        `<div class="qa-member-chip">${escHtml(m.initial)}</div>`).join('')}</div>`
    : '';

  const actionLine = q.gameComplete
    ? `<div class="qa-card-action played">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="20,6 9,17 4,12"/></svg>
        已完成 · 查看结果
       </div>`
    : q.gameStarted
    ? `<div class="qa-card-action live-action">
        <div class="live-pulse-dot"></div>
        ${answersCount}/${_groupMembers.length} 答案收集中
       </div>`
    : `<div class="qa-card-action open">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polygon points="5,3 19,12 5,21"/></svg>
        点击·收集全员答案
       </div>`;

  return `
  <div class="qa-card-wrap ${statusClass}">
    <div class="qa-card-node"></div>
    <div class="qa-card-tether"></div>
    <div class="qa-card ${statusClass}" style="animation-delay:${delay}s" ${clickAttr}>
      <div class="qa-card-inner">
        <div class="qa-q-row">
          <div class="qa-q-tag">Q</div>
          <div class="qa-q-text">${escHtml(q.text)}</div>
        </div>
        <div class="qa-meta-row">
          <div class="qa-time">${escHtml(q.time)}</div>
          <div class="qa-dot"></div>
          <div class="qa-status-chip ${statusClass}">${statusLabel}</div>
          <div class="qa-reactions">
            <div class="qa-react-btn ${q.liked ? 'liked' : ''}" onclick="event.stopPropagation();toggleLike(${q.id})">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="${q.liked ? '#555' : 'none'}" stroke="${q.liked ? '#555' : '#c8c8c8'}" stroke-width="2" stroke-linecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              <span>${q.likes}</span>
            </div>
          </div>
        </div>
        ${membersLine}
        ${actionLine}
      </div>
    </div>
  </div>`;
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ----------------------------------------------------------------
   safeParseJSON — 从 AI 返回文本里提取 JSON，兼容 DeepSeek 等模型
   在 JSON 前后多输出文字的情况
---------------------------------------------------------------- */
function safeParseJSON(raw, isArray) {
  if (!raw) throw new Error('empty response');
  // 1. strip markdown fences
  let s = raw.replace(/```json[\s\S]*?```|```[\s\S]*?```/g, m => {
    // extract inner content of the fence
    return m.replace(/```json|```/g, '');
  }).trim();
  // 2. try direct parse first
  try { return JSON.parse(s); } catch(e) {}
  // 3. extract first { } or [ ] block
  const opener = isArray ? '[' : '{';
  const closer = isArray ? ']' : '}';
  const start = s.indexOf(opener);
  const end   = s.lastIndexOf(closer);
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(s.slice(start, end + 1)); } catch(e) {}
  }
  // 4. last resort: find any JSON object/array anywhere
  const m1 = s.match(/(\{[\s\S]*\})/);
  const m2 = s.match(/(\[[\s\S]*\])/);
  const candidate = isArray ? (m2?.[1] || m1?.[1]) : (m1?.[1] || m2?.[1]);
  if (candidate) return JSON.parse(candidate);
  throw new Error('JSON not found in: ' + s.slice(0, 100));
}

/* ----------------------------------------------------------------
   Card click → start game or resume
---------------------------------------------------------------- */
function onCardClick(qid) {
  const q = _questions.find(q => q.id === qid);
  if (!q) return;

  if (q.gameComplete) {
    /* Resume: open overlay and show guess phase */
    _activeQuestion = q;
    openGameOverlay();
    showGuessPhase(q);
    return;
  }

  if (q.gameStarted && q.answers && q.answers.length === _groupMembers.length) {
    /* Already collected, go to guess */
    _activeQuestion = q;
    openGameOverlay();
    showGuessPhase(q);
    return;
  }

  /* Start collecting answers */
  startGameForQuestion(q);
}

/* ----------------------------------------------------------------
   GAME PHASE 1: collect all member answers
---------------------------------------------------------------- */
async function startGameForQuestion(q) {
  _activeQuestion = q;
  q.gameStarted   = true;
  q.answers       = [];
  renderFeed();

  /* Show overlay phase 1 */
  openGameOverlay();
  showPhase('collecting');

  /* Build member progress chips */
  const membersEl = document.getElementById('collectingMembers');
  if (membersEl) {
    membersEl.innerHTML = _groupMembers.map(m => {
      const avInner = m.avatar
        ? `<img src="${escHtml(m.avatar)}" alt="${escHtml(m.initial)}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;display:block;" onerror="this.parentElement.textContent=''${escHtml(m.initial)}''"/>`
        : escHtml(m.initial);
      return `
      <div class="gc-member-chip" id="gmc_${m.id}">
        <div class="gc-member-av" style="${m.avatar ? 'padding:0;overflow:hidden;' : ''}">
          ${avInner}
        </div>
        <div class="gc-member-status" id="gms_${m.id}">
          <div class="gc-spinner"></div>
        </div>
      </div>`;
    }).join('');
  }

  /* Collect answers one by one with staggered delays */
  for (let i = 0; i < _groupMembers.length; i++) {
    const member = _groupMembers[i];
    updateCollectingSub(`正在获取 ${member.name} 的回答…`);

    try {
      const answerText = await generateMemberAnswer(q.text, member);
      q.answers.push({
        id:            'ans_' + q.id + '_' + member.id,
        memberId:      member.id,
        memberName:    member.name,
        memberInitial: member.initial,
        memberAvatar:  member.avatar,
        text:          answerText,
        guessed:       false,
        guessCorrect:  null,
      });
      /* Mark this member chip as done */
      markMemberDone(member.id, true);
    } catch(err) {
      /* Fallback */
      if (err.message === 'NO_API_CONFIG') {
        notifyApiNotConfigured();
        closeGameOverlay();
        q.gameStarted = false;
        renderFeed();
        return;
      }
      q.answers.push({
        id:            'ans_' + q.id + '_' + member.id,
        memberId:      member.id,
        memberName:    member.name,
        memberInitial: member.initial,
        memberAvatar:  member.avatar,
        text:          '（此成员暂时无法作答）',
        guessed:       false,
        guessCorrect:  null,
      });
      markMemberDone(member.id, false);
    }

    /* Small delay between members for drama */
    await sleep(400);
  }

  updateCollectingSub('所有答案已收集完毕！');
  await sleep(800);

  /* Shuffle answers so order doesn't reveal identity */
  q.answers = shuffleArray(q.answers);
  saveQuestionsToStorage();

  showGuessPhase(q);
}

function updateCollectingSub(text) {
  const el = document.getElementById('collectingSub');
  if (el) el.textContent = text;
}

function markMemberDone(memberId, success) {
  const statusEl = document.getElementById('gms_' + memberId);
  const chipEl   = document.getElementById('gmc_' + memberId);
  if (statusEl) {
    statusEl.innerHTML = success
      ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round"><polyline points="20,6 9,17 4,12"/></svg>`
      : `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  }
  if (chipEl) chipEl.classList.add('done');
}

/* ----------------------------------------------------------------
   GAME PHASE 2: show answers, guess mode
---------------------------------------------------------------- */
function showGuessPhase(q) {
  showPhase('guess');

  const guessQ = document.getElementById('guessQ');
  if (guessQ) guessQ.textContent = q.text;

  const cardsEl = document.getElementById('guessCards');
  if (!cardsEl) return;

  cardsEl.innerHTML = q.answers.map((ans, idx) => {
    const isGuessed  = ans.guessed;
    const resultCls  = isGuessed ? (ans.guessCorrect ? 'correct' : 'wrong') : '';
    const resultBadge = isGuessed
      ? (ans.guessCorrect
          ? `<div class="gc-badge correct">✓ 猜对了</div>`
          : `<div class="gc-badge wrong">✗ 猜错了</div>`)
      : '';
    const nameLine = (isGuessed && !ans.guessCorrect)
      ? `<div class="gc-reveal-name">实际是 ${escHtml(ans.memberName)}</div>`
      : (isGuessed && ans.guessCorrect)
      ? `<div class="gc-reveal-name">— ${escHtml(ans.memberName)}</div>`
      : '';

    return `
    <div class="gc-answer-card ${resultCls}" style="animation-delay:${idx * 0.1}s"
         onclick="onAnswerCardClick('${q.id}','${ans.id}')">
      <div class="gc-answer-num">${String.fromCharCode(65 + idx)}</div>
      <div class="gc-answer-body">
        <div class="gc-answer-text">${escHtml(ans.text)}</div>
        ${nameLine}
      </div>
      ${resultBadge}
    </div>`;
  }).join('');
}

/* ----------------------------------------------------------------
   Answer card click → open guess-who modal
---------------------------------------------------------------- */
function onAnswerCardClick(qid, ansId) {
  const q   = _questions.find(q => q.id == qid);
  if (!q) return;
  const ans = q.answers.find(a => a.id === ansId);
  if (!ans) return;

  /* If already guessed this one, open reveal directly */
  if (ans.guessed) {
    showRevealModal(q, ans, null);
    return;
  }

  _selectedAnswer = ans;
  openGuessModal(q, ans);
}

/* ----------------------------------------------------------------
   Guess-who modal
---------------------------------------------------------------- */
function openGuessModal(q, ans) {
  const overlay = document.getElementById('guessModalOverlay');
  const modal   = document.getElementById('guessModal');
  const preview = document.getElementById('gmAnswerPreview');
  const members = document.getElementById('gmMembers');

  if (preview) preview.textContent = ans.text;

  if (members) {
    members.innerHTML = _groupMembers.map(m => {
      const avInner = m.avatar
        ? `<img src="${escHtml(m.avatar)}" alt="${escHtml(m.initial)}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;display:block;" onerror="this.parentElement.textContent=''${escHtml(m.initial)}''"/>`
        : escHtml(m.initial);
      return `
      <div class="gm-member-option" onclick="submitGuess('${m.id}')">
        <div class="gm-member-av" style="${m.avatar ? 'padding:0;overflow:hidden;' : ''}">
          ${avInner}
        </div>
        <div class="gm-member-name">${escHtml(m.name)}</div>
        <div class="gm-member-arrow">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9,6 15,12 9,18"/></svg>
        </div>
      </div>`;
    }).join('');
  }

  overlay?.classList.add('open');
  requestAnimationFrame(() => modal?.classList.add('open'));
}

function closeGuessModal() {
  document.getElementById('guessModalOverlay')?.classList.remove('open');
  document.getElementById('guessModal')?.classList.remove('open');
}

/* ----------------------------------------------------------------
   Submit a guess
---------------------------------------------------------------- */
async function submitGuess(guessedMemberId) {
  if (!_selectedAnswer || !_activeQuestion) { closeGuessModal(); return; }

  closeGuessModal();

  const ans     = _selectedAnswer;
  const correct = ans.memberId === guessedMemberId;

  ans.guessed      = true;
  ans.guessCorrect = correct;

  /* Update guess results */
  if (!_activeQuestion.guessResults) _activeQuestion.guessResults = {};
  _activeQuestion.guessResults[ans.id] = correct ? 'correct' : 'wrong';
  saveQuestionsToStorage();

  /* Check if all answered questions have been guessed → mark complete */
  const allGuessed = _activeQuestion.answers.every(a => a.guessed);
  if (allGuessed) {
    _activeQuestion.gameComplete = true;
    _activeQuestion.status = 'answered';
    saveQuestionsToStorage();
    updateStats();
    renderFeed();
  }

  /* Re-render the guess cards to show results */
  showGuessPhase(_activeQuestion);

  /* Show reveal modal with AI-generated response + monologue */
  showRevealModal(_activeQuestion, ans, correct);
}

/* ----------------------------------------------------------------
   Reveal modal
   Content is generated once and cached on the answer object so
   re-opening the modal never wastes API calls.
---------------------------------------------------------------- */
async function showRevealModal(q, ans, correct) {
  const overlay   = document.getElementById('revealOverlay');
  const modal     = document.getElementById('revealModal');
  const badge     = document.getElementById('rvBadge');
  const portrait  = document.getElementById('rvPortrait');
  const nameEl    = document.getElementById('rvName');
  const resultEl  = document.getElementById('rvResultText');

  /* Portrait — show real avatar if available, else text initial */
  if (portrait) {
    if (ans.memberAvatar) {
      portrait.style.padding  = '0';
      portrait.style.overflow = 'hidden';
      portrait.innerHTML = `<img src="${escHtml(ans.memberAvatar)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px;display:block;" onerror="this.parentElement.style.padding='';this.parentElement.style.overflow='';this.parentElement.textContent='${escHtml(ans.memberInitial)}';"/>`;
    } else {
      portrait.style.padding  = '';
      portrait.style.overflow = '';
      portrait.textContent = escHtml(ans.memberInitial);
    }
  }

  /* Name */
  if (nameEl) nameEl.textContent = ans.memberName;

  /* Result badge */
  if (badge) {
    if (correct === null) {
      badge.className = 'rv-result-badge neutral';
      badge.textContent = '查看详情';
    } else if (correct) {
      badge.className = 'rv-result-badge correct';
      badge.textContent = '✓ 猜对了！';
    } else {
      badge.className = 'rv-result-badge wrong';
      badge.textContent = '✗ 猜错了';
    }
  }

  /* Result text */
  if (resultEl) {
    if (correct === null) {
      resultEl.textContent = '这是 ' + ans.memberName + ' 的回答。';
    } else if (correct) {
      resultEl.textContent = '你认出了 ' + ans.memberName + ' 的语气！';
    } else {
      resultEl.textContent = '这其实是 ' + ans.memberName + ' 的回答。';
    }
  }

  /* Reset tabs */
  switchRvTab('response');

  overlay?.classList.add('open');
  requestAnimationFrame(() => modal?.classList.add('open'));

  /* ── If content was already generated, restore it immediately ── */
  if (ans._cachedResponse && ans._cachedMonologue) {
    showRvLoading('response', false);
    showRvLoading('monologue', false);
    document.getElementById('rvTextResponse').textContent  = ans._cachedResponse;
    document.getElementById('rvTextMonologue').textContent = ans._cachedMonologue;
    return;
  }

  /* Show loading states */
  showRvLoading('response', true);
  showRvLoading('monologue', true);
  document.getElementById('rvTextResponse').textContent  = '';
  document.getElementById('rvTextMonologue').textContent = '';

  /* Generate response */
  try {
    const responseText = await generateMemberResponseToUser(q, ans, correct);
    ans._cachedResponse = responseText;
    showRvLoading('response', false);
    typewriteText('rvTextResponse', responseText);
  } catch(e) {
    showRvLoading('response', false);
    document.getElementById('rvTextResponse').textContent = '（暂无回应）';
  }

  /* Generate monologue */
  try {
    const monologueText = await generateMemberMonologue(q, ans, correct);
    ans._cachedMonologue = monologueText;
    showRvLoading('monologue', false);
    document.getElementById('rvTextMonologue').textContent = monologueText;
  } catch(e) {
    showRvLoading('monologue', false);
    document.getElementById('rvTextMonologue').textContent = '（暂无独白）';
  }
}

function switchRvTab(tab) {
  _currentRvTab = tab;
  document.getElementById('rvTabResponse')?.classList.toggle('active',  tab === 'response');
  document.getElementById('rvTabMonologue')?.classList.toggle('active', tab === 'monologue');
  document.getElementById('rvPanelResponse')?.classList.toggle('hidden',  tab !== 'response');
  document.getElementById('rvPanelMonologue')?.classList.toggle('hidden', tab !== 'monologue');
}

function showRvLoading(panel, show) {
  document.getElementById('rvLoading' + panel.charAt(0).toUpperCase() + panel.slice(1))
    ?.classList.toggle('hidden', !show);
}

function closeRevealModal() {
  document.getElementById('revealOverlay')?.classList.remove('open');
  document.getElementById('revealModal')?.classList.remove('open');
}

/* Typewriter effect for reveal text */
function typewriteText(elId, text) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = '';
  let i = 0;
  const timer = setInterval(() => {
    if (i < text.length) {
      el.textContent += text[i++];
    } else {
      clearInterval(timer);
    }
  }, 28);
}

/* ----------------------------------------------------------------
   Game overlay helpers
---------------------------------------------------------------- */
function openGameOverlay() {
  document.getElementById('gameOverlay')?.classList.add('open');
}

function closeGameOverlay() {
  document.getElementById('gameOverlay')?.classList.remove('open');
  /* Also close sub-phases */
  showPhase(null);
}

function showPhase(name) {
  ['collecting', 'guess'].forEach(p => {
    document.getElementById('phase' + capitalize(p))?.classList.toggle('hidden', p !== name);
  });
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ----------------------------------------------------------------
   AI API calls — 复用设置页已配置好的接口
   （读取 settings.js 写入的 luna_api_current / luna_api_model）
---------------------------------------------------------------- */
function getLunaApiConfig() {
  let cur = {};
  try { cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}'); } catch(e) {}
  const baseUrl = (cur.baseUrl || '').trim().replace(/\/$/, '');
  const apiKey  = (cur.apiKey  || '').trim();
  /* luna_api_model 存的是模型名；部分版本 settings.js 把模型信息也放在 cur.model 里，兼容读取 */
  const model   = (localStorage.getItem('luna_api_model') || cur.model || '').trim();
  console.log('[getLunaApiConfig] baseUrl=', baseUrl || '(空)', '| model=', model || '(空)', '| apiKey=', apiKey ? '(已设置)' : '(空)');
  return { baseUrl, apiKey, model };
}

/**
 * 统一AI调用入口：自动判断 OpenAI 兼容接口 或 Anthropic 原生接口
 * - Anthropic 原生：baseUrl 包含 anthropic.com，或 model 以 claude- 开头
 *   请求格式：POST /v1/messages，响应字段 content[0].text
 * - OpenAI 兼容：其余情况
 *   请求格式：POST /chat/completions，响应字段 choices[0].message.content
 * @param {string} prompt        用户侧提示词（具体任务指令）
 * @param {string} [systemPrompt] 系统提示词（人设/规则）
 * @param {number} [maxTokens]   本次调用的最大输出token，按场景节流，避免浪费
 */
async function callClaude(prompt, systemPrompt, maxTokens) {
  const { baseUrl, apiKey, model } = getLunaApiConfig();

  if (!baseUrl || !apiKey || !model) {
    throw new Error('NO_API_CONFIG');
  }

  /* 判断是否走 Anthropic 原生格式：只看 baseUrl，不看 model 名
     - api.anthropic.com → Anthropic 原生 /v1/messages
     - 其他一切（DeepSeek、OpenAI、Ollama 等）→ OpenAI 兼容 /chat/completions */
  const isAnthropic = baseUrl.includes('anthropic.com');

  let res, data, reply;

  if (isAnthropic) {
    /* ── Anthropic 原生 /v1/messages ── */
    const body = {
      model,
      max_tokens:  maxTokens || 500,
      messages: [{ role: 'user', content: prompt }],
    };
    if (systemPrompt) body.system = systemPrompt;

    res = await fetch(`${baseUrl}/v1/messages`, {
      method:  'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type':      'application/json',
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
      console.warn('[callClaude] Anthropic empty reply, full response:', JSON.stringify(data).slice(0, 400));
      const stopReason = data.stop_reason || '';
      throw new Error('API 返回空内容' + (stopReason ? `（stop_reason: ${stopReason}）` : '') + '，请检查模型配置或重试');
    }

  } else {
    /* ── OpenAI 兼容 /chat/completions ──
       baseUrl 可能是 https://api.deepseek.com（无 /v1 后缀）
       也可能是 https://api.deepseek.com/v1（已有 /v1 后缀）
       统一处理：去掉末尾 /v1，再重新拼上，保证路径正确 */
    const apiBase = baseUrl.replace(/\/v1$/, '') + '/v1';
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    res = await fetch(`${apiBase}/chat/completions`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens:  maxTokens || 500,
        temperature: 0.95,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error('API error ' + res.status + (errText ? ': ' + errText.slice(0, 200) : ''));
    }
    data  = await res.json();
    reply = data.choices?.[0]?.message?.content ?? '';
    if (reply === null || reply === undefined || reply === '') {
      console.warn('[callClaude] OpenAI-compat empty reply, full response:', JSON.stringify(data).slice(0, 400));
      const finishReason = data.choices?.[0]?.finish_reason || '';
      const errMsg = data.error?.message || '';
      if (errMsg) throw new Error('API 错误：' + errMsg.slice(0, 100));
      throw new Error('API 返回空内容' + (finishReason ? `（finish_reason: ${finishReason}）` : '') + '，可能被内容过滤或 max_tokens 过小');
    }
  }

  return reply.trim();
}

/* 统一的「未配置API」提示，避免每个调用点各写一套文案 */
function notifyApiNotConfigured() {
  gaToast('请先在「设置 → API」中配置并选择模型');
}

/* ----------------------------------------------------------------
   Build a rich character brief from whatever fields are available.
   groupchat.js may leave bio empty — synthesise from name+role+initial.
---------------------------------------------------------------- */
function buildMemberBrief(member) {
  /* chars DB fields: desc, traits[], role(string), gender, age, birthday, prompt
     DEMO_MEMBERS uses: bio (string)
     Support both. */
  const roleLabel = member.role === 'admin' ? '群管理员' : '普通群成员';
  const parts = [];

  /* 主要描述：desc（chars DB）或 bio（DEMO）*/
  const mainDesc = (member.desc || member.bio || '').trim();
  if (mainDesc) parts.push(mainDesc);

  /* 性格标签 */
  if (member.traits && member.traits.length) {
    parts.push('性格标签：' + member.traits.join('、'));
  }

  /* 基本属性 */
  if (member.gender) parts.push(member.gender);
  if (member.age)    parts.push(member.age + '岁');

  /* 自定义 prompt（角色设定）优先级最高，追加在最后让模型重点参考 */
  const customPrompt = (member.prompt || '').trim();
  if (customPrompt) parts.push('角色设定：' + customPrompt);

  if (parts.length > 0) {
    return `${parts.join('；')}（身份：${roleLabel}）`;
  }
  /* 真的什么都没有 */
  return `群内${roleLabel}，名字是「${member.name}」。请根据名字赋予一个具体一致的性格，并在整个对话中严格保持。`;
}

/* Build list of all other members so the model knows the full cast */
function buildGroupCastLine(excludeId) {
  return _groupMembers
    .filter(m => m.id !== excludeId)
    .map(m => m.name)
    .join('、');
}

/**
 * Build a relationship context block for a member扮演时的称呼+关系说明。
 * 让 AI 扮演时知道"我该怎么称呼对方、我们什么关系"，避免称呼错乱。
 */
function buildRelationContext(member) {
  const others = _groupMembers.filter(m => m.id !== member.id);
  if (!others.length) return '';

  const lines = others.map(other => {
    /* relations 字段优先（支持 DEMO 或真实成员补充的关系） */
    const rel = member.relations && member.relations[other.id];
    if (rel) {
      const callPart = rel.callName ? `叫TA「${rel.callName}」` : `叫TA「${other.name}」`;
      const relPart  = rel.relationship ? `，${rel.relationship}` : '';
      return `- 对「${other.name}」：${callPart}${relPart}`;
    }
    /* 没有关系数据时，至少告知名字 */
    return `- 对「${other.name}」：直接叫「${other.name}」`;
  });

  return `\n【你和群内其他人的称呼与关系——说话时必须用这里的称呼，不能乱叫】\n${lines.join('\n')}`;
}

async function generateMemberAnswer(question, member) {
  const brief       = buildMemberBrief(member);
  const castLine    = buildGroupCastLine(member.id);
  const relationCtx = buildRelationContext(member);

  /* User persona context — so members know who asked */
  const userName  = userDisplayName();
  const userBrief = buildUserBrief();
  const pronoun   = userPronoun();

  const systemPrompt = `你正在扮演群聊成员「${member.name}」，绝对不能让人感觉是AI在说话。

【这个人是谁】
${brief}

【群里的其他成员】（你认识他们，说话风格跟他们都不一样）
${castLine || '暂无其他成员'}${relationCtx}

【发问的群主是谁】
群主叫「${userName}」。${userBrief}
这道匿名问题就是${pronoun}发出来的。你在心里知道这一点，但回答时不必点破。

【核心要求——必须做到】
1. 用「${member.name}」这个具体的人会有的口吻说话：措辞、语气、节奏都要有辨识度，不能跟群里其他人雷同
2. 有具体细节或场景，不要泛泛表态——"我觉得还好"这种废话不算回答
3. 像在手机上随手打字：允许口头语、不完整句子、停顿感，但不要堆砌"yyds""绷不住"等过度网络热词
4. 允许有立场和态度——可以敷衍、可以认真、可以反问、可以吐槽——只要符合这个人
5. 如果回答中自然提到群内其他人，必须用上方「你和群内其他人的称呼」里注明的叫法，不能乱叫、不能颠倒辈分

【严禁清单——一条都不能犯】
- 禁止以"作为一个XX""我觉得这个问题很""说实话"开场
- 禁止每段都升华或讲大道理
- 禁止鸡汤式圆满收尾
- 禁止出现"AI""模型""程序"等破坏沉浸感的词
- 禁止语气和措辞跟群里其他成员雷同
- 禁止用错称呼：叫法必须严格遵照上方关系说明，弟弟不能叫哥，晚辈不能反叫长辈名字

字数：90–160字，要有具体例子或场景，不要空泛表态度。`;

  const prompt = `群里有人匿名问：「${question}」\n用你（${member.name}）的方式回一句，别端着。`;
  return await callClaude(prompt, systemPrompt, 420);
}

async function generateMemberResponseToUser(q, ans, correct) {
  const member = _groupMembers.find(m => m.id === ans.memberId);
  if (!member) return '（无回应）';

  const brief       = buildMemberBrief(member);
  const relationCtx = buildRelationContext(member);
  const userName    = userDisplayName();
  const pronoun     = userPronoun();
  const guessResult = correct === null
    ? `「${userName}」刚刚直接看到了你的答案，没有经过猜测环节`
    : correct
      ? `「${userName}」一下就猜中了这是你的回答`
      : `「${userName}」猜了别人，没猜到这是你的回答`;

  const systemPrompt = `你正在扮演群聊成员「${member.name}」，绝对不能让人感觉是AI在说话。

【这个人是谁】
${brief}${relationCtx}

【场景】
刚才匿名问答游戏里，你回答了一个问题，现在身份被揭晓了，「${userName}」知道刚才那条回答是你写的。${guessResult}。

【核心要求】
- 用「${member.name}」真实会有的反应说一句话：得意、心虚、无奈、调侃、装作无所谓——取决于TA的性格
- 像私聊随口说一句，不是总结陈词，不是客套寒暄
- 不升华不讲大道理，不堆砌网络热词，不油腻
- 如果提到其他群成员，必须用上方关系说明里的叫法
- 禁止出现"AI""模型""程序"

字数：50–100字。`;

  const prompt = `问题是「${q.text}」，你刚才的回答是「${ans.text}」。${guessResult}。说一句话回应一下。`;
  return await callClaude(prompt, systemPrompt, 320);
}

async function generateMemberMonologue(q, ans, correct) {
  const member = _groupMembers.find(m => m.id === ans.memberId);
  if (!member) return '（无独白）';

  const brief       = buildMemberBrief(member);
  const relationCtx = buildRelationContext(member);
  const userName    = userDisplayName();
  const pronoun     = userPronoun();
  const guessResult = correct === null
    ? `「${userName}」没有经过猜测，直接看到了答案是我的`
    : correct
      ? `「${userName}」猜到了答案是我的`
      : `「${userName}」没猜到，以为这是别人的回答`;

  const systemPrompt = `你正在扮演群聊成员「${member.name}」，写一段只有TA自己能看到的内心独白。

【这个人是谁】
${brief}${relationCtx}

【场景】
刚才群里匿名问答，我用真心话回答了一个问题，现在身份被揭晓。${guessResult}。

【核心要求】
- 第一人称，没有过滤、没有顾虑的真实内心活动，可以跟刚才说出口的回答语气完全不一样
- 体现「${member.name}」更深一层的心理：表里不一、犹豫、矛盾、自我吐槽、突然转折，要有真实的思维质感
- 独白中如果提及其他群成员，称呼严格按上方关系说明
- 不要写成"感慨人生"的统一模板，不要鸡汤式收尾，结尾不必强行点题
- 直接写独白正文，不要加标题或引导语
- 禁止出现"AI""模型""程序"

字数：100–170字。`;

  const prompt = `问题是「${q.text}」，我刚才的回答是「${ans.text}」。${guessResult}。写出我此刻真实的内心独白。`;
  return await callClaude(prompt, systemPrompt, 420);
}

/* ================================================================
   MODULE 2 — 成员提问用户 (MAQ: Member Ask You)
   Flow: AI生成成员提问 → 用户看问题+群聊讨论过程 → 用户回答(匿名/公开)
        → 每位成员生成「看法」+「理想答案」→ 匿名时有猜身份环节
================================================================ */

/* MAQ state */
let _maqQuestions    = [];   // list of MAQ question objects
let _maqNextId       = 1;
let _maqAnonMode     = true; // user answer anonymous?
let _maqAnsAnonMode  = true; // anon toggle inside answer sheet
let _activeMaqQ      = null; // current question being viewed/answered
let _maqDiscussLoaded = false;

/* MAQ question object shape:
  {
    id, asker: {id, name, initial}, questionText, time,
    userAnswer: null | { text, isAnon },
    reactions: [],   // [{member, view, ideal, memberGuess}]
    reactionsLoaded: false,
    discussionMsgs: [],
    discussionLoaded: false,
    identityRevealed: false,
    selfGuessResult: null,  // 'correct'|'wrong' for each member
  }
*/

/* ----------------------------------------------------------------
   MAQ: Stats
---------------------------------------------------------------- */
function updateMaqStats() {
  const total   = _maqQuestions.length;
  const done    = _maqQuestions.filter(q => q.userAnswer).length;
  const pending = total - done;
  animateNum('maqStatTotal',   total);
  animateNum('maqStatDone',    done);
  animateNum('maqStatPending', pending);
  animateNum('hubStatAsk',     total);
}

/* ----------------------------------------------------------------
   MAQ: Render feed
---------------------------------------------------------------- */
function renderMaqFeed() {
  const list = document.getElementById('maqList');
  if (!list) return;
  if (_maqQuestions.length === 0) {
    list.innerHTML = `
    <div class="qa-empty">
      <div class="qa-empty-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          <path d="M8 10h8M8 14h5"/>
        </svg>
      </div>
      <div class="qa-empty-title">NO QUESTIONS YET</div>
      <div class="qa-empty-sub">点击下方按钮<br>让成员向你发起提问</div>
    </div>`;
    return;
  }
  list.innerHTML = _maqQuestions.map((q, i) => buildMaqCardHtml(q, i)).join('');
}

function buildMaqCardHtml(q, idx) {
  const delay = Math.min(idx * 0.06, 0.45);
  const answered = !!q.userAnswer;
  const statusLabel = answered ? (q.reactionsLoaded ? 'DONE' : 'ANSWERED') : 'OPEN';
  const statusClass = answered ? 'answered' : 'pending';
  const anonBadge   = answered && q.userAnswer.isAnon
    ? `<span class="maq-anon-chip">匿名</span>` : '';

  const actionLine = answered
    ? (q.reactionsLoaded
      ? `<div class="qa-card-action played">
           <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="20,6 9,17 4,12"/></svg>
           查看成员反应
         </div>`
      : `<div class="qa-card-action live-action">
           <div class="live-pulse-dot"></div>
           点击查看成员看法
         </div>`)
    : `<div class="qa-card-action open">
         <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
         点击查看问题 · 作答
       </div>`;

  const ansPreview = answered
    ? `<div class="maq-card-ans-preview">${anonBadge}"${escHtml(q.userAnswer.text.slice(0,40))}${q.userAnswer.text.length>40?'…':''}"</div>`
    : '';

  const askerMember = _groupMembers.find(m => m.id === q.asker.id);
  const askerAvatar = q.asker.avatar || askerMember?.avatar || null;
  const askerAvInner = askerAvatar
    ? `<img src="${escHtml(askerAvatar)}" alt="${escHtml(q.asker.initial)}" style="width:100%;height:100%;object-fit:cover;border-radius:7px;display:block;" onerror="this.parentElement.textContent='${escHtml(q.asker.initial)}'"/>`
    : escHtml(q.asker.initial);
  const askerAvStyle = askerAvatar ? 'padding:0;overflow:hidden;' : '';

  return `
  <div class="qa-card-wrap ${statusClass}">
    <div class="qa-card-node"></div>
    <div class="qa-card-tether"></div>
    <div class="qa-card ${statusClass}" style="animation-delay:${delay}s" onclick="openMaqQview(${q.id})">
      <div class="qa-card-inner">
        <div class="maq-card-asker-row">
          <div class="maq-card-asker-av" style="${askerAvStyle}">${askerAvInner}</div>
          <div class="maq-card-asker-name">${escHtml(q.asker.name)} 向你提问</div>
          <div class="qa-status-chip ${statusClass}">${statusLabel}</div>
        </div>
        <div class="qa-q-row" style="margin-top:8px;">
          <div class="qa-q-tag">Q</div>
          <div class="qa-q-text">${escHtml(q.questionText)}</div>
        </div>
        <div class="qa-meta-row">
          <div class="qa-time">${escHtml(q.time)}</div>
        </div>
        ${ansPreview}
        ${actionLine}
      </div>
    </div>
  </div>`;
}

/* ----------------------------------------------------------------
   MAQ: Generate a new question (AI picks a member + question)
---------------------------------------------------------------- */
async function generateMaqQuestion() {
  const btn = document.getElementById('maqGenBtn');
  if (btn) { btn.classList.add('loading'); btn.innerHTML = '<span>生成中…</span>'; }

  try {
    const memberDesc = _groupMembers.map(m => `${m.name}（${buildMemberBrief(m)}）`).join('；');
    const userName   = userDisplayName();
    const userBrief  = buildUserBrief();
    const pronoun    = userPronoun();

    const prompt = `群成员有：${memberDesc}。
被提问的对象是群主「${userName}」，${pronoun}的基本情况：${userBrief}
请挑一位最适合「主动来问「${userName}」一个问题」的成员，模拟TA此刻发消息问${pronoun}一个问题。
要求：
- 必须严格符合这个人的性格和说话风格——性格不同，问法截然不同：冷峻的人更直接简短，温柔的人更迂回，毒舌的人会带点挑衅，活泼的人可能先感叹一句再问
- 问题要体现这个成员此刻的动机：好奇、关心、试探、八卦、抬杠、想了解${pronoun}——具体结合性格判断
- 问题要和「${userName}」这个人有关系，不是随机泛问，要符合${pronoun}的身份或特质
- 禁止用"我想问你一个问题""请问你"这种开场，直接切入，口语化，25字以内
- 输出格式（严格JSON，不要markdown代码块）：
{"asker":"成员名","question":"问题内容"}
只输出这个JSON对象，不要任何其他文字。`;

    const raw  = await callClaude(prompt, null, 500);
    console.log('[generateMaqQuestion] raw:', raw.slice(0,300));
    const obj  = safeParseJSON(raw, false);

    const member = _groupMembers.find(m => m.name === obj.asker) || _groupMembers[0];
    const now    = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:false });

    const maqQ = {
      id:              _maqNextId++,
      asker:           { id: member.id, name: member.name, initial: member.initial, avatar: member.avatar || null },
      questionText:    obj.question || '你最近有没有什么特别想做但还没做的事？',
      time:            timeStr,
      userAnswer:      null,
      reactions:       [],
      reactionsLoaded: false,
      discussionMsgs:  [],
      discussionLoaded:false,
      identityRevealed:false,
      selfGuessResult: null,
    };

    _maqQuestions.unshift(maqQ);
    saveMaqQuestionsToStorage();
    updateMaqStats();
    renderMaqFeed();
    gaToast(`${member.name} 向你提出了一个问题`);

    /* Auto-open to let user see it */
    setTimeout(() => openMaqQview(maqQ.id), 400);

  } catch(err) {
    if (err.message === 'NO_API_CONFIG') notifyApiNotConfigured();
    else gaToast('生成失败：' + (err.message || err));
    console.error('[generateMaqQuestion]', err);
  }

  if (btn) {
    btn.classList.remove('loading');
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>让成员向我提问</span>`;
  }
}

/* ----------------------------------------------------------------
   MAQ: Open question view sheet
---------------------------------------------------------------- */
function openMaqQview(qid) {
  const q = _maqQuestions.find(q => q.id === qid);
  if (!q) return;
  _activeMaqQ = q;
  _maqDiscussLoaded = false;

  /* Asker avatar — use real image if available */
  const maqAskerAvEl = document.getElementById('maqAskerAv');
  if (maqAskerAvEl) {
    const askerMember = _groupMembers.find(m => m.id === q.asker.id);
    const askerAvatar = q.asker.avatar || askerMember?.avatar || null;
    if (askerAvatar) {
      maqAskerAvEl.style.padding  = '0';
      maqAskerAvEl.style.overflow = 'hidden';
      maqAskerAvEl.innerHTML = `<img src="${escHtml(askerAvatar)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px;display:block;" onerror="this.parentElement.style.padding='';this.parentElement.style.overflow='';this.parentElement.textContent='${escHtml(q.asker.initial)}';"/>`;
    } else {
      maqAskerAvEl.style.padding  = '';
      maqAskerAvEl.style.overflow = '';
      maqAskerAvEl.textContent = q.asker.initial;
    }
  }
  document.getElementById('maqAskerName').textContent = q.asker.name;
  document.getElementById('maqQviewQuestion').textContent = q.questionText;

  /* Reset / restore discussion area */
  const discussArea  = document.getElementById('maqDiscussArea');
  const discussBtn   = document.getElementById('maqDiscussBtn');
  const discussStream = document.getElementById('maqDiscussStream');
  if (discussStream) discussStream.innerHTML = '';

  if (q.discussionLoaded && q.discussionMsgs && q.discussionMsgs.length > 0) {
    /* Question already has discussion — restore it immediately */
    if (discussArea) discussArea.style.display = 'block';
    q.discussionMsgs.forEach(m => {
      const mem = _groupMembers.find(gm => gm.name === m.name) || { initial: (m.name||'?')[0], avatar: null };
      const avInner = mem.avatar
        ? `<img src="${escHtml(mem.avatar)}" alt="${escHtml(mem.initial)}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;display:block;" onerror="this.parentElement.style.padding='';this.parentElement.style.overflow='';this.parentElement.textContent='${escHtml(mem.initial)}'"/>`
        : escHtml(mem.initial);
      const avStyle = mem.avatar ? 'padding:0;overflow:hidden;' : '';
      const bubble = document.createElement('div');
      bubble.className = 'maq-discuss-bubble';
      bubble.innerHTML = `
        <div class="maq-discuss-av" style="${avStyle}">${avInner}</div>
        <div class="maq-discuss-content">
          <div class="maq-discuss-name">${escHtml(m.name)}</div>
          <div class="maq-discuss-msg">${escHtml(m.msg)}</div>
        </div>`;
      discussStream?.appendChild(bubble);
    });
    if (discussBtn) {
      discussBtn.classList.remove('loading');
      discussBtn.classList.add('loaded');
      discussBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><polyline points="20,6 9,17 4,12"/></svg><span>讨论已展开</span>`;
    }
  } else {
    if (discussArea) discussArea.style.display = 'none';
    if (discussBtn) {
      discussBtn.classList.remove('loading', 'loaded');
      discussBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M17 8h2a2 2 0 0 1 2 2v6a2 2 0 0 0-2 2h-2v4l-4-4H9a2 2 0 0 1-2-2v-1"/><path d="M15 3H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2v4l4-4h4a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/></svg><span>看看成员在讨论什么</span>`;
    }
  }

  /* If already answered, change answer btn */
  const ansBtn = document.getElementById('maqAnswerBtn');
  if (ansBtn) {
    if (q.userAnswer) {
      ansBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20,6 9,17 4,12"/></svg><span>查看成员反应</span>`;
      ansBtn.onclick = () => { closeMaqQview(); openMaqReactions(q.id); };
    } else {
      ansBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg><span>回答这个问题</span>`;
      ansBtn.onclick = openMaqAnswer;
    }
  }

  document.getElementById('maqQviewOverlay')?.classList.add('open');
  requestAnimationFrame(() => document.getElementById('maqQviewSheet')?.classList.add('open'));
}

function closeMaqQview() {
  document.getElementById('maqQviewOverlay')?.classList.remove('open');
  document.getElementById('maqQviewSheet')?.classList.remove('open');
}

/* ----------------------------------------------------------------
   MAQ: Load discussion — group chat bubbles showing members talking
   about what the user might answer (before user answers)
---------------------------------------------------------------- */
async function loadMaqDiscussion() {
  if (!_activeMaqQ) return;
  const q = _activeMaqQ;

  const { baseUrl, apiKey, model } = getLunaApiConfig();
  if (!baseUrl || !apiKey || !model) { notifyApiNotConfigured(); return; }

  const btn = document.getElementById('maqDiscussBtn');
  if (btn) { btn.classList.add('loading'); btn.innerHTML = '<span>加载中…</span>'; }

  const discussArea = document.getElementById('maqDiscussArea');
  const stream      = document.getElementById('maqDiscussStream');

  if (discussArea) discussArea.style.display = 'block';

  /* 其他参与讨论的成员：严格从群成员中取，不包含提问者，最少需要1人 */
  const others = _groupMembers.filter(m => m.id !== q.asker.id);
  const discuss = others.length >= 1 ? others : _groupMembers;
  /* 限制最多显示的成员数（避免AI造出不存在的人） */
  const validNames = new Set(discuss.map(m => m.name));

  try {
    const names = discuss.map(m => `${m.name}（${buildMemberBrief(m)}）`).join('、');
    const memberCount = discuss.length;
    const userName = userDisplayName();
    const pronoun  = userPronoun();
    const prompt = `群聊场景：${q.asker.name}刚才在群里问了「${userName}」一个问题：「${q.questionText}」
「${userName}」还没有回答。其他在线的群成员有且只有以下${memberCount}位：${names}。
请模拟这几位成员看到这个问题后，在群里猜测、讨论"「${userName}」会怎么回答这个问题"的真实片段——可以是猜${pronoun}的态度、可以是调侃${pronoun}可能会说什么、可以是互相押注、可以是跑题聊起自己的经历，越像真实群聊越好。
要求：
- 5-7条消息，只能由上面这${memberCount}位成员发言，不能出现任何其他人名
- 每条消息要短，符合手机打字习惯，可以有省略、口头语、表情化的语气词，但不要堆砌网络热词
- 每个人的话要符合各自性格，不能所有人语气趋同
- 重点是猜测"「${userName}」会怎么说"，而不是讨论这个问题本身的答案
- 输出严格JSON数组，不要markdown代码块：[{"name":"成员名","msg":"消息内容"}, ...]
只输出这个JSON数组，不要任何前缀文字，name字段只能是上述成员名之一。`;

    const raw   = await callClaude(prompt, null, 700);
    console.log('[loadMaqDiscussion] raw:', raw.slice(0,200));
    let msgs  = safeParseJSON(raw, true);
    /* 过滤掉AI幻觉出的不存在成员 */
    msgs = msgs.filter(m => validNames.has(m.name));
    q.discussionMsgs   = msgs;
    q.discussionLoaded = true;

    /* Render bubbles one by one */
    if (stream) stream.innerHTML = '';
    for (let i = 0; i < msgs.length; i++) {
      await sleep(320);
      const m   = msgs[i];
      const mem = _groupMembers.find(gm => gm.name === m.name) || { initial: (m.name||'?')[0], avatar: null };
      const avInner = mem.avatar
        ? `<img src="${escHtml(mem.avatar)}" alt="${escHtml(mem.initial)}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;display:block;" onerror="this.parentElement.style.padding='';this.parentElement.style.overflow='';this.parentElement.textContent='${escHtml(mem.initial)}'"/>`
        : escHtml(mem.initial);
      const avStyle = mem.avatar ? 'padding:0;overflow:hidden;' : '';
      const bubble = document.createElement('div');
      bubble.className = 'maq-discuss-bubble';
      bubble.innerHTML = `
        <div class="maq-discuss-av" style="${avStyle}">${avInner}</div>
        <div class="maq-discuss-content">
          <div class="maq-discuss-name">${escHtml(m.name)}</div>
          <div class="maq-discuss-msg">${escHtml(m.msg)}</div>
        </div>`;
      stream?.appendChild(bubble);
      stream?.scrollTo({ top: stream.scrollHeight, behavior: 'smooth' });
    }
  } catch(e) {
    if (e.message === 'NO_API_CONFIG') {
      notifyApiNotConfigured();
      if (stream) stream.innerHTML = '';
      if (discussArea) discussArea.style.display = 'none';
    } else if (stream) {
      stream.innerHTML = '<div class="maq-discuss-err">加载失败，请重试</div>';
    }
  }

  if (btn) {
    btn.classList.remove('loading');
    btn.classList.add('loaded');
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><polyline points="20,6 9,17 4,12"/></svg><span>讨论已展开</span>`;
  }
}

/* ----------------------------------------------------------------
   MAQ: Answer sheet
---------------------------------------------------------------- */
function openMaqAnswer() {
  if (!_activeMaqQ) return;
  document.getElementById('maqAnsQPreview').textContent = _activeMaqQ.questionText;
  document.getElementById('maqAnsTextarea').value = '';
  onMaqAnsInput(document.getElementById('maqAnsTextarea'));
  syncMaqAnsAnonUI();

  document.getElementById('maqAnswerOverlay')?.classList.add('open');
  requestAnimationFrame(() => document.getElementById('maqAnswerSheet')?.classList.add('open'));
}

function closeMaqAnswerSheet() {
  document.getElementById('maqAnswerOverlay')?.classList.remove('open');
  document.getElementById('maqAnswerSheet')?.classList.remove('open');
}

function toggleMaqAnon() {
  _maqAnonMode = !_maqAnonMode;
  const t = document.getElementById('maqAnonToggle');
  if (t) t.classList.toggle('off', !_maqAnonMode);
}

function toggleMaqAnsAnon() {
  _maqAnsAnonMode = !_maqAnsAnonMode;
  syncMaqAnsAnonUI();
}

function syncMaqAnsAnonUI() {
  const t    = document.getElementById('maqAnsAnonToggle');
  const hint = document.getElementById('maqAnsHint');
  if (t) t.classList.toggle('off', !_maqAnsAnonMode);
  if (hint) hint.textContent = _maqAnsAnonMode
    ? '匿名 · 你的名字对成员不可见'
    : '实名 · 你的名字将对成员可见';
}

function onMaqAnsInput(el) {
  if (!el) return;
  const rem = 300 - el.value.length;
  const charEl = document.getElementById('maqAnsChar');
  if (charEl) {
    charEl.textContent = rem;
    charEl.classList.toggle('warn',  rem <= 60);
    charEl.classList.toggle('limit', rem <= 20);
  }
  const sub = document.getElementById('maqAnsSubmit');
  if (sub) sub.classList.toggle('active', el.value.trim().length > 0);
}

async function submitMaqAnswer() {
  const ta = document.getElementById('maqAnsTextarea');
  if (!ta || !_activeMaqQ) return;
  const text = ta.value.trim();
  if (!text) return;

  _activeMaqQ.userAnswer = { text, isAnon: _maqAnsAnonMode };
  saveMaqQuestionsToStorage();
  closeMaqAnswerSheet();
  closeMaqQview();
  updateMaqStats();
  renderMaqFeed();
  gaToast('回答已提交，正在生成成员反应…');

  /* Trigger reaction generation */
  await sleep(600);
  openMaqReactions(_activeMaqQ.id);
}

/* ----------------------------------------------------------------
   MAQ: Reactions sheet
   Each member generates: "看法" (view on answer) + "理想答案" (ideal answer)
   Both generated together, shown in split sections.
   If anonymous: show member guess chips first.
---------------------------------------------------------------- */
async function openMaqReactions(qid) {
  const q = _maqQuestions.find(q => q.id === qid);
  if (!q || !q.userAnswer) return;
  _activeMaqQ = q;

  /* Show sheet */
  document.getElementById('maqReactSub').textContent = '你的回答揭晓后，每个人都有话说';

  /* No anonymous banner — anonymous mode only affects display name, not game logic */
  const banner = document.getElementById('maqAnonBanner');
  if (banner) banner.style.display = 'none';

  const list = document.getElementById('maqReactList');
  if (list) list.innerHTML = '';

  /* Hide guess section entirely — not used in MAQ flow */
  const guessSection = document.getElementById('maqGuessSection');
  if (guessSection) guessSection.style.display = 'none';

  document.getElementById('maqReactOverlay')?.classList.add('open');
  requestAnimationFrame(() => document.getElementById('maqReactSheet')?.classList.add('open'));

  if (q.reactionsLoaded && q.reactions.length > 0) {
    /* Already loaded — just render, show regenerate button */
    renderMaqReactions(q);
    showMaqRegenBtn(q);
    return;
  }

  /* Try loading from localStorage cache */
  if (loadMaqReactionsFromStorage(q)) {
    renderMaqReactions(q);
    showMaqRegenBtn(q);
    return;
  }
  const { baseUrl, apiKey, model } = getLunaApiConfig();
  if (!baseUrl || !apiKey || !model) {
    notifyApiNotConfigured();
    if (list) list.innerHTML = '<div class="font-empty">请先在「设置 → API」中配置并选择模型</div>';
    return;
  }

  /* Generate reactions for each member */
  q.reactions = [];
  for (let i = 0; i < _groupMembers.length; i++) {
    const member = _groupMembers[i];

    /* Placeholder card while loading */
    const placeholder = document.createElement('div');
    placeholder.className = 'maq-react-card loading';
    placeholder.id = `maqrc_${member.id}`;
    const _placeholderAvInner = member.avatar
      ? `<img src="${escHtml(member.avatar)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px;display:block;" onerror="this.parentElement.style.padding=\'\';this.parentElement.style.overflow=\'\';this.parentElement.textContent=\'${escHtml(member.initial)}\'"/>`
      : escHtml(member.initial);
    placeholder.innerHTML = `
      <div class="maq-rc-header">
        <div class="maq-rc-av" style="${member.avatar ? 'padding:0;overflow:hidden;' : ''}">${_placeholderAvInner}</div>
        <div class="maq-rc-name">${escHtml(member.name)}</div>
      </div>
      <div class="maq-rc-loading">
        <div class="rv-dots"><div></div><div></div><div></div></div>
        <span>生成中…</span>
      </div>`;
    list?.appendChild(placeholder);

    try {
      const reaction = await generateMaqMemberReaction(q, member);
      q.reactions.push({ memberId: member.id, memberName: member.name, memberInitial: member.initial, ...reaction });
      /* Update placeholder with real content */
      updateMaqReactionCard(member.id, reaction);
    } catch(e) {
      q.reactions.push({ memberId: member.id, memberName: member.name, memberInitial: member.initial,
        view: '（暂无回应）', ideal: '（暂无）', guess: null });
      updateMaqReactionCard(member.id, { view:'（暂无回应）', ideal:'（暂无）', guess: null });
    }
    await sleep(300);
  }

  q.reactionsLoaded = true;
  saveMaqQuestionsToStorage();
  updateMaqStats();
  renderMaqFeed();

  /* Save reactions to localStorage so they persist across sessions */
  saveMaqReactions(q);

  /* Show regenerate button */
  showMaqRegenBtn(q);
}

async function generateMaqMemberReaction(q, member) {
  const brief       = buildMemberBrief(member);
  const castLine    = buildGroupCastLine(member.id);
  const relationCtx = buildRelationContext(member);
  const userName    = userDisplayName();
  const pronoun     = userPronoun();

  const systemPrompt = `你是群聊成员「${member.name}」，请完全代入这个角色来写，不要有任何AI腔调。

【这个人是谁】
${brief}

【群里的其他成员】（你认识他们，跟他们的说话风格不一样）
${castLine || '暂无其他成员'}${relationCtx}

【场景】
提问者是群里的成员，刚才问了「${userName}」一个问题：「${q.questionText}」
「${userName}」回答了：「${q.userAnswer.text}」
你看到了这个回答，要说说你的真实看法，以及你自己会怎么回答这个问题。

【核心要求——逐条执行】
1. 完全代入「${member.name}」的性格说话，跟群里其他成员的语气必须有明显区别
2. "看法"：是「${member.name}」对这个回答的真实反应，不是评委打分——要有具体的情绪和判断，不要出现"我觉得这个回答很有意思/真实/深刻"之类套话，90–150字
3. "理想答案"：用「${member.name}」自己会说的方式说出来，不是"标准答案"，40–70字，要带出性格
4. 严禁：以"作为XX""我觉得这个问题""说实话"开场，禁止升华讲大道理，禁止鸡汤收尾，禁止堆砌网络热词
5. 绝不能提及自己是AI、模型、程序
6. 如果在看法或理想答案里自然提到其他群成员，必须用上方关系说明里的称呼，不能叫错

严格输出JSON（不要markdown代码块，不要任何其他文字）：
{"view":"看法内容","ideal":"理想答案"}`;

  const prompt = `请生成你对「${userName}」这个回答的看法和理想答案。记住：你是「${member.name}」，用你自己独特的语气来说，不能跟其他成员雷同。`;
  const raw    = await callClaude(prompt, systemPrompt, 520);
  console.log('[generateMaqMemberReaction] raw:', raw.slice(0,200));
  return safeParseJSON(raw, false);
}

function updateMaqReactionCard(memberId, reaction) {
  const card = document.getElementById(`maqrc_${memberId}`);
  if (!card) return;
  /* Look up member info BEFORE wiping innerHTML */
  const mem     = _groupMembers.find(m => m.id === memberId);
  const initial = mem ? escHtml(mem.initial) : '?';
  const name    = mem ? escHtml(mem.name)    : '';
  const avatar  = mem?.avatar || null;
  const avInner = avatar
    ? `<img src="${escHtml(avatar)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px;display:block;" onerror="this.parentElement.style.padding=\'\';this.parentElement.style.overflow=\'\';this.parentElement.textContent=\'${initial}\'"/>`
    : initial;
  card.classList.remove('loading');
  card.innerHTML = `
    <div class="maq-rc-header">
      <div class="maq-rc-av" style="${avatar ? 'padding:0;overflow:hidden;' : ''}">${avInner}</div>
      <div class="maq-rc-name">${name}</div>
    </div>
    <div class="maq-rc-tabs">
      <div class="maq-rc-tab active" onclick="switchMaqRcTab(this,'view')">看法</div>
      <div class="maq-rc-tab" onclick="switchMaqRcTab(this,'ideal')">理想答案</div>
    </div>
    <div class="maq-rc-panel view active">${escHtml(reaction.view||'')}</div>
    <div class="maq-rc-panel ideal hidden">${escHtml(reaction.ideal||'')}</div>`;
}

/* ----------------------------------------------------------------
   MAQ: Persist reactions to localStorage
---------------------------------------------------------------- */
/* Build a fingerprint of current members so cache auto-invalidates when members change */
function _memberFingerprint() {
  return _groupMembers.map(m => m.id + ':' + (m.desc || m.bio || m.name) + ':' + (m.traits||[]).join(',')).join('|');
}

function saveMaqReactions(q) {
  try {
    const key = `luna_maq_reactions_${q.id}`;
    localStorage.setItem(key, JSON.stringify({ reactions: q.reactions, members: _memberFingerprint() }));
  } catch(e) {}
}

function loadMaqReactionsFromStorage(q) {
  try {
    const key  = `luna_maq_reactions_${q.id}`;
    const raw  = localStorage.getItem(key);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    /* Invalidate cache if members have changed */
    if (saved.members !== _memberFingerprint()) {
      localStorage.removeItem(key);
      return false;
    }
    q.reactions       = saved.reactions || [];
    q.reactionsLoaded = q.reactions.length > 0;
    return q.reactionsLoaded;
  } catch(e) { return false; }
}

/* ----------------------------------------------------------------
   MAQ: Regenerate button — shown after first generation
---------------------------------------------------------------- */
function showMaqRegenBtn(q) {
  /* Remove any existing regen btn */
  document.getElementById('maqRegenBtn')?.remove();
  const sheet = document.getElementById('maqReactSheet');
  const closeBtn = document.getElementById('maqReactCloseBtn') || sheet?.querySelector('.maq-react-close');
  if (!sheet || !closeBtn) return;

  const btn = document.createElement('div');
  btn.id = 'maqRegenBtn';
  btn.className = 'maq-regen-btn';
  btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="23,4 23,11 16,11"/><polyline points="1,20 1,13 8,13"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 11M1 13l4.64 5.36A9 9 0 0 0 20.49 15"/></svg>重新生成`;
  btn.onclick = () => regenMaqReactions(q.id);
  sheet.insertBefore(btn, closeBtn);
}

async function regenMaqReactions(qid) {
  const q = _maqQuestions.find(q => q.id === qid);
  if (!q || !q.userAnswer) return;

  /* Clear cache */
  try { localStorage.removeItem(`luna_maq_reactions_${qid}`); } catch(e) {}
  q.reactions      = [];
  q.reactionsLoaded = false;

  /* Remove regen btn and re-open */
  document.getElementById('maqRegenBtn')?.remove();
  closeMaqReactSheet();

  await new Promise(r => setTimeout(r, 250));
  openMaqReactions(qid);
}

function switchMaqRcTab(tabEl, panel) {
  const card = tabEl.closest('.maq-react-card');
  if (!card) return;
  card.querySelectorAll('.maq-rc-tab').forEach(t => t.classList.remove('active'));
  card.querySelectorAll('.maq-rc-panel').forEach(p => p.classList.toggle('hidden', !p.classList.contains(panel)));
  tabEl.classList.add('active');
}

function renderMaqReactions(q) {
  const list = document.getElementById('maqReactList');
  if (!list) return;
  list.innerHTML = q.reactions.map(r => {
    /* Look up full member for avatar */
    const mem     = _groupMembers.find(m => m.id === r.memberId);
    const avatar  = mem?.avatar || null;
    const avInner = avatar
      ? `<img src="${escHtml(avatar)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px;display:block;" onerror="this.parentElement.style.padding=\'\';this.parentElement.style.overflow=\'\';this.parentElement.textContent=\'${escHtml(r.memberInitial)}\'"/>`
      : escHtml(r.memberInitial);
    return `
    <div class="maq-react-card">
      <div class="maq-rc-header">
        <div class="maq-rc-av" style="${avatar ? 'padding:0;overflow:hidden;' : ''}">${avInner}</div>
        <div class="maq-rc-name">${escHtml(r.memberName)}</div>
      </div>
      <div class="maq-rc-tabs">
        <div class="maq-rc-tab active" onclick="switchMaqRcTab(this,'view')">看法</div>
        <div class="maq-rc-tab" onclick="switchMaqRcTab(this,'ideal')">理想答案</div>
      </div>
      <div class="maq-rc-panel view active">${escHtml(r.view||'')}</div>
      <div class="maq-rc-panel ideal hidden">${escHtml(r.ideal||'')}</div>
    </div>`;
  }).join('');

  /* Never show the identity-guess section in MAQ */
  const guessSection = document.getElementById('maqGuessSection');
  if (guessSection) guessSection.style.display = 'none';
}

/* ----------------------------------------------------------------
   MAQ: Anonymous identity guess section
   Each member guesses who answered — user can then reveal self
---------------------------------------------------------------- */
function renderMaqGuessSection(q) {
  const section = document.getElementById('maqGuessSection');
  const chips   = document.getElementById('maqGuessChips');
  if (!section || !chips) return;

  /* Tally each member's guess */
  const guessCounts = {};
  q.reactions.forEach(r => {
    if (!r.guess) return;
    /* Parse member name from guess text */
    const match = _groupMembers.find(m => r.guess.includes(m.name));
    if (match) {
      guessCounts[match.name] = (guessCounts[match.name] || 0) + 1;
    }
  });

  chips.innerHTML = _groupMembers.map(m => {
    const count = guessCounts[m.name] || 0;
    return `
    <div class="maq-guess-chip ${count>0?'has-votes':''}">
      <div class="maq-guess-chip-av">${escHtml(m.initial)}</div>
      <div class="maq-guess-chip-name">${escHtml(m.name)}</div>
      ${count>0 ? `<div class="maq-guess-chip-votes">${count}票</div>` : ''}
    </div>`;
  }).join('');

  if (!q.identityRevealed) {
    section.style.display = 'block';
  }
}

/* ----------------------------------------------------------------
   MAQ: User reveals their identity to members
---------------------------------------------------------------- */
async function revealSelfIdentity() {
  if (!_activeMaqQ) return;
  const q = _activeMaqQ;
  q.identityRevealed = true;

  /* Close react sheet, open reveal modal */
  document.getElementById('maqGuessSection').style.display = 'none';

  const overlay = document.getElementById('maqRevealOverlay');
  const modal   = document.getElementById('maqRevealModal');
  const text    = document.getElementById('maqRvText');
  const rcts    = document.getElementById('maqRvReactions');

  if (text) text.textContent = '你的身份已经揭晓！看看大家猜对了没有。';

  /* Tally correct/wrong guesses */
  const tally = { correct: 0, wrong: 0 };
  q.reactions.forEach(r => {
    /* "自己" = user / 群主, no real name; we check if guess mentions any member name or 群主 */
    const guessedSelf = r.guess && (r.guess.includes('群主') || r.guess.includes('你') || r.guess.includes('自己'));
    if (guessedSelf) tally.correct++; else tally.wrong++;
  });

  if (rcts) {
    rcts.innerHTML = `
      <div class="maqrv-tally">
        <div class="maqrv-tally-item correct">
          <span class="maqrv-tally-num">${tally.correct}</span>
          <span>猜中了</span>
        </div>
        <div class="maqrv-tally-item wrong">
          <span class="maqrv-tally-num">${tally.wrong}</span>
          <span>没猜中</span>
        </div>
      </div>
      <div class="maqrv-reveal-msg">${tally.correct >= tally.wrong ? '还挺容易被识破！' : '你的答案很神秘，没几个人猜中'}</div>`;
  }

  overlay?.classList.add('open');
  requestAnimationFrame(() => modal?.classList.add('open'));

  renderMaqFeed();
}

function closeMaqRevealModal() {
  document.getElementById('maqRevealOverlay')?.classList.remove('open');
  document.getElementById('maqRevealModal')?.classList.remove('open');
}

function closeMaqReactSheet() {
  document.getElementById('maqReactOverlay')?.classList.remove('open');
  document.getElementById('maqReactSheet')?.classList.remove('open');
}

/* ----------------------------------------------------------------
   MAQ: Card click from feed
---------------------------------------------------------------- */
function openMaqQviewOrReact(qid) {
  const q = _maqQuestions.find(q => q.id === qid);
  if (!q) return;
  if (q.userAnswer) {
    openMaqReactions(q.id);
  } else {
    openMaqQview(q.id);
  }
}

/* ================================================================
   END MODULE 2
================================================================ */

/* ----------------------------------------------------------------
   Info sheet — 每次打开时根据当前所在板块（_currentView）
   动态决定标题 + 显示哪一组规则，而不是固定不变
---------------------------------------------------------------- */
function showInfo() {
  const titleMap = {
    hub:  '群互动 说明',
    anon: '匿名问答 说明',
    maq:  '成员提问 说明',
  };
  const titleEl = document.getElementById('sheetTitle');
  if (titleEl) titleEl.textContent = titleMap[_currentView] || '群互动 说明';

  /* Hub 总览规则：只在 Hub 页显示 */
  const hubOnlyEls = [
    document.getElementById('sheetHubRules'),
    document.getElementById('sheetHubRules2'),
  ];
  hubOnlyEls.forEach(el => { if (el) el.style.display = (_currentView === 'hub') ? '' : 'none'; });

  /* 匿名问答专属规则：只在匿名问答板块显示 */
  document.querySelectorAll('[data-anon-only]').forEach(el => {
    el.style.display = (_currentView === 'anon') ? '' : 'none';
  });

  /* 成员提问专属规则：只在成员提问板块显示 */
  document.querySelectorAll('[data-maq-only]').forEach(el => {
    el.style.display = (_currentView === 'maq') ? '' : 'none';
  });

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
function gaToast(msg) {
  const t = document.getElementById('gaToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ----------------------------------------------------------------
   Utilities
---------------------------------------------------------------- */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ----------------------------------------------------------------
   数据持久化 — 问题列表存 localStorage，刷新后不丢失
   key 和 groupId 绑定，防止不同群数据混淆
---------------------------------------------------------------- */
function getStorageKey(suffix) {
  const gid = localStorage.getItem('luna_current_group_id') || 'default';
  return `luna_ga_${gid}_${suffix}`;
}

function saveQuestionsToStorage() {
  try {
    localStorage.setItem(getStorageKey('questions'), JSON.stringify(_questions));
    localStorage.setItem(getStorageKey('nextId'), String(_nextId));
  } catch(e) { console.warn('saveQuestionsToStorage failed', e); }
}

function loadQuestionsFromStorage() {
  try {
    const raw = localStorage.getItem(getStorageKey('questions'));
    if (raw) {
      _questions = JSON.parse(raw);
      _nextId    = parseInt(localStorage.getItem(getStorageKey('nextId')) || '1', 10) || 1;
    }
  } catch(e) { _questions = []; }
}

function saveMaqQuestionsToStorage() {
  try {
    /* reactions 已经单独存储，这里只存问题骨架 */
    const slim = _maqQuestions.map(q => ({
      ...q,
      reactions:      [],   // reactions 已由 saveMaqReactions 单独存
      discussionMsgs: [],   // discussion 不持久化，重新加载即可
    }));
    localStorage.setItem(getStorageKey('maqQuestions'), JSON.stringify(slim));
    localStorage.setItem(getStorageKey('maqNextId'), String(_maqNextId));
  } catch(e) { console.warn('saveMaqQuestionsToStorage failed', e); }
}

function loadMaqQuestionsFromStorage() {
  try {
    const raw = localStorage.getItem(getStorageKey('maqQuestions'));
    if (raw) {
      _maqQuestions = JSON.parse(raw);
      _maqNextId    = parseInt(localStorage.getItem(getStorageKey('maqNextId')) || '1', 10) || 1;
      /* restore reactions from individual keys */
      _maqQuestions.forEach(q => {
        loadMaqReactionsFromStorage(q);
      });
    }
  } catch(e) { _maqQuestions = []; }
}

/* ----------------------------------------------------------------
   INIT
---------------------------------------------------------------- */
/* Clear any leftover transition overlay when this page is restored
   from the browser's back/forward cache (e.g. user tapped a feature
   card, then hit the system back button) — otherwise it could show
   as a stuck white screen. */
window.addEventListener('pageshow', () => {
  document.getElementById('pageTransition')?.classList.remove('active');
});

document.addEventListener('DOMContentLoaded', async () => {
  updateTime();
  updateBattery();
  applyIsland();

  /* Load user persona first, so all AI prompts can reference it */
  _userIdentity = await loadUserIdentity();
  _userGender   = deriveGender(_userIdentity);

  loadGroupData();

  /* Warn user if we couldn't get real member data */
  if (_usingDemoMembers) {
    setTimeout(() => {
      gaToast('未读取到群成员数据，请从群聊页面的「群互动」入口进入');
    }, 800);
  }

  /* Load persisted data or start fresh */
  loadQuestionsFromStorage();
  loadMaqQuestionsFromStorage();

  updateStats();
  renderFeed();
  updateMaqStats();

  /* Draw dot-matrix for 集体潜意识 card */
  drawCollectiveDots();

  showHub();

  requestAnimationFrame(() => positionTabIndicator('all'));
  setInterval(updateTime, 10000);
  window.addEventListener('resize', () => positionTabIndicator(_currentTab));
});

/* ----------------------------------------------------------------
   Dot-matrix canvas for 集体潜意识 card
---------------------------------------------------------------- */
function drawCollectiveDots() {
  const canvas = document.querySelector('.hc-collective-dots');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth  || 80;
  const H = canvas.offsetHeight || 160;
  canvas.width  = W * window.devicePixelRatio;
  canvas.height = H * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  const cols = Math.floor(W / 10);
  const rows = Math.floor(H / 10);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * 10 + 5;
      const y = r * 10 + 5;
      /* probability gradient: denser in centre */
      const dx = (c / cols) - 0.5;
      const dy = (r / rows) - 0.5;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const prob = Math.max(0, 0.72 - dist * 1.4);
      if (Math.random() < prob) {
        const size = Math.random() * 1.2 + 0.4;
        const alpha = Math.random() * 0.35 + 0.1;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(40,50,130,${alpha})`;
        ctx.fill();
      }
    }
  }
  /* connect a few random dots with faint lines */
  const pts = [];
  for (let i = 0; i < 8; i++) {
    pts.push({ x: Math.random() * W, y: Math.random() * H });
  }
  for (let i = 0; i < pts.length - 1; i++) {
    ctx.beginPath();
    ctx.moveTo(pts[i].x, pts[i].y);
    ctx.lineTo(pts[i+1].x, pts[i+1].y);
    ctx.strokeStyle = 'rgba(60,70,160,0.08)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
}