/* ==========================================================
   共读屿 · gd-coread.js
   同步角色 → 发出邀请 → 模拟应答 → 选悬浮球 → 建立共读会话
   ========================================================== */

let CHARS = [], PICK = null, ORB = 'orbit', WORKS = [], ANSWER = '';

document.addEventListener('DOMContentLoaded', async () => {
  GD.mountStatusBar();
  GDFab.injectCSS();

  const s = GDFab.S();
  if (s && s.active) renderLive(s);

  CHARS = await GD.getChars();
  WORKS = (await GD.worksAll()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  renderChars();
  renderWorks();
  renderOrbs();
  document.getElementById('sendInvite').addEventListener('click', invite);
  document.getElementById('confirmOrb').addEventListener('click', confirmSession);
});

/* ---------------- 已在共读 ---------------- */
function renderLive(s) {
  const box = document.getElementById('liveBox');
  box.style.display = 'block';
  box.innerHTML = `
    <div style="border:1px solid var(--line-2);background:var(--card);box-shadow:var(--shadow-m);padding:16px;display:flex;gap:14px;align-items:center;">
      <div>${GDFab.orbSVG(s.style || 'orbit', 54, s.avatar, s.charName)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--serif);font-size:16px;font-weight:700;letter-spacing:.06em;">${GD.esc(s.charName)} 正与你共读</div>
        <div style="font-family:var(--mono);font-size:8.5px;letter-spacing:.16em;color:var(--ink-4);margin-top:6px;">
          ${s.workTitle ? '《' + GD.esc(s.workTitle) + '》 · ' : ''}已陪伴 ${GD.fmtDuration(s.totalMs || 0, true)}
        </div>
      </div>
    </div>
    <div style="font-size:11.5px;color:var(--ink-4);line-height:1.9;margin:12px 0 4px;letter-spacing:.03em;">
      下面可以更换悬浮球样式，或重新邀请另一个人（会替换当前共读）。
    </div>`;
  ORB = s.style || 'orbit';
  document.getElementById('orbBox').style.display = 'block';
}

/* ---------------- 角色 ---------------- */
function renderChars() {
  const el = document.getElementById('charList');
  if (!CHARS.length) {
    el.innerHTML = `<div class="cr-note" style="border-style:dashed;">
      角色档案里还没有人。先去「角色档案」创建一个角色，这里就能同步出现了。</div>`;
    return;
  }
  el.innerHTML = CHARS.map(c => `
    <div class="cr-char" data-id="${c.id}">
      <div class="av">${c.avatar ? `<img src="${c.avatar}">` : GD.avatarSVG(c.name, 52)}</div>
      <div style="flex:1;min-width:0">
        <div class="nm">${GD.esc(c.name || '未命名')}</div>
        <div class="rl">${GD.esc(c.role || c.species || 'CHARACTER')}</div>
        ${c.desc ? `<div class="ds">${GD.esc(c.desc)}</div>` : ''}
      </div>
    </div>`).join('');
  document.querySelectorAll('.cr-char').forEach(x => x.onclick = () => {
    PICK = CHARS.find(c => c.id == x.dataset.id);
    document.querySelectorAll('.cr-char').forEach(y => y.classList.toggle('on', y === x));
  });
}
let PICK_WORK = '';
function renderWorks() {
  const el = document.getElementById('workSel');
  const paint = () => {
    const w = WORKS.find(x => String(x.id) === String(PICK_WORK));
    el.textContent = w ? `《${w.title}》 · ${GD.fmtWords(w.wordCount)}字` : '暂不指定，随便读什么都行';
    el.classList.toggle('ph', !w);
  };
  paint();
  el.onclick = async () => {
    const items = [{ v: '', t: '暂不指定，随便读什么都行' }].concat(
      WORKS.map(w => ({ v: w.id, t: `《${w.title}》`, s: `${GD.fmtWords(w.wordCount)} 字 · ${(w.tags && w.tags.cp) || '未标 CP'}` })));
    const v = await GD.pickerBox('要一起读的篇目', items, PICK_WORK);
    if (v === null) return;
    PICK_WORK = v; paint();
  };
}
function renderOrbs() {
  document.getElementById('orbGrid').innerHTML = GDFab.ORBS.map(o => `
    <div class="orb-cell ${o.k === ORB ? 'on' : ''}" data-k="${o.k}">
      <div style="display:flex;justify-content:center">${GDFab.orbSVG(o.k, 52, PICK?.avatar || (GDFab.S()?.avatar) || '', PICK?.name || GDFab.S()?.charName || '')}</div>
      <div class="nm">${o.n}</div>
    </div>`).join('');
  document.querySelectorAll('.orb-cell').forEach(el => el.onclick = () => {
    ORB = el.dataset.k;
    document.querySelectorAll('.orb-cell').forEach(x => x.classList.toggle('on', x === el));
  });
}

/* ---------------- 邀请握手 ---------------- */
const STEPS = [
  ['信号已送出', 'REQUEST SENT'],
  ['对方收到了你的留言', 'DELIVERED'],
  ['TA 正在看你挑的这一篇', 'READING YOUR PICK'],
  ['TA 正在输入…', 'TYPING'],
  ['应答完成', 'ACCEPTED']
];
async function invite() {
  if (!PICK) { GD.toast('先选一个人'); return; }
  const msg = document.getElementById('inviteMsg').value.trim();
  const work = PICK_WORK ? WORKS.find(w => w.id == PICK_WORK) : null;

  const hand = document.getElementById('hand');
  hand.classList.add('show');
  document.getElementById('answer').classList.remove('show');
  document.getElementById('steps').innerHTML = STEPS.map(([t, s]) =>
    `<div class="cr-step"><div class="dot"></div><div class="tx">${t}<small>${s}</small></div></div>`).join('');
  hand.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const nodes = document.querySelectorAll('.cr-step');
  const delays = [420, 900, 1500, 1100, 500];

  // 与动画并行地去要一句应答
  const p = fetchAnswer(PICK, msg, work);
  for (let i = 0; i < 4; i++) {
    await wait(delays[i]);
    nodes[i].classList.add('on');
  }
  ANSWER = await p;
  await wait(delays[4]);
  nodes[4].classList.add('on');

  document.getElementById('answerWho').textContent = PICK.name.toUpperCase() + ' · REPLY';
  document.getElementById('answerSay').textContent = ANSWER;
  document.getElementById('answer').classList.add('show');

  document.getElementById('orbBox').style.display = 'block';
  renderOrbs();
  setTimeout(() => document.getElementById('orbBox').scrollIntoView({ behavior: 'smooth', block: 'start' }), 380);
}
const wait = ms => new Promise(r => setTimeout(r, ms));

async function fetchAnswer(ch, msg, work) {
  if (GD.apiReady()) {
    try {
      const out = await GD.ai([
        { role: 'system', content: `${GD.charPrompt(ch)}
用户邀请你陪 TA 一起读一篇同人文。请以你的口吻答应下来（可以带点条件、调侃、别扭或不好意思，但最终是答应）。
1-3 句，40-80 字，口语，不要旁白，不要动作描写超过一句，不要 emoji。` },
        { role: 'user', content: `${work ? `篇目：《${work.title}》\nCP：${work.tags?.cp || '未标'}\n卷首语：${work.summary || '无'}\n` : '篇目：还没定\n'}对方留言：${msg || '（没有留言，只是把书递了过来）'}` }
      ], { max_tokens: 260, temperature: 1 });
      if (out && out.trim()) return out.trim();
    } catch (e) {}
  }
  const F = [
    '行吧。你翻页慢一点，我读得没你快。',
    '给我看看是哪一篇……好，答应你了，别中途跑掉。',
    '我本来不太看这种。但既然是你递过来的，那就读。',
    '可以。不过读到难受的地方，你不许一个人先合上。'
  ];
  return F[Math.floor(Math.random() * F.length)];
}

/* ---------------- 建立会话 ---------------- */
function confirmSession() {
  const cur = GDFab.S();
  if (!PICK && cur && cur.active) {           // 仅更换样式
    cur.style = ORB; GDFab.saveS(cur);
    GD.toast('悬浮球样式已更换');
    setTimeout(() => GD.go('gongduyu.html'), 600); return;
  }
  if (!PICK) { GD.toast('先选一个人并发出邀请'); return; }
  const work = PICK_WORK ? WORKS.find(w => w.id == PICK_WORK) : null;

  GDFab.saveS({
    charId: PICK.id, charName: PICK.name, avatar: PICK.avatar || '',
    style: ORB, active: true,
    startAt: Date.now(), totalMs: (cur && cur.charId === PICK.id) ? (cur.totalMs || 0) : 0,
    workId: work ? work.id : null, workTitle: work ? work.title : '',
    firstReply: ANSWER
  });
  GD.LS.set('gd_fab_msgs', ANSWER ? [{ me: false, text: ANSWER, tag: '应答' }] : []);
  GD.toast('共读已开始');
  setTimeout(() => GD.go('gongduyu.html'), 700);
}