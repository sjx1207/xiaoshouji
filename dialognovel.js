/* ================================
   对话小说 App — novel-app.js
================================ */
// 读取用户在设置页配置的 AI
function getActiveAI() {
  const cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  return {
    baseUrl: (cur.baseUrl || '').replace(/\/$/, ''),
    apiKey: cur.apiKey || '',
    model: model
  };
}

/* ── 实时时间（1:1 复刻 script.js） ── */
function updateTime() {
  const el = document.getElementById('statusTime');
  if (!el) return;
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const now = new Date();
  const statusTimeStr = now.toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  el.textContent = statusTimeStr;
}

/* ── 电量（1:1 复刻 script.js） ── */
function updateBattery() {
  const pctEl   = document.getElementById('batPct');
  const innerEl = document.getElementById('batInner');

  function render(pct) {
    const p = Math.round(pct);
    if (pctEl)   pctEl.textContent = p;
    if (innerEl) {
      innerEl.style.width = p + '%';
      innerEl.style.background = p <= 20
        ? 'linear-gradient(90deg, #f87171, #ef4444)'
        : 'linear-gradient(90deg, #6ee7b7, #34d399)';
    }
  }

  if ('getBattery' in navigator) {
    navigator.getBattery().then(battery => {
      render(battery.level * 100);
      battery.addEventListener('levelchange', () => render(battery.level * 100));
    });
  } else {
    render(76);
  }
}

/* ── 灵动岛（1:1 完整复刻 script.js applyIsland） ── */
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

  // 时钟样式实时更新
  clearInterval(window._siClockTimer);
  if (style === 'clock') {
    const tick = () => {
      const t = document.getElementById('siClockText');
      if (!t) return;
      const now = new Date();
      t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    };
    tick();
    window._siClockTimer = setInterval(tick, 10000);
  }
}

/* ================================
   字体 DB — 1:1 完整复刻 script.js
================================ */
let _fontDb = null;
function openFontDB() {
  return new Promise((res, rej) => {
    if (_fontDb) return res(_fontDb);
    const req = indexedDB.open('LunaFontDB', 4);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('fonts', { keyPath: 'id' });
    };
    req.onsuccess = e => { _fontDb = e.target.result; res(_fontDb); };
    req.onerror = () => rej();
  });
}

async function fontDbGetAll() {
  const db = await openFontDB();
  return new Promise(res => {
    const req = db.transaction('fonts').objectStore('fonts').getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror   = () => res([]);
  });
}

async function applyGlobalFont() {
  const style = JSON.parse(localStorage.getItem('luna_font_style') || '{}');
  const name  = localStorage.getItem('luna_font_active_name');
  const id    = parseInt(localStorage.getItem('luna_font_active_id'));

  // 从 IndexedDB 取字体数据，重新注册进浏览器
  if (name && id) {
    try {
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open('LunaFontDB', 4);
        req.onsuccess = e => res(e.target.result);
        req.onerror = () => rej();
      });
      const all = await new Promise(res => {
        const r = db.transaction('fonts').objectStore('fonts').getAll();
        r.onsuccess = () => res(r.result || []);
        r.onerror = () => res([]);
      });
      const f = all.find(x => x.id === id);
      if (f) {
        const face = new FontFace(name, `url(${f.data})`);
        await face.load();
        document.fonts.add(face);
      }
    } catch(e) {}
  }

  // 注入 <style> + !important，覆盖所有 CSS 写死的颜色
  let tag = document.getElementById('luna-font-override');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'luna-font-override';
    document.head.appendChild(tag);
  }
  const colorRule  = '';
const sizeRule   = '';
const familyRule = name ? `font-family: '${name}', sans-serif !important;` : '';
  // 排除装饰性组件，防止全局字体覆盖其内部排版（与原始一致）
  const EXCL = [
    '.bp-card', '.bp-card *',
    '.photo-diary-widget', '.photo-diary-widget *',
    '.friends-widget', '.friends-widget *',
    '.magazine-widget', '.magazine-widget *',
    '.music-widget', '.music-widget *',
    '.press-widget', '.press-widget *',
    '.luna-profile-card', '.luna-profile-card *',
  ].map(s => `:not(${s})`).join('');
  tag.textContent = `*${EXCL} { ${colorRule} ${sizeRule} ${familyRule} }`;
}

/* ── pageshow：防止 bfcache 快照 + 应用字体（1:1 复刻） ── */
window.addEventListener('pageshow', (e) => {
  if (e.persisted) window.location.reload();
  applyGlobalFont();
});

/* ── storage 监听：同步灵动岛、时区、字体（1:1 复刻） ── */
window.addEventListener('storage', e => {
  if (e.key === 'luna_island_update') applyIsland();
  if (e.key === 'luna_tz_update')     updateTime();
  if (e.key === 'luna_font_update')   applyGlobalFont();
});

/* ================================
   页面切换
================================ */
function switchPage(pageId, navEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const target = document.getElementById('page-' + pageId);
  if (target) target.classList.add('active');

  if (navEl && navEl.classList.contains('nav-item')) {
    navEl.classList.add('active');
  }

  if (navigator.vibrate) navigator.vibrate(8);

  // 对应页内动画
  const handlers = {
    workshop:  () => { animateNumbers(); animateGoalRing(); animateProgressBars(); },
    bookstore: () => { animateProgressBars(); },
    profile:   () => { animateProgressBars(); },
  };
  if (handlers[pageId]) setTimeout(handlers[pageId], 80);
}

/* ── 标签切换 ── */
function initTagChips() {
  document.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', function () {
      document.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
    });
  });
}

/* ── 卡片点按微动画 ── */
function initCardPress() {
  const pressEls = document.querySelectorAll(
    '.featured-card, .rank-item, .book-card, .draft-card, .work-item, .tool-item, .read-item, .setting-item, .badge-item'
  );
  pressEls.forEach(el => {
    el.addEventListener('touchstart', () => {
      el.style.transition = 'transform 0.12s cubic-bezier(0.34,1.56,0.64,1), opacity 0.12s';
      el.style.transform = 'scale(0.97)';
      el.style.opacity = '0.85';
    }, { passive: true });
    const restore = () => { el.style.transform = 'scale(1)'; el.style.opacity = '1'; };
    el.addEventListener('touchend', restore, { passive: true });
    el.addEventListener('touchcancel', restore, { passive: true });
  });
}

/* ── 今日目标 bar 动画 ── */
function animateGoalRing() {
  const barFill = document.querySelector('.goal-bar .goal-fill');
  if (!barFill) return;
  barFill.style.width = '0';
  setTimeout(() => {
    barFill.style.transition = 'width 1.2s cubic-bezier(0.4,0,0.2,1)';
    barFill.style.width = '62%';
  }, 400);
}

/* ── 统计数字滚动动画 ── */
function animateNumbers() {
  animateCount(document.querySelector('.stat-card:nth-child(3) .stat-num'), 0, 7, 1200, false);
  animateCount(document.querySelector('.stat-card:nth-child(2) .stat-num'), 0, 12840, 1400, true);
}

function animateCount(el, from, to, duration, comma) {
  if (!el) return;
  const startTime = performance.now();
  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(from + (to - from) * eased);
    el.textContent = comma ? current.toLocaleString() : current;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ── 进度条动画 ── */
function animateProgressBars() {
  document.querySelectorAll('.rank-fill, .wp-fill, .read-fill').forEach(bar => {
    const target = bar.style.width;
    bar.style.width = '0';
    setTimeout(() => {
      bar.style.transition = 'width 0.9s cubic-bezier(0.4,0,0.2,1)';
      bar.style.width = target;
    }, 300);
  });
}

/* ── 搜索栏弹性反馈 ── */
function initSearchBar() {
  const sb = document.querySelector('.search-bar');
  if (!sb) return;
  sb.addEventListener('click', () => {
    sb.style.transition = 'transform 0.15s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.15s';
    sb.style.transform = 'scale(0.98)';
    sb.style.boxShadow = '0 0 0 2px #111';
    setTimeout(() => { sb.style.transform = 'scale(1)'; sb.style.boxShadow = 'none'; }, 180);
  });
}

/* ── 新建按钮动画 ── */
function initWhBtn() {
  const btn = document.querySelector('.wh-btn');
  if (!btn) return;
  btn.addEventListener('touchstart', () => {
    btn.style.transition = 'transform 0.12s cubic-bezier(0.34,1.56,0.64,1)';
    btn.style.transform = 'scale(0.93)';
  }, { passive: true });
  const release = () => { btn.style.transform = 'scale(1)'; };
  btn.addEventListener('touchend', release, { passive: true });
  btn.addEventListener('touchcancel', release, { passive: true });
}

/* ── 继续按钮 ── */
function initDraftBtn() {
  const btn = document.querySelector('.dc-btn-cont');
  if (!btn) return;
  btn.addEventListener('click', () => {
    btn.textContent = '载入中…';
    btn.style.opacity = '0.6';
    setTimeout(() => { btn.textContent = '继续'; btn.style.opacity = '1'; }, 1200);
  });
}

/* ── 初始化 ── */
document.addEventListener('DOMContentLoaded', () => {
  updateTime();
  setInterval(updateTime, 1000);

  updateBattery();
  applyIsland();
  applyGlobalFont();

  initTagChips();
  initCardPress();
  initSearchBar();
  initWhBtn();
  initDraftBtn();

  setTimeout(animateProgressBars, 200);
});

function setC(el) {
  document.querySelectorAll('#bottomNav .nav-item').forEach(i => i.classList.remove('c-active'));
  el.classList.add('c-active');
}

/* ================================
   新建故事向导
================================ */
const CS_STEPS = ['故事简介','书名','文风','故事人物','人物关系','加入 NPC','字数与章节'];
let csCur = 0;
let csTotal = 6, csCp = 2;

function openCreate() {
  csCur = 0;
  csRenderBar();
  csRenderFooter();
  switchPage('create', null);
  if (navigator.vibrate) navigator.vibrate(8);
  setTimeout(() => {
    csRestoreSynopsisCache();
    csRestoreStyleCache();
    chReset();
  }, 50);
}

function csRenderBar() {
  const bar = document.getElementById('createStepsBar');
  const lbl = document.getElementById('createStepLabel');
  if (!bar) return;
  bar.innerHTML = '';
  CS_STEPS.forEach((s, i) => {
    const d = document.createElement('div');
    d.className = 'cs-step-dot' + (i < csCur ? ' cs-done' : i === csCur ? ' cs-curr' : '');
    bar.appendChild(d);
    if (i < CS_STEPS.length - 1) {
      const l = document.createElement('div');
      l.className = 'cs-step-line';
      bar.appendChild(l);
    }
  });
  lbl.innerHTML = `第 <span>${csCur + 1}</span> 步 / ${CS_STEPS.length} &nbsp;—&nbsp; ${CS_STEPS[csCur]}`;
}

function csRenderFooter() {
  const f = document.getElementById('csFooter');
  const cb = document.getElementById('csCreateBtn');
  if (!f) return;
  if (csCur === 0) {
    f.innerHTML = `<button class="cs-btn-only" onclick="csGo(1)">下一步</button>`;
    if (cb) cb.classList.remove('cs-create-active');
  } else if (csCur === CS_STEPS.length - 1) {
    f.innerHTML = `<button class="cs-btn-prev" onclick="csGo(csCur-1)">上一步</button>`;
    if (cb) cb.classList.add('cs-create-active');
  } else {
    f.innerHTML = `<button class="cs-btn-prev" onclick="csGo(csCur-1)">上一步</button><button class="cs-btn-next" onclick="csGo(csCur+1)">下一步</button>`;
    if (cb) cb.classList.remove('cs-create-active');
  }
}

function csGo(n) {
  if (n < 0 || n >= CS_STEPS.length) return;
  document.getElementById('cs-panel-' + csCur).classList.remove('active');
  csCur = n;
  document.getElementById('cs-panel-' + csCur).classList.add('active');
  csRenderBar();
  csRenderFooter();
}

function csMode(step, mode) {
  const m0 = document.getElementById('cs' + step + '-m0');
  const m1 = document.getElementById('cs' + step + '-m1');
  const manual = document.getElementById('cs' + step + '-manual');
  const ai = document.getElementById('cs' + step + '-ai');
  if (mode === 0) {
    m0.classList.add('cs-sel'); m1.classList.remove('cs-sel');
    if (manual) manual.style.display = '';
    if (ai) ai.style.display = 'none';
  } else {
    m1.classList.add('cs-sel'); m0.classList.remove('cs-sel');
    if (manual) manual.style.display = 'none';
    if (ai) ai.style.display = '';
  }
}

function csPickAI(el) {
  el.closest('.cs-ai-box').querySelectorAll('.cs-ai-card').forEach(c => c.classList.remove('cs-picked'));
  el.classList.add('cs-picked');
}

function csPickStyle(el) {
  el.closest('.cs-style-grid').querySelectorAll('.cs-style-card').forEach(c => c.classList.remove('cs-picked'));
  el.classList.add('cs-picked');
}

function csAdj(type, d) {
  if (type === 'total') { csTotal = Math.max(2, Math.min(20, csTotal + d)); }
  else { csCp = Math.max(0, Math.min(Math.floor(csTotal / 2), csCp + d)); }
  if (csCp * 2 > csTotal) csTotal = csCp * 2;
  document.getElementById('csTotalNum').textContent = csTotal;
  document.getElementById('csCpNum').textContent = csCp;
  const left = csTotal - csCp * 2;
  document.getElementById('csCharHint').innerHTML =
    `总人数 ${csTotal} 人，包含 <b>${csCp} 对 CP（共 ${csCp * 2} 人）</b>，剩余 ${left} 人为其他角色。`;
}

function csToggleNPC(yes) {
  document.getElementById('npcYes').classList.toggle('cs-sel', yes);
  document.getElementById('npcNo').classList.toggle('cs-sel', !yes);
  document.getElementById('csNpcCards').style.display = yes ? 'flex' : 'none';
}

function csUpdateTotal() {
  const w = parseInt(document.getElementById('csWordsSlider').value);
  const c = parseInt(document.getElementById('csChapSlider').value);
  document.getElementById('csWordsVal').textContent = w.toLocaleString();
  document.getElementById('csChapVal').textContent = c;
  document.getElementById('csTotalWords').textContent = (w * c).toLocaleString();
}

/* ================================
   AI 生成 — 调用用户设置的模型
================================ */

// 通用 AI 请求函数
async function callAI(prompt) {
  const ai = getActiveAI();
  if (!ai.baseUrl || !ai.apiKey || !ai.model) {
    alert('请先在设置页配置并激活 AI 模型');
    return null;
  }
  const resp = await fetch(`${ai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ai.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: ai.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000
    })
  });
  if (!resp.ok) throw new Error(`请求失败 HTTP ${resp.status}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || null;
}

// 把简介列表渲染到卡片上
function csRenderSynopsisCards(list) {
  const resultBox = document.getElementById('cs0-ai-result');
  resultBox.style.display = '';
  const cards = resultBox.querySelectorAll('.cs-ai-card');
  list.forEach((item, i) => {
    if (cards[i]) {
      cards[i].querySelector('.cs-ai-card-title').textContent = item.title;
      cards[i].querySelector('.cs-ai-card-body').textContent = item.body.replace(/([。！？])([^"'\n])/g, '$1\n\n$2');
      cards[i].classList.remove('cs-picked');
    }
  });
  if (cards[0]) cards[0].classList.add('cs-picked');
}

// Step0：AI 生成故事简介3个方向（带缓存）
async function csGenSynopsis() {
  const keywords = document.getElementById('cs0Keywords')?.value.trim();
  if (!keywords) { alert('请先输入关键词'); return; }
  const allBtns = document.querySelectorAll('#cs0-ai .cs-gen-btn');
  allBtns.forEach(b => { b.textContent = '生成中…'; b.disabled = true; });
  try {
    const result = await callAI(
      `你是一位资深言情小说编辑，擅长写让读者心跳加速、欲罢不能的故事简介。\n` +
      `请根据关键词「${keywords}」生成3个言情小说故事方向。\n` +
      '每个方向要求：\n' +
      '1. 标题要有诗意或张力，不超过8个字\n' +
      '2. 简介至少200字，要有具体的人物、场景、情感冲突，用第三人称\n' +
      '3. 写出心动瞬间和情感张力，要有细节描写，像真实小说开篇，不能像简介介绍\n' +
      '4. 语言克制但有温度，避免堆砌形容词，禁止出现"命运""羁绊""救赎"等烂俗词\n' +
      '5. 结尾留悬念，让读者想继续看\n' +
      '严格按以下JSON格式返回，不要加任何其他文字：\n' +
      '[{"title":"标题1","body":"简介1"},{"title":"标题2","body":"简介2"},{"title":"标题3","body":"简介3"}]'
    );
    if (!result) return;
    const list = JSON.parse(result.replace(/```json|```/g, '').trim());
    // 存到 localStorage
    localStorage.setItem('cs_synopsis_cache', JSON.stringify({ keywords, list }));
    csRenderSynopsisCards(list);
  } catch(e) {
    alert('生成失败：' + e.message);
  } finally {
    allBtns.forEach(b => { b.textContent = b.closest('#cs0-ai-result') ? '重新生成' : 'AI 生成'; b.disabled = false; });
  }
}

// 打开创建页时恢复缓存
function csRestoreSynopsisCache() {
  try {
    const raw = localStorage.getItem('cs_synopsis_cache');
    if (!raw) return;
    const { keywords, list } = JSON.parse(raw);
    if (!list || !list.length) return;
    // 填回关键词输入框
    const kwInput = document.getElementById('cs0Keywords');
    if (kwInput) kwInput.value = keywords || '';
    // 渲染卡片
    csRenderSynopsisCards(list);
  } catch(e) {}
}

// Step1：AI 生成书名（读取第一步简介）
async function csGenTitle() {
  const btn = document.querySelector('#cs1-ai .cs-gen-btn');
  if (!btn) return;
  btn.textContent = '生成中…';
  btn.disabled = true;
  try {
    // 读取第一步内容：优先用AI选中的卡片，其次用手动输入
    const pickedCard = document.querySelector('#cs0-ai-result .cs-ai-card.cs-picked .cs-ai-card-body');
    const manualText = document.querySelector('#cs0-manual textarea')?.value || '';
    const synopsis = pickedCard?.textContent || manualText || '暂无简介';

    const result = await callAI(
      `你是一位资深言情小说编辑，请根据以下故事简介，生成5个书名。\n\n故事简介：${synopsis}\n\n` +
      '要求：\n' +
      '1. 书名2-10个字，有诗意或张力\n' +
      '2. 要让读者一眼就想点开\n' +
      '3. 风格要贴合简介的情感基调\n' +
      '4. 禁止用"命运""羁绊""救赎""彼岸"等烂俗词\n' +
      '严格按以下JSON格式返回，不要加任何其他文字：\n' +
      '[{"title":"书名1","reason":"一句话说明理由"},{"title":"书名2","reason":"一句话说明理由"},{"title":"书名3","reason":"一句话说明理由"},{"title":"书名4","reason":"一句话说明理由"},{"title":"书名5","reason":"一句话说明理由"}]'
    );
    if (!result) return;
    const list = JSON.parse(result.replace(/```json|```/g, '').trim());
    const box = document.querySelector('#cs1-ai .cs-ai-box');
    // 动态生成5张卡片
    box.innerHTML = '<div class="cs-ai-title">AI 为你生成了 5 个书名，选一个</div>' +
      list.map(item => `
        <div class="cs-ai-card" onclick="csPickAI(this)">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
            <div>
              <div class="cs-ai-card-title">《${item.title}》</div>
              <div class="cs-ai-card-body">${item.reason}</div>
            </div>
            <div class="cs-pick-mark"></div>
          </div>
        </div>
      `).join('');
    // 默认选中第一个
    box.querySelector('.cs-ai-card')?.classList.add('cs-picked');
  } catch(e) {
    alert('生成失败：' + e.message);
  } finally {
    btn.textContent = '重新生成';
    btn.disabled = false;
  }
}

// 读取第一步简介（AI选中卡片优先，其次手动输入）
function getSynopsis() {
  const pickedCard = document.querySelector('#cs0-ai-result .cs-ai-card.cs-picked .cs-ai-card-body');
  const manualText = document.querySelector('#cs0-manual textarea')?.value || '';
  return pickedCard?.textContent || manualText || '暂无简介';
}

// Step2：AI 推荐文风（结合简介，结果存 localStorage）
async function csGenStyle() {
  const btn = document.getElementById('cs2GenBtn');
  btn.textContent = '生成中…'; btn.disabled = true;
  try {
    const synopsis = getSynopsis();
    const result = await callAI(
      `你是资深言情小说编辑，根据以下故事简介推荐4种最适合的文风：\n${synopsis}\n\n` +
      '要求每种文风有名称和一句话特点描述，风格要贴合故事情感基调。\n' +
      '严格按以下JSON格式返回，不要加任何其他文字：\n' +
      '[{"name":"文风名","desc":"一句话描述"},{"name":"文风名","desc":"一句话描述"},{"name":"文风名","desc":"一句话描述"},{"name":"文风名","desc":"一句话描述"}]'
    );
    if (!result) return;
    const list = JSON.parse(result.replace(/```json|```/g, '').trim());
    // 存到 localStorage（文风本身永久保存，和简介无关）
    localStorage.setItem('cs_style_cache', JSON.stringify(list));
    csRenderStyleCards(list);
  } catch(e) {
    alert('生成失败：' + e.message);
  } finally {
    btn.textContent = '重新生成'; btn.disabled = false;
  }
}

// 渲染文风卡片
function csRenderStyleCards(list) {
  const grid = document.getElementById('cs2StyleGrid');
  grid.innerHTML = list.map((item, i) => `
    <div class="cs-style-card ${i === 0 ? 'cs-picked' : ''}" onclick="csPickStyle(this)">
      <div class="cs-style-name">${item.name}</div>
      <div class="cs-style-desc">${item.desc}</div>
    </div>
  `).join('');
  // 显示试读区
  document.getElementById('cs2PreviewBox').style.display = '';
  document.getElementById('cs2PreviewText').textContent = '';
}

// 恢复文风缓存（进入页面时调用）
function csRestoreStyleCache() {
  try {
    const raw = localStorage.getItem('cs_style_cache');
    if (!raw) return;
    const list = JSON.parse(raw);
    if (!list || !list.length) return;
    csRenderStyleCards(list);
    document.getElementById('cs2GenBtn').textContent = '重新生成';
  } catch(e) {}
}

// 生成试读片段（结合当前简介+选中文风，不存储）
async function csGenStylePreview() {
  const btn = document.getElementById('cs2PreviewBtn');
  const output = document.getElementById('cs2PreviewText');
  const pickedStyle = document.querySelector('#cs2StyleGrid .cs-style-card.cs-picked .cs-style-name')?.textContent;
  if (!pickedStyle) { alert('请先选择一种文风'); return; }
  btn.textContent = '生成中…'; btn.disabled = true;
  output.textContent = '';
  try {
    const synopsis = getSynopsis();
    const result = await callAI(
      `请用「${pickedStyle}」的文风，根据以下故事简介写一段约150字的小说开篇片段，要有画面感和情感张力：\n${synopsis}`
    );
    if (!result) return;
    output.textContent = result.trim();
  } catch(e) {
    alert('生成失败：' + e.message);
  } finally {
    btn.textContent = '重新生成试读'; btn.disabled = false;
  }
}
/* ================================================================
   Step 3 — 角色系统（生成 / 选择 / 配对 / 头像 / IndexedDB 保存）
================================================================ */

/* ---- 状态 ---- */
let chPickedChars   = [];   // 用户已选中的角色 [{id,name,role,gender,isLead,tags,desc}]
let chCandidates    = [];   // 当前 AI 生成的候选（未被选中的）
let chPairings      = [];   // CP 配对 [{slot, charA, charB}]
let chAvatars       = {};   // { charId: base64DataUrl }
let chAllFinal      = [];   // 最终所有角色（选定的）

/* ---- IndexedDB ---- */
let _charDb = null;
function openCharDB() {
  return new Promise((res, rej) => {
    if (_charDb) return res(_charDb);
    const req = indexedDB.open('NovelCharDB', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('characters'))
        db.createObjectStore('characters', { keyPath: 'storyId' });
    };
    req.onsuccess = e => { _charDb = e.target.result; res(_charDb); };
    req.onerror = () => rej(new Error('无法打开角色数据库'));
  });
}
async function charDbSave(storyId, data) {
  const db = await openCharDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('characters', 'readwrite');
    tx.objectStore('characters').put({ storyId, ...data, savedAt: Date.now() });
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(new Error('保存失败'));
  });
}

/* ---- 工具 ---- */
function chGetStoryId() {
  // 用简介前10字 + 时间戳 作为故事 ID
  const synopsis = getSynopsis().slice(0, 10);
  if (!window._chStoryId) window._chStoryId = synopsis + '_' + Date.now();
  return window._chStoryId;
}

function chUpdateProgress() {
  const need = csTotal;
  const got  = chPickedChars.length;
  const pct  = Math.min(100, Math.round(got / need * 100));
  const fill = document.getElementById('chProgressFill');
  const txt  = document.getElementById('chProgressTxt');
  if (fill) fill.style.width = pct + '%';
  if (txt)  txt.textContent = `已选 ${got} / 需选 ${need}`;
}

/* 根据角色性别 + isLead 确定 badge class */
function chLeadBadgeHtml(char) {
  if (char.isLead === 'male')   return '<span class="ch-lead-badge male">男主</span>';
  if (char.isLead === 'female') return '<span class="ch-lead-badge female">女主</span>';
  return '';
}

function chBorderClass(char) {
  if (char.isLead === 'male')   return ' ch-lead-m';
  if (char.isLead === 'female') return ' ch-lead-f';
  return '';
}

/* 渲染一张角色卡（可选中） */
function chCardHtml(char, inPool) {
  const badge = chLeadBadgeHtml(char);
  const border = chBorderClass(char);
  const action = inPool
    ? `onclick="chPickChar('${char.id}')"`
    : `onclick="chUnpickChar('${char.id}')"`;
  const tagsHtml = (char.tags || []).map(t =>
    `<span class="cs-char-tag">${t}</span>`
  ).join('');
  return `
    <div class="cs-char-card${border}" id="chCard_${char.id}" ${action}>
      ${badge ? `<div style="margin-bottom:2px">${badge}</div>` : ''}
      <div class="cs-char-name">${char.name}</div>
      <div class="cs-char-role">${char.role} · ${char.gender === 'male' ? '男' : '女'}</div>
      <div class="cs-char-tags">${tagsHtml}</div>
      ${char.desc ? `<div class="cs-char-role" style="margin-top:5px;font-size:10px;line-height:1.4;color:#999">${char.desc}</div>` : ''}
    </div>`;
}

/* ---- 阶段 A：AI 生成角色 ---- */
async function csGenCharacters() {
  const btn = document.querySelector('#ch-phase-a .cs-btn-next');
  btn.textContent = '生成中…'; btn.disabled = true;

  try {
    const synopsis = getSynopsis();
    const cpCount = csCp;
    const totalCount = csTotal;
    const otherCount = totalCount - cpCount * 2;

    const prompt =
      `你是资深言情小说编辑。根据以下故事简介，为小说生成 ${totalCount} 个角色。\n` +
      `故事简介：${synopsis}\n\n` +
      `角色构成：\n` +
      `- ${cpCount} 对 CP，每对必须有一男一女\n` +
      `- 其中第一对CP的男生是"男主"，女生是"女主"\n` +
      (cpCount > 1 ? `- 其余 ${cpCount - 1} 对 CP 为"其他CP"\n` : '') +
      (otherCount > 0 ? `- 还有 ${otherCount} 个非CP的其他角色（男女不限）\n` : '') +
      `\n要求：\n` +
      `1. 角色名字有中文美感，符合故事背景\n` +
      `2. 职业/身份要和简介贴合\n` +
      `3. 性格标签2-3个，要有个人特色，禁止"霸道""腹黑""温柔"这类烂大街标签\n` +
      `4. 每个角色一句话人设描述（20字内），要有记忆点\n` +
      `5. isLead字段：男主填"male"，女主填"female"，其他所有人填"other"\n` +
      `严格按以下JSON格式返回，不要加任何其他文字：\n` +
      `[{"name":"名字","role":"职业/身份","gender":"male或female","isLead":"male或female或other","tags":["标签1","标签2"],"desc":"一句话人设"}]`;

    const raw = await callAI(prompt);
    if (!raw) return;
    const list = JSON.parse(raw.replace(/```json|```/g, '').trim());

    // 给每个角色加 id
    chCandidates = list.map((c, i) => ({ ...c, id: 'c' + Date.now() + i }));
    chPickedChars = [];
    chAvatars = {};
    chPairings = [];

    // 切到阶段 B
    document.getElementById('ch-phase-a').style.display = 'none';
    document.getElementById('ch-phase-b').style.display = '';
    chRenderPhaseB();

  } catch(e) {
    alert('生成失败：' + e.message);
  } finally {
    btn.textContent = '✦ AI 生成人物'; btn.disabled = false;
  }
}

/* ---- 阶段 B：选择 ---- */
function chRenderPhaseB() {
  chUpdateProgress();

  // 已选区
  const pickedSection = document.getElementById('chPickedSection');
  const pickedGrid = document.getElementById('chPickedGrid');
  if (chPickedChars.length > 0) {
    pickedSection.style.display = '';
    pickedGrid.innerHTML = chPickedChars.map(c => chCardHtml(c, false)).join('');
  } else {
    pickedSection.style.display = 'none';
    pickedGrid.innerHTML = '';
  }

  // 候选区
  const candidateGrid = document.getElementById('chCandidateGrid');
  const candidateLbl  = document.getElementById('chCandidateLbl');
  if (chCandidates.length > 0) {
    candidateLbl.style.display = '';
    candidateGrid.innerHTML = chCandidates.map(c => chCardHtml(c, true)).join('');
  } else {
    candidateLbl.style.display = 'none';
    candidateGrid.innerHTML = '';
  }

  // 重新生成区
  const remaining = csTotal - chPickedChars.length;
  const regenBox  = document.getElementById('chRegenBox');
  const doneBar   = document.getElementById('chDoneBar');

  if (chCandidates.length === 0 && remaining > 0) {
    // 候选已全部选走，还没选满 → 显示重新生成
    regenBox.style.display = '';
    document.getElementById('chRegenCount').textContent = remaining;
    doneBar.style.display = 'none';
  } else if (remaining <= 0) {
    // 选满了
    regenBox.style.display = 'none';
    doneBar.style.display = '';
  } else {
    // 还有候选可以选，同时也可重生成不满意的
    if (chCandidates.length < remaining) {
      // 候选比剩余需要的少，显示重生成按钮
      regenBox.style.display = '';
      document.getElementById('chRegenCount').textContent = remaining;
    } else {
      regenBox.style.display = '';
      document.getElementById('chRegenCount').textContent = remaining - chCandidates.length > 0
        ? remaining - chCandidates.length : chCandidates.length;
    }
    doneBar.style.display = 'none';
  }
}

/* 选中候选 */
function chPickChar(id) {
  const idx = chCandidates.findIndex(c => c.id === id);
  if (idx === -1) return;
  const char = chCandidates.splice(idx, 1)[0];
  chPickedChars.push(char);
  chRenderPhaseB();
}

/* 取消选中，放回候选 */
function chUnpickChar(id) {
  const idx = chPickedChars.findIndex(c => c.id === id);
  if (idx === -1) return;
  const char = chPickedChars.splice(idx, 1)[0];
  chCandidates.push(char);
  chRenderPhaseB();
}

/* 重新生成不满意的 */
async function csRegenCharacters() {
  const btn = document.getElementById('chRegenBtn');
  const feedback = document.getElementById('chRegenFeedback').value.trim();
  btn.textContent = '生成中…'; btn.disabled = true;

  try {
    const synopsis = getSynopsis();
    const remaining = csTotal - chPickedChars.length;
    const pickedNames = chPickedChars.map(c => c.name).join('、');

    const prompt =
      `你是资深言情小说编辑。故事简介：${synopsis}\n\n` +
      `已经选定的角色：${pickedNames || '无'}\n` +
      `现在需要重新生成 ${remaining} 个新的候选角色，不能与已选角色重复。\n` +
      (feedback ? `用户反馈（请据此改进）：${feedback}\n` : '') +
      `角色需求：根据简介，为剩余角色位置设计合适人选。\n` +
      `已选中是否包含男主：${chPickedChars.some(c => c.isLead === 'male') ? '是' : '否'}\n` +
      `已选中是否包含女主：${chPickedChars.some(c => c.isLead === 'female') ? '是' : '否'}\n` +
      `注意：如果男主/女主还没被选，新生成的角色里要包含。\n\n` +
      `要求：名字有美感，职业贴合简介，性格标签有特色，一句话人设有记忆点。\n` +
      `isLead：如需补男主填"male"，补女主填"female"，其他填"other"。\n` +
      `严格按JSON格式返回：\n` +
      `[{"name":"名字","role":"职业/身份","gender":"male或female","isLead":"male或female或other","tags":["标签1","标签2"],"desc":"一句话人设"}]`;

    const raw = await callAI(prompt);
    if (!raw) return;
    const list = JSON.parse(raw.replace(/```json|```/g, '').trim());
    chCandidates = list.map((c, i) => ({ ...c, id: 'r' + Date.now() + i }));
    document.getElementById('chRegenFeedback').value = '';
    chRenderPhaseB();

  } catch(e) {
    alert('重新生成失败：' + e.message);
  } finally {
    btn.textContent = '重新生成'; btn.disabled = false;
  }
}

/* ---- 阶段 C：拖动配对 ---- */
function chGoToPairing() {
  // 确保男女主都在已选中
  const hasLeadM = chPickedChars.some(c => c.isLead === 'male');
  const hasLeadF = chPickedChars.some(c => c.isLead === 'female');
  if (!hasLeadM || !hasLeadF) {
    alert('你的角色中还没有男主或女主！请确保生成时包含男女主角色。');
    return;
  }

  chAllFinal = [...chPickedChars];
  // 分 CP 角色（前 csCp*2 中的男女）和其他角色
  // 初始化：pairings 为空
  chPairings = Array.from({ length: csCp }, (_, i) => ({
    slot: i, charA: null, charB: null
  }));

  document.getElementById('ch-phase-b').style.display = 'none';
  document.getElementById('ch-phase-c').style.display = '';
  chRenderPhaseC();
}

function chRenderPhaseC() {
  // 已被配对的角色 id 集合
  const pairedIds = new Set();
  chPairings.forEach(p => {
    if (p.charA) pairedIds.add(p.charA.id);
    if (p.charB) pairedIds.add(p.charB.id);
  });

  // 角色池：未配对的角色
  const poolList = document.getElementById('chPoolList');
  const unpaired = chAllFinal.filter(c => !pairedIds.has(c.id));
  poolList.innerHTML = unpaired.map(c => chDragChipHtml(c)).join('');

  // CP 卡槽
  const slotsWrap = document.getElementById('chSlotsWrap');
  slotsWrap.innerHTML = chPairings.map((p, i) => {
    const isFirst = i === 0;
    const complete = p.charA && p.charB;
    return `
      <div class="ch-cp-slot${complete ? ' ch-slot-complete' : ''}" id="chSlot_${i}"
           data-slot="${i}"
           ondragover="chDragOver(event)" ondrop="chDrop(event, ${i})"
           ontouchmove="chTouchMove(event)" ontouchend="chTouchEnd(event, ${i})">
        <div class="ch-slot-label">
          ${isFirst ? '⭐ 主 CP' : `CP ${i + 1}`}
          ${isFirst ? '<span style="font-size:9px;color:#f43f5e;margin-left:4px">（必须包含男女主）</span>' : ''}
        </div>
        <div class="ch-slot-pair">
          <div class="ch-slot-half${p.charA ? ' filled' : ''}" id="chSlotA_${i}"
               ondragover="chDragOver(event)" ondrop="chDrop(event, ${i}, 'A')"
               ontouchmove="chTouchMove(event)" ontouchend="chTouchEnd(event, ${i}, 'A')">
            ${p.charA ? chSlotChipHtml(p.charA, i, 'A') : '<span class="ch-slot-half-hint">拖入角色</span>'}
          </div>
          <div class="ch-slot-heart">♥</div>
          <div class="ch-slot-half${p.charB ? ' filled' : ''}" id="chSlotB_${i}"
               ondragover="chDragOver(event)" ondrop="chDrop(event, ${i}, 'B')"
               ontouchmove="chTouchMove(event)" ontouchend="chTouchEnd(event, ${i}, 'B')">
            ${p.charB ? chSlotChipHtml(p.charB, i, 'B') : '<span class="ch-slot-half-hint">拖入角色</span>'}
          </div>
        </div>
      </div>`;
  }).join('');

  // 其他角色展示
  const cpIds = new Set();
  chPairings.forEach(p => {
    if (p.charA) cpIds.add(p.charA.id);
    if (p.charB) cpIds.add(p.charB.id);
  });
  const others = chAllFinal.filter(c => !cpIds.has(c.id) && pairedIds.has(c.id) === false);
  // 已在角色池的就是待配对，不算"其他"；真正的"其他"是 csTotal - cpCount*2 个
  const otherChars = chAllFinal.filter(c => !pairedIds.has(c.id) && unpaired.find(u => u.id === c.id) === undefined);

  // 初始化 touch drag
  chInitTouchDrag();

  // 检查是否配对完成
  chCheckPairingDone();
}

function chDragChipHtml(char) {
  const av = chAvatars[char.id]
    ? `<img src="${chAvatars[char.id]}" />`
    : char.name[0];
  return `
    <div class="ch-drag-chip" id="chip_${char.id}"
         draggable="true"
         ondragstart="chDragStart(event, '${char.id}')"
         data-charid="${char.id}">
      <div class="ch-drag-chip-avatar">${av}</div>
      <div>
        <div class="ch-drag-chip-name">${char.name}</div>
        <div class="ch-drag-chip-role">${char.gender === 'male' ? '男' : '女'} · ${char.role}</div>
      </div>
    </div>`;
}

function chSlotChipHtml(char, slotIdx, side) {
  const av = chAvatars[char.id]
    ? `<img src="${chAvatars[char.id]}" />`
    : char.name[0];
  return `
    <div class="ch-slot-chip">
      <div class="ch-slot-chip-avatar">${av}</div>
      <div class="ch-slot-chip-info">
        <div class="ch-slot-chip-name">${char.name}</div>
        <div class="ch-slot-chip-role">${char.role}</div>
      </div>
      <div class="ch-slot-remove" onclick="chRemoveFromSlot(${slotIdx}, '${side}')">✕</div>
    </div>`;
}

/* 拖拽 — 桌面端 */
let chDragCharId = null;
function chDragStart(e, charId) {
  chDragCharId = charId;
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => {
    const el = document.getElementById('chip_' + charId);
    if (el) el.classList.add('ch-dragging');
  }, 0);
}
function chDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('ch-slot-over');
}
function chDrop(e, slotIdx, side) {
  e.preventDefault();
  e.currentTarget.classList.remove('ch-slot-over');
  if (!chDragCharId) return;
  chPlaceChar(chDragCharId, slotIdx, side);
  chDragCharId = null;
}

/* 拖拽 — 触摸端 */
let chTouchChar = null, chTouchEl = null, chTouchClone = null;
function chInitTouchDrag() {
  document.querySelectorAll('.ch-drag-chip').forEach(chip => {
    chip.addEventListener('touchstart', e => {
      chTouchChar = chip.dataset.charid;
      chTouchEl = chip;
      // 创建跟随克隆
      chTouchClone = chip.cloneNode(true);
      chTouchClone.style.cssText = `
        position: fixed; opacity: 0.85; pointer-events: none; z-index: 9999;
        transform: scale(1.05); transition: none;
      `;
      document.body.appendChild(chTouchClone);
    }, { passive: true });
  });
}
function chTouchMove(e) {
  if (!chTouchClone) return;
  const t = e.touches[0];
  chTouchClone.style.left = (t.clientX - 50) + 'px';
  chTouchClone.style.top  = (t.clientY - 20) + 'px';
}
function chTouchEnd(e, slotIdx, side) {
  if (chTouchClone) { chTouchClone.remove(); chTouchClone = null; }
  if (!chTouchChar) return;
  chPlaceChar(chTouchChar, slotIdx, side);
  chTouchChar = null;
}

/* 放入卡槽 */
function chPlaceChar(charId, slotIdx, side) {
  const char = chAllFinal.find(c => c.id === charId);
  if (!char) return;

  const p = chPairings[slotIdx];
  // 如果已在其他槽，先移除
  chPairings.forEach(pair => {
    if (pair.charA && pair.charA.id === charId) pair.charA = null;
    if (pair.charB && pair.charB.id === charId) pair.charB = null;
  });

  // 放入指定槽位
  if (side === 'A') { p.charA = char; }
  else if (side === 'B') { p.charB = char; }
  else {
    // 没有指定 side，自动填入空位
    if (!p.charA) p.charA = char;
    else if (!p.charB) p.charB = char;
    else { p.charA = char; } // 替换 A
  }

  chRenderPhaseC();
}

/* 移出卡槽 */
function chRemoveFromSlot(slotIdx, side) {
  const p = chPairings[slotIdx];
  if (side === 'A') p.charA = null;
  else p.charB = null;
  chRenderPhaseC();
}

/* 检查配对完成 */
function chCheckPairingDone() {
  const allFilled = chPairings.every(p => p.charA && p.charB);
  const warnEl = document.getElementById('chPairingWarn');
  const doneBar = document.getElementById('chPairDoneBar');

  if (!allFilled) { doneBar.style.display = 'none'; return; }

  // 检查第一对 CP 必须包含男主和女主
  const firstPair = chPairings[0];
  const hasLeadM = (firstPair.charA && firstPair.charA.isLead === 'male') || (firstPair.charB && firstPair.charB.isLead === 'male');
  const hasLeadF = (firstPair.charA && firstPair.charA.isLead === 'female') || (firstPair.charB && firstPair.charB.isLead === 'female');

  if (!hasLeadM || !hasLeadF) {
    warnEl.style.display = '';
    doneBar.style.display = 'none';
  } else {
    warnEl.style.display = 'none';
    doneBar.style.display = '';
  }

  // 展示其他角色
  const pairedIds = new Set();
  chPairings.forEach(p => {
    if (p.charA) pairedIds.add(p.charA.id);
    if (p.charB) pairedIds.add(p.charB.id);
  });
  const others = chAllFinal.filter(c => !pairedIds.has(c.id));
  const otherBox = document.getElementById('chOtherCharsBox');
  const otherGrid = document.getElementById('chOtherCharGrid');
  if (others.length > 0) {
    otherBox.style.display = '';
    otherGrid.innerHTML = others.map(c => chCardHtml(c, false)).join('');
  } else {
    otherBox.style.display = 'none';
  }
}

/* ---- 阶段 D：上传头像 ---- */
function chGoToAvatar() {
  document.getElementById('ch-phase-c').style.display = 'none';
  document.getElementById('ch-phase-d').style.display = '';
  chRenderAvatarList();
}

function chRenderAvatarList() {
  const list = document.getElementById('chAvatarList');
  // 所有角色
  list.innerHTML = chAllFinal.map(char => {
    const av = chAvatars[char.id];
    const badge = chLeadBadgeHtml(char);
    const cpInfo = (() => {
      for (let i = 0; i < chPairings.length; i++) {
        const p = chPairings[i];
        if ((p.charA && p.charA.id === char.id) || (p.charB && p.charB.id === char.id)) {
          const partner = (p.charA && p.charA.id === char.id) ? p.charB : p.charA;
          return partner ? ` × ${partner.name}` : '';
        }
      }
      return '';
    })();
    return `
      <div class="ch-avatar-item">
        <div class="ch-avatar-preview${av ? ' has-img' : ''}" onclick="chTriggerUpload('${char.id}')" id="chAvPrev_${char.id}">
          ${av ? `<img src="${av}" />` : `<span class="ch-avatar-placeholder">＋</span>`}
        </div>
        <div class="ch-avatar-info">
          <div class="ch-avatar-name">${badge ? badge + ' ' : ''}${char.name}${cpInfo}</div>
          <div class="ch-avatar-role">${char.role} · ${char.gender === 'male' ? '男' : '女'}</div>
        </div>
        <label class="ch-avatar-upload-btn" for="chAvInput_${char.id}">
          ${av ? '更换' : '上传'}
        </label>
        <input class="ch-avatar-input" type="file" accept="image/*"
          id="chAvInput_${char.id}" onchange="chHandleAvatar(event,'${char.id}')">
      </div>`;
  }).join('');
  chRenderPreview();
}

function chTriggerUpload(charId) {
  document.getElementById('chAvInput_' + charId)?.click();
}

function chHandleAvatar(e, charId) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    chAvatars[charId] = ev.target.result;
    chRenderAvatarList();
  };
  reader.readAsDataURL(file);
}

function chRenderPreview() {
  const previewSection = document.getElementById('chPreviewSection');
  const previewGrid = document.getElementById('chPreviewGrid');
  const hasAny = Object.keys(chAvatars).length > 0;
  previewSection.style.display = hasAny ? '' : 'none';

  previewGrid.innerHTML = chAllFinal.map(char => {
    const av = chAvatars[char.id];
    const badge = char.isLead === 'male' ? '<span class="ch-preview-badge male">男主</span>'
                : char.isLead === 'female' ? '<span class="ch-preview-badge female">女主</span>' : '';
    const cpInfo = (() => {
      for (let i = 0; i < chPairings.length; i++) {
        const p = chPairings[i];
        if ((p.charA && p.charA.id === char.id) || (p.charB && p.charB.id === char.id)) {
          const partner = (p.charA && p.charA.id === char.id) ? p.charB : p.charA;
          return partner ? `<div class="ch-preview-cp">♥ ${partner.name}</div>` : '';
        }
      }
      return '';
    })();
    return `
      <div class="ch-preview-card">
        <div class="ch-preview-avatar">
          ${av ? `<img src="${av}" />` : char.name[0]}
        </div>
        ${badge}
        <div class="ch-preview-name">${char.name}</div>
        <div class="ch-preview-role">${char.role}</div>
        ${cpInfo}
      </div>`;
  }).join('');
}

/* ---- 保存到 IndexedDB ---- */
async function chSaveAll() {
  const btn = document.getElementById('chSaveBtn');
  btn.textContent = '保存中…'; btn.disabled = true;

  try {
    const storyId = chGetStoryId();
    const data = {
      characters: chAllFinal.map(c => ({
        ...c,
        avatar: chAvatars[c.id] || null
      })),
      pairings: chPairings.map(p => ({
        slot: p.slot,
        charAId: p.charA ? p.charA.id : null,
        charBId: p.charB ? p.charB.id : null,
        cpName: p.charA && p.charB ? `${p.charA.name} × ${p.charB.name}` : ''
      })),
      totalCount: csTotal,
      cpCount: csCp,
    };

    await charDbSave(storyId, data);

    // 切到完成阶段
    document.getElementById('ch-phase-d').style.display = 'none';
    document.getElementById('ch-phase-e').style.display = '';
    chRenderDone(data);

  } catch(e) {
    alert('保存失败：' + e.message);
  } finally {
    btn.textContent = '保存所有角色设定'; btn.disabled = false;
  }
}

function chRenderDone(data) {
  const cpNames = data.pairings.map(p => p.cpName).filter(Boolean).join('  /  ');
  document.getElementById('chDoneSub').textContent =
    `共 ${data.totalCount} 位角色 · ${data.cpCount} 对 CP` + (cpNames ? `：${cpNames}` : '');

  const chipsHtml = data.characters.map(c => {
    const av = c.avatar
      ? `<img src="${c.avatar}" />`
      : c.name[0];
    return `
      <div class="ch-done-chip">
        <div class="ch-done-chip-av">${av}</div>
        <div class="ch-done-chip-name">${c.name}</div>
      </div>`;
  }).join('');
  document.getElementById('chDoneChars').innerHTML = chipsHtml;
}

/* ---- 重置（进入新建页时） ---- */
function chReset() {
  chPickedChars = [];
  chCandidates = [];
  chPairings = [];
  chAvatars = {};
  chAllFinal = [];
  window._chStoryId = null;

  // 显示阶段 A，隐藏其他
  ['ch-phase-a','ch-phase-b','ch-phase-c','ch-phase-d','ch-phase-e'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.style.display = i === 0 ? '' : 'none';
  });
}