/* ================================================================
   Luna Phone — bookhouse.js
   「书屋」App 逻辑
   数据持久化：沿用项目已有的 localStorage(设置类) + IndexedDB(集合类) 约定
   AI 调用：复用 settings.js 中已建立的 OpenAI 兼容 /chat/completions 约定
            （localStorage: luna_api_current = {baseUrl, apiKey}, luna_api_model）
================================================================ */

/* ================================================================
   0. 状态栏同步（与 index.html / settings.js 完全一致的口径）
================================================================ */
function updateTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeStr = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const el = document.getElementById('statusTime');
  if (el) el.textContent = timeStr;
}

function updateBattery() {
  const pctEl = document.getElementById('batPct');
  const innerEl = document.getElementById('batInner');
  const pct = parseInt(localStorage.getItem('luna_battery') || '76');
  if (pctEl) pctEl.textContent = pct;
  if (innerEl) {
    innerEl.style.width = pct + '%';
    innerEl.style.background = pct <= 20
      ? 'linear-gradient(90deg, #f87171, #ef4444)'
      : 'linear-gradient(90deg, #4a4642, #6b6862)';
  }
}

function applyIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style = localStorage.getItem('luna_island_style') || 'minimal';
  const el = document.getElementById('statusIsland');
  if (!el) return;
  if (!enabled) { el.innerHTML = ''; return; }
  const styleMap = {
    minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
    clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="siClockText">--:--</span></div></div>`,
    pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot"></div></div></div>`,
  };
  el.innerHTML = styleMap[style] || styleMap.minimal;
}

/* 返回桌面 —— 直接跳转 index.html；index.html 的冷/热启动判断（sessionStorage）
   会自动识别这是同一标签页内的热返回，不会重放开机动画或锁屏。 */
function goBack() {
  const frame = document.querySelector('.luna-frame');
  frame.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
  frame.style.opacity = '0';
  frame.style.transform = 'scale(0.96)';
  setTimeout(() => { window.location.href = 'index.html'; }, 200);
}

window.addEventListener('pageshow', (e) => { if (e.persisted) window.location.reload(); });

document.addEventListener('DOMContentLoaded', () => {
  updateTime();
  updateBattery();
  applyIsland();
  setInterval(updateTime, 1000);
  window.addEventListener('storage', (e) => {
    if (e.key === 'luna_island_update') applyIsland();
    if (e.key === 'luna_battery') updateBattery();
    if (e.key === 'luna_tz') updateTime();
  });
});

/* ================================================================
   1. IndexedDB —— 书籍集合（书架/书册/生成内容 一并存这里）
================================================================ */
const BH_DB_NAME = 'LunaBookhouseDB';
const BH_STORE_BOOKS = 'books';
const BH_STORE_PRESETS = 'genPresets';
let bhDb = null;

function bhOpenDb() {
  return new Promise((res, rej) => {
    if (bhDb) return res(bhDb);
    const req = indexedDB.open(BH_DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(BH_STORE_BOOKS)) {
        db.createObjectStore(BH_STORE_BOOKS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(BH_STORE_PRESETS)) {
        db.createObjectStore(BH_STORE_PRESETS, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => { bhDb = e.target.result; res(bhDb); };
    req.onerror = () => rej(req.error);
  });
}
function bhTx(store, mode) { return bhDb.transaction(store, mode).objectStore(store); }

async function bhDbPutBook(book) {
  const db = await bhOpenDb();
  return new Promise((res, rej) => {
    const req = bhTx(BH_STORE_BOOKS, 'readwrite').put(book);
    req.onsuccess = () => res(book);
    req.onerror = () => rej(req.error);
  });
}
async function bhDbGetAllBooks() {
  const db = await bhOpenDb();
  return new Promise((res, rej) => {
    const req = bhTx(BH_STORE_BOOKS, 'readonly').getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });
}
async function bhDbGetBook(id) {
  const db = await bhOpenDb();
  return new Promise((res, rej) => {
    const req = bhTx(BH_STORE_BOOKS, 'readonly').get(id);
    req.onsuccess = () => res(req.result || null);
    req.onerror = () => rej(req.error);
  });
}
async function bhDbAddPreset(preset) {
  const db = await bhOpenDb();
  return new Promise((res, rej) => {
    const req = bhTx(BH_STORE_PRESETS, 'readwrite').add(preset);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function bhDbGetAllPresets() {
  const db = await bhOpenDb();
  return new Promise((res, rej) => {
    const req = bhTx(BH_STORE_PRESETS, 'readonly').getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });
}
async function bhDbDeletePreset(id) {
  const db = await bhOpenDb();
  return new Promise((res, rej) => {
    const req = bhTx(BH_STORE_PRESETS, 'readwrite').delete(id);
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}

/* ================================================================
   2. AI 调用封装 —— 复用项目里已配置好的 OpenAI 兼容接口
================================================================ */
async function callLunaAI(systemPrompt, userPrompt, opts = {}) {
  const cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  if (!cur.baseUrl || !cur.apiKey || !model) {
    throw new Error('NO_API_CONFIG');
  }
  const baseUrl = cur.baseUrl.replace(/\/$/, '');
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cur.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: opts.maxTokens || 2000,
      temperature: opts.temperature ?? 0.9
    })
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || '';
  if (opts.json) {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const start = cleaned.indexOf('{') === -1
      ? cleaned.indexOf('[')
      : (cleaned.indexOf('[') === -1 ? cleaned.indexOf('{') : Math.min(cleaned.indexOf('{'), cleaned.indexOf('[')));
    const jsonSlice = start >= 0 ? cleaned.slice(start) : cleaned;
    try { return JSON.parse(jsonSlice); }
    catch (e) { throw new Error('AI_JSON_PARSE_FAILED: ' + e.message); }
  }
  return text;
}

/* ================================================================
   3. 主命名空间
================================================================ */
const BH = {};

/* ---------------- 一级导航（书屋 / 创作工坊 / 个人中心） ---------------- */
BH._navOrder = ['library', 'studio', 'profile'];
BH.switchMainView = function (name) {
  const views = document.querySelectorAll('.bh-view');
  views.forEach(v => v.classList.toggle('bh-active', v.dataset.view === name));

  // 导航项高亮 + “翻书”式书签飞移
  const items = document.querySelectorAll('.bh-nav-item[data-nav]');
  const flag = document.getElementById('bhNavFlag');
  const idx = BH._navOrder.indexOf(name);
  items.forEach(it => it.classList.toggle('bh-nav-active', it.dataset.nav === name));
  if (flag && idx >= 0) {
    flag.classList.add('bh-flipping');
    flag.style.left = (6 + idx * 76) + 'px';
    setTimeout(() => flag.classList.remove('bh-flipping'), 550);
  }
  BH._currentMain = name;
};

BH.backToLibrary = function () {
  BH.switchMainView('library');
};

/* ---------------- 书屋内 书架/书册 二级切换 ---------------- */
BH.switchLibSub = function (sub) {
  document.querySelectorAll('.bh-subtab').forEach(t => t.classList.toggle('bh-subtab-active', t.dataset.sub === sub));
  const flag = document.getElementById('libSubFlag');
  flag.style.transform = sub === 'catalog' ? 'translateX(100%)' : 'translateX(0)';
  document.getElementById('pane-shelf').style.display = sub === 'shelf' ? '' : 'none';
  document.getElementById('pane-catalog').style.display = sub === 'catalog' ? '' : 'none';
};

/* ---------------- 悬浮生成按钮展开/收起 ---------------- */
BH.toggleFab = function () {
  document.getElementById('catalogFabWrap').classList.toggle('bh-fab-open');
};

/* ---------------- Toast ---------------- */
BH.toast = function (msg, ms = 2200) {
  const el = document.getElementById('bhToast');
  el.textContent = msg;
  el.classList.add('bh-show');
  clearTimeout(BH._toastTimer);
  BH._toastTimer = setTimeout(() => el.classList.remove('bh-show'), ms);
};

/* ================================================================
   4. 生成设置（世界观 / 文风 / 篇幅 / 完结度 / 字数 / 主题 / 人物 / 情节 / 禁用）
================================================================ */
BH._cfgDefaults = {
  world: '', style: '', styleCustom: '', length: '短篇', status: '连载中',
  wordMin: 800, wordMax: 1500, themes: [], characters: '', plot: '', avoid: ''
};
BH._cfg = null; // 当前生效设置（未设置则为 null，代表“未输入规则”）

BH.openSettingsSheet = function () {
  document.getElementById('catalogFabWrap').classList.remove('bh-fab-open');
  BH._loadCfgIntoForm();
  BH._renderPresetList();
  document.getElementById('settingsSheetMask').classList.add('bh-show');
};
BH.closeSettingsSheet = function () {
  document.getElementById('settingsSheetMask').classList.remove('bh-show');
};

BH._loadCfgIntoForm = function () {
  const c = BH._cfg || BH._cfgDefaults;
  document.getElementById('cfgWorld').value = c.world || '';
  document.getElementById('cfgStyleCustom').value = c.styleCustom || '';
  document.getElementById('cfgWordMin').value = c.wordMin || 800;
  document.getElementById('cfgWordMax').value = c.wordMax || 1500;
  document.getElementById('cfgCharacters').value = c.characters || '';
  document.getElementById('cfgPlot').value = c.plot || '';
  document.getElementById('cfgAvoid').value = c.avoid || '';

  document.querySelectorAll('#cfgStyleChips .bh-chip').forEach(chip => {
    chip.classList.toggle('bh-chip-active', chip.dataset.val === c.style);
  });
  document.querySelectorAll('#cfgThemeChips .bh-chip').forEach(chip => {
    chip.classList.toggle('bh-chip-active', (c.themes || []).includes(chip.dataset.val));
  });
  document.querySelectorAll('#cfgLength .bh-segment-item').forEach(it => {
    it.classList.toggle('bh-segment-active', it.dataset.val === (c.length || '短篇'));
  });
  document.querySelectorAll('#cfgStatus .bh-segment-item').forEach(it => {
    it.classList.toggle('bh-segment-active', it.dataset.val === (c.status || '连载中'));
  });
};

// chip 单选（文风）
document.addEventListener('click', (e) => {
  const chip = e.target.closest('#cfgStyleChips .bh-chip');
  if (chip) {
    document.querySelectorAll('#cfgStyleChips .bh-chip').forEach(c => c.classList.remove('bh-chip-active'));
    chip.classList.add('bh-chip-active');
  }
  // chip 多选（主题）
  const themeChip = e.target.closest('#cfgThemeChips .bh-chip');
  if (themeChip) themeChip.classList.toggle('bh-chip-active');

  // segment（篇幅 / 完结度）
  const seg = e.target.closest('.bh-segment-item');
  if (seg) {
    const parent = seg.parentElement;
    parent.querySelectorAll('.bh-segment-item').forEach(s => s.classList.remove('bh-segment-active'));
    seg.classList.add('bh-segment-active');
  }
});

BH._readCfgFromForm = function () {
  const styleChip = document.querySelector('#cfgStyleChips .bh-chip-active');
  const themeChips = Array.from(document.querySelectorAll('#cfgThemeChips .bh-chip-active')).map(c => c.dataset.val);
  const lengthSeg = document.querySelector('#cfgLength .bh-segment-active');
  const statusSeg = document.querySelector('#cfgStatus .bh-segment-active');
  return {
    world: document.getElementById('cfgWorld').value.trim(),
    style: styleChip ? styleChip.dataset.val : '',
    styleCustom: document.getElementById('cfgStyleCustom').value.trim(),
    length: lengthSeg ? lengthSeg.dataset.val : '短篇',
    status: statusSeg ? statusSeg.dataset.val : '连载中',
    wordMin: parseInt(document.getElementById('cfgWordMin').value) || 800,
    wordMax: parseInt(document.getElementById('cfgWordMax').value) || 1500,
    themes: themeChips,
    characters: document.getElementById('cfgCharacters').value.trim(),
    plot: document.getElementById('cfgPlot').value.trim(),
    avoid: document.getElementById('cfgAvoid').value.trim(),
  };
};

BH.confirmSettings = function () {
  const cfg = BH._readCfgFromForm();
  if (!cfg.world || !cfg.style) {
    BH.toast('世界观与文风为必填项');
    return;
  }
  BH._cfg = cfg;
  localStorage.setItem('luna_bh_cfg_current', JSON.stringify(cfg));
  BH.closeSettingsSheet();
  BH.toast('设置已保存，可以生成新书了');
};

BH.savePresetPrompt = async function () {
  const cfg = BH._readCfgFromForm();
  if (!cfg.world || !cfg.style) { BH.toast('请先填写世界观与文风'); return; }
  const name = prompt('给这条规则起个名字：');
  if (!name) return;
  await bhDbAddPreset({ name, cfg, time: Date.now() });
  BH._renderPresetList();
  BH.toast('规则已保存');
};

BH._renderPresetList = async function () {
  const list = await bhDbGetAllPresets();
  const el = document.getElementById('cfgPresetList');
  if (!list.length) {
    el.innerHTML = '<div class="bh-field-hint">还没有保存的规则</div>';
    return;
  }
  el.innerHTML = list.map(p => `
    <div class="bh-preset-item" onclick="BH.applyPreset(${p.id})">
      <div class="bh-preset-dot"></div>
      <div class="bh-preset-name">${BH._esc(p.name)}</div>
      <div class="bh-preset-meta">${BH._esc(p.cfg.length)} · ${BH._esc(p.cfg.status)}</div>
      <div class="bh-preset-del" onclick="event.stopPropagation();BH.deletePreset(${p.id})">
        <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </div>
    </div>
  `).join('');
};
BH.applyPreset = async function (id) {
  const list = await bhDbGetAllPresets();
  const p = list.find(x => x.id === id);
  if (!p) return;
  BH._cfg = p.cfg;
  BH._loadCfgIntoForm();
  BH.toast('已调回该规则');
};
BH.deletePreset = async function (id) {
  await bhDbDeletePreset(id);
  BH._renderPresetList();
};

BH._esc = function (s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
};

/* ================================================================
   5. 书册 —— 生成新书（简介层）
   规则：只有用户在"生成设置"里填写了规则（至少世界观+文风）才允许生成；
   否则书册展示的是初始化内容（占位候选书），不触发 AI。
================================================================ */
BH._palette = [
  'linear-gradient(150deg,#3a2f4d,#1c1626)',
  'linear-gradient(150deg,#4a3628,#211714)',
  'linear-gradient(150deg,#2f3a42,#151b1f)',
  'linear-gradient(150deg,#4a2f3a,#1f1319)',
  'linear-gradient(150deg,#2f4238,#131c17)',
  'linear-gradient(150deg,#453a5c,#1a1626)',
];
BH._coverBg = function (seedStr) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
  return BH._palette[h % BH._palette.length];
};

BH._initPlaceholderBooks = function () {
  return [
    { id: 'ph-1', title: '未命名的故事', author: '待生成', synopsis: '在「书册」里点击右下角的生成按钮，填写你的规则，让专属于你的故事在此诞生。', tags: ['等待生成'], placeholder: true },
    { id: 'ph-2', title: '空白的扉页', author: '待生成', synopsis: '每一本书开始之前，都是一页尚未落笔的空白。先在生成设置里写下世界观与文风。', tags: ['等待生成'], placeholder: true },
    { id: 'ph-3', title: '沉睡的手稿', author: '待生成', synopsis: '设置好规则后点击生成，AI 会依据你的设定构思书名、作者与简介。', tags: ['等待生成'], placeholder: true },
  ];
};

BH.openGenSheet = function () {
  document.getElementById('catalogFabWrap').classList.remove('bh-fab-open');
  if (!BH._cfg) {
    BH.toast('请先在“生成设置”中填写规则');
    return;
  }
  BH.generateNewBook();
};

BH._genBatchSize = 6; // 每次「生成新书」在书册里投放的候选书数量

BH.generateNewBook = async function () {
  const cfg = BH._cfg;
  if (!cfg) { BH.toast('请先完成生成设置'); return; }

  const fabMain = document.getElementById('catalogFabMain');
  fabMain.classList.add('bh-fab-spin');
  BH.toast('正在构思新书……');

  const sys = `你是一个专业的对话体网络小说策划编辑。你要依据用户给出的设定，一次性构思 ${BH._genBatchSize} 本"同类型但彼此完全不同"的书籍元信息，
就像书城里同一分类下摆着许多本不同的书供读者挑选。不要生成正文内容。
严格以 JSON 数组返回，数组长度必须是 ${BH._genBatchSize}，每个元素字段为：
{
  "title": "书名（不超过12字，符合世界观与文风的调性，禁止使用韩文字符）",
  "author": "虚构的笔名（2-4字，中文或英文皆可，不使用韩文字符）",
  "synopsis": "150-220字的简介，制造悬念但不要剧透具体章节情节",
  "tags": ["3-5个短标签，从主题分类与文风中提炼"],
  "totalChaptersEstimate": 依据篇幅给出的预估总章节数（短篇8-15，中篇16-40，长篇41-80，整数）
}
要求：
- ${BH._genBatchSize} 本书须共享同一套世界观基调与文风，但书名、作者、具体人物设定、情节切入点、简介必须彼此明显不同，不能是同一个故事换个名字。
- 只返回 JSON 数组，不要任何多余文字。`;

  const userPrompt = `世界观设定：${cfg.world}
文风：${cfg.style}${cfg.styleCustom ? '（补充：' + cfg.styleCustom + '）' : ''}
篇幅：${cfg.length}
完结程度：${cfg.status}
每章字数范围：${cfg.wordMin}-${cfg.wordMax}字
主题分类：${(cfg.themes || []).join('、') || '不限'}
人物关系/CP设定：${cfg.characters || '不限，由你构思，每本书可以有不同的人物关系'}
情节走向要素：${cfg.plot || '不限，由你构思'}
禁用元素：${cfg.avoid || '无'}
这是一批以对话形式为主的小说（后续正文会以角色对话+旁白的形式呈现），请据此构思 ${BH._genBatchSize} 本书的元信息。`;

  try {
    const list = await callLunaAI(sys, userPrompt, { json: true, maxTokens: 3200 });
    const metas = Array.isArray(list) ? list : [list];
    const createdIds = [];
    for (let i = 0; i < metas.length; i++) {
      const meta = metas[i] || {};
      const id = 'book-' + Date.now() + '-' + i;
      const book = {
        id,
        title: meta.title || '未命名之书',
        author: meta.author || '匿名',
        synopsis: meta.synopsis || '',
        tags: Array.isArray(meta.tags) ? meta.tags.slice(0, 5) : [],
        cfg,
        status: cfg.status,
        length: cfg.length,
        totalChaptersEstimate: meta.totalChaptersEstimate || 12,
        createdAt: Date.now() + i,
        stats: BH._genFakeStats(),
        toc: null,          // 目录：未生成
        chapters: {},        // { chapterIndex: {title, dialogueRaw, generatedAt} }
        review: null,        // 书评：未生成
        cast: null,          // 主角信息：随目录一起生成
        pov: null,           // 用户已选定视角（每本书选一次即可，可重选）
        progress: { readChapter: 0 },
        inWishlist: false,
      };
      await bhDbPutBook(book);
      createdIds.push(id);
    }
    await BH.renderCatalog();
    BH.toast(`已生成 ${createdIds.length} 本新书`);
    if (createdIds.length) BH.openDetail(createdIds[0]);
  } catch (err) {
    BH._handleAiError(err);
  } finally {
    fabMain.classList.remove('bh-fab-spin');
  }
};

BH._genFakeStats = function () {
  // 阅读量/收藏量/在线观看均为展示性随机数据
  const reads = 1200 + Math.floor(Math.random() * 480000);
  const favs = Math.floor(reads * (0.06 + Math.random() * 0.1));
  const online = 3 + Math.floor(Math.random() * 260);
  return { reads, favs, online };
};
BH._fmtNum = function (n) {
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万';
  return String(n);
};

BH._handleAiError = function (err) {
  if (err.message === 'NO_API_CONFIG') {
    BH.toast('请先在设置中配置 AI 接口（模型 / API Key）');
  } else if (err.message && err.message.startsWith('AI_JSON_PARSE_FAILED')) {
    BH.toast('AI 返回内容解析失败，请重试');
  } else {
    BH.toast('生成失败：' + (err.message || '未知错误'));
  }
};

/* ================================================================
   6. 渲染：书架（想看的书 + 历史记录） / 书册（候选网格）
================================================================ */
BH.renderShelf = async function () {
  const books = await bhDbGetAllBooks();
  const wishlist = books.filter(b => b.inWishlist);
  const history = books.filter(b => b.progress && b.progress.readChapter > 0)
    .sort((a, b) => (b.progress.lastReadAt || 0) - (a.progress.lastReadAt || 0));

  const wishRow = document.getElementById('wishlistRow');
  if (!wishlist.length) {
    wishRow.innerHTML = `<div class="bh-empty" style="padding:24px 4px;"><div class="bh-empty-text">还没有想看的书，去「书册」挑一本吧</div></div>`;
  } else {
    wishRow.innerHTML = wishlist.map(b => BH._renderBookCard(b)).join('');
  }

  const histList = document.getElementById('historyList');
  if (!history.length) {
    histList.innerHTML = `<div class="bh-empty" style="padding:20px 4px;"><div class="bh-empty-text">还没有阅读记录</div></div>`;
  } else {
    histList.innerHTML = history.map(b => {
      const total = (b.toc && b.toc.length) || b.totalChaptersEstimate || 1;
      const pct = Math.min(100, Math.round((b.progress.readChapter / total) * 100));
      return `
        <div class="bh-history-item" onclick="BH.openDetail('${b.id}')">
          <div class="bh-history-cover" style="background:${BH._coverBg(b.id)};">${BH._esc(b.title.slice(0, 2))}</div>
          <div class="bh-history-info">
            <div class="bh-history-title">${BH._esc(b.title)}</div>
            <div class="bh-history-sub">读到第 ${b.progress.readChapter} 章 · 共 ${total} 章</div>
            <div class="bh-progress-bar"><div class="bh-progress-fill" style="width:${pct}%;"></div></div>
          </div>
          <div class="bh-history-arrow">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
        </div>`;
    }).join('');
  }
};

BH._renderBookCard = function (b) {
  return `
    <div class="bh-book-card" onclick="BH.openDetail('${b.id}')">
      <div class="bh-book-cover" style="background:${BH._coverBg(b.id)};">
        <div class="bh-book-cover-fallback">${BH._esc(b.title)}</div>
      </div>
      <div class="bh-book-title">${BH._esc(b.title)}</div>
      <div class="bh-book-meta">${BH._esc(b.author)} · ${BH._esc(b.status || '')}</div>
    </div>`;
};

BH.renderCatalog = async function () {
  const books = await bhDbGetAllBooks();
  const grid = document.getElementById('catalogGrid');
  const real = books.filter(b => !b.placeholder);
  const showList = real.length ? real : BH._initPlaceholderBooks();

  grid.innerHTML = showList.map(b => {
    const isPh = !!b.placeholder;
    const ribbon = !isPh
      ? (b.status === '已完结'
          ? `<div class="bh-book-ribbon">已完结</div>`
          : `<div class="bh-book-ribbon bh-ribbon-live">连载中</div>`)
      : '';
    return `
    <div class="bh-book-card${isPh ? ' bh-book-placeholder' : ''}" onclick="${isPh ? "BH.toast('请先在生成设置中填写规则')" : `BH.openDetail('${b.id}')`}">
      <div class="bh-book-cover" style="position:relative;background:${isPh ? '' : BH._coverBg(b.id)};">
        ${ribbon}
        <div class="bh-book-cover-fallback">${BH._esc(b.title)}</div>
      </div>
      <div class="bh-book-title">${BH._esc(b.title)}</div>
      <div class="bh-book-meta">${BH._esc(b.author)}</div>
    </div>`;
  }).join('');
};

/* ================================================================
   7. 书籍详情页
================================================================ */
BH._currentBookId = null;

BH.openDetail = async function (id) {
  const book = await bhDbGetBook(id);
  if (!book) { BH.toast('书籍不存在'); return; }
  BH._currentBookId = id;

  document.getElementById('detailCover').style.background = BH._coverBg(id);
  document.getElementById('detailCover').textContent = book.title;
  document.getElementById('detailTitle').textContent = book.title;
  document.getElementById('detailAuthor').textContent = '作者 · ' + book.author;
  document.getElementById('detailTags').innerHTML = (book.tags || []).map(t => `<div class="bh-detail-tag">${BH._esc(t)}</div>`).join('');
  document.getElementById('detailStatus').innerHTML = book.status === '已完结'
    ? `<span>已完结</span>`
    : `<span class="bh-dot-live"></span><span>连载中</span>`;

  document.getElementById('detailSynopsis').textContent = book.synopsis || '暂无简介';

  const stats = book.stats || BH._genFakeStats();
  document.getElementById('statReads').textContent = BH._fmtNum(stats.reads);
  document.getElementById('statFavs').textContent = BH._fmtNum(stats.favs);
  document.getElementById('statOnline').textContent = BH._fmtNum(stats.online);
  const wordCount = Object.values(book.chapters || {}).reduce((sum, c) => sum + (c.wordCount || 0), 0);
  document.getElementById('statWords').textContent = wordCount ? BH._fmtNum(wordCount) : '0';

  BH.switchDetailTab('toc');
  document.querySelectorAll('.bh-view').forEach(v => v.classList.remove('bh-active'));
  document.getElementById('view-detail').classList.add('bh-active');
  document.getElementById('bhMainNav').style.display = 'none';

  await BH._renderTocPane(book);
  await BH._renderReviewPane(book);
  await BH._renderCastPane(book);
};

document.addEventListener('click', (e) => {
  // 详情页返回时恢复导航栏显示（backToLibrary 复用）
});
const _origBack = BH_backHook = function () {};

BH.backToLibrary = function () {
  document.getElementById('bhMainNav').style.display = '';
  BH.switchMainView('library');
};

BH.switchDetailTab = function (pane) {
  document.querySelectorAll('.bh-detail-tab').forEach(t => t.classList.toggle('bh-detail-tab-active', t.dataset.pane === pane));
  document.querySelectorAll('.bh-detail-pane').forEach(p => p.classList.toggle('bh-pane-active', p.id === 'pane-' + pane));
};

/* ---------------- 目录：首次点击才生成 ---------------- */
BH._renderTocPane = async function (book) {
  const el = document.getElementById('pane-toc');
  if (!book.toc) {
    el.innerHTML = `
      <div class="bh-gen-placeholder">
        <div class="bh-gen-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        </div>
        <div class="bh-gen-note">目录尚未生成。点击下方按钮，AI 将依据本书简介与你的生成设置，构思完整的章节目录（此时仍不会写正文）。</div>
        <div class="bh-gen-btn" onclick="BH.generateToc()">生成目录</div>
      </div>`;
    return;
  }
  el.innerHTML = book.toc.map((ch, i) => {
    const done = !!book.chapters[i + 1];
    return `
      <div class="bh-toc-item ${done ? 'bh-toc-done' : ''}" onclick="BH.openChapterFlow(${i + 1})">
        <div class="bh-toc-num">${String(i + 1).padStart(2, '0')}</div>
        <div class="bh-toc-title">${BH._esc(ch.title)}</div>
        <div class="bh-toc-state">${done ? '已生成' : '待生成'}</div>
      </div>`;
  }).join('');
};

BH.generateToc = async function () {
  const book = await bhDbGetBook(BH._currentBookId);
  if (!book) return;
  const el = document.getElementById('pane-toc');
  el.innerHTML = `<div class="bh-ink-loading"><div class="bh-ink-orb"></div><div class="bh-ink-loading-text">正在构思整本书的章节脉络……</div></div>`;

  const cfg = book.cfg || BH._cfgDefaults;
  const sys = `你是专业的网络小说编辑，负责为一部"对话体小说"设计完整目录大纲。
只输出 JSON 对象：
{
  "chapters": [ { "title": "章节标题", "beat": "本章核心剧情梗概，30-60字，作为后续该章正文生成的唯一依据" }, ... ],
  "cast": [
    { "name": "角色名", "role": "male_lead|female_lead|supporting", "brief": "10-25字人物简介" }
  ]
}
要求：
- chapters 数量应符合"篇幅"设定（短篇8-15章，中篇16-40章，长篇41-80章），且严格按剧情发展顺序排列，前后连贯、有起承转合，不能提前把结局写进前面章节的 beat 里。
- 若"完结程度"为连载中，最后一章的 beat 应停在一个悬念点，不要写"结局"。
- cast 中 male_lead / female_lead 各至多1-2位（主角与主CP对象），其余重要角色标记为 supporting，supporting 数量不超过6个。
只返回 JSON，不要任何多余文字。`;
  const userPrompt = `书名：${book.title}
简介：${book.synopsis}
世界观：${cfg.world}
文风：${cfg.style}${cfg.styleCustom ? '（' + cfg.styleCustom + '）' : ''}
篇幅：${cfg.length}
完结程度：${cfg.status}
主题分类：${(cfg.themes || []).join('、') || '不限'}
人物关系/CP设定：${cfg.characters || '由你构思'}
情节走向要素：${cfg.plot || '由你构思'}
禁用元素：${cfg.avoid || '无'}`;

  try {
    const result = await callLunaAI(sys, userPrompt, { json: true, maxTokens: 3000 });
    book.toc = (result.chapters || []).map(c => ({ title: c.title, beat: c.beat }));
    book.cast = (result.cast || []).map((c, idx) => ({
      id: 'cast-' + idx, name: c.name, role: c.role || 'supporting', brief: c.brief || '', avatar: null
    }));
    book.chapters = {};
    book.pov = null;
    await bhDbPutBook(book);
    await BH._renderTocPane(book);
    await BH._renderCastPane(book);
    BH.toast('目录已生成');
  } catch (err) {
    BH._handleAiError(err);
    await BH._renderTocPane(book);
  }
};

/* ---------------- 章节正文：按目录 beat 精确生成对应桥段 ---------------- */
BH.openChapterFlow = async function (chapterIndex) {
  const book = await bhDbGetBook(BH._currentBookId);
  if (!book || !book.toc) return;

  if (!book.pov) {
    BH._pendingChapterAfterPov = chapterIndex;
    BH.openPovSheet(book);
    return;
  }
  await BH._enterReaderForChapter(book, chapterIndex);
};

BH.openPovSheet = function (book) {
  const grid = document.getElementById('povGrid');
  const cast = book.cast || [];
  const leads = cast.filter(c => c.role === 'male_lead' || c.role === 'female_lead');
  const candidates = leads.length ? leads : cast.slice(0, 4);

  if (!candidates.length) {
    // 没有可选角色则默认以"旁观者"视角直接进入
    book.pov = { id: 'narrator', name: '旁观视角' };
    bhDbPutBook(book).then(() => BH._afterPovConfirmed(book));
    return;
  }

  grid.innerHTML = candidates.map(c => `
    <div class="bh-pov-item" data-cast-id="${c.id}" onclick="BH._selectPov('${c.id}')">
      ${c.avatar
        ? `<img class="bh-pov-avatar" src="${c.avatar}" />`
        : `<div class="bh-pov-avatar-fallback" style="background:${BH._coverBg(c.name)};">${BH._esc((c.name || '?').slice(0, 1))}</div>`}
      <div>
        <div class="bh-pov-name">${BH._esc(c.name)}</div>
        <div class="bh-pov-desc">${BH._esc(c.brief || (c.role === 'male_lead' ? '男主视角' : c.role === 'female_lead' ? '女主视角' : ''))}</div>
      </div>
      <div class="bh-pov-check"><svg viewBox="0 0 24 24" fill="none"><path d="M4 12l5 5L20 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    </div>
  `).join('');
  BH._povSelectedId = null;
  document.getElementById('povSheetMask').classList.add('bh-show');
};
BH._selectPov = function (castId) {
  BH._povSelectedId = castId;
  document.querySelectorAll('.bh-pov-item').forEach(it => it.classList.toggle('bh-pov-selected', it.dataset.castId === castId));
};
BH.closePovSheet = function () {
  document.getElementById('povSheetMask').classList.remove('bh-show');
};
BH.confirmPov = async function () {
  if (!BH._povSelectedId) { BH.toast('请选择一个视角'); return; }
  const book = await bhDbGetBook(BH._currentBookId);
  const c = (book.cast || []).find(x => x.id === BH._povSelectedId);
  if (!c) return;
  book.pov = { id: c.id, name: c.name };
  await bhDbPutBook(book);
  BH.closePovSheet();
  await BH._afterPovConfirmed(book);
};
BH._afterPovConfirmed = async function (book) {
  const chapterIndex = BH._pendingChapterAfterPov;
  BH._pendingChapterAfterPov = null;
  if (chapterIndex) await BH._enterReaderForChapter(book, chapterIndex);
};

BH._enterReaderForChapter = async function (book, chapterIndex) {
  document.getElementById('bhReader').classList.add('bh-show');
  const tocEntry = book.toc[chapterIndex - 1];
  document.getElementById('readerChapterTitle').textContent = `第${chapterIndex}章 · ${tocEntry.title}`;
  document.getElementById('readerChapterSub').textContent = `${book.title} · ${book.pov ? book.pov.name + '视角' : ''}`;

  const existing = book.chapters[chapterIndex];
  if (existing) {
    BH._renderReaderContent(existing.dialogueRaw, book);
    BH._updateReadProgress(book, chapterIndex);
    return;
  }
  await BH._generateChapter(book, chapterIndex);
};

BH._generateChapter = async function (book, chapterIndex) {
  const body = document.getElementById('readerBody');
  body.innerHTML = `<div class="bh-ink-loading"><div class="bh-ink-orb"></div><div class="bh-ink-loading-text">正在生成第 ${chapterIndex} 章……</div></div>`;

  const cfg = book.cfg || BH._cfgDefaults;
  const tocEntry = book.toc[chapterIndex - 1];
  const prevBeat = chapterIndex > 1 ? book.toc[chapterIndex - 2].beat : '（这是第一章，无前情）';
  const nextBeat = chapterIndex < book.toc.length ? book.toc[chapterIndex].beat : null;
  const castLine = (book.cast || []).map(c => `${c.name}（${c.role === 'male_lead' ? '男主' : c.role === 'female_lead' ? '女主' : '配角'}）：${c.brief}`).join('\n');

  const sys = `你是专业的对话体小说写手。你只负责撰写"第 ${chapterIndex} 章"这一章的正文，
严禁提前写出后续章节的剧情，也严禁写出结局（除非本章 beat 本身就明确是全书最后一章的收尾）。
本章必须严格围绕给定的"本章剧情梗概(beat)"展开，不能跳跃到其他章节的内容。

输出格式为纯文本，按以下极简标记规则逐行书写，后续程序会用正则解析，请严格遵守：
- 旁白/场景描写/动作描写：以「NARR:」开头，例如：NARR:窗外的雨还没有停。
- 角色对话：以「角色名|说话内容」的格式，例如：${(book.cast[0] || { name: '角色' }).name}|你来了。
- 每一行只能是"NARR:内容"或者"角色名|内容"其中一种，不要输出多余的解释、Markdown标记或标题。
- 字数控制在${cfg.wordMin}-${cfg.wordMax}字之间（按对话+旁白的总字数估算）。
- 文风：${cfg.style}${cfg.styleCustom ? '，' + cfg.styleCustom : ''}。`;

  const userPrompt = `书名：${book.title}
世界观：${cfg.world}
主要角色：
${castLine}

本章标题：${tocEntry.title}
本章剧情梗概（必须严格只写这一段剧情，不能超前）：${tocEntry.beat}
上一章梗概（承接用，不要重复叙述）：${prevBeat}
${nextBeat ? '下一章梗概（仅供你把握本章结尾的悬念感，禁止在本章写出下一章内容）：' + nextBeat : '（本章为全书最后一章）'}
读者当前选择的视角：${book.pov ? book.pov.name : '旁观视角'}（叙事请贴近该视角的观察与感受，但对话仍需忠实呈现所有在场角色）`;

  try {
    const raw = await callLunaAI(sys, userPrompt, { maxTokens: Math.min(4000, Math.ceil((cfg.wordMax || 1500) * 2.2)) });
    const wordCount = raw.replace(/NARR:|^\S+\|/gm, '').replace(/\s/g, '').length;
    book.chapters[chapterIndex] = {
      title: tocEntry.title,
      dialogueRaw: raw,
      wordCount,
      generatedAt: Date.now()
    };
    await bhDbPutBook(book);
    BH._renderReaderContent(raw, book);
    BH._updateReadProgress(book, chapterIndex);
    await BH._renderTocPane(book);
  } catch (err) {
    body.innerHTML = `<div class="bh-gen-placeholder"><div class="bh-gen-note">生成失败：${BH._esc(err.message || '未知错误')}</div><div class="bh-gen-btn" onclick="BH._generateChapter(BH._activeBookCache, ${chapterIndex})">重试</div></div>`;
    BH._handleAiError(err);
  }
};

BH._updateReadProgress = async function (book, chapterIndex) {
  book.progress = book.progress || { readChapter: 0 };
  book.progress.readChapter = Math.max(book.progress.readChapter || 0, chapterIndex);
  book.progress.lastReadAt = Date.now();
  await bhDbPutBook(book);
};

/* ---------------- 对话内容解析 + 点击逐步展开渲染 ---------------- */
BH._parseDialogue = function (raw, book) {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const nodes = [];
  const castByName = {};
  (book.cast || []).forEach(c => { castByName[c.name] = c; });
  let sideIdx = 0;

  lines.forEach(line => {
    if (/^NARR[:：]/.test(line)) {
      nodes.push({ type: 'narration', text: line.replace(/^NARR[:：]/, '').trim() });
      return;
    }
    const m = line.match(/^([^|:：]{1,12})[|：:](.+)$/);
    if (m) {
      const name = m[1].trim();
      const text = m[2].trim();
      const cast = castByName[name];
      const isLead = cast && (cast.role === 'male_lead' || cast.role === 'female_lead');
      const side = isLead && cast.role === 'female_lead' ? 'right' : 'left';
      nodes.push({
        type: 'msg', name, text, side,
        avatar: cast ? cast.avatar : null,
        isSupportingText: !cast || cast.role === 'supporting'
      });
    } else {
      nodes.push({ type: 'narration', text: line });
    }
  });
  return nodes;
};

BH._renderReaderContent = function (raw, book) {
  BH._activeBookCache = book;
  const nodes = BH._parseDialogue(raw, book);
  const body = document.getElementById('readerBody');
  body.innerHTML = '';
  BH._readerNodes = nodes;
  BH._readerRevealIndex = 0;
  BH._revealNext(1); // 首次进入只显示第一条（通常是旁白），其余需要用户点击「继续」逐条展开
};

BH._revealNext = function (count = 1) {
  const body = document.getElementById('readerBody');
  const existingHint = body.querySelector('.bh-reveal-hint');
  if (existingHint) existingHint.remove();

  const end = Math.min(BH._readerNodes.length, BH._readerRevealIndex + count);
  for (let i = BH._readerRevealIndex; i < end; i++) {
    body.appendChild(BH._renderNode(BH._readerNodes[i], i));
  }
  BH._readerRevealIndex = end;

  if (BH._readerRevealIndex < BH._readerNodes.length) {
    const hint = document.createElement('div');
    hint.className = 'bh-reveal-hint';
    hint.onclick = () => BH._revealNext(1);
    hint.innerHTML = `<span>继续</span><svg viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    body.appendChild(hint);
  } else {
    const end = document.createElement('div');
    end.className = 'bh-reader-endcard';
    end.innerHTML = `
      <div class="bh-reader-endcard-title">本章完</div>
      <div class="bh-reader-endcard-desc">这一章先讲到这里，剩余的桥段将在你继续阅读时揭晓。</div>
      <div class="bh-btn bh-btn-primary" style="display:inline-block;padding:11px 26px;" onclick="BH.jumpToToc()">返回目录</div>
    `;
    body.appendChild(end);
  }
  requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
};

BH._renderNode = function (node, i) {
  const wrap = document.createElement('div');
  if (node.type === 'narration') {
    wrap.className = 'bh-narration';
    wrap.style.animationDelay = '0s';
    wrap.textContent = node.text;
    return wrap;
  }
  wrap.className = `bh-msg-row bh-msg-${node.side}`;
  const avatarHtml = node.avatar
    ? `<img class="bh-msg-avatar" src="${node.avatar}" />`
    : `<div class="bh-msg-avatar-fallback" style="background:${BH._coverBg(node.name)};">${BH._esc((node.name || '?').slice(0, 1))}</div>`;
  wrap.innerHTML = `
    ${avatarHtml}
    <div class="bh-msg-col">
      <div class="bh-msg-name">${BH._esc(node.name)}</div>
      <div class="bh-msg-bubble">${BH._esc(node.text)}</div>
    </div>`;
  return wrap;
};

BH.closeReader = function () {
  document.getElementById('bhReader').classList.remove('bh-show');
};
BH.jumpToToc = function () {
  BH.closeReader();
  BH.switchDetailTab('toc');
};

/* ---------------- 书评：依据简介 + 已生成正文的一致性生成 ---------------- */
BH._reviewerNames = ['墨小生', '棠梨煮酒', '桑晚', '青苔纪', '不糖', '南栀', '半盏茶', '拾光人'];
BH._renderReviewPane = async function (book) {
  const el = document.getElementById('pane-review');
  if (!book.review) {
    el.innerHTML = `
      <div class="bh-gen-placeholder">
        <div class="bh-gen-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M12 17.3l-5.9 3.5 1.6-6.7L2 9.6l6.8-.6L12 2.7l3.2 6.3 6.8.6-5.7 4.5 1.6 6.7z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
        </div>
        <div class="bh-gen-note">书评尚未生成。AI 会依据本书简介与已生成的正文内容（若有），生成与故事走向一致的读者书评。</div>
        <div class="bh-gen-btn" onclick="BH.generateReview()">生成书评</div>
      </div>`;
    return;
  }
  el.innerHTML = book.review.map(r => `
    <div class="bh-review-item">
      <div class="bh-review-head">
        <div class="bh-review-avatar" style="background:${BH._coverBg(r.name)};">${BH._esc(r.name.slice(0, 1))}</div>
        <div class="bh-review-name">${BH._esc(r.name)}</div>
        <div class="bh-review-score">${BH._renderStars(r.score)}</div>
      </div>
      <div class="bh-review-text">${BH._esc(r.text)}</div>
    </div>
  `).join('');
};
BH._renderStars = function (score) {
  let s = '';
  for (let i = 0; i < 5; i++) {
    s += i < score
      ? `<svg viewBox="0 0 24 24" fill="#4a4642"><path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 16.9 5.8 20.3l1.6-6.8L2.2 8.9l6.9-.6z"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="rgba(30,28,26,0.22)" stroke-width="1.4"><path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 16.9 5.8 20.3l1.6-6.8L2.2 8.9l6.9-.6z"/></svg>`;
  }
  return s;
};

BH.generateReview = async function () {
  const book = await bhDbGetBook(BH._currentBookId);
  if (!book) return;
  const el = document.getElementById('pane-review');
  el.innerHTML = `<div class="bh-ink-loading"><div class="bh-ink-orb"></div><div class="bh-ink-loading-text">正在生成读者书评……</div></div>`;

  // 关键：只把"简介 + 已生成章节的实际内容摘要"喂给模型，保证书评不会剧透未生成的桥段
  const generatedChapters = Object.keys(book.chapters).map(Number).sort((a, b) => a - b);
  const contentDigest = generatedChapters.length
    ? generatedChapters.map(idx => `第${idx}章《${book.chapters[idx].title}》已发生的内容概要：${book.toc[idx - 1].beat}`).join('\n')
    : '目前全书仅有简介，正文尚未生成，书评应只基于简介展开期待，不能提及具体章节情节。';

  const sys = `你是模拟多位真实读者撰写网络小说书评的助手。只输出 JSON 数组，每个元素为：
{ "name": "读者昵称（不使用韩文字符）", "score": 1-5的整数, "text": "60-120字的书评内容" }
生成4条书评。要求：
- 书评内容必须与"简介"和"已发生内容概要"保持一致，绝对不能剧透简介与已生成内容之外的情节（因为读者只可能读到目前已发布的部分）。
- 若正文尚未生成，书评应表达对世界观/简介的期待与猜测，不能编造具体桥段。
- 语气、用词应自然多样，避免千篇一律。
只返回 JSON 数组，不要多余文字。`;
  const userPrompt = `书名：${book.title}
简介：${book.synopsis}
${contentDigest}`;

  try {
    const list = await callLunaAI(sys, userPrompt, { json: true, maxTokens: 1200 });
    book.review = (Array.isArray(list) ? list : []).map((r, i) => ({
      name: r.name || BH._reviewerNames[i % BH._reviewerNames.length],
      score: Math.min(5, Math.max(1, parseInt(r.score) || 4)),
      text: r.text || ''
    }));
    await bhDbPutBook(book);
    await BH._renderReviewPane(book);
    BH.toast('书评已生成');
  } catch (err) {
    BH._handleAiError(err);
    await BH._renderReviewPane(book);
  }
};

/* ---------------- 角色 / 头像上传 ---------------- */
BH._renderCastPane = async function (book) {
  const el = document.getElementById('pane-cast');
  if (!book.cast) {
    el.innerHTML = `<div class="bh-empty"><div class="bh-empty-text">生成目录后，主角信息会一并出现在这里，可为主角上传专属头像；配角将以文字头像呈现。</div></div>`;
    return;
  }
  el.innerHTML = `<div class="bh-cast-list">` + book.cast.map(c => {
    const isLead = c.role === 'male_lead' || c.role === 'female_lead';
    const avatarHtml = isLead
      ? (c.avatar
          ? `<img class="bh-cast-avatar" src="${c.avatar}" />`
          : `<div class="bh-cast-avatar-empty">${BH._esc((c.name || '?').slice(0, 1))}</div>`)
      : `<div class="bh-cast-avatar-empty" style="background:${BH._coverBg(c.name)};color:#fff;">${BH._esc((c.name || '?').slice(0, 1))}</div>`;
    return `
      <div class="bh-cast-item">
        <div class="bh-cast-avatar-wrap">
          ${avatarHtml}
          ${isLead ? `<div class="bh-cast-upload-badge" onclick="BH.uploadCastAvatar('${c.id}')"><svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></div>` : ''}
        </div>
        <div class="bh-cast-info">
          <div class="bh-cast-name">${BH._esc(c.name)}</div>
          <div class="bh-cast-role">${c.role === 'male_lead' ? '男主角' : c.role === 'female_lead' ? '女主角' : '配角'} · ${BH._esc(c.brief || '')}</div>
        </div>
      </div>`;
  }).join('') + `</div>`;
};

BH.uploadCastAvatar = function (castId) {
  const input = document.getElementById('castFileInput');
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const book = await bhDbGetBook(BH._currentBookId);
      const c = book.cast.find(x => x.id === castId);
      if (c) c.avatar = reader.result;
      await bhDbPutBook(book);
      await BH._renderCastPane(book);
      BH.toast('头像已更新');
    };
    reader.readAsDataURL(file);
    input.value = '';
  };
  input.click();
};

/* ================================================================
   8. 初始化
================================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  const savedCfg = localStorage.getItem('luna_bh_cfg_current');
  if (savedCfg) { try { BH._cfg = JSON.parse(savedCfg); } catch (e) {} }

  await BH.renderShelf();
  await BH.renderCatalog();
});