/* ================================================================
   Appearance Settings — appearance_settings.js
   灵动岛 · 状态栏 · 字体 与 chatsetting.js 完全同步
================================================================ */

/* ── 状态栏时钟 + 电量（与 chatsetting csTick 同步）── */
function apTick() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const n = new Date();
  const timeStr = n.toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit',
    hour12: false, timeZone: tz
  });
  const el = document.getElementById('apTime');
  if (el) el.textContent = timeStr;

  const pct = parseInt(localStorage.getItem('luna_battery') || '76');
  const pctEl   = document.getElementById('apBatPct');
  const innerEl = document.getElementById('apBatInner');
  if (pctEl) pctEl.textContent = pct;
  if (innerEl) {
    innerEl.style.width = pct + '%';
    innerEl.style.background = pct <= 20
      ? 'linear-gradient(90deg, #f87171, #ef4444)'
      : '#1a1a1a';
  }
}
apTick();
setInterval(apTick, 10000);

/* ================================================================
   灵动岛（与 chatsetting csApplyIsland 完全同步）
================================================================ */
function apApplyIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const el      = document.getElementById('apIsland');
  if (!el) return;
  if (!enabled) { el.innerHTML = ''; return; }

  const styleMap = {
    minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
    clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="apIslandClock">--:--</span></div></div>`,
    pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
    ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
    rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
    music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
    scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
  };
  el.innerHTML = styleMap[style] || styleMap.minimal;

  clearInterval(window._apIslandClockTimer);
  if (style === 'clock') {
    const tick = () => {
      const t = document.getElementById('apIslandClock');
      if (!t) return;
      const now = new Date();
      t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    };
    tick();
    window._apIslandClockTimer = setInterval(tick, 10000);
  }
}

/* ================================================================
   字体同步（与 chatsetting csApplyGlobalFont 完全同步）
================================================================ */
async function apApplyGlobalFont() {
  const style = JSON.parse(localStorage.getItem('luna_font_style') || '{}');
  const name  = localStorage.getItem('luna_font_active_name');
  const id    = parseInt(localStorage.getItem('luna_font_active_id'));
  if (name && id) {
    try {
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open('LunaFontDB', 4);
        req.onupgradeneeded = e => {
          const d = e.target.result;
          if (!d.objectStoreNames.contains('fonts')) {
            d.createObjectStore('fonts', { keyPath: 'id', autoIncrement: true });
          }
        };
        req.onsuccess = e => res(e.target.result);
        req.onerror = () => rej();
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
    } catch(e) {}
  }
  let tag = document.getElementById('luna-font-override');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'luna-font-override';
    document.head.appendChild(tag);
  }
  const familyRule = name ? `font-family: '${name}', sans-serif !important;` : '';
  tag.textContent = `* { ${familyRule} }`;
}

/* ================================================================
   storage 事件监听（与 chatsetting 同步）
================================================================ */
window.addEventListener('storage', function(e) {
  if (e.key === 'luna_font_update' || e.key === 'luna_font_style') apApplyGlobalFont();
  if (e.key === 'luna_island_update' || e.key === 'luna_island_enabled' || e.key === 'luna_island_style') apApplyIsland();
  if (e.key === 'luna_tz_update') apTick();
});

window.addEventListener('pageshow', function(e) {
  if (e.persisted) window.location.reload();
});

/* ================================================================
   当前角色 ID（优先读 URL 参数 ?char=xxx，没有则从 luna_current_chat 读取）
================================================================ */
const AP_CHAR_ID = (function() {
  try {
    const fromUrl = decodeURIComponent(new URLSearchParams(window.location.search).get('char') || '');
    if (fromUrl) return fromUrl;
    /* 没有 URL 参数时，从 localStorage 读取当前聊天角色（与 chatroom.js 保持一致） */
    return localStorage.getItem('luna_current_chat') || 'default';
  } catch(e) { return 'default'; }
})();

/* HS 当前 scope（'global' | 'char'），默认全局 */
let _hsCurrentScope = 'global';

/* ================================================================
   初始化
================================================================ */
document.addEventListener('DOMContentLoaded', function() {
  apApplyIsland();
  apApplyGlobalFont();

  /* ── 主页面返回按钮 → 跳回 chatsetting.html ── */
  const apBack = document.getElementById('apNavBack');
  if (apBack) {
    apBack.style.cursor = 'pointer';
    apBack.addEventListener('click', function() {
      const charParam = AP_CHAR_ID && AP_CHAR_ID !== 'default'
        ? '?char=' + encodeURIComponent(AP_CHAR_ID)
        : '';
      window.location.href = 'chatsetting.html' + charParam;
    });
  }
});
/* ================================================================
   Header Studio — 页面开关
================================================================ */
function openHeaderStudio() {
  const page = document.getElementById('headerStudioPage');
  page.classList.remove('hs-closing');
  page.classList.add('hs-open');
  page.scrollTop = 0;
  // 同步状态栏进入子页面
  hsTick();
  hsApplyIsland();
  hsApplyGlobalFont();
  hsInitRangeFills();

  /* 进入时：若当前角色有专属样式，自动切到「当前角色」scope 并加载；否则加载全局 */
  const _openCharId = (AP_CHAR_ID && AP_CHAR_ID !== 'default')
    ? AP_CHAR_ID
    : (localStorage.getItem('luna_current_chat') || '');
  if (_openCharId && _openCharId !== 'default') {
    const charKey = 'luna_header_style_char_' + _openCharId;
    if (localStorage.getItem(charKey)) {
      hsSetScope('char');
    } else {
      hsSetScope('global');
      hsLoadScopeStyle('global');
    }
  } else {
    hsSetScope('global');
    hsLoadScopeStyle('global');
  }
}
function closeHeaderStudio() {
  const page = document.getElementById('headerStudioPage');
  page.classList.add('hs-closing');
  page.addEventListener('animationend', function handler() {
    page.classList.remove('hs-open', 'hs-closing');
    page.removeEventListener('animationend', handler);
  });
}

/* ================================================================
   HS 状态栏时钟 + 电量（与 apTick 完全同步）
================================================================ */
function hsTick() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const n = new Date();
  const timeStr = n.toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz
  });
  const el = document.getElementById('hsTime');
  if (el) el.textContent = timeStr;

  const pct = parseInt(localStorage.getItem('luna_battery') || '76');
  const pctEl   = document.getElementById('hsBatPct');
  const innerEl = document.getElementById('hsBatInner');
  if (pctEl) pctEl.textContent = pct;
  if (innerEl) {
    innerEl.style.width = pct + '%';
    innerEl.style.background = pct <= 20
      ? 'linear-gradient(90deg,#f87171,#ef4444)' : '#1a1a1a';
  }
}
hsTick();
setInterval(hsTick, 10000);

/* ================================================================
   HS 灵动岛（与 apApplyIsland 完全同步，挂到 #hsIsland）
================================================================ */
function hsApplyIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const el = document.getElementById('hsIsland');
  if (!el) return;
  if (!enabled) { el.innerHTML = ''; return; }

  const styleMap = {
    minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
    clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="hsIslandClock">--:--</span></div></div>`,
    pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
    ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
    rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
    music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
    scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
  };
  el.innerHTML = styleMap[style] || styleMap.minimal;

  clearInterval(window._hsIslandClockTimer);
  if (style === 'clock') {
    const tick = () => {
      const t = document.getElementById('hsIslandClock');
      if (!t) return;
      const now = new Date();
      t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    };
    tick();
    window._hsIslandClockTimer = setInterval(tick, 10000);
  }
}

/* ================================================================
   HS 字体同步（与 apApplyGlobalFont 完全同步）
================================================================ */
async function hsApplyGlobalFont() {
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
        req.onerror = () => rej();
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
    } catch(e) {}
  }
  // 复用主页面已注入的 luna-font-override，无需重复注入
}

/* ================================================================
   HS storage 事件监听
================================================================ */
window.addEventListener('storage', function(e) {
  if (e.key === 'luna_island_update' || e.key === 'luna_island_enabled' || e.key === 'luna_island_style') hsApplyIsland();
  if (e.key === 'luna_tz_update') hsTick();
});

/* ================================================================
   HS 颜色同步
================================================================ */
function hsSyncColors() {
  const bg   = hsV('hsCBg');
  const name = hsV('hsCName');
  const sub  = hsV('hsCSub');
  const avBg = hsV('hsCAvBg');
  const dot  = hsV('hsCDot');
  const stat = hsV('hsCStat');
  hsSetHex('hsHBg',bg); hsSetHex('hsHName',name); hsSetHex('hsHSub',sub);
  hsSetHex('hsHAvBg',avBg); hsSetHex('hsHDot',dot); hsSetHex('hsHStat',stat);
  document.getElementById('hsPrevHeader').style.background = bg;
  document.getElementById('hsPAvatar').style.background    = avBg;
  document.getElementById('hsPDot').style.background       = dot;
  document.getElementById('hsPStatusDot').style.background = dot;
  document.querySelector('.hs-cr-name').style.color  = name;
  document.querySelector('.hs-cr-sub').style.color   = sub;
  document.querySelectorAll('.hs-cr-stat-val').forEach(e => e.style.color = stat);
  document.querySelectorAll('.hs-cr-stat-luna-row span').forEach(e => e.style.color = stat);
}
function hsV(id) { return document.getElementById(id).value; }
function hsSetHex(id, val) { document.getElementById(id).textContent = val; }

/* ================================================================
   HS 滑动条填充色同步（让已滑过部分显示深色）
================================================================ */
function hsUpdateRangeFill(input) {
  const min = parseFloat(input.min) || 0;
  const max = parseFloat(input.max) || 100;
  const val = parseFloat(input.value);
  const pct = ((val - min) / (max - min)) * 100;
  input.style.background = `linear-gradient(to right, #1a1a1a 0%, #1a1a1a ${pct}%, #e8e8e8 ${pct}%, #e8e8e8 100%)`;
}
function hsInitRangeFills() {
  document.querySelectorAll('.hs-rfield input[type=range]').forEach(input => {
    hsUpdateRangeFill(input);
    input.addEventListener('input', () => hsUpdateRangeFill(input));
  });
}

/* ================================================================
   HS 尺寸同步
================================================================ */
function hsSyncSize() {
  const av = +hsV('hsRAv'), nm = +hsV('hsRNm'), pd = +hsV('hsRPd'), sb = +hsV('hsRSb');
  document.getElementById('hsVAv').textContent = av + 'px';
  document.getElementById('hsVNm').textContent = nm + 'px';
  document.getElementById('hsVPd').textContent = pd + 'px';
  document.getElementById('hsVSb').textContent = sb + 'px';
  const avatar = document.getElementById('hsPAvatar');
  avatar.style.width     = av + 'px';
  avatar.style.height    = av + 'px';
  avatar.style.fontSize  = Math.round(av * .37) + 'px';
  document.getElementById('hsPName').style.fontSize = nm + 'px';
  const main = document.querySelector('.hs-cr-header-main');
  main.style.paddingTop    = pd + 'px';
  main.style.paddingBottom = (pd - 2) + 'px';
  document.querySelector('.hs-cr-sub').style.fontSize = sb + 'px';
}
function hsResetColors() {
  document.getElementById('hsCBg').value   = '#ffffff';
  document.getElementById('hsCName').value = '#1a1a1a';
  document.getElementById('hsCSub').value  = '#aaaaaa';
  document.getElementById('hsCAvBg').value = '#efefef';
  document.getElementById('hsCDot').value  = '#5a5a5a';
  document.getElementById('hsCStat').value = '#1a1a1a';
  hsSyncColors();
}
function hsResetSize() {
  document.getElementById('hsRAv').value = 64;
  document.getElementById('hsRNm').value = 22;
  document.getElementById('hsRPd').value = 16;
  document.getElementById('hsRSb').value = 12;
  hsSyncSize();
}

/* ================================================================
   HS 范围切换
================================================================ */
function hsSetScope(s) {
  _hsCurrentScope = s;
  document.getElementById('hsSpGlobal').classList.toggle('on', s === 'global');
  document.getElementById('hsSpChar').classList.toggle('on',   s === 'char');
  const _charId = (AP_CHAR_ID && AP_CHAR_ID !== 'default')
    ? AP_CHAR_ID
    : (localStorage.getItem('luna_current_chat') || '');
  const charLabel = (_charId && _charId !== 'default') ? _charId : 'Luna';
  document.getElementById('hsScopeHint').textContent = s === 'global'
    ? '将应用到所有角色的头部样式'
    : `仅应用到当前角色「${charLabel}」的头部样式`;
  /* 切换 scope 时，加载对应已保存的样式 */
  hsLoadScopeStyle(s);
}

/* 根据 scope 读取对应已保存样式并回填表单 */
function hsLoadScopeStyle(s) {
  /* 有效角色 ID：AP_CHAR_ID 已含 luna_current_chat 回落 */
  const _charId = (AP_CHAR_ID && AP_CHAR_ID !== 'default')
    ? AP_CHAR_ID
    : (localStorage.getItem('luna_current_chat') || '');
  const key = (s === 'char' && _charId && _charId !== 'default')
    ? 'luna_header_style_char_' + _charId
    : 'luna_header_style';
  const raw = localStorage.getItem(key);
  if (!raw) return;
  try {
    const st = JSON.parse(raw);
    if (st.bg)        document.getElementById('hsCBg').value   = st.bg;
    if (st.nameColor) document.getElementById('hsCName').value = st.nameColor;
    if (st.sub)       document.getElementById('hsCSub').value  = st.sub;
    if (st.avBg)      document.getElementById('hsCAvBg').value = st.avBg;
    if (st.dot)       document.getElementById('hsCDot').value  = st.dot;
    if (st.stat)      document.getElementById('hsCStat').value = st.stat;
    if (st.av)        document.getElementById('hsRAv').value   = st.av;
    if (st.nm)        document.getElementById('hsRNm').value   = st.nm;
    if (st.pd)        document.getElementById('hsRPd').value   = st.pd;
    if (st.sb)        document.getElementById('hsRSb').value   = st.sb;
    if (st.customSel)  document.getElementById('hsCssSelector').value = st.customSel;
    if (st.customCode) document.getElementById('hsCssCode').value     = st.customCode;
    hsSyncColors();
    hsSyncSize();
    hsInitRangeFills();
  } catch(e) {}
}

/* ================================================================
   HS 类名插入
================================================================ */
function hsInsertClass(cls) {
  document.getElementById('hsCssSelector').value = cls;
  document.getElementById('hsCssSelector').focus();
}

/* ================================================================
   HS CSS 应用
================================================================ */
let hsAppliedStyle = null;
function hsApplyCss() {
  const sel  = document.getElementById('hsCssSelector').value.trim() || '.hs-cr-header';
  const code = document.getElementById('hsCssCode').value.trim();
  if (!code) { document.getElementById('hsCssStatus').textContent = '请先填写 CSS 内容'; return; }
  if (hsAppliedStyle) hsAppliedStyle.remove();
  const s = document.createElement('style');
  s.textContent = sel + ' { ' + code + ' }';
  document.head.appendChild(s);
  hsAppliedStyle = s;
  document.getElementById('hsCssStatus').textContent = '已应用 · ' + sel;
}
function hsClearCss() {
  if (hsAppliedStyle) { hsAppliedStyle.remove(); hsAppliedStyle = null; }
  document.getElementById('hsCssStatus').textContent = '';
}

/* ================================================================
   HS 方案管理
================================================================ */
const HS_STORE_KEY = 'hstudio_schemes';
function hsGetSchemes() { try { return JSON.parse(localStorage.getItem(HS_STORE_KEY) || '{}'); } catch { return {}; } }
function hsSaveSchemes(obj) { localStorage.setItem(HS_STORE_KEY, JSON.stringify(obj)); }

/* ── 自定义下拉：当前选中值（替代 select.value）── */
let _hsSelectedScheme = '';
function hsGetSelectValue() { return _hsSelectedScheme; }
function hsSetSelectValue(name) {
  _hsSelectedScheme = name || '';
  const valEl = document.getElementById('hsCsValue');
  if (!valEl) return;
  if (!name) {
    valEl.textContent = '— 选择已保存方案 —';
    valEl.classList.add('placeholder');
  } else {
    valEl.textContent = name;
    valEl.classList.remove('placeholder');
  }
  document.querySelectorAll('.hs-cs-option').forEach(o => {
    o.classList.toggle('selected', o.dataset.value === name);
  });
}
function hsToggleDropdown() {
  const wrap = document.getElementById('hsCustomSelect');
  const isOpen = wrap.classList.contains('open');
  if (isOpen) { hsCloseDropdown(); } else { wrap.classList.add('open'); }
}
function hsCloseDropdown() {
  const wrap = document.getElementById('hsCustomSelect');
  if (wrap) wrap.classList.remove('open');
}
document.addEventListener('click', function(e) {
  const wrap = document.getElementById('hsCustomSelect');
  if (wrap && !wrap.contains(e.target)) hsCloseDropdown();
});

function hsRefreshSelect() {
  const schemes = hsGetSchemes();
  const dropdown = document.getElementById('hsCsDropdown');
  if (!dropdown) return;
  dropdown.innerHTML = '';
  const keys = Object.keys(schemes);
  if (keys.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'hs-cs-option empty';
    empty.textContent = '暂无已保存方案';
    dropdown.appendChild(empty);
  } else {
    keys.forEach(name => {
      const item = document.createElement('div');
      item.className = 'hs-cs-option' + (name === _hsSelectedScheme ? ' selected' : '');
      item.dataset.value = name;
      item.textContent = name;
      item.onclick = function() {
        hsSetSelectValue(name);
        hsCloseDropdown();
        hsLoadScheme();
      };
      dropdown.appendChild(item);
    });
  }
  if (_hsSelectedScheme && !schemes[_hsSelectedScheme]) hsSetSelectValue('');
}

function hsLoadScheme() {
  const name = hsGetSelectValue();
  if (!name) return;
  const sc = hsGetSchemes()[name];
  if (!sc) return;
  document.getElementById('hsCssSelector').value   = sc.selector || '.hs-cr-header';
  document.getElementById('hsCssCode').value        = sc.code || '';
  document.getElementById('hsCssSchemeName').value  = name;
}
function hsOpenSaveModal() {
  document.getElementById('hsSmNameInput').value = document.getElementById('hsCssSchemeName').value || '';
  document.getElementById('hsSaveModal').classList.add('show');
  document.getElementById('hsSmNameInput').focus();
}
function hsCloseSaveModal() { document.getElementById('hsSaveModal').classList.remove('show'); }
function hsConfirmSave() {
  const name = document.getElementById('hsSmNameInput').value.trim();
  if (!name) { document.getElementById('hsSmNameInput').style.borderColor = '#c44'; return; }
  document.getElementById('hsSmNameInput').style.borderColor = '';
  const schemes = hsGetSchemes();
  schemes[name] = {
    selector: document.getElementById('hsCssSelector').value.trim(),
    code: document.getElementById('hsCssCode').value
  };
  hsSaveSchemes(schemes);
  hsRefreshSelect();
  hsSetSelectValue(name);
  document.getElementById('hsCssSchemeName').value = name;
  hsCloseSaveModal();
}
function hsDeleteScheme() {
  const name = hsGetSelectValue();
  if (!name) return;
  const schemes = hsGetSchemes();
  delete schemes[name];
  hsSaveSchemes(schemes);
  hsSetSelectValue('');
  hsRefreshSelect();
  document.getElementById('hsCssSchemeName').value = '';
}

/* ================================================================
   HS 导出 & 应用全部
================================================================ */
function hsApplyAll() {
  hsSyncColors();
  hsSyncSize();

  /* ── 收集当前所有配置 ── */
  const style = {
    bg:        hsV('hsCBg'),
    nameColor: hsV('hsCName'),
    sub:       hsV('hsCSub'),
    avBg:      hsV('hsCAvBg'),
    dot:       hsV('hsCDot'),
    stat:      hsV('hsCStat'),
    av:        parseInt(hsV('hsRAv')),
    nm:        parseInt(hsV('hsRNm')),
    pd:        parseInt(hsV('hsRPd')),
    sb:        parseInt(hsV('hsRSb')),
    customSel:  (document.getElementById('hsCssSelector').value || '').trim(),
    customCode: (document.getElementById('hsCssCode').value || '').trim(),
    scope:  _hsCurrentScope,
    charId: AP_CHAR_ID,
    ts:     Date.now()
  };

  /* ── 有效角色 ID：每次点「应用」时重新读取，确保时机正确 ──
     AP_CHAR_ID 可能在页面初始化时读到 'default'（如外观设置主页面直接打开 HS），
     所以这里强制重新从 localStorage 读 luna_current_chat 作为兜底 */
  const effectiveCharId = (AP_CHAR_ID && AP_CHAR_ID !== 'default')
    ? AP_CHAR_ID
    : (localStorage.getItem('luna_current_chat') || '');

  const styleJSON = JSON.stringify(style);

  /* ── 始终写入全局 luna_header_style（chatroom 读不到 char key 时的回落）── */
  localStorage.setItem('luna_header_style', styleJSON);

  /* ── scope=char 时，同时写入角色专属 key ── */
  if (_hsCurrentScope === 'char' && effectiveCharId && effectiveCharId !== 'default') {
    localStorage.setItem('luna_header_style_char_' + effectiveCharId, styleJSON);
  }

  /* ── 跨页面实时通知（BroadcastChannel）──
     window.dispatchEvent(StorageEvent) 只对同页面有效。
     localStorage storage 事件也只在「其他」窗口触发。
     BroadcastChannel 才能真正实时通知 chatroom 页面立即应用。
     注意：charId 必须用 effectiveCharId（已经过 luna_current_chat 兜底），
     不能用 AP_CHAR_ID（可能在页面初始化时读到 'default'）。 */
  try {
    const bc = new BroadcastChannel('luna_header_style_channel');
    bc.postMessage({ key: 'luna_header_style', value: styleJSON, scope: _hsCurrentScope, charId: effectiveCharId });
    bc.close();
  } catch(e) {}

  /* 同页面事件（兜底，万一在同一窗口内嵌时有用） */
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'luna_header_style',
    newValue: styleJSON,
    storageArea: localStorage
  }));

  /* 按钮反馈 */
  const btn = document.querySelector('.hs-btn-solid');
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = '✓ 已同步';
    btn.style.background = '#3a7a3a';
    setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 1800);
  }
}
function hsExportCSS() {
  const bg   = hsV('hsCBg'),  name = hsV('hsCName'), sub  = hsV('hsCSub');
  const av   = hsV('hsRAv'),  nm   = hsV('hsRNm'),   pd   = hsV('hsRPd');
  const sb   = hsV('hsRSb'),  dot  = hsV('hsCDot'),  avBg = hsV('hsCAvBg');
  const stat = hsV('hsCStat');
  const css =
`.hs-cr-header { background: ${bg}; }\n` +
`.hs-cr-name { font-size: ${nm}px; color: ${name}; }\n` +
`.hs-cr-sub { font-size: ${sb}px; color: ${sub}; }\n` +
`.hs-cr-avatar { width: ${av}px; height: ${av}px; background: ${avBg}; }\n` +
`.hs-cr-online-dot { background: ${dot}; }\n` +
`.hs-cr-status-dot { background: ${dot}; }\n` +
`.hs-cr-stat-val { color: ${stat}; }\n` +
`.hs-cr-header-main { padding-top: ${pd}px; padding-bottom: ${parseInt(pd)-2}px; }`;
  navigator.clipboard.writeText(css).then(() => {
    const btn = document.querySelector('.hs-btn-outline');
    btn.textContent = '已复制!';
    setTimeout(() => btn.textContent = '导出 CSS', 1500);
  });
}

/* 初始化 */
document.addEventListener('DOMContentLoaded', function() {
  hsRefreshSelect();
  hsInitRangeFills();
  /* 初始化 scope hint 使用真实角色名 */
  const charLabel = AP_CHAR_ID && AP_CHAR_ID !== 'default' ? AP_CHAR_ID : 'Luna';
  const hintEl = document.getElementById('hsScopeHint');
  if (hintEl) hintEl.textContent = '将应用到所有角色的头部样式';
  /* 如果是从某角色进入，默认选中「当前角色」scope 并加载其已保存样式 */
  if (AP_CHAR_ID && AP_CHAR_ID !== 'default') {
    /* 检查该角色是否已有专属样式，有则默认切到角色 scope */
    const charKey = 'luna_header_style_char_' + AP_CHAR_ID;
    if (localStorage.getItem(charKey)) {
      /* 稍微延迟，等 Header Studio 打开后再执行（openHeaderStudio 会调 hsInitRangeFills） */
      window._apCharScopeDeferred = true;
    }
  }
});