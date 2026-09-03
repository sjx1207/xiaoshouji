/* ═══════════════════════════════════════════════════════════
   回想录 · MEMOIR — core.js
   ═══════════════════════════════════════════════════════════ */
(function () {
'use strict';
const M = {}; window.Memoir = M;

const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
M.$ = $; M.$$ = $$;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
M.uid = uid;

function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
M.esc = esc;

const EMOJI_RE=/[\u{1F000}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{20E3}\u{1F1E6}-\u{1F1FF}]/gu;
const deEmoji = s => String(s==null?'':s).replace(EMOJI_RE,'');
M.deEmoji = deEmoji;

function fmtDate(ts){const d=new Date(ts||Date.now()),p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}.${p(d.getMonth()+1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;}
M.fmtDate = fmtDate;
function fmtClock(s){s=Math.max(0,Math.round(s||0));
  return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
M.fmtClock = fmtClock;
const CJK_NUM = ['零','壹','貳','叁','肆','伍','陸','柒','捌','玖','拾'];
M.cjkNum = n => n<=10 ? CJK_NUM[n] : (n<20 ? '拾'+CJK_NUM[n-10] : String(n));
function firstChar(s){return (String(s||'?').trim()[0]||'?').toUpperCase();}
M.firstChar = firstChar;
M.stripTags = s => String(s||'').replace(/<(script|style)[\s\S]*?<\/\1>/gi,' ')
  .replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();

M.avatarHtml = function(o, cls){
  const img = o && (o.avatar || o.avatarImg);
  const bg  = o && (o.color || o.avatarColor);
  return `<div class="av ${cls||''}"${bg?` style="background:${esc(bg)}"`:''}>${
    img?`<img src="${esc(img)}" alt=""/>`:esc(firstChar(o&&o.name))}</div>`;
};

/* ═══════════ 图标 ═══════════ */
const ICONS = {
  back:'<path d="M15 5 8 12l7 7"/>', chev:'<path d="M9 5l7 7-7 7"/>',
  arrow:'<path d="M5 12h13M12 6l6 6-6 6"/>', plus:'<path d="M12 5v14M5 12h14"/>',
  dots:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  send:'<path d="M4 12l16-8-6 8 6 8-16-8z"/>',
  regen:'<path d="M20 11a8 8 0 1 0-2.3 6.4"/><path d="M20 4v7h-7"/>',
  undo:'<path d="M4 8h11a5 5 0 0 1 0 10H8"/><path d="M8 4L4 8l4 4"/>',
  mode:'<path d="M4 7h16M4 12h10M4 17h13"/>',
  note:'<path d="M5 4h11l4 4v12H5z"/><path d="M9 12h7M9 16h5"/>',
  len:'<path d="M4 6h16M4 12h16M4 18h9"/><path d="M20 15v6"/>',
  play:'<path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/>',
  pause:'<rect x="7" y="5" width="3.6" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.4" y="5" width="3.6" height="14" rx="1" fill="currentColor" stroke="none"/>',
  prev:'<path d="M17 5.5v13L8 12z" fill="currentColor" stroke="none"/><rect x="5.5" y="5.5" width="1.8" height="13" fill="currentColor" stroke="none"/>',
  next:'<path d="M7 5.5v13L16 12z" fill="currentColor" stroke="none"/><rect x="16.7" y="5.5" width="1.8" height="13" fill="currentColor" stroke="none"/>',
  heart:'<path d="M12 20s-7-4.6-7-9.4A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.6C19 15.4 12 20 12 20z"/>',
  cmt:'<path d="M20 15a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/>',
};
function svg(n,w){const p=ICONS[n];return p?`<svg viewBox="0 0 24 24" width="${w||16}" height="${w||16}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`:'';}
M.svg = svg;
function paintIcons(root){$$('[data-svg]',root||document).forEach(el=>{
  const n=el.dataset.svg; if(el.dataset.svgDone===n) return;
  el.innerHTML=svg(n, el.classList.contains('vc')?15:16); el.dataset.svgDone=n;});}
M.paintIcons = paintIcons;

/* ═══════════ 本地数据库 ═══════════ */
const DB='MemoirDB', VER=1, STORES=['presets','archives','entries','meta'];
let _db=null;
function openDB(){return new Promise((res,rej)=>{
  if(_db) return res(_db);
  const r=indexedDB.open(DB,VER);
  r.onupgradeneeded=e=>{const d=e.target.result;
    STORES.forEach(s=>{if(!d.objectStoreNames.contains(s)) d.createObjectStore(s,{keyPath:'id'});});};
  r.onsuccess=e=>{_db=e.target.result;res(_db);};
  r.onerror=()=>rej(new Error('数据库打开失败'));});}
async function dbAll(s){const d=await openDB();return new Promise(r=>{
  const q=d.transaction(s).objectStore(s).getAll();q.onsuccess=()=>r(q.result||[]);q.onerror=()=>r([]);});}
async function dbPut(s,o){const d=await openDB();return new Promise((res,rej)=>{
  const t=d.transaction(s,'readwrite');t.objectStore(s).put(o);
  t.oncomplete=()=>res(o);t.onerror=()=>rej(new Error('写入失败'));});}
async function dbDel(s,id){const d=await openDB();return new Promise(r=>{
  const t=d.transaction(s,'readwrite');t.objectStore(s).delete(id);
  t.oncomplete=()=>r(true);t.onerror=()=>r(false);});}
M.db={all:dbAll,put:dbPut,del:dbDel};

/* ═══════════ Luna 外部库（探测式打开，不写死版本号） ═══════════
   characters.js / user.js 都在运行时提升数据库版本；若这里写死版本
   号，一旦对方版本更高就会抛 VersionError，角色与身份会全部读成空。 */
function openExtProbe(name, store){
  return new Promise((resolve,reject)=>{
    let probe;
    try{ probe = indexedDB.open(name); }catch(e){ return reject(e); }
    probe.onerror = e => reject(e.target.error);
    probe.onsuccess = e => {
      const db = e.target.result;
      if (db.objectStoreNames.contains(store)) return resolve(db);
      const ver = db.version + 1; db.close();
      const up = indexedDB.open(name, ver);
      up.onupgradeneeded = ev => {
        const d = ev.target.result;
        if (!d.objectStoreNames.contains(store))
          d.createObjectStore(store, { keyPath:'id', autoIncrement:true });
      };
      up.onsuccess = ev => resolve(ev.target.result);
      up.onerror   = ev => reject(ev.target.error);
    };
  });
}
async function extAll(name, store){
  try{
    const db = await openExtProbe(name, store);
    if(!db.objectStoreNames.contains(store)) return [];
    const out = await new Promise(r=>{
      const q = db.transaction(store).objectStore(store).getAll();
      q.onsuccess=()=>r(q.result||[]); q.onerror=()=>r([]);
    });
    try{ db.close(); }catch(e){}
    return out;
  }catch(e){ console.warn('[memoir] 读取', name, '失败', e); return []; }
}
M.loadChars      = () => extAll('LunaCharDB','chars');
M.loadIdentities = () => extAll('LunaIdentityDB','identities');
M.loadWorldbook  = () => extAll('LunaWorldBookDB','entries');

/* ═══════════ 生成设置 ═══════════ */
const CFG_KEY='memoir_cfg_v2';
const CFG_DEF={maxTokens:16000,temperature:.92,topP:.95,depth:14,stream:true,
  htmlDepth:3,retryOnCut:true,freq:0.2,pres:0.2};
M.cfgDefault=CFG_DEF;
M.cfg=Object.assign({},CFG_DEF,JSON.parse(localStorage.getItem(CFG_KEY)||'{}'));
M.saveCfg=()=>localStorage.setItem(CFG_KEY,JSON.stringify(M.cfg));

function apiConf(){
  let c={}; try{c=JSON.parse(localStorage.getItem('luna_api_current')||'{}');}catch(e){}
  return{baseUrl:(c.baseUrl||'').replace(/\/+$/,''),apiKey:c.apiKey||'',
         model:localStorage.getItem('luna_api_model')||''};
}
M.apiConf=apiConf;

/* ═══════════ 生成动画幕 ═══════════ */
const GLYPHS=['回','想','录','叙','忆','篇','卷','述'];
let genT=null, genStart=0, genChars=0, genGlyphT=null, lastFeedAt=0;
const STAGES=['建立上下文','读取角色与身份','装配预设','唤起记忆','落笔','推敲字句','装帧排版'];
M.gen={
  open(title, sub){
    $('#genTitle').textContent=title||'正在回想';
    $('#genStage').textContent=sub||STAGES[0];
    $('#genPaper').textContent=''; $('#genChars').textContent='0 字';
    $('#genTok').textContent='上限 '+M.cfg.maxTokens;
    $('#mGen').classList.add('on');
    genStart=Date.now(); genChars=0; lastFeedAt=0;
    clearInterval(genT); clearInterval(genGlyphT);
    let si=0;
    genT=setInterval(()=>{
      const s=(Date.now()-genStart)/1000;
      $('#genTime').textContent=s.toFixed(1)+'s';
      if(genChars===0 && s>1.2 && si<3){ si++; $('#genStage').textContent=STAGES[si]; }
      const idleMs=lastFeedAt?Date.now()-lastFeedAt:Date.now()-genStart;
      if(idleMs>8000){
        const idleS=Math.floor(idleMs/1000);
        $('#genStage').textContent=(genChars>0?'仍在生成，接口响应较慢':'仍在等待接口响应')+'（'+idleS+'s 无新内容）';
      }
    },100);
    let gi=0;
    genGlyphT=setInterval(()=>{gi=(gi+1)%GLYPHS.length;$('#genGlyph').textContent=GLYPHS[gi];},1500);
  },
  stage(t){ const el=$('#genStage'); if(el) el.textContent=t; },
  feed(text){
    genChars=text.length;
    $('#genChars').textContent=genChars+' 字';
    if(genChars>10) $('#genStage').textContent=genChars<400?STAGES[4]:(genChars<1400?STAGES[5]:STAGES[6]);
    const p=$('#genPaper');
    p.textContent=M.stripTags(text).slice(-190);
    lastFeedAt=Date.now();
  },
  close(){ $('#mGen').classList.remove('on'); clearInterval(genT); clearInterval(genGlyphT); },
};

/* ═══════════ AI ═══════════ */
let _abort=null;
M.abortGen=()=>{ if(_abort){ try{_abort.abort();}catch(e){} } };

function sse(chunk, st){
  st.buf+=chunk; let out='';
  const parts=st.buf.split('\n'); st.buf=parts.pop();
  for(const raw of parts){
    const line=raw.trim(); if(!line||!line.startsWith('data:')) continue;
    const d=line.slice(5).trim();
    if(d==='[DONE]'){ st.done=true; continue; }
    try{ const j=JSON.parse(d);
      const c=j.choices&&j.choices[0];
      const dt=c&&(c.delta||c.message);
      if(dt&&typeof dt.content==='string') out+=dt.content;
      if(c&&c.finish_reason) st.finish=c.finish_reason;
    }catch(e){}
  }
  return out;
}

async function chat(messages, opt){
  opt=opt||{};
  const conf=apiConf();
  if(!conf.baseUrl||!conf.apiKey) throw new Error('尚未在「设置 · AI 模型」中配置接口地址与密钥');
  if(!conf.model) throw new Error('尚未选择模型，请到「设置 · AI 模型」中选择');
  const maxTokens=opt.maxTokens||M.cfg.maxTokens;
  const body={model:conf.model,messages,
    temperature:opt.temperature!=null?opt.temperature:M.cfg.temperature,
    top_p:M.cfg.topP,frequency_penalty:M.cfg.freq,presence_penalty:M.cfg.pres,
    max_tokens:maxTokens};

  const run=async(payload,stream,base)=>{
    base=base||'';
    _abort=new AbortController();
    const resp=await fetch(conf.baseUrl+'/chat/completions',{
      method:'POST',
      headers:{'Authorization':'Bearer '+conf.apiKey,'Content-Type':'application/json'},
      body:JSON.stringify(Object.assign({},payload,{stream:!!stream})),
      signal:_abort.signal});
    if(!resp.ok){
      let t=''; try{t=await resp.text();}catch(e){}
      const err=new Error('HTTP '+resp.status+(t?' · '+t.slice(0,220):''));
      err.raw=t; err.status=resp.status; throw err;
    }
    if(!stream){
      const j=await resp.json(); const c=j.choices&&j.choices[0];
      return {text:(c&&c.message&&c.message.content)||'',finish:c&&c.finish_reason};
    }
    const rd=resp.body.getReader(), dec=new TextDecoder('utf-8');
    const st={buf:'',done:false,finish:''}; let text='';
    while(true){
      const {value,done}=await rd.read(); if(done) break;
      const piece=sse(dec.decode(value,{stream:true}),st);
      if(piece){ text+=piece; if(opt.onDelta) opt.onDelta(piece,base+text); }
      if(st.done) break;
    }
    return {text,finish:st.finish};
  };

  let out;
  try{
    out=await run(body, M.cfg.stream && opt.stream!==false);
  }catch(e){
    if(e.name==='AbortError') throw e;
    const raw=String(e.raw||e.message||'');
    if(/max_tokens|max_completion_tokens|unsupported_parameter|unsupported_value/i.test(raw)){
      const b2=Object.assign({},body); delete b2.max_tokens;
      b2.max_completion_tokens=maxTokens;
      if(/temperature/i.test(raw)) delete b2.temperature;
      if(/penalty/i.test(raw)){ delete b2.frequency_penalty; delete b2.presence_penalty; }
      try{ out=await run(b2, M.cfg.stream && opt.stream!==false); }
      catch(e2){ M.gen.stage('接口不支持流式，正在等待完整结果'); out=await run(b2,false); }
    }else if(/stream/i.test(raw)){
      M.gen.stage('接口不支持流式，正在等待完整结果');
      out=await run(body,false);
    }else throw e;
  }

  let text=out.text||'', guard=0;
  while(M.cfg.retryOnCut && out.finish==='length' && guard<2){
    guard++;
    M.gen.stage('内容较长，正在续写');
    const msgs=messages.concat([
      {role:'assistant',content:text.slice(-4000)},
      {role:'user',content:'内容在此处被长度截断。请紧接着继续输出后续部分，不要重复已有内容，不要任何说明文字。'}]);
    const base=text;
    let cont;
    try{
      cont=await run(Object.assign({},body,{messages:msgs}), M.cfg.stream && opt.stream!==false, base);
    }catch(e3){
      M.gen.stage('接口不支持流式，正在等待续写结果');
      cont=await run(Object.assign({},body,{messages:msgs}),false);
    }
    text=base+(cont.text||'');
    if(opt.onDelta) opt.onDelta('',text);
    out.finish=cont.finish;
  }
  _abort=null;
  return deEmoji(text).trim();
}
M.chat=chat;

/* 带动画幕的一次性生成 */
M.generate = async function(messages, opt){
  opt = opt || {};
  M.gen.open(opt.title, opt.sub);
  try{
    const r = await chat(messages, Object.assign({}, opt, {
      onDelta:(d,all)=>{ M.gen.feed(all); if(opt.onDelta) opt.onDelta(d,all); }
    }));
    M.gen.close();
    return r;
  }catch(e){ M.gen.close(); throw e; }
};

function pickHtml(raw){
  let s=String(raw||'').trim();
  const f=s.match(/```(?:html|HTML)?\s*([\s\S]*?)```/);
  if(f) s=f[1].trim();
  s=s.replace(/^<!DOCTYPE[^>]*>/i,'').replace(/<\/?(?:html|head|body)[^>]*>/gi,'').trim();
  return s;
}
M.pickHtml=pickHtml;

function pickJson(raw){
  let s=String(raw||'').trim();
  const f=s.match(/```(?:json)?\s*([\s\S]*?)```/); if(f) s=f[1].trim();
  const a=s.indexOf('{'),b=s.indexOf('[');
  const st=(a<0)?b:(b<0?a:Math.min(a,b));
  if(st>0) s=s.slice(st);
  const en=Math.max(s.lastIndexOf('}'),s.lastIndexOf(']'));
  if(en>-1) s=s.slice(0,en+1);
  try{return JSON.parse(s);}catch(e){}
  try{return JSON.parse(s.replace(/,\s*([}\]])/g,'$1'));}catch(e){}
  return null;
}
M.pickJson=pickJson;

/* ═══════════ 沙盒渲染 ═══════════ */
const FRAME_CSS=`
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{background:transparent;height:auto!important;min-height:0!important;max-height:none!important}
body{font-family:'Noto Sans SC',-apple-system,'PingFang SC',sans-serif;color:#26262d;
  font-size:14px;line-height:2;letter-spacing:.02em;padding:22px 20px 24px;overflow:hidden}
h1,h2,h3,h4{font-family:'Noto Serif SC','Cormorant Garamond',serif;font-weight:600;
  letter-spacing:.18em;color:#101015;line-height:1.4}
h1{font-size:23px;margin:0 0 15px}h2{font-size:19px;margin:22px 0 12px}h3{font-size:16px;margin:17px 0 10px}
p{margin:0 0 14px}
em,i{font-style:italic;color:#4c4c56}
strong,b{font-weight:600;color:#101015}
hr{border:0;height:1px;margin:22px 0;background:linear-gradient(90deg,transparent,rgba(16,16,21,.2),transparent)}
blockquote{margin:15px 0;padding:14px 17px;border-left:2px solid rgba(16,16,21,.24);
  background:rgba(16,16,21,.032);border-radius:0 11px 11px 0;color:#3a3a44;
  font-family:'Noto Serif SC',serif;font-size:14.5px;font-style:italic;line-height:2.05}
ul,ol{margin:0 0 14px 20px}li{margin-bottom:7px}
a{color:#101015;text-decoration:none;border-bottom:1px solid rgba(16,16,21,.3)}
.narr,.narration{font-family:'Noto Serif SC',serif;font-style:italic;color:#54545e;
  font-size:14.5px;letter-spacing:.06em;line-height:2.15}
.line,.dialogue{margin:13px 0;padding:13px 16px;border-radius:15px;position:relative;
  background:linear-gradient(160deg,rgba(255,255,255,.94),rgba(255,255,255,.6));
  border:1px solid rgba(16,16,21,.08);
  box-shadow:0 2px 12px rgba(20,20,30,.05),inset 0 1px 0 #fff}
.speaker,.who{display:inline-block;font-family:'Noto Serif SC',serif;font-size:11px;
  letter-spacing:.2em;color:#7a7a85;margin-bottom:7px}
.card,.panel,.box{position:relative;padding:17px 18px;border-radius:17px;margin:14px 0;overflow:hidden;
  background:linear-gradient(158deg,rgba(255,255,255,.92),rgba(255,255,255,.56));
  border:1px solid rgba(255,255,255,.92);
  box-shadow:0 2px 5px rgba(20,20,30,.05),0 16px 40px rgba(20,20,30,.07),
             inset 0 1px 0 #fff,0 0 0 1px rgba(16,16,21,.07)}
.card::before,.panel::before{content:'';position:absolute;inset:6px;border-radius:12px;
  border:1px solid rgba(16,16,21,.05);pointer-events:none}
.label,.kicker{font-family:'Space Mono',monospace;font-size:7.5px;letter-spacing:.34em;
  color:#a3a3ad;text-transform:uppercase}
.rule{display:flex;align-items:center;gap:9px;margin:20px 0}
.rule::before,.rule::after{content:'';flex:1;height:1px;
  background:linear-gradient(90deg,transparent,rgba(16,16,21,.18),transparent)}
.rule i{width:5px;height:5px;transform:rotate(45deg);background:#a3a3ad}
button,.btn,.choice,.opt{display:block;width:100%;text-align:left;cursor:pointer;margin:10px 0;
  padding:15px 17px;border-radius:14px;font-family:inherit;font-size:13.5px;line-height:1.7;color:#101015;
  background:linear-gradient(160deg,rgba(255,255,255,.95),rgba(255,255,255,.68));
  border:1px solid rgba(16,16,21,.13);position:relative;
  box-shadow:0 2px 9px rgba(20,20,30,.06),inset 0 1px 0 #fff;
  transition:transform .2s cubic-bezier(.32,.72,0,1),box-shadow .22s,background .22s}
button:active,.btn:active,.choice:active,.opt:active{transform:scale(.978);background:#fff}
button.dark,.btn.dark{background:linear-gradient(160deg,#2c2c35,#0e0e14);color:#f4f4f7;
  border-color:transparent;box-shadow:0 12px 28px rgba(14,14,20,.28)}
button[disabled]{opacity:.4;pointer-events:none}
input,textarea,select{width:100%;padding:13px 15px;border-radius:13px;
  border:1px solid rgba(16,16,21,.15);background:rgba(255,255,255,.88);
  font-family:inherit;font-size:13.5px;color:#101015;outline:none;
  box-shadow:inset 0 2px 4px rgba(16,16,21,.05)}
table{width:100%;border-collapse:separate;border-spacing:0;margin:14px 0;border-radius:13px;
  overflow:hidden;border:1px solid rgba(16,16,21,.1)}
th,td{padding:11px 13px;font-size:12.5px;text-align:left;border-bottom:1px solid rgba(16,16,21,.07)}
th{background:rgba(16,16,21,.05);font-weight:600;letter-spacing:.12em;color:#101015}
tr:last-child td{border-bottom:none}
.bar{height:5px;border-radius:3px;background:rgba(16,16,21,.09);overflow:hidden;margin:8px 0}
.bar>i{display:block;height:100%;background:linear-gradient(90deg,#40404b,#13131a)}
.tag,.chip{display:inline-flex;align-items:center;padding:5px 11px;border-radius:8px;font-size:10.5px;
  letter-spacing:.14em;color:#4c4c56;background:rgba(16,16,21,.045);
  border:1px solid rgba(16,16,21,.08);margin:0 6px 6px 0}
img{max-width:100%;border-radius:13px}
::-webkit-scrollbar{width:0;height:0}
`;
const FRAME_JS=`(function(){
var wrap=document.createElement('div');
wrap.id='__mwrap';
while(document.body.firstChild)wrap.appendChild(document.body.firstChild);
document.body.appendChild(wrap);
var lastH=0,stableN=0;
function measure(){return Math.ceil(wrap.getBoundingClientRect().height);}
function rp(){
  var h=measure();
  if(h!==lastH){ lastH=h; stableN=0; parent.postMessage({__m:'h',h:h},'*'); }
  else if(stableN<3){ stableN++; }
}
var t;function ping(){clearTimeout(t);t=setTimeout(rp,60);}
window.addEventListener('load',ping);
document.addEventListener('click',function(e){ping();
  var el=e.target.closest('[data-send],[data-choice]');
  if(el){var v=el.getAttribute('data-send')||el.getAttribute('data-choice')||el.textContent.trim();
    parent.postMessage({__m:'send',text:v},'*');}},true);
document.addEventListener('input',ping,true);
document.addEventListener('transitionend',ping,true);
if(window.ResizeObserver)new ResizeObserver(function(){ if(stableN<3) ping(); }).observe(wrap);
ping();})();`;

M.renderFrame=function(holder, body){
  const f=document.createElement('iframe');
  f.setAttribute('sandbox','allow-scripts allow-popups');
  f.setAttribute('scrolling','no');
  f.style.height='140px';
  f.srcdoc=`<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Noto+Serif+SC:wght@300;400;500;600&family=Noto+Sans+SC:wght@300;400;500&family=Space+Mono&display=swap" rel="stylesheet">
<style>${FRAME_CSS}</style></head><body>${body}<script>${FRAME_JS}<\/script></body></html>`;
  holder.appendChild(f);
  return f;
};
window.addEventListener('message',e=>{
  const d=e.data; if(!d||(d.__m!=='h'&&d.__m!=='send')) return;
  const src=$$('iframe').find(f=>f.contentWindow===e.source); if(!src) return;
  if(d.__m==='h'){ const h=Math.min(Math.max(d.h+4,90),24000);
    if(Math.abs(parseInt(src.style.height)-h)>2) src.style.height=h+'px'; }
  else if(M.onFrameSend) M.onFrameSend(String(d.text||'').slice(0,600),src);
});

/* ═══════════ 路由 ═══════════ */
const stack=[]; let current=null;
M.stack=stack;
M.nav=function(name,data){
  const next=$(`.view[data-view="${name}"]`);
  if(!next||current===next) return;
  for(let i=stack.length-1;i>=0;i--) if(stack[i].el===next) stack.splice(i,1);
  if(current){ current.classList.remove('active'); current.classList.add('behind');
    stack.push({el:current,name:current.dataset.view}); }
  next.classList.remove('behind'); void next.offsetWidth; next.classList.add('active');
  const sc=$('.scroll',next)||$('.play-scroll',next);
  if(sc&&!(data&&data.keepScroll)) sc.scrollTop=0;
  current=next; M.currentView=name; paintIcons(next);
  if(name==='home'&&M.HomeTab) requestAnimationFrame(()=>M.HomeTab.initGlass());
};
M.back=function(){
  const prev=stack.pop();
  if(!prev) return M.exit();
  if(M.onLeave) M.onLeave(M.currentView);
  if(current) current.classList.remove('active');
  prev.el.classList.remove('behind'); void prev.el.offsetWidth; prev.el.classList.add('active');
  current=prev.el; M.currentView=prev.name;
  if(prev.name==='home'&&M.HomeTab) requestAnimationFrame(()=>M.HomeTab.initGlass());
};
M.resetTo=function(name){
  stack.length=0;
  const t=$(`.view[data-view="${name}"]`);
  $$('.view').forEach(v=>{ if(v!==t){v.classList.remove('active');v.classList.add('behind');} });
  t.classList.remove('behind'); void t.offsetWidth; t.classList.add('active');
  current=t; M.currentView=name;
  if(name==='home'&&M.HomeTab) requestAnimationFrame(()=>M.HomeTab.initGlass());
};
M.exit=function(){
  document.body.style.transition='opacity .3s ease';
  document.body.style.opacity='0';
  setTimeout(()=>location.href='index.html',280);
};

/* ═══════════ 弹层 ═══════════ */
const mask=()=>$('#mSheetMask');
let sheetRes=null;
function closeSheet(v){ mask().classList.remove('on');
  const r=sheetRes; sheetRes=null; if(r) setTimeout(()=>r(v),10); }
M.closeSheet=closeSheet;

M.sheet=function(o){
  o=o||{};
  return new Promise(resolve=>{
    if(sheetRes) closeSheet(null);
    sheetRes=resolve;
    $('#mSheetTitle').textContent=o.title||'';
    $('#mSheetDesc').textContent=o.desc||'';
    const body=$('#mSheetBody'), foot=$('#mSheetFoot');
    body.innerHTML=''; foot.innerHTML='';
    let sel=o.multi?(o.selected?o.selected.slice():[]):(o.selected!=null?o.selected:null);
    if(o.html) body.innerHTML=o.html;
    if(o.options) body.innerHTML+=o.options.map(x=>`
      <div class="opt ${x.danger?'danger':''} ${o.multi?(sel.includes(x.id)?'on':''):(sel===x.id?'on':'')}" data-oid="${esc(x.id)}">
        ${o.plain?'':'<div class="opt-mark"></div>'}
        <div class="opt-b"><div class="opt-t">${esc(x.title)}</div>
        ${x.desc?`<div class="opt-d">${esc(x.desc)}</div>`:''}</div>
        ${x.right?`<div class="tagpill">${esc(x.right)}</div>`:''}
      </div>`).join('');
    if(o.input){
      const i=o.input;
      body.innerHTML+=`<div class="field" style="margin-top:${o.options?'16px':'2px'}">
        ${i.label?`<div class="field-label">${esc(i.label)}</div>`:''}
        ${i.multiline
          ?`<textarea class="txa" id="mSheetInput" placeholder="${esc(i.placeholder||'')}">${esc(i.value||'')}</textarea>`
          :`<input class="inp" id="mSheetInput" placeholder="${esc(i.placeholder||'')}" value="${esc(i.value||'')}"/>`}
      </div>`;
    }
    const needOk=o.input||o.multi||o.okText||o.confirm;
    foot.innerHTML=(o.hideCancel?'':`<div class="btn ghost" data-sheet="cancel">${esc(o.cancelText||'取消')}</div>`)+
      (needOk?`<div class="btn dark" data-sheet="ok">${esc(o.okText||'确认')}</div>`:'');
    body.onclick=ev=>{
      const el=ev.target.closest('.opt'); if(!el) return;
      const id=el.dataset.oid;
      if(o.multi){ const at=sel.indexOf(id); at>-1?sel.splice(at,1):sel.push(id); el.classList.toggle('on'); }
      else{ $$('.opt',body).forEach(x=>x.classList.remove('on')); el.classList.add('on'); sel=id;
        if(!needOk) setTimeout(()=>closeSheet(id),180); }
    };
    foot.onclick=ev=>{
      const b=ev.target.closest('[data-sheet]'); if(!b) return;
      if(b.dataset.sheet==='cancel') return closeSheet(null);
      if(o.input){ const v=$('#mSheetInput').value.trim();
        if(o.requireInput&&!v){ $('#mSheetInput').focus(); return; }
        return closeSheet(o.options?{value:v,id:sel}:v); }
      closeSheet(o.multi?sel:(sel!=null?sel:true));
    };
    mask().classList.add('on');
    if(o.input&&o.focus!==false) setTimeout(()=>{const e2=$('#mSheetInput'); if(e2) e2.focus();},400);
  });
};
mask().addEventListener('click',e=>{ if(e.target===mask()) closeSheet(null); });

M.confirm=(t,d,ok)=>M.sheet({title:t,desc:d,confirm:true,okText:ok||'确认'}).then(v=>!!v);
M.alert=(t,d)=>M.sheet({title:t,desc:d,hideCancel:true,okText:'知道了',confirm:true});
M.prompt=(t,o)=>M.sheet(Object.assign({title:t,input:{multiline:false},requireInput:true},o||{}));

let toastT=null;
M.toast=(msg,ms)=>{ const t=$('#mToast');
  $('#mToastTxt').textContent=deEmoji(msg); t.classList.add('on');
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('on'),ms||2200); };

/* ═══════════ 系统同步 ═══════════ */
function tickClock(){ const d=new Date();
  const el=$('#statusTime'); if(el) el.textContent=d.getHours()+':'+String(d.getMinutes()).padStart(2,'0'); }
function applyIsland(){
  const on=localStorage.getItem('luna_island_enabled')==='true';
  const style=localStorage.getItem('luna_island_style')||'minimal';
  const el=$('#statusIsland'); if(!el) return;
  if(!on){ el.innerHTML=''; return; }
  const map={minimal:'<div class="si-minimal"><div class="si-capsule"></div></div>',
    glow:'<div class="si-glow"><div class="si-capsule"></div></div>',
    clock:'<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="siClockText">--:--</span></div></div>'};
  el.innerHTML=map[style]||map.minimal;
  if(style==='clock'){ const t=()=>{const x=$('#siClockText'); if(x){const n=new Date();
    x.textContent=n.getHours()+':'+String(n.getMinutes()).padStart(2,'0');}};
    t(); clearInterval(window._mIsl); window._mIsl=setInterval(t,10000); }
}
function tickBattery(){ if(!navigator.getBattery) return;
  navigator.getBattery().then(b=>{ const p=Math.round(b.level*100);
    const e1=$('#batPct'); if(e1) e1.textContent=p;
    const e2=$('#batInner'); if(e2) e2.style.width=Math.max(6,p)+'%'; }).catch(()=>{}); }
async function applyWallpaper(){
  try{
    const db=await new Promise((res,rej)=>{const r=indexedDB.open('LunaWallpaperDB');
      r.onsuccess=e=>res(e.target.result); r.onerror=()=>rej();});
    if(!db.objectStoreNames.contains('data')) return;
    const data=await new Promise(r=>{const q=db.transaction('data').objectStore('data').get('applied');
      q.onsuccess=()=>r(q.result?q.result.value:null); q.onerror=()=>r(null);});
    const layer=$('#mBgWall'); if(!layer) return;
    layer.innerHTML='';
    if(!data||!data.dataUrl) return;
    if(data.kind==='video'){ const v=document.createElement('video');
      v.src=data.dataUrl;v.autoplay=v.loop=v.muted=v.playsInline=true;
      layer.appendChild(v); v.play().catch(()=>{}); }
    else{ const i=document.createElement('img'); i.src=data.dataUrl; layer.appendChild(i); }
  }catch(e){}
}
async function applyFont(){
  const name=localStorage.getItem('luna_font_active_name');
  const id=parseInt(localStorage.getItem('luna_font_active_id'));
  if(!name||!id) return;
  try{
    const db=await openExtProbe('LunaFontDB','fonts');
    const all=await new Promise(r=>{const q=db.transaction('fonts').objectStore('fonts').getAll();
      q.onsuccess=()=>r(q.result||[]); q.onerror=()=>r([]);});
    const f=all.find(x=>x.id===id); if(!f) return;
    const face=new FontFace(name,`url(${f.data})`);
    await face.load(); document.fonts.add(face);
    let tag=$('#memoir-font');
    if(!tag){tag=document.createElement('style');tag.id='memoir-font';document.head.appendChild(tag);}
    tag.textContent=`body,.inp,.txa,#playInput{font-family:'${name}','Noto Sans SC',sans-serif !important}`;
  }catch(e){}
}

M.pickImage=function(maxW){
  return new Promise(resolve=>{
    const inp=$('#mFileInput'); inp.value='';
    inp.onchange=()=>{
      const f=inp.files&&inp.files[0]; if(!f) return resolve(null);
      const rd=new FileReader();
      rd.onload=ev=>{
        const img=new Image();
        img.onload=()=>{
          const mw=maxW||1400, k=Math.min(1,mw/img.width);
          const cv=document.createElement('canvas');
          cv.width=Math.round(img.width*k); cv.height=Math.round(img.height*k);
          cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
          resolve(cv.toDataURL('image/jpeg',.86));
        };
        img.onerror=()=>resolve(ev.target.result);
        img.src=ev.target.result;
      };
      rd.readAsDataURL(f);
    };
    inp.click();
  });
};

/* ═══════════ 角色 / 身份 上下文 ═══════════ */
M.charBlock=function(c){
  if(!c) return '';
  const L=[],add=(k,v)=>{if(v&&String(v).trim())L.push(`${k}：${String(v).trim()}`);};
  add('姓名',c.name); add('身份职业',c.role); add('性别',c.gender); add('年龄',c.age);
  add('生日',c.birthday); add('种族设定',c.species);
  add('外貌',c.appearance); add('常穿着装',c.outfit); add('核心描述',c.desc);
  if(Array.isArray(c.traits)&&c.traits.length) add('性格特质',c.traits.join('、'));
  if(Array.isArray(c.likes)&&c.likes.length) add('喜欢',c.likes.join('、'));
  if(Array.isArray(c.dislikes)&&c.dislikes.length) add('厌恶',c.dislikes.join('、'));
  add('恐惧',c.fears); add('说话方式',c.speechStyle);
  if(Array.isArray(c.catchphrases)&&c.catchphrases.length) add('口头禅',c.catchphrases.join('、'));
  add('使用语言',c.lang); add('背景故事',c.backstory); add('当前处境',c.scenario);
  add('与用户的关系',c.relation); add('对用户的称呼',c.callUser); add('关系细节',c.relationDetail);
  add('开场白',c.firstMes);
  if(Array.isArray(c.dialogExamples)&&c.dialogExamples.length){
    const ex=c.dialogExamples.slice(0,6).map(d=>`  用户：${(d.user||'').trim()}\n  ${c.name}：${(d.char||'').trim()}`).join('\n');
    if(ex.trim()) L.push('对话范例：\n'+ex);
  }
  add('额外提示词',c.prompt);
  return L.join('\n');
};
M.userBlock=function(u){
  if(!u) return '';
  const L=[],add=(k,v)=>{if(v&&String(v).trim())L.push(`${k}：${String(v).trim()}`);};
  add('姓名',u.name); add('身份类型',u.identityType); add('社会身份',u.role);
  add('性别',u.gender); add('生日',u.birthday); add('星座',u.zodiac);
  add('所在地',u.location); add('职业',u.occupation); add('性格',u.personality);
  add('自称',u.selfCall); add('座右铭',u.motto); add('语言',u.lang); add('自我描述',u.desc);
  if(Array.isArray(u.tags)&&u.tags.length) add('标签',u.tags.join('、'));
  if(Array.isArray(u.linkedIdentities)&&u.linkedIdentities.length){
    const r=u.linkedIdentities.map(l=>`${l.name||''}（${l.relation||l.type||'关系'}）`).filter(Boolean).join('、');
    if(r) add('关系网络',r);
  }
  return L.join('\n');
};

M.STYLE_RULES=`
【输出美学与硬性规范 · 必须严格遵守】
1. 绝对禁止使用任何 emoji、颜文字、表情符号，以及星形、心形、音符、对勾、雪花之类的装饰性图形字符。需要标记时只用中文字词、罗马数字、阿拉伯数字或纯文字标签。
2. 配色只允许黑白灰及其之间的浅色过渡。严禁米色、米黄、奶油色、暖棕色，严禁任何高饱和彩色。可用色值：#ffffff #fbfbfc #f4f4f6 #e8e8ec #d6d6dc #a3a3ad #7a7a85 #4c4c56 #26262d #101015 及其半透明形式。
3. 风格必须华丽考究、有层次：多层描边、内高光、柔和阴影、细腻渐变、角括装饰、菱形分隔、细密纹理、衬线标题与宽字距。严禁做成极简线框风——不要只有单薄的 1px 方框和大片留白。
4. 鼓励写 <style> 与 <script> 做出可交互效果（展开、切换、选择、进度、悬浮层等）。不要使用 alert/confirm/prompt，一律自绘 CSS 弹层。
5. 背景必须透明，不要给最外层设置不透明背景色，以便融入 App 的全局背景。
6. 只输出 HTML 片段本身（可含 style/script），不要 DOCTYPE、html、head、body 标签，不要 markdown 代码围栏，不要任何解释性前后缀。
7. 中文正文用无衬线，标题与引文可用衬线；正文行高不低于 1.9。
8. 内容必须充实、有细节、有画面感，不要敷衍或写成大纲。
9. 渲染环境为沙箱 iframe：禁止使用 localStorage、sessionStorage、cookie、fetch 与任何外部资源。所有效果由内联 CSS 与 JS 自给自足。需要"图片"时用带渐变与纹理的色块配文字说明代替。
`.trim();

/* ═══════════ 事件总线 ═══════════ */
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-act]'); if(!el) return;
  const h=M.actions[el.dataset.act];
  if(h){ e.preventDefault(); h(el,e); }
});
M.actions={
  back:()=>M.back(),
  exit:()=>M.exit(),
  'gen-cancel':()=>{ M.abortGen(); M.gen.close(); M.toast('已中止生成'); },
};

/* ═══════════ 首页 ═══════════ */
M.DERV={
  vlog :{name:'浮光',en:'FLOATING LIGHT',d:'把剧情演成一帧一帧的影像',seal:'影'},
  qa   :{name:'叩问',en:'INQUIRY',       d:'向剧情本身提出问题',      seal:'问'},
  if   :{name:'歧路',en:'DIVERGENCE',    d:'如果那一刻走了另一条',    seal:'岐'},
  feed :{name:'回声',en:'ECHOES',        d:'角色们在动态里的后续',    seal:'声'},
  mind :{name:'心迹',en:'INNER LEAVES',  d:'角色未曾说出口的独白',    seal:'心'},
  chron:{name:'年谱',en:'CHRONICLE',     d:'把一切按时间排成一条线',  seal:'谱'},
  relic:{name:'物证',en:'RELICS',        d:'故事里留下来的那些东西',  seal:'物'},
};

M.Home={
  async render(){
    const [arcs,pres,ents]=await Promise.all([dbAll('archives'),dbAll('presets'),dbAll('entries')]);
    const scenes=ents.filter(e=>e.type==='scene').length;
    const derv=ents.filter(e=>e.type!=='scene').length;
    $('#homeStats').innerHTML=[['存档',arcs.length],['剧情',scenes],['衍生',derv],['预设',pres.length]]
      .map(([l,n])=>`<div class="stat"><div class="stat-n">${n}</div><div class="stat-l">${l}</div></div>`).join('');
    $('#slabArc').textContent=arcs.length?`共 ${arcs.length} 卷 · ${scenes} 段`:'尚未立卷';
    $('#slabPre').textContent=pres.length?`共 ${pres.length} 条 · ${new Set(pres.map(p=>p.cat)).size} 类`:'尚未建立';
    $('#homeSeals').innerHTML=['回','想','录'].map((c,i)=>
      `<div class="seal ${i===2?'':'open'}">${c}</div>`).join('');
    $('#homeDerv').innerHTML=Object.keys(M.DERV).map(k=>{
      const d=M.DERV[k], n=ents.filter(e=>e.type===k).length;
      return `<div class="dcell" data-act="d-${k}">
        <div class="dcell-seal">${d.seal}</div>
        <div class="dcell-en">${d.en}</div>
        <div class="dcell-t"><b>${d.name}</b><span>${n||''}</span></div>
        <div class="dcell-d">${d.d}</div></div>`;
    }).join('');
    const c=apiConf();
    $('#rowCfgVal').textContent=c.model?(c.model.length>18?c.model.slice(0,18)+'…':c.model):'未配置接口';
    const chars=await M.loadChars(), ids=await M.loadIdentities();
    $('#gateMeta').innerHTML=`<span>角色书 ${chars.length}</span><span>身份档 ${ids.length}</span>`+
      (chars.length?'':'<span>请先创建角色</span>');
  },
};
Object.keys(M.DERV).forEach(k=>{ M.actions['d-'+k]=()=>M.Extras.start(k); });

/* ═══════════ 首页 · 底部导航（正篇 / 衍生 / 其他） ═══════════ */
M.HomeTab=(function(){
  const order=['principal','derivatives','misc'];
  let curIdx=0;

  function placeGlass(idx,animate){
    const tab=$('#homeTab'); if(!tab) return;
    const items=$$('.mtab-item',tab);
    const it=items[idx]; if(!it) return;
    const glass=$('#mtabGlass'); if(!glass) return;
    const tr=tab.getBoundingClientRect(), ir=it.getBoundingClientRect();
    const pad=6;
    const left=ir.left-tr.left+pad, width=ir.width-pad*2;
    if(!animate){ glass.style.transition='none'; }
    glass.style.left=left+'px';
    glass.style.width=width+'px';
    if(!animate){ void glass.offsetWidth; glass.style.transition=''; }
  }

  function go(pane,opts){
    opts=opts||{};
    const idx=order.indexOf(pane); if(idx<0) return;
    const panes=$$('.hpane'); const items=$$('.mtab-item',$('#homeTab'));
    const dir=idx>curIdx?1:(idx<curIdx?-1:0);
    panes.forEach((p,i)=>{
      p.classList.remove('exit-l','exit-r');
      if(i===idx){ p.classList.add('on'); }
      else if(p.classList.contains('on')){
        p.classList.remove('on');
        p.classList.add(dir>=0?'exit-l':'exit-r');
      }
    });
    items.forEach((it,i)=>{
      it.classList.toggle('on',i===idx);
      it.classList.remove('stamp');
      if(i===idx){ void it.offsetWidth; it.classList.add('stamp'); }
    });
    placeGlass(idx,!opts.silent);
    curIdx=idx;
    const sc=panes[idx] && panes[idx].querySelector('.scroll');
    if(sc && !opts.keepScroll) sc.scrollTop=0;
  }

  function initGlass(){ placeGlass(curIdx,false); }

  return{ go, initGlass, get idx(){return curIdx;}, get order(){return order;} };
})();
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-pane-act]'); if(!el) return;
  M.HomeTab.go(el.dataset.paneAct);
});
window.addEventListener('resize',()=>{ if(M.currentView==='home') M.HomeTab.initGlass(); });

/* ═══════════ 说明书 · 册页 ═══════════ */
const MANUAL=[
  {tab:'总览',t:'回想录',en:'HOW IT WORKS',body:`
    <div class="lead">回想录不是聊天工具。它把一次讲述当成一卷可以反复回看、拆解、延展的东西：先立卷，再跑剧情，然后从同一段剧情里长出七种衍生读法。</div>
    <p>一切内容都来自你在「角色」App 里写的角色书，和「身份」App 里写的身份档。这两份资料在所有提示词里都被标为最高优先级——当预设、剧情走向或模型的写作习惯与它们冲突时，一律以它们为准。</p>
    <ol>
      <li><b>立卷</b>：选定一位角色、一个你的身份、若干预设，给这一卷起个名字，上传一张背景。</li>
      <li><b>跑剧情</b>：模型直接生成可交互的页面，你可以点它给出的分支，也可以自由输入。</li>
      <li><b>长出衍生</b>：任何一段剧情（或整卷）都能生成浮光、叩问、歧路、回声、心迹、年谱、物证。</li>
      <li><b>全部归档</b>：衍生内容自动收进对应存档，随时回看。</li>
    </ol>
    <div class="note">接口与模型统一读取「设置 · AI 模型」里保存的配置，这里不需要重复填写。</div>`},
  {tab:'立卷',t:'立卷',en:'NEW RECORD',body:`
    <div class="lead">立卷分四步：择人、定身、选预设、成卷。每一步选中的对象都会被盖上印鉴，你随时能看到自己选了谁。</div>
    <p><b>择人</b>　从角色书里挑一位。选中后卡片会抬起、描边加深、右上角落下一枚印。若角色书是空的，先到「角色」App 建一个。</p>
    <p><b>定身</b>　挑一个你自己的身份档。如果这个身份在「身份」App 里绑定过该角色，系统会自动帮你选中并标注为绑定。角色与身份配好后，下方会出现一条配对确认，显示两者的关系与称呼。</p>
    <p><b>选预设</b>　按类别勾选文风、世界观、视角、剧情、规则等。不选也能开始，模型会依据角色设定自建一套并保持稳定。</p>
    <p><b>成卷</b>　起名、写开场引导（可留空）、上传背景图。背景会同时用在存档卡和详情页头图上。右下角有一张实时预览，成卷之前就能看到这一卷长什么样。</p>`},
  {tab:'剧情',t:'跑剧情',en:'THE SCENE',body:`
    <div class="lead">模型返回的是完整的 HTML，带样式和脚本，在沙箱里渲染成可以点、可以展开的页面，而不是一段纯文本。</div>
    <p><b>四种叙事模式</b>　叙事偏长文沉浸；交互会在结尾给出可点的行动分支；剧本偏镜头与台词，节奏更快；细描放慢时间，专注一个场景里的细节与心理。</p>
    <p><b>三档篇幅</b>　精简、标准、铺陈。会同时影响提示词里的字数要求和实际生成上限。</p>
    <p><b>旁白引导</b>　写给模型的导演指令，不会被当作你的发言写进故事。想让某件事发生、想跳过一段时间，用它。</p>
    <p><b>回退</b>　可以退一回合、退到指定回合，或清空整段。每条生成内容自身也能单独重生成、复制、删除。</p>
    <div class="note">模型写出的按钮，点一下就等于你做出了那个行动，会直接作为你的输入发送。</div>`},
  {tab:'浮光',t:'浮光',en:'FLOATING LIGHT',body:`
    <div class="lead">把一段文字剧情改写成分镜脚本，然后像播放视频那样一帧一帧地放出来。</div>
    <p>模型会给出一串帧，每一帧带有镜头标注和自己的时长。播放器按真实时间轴推进：旁白帧居中、衬线斜体、上方有一道细横线；台词帧是带说话人牌的胶囊，角色一方和你一方的牌子颜色不同；标题帧宽字距居中。</p>
    <p>右侧的轨道是关键——还没播到的字幕是模糊锁定的，播到那一帧才会解锁显示。你可以点已解锁的条目跳过去，但不能提前偷看。</p>
    <p>支持进度条拖动、上一帧下一帧、0.75 到 2 倍速。片长可选约一分钟、两分半或五分钟，影像语气可选电影感、私影像或纪录片。</p>`},
  {tab:'叩问',t:'叩问',en:'INQUIRY',body:`
    <div class="lead">向剧情本身提问，并让它回答。生成的是一组可展开收起的问答卡。</div>
    <p>问题不做复述题，只指向动机、转折、伏笔、没说出口的话、关系的位移。答案必须引用剧情里真实出现过的细节；确实无从判断的地方，会明说那是留白，并给出两种合理的读法。</p>
    <p>角度可选：综合、情感与动机、细节与伏笔，或者由角色本人以第一人称回答——最后这一种语气会完全贴着他的说话方式。</p>`},
  {tab:'歧路',t:'歧路',en:'DIVERGENCE',body:`
    <div class="lead">选定一个瞬间，让故事从那里走上另一条路。只能从单独一段剧情分出，否则分歧就失去了意义。</div>
    <ol>
      <li>模型先勘定这段剧情里真正存在过的三到四个分岔口，说明原本发生了什么、分歧点具体是哪个动作、以及两种可能的走向。</li>
      <li>你挑一个锚点，再挑一条走向，也可以自己写一条。</li>
      <li>系统开出一条独立的歧路存档，用同一套剧情引擎继续跑，可交互、可回退、可无限推进。</li>
    </ol>
    <p>分歧之前发生过的一切依然成立，人物关系与性格不变，只有从那一刻起后果不同。模型被明确要求不许绕回原线的结局。</p>`},
  {tab:'回声',t:'回声',en:'ECHOES',body:`
    <div class="lead">剧情之后，角色们把这段经历发成动态，并且彼此评论。</div>
    <p>形态可选朋友圈式、空间说说式或推文式。主角色一定不止发一条，分布在不同时间点，语气与心境要有变化。</p>
    <p>评论来自谁不是随机的：系统会读角色书里的关系与关系细节、身份档里的关系网络、以及世界书里绑定该角色的条目，只让真实存在的人出现。评论支持二级回复，可以有梗、有试探、有心照不宣，也可以有人问错重点。</p>
    <p>没有真实图片，配图是用文字描述画面内容的色块——这也是刻意的，留白比假图更耐看。你的点赞状态会存回档里。</p>`},
  {tab:'心迹',t:'心迹',en:'INNER LEAVES',body:`
    <div class="lead">角色没说出口的那部分。以他自己的第一人称写成的一叠手记。</div>
    <p>每一页有日期、一个用两三个字概括的心绪、一段独白，以及一句从剧情里摘出来的、当时真实发生过的画面作为脚注。</p>
    <p>独白必须是只有他自己知道的东西：他隐瞒的判断、他误解的部分、他反复回想的那一秒。不能重复叙事已经写过的内容。</p>
    <p>视角可选：只写角色的，只写你的身份的，或者两边交替——交替时同一件事会出现两种互不知情的解读，这是最值得看的一种。</p>`},
  {tab:'年谱',t:'年谱',en:'CHRONICLE',body:`
    <div class="lead">把一整卷（或一段）拆成一条可展开的时间线。</div>
    <p>每个节点有时间、标题、一句概述，点开还有当时的处境、在场者、以及这件事之后改变了什么。真正的关键节点会被标成实心菱形。</p>
    <p>这是整卷视角下最有用的一种衍生：跑久了之后，你会需要它来回答"我们到底是怎么走到这一步的"。</p>`},
  {tab:'物证',t:'物证',en:'RELICS',body:`
    <div class="lead">故事里留下来的那些东西，按博物馆藏品标签的方式列出来。</div>
    <p>每一件有名称、类别标签、来历描述，以及一句从剧情里摘出的相关原话或场景。物件必须是剧情中真实出现过的，不能凭空造。</p>
    <p>一件旧外套、一张没扔的票根、一句被反复提起的话——这些东西往往比情节本身更能说明关系走到哪一步了。</p>`},
  {tab:'预设',t:'预设库',en:'PRESETS',body:`
    <div class="lead">预设是喂给模型的素材，分十类，按类别拼进提示词。</div>
    <p><b>文风</b>叙述语气与修辞密度。<b>世界观</b>时代、地理、体系、禁忌。<b>CHAR 视角</b>角色如何看待世界与你。<b>USER 视角</b>你在故事里的处境与已知未知。<b>剧情</b>主线走向、阶段目标、可触发事件。<b>叙事规则</b>排版结构、每回合信息量、互动方式。<b>补充设定</b>道具组织术语配角。<b>开场</b>可复用的起笔方式。<b>禁忌</b>明确不要出现的东西。<b>格式模板</b>指定 HTML 的结构骨架。</p>
    <p>每条预设可以单独停用而不删除，可以设权重（常规或强调），可以整体导出为文件、也可以从文件导入。长按之外的所有操作都在右上角的菜单里。</p>
    <div class="note">预设里可以写占位符：{{char}} {{user}} {{relation}}，装配时会自动替换成当前这一卷的实际角色名、身份名与关系。</div>`},
];

M.Manual={
  cur:0,
  open(){ M.nav('manual'); this.render(); },
  render(){
    $('#manualSpine').innerHTML=MANUAL.map((m,i)=>
      `<div class="tabv ${i===this.cur?'on':''}" data-mi="${i}">${esc(m.tab)}</div>`).join('');
    const m=MANUAL[this.cur];
    $('#manualLeaf').innerHTML=`<div class="leaf-in">
      <h3>${esc(m.t)}</h3><div class="kick">${esc(m.en)}</div>${m.body}</div>`;
    $('#manualLeaf').scrollTop=0;
    $('#manualSpine').onclick=e=>{
      const t=e.target.closest('.tabv'); if(!t) return;
      this.cur=+t.dataset.mi; this.render();
    };
  },
};
M.actions['manual']=()=>M.Manual.open();
M.actions['start']=()=>M.Archive.openSetup();
M.actions['archives']=()=>{ M.nav('archives'); M.Archive.renderList(); };
M.actions['presets']=()=>{ M.nav('presets'); M.Preset.renderList(); };
M.actions['config']=()=>{ M.nav('config'); M.renderConfig(); };

/* ═══════════ 生成设置 ═══════════ */
M.renderConfig=function(){
  const c=M.cfg,a=apiConf();
  const sl=(id,label,min,max,step,val,fmt)=>`
    <div class="field">
      <div class="field-label">${label}<span class="r" id="${id}Val">${fmt?fmt(val):val}</span></div>
      <div class="slider">
        <div class="slider-track"><div class="slider-fill" id="${id}Fill" style="width:${(val-min)/(max-min)*100}%"></div></div>
        <div class="slider-knob" id="${id}Knob" style="left:${(val-min)/(max-min)*100}%"></div>
        <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"/>
      </div>
    </div>`;
  $('#configBody').innerHTML=`
    <div class="plate" style="padding:20px 18px 8px;margin-bottom:16px">
      <div class="brk tl"></div><div class="brk tr"></div><div class="brk bl"></div><div class="brk br"></div>
      <div class="field-label" style="margin-bottom:14px">当前接口<em>FROM SETTINGS</em></div>
      <div class="row" style="border:none;padding:0 0 13px"><div class="row-t">模型</div><div class="row-v">${esc(a.model||'未选择')}</div></div>
      <div class="row" style="border:none;padding:0 0 16px"><div class="row-t">端点</div><div class="row-v">${esc(a.baseUrl?a.baseUrl.replace(/^https?:\/\//,'').slice(0,26):'未配置')}</div></div>
      <div style="font-size:11px;line-height:1.9;color:var(--ink-5);padding-bottom:16px">接口与模型统一读取「设置 · AI 模型」中保存的配置。</div>
    </div>
    <div class="plate" style="padding:20px 18px 6px">
      <div class="brk tl"></div><div class="brk tr"></div><div class="brk bl"></div><div class="brk br"></div>
      ${sl('cfgTok','单次生成上限<em>MAX TOKENS</em>',2000,64000,1000,c.maxTokens)}
      <div style="font-size:10.5px;line-height:1.85;color:var(--ink-5);margin:-8px 4px 18px">默认 16000，足以容纳带样式与脚本的长 HTML。若模型不支持该参数会自动降级为 max_completion_tokens；若仍被截断会自动续写。</div>
      ${sl('cfgTemp','发挥度<em>TEMPERATURE</em>',0,150,1,Math.round(c.temperature*100),v=>(v/100).toFixed(2))}
      ${sl('cfgDepth','携带历史轮数<em>CONTEXT</em>',2,40,1,c.depth)}
      ${sl('cfgHtml','保留完整 HTML 轮数<em>HTML KEEP</em>',0,8,1,c.htmlDepth)}
      ${sl('cfgFreq','重复抑制<em>FREQUENCY</em>',0,100,5,Math.round(c.freq*100),v=>(v/100).toFixed(2))}
      <div class="row" style="border-top:1px solid var(--hair);padding:16px 0"><div class="row-t">流式输出</div><div class="switch ${c.stream?'on':''}" id="cfgStream"><i></i></div></div>
      <div class="row" style="border:none;padding:0 0 18px"><div class="row-t">截断自动续写</div><div class="switch ${c.retryOnCut?'on':''}" id="cfgRetry"><i></i></div></div>
    </div>
    <div class="divider"><i></i><b></b><b></b><b></b><i></i></div>
    <div class="btn wide ghost" data-act="cfg-reset">恢 复 默 认</div>
    <div style="height:20px"></div>`;
  const bind=(id,fmt)=>{
    const inp=$('#'+id); if(!inp) return;
    const upd=()=>{ const mn=+inp.min,mx=+inp.max,v=+inp.value,p=(v-mn)/(mx-mn)*100;
      $('#'+id+'Fill').style.width=p+'%'; $('#'+id+'Knob').style.left=p+'%';
      $('#'+id+'Val').textContent=fmt?fmt(v):v; };
    inp.addEventListener('input',upd); upd();
  };
  bind('cfgTok'); bind('cfgTemp',v=>(v/100).toFixed(2)); bind('cfgDepth');
  bind('cfgHtml'); bind('cfgFreq',v=>(v/100).toFixed(2));
  ['cfgStream','cfgRetry'].forEach(id=>$('#'+id).onclick=e=>e.currentTarget.classList.toggle('on'));
};
M.actions['cfg-save']=()=>{
  M.cfg.maxTokens=+$('#cfgTok').value;
  M.cfg.temperature=+$('#cfgTemp').value/100;
  M.cfg.depth=+$('#cfgDepth').value;
  M.cfg.htmlDepth=+$('#cfgHtml').value;
  M.cfg.freq=+$('#cfgFreq').value/100;
  M.cfg.pres=M.cfg.freq;
  M.cfg.stream=$('#cfgStream').classList.contains('on');
  M.cfg.retryOnCut=$('#cfgRetry').classList.contains('on');
  M.saveCfg(); M.toast('设置已保存'); M.back(); M.Home.render();
};
M.actions['cfg-reset']=async()=>{
  if(!await M.confirm('恢复默认','所有生成参数会回到出厂值。','恢复')) return;
  M.cfg=Object.assign({},CFG_DEF); M.saveCfg(); M.renderConfig(); M.toast('已恢复默认');
};

/* ═══════════ 启动 ═══════════ */
M.boot=async function(){
  paintIcons();
  tickClock(); setInterval(tickClock,15000);
  applyIsland(); tickBattery(); applyWallpaper(); applyFont();
  window.addEventListener('storage',e=>{
    if(e.key==='luna_wallpaper_update') applyWallpaper();
    if(e.key==='luna_island_update') applyIsland();
    if(e.key==='luna_font_update') applyFont();
  });
  await openDB();
  await M.Preset.init();
  await M.Archive.init();
  M.Play.init(); M.Extras.init();
  M.resetTo('home'); M.Home.render();
  requestAnimationFrame(()=>requestAnimationFrame(()=>M.HomeTab.initGlass()));
  document.addEventListener('keydown',ev=>{
    if(ev.key==='Escape'){ if(sheetRes) closeSheet(null); else M.back(); }
  });
};

})();