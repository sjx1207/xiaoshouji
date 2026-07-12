/* ================================================================
   secret/parallel.js — 「异轨 · Parallel」
   -----------------------------------------------------------------
   独立页面，和 secret.html / kouwen.html / chronicle.html 同级、
   同架构：不共享 JS 运行时，但读写同一份浏览器 IndexedDB
   「LunaCharDB」「LunaChatDB」和同一份 localStorage，
   数据与人设完全互通。
================================================================ */

const PY_NAME = localStorage.getItem('luna_current_chat') || 'Luna';

/* ================================================================
   状态栏 / 灵动岛 / 字体 —— 与 secret.js / kouwen.js 完全一比一复刻
================================================================ */
function pyUpdateTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeStr = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const el = document.getElementById('pyStatusTime');
  if (el) el.textContent = timeStr;
}

function pySyncBattery() {
  const pctEl   = document.getElementById('pyBatPct');
  const innerEl = document.getElementById('pyBatInner');
  const pct = parseInt(localStorage.getItem('luna_battery') || '76');
  if (pctEl) pctEl.textContent = pct;
  if (innerEl) {
    innerEl.style.width = pct + '%';
    innerEl.style.background = pct <= 20
      ? 'linear-gradient(90deg, #f87171, #ef4444)'
      : '#1a1a1a';
  }
}

function pySyncIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const el      = document.getElementById('pyStatusIsland');
  if (!el) return;
  if (!enabled) { el.innerHTML = ''; return; }
  const styleMap = {
    minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
    clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="pySiClockText">--:--</span></div></div>`,
    pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
    ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
    rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
    music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
    scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
  };
  el.innerHTML = styleMap[style] || styleMap.minimal;
  if (style === 'clock') {
    const tick = () => {
      const t = document.getElementById('pySiClockText');
      if (!t) return;
      const now = new Date();
      t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    };
    tick();
  }
}

async function pyApplyGlobalFont() {
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
  if (e.key === 'luna_font_update')   pyApplyGlobalFont();
  if (e.key === 'luna_island_update') pySyncIsland();
  if (e.key === 'luna_tz_update')     pyUpdateTime();
  /* 角色资料（含头像）在角色管理页被修改时，实时刷新首页头像/名字 */
  if (e.key === 'luna_char_db_update' || e.key === 'luna_characters_updated') pyRefreshHome();
});

/* 兜底：部分场景下角色资料更新不一定触发 storage 事件（比如同标签页内跳转编辑后返回），
   切回本页时重新读取一次，保证头像/名字不会显示旧数据 */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') pyRefreshHome();
});
window.addEventListener('pageshow', () => pyRefreshHome());

setInterval(() => {
  pyUpdateTime();
  pySyncBattery();
}, 10000);

/* ================================================================
   LunaCharDB / LunaChatDB —— 与 secret.js kkOpenCharDB / kkGetChatDB
   完全一致的打开逻辑，保证不会触发多余的版本升级冲突
================================================================ */
function pyOpenCharDB() {
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

/* 读取角色完整档案：name / role / desc / traits[] / prompt（人设 system prompt）/ cardBg */
function pyLoadCharProfile(name) {
  return new Promise(resolve => {
    pyOpenCharDB().then(db => {
      if (!db.objectStoreNames.contains('chars')) { resolve(null); return; }
      const r = db.transaction('chars').objectStore('chars').getAll();
      r.onsuccess = () => resolve((r.result || []).find(c => c.name === name) || null);
      r.onerror = () => resolve(null);
    }).catch(() => resolve(null));
  });
}

/* 读取 LunaIdentityDB：找出「当前应该代表用户的身份」完整资料（name/role/desc/tags），
   优先找绑定了当前角色的 identity，找不到就退回第一个 active 的 identity */
function pyOpenIdentityDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('LunaIdentityDB');
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e.target.error);
  });
}

async function pyLoadUserIdentity(name) {
  const key = name || PY_NAME;
  try {
    const db = await pyOpenIdentityDB();
    if (!db.objectStoreNames.contains('identities')) return null;
    const all = await new Promise(res => {
      const r = db.transaction('identities').objectStore('identities').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => res([]);
    });
    const pickFallback = () => all.find(i => i.active !== false) || null;
    if (!key) return pickFallback();

    const char = await pyLoadCharProfile(key);
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

let _pyDB = null;
const PY_STORES = {
  conv:     { keyPath: 'name' },
  friends:  { keyPath: 'name' },
  messages: { keyPath: 'chatKey' },
  memes:    { keyPath: 'id' },
  rewindFeedback: { keyPath: 'name' },
  videoLogs: { keyPath: 'id', autoIncrement: true },
  koukan:    { keyPath: 'name' },
  chronicle: { keyPath: 'name' },
  parallel:  { keyPath: 'name' }, /* 异轨：新增 store，与其余功能同库，保证互不冲突 */
};

function pyGetChatDB() {
  return new Promise((res, rej) => {
    if (_pyDB) { res(_pyDB); return; }
    const probe = indexedDB.open('LunaChatDB');
    probe.onsuccess = e => {
      const db = e.target.result;
      const currentVer = db.version;
      const missing = Object.keys(PY_STORES).filter(name => !db.objectStoreNames.contains(name));
      db.close();
      if (missing.length === 0) {
        const reopen = indexedDB.open('LunaChatDB', currentVer);
        reopen.onsuccess = e2 => { _pyDB = e2.target.result; res(_pyDB); };
        reopen.onerror   = () => rej();
      } else {
        const upgrade = indexedDB.open('LunaChatDB', currentVer + 1);
        upgrade.onupgradeneeded = e2 => {
          const udb = e2.target.result;
          missing.forEach(name => {
            if (!udb.objectStoreNames.contains(name)) {
              udb.createObjectStore(name, PY_STORES[name]);
            }
          });
        };
        upgrade.onsuccess = e2 => { _pyDB = e2.target.result; res(_pyDB); };
        upgrade.onerror   = () => rej();
      }
    };
    probe.onerror = () => rej();
  });
}

async function pyLoadMessages(name) {
  try {
    const db = await pyGetChatDB();
    return await new Promise(res => {
      const r = db.transaction('messages').objectStore('messages').get(name);
      r.onsuccess = () => res(r.result ? r.result.msgs : []);
      r.onerror   = () => res([]);
    });
  } catch { return []; }
}

/* 视频通话记录：videoLogs store 是 { id, charName, transcript:[{role,text}], thought } 的平铺列表，
   按 charName 过滤出属于当前角色的通话，取最近几通，用于补充"异轨"生成时的真实相处细节 */
async function pyLoadVideoLogs(name) {
  const key = name || PY_NAME;
  try {
    const db = await pyGetChatDB();
    if (!db.objectStoreNames.contains('videoLogs')) return [];
    const all = await new Promise(res => {
      const r = db.transaction('videoLogs').objectStore('videoLogs').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror   = () => res([]);
    });
    return all.filter(v => (v.charName || key) === key);
  } catch { return []; }
}

/* 叩问档案：koukan store，{ name, entries:[{question, reason, answer, aiAnswer, aiReaction}] }，
   记录着用户和角色之间比较私密的一问一答，是很有分量的相处记忆 */
async function pyLoadKoukan(name) {
  try {
    const db = await pyGetChatDB();
    if (!db.objectStoreNames.contains('koukan')) return [];
    return await new Promise(res => {
      const r = db.transaction('koukan').objectStore('koukan').get(name || PY_NAME);
      r.onsuccess = () => res((r.result && r.result.entries) || []);
      r.onerror   = () => res([]);
    });
  } catch { return []; }
}

/* 幕后志档案：chronicle store，{ name, entries:[{title, paragraphs:[{zh,en}], authorNote}] }，
   是角色视角写下的、关于这段关系的叙事片段，同样是需要读取的长期记忆 */
async function pyLoadChronicle(name) {
  try {
    const db = await pyGetChatDB();
    if (!db.objectStoreNames.contains('chronicle')) return [];
    return await new Promise(res => {
      const r = db.transaction('chronicle').objectStore('chronicle').get(name || PY_NAME);
      r.onsuccess = () => res((r.result && r.result.entries) || []);
      r.onerror   = () => res([]);
    });
  } catch { return []; }
}

/* 把聊天记录 + 视频通话 + 叩问 + 幕后志 汇总成一段"相处记忆"文本，
   供生成/续聊 prompt 统一引用，四类记忆都要覆盖到，缺席的部分给出说明而不是留空 */
async function pyBuildMemoryText(name) {
  const key = name || PY_NAME;

  const history = await pyLoadMessages(key);
  const chatText = (history || []).slice(-40).map(m => {
    const r = m.role === 'mine' ? '用户' : key;
    const text = m.isVoice ? (m.voiceText || m.text) : (m.text || '');
    return text ? `${r}：${text}` : '';
  }).filter(Boolean).join('\n');

  const videoLogs = await pyLoadVideoLogs(key);
  const videoText = videoLogs.length
    ? videoLogs.slice(-3).map(v => {
        const t = (v.transcript || []).map(e => `${e.role === 'luna' ? key : '用户'}：${e.text || ''}`).join('\n');
        return `【一通视频通话】${v.thought ? `（事后${key}的心声：${v.thought}）` : ''}\n${t}`;
      }).join('\n\n')
    : '';

  const koukan = await pyLoadKoukan(key);
  const koukanText = koukan.length
    ? koukan.slice(-5).map(e => `- ${key}问：${e.question}${e.answer ? `｜用户答：${e.answer}` : '（用户还没回答）'}`).join('\n')
    : '';

  const chronicle = await pyLoadChronicle(key);
  const chronicleText = chronicle.length
    ? chronicle.slice(-3).map(e => {
        const body = (e.paragraphs || []).map(p => p.zh).join('');
        return `${e.title ? `《${e.title}》` : ''}${body}`;
      }).join('\n\n')
    : '';

  return {
    chatText,
    videoText,
    koukanText,
    chronicleText,
    combined: `最近文字聊天记录：\n${chatText || '（暂无）'}\n\n` +
      `最近视频通话记录：\n${videoText || '（暂无视频通话记录）'}\n\n` +
      `叩问环节积累的私密问答：\n${koukanText || '（暂无叩问记录）'}\n\n` +
      `幕后志（角色视角写下的相处叙事片段）：\n${chronicleText || '（暂无幕后志记录）'}`,
  };
}

/* ---- 统一 API 调用（与 chatroom.js / kouwen.js 一致）---- */
async function pyCallApi(systemPrompt, messages) {
  const cur   = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  if (!cur.baseUrl || !cur.apiKey || !model) throw new Error('NO_API_CONFIG');

  const response = await fetch(`${cur.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
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

function pyHasApiConfig() {
  const cur   = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  return !!(cur.baseUrl && cur.apiKey && model);
}

/* ================================================================
   异轨档案：存档结构
   { name, entries: [ {
       id, ts,
       mode: 'custom' | 'ai',
       sourceDesc,           // 用户描述的分歧点，或 AI 生成时对应的候选描述
       branch: { title, titleEn, hook, hookEn, scenario, scenarioEn,
                 opening, openingEn, tone, distance },
       thread: [ {role:'mine'|'char', text, textEn, ts} ... ],  // 该轨道下的对话
       finished: false
   } ] }
================================================================ */
async function pyLoadArchive(name) {
  try {
    const db = await pyGetChatDB();
    return await new Promise(res => {
      const r = db.transaction('parallel').objectStore('parallel').get(name || PY_NAME);
      r.onsuccess = () => res((r.result && r.result.entries) || []);
      r.onerror   = () => res([]);
    });
  } catch { return []; }
}

async function pySaveArchiveEntries(name, entries) {
  const key = name || PY_NAME;
  try {
    const db = await pyGetChatDB();
    await new Promise(res => {
      const tx = db.transaction('parallel', 'readwrite');
      tx.objectStore('parallel').put({ name: key, entries });
      tx.oncomplete = () => res();
      tx.onerror    = () => res();
    });
  } catch (e) {}
}

async function pyAppendArchive(name, entry) {
  const key = name || PY_NAME;
  const entries = await pyLoadArchive(key);
  entry.id = entries.length ? entries[entries.length - 1].id + 1 : 1;
  entry.ts = Date.now();
  entries.push(entry);
  await pySaveArchiveEntries(key, entries);
  return entry;
}

async function pyUpdateArchiveEntry(name, id, patch) {
  const key = name || PY_NAME;
  const entries = await pyLoadArchive(key);
  const idx = entries.findIndex(e => e.id === id);
  if (idx < 0) return null;
  entries[idx] = Object.assign({}, entries[idx], patch);
  await pySaveArchiveEntries(key, entries);
  return entries[idx];
}

/* 用于「不满意再生成一次」——记录本次会话里已经出现过的候选标题/钩子，
   保证下一批候选一定换方向，不会重复浪费额度 */
let _pySeenHooks = [];      // 本次生成流程内已出现过的候选（跨多轮"再生成"累积）
let _pyLastCustomDesc = ''; // 上一次「自定义描述」文本，用于重复请求时保持上下文

/* ---- 生成三个「异轨」候选分支：基于角色人设 + 聊天记录 + （可选）用户自定义描述 ---- */
async function pyGenerateBranches(name, userDesc) {
  const key  = name || PY_NAME;
  const char = await pyLoadCharProfile(key);
  const persona = char?.persona || char?.description || char?.desc || char?.prompt || '';
  const role     = char?.role || '';
  const traits   = Array.isArray(char?.traits) ? char.traits.join('、') : (char?.traits || char?.personality || '');

  const userIdentity = await pyLoadUserIdentity(key);
  const uName = userIdentity?.name || '';
  const uDesc = userIdentity?.desc || userIdentity?.role || '';
  const uTags = Array.isArray(userIdentity?.tags) ? userIdentity.tags.join('、') : '';
  const userLine = (uName || uDesc || uTags)
    ? `\n用户的身份资料：${uName ? `称呼${uName}` : ''}${uDesc ? `，${uDesc}` : ''}${uTags ? `，标签：${uTags}` : ''}（构思分歧点和疏离感时要结合这个人本身的具体情况，不能只靠角色单方面的人设来编）`
    : '';

  const memory = await pyBuildMemoryText(key);

  const avoidText = _pySeenHooks.length
    ? _pySeenHooks.map((h, i) => `${i + 1}. ${h}`).join('\n')
    : '（无）';

  const customLine = userDesc
    ? `用户明确指定了想看的分歧方向：「${userDesc}」\n请围绕这个方向生成三个不同角度/不同程度的具体版本，而不是三个无关的设定。`
    : `用户没有指定方向，请你根据${key}的人设自由构思三个截然不同、但都合理可信的「如果当初……」分歧点。`;

  const systemPrompt = `你是「${key}」的平行时间线构思系统，负责在「异轨」功能里想象——如果某个关键节点${key}做了不同的选择、或者你们的相遇方式不同，那个平行世界里的${key}会是什么样。你是一个有想象力的编剧，不是在填模板。
角色人设：${persona || ''}
角色定位：${role || ''}
性格特征：${traits || ''}${userLine}

核心要求：
- 平行版本必须仍然是${key}这个人，性格内核、说话习惯、价值观不能变，只是境遇/关系阶段/某个具体选择不同，导致疏离感、陌生感、戒备感的程度不同。
- 每个候选必须有一个具体到"哪一天、哪件事、哪句话"的分歧点，不能是抽象的"如果关系不好"。要能回答：分歧发生在什么场景？当时本该发生什么，实际发生了什么？这个不同如何一路影响到今天？
- 三个候选必须彼此在分歧点、疏离程度、情感基调三个维度上都明显不同——比如一个是"关键时刻的沉默"、一个是"从没发生过的相遇"、一个是"一次没被原谅的伤害"，不能是同一种"错过"换个说法讲三遍。
- 细节要具体可信：可以引用聊天记录、视频通话、叩问问答、幕后志里真实出现过的人名、习惯、经历、说话方式，把它们扭转到平行世界的走向里，而不是凭空编造一套无关的背景。
- 绝对不要平铺直叙地总结"关系变淡了""比较陌生"这种空话，要写出陌生感体现在什么具体细节上（称呼变了、话题范围缩小了、有些从前会说的话现在不会说了）。
- 绝对不要生成${avoidText === '（无）' ? '任何过于单薄、只有一句话概念的设定' : '与下方"已出现过的候选"重复或高度相似的设定'}：
已出现过的候选（本次会话内，禁止重复或换皮重复）：
${avoidText}
只输出 JSON，不要任何额外文字，不要 markdown 代码块。`;

  const userPrompt = `${customLine}

以下是你们之间完整的相处记忆——文字聊天、视频通话、叩问私密问答、幕后志叙事片段都要参考，用于提取真实细节、人名、习惯、曾经发生过的事，把它们扭转进平行世界，但异轨本身不代表这些事真的发生过：
${memory.combined}

为每个候选生成以下字段，字数是硬性下限，不能写短：
- title：5-10字的中文分歧点标题，要具体不要抽象（例如"没有接住那通深夜电话"而不是"疏远的关系"）
- titleEn：对应的自然英文（不是逐字直译）
- hook：一句话钩子，35-60字，讲清楚"如果……"的具体分歧点是什么、发生在什么场景
- hookEn：hook 的英文
- distance：这个版本里Ta和用户有多陌生，用一个精确的短语概括（不要只写"陌生"，要写出具体的疏离质感，例如"客气得像刚加的同事""还记得细节但刻意保持距离""连名字都要想一下怎么称呼"）
- scenario：**至少150字、最多220字**的中文，像小说梗概一样，必须包含：①分歧点当时具体发生了什么（场景、动作、没说出口的话）；②这之后关系如何一步步走到今天，中间至少提一个具体的转折或事件；③现在两人的相处状态具体是什么样（见面会做什么、聊什么、不聊什么、Ta现在会不会主动联系）。不要用"关系变得疏远""彼此都很陌生"这种总结句糊弄，要写出可以想象的画面。
- scenarioEn：scenario 的完整英文翻译，同样详细，不能是缩写概括
- opening：这条时间线里${key}见到用户说的第一句话，要符合这个版本的疏离感和人设语气，中文，20-50字，要有具体的场景感（比如提到时间/地点/一个动作），不能只是一句寒暄
- openingEn：opening 的英文

输出格式（只输出这个JSON数组，其他什么都不要，scenario 字段务必写满字数要求，不要偷懒缩短）：
[
  {"title":"","titleEn":"","hook":"","hookEn":"","distance":"","scenario":"","scenarioEn":"","opening":"","openingEn":""},
  {"title":"","titleEn":"","hook":"","hookEn":"","distance":"","scenario":"","scenarioEn":"","opening":"","openingEn":""},
  {"title":"","titleEn":"","hook":"","hookEn":"","distance":"","scenario":"","scenarioEn":"","opening":"","openingEn":""}
]`;

  const raw = await pyCallApi(systemPrompt, [{ role: 'user', content: userPrompt }]);
  const clean = raw.replace(/```json|```/g, '').trim();
  const arr = JSON.parse(clean);
  if (!Array.isArray(arr) || !arr.length) throw new Error('empty branches');

  /* 记录本轮候选的 hook，供下一次"再生成"排重 */
  arr.forEach(b => { if (b && b.title) _pySeenHooks.push(`${b.title} — ${b.hook || ''}`); });
  if (userDesc) _pyLastCustomDesc = userDesc;

  return arr.slice(0, 3);
}

/* ---- 用户选定某个候选分支后，生成该分支的开场并建立存档 entry ---- */
async function pyCommitBranch(name, branch, mode, sourceDesc) {
  const key = name || PY_NAME;
  const entry = await pyAppendArchive(key, {
    mode: mode || 'ai',
    sourceDesc: sourceDesc || '',
    branch: {
      title: branch.title || '', titleEn: branch.titleEn || '',
      hook: branch.hook || '', hookEn: branch.hookEn || '',
      scenario: branch.scenario || '', scenarioEn: branch.scenarioEn || '',
      opening: branch.opening || '', openingEn: branch.openingEn || '',
      distance: branch.distance || '',
    },
    thread: branch.opening ? [{ role: 'char', text: branch.opening, textEn: branch.openingEn || '', ts: Date.now() }] : [],
    finished: false,
  });
  return entry;
}

/* ---- 在某条异轨内继续对话：Ta以「另一个Ta」的身份、按分支设定回应 ---- */
async function pyContinueThread(name, entryId, userText) {
  const key  = name || PY_NAME;
  const char = await pyLoadCharProfile(key);
  const persona = char?.persona || char?.description || char?.desc || char?.prompt || '';
  const traits   = Array.isArray(char?.traits) ? char.traits.join('、') : (char?.traits || char?.personality || '');

  const userIdentity = await pyLoadUserIdentity(key);
  const uName = userIdentity?.name || '';
  const uDesc = userIdentity?.desc || userIdentity?.role || '';
  const userLine = (uName || uDesc)
    ? `\n和你说话的这个人：${uName || '（未命名）'}${uDesc ? `，${uDesc}` : ''}（这是你对"对方是谁"的真实认知，即便这条异轨疏离，你依然认识这个具体的人，不是在跟一个抽象的"用户"说话）`
    : '';

  const archive = await pyLoadArchive(key);
  const entry = archive.find(e => e.id === entryId);
  if (!entry) return null;

  const memory = await pyBuildMemoryText(key);
  const thread = entry.thread || [];
  const historyText = thread.map(m => `${m.role === 'mine' ? (uName || '用户') : key}：${m.text}`).join('\n');

  const systemPrompt = `你现在扮演「${key}」，但是在一条平行时间线（异轨）里的${key}——真实存在，不是AI或助手。
角色人设：${persona || ''}
性格特征：${traits || ''}${userLine}

这条异轨的分歧点：${entry.branch?.title || ''} —— ${entry.branch?.hook || ''}
这条时间线里发生的事：${entry.branch?.scenario || ''}
这个版本的Ta和用户的疏离程度：${entry.branch?.distance || '较陌生'}

真实时间线里你们的相处记忆（仅供你判断"哪些曾经的默契/习惯在这条异轨里已经不存在了"，不代表这条异轨里也发生过，除非分歧点本身晚于某段记忆）：
${memory.combined}

要求：
- 你仍然是${key}的性格内核，但要体现出这条异轨设定带来的疏离感/陌生感/戒备感，不能表现得和主线一样熟络。
- 回复要具体、有细节，不能只是空泛的情绪词——可以带一个具体的观察、一个反问、一件小事，让人感觉这是个真实场景里的真实反应，不是敷衍的寒暄。
- 对话要自然口语化，不要说教，不要出现任何括号/星号包裹的动作描写。
- 不要主动跳出设定或提及"平行时间线""AI"等元信息。
只输出 JSON，不要额外文字，不要 markdown 代码块。`;

  const userPrompt = `这条异轨到目前为止的对话：
${historyText || '（还没有对话，刚刚见面）'}

用户刚说：${userText}

输出格式（只输出这个JSON，其他什么都不要）：
{"reply":"中文回复（50-110字，符合疏离感设定，要有具体细节不能空泛）","replyEn":"English version"}`;

  const raw = await pyCallApi(systemPrompt, [{ role: 'user', content: userPrompt }]);
  const clean = raw.replace(/```json|```/g, '').trim();
  const data = JSON.parse(clean);

  const newThread = thread.concat([
    { role: 'mine', text: userText, ts: Date.now() },
    { role: 'char', text: data.reply || '', textEn: data.replyEn || '', ts: Date.now() },
  ]);
  return await pyUpdateArchiveEntry(key, entryId, { thread: newThread });
}

async function pyFinishThread(name, entryId) {
  const key = name || PY_NAME;
  return await pyUpdateArchiveEntry(key, entryId, { finished: true });
}

/* ================================================================
   页面 UI 逻辑
================================================================ */
let _pyCandidates = [];      // 当前这一批展示的三个候选
let _pyCurrentEntry = null;  // 正在查看/继续的存档 entry
let _pyPickedMode = 'ai';    // 'ai' | 'custom'
let _pyRegenCount = 0;       // 本次"再生成"次数（用于展示与提示，不做上限限制）

function pyOpen() {
  pyUpdateTime();
  pySyncBattery();
  pySyncIsland();
  pyApplyGlobalFont();
  pyGo(0);
  pyRefreshHome();
}

function pyGo(n) {
  document.querySelectorAll('.py-screen').forEach(s => s.classList.remove('py-active'));
  const target = document.getElementById('py-s' + n);
  if (target) target.classList.add('py-active');
  if (n === 5) pyRenderArchive();
}

async function pyRefreshHome() {
  const nameEl = document.querySelectorAll('.py-char-name');
  nameEl.forEach(el => el.textContent = PY_NAME);

  /* 头像：优先读角色档案里的 avatar 图片，没有的话才退回首字母 */
  const char = await pyLoadCharProfile(PY_NAME);
  const avaEls = document.querySelectorAll('.py-char-ava');
  avaEls.forEach(el => {
    if (char && char.avatar) {
      el.innerHTML = `<img src="${char.avatar}" alt="${_pyEsc(PY_NAME)}" />`;
      el.classList.add('py-char-ava-img');
    } else {
      el.textContent = (PY_NAME || 'A').slice(0, 1).toUpperCase();
      el.classList.remove('py-char-ava-img');
    }
  });

  const archive = await pyLoadArchive(PY_NAME);
  const countEl = document.getElementById('pyHomeCount');
  if (countEl) countEl.textContent = String(archive.length).padStart(2, '0');

  const latestEl = document.getElementById('pyHomeLatest');
  if (latestEl) {
    if (archive.length) {
      const last = archive[archive.length - 1];
      latestEl.innerHTML = `最近一次异轨 · <strong>${_pyEsc(last.branch?.title || '')}</strong>`;
      latestEl.style.display = '';
    } else {
      latestEl.style.display = 'none';
    }
  }
}

function _pyEsc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ---- 入口：先问用户是自定义描述还是交给AI自由发挥 ---- */
function pyStart() {
  if (!pyHasApiConfig()) {
    pyToast('请先在设置页配置 API 才能使用异轨');
    return;
  }
  _pySeenHooks = [];
  _pyRegenCount = 0;
  const input = document.getElementById('pyCustomInput');
  if (input) input.value = '';
  pyGo(1);
}

/* ---- 提交自定义描述 或 直接留空交给AI ---- */
async function pySubmitIntent(useCustom) {
  const input = document.getElementById('pyCustomInput');
  const desc = useCustom && input ? input.value.trim() : '';
  if (useCustom && !desc) {
    pyToast('写点什么再生成吧，哪怕只是一个模糊的念头也可以');
    return;
  }
  _pyPickedMode = useCustom ? 'custom' : 'ai';
  await pyDoGenerate(desc);
}

async function pyDoGenerate(desc) {
  pyGo(2); /* 加载屏 */
  try {
    const branches = await pyGenerateBranches(PY_NAME, desc);
    _pyCandidates = branches;
    pyRenderCandidates();
    pyGo(3);
  } catch (e) {
    console.error('[pyDoGenerate]', e);
    pyToast(e && e.message === 'NO_API_CONFIG' ? '请先在设置页配置 API' : '生成失败，稍后再试～');
    pyGo(1);
  }
}

/* ---- 「不满意，再生成一次」——强制换方向，不重复 ---- */
async function pyRegenerate() {
  _pyRegenCount++;
  const btn = document.getElementById('pyRegenBtn');
  if (btn) { btn.disabled = true; btn.style.opacity = '.5'; btn.textContent = '正在构思新的方向…'; }
  try {
    const branches = await pyGenerateBranches(PY_NAME, _pyPickedMode === 'custom' ? _pyLastCustomDesc : '');
    _pyCandidates = branches;
    pyRenderCandidates();
    pyToast(`✦ 已换一批新方向 · 第 ${_pyRegenCount + 1} 批`);
  } catch (e) {
    console.error('[pyRegenerate]', e);
    pyToast(e && e.message === 'NO_API_CONFIG' ? '请先在设置页配置 API' : '重新生成失败，稍后再试～');
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.textContent = '✕ 都不满意，再生成一次'; }
  }
}

function pyRenderCandidates() {
  const wrap = document.getElementById('pyCandidateList');
  if (!wrap) return;
  wrap.innerHTML = _pyCandidates.map((b, i) => `
    <div class="py-cand-card" onclick="pyPickCandidate(${i})">
      <div class="py-cand-idx">0${i + 1}</div>
      <div class="py-cand-body">
        <div class="py-cand-title">${_pyEsc(b.title)}<span class="py-cand-title-en">${_pyEsc(b.titleEn || '')}</span></div>
        <div class="py-cand-hook">${_pyEsc(b.hook)}</div>
        <div class="py-cand-meta">
          <span class="py-cand-distance">疏离度 · ${_pyEsc(b.distance || '')}</span>
          <span class="py-cand-arrow">选择这条轨道 →</span>
        </div>
      </div>
    </div>
  `).join('');
}

async function pyPickCandidate(idx) {
  const branch = _pyCandidates[idx];
  if (!branch) return;
  pyGo(2);
  try {
    const sourceDesc = _pyPickedMode === 'custom' ? _pyLastCustomDesc : '';
    const entry = await pyCommitBranch(PY_NAME, branch, _pyPickedMode, sourceDesc);
    _pyCurrentEntry = entry;
    pyShowThread(entry);
  } catch (e) {
    console.error('[pyPickCandidate]', e);
    pyToast('进入这条轨道时出了点问题，再试一次～');
    pyGo(3);
  }
}

/* ---- 屏4：异轨内的对话呈现 ---- */
function pyShowThread(entry) {
  _pyCurrentEntry = entry;

  const titleEl = document.getElementById('pyThreadTitle');
  if (titleEl) titleEl.textContent = entry.branch?.title || '';
  const hookEl = document.getElementById('pyThreadHook');
  if (hookEl) hookEl.textContent = entry.branch?.hook || '';
  const scenarioEl = document.getElementById('pyThreadScenario');
  if (scenarioEl) {
    scenarioEl.innerHTML = `${_pyEsc(entry.branch?.scenario || '')}<br><span class="py-scenario-en">${_pyEsc(entry.branch?.scenarioEn || '')}</span>`;
  }
  const distEl = document.getElementById('pyThreadDistance');
  if (distEl) distEl.textContent = `疏离度 · ${entry.branch?.distance || ''}`;

  pyRenderThreadMessages(entry.thread || []);
  pyGo(4);
}

function pyRenderThreadMessages(thread) {
  const list = document.getElementById('pyThreadMessages');
  if (!list) return;
  list.innerHTML = thread.map(m => {
    if (m.role === 'char') {
      return `<div class="py-msg py-msg-char">
        <div class="py-msg-bubble">${_pyEsc(m.text)}</div>
        ${m.textEn ? `<div class="py-msg-en">${_pyEsc(m.textEn)}</div>` : ''}
      </div>`;
    }
    return `<div class="py-msg py-msg-mine">
      <div class="py-msg-bubble">${_pyEsc(m.text)}</div>
    </div>`;
  }).join('');
  list.scrollTop = list.scrollHeight;
}

async function pySendThreadMessage() {
  const input = document.getElementById('pyThreadInput');
  const val = input ? input.value.trim() : '';
  if (!val || !_pyCurrentEntry) return;
  if (input) input.value = '';

  const provisional = (_pyCurrentEntry.thread || []).concat([{ role: 'mine', text: val, ts: Date.now() }]);
  pyRenderThreadMessages(provisional);

  const sendBtn = document.getElementById('pySendBtn');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const updated = await pyContinueThread(PY_NAME, _pyCurrentEntry.id, val);
    if (updated) {
      _pyCurrentEntry = updated;
      pyRenderThreadMessages(updated.thread || []);
    } else {
      pyToast('这条轨道好像消失了，回首页看看吧');
    }
  } catch (e) {
    console.error('[pySendThreadMessage]', e);
    pyToast(e && e.message === 'NO_API_CONFIG' ? '请先在设置页配置 API' : '回应失败，稍后再试～');
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

/* ---- 「回到真实版」：结束当前异轨，落差感提示，回首页 ---- */
async function pyReturnToReal() {
  if (_pyCurrentEntry) {
    await pyFinishThread(PY_NAME, _pyCurrentEntry.id);
  }
  pyToast('✦ 已回到真实版 · 落差感，留着就好');
  _pyCurrentEntry = null;
  pyGo(0);
  pyRefreshHome();
}

/* ---- 屏5：档案列表 ---- */
async function pyRenderArchive() {
  const archive = await pyLoadArchive(PY_NAME);
  const countEl = document.getElementById('pyArchCount');
  if (countEl) countEl.textContent = `${archive.length} entries · 共 ${archive.length} 条`;

  const list = document.getElementById('pyArchList');
  if (!list) return;

  if (!archive.length) {
    list.innerHTML = `<div class="py-empty">还没有任何记录<br><span>no entries yet · 去开一条新轨道吧</span></div>`;
    return;
  }

  const sorted = archive.slice().reverse();
  list.innerHTML = sorted.map((e, idx) => {
    const isLatest = idx === 0;
    const msgCount = (e.thread || []).length;
    const d = new Date(e.ts);
    const dateStr = `${d.getMonth() + 1}.${d.getDate()}`;
    return `
      <div class="py-arch-item ${isLatest ? 'py-arch-item-latest' : ''}" onclick="pyOpenArchiveEntry(${e.id})">
        ${isLatest ? `<div class="py-arch-tag">LATEST · 最新</div>` : ''}
        <div class="py-arch-title">${_pyEsc(e.branch?.title || '')}<span class="py-arch-title-en">${_pyEsc(e.branch?.titleEn || '')}</span></div>
        <div class="py-arch-hook">${_pyEsc(e.branch?.hook || '')}</div>
        <div class="py-arch-meta">
          <span>${e.mode === 'custom' ? '自定义' : 'AI 构思'} · ${msgCount} 条对话</span>
          <span>${dateStr} · #${String(e.id).padStart(2, '0')}</span>
        </div>
      </div>`;
  }).join('');
}

async function pyOpenArchiveEntry(id) {
  const archive = await pyLoadArchive(PY_NAME);
  const entry = archive.find(e => e.id === id);
  if (!entry) return;
  pyShowThread(entry);
}
window.pyOpenArchiveEntry = pyOpenArchiveEntry;

/* ---- Toast ---- */
let _pyToastTimer = null;
function pyToast(msg) {
  let t = document.getElementById('pyToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'pyToast';
    t.className = 'py-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_pyToastTimer);
  _pyToastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ---- 初始化 ---- */
document.addEventListener('DOMContentLoaded', pyOpen);

window.pyStart = pyStart;
window.pySubmitIntent = pySubmitIntent;
window.pyRegenerate = pyRegenerate;
window.pyPickCandidate = pyPickCandidate;
window.pySendThreadMessage = pySendThreadMessage;
window.pyReturnToReal = pyReturnToReal;
window.pyGo = pyGo;