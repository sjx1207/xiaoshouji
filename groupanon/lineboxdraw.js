/* ================================================================
   台词盲盒 — Line Blind Box
   独立页面逻辑；沿用 groupanon 系列的状态栏 / AI 调用 / 数据读取约定
================================================================ */

/* ----------------------------------------------------------------
   Demo cast — 当没有群数据时的兜底角色（与 groupanon DEMO_MEMBERS 对齐风格）
---------------------------------------------------------------- */
const LB_DEMO_MEMBERS = [
  { id: 'm1', name: '阿澈', initial: '澈', bio: '嘴硬心软，习惯用调侃掩饰认真，讲话节奏快。' },
  { id: 'm2', name: '林见', initial: '见', bio: '话少但观察细，擅长一针见血，情绪不外露。' },
  { id: 'm3', name: '桃子', initial: '桃', bio: '情绪外放，喜欢加戏，说话带表演欲。' },
  { id: 'm4', name: '老K', initial: 'K',  bio: '年长稳重，说话慢半拍，习惯先叹气再说重点。' },
];

let _lbMembers = [];
let _lbUsingDemo = false;
let _lbUser = null; // 用户自己的人设，用来让演绎"对着用户来"，而不是 NPC 互相演给对方看

let _lbTheme = '';
let _lbTakeCount = 0;
let _lbHistory = [];          // { theme, line, mood, scene }
let _lbCurrentLine = null;    // { text, mood, scene }
let _lbCast = [];             // 当前这一轮参与演绎的成员列表（不含用户）
let _lbCastState = {};        // memberId -> 'waiting' | 'acting' | 'done' | 'cut'
let _lbPerfData = {};         // memberId -> { performance, note, sentences[], cut: bool }
let _lbActingIndex = -1;      // 当前正在演绎的成员在 _lbCast 中的下标
let _lbCurrentActorId = null; // 回看弹层里正在查看的成员

/* 舞台逐句推进状态 */
let _lbScriptSentences = [];  // 当前在台上这个人的台词，按句拆分
let _lbScriptCursor = -1;     // 当前展示到第几句（-1 表示还没开始）
let _lbScriptLoaded = false;  // 当前这个人的演绎内容是否已经生成完毕

/* ----------------------------------------------------------------
   Status bar clock / battery — 与 groupanon 一致的轻量实现
---------------------------------------------------------------- */
function updateTime() {
  const el = document.getElementById('statusTime');
  if (!el) return;
  const now = new Date();
  let h = now.getHours(), m = now.getMinutes();
  const ampmH = h % 12 === 0 ? 12 : h % 12;
  el.textContent = `${ampmH}:${m < 10 ? '0' + m : m}`;
}
function updateBattery() {
  const pct = 60 + Math.floor(Math.random() * 35);
  const pctEl = document.getElementById('batPct');
  const innerEl = document.getElementById('batInner');
  if (pctEl) pctEl.textContent = pct;
  if (innerEl) innerEl.style.width = pct + '%';
}
updateTime();
updateBattery();
setInterval(updateTime, 30000);

/* ----------------------------------------------------------------
   加载群成员数据（复用 groupanon 系列写入的 key）
---------------------------------------------------------------- */
function loadLbMembers() {
  _lbUsingDemo = false;
  try {
    const raw = localStorage.getItem('luna_groupanon_data')
             || localStorage.getItem('luna_group_data')
             || localStorage.getItem('luna_groupchat_data');
    if (raw) {
      const data = JSON.parse(raw);
      const members = data.members && data.members.length > 0 ? data.members : null;
      if (members) {
        _lbMembers = members.map(m => ({
          ...m,
          initial: m.initial || (m.name ? m.name[0] : '?'),
          avatar:  m.avatar  || m.avatarUrl || m.icon || null,
        }));
      } else {
        _lbMembers = LB_DEMO_MEMBERS;
        _lbUsingDemo = true;
      }
    } else {
      _lbMembers = LB_DEMO_MEMBERS;
      _lbUsingDemo = true;
    }
  } catch (e) {
    _lbMembers = LB_DEMO_MEMBERS;
    _lbUsingDemo = true;
  }
  if (_lbMembers.length < 2) {
    _lbMembers = [..._lbMembers, ...LB_DEMO_MEMBERS].slice(0, 4);
    _lbUsingDemo = true;
  }
}
loadLbMembers();

/* ----------------------------------------------------------------
   加载用户自己的人设 —— 演绎的对手戏对象默认是"你"（导演/用户本人），
   不是群里的 NPC 互相演给对方看，所以必须知道"你"是谁
---------------------------------------------------------------- */
function loadLbUser() {
  const tryFields = (obj) => {
    if (!obj) return null;
    const u = obj.user || obj.userPersona || obj.myPersona || obj.protagonist
           || obj.currentUser || obj.userProfile || obj.me || obj.myself;
    if (u && typeof u === 'object' && (u.name || u.bio || u.description)) return u;
    return null;
  };
  let u = null;
  try {
    const raw = localStorage.getItem('luna_groupanon_data')
             || localStorage.getItem('luna_group_data')
             || localStorage.getItem('luna_groupchat_data');
    if (raw) u = tryFields(JSON.parse(raw));
  } catch (e) {}
  if (!u) {
    try {
      const rawUser = localStorage.getItem('luna_user_persona')
                    || localStorage.getItem('luna_user_profile')
                    || localStorage.getItem('luna_my_persona');
      if (rawUser) u = JSON.parse(rawUser);
    } catch (e) {}
  }
  _lbUser = {
    name:   (u && (u.name || u.nickname)) || '你',
    bio:    (u && (u.bio || u.description)) || '',
    gender: u && u.gender,
    age:    u && u.age,
    avatar: (u && (u.avatar || u.avatarUrl || u.icon)) || null,
  };
}
loadLbUser();

/* 历史记录持久化（仅本地，便于下次进入回顾） */
function loadLbHistory() {
  try {
    const raw = localStorage.getItem('luna_lineboxdraw_history');
    _lbHistory = raw ? JSON.parse(raw) : [];
  } catch (e) { _lbHistory = []; }
  renderLbHistory();
}
function saveLbHistory() {
  try { localStorage.setItem('luna_lineboxdraw_history', JSON.stringify(_lbHistory.slice(0, 12))); } catch (e) {}
}
function renderLbHistory() {
  const section = document.getElementById('lbHistorySection');
  const list = document.getElementById('lbHistoryList');
  if (!section || !list) return;
  if (_lbHistory.length === 0) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  list.innerHTML = _lbHistory.slice(0, 6).map(h => `
    <div class="lb-history-item" onclick="reuseHistoryTheme('${escHtml(h.theme)}')">
      <span class="lb-history-theme">${escHtml(h.theme)}</span>
      <span class="lb-history-line">${escHtml(h.line)}</span>
    </div>
  `).join('');
}
function reuseHistoryTheme(theme) {
  const input = document.getElementById('lbThemeInput');
  input.value = theme;
  onThemeInput(input);
  startDraw();
}
loadLbHistory();

/* ----------------------------------------------------------------
   主题输入区交互
---------------------------------------------------------------- */
function onThemeInput(el) {
  const remain = 24 - el.value.length;
  document.getElementById('lbInputChar').textContent = remain;
  const btn = document.getElementById('lbDrawBtn');
  btn.classList.toggle('ready', el.value.trim().length > 0);
  /* 手动输入时取消 chip 高亮 */
  document.querySelectorAll('.lb-chip.picked').forEach(c => {
    if (c.textContent !== el.value.trim()) c.classList.remove('picked');
  });
}
function onThemeKeydown(e) {
  if (e.key === 'Enter') {
    const btn = document.getElementById('lbDrawBtn');
    if (btn.classList.contains('ready')) startDraw();
  }
}
function pickChip(el) {
  document.querySelectorAll('.lb-chip').forEach(c => c.classList.remove('picked'));
  el.classList.add('picked');
  const input = document.getElementById('lbThemeInput');
  input.value = el.textContent;
  onThemeInput(input);
}

/* ----------------------------------------------------------------
   抽取流程：input → drawing → result
---------------------------------------------------------------- */
function switchStage(name) {
  ['Input', 'Drawing', 'Result'].forEach(s => {
    document.getElementById('stage' + s)?.classList.toggle('active', s.toLowerCase() === name);
  });
}

async function startDraw() {
  const input = document.getElementById('lbThemeInput');
  const theme = input.value.trim();
  if (!theme) { lbToast('先输入一个主题吧'); return; }
  _lbTheme = theme;

  /* 机器口出现卡片探头动画 */
  const peek = document.getElementById('lbmCardPeek');
  peek?.classList.add('peek');

  switchStage('drawing');
  document.getElementById('lbDrawingTheme').textContent = `《${theme}》`;
  const statusEl = document.getElementById('lbDrawingStatus');
  const statusMsgs = ['正在从台词库中抽取…', '匹配主题情绪中…', '打磨最后的措辞…'];
  let msgIdx = 0;
  statusEl.textContent = statusMsgs[0];
  const msgTimer = setInterval(() => {
    msgIdx = (msgIdx + 1) % statusMsgs.length;
    statusEl.textContent = statusMsgs[msgIdx];
  }, 900);

  try {
    const line = await generateBlindBoxLine(theme);
    clearInterval(msgTimer);
    peek?.classList.remove('peek');
    _lbCurrentLine = line;
    _lbTakeCount += 1;
    setupCastForNewTake();
    renderResultStage();
    switchStage('result');
    /* 记录历史 */
    _lbHistory.unshift({ theme, line: line.text });
    saveLbHistory();
  } catch (err) {
    clearInterval(msgTimer);
    peek?.classList.remove('peek');
    switchStage('input');
    if (err.message === 'NO_API_CONFIG') notifyLbApiNotConfigured();
    else lbToast('生成失败：' + (err.message || err));
  }
}

async function drawAgainSameTheme() {
  if (!_lbTheme) return;
  switchStage('drawing');
  document.getElementById('lbDrawingTheme').textContent = `《${_lbTheme}》`;
  document.getElementById('lbDrawingStatus').textContent = '再抽一张，主题不变…';
  try {
    const line = await generateBlindBoxLine(_lbTheme, true);
    _lbCurrentLine = line;
    _lbTakeCount += 1;
    setupCastForNewTake();
    renderResultStage();
    switchStage('result');
    _lbHistory.unshift({ theme: _lbTheme, line: line.text });
    saveLbHistory();
  } catch (err) {
    switchStage('result');
    if (err.message === 'NO_API_CONFIG') notifyLbApiNotConfigured();
    else lbToast('生成失败：' + (err.message || err));
  }
}

function backToInput() {
  switchStage('input');
}

/* ----------------------------------------------------------------
   结果页渲染：台词卡 + 候场头像条初始化
---------------------------------------------------------------- */
function setupCastForNewTake() {
  _lbCast = shuffleArrayLb(_lbMembers).slice(0, Math.min(_lbMembers.length, 4));
  _lbCastState = {};
  _lbPerfData = {};
  _lbCast.forEach(m => { _lbCastState[m.id] = 'waiting'; });
  _lbActingIndex = -1;
  document.getElementById('lbArchiveList').innerHTML = '';
  document.getElementById('lbArchiveSection').style.display = 'none';
}

function renderResultStage() {
  document.getElementById('lbTakeNum').textContent = String(_lbTakeCount).padStart(2, '0');
  document.getElementById('lbResultThemePill').textContent = `主题 · ${_lbTheme}`;
  const textEl = document.getElementById('llcLineText');
  textEl.textContent = '';
  typewriteLb('llcLineText', _lbCurrentLine.text);
  document.getElementById('llcMood').textContent = _lbCurrentLine.mood || '情绪未知';
  document.getElementById('llcScene').textContent = _lbCurrentLine.scene || '场景待定';
  renderCastStrip();
  /* 稍作停顿后请上第一位演员，给用户看清台词的时间 */
  setTimeout(() => { callNextPerformer(); }, 900);
}

/* 候场头像条 — 显示场序与当前状态 */
function renderCastStrip() {
  const strip = document.getElementById('lbCastStrip');
  strip.innerHTML = _lbCast.map((m) => {
    const state = _lbCastState[m.id];
    const cssState = state === 'acting' ? 'onstage' : state; /* JS 状态名与 CSS 类名对齐 */
    const avatarHtml = m.avatar
      ? `<img src="${escHtml(m.avatar)}" alt="${escHtml(m.name)}" />`
      : escHtml(m.initial || '?');
    return `
      <div class="lcs-item lcs-${cssState}">
        <div class="lcs-avatar-wrap">
          <div class="lcs-avatar">${avatarHtml}</div>
          <span class="lcs-dot"></span>
        </div>
        <div class="lcs-name">${escHtml(m.name)}</div>
      </div>
    `;
  }).join('');
}

/* ----------------------------------------------------------------
   舞台核心：请上下一位演员 → 生成完整演绎 → 拆句 → 等用户点击推进
---------------------------------------------------------------- */
async function callNextPerformer() {
  _lbActingIndex += 1;
  if (_lbActingIndex >= _lbCast.length) {
    showStageFinished();
    return;
  }
  const member = _lbCast[_lbActingIndex];
  _lbCastState[member.id] = 'acting';
  renderCastStrip();
  setStageButtonsEnabled(false);

  /* 舞台头像 / 姓名先出现，台词区显示加载态 */
  document.getElementById('lsbAvatar').innerHTML = member.avatar
    ? `<img src="${escHtml(member.avatar)}" alt="${escHtml(member.name)}" />`
    : escHtml(member.initial || '?');
  document.getElementById('lsbName').textContent = member.name;
  const tagEl = document.getElementById('lsbStatusTag');
  tagEl.className = 'lsb-status-tag';
  tagEl.textContent = '上场中';

  _lbScriptSentences = [];
  _lbScriptCursor = -1;
  _lbScriptLoaded = false;
  document.getElementById('lsbScriptLoading').style.display = 'flex';
  document.getElementById('lsbScriptLine').textContent = '';
  document.getElementById('lsbScriptLine').classList.add('empty');
  document.getElementById('lsbScriptProgress').innerHTML = '';
  const nextBtn = document.getElementById('lsbNextBtn');
  nextBtn.classList.add('disabled');
  nextBtn.classList.remove('finished');
  document.getElementById('lsbNextBtnText').textContent = '下一句';

  try {
    const perf = await generateActorPerformance(member, _lbCurrentLine, _lbTheme);
    /* 生成期间可能被喊卡 —— 检查状态是否仍为 acting */
    if (_lbCastState[member.id] !== 'acting') return;

    if (perf._parseFailed) {
      _lbCastState[member.id] = 'waiting';
      _lbActingIndex -= 1;
      renderCastStrip();
      document.getElementById('lsbScriptLoading').style.display = 'none';
      document.getElementById('lsbScriptLine').textContent = perf.performance;
      document.getElementById('lsbScriptLine').classList.remove('empty');
      const retryBtn = document.getElementById('lsbNextBtn');
      retryBtn.classList.remove('disabled');
      document.getElementById('lsbNextBtnText').textContent = '重新生成';
      retryBtn.onclick = () => { retryBtn.onclick = advanceScriptLine; callNextPerformer(); };
      setStageButtonsEnabled(false);
      return;
    }

    _lbPerfData[member.id] = perf;
    _lbScriptSentences = splitIntoSentences(perf.performance);
    _lbScriptLoaded = true;

    document.getElementById('lsbScriptLoading').style.display = 'none';
    renderScriptProgressDots();
    setStageButtonsEnabled(true);
    nextBtn.classList.remove('disabled');
    /* 自动展示第一句，之后交给用户点击推进 */
    advanceScriptLine();
  } catch (err) {
    if (_lbCastState[member.id] !== 'acting') return;
    _lbCastState[member.id] = 'waiting';
    _lbActingIndex -= 1;
    renderCastStrip();
    document.getElementById('lsbScriptLoading').style.display = 'none';
    document.getElementById('lsbScriptLine').textContent = '这段演绎生成失败了，点击下方按钮重新尝试。';
    document.getElementById('lsbScriptLine').classList.remove('empty');
    nextBtn.classList.remove('disabled');
    document.getElementById('lsbNextBtnText').textContent = '重新生成';
    nextBtn.onclick = () => { nextBtn.onclick = advanceScriptLine; callNextPerformer(); };
    setStageButtonsEnabled(true);
    if (err.message === 'NO_API_CONFIG') notifyLbApiNotConfigured();
    else lbToast('演绎生成失败：' + (err.message || err));
  }
}

/* 将演绎正文拆成句子，供用户逐句点击查看（正则按中文/英文句末标点切分） */
function splitIntoSentences(text) {
  if (!text) return [];
  const raw = text
    .replace(/([。！？…]+)/g, '$1\n')
    .replace(/(["」』])\n/g, '$1')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  return raw.length ? raw : [text];
}

function renderScriptProgressDots() {
  const wrap = document.getElementById('lsbScriptProgress');
  wrap.innerHTML = _lbScriptSentences.map((_, i) => `<span data-i="${i}"></span>`).join('');
}

function updateScriptProgressDots() {
  document.querySelectorAll('#lsbScriptProgress span').forEach((dot, i) => {
    dot.classList.toggle('lsp-active', i === _lbScriptCursor);
    dot.classList.toggle('lsp-passed', i < _lbScriptCursor);
  });
}

/* 用户点击「下一句」— 这是内容展示的主入口，而不是自动播放 */
function advanceScriptLine() {
  if (!_lbScriptLoaded || _lbScriptSentences.length === 0) return;
  _lbScriptCursor += 1;
  const lineEl = document.getElementById('lsbScriptLine');
  const nextBtn = document.getElementById('lsbNextBtn');

  if (_lbScriptCursor >= _lbScriptSentences.length) {
    /* 这个人的演绎已经看完 */
    _lbScriptCursor = _lbScriptSentences.length - 1;
    finishCurrentPerformer();
    return;
  }

  lineEl.classList.remove('empty');
  typewriteLb(null, _lbScriptSentences[_lbScriptCursor], lineEl);
  updateScriptProgressDots();

  const isLast = _lbScriptCursor === _lbScriptSentences.length - 1;
  document.getElementById('lsbNextBtnText').textContent = isLast ? '演绎完毕' : '下一句';
}

function finishCurrentPerformer() {
  const member = _lbCast[_lbActingIndex];
  if (!member) return;
  _lbCastState[member.id] = 'done';
  renderCastStrip();
  const tagEl = document.getElementById('lsbStatusTag');
  tagEl.className = 'lsb-status-tag tag-done';
  tagEl.textContent = '已谢幕';
  addToArchive(member, 'done');

  const nextBtn = document.getElementById('lsbNextBtn');
  nextBtn.classList.add('finished');
  document.getElementById('lsbNextBtnText').textContent = '请下一位登场';
  nextBtn.onclick = () => { nextBtn.onclick = advanceScriptLine; nextBtn.classList.remove('finished'); callNextPerformer(); };
}

function showStageFinished() {
  document.getElementById('lsbAvatar').innerHTML = '';
  document.getElementById('lsbName').textContent = '本场演绎已全部完成';
  const tagEl = document.getElementById('lsbStatusTag');
  tagEl.className = 'lsb-status-tag tag-done';
  tagEl.textContent = '谢幕';
  document.getElementById('lsbScriptLoading').style.display = 'none';
  document.getElementById('lsbScriptLine').textContent = '可以在下方回看每个人的演绎，或者再抽一张台词卡继续。';
  document.getElementById('lsbScriptLine').classList.remove('empty');
  document.getElementById('lsbScriptProgress').innerHTML = '';
  const nextBtn = document.getElementById('lsbNextBtn');
  nextBtn.classList.add('disabled');
  setStageButtonsEnabled(false);
  lbToast('全员演绎完毕，可以再抽一张试试');
}

function setStageButtonsEnabled(acting) {
  /* 喊卡/重来/换人 只在有人正演绎时可用；再抽一张随时可用 */
  document.getElementById('ldbCutBtn').classList.toggle('disabled', !acting);
  document.getElementById('ldbReshootBtn').classList.toggle('disabled', !acting && _lbActingIndex < 0);
  document.getElementById('ldbSwapBtn').classList.toggle('disabled', !acting);
}

/* 存入「已谢幕」列表，用户可以点击回看完整存档，这不是主展示路径 */
function addToArchive(member, kind) {
  const section = document.getElementById('lbArchiveSection');
  const list = document.getElementById('lbArchiveList');
  section.style.display = 'block';
  const perf = _lbPerfData[member.id];
  const preview = kind === 'cut'
    ? '这段被导演喊卡打断，没有演完'
    : (perf ? perf.performance.slice(0, 22) + '…' : '');
  const avatarHtml = member.avatar
    ? `<img src="${escHtml(member.avatar)}" alt="${escHtml(member.name)}" />`
    : escHtml(member.initial || '?');
  const badgeHtml = kind === 'cut' ? '<span class="lai-badge cut">已喊卡</span>' : '<span class="lai-badge done">已完成</span>';
  list.insertAdjacentHTML('afterbegin', `
    <div class="lb-archive-item" onclick="openActorSheet('${member.id}')">
      <div class="lai-avatar">${avatarHtml}</div>
      <div class="lai-info">
        <div class="lai-name">${escHtml(member.name)}</div>
        <div class="lai-preview">${escHtml(preview)}</div>
      </div>
      ${badgeHtml}
    </div>
  `);
}

/* ----------------------------------------------------------------
   导演控制：喊卡 / 重来 / 换人 / 再抽一张
   全部直接作用于「当前在台上的人」，不依赖任何弹窗
---------------------------------------------------------------- */
function directorCut() {
  const idx = _lbActingIndex;
  if (idx < 0 || idx >= _lbCast.length) { lbToast('当前没有人在台上'); return; }
  const member = _lbCast[idx];
  if (_lbCastState[member.id] !== 'acting') { lbToast('这位已经谢幕了'); return; }

  _lbCastState[member.id] = 'cut';
  renderCastStrip();
  const tagEl = document.getElementById('lsbStatusTag');
  tagEl.className = 'lsb-status-tag tag-cut';
  tagEl.textContent = '已喊卡';
  document.getElementById('lsbScriptLine').textContent = '导演喊了「卡」，这段演绎在这里停下。';
  document.getElementById('lsbScriptLine').classList.remove('empty');
  const nextBtn = document.getElementById('lsbNextBtn');
  nextBtn.classList.remove('disabled');
  nextBtn.classList.add('finished');
  document.getElementById('lsbNextBtnText').textContent = '请下一位登场';
  nextBtn.onclick = () => { nextBtn.onclick = advanceScriptLine; nextBtn.classList.remove('finished'); callNextPerformer(); };
  addToArchive(member, 'cut');
  setStageButtonsEnabled(false);
  lbToast(`喊卡！${member.name} 的这段先停在这里`);
}

function directorReshoot() {
  const idx = _lbActingIndex;
  if (idx < 0 || idx >= _lbCast.length) { lbToast('还没有可以重来的演绎'); return; }
  const member = _lbCast[idx];
  lbToast(`重来一次，${member.name} 再演一遍这句台词`);
  _lbActingIndex -= 1; /* callNextPerformer 会 +1，指回同一人 */
  callNextPerformer();
}

function directorSwap() {
  const idx = _lbActingIndex;
  if (idx < 0 || idx >= _lbCast.length) { lbToast('当前没有人在台上'); return; }
  const member = _lbCast[idx];
  if (_lbCastState[member.id] !== 'acting') { lbToast('当前没有正在进行的演绎可以换人'); return; }

  _lbCastState[member.id] = 'cut';
  renderCastStrip();
  addToArchive(member, 'cut');
  lbToast('换人！交给下一位继续');
  callNextPerformer();
}

/* ----------------------------------------------------------------
   谢幕回看弹层 — 仅用于回看已完成内容的存档，不是主展示路径
---------------------------------------------------------------- */
function openActorSheet(memberId) {
  const member = _lbCast.find(m => m.id === memberId) || _lbMembers.find(m => m.id === memberId);
  if (!member) return;
  _lbCurrentActorId = memberId;
  const perf = _lbPerfData[memberId];

  document.getElementById('lasAvatar').innerHTML = member.avatar
    ? `<img src="${escHtml(member.avatar)}" alt="${escHtml(member.name)}" />`
    : escHtml(member.initial || '?');
  document.getElementById('lasName').textContent = member.name;
  document.getElementById('lasRole').textContent = `《${_lbTheme}》台词演绎`;

  const state = _lbCastState[memberId];
  const badge = document.getElementById('lasStatusBadge');
  if (state === 'done') { badge.textContent = '已完成'; badge.style.background = '#ece9f2'; badge.style.color = '#9a93ac'; }
  else if (state === 'cut') { badge.textContent = '已中止'; badge.style.background = '#f1f1f3'; badge.style.color = '#8d8e90'; }
  else { badge.textContent = '演绎中'; badge.style.background = '#0a0a0a'; badge.style.color = '#fff'; }

  switchActorTab('line');
  document.getElementById('lasTextLine').textContent = perf ? perf.performance : '这段还没有留下记录。';
  document.getElementById('lasTextNote').textContent = perf ? (perf.note || '（本次没有额外的导演笔记）') : '';

  document.getElementById('lbActorOverlay').classList.add('open');
  document.getElementById('lbActorSheet').classList.add('open');
}
function closeActorSheet() {
  document.getElementById('lbActorOverlay').classList.remove('open');
  document.getElementById('lbActorSheet').classList.remove('open');
}
function switchActorTab(tab) {
  document.getElementById('lasTabLine').classList.toggle('active', tab === 'line');
  document.getElementById('lasTabNote').classList.toggle('active', tab === 'note');
  document.getElementById('lasPanelLine').classList.toggle('hidden', tab !== 'line');
  document.getElementById('lasPanelNote').classList.toggle('hidden', tab !== 'note');
}

/* ----------------------------------------------------------------
   规则说明弹层
---------------------------------------------------------------- */
function showRules() {
  document.getElementById('lbRulesOverlay').classList.add('open');
  document.getElementById('lbRulesSheet').classList.add('open');
}
function closeRules() {
  document.getElementById('lbRulesOverlay').classList.remove('open');
  document.getElementById('lbRulesSheet').classList.remove('open');
}

function handleBack() {
  if (document.getElementById('lbActorSheet')?.classList.contains('open')) { closeActorSheet(); return; }
  if (document.getElementById('lbRulesSheet')?.classList.contains('open')) { closeRules(); return; }
  const resultActive = document.getElementById('stageResult')?.classList.contains('active');
  if (resultActive) { backToInput(); return; }
  lbToast('返回上一级');
}

/* ----------------------------------------------------------------
   AI 调用 — 复用 groupanon 的接口配置约定
---------------------------------------------------------------- */
function getLbApiConfig() {
  let cur = {};
  try { cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}'); } catch (e) {}
  const baseUrl = (cur.baseUrl || '').trim().replace(/\/$/, '');
  const apiKey  = (cur.apiKey  || '').trim();
  const model   = (localStorage.getItem('luna_api_model') || cur.model || '').trim();
  return { baseUrl, apiKey, model };
}

async function callLbAI(prompt, systemPrompt, maxTokens) {
  const { baseUrl, apiKey, model } = getLbApiConfig();
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
    if (!reply) throw new Error('API 返回空内容，请重试');
  } else {
    const apiBase = baseUrl.replace(/\/v1$/, '') + '/v1';
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });
    res = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens || 500, temperature: 0.98 }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error('API error ' + res.status + (errText ? ': ' + errText.slice(0, 200) : ''));
    }
    data = await res.json();
    reply = data.choices?.[0]?.message?.content ?? '';
    if (!reply) {
      const errMsg = data.error?.message || '';
      throw new Error(errMsg ? 'API 错误：' + errMsg.slice(0, 100) : 'API 返回空内容，请重试');
    }
  }
  return reply.trim();
}

function notifyLbApiNotConfigured() {
  lbToast('请先在「设置 → API」中配置并选择模型');
}

/* ----------------------------------------------------------------
   生成盲盒台词 — 严格 JSON 输出，便于稳定解析
---------------------------------------------------------------- */
async function generateBlindBoxLine(theme, isRedraw) {
  const systemPrompt = `你是"台词盲盒"的台词库生成器，只负责写一句适合群聊角色扮演演绎的台词，不写任何解释。

【要求】
1. 台词要有画面感和戏剧张力，像剧本里的一句关键台词，不是口号也不是格言
2. 长度控制在 12-30 字之间，是一句完整的话，可以有停顿或省略号
3. 台词要能被"演绎"——留出语气、动作、潜台词的空间，而不是陈述句
4. 禁止出现主题词本身被生硬地塞进台词里，要意会而不是直说
5. 每次生成都要和已有的不一样，避免套路化的开头

只输出严格 JSON，不要任何前后缀、不要代码块标记：
{"text":"台词正文","mood":"两到四字的情绪标签，比如 克制/隐忍","scene":"三到六字的场景暗示，比如 深夜楼道口"}`;

  const prompt = isRedraw
    ? `主题依然是「${theme}」，但要抽一句和刚才完全不同的台词，风格可以换一个角度。`
    : `主题是「${theme}」，抽一句台词。`;

  const raw = await callLbAI(prompt, systemPrompt, 300);
  return parseLbLineJson(raw, theme);
}

function parseLbLineJson(raw, theme) {
  let cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();

  try {
    const obj = JSON.parse(cleaned);
    if (obj && obj.text) {
      return { text: String(obj.text).trim(), mood: String(obj.mood || '').trim(), scene: String(obj.scene || '').trim() };
    }
  } catch (e) { /* 继续尝试下一层 */ }

  const firstBrace = cleaned.indexOf('{');
  const lastBrace  = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const obj = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      if (obj && obj.text) {
        return { text: String(obj.text).trim(), mood: String(obj.mood || '').trim(), scene: String(obj.scene || '').trim() };
      }
    } catch (e) { /* 继续尝试下一层 */ }
  }

  const textMatch = cleaned.match(/"text"\s*:\s*"([\s\S]*?)"\s*,\s*"mood"/);
  if (textMatch) {
    return { text: unescapeJsonString(textMatch[1]), mood: '', scene: theme };
  }

  /* 彻底无法识别结构时，不把 JSON 原文糊上卡片，给出可读的占位文案 */
  return { text: '这句台词没能正常生成，点击「再抽一张」试试看。', mood: '', scene: theme };
}

/* ----------------------------------------------------------------
   生成角色演绎内容 — 演绎正文 + 导演笔记，各自不少于要求字数
   注：演绎正文与导演笔记合并一次请求，减少调用次数，同时保证内容分量
---------------------------------------------------------------- */
function buildLbMemberBrief(member) {
  if (member.bio) return member.bio;
  const parts = [];
  if (member.role) parts.push(`身份是${member.role}`);
  if (member.gender) parts.push(member.gender === 'male' ? '男生' : member.gender === 'female' ? '女生' : '');
  if (member.age) parts.push(`大约${member.age}岁`);
  if (Array.isArray(member.traits) && member.traits.length) parts.push(`性格特点：${member.traits.join('、')}`);
  return parts.length ? parts.join('，') : '一个性格鲜明、说话有辨识度的群聊成员。';
}

/* 用户自己的人设简介 —— 演绎的对手戏对象默认就是"你"，不是另一个 NPC */
function buildLbUserBrief() {
  const u = _lbUser || {};
  const parts = [];
  if (u.bio) parts.push(u.bio);
  if (u.gender === 'male') parts.push('男生');
  else if (u.gender === 'female') parts.push('女生');
  if (u.age) parts.push(`大约${u.age}岁`);
  return parts.length
    ? parts.join('，')
    : '身份没有更多设定，但TA是这个群的发起人，也是这场戏默认的对手戏对象。';
}

async function generateActorPerformance(member, line, theme) {
  const brief = buildLbMemberBrief(member);
  const userName = (_lbUser && _lbUser.name) || '你';
  const userBrief = buildLbUserBrief();
  const otherNames = _lbCast.filter(m => m.id !== member.id).map(m => m.name).join('、');
  const castNames = otherNames
    ? `${otherNames}（TA们此刻不是这段演绎的主要对象，最多作为场景里的背景存在，不要让演绎变成「${member.name}」和TA们之间的对手戏）`
    : '（本场只有TA一人，加上导演本人）';

  const systemPrompt = `你正在扮演群聊成员「${member.name}」，现在群里在玩"台词盲盒"：导演抽到一句台词，你需要把它演绎出来，绝对不能让人感觉是AI在写台词。

【这个人是谁】
${brief}

【最关键的设定——导演本人「${userName}」是这场戏唯一的对手戏对象】
${userBrief}
这场戏是「${member.name}」演给"${userName}"（也就是屏幕前的用户，第二人称"你"）看、说给"你"听、做给"你"看的——不是演给群里其他成员看的小剧场。台词落地的对象、视线、动作朝向、潜台词，都应该指向"你"，而不是另一个 NPC。

【同场的其他人（次要，不能喧宾夺主）】
${castNames}

【本场信息】
主题：《${theme}》
抽到的台词：「${line.text}」
情绪基调：${line.mood || '未指定'}
场景暗示：${line.scene || '未指定'}

【核心要求——必须做到】
1. 用「${member.name}」这个具体的人会有的方式演绎这句台词：可以加语气、停顿、动作描述、心理活动，让它像一段真实的小剧场
2. 台词和动作的对象必须是"你"（导演本人）：可以是「${member.name}」对你说这句话、对你做出这句话对应的动作、或者这句话是TA看着你时心里冒出来的独白——但情绪的落点始终收回到TA和"你"的关系上
3. 演绎要有细节和层次，不是干巴巴地重复台词，要让人看到"TA是怎么把这句话对你说出来的"
4. 允许适度加戏——描述表情、动作、周围环境的细节，但不能偏离台词的核心情绪，也不能让其他 NPC 抢走"你"的位置
5. 语言要有辨识度，符合这个人的说话方式和性格
6. 演绎正文（performance字段）不少于180字，要有完整的场景铺陈、情绪递进和台词落地，不能写成一两句话敷衍
7. 导演笔记（note字段）是站在"演员视角"对这段演绎的补充说明，比如为什么这么处理、留了什么潜台词、如果导演喊卡重来会怎么调整，不少于120字

【严禁清单】
- 禁止出现"作为一个XX""AI""模型""程序"等破坏沉浸感的词
- 禁止只是机械重复台词原文，必须有演绎的加工
- 禁止把这段演绎写成「${member.name}」和另一位群成员之间的对手戏（比如两个NPC互相拥抱、对视、告白），"你"（导演本人）才是这场戏唯一的情感对象和主体
- 禁止两个字段内容重复，performance是演绎正文，note是幕后补充说明，角度要不同

只输出严格 JSON，不要任何前后缀、不要代码块标记：
{"performance":"演绎正文，不少于180字","note":"导演笔记，不少于120字"}`;

  const prompt = `轮到你了，对着"${userName}"（也就是导演本人）演绎这句台词：「${line.text}」`;
  const raw = await callLbAI(prompt, systemPrompt, 900);
  return parseLbPerfJson(raw);
}

function parseLbPerfJson(raw) {
  let cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();

  /* 第一层：直接 JSON.parse */
  try {
    const obj = JSON.parse(cleaned);
    if (obj && obj.performance) {
      return { performance: String(obj.performance).trim(), note: String(obj.note || '').trim() };
    }
  } catch (e) { /* 继续尝试下一层 */ }

  /* 第二层：模型可能在 JSON 前后夹了解释文字，截取第一个 { 到最后一个 } 之间的内容再解析 */
  const firstBrace = cleaned.indexOf('{');
  const lastBrace  = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const sliced = cleaned.slice(firstBrace, lastBrace + 1);
    try {
      const obj = JSON.parse(sliced);
      if (obj && obj.performance) {
        return { performance: String(obj.performance).trim(), note: String(obj.note || '').trim() };
      }
    } catch (e) { /* 继续尝试下一层 */ }
  }

  /* 第三层：JSON 结构本身损坏（比如字段内出现未转义引号），直接用正则抠出字段值 */
  const perfMatch = cleaned.match(/"performance"\s*:\s*"([\s\S]*?)"\s*,\s*"note"/);
  const noteMatch  = cleaned.match(/"note"\s*:\s*"([\s\S]*?)"\s*}?\s*$/);
  if (perfMatch) {
    return {
      performance: unescapeJsonString(perfMatch[1]),
      note: noteMatch ? unescapeJsonString(noteMatch[1]) : '（导演笔记未能正常解析）',
    };
  }

  /* 第四层：彻底无法识别 JSON 结构 —— 不再把原始 JSON 字符串糊到界面上，
     而是给出明确的错误提示，引导用户用「重来」重新生成 */
  return {
    performance: '这段演绎的内容格式有点乱，没能正常显示，点击下方按钮让TA重新演一次。',
    note: '',
    _parseFailed: true,
  };
}

/* 还原 JSON 字符串里的转义字符（\n \" \\ 等），用于第三层正则兜底解析 */
function unescapeJsonString(s) {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .trim();
}

/* ----------------------------------------------------------------
   工具函数
---------------------------------------------------------------- */
function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function shuffleArrayLb(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function lbToast(msg) {
  const t = document.getElementById('lbToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), 2600);
}

/* 打字机效果：可传 elId 或直接传 targetEl */
function typewriteLb(elId, text, targetEl) {
  const el = targetEl || document.getElementById(elId);
  if (!el) return;
  el.textContent = '';
  let i = 0;
  const timer = setInterval(() => {
    if (i < text.length) {
      el.textContent += text[i++];
    } else {
      clearInterval(timer);
    }
  }, 24);
}