/* ================================================
   美化设置 · beautify.js
   五个分区：导航栏 / 顶部 / 消息页面 / 联系人&朋友圈 / 全局
================================================ */

/* ---- 每个分区的调色板（黑白灰系，禁止米色/暖色） ---- */
const BT_PALETTE = [
  '#0a0a0a', '#1e1e1e', '#3a3a3e', '#5c5c62',
  '#8c8c92', '#b3b3b8', '#d4d4d8', '#e6e6ea',
  '#f1f1f3', '#ffffff'
];

const BT_NAV_BG_PALETTE = [
  'rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)', 'rgba(246,246,248,0.85)',
  'rgba(235,235,238,0.85)', 'rgba(30,30,32,0.75)', 'rgba(10,10,10,0.85)'
];

/* ---- 分区定义 ---- */
const BT_SECTIONS = {
  nav: {
    title: '导航栏美化',
    sub: 'BOTTOM NAVIGATION',
    vars: {
      bg: { css: '--bt-nav-bg', label: '导航栏背景', palette: BT_NAV_BG_PALETTE, key: 'bt_nav_bg', isRgba: true, default: 'rgba(255,255,255,0.7)' },
      active: { css: '--bt-nav-active', label: '选中态颜色', palette: BT_PALETTE, key: 'bt_nav_active', default: '#000000' },
      inactive: { css: '--bt-nav-inactive', label: '未选中态颜色', palette: BT_PALETTE, key: 'bt_nav_inactive', default: '#c0c0c8' },
      indicator: { css: '--bt-nav-indicator', label: '指示器颜色', palette: BT_PALETTE, key: 'bt_nav_indicator', default: '#000000' },
    }
  },
  top: {
    title: '顶部美化',
    sub: 'TOP HEADER',
    vars: {
      bg: { css: '--bt-top-bg', label: '顶部背景', palette: BT_PALETTE, key: 'bt_top_bg', default: '#ffffff' },
      accent: { css: '--bt-top-accent', label: '头像 / 强调色', palette: BT_PALETTE, key: 'bt_top_accent', default: '#0a0a0a' },
      text: { css: '--bt-top-text', label: '标题文字颜色', palette: BT_PALETTE, key: 'bt_top_text', default: '#0a0a0a' },
    }
  },
  msg: {
    title: 'Message 页面美化',
    sub: 'MESSAGE LIST',
    vars: {
      badge: { css: '--bt-msg-badge', label: '未读徽章颜色', palette: BT_PALETTE, key: 'bt_msg_badge', default: '#0a0a0a' },
      unread: { css: '--bt-msg-unread', label: '置顶会话底色', palette: BT_PALETTE, key: 'bt_msg_unread', default: '#0a0a0a' },
    }
  },
  social: {
    title: 'Contacts & Moments 美化',
    sub: 'CONTACTS · MOMENTS',
    vars: {
      bg: { css: '--bt-social-bg', label: '朋友圈头部背景', palette: BT_PALETTE, key: 'bt_social_bg', default: '#ffffff' },
      accent: { css: '--bt-social-accent', label: '按钮强调色', palette: BT_PALETTE, key: 'bt_social_accent', default: '#0a0a0a' },
    }
  },
  global: {
    title: '全局美化',
    sub: 'GLOBAL THEME',
    vars: {
      bg: { css: '--bt-global-bg', label: '全局背景色', palette: BT_PALETTE.filter(c => ['#ffffff','#f1f1f3','#e6e6ea','#d4d4d8','#b3b3b8'].includes(c)), key: 'bt_global_bg', default: '#f5f5f9' },
    },
    hasRadius: true
  }
};

let _btCurrentSection = null;

/* ---- 打开 / 关闭 美化设置主页面 ---- */
function openBeautifySettings() {
  const page = document.getElementById('btPage');
  const overlay = document.getElementById('btOverlay');
  if (!page) return;

  page.classList.add('active');
  if (overlay) overlay.classList.add('active');

  btSyncStatusBar();
  btRenderCatSwatches();
}

function closeBeautifySettings() {
  // 若二级页开着，先关二级页
  const sub = document.getElementById('btSubPage');
  if (sub && sub.classList.contains('active')) {
    btCloseSub();
    return;
  }
  document.getElementById('btPage')?.classList.remove('active');
  document.getElementById('btOverlay')?.classList.remove('active');
}

/* ---- 状态栏同步（与 cp-page 同一套逻辑） ---- */
function btSyncStatusBar() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeEl = document.getElementById('btStatusTime');
  if (timeEl) timeEl.textContent = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });

  const pctEl = document.getElementById('btBatPct');
  const innerEl = document.getElementById('btBatInner');
  const mainPct = document.getElementById('batPct');
  const mainInner = document.getElementById('batInner');
  if (pctEl && mainPct) pctEl.textContent = mainPct.textContent;
  if (innerEl && mainInner) {
    innerEl.style.width = mainInner.style.width;
    innerEl.style.background = mainInner.style.background;
  }

  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style = localStorage.getItem('luna_island_style') || 'minimal';
  const islandEl = document.getElementById('btStatusIsland');
  if (islandEl) {
    if (!enabled) { islandEl.innerHTML = ''; }
    else {
      const styleMap = {
        minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
        glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
        clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text">--:--</span></div></div>`,
        pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
        ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
        rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
        music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
        scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
      };
      islandEl.innerHTML = styleMap[style] || styleMap.minimal;
    }
  }
}

/* ---- 一级页面：分区入口小色点预览 ---- */
function btRenderCatSwatches() {
  Object.keys(BT_SECTIONS).forEach(key => {
    const wrap = document.getElementById('btCatSwatch_' + key);
    if (!wrap) return;
    const section = BT_SECTIONS[key];
    const dots = Object.values(section.vars).slice(0, 3).map(v => {
      const stored = localStorage.getItem(v.key) || v.default;
      return `<div class="bt-cat-swatch" style="background:${stored}"></div>`;
    }).join('');
    wrap.innerHTML = dots;
  });
}

/* ---- 打开二级设置页 ---- */
function btOpenSub(sectionKey) {
  _btCurrentSection = sectionKey;
  const section = BT_SECTIONS[sectionKey];
  if (!section) return;

  document.getElementById('btSubTitle2').textContent = section.title;

  const body = document.getElementById('btSubBody');
  body.innerHTML = btBuildSubBody(sectionKey, section);

  document.getElementById('btSubPage').classList.add('active');
}

function btCloseSub() {
  document.getElementById('btSubPage')?.classList.remove('active');
  btRenderCatSwatches();
}

/* ---- 构建二级页 HTML（预览卡 + 每个可调项） ---- */
function btBuildSubBody(sectionKey, section) {
  let html = `<div class="bt-preview-card"><div class="bt-preview-label">实时预览 · PREVIEW</div>${btBuildPreview(sectionKey)}</div>`;

  Object.entries(section.vars).forEach(([varKey, v]) => {
    const current = localStorage.getItem(v.key) || v.default;
    html += `
      <div class="bt-section-label">${v.label}</div>
      <div class="bt-swatch-grid" id="btGrid_${sectionKey}_${varKey}">
        ${v.palette.map(c => {
          const selected = c === current;
          const lightCheck = btIsLight(c);
          return `<div class="bt-swatch ${selected ? 'selected' : ''} ${lightCheck ? 'light-check' : ''}"
                       style="background:${c}"
                       onclick="btApplyColor('${sectionKey}','${varKey}','${c}')">
                    <div class="bt-swatch-check">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  </div>`;
        }).join('')}
      </div>
      <div class="bt-custom-row">
        <span class="bt-custom-label">自定义颜色</span>
        <input class="bt-custom-hex" type="text" placeholder="#000000" maxlength="9"
               id="btHex_${sectionKey}_${varKey}"
               onchange="btApplyCustomHex('${sectionKey}','${varKey}', this.value)" />
        <input class="bt-custom-input" type="color"
               value="${btToHexColor(current)}"
               onchange="btApplyCustomHex('${sectionKey}','${varKey}', this.value)" />
      </div>
    `;
  });

  if (section.hasRadius) {
    const radiusVal = parseInt(localStorage.getItem('bt_global_radius') || '18', 10);
    html += `
      <div class="bt-section-label">圆角大小</div>
      <div class="bt-slider-row">
        <div class="bt-slider-head">
          <span class="bt-slider-title">全局圆角</span>
          <span class="bt-slider-val" id="btRadiusVal">${radiusVal}px</span>
        </div>
        <input class="bt-slider" type="range" min="0" max="32" value="${radiusVal}"
               oninput="btApplyRadius(this.value)" />
      </div>
    `;
  }

  return html;
}

/* ---- 判断颜色是否偏浅（决定勾选图标用深色还是白色） ---- */
function btIsLight(color) {
  let r, g, b;
  if (color.startsWith('rgba') || color.startsWith('rgb')) {
    const nums = color.match(/[\d.]+/g);
    r = +nums[0]; g = +nums[1]; b = +nums[2];
  } else {
    const hex = color.replace('#', '');
    if (hex.length < 6) return true;
    r = parseInt(hex.substr(0,2),16);
    g = parseInt(hex.substr(2,2),16);
    b = parseInt(hex.substr(4,2),16);
  }
  const brightness = (r*299 + g*587 + b*114) / 1000;
  return brightness > 180;
}

/* ---- rgba 转普通 hex（供 <input type=color> 使用，它不支持 rgba）---- */
function btToHexColor(color) {
  if (color.startsWith('#')) return color.length === 9 ? color.substr(0,7) : color;
  const nums = color.match(/[\d.]+/g);
  if (!nums) return '#000000';
  const r = Math.round(+nums[0]).toString(16).padStart(2,'0');
  const g = Math.round(+nums[1]).toString(16).padStart(2,'0');
  const b = Math.round(+nums[2]).toString(16).padStart(2,'0');
  return `#${r}${g}${b}`;
}

/* ---- 应用色板选择 ---- */
function btApplyColor(sectionKey, varKey, color) {
  const v = BT_SECTIONS[sectionKey].vars[varKey];
  localStorage.setItem(v.key, color);
  document.documentElement.style.setProperty(v.css, color);

  // 刷新当前网格的选中态
  const grid = document.getElementById(`btGrid_${sectionKey}_${varKey}`);
  if (grid) {
    grid.querySelectorAll('.bt-swatch').forEach(el => el.classList.remove('selected'));
    const match = Array.from(grid.children).find(el => el.style.background === btNormalizeForCompare(color) || el.getAttribute('onclick').includes(`'${color}'`));
    if (match) match.classList.add('selected');
  }
  const hexInput = document.getElementById(`btHex_${sectionKey}_${varKey}`);
  if (hexInput) hexInput.value = '';

  btRefreshPreview(sectionKey);
  btShowToast('已应用');
}

function btNormalizeForCompare(color) { return color; }

/* ---- 应用自定义 HEX / 拾色器颜色 ---- */
function btApplyCustomHex(sectionKey, varKey, value) {
  if (!value) return;
  let color = value.trim();
  if (!color.startsWith('#') && !color.startsWith('rgb')) color = '#' + color;
  const v = BT_SECTIONS[sectionKey].vars[varKey];
  localStorage.setItem(v.key, color);
  document.documentElement.style.setProperty(v.css, color);

  const grid = document.getElementById(`btGrid_${sectionKey}_${varKey}`);
  if (grid) grid.querySelectorAll('.bt-swatch').forEach(el => el.classList.remove('selected'));

  btRefreshPreview(sectionKey);
  btShowToast('已应用自定义颜色');
}

/* ---- 应用圆角滑块 ---- */
function btApplyRadius(value) {
  localStorage.setItem('bt_global_radius', value);
  document.documentElement.style.setProperty('--bt-global-radius', value + 'px');
  const label = document.getElementById('btRadiusVal');
  if (label) label.textContent = value + 'px';
  btRefreshPreview('global');
}

/* ---- 刷新预览卡 ---- */
function btRefreshPreview(sectionKey) {
  const card = document.querySelector('#btSubBody .bt-preview-card');
  if (card) {
    const label = card.querySelector('.bt-preview-label');
    card.innerHTML = '';
    card.appendChild(label);
    card.insertAdjacentHTML('beforeend', btBuildPreview(sectionKey));
  }
}

/* ---- 构建每个分区的可视化预览 mock ---- */
function btBuildPreview(sectionKey) {
  const g = (key, def) => localStorage.getItem(key) || def;

  if (sectionKey === 'nav') {
    const style = `--pv-nav-bg:${g('bt_nav_bg','rgba(255,255,255,0.7)')};--pv-nav-active:${g('bt_nav_active','#000')};--pv-nav-inactive:${g('bt_nav_inactive','#c0c0c8')};`;
    return `
      <div class="bt-pv-navbar" style="${style}">
        <div class="bt-pv-navbtn on"><div class="bt-pv-dot"></div><div class="bt-pv-navlabel">Chat</div></div>
        <div class="bt-pv-navbtn"><div class="bt-pv-dot"></div><div class="bt-pv-navlabel">Contacts</div></div>
        <div class="bt-pv-navbtn"><div class="bt-pv-dot"></div><div class="bt-pv-navlabel">Moments</div></div>
        <div class="bt-pv-navbtn"><div class="bt-pv-dot"></div><div class="bt-pv-navlabel">Me</div></div>
      </div>`;
  }
  if (sectionKey === 'top') {
    const style = `--pv-top-bg:${g('bt_top_bg','#fff')};--pv-top-accent:${g('bt_top_accent','#111')};--pv-top-text:${g('bt_top_text','#0d0d0d')};`;
    return `
      <div class="bt-pv-top" style="${style}">
        <div class="bt-pv-top-row">
          <div class="bt-pv-avatar"></div>
          <div>
            <div class="bt-pv-top-name">Messages</div>
            <div class="bt-pv-top-handle">@luna_user</div>
          </div>
        </div>
      </div>`;
  }
  if (sectionKey === 'msg') {
    const style = `--pv-msg-badge:${g('bt_msg_badge','#111')};--pv-msg-unread:${g('bt_msg_unread','#0d0d0d')};`;
    return `
      <div class="bt-pv-msglist" style="${style}">
        <div class="bt-pv-msgrow pinned">
          <div class="bt-pv-msg-av"></div>
          <div class="bt-pv-msg-lines"><div class="bt-pv-msg-line1"></div><div class="bt-pv-msg-line2"></div></div>
          <div class="bt-pv-msg-badge"></div>
        </div>
        <div class="bt-pv-msgrow">
          <div class="bt-pv-msg-av"></div>
          <div class="bt-pv-msg-lines"><div class="bt-pv-msg-line1"></div><div class="bt-pv-msg-line2"></div></div>
          <div class="bt-pv-msg-badge"></div>
        </div>
      </div>`;
  }
  if (sectionKey === 'social') {
    const style = `--pv-social-bg:${g('bt_social_bg','#fff')};--pv-social-accent:${g('bt_social_accent','#111')};`;
    return `
      <div class="bt-pv-social" style="${style}">
        <div class="bt-pv-social-text"><div class="bt-pv-social-l1"></div><div class="bt-pv-social-l2"></div></div>
        <div class="bt-pv-social-btn"></div>
      </div>`;
  }
  if (sectionKey === 'global') {
    const style = `--pv-global-bg:${g('bt_global_bg','#f5f5f9')};--pv-global-radius:${g('bt_global_radius','18')}px;`;
    return `
      <div class="bt-pv-global" style="${style}">
        <div class="bt-pv-global-frame"></div>
      </div>`;
  }
  return '';
}

/* ---- 轻提示 ---- */
let _btToastTimer = null;
function btShowToast(msg) {
  const toast = document.getElementById('btToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(_btToastTimer);
  _btToastTimer = setTimeout(() => toast.classList.remove('show'), 1400);
}

/* ---- 重置当前分区为默认值 ---- */
function btResetSection() {
  if (!_btCurrentSection) return;
  const section = BT_SECTIONS[_btCurrentSection];
  Object.values(section.vars).forEach(v => {
    localStorage.removeItem(v.key);
    document.documentElement.style.setProperty(v.css, v.default);
  });
  if (section.hasRadius) {
    localStorage.removeItem('bt_global_radius');
    document.documentElement.style.setProperty('--bt-global-radius', '18px');
  }
  btOpenSub(_btCurrentSection);
  btShowToast('已恢复默认');
}

/* ---- 重置全部 ---- */
function btResetAll() {
  Object.values(BT_SECTIONS).forEach(section => {
    Object.values(section.vars).forEach(v => {
      localStorage.removeItem(v.key);
      document.documentElement.style.setProperty(v.css, v.default);
    });
    if (section.hasRadius) {
      localStorage.removeItem('bt_global_radius');
      document.documentElement.style.setProperty('--bt-global-radius', '18px');
    }
  });
  btRenderCatSwatches();
  btShowToast('已恢复全部默认设置');
}

/* ---- 页面加载时，将 localStorage 中已保存的美化设置写回 :root ---- */
function btApplyStoredOnLoad() {
  Object.values(BT_SECTIONS).forEach(section => {
    Object.values(section.vars).forEach(v => {
      const stored = localStorage.getItem(v.key);
      if (stored) document.documentElement.style.setProperty(v.css, stored);
    });
    if (section.hasRadius) {
      const storedRadius = localStorage.getItem('bt_global_radius');
      if (storedRadius) document.documentElement.style.setProperty('--bt-global-radius', storedRadius + 'px');
    }
  });
}

/* 立即执行：还原用户已保存的美化设置 */
btApplyStoredOnLoad();
