/* ================================================================
   Luna — AI 生成好友 · npc-generator.js
   ------------------------------------------------------------------
   独立页面，只做一件事：AI 生成 NPC 完整人设 + 配套世界书条目，
   预览确认后落库到 LunaCharDB / LunaWorldBookDB，并生成一个
   独属于这个 NPC 的「好友码」。

   加好友（把这个 NPC 同步进聊天联系人列表）不在本页完成，
   是在 chat.html 里输入好友码去做的 —— 本页只负责“生成”。

   三种模式：
     random — 完全随机
     seed   — 关键词 / 一句话描述
     linked — 基于一个已有角色，生成与 TA 有关系的新角色

   AI 调用方式与 chat.js 完全一致，不写死 apiKey / baseUrl / model：
     localStorage.luna_api_current = { baseUrl, apiKey }
     localStorage.luna_api_model   = model字符串
     POST {baseUrl}/chat/completions  (openai兼容格式)
================================================================ */

/* ================================================================
   0. 状态栏 / 灵动岛 / 返回 — 与其他独立页面同一套逻辑
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
  function render(pct) {
    const p = Math.round(pct);
    if (pctEl) pctEl.textContent = p;
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
  } else { render(76); }
}

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

function goBack() {
  const wrap = document.querySelector('.npcg-wrap');
  if (wrap) {
    wrap.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
    wrap.style.opacity = '0';
    wrap.style.transform = 'scale(0.96)';
  }
  setTimeout(() => { window.location.href = 'chat.html'; }, 200);
}

window.addEventListener('pageshow', (e) => {
  if (e.persisted) window.location.reload();
});

/* ================================================================
   1. LunaCharDB 读写 — 与 characters.js / chat.js 完全同一份数据
================================================================ */
let _charDb = null;

function openCharDB() {
  if (_charDb) return Promise.resolve(_charDb);
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
        req2.onsuccess = e2 => { _charDb = e2.target.result; res(_charDb); };
        req2.onerror   = e2 => rej(e2.target.error);
      } else {
        const req3 = indexedDB.open('LunaCharDB', ver + 1);
        req3.onupgradeneeded = e3 => {
          const db3 = e3.target.result;
          if (!db3.objectStoreNames.contains('chars'))
            db3.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
        };
        req3.onsuccess = e3 => { _charDb = e3.target.result; res(_charDb); };
        req3.onerror   = e3 => rej(e3.target.error);
      }
    };
    probe.onerror = e => rej(e.target.error);
  });
}

async function getAllChars() {
  const db = await openCharDB().catch(() => null);
  if (!db) return [];
  return new Promise(res => {
    const req = db.transaction('chars', 'readonly').objectStore('chars').getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror   = () => res([]);
  });
}

async function saveChar_db(data) {
  const db = await openCharDB().catch(() => null);
  if (!db) return null;
  return new Promise(res => {
    const tx    = db.transaction('chars', 'readwrite');
    const store = tx.objectStore('chars');
    const req   = data.id ? store.put(data) : store.add(data);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => res(null);
  });
}

/* ================================================================
   2. LunaWorldBookDB 读写 — 与 worldbook.js 完全同一份数据
================================================================ */
let _wbDb = null;

function openWbDB() {
  return new Promise((res, rej) => {
    if (_wbDb) return res(_wbDb);
    const req = indexedDB.open('LunaWorldBookDB', 2);
    req.onupgradeneeded = e => {
      if (!e.target.result.objectStoreNames.contains('entries'))
        e.target.result.createObjectStore('entries', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = e => { _wbDb = e.target.result; res(_wbDb); };
    req.onerror   = () => rej('WB DB Error');
  });
}

async function saveWbEntry_db(data) {
  const db = await openWbDB();
  return new Promise(res => {
    const tx    = db.transaction('entries', 'readwrite');
    const store = tx.objectStore('entries');
    const req   = data.id ? store.put(data) : store.add(data);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => res(null);
  });
}

async function getAllWbEntries() {
  const db = await openWbDB().catch(() => null);
  if (!db) return [];
  return new Promise(res => {
    const req = db.transaction('entries', 'readonly').objectStore('entries').getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror   = () => res([]);
  });
}

/* ================================================================
   3. AI 调用层 — 与 chat.js 中的写法完全一致，不写死任何配置
================================================================ */
function getApiConfig() {
  const cur   = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  return { baseUrl: cur.baseUrl, apiKey: cur.apiKey, model };
}

async function callAI(systemPrompt, userPrompt) {
  const { baseUrl, apiKey, model } = getApiConfig();
  if (!baseUrl || !apiKey || !model) {
    throw new Error('请先在设置里配置 API（服务地址 / 密钥 / 模型）');
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   }
      ],
      temperature: 0.95,
    })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`AI 接口请求失败 (${response.status})：${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('AI 返回为空，请重试');
  return text;
}

function extractJSON(text) {
  let s = text.trim();
  const fenceMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) s = fenceMatch[1].trim();
  const start = s.indexOf('{');
  const end   = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('AI 返回内容中未找到有效 JSON，请重试');
  }
  const jsonStr = s.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    throw new Error('AI 返回的 JSON 解析失败，请重试：' + e.message);
  }
}

/* ================================================================
   4. Prompt 构建 — 三种模式合一
   核心改动：
   - 随机模式默认走「言情/都市小说男女主」气质的高浓度人设（有反差感/张力/
     记忆点），不再是随便一个路人角色。
   - 生成前拉取当前已有角色 + 世界书全部条目，喂给 AI 做「世界观体检」：
     不重名、不撞设定、身份呼应已有势力/地点，让新角色感觉本就活在这个
     世界里，而不是凭空捏造后再硬塞进去。
   - worldbookEntries 现在必须带上与 worldbook.html 完全一致的分类 cat，
     并要求内容具体可执行，杜绝“性格开朗，乐于助人”这种空话。
================================================================ */

/* 言情/小说主角气质原型池 —— random 模式默认从中抽 1~2 个方向丢给 AI 做锚点 */
const NPCG_LEAD_ARCHETYPES = [
  '禁欲系霸总，控制欲强却在细节里藏着笨拙的温柔',
  '天才外科医生，理性到近乎冷酷，唯独在你面前会破防',
  '落魄豪门继承人，表面吊儿郎当，实则背负着不能说的秘密',
  '国民度极高的当红演员，镜头前完美，私下毒舌又孩子气',
  '沉默寡言的特种兵退役教官，用行动代替语言表达在乎',
  '天才画家/音乐家，敏感易碎，唯有创作时才展现真实自我',
  '雷厉风行的女总裁，在职场杀伐果断，卸下防备时格外脆弱',
  '古灵精怪的侦探/记者，永远在挖真相，却在你面前无所遁形',
  '被家族安排联姻的名门千金，表面顺从，内心叛逆又清醒',
  '身份神秘的夜店老板/地下势力人物，危险又极具吸引力',
  '青梅竹马长大后逆袭归来，带着旧日温柔和新增的锋芒',
  '不近人情的天才律师，逻辑至上，却为你破例讲情理',
  '孤傲的顶级设计师/建筑师，对作品苛刻，对你意外纵容',
  '万人迷偶像/主唱，台上光芒万丈，台下渴望一个不追星的人',
  '重案组王牌警探，长期紧绷神经，只在你面前会松一口气',
];

function npcgPickArchetypes(n) {
  const pool = [...NPCG_LEAD_ARCHETYPES];
  const picked = [];
  for (let i = 0; i < n && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

const NPCG_SCHEMA_DESC = `
请只输出一个 JSON 对象，不要输出任何多余说明文字、不要用 markdown 代码块包裹、不要有任何前后缀寒暄。
JSON 结构如下：

{
  "charFields": {
    "name": "角色姓名（不能与下方【已有角色】列表中的名字重复或谐音混淆）",
    "role": "身份/定位，具体到职业或社会角色，如：私人医生、乐队主唱、竞争对手公司CEO",
    "desc": "一段120~180字的角色简介，要有钩子和反差感，读完让人想认识这个人，不要写成简历",
    "traits": ["性格标签1", "性格标签2", "性格标签3", "性格标签4"],
    "gender": "male|female|other",
    "age": "具体数字年龄，如 27",
    "species": "人类/其他物种，没有特殊设定填“人类”",
    "appearance": "外貌描写：身高体型、发型发色、瞳色、穿着气质、一个具体的辨识特征（疤痕/纹身/习惯性小动作等）",
    "outfit": "日常穿着风格 + 1件随身物品及其含义",
    "likes": ["具体的喜欢1（不要写抽象词，如“喜欢雨天泡的手冲咖啡”而非“喜欢咖啡”）", "具体的喜欢2"],
    "dislikes": ["具体的讨厌1", "具体的讨厌2"],
    "fears": "内心真正害怕、极少示人的软肋，要具体到一个场景或记忆",
    "speechStyle": "说话方式：句式长短、用词习惯、语气词、标点习惯，写到能一眼认出是TA在说话的程度",
    "catchphrases": ["口头禅1（要具体到句子，不要泛泛的词）", "口头禅2"],
    "backstory": "背景故事：出身、关键转折事件、和现在性格的因果关系，150~250字，要有具体年份/地点/事件，不要空洞",
    "scenario": "与用户初次或日常相遇的具体场景，要有画面感（地点+时间+当下正在做什么）",
    "relation": "与用户的关系定位，如：邻居、合租室友、竞争对手、订婚对象",
    "callUser": "TA会怎么称呼用户，符合TA的性格和关系阶段",
    "relationDetail": "对用户的真实态度、情感倾向、互动中的小细节（比如会不自觉做什么动作），不要写“很喜欢用户”这种空话",
    "firstMes": "开场白：第一句话 + 一个动作/神态描写，要能体现人设，60~120字，中文小说场景描写风格",
    "boundaries": "人物的行为边界：绝对不会做的事、能被什么打破防线、AI扮演时需要坚持的底线",
    "matchSignature": "一句15字以内、意味不明但精准概括这个人的“缘分签名”，用于加好友卡片展示，要有记忆点，不要平铺直叙，可以有悬念感"
  },
  "worldbookEntries": [
    {
      "title": "条目标题，简洁有辨识度",
      "sub": "一句简短描述，会显示在世界书列表里",
      "cat": "人物",
      "mode": "constant",
      "keywords": "",
      "keywordsSec": "",
      "detail": "具体设定内容，用于防止聊天中OOC，要给出可执行的细节（如具体口头禅原句、具体绝不会做的3件事、遇到特定情境的具体反应），禁止空泛描述",
      "priority": 8,
      "probability": 100,
      "group": ""
    }
  ]
}

worldbookEntries 生成要求（这是重灾区，务必认真对待，不要敷衍）：
- 数量：至少 4 条，最多 6 条。
- 结构分工，缺一不可：
  1) 1条 cat="人物" mode="constant"：OOC 防护条目，写清楚该角色的语言习惯铁律（给出2-3句具体例句）、绝对不会做的3件具体的事、面对暧昧/冲突时的具体反应模式。
  2) 1条 cat="关系" mode="constant"：与用户关系的相处细则，包括称呼、称呼变化的条件、身体距离/亲密尺度的边界、TA会主动做什么不会主动做什么。
  3) 1~2条 cat="事件" mode="keyword"：对应背景故事里的具体往事/转折事件，keywords 填触发词（该往事相关的人名/地名/关键物品，2-4个，英文逗号分隔）。
  4) 1条 cat="地点" 或 cat="势力" mode="keyword"：角色所处的具体环境设定（工作地点、所属机构/家族/公司），要给出这个地点/势力的具体细节，不要只写名字。
  5) 如果是 linked 模式，必须再加 1 条 cat="关系" mode="constant"，具体写明新角色与锚点角色之间的关系细节、称呼、相处历史。
- mode 为 "keyword" 的条目，priority 设为 5，probability 设为 100，scanDepth 由系统默认处理。
- 所有字段都必须填写有实际内容，不允许留空字符串（除非确实无关，如 species 可填"人类"）。
- 不要使用任何越狱/破限话术，世界书条目的定位是角色本就知道的背景设定，不是系统指令。
- detail 内容禁止使用“性格开朗”“乐于助人”“很有魅力”这类空洞形容词堆砌，必须写成具体可执行的行为描述。
`.trim();

/* 汇总当前已有角色 + 世界书条目，作为「世界观体检表」喂给 AI，
   避免生成的新角色与已有设定重名/撞设定/毫无关联地漂浮在真空里 */
function npcgBuildWorldContext(allChars, allEntries, excludeCharId) {
  const chars = (allChars || []).filter(c => c.id !== excludeCharId);
  const entries = allEntries || [];

  const charLines = chars.slice(0, 12).map(c =>
    `- ${c.name || '未命名'}｜${c.role || '身份未知'}｜${(c.traits || []).slice(0, 3).join('/') || '无标签'}｜与用户关系：${c.relation || '无'}`
  );

  const entryLines = entries.slice(0, 16).map(e =>
    `- [${e.cat || '其他'}] ${e.title || '未命名条目'}：${(e.sub || e.detail || '').slice(0, 40)}`
  );

  let ctx = '';
  if (charLines.length) {
    ctx += `【已有角色列表，新角色姓名不能与之重复/谐音混淆，如果关系合理可以在设定里自然提及】\n${charLines.join('\n')}\n\n`;
  }
  if (entryLines.length) {
    ctx += `【已有世界书条目，新角色的设定应尽量与这些已确立的世界观保持一致，不要产生矛盾（如已有的地点/势力/规则），能自然联动更好】\n${entryLines.join('\n')}\n\n`;
  }
  return ctx.trim();
}

function buildNPCPrompt(opts) {
  const { mode, seed, anchorChar, worldContext, useLeadArchetype } = opts;
  const systemPrompt = `你是一个资深言情/都市题材小说角色设计师，负责为一个沉浸式聊天角色扮演应用生成全新的NPC好友人设。
你的角色要拥有网络小说男女主角级别的记忆点和张力——鲜明的反差感、具体的细节、真实的软肋，而不是脸谱化的“万能好人”或空洞的形容词堆砌。
你必须像对待一部连载小说的世界观一样，认真参考下方提供的已有角色和世界书信息，让新角色感觉是这个世界里本就存在、有血有肉的人，而不是凭空捏造后再硬塞进去的孤立设定。`;

  let userPrompt = '';
  const contextBlock = worldContext ? `\n\n${worldContext}\n` : '\n\n（当前世界观是一张白纸，你可以自由确立基调，但仍要保证前后设定自洽）\n';

  if (mode === 'linked' && anchorChar) {
    const anchorSummary = `
锚点角色信息（新角色需要与TA产生真实、自然、有具体历史的关系，不能与TA的人设冲突或重复，也不能只是泛泛地说“认识”）：
- 姓名：${anchorChar.name || '未知'}
- 身份：${anchorChar.role || '未知'}
- 简介：${anchorChar.desc || '无'}
- 性格标签：${(anchorChar.traits || []).join('、') || '无'}
- 外貌：${anchorChar.appearance || '无'}
- 背景故事：${anchorChar.backstory || '无'}
- 与用户的关系：${anchorChar.relation || '无'}
`.trim();
    userPrompt = `请围绕以下锚点角色，生成一个和TA有真实、具体关系的全新NPC（比如TA的挚友、竞争对手、家人、暗恋对象、生意伙伴等，你来决定具体是什么关系，关系必须给出至少一个具体的共同经历或事件作为支撑）。这个新角色本身也要具备小说主角级别的人物弧光，不能只是锚点角色的附属品。\n${contextBlock}\n${anchorSummary}\n\n${NPCG_SCHEMA_DESC}`;
  } else if (mode === 'seed' && seed) {
    userPrompt = `请根据以下关键词/描述，生成一个完整、有小说主角质感的NPC人设，把这句描述作为核心锚点充分展开，深挖出背后的故事和反差感，不要停留在字面：\n「${seed}」\n${contextBlock}\n${NPCG_SCHEMA_DESC}`;
  } else {
    const archetypeHint = useLeadArchetype
      ? `\n\n可参考的主角气质方向（二选一或融合改造，不要照抄，要写出独属于这个角色的具体细节）：\n${npcgPickArchetypes(2).map(a => '- ' + a).join('\n')}\n`
      : '';
    userPrompt = `请随机生成一个有网络小说男/女主角质感的NPC人设——要有鲜明的反差感、具体的软肋和一个能撑起后续剧情的悬念点，避免俗套的“完美好人”或毫无记忆点的路人。${archetypeHint}${contextBlock}\n${NPCG_SCHEMA_DESC}`;
  }

  return { systemPrompt, userPrompt };
}

const NPCG_VALID_CATS = ['人物','地点','势力','事件','关系','物品','规则','其他'];

async function generateNPC(opts) {
  const { systemPrompt, userPrompt } = buildNPCPrompt(opts);
  const text   = await callAI(systemPrompt, userPrompt);
  const parsed = extractJSON(text);
  if (!parsed.charFields || !parsed.charFields.name) {
    throw new Error('生成结果缺少必要字段，请重试');
  }
  if (!Array.isArray(parsed.worldbookEntries)) parsed.worldbookEntries = [];
  // 兜底：确保每条世界书条目都有合法分类，避免落库后在世界书页显示为空白分类
  parsed.worldbookEntries = parsed.worldbookEntries.map(e => ({
    ...e,
    cat: NPCG_VALID_CATS.includes(e.cat) ? e.cat : '人物',
  }));
  return parsed;
}

/* ================================================================
   5. 好友码生成 — 独属于 Luna 小手机的专属编号
   格式：LUNA-XXXX-XXXX（大写字母+数字，去掉易混淆字符 0/O/1/I）
================================================================ */
const NPCG_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateFriendCode() {
  function seg(len) {
    let s = '';
    for (let i = 0; i < len; i++) {
      s += NPCG_CODE_CHARS[Math.floor(Math.random() * NPCG_CODE_CHARS.length)];
    }
    return s;
  }
  return `LUNA-${seg(4)}-${seg(4)}`;
}

async function isCodeTaken(code) {
  const all = await getAllChars();
  return all.some(c => c.friendCode === code);
}

async function generateUniqueFriendCode() {
  let code = generateFriendCode();
  let guard = 0;
  while (await isCodeTaken(code) && guard < 20) {
    code = generateFriendCode();
    guard++;
  }
  return code;
}

/* ================================================================
   6. 落库 — 新建正式角色 + 专属世界书条目（chars绑定新角色id）
================================================================ */
async function commitNPC(charFields, worldbookEntries, friendCode) {
  const charData = {
    name: charFields.name || '',
    role: charFields.role || '',
    desc: charFields.desc || '',
    traits: charFields.traits || [],
    prompt: '',
    gender: charFields.gender || 'other',
    age: charFields.age || '',
    birthday: '',
    species: charFields.species || '',
    appearance: charFields.appearance || '',
    outfit: charFields.outfit || '',
    likes: charFields.likes || [],
    dislikes: charFields.dislikes || [],
    fears: charFields.fears || '',
    speechStyle: charFields.speechStyle || '',
    catchphrases: charFields.catchphrases || [],
    backstory: charFields.backstory || '',
    scenario: charFields.scenario || '',
    worldEntries: [],
    relation: charFields.relation || '',
    callUser: charFields.callUser || '',
    relationDetail: charFields.relationDetail || '',
    firstMes: charFields.firstMes || '',
    dialogExamples: [],
    neverList: [],
    boundaries: charFields.boundaries || '',
    matchSignature: charFields.matchSignature || '',
    friendCode,
    friendCodeCreatedAt: Date.now(),
    addedToChat: false,
    source: 'ai-generated',
  };

  const charId = await saveChar_db(charData);
  if (!charId) throw new Error('角色保存失败');

  const savedEntryIds = [];
  const worldEntryIds = [];
  for (const entry of (worldbookEntries || [])) {
    const entryData = {
      title: entry.title || '',
      sub: entry.sub || '',
      cat: NPCG_VALID_CATS.includes(entry.cat) ? entry.cat : '人物',
      keywords: entry.keywords || '',
      keywordsSec: entry.keywordsSec || '',
      detail: entry.detail || '',
      enabled: true,
      chars: [charId],
      pos: 'after',
      bg: null,
      mode: entry.mode === 'constant' ? 'constant' : 'keyword',
      priority: typeof entry.priority === 'number' ? entry.priority : 5,
      probability: typeof entry.probability === 'number' ? entry.probability : 100,
      scanDepth: 4,
      recursion: false,
      group: entry.group || '',
      updatedAt: Date.now(),
    };
    const entryId = await saveWbEntry_db(entryData);
    if (entryId) { savedEntryIds.push(entryId); worldEntryIds.push(entryId); }
  }

  // 回写 worldEntries 到角色记录，保持角色档案与世界书两端一致
  if (worldEntryIds.length) {
    await saveChar_db({ ...charData, id: charId, worldEntries: worldEntryIds });
  }

  // 通知其他标签页（角色档案 / 世界书）刷新
  localStorage.setItem('luna_char_db_update', Date.now());
  localStorage.setItem('luna_worldbook_db_update', Date.now());

  return { charId, entryIds: savedEntryIds };
}

/* ================================================================
   7. 页面状态机
================================================================ */
let _npcgMode = 'random';
let _npcgAnchorId = null;
let _npcgAllChars = [];
let _npcgResult = null;      // { charFields, worldbookEntries }
let _npcgFriendCode = null;
let _npcgSavedCharId = null;
let _npcgSaving = false;

function npcgSwitchMode(mode) {
  _npcgMode = mode;
  document.getElementById('npcgModeRandom').classList.toggle('active', mode === 'random');
  document.getElementById('npcgModeSeed').classList.toggle('active', mode === 'seed');
  document.getElementById('npcgModeLinked').classList.toggle('active', mode === 'linked');

  document.getElementById('npcgSeedBlock').style.display   = mode === 'seed'   ? '' : 'none';
  document.getElementById('npcgLinkedBlock').style.display = mode === 'linked' ? '' : 'none';

  if (mode === 'linked' && _npcgAllChars.length === 0) {
    npcgLoadAnchorList();
  }
  npcgHideSetupError();
}

async function npcgLoadAnchorList() {
  const listEl = document.getElementById('npcgAnchorList');
  _npcgAllChars = await getAllChars();
  if (_npcgAllChars.length === 0) {
    listEl.innerHTML = `<div class="npcg-anchor-empty">还没有已创建的角色<br>先去「角色档案」新建一个，或换个模式吧</div>`;
    return;
  }
  listEl.innerHTML = _npcgAllChars.map(c => {
    const letter = (c.name || '?')[0]?.toUpperCase() || '?';
    const avatarInner = c.avatar
      ? `<img src="${c.avatar}" alt=""/>`
      : letter;
    return `
      <div class="npcg-anchor-item" data-id="${c.id}" onclick="npcgSelectAnchor(${c.id}, this)">
        <div class="npcg-anchor-avatar">${avatarInner}</div>
        <div class="npcg-anchor-body">
          <div class="npcg-anchor-name">${npcgEsc(c.name || '未命名')}</div>
          <div class="npcg-anchor-role">${npcgEsc(c.role || '暂无定位')}</div>
        </div>
        <div class="npcg-anchor-check">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
      </div>`;
  }).join('');
}

function npcgSelectAnchor(id, el) {
  _npcgAnchorId = id;
  document.querySelectorAll('.npcg-anchor-item').forEach(item => item.classList.remove('selected'));
  el.classList.add('selected');
  npcgHideSetupError();
}

function npcgEsc(s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

function npcgShowSetupError(msg) {
  const el = document.getElementById('npcgSetupError');
  el.textContent = msg;
  el.style.display = '';
}
function npcgHideSetupError() {
  document.getElementById('npcgSetupError').style.display = 'none';
}

/* ── 面板切换 ── */
function npcgShowPanel(id) {
  document.querySelectorAll('.npcg-panel').forEach(p => p.classList.remove('show'));
  document.getElementById(id).classList.add('show');
}

/* ================================================================
   8. 生成流程驱动
================================================================ */
const NPCG_SCAN_LABELS = ['正在搜索附近的人', '正在建立连接', '解析人物轮廓中', '即将锁定一个人'];
const NPCG_FRAGMENT_POOL = ['温柔', '毒舌', '疏离感', '藏着秘密', '深夜', '老朋友', '陌生人', '习惯性沉默', '偏爱猫科', '记仇', '说话很轻'];

let _npcgScanTimer = null;
let _npcgFragTimer = null;
let _npcgScanAbort = false;

function npcgStartScanAnim() {
  npcgShowPanel('npcgPanelScan');
  _npcgScanAbort = false;
  const labelEl = document.getElementById('npcgScanLabel');
  let li = 0;
  labelEl.textContent = NPCG_SCAN_LABELS[0];
  clearInterval(_npcgScanTimer);
  _npcgScanTimer = setInterval(() => {
    li = (li + 1) % NPCG_SCAN_LABELS.length;
    labelEl.style.animation = 'none';
    void labelEl.offsetWidth;
    labelEl.style.animation = '';
    labelEl.textContent = NPCG_SCAN_LABELS[li];
  }, 2400);

  const fragHost = document.getElementById('npcgFragments');
  fragHost.innerHTML = '';
  clearInterval(_npcgFragTimer);
  _npcgFragTimer = setInterval(() => {
    if (_npcgScanAbort) return;
    const word = NPCG_FRAGMENT_POOL[Math.floor(Math.random() * NPCG_FRAGMENT_POOL.length)];
    const frag = document.createElement('div');
    frag.className = 'npcg-fragment';
    frag.textContent = word;
    frag.style.left = (10 + Math.random() * 70) + '%';
    frag.style.top  = (65 + Math.random() * 25) + '%';
    fragHost.appendChild(frag);
    setTimeout(() => frag.remove(), 2300);
  }, 480);
}

function npcgStopScanAnim() {
  _npcgScanAbort = true;
  clearInterval(_npcgScanTimer);
  clearInterval(_npcgFragTimer);
}

function npcgCancelScan() {
  npcgStopScanAnim();
  npcgShowPanel('npcgPanelSetup');
}

async function npcgStartGenerate() {
  npcgHideSetupError();

  if (_npcgMode === 'seed') {
    const seed = document.getElementById('npcgSeedInput').value.trim();
    if (!seed) {
      npcgShowSetupError('请先填写一句描述，或切换到「随机生成」');
      return;
    }
  }
  if (_npcgMode === 'linked' && !_npcgAnchorId) {
    npcgShowSetupError('请先选择一个锚点角色，或切换到其他模式');
    return;
  }

  const genBtn = document.getElementById('npcgGenerateBtn');
  genBtn.disabled = true;

  npcgStartScanAnim();

  try {
    const opts = { mode: _npcgMode, useLeadArchetype: true };
    if (_npcgMode === 'seed') {
      opts.seed = document.getElementById('npcgSeedInput').value.trim();
    } else if (_npcgMode === 'linked') {
      opts.anchorChar = _npcgAllChars.find(c => c.id === _npcgAnchorId) || null;
    }

    // 拉取当前完整的角色档案 + 世界书条目，让 AI 生成前先“读一遍设定集”，
    // 保证新角色不重名、不撞设定，并尽量与已确立的世界观自然联动
    const [allCharsForCtx, allEntriesForCtx] = await Promise.all([
      _npcgAllChars.length ? Promise.resolve(_npcgAllChars) : getAllChars(),
      getAllWbEntries(),
    ]);
    opts.worldContext = npcgBuildWorldContext(
      allCharsForCtx,
      allEntriesForCtx,
      opts.anchorChar ? opts.anchorChar.id : null
    );

    const [result, friendCode] = await Promise.all([
      generateNPC(opts),
      generateUniqueFriendCode(),
    ]);

    // 至少让扫描动画播放一小段时间，避免闪一下就过去
    await npcgWaitAtLeast(1400);

    _npcgResult = result;
    _npcgFriendCode = friendCode;
    npcgStopScanAnim();
    npcgRenderCard(result, friendCode);
    npcgShowPanel('npcgPanelCard');
  } catch (err) {
    npcgStopScanAnim();
    npcgShowPanel('npcgPanelSetup');
    npcgShowSetupError(err.message || '生成失败，请重试');
  } finally {
    genBtn.disabled = false;
  }
}

function npcgWaitAtLeast(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function npcgRegenerate() {
  const card = document.getElementById('npcgCard');
  card.classList.remove('flipped');
  document.getElementById('npcgAvatar').classList.remove('revealed');
  document.getElementById('npcgRelationPill').classList.remove('show');
  document.getElementById('npcgFlipHint').classList.remove('show');
  document.getElementById('npcgSuccessBadge').classList.remove('show');
  document.getElementById('npcgAddBtn').disabled = true;
  await npcgStartGenerate();
}

/* ================================================================
   9. 卡片渲染（模糊 → 打字机揭晓）
================================================================ */
function npcgRenderCard(result, friendCode) {
  const { charFields } = result;
  const name = charFields.name || '未知的人';
  const letter = name[0]?.toUpperCase() || '?';

  const avatarEl = document.getElementById('npcgAvatar');
  avatarEl.textContent = letter;
  avatarEl.classList.remove('revealed');

  document.getElementById('npcgIdTag').textContent = '#' + friendCode.replace('LUNA-', '');
  document.getElementById('npcgRelationPill').textContent = charFields.relation || charFields.role || '新的关系';
  document.getElementById('npcgRelationPill').classList.remove('show');
  document.getElementById('npcgSignature').textContent = '';
  document.getElementById('npcgFlipHint').classList.remove('show');
  document.getElementById('npcgSuccessBadge').classList.remove('show');
  document.getElementById('npcgAddBtn').disabled = true;
  npcgRenderBarcode(friendCode);

  const nameEl = document.getElementById('npcgName');
  nameEl.innerHTML = '';

  // 揭晓时序：头像模糊转清晰 → 名字打字机 → 关系标签淡入 → 签名淡入 → 翻转提示
  setTimeout(() => avatarEl.classList.add('revealed'), 150);

  setTimeout(() => {
    npcgTypewriterName(nameEl, name, () => {
      document.getElementById('npcgRelationPill').classList.add('show');
      setTimeout(() => {
        npcgTypewriterSignature(charFields.matchSignature || '一段尚未命名的缘分');
      }, 200);
      setTimeout(() => {
        document.getElementById('npcgFlipHint').classList.add('show');
        document.getElementById('npcgAddBtn').disabled = false;
      }, 900);
    });
  }, 700);

  npcgRenderBack(result);
}

/* 用好友码本身作为随机种子，生成一条视觉用的伪条形码（纯装饰，不承担校验功能） */
function npcgRenderBarcode(friendCode) {
  const el = document.getElementById('npcgBarcode');
  if (!el) return;
  const codeChars = friendCode.replace(/[^A-Z0-9]/g, '');
  let seed = 0;
  for (let i = 0; i < codeChars.length; i++) seed = (seed * 31 + codeChars.charCodeAt(i)) % 100000;
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const bars = 34;
  let html = '';
  for (let i = 0; i < bars; i++) {
    const w = 1 + Math.floor(rand() * 2);
    const h = 8 + Math.floor(rand() * 14);
    html += `<span style="width:${w}px;height:${h}px;"></span>`;
  }
  el.innerHTML = html;
}

function npcgTypewriterName(el, text, onDone) {
  el.innerHTML = '';
  const chars = Array.from(text);
  chars.forEach((ch, i) => {
    const span = document.createElement('span');
    span.className = 'npcg-tw-char';
    span.textContent = ch;
    span.style.animationDelay = (i * 0.045) + 's';
    el.appendChild(span);
  });
  const totalMs = chars.length * 45 + 260;
  setTimeout(() => { if (onDone) onDone(); }, totalMs);
}

function npcgTypewriterSignature(text) {
  const el = document.getElementById('npcgSignature');
  el.textContent = '';
  let i = 0;
  const chars = Array.from(text);
  const timer = setInterval(() => {
    el.textContent = chars.slice(0, i + 1).join('');
    i++;
    if (i >= chars.length) clearInterval(timer);
  }, 32);
}

function npcgRenderBack(result) {
  const { charFields, worldbookEntries } = result;
  const scroll = document.getElementById('npcgBackScroll');

  const fieldRows = [
    ['姓名',       'npcgFName',   charFields.name, 'input'],
    ['身份',       'npcgFRole',   charFields.role, 'input'],
    ['简介',       'npcgFDesc',   charFields.desc, 'textarea'],
    ['性格标签',    'npcgFTraits', (charFields.traits || []).join(', '), 'input'],
    ['外貌',       'npcgFAppearance', charFields.appearance, 'textarea'],
    ['说话方式',    'npcgFSpeech', charFields.speechStyle, 'textarea'],
    ['背景故事',    'npcgFBackstory', charFields.backstory, 'textarea'],
    ['与你的关系',  'npcgFRelation', charFields.relation, 'input'],
    ['TA怎么称呼你', 'npcgFCallUser', charFields.callUser, 'input'],
    ['开场白',     'npcgFFirstMes', charFields.firstMes, 'textarea'],
  ];

  let html = fieldRows.map(([label, id, val, type]) => {
    if (type === 'textarea') {
      return `<div class="npcg-field">
        <div class="npcg-field-label">${label}</div>
        <textarea class="npcg-field-textarea" id="${id}">${npcgEsc(val || '')}</textarea>
      </div>`;
    }
    return `<div class="npcg-field">
      <div class="npcg-field-label">${label}</div>
      <input class="npcg-field-input" id="${id}" value="${npcgEsc(val || '')}"/>
    </div>`;
  }).join('');

  if ((worldbookEntries || []).length) {
    html += `<div class="npcg-field">
      <div class="npcg-field-label">配套世界书条目（${worldbookEntries.length}）</div>
      <div class="npcg-wb-list">
        ${worldbookEntries.map(e => `
          <div class="npcg-wb-item">
            <div class="npcg-wb-item-head">
              <div class="npcg-wb-item-title">${npcgEsc(e.title || '未命名条目')}</div>
              <div class="npcg-wb-item-mode">${e.mode === 'constant' ? '常驻' : '触发'}</div>
            </div>
            <div class="npcg-wb-item-detail">${npcgEsc((e.detail || '').slice(0, 80))}${(e.detail || '').length > 80 ? '…' : ''}</div>
          </div>
        `).join('')}
      </div>
    </div>`;
  }

  scroll.innerHTML = html;
}

function npcgFlipToBack() {
  document.getElementById('npcgCard').classList.add('flipped');
}
function npcgFlipToFront() {
  document.getElementById('npcgCard').classList.remove('flipped');
}

/* ================================================================
   10. 确认保存
================================================================ */
async function npcgConfirmSave() {
  if (_npcgSaving || !_npcgResult) return;
  _npcgSaving = true;

  const confirmBtn = document.getElementById('npcgConfirmBtn');
  const originalText = confirmBtn.textContent;
  confirmBtn.disabled = true;
  confirmBtn.textContent = '保存中…';

  try {
    // 把背面编辑框里的内容写回，允许用户在确认前修改
    const charFields = { ..._npcgResult.charFields };
    const getVal = id => document.getElementById(id)?.value ?? '';
    charFields.name           = getVal('npcgFName')       || charFields.name;
    charFields.role           = getVal('npcgFRole')        || charFields.role;
    charFields.desc           = getVal('npcgFDesc')        || charFields.desc;
    charFields.traits         = getVal('npcgFTraits').split(',').map(s => s.trim()).filter(Boolean);
    charFields.appearance     = getVal('npcgFAppearance')  || charFields.appearance;
    charFields.speechStyle    = getVal('npcgFSpeech')      || charFields.speechStyle;
    charFields.backstory      = getVal('npcgFBackstory')   || charFields.backstory;
    charFields.relation       = getVal('npcgFRelation')    || charFields.relation;
    charFields.callUser       = getVal('npcgFCallUser')    || charFields.callUser;
    charFields.firstMes       = getVal('npcgFFirstMes')    || charFields.firstMes;

    const { charId } = await commitNPC(charFields, _npcgResult.worldbookEntries, _npcgFriendCode);
    _npcgSavedCharId = charId;

    document.getElementById('npcgSuccessBadge').classList.add('show');
    npcgFlipToFront();
    npcgToast(`已生成好友码 ${_npcgFriendCode}，去「聊天」页输入即可添加`);

    confirmBtn.textContent = '已保存';
    document.getElementById('npcgRegenBtn').textContent = '再生成一个';
    document.getElementById('npcgAddBtn').textContent = '已保存 · 查看好友码';
    document.getElementById('npcgAddBtn').onclick = () => npcgFlipToBack();

  } catch (err) {
    npcgToast(err.message || '保存失败，请重试', true);
    confirmBtn.disabled = false;
    confirmBtn.textContent = originalText;
  } finally {
    _npcgSaving = false;
  }
}

/* ================================================================
   11. Toast
================================================================ */
let _npcgToastTimer = null;
function npcgToast(msg, isError) {
  const el = document.getElementById('npcgToast');
  el.textContent = msg;
  el.classList.toggle('error', !!isError);
  el.classList.add('show');
  clearTimeout(_npcgToastTimer);
  _npcgToastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

/* ================================================================
   12. 初始化
================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  updateTime();
  updateBattery();
  applyIsland();
  setInterval(updateTime, 1000);
});