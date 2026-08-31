/* ==========================================================
   共读屿 · gd-fab.js  v2
   共读悬浮球 —— 弹幕式陪读（不是聊天面板）
   · 角色会随你读到的段落自动飘弹幕
   · 点弹幕可以回，点悬浮球出小操作台
   ========================================================== */

const GDFab = (() => {

const ORBS = [
  { k: 'orbit', n: '环 轨' }, { k: 'seal', n: '印 章' }, { k: 'moon', n: '月 相' },
  { k: 'film',  n: '胶 片' }, { k: 'ink',  n: '墨 点' }, { k: 'compass', n: '罗 盘' }
];

function orbSVG(kind, size = 58, avatar = '', name = '') {
  const clip = 'gdclip_' + kind;
  const face = avatar
    ? `<image href="${avatar}" x="0" y="0" width="72" height="72" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clip})" filter="url(#gdgray)"/>`
    : `<g clip-path="url(#${clip})"><rect width="72" height="72" fill="#e7e9ec"/>
       <text x="36" y="43" text-anchor="middle" font-family="'Noto Serif SC',serif" font-size="22" font-weight="700" fill="#3a4048">${GD.esc((name || '·').slice(0, 1))}</text></g>`;
  const shapes = {
    orbit: `<circle cx="36" cy="36" r="23"/>`,
    seal:  `<rect x="13" y="13" width="46" height="46" rx="5"/>`,
    moon:  `<circle cx="36" cy="36" r="24"/>`,
    film:  `<circle cx="36" cy="36" r="22"/>`,
    ink:   `<path d="M36 12c11 6 22 12 22 25 0 12-10 22-22 22S14 49 14 37c0-13 11-19 22-25Z"/>`,
    compass: `<circle cx="36" cy="36" r="22"/>`
  };
  const deco = {
    orbit: `<ellipse cx="36" cy="36" rx="33" ry="15" fill="none" stroke="#2b2f36" stroke-width="1.3" opacity=".55" transform="rotate(-24 36 36)"/><circle cx="63" cy="26" r="3.4" fill="#20242a"/>`,
    seal:  `<rect x="9" y="9" width="54" height="54" rx="7" fill="none" stroke="#22262c" stroke-width="1.6"/>${Array.from({length:8},(_,i)=>`<rect x="${10+i*6.6}" y="6" width="3" height="4" fill="#22262c" opacity=".55"/>`).join('')}${Array.from({length:8},(_,i)=>`<rect x="${10+i*6.6}" y="62" width="3" height="4" fill="#22262c" opacity=".55"/>`).join('')}`,
    moon:  `<circle cx="36" cy="36" r="27" fill="none" stroke="#22262c" stroke-width="1.4"/><path d="M36 9a27 27 0 0 0 0 54 18 27 0 0 1 0-54Z" fill="#14161a" opacity=".72"/>`,
    film:  `<circle cx="36" cy="36" r="28" fill="none" stroke="#22262c" stroke-width="1.4"/>${Array.from({length:12},(_,i)=>`<rect x="34.6" y="3" width="2.8" height="5" rx="1" fill="#22262c" opacity=".6" transform="rotate(${i*30} 36 36)"/>`).join('')}`,
    ink:   `<path d="M36 6c13 7 26 14 26 30 0 15-12 26-26 26S10 51 10 36C10 20 23 13 36 6Z" fill="none" stroke="#22262c" stroke-width="1.5"/><circle cx="58" cy="58" r="4" fill="#14161a"/><circle cx="66" cy="52" r="2" fill="#14161a" opacity=".7"/>`,
    compass: `<circle cx="36" cy="36" r="28" fill="none" stroke="#22262c" stroke-width="1.4"/>${Array.from({length:4},(_,i)=>`<path d="M36 4 39 14h-6Z" fill="#22262c" transform="rotate(${i*90} 36 36)"/>`).join('')}`
  };
  return `<svg viewBox="0 0 72 72" width="${size}" height="${size}" style="display:block;overflow:visible">
    <defs>
      <clipPath id="${clip}">${shapes[kind] || shapes.orbit}</clipPath>
      <filter id="gdgray"><feColorMatrix type="saturate" values="0.25"/></filter>
      <filter id="gdfabsh" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="3" stdDeviation="3.4" flood-color="#14161a" flood-opacity="0.3"/>
      </filter>
    </defs>
    <g filter="url(#gdfabsh)"><g fill="#fff">${shapes[kind] || shapes.orbit}</g></g>
    ${face}
    ${deco[kind] || ''}
  </svg>`;
}

/* ================= 样式 ================= */
function injectCSS() {
  if (document.getElementById('gdFabCSS')) return;
  const s = document.createElement('style');
  s.id = 'gdFabCSS';
  s.textContent = `
  /* 弹幕层：静态气泡，从右侧弹出后停住，不再横向飞行 */
  #gdDanmu{ position:fixed; right:14px; top:calc(var(--status-h) + 52px); width:min(78vw, 340px);
    z-index:1050; pointer-events:none; display:flex; flex-direction:column; gap:8px; align-items:flex-end; }
  .gdm{
    position:relative; white-space:normal; pointer-events:auto; cursor:pointer;
    display:inline-flex; align-items:center; gap:8px; max-width:100%;
    padding:9px 14px 9px 8px;
    background:rgba(255,255,255,.92); border:1px solid rgba(20,22,26,.16);
    box-shadow:0 3px 14px rgba(18,20,24,.14);
    backdrop-filter:blur(9px) saturate(140%);
    font-family:'Noto Serif SC',serif; font-size:13.5px; letter-spacing:.03em; color:#171a1f;
    animation:gdmPop .38s cubic-bezier(.22,1,.36,1) both, gdmOut .4s ease-in forwards var(--gdm-life, 8s);
  }
  .gdm .dot{ width:20px; height:20px; flex:0 0 20px; border-radius:50%; overflow:hidden; background:#dfe2e6;
    display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; color:#3a4048; }
  .gdm .dot img{ width:100%; height:100%; object-fit:cover; }
  .gdm .tx{ overflow-wrap:anywhere; }
  .gdm.me{ background:rgba(24,27,32,.9); color:#f3f4f6; border-color:transparent; }
  .gdm.me .dot{ background:#4a515b; color:#e8eaed; }
  .gdm.paused{ animation-play-state:paused; box-shadow:0 6px 22px rgba(18,20,24,.26); border-color:rgba(20,22,26,.4); }
  @keyframes gdmPop{ from{ opacity:0; transform:translateY(-10px) scale(.94) } to{ opacity:1; transform:none } }
  @keyframes gdmOut{ from{ opacity:1; transform:none } to{ opacity:0; transform:translateY(-8px) scale(.96) } }

  /* 段落浮标：角色对当前段落的即时反应，停在正文旁 */
  .gdm-pin{
    position:absolute; z-index:1040; max-width:70%; pointer-events:auto;
    padding:10px 13px; background:rgba(255,255,255,.92); border:1px solid rgba(20,22,26,.18);
    box-shadow:0 8px 26px rgba(18,20,24,.16); font-family:'Noto Serif SC',serif;
    font-size:13px; line-height:1.75; color:#171a1f; letter-spacing:.02em;
    animation:gdPin .5s cubic-bezier(.22,1,.36,1) both;
  }
  .gdm-pin::before{ content:''; position:absolute; left:-1px; top:10px; bottom:10px; width:2px; background:#20242a; }
  .gdm-pin .wh{ font-family:'Space Mono',monospace; font-size:9.5px; letter-spacing:.16em; color:#868d97; margin-bottom:6px; }
  @keyframes gdPin{ from{ opacity:0; transform:translateY(10px) } to{ opacity:1; transform:none } }

  /* 悬浮球 */
  #gdFab{ position:fixed; z-index:1100; width:58px; height:58px; cursor:grab; touch-action:none;
    transition:left .32s cubic-bezier(.22,1,.36,1), top .32s cubic-bezier(.22,1,.36,1); }
  #gdFab.drag{ transition:none; cursor:grabbing; }
  #gdFab .tm{ position:absolute; left:50%; transform:translateX(-50%); bottom:-15px;
    font-family:'Space Mono',monospace; font-size:9.5px; letter-spacing:.08em; color:#20242a;
    background:rgba(255,255,255,.92); border:1px solid rgba(20,22,26,.18); padding:1px 6px; white-space:nowrap; }
  #gdFab .pulse{ position:absolute; inset:-7px; border-radius:50%; border:1px solid rgba(20,22,26,.3);
    animation:gdfp 3s infinite ease-out; pointer-events:none; }
  #gdFab.muted .pulse{ display:none; }
  @keyframes gdfp{ 0%{ transform:scale(.7); opacity:.75 } 100%{ transform:scale(1.28); opacity:0 } }
  #gdFab .think{ position:absolute; top:-6px; right:-6px; width:14px; height:14px; border-radius:50%;
    background:#fff; border:1px solid rgba(20,22,26,.3); display:none; align-items:center; justify-content:center; }
  #gdFab.think .think{ display:flex; }
  #gdFab .think i{ width:4px; height:4px; border-radius:50%; background:#20242a; animation:blink 1s infinite; }

  /* 小操作台 */
  #gdDock{ position:fixed; z-index:1099; display:flex; gap:9px; align-items:center;
    opacity:0; pointer-events:none; transform:scale(.86); transition:all .3s cubic-bezier(.22,1,.36,1); }
  #gdDock.show{ opacity:1; pointer-events:auto; transform:none; }
  #gdDock .db{
    width:44px; height:44px; border-radius:50%; background:rgba(255,255,255,.94);
    border:1px solid rgba(20,22,26,.18); box-shadow:0 4px 16px rgba(18,20,24,.18);
    display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px;
    cursor:pointer; backdrop-filter:blur(10px);
  }
  #gdDock .db span{ font-family:'Noto Serif SC',serif; font-size:11px; color:#20242a; letter-spacing:.04em; }

  /* 细长发言条 */
  #gdSay{ position:fixed; left:0; right:0; bottom:0; z-index:1190;
    padding:11px 14px calc(15px + env(safe-area-inset-bottom));
    background:rgba(250,251,252,.95); backdrop-filter:blur(18px);
    border-top:1px solid rgba(20,22,26,.12); display:flex; gap:9px; align-items:center;
    transform:translateY(120%); transition:transform .32s cubic-bezier(.22,1,.36,1); }
  #gdSay.show{ transform:none; }
  #gdSay .to{ font-family:'Space Mono',monospace; font-size:9.5px; letter-spacing:.14em; color:#565c66;
    border:1px solid rgba(20,22,26,.16); padding:6px 8px; white-space:nowrap; display:none; }
  #gdSay .to.show{ display:block; }
  #gdSay input{ flex:1; padding:11px 13px; border:1px solid rgba(20,22,26,.16); background:#fff;
    font-size:13.5px; font-family:'Noto Serif SC',serif; color:#14161a; outline:none; }
  #gdSay button{ padding:11px 16px; border:none; background:#1b1e23; color:#fff; font-size:12.5px; letter-spacing:.1em; cursor:pointer; }

  /* 共读记录抽屉 */
  #gdLog{ position:fixed; inset:0; z-index:1200; background:rgba(18,20,24,.42);
    backdrop-filter:blur(10px); opacity:0; pointer-events:none; transition:opacity .3s;
    display:flex; align-items:flex-end; }
  #gdLog.show{ opacity:1; pointer-events:auto; }
  #gdLog .sheet{ width:100%; max-height:76vh; background:#f4f5f7; border-radius:20px 20px 0 0;
    box-shadow:0 -14px 40px rgba(18,20,24,.2); transform:translateY(26px); opacity:0;
    transition:transform .34s cubic-bezier(.22,1,.36,1), opacity .3s; display:flex; flex-direction:column; }
  #gdLog.show .sheet{ transform:none; opacity:1; }
  #gdLog .hd{ display:flex; align-items:center; gap:12px; padding:17px 20px 14px; border-bottom:1px solid rgba(20,22,26,.1); }
  #gdLog .hd .nm{ font-family:'Noto Serif SC',serif; font-size:15.5px; font-weight:700; letter-spacing:.09em; color:#14161a; }
  #gdLog .hd .sb{ font-family:'Space Mono',monospace; font-size:9.5px; letter-spacing:.14em; color:#868d97; margin-top:5px; }
  #gdLog .bd{ flex:1; overflow-y:auto; padding:16px 20px 8px; }
  #gdLog .bd::-webkit-scrollbar{ width:0 }
  #gdLog .row{ display:flex; gap:10px; margin-bottom:15px; align-items:flex-start; }
  #gdLog .row.me{ flex-direction:row-reverse; }
  #gdLog .bub{ max-width:78%; padding:10px 13px; font-family:'Noto Serif SC',serif; font-size:13.5px;
    line-height:1.85; background:#fff; border:1px solid rgba(20,22,26,.12); color:#20242a; white-space:pre-wrap; }
  #gdLog .row.me .bub{ background:#22262c; color:#fff; border-color:transparent; }
  #gdLog .cap{ font-family:'Space Mono',monospace; font-size:9px; letter-spacing:.12em; color:#868d97; margin-bottom:5px; }
  #gdLog .acts{ display:flex; gap:9px; padding:12px 20px calc(18px + env(safe-area-inset-bottom)); border-top:1px solid rgba(20,22,26,.1); }
  #gdLog .acts div{ flex:1; text-align:center; padding:12px 0; cursor:pointer; font-size:12.5px; letter-spacing:.1em;
    border:1px solid rgba(20,22,26,.16); background:#fff; color:#20242a; }
  #gdLog .acts div.warn{ background:#22262c; color:#fff; border-color:transparent; }

  /* AI 接口设置 */
  #gdApiSet{ position:fixed; inset:0; z-index:1300; background:rgba(18,20,24,.46);
    backdrop-filter:blur(10px); opacity:0; pointer-events:none; transition:opacity .3s;
    display:flex; align-items:flex-end; justify-content:center; }
  #gdApiSet.show{ opacity:1; pointer-events:auto; }
  #gdApiSet .sheet{ width:100%; max-height:88vh; overflow-y:auto; background:#f2f3f5; border-radius:20px 20px 0 0;
    box-shadow:0 -14px 40px rgba(18,20,24,.2); transform:translateY(26px); opacity:0;
    transition:transform .34s cubic-bezier(.22,1,.36,1), opacity .3s; padding:0 0 26px; }
  #gdApiSet.show .sheet{ transform:none; opacity:1; }
  #gdApiSet .hd{ position:sticky; top:0; z-index:2; display:flex; align-items:center; justify-content:space-between;
    padding:18px 20px 14px; background:#f2f3f5; border-bottom:1px solid rgba(20,22,26,.1); }
  #gdApiSet .hd .t{ font-family:'Noto Serif SC',serif; font-size:16px; font-weight:700; letter-spacing:.1em; color:#14161a; }
  #gdApiSet .x{ width:28px; height:28px; border-radius:50%; border:1px solid rgba(20,22,26,.16); background:#fff;
    display:flex; align-items:center; justify-content:center; cursor:pointer; }
  #gdApiSet .bd{ padding:18px 20px 4px; }
  #gdApiSet .fld{ margin-bottom:16px; }
  #gdApiSet label{ display:block; font-family:'Space Mono',monospace; font-size:10.5px; letter-spacing:.18em;
    color:#868d97; text-transform:uppercase; margin-bottom:7px; }
  #gdApiSet input{ width:100%; padding:12px 13px; font-size:13.5px; color:#14161a; background:#fff;
    border:1px solid rgba(20,22,26,.16); border-radius:3px; outline:none; box-sizing:border-box; }
  #gdApiSet .hint{ font-size:11px; line-height:1.9; color:#868d97; letter-spacing:.02em; margin:2px 0 18px; }
  #gdApiSet .row{ display:flex; gap:10px; margin-top:6px; }
  #gdApiSet .row button{ flex:1; padding:13px 0; border:none; cursor:pointer; font-size:13px; letter-spacing:.1em; }
  #gdApiSet .save{ background:#1b1e23; color:#fff; }
  #gdApiSet .test{ background:#fff; color:#14161a; border:1px solid rgba(20,22,26,.18) !important; }
  #gdApiSet .stat{ margin-top:12px; font-family:'Space Mono',monospace; font-size:10.5px; letter-spacing:.08em;
    padding:9px 11px; border:1px solid rgba(20,22,26,.14); background:#fff; display:none; }
  #gdApiSet .stat.show{ display:block; }
  #gdApiSet .stat.ok{ color:#1a7a45; border-color:rgba(26,122,69,.35); }
  #gdApiSet .stat.err{ color:#a3312c; border-color:rgba(163,49,44,.35); }
  `;
  document.head.appendChild(s);
}

/* ================= AI 接口设置面板 ================= */
function ensureApiSetDOM() {
  if (document.getElementById('gdApiSet')) return;
  const box = document.createElement('div');
  box.id = 'gdApiSet';
  box.innerHTML = `
    <div class="sheet">
      <div class="hd">
        <div class="t">AI 接口设置</div>
        <div class="x" id="gdApiSetX">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.7"/></svg>
        </div>
      </div>
      <div class="bd">
        <div class="hint">共读的弹幕回应、以及"让 AI 读一遍拟卷首语"等功能都依赖这里的接口。填写一个兼容 OpenAI /chat/completions 格式的地址即可，例如官方 OpenAI、Deepseek、或你自建的中转。</div>
        <div class="fld">
          <label>Base URL</label>
          <input id="gdApiBase" placeholder="例：https://api.openai.com/v1">
        </div>
        <div class="fld">
          <label>API Key</label>
          <input id="gdApiKey" type="password" placeholder="sk-...">
        </div>
        <div class="fld">
          <label>Model</label>
          <input id="gdApiModel" placeholder="例：gpt-4o-mini">
        </div>
        <div class="row">
          <button class="test" id="gdApiTest">测试连接</button>
          <button class="save" id="gdApiSave">保 存</button>
        </div>
        <div class="stat" id="gdApiStat"></div>
      </div>
    </div>`;
  document.body.appendChild(box);

  box.addEventListener('click', e => { if (e.target === box) closeApiSet(); });
  document.getElementById('gdApiSetX').onclick = closeApiSet;
  document.getElementById('gdApiSave').onclick = saveApiSet;
  document.getElementById('gdApiTest').onclick = testApiSet;
}
function openApiSet() {
  ensureApiSetDOM();
  const c = GD.apiConf();
  document.getElementById('gdApiBase').value = c.baseUrl || '';
  document.getElementById('gdApiKey').value = c.apiKey || '';
  document.getElementById('gdApiModel').value = c.model || '';
  const st = document.getElementById('gdApiStat'); st.className = 'stat'; st.textContent = '';
  document.getElementById('gdApiSet').classList.add('show');
}
function closeApiSet() { document.getElementById('gdApiSet')?.classList.remove('show'); }

function readApiSetFields() {
  return {
    baseUrl: document.getElementById('gdApiBase').value.trim().replace(/\/$/, ''),
    apiKey: document.getElementById('gdApiKey').value.trim(),
    model: document.getElementById('gdApiModel').value.trim()
  };
}
function saveApiSet() {
  const v = readApiSetFields();
  if (!v.baseUrl || !v.apiKey || !v.model) {
    const st = document.getElementById('gdApiStat');
    st.className = 'stat err show'; st.textContent = 'Base URL / API Key / Model 三项都要填，否则弹幕不会调用 AI。';
    return;
  }
  GD.LS.set('luna_api_current', { baseUrl: v.baseUrl, apiKey: v.apiKey });
  localStorage.setItem('luna_api_model', v.model);
  const st = document.getElementById('gdApiStat');
  st.className = 'stat ok show'; st.textContent = '已保存。下一次弹幕 / 卷首语生成会使用这个接口。';
  GD.toast('AI 接口已保存');
}
async function testApiSet() {
  const v = readApiSetFields();
  const st = document.getElementById('gdApiStat');
  if (!v.baseUrl || !v.apiKey || !v.model) {
    st.className = 'stat err show'; st.textContent = 'Base URL / API Key / Model 三项都要填。';
    return;
  }
  st.className = 'stat show'; st.textContent = '正在测试…';
  try {
    const resp = await fetch(`${v.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${v.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: v.model, messages: [{ role: 'user', content: '回复两个字：在的' }], max_tokens: 20 })
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    const out = data.choices?.[0]?.message?.content || '(空)';
    st.className = 'stat ok show'; st.textContent = '连接成功，模型回复：' + out.slice(0, 40);
  } catch (e) {
    st.className = 'stat err show'; st.textContent = '连接失败：' + e.message + '（检查地址 / Key / 模型名是否正确）';
  }
}

/* ================= 会话 ================= */
const S = () => GD.LS.get('gd_coread_session', null);
const saveS = s => GD.LS.set('gd_coread_session', s);
const log = () => GD.LS.get('gd_fab_msgs', []);
const pushLog = m => { const a = log(); a.push(Object.assign({ t: Date.now() }, m)); GD.LS.set('gd_fab_msgs', a.slice(-80)); };

let _ctx = {}, _timer = null, _fab = null, _busy = false, _replyTo = null;
let _lastPara = -99, _lastShot = 0, _ambientT = null;

function mount(ctx = {}) {
  _ctx = ctx;
  const s = S();
  if (!s || !s.active) {
    console.warn('[GDFab] 未挂载悬浮球：没有活跃的共读会话 (gd_coread_session.active !== true)。请先在 gd-coread.html 完成邀请并点击"确认并开始共读"。当前 session =', s);
    return;
  }
  injectCSS();
  build(s);
  startTimer();
  if (ctx.page === 'reader') {
    bindReaderWatch();
    setTimeout(() => autoShot(true), 2600);   // 进来先说一句
  }
}

function build(s) {
  ['gdFab', 'gdDock', 'gdDanmu', 'gdSay', 'gdLog'].forEach(id => document.getElementById(id)?.remove());

  const dm = document.createElement('div'); dm.id = 'gdDanmu'; document.body.appendChild(dm);

  const fab = document.createElement('div');
  fab.id = 'gdFab';
  fab.innerHTML = `<div class="pulse"></div>${orbSVG(s.style || 'orbit', 58, s.avatar, s.charName)}
    <div class="think"><i></i></div><div class="tm" id="gdFabTm">${GD.fmtDuration(s.totalMs || 0)}</div>`;
  if (s.muted) fab.classList.add('muted');
  const pos = GD.LS.get('gd_fab_pos', { x: window.innerWidth - 76, y: window.innerHeight * 0.6 });
  fab.style.left = Math.min(Math.max(6, pos.x), window.innerWidth - 66) + 'px';
  fab.style.top = Math.min(Math.max(60, pos.y), window.innerHeight - 96) + 'px';
  document.body.appendChild(fab); _fab = fab;

  const dock = document.createElement('div');
  dock.id = 'gdDock';
  dock.innerHTML = `
    <div class="db" data-a="say"><span>说</span></div>
    <div class="db" data-a="ask"><span>这段</span></div>
    <div class="db" data-a="log"><span>记录</span></div>`;
  document.body.appendChild(dock);

  const say = document.createElement('div');
  say.id = 'gdSay';
  say.innerHTML = `<div class="to" id="gdSayTo"></div>
    <input id="gdSayInput" placeholder="对 ${GD.esc(s.charName)} 说…">
    <button id="gdSayBtn">发送</button>`;
  document.body.appendChild(say);

  const lg = document.createElement('div');
  lg.id = 'gdLog';
  lg.innerHTML = `<div class="sheet">
      <div class="hd">
        <div>${orbSVG(s.style || 'orbit', 40, s.avatar, s.charName)}</div>
        <div style="flex:1;min-width:0">
          <div class="nm">${GD.esc(s.charName)}</div>
          <div class="sb">CO-READING · <span id="gdLogTm">${GD.fmtDuration(s.totalMs || 0, true)}</span>${s.workTitle ? ' · 《' + GD.esc(s.workTitle) + '》' : ''}</div>
        </div>
      </div>
      <div class="bd" id="gdLogBody"></div>
      <div class="acts">
        <div id="gdMute">${s.muted ? '恢复弹幕' : '暂停弹幕'}</div>
        <div id="gdStyle">换样式</div>
        <div id="gdApiCfg">AI 设置</div>
        <div id="gdEnd" class="warn">结束共读</div>
      </div>
    </div>`;
  document.body.appendChild(lg);

  bindDrag(fab, dock);
  bindDock(dock);
  bindSay();
  bindLog(lg);
  positionDock();
}

/* ---------------- 拖拽 & 展开 ---------------- */
function positionDock() {
  const fab = document.getElementById('gdFab'), dock = document.getElementById('gdDock');
  if (!fab || !dock) return;
  const x = parseFloat(fab.style.left), y = parseFloat(fab.style.top);
  dock.style.top = (y + 8) + 'px';
  if (x + 29 > window.innerWidth / 2) { dock.style.right = (window.innerWidth - x + 8) + 'px'; dock.style.left = 'auto'; }
  else { dock.style.left = (x + 66) + 'px'; dock.style.right = 'auto'; }
}
function bindDrag(fab, dock) {
  let sx = 0, sy = 0, ox = 0, oy = 0, moved = false, down = false;
  const pt = e => e.touches ? e.touches[0] : e;
  const start = e => {
    down = true; moved = false;
    const p = pt(e); sx = p.clientX; sy = p.clientY;
    ox = parseFloat(fab.style.left); oy = parseFloat(fab.style.top);
    fab.classList.add('drag');
  };
  const move = e => {
    if (!down) return;
    const p = pt(e), dx = p.clientX - sx, dy = p.clientY - sy;
    if (Math.abs(dx) + Math.abs(dy) > 14) moved = true;
    fab.style.left = Math.max(6, Math.min(window.innerWidth - 64, ox + dx)) + 'px';
    fab.style.top = Math.max(60, Math.min(window.innerHeight - 96, oy + dy)) + 'px';
    positionDock();
    if (e.cancelable) e.preventDefault();
  };
  const end = () => {
    if (!down) return;
    down = false; fab.classList.remove('drag');
    const x = parseFloat(fab.style.left);
    const snap = x + 29 > window.innerWidth / 2 ? window.innerWidth - 68 : 8;
    fab.style.left = snap + 'px';
    GD.LS.set('gd_fab_pos', { x: snap, y: parseFloat(fab.style.top) });
    setTimeout(positionDock, 330);
    if (!moved) dock.classList.toggle('show');
  };
  fab.addEventListener('touchstart', start, { passive: true });
  window.addEventListener('touchmove', move, { passive: false });
  window.addEventListener('touchend', end);
  fab.addEventListener('mousedown', e => { e.preventDefault(); start(e); });
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  window.addEventListener('resize', positionDock);
}
function bindDock(dock) {
  dock.querySelectorAll('.db').forEach(el => el.onclick = () => {
    dock.classList.remove('show');
    const a = el.dataset.a;
    if (a === 'say') openSay(null);
    if (a === 'ask') { GD.toast('TA 正在看这一段…'); autoShot(false, true); }
    if (a === 'log') { paintLog(); document.getElementById('gdLog').classList.add('show'); }
  });
}
function bindSay() {
  const box = document.getElementById('gdSay');
  document.getElementById('gdSayBtn').onclick = () => submitSay();
  document.getElementById('gdSayInput').addEventListener('keydown', e => { if (e.key === 'Enter') submitSay(); });
  document.addEventListener('click', e => {
    if (!e.target.closest('#gdSay') && !e.target.closest('.gdm') && !e.target.closest('#gdDock') && !e.target.closest('#gdFab'))
      box.classList.remove('show');
  });
}
function openSay(target) {
  _replyTo = target;
  const to = document.getElementById('gdSayTo');
  if (target) { to.textContent = '回 ' + target.name; to.classList.add('show'); }
  else to.classList.remove('show');
  document.getElementById('gdSay').classList.add('show');
  setTimeout(() => document.getElementById('gdSayInput').focus(), 180);
}
function bindLog(lg) {
  lg.onclick = e => { if (e.target === lg) lg.classList.remove('show'); };
  lg.querySelector('#gdMute').onclick = () => {
    const s = S(); s.muted = !s.muted; saveS(s);
    document.getElementById('gdFab').classList.toggle('muted', s.muted);
    lg.querySelector('#gdMute').textContent = s.muted ? '恢复弹幕' : '暂停弹幕';
    GD.toast(s.muted ? '弹幕已暂停，TA 还在' : '弹幕恢复');
  };
  lg.querySelector('#gdStyle').onclick = () => GD.go('gd-coread.html');
  lg.querySelector('#gdApiCfg').onclick = () => openApiSet();
  lg.querySelector('#gdEnd').onclick = async () => {
    const ok = await GD.confirmBox('结束这次共读？', '累计陪伴时长会保留在你的屿上记录里，弹幕历史也会留下。', '结束');
    if (!ok) return;
    const s = S(); s.active = false; s.endAt = Date.now(); saveS(s);
    ['gdFab', 'gdDock', 'gdDanmu', 'gdSay', 'gdLog'].forEach(id => document.getElementById(id)?.remove());
    clearInterval(_timer); clearInterval(_ambientT);
    GD.toast('共读已结束');
    if (location.pathname.includes('gongduyu')) setTimeout(() => location.reload(), 700);
  };
}
function paintLog() {
  const s = S(), body = document.getElementById('gdLogBody');
  const arr = log();
  body.innerHTML = arr.length ? arr.map(m => `
    <div class="row ${m.me ? 'me' : ''}">
      <div style="flex:0 0 auto">${m.me ? '' : orbSVG(s.style || 'orbit', 26, s.avatar, s.charName)}</div>
      <div>${m.cap ? `<div class="cap">${GD.esc(m.cap)}</div>` : ''}<div class="bub">${GD.esc(m.text)}</div></div>
    </div>`).join('')
    : `<div style="font-size:12.5px;color:#868d97;line-height:2;letter-spacing:.03em;">
        还没有对话。${GD.esc(s.charName)} 会在你读到某些段落时自己开口，弹幕都会留在这里。</div>`;
  body.scrollTop = body.scrollHeight;
}

/* ---------------- 计时 ---------------- */
function startTimer() {
  clearInterval(_timer);
  _timer = setInterval(() => {
    if (document.hidden) return;
    const s = S(); if (!s || !s.active) return;
    s.totalMs = (s.totalMs || 0) + 1000; saveS(s);
    const a = document.getElementById('gdFabTm'); if (a) a.textContent = GD.fmtDuration(s.totalMs);
    const b = document.getElementById('gdLogTm'); if (b) b.textContent = GD.fmtDuration(s.totalMs, true);
  }, 1000);
}

/* ---------------- 弹幕：静态气泡，弹出后停留一段时间再淡出 ---------------- */
const GDM_MAX = 4; // 屏幕上最多同时保留几条气泡
function shoot(text, me, name) {
  const s = S(); if (!s) return;
  const layer = document.getElementById('gdDanmu'); if (!layer) return;
  const el = document.createElement('div');
  el.className = 'gdm' + (me ? ' me' : '');
  const av = me
    ? `<div class="dot">我</div>`
    : `<div class="dot">${s.avatar ? `<img src="${s.avatar}">` : GD.esc((s.charName || '·').slice(0, 1))}</div>`;
  el.innerHTML = `${av}<div class="tx">${GD.esc(text)}</div>`;
  // 停留时长：文字越长停得越久，最短 6s，最长 14s
  const life = Math.max(6, Math.min(14, text.length * 0.18 + 6));
  el.style.setProperty('--gdm-life', life + 's');

  let removed = false;
  const remove = () => { if (removed) return; removed = true; el.remove(); };
  el.addEventListener('click', () => {
    // 点击气泡：暂停自动消失，打开回复框
    el.style.animationPlayState = 'paused';
    el.classList.add('paused');
    openSay({ name: name || s.charName, text });
  });
  // 淡出动画（第二段 keyframe）结束后真正移除
  el.addEventListener('animationend', e => { if (e.animationName === 'gdmOut') remove(); });

  layer.appendChild(el);
  // 超出上限时，最早的一条直接淡出移除
  while (layer.children.length > GDM_MAX) layer.removeChild(layer.firstChild);
}

/* 当前视口中央的段落 */
function currentPara() {
  const ps = [...document.querySelectorAll('#rdText .rd-p')];
  if (!ps.length) {
    const host = document.querySelector('.gd-scroll') || document.body;
    return { idx: -1, total: 0, text: (host.innerText || '').replace(/\s{3,}/g, '\n').trim().slice(0, 1200) };
  }
  const mid = window.innerHeight * 0.45;
  let best = 0, bd = 1e9;
  ps.forEach((p, i) => {
    const r = p.getBoundingClientRect();
    const d = Math.abs(r.top + r.height / 2 - mid);
    if (d < bd) { bd = d; best = i; }
  });
  const around = ps.slice(Math.max(0, best - 1), best + 2).map(p => p.innerText).join('\n');
  return { idx: best, text: around, el: ps[best], total: ps.length };
}

function bindReaderWatch() {
  const sc = document.getElementById('rdScroll'); if (!sc) return;
  let t = null;
  sc.addEventListener('scroll', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const s = S(); if (!s || !s.active || s.muted) return;
      const { idx } = currentPara();
      if (idx < 0) return;
      if (Math.abs(idx - _lastPara) >= 3 && Date.now() - _lastShot > 24000) autoShot();
    }, 900);
  }, { passive: true });

  clearInterval(_ambientT);
  _ambientT = setInterval(() => {
    const s = S(); if (!s || !s.active || s.muted || document.hidden) return;
    if (Date.now() - _lastShot > 75000) autoShot();
  }, 20000);
}

/* 让角色对"当前这段"说一句 */
async function autoShot(isOpening, force) {
  const s = S(); if (!s || !s.active || _busy) return;
  if (s.muted && !force) return;
  const cur = currentPara();
  _lastPara = cur.idx; _lastShot = Date.now();
  _busy = true;
  _fab?.classList.add('think');

  let line = '';
  try {
    if (!GD.apiReady()) throw new Error('NO_API');
    const chars = await GD.getChars();
    const ch = chars.find(c => c.id === s.charId);
    const w = _ctx.work;
    const sys = `${GD.charPrompt(ch)}

你正在和用户一起读一篇同人文，你们并排看同一块屏幕。现在你要对**用户此刻正读到的这几段**说一句话，像弹幕一样飘过去。
要求：
- 只输出这一句话本身，不要引号、不要名字前缀、不要解释。
- 12-30 个字，口语，短。
- 必须咬住给你的段落内容：可以复述其中一个动作、一个物件、一句台词的半句，或者对某个人物的行为作出即时反应。
- 保持你的人设语气（可以毒舌、冷淡、心软、幸灾乐祸、突然沉默）。
- 不要 emoji，不要颜文字，不要说"这段写得好"这种空话。`;
    const usr = `${w ? `篇名：《${w.title}》 CP：${w.tags?.cp || '未标'}` : ''}
${isOpening ? '（你们刚打开这一篇，这是你的第一句）' : ''}
用户正读到（第 ${cur.idx + 1}/${cur.total} 段附近）：
"""${cur.text.slice(0, 1200)}"""`;
    line = (await GD.ai([{ role: 'system', content: sys }, { role: 'user', content: usr }],
      { max_tokens: 120, temperature: 1.06 })).trim().replace(/^["“「]|["”」]$/g, '').split('\n')[0].slice(0, 60);
  } catch (e) {
    line = localLine(cur.text, isOpening);
  }
  _busy = false;
  _fab?.classList.remove('think');
  if (!line) return;
  shoot(line, false);
  pushLog({ me: false, text: line, cap: cur.idx >= 0 ? `读到第 ${cur.idx + 1} 段` : '' });
}

/* 用户发言 → 角色回一条弹幕 */
async function submitSay() {
  const inp = document.getElementById('gdSayInput');
  const text = (inp.value || '').trim(); if (!text || _busy) return;
  const s = S(); if (!s) return;
  inp.value = '';
  document.getElementById('gdSay').classList.remove('show');
  shoot(text, true);
  pushLog({ me: true, text, cap: _replyTo ? '回 ' + _replyTo.name : '' });

  const target = _replyTo; _replyTo = null;
  _busy = true; _fab?.classList.add('think');

  let line = '';
  try {
    if (!GD.apiReady()) throw new Error('NO_API');
    const chars = await GD.getChars();
    const ch = chars.find(c => c.id === s.charId);
    const cur = currentPara();
    const hist = log().slice(-6).map(m => `${m.me ? '用户' : s.charName}：${m.text}`).join('\n');
    const sys = `${GD.charPrompt(ch)}

你正在和用户并排读同一篇同人文，你们用弹幕交流。回应用户刚才说的话。
要求：只输出一句话，12-40 字，口语，保持人设。能结合屏幕上的内容就结合。不要 emoji、不要旁白、不要说自己是 AI。`;
    const usr = `${_ctx.work ? `篇名：《${_ctx.work.title}》\n` : ''}屏幕上正在读的段落：
"""${cur.text.slice(0, 900)}"""

最近的对话：
${hist}

${target ? `（用户在回你刚才那句"${target.text}"）` : ''}
用户说：${text}`;
    line = (await GD.ai([{ role: 'system', content: sys }, { role: 'user', content: usr }],
      { max_tokens: 160, temperature: 1.05 })).trim().replace(/^["“「]|["”」]$/g, '').split('\n')[0].slice(0, 70);
  } catch (e) {
    line = localReply();
  }
  _busy = false; _fab?.classList.remove('think');
  shoot(line, false);
  pushLog({ me: false, text: line });
  GD.bumpInteraction(1);
}

/* ---------------- 无 API 兜底：也咬住段落 ---------------- */
function localLine(paraText, opening) {
  const t = (paraText || '').replace(/\s+/g, ' ').trim();
  const q = (t.match(/[「『“][^」』”]{2,18}[」』”]/) || [])[0];
  const frag = q ? q.replace(/[「」『』“”]/g, '') : t.slice(0, 12);
  if (opening) return '好了，我跟上了。你别翻太快。';
  const P = [
    () => `“${frag}”——这句你也停了一下吧。`,
    () => `他这里说的是${frag}，但我不信。`,
    () => `${frag}。行，我记下了。`,
    () => `这段我想再看一遍，你等我。`,
    () => `写到${frag}的时候，节奏突然慢了。`
  ];
  return P[Math.floor(Math.random() * P.length)]();
}
function localReply() {
  const R = ['嗯，我在。', '你继续读，我跟着。', '这里我也想停一下。', '别急着翻页。', '我以为只有我这么想。'];
  return R[Math.floor(Math.random() * R.length)];
}

return { ORBS, orbSVG, mount, S, saveS, injectCSS, shoot, openApiSet };
})();
window.GDFab = GDFab;