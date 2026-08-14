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

  // 11. 返回按钮 → 用 history.back() 回到来源页面（通常是 chatroom）
  //     之前用 window.location.href = 'chatroom.html' 会强制产生一条新的
  //     历史记录，导致历史栈变成 chat → chatroom → chatsetting → chatroom(新)，
  //     这样在新的 chatroom 页面里再点返回，会退回到 chatsetting 而不是 chat 列表，
  //     形成"点返回回不到 chat 页面"的问题。改用 history.back() 保持历史栈干净，
  //     没有可回退的历史时再兜底跳转到 chatroom.html。
  document.getElementById('csNavBack')?.addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = 'chatroom.html';
    }
  });

  // 12. 取消按钮 → 同样用 history.back()，理由同上
  document.getElementById('csCancelBtn')?.addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = 'chatroom.html';
    }
  });

  // 13. 主题美化卡片 — 跳转到 appearance_settings.html 并携带当前角色 ID
  document.getElementById('themeAppearanceCard')?.addEventListener('click', () => {
    const currentChar = localStorage.getItem('luna_current_chat') || 'default';
    window.location.href = 'appearance_settings.html?char=' + encodeURIComponent(currentChar);
  });
  document.getElementById('themeAppearanceCard') && (
    document.getElementById('themeAppearanceCard').style.cursor = 'pointer'
  );

  /* ── 角色专属记忆 → memory.html ── */
  const memoryCharCard = document.getElementById('memoryCharCard');
  if (memoryCharCard) {
    memoryCharCard.style.cursor = 'pointer';
    memoryCharCard.addEventListener('click', () => {
      const currentChar = localStorage.getItem('luna_current_chat') || '';
      const param = currentChar && currentChar !== 'default'
        ? '?char=' + encodeURIComponent(currentChar)
        : '';
      window.location.href = 'memory.html' + param;
    });
  }

  /* ── 视频记录卡片 → videolog.html（原来这张卡片完全没绑定点击事件，
     点了没反应）。用法和上面的"角色专属记忆"卡片完全一致：把当前角色名
     作为 ?char= 参数带过去，videolog.js 的 vlCharacterId() 会优先读这个
     参数，落地就是"这个角色"名下的视频记录列表，而不是全局记录。 ── */
  const recordVideoCard = document.getElementById('recordVideoCard');
  if (recordVideoCard) {
    recordVideoCard.style.cursor = 'pointer';
    recordVideoCard.addEventListener('click', () => {
      const currentChar = localStorage.getItem('luna_current_chat') || '';
      const param = currentChar && currentChar !== 'default'
        ? '?char=' + encodeURIComponent(currentChar)
        : '';
      window.location.href = 'videolog.html' + param;
    });
  }
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

function blToggleDropdown(forceClose) {
  const list    = document.getElementById('blDropdownList');
  const trigger = document.getElementById('blDropdownTrigger');
  const arrow   = document.getElementById('blDropdownArrow');
  if (!list || !trigger) return;
  const willOpen = forceClose === true ? false : (list.style.display === 'none');
  list.style.display = willOpen ? 'block' : 'none';
  trigger.classList.toggle('open', willOpen);
  if (arrow) arrow.classList.toggle('open', willOpen);
}

// 点击下拉外部区域时自动收起
document.addEventListener('click', function(e) {
  const wrap = document.getElementById('blDropdownWrap');
  if (!wrap) return;
  if (!wrap.contains(e.target)) blToggleDropdown(true);
});

function blSelLang(el, name, sub) {
  document.querySelectorAll('.bl-dropdown-item').forEach(c => c.classList.remove('bl-item-on'));
  el.classList.add('bl-item-on');
  document.getElementById('blSelLangChip').textContent = name;
  document.getElementById('blSelLangSub').textContent = sub;
  const label = document.getElementById('blDropdownLabel');
  if (label) label.textContent = name + ' · ' + sub;
  blToggleDropdown(true); // 选中后自动收起下拉
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
    const raw = localStorage.getItem('luna_bilingual');
    // 未保存过任何记录时，翻译功能默认关闭
    const saved = raw ? JSON.parse(raw) : { mode: 'off' };

    // 语言：先同步选中语言展示与下拉列表高亮，再决定开关状态
    if (saved.lang) {
      document.getElementById('blSelLangChip').textContent = saved.lang;
      document.getElementById('blSelLangSub').textContent = saved.langSub || '';
      document.getElementById('blDropdownLabel').textContent = saved.lang + ' · ' + (saved.langSub || '');
      // 同步下拉列表勾选态
      document.querySelectorAll('.bl-dropdown-item').forEach(el => {
        const nameEl = el.querySelector('.bl-item-name');
        const match = nameEl && nameEl.textContent.trim() === saved.lang;
        el.classList.toggle('bl-item-on', match);
      });
    }

    if (saved.style) blSelStyle(saved.style);

    // 模式开关：默认关闭，仅当明确保存为 'on' 时才开启
    blSetMode(saved.mode === 'on' ? 'on' : 'off');
  } catch(e) {
    blSetMode('off');
  }
}

function blSave() {
  blSaveState();
  showToast('双语设置已保存 ✓');
}

document.addEventListener('DOMContentLoaded', function() {
  blLoadState();
});

/* ================================================================
   生图与语音模型 · 读取「设置 · AI 模型」页写入的 localStorage 配置
   （密钥/端点/服务商等敏感与体积较大的配置，仍沿用 settings.js 的
   luna_image_* / luna_voice_* localStorage，作为唯一数据源）
   但「是否允许在当前角色对话中调用」这个开关是按角色维度的状态，
   与双语设置/气泡预设一样落 IndexedDB，key 为角色 ID，不用全局 key，
   避免切换角色后开关状态互相污染
================================================================ */

// 与 settings.js 的 IMAGE_PROVIDERS 保持一致的展示名映射
const AM_IMAGE_PROVIDER_LABELS = {
  'gpt-image-2': 'GPT Image 2',
  'nano-banana-pro': 'Nano Banana Pro',
  'seedream': 'Seedream',
  'custom': '自定义反代'
};

/* ── IndexedDB：按角色存储模型开关状态 ── */
const AM_DB_NAME    = 'LunaCharModelPrefsDB';
const AM_DB_VERSION = 1;
const AM_STORE      = 'charModelPrefs'; // keyPath: charId

function amOpenDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(AM_DB_NAME, AM_DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(AM_STORE)) {
        db.createObjectStore(AM_STORE, { keyPath: 'charId' });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = () => reject(req.error);
  });
}

function amCurrentCharId() {
  return localStorage.getItem('luna_current_chat') || 'default';
}

async function amGetCharPrefs(charId) {
  const db = await amOpenDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(AM_STORE, 'readonly');
    const req = tx.objectStore(AM_STORE).get(charId);
    req.onsuccess = () => resolve(req.result || { charId, imageEnabled: true, voiceEnabled: true });
    req.onerror   = () => reject(req.error);
  });
}

async function amSetCharPrefs(charId, patch) {
  const db = await amOpenDB();
  const existing = await amGetCharPrefs(charId);
  const merged = Object.assign({}, existing, patch, { charId, updatedAt: Date.now() });
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(AM_STORE, 'readwrite');
    const req = tx.objectStore(AM_STORE).put(merged);
    req.onsuccess = () => resolve(merged);
    req.onerror   = () => reject(req.error);
  });
}

function amGotoSettings(target) {
  // 记录希望展开的目标（设置页可据此自动跳到对应子页面，若未实现则忽略）
  try { sessionStorage.setItem('luna_settings_jump_target', target === 'voice' ? 'voice' : 'image'); } catch(e) {}
  window.location.href = 'settings.html';
}

async function amToggleImage() {
  const btn = document.getElementById('amImageToggle');
  if (btn.classList.contains('am-disabled') || btn.disabled) return;
  const on = !btn.classList.contains('pct-toggle-on');
  btn.classList.toggle('pct-toggle-on', on);
  btn.classList.toggle('pct-toggle-off', !on);
  await amSetCharPrefs(amCurrentCharId(), { imageEnabled: on });
}

async function amToggleVoice() {
  const btn = document.getElementById('amVoiceToggle');
  if (btn.classList.contains('am-disabled') || btn.disabled) return;
  const on = !btn.classList.contains('pct-toggle-on');
  btn.classList.toggle('pct-toggle-on', on);
  btn.classList.toggle('pct-toggle-off', !on);
  await amSetCharPrefs(amCurrentCharId(), { voiceEnabled: on });
}

async function amRenderImageStatus(prefs) {
  const activeId = parseInt(localStorage.getItem('luna_image_active_id')) || null;
  const provider = localStorage.getItem('luna_image_provider') || 'gpt-image-2';
  const cur = JSON.parse(localStorage.getItem('luna_image_current') || '{}');
  const configured = !!activeId;

  const iconWrap  = document.getElementById('amImageIconWrap');
  const desc      = document.getElementById('amImageDesc');
  const chipProv  = document.getElementById('amImageChipProvider');
  const chipExtra = document.getElementById('amImageChipExtra');
  const toggle    = document.getElementById('amImageToggle');

  iconWrap.classList.toggle('am-icon-empty', !configured);

  if (!configured) {
    desc.textContent = '尚未配置，前往设置页接入';
    chipProv.textContent = '未配置';
    chipProv.classList.remove('pct-chip-on');
    chipExtra.style.display = 'none';
    toggle.classList.remove('pct-toggle-on');
    toggle.classList.add('pct-toggle-off', 'am-disabled');
    return;
  }

  const label = AM_IMAGE_PROVIDER_LABELS[provider] || provider;
  desc.textContent = provider === 'custom'
    ? `自定义反代 · ${cur.customModel || '未填模型名'}`
    : `已接入 ${label}，可在对话中生成图片`;
  chipProv.textContent = label;
  chipProv.classList.add('pct-chip-on');

  if (provider === 'custom' && cur.customUrl) {
    try {
      chipExtra.textContent = new URL(cur.customUrl).hostname;
      chipExtra.style.display = '';
      chipExtra.classList.add('pct-chip-on');
    } catch(e) {
      chipExtra.style.display = 'none';
    }
  } else {
    chipExtra.style.display = 'none';
  }

  toggle.classList.remove('am-disabled');
  const on = prefs.imageEnabled !== false; // 默认开启，仅显式存 false 才关闭
  toggle.classList.toggle('pct-toggle-on', on);
  toggle.classList.toggle('pct-toggle-off', !on);
}

async function amRenderVoiceStatus(prefs) {
  const activeId = parseInt(localStorage.getItem('luna_voice_active_id')) || null;
  const model = localStorage.getItem('luna_voice_model') || '';
  const region = localStorage.getItem('luna_voice_region') === 'global' ? '国际版' : '中国版';
  const configured = !!activeId;

  const iconWrap = document.getElementById('amVoiceIconWrap');
  const desc     = document.getElementById('amVoiceDesc');
  const chipModel  = document.getElementById('amVoiceChipModel');
  const chipRegion = document.getElementById('amVoiceChipRegion');
  const toggle   = document.getElementById('amVoiceToggle');

  iconWrap.classList.toggle('am-icon-empty', !configured);

  if (!configured) {
    desc.textContent = '尚未配置，前往设置页接入';
    chipModel.textContent = '未配置';
    chipModel.classList.remove('pct-chip-on');
    chipRegion.style.display = 'none';
    toggle.classList.remove('pct-toggle-on');
    toggle.classList.add('pct-toggle-off', 'am-disabled');
    return;
  }

  desc.textContent = `已接入 ${model || 'MiniMax 语音'}，可在对话中合成语音回复`;
  chipModel.textContent = model || '已配置';
  chipModel.classList.add('pct-chip-on');
  chipRegion.textContent = region;
  chipRegion.style.display = '';
  chipRegion.classList.add('pct-chip-on');

  toggle.classList.remove('am-disabled');
  const on = prefs.voiceEnabled !== false;
  toggle.classList.toggle('pct-toggle-on', on);
  toggle.classList.toggle('pct-toggle-off', !on);
}

async function amLoadState() {
  const charId = amCurrentCharId();
  const prefs = await amGetCharPrefs(charId);
  await amRenderImageStatus(prefs);
  await amRenderVoiceStatus(prefs);
}

document.addEventListener('DOMContentLoaded', () => { amLoadState(); });

// 设置页在另一个标签页改了生图/语音配置时，本页切回前台自动刷新展示
window.addEventListener('storage', (e) => {
  if (!e.key) return;
  if (e.key.startsWith('luna_image_') || e.key.startsWith('luna_voice_')) amLoadState();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') amLoadState();
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

/* ── 读取角色库（复用 characters.js 的 LunaCharDB，不硬编码版本号）── */
function csOpenCharDB() {
  return new Promise((res, rej) => {
    const probe = indexedDB.open('LunaCharDB');
    probe.onupgradeneeded = e => {
      const db0 = e.target.result;
      if (!db0.objectStoreNames.contains('chars'))
        db0.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
    };
    probe.onsuccess = e => {
      const cur = e.target.result;
      const ver = cur.version;
      const hasChars = cur.objectStoreNames.contains('chars');
      cur.close();
      if (hasChars) {
        const req2 = indexedDB.open('LunaCharDB', ver);
        req2.onsuccess = e2 => res(e2.target.result);
        req2.onerror   = e2 => rej(e2.target.error);
      } else {
        const req3 = indexedDB.open('LunaCharDB', ver + 1);
        req3.onupgradeneeded = e3 => {
          const db3 = e3.target.result;
          if (!db3.objectStoreNames.contains('chars'))
            db3.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
        };
        req3.onsuccess = e3 => res(e3.target.result);
        req3.onerror   = e3 => rej(e3.target.error);
      }
    };
    probe.onerror = e => rej(e.target.error);
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
   数据源改为与 worldbook.js 一致的 IndexedDB(LunaWorldBookDB)，
   通过 LunaWorldBookRuntime 共享模块读取，不再使用过时的
   localStorage('luna_worldbook') 缓存，避免两边数据不同步。
   所有配置与「单条目开关」均按当前角色 id 单独保存
   （key: luna_wb_config_<charId>），实现「专属于角色」的世界书。
================================================================ */

let _wbSetCharId   = null;   // 当前角色在 LunaCharDB 中的 id
let _wbSetCharName = null;   // 当前角色名（luna_current_chat）
let _wbSetEntries  = [];     // 与当前角色相关的条目缓存（全局条目 + 绑定该角色的条目）
let _wbSetDisabled = [];     // 当前角色下被单独关闭的条目 id 列表

/* ── 打开 LunaCharDB，按名字找到角色 id（与 chatroom.js 的 crLoadCharProfile 逻辑一致） ── */
function wbSetOpenCharDB() {
  return new Promise((resolve, reject) => {
    const probe = indexedDB.open('LunaCharDB');
    probe.onsuccess = e => resolve(e.target.result);
    probe.onerror   = e => reject(e.target.error);
  });
}

async function wbSetResolveCurrentChar() {
  _wbSetCharName = localStorage.getItem('luna_current_chat') || null;
  _wbSetCharId   = null;
  if (!_wbSetCharName) return;
  try {
    const db = await wbSetOpenCharDB();
    if (!db.objectStoreNames.contains('chars')) return;
    const found = await new Promise(res => {
      const r = db.transaction('chars').objectStore('chars').getAll();
      r.onsuccess = () => res((r.result || []).find(c => c.name === _wbSetCharName) || null);
      r.onerror   = () => res(null);
    });
    if (found) _wbSetCharId = found.id;
  } catch (e) { _wbSetCharId = null; }
}

/* ── 初始化：从 IndexedDB 读取世界书数据（按当前角色过滤），渲染统计 + 条目列表 ──
   注：不再管「全局作用范围」「关键词触发扫描」「插入位置」——这些已经是
   每条目自己的 mode / pos 字段在决定，这里重复设一层总开关只会互相打架，
   已删除对应 UI 与字段，这个面板现在只做「角色绑定」这一件事：
   角色总开关 enabled、去重 dedup、注入上限 maxEntries/maxToken、
   以及逐条目在本角色下的启用/禁用（disabledIds）。 */
async function wbSetInit() {
  await wbSetResolveCurrentChar();

  if (!window.LunaWorldBookRuntime) {
    // 极端情况下 worldbook-runtime.js 未加载，直接给出空态，不再报错阻塞其它设置模块
    wbSetRenderEntries([], 'all');
    return;
  }

  const cfg = window.LunaWorldBookRuntime.getConfig(_wbSetCharId);
  _wbSetDisabled = cfg.disabledIds || [];

  // 与当前角色相关的条目：全局条目 + 专属该角色绑定的条目
  _wbSetEntries = await window.LunaWorldBookRuntime.getForChar(_wbSetCharId);

  /* 统计数字（仅统计该角色可见的条目，而不是世界书里的全部条目） */
  const active = _wbSetEntries.filter(e => e.enabled !== false && !_wbSetDisabled.includes(e.id)).length;
  const types  = [...new Set(_wbSetEntries.map(e => e.cat || '其他'))].length;

  const elCount  = document.getElementById('wbSetStatCount');
  const elActive = document.getElementById('wbSetStatActive');
  const elTypes  = document.getElementById('wbSetStatTypes');
  if (elCount)  elCount.textContent  = String(_wbSetEntries.length).padStart(2,'0');
  if (elActive) elActive.innerHTML   = `<em>${String(active).padStart(2,'0')}</em>`;
  if (elTypes)  elTypes.textContent  = String(types).padStart(2,'0');

  /* 角色总开关 / 去重 */
  const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val !== false; };
  setChk('wbSetEnabled', cfg.enabled);
  setChk('wbSetDedup',   cfg.dedup);

  /* 注入数量 / token */
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setVal('wbSetMaxEntries', cfg.maxEntries);
  setVal('wbSetMaxToken',   cfg.maxToken);

  /* 角色标识提示：让用户清楚这份设置是绑定到哪个角色的 */
  wbSetRenderCharBadge();

  /* 渲染条目列表 */
  wbSetRenderEntries(_wbSetEntries, 'all');
}

/* ── 顶部角色标识（若页面上已有 hero 区域，插入一行小提示；没有则跳过，不强行改动结构） ── */
function wbSetRenderCharBadge() {
  const hero = document.querySelector('.wb-set-hero-sub');
  if (!hero) return;
  const name = _wbSetCharName || '未选择角色';
  const scope = _wbSetCharId ? `当前绑定角色：${name}` : `未识别到角色，条目将作为全局设置`;
  let badge = document.getElementById('wbSetCharBadge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'wbSetCharBadge';
    badge.style.cssText = 'margin-top:8px;font-size:12px;opacity:0.65;';
    hero.parentNode.insertBefore(badge, hero.nextSibling);
  }
  badge.textContent = scope;
}

/* ── 渲染条目列表（带每条目的启用开关，点击即可单独为当前角色关闭/开启某条世界书） ── */
function wbSetRenderEntries(entries, cat) {
  const list = document.getElementById('wbSetEntryList');
  if (!list) return;
  const filtered = cat === 'all' ? entries : entries.filter(e => (e.cat || '其他') === cat);
  if (!filtered.length) {
    list.innerHTML = '<div class="wb-entry-empty">暂无条目 · 前往世界书添加，或在条目编辑页勾选关联当前角色</div>';
    return;
  }
  const posLabelMap = { before: '对话前', after: '对话后', system: '系统层' };
  list.innerHTML = filtered.map(e => {
    const isOff = e.enabled === false || _wbSetDisabled.includes(e.id);
    const scopeTag = (e.chars && e.chars.length) ? '专属' : '全局';
    const modeTag = e.mode === 'constant' ? '常驻' : '触发';
    const posTag = posLabelMap[e.pos] || '对话前';
    return `
    <div class="wb-entry-card" data-id="${e.id}" onclick="wbSetToggleEntry(${e.id})" style="cursor:pointer">
      <div>
        <div class="wb-entry-cat">${e.cat || '其他'} · ${catEnMap(e.cat)} · ${scopeTag} · ${modeTag} · ${posTag}</div>
        <div class="wb-entry-name">${(e.title || '未命名').replace(/</g,'&lt;')}</div>
      </div>
      <div class="wb-entry-dot${isOff ? ' off' : ''}"></div>
    </div>`;
  }).join('');
}

/* ── 点击条目卡片：切换该条目在「当前角色」下的启用状态（不影响其它角色/全局原始 enabled 字段） ── */
function wbSetToggleEntry(id) {
  const idx = _wbSetDisabled.indexOf(id);
  if (idx >= 0) _wbSetDisabled.splice(idx, 1);
  else _wbSetDisabled.push(id);
  const activeFilter = document.querySelector('.wb-filter-btn.wb-filter-on')?.dataset.cat || 'all';
  wbSetRenderEntries(_wbSetEntries, activeFilter);
}

function catEnMap(cat) {
  return {人物:'CHAR',地点:'PLACE',势力:'FACTION',事件:'EVENT',关系:'REL',物品:'ITEM',规则:'RULE',其他:'OTHER'}[cat] || 'ENTRY';
}

/* ── 分类筛选 ── */
function wbSetFilter(btn) {
  document.querySelectorAll('.wb-filter-btn').forEach(b => b.classList.remove('wb-filter-on'));
  btn.classList.add('wb-filter-on');
  wbSetRenderEntries(_wbSetEntries, btn.dataset.cat);
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

/* ── 保存：写入 luna_wb_config_<charId>，实现「保存后专属于该角色」
   注：global / trigger / position 字段已删除——这三者本就是条目自身
   mode / pos 的重复，交由每条目自己决定即可，设置页不再管。 ── */
function wbSetSave() {
  const cfg = {
    enabled:     document.getElementById('wbSetEnabled')?.checked !== false,
    dedup:       document.getElementById('wbSetDedup')?.checked   !== false,
    maxEntries:  parseInt(document.getElementById('wbSetMaxEntries')?.textContent) || 10,
    maxToken:    parseInt(document.getElementById('wbSetMaxToken')?.textContent)   || 2000,
    disabledIds: [..._wbSetDisabled],
  };

  if (window.LunaWorldBookRuntime) {
    window.LunaWorldBookRuntime.setConfig(_wbSetCharId, cfg);
  } else {
    // 兜底：即使共享模块未加载也不丢数据
    const key = _wbSetCharId ? `luna_wb_config_${_wbSetCharId}` : 'luna_wb_config_global';
    localStorage.setItem(key, JSON.stringify(cfg));
  }

  // 广播给聊天页：世界书设置变了，若聊天页正开着可以据此判断是否需要重新读取（不强制刷新，避免打断对话）
  try {
    localStorage.setItem('luna_wb_config_update', String(Date.now()));
  } catch (e) {}

  /* 复用现有保存提示逻辑 */
  const btn = document.querySelector('button[onclick="wbSetSave()"]');
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = _wbSetCharId ? `已保存到「${_wbSetCharName}」` : '已保存（全局）';
    btn.style.background = '#4a9a6a';
    setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 1600);
  }
}

/* ================================================================
   数据管理：导出 / 导入 / 清空当前角色条目
   均以「当前角色可见范围」为边界，不触碰其他角色的数据：
   - 导出：只导出当前角色能看到的条目（全局 + 专属该角色）
   - 导入：新条目会自动打上「专属当前角色」标记（chars: [_wbSetCharId]），
     不会污染成全局条目，避免误关联到其它角色身上
   - 清空：不是删库，而是解除「当前角色」与这些条目的关联——
     全局条目会被加入 disabledIds（仅本角色下不再生效），
     专属条目若只绑定了当前角色则物理删除，若同时绑定了别的角色
     则只从 chars[] 里摘掉当前角色，不影响其他角色继续使用
================================================================ */

/* ── 导出：当前角色可见范围内的条目 ── */
async function wbSetExport() {
  if (!window.LunaWorldBookRuntime) { showToast('世界书模块未加载'); return; }
  const entries = await window.LunaWorldBookRuntime.getForChar(_wbSetCharId);
  if (!entries.length) { showToast('当前角色暂无可导出的条目'); return; }

  const payload = {
    app: 'LunaWorldBook',
    version: 2,
    scopeChar: _wbSetCharName || null,
    exportedAt: new Date().toISOString(),
    entries
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  const namePart = _wbSetCharName ? `-${_wbSetCharName}` : '';
  a.href = url;
  a.download = `worldbook${namePart}-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`已导出 ${entries.length} 条条目`);
}

/* ── 导入：触发隐藏的 file input ── */
function wbSetTriggerImport() {
  document.getElementById('wbSetImportFile')?.click();
}

/* ── 导入：解析 JSON，新条目自动关联当前角色，避免误变成全局条目 ── */
function wbSetImport(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const list = Array.isArray(data) ? data : (data.entries || []);
      if (!Array.isArray(list) || !list.length) {
        showToast('文件中没有可导入的条目');
        return;
      }
      if (!window.LunaWorldBookRuntime) {
        showToast('世界书模块未加载，无法导入');
        return;
      }
      let count = 0;
      for (const item of list) {
        const clean = { ...item };
        delete clean.id; // 避免与现有条目 id 冲突，作为新条目导入
        if (!clean.title) continue;
        // 关联到当前角色，而不是变成影响所有角色的全局条目
        clean.chars = _wbSetCharId ? [_wbSetCharId] : (Array.isArray(clean.chars) ? clean.chars : []);
        await window.LunaWorldBookRuntime._saveEntry(clean);
        count++;
      }
      await wbSetInit();
      showToast(_wbSetCharId ? `已导入 ${count} 条，并关联到「${_wbSetCharName}」` : `已导入 ${count} 条`);
    } catch (err) {
      showToast('导入失败，文件格式不正确');
    } finally {
      input.value = '';
    }
  };
  reader.readAsText(file);
}

/* ── 清空当前角色条目：先二次确认，避免误触 ── */
function wbSetClearConfirm() {
  const name = _wbSetCharName || '当前角色';
  if (!confirm(`确定要清空「${name}」下的所有世界书条目关联吗？\n· 全局条目仅在该角色下不再生效，不影响其他角色\n· 仅绑定了该角色的专属条目会被彻底删除\n· 同时绑定了其他角色的专属条目只会解除与该角色的关联\n此操作不可撤销。`)) return;
  wbSetClearForChar();
}

async function wbSetClearForChar() {
  if (!window.LunaWorldBookRuntime) { showToast('世界书模块未加载'); return; }
  const result = await window.LunaWorldBookRuntime.clearForChar(_wbSetCharId);
  await wbSetInit();
  showToast(`已清空「${_wbSetCharName || '当前角色'}」的世界书关联（${result.affected} 条）`);
}

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
      const charDb = await csOpenCharDB();
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

/* ================================================================
   ✦ 聊天记录页 · CHAT ARCHIVE
   -----------------------------------------------------------------
   数据源：IndexedDB「LunaChatDB」
     · messages  { chatKey: 角色名, msgs: [ {role,text,time,ts,...} ] }
     · conv      { name: 角色名, preview, timeVal, createdAt, ... }
   每个好友是完全独立的一条记录：单独查看、单独导出、单独清空，互不影响。
================================================================ */
(function () {

  let _clAll = [];          // [{ name, avatar, msgs, conv }]
  let _clSort = 'recent';
  let _clCurrent = null;    // 当前打开详情的那一条
  let _clDetailFilter = 'all';

  /* ── DB ── */
  function clOpenDB() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('LunaChatDB');
      r.onsuccess = e => res(e.target.result);
      r.onerror = () => rej(new Error('db'));
    });
  }
  function clGetAll(db, store) {
    return new Promise(res => {
      if (!db.objectStoreNames.contains(store)) { res([]); return; }
      const r = db.transaction(store).objectStore(store).getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => res([]);
    });
  }
  function clPut(db, store, obj) {
    return new Promise(res => {
      if (!db.objectStoreNames.contains(store)) { res(false); return; }
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(obj);
      tx.oncomplete = () => res(true);
      tx.onerror = () => res(false);
    });
  }
  function clDel(db, store, key) {
    return new Promise(res => {
      if (!db.objectStoreNames.contains(store)) { res(false); return; }
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => res(true);
      tx.onerror = () => res(false);
    });
  }

  /* ── 状态栏 ── */
  function clTick() {
    const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
    let now;
    try { now = new Date(new Date().toLocaleString('en-US', { timeZone: tz })); }
    catch (e) { now = new Date(); }
    const str = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    ['clTime', 'cldTime'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = str; });
    const pct = parseInt(localStorage.getItem('luna_battery') || '76');
    ['clBatPct', 'cldBatPct'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = pct; });
    ['clBatInner', 'cldBatInner'].forEach(id => {
      const e = document.getElementById(id);
      if (e) { e.style.width = Math.max(0, Math.min(100, pct)) + '%'; e.style.background = pct <= 20 ? '#d05a5a' : '#1a1a1a'; }
    });
  }
  function clIsland() {
    const enabled = localStorage.getItem('luna_island_enabled') === 'true';
    const style = localStorage.getItem('luna_island_style') || 'minimal';
    const map = {
      minimal: '<div style="width:78px;height:22px;border-radius:20px;background:#1a1a1a;"></div>',
      pill: '<div style="width:104px;height:24px;border-radius:20px;background:#1a1a1a;display:flex;align-items:center;justify-content:space-between;padding:0 8px;"><div style="width:8px;height:8px;border-radius:50%;background:#3a3a3a;"></div><div style="width:26px;height:3px;border-radius:2px;background:#3a3a3a;"></div><div style="width:8px;height:8px;border-radius:50%;background:#3a3a3a;"></div></div>',
      dot: '<div style="width:26px;height:26px;border-radius:50%;background:#1a1a1a;"></div>',
      wide: '<div style="width:132px;height:26px;border-radius:20px;background:#1a1a1a;"></div>'
    };
    ['clIsland', 'cldIsland'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (!enabled) { el.style.display = 'none'; el.innerHTML = ''; return; }
      el.style.display = 'flex';
      el.innerHTML = map[style] || map.minimal;
    });
  }

  /* ── 拉黑 / 删除状态 ── */
  function clBlockState() {
    try { return JSON.parse(localStorage.getItem('luna_block_state') || '{}') || {}; } catch (e) { return {}; }
  }
  function clDeleted() {
    try { const l = JSON.parse(localStorage.getItem('luna_deleted_friends') || '[]'); return Array.isArray(l) ? l : []; }
    catch (e) { return []; }
  }

  /* ── 加载数据 ── */
  async function clLoad() {
    let db;
    try { db = await clOpenDB(); } catch (e) { _clAll = []; return; }
    const msgRecs = await clGetAll(db, 'messages');
    const convs = await clGetAll(db, 'conv');
    const convMap = {};
    convs.forEach(c => { convMap[c.name] = c; });

    /* 头像来自 LunaCharDB */
    let avatars = {};
    try {
      const cdb = await new Promise((res, rej) => {
        const r = indexedDB.open('LunaCharDB');
        r.onsuccess = e => res(e.target.result);
        r.onerror = () => rej();
      });
      const chars = await clGetAll(cdb, 'chars');
      chars.forEach(c => { if (c.name) avatars[c.name] = c.avatar || c.avatarImg || null; });
    } catch (e) {}

    _clAll = msgRecs
      .filter(r => r && r.chatKey)
      .map(r => ({
        name: r.chatKey,
        msgs: Array.isArray(r.msgs) ? r.msgs : [],
        conv: convMap[r.chatKey] || null,
        avatar: avatars[r.chatKey] || null
      }));

    /* conv 里有、messages 里没有的角色也列出来（空会话） */
    convs.forEach(c => {
      if (!_clAll.some(x => x.name === c.name)) {
        _clAll.push({ name: c.name, msgs: [], conv: c, avatar: avatars[c.name] || null });
      }
    });
  }

  /* ── 工具 ── */
  function clMsgText(m) {
    if (!m) return '';
    if (m.isMeme) return '[表情包]';
    if (m.isVoice) return '[语音] ' + (m.voiceText || '');
    if (m.isLocation) return '[位置] ' + (m.locName || '');
    if (m.isAiImage || m.imageDesc) return '[图片] ' + (m.imageDesc || '');
    if (m.imageUrl) return '[图片]';
    return m.text || m.content || '';
  }
  function clMsgKind(m) {
    if (!m) return '';
    if (m.isMeme) return '表情';
    if (m.isVoice) return '语音';
    if (m.isLocation) return '位置';
    if (m.isAiImage || m.imageUrl || m.imageDesc) return '图片';
    if (m.role === 'system') return '系统';
    if (m.quote) return '引用';
    return '';
  }
  function clEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function clHl(text, kw) {
    const safe = clEsc(text);
    if (!kw) return safe;
    try {
      const re = new RegExp('(' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      return safe.replace(re, '<span class="cl-hl">$1</span>');
    } catch (e) { return safe; }
  }
  function clLastTs(item) {
    if (item.conv && item.conv.timeVal) return item.conv.timeVal;
    for (let i = item.msgs.length - 1; i >= 0; i--) {
      if (item.msgs[i] && item.msgs[i].ts) return item.msgs[i].ts;
    }
    return 0;
  }
  function clFmtDay(ts) {
    if (!ts) return '更早';
    const d = new Date(ts), n = new Date();
    if (d.toDateString() === n.toDateString()) return '今天';
    const y = new Date(n.getTime() - 86400000);
    if (d.toDateString() === y.toDateString()) return '昨天';
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  function clFmtShort(ts) {
    if (!ts) return '';
    const d = new Date(ts), n = new Date();
    if (d.toDateString() === n.toDateString())
      return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  /* ── 打开 / 关闭 ── */
  async function clOpen() {
    const p = document.getElementById('chatLogPage');
    if (!p) return;
    p.classList.remove('is-closing');
    p.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    clTick(); clIsland();
    await clLoad();
    clRenderList();
  }
  function clClose() {
    const p = document.getElementById('chatLogPage');
    if (!p) return;
    clCloseDetail();
    p.classList.remove('is-open');
    p.classList.add('is-closing');
    document.body.style.overflow = '';
    setTimeout(() => p.classList.remove('is-closing'), 280);
  }

  /* ── 列表渲染 ── */
  function clRenderList() {
    const box = document.getElementById('clList');
    const empty = document.getElementById('clEmpty');
    if (!box) return;

    const kw = ((document.getElementById('clSearchInput') || {}).value || '').trim().toLowerCase();
    const blocks = clBlockState();
    const deleted = clDeleted();

    let list = _clAll.slice();
    if (kw) {
      list = list.filter(it =>
        it.name.toLowerCase().includes(kw) ||
        it.msgs.some(m => clMsgText(m).toLowerCase().includes(kw))
      );
    }
    if (_clSort === 'count') list.sort((a, b) => b.msgs.length - a.msgs.length);
    else if (_clSort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    else list.sort((a, b) => clLastTs(b) - clLastTs(a));

    /* 统计条 */
    const totalMsgs = _clAll.reduce((s, i) => s + i.msgs.length, 0);
    let bytes = 0;
    try { bytes = _clAll.reduce((s, i) => s + JSON.stringify(i.msgs).length, 0); } catch (e) {}
    const setT = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    setT('clStatChars', _clAll.length);
    setT('clStatMsgs', totalMsgs);
    setT('clStatSize', bytes > 1048576 ? (bytes / 1048576).toFixed(1) + 'M' : Math.round(bytes / 1024) + 'K');

    if (!list.length) {
      box.innerHTML = '';
      if (empty) empty.style.display = 'flex';
      return;
    }
    if (empty) empty.style.display = 'none';

    box.innerHTML = list.map((it, idx) => {
      const last = it.msgs.length ? it.msgs[it.msgs.length - 1] : null;
      const preview = last
        ? (last.role === 'mine' ? '我：' : '') + clMsgText(last)
        : (it.conv && it.conv.preview) || '暂无消息';
      const st = blocks[it.name];
      const isDel = deleted.indexOf(it.name) >= 0;
      let tag = '';
      if (isDel) tag = '<span class="cl-itag del">已删除</span>';
      else if (st) tag = '<span class="cl-itag blk">' + (st.by === 'ai' ? 'Ta 拉黑了你' : '已拉黑') + '</span>';

      const av = it.avatar
        ? `<img src="${clEsc(it.avatar)}" alt="">`
        : clEsc((it.name[0] || '?').toUpperCase());

      return `
        <div class="cl-item${st || isDel ? ' is-blocked' : ''}" data-name="${clEsc(it.name)}" style="animation-delay:${(idx * 0.035).toFixed(2)}s">
          <div class="cl-iav">${av}</div>
          <div class="cl-ibody">
            <div class="cl-irow">
              <span class="cl-iname">${clHl(it.name, kw)}</span>${tag}
            </div>
            <div class="cl-ipreview">${clHl(preview.slice(0, 60), kw)}</div>
          </div>
          <div class="cl-imeta">
            <span class="cl-icount">${it.msgs.length}</span>
            <span class="cl-itime">${clFmtShort(clLastTs(it))}</span>
          </div>
        </div>`;
    }).join('');

    box.querySelectorAll('.cl-item').forEach(el => {
      el.addEventListener('click', () => clOpenDetail(el.dataset.name));
    });
  }

  function clSetSort(s) {
    _clSort = s;
    document.querySelectorAll('.cl-sort-btn').forEach(b => b.classList.toggle('on', b.dataset.sort === s));
    clRenderList();
  }

  /* ── 详情 ── */
  function clOpenDetail(name) {
    const it = _clAll.find(x => x.name === name);
    if (!it) return;
    _clCurrent = it;
    _clDetailFilter = 'all';
    document.querySelectorAll('#cldFilter .cl-fbtn').forEach(b => b.classList.toggle('on', b.dataset.f === 'all'));
    const sEl = document.getElementById('cldSearch'); if (sEl) sEl.value = '';

    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('cldName', it.name);
    set('cldTitle', it.name);
    set('cldMono', 'SINGLE ARCHIVE');

    const avEl = document.getElementById('cldAvatar');
    if (avEl) {
      if (it.avatar) { avEl.innerHTML = `<img src="${clEsc(it.avatar)}" alt="">`; }
      else { avEl.textContent = (it.name[0] || '?').toUpperCase(); }
    }

    const mine = it.msgs.filter(m => m.role === 'mine').length;
    const theirs = it.msgs.filter(m => m.role === 'luna').length;
    const tsList = it.msgs.map(m => m.ts).filter(Boolean);
    const days = tsList.length >= 2
      ? Math.max(1, Math.round((Math.max.apply(null, tsList) - Math.min.apply(null, tsList)) / 86400000))
      : (it.conv && it.conv.createdAt ? Math.max(1, Math.floor((Date.now() - it.conv.createdAt) / 86400000)) : 0);

    set('cldTotal', it.msgs.length);
    set('cldMine', mine);
    set('cldTheirs', theirs);
    set('cldDays', days);
    set('cldMeta', (it.conv && it.conv.createdAt
      ? new Date(it.conv.createdAt).toLocaleDateString('zh-CN') + ' 起'
      : '本地归档') + ' · ' + it.msgs.length + ' 条');

    const st = clBlockState()[it.name];
    const isDel = clDeleted().indexOf(it.name) >= 0;
    const badge = document.getElementById('cldBadge');
    if (badge) {
      badge.classList.toggle('blk', !!st || isDel);
      badge.textContent = isDel ? '已删除' : st ? (st.by === 'ai' ? 'Ta 拉黑了你' : '已拉黑') : '正常';
    }

    const d = document.getElementById('clDetail');
    if (d) d.classList.add('is-open');
    clRenderDetail();
  }
  function clCloseDetail() {
    const d = document.getElementById('clDetail');
    if (d) d.classList.remove('is-open');
    _clCurrent = null;
  }
  function clDetailFilter(f) {
    _clDetailFilter = f;
    document.querySelectorAll('#cldFilter .cl-fbtn').forEach(b => b.classList.toggle('on', b.dataset.f === f));
    clRenderDetail();
  }
  function clRenderDetail() {
    const box = document.getElementById('cldTimeline');
    const empty = document.getElementById('cldEmpty');
    if (!box || !_clCurrent) return;
    const kw = ((document.getElementById('cldSearch') || {}).value || '').trim().toLowerCase();

    let msgs = _clCurrent.msgs.slice();
    if (_clDetailFilter === 'mine') msgs = msgs.filter(m => m.role === 'mine');
    else if (_clDetailFilter === 'theirs') msgs = msgs.filter(m => m.role === 'luna');
    else if (_clDetailFilter === 'media') msgs = msgs.filter(m => m.isMeme || m.isVoice || m.imageUrl || m.isAiImage || m.isLocation);
    if (kw) msgs = msgs.filter(m => clMsgText(m).toLowerCase().includes(kw));

    if (!msgs.length) {
      box.innerHTML = '';
      if (empty) empty.style.display = 'flex';
      return;
    }
    if (empty) empty.style.display = 'none';

    let html = '', lastDay = null;
    const who = _clCurrent.name;
    msgs.forEach((m, i) => {
      const day = clFmtDay(m.ts);
      if (day !== lastDay) { html += `<div class="cl-daylabel">${clEsc(day)}</div>`; lastDay = day; }
      const kind = clMsgKind(m);
      html += `
        <div class="cl-msg${m.role === 'mine' ? ' mine' : ''}" style="animation-delay:${Math.min(i * 0.015, 0.4).toFixed(2)}s">
          <div class="cl-msg-head">
            <span class="cl-msg-who">${m.role === 'mine' ? '我' : clEsc(who)}</span>
            <span class="cl-msg-time">${clEsc(m.time || clFmtShort(m.ts))}</span>
          </div>
          <div class="cl-msg-body">${kind ? `<span class="cl-msg-kind">${kind}</span>` : ''}${clHl(clMsgText(m), kw)}</div>
        </div>`;
    });
    box.innerHTML = html;
  }

  /* ── 导出 ── */
  function clDownload(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  }
  function clStamp() {
    const d = new Date();
    return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') +
           '_' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
  }
  function clExportOne() {
    if (!_clCurrent) return;
    clDownload({
      _format: 'luna-chat-archive',
      _version: 1,
      _scope: 'single',
      exportedAt: new Date().toISOString(),
      conversations: [{ name: _clCurrent.name, msgs: _clCurrent.msgs, conv: _clCurrent.conv }]
    }, 'luna_' + _clCurrent.name + '_' + clStamp() + '.json');
    showToast('已导出「' + _clCurrent.name + '」的 ' + _clCurrent.msgs.length + ' 条记录');
  }
  function clExportAll() {
    if (!_clAll.length) { showToast('还没有任何聊天记录'); return; }
    clDownload({
      _format: 'luna-chat-archive',
      _version: 1,
      _scope: 'all',
      exportedAt: new Date().toISOString(),
      blockState: clBlockState(),
      deletedFriends: clDeleted(),
      conversations: _clAll.map(i => ({ name: i.name, msgs: i.msgs, conv: i.conv }))
    }, 'luna_chat_all_' + clStamp() + '.json');
    showToast('已导出 ' + _clAll.length + ' 个会话');
  }

  /* ── 导入（与导出格式对称，支持合并 / 覆盖） ── */
  function clImportAll() {
    const f = document.getElementById('clImportFile');
    if (f) { f.value = ''; f.click(); }
  }
  async function clHandleImport(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
      let data;
      try { data = JSON.parse(e.target.result); }
      catch (err) { showToast('导入失败：不是有效的 JSON 文件'); return; }

      const convs = data && Array.isArray(data.conversations) ? data.conversations : null;
      if (!convs || !convs.length) { showToast('文件里没有可导入的会话'); return; }

      const merge = confirm(
        '共发现 ' + convs.length + ' 个会话。\n\n' +
        '【确定】= 合并导入：与现有记录按时间去重后合并，原有内容不会丢失（推荐）\n' +
        '【取消】= 覆盖导入：同名角色的记录将被文件里的内容整个替换'
      );

      let db;
      try { db = await clOpenDB(); } catch (err) { showToast('数据库打开失败'); return; }

      let added = 0, touched = 0;
      for (const c of convs) {
        if (!c || !c.name || !Array.isArray(c.msgs)) continue;
        const exist = _clAll.find(x => x.name === c.name);
        let finalMsgs;
        if (merge && exist) {
          const seen = new Set(exist.msgs.map(m => (m.ts || '') + '|' + m.role + '|' + clMsgText(m)));
          const extra = c.msgs.filter(m => !seen.has((m.ts || '') + '|' + m.role + '|' + clMsgText(m)));
          finalMsgs = exist.msgs.concat(extra);
          finalMsgs.sort((a, b) => (a.ts || 0) - (b.ts || 0));
          added += extra.length;
        } else {
          finalMsgs = c.msgs.slice();
          added += c.msgs.length;
        }
        await clPut(db, 'messages', { chatKey: c.name, msgs: finalMsgs });
        if (c.conv) {
          const base = (exist && exist.conv) || {};
          await clPut(db, 'conv', Object.assign({}, base, c.conv, { name: c.name }));
        }
        touched++;
      }

      /* 拉黑 / 删除状态一并恢复（仅覆盖导入时） */
      if (!merge && data.blockState) localStorage.setItem('luna_block_state', JSON.stringify(data.blockState));
      if (!merge && data.deletedFriends) localStorage.setItem('luna_deleted_friends', JSON.stringify(data.deletedFriends));
      localStorage.setItem('luna_block_update', Date.now().toString());

      await clLoad();
      clRenderList();
      if (_clCurrent) {
        const again = _clAll.find(x => x.name === _clCurrent.name);
        if (again) clOpenDetail(again.name);
      }
      showToast((merge ? '合并' : '覆盖') + '导入完成：' + touched + ' 个会话 / 新增 ' + added + ' 条');
    };
    reader.readAsText(file);
  }

  /* ── 清空单个角色 ── */
  async function clClearOne() {
    if (!_clCurrent) return;
    const name = _clCurrent.name;
    if (!confirm('确定要清空「' + name + '」的全部聊天记录吗？\n共 ' + _clCurrent.msgs.length + ' 条，删除后无法恢复。\n\n建议先点「导出」做一份备份。')) return;
    let db;
    try { db = await clOpenDB(); } catch (e) { showToast('数据库打开失败'); return; }
    await clPut(db, 'messages', { chatKey: name, msgs: [] });
    const conv = _clCurrent.conv;
    if (conv) await clPut(db, 'conv', Object.assign({}, conv, { preview: '', time: '', timeVal: 0 }));
    await clLoad();
    clRenderList();
    const again = _clAll.find(x => x.name === name);
    if (again) clOpenDetail(name); else clCloseDetail();
    showToast('已清空「' + name + '」的聊天记录');
    try { window.dispatchEvent(new StorageEvent('storage', { key: 'luna_chat_cleared', newValue: name, storageArea: localStorage })); } catch (e) {}
    localStorage.setItem('luna_chat_cleared', name + '|' + Date.now());
  }

  /* ── 对外暴露 ── */
  window.clOpen = clOpen;
  window.clClose = clClose;
  window.clRenderList = clRenderList;
  window.clSetSort = clSetSort;
  window.clOpenDetail = clOpenDetail;
  window.clCloseDetail = clCloseDetail;
  window.clRenderDetail = clRenderDetail;
  window.clDetailFilter = clDetailFilter;
  window.clExportOne = clExportOne;
  window.clExportAll = clExportAll;
  window.clImportAll = clImportAll;
  window.clClearOne = clClearOne;
  window.clReload = async function () { await clLoad(); clRenderList(); };

  document.addEventListener('DOMContentLoaded', function () {
    clTick(); clIsland();
    setInterval(clTick, 1000);

    const f = document.getElementById('clImportFile');
    if (f) f.addEventListener('change', e => clHandleImport(e.target.files && e.target.files[0]));

    /* 「聊天记录」卡片 → 打开归档页 */
    const card = document.getElementById('recordChatCard');
    if (card) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', clOpen);
    }

    /* 「导出 / 导入数据」卡片 → 直接给操作菜单 */
    const dataCard = document.getElementById('recordDataCard');
    if (dataCard) {
      dataCard.style.cursor = 'pointer';
      dataCard.addEventListener('click', async () => {
        await clLoad();
        const pick = prompt(
          '数据管理 —— 输入数字后确定：\n\n' +
          '1 = 导出全部聊天记录（' + _clAll.length + ' 个会话）\n' +
          '2 = 导入聊天记录（支持合并 / 覆盖）\n' +
          '3 = 打开聊天记录归档页\n',
          '1'
        );
        if (pick === '1') clExportAll();
        else if (pick === '2') clImportAll();
        else if (pick === '3') clOpen();
      });
    }
  });

  window.addEventListener('storage', function (e) {
    if (e.key === 'luna_island_update' || e.key === 'luna_island_enabled' || e.key === 'luna_island_style') clIsland();
    if (e.key === 'luna_tz_update' || e.key === 'luna_battery') clTick();
  });
})();


/* ================================================================
   ✦ 好友管理 · 真实逻辑重写
   -----------------------------------------------------------------
   覆盖前面那套只有动画、不动数据的占位实现：
     · 清空聊天记录 —— 按范围真删 IndexedDB
     · 删除好友     —— 写入删除名单，可选连带删除记录
     · 拉黑好友     —— 写入 luna_block_state，聊天页立即同步锁定
================================================================ */
(function () {

  const RANGE_LABELS = ['近7天', '近30天', '全部'];
  let _range = 2;                 // 1=7天 2=30天 3=全部
  let _blkLevel = 1;              // 1/2/3
  let _holdTimer = null, _holdStart = 0;

  function curName() { return localStorage.getItem('luna_current_chat') || ''; }

  function openDB() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('LunaChatDB');
      r.onsuccess = e => res(e.target.result);
      r.onerror = () => rej(new Error('db'));
    });
  }
  function dbGet(db, store, key) {
    return new Promise(res => {
      if (!db.objectStoreNames.contains(store)) { res(null); return; }
      const r = db.transaction(store).objectStore(store).get(key);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => res(null);
    });
  }
  function dbPut(db, store, obj) {
    return new Promise(res => {
      if (!db.objectStoreNames.contains(store)) { res(false); return; }
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(obj);
      tx.oncomplete = () => res(true);
      tx.onerror = () => res(false);
    });
  }
  function dbDel(db, store, key) {
    return new Promise(res => {
      if (!db.objectStoreNames.contains(store)) { res(false); return; }
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => res(true);
      tx.onerror = () => res(false);
    });
  }

  function broadcastBlock() {
    localStorage.setItem('luna_block_update', Date.now().toString());
    try {
      const bc = new BroadcastChannel('luna_block_channel');
      bc.postMessage({ type: 'block-update' });
      bc.close();
    } catch (e) {}
    try {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'luna_block_state',
        newValue: localStorage.getItem('luna_block_state'),
        storageArea: localStorage
      }));
    } catch (e) {}
  }
  function getBlocks() {
    try { return JSON.parse(localStorage.getItem('luna_block_state') || '{}') || {}; } catch (e) { return {}; }
  }
  function setBlocks(o) {
    localStorage.setItem('luna_block_state', JSON.stringify(o));
    broadcastBlock();
  }
  function getDeleted() {
    try { const l = JSON.parse(localStorage.getItem('luna_deleted_friends') || '[]'); return Array.isArray(l) ? l : []; }
    catch (e) { return []; }
  }
  function setDeleted(l) {
    localStorage.setItem('luna_deleted_friends', JSON.stringify(l));
    broadcastBlock();
  }

  /* ── 清除范围 ── */
  window.friendUpdateRange = function (v) {
    _range = parseInt(v);
    const el = document.getElementById('friendRangeVal');
    if (el) el.textContent = RANGE_LABELS[_range - 1];
    const pct = ((_range - 1) / 2) * 100;
    const ctrl = document.getElementById('friendRangeCtrl');
    if (ctrl) ctrl.style.background = `linear-gradient(90deg,#1a1a1a ${pct}%,#eee ${pct}%)`;
  };

  /* ── 长按清空 ── */
  window.friendStartHold = function () {
    const btn = document.getElementById('friendHoldBtn');
    if (!btn) return;
    _holdStart = Date.now();
    btn.classList.add('holding');
    clearTimeout(_holdTimer);
    _holdTimer = setTimeout(doClear, 1800);
  };
  window.friendStopHold = function () {
    clearTimeout(_holdTimer);
    const btn = document.getElementById('friendHoldBtn');
    if (btn) btn.classList.remove('holding');
  };

  async function doClear() {
    const name = curName();
    const btn = document.getElementById('friendHoldBtn');
    if (btn) btn.classList.remove('holding');
    if (!name) { showToast('还没有选择角色'); return; }

    const label = RANGE_LABELS[_range - 1];
    let db;
    try { db = await openDB(); } catch (e) { showToast('数据库打开失败'); return; }
    const rec = await dbGet(db, 'messages', name);
    const msgs = (rec && Array.isArray(rec.msgs)) ? rec.msgs : [];
    if (!msgs.length) { showToast('「' + name + '」还没有聊天记录'); return; }

    /* 计算要保留哪些：有时间戳的按时间判定；没有时间戳的一律视为「更早」 */
    let keep;
    if (_range === 3) {
      keep = [];
    } else {
      const cutoff = Date.now() - (_range === 1 ? 7 : 30) * 86400000;
      keep = msgs.filter(m => !(m && m.ts && m.ts >= cutoff));
    }
    const removeCount = msgs.length - keep.length;

    if (removeCount === 0) {
      showToast('「' + label + '」范围内没有需要清除的记录');
      return;
    }
    if (!confirm(
      '将清除「' + name + '」在' + label + '内的 ' + removeCount + ' 条聊天记录' +
      (keep.length ? '，保留更早的 ' + keep.length + ' 条' : '（全部清空）') +
      '。\n\n此操作不可撤销，建议先到「聊天记录」页导出备份。确定继续吗？'
    )) return;

    await dbPut(db, 'messages', { chatKey: name, msgs: keep });
    const conv = await dbGet(db, 'conv', name);
    if (conv) {
      const last = keep.length ? keep[keep.length - 1] : null;
      await dbPut(db, 'conv', Object.assign({}, conv, {
        preview: last ? (last.text || '') : '',
        time: last ? (last.time || '') : '',
        timeVal: last && last.ts ? last.ts : 0
      }));
    }

    if (btn) {
      btn.style.background = '#1a1a1a';
      btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      setTimeout(() => {
        btn.style.background = '';
        btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg><span class="friend-hold-label">长按</span>';
      }, 1800);
    }
    localStorage.setItem('luna_chat_cleared', name + '|' + Date.now());
    showToast('已清除 ' + removeCount + ' 条记录');
    if (window.friendLoadData) window.friendLoadData();
    if (window.clReload) window.clReload();
  }

  /* ── 删除好友 ── */
  window.friendTriggerDel = async function () {
    const name = curName();
    if (!name) { showToast('还没有选择角色'); return; }
    const el = document.getElementById('friendDelPull');

    let db, count = 0;
    try {
      db = await openDB();
      const rec = await dbGet(db, 'messages', name);
      count = (rec && rec.msgs) ? rec.msgs.length : 0;
    } catch (e) {}

    if (!confirm('确定要删除好友「' + name + '」吗？\n\n· 删除后聊天页会锁定，无法继续对话\n· 该角色会从「信息」列表中隐藏\n· 共 ' + count + ' 条聊天记录\n\n此操作可在下方重新添加回来。')) return;

    const alsoWipe = confirm('是否同时删除这 ' + count + ' 条聊天记录？\n\n【确定】= 一并删除记录（不可恢复）\n【取消】= 仅删除好友，记录保留在归档里');

    if (alsoWipe && db) {
      await dbPut(db, 'messages', { chatKey: name, msgs: [] });
      await dbDel(db, 'conv', name);
    }

    const list = getDeleted();
    if (list.indexOf(name) < 0) list.push(name);
    setDeleted(list);

    /* 删除同时解除拉黑标记，避免状态互相打架 */
    const b = getBlocks();
    if (b[name]) { delete b[name]; setBlocks(b); }

    if (el) {
      el.classList.add('triggered');
      setTimeout(() => el.classList.remove('triggered'), 2200);
    }
    showToast('已删除好友「' + name + '」' + (alsoWipe ? '及其聊天记录' : ''));
    if (window.friendLoadData) window.friendLoadData();
    if (window.clReload) window.clReload();
    friendRefreshCards();
  };

  /* ── 拉黑方式 ── */
  const BLK_NOTICES = [
    '仅屏蔽消息：Ta 仍能看到你的主页与状态，但双方消息不再送达，聊天页输入框会被锁定',
    '屏蔽 + 隐身：Ta 看不到你的在线状态，消息同样被屏蔽，聊天页输入框锁定',
    '完全拉黑：双方互不可见，聊天记录保留在归档里，但无法再联系'
  ];
  window.friendSelectSeg = function (n) {
    _blkLevel = n;
    [1, 2, 3].forEach(i => {
      const el = document.getElementById('friendSeg' + i);
      if (el) el.classList.toggle('active', i === n);
    });
    const t = document.getElementById('friendBlkNotice');
    if (t) t.textContent = BLK_NOTICES[n - 1];
  };

  /* ── 拉黑 / 解除拉黑 ── */
  window.friendTriggerBlk = function () {
    const name = curName();
    if (!name) { showToast('还没有选择角色'); return; }
    const blocks = getBlocks();
    const btn = document.getElementById('friendBlkBtn');
    const txt = document.getElementById('friendBlkBtnTxt');

    if (blocks[name]) {
      if (!confirm('「' + name + '」当前已被拉黑。\n是否解除拉黑，恢复正常聊天？')) return;
      delete blocks[name];
      setBlocks(blocks);
      showToast('已解除对「' + name + '」的拉黑');
    } else {
      const lvTxt = ['仅屏蔽消息', '屏蔽 + 隐身', '完全拉黑'][_blkLevel - 1];
      if (!confirm('确定要以「' + lvTxt + '」的方式拉黑「' + name + '」吗？\n\n拉黑后聊天页的输入框与 AI 回复按钮都会被锁定，直到你解除拉黑。')) return;
      blocks[name] = { by: 'user', level: _blkLevel, ts: Date.now(), reason: lvTxt };
      setBlocks(blocks);
      showToast('已拉黑「' + name + '」· ' + lvTxt);
    }

    if (btn && txt) {
      btn.style.background = '#444';
      txt.textContent = '已更新';
      setTimeout(() => { btn.style.background = ''; friendRefreshCards(); }, 1400);
    }
    friendRefreshCards();
    if (window.clReload) window.clReload();
  };

  /* ── 卡片按钮文案随状态刷新 ── */
  function friendRefreshCards() {
    const name = curName();
    const blocks = getBlocks();
    const deleted = getDeleted();
    const st = blocks[name];
    const isDel = deleted.indexOf(name) >= 0;

    const txt = document.getElementById('friendBlkBtnTxt');
    if (txt) txt.textContent = st ? '解除拉黑' : '确认拉黑';

    const blkSub = document.querySelector('#friendBlockCard .friend-card-sub');
    if (blkSub) blkSub.textContent = st
      ? '当前状态：' + (st.by === 'ai' ? 'Ta 把你拉黑了' : ['仅屏蔽消息', '屏蔽 + 隐身', '完全拉黑'][(st.level || 1) - 1])
      : '选择拉黑方式，拉黑后对方将看不到你的在线状态';

    const delSub = document.querySelector('#friendDeleteCard .friend-card-sub');
    if (delSub) delSub.textContent = isDel
      ? '该好友已被删除，点击下方可从删除名单中恢复'
      : '从好友列表中移除，对方将无法与你发起新对话';

    const pullTxt = document.querySelector('#friendDelPull .friend-pull-txt');
    if (pullTxt) pullTxt.textContent = isDel ? '点击恢复该好友' : '下拉确认删除';

    if (isDel) {
      const pull = document.getElementById('friendDelPull');
      if (pull && !pull._restoreBound) {
        pull._restoreBound = true;
        pull.addEventListener('click', function onRestore(e) {
          if (getDeleted().indexOf(curName()) < 0) return;
          e.stopImmediatePropagation();
          const n = curName();
          if (!confirm('确定要恢复好友「' + n + '」吗？\n恢复后聊天页会解除锁定，可以继续对话。')) return;
          setDeleted(getDeleted().filter(x => x !== n));
          showToast('已恢复好友「' + n + '」');
          friendRefreshCards();
          if (window.clReload) window.clReload();
        }, true);
      }
    }
  }
  window.friendRefreshCards = friendRefreshCards;

  document.addEventListener('DOMContentLoaded', function () {
    window.friendUpdateRange(2);
    window.friendSelectSeg(1);
    setTimeout(friendRefreshCards, 200);
  });
  window.addEventListener('storage', function (e) {
    if (e.key === 'luna_block_state' || e.key === 'luna_deleted_friends' ||
        e.key === 'luna_block_update' || e.key === 'luna_current_chat') {
      friendRefreshCards();
      if (window.friendLoadData) window.friendLoadData();
    }
  });
  try {
    const bc = new BroadcastChannel('luna_block_channel');
    bc.onmessage = function () { friendRefreshCards(); };
  } catch (e) {}
})();


/* ================================================================
   ✦ 感知设置：默认全部关闭
   原实现里三个开关的初始 HTML/变量都是「开」，导致用户从没设置过
   也会被当成已开启。这里在首次进入时统一置为关闭并落库，
   之后完全按用户自己的选择走。
================================================================ */
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    if (localStorage.getItem('luna_perception')) return;   // 已经配置过就不动
    localStorage.setItem('luna_perception', JSON.stringify({
      mode: 'real', weather: false, loc: false, time: false, city: '', lat: null, lng: null
    }));
    localStorage.setItem('luna_perception_update', Date.now().toString());
    setTimeout(function () {
      if (typeof pcLoadState === 'function') { try { pcLoadState(); } catch (e) {} }
    }, 60);
  });
})();