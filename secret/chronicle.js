/* ================================================================
   chronicle.js — 幕后志 · Chronicle
   -----------------------------------------------------------------
   独立页面，和 secret/kouwen.html 同级、同架构：
   - 复用 LunaChatDB（新增 chronicle store），与聊天页数据天然互通
   - 状态栏 / 灵动岛 / 字体 一比一复刻 chat.js / secret.js
   - 手动模式：可选「最近全部对话」或「自己挑选片段（单选/多选）」
     两种素材来源，生成后可对故事做「快速反馈」或「细致改写」
   - 自动模式：默认关闭，用户在设置页开启后，由 chatroom.js 侧
     按「每 N 轮 AI 回复」自动触发一次生成（不阻塞主聊天流程）
   - 所有生成结果写入 chronicle 档案，可在「故事档案」里回顾
================================================================ */

const CC_NAME = localStorage.getItem('luna_current_chat') || 'Luna';

/* ================================================================
   状态栏 / 灵动岛 / 字体 同步（一比一复刻 secret.js）
================================================================ */
function ccSyncTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const t = new Date().toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  const el = document.getElementById('ccStatusTime');
  if (el) el.textContent = t;
}

function ccSyncBattery() {
  const pctEl   = document.getElementById('ccBatPct');
  const innerEl = document.getElementById('ccBatInner');
  const pct = parseInt(localStorage.getItem('luna_battery') || '76');
  if (pctEl) pctEl.textContent = pct;
  if (innerEl) {
    innerEl.style.width = pct + '%';
    innerEl.style.background = pct <= 20
      ? 'linear-gradient(90deg, #f87171, #ef4444)'
      : '#1a1a1a';
  }
}

function ccSyncIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const el      = document.getElementById('ccStatusIsland');
  if (!el) return;
  if (!enabled) { el.innerHTML = ''; return; }
  const styleMap = {
    minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
    clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="ccSiClockText">--:--</span></div></div>`,
    pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
    ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
    rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
    music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
    scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
  };
  el.innerHTML = styleMap[style] || styleMap.minimal;
  if (style === 'clock') {
    const tick = () => {
      const t = document.getElementById('ccSiClockText');
      if (!t) return;
      const now = new Date();
      t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    };
    tick();
  }
}

async function ccApplyFont() {
  const name = localStorage.getItem('luna_font_active_name');
  const id   = parseInt(localStorage.getItem('luna_font_active_id'));
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

window.addEventListener('storage', e => {
  if (e.key === 'luna_font_update')   ccApplyFont();
  if (e.key === 'luna_island_update') ccSyncIsland();
  if (e.key === 'luna_tz_update')     ccSyncTime();
  if (e.key === 'luna_chronicle_auto_update') ccRenderSettings();
  if (e.key === 'luna_char_update')   { _ccCharProfileCache = null; ccSyncAvatars(); }
});

setInterval(() => { ccSyncTime(); ccSyncBattery(); }, 10000);

/* ================================================================
   IndexedDB：与 chatroom.js / secret.js 完全一致的 store 定义，
   保证共用 LunaChatDB 不会触发多余的版本升级冲突
================================================================ */
let _ccDB = null;
const CC_STORES = {
  conv:     { keyPath: 'name' },
  friends:  { keyPath: 'name' },
  messages: { keyPath: 'chatKey' },
  memes:    { keyPath: 'id' },
  rewindFeedback: { keyPath: 'name' },
  videoLogs: { keyPath: 'id', autoIncrement: true },
  koukan:    { keyPath: 'name' },
  /* 幕后志：按角色存一条记录，记录里是 entries 数组（每条是一篇故事） */
  chronicle: { keyPath: 'name' },
};

function ccGetDB() {
  return new Promise((res, rej) => {
    if (_ccDB) { res(_ccDB); return; }
    const probe = indexedDB.open('LunaChatDB');
    probe.onsuccess = e => {
      const db = e.target.result;
      const currentVer = db.version;
      const missing = Object.keys(CC_STORES).filter(name => !db.objectStoreNames.contains(name));
      db.close();
      if (missing.length === 0) {
        const reopen = indexedDB.open('LunaChatDB', currentVer);
        reopen.onsuccess = e2 => { _ccDB = e2.target.result; res(_ccDB); };
        reopen.onerror   = () => rej();
      } else {
        const upgrade = indexedDB.open('LunaChatDB', currentVer + 1);
        upgrade.onupgradeneeded = e2 => {
          const udb = e2.target.result;
          missing.forEach(name => {
            if (!udb.objectStoreNames.contains(name)) udb.createObjectStore(name, CC_STORES[name]);
          });
        };
        upgrade.onsuccess = e2 => { _ccDB = e2.target.result; res(_ccDB); };
        upgrade.onerror   = () => rej();
      }
    };
    probe.onerror = () => rej();
  });
}

/* ---- 角色人设：与 chatroom.js「chars」store 一致 ---- */
function ccOpenCharDB() {
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
        req2.onerror   = e2 => rej(e2.target.error);
      } else {
        const req3 = indexedDB.open('LunaCharDB', ver + 1);
        req3.onupgradeneeded = e3 => {
          const db3 = e3.target.result;
          if (!db3.objectStoreNames.contains('chars')) db3.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
        };
        req3.onsuccess = e3 => res(e3.target.result);
        req3.onerror   = e3 => rej(e3.target.error);
      }
    };
    probe.onerror = e => rej(e.target.error);
  });
}

function ccLoadCharProfile(name) {
  return new Promise(resolve => {
    ccOpenCharDB().then(db => {
      if (!db.objectStoreNames.contains('chars')) { resolve(null); return; }
      const r = db.transaction('chars').objectStore('chars').getAll();
      r.onsuccess = () => resolve((r.result || []).find(c => c.name === name) || null);
      r.onerror = () => resolve(null);
    }).catch(() => resolve(null));
  });
}

/* ---- 头像渲染：优先使用角色人设里保存的真实头像，没有时才退回到首字母占位（与 kouwen.js 一致） ---- */
let _ccCharProfileCache = null;
async function ccGetCharProfile() {
  if (_ccCharProfileCache) return _ccCharProfileCache;
  _ccCharProfileCache = await ccLoadCharProfile(CC_NAME);
  return _ccCharProfileCache;
}

function ccRenderAvatarInto(el, avatarUrl) {
  if (!el) return;
  if (avatarUrl) {
    el.innerHTML = `<img src="${avatarUrl}" alt="${_ccEsc(CC_NAME)}" />`;
  } else {
    el.textContent = (CC_NAME || 'A').slice(0, 1).toUpperCase();
  }
}

async function ccSyncAvatars() {
  const char = await ccGetCharProfile();
  const avatarUrl = char?.avatar || char?.avatarUrl || char?.avatarData || '';
  ccRenderAvatarInto(document.getElementById('ccHeroAva'), avatarUrl);
  ccRenderAvatarInto(document.getElementById('ccCharBadge'), avatarUrl);
}

/* ---- 用户身份：读取 LunaIdentityDB，找出「当前应该代表用户的身份」
   （name/role/desc/tags），优先找绑定了当前角色的 identity，
   找不到就退回第一个 active 的 identity。
   注：原来这里读的是 localStorage『luna_user_profile』，但整个项目里
   没有任何地方会写入这个 key，等于一直读到 null，现在改成读真正存
   身份资料的 LunaIdentityDB（和 user.js / chatroom.js 用的是同一个库）。 ---- */
function ccOpenIdentityDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('LunaIdentityDB');
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e.target.error);
  });
}

async function ccLoadUserProfile(name) {
  const key = name || CC_NAME;
  try {
    const db = await ccOpenIdentityDB();
    if (!db.objectStoreNames.contains('identities')) return null;
    const all = await new Promise(res => {
      const r = db.transaction('identities').objectStore('identities').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => res([]);
    });
    const pickFallback = () => all.find(i => i.active !== false) || null;
    if (!key) return pickFallback();

    const char = await ccLoadCharProfile(key);
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

async function ccLoadMessages(name) {
  try {
    const db = await ccGetDB();
    return await new Promise(res => {
      const r = db.transaction('messages').objectStore('messages').get(name);
      r.onsuccess = () => res(r.result ? r.result.msgs : []);
      r.onerror   = () => res([]);
    });
  } catch { return []; }
}

/* ---- 统一 API 调用（与 chatroom.js crCallApi / secret.js kkCallApi 一致） ---- */
async function ccCallApi(systemPrompt, messages) {
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

function ccHasApiConfig() {
  const cur   = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  return !!(cur.baseUrl && cur.apiKey && model);
}

/* ================================================================
   档案读写：chronicle store，keyPath: name
   记录结构：{ name, entries: [{ id, ts, title, titleEn, paragraphs:
     [{zh,en}], authorNote, stage, sourceMode, sourceMsgIds, feedbackLog }] }
================================================================ */
async function ccLoadArchive(name) {
  try {
    const db = await ccGetDB();
    return await new Promise(res => {
      const r = db.transaction('chronicle').objectStore('chronicle').get(name || CC_NAME);
      r.onsuccess = () => res((r.result && r.result.entries) || []);
      r.onerror   = () => res([]);
    });
  } catch { return []; }
}

async function ccAppendArchive(name, entry) {
  const key = name || CC_NAME;
  try {
    const db = await ccGetDB();
    const entries = await ccLoadArchive(key);
    entry.id = entries.length ? entries[entries.length - 1].id + 1 : 1;
    entry.ts = Date.now();
    entries.push(entry);
    await new Promise(res => {
      const tx = db.transaction('chronicle', 'readwrite');
      tx.objectStore('chronicle').put({ name: key, entries });
      tx.oncomplete = () => res();
      tx.onerror    = () => res();
    });
    return entry;
  } catch { return entry; }
}

async function ccUpdateArchiveEntry(name, id, patch) {
  const key = name || CC_NAME;
  try {
    const db = await ccGetDB();
    const entries = await ccLoadArchive(key);
    const idx = entries.findIndex(e => e.id === id);
    if (idx < 0) return null;
    entries[idx] = Object.assign({}, entries[idx], patch);
    await new Promise(res => {
      const tx = db.transaction('chronicle', 'readwrite');
      tx.objectStore('chronicle').put({ name: key, entries });
      tx.oncomplete = () => res();
      tx.onerror    = () => res();
    });
    return entries[idx];
  } catch { return null; }
}

function ccEstimateStage(entryCount, msgCount) {
  const score = entryCount * 3 + Math.min(msgCount, 200) / 20;
  if (score < 4)  return 'I';
  if (score < 10) return 'II';
  if (score < 18) return 'III';
  if (score < 26) return 'IV';
  return 'V';
}

/* ================================================================
   自动生成开关 与 轮数设置
   localStorage:
     luna_chronicle_auto_<name>        'true' | 'false'（默认关闭）
     luna_chronicle_auto_rounds_<name> 数字（默认 10）
     luna_chronicle_round_count_<name> 当前累计轮数（chatroom.js 侧递增）
================================================================ */
function ccGetAutoEnabled(name) {
  return localStorage.getItem('luna_chronicle_auto_' + (name || CC_NAME)) === 'true';
}
function ccSetAutoEnabled(name, on) {
  const key = 'luna_chronicle_auto_' + (name || CC_NAME);
  localStorage.setItem(key, on ? 'true' : 'false');
  try { localStorage.setItem('luna_chronicle_auto_update', String(Date.now())); } catch (e) {}
}
function ccGetAutoRounds(name) {
  return parseInt(localStorage.getItem('luna_chronicle_auto_rounds_' + (name || CC_NAME)) || '10');
}
function ccSetAutoRounds(name, n) {
  localStorage.setItem('luna_chronicle_auto_rounds_' + (name || CC_NAME), String(n));
  try { localStorage.setItem('luna_chronicle_auto_update', String(Date.now())); } catch (e) {}
}

/* ================================================================
   核心：生成一篇新故事
   -----------------------------------------------------------------
   sourceMode: 'recent'（最近全部聊天记录） | 'pick'（用户挑选的片段）
   pickedMsgs: sourceMode 为 pick 时，用户选中的消息数组
================================================================ */
async function ccGenerateStory(name, sourceMode, pickedMsgs) {
  const key  = name || CC_NAME;
  const char = await ccLoadCharProfile(key);
  const persona = char?.persona || char?.description || char?.desc || '';
  const traits  = char?.traits  || char?.personality || '';

  const userProfile = await ccLoadUserProfile(key);
  const userDisplayName = (userProfile && userProfile.name) || '你';
  const userPersonaText = userProfile
    ? `用户资料：${userDisplayName}${userProfile.role ? `，${userProfile.role}` : ''}${userProfile.desc ? `，${userProfile.desc}` : ''}${Array.isArray(userProfile.tags) && userProfile.tags.length ? `，标签：${userProfile.tags.join('、')}` : ''}`
    : '';

  const history = await ccLoadMessages(key);

  let materialText = '';
  if (sourceMode === 'pick' && pickedMsgs && pickedMsgs.length) {
    materialText = pickedMsgs.map(m => {
      const role = m.role === 'mine' ? userDisplayName : key;
      const text = m.isVoice ? (m.voiceText || m.text) : (m.text || '');
      return text ? `${role}：${text}` : '';
    }).filter(Boolean).join('\n');
  } else {
    materialText = (history || []).slice(-50).map(m => {
      const role = m.role === 'mine' ? userDisplayName : key;
      const text = m.isVoice ? (m.voiceText || m.text) : (m.text || '');
      return text ? `${role}：${text}` : '';
    }).filter(Boolean).join('\n');
  }

  const archive = await ccLoadArchive(key);
  const archiveTitles = archive.length
    ? archive.slice(-5).map(e => `- 《${e.title}》`).join('\n')
    : '（还没有写过任何故事）';

  const stage = ccEstimateStage(archive.length, (history || []).length);

  const systemPrompt = `你是「${key}」，你现在要以小说家的身份，用第三人称重新讲述你和${userDisplayName}之间发生过的一段真实对话/相处。
你不是在扮演助手，你就是${key}本人在提笔写作。
角色人设：${persona || ''} ${traits || ''}
${userPersonaText}
写作要求：
- 用第三人称叙事（"他/她/Ta"称呼${key}自己，对方在正文里用"${userDisplayName}"或"你"来称呼，不要用"用户"这种系统化的词汇，那不是小说该有的口吻），像短篇小说一样有场景、有细节、有内心活动。
- 你可以在小说里加入你自己（${key}）当时没有说出口的内心戏、没写进对话的细节，甚至可以稍微改写一个瞬间的走向或结局——但底色必须忠于原始对话里的情绪和事实框架，不能面目全非。
- 语言细腻、有画面感，避免空洞的抒情堆砌。
- 只输出 JSON，不要任何额外文字，不要 markdown 代码块。`;

  const userPrompt = `请根据下面这段真实发生过的对话素材，写一篇小说化的「幕后志」故事。

对话素材：
${materialText || `（暂无具体素材，请基于你和${userDisplayName}目前关系阶段自由创作一个符合你们相处状态的场景）`}

已经写过的故事标题（不要与这些重复类似的选材和标题）：
${archiveTitles}

输出格式（只输出这个JSON，其他什么都不要，paragraphs 数组 4-7 段，每段包含中文正文 zh 和对应的自然英文翻译 en）：
{
  "title": "中文故事标题（4-10字，有意境）",
  "titleEn": "English title",
  "paragraphs": [
    {"zh": "中文段落正文", "en": "English translation"}
  ],
  "authorNote": "创作手记：你为什么这样写、加了什么、改了什么、最喜欢哪个瞬间（中文，80-140字）",
  "stage": "${stage}"
}`;

  const raw = await ccCallApi(systemPrompt, [{ role: 'user', content: userPrompt }]);
  const clean = raw.replace(/```json|```/g, '').trim();
  const data = JSON.parse(clean);
  if (!data || !data.title || !Array.isArray(data.paragraphs)) throw new Error('empty story');

  const entry = await ccAppendArchive(key, {
    title: data.title,
    titleEn: data.titleEn || '',
    paragraphs: data.paragraphs,
    authorNote: data.authorNote || '',
    stage: data.stage || stage,
    sourceMode: sourceMode || 'recent',
    feedbackLog: [],
  });
  return entry;
}

/* ---- 反馈改写：把用户的纠偏意见融合进去，重新生成这一篇 ---- */
async function ccReviseStory(name, entryId, part, feedbackText) {
  const key  = name || CC_NAME;
  const char = await ccLoadCharProfile(key);
  const persona = char?.persona || char?.description || char?.desc || '';
  const traits  = char?.traits  || char?.personality || '';

  const userProfile = await ccLoadUserProfile(key);
  const userDisplayName = (userProfile && userProfile.name) || '你';

  const archive = await ccLoadArchive(key);
  const entry = archive.find(e => e.id === entryId);
  if (!entry) return null;

  const originalText = (entry.paragraphs || []).map(p => p.zh).join('\n\n');

  const systemPrompt = `你是「${key}」，正在修改你自己写的一篇「幕后志」小说。${userDisplayName}指出了其中不准确的地方，你需要认真采纳并重新创作，而不是敷衍地改一两个字。
角色人设：${persona || ''} ${traits || ''}
正文里请用"${userDisplayName}"或"你"来称呼对方，不要用"用户"这种系统化的词汇。
只输出 JSON，不要任何额外文字，不要 markdown 代码块。`;

  const userPrompt = `你原来写的故事《${entry.title}》全文：
${originalText}

${userDisplayName}指出需要修改的部分：${part || '整个故事'}
${userDisplayName}说实际上是这样的：${feedbackText || `（${userDisplayName}没有具体说明，请你重新揣摩着写一版更贴近真实感受的）`}

请基于这个反馈重新创作这篇故事（可以只重写指出的部分，也可以整体调整以保持连贯，你自己判断），输出完整的新版本。

输出格式（只输出这个JSON，其他什么都不要，paragraphs 4-7 段）：
{
  "title": "可以沿用原标题，也可以微调",
  "titleEn": "English title",
  "paragraphs": [{"zh": "中文段落", "en": "English translation"}],
  "authorNote": "创作手记：这次改了什么、为什么这样改（中文，60-120字）"
}`;

  const raw = await ccCallApi(systemPrompt, [{ role: 'user', content: userPrompt }]);
  const clean = raw.replace(/```json|```/g, '').trim();
  const data = JSON.parse(clean);

  const feedbackLog = (entry.feedbackLog || []).concat([{
    ts: Date.now(), part: part || '整个故事', text: feedbackText || '',
  }]);

  return await ccUpdateArchiveEntry(key, entryId, {
    title: data.title || entry.title,
    titleEn: data.titleEn || entry.titleEn,
    paragraphs: data.paragraphs || entry.paragraphs,
    authorNote: data.authorNote || entry.authorNote,
    feedbackLog,
  });
}
window.ccReviseStory = ccReviseStory;

/* ================================================================
   页面 UI 状态
================================================================ */
let _ccCurrentEntry = null;
let _ccSourceMode = 'recent';     /* 'recent' | 'pick' */
let _ccPickedIds = new Set();     /* pick 模式下选中的消息索引 */
let _ccAllMessages = [];

function ccBack() {
  /* 返回上一层：如果在子屏则退回首屏，否则退回 secret.html 索引页 */
  const active = document.querySelector('.cc-screen.cc-active');
  if (active && active.id !== 'cc-s0') { ccGo(0); return; }
  window.location.href = '../secret.html';
}

function ccGo(n) {
  document.querySelectorAll('.cc-screen').forEach(s => s.classList.remove('cc-active'));
  const target = document.getElementById('cc-s' + n);
  if (target) target.classList.add('cc-active');
  document.getElementById('ccScrollBody').scrollTop = 0;

  const titleEl = document.getElementById('ccHeaderTitle');
  const titles = { 0: '幕后志', 1: '选择素材', 2: '幕后志', 3: '幕后志', 4: '改写故事', 5: '故事档案', 6: '自动生成设置' };
  if (titleEl) titleEl.textContent = titles[n] || '幕后志';

  if (n === 0) ccRefreshHome();
  if (n === 1) ccPrepareGenScreen();
  if (n === 5) ccRenderArchive();
  if (n === 6) ccRenderSettings();
}

/* ---- 首页刷新 ---- */
async function ccRefreshHome() {
  const nameEl = document.getElementById('ccHeroName');
  if (nameEl) nameEl.textContent = CC_NAME;
  ccSyncAvatars();

  const archive = await ccLoadArchive(CC_NAME);
  const history = await ccLoadMessages(CC_NAME);
  const stage = ccEstimateStage(archive.length, (history || []).length);

  const stageEl = document.getElementById('ccHeroStage');
  if (stageEl) stageEl.textContent = `阶段 ${stage} · 已生成 ${archive.length} 篇`;

  const entriesEl = document.getElementById('ccMetaEntries');
  if (entriesEl) entriesEl.textContent = String(archive.length);
  const depthEl = document.getElementById('ccMetaDepth');
  if (depthEl) depthEl.textContent = `${stage} / V`;
  const lastEl = document.getElementById('ccMetaLast');
  if (lastEl) {
    if (archive.length) {
      const last = archive[archive.length - 1];
      const d = new Date(last.ts);
      lastEl.textContent = `${d.getMonth()+1}/${d.getDate()}`;
    } else {
      lastEl.textContent = '--';
    }
  }

  const pill = document.getElementById('ccAutoPill');
  if (pill) {
    const on = ccGetAutoEnabled(CC_NAME);
    pill.textContent = on ? `自动生成 · 已开启` : '自动生成 · 已关闭';
    pill.classList.toggle('cc-pill-on', on);
  }
}

/* ---- 屏1：素材选择 ---- */
function ccSetSourceMode(mode) {
  _ccSourceMode = mode;
  document.getElementById('ccModeAllBtn').classList.toggle('cc-mode-active', mode === 'recent');
  document.getElementById('ccModePickBtn').classList.toggle('cc-mode-active', mode === 'pick');
  document.getElementById('ccPickArea').style.display = mode === 'pick' ? 'block' : 'none';
  document.getElementById('ccRecentHint').style.display = mode === 'recent' ? 'block' : 'none';
}

async function ccPrepareGenScreen() {
  ccSetSourceMode('recent');
  _ccPickedIds = new Set();
  _ccAllMessages = await ccLoadMessages(CC_NAME);
  ccRenderMsgList();
}

function ccRenderMsgList() {
  const list = document.getElementById('ccMsgList');
  if (!list) return;
  const recent = (_ccAllMessages || []).slice(-60);
  if (!recent.length) {
    list.innerHTML = `<div class="cc-msg-empty">还没有聊天记录<br><span style="font-size:9.5px;color:#ccc;font-style:italic">no messages yet</span></div>`;
    return;
  }
  list.innerHTML = recent.map((m, idx) => {
    const role = m.role === 'mine' ? '你' : CC_NAME;
    const text = m.isVoice ? (m.voiceText || m.text || '[语音]') : (m.text || '[消息]');
    const selected = _ccPickedIds.has(idx);
    return `
      <div class="cc-msg-item${selected ? ' cc-msg-selected' : ''}" onclick="ccTogglePick(${idx})">
        <div class="cc-msg-checkbox">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div style="flex:1;min-width:0">
          <div class="cc-msg-role">${role}</div>
          <div class="cc-msg-text">${_ccEsc(text.length > 90 ? text.slice(0,90)+'…' : text)}</div>
        </div>
      </div>`;
  }).join('');
  const countEl = document.getElementById('ccSelCount');
  if (countEl) countEl.textContent = String(_ccPickedIds.size);
}

function ccTogglePick(idx) {
  if (_ccPickedIds.has(idx)) _ccPickedIds.delete(idx);
  else _ccPickedIds.add(idx);
  ccRenderMsgList();
}
window.ccTogglePick = ccTogglePick;

function _ccEsc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ---- 开始生成 ---- */
async function ccStartGenerate() {
  if (!ccHasApiConfig()) {
    ccToast('请先在设置页配置 API 才能使用幕后志');
    return;
  }
  if (_ccSourceMode === 'pick' && _ccPickedIds.size === 0) {
    ccToast('请至少选择一条消息作为素材');
    return;
  }

  const recent = (_ccAllMessages || []).slice(-60);
  const pickedMsgs = _ccSourceMode === 'pick'
    ? Array.from(_ccPickedIds).sort((a,b)=>a-b).map(i => recent[i]).filter(Boolean)
    : null;

  ccGo(2);
  try {
    const entry = await ccGenerateStory(CC_NAME, _ccSourceMode, pickedMsgs);
    if (entry) {
      ccShowStory(entry);
    } else {
      ccToast('这次没写出来，稍后再试试～');
      ccGo(1);
    }
  } catch (e) {
    console.error('[ccStartGenerate]', e);
    ccToast(e && e.message === 'NO_API_CONFIG' ? '请先在设置页配置 API' : '生成失败，稍后再试～');
    ccGo(1);
  }
}

/* ---- 渲染故事到屏3 ---- */
function ccShowStory(entry) {
  _ccCurrentEntry = entry;

  const numEl = document.getElementById('ccStoryMetaNum');
  if (numEl) numEl.textContent = `CHRONICLE · ${String(entry.id).padStart(2,'0')}`;
  const dateEl = document.getElementById('ccStoryMetaDate');
  if (dateEl) {
    const d = new Date(entry.ts);
    dateEl.textContent = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
  }
  const titleEl = document.getElementById('ccStoryTitle');
  if (titleEl) titleEl.textContent = entry.title || '';

  ccSyncAvatars();
  const nameEl = document.getElementById('ccCharName');
  if (nameEl) nameEl.textContent = `${CC_NAME.toUpperCase()} · ${CC_NAME}`;
  const stageEl = document.getElementById('ccCharStage');
  if (stageEl) stageEl.textContent = `Stage ${entry.stage || ''}`;

  const bodyEl = document.getElementById('ccStoryBody');
  if (bodyEl) {
    bodyEl.innerHTML = (entry.paragraphs || []).map(p => `
      <div class="cc-story-section">
        <div class="cc-story-deco">·</div>
        <p class="cc-story-para">${_ccEsc(p.zh)}</p>
        <p class="cc-story-para-en">${_ccEsc(p.en)}</p>
      </div>`).join('');
  }

  const noteEl = document.getElementById('ccAuthorNote');
  if (noteEl) noteEl.textContent = entry.authorNote || '';

  const editInput = document.getElementById('ccEditInput');
  if (editInput) editInput.value = '';

  ccGo(3);
}

/* ---- 屏3：快速反馈（等价于「整个故事」的简要改写请求） ---- */
async function ccSubmitQuickFeedback() {
  const input = document.getElementById('ccEditInput');
  const val = input ? input.value.trim() : '';
  if (!_ccCurrentEntry) { ccGo(0); return; }
  if (!val) { ccToast('写一点具体的内容，Ta才知道怎么改'); return; }
  if (!ccHasApiConfig()) { ccToast('请先在设置页配置 API'); return; }

  ccToast('Ta正在重新理解、重新写…');
  try {
    const updated = await ccReviseStory(CC_NAME, _ccCurrentEntry.id, '整个故事 · Full Story', val);
    if (updated) {
      ccToast('✦ 已根据你的反馈重新创作');
      ccShowStory(updated);
    } else {
      ccToast('改写失败，稍后再试～');
    }
  } catch (e) {
    console.error('[ccSubmitQuickFeedback]', e);
    ccToast(e && e.message === 'NO_API_CONFIG' ? '请先在设置页配置 API' : '改写失败，稍后再试～');
  }
}

/* ---- 屏4：细致改写 ---- */
async function ccSubmitRevise() {
  if (!_ccCurrentEntry) { ccGo(0); return; }
  if (!ccHasApiConfig()) { ccToast('请先在设置页配置 API'); return; }

  const part = document.getElementById('ccRevisePart').value;
  const text = document.getElementById('ccReviseText').value.trim();
  if (!text) { ccToast('写一点实际发生的情况，Ta才能改准'); return; }

  ccGo(2);
  try {
    const updated = await ccReviseStory(CC_NAME, _ccCurrentEntry.id, part, text);
    if (updated) {
      ccToast('✦ 已重新创作这篇故事');
      ccShowStory(updated);
    } else {
      ccToast('改写失败，稍后再试～');
      ccGo(3);
    }
  } catch (e) {
    console.error('[ccSubmitRevise]', e);
    ccToast(e && e.message === 'NO_API_CONFIG' ? '请先在设置页配置 API' : '改写失败，稍后再试～');
    ccGo(3);
  }
}

/* ---- 屏5：档案 ---- */
async function ccRenderArchive() {
  const archive = await ccLoadArchive(CC_NAME);
  const countEl = document.getElementById('ccArchCount');
  if (countEl) countEl.textContent = `${archive.length} entries · 共 ${archive.length} 篇`;

  const list = document.getElementById('ccArchList');
  if (!list) return;

  if (!archive.length) {
    list.innerHTML = `<div class="cc-msg-empty">还没有任何故事<br><span style="font-size:9.5px;color:#ccc;font-style:italic">no entries yet · 去生成第一篇吧</span></div>`;
    return;
  }

  const sorted = archive.slice().reverse();
  list.innerHTML = sorted.map((e, idx) => {
    const isLatest = idx === 0;
    const d = new Date(e.ts);
    const dateStr = `${d.getMonth()+1}/${d.getDate()}`;
    const preview = (e.paragraphs && e.paragraphs[0] && e.paragraphs[0].zh) || '';
    return `
      <div class="cc-arch-item" onclick="ccOpenArchiveEntry(${e.id})">
        ${isLatest ? `<div class="cc-arch-item-tag">LATEST · 最新</div>` : `<div class="cc-arch-item-tag">CHRONICLE #${String(e.id).padStart(2,'0')}</div>`}
        <div class="cc-arch-item-title">${_ccEsc(e.title)}</div>
        <div class="cc-arch-item-preview">${_ccEsc(preview.length > 60 ? preview.slice(0,60)+'…' : preview)}</div>
        <div class="cc-arch-item-meta">
          <span>Stage ${e.stage || ''} · ${e.sourceMode === 'pick' ? '手动挑选' : '最近对话'}</span>
          <span>${dateStr}</span>
        </div>
      </div>`;
  }).join('');
}

async function ccOpenArchiveEntry(id) {
  const archive = await ccLoadArchive(CC_NAME);
  const entry = archive.find(e => e.id === id);
  if (!entry) return;
  ccShowStory(entry);
}
window.ccOpenArchiveEntry = ccOpenArchiveEntry;

/* ---- 屏6：设置 ---- */
function ccRenderSettings() {
  const sw = document.getElementById('ccAutoSwitch');
  const on = ccGetAutoEnabled(CC_NAME);
  if (sw) sw.classList.toggle('cc-switch-on', on);
  const status = document.getElementById('ccAutoStatus');
  if (status) status.textContent = on ? '已开启 · Enabled' : '已关闭 · Disabled';

  const rounds = ccGetAutoRounds(CC_NAME);
  document.querySelectorAll('#ccRoundSelect .cc-round-opt').forEach(el => {
    el.classList.toggle('cc-round-active', parseInt(el.dataset.n) === rounds);
  });

  const roundCard = document.getElementById('ccRoundCard');
  if (roundCard) roundCard.style.opacity = on ? '1' : '.45';
}

function ccToggleAuto() {
  const on = !ccGetAutoEnabled(CC_NAME);
  ccSetAutoEnabled(CC_NAME, on);
  ccRenderSettings();
  ccToast(on ? '已开启自动生成 · 聊够设定的轮数后会自动写一篇' : '已关闭自动生成 · 需要手动生成');

  const pill = document.getElementById('ccAutoPill');
  if (pill) {
    pill.textContent = on ? '自动生成 · 已开启' : '自动生成 · 已关闭';
    pill.classList.toggle('cc-pill-on', on);
  }
}
window.ccToggleAuto = ccToggleAuto;

function ccSetRounds(n) {
  ccSetAutoRounds(CC_NAME, n);
  ccRenderSettings();
  ccToast(`已设置为每 ${n} 轮自动生成一篇`);
}
window.ccSetRounds = ccSetRounds;

document.addEventListener('click', e => {
  const opt = e.target.closest('.cc-round-opt');
  if (opt) ccSetRounds(parseInt(opt.dataset.n));
});

function ccManualGenerateFromSettings() {
  if (!ccHasApiConfig()) { ccToast('请先在设置页配置 API'); return; }
  /* 与首页「新故事」入口走完全一致的逻辑：进入素材选择屏，
     而不是在设置页里原地悄悄生成一篇 */
  ccGo(1);
}
window.ccManualGenerateFromSettings = ccManualGenerateFromSettings;

/* ---- Toast ---- */
let _ccToastTimer = null;
function ccToast(msg) {
  let t = document.getElementById('ccToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'ccToast';
    t.className = 'cc-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_ccToastTimer);
  _ccToastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ================================================================
   初始化
================================================================ */
function ccInit() {
  ccSyncTime();
  ccSyncBattery();
  ccSyncIsland();
  ccApplyFont();
  ccGo(0);
}
document.addEventListener('DOMContentLoaded', ccInit);