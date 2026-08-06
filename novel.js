/* =========================================================
   Luna Reader — novel.js
   1) 状态栏 / 灵动岛 / 电池 / 字体：与 index.html 同源同步
   2) 底部三页导航 + 光柱滑动
   3) 创作台：AI 生成书名 / 作者 / 简介 / 大纲
   4) 详情页 · 目录 · 阅读器：全部内容由 AI 实时生成
   5) 书架：AI 作品入库 + 本地文件导入（自动解析目录）
========================================================= */

/* =========================================================
   一、状态栏同步（逻辑与 index 的 script.js 保持一致）
========================================================= */
function updateTime(){
  const el = document.getElementById('statusTime');
  if(!el) return;
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  el.textContent = new Date().toLocaleTimeString('zh-CN',{
    timeZone: tz, hour:'2-digit', minute:'2-digit', hour12:false
  });
}

function updateBattery(){
  const pctEl = document.getElementById('batPct');
  const innerEl = document.getElementById('batInner');
  function render(pct){
    const p = Math.round(pct);
    if(pctEl) pctEl.textContent = p;
    if(innerEl){
      innerEl.style.width = p + '%';
      innerEl.style.background = p <= 20
        ? 'linear-gradient(90deg, #f87171, #ef4444)'
        : 'linear-gradient(90deg, #6ee7b7, #34d399)';
    }
  }
  if('getBattery' in navigator){
    navigator.getBattery().then(b=>{
      render(b.level*100);
      b.addEventListener('levelchange',()=>render(b.level*100));
    }).catch(()=>render(76));
  }else{ render(76); }
}

function applyIsland(){
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const el      = document.getElementById('statusIsland');
  if(!el) return;
  if(!enabled){ el.innerHTML=''; return; }
  const map = {
    minimal:`<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:`<div class="si-glow"><div class="si-capsule"></div></div>`,
    clock:`<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="siClockText">--:--</span></div></div>`,
    pulse:`<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
    ripple:`<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
    rainbow:`<div class="si-rainbow"><div class="si-capsule"></div></div>`,
    music:`<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
    scan:`<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`
  };
  el.innerHTML = map[style] || map.minimal;
  clearInterval(window._siClockTimer);
  if(style === 'clock'){
    const tick = ()=>{
      const t = document.getElementById('siClockText');
      if(!t) return;
      const n = new Date();
      t.textContent = n.getHours()+':'+String(n.getMinutes()).padStart(2,'0');
    };
    tick(); window._siClockTimer = setInterval(tick,10000);
  }
}

/* 全局自定义字体：只接管字族，不覆盖本 App 的字号与配色，避免破坏排版 */
async function applyGlobalFont(){
  const name = localStorage.getItem('luna_font_active_name');
  const id   = parseInt(localStorage.getItem('luna_font_active_id'));
  if(!name || !id) return;
  try{
    const db = await new Promise((res,rej)=>{
      const r = indexedDB.open('LunaFontDB',4);
      r.onsuccess = e=>res(e.target.result);
      r.onerror = ()=>rej();
    });
    const all = await new Promise(res=>{
      const r = db.transaction('fonts').objectStore('fonts').getAll();
      r.onsuccess = ()=>res(r.result||[]); r.onerror = ()=>res([]);
    });
    const f = all.find(x=>x.id===id);
    if(!f) return;
    const face = new FontFace(name, `url(${f.data})`);
    await face.load(); document.fonts.add(face);
    let tag = document.getElementById('luna-font-override');
    if(!tag){ tag = document.createElement('style'); tag.id='luna-font-override'; document.head.appendChild(tag); }
    tag.textContent = `body,.tb-name,.mh-title,.c-title,.sh-title,.di-cn,.ftab,.soon-title,.ed-title,.st-h,.dt-title,.rd-title{font-family:'${name}','Noto Serif SC',sans-serif !important;}`;
  }catch(e){}
}

window.addEventListener('storage', e=>{
  if(e.key === 'luna_island_update') applyIsland();
  if(e.key === 'luna_font_update') applyGlobalFont();
});

/* =========================================================
   二、常量与数据
========================================================= */
const PALETTES = [
  {id:'iris',  c1:'#EFEDF8', c2:'#CFCBE9', ct:'#3E3A66'},
  {id:'mist',  c1:'#EBF1F7', c2:'#C7DAEA', ct:'#28405A'},
  {id:'jade',  c1:'#ECF3F0', c2:'#C8DCD4', ct:'#27463D'},
  {id:'quartz',c1:'#F8EEF2', c2:'#E7CFD9', ct:'#553444'},
  {id:'ink',   c1:'#EDEEF3', c2:'#BCBFCE', ct:'#22243A'},
  {id:'dusk',  c1:'#EFEBF3', c2:'#CBC2DD', ct:'#3C3155'},
  {id:'frost', c1:'#EDF3F6', c2:'#C6DCE4', ct:'#22434C'},
  {id:'lilac', c1:'#F4EEF7', c2:'#DCC9E6', ct:'#4A3358'}
];
const CATS = {serial:'连载中', end:'已完结', plan:'待读'};

/* 创作台的可选项：点击句子里的下划线词即可切换 */
const SF = {
  genre:{label:'题材', opts:['现代言情','古代言情','悬疑推理','都市异能','仙侠修真','科幻未来','奇幻冒险','校园青春','无限流','年代生活','宫斗权谋','末世求生','职场商战','武侠江湖','灵异怪谈','轻松日常']},
  lead:{label:'主角气质', opts:['清冷疏离','温柔坚韧','疯批偏执','腹黑算计','明媚张扬','沉默寡言','天真赤诚','冷静自持','慵懒不羁','外冷内热']},
  foil:{label:'对手戏', opts:['偏执占有','高岭之花','病娇忠犬','桀骜不驯','矜贵冷傲','痞帅玩世','温润如玉','杀伐果断','别扭傲娇','神秘莫测']},
  tone:{label:'基调', opts:['细腻克制','热烈浓稠','清冷疏淡','轻快明亮','阴郁压抑','诗意散文','悬疑紧绷','温柔治愈']},
  era:{label:'背景', opts:['当代都市','民国旧影','架空王朝','近未来','异世大陆','八零九零','海外异国','小城校园','废土之上','深海之城']},
  pov:{label:'叙事视角', opts:['第三人称·主角视角','第三人称·全知','第一人称·我','双视角交替']},
  pace:{label:'节奏', opts:['慢热铺陈','张弛有度','快节奏推进']},
  ending:{label:'结局倾向', opts:['圆满收束','遗憾收场','开放式','先苦后甜','意难平']},
  length:{label:'篇幅', opts:['短篇 · 24 章','中篇 · 60 章','长篇 · 120 章','超长 · 200 章']},
  words:{label:'每章字数', opts:['1200 字左右','2000 字左右','3000 字左右']}
};
const SF_DEFAULT = {
  genre:'现代言情', lead:'清冷疏离', foil:'偏执占有', tone:'细腻克制', era:'当代都市',
  pov:'第三人称·主角视角', pace:'张弛有度', ending:'先苦后甜', length:'中篇 · 60 章', words:'2000 字左右'
};

/* =========================================================
   三、本地存储（IndexedDB：书目 + 章节正文分表）
========================================================= */
const DB_NAME = 'LunaNovelDB', DB_VER = 1;
const S_SHELF = 'shelf', S_CHAP = 'chapters';
let _db = null;

function openDB(){
  return new Promise((res,rej)=>{
    if(_db) return res(_db);
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = e=>{
      const db = e.target.result;
      if(!db.objectStoreNames.contains(S_SHELF)) db.createObjectStore(S_SHELF,{keyPath:'id'});
      if(!db.objectStoreNames.contains(S_CHAP))  db.createObjectStore(S_CHAP,{keyPath:'key'});
    };
    r.onsuccess = e=>{ _db = e.target.result; res(_db); };
    r.onerror   = ()=>rej(r.error);
  });
}
function dbAll(store){
  return openDB().then(db=>new Promise((res,rej)=>{
    const r = db.transaction(store,'readonly').objectStore(store).getAll();
    r.onsuccess=()=>res(r.result||[]); r.onerror=()=>rej(r.error);
  }));
}
function dbGet(store,key){
  return openDB().then(db=>new Promise((res)=>{
    const r = db.transaction(store,'readonly').objectStore(store).get(key);
    r.onsuccess=()=>res(r.result||null); r.onerror=()=>res(null);
  }));
}
function dbPut(store,val){
  return openDB().then(db=>new Promise((res,rej)=>{
    const tx = db.transaction(store,'readwrite');
    tx.objectStore(store).put(val);
    tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error);
  }));
}
function dbDel(store,key){
  return openDB().then(db=>new Promise((res)=>{
    const tx = db.transaction(store,'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete=()=>res(); tx.onerror=()=>res();
  }));
}
function dbDelPrefix(store,prefix){
  return openDB().then(db=>new Promise((res)=>{
    const tx = db.transaction(store,'readwrite');
    const os = tx.objectStore(store);
    const rq = os.openCursor();
    rq.onsuccess = e=>{
      const c = e.target.result;
      if(!c) return;
      if(String(c.key).startsWith(prefix)) c.delete();
      c.continue();
    };
    tx.oncomplete=()=>res(); tx.onerror=()=>res();
  }));
}

const chapKey = (bookId, idx)=> `${bookId}#${idx}`;
function getChapter(bookId, idx){ return dbGet(S_CHAP, chapKey(bookId,idx)); }
function putChapter(bookId, idx, data){
  return dbPut(S_CHAP, Object.assign({key:chapKey(bookId,idx), bookId, idx}, data));
}

let state = {
  books: [],
  filter:'all',
  sort:'recent',
  view:'grid',
  query:'',
  selecting:false,
  picked:new Set(),
  page:'shelf',
  sheetId:null,
  editId:null,
  editPal:'iris',
  editCat:'serial',
  editCover:null,
  editMode:'manual',
  imported:null,
  form: Object.assign({}, SF_DEFAULT),
  detailId:null,
  reader:{bookId:null, idx:0, streaming:false, abort:null},
  rd:{size:17, lead:2.05, theme:'paper', font:'serif'},
  views:[]
};

let _saveTimer = null;
function save(){
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async ()=>{
    try{
      const db = await openDB();
      const tx = db.transaction(S_SHELF,'readwrite');
      const os = tx.objectStore(S_SHELF);
      state.books.forEach(b=>os.put(b));
    }catch(e){}
  }, 220);
}
async function saveNow(){ clearTimeout(_saveTimer);
  try{
    const db = await openDB();
    const tx = db.transaction(S_SHELF,'readwrite');
    const os = tx.objectStore(S_SHELF);
    state.books.forEach(b=>os.put(b));
  }catch(e){}
}
async function load(){
  try{
    const arr = await dbAll(S_SHELF);
    state.books = arr.sort((a,b)=>(b.addedAt||0)-(a.addedAt||0));
  }catch(e){ state.books = []; }
  try{
    const rd = JSON.parse(localStorage.getItem('luna_reader_prefs')||'null');
    if(rd) Object.assign(state.rd, rd);
    const fm = JSON.parse(localStorage.getItem('luna_studio_form')||'null');
    if(fm) Object.assign(state.form, fm);
  }catch(e){}
}
function saveReaderPrefs(){ try{ localStorage.setItem('luna_reader_prefs', JSON.stringify(state.rd)); }catch(e){} }
function saveForm(){ try{ localStorage.setItem('luna_studio_form', JSON.stringify(state.form)); }catch(e){} }

async function removeBook(id){
  state.books = state.books.filter(x=>x.id!==id);
  await dbDel(S_SHELF, id);
  await dbDelPrefix(S_CHAP, id+'#');
}

/* =========================================================
   四、通用零件
========================================================= */
const $ = s=>document.querySelector(s);
const $$ = s=>Array.from(document.querySelectorAll(s));

function pal(id){ return PALETTES.find(p=>p.id===id) || PALETTES[0]; }
function pct(b){ return b.total>0 ? Math.min(100, Math.round(b.read/b.total*100)) : 0; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function uid(p){ return (p||'b') + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function clamp(n,a,z){ return Math.max(a, Math.min(z, n)); }
function fmtNum(n){
  n = Number(n)||0;
  if(n >= 100000000) return (n/100000000).toFixed(1).replace(/\.0$/,'') + '亿';
  if(n >= 10000) return (n/10000).toFixed(1).replace(/\.0$/,'') + '万';
  return String(Math.round(n));
}
function fmtDate(ts){
  const d = new Date(ts||Date.now());
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}
function relTime(ts){
  const s = (Date.now()-(ts||0))/1000;
  if(s < 60) return '刚刚';
  if(s < 3600) return Math.floor(s/60)+' 分钟前';
  if(s < 86400) return Math.floor(s/3600)+' 小时前';
  if(s < 86400*30) return Math.floor(s/86400)+' 天前';
  return fmtDate(ts);
}

let toastTimer;
function toast(msg){
  const t = $('#toast');
  $('#toastTxt').textContent = msg;
  t.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('is-on'), 2100);
}
function buzz(ms){ if(navigator.vibrate) try{ navigator.vibrate(ms); }catch(e){} }

function ripple(e, host){
  const r = host.getBoundingClientRect();
  const d = Math.max(r.width, r.height);
  const s = document.createElement('span');
  s.className = 'ripple';
  s.style.width = s.style.height = d+'px';
  s.style.left = ((e.clientX||r.left+r.width/2) - r.left - d/2)+'px';
  s.style.top  = ((e.clientY||r.top+r.height/2) - r.top - d/2)+'px';
  const pos = getComputedStyle(host).position;
  if(pos === 'static') host.style.position = 'relative';
  host.appendChild(s);
  setTimeout(()=>s.remove(), 640);
}
document.addEventListener('pointerdown', e=>{
  const b = e.target.closest('.sha, .tool-btn, .mi, .em-btn, .sb-item, .dt-act, .rd-act');
  if(b) ripple(e, b);
});

/* 数字滚动 */
function countTo(el, target, dur){
  if(!el) return;
  target = Number(target)||0;
  const t0 = performance.now(), d = dur||1100;
  const step = now=>{
    const k = clamp((now-t0)/d, 0, 1);
    const e = 1 - Math.pow(1-k, 3);
    el.textContent = fmtNum(Math.round(target*e));
    if(k < 1) requestAnimationFrame(step);
    else el.textContent = fmtNum(target);
  };
  requestAnimationFrame(step);
}

/* 揭示动画 */
const io = new IntersectionObserver(entries=>{
  entries.forEach(en=>{
    if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); }
  });
},{threshold:.06});
function observeReveals(){ $$('.reveal:not(.in)').forEach(el=>io.observe(el)); }

/* 骨架屏 */
function skeleton(rows, cls){
  let h = '';
  for(let i=0;i<rows;i++) h += `<div class="sk ${cls||''}" style="--sd:${(i*0.09).toFixed(2)}s"></div>`;
  return h;
}

/* =========================================================
   五、AI 引擎（复用设置页保存的接口配置）
   luna_api_current = {baseUrl, apiKey}   luna_api_model = 模型名
========================================================= */
function aiCfg(){
  let cur = {};
  try{ cur = JSON.parse(localStorage.getItem('luna_api_current')||'{}'); }catch(e){}
  return {
    base:(cur.baseUrl||'').trim().replace(/\/+$/,''),
    key:(cur.apiKey||'').trim(),
    model:(localStorage.getItem('luna_api_model')||'').trim()
  };
}
function aiReady(){ const c = aiCfg(); return !!(c.base && c.key && c.model); }

function needAI(){
  if(aiReady()) return true;
  askDialog(
    '还没有连接模型',
    '这里的每一段文字都由你自己配置的模型现写。去「设置 · AI 模型」填好接口、选一个模型，再回来落笔。',
    '去设置',
    ()=>{ window.location.href = 'settings.html'; }
  );
  return false;
}

async function aiRaw(messages, opt){
  opt = opt || {};
  const c = aiCfg();
  if(!aiReady()) throw new Error('NO_API');
  const ctrl = new AbortController();
  if(opt.signalHost) opt.signalHost.abort = ()=>ctrl.abort();
  const resp = await fetch(c.base + '/chat/completions', {
    method:'POST',
    signal: ctrl.signal,
    headers:{ 'Authorization':'Bearer '+c.key, 'Content-Type':'application/json' },
    body: JSON.stringify({
      model: c.model,
      messages,
      temperature: opt.temperature==null ? 0.94 : opt.temperature,
      max_tokens: opt.max_tokens || 2200,
      stream: false
    })
  });
  if(!resp.ok){
    const t = await resp.text().catch(()=> '');
    throw new Error('HTTP ' + resp.status + (t ? ' · ' + t.slice(0,120) : ''));
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

/* 流式：正文逐字浮现 */
async function aiStream(messages, onDelta, opt){
  opt = opt || {};
  const c = aiCfg();
  if(!aiReady()) throw new Error('NO_API');
  const ctrl = new AbortController();
  if(opt.host) opt.host.abort = ()=>ctrl.abort();
  let resp;
  try{
    resp = await fetch(c.base + '/chat/completions', {
      method:'POST',
      signal: ctrl.signal,
      headers:{ 'Authorization':'Bearer '+c.key, 'Content-Type':'application/json' },
      body: JSON.stringify({
        model: c.model, messages,
        temperature: opt.temperature==null ? 0.96 : opt.temperature,
        max_tokens: opt.max_tokens || 4000,
        stream: true
      })
    });
  }catch(err){
    if(err.name === 'AbortError') return '';
    throw err;
  }
  if(!resp.ok || !resp.body){
    /* 接口不支持流式就退回一次性返回 */
    const text = await aiRaw(messages, {max_tokens: opt.max_tokens || 4000, temperature: opt.temperature});
    onDelta && onDelta(text, text);
    return text;
  }
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = '', full = '';
  while(true){
    let chunk;
    try{ chunk = await reader.read(); }
    catch(e){ break; }
    if(chunk.done) break;
    buf += dec.decode(chunk.value, {stream:true});
    const lines = buf.split('\n');
    buf = lines.pop();
    for(const line of lines){
      const s = line.trim();
      if(!s.startsWith('data:')) continue;
      const payload = s.slice(5).trim();
      if(payload === '[DONE]') continue;
      try{
        const j = JSON.parse(payload);
        const d = j.choices?.[0]?.delta?.content || '';
        if(d){ full += d; onDelta && onDelta(d, full); }
      }catch(e){}
    }
  }
  return full;
}

/* 从模型回复里稳妥地抠出 JSON */
function extractJSON(txt){
  if(!txt) return null;
  let s = String(txt).trim();
  s = s.replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
  const tryParse = t=>{ try{ return JSON.parse(t); }catch(e){ return null; } };
  let r = tryParse(s);
  if(r) return r;
  const a = s.indexOf('['), o = s.indexOf('{');
  let start = (a<0) ? o : (o<0 ? a : Math.min(a,o));
  if(start < 0) return null;
  const openCh = s[start], closeCh = openCh === '[' ? ']' : '}';
  let depth = 0, inStr = false, escp = false, end = -1;
  for(let i=start;i<s.length;i++){
    const ch = s[i];
    if(inStr){
      if(escp){ escp = false; }
      else if(ch === '\\') escp = true;
      else if(ch === '"') inStr = false;
      continue;
    }
    if(ch === '"'){ inStr = true; continue; }
    if(ch === openCh) depth++;
    else if(ch === closeCh){ depth--; if(depth === 0){ end = i; break; } }
  }
  if(end < 0) return null;
  return tryParse(s.slice(start, end+1));
}

async function aiJSON(system, user, opt){
  opt = opt || {};
  const msgs = [
    {role:'system', content: system + '\n\n【输出纪律】只输出一个合法 JSON，不要 Markdown 代码块，不要任何解释性文字，不要在 JSON 前后添加任何字符。字符串内不要出现未转义的换行。'},
    {role:'user', content: user}
  ];
  let lastErr = null;
  for(let i=0;i<3;i++){
    try{
      const txt = await aiRaw(msgs, {max_tokens: opt.max_tokens || 2400, temperature: i===0 ? (opt.temperature==null?0.92:opt.temperature) : 0.5});
      const j = extractJSON(txt);
      if(j) return j;
      lastErr = new Error('模型没有返回可解析的 JSON');
      msgs.push({role:'assistant', content: String(txt).slice(0,400)});
      msgs.push({role:'user', content:'上一次回复不是合法 JSON。请只重新输出 JSON 本体。'});
    }catch(e){
      lastErr = e;
      if(String(e.message).includes('NO_API')) throw e;
      await new Promise(r=>setTimeout(r, 500 + i*700));
    }
  }
  throw lastErr || new Error('生成失败');
}

/* 生成时的仪式感浮层 */
const GEN_STEPS = ['读你写下的设定','拟一个能被记住的书名','让主角先站起来','把故事织成大纲','落款、盖印'];
let _genTimer = null, _genStep = 0;
function genOpen(title, steps){
  const ov = $('#genOverlay');
  const list = steps || GEN_STEPS;
  _genStep = 0;
  $('#genTitle').textContent = title || '正在落笔';
  $('#genSteps').innerHTML = list.map((s,i)=>`<div class="gs-item ${i===0?'is-on':''}"><span class="gs-dot"></span><span class="gs-txt">${esc(s)}</span></div>`).join('');
  ov.classList.add('is-on');
  clearInterval(_genTimer);
  _genTimer = setInterval(()=>{
    const items = $$('#genSteps .gs-item');
    if(_genStep < items.length-1){
      items[_genStep].classList.remove('is-on');
      items[_genStep].classList.add('is-done');
      _genStep++;
      items[_genStep].classList.add('is-on');
    }
  }, 2600);
}
function genClose(){
  clearInterval(_genTimer);
  $('#genOverlay').classList.remove('is-on');
  const gc = document.querySelector('#genOverlay .gen-cast');
  if(gc) gc.remove();
}
function genFail(e){
  genClose();
  const m = String(e && e.message || e || '');
  if(m.includes('NO_API')){ needAI(); return; }
  toast('生成失败 · ' + (m.slice(0,40) || '请检查接口'));
}

/* =========================================================
   六、页面导航 + 光柱 + 视图栈
========================================================= */
const PAGE_INFO = {
  novel:{el:'#pgNovel', name:'小说',  kicker:'ORIGINALS'},
  fan:  {el:'#pgFan',   name:'同人',  kicker:'FAN WORKS'},
  shelf:{el:'#pgShelf', name:'书架',  kicker:'BOOKSHELF'}
};
const ORDER = ['novel','fan','shelf'];

function switchPage(name){
  if(state.page === name) return;
  exitSelect();
  closeAll();

  const from = ORDER.indexOf(state.page);
  const to   = ORDER.indexOf(name);
  const cur  = $(PAGE_INFO[state.page].el);
  const next = $(PAGE_INFO[name].el);

  cur.classList.toggle('leave-up', to > from);
  cur.classList.remove('is-active');
  setTimeout(()=>cur.classList.remove('leave-up'), 520);

  next.classList.toggle('leave-up', to < from);
  requestAnimationFrame(()=>{
    next.classList.remove('leave-up');
    next.classList.add('is-active');
  });

  state.page = name;
  $('#tbName').textContent = PAGE_INFO[name].name;
  $('#tbKicker').textContent = 'LUNA READER · ' + PAGE_INFO[name].kicker;

  const onShelf = name === 'shelf';
  $('#btnSearch').style.display = onShelf ? '' : 'none';
  $('#btnAdd').style.display = onShelf ? '' : 'none';
  if(!onShelf) closeSearch();
  if(name === 'novel') renderStudio();
  if(name === 'fan')   renderFan();

  $$('.dock-item').forEach(d=>d.classList.toggle('is-on', d.dataset.page===name));
  moveBeam(to);
  $('#topbar').classList.toggle('is-solid', !onShelf);
  buzz(8);
  observeReveals();
}

function moveBeam(i){
  const beam = $('#dockBeam');
  beam.style.transform = `translateX(${i*100}%)`;
}

$$('.dock-item').forEach(d=>{
  d.addEventListener('click', ()=>switchPage(d.dataset.page));
});

/* ---- 覆盖式视图（详情 / 阅读器）：状态栏保持不变，dock 收起 ---- */
function pushView(id){
  const el = document.getElementById(id);
  if(!el) return;
  state.views.push(id);
  document.querySelector('.luna-frame').classList.add('viewing');
  requestAnimationFrame(()=>el.classList.add('is-on'));
  buzz(8);
}
function popView(){
  const id = state.views.pop();
  if(!id) return;
  const el = document.getElementById(id);
  el && el.classList.remove('is-on');
  if(!state.views.length) document.querySelector('.luna-frame').classList.remove('viewing');
  buzz(6);
}
function popAllViews(){
  while(state.views.length) popView();
}

/* 返回桌面 */
$('#btnBack').addEventListener('click', ()=>{
  const f = $('.luna-frame');
  f.style.transition = 'opacity .3s ease, transform .34s cubic-bezier(.4,0,.2,1)';
  f.style.opacity = '0';
  f.style.transform = 'scale(.965)';
  setTimeout(()=>{ window.location.href = 'index.html'; }, 280);
});

/* =========================================================
   七、书架渲染
========================================================= */
function shelfBooks(){ return state.books.filter(b=>b.shelf !== false); }

function filtered(){
  let arr = shelfBooks();

  if(state.query){
    const q = state.query.toLowerCase();
    arr = arr.filter(b =>
      String(b.title||'').toLowerCase().includes(q) ||
      String(b.author||'').toLowerCase().includes(q) ||
      (b.tags||[]).some(t=>String(t).toLowerCase().includes(q))
    );
  }
  if(state.filter === 'reading') arr = arr.filter(b=>b.read>0 && b.read<b.total);
  if(state.filter === 'fav')     arr = arr.filter(b=>b.fav);
  if(state.filter === 'done')    arr = arr.filter(b=>b.total>0 && b.read>=b.total);

  const cmp = {
    recent:(a,b)=>(b.lastRead||0)-(a.lastRead||0),
    added:(a,b)=>(b.addedAt||0)-(a.addedAt||0),
    progress:(a,b)=>pct(b)-pct(a),
    title:(a,b)=>String(a.title).localeCompare(String(b.title),'zh-Hans-CN')
  }[state.sort];
  arr.sort(cmp);
  arr.sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0));
  return arr;
}

function coverHTML(b, idx){
  const p = pal(b.pal);
  if(b.coverImg){
    return `
    <div class="cover has-img">
      <img class="cv-img" src="${b.coverImg}" alt="" />
      <div class="cv-img-veil"></div>
      <div class="cv-shine"></div>
    </div>`;
  }
  return `
    <div class="cover" style="--c1:${p.c1};--c2:${p.c2};--ct:${p.ct}">
      <div class="cv-bg"></div>
      <div class="cv-tex"></div>
      <span class="cv-arc"></span><span class="cv-arc2"></span>
      <div class="cv-title">${esc(b.title)}</div>
      <span class="cv-rule"></span><span class="cv-mark"></span>
      <div class="cv-author">${esc(b.author)}</div>
      <div class="cv-idx">${String((idx||0)+1).padStart(2,'0')}</div>
      <div class="cv-shine"></div>
    </div>`;
}

/* 大封面（详情页 / 继续阅读卡 / 面板通用） */
function bigCoverHTML(b){
  const p = pal(b.pal);
  if(b.coverImg){
    return `<img class="cv-img" src="${b.coverImg}" alt="" /><div class="cv-img-veil"></div><div class="cv-shine"></div>`;
  }
  return `
    <div class="cv-bg" style="background:linear-gradient(155deg,${p.c1},${p.c2})"></div>
    <div class="cv-tex"></div>
    <span class="cv-arc"></span><span class="cv-arc2"></span>
    <div class="cv-title" style="color:${p.ct}">${esc(b.title)}</div>
    <span class="cv-rule" style="background:linear-gradient(90deg,${p.ct},transparent)"></span>
    <div class="cv-author" style="color:${p.ct}">${esc(b.author)}</div>
    <div class="cv-spine"></div>
    <div class="cv-shine"></div>`;
}

function renderGrid(){
  const grid = $('#bookGrid');
  const list = filtered();
  const empty = $('#emptyState');

  grid.classList.toggle('list', state.view === 'list');

  if(!list.length){
    grid.innerHTML = '';
    empty.hidden = false;
    $('#emptyState .em-title').textContent = state.query ? '没有找到这本书' : '书架还空着';
    $('#emptyState .em-desc').textContent  = state.query
      ? '换个书名、作者或标签再试试。'
      : '去「小说」写一本新的，或从这里导入你自己的书。';
    return;
  }
  empty.hidden = true;

  grid.innerHTML = list.map((b,i)=>{
    const p = pct(b);
    const catCls = b.cat==='end' ? 'end' : (b.cat==='plan' ? 'plan' : '');
    return `
    <article class="card ${b.fav?'fav':''} ${state.picked.has(b.id)?'picked':''}" data-id="${b.id}" style="--i:${i}">
      <div class="cv-wrap">
        ${coverHTML(b,i)}
        <span class="c-badge ${catCls}">${CATS[b.cat]||'连载中'}</span>
        ${b.source==='ai' ? '<span class="c-ai">AI</span>' : ''}
        <span class="c-star"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.6l2.4 4.9 5.4.8-3.9 3.8.9 5.3-4.8-2.5-4.8 2.5.9-5.3-3.9-3.8 5.4-.8L12 4.6z"/></svg></span>
        <span class="c-check"><svg viewBox="0 0 24 24" fill="none"><path d="M5.8 12.4l4 4 8.4-8.8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      </div>
      <div class="c-body">
        <div class="c-title">${esc(b.title)}</div>
        <div class="c-sub">
          <span class="c-author">${esc(b.author)}</span>
          <span class="c-pct">${p}%</span>
        </div>
        <div class="c-chap">第 ${b.read} / ${b.total} 章</div>
        <div class="c-track"><span class="c-fill" data-w="${p}" style="--pd:${(i*0.05+0.15).toFixed(2)}s"></span></div>
      </div>
    </article>`;
  }).join('');

  const cards = Array.from(grid.children);
  cards.forEach((c,i)=>{
    c.style.opacity='0';
    c.style.transform='translateY(18px)';
    c.style.filter='blur(6px)';
    requestAnimationFrame(()=>{
      c.style.transition = `opacity .6s cubic-bezier(.22,1,.36,1) ${i*0.045}s, transform .72s cubic-bezier(.22,1,.36,1) ${i*0.045}s, filter .6s ease ${i*0.045}s`;
      c.style.opacity='1'; c.style.transform='none'; c.style.filter='none';
    });
    setTimeout(()=>{ c.style.transition=''; c.style.opacity=''; c.style.transform=''; c.style.filter=''; }, 900 + i*50);
  });
  requestAnimationFrame(()=>{
    grid.querySelectorAll('.c-fill').forEach(f=>{ f.style.width = f.dataset.w + '%'; });
  });

  bindCards();
}

function renderMeta(){
  const bs = shelfBooks();
  const reading = bs.filter(b=>b.read>0 && b.read<b.total).length;
  const done    = bs.filter(b=>b.total>0 && b.read>=b.total).length;
  const fav     = bs.filter(b=>b.fav).length;
  const chapters= bs.reduce((s,b)=>s+(b.read||0),0);

  $('#mhCount').textContent = bs.length;
  $('#mhRead').textContent  = chapters;
  $('#stReading').textContent = reading;
  $('#stFinish').textContent  = done;
  $('#stFav').textContent     = fav;
  $('#cAll').textContent = bs.length;
  $('#cReading').textContent = reading;
  $('#cFav').textContent = fav;
  $('#cDone').textContent = done;

  const d = new Date();
  const M = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  $('#mhDate').textContent = `${M[d.getMonth()]} ${String(d.getDate()).padStart(2,'0')} ${d.getFullYear()}`;
}

function renderNow(){
  const card = $('#nowCard');
  const bs = shelfBooks();
  const cands = bs.filter(b=>b.read>0 && b.read<b.total)
    .sort((a,b)=>(b.lastRead||0)-(a.lastRead||0));
  const b = cands[0] || bs.filter(x=>x.read<x.total)[0];
  if(!b){ card.style.display='none'; return; }
  card.style.display='';
  card.dataset.id = b.id;

  const per = pct(b);
  $('#ncCover').innerHTML = bigCoverHTML(b);
  $('#ncTitle').textContent = b.title;
  $('#ncAuthor').textContent = b.author;
  $('#ncChap').textContent = `第 ${b.read} 章 / 共 ${b.total} 章`;
  $('#ncPct').textContent = per + '%';
  requestAnimationFrame(()=>{ $('#ncFill').style.width = per + '%'; });
}

function renderAll(){ renderMeta(); renderNow(); renderGrid(); moveFtabUl(); }

/* =========================================================
   八、卡片交互：点按 / 长按多选
========================================================= */
function bindCards(){
  $$('#bookGrid .card').forEach(card=>{
    let timer=null, moved=false, sx=0, sy=0, longed=false;

    card.addEventListener('pointerdown', e=>{
      moved=false; longed=false; sx=e.clientX; sy=e.clientY;
      card.classList.add('pressing');
      timer = setTimeout(()=>{
        longed = true;
        card.classList.remove('pressing');
        buzz(16);
        if(!state.selecting) enterSelect();
        togglePick(card.dataset.id, card);
      }, 430);
    });
    card.addEventListener('pointermove', e=>{
      if(Math.abs(e.clientX-sx)>8 || Math.abs(e.clientY-sy)>8){
        moved=true; clearTimeout(timer); card.classList.remove('pressing');
      }
    });
    const end = ()=>{ clearTimeout(timer); card.classList.remove('pressing'); };
    card.addEventListener('pointerup', ()=>{
      end();
      if(moved || longed) return;
      if(state.selecting){ togglePick(card.dataset.id, card); buzz(6); }
      else openSheet(card.dataset.id);
    });
    card.addEventListener('pointercancel', end);
    card.addEventListener('pointerleave', end);
  });
}

function enterSelect(){
  state.selecting = true;
  $('.luna-frame').classList.add('selecting');
  $('#tbSelect').classList.add('is-on');
  $('#selbar').classList.add('is-on');
  updateSelCount();
}
function exitSelect(){
  if(!state.selecting) return;
  state.selecting = false;
  state.picked.clear();
  $('.luna-frame').classList.remove('selecting');
  $('#tbSelect').classList.remove('is-on');
  $('#selbar').classList.remove('is-on');
  $$('#bookGrid .card').forEach(c=>c.classList.remove('picked'));
}
function togglePick(id, card){
  if(state.picked.has(id)){ state.picked.delete(id); card.classList.remove('picked'); }
  else{ state.picked.add(id); card.classList.add('picked'); }
  updateSelCount();
}
function updateSelCount(){ $('#selCount').textContent = state.picked.size; }

$('#btnSelDone').addEventListener('click', exitSelect);
$('#btnSelAll').addEventListener('click', ()=>{
  const cards = $$('#bookGrid .card');
  const all = cards.every(c=>state.picked.has(c.dataset.id));
  cards.forEach(c=>{
    if(all){ state.picked.delete(c.dataset.id); c.classList.remove('picked'); }
    else{ state.picked.add(c.dataset.id); c.classList.add('picked'); }
  });
  updateSelCount(); buzz(8);
});

$$('.sb-item').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const ids = Array.from(state.picked);
    if(!ids.length){ toast('先选中要处理的书'); return; }
    const act = btn.dataset.act;

    if(act === 'fav'){
      ids.forEach(id=>{ const b=state.books.find(x=>x.id===id); if(b) b.fav = true; });
      save(); renderAll(); exitSelect(); toast(`已收藏 ${ids.length} 本`);
    }
    if(act === 'done'){
      ids.forEach(id=>{ const b=state.books.find(x=>x.id===id); if(b){ b.read=b.total; b.cat='end'; b.lastRead=Date.now(); } });
      save(); renderAll(); exitSelect(); toast(`已标记读完 ${ids.length} 本`);
    }
    if(act === 'del'){
      askDialog('移出书架', `选中的 ${ids.length} 本书会从书架移除，已生成的正文也会一并清空。`, '确认移出', async ()=>{
        for(const id of ids) await removeBook(id);
        renderAll(); exitSelect(); toast('已移出书架');
      });
    }
  });
});

/* =========================================================
   九、筛选 / 排序 / 视图 / 搜索
========================================================= */
function moveFtabUl(){
  const on = $('#ftabs .ftab.is-on');
  const ul = $('#ftabUl');
  if(!on || !ul) return;
  ul.style.width = on.offsetWidth + 'px';
  ul.style.transform = `translateX(${on.offsetLeft}px)`;
}
$$('#ftabs .ftab').forEach(t=>{
  t.addEventListener('click', ()=>{
    $$('#ftabs .ftab').forEach(x=>x.classList.remove('is-on'));
    t.classList.add('is-on');
    state.filter = t.dataset.filter;
    moveFtabUl(); renderGrid(); buzz(6);
  });
});

const sortMenu = $('#sortMenu');
$('#btnSort').addEventListener('click', e=>{
  e.stopPropagation();
  const r = $('#btnSort').getBoundingClientRect();
  sortMenu.style.top = (r.bottom + 8) + 'px';
  sortMenu.classList.toggle('is-on');
});
document.addEventListener('click', e=>{
  if(!e.target.closest('#sortMenu') && !e.target.closest('#btnSort')) sortMenu.classList.remove('is-on');
});
$$('#sortMenu .mi').forEach(mi=>{
  mi.addEventListener('click', ()=>{
    $$('#sortMenu .mi').forEach(x=>x.classList.remove('is-on'));
    mi.classList.add('is-on');
    state.sort = mi.dataset.sort;
    $('#sortLabel').textContent = mi.textContent;
    sortMenu.classList.remove('is-on');
    renderGrid();
  });
});

$('#btnView').addEventListener('click', ()=>{
  state.view = state.view === 'grid' ? 'list' : 'grid';
  $('#viewIcon').innerHTML = state.view === 'grid'
    ? `<rect x="4.5" y="4.5" width="6" height="6" rx="1.4" stroke="currentColor" stroke-width="1.5"/><rect x="13.5" y="4.5" width="6" height="6" rx="1.4" stroke="currentColor" stroke-width="1.5"/><rect x="4.5" y="13.5" width="6" height="6" rx="1.4" stroke="currentColor" stroke-width="1.5"/><rect x="13.5" y="13.5" width="6" height="6" rx="1.4" stroke="currentColor" stroke-width="1.5"/>`
    : `<path d="M4.6 7h14.8M4.6 12h14.8M4.6 17h14.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`;
  renderGrid(); buzz(6);
});

const drawer = $('#searchDrawer');
function openSearch(){
  drawer.classList.add('is-on');
  $('#topbar').classList.add('is-solid');
  setTimeout(()=>$('#searchInput').focus(), 260);
}
function closeSearch(){
  drawer.classList.remove('is-on');
  $('#searchInput').value = '';
  $('#sdClear').classList.remove('is-on');
  state.query = '';
  renderGrid();
}
$('#btnSearch').addEventListener('click', ()=>{
  drawer.classList.contains('is-on') ? closeSearch() : openSearch();
});
$('#searchInput').addEventListener('input', e=>{
  state.query = e.target.value.trim();
  $('#sdClear').classList.toggle('is-on', !!state.query);
  renderGrid();
});
$('#sdClear').addEventListener('click', ()=>{
  $('#searchInput').value=''; state.query=''; $('#sdClear').classList.remove('is-on'); renderGrid();
});

/* 顶栏随滚动凝固 */
$('#shelfScroller').addEventListener('scroll', e=>{
  const solid = e.target.scrollTop > 26;
  if(state.page === 'shelf') $('#topbar').classList.toggle('is-solid', solid || drawer.classList.contains('is-on'));
}, {passive:true});
$('#novelScroller').addEventListener('scroll', e=>{
  if(state.page === 'novel') $('#topbar').classList.toggle('is-solid', e.target.scrollTop > 26);
}, {passive:true});

/* =========================================================
   十、书架里的书籍面板
========================================================= */
const scrim = $('#scrim');
const sheet = $('#sheet');
const editor = $('#editor');
const dialog = $('#dialog');

function closeAll(){
  const _cp = $('#charPick'); if(_cp) _cp.classList.remove('is-on');
  const _ft = $('#fxTocSheet'); if(_ft) _ft.classList.remove('is-on');
  sheet.classList.remove('is-on');
  editor.classList.remove('is-on');
  dialog.classList.remove('is-on');
  $('#tocSheet').classList.remove('is-on');
  scrim.classList.remove('is-on');
  sortMenu.classList.remove('is-on');
}
scrim.addEventListener('click', closeAll);

function openSheet(id){
  const b = state.books.find(x=>x.id===id);
  if(!b) return;
  state.sheetId = id;
  const per = pct(b);

  $('#shCover').innerHTML = bigCoverHTML(b);
  $('#shCat').textContent = CATS[b.cat] || '连载中';
  $('#shTitle').textContent = b.title;
  $('#shAuthor').textContent = b.author;
  $('#shTags').innerHTML = (b.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('');
  $('#shDesc').textContent = b.desc || '还没有写简介。';
  $('#shRead').textContent = b.read;
  $('#shTotal').textContent = b.total;
  $('#shPct').textContent = per + '%';
  const rg = $('#shRange');
  rg.max = b.total; rg.value = b.read;
  rg.style.setProperty('--p', per + '%');
  $('#shFav').textContent = b.fav ? '取消收藏' : '收藏';
  $('#shFav').classList.toggle('on', !!b.fav);
  $('#shInfo').style.display = b.source === 'ai' ? '' : 'none';

  ['.sh-head','.sh-desc','.sh-prog','.sh-acts'].forEach((s,i)=>{
    const el = sheet.querySelector(s);
    el.classList.add('stagger');
    el.style.setProperty('--sd', (0.08 + i*0.06) + 's');
  });

  scrim.classList.add('is-on');
  sheet.classList.add('is-on');
  buzz(8);
}

$('#shRange').addEventListener('input', e=>{
  const b = state.books.find(x=>x.id===state.sheetId);
  if(!b) return;
  b.read = parseInt(e.target.value) || 0;
  if(b.read >= b.total){ b.read = b.total; b.cat='end'; }
  else if(b.cat === 'end'){ b.cat = 'serial'; }
  b.lastRead = Date.now();
  const per = pct(b);
  $('#shRead').textContent = b.read;
  $('#shPct').textContent = per + '%';
  $('#shCat').textContent = CATS[b.cat];
  e.target.style.setProperty('--p', per + '%');
});
$('#shRange').addEventListener('change', ()=>{ save(); renderMeta(); renderNow(); renderGrid(); });

$('#shGo').addEventListener('click', ()=>{
  const b = state.books.find(x=>x.id===state.sheetId);
  if(!b) return;
  closeAll();
  setTimeout(()=>openReader(b.id, Math.min(b.total, (b.read||0)+1)), 200);
});
$('#shInfo').addEventListener('click', ()=>{
  const id = state.sheetId;
  closeAll();
  setTimeout(()=>openDetail(id), 200);
});
$('#shFav').addEventListener('click', ()=>{
  const b = state.books.find(x=>x.id===state.sheetId);
  if(!b) return;
  b.fav = !b.fav; save();
  $('#shFav').textContent = b.fav ? '取消收藏' : '收藏';
  $('#shFav').classList.toggle('on', b.fav);
  renderMeta(); renderGrid();
  toast(b.fav ? '已加入收藏' : '已取消收藏');
});
$('#shEdit').addEventListener('click', ()=>{
  const id = state.sheetId;
  sheet.classList.remove('is-on');
  setTimeout(()=>openEditor(id), 220);
});
$('#shDel').addEventListener('click', ()=>{
  const b = state.books.find(x=>x.id===state.sheetId);
  if(!b) return;
  askDialog('移出书架', `《${b.title}》会从书架移除，已生成的正文也会一并清空。`, '确认移出', async ()=>{
    await removeBook(b.id);
    renderAll(); closeAll(); toast('已移出书架');
  });
});

$('#ncGo').addEventListener('click', e=>{
  e.stopPropagation();
  const b = state.books.find(x=>x.id === $('#nowCard').dataset.id);
  if(b) openReader(b.id, Math.min(b.total, (b.read||0)+1));
});
$('#nowCard').addEventListener('click', e=>{
  if(e.target.closest('#ncGo')) return;
  const id = $('#nowCard').dataset.id;
  if(id) openSheet(id);
});

/* =========================================================
   十一、创作台（小说页）
   交互主体不是按钮，而是一段可以点的手写句子：
   点句子里带下划线的词 → 就地展开选项纸片
========================================================= */
const ST_SENTENCE = [
  {t:'我想读一个 '}, {k:'genre'}, {t:' 的故事，背景放在 '}, {k:'era'}, {t:'。\n'},
  {t:'主角 '}, {k:'lead'}, {t:'，要遇上 '}, {k:'foil'}, {t:'。\n'},
  {t:'整本书 '}, {k:'tone'}, {t:'，节奏 '}, {k:'pace'}, {t:'，用 '}, {k:'pov'}, {t:' 来讲，结局 '}, {k:'ending'}, {t:'。\n'},
  {t:'篇幅 '}, {k:'length'}, {t:'，每章 '}, {k:'words'}, {t:'。'}
];

function renderStudio(){
  const host = $('#stSentence');
  if(!host) return;
  host.innerHTML = ST_SENTENCE.map(seg=>{
    if(seg.t) return esc(seg.t).replace(/\n/g,'<br/>');
    return `<span class="blank" data-key="${seg.k}" role="button" tabindex="0">${esc(state.form[seg.k]||SF_DEFAULT[seg.k])}</span>`;
  }).join('');

  $$('#stSentence .blank').forEach(el=>{
    el.addEventListener('click', ()=>openPicker(el));
    el.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openPicker(el); } });
  });

  $('#stIdea').value  = state.form.idea || '';
  $('#stWant').value  = state.form.want || '';
  $('#stAvoid').value = state.form.avoid || '';
  renderDrafts();
}

let pickerFor = null;
function openPicker(el){
  const key = el.dataset.key;
  const def = SF[key];
  if(!def) return;
  const box = $('#stPicker');

  if(pickerFor === el && box.classList.contains('is-on')){ closePicker(); return; }
  pickerFor = el;
  $$('#stSentence .blank').forEach(x=>x.classList.remove('is-open'));
  el.classList.add('is-open');

  $('#stPickLabel').textContent = def.label;
  $('#stPickList').innerHTML = def.opts.map(o=>
    `<span class="opt ${o===state.form[key]?'is-on':''}" data-v="${esc(o)}"><i></i>${esc(o)}</span>`
  ).join('');

  /* 纸片跟着被点的词落下 */
  const sent = $('#stSentence').getBoundingClientRect();
  const r = el.getBoundingClientRect();
  box.style.top = (r.bottom - sent.top + 12) + 'px';
  box.classList.add('is-on');

  $$('#stPickList .opt').forEach(o=>{
    o.addEventListener('click', ()=>{
      state.form[key] = o.dataset.v;
      el.textContent = o.dataset.v;
      el.classList.add('just-set');
      setTimeout(()=>el.classList.remove('just-set'), 700);
      saveForm(); buzz(6); closePicker();
    });
  });
}
function closePicker(){
  $('#stPicker').classList.remove('is-on');
  $$('#stSentence .blank').forEach(x=>x.classList.remove('is-open'));
  pickerFor = null;
}
document.addEventListener('click', e=>{
  if(!e.target.closest('#stPicker') && !e.target.closest('.blank')) closePicker();
});

/* 抽一条线，展开更多设定 */
$('#stThread').addEventListener('click', ()=>{
  const on = $('#stExtra').classList.toggle('is-on');
  $('#stThread').classList.toggle('is-on', on);
  $('#stThreadTxt').textContent = on ? '收起细节' : '再多说一点';
  buzz(6);
});
['stIdea','stWant','stAvoid'].forEach(id=>{
  const el = $('#'+id);
  el.addEventListener('input', ()=>{
    state.form[{stIdea:'idea',stWant:'want',stAvoid:'avoid'}[id]] = el.value;
    saveForm();
  });
});

/* 骰子：随机一套设定 */
$('#stDice').addEventListener('click', ()=>{
  Object.keys(SF).forEach(k=>{
    const o = SF[k].opts;
    state.form[k] = o[Math.floor(Math.random()*o.length)];
  });
  saveForm(); renderStudio(); buzz(12);
  toast('换了一套设定，再点「落笔」');
});

/* ---------- 落笔：生成整本书的骨架 ---------- */
function lengthTotal(s){
  const m = String(s||'').match(/(\d+)/);
  return m ? clamp(parseInt(m[1]), 8, 400) : 60;
}
function wordsPerChap(s){
  const m = String(s||'').match(/(\d+)/);
  return m ? clamp(parseInt(m[1]), 600, 5000) : 2000;
}

async function generateBook(){
  if(!needAI()) return;
  const f = state.form;
  const total = lengthTotal(f.length);
  const wpc = wordsPerChap(f.words);

  genOpen('正在落笔');

  const sys = [
    '你是中文网络文学平台的资深主编，擅长起书名、写文案、搭大纲。',
    '你的文案能力体现在：书名要有画面和记忆点，简介要在三行内让人立刻想点进去。',
    '所有内容必须原创，不要使用任何现实中已存在作品的名字、人物或情节。'
  ].join('');

  const user = [
    '请按下面这套设定，造一本新书。',
    '',
    '【设定】',
    `题材：${f.genre}`,
    `背景：${f.era}`,
    `主角气质：${f.lead}`,
    `对手戏角色：${f.foil}`,
    `基调：${f.tone}`,
    `节奏：${f.pace}`,
    `叙事视角：${f.pov}`,
    `结局倾向：${f.ending}`,
    `总章节数：${total}`,
    `每章字数：${wpc}`,
    f.idea ? `读者脑子里的画面：${f.idea}` : '',
    f.want ? `希望出现：${f.want}` : '',
    f.avoid ? `请避开：${f.avoid}` : '',
    '',
    '【硬性要求】',
    `1. hook 必须是「A × B」这一种格式：用两个带反差、带钩子的人物标签，中间用 × 连接，例如「疯到骨子里的少帅 × 不肯低头的军医」。两侧标签各 5-12 字，要具体、有性格，不要泛泛的形容词。`,
    '2. desc 简介 140-220 字：第一段先抛出最有张力的一句场景或台词；中间交代人物关系与核心矛盾；最后一句必须留一个让人心痒的悬念。简介里不要出现「本书」「本文」这类词。',
    '3. title 书名 3-8 个汉字，有画面感，不要副标题。',
    '4. author 是一个像真人写手的中文笔名，2-4 个字。',
    '5. outline 分 4-6 卷，覆盖全部 ' + total + ' 章，每卷有 3-5 个关键情节点，情节点要写具体发生了什么，不要写「展开冲突」这类空话。',
    '6. palette 从这些里选一个最贴合气质的：iris(紫灰) / mist(雾蓝) / jade(青绿) / quartz(浅粉) / ink(墨灰) / dusk(暮紫) / frost(霜青) / lilac(丁香)。',
    '',
    '【输出 JSON 结构】',
    JSON.stringify({
      title:'', author:'', hook:'', desc:'',
      tags:['','','','','',''],
      total: total, wordsPerChapter: wpc, palette:'iris',
      world:'一句话世界观',
      protagonist:{name:'',identity:'',trait:'',want:'',wound:''},
      foil:{name:'',identity:'',trait:'',secret:''},
      themes:['',''],
      outline:[{volume:'第一卷 · 卷名', range:'1-15', summary:'', beats:['','','']}],
      openingScene:'第一章开场的画面，40 字以内'
    })
  ].filter(Boolean).join('\n');

  try{
    const j = await aiJSON(sys, user, {max_tokens:2800, temperature:1.0});
    const now = Date.now();
    const book = {
      id: uid('n'),
      source:'ai',
      shelf:false,
      title: String(j.title||'无题').slice(0,20),
      author: String(j.author||'佚名').slice(0,12),
      hook: String(j.hook||''),
      desc: String(j.desc||''),
      tags: Array.isArray(j.tags) ? j.tags.slice(0,6).map(t=>String(t).slice(0,8)) : [],
      total: clamp(parseInt(j.total)||total, 8, 400),
      wordsPerChapter: clamp(parseInt(j.wordsPerChapter)||wpc, 600, 5000),
      read: 0,
      cat: 'serial',
      fav: false, pinned:false,
      pal: PALETTES.some(p=>p.id===j.palette) ? j.palette : PALETTES[Math.floor(Math.random()*PALETTES.length)].id,
      world: String(j.world||''),
      protagonist: j.protagonist||{},
      foil: j.foil||{},
      themes: Array.isArray(j.themes)?j.themes:[],
      outline: Array.isArray(j.outline)?j.outline:[],
      openingScene: String(j.openingScene||''),
      form: Object.assign({}, f),
      addedAt: now, lastRead: 0,
      stats:null, comments:null, recos:null, toc:null,
      prefs: [], summaries: {}
    };
    state.books.unshift(book);
    await saveNow();
    genClose();
    buzz(16);
    renderDrafts();
    openDetail(book.id);
  }catch(e){ genFail(e); }
}
$('#stSeal').addEventListener('click', generateBook);

/* ---------- 最近创作 ---------- */
function renderDrafts(){
  const host = $('#stDrafts');
  if(!host) return;
  const list = state.books.filter(b=>b.source==='ai').sort((a,b)=>(b.addedAt||0)-(a.addedAt||0));
  $('#stDraftCount').textContent = list.length;
  if(!list.length){
    host.innerHTML = `<div class="st-none">还没有落笔。选好上面那句话里的词，按下「落笔」，第一本书就会出现在这里。</div>`;
    return;
  }
  host.innerHTML = list.map((b,i)=>{
    const p = pal(b.pal);
    return `
    <article class="draft" data-id="${b.id}" style="--d:${(i*0.05).toFixed(2)}s">
      <div class="dr-cover">${b.coverImg ? `<img class="cv-img" src="${b.coverImg}" alt=""/>` : `
        <div class="cv-bg" style="background:linear-gradient(155deg,${p.c1},${p.c2})"></div>
        <div class="cv-tex"></div>
        <div class="dr-cv-title" style="color:${p.ct}">${esc(b.title)}</div>
        <div class="cv-spine"></div>`}</div>
      <div class="dr-info">
        <div class="dr-title">${esc(b.title)}</div>
        <div class="dr-hook">${esc(b.hook||b.desc||'')}</div>
        <div class="dr-meta">
          <span>${esc(b.author)}</span><i></i>
          <span>${b.total} 章</span><i></i>
          <span>${b.shelf ? '已在书架' : '未入架'}</span>
        </div>
      </div>
      <span class="dr-go"><svg viewBox="0 0 24 24" fill="none"><path d="M9 5.5l6.5 6.5L9 18.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
    </article>`;
  }).join('');

  $$('#stDrafts .draft').forEach(el=>{
    let timer=null, longed=false;
    el.addEventListener('pointerdown', ()=>{
      longed=false;
      timer = setTimeout(()=>{
        longed = true; buzz(16);
        const b = state.books.find(x=>x.id===el.dataset.id);
        if(!b) return;
        askDialog('删掉这本草稿', `《${b.title}》以及它已经生成的正文都会被清空。`, '删掉', async ()=>{
          await removeBook(b.id); renderDrafts(); renderAll(); toast('已删除');
        });
      }, 520);
    });
    const clear = ()=>clearTimeout(timer);
    el.addEventListener('pointermove', clear);
    el.addEventListener('pointercancel', clear);
    el.addEventListener('pointerup', ()=>{ clear(); if(!longed) openDetail(el.dataset.id); });
  });
}

/* =========================================================
   十二、详情页
========================================================= */
function bookBrief(b){
  return [
    `书名《${b.title}》，作者 ${b.author}`,
    b.hook ? `一句话卖点：${b.hook}` : '',
    b.tags && b.tags.length ? `标签：${b.tags.join('、')}` : '',
    b.world ? `世界观：${b.world}` : '',
    b.desc ? `简介：${b.desc}` : '',
    `共 ${b.total} 章，当前状态：${CATS[b.cat]||'连载中'}`
  ].filter(Boolean).join('\n');
}

let _onlineTimer = null;
const _inflight = new Set();
function once(key, fn){
  if(_inflight.has(key)) return Promise.resolve();
  _inflight.add(key);
  return Promise.resolve(fn()).finally(()=>_inflight.delete(key));
}

async function openDetail(id){
  const b = state.books.find(x=>x.id===id);
  if(!b) return;
  state.detailId = id;

  const p = pal(b.pal);
  $('#pgDetail').style.setProperty('--dc1', p.c1);
  $('#pgDetail').style.setProperty('--dc2', p.c2);
  $('#pgDetail').style.setProperty('--dct', p.ct);

  $('#dtCover').innerHTML = bigCoverHTML(b);
  $('#dtTitle').textContent = b.title;
  $('#dtVpTitle').textContent = b.title;
  $('#dtAuthor').textContent = b.author;
  $('#dtCat').textContent = CATS[b.cat] || '连载中';
  $('#dtChaps').textContent = b.total + ' 章';
  $('#dtHook').textContent = b.hook || '';
  $('#dtHook').style.display = b.hook ? '' : 'none';
  $('#dtDesc').textContent = b.desc || '还没有简介。';
  $('#dtTags').innerHTML = (b.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('');
  $('#dtTocCount').textContent = b.toc ? `已列出 ${b.toc.length} 章` : `共 ${b.total} 章`;
  $('#dtRead').textContent = b.read > 0 ? `读到第 ${b.read} 章` : '还没开始读';
  $('#dtStartTxt').textContent = b.read > 0 ? '继续阅读' : '从第一章开始';
  $('#dtShelf').classList.toggle('is-on', b.shelf !== false);
  $('#dtShelfTxt').textContent = b.shelf !== false ? '已在书架' : '加入书架';

  /* 人物卡 + 大纲 */
  const pro = b.protagonist||{}, foe = b.foil||{};
  $('#dtRoles').innerHTML = [pro, foe].filter(r=>r && (r.name||r.identity)).map((r,i)=>`
    <div class="role">
      <div class="ro-side">${i===0?'主角':'对手戏'}</div>
      <div class="ro-name">${esc(r.name||'—')}</div>
      <div class="ro-id">${esc(r.identity||'')}</div>
      <div class="ro-tr">${esc(r.trait||'')}</div>
      ${r.wound||r.secret ? `<div class="ro-sec">${esc(r.wound||r.secret)}</div>` : ''}
    </div>`).join('');
  $('#dtRolesWrap').style.display = (pro.name||foe.name) ? '' : 'none';

  const ol = Array.isArray(b.outline) ? b.outline : [];
  $('#dtOutline').innerHTML = ol.map((v,i)=>`
    <div class="ov" style="--d:${(i*0.05).toFixed(2)}s">
      <div class="ov-head"><span class="ov-no">${String(i+1).padStart(2,'0')}</span><span class="ov-name">${esc(v.volume||('第'+(i+1)+'卷'))}</span><span class="ov-range">${esc(v.range||'')}</span></div>
      <div class="ov-sum">${esc(v.summary||'')}</div>
      ${(v.beats||[]).length ? `<div class="ov-beats">${v.beats.map(x=>`<div class="ov-beat">${esc(x)}</div>`).join('')}</div>` : ''}
    </div>`).join('');
  $('#dtOutlineWrap').style.display = ol.length ? '' : 'none';

  $('#dtLike').classList.toggle('is-on', !!b.liked);
  $('#dtSub').classList.toggle('is-on', !!b.subbed);
  $('#dtSubTxt').textContent = b.subbed ? '已订阅' : '订阅';
  $('#dtFav').classList.toggle('is-on', !!b.fav);
  $('#dtFavTxt').textContent = b.fav ? '已收藏' : '收藏';

  $('#detailScroll').scrollTop = 0;
  $('#pgDetail').classList.remove('solid');
  if(!state.views.includes('pgDetail')) pushView('pgDetail');

  /* 三块动态内容并行取，谁先回来谁先显示 */
  once('stats:'+b.id, ()=>loadStats(b));
  once('cmts:'+b.id,  ()=>loadComments(b));
  once('recos:'+b.id, ()=>loadRecos(b));
}

$('#dtBack').addEventListener('click', ()=>{ clearInterval(_onlineTimer); popView(); });
$('#detailScroll').addEventListener('scroll', e=>{
  $('#pgDetail').classList.toggle('solid', e.target.scrollTop > 180);
}, {passive:true});

/* ---------- 在线 / 热度 / 数据 ---------- */
function paintStats(b){
  const s = b.stats;
  if(!s) return;
  $('#dtLive').classList.add('ready');
  countTo($('#dtOnline'), s.online, 1200);
  $('#dtHeatTxt').textContent = s.heatLabel || '';
  $('#dtRank').textContent = s.rankLabel || '';
  $('#dtUpdate').textContent = s.updateNote || '';
  requestAnimationFrame(()=>{ $('#dtHeatFill').style.width = clamp(Number(s.heat)||0,4,100) + '%'; });

  countTo($('#numFav'), b.favs != null ? b.favs : s.favs, 1200);
  countTo($('#numLike'), b.likes != null ? b.likes : s.likes, 1300);
  countTo($('#numSub'), b.subs != null ? b.subs : s.subs, 1400);
  $('#numScore').textContent = (Number(s.score)||0).toFixed(1);
  $('#numScoreSub').textContent = fmtNum(s.scoreCount||0) + ' 人评';
  $('#dtWords').textContent = fmtNum(s.words||0) + ' 字';
  $('#dtToday').textContent = fmtNum(s.readersToday||0) + ' 人今天读过';
  $('#dtHotTags').innerHTML = (s.hotTags||[]).map(t=>`<span class="ht">${esc(t)}</span>`).join('');

  clearInterval(_onlineTimer);
  _onlineTimer = setInterval(()=>{
    if(!state.views.includes('pgDetail')) return clearInterval(_onlineTimer);
    const base = Number(s.online)||0;
    const drift = Math.round(base * (Math.random()*0.012 - 0.005));
    const el = $('#dtOnline');
    if(el) el.textContent = fmtNum(Math.max(1, base + drift));
  }, 4200);
}

async function loadStats(b){
  if(b.stats){ paintStats(b); return; }
  if(!aiReady()){ $('#dtLive').classList.add('noai'); return; }
  $('#dtLive').classList.add('loading');
  try{
    const j = await aiJSON(
      '你是一个中文小说阅读平台的数据接口。你根据一本书的题材、卖点和体量，给出这本书此刻在站内的真实感数据。数据要互相自洽：热度高则在线人数、收藏、订阅同步高；冷门题材数字要小。不要给出整数万这种一看就假的数字。',
      [
        bookBrief(b),
        '',
        '请给出这本书此刻的站内数据，JSON 结构如下（数字用阿拉伯数字，不要带单位）：',
        JSON.stringify({
          online: 0, heat: 0, heatLabel:'用两到四个字形容热度，例如「正在爆」「稳步上升」「小众宝藏」',
          rankLabel:'榜单位置，例如「言情月榜 第 12」', favs:0, likes:0, subs:0,
          score: 9.1, scoreCount: 0, words: 0, readersToday: 0,
          updateNote:'更新节奏，例如「每晚 21:00 更新两章」',
          hotTags:['读者自发打的 4 个标签']
        })
      ].join('\n'),
      {max_tokens:700, temperature:0.85}
    );
    if(!j || (!j.online && !j.heat)) throw new Error('模型没给出数据');
    b.stats = {
      online: clamp(parseInt(j.online)||0, 1, 9999999),
      heat: clamp(parseInt(j.heat)||60, 1, 100),
      heatLabel: String(j.heatLabel||''),
      rankLabel: String(j.rankLabel||''),
      favs: parseInt(j.favs)||0, likes: parseInt(j.likes)||0, subs: parseInt(j.subs)||0,
      score: clamp(Number(j.score)||8.8, 1, 10),
      scoreCount: parseInt(j.scoreCount)||0,
      words: parseInt(j.words)||0,
      readersToday: parseInt(j.readersToday)||0,
      updateNote: String(j.updateNote||''),
      hotTags: Array.isArray(j.hotTags)?j.hotTags.slice(0,4):[]
    };
    if(b.favs == null) b.favs = b.stats.favs;
    if(b.likes == null) b.likes = b.stats.likes;
    if(b.subs == null) b.subs = b.stats.subs;
    save();
    $('#dtLive').classList.remove('loading');
    if(state.detailId === b.id) paintStats(b);
  }catch(e){
    $('#dtLive').classList.remove('loading');
    $('#dtLive').classList.add('failed');
    $('#dtHeatTxt').textContent = '数据没取到，下拉可重试';
  }
}

/* ---------- 评论 ---------- */
function paintComments(b){
  const host = $('#dtComments');
  const list = b.comments || [];
  $('#dtCmtCount').textContent = list.length ? list.length + ' 条' : '';
  if(!list.length){ host.innerHTML = `<div class="dt-none">还没有人说话。</div>`; return; }
  host.innerHTML = list.map((c,i)=>`
    <div class="cmt" style="--d:${(i*0.06).toFixed(2)}s">
      <div class="cm-av" style="--h:${(i*67)%360}">${esc(String(c.user||'读').slice(0,1))}</div>
      <div class="cm-main">
        <div class="cm-top">
          <span class="cm-user">${esc(c.user||'读者')}</span>
          ${c.badge ? `<span class="cm-badge">${esc(c.badge)}</span>` : ''}
          <span class="cm-time">${esc(c.time||'')}</span>
        </div>
        <div class="cm-text">${esc(c.text||'')}</div>
        ${c.reply ? `<div class="cm-reply"><b>${esc(c.reply.user||'作者')}</b>${esc(c.reply.text||'')}</div>` : ''}
        <div class="cm-foot">
          <span class="cm-like" data-i="${i}">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 20s-6.6-4.2-8.6-8A4.7 4.7 0 0 1 12 7.4 4.7 4.7 0 0 1 20.6 12c-2 3.8-8.6 8-8.6 8z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
            <b>${fmtNum(c.likes||0)}</b>
          </span>
        </div>
      </div>
    </div>`).join('');

  $$('#dtComments .cm-like').forEach(el=>{
    el.addEventListener('click', ()=>{
      const i = +el.dataset.i;
      const c = b.comments[i];
      c.liked = !c.liked;
      c.likes = (c.likes||0) + (c.liked ? 1 : -1);
      el.classList.toggle('on', c.liked);
      el.querySelector('b').textContent = fmtNum(c.likes);
      save(); buzz(6);
    });
  });
}

async function loadComments(b, force){
  const host = $('#dtComments');
  if(b.comments && !force){ paintComments(b); return; }
  if(!aiReady()){ host.innerHTML = `<div class="dt-none">连接模型后，这里会长出真实的读者评论。</div>`; return; }
  host.innerHTML = skeleton(3,'sk-cmt');
  try{
    const j = await aiJSON(
      '你在模拟中文小说平台书评区的真实读者。读者的说话方式很口语：有人磕 CP，有人催更，有人吐槽，有人写长评分析文笔，有人只发一句短句。避免千篇一律的夸奖，允许出现温和的批评。昵称要像真人，不要用「读者A」这种。',
      [
        bookBrief(b),
        '',
        '写 8 条这本书的书评区评论，按热度从高到低。要求：',
        '1. 长短交错：至少 2 条长评（80-140 字，有具体观点），其余是 10-40 字的短评。',
        '2. 至少 1 条是温和的批评或建议，1 条是催更，1 条在磕人物关系。',
        '3. 其中 1-2 条带作者回复。',
        '4. 评论要提到这本书里具体的人物名或设定，不要写成万能模板。',
        '5. badge 是这个人的身份标记，例如「书粉 Lv.6」「今日第 3 条」「长评作者」，可以留空。',
        '',
        'JSON 结构：' + JSON.stringify([{user:'',badge:'',time:'例如 2 小时前',text:'',likes:0,reply:{user:'作者名',text:''}}])
      ].join('\n'),
      {max_tokens:2000, temperature:1.0}
    );
    const arr = Array.isArray(j) ? j : (j.comments||[]);
    if(!arr.length) throw new Error('模型没给出评论');
    b.comments = arr.slice(0,10).map(c=>({
      user:String(c.user||'读者'), badge:String(c.badge||''), time:String(c.time||''),
      text:String(c.text||''), likes:parseInt(c.likes)||0,
      reply: c.reply && c.reply.text ? {user:String(c.reply.user||b.author), text:String(c.reply.text)} : null
    }));
    save();
    if(state.detailId === b.id) paintComments(b);
  }catch(e){
    host.innerHTML = `<div class="dt-none">评论没加载出来。<span class="dt-retry" id="cmtRetry">重试</span></div>`;
    const r = $('#cmtRetry');
    r && r.addEventListener('click', ()=>loadComments(b, true));
  }
}

/* ---------- 推荐书籍 ---------- */
function paintRecos(b){
  const host = $('#dtRecos');
  const list = b.recos || [];
  if(!list.length){ host.innerHTML = `<div class="dt-none">暂时没有推荐。</div>`; return; }
  host.innerHTML = list.map((r,i)=>{
    const p = pal(PALETTES.some(x=>x.id===r.palette) ? r.palette : PALETTES[i%PALETTES.length].id);
    return `
    <article class="reco" data-i="${i}" style="--d:${(i*0.06).toFixed(2)}s">
      <div class="rc-cover">
        <div class="cv-bg" style="background:linear-gradient(155deg,${p.c1},${p.c2})"></div>
        <div class="cv-tex"></div>
        <div class="rc-cv-title" style="color:${p.ct}">${esc(r.title)}</div>
        <div class="cv-spine"></div>
      </div>
      <div class="rc-title">${esc(r.title)}</div>
      <div class="rc-hook">${esc(r.hook||'')}</div>
      <div class="rc-why">${esc(r.reason||'')}</div>
    </article>`;
  }).join('');

  $$('#dtRecos .reco').forEach(el=>{
    el.addEventListener('click', ()=>{
      const r = b.recos[+el.dataset.i];
      askDialog('把它也写出来', `《${r.title}》目前只有一个书名和卖点。要让模型现在把它写成一本完整的书吗？`, '写出来', ()=>generateFromReco(r, b));
    });
  });
}

async function loadRecos(b, force){
  const host = $('#dtRecos');
  if(b.recos && !force){ paintRecos(b); return; }
  if(!aiReady()){ host.innerHTML = `<div class="dt-none">连接模型后，这里会推荐相似的书。</div>`; return; }
  host.innerHTML = `<div class="rc-sk">${skeleton(3,'sk-rc')}</div>`;
  try{
    const j = await aiJSON(
      '你是中文小说平台的推荐引擎，负责「看过这本的人还在看」这一栏。推荐的必须是完全原创、不存在于现实中的书。',
      [
        bookBrief(b),
        '',
        '推荐 6 本气质相近但各有侧重的书。reason 要说清「和这本比，它多了什么」，20 字以内。',
        'hook 同样用「A × B」格式。palette 从 iris/mist/jade/quartz/ink/dusk/frost/lilac 里选。',
        'JSON：' + JSON.stringify([{title:'',author:'',hook:'',tags:['',''],reason:'',palette:'iris'}])
      ].join('\n'),
      {max_tokens:1400, temperature:1.0}
    );
    const arr = Array.isArray(j) ? j : (j.books||j.recos||[]);
    if(!arr.length) throw new Error('模型没给出推荐');
    b.recos = arr.slice(0,8).map(r=>({
      title:String(r.title||''), author:String(r.author||''), hook:String(r.hook||''),
      tags:Array.isArray(r.tags)?r.tags.slice(0,3):[], reason:String(r.reason||''), palette:String(r.palette||'iris')
    }));
    save();
    if(state.detailId === b.id) paintRecos(b);
  }catch(e){
    host.innerHTML = `<div class="dt-none">推荐没加载出来。<span class="dt-retry" id="recoRetry">重试</span></div>`;
    const r = $('#recoRetry');
    r && r.addEventListener('click', ()=>loadRecos(b, true));
  }
}

async function generateFromReco(r, from){
  if(!needAI()) return;
  genOpen('正在把它写出来', ['接住这个书名','补齐人物与世界','写一段能钩住人的简介','铺开全书大纲','落款']);
  const total = from.total || 60;
  try{
    const j = await aiJSON(
      '你是中文网络文学平台的资深主编。现在要把一个只有书名和卖点的推荐位，扩写成一本完整的书。所有内容原创。',
      [
        `书名：${r.title}`,
        `作者：${r.author||'（可自拟）'}`,
        `卖点：${r.hook}`,
        `它被推荐的理由：${r.reason}`,
        `气质参照：${from.tags?from.tags.join('、'):''}`,
        `总章节数：${total}`,
        '',
        'hook 保持「A × B」格式。desc 简介 140-220 字，最后一句留悬念。outline 分 4-6 卷覆盖全书。',
        'JSON：' + JSON.stringify({
          title:'', author:'', hook:'', desc:'', tags:['','','','','',''],
          total: total, wordsPerChapter: 2000, palette: r.palette||'iris', world:'',
          protagonist:{name:'',identity:'',trait:'',want:'',wound:''},
          foil:{name:'',identity:'',trait:'',secret:''},
          themes:['',''],
          outline:[{volume:'',range:'',summary:'',beats:['','','']}],
          openingScene:''
        })
      ].join('\n'),
      {max_tokens:2800, temperature:1.0}
    );
    const now = Date.now();
    const book = {
      id: uid('n'), source:'ai', shelf:false,
      title:String(j.title||r.title).slice(0,20),
      author:String(j.author||r.author||'佚名').slice(0,12),
      hook:String(j.hook||r.hook||''), desc:String(j.desc||''),
      tags:Array.isArray(j.tags)?j.tags.slice(0,6):[],
      total: clamp(parseInt(j.total)||total, 8, 400),
      wordsPerChapter: clamp(parseInt(j.wordsPerChapter)||2000, 600, 5000),
      read:0, cat:'serial', fav:false, pinned:false,
      pal: PALETTES.some(p=>p.id===j.palette) ? j.palette : 'iris',
      world:String(j.world||''), protagonist:j.protagonist||{}, foil:j.foil||{},
      themes:Array.isArray(j.themes)?j.themes:[],
      outline:Array.isArray(j.outline)?j.outline:[],
      openingScene:String(j.openingScene||''),
      form: Object.assign({}, from.form||state.form),
      addedAt:now, lastRead:0,
      stats:null, comments:null, recos:null, toc:null, prefs:[], summaries:{}
    };
    state.books.unshift(book);
    await saveNow();
    genClose(); renderDrafts();
    popAllViews();
    setTimeout(()=>openDetail(book.id), 260);
  }catch(e){ genFail(e); }
}

/* ---------- 收藏 / 点赞 / 订阅 / 入架 ---------- */
function bumpNum(key, el, delta){
  const b = state.books.find(x=>x.id===state.detailId);
  if(!b) return;
  b[key] = Math.max(0, (b[key]||0) + delta);
  el.textContent = fmtNum(b[key]);
  save();
}
$('#dtFav').addEventListener('click', ()=>{
  const b = state.books.find(x=>x.id===state.detailId); if(!b) return;
  b.fav = !b.fav;
  $('#dtFav').classList.toggle('is-on', b.fav);
  $('#dtFavTxt').textContent = b.fav ? '已收藏' : '收藏';
  bumpNum('favs', $('#numFav'), b.fav ? 1 : -1);
  buzz(10); renderAll();
  toast(b.fav ? '已加入收藏' : '已取消收藏');
});
$('#dtLike').addEventListener('click', ()=>{
  const b = state.books.find(x=>x.id===state.detailId); if(!b) return;
  b.liked = !b.liked;
  $('#dtLike').classList.toggle('is-on', b.liked);
  bumpNum('likes', $('#numLike'), b.liked ? 1 : -1);
  buzz(10);
});
$('#dtSub').addEventListener('click', ()=>{
  const b = state.books.find(x=>x.id===state.detailId); if(!b) return;
  b.subbed = !b.subbed;
  $('#dtSub').classList.toggle('is-on', b.subbed);
  $('#dtSubTxt').textContent = b.subbed ? '已订阅' : '订阅';
  bumpNum('subs', $('#numSub'), b.subbed ? 1 : -1);
  buzz(10);
  toast(b.subbed ? '更新时会先送到你这里' : '已取消订阅');
});
$('#dtShelf').addEventListener('click', ()=>{
  const b = state.books.find(x=>x.id===state.detailId); if(!b) return;
  b.shelf = !(b.shelf !== false);
  if(b.shelf) b.addedAt = Date.now();
  save();
  $('#dtShelf').classList.toggle('is-on', b.shelf);
  $('#dtShelfTxt').textContent = b.shelf ? '已在书架' : '加入书架';
  renderAll(); renderDrafts(); buzz(12);
  toast(b.shelf ? `《${b.title}》已放上书架` : '已从书架移出');
});
$('#dtStart').addEventListener('click', ()=>{
  const b = state.books.find(x=>x.id===state.detailId); if(!b) return;
  openReader(b.id, Math.min(b.total, (b.read||0)+1));
});
$('#dtTocEntry').addEventListener('click', ()=>openTOC(state.detailId));
$('#dtRefresh').addEventListener('click', ()=>{
  const b = state.books.find(x=>x.id===state.detailId); if(!b) return;
  b.stats = null; b.comments = null; b.recos = null;
  save();
  $('#dtLive').classList.remove('failed','ready');
  loadStats(b); loadComments(b, true); loadRecos(b, true);
  toast('正在重新取数据');
});

/* =========================================================
   十三、目录（章节按需解锁）
========================================================= */
function volumeFor(b, idx){
  const ol = Array.isArray(b.outline)?b.outline:[];
  for(const v of ol){
    const m = String(v.range||'').match(/(\d+)\s*[-~—]\s*(\d+)/);
    if(m && idx >= +m[1] && idx <= +m[2]) return v;
  }
  if(!ol.length) return null;
  const per = Math.ceil(b.total / ol.length);
  return ol[clamp(Math.floor((idx-1)/per), 0, ol.length-1)];
}

async function openTOC(id){
  const b = state.books.find(x=>x.id===id);
  if(!b) return;
  state.sheetId = id;
  $('#tocTitle').textContent = b.title;
  $('#tocSub').textContent = `共 ${b.total} 章 · 点开哪一章，哪一章才会被写出来`;
  scrim.classList.add('is-on');
  $('#tocSheet').classList.add('is-on');
  if(!b.toc || !b.toc.length) await genTOC(b, 1);
  else paintTOC(b);
}

function paintTOC(b){
  const host = $('#tocList');
  const list = b.toc || [];
  const made = b.made || {};
  host.innerHTML = list.map((c,i)=>{
    const idx = i+1;
    const unlocked = !!made[idx] || b.source === 'file';
    return `
    <div class="toc-i ${unlocked?'open':'lock'} ${b.read===idx?'here':''}" data-idx="${idx}" style="--d:${Math.min(i,14)*0.03}s">
      <span class="ti-no">${String(idx).padStart(3,'0')}</span>
      <div class="ti-main">
        <div class="ti-title">${esc(c.title||('第 '+idx+' 章'))}</div>
        ${c.teaser ? `<div class="ti-teaser">${esc(c.teaser)}</div>` : ''}
      </div>
      <span class="ti-state">${unlocked
        ? '<svg viewBox="0 0 24 24" fill="none"><path d="M9 5.5l6.5 6.5L9 18.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none"><rect x="5.6" y="10.4" width="12.8" height="9" rx="2.4" stroke="currentColor" stroke-width="1.5"/><path d="M8.6 10.4V8a3.4 3.4 0 0 1 6.8 0v2.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'}</span>
    </div>`;
  }).join('');

  const more = list.length < b.total;
  $('#tocMore').style.display = more ? '' : 'none';
  $('#tocMoreTxt').textContent = `继续列出后面 ${Math.min(30, b.total - list.length)} 章`;
  $('#tocFoot').textContent = more ? `已列出 ${list.length} / ${b.total} 章` : `全书 ${b.total} 章已全部列出`;

  $$('#tocList .toc-i').forEach(el=>{
    el.addEventListener('click', ()=>{
      closeAll();
      setTimeout(()=>openReader(b.id, +el.dataset.idx), 220);
    });
  });
}

async function genTOC(b, from){
  if(!needAI()) return;
  const host = $('#tocList');
  const count = Math.min(30, b.total - (from-1));
  if(count <= 0) return;
  if(from === 1) host.innerHTML = skeleton(8,'sk-toc');
  else $('#tocMore').classList.add('loading');

  const vols = (b.outline||[]).map(v=>`${v.volume||''}（${v.range||''}）：${v.summary||''}${(v.beats||[]).length?' 关键情节：'+v.beats.join('；'):''}`).join('\n');
  try{
    const j = await aiJSON(
      '你是中文网络文学的责任编辑，负责拟章节标题。章节名要像真正的网文：短、有信息量、能勾人，避免「第一章 开始」这种废话，也不要剧透结局。',
      [
        bookBrief(b),
        vols ? '【全书大纲】\n' + vols : '',
        '',
        `请列出第 ${from} 章到第 ${from+count-1} 章的目录，共 ${count} 条，顺序不能乱。`,
        'title 只写标题本身，不要带「第 N 章」前缀，6-14 个字。',
        'teaser 是这一章的悬念钩子，14-24 个字，写具体的画面或冲突，不要写概述。',
        'JSON：' + JSON.stringify([{title:'',teaser:''}])
      ].filter(Boolean).join('\n'),
      {max_tokens: 2400, temperature:0.95}
    );
    const arr = (Array.isArray(j) ? j : (j.chapters||j.toc||[])).slice(0, count);
    if(!arr.length) throw new Error('模型没给出目录');
    b.toc = (b.toc||[]).slice(0, from-1).concat(arr.map((c,i)=>({
      title: `第 ${from+i} 章 · ${String(c.title||'').replace(/^第?\s*[\d零一二三四五六七八九十百]+\s*章\s*[·:：]?\s*/,'')}`,
      teaser: String(c.teaser||'')
    })));
    save();
    $('#tocMore').classList.remove('loading');
    paintTOC(b);
    if(state.detailId === b.id) $('#dtTocCount').textContent = `已列出 ${b.toc.length} 章`;
  }catch(e){
    $('#tocMore').classList.remove('loading');
    host.innerHTML = `<div class="dt-none">目录没生成出来。<span class="dt-retry" id="tocRetry">重试</span></div>`;
    const r = $('#tocRetry');
    r && r.addEventListener('click', ()=>genTOC(b, from));
  }
}
$('#tocMore').addEventListener('click', ()=>{
  const b = state.books.find(x=>x.id===state.sheetId);
  if(b) genTOC(b, (b.toc||[]).length + 1);
});
$('#tocClose').addEventListener('click', closeAll);

/* =========================================================
   十四、阅读器
========================================================= */
function applyRd(){
  const r = $('#pgReader');
  r.dataset.theme = state.rd.theme;
  r.dataset.font = state.rd.font;
  r.style.setProperty('--rs', state.rd.size + 'px');
  r.style.setProperty('--rl', state.rd.lead);
  $('#rdSizeVal').textContent = state.rd.size;
  $('#rdLeadVal').textContent = state.rd.lead.toFixed(2);
  $$('#rdThemes .rd-th').forEach(t=>t.classList.toggle('is-on', t.dataset.theme===state.rd.theme));
  $$('#rdFonts .rd-fo').forEach(t=>t.classList.toggle('is-on', t.dataset.font===state.rd.font));
  saveReaderPrefs();
}

async function openReader(bookId, idx){
  const b = state.books.find(x=>x.id===bookId);
  if(!b) return;
  idx = clamp(idx||1, 1, b.total);
  state.reader.bookId = bookId;
  state.reader.idx = idx;

  applyRd();
  $('#rdBookName').textContent = b.title;
  $('#rdNo').textContent = `第 ${idx} 章 / 共 ${b.total} 章`;
  $('#rdTitle').textContent = (b.toc && b.toc[idx-1] && b.toc[idx-1].title) || `第 ${idx} 章`;
  $('#rdBody').innerHTML = '';
  $('#rdEnd').classList.remove('is-on');
  $('#rdEnd').innerHTML = '';
  $('#rdScroll').scrollTop = 0;
  $('#rdProgFill').style.width = '0%';
  showRdBars(true);

  if(!state.views.includes('pgReader')) pushView('pgReader');

  const cached = await getChapter(bookId, idx);
  if(cached && cached.content){
    paintChapter(b, idx, cached);
    return;
  }
  if(b.source === 'file'){
    $('#rdBody').innerHTML = `<p class="rd-p">这一章没有内容。</p>`;
    return;
  }
  streamChapter(b, idx);
}

function paraHTML(text){
  return String(text||'').split(/\n+/).map(s=>s.trim()).filter(Boolean)
    .map(s=>`<p class="rd-p">${esc(s)}</p>`).join('');
}

function paintChapter(b, idx, data){
  $('#rdTitle').textContent = data.title || (b.toc && b.toc[idx-1] && b.toc[idx-1].title) || `第 ${idx} 章`;
  $('#rdBody').innerHTML = paraHTML(data.content);
  markRead(b, idx);
  renderChapterEnd(b, idx, data);
}

async function markRead(b, idx){
  b.made = b.made || {};
  b.made[idx] = true;
  if(idx > (b.read||0)) b.read = idx;
  if(b.read >= b.total) b.cat = 'end';
  else if(b.cat === 'plan') b.cat = 'serial';
  b.lastRead = Date.now();
  save(); renderAll();
}

/* ---------- 正文流式生成 ---------- */
async function streamChapter(b, idx){
  if(!needAI()) return;
  const body = $('#rdBody');
  body.innerHTML = `<div class="rd-writing"><span class="rw-nib"></span><span class="rw-txt">正在写第 ${idx} 章…</span></div>`;
  state.reader.streaming = true;

  const vol = volumeFor(b, idx);
  const tocItem = (b.toc && b.toc[idx-1]) || null;
  const prevSum = b.summaries ? (b.summaries[idx-1] || '') : '';
  const prefs = (b.prefs||[]).slice(-6);
  const wpc = b.wordsPerChapter || 2000;

  const sys = [
    '你是一位中文小说作者，正在连载这本书。你写的是正文，不是梗概。',
    '写作要求：多用具体的动作、对话、感官细节推进，少用总结性的叙述；对话要像人真的会说的话；每一章都要有一个小高潮和一个让人想看下一章的收尾。',
    '严禁出现任何解释性文字、章节标题、markdown 符号、括号里的说明。直接开始正文。'
  ].join('\n');

  const user = [
    bookBrief(b),
    b.protagonist && b.protagonist.name ? `主角：${b.protagonist.name}，${b.protagonist.identity||''}，${b.protagonist.trait||''}${b.protagonist.want?'，想要：'+b.protagonist.want:''}${b.protagonist.wound?'，心结：'+b.protagonist.wound:''}` : '',
    b.foil && b.foil.name ? `对手戏：${b.foil.name}，${b.foil.identity||''}，${b.foil.trait||''}${b.foil.secret?'，秘密：'+b.foil.secret:''}` : '',
    b.form ? `叙事视角：${b.form.pov}；基调：${b.form.tone}；节奏：${b.form.pace}` : '',
    vol ? `【本卷】${vol.volume||''}：${vol.summary||''}${(vol.beats||[]).length?'\n本卷关键情节：'+vol.beats.join('；'):''}` : '',
    tocItem ? `【本章标题】${tocItem.title}\n【本章要写到的钩子】${tocItem.teaser||''}` : '',
    idx === 1 && b.openingScene ? `【开场画面】${b.openingScene}` : '',
    prevSum ? `【上一章发生了什么】${prevSum}` : (idx>1 ? '【上一章】读者刚读完上一章，请自然衔接。' : ''),
    prefs.length ? '【这位读者提过的意见，必须照做】\n' + prefs.map((p,i)=>`${i+1}. ${p.text}${p.rating?`（他给上一章打了 ${p.rating} 分）`:''}`).join('\n') : '',
    '',
    `请写第 ${idx} 章的正文，约 ${wpc} 字。分段，段落之间空一行。只输出正文。`
  ].filter(Boolean).join('\n');

  let acc = '', painted = 0;
  const flush = ()=>{
    const paras = acc.split(/\n+/);
    let html = '';
    paras.forEach((s,i)=>{
      s = s.trim(); if(!s) return;
      html += `<p class="rd-p ${i>=painted?'fresh':''}">${esc(s)}</p>`;
    });
    body.innerHTML = html + '<span class="rd-caret"></span>';
    painted = paras.length - 1;
  };

  try{
    let tick = 0;
    const text = await aiStream([{role:'system',content:sys},{role:'user',content:user}], (d, full)=>{
      acc = full;
      if(++tick % 3 === 0) flush();
    }, {max_tokens: Math.min(8000, Math.round(wpc*2.2)), host: state.reader, temperature:0.98});

    acc = text || acc;
    state.reader.streaming = false;
    if(!acc.trim()){ body.innerHTML = `<div class="rd-fail">这一章没写出来。<span class="dt-retry" id="rdRetry">重试</span></div>`; bindRdRetry(b, idx); return; }

    const clean = acc.replace(/^```[\s\S]*?\n/,'').replace(/```$/,'').trim();
    body.innerHTML = paraHTML(clean);
    const data = {title: tocItem ? tocItem.title : `第 ${idx} 章`, content: clean, at: Date.now()};
    await putChapter(b.id, idx, data);
    markRead(b, idx);
    renderChapterEnd(b, idx, data);
  }catch(e){
    state.reader.streaming = false;
    if(String(e.message).includes('NO_API')){ needAI(); return; }
    body.innerHTML = `<div class="rd-fail">这一章没写出来：${esc(String(e.message).slice(0,50))} <span class="dt-retry" id="rdRetry">重试</span></div>`;
    bindRdRetry(b, idx);
  }
}
function bindRdRetry(b, idx){
  const r = $('#rdRetry');
  r && r.addEventListener('click', ()=>streamChapter(b, idx));
}

/* ---------- 章末：作者的话 · 本章评价 · 你的意见 ---------- */
function renderChapterEnd(b, idx, data){
  const end = $('#rdEnd');
  const last = idx >= b.total;
  end.innerHTML = `
    <div class="re-rule"><i></i></div>

    <div class="re-block" id="reNote">
      <div class="re-k">作者的话</div>
      <div class="re-note-body">${data.authorNote ? esc(data.authorNote) : skeleton(2,'sk-line')}</div>
    </div>

    <div class="re-block">
      <div class="re-k">这一章好看吗</div>
      <div class="re-stars" id="reStars">${[1,2,3,4,5].map(n=>`<span class="re-star" data-n="${n}"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.6l2.4 4.9 5.4.8-3.9 3.8.9 5.3-4.8-2.5-4.8 2.5.9-5.3-3.9-3.8 5.4-.8L12 4.6z"/></svg></span>`).join('')}<span class="re-star-txt" id="reStarTxt">点星星打分</span></div>
    </div>

    <div class="re-block">
      <div class="re-k">告诉作者，下一章想看什么</div>
      <div class="re-fb">
        <textarea id="reFb" rows="3" placeholder="哪里不satisfying、想多看谁、节奏太快还是太慢…写下来，下一章会照着改。"></textarea>
        <div class="re-fb-send" id="reFbSend"><span>交给作者</span><svg viewBox="0 0 24 24" fill="none"><path d="M5 12h13M13 6.5l5.5 5.5L13 17.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      </div>
      <div class="re-fb-list" id="reFbList"></div>
    </div>

    <div class="re-block">
      <div class="re-k">本章评价 <span class="re-k-sub" id="reCmtSub"></span></div>
      <div class="re-cmts" id="reCmts">${skeleton(3,'sk-cmt')}</div>
    </div>

    <div class="re-nav">
      <div class="re-prev ${idx<=1?'off':''}" id="rePrev">上一章</div>
      <div class="re-next ${last?'off':''}" id="reNext">
        <span class="rn-k">${last?'全书完':'下一章'}</span>
        <span class="rn-t" id="reNextTitle">${last ? '你读完了整本书' : esc((b.toc&&b.toc[idx]&&b.toc[idx].title)||'点开才会被写出来')}</span>
      </div>
    </div>
    <div class="re-foot">— 第 ${idx} 章 · ${esc(b.title)} —</div>`;

  end.classList.add('is-on');
  paintFbList(b, idx);

  /* 打分 */
  const setStars = n=>{
    $$('#reStars .re-star').forEach(s=>s.classList.toggle('on', +s.dataset.n <= n));
    $('#reStarTxt').textContent = ['','有点难看','差点意思','还行','挺好看','太好看了'][n] || '';
  };
  const saved = (b.ratings||{})[idx];
  if(saved) setStars(saved);
  $$('#reStars .re-star').forEach(s=>{
    s.addEventListener('click', ()=>{
      const n = +s.dataset.n;
      b.ratings = b.ratings || {}; b.ratings[idx] = n;
      setStars(n); save(); buzz(8);
      if(n <= 3) toast('记下了，下一章会调整');
    });
  });

  /* 意见 */
  $('#reFbSend').addEventListener('click', ()=>{
    const t = $('#reFb').value.trim();
    if(!t){ toast('写点什么再交给作者'); $('#reFb').focus(); return; }
    b.prefs = b.prefs || [];
    b.prefs.push({chapter: idx, text: t, rating:(b.ratings||{})[idx]||0, at: Date.now()});
    $('#reFb').value = '';
    save(); buzz(12);
    paintFbList(b, idx);
    toast('作者收到了，下一章会照着写');
  });

  /* 翻章 */
  $('#rePrev').addEventListener('click', ()=>{ if(idx>1) openReader(b.id, idx-1); });
  $('#reNext').addEventListener('click', ()=>{ if(!last) openReader(b.id, idx+1); });

  if(!data.authorNote || !data.comments) once('extras:'+b.id+':'+idx, ()=>loadChapterExtras(b, idx, data));
  else paintChapterExtras(b, idx, data);
}

function paintFbList(b, idx){
  const host = $('#reFbList');
  if(!host) return;
  const mine = (b.prefs||[]).filter(p=>p.chapter === idx);
  host.innerHTML = mine.map(p=>`<div class="re-fb-i"><span class="rf-k">已提交</span>${esc(p.text)}</div>`).join('');
}

function paintChapterExtras(b, idx, data){
  const note = $('#reNote .re-note-body');
  if(note) note.innerHTML = esc(data.authorNote||'');
  const host = $('#reCmts');
  if(!host) return;
  const list = data.comments || [];
  const sub = $('#reCmtSub');
  if(sub) sub.textContent = list.length ? list.length + ' 条' : '';
  if(!list.length){ host.innerHTML = `<div class="dt-none">这一章还没有人留言。</div>`; return; }
  host.innerHTML = list.map((c,i)=>`
    <div class="cmt" style="--d:${(i*0.06).toFixed(2)}s">
      <div class="cm-av" style="--h:${(i*83)%360}">${esc(String(c.user||'读').slice(0,1))}</div>
      <div class="cm-main">
        <div class="cm-top"><span class="cm-user">${esc(c.user||'读者')}</span>${c.badge?`<span class="cm-badge">${esc(c.badge)}</span>`:''}<span class="cm-time">${esc(c.time||'')}</span></div>
        <div class="cm-text">${esc(c.text||'')}</div>
        <div class="cm-foot"><span class="cm-like" data-i="${i}"><svg viewBox="0 0 24 24" fill="none"><path d="M12 20s-6.6-4.2-8.6-8A4.7 4.7 0 0 1 12 7.4 4.7 4.7 0 0 1 20.6 12c-2 3.8-8.6 8-8.6 8z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg><b>${fmtNum(c.likes||0)}</b></span></div>
      </div>
    </div>`).join('');
  $$('#reCmts .cm-like').forEach(el=>{
    el.addEventListener('click', ()=>{
      const c = list[+el.dataset.i];
      c.liked = !c.liked; c.likes = (c.likes||0) + (c.liked?1:-1);
      el.classList.toggle('on', c.liked);
      el.querySelector('b').textContent = fmtNum(c.likes);
      putChapter(b.id, idx, data); buzz(6);
    });
  });
}

async function loadChapterExtras(b, idx, data){
  if(!aiReady()){
    const note = $('#reNote .re-note-body');
    if(note) note.textContent = '连接模型后，作者会在这里说两句。';
    const host = $('#reCmts');
    if(host) host.innerHTML = `<div class="dt-none">连接模型后，这一章的读者评价会出现在这里。</div>`;
    return;
  }
  try{
    const j = await aiJSON(
      '你要做两件事：以作者身份写一段章末留言；再模拟这一章章评区的读者留言。章评区的人只讨论刚读完的这一章，会提到具体情节、具体台词，会磕，会急，会吐槽。昵称像真人。',
      [
        `书名《${b.title}》，作者 ${b.author}`,
        `这是第 ${idx} 章。正文如下：`,
        '"""',
        String(data.content||'').slice(0, 4000),
        '"""',
        '',
        '请输出 JSON：',
        JSON.stringify({
          authorNote:'作者的话，40-70 字，像真的写手在章末唠嗑，可以求票、预告、自嘲，不要写成宣传语',
          summary:'这一章的剧情梗概，60-90 字，给下一章的作者看，要点明人物关系变化和留下的悬念',
          comments:[{user:'',badge:'',time:'例如 12 分钟前',text:'针对本章具体情节的留言，10-60 字',likes:0}]
        }),
        '',
        'comments 给 6 条，长短不一，至少 1 条在追问下一章、1 条在心疼或调侃某个角色。'
      ].join('\n'),
      {max_tokens:1400, temperature:1.0}
    );
    data.authorNote = String(j.authorNote||'');
    data.comments = (Array.isArray(j.comments)?j.comments:[]).slice(0,8).map(c=>({
      user:String(c.user||'读者'), badge:String(c.badge||''), time:String(c.time||''),
      text:String(c.text||''), likes:parseInt(c.likes)||0
    }));
    b.summaries = b.summaries || {};
    b.summaries[idx] = String(j.summary||'');
    save();
    await putChapter(b.id, idx, data);
    if(state.reader.bookId === b.id && state.reader.idx === idx) paintChapterExtras(b, idx, data);
  }catch(e){
    const note = $('#reNote .re-note-body');
    if(note) note.textContent = '';
    const host = $('#reCmts');
    if(host) host.innerHTML = `<div class="dt-none">章评没加载出来。<span class="dt-retry" id="ceRetry">重试</span></div>`;
    const r = $('#ceRetry');
    r && r.addEventListener('click', ()=>{ $('#reCmts').innerHTML = skeleton(3,'sk-cmt'); loadChapterExtras(b, idx, data); });
  }
}

/* ---------- 阅读器控制 ---------- */
let barsOn = true;
function showRdBars(on){
  barsOn = on;
  $('#pgReader').classList.toggle('bars', on);
  if(!on) $('#rdPanel').classList.remove('is-on');
}
/* 点正文空白处收起／唤出工具条，拖动和点交互元素都不算 */
(function(){
  let dx=0, dy=0, sx=0, sy=0;
  const sc = $('#rdScroll');
  sc.addEventListener('pointerdown', e=>{ sx=e.clientX; sy=e.clientY; dx=dy=0; });
  sc.addEventListener('pointermove', e=>{ dx=Math.abs(e.clientX-sx); dy=Math.abs(e.clientY-sy); });
  sc.addEventListener('click', e=>{
    if(dx>8 || dy>8) return;
    if(e.target.closest('.re-star, .re-fb, .re-fb-send, .re-prev, .re-next, .cm-like, .dt-retry, textarea, input, a')) return;
    if($('#rdPanel').classList.contains('is-on')){ $('#rdPanel').classList.remove('is-on'); return; }
    showRdBars(!barsOn);
  });
})();
$('#rdBack').addEventListener('click', ()=>{ state.reader.abort && state.reader.abort(); popView(); });
$('#rdToc').addEventListener('click', ()=>openTOC(state.reader.bookId));
$('#rdGear').addEventListener('click', e=>{ e.stopPropagation(); $('#rdPanel').classList.toggle('is-on'); });
$('#rdScroll').addEventListener('scroll', e=>{
  const el = e.target;
  const max = el.scrollHeight - el.clientHeight;
  $('#rdProgFill').style.width = clamp(max>0 ? el.scrollTop/max*100 : 0, 0, 100) + '%';
}, {passive:true});

$('#rdSizeMinus').addEventListener('click', ()=>{ state.rd.size = clamp(state.rd.size-1, 13, 26); applyRd(); });
$('#rdSizePlus').addEventListener('click', ()=>{ state.rd.size = clamp(state.rd.size+1, 13, 26); applyRd(); });
$('#rdLeadMinus').addEventListener('click', ()=>{ state.rd.lead = clamp(+(state.rd.lead-0.1).toFixed(2), 1.5, 2.8); applyRd(); });
$('#rdLeadPlus').addEventListener('click', ()=>{ state.rd.lead = clamp(+(state.rd.lead+0.1).toFixed(2), 1.5, 2.8); applyRd(); });
$$('#rdThemes .rd-th').forEach(t=>t.addEventListener('click', ()=>{ state.rd.theme = t.dataset.theme; applyRd(); buzz(6); }));
$$('#rdFonts .rd-fo').forEach(t=>t.addEventListener('click', ()=>{ state.rd.font = t.dataset.font; applyRd(); buzz(6); }));
$('#rdRegen').addEventListener('click', ()=>{
  const b = state.books.find(x=>x.id===state.reader.bookId);
  if(!b) return;
  const idx = state.reader.idx;
  askDialog('重写这一章', '当前这一章会被覆盖。如果你刚提交过意见，重写会把意见一起算进去。', '重写', async ()=>{
    await dbDel(S_CHAP, chapKey(b.id, idx));
    $('#rdEnd').classList.remove('is-on');
    $('#rdEnd').innerHTML = '';
    $('#rdPanel').classList.remove('is-on');
    streamChapter(b, idx);
  });
});

/* =========================================================
   十五、添加书籍：手动录入 / 导入本地文件
========================================================= */
function buildSwatches(){
  $('#fPalette').innerHTML = PALETTES.map(p=>
    `<button class="sw ${p.id===state.editPal?'is-on':''}" data-pal="${p.id}" style="background:linear-gradient(155deg,${p.c1},${p.c2})"></button>`
  ).join('');
  $$('#fPalette .sw').forEach(s=>{
    s.addEventListener('click', ()=>{
      state.editPal = s.dataset.pal;
      state.editCover = null;
      $('#coverPrev').classList.remove('has');
      $('#coverPrev').innerHTML = '';
      $$('#fPalette .sw').forEach(x=>x.classList.remove('is-on'));
      s.classList.add('is-on'); buzz(6);
    });
  });
}
function moveSegUl(){
  const on = $('#fCat .seg-i.is-on'), ul = $('#segUl');
  if(!on) return;
  ul.style.width = on.offsetWidth+'px';
  ul.style.transform = `translateX(${on.offsetLeft}px)`;
}
$$('#fCat .seg-i').forEach(s=>{
  s.addEventListener('click', ()=>{
    $$('#fCat .seg-i').forEach(x=>x.classList.remove('is-on'));
    s.classList.add('is-on');
    state.editCat = s.dataset.cat;
    moveSegUl();
  });
});
function moveModeUl(){
  const on = $('#edMode .seg-i.is-on'), ul = $('#modeUl');
  if(!on) return;
  ul.style.width = on.offsetWidth+'px';
  ul.style.transform = `translateX(${on.offsetLeft}px)`;
}
$$('#edMode .seg-i').forEach(s=>{
  s.addEventListener('click', ()=>{
    $$('#edMode .seg-i').forEach(x=>x.classList.remove('is-on'));
    s.classList.add('is-on');
    state.editMode = s.dataset.mode;
    $('#editor').dataset.mode = state.editMode;
    moveModeUl();
    buzz(6);
  });
});

function openEditor(id){
  state.editId = id || null;
  const b = id ? state.books.find(x=>x.id===id) : null;

  state.editMode = 'manual';
  state.imported = null;
  $('#edMode').style.display = b ? 'none' : '';
  $('#editor').dataset.mode = 'manual';
  $$('#edMode .seg-i').forEach(x=>x.classList.toggle('is-on', x.dataset.mode==='manual'));
  $('#impState').className = 'imp-state';
  $('#impState').innerHTML = '';
  $('#impFile').value = '';

  $('#edTitleTxt').textContent = b ? '编辑资料' : '添加书籍';
  $('.ed-kicker').textContent = b ? 'EDIT VOLUME' : 'ADD TO SHELF';
  $('#fTitle').value  = b ? b.title : '';
  $('#fAuthor').value = b ? b.author : '';
  $('#fDesc').value   = b ? (b.desc||'') : '';
  $('#fTotal').value  = b ? b.total : 100;
  $('#fRead').value   = b ? b.read : 0;
  $('#fTags').value   = b ? (b.tags||[]).join(' ') : '';
  state.editPal = b ? b.pal : PALETTES[Math.floor(Math.random()*PALETTES.length)].id;
  state.editCat = b ? b.cat : 'serial';
  state.editCover = b ? (b.coverImg||null) : null;

  const prev = $('#coverPrev');
  prev.classList.toggle('has', !!state.editCover);
  prev.innerHTML = state.editCover ? `<img src="${state.editCover}" alt=""/>` : '';

  $$('#fCat .seg-i').forEach(x=>x.classList.toggle('is-on', x.dataset.cat===state.editCat));
  buildSwatches();

  ['.ed-head','.ed-body','.ed-foot'].forEach((s,i)=>{
    const el = editor.querySelector(s);
    el.classList.add('stagger');
    el.style.setProperty('--sd', (0.08 + i*0.07)+'s');
  });

  scrim.classList.add('is-on');
  editor.classList.add('is-on');
  setTimeout(()=>{ moveSegUl(); moveModeUl(); }, 60);
}

$('#btnAdd').addEventListener('click', ()=>openEditor(null));
$('#emAdd').addEventListener('click', ()=>openEditor(null));
$('#edClose').addEventListener('click', closeAll);
$('#edCancel').addEventListener('click', closeAll);

/* ---------- 封面图片 ---------- */
$('#coverPick').addEventListener('click', ()=>$('#coverFile').click());
$('#coverFile').addEventListener('change', async e=>{
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  try{
    const url = await shrinkImage(f, 520);
    state.editCover = url;
    const prev = $('#coverPrev');
    prev.classList.add('has');
    prev.innerHTML = `<img src="${url}" alt=""/>`;
    buzz(8);
  }catch(err){ toast('这张图读不了，换一张试试'); }
  e.target.value = '';
});
function shrinkImage(file, maxW){
  return new Promise((res,rej)=>{
    const fr = new FileReader();
    fr.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        const k = Math.min(1, maxW/img.width);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width*k); c.height = Math.round(img.height*k);
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);
        res(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = rej;
      img.src = fr.result;
    };
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

/* ---------- 文件导入 ---------- */
const IMP_EXT = ['txt','md','markdown','html','htm','xhtml','epub','docx','json'];
$('#impDrop').addEventListener('click', ()=>$('#impFile').click());
$('#impFile').addEventListener('change', e=>{
  const f = e.target.files && e.target.files[0];
  if(f) handleImport(f);
});
['dragover','dragenter'].forEach(k=>$('#impDrop').addEventListener(k, e=>{ e.preventDefault(); $('#impDrop').classList.add('over'); }));
['dragleave','drop'].forEach(k=>$('#impDrop').addEventListener(k, e=>{ e.preventDefault(); $('#impDrop').classList.remove('over'); }));
$('#impDrop').addEventListener('drop', e=>{
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if(f) handleImport(f);
});

async function handleImport(file){
  const ext = (file.name.split('.').pop()||'').toLowerCase();
  const st = $('#impState');
  if(IMP_EXT.indexOf(ext) < 0){
    st.className = 'imp-state bad';
    st.innerHTML = `读不了 .${esc(ext)}。可以导入 txt / md / html / epub / docx / json。`;
    return;
  }
  st.className = 'imp-state busy';
  st.innerHTML = `<span class="imp-sp"></span>正在拆《${esc(file.name)}》…`;
  try{
    const r = await parseBookFile(file, ext);
    if(!r.chapters.length) throw new Error('没读到正文');
    state.imported = r;
    if(!$('#fTitle').value) $('#fTitle').value = r.title || file.name.replace(/\.[^.]+$/,'');
    if(!$('#fAuthor').value && r.author) $('#fAuthor').value = r.author;
    $('#fTotal').value = r.chapters.length;
    st.className = 'imp-state good';
    st.innerHTML = `
      <div class="imp-ok">已拆出 <b>${r.chapters.length}</b> 章 · 约 <b>${fmtNum(r.words)}</b> 字</div>
      <div class="imp-list">${r.chapters.slice(0,5).map(c=>`<span>${esc(c.title)}</span>`).join('')}${r.chapters.length>5?`<span class="imp-etc">…还有 ${r.chapters.length-5} 章</span>`:''}</div>
      <div class="imp-tip">书名、作者、封面可以在下面改。</div>`;
    buzz(12);
  }catch(e){
    st.className = 'imp-state bad';
    st.innerHTML = `没拆开：${esc(String(e.message||e).slice(0,60))}`;
  }
}

/* 编码嗅探：先 UTF-8，乱码就退回 GBK */
async function readText(blobOrBuf){
  const buf = blobOrBuf instanceof ArrayBuffer ? blobOrBuf : await blobOrBuf.arrayBuffer();
  let t = new TextDecoder('utf-8').decode(buf);
  const bad = (t.match(/\uFFFD/g)||[]).length;
  if(bad > 6 && bad / Math.max(1,t.length) > 0.002){
    try{ t = new TextDecoder('gbk').decode(buf); }catch(e){}
  }
  return t.replace(/\r\n?/g,'\n');
}

function stripHTML(html){
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,nav,header,footer').forEach(n=>n.remove());
  doc.querySelectorAll('p,div,br,h1,h2,h3,h4,li').forEach(n=>n.insertAdjacentText('afterend','\n'));
  return (doc.body ? doc.body.textContent : '').replace(/\n{3,}/g,'\n\n').trim();
}

const CH_RE = /^[\s　]*((?:第\s*[0-9零一二三四五六七八九十百千两]{1,8}\s*[章回节卷篇折][^\n]{0,40})|(?:Chapter\s*\d+[^\n]{0,40})|(?:[0-9]{1,4}[、.．]\s?[^\n]{1,30})|(?:序章|楔子|引子|尾声|后记|番外[^\n]{0,20}))[\s　]*$/;

function splitChapters(text){
  const lines = text.split('\n');
  const marks = [];
  lines.forEach((ln,i)=>{
    const s = ln.trim();
    if(!s || s.length > 46) return;
    if(CH_RE.test(s)) marks.push({i, title:s});
  });
  const out = [];
  if(marks.length >= 3){
    if(marks[0].i > 0){
      const pre = lines.slice(0, marks[0].i).join('\n').trim();
      if(pre.length > 120) out.push({title:'卷首', content:pre});
    }
    marks.forEach((m,k)=>{
      const end = k+1 < marks.length ? marks[k+1].i : lines.length;
      const body = lines.slice(m.i+1, end).join('\n').trim();
      if(body) out.push({title:m.title, content:body});
    });
    return out;
  }
  /* 没有章节标记：按长度切成均匀的段 */
  const clean = text.trim();
  const size = 3200;
  const parts = Math.max(1, Math.ceil(clean.length / size));
  const per = Math.ceil(clean.length / parts);
  for(let i=0;i<parts;i++){
    let s = i*per, e = Math.min(clean.length, s+per);
    if(e < clean.length){
      const nl = clean.indexOf('\n', e);
      if(nl > 0 && nl - e < 400) e = nl;
    }
    out.push({title:`第 ${i+1} 节`, content: clean.slice(s,e).trim()});
  }
  return out;
}

/* 最小 ZIP 解包（epub / docx 都是 zip） */
async function inflateRaw(data){
  if(typeof DecompressionStream === 'undefined') throw new Error('这个浏览器不支持解压');
  const s = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function unzip(file){
  const buf = await file.arrayBuffer();
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  let eocd = -1;
  for(let i=u8.length-22; i>=Math.max(0,u8.length-66000); i--){
    if(dv.getUint32(i,true) === 0x06054b50){ eocd = i; break; }
  }
  if(eocd < 0) throw new Error('压缩包结构不对');
  const cnt = dv.getUint16(eocd+10,true);
  let p = dv.getUint32(eocd+16,true);
  const entries = [];
  for(let i=0;i<cnt;i++){
    if(dv.getUint32(p,true) !== 0x02014b50) break;
    const method = dv.getUint16(p+10,true);
    const csize = dv.getUint32(p+20,true);
    const nlen = dv.getUint16(p+28,true), elen = dv.getUint16(p+30,true), clen = dv.getUint16(p+32,true);
    const lho = dv.getUint32(p+42,true);
    const name = new TextDecoder().decode(u8.subarray(p+46, p+46+nlen));
    entries.push({name, method, csize, lho});
    p += 46 + nlen + elen + clen;
  }
  const out = {};
  for(const e of entries){
    if(e.name.endsWith('/')) continue;
    const ln = dv.getUint16(e.lho+26,true), le = dv.getUint16(e.lho+28,true);
    const start = e.lho + 30 + ln + le;
    const raw = u8.subarray(start, start + e.csize);
    try{ out[e.name] = e.method === 0 ? raw : await inflateRaw(raw); }catch(err){}
  }
  return out;
}
const dec = u8 => new TextDecoder('utf-8').decode(u8);

async function parseEPUB(file){
  const z = await unzip(file);
  const container = z['META-INF/container.xml'];
  if(!container) throw new Error('不是标准 epub');
  const cx = new DOMParser().parseFromString(dec(container), 'application/xml');
  const opfPath = cx.querySelector('rootfile')?.getAttribute('full-path');
  if(!opfPath || !z[opfPath]) throw new Error('找不到 epub 目录文件');
  const baseDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')+1) : '';
  const opf = new DOMParser().parseFromString(dec(z[opfPath]), 'application/xml');

  const title = opf.querySelector('metadata title')?.textContent
    || opf.getElementsByTagName('dc:title')[0]?.textContent || '';
  const author = opf.getElementsByTagName('dc:creator')[0]?.textContent || '';

  const idMap = {};
  Array.from(opf.querySelectorAll('manifest item')).forEach(it=>{
    idMap[it.getAttribute('id')] = it.getAttribute('href');
  });
  const spine = Array.from(opf.querySelectorAll('spine itemref'))
    .map(r=>idMap[r.getAttribute('idref')]).filter(Boolean);

  const norm = href=>{
    let h = decodeURIComponent(String(href).split('#')[0]);
    let full = baseDir + h;
    const parts = [];
    full.split('/').forEach(s=>{ if(s === '..') parts.pop(); else if(s !== '.' && s) parts.push(s); });
    return parts.join('/');
  };

  /* 目录标题：优先 nav / ncx */
  const titles = {};
  const navHref = Object.keys(z).find(k=>/nav\.x?html$/i.test(k));
  if(navHref){
    const nd = new DOMParser().parseFromString(dec(z[navHref]), 'text/html');
    nd.querySelectorAll('nav a, a').forEach(a=>{
      const h = a.getAttribute('href'); if(!h) return;
      const base = navHref.includes('/') ? navHref.slice(0, navHref.lastIndexOf('/')+1) : '';
      let full = base + decodeURIComponent(h.split('#')[0]);
      const parts = []; full.split('/').forEach(s=>{ if(s==='..') parts.pop(); else if(s!=='.'&&s) parts.push(s); });
      titles[parts.join('/')] = a.textContent.trim();
    });
  }
  const ncxKey = Object.keys(z).find(k=>/\.ncx$/i.test(k));
  if(ncxKey){
    const nx = new DOMParser().parseFromString(dec(z[ncxKey]), 'application/xml');
    const base = ncxKey.includes('/') ? ncxKey.slice(0, ncxKey.lastIndexOf('/')+1) : '';
    Array.from(nx.querySelectorAll('navPoint')).forEach(np=>{
      const src = np.querySelector('content')?.getAttribute('src');
      const lbl = np.querySelector('navLabel text')?.textContent?.trim();
      if(!src || !lbl) return;
      let full = base + decodeURIComponent(src.split('#')[0]);
      const parts = []; full.split('/').forEach(s=>{ if(s==='..') parts.pop(); else if(s!=='.'&&s) parts.push(s); });
      if(!titles[parts.join('/')]) titles[parts.join('/')] = lbl;
    });
  }

  const chapters = [];
  spine.forEach((href,i)=>{
    const key = norm(href);
    const f = z[key];
    if(!f) return;
    const text = stripHTML(dec(f));
    if(text.replace(/\s/g,'').length < 60) return;
    chapters.push({title: titles[key] || `第 ${chapters.length+1} 章`, content: text});
  });
  if(!chapters.length) throw new Error('epub 里没读到正文');
  return {title, author, chapters};
}

async function parseDOCX(file){
  const z = await unzip(file);
  const doc = z['word/document.xml'];
  if(!doc) throw new Error('不是标准 docx');
  const xml = new DOMParser().parseFromString(dec(doc), 'application/xml');
  const paras = Array.from(xml.getElementsByTagName('w:p')).map(p=>{
    return Array.from(p.getElementsByTagName('w:t')).map(t=>t.textContent).join('');
  });
  return {title:'', author:'', text: paras.join('\n').replace(/\n{3,}/g,'\n\n')};
}

async function parseBookFile(file, ext){
  let title = file.name.replace(/\.[^.]+$/,'').trim();
  let author = '', chapters = null, text = '';

  const nameMatch = title.match(/^《?(.+?)》?\s*[-—_ ]\s*(?:作者[:：]?)?\s*(.+)$/);
  if(nameMatch){ title = nameMatch[1].trim(); author = nameMatch[2].trim(); }

  if(ext === 'epub'){
    const r = await parseEPUB(file);
    if(r.title) title = r.title;
    if(r.author) author = r.author;
    chapters = r.chapters;
  }else if(ext === 'docx'){
    const r = await parseDOCX(file);
    text = r.text;
  }else if(ext === 'html' || ext === 'htm' || ext === 'xhtml'){
    const raw = await readText(file);
    const t = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if(t && t[1].trim()) title = t[1].trim();
    text = stripHTML(raw);
  }else if(ext === 'json'){
    const raw = await readText(file);
    const j = JSON.parse(raw);
    title = j.title || title; author = j.author || author;
    if(Array.isArray(j.chapters)){
      chapters = j.chapters.map((c,i)=>typeof c === 'string'
        ? {title:`第 ${i+1} 章`, content:c}
        : {title:String(c.title||`第 ${i+1} 章`), content:String(c.content||c.text||'')});
    }else text = String(j.content||j.text||'');
  }else{
    text = await readText(file);
    const head = text.slice(0, 400);
    const am = head.match(/作\s*者[:：]\s*([^\n]{1,20})/);
    if(am && !author) author = am[1].trim();
    const tm = head.match(/书\s*名[:：]\s*([^\n]{1,30})/);
    if(tm) title = tm[1].trim();
  }

  if(!chapters) chapters = splitChapters(text);
  chapters = chapters.filter(c=>c.content && c.content.replace(/\s/g,'').length > 20);
  const words = chapters.reduce((s,c)=>s + c.content.replace(/\s/g,'').length, 0);
  return {title, author, chapters, words};
}

/* ---------- 保存 ---------- */
$('#edSave').addEventListener('click', async ()=>{
  const isImport = state.editMode === 'import' && !state.editId;
  if(isImport && !state.imported){ toast('先选一个文件'); return; }

  const title = $('#fTitle').value.trim() || (state.imported ? state.imported.title : '');
  if(!title){ toast('先给这本书起个名字'); $('#fTitle').focus(); return; }

  const total = isImport ? state.imported.chapters.length : Math.max(1, parseInt($('#fTotal').value)||1);
  let read = Math.max(0, parseInt($('#fRead').value)||0);
  if(read > total) read = total;

  const data = {
    title,
    author: $('#fAuthor').value.trim() || '佚名',
    desc: $('#fDesc').value.trim(),
    total, read,
    cat: read>=total ? 'end' : state.editCat,
    pal: state.editPal,
    coverImg: state.editCover || null,
    tags: $('#fTags').value.trim() ? $('#fTags').value.trim().split(/\s+/).slice(0,5) : []
  };

  if(state.editId){
    const b = state.books.find(x=>x.id===state.editId);
    Object.assign(b, data);
    toast('资料已更新');
  }else{
    const id = uid('u');
    const book = Object.assign({
      id, source: isImport ? 'file' : 'manual', shelf:true,
      fav:false, pinned:false, made:{},
      addedAt:Date.now(), lastRead: read>0 ? Date.now() : 0
    }, data);
    if(isImport){
      book.toc = state.imported.chapters.map((c,i)=>({
        title: /^第|^序|^楔|^引|^尾|^后记|^番外|^Chapter/i.test(c.title) ? c.title : `第 ${i+1} 章 · ${c.title}`,
        teaser: c.content.replace(/\s/g,'').slice(0,24)
      }));
      const made = {};
      for(let i=0;i<state.imported.chapters.length;i++){
        made[i+1] = true;
        await putChapter(id, i+1, {title: book.toc[i].title, content: state.imported.chapters[i].content, at:Date.now()});
      }
      book.made = made;
      book.words = state.imported.words;
    }
    state.books.unshift(book);
    toast(`《${title}》已放上书架`);
  }
  await saveNow(); renderAll(); renderDrafts(); closeAll(); buzz(12);
});

/* =========================================================
   十六、确认弹窗 / 面板拖拽
========================================================= */
let dialogOK = null;
function askDialog(title, desc, okText, cb){
  $('#dgTitle').textContent = title;
  $('#dgDesc').textContent = desc;
  $('#dgYes').innerHTML = `<span class="sha-sweep"></span>${esc(okText)}`;
  dialogOK = cb;
  scrim.classList.add('is-on');
  dialog.classList.add('is-on');
}
$('#dgNo').addEventListener('click', ()=>{
  dialog.classList.remove('is-on');
  if(!sheet.classList.contains('is-on') && !editor.classList.contains('is-on') && !$('#tocSheet').classList.contains('is-on')) scrim.classList.remove('is-on');
});
$('#dgYes').addEventListener('click', ()=>{
  dialog.classList.remove('is-on');
  const cb = dialogOK; dialogOK = null;
  setTimeout(()=>{ if(cb) cb(); }, 120);
});

function makeDraggable(el){
  const grip = el.querySelector('.sh-grip');
  if(!grip) return;
  let sy=0, dy=0, drag=false;
  grip.addEventListener('pointerdown', e=>{
    drag=true; sy=e.clientY; dy=0;
    el.style.transition='none';
    grip.setPointerCapture && grip.setPointerCapture(e.pointerId);
  });
  grip.addEventListener('pointermove', e=>{
    if(!drag) return;
    dy = Math.max(0, e.clientY - sy);
    el.style.transform = `translateY(${dy}px)`;
  });
  const end = ()=>{
    if(!drag) return;
    drag=false;
    el.style.transition=''; el.style.transform='';
    if(dy > 110) closeAll();
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
}

/* 系统返回键：先收面板，再退视图 */
window.addEventListener('popstate', ()=>{
  const panelOpen = dialog.classList.contains('is-on') || sheet.classList.contains('is-on')
    || editor.classList.contains('is-on') || $('#tocSheet').classList.contains('is-on')
    || ($('#charPick') && $('#charPick').classList.contains('is-on'))
    || ($('#fxTocSheet') && $('#fxTocSheet').classList.contains('is-on'));
  if(panelOpen){ closeAll(); }
  else if(state.views.length){ popView(); }
  else{ window.location.href = 'index.html'; return; }
  history.pushState(null,'',location.href);
});

/* =========================================================
   十七、启动
========================================================= */
async function boot(){
  await load();
  renderAll();
  renderStudio();
  observeReveals();
  moveBeam(ORDER.indexOf(state.page));
  $('#tbName').textContent = PAGE_INFO[state.page].name;
  $('#tbKicker').textContent = 'LUNA READER · ' + PAGE_INFO[state.page].kicker;

  updateTime(); setInterval(updateTime, 1000);
  updateBattery();
  applyIsland();
  applyGlobalFont();
  applyRd();

  makeDraggable(sheet); makeDraggable(editor); makeDraggable($('#tocSheet'));
  await fanBoot();
  window.addEventListener('resize', ()=>{ moveFtabUl(); moveSegUl(); moveModeUl(); });
  document.fonts && document.fonts.ready.then(()=>{ moveFtabUl(); });
  history.pushState(null,'',location.href);
}
document.addEventListener('DOMContentLoaded', boot);

/* 返回时不使用快照，保证状态栏与设置同步 */
window.addEventListener('pageshow', e=>{
  if(e.persisted) window.location.reload();
  applyIsland(); applyGlobalFont(); updateTime();
});

/* =========================================================
   ▓▓ 十八、同人 · FAN WORKS ▓▓
   1) 从 LunaCharDB 读角色档案，精准还原人设
   2) 用户提供成套设定 → AI 现写同人文
   3) 可选开圈 → 同人广场（CP 专属地）
   4) 作品详情 / 目录 / 流式阅读器 / 续写
========================================================= */

/* ---------------- 配色（与角色档案的 COLOR_MAP 对齐） ---------------- */
const FAN_AVCOL = {
  ink:    {bg:'#101012', col:'#C9C9CD'},
  slate:  {bg:'#141416', col:'#B8BAC0'},
  silver: {bg:'#1A1A1C', col:'#D4D4D8'},
  frost:  {bg:'#111316', col:'#C8CCD0'},
  smoke:  {bg:'#0E0E10', col:'#BDBDC2'},
  pearl:  {bg:'#1C1C1E', col:'#E0E0E3'}
};
const FAN_THEMES = [
  {id:'iris',   c1:'#F0EEFA', c2:'#CFCAEB', ct:'#3D3868'},
  {id:'mist',   c1:'#ECF2F8', c2:'#C7DAEC', ct:'#25405C'},
  {id:'quartz', c1:'#F9EFF3', c2:'#E6CEDA', ct:'#563345'},
  {id:'jade',   c1:'#EDF4F1', c2:'#C8DCD4', ct:'#26463C'},
  {id:'dusk',   c1:'#F1ECF5', c2:'#CDC3DF', ct:'#3B3055'},
  {id:'frost',  c1:'#EDF3F7', c2:'#C5DBE4', ct:'#20424B'},
  {id:'lilac',  c1:'#F5EEF8', c2:'#DCC8E7', ct:'#4A3259'},
  {id:'ink',    c1:'#EEEFF4', c2:'#BEC1D0', ct:'#212339'}
];
function fanTheme(i){ return FAN_THEMES[(i|0) % FAN_THEMES.length] || FAN_THEMES[0]; }

/* ---------------- 可选设定项 ---------------- */
const FAN_OPT = {
  dyn:   ['双向奔赴','一方主动一方回避','势均力敌','强势 × 韧性','温柔 × 别扭','依赖 × 纵容','互相拉扯','日久生情','一见钟情','死对头变恋人','青梅竹马','先婚后爱','救赎与被救赎','互为软肋'],
  stage: ['素不相识','刚认识','朋友','死对头','暧昧期','在一起了','分手后','久别重逢','上下级','同门师兄妹','邻居','只在网上说过话','曾经很熟现在很远'],
  au:    ['沿用原设定','现代都市','校园','娱乐圈','民国旧影','古代王朝','仙侠修真','西方奇幻','近未来赛博','咖啡店','医院','乐队巡演','无限流','末世废土','灵异怪谈','悬疑刑侦','花店与纹身店','便利店夜班'],
  genre: ['日常糖','暗恋','双向暗恋','追妻火葬场','破镜重圆','相爱相杀','久别重逢','治愈','群像','悬疑','时间循环','世界末日前的最后一天','一个漫长的告别','假戏真做'],
  tone:  ['细腻克制','热烈浓稠','清冷疏淡','轻快明亮','阴郁压抑','诗意散文','电影感','温柔治愈','荒诞幽默'],
  pov:   ['第三人称 · A 视角','第三人称 · B 视角','双视角交替','第一人称 · A','第一人称 · B','第三人称 · 全知'],
  form:  ['正文体','日记体','书信体','聊天记录体','剧本体','意识流','采访实录','多年后的回忆'],
  end:   ['圆满收束 HE','意难平 BE','开放式','先苦后甜','未完待续'],
  rate:  ['全年龄','有点心动','情感浓度高（克制不露骨）'],
  vis:   ['只有我自己看','放进广场'],
  tags:  ['双向奔赴','破镜重圆','年下','年上','强强','治愈','暗恋','独占欲','细水长流','命中注定','救赎','群像','校园','婚后','HE','BE','甜','虐','慢热','高岭之花','傲娇','忠犬']
};
const FAN_BRIEF_DEFAULT = {
  dyn:'双向奔赴', stage:'暧昧期', au:'沿用原设定', genre:'日常糖',
  tone:'细腻克制', pov:'双视角交替', form:'正文体', end:'先苦后甜',
  rate:'全年龄', sweet:60, len:2200,
  tags:['双向奔赴','细水长流'], tagIn:'',
  scene:'', must:'', never:'', free:''
};

/* =========================================================
   同人库（独立 IndexedDB，不动原有书架库）
========================================================= */
const FDB_NAME = 'LunaFanDB', FDB_VER = 1;
const F_WORK = 'works', F_CIRCLE = 'circles';
let _fdb = null;

function openFanDB(){
  return new Promise((res, rej)=>{
    if(_fdb) return res(_fdb);
    const r = indexedDB.open(FDB_NAME, FDB_VER);
    r.onupgradeneeded = e=>{
      const db = e.target.result;
      if(!db.objectStoreNames.contains(F_WORK))   db.createObjectStore(F_WORK,   {keyPath:'id'});
      if(!db.objectStoreNames.contains(F_CIRCLE)) db.createObjectStore(F_CIRCLE, {keyPath:'id'});
    };
    r.onsuccess = e=>{ _fdb = e.target.result; res(_fdb); };
    r.onerror   = ()=>rej(r.error);
  });
}
function fdbAll(store){
  return openFanDB().then(db=>new Promise(res=>{
    const r = db.transaction(store,'readonly').objectStore(store).getAll();
    r.onsuccess = ()=>res(r.result||[]); r.onerror = ()=>res([]);
  })).catch(()=>[]);
}
function fdbPut(store, val){
  return openFanDB().then(db=>new Promise(res=>{
    const tx = db.transaction(store,'readwrite');
    tx.objectStore(store).put(val);
    tx.oncomplete = ()=>res(true); tx.onerror = ()=>res(false);
  })).catch(()=>false);
}
function fdbDel(store, key){
  return openFanDB().then(db=>new Promise(res=>{
    const tx = db.transaction(store,'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = ()=>res(true); tx.onerror = ()=>res(false);
  })).catch(()=>false);
}

/* =========================================================
   角色档案（只读 LunaCharDB / chars，与 characters.js 同库）
========================================================= */
let _charDb = null;
function openCharDBRO(){
  if(_charDb) return Promise.resolve(_charDb);
  return new Promise((res, rej)=>{
    const probe = indexedDB.open('LunaCharDB');
    probe.onupgradeneeded = e=>{
      const db0 = e.target.result;
      if(!db0.objectStoreNames.contains('chars'))
        db0.createObjectStore('chars', {keyPath:'id', autoIncrement:true});
    };
    probe.onsuccess = e=>{
      const cur = e.target.result;
      const ver = cur.version;
      const has = cur.objectStoreNames.contains('chars');
      cur.close();
      if(has){
        const r2 = indexedDB.open('LunaCharDB', ver);
        r2.onsuccess = e2=>{ _charDb = e2.target.result; res(_charDb); };
        r2.onerror   = ()=>rej(r2.error);
        r2.onupgradeneeded = ()=>{};
      }else{
        const r3 = indexedDB.open('LunaCharDB', ver + 1);
        r3.onupgradeneeded = e3=>{
          const db3 = e3.target.result;
          if(!db3.objectStoreNames.contains('chars'))
            db3.createObjectStore('chars', {keyPath:'id', autoIncrement:true});
        };
        r3.onsuccess = e3=>{ _charDb = e3.target.result; res(_charDb); };
        r3.onerror   = ()=>rej(r3.error);
      }
    };
    probe.onerror = ()=>rej(probe.error);
  });
}
async function loadArchiveChars(){
  try{
    const db = await openCharDBRO();
    return await new Promise(res=>{
      const r = db.transaction('chars','readonly').objectStore('chars').getAll();
      r.onsuccess = ()=>res(r.result||[]); r.onerror = ()=>res([]);
    });
  }catch(e){ return []; }
}

/* =========================================================
   同人状态
========================================================= */
const FAN = {
  works:[], circles:[], chars:[],
  sel:{a:null, b:null, cast:[]},
  brief: JSON.parse(JSON.stringify(FAN_BRIEF_DEFAULT)),
  circleOn:false, circleTheme:0, circleName:'', circleMani:'', vis:'只有我自己看',
  pickSlot:'a', pickQuery:'',
  curWorkId:null, curCircleId:null,
  sqFilter:'all',
  fx:{workId:null, idx:1, streaming:false, abort:null, bars:true}
};

/* ---------------- 小工具 ---------------- */
function fanInitial(name){
  const s = String(name||'?').trim();
  if(!s) return '?';
  const ch = s[0];
  return /[a-zA-Z]/.test(ch) ? ch.toUpperCase() : ch;
}
function fanAv(c){
  const m = FAN_AVCOL[c && c.color] || FAN_AVCOL.ink;
  return m;
}
function fanWords(s){ return String(s||'').replace(/\s/g,'').length; }
function fanCpKey(cast){
  return (cast||[]).map(c=>String(c.name||'').trim()).filter(Boolean).sort().join('×') || '未命名';
}
function fanCpLabel(cast){
  return (cast||[]).map(c=>c.name).filter(Boolean).join(' × ') || '未命名';
}
function fanRand(a){ return a[Math.floor(Math.random()*a.length)]; }

/* 把档案里的角色压成 AI 能吃的「人设卡」 —— 这是同人写得像不像的关键 */
function fanCastItem(c, side){
  if(!c) return null;
  if(c.__custom){
    return {key:'x'+(c.name||''), name:c.name||'', role:c.role||'', gender:'', avatar:'',
            color:'ink', from:'custom', side, raw:null};
  }
  const av = fanAv(c);
  return {
    key:'db'+c.id, id:c.id, name:c.name||'', role:c.role||'', gender:c.gender||'',
    avatar:c.avatar||'', color:c.color||'ink', avBg:av.bg, avCol:av.col,
    from:'db', side,
    raw:{
      name:c.name||'', role:c.role||'', gender:c.gender||'', age:c.age||'', birthday:c.birthday||'',
      species:c.species||'', appearance:c.appearance||'', outfit:c.outfit||'',
      desc:c.desc||'', traits:c.traits||[],
      likes:c.likes||[], dislikes:c.dislikes||[], fears:c.fears||'',
      speechStyle:c.speechStyle||'', catchphrases:c.catchphrases||[], lang:c.lang||'',
      backstory:c.backstory||'', scenario:c.scenario||'',
      relation:c.relation||'', callUser:c.callUser||'', relationDetail:c.relationDetail||'',
      firstMes:c.firstMes||'', dialogExamples:c.dialogExamples||[],
      neverList:c.neverList||[], boundaries:c.boundaries||'',
      prompt:c.prompt||''
    }
  };
}
function fanDossier(item){
  if(!item) return '';
  if(item.from === 'custom'){
    return `【${item.name}】（临时角色，档案里没有）\n身份／人设：${item.role || '未填，请合理补全并保持全篇一致'}`;
  }
  const r = item.raw || {};
  const L = [];
  L.push(`【${r.name}】`);
  const basic = [r.role && '身份：'+r.role, r.gender && '性别：'+r.gender, r.age && '年龄：'+r.age,
                 r.species && '种族：'+r.species].filter(Boolean).join(' ｜ ');
  if(basic) L.push(basic);
  if(r.appearance) L.push('外貌：'+r.appearance);
  if(r.outfit)     L.push('常穿：'+r.outfit);
  if(r.desc)       L.push('简述：'+r.desc);
  if((r.traits||[]).length)  L.push('性格关键词：'+r.traits.join('、'));
  if((r.likes||[]).length)   L.push('喜欢：'+r.likes.join('、'));
  if((r.dislikes||[]).length)L.push('讨厌：'+r.dislikes.join('、'));
  if(r.fears)      L.push('害怕／软肋：'+r.fears);
  if(r.speechStyle)L.push('说话方式（必须照着写对白）：'+r.speechStyle);
  if((r.catchphrases||[]).length) L.push('口头禅（可自然穿插）：'+r.catchphrases.join('、'));
  if(r.lang)       L.push('语言习惯：'+r.lang);
  if(r.backstory)  L.push('过去：'+r.backstory);
  if(r.scenario)   L.push('所处情境：'+r.scenario);
  if(r.relationDetail) L.push('已有关系细节：'+r.relationDetail);
  if(r.callUser)   L.push('习惯的称呼：'+r.callUser);
  if((r.dialogExamples||[]).length){
    const ex = r.dialogExamples.slice(0,4).map(d=>{
      if(typeof d === 'string') return d;
      return [d.user && '（对方）'+d.user, d.char && '（本人）'+d.char].filter(Boolean).join(' / ');
    }).filter(Boolean);
    if(ex.length) L.push('对白范例（语气要贴着这个来）：\n' + ex.map(s=>'  · '+s).join('\n'));
  }
  if((r.neverList||[]).length) L.push('这个角色绝对不会做的事：'+r.neverList.join('；'));
  if(r.boundaries) L.push('底线：'+r.boundaries);
  return L.join('\n');
}

/* =========================================================
   载入 & 汇总
========================================================= */
async function fanLoad(){
  FAN.works   = await fdbAll(F_WORK);
  FAN.circles = await fdbAll(F_CIRCLE);
  FAN.works.sort((a,b)=>(b.updatedAt||b.createdAt||0)-(a.updatedAt||a.createdAt||0));
  FAN.circles.sort((a,b)=>((b.pinned?1:0)-(a.pinned?1:0)) || ((b.createdAt||0)-(a.createdAt||0)));
  try{
    const saved = JSON.parse(localStorage.getItem('luna_fan_brief')||'null');
    if(saved) Object.assign(FAN.brief, saved);
  }catch(e){}
}
function fanSaveBrief(){
  try{ localStorage.setItem('luna_fan_brief', JSON.stringify(FAN.brief)); }catch(e){}
}
function fanCircleWorks(cid){ return FAN.works.filter(w=>w.circleId === cid); }
function fanChapN(w){ return (w.chapters||[]).length; }
function fanWordN(w){ return (w.chapters||[]).reduce((s,c)=>s+(c.words||fanWords(c.body)),0); }
function fanWork(id){ return FAN.works.find(w=>w.id===id) || null; }
function fanCircle(id){ return FAN.circles.find(c=>c.id===id) || null; }

/* =========================================================
   十九、同人页渲染
========================================================= */
function fanChipHTML(list, cur, soft){
  return list.map(o=>`<span class="chip ${cur===o?'on':''} ${soft?'soft':''}" data-v="${esc(o)}">${esc(o)}</span>`).join('');
}
function fanMultiChipHTML(list, curArr, soft){
  const set = new Set(curArr||[]);
  return list.map(o=>`<span class="chip ${set.has(o)?'on':''} ${soft?'soft':''}" data-v="${esc(o)}">${esc(o)}</span>`).join('');
}

function renderFanChips(){
  const b = FAN.brief;
  const map = [
    ['#chDyn',   FAN_OPT.dyn,   'dyn'],
    ['#chStage', FAN_OPT.stage, 'stage'],
    ['#chAu',    FAN_OPT.au,    'au'],
    ['#chGenre', FAN_OPT.genre, 'genre'],
    ['#chTone',  FAN_OPT.tone,  'tone'],
    ['#chPov',   FAN_OPT.pov,   'pov'],
    ['#chForm',  FAN_OPT.form,  'form'],
    ['#chEnd',   FAN_OPT.end,   'end'],
    ['#chRate',  FAN_OPT.rate,  'rate']
  ];
  map.forEach(([sel, list, key])=>{
    const host = $(sel);
    if(!host) return;
    host.innerHTML = fanChipHTML(list, b[key]);
    host.dataset.key = key;
  });
  const t = $('#chTags');
  if(t) t.innerHTML = fanMultiChipHTML(FAN_OPT.tags, b.tags, true);

  const v = $('#chVis');
  if(v) v.innerHTML = fanChipHTML(FAN_OPT.vis, FAN.vis, true);

  const th = $('#circTheme');
  if(th) th.innerHTML = FAN_THEMES.map((p,i)=>
    `<span class="theme-i ${i===FAN.circleTheme?'on':''}" data-i="${i}" style="background:linear-gradient(150deg,${p.c1},${p.c2})"></span>`).join('');
}

function renderSlot(which){
  const host = $('#pslot' + which.toUpperCase());
  if(!host) return;
  const item = FAN.sel[which];
  if(!item){
    host.classList.remove('filled');
    host.removeAttribute('style');
    host.innerHTML = `
      <span class="pslot-plus"><svg viewBox="0 0 24 24" fill="none"><path d="M12 5.6v12.8M5.6 12h12.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span>
      <span class="pslot-hint">选${which==='a'?'第一':'第二'}个人</span>
      <span class="pslot-role">SIDE ${which.toUpperCase()}</span>`;
    return;
  }
  const th = fanTheme(which==='a' ? 0 : 6);
  host.classList.add('filled');
  host.style.setProperty('--s1', th.c1);
  host.style.setProperty('--s2', th.c2);
  host.style.setProperty('--st', th.ct);
  host.style.setProperty('--sa', item.avBg || '#26243A');
  host.style.setProperty('--sc', item.avCol || '#D6D3EC');
  const avInner = item.avatar
    ? `<img src="${item.avatar}" alt="" />`
    : `<span>${esc(fanInitial(item.name))}</span>`;
  host.innerHTML = `
    <span class="ps-tag">SIDE ${which.toUpperCase()}</span>
    <span class="ps-x" data-x="${which}"><svg viewBox="0 0 24 24" fill="none"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>
    <span class="ps-av">${avInner}</span>
    <span class="ps-name">${esc(item.name)}</span>
    <span class="ps-sub">${esc(item.role || (item.from==='custom' ? '临时角色' : '未填身份'))}</span>`;
}

function renderCastRow(){
  const host = $('#castRow');
  if(!host) return;
  const add = `<span class="cast-add" id="castAdd"><svg viewBox="0 0 24 24" fill="none"><path d="M12 5.6v12.8M5.6 12h12.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>加一个</span>`;
  host.innerHTML = FAN.sel.cast.map((c,i)=>{
    const inner = c.avatar ? `<img src="${c.avatar}" alt="" />` : `<span>${esc(fanInitial(c.name))}</span>`;
    return `<span class="cast-i" style="--ca:${c.avBg||'#26243A'};--cc:${c.avCol||'#D6D3EC'}">
      <span class="ci-av">${inner}</span>
      <b>${esc(c.name)}</b>${c.role?`<em>${esc(c.role)}</em>`:''}
      <span class="ci-x" data-i="${i}"><svg viewBox="0 0 24 24" fill="none"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></span>
    </span>`;
  }).join('') + add;
  bindCastRow();
}

function fanCovHTML(w){
  const th = w.cover || fanTheme(0);
  return `<div class="wc-cov" style="--w1:${th.c1};--w2:${th.c2};--wt:${th.ct}">
    <span class="wcv-line"></span>
    <div class="wcv-t">${esc(w.title||'无题')}</div>
    <div class="wcv-b">
      <span class="wcv-x">&times;</span>
      <span class="wcv-n">${String(fanChapN(w)).padStart(2,'0')}</span>
    </div>
  </div>`;
}
function fanWorkCardHTML(w){
  const tags = (w.tags||[]).slice(0,3).map(t=>`<span class="wc-tag">${esc(t)}</span>`).join('');
  const cir = w.circleId ? fanCircle(w.circleId) : null;
  return `<article class="wcard ${w.fav?'fav':''}" data-id="${w.id}">
    <span class="wc-star"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.6l2.4 4.9 5.4.8-3.9 3.8.9 5.3-4.8-2.5-4.8 2.5.9-5.3-3.9-3.8 5.4-.8L12 4.6z"/></svg></span>
    ${fanCovHTML(w)}
    <div class="wc-body">
      <div class="wc-cp"><span>${esc(fanCpLabel(w.cast).toUpperCase())}</span></div>
      <div class="wc-t">${esc(w.title||'无题')}</div>
      <div class="wc-d">${esc(w.intro||'还没有简介')}</div>
      <div class="wc-tags">${tags}</div>
      <div class="wc-foot">
        <span>${cir ? esc(cir.name) : '未归圈'}</span>
        <span><b>${fanChapN(w)}</b> 章 · <b>${fmtNum(fanWordN(w))}</b> 字</span>
      </div>
    </div>
  </article>`;
}

function renderFanMyList(){
  const host = $('#fanMyList'), empty = $('#fanMyEmpty');
  if(!host) return;
  const list = FAN.works.slice(0, 6);
  if(!list.length){
    host.innerHTML = '';
    host.hidden = true;
    if(empty) empty.hidden = false;
    return;
  }
  host.hidden = false;
  if(empty) empty.hidden = true;
  host.innerHTML = list.map(fanWorkCardHTML).join('');
  bindWorkCards(host);
  const cards = Array.from(host.children);
  cards.forEach((c,i)=>{
    c.style.opacity='0'; c.style.transform='translateY(14px)';
    requestAnimationFrame(()=>{
      c.style.transition = `opacity .55s var(--ease) ${i*0.05}s, transform .65s var(--ease) ${i*0.05}s`;
      c.style.opacity='1'; c.style.transform='none';
    });
    setTimeout(()=>{ c.style.transition=''; c.style.opacity=''; c.style.transform=''; }, 900+i*60);
  });
}

function renderPortal(){
  const rail = $('#ptRail');
  const nC = FAN.circles.length;
  const nW = FAN.works.length;
  const nCh = FAN.works.reduce((s,w)=>s+fanChapN(w), 0);
  const set = (id,v)=>{ const el=$(id); if(el) el.textContent = v; };
  set('#ptC1', nC); set('#ptC2', nW); set('#ptC3', nCh);
  set('#fanCircleN', nC); set('#fanWorkN', nW);
  set('#ptLiveTxt', nC ? `广场上有 ${nC} 个圈亮着灯` : '广场还没有门牌，等你开第一个');
  const d = $('#fanDate');
  if(d) d.textContent = fmtDate(Date.now());

  if(!rail) return;
  let items = FAN.circles.slice(0, 10);
  if(!items.length){
    /* 还没建圈时，用「等待中的门牌」占位，保持门后有东西在动 */
    items = [
      {name:'等你的第一对', en:'YOUR FIRST PAIR', theme:fanTheme(0)},
      {name:'等你的第二对', en:'AND THE NEXT', theme:fanTheme(2)},
      {name:'等你的第三对', en:'AND THE ONE AFTER', theme:fanTheme(5)},
      {name:'等你的第四对', en:'KEEP GOING', theme:fanTheme(6)}
    ];
  }
  const chip = c=>{
    const th = c.theme || fanTheme(0);
    const nm = c.name || '';
    return `<div class="pt-chip">
      <span class="pt-orb" style="--o1:${th.c1};--o2:${th.c2};--ot:${th.ct}"><span>${esc(fanInitial(nm))}</span></span>
      <span class="pt-cn"><b>${esc(nm)}</b><i>${esc((c.en || fanCpLabel(c.cast) || 'CIRCLE').toUpperCase())}</i></span>
    </div>`;
  };
  const once = items.map(chip).join('');
  rail.innerHTML = once + once;   /* 复制一份做无缝滚动 */
}

function renderFanGoHint(){
  const hint = $('#fanGoHint');
  const go = $('#fanGo');
  if(!hint || !go) return;
  const a = FAN.sel.a, b = FAN.sel.b;
  if(!a && !b){
    hint.textContent = '还没选人 · 至少要有一位主角';
    go.style.opacity = '.5';
    return;
  }
  go.style.opacity = '1';
  const names = fanCpLabel([a,b].filter(Boolean));
  const extra = FAN.sel.cast.length ? ` · 带 ${FAN.sel.cast.length} 位配角` : '';
  hint.textContent = `${names}${extra} · 约 ${FAN.brief.len} 字${FAN.circleOn ? ' · 会顺手开一个圈' : ''}`;
}

function renderFan(){
  renderFanChips();
  renderSlot('a'); renderSlot('b');
  renderCastRow();
  renderPortal();
  renderFanMyList();
  renderFanGoHint();
  const b = FAN.brief;
  const sv = $('#sweetVal'), sr = $('#sweetRange');
  if(sv) sv.textContent = b.sweet;
  if(sr){ sr.value = b.sweet; sr.style.setProperty('--p', b.sweet + '%'); }
  const lv = $('#lenVal'), lr = $('#lenRange');
  if(lv) lv.textContent = b.len;
  if(lr){ lr.value = b.len; lr.style.setProperty('--p', ((b.len-800)/4200*100).toFixed(1) + '%'); }
  const ti = $('#fanTagIn'); if(ti) ti.value = b.tagIn || '';
  const sc = $('#fanScene'); if(sc){ sc.value = b.scene||''; const n=$('#sceneN'); if(n) n.textContent = (b.scene||'').length; }
  const mu = $('#fanMust');  if(mu) mu.value = b.must||'';
  const nv = $('#fanNever'); if(nv) nv.value = b.never||'';
  const fr = $('#fanFree');  if(fr){ fr.value = b.free||''; const n=$('#freeN'); if(n) n.textContent = (b.free||'').length; }
  const cn = $('#circName'); if(cn) cn.value = FAN.circleName||'';
  const cm = $('#circMani'); if(cm) cm.value = FAN.circleMani||'';
  $('#circSw') && $('#circSw').classList.toggle('on', FAN.circleOn);
  $('#circBody') && $('#circBody').classList.toggle('on', FAN.circleOn);
  observeReveals();
}

/* =========================================================
   二十、角色选择面板
========================================================= */
function fanPickIsChosen(c){
  const key = 'db' + c.id;
  return [FAN.sel.a, FAN.sel.b].some(x=>x && x.key===key) || FAN.sel.cast.some(x=>x.key===key);
}
function renderCharPick(){
  const host = $('#cpList');
  if(!host) return;
  const q = (FAN.pickQuery||'').trim().toLowerCase();
  let list = FAN.chars;
  if(q){
    list = list.filter(c=>{
      const hay = [c.name, c.role, c.desc, (c.traits||[]).join(' '), c.species].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }
  if(!FAN.chars.length){
    host.innerHTML = `<div class="cp-none">角色档案还是空的。<br/>先去<a id="cpGoChar">角色档案</a>建几个人，同人才写得准。<br/>也可以直接用下面的「现填一个」。</div>`;
    const g = $('#cpGoChar');
    g && g.addEventListener('click', ()=>{ window.location.href = 'characters.html'; });
    return;
  }
  if(!list.length){
    host.innerHTML = `<div class="cp-none">没有找到这个人。<br/>换个词，或者用下面的「现填一个」。</div>`;
    return;
  }
  host.innerHTML = list.map(c=>{
    const av = fanAv(c);
    const inner = c.avatar ? `<img src="${c.avatar}" alt="" />` : `<span>${esc(fanInitial(c.name))}</span>`;
    const meta = [c.gender, c.age && c.age+'岁', c.species].filter(Boolean)
      .concat((c.traits||[]).slice(0,3))
      .map(x=>`<span>${esc(x)}</span>`).join('');
    return `<div class="cp-i ${fanPickIsChosen(c)?'on':''}" data-id="${c.id}">
      <span class="cp-av" style="--pa:${av.bg};--pc:${av.col}">${inner}</span>
      <div class="cp-info">
        <div class="cp-n">${esc(c.name||'未命名')}</div>
        <div class="cp-r">${esc(c.role || c.desc || '还没写身份')}</div>
        <div class="cp-meta">${meta}</div>
      </div>
      <span class="cp-ck"><svg viewBox="0 0 24 24" fill="none"><path d="M5.8 12.4l4 4 8.4-8.8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
    </div>`;
  }).join('');

  host.querySelectorAll('.cp-i').forEach(el=>{
    el.addEventListener('click', ()=>{
      const id = Number(el.dataset.id);
      const c = FAN.chars.find(x=>x.id === id);
      if(!c) return;
      fanApplyPick(fanCastItem(c, FAN.pickSlot));
    });
  });
}
function fanApplyPick(item){
  if(!item) return;
  if(FAN.pickSlot === 'a' || FAN.pickSlot === 'b'){
    const other = FAN.pickSlot === 'a' ? 'b' : 'a';
    if(FAN.sel[other] && FAN.sel[other].key === item.key){
      toast('这个人已经在另一边了');
      return;
    }
    item.side = FAN.pickSlot === 'a' ? 'A' : 'B';
    FAN.sel[FAN.pickSlot] = item;
    renderSlot(FAN.pickSlot);
  }else{
    if(FAN.sel.cast.some(x=>x.key===item.key)){ toast('已经加过了'); return; }
    if([FAN.sel.a, FAN.sel.b].some(x=>x && x.key===item.key)){ toast('主角位上已经有他了'); return; }
    if(FAN.sel.cast.length >= 6){ toast('配角最多 6 位'); return; }
    item.side = '配角';
    FAN.sel.cast.push(item);
    renderCastRow();
  }
  buzz(8);
  closeFanSheets();
  renderFanGoHint();
}
async function openCharPick(slot){
  FAN.pickSlot = slot;
  FAN.pickQuery = '';
  const inp = $('#cpSearch'); if(inp) inp.value = '';
  $('#cpTitle').textContent = slot === 'cast' ? '加一位配角' : (slot==='a' ? '选第一个人' : '选第二个人');
  $('#cpList').innerHTML = skeleton(4,'sk-line');
  $('#scrim').classList.add('is-on');
  $('#charPick').classList.add('is-on');
  FAN.chars = await loadArchiveChars();
  renderCharPick();
}
function closeFanSheets(){
  $('#charPick') && $('#charPick').classList.remove('is-on');
  $('#fxTocSheet') && $('#fxTocSheet').classList.remove('is-on');
  const anyOpen = ['#sheet','#editor','#dialog','#tocSheet'].some(s=>{
    const el = $(s); return el && el.classList.contains('is-on');
  });
  if(!anyOpen) $('#scrim').classList.remove('is-on');
}

/* =========================================================
   二十一、AI：把设定写成一篇同人
========================================================= */
function fanCastAll(){
  return [FAN.sel.a, FAN.sel.b].filter(Boolean).concat(FAN.sel.cast);
}
function fanSweetWord(v){
  if(v >= 85) return '通篇是甜的，不要让他们真的受伤';
  if(v >= 65) return '整体偏甜，中间可以有一点点小别扭，但很快化开';
  if(v >= 45) return '甜和涩各占一半，好的时刻和难受的时刻要互相咬着';
  if(v >= 25) return '偏虐，甜是稀薄的、被夹在难受里的那一点';
  return '很虐，让人读完心里堵一下，甜只出现在回忆里';
}
function fanBriefText(cast, brief, circle){
  const A = cast[0], B = cast[1];
  const L = [];
  L.push('【这一篇的人】');
  cast.forEach((c,i)=>{
    L.push(`—— 第 ${i+1} 位（${c.side || '出场人物'}）——`);
    L.push(fanDossier(c));
    L.push('');
  });
  L.push('【他们之间】');
  if(A && B) L.push(`主 CP：${A.name} × ${B.name}`);
  L.push(`关系动力：${brief.dyn}`);
  L.push(`故事开始时，他们的关系是：${brief.stage}`);
  L.push('');
  L.push('【这一篇要写成什么样】');
  L.push(`世界设定：${brief.au}`);
  L.push(`题材：${brief.genre}`);
  L.push(`基调：${brief.tone}`);
  L.push(`叙事视角：${brief.pov}`);
  L.push(`文体：${brief.form}`);
  L.push(`结局倾向：${brief.end}`);
  L.push(`尺度：${brief.rate}（无论如何都不写露骨的性描写，情动只用留白、动作和呼吸来写）`);
  L.push(`甜虐配比：${brief.sweet}/100 —— ${fanSweetWord(brief.sweet)}`);
  const tags = (brief.tags||[]).concat(String(brief.tagIn||'').split(/[,，、\s]+/).filter(Boolean));
  if(tags.length) L.push(`标签：${Array.from(new Set(tags)).join('、')}`);
  if(brief.scene){ L.push(''); L.push('【读者点名要看的那一幕，必须写到，而且要写成全篇的高光】'); L.push(brief.scene); }
  if(brief.must){ L.push(''); L.push('【必须发生】'); L.push(brief.must); }
  if(brief.never){ L.push(''); L.push('【绝对不要出现】'); L.push(brief.never); }
  if(brief.free){ L.push(''); L.push('【读者的补充交代，优先级最高】'); L.push(brief.free); }
  if(circle){
    L.push('');
    L.push(`【这一篇属于「${circle.name}」这个圈】`);
    if(circle.mani) L.push('圈子宣言：'+circle.mani);
  }
  return L.filter(x=>x!==undefined).join('\n');
}

const FAN_SYS_BASE = [
  '你是一位很会写同人的中文作者。你的读者是这两个角色的粉丝，他们对角色比你熟，任何 OOC 都会被一眼看穿。',
  '铁律：',
  '1. 角色档案里写的说话方式、口头禅、软肋、绝对不会做的事，全部要照着写，一条都不能违背。',
  '2. 写正文，不写梗概。用具体的动作、对白、感官细节推进，少用总结句。',
  '3. 对白要像这个人真的会说出口的话，而不是通用的言情台词。',
  '4. 不写露骨的性描写；情动用留白、动作、呼吸、未说完的话来写。',
  '5. 不出现任何解释性文字、markdown 符号、括号里的旁白说明。'
].join('\n');

/* ---------- 生成入口 ---------- */
async function fanGenerate(){
  const cast = fanCastAll();
  if(!cast.length){ toast('至少先选一个人'); return; }
  if(!needAI()) return;

  const brief = JSON.parse(JSON.stringify(FAN.brief));
  brief.tags = Array.from(new Set(
    (brief.tags||[]).concat(String(brief.tagIn||'').split(/[,，、\s]+/).filter(Boolean))
  ));

  const cpKey = fanCpKey(cast);
  let circle = null;

  genOpenFan(cast, [
    '把两个人的档案摊开对照',
    '找他们之间那根绷着的线',
    '拟一个能被记住的标题',
    FAN.circleOn ? '给这个圈起名、写宣言' : '写下这一篇的简介',
    '落笔'
  ]);

  try{
    const wantCircle = FAN.circleOn && !FAN.circles.some(c=>c.cpKey === cpKey);
    const sys = FAN_SYS_BASE + '\n\n你现在在做的是选题与命名，不是写正文。';
    const user = [
      fanBriefText(cast, brief, null),
      '',
      '请为这一篇同人拟定信息，输出 JSON：',
      '{',
      '  "title": "标题，6-16 字，要有画面感，不要书名号",',
      '  "sub": "一句英文或中文的副标题，短，像杂志刊头",',
      '  "intro": "简介，60-110 字，写得让人想点开，不剧透结局",',
      '  "tags": ["3-6 个标签，中文，2-5 字"],',
      '  "chapterTitle": "第一章的标题，4-12 字",',
      '  "hook": "这一章要写到的那个转折，一句话，只给作者自己看"',
      wantCircle ? ',  "circleName": "给这对 CP 的圈起个名字，4-10 字，要好听，可以化用他们的名字或两人之间的意象",\n  "circleEn": "圈子的英文小标，2-4 个词，全大写",\n  "circleMani": "圈子宣言，35-60 字，说清这个圈是为什么而存在的"' : '',
      '}'
    ].filter(x=>x!=='').join('\n');

    const meta = await aiJSON(sys, user, {max_tokens:1200, temperature:0.95});

    /* 圈子 */
    if(FAN.circleOn){
      const exist = FAN.circles.find(c=>c.cpKey === cpKey);
      if(exist){
        circle = exist;
      }else{
        const th = fanTheme(FAN.circleTheme);
        circle = {
          id: uid('fc'),
          name: (FAN.circleName || meta.circleName || fanCpLabel(cast)).slice(0,18),
          en: (meta.circleEn || fanCpLabel(cast)).toUpperCase().slice(0,40),
          mani: (FAN.circleMani || meta.circleMani || '为这一对而设的地方。').slice(0,220),
          cpKey,
          cast: cast.map(c=>({key:c.key, name:c.name, role:c.role, avatar:c.avatar, avBg:c.avBg, avCol:c.avCol})),
          theme: th,
          tags: (meta.tags||brief.tags||[]).slice(0,6),
          vis: FAN.vis,
          createdAt: Date.now(),
          pinned:false
        };
        FAN.circles.unshift(circle);
        await fdbPut(F_CIRCLE, circle);
      }
    }else{
      circle = FAN.circles.find(c=>c.cpKey === cpKey) || null;
    }

    const th = circle ? circle.theme : fanTheme(Math.floor(Math.random()*FAN_THEMES.length));
    const work = {
      id: uid('fw'),
      circleId: circle ? circle.id : null,
      title: String(meta.title||'无题').slice(0,24),
      sub: String(meta.sub||'').slice(0,60),
      intro: String(meta.intro||'').slice(0,200),
      tags: Array.from(new Set((meta.tags||[]).concat(brief.tags))).slice(0,8),
      cast: cast.map(c=>({
        key:c.key, id:c.id, name:c.name, role:c.role, gender:c.gender,
        avatar:c.avatar, avBg:c.avBg, avCol:c.avCol, from:c.from, side:c.side, raw:c.raw||null
      })),
      cpKey,
      brief,
      cover: th,
      chapters: [],
      pending: {title: String(meta.chapterTitle||'第一章').slice(0,24), hook: String(meta.hook||'')},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      fav:false, reads:0
    };
    FAN.works.unshift(work);
    await fdbPut(F_WORK, work);

    genClose();
    renderFan();
    FAN.curWorkId = work.id;
    openFanReader(work.id, 1, true);
  }catch(e){
    genFail(e);
  }
}

/* 生成浮层：带上两个人的头像，仪式感 */
function genOpenFan(cast, steps){
  genOpen('正在写这一篇', steps);
  const inner = document.querySelector('#genOverlay .gen-inner');
  if(!inner) return;
  let host = inner.querySelector('.gen-cast');
  if(!host){
    host = document.createElement('div');
    host.className = 'gen-cast';
    inner.insertBefore(host, inner.firstChild);
  }
  host.innerHTML = cast.slice(0,3).map(c=>{
    const in2 = c.avatar ? `<img src="${c.avatar}" alt="" />` : `<span>${esc(fanInitial(c.name))}</span>`;
    return `<span class="gc-f" style="--ga:${c.avBg||'#26243A'};--gc:${c.avCol||'#D6D3EC'}">${in2}</span>`;
  }).join('');
}

/* ---------- 正文流式生成 ---------- */
async function fanStreamChapter(work, idx, regen){
  if(!needAI()) return;
  const body = $('#fxBody');
  if(!body) return;
  body.innerHTML = `<div class="rd-writing"><span class="rw-nib"></span><span class="rw-txt">正在写第 ${idx} 章…</span></div>`;
  $('#fxEnd').classList.remove('is-on');
  $('#fxEnd').innerHTML = '';
  FAN.fx.streaming = true;

  const cast = work.cast || [];
  const brief = work.brief || FAN_BRIEF_DEFAULT;
  const prev = (work.chapters||[]).slice(0, idx-1);
  const prevTail = prev.length ? prev[prev.length-1] : null;
  const chapTitle = (regen || !work.chapters[idx-1])
    ? ((work.pending && idx === (work.chapters||[]).length + 1 ? work.pending.title : null) || (work.chapters[idx-1] && work.chapters[idx-1].t) || `第 ${idx} 章`)
    : work.chapters[idx-1].t;

  const dossierBlock = cast.map((c,i)=>{
    if(c.from === 'custom' || !c.raw) return `【${c.name}】（临时角色）身份：${c.role||'未填'}`;
    return fanDossier({from:'db', raw:c.raw, name:c.name});
  }).join('\n\n');

  const sys = FAN_SYS_BASE;
  const user = [
    '【出场人物档案】',
    dossierBlock,
    '',
    '【这一篇的设定】',
    `主 CP：${fanCpLabel(cast.slice(0,2))}`,
    `关系动力：${brief.dyn} ｜ 当前关系：${brief.stage}`,
    `世界设定：${brief.au} ｜ 题材：${brief.genre} ｜ 基调：${brief.tone}`,
    `视角：${brief.pov} ｜ 文体：${brief.form} ｜ 结局倾向：${brief.end}`,
    `尺度：${brief.rate}。甜虐：${fanSweetWord(brief.sweet)}`,
    (brief.tags||[]).length ? `标签：${brief.tags.join('、')}` : '',
    brief.scene ? `\n【读者点名要看的那一幕，必须落到实处】\n${brief.scene}` : '',
    brief.must ? `\n【必须发生】\n${brief.must}` : '',
    brief.never ? `\n【绝对不要出现】\n${brief.never}` : '',
    brief.free ? `\n【读者的补充交代，优先级最高】\n${brief.free}` : '',
    '',
    `【本篇标题】${work.title}`,
    work.intro ? `【本篇简介】${work.intro}` : '',
    prev.length ? '\n【前面已经写过的】\n' + prev.map((c,i)=>`第 ${i+1} 章《${c.t}》：${(c.sum || c.body.slice(0,180))}`).join('\n') : '',
    prevTail ? `\n【上一章的最后几句，请自然接上】\n…${prevTail.body.slice(-160)}` : '',
    work.pending && work.pending.hook && idx === prev.length + 1 ? `\n【这一章要写到的转折】${work.pending.hook}` : '',
    '',
    `请写第 ${idx} 章《${chapTitle}》的正文，约 ${brief.len} 字。分段，段落之间空一行。只输出正文，不要标题。`,
    brief.form === '聊天记录体' ? '（文体是聊天记录体：用“名字：内容”的形式一行一句，中间可以插入极短的旁白行。）' : '',
    brief.form === '书信体' ? '（文体是书信体：写成一封或几封信，有称呼和落款。）' : '',
    brief.form === '日记体' ? '（文体是日记体：每段前用日期起头。）' : '',
    brief.form === '剧本体' ? '（文体是剧本体：场景标注 + 人物对白 + 极简动作提示。）' : ''
  ].filter(Boolean).join('\n');

  let acc = '', painted = 0;
  const flush = ()=>{
    const paras = acc.split(/\n+/);
    let html = '';
    paras.forEach((s,i)=>{
      s = s.trim(); if(!s) return;
      html += `<p class="rd-p ${i>=painted?'fresh':''}">${esc(s)}</p>`;
    });
    body.innerHTML = html + '<span class="rd-caret"></span>';
    painted = paras.length - 1;
  };

  try{
    let tick = 0;
    const text = await aiStream([{role:'system',content:sys},{role:'user',content:user}], (d, full)=>{
      acc = full;
      if(++tick % 3 === 0) flush();
    }, {max_tokens: Math.min(8000, Math.round((brief.len||2200)*2.2)), host: FAN.fx, temperature:0.98});

    acc = text || acc;
    FAN.fx.streaming = false;
    if(!String(acc).trim()){
      body.innerHTML = `<div class="rd-fail">这一章没写出来。<span class="dt-retry" id="fxRetry">重试</span></div>`;
      bindFxRetry(work, idx); return;
    }
    const clean = String(acc).replace(/^```[\s\S]*?\n/,'').replace(/```$/,'').trim();
    body.innerHTML = fanParaHTML(clean);

    const chap = {t: chapTitle, body: clean, at: Date.now(), words: fanWords(clean)};
    work.chapters = work.chapters || [];
    work.chapters[idx-1] = chap;
    work.updatedAt = Date.now();
    work.pending = null;
    await fdbPut(F_WORK, work);
    renderFanMyList(); renderPortal();
    renderFanChapterEnd(work, idx);
    fanSummarize(work, idx);
  }catch(e){
    FAN.fx.streaming = false;
    if(String(e.message).includes('NO_API')){ needAI(); return; }
    body.innerHTML = `<div class="rd-fail">这一章没写出来：${esc(String(e.message).slice(0,50))} <span class="dt-retry" id="fxRetry">重试</span></div>`;
    bindFxRetry(work, idx);
  }
}
function bindFxRetry(work, idx){
  const r = $('#fxRetry');
  r && r.addEventListener('click', ()=>fanStreamChapter(work, idx, true));
}
function fanParaHTML(text){
  return String(text||'').split(/\n+/).map(s=>s.trim()).filter(Boolean)
    .map(s=>`<p class="rd-p">${esc(s)}</p>`).join('');
}

/* 后台压一段梗概，让续写不跑偏 */
async function fanSummarize(work, idx){
  const chap = work.chapters[idx-1];
  if(!chap || chap.sum) return;
  try{
    const txt = await aiRaw([
      {role:'system', content:'把下面这一章压成 60 字以内的梗概，只写发生了什么、两人关系推进到哪一步。只输出梗概本身。'},
      {role:'user', content: chap.body.slice(0, 4000)}
    ], {max_tokens:220, temperature:0.4});
    chap.sum = String(txt||'').trim().slice(0,120);
    await fdbPut(F_WORK, work);
  }catch(e){}
}

/* 续写下一章：先取一个章节标题，再流式写 */
async function fanNextChapter(work){
  if(!needAI()) return;
  const n = (work.chapters||[]).length;
  genOpenFan(work.cast||[], ['回看前面写过的','想想接下来该发生什么','起一个章节名','落笔']);
  try{
    const prev = (work.chapters||[]).map((c,i)=>`第 ${i+1} 章《${c.t}》：${c.sum || c.body.slice(0,150)}`).join('\n');
    const meta = await aiJSON(
      FAN_SYS_BASE + '\n\n你现在在做的是章节规划，不是写正文。',
      [
        `这一篇同人叫《${work.title}》，主 CP 是 ${fanCpLabel((work.cast||[]).slice(0,2))}。`,
        work.intro ? '简介：'+work.intro : '',
        `结局倾向：${(work.brief||{}).end || '开放式'}`,
        '前面已经写过：',
        prev || '（还没有）',
        '',
        `请规划第 ${n+1} 章，输出 JSON：{"title":"章节标题，4-12字","hook":"这一章要写到的转折，一句话"}`
      ].filter(Boolean).join('\n'),
      {max_tokens:400, temperature:0.92}
    );
    work.pending = {title:String(meta.title||`第 ${n+1} 章`).slice(0,24), hook:String(meta.hook||'')};
    await fdbPut(F_WORK, work);
    genClose();
    openFanReader(work.id, n+1, true);
  }catch(e){ genFail(e); }
}

/* =========================================================
   二十二、同人广场
========================================================= */
function fanFaceHTML(c, cls){
  const inner = c && c.avatar ? `<img src="${c.avatar}" alt="" />` : `<span>${esc(fanInitial(c && c.name))}</span>`;
  return `<span class="${cls}" style="--fa:${(c&&c.avBg)||'#26243A'};--fc:${(c&&c.avCol)||'#D6D3EC'}">${inner}</span>`;
}
function circleCardHTML(c){
  const ws = fanCircleWorks(c.id);
  const chaps = ws.reduce((s,w)=>s+fanChapN(w), 0);
  const th = c.theme || fanTheme(0);
  const faces = (c.cast||[]).slice(0,2);
  const tags = (c.tags||[]).slice(0,4).map(t=>`<span class="tag">${esc(t)}</span>`).join('');
  return `<article class="ccard" data-id="${c.id}">
    <div class="cc-banner" style="--b1:${th.c1};--b2:${th.c2};--bt:${th.ct}">
      <span class="cc-arc a1"></span><span class="cc-arc a2"></span><span class="cc-arc a3"></span>
      <span class="cc-grain"></span>
      <span class="cc-badge">${esc(String(c.vis||'').includes('广场') ? 'IN SQUARE' : 'PRIVATE')}</span>
      <div class="cc-cpline">
        ${faces[0] ? fanFaceHTML(faces[0], 'cc-face') : ''}
        ${faces[1] ? fanFaceHTML(faces[1], 'cc-face b') : ''}
        <span class="cc-xx">&times;</span>
      </div>
      ${c.pinned ? `<span class="cc-pin"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.6l2.4 4.9 5.4.8-3.9 3.8.9 5.3-4.8-2.5-4.8 2.5.9-5.3-3.9-3.8 5.4-.8L12 4.6z"/></svg></span>` : ''}
    </div>
    <div class="cc-body">
      <h3 class="cc-n">${esc(c.name)}</h3>
      <div class="cc-en">${esc(c.en || fanCpLabel(c.cast))}</div>
      <div class="cc-m">${esc(c.mani||'')}</div>
      <div class="cc-tags">${tags}</div>
      <div class="cc-foot">
        <div class="cc-stats">
          <div class="cc-st"><b>${ws.length}</b><span>篇</span></div>
          <div class="cc-st"><b>${chaps}</b><span>章</span></div>
        </div>
        <div class="cc-go"><span>进去看看</span><svg viewBox="0 0 24 24" fill="none"><path d="M5 12h13M13 6.5l5.5 5.5L13 17.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      </div>
    </div>
  </article>`;
}

function renderSquare(){
  const d = $('#sqDate'); if(d) d.textContent = fmtDate(Date.now());
  $('#sqCircleN') && ($('#sqCircleN').textContent = FAN.circles.length);

  /* 筛选条 */
  const bar = $('#sqBar');
  if(bar){
    const keys = ['all'].concat(Array.from(new Set(FAN.circles.map(c=>c.cpKey))).slice(0,12));
    bar.innerHTML = keys.map(k=>{
      const label = k === 'all' ? '全部' : (FAN.circles.find(c=>c.cpKey===k)||{}).name || k;
      return `<span class="sq-f ${FAN.sqFilter===k?'on':''}" data-k="${esc(k)}">${esc(label)}</span>`;
    }).join('');
    bar.querySelectorAll('.sq-f').forEach(el=>{
      el.addEventListener('click', ()=>{ FAN.sqFilter = el.dataset.k; renderSquare(); buzz(6); });
    });
  }

  /* 圈子 */
  const host = $('#sqCircles'), empty = $('#sqCircleEmpty');
  let cs = FAN.circles;
  if(FAN.sqFilter !== 'all') cs = cs.filter(c=>c.cpKey === FAN.sqFilter);
  if(host){
    if(!cs.length){ host.innerHTML=''; host.hidden = true; if(empty) empty.hidden = false; }
    else{
      host.hidden = false; if(empty) empty.hidden = true;
      host.innerHTML = cs.map(circleCardHTML).join('');
      host.querySelectorAll('.ccard').forEach((el,i)=>{
        el.addEventListener('click', ()=>openCircle(el.dataset.id));
        el.style.opacity='0'; el.style.transform='translateY(18px)'; el.style.filter='blur(6px)';
        requestAnimationFrame(()=>{
          el.style.transition = `opacity .62s var(--ease) ${i*0.07}s, transform .74s var(--ease) ${i*0.07}s, filter .6s ease ${i*0.07}s`;
          el.style.opacity='1'; el.style.transform='none'; el.style.filter='none';
        });
        setTimeout(()=>{ el.style.transition=''; el.style.opacity=''; el.style.transform=''; el.style.filter=''; }, 1000+i*80);
      });
    }
  }

  /* 最新作品 */
  const flow = $('#sqFlow'), fe = $('#sqFlowEmpty');
  let ws = FAN.works.slice();
  if(FAN.sqFilter !== 'all') ws = ws.filter(w=>w.cpKey === FAN.sqFilter);
  if(flow){
    if(!ws.length){ flow.innerHTML=''; flow.hidden = true; if(fe) fe.hidden = false; }
    else{
      flow.hidden = false; if(fe) fe.hidden = true;
      flow.innerHTML = ws.slice(0,12).map(fanWorkCardHTML).join('');
      bindWorkCards(flow);
    }
  }

  /* 排行 */
  const rank = $('#sqRank');
  if(rank){
    const top = FAN.works.slice().sort((a,b)=>(b.reads||0)-(a.reads||0)).slice(0,5).filter(w=>true);
    if(!top.length){ rank.hidden = true; rank.innerHTML=''; }
    else{
      rank.hidden = false;
      rank.innerHTML = top.map((w,i)=>`
        <div class="rank-i" data-id="${w.id}">
          <span class="rk-n">${String(i+1).padStart(2,'0')}</span>
          <div class="rk-b">
            <div class="rk-t">${esc(w.title)}</div>
            <div class="rk-s">${esc(fanCpLabel(w.cast))} · ${fanChapN(w)} 章</div>
          </div>
          <span class="rk-v">${w.reads||0} 次</span>
        </div>`).join('');
      rank.querySelectorAll('.rank-i').forEach(el=>{
        el.addEventListener('click', ()=>openFanWork(el.dataset.id));
      });
    }
  }
}

function openSquare(){
  renderSquare();
  const sc = $('#squareScroll'); if(sc) sc.scrollTop = 0;
  pushView('pgSquare');
}

/* =========================================================
   二十三、圈子详情
========================================================= */
function openCircle(id){
  const c = fanCircle(id);
  if(!c) return;
  FAN.curCircleId = id;
  const th = c.theme || fanTheme(0);
  const hero = $('#cirHero');
  if(hero){ hero.style.setProperty('--h1', th.c1); hero.style.setProperty('--h2', th.c2); }
  $('#cirVpTitle').textContent = c.name;
  $('#cirName').textContent = c.name;
  $('#cirEn').textContent = c.en || fanCpLabel(c.cast);
  $('#cirMani').textContent = c.mani || '还没有写宣言。';
  $('#cirFaces').innerHTML = (c.cast||[]).slice(0,3).map(x=>fanFaceHTML(x,'cir-face')).join('');
  $('#cirTags').innerHTML = (c.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('');

  const ws = fanCircleWorks(id);
  const chaps = ws.reduce((s,w)=>s+fanChapN(w),0);
  const words = ws.reduce((s,w)=>s+fanWordN(w),0);
  countTo($('#cirWorks'), ws.length, 800);
  countTo($('#cirChaps'), chaps, 900);
  countTo($('#cirWords'), words, 1100);

  const host = $('#cirList'), empty = $('#cirEmpty');
  if(!ws.length){ host.innerHTML=''; host.hidden = true; empty.hidden = false; }
  else{
    host.hidden = false; empty.hidden = true;
    host.innerHTML = ws.map(fanWorkCardHTML).join('');
    bindWorkCards(host);
  }
  const sc = $('#circleScroll'); if(sc) sc.scrollTop = 0;
  pushView('pgCircle');
}

/* =========================================================
   二十四、作品详情
========================================================= */
function fanBriefPills(b){
  if(!b) return '';
  const rows = [
    ['设定', b.au], ['题材', b.genre], ['基调', b.tone],
    ['视角', b.pov], ['文体', b.form], ['关系', b.dyn],
    ['起点', b.stage], ['结局', b.end], ['尺度', b.rate],
    ['甜度', (b.sweet==null?'—':b.sweet+'/100')]
  ];
  return rows.filter(r=>r[1]).map(r=>`<span class="fr-bi"><b>${esc(r[0])}</b> ${esc(String(r[1]))}</span>`).join('');
}
function openFanWork(id){
  const w = fanWork(id);
  if(!w) return;
  FAN.curWorkId = id;
  $('#fwVpTitle').textContent = w.title;
  $('#fwKk').textContent = (w.circleId && fanCircle(w.circleId)) ? fanCircle(w.circleId).name : 'FAN WORK';
  $('#fwDate').textContent = fmtDate(w.createdAt);
  $('#fwTitle').textContent = w.title;
  $('#fwSub').textContent = w.sub || fanCpLabel(w.cast);
  $('#fwIntro').textContent = w.intro || '还没有简介。';
  $('#fwTags').innerHTML = (w.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('');
  $('#fwBrief').innerHTML = fanBriefPills(w.brief);
  $('#fwCast').innerHTML = (w.cast||[]).map(c=>{
    const inner = c.avatar ? `<img src="${c.avatar}" alt="" />` : `<span>${esc(fanInitial(c.name))}</span>`;
    return `<span class="fr-cast-i" style="--ca:${c.avBg||'#26243A'};--cc:${c.avCol||'#D6D3EC'}">
      <span class="fa-av">${inner}</span><b>${esc(c.name)}</b>${c.role?`<em>${esc(c.role)}</em>`:''}
    </span>`;
  }).join('');
  $('#fwFav').style.color = w.fav ? '#C9A24B' : '';
  renderFwChapters(w);
  const sc = $('#fanWorkScroll'); if(sc) sc.scrollTop = 0;
  pushView('pgFanWork');
}
function renderFwChapters(w){
  const chs = w.chapters||[];
  $('#fwChapN').textContent = chs.length;
  $('#fwWordN').textContent = fmtNum(fanWordN(w));
  const host = $('#fwChapList');
  if(!host) return;
  if(!chs.length){
    host.innerHTML = `<div class="cp-none">还没有正文。<br/>点上面的「开始读」，模型会当场把第一章写出来。</div>`;
    return;
  }
  host.innerHTML = chs.map((c,i)=>`
    <div class="fr-ch" data-i="${i+1}">
      <span class="fr-ch-n">${String(i+1).padStart(2,'0')}</span>
      <span class="fr-ch-t">${esc(c.t||('第 '+(i+1)+' 章'))}</span>
      <span class="fr-ch-w">${fmtNum(c.words||fanWords(c.body))} 字</span>
    </div>`).join('');
  host.querySelectorAll('.fr-ch').forEach(el=>{
    el.addEventListener('click', ()=>openFanReader(w.id, Number(el.dataset.i)));
  });
}

/* =========================================================
   二十五、同人阅读器
========================================================= */
function applyFx(){
  const p = $('#pgFanRead');
  if(!p) return;
  p.dataset.theme = state.rd.theme;
  p.dataset.font  = state.rd.font;
  p.style.setProperty('--rs', state.rd.size + 'px');
  p.style.setProperty('--rl', state.rd.lead);
  const sv = $('#fxSizeVal'), lv = $('#fxLeadVal');
  if(sv) sv.textContent = state.rd.size;
  if(lv) lv.textContent = Number(state.rd.lead).toFixed(2);
  $$('#fxThemes .rd-th').forEach(t=>t.classList.toggle('is-on', t.dataset.theme === state.rd.theme));
  $$('#fxFonts .rd-fo').forEach(t=>t.classList.toggle('is-on', t.dataset.font === state.rd.font));
}
function showFxBars(on){
  const p = $('#pgFanRead');
  if(!p) return;
  FAN.fx.bars = on;
  p.classList.toggle('bars', on);
  if(!on) $('#fxPanel').classList.remove('is-on');
}

async function openFanReader(workId, idx, forceWrite){
  const w = fanWork(workId);
  if(!w) return;
  const total = Math.max(1, (w.chapters||[]).length + ((w.pending || forceWrite) ? 1 : 0));
  idx = clamp(idx||1, 1, Math.max(total, idx||1));
  FAN.fx.workId = workId;
  FAN.fx.idx = idx;

  applyFx();
  $('#fxWorkName').textContent = w.title;
  $('#fxNo').textContent = `第 ${idx} 章`;
  const known = (w.chapters||[])[idx-1];
  $('#fxTitle').textContent = known ? (known.t||`第 ${idx} 章`)
    : ((w.pending && w.pending.title) || `第 ${idx} 章`);
  $('#fxBody').innerHTML = '';
  $('#fxEnd').classList.remove('is-on');
  $('#fxEnd').innerHTML = '';
  $('#fxScroll').scrollTop = 0;
  $('#fxProgFill').style.width = '0%';
  showFxBars(true);

  if(!state.views.includes('pgFanRead')) pushView('pgFanRead');

  w.reads = (w.reads||0) + 1;
  w.updatedAt = w.updatedAt || Date.now();
  fdbPut(F_WORK, w);

  if(known && known.body){
    $('#fxBody').innerHTML = fanParaHTML(known.body);
    renderFanChapterEnd(w, idx);
    return;
  }
  fanStreamChapter(w, idx, false);
}

function renderFanChapterEnd(w, idx){
  const end = $('#fxEnd');
  if(!end) return;
  const chs = w.chapters||[];
  const hasPrev = idx > 1;
  const hasNext = idx < chs.length;
  end.innerHTML = `
    <div class="re-rule"><i></i></div>
    <div class="re-block">
      <div class="re-k">这一章写完了</div>
      <div class="re-note-body">${esc((chs[idx-1] && chs[idx-1].sum) || '正在压一句梗概，方便下一章接得上。')}</div>
    </div>
    <div class="fx-next">
      ${hasPrev ? `<button class="sha" id="fxPrev">上一章</button>` : ''}
      ${hasNext ? `<button class="sha primary" id="fxNext"><span class="sha-sweep"></span>下一章</button>`
                : `<button class="sha primary" id="fxWriteNext"><span class="sha-sweep"></span>让他写下一章</button>`}
      <button class="sha" id="fxToWork">回到这一篇</button>
    </div>
    <div class="fx-hint">${hasNext ? '' : '续写会带上前面所有章节的梗概，不会跑偏'}</div>`;
  requestAnimationFrame(()=>end.classList.add('is-on'));

  const p = $('#fxPrev'); p && p.addEventListener('click', ()=>openFanReader(w.id, idx-1));
  const n = $('#fxNext'); n && n.addEventListener('click', ()=>openFanReader(w.id, idx+1));
  const wn = $('#fxWriteNext'); wn && wn.addEventListener('click', ()=>fanNextChapter(w));
  const tw = $('#fxToWork'); tw && tw.addEventListener('click', ()=>{
    while(state.views.length && state.views[state.views.length-1] === 'pgFanRead') popView();
    openFanWork(w.id);
  });
}

function openFxToc(){
  const w = fanWork(FAN.fx.workId);
  if(!w) return;
  $('#fxTocTitle').textContent = w.title;
  $('#fxTocSub').textContent = `${fanChapN(w)} 章 · ${fmtNum(fanWordN(w))} 字`;
  const list = $('#fxTocList');
  const chs = w.chapters||[];
  list.innerHTML = chs.length
    ? chs.map((c,i)=>`<div class="fr-ch ${i+1===FAN.fx.idx?'on':''}" data-i="${i+1}">
        <span class="fr-ch-n">${String(i+1).padStart(2,'0')}</span>
        <span class="fr-ch-t">${esc(c.t||('第 '+(i+1)+' 章'))}</span>
        <span class="fr-ch-w">${fmtNum(c.words||fanWords(c.body))}</span>
      </div>`).join('')
    : `<div class="cp-none">还没有写好的章节。</div>`;
  list.querySelectorAll('.fr-ch').forEach(el=>{
    el.addEventListener('click', ()=>{
      closeFanSheets();
      openFanReader(w.id, Number(el.dataset.i));
    });
  });
  $('#fxTocFoot').innerHTML = `<button class="sha primary" id="fxTocNew"><span class="sha-sweep"></span>续写下一章</button>`;
  const nb = $('#fxTocNew');
  nb && nb.addEventListener('click', ()=>{ closeFanSheets(); fanNextChapter(w); });
  $('#scrim').classList.add('is-on');
  $('#fxTocSheet').classList.add('is-on');
}

/* =========================================================
   二十六、作品卡片交互（点开 / 长按删）
========================================================= */
function bindWorkCards(host){
  host.querySelectorAll('.wcard').forEach(card=>{
    let timer=null, moved=false, longed=false, sx=0, sy=0;
    card.addEventListener('pointerdown', e=>{
      moved=false; longed=false; sx=e.clientX; sy=e.clientY;
      card.classList.add('pressing');
      timer = setTimeout(()=>{
        longed = true;
        card.classList.remove('pressing');
        buzz(16);
        askDeleteWork(card.dataset.id);
      }, 460);
    });
    card.addEventListener('pointermove', e=>{
      if(Math.abs(e.clientX-sx)>8 || Math.abs(e.clientY-sy)>8){
        moved=true; clearTimeout(timer); card.classList.remove('pressing');
      }
    });
    const end = ()=>{ clearTimeout(timer); card.classList.remove('pressing'); };
    card.addEventListener('pointerup', ()=>{
      end();
      if(moved || longed) return;
      openFanWork(card.dataset.id);
    });
    card.addEventListener('pointercancel', end);
    card.addEventListener('pointerleave', end);
  });
}
function askDeleteWork(id){
  const w = fanWork(id);
  if(!w) return;
  askDialog('删掉这一篇', `《${w.title}》连同它的 ${fanChapN(w)} 章正文都会消失，找不回来。`, '删掉', async ()=>{
    FAN.works = FAN.works.filter(x=>x.id!==id);
    await fdbDel(F_WORK, id);
    renderFan(); renderSquare();
    if(FAN.curCircleId) {
      const c = fanCircle(FAN.curCircleId);
      if(c) openCircleSilent(c.id);
    }
    toast('已经删掉了');
  });
}
function openCircleSilent(id){
  const c = fanCircle(id);
  if(!c) return;
  const ws = fanCircleWorks(id);
  const host = $('#cirList'), empty = $('#cirEmpty');
  if(!host) return;
  if(!ws.length){ host.innerHTML=''; host.hidden = true; empty.hidden = false; }
  else{
    host.hidden = false; empty.hidden = true;
    host.innerHTML = ws.map(fanWorkCardHTML).join('');
    bindWorkCards(host);
  }
  $('#cirWorks').textContent = ws.length;
  $('#cirChaps').textContent = ws.reduce((s,w)=>s+fanChapN(w),0);
  $('#cirWords').textContent = fmtNum(ws.reduce((s,w)=>s+fanWordN(w),0));
}

/* =========================================================
   二十七、同人页的所有交互绑定
========================================================= */
function bindCastRow(){
  const add = $('#castAdd');
  add && add.addEventListener('click', ()=>openCharPick('cast'));
  $$('#castRow .ci-x').forEach(el=>{
    el.addEventListener('click', e=>{
      e.stopPropagation();
      FAN.sel.cast.splice(Number(el.dataset.i), 1);
      renderCastRow(); renderFanGoHint(); buzz(6);
    });
  });
}

function bindFanUI(){
  /* ---- 广场入口：整张卡都是门 ---- */
  const portal = $('#fanPortal');
  portal && portal.addEventListener('click', ()=>openSquare());
  const allLink = $('#fanAllLink');
  allLink && allLink.addEventListener('click', e=>{ e.stopPropagation(); openSquare(); });

  /* ---- 角色位 ---- */
  ['a','b'].forEach(which=>{
    const slot = $('#pslot' + which.toUpperCase());
    if(!slot) return;
    slot.addEventListener('click', e=>{
      const x = e.target.closest('.ps-x');
      if(x){
        e.stopPropagation();
        FAN.sel[which] = null;
        renderSlot(which); renderFanGoHint(); buzz(6);
        return;
      }
      openCharPick(which);
    });
  });
  const swap = $('#pairSwap');
  swap && swap.addEventListener('click', e=>{
    e.stopPropagation();
    const t = FAN.sel.a; FAN.sel.a = FAN.sel.b; FAN.sel.b = t;
    if(FAN.sel.a) FAN.sel.a.side = 'A';
    if(FAN.sel.b) FAN.sel.b.side = 'B';
    renderSlot('a'); renderSlot('b'); renderFanGoHint(); buzz(10);
  });

  /* ---- 单选 chip 组 ---- */
  ['#chDyn','#chStage','#chAu','#chGenre','#chTone','#chPov','#chForm','#chEnd','#chRate'].forEach(sel=>{
    const host = $(sel);
    if(!host) return;
    host.addEventListener('click', e=>{
      const chip = e.target.closest('.chip');
      if(!chip) return;
      FAN.brief[host.dataset.key] = chip.dataset.v;
      host.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on', c === chip));
      fanSaveBrief(); renderFanGoHint(); buzz(6);
    });
  });

  /* ---- 多选标签 ---- */
  const tagHost = $('#chTags');
  tagHost && tagHost.addEventListener('click', e=>{
    const chip = e.target.closest('.chip');
    if(!chip) return;
    const v = chip.dataset.v;
    const i = FAN.brief.tags.indexOf(v);
    if(i >= 0) FAN.brief.tags.splice(i,1);
    else{
      if(FAN.brief.tags.length >= 8){ toast('最多 8 个标签'); return; }
      FAN.brief.tags.push(v);
    }
    chip.classList.toggle('on');
    fanSaveBrief(); buzz(6);
  });

  /* ---- 可见范围 ---- */
  const visHost = $('#chVis');
  visHost && visHost.addEventListener('click', e=>{
    const chip = e.target.closest('.chip');
    if(!chip) return;
    FAN.vis = chip.dataset.v;
    visHost.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on', c===chip));
    buzz(6);
  });

  /* ---- 圈徽配色 ---- */
  const thHost = $('#circTheme');
  thHost && thHost.addEventListener('click', e=>{
    const t = e.target.closest('.theme-i');
    if(!t) return;
    FAN.circleTheme = Number(t.dataset.i)||0;
    thHost.querySelectorAll('.theme-i').forEach(x=>x.classList.toggle('on', x===t));
    buzz(6);
  });

  /* ---- 滑杆 ---- */
  const sr = $('#sweetRange');
  sr && sr.addEventListener('input', ()=>{
    FAN.brief.sweet = Number(sr.value);
    $('#sweetVal').textContent = FAN.brief.sweet;
    sr.style.setProperty('--p', FAN.brief.sweet + '%');
    fanSaveBrief();
  });
  const lr = $('#lenRange');
  lr && lr.addEventListener('input', ()=>{
    FAN.brief.len = Number(lr.value);
    $('#lenVal').textContent = FAN.brief.len;
    lr.style.setProperty('--p', ((FAN.brief.len-800)/4200*100).toFixed(1) + '%');
    fanSaveBrief(); renderFanGoHint();
  });

  /* ---- 文本框 ---- */
  const bindTxt = (sel, key, counter)=>{
    const el = $(sel);
    if(!el) return;
    el.addEventListener('input', ()=>{
      FAN.brief[key] = el.value;
      if(counter){ const c = $(counter); if(c) c.textContent = el.value.length; }
      fanSaveBrief();
    });
  };
  bindTxt('#fanScene','scene','#sceneN');
  bindTxt('#fanMust','must');
  bindTxt('#fanNever','never');
  bindTxt('#fanFree','free','#freeN');
  const ti = $('#fanTagIn');
  ti && ti.addEventListener('input', ()=>{ FAN.brief.tagIn = ti.value; fanSaveBrief(); });

  /* ---- 圈子开关 ---- */
  const sw = $('#circSw');
  sw && sw.addEventListener('click', ()=>{
    FAN.circleOn = !FAN.circleOn;
    sw.classList.toggle('on', FAN.circleOn);
    $('#circBody').classList.toggle('on', FAN.circleOn);
    renderFanGoHint(); buzz(10);
  });
  const cn = $('#circName');
  cn && cn.addEventListener('input', ()=>{ FAN.circleName = cn.value; });
  const cm = $('#circMani');
  cm && cm.addEventListener('input', ()=>{ FAN.circleMani = cm.value; });

  /* ---- 抽一套 ---- */
  const dice = $('#fanDice');
  dice && dice.addEventListener('click', ()=>{
    FAN.brief.dyn   = fanRand(FAN_OPT.dyn);
    FAN.brief.stage = fanRand(FAN_OPT.stage);
    FAN.brief.au    = fanRand(FAN_OPT.au);
    FAN.brief.genre = fanRand(FAN_OPT.genre);
    FAN.brief.tone  = fanRand(FAN_OPT.tone);
    FAN.brief.pov   = fanRand(FAN_OPT.pov);
    FAN.brief.form  = fanRand(FAN_OPT.form);
    FAN.brief.end   = fanRand(FAN_OPT.end);
    FAN.brief.sweet = 20 + Math.floor(Math.random()*70);
    const pool = FAN_OPT.tags.slice().sort(()=>Math.random()-0.5).slice(0,3);
    FAN.brief.tags = pool;
    fanSaveBrief(); renderFan(); buzz(14);
    toast('换了一套设定');
  });

  /* ---- 落笔 ---- */
  const go = $('#fanGo');
  go && go.addEventListener('click', ()=>fanGenerate());

  /* ---- 角色选择面板 ---- */
  const cpClose = $('#cpClose');
  cpClose && cpClose.addEventListener('click', closeFanSheets);
  const cpSearch = $('#cpSearch');
  cpSearch && cpSearch.addEventListener('input', ()=>{ FAN.pickQuery = cpSearch.value; renderCharPick(); });
  const cpAdd = $('#cpCuAdd');
  cpAdd && cpAdd.addEventListener('click', ()=>{
    const n = ($('#cpCuName').value||'').trim();
    const r = ($('#cpCuRole').value||'').trim();
    if(!n){ $('#cpCuName').focus(); toast('先给他一个名字'); return; }
    fanApplyPick(fanCastItem({__custom:true, name:n, role:r}, FAN.pickSlot));
    $('#cpCuName').value = ''; $('#cpCuRole').value = '';
  });

  /* ---- 广场 ---- */
  const sqBack = $('#sqBack');
  sqBack && sqBack.addEventListener('click', popView);
  const sqNew = $('#sqNew');
  sqNew && sqNew.addEventListener('click', ()=>{
    popAllViews();
    switchPage('fan');
    FAN.circleOn = true;
    $('#circSw').classList.add('on');
    $('#circBody').classList.add('on');
    renderFanGoHint();
    setTimeout(()=>{
      const el = $('#pslotA');
      el && el.scrollIntoView({behavior:'smooth', block:'center'});
    }, 420);
  });
  const sqScroll = $('#squareScroll');
  sqScroll && sqScroll.addEventListener('scroll', ()=>{
    $('#pgSquare').classList.toggle('solid', sqScroll.scrollTop > 60);
  });

  /* ---- 圈子详情 ---- */
  const cirBack = $('#cirBack');
  cirBack && cirBack.addEventListener('click', popView);
  const cirScroll = $('#circleScroll');
  cirScroll && cirScroll.addEventListener('scroll', ()=>{
    $('#pgCircle').classList.toggle('solid', cirScroll.scrollTop > 80);
  });
  const cirWrite = $('#cirWrite');
  cirWrite && cirWrite.addEventListener('click', ()=>{
    const c = fanCircle(FAN.curCircleId);
    if(!c) return;
    /* 把圈子的 CP 装回配对台 */
    const cast = c.cast||[];
    FAN.sel.a = cast[0] ? Object.assign({}, cast[0], {side:'A', from:cast[0].key && String(cast[0].key).startsWith('db') ? 'db' : 'custom'}) : null;
    FAN.sel.b = cast[1] ? Object.assign({}, cast[1], {side:'B', from:cast[1].key && String(cast[1].key).startsWith('db') ? 'db' : 'custom'}) : null;
    FAN.sel.cast = cast.slice(2).map(x=>Object.assign({}, x, {side:'配角'}));
    /* 补回完整档案，保证人设精准 */
    loadArchiveChars().then(chars=>{
      FAN.chars = chars;
      ['a','b'].forEach(k=>{
        const it = FAN.sel[k];
        if(!it || !it.key || !String(it.key).startsWith('db')) return;
        const id = Number(String(it.key).slice(2));
        const full = chars.find(x=>x.id===id);
        if(full) FAN.sel[k] = fanCastItem(full, k==='a'?'A':'B');
      });
      FAN.sel.cast = FAN.sel.cast.map(it=>{
        if(!it.key || !String(it.key).startsWith('db')) return it;
        const full = chars.find(x=>x.id === Number(String(it.key).slice(2)));
        return full ? fanCastItem(full, '配角') : it;
      });
      FAN.circleOn = true;
      FAN.circleName = c.name; FAN.circleMani = c.mani;
      popAllViews();
      switchPage('fan');
      renderFan();
      toast('人已经装回配对台了');
    });
  });
  const cirRename = $('#cirRename');
  cirRename && cirRename.addEventListener('click', ()=>{
    const c = fanCircle(FAN.curCircleId);
    if(!c) return;
    const v = window.prompt('给这个圈换个名字', c.name);
    if(v == null) return;
    const nm = String(v).trim().slice(0,18);
    if(!nm) return;
    c.name = nm;
    fdbPut(F_CIRCLE, c);
    $('#cirName').textContent = nm;
    $('#cirVpTitle').textContent = nm;
    renderPortal(); renderSquare();
    toast('改好了');
  });
  const cirDel = $('#cirDel');
  cirDel && cirDel.addEventListener('click', ()=>{
    const c = fanCircle(FAN.curCircleId);
    if(!c) return;
    const n = fanCircleWorks(c.id).length;
    askDialog('解散这个圈', `「${c.name}」会从广场消失。圈里的 ${n} 篇稿子会保留下来，只是不再归圈。`, '解散', async ()=>{
      FAN.circles = FAN.circles.filter(x=>x.id!==c.id);
      await fdbDel(F_CIRCLE, c.id);
      const ws = fanCircleWorks(c.id);
      for(const w of ws){ w.circleId = null; await fdbPut(F_WORK, w); }
      popView();
      renderFan(); renderSquare();
      toast('已经解散了');
    });
  });
  const cirMore = $('#cirMore');
  cirMore && cirMore.addEventListener('click', ()=>{
    const c = fanCircle(FAN.curCircleId);
    if(!c) return;
    c.pinned = !c.pinned;
    fdbPut(F_CIRCLE, c);
    FAN.circles.sort((a,b)=>((b.pinned?1:0)-(a.pinned?1:0)) || ((b.createdAt||0)-(a.createdAt||0)));
    renderSquare(); renderPortal();
    toast(c.pinned ? '已置顶到广场最前' : '取消置顶了');
  });

  /* ---- 作品详情 ---- */
  const fwBack = $('#fwBack');
  fwBack && fwBack.addEventListener('click', popView);
  const fwScroll = $('#fanWorkScroll');
  fwScroll && fwScroll.addEventListener('scroll', ()=>{
    $('#pgFanWork').classList.toggle('solid', fwScroll.scrollTop > 60);
  });
  const fwFav = $('#fwFav');
  fwFav && fwFav.addEventListener('click', ()=>{
    const w = fanWork(FAN.curWorkId);
    if(!w) return;
    w.fav = !w.fav;
    fdbPut(F_WORK, w);
    fwFav.style.color = w.fav ? '#C9A24B' : '';
    renderFan();
    toast(w.fav ? '收藏了' : '取消收藏');
  });
  const fwRead = $('#fwRead');
  fwRead && fwRead.addEventListener('click', ()=>openFanReader(FAN.curWorkId, 1));
  const fwMore = $('#fwMore');
  fwMore && fwMore.addEventListener('click', ()=>{
    const w = fanWork(FAN.curWorkId);
    if(w) fanNextChapter(w);
  });
  const fwCopy = $('#fwCopy');
  fwCopy && fwCopy.addEventListener('click', ()=>{
    const w = fanWork(FAN.curWorkId);
    if(!w) return;
    const txt = [`《${w.title}》`, w.sub, fanCpLabel(w.cast), '', w.intro, '']
      .filter(Boolean).join('\n') + '\n\n' +
      (w.chapters||[]).map((c,i)=>`第 ${i+1} 章  ${c.t}\n\n${c.body}`).join('\n\n\n');
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).then(()=>toast('全文已复制')).catch(()=>toast('复制失败'));
    }else{
      const ta = document.createElement('textarea');
      ta.value = txt; ta.style.cssText='position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      try{ document.execCommand('copy'); toast('全文已复制'); }catch(e){ toast('复制失败'); }
      ta.remove();
    }
  });
  const fwToShelf = $('#fwToShelf');
  fwToShelf && fwToShelf.addEventListener('click', async ()=>{
    const w = fanWork(FAN.curWorkId);
    if(!w) return;
    if(!fanChapN(w)){ toast('还没有正文，先写一章'); return; }
    if(state.books.some(b=>b.fanId === w.id)){ toast('这一篇已经在书架上了'); return; }
    const now = Date.now();
    const book = {
      id: uid('fb'), source:'file', shelf:true, fanId:w.id,
      title: w.title, author: fanCpLabel(w.cast) + ' · 同人',
      hook: w.sub||'', desc: w.intro||'',
      tags: (w.tags||[]).slice(0,6),
      total: fanChapN(w), wordsPerChapter: (w.brief&&w.brief.len)||2200,
      read: 0, cat:'serial', fav:false, pinned:false,
      pal: 'iris',
      world:'', protagonist:{}, foil:{}, themes:[], outline:[], openingScene:'',
      form: {}, addedAt: now, lastRead: 0,
      stats:null, comments:null, recos:null,
      toc: (w.chapters||[]).map((c,i)=>({title:c.t||('第 '+(i+1)+' 章'), teaser:''})),
      prefs:[], summaries:{}
    };
    state.books.unshift(book);
    await saveNow();
    for(let i=0;i<w.chapters.length;i++){
      await putChapter(book.id, i+1, {title:w.chapters[i].t, content:w.chapters[i].body, at:Date.now()});
    }
    renderAll();
    toast('已经放进书架了');
  });
  const fwDel = $('#fwDel');
  fwDel && fwDel.addEventListener('click', ()=>{
    const w = fanWork(FAN.curWorkId);
    if(!w) return;
    askDialog('删掉这一篇', `《${w.title}》连同它的 ${fanChapN(w)} 章正文都会消失。`, '删掉', async ()=>{
      FAN.works = FAN.works.filter(x=>x.id!==w.id);
      await fdbDel(F_WORK, w.id);
      popView();
      renderFan(); renderSquare();
      toast('已经删掉了');
    });
  });

  /* ---- 同人阅读器 ---- */
  const fxBack = $('#fxBack');
  fxBack && fxBack.addEventListener('click', ()=>{
    if(FAN.fx.streaming && FAN.fx.abort){ try{ FAN.fx.abort(); }catch(e){} }
    popView();
    const w = fanWork(FAN.fx.workId);
    if(w && state.views[state.views.length-1] === 'pgFanWork') renderFwChapters(w);
  });
  const fxScroll = $('#fxScroll');
  fxScroll && fxScroll.addEventListener('scroll', ()=>{
    const h = fxScroll.scrollHeight - fxScroll.clientHeight;
    const p = h > 0 ? clamp(fxScroll.scrollTop / h * 100, 0, 100) : 0;
    $('#fxProgFill').style.width = p + '%';
  });
  fxScroll && fxScroll.addEventListener('click', e=>{
    if(e.target.closest('button, .rd-act, .sha, .rd-th, .rd-fo, a')) return;
    showFxBars(!FAN.fx.bars);
  });
  const fxGear = $('#fxGear');
  fxGear && fxGear.addEventListener('click', e=>{
    e.stopPropagation();
    $('#fxPanel').classList.toggle('is-on');
  });
  const fxToc = $('#fxToc');
  fxToc && fxToc.addEventListener('click', e=>{ e.stopPropagation(); openFxToc(); });
  const fxTocClose = $('#fxTocClose');
  fxTocClose && fxTocClose.addEventListener('click', closeFanSheets);

  const step = (key, d, min, max, fix)=>{
    state.rd[key] = clamp(Number((Number(state.rd[key]) + d).toFixed(2)), min, max);
    saveReaderPrefs(); applyFx(); applyRd && applyRd();
  };
  $('#fxSizeMinus') && $('#fxSizeMinus').addEventListener('click', ()=>step('size',-1,13,26));
  $('#fxSizePlus')  && $('#fxSizePlus').addEventListener('click',  ()=>step('size', 1,13,26));
  $('#fxLeadMinus') && $('#fxLeadMinus').addEventListener('click', ()=>step('lead',-0.1,1.5,3));
  $('#fxLeadPlus')  && $('#fxLeadPlus').addEventListener('click',  ()=>step('lead', 0.1,1.5,3));
  $$('#fxThemes .rd-th').forEach(t=>t.addEventListener('click', ()=>{
    state.rd.theme = t.dataset.theme; saveReaderPrefs(); applyFx(); applyRd && applyRd();
  }));
  $$('#fxFonts .rd-fo').forEach(t=>t.addEventListener('click', ()=>{
    state.rd.font = t.dataset.font; saveReaderPrefs(); applyFx(); applyRd && applyRd();
  }));
  const fxRegen = $('#fxRegen');
  fxRegen && fxRegen.addEventListener('click', ()=>{
    const w = fanWork(FAN.fx.workId);
    if(!w) return;
    $('#fxPanel').classList.remove('is-on');
    fanStreamChapter(w, FAN.fx.idx, true);
  });

  /* 拖拽收起 */
  makeDraggable && makeDraggable($('#charPick'));
  makeDraggable && makeDraggable($('#fxTocSheet'));
}

/* =========================================================
   二十八、同人启动
========================================================= */
async function fanBoot(){
  await fanLoad();
  bindFanUI();
  renderFan();
  /* 角色档案在别的页面改了，回来自动刷新缓存 */
  window.addEventListener('storage', e=>{
    if(e.key === 'luna_char_db_update' || e.key === 'luna_characters_updated'){
      _charDb = null;
      loadArchiveChars().then(cs=>{ FAN.chars = cs; if($('#charPick').classList.contains('is-on')) renderCharPick(); });
    }
  });
}