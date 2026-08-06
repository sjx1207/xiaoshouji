/* ================================================
   zhibi-script.js — 执笔启动页
   状态栏 / 灵动岛 / 字体同步逻辑
   100% 一比一复刻 secret.js / chat.js 体系
================================================ */

/* ---- 状态栏：实时时间（复刻 secret.js updateTime）---- */
function updateTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeStr = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const el = document.getElementById('statusTime');
  if (el) el.textContent = timeStr;
}

/* ---- 状态栏：电量（复刻 secret.js updateBattery）---- */
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

/* ---- 灵动岛（一比一复刻 secret.js applyIsland）---- */
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

/* ---- 字体同步（一比一复刻 secret.js applyGlobalFont）---- */
async function applyGlobalFont() {
  const name = localStorage.getItem('luna_font_active_name');
  const id   = parseInt(localStorage.getItem('luna_font_active_id'));
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

/* ---- 监听主页面设置变化，实时同步（复刻 secret.js storage listener）---- */
window.addEventListener('storage', e => {
  if (e.key === 'luna_font_update')   applyGlobalFont();
  if (e.key === 'luna_island_update') applyIsland();
  if (e.key === 'luna_tz_update')     updateTime();
});

/* ================================================
   执笔页面交互逻辑
================================================ */

/* 开始创作 — 打开创作设定面板 */
function zbStart() {
  const btn = document.getElementById('zbBtnStart');
  if (btn) { btn.style.opacity = '0.6'; setTimeout(() => { btn.style.opacity = ''; }, 180); }
  const overlay = document.getElementById('zbsOverlay');
  if (!overlay) return;
  overlay.classList.add('show');
  zbsSyncStatusBar();
  zbsInit();
}

/* 继续上次故事 — 读取存档 */
function zbContinue() {
  const saveData = localStorage.getItem('zhibi_save');
  if (!saveData) {
    /* 无存档时降级为开始创作 */
    zbStart();
    return;
  }
  const btn = document.getElementById('zbBtnContinue');
  if (btn) {
    btn.style.opacity = '0.6';
    setTimeout(() => {
      btn.style.opacity = '';
      /* TODO: 替换为实际的游戏页面路径，并传入存档 */
      /* window.location.href = 'zhibi-game.html?resume=1'; */
      console.log('[执笔] 继续存档', JSON.parse(saveData));
    }, 180);
  }
}

/* ================================================
   初始化
================================================ */
document.addEventListener('DOMContentLoaded', () => {
  updateTime();
  updateBattery();
  applyIsland();
  applyGlobalFont();

  /* 时间每分钟更新一次 */
  setInterval(updateTime, 15000);

  /* 根据是否有存档显示/隐藏继续按钮 */
  const saveData = localStorage.getItem('zhibi_save');
  const continueBtn = document.getElementById('zbBtnContinue');
  if (continueBtn) {
    continueBtn.style.display = saveData ? 'flex' : 'none';
  }
});
/* ================================================
   创作设定面板（zbs 命名空间）
   状态栏 / 灵动岛 / 字体 100% 一比一复刻主页逻辑
================================================ */

/* ---- 同步状态栏内容到 setup 面板 ---- */
function zbsSyncStatusBar() {
  /* 时间 */
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeStr = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const tEl = document.getElementById('zbsStatusTime');
  if (tEl) tEl.textContent = timeStr;

  /* 电量 */
  const pctEl   = document.getElementById('zbsBatPct');
  const innerEl = document.getElementById('zbsBatInner');
  function renderBat(p) {
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
      renderBat(b.level * 100);
      b.addEventListener('levelchange', () => renderBat(b.level * 100));
    });
  } else {
    renderBat(76);
  }

  /* 灵动岛（一比一复刻 applyIsland，目标换为 zbsStatusIsland） */
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const iEl     = document.getElementById('zbsStatusIsland');
  if (iEl) {
    if (!enabled) { iEl.innerHTML = ''; }
    else {
      const styleMap = {
        minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
        glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
        clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="zbsSiClockText">--:--</span></div></div>`,
        pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
        ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
        rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
        music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
        scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
      };
      iEl.innerHTML = styleMap[style] || styleMap.minimal;
      clearInterval(window._zbsClockTimer);
      if (style === 'clock') {
        const tick = () => {
          const t = document.getElementById('zbsSiClockText');
          if (!t) return;
          const now = new Date();
          t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
        };
        tick();
        window._zbsClockTimer = setInterval(tick, 10000);
      }
    }
  }
}

/* 监听主页设置变化，实时同步到 setup 面板 */
window.addEventListener('storage', e => {
  if (e.key === 'luna_island_update' || e.key === 'luna_tz_update') zbsSyncStatusBar();
});

/* ---- 关闭面板 ---- */
function zbsClose() {
  const overlay = document.getElementById('zbsOverlay');
  if (overlay) overlay.classList.remove('show');
}

/* ---- 初始化（幂等，只执行一次） ---- */
let _zbsInited = false;
function zbsInit() {
  if (_zbsInited) return;
  _zbsInited = true;
  zbsGoStep(1);
  zbsRenderChars();
  ['world', 'style', 'story'].forEach(zbsRenderLib);

  /* 单选 chip 组 */
  document.querySelectorAll('.zbs-chips:not(.zbs-chips-multi)').forEach(g => {
    g.addEventListener('click', e => {
      const chip = e.target.closest('.zbs-chip');
      if (!chip || chip.classList.contains('zbs-chip-custom')) return;
      g.querySelectorAll('.zbs-chip').forEach(c => c.classList.remove('on'));
      chip.classList.add('on');
    });
  });

  /* 多选 chip 组（toggle 切换） */
  document.querySelectorAll('.zbs-chips-multi').forEach(g => {
    g.addEventListener('click', e => {
      const chip = e.target.closest('.zbs-chip');
      if (!chip || chip.classList.contains('zbs-chip-custom')) return;
      chip.classList.toggle('on');
    });
  });
}

/* ================================================
   章节规格：字数同步 + 推进速度 + AI 辅助生成
================================================ */

/* 字数注释映射 */
const ZBS_WC_NOTES = [
  [300,  '极短篇幅，快节奏碎片式叙事'],
  [600,  '轻量阅读，适合快餐式剧情推进'],
  [1000, '适合短篇节奏，情节简洁明快'],
  [1400, '适合沉浸式阅读，情节推进适中'],
  [2000, '篇幅充裕，可兼顾情节与细节描写'],
  [2800, '长篇章节，场景与人物刻画更丰富'],
  [3600, '史诗篇幅，适合高潮或关键转折章节'],
  [9999, '超长篇，AI 将全力铺展每个细节'],
];

function zbsWcNote(val) {
  const v = parseInt(val) || 1200;
  for (const [max, note] of ZBS_WC_NOTES) { if (v <= max) return note; }
  return ZBS_WC_NOTES[ZBS_WC_NOTES.length - 1][1];
}

function zbsSyncWcSlider(val) {
  const v = parseInt(val);
  const inp = document.getElementById('zbsWcInput');
  if (inp) inp.value = v;
  const note = document.getElementById('zbsWcNote');
  if (note) note.textContent = zbsWcNote(v);
}

function zbsSyncWcInput(val) {
  const v = Math.max(100, Math.min(9999, parseInt(val) || 1200));
  const slider = document.getElementById('zbsWcSlider');
  if (slider) slider.value = Math.min(4000, Math.max(600, v));
  const note = document.getElementById('zbsWcNote');
  if (note) note.textContent = zbsWcNote(v);
}

/* 情节推进速度 */
const ZBS_PACE_LABELS = ['铺垫细腻', '舒缓叙进', '均衡', '紧凑推进', '极速爽文'];
function zbsOnPaceSlider(val) {
  const el = document.getElementById('zbsPaceVal');
  if (el) el.textContent = ZBS_PACE_LABELS[parseInt(val) - 1] || '均衡';
}

/* AI 辅助生成章节说明 */
async function zbsAiGenChap() {
  const apiCfg = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model  = localStorage.getItem('luna_api_model') || '';
  if (!apiCfg.baseUrl || !apiCfg.apiKey) { zbsShowToast('请先在设置中配置 AI 模型'); return; }
  if (!model) { zbsShowToast('请先在设置中选择模型'); return; }

  const btn = document.getElementById('zbsAiChapBtn');
  const ta  = document.getElementById('zbsChapDesc');

  /* 收集当前章节配置 */
  const wc       = document.getElementById('zbsWcInput')?.value || '1200';
  const choices  = document.querySelector('#zbsChoiceChips .zbs-chip.on')?.textContent?.trim() || '3 个';
  const tones    = [...document.querySelectorAll('#zbsToneChips .zbs-chip.on')].map(c => c.textContent.trim()).join('、') || '热血';
  const struct   = document.getElementById('zbsStructSelVal')?.textContent || '';
  const focuses  = [...document.querySelectorAll('#zbsFocusChips .zbs-chip.on')].map(c => c.textContent.trim()).join('、') || '';
  const pace     = document.getElementById('zbsPaceVal')?.textContent || '均衡';
  const existing = (ta.value || '').trim();

  let prompt = '';
  if (existing) {
    prompt = `你是一名互动小说章节设计师。用户当前章节设定：每章约${wc}字、${choices}选项、基调「${tones}」、结构「${struct}」、内容侧重「${focuses}」、推进速度「${pace}」。\n\n用户已填写的补充说明：\n"${existing}"\n\n请润色完善，使描述更具体、对 AI 更有指导性，80字以内。直接输出，不加标题。`;
  } else {
    prompt = `你是一名互动小说章节设计师。用户当前章节设定：每章约${wc}字、${choices}选项、基调「${tones}」、结构「${struct}」、内容侧重「${focuses}」、推进速度「${pace}」。\n\n请根据这些设置，生成一段精准的章节叙事补充说明，告诉 AI 在写作时需要特别注意的节奏细节、内容边界或特殊规则，70字以内。直接输出，不加标题。`;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="zbs-ai-blink"><span>.</span><span>.</span><span>.</span></span> 生成中';

  try {
    const baseUrl = apiCfg.baseUrl.replace(/\/$/, '');
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiCfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 300 })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const result = (data.choices?.[0]?.message?.content || '').trim();
    if (!result) throw new Error('模型返回内容为空');
    ta.value = result;
    zbsShowToast('生成完成');
  } catch (e) {
    zbsShowToast('生成失败：' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="zbs-ai-dot"></span>AI 辅助生成';
  }
}

/* ---- 步骤切换 ---- */
const ZBS_TOTAL = 5;
let zbsCur = 1;

function zbsRenderDots() {
  const c = document.getElementById('zbsFootDots');
  if (!c) return;
  c.innerHTML = Array.from({ length: ZBS_TOTAL }, (_, i) => {
    const n = i + 1;
    const cls = n < zbsCur ? 'zbs-fd done' : n === zbsCur ? 'zbs-fd on' : 'zbs-fd';
    return `<div class="${cls}"></div>`;
  }).join('');
}

function zbsGoStep(n) {
  document.getElementById('zbsP' + zbsCur)?.classList.remove('on');
  document.getElementById('zbsTab' + zbsCur)?.classList.remove('on');
  zbsCur = n;
  document.getElementById('zbsP' + zbsCur)?.classList.add('on');
  document.getElementById('zbsTab' + zbsCur)?.classList.add('on');
  const stepLbl = document.getElementById('zbsStepLabel');
  if (stepLbl) stepLbl.textContent = zbsCur + ' / ' + ZBS_TOTAL;
  const prog = document.getElementById('zbsProgFill');
  if (prog) prog.style.width = (zbsCur / ZBS_TOTAL * 100) + '%';
  const prev = document.getElementById('zbsBtnPrev');
  if (prev) prev.style.visibility = zbsCur === 1 ? 'hidden' : 'visible';
  const next = document.getElementById('zbsBtnNext');
  if (next) next.textContent = zbsCur === ZBS_TOTAL ? '开始创作' : '下一步';
  const scroll = document.getElementById('zbsScrollArea');
  if (scroll) scroll.scrollTop = 0;
  zbsRenderDots();
}

/* ================================================
   设定完整性判断
   —— 原则：不强制用户填写任何内容，留空即代表用户
   选择交给 AI 自由发挥；这里只检查"已表达意图但
   信息不完整"的情况（例如选了"自定义…"却没写内容），
   并以非阻断的提示告知用户，用户仍可自由选择继续。
================================================ */

/* 检查"自定义选择器"类字段：若用户选中了自定义项，
   但输入框为空，视为意图不完整 */
function zbsCheckCustomSel(selId, inputId) {
  const sel = document.getElementById(selId);
  if (!sel) return null;
  if (sel.dataset.val !== 'custom' && !String(sel.dataset.val || '').startsWith('custom')) return null;
  const val = (document.getElementById(inputId)?.value || '').trim();
  return val ? null : sel;
}

/* 检查"自定义 chip"类字段：若自定义 chip 处于选中状态，
   但输入框为空，视为意图不完整 */
function zbsCheckCustomChip(chipId, inputId) {
  const chip = document.getElementById(chipId);
  if (!chip || !chip.classList.contains('on')) return null;
  const val = (document.getElementById(inputId)?.value || '').trim();
  return val ? null : chip;
}

/* 各步骤的"自定义但未填写"检查项 —— 仅用于提示，不阻止前进 */
const ZBS_STEP_CUSTOM_CHECKS = {
  1: [
    { type: 'type',  id: 'zbsCustomTypeInput', label: '世界类型', wrapId: 'zbsCustomTypeWrap' },
    { type: 'pace',  id: 'zbsPaceCustomInput', label: '叙事节奏', wrapId: 'zbsPaceCustomWrap' },
  ],
  2: [
    { type: 'sel', selId: 'zbsPovSel',   inputId: 'zbsPovCustomInput',   label: '人称视角',   wrapId: 'zbsPovCustomWrap' },
    { type: 'sel', selId: 'zbsFocusSel', inputId: 'zbsFocusCustomInput', label: '聚焦主体',   wrapId: 'zbsFocusCustomWrap' },
    { type: 'chip', chipId: 'zbsDistChipCustom', inputId: 'zbsDistCustomInput', label: '叙述距离', wrapId: 'zbsDistCustomWrap' },
    { type: 'sel', selId: 'zbsNarrSel',  inputId: 'zbsNarrCustomInput',  label: '旁白语气',   wrapId: 'zbsNarrCustomWrap' },
    { type: 'chip', chipId: 'zbsRefChipCustom',  inputId: 'zbsRefCustomInput',  label: '主角称呼方式', wrapId: 'zbsRefCustomWrap' },
    { type: 'chip', chipId: 'zbsMonoChipCustom', inputId: 'zbsMonoCustomInput', label: '内心独白密度', wrapId: 'zbsMonoCustomWrap' },
  ],
  3: [
    { type: 'sel', selId: 'zbsStructSel', inputId: 'zbsStructCustomInput', label: '章节结构偏好', wrapId: 'zbsStructCustomWrap' },
    { type: 'chip', chipId: 'zbsFocusChipCustom', inputId: 'zbsFocusCustomInput', label: '章节内容侧重', wrapId: 'zbsFocusCustomWrap' },
  ],
  4: [
    { type: 'chip', chipId: 'zbsDriveChipCustom', inputId: 'zbsDriveCustomInput', label: '核心驱动力', wrapId: 'zbsDriveCustomWrap' },
    { type: 'sel', selId: 'zbsEndingSel', inputId: 'zbsEndingCustomInput', label: '结局走向', wrapId: 'zbsEndingCustomWrap' },
  ],
};

/* 当前步骤是否存在"自定义但未填写"的字段；若存在则展开
   对应输入框并聚焦，返回提示文案；不存在返回 null */
function zbsFindIncompleteCustom(step) {
  const checks = ZBS_STEP_CUSTOM_CHECKS[step] || [];
  for (const c of checks) {
    let target = null;
    if (c.type === 'sel')  target = zbsCheckCustomSel(c.selId, c.inputId);
    if (c.type === 'chip') target = zbsCheckCustomChip(c.chipId, c.inputId);
    if (c.type === 'type' || c.type === 'pace') {
      const wrap = document.getElementById(c.wrapId);
      if (wrap && wrap.classList.contains('show')) {
        const val = (document.getElementById(c.id)?.value || '').trim();
        if (!val) target = wrap;
      }
    }
    if (target) {
      const wrap = document.getElementById(c.wrapId);
      if (wrap) {
        wrap.classList.add('show');
        setTimeout(() => wrap.querySelector('input')?.focus(), 80);
      }
      return `「${c.label}」选择了自定义，但还没写内容 —— 可以补充，或改选其他选项`;
    }
  }
  return null;
}

function zbsNextStep() {
  /* 仅提示"选了自定义却未填写"的情况，引导用户补充或改选，
     但不阻止前进 —— 是否继续完全由用户决定 */
  const hint = zbsFindIncompleteCustom(zbsCur);
  if (hint) {
    zbsShowToast(hint);
    return;
  }
  if (zbsCur < ZBS_TOTAL) zbsGoStep(zbsCur + 1); else zbsStartCreate();
}
function zbsPrevStep() { if (zbsCur > 1) zbsGoStep(zbsCur - 1); }

/* 开始创作前的整体提示：留空字段完全允许（AI 将自由发挥），
   这里仅在核心设定（世界观 + 故事简介）都为空时给一句轻量提示，
   不阻断，用户可直接再次点击继续 */
let _zbsStartConfirmed = false;
function zbsStartCreate() {
  const worldDesc = (document.getElementById('zbsWorldDesc')?.value || '').trim();
  const storyDesc = (document.getElementById('zbsStoryDesc')?.value || '').trim();

  if (!worldDesc && !storyDesc && !_zbsStartConfirmed) {
    _zbsStartConfirmed = true;
    zbsShowToast('世界观与故事简介均为空，AI 将完全自由创作 —— 再次点击「开始创作」继续');
    return;
  }
  _zbsStartConfirmed = false;

  zbsShowToast('正在启动创作...');
  /* TODO: 收集设定数据，跳转游戏页面 */
  /* window.location.href = 'zhibi-game.html'; */
}

/* ---- Toast ---- */
function zbsShowToast(msg, duration) {
  const t = document.getElementById('zbsToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._toastTimer);
  const d = duration || (msg.includes('失败') || msg.includes('配置') || msg.includes('选择') ? 5000 : 2000);
  t._toastTimer = setTimeout(() => t.classList.remove('show'), d);
}

/* ---- IndexedDB ---- */
const ZBS_DB_NAME = 'ZhibiSetupDB', ZBS_DB_VER = 1;
let _zbsDb = null;
function zbsOpenDB() {
  return new Promise((res, rej) => {
    if (_zbsDb) return res(_zbsDb);
    const r = indexedDB.open(ZBS_DB_NAME, ZBS_DB_VER);
    r.onupgradeneeded = e => {
      const d = e.target.result;
      ['world_lib', 'style_lib', 'story_lib'].forEach(s => {
        if (!d.objectStoreNames.contains(s))
          d.createObjectStore(s, { keyPath: 'id', autoIncrement: true });
      });
    };
    r.onsuccess = e => { _zbsDb = e.target.result; res(_zbsDb); };
    r.onerror = () => rej();
  });
}
async function zbsDbAdd(store, obj) {
  const db = await zbsOpenDB();
  return new Promise((res, rej) => {
    const r = db.transaction(store, 'readwrite').objectStore(store).add(obj);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej();
  });
}
async function zbsDbGetAll(store) {
  const db = await zbsOpenDB();
  return new Promise(res => {
    const r = db.transaction(store).objectStore(store).getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror = () => res([]);
  });
}
async function zbsDbDel(store, id) {
  const db = await zbsOpenDB();
  return new Promise(res => {
    db.transaction(store, 'readwrite').objectStore(store).delete(id).onsuccess = () => res();
  });
}

/* ---- 库配置 ---- */
const ZBS_LIB_CFG = {
  world: { store: 'world_lib', nameId: 'zbsWorldName', descId: 'zbsWorldDesc', pillsId: 'zbsWorldPills' },
  style: { store: 'style_lib', nameId: 'zbsStyleName', descId: 'zbsStyleDesc', pillsId: 'zbsStylePills' },
  story: { store: 'story_lib', nameId: 'zbsStoryName', descId: 'zbsStoryDesc', pillsId: 'zbsStoryPills' },
};
let zbsLibSelected = { world: null, style: null, story: null };

async function zbsRenderLib(type) {
  const cfg = ZBS_LIB_CFG[type];
  const items = await zbsDbGetAll(cfg.store);
  const c = document.getElementById(cfg.pillsId);
  if (!c) return;
  if (!items.length) { c.innerHTML = '<span class="zbs-lib-empty">暂无保存的内容</span>'; return; }
  c.innerHTML = items.map(it => `
    <span class="zbs-lpill${zbsLibSelected[type] === it.id ? ' sel' : ''}"
      onclick="zbsSelectLib('${type}',${it.id},'${it.name.replace(/'/g,"\\'")}','${(it.desc||'').replace(/'/g,"\\'").replace(/\n/g,'\\n')}')">
      ${it.name}
      <span class="zbs-lpill-del" onclick="event.stopPropagation();zbsDelLib('${type}',${it.id})">x</span>
    </span>
  `).join('');
}

function zbsSelectLib(type, id, name, desc) {
  const cfg = ZBS_LIB_CFG[type];
  if (zbsLibSelected[type] === id) {
    zbsLibSelected[type] = null;
    document.getElementById(cfg.nameId).value = '';
    document.getElementById(cfg.descId).value = '';
  } else {
    zbsLibSelected[type] = id;
    document.getElementById(cfg.nameId).value = name;
    document.getElementById(cfg.descId).value = desc.replace(/\\n/g, '\n');
  }
  zbsRenderLib(type);
}

async function zbsSaveToLib(type) {
  const cfg = ZBS_LIB_CFG[type];
  const name = document.getElementById(cfg.nameId).value.trim();
  const desc = document.getElementById(cfg.descId).value.trim();
  if (!name) { zbsShowToast('请先填写名称'); return; }
  await zbsDbAdd(cfg.store, { name, desc, time: Date.now() });
  zbsShowToast('已存入库');
  zbsRenderLib(type);
}

async function zbsDelLib(type, id) {
  const cfg = ZBS_LIB_CFG[type];
  await zbsDbDel(cfg.store, id);
  if (zbsLibSelected[type] === id) zbsLibSelected[type] = null;
  zbsRenderLib(type);
  zbsShowToast('已删除');
}

/* ---- AI 辅助生成 ---- */
async function zbsAiGen(type) {
  /* ── 读取设置 App 存储的 API 配置，绝不写死 ── */
  const apiCfg = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model  = localStorage.getItem('luna_api_model') || '';
  if (!apiCfg.baseUrl || !apiCfg.apiKey) {
    zbsShowToast('请先在设置中配置 AI 模型');
    return;
  }
  if (!model) {
    zbsShowToast('请先在设置中选择模型');
    return;
  }

  const cfg   = ZBS_LIB_CFG[type];
  const btnId = type === 'world' ? 'zbsAiWorldBtn' : type === 'style' ? 'zbsAiStyleBtn' : 'zbsAiStoryBtn';
  const btn   = document.getElementById(btnId);
  const ta    = document.getElementById(cfg.descId);

  let prompt = '';

  if (type === 'world') {
    /* 获取用户填写的世界观名称 */
    const wn = (document.getElementById('zbsWorldName').value || '').trim();
    /* 获取当前世界类型：优先自定义输入，其次选中的 chip */
    const customTypeEl = document.getElementById('zbsCustomTypeInput');
    const customTypeVal = (customTypeEl?.value || '').trim();
    const chipSelected = document.querySelector('#zbsWorldTypeChips .zbs-chip.on:not(.zbs-chip-custom)')?.textContent?.trim() || '';
    const worldType = customTypeVal || chipSelected;

    /* 获取世界观描述框现有内容 */
    const existingDesc = (ta.value || '').trim();

    if (existingDesc) {
      /* 有内容：根据用户已写的方向续写/扩展 */
      prompt = `你是一名专业小说世界观设计师。用户正在创作一个${worldType ? `【${worldType}】类型` : ''}的互动小说世界${wn ? `，世界名为"${wn}"` : ''}。\n\n用户已经写了如下世界观草稿：\n"${existingDesc}"\n\n请在此基础上润色扩展，保留用户的创意方向，补充更多细节（时代背景、核心规则、独特氛围），总长度控制在150字以内。直接输出内容，不加标题、不加引号。`;
    } else {
      /* 无内容：根据名称和类型自由创作 */
      if (wn || worldType) {
        prompt = `你是一名专业小说世界观设计师。请为${worldType ? `一个【${worldType}】类型的` : '一个'}互动小说世界${wn ? `（世界名：${wn}）` : ''}创作一段120字以内的世界观描述，包含时代背景、核心规则与独特氛围。直接输出内容，不加标题。`;
      } else {
        /* 连名称和类型都没有：完全随机，每次不同 */
        const _wSeeds = [
          ['仙侠','灵气复苏','门派争锋','天道轮回'],['玄幻','武魂觉醒','天地法则','异火炼体'],
          ['武侠','江湖恩怨','刀光剑影','武林秘境'],['架空历史','权谋争斗','乱世烽火','江山社稷'],
          ['克苏鲁','禁忌古神','理智崩坏','深渊低语'],['末世','废土求生','人性抉择','最后的烛火'],
          ['奇幻','龙族纷争','神器觉醒','命运之轮'],['修真','丹道炼器','飞升大道','天劫渡化'],
          ['洪荒流','混沌初开','圣人论道','封神大劫'],['异世大陆','魔法禁忌','种族战争','神明遗迹'],
        ];
        const _atmoPool = ['苍茫沉郁','瑰丽磅礴','阴冷诡谲','悲壮萧索','热烈峥嵘','幽静玄远','血腥肃杀','温柔哀愁'];
        const _rs1 = _wSeeds[Math.floor(Math.random()*_wSeeds.length)];
        const _rs2 = _wSeeds[Math.floor(Math.random()*_wSeeds.length)];
        const _rTag = _rs1[Math.floor(Math.random()*_rs1.length)];
        const _rFla = _rs2[Math.floor(Math.random()*_rs2.length)];
        const _rAtmo = _atmoPool[Math.floor(Math.random()*_atmoPool.length)];
        prompt = `你是一名沉浸在故事里的小说世界观设计师。现在完全随机创作一个互动小说世界观，必须围绕"${_rTag}"与"${_rFla}"展开，整体氛围偏向${_rAtmo}。包含世界名（自然带出）、时代背景、核心规则、独特氛围，控制在120字以内。禁止出现任何科技感、机械感、赛博朋克风格内容，禁止涉及电子设备、人工智能、星际飞船、纳米技术等现代或未来科技元素。直接输出，不加额外标题。`;
      }
    }

  } else if (type === 'style') {
    const sn   = (document.getElementById('zbsStyleName').value || '').trim();
    /* 获取节奏：优先自定义输入，其次 chip 选中 */
    const paceCustom = (document.getElementById('zbsPaceCustomInput')?.value || '').trim();
    const paceChip   = document.querySelector('#zbsPaceChips .zbs-chip.on')?.textContent?.trim() || '';
    const pace       = paceCustom || paceChip;
    const existingDesc = (ta.value || '').trim();

    const _sSeeds = [
      { base:'白描克制', desc:'惜字如金，动词精准，情绪全藏在动作细节里，不直说感受' },
      { base:'工笔浓墨', desc:'细节繁密，景物铺陈，色彩浓烈，有古典绘画质感' },
      { base:'散文诗化', desc:'句子参差，意象跳跃，情绪流动，带点朦胧感' },
      { base:'硬派直白', desc:'短句为主，节奏爽利，对话有力，少用形容词' },
      { base:'细腻内敛', desc:'心理描写丰富，感官细节精准，情绪如慢火熬煮' },
      { base:'古雅蕴藉', desc:'文言意趣，用词典雅，句式整饬，有古典章回气韵' },
      { base:'轻盈跳脱', desc:'语感轻快，带点俏皮，心理活动活泼，节奏明快' },
      { base:'黑色诗意', desc:'悲剧底色，意象阴郁而美丽，痛感与美感并存' },
    ];
    const _rs = _sSeeds[Math.floor(Math.random()*_sSeeds.length)];
    const _rs2 = _sSeeds[Math.floor(Math.random()*_sSeeds.length)];

    if (existingDesc) {
      prompt = `你是个有品位的文字编辑，帮用户把这段文风描述润色得更有感觉一些：\n"${existingDesc}"\n节奏定位是${pace || '均衡推进'}。保留原有风格方向，语感活一点，别太像模板。控制在80字以内。直接输出，不加标题。`;
    } else if (sn) {
      prompt = `你是个有审美的文字编辑。根据文风名称"${sn}"，用${_rs.desc}的方式写一段60字以内的文笔描述，节奏是${pace || '均衡推进'}，语感要有个性，别写成说明书。直接输出，不加标题。`;
    } else {
      /* 完全空白：随机生成，每次不同 */
      prompt = `你是个有审美的文字编辑。随机生成一种文笔风格描述，以"${_rs.base}"为核心，融入"${_rs2.base}"的一点影子，节奏是${pace || '均衡推进'}。风格描述要鲜活有质感，最后附一句示例短句体现语感，用《》括起来，控制在70字以内。直接输出，不加标题。`;
    }

  } else {
    const wDesc  = (document.getElementById('zbsWorldDesc').value || '').trim();
    const tone   = document.querySelector('#zbsToneChips .zbs-chip.on')?.textContent?.trim() || '热血';
    const drives = [...document.querySelectorAll('#zbsDriveChips .zbs-chip.on')].map(c => c.textContent.trim()).join('、');
    const driveCustom = (document.getElementById('zbsDriveCustomInput')?.value || '').trim();
    const driveText = [drives, driveCustom].filter(Boolean).join('、') || '寻找真相';
    const existingDesc = (ta.value || '').trim();
    if (existingDesc) {
      prompt = `你是一名互动小说策划。请在用户已有的故事简介基础上续写：\n"${existingDesc}"\n基调为${tone}，核心驱动力为「${driveText}」，保留现有冲突，扩展到100字以内。直接输出，不加标题。`;
    } else {
      prompt = `你是一名互动小说策划。请基于世界观"${wDesc.slice(0, 80) || '未设置'}"，创作一段80字以内的故事开篇简介，基调为${tone}，核心驱动力为「${driveText}」，包含初始情境与核心冲突，直接输出内容，不加标题。`;
    }
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="zbs-ai-blink"><span>.</span><span>.</span><span>.</span></span> 生成中';

  try {
    const baseUrl = apiCfg.baseUrl.replace(/\/$/, '');
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiCfg.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400
      })
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`HTTP ${resp.status}${errText ? '：' + errText.slice(0, 60) : ''}`);
    }
    const data = await resp.json();
    const result = (data.choices?.[0]?.message?.content || '').trim();
    if (!result) throw new Error('模型返回内容为空');
    ta.value = result;

    /* ── world 生成完成后：自动将世界类型渲染回 chip 区 ── */
    if (type === 'world') {
      zbsRenderWorldTypeAfterGen();
    }

    zbsShowToast('生成完成');
  } catch (e) {
    zbsShowToast('生成失败：' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="zbs-ai-dot"></span>AI 辅助生成';
  }
}

/* ================================================
   角色设定：完全由用户驱动，AI 仅作辅助补充
================================================ */

/* 角色定位（与主角关系）与出场频率的可选项 */
const ZBS_CHAR_RELATIONS = ['伙伴', '对手', '导师', '爱慕者', '家人', '神秘人', '路人 NPC'];
const ZBS_CHAR_FREQS     = ['常驻角色', '频繁出场', '偶尔登场', '单次客串'];

/* 角色列表：初始为空，一切角色由用户添加或由 AI 依据故事建议 */
let zbsChars = [];

function zbsCharEsc(s) {
  return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function zbsRenderChars() {
  const el = document.getElementById('zbsCharList');
  if (!el) return;

  if (!zbsChars.length) {
    el.innerHTML = `<div class="zbs-char-empty">还没有配角 —— 从角色书中选择，或手动创建，也可以让 AI 依据故事建议</div>`;
    return;
  }

  el.innerHTML = zbsChars.map((c, i) => {
    const ava = (c.name || '').trim().charAt(0) || '?';

    /* 来自角色书的角色：紧凑展示 + 参与模式标签 */
    if (c.dbRef) {
      const modeLabel = ZBS_MODE_LABELS[c.participateMode] || '故事角色';
      const modeCls   = `zbs-ctag-mode-${c.participateMode || 'npc'}`;
      const avaHtml   = c.dbAvatar
        ? `<img src="${c.dbAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt=""/>`
        : zbsCharEsc(ava);
      const meta = [c.dbRole, c.dbGender, c.dbAge].filter(Boolean).join(' · ');
      return `
      <div class="zbs-char-edit-card" data-idx="${i}" style="padding:11px 13px">
        <div class="zbs-cec-top" style="margin-bottom:8px">
          <div class="zbs-char-ava">${avaHtml}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;color:#0a0a0a;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${zbsCharEsc(c.name || '未命名')}</div>
            <div style="font-size:10px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${zbsCharEsc(meta || '角色书角色')}</div>
          </div>
          <button class="zbs-char-rm" onclick="zbsRemoveChar(${i})">×</button>
        </div>
        <div class="zbs-char-tags">
          <span class="zbs-ctag zbs-ctag-source-db">角色书</span>
          <span class="zbs-ctag ${modeCls}" style="cursor:pointer" onclick="zbsToggleCharMode(${i})">${modeLabel}</span>
          <span class="zbs-ctag zbs-ctag-toggle${c.aiPlay ? ' on' : ''}" onclick="zbsCharToggleTag(${i},'aiPlay')">AI 扮演</span>
        </div>
      </div>`;
    }

    /* 手动创建 / AI 建议的角色：展开编辑卡 */
    const relChips = ZBS_CHAR_RELATIONS.map(r =>
      `<span class="zbs-chip${c.relation === r ? ' on' : ''}" onclick="zbsCharPickChip(${i},'relation','${r}')">${r}</span>`
    ).join('');
    const relCustomOn = c.relation === 'custom';
    const relChipsFull = relChips + `<span class="zbs-chip zbs-chip-custom${relCustomOn ? ' on' : ''}" onclick="zbsCharToggleRelCustom(${i})">自定义…</span>`;

    const freqChips = ZBS_CHAR_FREQS.map(f =>
      `<span class="zbs-chip${c.freq === f ? ' on' : ''}" onclick="zbsCharPickChip(${i},'freq','${f}')">${f}</span>`
    ).join('');

    return `
    <div class="zbs-char-edit-card" data-idx="${i}">
      <div class="zbs-cec-top">
        <div class="zbs-char-ava">${zbsCharEsc(ava)}</div>
        <input type="text" class="zbs-cec-name" maxlength="14" placeholder="角色姓名"
          value="${zbsCharEsc(c.name)}" oninput="zbsCharField(${i},'name',this.value)">
        <button class="zbs-char-rm" onclick="zbsRemoveChar(${i})">×</button>
      </div>

      <div class="zbs-f">
        <div class="zbs-fl">角色定位 <span class="zbs-fl-hint">与主角的关系</span></div>
        <div class="zbs-chips">${relChipsFull}</div>
        <div class="zbs-custom-type-wrap${relCustomOn ? ' show' : ''}">
          <input type="text" maxlength="16" placeholder="如：青梅竹马、隐藏身份的卧底…"
            value="${zbsCharEsc(c.relationCustom)}" oninput="zbsCharField(${i},'relationCustom',this.value)">
        </div>
      </div>

      <div class="zbs-f">
        <div class="zbs-fl">出场频率 <span class="zbs-fl-hint">该角色在故事中的存在感</span></div>
        <div class="zbs-chips">${freqChips}</div>
      </div>

      <div class="zbs-f">
        <div class="zbs-fl">性格与背景 <span class="zbs-fl-hint">留空可由 AI 根据故事生成</span></div>
        <textarea placeholder="性格特征、外貌、与主角的渊源、登场动机……留空可点击下方按钮，AI 将依据故事与世界观为你撰写"
          oninput="zbsCharField(${i},'desc',this.value)">${zbsCharEsc(c.desc)}</textarea>
        <button class="zbs-ai-btn" onclick="zbsAiGenChar(${i})"><span class="zbs-ai-dot"></span>AI 辅助生成</button>
      </div>

      <div class="zbs-char-tags">
        <span class="zbs-ctag zbs-ctag-toggle${c.aiPlay ? ' on' : ''}" onclick="zbsCharToggleTag(${i},'aiPlay')">AI 扮演</span>
      </div>
    </div>`;
  }).join('');
}

/* 添加一个全新的空白角色，所有内容由用户填写或后续 AI 辅助 */
function zbsAddChar() {
  zbsChars.push({ name: '', relation: '', relationCustom: '', freq: '', desc: '', aiPlay: true, charImport: false });
  zbsRenderChars();
  /* 滚动到新增的卡片，方便用户立即填写 */
  requestAnimationFrame(() => {
    const cards = document.querySelectorAll('.zbs-char-edit-card');
    cards[cards.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function zbsRemoveChar(i) { zbsChars.splice(i, 1); zbsRenderChars(); }

/* 文本类字段直接更新数据，不整体重渲染，避免输入框失焦 */
function zbsCharField(i, field, val) {
  const c = zbsChars[i];
  if (!c) return;
  c[field] = val;
  if (field === 'name') {
    const card = document.querySelector(`.zbs-char-edit-card[data-idx="${i}"]`);
    const ava = card?.querySelector('.zbs-char-ava');
    if (ava) ava.textContent = val.trim().charAt(0) || '?';
  }
}

/* 角色定位 / 出场频率 chip 选择（单选，再次点击取消） */
function zbsCharPickChip(i, group, val) {
  const c = zbsChars[i];
  if (!c) return;
  if (group === 'relation') c.relation = c.relation === val ? '' : val;
  if (group === 'freq')     c.freq     = c.freq === val ? '' : val;
  zbsRenderChars();
}

/* 角色定位「自定义…」切换 */
function zbsCharToggleRelCustom(i) {
  const c = zbsChars[i];
  if (!c) return;
  c.relation = c.relation === 'custom' ? '' : 'custom';
  zbsRenderChars();
  if (c.relation === 'custom') {
    requestAnimationFrame(() => {
      document.querySelector(`.zbs-char-edit-card[data-idx="${i}"] .zbs-custom-type-wrap input`)?.focus();
    });
  }
}

/* AI 扮演 / 标签开关 */
function zbsCharToggleTag(i, key) {
  const c = zbsChars[i];
  if (!c) return;
  c[key] = !c[key];
  zbsRenderChars();
}

/* 来自角色书的角色：点击参与模式标签循环切换 */
const ZBS_MODE_CYCLE = ['companion', 'npc', 'background'];
function zbsToggleCharMode(i) {
  const c = zbsChars[i];
  if (!c) return;
  const cur = c.participateMode || 'npc';
  const idx = ZBS_MODE_CYCLE.indexOf(cur);
  c.participateMode = ZBS_MODE_CYCLE[(idx + 1) % ZBS_MODE_CYCLE.length];
  c.freq = c.participateMode === 'background' ? '偶尔登场' : c.participateMode === 'companion' ? '常驻角色' : '频繁出场';
  c.aiPlay = c.participateMode !== 'background';
  zbsRenderChars();
}

/* ── 从角色书 DB 选择角色 ── */

/* 连接 LunaCharDB（只读）*/
function zbsOpenLunaCharDB() {
  return new Promise((res, rej) => {
    const probe = indexedDB.open('LunaCharDB');
    probe.onsuccess = e => {
      const cur = e.target.result;
      const ver = cur.version;
      const has = cur.objectStoreNames.contains('chars');
      cur.close();
      if (!has) return res(null); /* DB 里没有 chars store */
      const r = indexedDB.open('LunaCharDB', ver);
      r.onsuccess = e2 => res(e2.target.result);
      r.onerror   = () => res(null);
      r.onupgradeneeded = () => {};
    };
    probe.onerror = () => res(null);
    probe.onupgradeneeded = e => {
      /* 全新 DB，没有角色 */
      e.target.result.close();
      res(null);
    };
  });
}

async function zbsGetAllLunaChars() {
  const db = await zbsOpenLunaCharDB();
  if (!db) return [];
  return new Promise(res => {
    try {
      const r = db.transaction('chars', 'readonly').objectStore('chars').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror   = () => res([]);
    } catch(e) { res([]); }
  });
}

let _zbsCpSelected = null;   /* 选择器中选中的 char 对象 */

async function zbsOpenCharPicker() {
  const overlay = document.getElementById('zbsCharPickerOverlay');
  const picker  = document.getElementById('zbsCharPicker');
  const loading = document.getElementById('zbsCpLoading');
  const empty   = document.getElementById('zbsCpEmpty');
  const list    = document.getElementById('zbsCpList');
  const modeBar = document.getElementById('zbsCpModeBar');

  _zbsCpSelected = null;
  list.innerHTML = '';
  loading.style.display = 'flex';
  empty.style.display   = 'none';
  modeBar.style.display = 'none';

  overlay.classList.add('show');
  picker.classList.add('show');

  const chars = await zbsGetAllLunaChars();
  loading.style.display = 'none';

  if (!chars.length) {
    empty.style.display   = 'block';
    empty.textContent     = '角色书还没有角色 —— 去「角色」页面创建一些吧';
    return;
  }

  list.innerHTML = chars.map(c => {
    const initial = (c.name || '?')[0].toUpperCase();
    const meta    = [c.role, c.gender, c.age ? c.age + '岁' : ''].filter(Boolean).join(' · ');
    const avaHtml = c.avatar
      ? `<img src="${c.avatar}" alt="avatar"/>`
      : `<span>${zbsCharEsc(initial)}</span>`;
    const isSelected = _zbsCompanion && _zbsCompanion.id === c.id;
    return `
    <div class="zbs-cp-card${isSelected ? ' selected' : ''}" data-dbid="${c.id}" onclick="zbsCpSelectCard(this, ${c.id})">
      <div class="zbs-cp-card-ava">${avaHtml}</div>
      <div class="zbs-cp-card-info">
        <div class="zbs-cp-card-name">${zbsCharEsc(c.name || '未命名')}</div>
        <div class="zbs-cp-card-meta">${zbsCharEsc(meta || '暂无信息')}</div>
      </div>
      <div class="zbs-cp-card-check">
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#0a0a0a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
    </div>`;
  }).join('');

  picker._chars = chars;
}

function zbsCpSelectCard(el, dbId) {
  const picker  = document.getElementById('zbsCharPicker');
  const modeBar = document.getElementById('zbsCpModeBar');
  document.querySelectorAll('.zbs-cp-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  _zbsCpSelected = picker._chars?.find(c => c.id === dbId) || null;
  modeBar.style.display = _zbsCpSelected ? 'block' : 'none';
}

/* 陪玩角色数据 */
let _zbsCompanion = null;

function zbsConfirmCompanion() {
  if (!_zbsCpSelected) return;
  _zbsCompanion = _zbsCpSelected;
  zbsRenderCompanionSlot();
  zbsCloseCharPicker();
  /* 显示陪玩互动风格选项 */
  document.getElementById('zbsCompanionStyleArea').style.display = 'block';
  zbsShowToast(`已邀请「${_zbsCompanion.name || '角色'}」陪你玩`);
}

function zbsRenderCompanionSlot() {
  const slot  = document.getElementById('zbsCompanionSlot');
  const empty = document.getElementById('zbsCompanionEmpty');
  if (!slot) return;

  if (!_zbsCompanion) {
    empty && (empty.style.display = 'flex');
    return;
  }

  empty && (empty.style.display = 'none');
  const c       = _zbsCompanion;
  const initial = (c.name || '?')[0].toUpperCase();
  const meta    = [c.role, c.gender, c.age ? c.age + '岁' : ''].filter(Boolean).join(' · ');
  const avaHtml = c.avatar
    ? `<img src="${c.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt=""/>`
    : `<span style="font-size:14px;font-weight:700;color:#666">${zbsCharEsc(initial)}</span>`;

  /* 找已有的卡片或新建 */
  let card = document.getElementById('zbsCompanionCard');
  if (!card) {
    card = document.createElement('div');
    card.id = 'zbsCompanionCard';
    card.className = 'zbs-char-card zbs-companion-card';
    slot.insertBefore(card, empty || null);
  }
  card.innerHTML = `
    <div class="zbs-char-ava" style="width:36px;height:36px;flex-shrink:0">${avaHtml}</div>
    <div class="zbs-char-info" style="flex:1;min-width:0">
      <div class="zbs-cn">${zbsCharEsc(c.name || '未命名')}</div>
      <div class="zbs-cm">${zbsCharEsc(meta || '角色书角色')}</div>
      <div class="zbs-char-tags" style="margin-top:5px">
        <span class="zbs-ctag" style="background:#f0f7ff;color:#4a7fc4;border-color:#c8dcf5">陪玩中</span>
      </div>
    </div>
    <button class="zbs-char-rm" style="position:absolute;top:9px;right:11px" onclick="zbsRemoveCompanion()">×</button>`;
}

function zbsRemoveCompanion() {
  _zbsCompanion = null;
  const card = document.getElementById('zbsCompanionCard');
  if (card) card.remove();
  const empty = document.getElementById('zbsCompanionEmpty');
  if (empty) empty.style.display = 'flex';
  document.getElementById('zbsCompanionStyleArea').style.display = 'none';
}

function zbsCloseCharPicker() {
  document.getElementById('zbsCharPickerOverlay')?.classList.remove('show');
  document.getElementById('zbsCharPicker')?.classList.remove('show');
  _zbsCpSelected = null;
}

/* 取得当前角色的「角色定位」展示文本 */
function zbsCharRelationText(c) {
  if (c.relation === 'custom') return (c.relationCustom || '').trim() || '未指定';
  return c.relation || '未指定';
}

/* ── AI 辅助生成：单个角色的性格与背景 ── */
async function zbsAiGenChar(i) {
  const apiCfg = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model  = localStorage.getItem('luna_api_model') || '';
  if (!apiCfg.baseUrl || !apiCfg.apiKey) { zbsShowToast('请先在设置中配置 AI 模型'); return; }
  if (!model) { zbsShowToast('请先在设置中选择模型'); return; }

  const c = zbsChars[i];
  if (!c) return;

  const card = document.querySelector(`.zbs-char-edit-card[data-idx="${i}"]`);
  const btn  = card?.querySelector('.zbs-ai-btn');
  const ta   = card?.querySelector('textarea');
  if (!btn || !ta) return;

  const worldDesc = (document.getElementById('zbsWorldDesc')?.value || '').trim();
  const storyDesc = (document.getElementById('zbsStoryDesc')?.value || '').trim();
  const opening   = (document.getElementById('zbsOpeningDesc')?.value || '').trim();
  const relation  = zbsCharRelationText(c);
  const freq      = c.freq || '未指定';
  const name      = (c.name || '').trim();
  const existing  = (c.desc || '').trim();

  let prompt = '';
  const ctx = `世界观：${worldDesc.slice(0, 100) || '未设置'}\n故事简介：${storyDesc.slice(0, 100) || '未设置'}\n开篇情境：${opening.slice(0, 100) || '未设置'}`;

  if (existing) {
    prompt = `你是一名互动小说角色设计师。以下是当前故事的背景：\n${ctx}\n\n这是一个名为「${name || '（未命名）'}」的角色，与主角的关系定位是「${relation}」，出场频率为「${freq}」。\n\n用户已写下的角色设定：\n"${existing}"\n\n请在此基础上润色完善，补充性格特征、外貌、与主角的渊源或登场动机，保留用户原有创意方向，控制在90字以内。直接输出内容，不加标题、不加引号。`;
  } else {
    prompt = `你是一名互动小说角色设计师。以下是当前故事的背景：\n${ctx}\n\n请为一个名为「${name || '（由你自由命名）'}」、与主角关系定位是「${relation}」、出场频率为「${freq}」的角色撰写设定，包含性格特征、外貌或气质、与主角的渊源、登场动机，控制在90字以内。直接输出内容，不加标题、不加引号。`;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="zbs-ai-blink"><span>.</span><span>.</span><span>.</span></span> 生成中';

  try {
    const baseUrl = apiCfg.baseUrl.replace(/\/$/, '');
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiCfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 300 })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const result = (data.choices?.[0]?.message?.content || '').trim();
    if (!result) throw new Error('模型返回内容为空');
    c.desc = result;
    ta.value = result;
    zbsShowToast('生成完成');
  } catch (e) {
    zbsShowToast('生成失败：' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="zbs-ai-dot"></span>AI 辅助生成';
  }
}

/* ── AI 生成故事角色建议，并渲染供用户选择主角视角 ── */
let _zbsStoryChars    = [];   /* AI 建议的故事角色列表 */
let _zbsProtagonistIdx = null; /* 用户选择的主角视角索引 */

async function zbsAiSuggestChars() {
  const apiCfg = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model  = localStorage.getItem('luna_api_model') || '';
  if (!apiCfg.baseUrl || !apiCfg.apiKey) { zbsShowToast('请先在设置中配置 AI 模型'); return; }
  if (!model) { zbsShowToast('请先在设置中选择模型'); return; }

  const btn = document.getElementById('zbsAiCharSuggestBtn');

  const worldDesc = (document.getElementById('zbsWorldDesc')?.value || '').trim();
  const storyDesc = (document.getElementById('zbsStoryDesc')?.value || '').trim();
  const opening   = (document.getElementById('zbsOpeningDesc')?.value || '').trim();

  if (!worldDesc && !storyDesc && !opening) {
    zbsShowToast('请先在「世界观」与「故事」中填写一些设定，AI 才能据此建议角色');
    return;
  }

  const prompt = `你是一名互动小说角色设计师。当前故事设定如下：\n世界观：${worldDesc.slice(0,150)||'未设置'}\n故事简介：${storyDesc.slice(0,150)||'未设置'}\n开篇情境：${opening.slice(0,150)||'未设置'}\n\n请基于以上设定，设计 3 到 4 个适合在故事中登场的角色，其中必须包含 1 个「主角候选」（玩家可扮演的视角人物），其余为配角。\n\n严格以 JSON 数组格式输出，每个元素包含：\nname：角色姓名（2-4字）\nisProtagonist：是否为主角候选，true 或 false，只能有一个 true\nrole：角色定位简述（4-8字，如：江湖侠客、帝国密探）\ngender：性别（男/女/不明）\ndesc：性格外貌与故事中的定位，80字以内\nrelation：与主角/玩家的关系（配角填写，主角候选留空字符串）\n\n只输出 JSON 数组，不要任何额外说明、不要代码块标记。`;

  btn.disabled = true;
  btn.innerHTML = '<span class="zbs-ai-blink"><span>.</span><span>.</span><span>.</span></span> 生成中';

  try {
    const baseUrl = apiCfg.baseUrl.replace(/\/$/, '');
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiCfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 700 })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    let result = (data.choices?.[0]?.message?.content || '').trim();
    if (!result) throw new Error('模型返回内容为空');
    result = result.replace(/^```json\s*/i,'').replace(/^```\s*/,'').replace(/```\s*$/,'').trim();

    const list = JSON.parse(result);
    if (!Array.isArray(list) || !list.length) throw new Error('未生成有效角色');

    _zbsStoryChars     = list;
    _zbsProtagonistIdx = list.findIndex(c => c.isProtagonist);
    if (_zbsProtagonistIdx < 0) _zbsProtagonistIdx = 0; /* 兜底 */

    zbsRenderStoryChars();
    document.getElementById('zbsStoryCharEmpty').style.display = 'none';
    zbsShowToast('角色建议已生成，点击卡片选择你要扮演的视角');
  } catch (e) {
    zbsShowToast('生成失败：' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="zbs-ai-dot"></span>AI 生成故事角色建议';
  }
}

function zbsRenderStoryChars() {
  const el = document.getElementById('zbsStoryCharList');
  if (!el) return;

  el.innerHTML = _zbsStoryChars.map((c, i) => {
    const isProt  = i === _zbsProtagonistIdx;
    const initial = (c.name || '?')[0].toUpperCase();
    const meta    = [c.role, c.gender].filter(Boolean).join(' · ');
    return `
    <div class="zbs-story-char-card${isProt ? ' protagonist' : ''}" onclick="zbsPickProtagonist(${i})">
      <div class="zbs-sc-left">
        <div class="zbs-char-ava">${zbsCharEsc(initial)}</div>
      </div>
      <div class="zbs-sc-body">
        <div class="zbs-sc-name">${zbsCharEsc(c.name || '未命名')}</div>
        <div class="zbs-sc-meta">${zbsCharEsc(meta)}</div>
        <div class="zbs-sc-desc">${zbsCharEsc(c.desc || '')}</div>
        ${c.relation ? `<div class="zbs-sc-rel">与主角：${zbsCharEsc(c.relation)}</div>` : ''}
      </div>
      <div class="zbs-sc-badge">${isProt ? '<span class="zbs-sc-prot-badge">我来扮演</span>' : '<span class="zbs-sc-npc-badge">配角</span>'}</div>
    </div>`;
  }).join('');
}

function zbsPickProtagonist(i) {
  _zbsProtagonistIdx = i;
  zbsRenderStoryChars();
  zbsShowToast(`已选择「${_zbsStoryChars[i]?.name || ''}」作为你的扮演视角`);
}

/* ── AI 辅助生成：开篇情境（连接「故事」与「角色」的桥梁） ── */
async function zbsAiGenOpening() {
  const apiCfg = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model  = localStorage.getItem('luna_api_model') || '';
  if (!apiCfg.baseUrl || !apiCfg.apiKey) { zbsShowToast('请先在设置中配置 AI 模型'); return; }
  if (!model) { zbsShowToast('请先在设置中选择模型'); return; }

  const btn = document.getElementById('zbsAiOpeningBtn');
  const ta  = document.getElementById('zbsOpeningDesc');

  const worldDesc = (document.getElementById('zbsWorldDesc')?.value || '').trim();
  const storyDesc = (document.getElementById('zbsStoryDesc')?.value || '').trim();
  const drives = [...document.querySelectorAll('#zbsDriveChips .zbs-chip.on')].map(c => c.textContent.trim()).join('、');
  const driveCustom = (document.getElementById('zbsDriveCustomInput')?.value || '').trim();
  const driveText = [drives, driveCustom].filter(Boolean).join('、');
  const existing  = (ta.value || '').trim();

  let prompt = '';
  if (existing) {
    prompt = `你是一名互动小说策划。当前世界观：${worldDesc.slice(0, 100) || '未设置'}；故事简介：${storyDesc.slice(0, 100) || '未设置'}${driveText ? `；核心驱动力：${driveText}` : ''}。\n\n用户已写下的开篇情境草稿：\n"${existing}"\n\n请在此基础上润色扩展，让场景更具体、更有画面感，并清晰交代主角此刻所处的场景、处境，以及第一个登场人物与主角的关系，控制在100字以内。直接输出内容，不加标题、不加引号。`;
  } else {
    prompt = `你是一名互动小说策划。请基于世界观「${worldDesc.slice(0, 100) || '未设置'}」与故事简介「${storyDesc.slice(0, 100) || '未设置'}」${driveText ? `，核心驱动力为「${driveText}」` : ''}，创作一段90字以内的开篇情境：交代主角此刻身处何地、正面临什么处境，并引出第一个登场的人物及其与主角的关系。直接输出内容，不加标题、不加引号。`;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="zbs-ai-blink"><span>.</span><span>.</span><span>.</span></span> 生成中';

  try {
    const baseUrl = apiCfg.baseUrl.replace(/\/$/, '');
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiCfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 300 })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const result = (data.choices?.[0]?.message?.content || '').trim();
    if (!result) throw new Error('模型返回内容为空');
    ta.value = result;
    zbsShowToast('生成完成');
  } catch (e) {
    zbsShowToast('生成失败：' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="zbs-ai-dot"></span>AI 辅助生成';
  }
}

/* ── AI 辅助生成：故事名称（想不到名字时由 AI 根据已有设定起名） ── */
async function zbsAiGenStoryName() {
  const apiCfg = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model  = localStorage.getItem('luna_api_model') || '';
  if (!apiCfg.baseUrl || !apiCfg.apiKey) { zbsShowToast('请先在设置中配置 AI 模型'); return; }
  if (!model) { zbsShowToast('请先在设置中选择模型'); return; }

  const btn = document.getElementById('zbsAiNameBtn');
  const inp = document.getElementById('zbsStoryName');

  const worldDesc = (document.getElementById('zbsWorldDesc')?.value || '').trim();
  const storyDesc = (document.getElementById('zbsStoryDesc')?.value || '').trim();
  const opening   = (document.getElementById('zbsOpeningDesc')?.value || '').trim();
  const drives = [...document.querySelectorAll('#zbsDriveChips .zbs-chip.on')].map(c => c.textContent.trim()).join('、');
  const driveCustom = (document.getElementById('zbsDriveCustomInput')?.value || '').trim();
  const driveText = [drives, driveCustom].filter(Boolean).join('、');
  const ending = document.getElementById('zbsEndingSelVal')?.textContent || '';
  const existing = (inp.value || '').trim();

  if (!worldDesc && !storyDesc && !opening) {
    zbsShowToast('请先填写一些故事设定，AI 才能据此起名');
    return;
  }

  const ctx = `世界观：${worldDesc.slice(0, 80) || '未设置'}\n故事简介：${storyDesc.slice(0, 80) || '未设置'}\n开篇情境：${opening.slice(0, 80) || '未设置'}${driveText ? `\n核心驱动力：${driveText}` : ''}${ending ? `\n结局走向：${ending}` : ''}`;

  let prompt = '';
  if (existing) {
    prompt = `你是一名擅长起名的小说编辑。以下是一个互动小说的设定：\n${ctx}\n\n用户暂定的名字是「${existing}」，请基于以上设定，提供 1 个更有韵味、更贴合内容的新名字（2-6字），可以是对原名字的优化也可以是全新方向。只输出名字本身，不要标点、引号、解释或多个候选。`;
  } else {
    prompt = `你是一名擅长起名的小说编辑。请根据以下互动小说设定，起一个 2-6 字、有韵味且贴合内容的书名：\n${ctx}\n\n只输出名字本身，不要标点、引号、解释或多个候选。`;
  }

  btn.disabled = true;
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '<span class="zbs-ai-blink"><span>.</span><span>.</span><span>.</span></span>';

  try {
    const baseUrl = apiCfg.baseUrl.replace(/\/$/, '');
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiCfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 60 })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    let result = (data.choices?.[0]?.message?.content || '').trim();
    /* 清理可能出现的引号、标点与多余空白 */
    result = result.replace(/^[「『"'《\s]+|[」』"'》\s.。！？!?]+$/g, '').trim();
    if (!result) throw new Error('模型返回内容为空');
    inp.value = result;
    zbsShowToast('已生成名字');
  } catch (e) {
    zbsShowToast('生成失败：' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}


function zbsToggleSel(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const isOpen = el.classList.contains('open');
  document.querySelectorAll('.zbs-sel.open').forEach(s => {
    if (s.id !== id) s.classList.remove('open');
  });
  el.classList.toggle('open', !isOpen);
}

function zbsPickSel(selId, optEl) {
  const el = document.getElementById(selId);
  if (!el) return;
  el.querySelectorAll('.zbs-sel-opt').forEach(o => o.classList.remove('sel'));
  optEl.classList.add('sel');
  const mainText = optEl.querySelector('.zbs-sel-opt-main')?.textContent || '';
  const valEl = document.getElementById(selId + 'Val');
  if (valEl) valEl.textContent = mainText;
  el.dataset.val = optEl.dataset.val || mainText;
  el.classList.remove('open');
  /* 非自定义项选中时，隐藏对应的自定义输入框 */
  const wrapMap = {
    zbsPovSel: 'zbsPovCustomWrap', zbsFocusSel: 'zbsFocusCustomWrap',
    zbsNarrSel: 'zbsNarrCustomWrap', zbsStructSel: 'zbsStructCustomWrap'
  };
  const wrapId = wrapMap[selId];
  if (wrapId) document.getElementById(wrapId)?.classList.remove('show');
}

/* 点击"自定义…"选项：展开输入框并保持显示 */
function zbsPickSelCustom(selId, optEl, wrapId) {
  const el = document.getElementById(selId);
  if (!el) return;
  el.querySelectorAll('.zbs-sel-opt').forEach(o => o.classList.remove('sel'));
  optEl.classList.add('sel');
  el.dataset.val = 'custom';
  el.classList.remove('open');
  const wrap = document.getElementById(wrapId);
  if (wrap) {
    wrap.classList.add('show');
    setTimeout(() => wrap.querySelector('input')?.focus(), 80);
  }
}

/* 选择器自定义输入框实时更新触发器显示值 */
function zbsOnSelCustomInput(selId, inputId, valElId) {
  const val = (document.getElementById(inputId)?.value || '').trim();
  const valEl = document.getElementById(valElId);
  if (valEl) valEl.textContent = val || '自定义…';
}

/* 点击外部关闭所有自定义选择器 */
document.addEventListener('click', e => {
  if (!e.target.closest('.zbs-sel')) {
    document.querySelectorAll('.zbs-sel.open').forEach(s => s.classList.remove('open'));
  }
});

/* ── Chip 通用自定义（用于叙述距离 / 主角称呼 / 内心独白）── */
function zbsToggleChipCustom(groupId, wrapId, chipId) {
  const wrap  = document.getElementById(wrapId);
  const chip  = document.getElementById(chipId);
  if (!wrap || !chip) return;
  const isOpen = wrap.classList.contains('show');
  if (isOpen) {
    wrap.classList.remove('show');
    chip.classList.remove('on');
    wrap.querySelector('input').value = '';
    chip.textContent = '自定义…';
    /* 恢复该组第一个预设 chip 选中 */
    const first = document.querySelector('#' + groupId + ' .zbs-chip:not(.zbs-chip-custom)');
    if (first) first.classList.add('on');
  } else {
    document.querySelectorAll('#' + groupId + ' .zbs-chip').forEach(c => c.classList.remove('on'));
    chip.classList.add('on');
    wrap.classList.add('show');
    setTimeout(() => wrap.querySelector('input')?.focus(), 80);
  }
}

/* chip 自定义输入实时同步 chip 文字 */
function zbsOnChipCustomInput(chipId, inputId) {
  const val  = (document.getElementById(inputId)?.value || '').trim();
  const chip = document.getElementById(chipId);
  if (!chip) return;
  chip.textContent = val ? (val.length > 8 ? val.slice(0, 8) + '…' : val) : '自定义…';
}

/* 点预设 chip 时关闭自定义输入框（单选 chip 组通用，多选 chip 组自定义 chip 单独处理） */
document.addEventListener('DOMContentLoaded', () => {
  [
    { groupId: 'zbsDistChips',   wrapId: 'zbsDistCustomWrap',   chipId: 'zbsDistChipCustom',   inputId: 'zbsDistCustomInput' },
    { groupId: 'zbsRefChips',    wrapId: 'zbsRefCustomWrap',    chipId: 'zbsRefChipCustom',    inputId: 'zbsRefCustomInput' },
    { groupId: 'zbsMonoChips',   wrapId: 'zbsMonoCustomWrap',   chipId: 'zbsMonoChipCustom',   inputId: 'zbsMonoCustomInput' },
    { groupId: 'zbsChoiceChips', wrapId: 'zbsChoiceCustomWrap', chipId: 'zbsChoiceChipCustom', inputId: 'zbsChoiceCustomInput' },
  ].forEach(({ groupId, wrapId, chipId, inputId }) => {
    const g = document.getElementById(groupId);
    if (!g) return;
    g.addEventListener('click', e => {
      const c = e.target.closest('.zbs-chip');
      if (!c || c.id === chipId) return;
      document.getElementById(wrapId)?.classList.remove('show');
      const cc = document.getElementById(chipId);
      if (cc) { cc.classList.remove('on'); cc.textContent = '自定义…'; }
      const inp = document.getElementById(inputId);
      if (inp) inp.value = '';
    });
  });
});

/* ── AI 辅助生成：视角补充说明 ── */
async function zbsAiGenPov() {
  const apiCfg = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model  = localStorage.getItem('luna_api_model') || '';
  if (!apiCfg.baseUrl || !apiCfg.apiKey) { zbsShowToast('请先在设置中配置 AI 模型'); return; }
  if (!model) { zbsShowToast('请先在设置中选择模型'); return; }

  const btn = document.getElementById('zbsAiPovBtn');
  const ta  = document.getElementById('zbsPovDesc');

  /* 收集当前视角配置 */
  const pov      = document.getElementById('zbsPovSelVal')?.textContent || '';
  const focus    = document.getElementById('zbsFocusSelVal')?.textContent || '';
  const narr     = document.getElementById('zbsNarrSelVal')?.textContent || '';
  const dist     = document.querySelector('#zbsDistChips .zbs-chip.on')?.textContent?.trim() || '';
  const mono     = document.querySelector('#zbsMonoChips .zbs-chip.on')?.textContent?.trim() || '';
  const existing = (ta.value || '').trim();

  let prompt = '';
  if (existing) {
    prompt = `你是一名互动小说叙事指导。用户正在描述故事的叙述视角设定，当前选择是：人称「${pov}」、聚焦「${focus}」、旁白语气「${narr}」、叙述距离「${dist}」、内心独白「${mono}」。\n\n用户已填写的补充说明：\n"${existing}"\n\n请在此基础上润色完善，让描述更具体、对 AI 更有指导性，80 字以内。直接输出，不加标题。`;
  } else {
    prompt = `你是一名互动小说叙事指导。用户当前视角设置：人称「${pov}」、聚焦「${focus}」、旁白语气「${narr}」、叙述距离「${dist}」、内心独白「${mono}」。\n\n请根据这些设置，写一段精准的视角补充说明，告诉 AI 叙述时需要注意的独特细节或边界，70 字以内。直接输出，不加标题。`;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="zbs-ai-blink"><span>.</span><span>.</span><span>.</span></span> 生成中';

  try {
    const baseUrl = apiCfg.baseUrl.replace(/\/$/, '');
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiCfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 300 })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const result = (data.choices?.[0]?.message?.content || '').trim();
    if (!result) throw new Error('模型返回内容为空');
    ta.value = result;
    zbsShowToast('生成完成');
  } catch (e) {
    zbsShowToast('生成失败：' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="zbs-ai-dot"></span>AI 辅助生成';
  }
}

/* ================================================
   世界类型：自定义 chip 交互 + AI 生成后类型回显
================================================ */

/* 点击"自定义…"chip 切换输入框显示 */
function zbsToggleCustomType() {
  const wrap  = document.getElementById('zbsCustomTypeWrap');
  const chip  = document.getElementById('zbsChipCustom');
  const isOpen = wrap.classList.contains('show');

  if (isOpen) {
    /* 关闭：清空输入，chip 取消选中 */
    wrap.classList.remove('show');
    chip.classList.remove('on');
    document.getElementById('zbsCustomTypeInput').value = '';
    /* 恢复第一个 preset chip 选中 */
    const first = document.querySelector('#zbsWorldTypeChips .zbs-chip:not(.zbs-chip-custom)');
    if (first) first.classList.add('on');
  } else {
    /* 打开：取消所有 preset chip，选中自定义 chip */
    document.querySelectorAll('#zbsWorldTypeChips .zbs-chip').forEach(c => c.classList.remove('on'));
    chip.classList.add('on');
    wrap.classList.add('show');
    setTimeout(() => document.getElementById('zbsCustomTypeInput').focus(), 100);
  }
}

/* preset chip 被点击时，自动关闭自定义输入框（由 zbsInit 里的 chips 单选逻辑触发后补充） */
document.addEventListener('DOMContentLoaded', () => {
  /* 监听 preset chip 点击，关闭自定义输入框 */
  const chipsGroup = document.getElementById('zbsWorldTypeChips');
  if (chipsGroup) {
    chipsGroup.addEventListener('click', e => {
      const chip = e.target.closest('.zbs-chip');
      if (!chip || chip.id === 'zbsChipCustom') return;
      /* 点了 preset chip：关闭自定义 */
      document.getElementById('zbsCustomTypeWrap').classList.remove('show');
      document.getElementById('zbsChipCustom').classList.remove('on');
      document.getElementById('zbsCustomTypeInput').value = '';
    });
  }
});

/* 自定义类型输入框实时同步：有内容则 chip 显示为"选中"状 */
function zbsOnCustomTypeInput() {
  const val  = (document.getElementById('zbsCustomTypeInput').value || '').trim();
  const chip = document.getElementById('zbsChipCustom');
  if (val) {
    chip.textContent = val.length > 6 ? val.slice(0, 6) + '…' : val;
  } else {
    chip.textContent = '自定义…';
  }
}

/* AI 生成完成后，把当前世界类型以标签形式渲染在 textarea 下方 */
function zbsRenderWorldTypeAfterGen() {
  /* 获取当前有效世界类型 */
  const customVal = (document.getElementById('zbsCustomTypeInput')?.value || '').trim();
  const chipText  = document.querySelector('#zbsWorldTypeChips .zbs-chip.on:not(.zbs-chip-custom)')?.textContent?.trim() || '';
  const typeLabel = customVal || chipText;
  if (!typeLabel) return;

  /* 找或创建回显区 */
  let tagWrap = document.getElementById('zbsWorldTypeTagWrap');
  if (!tagWrap) {
    tagWrap = document.createElement('div');
    tagWrap.id = 'zbsWorldTypeTagWrap';
    tagWrap.className = 'zbs-type-tag-wrap';
    tagWrap.innerHTML = `
      <span class="zbs-type-tag" id="zbsWorldTypeTag"></span>
      <span class="zbs-type-tag-hint">AI 已按此类型生成</span>
    `;
    /* 插到 textarea 后面（AI 按钮前面） */
    const btn = document.getElementById('zbsAiWorldBtn');
    btn.parentNode.insertBefore(tagWrap, btn);
  }

  document.getElementById('zbsWorldTypeTag').textContent = typeLabel;
  tagWrap.classList.add('show');
}
/* ================================================
   叙事节奏：自定义 chip 交互（与世界类型自定义同一模式）
================================================ */
function zbsTogglePaceCustom() {
  const wrap  = document.getElementById('zbsPaceCustomWrap');
  const chip  = document.getElementById('zbsPaceChipCustom');
  if (!wrap || !chip) return;
  const isOpen = wrap.classList.contains('show');
  if (isOpen) {
    wrap.classList.remove('show');
    chip.classList.remove('on');
    document.getElementById('zbsPaceCustomInput').value = '';
    chip.textContent = '自定义…';
    /* 恢复第一个预设 chip 选中 */
    const first = document.querySelector('#zbsPaceChips .zbs-chip:not(.zbs-chip-custom)');
    if (first) first.classList.add('on');
  } else {
    document.querySelectorAll('#zbsPaceChips .zbs-chip').forEach(c => c.classList.remove('on'));
    chip.classList.add('on');
    wrap.classList.add('show');
    setTimeout(() => document.getElementById('zbsPaceCustomInput').focus(), 100);
  }
}

function zbsOnPaceCustomInput() {
  const val  = (document.getElementById('zbsPaceCustomInput').value || '').trim();
  const chip = document.getElementById('zbsPaceChipCustom');
  if (!chip) return;
  chip.textContent = val ? (val.length > 6 ? val.slice(0,6)+'…' : val) : '自定义…';
}

/* 点预设节奏 chip 时关闭自定义输入框 */
document.addEventListener('DOMContentLoaded', () => {
  const paceGroup = document.getElementById('zbsPaceChips');
  if (paceGroup) {
    paceGroup.addEventListener('click', e => {
      const chip = e.target.closest('.zbs-chip');
      if (!chip || chip.id === 'zbsPaceChipCustom') return;
      const wrap = document.getElementById('zbsPaceCustomWrap');
      const cChip = document.getElementById('zbsPaceChipCustom');
      if (wrap) wrap.classList.remove('show');
      if (cChip) { cChip.classList.remove('on'); cChip.textContent = '自定义…'; }
      const inp = document.getElementById('zbsPaceCustomInput');
      if (inp) inp.value = '';
    });
  }
});
/* ================================================
   头部样式选择面板（zbh 命名空间）
   — 触发时机：创作设定最后一步「开始创作」
   — 流程：风格偏好输入 → AI生成4种方案 → 用户选择
           → 可存入风格库 → 进入故事
   — 状态栏 / 灵动岛 / 字体 100% 一比一复刻主页逻辑
================================================ */

/* ---- 同步状态栏内容到 header-style 面板 ---- */
function zbhSyncStatusBar() {
  /* 时间 */
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeStr = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const tEl = document.getElementById('zbhStatusTime');
  if (tEl) tEl.textContent = timeStr;

  /* 电量 */
  const pctEl   = document.getElementById('zbhBatPct');
  const innerEl = document.getElementById('zbhBatInner');
  function renderBat(p) {
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
      renderBat(b.level * 100);
      b.addEventListener('levelchange', () => renderBat(b.level * 100));
    });
  } else {
    renderBat(76);
  }

  /* 灵动岛（一比一复刻，目标换为 zbhStatusIsland） */
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const iEl     = document.getElementById('zbhStatusIsland');
  if (iEl) {
    if (!enabled) { iEl.innerHTML = ''; }
    else {
      const styleMap = {
        minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
        glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
        clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="zbhSiClockText">--:--</span></div></div>`,
        pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
        ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
        rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
        music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
        scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
      };
      iEl.innerHTML = styleMap[style] || styleMap.minimal;
      clearInterval(window._zbhClockTimer);
      if (style === 'clock') {
        const tick = () => {
          const t = document.getElementById('zbhSiClockText');
          if (!t) return;
          const now = new Date();
          t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
        };
        tick();
        window._zbhClockTimer = setInterval(tick, 10000);
      }
    }
  }
}

/* 监听主页设置变化，实时同步到 header-style 面板 */
window.addEventListener('storage', e => {
  if (e.key === 'luna_island_update' || e.key === 'luna_tz_update') zbhSyncStatusBar();
});

/* ---- 当前选中的样式方案 ---- */
let _zbhSelectedIdx = -1;     /* 当前选中的方案索引 0-3，-1 为未选 */
let _zbhStyleData = null;      /* 当前生成的样式数据 */

/* ---- 打开面板：由创作设定「开始创作」调用 ---- */
function zbhOpen() {
  const overlay = document.getElementById('zbhOverlay');
  if (!overlay) return;
  overlay.classList.add('show');
  zbhSyncStatusBar();
  zbhInitPanel();
}

/* ---- 初始化面板状态 ---- */
function zbhInitPanel() {
  /* 重置到 Phase 1 */
  _zbhSelectedIdx = -1;
  _zbhStyleData = null;

  const phaseInit   = document.getElementById('zbhPhaseInit');
  const phaseSelect = document.getElementById('zbhPhaseSelect');
  const footInit    = document.getElementById('zbhFootInit');
  const footSelect  = document.getElementById('zbhFootSelect');
  const navSub      = document.getElementById('zbhNavSub');

  if (phaseInit)   phaseInit.classList.remove('zbh-phase-hidden');
  if (phaseSelect) phaseSelect.classList.add('zbh-phase-hidden');
  if (footInit)    footInit.style.display = '';
  if (footSelect)  footSelect.style.display = 'none';
  if (navSub)      navSub.textContent = '初始化';

  /* 填充故事摘要 */
  zbhRenderStorySummary();

  /* 重置 chips */
  document.querySelectorAll('#zbhMoodChips .zbh-chip').forEach(c => c.classList.remove('on'));

  /* 初始化 chips 多选事件（只绑定一次） */
  if (!window._zbhChipsInited) {
    window._zbhChipsInited = true;
    const chipsArea = document.getElementById('zbhMoodChips');
    if (chipsArea) {
      chipsArea.addEventListener('click', e => {
        const chip = e.target.closest('.zbh-chip');
        if (chip) chip.classList.toggle('on');
      });
    }
  }

  /* 滚动到顶 */
  const scroll = document.getElementById('zbhScroll');
  if (scroll) scroll.scrollTop = 0;
}

/* ---- 渲染故事摘要（从已有创作设定中读取） ---- */
function zbhRenderStorySummary() {
  const el = document.getElementById('zbhStorySummary');
  if (!el) return;

  const worldType = (document.querySelector('#zbsWorldTypeChips .zbs-chip.on:not(.zbs-chip-custom)')?.textContent?.trim())
    || (document.getElementById('zbsCustomTypeInput')?.value?.trim()) || '';
  const worldDesc = (document.getElementById('zbsWorldDesc')?.value || '').trim();
  const storyName = (document.getElementById('zbsStoryName')?.value || '').trim();
  const storyDesc = (document.getElementById('zbsStoryDesc')?.value || '').trim();
  const styleDesc = (document.getElementById('zbsStyleDesc')?.value || '').trim();

  const rows = [];
  if (storyName) rows.push({ label: '故事', val: storyName });
  if (worldType) rows.push({ label: '类型', val: worldType });
  if (worldDesc) rows.push({ label: '世界观', val: worldDesc.slice(0, 30) + (worldDesc.length > 30 ? '…' : '') });
  if (storyDesc) rows.push({ label: '故事简介', val: storyDesc.slice(0, 30) + (storyDesc.length > 30 ? '…' : '') });
  if (styleDesc) rows.push({ label: '文笔', val: styleDesc.slice(0, 24) + (styleDesc.length > 24 ? '…' : '') });

  if (!rows.length) {
    el.style.display = 'none';
    return;
  }
  el.style.display = '';
  el.innerHTML = rows.map(r => `
    <div class="zbh-ss-row">
      <span class="zbh-ss-label">${r.label}</span>
      <span class="zbh-ss-val">${r.val}</span>
    </div>
  `).join('');
}

/* ---- 关闭面板，返回创作设定 ---- */
function zbhClose() {
  const overlay = document.getElementById('zbhOverlay');
  if (overlay) overlay.classList.remove('show');
}

/* ---- 跳过：不选样式，直接进入故事 ---- */
function zbhSkipStyle() {
  zbhClose();
  /* 关闭创作设定面板 */
  document.getElementById('zbsOverlay')?.classList.remove('show');
  zbhDoEnterStory(null);
}

/* ================================================
   AI 生成头部样式方案
================================================ */

/* 收集当前故事所有设定，拼装 prompt */
function zbhBuildPrompt(regenNote) {
  const worldType = (document.querySelector('#zbsWorldTypeChips .zbs-chip.on:not(.zbs-chip-custom)')?.textContent?.trim())
    || (document.getElementById('zbsCustomTypeInput')?.value?.trim()) || '';
  const worldDesc = (document.getElementById('zbsWorldDesc')?.value || '').trim();
  const storyName = (document.getElementById('zbsStoryName')?.value || '').trim();
  const storyDesc = (document.getElementById('zbsStoryDesc')?.value || '').trim();
  const styleDesc = (document.getElementById('zbsStyleDesc')?.value || '').trim();
  const tones = [...document.querySelectorAll('#zbsToneChips .zbs-chip.on')].map(c => c.textContent.trim()).join('、') || '';
  const paceDesc = (document.getElementById('zbsPaceVal')?.textContent || '均衡');

  /* 用户在头部样式面板输入的偏好 */
  const prefText = (document.getElementById('zbhStylePref')?.value || '').trim();
  const moodTags = [...document.querySelectorAll('#zbhMoodChips .zbh-chip.on')].map(c => c.textContent.trim()).join('、');

  const ctx = [
    storyName    ? `故事名称：${storyName}` : '',
    worldType    ? `世界类型：${worldType}` : '',
    worldDesc    ? `世界观：${worldDesc.slice(0, 100)}` : '',
    storyDesc    ? `故事简介：${storyDesc.slice(0, 100)}` : '',
    styleDesc    ? `文笔风格：${styleDesc.slice(0, 60)}` : '',
    tones        ? `故事基调：${tones}` : '',
    `叙事节奏：${paceDesc}`,
    prefText     ? `用户偏好：${prefText}` : '',
    moodTags     ? `风格倾向标签：${moodTags}` : '',
    regenNote    ? `上次不满意的点：${regenNote}` : '',
  ].filter(Boolean).join('\n');

  return `你是一名互动小说 UI 设计师，擅长为故事设计开场头部排版样式。
当前故事设定如下：
${ctx}

请基于以上设定，设计 4 种差异化的头部开场样式方案，每种方案在视觉语言上需有明显区别。

严格以 JSON 数组格式输出，每个元素包含：
- index: 方案序号，1 到 4
- name: 样式名称（3-6字，如「留白与重音」「章页编排」）
- tag: 风格标签（2-4字，如「极简」「编辑式」「结构感」「沉浸式」）
- style: 预设样式类型，必须从以下 4 个值中取一个且每种只能用一次：A（极简黑底居中）、B（章页编排白底左对齐）、C（左右数据分栏）、D（深色渐变氛围满版）
- preview: 用于填充预览区的数据对象，包含以下字段（根据 style 类型）：
  - A 类型：{ subtitle: "副标题/地点年代（英文，15字以内）", title: "故事标题（中文，2-8字）" }
  - B 类型：{ chapterLabel: "Chapter · 序号（英文）", ghostChar: "单个汉字背景装饰", title: "故事标题（中文）", meta: "场景描述（中文，10字以内）" }
  - C 类型：{ episodeLabel: "Episode", title: "故事标题（中文，可换行，4字以内含换行）", num: "01" }
  - D 类型：{ brandLeft: "品牌或故事名（英文）", brandRight: "Vol. 01", title: "故事标题（中文，可换行）" }
- desc: 对该样式的简短描述（20-35字，向用户解释视觉风格与适合场景）

只输出 JSON 数组，不要任何额外说明、不要代码块标记。`;
}

/* 渲染单个卡片预览 HTML */
function zbhRenderPreview(style, preview, storyTitle) {
  const title = storyTitle || preview.title || '故事标题';

  if (style === 'A') {
    return `<div class="zbh-prev-a">
      <div class="zbh-pv-label">${preview.subtitle || 'Story · 2046'}</div>
      <div class="zbh-pv-title">${title.split('').join(' ')}</div>
      <div class="zbh-pv-rule"></div>
    </div>`;
  }
  if (style === 'B') {
    return `<div class="zbh-prev-b">
      <div class="zbh-pv-ghost">${preview.ghostChar || '序'}</div>
      <div class="zbh-pv-chapter">${preview.chapterLabel || 'Chapter · 01'}</div>
      <div class="zbh-pv-title">${title}</div>
      <div class="zbh-pv-meta">${preview.meta || '凌晨四点 · 城市边缘'}</div>
    </div>`;
  }
  if (style === 'C') {
    const lines = title.length > 4 ? title.slice(0, 2) + '<br>' + title.slice(2) : title;
    return `<div class="zbh-prev-c">
      <div class="zbh-pv-left">
        <div class="zbh-pv-label">${preview.episodeLabel || 'Episode'}</div>
        <div class="zbh-pv-title">${lines}</div>
      </div>
      <div class="zbh-pv-right">
        <div class="zbh-pv-num">${preview.num || '01'}</div>
        <div class="zbh-pv-start">Start</div>
      </div>
    </div>`;
  }
  if (style === 'D') {
    const lines = title.length > 4 ? title.slice(0, 2) + '<br>' + title.slice(2) : title;
    return `<div class="zbh-prev-d">
      <div class="zbh-pv-top">
        <span>${preview.brandLeft || 'Zhi Bi'}</span>
        <span>${preview.brandRight || 'Vol. 01'}</span>
      </div>
      <div class="zbh-pv-title">${lines}</div>
    </div>`;
  }
  return `<div style="height:100%;background:#f5f5f5;display:flex;align-items:center;justify-content:center;font-size:11px;color:#bbb">${title}</div>`;
}

/* 渲染全部卡片 */
function zbhRenderCards(styles) {
  const container = document.getElementById('zbhCards');
  if (!container) return;
  const nums = ['I', 'II', 'III', 'IV'];

  container.innerHTML = styles.map((s, i) => {
    const preview = zbhRenderPreview(s.style, s.preview || {}, s.preview?.title);
    return `
    <div class="zbh-card${i === _zbhSelectedIdx ? ' selected' : ''}" onclick="zbhSelectCard(${i})">
      <div class="zbh-card-bar">
        <div class="zbh-card-bar-left">
          <span class="zbh-card-num">${nums[i] || (i+1)}</span>
          <span class="zbh-card-name">${s.name || '方案 ' + (i+1)}</span>
          <span class="zbh-card-tag">${s.tag || ''}</span>
        </div>
        <div class="zbh-card-radio"></div>
      </div>
      <div class="zbh-card-preview">${preview}</div>
      <div class="zbh-card-desc"><p>${s.desc || ''}</p></div>
    </div>`;
  }).join('');
}

/* 选中某个卡片 */
function zbhSelectCard(idx) {
  _zbhSelectedIdx = idx;
  document.querySelectorAll('.zbh-card').forEach((el, i) => {
    el.classList.toggle('selected', i === idx);
  });
}

/* 调用 AI 生成方案 */
async function zbhCallAI(prompt) {
  const apiCfg = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model  = localStorage.getItem('luna_api_model') || '';
  if (!apiCfg.baseUrl || !apiCfg.apiKey) {
    zbsShowToast('请先在设置中配置 AI 模型');
    return null;
  }
  if (!model) {
    zbsShowToast('请先在设置中选择模型');
    return null;
  }

  const baseUrl = apiCfg.baseUrl.replace(/\/$/, '');
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiCfg.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1200
    })
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  let result = (data.choices?.[0]?.message?.content || '').trim();
  result = result.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
  return JSON.parse(result);
}

/* 首次生成 */
async function zbhGenStyles() {
  const btn     = document.getElementById('zbhGenBtn');
  const btnFoot = document.getElementById('zbhBtnGenFoot');

  /* 禁用按钮，显示生成中 */
  const loadingHtml = '<span class="zbh-ai-blink"><span>.</span><span>.</span><span>.</span></span> 生成中';
  if (btn)     { btn.disabled = true;     btn.innerHTML = loadingHtml; }
  if (btnFoot) { btnFoot.disabled = true; btnFoot.textContent = '生成中…'; }

  try {
    const prompt = zbhBuildPrompt(null);
    const styles = await zbhCallAI(prompt);
    if (!Array.isArray(styles) || !styles.length) throw new Error('未生成有效方案');

    _zbhStyleData = styles;
    _zbhSelectedIdx = 0; /* 默认选中第一个 */

    /* 切换到 Phase 2 */
    document.getElementById('zbhPhaseInit').classList.add('zbh-phase-hidden');
    document.getElementById('zbhPhaseSelect').classList.remove('zbh-phase-hidden');
    document.getElementById('zbhFootInit').style.display = 'none';
    document.getElementById('zbhFootSelect').style.display = '';
    document.getElementById('zbhNavSub').textContent = '选择样式';

    zbhRenderCards(styles);

    const scroll = document.getElementById('zbhScroll');
    if (scroll) scroll.scrollTop = 0;

    zbsShowToast('样式方案已生成，请选择你喜欢的一种');
  } catch (e) {
    zbsShowToast('生成失败：' + e.message);
  } finally {
    if (btn)     { btn.disabled = false;     btn.innerHTML = '<span class="zbh-ai-dot"></span>AI 生成头部样式方案'; }
    if (btnFoot) { btnFoot.disabled = false; btnFoot.textContent = '生成样式方案'; }
  }
}

/* 显示/隐藏「换一批」的问题反馈面板 */
function zbhShowRegenPanel() {
  const panel = document.getElementById('zbhRegenPanel');
  if (!panel) return;
  const isShown = panel.classList.contains('show');
  if (isShown) {
    panel.classList.remove('show');
  } else {
    panel.classList.add('show');
    setTimeout(() => panel.querySelector('textarea')?.focus(), 80);
  }
}

/* 重新生成：带用户反馈 */
async function zbhRegenStyles() {
  const regenNote = (document.getElementById('zbhRegenNote')?.value || '').trim();
  const panel     = document.getElementById('zbhRegenPanel');
  const genBtn    = panel?.querySelector('.zbh-gen-btn');

  if (genBtn) { genBtn.disabled = true; genBtn.innerHTML = '<span class="zbh-ai-blink"><span>.</span><span>.</span><span>.</span></span> 重新生成中'; }

  try {
    const prompt = zbhBuildPrompt(regenNote || null);
    const styles = await zbhCallAI(prompt);
    if (!Array.isArray(styles) || !styles.length) throw new Error('未生成有效方案');

    _zbhStyleData = styles;
    _zbhSelectedIdx = 0;
    zbhRenderCards(styles);

    /* 关闭问题面板 */
    panel?.classList.remove('show');
    if (document.getElementById('zbhRegenNote')) document.getElementById('zbhRegenNote').value = '';

    zbsShowToast('已根据你的反馈重新生成');
  } catch (e) {
    zbsShowToast('生成失败：' + e.message);
  } finally {
    if (genBtn) { genBtn.disabled = false; genBtn.innerHTML = '<span class="zbh-ai-dot"></span>重新生成'; }
  }
}

/* ---- 存入风格库 ---- */
async function zbhSaveStyle() {
  if (_zbhSelectedIdx < 0 || !_zbhStyleData) {
    zbsShowToast('请先选择一个样式方案');
    return;
  }
  const selected = _zbhStyleData[_zbhSelectedIdx];
  const extraNote = (document.getElementById('zbhExtraNote')?.value || '').trim();

  /* 复用 ZhibiSetupDB */
  try {
    const db = await zbsOpenDB();
    const record = {
      name: selected.name || '未命名样式',
      style: selected.style,
      tag: selected.tag,
      preview: selected.preview,
      desc: selected.desc,
      extraNote,
      time: Date.now()
    };
    await new Promise((res, rej) => {
      const stores = db.objectStoreNames;
      /* 动态新建 store 需要版本升级，这里存到 story_lib 作为兼容方案 */
      /* 实际可根据项目扩展为专属 header_style_lib store */
      const storeName = stores.contains('header_style_lib') ? 'header_style_lib' : 'story_lib';
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).add({ name: `[头部样式] ${record.name}`, desc: JSON.stringify(record), time: record.time });
      tx.oncomplete = () => res();
      tx.onerror = () => rej();
    });
    zbsShowToast(`「${selected.name}」已存入风格库`);
  } catch (e) {
    zbsShowToast('存入失败，请重试');
  }
}

/* ---- 进入故事 ---- */
function zbhEnterStory() {
  if (_zbhSelectedIdx < 0 || !_zbhStyleData) {
    zbsShowToast('请先选择一个样式方案，或点击「跳过」让 AI 自由决定');
    return;
  }
  const selected = _zbhStyleData[_zbhSelectedIdx];
  const extraNote = (document.getElementById('zbhExtraNote')?.value || '').trim();

  zbhClose();
  document.getElementById('zbsOverlay')?.classList.remove('show');
  zbhDoEnterStory({ ...selected, extraNote });
}

/* 实际进入故事的动作（样式可为 null 表示跳过） */
function zbhDoEnterStory(styleChoice) {
  /* 收集全部创作设定 */
  const settings = zbhCollectSettings();
  settings.headerStyle = styleChoice;

  zbsShowToast('正在启动创作…');
  console.log('[执笔] 启动创作，设定：', settings);
  /* TODO: 跳转游戏页面并传入设定 */
  /* window.location.href = 'zhibi-game.html?new=1'; */
}

/* 收集全部创作设定（复用 zbsStartCreate 的数据收集逻辑） */
function zbhCollectSettings() {
  return {
    worldName:  document.getElementById('zbsWorldName')?.value?.trim() || '',
    worldDesc:  document.getElementById('zbsWorldDesc')?.value?.trim() || '',
    worldType:  document.querySelector('#zbsWorldTypeChips .zbs-chip.on')?.textContent?.trim() || '',
    styleName:  document.getElementById('zbsStyleName')?.value?.trim() || '',
    styleDesc:  document.getElementById('zbsStyleDesc')?.value?.trim() || '',
    pov:        document.getElementById('zbsPovSelVal')?.textContent || '',
    chapterWc:  document.getElementById('zbsWcInput')?.value || '1200',
    storyName:  document.getElementById('zbsStoryName')?.value?.trim() || '',
    storyDesc:  document.getElementById('zbsStoryDesc')?.value?.trim() || '',
    opening:    document.getElementById('zbsOpeningDesc')?.value?.trim() || '',
    ending:     document.getElementById('zbsEndingSelVal')?.textContent || '',
  };
}

/* ================================================
   替换原 zbsStartCreate：先打开头部样式选择面板
================================================ */
/* 覆盖原有的 zbsStartCreate，使「开始创作」按钮触发头部样式选择流程 */
zbsStartCreate = function() {
  _zbsStartConfirmed = false;
  zbhOpen();
};
/* ================================================================
   创作游戏页面逻辑（zbg 命名空间）
   动态头部渲染 · 状态栏同步 · 花开悬浮球 · 弹窗系统
================================================================ */

/* ---- 状态变量 ---- */
let _zbgFabOpen = false;
let _zbgCurrentSettings = null; /* 从 zbhDoEnterStory 传入的完整设定 */
let _zbgChapterNum = 1;

/* ================================================================
   入口：覆盖 zbhDoEnterStory，加入游戏页面展示逻辑
================================================================ */
const _zbgOrigEnterStory = typeof zbhDoEnterStory === 'function' ? zbhDoEnterStory : null;

zbhDoEnterStory = function(styleChoice) {
  /* 保存设定供后续使用 */
  const settings = zbhCollectSettings();
  settings.headerStyle = styleChoice;
  _zbgCurrentSettings = settings;

  /* 关闭所有前置面板 */
  document.getElementById('zbhOverlay')?.classList.remove('show');
  document.getElementById('zbsOverlay')?.classList.remove('show');

  /* 打开游戏页 */
  zbgOpen(settings);
};

/* ================================================================
   打开游戏页
================================================================ */
function zbgOpen(settings) {
  const overlay = document.getElementById('zbgOverlay');
  if (!overlay) return;
  overlay.classList.add('show');

  /* 同步状态栏 */
  zbgSyncStatusBar();

  /* 渲染已选样式名称 badge */
  const styleName = settings?.headerStyle?.name || settings?.headerStyle?.tag || '自动生成';
  const styleNameEl = document.getElementById('zbgStyleName');
  if (styleNameEl) styleNameEl.textContent = styleName;

  /* 渲染动态头部 */
  zbgRenderHeader(settings?.headerStyle);

  /* 重置等待界面 */
  zbgResetInitScreen();

  /* 注入故事封面入场动效（在 initScreen 之前播放） */
  zbgShowStoryCover(settings);

  /* 初始化悬浮球拖动（只绑定一次） */
  if (!_zbgFab._bound) {
    _zbgFab._bound = true;
    requestAnimationFrame(() => {
      _zbgFabInit();
      _zbgFabBindDrag();
    });
  }
}

/* ================================================================
   故事封面页 —— 进入游戏前的沉浸式开场
================================================================ */
function zbgShowStoryCover(settings) {
  /* 如果已存在则不重复 */
  if (document.getElementById('_zbgCoverPage')) return;

  const storyName = settings?.storyName || '未命名故事';
  const worldType = settings?.worldType || '';
  const worldDesc = (settings?.worldDesc || '').slice(0, 40);
  const opening   = (settings?.opening  || '').slice(0, 60);

  /* 根据世界类型选择配色方案 */
  const themes = {
    '仙侠': { bg: 'linear-gradient(160deg,#0a0818 0%,#150c2e 40%,#0d1a2e 70%,#081020 100%)', accent: '#a78bfa', fog: 'rgba(167,139,250,0.06)', particle: '#c4b5fd' },
    '玄幻': { bg: 'linear-gradient(160deg,#070c14 0%,#0f1c38 45%,#1a0c08 75%,#080408 100%)', accent: '#fb923c', fog: 'rgba(251,146,60,0.07)', particle: '#fcd34d' },
    '武侠': { bg: 'linear-gradient(160deg,#0d0905 0%,#1c1208 45%,#0d0d08 75%,#080808 100%)', accent: '#d97706', fog: 'rgba(217,119,6,0.07)', particle: '#fde68a' },
    '末世': { bg: 'linear-gradient(160deg,#080808 0%,#111110 40%,#141008 65%,#080808 100%)', accent: '#ef4444', fog: 'rgba(239,68,68,0.06)', particle: '#fca5a5' },
    '现代': { bg: 'linear-gradient(160deg,#050a14 0%,#0a1628 45%,#050a14 100%)', accent: '#38bdf8', fog: 'rgba(56,189,248,0.06)', particle: '#7dd3fc' },
  };
  const defaultTheme = { bg: 'linear-gradient(160deg,#0d0a12 0%,#160e24 40%,#0d0a12 100%)', accent: '#c8a84b', fog: 'rgba(200,168,75,0.06)', particle: '#e8dfc0' };
  const theme = themes[worldType] || defaultTheme;

  const cover = document.createElement('div');
  cover.id = '_zbgCoverPage';
  cover.setAttribute('style', [
    'position:fixed;inset:0;z-index:10000;',
    'background:' + theme.bg + ';',
    'display:flex;flex-direction:column;align-items:center;justify-content:center;',
    'overflow:hidden;cursor:pointer;',
    'opacity:0;transition:opacity 0.8s ease;'
  ].join(''));

  /* 星尘粒子背景 */
  const canvas = document.createElement('canvas');
  canvas.setAttribute('style', 'position:absolute;inset:0;pointer-events:none;opacity:0.5;');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  cover.appendChild(canvas);

  /* 雾气层 */
  const fog = document.createElement('div');
  fog.setAttribute('style', [
    'position:absolute;inset:0;pointer-events:none;',
    'background:radial-gradient(ellipse 80% 50% at 50% 60%,' + theme.fog + ' 0%,transparent 70%);',
    'animation:_zbgCoverFog 6s ease-in-out infinite alternate;'
  ].join(''));
  cover.appendChild(fog);

  /* 中央内容 */
  const content = document.createElement('div');
  content.setAttribute('style', 'position:relative;z-index:2;text-align:center;padding:0 36px;max-width:360px;');
  content.innerHTML = [
    /* 章节序号 */
    '<div style="font-family:\'Cormorant Garamond\',\'Georgia\',serif;font-style:italic;',
    'font-weight:300;font-size:11px;letter-spacing:0.4em;color:' + theme.accent + ';',
    'opacity:0;transition:opacity 0.8s 0.4s,transform 0.8s 0.4s;transform:translateY(12px);',
    'margin-bottom:28px;" id="_zbgCvSub">',
    (worldType ? worldType + ' · ' : '') + '互动故事',
    '</div>',
    /* 分隔线 */
    '<div style="width:40px;height:0.5px;background:' + theme.accent + ';margin:0 auto 28px;',
    'opacity:0;transition:opacity 0.8s 0.6s,width 1s 0.6s;transform:scaleX(0);",id="_zbgCvRule"></div>',
    /* 故事标题 */
    '<div style="font-family:\'Noto Serif SC\',\'Source Han Serif SC\',serif;',
    'font-weight:200;font-size:32px;letter-spacing:0.35em;text-indent:0.35em;',
    'color:#f5f0e8;line-height:1.4;',
    'opacity:0;transition:opacity 1s 0.7s,transform 1s 0.7s;transform:translateY(16px);",id="_zbgCvTitle">',
    storyName,
    '</div>',
    /* 世界描述 */
    (worldDesc ? [
      '<div style="margin-top:20px;font-size:12px;line-height:1.8;letter-spacing:0.08em;',
      'color:rgba(245,240,232,0.45);max-width:280px;margin-left:auto;margin-right:auto;',
      'opacity:0;transition:opacity 0.8s 1s,transform 0.8s 1s;transform:translateY(8px);" id="_zbgCvDesc">',
      worldDesc + (opening ? '<br><br>' + opening : ''),
      '</div>'
    ].join('') : ''),
    /* 点击提示 */
    '<div style="margin-top:48px;font-size:11px;letter-spacing:0.3em;',
    'color:' + theme.accent + ';opacity:0;',
    'transition:opacity 0.6s 1.6s;animation:_zbgCoverBlink 2.5s 2.2s ease-in-out infinite;" id="_zbgCvHint">',
    '点击任意处  开始故事',
    '</div>'
  ].join('');
  cover.appendChild(content);

  /* 注入关键帧 */
  if (!document.getElementById('_zbgCoverKF')) {
    const kf = document.createElement('style');
    kf.id = '_zbgCoverKF';
    kf.textContent = [
      '@keyframes _zbgCoverFog{from{opacity:0.4;transform:scale(1)}to{opacity:1;transform:scale(1.08)}}',
      '@keyframes _zbgCoverBlink{0%,100%{opacity:0.35}50%{opacity:1}}',
      '@keyframes _zbgCoverParticle{0%{opacity:0;transform:translateY(0)}30%{opacity:0.8}100%{opacity:0;transform:translateY(-120px)}}'
    ].join('');
    document.head.appendChild(kf);
  }

  document.body.appendChild(cover);

  /* 淡入封面 */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      cover.style.opacity = '1';
      /* 依次触发内部动效 */
      setTimeout(() => {
        const sub  = document.getElementById('_zbgCvSub');
        const rule = document.getElementById('_zbgCvRule');
        const titl = document.getElementById('_zbgCvTitle');
        const desc = document.getElementById('_zbgCvDesc');
        const hint = document.getElementById('_zbgCvHint');
        if (sub)  { sub.style.opacity = '1';  sub.style.transform = ''; }
        if (rule) { rule.style.opacity = '1'; rule.style.transform = 'scaleX(1)'; rule.style.width = '60px'; }
        if (titl) { titl.style.opacity = '1'; titl.style.transform = ''; }
        if (desc) { desc.style.opacity = '1'; desc.style.transform = ''; }
        if (hint) { hint.style.opacity = '1'; }
      }, 200);

      /* 粒子效果 */
      const ctx2d = canvas.getContext('2d');
      if (ctx2d) {
        const particles = Array.from({length: 40}, () => ({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height + canvas.height * 0.3,
          size: Math.random() * 1.5 + 0.3,
          speed: Math.random() * 0.4 + 0.1,
          opacity: 0,
          maxOpacity: Math.random() * 0.6 + 0.2,
          drift: (Math.random() - 0.5) * 0.3,
          life: Math.random(),
        }));
        function animPart() {
          if (!document.getElementById('_zbgCoverPage')) return;
          ctx2d.clearRect(0, 0, canvas.width, canvas.height);
          particles.forEach(p => {
            p.life += 0.003;
            if (p.life > 1) { p.life = 0; p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
            p.y -= p.speed;
            p.x += p.drift;
            p.opacity = p.life < 0.3 ? (p.life / 0.3) * p.maxOpacity : p.life > 0.7 ? ((1 - p.life) / 0.3) * p.maxOpacity : p.maxOpacity;
            ctx2d.globalAlpha = p.opacity;
            ctx2d.fillStyle = theme.particle;
            ctx2d.beginPath();
            ctx2d.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx2d.fill();
          });
          requestAnimationFrame(animPart);
        }
        animPart();
      }
    });
  });

  /* 点击任意处 → 淡出封面，进入等待界面 */
  cover.addEventListener('click', function dismissCover() {
    cover.style.opacity = '0';
    cover.style.pointerEvents = 'none';
    setTimeout(() => {
      cover.remove();
    }, 850);
  });

  /* 10秒无操作后自动淡出 */
  setTimeout(() => {
    if (document.getElementById('_zbgCoverPage')) {
      cover.click();
    }
  }, 12000);
}

/* ================================================================
   动态头部渲染
   styleChoice 结构：{ name, tag, style:{...css/html...}, preview, desc }
   AI 生成的头部 HTML 存在 styleChoice.headerHTML 字段；
   若无 headerHTML，则用 style 对象生成骨架过渡头部
================================================================ */
function zbgRenderHeader(styleChoice) {
  const mount = document.getElementById('zbgHeaderMount');
  if (!mount) return;

  /* 无样式选择：保留默认骨架，直接返回 */
  if (!styleChoice) return;

  /* 若 AI 直接返回了完整 HTML（headerHTML 字段），注入它 */
  if (styleChoice.headerHTML) {
    mount.innerHTML = styleChoice.headerHTML;
    zbgInjectHeaderBadges(mount);
    zbgDetectHeaderTheme(mount);
    return;
  }

  /* 否则：根据 style 对象生成动态头部 */
  const s = styleChoice.style || {};
  const bg = s.background || s.bg || 'linear-gradient(175deg,#080808 0%,#111 18%,#1a1a1a 40%,#3a3a3a 62%,#888 80%,#d8d8d8 93%,#f0f0f0 100%)';
  const titleColor = s.titleColor || s.textColor || '#ebebeb';
  const subColor   = s.subColor   || 'rgba(255,255,255,.3)';
  const divColor   = s.divColor   || 'rgba(255,255,255,.12)';
  const isDark     = zbgIsColorDark(titleColor);

  /* 故事标题：优先取用户填写的 storyName，降级用「序章」 */
  const storyTitle = _zbgCurrentSettings?.storyName || '序 章';
  const chapterLabel = 'Chapter I · Prologue';

  mount.innerHTML = `
    <div class="zbg-dyn-header" style="
      width:100%; min-height:220px;
      background:${bg};
      position:relative;
      display:flex; flex-direction:column;
      align-items:center; justify-content:flex-end;
      padding-bottom:32px; overflow:hidden;
    ">
      <!-- 装饰背景 -->
      <div style="position:absolute;inset:0;pointer-events:none;overflow:hidden">
        <div style="position:absolute;border-radius:50%;border:.4px solid rgba(255,255,255,.04);width:110px;height:110px;left:50%;top:50%;transform:translate(-50%,-50%)"></div>
        <div style="position:absolute;border-radius:50%;border:.4px solid rgba(255,255,255,.03);width:200px;height:200px;left:50%;top:50%;transform:translate(-50%,-50%)"></div>
        <div style="position:absolute;border-radius:50%;border:.3px solid rgba(255,255,255,.02);width:290px;height:290px;left:50%;top:50%;transform:translate(-50%,-50%)"></div>
        <div style="position:absolute;width:.4px;height:170%;background:rgba(255,255,255,.028);left:28%;top:-35%;transform:rotate(14deg)"></div>
        <div style="position:absolute;width:.4px;height:170%;background:rgba(255,255,255,.028);right:28%;top:-35%;transform:rotate(-14deg)"></div>
        <div style="position:absolute;width:170px;height:90px;background:radial-gradient(ellipse,rgba(255,255,255,.045) 0%,transparent 70%);left:50%;top:42%;transform:translate(-50%,-50%)"></div>
      </div>
      <!-- 中心内容 -->
      <div style="display:flex;flex-direction:column;align-items:center;gap:9px;position:relative;z-index:2">
        <div style="width:50px;height:50px;border-radius:50%;border:.5px solid rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;position:relative">
          <div style="position:absolute;inset:5px;border-radius:50%;border:.5px solid rgba(255,255,255,.09)"></div>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <line x1="5" y1="17" x2="17" y2="5" stroke="rgba(255,255,255,.68)" stroke-width=".9"/>
            <line x1="5" y1="11" x2="14" y2="11" stroke="rgba(255,255,255,.3)" stroke-width=".7"/>
            <line x1="5" y1="14" x2="10" y2="14" stroke="rgba(255,255,255,.18)" stroke-width=".7"/>
            <circle cx="17" cy="5" r="2.2" stroke="rgba(255,255,255,.48)" stroke-width=".7" fill="none"/>
          </svg>
        </div>
        <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:200;font-size:9px;letter-spacing:.25em;color:${subColor}">${chapterLabel}</div>
        <div style="font-family:'Noto Serif SC',serif;font-weight:200;font-size:21px;letter-spacing:.55em;text-indent:.55em;color:${titleColor}">${storyTitle}</div>
        <div style="display:flex;align-items:center;gap:6px;padding:0 40px;width:100%">
          <div style="flex:1;height:.3px;background:${divColor}"></div>
          <div style="width:4px;height:4px;border:.4px solid ${divColor};transform:rotate(45deg);flex-shrink:0"></div>
          <div style="flex:1;height:.3px;background:${divColor}"></div>
          <div style="width:4px;height:4px;border:.4px solid ${divColor};transform:rotate(45deg);flex-shrink:0"></div>
          <div style="flex:1;height:.3px;background:${divColor}"></div>
        </div>
      </div>
    </div>
  `;

  zbgInjectHeaderBadges(mount);
  zbgDetectHeaderTheme(mount);
}

/* 在注入的头部 HTML 中补充 badge（样式名 + 同步状态） */
function zbgInjectHeaderBadges(mount) {
  const existing = mount.querySelectorAll('.zbg-style-badge, .zbg-sync-badge');
  existing.forEach(el => el.remove());

  const badge1 = document.getElementById('zbgStyleBadge');
  const badge2 = document.getElementById('zbgSyncBadge');
  /* 把 badge 移到 mount 内部第一个子元素 */
  const inner = mount.firstElementChild;
  if (inner && badge1) inner.appendChild(badge1);
  if (inner && badge2) inner.appendChild(badge2);
}

/* 判断头部是深色还是浅色，设置状态栏颜色主题 */
function zbgDetectHeaderTheme(mount) {
  const el = mount.firstElementChild;
  if (!el) return;
  /* 取 data-theme 属性（AI 生成的 HTML 可标注），否则检测背景色亮度 */
  const theme = el.getAttribute('data-theme') || '';
  const sb = document.getElementById('zbgOverlay')?.querySelector('.zbg-status-bar')
          || document.querySelector('.zbg-status-bar');
  if (!sb) return;
  if (theme === 'light') {
    sb.classList.add('zbg-sb-light');
    sb.classList.remove('zbg-sb-dark');
    mount.classList.add('zbg-header-light');
  } else {
    sb.classList.add('zbg-sb-dark');
    sb.classList.remove('zbg-sb-light');
    mount.classList.remove('zbg-header-light');
  }
}

/* 简单判断颜色是否为浅色（供内部判断用） */
function zbgIsColorDark(color) {
  if (!color) return true;
  if (color.startsWith('rgba') || color.startsWith('rgb')) {
    const nums = color.match(/[\d.]+/g);
    if (nums && nums.length >= 3) {
      const [r, g, b] = nums.map(Number);
      return (r * 299 + g * 587 + b * 114) / 1000 < 128;
    }
  }
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0,2),16);
    const g = parseInt(hex.slice(2,4),16);
    const b = parseInt(hex.slice(4,6),16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }
  return true;
}

/* ================================================================
   状态栏同步（与其他面板保持一致）
================================================================ */
function zbgSyncStatusBar() {
  /* 时间 */
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeStr = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const tEl = document.getElementById('zbgStatusTime');
  if (tEl) tEl.textContent = timeStr;

  /* 电量 */
  const pctEl   = document.getElementById('zbgBatPct');
  const innerEl = document.getElementById('zbgBatInner');
  function renderBat(p) {
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
      renderBat(b.level * 100);
      b.addEventListener('levelchange', () => renderBat(b.level * 100));
    });
  } else { renderBat(76); }

  /* 灵动岛（复用已有 applyIsland 逻辑，目标换为 zbgStatusIsland） */
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const iEl     = document.getElementById('zbgStatusIsland');
  if (iEl) {
    if (!enabled) { iEl.innerHTML = ''; }
    else {
      const styleMap = {
        minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
        glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
        clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="zbgSiClockText">--:--</span></div></div>`,
        pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
        ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
        rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
        music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
        scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
      };
      iEl.innerHTML = styleMap[style] || styleMap.minimal;
      clearInterval(window._zbgClockTimer);
      if (style === 'clock') {
        const tick = () => {
          const t = document.getElementById('zbgSiClockText');
          if (!t) return;
          const now = new Date();
          t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
        };
        tick();
        window._zbgClockTimer = setInterval(tick, 10000);
      }
    }
  }
}

/* 监听主页设置变化，实时同步 */
window.addEventListener('storage', e => {
  if (['luna_island_update','luna_tz_update','luna_font_update'].includes(e.key)) {
    zbgSyncStatusBar();
  }
});

/* 时间每 15 秒刷新 */
setInterval(() => {
  if (document.getElementById('zbgOverlay')?.classList.contains('show')) {
    zbgSyncStatusBar();
  }
}, 15000);

/* ================================================================
   唤醒故事按钮
================================================================ */

/* 内置言情随机提示词（无用户设定时使用） */
const ZBG_ROMANCE_PROMPTS = [
  '随机生成一个古风言情故事开场：豪门公子与落魄千金的相遇，场景在花灯节。',
  '随机生成一个都市言情故事开场：冷酷总裁与独立设计师在电梯事故中相遇。',
  '随机生成一个古风言情故事开场：将军府小姐乔装出逃，误入江湖少侠的客栈。',
  '随机生成一个现代言情故事开场：青梅竹马重逢，她已是知名作家，他却成了她书的责编。',
  '随机生成一个仙侠言情故事开场：天界仙女下凡历劫，遇上记忆封印的魔君。',
  '随机生成一个古风言情故事开场：皇帝微服私访，与民间才女在诗会上对弈斗诗。',
  '随机生成一个都市言情故事开场：失忆男主被女主救回家，醒来发现自己是她暗恋多年的人。',
  '随机生成一个古风言情故事开场：侯府千金被赐婚给传说中冷漠的摄政王，大婚之夜发现他另有隐情。',
];

function zbgGetRandomRomancePrompt() {
  return ZBG_ROMANCE_PROMPTS[Math.floor(Math.random() * ZBG_ROMANCE_PROMPTS.length)];
}

/* ============================================================
   章节历史记录：追踪已经发生的剧情，用于生成下一章
============================================================ */
let _zbgChapterHistory = [];  /* [{choiceText, summary}] */
let _zbgCurrentChapterChoice = null; /* 玩家选择的文本 */

/* 根据用户设定拼装提示词 */
function zbgBuildStoryPrompt(settings) {
  const hasSettings = settings && (
    settings.storyName || settings.storyDesc || settings.worldDesc ||
    settings.worldType || settings.styleDesc || settings.opening
  );

  /* ================================================================
     技术骨架模板 —— 提供给 AI 的完整代码框架
  ================================================================ */
  const scriptTemplate = `
<script>
(function(){
  /* ① 注入 @keyframes */
  var _ks = document.createElement('style');
  _ks.textContent = [
    '@keyframes zbgFadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}',
    '@keyframes zbgThoughtIn{from{opacity:0;transform:translateX(-8px) scale(.97)}to{opacity:1;transform:translateX(0) scale(1)}}',
    '@keyframes zbgFloat{0%{opacity:0;transform:translateY(0)}50%{opacity:.7}100%{opacity:0;transform:translateY(-60px)}}',
    '@keyframes zbgPulse{0%,100%{opacity:.3}50%{opacity:.9}}',
    '@keyframes zbgShimmer{0%{background-position:-200% center}100%{background-position:200% center}}',
    '@keyframes zbgLetterDrop{from{opacity:0;transform:translateY(-20px)}to{opacity:1;transform:translateY(0)}}',
    '@keyframes zbgInkSpread{from{clip-path:circle(0% at 50% 50%)}to{clip-path:circle(150% at 50% 50%)}}'
  ].join('');
  document.head.appendChild(_ks);

  /* ② 氛围层 —— 由AI根据故事世界观自行用JS生成动态氛围元素 */
  var _atmo = document.getElementById('_zbgAtmo');
  /* AI在此处生成与场景气质完全匹配的氛围元素，不要套用通用粒子 */

  /* ③ 场景特殊交互注册区 —— AI可在此注册本章特有的交互函数
        例如：信纸展开、机关解密、地图标记、物品检视等
        函数名挂到 window 上，可在HTML中直接调用 */
  /* AI自由扩展 */

  /* ④ window.zbgT_expand —— 细节展开（自适应场景主题色） */
  window.zbgT_expand = function(el) {
    /* 关闭已存在的浮层 */
    var existing = document.querySelector('._zbgThought');
    if (existing) {
      existing.style.opacity = '0';
      existing.style.transform = 'translateY(-6px)';
      setTimeout(function(){ if(existing.parentNode) existing.parentNode.removeChild(existing); }, 200);
      if (existing.parentNode === el.parentNode && existing.previousSibling === el) return;
    }

    /* 读取场景主题（由AI在容器上通过 data-scene-theme 标注，或自动检测） */
    var cont = document.getElementById('zbg-story-cont');
    var theme = (cont && cont.dataset.sceneTheme) || (window._zbgSceneTheme) || 'dark';
    /* data-expand-type 控制展开类型：thought/sense/memory/clue/note */
    var expandType = el.dataset.expandType || 'thought';
    var content = el.dataset.thought || el.dataset.content || '';

    /* 根据场景主题和展开类型，动态生成差异化样式 */
    var themes = {
      dark:    { bg:'rgba(12,8,20,0.97)',   border:'rgba(180,140,80,0.35)',  text:'rgba(232,220,190,0.92)',  accent:'#c8a84b', shadow:'0 8px 32px rgba(0,0,0,0.8)' },
      ancient: { bg:'rgba(18,12,6,0.97)',   border:'rgba(160,120,60,0.4)',   text:'rgba(230,210,170,0.92)',  accent:'#b8903a', shadow:'0 8px 32px rgba(30,15,0,0.85)' },
      cold:    { bg:'rgba(6,12,24,0.97)',   border:'rgba(80,140,200,0.35)',  text:'rgba(190,215,240,0.92)',  accent:'#60a8d0', shadow:'0 8px 32px rgba(0,10,30,0.85)' },
      warm:    { bg:'rgba(20,10,4,0.97)',   border:'rgba(200,100,60,0.38)',  text:'rgba(240,210,185,0.92)',  accent:'#d87040', shadow:'0 8px 32px rgba(40,10,0,0.8)' },
      ink:     { bg:'rgba(8,10,8,0.97)',    border:'rgba(100,140,80,0.32)',  text:'rgba(200,220,180,0.9)',   accent:'#80a860', shadow:'0 8px 32px rgba(0,10,0,0.85)' },
    };
    /* 若AI在容器上标注了 data-scene-color，优先提取主色 */
    var sceneColor = cont && cont.dataset.sceneColor;
    var t = themes[theme] || themes.dark;
    if (sceneColor) {
      t = { bg:'rgba(10,8,14,0.97)', border: sceneColor.replace(')',',0.4)').replace('rgb(','rgba('), text:'rgba(232,220,200,0.92)', accent: sceneColor, shadow:'0 8px 32px rgba(0,0,0,0.85)' };
    }

    /* 展开类型对应的左边框色与标签 */
    var typeStyles = {
      thought: { bar: t.accent,  label: '·  内心' },
      sense:   { bar: '#7eb8d0', label: '·  感知' },
      memory:  { bar: '#9b7ec8', label: '·  记忆' },
      clue:    { bar: '#e07878', label: '·  线索' },
      note:    { bar: '#78a878', label: '·  旁注' },
    };
    var ts = typeStyles[expandType] || typeStyles.thought;

    var box = document.createElement('div');
    box.className = '_zbgThought';
    box.setAttribute('style', [
      'position:relative;',
      'background:' + t.bg + ';',
      'border:1px solid ' + t.border + ';',
      'border-left:2.5px solid ' + ts.bar + ';',
      'border-radius:0 10px 10px 0;',
      'padding:14px 16px 14px 18px;',
      'margin:10px 0 4px 8px;',
      'font-size:13.5px;line-height:1.95;letter-spacing:0.04em;',
      'color:' + t.text + ';',
      'box-shadow:' + t.shadow + ';',
      'cursor:pointer;',
      'opacity:0;transform:translateY(8px) translateX(-4px);',
      'transition:opacity 0.3s ease,transform 0.3s ease;',
      'backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);',
    ].join(''));
    box.innerHTML = [
      '<div style="font-size:10px;letter-spacing:0.22em;color:' + ts.bar + ';margin-bottom:8px;font-style:italic;">' + ts.label + '</div>',
      '<div style="line-height:1.95;">' + content + '</div>',
      '<div style="position:absolute;top:10px;right:12px;font-size:11px;color:rgba(255,255,255,0.25);cursor:pointer;" onclick="this.parentNode.remove()">✕</div>'
    ].join('');
    box.onclick = function(e){
      if(e.target.tagName!=='A') { box.style.opacity='0'; box.style.transform='translateY(-4px)'; setTimeout(function(){if(box.parentNode)box.parentNode.removeChild(box);},200); }
    };
    el.parentNode.insertBefore(box, el.nextSibling);
    /* 强制重排后触发动画 */
    box.getBoundingClientRect();
    requestAnimationFrame(function(){
      box.style.opacity = '1';
      box.style.transform = 'translateY(0) translateX(0)';
    });
  };

  /* ⑤ window.zbgT_choice —— 选项选择（调用AI生成下一章） */
  window.zbgT_choice = function(el, idx) {
    var choiceText = el.dataset.choiceText || el.textContent.trim() || ('选项' + idx);
    var rect = el.getBoundingClientRect();
    var cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
    /* 涟漪式过渡：从点击点向外扩散 */
    var mask = document.createElement('div');
    /* AI在这里设置与当前场景氛围一致的颜色（深色场景用深色，浅色场景用米白等） */
    mask.setAttribute('style',
      'position:fixed;inset:0;z-index:99999;pointer-events:all;' +
      'background:#0d0a12;' +
      'clip-path:circle(0% at '+cx+'px '+cy+'px);' +
      'transition:clip-path 0.65s cubic-bezier(0.4,0,0.2,1);'
    );
    document.body.appendChild(mask);
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){ mask.style.clipPath = 'circle(150% at '+cx+'px '+cy+'px)'; });
    });
    /* 等过渡完成后，调用AI生成下一章 */
    setTimeout(function(){
      mask.style.transition = 'opacity 0.35s';
      mask.style.opacity = '0';
      setTimeout(function(){ mask.remove(); }, 360);
      if (typeof zbgNextChapter === 'function') {
        zbgNextChapter(choiceText);
      }
    }, 700);
  };

  /* ⑥ 段落入场动效 */
  var _cont = document.getElementById('zbg-story-cont') || document.getElementById('zbgStoryContent');
  if (_cont) {
    var _paras = _cont.querySelectorAll('p,[data-anim]');
    _paras.forEach(function(p,i){
      p.style.opacity = '0';
      p.style.transform = 'translateY(10px)';
      p.style.transition = 'opacity 0.55s ease,transform 0.55s ease';
      p.style.transitionDelay = (i * 55 + 80) + 'ms';
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){ p.style.opacity='1'; p.style.transform=''; });
      });
    });
  }
})();
</script>`;

  /* ================================================================
     最终 prompt 拼装
  ================================================================ */
  const ctx = hasSettings ? [
    settings.storyName ? `故事名称：${settings.storyName}` : '',
    settings.worldType ? `世界类型：${settings.worldType}` : '',
    settings.worldDesc ? `世界观设定：${settings.worldDesc}` : '',
    settings.storyDesc ? `故事简介：${settings.storyDesc}` : '',
    settings.styleDesc ? `文笔风格：${settings.styleDesc}` : '',
    settings.opening   ? `开篇设定：${settings.opening}` : '',
    settings.pov       ? `叙事视角：${settings.pov}` : '',
    settings.ending    ? `结局走向：${settings.ending}` : '',
  ].filter(Boolean).join('\n') : (zbgGetRandomRomancePrompt ? zbgGetRandomRomancePrompt() : '');

  const wc = hasSettings ? Math.max(parseInt(settings?.chapterWc) || 1200, 1000) : 1200;

  return `你是一个顶级沉浸式互动文字游戏的 HTML 生成引擎。
你的任务是输出一段可以直接注入页面的 HTML+JS 代码片段，实现真正的游戏体验。

绝对禁止：禁止在任何地方使用 emoji 图标，包括正文、选项、道具、标签、按钮、装饰符号。

你不是在写小说。你在制作一个会动的、可以交互的、有质感的游戏场景。
字数设定（${wc}字）是整章的总量，分散在多个叙事段落中，每个段落100-250字，段落之间穿插交互元素。

═══════════════════════════════════════════════
 核心理念：以交互替代长段文字
═══════════════════════════════════════════════

本章内容必须按照"叙事段落 → 交互元素 → 叙事段落 → 交互元素"的节奏交替出现。
【禁止】连续出现超过3段正文而中间没有任何可点击交互元素。
【禁止】用大量文字描述玩家可以通过交互"探索"到的内容——把那些内容藏进交互里。
【要求】每个交互元素都要让玩家感受到"点了有惊喜"，而不是"点了只是看文字"。

═══════════════════════════════════════════════
 第一优先级：视觉设计 —— 每章都是独立的视觉作品
═══════════════════════════════════════════════

【整体视觉原则】
先确定本章场景：地点/时间/天气/光线/主角情绪。所有视觉选择服务于这个场景。
背景：必须是多层叠加的渐变，有层次感和纵深感。
禁止：白底黑字、灰色卡片、标准按钮、任何看起来像"网页"的东西。

【氛围层（id="_zbgAtmo"）】
必须用 JS 在氛围层里生成动态元素，与场景完全匹配：
- 深夜古宅 → 缓慢飘落的枯叶、隐约闪烁的灯火
- 皇宫大殿 → 飘散的熏香烟雾、描金纹路
- 现代都市 → 雨滴下落、霓虹光晕
- 荒野沙漠 → 风沙颗粒、热气扭曲
禁止套用通用星点粒子效果。

【正文排版】
字号17-19px，行高1.95-2.1，字间距0.06-0.1em，首行缩进2字符。
每段文字之间要有充分的呼吸空间（margin-bottom 24px 以上）。
章节标题要有设计感：序号用细英文、标题用粗中文、加装饰分隔线。

═══════════════════════════════════════════════
 第二优先级：文学质量 —— 克制而有质感
═══════════════════════════════════════════════

每段正文100-250字，克制、精准，把细节和情绪留给交互探索。
心理描写：用身体反应和感官细节，不要直接陈述情绪。
- 错："她感到害怕"
- 对："她的呼吸变浅了，手指在袖口里慢慢蜷起。"
动作描写：分解动作，用动作节奏暗示情绪，不要用形容词替代。
感官描写：具体而非笼统，把声音/气味/触感/温度写实。
对话标签：不要用"她说""他道"，改用动作或神情描写带出对话。

═══════════════════════════════════════════════
 第三优先级：交互设计 —— 这是本章的核心
═══════════════════════════════════════════════

【A. 细节探索点（不少于5处，穿插在正文段落之间）】
每处细节点的视觉样式必须不同，可用：
- 带虚线下划线的词（border-bottom: 1px dashed）
- 淡色背景高亮词（inline background: rgba(xxx,0.15)）
- 带微妙光晕的词语（text-shadow）
- 带边框的行内标记（border: 1px solid，border-radius: 3px，padding: 0 3px）
- 带前缀符号的括注（用特殊字符符号如 ◎ · 前缀，不要用 emoji）

每个细节点展开内容类型要多样（thought/sense/memory/clue/note 轮流用，同章5种都出现）：
- thought 内心独白：主角此刻的意识流，有具体意象，50-80字
- sense 感官延伸：某个声音/气味/触感的细腻描写，40-60字
- memory 记忆碎片：这个场景触发的过去记忆，有具体人和事，60-90字
- clue 隐藏线索：玩家细心发现的关键细节，影响后续剧情，30-50字
- note 旁白补充：世界观或角色背景补充，助理解当前局面，40-60字

【B. 道具卡片（1-3个，嵌入正文流中，不放在最后）】
把故事里的实物渲染成视觉卡片，玩家点击才能打开/翻看/解读。
道具卡片的核心原则：卡片本身要有精致的视觉外形，不是普通的文字框。

从以下类型选择最匹配当前场景的道具，自主决定内容：

类型A：书信/密函/竹管
渲染折叠信封或绑红线竹管的视觉外形，点击后展开成宣纸/竹简。
信纸：linear-gradient(#f5ecd4,#ede0c0)、竖排文字（writing-mode:vertical-rl）、有落款人/收信人。
展开动画：scaleY 0→1 + clip-path 从上揭开，蒙层点击关闭。

类型B：竹简/奏折/典籍
多根细长深棕色 div 并排，编绳纹路用 repeating-linear-gradient 模拟。
展开后可左右滚动，竖排文字。奏折用黄绢折叠感（box-shadow 折叠线）。

类型C：玉佩/令牌/印章
纯 CSS 渲染外形（不是图片）：
玉佩→圆形+孔洞+翠绿渐变+流光；令牌→六边形+烫金篆字；印章→方形红底+篆刻镜像字。
点击后放大居中展示（scale→1.5，fixed 居中），四周显示文字卡，hover 时轻微旋转。

类型D：地图/图纸
SVG+div 仿羊皮纸（米黄+棕色边缘晕染），标注点可点击展开气泡，整体轻微倾斜（rotate 3deg）。

类型E：锦囊/香包
CSS 椭圆袋形+抽绳，点击后抽绳动画，袋口打开，纸条掉出展开，内有线索或留言。

类型F：机关面板/符文阵
可交互面板，符文/数字点击循环切换，正确组合触发发光动效，错误组合震动反馈。

现代场景类型：
手机界面（显示短信/聊天记录）、老照片（sepia滤镜+背面手写字）、便利贴（黄色倾斜）、报纸（多栏+红圈标注）。

道具放置原则：
- 道具嵌入正文中，不放最后
- 道具出现前有1-2句描写引入（"她注意到桌上有一封信"），然后道具视觉出现
- 道具内容对剧情有实质推进（透露线索/增加张力/改变玩家认知）
- 道具视觉风格与整体场景配色一致

【C. 选项卡片（结尾2-3个，必须是卡片式视觉设计）】
选项绝对不能是普通文字列表，必须设计成有视觉质感的可点击卡片组。
每张选项卡片必须包含：
- 卡片主体（有边框、背景、圆角或特殊形状）
- 选项标题（10-20字，描述玩家将要做的行动）
- 选项副文（可选，1句话暗示这个选择的氛围或代价）
- hover 时有明显的视觉反馈（边框发光/背景变色/轻微上移）

风格匹配示例（根据世界观自由设计，禁止照抄）：
- 古风：仿木牌或玉片，烫金边框，竖排或横排文字，背景用深色木纹渐变
- 宫廷：绫罗质感卡片，两种颜色代表不同阵营，点击时有丝绸展开动效
- 悬疑/现代：磨砂玻璃感卡片，文字压在半透明层上，hover 时高光扫过
- 仙侠：竹简/符篆形卡片，带描金纹路，选中时灵气流动动效
- 末世/克苏鲁：做旧金属感卡片，锈迹纹理，文字像刻痕

每张卡片必须有 onclick="zbgT_choice(this,N)" 和 data-choice-text="[玩家将要做的事]"。

═══════════════════════════════════════════════
 第四优先级：技术规范
═══════════════════════════════════════════════

必须先输出完整 <script>，再输出 HTML 结构：
${scriptTemplate}

然后是 HTML：
<div id="zbg-story-cont" data-scene-theme="[dark/ancient/cold/warm/ink]" data-scene-color="[主色调如rgb(180,140,80)]" style="[容器样式];position:relative;min-height:100%;overflow:hidden;">
  <div id="_zbgAtmo" style="position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:0;"></div>
  <div style="position:relative;z-index:1;padding:24px 20px 80px;">
    [章节标题区：英文序号+中文标题+装饰分隔线]
    [叙事段落1，100-250字]
    [细节探索点穿插其中（带 onclick="zbgT_expand(this)"）]
    [道具卡片1（嵌入正文流）]
    [叙事段落2]
    [细节探索点]
    [道具卡片2（可选）]
    [叙事段落3（结尾悬念）]
    [分隔装饰线]
    [选项卡片区：2-3张卡片，flex 排列，匹配世界观视觉]
  </div>
</div>

data-scene-theme：dark/ancient/cold/warm/ink，根据场景选择。
data-expand-type：thought/sense/memory/clue/note，同章5种都至少出现一次。

技术要求：
- 只输出纯 HTML，不要 markdown 代码块
- 所有 CSS 写 inline style，不用 <style> 标签
- @keyframes 全部在 <script> 里用 JS 动态插入
- 不依赖任何外部库和 CDN
- 禁止使用任何 emoji 图标，包括所有视觉元素
- zbgPromptSave() 已由系统注入，不要重新定义
- window.zbgT_expand 和 window.zbgT_choice 必须在 <script> 里完整定义
- 内联 onmouseover 里只改1-2个属性
- 特殊交互函数挂到 window 上

═══════════════════════════════════════════════
 故事设定
═══════════════════════════════════════════════

${ctx}

总字数要求：叙事正文合计不少于 ${wc} 字，分散在多个段落中，每段100-250字。
必须包含：心理/感官细节描写（穿插在段落中）、道具卡片（1-3个）、细节探索点（不少于5处，样式多样）、选项卡片（2-3张，有视觉设计）。
开场要有悬念钩子，结尾要让玩家迫不及待想做出选择。`;
}


/* ============================================================
   下一章 prompt 生成
============================================================ */
function zbgBuildNextChapterPrompt(choiceText) {
  const settings = _zbgCurrentSettings || {};
  const wc = Math.max(parseInt(settings?.chapterWc) || 1200, 1000);
  const chapterNum = _zbgChapterNum + 1;

  const ctx = [
    settings.storyName ? `故事名称：${settings.storyName}` : '',
    settings.worldType ? `世界类型：${settings.worldType}` : '',
    settings.worldDesc ? `世界观设定：${settings.worldDesc}` : '',
    settings.storyDesc ? `故事简介：${settings.storyDesc}` : '',
    settings.styleDesc ? `文笔风格：${settings.styleDesc}` : '',
    settings.pov       ? `叙事视角：${settings.pov}` : '',
  ].filter(Boolean).join('\n');

  /* 章节历史摘要 */
  const historyText = _zbgChapterHistory.length > 0
    ? '已发生的剧情（简述）：\n' + _zbgChapterHistory.map((h, i) =>
        `第${i+1}章：玩家选择了"${h.choice}"，${h.summary}`
      ).join('\n')
    : '';

  return `你是一个顶级沉浸式互动文字游戏的 HTML 生成引擎。

绝对禁止：禁止在任何地方使用 emoji 图标，包括正文、选项、道具、标签、按钮、装饰符号。

═══════════════════════════════════════════════
 故事设定
═══════════════════════════════════════════════
${ctx}

═══════════════════════════════════════════════
 剧情连贯性
═══════════════════════════════════════════════
当前是第 ${chapterNum} 章。
${historyText}

玩家刚刚做出了选择：「${choiceText}」
基于这个选择继续推进故事，呈现选择带来的后果与新局面。
新章节的场景、情绪、人物状态必须与玩家的选择直接相关。

═══════════════════════════════════════════════
 核心理念：以交互替代长段文字
═══════════════════════════════════════════════

字数设定（${wc}字）分散在多个叙事段落中，每段100-250字。
必须按"叙事段落 → 交互元素 → 叙事段落 → 交互元素"节奏交替出现。
禁止连续超过3段正文而中间没有任何可点击交互元素。
把细节和情绪藏进交互里，正文只保留推动故事的核心叙述。

═══════════════════════════════════════════════
 视觉要求
═══════════════════════════════════════════════

新章节的视觉风格根据新场景重新设计，场景变则配色/背景/氛围层全部重新设计。
氛围层（id="_zbgAtmo"）动态元素与新场景完全匹配，不沿用上一章效果。
禁止套用通用粒子效果，要与具体场景一一对应。

═══════════════════════════════════════════════
 文学质量（精炼而有质感）
═══════════════════════════════════════════════

每段100-250字，克制精准，把细节留给交互探索。
心理描写：用身体反应和感官细节，不直接陈述情绪。
动作描写：分解动作，用节奏暗示情绪，不用形容词替代。
对话标签：有具体动作或神情，不用"他说/她道"。

═══════════════════════════════════════════════
 交互设计（核心，不可省略）
═══════════════════════════════════════════════

【细节探索点，不少于5处，穿插在正文段落之间】
样式必须多样化（虚线下划线/淡色高亮/光晕词/行内边框/前缀符号，同章内5种各至少用一次）。
展开类型：thought内心独白/sense感官延伸/memory记忆碎片/clue隐藏线索/note旁白补充，5种都要出现。
每个细节点加：onclick="zbgT_expand(this)" data-thought="内容" data-expand-type="类型"

【道具卡片，1-3个，嵌入正文流】
渲染场景中实际出现的道具，视觉上是精致的可点击卡片，而非普通文字框：
- 书信/竹管 → 折叠信封/绑红线竹管外形，点击展开竖排宣纸（writing-mode:vertical-rl）
- 竹简/奏折 → 多根深棕div并排+编绳纹，展开可横向滚动
- 玉佩/令牌 → 纯CSS渲染外形，点击放大居中展示，hover轻微旋转
- 地图/图纸 → SVG仿羊皮纸，标注点可点击展开气泡
- 机关/符文 → 可交互面板，正确组合发光，错误组合震动
- 现代道具 → 手机界面/老照片/便利贴的视觉外形
道具嵌入正文（有1-2句引入描写），内容对剧情有实质推进，交互函数挂到 window 上。

【选项卡片，结尾2-3张，必须是视觉卡片】
绝对不能是普通文字列表，必须是有设计感的可点击卡片组。
每张卡片包含：
- 精致的卡片外形（边框/背景/圆角/特殊形状，与世界观匹配）
- 选项标题（10-20字，描述玩家行动）
- 选项副文（可选，1句话暗示氛围或代价）
- hover时明显视觉反馈（发光/变色/上移）
世界观匹配示例（自由设计，不照抄）：
古风木牌/玉片（烫金边框），宫廷绫罗卡片，现代磨砂玻璃卡，末世做旧金属卡。
每张卡片：onclick="zbgT_choice(this,N)" + data-choice-text="[玩家行动描述]"

【技术规范】
先输出完整 <script>（含 window.zbgT_expand 和 window.zbgT_choice 的完整定义），再输出 HTML。
HTML 结构：
<div id="zbg-story-cont" data-scene-theme="[dark/ancient/cold/warm/ink]" data-scene-color="[主色调rgb值]" style="[容器];position:relative;min-height:100%;overflow:hidden;">
  <div id="_zbgAtmo" style="position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:0;"></div>
  <div style="position:relative;z-index:1;padding:24px 20px 80px;">
    [章节标题：英文序号+中文标题+装饰线]
    [叙事段落1（100-250字）]
    [细节探索点穿插]
    [道具卡片]
    [叙事段落2]
    [细节探索点]
    [道具卡片（可选）]
    [叙事段落3（结尾悬念）]
    [分隔装饰]
    [选项卡片区：flex排列，2-3张，有精致视觉设计]
  </div>
</div>

只输出纯 HTML，不要 markdown 代码块。所有 CSS 写 inline style。@keyframes 全部在 script 里注入。
禁止使用任何 emoji 图标。zbgPromptSave() 已注入，不要重新定义。选项不要在 data-content 里存任何内容。`;
}

/* ============================================================
   选项选择后调用AI生成下一章
============================================================ */
async function zbgNextChapter(choiceText) {
  /* 记录本次选择到历史 */
  _zbgCurrentChapterChoice = choiceText;

  /* 读取当前章节内容摘要（从页面文字中提取前150字） */
  const cont = document.getElementById('zbg-story-cont') || document.getElementById('zbgStoryContent');
  let summary = '';
  if (cont) {
    const paras = cont.querySelectorAll('p');
    const texts = Array.from(paras).map(p => p.textContent.trim()).filter(t => t.length > 5);
    summary = texts.join('').slice(0, 150) + '…';
  }
  _zbgChapterHistory.push({ choice: choiceText, summary });

  /* 显示加载状态 */
  const storyContent = document.getElementById('zbgStoryContent');
  if (storyContent) {
    storyContent.innerHTML = `
      <div style="min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;
                  background:linear-gradient(180deg,#0d0a12,#1a1528);color:rgba(255,255,255,.65);">
        <div id="_zbgNextLoading" style="width:48px;height:48px;border:2px solid rgba(255,255,255,.15);
             border-top-color:rgba(255,255,255,.7);border-radius:50%;
             animation:zbgNextSpin 0.9s linear infinite;"></div>
        <div style="font-size:14px;letter-spacing:0.12em;opacity:.7;">故事正在延续…</div>
        <div style="font-size:12px;opacity:.4;letter-spacing:0.08em;">「${choiceText}」</div>
        <style>@keyframes zbgNextSpin{to{transform:rotate(360deg)}}</style>
      </div>`;
  }

  try {
    const apiCfg = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
    const model  = localStorage.getItem('luna_api_model') || '';
    if (!apiCfg.baseUrl || !apiCfg.apiKey) {
      zbsShowToast('请先在设置中配置 AI 模型');
      return;
    }

    const prompt = zbgBuildNextChapterPrompt(choiceText);
    const baseUrl = apiCfg.baseUrl.replace(/\/$/, '');
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiCfg.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 6000,
        temperature: 1.0
      })
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`HTTP ${resp.status}${errText ? '：' + errText.slice(0, 80) : ''}`);
    }
    const data = await resp.json();
    let result = (data.choices?.[0]?.message?.content || '').trim();
    result = result.replace(/^```html\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();

    if (!result) throw new Error('AI 返回内容为空');
    zbgReceiveStoryContent(result);
    /* 滚动到顶部 */
    const overlay = document.getElementById('zbgOverlay');
    if (overlay) overlay.scrollTop = 0;
    else window.scrollTo(0, 0);

  } catch (e) {
    zbsShowToast('下一章生成失败：' + e.message);
    /* 恢复显示 */
    if (storyContent) {
      storyContent.innerHTML = `<div style="padding:40px 24px;text-align:center;color:#e8c87a;font-size:14px;">
        章节加载失败：${e.message}<br><br>
        <div onclick="zbgNextChapter('${choiceText.replace(/'/g, "\\'")}')"
             style="display:inline-block;padding:10px 24px;border:1px solid #c8a84b;border-radius:8px;cursor:pointer;margin-top:12px;">
          重新加载
        </div>
      </div>`;
    }
  }
}

async function zbgAwaken() {
  const btn    = document.getElementById('zbgAwakenBtn');
  const label  = document.getElementById('zbgAwLabel');
  const hintZh = document.getElementById('zbgHintZh');
  const hintEn = document.querySelector('.zbg-hint-en');
  const icon   = document.getElementById('zbgCenterIcon');

  if (!btn || btn.disabled) return;

  /* 检查 API 配置 */
  const apiCfg = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model  = localStorage.getItem('luna_api_model') || '';
  if (!apiCfg.baseUrl || !apiCfg.apiKey) {
    zbsShowToast('请先在设置中配置 AI 模型后再唤醒故事');
    return;
  }
  if (!model) {
    zbsShowToast('请先在设置中选择模型');
    return;
  }

  btn.disabled = true;
  btn.style.opacity = '.6';
  if (label)  label.textContent = 'AI 执笔中…';
  if (hintZh) hintZh.innerHTML = 'AI 正在为你铺展故事的第一幕<br>请稍候片刻…';
  if (hintEn) hintEn.textContent = '— Weaving your story —';
  if (icon)   icon.style.animation = 'zbg-cipulse .8s ease-in-out infinite';

  try {
    const prompt  = zbgBuildStoryPrompt(_zbgCurrentSettings);
    const baseUrl = apiCfg.baseUrl.replace(/\/$/, '');
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiCfg.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 6000,
        thinking: { type: 'disabled' },
        temperature: 1.0
      })
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`HTTP ${resp.status}${errText ? '：' + errText.slice(0, 80) : ''}`);
    }
    const data = await resp.json();
    let result = (data.choices?.[0]?.message?.content || '').trim();
    /* 去掉可能残留的 markdown 代码块标记 */
    result = result.replace(/^```html\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();

    if (!result) {
      const finishReason = data.choices?.[0]?.finish_reason || '未知';
      console.error('[zbgAwaken] API 返回为空，finish_reason:', finishReason, '完整响应:', JSON.stringify(data));
      throw new Error(`AI 返回内容为空（finish_reason: ${finishReason}）`);
    }
    zbgReceiveStoryContent(result);

  } catch (e) {
    if (btn)    { btn.disabled = false; btn.style.opacity = '1'; }
    if (label)  label.textContent = '唤醒故事';
    if (hintZh) hintZh.innerHTML = `生成失败：${e.message}<br>请检查 AI 配置后重试`;
    if (icon)   icon.style.animation = '';
    zbsShowToast('故事生成失败：' + e.message);
  }
}

/* 接收 AI 生成的故事内容 HTML，注入页面 */

/* zbgPromptSave：选项后续末尾由AI代码调用，弹出存档提示 */
window.zbgPromptSave = function() {
  if (document.getElementById('_zbgSaveMask')) return;
  var mask = document.createElement('div');
  mask.id = '_zbgSaveMask';
  mask.setAttribute('style',
    'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.72);' +
    'display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .25s');
  var box = document.createElement('div');
  box.setAttribute('style',
    'background:#1a1610;border:1px solid rgba(200,168,75,.35);border-radius:18px;' +
    'padding:34px 28px 28px;width:272px;text-align:center;' +
    'transform:translateY(20px);transition:transform .3s,opacity .3s;opacity:0;' +
    'box-shadow:0 24px 64px rgba(0,0,0,.9)');
  box.innerHTML =
    '<div style="color:#e8dfc0;font-size:15px;font-weight:500;margin-bottom:6px">保存当前进度？</div>' +
    '<div style="color:rgba(232,223,192,.45);font-size:12px;margin-bottom:26px;line-height:1.6">保存后可随时从此处继续故事</div>' +
    '<div style="display:flex;gap:12px;justify-content:center">' +
    '<button id="_zbgSaveYes" style="background:linear-gradient(135deg,#c8a84b,#a0823a);border:none;color:#0d0a04;padding:11px 24px;border-radius:9px;font-size:13px;cursor:pointer;font-weight:700">保存进度</button>' +
    '<button id="_zbgSaveNo"  style="background:transparent;border:1px solid rgba(200,168,75,.28);color:rgba(232,223,192,.6);padding:11px 22px;border-radius:9px;font-size:13px;cursor:pointer">稍后再说</button>' +
    '</div>';
  mask.appendChild(box);
  document.body.appendChild(mask);
  requestAnimationFrame(function() {
    mask.style.opacity = '1';
    box.style.opacity  = '1';
    box.style.transform = 'translateY(0)';
  });
  function close() { mask.remove(); }
  document.getElementById('_zbgSaveYes').onclick = function() { zbgDoSave(); close(); };
  document.getElementById('_zbgSaveNo').onclick  = close;
  mask.addEventListener('click', function(e) { if (e.target === mask) close(); });
};

function zbgReceiveStoryContent(storyHTML) {
  var initScreen   = document.getElementById('zbgInitScreen');
  var storyContent = document.getElementById('zbgStoryContent');
  var icon         = document.getElementById('zbgCenterIcon');

  if (icon) icon.style.animation = '';
  if (initScreen) initScreen.style.display = 'none';
  if (!storyContent) return;
  storyContent.style.display = '';

  /* ── 第一步：清理 AI 可能插入的特殊字符 ── */
  var raw = storyHTML
    .replace(/^﻿/, '')
    .replace(/[​-‍­]/g, '')
    .replace(/“|”/g, '"')
    .replace(/‘|’/g, "'");

  /* ── 第二步：用正则把 <script>...</script> 挖出来，剩下的是纯 HTML ── */
  /* 不用 DOMParser，因为浏览器安全策略会让 innerHTML 注入的 <script> 根本不执行 */
  var scriptTexts = [];
  var htmlBody = raw.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, function(_, code) {
    scriptTexts.push(code);
    return '';
  });

  /* ── 第三步：把纯 HTML 注入容器 ── */
  storyContent.innerHTML = htmlBody;

  /* ── 第三点五步：自动检测场景主题色，注入到 window._zbgSceneTheme 供 expand 读取 ── */
  (function detectSceneTheme() {
    var cont = storyContent.querySelector('#zbg-story-cont') || storyContent.firstElementChild;
    if (!cont) return;
    /* 1. AI 若在容器上打了 data-scene-theme 标注，直接用 */
    if (cont.dataset.sceneTheme) { window._zbgSceneTheme = cont.dataset.sceneTheme; return; }
    /* 2. 否则通过背景色亮度+色调推断 */
    var bg = cont.style.background || cont.style.backgroundColor || '';
    /* 提取 rgb 数值做简单判断 */
    var m = bg.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) {
      var r = +m[1], g = +m[2], b = +m[3];
      /* 色调分析 */
      if (r > g * 1.3 && r > b * 1.3) { window._zbgSceneTheme = 'warm'; cont.dataset.sceneTheme = 'warm'; return; }
      if (b > r * 1.3 && b > g * 1.1) { window._zbgSceneTheme = 'cold'; cont.dataset.sceneTheme = 'cold'; return; }
      if (g > r * 1.2 && g > b * 1.1) { window._zbgSceneTheme = 'ink';  cont.dataset.sceneTheme = 'ink';  return; }
    }
    /* 3. 世界类型兜底 */
    var worldType = (window._zbgCurrentSettings || {}).worldType || '';
    var typeMap = { '仙侠':'dark','玄幻':'warm','武侠':'ancient','末世':'cold','现代':'cold','克苏鲁':'cold' };
    var guessed = typeMap[worldType] || 'dark';
    window._zbgSceneTheme = guessed;
    cont.dataset.sceneTheme = guessed;
  })();

  /* ── 第四步：用间接 eval 在全局 window 作用域执行脚本 ── */
  /* (0,eval)(code) 是"间接 eval"，函数定义会挂到 window 上，
     这样 onclick="xxx()" 才能通过 window.xxx 找到对应函数 */
  /* ── 第四步：执行脚本，并注入保底交互函数 ── */

  /* 保底 fallback：无论 AI 是否生成了 script，都确保 zbgT_expand / zbgT_choice 存在 */
  if (typeof window.zbgT_expand !== 'function') {
    window.zbgT_expand = function(el) {
      var existing = document.querySelector('._zbgThought');
      if (existing) {
        existing.style.opacity = '0';
        existing.style.transform = 'translateY(-6px)';
        setTimeout(function(){ if(existing.parentNode) existing.parentNode.removeChild(existing); }, 200);
        if (existing.previousSibling === el) return;
      }
      var cont = document.getElementById('zbg-story-cont');
      var theme = (cont && cont.dataset.sceneTheme) || (window._zbgSceneTheme) || 'dark';
      var expandType = el.dataset.expandType || 'thought';
      var content = el.dataset.thought || el.dataset.content || '（无内容）';
      var themes = {
        dark:    { bg:'rgba(12,8,20,0.97)',   border:'rgba(180,140,80,0.35)',  text:'rgba(232,220,190,0.92)',  accent:'#c8a84b' },
        ancient: { bg:'rgba(18,12,6,0.97)',   border:'rgba(160,120,60,0.4)',   text:'rgba(230,210,170,0.92)',  accent:'#b8903a' },
        cold:    { bg:'rgba(6,12,24,0.97)',   border:'rgba(80,140,200,0.35)',  text:'rgba(190,215,240,0.92)',  accent:'#60a8d0' },
        warm:    { bg:'rgba(20,10,4,0.97)',   border:'rgba(200,100,60,0.38)',  text:'rgba(240,210,185,0.92)',  accent:'#d87040' },
        ink:     { bg:'rgba(8,10,8,0.97)',    border:'rgba(100,140,80,0.32)',  text:'rgba(200,220,180,0.9)',   accent:'#80a860' },
      };
      var t = themes[theme] || themes.dark;
      var sceneColor = cont && cont.dataset.sceneColor;
      if (sceneColor) t.accent = sceneColor;
      var typeStyles = {
        thought: { bar: t.accent,  label: '·  内心' },
        sense:   { bar: '#7eb8d0', label: '·  感知' },
        memory:  { bar: '#9b7ec8', label: '·  记忆' },
        clue:    { bar: '#e07878', label: '·  线索' },
        note:    { bar: '#78a878', label: '·  旁注' },
      };
      var ts = typeStyles[expandType] || typeStyles.thought;
      var box = document.createElement('div');
      box.className = '_zbgThought';
      box.setAttribute('style', [
        'position:relative;background:' + t.bg + ';',
        'border:1px solid ' + t.border + ';border-left:2.5px solid ' + ts.bar + ';',
        'border-radius:0 10px 10px 0;padding:14px 16px 14px 18px;',
        'margin:10px 0 4px 8px;font-size:13.5px;line-height:1.95;letter-spacing:0.04em;',
        'color:' + t.text + ';box-shadow:0 8px 32px rgba(0,0,0,0.8);cursor:pointer;',
        'opacity:0;transform:translateY(8px) translateX(-4px);',
        'transition:opacity 0.3s ease,transform 0.3s ease;',
        'backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);',
      ].join(''));
      box.innerHTML = [
        '<div style="font-size:10px;letter-spacing:0.22em;color:' + ts.bar + ';margin-bottom:8px;font-style:italic;">' + ts.label + '</div>',
        '<div style="line-height:1.95;">' + content + '</div>',
        '<div style="position:absolute;top:10px;right:12px;font-size:11px;color:rgba(255,255,255,0.25);cursor:pointer;" onclick="this.parentNode.remove()">✕</div>'
      ].join('');
      box.onclick = function(e){
        if(e.target.tagName!=='A'){ box.style.opacity='0'; box.style.transform='translateY(-4px)'; setTimeout(function(){if(box.parentNode)box.parentNode.removeChild(box);},200); }
      };
      el.parentNode.insertBefore(box, el.nextSibling);
      box.getBoundingClientRect();
      requestAnimationFrame(function(){ box.style.opacity='1'; box.style.transform='translateY(0) translateX(0)'; });
    };
    console.log('[zbg] 已注入 fallback zbgT_expand（场景自适应）');
  }

  if (typeof window.zbgT_choice !== 'function') {
    window.zbgT_choice = function(el, idx) {
      /* 优先读取 data-choice-text，其次读 data-content（旧版兼容），最后读按钮文字 */
      var choiceText = el.dataset.choiceText || el.textContent.trim() || ('选项' + idx);
      var legacyContent = el.dataset.content || '';

      /* 涟漪过渡动画 */
      var rect = el.getBoundingClientRect();
      var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      var mask = document.createElement('div');
      var maskBg = '#0d0a12';
      mask.setAttribute('style',
        'position:fixed;inset:0;z-index:99999;background:' + maskBg + ';pointer-events:all;' +
        'clip-path:circle(0% at ' + cx + 'px ' + cy + 'px);' +
        'transition:clip-path 0.6s cubic-bezier(0.4,0,0.2,1);');
      document.body.appendChild(mask);
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          mask.style.clipPath = 'circle(150% at ' + cx + 'px ' + cy + 'px)';
        });
      });

      setTimeout(function() {
        /* 优先：调用AI生成下一章（主路径） */
        if (typeof zbgNextChapter === 'function' && !legacyContent) {
          mask.style.transition = 'opacity 0.4s';
          mask.style.opacity = '0';
          setTimeout(function() { mask.remove(); }, 420);
          zbgNextChapter(choiceText);
          return;
        }
        /* 旧版兼容：如果有 data-content 则直接注入 */
        if (legacyContent) {
          var cont = document.getElementById('zbg-story-cont') || document.getElementById('zbgStoryContent');
          if (cont) {
            var scriptTexts2 = [];
            var htmlBody2 = legacyContent.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, function(_, code) {
              scriptTexts2.push(code);
              return '';
            });
            cont.innerHTML = htmlBody2;
            scriptTexts2.forEach(function(code) {
              try { (0, eval)(code); } catch(e) { console.error('[zbg] 子脚本执行错误：', e.message); }
            });
          }
          mask.style.opacity = '0';
          setTimeout(function() { mask.remove(); }, 500);
          if (legacyContent.indexOf('zbgPromptSave') === -1) zbgPromptSave();
          return;
        }
        /* 终极兜底：什么都没有，直接调AI */
        mask.style.opacity = '0';
        setTimeout(function() { mask.remove(); }, 420);
        if (typeof zbgNextChapter === 'function') zbgNextChapter(choiceText);
        else console.warn('[zbg] zbgT_choice: zbgNextChapter 未定义');
      }, 650);
    };
    console.log('[zbg] 已注入 fallback zbgT_choice（AI 驱动）');
  }

  /* 确保 @keyframes zbgFadeIn 已注入 */
  if (!document.getElementById('_zbgFallbackKF')) {
    var _kfStyle = document.createElement('style');
    _kfStyle.id = '_zbgFallbackKF';
    _kfStyle.textContent =
      '@keyframes zbgFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}' +
      '@keyframes zbgSlideIn{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}';
    document.head.appendChild(_kfStyle);
  }

  if (scriptTexts.length) {
    var combined = scriptTexts.join('\n');
    try {
      (0, eval)(combined);
      console.log('[zbg] 脚本已在全局作用域执行，长度：', combined.length);
    } catch (e) {
      console.error('[zbg] 脚本执行错误：', e.message);
      zbsShowToast('故事脚本出错（' + e.message.slice(0, 40) + '），建议重新生成');
    }
  } else {
    console.warn('[zbg] AI 未生成 <script> 块，已启用 fallback 交互函数');
  }

  var syncTxt = document.getElementById('zbgSyncTxt');
  if (syncTxt) syncTxt.textContent = '已生成';
  _zbgChapterNum++;
}

/* 重置等待界面（每次进入游戏页时调用） */
function zbgResetInitScreen() {
  const btn   = document.getElementById('zbgAwakenBtn');
  const label = document.getElementById('zbgAwLabel');
  const hintZh = document.getElementById('zbgHintZh');
  const hintEn = document.querySelector('.zbg-hint-en');

  if (btn)    { btn.disabled = false; btn.style.opacity = '1'; }
  if (label)  label.textContent = '唤醒故事';
  if (hintZh) hintZh.innerHTML = 'AI 执笔在侧，等你一声令下<br>点击唤醒，故事将为你而起';
  if (hintEn) hintEn.textContent = '— Awaiting your first move —';

  const initScreen   = document.getElementById('zbgInitScreen');
  const storyContent = document.getElementById('zbgStoryContent');
  if (initScreen)   initScreen.style.display = '';
  if (storyContent) storyContent.style.display = 'none';
}

/* ================================================================
   悬浮球 — 拖动 + 吸边 + 半隐
================================================================ */

/* ---- 拖动 & 吸边状态 ---- */
const _zbgFab = {
  x: null,          // 球心 left（像素，相对视口）
  y: null,          // 球心 top
  size: 76,         // 球宽高
  halfHide: 22,     // 吸边时露出像素（球露出 22px）
  idleDelay: 2000,  // 无操作多久后吸边（ms）
  idleTimer: null,
  dragging: false,
  dragStartX: 0,
  dragStartY: 0,
  pointerStartX: 0,
  pointerStartY: 0,
  moved: false,     // 区分点击与拖动
};

function _zbgFabGetWrap() { return document.getElementById('zbgFabWrap'); }

/* 初始化球的位置（从 fixed right/bottom 转为 left/top 绝对坐标） */
function _zbgFabInit() {
  const wrap = _zbgFabGetWrap();
  if (!wrap) return;
  const rect = wrap.getBoundingClientRect();
  _zbgFab.x = rect.left;
  _zbgFab.y = rect.top;
  /* 清除原 CSS right/bottom，改用 left/top 控制 */
  wrap.style.right  = '';
  wrap.style.bottom = '';
  wrap.style.left   = _zbgFab.x + 'px';
  wrap.style.top    = _zbgFab.y + 'px';
  wrap.style.transform = '';
  /* 启动吸边计时 */
  _zbgFabScheduleIdle();
}

/* 设置球位置 */
function _zbgFabSetPos(x, y) {
  const wrap = _zbgFabGetWrap();
  if (!wrap) return;
  const vw = window.innerWidth, vh = window.innerHeight;
  const s  = _zbgFab.size;
  /* 限制在视口内 */
  x = Math.max(0, Math.min(vw - s, x));
  y = Math.max(0, Math.min(vh - s, y));
  _zbgFab.x = x;
  _zbgFab.y = y;
  wrap.style.left = x + 'px';
  wrap.style.top  = y + 'px';
  wrap.style.transform = '';
}

/* 吸边：贴近左/右边，并遮住一半 */
function _zbgFabSnapToEdge() {
  const wrap = _zbgFabGetWrap();
  if (!wrap || _zbgFab.dragging || _zbgFabOpen) return;
  const vw = window.innerWidth;
  const s  = _zbgFab.size;
  const cx = _zbgFab.x + s / 2; // 球心 X
  /* 判断靠哪侧 */
  const snapRight = cx > vw / 2;
  let tx, ty;
  if (snapRight) {
    /* 右侧吸边：只露出 halfHide 像素 */
    tx = vw - _zbgFab.halfHide;
  } else {
    /* 左侧吸边：只露出 halfHide 像素 */
    tx = -s + _zbgFab.halfHide;
  }
  ty = _zbgFab.y; // 上下位置不变

  wrap.classList.remove('dragging');
  wrap.style.transition = 'left 0.42s cubic-bezier(.25,.8,.25,1), top 0.42s cubic-bezier(.25,.8,.25,1), opacity 0.32s ease';
  wrap.style.left    = tx + 'px';
  wrap.style.opacity = '0.62';
}

/* 从吸边唤醒 */
function _zbgFabWakeUp() {
  const wrap = _zbgFabGetWrap();
  if (!wrap) return;
  wrap.style.transition = 'left 0.32s cubic-bezier(.25,.8,.25,1), top 0.32s cubic-bezier(.25,.8,.25,1), opacity 0.2s ease';
  wrap.style.left    = _zbgFab.x + 'px';
  wrap.style.opacity = '1';
  _zbgFabScheduleIdle();
}

/* 计划无操作吸边 */
function _zbgFabScheduleIdle() {
  clearTimeout(_zbgFab.idleTimer);
  if (_zbgFabOpen) return; // 菜单打开时不吸边
  _zbgFab.idleTimer = setTimeout(_zbgFabSnapToEdge, _zbgFab.idleDelay);
}

/* ---- 拖动事件 ---- */
function _zbgFabOnPointerDown(e) {
  /* 唤醒吸边状态 */
  _zbgFabWakeUp();

  const wrap = _zbgFabGetWrap();
  _zbgFab.dragging     = true;
  _zbgFab.moved        = false;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  _zbgFab.dragStartX   = parseFloat(wrap.style.left) || _zbgFab.x;
  _zbgFab.dragStartY   = parseFloat(wrap.style.top)  || _zbgFab.y;
  _zbgFab.pointerStartX = clientX;
  _zbgFab.pointerStartY = clientY;

  wrap.classList.add('dragging');
  wrap.style.transition = 'none';
  wrap.style.opacity    = '1';
  clearTimeout(_zbgFab.idleTimer);
  /* 不 stopPropagation，让 click 事件能正常抵达，由 moved 标志区分 */
}

function _zbgFabOnPointerMove(e) {
  if (!_zbgFab.dragging) return;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const dx = clientX - _zbgFab.pointerStartX;
  const dy = clientY - _zbgFab.pointerStartY;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) _zbgFab.moved = true;
  if (!_zbgFab.moved) return;
  e.preventDefault();
  _zbgFabSetPos(_zbgFab.dragStartX + dx, _zbgFab.dragStartY + dy);
}

function _zbgFabOnPointerUp(e) {
  if (!_zbgFab.dragging) return;
  _zbgFab.dragging = false;
  const wrap = _zbgFabGetWrap();
  wrap.classList.remove('dragging');
  if (_zbgFab.moved) {
    /* 拖动结束：贴近左右边缘，并计时吸边 */
    const vw = window.innerWidth;
    const s  = _zbgFab.size;
    const cx = _zbgFab.x + s / 2;
    const snapX = cx > vw / 2 ? vw - s - 12 : 12;
    wrap.style.transition = 'left 0.35s cubic-bezier(.25,.8,.25,1), top 0.35s cubic-bezier(.25,.8,.25,1)';
    _zbgFab.x = snapX;
    wrap.style.left = snapX + 'px';
    _zbgFabScheduleIdle();
  } else {
    /* 是点击：阻止 touch 后续触发的 synthetic click，手动 toggle */
    if (e.type === 'touchend') e.preventDefault();
    zbgFabToggle();
  }
}

/* ---- 绑定拖动事件 ---- */
function _zbgFabBindDrag() {
  const orb = document.getElementById('zbgFabBtn');
  if (!orb) return;

  /* Touch — touchstart 不能 passive，否则 touchmove.preventDefault 无效 */
  orb.addEventListener('touchstart',  _zbgFabOnPointerDown, { passive: false });
  document.addEventListener('touchmove',  _zbgFabOnPointerMove, { passive: false });
  document.addEventListener('touchend',   _zbgFabOnPointerUp);

  /* Mouse */
  orb.addEventListener('mousedown',   _zbgFabOnPointerDown);
  document.addEventListener('mousemove',  _zbgFabOnPointerMove);
  document.addEventListener('mouseup',    _zbgFabOnPointerUp);
}

function zbgFabToggle() {
  _zbgFabOpen = !_zbgFabOpen;
  const wrap    = document.getElementById('zbgFabWrap');
  const btn     = document.getElementById('zbgFabBtn');
  const overlay = document.getElementById('zbgFabOverlay');
  const iconClose = document.getElementById('zbgFabIconClose');

  /* 打开时从吸边唤醒，关闭时重新计时 */
  if (_zbgFabOpen) {
    _zbgFabWakeUp();
    clearTimeout(_zbgFab.idleTimer);
  } else {
    _zbgFabScheduleIdle();
  }

  // wrap 上加 open → 连线 silk 显现 + 球体缩放
  wrap?.classList.toggle('open', _zbgFabOpen);
  btn?.classList.toggle('open', _zbgFabOpen);
  overlay?.classList.toggle('show', _zbgFabOpen);

  // luxury orb 脉冲 burst
  const orbPulse = document.getElementById('zbgOrbPulse');
  if (orbPulse) {
    orbPulse.classList.remove('burst');
    void orbPulse.offsetWidth;
    orbPulse.classList.add('burst');
  }

  // icon swap
  if (iconClose) { iconClose.style.display = _zbgFabOpen ? 'block' : 'none'; }

  const petalIds = ['zbgP1','zbgP2','zbgP3','zbgP4'];
  const petals = petalIds.map(id => document.getElementById(id));

  petals.forEach((p, i) => {
    if (!p) return;
    if (_zbgFabOpen) {
      setTimeout(() => p.classList.add('open'), i * 70);
    } else {
      setTimeout(() => p.classList.remove('open'), (petals.length - 1 - i) * 50);
    }
  });
}

function zbgFabClose() {
  if (_zbgFabOpen) zbgFabToggle();
}

function zbgFabAction(type) {
  zbgFabClose();
  setTimeout(() => {
    if (type === 'save')     zbgOpenModal('zbgSaveModal');
    if (type === 'history')  zbgOpenModal('zbgHistoryModal');
    if (type === 'settings') zbgOpenModal('zbgSettingsModal');
    if (type === 'char')     zbgOpenModal('zbgCharModal');
  }, 160);
}

/* ================================================================
   弹窗系统
================================================================ */
function zbgOpenModal(id) {
  if (id === 'zbgSaveModal') zbgPrepareSaveModal();
  if (id === 'zbgHistoryModal') zbgPrepareHistoryModal();
  document.getElementById(id)?.classList.add('show');
}

function zbgCloseModal(id) {
  document.getElementById(id)?.classList.remove('show');
}

function zbgPrepareSaveModal() {
  const chEl  = document.getElementById('zbgSaveChapter');
  const timeEl = document.getElementById('zbgSaveTime');
  if (chEl)  chEl.textContent = `第 ${_zbgChapterNum} 章 · ${_zbgCurrentSettings?.storyName || '未命名故事'}`;
  if (timeEl) {
    const now = new Date();
    timeEl.textContent = now.toLocaleString('zh-CN', {
      month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false
    });
  }
}

function zbgDoSave() {
  const saveData = {
    settings: _zbgCurrentSettings,
    chapter:  _zbgChapterNum,
    time:     Date.now(),
  };
  localStorage.setItem('zhibi_save', JSON.stringify(saveData));
  zbgCloseModal('zbgSaveModal');
  zbsShowToast('进度已保存');

  /* 更新首页「继续」按钮显示 */
  const continueBtn = document.getElementById('zbBtnContinue');
  if (continueBtn) continueBtn.style.display = 'flex';
}

function zbgPrepareHistoryModal() {
  const listEl = document.getElementById('zbgHistoryList');
  if (!listEl) return;
  const raw = localStorage.getItem('zhibi_save');
  if (!raw) {
    listEl.innerHTML = '<div class="zbg-history-empty">暂无保存记录</div>';
    return;
  }
  try {
    const data = JSON.parse(raw);
    const d = new Date(data.time);
    const label = data.settings?.storyName || '未命名故事';
    listEl.innerHTML = `
      <div class="zbg-history-item" onclick="zbgLoadSave()">
        <div>
          <div class="zbg-history-item-title">${label}</div>
          <div class="zbg-history-item-meta">第 ${data.chapter || 1} 章 · ${d.toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})}</div>
        </div>
        <button class="zbg-history-load-btn">读取</button>
      </div>`;
  } catch(e) {
    listEl.innerHTML = '<div class="zbg-history-empty">存档读取失败</div>';
  }
}

function zbgLoadSave() {
  zbgCloseModal('zbgHistoryModal');
  zbsShowToast('已读取存档');
}

/* 设置：重新选择头部样式 */
function zbgReswitchHeader() {
  zbgCloseModal('zbgSettingsModal');
  document.getElementById('zbgOverlay')?.classList.remove('show');
  document.getElementById('zbhOverlay')?.classList.add('show');
}

/* 设置：退出故事回首页 */
function zbgExitToHome() {
  zbgCloseModal('zbgSettingsModal');
  document.getElementById('zbgOverlay')?.classList.remove('show');
  _zbgFabOpen = false;
  document.getElementById('zbgFabBtn')?.classList.remove('open');
  document.getElementById('zbgFabOverlay')?.classList.remove('show');
  ['zbgP1','zbgP2','zbgP3'].forEach(id => document.getElementById(id)?.classList.remove('open'));
}