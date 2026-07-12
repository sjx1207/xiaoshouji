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

  /* ── 主页面返回按钮 → 用 history.back() 回到来源页面（通常是 chatsetting）──
     之前用 window.location.href = 'chatsetting.html' 会强制产生一条新的
     历史记录，导致历史栈变成 chatroom → chatsetting → appearance_settings → chatsetting(新)，
     这样一路点返回最终无法回到 chat 列表页（会在 chatroom/chatsetting 之间循环卡住）。
     改用 history.back() 保持历史栈干净；没有可回退的历史时才兜底跳转。 */
  const apBack = document.getElementById('apNavBack');
  if (apBack) {
    apBack.style.cursor = 'pointer';
    apBack.addEventListener('click', function() {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        const charParam = AP_CHAR_ID && AP_CHAR_ID !== 'default'
          ? '?char=' + encodeURIComponent(AP_CHAR_ID)
          : '';
        window.location.href = 'chatsetting.html' + charParam;
      }
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
  const ta = document.getElementById('hsCssCode');
  if (!ta) return;
  const start = ta.selectionStart;
  const end   = ta.selectionEnd;
  const val   = ta.value;
  const insert = cls + ' ';
  ta.value = val.slice(0, start) + insert + val.slice(end);
  ta.selectionStart = ta.selectionEnd = start + insert.length;
  ta.focus();
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
/* ================================================================
   Input Studio — 状态栏时钟 + 电量（与 hsTick 完全同步）
================================================================ */
function isTick() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const n = new Date();
  const timeStr = n.toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz
  });
  const el = document.getElementById('isTime');
  if (el) el.textContent = timeStr;
  const pct = parseInt(localStorage.getItem('luna_battery') || '76');
  const pctEl   = document.getElementById('isBatPct');
  const innerEl = document.getElementById('isBatInner');
  if (pctEl) pctEl.textContent = pct;
  if (innerEl) {
    innerEl.style.width = pct + '%';
    innerEl.style.background = pct <= 20
      ? 'linear-gradient(90deg,#f87171,#ef4444)' : '#1a1a1a';
  }
}
isTick();
setInterval(isTick, 10000);

/* ================================================================
   Input Studio — 灵动岛（与 hsApplyIsland 完全同步）
================================================================ */
function isApplyIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const el = document.getElementById('isIsland');
  if (!el) return;
  if (!enabled) { el.innerHTML = ''; return; }
  const styleMap = {
    minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
    clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="isIslandClock">--:--</span></div></div>`,
    pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
    ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
    rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
    music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
    scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
  };
  el.innerHTML = styleMap[style] || styleMap.minimal;
  clearInterval(window._isIslandClockTimer);
  if (style === 'clock') {
    const tick = () => {
      const t = document.getElementById('isIslandClock');
      if (!t) return;
      const now = new Date();
      t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    };
    tick();
    window._isIslandClockTimer = setInterval(tick, 10000);
  }
}

/* ================================================================
   Input Studio — 字体同步（复用 luna-font-override，已由主页面注入）
================================================================ */
async function isApplyGlobalFont() {
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
}

/* ================================================================
   Input Studio — 页面开关
================================================================ */
function openInputStudio() {
  const page = document.getElementById('inputStudioPage');
  page.classList.remove('is-closing');
  page.classList.add('is-open');
  page.scrollTop = 0;
  isTick();
  isApplyIsland();
  isApplyGlobalFont();
  isInitRangeFills();

  /* 进入时加载已保存样式 */
  const charId = (AP_CHAR_ID && AP_CHAR_ID !== 'default')
    ? AP_CHAR_ID
    : (localStorage.getItem('luna_current_chat') || '');
  if (charId && charId !== 'default') {
    const charKey = 'luna_input_style_char_' + charId;
    if (localStorage.getItem(charKey)) {
      isSetScope('char');
    } else {
      isSetScope('global');
      isLoadScopeStyle('global');
    }
  } else {
    isSetScope('global');
    isLoadScopeStyle('global');
  }
}
function closeInputStudio() {
  const page = document.getElementById('inputStudioPage');
  page.classList.add('is-closing');
  page.addEventListener('animationend', function handler() {
    page.classList.remove('is-open', 'is-closing');
    page.removeEventListener('animationend', handler);
  });
}

/* ================================================================
   Input Studio — storage 事件监听
================================================================ */
window.addEventListener('storage', function(e) {
  if (e.key === 'luna_island_update' || e.key === 'luna_island_enabled' || e.key === 'luna_island_style') isApplyIsland();
  if (e.key === 'luna_tz_update') isTick();
});

/* ================================================================
   Input Studio — Scope 切换
================================================================ */
let _isCurrentScope = 'global';
function isSetScope(s) {
  _isCurrentScope = s;
  document.getElementById('isSpGlobal').classList.toggle('on', s === 'global');
  document.getElementById('isSpChar').classList.toggle('on',   s === 'char');
  const charId = (AP_CHAR_ID && AP_CHAR_ID !== 'default')
    ? AP_CHAR_ID : (localStorage.getItem('luna_current_chat') || '');
  const charLabel = (charId && charId !== 'default') ? charId : 'Luna';
  document.getElementById('isScopeHint').textContent = s === 'global'
    ? '将应用到所有角色的输入区样式'
    : `仅应用到当前角色「${charLabel}」的输入区样式`;
  isLoadScopeStyle(s);
}

function isLoadScopeStyle(s) {
  const charId = (AP_CHAR_ID && AP_CHAR_ID !== 'default')
    ? AP_CHAR_ID : (localStorage.getItem('luna_current_chat') || '');
  const key = (s === 'char' && charId && charId !== 'default')
    ? 'luna_input_style_char_' + charId
    : 'luna_input_style';
  const raw = localStorage.getItem(key);
  if (!raw) return;
  try {
    const st = JSON.parse(raw);
    if (st.inputBg   !== undefined) document.getElementById('isCInputBg').value = st.inputBg;
    if (st.areaBg    !== undefined) document.getElementById('isCAreaBg').value  = st.areaBg;
    if (st.addBtn    !== undefined) document.getElementById('isCAddBtn').value   = st.addBtn;
    if (st.aiBg      !== undefined) document.getElementById('isCaiBg').value     = st.aiBg;
    if (st.sendBg    !== undefined) document.getElementById('isCsendBg').value   = st.sendBg;
    if (st.placeholder!==undefined) document.getElementById('isCPlaceholder').value = st.placeholder;
    if (st.btnSize   !== undefined) document.getElementById('isRBtnSize').value  = st.btnSize;
    if (st.boxH      !== undefined) document.getElementById('isRBoxH').value     = st.boxH;
    if (st.boxFs     !== undefined) document.getElementById('isRBoxFs').value    = st.boxFs;
    if (st.pb        !== undefined) document.getElementById('isRPb').value       = st.pb;
    if (st.radius    !== undefined) document.getElementById('isRRadius').value   = st.radius;
    if (st.shape !== undefined) isSetShape(st.shape, true);
    if (st.toggleDivider !== undefined) isSetToggle('divider', st.toggleDivider);
    if (st.toggleAddDot  !== undefined) isSetToggle('addDot',  st.toggleAddDot);
    if (st.toggleBlur    !== undefined) isSetToggle('blur',    st.toggleBlur);
    if (st.customCode !== undefined) document.getElementById('isCssCode').value = st.customCode;
    if (st.schemeName !== undefined) document.getElementById('isSchemeName').value = st.schemeName;
    /* 恢复图片 */
    if (st.imgAdd)  isSetImgPreview('add',  st.imgAdd);
    if (st.imgAi)   isSetImgPreview('ai',   st.imgAi);
    if (st.imgSend) isSetImgPreview('send', st.imgSend);
    isSyncColors();
    isSyncSize();
    isInitRangeFills();
  } catch(e) {}
}

/* ================================================================
   Input Studio — 颜色同步
================================================================ */
function isSyncColors() {
  const inputBg     = isV('isCInputBg');
  const areaBg      = isV('isCAreaBg');
  const addBtn      = isV('isCAddBtn');
  const aiBg        = isV('isCaiBg');
  const sendBg      = isV('isCsendBg');
  const placeholder = isV('isCPlaceholder');

  isSetHex('isHInputBg',    inputBg);
  isSetHex('isHAreaBg',     areaBg);
  isSetHex('isHAddBtn',     addBtn);
  isSetHex('isHaiBg',       aiBg);
  isSetHex('isHsendBg',     sendBg);
  isSetHex('isHPlaceholder',placeholder);

  /* 更新预览区 */
  const prevArea = document.getElementById('isPreviewArea');
  if (prevArea) prevArea.style.background = areaBg;
  const addBtnEl = document.getElementById('isPreviewAddBtn');
  if (addBtnEl) addBtnEl.style.background = addBtn;
  const inputBoxEl = document.getElementById('isPreviewInputBox');
  if (inputBoxEl) { inputBoxEl.style.background = inputBg; inputBoxEl.style.color = placeholder; }
  const aiBtnEl = document.getElementById('isPreviewAiBtn');
  if (aiBtnEl) aiBtnEl.style.background = aiBg;
  const sendBtnEl = document.getElementById('isPreviewSendBtn');
  if (sendBtnEl) sendBtnEl.style.background = sendBg;
  /* 发送图标颜色 — 深色背景用白色，浅色背景用深色 */
  const sendIconEl = document.getElementById('isPreviewSendIcon');
  if (sendIconEl) {
    const r = parseInt(sendBg.slice(1,3),16), g = parseInt(sendBg.slice(3,5),16), b = parseInt(sendBg.slice(5,7),16);
    const lum = (r*299+g*587+b*114)/1000;
    sendIconEl.querySelector('path').setAttribute('stroke', lum > 140 ? '#1a1a1a' : '#fff');
  }
}
function isV(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function isSetHex(id, val) { const el = document.getElementById(id); if(el) el.textContent = val; }

/* ================================================================
   Input Studio — 形状切换
================================================================ */
let _isCurrentShape = 'circle';
function isSetShape(shape, silent) {
  _isCurrentShape = shape;
  document.getElementById('isShapeCircle').classList.toggle('active', shape === 'circle');
  document.getElementById('isShapeSquare').classList.toggle('active', shape === 'square');
  if (!silent) {
    const r = shape === 'circle' ? 50 : 8;
    document.getElementById('isRRadius').value = r;
    document.getElementById('isVRadius').textContent = r + 'px';
    isUpdateBtnRadius(r);
    isInitRangeFills();
  }
}
function isSyncShapeRadius() {
  const r = parseInt(document.getElementById('isRRadius').value);
  document.getElementById('isVRadius').textContent = r + 'px';
  isUpdateBtnRadius(r);
  /* 自动更新形状标记 */
  if (r >= 40) {
    document.getElementById('isShapeCircle').classList.add('active');
    document.getElementById('isShapeSquare').classList.remove('active');
    _isCurrentShape = 'circle';
  } else if (r <= 10) {
    document.getElementById('isShapeSquare').classList.add('active');
    document.getElementById('isShapeCircle').classList.remove('active');
    _isCurrentShape = 'square';
  }
}
function isUpdateBtnRadius(r) {
  const px = r + 'px';
  const addEl = document.getElementById('isPreviewAddBtn');
  const aiEl  = document.getElementById('isPreviewAiBtn');
  const sendEl= document.getElementById('isPreviewSendBtn');
  if (addEl)  addEl.style.borderRadius  = px;
  if (aiEl)   aiEl.style.borderRadius   = px;
  if (sendEl) sendEl.style.borderRadius = px;
}

/* ================================================================
   Input Studio — 尺寸同步
================================================================ */
function isSyncSize() {
  const btnSize = parseInt(document.getElementById('isRBtnSize').value);
  const boxH    = parseInt(document.getElementById('isRBoxH').value);
  const boxFs   = parseInt(document.getElementById('isRBoxFs').value);
  const pb      = parseInt(document.getElementById('isRPb').value);

  document.getElementById('isVBtnSize').textContent = btnSize + 'px';
  document.getElementById('isVBoxH').textContent    = boxH + 'px';
  document.getElementById('isVBoxFs').textContent   = boxFs + 'px';
  document.getElementById('isVPb').textContent      = pb + 'px';

  const addEl  = document.getElementById('isPreviewAddBtn');
  const aiEl   = document.getElementById('isPreviewAiBtn');
  const sendEl = document.getElementById('isPreviewSendBtn');
  const boxEl  = document.getElementById('isPreviewInputBox');
  const areaEl = document.getElementById('isPreviewArea');

  [addEl, aiEl, sendEl].forEach(el => {
    if (el) { el.style.width = btnSize + 'px'; el.style.height = btnSize + 'px'; }
  });
  if (boxEl) { boxEl.style.minHeight = boxH + 'px'; boxEl.style.fontSize = boxFs + 'px'; }
  if (areaEl) areaEl.style.paddingBottom = pb + 'px';
}

function isResetColors() {
  document.getElementById('isCInputBg').value     = '#ffffff';
  document.getElementById('isCAreaBg').value      = '#f5f5f5';
  document.getElementById('isCAddBtn').value      = '#ffffff';
  document.getElementById('isCaiBg').value        = '#f0f0f0';
  document.getElementById('isCsendBg').value      = '#1a1a1a';
  document.getElementById('isCPlaceholder').value = '#c0bab2';
  isSyncColors();
}
function isResetSize() {
  document.getElementById('isRBtnSize').value = 42;
  document.getElementById('isRBoxH').value    = 42;
  document.getElementById('isRBoxFs').value   = 14;
  document.getElementById('isRPb').value      = 24;
  isSyncSize();
}

/* ================================================================
   Input Studio — 开关
================================================================ */
const _isToggles = { divider: true, addDot: true, blur: false };
function isToggle(key) {
  _isToggles[key] = !_isToggles[key];
  isSetToggle(key, _isToggles[key]);
}
function isSetToggle(key, val) {
  _isToggles[key] = val;
  const el = document.getElementById('isToggle' + key.charAt(0).toUpperCase() + key.slice(1));
  if (el) el.classList.toggle('on', val);
  /* 预览 */
  if (key === 'divider') {
    const d = document.getElementById('isPreviewDivider');
    if (d) d.style.display = val ? 'flex' : 'none';
  }
  if (key === 'addDot') {
    const d = document.getElementById('isPreviewAddDot');
    if (d) d.style.display = val ? 'block' : 'none';
  }
  if (key === 'blur') {
    const inputBox = document.getElementById('isPreviewInputBox');
    if (inputBox) inputBox.style.backdropFilter = val ? 'blur(8px)' : 'none';
  }
}

/* ================================================================
   Input Studio — 图片上传
================================================================ */
const _isImages = { add: null, ai: null, send: null };
function isHandleImgUpload(slot, input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    _isImages[slot] = e.target.result;
    isSetImgPreview(slot, e.target.result);
  };
  reader.readAsDataURL(file);
  input.value = '';
}
function isSetImgPreview(slot, dataUrl) {
  _isImages[slot] = dataUrl;
  const iconEl  = document.getElementById('isUpload' + slot.charAt(0).toUpperCase() + slot.slice(1) + 'Icon');
  const labelEl = document.getElementById('isUpload' + slot.charAt(0).toUpperCase() + slot.slice(1) + 'Label');
  const clearEl = document.getElementById('isImgClear' + slot.charAt(0).toUpperCase() + slot.slice(1));
  const zoneEl  = document.getElementById('isUpload' + slot.charAt(0).toUpperCase() + slot.slice(1));
  if (iconEl)  iconEl.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  if (labelEl) labelEl.textContent = '已上传';
  if (clearEl) clearEl.style.display = 'block';
  if (zoneEl)  zoneEl.classList.add('has-image');
  /* 更新预览区按钮图标 */
  const btnMap = { add: 'isPreviewAddBtn', ai: 'isPreviewAiBtn', send: 'isPreviewSendBtn' };
  const prevBtn = document.getElementById(btnMap[slot]);
  if (prevBtn) {
    const svgs = prevBtn.querySelectorAll('svg');
    svgs.forEach(s => s.style.display = 'none');
    let imgEl = prevBtn.querySelector('img.is-btn-custom-img');
    if (!imgEl) { imgEl = document.createElement('img'); imgEl.className = 'is-btn-custom-img'; imgEl.style.cssText = 'width:70%;height:70%;object-fit:contain;'; prevBtn.appendChild(imgEl); }
    imgEl.src = dataUrl;
    imgEl.style.display = 'block';
  }
}
function isRemoveImg(slot) {
  _isImages[slot] = null;
  const cap = slot.charAt(0).toUpperCase() + slot.slice(1);
  const iconEl  = document.getElementById('isUpload' + cap + 'Icon');
  const labelEl = document.getElementById('isUpload' + cap + 'Label');
  const clearEl = document.getElementById('isImgClear' + cap);
  const zoneEl  = document.getElementById('isUpload' + cap);
  if (iconEl) iconEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="#aaa" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if (labelEl) labelEl.textContent = '上传';
  if (clearEl) clearEl.style.display = 'none';
  if (zoneEl)  zoneEl.classList.remove('has-image');
  const btnMap = { add: 'isPreviewAddBtn', ai: 'isPreviewAiBtn', send: 'isPreviewSendBtn' };
  const prevBtn = document.getElementById(btnMap[slot]);
  if (prevBtn) {
    const imgEl = prevBtn.querySelector('img.is-btn-custom-img');
    if (imgEl) imgEl.style.display = 'none';
    prevBtn.querySelectorAll('svg').forEach(s => s.style.display = '');
  }
}

/* ================================================================
   Input Studio — 滑动条填充
================================================================ */
function isUpdateRangeFill(input) {
  const min = parseFloat(input.min) || 0;
  const max = parseFloat(input.max) || 100;
  const pct = ((parseFloat(input.value) - min) / (max - min)) * 100;
  input.style.background = `linear-gradient(to right, #1a1a1a 0%, #1a1a1a ${pct}%, #e8e8e8 ${pct}%, #e8e8e8 100%)`;
}
function isInitRangeFills() {
  document.querySelectorAll('#inputStudioPage .is-rfield input[type=range]').forEach(input => {
    isUpdateRangeFill(input);
    /* 防止重复绑定 */
    if (!input._isRangeBound) {
      input.addEventListener('input', () => isUpdateRangeFill(input));
      input._isRangeBound = true;
    }
  });
}

/* ================================================================
   Input Studio — 类名插入
================================================================ */
function isInsertClass(cls) {
  const ta = document.getElementById('isCssCode');
  if (!ta) return;
  const start = ta.selectionStart, end = ta.selectionEnd;
  const insert = cls + ' ';
  ta.value = ta.value.slice(0, start) + insert + ta.value.slice(end);
  ta.selectionStart = ta.selectionEnd = start + insert.length;
  ta.focus();
}

/* ================================================================
   Input Studio — 自定义 CSS 应用
================================================================ */
let _isAppliedStyle = null;

/* cr-* 真实类名 → is-prev-* 预览类名 映射表 */
const _isCrToPreview = [
  ['.cr-input-area',       '.is-prev-area'],
  ['.cr-input-row',        '.is-prev-row'],
  ['.cr-input-box',        '.is-prev-input-box'],
  ['.cr-add-btn',          '.is-prev-add-btn'],
  ['.cr-add-dot',          '.is-prev-add-dot'],
  ['.cr-right-btns',       '.is-prev-right-btns'],
  ['.cr-ai-btn',           '.is-prev-ai-btn'],
  ['.cr-send-btn',         '.is-prev-send-btn'],
  ['.cr-const-div',        '.is-prev-divider'],
  ['.cr-const-line',       '.is-prev-line'],
  ['.cr-quote-bar',        '.is-prev-quote-bar'],
  ['.cr-input-area-inner', '.is-prev-area'],
];

function _isMapCssToPreview(code) {
  let mapped = code;
  _isCrToPreview.forEach(([real, prev]) => {
    /* 用正则全局替换，避免漏掉带伪类/后代的选择器也一并替换 */
    const escaped = real.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    mapped = mapped.replace(new RegExp(escaped, 'g'), prev);
  });
  return mapped;
}

function isApplyCss() {
  const code = document.getElementById('isCssCode').value.trim();
  const statusEl = document.getElementById('isCssStatus');
  if (!code) { if(statusEl) statusEl.textContent = '请先填写 CSS 内容'; return; }
  if (_isAppliedStyle) _isAppliedStyle.remove();
  const s = document.createElement('style');
  /* 注入原始 cr-* 样式（作用于真实聊天页）+ 映射后的 is-prev-* 样式（作用于预览区） */
  s.textContent = code + '\n' + _isMapCssToPreview(code);
  document.head.appendChild(s);
  _isAppliedStyle = s;
  if (statusEl) statusEl.textContent = '已应用到预览';
}
function isClearCss() {
  if (_isAppliedStyle) { _isAppliedStyle.remove(); _isAppliedStyle = null; }
  const statusEl = document.getElementById('isCssStatus');
  if (statusEl) statusEl.textContent = '';
}

/* ================================================================
   Input Studio — 方案管理
================================================================ */
const IS_STORE_KEY = 'istudio_schemes';
function isGetSchemes() { try { return JSON.parse(localStorage.getItem(IS_STORE_KEY) || '{}'); } catch { return {}; } }
function isSaveSchemes(obj) { localStorage.setItem(IS_STORE_KEY, JSON.stringify(obj)); }

let _isSelectedScheme = '';
function isGetSelectValue() { return _isSelectedScheme; }
function isSetSelectValue(name) {
  _isSelectedScheme = name || '';
  const valEl = document.getElementById('isCsValue');
  if (!valEl) return;
  if (!name) { valEl.textContent = '— 选择已保存方案 —'; valEl.classList.add('placeholder'); }
  else { valEl.textContent = name; valEl.classList.remove('placeholder'); }
  document.querySelectorAll('#inputStudioPage .is-cs-option').forEach(o => {
    o.classList.toggle('selected', o.dataset.value === name);
  });
}
function isToggleDropdown() {
  const wrap = document.getElementById('isCustomSelect');
  if (wrap.classList.contains('open')) isCloseDropdown();
  else wrap.classList.add('open');
}
function isCloseDropdown() {
  const wrap = document.getElementById('isCustomSelect');
  if (wrap) wrap.classList.remove('open');
}
document.addEventListener('click', function(e) {
  const wrap = document.getElementById('isCustomSelect');
  if (wrap && !wrap.contains(e.target)) isCloseDropdown();
});
function isRefreshSelect() {
  const schemes = isGetSchemes();
  const dropdown = document.getElementById('isCsDropdown');
  if (!dropdown) return;
  dropdown.innerHTML = '';
  const keys = Object.keys(schemes);
  if (keys.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'is-cs-option empty';
    empty.textContent = '暂无已保存方案';
    dropdown.appendChild(empty);
  } else {
    keys.forEach(name => {
      const item = document.createElement('div');
      item.className = 'is-cs-option' + (name === _isSelectedScheme ? ' selected' : '');
      item.dataset.value = name;
      item.textContent = name;
      item.onclick = function() { isSetSelectValue(name); isCloseDropdown(); isLoadScheme(); };
      dropdown.appendChild(item);
    });
  }
  if (_isSelectedScheme && !schemes[_isSelectedScheme]) isSetSelectValue('');
}
function isLoadScheme() {
  const name = isGetSelectValue();
  if (!name) return;
  const sc = isGetSchemes()[name];
  if (!sc) return;
  if (sc.code) document.getElementById('isCssCode').value = sc.code;
  document.getElementById('isSchemeName').value = name;
}
function isOpenSaveModal() {
  document.getElementById('isSmNameInput').value = document.getElementById('isSchemeName').value || '';
  document.getElementById('isSaveModal').classList.add('show');
  document.getElementById('isSmNameInput').focus();
}
function isCloseSaveModal() { document.getElementById('isSaveModal').classList.remove('show'); }
function isConfirmSave() {
  const name = document.getElementById('isSmNameInput').value.trim();
  if (!name) { document.getElementById('isSmNameInput').style.borderColor = '#c44'; return; }
  document.getElementById('isSmNameInput').style.borderColor = '';
  const schemes = isGetSchemes();
  schemes[name] = { code: document.getElementById('isCssCode').value };
  isSaveSchemes(schemes);
  isRefreshSelect();
  isSetSelectValue(name);
  document.getElementById('isSchemeName').value = name;
  isCloseSaveModal();
}
function isDeleteScheme() {
  const name = isGetSelectValue();
  if (!name) return;
  const schemes = isGetSchemes();
  delete schemes[name];
  isSaveSchemes(schemes);
  isSetSelectValue('');
  isRefreshSelect();
  document.getElementById('isSchemeName').value = '';
}

/* ================================================================
   Input Studio — 同步到聊天 & 导出 CSS
================================================================ */
function isApplyAll() {
  isSyncColors();
  isSyncSize();

  const style = {
    inputBg:     isV('isCInputBg'),
    areaBg:      isV('isCAreaBg'),
    addBtn:      isV('isCAddBtn'),
    aiBg:        isV('isCaiBg'),
    sendBg:      isV('isCsendBg'),
    placeholder: isV('isCPlaceholder'),
    btnSize:     parseInt(document.getElementById('isRBtnSize').value),
    boxH:        parseInt(document.getElementById('isRBoxH').value),
    boxFs:       parseInt(document.getElementById('isRBoxFs').value),
    pb:          parseInt(document.getElementById('isRPb').value),
    radius:      parseInt(document.getElementById('isRRadius').value),
    shape:       _isCurrentShape,
    toggleDivider: _isToggles.divider,
    toggleAddDot:  _isToggles.addDot,
    toggleBlur:    _isToggles.blur,
    imgAdd:      _isImages.add  || null,
    imgAi:       _isImages.ai   || null,
    imgSend:     _isImages.send || null,
    customCode:  (document.getElementById('isCssCode').value || '').trim(),
    schemeName:  (document.getElementById('isSchemeName').value || '').trim(),
    scope:  _isCurrentScope,
    charId: AP_CHAR_ID,
    ts:     Date.now()
  };

  const effectiveCharId = (AP_CHAR_ID && AP_CHAR_ID !== 'default')
    ? AP_CHAR_ID
    : (localStorage.getItem('luna_current_chat') || '');

  const styleJSON = JSON.stringify(style);
  localStorage.setItem('luna_input_style', styleJSON);
  if (_isCurrentScope === 'char' && effectiveCharId && effectiveCharId !== 'default') {
    localStorage.setItem('luna_input_style_char_' + effectiveCharId, styleJSON);
  }

  /* BroadcastChannel 实时通知 chatroom */
  try {
    const bc = new BroadcastChannel('luna_input_style_channel');
    bc.postMessage({ key: 'luna_input_style', value: styleJSON, scope: _isCurrentScope, charId: effectiveCharId });
    bc.close();
  } catch(e) {}

  window.dispatchEvent(new StorageEvent('storage', {
    key: 'luna_input_style', newValue: styleJSON, storageArea: localStorage
  }));

  /* 按钮反馈 */
  const btn = document.querySelector('#inputStudioPage .is-btn-solid');
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = '✓ 已同步';
    btn.style.background = '#3a7a3a';
    setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 1800);
  }
}

function isExportCSS() {
  const s = {
    inputBg:     isV('isCInputBg'),
    areaBg:      isV('isCAreaBg'),
    addBtn:      isV('isCAddBtn'),
    aiBg:        isV('isCaiBg'),
    sendBg:      isV('isCsendBg'),
    placeholder: isV('isCPlaceholder'),
    btnSize:     parseInt(document.getElementById('isRBtnSize').value),
    boxH:        parseInt(document.getElementById('isRBoxH').value),
    boxFs:       parseInt(document.getElementById('isRBoxFs').value),
    pb:          parseInt(document.getElementById('isRPb').value),
    radius:      parseInt(document.getElementById('isRRadius').value),
  };
  const css =
`.cr-input-area { background: ${s.areaBg}; padding-bottom: ${s.pb}px; }\n` +
`.cr-input-box { background: ${s.inputBg}; min-height: ${s.boxH}px; font-size: ${s.boxFs}px; }\n` +
`.cr-add-btn { background: ${s.addBtn}; width: ${s.btnSize}px; height: ${s.btnSize}px; border-radius: ${s.radius}px; }\n` +
`.cr-ai-btn { background: ${s.aiBg}; width: ${s.btnSize}px; height: ${s.btnSize}px; border-radius: ${s.radius}px; }\n` +
`.cr-send-btn { background: ${s.sendBg}; width: ${s.btnSize}px; height: ${s.btnSize}px; border-radius: ${s.radius}px; }`;
  navigator.clipboard.writeText(css).then(() => {
    const btn = document.querySelector('#inputStudioPage .is-btn-outline');
    if (btn) { btn.textContent = '已复制!'; setTimeout(() => btn.textContent = '导出 CSS', 1500); }
  });
}

/* ================================================================
   Input Studio — DOMContentLoaded 初始化
================================================================ */
document.addEventListener('DOMContentLoaded', function() {
  isRefreshSelect();
  isInitRangeFills();
  const hintEl = document.getElementById('isScopeHint');
  if (hintEl) hintEl.textContent = '将应用到所有角色的输入区样式';
});
/* ================================================================
   Bubble Studio — 状态栏时钟 + 电量（与 hsTick/isTick 完全同步）
================================================================ */
function bsTick() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const n = new Date();
  const timeStr = n.toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz
  });
  const el = document.getElementById('bsTime');
  if (el) el.textContent = timeStr;

  const pct = parseInt(localStorage.getItem('luna_battery') || '76');
  const pctEl   = document.getElementById('bsBatPct');
  const innerEl = document.getElementById('bsBatInner');
  if (pctEl) pctEl.textContent = pct;
  if (innerEl) {
    innerEl.style.width = pct + '%';
    innerEl.style.background = pct <= 20
      ? 'linear-gradient(90deg,#f87171,#ef4444)' : '#1a1a1a';
  }
}
bsTick();
setInterval(bsTick, 10000);

/* ================================================================
   Bubble Studio — 灵动岛（与 hsApplyIsland 完全同步，挂到 #bsIsland）
================================================================ */
function bsApplyIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const el = document.getElementById('bsIsland');
  if (!el) return;
  if (!enabled) { el.innerHTML = ''; return; }
  const styleMap = {
    minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
    clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="bsIslandClock">--:--</span></div></div>`,
    pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
    ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
    rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
    music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
    scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
  };
  el.innerHTML = styleMap[style] || styleMap.minimal;
  clearInterval(window._bsIslandClockTimer);
  if (style === 'clock') {
    const tick = () => {
      const t = document.getElementById('bsIslandClock');
      if (!t) return;
      const now = new Date();
      t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    };
    tick();
    window._bsIslandClockTimer = setInterval(tick, 10000);
  }
}

/* ================================================================
   Bubble Studio — 字体同步（复用 luna-font-override，已由主页面注入）
================================================================ */
async function bsApplyGlobalFont() {
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
  // 复用主页面已注入的 luna-font-override
}

/* ================================================================
   Bubble Studio — storage 事件监听
================================================================ */
window.addEventListener('storage', function(e) {
  if (e.key === 'luna_island_update' || e.key === 'luna_island_enabled' || e.key === 'luna_island_style') bsApplyIsland();
  if (e.key === 'luna_tz_update') bsTick();
});

/* ================================================================
   Bubble Studio — 页面开关
================================================================ */
function openBubbleStudio() {
  const page = document.getElementById('bubbleStudioPage');
  page.classList.remove('bs-closing');
  page.classList.add('bs-open');
  page.scrollTop = 0;
  bsTick();
  bsApplyIsland();
  bsApplyGlobalFont();
  bsInitRangeFills();
  /* 初始化时载入头像到预览 */
  bsLoadAvatarIntoPreview();

  /* 进入时加载已保存样式 */
  const charId = (AP_CHAR_ID && AP_CHAR_ID !== 'default')
    ? AP_CHAR_ID
    : (localStorage.getItem('luna_current_chat') || '');
  if (charId && charId !== 'default') {
    const charKey = 'luna_bubble_style_char_' + charId;
    if (localStorage.getItem(charKey)) {
      bsSetScope('char');
    } else {
      bsSetScope('global');
      bsLoadScopeStyle('global');
    }
  } else {
    bsSetScope('global');
    bsLoadScopeStyle('global');
  }
}
function closeBubbleStudio() {
  const page = document.getElementById('bubbleStudioPage');
  page.classList.add('bs-closing');
  page.addEventListener('animationend', function handler() {
    page.classList.remove('bs-open', 'bs-closing');
    page.removeEventListener('animationend', handler);
  });
}

/* ================================================================
   Bubble Studio — 滑动条填充色同步
================================================================ */
function bsUpdateRangeFill(input) {
  const min = parseFloat(input.min) || 0;
  const max = parseFloat(input.max) || 100;
  const val = parseFloat(input.value);
  const pct = ((val - min) / (max - min)) * 100;
  input.style.background = `linear-gradient(to right, #1a1a1a 0%, #1a1a1a ${pct}%, #e8e8e8 ${pct}%, #e8e8e8 100%)`;
}
function bsInitRangeFills() {
  document.querySelectorAll('#bubbleStudioPage .bs-range').forEach(input => {
    bsUpdateRangeFill(input);
    input.addEventListener('input', () => bsUpdateRangeFill(input));
  });
}

/* ================================================================
   Bubble Studio — Scope 切换
================================================================ */
let _bsCurrentScope = 'global';
function bsSetScope(s) {
  _bsCurrentScope = s;
  document.getElementById('bsSpGlobal').classList.toggle('on', s === 'global');
  document.getElementById('bsSpChar').classList.toggle('on',   s === 'char');
  const charId = (AP_CHAR_ID && AP_CHAR_ID !== 'default')
    ? AP_CHAR_ID : (localStorage.getItem('luna_current_chat') || '');
  const charLabel = (charId && charId !== 'default') ? charId : 'Luna';
  document.getElementById('bsScopeHint').textContent = s === 'global'
    ? '将应用到所有角色的气泡样式'
    : `仅应用到当前角色「${charLabel}」的气泡样式`;
  bsLoadScopeStyle(s);
}

function bsLoadScopeStyle(s) {
  const charId = (AP_CHAR_ID && AP_CHAR_ID !== 'default')
    ? AP_CHAR_ID : (localStorage.getItem('luna_current_chat') || '');
  const key = (s === 'char' && charId && charId !== 'default')
    ? 'luna_bubble_style_char_' + charId
    : 'luna_bubble_style';
  const raw = localStorage.getItem(key);
  if (!raw) return;
  try {
    const st = JSON.parse(raw);
    // 回复方颜色
    if (st.lunaBg)  document.getElementById('bsCLunaBg').value  = st.lunaBg;
    if (st.lunaTx)  document.getElementById('bsCLunaTx').value  = st.lunaTx;
    if (st.lunaBd)  document.getElementById('bsCLunaBd').value  = st.lunaBd;
    if (st.lunaAc)  document.getElementById('bsCLunaAc').value  = st.lunaAc;
    // 发送方颜色
    if (st.mineBg)  document.getElementById('bsCMineBg').value  = st.mineBg;
    if (st.mineTx)  document.getElementById('bsCMineTx').value  = st.mineTx;
    if (st.mineBd)  document.getElementById('bsCMineBd').value  = st.mineBd;
    if (st.mineTm)  document.getElementById('bsCMineTm').value  = st.mineTm;
    // 尺寸
    if (st.lunaPad !== undefined) document.getElementById('bsRLunaPad').value = st.lunaPad;
    if (st.lunaFs  !== undefined) document.getElementById('bsRLunaFs').value  = st.lunaFs;
    if (st.lunaW   !== undefined) document.getElementById('bsRLunaW').value   = st.lunaW;
    if (st.minePad !== undefined) document.getElementById('bsRMinePad').value = st.minePad;
    if (st.mineFs  !== undefined) document.getElementById('bsRMineFs').value  = st.mineFs;
    if (st.mineW   !== undefined) document.getElementById('bsRMineW').value   = st.mineW;
    if (st.lunaAvSize !== undefined) document.getElementById('bsRLunaAvSize').value = st.lunaAvSize;
    if (st.mineAvSize !== undefined) document.getElementById('bsRMineAvSize').value = st.mineAvSize;
    if (st.gap    !== undefined) document.getElementById('bsRGap').value   = st.gap;
    if (st.gapPx  !== undefined) document.getElementById('bsRGapPx').value = st.gapPx;
    // 开关
    if (st.lunaAvShow !== undefined) bsSetToggle('bsTogLunaAv', st.lunaAvShow);
    if (st.mineAvShow !== undefined) bsSetToggle('bsTogMineAv', st.mineAvShow);
    if (st.lunaTimeShow !== undefined) bsSetToggle('bsTogLunaTime', st.lunaTimeShow);
    if (st.mineTimeShow !== undefined) bsSetToggle('bsTogMineTime', st.mineTimeShow);
    if (st.lunaAccent !== undefined)  bsSetToggle('bsTogLunaAccent', st.lunaAccent);
    if (st.mineRead !== undefined)    bsSetToggle('bsTogMineRead', st.mineRead);
    // 气泡形状
    if (st.lunaShape) {
      _bsLunaShape = st.lunaShape;
      document.getElementById('bsPvLunaBubble').style.borderRadius = st.lunaShape;
      document.querySelectorAll('#bubbleStudioPage .bs-shape-grid .bs-si').forEach(function(el) {
        var oc = el.getAttribute('onclick') || '';
        if (oc.includes('LunaShape')) {
          el.classList.toggle('active', oc.includes("'" + st.lunaShape + "'"));
        }
      });
    }
    if (st.mineShape) {
      _bsMineShape = st.mineShape;
      document.getElementById('bsPvMineBubble').style.borderRadius = st.mineShape;
      document.querySelectorAll('#bubbleStudioPage .bs-shape-grid .bs-si').forEach(function(el) {
        var oc = el.getAttribute('onclick') || '';
        if (oc.includes('MineShape')) {
          el.classList.toggle('active', oc.includes("'" + st.mineShape + "'"));
        }
      });
    }
    if (st.customCode !== undefined) document.getElementById('bsCssCode').value = st.customCode;
    if (st.schemeName !== undefined) document.getElementById('bsSchemeName').value = st.schemeName;
    bsSyncLunaColors();
    bsSyncMineColors();
    bsSyncLunaPad(document.getElementById('bsRLunaPad'));
    bsSyncLunaFs(document.getElementById('bsRLunaFs'));
    bsSyncLunaW(document.getElementById('bsRLunaW'));
    bsSyncMinePad(document.getElementById('bsRMinePad'));
    bsSyncMineFs(document.getElementById('bsRMineFs'));
    bsSyncMineW(document.getElementById('bsRMineW'));
    bsSyncLunaAvSize(document.getElementById('bsRLunaAvSize'));
    bsSyncMineAvSize(document.getElementById('bsRMineAvSize'));
    bsInitRangeFills();
  } catch(e) {}
}

/* ================================================================
   Bubble Studio — Tab 切换
================================================================ */
function bsSwitchTab(t) {
  ['luna','mine','common'].forEach(function(k) {
    document.getElementById('bs-tab-'+k).classList.toggle('active', k===t);
    var p = document.getElementById('bs-panel-'+k);
    if (p) p.style.display = k===t ? 'block' : 'none';
  });
  var lb = document.getElementById('bsPvLunaBubble');
  var rb = document.getElementById('bsPvMineBubble');
  if (t==='luna') {
    lb.style.outline = '2px solid rgba(0,0,0,.2)'; lb.style.outlineOffset = '3px';
    rb.style.outline = 'none';
  } else if (t==='mine') {
    rb.style.outline = '2px solid rgba(0,0,0,.25)'; rb.style.outlineOffset = '3px';
    lb.style.outline = 'none';
  } else {
    lb.style.outline = 'none'; rb.style.outline = 'none';
  }
}

/* ================================================================
   Bubble Studio — 开关辅助
================================================================ */
var _bsLunaAccentOn = true;
var _bsMineReadOn   = true;
var _bsLunaShape    = '18px 18px 18px 5px';
var _bsMineShape    = '18px 18px 5px 18px';

function bsSetToggle(id, on) {
  const el = document.getElementById(id);
  if (!el) return;
  if (on) el.classList.add('on'); else el.classList.remove('on');
  /* 同步预览区头像的 display 状态 */
  if (id === 'bsTogLunaAv') {
    const av = document.getElementById('bsPvLunaAv');
    if (av) av.style.display = on ? 'block' : 'none';
    if (on) bsLoadAvatarIntoPreview();
  }
  if (id === 'bsTogMineAv') {
    const av = document.getElementById('bsPvMineAv');
    if (av) av.style.display = on ? 'block' : 'none';
    if (on) bsLoadAvatarIntoPreview();
  }
}
function bsToggleEl(tog, elId) {
  tog.classList.toggle('on');
  var el = document.getElementById(elId);
  if (el) el.style.visibility = tog.classList.contains('on') ? 'visible' : 'hidden';
}
function bsToggleLunaAv(tog) {
  tog.classList.toggle('on');
  var av = document.getElementById('bsPvLunaAv');
  var on = tog.classList.contains('on');
  av.style.display = on ? 'block' : 'none';
  if (on) bsLoadAvatarIntoPreview();
}
function bsToggleMineAv(tog) {
  tog.classList.toggle('on');
  var av = document.getElementById('bsPvMineAv');
  var on = tog.classList.contains('on');
  av.style.display = on ? 'block' : 'none';
  if (on) bsLoadAvatarIntoPreview();
}

/* ================================================================
   Bubble Studio — 从角色数据读取头像并填充预览
================================================================ */
function bsLoadAvatarIntoPreview() {
  /* 尝试从当前角色 localStorage 读取 avatar */
  var charId = (AP_CHAR_ID && AP_CHAR_ID !== 'default')
    ? AP_CHAR_ID
    : (localStorage.getItem('luna_current_chat') || '');

  var avatarUrl = null;

  /* 优先从角色档案里读 */
  if (charId && charId !== 'default') {
    try {
      var chars = JSON.parse(localStorage.getItem('luna_characters') || '[]');
      var ch = chars.find(function(c) { return c.name === charId || c.id === charId; });
      if (ch && ch.avatar) avatarUrl = ch.avatar;
    } catch(e) {}
  }

  /* 也尝试 luna_char_avatar_<charId> 独立 key */
  if (!avatarUrl && charId && charId !== 'default') {
    avatarUrl = localStorage.getItem('luna_char_avatar_' + charId) || null;
  }

  /* 也尝试通用头像 key */
  if (!avatarUrl) {
    avatarUrl = localStorage.getItem('luna_avatar') || null;
  }

  var lunaAv = document.getElementById('bsPvLunaAv');
  var mineAv = document.getElementById('bsPvMineAv');

  if (avatarUrl) {
    /* 用 background-image 渲染头像 */
    var bgStyle = 'url(' + avatarUrl + ') center/cover no-repeat';
    if (lunaAv) { lunaAv.style.background = bgStyle; lunaAv.style.backgroundSize = 'cover'; }
    if (mineAv) { mineAv.style.background = bgStyle; mineAv.style.backgroundSize = 'cover'; }
  } else {
    /* 无头像时显示默认占位色 */
    if (lunaAv) lunaAv.style.background = '#d8d8d8';
    if (mineAv) mineAv.style.background = '#c0c0c0';
  }
}
function bsToggleLunaAccent(tog) {
  tog.classList.toggle('on');
  _bsLunaAccentOn = tog.classList.contains('on');
}
function bsToggleMineRead(tog) {
  tog.classList.toggle('on');
  _bsMineReadOn = tog.classList.contains('on');
  var t = document.getElementById('bsPvMineTime');
  if (t) t.textContent = _bsMineReadOn ? '21:03 · 已读' : '21:03';
}

/* ================================================================
   Bubble Studio — 头像形状 / 位置
================================================================ */
function bsSetLunaAvShape(el, r) {
  el.closest('.bs-subtabs').querySelectorAll('.bs-spb').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  document.getElementById('bsPvLunaAv').style.borderRadius = r;
}
function bsSetMineAvShape(el, r) {
  el.closest('.bs-subtabs').querySelectorAll('.bs-spb').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  document.getElementById('bsPvMineAv').style.borderRadius = r;
}
function bsSetMineAvPos(el, pos) {
  el.closest('.bs-subtabs').querySelectorAll('.bs-spb').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  var wrap = document.getElementById('bsPvMineWrap');
  var av   = document.getElementById('bsPvMineAv');
  var bub  = document.getElementById('bsPvMineBubble');
  if (pos === 'left') {
    wrap.style.flexDirection = 'row';
    wrap.insertBefore(av, bub);
  } else {
    wrap.style.flexDirection = 'row';
    wrap.appendChild(av);
  }
}

/* ================================================================
   Bubble Studio — 气泡形状
================================================================ */
function bsSetLunaShape(el, r) {
  el.closest('.bs-shape-grid').querySelectorAll('.bs-si').forEach(s => s.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('bsPvLunaBubble').style.borderRadius = r;
  _bsLunaShape = r;
}
function bsSetMineShape(el, r) {
  el.closest('.bs-shape-grid').querySelectorAll('.bs-si').forEach(s => s.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('bsPvMineBubble').style.borderRadius = r;
  _bsMineShape = r;
}

/* ================================================================
   Bubble Studio — 颜色同步
================================================================ */
function bsSyncLunaColors() {
  const bg = document.getElementById('bsCLunaBg').value;
  const tx = document.getElementById('bsCLunaTx').value;
  const bd = document.getElementById('bsCLunaBd').value;
  document.getElementById('bsHLunaBg').textContent = bg;
  document.getElementById('bsHLunaTx').textContent = tx;
  document.getElementById('bsHLunaBd').textContent = bd;
  document.getElementById('bsHLunaAc').textContent = document.getElementById('bsCLunaAc').value;
  const b = document.getElementById('bsPvLunaBubble');
  b.style.background   = bg;
  b.style.color        = tx;
  b.style.borderColor  = bd;
}
function bsSyncMineColors() {
  const bg = document.getElementById('bsCMineBg').value;
  const tx = document.getElementById('bsCMineTx').value;
  const bd = document.getElementById('bsCMineBd').value;
  const tm = document.getElementById('bsCMineTm').value;
  document.getElementById('bsHMineBg').textContent = bg;
  document.getElementById('bsHMineTx').textContent = tx;
  document.getElementById('bsHMineBd').textContent = bd;
  document.getElementById('bsHMineTm').textContent = tm;
  const b = document.getElementById('bsPvMineBubble');
  b.style.background   = bg;
  b.style.color        = tx;
  b.style.borderColor  = bd;
  const t = document.getElementById('bsPvMineTime');
  if (t) t.style.color = tm;
}
function bsResetLunaColors() {
  document.getElementById('bsCLunaBg').value = '#f7f7f7';
  document.getElementById('bsCLunaTx').value = '#1a1a1a';
  document.getElementById('bsCLunaBd').value = '#e8e8e8';
  document.getElementById('bsCLunaAc').value = '#d0d0d0';
  bsSyncLunaColors();
}
function bsResetMineColors() {
  document.getElementById('bsCMineBg').value = '#1a1a1a';
  document.getElementById('bsCMineTx').value = '#f7f7f7';
  document.getElementById('bsCMineBd').value = '#1a1a1a';
  document.getElementById('bsCMineTm').value = '#b8b2aa';
  bsSyncMineColors();
}

/* ================================================================
   Bubble Studio — 尺寸同步
================================================================ */
function bsSyncLunaAvSize(inp) {
  document.getElementById('bsLunaAvSizeVal').textContent = inp.value + 'px';
  const av = document.getElementById('bsPvLunaAv');
  av.style.width = inp.value + 'px'; av.style.height = inp.value + 'px';
  bsUpdateRangeFill(inp);
}
function bsSyncMineAvSize(inp) {
  document.getElementById('bsMineAvSizeVal').textContent = inp.value + 'px';
  const av = document.getElementById('bsPvMineAv');
  av.style.width = inp.value + 'px'; av.style.height = inp.value + 'px';
  bsUpdateRangeFill(inp);
}
function bsSyncLunaPad(inp) {
  document.getElementById('bsLunaPadVal').textContent = inp.value + 'px';
  document.getElementById('bsPvLunaBubble').style.padding = inp.value + 'px ' + (parseInt(inp.value)+3) + 'px';
  bsUpdateRangeFill(inp);
}
function bsSyncLunaFs(inp) {
  document.getElementById('bsLunaFsVal').textContent = inp.value + 'px';
  document.getElementById('bsPvLunaBubble').style.fontSize = inp.value + 'px';
  bsUpdateRangeFill(inp);
}
function bsSyncLunaW(inp) {
  document.getElementById('bsLunaWVal').textContent = inp.value + '%';
  bsUpdateRangeFill(inp);
}
function bsSyncMinePad(inp) {
  document.getElementById('bsMinePadVal').textContent = inp.value + 'px';
  document.getElementById('bsPvMineBubble').style.padding = inp.value + 'px ' + (parseInt(inp.value)+3) + 'px';
  bsUpdateRangeFill(inp);
}
function bsSyncMineFs(inp) {
  document.getElementById('bsMineFsVal').textContent = inp.value + 'px';
  document.getElementById('bsPvMineBubble').style.fontSize = inp.value + 'px';
  bsUpdateRangeFill(inp);
}
function bsSyncMineW(inp) {
  document.getElementById('bsMineWVal').textContent = inp.value + '%';
  bsUpdateRangeFill(inp);
}
function bsSyncGap(inp) {
  document.getElementById('bsGapVal').textContent = inp.value + 'px';
  bsUpdateRangeFill(inp);
}
function bsSyncGapPx(inp) {
  document.getElementById('bsGapPxVal').textContent = inp.value + 'px';
  bsUpdateRangeFill(inp);
}
function bsResetLunaSize() {
  document.getElementById('bsRLunaPad').value = 13;
  document.getElementById('bsRLunaFs').value  = 14;
  document.getElementById('bsRLunaW').value   = 75;
  bsSyncLunaPad(document.getElementById('bsRLunaPad'));
  bsSyncLunaFs(document.getElementById('bsRLunaFs'));
  bsSyncLunaW(document.getElementById('bsRLunaW'));
}
function bsResetMineSize() {
  document.getElementById('bsRMinePad').value = 13;
  document.getElementById('bsRMineFs').value  = 14;
  document.getElementById('bsRMineW').value   = 75;
  bsSyncMinePad(document.getElementById('bsRMinePad'));
  bsSyncMineFs(document.getElementById('bsRMineFs'));
  bsSyncMineW(document.getElementById('bsRMineW'));
}
function bsResetGap() {
  document.getElementById('bsRGap').value   = 6;
  document.getElementById('bsRGapPx').value = 24;
  bsSyncGap(document.getElementById('bsRGap'));
  bsSyncGapPx(document.getElementById('bsRGapPx'));
}

/* ================================================================
   Bubble Studio — CSS 编辑器
================================================================ */
let _bsAppliedStyle = null;
function bsInsertClass(cls) {
  const ta = document.getElementById('bsCssCode');
  if (!ta) return;
  const start = ta.selectionStart, end = ta.selectionEnd;
  const insert = cls + ' ';
  ta.value = ta.value.slice(0, start) + insert + ta.value.slice(end);
  ta.selectionStart = ta.selectionEnd = start + insert.length;
  ta.focus();
}
function bsApplyCss() {
  const code = document.getElementById('bsCssCode').value.trim();
  if (_bsAppliedStyle) _bsAppliedStyle.remove();
  const s = document.createElement('style');
  s.textContent = code;
  document.head.appendChild(s);
  _bsAppliedStyle = s;
  const st = document.getElementById('bsCssStatus');
  if (st) { st.textContent = '已应用'; setTimeout(() => { st.textContent = ''; }, 1500); }
}
function bsClearCss() {
  if (_bsAppliedStyle) { _bsAppliedStyle.remove(); _bsAppliedStyle = null; }
  const st = document.getElementById('bsCssStatus');
  if (st) st.textContent = '';
}

/* ================================================================
   Bubble Studio — 方案管理
================================================================ */
const BS_STORE_KEY = 'bstudio_schemes';
function bsGetSchemes() { try { return JSON.parse(localStorage.getItem(BS_STORE_KEY) || '{}'); } catch { return {}; } }
function bsSaveSchemes(obj) { localStorage.setItem(BS_STORE_KEY, JSON.stringify(obj)); }

let _bsSelectedScheme = '';
function bsGetSelectValue() { return _bsSelectedScheme; }
function bsSetSelectValue(name) {
  _bsSelectedScheme = name || '';
  const valEl = document.getElementById('bsCsValue');
  if (!valEl) return;
  if (!name) { valEl.textContent = '— 选择已保存方案 —'; valEl.classList.add('placeholder'); }
  else { valEl.textContent = name; valEl.classList.remove('placeholder'); }
  document.querySelectorAll('#bubbleStudioPage .bs-cs-option').forEach(o => {
    o.classList.toggle('selected', o.dataset.value === name);
  });
}
function bsToggleDropdown() {
  const wrap = document.getElementById('bsCustomSelect');
  if (wrap.classList.contains('open')) bsCloseDropdown(); else wrap.classList.add('open');
}
function bsCloseDropdown() {
  const wrap = document.getElementById('bsCustomSelect');
  if (wrap) wrap.classList.remove('open');
}
document.addEventListener('click', function(e) {
  const wrap = document.getElementById('bsCustomSelect');
  if (wrap && !wrap.contains(e.target)) bsCloseDropdown();
});
function bsRefreshSelect() {
  const schemes = bsGetSchemes();
  const dropdown = document.getElementById('bsCsDropdown');
  if (!dropdown) return;
  dropdown.innerHTML = '';
  const keys = Object.keys(schemes);
  if (keys.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'bs-cs-option empty';
    empty.textContent = '暂无已保存方案';
    dropdown.appendChild(empty);
  } else {
    keys.forEach(name => {
      const item = document.createElement('div');
      item.className = 'bs-cs-option' + (name === _bsSelectedScheme ? ' selected' : '');
      item.dataset.value = name;
      item.textContent = name;
      item.onclick = function() { bsSetSelectValue(name); bsCloseDropdown(); bsLoadScheme(); };
      dropdown.appendChild(item);
    });
  }
  if (_bsSelectedScheme && !schemes[_bsSelectedScheme]) bsSetSelectValue('');
}
function bsLoadScheme() {
  const name = bsGetSelectValue();
  if (!name) return;
  const sc = bsGetSchemes()[name];
  if (!sc) return;
  if (sc.code) document.getElementById('bsCssCode').value = sc.code;
  document.getElementById('bsSchemeName').value = name;
}
function bsOpenSaveModal() {
  document.getElementById('bsSmNameInput').value = document.getElementById('bsSchemeName').value || '';
  document.getElementById('bsSaveModal').classList.add('show');
  document.getElementById('bsSmNameInput').focus();
}
function bsCloseSaveModal() { document.getElementById('bsSaveModal').classList.remove('show'); }
function bsConfirmSave() {
  const name = document.getElementById('bsSmNameInput').value.trim();
  if (!name) { document.getElementById('bsSmNameInput').style.borderColor = '#c44'; return; }
  document.getElementById('bsSmNameInput').style.borderColor = '';
  const schemes = bsGetSchemes();
  schemes[name] = { code: document.getElementById('bsCssCode').value };
  bsSaveSchemes(schemes);
  bsRefreshSelect();
  bsSetSelectValue(name);
  document.getElementById('bsSchemeName').value = name;
  bsCloseSaveModal();
}
function bsDeleteScheme() {
  const name = bsGetSelectValue();
  if (!name) return;
  const schemes = bsGetSchemes();
  delete schemes[name];
  bsSaveSchemes(schemes);
  bsSetSelectValue('');
  bsRefreshSelect();
  document.getElementById('bsSchemeName').value = '';
}

/* ================================================================
   Bubble Studio — 应用到聊天室（bsApplyAll）& 导出 CSS
================================================================ */
function bsApplyAll() {
  const style = {
    // 回复方
    lunaBg:  document.getElementById('bsCLunaBg').value,
    lunaTx:  document.getElementById('bsCLunaTx').value,
    lunaBd:  document.getElementById('bsCLunaBd').value,
    lunaAc:  document.getElementById('bsCLunaAc').value,
    lunaPad: parseInt(document.getElementById('bsRLunaPad').value),
    lunaFs:  parseInt(document.getElementById('bsRLunaFs').value),
    lunaW:   parseInt(document.getElementById('bsRLunaW').value),
    lunaAvSize:   parseInt(document.getElementById('bsRLunaAvSize').value),
    lunaAvShow:   document.getElementById('bsTogLunaAv').classList.contains('on'),
    lunaTimeShow: document.getElementById('bsTogLunaTime').classList.contains('on'),
    lunaAccent:   document.getElementById('bsTogLunaAccent').classList.contains('on'),
    // 发送方
    mineBg:  document.getElementById('bsCMineBg').value,
    mineTx:  document.getElementById('bsCMineTx').value,
    mineBd:  document.getElementById('bsCMineBd').value,
    mineTm:  document.getElementById('bsCMineTm').value,
    minePad: parseInt(document.getElementById('bsRMinePad').value),
    mineFs:  parseInt(document.getElementById('bsRMineFs').value),
    mineW:   parseInt(document.getElementById('bsRMineW').value),
    mineAvSize:   parseInt(document.getElementById('bsRMineAvSize').value),
    mineAvShow:   document.getElementById('bsTogMineAv').classList.contains('on'),
    mineTimeShow: document.getElementById('bsTogMineTime').classList.contains('on'),
    mineRead:     document.getElementById('bsTogMineRead').classList.contains('on'),
    // 气泡形状
    lunaShape: _bsLunaShape,
    mineShape: _bsMineShape,
    // 通用
    gap:   parseInt(document.getElementById('bsRGap').value),
    gapPx: parseInt(document.getElementById('bsRGapPx').value),
    customCode: (document.getElementById('bsCssCode').value || '').trim(),
    schemeName: (document.getElementById('bsSchemeName').value || '').trim(),
    scope:  _bsCurrentScope,
    charId: AP_CHAR_ID,
    ts:     Date.now()
  };

  const effectiveCharId = (AP_CHAR_ID && AP_CHAR_ID !== 'default')
    ? AP_CHAR_ID
    : (localStorage.getItem('luna_current_chat') || '');

  const styleJSON = JSON.stringify(style);
  localStorage.setItem('luna_bubble_style', styleJSON);
  if (_bsCurrentScope === 'char' && effectiveCharId && effectiveCharId !== 'default') {
    localStorage.setItem('luna_bubble_style_char_' + effectiveCharId, styleJSON);
  }

  /* BroadcastChannel 实时通知 chatroom */
  try {
    const bc = new BroadcastChannel('luna_bubble_style_channel');
    bc.postMessage({ key: 'luna_bubble_style', value: styleJSON, scope: _bsCurrentScope, charId: effectiveCharId });
    bc.close();
  } catch(e) {}

  window.dispatchEvent(new StorageEvent('storage', {
    key: 'luna_bubble_style', newValue: styleJSON, storageArea: localStorage
  }));

  /* 按钮反馈 */
  const btn = document.querySelector('#bubbleStudioPage .bs-btn-solid');
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = '✓ 已同步';
    btn.style.background = '#3a7a3a';
    setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 1800);
  }
}

function bsExportCSS() {
  const s = {
    lunaBg:  document.getElementById('bsCLunaBg').value,
    lunaTx:  document.getElementById('bsCLunaTx').value,
    lunaBd:  document.getElementById('bsCLunaBd').value,
    mineBg:  document.getElementById('bsCMineBg').value,
    mineTx:  document.getElementById('bsCMineTx').value,
    lunaPad: parseInt(document.getElementById('bsRLunaPad').value),
    lunaFs:  parseInt(document.getElementById('bsRLunaFs').value),
    minePad: parseInt(document.getElementById('bsRMinePad').value),
    mineFs:  parseInt(document.getElementById('bsRMineFs').value),
    gap:     parseInt(document.getElementById('bsRGap').value),
    gapPx:   parseInt(document.getElementById('bsRGapPx').value),
  };
  const css =
`.cr-luna-bubble { background: ${s.lunaBg}; color: ${s.lunaTx}; border-color: ${s.lunaBd}; padding: ${s.lunaPad}px ${s.lunaPad+3}px; font-size: ${s.lunaFs}px; }\n` +
`.cr-mine-bubble { background: ${s.mineBg}; color: ${s.mineTx}; padding: ${s.minePad}px ${s.minePad+3}px; font-size: ${s.mineFs}px; }\n` +
`.cr-messages-outer { gap: ${s.gap}px; padding-left: ${s.gapPx}px; padding-right: ${s.gapPx}px; }`;
  navigator.clipboard.writeText(css).then(() => {
    const btn = document.querySelector('#bubbleStudioPage .bs-btn-outline');
    if (btn) { btn.textContent = '已复制!'; setTimeout(() => btn.textContent = '导出 CSS', 1500); }
  });
}

/* ================================================================
   Bubble Studio — DOMContentLoaded 初始化
================================================================ */
document.addEventListener('DOMContentLoaded', function() {
  bsRefreshSelect();
  bsInitRangeFills();
});