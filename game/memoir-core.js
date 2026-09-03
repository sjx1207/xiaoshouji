/* =========================================================
   回想录 · MEMOIR — core.js
   基础层：数据库 / AI 引擎 / 路由 / 弹层 / 图标 / 渲染沙盒
   与 Luna 系统同步：角色书(LunaCharDB) 身份档(LunaIdentityDB)
                     API(settings.js: luna_api_current / luna_api_model)
                     壁纸(LunaWallpaperDB) 字体(LunaFontDB) 灵动岛
   ========================================================= */
(function () {
'use strict';

const M = {};
window.Memoir = M;

/* ===================== 通用工具 ===================== */
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
M.$ = $; M.$$ = $$;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
M.uid = uid;

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
M.esc = esc;

/* 禁止 emoji：清洗任何模型可能吐出的图形符号 */
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{20E3}\u{E0020}-\u{E007F}\u{1F1E6}-\u{1F1FF}]/gu;
function deEmoji(s) { return String(s == null ? '' : s).replace(EMOJI_RE, ''); }
M.deEmoji = deEmoji;

function fmtDate(ts) {
  const d = new Date(ts || Date.now());
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
M.fmtDate = fmtDate;

function fmtClock(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(sec / 60), s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
M.fmtClock = fmtClock;

function firstChar(s) { return (String(s || '?').trim()[0] || '?').toUpperCase(); }
M.firstChar = firstChar;

M.avatarHtml = function (obj, cls) {
  const img = obj && (obj.avatar || obj.avatarImg);
  const bg  = obj && (obj.color || obj.avatarColor);
  const style = bg ? ` style="background:${esc(bg)}"` : '';
  return `<div class="m-av ${cls || ''}"${style}>${
    img ? `<img src="${esc(img)}" alt="" />` : esc(firstChar(obj && obj.name))
  }</div>`;
};

/* ===================== 图标（纯 SVG，绝无 emoji） ===================== */
const ICONS = {
  back:  '<path d="M15 5 8 12l7 7"/>',
  chev:  '<path d="M9 5l7 7-7 7"/>',
  arrow: '<path d="M5 12h13M12 6l6 6-6 6"/>',
  plus:  '<path d="M12 5v14M5 12h14"/>',
  dots:  '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  send:  '<path d="M4 12l16-8-6 8 6 8-16-8z"/>',
  regen: '<path d="M20 11a8 8 0 1 0-2.3 6.4"/><path d="M20 4v7h-7"/>',
  undo:  '<path d="M4 8h11a5 5 0 0 1 0 10H8"/><path d="M8 4L4 8l4 4"/>',
  mode:  '<path d="M4 7h16M4 12h10M4 17h13"/>',
  note:  '<path d="M5 4h11l4 4v12H5z"/><path d="M9 12h7M9 16h5"/>',
  play:  '<path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="7" y="5" width="3.6" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.4" y="5" width="3.6" height="14" rx="1" fill="currentColor" stroke="none"/>',
  prev:  '<path d="M17 5.5v13L8 12z" fill="currentColor" stroke="none"/><rect x="5.5" y="5.5" width="1.8" height="13" fill="currentColor" stroke="none"/>',
  next:  '<path d="M7 5.5v13L16 12z" fill="currentColor" stroke="none"/><rect x="16.7" y="5.5" width="1.8" height="13" fill="currentColor" stroke="none"/>',
  heart: '<path d="M12 20s-7-4.6-7-9.4A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.6C19 15.4 12 20 12 20z"/>',
  cmt:   '<path d="M20 15a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/>',
  book:  '<path d="M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M17 7h2v13H8"/>',
};
function svg(name, w) {
  const p = ICONS[name]; if (!p) return '';
  return `<svg viewBox="0 0 24 24" width="${w || 16}" height="${w || 16}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}
M.svg = svg;
function paintIcons(root) {
  $$('[data-svg]', root || document).forEach(el => {
    const n = el.dataset.svg;
    if (el.dataset.svgDone === n) return;
    el.innerHTML = svg(n, el.classList.contains('m-vc') ? 15 : 16);
    el.dataset.svgDone = n;
  });
}
M.paintIcons = paintIcons;

/* ===================== IndexedDB ===================== */
const DB_NAME = 'MemoirDB', DB_VER = 1;
const STORES = ['presets', 'archives', 'entries', 'meta'];
let _db = null;

function openDB() {
  return new Promise((res, rej) => {
    if (_db) return res(_db);
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      STORES.forEach(s => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); });
    };
    req.onsuccess = e => { _db = e.target.result; res(_db); };
    req.onerror = () => rej(new Error('数据库打开失败'));
  });
}
async function dbAll(store) {
  const db = await openDB();
  return new Promise(res => {
    const r = db.transaction(store).objectStore(store).getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror = () => res([]);
  });
}
async function dbGet(store, id) {
  const db = await openDB();
  return new Promise(res => {
    const r = db.transaction(store).objectStore(store).get(id);
    r.onsuccess = () => res(r.result || null);
    r.onerror = () => res(null);
  });
}
async function dbPut(store, obj) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(obj);
    tx.oncomplete = () => res(obj);
    tx.onerror = () => rej(new Error('写入失败'));
  });
}
async function dbDel(store, id) {
  const db = await openDB();
  return new Promise(res => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => res(true);
    tx.onerror = () => res(false);
  });
}
M.db = { all: dbAll, get: dbGet, put: dbPut, del: dbDel };

/* ===================== 外部库（Luna 同步） ===================== */
function openExt(name, store, ver) {
  return new Promise((res, rej) => {
    const req = indexedDB.open(name, ver);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(store)) {
        try { db.createObjectStore(store, { keyPath: 'id', autoIncrement: true }); } catch (err) {}
      }
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror = () => rej();
  });
}
async function extAll(name, store, ver) {
  try {
    const db = await openExt(name, store, ver);
    if (!db.objectStoreNames.contains(store)) return [];
    return await new Promise(res => {
      const r = db.transaction(store).objectStore(store).getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => res([]);
    });
  } catch (e) { return []; }
}
M.loadChars      = () => extAll('LunaCharDB', 'chars', 4);
M.loadIdentities = () => extAll('LunaIdentityDB', 'identities');
M.loadWorldbook  = () => extAll('LunaWorldBookDB', 'entries', 2);

/* ===================== 生成设置 ===================== */
const CFG_KEY = 'memoir_cfg_v1';
const CFG_DEFAULT = {
  maxTokens: 16000,     // 冗余充足，保证长 HTML 不被截断
  temperature: 0.92,
  topP: 0.95,
  depth: 14,            // 携带的历史轮数
  stream: true,
  htmlDepth: 3,         // 传给模型的既往 HTML 数量（其余转纯文本摘要）
  retryOnCut: true,     // 截断自动续写
};
M.cfg = Object.assign({}, CFG_DEFAULT, JSON.parse(localStorage.getItem(CFG_KEY) || '{}'));
M.cfgDefault = CFG_DEFAULT;
M.saveCfg = function () { localStorage.setItem(CFG_KEY, JSON.stringify(M.cfg)); };

function apiConf() {
  let cur = {};
  try { cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}'); } catch (e) {}
  return {
    baseUrl: (cur.baseUrl || '').replace(/\/+$/, ''),
    apiKey:  cur.apiKey || '',
    model:   localStorage.getItem('luna_api_model') || '',
  };
}
M.apiConf = apiConf;

/* ===================== AI 引擎 ===================== */
let _abort = null;
M.abortGen = function () { if (_abort) { try { _abort.abort(); } catch (e) {} } };

function extractStream(chunkText, state) {
  // 解析 SSE
  state.buf += chunkText;
  let out = '';
  const parts = state.buf.split('\n');
  state.buf = parts.pop();
  for (const raw of parts) {
    const line = raw.trim();
    if (!line || !line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (data === '[DONE]') { state.done = true; continue; }
    try {
      const j = JSON.parse(data);
      const d = j.choices && j.choices[0] && (j.choices[0].delta || j.choices[0].message);
      if (d && typeof d.content === 'string') out += d.content;
      if (j.choices && j.choices[0] && j.choices[0].finish_reason) state.finish = j.choices[0].finish_reason;
    } catch (e) {}
  }
  return out;
}

/**
 * 调用模型
 * @param {Array}  messages
 * @param {Object} opt {maxTokens, temperature, onDelta, json}
 */
async function chat(messages, opt) {
  opt = opt || {};
  const conf = apiConf();
  if (!conf.baseUrl || !conf.apiKey) throw new Error('尚未在「设置 · AI 模型」中配置接口');
  if (!conf.model) throw new Error('尚未选择模型，请到「设置 · AI 模型」选择');

  const maxTokens = opt.maxTokens || M.cfg.maxTokens;
  const body = {
    model: conf.model,
    messages,
    temperature: opt.temperature != null ? opt.temperature : M.cfg.temperature,
    top_p: M.cfg.topP,
    max_tokens: maxTokens,
  };

  const doFetch = async (payload, stream) => {
    _abort = new AbortController();
    const resp = await fetch(conf.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + conf.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({}, payload, { stream: !!stream })),
      signal: _abort.signal,
    });
    if (!resp.ok) {
      let t = '';
      try { t = await resp.text(); } catch (e) {}
      const err = new Error('HTTP ' + resp.status + (t ? ' · ' + t.slice(0, 240) : ''));
      err.raw = t; err.status = resp.status;
      throw err;
    }
    if (!stream) {
      const j = await resp.json();
      const c = j.choices && j.choices[0];
      return { text: (c && c.message && c.message.content) || '', finish: c && c.finish_reason };
    }
    const reader = resp.body.getReader();
    const dec = new TextDecoder('utf-8');
    const st = { buf: '', done: false, finish: '' };
    let text = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const piece = extractStream(dec.decode(value, { stream: true }), st);
      if (piece) { text += piece; if (opt.onDelta) opt.onDelta(piece, text); }
      if (st.done) break;
    }
    return { text, finish: st.finish };
  };

  let out;
  try {
    out = await doFetch(body, M.cfg.stream && opt.stream !== false);
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    const raw = String(e.raw || e.message || '');
    // 新式模型：max_tokens → max_completion_tokens
    if (/max_tokens|max_completion_tokens|unsupported_parameter/i.test(raw)) {
      const b2 = Object.assign({}, body);
      delete b2.max_tokens;
      b2.max_completion_tokens = maxTokens;
      if (/temperature/i.test(raw)) delete b2.temperature;
      out = await doFetch(b2, false);
    } else if (/stream/i.test(raw)) {
      out = await doFetch(body, false);
    } else {
      throw e;
    }
  }

  // 截断自动续写（保证长 HTML 完整）
  let text = out.text || '';
  let guard = 0;
  while (M.cfg.retryOnCut && out.finish === 'length' && guard < 2) {
    guard++;
    if (opt.onDelta) opt.onDelta('', text);
    const cont = await (async () => {
      const msgs = messages.concat([
        { role: 'assistant', content: text.slice(-4000) },
        { role: 'user', content: '内容被长度截断了。请从被截断的位置继续，直接输出后续部分，不要重复已有内容，不要任何说明文字。' },
      ]);
      const r = await doFetch(Object.assign({}, body, { messages: msgs }), false);
      return r;
    })();
    text += cont.text || '';
    out.finish = cont.finish;
  }

  _abort = null;
  return deEmoji(text).trim();
}
M.chat = chat;

/* 提取模型输出中的 HTML */
function pickHtml(raw) {
  let s = String(raw || '').trim();
  const fence = s.match(/```(?:html|HTML)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  s = s.replace(/^<!DOCTYPE[^>]*>/i, '').trim();
  return s;
}
M.pickHtml = pickHtml;

/* 提取 JSON */
function pickJson(raw) {
  let s = String(raw || '').trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const a = s.indexOf('{'), b = s.indexOf('[');
  let st = (a < 0) ? b : (b < 0 ? a : Math.min(a, b));
  if (st > 0) s = s.slice(st);
  const lastA = s.lastIndexOf('}'), lastB = s.lastIndexOf(']');
  const en = Math.max(lastA, lastB);
  if (en > -1) s = s.slice(0, en + 1);
  try { return JSON.parse(s); } catch (e) {}
  try { return JSON.parse(s.replace(/,\s*([}\]])/g, '$1')); } catch (e) {}
  return null;
}
M.pickJson = pickJson;

/* ===================== 沙盒渲染（AI 生成的可交互 HTML） ===================== */
const FRAME_CSS = `
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{background:transparent}
body{
  font-family:'Noto Sans SC',-apple-system,'PingFang SC',sans-serif;
  color:#2c2c34; font-size:14px; line-height:1.9; letter-spacing:.02em;
  padding:20px 19px 22px;
}
h1,h2,h3,h4{font-family:'Cormorant Garamond','Noto Serif SC',serif;font-weight:600;letter-spacing:.14em;color:#131318;line-height:1.35}
h1{font-size:24px;margin:0 0 14px}h2{font-size:20px;margin:20px 0 11px}h3{font-size:17px;margin:16px 0 9px}
p{margin:0 0 13px}
em,i{font-style:italic;color:#56565f}
strong,b{font-weight:600;color:#131318}
hr{border:0;height:1px;margin:20px 0;background:linear-gradient(90deg,transparent,rgba(19,19,24,.2),transparent)}
blockquote{margin:14px 0;padding:12px 16px;border-left:2px solid rgba(19,19,24,.22);background:rgba(19,19,24,.035);border-radius:0 10px 10px 0;color:#3a3a44;font-family:'Cormorant Garamond','Noto Serif SC',serif;font-size:15px;font-style:italic}
ul,ol{margin:0 0 13px 20px}li{margin-bottom:6px}
a{color:#131318;text-decoration:none;border-bottom:1px solid rgba(19,19,24,.3)}
.narr,.narration{font-family:'Cormorant Garamond','Noto Serif SC',serif;font-style:italic;color:#5b5b64;font-size:14.5px;letter-spacing:.05em}
.line,.dialogue{margin:12px 0;padding:12px 15px;border-radius:14px;background:linear-gradient(160deg,rgba(255,255,255,.92),rgba(255,255,255,.6));border:1px solid rgba(19,19,24,.09);box-shadow:0 2px 10px rgba(20,20,30,.05),inset 0 1px 0 #fff}
.speaker,.who{display:inline-block;font-size:10.5px;letter-spacing:.18em;color:#83838d;margin-bottom:6px}
.card,.panel,.box{position:relative;padding:16px 17px;border-radius:16px;background:linear-gradient(160deg,rgba(255,255,255,.9),rgba(255,255,255,.56));border:1px solid rgba(255,255,255,.9);box-shadow:0 2px 4px rgba(20,20,30,.05),0 12px 32px rgba(20,20,30,.07),inset 0 1px 0 #fff,0 0 0 1px rgba(19,19,24,.07);margin:13px 0;overflow:hidden}
.card::before,.panel::before{content:'';position:absolute;inset:6px;border-radius:11px;border:1px solid rgba(19,19,24,.05);pointer-events:none}
.label,.kicker{font-family:'Space Mono',monospace;font-size:8px;letter-spacing:.3em;color:#a9a9b2;text-transform:uppercase}
button,.btn,.choice,.opt{
  display:block;width:100%;text-align:left;cursor:pointer;margin:9px 0;
  padding:14px 16px;border-radius:13px;font-family:inherit;font-size:13.5px;line-height:1.6;color:#131318;
  background:linear-gradient(160deg,rgba(255,255,255,.94),rgba(255,255,255,.66));
  border:1px solid rgba(19,19,24,.14);
  box-shadow:0 2px 8px rgba(20,20,30,.06),inset 0 1px 0 #fff;
  transition:transform .18s cubic-bezier(.32,.72,0,1),box-shadow .2s,background .2s;
}
button:active,.btn:active,.choice:active,.opt:active{transform:scale(.978);background:#fff}
button.dark,.btn.dark{background:linear-gradient(160deg,#2a2a33,#101015);color:#f4f4f6;border-color:transparent;box-shadow:0 10px 24px rgba(16,16,22,.26)}
button[disabled]{opacity:.42;pointer-events:none}
input,textarea,select{width:100%;padding:12px 14px;border-radius:12px;border:1px solid rgba(19,19,24,.16);background:rgba(255,255,255,.86);font-family:inherit;font-size:13.5px;color:#131318;outline:none;box-shadow:inset 0 1px 3px rgba(19,19,24,.05)}
table{width:100%;border-collapse:separate;border-spacing:0;margin:13px 0;border-radius:12px;overflow:hidden;border:1px solid rgba(19,19,24,.1)}
th,td{padding:10px 12px;font-size:12.5px;text-align:left;border-bottom:1px solid rgba(19,19,24,.08)}
th{background:rgba(19,19,24,.05);font-weight:600;letter-spacing:.1em;color:#131318}
tr:last-child td{border-bottom:none}
.bar{height:4px;border-radius:3px;background:rgba(19,19,24,.1);overflow:hidden;margin:7px 0}
.bar>i{display:block;height:100%;background:linear-gradient(90deg,#3c3c46,#16161b)}
.tag,.chip{display:inline-flex;align-items:center;padding:4px 10px;border-radius:8px;font-size:10.5px;letter-spacing:.12em;color:#56565f;background:rgba(19,19,24,.05);border:1px solid rgba(19,19,24,.08);margin:0 6px 6px 0}
.rule{display:flex;align-items:center;gap:8px;margin:18px 0}
.rule::before,.rule::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,transparent,rgba(19,19,24,.18),transparent)}
.rule i{width:5px;height:5px;transform:rotate(45deg);background:#a9a9b2}
img{max-width:100%;border-radius:12px}
::-webkit-scrollbar{width:0;height:0}
`;
const FRAME_JS = `
(function(){
  function report(){
    var h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    parent.postMessage({__memoir:'h', h:h}, '*');
  }
  var t;
  function ping(){ clearTimeout(t); t = setTimeout(report, 40); }
  window.addEventListener('load', ping);
  document.addEventListener('click', function(e){
    ping();
    var el = e.target.closest('[data-send],[data-choice],[data-act-send]');
    if(el){
      var v = el.getAttribute('data-send') || el.getAttribute('data-choice') || el.getAttribute('data-act-send') || el.textContent.trim();
      parent.postMessage({__memoir:'send', text:v}, '*');
    }
  }, true);
  document.addEventListener('input', ping, true);
  document.addEventListener('transitionend', ping, true);
  if(window.ResizeObserver){ new ResizeObserver(ping).observe(document.body); }
  setInterval(report, 700);
  ping();
})();
`;

M.renderFrame = function (holder, htmlBody) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-scripts allow-popups');
  iframe.setAttribute('scrolling', 'no');
  iframe.style.height = '150px';
  const doc = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Noto+Serif+SC:wght@300;400;500;600&family=Noto+Sans+SC:wght@300;400;500&family=Space+Mono&display=swap" rel="stylesheet">
<style>${FRAME_CSS}</style></head><body>${htmlBody}<script>${FRAME_JS}<\/script></body></html>`;
  iframe.srcdoc = doc;
  holder.appendChild(iframe);
  return iframe;
};

window.addEventListener('message', e => {
  const d = e.data;
  if (!d || d.__memoir !== 'h' && d.__memoir !== 'send') return;
  const frames = $$('iframe');
  const src = frames.find(f => f.contentWindow === e.source);
  if (!src) return;
  if (d.__memoir === 'h') {
    const h = Math.min(Math.max(d.h + 4, 90), 20000);
    if (Math.abs(parseInt(src.style.height) - h) > 2) src.style.height = h + 'px';
  } else if (d.__memoir === 'send') {
    if (M.onFrameSend) M.onFrameSend(String(d.text || '').slice(0, 600), src);
  }
});

/* ===================== 路由 ===================== */
const stack = [];
M.stack = stack;
let current = null;

M.nav = function (name, data) {
  const next = $(`.m-view[data-view="${name}"]`);
  if (!next) return;
  if (current === next) return;
  if (current) { current.classList.remove('active'); current.classList.add('behind'); }
  next.classList.remove('behind');
  // 强制重排以触发动画
  void next.offsetWidth;
  next.classList.add('active');
  const scroller = $('.m-scroll', next) || $('.m-play-scroll', next);
  if (scroller && !data?.keepScroll) scroller.scrollTop = 0;
  for (let i = stack.length - 1; i >= 0; i--) if (stack[i].el === next) stack.splice(i, 1);
  if (current) stack.push({ el: current, name: current.dataset.view });
  current = next;
  paintIcons(next);
  M.currentView = name;
};

M.back = function () {
  const prev = stack.pop();
  if (!prev) { M.exit(); return; }
  if (current) { current.classList.remove('active'); }
  prev.el.classList.remove('behind');
  void prev.el.offsetWidth;
  prev.el.classList.add('active');
  current = prev.el;
  M.currentView = prev.name;
  if (M.onBackTo) M.onBackTo(prev.name);
};

M.resetTo = function (name) {
  stack.length = 0;
  const t = $(`.m-view[data-view="${name}"]`);
  $$('.m-view').forEach(v => { if (v !== t) { v.classList.remove('active'); v.classList.add('behind'); } });
  t.classList.remove('behind'); void t.offsetWidth; t.classList.add('active');
  current = t; M.currentView = name;
};

M.exit = function () {
  document.body.style.transition = 'opacity .28s ease';
  document.body.style.opacity = '0';
  setTimeout(() => { location.href = 'index.html'; }, 260);
};

/* ===================== 弹层（替代所有浏览器弹窗） ===================== */
const sheetMask = () => $('#mSheetMask');
let sheetResolve = null;

function closeSheet(val) {
  sheetMask().classList.remove('on');
  const r = sheetResolve; sheetResolve = null;
  if (r) setTimeout(() => r(val), 10);
}
M.closeSheet = closeSheet;

/**
 * 通用弹层
 * opts: {title, desc, options:[{id,title,desc,danger}], multi, selected,
 *        input:{placeholder,value,multiline,label}, okText, cancelText, hideCancel, html}
 * 返回：options → id / id数组；input → 字符串；纯确认 → true|null
 */
M.sheet = function (opts) {
  opts = opts || {};
  return new Promise(resolve => {
    if (sheetResolve) closeSheet(null);
    sheetResolve = resolve;
    $('#mSheetTitle').textContent = opts.title || '';
    $('#mSheetDesc').textContent = opts.desc || '';
    const body = $('#mSheetBody'); body.innerHTML = '';
    const foot = $('#mSheetFoot'); foot.innerHTML = '';

    let sel = opts.multi ? (opts.selected ? opts.selected.slice() : []) : (opts.selected ?? null);

    if (opts.html) { body.innerHTML = opts.html; }

    if (opts.options) {
      body.innerHTML += opts.options.map(o => `
        <div class="m-opt ${o.danger ? 'danger' : ''} ${
          opts.multi ? (sel.includes(o.id) ? 'on' : '') : (sel === o.id ? 'on' : '')
        }" data-oid="${esc(o.id)}">
          ${opts.plain ? '' : '<div class="m-opt-mark"></div>'}
          <div class="m-opt-body">
            <div class="m-opt-t">${esc(o.title)}</div>
            ${o.desc ? `<div class="m-opt-d">${esc(o.desc)}</div>` : ''}
          </div>
          ${o.right ? `<div class="m-badge">${esc(o.right)}</div>` : ''}
        </div>`).join('');
    }

    if (opts.input) {
      const i = opts.input;
      body.innerHTML += `
        <div class="m-field" style="margin-top:${opts.options ? '14px' : '2px'}">
          ${i.label ? `<div class="m-field-label">${esc(i.label)}</div>` : ''}
          ${i.multiline
            ? `<textarea class="m-textarea" id="mSheetInput" placeholder="${esc(i.placeholder || '')}">${esc(i.value || '')}</textarea>`
            : `<input class="m-input" id="mSheetInput" placeholder="${esc(i.placeholder || '')}" value="${esc(i.value || '')}" />`}
        </div>`;
    }

    const needOk = opts.input || opts.multi || opts.okText || opts.confirm;
    foot.innerHTML =
      (opts.hideCancel ? '' : `<div class="m-btn ghost" data-sheet="cancel">${esc(opts.cancelText || '取消')}</div>`) +
      (needOk ? `<div class="m-btn dark" data-sheet="ok">${esc(opts.okText || '确认')}</div>` : '');

    body.onclick = ev => {
      const o = ev.target.closest('.m-opt'); if (!o) return;
      const id = o.dataset.oid;
      if (opts.multi) {
        const at = sel.indexOf(id);
        if (at > -1) sel.splice(at, 1); else sel.push(id);
        o.classList.toggle('on');
      } else {
        $$('.m-opt', body).forEach(x => x.classList.remove('on'));
        o.classList.add('on');
        sel = id;
        if (!needOk) setTimeout(() => closeSheet(id), 170);
      }
    };
    foot.onclick = ev => {
      const b = ev.target.closest('[data-sheet]'); if (!b) return;
      if (b.dataset.sheet === 'cancel') return closeSheet(null);
      if (opts.input) {
        const v = $('#mSheetInput').value.trim();
        if (opts.requireInput && !v) { $('#mSheetInput').focus(); return; }
        return closeSheet(opts.options ? { value: v, id: sel } : v);
      }
      closeSheet(opts.multi ? sel : (sel != null ? sel : true));
    };

    sheetMask().classList.add('on');
    if (opts.input && opts.focus !== false) setTimeout(() => { const el = $('#mSheetInput'); if (el) el.focus(); }, 380);
  });
};

sheetMask().addEventListener('click', e => { if (e.target === sheetMask()) closeSheet(null); });

M.confirm = (title, desc, okText) =>
  M.sheet({ title, desc, confirm: true, okText: okText || '确认' }).then(v => !!v);
M.alert = (title, desc) =>
  M.sheet({ title, desc, hideCancel: true, okText: '知道了', confirm: true });
M.prompt = (title, opts) =>
  M.sheet(Object.assign({ title, input: { placeholder: '', multiline: false }, requireInput: true }, opts || {}));

/* Toast */
let toastT = null;
M.toast = function (msg, ms) {
  const t = $('#mToast');
  t.textContent = deEmoji(msg);
  t.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('on'), ms || 2100);
};

/* 加载幕 */
let loadMeterT = null, loadStart = 0;
M.loading = function (on, title, sub) {
  const el = $('#mLoad');
  if (on) {
    $('#mLoadTitle').textContent = title || '正在回想';
    $('#mLoadSub').textContent = sub || '生成中，请稍候';
    $('#mLoadMeter').textContent = '';
    el.classList.add('on');
    loadStart = Date.now();
    clearInterval(loadMeterT);
    loadMeterT = setInterval(() => {
      const s = ((Date.now() - loadStart) / 1000).toFixed(1);
      const c = M.loadChars_ || 0;
      $('#mLoadMeter').textContent = `${s}s${c ? '  ·  ' + c + ' 字' : ''}`;
    }, 120);
  } else {
    el.classList.remove('on');
    clearInterval(loadMeterT);
    M.loadChars_ = 0;
  }
};
M.loadTick = n => { M.loadChars_ = n; };

/* ===================== 状态栏 / 背景 / 字体 ===================== */
function tickClock() {
  const d = new Date();
  let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0');
  const el = $('#statusTime'); if (el) el.textContent = h + ':' + m;
}
function applyIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style = localStorage.getItem('luna_island_style') || 'minimal';
  const el = $('#statusIsland'); if (!el) return;
  if (!enabled) { el.innerHTML = ''; return; }
  const map = {
    minimal: '<div class="si-minimal"><div class="si-capsule"></div></div>',
    glow:    '<div class="si-glow"><div class="si-capsule"></div></div>',
    clock:   '<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="siClockText">--:--</span></div></div>',
  };
  el.innerHTML = map[style] || map.minimal;
  if (style === 'clock') {
    const t = () => { const x = $('#siClockText'); if (x) { const n = new Date(); x.textContent = n.getHours() + ':' + String(n.getMinutes()).padStart(2, '0'); } };
    t(); clearInterval(window._mIslandT); window._mIslandT = setInterval(t, 10000);
  }
}
function tickBattery() {
  if (!navigator.getBattery) return;
  navigator.getBattery().then(b => {
    const p = Math.round(b.level * 100);
    const el = $('#batPct'); if (el) el.textContent = p;
    const inner = $('#batInner'); if (inner) inner.style.width = Math.max(6, p) + '%';
  }).catch(() => {});
}
async function applyWallpaper() {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('LunaWallpaperDB');
      r.onsuccess = e => res(e.target.result); r.onerror = () => rej();
    });
    if (!db.objectStoreNames.contains('data')) return;
    const data = await new Promise(res => {
      const r = db.transaction('data').objectStore('data').get('applied');
      r.onsuccess = () => res(r.result ? r.result.value : null);
      r.onerror = () => res(null);
    });
    const layer = $('#mBgWall'); if (!layer) return;
    layer.innerHTML = '';
    if (!data || !data.dataUrl) return;
    if (data.kind === 'video') {
      const v = document.createElement('video');
      v.src = data.dataUrl; v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
      layer.appendChild(v); v.play().catch(() => {});
    } else {
      const img = document.createElement('img'); img.src = data.dataUrl; layer.appendChild(img);
    }
  } catch (e) {}
}
async function applyFont() {
  const name = localStorage.getItem('luna_font_active_name');
  const id = parseInt(localStorage.getItem('luna_font_active_id'));
  if (!name || !id) return;
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('LunaFontDB', 4);
      r.onsuccess = e => res(e.target.result); r.onerror = () => rej();
    });
    const all = await new Promise(res => {
      const r = db.transaction('fonts').objectStore('fonts').getAll();
      r.onsuccess = () => res(r.result || []); r.onerror = () => res([]);
    });
    const f = all.find(x => x.id === id);
    if (!f) return;
    const face = new FontFace(name, `url(${f.data})`);
    await face.load(); document.fonts.add(face);
    let tag = $('#memoir-font'); if (!tag) { tag = document.createElement('style'); tag.id = 'memoir-font'; document.head.appendChild(tag); }
    tag.textContent = `body,.m-input,.m-textarea,#playInput{font-family:'${name}','Noto Sans SC',sans-serif !important;}`;
  } catch (e) {}
}

/* ===================== 文件读取（存档背景） ===================== */
M.pickImage = function (maxW) {
  return new Promise(resolve => {
    const inp = $('#mFileInput');
    inp.value = '';
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if (!f) return resolve(null);
      const rd = new FileReader();
      rd.onload = ev => {
        const img = new Image();
        img.onload = () => {
          const mw = maxW || 1280;
          const scale = Math.min(1, mw / img.width);
          const cv = document.createElement('canvas');
          cv.width = Math.round(img.width * scale);
          cv.height = Math.round(img.height * scale);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          resolve(cv.toDataURL('image/jpeg', 0.86));
        };
        img.onerror = () => resolve(ev.target.result);
        img.src = ev.target.result;
      };
      rd.readAsDataURL(f);
    };
    inp.click();
  });
};

/* ===================== 角色 / 身份 上下文（最高优先级） ===================== */
M.charBlock = function (c) {
  if (!c) return '';
  const L = [];
  const add = (k, v) => { if (v && String(v).trim()) L.push(`${k}：${String(v).trim()}`); };
  add('姓名', c.name); add('身份/职业', c.role); add('性别', c.gender); add('年龄', c.age);
  add('生日', c.birthday); add('种族/设定', c.species);
  add('外貌', c.appearance); add('常穿着装', c.outfit);
  add('核心描述', c.desc);
  if (Array.isArray(c.traits) && c.traits.length) add('性格特质', c.traits.join('、'));
  if (Array.isArray(c.likes) && c.likes.length) add('喜欢', c.likes.join('、'));
  if (Array.isArray(c.dislikes) && c.dislikes.length) add('厌恶', c.dislikes.join('、'));
  add('恐惧', c.fears);
  add('说话方式', c.speechStyle);
  if (Array.isArray(c.catchphrases) && c.catchphrases.length) add('口头禅', c.catchphrases.join('、'));
  add('使用语言', c.lang);
  add('背景故事', c.backstory);
  add('当前处境', c.scenario);
  add('与用户的关系', c.relation);
  add('对用户的称呼', c.callUser);
  add('关系细节', c.relationDetail);
  add('开场白', c.firstMes);
  if (Array.isArray(c.dialogExamples) && c.dialogExamples.length) {
    const ex = c.dialogExamples.slice(0, 6).map(d =>
      `  用户：${(d.user || '').trim()}\n  ${c.name}：${(d.char || '').trim()}`).join('\n');
    if (ex.trim()) L.push('对话范例：\n' + ex);
  }
  add('额外提示词', c.prompt);
  return L.join('\n');
};

M.userBlock = function (u) {
  if (!u) return '';
  const L = [];
  const add = (k, v) => { if (v && String(v).trim()) L.push(`${k}：${String(v).trim()}`); };
  add('姓名', u.name); add('身份类型', u.identityType); add('社会身份', u.role);
  add('性别', u.gender); add('生日', u.birthday); add('星座', u.zodiac);
  add('所在地', u.location); add('职业', u.occupation);
  add('性格', u.personality); add('自称', u.selfCall);
  add('座右铭', u.motto); add('语言', u.lang); add('自我描述', u.desc);
  if (Array.isArray(u.tags) && u.tags.length) add('标签', u.tags.join('、'));
  if (Array.isArray(u.linkedIdentities) && u.linkedIdentities.length) {
    const r = u.linkedIdentities.map(l => `${l.name || ''}（${l.relation || l.type || '关系'}）`).filter(Boolean).join('、');
    if (r) add('关系网络', r);
  }
  return L.join('\n');
};

/* 全局风格约束：所有生成内容通用 */
M.STYLE_RULES = `
【输出美学与硬性规范 · 必须严格遵守】
1. 绝对禁止使用任何 emoji、颜文字、表情符号，以及星形、心形、音符、对勾、雪花之类的装饰性图形字符。需要标记时，只使用中文字词、罗马数字、阿拉伯数字，或纯文字标签。
2. 配色只允许黑、白、灰及其之间的浅色过渡。严禁米色、米黄、奶油色、暖棕色，严禁任何高饱和彩色。可用色值范围：#ffffff、#fbfbfc、#f4f4f6、#e8e8ec、#d6d6dc、#a9a9b2、#83838d、#56565f、#2c2c34、#131318，以及它们的半透明形式。
3. 风格必须"华丽、考究、有层次"：使用多层描边、内高光、柔和阴影、细腻渐变、角饰、菱形分隔、细密纹理、衬线标题与字距。严禁做成"极简线框风"——不要只有单薄的 1px 方框和大片留白。
4. 允许并鼓励写 <style> 与 <script>，做出可交互效果（展开、切换、选择、进度、悬浮层等）。不要使用 alert/confirm/prompt 等浏览器弹窗，一律用自绘的 CSS 弹层。
5. 背景必须透明（不要给 body 或最外层设置不透明背景色），以便融入 App 的全局背景，不能出现分界线。
6. 只输出 HTML 片段本身（可含 style/script），不要 <!DOCTYPE>、<html>、<head>、<body> 标签，不要 markdown 代码围栏，不要任何解释性前后缀。
7. 中文正文使用无衬线，标题与引文可用衬线；正文行高不低于 1.85，字距适度。
8. 内容必须足够充实、有细节、有画面感，不要敷衍或写成大纲。
9. 渲染环境为沙箱 iframe：禁止使用 localStorage、sessionStorage、cookie、fetch 与外部资源（图片、字体、脚本）。所有效果必须由内联的 CSS 与 JS 自给自足。需要"图片"时，用带渐变与纹理的色块配文字说明代替。
`.trim();

/* ===================== 事件总线 ===================== */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const h = M.actions[act];
  if (h) { e.preventDefault(); h(el, e); }
});

M.actions = {
  back: () => M.back(),
  exit: () => M.exit(),
  'gen-cancel': () => { M.abortGen(); M.loading(false); M.toast('已中止生成'); },
};

/* ===================== 启动 ===================== */
M.boot = async function () {
  paintIcons();
  tickClock(); setInterval(tickClock, 15000);
  applyIsland(); tickBattery(); applyWallpaper(); applyFont();

  window.addEventListener('storage', e => {
    if (e.key === 'luna_wallpaper_update') applyWallpaper();
    if (e.key === 'luna_island_update') applyIsland();
    if (e.key === 'luna_font_update') applyFont();
  });

  await openDB();
  await M.Preset.init();
  await M.Archive.init();
  M.Play.init();
  M.Extras.init();

  M.resetTo('home');
  M.Home.render();

  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') { if (sheetResolve) closeSheet(null); else M.back(); }
  });
};

/* ===================== 首页 ===================== */
M.Home = {
  async render() {
    const [arcs, pres, ents] = await Promise.all([dbAll('archives'), dbAll('presets'), dbAll('entries')]);
    const scenes = ents.filter(e => e.type === 'scene').length;
    const derv = ents.filter(e => e.type !== 'scene').length;
    $('#homeStats').innerHTML = `
      <div class="m-stat"><div class="m-stat-n">${arcs.length}</div><div class="m-stat-l">存 档</div></div>
      <div class="m-stat"><div class="m-stat-n">${scenes}</div><div class="m-stat-l">剧 情</div></div>
      <div class="m-stat"><div class="m-stat-n">${derv}</div><div class="m-stat-l">衍 生</div></div>
      <div class="m-stat"><div class="m-stat-n">${pres.length}</div><div class="m-stat-l">预 设</div></div>`;
    const c = apiConf();
    $('#rowCfgVal').textContent = c.model ? (c.model.length > 16 ? c.model.slice(0, 16) + '…' : c.model) : '未配置接口';
  },
};

M.actions['start']    = () => M.Archive.openSetup();
M.actions['archives'] = () => { M.nav('archives'); M.Archive.renderList(); };
M.actions['presets']  = () => { M.nav('presets'); M.Preset.renderList(); };
M.actions['config']   = () => { M.nav('config'); M.renderConfig(); };
M.actions['vlog']     = () => M.Extras.start('vlog');
M.actions['qa']       = () => M.Extras.start('qa');
M.actions['ifline']   = () => M.Extras.start('if');
M.actions['moments']  = () => M.Extras.start('feed');

/* ===================== 生成设置页 ===================== */
M.renderConfig = function () {
  const c = M.cfg, a = apiConf();
  const slider = (id, label, min, max, step, val, unit) => `
    <div class="m-field">
      <div class="m-field-label">${label}<em>${min}–${max}</em><span style="margin-left:auto;font-family:var(--mono);color:var(--ink-2)" id="${id}Val">${val}${unit || ''}</span></div>
      <div class="m-slider">
        <div class="m-slider-track"><div class="m-slider-fill" id="${id}Fill" style="width:${(val - min) / (max - min) * 100}%"></div></div>
        <div class="m-slider-knob" id="${id}Knob" style="left:${(val - min) / (max - min) * 100}%"></div>
        <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" />
      </div>
    </div>`;
  $('#configBody').innerHTML = `
    <div class="m-panel" style="padding:18px 17px 6px;margin-bottom:16px">
      <div class="m-orn-c tl"></div><div class="m-orn-c tr"></div><div class="m-orn-c bl"></div><div class="m-orn-c br"></div>
      <div class="m-field-label" style="margin-bottom:12px">当前接口<em>FROM SETTINGS</em></div>
      <div class="m-row" style="border:none;padding:0 0 14px"><div class="m-row-t">模型</div><div class="m-row-v">${esc(a.model || '未选择')}</div></div>
      <div class="m-row" style="border:none;padding:0 0 16px"><div class="m-row-t">端点</div><div class="m-row-v">${esc(a.baseUrl ? a.baseUrl.replace(/^https?:\/\//, '').slice(0, 26) : '未配置')}</div></div>
      <div style="font-size:11px;line-height:1.8;color:var(--ink-5);padding-bottom:14px">接口与模型统一读取「设置 · AI 模型」中保存的配置，此处不重复设置。</div>
    </div>
    <div class="m-panel" style="padding:18px 17px 4px">
      <div class="m-orn-c tl"></div><div class="m-orn-c tr"></div><div class="m-orn-c bl"></div><div class="m-orn-c br"></div>
      ${slider('cfgTok', '单次生成上限<em>MAX TOKENS</em>', 2000, 64000, 1000, c.maxTokens)}
      <div style="font-size:10.5px;line-height:1.75;color:var(--ink-5);margin:-6px 4px 16px">上限越高越不易截断。默认 16000，足以容纳带样式与脚本的长 HTML；若模型不支持会自动降级并续写。</div>
      ${slider('cfgTemp', '发挥度<em>TEMPERATURE</em>', 0, 150, 1, Math.round(c.temperature * 100))}
      ${slider('cfgDepth', '携带历史轮数<em>CONTEXT</em>', 2, 40, 1, c.depth)}
      ${slider('cfgHtml', '保留完整 HTML 轮数<em>HTML KEEP</em>', 0, 8, 1, c.htmlDepth)}
      <div class="m-row" style="border-top:1px solid var(--line);padding:15px 0"><div class="m-row-t">流式输出</div><div class="m-switch ${c.stream ? 'on' : ''}" id="cfgStream"><i></i></div></div>
      <div class="m-row" style="border:none;padding:0 0 16px"><div class="m-row-t">截断自动续写</div><div class="m-switch ${c.retryOnCut ? 'on' : ''}" id="cfgRetry"><i></i></div></div>
    </div>`;
  const bind = (id, fmt) => {
    const inp = $('#' + id); if (!inp) return;
    const upd = () => {
      const min = +inp.min, max = +inp.max, v = +inp.value;
      const pct = (v - min) / (max - min) * 100;
      $('#' + id + 'Fill').style.width = pct + '%';
      $('#' + id + 'Knob').style.left = pct + '%';
      $('#' + id + 'Val').textContent = fmt ? fmt(v) : v;
    };
    inp.addEventListener('input', upd); upd();
  };
  bind('cfgTok'); bind('cfgTemp', v => (v / 100).toFixed(2)); bind('cfgDepth'); bind('cfgHtml');
  ['cfgStream', 'cfgRetry'].forEach(id => $('#' + id).onclick = e => e.currentTarget.classList.toggle('on'));
};
M.actions['cfg-save'] = () => {
  M.cfg.maxTokens = +$('#cfgTok').value;
  M.cfg.temperature = +$('#cfgTemp').value / 100;
  M.cfg.depth = +$('#cfgDepth').value;
  M.cfg.htmlDepth = +$('#cfgHtml').value;
  M.cfg.stream = $('#cfgStream').classList.contains('on');
  M.cfg.retryOnCut = $('#cfgRetry').classList.contains('on');
  M.saveCfg(); M.toast('设置已保存'); M.back(); M.Home.render();
};

})();
