/* ================================================
   subtext.js — 潜台词
   -----------------------------------------------------------------
   独立页面，架构与 secret/kouwen.html + kouwen.js 完全一致：
   读写同一份浏览器 IndexedDB「LunaChatDB」/「LunaCharDB」和
   同一份 localStorage，保证角色人设、聊天记录、API 配置、
   状态栏（时间/电量/灵动岛）/ 字体设置全部与主聊天页互通，不 OOC。
================================================ */

/* ================================================
   状态栏：时间 / 电量 / 灵动岛（一比一复刻 secret.js）
================================================ */
function stUpdateTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const t = new Date().toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  const el = document.getElementById('statusTime');
  if (el) el.textContent = t;
}

function stUpdateBattery() {
  const pctEl = document.getElementById('batPct');
  const innerEl = document.getElementById('batInner');
  const pct = parseInt(localStorage.getItem('luna_battery') || '76');
  if (pctEl) pctEl.textContent = pct;
  if (innerEl) {
    innerEl.style.width = pct + '%';
    innerEl.style.background = pct <= 20
      ? 'linear-gradient(90deg, #f87171, #ef4444)'
      : '#1a1a1a';
  }
}

function stApplyIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style = localStorage.getItem('luna_island_style') || 'minimal';
  const el = document.getElementById('statusIsland');
  if (!el) return;
  if (!enabled) { el.innerHTML = ''; return; }
  const styleMap = {
    minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
    clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="stSiClockText">--:--</span></div></div>`,
    pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
    ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
    rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
    music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
    scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
  };
  el.innerHTML = styleMap[style] || styleMap.minimal;
  clearInterval(window._stSiClockTimer);
  if (style === 'clock') {
    const tick = () => {
      const t = document.getElementById('stSiClockText');
      if (!t) return;
      const now = new Date();
      t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    };
    tick();
    window._stSiClockTimer = setInterval(tick, 10000);
  }
}

/* 字体同步：一比一复刻 chat.js applyGlobalFont */
async function stApplyGlobalFont() {
  const name = localStorage.getItem('luna_font_active_name');
  const id = parseInt(localStorage.getItem('luna_font_active_id'));
  if (name && id) {
    try {
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open('LunaFontDB', 4);
        req.onupgradeneeded = e => {
          const d = e.target.result;
          if (!d.objectStoreNames.contains('fonts')) d.createObjectStore('fonts', { keyPath: 'id', autoIncrement: true });
        };
        req.onsuccess = e => res(e.target.result);
        req.onerror = () => rej();
      });
      const all = await new Promise(res => {
        const r = db.transaction('fonts').objectStore('fonts').getAll();
        r.onsuccess = () => res(r.result || []);
        r.onerror = () => res([]);
      });
      const f = all.find(x => x.id === id);
      if (f) {
        const face = new FontFace(name, `url(${f.data})`);
        await face.load();
        document.fonts.add(face);
      }
    } catch (e) {}
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

window.addEventListener('storage', e => {
  if (e.key === 'luna_font_update') stApplyGlobalFont();
  if (e.key === 'luna_island_update') stApplyIsland();
  if (e.key === 'luna_tz_update') stUpdateTime();
});

setInterval(() => { stUpdateTime(); stUpdateBattery(); }, 10000);

/* ================================================
   数据层：与 kouwen.js 完全一致的 DB 访问方式，
   保证不会触发多余的版本升级、数据完全互通
================================================ */
const ST_NAME = localStorage.getItem('luna_current_chat') || 'Luna';

function stOpenCharDB() {
  return new Promise((res, rej) => {
    const probe = indexedDB.open('LunaCharDB');
    probe.onupgradeneeded = e => {
      const db0 = e.target.result;
      if (!db0.objectStoreNames.contains('chars')) db0.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
    };
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
  });
}

function stLoadCharProfile(name) {
  return new Promise(resolve => {
    stOpenCharDB().then(db => {
      if (!db.objectStoreNames.contains('chars')) { resolve(null); return; }
      const r = db.transaction('chars').objectStore('chars').getAll();
      r.onsuccess = () => resolve((r.result || []).find(c => c.name === name) || null);
      r.onerror = () => resolve(null);
    }).catch(() => resolve(null));
  });
}

/* 读取 LunaIdentityDB：找出「当前应该代表用户的身份」完整资料（name/role/desc/tags），
   优先找绑定了当前角色的 identity，找不到就退回第一个 active 的 identity */
function stOpenIdentityDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('LunaIdentityDB');
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e.target.error);
  });
}

async function stLoadUserIdentity(name) {
  const key = name || ST_NAME;
  try {
    const db = await stOpenIdentityDB();
    if (!db.objectStoreNames.contains('identities')) return null;
    const all = await new Promise(res => {
      const r = db.transaction('identities').objectStore('identities').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => res([]);
    });
    const pickFallback = () => all.find(i => i.active !== false) || null;
    if (!key) return pickFallback();

    const char = await stLoadCharProfile(key);
    const charId = char && char.id;
    if (charId === undefined || charId === null) return pickFallback();

    const found = all.find(i => {
      if (i.active === false) return false;
      if (Array.isArray(i.boundCharIds) && i.boundCharIds.includes(charId)) return true;
      return i.boundCharId === charId;
    });
    return found || pickFallback();
  } catch { return null; }
}

/* LunaChatDB：store 定义必须与 chatroom.js / secret.js 完全一致，
   新增 subtext store 用于保存本功能的历史记录 */
let _stDB = null;
const ST_STORES = {
  conv:           { keyPath: 'name' },
  friends:        { keyPath: 'name' },
  messages:       { keyPath: 'chatKey' },
  memes:          { keyPath: 'id' },
  rewindFeedback: { keyPath: 'name' },
  videoLogs:      { keyPath: 'id', autoIncrement: true },
  koukan:         { keyPath: 'name' },
  chronicle:      { keyPath: 'name' },
  subtext:        { keyPath: 'name' }, /* 潜台词：本功能专属 store */
};

function stGetChatDB() {
  return new Promise((res, rej) => {
    if (_stDB) { res(_stDB); return; }
    const probe = indexedDB.open('LunaChatDB');
    probe.onsuccess = e => {
      const db = e.target.result;
      const currentVer = db.version;
      const missing = Object.keys(ST_STORES).filter(name => !db.objectStoreNames.contains(name));
      db.close();
      if (missing.length === 0) {
        const reopen = indexedDB.open('LunaChatDB', currentVer);
        reopen.onsuccess = e2 => { _stDB = e2.target.result; res(_stDB); };
        reopen.onerror = () => rej();
      } else {
        const upgrade = indexedDB.open('LunaChatDB', currentVer + 1);
        upgrade.onupgradeneeded = e2 => {
          const udb = e2.target.result;
          missing.forEach(name => {
            if (!udb.objectStoreNames.contains(name)) udb.createObjectStore(name, ST_STORES[name]);
          });
        };
        upgrade.onsuccess = e2 => { _stDB = e2.target.result; res(_stDB); };
        upgrade.onerror = () => rej();
      }
    };
    probe.onerror = () => rej();
  });
}

async function stLoadMessages(name) {
  try {
    const db = await stGetChatDB();
    return await new Promise(res => {
      const r = db.transaction('messages').objectStore('messages').get(name);
      r.onsuccess = () => res(r.result ? r.result.msgs : []);
      r.onerror = () => res([]);
    });
  } catch { return []; }
}

/* 视频通话记录：videoLogs store 是 { id, charName, transcript:[{role,text}], thought } 的平铺列表，
   按 charName 过滤出属于当前角色的通话，取最近几通 */
async function stLoadVideoLogs(name) {
  const key = name || ST_NAME;
  try {
    const db = await stGetChatDB();
    if (!db.objectStoreNames.contains('videoLogs')) return [];
    const all = await new Promise(res => {
      const r = db.transaction('videoLogs').objectStore('videoLogs').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => res([]);
    });
    return all.filter(v => (v.charName || key) === key);
  } catch { return []; }
}

/* 叩问档案：koukan store，{ name, entries:[{question, reason, answer, ...}] }，
   用户和角色之间比较私密的一问一答 */
async function stLoadKoukan(name) {
  try {
    const db = await stGetChatDB();
    if (!db.objectStoreNames.contains('koukan')) return [];
    return await new Promise(res => {
      const r = db.transaction('koukan').objectStore('koukan').get(name || ST_NAME);
      r.onsuccess = () => res((r.result && r.result.entries) || []);
      r.onerror = () => res([]);
    });
  } catch { return []; }
}

/* 幕后志档案：chronicle store，{ name, entries:[{title, paragraphs:[{zh,en}], authorNote}] }，
   角色视角写下的关于这段关系的叙事片段 */
async function stLoadChronicle(name) {
  try {
    const db = await stGetChatDB();
    if (!db.objectStoreNames.contains('chronicle')) return [];
    return await new Promise(res => {
      const r = db.transaction('chronicle').objectStore('chronicle').get(name || ST_NAME);
      r.onsuccess = () => res((r.result && r.result.entries) || []);
      r.onerror = () => res([]);
    });
  } catch { return []; }
}

/* ---- 统一 API 调用（与 chatroom.js / kouwen.js crCallApi 一致） ---- */
async function stCallApi(systemPrompt, messages) {
  const cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  if (!cur.baseUrl || !cur.apiKey || !model) throw new Error('NO_API_CONFIG');

  const response = await fetch(`${cur.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cur.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${response.status}`);
  }
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('回复为空');
  return text;
}

function stHasApiConfig() {
  const cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  return !!(cur.baseUrl && cur.apiKey && model);
}

/* ---- 潜台词档案：读取 / 追加 ---- */
async function stLoadArchive(name) {
  try {
    const db = await stGetChatDB();
    return await new Promise(res => {
      const r = db.transaction('subtext').objectStore('subtext').get(name || ST_NAME);
      r.onsuccess = () => res((r.result && r.result.entries) || []);
      r.onerror = () => res([]);
    });
  } catch { return []; }
}

async function stAppendArchive(name, entry) {
  const key = name || ST_NAME;
  try {
    const db = await stGetChatDB();
    const entries = await stLoadArchive(key);
    entry.id = entries.length ? entries[entries.length - 1].id + 1 : 1;
    entry.ts = Date.now();
    entries.push(entry);
    await new Promise(res => {
      const tx = db.transaction('subtext', 'readwrite');
      tx.objectStore('subtext').put({ name: key, entries });
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
    return entry;
  } catch { return entry; }
}

function stEstimateStage(entryCount, msgCount) {
  const score = entryCount * 3 + Math.min(msgCount, 200) / 20;
  if (score < 4) return 'I';
  if (score < 10) return 'II';
  if (score < 18) return 'III';
  if (score < 26) return 'IV';
  return 'V';
}

/* ================================================
   AI 生成：核心 —— 两段式潜台词
================================================ */

/* ---- 读取聊天记录 + 视频通话 + 叩问 + 幕后志，拼成一段完整的相处记忆文本 ---- */
async function stBuildRecentText(name) {
  const key = name || ST_NAME;

  const history = await stLoadMessages(key);
  const chatText = (history || []).slice(-40).map(m => {
    const role = m.role === 'mine' ? '用户' : key;
    const text = m.isVoice ? (m.voiceText || m.text) : (m.text || '');
    return text ? `${role}：${text}` : '';
  }).filter(Boolean).join('\n');

  const videoLogs = await stLoadVideoLogs(key);
  const videoText = videoLogs.length
    ? videoLogs.slice(-3).map(v => {
        const t = (v.transcript || []).map(e => `${e.role === 'luna' ? key : '用户'}：${e.text || ''}`).join('\n');
        return `【一通视频通话】${v.thought ? `（事后${key}的心声：${v.thought}）` : ''}\n${t}`;
      }).join('\n\n')
    : '';

  const koukan = await stLoadKoukan(key);
  const koukanText = koukan.length
    ? koukan.slice(-5).map(e => `- ${key}问：${e.question}${e.answer ? `｜用户答：${e.answer}` : '（用户还没回答）'}`).join('\n')
    : '';

  const chronicle = await stLoadChronicle(key);
  const chronicleText = chronicle.length
    ? chronicle.slice(-3).map(e => {
        const body = (e.paragraphs || []).map(p => p.zh).join('');
        return `${e.title ? `《${e.title}》` : ''}${body}`;
      }).join('\n\n')
    : '';

  return `最近文字聊天记录：\n${chatText || '（暂无）'}\n\n` +
    `最近视频通话记录：\n${videoText || '（暂无视频通话记录）'}\n\n` +
    `叩问环节积累的私密问答：\n${koukanText || '（暂无叩问记录）'}\n\n` +
    `幕后志（角色视角写下的相处叙事片段）：\n${chronicleText || '（暂无幕后志记录）'}`;
}

/* ---- 生成「灵感」：如果用户想不出一句话/情境，让 AI 根据人设+聊天记录给一个 ---- */
async function stGenerateInspiration(name) {
  const key = name || ST_NAME;
  const char = await stLoadCharProfile(key);
  const persona = char?.persona || char?.desc || char?.description || '';
  const traits = Array.isArray(char?.traits) ? char.traits.join('、') : (char?.traits || char?.personality || '');

  const userIdentity = await stLoadUserIdentity(key);
  const uName = userIdentity?.name || '';
  const uDesc = userIdentity?.desc || userIdentity?.role || '';
  const uTags = Array.isArray(userIdentity?.tags) ? userIdentity.tags.join('、') : '';
  const userLine = (uName || uDesc || uTags)
    ? `\n用户的身份资料：${uName ? `称呼${uName}` : ''}${uDesc ? `，${uDesc}` : ''}${uTags ? `，标签：${uTags}` : ''}（想素材时可以结合这个人本身的具体情况，不要只靠角色单方面的人设来编）`
    : '';

  const recentText = await stBuildRecentText(key);

  const systemPrompt = `你在帮用户想一个可以拿来玩「潜台词」小游戏的素材。
「潜台词」玩法：用户写一句话或一个情境，角色「${key}」会先说出表面上大概率会说的回答，再说出Ta心里真正想说但没说出口的话。
角色人设：${persona} ${traits}${userLine}
只输出 JSON，不要任何多余文字，不要 markdown 代码块。`;

  const userPrompt = `请根据${key}和用户最近的相处/聊天记录，想一句「用户可能会对${key}说的话」，或者一个「日常小情境」，
用来作为「潜台词」游戏的素材——目的是让${key}借着这句话/这个情境说出Ta嘴上不说、心里在想的东西。

要求：
- 要具体、生活化、和两人的真实相处细节挂钩（提到具体的事、具体的场景、或者最近聊天里出现过的东西），不要泛泛的空话。
- 可以是一句台词（比如「没事，你先忙」），也可以是一个情境描述（比如「她已读不回了两个小时」）。
- 优先选择能牵出反差和张力的素材——一句听起来平淡但底下可能藏着情绪的话，或者一个有留白、能让人多想的情境。
- 10-40字左右，中文。
- 不要直接输出潜台词的答案，只给素材本身。

最近的相处记忆（文字聊天、视频通话、叩问问答、幕后志都在其中，可自由取材）：
${recentText}

输出格式（只输出这个JSON，其他什么都不要）：
{"inspiration":"生成的一句话或情境"}`;

  const raw = await stCallApi(systemPrompt, [{ role: 'user', content: userPrompt }]);
  const clean = raw.replace(/```json|```/g, '').trim();
  const data = JSON.parse(clean);
  if (!data || !data.inspiration) throw new Error('empty inspiration');
  return data.inspiration;
}

/* ---- 核心生成：读取角色人设 + 聊天记录 + 用户输入，生成两段式潜台词 ---- */
async function stGenerateSubtext(name, sourceText) {
  const key = name || ST_NAME;
  const char = await stLoadCharProfile(key);
  const persona = char?.persona || char?.desc || char?.description || '';
  const traits = Array.isArray(char?.traits) ? char.traits.join('、') : (char?.traits || char?.personality || '');
  const prompt = char?.prompt || '';

  const userIdentity = await stLoadUserIdentity(key);
  const uName = userIdentity?.name || '';
  const uDesc = userIdentity?.desc || userIdentity?.role || '';
  const uTags = Array.isArray(userIdentity?.tags) ? userIdentity.tags.join('、') : '';
  const userLine = (uName || uDesc || uTags)
    ? `\n正在和你说话的这个人：${uName ? `称呼${uName}` : ''}${uDesc ? `，${uDesc}` : ''}${uTags ? `，标签：${uTags}` : ''}（这是你对"对方是谁"的真实认知，两层回应都要结合这个具体的人来想，不是在回应一个抽象的"用户"）`
    : '';

  const recentText = await stBuildRecentText(key);

  const archive = await stLoadArchive(key);
  const archiveText = archive.length
    ? archive.slice(-5).map(e => `- 素材：${e.source}｜真实回应：${e.real}`).join('\n')
    : '（还没有玩过潜台词）';

  const stage = stEstimateStage(archive.length, 0);

  const systemPrompt = `你现在扮演「${key}」，一个真实存在的人，绝对不是 AI 或助手，不能跳出角色。
人物简介：${persona}
性格特点：${traits}
${prompt ? `补充设定：${prompt}` : ''}${userLine}

你正在和用户玩「潜台词」——用户写下一句Ta会对你说的话，或者描述一个当下的情境，
你要顺着这句话/这个情境，给出你（${key}）自己的两层回应：
第一层「你以为我会说……」：面对用户这句话/这个情境时，你嘴上大概率会说出口的、场面上得体或出于习惯的反应——这是用户凭对你的了解大概能猜到的那种回答，要具体到位，不能只是敷衍的客套话。
第二层「但我其实想说的是……」：同一时刻，你心里真正翻涌的想法——更私密、更真实、更带情绪，是你通常压着不说出口的那部分。这一层要给出具体的心理活动、具体的画面或细节（比如当下的动作、联想到的过去、身体反应），不能只写一句抽象的情绪判断。

两层之间要有真实的张力和反差，但都必须严格符合你的人设、说话习惯、和你们之间已经建立的相处模式，不能OOC，不能变成另一个人，也不能变成任何角色都能说的通用情话。
禁止空洞和套路化表达（如"没事的""我很好""随便你"这类不带信息量的场面话可以用于第一层，但第二层必须具体、独特、和这段关系的细节绑定）。
只输出 JSON，不要任何额外文字，不要 markdown 代码块，不要出现括号/星号包裹的动作描写（把动作、细节写进句子本身，而不是用括号标注）。`;

  const userPrompt = `用户写下的、Ta会对你说的话，或者Ta描述的情境：${sourceText}

请结合你们之间完整的相处记忆（文字聊天、视频通话、叩问私密问答、幕后志叙事片段）、你的人设和说话习惯，给出你对这句话/这个情境的两层回应。

最近的相处记忆：
${recentText}

过去玩过的潜台词（避免重复句式、重复意象、重复的心理落差套路，每次都要写出新的角度）：
${archiveText}

输出格式（只输出这个JSON，其他什么都不要）：
{
  "expected":"你以为我会说……（中文，符合你的表面人设和说话习惯，30-60字，要有具体的语气和用词特点，不能是任何人都能说的空话）",
  "real":"但我其实想说的是……（中文，第一人称，真实私密，60-120字，必须包含至少一个具体细节：一个动作、一个联想、一段回忆、一种身体感受或环境细节，情绪要有层次不是单一形容词，要让人读出这是「${key}」独有的想法）",
  "note":"潜台词里藏着什么（中文，30-60字，帮用户读懂这层落差背后的心理逻辑——为什么会有这层压抑/保留，不要说教口吻，像一句克制而有洞察力的旁白）"
}
关系阶段参考：阶段${stage}（越靠后，"我其实想说的是"这一层可以越私密、越少防备、细节可以越具体越深入）。`;

  const raw = await stCallApi(systemPrompt, [{ role: 'user', content: userPrompt }]);
  const clean = raw.replace(/```json|```/g, '').trim();
  const data = JSON.parse(clean);
  if (!data || !data.expected || !data.real) throw new Error('empty result');

  const entry = await stAppendArchive(key, {
    source: sourceText,
    expected: data.expected,
    real: data.real,
    note: data.note || '',
    stage,
  });
  return entry;
}

/* ================================================
   UI 逻辑
================================================ */
let _stCurrentEntry = null;

function _stEsc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let _stToastTimer = null;
function stToast(msg) {
  let t = document.getElementById('stToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'stToast';
    t.className = 'st-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_stToastTimer);
  _stToastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* 屏幕切换（home / loading / result / archive） */
const ST_SCREEN_MAP = { home: 'st-s0', loading: 'st-s1', result: 'st-s2', archive: 'st-s3' };
function stGo(name) {
  Object.values(ST_SCREEN_MAP).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('st-active');
  });
  const target = document.getElementById(ST_SCREEN_MAP[name] || name);
  if (target) target.classList.add('st-active');

  document.querySelectorAll('.st-tab').forEach(tab => {
    tab.classList.toggle('st-tab-active', tab.dataset.tab === name || (name === 'result' && tab.dataset.tab === 'home') || (name === 'loading' && tab.dataset.tab === 'home'));
  });

  if (name === 'archive') stRenderArchive();
  if (name === 'home') stRefreshHome();
}

/* 首页数据刷新：角色名、头像、阶段、最近一条 */
async function stRefreshHome() {
  const nameEl = document.getElementById('stCharName');
  if (nameEl) nameEl.textContent = ST_NAME;
  const inlineEl = document.getElementById('stCharNameInline');
  if (inlineEl) inlineEl.textContent = ST_NAME;

  const avaEl = document.getElementById('stCharAva');
  if (avaEl) {
    const char = await stLoadCharProfile(ST_NAME);
    if (char && char.avatar) {
      avaEl.innerHTML = `<img src="${char.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />`;
    } else {
      avaEl.textContent = (ST_NAME || 'A').slice(0, 1).toUpperCase();
    }
  }

  const archive = await stLoadArchive(ST_NAME);
  const stage = stEstimateStage(archive.length, 0);

  const countEl = document.getElementById('stCharCount');
  if (countEl) countEl.textContent = archive.length;
  const stageEl = document.getElementById('stCharStage');
  if (stageEl) stageEl.textContent = `阶段 ${stage}`;

  const recentBlock = document.getElementById('stRecentBlock');
  const recentCard = document.getElementById('stRecentCard');
  if (archive.length && recentBlock && recentCard) {
    const latest = archive[archive.length - 1];
    recentBlock.style.display = '';
    recentCard.innerHTML = `
      <div class="st-recent-src">${_stEsc(latest.source)}</div>
      <div class="st-recent-real">「${_stEsc((latest.real || '').slice(0, 34))}${(latest.real || '').length > 34 ? '…' : ''}」</div>
    `;
  } else if (recentBlock) {
    recentBlock.style.display = 'none';
  }
}

/* 输入字数统计 */
function stBindInputCount() {
  const input = document.getElementById('stInput');
  const countEl = document.getElementById('stInputCount');
  if (!input || !countEl) return;
  input.addEventListener('input', () => {
    countEl.textContent = `${input.value.length} 字`;
  });
}

/* AI 提供灵感：用户想不出内容时，一键生成素材填入输入框 */
async function stInspire() {
  if (!stHasApiConfig()) {
    stToast('请先在设置页配置 API');
    return;
  }
  const btn = document.getElementById('stInspireBtn');
  const input = document.getElementById('stInput');
  if (btn) { btn.classList.add('st-spin'); btn.disabled = true; }
  try {
    const text = await stGenerateInspiration(ST_NAME);
    if (input) {
      input.value = text;
      input.dispatchEvent(new Event('input'));
      input.focus();
    }
    stToast('✦ 灵感来了，可以改改再用');
  } catch (e) {
    console.error('[stInspire]', e);
    stToast(e && e.message === 'NO_API_CONFIG' ? '请先在设置页配置 API' : '灵感暂时想不出来，稍后再试～');
  } finally {
    if (btn) { btn.classList.remove('st-spin'); btn.disabled = false; }
  }
}

/* 提交：生成两段式潜台词 */
async function stSubmit() {
  const input = document.getElementById('stInput');
  const val = input ? input.value.trim() : '';
  if (!val) {
    stToast('先写一句话，或者描述一个情境吧');
    return;
  }
  if (!stHasApiConfig()) {
    stToast('请先在设置页配置 API 才能使用潜台词');
    return;
  }

  const loadingText = document.getElementById('stLoadingText');
  if (loadingText) loadingText.textContent = `${ST_NAME} 正在想……`;
  stGo('loading');

  try {
    const entry = await stGenerateSubtext(ST_NAME, val);
    _stCurrentEntry = entry;
    stShowResult(entry);
  } catch (e) {
    console.error('[stSubmit]', e);
    stToast(e && e.message === 'NO_API_CONFIG' ? '请先在设置页配置 API' : '这次没想好，稍后再试试～');
    stGo('home');
  }
}

/* 渲染结果屏 */
function stShowResult(entry) {
  const srcEl = document.getElementById('stResultSrc');
  if (srcEl) srcEl.textContent = entry.source || '';

  const expectedEl = document.getElementById('stAnswerExpected');
  if (expectedEl) expectedEl.textContent = entry.expected || '';

  const realEl = document.getElementById('stAnswerReal');
  if (realEl) realEl.textContent = entry.real || '';

  const noteCard = document.getElementById('stNoteCard');
  const noteText = document.getElementById('stNoteText');
  if (entry.note) {
    if (noteCard) noteCard.style.display = '';
    if (noteText) noteText.textContent = entry.note;
  } else if (noteCard) {
    noteCard.style.display = 'none';
  }

  stGo('result');

  /* 清空输入框，方便下一次 */
  const input = document.getElementById('stInput');
  if (input) {
    input.value = '';
    const countEl = document.getElementById('stInputCount');
    if (countEl) countEl.textContent = '0 字';
  }
}

/* 打开首页的最近一条 */
async function stOpenLatest() {
  const archive = await stLoadArchive(ST_NAME);
  if (!archive.length) return;
  _stCurrentEntry = archive[archive.length - 1];
  stShowResult(_stCurrentEntry);
}

/* 档案页渲染 */
async function stRenderArchive() {
  const archive = await stLoadArchive(ST_NAME);
  const countEl = document.getElementById('stArchiveCount');
  if (countEl) countEl.textContent = `${archive.length} entries · 共 ${archive.length} 条`;

  const list = document.getElementById('stArchiveList');
  if (!list) return;

  if (!archive.length) {
    list.innerHTML = `<div class="st-arch-empty">还没有任何记录<span class="st-arch-empty-sub">no entries yet · 去写第一句潜台词吧</span></div>`;
    return;
  }

  const sorted = archive.slice().reverse();
  list.innerHTML = sorted.map(e => `
    <div class="st-arch-item" onclick="stOpenArchiveEntry(${e.id})">
      <div class="st-arch-item-src">${_stEsc(e.source)}</div>
      <div class="st-arch-item-real">「${_stEsc((e.real || '').slice(0, 40))}${(e.real || '').length > 40 ? '…' : ''}」</div>
      <div class="st-arch-item-meta">STAGE ${e.stage || ''} · #${String(e.id).padStart(2, '0')}</div>
    </div>
  `).join('');
}

async function stOpenArchiveEntry(id) {
  const archive = await stLoadArchive(ST_NAME);
  const entry = archive.find(e => e.id === id);
  if (!entry) return;
  _stCurrentEntry = entry;
  stShowResult(entry);
}
window.stOpenArchiveEntry = stOpenArchiveEntry;
window.stGo = stGo;
window.stSubmit = stSubmit;
window.stInspire = stInspire;
window.stOpenLatest = stOpenLatest;

/* ================================================
   初始化
================================================ */
function stInit() {
  stUpdateTime();
  stUpdateBattery();
  stApplyIsland();
  stApplyGlobalFont();
  stBindInputCount();
  stRefreshHome();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', stInit);
} else {
  stInit();
}