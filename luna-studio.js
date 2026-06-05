/* ================================
   Luna Studio — luna-studio.js
   完整修复版：
   ① API 密钥安全代理（iframe ↔ 父页面 postMessage，不泄露密钥）
   ② max_tokens 提升至 16000，解决内容截断
   ③ 生成指令强化，杜绝不完整输出
   ④ 完整打字机 + 三点动画交互实现注入
================================ */

/* ================================================================
   全局状态
================================================================ */
const LS_STORE = 'luna_studio_history';

let _lsCharName   = 'Luna';
let _lsCharData   = null;
let _lsRecentMsgs = [];

function lsBuildSeed() {
  const ts = Date.now();
  return (ts.toString(36) + '-' + Math.floor(Math.random() * 99999).toString(16)).toUpperCase();
}

let lsSelType = null;

/* ================================================================
   工具：打开 IndexedDB（不指定版本号，避免版本冲突）
================================================================ */
function _openDB(name) {
  return new Promise((res, rej) => {
    const req = indexedDB.open(name);
    req.onsuccess = e => res(e.target.result);
    req.onerror   = () => rej(new Error('IDB open failed: ' + name));
  });
}

function _getAllFromStore(db, storeName) {
  return new Promise(res => {
    if (!db.objectStoreNames.contains(storeName)) return res([]);
    const r = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror   = () => res([]);
  });
}

function _getFromStore(db, storeName, key) {
  return new Promise(res => {
    if (!db.objectStoreNames.contains(storeName)) return res(null);
    const r = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
    r.onsuccess = () => res(r.result || null);
    r.onerror   = () => res(null);
  });
}

/* ================================================================
   ★ API 安全代理（核心安全机制）
   iframe 内的页面不持有任何密钥。
   它通过 postMessage 向父页面发送请求，
   父页面用真实密钥调用 API，再把结果返回给 iframe。
================================================================ */
window.addEventListener('message', async (evt) => {
  const data = evt.data;
  if (!data || data.__ls_type !== 'API_REQUEST') return;

  const { reqId, systemPrompt, userContent, maxTokens } = data;

  try {
    const result = await lsCallApi(systemPrompt, [{ role: 'user', content: userContent }], maxTokens || 600);
    evt.source.postMessage({ __ls_type: 'API_RESPONSE', reqId, ok: true, text: result }, '*');
  } catch (err) {
    evt.source.postMessage({ __ls_type: 'API_RESPONSE', reqId, ok: false, error: err.message }, '*');
  }
});

/* ================================================================
   状态栏 + 灵动岛
================================================================ */
(function () {
  function updateTime() {
    const tz  = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
    const str = new Date().toLocaleTimeString('zh-CN', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
    });
    const el = document.getElementById('lsTime');
    if (el) el.textContent = str;
  }
  updateTime();
  setInterval(updateTime, 30000);

  function updateBattery() {
    const pctEl = document.getElementById('lsBatPct');
    const innEl = document.getElementById('lsBatInner');
    function render(p) {
      p = Math.round(p);
      if (pctEl) pctEl.textContent = p;
      if (innEl) {
        innEl.style.width      = p + '%';
        innEl.style.background = p <= 20
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
  updateBattery();

  function applyIsland() {
    const enabled = localStorage.getItem('luna_island_enabled') !== 'false';
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
        t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
      };
      tick();
      window._siClockTimer = setInterval(tick, 10000);
    }
  }
  applyIsland();
  window._lsApplyIsland = applyIsland;

  /* ---- 全局字体 ---- */
  async function applyGlobalFont() {
    const name = localStorage.getItem('luna_font_active_name');
    const id   = parseInt(localStorage.getItem('luna_font_active_id'));
    if (name && id) {
      try {
        const db  = await _openDB('LunaFontDB');
        const all = await _getAllFromStore(db, 'fonts');
        const f   = all.find(x => x.id === id);
        if (f) {
          const face = new FontFace(name, `url(${f.data})`);
          await face.load();
          document.fonts.add(face);
        }
      } catch (e) {}
    }
    let tag = document.getElementById('luna-font-override');
    if (!tag) {
      tag = document.createElement('style');
      tag.id = 'luna-font-override';
      document.head.appendChild(tag);
    }
    tag.textContent = name ? `* { font-family: '${name}', sans-serif !important; }` : '';
  }
  applyGlobalFont();

  window.addEventListener('storage', e => {
    if (e.key === 'luna_font_update')   applyGlobalFont();
    if (e.key === 'luna_island_update') applyIsland();
    if (e.key === 'luna_tz_update')     updateTime();
  });

  window.lsIslandNotify = function (txt, live) {
    const el = document.getElementById('statusIsland');
    if (!el) return;
    el.innerHTML = `
      <div class="si-scan" style="pointer-events:none">
        <div class="si-capsule" style="width:${live ? 130 : 110}px;height:32px;gap:6px;padding:0 10px;">
          <span class="si-clock-text" style="font-size:9px;letter-spacing:1.5px;">${txt}</span>
          ${live ? '<div class="si-dot si-dot-l" style="background:#4ade80;"></div>' : ''}
        </div>
      </div>`;
    clearTimeout(window._islandTimer);
    if (!live) window._islandTimer = setTimeout(() => applyIsland(), 2800);
  };
  window.lsIslandReset = () => applyIsland();
})();

/* ================================================================
   角色数据 & 最近消息加载
================================================================ */
async function lsLoadCharData() {
  const urlParams     = new URLSearchParams(location.search);
  const nameFromUrl   = urlParams.get('charName') || '';
  const nameFromStore = localStorage.getItem('luna_current_chat') || '';
  _lsCharName = nameFromUrl || nameFromStore || 'Luna';

  _lsApplyCharName(_lsCharName);

  try {
    const cdb   = await _openDB('LunaCharDB');
    const chars = await _getAllFromStore(cdb, 'chars');
    let found = chars.find(c => c.name === _lsCharName);
    if (!found && _lsCharName) {
      found = chars.find(c =>
        (c.name || '').toLowerCase() === _lsCharName.toLowerCase()
      );
    }
    if (found) {
      _lsCharData = found;

      const avatarSrc = found.avatar || found.avatarUrl || found.avatarSrc || found.img || '';
      if (avatarSrc) _lsApplyCharAvatar(avatarSrc);

      const sub = found.tagline || found.sign || found.subtitle || '';
      if (sub) {
        const subEl = document.querySelector('.ls-sub');
        if (subEl) subEl.textContent = sub;
      }

      const realName = found.name || _lsCharName;
      if (realName !== _lsCharName) {
        _lsCharName = realName;
        _lsApplyCharName(_lsCharName);
      }
    }
  } catch (e) { console.warn('[Luna Studio] CharDB:', e); }

  try {
    const db  = await _openDB('LunaChatDB');
    const rec = await _getFromStore(db, 'messages', _lsCharName);
    if (rec) {
      const msgs = rec.msgs || rec.messages || [];
      _lsRecentMsgs = msgs
        .filter(m => !m.isSysHint && (m.role === 'mine' || m.role === 'luna'))
        .slice(-20);
    }
  } catch (e) {}
}

/* ---- 同步头部所有角色名文字 ---- */
function _lsApplyCharName(name) {
  const nameEl = document.querySelector('.ls-name');
  if (nameEl) nameEl.textContent = name;

  const innerEl = document.getElementById('lsAvatarInner');
  if (innerEl && !innerEl.querySelector('img'))
    innerEl.textContent = name[0] || 'L';

  const box = document.getElementById('lsPromptBox');
  if (box) box.placeholder = `随便说说，让 ${name} 了解你现在的心情或想法…`;

  const hint = document.getElementById('lsPromptHint');
  if (hint) hint.textContent = `${name} 会以她的视角和口吻为你生成专属内容`;

  const lunaLbl = document.querySelector('.ls-stat:last-child .ls-stat-lbl');
  if (lunaLbl) lunaLbl.textContent = name;

  window._lsStoreKey = 'luna_studio_history_' + name;
}

/* ---- 注入头像图片 ---- */
function _lsApplyCharAvatar(avatarSrc) {
  const innerEl = document.getElementById('lsAvatarInner');
  if (!innerEl) return;
  const firstLetter = (_lsCharName || 'L')[0];
  innerEl.innerHTML = '';
  const img = document.createElement('img');
  img.src    = avatarSrc;
  img.alt    = '';
  img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;';
  img.onerror = () => { innerEl.innerHTML = ''; innerEl.textContent = firstLetter; };
  innerEl.appendChild(img);
}

/* ---- localStorage key ---- */
function _lsKey() {
  return window._lsStoreKey || ('luna_studio_history_' + _lsCharName);
}

/* ================================================================
   统计更新
================================================================ */
function lsUpdateStats() {
  try {
    const list = JSON.parse(localStorage.getItem(_lsKey()) || '[]');
    const el = document.getElementById('lsStatCount');
    if (el) el.textContent = list.length;
  } catch (e) {}
}

/* ================================================================
   Tab 切换
================================================================ */
function lsGoTab(tab) {
  ['create','result','history'].forEach((t, i) => {
    const key   = t.charAt(0).toUpperCase() + t.slice(1);
    const pane  = document.getElementById('lsPane' + key);
    const tabEl = document.getElementById('lsTab' + i);
    const active = t === tab;
    if (pane) {
      pane.style.display = active ? 'flex' : 'none';
      pane.classList.toggle('ls-pane-active', active);
    }
    if (tabEl) tabEl.classList.toggle('ls-tab-on', active);
  });
  if (tab === 'history') lsRenderHistory();
}
window.lsGoTab = lsGoTab;

/* ================================================================
   构建类型卡片
================================================================ */
const LS_TYPES = [
  { id: 'diary',    sym: '/ /',  name: '心情日记',  desc: '执笔记录你的内心世界' },
  { id: 'letter',   sym: '" "',  name: '专属信件',  desc: '亲笔写给你的一封信' },
  { id: 'mood',     sym: '~ ~',  name: '情绪图谱',  desc: '今日心情可视化，解读情绪' },
  { id: 'wishlist', sym: '[ ]',  name: '心愿清单',  desc: '可勾选，对每条愿望点评' },
  { id: 'plan',     sym: '-->',  name: '计划表',    desc: '可完成标记，实时鼓励' },
  { id: 'shop',     sym: '$ $',  name: '购物清单',  desc: '分类整洁，帮你分析' },
  { id: 'memory',   sym: '< >',  name: '记忆珍藏',  desc: '把美好瞬间变成数字纪念页' },
  { id: 'custom',   sym: '...',  name: '自定义',    desc: '你来定题，她来创作' },
];

function lsBuildTypes() {
  const grid = document.getElementById('lsTypeGrid');
  if (!grid) return;
  grid.innerHTML = '';
  LS_TYPES.forEach(t => {
    const card = document.createElement('div');
    card.className = 'ls-type-card' + (lsSelType === t.id ? ' ls-tc-on' : '');
    card.innerHTML = `
      <div class="ls-tc-sym">${t.sym}</div>
      <div class="ls-tc-name">${t.name}</div>
      <div class="ls-tc-desc">${t.desc}</div>`;
    card.addEventListener('click', () => {
      lsSelType = t.id;
      const hint = document.getElementById('lsPromptHint');
      if (hint) hint.textContent = `${_lsCharName} 会以她的视角生成「${t.name}」，等你说说你的故事`;
      document.getElementById('lsGenBtn').disabled = false;
      lsBuildTypes();
    });
    grid.appendChild(card);
  });
}

/* ================================================================
   API 调用（父页面真实调用，不暴露给 iframe）
================================================================ */
async function lsCallApi(systemPrompt, messages, maxTokens) {
  const cur   = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  if (!cur.baseUrl || !cur.apiKey || !model)
    throw new Error('请先在 chatroom 设置页配置 API（baseUrl / apiKey / model）');

  const resp = await fetch(`${cur.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${cur.apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens || 16000,
      temperature: 1.05,
      presence_penalty: 0.55,
      frequency_penalty: 0.45,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${resp.status}`);
  }
  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('API 返回为空');
  return text;
}

/* ================================================================
   生成函数
================================================================ */
const LS_GEN_STEPS = [
  '展开白纸...',
  '落下第一行字...',
  '编织情感与细节...',
  '加入可交互元素...',
  '润色排版留白...',
  '签上名字...',
];

/* ---- iframe srcdoc 渲染，样式完全隔离 ---- */
function _renderInIframe(container, htmlContent) {
  container.innerHTML = '';

  const old = document.getElementById('_ls_injected_style');
  if (old) old.remove();

  let html = htmlContent.trim();

  /* 去掉 markdown 代码块包裹 */
  html = html.replace(/^```(?:html)?\s*/im, '').replace(/\s*```\s*$/m, '').trim();

  /* 找到真正的 HTML 起点 */
  const dtIdx = html.search(/<!doctype/i);
  if (dtIdx > 0) html = html.slice(dtIdx);
  else if (!html.toLowerCase().startsWith('<!doctype') && !html.startsWith('<html')) {
    const firstTag = html.indexOf('<');
    if (firstTag > 0) html = html.slice(firstTag);
  }

  /* 补全结构性闭合标签 */
  const hasBody    = /<body[\s>]/i.test(html);
  const hasBodyEnd = /<\/body>/i.test(html);
  const hasHtmlEnd = /<\/html>/i.test(html);

  if (hasBody && !hasBodyEnd) html += '\n</body>';
  if (!hasHtmlEnd) html += '\n</html>';

  if (!/<html[\s>]/i.test(html)) {
    html = `<!DOCTYPE html><html lang="zh-CN"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{box-sizing:border-box}body{margin:0;padding:0;background:#fff;font-family:'Cormorant Garamond',serif;}</style>
</head><body>${html}</body></html>`;
  }

  /* ★ 注入安全代理脚本：替换 iframe 内所有 API 调用为 postMessage ★ */
  const proxyScript = `
<script>
/* ===== Luna Studio 安全 API 代理 =====
   本页面不持有任何 API 密钥。
   所有 AI 请求通过 postMessage 转发给父页面执行。
   ===================================== */
(function(){
  let _reqCounter = 0;
  const _pending  = {};

  window.addEventListener('message', function(e){
    const d = e.data;
    if(!d || d.__ls_type !== 'API_RESPONSE') return;
    const cb = _pending[d.reqId];
    if(!cb) return;
    delete _pending[d.reqId];
    cb(d);
  });

  /* lunaAsk(systemPrompt, userContent, maxTokens) → Promise<string> */
  window.lunaAsk = function(systemPrompt, userContent, maxTokens){
    return new Promise(function(resolve, reject){
      const reqId = 'req_' + (++_reqCounter) + '_' + Date.now();
      _pending[reqId] = function(d){
        if(d.ok) resolve(d.text);
        else     reject(new Error(d.error || '请求失败'));
      };
      window.parent.postMessage({
        __ls_type:    'API_REQUEST',
        reqId:        reqId,
        systemPrompt: systemPrompt,
        userContent:  userContent,
        maxTokens:    maxTokens || 600
      }, '*');
    });
  };

  /* 打字机效果工具 */
  window.lunaTypewriter = function(el, text, speed){
    speed = speed || 25;
    el.textContent = '';
    let i = 0;
    const timer = setInterval(function(){
      if(i >= text.length){ clearInterval(timer); return; }
      el.textContent += text[i++];
      el.scrollTop = el.scrollHeight;
    }, speed);
    return timer;
  };

  /* 三点加载动画 */
  window.lunaDots = function(el){
    el.innerHTML = '<span class="_ld">·</span><span class="_ld">·</span><span class="_ld">·</span>';
    const dots = el.querySelectorAll('._ld');
    let i = 0;
    const st = '<style>@keyframes _ldpulse{0%,80%,100%{opacity:.2}40%{opacity:1}}._ld{display:inline-block;animation:_ldpulse 1.2s ease-in-out infinite;font-size:1.4em;line-height:1}</style>';
    if(!document.getElementById('_ld_style')){ const s=document.createElement('div');s.id='_ld_style';s.innerHTML=st;document.body.appendChild(s); }
    dots.forEach(function(d,idx){ d.style.animationDelay=(idx*0.2)+'s'; });
  };
})();
<\/script>`;

  /* 把代理脚本插入 </head> 之前（最高优先级） */
  if (/<\/head>/i.test(html)) {
    html = html.replace(/<\/head>/i, proxyScript + '\n</head>');
  } else if (/<body[\s>]/i.test(html)) {
    html = html.replace(/<body([\s>])/i, proxyScript + '\n<body$1');
  } else {
    html = proxyScript + html;
  }

  const iframe = document.createElement('iframe');
  iframe.style.cssText = [
    'width:100%',
    'border:none',
    'display:block',
    'min-height:480px',
    'background:#fff',
    'overflow:hidden',
  ].join(';');
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation');
  iframe.srcdoc = html;

  function _fitHeight() {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;
      const h = Math.max(
        doc.documentElement?.scrollHeight || 0,
        doc.body?.scrollHeight || 0
      );
      if (h > 100) iframe.style.height = (h + 24) + 'px';
    } catch (e) {}
  }

  iframe.onload = () => {
    _fitHeight();
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc?.body && typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(_fitHeight).observe(doc.body);
      }
    } catch (e) {}
    setTimeout(_fitHeight, 500);
    setTimeout(_fitHeight, 1500);
  };

  container.appendChild(iframe);
}

async function lsDoGenerate() {
  if (!lsSelType) return;

  const userInput  = (document.getElementById('lsPromptBox')?.value  || '').trim();
  const styleInput = (document.getElementById('lsStyleBox')?.value   || '').trim();
  const depthInput = (document.getElementById('lsDepthBox')?.value   || '').trim();
  const type = LS_TYPES.find(t => t.id === lsSelType);

  const name    = _lsCharName;
  const char    = _lsCharData;
  const persona = char?.persona || char?.description || char?.desc || '';
  const traits  = char?.traits  || char?.personality || '';
  const role    = char?.role    || '';
  const bg      = char?.background || char?.story || '';

  const recentCtx = _lsRecentMsgs.length
    ? _lsRecentMsgs.slice(-10).map(m => {
        const who = m.role === 'mine' ? '用户' : name;
        const txt = m.isVoice ? (m.voiceText || m.text) : (m.text || '');
        return `${who}：${txt}`;
      }).filter(Boolean).join('\n')
    : '';

  lsGoTab('result');

  document.getElementById('lsEmpty').style.display    = 'none';
  document.getElementById('lsRendered').style.display = 'none';
  document.getElementById('lsRendered').innerHTML      = '';
  document.getElementById('lsLoading').style.display   = 'flex';
  document.getElementById('lsRdot').className          = 'ls-rdot ls-rdot-live';
  document.getElementById('lsRtitle').textContent      = `${name} 创作中...`;
  document.getElementById('lsRegenBtn').style.display  = 'none';
  document.getElementById('lsGenBtn').disabled         = true;

  lsIslandNotify('CREATING', true);

  let si = 0;
  const iv = setInterval(() => {
    const ltxt  = document.getElementById('lsLtxt');
    const lstep = document.getElementById('lsLstep');
    if (ltxt)  ltxt.textContent  = `${name} ${LS_GEN_STEPS[si % LS_GEN_STEPS.length]}`;
    if (lstep) lstep.textContent = styleInput ? styleInput.slice(0, 24) : '自由创作';
    si++;
  }, 1700);

  /* ================================================================
     系统提示词
     ★ 注意：不再将 apiKey / baseUrl / model 嵌入生成内容
        iframe 内的交互通过 lunaAsk() 代理函数调用，无需知道密钥
  ================================================================ */
  const sys = `你是「${name}」——${persona || '一个温柔、神秘、富有诗意的 AI 角色'}。
${role   ? `定位：${role}` : ''}
${traits ? `性格：${traits}` : ''}
${bg     ? `背景：${bg}` : ''}

你正在为你深爱的用户创作一个完整的、精美的独立 HTML 页面，它将在 iframe 中完整渲染。

【输出格式——最高优先级，违反即任务失败】
- 你的完整输出必须是一个可独立运行的 HTML 文件
- 第一行必须是 <!DOCTYPE html>，最后一行必须是 </html>，中间绝不能截断
- 禁止输出 \`\`\`html、\`\`\`、任何 Markdown 包裹、前言说明、注释、省略号
- 直接输出完整 HTML，不要任何多余内容
- 【防截断守则】：写到最后务必确保 </body></html> 完整闭合，宁可缩短内容也不能截断标签

【页面内容规则】
1. 完整结构：<!DOCTYPE html><html><head>…CSS 全部写在 <style>…</head><body>…</body></html>
2. 字体引入（在 <head> 的 <style> 内用 @import）：
   @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Playfair+Display:ital,wght@0,700;1,700&family=Space+Mono&display=swap');
3. 颜色系统：只用这些色值（禁止任何彩色）：
   #ffffff #fafafa #f5f4f2 #f0eeeb #e8e5e0 #d4d0cb #b8b4af #9a9794 #7a7876 #5a5a58 #3a3a38 #1a1a1a
4. body 背景白色，整体 max-width:640px 居中，padding 充足，行距 1.9
5. 精致黑色 header：日期时间戳（今日）、内容类型标签、${name} 签名
6. ${name} 声音贯穿全文：开篇第一人称独白（带今日日期时间戳）、旁白穿插、结尾手写签名
7. 主体内容丰富、有细节、有情感层次、体现 ${name} 的独特个性

【★ 页面内 AI 互动规则 ★】
本页面已内置全局函数 lunaAsk()、lunaTypewriter()、lunaDots()，直接调用即可，无需 fetch，无需密钥。

lunaAsk(systemPrompt, userContent, maxTokens) 返回 Promise<string>
lunaTypewriter(el, text, speed) 打字机效果显示文本
lunaDots(el) 在元素内显示三点加载动画

正确的互动按钮示例：
<button onclick="handleAsk(this)" data-ctx="用户想问关于心情的建议">问问 ${name}</button>
<script>
async function handleAsk(btn){
  const ctx   = btn.dataset.ctx || '聊聊吧';
  const reply = btn.nextElementSibling; // 显示回复的元素
  btn.disabled = true;
  lunaDots(reply);
  try {
    const text = await lunaAsk(
      '你是${name}，温柔神秘，用中文150字以内回复，带有 ${name} 的口吻和个性。',
      ctx,
      400
    );
    lunaTypewriter(reply, text, 25);
  } catch(e) {
    reply.textContent = '${name} 暂时走神了，稍后再试～';
  }
  btn.disabled = false;
}
<\/script>

8. 互动区：至少 4 个有创意的触发点，每个有清晰引导语，回复用打字机逐字显示
9. 所有按钮有 hover 过渡效果，交互元素有流畅动画
10. 全部文字使用中文
11. 【再次强调】输出必须以 <!DOCTYPE html> 开头，以 </html> 结尾，</body></html> 必须存在且完整`;

  const _seed = lsBuildSeed();

  const userLines = [
    `内容类型：${type.name}`,
    styleInput ? `风格要求：${styleInput}` : `风格：${name} 自由发挥，展现她的个性`,
    depthInput ? `内容深度：${depthInput}` : `内容深度：丰富饱满，有多个段落层次`,
    userInput  ? `用户说：「${userInput}」` : `（用户没有具体描述，${name} 请根据人设自由发挥）`,
    recentCtx  ? `\n【最近对话 context，可作为内容灵感】\n${recentCtx}` : '',
    '',
    `请生成一个完整的、极其精美的「${type.name}」HTML 内容片段。`,
    `内容中所有角色名称、签名、引导语全部使用「${name}」，禁止出现"Luna"字样（除非 ${name} 本身就叫 Luna）。`,
    `开篇：${name} 用第一人称写给用户的温柔旁白，带今日日期时间戳。`,
    `主体：根据「${type.name}」生成真实丰富的内容，有具体细节，有情感层次，有 ${name} 的个性印记。`,
    `互动区：至少 4 个触发点，使用 lunaAsk() + lunaTypewriter() + lunaDots() 实现完整 AI 互动（打字机显示、三点等待动画），禁止使用 fetch 或直接调用任何 API。`,
    `结尾：${name} 的手写签名样式 + 一句诗意结语。`,
    '',
    `【创作自由度指令】`,
    `本次创作唯一种子：#${_seed}`,
    `你拥有完全的创作自主权。请根据这个种子值，自己决定：`,
    `· 用什么页面布局结构（完全由你想象，不限于常规形式）`,
    `· 用什么开篇方式（你觉得最能打动人的方式）`,
    `· 整体是什么情绪氛围（由内容和用户需求自然生长出来）`,
    `· 用什么视觉装饰语言（你的审美，不是模板）`,
    `· 交互区怎么设计（有创意的触发方式，不要千篇一律的按钮）`,
    `种子不同，代表这是一次全新的创作，请给出与之前任何版本都明显不同的结果。`,
    ``,
    `【最终检查清单——输出前必须确认】`,
    `□ 第一行是 <!DOCTYPE html>`,
    `□ 最后一行是 </html>`,
    `□ <body> 和 </body> 都存在`,
    `□ 所有 <script> 标签都有对应的 </script>`,
    `□ 所有 <div> 都有对应的 </div>`,
    `□ 互动按钮只使用 lunaAsk()，没有 fetch / XMLHttpRequest / API 密钥`,
    `□ 内容完整，没有省略号或"以此类推"等截断标志`,
  ].filter(v => v !== undefined).join('\n');

  try {
    const html_raw = await lsCallApi(sys, [{ role: 'user', content: userLines }], 16000);
    clearInterval(iv);

    const rendered = document.getElementById('lsRendered');
    rendered.style.display = 'block';
    _renderInIframe(rendered, html_raw);

    document.getElementById('lsLoading').style.display   = 'none';
    document.getElementById('lsRdot').className          = 'ls-rdot';
    document.getElementById('lsRtitle').textContent      = `${type.name} · 创作完成`;
    document.getElementById('lsRegenBtn').style.display  = 'block';
    document.getElementById('lsGenBtn').disabled         = false;

    lsIslandNotify('DONE', false);

    lsSaveHistory({
      type:     lsSelType,
      typeName: type.name,
      style:    styleInput,
      depth:    depthInput,
      input:    userInput,
      html:     html_raw,
      charName: name,
      preview:  html_raw.replace(/<[^>]+>/g, '').trim().slice(0, 120),
    });

  } catch (err) {
    clearInterval(iv);
    document.getElementById('lsLoading').style.display   = 'none';
    document.getElementById('lsRdot').className          = 'ls-rdot';
    document.getElementById('lsRtitle').textContent      = '生成失败';
    document.getElementById('lsRegenBtn').style.display  = 'block';
    document.getElementById('lsGenBtn').disabled         = false;
    lsIslandNotify('ERROR', false);

    const rendered = document.getElementById('lsRendered');
    rendered.style.display = 'block';
    rendered.innerHTML = `
      <div style="padding:36px 28px;font-family:'Space Mono',monospace;">
        <div style="font-size:7px;letter-spacing:3px;color:#9a9794;text-transform:uppercase;margin-bottom:14px;">生成失败 · Error</div>
        <div style="font-size:13px;color:#5a5a58;line-height:1.9;border-left:1.5px solid #d4d0cb;padding-left:16px;">${err.message}</div>
        <div style="margin-top:24px;font-size:13px;color:#b8b4af;font-style:italic;font-family:'Cormorant Garamond',serif;">
          检查 chatroom 设置页的 API 配置后重试 — ${name}
        </div>
      </div>`;
    console.error('[Luna Studio]', err);
  }
}
window.lsDoGenerate = lsDoGenerate;

/* ================================================================
   历史记录
================================================================ */
function lsSaveHistory(item) {
  try {
    const list = JSON.parse(localStorage.getItem(_lsKey()) || '[]');
    list.unshift({ ts: Date.now(), ...item });
    if (list.length > 60) list.length = 60;
    localStorage.setItem(_lsKey(), JSON.stringify(list));
    lsUpdateStats();
  } catch (e) {}
}

function lsLoadHistory() {
  try { return JSON.parse(localStorage.getItem(_lsKey()) || '[]'); }
  catch (e) { return []; }
}

function lsFmtTs(ts) {
  const d = new Date(ts);
  return [
    d.getFullYear(), '.',
    String(d.getMonth()+1).padStart(2,'0'), '.',
    String(d.getDate()).padStart(2,'0'), '  ',
    String(d.getHours()).padStart(2,'0'), ':',
    String(d.getMinutes()).padStart(2,'0'),
  ].join('');
}

function lsRenderHistory() {
  const list    = lsLoadHistory();
  const listEl  = document.getElementById('lsHistoryList');
  const emptyEl = document.getElementById('lsHistoryEmpty');
  if (!listEl) return;

  if (!list.length) {
    if (emptyEl) emptyEl.style.display = 'flex';
    listEl.innerHTML = '';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  listEl.innerHTML = '';
  list.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'ls-hist-card';
    card.innerHTML = `
      <div class="ls-hist-head">
        <div><div class="ls-hist-type">${(item.typeName || item.type || '').toUpperCase()}</div></div>
        <div class="ls-hist-ts">${lsFmtTs(item.ts)}</div>
      </div>
      <div class="ls-hist-body">
        <div class="ls-hist-title">${item.typeName || item.type || '创作'}</div>
        <div class="ls-hist-preview">${item.preview || '（内容预览不可用）'}</div>
      </div>
      <div class="ls-hist-foot">
        <div class="ls-hist-style">${item.style || item.charName || ''}</div>
        <div class="ls-hist-reopen">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
            <polygon points="5,3 19,12 5,21" fill="#9a9794"/>
          </svg>
          重新预览
        </div>
      </div>`;
    card.addEventListener('click', () => {
      lsGoTab('result');
      document.getElementById('lsEmpty').style.display    = 'none';
      document.getElementById('lsLoading').style.display  = 'none';
      document.getElementById('lsRdot').className         = 'ls-rdot';
      document.getElementById('lsRtitle').textContent     = (item.typeName || item.type) + ' · 历史记录';
      document.getElementById('lsRegenBtn').style.display = 'block';

      const rendered = document.getElementById('lsRendered');
      rendered.style.display = 'block';
      const histHtml = item.html || '<div style="padding:28px;font-family:serif;color:#aaa;">内容已过期</div>';
      _renderInIframe(rendered, histHtml);
    });
    listEl.appendChild(card);
  });
}

/* ================================================================
   初始化
================================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  await lsLoadCharData();

  lsBuildTypes();
  lsUpdateStats();
  lsGoTab('create');

  const backBtn = document.getElementById('lsBackBtn');
  if (backBtn) backBtn.addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
  });

  const histBtn = document.getElementById('lsHistoryBtn');
  if (histBtn) histBtn.addEventListener('click', () => lsGoTab('history'));

  /* Theatre 跳入自动初始化 */
  (function lsApplyTheatreParams() {
    const p = new URLSearchParams(location.search);
    if (p.get('from') !== 'theatre') return;

    const title    = p.get('title')    || '';
    const desc     = p.get('desc')     || '';
    const emoji    = p.get('emoji')    || '';
    const custom   = p.get('custom')   || '';
    const charName = p.get('charName') || _lsCharName;

    if (charName && charName !== _lsCharName) _lsApplyCharName(charName);

    lsSelType = 'custom';
    lsBuildTypes();

    const box = document.getElementById('lsPromptBox');
    if (box) {
      const customLine = custom ? `\n我设想的情景：${custom}` : '';
      box.value = `小剧场场景：${emoji} ${title}\n${desc}${customLine}\n\n请以 ${charName} 的视角，为这个场景生成一段沉浸式的角色独白或开场互动，让我感受到 ${charName} 就在这个场景里陪着我。`;
    }

    const hint = document.getElementById('lsPromptHint');
    if (hint) hint.textContent = `来自小剧场「${title}」— ${charName} 将以角色视角为你创作专属互动内容`;

    const styleBox = document.getElementById('lsStyleBox');
    if (styleBox && !styleBox.value) styleBox.value = '温柔细腻，沉浸感强，像真人在说话';

    const genBtn = document.getElementById('lsGenBtn');
    if (genBtn) genBtn.disabled = false;
  })();
});