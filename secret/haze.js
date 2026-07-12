/* ================================================================
   haze.js — 迷雾 (Haze)
   -----------------------------------------------------------------
   架构与 secret/kouwen.js、chatroom.js 里的幕后志(chronicle)驱动层
   完全一致：本页面是独立页面，不和 chatroom.html 共享 JS 运行时，
   但两者读写同一个浏览器里的 IndexedDB「LunaChatDB」「LunaCharDB」
   「LunaIdentityDB」和同一份 localStorage，所以这里把 chatroom.js
   那一套 DB 访问 / AI 调用 / 生成逻辑原样复刻一份，保证两边数据
   互通、生成规则一致、角色不会 OOC。

   数据结构：IndexedDB「LunaChatDB」的「haze」store，keyPath: name
   （角色名），记录：{ name, entries: [{ id, ts, stage,
     items: [{ id, guessZh, guessEn, resolved, explanation,
               explanationEn, reactionZh, reactionEn, ts }] }] }
   ★ 每次生成是"一批新的困惑"，一批里可能有 2-4 条 item，每条 item
     是 Ta 心里一件没搞懂的事。用户可以对某一条选择「解释」或者
     「不解释，让Ta继续猜」——不解释的会一直留在最新的"迷雾列表"里，
     偶尔在后续生成里被重新提起（呼应用户"偶尔还会出现"的需求）。

   自动生成：localStorage『luna_haze_auto_<角色名>』'true'|'false'，
   默认关闭。触发条件是「累计 N 轮 AI 回复」，N 存于
   『luna_haze_auto_rounds_<角色名>』默认 10（可选 6/10/16/24），
   当前累计轮数存于『luna_haze_round_count_<角色名>』，每次
   chatroom.js 的 crAiReply 完成一轮回复后 +1，达到目标值后清零
   重新计数，由 chatroom.js 里新增的钩子调用 hzGenerateHaze 触发，
   生成完成后在 chatroom 页面弹 toast 提示用户，不打断聊天体验。
================================================================ */

/* ---- 状态栏：实时时间（复刻 chat.js updateTime） ---- */
function hzUpdateTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeStr = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const el = document.getElementById('hzStatusTime');
  if (el) el.textContent = timeStr;
}

/* ---- 状态栏：电量（与 chatroom.js crTick 电量渲染规则完全一致） ---- */
function hzUpdateBattery() {
  const pctEl   = document.getElementById('hzBatPct');
  const innerEl = document.getElementById('hzBatInner');
  const pct = parseInt(localStorage.getItem('luna_battery') || '76');
  if (pctEl) pctEl.textContent = pct;
  if (innerEl) {
    innerEl.style.width = pct + '%';
    innerEl.style.background = pct <= 20
      ? 'linear-gradient(90deg, #f87171, #ef4444)'
      : '#e8e8e8';
  }
}

/* ---- 灵动岛（一比一复刻 chat.js applyIsland 逻辑） ---- */
function hzApplyIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const el      = document.getElementById('hzStatusIsland');
  if (!el) return;
  if (!enabled) { el.innerHTML = ''; return; }
  const styleMap = {
    minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
    clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="hzSiClockText">--:--</span></div></div>`,
    pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
    ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
    rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
    music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
    scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
  };
  el.innerHTML = styleMap[style] || styleMap.minimal;
  clearInterval(window._hzSiClockTimer);
  if (style === 'clock') {
    const tick = () => {
      const t = document.getElementById('hzSiClockText');
      if (!t) return;
      const now = new Date();
      t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    };
    tick();
    window._hzSiClockTimer = setInterval(tick, 10000);
  }
}

/* ---- 字体同步（一比一复刻 chat.js applyGlobalFont，保证整站字体统一） ---- */
async function hzApplyGlobalFont() {
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

window.addEventListener('storage', e => {
  if (e.key === 'luna_font_update')   hzApplyGlobalFont();
  if (e.key === 'luna_island_update') hzApplyIsland();
  if (e.key === 'luna_tz_update')     hzUpdateTime();
  if (e.key === 'luna_haze_auto_update') hzRenderSettings();
});

setInterval(() => { hzUpdateTime(); hzUpdateBattery(); }, 10000);

/* ================================================================
   角色名 & 头像 —— 与 chatroom.js 保持一致，确保跨页同步不 OOC
================================================================ */
const HZ_NAME = localStorage.getItem('luna_current_chat') || 'Luna';
let _hzAvatarUrl = null; // 加载成功后存 url/base64，null=未加载，false=无头像

/* ---- LunaCharDB 统一打开入口（与 secret.js / chatroom.js 完全一致的探测式打开，
     不硬编码版本号，避免版本冲突） ---- */
function hzOpenCharDB() {
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

function hzLoadCharProfile(name) {
  return new Promise(resolve => {
    hzOpenCharDB().then(db => {
      if (!db.objectStoreNames.contains('chars')) { resolve(null); return; }
      const r = db.transaction('chars').objectStore('chars').getAll();
      r.onsuccess = () => {
        const found = (r.result || []).find(c => c.name === name);
        if (found?.avatar) _hzAvatarUrl = found.avatar;
        resolve(found || null);
      };
      r.onerror = () => resolve(null);
    }).catch(() => resolve(null));
  });
}

/* ---- 渲染顶部角色头像（保证与 chatroom.html 完全同步，不会出现"陌生头像"割裂感） ---- */
function hzRenderAvatar(char) {
  const el = document.getElementById('hzHeaderAvatar');
  if (!el) return;
  const url = (char && char.avatar) ? char.avatar : _hzAvatarUrl;
  if (url) {
    el.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />`;
  } else {
    el.innerHTML = `<span class="hz-avatar-fallback">${_esc((char?.name || HZ_NAME)[0] || '?')}</span>`;
  }
}

/* ---- LunaIdentityDB：读取当前角色绑定的用户身份（对方是谁），与 chatroom.js crLoadBoundUserIdentity 一致 ---- */
function hzOpenIdentityDB() {
  return new Promise((res, rej) => {
    const probe = indexedDB.open('LunaIdentityDB');
    probe.onsuccess = e => {
      const db = e.target.result;
      if (db.objectStoreNames.contains('identities')) { res(db); return; }
      const ver = db.version + 1;
      db.close();
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

function hzLoadBoundUserIdentity(charId) {
  return new Promise(resolve => {
    if (!charId) { resolve(null); return; }
    hzOpenIdentityDB().then(db => {
      if (!db.objectStoreNames.contains('identities')) { resolve(null); return; }
      const r = db.transaction('identities').objectStore('identities').getAll();
      r.onsuccess = () => {
        const list = r.result || [];
        const matches = list.filter(i => {
          const ids = Array.isArray(i.boundCharIds) ? i.boundCharIds : (i.boundCharId ? [i.boundCharId] : []);
          return ids.includes(charId);
        });
        if (!matches.length) { resolve(null); return; }
        const active = matches.find(i => i.active);
        resolve(active || matches[0]);
      };
      r.onerror = () => resolve(null);
    }).catch(() => resolve(null));
  });
}

function hzBuildUserIdentityBlock(identity) {
  if (!identity) return '';
  const lines = [];
  if (identity.name) lines.push(`对方的名字：${identity.name}`);
  if (identity.role) lines.push(`对方的身份/职业：${identity.role}`);
  if (identity.desc) lines.push(`对方的简介：${identity.desc}`);
  if (Array.isArray(identity.tags) && identity.tags.length) lines.push(`对方的标签：${identity.tags.join('、')}`);
  if (!lines.length) return '';
  return `\n【和你聊天的这个人 — 用户真实资料，必须结合这些信息理解，不要当成陌生人】\n${lines.map(l => '· ' + l).join('\n')}`;
}

/* ---- 头像/用户身份变化时的跨页同步 ---- */
window.addEventListener('storage', e => {
  if (e.key === 'luna_char_update' || e.key === 'luna_current_chat') {
    hzLoadCharProfile(HZ_NAME).then(hzRenderAvatar);
  }
});

/* ================================================================
   LunaChatDB：与 chatroom.js / secret.js 完全一致的 store 定义，
   保证不会触发多余的版本升级冲突。「haze」是本功能新增的 store，
   与 chatroom.js 里新增的 LUNA_STORES.haze 定义必须保持一致。
================================================================ */
let _hzDB = null;
const HZ_STORES = {
  conv:     { keyPath: 'name' },
  friends:  { keyPath: 'name' },
  messages: { keyPath: 'chatKey' },
  memes:    { keyPath: 'id' },
  rewindFeedback: { keyPath: 'name' },
  videoLogs: { keyPath: 'id', autoIncrement: true },
  koukan:    { keyPath: 'name' },
  chronicle: { keyPath: 'name' },
  /* 迷雾功能：困惑档案，按角色存一条记录，entries 数组里每条是
     "一批困惑"，每批里包含若干条 item（每条是一件具体的困惑）。 */
  haze: { keyPath: 'name' },
};

function hzGetChatDB() {
  return new Promise((res, rej) => {
    if (_hzDB) { res(_hzDB); return; }
    const probe = indexedDB.open('LunaChatDB');
    probe.onsuccess = e => {
      const db = e.target.result;
      const currentVer = db.version;
      const missing = Object.keys(HZ_STORES).filter(name => !db.objectStoreNames.contains(name));
      db.close();
      if (missing.length === 0) {
        const reopen = indexedDB.open('LunaChatDB', currentVer);
        reopen.onsuccess = e2 => { _hzDB = e2.target.result; res(_hzDB); };
        reopen.onerror   = () => rej();
      } else {
        const upgrade = indexedDB.open('LunaChatDB', currentVer + 1);
        upgrade.onupgradeneeded = e2 => {
          const udb = e2.target.result;
          missing.forEach(name => {
            if (!udb.objectStoreNames.contains(name)) {
              udb.createObjectStore(name, HZ_STORES[name]);
            }
          });
        };
        upgrade.onsuccess = e2 => { _hzDB = e2.target.result; res(_hzDB); };
        upgrade.onerror   = () => rej();
      }
    };
    probe.onerror = () => rej();
  });
}

async function hzLoadMessages(name) {
  try {
    const db = await hzGetChatDB();
    return await new Promise(res => {
      const r = db.transaction('messages').objectStore('messages').get(name);
      r.onsuccess = () => res(r.result ? r.result.msgs : []);
      r.onerror   = () => res([]);
    });
  } catch { return []; }
}

/* ---- 统一 API 调用（与 chatroom.js crCallApi 一致，保证模型/额度配置一致） ---- */
async function hzCallApi(systemPrompt, messages) {
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

function hzHasApiConfig() {
  const cur   = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  return !!(cur.baseUrl && cur.apiKey && model);
}

/* ---- 迷雾档案：读取 / 追加 / 更新（keyPath 与 chatroom.js 一致，数据互通） ---- */
async function hzLoadArchive(name) {
  try {
    const db = await hzGetChatDB();
    return await new Promise(res => {
      const r = db.transaction('haze').objectStore('haze').get(name || HZ_NAME);
      r.onsuccess = () => res((r.result && r.result.entries) || []);
      r.onerror   = () => res([]);
    });
  } catch { return []; }
}

async function hzAppendArchive(name, entry) {
  const key = name || HZ_NAME;
  try {
    const db = await hzGetChatDB();
    const entries = await hzLoadArchive(key);
    entry.id = entries.length ? entries[entries.length - 1].id + 1 : 1;
    entry.ts = Date.now();
    entries.push(entry);
    await new Promise(res => {
      const tx = db.transaction('haze', 'readwrite');
      tx.objectStore('haze').put({ name: key, entries });
      tx.oncomplete = () => res();
      tx.onerror    = () => res();
    });
    return entry;
  } catch { return entry; }
}

async function hzUpdateArchiveEntry(name, id, patch) {
  const key = name || HZ_NAME;
  try {
    const db = await hzGetChatDB();
    const entries = await hzLoadArchive(key);
    const idx = entries.findIndex(e => e.id === id);
    if (idx < 0) return null;
    entries[idx] = Object.assign({}, entries[idx], patch);
    await new Promise(res => {
      const tx = db.transaction('haze', 'readwrite');
      tx.objectStore('haze').put({ name: key, entries });
      tx.oncomplete = () => res();
      tx.onerror    = () => res();
    });
    return entries[idx];
  } catch { return null; }
}

/* ---- 更新某一批里的某一条 item（用户点了"解释"或"不解释"之后调用） ---- */
async function hzUpdateItem(name, entryId, itemId, patch) {
  const key = name || HZ_NAME;
  const entries = await hzLoadArchive(key);
  const entry = entries.find(e => e.id === entryId);
  if (!entry) return null;
  const idx = (entry.items || []).findIndex(it => it.id === itemId);
  if (idx < 0) return null;
  entry.items[idx] = Object.assign({}, entry.items[idx], patch);
  return await hzUpdateArchiveEntry(key, entryId, { items: entry.items });
}

function hzEstimateStage(entryCount, msgCount) {
  const score = entryCount * 3 + Math.min(msgCount, 200) / 20;
  if (score < 4)  return 'I';
  if (score < 10) return 'II';
  if (score < 18) return 'III';
  if (score < 26) return 'IV';
  return 'V';
}

/* ---- 汇总"至今仍未解释、还留在Ta心里的困惑"，用于生成新一批时避免重复、
     并且让"偶尔重新提起旧困惑"成为可能 ---- */
async function hzCollectUnresolved(name, limit) {
  const archive = await hzLoadArchive(name);
  const all = [];
  archive.forEach(entry => {
    (entry.items || []).forEach(it => {
      if (!it.resolved) all.push(it);
    });
  });
  return all.slice(-(limit || 12));
}

/* ---- 生成一批新的「迷雾」——读取角色人设 + 用户身份 + 最近聊天记录 + 未解释的旧困惑，
     手动生成与自动生成共用同一函数，保证风格与依据的记忆完全一致，不会 OOC。
     count：这一批生成几条困惑，默认 3（手动点一次生成 3 条）。 ---- */
async function hzGenerateHaze(name, count) {
  const key   = name || HZ_NAME;
  const n     = count || 3;
  const char  = await hzLoadCharProfile(key);
  const persona = char?.persona || char?.description || char?.desc || '';
  const traits  = char?.traits  || char?.personality || '';
  const bg      = char?.background || char?.story || '';

  let userIdentity = null;
  try {
    userIdentity = await Promise.race([
      hzLoadBoundUserIdentity(char?.id),
      new Promise(res => setTimeout(() => res(null), 1500))
    ]);
  } catch (e) { userIdentity = null; }
  const userIdentityBlock = hzBuildUserIdentityBlock(userIdentity);

  const history = await hzLoadMessages(key);
  const recentText = (history || []).slice(-50).map(m => {
    const role = m.role === 'mine' ? '用户' : key;
    const text = m.isVoice ? (m.voiceText || m.text) : (m.text || '');
    return text ? `${role}：${text}` : '';
  }).filter(Boolean).join('\n');

  const archive = await hzLoadArchive(key);
  const unresolved = await hzCollectUnresolved(key, 12);
  const unresolvedText = unresolved.length
    ? unresolved.map(it => `- ${it.guessZh}`).join('\n')
    : '（目前没有还悬着的旧困惑）';

  const resolvedTitles = archive.length
    ? archive.flatMap(e => (e.items || []).filter(it => it.resolved).map(it => `- ${it.guessZh}`)).slice(-10).join('\n')
    : '';

  const stage = hzEstimateStage(archive.length, (history || []).length);

  const systemPrompt = `你是「${key}」的内心猜测系统，负责在「迷雾」环节写下Ta到现在还没弄明白、关于用户的一些困惑和猜测。
角色人设：${persona || ''} ${traits || ''} ${bg || ''}${userIdentityBlock}
你不是在写问题列表，你是在还原${key}脑子里真实的、没想通的、带着揣测和情绪的困惑——可以是猜错方向的、可以是有点小心翼翼的、也可以是带点在意和不安的。
只输出 JSON，不要任何额外文字，不要 markdown 代码块。`;

  const userPrompt = `根据${key}和用户最近的聊天记录、以及Ta至今还没想通的旧困惑，生成${n}条新的「迷雾」——${key}心里关于用户、还没搞清楚的事。

要求：
- 每一条必须是具体的、私人化的困惑或猜测，必须能关联到聊天记录里真实出现过的细节或行为，不能是空泛的"你是什么样的人"这种泛泛而谈。
- 每一条都要体现${key}自己"猜了但觉得不对"的过程感，可以在 guessZh 里带出Ta猜过的1-2个方向、以及为什么觉得都不太对。
- 不要与已经解释清楚的旧条目（resolvedTitles）重复，可以适当呼应仍未解释的旧困惑（unresolved），但要写出新的角度或新的细节，不能原样重复。
- 关系阶段（阶段${stage}）越靠前，困惑应该越轻、越日常；越往后可以越深、越触及情绪或过去。
- guessZh / guessEn 是一一对应的中英文（guessEn 是自然英文翻译，不是逐字直译）。

最近聊天记录：
${recentText || '（暂无聊天记录）'}

仍未解释、还留在${key}心里的旧困惑：
${unresolvedText}

已经解释清楚、不要再重复的旧条目：
${resolvedTitles || '（暂无）'}

输出格式（只输出这个JSON，其他什么都不要，items 数组长度必须正好是 ${n}）：
{"items":[{"guessZh":"中文困惑描述（40-80字，带猜测和情绪）","guessEn":"English version"}],"stage":"${stage}"}`;

  const raw = await hzCallApi(systemPrompt, [{ role: 'user', content: userPrompt }]);
  const clean = raw.replace(/```json|```/g, '').trim();
  const data = JSON.parse(clean);
  if (!data || !Array.isArray(data.items) || !data.items.length) throw new Error('empty haze');

  const items = data.items.map((it, i) => ({
    id: Date.now() + i,
    guessZh: it.guessZh || '',
    guessEn: it.guessEn || '',
    resolved: false,
    explanation: '',
    explanationEn: '',
    reactionZh: '',
    reactionEn: '',
    ts: Date.now(),
  }));

  const entry = await hzAppendArchive(key, {
    stage: data.stage || stage,
    items,
  });
  return entry;
}

/* ---- 用户对某一条"解释"之后，生成角色的真实反应（惊讶/释然/意外等，贴合人设） ---- */
async function hzGenerateReaction(name, entryId, itemId, explanation) {
  const key  = name || HZ_NAME;
  const char = await hzLoadCharProfile(key);
  const persona = char?.persona || char?.description || char?.desc || '';
  const traits  = char?.traits  || char?.personality || '';

  const archive = await hzLoadArchive(key);
  const entry = archive.find(e => e.id === entryId);
  if (!entry) return null;
  const item = (entry.items || []).find(it => it.id === itemId);
  if (!item) return null;

  const systemPrompt = `你现在扮演「${key}」，一个真实存在的人，绝对不是 AI 或助手。
人物简介：${persona || ''}
性格特点：${traits || ''}
你之前一直没想通用户的一件事（你猜了但都觉得不对），现在用户主动解释了，
你需要给出真实的、符合你性格的反应——可以是恍然大悟、可以是"原来是这样"的释然、也可以是有点意外或者反而更好奇了，不要说教、不要浮夸。
只输出 JSON，不要任何额外文字，不要 markdown 代码块，不要出现任何括号/星号包裹的动作描写。`;

  const userPrompt = `你之前的困惑：${item.guessZh}
用户的解释：${explanation || '（用户没有写具体内容）'}

输出格式（只输出这个JSON，其他什么都不要）：
{"reactionZh":"你听到解释后的真实反应（中文，简短口语化，30-70字）","reactionEn":"English version"}`;

  const raw = await hzCallApi(systemPrompt, [{ role: 'user', content: userPrompt }]);
  const clean = raw.replace(/```json|```/g, '').trim();
  const data = JSON.parse(clean);
  return await hzUpdateItem(key, entryId, itemId, {
    resolved: true,
    explanation: explanation || '',
    reactionZh: data.reactionZh || '',
    reactionEn: data.reactionEn || '',
  });
}

/* ---- 用户选择"不解释，让Ta继续猜"：不生成反应，只标记，留在迷雾里 ---- */
async function hzKeepMystery(name, entryId, itemId) {
  const key = name || HZ_NAME;
  return await hzUpdateItem(key, entryId, itemId, {
    keptMystery: true,
  });
}

/* ================================================================
   自动生成开关 —— 与 chatroom.js 共用同一套 localStorage key，
   命名与幕后志(chronicle)的 luna_chronicle_auto_* 完全对应，
   保证用户在设置页看到的交互逻辑是一致的。
================================================================ */
function hzGetAutoEnabled(name) {
  return localStorage.getItem('luna_haze_auto_' + (name || HZ_NAME)) === 'true';
}
function hzSetAutoEnabled(name, on) {
  const key = 'luna_haze_auto_' + (name || HZ_NAME);
  localStorage.setItem(key, on ? 'true' : 'false');
  try { localStorage.setItem('luna_haze_auto_update', String(Date.now())); } catch (e) {}
}
function hzGetAutoRounds(name) {
  return parseInt(localStorage.getItem('luna_haze_auto_rounds_' + (name || HZ_NAME)) || '10');
}
function hzSetAutoRounds(name, n) {
  localStorage.setItem('luna_haze_auto_rounds_' + (name || HZ_NAME), String(n));
  try { localStorage.setItem('luna_haze_auto_update', String(Date.now())); } catch (e) {}
}
/* 每批自动生成几条困惑，默认 2（自动生成比手动稍克制一点，避免一次性堆太多） */
function hzGetAutoCount(name) {
  return parseInt(localStorage.getItem('luna_haze_auto_count_' + (name || HZ_NAME)) || '2');
}
function hzSetAutoCount(name, n) {
  localStorage.setItem('luna_haze_auto_count_' + (name || HZ_NAME), String(n));
  try { localStorage.setItem('luna_haze_auto_update', String(Date.now())); } catch (e) {}
}

/* 轮数计数器：实际的累加/清零动作在 chatroom.js 里执行（与 chronicle 一致），
   这里同样导出一份供 haze 页面自己需要读数时使用（例如设置页展示"当前第几轮"）。 */
function hzGetRoundCount(name) {
  return parseInt(localStorage.getItem('luna_haze_round_count_' + (name || HZ_NAME)) || '0');
}

window.hzGenerateHaze       = hzGenerateHaze;
window.hzGenerateReaction   = hzGenerateReaction;
window.hzKeepMystery        = hzKeepMystery;
window.hzLoadArchive        = hzLoadArchive;
window.hzAppendArchive      = hzAppendArchive;
window.hzUpdateArchiveEntry = hzUpdateArchiveEntry;
window.hzGetAutoEnabled     = hzGetAutoEnabled;
window.hzSetAutoEnabled     = hzSetAutoEnabled;
window.hzGetAutoRounds      = hzGetAutoRounds;
window.hzSetAutoRounds      = hzSetAutoRounds;
window.hzGetAutoCount       = hzGetAutoCount;
window.hzSetAutoCount       = hzSetAutoCount;
window.hzGetRoundCount      = hzGetRoundCount;

/* ================================================================
   页面 UI 逻辑
================================================================ */
function _esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

let _hzToastTimer = null;
function hzToast(msg) {
  let t = document.getElementById('hzToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'hzToast';
    t.className = 'hz-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_hzToastTimer);
  _hzToastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ---- 屏幕切换：0=首页(迷雾墙) 1=加载 2=详情/解释 3=设置 ---- */
function hzScreen(n) {
  document.querySelectorAll('.hz-screen').forEach(s => s.classList.remove('hz-active'));
  const el = document.getElementById('hz-s' + n);
  if (el) el.classList.add('hz-active');
  if (n === 0) hzRenderHome();
  if (n === 3) hzRenderSettings();
}
window.hzScreen = hzScreen;

function hzClose() {
  window.location.href = '../secret.html';
}
window.hzClose = hzClose;

/* ---- 首页：渲染"迷雾墙" —— 把最新一批的 items 铺成卡片，
     未解释的显示"解释 / 不解释"两个按钮，已解释的显示反应摘要。 ---- */
async function hzRenderHome() {
  const wall = document.getElementById('hzWall');
  const emptyState = document.getElementById('hzEmpty');
  const countTag = document.getElementById('hzCountTag');
  if (!wall) return;

  const archive = await hzLoadArchive(HZ_NAME);
  const totalItems = archive.reduce((s, e) => s + (e.items || []).length, 0);
  const unresolvedCount = archive.reduce((s, e) => s + (e.items || []).filter(it => !it.resolved).length, 0);

  if (countTag) {
    countTag.textContent = totalItems
      ? `共 ${totalItems} 条 · 仍悬着 ${unresolvedCount} 条`
      : '还没有任何困惑';
  }

  if (!archive.length) {
    wall.innerHTML = '';
    if (emptyState) emptyState.style.display = 'flex';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';

  /* 按批次倒序展示，每批一个分组标题，组内每条一张卡片 */
  const sorted = archive.slice().reverse();
  wall.innerHTML = sorted.map(entry => {
    const date = new Date(entry.ts || Date.now());
    const dateStr = `${date.getMonth()+1}.${date.getDate()}`;
    const itemsHtml = (entry.items || []).map(it => {
      if (it.resolved) {
        return `
        <div class="hz-card hz-card-resolved">
          <div class="hz-card-fog-corner"></div>
          <div class="hz-card-tag hz-tag-resolved">已解释 · Resolved</div>
          <div class="hz-card-guess">${_esc(it.guessZh)}</div>
          <div class="hz-card-guess-en">${_esc(it.guessEn || '')}</div>
          <div class="hz-card-divider"></div>
          <div class="hz-card-label">你的解释</div>
          <div class="hz-card-explain">${_esc(it.explanation || '（未填写文字，直接选择了解释）')}</div>
          ${it.reactionZh ? `
          <div class="hz-card-label" style="margin-top:.6rem">Ta的反应</div>
          <div class="hz-card-reaction">${_esc(it.reactionZh)}<br><span class="hz-card-reaction-en">${_esc(it.reactionEn || '')}</span></div>
          ` : ''}
        </div>`;
      }
      return `
        <div class="hz-card hz-card-open">
          <div class="hz-card-fog-corner"></div>
          <div class="hz-card-fog-dot hz-fd1"></div>
          <div class="hz-card-fog-dot hz-fd2"></div>
          <div class="hz-card-tag ${it.keptMystery ? 'hz-tag-kept' : 'hz-tag-open'}">${it.keptMystery ? '仍在猜 · Still guessing' : '未解释 · Open'}</div>
          <div class="hz-card-guess">${_esc(it.guessZh)}</div>
          <div class="hz-card-guess-en">${_esc(it.guessEn || '')}</div>
          <div class="hz-card-actions">
            <button class="hz-btn hz-btn-explain" onclick="hzOpenExplain(${entry.id},${it.id})">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              解释
            </button>
            <button class="hz-btn hz-btn-keep" onclick="hzKeepMysteryUI(${entry.id},${it.id})">
              让Ta继续猜
            </button>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="hz-batch">
        <div class="hz-batch-head">
          <span class="hz-batch-num">Batch #${String(entry.id).padStart(2,'0')}</span>
          <span class="hz-batch-date">${dateStr} · Stage ${entry.stage || ''}</span>
        </div>
        <div class="hz-batch-grid">${itemsHtml}</div>
      </div>`;
  }).join('');
}

/* ---- 手动生成：点一次生成 3 条新困惑（固定 3 条，满足"手动=一次三条"的需求） ---- */
async function hzManualGenerate() {
  if (!hzHasApiConfig()) {
    hzToast('请先在设置页配置 API');
    return;
  }
  const btn = document.getElementById('hzGenBtn');
  if (btn) { btn.disabled = true; btn.classList.add('hz-btn-loading'); btn.textContent = '正在感受迷雾…'; }
  hzScreen(1);
  try {
    const entry = await hzGenerateHaze(HZ_NAME, 3);
    if (entry) {
      hzToast('✦ 新的迷雾已生成');
      hzScreen(0);
    } else {
      hzToast('生成失败，稍后再试～');
      hzScreen(0);
    }
  } catch (e) {
    hzToast(e && e.message === 'NO_API_CONFIG' ? '请先在设置页配置 API' : '生成失败，稍后再试～');
    hzScreen(0);
  } finally {
    if (btn) { btn.disabled = false; btn.classList.remove('hz-btn-loading'); btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg> 生成新一批（3条）'; }
  }
}
window.hzManualGenerate = hzManualGenerate;

/* ---- 点开某一条，进入"解释"输入页 ---- */
let _hzCurrentTarget = null; // { entryId, itemId }
async function hzOpenExplain(entryId, itemId) {
  const archive = await hzLoadArchive(HZ_NAME);
  const entry = archive.find(e => e.id === entryId);
  const item = entry && (entry.items || []).find(it => it.id === itemId);
  if (!item) return;
  _hzCurrentTarget = { entryId, itemId };

  const guessEl = document.getElementById('hzExplainGuess');
  if (guessEl) guessEl.innerHTML = `${_esc(item.guessZh)}<br><span class="hz-explain-guess-en">${_esc(item.guessEn || '')}</span>`;
  const input = document.getElementById('hzExplainInput');
  if (input) input.value = '';
  const resultWrap = document.getElementById('hzExplainResult');
  if (resultWrap) resultWrap.style.display = 'none';
  const submitBtn = document.getElementById('hzExplainSubmit');
  if (submitBtn) { submitBtn.style.display = ''; submitBtn.disabled = false; submitBtn.textContent = '提交解释'; }
  const inputWrap = document.getElementById('hzExplainInputWrap');
  if (inputWrap) inputWrap.style.display = '';

  hzScreen(2);
}
window.hzOpenExplain = hzOpenExplain;

/* ---- 首页直接"不解释，让Ta继续猜" ---- */
async function hzKeepMysteryUI(entryId, itemId) {
  await hzKeepMystery(HZ_NAME, entryId, itemId);
  hzToast('好，让Ta继续猜～');
  hzRenderHome();
}
window.hzKeepMysteryUI = hzKeepMysteryUI;

/* ---- 解释页里提交解释：调用 AI 生成角色反应 ---- */
async function hzSubmitExplain() {
  if (!_hzCurrentTarget) return;
  if (!hzHasApiConfig()) {
    hzToast('请先在设置页配置 API');
    return;
  }
  const input = document.getElementById('hzExplainInput');
  const text = input ? input.value.trim() : '';
  if (!text) {
    hzToast('写点什么再提交吧～');
    return;
  }
  const btn = document.getElementById('hzExplainSubmit');
  if (btn) { btn.disabled = true; btn.textContent = '正在等待Ta的反应…'; }

  try {
    const updated = await hzGenerateReaction(HZ_NAME, _hzCurrentTarget.entryId, _hzCurrentTarget.itemId, text);
    if (updated) {
      const inputWrap = document.getElementById('hzExplainInputWrap');
      if (inputWrap) inputWrap.style.display = 'none';
      if (btn) btn.style.display = 'none';
      const resultWrap = document.getElementById('hzExplainResult');
      const reactionEl = document.getElementById('hzExplainReaction');
      if (reactionEl) {
        reactionEl.innerHTML = `${_esc(updated.reactionZh || '')}<br><span class="hz-explain-guess-en">${_esc(updated.reactionEn || '')}</span>`;
      }
      if (resultWrap) resultWrap.style.display = '';
      hzToast('✦ 已解释，Ta的困惑解开了一个');
    } else {
      hzToast('生成失败，稍后再试～');
      if (btn) { btn.disabled = false; btn.textContent = '提交解释'; }
    }
  } catch (e) {
    hzToast(e && e.message === 'NO_API_CONFIG' ? '请先在设置页配置 API' : '生成失败，稍后再试～');
    if (btn) { btn.disabled = false; btn.textContent = '提交解释'; }
  }
}
window.hzSubmitExplain = hzSubmitExplain;

/* ---- 设置页：渲染自动开关 / 轮数 / 每批条数 ---- */
function hzRenderSettings() {
  const toggle = document.getElementById('hzAutoToggle');
  if (!toggle) return;
  const on = hzGetAutoEnabled(HZ_NAME);
  toggle.classList.toggle('hz-switch-on', on);
  const status = document.getElementById('hzAutoStatus');
  if (status) status.textContent = on ? '已开启 · Enabled' : '已关闭 · Disabled（默认关闭）';

  const roundsWrap = document.getElementById('hzRoundsWrap');
  if (roundsWrap) roundsWrap.style.display = on ? '' : 'none';

  const rounds = hzGetAutoRounds(HZ_NAME);
  document.querySelectorAll('.hz-rounds-opt').forEach(btn => {
    btn.classList.toggle('hz-rounds-active', parseInt(btn.dataset.rounds) === rounds);
  });

  const count = hzGetAutoCount(HZ_NAME);
  document.querySelectorAll('.hz-count-opt').forEach(btn => {
    btn.classList.toggle('hz-count-active', parseInt(btn.dataset.count) === count);
  });

  const progressEl = document.getElementById('hzRoundProgress');
  if (progressEl) {
    const cur = hzGetRoundCount(HZ_NAME);
    progressEl.textContent = `当前累计第 ${cur} / ${rounds} 轮`;
  }
}

function hzToggleAuto() {
  const on = !hzGetAutoEnabled(HZ_NAME);
  hzSetAutoEnabled(HZ_NAME, on);
  hzRenderSettings();
  hzToast(on
    ? '已开启自动生成 · 每累计一定轮数会自动生成新的迷雾'
    : '已关闭自动生成 · 需要手动点击生成');
}
window.hzToggleAuto = hzToggleAuto;

function hzPickRounds(n) {
  hzSetAutoRounds(HZ_NAME, n);
  hzRenderSettings();
  hzToast(`已设置为每 ${n} 轮 AI 回复自动生成一次`);
}
window.hzPickRounds = hzPickRounds;

function hzPickCount(n) {
  hzSetAutoCount(HZ_NAME, n);
  hzRenderSettings();
  hzToast(`自动生成时每批 ${n} 条`);
}
window.hzPickCount = hzPickCount;

/* ---- 设置页里也提供一个"立即生成"按钮，方便直接测试/催生成，
     与首页手动按钮共用同一生成函数，但走自动生成的"每批条数"配置。 ---- */
async function hzManualGenerateFromSettings() {
  if (!hzHasApiConfig()) {
    hzToast('请先在设置页配置 API');
    return;
  }
  const btn = document.getElementById('hzSettingsGenBtn');
  if (btn) { btn.disabled = true; btn.style.opacity = '.5'; btn.textContent = '正在生成…'; }
  try {
    const count = hzGetAutoCount(HZ_NAME);
    const entry = await hzGenerateHaze(HZ_NAME, count);
    if (entry) {
      hzToast('✦ 新的迷雾已生成，回首页查看');
    } else {
      hzToast('生成失败，稍后再试～');
    }
  } catch (e) {
    hzToast(e && e.message === 'NO_API_CONFIG' ? '请先在设置页配置 API' : '生成失败，稍后再试～');
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.textContent = '⟳ 立即按当前配置生成一次'; }
  }
}
window.hzManualGenerateFromSettings = hzManualGenerateFromSettings;

/* ================================================================
   初始化
================================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  hzUpdateTime();
  hzUpdateBattery();
  hzApplyIsland();
  hzApplyGlobalFont();

  const char = await hzLoadCharProfile(HZ_NAME);
  hzRenderAvatar(char);
  const nameEl = document.getElementById('hzHeaderName');
  if (nameEl) nameEl.textContent = char?.name || HZ_NAME;

  hzRenderHome();
  hzRenderSettings();
});
