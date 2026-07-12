/* ================================================================
   kouwen.js — 「叩问」独立功能页
   -----------------------------------------------------------------
   从 secret.js 中完整拆分出来的「叩问」相关代码（DB读写 / AI生成 /
   UI渲染 / 设置页 / 历史档案 / 状态栏同步），作为独立页面运行。

   这是独立页面，和 chatroom.html / secret.html 不共享 JS 运行时，
   但三者读写同一个浏览器里的 IndexedDB「LunaChatDB」/「LunaCharDB」
   和同一份 localStorage，所以数据完全互通、生成规则完全一致。

   相对 secret.js 里原来的实现，这里修复了一个问题：
   原来自动生成失败时是 .catch(() => {}) 静默吞掉错误，用户完全不知道
   发生了什么，看起来像是「点了没反应」。现在无论是页面内触发还是
   chatroom 侧触发的自动生成，失败都会有明确提示（见 kkToast 相关调用
   和 KK_LAST_AUTO_ERROR 的记录）。
================================================================ */

/* ================================================================
   状态栏 / 灵动岛 / 字体 — 与 secret.html 一比一同步
================================================================ */

function kkSyncTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeStr = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const el = document.getElementById('kkStatusTime');
  if (el) el.textContent = timeStr;
}

function kkSyncBattery() {
  const pctEl   = document.getElementById('kkBatPct');
  const innerEl = document.getElementById('kkBatInner');
  const pct = parseInt(localStorage.getItem('luna_battery') || '76');
  if (pctEl) pctEl.textContent = pct;
  if (innerEl) {
    innerEl.style.width = pct + '%';
    innerEl.style.background = pct <= 20
      ? 'linear-gradient(90deg, #f87171, #ef4444)'
      : '#1a1a1a';
  }
}

function kkSyncIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const el      = document.getElementById('kkStatusIsland');
  if (!el) return;
  if (!enabled) { el.innerHTML = ''; return; }
  const styleMap = {
    minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
    clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="kkSiClockText">--:--</span></div></div>`,
    pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
    ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
    rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
    music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
    scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
  };
  el.innerHTML = styleMap[style] || styleMap.minimal;
  clearInterval(window._kkSiClockTimer);
  if (style === 'clock') {
    const tick = () => {
      const t = document.getElementById('kkSiClockText');
      if (!t) return;
      const now = new Date();
      t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    };
    tick();
    window._kkSiClockTimer = setInterval(tick, 10000);
  }
}

/* ---- 字体同步（一比一复刻 chat.js applyGlobalFont）---- */
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

/* ---- 跨标签页实时同步：主页面/聊天页改了设置，这里立刻跟上 ---- */
window.addEventListener('storage', e => {
  if (e.key === 'luna_font_update')   applyGlobalFont();
  if (e.key === 'luna_island_update') kkSyncIsland();
  if (e.key === 'luna_tz_update')     kkSyncTime();
  if (e.key === 'luna_battery')       kkSyncBattery();
  if (e.key === 'luna_koukan_auto_update') {
    const autoTag = document.getElementById('kkAutoTag');
    if (autoTag) {
      const on = kkGetAutoEnabled(KK_NAME);
      autoTag.textContent = on ? '自动生成 · 已开启' : '自动生成 · 已关闭';
      autoTag.classList.toggle('kk-pill-on', on);
    }
    kkRenderSettings();
  }
});

/* 定时刷新状态栏时间与电量 */
setInterval(() => {
  kkSyncTime();
  kkSyncBattery();
}, 10000);

/* ================================================================
   数据层：与 chatroom.js / secret.js 完全一致的 DB 访问，保证数据互通
================================================================ */

const KK_NAME = localStorage.getItem('luna_current_chat') || 'Luna';

/* ---- LunaCharDB 统一打开入口 ---- */
function kkOpenCharDB() {
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

function kkLoadCharProfile(name) {
  return new Promise(resolve => {
    kkOpenCharDB().then(db => {
      if (!db.objectStoreNames.contains('chars')) { resolve(null); return; }
      const r = db.transaction('chars').objectStore('chars').getAll();
      r.onsuccess = () => resolve((r.result || []).find(c => c.name === name) || null);
      r.onerror = () => resolve(null);
    }).catch(() => resolve(null));
  });
}

/* ---- 读取 LunaIdentityDB：找出「当前应该代表用户的身份」完整资料
   （name/role/desc/tags），优先找绑定了当前角色的 identity，
   找不到就退回第一个 active 的 identity ---- */
function kkOpenIdentityDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('LunaIdentityDB');
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e.target.error);
  });
}

async function kkLoadUserIdentity(name) {
  const key = name || KK_NAME;
  try {
    const db = await kkOpenIdentityDB();
    if (!db.objectStoreNames.contains('identities')) return null;
    const all = await new Promise(res => {
      const r = db.transaction('identities').objectStore('identities').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => res([]);
    });
    const pickFallback = () => all.find(i => i.active !== false) || null;
    if (!key) return pickFallback();

    const char = await kkLoadCharProfile(key);
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

/* ---- LunaChatDB：与 chatroom.js 完全一致的 store 定义，保证不会触发多余的版本升级 ---- */
let _kkDB = null;
const KK_STORES = {
  conv:     { keyPath: 'name' },
  friends:  { keyPath: 'name' },
  messages: { keyPath: 'chatKey' },
  memes:    { keyPath: 'id' },
  rewindFeedback: { keyPath: 'name' },
  videoLogs: { keyPath: 'id', autoIncrement: true },
  koukan:    { keyPath: 'name' },
};

function kkGetChatDB() {
  return new Promise((res, rej) => {
    if (_kkDB) { res(_kkDB); return; }
    const probe = indexedDB.open('LunaChatDB');
    probe.onsuccess = e => {
      const db = e.target.result;
      const currentVer = db.version;
      const missing = Object.keys(KK_STORES).filter(name => !db.objectStoreNames.contains(name));
      db.close();
      if (missing.length === 0) {
        const reopen = indexedDB.open('LunaChatDB', currentVer);
        reopen.onsuccess = e2 => { _kkDB = e2.target.result; res(_kkDB); };
        reopen.onerror   = () => rej();
      } else {
        const upgrade = indexedDB.open('LunaChatDB', currentVer + 1);
        upgrade.onupgradeneeded = e2 => {
          const udb = e2.target.result;
          missing.forEach(name => {
            if (!udb.objectStoreNames.contains(name)) {
              udb.createObjectStore(name, KK_STORES[name]);
            }
          });
        };
        upgrade.onsuccess = e2 => { _kkDB = e2.target.result; res(_kkDB); };
        upgrade.onerror   = () => rej();
      }
    };
    probe.onerror = () => rej();
  });
}

async function kkLoadMessages(name) {
  try {
    const db = await kkGetChatDB();
    return await new Promise(res => {
      const r = db.transaction('messages').objectStore('messages').get(name);
      r.onsuccess = () => res(r.result ? r.result.msgs : []);
      r.onerror   = () => res([]);
    });
  } catch { return []; }
}

/* ---- 统一 API 调用（与 chatroom.js crCallApi 一致） ---- */
async function kkCallApi(systemPrompt, messages) {
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

function kkHasApiConfig() {
  const cur   = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  return !!(cur.baseUrl && cur.apiKey && model);
}

/* ---- 叩问档案：读取 / 追加 / 更新（keyPath 与 chatroom.js 一致，数据互通） ---- */
async function kkLoadArchive(name) {
  try {
    const db = await kkGetChatDB();
    return await new Promise(res => {
      const r = db.transaction('koukan').objectStore('koukan').get(name || KK_NAME);
      r.onsuccess = () => res((r.result && r.result.entries) || []);
      r.onerror   = () => res([]);
    });
  } catch { return []; }
}

async function kkAppendArchive(name, entry) {
  const key = name || KK_NAME;
  try {
    const db = await kkGetChatDB();
    const entries = await kkLoadArchive(key);
    entry.id = entries.length ? entries[entries.length - 1].id + 1 : 1;
    entry.ts = Date.now();
    entries.push(entry);
    await new Promise(res => {
      const tx = db.transaction('koukan', 'readwrite');
      tx.objectStore('koukan').put({ name: key, entries });
      tx.oncomplete = () => res();
      tx.onerror    = () => res();
    });
    return entry;
  } catch { return entry; }
}

async function kkUpdateArchiveEntry(name, id, patch) {
  const key = name || KK_NAME;
  try {
    const db = await kkGetChatDB();
    const entries = await kkLoadArchive(key);
    const idx = entries.findIndex(e => e.id === id);
    if (idx < 0) return null;
    entries[idx] = Object.assign({}, entries[idx], patch);
    await new Promise(res => {
      const tx = db.transaction('koukan', 'readwrite');
      tx.objectStore('koukan').put({ name: key, entries });
      tx.oncomplete = () => res();
      tx.onerror    = () => res();
    });
    return entries[idx];
  } catch { return null; }
}

/* ---- 头像渲染：优先使用角色人设里保存的真实头像，没有时才退回到首字母占位 ---- */
let _kkCharProfileCache = null;
async function kkGetCharProfile() {
  if (_kkCharProfileCache) return _kkCharProfileCache;
  _kkCharProfileCache = await kkLoadCharProfile(KK_NAME);
  return _kkCharProfileCache;
}

function kkRenderAvatarInto(el, avatarUrl) {
  if (!el) return;
  if (avatarUrl) {
    el.innerHTML = `<img src="${avatarUrl}" alt="${_kkEsc(KK_NAME)}" />`;
  } else {
    el.textContent = (KK_NAME || 'A').slice(0, 1).toUpperCase();
  }
}

async function kkSyncAvatars() {
  const char = await kkGetCharProfile();
  const avatarUrl = char?.avatar || char?.avatarUrl || char?.avatarData || '';
  kkRenderAvatarInto(document.querySelector('#kk-s0 .kk-char-ava'), avatarUrl);
  kkRenderAvatarInto(document.querySelector('#kk-s3 .kk-resp-ava'), avatarUrl);
}

function kkEstimateStage(entryCount, msgCount) {
  const score = entryCount * 3 + Math.min(msgCount, 200) / 20;
  if (score < 4)  return 'I';
  if (score < 10) return 'II';
  if (score < 18) return 'III';
  if (score < 26) return 'IV';
  return 'V';
}

/* ---- 生成一道新题目：读取角色人设 + 最近聊天记录 + 过往叩问记录 ----
   注意：这里不再吞掉错误，失败时会 throw，交给调用方（kkEnter /
   kkManualGenerateFromSettings / kkAutoGenerateSilently）统一处理提示。 */
async function kkGenerateQuestion(name) {
  const key  = name || KK_NAME;
  const char = await kkLoadCharProfile(key);
  const persona = char?.persona || char?.description || char?.desc || '';
  const traits  = char?.traits  || char?.personality || '';

  const userIdentity = await kkLoadUserIdentity(key);
  const uName = userIdentity?.name || '';
  const uDesc = userIdentity?.desc || userIdentity?.role || '';
  const uTags = Array.isArray(userIdentity?.tags) ? userIdentity.tags.join('、') : '';
  const userLine = (uName || uDesc || uTags)
    ? `\n用户的身份资料：${uName ? `称呼${uName}` : ''}${uDesc ? `，${uDesc}` : ''}${uTags ? `，标签：${uTags}` : ''}（出题时可以自然结合这些信息，让问题更像是真的了解这个人才问得出来的，而不是泛用模板）`
    : '';

  const history = await kkLoadMessages(key);
  const recentText = (history || []).slice(-40).map(m => {
    const role = m.role === 'mine' ? (uName || '用户') : key;
    const text = m.isVoice ? (m.voiceText || m.text) : (m.text || '');
    return text ? `${role}：${text}` : '';
  }).filter(Boolean).join('\n');

  const archive = await kkLoadArchive(key);
  const archiveText = archive.length
    ? archive.slice(-6).map(e => `- 题：${e.question}${e.answer ? `｜用户答：${e.answer}` : '（用户尚未回答）'}`).join('\n')
    : '（还没有任何叩问记录，这是第一次）';

  const stage = kkEstimateStage(archive.length, (history || []).length);

  const systemPrompt = `你是「${key}」的内心出题系统，负责在「叩问」环节为她想一道只问用户的题。
角色人设：${persona || ''} ${traits || ''}${userLine}
只输出 JSON，不要任何额外文字，不要 markdown 代码块。`;

  const userPrompt = `根据${key}和用户最近的聊天记录、以及过去问过的题目，生成新一道「叩问」题目。

要求：
- 题目必须是只问用户本人的、私人化的、和考试无关的问题，不能是泛泛的话题闲聊。
- 题目要体现${key}对用户的关心/好奇，并且和你们的关系阶段（阶段${stage}）匹配：阶段越靠前问题越轻，越往后可以越深入、越私密。
- 不要和过去问过的题目重复或高度相似。
- reason 字段：${key}为什么会问这道题，要具体关联到聊天记录里的某个细节，不能空泛。
- question / reason 用中文；questionEn / reasonEn 提供对应的自然英文翻译（不是逐字直译）。

最近聊天记录：
${recentText || '（暂无聊天记录）'}

过去问过的题目：
${archiveText}

输出格式（只输出这个JSON，其他什么都不要）：
{"question":"中文题目","questionEn":"English question","reason":"她为什么问这道题（中文，具体关联聊天细节）","reasonEn":"English version of the reason","stage":"${stage}"}`;

  const raw = await kkCallApi(systemPrompt, [{ role: 'user', content: userPrompt }]);
  const clean = raw.replace(/```json|```/g, '').trim();
  let data;
  try {
    data = JSON.parse(clean);
  } catch (e) {
    throw new Error('AI 返回格式异常，未能解析出题目');
  }
  if (!data || !data.question) throw new Error('AI 没有给出有效题目');
  const entry = await kkAppendArchive(key, {
    stage: data.stage || stage,
    question: data.question,
    questionEn: data.questionEn || '',
    reason: data.reason || '',
    reasonEn: data.reasonEn || '',
    answer: '',
    aiAnswer: '',
    aiAnswerEn: '',
    aiReaction: '',
    aiReactionEn: '',
    answered: false,
  });
  return entry;
}

/* ---- 用户提交回答后，生成角色自己的答案 + 对用户回答的反应 ---- */
async function kkGenerateAnswer(name, entryId, userAnswer) {
  const key  = name || KK_NAME;
  const char = await kkLoadCharProfile(key);
  const persona = char?.persona || char?.description || char?.desc || '';
  const traits  = char?.traits  || char?.personality || '';

  const userIdentity = await kkLoadUserIdentity(key);
  const uName = userIdentity?.name || '';
  const uDesc = userIdentity?.desc || userIdentity?.role || '';
  const userLine = (uName || uDesc)
    ? `\n正在回答你的人：${uName || '（未命名）'}${uDesc ? `，${uDesc}` : ''}`
    : '';

  const archive = await kkLoadArchive(key);
  const entry = archive.find(e => e.id === entryId);
  if (!entry) return null;

  const systemPrompt = `你现在扮演「${key}」，一个真实存在的人，绝对不是 AI 或助手。
人物简介：${persona || ''}
性格特点：${traits || ''}${userLine}
你正在和用户玩「叩问」——你之前问了用户一道私人问题，现在用户回答了，
你需要：1) 认真回应用户的答案（简短、真实、有情绪，不要说教）；2) 说出你自己对这道题的答案。
只输出 JSON，不要任何额外文字，不要 markdown 代码块，不要出现任何括号/星号包裹的动作描写。`;

  const userPrompt = `你问的题目：${entry.question}
你问这题的原因：${entry.reason || ''}
用户的回答：${userAnswer || '（用户没有写，只是点了进来）'}

输出格式（只输出这个JSON，其他什么都不要）：
{"aiReaction":"你对用户回答的真实反应（中文，简短口语化，30-60字）","aiReactionEn":"English version","aiAnswer":"你自己对这道题的答案（中文，第一人称，40-90字，要有细节和情绪）","aiAnswerEn":"English version"}`;

  const raw = await kkCallApi(systemPrompt, [{ role: 'user', content: userPrompt }]);
  const clean = raw.replace(/```json|```/g, '').trim();
  let data;
  try {
    data = JSON.parse(clean);
  } catch (e) {
    throw new Error('AI 返回格式异常，未能解析出回应');
  }
  return await kkUpdateArchiveEntry(key, entryId, {
    answer: userAnswer || '',
    aiAnswer: data.aiAnswer || '',
    aiAnswerEn: data.aiAnswerEn || '',
    aiReaction: data.aiReaction || '',
    aiReactionEn: data.aiReactionEn || '',
    answered: true,
  });
}

/* ---- 自动生成开关：与 chatroom.js 共用同一个 localStorage key ---- */
function kkGetAutoEnabled(name) {
  return localStorage.getItem('luna_koukan_auto_' + (name || KK_NAME)) === 'true';
}
function kkSetAutoEnabled(name, on) {
  const key = 'luna_koukan_auto_' + (name || KK_NAME);
  localStorage.setItem(key, on ? 'true' : 'false');
  try { localStorage.setItem('luna_koukan_auto_update', String(Date.now())); } catch (e) {}
}

/* ================================================================
   页面 UI 逻辑（独立页面版：不再是「打开/关闭浮层」，而是
   页面加载即初始化，返回按钮跳回 secret.html）
================================================================ */

let _kkCurrentEntry = null;   /* 当前正在作答/展示的题目 entry */
let _kkPendingEntry  = null;  /* 首页展示的"待作答"题目（如果有） */

/* 页面初始化：从 DOMContentLoaded 调用 */
function kkInit() {
  const page = document.getElementById('koukan-page');
  if (page) page.classList.add('kk-open');

  kkSyncTime();
  kkSyncBattery();
  kkSyncIsland();
  kkSyncAvatars();
  applyGlobalFont();

  kkGo(0);
  kkRefreshHome();
}

/* 返回：独立页面场景下，跳回 secret.html（秘密空间首页） */
function kkClose() {
  window.location.href = '../secret.html';   // ← 加上 ../ 前缀
}

/* 屏幕切换 */
function kkGo(n) {
  document.querySelectorAll('.kk-screen').forEach(s => s.classList.remove('kk-active'));
  const target = document.getElementById('kk-s' + n);
  if (target) target.classList.add('kk-active');
  if (n === 4) kkRenderArchive();
  if (n === 5) kkRenderSettings();
}

/* ---- 首页数据刷新：角色名、阶段、档案数量、待作答提示 ---- */
async function kkRefreshHome() {
  const nameEl = document.querySelector('#kk-s0 .kk-char-name');
  if (nameEl) nameEl.textContent = KK_NAME;
  _kkCharProfileCache = null; /* 强制重新读取，保证和角色设置页最新头像一致 */
  kkSyncAvatars();

  const archive = await kkLoadArchive(KK_NAME);
  const history = await kkLoadMessages(KK_NAME);
  const stage = kkEstimateStage(archive.length, (history || []).length);

  const stageEl = document.querySelector('#kk-s0 .kk-char-stage');
  if (stageEl) stageEl.textContent = `阶段 ${stage}`;

  const roundEl = document.querySelector('#kk-s0 .kk-meta-row span:nth-child(1) span');
  if (roundEl) roundEl.textContent = String(archive.length).padStart(2, '0');
  const depthEl = document.querySelector('#kk-s0 .kk-meta-row span:nth-child(2) span');
  if (depthEl) depthEl.textContent = `${stage} / V`;
  const archEl  = document.querySelector('#kk-s0 .kk-meta-row span:nth-child(3) span');
  if (archEl) archEl.textContent = String(archive.length);

  /* 待作答的题目：最新一条且尚未回答的 entry */
  _kkPendingEntry = archive.length && !archive[archive.length - 1].answered
    ? archive[archive.length - 1]
    : null;

  const enterBtn = document.querySelector('#kk-s0 .kk-enter-btn span:first-child');
  if (enterBtn) {
    enterBtn.textContent = _kkPendingEntry ? 'ENTER · 还有一道题等你回答' : 'ENTER · 进入叩问';
  }

  /* 自动生成开关状态同步到首页小标签 */
  const autoTag = document.getElementById('kkAutoTag');
  if (autoTag) {
    const on = kkGetAutoEnabled(KK_NAME);
    autoTag.textContent = on ? '自动生成 · 已开启' : '自动生成 · 已关闭';
    autoTag.classList.toggle('kk-pill-on', on);
  }
}

/* 点击「进入叩问」：有待答题目直接展示，没有则生成新题
   —— 修复点：原来出错时只弹一句通用提示，现在把具体错误原因带出来，
   避免用户以为「点了没反应」。*/
async function kkEnter() {
  if (!kkHasApiConfig()) {
    kkToast('请先在设置页配置 API 才能使用叩问');
    return;
  }
  if (_kkPendingEntry) {
    kkShowQuestion(_kkPendingEntry);
    return;
  }
  kkGo(1); /* 加载屏 */
  try {
    const entry = await kkGenerateQuestion(KK_NAME);
    if (entry) {
      kkShowQuestion(entry);
    } else {
      kkToast('这次没想出题目，稍后再试试～');
      kkGo(0);
    }
  } catch (e) {
    console.error('[kkEnter]', e);
    kkToast(kkFormatError(e, '生成题目失败'));
    kkGo(0);
  }
}

/* 把生成好的题目渲染进屏2 */
function kkShowQuestion(entry) {
  _kkCurrentEntry = entry;

  const label = document.querySelector('#kk-s2 .kk-q-deco-label');
  if (label) label.textContent = `QUESTION ${String(entry.id).padStart(2,'0')} · 第${entry.id}道题`;

  const from = document.querySelector('#kk-s2 .kk-q-from');
  if (from) from.textContent = `DEPTH ${entry.stage || ''} · FROM ${KK_NAME.toUpperCase()} · 来自${KK_NAME}`;

  const qText = document.getElementById('kkQText');
  if (qText) qText.textContent = entry.questionEn || '';
  const qTextCn = document.getElementById('kkQTextCn');
  if (qTextCn) qTextCn.textContent = entry.question || '';

  const tag = document.querySelector('#kk-s2 .kk-q-tag');
  if (tag) tag.textContent = `阶段 ${entry.stage || ''} · personal · 只问你一个人`;

  const reasonEl = document.getElementById('kkQReason');
  if (reasonEl) {
    reasonEl.innerHTML = `Ta问这题是因为——<br>${_kkEsc(entry.reason || '')}<br><span class="kk-q-reason-sub">${_kkEsc(entry.reasonEn || '')}</span>`;
  }

  const input = document.getElementById('kkAnswerInput');
  if (input) input.value = entry.answer || '';

  kkGo(2);
}

/* 提交回答：调用 AI 生成角色的答案与反应，展示在屏3 */
async function kkSubmit() {
  const input = document.getElementById('kkAnswerInput');
  const val = input ? input.value.trim() : '';
  if (!_kkCurrentEntry) { kkGo(0); return; }

  const display = document.getElementById('kkYourAnsDisplay');
  if (display) display.textContent = val || '（你没写答案，但Ta记得你来过）';

  const submitBtn = document.querySelector('#kk-s2 .kk-submit-btn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '.5'; submitBtn.textContent = '正在等待回应…'; }

  try {
    const updated = await kkGenerateAnswer(KK_NAME, _kkCurrentEntry.id, val);
    if (updated) {
      _kkCurrentEntry = updated;
      kkShowResponse(updated);
    } else {
      kkToast('回应生成失败，稍后再试～');
    }
  } catch (e) {
    console.error('[kkSubmit]', e);
    kkToast(kkFormatError(e, '回应生成失败'));
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = ''; submitBtn.textContent = 'SUBMIT · 提交回答 →'; }
  }
}

/* 渲染屏3：角色的回应 + Ta自己的答案 */
function kkShowResponse(entry) {
  kkSyncAvatars();
  const nameEl = document.querySelector('#kk-s3 .kk-resp-name');
  if (nameEl) nameEl.textContent = KK_NAME.toUpperCase();

  const yourAns = document.getElementById('kkYourAnsDisplay');
  if (yourAns) yourAns.textContent = entry.answer || '（你没写答案，但Ta记得你来过）';

  const aiText = document.getElementById('kkAiText');
  if (aiText) {
    aiText.innerHTML = `${_kkEsc(entry.aiAnswer || '')}<br><br><span style="color:#888;font-size:11px;">${_kkEsc(entry.aiAnswerEn || '')}</span>`;
  }
  const aiReaction = document.getElementById('kkAiReaction');
  if (aiReaction) {
    aiReaction.innerHTML = `${_kkEsc(entry.aiReaction || '')}<br><span style="font-size:10.5px;color:#bbb;">${_kkEsc(entry.aiReactionEn || '')}</span>`;
  }
  const archText = document.getElementById('kkArchivedText');
  if (archText) {
    archText.innerHTML = `已存入问答档案 · <strong>Archive #${String(entry.id).padStart(2,'0')}</strong><br><span style="color:#bbb;">will shape what she asks next · 会影响Ta下一道题怎么问</span>`;
  }

  kkGo(3);
}

/* ---- 档案页：真实渲染 kkLoadArchive 返回的数据 ---- */
async function kkRenderArchive() {
  const archive = await kkLoadArchive(KK_NAME);
  const countEl = document.querySelector('#kk-s4 .kk-arch-count');
  if (countEl) countEl.textContent = `${archive.length} entries · 共 ${archive.length} 条`;

  const list = document.querySelector('#kk-s4 .kk-arch-list');
  if (!list) return;

  if (!archive.length) {
    list.innerHTML = `<div style="text-align:center;padding:2rem 0;color:#bbb;font-size:11.5px;">还没有任何记录<br><span style="font-size:9.5px;color:#ccc;font-style:italic;">no entries yet · 回首页开始第一道叩问吧</span></div>`;
    return;
  }

  const sorted = archive.slice().reverse();
  list.innerHTML = sorted.map((e, idx) => {
    const isLatest = idx === 0;
    return `
      <div class="kk-arch-item" style="${isLatest ? 'border-color:#1a1a18' : ''}; cursor:pointer" onclick="kkOpenArchiveEntry(${e.id})">
        ${isLatest ? `<div style="font-size:9px;letter-spacing:.1em;color:#888;margin-bottom:5px;font-family:'Josefin Sans',sans-serif;text-transform:uppercase;">LATEST · 最新</div>` : ''}
        <div class="kk-arch-item-q">${_kkEsc(e.question)}<br><span class="kk-arch-item-q-sub">${_kkEsc(e.questionEn || '')}</span></div>
        <div class="kk-arch-item-meta">
          <div class="kk-arch-item-ans">${e.answered ? _kkEsc(e.answer ? (e.answer.length > 12 ? e.answer.slice(0,12)+'…' : e.answer) : '（未作答）') : '待作答'}</div>
          <div class="kk-arch-item-date">Stage ${e.stage || ''} · #${String(e.id).padStart(2,'0')}</div>
        </div>
      </div>`;
  }).join('');
}

/* 点开档案里的某一条：已作答的直接看回应，未作答的进入作答页 */
async function kkOpenArchiveEntry(id) {
  const archive = await kkLoadArchive(KK_NAME);
  const entry = archive.find(e => e.id === id);
  if (!entry) return;
  _kkCurrentEntry = entry;
  if (entry.answered) {
    kkShowResponse(entry);
  } else {
    kkShowQuestion(entry);
  }
}
window.kkOpenArchiveEntry = kkOpenArchiveEntry;

/* ---- 设置页：自动生成开关 ---- */
function kkRenderSettings() {
  const toggle = document.getElementById('kkAutoToggle');
  if (!toggle) return;
  const on = kkGetAutoEnabled(KK_NAME);
  toggle.classList.toggle('kk-switch-on', on);
  const status = document.getElementById('kkAutoStatus');
  if (status) status.textContent = on ? '已开启 · Enabled' : '已关闭 · Disabled';
}

function kkToggleAuto() {
  const on = !kkGetAutoEnabled(KK_NAME);
  kkSetAutoEnabled(KK_NAME, on);
  kkRenderSettings();
  kkToast(on ? '已开启自动生成 · 每次Ta回复后可能会自动出题' : '已关闭自动生成 · 需要手动点击生成');
  const autoTag = document.getElementById('kkAutoTag');
  if (autoTag) {
    autoTag.textContent = on ? '自动生成 · 已开启' : '自动生成 · 已关闭';
    autoTag.classList.toggle('kk-pill-on', on);
  }
}
window.kkToggleAuto = kkToggleAuto;

/* 手动点击「立即生成一道新题」（设置页里提供）
   —— 和首页「ENTER · 进入叩问」走完全相同的流程：
   先进入加载屏，生成成功后直接进入题目作答屏；如果已经有一道
   待作答的题目，则直接展示那道题，不重复生成。*/
async function kkManualGenerateFromSettings() {
  if (!kkHasApiConfig()) {
    kkToast('请先在设置页配置 API');
    return;
  }
  await kkRefreshHome(); /* 确保 _kkPendingEntry 是最新的 */
  if (_kkPendingEntry) {
    kkShowQuestion(_kkPendingEntry);
    return;
  }
  const btn = document.getElementById('kkManualGenBtn');
  if (btn) { btn.disabled = true; btn.style.opacity = '.5'; btn.textContent = '正在生成…'; }
  kkGo(1); /* 加载屏，和 kkEnter 一致 */
  try {
    const entry = await kkGenerateQuestion(KK_NAME);
    if (entry) {
      kkShowQuestion(entry);
    } else {
      kkToast('这次没想出题目，稍后再试试～');
      kkGo(5);
    }
  } catch (e) {
    console.error('[kkManualGenerateFromSettings]', e);
    kkToast(kkFormatError(e, '生成失败'));
    kkGo(5);
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.textContent = '⟳ 立即生成一道新题'; }
  }
}
window.kkManualGenerateFromSettings = kkManualGenerateFromSettings;

/* ---- 统一的错误信息格式化：把 kkCallApi / JSON.parse 抛出的具体原因
   转成用户能看懂的一句话，而不是笼统的"失败了"。 ---- */
function kkFormatError(e, prefix) {
  const msg = e && e.message;
  if (msg === 'NO_API_CONFIG') return '请先在设置页配置 API';
  if (msg) return `${prefix}：${msg}`;
  return `${prefix}，稍后再试～`;
}

/* ---- 转义 ---- */
function _kkEsc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ---- 叩问页面内的小 Toast ---- */
let _kkToastTimer = null;
function kkToast(msg) {
  let t = document.getElementById('kkToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'kkToast';
    t.className = 'ss-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_kkToastTimer);
  _kkToastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ================================================================
   入口
================================================================ */
document.addEventListener('DOMContentLoaded', kkInit);