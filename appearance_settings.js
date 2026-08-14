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
/* ================================================================
   ✦ 新增子页面公共工具 —— Card / Panel / Custom Studio 共用
   （状态栏时钟、电量、灵动岛、滑块填充、复制键名）
================================================================ */

/* 通用状态栏 tick：传入 时间元素id / 电量文字id / 电量条id */
function xsTick(timeId, batPctId, batInnerId) {
  const tEl = document.getElementById(timeId);
  if (tEl) {
    const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
    let now;
    try { now = new Date(new Date().toLocaleString('en-US', { timeZone: tz })); }
    catch (e) { now = new Date(); }
    tEl.textContent = now.getHours().toString().padStart(2, '0') + ':' +
                      now.getMinutes().toString().padStart(2, '0');
  }
  const pct = parseInt(localStorage.getItem('luna_battery') || '76');
  const pEl = document.getElementById(batPctId);
  const iEl = document.getElementById(batInnerId);
  if (pEl) pEl.textContent = pct;
  if (iEl) {
    iEl.style.width = Math.max(0, Math.min(100, pct)) + '%';
    iEl.style.background = pct <= 20 ? '#d05a5a' : '#1a1a1a';
  }
}

/* 通用灵动岛：与首页 apApplyIsland 保持完全一致的样式规则 */
function xsIsland(islandId) {
  const el = document.getElementById(islandId);
  if (!el) return;
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  if (!enabled) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'flex';
  const map = {
    minimal: '<div style="width:78px;height:22px;border-radius:20px;background:#1a1a1a;"></div>',
    pill:    '<div style="width:104px;height:24px;border-radius:20px;background:#1a1a1a;display:flex;align-items:center;justify-content:space-between;padding:0 8px;"><div style="width:8px;height:8px;border-radius:50%;background:#3a3a3a;"></div><div style="width:26px;height:3px;border-radius:2px;background:#3a3a3a;"></div><div style="width:8px;height:8px;border-radius:50%;background:#3a3a3a;"></div></div>',
    dot:     '<div style="width:26px;height:26px;border-radius:50%;background:#1a1a1a;"></div>',
    wide:    '<div style="width:132px;height:26px;border-radius:20px;background:#1a1a1a;"></div>'
  };
  el.innerHTML = map[style] || map.minimal;
}

/* 通用滑块填充 */
function xsFill(input) {
  if (!input) return;
  const min = parseFloat(input.min || 0), max = parseFloat(input.max || 100);
  const v = parseFloat(input.value);
  const pct = max === min ? 0 : ((v - min) / (max - min)) * 100;
  input.style.background = `linear-gradient(90deg,#1a1a1a ${pct}%,#eee ${pct}%)`;
}
function xsFillAll(pageId) {
  const p = document.getElementById(pageId);
  if (!p) return;
  p.querySelectorAll('input[type=range]').forEach(xsFill);
}

/* 复制存储键名 */
function xsCopyKey(el) {
  const txt = el.textContent.trim();
  const old = txt;
  const done = () => { el.textContent = '已复制 ✓'; setTimeout(() => { el.textContent = old; }, 1200); };
  if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done).catch(done);
  else done();
}

/* 当前角色 ID（与 AP_CHAR_ID 保持一致的兜底逻辑） */
function xsCharId() {
  const id = (typeof AP_CHAR_ID !== 'undefined' && AP_CHAR_ID && AP_CHAR_ID !== 'default')
    ? AP_CHAR_ID : (localStorage.getItem('luna_current_chat') || '');
  return id;
}

/* 统一下发：写 localStorage + BroadcastChannel + storage 事件 */
function xsDispatch(baseKey, channel, styleObj, scope) {
  const json = JSON.stringify(styleObj);
  const charId = xsCharId();
  localStorage.setItem(baseKey, json);
  if (scope === 'char' && charId) localStorage.setItem(baseKey + '_char_' + charId, json);
  try {
    const bc = new BroadcastChannel(channel);
    bc.postMessage({ key: baseKey, value: json, scope: scope, charId: charId });
    bc.close();
  } catch (e) {}
  try {
    window.dispatchEvent(new StorageEvent('storage', { key: baseKey, newValue: json, storageArea: localStorage }));
  } catch (e) {}
}

/* 同步按钮反馈 */
function xsBtnOk(pageId) {
  const btn = document.querySelector('#' + pageId + ' .is-btn-solid');
  if (!btn) return;
  const orig = btn.textContent;
  btn.textContent = '✓ 已同步';
  btn.style.background = '#3a7a3a';
  setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 1800);
}

/* 通用下拉方案选择器渲染 */
function xsRenderSelect(prefix, schemes, selected, onPick) {
  const dd = document.getElementById(prefix + 'CsDropdown');
  const val = document.getElementById(prefix + 'CsValue');
  if (!dd || !val) return;
  const names = Object.keys(schemes);
  dd.innerHTML = '';
  if (!names.length) {
    const d = document.createElement('div');
    d.className = 'is-cs-option empty';
    d.textContent = '暂无已保存方案';
    dd.appendChild(d);
  } else {
    names.forEach(n => {
      const d = document.createElement('div');
      d.className = 'is-cs-option' + (n === selected ? ' selected' : '');
      d.textContent = n;
      d.onclick = (ev) => { ev.stopPropagation(); onPick(n); };
      dd.appendChild(d);
    });
  }
  if (selected) { val.textContent = selected; val.classList.remove('placeholder'); }
  else { val.textContent = '— 选择已保存方案 —'; val.classList.add('placeholder'); }
}


/* ================================================================
   ✦ CARD STUDIO — 功能卡片美化
================================================================ */

/* ── 系统美化库：功能卡片 ──
   名称即用户在方案栏里能看到的名字，选中后按「同步到聊天」即可生效 */
const CD_LIB = [
  { id:'origin', name:'原初纸感', en:'ORIGIN PAPER',
    thumb:['#ffffff','#f5f5f5','#1a1a1a'],
    v:{ w:160,h:220,radius:16,iconR:11,title:13,gap:10,shadow:18,bw:0.5,
        bg:'#ffffff',bd:'#e0e0e0',art:'#f5f5f5',icon:'#6a6a6a',
        titleC:'#1a1a1a',sub:'#aaaaaa',tag:'#aaaaaa',foot:'#ffffff',
        no:true,subOn:true,rule:true,glow:false,blur:false } },

  { id:'azure', name:'湛蓝信笺', en:'AZURE NOTE',
    thumb:['#0a84ff','#e9f2ff','#ffffff'],
    v:{ w:158,h:214,radius:22,iconR:16,title:13,gap:12,shadow:24,bw:0,
        bg:'#ffffff',bd:'#dce8f7',art:'#eaf3ff',icon:'#0a84ff',
        titleC:'#0b2545',sub:'#7f9ec2',tag:'#9db8d6',foot:'#ffffff',
        no:false,subOn:true,rule:false,glow:true,blur:false } },

  { id:'ink', name:'墨夜', en:'INK NIGHT',
    thumb:['#141418','#26262c','#e8e8ee'],
    v:{ w:162,h:224,radius:18,iconR:12,title:13,gap:10,shadow:34,bw:0.5,
        bg:'#141418',bd:'#2c2c34',art:'#1d1d23',icon:'#c9c9d4',
        titleC:'#f0f0f4',sub:'#7c7c88',tag:'#61616c',foot:'#141418',
        no:true,subOn:true,rule:true,glow:true,blur:false } },

  { id:'frost', name:'霜雾玻璃', en:'FROST GLASS',
    thumb:['#f2f4f7','#ffffff','#c9ced6'],
    v:{ w:156,h:210,radius:24,iconR:18,title:12,gap:14,shadow:12,bw:0.5,
        bg:'#ffffff',bd:'#e6e9ee',art:'#f3f5f8',icon:'#8a92a0',
        titleC:'#2b3038',sub:'#a9b0ba',tag:'#b9c0ca',foot:'#ffffff',
        no:false,subOn:false,rule:false,glow:true,blur:true } },

  { id:'mono', name:'极简线稿', en:'MONO LINE',
    thumb:['#ffffff','#ffffff','#1a1a1a'],
    v:{ w:150,h:196,radius:4,iconR:0,title:12,gap:8,shadow:0,bw:1,
        bg:'#ffffff',bd:'#1a1a1a',art:'#ffffff',icon:'#1a1a1a',
        titleC:'#1a1a1a',sub:'#888888',tag:'#888888',foot:'#ffffff',
        no:true,subOn:false,rule:true,glow:false,blur:false } },

  { id:'stone', name:'岩灰', en:'STONE GREY',
    thumb:['#e8e8e6','#d6d6d3','#3a3a38'],
    v:{ w:164,h:228,radius:14,iconR:10,title:14,gap:9,shadow:22,bw:0,
        bg:'#f0f0ee',bd:'#dedddb',art:'#e2e2df',icon:'#5c5c58',
        titleC:'#2e2e2c',sub:'#909089',tag:'#a2a29b',foot:'#f0f0ee',
        no:true,subOn:true,rule:false,glow:false,blur:false } },

  { id:'plum', name:'暗梅', en:'DARK PLUM',
    thumb:['#221a22','#3a2b38','#e6d8e4'],
    v:{ w:158,h:220,radius:20,iconR:14,title:13,gap:11,shadow:30,bw:0.5,
        bg:'#221a22',bd:'#3d2d3b',art:'#2c212b',icon:'#c9a9c4',
        titleC:'#f0e6ef',sub:'#9b8399',tag:'#7d6a7b',foot:'#221a22',
        no:false,subOn:true,rule:true,glow:true,blur:false } },

  { id:'card', name:'卡牌收藏', en:'COLLECTOR',
    thumb:['#fbfbfb','#1a1a1a','#c8a24a'],
    v:{ w:150,h:238,radius:10,iconR:6,title:14,gap:14,shadow:26,bw:1,
        bg:'#fbfbfb',bd:'#c8a24a',art:'#f2efe7',icon:'#8a7538',
        titleC:'#1a1a1a',sub:'#9d8f6b',tag:'#c8a24a',foot:'#fbfbfb',
        no:true,subOn:true,rule:true,glow:false,blur:false } }
];

const CD_DEFAULT = CD_LIB[0].v;
let _cdScope = 'global';
let _cdLib = 'origin';
const _cdTog = { no:true, sub:true, rule:true, glow:false, blur:false };

function openCardStudio() {
  const p = document.getElementById('cardStudioPage');
  if (!p) return;
  p.classList.remove('is-closing');
  p.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  xsTick('cdTime', 'cdBatPct', 'cdBatInner');
  xsIsland('cdIsland');
  cdRenderLib();
  cdLoadScopeStyle(_cdScope);
  cdRefreshSelect();
  xsFillAll('cardStudioPage');
  cdRender();
}
function closeCardStudio() {
  const p = document.getElementById('cardStudioPage');
  if (!p) return;
  p.classList.remove('is-open');
  p.classList.add('is-closing');
  document.body.style.overflow = '';
  setTimeout(() => p.classList.remove('is-closing'), 280);
}

function cdRenderLib() {
  const box = document.getElementById('cdLibScroll');
  if (!box) return;
  box.innerHTML = CD_LIB.map(L => `
    <div class="xs-lib-card${L.id === _cdLib ? ' on' : ''}" data-lib="${L.id}" onclick="cdPickLib('${L.id}')">
      <div class="xs-lib-thumb" style="background:${L.thumb[1]};border:0.5px solid rgba(0,0,0,.08);">
        <div class="xs-lib-bar" style="background:${L.thumb[0]};width:70%"></div>
        <div class="xs-lib-dotrow">
          <div class="xs-lib-dot" style="background:${L.thumb[2]}"></div>
          <div class="xs-lib-dot" style="background:${L.thumb[0]};opacity:.6"></div>
          <div class="xs-lib-dot" style="background:${L.thumb[2]};opacity:.35"></div>
        </div>
      </div>
      <div class="xs-lib-name">${L.name}</div>
      <div class="xs-lib-en">${L.en}</div>
    </div>`).join('');
}

function cdPickLib(id) {
  const L = CD_LIB.find(x => x.id === id);
  if (!L) return;
  _cdLib = id;
  cdApplyValues(L.v);
  cdRenderLib();
  const n = document.getElementById('cdSchemeName');
  if (n) n.value = L.name;
  cdRender();
}

function cdApplyValues(v) {
  const set = (id, val) => { const e = document.getElementById(id); if (e) e.value = val; };
  set('cdRW', v.w); set('cdRH', v.h); set('cdRRadius', v.radius); set('cdRIconR', v.iconR);
  set('cdRTitle', v.title); set('cdRGap', v.gap); set('cdRShadow', v.shadow); set('cdRBw', v.bw);
  set('cdCBg', v.bg); set('cdCBd', v.bd); set('cdCArt', v.art); set('cdCIcon', v.icon);
  set('cdCTitle', v.titleC); set('cdCSub', v.sub); set('cdCTag', v.tag); set('cdCFoot', v.foot);
  _cdTog.no = v.no; _cdTog.sub = v.subOn; _cdTog.rule = v.rule; _cdTog.glow = v.glow; _cdTog.blur = v.blur;
  ['no','sub','rule','glow','blur'].forEach(k => {
    const el = document.getElementById('cdTog' + k.charAt(0).toUpperCase() + k.slice(1));
    if (el) el.classList.toggle('on', !!_cdTog[k]);
  });
  xsFillAll('cardStudioPage');
}

function cdV(id) { const e = document.getElementById(id); return e ? e.value : ''; }
function cdN(id) { const e = document.getElementById(id); return e ? parseFloat(e.value) : 0; }

function cdCollect() {
  return {
    w: cdN('cdRW'), h: cdN('cdRH'), radius: cdN('cdRRadius'), iconR: cdN('cdRIconR'),
    title: cdN('cdRTitle'), gap: cdN('cdRGap'), shadow: cdN('cdRShadow'), bw: cdN('cdRBw'),
    bg: cdV('cdCBg'), bd: cdV('cdCBd'), art: cdV('cdCArt'), icon: cdV('cdCIcon'),
    titleC: cdV('cdCTitle'), sub: cdV('cdCSub'), tag: cdV('cdCTag'), foot: cdV('cdCFoot'),
    no: _cdTog.no, subOn: _cdTog.sub, rule: _cdTog.rule, glow: _cdTog.glow, blur: _cdTog.blur,
    lib: _cdLib,
    customCode: (document.getElementById('cdCssCode') || {}).value || '',
    schemeName: (document.getElementById('cdSchemeName') || {}).value || '',
    scope: _cdScope, charId: xsCharId(), ts: Date.now()
  };
}

/* 实时预览渲染 */
function cdRender() {
  const s = cdCollect();
  const grid = document.getElementById('cdCardGrid');
  if (grid) grid.style.gap = s.gap + 'px';
  const scale = Math.min(1, 92 / Math.max(1, s.w * 0.62));
  ['cdCardL','cdCardM','cdCardR'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.width  = (s.w * 0.58) + 'px';
    el.style.height = (s.h * 0.54) + 'px';
    el.style.borderRadius = s.radius + 'px';
    el.style.background = s.bg;
    el.style.borderWidth = s.bw + 'px';
    el.style.borderStyle = s.bw > 0 ? 'solid' : 'none';
    el.style.borderColor = s.bd;
    el.style.boxShadow = s.shadow > 0
      ? `0 ${Math.round(s.shadow * 0.5)}px ${s.shadow}px -${Math.round(s.shadow * 0.4)}px rgba(0,0,0,${(s.shadow / 100).toFixed(2)})`
      : 'none';
    el.style.backdropFilter = s.blur ? 'blur(10px)' : '';
    el.style.borderTop = s.rule && s.bw > 0 ? '' : el.style.borderTop;
    const ic = el.querySelector('.xs-fcard-icon');
    if (ic) { ic.style.background = s.art; ic.style.color = s.icon; ic.style.borderRadius = s.iconR + 'px'; }
    const nm = el.querySelector('.xs-fcard-name');
    if (nm) { nm.style.color = s.titleC; nm.style.fontSize = Math.max(8, s.title * 0.82) + 'px'; }
    const en = el.querySelector('.xs-fcard-en');
    if (en) { en.style.color = s.tag; en.style.display = s.no ? '' : 'none'; }
    const gl = el.querySelector('.xs-fcard-glow');
    if (gl) gl.style.opacity = s.glow ? '1' : '0';
  });
  const inner = document.getElementById('cdStageInner');
  if (inner) inner.style.background = s.foot;
}

function cdSyncColors() {
  const pairs = [['cdCBg','cdHBg'],['cdCBd','cdHBd'],['cdCArt','cdHArt'],['cdCIcon','cdHIcon'],
                 ['cdCTitle','cdHTitle'],['cdCSub','cdHSub'],['cdCTag','cdHTag'],['cdCFoot','cdHFoot']];
  pairs.forEach(([c, h]) => {
    const ce = document.getElementById(c), he = document.getElementById(h);
    if (ce && he) he.textContent = ce.value;
  });
  cdRender();
}
function cdSyncSize() {
  const m = [['cdRW','cdVW','px'],['cdRH','cdVH','px'],['cdRRadius','cdVRadius','px'],
             ['cdRIconR','cdVIconR','px'],['cdRTitle','cdVTitle','px'],['cdRGap','cdVGap','px'],
             ['cdRShadow','cdVShadow',''],['cdRBw','cdVBw','px']];
  m.forEach(([r, v, u]) => {
    const re = document.getElementById(r), ve = document.getElementById(v);
    if (re && ve) ve.textContent = re.value + u;
    xsFill(re);
  });
  cdRender();
}
function cdResetColors() {
  const d = CD_DEFAULT;
  ['cdCBg','cdCBd','cdCArt','cdCIcon','cdCTitle','cdCSub','cdCTag','cdCFoot'].forEach((id, i) => {
    const v = [d.bg, d.bd, d.art, d.icon, d.titleC, d.sub, d.tag, d.foot][i];
    const e = document.getElementById(id); if (e) e.value = v;
  });
  cdSyncColors();
}
function cdResetSize() {
  const d = CD_DEFAULT;
  const map = { cdRW:d.w, cdRH:d.h, cdRRadius:d.radius, cdRIconR:d.iconR,
                cdRTitle:d.title, cdRGap:d.gap, cdRShadow:d.shadow, cdRBw:d.bw };
  Object.keys(map).forEach(k => { const e = document.getElementById(k); if (e) e.value = map[k]; });
  cdSyncSize();
}
function cdToggle(key) {
  _cdTog[key] = !_cdTog[key];
  const el = document.getElementById('cdTog' + key.charAt(0).toUpperCase() + key.slice(1));
  if (el) el.classList.toggle('on', _cdTog[key]);
  cdRender();
}
function cdSetScope(s) {
  _cdScope = s;
  const g = document.getElementById('cdSpGlobal'), c = document.getElementById('cdSpChar');
  if (g) g.classList.toggle('on', s === 'global');
  if (c) c.classList.toggle('on', s === 'char');
  const hint = document.getElementById('cdScopeHint');
  if (hint) hint.textContent = s === 'char'
    ? `仅应用到「${xsCharId() || '当前角色'}」的功能卡片样式`
    : '将应用到所有角色的功能卡片样式';
  cdLoadScopeStyle(s);
}
function cdLoadScopeStyle(s) {
  const charId = xsCharId();
  const key = (s === 'char' && charId) ? 'luna_card_style_char_' + charId : 'luna_card_style';
  let raw = localStorage.getItem(key);
  if (!raw && s === 'char') raw = localStorage.getItem('luna_card_style');
  if (!raw) { cdApplyValues(CD_DEFAULT); cdSyncColors(); cdSyncSize(); return; }
  try {
    const v = JSON.parse(raw);
    cdApplyValues({
      w:v.w??160, h:v.h??220, radius:v.radius??16, iconR:v.iconR??11, title:v.title??13,
      gap:v.gap??10, shadow:v.shadow??18, bw:v.bw??0.5,
      bg:v.bg||'#ffffff', bd:v.bd||'#e0e0e0', art:v.art||'#f5f5f5', icon:v.icon||'#6a6a6a',
      titleC:v.titleC||'#1a1a1a', sub:v.sub||'#aaaaaa', tag:v.tag||'#aaaaaa', foot:v.foot||'#ffffff',
      no:v.no!==false, subOn:v.subOn!==false, rule:v.rule!==false, glow:!!v.glow, blur:!!v.blur
    });
    _cdLib = v.lib || _cdLib;
    const cc = document.getElementById('cdCssCode'); if (cc) cc.value = v.customCode || '';
    const sn = document.getElementById('cdSchemeName'); if (sn) sn.value = v.schemeName || '';
    cdRenderLib();
  } catch (e) { cdApplyValues(CD_DEFAULT); }
  cdSyncColors(); cdSyncSize();
}

function cdInsertClass(cls) {
  const ta = document.getElementById('cdCssCode');
  if (!ta) return;
  ta.value += (ta.value && !ta.value.endsWith('\n') ? '\n' : '') + cls + ' {\n  \n}\n';
  ta.focus();
}
let _cdAppliedStyle = null;
function cdApplyCss() {
  const code = (document.getElementById('cdCssCode') || {}).value || '';
  if (_cdAppliedStyle) _cdAppliedStyle.remove();
  _cdAppliedStyle = document.createElement('style');
  _cdAppliedStyle.textContent = code
    .replace(/\.fp-card-title/g, '#cdCardGrid .xs-fcard-name')
    .replace(/\.fp-card-art/g,   '#cdCardGrid .xs-fcard-icon')
    .replace(/\.fp-card(?![-\w])/g, '#cdCardGrid .xs-fcard');
  document.head.appendChild(_cdAppliedStyle);
  const st = document.getElementById('cdCssStatus');
  if (st) { st.textContent = '已应用到预览'; setTimeout(() => st.textContent = '', 1600); }
}
function cdClearCss() {
  if (_cdAppliedStyle) { _cdAppliedStyle.remove(); _cdAppliedStyle = null; }
  const st = document.getElementById('cdCssStatus');
  if (st) { st.textContent = '已清除'; setTimeout(() => st.textContent = '', 1400); }
}

const CD_STORE = 'cdstudio_schemes';
function cdGetSchemes() { try { return JSON.parse(localStorage.getItem(CD_STORE) || '{}'); } catch { return {}; } }
function cdSaveSchemes(o) { localStorage.setItem(CD_STORE, JSON.stringify(o)); }
let _cdSelected = '';
function cdRefreshSelect() {
  xsRenderSelect('cd', cdGetSchemes(), _cdSelected, n => {
    _cdSelected = n;
    const s = cdGetSchemes()[n];
    if (s) { cdApplyValues(s); const cc = document.getElementById('cdCssCode'); if (cc) cc.value = s.customCode || ''; }
    const sn = document.getElementById('cdSchemeName'); if (sn) sn.value = n;
    cdCloseDropdown(); cdSyncColors(); cdSyncSize();
    cdRefreshSelect();
  });
}
function cdToggleDropdown() {
  const w = document.getElementById('cdCustomSelect');
  const a = document.getElementById('cdCsArrow');
  if (!w) return;
  const open = w.classList.toggle('open');
  if (a) a.style.transform = open ? 'rotate(180deg)' : '';
}
function cdCloseDropdown() {
  const w = document.getElementById('cdCustomSelect');
  const a = document.getElementById('cdCsArrow');
  if (w) w.classList.remove('open');
  if (a) a.style.transform = '';
}
function cdOpenSaveModal() {
  const m = document.getElementById('cdSaveModal');
  if (m) m.classList.add('show');
  const i = document.getElementById('cdSmNameInput');
  if (i) { i.value = (document.getElementById('cdSchemeName') || {}).value || ''; i.focus(); }
}
function cdCloseSaveModal() { const m = document.getElementById('cdSaveModal'); if (m) m.classList.remove('show'); }
function cdConfirmSave() {
  const i = document.getElementById('cdSmNameInput');
  const name = (i && i.value || '').trim();
  if (!name) { if (i) i.focus(); return; }
  const all = cdGetSchemes();
  const s = cdCollect(); s.schemeName = name;
  all[name] = s;
  cdSaveSchemes(all);
  _cdSelected = name;
  const sn = document.getElementById('cdSchemeName'); if (sn) sn.value = name;
  cdCloseSaveModal(); cdRefreshSelect();
}
function cdDeleteScheme() {
  if (!_cdSelected) return;
  const all = cdGetSchemes();
  delete all[_cdSelected];
  cdSaveSchemes(all);
  _cdSelected = '';
  const sn = document.getElementById('cdSchemeName'); if (sn) sn.value = '';
  cdRefreshSelect();
}

function cdApplyAll() {
  cdSyncColors(); cdSyncSize();
  xsDispatch('luna_card_style', 'luna_card_style_channel', cdCollect(), _cdScope);
  xsBtnOk('cardStudioPage');
}
function cdExportCSS() {
  const s = cdCollect();
  const css =
`.fp-card { width:${s.w}px; height:${s.h}px; border-radius:${s.radius}px; background:${s.bg}; border:${s.bw}px solid ${s.bd}; }
.fp-card-art { background:${s.art}; }
.fp-card-footer { background:${s.foot}; }
.fp-card-title { color:${s.titleC}; font-size:${s.title}px; }
.fp-card-sub { color:${s.sub}; ${s.subOn ? '' : 'display:none;'} }
.fp-card-tag { color:${s.tag}; }
.fp-card-no { ${s.no ? '' : 'display:none;'} }`;
  if (navigator.clipboard) navigator.clipboard.writeText(css);
  const btn = document.querySelector('#cardStudioPage .is-btn-outline');
  if (btn) { btn.textContent = '已复制!'; setTimeout(() => btn.textContent = '导出 CSS', 1500); }
}


/* ================================================================
   ✦ PANEL STUDIO — 聊天功能板美化
================================================================ */

const PN_LIB = [
  { id:'origin', name:'原初纸感', en:'ORIGIN PAPER', thumb:['#ffffff','#f2f2f2','#1a1a1a'],
    v:{ radius:24,pad:16,grip:38,scrim:45,blur:0,dur:420,ls:1.6,ease:'spring',
        bg:'#ffffff',scrimC:'#000000',gripC:'#dcdcdc',titleC:'#a8a8a8',
        closeC:'#f2f2f2',dot:'#d6d6d6',dotOn:'#1a1a1a',arrow:'#f7f7f7',
        handle:true,head:true,hint:true,detail:true,glass:false,
        title:'Luna · Features', hintTxt:'Swipe to explore' } },

  { id:'azure', name:'湛蓝信笺', en:'AZURE NOTE', thumb:['#0a84ff','#f2f7ff','#ffffff'],
    v:{ radius:34,pad:18,grip:46,scrim:32,blur:12,dur:380,ls:1.0,ease:'smooth',
        bg:'#ffffff',scrimC:'#0a1a2e',gripC:'#cfe0f5',titleC:'#5b86b5',
        closeC:'#eaf3ff',dot:'#cfe0f5',dotOn:'#0a84ff',arrow:'#eaf3ff',
        handle:true,head:true,hint:false,detail:true,glass:true,
        title:'快捷功能', hintTxt:'左右滑动查看' } },

  { id:'ink', name:'墨夜', en:'INK NIGHT', thumb:['#141418','#26262c','#e8e8ee'],
    v:{ radius:26,pad:16,grip:40,scrim:66,blur:6,dur:460,ls:2.2,ease:'spring',
        bg:'#141418',scrimC:'#000000',gripC:'#33333c',titleC:'#7c7c88',
        closeC:'#22222a',dot:'#3a3a44',dotOn:'#e8e8ee',arrow:'#1e1e25',
        handle:true,head:true,hint:true,detail:true,glass:false,
        title:'NIGHT PANEL', hintTxt:'Swipe to explore' } },

  { id:'frost', name:'霜雾玻璃', en:'FROST GLASS', thumb:['#eef1f5','#ffffff','#aab2bd'],
    v:{ radius:30,pad:18,grip:44,scrim:26,blur:18,dur:400,ls:1.4,ease:'smooth',
        bg:'#ffffff',scrimC:'#28303a',gripC:'#dfe3e9',titleC:'#96a0ad',
        closeC:'#f1f3f6',dot:'#dfe3e9',dotOn:'#5c6674',arrow:'#f1f3f6',
        handle:true,head:false,hint:true,detail:true,glass:true,
        title:'FEATURES', hintTxt:'滑动探索' } },

  { id:'mono', name:'极简线稿', en:'MONO LINE', thumb:['#ffffff','#ffffff','#1a1a1a'],
    v:{ radius:0,pad:14,grip:0,scrim:52,blur:0,dur:260,ls:3.0,ease:'smooth',
        bg:'#ffffff',scrimC:'#000000',gripC:'#ffffff',titleC:'#1a1a1a',
        closeC:'#ffffff',dot:'#dddddd',dotOn:'#1a1a1a',arrow:'#ffffff',
        handle:false,head:true,hint:false,detail:false,glass:false,
        title:'FEATURES', hintTxt:'' } },

  { id:'stone', name:'岩灰', en:'STONE GREY', thumb:['#e8e8e6','#d6d6d3','#3a3a38'],
    v:{ radius:20,pad:16,grip:52,scrim:40,blur:0,dur:440,ls:1.2,ease:'spring',
        bg:'#f0f0ee',scrimC:'#1c1c1a',gripC:'#d6d6d2',titleC:'#8b8b84',
        closeC:'#e4e4e1',dot:'#d0d0cc',dotOn:'#3a3a38',arrow:'#e4e4e1',
        handle:true,head:true,hint:true,detail:true,glass:false,
        title:'功能面板', hintTxt:'左右滑动' } },

  { id:'plum', name:'暗梅', en:'DARK PLUM', thumb:['#221a22','#3a2b38','#e6d8e4'],
    v:{ radius:32,pad:18,grip:42,scrim:60,blur:10,dur:500,ls:1.8,ease:'spring',
        bg:'#221a22',scrimC:'#0d060c',gripC:'#3d2d3b',titleC:'#9b8399',
        closeC:'#2c212b',dot:'#3d2d3b',dotOn:'#e6d8e4',arrow:'#2c212b',
        handle:true,head:true,hint:true,detail:true,glass:true,
        title:'PLUM PANEL', hintTxt:'Swipe to explore' } }
];

const PN_DEFAULT = PN_LIB[0].v;
let _pnScope = 'global';
let _pnLib = 'origin';
let _pnEase = 'spring';
const _pnTog = { handle:true, head:true, hint:true, detail:true, blur:false };

function openPanelStudio() {
  const p = document.getElementById('panelStudioPage');
  if (!p) return;
  p.classList.remove('is-closing'); p.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  xsTick('pnTime', 'pnBatPct', 'pnBatInner');
  xsIsland('pnIsland');
  pnRenderLib(); pnLoadScopeStyle(_pnScope); pnRefreshSelect();
  xsFillAll('panelStudioPage'); pnRender();
}
function closePanelStudio() {
  const p = document.getElementById('panelStudioPage');
  if (!p) return;
  p.classList.remove('is-open'); p.classList.add('is-closing');
  document.body.style.overflow = '';
  setTimeout(() => p.classList.remove('is-closing'), 280);
}

function pnRenderLib() {
  const box = document.getElementById('pnLibScroll');
  if (!box) return;
  box.innerHTML = PN_LIB.map(L => `
    <div class="xs-lib-card${L.id === _pnLib ? ' on' : ''}" onclick="pnPickLib('${L.id}')">
      <div class="xs-lib-thumb" style="background:${L.thumb[1]};border:0.5px solid rgba(0,0,0,.08);align-items:center;">
        <div style="width:80%;height:60%;border-radius:8px 8px 0 0;background:${L.thumb[0]};margin-top:auto;position:relative;">
          <div style="position:absolute;top:4px;left:50%;transform:translateX(-50%);width:22px;height:3px;border-radius:2px;background:${L.thumb[2]};opacity:.55"></div>
        </div>
      </div>
      <div class="xs-lib-name">${L.name}</div>
      <div class="xs-lib-en">${L.en}</div>
    </div>`).join('');
}
function pnPickLib(id) {
  const L = PN_LIB.find(x => x.id === id);
  if (!L) return;
  _pnLib = id; pnApplyValues(L.v); pnRenderLib();
  const n = document.getElementById('pnSchemeName'); if (n) n.value = L.name;
  pnRender();
}
function pnApplyValues(v) {
  const set = (id, val) => { const e = document.getElementById(id); if (e) e.value = val; };
  set('pnRRadius', v.radius); set('pnRPad', v.pad); set('pnRGrip', v.grip);
  set('pnRScrim', v.scrim); set('pnRBlur', v.blur); set('pnRDur', v.dur); set('pnRLs', v.ls);
  set('pnCBg', v.bg); set('pnCScrim', v.scrimC); set('pnCGrip', v.gripC); set('pnCTitle', v.titleC);
  set('pnCClose', v.closeC); set('pnCDot', v.dot); set('pnCDotOn', v.dotOn); set('pnCArrow', v.arrow);
  set('pnTitleInput', v.title || ''); set('pnHintInput', v.hintTxt || '');
  _pnTog.handle = v.handle; _pnTog.head = v.head; _pnTog.hint = v.hint;
  _pnTog.detail = v.detail; _pnTog.blur = v.glass;
  ['Handle','Head','Hint','Detail','Blur'].forEach(k => {
    const el = document.getElementById('pnTog' + k);
    if (el) el.classList.toggle('on', !!_pnTog[k.toLowerCase()]);
  });
  pnSetEase(v.ease || 'spring', true);
  xsFillAll('panelStudioPage');
}
function pnV(id) { const e = document.getElementById(id); return e ? e.value : ''; }
function pnN(id) { const e = document.getElementById(id); return e ? parseFloat(e.value) : 0; }
function pnCollect() {
  return {
    radius:pnN('pnRRadius'), pad:pnN('pnRPad'), grip:pnN('pnRGrip'), scrim:pnN('pnRScrim'),
    blur:pnN('pnRBlur'), dur:pnN('pnRDur'), ls:pnN('pnRLs'), ease:_pnEase,
    bg:pnV('pnCBg'), scrimC:pnV('pnCScrim'), gripC:pnV('pnCGrip'), titleC:pnV('pnCTitle'),
    closeC:pnV('pnCClose'), dot:pnV('pnCDot'), dotOn:pnV('pnCDotOn'), arrow:pnV('pnCArrow'),
    handle:_pnTog.handle, head:_pnTog.head, hint:_pnTog.hint, detail:_pnTog.detail, glass:_pnTog.blur,
    title:pnV('pnTitleInput'), hintTxt:pnV('pnHintInput'),
    lib:_pnLib,
    customCode:(document.getElementById('pnCssCode') || {}).value || '',
    schemeName:(document.getElementById('pnSchemeName') || {}).value || '',
    scope:_pnScope, charId:xsCharId(), ts:Date.now()
  };
}
function pnRender() {
  const s = pnCollect();
  const sheet = document.getElementById('pnSheet');
  if (sheet) {
    sheet.style.borderRadius = s.radius + 'px ' + s.radius + 'px 0 0';
    sheet.style.background = s.bg;
    sheet.style.padding = Math.round(s.pad * 0.55) + 'px ' + Math.round(s.pad * 0.8) + 'px ' + s.pad + 'px';
    sheet.style.backdropFilter = s.glass ? 'blur(14px)' : '';
    sheet.style.opacity = s.glass ? '0.94' : '1';
  }
  const shell = document.getElementById('pnShell');
  if (shell) {
    const a = (s.scrim / 100).toFixed(2);
    shell.style.background = `linear-gradient(180deg, rgba(233,233,236,1) 0%, ${pnHexA(s.scrimC, a)} 100%)`;
    shell.style.filter = s.blur > 0 ? '' : '';
  }
  const h = document.getElementById('pnHandle');
  if (h) { h.style.width = s.grip + 'px'; h.style.background = s.gripC; h.style.display = s.handle && s.grip > 0 ? '' : 'none'; }
  const hd = document.querySelector('#pnSheet .xs-panel-hd');
  if (hd) hd.style.display = s.head ? '' : 'none';
  const t = document.getElementById('pnTitleEl');
  if (t) { t.style.color = s.titleC; t.style.letterSpacing = s.ls + 'px'; t.textContent = s.title || 'Luna · Features'; }
  const x = document.getElementById('pnCloseEl');
  if (x) x.style.background = s.closeC;
  const dots = document.querySelectorAll('#pnDots .xs-panel-dot');
  dots.forEach(d => { d.style.background = d.classList.contains('on') ? s.dotOn : s.dot; });
}
function pnHexA(hex, a) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#000000');
  if (!m) return `rgba(0,0,0,${a})`;
  return `rgba(${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)},${a})`;
}
function pnSyncColors() {
  [['pnCBg','pnHBg'],['pnCScrim','pnHScrim'],['pnCGrip','pnHGrip'],['pnCTitle','pnHTitle'],
   ['pnCClose','pnHClose'],['pnCDot','pnHDot'],['pnCDotOn','pnHDotOn'],['pnCArrow','pnHArrow']]
   .forEach(([c,h]) => { const ce=document.getElementById(c), he=document.getElementById(h); if(ce&&he) he.textContent=ce.value; });
  pnRender();
}
function pnSyncSize() {
  [['pnRRadius','pnVRadius','px'],['pnRPad','pnVPad','px'],['pnRGrip','pnVGrip','px'],
   ['pnRScrim','pnVScrim','%'],['pnRBlur','pnVBlur','px'],['pnRDur','pnVDur','ms'],['pnRLs','pnVLs','px']]
   .forEach(([r,v,u]) => { const re=document.getElementById(r), ve=document.getElementById(v);
     if(re&&ve) ve.textContent = re.value + u; xsFill(re); });
  pnRender();
}
function pnSyncText() { pnRender(); }
function pnResetColors() { const d = PN_DEFAULT;
  const m = { pnCBg:d.bg, pnCScrim:d.scrimC, pnCGrip:d.gripC, pnCTitle:d.titleC,
              pnCClose:d.closeC, pnCDot:d.dot, pnCDotOn:d.dotOn, pnCArrow:d.arrow };
  Object.keys(m).forEach(k => { const e=document.getElementById(k); if(e) e.value=m[k]; });
  pnSyncColors();
}
function pnResetSize() { const d = PN_DEFAULT;
  const m = { pnRRadius:d.radius, pnRPad:d.pad, pnRGrip:d.grip, pnRScrim:d.scrim,
              pnRBlur:d.blur, pnRDur:d.dur, pnRLs:d.ls };
  Object.keys(m).forEach(k => { const e=document.getElementById(k); if(e) e.value=m[k]; });
  pnSyncSize();
}
function pnToggle(key) {
  _pnTog[key] = !_pnTog[key];
  const el = document.getElementById('pnTog' + key.charAt(0).toUpperCase() + key.slice(1));
  if (el) el.classList.toggle('on', _pnTog[key]);
  pnRender();
}
function pnSetEase(e, silent) {
  _pnEase = e;
  document.querySelectorAll('#pnEaseRow .is-st-item').forEach(el => {
    el.classList.toggle('active', el.dataset.ease === e);
  });
  if (!silent) pnRender();
}
function pnSetScope(s) {
  _pnScope = s;
  const g=document.getElementById('pnSpGlobal'), c=document.getElementById('pnSpChar');
  if (g) g.classList.toggle('on', s === 'global');
  if (c) c.classList.toggle('on', s === 'char');
  const hint = document.getElementById('pnScopeHint');
  if (hint) hint.textContent = s === 'char'
    ? `仅应用到「${xsCharId() || '当前角色'}」的功能板样式` : '将应用到所有角色的功能板样式';
  pnLoadScopeStyle(s);
}
function pnLoadScopeStyle(s) {
  const charId = xsCharId();
  const key = (s === 'char' && charId) ? 'luna_panel_style_char_' + charId : 'luna_panel_style';
  let raw = localStorage.getItem(key);
  if (!raw && s === 'char') raw = localStorage.getItem('luna_panel_style');
  if (!raw) { pnApplyValues(PN_DEFAULT); pnSyncColors(); pnSyncSize(); return; }
  try {
    const v = JSON.parse(raw);
    pnApplyValues(Object.assign({}, PN_DEFAULT, v, { glass: !!v.glass }));
    _pnLib = v.lib || _pnLib;
    const cc=document.getElementById('pnCssCode'); if(cc) cc.value = v.customCode || '';
    const sn=document.getElementById('pnSchemeName'); if(sn) sn.value = v.schemeName || '';
    pnRenderLib();
  } catch (e) { pnApplyValues(PN_DEFAULT); }
  pnSyncColors(); pnSyncSize();
}
function pnInsertClass(cls) {
  const ta = document.getElementById('pnCssCode'); if (!ta) return;
  ta.value += (ta.value && !ta.value.endsWith('\n') ? '\n' : '') + cls + ' {\n  \n}\n';
  ta.focus();
}
let _pnAppliedStyle = null;
function pnApplyCss() {
  const code = (document.getElementById('pnCssCode') || {}).value || '';
  if (_pnAppliedStyle) _pnAppliedStyle.remove();
  _pnAppliedStyle = document.createElement('style');
  _pnAppliedStyle.textContent = code
    .replace(/\.panel-hd-label/g, '#pnSheet .xs-panel-title')
    .replace(/\.panel-handle/g,   '#pnSheet .xs-panel-handle')
    .replace(/\.feature-panel/g,  '#pnSheet');
  document.head.appendChild(_pnAppliedStyle);
  const st = document.getElementById('pnCssStatus');
  if (st) { st.textContent = '已应用到预览'; setTimeout(() => st.textContent = '', 1600); }
}
function pnClearCss() {
  if (_pnAppliedStyle) { _pnAppliedStyle.remove(); _pnAppliedStyle = null; }
  const st = document.getElementById('pnCssStatus');
  if (st) { st.textContent = '已清除'; setTimeout(() => st.textContent = '', 1400); }
}
const PN_STORE = 'pnstudio_schemes';
function pnGetSchemes() { try { return JSON.parse(localStorage.getItem(PN_STORE) || '{}'); } catch { return {}; } }
function pnSaveSchemes(o) { localStorage.setItem(PN_STORE, JSON.stringify(o)); }
let _pnSelected = '';
function pnRefreshSelect() {
  xsRenderSelect('pn', pnGetSchemes(), _pnSelected, n => {
    _pnSelected = n;
    const s = pnGetSchemes()[n];
    if (s) { pnApplyValues(Object.assign({}, PN_DEFAULT, s)); const cc=document.getElementById('pnCssCode'); if(cc) cc.value=s.customCode||''; }
    const sn=document.getElementById('pnSchemeName'); if(sn) sn.value=n;
    pnCloseDropdown(); pnSyncColors(); pnSyncSize(); pnRefreshSelect();
  });
}
function pnToggleDropdown() {
  const w = document.getElementById('pnCustomSelect');
  const a = document.getElementById('pnCsArrow');
  if (!w) return;
  const open = w.classList.toggle('open');
  if (a) a.style.transform = open ? 'rotate(180deg)' : '';
}
function pnCloseDropdown() {
  const w = document.getElementById('pnCustomSelect');
  const a = document.getElementById('pnCsArrow');
  if (w) w.classList.remove('open');
  if (a) a.style.transform = '';
}
function pnOpenSaveModal() {
  const m=document.getElementById('pnSaveModal'); if(m) m.classList.add('show');
  const i=document.getElementById('pnSmNameInput');
  if (i) { i.value = (document.getElementById('pnSchemeName')||{}).value || ''; i.focus(); }
}
function pnCloseSaveModal() { const m=document.getElementById('pnSaveModal'); if(m) m.classList.remove('show'); }
function pnConfirmSave() {
  const i=document.getElementById('pnSmNameInput');
  const name=(i&&i.value||'').trim(); if(!name){ if(i) i.focus(); return; }
  const all=pnGetSchemes(); const s=pnCollect(); s.schemeName=name; all[name]=s;
  pnSaveSchemes(all); _pnSelected=name;
  const sn=document.getElementById('pnSchemeName'); if(sn) sn.value=name;
  pnCloseSaveModal(); pnRefreshSelect();
}
function pnDeleteScheme() {
  if (!_pnSelected) return;
  const all=pnGetSchemes(); delete all[_pnSelected]; pnSaveSchemes(all);
  _pnSelected=''; const sn=document.getElementById('pnSchemeName'); if(sn) sn.value='';
  pnRefreshSelect();
}
function pnApplyAll() {
  pnSyncColors(); pnSyncSize();
  xsDispatch('luna_panel_style', 'luna_panel_style_channel', pnCollect(), _pnScope);
  xsBtnOk('panelStudioPage');
}
function pnExportCSS() {
  const s = pnCollect();
  const css =
`.feature-panel { background:${s.bg}; border-radius:${s.radius}px ${s.radius}px 0 0; padding-bottom:${s.pad}px; }
.overlay-backdrop { background:${pnHexA(s.scrimC, (s.scrim/100).toFixed(2))}; backdrop-filter:blur(${s.blur}px); }
.panel-handle { width:${s.grip}px; background:${s.gripC}; ${s.handle?'':'display:none;'} }
.panel-hd-label { color:${s.titleC}; letter-spacing:${s.ls}px; }
.panel-close-btn { background:${s.closeC}; }
.fan-dot { background:${s.dot}; }
.fan-dot.active { background:${s.dotOn}; }
.fan-btn { background:${s.arrow}; }`;
  if (navigator.clipboard) navigator.clipboard.writeText(css);
  const btn = document.querySelector('#panelStudioPage .is-btn-outline');
  if (btn) { btn.textContent = '已复制!'; setTimeout(() => btn.textContent = '导出 CSS', 1500); }
}


/* ================================================================
   ✦ CUSTOM STUDIO — 自定义美化（整页聚合）
   一套主题同时下发到 header / bubble / input / card / panel 五个模块
================================================================ */

const CU_LIB = [
  { id:'origin', name:'原初纸感', en:'ORIGIN PAPER', thumb:['#ffffff','#f7f7f8','#1a1a1a'],
    v:{ canvas:'#f7f7f8', header:'#fbfbfb', luna:'#ffffff', lunaTx:'#2a2a2a',
        mine:'#1a1a1a', mineTx:'#f4f4f4', inputArea:'#f2f2f3', inputBox:'#ffffff',
        send:'#1a1a1a', name:'#1a1a1a', sub:'#a5a5a5', panel:'#ffffff',
        bubR:18, tail:5, fs:14, pad:10, gap:12, btnR:50, avR:50,
        tex:'none', lunaAv:true, mineAv:false, time:true, stats:true, divider:true, blur:false } },

  /* 仿蓝色气泡短信风格（非官方命名） */
  { id:'azure', name:'湛蓝信笺', en:'AZURE NOTE', thumb:['#0a84ff','#e9e9eb','#ffffff'],
    v:{ canvas:'#ffffff', header:'#f7f7f9', luna:'#e9e9eb', lunaTx:'#101014',
        mine:'#0a84ff', mineTx:'#ffffff', inputArea:'#ffffff', inputBox:'#ffffff',
        send:'#0a84ff', name:'#101014', sub:'#8e8e93', panel:'#ffffff',
        bubR:19, tail:5, fs:15, pad:9, gap:6, btnR:50, avR:50,
        tex:'none', lunaAv:false, mineAv:false, time:false, stats:false, divider:false, blur:true } },

  { id:'ink', name:'墨夜', en:'INK NIGHT', thumb:['#0f0f13','#1b1b22','#e8e8ee'],
    v:{ canvas:'#0f0f13', header:'#14141a', luna:'#1e1e26', lunaTx:'#e6e6ee',
        mine:'#e8e8ee', mineTx:'#141418', inputArea:'#14141a', inputBox:'#1e1e26',
        send:'#e8e8ee', name:'#f0f0f4', sub:'#7c7c88', panel:'#141418',
        bubR:16, tail:4, fs:14, pad:11, gap:12, btnR:50, avR:50,
        tex:'glow', lunaAv:true, mineAv:true, time:true, stats:true, divider:true, blur:false } },

  { id:'frost', name:'霜雾玻璃', en:'FROST GLASS', thumb:['#eef1f5','#ffffff','#8a92a0'],
    v:{ canvas:'#eef1f5', header:'#f7f9fb', luna:'#ffffff', lunaTx:'#2b3038',
        mine:'#5c6674', mineTx:'#ffffff', inputArea:'#f2f5f8', inputBox:'#ffffff',
        send:'#5c6674', name:'#2b3038', sub:'#a9b0ba', panel:'#ffffff',
        bubR:22, tail:8, fs:14, pad:11, gap:14, btnR:50, avR:50,
        tex:'dot', lunaAv:true, mineAv:false, time:true, stats:false, divider:false, blur:true } },

  { id:'mono', name:'极简线稿', en:'MONO LINE', thumb:['#ffffff','#ffffff','#1a1a1a'],
    v:{ canvas:'#ffffff', header:'#ffffff', luna:'#ffffff', lunaTx:'#1a1a1a',
        mine:'#ffffff', mineTx:'#1a1a1a', inputArea:'#ffffff', inputBox:'#ffffff',
        send:'#1a1a1a', name:'#1a1a1a', sub:'#999999', panel:'#ffffff',
        bubR:2, tail:2, fs:13, pad:10, gap:16, btnR:4, avR:4,
        tex:'grid', lunaAv:false, mineAv:false, time:true, stats:false, divider:true, blur:false } },

  { id:'stone', name:'岩灰', en:'STONE GREY', thumb:['#eeeeec','#ffffff','#3a3a38'],
    v:{ canvas:'#eeeeec', header:'#f6f6f4', luna:'#ffffff', lunaTx:'#2e2e2c',
        mine:'#3a3a38', mineTx:'#f4f4f2', inputArea:'#e8e8e5', inputBox:'#ffffff',
        send:'#3a3a38', name:'#2e2e2c', sub:'#90908a', panel:'#f6f6f4',
        bubR:14, tail:6, fs:14, pad:10, gap:11, btnR:14, avR:14,
        tex:'none', lunaAv:true, mineAv:true, time:true, stats:true, divider:true, blur:false } },

  { id:'plum', name:'暗梅', en:'DARK PLUM', thumb:['#1c141c','#2c212b','#e6d8e4'],
    v:{ canvas:'#1c141c', header:'#221a22', luna:'#2c212b', lunaTx:'#f0e6ef',
        mine:'#c9a9c4', mineTx:'#1c141c', inputArea:'#221a22', inputBox:'#2c212b',
        send:'#c9a9c4', name:'#f0e6ef', sub:'#9b8399', panel:'#221a22',
        bubR:20, tail:6, fs:14, pad:11, gap:13, btnR:50, avR:50,
        tex:'glow', lunaAv:true, mineAv:false, time:true, stats:true, divider:true, blur:true } },

  { id:'sand', name:'晨雾灰白', en:'MORNING HAZE', thumb:['#f4f4f6','#ffffff','#6f7480'],
    v:{ canvas:'#f4f4f6', header:'#fafafb', luna:'#ffffff', lunaTx:'#33373f',
        mine:'#6f7480', mineTx:'#ffffff', inputArea:'#f0f0f3', inputBox:'#ffffff',
        send:'#6f7480', name:'#23262c', sub:'#9ea3ad', panel:'#ffffff',
        bubR:24, tail:10, fs:14, pad:11, gap:13, btnR:50, avR:50,
        tex:'glow', lunaAv:true, mineAv:false, time:true, stats:true, divider:false, blur:false } }
];

const CU_DEFAULT = CU_LIB[0].v;
let _cuScope = 'global';
let _cuLib = 'origin';
let _cuTex = 'none';
const _cuTog = { lunaAv:true, mineAv:false, time:true, stats:true, divider:true, blur:false };
const _cuMods = { header:true, bubble:true, input:true, card:true, panel:true, page:true };

function openCustomStudio() {
  const p = document.getElementById('customStudioPage');
  if (!p) return;
  p.classList.remove('is-closing'); p.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  xsTick('cuTime', 'cuBatPct', 'cuBatInner');
  xsIsland('cuIsland');
  cuRenderLib(); cuLoadScopeStyle(_cuScope); cuRefreshSelect();
  cuSyncFromChatroom();
  xsFillAll('customStudioPage'); cuRender();
}
function closeCustomStudio() {
  const p = document.getElementById('customStudioPage');
  if (!p) return;
  p.classList.remove('is-open'); p.classList.add('is-closing');
  document.body.style.overflow = '';
  setTimeout(() => p.classList.remove('is-closing'), 280);
}

/* 初始预览 1:1 同步 chatroom 现状：
   读取当前已保存的 header/bubble/input 三个模块样式与角色资料，
   把预览机身填成聊天页此刻真正长的样子，而不是一个空壳 demo */
function cuSyncFromChatroom() {
  const charId = xsCharId();
  const pick = (base) => {
    const c = charId ? localStorage.getItem(base + '_char_' + charId) : null;
    const raw = c || localStorage.getItem(base);
    try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  };
  const H = pick('luna_header_style');
  const B = pick('luna_bubble_style');
  const I = pick('luna_input_style');

  const set = (id, v) => { if (v) { const e = document.getElementById(id); if (e) e.value = v; } };
  if (H) {
    set('cuCHeader', H.bg && H.bg.startsWith('#') ? H.bg : null);
    set('cuCName',   H.nameColor);
    set('cuCSub',    H.sub);
  }
  if (B) {
    set('cuCLuna',   B.lunaBg);
    set('cuCLunaTx', B.lunaTx);
    set('cuCMine',   B.mineBg);
    set('cuCMineTx', B.mineTx);
    if (B.lunaFs)  { const e=document.getElementById('cuRFs');  if(e) e.value = B.lunaFs; }
    if (B.lunaPad !== undefined) { const e=document.getElementById('cuRPad'); if(e) e.value = B.lunaPad; }
    if (B.gap !== undefined)     { const e=document.getElementById('cuRGap'); if(e) e.value = B.gap; }
    if (B.lunaAvShow !== undefined) _cuTog.lunaAv = B.lunaAvShow !== false;
    if (B.mineAvShow !== undefined) _cuTog.mineAv = B.mineAvShow === true;
  }
  if (I) {
    set('cuCInputArea', I.areaBg);
    set('cuCInputBox',  I.inputBg);
    set('cuCSend',      I.sendBg);
    if (I.radius !== undefined) { const e=document.getElementById('cuRBtnR'); if(e) e.value = I.radius; }
    if (I.toggleDivider !== undefined) _cuTog.divider = !!I.toggleDivider;
  }
  ['LunaAv','MineAv','Time','Stats','Divider','Blur'].forEach(k => {
    const key = k.charAt(0).toLowerCase() + k.slice(1);
    const el = document.getElementById('cuTog' + k);
    if (el) el.classList.toggle('on', !!_cuTog[key]);
  });

  /* 角色名 / 头像 / 副标题：直接读当前聊天角色 */
  const nm = localStorage.getItem('luna_current_chat') || 'Luna';
  const nameEl = document.getElementById('cuPhName');
  if (nameEl) nameEl.textContent = nm;
  const avEl = document.getElementById('cuPhAv');
  if (avEl) avEl.textContent = (nm[0] || 'L').toUpperCase();
  const fieldEl = document.getElementById('cuPhField');
  if (fieldEl) fieldEl.textContent = '向 ' + nm + ' 发送消息';
  try {
    const probe = indexedDB.open('LunaCharDB');
    probe.onsuccess = ev => {
      const db = ev.target.result;
      if (!db.objectStoreNames.contains('chars')) return;
      const r = db.transaction('chars').objectStore('chars').getAll();
      r.onsuccess = () => {
        const f = (r.result || []).find(c => c.name === nm);
        if (!f) return;
        if (f.role) { const s = document.getElementById('cuPhSub'); if (s) s.textContent = f.role; }
        if (f.avatar && avEl) {
          avEl.innerHTML = `<img src="${f.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;">`;
          avEl.style.padding = '0'; avEl.style.overflow = 'hidden';
          ['cuPhMav1','cuPhMav2'].forEach(id => {
            const m = document.getElementById(id);
            if (m) { m.style.background = `url(${f.avatar}) center/cover no-repeat`; }
          });
        }
      };
    };
  } catch (e) {}
  xsFillAll('customStudioPage');
  cuSyncColors(); cuSyncSize();
}

function cuRenderLib() {
  const box = document.getElementById('cuLibScroll');
  if (!box) return;
  box.innerHTML = CU_LIB.map(L => `
    <div class="xs-lib-card${L.id === _cuLib ? ' on' : ''}" onclick="cuPickLib('${L.id}')">
      <div class="xs-lib-thumb" style="background:${L.v.canvas};border:0.5px solid rgba(0,0,0,.08);">
        <div class="xs-lib-bar" style="background:${L.v.luna};width:62%;border:0.5px solid rgba(0,0,0,.05)"></div>
        <div class="xs-lib-bar" style="background:${L.v.mine};width:46%;margin-left:auto"></div>
        <div class="xs-lib-bar" style="background:${L.v.inputBox};width:100%;height:5px;border:0.5px solid rgba(0,0,0,.05)"></div>
      </div>
      <div class="xs-lib-name">${L.name}</div>
      <div class="xs-lib-en">${L.en}</div>
    </div>`).join('');
}
function cuPickLib(id) {
  const L = CU_LIB.find(x => x.id === id);
  if (!L) return;
  _cuLib = id; cuApplyValues(L.v); cuRenderLib();
  const n = document.getElementById('cuSchemeName'); if (n) n.value = L.name;
  cuRender();
}
function cuApplyValues(v) {
  const set = (id, val) => { const e = document.getElementById(id); if (e && val !== undefined) e.value = val; };
  set('cuCCanvas',v.canvas); set('cuCHeader',v.header); set('cuCLuna',v.luna); set('cuCLunaTx',v.lunaTx);
  set('cuCMine',v.mine); set('cuCMineTx',v.mineTx); set('cuCInputArea',v.inputArea);
  set('cuCInputBox',v.inputBox); set('cuCSend',v.send); set('cuCName',v.name);
  set('cuCSub',v.sub); set('cuCPanel',v.panel);
  set('cuRBubR',v.bubR); set('cuRTail',v.tail); set('cuRFs',v.fs); set('cuRPad',v.pad);
  set('cuRGap',v.gap); set('cuRBtnR',v.btnR); set('cuRAvR',v.avR);
  _cuTog.lunaAv=v.lunaAv; _cuTog.mineAv=v.mineAv; _cuTog.time=v.time;
  _cuTog.stats=v.stats; _cuTog.divider=v.divider; _cuTog.blur=v.blur;
  ['LunaAv','MineAv','Time','Stats','Divider','Blur'].forEach(k => {
    const key = k.charAt(0).toLowerCase() + k.slice(1);
    const el = document.getElementById('cuTog' + k);
    if (el) el.classList.toggle('on', !!_cuTog[key]);
  });
  cuSetTex(v.tex || 'none', true);
  xsFillAll('customStudioPage');
}
function cuV(id) { const e=document.getElementById(id); return e ? e.value : ''; }
function cuN(id) { const e=document.getElementById(id); return e ? parseFloat(e.value) : 0; }
function cuCollect() {
  return {
    canvas:cuV('cuCCanvas'), header:cuV('cuCHeader'), luna:cuV('cuCLuna'), lunaTx:cuV('cuCLunaTx'),
    mine:cuV('cuCMine'), mineTx:cuV('cuCMineTx'), inputArea:cuV('cuCInputArea'),
    inputBox:cuV('cuCInputBox'), send:cuV('cuCSend'), name:cuV('cuCName'),
    sub:cuV('cuCSub'), panel:cuV('cuCPanel'),
    bubR:cuN('cuRBubR'), tail:cuN('cuRTail'), fs:cuN('cuRFs'), pad:cuN('cuRPad'),
    gap:cuN('cuRGap'), btnR:cuN('cuRBtnR'), avR:cuN('cuRAvR'),
    tex:_cuTex,
    lunaAv:_cuTog.lunaAv, mineAv:_cuTog.mineAv, time:_cuTog.time,
    stats:_cuTog.stats, divider:_cuTog.divider, blur:_cuTog.blur,
    mods:Object.assign({}, _cuMods),
    lib:_cuLib,
    customCode:(document.getElementById('cuCssCode')||{}).value || '',
    schemeName:(document.getElementById('cuSchemeName')||{}).value || '',
    scope:_cuScope, charId:xsCharId(), ts:Date.now()
  };
}
function cuTexCss(tex, canvas) {
  if (tex === 'grid') return `repeating-linear-gradient(0deg,rgba(0,0,0,.045) 0 1px,transparent 1px 22px),repeating-linear-gradient(90deg,rgba(0,0,0,.045) 0 1px,transparent 1px 22px),${canvas}`;
  if (tex === 'dot')  return `radial-gradient(rgba(0,0,0,.075) 1px,transparent 1.1px) 0 0/16px 16px,${canvas}`;
  if (tex === 'glow') return `radial-gradient(120% 70% at 50% 0%,rgba(255,255,255,.55),transparent 62%),${canvas}`;
  return canvas;
}
function cuRender() {
  const s = cuCollect();
  const q = id => document.getElementById(id);
  const body = q('cuPhBody');
  if (body) { body.style.background = cuTexCss(s.tex, s.canvas); body.style.gap = Math.max(2, s.gap * 0.6) + 'px'; }
  const ph = q('cuPhone'); if (ph) ph.style.background = s.canvas;
  const hd = q('cuPhHeader');
  if (hd) { hd.style.background = s.header; hd.style.backdropFilter = s.blur ? 'blur(12px)' : ''; }
  const st = q('cuPhStatus'); if (st) st.style.background = s.header;
  const nm = q('cuPhName'); if (nm) nm.style.color = s.name;
  const sb = q('cuPhSub');  if (sb) sb.style.color = s.sub;
  const pill = q('cuPhPill'); if (pill) { pill.style.color = s.sub; pill.style.display = s.stats ? '' : 'none'; }
  const av = q('cuPhAv');
  if (av) av.style.borderRadius = s.avR >= 50 ? '50%' : s.avR + 'px';

  ['cuPhBubL1','cuPhBubL2'].forEach(id => {
    const e = q(id); if (!e) return;
    e.style.background = s.luna; e.style.color = s.lunaTx;
    e.style.borderRadius = `${s.bubR*0.72}px ${s.bubR*0.72}px ${s.bubR*0.72}px ${s.tail*0.72}px`;
    e.style.fontSize = (s.fs * 0.75) + 'px';
    e.style.padding = (s.pad*0.62) + 'px ' + (s.pad*0.9) + 'px';
  });
  ['cuPhBubM1','cuPhBubM2'].forEach(id => {
    const e = q(id); if (!e) return;
    e.style.background = s.mine; e.style.color = s.mineTx;
    e.style.borderRadius = `${s.bubR*0.72}px ${s.bubR*0.72}px ${s.tail*0.72}px ${s.bubR*0.72}px`;
    e.style.fontSize = (s.fs * 0.75) + 'px';
    e.style.padding = (s.pad*0.62) + 'px ' + (s.pad*0.9) + 'px';
  });
  ['cuPhMav1','cuPhMav2'].forEach(id => {
    const e = q(id); if (!e) return;
    e.style.display = s.lunaAv ? '' : 'none';
    e.style.borderRadius = s.avR >= 50 ? '50%' : (s.avR*0.5) + 'px';
  });
  document.querySelectorAll('#cuPhBody .xs-ph-time').forEach(e => { e.style.display = s.time ? '' : 'none'; });

  const inp = q('cuPhInput');
  if (inp) { inp.style.background = s.inputArea; inp.style.backdropFilter = s.blur ? 'blur(12px)' : ''; }
  const fld = q('cuPhField');
  if (fld) { fld.style.background = s.inputBox; fld.style.borderRadius = Math.min(14, s.btnR*0.35) + 'px'; }
  ['cuPhAdd','cuPhAi'].forEach(id => {
    const e=q(id); if(e){ e.style.background = s.inputBox; e.style.borderRadius = s.btnR >= 50 ? '50%' : (s.btnR*0.5)+'px'; }
  });
  const sd = q('cuPhSend');
  if (sd) { sd.style.background = s.send; sd.style.borderRadius = s.btnR >= 50 ? '50%' : (s.btnR*0.5)+'px'; }
}
function cuSyncColors() {
  [['cuCCanvas','cuHCanvas'],['cuCHeader','cuHHeader'],['cuCLuna','cuHLuna'],['cuCLunaTx','cuHLunaTx'],
   ['cuCMine','cuHMine'],['cuCMineTx','cuHMineTx'],['cuCInputArea','cuHInputArea'],['cuCInputBox','cuHInputBox'],
   ['cuCSend','cuHSend'],['cuCName','cuHName'],['cuCSub','cuHSub'],['cuCPanel','cuHPanel']]
   .forEach(([c,h])=>{ const ce=document.getElementById(c), he=document.getElementById(h); if(ce&&he) he.textContent=ce.value; });
  cuRender();
}
function cuSyncSize() {
  [['cuRBubR','cuVBubR','px'],['cuRTail','cuVTail','px'],['cuRFs','cuVFs','px'],['cuRPad','cuVPad','px'],
   ['cuRGap','cuVGap','px'],['cuRBtnR','cuVBtnR',''],['cuRAvR','cuVAvR','']]
   .forEach(([r,v,u])=>{ const re=document.getElementById(r), ve=document.getElementById(v);
     if(re&&ve){ const n=parseFloat(re.value);
       ve.textContent = (r==='cuRBtnR'||r==='cuRAvR') ? (n>=50?'50%':n+'px') : n+u; }
     xsFill(re); });
  cuRender();
}
function cuSyncZoom() {
  const r = document.getElementById('cuRZoom');
  const v = document.getElementById('cuVZoom');
  const p = document.getElementById('cuPhone');
  if (!r) return;
  if (v) v.textContent = r.value + '%';
  if (p) p.style.transform = 'scale(' + (parseInt(r.value)/100) + ')';
  xsFill(r);
}
function cuResetColors() { cuApplyValues(CU_DEFAULT); cuSyncColors(); cuSyncSize(); }
function cuResetSize()   { cuApplyValues(CU_DEFAULT); cuSyncColors(); cuSyncSize(); }
function cuToggle(key) {
  _cuTog[key] = !_cuTog[key];
  const el = document.getElementById('cuTog' + key.charAt(0).toUpperCase() + key.slice(1));
  if (el) el.classList.toggle('on', _cuTog[key]);
  cuRender();
}
function cuToggleMod(mod) {
  _cuMods[mod] = !_cuMods[mod];
  const el = document.querySelector('#cuModGrid .xs-mod[data-mod="' + mod + '"]');
  if (el) el.classList.toggle('on', _cuMods[mod]);
}
function cuSetTex(t, silent) {
  _cuTex = t;
  document.querySelectorAll('#cuTexRow .is-st-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tex === t);
  });
  if (!silent) cuRender();
}
function cuSetScope(s) {
  _cuScope = s;
  const g=document.getElementById('cuSpGlobal'), c=document.getElementById('cuSpChar');
  if (g) g.classList.toggle('on', s === 'global');
  if (c) c.classList.toggle('on', s === 'char');
  const hint=document.getElementById('cuScopeHint');
  if (hint) hint.textContent = s === 'char'
    ? `仅应用到「${xsCharId() || '当前角色'}」的整页样式` : '将应用到所有角色的整页样式';
  cuLoadScopeStyle(s);
}
function cuLoadScopeStyle(s) {
  const charId = xsCharId();
  const key = (s === 'char' && charId) ? 'luna_custom_style_char_' + charId : 'luna_custom_style';
  let raw = localStorage.getItem(key);
  if (!raw && s === 'char') raw = localStorage.getItem('luna_custom_style');
  if (!raw) { cuApplyValues(CU_DEFAULT); cuSyncColors(); cuSyncSize(); return; }
  try {
    const v = JSON.parse(raw);
    cuApplyValues(Object.assign({}, CU_DEFAULT, v));
    _cuLib = v.lib || _cuLib;
    if (v.mods) Object.keys(_cuMods).forEach(k => {
      _cuMods[k] = v.mods[k] !== false;
      const el = document.querySelector('#cuModGrid .xs-mod[data-mod="' + k + '"]');
      if (el) el.classList.toggle('on', _cuMods[k]);
    });
    const cc=document.getElementById('cuCssCode'); if(cc) cc.value = v.customCode || localStorage.getItem('luna_custom_css') || '';
    const sn=document.getElementById('cuSchemeName'); if(sn) sn.value = v.schemeName || '';
    cuRenderLib();
  } catch (e) { cuApplyValues(CU_DEFAULT); }
  cuSyncColors(); cuSyncSize();
}
function cuInsertClass(cls) {
  const ta = document.getElementById('cuCssCode'); if (!ta) return;
  ta.value += (ta.value && !ta.value.endsWith('\n') ? '\n' : '') + cls + ' {\n  \n}\n';
  ta.focus();
}
let _cuAppliedStyle = null;
function cuApplyCss() {
  const code = (document.getElementById('cuCssCode')||{}).value || '';
  if (_cuAppliedStyle) _cuAppliedStyle.remove();
  _cuAppliedStyle = document.createElement('style');
  _cuAppliedStyle.textContent = code
    .replace(/\.cr-luna-bubble/g, '#cuPhBody .xs-ph-row:not(.mine) .xs-ph-bub')
    .replace(/\.cr-mine-bubble/g, '#cuPhBody .xs-ph-row.mine .xs-ph-bub')
    .replace(/\.cr-messages-outer/g, '#cuPhBody')
    .replace(/\.cr-input-area/g, '#cuPhInput')
    .replace(/\.cr-send-btn/g, '#cuPhSend')
    .replace(/\.cr-header/g, '#cuPhHeader')
    .replace(/\.cr-name/g, '#cuPhName')
    .replace(/\.cr-sub/g, '#cuPhSub')
    .replace(/\.cr-frame/g, '#cuPhone');
  document.head.appendChild(_cuAppliedStyle);
  const st=document.getElementById('cuCssStatus');
  if (st) { st.textContent='已应用到预览'; setTimeout(()=>st.textContent='',1600); }
}
function cuClearCss() {
  if (_cuAppliedStyle) { _cuAppliedStyle.remove(); _cuAppliedStyle=null; }
  const st=document.getElementById('cuCssStatus');
  if (st) { st.textContent='已清除'; setTimeout(()=>st.textContent='',1400); }
}
const CU_STORE = 'custudio_schemes';
function cuGetSchemes() { try { return JSON.parse(localStorage.getItem(CU_STORE) || '{}'); } catch { return {}; } }
function cuSaveSchemes(o) { localStorage.setItem(CU_STORE, JSON.stringify(o)); }
let _cuSelected = '';
function cuRefreshSelect() {
  xsRenderSelect('cu', cuGetSchemes(), _cuSelected, n => {
    _cuSelected = n;
    const s = cuGetSchemes()[n];
    if (s) { cuApplyValues(Object.assign({}, CU_DEFAULT, s)); const cc=document.getElementById('cuCssCode'); if(cc) cc.value=s.customCode||''; }
    const sn=document.getElementById('cuSchemeName'); if(sn) sn.value=n;
    cuCloseDropdown(); cuSyncColors(); cuSyncSize(); cuRefreshSelect();
  });
}
function cuToggleDropdown() {
  const w = document.getElementById('cuCustomSelect');
  const a = document.getElementById('cuCsArrow');
  if (!w) return;
  const open = w.classList.toggle('open');
  if (a) a.style.transform = open ? 'rotate(180deg)' : '';
}
function cuCloseDropdown() {
  const w = document.getElementById('cuCustomSelect');
  const a = document.getElementById('cuCsArrow');
  if (w) w.classList.remove('open');
  if (a) a.style.transform = '';
}
function cuOpenSaveModal() {
  const m=document.getElementById('cuSaveModal'); if(m) m.classList.add('show');
  const i=document.getElementById('cuSmNameInput');
  if(i){ i.value=(document.getElementById('cuSchemeName')||{}).value||''; i.focus(); }
}
function cuCloseSaveModal(){ const m=document.getElementById('cuSaveModal'); if(m) m.classList.remove('show'); }
function cuConfirmSave() {
  const i=document.getElementById('cuSmNameInput');
  const name=(i&&i.value||'').trim(); if(!name){ if(i) i.focus(); return; }
  const all=cuGetSchemes(); const s=cuCollect(); s.schemeName=name; all[name]=s;
  cuSaveSchemes(all); _cuSelected=name;
  const sn=document.getElementById('cuSchemeName'); if(sn) sn.value=name;
  cuCloseSaveModal(); cuRefreshSelect();
}
function cuDeleteScheme() {
  if (!_cuSelected) return;
  const all=cuGetSchemes(); delete all[_cuSelected]; cuSaveSchemes(all);
  _cuSelected=''; const sn=document.getElementById('cuSchemeName'); if(sn) sn.value='';
  cuRefreshSelect();
}

/* ── 核心：把整套主题拆解并下发到五个独立模块 ── */
function cuApplyAll() {
  cuSyncColors(); cuSyncSize();
  const s = cuCollect();
  const scope = _cuScope;

  /* 1. 整页聚合数据本身 */
  xsDispatch('luna_custom_style', 'luna_custom_style_channel', s, scope);

  /* 2. 全局 CSS 注入（供 chatroom 直接塞进 <head>） */
  localStorage.setItem('luna_custom_css', s.customCode || '');

  /* 3. 头部模块 */
  if (s.mods.header) {
    const H = {
      bg: s.header, nameColor: s.name, sub: s.sub,
      statsShow: s.stats, blur: s.blur,
      schemeName: s.schemeName, scope: scope, charId: xsCharId(), ts: Date.now(),
      customCode: s.stats ? '' : '.cr-stats{display:none !important;}'
    };
    xsDispatch('luna_header_style', 'luna_header_style_channel', H, scope);
  }

  /* 4. 气泡模块 */
  if (s.mods.bubble) {
    const B = {
      lunaBg:s.luna, lunaTx:s.lunaTx, lunaBd:s.luna,
      mineBg:s.mine, mineTx:s.mineTx, mineBd:s.mine,
      lunaPad:s.pad, minePad:s.pad, lunaFs:s.fs, mineFs:s.fs,
      lunaShape:`${s.bubR}px ${s.bubR}px ${s.bubR}px ${s.tail}px`,
      mineShape:`${s.bubR}px ${s.bubR}px ${s.tail}px ${s.bubR}px`,
      gap:s.gap,
      lunaAvShow:s.lunaAv, mineAvShow:s.mineAv,
      lunaTimeShow:s.time, mineTimeShow:s.time,
      schemeName:s.schemeName, scope:scope, charId:xsCharId(), ts:Date.now(),
      customCode:
        `.cr-mini-av,.cr-mine-av{border-radius:${s.avR>=50?'50%':s.avR+'px'} !important;}`
    };
    xsDispatch('luna_bubble_style', 'luna_bubble_style_channel', B, scope);
  }

  /* 5. 输入模块 */
  if (s.mods.input) {
    const I = {
      inputBg:s.inputBox, areaBg:s.inputArea,
      addBtn:s.inputBox, aiBg:s.inputBox, sendBg:s.send,
      placeholder:s.sub,
      radius:s.btnR, shape:s.btnR>=50?'circle':'square',
      toggleDivider:s.divider, toggleAddDot:true, toggleBlur:s.blur,
      schemeName:s.schemeName, scope:scope, charId:xsCharId(), ts:Date.now(),
      customCode: s.divider ? '' : '.cr-const-div{display:none !important;}'
    };
    xsDispatch('luna_input_style', 'luna_input_style_channel', I, scope);
  }

  /* 6. 功能卡片模块（用主题色推导） */
  if (s.mods.card) {
    const C = {
      w:160,h:220,radius:Math.max(4,s.bubR),iconR:Math.max(2,Math.round(s.bubR*0.62)),
      title:13,gap:10,shadow:18,bw:0.5,
      bg:s.panel, bd:s.luna, art:s.canvas, icon:s.name,
      titleC:s.name, sub:s.sub, tag:s.sub, foot:s.panel,
      no:true, subOn:true, rule:true, glow:s.blur, blur:s.blur,
      lib:_cuLib, customCode:'', schemeName:s.schemeName,
      scope:scope, charId:xsCharId(), ts:Date.now()
    };
    xsDispatch('luna_card_style', 'luna_card_style_channel', C, scope);
  }

  /* 7. 功能板模块 */
  if (s.mods.panel) {
    const P = {
      radius:Math.max(8, s.bubR + 6), pad:16, grip:38, scrim:45, blur:s.blur?12:0,
      dur:420, ls:1.6, ease:'spring',
      bg:s.panel, scrimC:'#000000', gripC:s.sub, titleC:s.sub,
      closeC:s.canvas, dot:s.canvas, dotOn:s.name, arrow:s.canvas,
      handle:true, head:true, hint:true, detail:true, glass:s.blur,
      title:'', hintTxt:'',
      lib:_cuLib, customCode:'', schemeName:s.schemeName,
      scope:scope, charId:xsCharId(), ts:Date.now()
    };
    xsDispatch('luna_panel_style', 'luna_panel_style_channel', P, scope);
  }

  xsBtnOk('customStudioPage');
}

function cuExportCSS() {
  const s = cuCollect();
  const css =
`/* ${s.schemeName || '未命名主题'} — 由「自定义美化」导出 */
.cr-frame { background:${s.canvas}; }
.cr-messages-outer { background:${cuTexCss(s.tex, s.canvas)}; gap:${s.gap}px; }
.cr-header { background:${s.header}; }
.cr-name { color:${s.name}; }
.cr-sub  { color:${s.sub}; }
.cr-luna-bubble { background:${s.luna}; color:${s.lunaTx}; font-size:${s.fs}px; padding:${s.pad}px ${s.pad+3}px; border-radius:${s.bubR}px ${s.bubR}px ${s.bubR}px ${s.tail}px; }
.cr-mine-bubble { background:${s.mine}; color:${s.mineTx}; font-size:${s.fs}px; padding:${s.pad}px ${s.pad+3}px; border-radius:${s.bubR}px ${s.bubR}px ${s.tail}px ${s.bubR}px; }
.cr-input-area { background:${s.inputArea}; }
.cr-input-box  { background:${s.inputBox}; }
.cr-send-btn   { background:${s.send}; border-radius:${s.btnR>=50?'50%':s.btnR+'px'}; }
.cr-mini-av, .cr-mine-av { border-radius:${s.avR>=50?'50%':s.avR+'px'}; }
.feature-panel { background:${s.panel}; }
${s.stats   ? '' : '.cr-stats { display:none; }'}
${s.divider ? '' : '.cr-const-div { display:none; }'}
${s.time    ? '' : '.cr-msg-time, .cr-mine-time { visibility:hidden; }'}
${s.customCode || ''}`;
  if (navigator.clipboard) navigator.clipboard.writeText(css);
  const btn = document.querySelector('#customStudioPage .is-btn-outline');
  if (btn) { btn.textContent = '已复制!'; setTimeout(() => btn.textContent = '导出 CSS', 1500); }
}

/* 清空全部美化数据 */
function cuResetAllBeauty() {
  if (!confirm('确定要清空全部美化数据吗？\n\n将移除：头部 / 气泡 / 输入 / 功能卡片 / 功能板 / 自定义 六个模块的全局与角色专属样式。\n此操作不可撤销。')) return;
  const bases = ['luna_header_style','luna_bubble_style','luna_input_style',
                 'luna_card_style','luna_panel_style','luna_custom_style'];
  const kill = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (bases.some(b => k === b || k.startsWith(b + '_char_'))) kill.push(k);
  }
  kill.push('luna_custom_css', 'luna_bubble_css');
  kill.forEach(k => localStorage.removeItem(k));
  bases.forEach(b => {
    const ch = b + '_channel';
    try { const bc = new BroadcastChannel(ch); bc.postMessage({ key:b, value:null, reset:true }); bc.close(); } catch(e){}
    try { window.dispatchEvent(new StorageEvent('storage', { key:b, newValue:null, storageArea:localStorage })); } catch(e){}
  });
  cuApplyValues(CU_DEFAULT); cuSyncColors(); cuSyncSize();
  const st = document.getElementById('cuResetStatus');
  if (st) { st.textContent = '已清空 ' + kill.length + ' 项'; setTimeout(() => st.textContent = '', 2600); }
}

/* ── 三个新页面的公共初始化 ── */
document.addEventListener('DOMContentLoaded', function () {
  cdRenderLib(); pnRenderLib(); cuRenderLib();
  cdRefreshSelect(); pnRefreshSelect(); cuRefreshSelect();
  setInterval(() => {
    xsTick('cdTime','cdBatPct','cdBatInner');
    xsTick('pnTime','pnBatPct','pnBatInner');
    xsTick('cuTime','cuBatPct','cuBatInner');
    const t = document.getElementById('cuPhTime');
    const src = document.getElementById('cuTime');
    if (t && src) t.textContent = src.textContent;
  }, 1000);
  xsTick('cdTime','cdBatPct','cdBatInner');
  xsTick('pnTime','pnBatPct','pnBatInner');
  xsTick('cuTime','cuBatPct','cuBatInner');
  xsIsland('cdIsland'); xsIsland('pnIsland'); xsIsland('cuIsland');
  xsFillAll('cardStudioPage'); xsFillAll('panelStudioPage'); xsFillAll('customStudioPage');
});

/* 点击空白关掉下拉 */
document.addEventListener('click', function (e) {
  if (!e.target.closest('#cdCustomSelect')) cdCloseDropdown();
  if (!e.target.closest('#pnCustomSelect')) pnCloseDropdown();
  if (!e.target.closest('#cuCustomSelect')) cuCloseDropdown();
});

/* 状态栏跨页同步 */
window.addEventListener('storage', function (e) {
  if (e.key === 'luna_island_update' || e.key === 'luna_island_enabled' || e.key === 'luna_island_style') {
    xsIsland('cdIsland'); xsIsland('pnIsland'); xsIsland('cuIsland');
  }
  if (e.key === 'luna_tz_update' || e.key === 'luna_battery') {
    xsTick('cdTime','cdBatPct','cdBatInner');
    xsTick('pnTime','pnBatPct','pnBatInner');
    xsTick('cuTime','cuBatPct','cuBatInner');
  }
});