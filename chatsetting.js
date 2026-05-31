/* ================================================================
   Chat Background Settings — chatsetting.js
   灵动岛 · 状态栏 · 字体 与 chatroom.js 完全同步
================================================================ */

/* ── 状态栏时钟 + 电量（与 chatroom crTick 同步）── */
function csTick() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const n = new Date();
  const timeStr = n.toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit',
    hour12: false, timeZone: tz
  });
  const el = document.getElementById('csTime');
  if (el) el.textContent = timeStr;

  const pct = parseInt(localStorage.getItem('luna_battery') || '76');
  const pctEl  = document.getElementById('csBatPct');
  const innerEl = document.getElementById('csBatInner');
  if (pctEl) pctEl.textContent = pct;
  if (innerEl) {
    innerEl.style.width = pct + '%';
    innerEl.style.background = pct <= 20
      ? 'linear-gradient(90deg, #f87171, #ef4444)'
      : '#1a1a1a';
  }
}
csTick();
setInterval(csTick, 10000);

/* ================================================================
   灵动岛（与 chatroom applyIsland 完全同步）
================================================================ */
function csApplyIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const el      = document.getElementById('csIsland');
  if (!el) return;
  if (!enabled) { el.innerHTML = ''; return; }

  const styleMap = {
    minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
    clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="csIslandClock">--:--</span></div></div>`,
    pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
    ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
    rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
    music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
    scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
  };
  el.innerHTML = styleMap[style] || styleMap.minimal;

  clearInterval(window._csIslandClockTimer);
  if (style === 'clock') {
    const tick = () => {
      const t = document.getElementById('csIslandClock');
      if (!t) return;
      const now = new Date();
      t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    };
    tick();
    window._csIslandClockTimer = setInterval(tick, 10000);
  }
}

/* ================================================================
   字体同步（与 chatroom applyGlobalFont 完全同步）
================================================================ */
async function csApplyGlobalFont() {
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
   storage 事件监听（与 chatroom 同步）
================================================================ */
window.addEventListener('storage', function(e) {
  if (e.key === 'luna_font_update' || e.key === 'luna_font_style') csApplyGlobalFont();
  if (e.key === 'luna_island_update' || e.key === 'luna_island_enabled' || e.key === 'luna_island_style') csApplyIsland();
  if (e.key === 'luna_tz_update') csTick();
  if (e.key === 'luna_perception_update') pcLoadState();  // ← 加这行
});

window.addEventListener('pageshow', function(e) {
  if (e.persisted) window.location.reload();
});

/* ================================================================
   应用范围切换
================================================================ */
let csScope = 'global'; // 'global' | 'char'

function csScopeSelect(scope) {
  csScope = scope;
  const g = document.getElementById('scopeGlobal');
  const c = document.getElementById('scopeChar');
  if (!g || !c) return;

  if (scope === 'global') {
    g.classList.add('on');
    c.classList.remove('on');
    // 更新图标颜色
    g.querySelectorAll('svg path, svg circle').forEach(el => {
      el.setAttribute('stroke', '#fff');
    });
    c.querySelectorAll('svg path, svg circle').forEach(el => {
      el.setAttribute('stroke', '#888');
    });
    // radio
    g.querySelector('.scope-radio').innerHTML = '<div class="sr-dot"></div>';
    c.querySelector('.scope-radio').innerHTML = '';
  } else {
    c.classList.add('on');
    g.classList.remove('on');
    c.querySelectorAll('svg path, svg circle').forEach(el => {
      el.setAttribute('stroke', '#fff');
    });
    g.querySelectorAll('svg path, svg circle').forEach(el => {
      el.setAttribute('stroke', '#888');
    });
    c.querySelector('.scope-radio').innerHTML = '<div class="sr-dot"></div>';
    g.querySelector('.scope-radio').innerHTML = '';
  }
}

/* ================================================================
   图片上传 + 预览
================================================================ */
let csSelectedImage = null; // base64 data URL

function csApplyPreview(dataUrl) {
  const bg = document.getElementById('phoneBg');
  if (!bg) return;
  if (dataUrl) {
    bg.style.backgroundImage = `url(${dataUrl})`;
    bg.style.backgroundSize  = 'cover';
    bg.style.backgroundPosition = 'center';
  } else {
    bg.style.backgroundImage = '';
    bg.style.backgroundSize  = '';
    // 恢复默认网格
  }
}

function csUpdateCurStrip(name, hint, thumbUrl) {
  const nameEl  = document.getElementById('curName');
  const hintEl  = document.getElementById('curHint');
  const thumbEl = document.getElementById('curThumb');
  if (nameEl) nameEl.textContent = name;
  if (hintEl) hintEl.textContent = hint;
  if (thumbEl) {
    if (thumbUrl) {
      thumbEl.style.backgroundImage    = `url(${thumbUrl})`;
      thumbEl.style.backgroundSize     = 'cover';
      thumbEl.style.backgroundPosition = 'center';
    } else {
      thumbEl.style.backgroundImage = '';
    }
  }
}

function csHandleFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  if (file.size > 10 * 1024 * 1024) {
    alert('图片大小不能超过 10MB');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    csSelectedImage = e.target.result;
    csApplyPreview(csSelectedImage);
    csUpdateCurStrip(file.name, file.type.split('/')[1].toUpperCase() + ' · ' + (file.size / 1024).toFixed(0) + 'KB', csSelectedImage);
  };
  reader.readAsDataURL(file);
}

/* ================================================================
   保存背景（存入 localStorage）
================================================================ */
function csSave() {
  if (!csSelectedImage) return;

  const key = csScope === 'global'
    ? 'luna_chat_bg_global'
    : 'luna_chat_bg_' + (localStorage.getItem('luna_current_chat') || 'default');

  try {
    localStorage.setItem(key, csSelectedImage);
    localStorage.setItem('luna_chat_bg_scope', csScope);
    localStorage.setItem('luna_chat_bg_update', Date.now().toString());
  } catch(e) {
    alert('保存失败，图片可能过大');
    return;
  }
  showToast('背景已保存 ✓');
}

/* ================================================================
   恢复默认
================================================================ */
function csClearBg() {
  csSelectedImage = null;
  csApplyPreview(null);
  csUpdateCurStrip('默认背景', 'DEFAULT · GRID PATTERN', null);

  const currentChar = localStorage.getItem('luna_current_chat') || 'default';
  if (csScope === 'global') {
    localStorage.removeItem('luna_chat_bg_global');
  } else {
    localStorage.removeItem('luna_chat_bg_' + currentChar);
  }
  localStorage.setItem('luna_chat_bg_update', Date.now().toString());
  showToast('已恢复默认背景');
}

/* ================================================================
   Toast 提示
================================================================ */
function showToast(msg) {
  let t = document.getElementById('csToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'csToast';
    t.style.cssText = `
      position:fixed;bottom:100px;left:50%;transform:translateX(-50%) translateY(10px);
      background:#1a1a1a;color:#fff;font-size:12px;font-family:'Inter',sans-serif;
      padding:9px 18px;border-radius:20px;z-index:9999;opacity:0;
      transition:opacity .25s ease,transform .25s ease;white-space:nowrap;
      pointer-events:none;
    `;
    document.body.appendChild(t);
  }
  t.textContent = msg;
  requestAnimationFrame(() => {
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
  });
  clearTimeout(window._csToastTimer);
  window._csToastTimer = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(10px)';
  }, 2200);
}

/* ================================================================
   拖拽上传
================================================================ */
function csInitDrop() {
  const zone = document.getElementById('dropZone');
  if (!zone) return;

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.style.background = '#f0f0f0';
    zone.style.borderColor = 'rgba(0,0,0,0.25)';
  });
  zone.addEventListener('dragleave', () => {
    zone.style.background = '';
    zone.style.borderColor = '';
  });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.style.background = '';
    zone.style.borderColor = '';
    const file = e.dataTransfer?.files?.[0];
    if (file) csHandleFile(file);
  });
  zone.addEventListener('click', () => {
    document.getElementById('csFileInput')?.click();
  });
}

/* ================================================================
   读取当前已保存的背景（页面初始化时显示）
================================================================ */
function csLoadSavedBg() {
  const currentChar = localStorage.getItem('luna_current_chat') || 'default';
  const scope = localStorage.getItem('luna_chat_bg_scope') || 'global';
  const key = scope === 'global'
    ? 'luna_chat_bg_global'
    : 'luna_chat_bg_' + currentChar;
  const saved = localStorage.getItem(key);
  if (saved) {
    csSelectedImage = saved;
    csApplyPreview(saved);
    csUpdateCurStrip('已设置背景', scope === 'global' ? 'GLOBAL · CUSTOM' : 'CHAR · CUSTOM', saved);
    csScopeSelect(scope);
  }
}

/* ================================================================
   DOMContentLoaded — 初始化所有模块
================================================================ */
document.addEventListener('DOMContentLoaded', async function () {
  // 1. 灵动岛
  csApplyIsland();

  // 2. 字体
  csApplyGlobalFont();

  // 3. 状态栏时钟
  csTick();

  // 4. 读取已保存背景
  csLoadSavedBg();

  // 5. 拖拽区
  csInitDrop();

  // 6. 范围切换
  document.getElementById('scopeGlobal')?.addEventListener('click', () => csScopeSelect('global'));
  document.getElementById('scopeChar')?.addEventListener('click', () => csScopeSelect('char'));

  // 7. 文件选择
  const fileInput = document.getElementById('csFileInput');
  fileInput?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) csHandleFile(file);
    fileInput.value = '';
  });

  // 8. 相册按钮
  document.getElementById('csPickBtn')?.addEventListener('click', () => {
    document.getElementById('csFileInput')?.click();
  });

  // 9. 保存按钮
  document.getElementById('csSaveBtn')?.addEventListener('click', csSave);
  document.getElementById('csApplyBtn')?.addEventListener('click', csSave);

  // 10. 恢复默认
  document.getElementById('csClearBtn')?.addEventListener('click', csClearBg);

  // 11. 返回按钮 → 跳回聊天页面（chatroom 从 localStorage 读角色名，不需要传参）
  document.getElementById('csNavBack')?.addEventListener('click', () => {
    window.location.href = 'chatroom.html';
  });

  // 12. 取消按钮 → 同样跳回聊天页面
  document.getElementById('csCancelBtn')?.addEventListener('click', () => {
    window.location.href = 'chatroom.html';
  });

  // 13. 主题美化卡片 — 跳转到 appearance_settings.html 并携带当前角色 ID
  document.getElementById('themeAppearanceCard')?.addEventListener('click', () => {
    const currentChar = localStorage.getItem('luna_current_chat') || 'default';
    window.location.href = 'appearance_settings.html?char=' + encodeURIComponent(currentChar);
  });
  document.getElementById('themeAppearanceCard') && (
    document.getElementById('themeAppearanceCard').style.cursor = 'pointer'
  );
});

/* ================================================================
   感知设置 · PERCEPTION
================================================================ */
const PC_CITIES = [
  { group: '华北', cities: [
    { name:'北京', sub:'朝阳 / 海淀 / 西城', lat:39.9042, lng:116.4074 },
    { name:'天津', sub:'和平 / 南开 / 河西', lat:39.3434, lng:117.3616 },
    { name:'石家庄', sub:'长安 / 裕华 / 新华', lat:38.0428, lng:114.5149 },
    { name:'太原', sub:'小店 / 迎泽 / 杏花岭', lat:37.8706, lng:112.5489 },
    { name:'呼和浩特', sub:'回民 / 玉泉 / 赛罕', lat:40.8426, lng:111.7496 },
  ]},
  { group: '华东', cities: [
    { name:'上海', sub:'浦东 / 黄浦 / 静安', lat:31.2304, lng:121.4737 },
    { name:'南京', sub:'玄武 / 鼓楼 / 建邺', lat:32.0603, lng:118.7969 },
    { name:'苏州', sub:'姑苏 / 工业园 / 吴中', lat:31.2989, lng:120.5853 },
    { name:'无锡', sub:'梁溪 / 滨湖 / 新吴', lat:31.4912, lng:120.3119 },
    { name:'杭州', sub:'西湖 / 滨江 / 余杭', lat:30.2741, lng:120.1551 },
    { name:'宁波', sub:'鄞州 / 海曙 / 江北', lat:29.8683, lng:121.5440 },
    { name:'温州', sub:'鹿城 / 瓯海 / 龙湾', lat:28.0000, lng:120.6667 },
    { name:'合肥', sub:'包河 / 蜀山 / 庐阳', lat:31.8206, lng:117.2272 },
    { name:'济南', sub:'历下 / 市中 / 槐荫', lat:36.6512, lng:117.1201 },
    { name:'青岛', sub:'市南 / 崂山 / 城阳', lat:36.0671, lng:120.3826 },
    { name:'烟台', sub:'芝罘 / 莱山 / 福山', lat:37.4638, lng:121.4479 },
    { name:'福州', sub:'鼓楼 / 仓山 / 台江', lat:26.0745, lng:119.2965 },
    { name:'厦门', sub:'思明 / 湖里 / 集美', lat:24.4798, lng:118.0894 },
    { name:'南昌', sub:'东湖 / 西湖 / 青山湖', lat:28.6820, lng:115.8579 },
  ]},
  { group: '华南', cities: [
    { name:'广州', sub:'天河 / 越秀 / 番禺', lat:23.1291, lng:113.2644 },
    { name:'深圳', sub:'南山 / 福田 / 宝安', lat:22.5431, lng:114.0579 },
    { name:'珠海', sub:'香洲 / 斗门 / 金湾', lat:22.2710, lng:113.5767 },
    { name:'佛山', sub:'禅城 / 南海 / 顺德', lat:23.0219, lng:113.1215 },
    { name:'东莞', sub:'南城 / 莞城 / 长安', lat:23.0207, lng:113.7518 },
    { name:'惠州', sub:'惠城 / 惠阳 / 博罗', lat:23.1115, lng:114.4152 },
    { name:'南宁', sub:'青秀 / 兴宁 / 西乡塘', lat:22.8170, lng:108.3665 },
    { name:'桂林', sub:'象山 / 秀峰 / 七星', lat:25.2736, lng:110.2990 },
    { name:'海口', sub:'龙华 / 秀英 / 琼山', lat:20.0440, lng:110.1999 },
    { name:'三亚', sub:'吉阳 / 天涯 / 海棠', lat:18.2524, lng:109.5117 },
  ]},
  { group: '华中', cities: [
    { name:'武汉', sub:'武昌 / 洪山 / 江汉', lat:30.5928, lng:114.3055 },
    { name:'长沙', sub:'岳麓 / 芙蓉 / 天心', lat:28.2282, lng:112.9388 },
    { name:'郑州', sub:'金水 / 二七 / 中原', lat:34.7466, lng:113.6253 },
    { name:'洛阳', sub:'涧西 / 西工 / 老城', lat:34.6197, lng:112.4540 },
  ]},
  { group: '西南', cities: [
    { name:'成都', sub:'武侯 / 锦江 / 高新', lat:30.5728, lng:104.0668 },
    { name:'重庆', sub:'渝中 / 江北 / 南岸', lat:29.5630, lng:106.5516 },
    { name:'贵阳', sub:'南明 / 云岩 / 花溪', lat:26.6470, lng:106.6302 },
    { name:'昆明', sub:'五华 / 盘龙 / 官渡', lat:25.0453, lng:102.7097 },
    { name:'大理', sub:'大理古城 / 下关 / 双廊', lat:25.6065, lng:100.2679 },
    { name:'丽江', sub:'古城区 / 玉龙 / 宁蒗', lat:26.8721, lng:100.2270 },
    { name:'拉萨', sub:'城关 / 堆龙德庆 / 达孜', lat:29.6520, lng:91.1721 },
  ]},
  { group: '西北', cities: [
    { name:'西安', sub:'雁塔 / 碑林 / 未央', lat:34.3416, lng:108.9398 },
    { name:'兰州', sub:'城关 / 七里河 / 安宁', lat:36.0611, lng:103.8343 },
    { name:'西宁', sub:'城东 / 城中 / 城西', lat:36.6232, lng:101.7782 },
    { name:'银川', sub:'兴庆 / 金凤 / 西夏', lat:38.4872, lng:106.2309 },
    { name:'乌鲁木齐', sub:'天山 / 沙依巴克 / 水磨沟', lat:43.8256, lng:87.6168 },
    { name:'敦煌', sub:'沙州 / 阳关 / 莫高窟', lat:40.1424, lng:94.6619 },
  ]},
  { group: '东北', cities: [
    { name:'沈阳', sub:'和平 / 沈河 / 皇姑', lat:41.8057, lng:123.4315 },
    { name:'大连', sub:'中山 / 西岗 / 沙河口', lat:38.9140, lng:121.6147 },
    { name:'长春', sub:'朝阳 / 南关 / 宽城', lat:43.8171, lng:125.3235 },
    { name:'哈尔滨', sub:'道里 / 南岗 / 道外', lat:45.8038, lng:126.5349 },
  ]},
  { group: '港澳台', cities: [
    { name:'香港', sub:'中西区 / 旺角 / 九龙城', lat:22.3193, lng:114.1694 },
    { name:'澳门', sub:'澳门半岛 / 氹仔 / 路环', lat:22.1987, lng:113.5439 },
    { name:'台北', sub:'信义 / 大安 / 中山', lat:25.0330, lng:121.5654 },
    { name:'高雄', sub:'苓雅 / 前镇 / 左营', lat:22.6273, lng:120.3014 },
  ]},
  { group: '日本', cities: [
    { name:'东京', sub:'新宿 / 涩谷 / 银座', lat:35.6762, lng:139.6503 },
    { name:'大阪', sub:'梅田 / 难波 / 心斋桥', lat:34.6937, lng:135.5023 },
    { name:'京都', sub:'祇园 / 岚山 / 伏见', lat:35.0116, lng:135.7681 },
    { name:'横滨', sub:'港未来 / 元町 / 中华街', lat:35.4437, lng:139.6380 },
    { name:'福冈', sub:'天神 / 博多 / 中洲', lat:33.5904, lng:130.4017 },
    { name:'札幌', sub:'大通 / 薄野 / 圆山', lat:43.0618, lng:141.3545 },
    { name:'冲绳', sub:'那霸 / 美浜 / 石垣岛', lat:26.2124, lng:127.6809 },
  ]},
  { group: '韩国', cities: [
    { name:'首尔', sub:'江南 / 弘大 / 明洞', lat:37.5665, lng:126.9780 },
    { name:'釜山', sub:'海云台 / 南浦洞 / 西面', lat:35.1796, lng:129.0756 },
    { name:'济州岛', sub:'济州市 / 西归浦 / 城山', lat:33.4996, lng:126.5312 },
  ]},
  { group: '东南亚', cities: [
    { name:'新加坡', sub:'乌节路 / 滨海湾 / 牛车水', lat:1.3521, lng:103.8198 },
    { name:'曼谷', sub:'暹罗 / 是隆 / 考山路', lat:13.7563, lng:100.5018 },
    { name:'清迈', sub:'古城区 / 尼曼路 / 素贴山', lat:18.7883, lng:98.9853 },
    { name:'普吉岛', sub:'芭东 / 卡塔 / 奈汉', lat:7.8804, lng:98.3923 },
    { name:'吉隆坡', sub:'KLCC / 武吉免登 / 茨厂街', lat:3.1390, lng:101.6869 },
    { name:'巴厘岛', sub:'库塔 / 乌布 / 水明漾', lat:-8.3405, lng:115.0920 },
    { name:'雅加达', sub:'南雅加达 / 中雅加达 / 科塔', lat:-6.2088, lng:106.8456 },
    { name:'河内', sub:'还剑 / 西湖 / 巴亭', lat:21.0278, lng:105.8342 },
    { name:'胡志明市', sub:'第一郡 / 第三郡 / 滨城', lat:10.8231, lng:106.6297 },
    { name:'马尼拉', sub:'马卡蒂 / BGC / 英特拉穆罗斯', lat:14.5995, lng:120.9842 },
    { name:'暹粒', sub:'吴哥窟 / 发布路 / 老市场', lat:13.3671, lng:103.8448 },
  ]},
  { group: '南亚', cities: [
    { name:'孟买', sub:'科拉巴 / 班德拉 / 达拉维', lat:19.0760, lng:72.8777 },
    { name:'新德里', sub:'康诺特广场 / 南德里 / 旧德里', lat:28.6139, lng:77.2090 },
    { name:'班加罗尔', sub:'科拉曼加拉 / 因迪拉纳加尔 / MG路', lat:12.9716, lng:77.5946 },
    { name:'科伦坡', sub:'科伦坡7区 / 科伦坡1区 / 宝石区', lat:6.9271, lng:79.8612 },
  ]},
  { group: '中东', cities: [
    { name:'迪拜', sub:'市中心 / 朱美拉 / 迪拜码头', lat:25.2048, lng:55.2708 },
    { name:'阿布扎比', sub:'科尔尼什 / 亚斯岛 / 萨迪亚特', lat:24.4539, lng:54.3773 },
    { name:'多哈', sub:'珍珠岛 / 西湾 / 苏克瓦吉夫', lat:25.2854, lng:51.5310 },
    { name:'伊斯坦布尔', sub:'贝西克塔斯 / 卡德柯伊 / 苏丹艾哈迈德', lat:41.0082, lng:28.9784 },
  ]},
  { group: '欧洲', cities: [
    { name:'伦敦', sub:'西区 / 肖尔迪奇 / 南岸', lat:51.5074, lng:-0.1278 },
    { name:'巴黎', sub:'玛莱区 / 蒙马特 / 香榭丽舍', lat:48.8566, lng:2.3522 },
    { name:'柏林', sub:'米特 / 十字山 / 普伦茨劳贝格', lat:52.5200, lng:13.4050 },
    { name:'阿姆斯特丹', sub:'约旦区 / 博物馆广场 / 红灯区', lat:52.3676, lng:4.9041 },
    { name:'巴塞罗那', sub:'哥特区 / 格拉西亚 / 波布雷诺', lat:41.3851, lng:2.1734 },
    { name:'罗马', sub:'特拉斯提弗列 / 西班牙广场 / 梵蒂冈', lat:41.9028, lng:12.4964 },
    { name:'维也纳', sub:'第一区 / 玛丽亚希尔夫 / 普拉特', lat:48.2082, lng:16.3738 },
    { name:'布拉格', sub:'老城区 / 小城区 / 维诺赫拉迪', lat:50.0755, lng:14.4378 },
    { name:'苏黎世', sub:'第一区 / 克莱斯 / 朗斯特拉瑟', lat:47.3769, lng:8.5417 },
    { name:'哥本哈根', sub:'新港 / 弗雷德里克斯贝 / 诺布罗', lat:55.6761, lng:12.5683 },
    { name:'斯德哥尔摩', sub:'加姆拉斯坦 / 瑟德马尔姆 / 于尔戈登', lat:59.3293, lng:18.0686 },
    { name:'莫斯科', sub:'阿尔巴特 / 特维尔 / 红场', lat:55.7558, lng:37.6173 },
    { name:'里斯本', sub:'阿尔法玛 / 贝伦 / 巴伊鲁奥图', lat:38.7169, lng:-9.1399 },
    { name:'雅典', sub:'普拉卡 / 科洛纳基 / 蒙纳斯提拉奇', lat:37.9838, lng:23.7275 },
  ]},
  { group: '北美', cities: [
    { name:'纽约', sub:'曼哈顿 / 布鲁克林 / 皇后区', lat:40.7128, lng:-74.0060 },
    { name:'洛杉矶', sub:'好莱坞 / 圣莫尼卡 / 韩国城', lat:34.0522, lng:-118.2437 },
    { name:'旧金山', sub:'金融区 / 使命区 / 唐人街', lat:37.7749, lng:-122.4194 },
    { name:'芝加哥', sub:'市中心 / 林肯公园 / 维克维尔', lat:41.8781, lng:-87.6298 },
    { name:'迈阿密', sub:'南滩 / 温伍德 / 小哈瓦那', lat:25.7617, lng:-80.1918 },
    { name:'拉斯维加斯', sub:'拉斯维加斯大道 / 老城区 / 亨德森', lat:36.1699, lng:-115.1398 },
    { name:'西雅图', sub:'派克市场 / 卡皮托山 / 弗里蒙特', lat:47.6062, lng:-122.3321 },
    { name:'多伦多', sub:'市中心 / 约克维尔 / 肯辛顿', lat:43.6532, lng:-79.3832 },
    { name:'温哥华', sub:'煤气镇 / 基斯兰奴 / 列治文', lat:49.2827, lng:-123.1207 },
    { name:'墨西哥城', sub:'科约阿坎 / 波兰科 / 历史中心', lat:19.4326, lng:-99.1332 },
  ]},
  { group: '南美', cities: [
    { name:'圣保罗', sub:'保利斯塔 / 维拉玛达莱纳 / 品鸿', lat:-23.5505, lng:-46.6333 },
    { name:'里约热内卢', sub:'伊帕内玛 / 科帕卡巴纳 / 圣特雷莎', lat:-22.9068, lng:-43.1729 },
    { name:'布宜诺斯艾利斯', sub:'巴勒莫 / 圣特尔莫 / 雷科莱塔', lat:-34.6037, lng:-58.3816 },
  ]},
  { group: '大洋洲', cities: [
    { name:'悉尼', sub:'岩石区 / 萨里山 / 新镇', lat:-33.8688, lng:151.2093 },
    { name:'墨尔本', sub:'菲茨罗伊 / 普拉兰 / CBD', lat:-37.8136, lng:144.9631 },
    { name:'奥克兰', sub:'庞森比 / 帕内尔 / CBD', lat:-36.8485, lng:174.7633 },
  ]},
  { group: '非洲', cities: [
    { name:'开罗', sub:'扎马雷克 / 马阿迪 / 汗哈利利', lat:30.0444, lng:31.2357 },
    { name:'开普敦', sub:'博卡普 / 绿点 / 海滨', lat:-33.9249, lng:18.4241 },
    { name:'内罗毕', sub:'威斯特兰兹 / 基利马尼 / 卡伦', lat:-1.2921, lng:36.8219 },
  ]},
];

let pcMode = 'real';
let pcWeather = true;
let pcLoc = true;
let pcTime = true;
let pcCity = '上海 · 浦东';
let pcCityLat = 31.2304;
let pcCityLng = 121.4737;
let pcCityPickerOpen = false;

function pcSetMode(mode) {
  pcMode = mode;
  const r = document.getElementById('modeReal');
  const v = document.getElementById('modeVirtual');
  const hint = document.getElementById('pcModeHint');
  const weatherToggle = document.getElementById('pcWeatherToggle');
  const weatherDesc = document.getElementById('pcWeatherDesc');
  const locToggle = document.getElementById('pcLocToggle');
  const locIcon = document.getElementById('pcLocIcon');
  const locChips = document.getElementById('pcLocChips');
  const subChip = document.getElementById('pcLocChipSub');
  const cityPicker = document.getElementById('pcCityPicker');
  const virtualInput = document.getElementById('pcVirtualInput');

  if (mode === 'real') {
    r.classList.add('pct-mode-on');
    v.classList.remove('pct-mode-on');
    hint.textContent = '真实地点：天气感知可用，时间感知同步状态栏';

    // 恢复天气感知
    weatherToggle.classList.remove('pct-disabled');
    weatherToggle.classList.add('pct-toggle-on');
    weatherToggle.classList.remove('pct-toggle-off');
    pcWeather = true;
    const wi = document.getElementById('pcWeatherIcon');
    if (wi) { wi.classList.add('pct-icon-on'); wi.classList.remove('pct-icon-off'); }
    const wc = document.getElementById('pcWeatherChips');
    if (wc) wc.querySelectorAll('.pct-chip').forEach(c => c.classList.add('pct-chip-on'));
    if (weatherDesc) weatherDesc.textContent = '同步地点 · 实时天气温度体感';

    // 恢复地点感知
    pcLoc = true;
    if (locToggle) { locToggle.classList.remove('pct-disabled'); locToggle.classList.add('pct-toggle-on'); locToggle.classList.remove('pct-toggle-off'); }
    if (locIcon) { locIcon.classList.add('pct-icon-on'); locIcon.classList.remove('pct-icon-off'); }
    if (locChips) locChips.querySelectorAll('.pct-chip').forEach(c => c.classList.add('pct-chip-on'));
    if (subChip) subChip.textContent = '精确到区';

    // 显示城市选择器，隐藏虚拟输入
    if (virtualInput) virtualInput.style.display = 'none';
    if (cityPicker) cityPicker.style.display = 'none';

  } else {
    v.classList.add('pct-mode-on');
    r.classList.remove('pct-mode-on');
    hint.textContent = '虚拟地点：天气与地点感知不可用，时间感知仍可同步状态栏';

    // 禁用天气感知
    pcWeather = false;
    weatherToggle.classList.add('pct-disabled');
    weatherToggle.classList.remove('pct-toggle-on');
    weatherToggle.classList.add('pct-toggle-off');
    const wi = document.getElementById('pcWeatherIcon');
    if (wi) { wi.classList.remove('pct-icon-on'); wi.classList.add('pct-icon-off'); }
    const wc = document.getElementById('pcWeatherChips');
    if (wc) wc.querySelectorAll('.pct-chip').forEach(c => c.classList.remove('pct-chip-on'));
    if (weatherDesc) weatherDesc.textContent = '虚拟地点不支持天气感知';

    // 地点感知保持可用，只是换成虚拟输入
    if (subChip) subChip.textContent = '自定义地点';

    // 隐藏城市选择器，显示虚拟输入框
    if (cityPicker) cityPicker.style.display = 'none';
    if (virtualInput) virtualInput.style.display = 'block';
    const label = document.getElementById('pcLocCityLabel');
    const vField = document.getElementById('pcVirtualField');
    if (label) label.textContent = vField?.value || '未设置';
    if (pcCityPickerOpen) pcCloseCityPicker();
  }

  pcSaveState();
}

function pcToggle(key) {
  if (key === 'weather') {
    if (pcMode === 'virtual') return;
    pcWeather = !pcWeather;
    const t = document.getElementById('pcWeatherToggle');
    const ic = document.getElementById('pcWeatherIcon');
    const chips = document.getElementById('pcWeatherChips');
    t.classList.toggle('pct-toggle-on', pcWeather);
    t.classList.toggle('pct-toggle-off', !pcWeather);
    ic.classList.toggle('pct-icon-on', pcWeather);
    ic.classList.toggle('pct-icon-off', !pcWeather);
    chips.querySelectorAll('.pct-chip').forEach(c => {
      pcWeather ? c.classList.add('pct-chip-on') : c.classList.remove('pct-chip-on');
    });
  } else if (key === 'loc') {
    pcLoc = !pcLoc;
    const t = document.getElementById('pcLocToggle');
    const ic = document.getElementById('pcLocIcon');
    const chips = document.getElementById('pcLocChips');
    t.classList.toggle('pct-toggle-on', pcLoc);
    t.classList.toggle('pct-toggle-off', !pcLoc);
    ic.classList.toggle('pct-icon-on', pcLoc);
    ic.classList.toggle('pct-icon-off', !pcLoc);
    chips.querySelectorAll('.pct-chip').forEach(c => {
      pcLoc ? c.classList.add('pct-chip-on') : c.classList.remove('pct-chip-on');
    });
    if (!pcLoc && pcCityPickerOpen) pcCloseCityPicker();
  } else if (key === 'time') {
    pcTime = !pcTime;
    const t = document.getElementById('pcTimeToggle');
    const ic = document.getElementById('pcTimeIcon');
    const chips = document.getElementById('pcTimeChips');
    t.classList.toggle('pct-toggle-on', pcTime);
    t.classList.toggle('pct-toggle-off', !pcTime);
    ic.classList.toggle('pct-icon-on', pcTime);
    ic.classList.toggle('pct-icon-off', !pcTime);
    chips.querySelectorAll('.pct-chip').forEach(c => {
      pcTime ? c.classList.add('pct-chip-on') : c.classList.remove('pct-chip-on');
    });
    if (pcTime) pcSyncTime();
  }
  pcSaveState();
}

/* 时间同步状态栏 */
function pcSyncTime() {
  const timeEl = document.getElementById('csTime');
  const chipNow = document.getElementById('pcTimeChipNow');
  const chipDate = document.getElementById('pcTimeChipDate');
  if (!pcTime) return;
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit', hour12:false, timeZone:tz });
  const days = ['日','一','二','三','四','五','六'];
  const weekStr = '周' + days[now.getDay()];
  const dateStr = now.getFullYear() + '.' + String(now.getMonth()+1).padStart(2,'0');
  if (chipNow) chipNow.textContent = timeStr + ' · ' + weekStr;
  if (chipDate) chipDate.textContent = dateStr;
}

/* 城市选择器 */
function pcOpenCityPicker() {
  if (!pcLoc) return;
  if (pcMode === 'virtual') return;
  const picker = document.getElementById('pcCityPicker');
  if (!picker) return;
  pcCityPickerOpen = true;
  picker.style.display = 'block';
  pcRenderCities('');
  setTimeout(() => { document.getElementById('pcCityInput')?.focus(); }, 80);
}

function pcCloseCityPicker() {
  const picker = document.getElementById('pcCityPicker');
  if (picker) picker.style.display = 'none';
  pcCityPickerOpen = false;
}

function pcFilterCity(val) {
  pcRenderCities(val);
}

function pcRenderCities(filter) {
  const list = document.getElementById('pcCityList');
  if (!list) return;

  if (filter) {
    // 搜索模式：展平所有城市过滤
    const results = [];
    PC_CITIES.forEach(g => {
      g.cities.filter(c => c.name.includes(filter)).forEach(c => results.push(c));
    });
    list.innerHTML = results.length
      ? results.map(c => `
          <div class="pct-city-opt ${pcCity.startsWith(c.name) ? 'selected' : ''}"
               onclick="pcSelectCity('${c.name}','${c.sub.split(' / ')[0]}',${c.lat},${c.lng})">
            <span>${c.name}</span>
            <span class="pct-city-opt-sub">${c.sub}</span>
          </div>`).join('')
      : '<div style="padding:14px 16px;font-size:12px;color:#bbb;">未找到相关城市</div>';
    return;
  }

  // 分组模式
  list.innerHTML = PC_CITIES.map(g => `
    <div class="pct-city-group-label">${g.group}</div>
    ${g.cities.map(c => `
      <div class="pct-city-opt ${pcCity.startsWith(c.name) ? 'selected' : ''}"
           onclick="pcSelectCity('${c.name}','${c.sub.split(' / ')[0]}',${c.lat},${c.lng})">
        <span>${c.name}</span>
        <span class="pct-city-opt-sub">${c.sub}</span>
      </div>`).join('')}
  `).join('');
}

function pcSelectCity(name, district, lat, lng) {
  pcCity = name + ' · ' + district;
  pcCityLat = lat;
  pcCityLng = lng;
  const label = document.getElementById('pcLocCityLabel');
  if (label) label.textContent = pcCity;
  pcCloseCityPicker();
  pcFetchWeather(lat, lng); // 选完立即拉取天气
  pcSaveState();
}

/* 保存状态到 localStorage */
function pcSaveState() {
  localStorage.setItem('luna_perception', JSON.stringify({
    mode: pcMode,
    weather: pcWeather,
    loc: pcLoc,
    time: pcTime,
    city: pcCity,
    lat: pcCityLat,
    lng: pcCityLng
  }));
  localStorage.setItem('luna_perception_update', Date.now().toString());
}

/* 读取已保存的状态 */
function pcLoadState() {
  try {
    const saved = JSON.parse(localStorage.getItem('luna_perception') || '{}');
    if (saved.mode) pcSetMode(saved.mode);
    if (saved.city) {
      pcCity = saved.city;
      const label = document.getElementById('pcLocCityLabel');
      if (label) label.textContent = pcCity;
    }
    if (saved.lat) pcCityLat = saved.lat;
    if (saved.lng) pcCityLng = saved.lng;
    if (saved.weather === false) pcToggle('weather');
    if (saved.loc === false) pcToggle('loc');
    if (saved.time === false) pcToggle('time');
  } catch(e) {}

  // 加载完状态后自动拉取天气
  if (pcWeather && pcMode === 'real') {
    pcFetchWeather(pcCityLat, pcCityLng);
  }

  pcSyncTime();
}

/* 在 DOMContentLoaded 里追加调用 */
document.addEventListener('DOMContentLoaded', function() {
  pcLoadState();
  setInterval(pcSyncTime, 10000);
});

function pcVirtualChange(val) {
  const label = document.getElementById('pcLocCityLabel');
  if (label) label.textContent = val || '未设置';
  pcCity = val || '未设置';
  pcSaveState();
}

/* ================================================================
   天气感知 · Open-Meteo API
================================================================ */

async function pcFetchWeather(lat, lng) {
  if (!pcWeather || pcMode === 'virtual') return;
  const chips = document.getElementById('pcWeatherChips');
  if (chips) chips.innerHTML = '<div class="pct-chip pct-chip-on">获取中...</div>';
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day&timezone=auto&forecast_days=1`;
    const res = await fetch(url);
    const data = await res.json();
    const cur = data.current;
    const temp = Math.round(cur.temperature_2m);
    const feel = Math.round(cur.apparent_temperature);
    const humi = cur.relative_humidity_2m;
    const code = cur.weather_code;

    const WC = {
      0: '晴天', 1: '基本晴', 2: '局部多云', 3: '阴天',
      45: '有雾', 48: '冻雾',
      51: '细雨', 53: '小雨', 55: '毛毛雨',
      56: '冻毛毛雨', 57: '强冻毛毛雨',
      61: '小雨', 63: '中雨', 65: '大雨',
      66: '小冻雨', 67: '大冻雨',
      71: '小雪', 73: '中雪', 75: '大雪', 77: '冰粒',
      80: '阵雨', 81: '中阵雨', 82: '强阵雨',
      85: '小雪阵', 86: '大雪阵',
      95: '雷雨', 96: '雷雨夹冰雹', 99: '强雷暴'
    };
    const desc = WC[code] ?? '多云';

    const isDay = cur.is_day === 1;
    const finalDesc = isDay ? desc :
                      code === 0 ? '晴朗夜空' :
                      code === 1 ? '夜间多云' :
                      code === 2 ? '夜间局部多云' : desc;

    if (chips) chips.innerHTML = `
      <div class="pct-chip pct-chip-on">${finalDesc} · ${temp}°C</div>
      <div class="pct-chip pct-chip-on">体感 ${feel}°C</div>
      <div class="pct-chip">湿度 ${humi}%</div>
    `;

    localStorage.setItem('luna_weather_realtime', JSON.stringify({
      city: pcCity, desc: finalDesc, temp, feel, humi,
      updatedAt: new Date().toISOString()
    }));
    pcSaveState();

  } catch(e) {
    if (chips) chips.innerHTML = '<div class="pct-chip">获取失败，请检查网络</div>';
  }
}

function pcSave() {
  pcSaveState();
  showToast('感知设置已保存 ✓');
}

/* ================================================================
   双语模式设置
================================================================ */
const BL_CODE = {
  css: `<span class="ck">.bubble</span>              <span class="cc">/* 对方消息气泡 */</span>
<span class="ck">.bubble.bubble-self</span>    <span class="cc">/* 己方消息气泡 */</span>
<span class="ck">.bubble.char-bubble</span>    <span class="cc">/* 角色专属气泡 */</span>

<span class="ck">.trans-inner</span>           <span class="cc">/* 内嵌译文（隐藏） */</span>
<span class="ck">.trans-inner.show</span>      <span class="cc">/* 内嵌译文（展开） */</span>
<span class="ck">.trans-text</span>            <span class="cc">/* 译文正文 */</span>
<span class="ck">.trans-lang-tag</span>        <span class="cc">/* 语言标签「粤」*/</span>

<span class="ck">.trans-outer</span>           <span class="cc">/* 外挂译文泡（隐藏） */</span>
<span class="ck">.trans-outer.show</span>      <span class="cc">/* 外挂译文泡（展开） */</span>
<span class="ck">.trans-connector</span>       <span class="cc">/* 连接线 */</span>`,
  vars: `<span class="cv">--bubble-bg</span>            <span class="cc">/* 气泡背景色 */</span>
<span class="cv">--bubble-border</span>        <span class="cc">/* 气泡边框色 */</span>
<span class="cv">--bubble-radius</span>        <span class="cc">/* 气泡圆角 */</span>
<span class="cv">--bubble-text</span>          <span class="cc">/* 气泡文字色 */</span>
<span class="cv">--bubble-font-size</span>     <span class="cc">/* 气泡字号 */</span>

<span class="cv">--trans-bg</span>             <span class="cc">/* 译文区背景 */</span>
<span class="cv">--trans-text</span>           <span class="cc">/* 译文文字色 */</span>
<span class="cv">--trans-border</span>         <span class="cc">/* 译文区边框 */</span>
<span class="cv">--trans-tag-bg</span>         <span class="cc">/* 语言标签背景 */</span>
<span class="cv">--trans-tag-text</span>       <span class="cc">/* 语言标签文字 */</span>`,
  example: `<span class="cc">/* 自定义气泡为深色圆润风格 */</span>
<span class="ck">.bubble</span> {
  <span class="cv">--bubble-bg</span>: <span class="cv">#1a1a1a</span>;
  <span class="cv">--bubble-text</span>: <span class="cv">#f0f0f0</span>;
  <span class="cv">--bubble-radius</span>: <span class="cv">20px</span>;
  border: none;
}
<span class="cc">/* 自定义语言标签颜色 */</span>
<span class="ck">.trans-lang-tag</span> {
  background: <span class="cv">#111</span>;
  color: <span class="cv">#fff</span>;
}`
};

function blSetMode(mode) {
  document.getElementById('blModeOn').classList.toggle('pct-mode-on', mode === 'on');
  document.getElementById('blModeOff').classList.toggle('pct-mode-on', mode === 'off');
  document.getElementById('blHint').textContent = mode === 'on'
    ? '已开启：角色对话将附带选定语言的翻译，点击气泡展开或收起。'
    : '已关闭：角色对话不显示翻译内容。';
  const c = document.getElementById('blContent');
  c.style.opacity = mode === 'on' ? '1' : '0.38';
  c.style.pointerEvents = mode === 'on' ? 'auto' : 'none';
  blSaveState();
}

function blToggleLang() {
  const t = document.getElementById('blLangToggle');
  const on = t.classList.toggle('pct-toggle-on');
  t.classList.toggle('pct-toggle-off', !on);
  const item = document.getElementById('blItemLang');
  item.classList.toggle('pct-icon-on', on);
  item.classList.toggle('pct-icon-off', !on);
  document.getElementById('blLangChips').querySelectorAll('.pct-chip').forEach(c => {
    c.classList.toggle('pct-chip-on', on);
  });
  blSaveState();
}

function blSelLang(el, name, sub) {
  document.querySelectorAll('.lang-chip').forEach(c => c.classList.remove('lc-on'));
  el.classList.add('lc-on');
  document.getElementById('blSelLangChip').textContent = name;
  document.getElementById('blSelLangSub').textContent = sub;
  blSaveState();
}

function blSelStyle(s) {
  document.getElementById('blStyleInner').classList.toggle('sc-on', s === 'inner');
  document.getElementById('blStyleOuter').classList.toggle('sc-on', s === 'outer');
  blSaveState();
}

function blTab(el, key) {
  document.querySelectorAll('.code-tab').forEach(t => t.classList.remove('ct-on'));
  el.classList.add('ct-on');
  document.getElementById('blCodePane').innerHTML = BL_CODE[key];
}

function blSaveState() {
  localStorage.setItem('luna_bilingual', JSON.stringify({
    mode: document.getElementById('blModeOn').classList.contains('pct-mode-on') ? 'on' : 'off',
    lang: document.getElementById('blSelLangChip').textContent,
    langSub: document.getElementById('blSelLangSub').textContent,
    style: document.getElementById('blStyleInner').classList.contains('sc-on') ? 'inner' : 'outer'
  }));
  localStorage.setItem('luna_bilingual_update', Date.now().toString());
}

function blLoadState() {
  try {
    const saved = JSON.parse(localStorage.getItem('luna_bilingual') || '{}');
    if (saved.mode === 'off') blSetMode('off');
    if (saved.lang) {
      document.getElementById('blSelLangChip').textContent = saved.lang;
      document.getElementById('blSelLangSub').textContent = saved.langSub || '';
      // 同步网格高亮
      document.querySelectorAll('.lang-chip').forEach(el => {
        const nameEl = el.childNodes[0];
        const match = nameEl && nameEl.textContent && nameEl.textContent.trim() === saved.lang;
        el.classList.toggle('lc-on', match);
      });
    }
    if (saved.style) blSelStyle(saved.style);
  } catch(e) {}
}

function blSave() {
  blSaveState();
  showToast('双语设置已保存 ✓');
}

document.addEventListener('DOMContentLoaded', function() {
  blLoadState();
});
/* ================================================================
   自定义气泡样式 — CSS编辑器 · 实时预览 · IndexedDB 预设库
================================================================ */

/* ── IndexedDB 预设库 ── */
const BL_DB_NAME    = 'LunaBubblePresetsDB';
const BL_DB_VERSION = 1;
const BL_STORE      = 'presets';

function blOpenDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BL_DB_NAME, BL_DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(BL_STORE)) {
        const store = db.createObjectStore(BL_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = () => reject(req.error);
  });
}

async function blGetAllPresets() {
  const db = await blOpenDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(BL_STORE, 'readonly');
    const req = tx.objectStore(BL_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  });
}

async function blSavePreset(name, css) {
  const db = await blOpenDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(BL_STORE, 'readwrite');
    const req = tx.objectStore(BL_STORE).add({
      name,
      css,
      createdAt: Date.now(),
      charCount: css.length
    });
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function blDeletePreset(id) {
  const db = await blOpenDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(BL_STORE, 'readwrite');
    const req = tx.objectStore(BL_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

/* ── 行号同步 ── */
function blSyncLineNums() {
  const ta    = document.getElementById('blCssInput');
  const nums  = document.getElementById('blLineNums');
  if (!ta || !nums) return;
  const lines = ta.value.split('\n').length;
  let html = '';
  for (let i = 1; i <= lines; i++) html += i + '\n';
  nums.textContent = html;
  // 同步滚动
  nums.scrollTop = ta.scrollTop;
}

/* ── 字符统计 ── */
function blUpdateCharCount() {
  const ta = document.getElementById('blCssInput');
  const el = document.getElementById('blCharCount');
  if (!ta || !el) return;
  el.textContent = ta.value.length + ' 字符';
}

/* ── CSS 验证（简单检测括号平衡）── */
function blValidateCss(css) {
  if (!css.trim()) return true;
  let open = 0;
  for (const c of css) {
    if (c === '{') open++;
    else if (c === '}') open--;
    if (open < 0) return false;
  }
  return open === 0;
}

/* ── 实时更新（输入时触发）── */
let _blDebounceTimer = null;
function blCssLiveUpdate() {
  blSyncLineNums();
  blUpdateCharCount();

  clearTimeout(_blDebounceTimer);
  const statusEl = document.getElementById('blCssStatus');
  if (statusEl) { statusEl.textContent = '· 输入中…'; statusEl.className = 'css-status'; }

  _blDebounceTimer = setTimeout(() => {
    const css = document.getElementById('blCssInput')?.value || '';
    const valid = blValidateCss(css);
    if (statusEl) {
      statusEl.textContent = valid ? '· 样式正常' : '· 括号不匹配';
      statusEl.className   = 'css-status ' + (valid ? 'ok' : 'err');
    }
    // 注入到预览的 style 标签
    const styleEl = document.getElementById('blCustomStyle');
    if (styleEl) {
      // 将用户的 CSS 限制在预览区内，避免污染全局
      styleEl.textContent = valid && css.trim()
        ? '#blPreviewStage ' + css.replace(/}/g, '}\n#blPreviewStage ').replace(/\n#blPreviewStage\s*$/, '')
        : '';
    }
    // 保存到 localStorage
    localStorage.setItem('luna_bubble_css', css);
    localStorage.setItem('luna_bubble_css_update', Date.now().toString());
  }, 300);
}

/* ── 整理 CSS（简单美化）── */
function blCssFormat() {
  const ta = document.getElementById('blCssInput');
  if (!ta) return;
  let css = ta.value;
  // 展开压缩 CSS
  css = css
    .replace(/\s*{\s*/g, ' {\n  ')
    .replace(/;\s*/g, ';\n  ')
    .replace(/\s*}\s*/g, '\n}\n')
    .replace(/\n\s+\n/g, '\n')
    .trim();
  ta.value = css;
  blCssLiveUpdate();
}

/* ── 清空 ── */
function blCssClear() {
  const ta = document.getElementById('blCssInput');
  if (!ta) return;
  if (ta.value && !confirm('确定清空所有 CSS 内容吗？')) return;
  ta.value = '';
  blCssLiveUpdate();
}

/* ── 预览 Tab 切换 ── */
function blPrevTab(mode) {
  document.getElementById('prevTabInner').classList.toggle('css-prev-tab-on', mode === 'inner');
  document.getElementById('prevTabOuter').classList.toggle('css-prev-tab-on', mode === 'outer');
  document.getElementById('prevInner').style.display = mode === 'inner' ? '' : 'none';
  document.getElementById('prevOuter').style.display = mode === 'outer' ? '' : 'none';
}

/* ── 显示/隐藏 保存弹层 ── */
function blShowSavePreset() {
  const ta = document.getElementById('blCssInput');
  if (!ta || !ta.value.trim()) {
    showToast('请先输入 CSS 内容再保存');
    return;
  }
  const panel = document.getElementById('blSavePanel');
  if (panel) { panel.style.display = ''; }
  const input = document.getElementById('blPresetNameInput');
  if (input) { input.value = ''; input.focus(); }
}

function blHideSavePreset() {
  const panel = document.getElementById('blSavePanel');
  if (panel) panel.style.display = 'none';
}

/* ── 确认保存预设 ── */
async function blConfirmSavePreset() {
  const nameInput = document.getElementById('blPresetNameInput');
  const name = nameInput?.value?.trim();
  if (!name) { showToast('请输入预设名称'); return; }

  const ta  = document.getElementById('blCssInput');
  const css = ta?.value?.trim() || '';
  if (!css) { showToast('CSS 内容不能为空'); return; }

  try {
    await blSavePreset(name, css);
    blHideSavePreset();
    await blRenderPresets();
    showToast('预设「' + name + '」已保存 ✓');
  } catch(e) {
    showToast('保存失败，请重试');
  }
}

/* ── 渲染预设列表 ── */
let _blActivePresetId = null;

async function blRenderPresets() {
  const list  = document.getElementById('blPresetList');
  const empty = document.getElementById('blPresetEmpty');
  if (!list) return;

  let presets = [];
  try { presets = await blGetAllPresets(); } catch(e) {}

  // 按创建时间倒序
  presets.sort((a, b) => b.createdAt - a.createdAt);

  if (!presets.length) {
    list.innerHTML = '';
    list.appendChild(empty || makeEmptyEl());
    return;
  }

  list.innerHTML = '';
  presets.forEach(p => {
    const card = document.createElement('div');
    card.className = 'css-preset-card' + (_blActivePresetId === p.id ? ' preset-active' : '');
    card.dataset.id = p.id;

    const date = new Date(p.createdAt);
    const dateStr = date.getMonth()+1 + '/' + date.getDate() + ' '
      + String(date.getHours()).padStart(2,'0') + ':' + String(date.getMinutes()).padStart(2,'0');

    card.innerHTML = `
      <div class="css-preset-card-left" onclick="blLoadPreset(${p.id})">
        <div class="css-preset-dot"></div>
        <div>
          <div class="css-preset-name">${escHtml(p.name)}</div>
          <div class="css-preset-meta">${p.charCount || 0}字符 · ${dateStr}</div>
        </div>
      </div>
      <div class="css-preset-card-right">
        <button class="css-preset-use-btn" onclick="blLoadPreset(${p.id})">应用</button>
        <button class="css-preset-del-btn" onclick="blDeletePresetConfirm(${p.id}, '${escHtml(p.name)}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>
    `;
    list.appendChild(card);
  });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── 应用预设到编辑器 ── */
async function blLoadPreset(id) {
  let presets = [];
  try { presets = await blGetAllPresets(); } catch(e) {}
  const p = presets.find(x => x.id === id);
  if (!p) return;

  const ta = document.getElementById('blCssInput');
  if (ta) { ta.value = p.css; }
  _blActivePresetId = id;
  blCssLiveUpdate();
  await blRenderPresets();
  showToast('已应用预设「' + p.name + '」');
}

/* ── 删除预设 ── */
async function blDeletePresetConfirm(id, name) {
  if (!confirm('确定删除预设「' + name + '」吗？')) return;
  try {
    await blDeletePreset(id);
    if (_blActivePresetId === id) _blActivePresetId = null;
    await blRenderPresets();
    showToast('预设已删除');
  } catch(e) {
    showToast('删除失败，请重试');
  }
}

/* ── 初始化：恢复上次的 CSS + 加载预设 ── */
async function blCssInit() {
  const saved = localStorage.getItem('luna_bubble_css') || '';
  const ta    = document.getElementById('blCssInput');
  if (ta && saved) {
    ta.value = saved;
    blCssLiveUpdate();
  }
  await blRenderPresets();

  // 行号同步滚动
  if (ta) {
    ta.addEventListener('scroll', () => {
      const nums = document.getElementById('blLineNums');
      if (nums) nums.scrollTop = ta.scrollTop;
    });
    // Tab 键缩进支持
    ta.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = ta.selectionStart, end = ta.selectionEnd;
        ta.value = ta.value.substring(0,s) + '  ' + ta.value.substring(end);
        ta.selectionStart = ta.selectionEnd = s + 2;
        blCssLiveUpdate();
      }
    });
    // Enter 键保存弹层
    const nameInput = document.getElementById('blPresetNameInput');
    if (nameInput) {
      nameInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') blConfirmSavePreset();
        if (e.key === 'Escape') blHideSavePreset();
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', blCssInit);
/* ================================================================
   PERSONA PANEL · 角色配对面板
================================================================ */

/* ── 读取角色库（复用 characters.js 的 LunaCharDB）── */
function csOpenCharDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('LunaCharDB', 4);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('chars'))
        db.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}
async function csGetAllChars() {
  try {
    const db = await csOpenCharDB();
    return await new Promise(res => {
      const r = db.transaction('chars').objectStore('chars').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror   = () => res([]);
    });
  } catch(e) { return []; }
}

/* ── 读取身份库（复用 user.js 的 LunaIdentityDB）── */
function csOpenIdentityDB() {
  return new Promise((res, rej) => {
    const probe = indexedDB.open('LunaIdentityDB');
    probe.onsuccess = e => {
      const db = e.target.result;
      const ver = db.version; db.close();
      const req2 = indexedDB.open('LunaIdentityDB', ver);
      req2.onupgradeneeded = ev => {
        if (!ev.target.result.objectStoreNames.contains('identities'))
          ev.target.result.createObjectStore('identities', { keyPath: 'id' });
      };
      req2.onsuccess = ev => res(ev.target.result);
      req2.onerror   = ev => rej(ev.target.error);
    };
    probe.onerror = e => rej(e.target.error);
  });
}
async function csGetAllIdentities() {
  try {
    const db = await csOpenIdentityDB();
    if (!db.objectStoreNames.contains('identities')) return [];
    return await new Promise(res => {
      const r = db.transaction('identities').objectStore('identities').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror   = () => res([]);
    });
  } catch(e) { return []; }
}

/* ── 安全转义 ── */
function csEsc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── 头像 HTML ── */
function csAvatarInner(avatarImg, initial, style) {
  if (avatarImg) return `<img src="${csEsc(avatarImg)}" alt="">`;
  return `<span style="${style || ''}">${initial}</span>`;
}

/* ── 主渲染函数（自动从当前聊天页面同步角色，不需要用户手动选择）── */
async function csRenderPersonaPanel() {
  const bodyEl  = document.getElementById('personaBody');
  const footEl  = document.getElementById('personaFooter');
  const tagDot  = document.getElementById('personaTagDot');
  const tagText = document.getElementById('personaTagText');
  if (!bodyEl || !footEl) return;

  /* ── 从当前聊天页面自动获取角色名（luna_current_chat）── */
  const currentChatName = localStorage.getItem('luna_current_chat') || null;
  const chars           = await csGetAllChars();
  const identities      = await csGetAllIdentities();

  /* 按名字匹配角色（chatroom 用名字标识角色，不用 ID）*/
  const activeChar = currentChatName
    ? chars.find(c => c.name === currentChatName) || null
    : null;

  /* 找绑定的用户身份：identities 里 boundCharId === activeChar.id */
  let boundUser = null;
  if (activeChar) {
    boundUser = identities.find(u => u.boundCharId === activeChar.id && u.active !== false) || null;
    /* 兜底：如果没有按 ID 匹配，再按角色名匹配 */
    if (!boundUser) {
      boundUser = identities.find(u => u.boundCharName === activeChar.name && u.active !== false) || null;
    }
  }

  /* ── 状态标签 ── */
  if (!activeChar) {
    tagDot.className  = 'persona-tag-dot off';
    tagText.textContent = '未激活';
  } else if (boundUser) {
    tagDot.className  = 'persona-tag-dot';
    tagText.textContent = '已配对';
  } else {
    tagDot.className  = 'persona-tag-dot warn';
    tagText.textContent = '未绑定';
  }

  /* ═══════════════════════
     情形 A：未找到角色资料
  ═══════════════════════ */
  if (!activeChar) {
    const hint = currentChatName
      ? `「${csEsc(currentChatName)}」尚未在角色库中建档`
      : '请从聊天页面进入此设置';
    bodyEl.innerHTML = `
      <div class="pn-no-char">
        <div class="pn-no-char-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </div>
        <div class="pn-no-char-text">
          <div class="pn-no-char-title">${currentChatName ? csEsc(currentChatName) : '暂无聊天角色'}</div>
          <div class="pn-no-char-sub">${hint}</div>
        </div>
      </div>
    `;
    footEl.innerHTML = `
      <button class="pn-btn" onclick="window.location.href='user.html'">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
        编辑身份
      </button>
      <button class="pn-btn primary" onclick="history.back()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        返回聊天
      </button>
    `;
    return;
  }

  /* ── 通用：角色头像 + 特征标签 ── */
  const charInitial = activeChar.name ? activeChar.name[0] : '?';
  const charAvHtml  = (activeChar.avatarImg || activeChar.avatar)
    ? `<img src="${csEsc(activeChar.avatarImg || activeChar.avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : charInitial;

  const traits  = (Array.isArray(activeChar.traits)
    ? activeChar.traits
    : (activeChar.traits || '').split(','))
    .map(s => String(s).trim()).filter(Boolean).slice(0, 4);
  /* 简介截取（persona / description / desc 字段）*/
  const charDesc = (activeChar.persona || activeChar.description || activeChar.desc || '').trim();

  /* ═══════════════════════
     情形 B：有角色 + 有绑定用户
  ═══════════════════════ */
  if (boundUser) {
    const userInitial = boundUser.name ? boundUser.name[0].toUpperCase() : '?';
    const userAvHtml  = (boundUser.avatarImg || boundUser.avatar)
      ? `<img src="${csEsc(boundUser.avatarImg || boundUser.avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
      : userInitial;

    bodyEl.innerHTML = `
      <div class="pn-avatars">
        <div class="pn-char-av">
          ${charAvHtml}
          <div class="pn-char-av-dot"></div>
        </div>
        <div class="pn-user-av">${userAvHtml}</div>
      </div>
      <div class="pn-combined-name">${csEsc(activeChar.name)} <em>&amp;</em> ${csEsc(boundUser.name || '未命名')}</div>
      <div class="pn-combined-sub">${csEsc(activeChar.role || 'AI 角色')} · 角色与用户已配对</div>
      <div class="pn-tags">
        ${traits.map(t => `<span class="pn-tag">${csEsc(t)}</span>`).join('')}
        ${(boundUser.tags || []).slice(0, 2).map(t => `<span class="pn-tag user-tag">${csEsc(t)}</span>`).join('')}
      </div>

      <!-- 角色资料卡 -->
      <div class="pn-profile-card">
        <div class="pn-profile-card-eyebrow">角色资料卡 · CHAR PROFILE</div>
        ${charDesc ? `<div class="pn-profile-desc">${csEsc(charDesc.slice(0, 90))}${charDesc.length > 90 ? '…' : ''}</div>` : ''}
        <div class="pn-info-row">
          <div class="pn-info-cell">
            <div class="pn-info-key">AI 角色</div>
            <div class="pn-info-val">${csEsc(activeChar.name)}</div>
          </div>
          <div class="pn-info-cell">
            <div class="pn-info-key">绑定用户</div>
            <div class="pn-info-val" style="color:#8899cc">${csEsc(boundUser.name || '未命名')}</div>
          </div>
          ${activeChar.age ? `<div class="pn-info-cell">
            <div class="pn-info-key">年龄</div>
            <div class="pn-info-val">${csEsc(activeChar.age)}</div>
          </div>` : ''}
          ${activeChar.role ? `<div class="pn-info-cell">
            <div class="pn-info-key">定位</div>
            <div class="pn-info-val">${csEsc(activeChar.role)}</div>
          </div>` : ''}
        </div>
      </div>
    `;
    footEl.innerHTML = `
      <button class="pn-btn" onclick="window.location.href='user.html'">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
        编辑用户身份
      </button>
      <button class="pn-btn primary" onclick="history.back()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        返回聊天
      </button>
    `;
    return;
  }

  /* ═══════════════════════
     情形 C：有角色 + 无绑定用户
  ═══════════════════════ */
  bodyEl.innerHTML = `
    <div class="pn-avatars">
      <div class="pn-char-av">
        ${charAvHtml}
        <div class="pn-char-av-dot"></div>
      </div>
      <div class="pn-user-av" style="background:#f5f5f5;color:#d0d0d0">?</div>
    </div>
    <div class="pn-combined-name">${csEsc(activeChar.name)} <em>&amp; —</em></div>
    <div class="pn-combined-sub">${csEsc(activeChar.role || 'AI 角色')} · 暂无绑定用户身份</div>
    <div class="pn-tags">
      ${traits.map(t => `<span class="pn-tag">${csEsc(t)}</span>`).join('')}
    </div>

    <!-- 角色资料卡 -->
    <div class="pn-profile-card">
      <div class="pn-profile-card-eyebrow">角色资料卡 · CHAR PROFILE</div>
      ${charDesc ? `<div class="pn-profile-desc">${csEsc(charDesc.slice(0, 90))}${charDesc.length > 90 ? '…' : ''}</div>` : ''}
      <div class="pn-info-row">
        <div class="pn-info-cell">
          <div class="pn-info-key">角色名</div>
          <div class="pn-info-val">${csEsc(activeChar.name)}</div>
        </div>
        ${activeChar.age ? `<div class="pn-info-cell">
          <div class="pn-info-key">年龄</div>
          <div class="pn-info-val">${csEsc(activeChar.age)}</div>
        </div>` : ''}
        ${activeChar.role ? `<div class="pn-info-cell">
          <div class="pn-info-key">定位</div>
          <div class="pn-info-val">${csEsc(activeChar.role)}</div>
        </div>` : ''}
      </div>
    </div>

    <!-- 提示绑定 -->
    <div class="pn-empty-bind" onclick="window.location.href='user.html'">
      <div class="pn-empty-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
        </svg>
      </div>
      <div>
        <div class="pn-empty-title">暂无绑定用户身份</div>
        <div class="pn-empty-sub">前往身份管理页面绑定</div>
      </div>
      <div class="pn-empty-arr">›</div>
    </div>
  `;
  footEl.innerHTML = `
    <button class="pn-btn primary" onclick="window.location.href='user.html'">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      绑定用户身份
    </button>
    <button class="pn-btn" onclick="history.back()">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
      返回聊天
    </button>
  `;
}

/* ── 页面加载时执行 ── */
document.addEventListener('DOMContentLoaded', () => {
  csRenderPersonaPanel();
});

/* ── storage 事件触发刷新 ── */
window.addEventListener('storage', e => {
  if (['luna_current_chat','luna_active_char','luna_identity_update','luna_char_update'].includes(e.key)) {
    csRenderPersonaPanel();
  }
});
/* ================================================================
   世界书设置面板 · WORLD BOOK SETTINGS
================================================================ */

/* ── 初始化：从 localStorage 读取世界书数据，渲染统计 + 条目列表 ── */
function wbSetInit() {
  /* 统计数字 */
  const raw = localStorage.getItem('luna_worldbook');
  const entries = raw ? JSON.parse(raw) : [];
  const active = entries.filter(e => e.enabled !== false).length;
  const types  = [...new Set(entries.map(e => e.cat || '其他'))].length;

  const elCount  = document.getElementById('wbSetStatCount');
  const elActive = document.getElementById('wbSetStatActive');
  const elTypes  = document.getElementById('wbSetStatTypes');
  if (elCount)  elCount.textContent  = String(entries.length).padStart(2,'0');
  if (elActive) elActive.innerHTML   = `<em>${String(active).padStart(2,'0')}</em>`;
  if (elTypes)  elTypes.textContent  = String(types).padStart(2,'0');

  /* 全局开关 */
  const cfg = JSON.parse(localStorage.getItem('luna_wb_config') || '{}');
  const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val !== false; };
  setChk('wbSetEnabled', cfg.enabled);
  setChk('wbSetGlobal',  cfg.global);
  setChk('wbSetTrigger', cfg.trigger !== false);
  setChk('wbSetDedup',   cfg.dedup   !== false);

  /* 注入数量 / token */
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setVal('wbSetMaxEntries', cfg.maxEntries || 10);
  setVal('wbSetMaxToken',   cfg.maxToken   || 2000);

  /* 插入位置 */
  const posMap = { before:'对话前', after:'对话后', system:'系统层' };
  const posEl = document.getElementById('wbSetPosVal');
  if (posEl) posEl.textContent = posMap[cfg.position] || '对话前';

  /* 渲染条目列表 */
  wbSetRenderEntries(entries, 'all');
}

/* ── 渲染条目列表 ── */
function wbSetRenderEntries(entries, cat) {
  const list = document.getElementById('wbSetEntryList');
  if (!list) return;
  const filtered = cat === 'all' ? entries : entries.filter(e => (e.cat || '其他') === cat);
  if (!filtered.length) {
    list.innerHTML = '<div class="wb-entry-empty">暂无条目 · 前往世界书添加</div>';
    return;
  }
  list.innerHTML = filtered.map(e => `
    <div class="wb-entry-card">
      <div>
        <div class="wb-entry-cat">${e.cat || '其他'} · ${catEnMap(e.cat)}</div>
        <div class="wb-entry-name">${e.title || '未命名'}</div>
      </div>
      <div class="wb-entry-dot${e.enabled === false ? ' off' : ''}"></div>
    </div>
  `).join('');
}

function catEnMap(cat) {
  return {地点:'PLACE',势力:'FACTION',事件:'EVENT',规则:'RULE',其他:'OTHER'}[cat] || 'ENTRY';
}

/* ── 分类筛选 ── */
function wbSetFilter(btn) {
  document.querySelectorAll('.wb-filter-btn').forEach(b => b.classList.remove('wb-filter-on'));
  btn.classList.add('wb-filter-on');
  const raw = localStorage.getItem('luna_worldbook');
  const entries = raw ? JSON.parse(raw) : [];
  wbSetRenderEntries(entries, btn.dataset.cat);
}

/* ── 开关同步 ── */
function wbSetSyncToggle(cb, iconId) {
  /* 视觉反馈：图标颜色跟随开关（扩展用） */
}

/* ── 步进器 ── */
function wbStep(id, delta) {
  const el = document.getElementById(id);
  if (!el) return;
  let v = parseInt(el.textContent) + delta;
  v = Math.max(1, Math.min(50, v));
  el.textContent = v;
}
function wbStepToken(delta) {
  const el = document.getElementById('wbSetMaxToken');
  if (!el) return;
  let v = parseInt(el.textContent) + delta;
  v = Math.max(200, Math.min(8000, v));
  el.textContent = v;
}

/* ── 插入位置切换 ── */
function wbTogglePosOpts() {
  const el = document.getElementById('wbPosOpts');
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}
function wbSetPos(opt, label) {
  document.querySelectorAll('.wb-pos-opt').forEach(o => o.classList.remove('wb-pos-on'));
  opt.classList.add('wb-pos-on');
  const el = document.getElementById('wbSetPosVal');
  if (el) el.textContent = label;
  document.getElementById('wbPosOpts').style.display = 'none';
}

/* ── 保存 ── */
function wbSetSave() {
  const posMap = { '对话前':'before','对话后':'after','系统层':'system' };
  const posTxt = document.getElementById('wbSetPosVal')?.textContent || '对话前';
  const cfg = {
    enabled:    document.getElementById('wbSetEnabled')?.checked !== false,
    global:     document.getElementById('wbSetGlobal')?.checked  !== false,
    trigger:    document.getElementById('wbSetTrigger')?.checked !== false,
    dedup:      document.getElementById('wbSetDedup')?.checked   !== false,
    maxEntries: parseInt(document.getElementById('wbSetMaxEntries')?.textContent) || 10,
    maxToken:   parseInt(document.getElementById('wbSetMaxToken')?.textContent)   || 2000,
    position:   posMap[posTxt] || 'before',
  };
  localStorage.setItem('luna_wb_config', JSON.stringify(cfg));
  /* 复用现有保存提示逻辑 */
  const btn = document.querySelector('button[onclick="wbSetSave()"]');
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = '已保存';
    btn.style.background = '#4a9a6a';
    setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 1500);
  }
}

/* ── 点击外部关闭位置选项 ── */
document.addEventListener('click', e => {
  const opts = document.getElementById('wbPosOpts');
  if (!opts) return;
  if (!opts.contains(e.target) && !e.target.closest('.wb-row-item--last')) {
    opts.style.display = 'none';
  }
});

/* ── 页面加载 ── */
document.addEventListener('DOMContentLoaded', () => {
  wbSetInit();
});
/* ── 好友管理模块 JS ── */
(function () {
  const rangeLabels = ['近7天', '近30天', '全部'];

  window.friendUpdateRange = function (v) {
    document.getElementById('friendRangeVal').textContent = rangeLabels[v - 1];
    const pct = ((v - 1) / 2) * 100;
    document.getElementById('friendRangeCtrl').style.background =
      `linear-gradient(90deg,#1a1a1a ${pct}%,#eee ${pct}%)`;
  };

  let holdTimer = null, holdDone = false;

  window.friendStartHold = function () {
    holdDone = false;
    const btn = document.getElementById('friendHoldBtn');
    btn.classList.add('holding');
    holdTimer = setTimeout(function () {
      holdDone = true;
      btn.style.background = '#1a1a1a';
      btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      setTimeout(function () {
        btn.style.background = '';
        btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg><span class="friend-hold-label">长按</span>';
        btn.classList.remove('holding');
      }, 1800);
    }, 1800);
  };

  window.friendStopHold = function () {
    clearTimeout(holdTimer);
    if (!holdDone) {
      document.getElementById('friendHoldBtn').classList.remove('holding');
    }
  };

  let delDone = false;
  window.friendTriggerDel = function () {
    if (delDone) return;
    const el = document.getElementById('friendDelPull');
    el.classList.add('triggered');
    delDone = true;
    setTimeout(function () {
      el.classList.remove('triggered');
      delDone = false;
    }, 2000);
  };

  const blkNotices = [
    '仅屏蔽消息：对方仍可看到你的主页与状态，但无法向你发送消息',
    '屏蔽+隐身：对方看不到你的在线状态，消息也将被屏蔽',
    '完全拉黑：双方互不可见，聊天记录保留但无法再联系'
  ];

  window.friendSelectSeg = function (n) {
    [1, 2, 3].forEach(function (i) {
      document.getElementById('friendSeg' + i).classList.toggle('active', i === n);
    });
    document.getElementById('friendBlkNotice').textContent = blkNotices[n - 1];
  };

  let blkDone = false;
  window.friendTriggerBlk = function () {
    if (blkDone) return;
    blkDone = true;
    const btn = document.getElementById('friendBlkBtn');
    const txt = document.getElementById('friendBlkBtnTxt');
    btn.style.background = '#444';
    txt.textContent = '已拉黑';
    setTimeout(function () {
      btn.style.background = '';
      txt.textContent = '确认拉黑';
      blkDone = false;
    }, 2000);
  };

  /* ── 动态加载当前角色数据填充好友卡片 ── */
  async function friendLoadData() {
    const charName = localStorage.getItem('luna_current_chat') || null;

    /* 角色名显示 */
    const scopeNameEl = document.getElementById('friendScopeName');
    if (scopeNameEl) scopeNameEl.textContent = charName || '当前角色对话';

    /* 头像首字 */
    const initial = charName ? charName[0].toUpperCase() : '?';

    /* 尝试从 LunaCharDB 读头像 */
    let avatarHtml = initial;
    try {
      const charDb = await new Promise((res, rej) => {
        const r = indexedDB.open('LunaCharDB', 4);
        r.onsuccess = e => res(e.target.result);
        r.onerror   = () => rej();
      });
      if (charDb.objectStoreNames.contains('chars') && charName) {
        const chars = await new Promise(res => {
          const r = charDb.transaction('chars').objectStore('chars').getAll();
          r.onsuccess = () => res(r.result || []);
          r.onerror   = () => res([]);
        });
        const found = chars.find(c => c.name === charName);
        const av = found?.avatarImg || found?.avatar || null;
        if (av) {
          avatarHtml = `<img src="${av}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`;
        }
      }
    } catch (e) {}

    /* 设置头像 */
    ['friendDelAvatar', 'friendBlkAvatar'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (avatarHtml !== initial) {
        el.style.padding = '0';
        el.style.overflow = 'hidden';
        el.innerHTML = avatarHtml;
      } else {
        el.style.padding = '';
        el.style.overflow = '';
        el.textContent = initial;
      }
    });

    /* 设置角色名 */
    const displayName = charName || '—';
    const delNameEl  = document.getElementById('friendDelName');
    const blkNameEl  = document.getElementById('friendBlkName');
    if (delNameEl) delNameEl.textContent = displayName;
    if (blkNameEl) blkNameEl.textContent = displayName;

    /* 从 LunaChatDB 读消息数 + 相识天数 */
    let msgCount = 0;
    let daysKnown = 0;
    try {
      const chatDb = await new Promise((res, rej) => {
        const r = indexedDB.open('LunaChatDB');
        r.onsuccess = e => res(e.target.result);
        r.onerror   = () => rej();
      });

      if (charName && chatDb.objectStoreNames.contains('messages')) {
        const msgRecord = await new Promise(res => {
          const r = chatDb.transaction('messages').objectStore('messages').get(charName);
          r.onsuccess = () => res(r.result);
          r.onerror   = () => res(null);
        });
        msgCount = msgRecord?.msgs?.length || 0;
      }

      if (charName && chatDb.objectStoreNames.contains('conv')) {
        const convRecord = await new Promise(res => {
          const r = chatDb.transaction('conv').objectStore('conv').get(charName);
          r.onsuccess = () => res(r.result);
          r.onerror   = () => res(null);
        });
        if (convRecord?.createdAt) {
          daysKnown = Math.floor((Date.now() - convRecord.createdAt) / 86400000);
        }
      }
    } catch (e) {}

    /* 消息数量 */
    const countEl = document.getElementById('friendMsgCount');
    if (countEl) countEl.textContent = msgCount + ' 条';

    /* 进度条（最多显示满，以500条为满） */
    const fillEl = document.getElementById('friendMsgFill');
    if (fillEl) {
      const pct = Math.min(msgCount / 500 * 100, 100);
      fillEl.style.width = pct + '%';
    }

    /* 删除卡：ADDED X DAYS AGO */
    const delDaysEl = document.getElementById('friendDelDays');
    if (delDaysEl) delDaysEl.textContent = `ADDED ${daysKnown} DAYS AGO`;

    /* 删除卡：X 条记录 */
    const delCountEl = document.getElementById('friendDelCount');
    if (delCountEl) delCountEl.textContent = msgCount + ' 条记录';

    /* 拉黑卡：FRIENDSHIP · X DAYS */
    const blkDaysEl = document.getElementById('friendBlkDays');
    if (blkDaysEl) blkDaysEl.textContent = daysKnown;
  }

  /* 暴露给外部调用 */
  window.friendLoadData = friendLoadData;

  /* 页面加载时执行 */
  document.addEventListener('DOMContentLoaded', () => {
    friendLoadData();
  });

  /* luna_current_chat 变化时重新加载 */
  window.addEventListener('storage', e => {
    if (e.key === 'luna_current_chat' || e.key === 'luna_char_update') {
      friendLoadData();
    }
  });
})();
/* ================================================================
   对话风格模块 JS · PERSONA SETTINGS
================================================================ */
(function () {

  /* 回复长度 */
  var lenPreviews = [
    '<div class="ps-bubble"><div class="ps-bline" style="width:55%"></div></div>',
    '<div class="ps-bubble"><div class="ps-bline" style="width:90%"></div><div class="ps-bline" style="width:68%"></div></div>',
    '<div class="ps-bubble"><div class="ps-bline" style="width:90%"></div><div class="ps-bline" style="width:82%"></div><div class="ps-bline" style="width:58%"></div></div><div class="ps-bubble" style="margin-top:5px"><div class="ps-bline" style="width:74%"></div><div class="ps-bline" style="width:48%"></div></div>'
  ];
  window.psSetLen = function (i, el) {
    document.querySelectorAll('.ps-len-seg').forEach(function (s) { s.classList.remove('ps-len-on'); });
    el.classList.add('ps-len-on');
    document.getElementById('psLenPreview').innerHTML = lenPreviews[i];
  };

  /* 主动触达开关 */
  window.psTogglePro = function () {
    var on = document.getElementById('psTog').checked;
    var s = document.getElementById('psProSettings');
    s.style.opacity = on ? '1' : '0.35';
    s.style.pointerEvents = on ? '' : 'none';
  };

  /* 触达频率滑块 */
  var freqLabels = ['几乎不', '偶尔', '适中', '频繁', '很常'];
  window.psUpdateFreq = function (v) {
    var pct = ((v - 1) / 4) * 100;
    document.getElementById('psFreqCtrl').style.background =
      'linear-gradient(90deg,#1a1a1a ' + pct + '%,#eee ' + pct + '%)';
    document.getElementById('psFreqVal').textContent = freqLabels[v - 1];
  };

  /* 免打扰时段格子 */
  var quietHours = new Set([22, 23, 0, 1, 2, 3, 4, 5, 6, 7]);
  var blocksEl = document.getElementById('psTimeBlocks');
  if (blocksEl) {
    for (var h = 0; h < 24; h++) {
      (function (hour) {
        var d = document.createElement('div');
        d.className = 'ps-tb' + (quietHours.has(hour) ? ' ps-quiet' : '');
        d.textContent = hour;
        d.onclick = function () {
          if (quietHours.has(hour)) { quietHours.delete(hour); d.classList.remove('ps-quiet'); }
          else { quietHours.add(hour); d.classList.add('ps-quiet'); }
          psUpdateTimeHint();
        };
        blocksEl.appendChild(d);
      })(h);
    }
  }
  function psUpdateTimeHint() {
    var arr = Array.from(quietHours).sort(function (a, b) { return a - b; });
    var el = document.getElementById('psTimeHint');
    if (!el) return;
    if (!arr.length) { el.textContent = '未设定免打扰时段'; return; }
    var s = arr[0], e = (arr[arr.length - 1] + 1) % 24;
    el.textContent = '已设定 ' + String(s).padStart(2, '0') + ':00 — ' + String(e).padStart(2, '0') + ':00 为免打扰时段';
  }

  /* 称呼管理 */
  var stageDefaults = [['你', '艾莉森'], ['你啊', '小艾'], ['宝贝', '艾']];
  window.psSetStage = function (i, el) {
    document.querySelectorAll('.ps-stage-pill').forEach(function (p) { p.classList.remove('ps-stage-on'); });
    el.classList.add('ps-stage-on');
    document.getElementById('psNameYou').value = stageDefaults[i][0];
    document.getElementById('psNameHer').value = stageDefaults[i][1];
    psUpdateNamePreview();
  };
  window.psUpdateNamePreview = function () {
    var you = document.getElementById('psNameYou').value || '你';
    var her = document.getElementById('psNameHer').value || '她';
    document.getElementById('psNamePreview').innerHTML =
      '她会叫你 <em>「' + you + '」</em>，你叫她 <em>「' + her + '」</em>';
  };

  /* 纪念日添加 */
  window.psAnniAddClick = function () {
    var el = document.getElementById('psAnniAdd');
    el.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> 已添加';
    setTimeout(function () {
      el.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> 添加纪念日';
    }, 2000);
  };

})();