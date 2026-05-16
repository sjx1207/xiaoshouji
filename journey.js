/* ================================
   Journey — journey.js
   旅程首页交互逻辑
================================ */

/* ---- 状态栏时间（一比一复刻 chat.js） ---- */
function updateTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeStr = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const el = document.getElementById('statusTime');
  if (el) el.textContent = timeStr;
}

/* ---- 电量（一比一复刻 chat.js） ---- */
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
  } else {
    render(76);
  }
}

/* ---- 灵动岛（一比一复刻 chat.js 思路，黑色胶囊） ---- */
function initIsland() {
  const island = document.getElementById('statusIsland');
  if (!island) return;

  island.innerHTML = `
    <div style="
      width:120px; height:34px;
      background:#000;
      border-radius:20px;
      display:flex; align-items:center; justify-content:center;
      gap:7px;
    ">
      <div style="
        width:8px; height:8px; border-radius:50%;
        background:#4ade80;
        animation:islandPulse 2s ease-in-out infinite;
      "></div>
      <span style="
        font-family:'Space Mono',monospace;
        font-size:9px; letter-spacing:1.5px;
        color:rgba(255,255,255,0.7);
        text-transform:uppercase;
      ">Journey</span>
    </div>
  `;

  /* 注入岛的专属 keyframe（避免重复） */
  if (!document.getElementById('islandStyle')) {
    const s = document.createElement('style');
    s.id = 'islandStyle';
    s.textContent = `
      @keyframes islandPulse {
        0%,100% { opacity:.5; transform:scale(1); }
        50%      { opacity:1;  transform:scale(1.15); }
      }
    `;
    document.head.appendChild(s);
  }
}

/* ---- 返回按钮 ---- */
function initBackBtn() {
  const btn = document.getElementById('jnyBackBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    /* 如果在 chatroom 环境内嵌，通知父页面；否则 history.back */
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'jny_back' }, '*');
    } else {
      history.back();
    }
  });
}

/* ---- 踏上旅程按钮 → 跳转到路线规划页 ---- */
function initStartBtn() {
  const btn = document.getElementById('jnyStartBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    if (navigator.vibrate) navigator.vibrate(12);
    showRoutePage();
  });
}

/* ---- 路线规划页：显示/隐藏 ---- */
function showRoutePage() {
  document.querySelector('.jny-wrap').style.display = 'none';
  const rw = document.getElementById('routeWrap');
  rw.style.display = '';
  initRoutePage();
}

function hideRoutePage() {
  document.getElementById('routeWrap').style.display = 'none';
  document.querySelector('.jny-wrap').style.display = '';
}

/* ---- 路线规划页：返回按钮 ---- */
function initRouteBackBtn() {
  const btn = document.getElementById('routeBackBtn');
  if (!btn) return;
  btn.addEventListener('click', hideRoutePage);
}

/* ---- 路线规划页：状态栏同步 ---- */
function syncRouteStatusBar() {
  /* 时间 */
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeStr = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const tEl = document.getElementById('routeStatusTime');
  if (tEl) tEl.textContent = timeStr;

  /* 灵动岛 */
  const island = document.getElementById('routeStatusIsland');
  if (island && !island.dataset.init) {
    island.dataset.init = '1';
    island.innerHTML = `
      <div style="width:120px;height:34px;background:#000;border-radius:20px;
        display:flex;align-items:center;justify-content:center;gap:7px;">
        <div style="width:8px;height:8px;border-radius:50%;background:#4ade80;
          animation:islandPulse 2s ease-in-out infinite;"></div>
        <span style="font-family:'Space Mono',monospace;font-size:9px;
          letter-spacing:1.5px;color:rgba(255,255,255,0.7);text-transform:uppercase;">
          Route
        </span>
      </div>`;
  }

  /* 电量 */
  const pctEl   = document.getElementById('routeBatPct');
  const innerEl = document.getElementById('routeBatInner');
  if (pctEl && innerEl) {
    const main = document.getElementById('batPct');
    const pct  = main ? parseInt(main.textContent) : 76;
    pctEl.textContent  = pct;
    innerEl.style.width = pct + '%';
    innerEl.style.background = pct <= 20
      ? 'linear-gradient(90deg,#f87171,#ef4444)'
      : 'linear-gradient(90deg,#6ee7b7,#34d399)';
  }
}

/* ================================================================
   路线规划页核心逻辑
================================================================ */
let rpMode = 'real';
let rpStopCount = 3;
let rpStopVals = [];
let rpAiSel = [];
let rpVirtSel = [];
let rpInited = false;

function initRoutePage() {
  syncRouteStatusBar();
  initRouteBackBtn();

  if (rpInited) { rpRenderMap(); return; }
  rpInited = true;

  /* 滑动条 */
  const slider = document.getElementById('rpSlider');
  const numEl  = document.getElementById('rpNum');
  function updateTrack() {
    const p = ((slider.value - 1) / 9 * 100).toFixed(1);
    slider.style.setProperty('--rp-pct', p + '%');
  }
  slider.addEventListener('input', () => {
    rpStopCount = +slider.value;
    numEl.textContent = rpStopCount;
    updateTrack();
    rpSyncVals(); rpRenderStops(); rpRenderMap();
  });
  updateTrack();

  /* 输入框触发地图更新 */
  document.getElementById('rpOrigin').addEventListener('input', rpRenderMap);
  document.getElementById('rpDest').addEventListener('input', rpRenderMap);

  rpSyncVals(); rpRenderStops(); rpRenderMap();

  /* 确认按钮 */
  const confirmBtn = document.getElementById('rpConfirmBtn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
        if (navigator.vibrate) navigator.vibrate(12);
        showTicketPage();
      });
  }
}

function setMode(m) {
  rpMode = m;
  document.getElementById('mReal').classList.toggle('rp-on', m === 'real');
  document.getElementById('mVirt').classList.toggle('rp-on', m === 'virt');
  document.getElementById('rpRealBlock').style.display = m === 'real' ? '' : 'none';
  document.getElementById('rpVirtBlock').style.display = m === 'virt' ? '' : 'none';
  rpRenderMap();
}

function rpSyncVals() {
  while (rpStopVals.length < rpStopCount) rpStopVals.push('');
  rpStopVals = rpStopVals.slice(0, rpStopCount);
}

function rpRenderStops() {
  rpSyncVals();
  const cols = ['#2e5c28','#3d6e35','#4a7c42','#7ab870','#9aad8e','#a8d4a0','#b5ccb0','#c5dfc0','#d4e8cf','#4a7c42'];
  const list = document.getElementById('rpStopsList');
  list.innerHTML = rpStopVals.map((v, i) => `
    <div class="rp-stop-row">
      <div class="rp-stop-circle" style="background:${cols[i % cols.length]}"></div>
      <input class="rp-stop-input" value="${v}" placeholder="停留地 ${i + 1}"
        oninput="rpStopVals[${i}]=this.value;rpRenderMap()" />
      <span class="rp-stop-num">S${String(i + 1).padStart(2, '0')}</span>
      ${rpStopCount > 1 ? `<button class="rp-stop-rm" onclick="rpRmStop(${i})">×</button>` : ''}
    </div>
  `).join('') + (rpStopCount < 10 ? `
    <button class="rp-add-row" onclick="rpAddStop()">
      <div class="rp-add-icon">+</div>添加停留地
    </button>` : '');
}

function rpAddStop() {
  if (rpStopCount >= 10) return;
  rpStopCount++;
  document.getElementById('rpSlider').value = rpStopCount;
  document.getElementById('rpNum').textContent = rpStopCount;
  const p = ((rpStopCount - 1) / 9 * 100).toFixed(1);
  document.getElementById('rpSlider').style.setProperty('--rp-pct', p + '%');
  rpStopVals.push(''); rpRenderStops(); rpRenderMap();
}

function rpRmStop(i) {
  rpStopVals.splice(i, 1);
  rpStopCount = Math.max(1, rpStopCount - 1);
  document.getElementById('rpSlider').value = rpStopCount;
  document.getElementById('rpNum').textContent = rpStopCount;
  const p = ((rpStopCount - 1) / 9 * 100).toFixed(1);
  document.getElementById('rpSlider').style.setProperty('--rp-pct', p + '%');
  rpRenderStops(); rpRenderMap();
}

async function rpDoAI() {
  const org  = document.getElementById('rpOrigin').value || '东京';
  const dst  = document.getElementById('rpDest').value || '里斯本';
  const panel = document.getElementById('rpAiPanel');
  const body  = document.getElementById('rpAiBody');
  const regen = document.getElementById('rpAiRegen');
  panel.style.display = ''; rpAiSel = [];
  body.innerHTML = '<div class="rp-shimmer">Luna 正在思考路线...</div>';
  regen.style.display = 'none';
  try {
    const r = await fetch('https://api-d-anthropic-d-com-s-cld.v.tuangouai.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: 800,
        messages: [{ role: 'user', content: `旅行从"${org}"到"${dst}"，需要 ${rpStopCount} 个途经停留地。推荐 ${Math.min(rpStopCount + 3, 8)} 个候选地点，JSON数组，每项含name和desc（≤14字）。只返回JSON。` }]
      })
    });
    const d = await r.json();
    const places = JSON.parse((d.content?.[0]?.text || '[]').replace(/```json|```/g, '').trim());
    regen.style.display = 'block';
    body.innerHTML = places.map((p, i) => `
      <div class="rp-ai-item" id="rpAi${i}" onclick="rpToggleAI(${i},'${p.name.replace(/'/g, "\\'")}')">
        <div class="rp-ai-check" id="rpCk${i}"></div>
        <div><div class="rp-ai-name">${p.name}</div><div class="rp-ai-desc">${p.desc}</div></div>
      </div>`).join('');
  } catch(e) {
    body.innerHTML = '<div class="rp-shimmer">加载失败，请重试</div>';
    regen.style.display = 'block';
  }
}

function rpToggleAI(i, name) {
  const item = document.getElementById('rpAi' + i);
  const ck   = document.getElementById('rpCk' + i);
  const idx  = rpAiSel.indexOf(name);
  if (idx === -1) {
    if (rpAiSel.length >= rpStopCount) return;
    rpAiSel.push(name); item.classList.add('rp-sel'); ck.textContent = '✓';
    const slot = rpAiSel.length - 1;
    if (slot < rpStopVals.length) rpStopVals[slot] = name;
    rpRenderStops(); rpRenderMap();
  } else {
    rpAiSel.splice(idx, 1); item.classList.remove('rp-sel'); ck.textContent = '';
  }
}

function rpDoOptimize() {
  const org = document.getElementById('rpOrigin').value || '起点';
  const dst = document.getElementById('rpDest').value || '终点';
  const s   = rpStopVals.filter(v => v.trim());
  alert(`优化建议：${org} → ${s.join(' → ')} → ${dst}`);
}

async function rpDoVirt(useHint) {
  const hint  = useHint ? document.getElementById('rpVirtHint').value : '';
  const panel = document.getElementById('rpVirtPanel');
  const body  = document.getElementById('rpVirtBody');
  const regen = document.getElementById('rpVirtRegen');
  panel.style.display = ''; rpVirtSel = [];
  body.innerHTML = '<div class="rp-shimmer">Luna 正在构建世界...</div>';
  regen.style.display = 'none';
  const hintStr = hint ? `风格方向：${hint}` : '完全随机奇幻风';
  try {
    const r = await fetch('https://api-d-anthropic-d-com-s-cld.v.tuangouai.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: 800,
        messages: [{ role: 'user', content: `你是Luna，${hintStr}。生成 ${Math.min(rpStopCount + 3, 9)} 个虚拟幻想地名，JSON数组，每项含name和desc（≤16字）。只返回JSON。` }]
      })
    });
    const d = await r.json();
    const places = JSON.parse((d.content?.[0]?.text || '[]').replace(/```json|```/g, '').trim());
    regen.style.display = 'block';
    body.innerHTML = places.map((p, i) => `
      <div class="rp-ai-item" id="rpVi${i}" onclick="rpToggleVirt(${i},'${p.name.replace(/'/g, "\\'")}')">
        <div class="rp-ai-check" id="rpVk${i}"></div>
        <div><div class="rp-ai-name">${p.name}</div><div class="rp-ai-desc">${p.desc}</div></div>
      </div>`).join('');
  } catch(e) {
    body.innerHTML = '<div class="rp-shimmer">生成失败，请重试</div>';
    regen.style.display = 'block';
  }
}

function rpToggleVirt(i, name) {
  const item = document.getElementById('rpVi' + i);
  const ck   = document.getElementById('rpVk' + i);
  const idx  = rpVirtSel.indexOf(name);
  if (idx === -1) {
    if (rpVirtSel.length >= rpStopCount) return;
    rpVirtSel.push(name); item.classList.add('rp-sel'); ck.textContent = '✓';
    const slot = rpVirtSel.length - 1;
    if (slot < rpStopVals.length) rpStopVals[slot] = name;
    rpRenderStops(); rpRenderMap();
  } else {
    rpVirtSel.splice(idx, 1); item.classList.remove('rp-sel'); ck.textContent = '';
  }
}

function rpRenderMap() {
  const svg = document.getElementById('rpMapSvg');
  if (!svg) return;
  const org   = document.getElementById('rpOrigin').value || '起点';
  const dst   = document.getElementById('rpDest').value || '终点';
  const stops = rpStopVals.slice(0, rpStopCount);
  const nodes = [org, ...stops, dst];
  const n = nodes.length;

  const W = 336, H = 220, PAD = 36;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const xs = nodes.map((_, i) => PAD + i * (W - PAD * 2) / (n - 1));
  const baseY = H * 0.52;
  const ys = nodes.map((_, i) => baseY - Math.sin(i / (n - 1) * Math.PI) * 42);

  let path = `M ${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const cx = (xs[i] + xs[i + 1]) / 2;
    path += ` C ${cx.toFixed(1)} ${ys[i].toFixed(1)} ${cx.toFixed(1)} ${ys[i + 1].toFixed(1)} ${xs[i + 1].toFixed(1)} ${ys[i + 1].toFixed(1)}`;
  }

  /* 装饰散点 */
  const dots = Array.from({ length: 18 }, () => ({
    x: (Math.random() * 0.88 + 0.06) * W,
    y: (Math.random() * 0.75 + 0.08) * H,
    r: Math.random() * 2.5 + 0.6,
    op: (Math.random() * 0.18 + 0.06).toFixed(2)
  }));

  /* 山脉 */
  const mxs = [40, 80, 115, 155, 195, 235, 265, 296];
  const mountains = mxs.map((mx, i) => {
    const mh = 16 + Math.sin(i * 1.7) * 10;
    const mw = 18 + (i % 3) * 6;
    return `<path d="M ${mx - mw} ${H - 22} L ${mx} ${H - 22 - mh} L ${mx + mw} ${H - 22} Z" fill="rgba(74,124,66,0.09)" stroke="rgba(74,124,66,0.14)" stroke-width="0.5"/>`;
  }).join('');

  /* 云 */
  const clouds = [[55, 28], [160, 18], [280, 24]].map(([cx, cy]) => `
    <circle cx="${cx}" cy="${cy}" r="9" fill="rgba(255,255,255,0.55)"/>
    <circle cx="${cx + 11}" cy="${cy + 2}" r="7" fill="rgba(255,255,255,0.55)"/>
    <circle cx="${cx - 8}" cy="${cy + 3}" r="6" fill="rgba(255,255,255,0.45)"/>`).join('');

  /* 格网 */
  let grid = '';
  for (let gx = 0; gx <= W; gx += Math.round(W / 6))
    grid += `<line x1="${gx}" y1="0" x2="${gx}" y2="${H}" stroke="rgba(74,124,66,0.055)" stroke-width="0.5"/>`;
  for (let gy = 0; gy <= H; gy += Math.round(H / 4))
    grid += `<line x1="0" y1="${gy}" x2="${W}" y2="${gy}" stroke="rgba(74,124,66,0.055)" stroke-width="0.5"/>`;

  /* 站点图钉 */
  const pins = nodes.map((name, i) => {
    const isEnd = i === 0 || i === n - 1;
    const r = isEnd ? 7 : 5;
    const fill = i === 0 ? '#2e5c28' : i === n - 1 ? '#1a1a2e' : '#7ab870';
    const short = name.length > 6 ? name.slice(0, 5) + '…' : name;
    const above = i % 2 === 0;
    const ty = above ? ys[i] - 18 : ys[i] + 24;
    const labelFill = i === 0 ? '#1a3d16' : i === n - 1 ? '#0e0e1e' : '#2e5c28';
    const pinShape = isEnd
      ? `<circle cx="${xs[i].toFixed(1)}" cy="${(ys[i] - r - 3).toFixed(1)}" r="${r}" fill="${fill}"/>
         <line x1="${xs[i].toFixed(1)}" y1="${(ys[i] - 3).toFixed(1)}" x2="${xs[i].toFixed(1)}" y2="${(ys[i] + 5).toFixed(1)}" stroke="${fill}" stroke-width="1.5"/>`
      : `<circle cx="${xs[i].toFixed(1)}" cy="${ys[i].toFixed(1)}" r="${r + 5}" fill="${fill}" opacity="0.12"/>
         <circle cx="${xs[i].toFixed(1)}" cy="${ys[i].toFixed(1)}" r="${r + 2}" fill="rgba(255,255,255,0.7)"/>
         <circle cx="${xs[i].toFixed(1)}" cy="${ys[i].toFixed(1)}" r="${r}" fill="${fill}"/>`;
    return `${pinShape}
      <text x="${xs[i].toFixed(1)}" y="${ty}" text-anchor="middle"
        font-family="Space Mono,monospace" font-size="8"
        fill="${labelFill}" font-weight="${isEnd ? '700' : '400'}"
        letter-spacing="0.3" opacity="0.9">${short}</text>`;
  }).join('');

  const cx = W - 22, cy = H - 20;
  svg.innerHTML = `
    <defs>
      <marker id="rpArr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M2 2L8 5L2 8" fill="none" stroke="#2e5c28" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </marker>
    </defs>
    ${grid}
    ${mountains}
    ${clouds}
    ${dots.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.r.toFixed(1)}" fill="rgba(46,92,40,${p.op})"/>`).join('')}
    <path d="${path}" fill="none" stroke="rgba(74,124,66,0.13)" stroke-width="9" stroke-linecap="round"/>
    <path d="${path}" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="3.5" stroke-linecap="round"/>
    <path d="${path}" fill="none" stroke="#2e5c28" stroke-width="1.4" stroke-dasharray="5 5" opacity="0.55" stroke-linecap="round" marker-end="url(#rpArr)"/>
    ${pins}
    <text x="${cx}" y="${cy}" font-family="Space Mono,monospace" font-size="9" fill="rgba(46,92,40,0.3)" text-anchor="middle">N</text>
    <line x1="${cx}" y1="${cy - 12}" x2="${cx}" y2="${cy - 6}" stroke="rgba(46,92,40,0.25)" stroke-width="0.8"/>
    <line x1="${cx - 4}" y1="${cy - 3}" x2="${cx + 4}" y2="${cy - 3}" stroke="rgba(46,92,40,0.25)" stroke-width="0.8"/>
    <text x="${W / 2}" y="${H - 4}" text-anchor="middle" font-family="Space Mono,monospace" font-size="7" fill="rgba(74,124,66,0.35)" letter-spacing="2">${n} WAYPOINTS</text>`;
}

/* ---- 页面滚动时地图卡视差 ---- */
function initParallax() {
  const scroll  = document.getElementById('jnyScroll');
  const mapCard = document.querySelector('.jny-map-card');
  if (!scroll || !mapCard) return;

  scroll.addEventListener('scroll', () => {
    const y = scroll.scrollTop;
    mapCard.style.transform = `translateY(${y * 0.18}px)`;
  }, { passive: true });
}

/* ---- 初始化 ---- */
document.addEventListener('DOMContentLoaded', () => {
  updateTime();
  setInterval(updateTime, 10000);

  updateBattery();
  initIsland();
  initBackBtn();
  initStartBtn();
  initParallax();

  jnyInjectCharInfo();
});

function jnyInjectCharInfo() {
  const charName = localStorage.getItem('luna_current_chat') || 'Luna';

  document.querySelectorAll('[data-char-name]').forEach(el => {
    el.textContent = el.dataset.charName.replace(/Luna/g, charName);
  });
}
/* ================================================================
   购票页逻辑
================================================================ */
function showTicketPage() {
  document.getElementById('routeWrap').style.display = 'none';
  const tw = document.getElementById('ticketWrap');
  tw.style.display = '';
  syncTicketStatusBar();
  initTicketPage();
}

function hideTicketPage() {
  document.getElementById('ticketWrap').style.display = 'none';
  document.getElementById('routeWrap').style.display = '';
}

function syncTicketStatusBar() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeStr = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const tEl = document.getElementById('tkStatusTime');
  if (tEl) tEl.textContent = timeStr;

  const island = document.getElementById('tkStatusIsland');
  if (island && !island.dataset.init) {
    island.dataset.init = '1';
    island.innerHTML = `
      <div style="width:120px;height:34px;background:#000;border-radius:20px;
        display:flex;align-items:center;justify-content:center;gap:7px;">
        <div style="width:8px;height:8px;border-radius:50%;background:#4ade80;
          animation:islandPulse 2s ease-in-out infinite;"></div>
        <span style="font-family:'Space Mono',monospace;font-size:9px;
          letter-spacing:1.5px;color:rgba(255,255,255,0.7);text-transform:uppercase;">
          Ticket
        </span>
      </div>`;
  }

  const pctEl   = document.getElementById('tkBatPct');
  const innerEl = document.getElementById('tkBatInner');
  if (pctEl && innerEl) {
    const pct = parseInt(document.getElementById('batPct')?.textContent || '76');
    pctEl.textContent = pct;
    innerEl.style.width = pct + '%';
    innerEl.style.background = pct <= 20
      ? 'linear-gradient(90deg,#f87171,#ef4444)'
      : 'linear-gradient(90deg,#6ee7b7,#34d399)';
  }
}

function applyJnyFeats(items, featEls, charName) {
  items.forEach((item, i) => {
    if (!featEls[i]) return;
    const titleNode = featEls[i].querySelector('.jny-feat-text');
    const descSpan  = featEls[i].querySelector('.jny-feat-text span');
    if (titleNode) {
      titleNode.childNodes.forEach(node => {
        if (node.nodeType === 3) node.textContent = item.title;
      });
    }
    if (descSpan) {
      descSpan.style.opacity = '1';
      descSpan.textContent = item.desc.replace(/Luna/g, charName);
    }
  });
}

function initTicketPage() {
  const backBtn = document.getElementById('tkBackBtn');
  if (backBtn && !backBtn.dataset.init) {
    backBtn.dataset.init = '1';
    backBtn.addEventListener('click', hideTicketPage);
  }
  const confirmBtn = document.getElementById('tkConfirmBtn');
  if (confirmBtn && !confirmBtn.dataset.init) {
    confirmBtn.dataset.init = '1';
    confirmBtn.addEventListener('click', () => {
      if (navigator.vibrate) navigator.vibrate(12);
      tkStartGenerate();
    });
  }
  const enterBtn = document.getElementById('ckEnterBtn');
  if (enterBtn && !enterBtn.dataset.init) {
    enterBtn.dataset.init = '1';
    enterBtn.addEventListener('click', () => {
      if (navigator.vibrate) navigator.vibrate(12);
      showCheckInPage();
    });
  }
}

function tkSel(el) {
  const group = el.closest('.tk-fo-list');
  group.querySelectorAll('.tk-fo').forEach(f => f.classList.remove('tk-fo-sel'));
  el.classList.add('tk-fo-sel');
}

function tkMakeBarcode(id) {
  const el = document.getElementById(id);
  if (!el || el.children.length > 0) return;
  const ws = [3,1,2,1,4,1,2,3,1,2,1,3,2,1,4,1,2,1,3,2,1,4,1,2,3,1,2,1,3,1];
  ws.forEach((w, i) => {
    const b = document.createElement('span');
    b.style.width  = w + 'px';
    b.style.height = (i % 3 === 0 ? 26 : i % 3 === 1 ? 18 : 12) + 'px';
    b.style.opacity = i % 4 === 0 ? '0.32' : '0.7';
    el.appendChild(b);
  });
}

function tkStartGenerate() {
  const selectView = document.getElementById('tkSelectView');
  const genOv      = document.getElementById('tkGenOv');
  const boardView  = document.getElementById('tkBoardingView');

  selectView.style.display = 'none';
  genOv.classList.add('active');

  ['tkGs1','tkGs2','tkGs3','tkGs4'].forEach((id, i) => {
    setTimeout(() => document.getElementById(id).classList.add('done'), 650 + i * 580);
  });

  setTimeout(() => {
    genOv.classList.remove('active');
    boardView.style.display = '';
    document.getElementById('tkScroll').scrollTop = 0;
    tkMakeBarcode('tkBc1');
    tkMakeBarcode('tkBc2');
    tkMakeBarcode('tkBc3');
  }, 3600);
}

/* ================================================================
   检票页逻辑 · Check-in / Tear Ticket
================================================================ */

function showCheckInPage() {
  /* 隐藏购票页，显示检票页 */
  document.getElementById('ticketWrap').style.display = 'none';
  const cw = document.getElementById('checkInWrap');
  cw.style.display = '';
  syncCheckInStatusBar();
  initCheckInPage();
}

function hideCheckInPage() {
  document.getElementById('checkInWrap').style.display = 'none';
  document.getElementById('ticketWrap').style.display = '';
}

/* ── 状态栏同步（一比一复刻 journey 其他页的写法） ── */
function syncCheckInStatusBar() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeStr = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const tEl = document.getElementById('ckStatusTime');
  if (tEl) tEl.textContent = timeStr;

  const island = document.getElementById('ckStatusIsland');
  if (island && !island.dataset.init) {
    island.dataset.init = '1';
    island.innerHTML = `
      <div style="width:120px;height:34px;background:#000;border-radius:20px;
        display:flex;align-items:center;justify-content:center;gap:7px;">
        <div style="width:8px;height:8px;border-radius:50%;background:#4ade80;
          animation:islandPulse 2s ease-in-out infinite;"></div>
        <span style="font-family:'Space Mono',monospace;font-size:9px;
          letter-spacing:1.5px;color:rgba(255,255,255,0.7);text-transform:uppercase;">
          Airport
        </span>
      </div>`;
  }

  const pctEl   = document.getElementById('ckBatPct');
  const innerEl = document.getElementById('ckBatInner');
  if (pctEl && innerEl) {
    const pct = parseInt(document.getElementById('batPct')?.textContent || '76');
    pctEl.textContent = pct;
    innerEl.style.width = pct + '%';
    innerEl.style.background = pct <= 20
      ? 'linear-gradient(90deg,#f87171,#ef4444)'
      : 'linear-gradient(90deg,#6ee7b7,#34d399)';
  }
}

/* ── 检票页初始化 ── */
let ckInited = false;

function initCheckInPage() {
  /* 返回按钮 */
  const backBtn = document.getElementById('ckBackBtn');
  if (backBtn && !backBtn.dataset.init) {
    backBtn.dataset.init = '1';
    backBtn.addEventListener('click', hideCheckInPage);
  }

  if (ckInited) return;
  ckInited = true;

  /* 条形码 */
  ckMakeBarcode('ckTkBars');

  /* 撕票交互 */
  ckInitTear();
}

function ckMakeBarcode(id) {
  const el = document.getElementById(id);
  if (!el || el.children.length) return;
  const ws = [3,1,2,1,4,1,2,3,1,2,1,3,2,1,4,1,2,1,3,2,1,4,1,2,3,1,2,1,3,1];
  ws.forEach((w, i) => {
    const b = document.createElement('span');
    b.style.cssText = 'display:inline-block;background:#1a1a2e;border-radius:1px;';
    b.style.width  = w + 'px';
    b.style.height = (i % 3 === 0 ? 22 : i % 3 === 1 ? 16 : 11) + 'px';
    b.style.opacity = i % 4 === 0 ? '0.25' : '0.6';
    el.appendChild(b);
  });
}

/* ── 横向撕票逻辑 ── */
function ckInitTear() {
  const stub      = document.getElementById('ckStub');
  const overlay   = document.getElementById('ckDragOverlay');
  const dragHint  = document.getElementById('ckDragHint');
  const tornBadge = document.getElementById('ckTornBadge');
  const successBar= document.getElementById('ckSuccessBar');
  const checkPath = document.getElementById('ckCheckPath');
  const ctaWrap   = document.getElementById('ckCtaWrap');
  const canvas    = document.getElementById('ckTearCanvas');
  const container = document.getElementById('ckTicketContainer');
  const perfEl    = document.getElementById('ckPerf');

  let dragging = false, startX = 0, currentX = 0, torn = false;

  function getX(e) { return e.touches ? e.touches[0].clientX : e.clientX; }

  function onStart(e) {
    if (torn) return;
    dragging = true;
    startX = getX(e);
    overlay.style.cursor = 'grabbing';
  }

  function onMove(e) {
    if (!dragging || torn) return;
    e.preventDefault();
    currentX = getX(e);
    const dx = currentX - startX;
    if (dx < 0) return;
    const progress = Math.min(dx / 100, 1);

    stub.style.transform  = `translateX(${dx * 0.9}px) rotate(${progress * 5}deg)`;
    stub.style.opacity    = 1 - progress * 0.35;
    stub.style.transition = 'none';

    if (dx > 8) dragHint.style.opacity = '0';

    ckDrawCrack(progress, canvas, container, perfEl);

    if (progress >= 1 && !torn) ckCompleteTear();
  }

  function onEnd() {
    if (!dragging || torn) return;
    dragging = false;
    overlay.style.cursor = 'grab';
    const dx = currentX - startX;
    if (dx < 80) {
      stub.style.transition = 'transform 0.35s cubic-bezier(0.34,1.2,0.64,1),opacity 0.35s';
      stub.style.transform  = '';
      stub.style.opacity    = '1';
      dragHint.style.opacity = '1';
      ckClearCrack(canvas);
    }
  }

  function ckCompleteTear() {
    torn = true;
    ckClearCrack(canvas);
    stub.style.transition = 'transform 0.45s cubic-bezier(0.4,0,1,0.6),opacity 0.45s';
    stub.style.transform  = 'translateX(220px) rotate(14deg)';
    stub.style.opacity    = '0';
    if (perfEl) { perfEl.style.transition = 'opacity 0.3s'; perfEl.style.opacity = '0'; }

    setTimeout(() => {
      tornBadge.classList.add('show');
      successBar.classList.add('show');
      checkPath.classList.add('draw');
      ctaWrap.style.opacity = '1';
      ctaWrap.style.pointerEvents = '';
      /* 检票后 CTA 按钮 → 飞行日记页 */
      const ckCta = ctaWrap.querySelector('button');
      if (ckCta && !ckCta.dataset.fd) {
        ckCta.dataset.fd = '1';
        ckCta.addEventListener('click', showFlightDiaryPage);
      }
      if (navigator.vibrate) navigator.vibrate([20, 20, 50]);
    }, 300);
  }

  overlay.addEventListener('mousedown',  onStart);
  window.addEventListener('mousemove',   onMove);
  window.addEventListener('mouseup',     onEnd);
  overlay.addEventListener('touchstart', onStart, { passive: true });
  window.addEventListener('touchmove',   onMove,  { passive: false });
  window.addEventListener('touchend',    onEnd);
}

function ckDrawCrack(progress, canvas, container, perfEl) {
  if (!perfEl) return;
  const containerRect = container.getBoundingClientRect();
  const perfRect      = perfEl.getBoundingClientRect();
  const perfX = perfRect.left - containerRect.left + perfRect.width / 2;
  const h = container.offsetHeight;
  const w = container.offsetWidth;

  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = `rgba(74,124,66,${0.35 + progress * 0.3})`;
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  const segs     = 24;
  const drawSegs = Math.round(segs * progress);
  ctx.moveTo(perfX, 0);
  for (let i = 0; i < drawSegs; i++) {
    const y    = (i + 1) * (h / segs);
    const xOff = (Math.sin(i * 1.9) * 3.5 + Math.random() * 2 - 1) * progress;
    ctx.lineTo(perfX + xOff, y);
  }
  ctx.stroke();

  if (progress > 0.05) {
    const grad = ctx.createLinearGradient(perfX, 0, perfX + 16, 0);
    grad.addColorStop(0, `rgba(0,0,0,${0.08 * progress})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(perfX, 0, 20, h);
  }
}

function ckClearCrack(canvas) {
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/* ================================================================
   飞行日记页逻辑 · Flight Diary
================================================================ */

function showFlightDiaryPage() {
  document.getElementById('checkInWrap').style.display = 'none';
  const fw = document.getElementById('flightDiaryWrap');
  fw.style.display = '';
  syncFdStatusBar();
  initFlightDiaryPage();
}

function hideFlightDiaryPage() {
  document.getElementById('flightDiaryWrap').style.display = 'none';
  document.getElementById('checkInWrap').style.display = '';
}

/* 状态栏同步（一比一复刻其他页写法） */
function syncFdStatusBar() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeStr = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const tEl = document.getElementById('fdStatusTime');
  if (tEl) tEl.textContent = timeStr;

  const island = document.getElementById('fdStatusIsland');
  if (island && !island.dataset.init) {
    island.dataset.init = '1';
    island.innerHTML = `
      <div style="width:120px;height:34px;background:#000;border-radius:20px;
        display:flex;align-items:center;justify-content:center;gap:7px;">
        <div style="width:8px;height:8px;border-radius:50%;background:#4ade80;
          animation:islandPulse 2s ease-in-out infinite;"></div>
        <span style="font-family:'Space Mono',monospace;font-size:9px;
          letter-spacing:1.5px;color:rgba(255,255,255,0.7);text-transform:uppercase;">
          Flight
        </span>
      </div>`;
  }

  const pctEl   = document.getElementById('fdBatPct');
  const innerEl = document.getElementById('fdBatInner');
  if (pctEl && innerEl) {
    const pct = parseInt(document.getElementById('batPct')?.textContent || '76');
    pctEl.textContent = pct;
    innerEl.style.width = pct + '%';
    innerEl.style.background = pct <= 20
      ? 'linear-gradient(90deg,#f87171,#ef4444)'
      : 'linear-gradient(90deg,#6ee7b7,#34d399)';
  }
}

/* 飞行日记页初始化 */
let fdInited = false;

function initFlightDiaryPage() {
  /* 返回按钮 */
  const backBtn = document.getElementById('fdBackBtn');
  if (backBtn && !backBtn.dataset.init) {
    backBtn.dataset.init = '1';
    backBtn.addEventListener('click', hideFlightDiaryPage);
  }

  if (fdInited) return;
  fdInited = true;

  /* 封条交互 */
  var fdTorn = [false, false];

  function initFdSeal(idx, stripId, progressId, overlayId, nextBlockId) {
    var strip = document.getElementById(stripId);
    var prog  = document.getElementById(progressId);
    var over  = document.getElementById(overlayId);
    var startX = null, pct = 0;

    function onStart(e) {
      startX = (e.touches ? e.touches[0].clientX : e.clientX);
      strip.style.cursor = 'grabbing';
    }
    function onMove(e) {
      if (startX === null) return;
      var cx = (e.touches ? e.touches[0].clientX : e.clientX);
      var dx = cx - startX;
      pct = Math.max(0, Math.min(100, (dx / strip.offsetWidth) * 140));
      prog.style.width = pct + '%';
      strip.style.opacity = 1 - pct / 140;
      if (pct >= 100) done();
    }
    function onEnd() {
      if (pct < 100) {
        pct = 0;
        prog.style.width = '0%';
        strip.style.opacity = '1';
      }
      startX = null;
      strip.style.cursor = 'grab';
    }
    function done() {
      fdTorn[idx] = true;
      over.classList.add('torn');
      if (nextBlockId) {
        var nb = document.getElementById(nextBlockId);
        nb.style.opacity = '1';
        nb.style.pointerEvents = 'all';
      }
      if (fdTorn[0] && fdTorn[1]) {
        setTimeout(function() {
          document.getElementById('fdLunaN').classList.add('show');
          setTimeout(function() {
            var cta = document.getElementById('fdCtaWrap');
            cta.style.opacity = '1';
            cta.style.pointerEvents = '';
            document.getElementById('fdCtaHint').textContent = '首尔在等着她了，你也一起去吧';
          }, 600);
        }, 300);
      }
    }

    strip.addEventListener('mousedown',  onStart);
    strip.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('mousemove',  onMove);
    document.addEventListener('touchmove',  onMove, { passive: true });
    document.addEventListener('mouseup',   onEnd);
    document.addEventListener('touchend',  onEnd);
  }

  initFdSeal(0, 'fdSs1', 'fdSp1', 'fdSo1', 'fdSb2');
  initFdSeal(1, 'fdSs2', 'fdSp2', 'fdSo2', null);
}