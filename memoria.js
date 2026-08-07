/* ==========================================================
   Memoria — 纪念 App
   与 Luna 主系统同步：状态栏 / 灵动岛 / 字体 / 时区 / 角色档案 / 世界书 / API
   ========================================================== */

/* ============ 返回首页（与 characters.js 同款转场） ============ */
function goBack(){
  const mask=document.createElement('div');
  mask.style.cssText='position:fixed;inset:0;background:rgba(251,251,253,0.97);opacity:0;z-index:99999;transition:opacity .28s ease;pointer-events:all;';
  document.body.appendChild(mask);
  requestAnimationFrame(()=>{mask.style.opacity='1';});
  setTimeout(()=>{window.location.href='index.html';},260);
}

/* ============ 状态栏时间 ============ */
function updateTime(){
  const tz=localStorage.getItem('luna_tz')||'Asia/Shanghai';
  const s=new Date().toLocaleTimeString('zh-CN',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false});
  document.querySelectorAll('.status-time').forEach(el=>el.textContent=s);
}

/* ============ 电量 ============ */
function updateBattery(){
  function render(pct){
    const p=Math.round(pct);
    document.querySelectorAll('.bat-pct').forEach(el=>el.textContent=p);
    document.querySelectorAll('.bat-inner').forEach(el=>{
      el.style.width=p+'%';
      el.style.background=p<=20?'linear-gradient(90deg,#f87171,#ef4444)':'linear-gradient(90deg,#6ee7b7,#34d399)';
    });
  }
  if('getBattery' in navigator){
    navigator.getBattery().then(b=>{render(b.level*100);b.addEventListener('levelchange',()=>render(b.level*100));});
  }else render(76);
}

/* ============ 灵动岛 ============ */
function applyIsland(){
  const enabled=localStorage.getItem('luna_island_enabled')==='true';
  const style=localStorage.getItem('luna_island_style')||'minimal';
  const map={
    minimal:`<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:`<div class="si-glow"><div class="si-capsule"></div></div>`,
    clock:`<div class="si-clock"><div class="si-capsule"><span class="si-clock-text">--:--</span></div></div>`,
    pulse:`<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
    ripple:`<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
    rainbow:`<div class="si-rainbow"><div class="si-capsule"></div></div>`,
    music:`<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
    scan:`<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
  };
  document.querySelectorAll('.status-island').forEach(el=>{el.innerHTML=enabled?(map[style]||map.minimal):'';});
  clearInterval(window._siClockTimer);
  if(enabled&&style==='clock'){
    const tick=()=>{const n=new Date();const t=n.getHours()+':'+String(n.getMinutes()).padStart(2,'0');
      document.querySelectorAll('.si-clock-text').forEach(el=>el.textContent=t);};
    tick();window._siClockTimer=setInterval(tick,10000);
  }
}

/* ============ 全局字体同步 ============ */
async function applyGlobalFont(){
  const name=localStorage.getItem('luna_font_active_name');
  const id=parseInt(localStorage.getItem('luna_font_active_id'));
  if(name&&id){
    try{
      const db=await new Promise((res,rej)=>{
        const probe=indexedDB.open('LunaFontDB');
        probe.onupgradeneeded=e=>{if(!e.target.result.objectStoreNames.contains('fonts'))e.target.result.createObjectStore('fonts',{keyPath:'id',autoIncrement:true});};
        probe.onsuccess=e=>{
          const cur=e.target.result,ver=cur.version,has=cur.objectStoreNames.contains('fonts');cur.close();
          const r2=indexedDB.open('LunaFontDB',has?ver:ver+1);
          r2.onupgradeneeded=e2=>{if(!e2.target.result.objectStoreNames.contains('fonts'))e2.target.result.createObjectStore('fonts',{keyPath:'id',autoIncrement:true});};
          r2.onsuccess=e2=>res(e2.target.result);r2.onerror=()=>rej();
        };
        probe.onerror=()=>rej();
      });
      const all=await new Promise(res=>{
        if(!db.objectStoreNames.contains('fonts'))return res([]);
        const r=db.transaction('fonts','readonly').objectStore('fonts').getAll();
        r.onsuccess=()=>res(r.result||[]);r.onerror=()=>res([]);
      });
      const f=all.find(x=>x.id===id);
      if(f){const face=new FontFace(name,`url(${f.data})`);await face.load();document.fonts.add(face);}
    }catch(e){}
  }
  let tag=document.getElementById('luna-font-override');
  if(!tag){tag=document.createElement('style');tag.id='luna-font-override';document.head.appendChild(tag);}
  tag.textContent=name?`body,button,input,textarea{font-family:'${name}',sans-serif !important;}`:'';
}

window.addEventListener('storage',e=>{
  if(e.key==='luna_island_update')applyIsland();
  if(e.key==='luna_tz_update')updateTime();
  if(e.key==='luna_font_update')applyGlobalFont();
  if(e.key==='luna_char_db_update'||e.key==='luna_characters_updated')loadChars().then(()=>{renderCharPickers();});
});

/* ==========================================================
   IndexedDB
   ========================================================== */
const DB_NAME='LunaMemoriaDB', DB_VER=1;
let _mdb=null;
function openDB(){
  if(_mdb)return Promise.resolve(_mdb);
  return new Promise((res,rej)=>{
    const req=indexedDB.open(DB_NAME,DB_VER);
    req.onupgradeneeded=e=>{
      const db=e.target.result;
      if(!db.objectStoreNames.contains('days'))db.createObjectStore('days',{keyPath:'id',autoIncrement:true});
      if(!db.objectStoreNames.contains('essays'))db.createObjectStore('essays',{keyPath:'id',autoIncrement:true});
      if(!db.objectStoreNames.contains('assets'))db.createObjectStore('assets',{keyPath:'key'});
    };
    req.onsuccess=e=>{_mdb=e.target.result;res(_mdb);};
    req.onerror=e=>rej(e.target.error);
  });
}
async function dbAll(store){
  const db=await openDB().catch(()=>null); if(!db)return [];
  return new Promise(res=>{const r=db.transaction(store,'readonly').objectStore(store).getAll();
    r.onsuccess=()=>res(r.result||[]);r.onerror=()=>res([]);});
}
async function dbPut(store,val){
  const db=await openDB().catch(()=>null); if(!db)return null;
  return new Promise(res=>{const s=db.transaction(store,'readwrite').objectStore(store);
    const r=(val.id||val.key)?s.put(val):s.add(val);
    r.onsuccess=()=>res(r.result);r.onerror=()=>res(null);});
}
async function dbDel(store,key){
  const db=await openDB().catch(()=>null); if(!db)return;
  return new Promise(res=>{const r=db.transaction(store,'readwrite').objectStore(store).delete(key);
    r.onsuccess=()=>res();r.onerror=()=>res();});
}
async function dbGet(store,key){
  const db=await openDB().catch(()=>null); if(!db)return null;
  return new Promise(res=>{const r=db.transaction(store,'readonly').objectStore(store).get(key);
    r.onsuccess=()=>res(r.result||null);r.onerror=()=>res(null);});
}

/* ---- 角色档案（只读，来自 LunaCharDB） ---- */
function openCharDB(){
  return new Promise((res,rej)=>{
    const probe=indexedDB.open('LunaCharDB');
    probe.onupgradeneeded=e=>{const d=e.target.result;
      if(!d.objectStoreNames.contains('chars'))d.createObjectStore('chars',{keyPath:'id',autoIncrement:true});};
    probe.onsuccess=e=>{
      const cur=e.target.result,ver=cur.version,has=cur.objectStoreNames.contains('chars');cur.close();
      const r2=indexedDB.open('LunaCharDB',has?ver:ver+1);
      r2.onupgradeneeded=e2=>{const d=e2.target.result;
        if(!d.objectStoreNames.contains('chars'))d.createObjectStore('chars',{keyPath:'id',autoIncrement:true});};
      r2.onsuccess=e2=>res(e2.target.result);r2.onerror=()=>rej();
    };
    probe.onerror=()=>rej();
  });
}
async function getAllChars(){
  try{
    const db=await openCharDB();
    return await new Promise(res=>{
      const r=db.transaction('chars','readonly').objectStore('chars').getAll();
      r.onsuccess=()=>res(r.result||[]);r.onerror=()=>res([]);
    });
  }catch(e){return [];}
}
async function getAllWbEntries(){
  try{
    const db=await new Promise((res,rej)=>{
      const req=indexedDB.open('LunaWorldBookDB',2);
      req.onupgradeneeded=e=>{if(!e.target.result.objectStoreNames.contains('entries'))
        e.target.result.createObjectStore('entries',{keyPath:'id',autoIncrement:true});};
      req.onsuccess=e=>res(e.target.result);req.onerror=()=>rej();
    });
    return await new Promise(res=>{
      const r=db.transaction('entries','readonly').objectStore('entries').getAll();
      r.onsuccess=()=>res(r.result||[]);r.onerror=()=>res([]);
    });
  }catch(e){return [];}
}

/* ==========================================================
   全局状态
   ========================================================== */
let DAYS=[], ESSAYS=[], CHARS=[], WBS=[];
let SET={
  appBgVeil:46, appBgBright:104, density:'normal',
  seconds:true, anim:true, autoBirth:true
};
let curTab='days', curView='days', viewStack=[];
let editing=null;           // 正在编辑的 day 对象
let edState={};             // 编辑器临时状态
let filterCat='all', sortMode='smart', essayFilter='all';
let genSel={charId:null,kind:'both',count:4};
let cpSel={charId:null,dayId:null,mood:'自然',len:'320',skin:'auto'};
let pendingGen=[];

const CATS=['纪念','生日','约定','旅程','节日','学业','工作','其他'];
const TONES=[
  {k:'pearl', g:'linear-gradient(140deg,#FFFFFF,#F1F0F6)'},
  {k:'iris',  g:'linear-gradient(140deg,#F7F4FC,#E8E3F3)'},
  {k:'rose',  g:'linear-gradient(140deg,#FCF6F9,#F2E5EC)'},
  {k:'jade',  g:'linear-gradient(140deg,#F5FAF8,#E3EFEB)'},
  {k:'sky',   g:'linear-gradient(140deg,#F5F8FC,#E4ECF6)'},
  {k:'lilac', g:'linear-gradient(140deg,#FAF7FC,#EDE7F2)'},
];
const SKINS=[
  {k:'paper',   n:'纸笺'},
  {k:'polaroid',n:'拍立得'},
  {k:'ticket',  n:'票根'},
  {k:'letter',  n:'信笺'},
  {k:'film',    n:'胶片'},
  {k:'ribbon',  n:'缎带'},
  {k:'card',    n:'卡纸'},
  {k:'glass',   n:'玻璃'},
];
const WD=['周日','周一','周二','周三','周四','周五','周六'];
const MO=['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];

/* ==========================================================
   工具
   ========================================================== */
const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const pad=n=>String(n).padStart(2,'0');
function midnight(d){const x=new Date(d);x.setHours(0,0,0,0);return x;}
function parseYMD(s){
  if(!s)return null;
  const m=String(s).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if(m)return new Date(+m[1],+m[2]-1,+m[3]);
  const m2=String(s).match(/^(\d{1,2})\D+(\d{1,2})$/);
  if(m2)return new Date(new Date().getFullYear(),+m2[1]-1,+m2[2]);
  const d=new Date(s); return isNaN(d)?null:d;
}
function ymd(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}
function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('show');
  clearTimeout(window._tt);window._tt=setTimeout(()=>t.classList.remove('show'),2100);
}

/* 计算日子状态 */
function calc(item){
  const now=new Date();
  const today=midnight(now);
  const base=parseYMD(item.date)||today;
  const r={};
  r.base=base;
  if(item.type==='countdown'){
    let target=new Date(base);
    if(item.repeat==='year'){
      target=new Date(today.getFullYear(),base.getMonth(),base.getDate());
      if(target<today)target.setFullYear(target.getFullYear()+1);
    }else if(item.repeat==='month'){
      target=new Date(today.getFullYear(),today.getMonth(),base.getDate());
      if(target<today)target.setMonth(target.getMonth()+1);
    }else if(item.repeat==='week'){
      target=new Date(today);
      const diff=(base.getDay()-today.getDay()+7)%7;
      target.setDate(target.getDate()+diff);
    }
    r.target=target;
    r.days=Math.round((midnight(target)-today)/86400000);
    r.past=r.days<0; r.today=r.days===0;
    // 进度：以「上一次周期起点 / 创建时间」到目标的跨度
    let start;
    if(item.repeat==='year')start=new Date(target.getFullYear()-1,target.getMonth(),target.getDate());
    else if(item.repeat==='month'){start=new Date(target);start.setMonth(start.getMonth()-1);}
    else if(item.repeat==='week'){start=new Date(target);start.setDate(start.getDate()-7);}
    else start=midnight(new Date(item.createdAt||base));
    const span=Math.max(1,(midnight(target)-midnight(start))/86400000);
    r.progress=Math.max(0,Math.min(1,(span-r.days)/span));
    r.sortKey=r.days<0?9e6+Math.abs(r.days):r.days;
  }else{
    r.days=Math.round((today-midnight(base))/86400000);
    r.future=r.days<0; r.today=r.days===0;
    r.years=Math.floor(Math.abs(r.days)/365.2425*1000)/1000;
    // 周年
    let y=today.getFullYear()-base.getFullYear();
    const anniThis=new Date(today.getFullYear(),base.getMonth(),base.getDate());
    if(anniThis>today)y-=1;
    r.wholeYears=Math.max(0,y);
    let next=new Date(today.getFullYear(),base.getMonth(),base.getDate());
    if(next<today)next.setFullYear(next.getFullYear()+1);
    r.toNextAnni=Math.round((next-today)/86400000);
    r.sortKey=r.toNextAnni;
  }
  const ms=Math.abs((item.type==='countdown'?r.target:base)-now);
  r.h=Math.floor(ms/3600000)%24; r.m=Math.floor(ms/60000)%60; r.s=Math.floor(ms/1000)%60;
  r.totalHours=Math.floor(ms/3600000);
  return r;
}

function relPhrase(item){
  const c=calc(item);
  if(item.type==='countdown'){
    if(c.today)return '就是今天';
    if(c.past)return `已过去 ${Math.abs(c.days)} 天`;
    return `还有 ${c.days} 天`;
  }
  if(c.today)return '就是今天';
  if(c.future)return `尚未到来，还有 ${Math.abs(c.days)} 天`;
  return `已经过去 ${c.days} 天`;
}

/* ==========================================================
   导航
   ========================================================== */
const VIEW_TITLE={
  days:['ARCHIVE OF DAYS','纪念'],
  essay:['QUIET ESSAYS','随笔'],
  editor:['COMPOSE A DAY','编辑'],
  gen:['WRITTEN BY THEM','执笔'],
  compose:['ASK FOR AN ESSAY','约稿'],
  detail:['A SINGLE DAY','详情'],
  read:['FULL TEXT','全文'],
  settings:['PREFERENCES','偏好'],
};
function go(v,push=true){
  if(v===curView)return;
  if(push&&curView)viewStack.push(curView);
  curView=v;
  document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
  const el=document.getElementById('v-'+v); if(el)el.classList.add('active');
  const t=VIEW_TITLE[v]||['',''];
  document.getElementById('tbEyebrow').textContent=t[0];
  document.getElementById('tbName').textContent=t[1];
  if(v==='days'||v==='essay'){
    curTab=v; viewStack=[];
    document.querySelectorAll('.dock-i').forEach(b=>b.classList.toggle('active',b.dataset.tab===v));
  }
  const sc=el&&el.querySelector('.scroll'); if(sc)sc.scrollTop=0;
  if(v==='gen'){renderCharGrid('genCharGrid','gen');}
  if(v==='compose'){renderCharGrid('cpCharGrid','cp');renderCpDays();renderSkinRow();}
  if(v==='settings'){renderApiFace();}
  closeFab();
}
function onBack(){
  if(viewStack.length){
    const prev=viewStack.pop();
    go(prev,false);
  }else if(curView!=='days'&&curView!=='essay'){
    go(curTab,false);
  }else goBack();
}

/* ==========================================================
   数据加载
   ========================================================== */
async function loadAll(){
  DAYS=await dbAll('days');
  ESSAYS=await dbAll('essays');
  await loadChars();
  renderDays();renderEssays();renderCharPickers();
}
async function loadChars(){
  CHARS=await getAllChars();
  WBS=await getAllWbEntries();
}

/* ==========================================================
   设置
   ========================================================== */
function loadSettings(){
  try{SET=Object.assign(SET,JSON.parse(localStorage.getItem('memoria_set')||'{}'));}catch(e){}
  document.body.dataset.density=SET.density;
  document.body.dataset.anim=SET.anim?'on':'off';
  document.getElementById('sSeconds').classList.toggle('on',SET.seconds);
  document.getElementById('sAnim').classList.toggle('on',SET.anim);
  document.getElementById('sAutoBirth').classList.toggle('on',SET.autoBirth);
  document.getElementById('sBgVeil').value=SET.appBgVeil;
  document.getElementById('sBgVeilVal').textContent=SET.appBgVeil+'%';
  document.getElementById('sBgBright').value=SET.appBgBright;
  document.getElementById('sBgBrightVal').textContent=SET.appBgBright+'%';
  document.querySelectorAll('#sDensity .pill').forEach(p=>p.classList.toggle('active',p.dataset.v===SET.density));
}
function saveSettings(){
  SET.seconds=document.getElementById('sSeconds').classList.contains('on');
  SET.anim=document.getElementById('sAnim').classList.contains('on');
  SET.autoBirth=document.getElementById('sAutoBirth').classList.contains('on');
  SET.appBgVeil=+document.getElementById('sBgVeil').value;
  SET.appBgBright=+document.getElementById('sBgBright').value;
  localStorage.setItem('memoria_set',JSON.stringify(SET));
  document.body.dataset.anim=SET.anim?'on':'off';
  applyAppBg();
}
async function applyAppBg(){
  const layer=document.getElementById('appBgLayer');
  const veil=document.getElementById('appBgVeil');
  const rec=await dbGet('assets','appbg');
  if(rec&&rec.data){
    layer.style.backgroundImage=`url(${rec.data})`;
    layer.style.filter=`brightness(${SET.appBgBright}%)`;
    veil.style.opacity=(SET.appBgVeil/100).toString();
    document.getElementById('sBgPrev').style.backgroundImage=`url(${rec.data})`;
    document.getElementById('sBgPrev').innerHTML='';
  }else{
    layer.style.backgroundImage='';veil.style.opacity='0';
    document.getElementById('sBgPrev').style.backgroundImage='';
    document.getElementById('sBgPrev').innerHTML='<span class="up-empty">未设置</span>';
  }
}
async function clearAppBg(){await dbDel('assets','appbg');applyAppBg();toast('已恢复默认背景');}

/* ==========================================================
   渲染：纪念日 / 倒数日 列表
   ========================================================== */
function renderFilterChips(){
  const box=document.getElementById('filterChips');
  const all=[{v:'all',n:'全部'},{v:'anniversary',n:'纪念日'},{v:'countdown',n:'倒数日'},{v:'pin',n:'置顶'}]
    .concat(CATS.map(c=>({v:'cat:'+c,n:c})));
  box.innerHTML=all.map(x=>`<button class="chip${filterCat===x.v?' on':''}" data-v="${x.v}">${esc(x.n)}</button>`).join('');
  box.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{filterCat=b.dataset.v;renderFilterChips();renderDays();});
}

function matchFilter(d){
  if(filterCat==='all')return true;
  if(filterCat==='pin')return !!d.pin;
  if(filterCat==='anniversary'||filterCat==='countdown')return d.type===filterCat;
  if(filterCat.startsWith('cat:'))return d.cat===filterCat.slice(4);
  return true;
}

function renderDays(){
  const q=(document.getElementById('searchInput').value||'').trim().toLowerCase();
  let list=DAYS.filter(d=>{
    if(!matchFilter(d))return false;
    if(!q)return true;
    return [d.title,d.note,d.cat,(d.tags||[]).join(' '),charName(d.charId)].join(' ').toLowerCase().includes(q);
  });
  list.sort((a,b)=>{
    if((b.pin?1:0)!==(a.pin?1:0))return (b.pin?1:0)-(a.pin?1:0);
    if(sortMode==='smart')return calc(a).sortKey-calc(b).sortKey;
    if(sortMode==='date')return (parseYMD(b.date)||0)-(parseYMD(a.date)||0);
    if(sortMode==='new')return (b.createdAt||0)-(a.createdAt||0);
    if(sortMode==='title')return String(a.title).localeCompare(String(b.title),'zh');
    return 0;
  });

  // 统计
  document.getElementById('statTotal').textContent=DAYS.length;
  document.getElementById('statAnniv').textContent=DAYS.filter(d=>d.type==='anniversary').length;
  document.getElementById('statCount').textContent=DAYS.filter(d=>d.type==='countdown').length;
  const upcoming=DAYS.map(d=>({d,c:calc(d)}))
    .filter(x=>x.d.type==='countdown'?x.c.days>=0:x.c.toNextAnni>=0)
    .sort((a,b)=>(a.d.type==='countdown'?a.c.days:a.c.toNextAnni)-(b.d.type==='countdown'?b.c.days:b.c.toNextAnni))[0];
  document.getElementById('statNear').textContent=upcoming
    ? (upcoming.d.type==='countdown'?upcoming.c.days:upcoming.c.toNextAnni)+'d' : '—';

  const box=document.getElementById('daysList');
  if(!list.length){
    box.innerHTML=`<div class="empty">
      <div class="empty-ring"><svg viewBox="0 0 24 24" class="ico"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg></div>
      <div class="empty-tx">${DAYS.length?'没有符合条件的日子':'还没有收录任何日子'}</div>
      <div class="empty-sub">${DAYS.length?'换个筛选或清空检索词再看看。':'点右下角新建，或让角色替你写下第一批日子。'}</div>
    </div>`;
    return;
  }
  box.innerHTML=list.map((d,i)=>cardHTML(d,i)).join('');
  box.querySelectorAll('.card').forEach(el=>{
    el.onclick=()=>openDetail(+el.dataset.id);
  });
}

function charName(id){const c=CHARS.find(x=>x.id===id);return c?c.name:'';}
function charAvatar(id){
  const c=CHARS.find(x=>x.id===id); if(!c)return '';
  return c.avatar?`<img src="${c.avatar}" alt=""/>`:esc((c.name||'?')[0]);
}
function toneG(k){const t=TONES.find(x=>x.k===k);return t?t.g:TONES[0].g;}

function cardHTML(d,i){
  const c=calc(d);
  const photo=d.bg?`<div class="card-photo" style="background-image:url(${d.bg})"></div><div class="card-mask"></div>`:'';
  const hasP=d.bg?' has-photo':'';
  const delay=`style="animation-delay:${Math.min(i*45,360)}ms;${d.bg?'':'background:'+toneG(d.tone)}"`;
  const cm=d.charId?`<div class="char-mini"><div class="cm-av">${charAvatar(d.charId)}</div><div class="cm-nm">${esc(charName(d.charId))}</div></div>`:'';
  const pin=d.pin?'<div class="pin-mark"></div>':'';

  if(d.type==='anniversary'){
    const n=Math.abs(c.days);
    const unit=c.future?'DAYS TO GO':'DAYS';
    return `<article class="card anniv${hasP}" data-id="${d.id}" ${delay}>
      ${photo}${pin}
      <div class="card-inner">
        <div class="anniv-side">
          <div class="as-num">${n}</div>
          <div class="as-dot"></div>
          <div class="as-unit">${unit}</div>
        </div>
        <div class="anniv-main">
          <div class="anniv-kicker">
            <span class="ak-tag">SINCE</span>
            <span class="ak-cat">${esc(d.cat||'纪念')}</span>
          </div>
          <div class="anniv-title">${esc(d.title)}</div>
          <div class="anniv-meta">
            <span>${esc(d.date)}</span><i></i>
            <span>${c.wholeYears>0?'第 '+c.wholeYears+' 年':(c.today?'今天':'当年')}</span>
            ${cm?'<i></i>':''}${cm}
          </div>
        </div>
      </div>
      <div class="anniv-engrave">${c.toNextAnni===0?'今日周年':'距周年 '+c.toNextAnni+' 天'}</div>
    </article>`;
  }

  const st=c.today?' today':(c.past?' past':'');
  const n=Math.abs(c.days);
  return `<article class="card count${hasP}${st}" data-id="${d.id}" ${delay}>
    ${photo}${pin}
    <div class="card-inner">
      <div class="count-top">
        <div class="count-label">
          <div class="count-kicker">${c.today?'THE DAY':(c.past?'PASSED':'COUNTDOWN')}</div>
          <div class="count-title">${esc(d.title)}</div>
          <div class="count-date">${esc(ymd(c.target))} · ${WD[c.target.getDay()]}</div>
        </div>
        <div class="count-badge">
          <div class="cb-num">${c.today?'0':n}</div>
          <div class="cb-unit">${c.today?'TODAY':(c.past?'DAYS AGO':'DAYS LEFT')}</div>
        </div>
      </div>
      <div class="count-arc">
        <div class="arc-track"><div class="arc-fill" style="width:${Math.round(c.progress*100)}%"></div></div>
        <div class="arc-ticks"><span>${Math.round(c.progress*100)}%</span><span>${esc(d.cat||'')}</span><span>${d.repeat&&d.repeat!=='none'?({year:'每年',month:'每月',week:'每周'})[d.repeat]:'一次'}</span></div>
      </div>
      <div class="count-sub">
        <span class="cs-chip">${relPhrase(d)}</span>
        ${d.note?`<span class="cs-tx">${esc(String(d.note).slice(0,16))}${String(d.note).length>16?'…':''}</span>`:''}
        ${cm}
      </div>
    </div>
  </article>`;
}

/* ==========================================================
   详情
   ========================================================== */
let _detailId=null,_detailTimer=null;
function openDetail(id){
  _detailId=id; go('detail'); renderDetail();
  clearInterval(_detailTimer);
  if(SET.seconds)_detailTimer=setInterval(()=>{if(curView==='detail')renderDetailClock();else clearInterval(_detailTimer);},1000);
}
function renderDetail(){
  const d=DAYS.find(x=>x.id===_detailId); if(!d)return;
  const c=calc(d);
  const rel=relPhrase(d);
  const linked=ESSAYS.filter(e=>e.dayId===d.id);
  const photo=d.bg?`<div class="dt-photo" style="background-image:url(${d.bg})"></div>
    <div class="dt-mask" style="background:linear-gradient(180deg,rgba(255,255,255,${d.type==='anniversary'?0.90:0.88}),rgba(255,255,255,0.80))"></div>`:'';
  document.getElementById('detailScroll').innerHTML=`
    <div class="dt-hero" style="${d.bg?'':'background:'+toneG(d.tone)}">
      ${photo}
      <div class="dt-in">
        <div class="dt-kick">${d.type==='anniversary'?'ANNIVERSARY':'COUNTDOWN'} · ${esc(d.cat||'')}</div>
        <div class="dt-t">${esc(d.title)}</div>
        <div class="dt-big" id="dtBig">${Math.abs(c.days)}</div>
        <div class="dt-unit">${d.type==='anniversary'?(c.future?'DAYS TO GO':'DAYS PASSED'):(c.today?'TODAY':(c.past?'DAYS AGO':'DAYS LEFT'))}</div>
        <div class="dt-clock" id="dtClock"></div>
      </div>
    </div>

    <div class="dt-acts">
      <button class="solid-btn" onclick="editDay(${d.id})">编辑</button>
      <button class="solid-btn" onclick="composeFor(${d.id})">请角色写随笔</button>
    </div>

    <div class="dt-sec">
      <div class="dt-sec-t">DETAILS</div>
      <div class="dt-panel">
        <div class="dt-kv"><b>日期</b><span>${esc(d.date)}${d.time?' · '+esc(d.time):''}</span></div>
        <div class="dt-kv"><b>星期</b><span>${WD[(parseYMD(d.date)||new Date()).getDay()]}</span></div>
        <div class="dt-kv"><b>状态</b><span>${esc(rel)}</span></div>
        ${d.type==='anniversary'?`<div class="dt-kv"><b>周年</b><span>第 ${c.wholeYears} 年 · 距下次 ${c.toNextAnni} 天</span></div>`:
          `<div class="dt-kv"><b>目标日</b><span>${esc(ymd(c.target))}</span></div>
           <div class="dt-kv"><b>进度</b><span>${Math.round(c.progress*100)}%</span></div>`}
        <div class="dt-kv"><b>重复</b><span>${({none:'不重复',year:'每年',month:'每月',week:'每周'})[d.repeat||'none']}</span></div>
        ${d.charId?`<div class="dt-kv"><b>关联角色</b><span>${esc(charName(d.charId))}</span></div>`:''}
        ${d.source==='ai'?`<div class="dt-kv"><b>来源</b><span>由 ${esc(d.sourceName||'角色')} 执笔生成</span></div>`:''}
        <div class="dt-kv"><b>收录于</b><span>${d.createdAt?new Date(d.createdAt).toLocaleDateString('zh-CN'):'—'}</span></div>
      </div>
    </div>

    ${d.note?`<div class="dt-sec"><div class="dt-sec-t">NOTE</div>
      <div class="dt-panel"><div class="dt-note">${esc(d.note)}</div></div></div>`:''}

    ${(d.tags||[]).length?`<div class="dt-sec"><div class="dt-sec-t">TAGS</div>
      <div class="dt-tags">${d.tags.map(t=>`<span class="tag-i">${esc(t)}</span>`).join('')}</div></div>`:''}

    <div class="dt-sec">
      <div class="dt-sec-t">RELATED ESSAYS · ${linked.length}</div>
      ${linked.length?`<div class="essay-list">${linked.map((e,i)=>noteHTML(e,i)).join('')}</div>`:
        `<div class="dt-panel"><div class="mini-note">还没有为这一天写下的随笔。点上方「请角色写随笔」，让他替这一天落笔。</div></div>`}
    </div>
    <div class="foot-rule"><span>${d.type==='anniversary'?'SINCE':'UNTIL'}</span></div>
  `;
  document.querySelectorAll('#detailScroll .note').forEach(el=>{el.onclick=ev=>{
    if(ev.target.closest('.note-act'))return; openRead(+el.dataset.id);};});
  bindNoteActs('#detailScroll');
  renderDetailClock();
}
function renderDetailClock(){
  const d=DAYS.find(x=>x.id===_detailId); if(!d)return;
  const c=calc(d);
  const box=document.getElementById('dtClock'); if(!box)return;
  const cells=SET.seconds
    ? [[c.totalHours,'HOURS'],[c.m,'MIN'],[c.s,'SEC']]
    : [[Math.abs(c.days),'DAYS'],[c.totalHours%24,'HOURS'],[c.m,'MIN']];
  box.innerHTML=cells.map(x=>`<div class="dt-cl"><b>${pad(x[0])}</b><span>${x[1]}</span></div>`).join('');
  const big=document.getElementById('dtBig'); if(big)big.textContent=Math.abs(c.days);
}
function composeFor(id){cpSel.dayId=id;go('compose');}

/* ==========================================================
   编辑器
   ========================================================== */
function openEditor(type,day){
  closeFab();
  editing=day||null;
  edState={
    type: day?day.type:type,
    date: day?(parseYMD(day.date)||new Date()):new Date(),
    time: day?(day.time||''):'',
    repeat: day?(day.repeat||'none'):'none',
    cat: day?(day.cat||'纪念'):(type==='countdown'?'约定':'纪念'),
    charId: day?(day.charId||null):null,
    tone: day?(day.tone||'pearl'):'pearl',
    bg: day?(day.bg||null):null,
    mask: day?(day.mask==null?34:day.mask):34,
    tags: day?[...(day.tags||[])]:[],
  };
  document.getElementById('fTitle').value=day?day.title:'';
  document.getElementById('fNote').value=day?(day.note||''):'';
  document.getElementById('fTime').value=edState.time;
  document.getElementById('fPin').classList.toggle('on',!!(day&&day.pin));
  document.getElementById('fFeature').classList.toggle('on',day?day.feature!==false:true);
  document.getElementById('edDelete').style.display=day?'':'none';
  document.getElementById('fBgMask').value=edState.mask;
  document.getElementById('fBgMaskVal').textContent=edState.mask+'%';
  syncEditorUI();
  go('editor');
}
function editDay(id){const d=DAYS.find(x=>x.id===id);if(d)openEditor(d.type,d);}

function syncEditorUI(){
  const sw=document.getElementById('edTypeSwitch');
  sw.dataset.type=edState.type;
  sw.querySelectorAll('.ets-i').forEach(b=>b.classList.toggle('active',b.dataset.type===edState.type));
  document.querySelectorAll('#fRepeat .pill').forEach(p=>p.classList.toggle('active',p.dataset.v===edState.repeat));
  document.querySelectorAll('#fCat .pill').forEach(p=>p.classList.toggle('active',p.dataset.v===edState.cat));
  renderDateFace();renderCal();
  renderCharStrip();renderTones();renderTags();
  const prev=document.getElementById('fBgPrev');
  if(edState.bg){prev.style.backgroundImage=`url(${edState.bg})`;prev.innerHTML='';}
  else{prev.style.backgroundImage='';prev.innerHTML='<span class="up-empty">未选择</span>';}
}
function renderDateFace(){
  const d=edState.date;
  document.getElementById('dfY').textContent=d.getFullYear();
  document.getElementById('dfMD').textContent=pad(d.getMonth()+1)+' / '+pad(d.getDate());
  document.getElementById('dfW').textContent=WD[d.getDay()];
}
function renderCharStrip(){
  const box=document.getElementById('fCharStrip');
  if(!CHARS.length){box.innerHTML='<div class="mini-note">角色档案为空。先到「角色档案」创建角色，这里就能关联了。</div>';return;}
  box.innerHTML=`<button class="char-chip${edState.charId===null?' on':''}" data-id="">
      <span class="cc-av">—</span><span class="cc-nm">不关联</span></button>`+
    CHARS.map(c=>`<button class="char-chip${edState.charId===c.id?' on':''}" data-id="${c.id}">
      <span class="cc-av">${c.avatar?`<img src="${c.avatar}" alt=""/>`:esc((c.name||'?')[0])}</span>
      <span class="cc-nm">${esc(c.name)}</span></button>`).join('');
  box.querySelectorAll('.char-chip').forEach(b=>b.onclick=()=>{
    edState.charId=b.dataset.id?+b.dataset.id:null;renderCharStrip();});
}
function renderTones(){
  const box=document.getElementById('fTone');
  box.innerHTML=TONES.map(t=>`<button class="tone-i${edState.tone===t.k?' on':''}" data-k="${t.k}" style="background:${t.g}"></button>`).join('');
  box.querySelectorAll('.tone-i').forEach(b=>b.onclick=()=>{edState.tone=b.dataset.k;renderTones();});
}
function renderTags(){
  const box=document.getElementById('fTagWrap');
  box.innerHTML=edState.tags.map((t,i)=>`<span class="tag-i">${esc(t)}<b data-i="${i}">×</b></span>`).join('');
  box.querySelectorAll('b').forEach(b=>b.onclick=()=>{edState.tags.splice(+b.dataset.i,1);renderTags();});
}
function clearCardBg(){edState.bg=null;syncEditorUI();}

/* ---- 自绘日历 ---- */
let calY=0,calM=0;
function toggleCal(){
  const p=document.getElementById('calPanel'),f=document.getElementById('dateFace');
  const open=p.classList.toggle('open'); f.classList.toggle('open',open);
  if(open){calY=edState.date.getFullYear();calM=edState.date.getMonth();p.classList.remove('year-mode');
    document.getElementById('calYears').classList.remove('show');renderCal();}
}
function calStep(n){
  if(document.getElementById('calPanel').classList.contains('year-mode')){calY+=n*12;renderCalYears();return;}
  calM+=n; if(calM<0){calM=11;calY--;} if(calM>11){calM=0;calY++;} renderCal();
}
function calYearMode(){
  const p=document.getElementById('calPanel');
  const on=p.classList.toggle('year-mode');
  document.getElementById('calYears').classList.toggle('show',on);
  if(on)renderCalYears();
}
function renderCalYears(){
  const box=document.getElementById('calYears');
  const start=calY-6;
  box.innerHTML=Array.from({length:16},(_,i)=>start+i).map(y=>
    `<button class="cal-y${y===edState.date.getFullYear()?' sel':''}" data-y="${y}">${y}</button>`).join('');
  box.querySelectorAll('.cal-y').forEach(b=>b.onclick=()=>{
    calY=+b.dataset.y;
    document.getElementById('calPanel').classList.remove('year-mode');
    box.classList.remove('show');renderCal();});
}
function renderCal(){
  document.getElementById('calY').textContent=calY||edState.date.getFullYear();
  document.getElementById('calM').textContent=MO[calM];
  const y=calY,m=calM;
  const first=new Date(y,m,1).getDay();
  const dim=new Date(y,m+1,0).getDate();
  const prevDim=new Date(y,m,0).getDate();
  const today=midnight(new Date());
  const sel=midnight(edState.date);
  let cells=[];
  for(let i=first-1;i>=0;i--)cells.push({d:prevDim-i,out:true,dt:new Date(y,m-1,prevDim-i)});
  for(let i=1;i<=dim;i++)cells.push({d:i,out:false,dt:new Date(y,m,i)});
  while(cells.length%7!==0||cells.length<42){cells.push({d:cells.length-first-dim+1,out:true,dt:new Date(y,m+1,cells.length-first-dim+1)});if(cells.length>=42)break;}
  document.getElementById('calGrid').innerHTML=cells.map(c=>{
    const isT=+midnight(c.dt)===+today, isS=+midnight(c.dt)===+sel;
    return `<button class="cal-d${c.out?' out':''}${isT?' today':''}${isS?' sel':''}" data-t="${c.dt.getTime()}">${c.d}</button>`;
  }).join('');
  document.getElementById('calGrid').querySelectorAll('.cal-d').forEach(b=>b.onclick=()=>{
    edState.date=new Date(+b.dataset.t);calY=edState.date.getFullYear();calM=edState.date.getMonth();
    renderDateFace();renderCal();});
}
function calToday(){edState.date=new Date();calY=edState.date.getFullYear();calM=edState.date.getMonth();renderDateFace();renderCal();}

async function saveEditor(){
  const title=document.getElementById('fTitle').value.trim();
  if(!title){document.getElementById('fTitle').focus();toast('先给这一天起个标题');return;}
  const obj={
    type:edState.type, title,
    date:ymd(edState.date),
    time:document.getElementById('fTime').value.trim(),
    repeat:edState.repeat, cat:edState.cat, charId:edState.charId,
    tone:edState.tone, bg:edState.bg, mask:+document.getElementById('fBgMask').value,
    note:document.getElementById('fNote').value.trim(),
    tags:[...edState.tags],
    pin:document.getElementById('fPin').classList.contains('on'),
    feature:document.getElementById('fFeature').classList.contains('on'),
    createdAt:editing?editing.createdAt:Date.now(),
    updatedAt:Date.now(),
  };
  if(editing){obj.id=editing.id;obj.source=editing.source;obj.sourceName=editing.sourceName;}
  await dbPut('days',obj);
  DAYS=await dbAll('days');
  renderDays();renderCpDays();
  toast(editing?'已保存修改':'已收录这一天');
  if(editing&&_detailId===editing.id){go('detail',false);renderDetail();}
  else go('days',false);
  editing=null;
}
async function deleteCurrent(){
  if(!editing)return;
  await dbDel('days',editing.id);
  DAYS=await dbAll('days');
  renderDays();renderCpDays();
  editing=null;_detailId=null;
  toast('已删除');go('days',false);
}

/* ==========================================================
   AI —— 通用调用
   ========================================================== */
function apiConf(){
  let cur={};try{cur=JSON.parse(localStorage.getItem('luna_api_current')||'{}');}catch(e){}
  return {baseUrl:(cur.baseUrl||'').replace(/\/$/,''),apiKey:cur.apiKey||'',model:localStorage.getItem('luna_api_model')||''};
}
function renderApiFace(){
  const a=apiConf();const ok=a.baseUrl&&a.apiKey&&a.model;
  document.getElementById('apiFace').innerHTML=`
    <div class="af-row"><b>STATUS</b><span><i class="af-dot${ok?' ok':''}"></i>${ok?'已就绪':'未配置完整'}</span></div>
    <div class="af-row"><b>ENDPOINT</b><span>${esc(a.baseUrl||'—')}</span></div>
    <div class="af-row"><b>MODEL</b><span>${esc(a.model||'—')}</span></div>`;
}
async function callAI(system,user,maxTokens){
  const a=apiConf();
  if(!a.baseUrl||!a.apiKey)throw new Error('尚未配置接口地址与密钥，请到系统设置页填写。');
  if(!a.model)throw new Error('尚未选择模型，请到系统设置页选择一个模型。');
  const resp=await fetch(`${a.baseUrl}/chat/completions`,{
    method:'POST',
    headers:{'Authorization':`Bearer ${a.apiKey}`,'Content-Type':'application/json'},
    body:JSON.stringify({model:a.model,messages:[{role:'system',content:system},{role:'user',content:user}],
      temperature:0.9,max_tokens:maxTokens||1800})
  });
  if(!resp.ok)throw new Error(`接口返回 HTTP ${resp.status}`);
  const data=await resp.json();
  const t=data.choices?.[0]?.message?.content;
  if(!t)throw new Error('接口没有返回内容');
  return t;
}

/* ---- 把角色档案的全部字段拼成上下文（关键：绝不漏读） ---- */
function wbFor(charId){
  const rel=WBS.filter(e=>{
    if(e.enabled===false)return false;
    const cs=Array.isArray(e.chars)?e.chars:[];
    return cs.length===0||cs.includes(charId);
  });
  if(!rel.length)return '';
  rel.sort((a,b)=>(b.priority??5)-(a.priority??5));
  return '【世界设定（须作为真实世界规则遵守）】\n'+rel.map(e=>
    `◆ ${e.title||'未命名'}${e.sub?'（'+e.sub+'）':''}\n${e.detail||''}`).join('\n');
}
function buildCharContext(c){
  const L=[];
  const add=(k,v)=>{if(v!=null&&String(v).trim()!==''&&!(Array.isArray(v)&&!v.length))L.push(`${k}：${Array.isArray(v)?v.join('、'):v}`);};
  L.push('【角色档案 —— 以下每一条都是既定事实，必须完全遵守，不得改写、不得虚构未列出的关键设定】');
  add('姓名',c.name); add('身份/称谓',c.role); add('性别',c.gender); add('年龄',c.age);
  add('生日',c.birthday); add('种族/物种',c.species);
  add('一句话简介',c.desc); add('性格标签',c.traits);
  add('外貌',c.appearance); add('常穿着装',c.outfit);
  add('喜欢',c.likes); add('讨厌',c.dislikes); add('害怕/软肋',c.fears);
  add('说话风格',c.speechStyle); add('口头禅',c.catchphrases); add('使用语言',c.lang);
  add('背景故事',c.backstory); add('当前情景',c.scenario);
  add('与用户的关系',c.relation); add('对用户的称呼',c.callUser); add('关系细节',c.relationDetail);
  add('初次问候',c.firstMes);
  if(Array.isArray(c.dialogExamples)&&c.dialogExamples.length){
    L.push('对话范例（模仿其语气与节奏）：');
    c.dialogExamples.slice(0,6).forEach(d=>{
      if(d.user)L.push(`  用户：${d.user}`);
      if(d.char)L.push(`  ${c.name}：${d.char}`);
    });
  }
  add('绝对不会做的事',c.neverList); add('边界',c.boundaries);
  add('人称视角',c.pov); add('动作描写标记',c.actionMark);
  if(c.prompt)L.push(`【角色提示词原文】\n${c.prompt}`);
  const wb=wbFor(c.id); if(wb)L.push(wb);
  return L.join('\n');
}
function nowContext(){
  const tz=localStorage.getItem('luna_tz')||'Asia/Shanghai';
  const n=new Date();
  const dstr=n.toLocaleDateString('zh-CN',{timeZone:tz,year:'numeric',month:'long',day:'numeric',weekday:'long'});
  const tstr=n.toLocaleTimeString('zh-CN',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false});
  return `【现实此刻】今天是 ${dstr}，当前时间 ${tstr}（时区 ${tz}）。ISO 日期：${ymd(n)}。所有时态判断必须以这个"现在"为准。`;
}
function styleRules(){
  return `【行文硬性规则】
1. 全程使用第一人称，就是角色本人在说话与书写，不要出现"作为AI""以下是"等任何系统腔。
2. 严禁使用 emoji、颜文字、表情符号、Markdown 标记符号（如 # * - 等）。
3. 不要写标题、不要分点、不要写"正文如下"这类提示语。
4. 语气、用词、称呼必须严格贴合角色档案中的说话风格、口头禅、对用户的称呼与关系。
5. 不得编造与角色档案冲突的设定；档案里写了的（尤其是生日、年龄、喜好、经历、关系）必须用对。`;
}

function stripFence(t){
  return String(t).replace(/```[a-zA-Z]*\s*/g,'').replace(/```/g,'').trim();
}
function grabJSON(t){
  const s=stripFence(t);
  const i=s.indexOf('['),j=s.lastIndexOf(']');
  if(i>=0&&j>i){try{return JSON.parse(s.slice(i,j+1));}catch(e){}}
  const i2=s.indexOf('{'),j2=s.lastIndexOf('}');
  if(i2>=0&&j2>i2){try{const o=JSON.parse(s.slice(i2,j2+1));return Array.isArray(o.items)?o.items:[o];}catch(e){}}
  return null;
}

/* ==========================================================
   AI —— 生成纪念日 / 倒数日
   ========================================================== */
function renderCharGrid(boxId,who){
  const box=document.getElementById(boxId);
  if(!CHARS.length){
    box.innerHTML='<div class="mini-note" style="grid-column:1/-1">角色档案为空。请先到「角色档案」创建角色，这里才能读取到人设与生日。</div>';
    return;
  }
  const sel=who==='gen'?genSel.charId:cpSel.charId;
  box.innerHTML=CHARS.map(c=>`<button class="char-cell${sel===c.id?' on':''}" data-id="${c.id}">
    <span class="cg-av">${c.avatar?`<img src="${c.avatar}" alt=""/>`:esc((c.name||'?')[0])}</span>
    <span class="cg-nm">${esc(c.name)}</span>
    <span class="cg-rl">${esc(c.role||c.desc||'')}</span>
    ${c.birthday?`<span class="cg-bd">${esc(c.birthday)}</span>`:''}
  </button>`).join('');
  box.querySelectorAll('.char-cell').forEach(b=>b.onclick=()=>{
    const id=+b.dataset.id;
    if(who==='gen')genSel.charId=id; else cpSel.charId=id;
    renderCharGrid(boxId,who);
  });
}

async function runGenerate(){
  const st=document.getElementById('genStatus'),rs=document.getElementById('genResult');
  rs.innerHTML='';
  if(!genSel.charId){st.innerHTML=box('请先选择一个角色。',true);return;}
  const c=CHARS.find(x=>x.id===genSel.charId);
  if(!c){st.innerHTML=box('角色读取失败，请返回重试。',true);return;}
  const btn=document.getElementById('genRun');btn.disabled=true;
  st.innerHTML=`<div class="gs-box"><div class="spin"></div><div class="gs-tx">正在读取 ${esc(c.name)} 的完整档案与关联世界书，并让他为你写下日子…</div></div>`;

  const n=genSel.count;
  const useBd=document.getElementById('genUseBirthday').classList.contains('on');
  const hint=document.getElementById('genHint').value.trim();
  const kindText={both:'纪念日与倒数日都要有，数量大致各半',anniversary:'全部是纪念日（已经发生过、从那天开始累计的日子）',countdown:'全部是倒数日（尚未到来、需要等待的日子）'}[genSel.kind];
  const existing=DAYS.map(d=>d.title).slice(0,30);

  const sys=`你现在就是「${c.name}」本人。你要为你所珍视的这个人（用户）整理出一份属于你们的日子清单。
${buildCharContext(c)}
${nowContext()}
${styleRules()}`;

  const bdLine=(useBd&&c.birthday)
    ? `【必须遵守】你的生日是「${c.birthday}」，这是档案里写死的事实。清单中必须包含一条与这个生日完全一致的条目（月和日必须与档案一致，一个数字都不能改），类型设为 countdown、repeat 设为 year、category 设为 生日。绝对不允许自己编一个生日日期。`
    : (c.birthday?`你的生日是「${c.birthday}」，如果写到与生日相关的内容，日期必须与之完全一致。`:`档案中没有填写你的生日，因此不要凭空捏造生日条目。`);

  const usr=`请生成 ${n} 条日子，${kindText}。
${bdLine}

每一条都必须来自你档案里真实存在的信息：你的经历、背景故事、喜好、害怕的东西、与用户的关系细节、当前情景、世界设定。不要写空泛的通用节日。
日期规则：
- 类型 anniversary（纪念日）的 date 必须是今天（${ymd(new Date())}）之前的日期。
- 类型 countdown（倒数日）的 date 必须是今天或今天之后的日期。
- 生日、周年这类每年重复的，repeat 填 "year"；一次性的填 "none"。
- date 一律用 YYYY-MM-DD 格式。
${existing.length?`已经存在的条目标题（不要重复）：${existing.join('、')}`:''}
${hint?`用户额外的线索：${hint}`:''}

只输出一个 JSON 数组，不要任何解释文字、不要代码块围栏。数组每一项的字段：
{"type":"anniversary 或 countdown","title":"不超过 12 字的标题","date":"YYYY-MM-DD","repeat":"none 或 year 或 month","category":"从 纪念/生日/约定/旅程/节日/学业/工作/其他 里选一个","note":"用你自己的口吻写 30 到 60 字，说明这一天对你意味着什么"}`;

  try{
    const raw=await callAI(sys,usr,2000);
    let arr=grabJSON(raw);
    if(!arr||!arr.length)throw new Error('返回内容无法解析为清单，请重试一次。');
    arr=arr.filter(x=>x&&x.title&&x.date).slice(0,n);
    // 兜底：若开启了生日且档案有生日，但结果里没有对应日期，则补一条
    if(useBd&&c.birthday){
      const bd=parseYMD(c.birthday);
      if(bd){
        const has=arr.some(x=>{const d=parseYMD(x.date);return d&&d.getMonth()===bd.getMonth()&&d.getDate()===bd.getDate();});
        if(!has){
          arr.unshift({type:'countdown',date:`${new Date().getFullYear()}-${pad(bd.getMonth()+1)}-${pad(bd.getDate())}`,
            repeat:'year',category:'生日',title:`${c.name}的生日`,
            note:`档案里写着的日子。${c.callUser?c.callUser+'，':''}这一天希望你在。`});
        }
      }
    }
    // 规范化日期方向
    const today=midnight(new Date());
    arr.forEach(x=>{
      const d=parseYMD(x.date); if(!d)return;
      if(x.type==='countdown'&&midnight(d)<today&&x.repeat!=='year'&&x.repeat!=='month'){
        d.setFullYear(today.getFullYear()); if(midnight(d)<today)d.setFullYear(d.getFullYear()+1);
        x.date=ymd(d);
      }
      if(x.type==='anniversary'&&midnight(d)>today){x.type='countdown';}
    });
    pendingGen=arr.map(x=>({
      type:x.type==='countdown'?'countdown':'anniversary',
      title:String(x.title).slice(0,24),
      date:ymd(parseYMD(x.date)||new Date()),
      repeat:['none','year','month','week'].includes(x.repeat)?x.repeat:'none',
      cat:CATS.includes(x.category)?x.category:'纪念',
      note:String(x.note||'').replace(/[#*`]/g,'').trim(),
      charId:c.id, source:'ai', sourceName:c.name,
      tone:x.type==='countdown'?'jade':'rose',
      tags:[c.name], feature:true, createdAt:Date.now(),
    }));
    st.innerHTML=`<div class="gs-box"><div class="gs-tx">${esc(c.name)} 写下了 ${pendingGen.length} 条。${document.getElementById('genPreview').classList.contains('on')?'确认后再入库。':'已直接入库。'}</div></div>`;
    if(document.getElementById('genPreview').classList.contains('on')){
      renderPreview();
    }else{
      for(const p of pendingGen)await dbPut('days',p);
      DAYS=await dbAll('days');renderDays();renderCpDays();
      pendingGen=[];toast('已全部收录');go('days');
    }
  }catch(e){
    st.innerHTML=box(e.message||'生成失败，请稍后重试。',true);
  }finally{btn.disabled=false;}
}
function box(msg,err){return `<div class="gs-box${err?' err':''}"><div class="gs-tx">${esc(msg)}</div></div>`;}

function renderPreview(){
  const rs=document.getElementById('genResult');
  rs.innerHTML=pendingGen.map((p,i)=>`
    <div class="pv-card" data-i="${i}">
      <span class="pv-kind ${p.type==='countdown'?'c':'a'}">${p.type==='countdown'?'COUNTDOWN':'ANNIVERSARY'}</span>
      <div class="pv-t">${esc(p.title)}</div>
      <div class="pv-d">${esc(p.date)} · ${esc(p.cat)} · ${({none:'不重复',year:'每年',month:'每月',week:'每周'})[p.repeat]}</div>
      ${p.note?`<div class="pv-n">${esc(p.note)}</div>`:''}
      <div class="pv-acts">
        <button class="ghost-btn" data-a="save" data-i="${i}">单独收录</button>
        <button class="ghost-btn" data-a="edit" data-i="${i}">调整后收录</button>
        <button class="ghost-btn danger" data-a="drop" data-i="${i}">舍弃</button>
      </div>
    </div>`).join('')+
    (pendingGen.length?`<div class="pv-all">
      <button class="solid-btn" id="pvAll">全部收录</button>
      <button class="ghost-btn" id="pvClear">全部舍弃</button></div>`:'');
  rs.querySelectorAll('[data-a]').forEach(b=>b.onclick=async()=>{
    const i=+b.dataset.i,a=b.dataset.a,p=pendingGen[i];
    if(a==='drop'){pendingGen.splice(i,1);renderPreview();return;}
    if(a==='edit'){openEditor(p.type,Object.assign({},p,{id:undefined}));pendingGen.splice(i,1);return;}
    await dbPut('days',p);pendingGen.splice(i,1);
    DAYS=await dbAll('days');renderDays();renderCpDays();renderPreview();toast('已收录');
  });
  const all=document.getElementById('pvAll');
  if(all)all.onclick=async()=>{
    for(const p of pendingGen)await dbPut('days',p);
    DAYS=await dbAll('days');renderDays();renderCpDays();
    pendingGen=[];renderPreview();toast('已全部收录');go('days');
  };
  const cl=document.getElementById('pvClear');
  if(cl)cl.onclick=()=>{pendingGen=[];renderPreview();};
}

/* ==========================================================
   随笔
   ========================================================== */
function renderCpDays(){
  const box=document.getElementById('cpDayList'); if(!box)return;
  if(!DAYS.length){box.innerHTML='<div class="mini-note">还没有收录任何日子，先去「纪念」页添加一个。</div>';return;}
  const list=[...DAYS].sort((a,b)=>calc(a).sortKey-calc(b).sortKey);
  box.innerHTML=list.map(d=>`<button class="pick-i ${d.type==='countdown'?'count':''}${cpSel.dayId===d.id?' on':''}" data-id="${d.id}">
    <span class="pi-mark"></span>
    <span class="pi-tx"><span class="pi-t">${esc(d.title)}</span>
      <span class="pi-d">${esc(d.date)} · ${esc(relPhrase(d))}</span></span>
  </button>`).join('');
  box.querySelectorAll('.pick-i').forEach(b=>b.onclick=()=>{cpSel.dayId=+b.dataset.id;renderCpDays();});
}
function renderSkinRow(){
  const box=document.getElementById('cpSkin');
  box.innerHTML=[{k:'auto',n:'随机'}].concat(SKINS).map(s=>`
    <button class="skin-i${cpSel.skin===s.k?' on':''}" data-k="${s.k}">
      <span class="sk-th" style="${skinThumb(s.k)}"></span>
      <span class="sk-nm">${esc(s.n)}</span></button>`).join('');
  box.querySelectorAll('.skin-i').forEach(b=>b.onclick=()=>{cpSel.skin=b.dataset.k;renderSkinRow();});
}
function skinThumb(k){
  const m={
    auto:'background:linear-gradient(120deg,#F4F1F9,#E8EFF2)',
    paper:'background:repeating-linear-gradient(180deg,#fff 0 5px,#F0F0F6 5px 6px)',
    polaroid:'background:linear-gradient(180deg,#E9EAF2 0 62%,#fff 62%)',
    ticket:'background:linear-gradient(90deg,#F3EEF5 0 22%,#fff 22%);border-left:2px dashed #DDD8E6',
    letter:'background:linear-gradient(180deg,#EDE8F4,#fff)',
    film:'background:linear-gradient(90deg,#E9EAF2 0 14%,#fff 14% 86%,#E9EAF2 86%)',
    ribbon:'background:linear-gradient(90deg,#D9CCE0 0 10%,#fff 10%)',
    card:'background:linear-gradient(150deg,#fff,#EFEAF6)',
    glass:'background:linear-gradient(120deg,rgba(255,255,255,.9),#E7ECF4)',
  };
  return m[k]||m.auto;
}

async function runEssay(){
  const st=document.getElementById('cpStatus');
  if(!cpSel.charId){st.innerHTML=box('请先选择执笔的角色。',true);return;}
  if(!cpSel.dayId){st.innerHTML=box('请先选择一个日子。',true);return;}
  const c=CHARS.find(x=>x.id===cpSel.charId);
  const d=DAYS.find(x=>x.id===cpSel.dayId);
  if(!c||!d){st.innerHTML=box('数据读取失败，请返回重试。',true);return;}
  const btn=document.getElementById('cpRun');btn.disabled=true;
  st.innerHTML=`<div class="gs-box"><div class="spin"></div><div class="gs-tx">${esc(c.name)} 正在为「${esc(d.title)}」落笔…</div></div>`;

  const cc=calc(d);
  const minLen=Math.max(300,+cpSel.len);
  const hint=document.getElementById('cpHint').value.trim();

  let timeJudge;
  if(d.type==='anniversary'){
    if(cc.today)timeJudge=`这一天就是今天。今年恰好是第 ${cc.wholeYears} 个周年。请用"今天"的时态来写。`;
    else if(cc.future)timeJudge=`这个日期还没有到，距离它还有 ${Math.abs(cc.days)} 天。请用"尚未到来"的时态来写，不要写成已经发生过。`;
    else timeJudge=`这一天已经过去 ${cc.days} 天了，也就是大约 ${cc.wholeYears} 年 ${Math.round(cc.days-cc.wholeYears*365.2425)} 天之前。距离下一个周年还有 ${cc.toNextAnni} 天。请用回望的时态来写，明确意识到那天已经是过去。`;
  }else{
    if(cc.today)timeJudge=`目标日就是今天。请用"终于到了今天"的时态来写。`;
    else if(cc.past)timeJudge=`目标日已经过去 ${Math.abs(cc.days)} 天了。请用"那天已经过去了"的时态来写，不要写成还在等待。`;
    else timeJudge=`距离目标日还有 ${cc.days} 天（目标日是 ${ymd(cc.target)}）。请用"还在等待"的时态来写，不要写成已经发生。`;
  }

  const sys=`你现在就是「${c.name}」本人，正在为用户写一篇随笔。
${buildCharContext(c)}
${nowContext()}
${styleRules()}`;

  const usr=`【要写的这一天】
标题：${d.title}
类型：${d.type==='anniversary'?'纪念日（从那天起累计）':'倒数日（朝那天等待）'}
登记日期：${d.date}${d.time?' '+d.time:''}
分类：${d.cat||'纪念'}
重复：${({none:'不重复',year:'每年',month:'每月',week:'每周'})[d.repeat||'none']}
${d.note?`用户备注：${d.note}`:''}
${(d.tags||[]).length?`标签：${d.tags.join('、')}`:''}

【时间判断 —— 这是最重要的一条，落笔前先想清楚】
${timeJudge}

【要求】
写一篇不少于 ${minLen} 字的随笔，笔触定为「${cpSel.mood}」。
用你自己的眼睛看这一天：可以写当下的天气、光线、手边的东西、想起的画面、说不出口的那句话。要有具体的细节，不要通篇抒情形容词。
称呼用户时，使用档案里写明的称呼方式。
分成 3 到 5 个自然段，段与段之间用一个空行隔开。
直接输出正文，第一个字就是随笔的开头，不要写标题、不要写任何说明。
${hint?`用户希望你提到：${hint}`:''}`;

  try{
    let text=await callAI(sys,usr,2400);
    text=stripFence(text).replace(/[#*`>]/g,'').trim();
    const plain=text.replace(/\s/g,'');
    if(plain.length<minLen*0.75){
      st.innerHTML=`<div class="gs-box"><div class="spin"></div><div class="gs-tx">篇幅不足，正在请他接着写下去…</div></div>`;
      const more=await callAI(sys,`你刚才写的随笔篇幅不够（只有 ${plain.length} 字），要求不少于 ${minLen} 字。请把整篇重新完整地写一遍，写得更长更细腻，保持同样的时态判断与人称。以下是你刚才写的，请在此基础上扩写并重新完整输出全文：\n\n${text}`,2600);
      const t2=stripFence(more).replace(/[#*`>]/g,'').trim();
      if(t2.replace(/\s/g,'').length>plain.length)text=t2;
    }
    const skin=cpSel.skin==='auto'?SKINS[Math.floor(Math.random()*SKINS.length)].k:cpSel.skin;
    const rec={
      dayId:d.id,dayTitle:d.title,dayType:d.type,dayDate:d.date,
      charId:c.id,charName:c.name,charAvatar:c.avatar||'',
      mood:cpSel.mood,skin,text,
      words:text.replace(/\s/g,'').length,
      rel:relPhrase(d),
      bg:d.bg||'',
      fav:false,createdAt:Date.now(),
    };
    const id=await dbPut('essays',rec);
    ESSAYS=await dbAll('essays');
    renderEssays();
    st.innerHTML='';
    toast('随笔已写好');
    openRead(id);
  }catch(e){
    st.innerHTML=box(e.message||'撰写失败，请稍后重试。',true);
  }finally{btn.disabled=false;}
}

function renderEssayChips(){
  const box=document.getElementById('essayChips');
  const names=[...new Set(ESSAYS.map(e=>e.charName).filter(Boolean))];
  const items=[{v:'all',n:'全部'}].concat(names.map(n=>({v:'c:'+n,n})));
  box.innerHTML=items.map(x=>`<button class="chip${essayFilter===x.v?' on':''}" data-v="${x.v}">${esc(x.n)}</button>`).join('');
  box.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{essayFilter=b.dataset.v;renderEssayChips();renderEssays();});
}

function noteHTML(e,i){
  const cls='s-'+(e.skin||'paper');
  const pol=e.skin==='polaroid'?`<div class="pol-photo" style="${e.bg?`background-image:url(${e.bg})`:''}"></div>`:'';
  const preview=String(e.text||'').replace(/\n+/g,' ');
  return `<article class="note ${cls}" data-id="${e.id}" style="animation-delay:${Math.min(i*50,400)}ms">
    ${pol}
    <div class="note-in">
      <div class="note-kick">
        <span class="nk-tag">${e.dayType==='countdown'?'UNTIL':'SINCE'}</span>
        <span class="nk-date">${esc(e.dayDate||'')} · ${esc(e.rel||'')}</span>
      </div>
      <div class="note-t">${esc(e.dayTitle||'无题')}</div>
      <div class="note-body">${esc(preview)}</div>
      <div class="note-foot">
        <div class="nf-l">
          <div class="char-mini"><div class="cm-av">${e.charAvatar?`<img src="${e.charAvatar}" alt=""/>`:esc((e.charName||'?')[0])}</div>
            <div class="cm-nm">${esc(e.charName||'')}</div></div>
          <span class="nf-w">${e.words||0} 字 · ${esc(e.mood||'')}</span>
        </div>
        <div class="note-acts">
          <button class="note-act${e.fav?' on':''}" data-a="fav" data-id="${e.id}">
            <svg viewBox="0 0 24 24" class="ico sm"><path d="M12 20s-6.5-4.2-6.5-9A3.5 3.5 0 0112 8.2 3.5 3.5 0 0118.5 11c0 4.8-6.5 9-6.5 9z"/></svg></button>
          <button class="note-act" data-a="del" data-id="${e.id}">
            <svg viewBox="0 0 24 24" class="ico sm"><path d="M5 7h14M10 7V5h4v2M8 7l1 12h6l1-12"/></svg></button>
        </div>
      </div>
    </div>
  </article>`;
}
function bindNoteActs(scope){
  document.querySelectorAll(scope+' .note-act').forEach(b=>b.onclick=async ev=>{
    ev.stopPropagation();
    const id=+b.dataset.id,a=b.dataset.a;
    const e=ESSAYS.find(x=>x.id===id); if(!e)return;
    if(a==='fav'){e.fav=!e.fav;await dbPut('essays',e);ESSAYS=await dbAll('essays');renderEssays();
      if(curView==='detail')renderDetail();toast(e.fav?'已收藏':'已取消收藏');}
    if(a==='del'){await dbDel('essays',id);ESSAYS=await dbAll('essays');renderEssays();
      if(curView==='detail')renderDetail();toast('已删除随笔');}
  });
}
function renderEssays(){
  renderEssayChips();
  let list=[...ESSAYS].sort((a,b)=>b.createdAt-a.createdAt);
  if(essayFilter.startsWith('c:'))list=list.filter(e=>e.charName===essayFilter.slice(2));
  if(document.querySelector('#skinSeg .seg-i.active')?.dataset.skin==='fav')list=list.filter(e=>e.fav);
  const box=document.getElementById('essayList');
  if(!list.length){
    box.innerHTML=`<div class="empty">
      <div class="empty-ring"><svg viewBox="0 0 24 24" class="ico"><path d="M6 4h9l4 4v12H6z"/><path d="M15 4v4h4M9 12h7M9 16h5"/></svg></div>
      <div class="empty-tx">${ESSAYS.length?'没有符合条件的随笔':'还没有一篇随笔'}</div>
      <div class="empty-sub">${ESSAYS.length?'换个筛选看看。':'选一个日子，请角色替它写下点什么。'}</div>
    </div>`;return;
  }
  box.innerHTML=list.map((e,i)=>noteHTML(e,i)).join('');
  box.querySelectorAll('.note').forEach(el=>el.onclick=ev=>{
    if(ev.target.closest('.note-act'))return;openRead(+el.dataset.id);});
  bindNoteActs('#essayList');
}

function openRead(id){
  const e=ESSAYS.find(x=>x.id===id); if(!e)return;
  const d=DAYS.find(x=>x.id===e.dayId);
  const paras=String(e.text||'').split(/\n+/).filter(Boolean).map(p=>`<p>${esc(p)}</p>`).join('');
  document.getElementById('readScroll').innerHTML=`
    <div class="rd-head">
      <div class="rd-kick">${e.dayType==='countdown'?'UNTIL':'SINCE'} · ${esc(e.dayDate||'')}</div>
      <div class="rd-t">${esc(e.dayTitle||'无题')}</div>
      <div class="rd-by">
        <div class="char-mini"><div class="cm-av">${e.charAvatar?`<img src="${e.charAvatar}" alt=""/>`:esc((e.charName||'?')[0])}</div>
          <div class="cm-nm">${esc(e.charName||'')} 执笔</div></div>
        <span class="nf-w">${e.words||0} 字 · ${esc(e.mood||'')}</span>
      </div>
    </div>
    <div class="rd-orn"><i></i><b></b><i></i></div>
    <div class="rd-sheet"><div class="rd-body">${paras}</div></div>
    <div class="dt-sec">
      <div class="dt-sec-t">CONTEXT</div>
      <div class="dt-panel">
        <div class="dt-kv"><b>写作时的判断</b><span>${esc(e.rel||'')}</span></div>
        <div class="dt-kv"><b>此刻再看</b><span>${d?esc(relPhrase(d)):'原日子已删除'}</span></div>
        <div class="dt-kv"><b>成文于</b><span>${new Date(e.createdAt).toLocaleString('zh-CN')}</span></div>
        <div class="dt-kv"><b>便签版式</b><span>${esc((SKINS.find(s=>s.k===e.skin)||{n:'纸笺'}).n)}</span></div>
      </div>
    </div>
    <div class="dt-acts">
      <button class="solid-btn" id="rdFav">${e.fav?'取消收藏':'收藏这篇'}</button>
      <button class="solid-btn" id="rdCopy">复制全文</button>
    </div>
    <div class="field" style="margin-top:16px">
      <label class="fl">更换版式</label>
      <div class="skin-row" id="rdSkin"></div>
    </div>
    <div class="foot-rule"><span>END</span></div>`;
  go('read');
  document.getElementById('rdFav').onclick=async()=>{
    e.fav=!e.fav;await dbPut('essays',e);ESSAYS=await dbAll('essays');renderEssays();openRead(id);};
  document.getElementById('rdCopy').onclick=()=>{
    navigator.clipboard?.writeText(e.text).then(()=>toast('全文已复制')).catch(()=>toast('复制失败'));};
  const sk=document.getElementById('rdSkin');
  sk.innerHTML=SKINS.map(s=>`<button class="skin-i${e.skin===s.k?' on':''}" data-k="${s.k}">
    <span class="sk-th" style="${skinThumb(s.k)}"></span><span class="sk-nm">${esc(s.n)}</span></button>`).join('');
  sk.querySelectorAll('.skin-i').forEach(b=>b.onclick=async()=>{
    e.skin=b.dataset.k;await dbPut('essays',e);ESSAYS=await dbAll('essays');renderEssays();openRead(id);});
}

/* ==========================================================
   生日导入 / 备份
   ========================================================== */
async function importBirthdays(){
  const st=document.getElementById('birthStatus');
  await loadChars();
  const withBd=CHARS.filter(c=>c.birthday&&parseYMD(c.birthday));
  if(!withBd.length){st.textContent='角色档案里还没有填写生日。';return;}
  let added=0;
  for(const c of withBd){
    const bd=parseYMD(c.birthday);
    const title=`${c.name}的生日`;
    if(DAYS.some(d=>d.title===title))continue;
    const y=new Date().getFullYear();
    await dbPut('days',{
      type:'countdown',title,
      date:`${y}-${pad(bd.getMonth()+1)}-${pad(bd.getDate())}`,
      time:'',repeat:'year',cat:'生日',charId:c.id,tone:'rose',bg:null,mask:34,
      note:`来自角色档案：${c.birthday}`,tags:[c.name,'生日'],pin:false,feature:true,
      source:'sync',sourceName:c.name,createdAt:Date.now(),updatedAt:Date.now(),
    });
    added++;
  }
  DAYS=await dbAll('days');renderDays();renderCpDays();
  st.textContent=added?`已导入 ${added} 个生日。`:'所有角色生日都已存在，无需重复导入。';
}
async function exportData(){
  const data={v:1,exportedAt:Date.now(),days:DAYS,essays:ESSAYS,settings:SET};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`memoria-backup-${ymd(new Date())}.json`;
  a.click();URL.revokeObjectURL(a.href);
  document.getElementById('dataStatus').textContent='备份已导出。';
}

/* ==========================================================
   悬浮按钮
   ========================================================== */
function toggleFab(){document.getElementById('fabCluster').classList.toggle('open');}
function closeFab(){const f=document.getElementById('fabCluster');if(f)f.classList.remove('open');}

/* ==========================================================
   事件绑定
   ========================================================== */
function readFile(file,cb){
  if(!file)return;
  if(file.size>6*1024*1024){toast('图片过大，请选择 6MB 以内的图片');return;}
  const r=new FileReader();r.onload=e=>cb(e.target.result);r.readAsDataURL(file);
}

function bind(){
  // 类型切换
  document.querySelectorAll('#edTypeSwitch .ets-i').forEach(b=>b.onclick=()=>{
    edState.type=b.dataset.type;
    if(edState.type==='countdown'&&edState.cat==='纪念')edState.cat='约定';
    syncEditorUI();});
  // pill 组
  const pillGroup=(id,fn)=>{
    const box=document.getElementById(id); if(!box)return;
    box.querySelectorAll('.pill').forEach(p=>p.onclick=()=>{
      box.querySelectorAll('.pill').forEach(x=>x.classList.remove('active'));
      p.classList.add('active');fn(p.dataset.v);});
  };
  pillGroup('fRepeat',v=>edState.repeat=v);
  pillGroup('fCat',v=>edState.cat=v);
  pillGroup('genKind',v=>genSel.kind=v);
  pillGroup('genCount',v=>genSel.count=+v);
  pillGroup('cpMood',v=>cpSel.mood=v);
  pillGroup('cpLen',v=>cpSel.len=v);
  pillGroup('sDensity',v=>{SET.density=v;document.body.dataset.density=v;localStorage.setItem('memoria_set',JSON.stringify(SET));});

  // 排序
  document.querySelectorAll('#sortSeg .seg-i').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('#sortSeg .seg-i').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');sortMode=b.dataset.sort;renderDays();});
  document.querySelectorAll('#skinSeg .seg-i').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('#skinSeg .seg-i').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');renderEssays();});

  // 标签输入
  const ti=document.getElementById('fTagInput');
  ti.onkeydown=e=>{
    if(e.key==='Enter'){e.preventDefault();
      const v=ti.value.trim(); if(v&&!edState.tags.includes(v)&&edState.tags.length<8){edState.tags.push(v);renderTags();}
      ti.value='';}
    if(e.key==='Backspace'&&!ti.value&&edState.tags.length){edState.tags.pop();renderTags();}
  };
  // 时间输入格式化
  const tm=document.getElementById('fTime');
  tm.oninput=()=>{
    let v=tm.value.replace(/[^\d]/g,'').slice(0,4);
    if(v.length>=3)v=v.slice(0,2)+':'+v.slice(2);
    tm.value=v;
  };
  // 卡片背景
  document.getElementById('fBgFile').onchange=e=>readFile(e.target.files[0],data=>{edState.bg=data;syncEditorUI();});
  document.getElementById('fBgMask').oninput=e=>{
    edState.mask=+e.target.value;document.getElementById('fBgMaskVal').textContent=e.target.value+'%';};
  // 应用背景
  document.getElementById('sBgFile').onchange=e=>readFile(e.target.files[0],async data=>{
    await dbPut('assets',{key:'appbg',data});applyAppBg();toast('背景已更新');});
  document.getElementById('sBgVeil').oninput=e=>{
    document.getElementById('sBgVeilVal').textContent=e.target.value+'%';SET.appBgVeil=+e.target.value;
    document.getElementById('appBgVeil').style.opacity=(SET.appBgVeil/100).toString();saveSettings();};
  document.getElementById('sBgBright').oninput=e=>{
    document.getElementById('sBgBrightVal').textContent=e.target.value+'%';SET.appBgBright=+e.target.value;
    document.getElementById('appBgLayer').style.filter=`brightness(${SET.appBgBright}%)`;saveSettings();};
  // 导入备份
  document.getElementById('impFile').onchange=e=>{
    const f=e.target.files[0];if(!f)return;
    const r=new FileReader();
    r.onload=async ev=>{
      try{
        const d=JSON.parse(ev.target.result);
        if(Array.isArray(d.days))for(const x of d.days){delete x.id;await dbPut('days',x);}
        if(Array.isArray(d.essays))for(const x of d.essays){delete x.id;await dbPut('essays',x);}
        DAYS=await dbAll('days');ESSAYS=await dbAll('essays');
        renderDays();renderEssays();renderCpDays();
        document.getElementById('dataStatus').textContent='导入完成。';toast('备份已导入');
      }catch(err){document.getElementById('dataStatus').textContent='文件解析失败，请确认是 Memoria 导出的备份。';}
    };
    r.readAsText(f);
  };
  // 点击空白收起浮层
  document.getElementById('stage').addEventListener('click',e=>{
    if(!e.target.closest('.fab-cluster'))closeFab();
  },true);
}

/* ==========================================================
   启动
   ========================================================== */
document.addEventListener('DOMContentLoaded',async()=>{
  updateTime();setInterval(updateTime,10000);
  updateBattery();applyIsland();applyGlobalFont();
  loadSettings();bind();
  renderFilterChips();
  await applyAppBg();
  await loadAll();
  if(SET.autoBirth)setTimeout(()=>{silentBirthSync();},600);
  setInterval(()=>{if(curView==='days')renderDays();},60000);
});
async function silentBirthSync(){
  const withBd=CHARS.filter(c=>c.birthday&&parseYMD(c.birthday));
  let added=0;
  for(const c of withBd){
    const title=`${c.name}的生日`;
    if(DAYS.some(d=>d.title===title))continue;
    const bd=parseYMD(c.birthday);const y=new Date().getFullYear();
    await dbPut('days',{type:'countdown',title,date:`${y}-${pad(bd.getMonth()+1)}-${pad(bd.getDate())}`,
      time:'',repeat:'year',cat:'生日',charId:c.id,tone:'rose',bg:null,mask:34,
      note:`来自角色档案：${c.birthday}`,tags:[c.name,'生日'],pin:false,feature:true,
      source:'sync',sourceName:c.name,createdAt:Date.now(),updatedAt:Date.now()});
    added++;
  }
  if(added){DAYS=await dbAll('days');renderDays();renderCpDays();toast(`已同步 ${added} 个角色生日`);}
}
function renderCharPickers(){
  if(document.getElementById('fCharStrip'))renderCharStrip();
  renderCharGrid('genCharGrid','gen');
  renderCharGrid('cpCharGrid','cp');
}
