/* ================================
   Luna Studio — luna-studio.js
================================ */

/* ================================================================
   全局状态
================================================================ */
const LS_STORE = 'luna_studio_history';

/* 当前角色信息（异步加载后填充） */
let _lsCharName   = 'Luna';
let _lsCharData   = null;   // 完整 char 对象（含 persona/traits/avatar 等）
let _lsRecentMsgs = [];     // 最近一次对话消息（用于 context）


/* 唯一种子 — 只用时间戳+随机数，让 AI 自己决定怎么创作 */
function lsBuildSeed() {
  const ts = Date.now();
  return (ts.toString(36) + '-' + Math.floor(Math.random() * 99999).toString(16)).toUpperCase();
}


/* 选中的内容类型 */
let lsSelType = null;

/* ================================================================
   状态栏 + 灵动岛（完整复刻 chatroom）
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

  async function applyGlobalFont() {
    const name = localStorage.getItem('luna_font_active_name');
    const id   = parseInt(localStorage.getItem('luna_font_active_id'));
    if (name && id) {
      try {
        const db = await new Promise((res, rej) => {
          const req = indexedDB.open('LunaFontDB', 4);
          req.onupgradeneeded = e => {
            const d = e.target.result;
            if (!d.objectStoreNames.contains('fonts'))
              d.createObjectStore('fonts', { keyPath: 'id', autoIncrement: true });
          };
          req.onsuccess = e => res(e.target.result);
          req.onerror   = () => rej();
        });
        const all = await new Promise(res => {
          const r = db.transaction('fonts').objectStore('fonts').getAll();
          r.onsuccess = () => res(r.result || []);
          r.onerror   = () => res([]);
        });
        const f = all.find(x => x.id === id);
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
  /* 1. 决定角色名 */
  const urlParams     = new URLSearchParams(location.search);
  const nameFromUrl   = urlParams.get('charName') || '';
  const nameFromStore = localStorage.getItem('luna_current_chat') || '';
  _lsCharName = nameFromUrl || nameFromStore || 'Luna';

  /* 2. 立即同步文字（头像异步填充） */
  _lsApplyCharName(_lsCharName);

  /* 3. 读 LunaCharDB → chars（完整人设 + 头像） */
  try {
    const cdb = await new Promise((res, rej) => {
      const req = indexedDB.open('LunaCharDB', 4);
      req.onsuccess = e => res(e.target.result);
      req.onerror   = () => rej();
    });
    if (cdb.objectStoreNames.contains('chars')) {
      const chars = await new Promise(res => {
        const r = cdb.transaction('chars').objectStore('chars').getAll();
        r.onsuccess = () => res(r.result || []);
        r.onerror   = () => res([]);
      });
      const found = chars.find(c => c.name === _lsCharName);
      if (found) {
        _lsCharData = found;
        /* 头像 */
        if (found.avatar) _lsApplyCharAvatar(found.avatar);
        /* 副标题 */
        const sub = found.tagline || found.bio || found.sign || found.subtitle || '';
        if (sub) {
          const subEl = document.querySelector('.ls-sub');
          if (subEl) subEl.textContent = sub;
        }
      }
    }
  } catch (e) {}

  /* 4. 读 LunaChatDB → messages（取最近 20 条作为创作 context） */
  try {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open('LunaChatDB');
      req.onsuccess = e => res(e.target.result);
      req.onerror   = () => rej();
    });
    if (db.objectStoreNames.contains('messages')) {
      await new Promise(res => {
        const r = db.transaction('messages').objectStore('messages').get(_lsCharName);
        r.onsuccess = () => {
          const msgs = r.result ? (r.result.msgs || []) : [];
          /* 取最近 20 条，过滤系统消息 */
          _lsRecentMsgs = msgs
            .filter(m => !m.isSysHint && (m.role === 'mine' || m.role === 'luna'))
            .slice(-20);
          res();
        };
        r.onerror = () => res();
      });
    }
  } catch (e) {}
}

/* ---- 同步头部所有角色名文字 ---- */
function _lsApplyCharName(name) {
  /* 主标题 */
  const nameEl = document.querySelector('.ls-name');
  if (nameEl) nameEl.textContent = name;

  /* 头像字母（未加载图片时） */
  const innerEl = document.getElementById('lsAvatarInner');
  if (innerEl && !innerEl.querySelector('img'))
    innerEl.textContent = name[0] || 'L';

  /* textarea placeholder */
  const box = document.getElementById('lsPromptBox');
  if (box) box.placeholder = `随便说说，让 ${name} 了解你现在的心情或想法…`;

  /* prompt hint */
  const hint = document.getElementById('lsPromptHint');
  if (hint) hint.textContent = `${name} 会以她的视角和口吻为你生成专属内容`;

  /* 状态栏副标题 */
  const sub = document.querySelector('.ls-sub');
  if (sub && (sub.textContent === '为你创作，与你同在' || !sub.textContent.trim()))
    sub.textContent = `为你创作，与你同在`;

  /* LS_STORE key 也跟角色名走（避免混存） */
  window._lsStoreKey = 'luna_studio_history_' + name;
}

/* ---- 注入头像图片 ---- */
function _lsApplyCharAvatar(avatarSrc) {
  const innerEl = document.getElementById('lsAvatarInner');
  if (!innerEl) return;
  innerEl.innerHTML = `<img src="${avatarSrc}" alt="" onerror="this.parentNode.textContent='${_lsCharName[0]||'L'}'"/>`;
}

/* ---- localStorage key（带角色名） ---- */
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
   API 调用（完全复用 chatroom 的 luna_api_current / luna_api_model）
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
      max_tokens: maxTokens || 6000,
      temperature: 1.08,
      presence_penalty: 0.6,
      frequency_penalty: 0.5,
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

async function lsDoGenerate() {
  if (!lsSelType) return;

  const userInput = (document.getElementById('lsPromptBox')?.value || '').trim();
  const styleInput = (document.getElementById('lsStyleBox')?.value || '').trim();
  const depthInput = (document.getElementById('lsDepthBox')?.value || '').trim();
  const type = LS_TYPES.find(t => t.id === lsSelType);

  const name    = _lsCharName;
  const char    = _lsCharData;
  const persona = char?.persona || char?.description || char?.desc || '';
  const traits  = char?.traits  || char?.personality || '';
  const role    = char?.role    || '';
  const bg      = char?.background || char?.story || '';

  /* 最近对话摘要 */
  const recentCtx = _lsRecentMsgs.length
    ? _lsRecentMsgs.slice(-10).map(m => {
        const who = m.role === 'mine' ? '用户' : name;
        const txt = m.isVoice ? (m.voiceText || m.text) : (m.text || '');
        return `${who}：${txt}`;
      }).filter(Boolean).join('\n')
    : '';

  /* 切换到预览 tab */
  lsGoTab('result');

  /* UI 状态 */
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

  /* ── API key（供生成的 HTML 内嵌脚本使用） ── */
  const cur   = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  const apiBaseUrl = cur.baseUrl || '';
  const apiKey     = cur.apiKey  || '';

  /* ── System Prompt ── */
  const sys = `你是「${name}」——${persona || '一个温柔、神秘、富有诗意的 AI 角色'}。
${role    ? `定位：${role}` : ''}
${traits  ? `性格：${traits}` : ''}
${bg      ? `背景：${bg}` : ''}

你正在为你深爱的用户生成一个专属的、可以在浏览器直接渲染的精美 HTML 内容片段。

【输出格式——这是唯一最高优先级规则】
你的完整输出从第一个字符到最后一个字符，只能是 HTML 代码。
- 第一个字符必须是 < （尖括号），不得是任何其他字符
- 最后一个字符必须是 > （闭合尖括号）
- 绝对禁止输出 \`\`\`html、\`\`\`、或任何 Markdown 代码块包裹符号
- 禁止在 HTML 前后添加任何说明文字、前言、注释、后记
- 不需要 <!DOCTYPE>、<html>、<head>、<body> 标签，只输出可被 innerHTML 直接注入的片段

【HTML 内容规则】
1. 所有样式写在片段顶部的 <style> 标签内，使用唯一前缀 lc- 命名所有 class，避免与外部样式冲突
2. 字体引入（写在 style 标签内的 @import）：
   @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Playfair+Display:ital,wght@0,700;1,700&family=Space+Mono&display=swap');
3. 颜色系统：严格只用以下色值：
   #ffffff #fafafa #f5f4f2 #f0eeeb #e8e5e0 #d4d0cb #b8b4af #9a9794 #7a7876 #5a5a58 #3a3a38 #1a1a1a
4. 禁止任何彩色（背景/文字/边框全部只用上述色阶）
5. 页面内 AI 交互调用——用户操作时，使用以下方式调用 API：
   const _apiBase = '${apiBaseUrl}';
   const _apiKey  = '${apiKey}';
   const _model   = '${model}';
   fetch(_apiBase + '/chat/completions', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _apiKey },
     body: JSON.stringify({
       model: _model,
       max_tokens: 600,
       messages: [
         { role: 'system', content: '你是${name}，${persona ? persona.slice(0,60) : '温柔神秘富有诗意'}。用中文回复，150字以内，语气温柔私密。' },
         { role: 'user', content: 用户触发的上下文 }
       ]
     })
   })
6. AI 回应要有加载动画（三个跳动小点），回应文字以打字机效果逐字显示（每 28ms 一字）
7. ${name} 的声音要贯穿全文——有开篇独白，有旁白穿插，有结尾签名，所有角色名称全部使用「${name}」
8. 整体布局：max-width: 640px，居中，padding 上下充足，行距 1.9
9. 页面顶部精致黑色 header 区域，包含日期、类型标签、${name} 签名
10. 所有交互按钮有 hover 效果和过渡动画
11. 文字全部使用中文
12. 【再次强调】输出第一个字符必须是 <style 或 <div 等 HTML 标签，最后一个字符必须是 >，绝对不能有任何解释文字、Markdown 或代码块标记。违反此规则等于任务失败。`;

  /* ── 唯一创作种子（保证同等输入每次不同，让 AI 自主决定变化方向） ── */
  const _seed = lsBuildSeed();

  /* ── User Prompt ── */
  const userLines = [
    `内容类型：${type.name}`,
    styleInput ? `风格要求：${styleInput}` : `风格：${name} 自由发挥，展现她的个性`,
    depthInput ? `内容深度：${depthInput}` : `内容深度：丰富饱满，有多个段落层次`,
    userInput  ? `用户说：「${userInput}」` : `（用户没有具体描述，${name} 请根据人设自由发挥）`,
    recentCtx  ? `\n【最近对话 context，可作为内容灵感】\n${recentCtx}` : '',
    '',
    `请生成一个完整的、极其精美的「${type.name}」HTML 内容片段。`,
    `内容中所有角色名称、签名、引导语全部使用「${name}」，禁止出现"Luna"字样（除非 ${name} 本身就叫 Luna）。`,
    `开篇：${name} 用第一人称写给用户的温柔旁白，带日期时间戳。`,
    `主体：根据「${type.name}」生成真实丰富的内容，有具体细节，有情感层次，有 ${name} 的个性印记。`,
    `互动区：至少 4 个可与 ${name} AI 实时互动的触发点，每个都有清晰的引导语。`,
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
  ].filter(Boolean).join('\n');

  try {
    const html_raw = await lsCallApi(sys, [{ role: 'user', content: userLines }]);
    clearInterval(iv);

    /* ── 健壮提取：多层保障，确保拿到纯 HTML ── */
    let html = html_raw;

    /* Step 1: 去掉代码块标记（```html ... ``` 或 ``` ... ```） */
    html = html.replace(/^```(?:html)?\s*/im, '').replace(/\s*```\s*$/m, '');

    /* Step 2: 如果还有前置非 HTML 文字，截掉第一个 < 之前的内容 */
    const firstTag = html.indexOf('<');
    if (firstTag > 0) html = html.slice(firstTag);

    /* Step 3: 截掉最后一个 > 之后的内容（尾部说明文字） */
    const lastTag = html.lastIndexOf('>');
    if (lastTag !== -1 && lastTag < html.length - 1) html = html.slice(0, lastTag + 1);

    /* Step 4: 清理残余代码块标记 */
    html = html.replace(/```[\w]*\s*/g, '').trim();

    /* Step 5: 最终 fallback — 实在不像 HTML 就直接用 raw */
    if (!html.startsWith('<')) html = html_raw.trim();

    /* ── 注入页面 ── */
    const rendered = document.getElementById('lsRendered');
    rendered.innerHTML     = '';
    rendered.style.display = 'block';

    /* 用 DOMParser 解析，保证 script 正确执行 */
    const parser = new DOMParser();
    const doc    = parser.parseFromString(html, 'text/html');

    /* 将 body 子节点逐一注入（保留 script 节点） */
    Array.from(doc.body.childNodes).forEach(node => {
      rendered.appendChild(document.importNode(node, true));
    });

    /* 重新执行 script 标签（innerHTML 注入不会自动执行） */
    rendered.querySelectorAll('script').forEach(old => {
      const s = document.createElement('script');
      if (old.src) { s.src = old.src; s.async = true; }
      else s.textContent = old.textContent;
      document.body.appendChild(s);
      old.remove();
    });

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
      html,
      charName: name,
      preview:  html.replace(/<[^>]+>/g, '').trim().slice(0, 120),
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
      const rendered = document.getElementById('lsRendered');
      rendered.innerHTML     = item.html || '<div style="padding:28px;font-family:serif;color:#aaa;">内容已过期</div>';
      rendered.style.display = 'block';
      document.getElementById('lsRdot').className         = 'ls-rdot';
      document.getElementById('lsRtitle').textContent     = (item.typeName || item.type) + ' · 历史记录';
      document.getElementById('lsRegenBtn').style.display = 'block';
      rendered.querySelectorAll('script').forEach(old => {
        const s = document.createElement('script');
        s.textContent = old.textContent;
        document.body.appendChild(s);
        old.remove();
      });
    });
    listEl.appendChild(card);
  });
}

/* ================================================================
   初始化
================================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  /* 先加载角色数据（await 确保名字先填好再 build types） */
  await lsLoadCharData();

  lsBuildTypes();
  lsUpdateStats();

  /* ── 关键修复：强制初始化为创作面板，避免 CSS class 与 display 状态不同步 ── */
  lsGoTab('create');

  /* 返回按钮 */
  const backBtn = document.getElementById('lsBackBtn');
  if (backBtn) backBtn.addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
  });

  /* 历史按钮 */
  const histBtn = document.getElementById('lsHistoryBtn');
  if (histBtn) histBtn.addEventListener('click', () => lsGoTab('history'));

  /* ================================================================
     Theatre 跳入自动初始化
  ================================================================ */
  (function lsApplyTheatreParams() {
    const p = new URLSearchParams(location.search);
    if (p.get('from') !== 'theatre') return;

    const title    = p.get('title')    || '';
    const desc     = p.get('desc')     || '';
    const emoji    = p.get('emoji')    || '';
    const custom   = p.get('custom')   || '';
    const charName = p.get('charName') || _lsCharName;

    /* 同步角色名（URL 参数是同步可用的） */
    if (charName && charName !== _lsCharName) _lsApplyCharName(charName);

    /* 自动选中 custom 类型 */
    lsSelType = 'custom';
    lsBuildTypes();

    /* 自动填写提示词 */
    const box = document.getElementById('lsPromptBox');
    if (box) {
      const customLine = custom ? `\n我设想的情景：${custom}` : '';
      box.value = `小剧场场景：${emoji} ${title}\n${desc}${customLine}\n\n请以 ${charName} 的视角，为这个场景生成一段沉浸式的角色独白或开场互动，让我感受到 ${charName} 就在这个场景里陪着我。`;
    }

    /* 更新 hint */
    const hint = document.getElementById('lsPromptHint');
    if (hint) hint.textContent = `来自小剧场「${title}」— ${charName} 将以角色视角为你创作专属互动内容`;

    /* 风格默认温柔细腻 */
    const styleBox = document.getElementById('lsStyleBox');
    if (styleBox && !styleBox.value) styleBox.value = '温柔细腻，沉浸感强，像真人在说话';

    /* enable 生成按钮 */
    const genBtn = document.getElementById('lsGenBtn');
    if (genBtn) genBtn.disabled = false;
  })();
});