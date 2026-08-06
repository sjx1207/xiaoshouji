/* ============================================================
   心动旅行 · travel.js
   完整逻辑体系：目的地 → 订票 → 行李 → N天旅程 → 手账
   数据落库 IndexedDB「LunaTravelDB / trips」，按角色隔离
   与 characters.js / worldbook.js / settings.js 共用同一套
   localStorage 键与 IndexedDB 命名空间，保证角色人设、
   世界书常驻设定、API 配置全部原样复用，不另起炉灶。
============================================================ */

/* ================================
   状态栏 — 完整同步 index
================================ */
function updateTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const now = new Date();
  const s = now.toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  document.querySelectorAll('.status-time').forEach(el => el.textContent = s);
}
function updateBattery() {
  function render(pct) {
    const p = Math.round(pct);
    document.querySelectorAll('.bat-pct').forEach(el => el.textContent = p);
    document.querySelectorAll('.bat-inner').forEach(el => {
      el.style.width = p + '%';
      el.style.background = p <= 20 ? 'linear-gradient(90deg,#f87171,#ef4444)' : 'var(--ink)';
    });
  }
  if ('getBattery' in navigator) {
    navigator.getBattery().then(b => { render(b.level * 100); b.addEventListener('levelchange', () => render(b.level * 100)); });
  } else render(76);
}
function applyIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style = localStorage.getItem('luna_island_style') || 'minimal';
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
  document.querySelectorAll('.status-island').forEach(el => { el.innerHTML = enabled ? (styleMap[style] || styleMap.minimal) : ''; });
}
setInterval(updateTime, 10000);
updateTime(); updateBattery(); applyIsland();
window.addEventListener('storage', (e) => {
  if (e.key === 'luna_island_update') applyIsland();
  if (e.key === 'luna_tz_update') updateTime();
});

/* ================================
   Toast
================================ */
let _toastTimer = null;
function showToast(msg, ms = 2200) {
  const el = document.getElementById('trToast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

function escHtml(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ================================
   IndexedDB — LunaCharDB（只读，取当前角色资料）
================================ */
function openCharDB() {
  return new Promise((res, rej) => {
    const probe = indexedDB.open('LunaCharDB');
    probe.onsuccess = e => {
      const cur = e.target.result;
      const ver = cur.version;
      const hasChars = cur.objectStoreNames.contains('chars');
      cur.close();
      if (hasChars) {
        const req2 = indexedDB.open('LunaCharDB', ver);
        req2.onsuccess = e2 => res(e2.target.result);
        req2.onerror = e2 => rej(e2.target.error);
      } else {
        const req3 = indexedDB.open('LunaCharDB', ver + 1);
        req3.onupgradeneeded = e3 => {
          const db3 = e3.target.result;
          if (!db3.objectStoreNames.contains('chars')) db3.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
        };
        req3.onsuccess = e3 => res(e3.target.result);
        req3.onerror = e3 => rej(e3.target.error);
      }
    };
    probe.onerror = e => rej(e.target.error);
    probe.onupgradeneeded = e => {
      const db0 = e.target.result;
      if (!db0.objectStoreNames.contains('chars')) db0.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
    };
  });
}
async function getActiveCharRecord() {
  const activeId = parseInt(localStorage.getItem('luna_active_char')) || null;
  if (!activeId) return null;
  try {
    const db = await openCharDB();
    return new Promise(res => {
      if (!db.objectStoreNames.contains('chars')) return res(null);
      const req = db.transaction('chars', 'readonly').objectStore('chars').get(activeId);
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => res(null);
    });
  } catch (e) { return null; }
}

/* ================================
   IndexedDB — LunaTravelDB / trips
   每条 trip 记录都带 charId，按角色隔离数据，
   与角色档案页展示逻辑一致的「自建库、自愈版本」模式。
================================ */
let _travelDb = null;
function openTravelDB() {
  if (_travelDb) return Promise.resolve(_travelDb);
  return new Promise((res, rej) => {
    const probe = indexedDB.open('LunaTravelDB');
    probe.onsuccess = e => {
      const cur = e.target.result;
      const ver = cur.version;
      const hasTrips = cur.objectStoreNames.contains('trips');
      cur.close();
      if (hasTrips) {
        const req2 = indexedDB.open('LunaTravelDB', ver);
        req2.onsuccess = e2 => { _travelDb = e2.target.result; res(_travelDb); };
        req2.onerror = e2 => rej(e2.target.error);
      } else {
        const req3 = indexedDB.open('LunaTravelDB', ver + 1);
        req3.onupgradeneeded = e3 => {
          const db3 = e3.target.result;
          if (!db3.objectStoreNames.contains('trips')) {
            const store = db3.createObjectStore('trips', { keyPath: 'id', autoIncrement: true });
            store.createIndex('charId', 'charId', { unique: false });
            store.createIndex('status', 'status', { unique: false });
          }
        };
        req3.onsuccess = e3 => { _travelDb = e3.target.result; res(_travelDb); };
        req3.onerror = e3 => rej(e3.target.error);
      }
    };
    probe.onerror = e => rej(e.target.error);
    probe.onupgradeneeded = e => {
      const db0 = e.target.result;
      if (!db0.objectStoreNames.contains('trips')) {
        const store = db0.createObjectStore('trips', { keyPath: 'id', autoIncrement: true });
        store.createIndex('charId', 'charId', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };
  });
}
async function saveTrip(trip) {
  const db = await openTravelDB();
  // 防御性修复：只要不是「正整数」都视为「还没有主键」，一律走 add()，
  // 避免 id 被意外写成 null/0/NaN/字符串时再次触发 DataError。
  const hasValidId = Number.isInteger(trip.id) && trip.id > 0;
  if (!hasValidId) delete trip.id;
  return new Promise(res => {
    const tx = db.transaction('trips', 'readwrite');
    const store = tx.objectStore('trips');
    const req = hasValidId ? store.put(trip) : store.add(trip);
    req.onsuccess = () => { trip.id = req.result; res(trip.id); };
    req.onerror = (e) => { console.error('saveTrip 写入失败', e.target.error); res(null); };
  });
}
async function getTripsByChar(charId) {
  const db = await openTravelDB();
  return new Promise(res => {
    if (!db.objectStoreNames.contains('trips')) return res([]);
    const idx = db.transaction('trips', 'readonly').objectStore('trips').index('charId');
    const req = idx.getAll(charId);
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => res([]);
  });
}
async function getTripById(id) {
  const db = await openTravelDB();
  return new Promise(res => {
    const req = db.transaction('trips', 'readonly').objectStore('trips').get(id);
    req.onsuccess = () => res(req.result || null);
    req.onerror = () => res(null);
  });
}

/* ================================
   IndexedDB — LunaMemoryDB（旅行结束后写入记忆档案）
   与 characters.js 里 buildMemoryPromptStandalone 读取的
   同一个库同一个 store，保证手账写入后角色"记得住"。
================================ */
function openMemDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('LunaMemoryDB', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('memories')) {
        const store = db.createObjectStore('memories', { keyPath: 'id' });
        store.createIndex('charId', 'charId', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e.target.error);
  });
}
async function saveTripMemory(charId, trip, journalSummary) {
  try {
    const db = await openMemDB();
    const mem = {
      id: 'travel_' + trip.id + '_' + Date.now(),
      charId: charId,
      charName: trip.charName || '',
      type: 'event',
      title: `旅行手账 · ${trip.destination}`,
      content: journalSummary,
      prompt: journalSummary,
      intensity: Math.min(5, Math.max(1, Math.round((trip.affinity || 0) / 20))),
      alwaysOn: false,
      time: Date.now(),
      source: 'travel'
    };
    return new Promise(res => {
      const req = db.transaction('memories', 'readwrite').objectStore('memories').put(mem);
      req.onsuccess = () => res(true);
      req.onerror = () => res(false);
    });
  } catch (e) { console.error('写入记忆失败', e); return false; }
}

/* ================================
   世界书常驻设定读取（用于系统提示，与角色档案共用逻辑）
================================ */
function openWbDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('LunaWorldBookDB', 2);
    req.onupgradeneeded = e => {
      if (!e.target.result.objectStoreNames.contains('entries')) e.target.result.createObjectStore('entries', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror = () => rej('WB DB Error');
  });
}
async function getAllWbEntries() {
  try {
    const db = await openWbDB();
    return new Promise(res => {
      const req = db.transaction('entries', 'readonly').objectStore('entries').getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    });
  } catch (e) { return []; }
}

/* ================================
   API 调用层 — 复用 settings.js 保存的
   luna_api_current / luna_api_model
================================ */
function getApiConfig() {
  const cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  return { baseUrl: (cur.baseUrl || '').replace(/\/$/, ''), apiKey: cur.apiKey || '', model };
}
function hasApiConfig() {
  const c = getApiConfig();
  return !!(c.baseUrl && c.apiKey && c.model);
}

/**
 * 调用聊天补全接口。
 * systemPrompt: 角色人设 + 世界书 + 记忆 + 本模块任务说明
 * userPrompt:   具体本次要生成什么
 * jsonMode:     要求模型仅返回 JSON（用于结构化内容如行程方案/事件）
 */
async function callAI(systemPrompt, userPrompt, jsonMode = false, maxTokens = 800) {
  const cfg = getApiConfig();
  if (!cfg.baseUrl || !cfg.apiKey || !cfg.model) {
    throw new Error('NO_API_CONFIG');
  }
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });

  const resp = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.9,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
    })
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';
  return content.trim();
}

/** 尝试从模型输出中提取 JSON（容错：模型可能包裹在```json块里） */
function safeParseJSON(text, fallback) {
  if (!text) return fallback;
  let t = text.trim();
  t = t.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
  const first = t.indexOf('{'); const firstArr = t.indexOf('[');
  let start = -1;
  if (first === -1) start = firstArr; else if (firstArr === -1) start = first; else start = Math.min(first, firstArr);
  if (start > 0) t = t.slice(start);
  try { return JSON.parse(t); } catch (e) {
    // 尝试截断到最后一个闭合符号
    const lastBrace = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
    if (lastBrace > 0) {
      try { return JSON.parse(t.slice(0, lastBrace + 1)); } catch (e2) { return fallback; }
    }
    return fallback;
  }
}

/* ================================
   角色上下文 — 组装系统提示词
   直接复用 characters.js 应用角色时写入的 luna_char_prompt
   （已经包含人设 + 世界书常驻设定 + 记忆档案），
   在此基础上叠加"心动旅行"模块任务说明，
   保证角色人格与设定跨模块保持一致，不重新拼接一遍。
================================ */
/* ================================
   角色上下文 —— 直接在本页读取 LunaCharDB 里的全部角色，
   不依赖用户先去 characters.html 点"应用"。
   选中某个角色后，在这里就地拼出与 characters.js 的
   applyCard() 完全一致的 fullPrompt（人设 + 世界书常驻设定 +
   记忆档案），写回 luna_active_char / luna_char_prompt，
   保证跨模块（聊天页等）读到的仍是同一份数据，而不是
   另起一套互不相干的旅行专属人设。
================================ */
let CHAR = { id: null, name: '', prompt: '', avatar: '', gender: '' };
let ALL_CHARS = [];

async function getAllCharsFromDB() {
  try {
    const db = await openCharDB();
    return new Promise(res => {
      if (!db.objectStoreNames.contains('chars')) return res([]);
      const req = db.transaction('chars', 'readonly').objectStore('chars').getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    });
  } catch (e) { return []; }
}

/* 世界书常驻设定 —— 与 characters.js 的 buildWorldbookPromptForChar 同逻辑 */
async function buildWorldbookPromptForChar(charId) {
  const allEntries = await getAllWbEntries();
  const relevant = allEntries.filter(e => {
    if (e.enabled === false) return false;
    if (e.mode !== 'constant') return false;
    const chars = Array.isArray(e.chars) ? e.chars : [];
    return chars.length === 0 || chars.includes(charId);
  });
  if (!relevant.length) return '';
  relevant.sort((a, b) => (b.priority ?? 5) - (a.priority ?? 5));
  let block = `【世界设定 —— 来自关联世界书，请作为背景真实世界规则遵守】\n`;
  relevant.forEach(e => {
    block += `◆ ${e.title || '未命名'}`;
    if (e.sub) block += `（${e.sub}）`;
    block += `\n${e.detail || ''}\n\n`;
  });
  return block.trim();
}

function _memTypeLabel(type) {
  return { core: '核心记忆', relation: '关系', emotion: '情绪', event: '事件' }[type] || '记忆';
}
/* 记忆档案拼接 —— 与 characters.js 的 buildMemoryPromptStandalone 同逻辑，
   保证「应用角色」无论从角色档案页点，还是在旅行页里选，拼出来的
   prompt 结构完全一致 */
async function buildMemoryPromptForChar(charId) {
  try {
    const db = await openMemDB();
    const all = await new Promise(res => {
      if (!db.objectStoreNames.contains('memories')) return res([]);
      const req = db.transaction('memories', 'readonly').objectStore('memories').getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    });
    const mems = all.filter(m => m.charId === charId || m.charName === charId);
    if (!mems.length) return '';

    const alwaysOn = mems.filter(m => m.alwaysOn);
    const rest = mems.filter(m => !m.alwaysOn);
    const byType = t => rest.filter(m => (m.type || 'core') === t).sort((a, b) => (b.intensity || 0) - (a.intensity || 0));
    const relationMems = byType('relation').slice(0, 3);
    const emotionMems = byType('emotion').slice(0, 3);
    const eventMems = byType('event').concat(byType('core')).slice(0, 5);

    const lines = [`[记忆档案注入 · ${charId}]`];
    if (alwaysOn.length) {
      lines.push('\n【核心常驻记忆 · 每次对话必定生效，具有最高优先级】');
      alwaysOn.slice(0, 6).forEach(m => {
        lines.push(`- ${m.title}（${_memTypeLabel(m.type)}）`);
        if (m.prompt) lines.push(`  → ${m.prompt}`);
        else if (m.content) lines.push(`  → ${m.content.slice(0, 120)}`);
      });
    }
    if (relationMems.length) {
      lines.push('\n【当前关系状态 · 请据此判断称呼与亲密程度，不要回退到更早的关系阶段】');
      relationMems.forEach(m => lines.push(`- ${m.title}：${(m.prompt || m.content || '').slice(0, 90)}`));
    }
    if (emotionMems.length) {
      lines.push('\n【近期情绪基调 · 情绪表达应与此保持连贯，不要无故跳变】');
      emotionMems.forEach(m => lines.push(`- ${m.title}（强度${m.intensity || 3}/5）：${(m.prompt || m.content || '').slice(0, 70)}`));
    }
    if (eventMems.length) {
      lines.push('\n【背景记忆参考 · 可作为细节引用，非必须逐条复述】');
      eventMems.forEach(m => lines.push(`- ${m.title}：${(m.prompt || m.content || '').slice(0, 70)}`));
    }
    lines.push('\n【格式与人设锚点 · 无论对话进行多久都必须遵守】');
    lines.push('- 全程保持第一人称的角色身份，不得以"AI助手""语言模型"等身份自称或跳出角色解释');
    lines.push('- 以上记忆是角色本身已知的过去，不是外部资料，回应时应像自然想起，而非罗列信息');
    lines.push('- 若记忆与用户当前所说内容冲突，以维持角色人设一致性为优先，不随意"失忆"或人设漂移');
    return lines.join('\n');
  } catch (e) { return ''; }
}

/* 就地"应用角色"：与 characters.js applyCard() 写入同一批 localStorage 键，
   保证聊天页等其他模块下次读取时，看到的仍是这次在旅行页选的角色。 */
async function applyCharInPlace(rec, onStep) {
  localStorage.setItem('luna_active_char', rec.id);
  localStorage.setItem('luna_char_name', rec.name || '');
  if (onStep) onStep('persona');

  const charKey = rec.id != null ? rec.id : rec.name;
  const worldPrompt = await buildWorldbookPromptForChar(rec.id);
  if (onStep) onStep('world');
  const memoryPrompt = await buildMemoryPromptForChar(charKey);
  if (onStep) onStep('memory');

  let fullPrompt = rec.prompt || '';
  if (worldPrompt) fullPrompt += `\n\n${worldPrompt}`;
  if (memoryPrompt) fullPrompt += `\n\n${memoryPrompt}`;
  localStorage.setItem('luna_char_prompt', fullPrompt);
  localStorage.setItem('luna_char_db_update', Date.now());

  CHAR = {
    id: rec.id,
    name: rec.name || 'TA',
    prompt: fullPrompt,
    avatar: rec.avatar || '',
    gender: rec.gender || '',
    traits: rec.traits || [],
    role: rec.role || ''
  };
  return CHAR;
}

/* 仅读取「当前已同步」的角色（若有），不做任何跳转判断，
   跳转/兜底逻辑统一交给 initTravelApp() 处理 */
async function loadActiveCharacter() {
  const activeId = parseInt(localStorage.getItem('luna_active_char')) || null;
  if (!activeId) { CHAR = { id: null }; return null; }
  const rec = await getActiveCharRecord();
  if (!rec) {
    localStorage.removeItem('luna_active_char');
    localStorage.removeItem('luna_char_prompt');
    localStorage.removeItem('luna_char_name');
    CHAR = { id: null };
    return null;
  }
  const fullPrompt = localStorage.getItem('luna_char_prompt') || rec.prompt || '';
  const name = localStorage.getItem('luna_char_name') || rec.name || 'TA';
  CHAR = {
    id: rec.id, name, prompt: fullPrompt,
    avatar: rec.avatar || '', gender: rec.gender || '',
    traits: rec.traits || [], role: rec.role || ''
  };
  return CHAR;
}

/* 代称：根据角色实际性别取「她/他/TA」，未设置性别时统一用中性「TA」，
   不擅自假定为女性。所有界面文案与 AI 提示词中提到角色代称的地方
   都必须走这里，不允许硬编码"她"。 */
function pronoun() {
  if (CHAR.gender === '女' || CHAR.gender === '女性') return '她';
  if (CHAR.gender === '男' || CHAR.gender === '男性') return '他';
  return 'TA';
}

function travelSystemPrompt(taskDesc) {
  const base = CHAR.prompt || `你正在扮演一个名为「${CHAR.name}」的角色，请以第一人称与用户互动。`;
  return `${base}

【当前场景 · 心动旅行模块】
你和用户正在共同经历一趟旅行策划与旅程。你需要完全代入自己的人设、说话习惯与性格，对旅行中的每一步给出符合角色气质的反应与语言。
${taskDesc}

【硬性格式要求】
- 只输出要求的内容本身，不要解释你在做什么，不要出现"作为AI"等跳出角色的表述。
- 语言要有真实的情感与个性，避免公式化、客套的旅行社话术。
- 不要使用markdown标题符号（#、*号加粗等），用自然语言书写。`;
}

/* ================================
   全局旅程状态 TRIP
================================ */
let TRIP = null; // 当前进行中/筹备中的行程对象，落库对象本体
let CAL_STATE = { year: 0, month: 0 }; // 日历视图年月（0-based month）
let _packState = {};

function newEmptyTrip() {
  const now = Date.now();
  return {
    // 关键修复：IndexedDB 的 autoIncrement 主键要求这个属性「不存在」或为 undefined，
    // 一旦显式赋值 null，会被当作一个非法的 key 传给 add()，直接抛出 DataError，
    // 导致后续每一步 goStep() 里的 saveTrip() 全部失败（这就是你看到的报错来源）。
    id: undefined,
    charId: CHAR.id,
    charName: CHAR.name,
    status: 'planning',           // planning | ongoing | finished
    destination: '', destinationEn: '',
    origin: '', originEn: '',     // 出发地
    planOptions: [], planIndex: null,
    days: 0, style: '',
    transportOptions: [], transport: null,
    dateStart: null, dateEnd: null,
    waypoints: [],                 // 途经点 [{name, en}]
    flightOptions: [], flight: null, // 航班/车次选项与已选项
    seatOptions: [], seat: null, windowSeat: true,
    seatMap: null, seatNumber: null, // 座位图 & 已选具体座位号
    checkedIn: false, gate: null,   // 值机状态与登机口
    treat: false, price: 0,
    weatherLine: [],              // 每天天气
    packing: {},                  // { category: [{name, checked}] }
    itinerary: [],                // 每天内容: {dayIndex, opening, spots:[], events:[], summary, timeline:[], unlocked, done}
    camera: [],                   // 手动收藏 {dayIndex, url, caption}
    affinity: 0,
    journal: null,
    createdAt: now, updatedAt: now
  };
}

/* 精选推荐的兜底池：仅在未配置 API 或 AI 生成失败时使用，
   正常情况下这一区应由 AI 结合角色人设实时生成，而不是一直显示这几个固定地点 */
const DESTINATIONS_FALLBACK = [
  { name: '京都', en: 'KYOTO, JAPAN' },
  { name: '巴厘岛', en: 'BALI, INDONESIA' },
  { name: '巴黎', en: 'PARIS, FRANCE' },
  { name: '冰岛', en: 'ICELAND' },
  { name: '威尼斯', en: 'VENICE, ITALY' },
  { name: '青海湖', en: 'QINGHAI LAKE' },
  { name: '首尔', en: 'SEOUL, KOREA' },
  { name: '摩洛哥马拉喀什', en: 'MARRAKECH, MOROCCO' },
];
/* 保留旧变量名以兼容惊喜事件等处的随机取值逻辑 */
const DESTINATIONS = DESTINATIONS_FALLBACK;

/* ================================
   目的地卡片背景 —— 纯 CSS 生成式风景，不依赖任何外部图床
   （原先用的 source.unsplash.com 已经下线，这就是之前卡片
   经常空白/裂图的根本原因）。用地名做一个简单哈希当种子，
   同一个地点每次生成的色相、纹理走向基本一致，观感更精致。
================================ */
function _strHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}
/* 返回一组用于卡片背景的 CSS 变量，而不是一张图片 URL */
function destSceneFor(name, en) {
  const seed = _strHash((en || name || 'trip') + '');
  const hueA = seed % 360;
  const hueB = (hueA + 26 + (seed % 40)) % 360;
  const tilt = (seed % 7) - 3;               // 山形/光斑角度扰动
  const rise = 34 + (seed % 22);             // "地平线"高度扰动
  const dotX = 18 + (seed % 64);
  const dotY = 10 + ((seed >> 3) % 30);
  const variant = seed % 4;                  // 4 种构图变体，避免千卡一面
  return { hueA, hueB, tilt, rise, dotX, dotY, variant, seed };
}

/* ================================
   屏幕切换
================================ */
function showScreen(id) {
  document.querySelectorAll('.tr-screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}
function backTo(id) { showScreen(id); }
function goBackHome() {
  if (TRIP && TRIP.status === 'ongoing') { showScreen('scrJourney'); return; }
  showScreen('scrHome');
}

/* ================================
   初始化
   逻辑：
   - 若上次同步的角色名下有「进行中」的旅程 → 直接续上，不打断旅程去重选旅伴
   - 否则一律先进入「选择旅伴」页，由用户在本页直接点选，
     不再依赖 localStorage 里是否已有 luna_active_char，
     也绝不跳转 characters.html
================================ */
async function initTravelApp() {
  showScreen('scrBoot');
  await loadActiveCharacter();

  if (CHAR.id) {
    const trips = await getTripsByChar(CHAR.id);
    const ongoing = trips.find(t => t.status === 'ongoing');
    if (ongoing) {
      TRIP = ongoing;
      await enterHomeForChar();
      renderJourneyHome();
      showScreen('scrJourney');
      return;
    }
  }
  await enterCharPicker();
}
window.addEventListener('DOMContentLoaded', initTravelApp);

/* ================================
   选择旅伴 —— 直接读取 LunaCharDB 全部角色并渲染卡片，
   点选后就地同步（不跳转），再进入目的地流程
================================ */
async function enterCharPicker() {
  showScreen('scrPickChar');
  ALL_CHARS = await getAllCharsFromDB();
  renderCharPicker();
}

function _charInitial(rec) { return ((rec.name || '?')[0] || '?').toUpperCase(); }

function renderCharPicker() {
  const grid = document.getElementById('pickCharGrid');
  const empty = document.getElementById('pickCharEmpty');
  if (!ALL_CHARS.length) {
    grid.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';
  grid.innerHTML = ALL_CHARS.map((c, i) => {
    const sc = destSceneFor(c.name, c.role || c.name);
    const genderTag = c.gender === '女' || c.gender === '女性' ? '她' : (c.gender === '男' || c.gender === '男性' ? '他' : 'TA');
    return `
    <div class="tr-pick-card" style="animation:destCardIn .6s cubic-bezier(.22,1,.36,1) both ${i*0.07}s;
         --hue-a:${sc.hueA}; --hue-b:${sc.hueB}; --tilt:${sc.tilt}deg;"
      onclick="choosePickChar(${c.id})">
      <div class="tr-pick-card-scene tr-scene-v${sc.variant}">
        <div class="tr-scene-sky"></div>
        <div class="tr-scene-glow" style="left:50%;top:20%;"></div>
        <div class="tr-scene-grain"></div>
        <div class="tr-scene-shimmer"></div>
      </div>
      <div class="tr-pick-card-veil"></div>
      <div class="tr-pick-card-avatar">
        ${c.avatar ? `<img src="${c.avatar}" alt=""/>` : `<span>${escHtml(_charInitial(c))}</span>`}
      </div>
      <div class="tr-pick-card-info">
        <div class="tr-pick-card-name">${escHtml(c.name || '未命名')}</div>
        <div class="tr-pick-card-role">${escHtml(c.role || genderTag + ' · 旅伴')}</div>
      </div>
      <div class="tr-pick-card-arrow">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none"><path d="M9 6l6 6-6 6" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
    </div>`;
  }).join('');
}

/* 点选某个角色卡片 → 播放同步动画（人设/世界书/记忆逐项完成）→
   就地写入 CHAR 与 localStorage → 进入目的地首页。
   全程不发生页面跳转。 */
let _syncing = false;
async function choosePickChar(id) {
  if (_syncing) return;
  const rec = ALL_CHARS.find(c => c.id === id);
  if (!rec) return;
  _syncing = true;

  showScreen('scrSyncChar');
  const avatarEl = document.getElementById('syncAvatar');
  avatarEl.innerHTML = rec.avatar ? `<img src="${rec.avatar}" alt=""/>` : `<span>${escHtml(_charInitial(rec))}</span>`;
  document.getElementById('syncName').textContent = rec.name || 'TA';
  document.getElementById('syncText').textContent = '正在准备这趟旅程…';
  ['syncRowPersona', 'syncRowWorld', 'syncRowMemory'].forEach(id2 => document.getElementById(id2).classList.remove('done'));

  const stepMap = { persona: 'syncRowPersona', world: 'syncRowWorld', memory: 'syncRowMemory' };
  const markDone = async (key) => {
    document.getElementById(stepMap[key]).classList.add('done');
    await new Promise(r => setTimeout(r, 260));
  };

  await applyCharInPlace(rec, markDone);
  document.getElementById('syncText').textContent = `准备好了，出发吧`;
  await new Promise(r => setTimeout(r, 420));

  _syncing = false;
  await enterHomeForChar();

  // 若已有该角色未完成的筹备中行程，直接续上；否则从目的地选择开始
  const trips = await getTripsByChar(CHAR.id);
  const ongoing = trips.find(t => t.status === 'ongoing');
  if (ongoing) {
    TRIP = ongoing;
    renderJourneyHome();
    showScreen('scrJourney');
    return;
  }
  await renderDestCards();
  showScreen('scrHome');
  const pendingDest = localStorage.getItem('luna_travel_pending_dest');
  if (pendingDest) {
    localStorage.removeItem('luna_travel_pending_dest');
    TRIP = newEmptyTrip();
    TRIP.destination = pendingDest;
    TRIP.destinationEn = '';
    await enterPlanStep();
  }
}

/* 切换旅伴：从首页或旅程中随时可以回到选择旅伴页重新挑选 */
function switchCompanion() {
  if (TRIP && TRIP.status === 'ongoing') {
    showToast('当前旅程进行中，先完成或结束这趟旅行再切换旅伴吧');
    return;
  }
  enterCharPicker();
}

/* 应用当前 CHAR 到首页各处文案与头像占位，
   从 initTravelApp() 与 choosePickChar() 两处共用，避免重复代码 */
async function enterHomeForChar() {
  document.getElementById('homeCharName').textContent = CHAR.name || pronoun();
  document.getElementById('suggestSectionTitle').textContent = `${pronoun()}的提议`;
  document.getElementById('suggestBtn').textContent = `让${pronoun()}提议一个目的地`;
  document.getElementById('suggestText').textContent = `点击下方按钮，听听${pronoun()}想去哪里…`;
  document.getElementById('packingSub').textContent = `勾选你要带的物品，${pronoun()}可能会提醒你别落下什么。`;
  document.getElementById('dayDetailLoadingText').textContent = `${pronoun()}正在感受今天…`;
  document.getElementById('historyKicker').innerHTML = `<span class="tr-kicker-dot"></span>与${pronoun()}走过的路`;
  const av = document.getElementById('suggestAvatar');
  if (CHAR.avatar) av.innerHTML = `<img src="${CHAR.avatar}"/>`; else av.textContent = (CHAR.name || '?')[0];
  const av2 = document.getElementById('reactionModalAvatar');
  if (CHAR.avatar) av2.innerHTML = `<img src="${CHAR.avatar}"/>`; else av2.textContent = (CHAR.name || '?')[0];
  const av3 = document.getElementById('payReactionAvatar');
  if (CHAR.avatar) av3.innerHTML = `<img src="${CHAR.avatar}"/>`; else av3.textContent = (CHAR.name || '?')[0];
}

/* ================================
   0. 目的地选择 · 精选推荐
   由 AI 结合角色人设实时生成推荐目的地，
   而不是一直显示同一批固定城市；
   未配置API或生成失败时才退回静态兜底池。
================================ */
let _destLoading = false;
async function renderDestCards(forceFallback) {
  if (_destLoading) return;
  _destLoading = true;
  const wrap = document.getElementById('destScroll');
  const regenBtn = document.getElementById('destRegenBtn');
  if (regenBtn) regenBtn.disabled = true;

  // 加载骨架卡：生成推荐本身也需要等待，不能让用户对着空白区
  wrap.innerHTML = Array.from({length: 4}).map(() => `
    <div class="tr-dest-card tr-dest-skeleton">
      <div class="tr-dest-skel-shimmer"></div>
    </div>
  `).join('');

  let list = null;
  let apiFailed = false;
  if (!forceFallback && hasApiConfig()) {
    try {
      const sys = travelSystemPrompt(`请你结合自己的人设、性格、喜好与背景故事，为用户推荐6个你会真心想一起去的旅行目的地。
【地点要求 —— 必须是真实存在的地方，混合式搭配】
- 全部使用真实世界中确实存在的城市/地区/自然景观（如"京都""冰岛""摩洛哥的马拉喀什""云南香格里拉"这类真实地名），禁止编造不存在的地名。
- 6个地点要有明显差异化的混合搭配：不要全是热门大城市，至少包含1-2个相对小众但真实、和你人设气质更贴合的地方（小镇/自然景观/海岛/古城均可），也可以包含1-2个经典热门地标城市，形成"熟悉+惊喜"的混合感。
- 地点选择要能体现出你是"这个角色"而不是通用旅行社推荐——结合你的性格、喜欢的氛围、可能的过往经历来选，而不是随便列举网红城市。
请以严格JSON数组格式输出，每个元素包含：name(地点中文名，8字以内)、en(地点英文/罗马字大写，用于机票风格标签，如"KYOTO, JAPAN")、reason(你想去那里的理由，第一人称，20字以内，要体现真实的个人情感而非导游解说)。只输出JSON数组本身，不要任何多余文字。`);
      const raw = await callAI(sys, '给我推荐几个你想去的地方吧。', true, 600);
      const parsed = safeParseJSON(raw, null);
      if (Array.isArray(parsed) && parsed.length) {
        list = parsed.slice(0, 6).map(d => ({
          name: d.name || '未命名目的地',
          en: d.en || '',
          reason: d.reason || ''
        }));
      }
    } catch (e) { apiFailed = true; }
  } else if (!forceFallback) {
    apiFailed = true;
  }
  if (!list) {
    list = DESTINATIONS_FALLBACK.slice(0, 6).map(d => ({ ...d, reason: '' }));
  }

  wrap.innerHTML = list.map((d, i) => {
    const sc = destSceneFor(d.name, d.en);
    return `
    <div class="tr-dest-card tr-scene-v${sc.variant}" data-name="${escHtml(d.name)}"
      style="animation:destCardIn .6s cubic-bezier(.22,1,.36,1) both ${i*0.08}s;
             --hue-a:${sc.hueA}; --hue-b:${sc.hueB}; --tilt:${sc.tilt}deg; --rise:${sc.rise}%; --dot-x:${sc.dotX}%; --dot-y:${sc.dotY}%;"
      onclick="selectDestCard(this,'${escHtml(d.name)}','${escHtml(d.en)}')">
      <div class="tr-dest-scene">
        <div class="tr-scene-sky"></div>
        <div class="tr-scene-glow"></div>
        <div class="tr-scene-layer tr-scene-far"></div>
        <div class="tr-scene-layer tr-scene-near"></div>
        <div class="tr-scene-grain"></div>
        <div class="tr-scene-shimmer"></div>
      </div>
      <div class="tr-dest-card-veil"></div>
      <div class="tr-dest-card-tag"><span class="tr-tag-dot"></span>DESTINATION</div>
      <div class="tr-dest-card-check">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M5 12l5 5L19 8" stroke="#17171a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div class="tr-dest-card-info">
        <div class="tr-dest-card-name">${escHtml(d.name)}</div>
        <div class="tr-dest-card-en">${escHtml(d.en || '')}</div>
        ${d.reason ? `<div class="tr-dest-card-reason">"${escHtml(d.reason)}"</div>` : ''}
      </div>
    </div>
  `; }).join('');

  if (apiFailed && hasApiConfig()) showToast('AI推荐生成失败，已显示基础推荐');
  _destLoading = false;
  if (regenBtn) regenBtn.disabled = false;
}
function regenDestCards() { renderDestCards(false); }

async function selectDestCard(el, name, en) {
  document.querySelectorAll('.tr-dest-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  TRIP = newEmptyTrip();
  TRIP.destination = name;
  TRIP.destinationEn = en;
  await new Promise(r => setTimeout(r, 260));
  enterOriginStep();
}

async function confirmFreeDest() {
  const input = document.getElementById('freeDestInput');
  const val = input.value.trim();
  if (!val) { showToast('请输入想去的地方'); return; }
  TRIP = newEmptyTrip();
  TRIP.destination = val;
  TRIP.destinationEn = '';
  enterOriginStep();
}

let _suggestLoading = false;
async function askCharSuggest() {
  if (_suggestLoading) return;
  const textEl = document.getElementById('suggestText');
  const btn = document.getElementById('suggestBtn');
  if (!hasApiConfig()) {
    textEl.innerHTML = `还没有配置 API，无法听到${escHtml(CHAR.name)}的真实想法——请先在设置中配置接口。`;
    return;
  }
  _suggestLoading = true;
  btn.disabled = true;
  textEl.innerHTML = `<span class="typing-cursor"></span>`;
  try {
    const sys = travelSystemPrompt('用户想让你主动提议一个旅行目的地。请用你自己的语气，给出一个具体的目的地名称，并说明为什么想带用户去那里，语气要自然、带一点期待感，控制在3句话以内。');
    const raw = await callAI(sys, '你想带我去哪里旅行？给我一个目的地建议吧。', false, 220);
    textEl.textContent = raw;
    // 尝试从回复中提取地名（简单启发：用括号标注供后续使用，若失败则整体作为目的地描述）
    TRIP = newEmptyTrip();
    TRIP.destination = raw.length > 14 ? raw.slice(0, 14) : raw;
    TRIP._suggestFullText = raw;
    btn.textContent = '就去这里';
    btn.onclick = () => {
      TRIP = TRIP || newEmptyTrip();
      enterOriginStep();
    };
    document.getElementById('suggestRegenBtn').style.display = '';
  } catch (e) {
    textEl.textContent = e.message === 'NO_API_CONFIG' ? `还没有配置 API，暂时听不到${pronoun()}的想法。` : `${pronoun()}好像在犹豫，稍后再问问${pronoun()}吧。`;
  } finally {
    _suggestLoading = false;
    btn.disabled = false;
  }
}
/* 重新让角色换一个提议，避免只能接受第一次生成的结果 */
async function regenSuggest() { await askCharSuggest(); }

/* 角色主动发起（聊天页调用）：写入 localStorage 后跳转本页
   聊天页只需：localStorage.setItem('luna_travel_pending_dest', '目的地'); location.href='travel.html'; */

/* ================================
   1. 行程方案选择
================================ */
async function enterPlanStep() {
  document.getElementById('planDestName').textContent = TRIP.destination || '这里';
  showScreen('scrPlan');
  TRIP.planIndex = null;
  TRIP.customDays = null;
  document.getElementById('planNextBtn').disabled = true;
  document.getElementById('planCustomWrap').style.display = 'none';
  document.getElementById('customDaysInput').value = '';
  document.getElementById('customStyleInput').value = '';
  const reactionEl = document.getElementById('customPlanReaction');
  reactionEl.style.display = 'none';
  reactionEl.textContent = '';
  await generatePlanOptions();
}

let _planLoading = false;
async function generatePlanOptions() {
  if (_planLoading) return;
  _planLoading = true;
  const list = document.getElementById('planList');
  list.innerHTML = `<div class="tr-loading"><div class="tr-loading-ring"></div><div class="tr-loading-text">正在生成行程方案…</div></div>`;
  const regenBtn = document.getElementById('planRegenBtn');
  if (regenBtn) regenBtn.disabled = true;

  let plans = null;
  let apiFailed = false;
  if (hasApiConfig()) {
    try {
      const sys = travelSystemPrompt(`用户和你正在为去「${TRIP.destination}」的旅行选择行程方案。请你以严格的JSON格式输出4个不同天数/风格的行程方案数组（天数要有明显差异，覆盖从短途到深度的区间，风格也要各不相同，结合「${TRIP.destination}」本身的特点来设计，不要千篇一律），每个元素包含字段：days(数字,天数)、style(风格简称,4字以内)、desc(20字以内方案概述，要体现目的地特色)、reaction(你对这个方案的真实态度和期待，35字以内，第一人称、符合你的性格)。只输出JSON数组本身，不要任何多余文字。`);
      const raw = await callAI(sys, `给我几个去${TRIP.destination}的行程方案吧。`, true, 800);
      const parsed = safeParseJSON(raw, null);
      if (Array.isArray(parsed) && parsed.length) plans = parsed;
    } catch (e) { apiFailed = true; }
  } else {
    apiFailed = true;
  }
  if (!plans) {
    plans = [
      { days: 2, style: '闪电周末', desc: '说走就走，只带一个背包', reaction: '短一点也好，重要的是在一起的时间。' },
      { days: 3, style: '短途轻旅', desc: '浅尝这座城市的气息', reaction: '刚刚好，不会太赶。' },
      { days: 5, style: '悠闲慢旅', desc: '不赶行程，慢慢逛慢慢待', reaction: '我更想这样，什么都不急。' },
      { days: 7, style: '深度探索', desc: '把这里的角落都走一遍', reaction: '一周的话，能一起做好多事呢。' }
    ];
  }
  TRIP.planOptions = plans;
  renderPlanList(plans, apiFailed);
  _planLoading = false;
  if (regenBtn) regenBtn.disabled = false;
}

function renderPlanList(plans, apiFailed) {
  const list = document.getElementById('planList');
  list.innerHTML = plans.map((p, i) => `
    <div class="tr-option" data-i="${i}" onclick="selectPlan(${i})">
      <div class="tr-option-num">${String(i + 1).padStart(2, '0')}</div>
      <div class="tr-option-icon">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M4 19h16M6 19V9l6-5 6 5v10" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
      </div>
      <div class="tr-option-body">
        <div class="tr-option-title">${escHtml(p.style || '')} · ${p.days}天</div>
        <div class="tr-option-desc">${escHtml(p.desc || '')}</div>
        <div class="tr-option-reaction">"${escHtml(p.reaction || '')}"</div>
      </div>
      <div class="tr-option-radio"></div>
    </div>
  `).join('');
  if (apiFailed) showToast(hasApiConfig() ? 'AI方案生成失败，先看几个基础方案' : '未配置 API，当前为基础方案');
}

function selectPlan(i) {
  document.querySelectorAll('#planList .tr-option').forEach(o => o.classList.remove('selected'));
  document.querySelector(`#planList .tr-option[data-i="${i}"]`).classList.add('selected');
  TRIP.planIndex = i;
  TRIP.customDays = null;
  TRIP.days = TRIP.planOptions[i].days;
  TRIP.style = TRIP.planOptions[i].style;
  document.getElementById('planCustomWrap').style.display = 'none';
  document.getElementById('planNextBtn').disabled = false;
}

/* 自定义天数：用户不想用给出的任何方案，自己定天数与风格，
   角色仍会对用户的自定义方案给出真实反应，而不是被晾在一边 */
function openCustomPlan() {
  document.querySelectorAll('#planList .tr-option').forEach(o => o.classList.remove('selected'));
  TRIP.planIndex = null;
  document.getElementById('planCustomWrap').style.display = '';
  document.getElementById('customDaysInput').focus();
}
let _customPlanLoading = false;
async function confirmCustomPlan() {
  const daysVal = parseInt(document.getElementById('customDaysInput').value);
  const styleVal = document.getElementById('customStyleInput').value.trim();
  if (!daysVal || daysVal < 1 || daysVal > 60) { showToast('请输入 1-60 之间的天数'); return; }
  if (_customPlanLoading) return;
  _customPlanLoading = true;
  const reactionEl = document.getElementById('customPlanReaction');
  reactionEl.innerHTML = `<span class="typing-cursor"></span>`;
  reactionEl.style.display = '';
  TRIP.customDays = daysVal;
  TRIP.days = daysVal;
  TRIP.style = styleVal || '自定行程';
  if (hasApiConfig()) {
    try {
      const sys = travelSystemPrompt(`用户没有选你给出的任何方案，而是自己决定了去「${TRIP.destination}」旅行${daysVal}天${styleVal ? `，风格是「${styleVal}」` : ''}。请给出你对用户这个决定的真实反应，第一人称，30字以内，可以是惊喜、赞同、或带点调侃，但要符合你的性格。`);
      const raw = await callAI(sys, `我们就这么定了，${daysVal}天。`, false, 100);
      reactionEl.textContent = raw;
    } catch (e) { reactionEl.textContent = '好，就听你的。'; }
  } else {
    reactionEl.textContent = '好，就听你的。';
  }
  document.getElementById('planNextBtn').disabled = false;
  _customPlanLoading = false;
}

function goStep(id) {
  saveTrip(TRIP);
  if (id === 'scrTransport') renderTransportStep();
  else if (id === 'scrDate') renderDateStep();
  else if (id === 'scrWaypoints') renderWaypointsStep();
  else if (id === 'scrFlight') renderFlightStep();
  else if (id === 'scrSeat') renderSeatStep();
  else if (id === 'scrPay') renderPayStep();
  showScreen(id);
}

/* ================================
   0. 出发地选择
================================ */
const ORIGIN_CITIES = [
  { name: '上海', en: 'SHANGHAI' },
  { name: '北京', en: 'BEIJING' },
  { name: '广州', en: 'GUANGZHOU' },
  { name: '深圳', en: 'SHENZHEN' },
  { name: '成都', en: 'CHENGDU' },
  { name: '杭州', en: 'HANGZHOU' },
];
function enterOriginStep() {
  showScreen('scrOrigin');
  const list = document.getElementById('originCityList');
  list.innerHTML = ORIGIN_CITIES.map((c, i) => `
    <div class="tr-option" data-i="${i}" onclick="selectOriginCity(${i})">
      <div class="tr-option-num">${String(i + 1).padStart(2, '0')}</div>
      <div class="tr-option-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none"><circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M12 21c4-4.5 7-8.2 7-11.5A7 7 0 105 9.5C5 12.8 8 16.5 12 21z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></div>
      <div class="tr-option-body">
        <div class="tr-option-title">${c.name}</div>
        <div class="tr-option-meta">${c.en}</div>
      </div>
      <div class="tr-option-radio"></div>
    </div>
  `).join('');
  document.getElementById('originFreeInput').value = '';
}
function selectOriginCity(i) {
  const c = ORIGIN_CITIES[i];
  TRIP.origin = c.name;
  TRIP.originEn = c.en;
  enterPlanStep();
}
function confirmOriginFree() {
  const input = document.getElementById('originFreeInput');
  const val = input.value.trim();
  if (!val) { showToast('请输入出发城市'); return; }
  TRIP.origin = val;
  TRIP.originEn = '';
  enterPlanStep();
}

/* ================================
   2. 交通方式选择
================================ */
const TRANSPORT_BASE = [
  { key: 'flight', title: '飞机', desc: '跨越距离，最快抵达', meta: '约需 2-5 小时', icon: 'M3 12l18-7-7 18-2-8-9-3z' },
  { key: 'train', title: '高铁', desc: '沿途风景不断后退', meta: '约需 3-8 小时', icon: 'M4 15V6a2 2 0 012-2h12a2 2 0 012 2v9M4 15a2 2 0 002 2h12a2 2 0 002-2M4 15l-2 5M20 15l2 5M8 21h8' },
  { key: 'drive', title: '自驾', desc: '路线自己定，随时停靠', meta: '灵活可控', icon: 'M5 17h14M6 17V9l2-4h8l2 4v8M6 13h12' },
];
function renderTransportStep() {
  TRIP.transportOptions = TRANSPORT_BASE;
  const list = document.getElementById('transportList');
  list.innerHTML = TRANSPORT_BASE.map((t, i) => `
    <div class="tr-option" data-i="${i}" onclick="selectTransport(${i})">
      <div class="tr-option-num">${String(i + 1).padStart(2, '0')}</div>
      <div class="tr-option-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="${t.icon}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div class="tr-option-body">
        <div class="tr-option-title">${t.title}</div>
        <div class="tr-option-desc">${t.desc}</div>
        <div class="tr-option-meta">${t.meta}</div>
      </div>
      <div class="tr-option-radio"></div>
    </div>
  `).join('');
  document.getElementById('transportNextBtn').disabled = TRIP.transport == null;
  if (TRIP.transport != null) {
    const idx = TRANSPORT_BASE.findIndex(t => t.key === TRIP.transport.key);
    if (idx >= 0) document.querySelector(`#transportList .tr-option[data-i="${idx}"]`).classList.add('selected');
  }
}
function selectTransport(i) {
  document.querySelectorAll('#transportList .tr-option').forEach(o => o.classList.remove('selected'));
  document.querySelector(`#transportList .tr-option[data-i="${i}"]`).classList.add('selected');
  TRIP.transport = TRANSPORT_BASE[i];
  document.getElementById('transportNextBtn').disabled = false;
}

/* ================================
   3. 日期选择（日历网格）
================================ */
function renderDateStep() {
  const now = new Date();
  CAL_STATE.year = now.getFullYear();
  CAL_STATE.month = now.getMonth();
  renderCalendar();
  updateDateSummary();
}
function calShift(delta) {
  CAL_STATE.month += delta;
  if (CAL_STATE.month < 0) { CAL_STATE.month = 11; CAL_STATE.year--; }
  if (CAL_STATE.month > 11) { CAL_STATE.month = 0; CAL_STATE.year++; }
  renderCalendar();
}
function renderCalendar() {
  const y = CAL_STATE.year, m = CAL_STATE.month;
  document.getElementById('calMonthLabel').textContent = `${y} · ${String(m + 1).padStart(2, '0')}`;
  const dowRow = document.getElementById('calDowRow');
  dowRow.innerHTML = ['日','一','二','三','四','五','六'].map(d => `<div class="tr-cal-dow">${d}</div>`).join('');

  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);

  let html = '';
  for (let i = 0; i < firstDay; i++) html += `<div class="tr-cal-day empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(y, m, d);
    const disabled = dateObj < today;
    const iso = dateObj.toISOString().slice(0, 10);
    let cls = 'tr-cal-day';
    if (disabled) cls += ' disabled';
    if (TRIP.dateStart === iso) cls += ' selected';
    html += `<div class="${cls}" data-date="${iso}" onclick="pickDate('${iso}')">${d}</div>`;
  }
  document.getElementById('calGrid').innerHTML = html;
}
function pickDate(iso) {
  TRIP.dateStart = iso;
  const start = new Date(iso);
  const end = new Date(start);
  end.setDate(start.getDate() + (TRIP.days || 1) - 1);
  TRIP.dateEnd = end.toISOString().slice(0, 10);
  renderCalendar();
  updateDateSummary();
  document.getElementById('dateNextBtn').disabled = false;
}
function updateDateSummary() {
  const el = document.getElementById('dateSummaryText');
  if (!TRIP.dateStart) { el.textContent = '未选择'; return; }
  const fmt = s => { const d = new Date(s); return `${d.getMonth()+1}月${d.getDate()}日`; };
  el.textContent = TRIP.dateEnd && TRIP.dateEnd !== TRIP.dateStart
    ? `${fmt(TRIP.dateStart)} — ${fmt(TRIP.dateEnd)}（${TRIP.days}天）`
    : `${fmt(TRIP.dateStart)} 出发`;
}

/* ================================
   5. 途经点与路线地图
================================ */
function renderWaypointsStep() {
  renderWaypointList();
  renderRouteMap();
  document.getElementById('waypointInput').value = '';
}
function renderWaypointList() {
  const wps = TRIP.waypoints || [];
  const list = document.getElementById('waypointList');
  const empty = document.getElementById('waypointEmpty');
  empty.style.display = wps.length ? 'none' : '';
  list.innerHTML = wps.map((w, i) => `
    <div class="tr-waypoint-item">
      <div class="tr-waypoint-dot"></div>
      <div class="tr-waypoint-name">${escHtml(w.name)}</div>
      <div class="tr-waypoint-remove" onclick="removeWaypoint(${i})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      </div>
    </div>
  `).join('');
}
function addWaypoint() {
  const input = document.getElementById('waypointInput');
  const val = input.value.trim();
  if (!val) { showToast('请输入想顺路去的城市'); return; }
  TRIP.waypoints = TRIP.waypoints || [];
  if (TRIP.waypoints.length >= 3) { showToast('最多可以安排 3 个途经点'); return; }
  TRIP.waypoints.push({ name: val, en: '' });
  input.value = '';
  renderWaypointList();
  renderRouteMap();
}
function removeWaypoint(i) {
  TRIP.waypoints.splice(i, 1);
  renderWaypointList();
  renderRouteMap();
}
/* 纯 SVG 生成一条简单路线示意图：起点 → 途经点(按序) → 终点，
   不依赖任何外部地图服务，与整体离线优先、无外链图床的设计保持一致 */
function renderRouteMap() {
  const svg = document.getElementById('routeMapSvg');
  const stops = [
    { label: TRIP.origin || '出发地' },
    ...(TRIP.waypoints || []).map(w => ({ label: w.name })),
    { label: TRIP.destination || '目的地' }
  ];
  const w = 320, h = 150, padX = 30;
  const n = stops.length;
  const gap = n > 1 ? (w - padX * 2) / (n - 1) : 0;
  const baseY = 78;
  const amp = 22;

  let pathD = '';
  const pts = stops.map((s, i) => {
    const x = padX + gap * i;
    const y = baseY + (i % 2 === 0 ? 0 : (i % 4 === 1 ? -amp : amp));
    return { x, y, label: s.label };
  });
  pts.forEach((p, i) => {
    pathD += i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`;
  });

  let html = `<path d="${pathD}" fill="none" stroke="var(--grey-3)" stroke-width="1.6" stroke-dasharray="1 7" stroke-linecap="round"/>`;
  pts.forEach((p, i) => {
    const isEnd = i === 0 || i === pts.length - 1;
    const r = isEnd ? 5 : 4;
    html += `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${isEnd ? 'var(--ink)' : 'var(--surface)'}" stroke="var(--ink)" stroke-width="1.4"/>`;
    const labelY = p.y > baseY ? p.y + 18 : p.y - 12;
    const anchor = i === 0 ? 'start' : (i === pts.length - 1 ? 'end' : 'middle');
    const anchorX = i === 0 ? p.x - 2 : (i === pts.length - 1 ? p.x + 2 : p.x);
    html += `<text x="${anchorX}" y="${labelY}" font-family="var(--font-mono)" font-size="9.5" fill="var(--ink-soft)" text-anchor="${anchor}">${escHtml(p.label)}</text>`;
  });
  svg.innerHTML = html;
}

/* ================================
   6. 航班/车次选择
   —— 在已选交通方式与舱位大类之外，进一步生成多个具体的
      「航班号/车次 + 时间 + 承运商 + 独立价格」选项，
      用户从中挑选一趟真实的班次，其价格将替代原先舱位的基准价。
================================ */
const FLIGHT_CARRIERS = ['月光航空 MZ', '心动航空 XA', '星尘航空 XD'];
const TRAIN_CARRIERS = ['和风高铁 G', '沉海高铁 D', '星轨高铁 C'];
function _trHashSeed(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return Math.abs(h); }
function _trPad(n) { return String(n).padStart(2, '0'); }

function generateFlightOptions() {
  const key = TRIP.transport ? TRIP.transport.key : 'flight';
  const seed = _trHashSeed((TRIP.origin || '') + (TRIP.destination || '') + (TRIP.dateStart || '') + key);
  const isFlight = key === 'flight';
  const isTrain = key === 'train';
  if (!isFlight && !isTrain) { TRIP.flightOptions = []; TRIP.flight = null; return; }

  const carriers = isFlight ? FLIGHT_CARRIERS : TRAIN_CARRIERS;
  const baseSeatPrice = TRIP.seatOptions && TRIP.seatOptions[0]
    ? parseInt((TRIP.seatOptions[0].meta || '0').replace(/[^\d]/g, '')) || (isFlight ? 1280 : 420)
    : (isFlight ? 1280 : 420);

  const count = 4;
  const options = [];
  for (let i = 0; i < count; i++) {
    const s = seed + i * 97;
    const depH = 6 + (s % 15);          // 06:00 - 20:59
    const depM = (s * 7) % 60;
    const durH = isFlight ? 2 + (s % 4) : 3 + (s % 6);
    const durM = (s * 11) % 60;
    let arrTotalMin = depH * 60 + depM + durH * 60 + durM;
    const arrH = Math.floor(arrTotalMin / 60) % 24;
    const arrM = arrTotalMin % 60;
    const nextDay = arrTotalMin >= 24 * 60;
    const carrier = carriers[(s >> 3) % carriers.length];
    const codeNum = 1000 + (s % 8000);
    const flightNo = isFlight ? `${carrier.split(' ')[1]}${codeNum}` : `${carrier.split(' ')[1]}${Math.floor(codeNum / 10)}`;
    // 价格在舱位基准价上做班次浮动：红眼/清晨更便宜，热门时段更贵
    const priceMultiplier = 0.85 + ((s % 40) / 100);
    const price = Math.round(baseSeatPrice * priceMultiplier / 10) * 10;
    const tag = i === 0 ? '性价比' : (priceMultiplier > 1.1 ? '直达优选' : (depH < 9 ? '早班' : null));
    options.push({
      id: `${flightNo}`,
      carrier,
      flightNo,
      depTime: `${_trPad(depH)}:${_trPad(depM)}`,
      arrTime: `${_trPad(arrH)}:${_trPad(arrM)}${nextDay ? '+1' : ''}`,
      durText: `${durH}小时${durM ? durM + '分' : ''}`,
      price,
      tag
    });
  }
  options.sort((a, b) => a.depTime.localeCompare(b.depTime));
  TRIP.flightOptions = options;
  TRIP.flight = null;
}

function renderFlightStep() {
  const key = TRIP.transport ? TRIP.transport.key : 'flight';
  const isFlight = key === 'flight';
  const isTrain = key === 'train';
  const label = isFlight ? '航班' : (isTrain ? '车次' : '行程');
  document.getElementById('flightStepLabel').textContent = label;
  document.getElementById('flightStepEm').textContent = label;
  document.getElementById('flightRouteSub').textContent = `${TRIP.origin || '出发地'} → ${TRIP.destination || '目的地'}`;

  const list = document.getElementById('flightList');
  const nextBtn = document.getElementById('flightNextBtn');

  if (!isFlight && !isTrain) {
    // 自驾：无需选择具体班次，直接放行
    list.innerHTML = `<div class="tr-waypoint-empty" style="padding:30px 0;">自驾出行不需要选择具体班次，直接进入下一步即可</div>`;
    nextBtn.disabled = false;
    return;
  }

  if (!TRIP.flightOptions || !TRIP.flightOptions.length) generateFlightOptions();

  list.innerHTML = TRIP.flightOptions.map((f, i) => `
    <div class="tr-option" data-i="${i}" onclick="selectFlight(${i})">
      <div class="tr-option-body" style="width:100%;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
          <div>
            <div class="tr-option-title">${escHtml(f.flightNo)}</div>
            <div class="tr-flight-carrier">${escHtml(f.carrier)}${f.tag ? `<span class="tr-flight-tag">${f.tag}</span>` : ''}</div>
          </div>
          <div class="tr-flight-price">¥${f.price.toLocaleString()}</div>
        </div>
        <div class="tr-flight-times">
          <span>${f.depTime}</span>
          <span class="line"></span>
          <span class="dur">${f.durText}</span>
          <span class="line"></span>
          <span>${f.arrTime}</span>
        </div>
      </div>
      <div class="tr-option-radio"></div>
    </div>
  `).join('');
  nextBtn.disabled = TRIP.flight == null;
  if (TRIP.flight) {
    const idx = TRIP.flightOptions.findIndex(f => f.id === TRIP.flight.id);
    if (idx >= 0) document.querySelector(`#flightList .tr-option[data-i="${idx}"]`).classList.add('selected');
  }
}
function selectFlight(i) {
  document.querySelectorAll('#flightList .tr-option').forEach(o => o.classList.remove('selected'));
  const el = document.querySelector(`#flightList .tr-option[data-i="${i}"]`);
  if (el) el.classList.add('selected');
  TRIP.flight = TRIP.flightOptions[i];
  document.getElementById('flightNextBtn').disabled = false;
}

/* ================================
   4. 舱位/座位选择
================================ */
function seatOptionsFor(transportKey) {
  if (transportKey === 'flight') return [
    { key: 'economy', title: '经济舱', desc: '简单实用，把预算留给旅程本身', meta: '¥1280 / 人' },
    { key: 'business', title: '商务舱', desc: `更宽敞安静，途中也想让${pronoun()}舒服一点`, meta: '¥4680 / 人' },
  ];
  if (transportKey === 'train') return [
    { key: 'second', title: '二等座', desc: '沿途也能安心聊天', meta: '¥420 / 人' },
    { key: 'first', title: '一等座', desc: '更宽的座椅，更安静的车厢', meta: '¥680 / 人' },
  ];
  return [
    { key: 'compact', title: '紧凑车型', desc: '灵活小巧，适合city探索', meta: '¥380 / 天' },
    { key: 'suv', title: 'SUV', desc: '空间更大，装得下所有行李和心情', meta: '¥620 / 天' },
  ];
}
function renderSeatStep() {
  const transportKey = TRIP.transport ? TRIP.transport.key : 'flight';
  const opts = seatOptionsFor(transportKey);
  TRIP.seatOptions = opts;
  const list = document.getElementById('seatList');
  list.innerHTML = opts.map((s, i) => `
    <div class="tr-option" data-i="${i}" onclick="selectSeat(${i})">
      <div class="tr-option-num">${String(i + 1).padStart(2, '0')}</div>
      <div class="tr-option-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none"><rect x="6" y="4" width="12" height="14" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M9 18v2M15 18v2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></div>
      <div class="tr-option-body">
        <div class="tr-option-title">${s.title}</div>
        <div class="tr-option-desc">${s.desc}</div>
        <div class="tr-option-meta">${s.meta}</div>
      </div>
      <div class="tr-option-radio"></div>
    </div>
  `).join('');
  if (TRIP.seat) {
    const idx = opts.findIndex(o => o.key === TRIP.seat.key);
    if (idx >= 0) document.querySelector(`#seatList .tr-option[data-i="${idx}"]`).classList.add('selected');
  }

  const isFlightOrTrain = transportKey === 'flight' || transportKey === 'train';
  document.getElementById('windowToggleBox').style.display = isFlightOrTrain ? '' : 'none';
  document.getElementById('windowToggleText').textContent = `把靠窗的座位留给${pronoun()}`;
  document.getElementById('windowSwitch').classList.toggle('on', TRIP.windowSeat !== false);

  document.getElementById('seatMapSection').style.display = isFlightOrTrain ? '' : 'none';
  if (isFlightOrTrain && TRIP.seat) {
    renderSeatMap();
  } else if (isFlightOrTrain) {
    document.getElementById('seatMapWrap').innerHTML = `<div class="tr-waypoint-empty">先选择上方的舱位，即可查看座位图</div>`;
  }
  _trUpdateSeatNextBtn();
}
function selectSeat(i) {
  document.querySelectorAll('#seatList .tr-option').forEach(o => o.classList.remove('selected'));
  document.querySelector(`#seatList .tr-option[data-i="${i}"]`).classList.add('selected');
  const changed = !TRIP.seat || TRIP.seat.key !== TRIP.seatOptions[i].key;
  TRIP.seat = TRIP.seatOptions[i];
  if (changed) { TRIP.seatNumber = null; TRIP.seatMap = null; }
  const transportKey = TRIP.transport ? TRIP.transport.key : 'flight';
  if (transportKey === 'flight' || transportKey === 'train') {
    renderSeatMap();
  }
  _trUpdateSeatNextBtn();
}
function toggleWindow() {
  TRIP.windowSeat = !(TRIP.windowSeat !== false);
  document.getElementById('windowSwitch').classList.toggle('on', TRIP.windowSeat);
}
function _trUpdateSeatNextBtn() {
  const transportKey = TRIP.transport ? TRIP.transport.key : 'flight';
  const needsSeatNumber = transportKey === 'flight' || transportKey === 'train';
  const ok = TRIP.seat != null && (!needsSeatNumber || TRIP.seatNumber != null);
  document.getElementById('seatNextBtn').disabled = !ok;
}

/* ---------- 可视化座位图 ----------
   经济舱/二等座：3-3 布局；商务舱/一等座：2-2 布局，行数更少、间距更宽。
   已占用的座位按行程种子固定生成（同一趟行程刷新页面座位分布不变），
   用户点击空位即可选定具体座位号，会在钱包扣款与出票信息中一并体现。 */
function renderSeatMap() {
  const premium = TRIP.seat.key === 'business' || TRIP.seat.key === 'first';
  const cols = premium ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C', 'D', 'E', 'F'];
  const half = cols.length / 2;
  const rows = premium ? 5 : 7;
  const seed = _trHashSeed((TRIP.destination || '') + (TRIP.flight ? TRIP.flight.id : '') + TRIP.seat.key);

  if (!TRIP.seatMap || TRIP.seatMap.cols !== cols.length || TRIP.seatMap.rows !== rows) {
    const taken = new Set();
    let s = seed;
    const takenCount = Math.floor(rows * cols.length * 0.35);
    for (let i = 0; i < takenCount; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const r = 1 + (s % rows);
      const c = cols[s % cols.length];
      taken.add(`${r}${c}`);
    }
    TRIP.seatMap = { cols: cols.length, rows, taken: Array.from(taken) };
    TRIP.seatNumber = null;
  }

  const takenSet = new Set(TRIP.seatMap.taken);
  const wrap = document.getElementById('seatMapWrap');
  let html = `<div class="tr-seatmap-nose"></div>`;
  for (let r = 1; r <= rows; r++) {
    html += `<div class="tr-seatmap-row"><div class="tr-seatmap-rownum">${r}</div>`;
    cols.forEach((c, ci) => {
      const seatId = `${r}${c}`;
      const isTaken = takenSet.has(seatId);
      const isMine = TRIP.seatNumber === seatId;
      let cls = 'tr-seat-cell';
      if (isTaken) cls += ' taken';
      if (isMine) cls += ' mine';
      html += `<div class="${cls}" onclick="${isTaken ? '' : `pickSeatNumber('${seatId}')`}">${c}</div>`;
      if (ci === half - 1) html += `<div class="tr-seatmap-aisle"></div>`;
    });
    html += `</div>`;
  }
  wrap.innerHTML = html;
}
function pickSeatNumber(seatId) {
  TRIP.seatNumber = seatId;
  renderSeatMap();
  _trUpdateSeatNextBtn();
}

/* ================================
   5. 确认支付
================================ */
function computePrice() {
  const isFlightOrTrain = TRIP.transport && (TRIP.transport.key === 'flight' || TRIP.transport.key === 'train');
  let unitPrice;
  if (isFlightOrTrain && TRIP.flight) {
    unitPrice = TRIP.flight.price;
  } else {
    const seatPrice = parseInt((TRIP.seat && TRIP.seat.meta || '0').replace(/[^\d]/g, '')) || 0;
    unitPrice = seatPrice * (TRIP.transport && TRIP.transport.key === 'drive' ? (TRIP.days || 1) : 1);
  }
  return unitPrice * 2; // 两人份
}
async function renderPayStep() {
  document.getElementById('payOrigin').textContent = TRIP.origin || '—';
  document.getElementById('payDest').textContent = TRIP.destination;
  const wpRow = document.getElementById('payWaypointsRow');
  if (TRIP.waypoints && TRIP.waypoints.length) {
    wpRow.style.display = '';
    document.getElementById('payWaypoints').textContent = TRIP.waypoints.map(w => w.name).join(' · ');
  } else {
    wpRow.style.display = 'none';
  }
  document.getElementById('payDays').textContent = `${TRIP.days} 天`;
  document.getElementById('payTransport').textContent = TRIP.transport ? TRIP.transport.title : '—';
  document.getElementById('payFlight').textContent = TRIP.flight ? `${TRIP.flight.flightNo} · ${TRIP.flight.depTime}起飞` : '—';
  document.getElementById('payDate').textContent = TRIP.dateStart ? `${TRIP.dateStart} 出发` : '—';
  const isFlightOrTrain = TRIP.transport && (TRIP.transport.key === 'flight' || TRIP.transport.key === 'train');
  document.getElementById('paySeat').textContent = (TRIP.seat ? TRIP.seat.title : '—')
    + (TRIP.seatNumber ? ` · ${TRIP.seatNumber}` : '')
    + (TRIP.windowSeat !== false && isFlightOrTrain ? ' · 靠窗' : '');
  TRIP.price = computePrice();
  document.getElementById('payTotal').textContent = `¥ ${TRIP.price.toLocaleString()}`;
  document.getElementById('treatText').textContent = `这一次，由${CHAR.name}来请客`;
  document.getElementById('treatSwitch').classList.toggle('on', !!TRIP.treat);
  await _trUpdatePayMethodRow();

  const reactionText = document.getElementById('payReactionText');
  reactionText.innerHTML = `<span class="typing-cursor"></span>`;
  if (hasApiConfig()) {
    try {
      const sys = travelSystemPrompt(`所有行程信息已确认：目的地${TRIP.destination}，${TRIP.days}天，交通方式${TRIP.transport.title}，${TRIP.seat.title}。请用你的语气说一句对这次出发的真实感受或期待，30字以内，第一人称，不要客套。`);
      const raw = await callAI(sys, '一切都确定了，说点什么吧。', false, 120);
      reactionText.textContent = raw;
    } catch (e) { reactionText.textContent = '一切都准备好了，只等你点下确认。'; showToast('AI回应生成失败，已显示默认文案'); }
  } else {
    reactionText.textContent = '一切都准备好了，只等你点下确认。';
  }
}
function toggleTreat() {
  TRIP.treat = !TRIP.treat;
  document.getElementById('treatSwitch').classList.toggle('on', TRIP.treat);
  _trUpdatePayMethodRow();
}

/* ================================
   5.1 钱包联动 —— 余额读取 / 支付密码校验 / 扣款
   —— 与钱包 App（wallet.js）共用同一套 IndexedDB 结构：
      LunaWalletAccountDB（账户/绑定身份）、LunaWalletHomeDB（余额/流水，按身份隔离）、
      LunaWalletSecurityDB（支付密码，按身份隔离）。
   —— 心动旅行不加载完整的 wallet.js，因此在此按相同的表结构与 key 规则
      各自实现一份最小化的读写方法，确保金额与流水在两个 App 间保持同源、互通。
================================ */
function _trOpenDB(name, store) {
  return new Promise((res, rej) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(store, { keyPath: 'id' });
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}
async function _trLoadWalletAccount() {
  return new Promise(res => {
    const req = indexedDB.open('LunaWalletAccountDB', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('accounts', { keyPath: 'id' });
    req.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('accounts')) { res(null); return; }
      const r = db.transaction('accounts').objectStore('accounts').get('main');
      r.onsuccess = () => res(r.result || null);
      r.onerror   = () => res(null);
    };
    req.onerror = () => res(null);
  });
}
async function _trIdentityKey() {
  try {
    const account = await _trLoadWalletAccount();
    const boundId = account?.boundIdentityId || 'default';
    return 'identity_' + boundId;
  } catch (e) { return 'identity_default'; }
}
async function _trLoadHomeData() {
  const db  = await _trOpenDB('LunaWalletHomeDB', 'home');
  const key = await _trIdentityKey();
  const existing = await new Promise(res => {
    const r = db.transaction('home').objectStore('home').get(key);
    r.onsuccess = () => res(r.result || null);
    r.onerror   = () => res(null);
  });
  if (existing) return existing;
  const initial = { id: key, balance: 0, income: 0, spend: 0, transactions: [] };
  await new Promise((res, rej) => {
    const tx = db.transaction('home', 'readwrite');
    tx.objectStore('home').put(initial);
    tx.oncomplete = () => res(true);
    tx.onerror    = () => rej(false);
  });
  return initial;
}
async function _trSaveHomeData(data) {
  const db  = await _trOpenDB('LunaWalletHomeDB', 'home');
  const key = await _trIdentityKey();
  return new Promise((res, rej) => {
    const tx = db.transaction('home', 'readwrite');
    tx.objectStore('home').put({ id: key, ...data });
    tx.oncomplete = () => res(true);
    tx.onerror    = () => rej(false);
  });
}
async function _trLoadSecurity() {
  const db  = await _trOpenDB('LunaWalletSecurityDB', 'security');
  const key = await _trIdentityKey();
  return new Promise(res => {
    const r = db.transaction('security').objectStore('security').get(key);
    r.onsuccess = () => res(r.result || { enabled: false, pin: null });
    r.onerror   = () => res({ enabled: false, pin: null });
  });
}

/* 支付方式行：TA请客时不涉及扣款；用户自己付款时展示当前余额 */
async function _trUpdatePayMethodRow() {
  const row   = document.getElementById('payMethodRow');
  const title = document.getElementById('payMethodTitle');
  const sub   = document.getElementById('payMethodSub');
  if (!row) return;
  if (TRIP.treat) {
    title.textContent = `由${CHAR.name || 'TA'}请客`;
    sub.textContent = '本次无需从你的钱包扣款';
  } else {
    const home = await _trLoadHomeData();
    const balance = Number(home.balance || 0);
    title.textContent = 'Luna 钱包 · 余额支付';
    sub.textContent = `当前余额 ¥ ${balance.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

/* ---------- 支付密码验证弹层 ---------- */
let _trPvResolve = null;
let _trPvInput = '';
function _trPvUpdateCells() {
  for (let i = 0; i < 4; i++) {
    const cell = document.getElementById('trPvc' + i);
    if (!cell) continue;
    cell.className = 'tr-pin-cell';
    if (i < _trPvInput.length) cell.classList.add('filled');
    else if (i === _trPvInput.length) cell.classList.add('active');
  }
}
function trPvKey(n) {
  if (_trPvInput.length >= 4) return;
  _trPvInput += n;
  _trPvUpdateCells();
  if (_trPvInput.length === 4) _trPvSubmit();
}
function trPvDel() {
  _trPvInput = _trPvInput.slice(0, -1);
  _trPvUpdateCells();
}
async function _trPvSubmit() {
  const saved = await _trLoadSecurity();
  const hint = document.getElementById('payVerifyHint');
  if (_trPvInput === saved.pin) {
    _trPvClose(true);
  } else {
    if (hint) { hint.textContent = '密码错误，请重新输入'; hint.classList.add('err'); }
    _trPvInput = '';
    _trPvUpdateCells();
  }
}
function trPvCancel() { _trPvClose(false); }
function _trPvClose(result) {
  document.getElementById('payVerifyModal').classList.remove('show');
  const resolve = _trPvResolve;
  _trPvResolve = null;
  _trPvInput = '';
  setTimeout(() => { if (resolve) resolve(result); }, 200);
}
/* 若已启用支付密码：弹出输入键盘，验证通过才 resolve(true)；未启用则直接放行。
   取消输入则 resolve(false)。 */
async function _trRequirePayPassword() {
  const saved = await _trLoadSecurity();
  if (!saved.enabled || !saved.pin) return true;
  return new Promise(resolve => {
    _trPvResolve = resolve;
    _trPvInput = '';
    _trPvUpdateCells();
    const hint = document.getElementById('payVerifyHint');
    if (hint) { hint.textContent = '请输入支付密码完成扣款'; hint.classList.remove('err'); }
    document.getElementById('payVerifyModal').classList.add('show');
  });
}

/* ---------- 余额不足弹层 ---------- */
function _trShowInsuffModal(gap) {
  document.getElementById('insuffGap').textContent = `¥ ${gap.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('insuffModal').classList.add('show');
}
function closeInsuffModal() {
  document.getElementById('insuffModal').classList.remove('show');
}
function goToWalletTopup() {
  location.href = 'wallet.html';
}

/* ---------- 处理中覆层 ---------- */
function _trShowProcessing(text) {
  document.getElementById('processingText').textContent = text || '正在确认支付…';
  document.getElementById('processingOverlay').classList.add('show');
}
function _trHideProcessing() {
  document.getElementById('processingOverlay').classList.remove('show');
}

/* ---------- 出票成功后的通知联动：横幅 + 「信息」App 系统消息同步 ----------
   与钱包/通讯 App 的联动方式保持一致：
   1) 若用户在「设置 → 消息横幅」中开启了横幅，立即按所选样式弹出横幅
   2) 无论横幅是否开启，都写入一条系统消息，供「信息」App 的「系统」分组同步展示 */
function _trNotifyTicketIssued() {
  const title = `${CHAR.name || 'TA'} · 心动旅行出票成功`;
  const msg = `${TRIP.origin || '出发地'} → 「${TRIP.destination}」的行程已确认 · ${TRIP.transport.title}${TRIP.flight ? ' ' + TRIP.flight.flightNo : ''} · ${TRIP.seat.title}${TRIP.seatNumber ? ' ' + TRIP.seatNumber : ''} · ${TRIP.dateStart} 出发，祝这趟旅程一切顺利`;
  if (window.LunaBanner) {
    window.LunaBanner.show({ app: '心动旅行', title, message: msg });
  }
  if (window.LunaSystemMessages) {
    window.LunaSystemMessages.push({ app: '心动旅行', title, message: msg });
  }
}

/* ================================
   5.2 确认支付 —— 主流程
   顺序：校验余额（TA请客则跳过）→ 校验支付密码 → 扣款并写入钱包流水
        → 出票动画 → 横幅 + 系统消息通知
================================ */
async function confirmPay() {
  const price = TRIP.price || computePrice();

  if (!TRIP.treat) {
    const home = await _trLoadHomeData();
    const balance = Number(home.balance || 0);
    if (balance < price) {
      _trShowInsuffModal(price - balance);
      return;
    }

    const passed = await _trRequirePayPassword();
    if (!passed) return;

    _trShowProcessing('正在扣款…');
    const now = new Date();
    const dateStr = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} · ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const txList = Array.isArray(home.transactions) ? home.transactions.slice() : [];
    txList.unshift({
      dir: 'out',
      name: `心动旅行 · ${TRIP.destination}`,
      date: dateStr,
      ts: now.getTime(),
      amount: price
    });
    await _trSaveHomeData({ ...home, balance: balance - price, transactions: txList });
  } else {
    _trShowProcessing('正在确认出票…');
  }

  TRIP.status = 'planning';
  TRIP.checkedIn = false;
  await saveTrip(TRIP);

  // 出票动画所需字段
  document.getElementById('ticketFrom').textContent = (TRIP.originEn || TRIP.origin || '出发地').toUpperCase().slice(0, 8);
  document.getElementById('ticketTo').textContent = TRIP.destination;
  document.getElementById('ticketToCode').textContent = (TRIP.destinationEn || TRIP.destination).toUpperCase().slice(0, 8);
  document.getElementById('ticketDate').textContent = TRIP.dateStart || '—';
  document.getElementById('ticketTransport').textContent = TRIP.transport.title;
  document.getElementById('ticketFlightNo').textContent = TRIP.flight ? TRIP.flight.flightNo : '—';
  document.getElementById('ticketSeat').textContent = TRIP.seat.title;
  document.getElementById('ticketSeatNum').textContent = TRIP.seatNumber || '—';
  document.getElementById('ticketDaysMeta').textContent = `${TRIP.days} 天`;
  _trResetCheckinUI();

  const paper = document.getElementById('ticketPaper');
  paper.style.animation = 'none'; void paper.offsetWidth; paper.style.animation = '';
  const caption = document.getElementById('ticketCaption');
  caption.style.animation = 'none'; void caption.offsetWidth; caption.style.animation = '';

  setTimeout(() => {
    _trHideProcessing();
    showScreen('scrTicket');
    setTimeout(fireConfetti, 900);
    _trNotifyTicketIssued();
  }, 500);
}

/* ================================
   5.3 在线值机
   —— 出票后可在票根页直接完成值机，生成登机口与座位确认，
      并同步一条系统消息，与出票通知走同一套横幅/消息联动。
================================ */
function _trResetCheckinUI() {
  document.getElementById('checkinBeforeRow').style.display = TRIP.checkedIn ? 'none' : '';
  document.getElementById('checkinDoneRow').style.display = TRIP.checkedIn ? '' : 'none';
  const isFlightOrTrain = TRIP.transport && (TRIP.transport.key === 'flight' || TRIP.transport.key === 'train');
  document.getElementById('checkinCard').style.display = isFlightOrTrain ? '' : 'none';
  document.getElementById('checkinSub').textContent = TRIP.transport && TRIP.transport.key === 'flight'
    ? '出发前完成值机，可优先登机'
    : '出发前完成值机，锁定车票座位信息';
  if (TRIP.checkedIn && TRIP.gate) {
    document.getElementById('checkinDoneSub').textContent = `登机口 ${TRIP.gate}　·　座位 ${TRIP.seatNumber || '—'}`;
  }
}
async function doCheckin() {
  if (TRIP.checkedIn) return;
  const seed = _trHashSeed((TRIP.flight ? TRIP.flight.id : '') + (TRIP.destination || ''));
  const gateLetter = String.fromCharCode(65 + (seed % 6));
  const gateNum = 1 + (seed % 30);
  TRIP.gate = `${gateLetter}${gateNum}`;
  TRIP.checkedIn = true;
  await saveTrip(TRIP);
  _trResetCheckinUI();
  showToast('值机成功，祝旅途愉快');

  const title = `${CHAR.name || 'TA'} · 值机成功`;
  const msg = `前往「${TRIP.destination}」的行程已完成值机 · 登机口 ${TRIP.gate} · 座位 ${TRIP.seatNumber || '—'}`;
  if (window.LunaBanner) window.LunaBanner.show({ app: '心动旅行', title, message: msg });
  if (window.LunaSystemMessages) window.LunaSystemMessages.push({ app: '心动旅行', title, message: msg });
}

function fireConfetti() {
  const wrap = document.createElement('div');
  wrap.className = 'tr-confetti';
  const colors = ['#17171a', '#9a9a9f', '#c6c6ca', '#ffffff', '#e2e2e5'];
  for (let i = 0; i < 60; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.animationDuration = (2 + Math.random() * 1.8) + 's';
    p.style.animationDelay = (Math.random() * 0.4) + 's';
    p.style.opacity = 0.6 + Math.random() * 0.4;
    wrap.appendChild(p);
  }
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 4000);
}

async function shareGoodNews() {
  const modal = document.getElementById('reactionModal');
  const textEl = document.getElementById('reactionModalText');
  textEl.innerHTML = `<span class="typing-cursor"></span>`;
  modal.classList.add('show');
  if (hasApiConfig()) {
    try {
      const sys = travelSystemPrompt(`用户刚刚和你确认了去「${TRIP.destination}」的旅行票，正在向你分享这个好消息。请给出一句惊喜、开心、符合你性格的即时反应，30字以内。`);
      const raw = await callAI(sys, '票订好啦，我们要出发去' + TRIP.destination + '了！', false, 100);
      textEl.textContent = raw;
    } catch (e) { textEl.textContent = '真的吗！太好了，我已经开始期待了。'; showToast('AI回应生成失败，已显示默认文案'); }
  } else {
    textEl.textContent = '真的吗！太好了，我已经开始期待了。';
  }
}
function closeReactionModal() { document.getElementById('reactionModal').classList.remove('show'); }

/* ================================
   7. 行李清单
================================ */
const PACK_CATEGORIES = {
  '衣物': ['当季外套', '换洗上衣', '舒适鞋履', '睡衣'],
  '证件': ['身份证/护照', '行程单', '备用现金'],
  '数码': ['手机充电器', '充电宝', '相机'],
  '纪念品准备': ['一份小礼物', '空白笔记本'],
};
function enterPackingStep() {
  _packState = {};
  const grid = document.getElementById('packGrid');
  grid.innerHTML = Object.entries(PACK_CATEGORIES).map(([cat, items]) => `
    <div>
      <div class="tr-pack-group-title">${cat}</div>
      <div class="tr-pack-items">
        ${items.map((it, i) => {
          const key = cat + '_' + i;
          _packState[key] = false;
          return `<div class="tr-pack-chip" data-key="${key}" onclick="togglePack('${key}')"><span class="dot"></span>${escHtml(it)}</div>`;
        }).join('')}
      </div>
    </div>
  `).join('');
  showScreen('scrPacking');
  loadPackingReminder();
}
function togglePack(key) {
  _packState[key] = !_packState[key];
  document.querySelector(`.tr-pack-chip[data-key="${key}"]`).classList.toggle('checked', _packState[key]);
}
async function loadPackingReminder() {
  const note = document.getElementById('packNote');
  note.textContent = '正在整理提醒…';
  if (hasApiConfig()) {
    try {
      const sys = travelSystemPrompt(`你和用户即将出发去「${TRIP.destination}」，行程${TRIP.days}天。请以你的口吻，提醒用户收拾行李时别忘记的1-2件具体物品（结合目的地气候/特点合理推测，比如可能需要带伞、防晒、保暖衣物等），像日常叮嘱一样自然，40字以内。`);
      const raw = await callAI(sys, '要出发了，行李有什么要提醒我的吗？', false, 120);
      note.textContent = raw;
    } catch (e) {
      note.textContent = `记得带上舒服的鞋子，${TRIP.destination}的路，我们要一起慢慢走。`;
      showToast('AI提醒生成失败，已显示默认提醒');
    }
  } else {
    note.textContent = `记得带上舒服的鞋子，${TRIP.destination}的路，我们要一起慢慢走。`;
  }
}

/* ================================
   天气/季节系统
   出发日期确定后，为整趟旅行生成一条天气线，
   影响每日开场基调与事件概率
================================ */
const WEATHER_TYPES = [
  { key: 'sunny', label: '晴朗', icon: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5 5L3.5 3.5M18.5 18.5L20 20M5 19l-1.5 1.5M18.5 5.5L20 4', weight: 5 },
  { key: 'cloudy', label: '多云', icon: 'M6 19a4 4 0 010-8 5 5 0 0110-1 4 4 0 010 9H6z', weight: 3 },
  { key: 'rain', label: '小雨', icon: 'M6 16a4 4 0 010-8 5 5 0 0110-1 4 4 0 010 9M8 19l-1 2M12 19l-1 2M16 19l-1 2', weight: 2 },
  { key: 'clear-night', label: '晴夜', icon: 'M20 14a8 8 0 11-9-9 6.5 6.5 0 009 9z', weight: 2 },
];
function pickWeighted(arr) {
  const total = arr.reduce((s, a) => s + a.weight, 0);
  let r = Math.random() * total;
  for (const a of arr) { if (r < a.weight) return a; r -= a.weight; }
  return arr[0];
}
function generateWeatherLine(days) {
  const line = [];
  for (let i = 0; i < days; i++) line.push(pickWeighted(WEATHER_TYPES).key);
  return line;
}
function weatherMeta(key) { return WEATHER_TYPES.find(w => w.key === key) || WEATHER_TYPES[0]; }

/* ================================
   构建本次行程的每日骨架
================================ */
function buildItinerarySkeleton(days) {
  const arr = [];
  for (let i = 0; i < days; i++) {
    arr.push({
      dayIndex: i,
      unlocked: i === 0,
      done: false,
      weather: TRIP.weatherLine[i],
      opening: null,
      spots: [],          // {name, img, text, photoDone, framedDone}
      events: [],          // {type, text, choices, resolved, result}
      summary: null,
      timeline: []
    });
  }
  return arr;
}

/* ================================
   出发：初始化旅程
================================ */
async function startJourney() {
  TRIP.packing = _packState;
  TRIP.status = 'ongoing';
  TRIP.weatherLine = generateWeatherLine(TRIP.days || 1);
  TRIP.itinerary = buildItinerarySkeleton(TRIP.days || 1);
  TRIP.affinity = 0;
  TRIP.camera = [];
  await saveTrip(TRIP);
  renderJourneyHome();
  showScreen('scrJourney');
}

/* ================================
   8. 旅程首页（天数时间轴）
================================ */
function renderJourneyHome() {
  document.getElementById('journeyDestTag').textContent = TRIP.destination;
  document.getElementById('journeyPlace').textContent = TRIP.destination;
  document.getElementById('journeyDaysStat').textContent = TRIP.days;
  const unlockedCount = TRIP.itinerary.filter(d => d.unlocked).length;
  document.getElementById('journeyTodayStat').textContent = unlockedCount;
  document.getElementById('journeyShotsStat').textContent = (TRIP.camera || []).length;
  document.getElementById('affinityNum').textContent = TRIP.affinity || 0;
  document.getElementById('affinityFill').style.width = Math.min(100, TRIP.affinity || 0) + '%';

  const list = document.getElementById('dayList');
  list.innerHTML = TRIP.itinerary.map((d, i) => {
    const w = weatherMeta(d.weather);
    const statusLabel = d.done ? '已完成' : (d.unlocked ? '可解锁' : '待解锁');
    const itemCls = 'tr-day-item' + (d.done ? ' done' : '') + (d.unlocked && !d.done ? ' today' : '') + (!d.unlocked ? ' locked' : '');
    return `
    <div class="${itemCls}">
      <div class="tr-day-line">
        <div class="tr-day-dot"></div>
        ${i < TRIP.itinerary.length - 1 ? '<div class="tr-day-thread"></div>' : ''}
      </div>
      <div class="tr-day-card" onclick="${d.unlocked ? `openDay(${i})` : `showToast('前一天还未完成哦')`}">
        <div class="tr-day-card-top">
          <div class="tr-day-num">DAY ${String(i + 1).padStart(2, '0')}</div>
          <div class="tr-day-status">${statusLabel}</div>
        </div>
        <div class="tr-day-title">${d.done && d.summary ? escHtml(d.summary.slice(0, 12)) : (d.unlocked ? '点击查看今天' : '尚未抵达')}</div>
        <div class="tr-day-desc">${d.done ? '这一天已经收进手账里了' : (d.unlocked ? '和' + escHtml(CHAR.name) + '一起，看看今天会遇见什么' : '完成前一天后自动解锁')}</div>
        <div class="tr-day-weather">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none"><path d="${w.icon}" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          ${w.label}
        </div>
      </div>
    </div>`;
  }).join('');
}

function openTripHistory() {
  renderTripHistory();
  showScreen('scrHistory');
}
async function renderTripHistory() {
  const list = document.getElementById('historyList');
  const trips = (await getTripsByChar(CHAR.id)).filter(t => t.status === 'finished').sort((a,b)=>b.updatedAt-a.updatedAt);
  if (!trips.length) { list.innerHTML = `<div class="tr-empty-hint">还没有完成的旅行<br>开启第一趟旅程，回忆会留在这里</div>`; return; }
  list.innerHTML = trips.map(t => `
    <div class="tr-day-item done" style="padding-bottom:20px;">
      <div class="tr-day-line"><div class="tr-day-dot"></div><div class="tr-day-thread"></div></div>
      <div class="tr-day-card" onclick="viewFinishedJournal(${t.id})">
        <div class="tr-day-card-top"><div class="tr-day-num">${new Date(t.dateStart||t.createdAt).toLocaleDateString('zh-CN')}</div><div class="tr-day-status">${t.days}天</div></div>
        <div class="tr-day-title">${escHtml(t.destination)}</div>
        <div class="tr-day-desc">默契值 ${t.affinity || 0} · 点击查看手账</div>
      </div>
    </div>
  `).join('');
}
async function viewFinishedJournal(id) {
  const t = await getTripById(id);
  if (!t) return;
  TRIP = t;
  renderJournal();
  showScreen('scrJournal');
}

/* ================================
   9. 每日内容 — 核心生成逻辑
================================ */
let _curDayIndex = 0;

const SPOT_IMG_POOL = [
  'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=80',
  'https://images.unsplash.com/photo-1528164344705-47542687000d?w=800&q=80',
  'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80',
  'https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?w=800&q=80',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
  'https://images.unsplash.com/photo-1490077476659-095159692ab5?w=800&q=80',
  'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800&q=80',
  'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=800&q=80',
];
function pickSpotImg(seed) { return SPOT_IMG_POOL[seed % SPOT_IMG_POOL.length]; }

const EVENT_TYPES = ['warm', 'challenge', 'surprise', 'daily'];
const EVENT_TYPE_LABEL = { warm: '暖心时刻', challenge: '小小考验', surprise: '意外惊喜', daily: '日常片段' };

async function openDay(i) {
  _curDayIndex = i;
  const day = TRIP.itinerary[i];
  document.getElementById('dayDetailNav').textContent = `DAY ${String(i + 1).padStart(2, '0')} · ${TRIP.destination}`;
  showScreen('scrDayDetail');
  const content = document.getElementById('dayDetailContent');
  content.innerHTML = `<div class="tr-loading"><div class="tr-loading-ring"></div><div class="tr-loading-text">${escHtml(CHAR.name)}正在感受今天…</div></div>`;

  if (!day.opening) {
    await generateDayContent(day, i);
  }
  renderDayDetail(day, i);
}

async function generateDayContent(day, i) {
  const w = weatherMeta(day.weather);
  const prevMood = i > 0 && TRIP.itinerary[i-1].summary ? `昨天的状态：${TRIP.itinerary[i-1].summary}` : '这是旅程的第一天';

  let data = null;
  if (hasApiConfig()) {
    try {
      const sys = travelSystemPrompt(`现在是「${TRIP.destination}」旅程的第${i+1}天（共${TRIP.days}天），今日天气「${w.label}」。${prevMood}。
请以严格JSON格式输出一个对象，包含：
- opening: 你今天开场时的状态播报，第一人称，受天气与前一天状态影响，35-60字
- spots: 数组，包含1到2个具体地点，每个元素含 name(地点名，8字以内) 和 text(你带用户看这个地方时的讲解与真实反应，60-100字，第一人称，要具体生动)
- event: 一个随机事件对象（可能为null表示今天没有特别事件），若有则含 type(值为 warm/challenge/surprise/daily 之一) 、text(事件描述，第一人称叙述当下发生了什么，40-70字)、choices(数组，2个供用户选择的应对方式，每个是简短短语，10字以内)
- summary: 今天结束时你的一句总结性台词，第一人称，20-40字，要有画面感
只输出JSON本身。`);
      const raw = await callAI(sys, `今天是第${i+1}天，看看会发生什么。`, true, 1200);
      data = safeParseJSON(raw, null);
    } catch (e) { data = null; }
  }
  if (!data || !data.opening) {
    data = {
      opening: `今天的${TRIP.destination}是${w.label}，风里都带着一点期待的味道。`,
      spots: [{ name: TRIP.destination + '·街角', text: '这里的光线很好，我们在这儿多待一会儿吧。' }],
      event: Math.random() > 0.5 ? { type: 'warm', text: `走着走着，${pronoun()}忽然把手伸了过来。`, choices: [`牵住${pronoun()}的手`, `笑着看向${pronoun()}`] } : null,
      summary: '今天很好，因为一直有你在身边。'
    };
    if (hasApiConfig()) showToast('AI内容生成失败，已显示默认内容');
  }

  day.opening = data.opening;
  day.spots = (data.spots || []).slice(0, 2).map((s, si) => ({
    name: s.name || ('地点' + (si+1)),
    img: pickSpotImg(i * 3 + si),
    text: s.text || '',
    photoDone: false,
    framedDone: false
  }));
  day.pendingEvent = data.event || null;
  day.events = day.events || [];
  day.summary = data.summary || '';
  day.timeline = [
    { time: '上午', text: day.opening },
    ...day.spots.map(s => ({ time: '途中', text: `在${s.name}，${s.text.slice(0, 30)}` })),
  ];
  await saveTrip(TRIP);
}

function renderDayDetail(day, i) {
  const w = weatherMeta(day.weather);
  const content = document.getElementById('dayDetailContent');
  content.innerHTML = `
    <div class="tr-day-detail-hero fadeUp">
      <div class="tr-day-detail-daytag">DAY ${String(i + 1).padStart(2,'0')} · ${w.label}</div>
      <div class="tr-day-detail-open">
        <div class="tr-day-detail-open-text">${escHtml(day.opening)}</div>
      </div>
    </div>
    ${day.spots.map((s, si) => `
      <div class="tr-spot-block fadeUp" style="animation-delay:${0.1 + si*0.1}s">
        <div class="tr-spot-img">
          <img src="${s.img}" alt=""/>
          <div class="tr-spot-img-veil"></div>
          <div class="tr-spot-name-tag"><div class="tr-spot-name">${escHtml(s.name)}</div></div>
        </div>
        <div class="tr-spot-text">${escHtml(s.text)}</div>
        <div class="tr-interact-row">
          <div class="tr-interact-btn ${s.photoDone ? 'done' : ''}" onclick="doTogetherPhoto(${i},${si})">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><rect x="3" y="6" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="13" r="3.5" stroke="currentColor" stroke-width="1.4"/><path d="M8 6l1.5-2h5L16 6" stroke="currentColor" stroke-width="1.4"/></svg>
            ${s.photoDone ? '已合影' : '共同拍照'}
          </div>
          <div class="tr-interact-btn ${s.framedDone ? 'done' : ''}" onclick="openCameraFor(${i},${si})">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><rect x="4" y="7" width="16" height="12" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M9 7l1-2h4l1 2" stroke="currentColor" stroke-width="1.4"/></svg>
            ${s.framedDone ? '已收藏' : '手动取景'}
          </div>
          <div class="tr-interact-btn" onclick="askAboutSpot(${i},${si})">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M8 10h8M8 14h5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M21 12a9 9 0 11-3.5-7.1L21 4l-1 4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
            问问${pronoun()}
          </div>
        </div>
      </div>
    `).join('')}
    <div id="eventSlot"></div>
    <div id="dayCloseSlot"></div>
  `;

  if (day.pendingEvent && !day.pendingEvent.resolved) {
    renderEventCard(day, i);
  } else if (allSpotsInteracted(day)) {
    renderDayClose(day, i);
  } else {
    renderDayCloseTeaser(day, i);
  }
}

function allSpotsInteracted(day) {
  return day.spots.every(s => s.photoDone || s.framedDone);
}

/* ---- 共同拍照 ---- */
async function doTogetherPhoto(dayIdx, spotIdx) {
  const day = TRIP.itinerary[dayIdx];
  const spot = day.spots[spotIdx];
  spot.photoDone = true;
  TRIP.affinity = Math.min(100, (TRIP.affinity || 0) + 4);
  await saveTrip(TRIP);
  renderDayDetail(day, dayIdx);
  showToast('已经和' + CHAR.name + '合影留念');
}

/* ---- 手动取景收藏（旅行相机机制） ---- */
let _cameraCtx = null;
function openCameraFor(dayIdx, spotIdx) {
  _cameraCtx = { dayIdx, spotIdx };
  const spot = TRIP.itinerary[dayIdx].spots[spotIdx];
  document.getElementById('cameraImg').src = spot.img;
  document.getElementById('cameraOverlay').classList.add('show');
}
function closeCamera() { document.getElementById('cameraOverlay').classList.remove('show'); _cameraCtx = null; }
async function takeShot() {
  if (!_cameraCtx) return;
  const flash = document.getElementById('flashWhite');
  flash.classList.add('flash');
  const { dayIdx, spotIdx } = _cameraCtx;
  const day = TRIP.itinerary[dayIdx];
  const spot = day.spots[spotIdx];
  spot.framedDone = true;
  TRIP.camera = TRIP.camera || [];
  TRIP.camera.push({ dayIndex: dayIdx, url: spot.img, caption: spot.name, manual: true });
  TRIP.affinity = Math.min(100, (TRIP.affinity || 0) + 3);
  await saveTrip(TRIP);
  setTimeout(() => {
    flash.classList.remove('flash');
    closeCamera();
    renderDayDetail(day, dayIdx);
    showToast('这个画面，你亲自选下了它');
  }, 380);
}

/* ---- 对话分支小提问 ---- */
async function askAboutSpot(dayIdx, spotIdx) {
  const day = TRIP.itinerary[dayIdx];
  const spot = day.spots[spotIdx];
  const modal = document.getElementById('reactionModal');
  const textEl = document.getElementById('reactionModalText');
  textEl.innerHTML = `<span class="typing-cursor"></span>`;
  modal.classList.add('show');
  if (hasApiConfig()) {
    try {
      const sys = travelSystemPrompt(`你和用户正在「${spot.name}」，用户随口问了你一个关于此刻或这个地方的问题。请给出一句自然、有细节、符合你性格的回应，30-50字。`);
      const raw = await callAI(sys, `在${spot.name}，你现在感觉怎么样？`, false, 140);
      textEl.textContent = raw;
    } catch (e) { textEl.textContent = '有你在身边，去哪里都觉得刚刚好。'; showToast('AI回应生成失败，已显示默认文案'); }
  } else {
    textEl.textContent = '有你在身边，去哪里都觉得刚刚好。';
  }
}

/* ---- 随机事件卡 ---- */
function renderEventCard(day, i) {
  const ev = day.pendingEvent;
  const slot = document.getElementById('eventSlot');
  if (!slot) return;
  slot.innerHTML = `
    <div class="tr-event-card fadeUp">
      <div class="tr-event-type">${EVENT_TYPE_LABEL[ev.type] || '事件'}</div>
      <div class="tr-event-text">${escHtml(ev.text)}</div>
      <div class="tr-event-choices">
        ${(ev.choices || []).map((c, ci) => `<button class="tr-event-choice" onclick="resolveEvent(${i},${ci})">${escHtml(c)}</button>`).join('')}
      </div>
    </div>
  `;
}
async function resolveEvent(dayIdx, choiceIdx) {
  const day = TRIP.itinerary[dayIdx];
  const ev = day.pendingEvent;
  const choice = ev.choices[choiceIdx];

  // 惊喜类事件 = 更换/追加目的地的触发入口
  if (ev.type === 'surprise' && Math.random() < 0.5) {
    ev.resolved = true;
    day.events.push({ ...ev, chosenIndex: choiceIdx, result: choice });
    TRIP.affinity = Math.min(100, (TRIP.affinity || 0) + 6);
    await saveTrip(TRIP);
    openSurprisePrompt(dayIdx);
    return;
  }

  ev.resolved = true;
  day.events.push({ ...ev, chosenIndex: choiceIdx, result: choice });
  day.timeline.push({ time: '偶遇', text: `${ev.text}（你${choice}）` });
  TRIP.affinity = Math.min(100, (TRIP.affinity || 0) + (ev.type === 'warm' ? 6 : ev.type === 'challenge' ? 3 : 4));

  await saveTrip(TRIP);
  document.getElementById('eventSlot').innerHTML = '';
  if (allSpotsInteracted(day)) renderDayClose(day, dayIdx);
  else renderDayCloseTeaser(day, dayIdx);

  // 展示角色对选择的即时反应
  const modal = document.getElementById('reactionModal');
  const textEl = document.getElementById('reactionModalText');
  textEl.innerHTML = `<span class="typing-cursor"></span>`;
  modal.classList.add('show');
  if (hasApiConfig()) {
    try {
      const sys = travelSystemPrompt(`刚刚发生的事：${ev.text}，用户选择了「${choice}」。请给出你此刻的真实反应，第一人称，20-40字。`);
      const raw = await callAI(sys, '你的反应是？', false, 100);
      textEl.textContent = raw;
    } catch (e) { textEl.textContent = '你这样，总是让我心里暖暖的。'; showToast('AI回应生成失败，已显示默认文案'); }
  } else {
    textEl.textContent = '你这样，总是让我心里暖暖的。';
  }
}

/* ---- 惊喜事件 → 更换/追加目的地 ---- */
let _surpriseCtx = null;
async function openSurprisePrompt(dayIdx) {
  _surpriseCtx = { dayIdx };
  const overlay = document.getElementById('surpriseOverlay');
  const textEl = document.getElementById('surpriseText');
  textEl.textContent = '……';
  overlay.classList.add('show');
  const otherDest = DESTINATIONS[Math.floor(Math.random() * DESTINATIONS.length)].name;
  _surpriseCtx.newDest = otherDest;
  if (hasApiConfig()) {
    try {
      const sys = travelSystemPrompt(`旅程中出现了一个惊喜转折：你临时想提议把接下来的行程改去/追加「${otherDest}」。请用你的语气说出这个提议，带着一点俏皮或惊喜感，40字以内。`);
      const raw = await callAI(sys, '你忽然想到了什么？', false, 120);
      textEl.textContent = raw;
    } catch (e) { textEl.textContent = `不如……接下来我们改去${otherDest}看看，好不好？`; showToast('AI回应生成失败，已显示默认文案'); }
  } else {
    textEl.textContent = `不如……接下来我们改去${otherDest}看看，好不好？`;
  }
}
async function closeSurprise(accepted) {
  const overlay = document.getElementById('surpriseOverlay');
  overlay.classList.remove('show');
  const { dayIdx, newDest } = _surpriseCtx || {};
  if (accepted && newDest) {
    TRIP.destination = TRIP.destination + ' → ' + newDest;
    showToast('目的地已更新为 ' + TRIP.destination);
  } else {
    showToast('维持原计划');
  }
  const day = TRIP.itinerary[dayIdx];
  document.getElementById('eventSlot').innerHTML = '';
  await saveTrip(TRIP);
  if (allSpotsInteracted(day)) renderDayClose(day, dayIdx);
  else renderDayCloseTeaser(day, dayIdx);
  renderJourneyHome();
}

/* ---- 每日收尾 ---- */
function renderDayCloseTeaser(day, i) {
  const slot = document.getElementById('dayCloseSlot');
  if (!slot) return;
  slot.innerHTML = `<div class="tr-empty-hint">先和${escHtml(CHAR.name)}互动完今天的地点，再来看看今天的收尾吧</div>`;
}
function renderDayClose(day, i) {
  const slot = document.getElementById('dayCloseSlot');
  if (!slot) return;
  day.done = true;
  day.unlocked = true;
  if (i + 1 < TRIP.itinerary.length) TRIP.itinerary[i + 1].unlocked = true;
  saveTrip(TRIP);

  slot.innerHTML = `
    <div class="tr-timeline-mini fadeUp">
      <div class="tr-section-title">今日回顾</div>
      ${day.timeline.map(t => `<div class="tr-tl-item"><div class="tr-tl-time">${escHtml(t.time)}</div><div class="tr-tl-text">${escHtml(t.text)}</div></div>`).join('')}
    </div>
    <div class="tr-day-close fadeUp">
      <div class="tr-day-close-quote">"${escHtml(day.summary)}"</div>
      <div class="tr-day-close-actions">
        ${i + 1 < TRIP.itinerary.length
          ? `<button class="tr-btn tr-btn-primary" style="flex:1;" onclick="backTo('scrJourney');renderJourneyHome();">回到旅程首页</button>`
          : `<button class="tr-btn tr-btn-primary" style="flex:1;" onclick="finishTrip()">整理旅行手账</button>`
        }
      </div>
    </div>
  `;
  renderJourneyHome();
}

/* ---- 提前结束旅行 ---- */
function confirmEndTripEarly() { document.getElementById('endConfirmModal').classList.add('show'); }
function closeEndConfirm() { document.getElementById('endConfirmModal').classList.remove('show'); }
async function doEndTripEarly() {
  closeEndConfirm();
  await finishTrip();
}

/* ================================
   10. 旅行结束 → 生成旅行手账
================================ */
function affinityLevel(score) {
  if (score >= 80) return { label: '心照不宣', words: '有些话不必说出口，你也早就懂了。' };
  if (score >= 55) return { label: '默契渐深', words: '这一路，我们越来越像同一种节奏。' };
  if (score >= 30) return { label: '渐入佳境', words: '还在慢慢了解彼此，但已经很喜欢这个过程。' };
  return { label: '初识旅伴', words: '才刚刚开始，往后的路还很长。' };
}

async function finishTrip() {
  TRIP.status = 'finished';
  TRIP.updatedAt = Date.now();
  await saveTrip(TRIP);
  showScreen('scrJournal');
  await renderJournal(true);
  renderJourneyHome();
}

async function renderJournal(generateSummary) {
  const content = document.getElementById('journalContent');
  content.innerHTML = `<div class="tr-loading"><div class="tr-loading-ring"></div><div class="tr-loading-text">正在整理这一路的记忆…</div></div>`;

  const doneDays = TRIP.itinerary.filter(d => d.done);
  const highlights = doneDays.map((d, idx) => ({ day: TRIP.itinerary.indexOf(d) + 1, line: d.summary || '' })).filter(h => h.line);
  const eventHighlights = doneDays.flatMap(d => d.events || []).filter(e => e.result);
  const manualShots = (TRIP.camera || []).filter(c => c.manual);
  const lvl = affinityLevel(TRIP.affinity || 0);

  let overallSummary = TRIP.journal && TRIP.journal.overall;
  if (generateSummary || !overallSummary) {
    if (hasApiConfig()) {
      try {
        const sys = travelSystemPrompt(`旅行「${TRIP.destination}」共${doneDays.length}天已经结束（原计划${TRIP.days}天）。请你以第一人称写一段这趟旅行的整体感想与总结，像旅行结束后对用户说的真心话，80-140字，要提及具体的情感变化或印象深刻的瞬间氛围，符合你的性格与说话方式，不要用列点。`);
        const raw = await callAI(sys, '这趟旅行要结束了，说说你的感想吧。', false, 400);
        overallSummary = raw;
      } catch (e) { overallSummary = `这趟${TRIP.destination}之旅，比我想象中更好。谢谢你陪我走完这一程。`; showToast('AI总结生成失败，已显示默认文案'); }
    } else {
      overallSummary = `这趟${TRIP.destination}之旅，比我想象中更好。谢谢你陪我走完这一程。`;
    }
    TRIP.journal = { overall: overallSummary, generatedAt: Date.now() };
    await saveTrip(TRIP);
  }

  content.innerHTML = `
    <div class="tr-journal-cover fadeUp">
      <div class="tr-journal-cover-img" style="background-image:url('${manualShots[0] ? manualShots[0].url : pickSpotImg(0)}')"></div>
      <div class="tr-journal-cover-veil"></div>
      <div class="tr-journal-cover-content">
        <div class="tr-journal-eyebrow">TRAVEL JOURNAL</div>
        <div class="tr-journal-title">${escHtml(TRIP.destination)}</div>
        <div class="tr-journal-meta-row">
          <span>${doneDays.length} / ${TRIP.days} 天</span>
          <span>${TRIP.transport ? TRIP.transport.title : ''}</span>
          <span>${TRIP.seat ? TRIP.seat.title : ''}</span>
        </div>
      </div>
    </div>

    <div class="tr-journal-section fadeUp">
      <div class="tr-section-title">每日高光</div>
      ${highlights.length ? highlights.map(h => `<div class="tr-journal-quote">"${escHtml(h.line)}"<span>DAY ${String(h.day).padStart(2,'0')}</span></div>`).join('') : `<div class="tr-empty-hint">还没有留下高光台词</div>`}
    </div>

    ${eventHighlights.length ? `
    <div class="tr-journal-section fadeUp">
      <div class="tr-section-title">事件回顾</div>
      ${eventHighlights.map(e => `<div class="tr-journal-quote">${escHtml(e.text)}<span>你选择了「${escHtml(e.result)}」</span></div>`).join('')}
    </div>` : ''}

    ${manualShots.length ? `
    <div class="tr-journal-section fadeUp" style="padding-bottom:6px;">
      <div class="tr-section-title">你亲自选的回忆</div>
    </div>
    <div class="tr-photo-grid fadeUp">
      ${manualShots.map(s => `<div class="tr-photo-item"><img src="${s.url}"/><div class="tr-photo-badge">DAY ${s.dayIndex+1}</div></div>`).join('')}
    </div>` : ''}

    <div class="tr-journal-section fadeUp">
      <div class="tr-affinity-result">
        <div class="tr-affinity-level">旅伴默契 · ${lvl.label}</div>
        <div class="tr-affinity-score">${TRIP.affinity || 0}</div>
        <div class="tr-affinity-words">"${escHtml(TRIP.journal.overall)}"</div>
      </div>
    </div>

    <div class="tr-bottom-bar">
      <button class="tr-btn tr-btn-ghost" style="flex:1;" onclick="backTo('scrHome');showScreen('scrHome');TRIP=null;initAfterFinish();">返回首页</button>
      <button class="tr-btn tr-btn-primary" style="flex:1;" onclick="planAgain()">再去一次旅行</button>
    </div>
  `;

  // 写入记忆档案（memory.html 同一套库），仅在首次生成完整总结时写入，避免重复
  if (generateSummary) {
    const journalText = `【旅行手账 · ${TRIP.destination}】共${doneDays.length}天，交通方式${TRIP.transport ? TRIP.transport.title : ''}。旅伴默契值${TRIP.affinity || 0}（${lvl.label}）。整体感受：${TRIP.journal.overall}${highlights.length ? '\n途中印象深刻的瞬间：' + highlights.map(h=>h.line).join('；') : ''}`;
    await saveTripMemory(CHAR.id, TRIP, journalText);
  }
}

function initAfterFinish() { initTravelApp(); }
function planAgain() { TRIP = null; showScreen('scrHome'); }