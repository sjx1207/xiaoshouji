/* ==========================================================
   Aside — 陪伴 App
   与 Luna 主系统同步：状态栏 / 灵动岛 / 字体 / 时区 / 角色档案 / 世界书 / API
   ========================================================== */

/* ============ 返回首页 ============ */
function goBack(){
  const mask=document.createElement('div');
  mask.style.cssText='position:fixed;inset:0;background:rgba(251,251,253,0.97);opacity:0;z-index:99999;transition:opacity .28s ease;pointer-events:all;';
  document.body.appendChild(mask);
  requestAnimationFrame(()=>{mask.style.opacity='1';});
  setTimeout(()=>{window.location.href='index.html';},260);
}

/* ============ 状态栏 ============ */
function updateTime(){
  const tz=localStorage.getItem('luna_tz')||'Asia/Shanghai';
  const s=new Date().toLocaleTimeString('zh-CN',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false});
  document.querySelectorAll('.status-time').forEach(el=>el.textContent=s);
}
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
  if(e.key==='luna_char_db_update'||e.key==='luna_characters_updated')loadChars().then(()=>renderCharGrid());
});

/* ==========================================================
   IndexedDB
   ========================================================== */
const DB_NAME='LunaCompanionDB', DB_VER=1;
let _cdb=null;
function openDB(){
  if(_cdb)return Promise.resolve(_cdb);
  return new Promise((res,rej)=>{
    const req=indexedDB.open(DB_NAME,DB_VER);
    req.onupgradeneeded=e=>{
      const db=e.target.result;
      if(!db.objectStoreNames.contains('plans'))db.createObjectStore('plans',{keyPath:'id',autoIncrement:true});
      if(!db.objectStoreNames.contains('sessions'))db.createObjectStore('sessions',{keyPath:'id',autoIncrement:true});
      if(!db.objectStoreNames.contains('assets'))db.createObjectStore('assets',{keyPath:'key'});
    };
    req.onsuccess=e=>{_cdb=e.target.result;res(_cdb);};
    req.onerror=e=>rej(e.target.error);
  });
}
async function dbAll(s){const db=await openDB().catch(()=>null);if(!db)return[];
  return new Promise(r=>{const q=db.transaction(s,'readonly').objectStore(s).getAll();
    q.onsuccess=()=>r(q.result||[]);q.onerror=()=>r([]);});}
async function dbPut(s,v){const db=await openDB().catch(()=>null);if(!db)return null;
  return new Promise(r=>{const st=db.transaction(s,'readwrite').objectStore(s);
    const q=(v.id||v.key)?st.put(v):st.add(v);q.onsuccess=()=>r(q.result);q.onerror=()=>r(null);});}
async function dbDel(s,k){const db=await openDB().catch(()=>null);if(!db)return;
  return new Promise(r=>{const q=db.transaction(s,'readwrite').objectStore(s).delete(k);q.onsuccess=()=>r();q.onerror=()=>r();});}
async function dbGet(s,k){const db=await openDB().catch(()=>null);if(!db)return null;
  return new Promise(r=>{const q=db.transaction(s,'readonly').objectStore(s).get(k);
    q.onsuccess=()=>r(q.result||null);q.onerror=()=>r(null);});}

/* ---- 角色档案 / 世界书（只读） ---- */
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
  try{const db=await openCharDB();
    return await new Promise(r=>{const q=db.transaction('chars','readonly').objectStore('chars').getAll();
      q.onsuccess=()=>r(q.result||[]);q.onerror=()=>r([]);});
  }catch(e){return [];}
}
async function getAllWb(){
  try{
    const db=await new Promise((res,rej)=>{
      const q=indexedDB.open('LunaWorldBookDB',2);
      q.onupgradeneeded=e=>{if(!e.target.result.objectStoreNames.contains('entries'))
        e.target.result.createObjectStore('entries',{keyPath:'id',autoIncrement:true});};
      q.onsuccess=e=>res(e.target.result);q.onerror=()=>rej();
    });
    return await new Promise(r=>{const q=db.transaction('entries','readonly').objectStore('entries').getAll();
      q.onsuccess=()=>r(q.result||[]);q.onerror=()=>r([]);});
  }catch(e){return [];}
}

/* ==========================================================
   状态
   ========================================================== */
let PLANS=[], SESSIONS=[], CHARS=[], WBS=[];
let SET={appBgVeil:48,appBgBright:104,anim:true,keepAbort:true,badgeToast:true,clock:'ring',
  noiseVol:42,unlocked:[],lastCharId:null};
let curView='plan', curTab='plan', viewStack=[];
let planFilter='today', logFilter='all';
let qa={date:new Date(),pri:'normal',cat:'学习',pomo:0};
let cal={qa:{y:0,m:0}};
let FK={charId:null,mins:25,brk:5,lbrk:15,rounds:1,planId:null,freq:'normal',bg:'mist',veil:34,noise:'none'};

const WD=['周日','周一','周二','周三','周四','周五','周六'];
const WDE=['SUN','MON','TUE','WED','THU','FRI','SAT'];
const MOE=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const MO=['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];

const BGS=[
  {k:'mist', n:'晨雾', g:'linear-gradient(170deg,#FDFDFE 0%,#F1F3F9 46%,#E8ECF4 100%)'},
  {k:'paper',n:'纸白', g:'linear-gradient(160deg,#FFFFFF 0%,#F7F6FA 52%,#EFEEF4 100%)'},
  {k:'river',n:'月河', g:'linear-gradient(165deg,#F8FAFD 0%,#E9F0F6 48%,#DFE9F1 100%)'},
  {k:'sakura',n:'薄樱',g:'linear-gradient(165deg,#FFFDFE 0%,#F9F1F5 50%,#F1E7EE 100%)'},
];
const NOISES=[
  {k:'none', n:'关闭'},
  {k:'rain', n:'落雨'},
  {k:'ocean',n:'潮汐'},
  {k:'wind', n:'风声'},
  {k:'fire', n:'炉火'},
  {k:'stream',n:'溪流'},
  {k:'hush', n:'静室'},
  {k:'user', n:'自定义'},
];

/* ==========================================================
   徽章体系
   ========================================================== */
const BADGES=[
  {k:'first',    n:'第一次坐下',  c:'启程', d:'完成第一次专注',           goal:1,   f:s=>s.done},
  {k:'three',    n:'第三次',      c:'启程', d:'完成三次专注',             goal:3,   f:s=>s.done},
  {k:'ten',      n:'十次同行',    c:'启程', d:'完成十次专注',             goal:10,  f:s=>s.done},
  {k:'thirty',   n:'三十而立',    c:'启程', d:'完成三十次专注',           goal:30,  f:s=>s.done},
  {k:'hundred',  n:'百次相伴',    c:'启程', d:'完成一百次专注',           goal:100, f:s=>s.done},

  {k:'h1',       n:'第一个小时',  c:'时长', d:'累计专注满 60 分钟',       goal:60,  f:s=>s.mins},
  {k:'h6',       n:'半日',        c:'时长', d:'累计专注满 6 小时',        goal:360, f:s=>s.mins},
  {k:'h24',      n:'一昼夜',      c:'时长', d:'累计专注满 24 小时',       goal:1440,f:s=>s.mins},
  {k:'h100',     n:'百时',        c:'时长', d:'累计专注满 100 小时',      goal:6000,f:s=>s.mins},

  {k:'st2',      n:'两日不断',    c:'连续', d:'连续两天都有专注',         goal:2,   f:s=>s.streakBest},
  {k:'st7',      n:'一周不断',    c:'连续', d:'连续七天都有专注',         goal:7,   f:s=>s.streakBest},
  {k:'st21',     n:'三七之约',    c:'连续', d:'连续二十一天都有专注',     goal:21,  f:s=>s.streakBest},
  {k:'st100',    n:'百日',        c:'连续', d:'连续一百天都有专注',       goal:100, f:s=>s.streakBest},

  {k:'dawn',     n:'晨光',        c:'时辰', d:'在清晨五点到八点开始一次', goal:1,   f:s=>s.dawn},
  {k:'noonish',  n:'午后',        c:'时辰', d:'在下午一点到三点开始一次', goal:1,   f:s=>s.noon},
  {k:'dusk',     n:'黄昏',        c:'时辰', d:'在傍晚五点到七点开始一次', goal:1,   f:s=>s.dusk},
  {k:'night',    n:'深夜',        c:'时辰', d:'在零点到四点开始一次',     goal:1,   f:s=>s.night},

  {k:'long90',   n:'长夜未央',    c:'单次', d:'单次专注达到 90 分钟',     goal:1,   f:s=>s.long90},
  {k:'nopause',  n:'心无旁骛',    c:'单次', d:'一次全程不暂停地完成',     goal:1,   f:s=>s.noPause},
  {k:'r3',       n:'一日三轮',    c:'单次', d:'同一天内完成三次专注',     goal:1,   f:s=>s.threeInDay},

  {k:'same10',   n:'专属陪伴',    c:'羁绊', d:'与同一位角色专注十次',     goal:10,  f:s=>s.maxCharCount},
  {k:'same600',  n:'知己',        c:'羁绊', d:'与同一位角色累计十小时',   goal:600, f:s=>s.maxCharMins},
  {k:'three3',   n:'群星',        c:'羁绊', d:'与三位不同角色专注过',     goal:3,   f:s=>s.charKinds},
  {k:'insight10',n:'字里行间',    c:'羁绊', d:'收到十篇陪伴感悟',         goal:10,  f:s=>s.insights},

  {k:'plan1',    n:'第一件事',    c:'计划', d:'写下第一个计划',           goal:1,   f:s=>s.planTotal},
  {k:'plan50',   n:'一一落定',    c:'计划', d:'完成五十个计划',           goal:50,  f:s=>s.planDone},
  {k:'perfect',  n:'圆满一日',    c:'计划', d:'某一天的计划全部完成',     goal:1,   f:s=>s.perfectDay},
  {k:'noise20',  n:'有声之静',    c:'计划', d:'使用白噪音二十次',         goal:20,  f:s=>s.noiseUse},
];

function computeStats(){
  const ok=SESSIONS.filter(s=>!s.abort);
  const st={};
  st.done=ok.length;
  st.mins=Math.round(ok.reduce((a,b)=>a+(b.mins||0),0));
  st.insights=SESSIONS.filter(s=>s.insight).length;
  st.long90=ok.some(s=>(s.mins||0)>=90)?1:0;
  st.noPause=ok.some(s=>s.pauses===0)?1:0;
  st.dawn=ok.some(s=>{const h=new Date(s.startAt).getHours();return h>=5&&h<8;})?1:0;
  st.noon=ok.some(s=>{const h=new Date(s.startAt).getHours();return h>=13&&h<15;})?1:0;
  st.dusk=ok.some(s=>{const h=new Date(s.startAt).getHours();return h>=17&&h<19;})?1:0;
  st.night=ok.some(s=>{const h=new Date(s.startAt).getHours();return h>=0&&h<4;})?1:0;
  st.noiseUse=ok.filter(s=>s.noise&&s.noise!=='none').length;

  const byDay={};
  ok.forEach(s=>{const d=ymd(new Date(s.startAt));byDay[d]=(byDay[d]||0)+(s.mins||0);});
  st.byDay=byDay;
  const dayCounts={};
  ok.forEach(s=>{const d=ymd(new Date(s.startAt));dayCounts[d]=(dayCounts[d]||0)+1;});
  st.threeInDay=Object.values(dayCounts).some(v=>v>=3)?1:0;

  // 连续天
  const days=Object.keys(byDay).sort();
  let best=0,cur=0,prev=null;
  days.forEach(d=>{
    if(prev&&(new Date(d)-new Date(prev))===86400000)cur++;else cur=1;
    prev=d;best=Math.max(best,cur);
  });
  st.streakBest=best;
  // 当前连续
  let now=midnight(new Date()),run=0;
  while(byDay[ymd(now)]){run++;now=new Date(now.getTime()-86400000);}
  if(!run){const y=new Date(midnight(new Date()).getTime()-86400000);
    let n2=y;while(byDay[ymd(n2)]){run++;n2=new Date(n2.getTime()-86400000);}}
  st.streakNow=run;
  st.bestSession=ok.reduce((a,b)=>Math.max(a,b.mins||0),0);

  const byChar={};
  ok.forEach(s=>{const k=s.charName||'—';byChar[k]=byChar[k]||{c:0,m:0};byChar[k].c++;byChar[k].m+=s.mins||0;});
  st.byChar=byChar;
  st.charKinds=Object.keys(byChar).length;
  st.maxCharCount=Object.values(byChar).reduce((a,b)=>Math.max(a,b.c),0);
  st.maxCharMins=Object.values(byChar).reduce((a,b)=>Math.max(a,b.m),0);

  st.planTotal=PLANS.length;
  st.planDone=PLANS.filter(p=>p.done).length;
  const pd={};
  PLANS.forEach(p=>{pd[p.date]=pd[p.date]||{t:0,d:0};pd[p.date].t++;if(p.done)pd[p.date].d++;});
  st.perfectDay=Object.values(pd).some(v=>v.t>=3&&v.t===v.d)?1:0;
  return st;
}
function checkBadges(silent){
  const st=computeStats();
  const got=new Set(SET.unlocked||[]);
  const fresh=[];
  BADGES.forEach(b=>{
    const v=b.f(st)||0;
    if(v>=b.goal&&!got.has(b.k)){got.add(b.k);fresh.push(b);}
  });
  SET.unlocked=[...got];
  saveSettings();
  if(!silent&&SET.badgeToast&&fresh.length)popBadge(fresh[0],fresh.length);
  return fresh;
}
function popBadge(b,n){
  const el=document.getElementById('badgePop');
  el.innerHTML=`<div class="bp-m">${esc(b.n[0])}</div>
    <div class="bp-t"><b>解锁「${esc(b.n)}」${n>1?`等 ${n} 枚`:''}</b><span>${esc(b.d)}</span></div>`;
  el.classList.add('show');
  clearTimeout(window._bp);window._bp=setTimeout(()=>el.classList.remove('show'),3200);
}

/* ==========================================================
   工具
   ========================================================== */
const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const pad=n=>String(n).padStart(2,'0');
function midnight(d){const x=new Date(d);x.setHours(0,0,0,0);return x;}
function ymd(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}
function parseYMD(s){if(!s)return null;const m=String(s).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  return m?new Date(+m[1],+m[2]-1,+m[3]):null;}
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');
  clearTimeout(window._tt);window._tt=setTimeout(()=>t.classList.remove('show'),2100);}
function mmss(sec){const m=Math.floor(sec/60),s=sec%60;return pad(m)+':'+pad(s);}

/* ==========================================================
   导航
   ========================================================== */
const VT={plan:['TODAY & AFTER','计划'],focus:['SIT WITH ME','专注'],log:['WHAT REMAINS','档案'],
  badge:['MERITS','徽章'],read:['FULL TEXT','感悟'],settings:['PREFERENCES','偏好']};
function go(v,push=true){
  if(v===curView)return;
  if(push&&curView)viewStack.push(curView);
  curView=v;
  document.querySelectorAll('.view').forEach(e=>e.classList.remove('active'));
  const el=document.getElementById('v-'+v);if(el)el.classList.add('active');
  const t=VT[v]||['',''];
  document.getElementById('tbEyebrow').textContent=t[0];
  document.getElementById('tbName').textContent=t[1];
  if(['plan','focus','log','badge'].includes(v)){curTab=v;viewStack=[];
    document.querySelectorAll('.dock-i').forEach(b=>b.classList.toggle('active',b.dataset.tab===v));}
  const sc=el&&el.querySelector('.scroll');if(sc)sc.scrollTop=0;
  if(v==='focus'){renderCharGrid();renderFkPlans();renderBgRow();renderNoiseGrid('noiseGrid');}
  if(v==='log'){renderLog();}
  if(v==='badge'){renderBadges();}
  if(v==='settings'){renderApiFace();}
}
function onBack(){
  if(viewStack.length)go(viewStack.pop(),false);
  else if(!['plan','focus','log','badge'].includes(curView))go(curTab,false);
  else goBack();
}

/* ==========================================================
   设置
   ========================================================== */
function loadSettings(){
  try{SET=Object.assign(SET,JSON.parse(localStorage.getItem('aside_set')||'{}'));}catch(e){}
  document.body.dataset.anim=SET.anim?'on':'off';
  document.getElementById('sAnim').classList.toggle('on',SET.anim);
  document.getElementById('sKeepAbort').classList.toggle('on',SET.keepAbort);
  document.getElementById('sBadgeToast').classList.toggle('on',SET.badgeToast);
  document.getElementById('sBgVeil').value=SET.appBgVeil;
  document.getElementById('sBgVeilVal').textContent=SET.appBgVeil+'%';
  document.getElementById('sBgBright').value=SET.appBgBright;
  document.getElementById('sBgBrightVal').textContent=SET.appBgBright+'%';
  document.querySelectorAll('#sClockStyle .pill').forEach(p=>p.classList.toggle('active',p.dataset.v===SET.clock));
  document.getElementById('focusScreen').dataset.clock=SET.clock;
  document.getElementById('noiseVol').value=SET.noiseVol;
  document.getElementById('noiseVolVal').textContent=SET.noiseVol+'%';
  document.getElementById('noiseVolFs').value=SET.noiseVol;
  document.getElementById('noiseVolFsVal').textContent=SET.noiseVol+'%';
  FK.charId=SET.lastCharId||null;
}
function saveSettings(){
  SET.anim=document.getElementById('sAnim').classList.contains('on');
  SET.keepAbort=document.getElementById('sKeepAbort').classList.contains('on');
  SET.badgeToast=document.getElementById('sBadgeToast').classList.contains('on');
  localStorage.setItem('aside_set',JSON.stringify(SET));
  document.body.dataset.anim=SET.anim?'on':'off';
}
async function applyAppBg(){
  const layer=document.getElementById('appBgLayer'),veil=document.getElementById('appBgVeil');
  const rec=await dbGet('assets','appbg');
  if(rec&&rec.data){
    layer.style.backgroundImage=`url(${rec.data})`;
    layer.style.filter=`brightness(${SET.appBgBright}%)`;
    veil.style.opacity=(SET.appBgVeil/100).toString();
    const p=document.getElementById('sBgPrev');p.style.backgroundImage=`url(${rec.data})`;p.innerHTML='';
  }else{
    layer.style.backgroundImage='';veil.style.opacity='0';
    const p=document.getElementById('sBgPrev');p.style.backgroundImage='';p.innerHTML='<span class="up-empty">未设置</span>';
  }
}
async function clearAppBg(){await dbDel('assets','appbg');applyAppBg();toast('已恢复默认背景');}

/* ==========================================================
   计划
   ========================================================== */
function toggleQa(){document.getElementById('quickAdd').classList.toggle('open');}
function toggleCal(id){
  const p=document.getElementById('cal-'+id);
  const open=p.classList.toggle('open');
  if(open){cal[id]={y:qa.date.getFullYear(),m:qa.date.getMonth()};renderCal(id);}
}
function calStep(id,n){
  cal[id].m+=n;if(cal[id].m<0){cal[id].m=11;cal[id].y--;}if(cal[id].m>11){cal[id].m=0;cal[id].y++;}
  renderCal(id);
}
function renderCal(id){
  const {y,m}=cal[id];
  document.getElementById('calY-'+id).textContent=y;
  document.getElementById('calM-'+id).textContent=MO[m];
  const first=new Date(y,m,1).getDay(),dim=new Date(y,m+1,0).getDate(),pdim=new Date(y,m,0).getDate();
  const today=midnight(new Date()),sel=midnight(qa.date);
  let cells=[];
  for(let i=first-1;i>=0;i--)cells.push({d:pdim-i,out:1,dt:new Date(y,m-1,pdim-i)});
  for(let i=1;i<=dim;i++)cells.push({d:i,out:0,dt:new Date(y,m,i)});
  let k=1;while(cells.length<42){cells.push({d:k,out:1,dt:new Date(y,m+1,k)});k++;}
  document.getElementById('calG-'+id).innerHTML=cells.map(c=>{
    const t=+midnight(c.dt)===+today,s=+midnight(c.dt)===+sel;
    return `<button class="cal-d${c.out?' out':''}${t?' today':''}${s?' sel':''}" data-t="${c.dt.getTime()}">${c.d}</button>`;
  }).join('');
  document.getElementById('calG-'+id).querySelectorAll('.cal-d').forEach(b=>b.onclick=()=>{
    qa.date=new Date(+b.dataset.t);cal[id]={y:qa.date.getFullYear(),m:qa.date.getMonth()};
    renderCal(id);updateQaDate();});
}
function updateQaDate(){
  const t=midnight(new Date()),d=midnight(qa.date);
  const diff=(d-t)/86400000;
  document.getElementById('qaDateTx').textContent=diff===0?'今天':(diff===1?'明天':(diff===-1?'昨天':ymd(qa.date)));
}
async function addPlan(){
  const title=document.getElementById('qaTitle').value.trim();
  if(!title){document.getElementById('qaTitle').focus();toast('先写下要做的事');return;}
  await dbPut('plans',{
    title,date:ymd(qa.date),time:document.getElementById('qaTime').value.trim(),
    pri:qa.pri,cat:qa.cat,pomo:qa.pomo,note:document.getElementById('qaNote').value.trim(),
    done:false,createdAt:Date.now(),
  });
  PLANS=await dbAll('plans');
  document.getElementById('qaTitle').value='';document.getElementById('qaNote').value='';
  document.getElementById('qaTime').value='';
  renderPlans();renderFkPlans();checkBadges();
  toast('已加入');
}
function renderPlanChips(){
  const items=[{v:'today',n:'今天'},{v:'tomorrow',n:'明天'},{v:'upcoming',n:'之后'},
    {v:'undone',n:'未完成'},{v:'done',n:'已完成'},{v:'all',n:'全部'}];
  const box=document.getElementById('planChips');
  box.innerHTML=items.map(x=>`<button class="chip${planFilter===x.v?' on':''}" data-v="${x.v}">${x.n}</button>`).join('');
  box.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{planFilter=b.dataset.v;renderPlanChips();renderPlans();});
}
function renderPlans(){
  const t=ymd(new Date()),tm=ymd(new Date(Date.now()+86400000));
  let list=PLANS.filter(p=>{
    if(planFilter==='today')return p.date===t;
    if(planFilter==='tomorrow')return p.date===tm;
    if(planFilter==='upcoming')return p.date>t;
    if(planFilter==='undone')return !p.done;
    if(planFilter==='done')return p.done;
    return true;
  });
  list.sort((a,b)=>{
    if(a.done!==b.done)return a.done?1:-1;
    if(a.date!==b.date)return a.date<b.date?-1:1;
    const pr={high:0,normal:1,low:2};
    if(pr[a.pri]!==pr[b.pri])return pr[a.pri]-pr[b.pri];
    return (a.time||'99')<(b.time||'99')?-1:1;
  });
  // 今日概况
  const now=new Date();
  document.getElementById('tdDay').textContent=pad(now.getDate());
  document.getElementById('tdMo').textContent=MOE[now.getMonth()];
  document.getElementById('tdWd').textContent=WDE[now.getDay()];
  const todayPlans=PLANS.filter(p=>p.date===t);
  const doneN=todayPlans.filter(p=>p.done).length;
  document.getElementById('tdDone').textContent=`${doneN} / ${todayPlans.length}`;
  document.getElementById('tdProgFill').style.width=(todayPlans.length?doneN/todayPlans.length*100:0)+'%';
  const mins=SESSIONS.filter(s=>!s.abort&&ymd(new Date(s.startAt))===t).reduce((a,b)=>a+(b.mins||0),0);
  document.getElementById('tdFocus').textContent=Math.round(mins)+' 分钟';

  const box=document.getElementById('planList');
  if(!list.length){
    box.innerHTML=`<div class="empty">
      <div class="empty-ring"><svg viewBox="0 0 24 24" class="ico"><rect x="4" y="4" width="16" height="17" rx="3"/><path d="M8 3v3M16 3v3M8.5 13l2 2 4-4"/></svg></div>
      <div class="empty-tx">这里还空着</div>
      <div class="empty-sub">在上面那一行写下一件事，哪怕很小。</div></div>`;
    return;
  }
  let html='',lastDate='';
  list.forEach((p,i)=>{
    if(p.date!==lastDate&&planFilter!=='today'){
      lastDate=p.date;
      const lb=p.date===t?'今天':(p.date===tm?'明天':p.date);
      html+=`<div class="plan-group-t">${esc(lb)}</div>`;
    }
    html+=planHTML(p,i);
  });
  box.innerHTML=html;
  box.querySelectorAll('.p-check').forEach(b=>b.onclick=async()=>{
    const p=PLANS.find(x=>x.id===+b.dataset.id);if(!p)return;
    p.done=!p.done;p.doneAt=p.done?Date.now():null;await dbPut('plans',p);
    PLANS=await dbAll('plans');renderPlans();renderFkPlans();checkBadges();});
  box.querySelectorAll('.p-go').forEach(b=>b.onclick=()=>{
    FK.planId=+b.dataset.id;go('focus');toast('已关联这个计划');});
  box.querySelectorAll('.p-del').forEach(b=>b.onclick=async()=>{
    await dbDel('plans',+b.dataset.id);PLANS=await dbAll('plans');renderPlans();renderFkPlans();toast('已删除');});
}
function planHTML(p,i){
  const prN={high:'要紧',normal:'寻常',low:'随缘'}[p.pri]||'寻常';
  return `<div class="plan pri-${p.pri}${p.done?' done':''}" style="animation-delay:${Math.min(i*40,320)}ms">
    <button class="p-check" data-id="${p.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L19 7"/></svg></button>
    <div class="p-main">
      <div class="p-title">${esc(p.title)}</div>
      <div class="p-meta">
        <span class="p-tag">${esc(p.cat)}</span>
        <span>${esc(prN)}</span>
        ${p.time?'<i></i><span>'+esc(p.time)+'</span>':''}
        ${p.pomo?'<i></i><span class="p-pomo">'+p.pomo+' 轮番茄</span>':''}
      </div>
      ${p.note?`<div class="p-note">${esc(p.note)}</div>`:''}
    </div>
    <div class="p-side">
      <button class="p-go" data-id="${p.id}" title="以此专注"><svg viewBox="0 0 24 24" class="ico sm"><circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 1.8"/></svg></button>
      <button class="p-go p-del" data-id="${p.id}" title="删除"><svg viewBox="0 0 24 24" class="ico sm"><path d="M5 7h14M10 7V5h4v2M8 7l1 12h6l1-12"/></svg></button>
    </div>
  </div>`;
}

/* ==========================================================
   专注设置
   ========================================================== */
async function loadChars(){CHARS=await getAllChars();WBS=await getAllWb();}
function renderCharGrid(){
  const box=document.getElementById('fkCharGrid');if(!box)return;
  if(!CHARS.length){box.innerHTML='<div class="mini-note" style="grid-column:1/-1">角色档案为空。请先到「角色档案」创建角色，这里才能读取到人设。</div>';return;}
  box.innerHTML=CHARS.map(c=>`<button class="char-cell${FK.charId===c.id?' on':''}" data-id="${c.id}">
    <span class="cg-av">${c.avatar?`<img src="${c.avatar}" alt=""/>`:esc((c.name||'?')[0])}</span>
    <span class="cg-nm">${esc(c.name)}</span>
    <span class="cg-rl">${esc(c.role||c.desc||'')}</span></button>`).join('');
  box.querySelectorAll('.char-cell').forEach(b=>b.onclick=()=>{
    FK.charId=+b.dataset.id;SET.lastCharId=FK.charId;saveSettings();renderCharGrid();});
}
function renderFkPlans(){
  const box=document.getElementById('fkPlanList');if(!box)return;
  const t=ymd(new Date());
  const list=PLANS.filter(p=>!p.done&&p.date<=t||(!p.done&&p.date===t)).slice(0,20);
  const all=PLANS.filter(p=>!p.done).sort((a,b)=>a.date<b.date?-1:1).slice(0,20);
  const use=all.length?all:list;
  if(!use.length){box.innerHTML='<div class="mini-note">目前没有未完成的计划。</div>';return;}
  box.innerHTML=`<button class="pick-i${FK.planId===null?' on':''}" data-id="">
      <span class="pi-mark"></span><span class="pi-t">不关联计划</span></button>`+
    use.map(p=>`<button class="pick-i${FK.planId===p.id?' on':''}" data-id="${p.id}">
      <span class="pi-mark"></span><span class="pi-t">${esc(p.title)}</span>
      <span class="pi-d">${esc(p.date===ymd(new Date())?'今天':p.date)}</span></button>`).join('');
  box.querySelectorAll('.pick-i').forEach(b=>b.onclick=()=>{
    FK.planId=b.dataset.id?+b.dataset.id:null;renderFkPlans();});
}
function renderBgRow(){
  const box=document.getElementById('fkBgRow');
  const extra=[];
  if(_userBgImg)extra.push({k:'img',n:'我的图',g:`url(${_userBgImg})`,img:1});
  if(_userBgVid)extra.push({k:'vid',n:'我的视频',g:'linear-gradient(160deg,#EFF1F7,#E2E7F0)'});
  box.innerHTML=BGS.concat(extra).map(b=>`<button class="bg-i${FK.bg===b.k?' on':''}" data-k="${b.k}"
    style="background:${b.img?`${b.g} center/cover`:b.g}"><span>${esc(b.n)}</span></button>`).join('');
  box.querySelectorAll('.bg-i').forEach(b=>b.onclick=()=>{FK.bg=b.dataset.k;renderBgRow();});
}
function renderNoiseGrid(id){
  const box=document.getElementById(id);if(!box)return;
  const list=NOISES.filter(n=>n.k!=='user'||_userNoiseUrl);
  box.innerHTML=list.map(n=>`<button class="noise-i${FK.noise===n.k?' on':''}" data-k="${n.k}">
    <span class="ni-wave"><i></i><i></i><i></i><i></i><i></i></span>
    <span class="ni-nm">${esc(n.n)}</span></button>`).join('');
  box.querySelectorAll('.noise-i').forEach(b=>b.onclick=()=>{
    FK.noise=b.dataset.k;renderNoiseGrid('noiseGrid');renderNoiseGrid('noiseGridFs');
    if(RUN.on)startNoise();});
}

/* ==========================================================
   白噪音引擎（Web Audio，无外部资源）
   ========================================================== */
let AC=null,noiseNodes=null,_userNoiseUrl=null,_userAudio=null;
let _userBgImg=null,_userBgVid=null;
function makeNoiseBuffer(ctx,type){
  const len=ctx.sampleRate*4,buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);
  let last=0,b=[0,0,0,0,0,0,0];
  for(let i=0;i<len;i++){
    const w=Math.random()*2-1;
    if(type==='brown'){last=(last+0.02*w)/1.02;d[i]=last*3.2;}
    else if(type==='pink'){
      b[0]=0.99886*b[0]+w*0.0555179;b[1]=0.99332*b[1]+w*0.0750759;b[2]=0.96900*b[2]+w*0.1538520;
      b[3]=0.86650*b[3]+w*0.3104856;b[4]=0.55000*b[4]+w*0.5329522;b[5]=-0.7616*b[5]-w*0.0168980;
      d[i]=(b[0]+b[1]+b[2]+b[3]+b[4]+b[5]+b[6]+w*0.5362)*0.11;b[6]=w*0.115926;
    }else d[i]=w;
  }
  return buf;
}
function stopNoise(){
  if(noiseNodes){try{noiseNodes.src.stop();}catch(e){}
    try{noiseNodes.lfo&&noiseNodes.lfo.stop();}catch(e){}noiseNodes=null;}
  if(_userAudio){_userAudio.pause();}
}
function startNoise(){
  stopNoise();
  const vol=SET.noiseVol/100;
  if(FK.noise==='none')return;
  if(FK.noise==='user'){
    if(!_userNoiseUrl)return;
    if(!_userAudio){_userAudio=new Audio(_userNoiseUrl);_userAudio.loop=true;}
    _userAudio.volume=vol;_userAudio.play().catch(()=>{});return;
  }
  if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)();
  if(AC.state==='suspended')AC.resume();
  const cfg={
    rain:  {t:'white', f:'lowpass',  fq:1400, q:0.7, g:0.5,  lfo:0},
    ocean: {t:'brown', f:'lowpass',  fq:520,  q:0.6, g:0.85, lfo:0.09},
    wind:  {t:'pink',  f:'bandpass', fq:480,  q:0.8, g:0.8,  lfo:0.06},
    fire:  {t:'brown', f:'lowpass',  fq:900,  q:0.9, g:0.75, lfo:0.5},
    stream:{t:'white', f:'bandpass', fq:2400, q:1.1, g:0.55, lfo:0.22},
    hush:  {t:'pink',  f:'lowpass',  fq:300,  q:0.5, g:0.5,  lfo:0},
  }[FK.noise];
  if(!cfg)return;
  const src=AC.createBufferSource();
  src.buffer=makeNoiseBuffer(AC,cfg.t);src.loop=true;
  const flt=AC.createBiquadFilter();flt.type=cfg.f;flt.frequency.value=cfg.fq;flt.Q.value=cfg.q;
  const gain=AC.createGain();gain.gain.value=vol*cfg.g;
  src.connect(flt);flt.connect(gain);gain.connect(AC.destination);
  let lfo=null;
  if(cfg.lfo){
    lfo=AC.createOscillator();lfo.frequency.value=cfg.lfo;
    const lg=AC.createGain();lg.gain.value=vol*cfg.g*0.45;
    lfo.connect(lg);lg.connect(gain.gain);lfo.start();
  }
  src.start();
  noiseNodes={src,gain,lfo};
}
function setNoiseVol(v){
  SET.noiseVol=v;saveSettings();
  if(noiseNodes)noiseNodes.gain.gain.value=v/100*0.7;
  if(_userAudio)_userAudio.volume=v/100;
}
async function clearUserNoise(){
  await dbDel('assets','noise');_userNoiseUrl=null;_userAudio=null;
  if(FK.noise==='user')FK.noise='none';
  renderNoiseGrid('noiseGrid');renderNoiseGrid('noiseGridFs');toast('已清除自定义音频');
}

/* ==========================================================
   AI
   ========================================================== */
function apiConf(){
  let cur={};try{cur=JSON.parse(localStorage.getItem('luna_api_current')||'{}');}catch(e){}
  return {baseUrl:(cur.baseUrl||'').replace(/\/$/,''),apiKey:cur.apiKey||'',model:localStorage.getItem('luna_api_model')||''};
}
function renderApiFace(){
  const a=apiConf(),ok=a.baseUrl&&a.apiKey&&a.model;
  document.getElementById('apiFace').innerHTML=`
    <div class="af-row"><b>STATUS</b><span><i class="af-dot${ok?' ok':''}"></i>${ok?'已就绪':'未配置完整'}</span></div>
    <div class="af-row"><b>ENDPOINT</b><span>${esc(a.baseUrl||'—')}</span></div>
    <div class="af-row"><b>MODEL</b><span>${esc(a.model||'—')}</span></div>`;
}
async function callAI(system,user,maxTokens,temp){
  const a=apiConf();
  if(!a.baseUrl||!a.apiKey)throw new Error('尚未配置接口地址与密钥，请到系统设置页填写。');
  if(!a.model)throw new Error('尚未选择模型，请到系统设置页选择一个模型。');
  const r=await fetch(`${a.baseUrl}/chat/completions`,{
    method:'POST',headers:{'Authorization':`Bearer ${a.apiKey}`,'Content-Type':'application/json'},
    body:JSON.stringify({model:a.model,messages:[{role:'system',content:system},{role:'user',content:user}],
      temperature:temp==null?0.95:temp,max_tokens:maxTokens||1600})});
  if(!r.ok)throw new Error(`接口返回 HTTP ${r.status}`);
  const d=await r.json();
  const t=d.choices?.[0]?.message?.content;
  if(!t)throw new Error('接口没有返回内容');
  return t;
}
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
  L.push('【角色档案 —— 以下每一条都是既定事实，必须完全遵守，不得改写或虚构】');
  add('姓名',c.name);add('身份/称谓',c.role);add('性别',c.gender);add('年龄',c.age);
  add('生日',c.birthday);add('种族/物种',c.species);add('一句话简介',c.desc);add('性格标签',c.traits);
  add('外貌',c.appearance);add('常穿着装',c.outfit);
  add('喜欢',c.likes);add('讨厌',c.dislikes);add('害怕/软肋',c.fears);
  add('说话风格',c.speechStyle);add('口头禅',c.catchphrases);add('使用语言',c.lang);
  add('背景故事',c.backstory);add('当前情景',c.scenario);
  add('与用户的关系',c.relation);add('对用户的称呼',c.callUser);add('关系细节',c.relationDetail);
  add('初次问候',c.firstMes);
  if(Array.isArray(c.dialogExamples)&&c.dialogExamples.length){
    L.push('对话范例（模仿其语气与节奏）：');
    c.dialogExamples.slice(0,6).forEach(d=>{
      if(d.user)L.push(`  用户：${d.user}`);
      if(d.char)L.push(`  ${c.name}：${d.char}`);
    });
  }
  add('绝对不会做的事',c.neverList);add('边界',c.boundaries);
  add('人称视角',c.pov);add('动作描写标记',c.actionMark);
  if(c.prompt)L.push(`【角色提示词原文】\n${c.prompt}`);
  const wb=wbFor(c.id);if(wb)L.push(wb);
  return L.join('\n');
}
function nowContext(){
  const tz=localStorage.getItem('luna_tz')||'Asia/Shanghai';
  const n=new Date();
  return `【现实此刻】今天是 ${n.toLocaleDateString('zh-CN',{timeZone:tz,year:'numeric',month:'long',day:'numeric',weekday:'long'})}，当前时间 ${n.toLocaleTimeString('zh-CN',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false})}。时态判断以此为准。`;
}
function styleRules(){
  return `【行文硬性规则】
1. 全程第一人称，就是角色本人在说话，不要出现"作为AI""以下是"等系统腔。
2. 严禁使用 emoji、颜文字、表情符号与 Markdown 标记（# * - 等）。
3. 不写标题、不分点、不写"正文如下"这类提示语。
4. 语气、用词、称呼严格贴合档案中的说话风格、口头禅、对用户的称呼与关系。
5. 不得编造与档案冲突的设定。`;
}
const stripFence=t=>String(t).replace(/```[a-zA-Z]*\s*/g,'').replace(/```/g,'').replace(/[#*`>]/g,'').trim();

/* ==========================================================
   专注运行时
   ========================================================== */
const RUN={on:false,phase:'focus',round:1,rounds:1,left:0,total:0,paused:false,
  timer:null,lineTimer:null,startAt:0,pauses:0,focusedSec:0,char:null,plan:null,lines:[]};

function startFocus(){
  const st=document.getElementById('fkStatus');
  if(!FK.charId){st.innerHTML=`<div class="gs-box err"><div class="gs-tx">请先选择一位陪你的角色。</div></div>`;return;}
  const c=CHARS.find(x=>x.id===FK.charId);
  if(!c){st.innerHTML=`<div class="gs-box err"><div class="gs-tx">角色读取失败。</div></div>`;return;}
  st.innerHTML='';
  RUN.on=true;RUN.phase='focus';RUN.round=1;RUN.rounds=FK.rounds;
  RUN.total=FK.mins*60;RUN.left=RUN.total;RUN.paused=false;
  RUN.startAt=Date.now();RUN.pauses=0;RUN.focusedSec=0;RUN.char=c;RUN.lines=[];
  RUN.plan=PLANS.find(p=>p.id===FK.planId)||null;

  const fs=document.getElementById('focusScreen');
  fs.dataset.phase='focus';fs.dataset.clock=SET.clock;
  fs.classList.add('on');
  document.getElementById('fsStream').innerHTML='';
  document.getElementById('doneLayer').classList.remove('on');
  document.getElementById('quitSheet').classList.remove('on');
  document.getElementById('fsWith').innerHTML=`<span class="fw-av">${c.avatar?`<img src="${c.avatar}" alt=""/>`:esc((c.name||'?')[0])}</span><span class="fw-nm">${esc(c.name)} 在旁边</span>`;
  document.getElementById('fsTask').textContent=RUN.plan?RUN.plan.title:'';
  applyFocusBg();renderTicks();renderNoiseGrid('noiseGridFs');
  startNoise();
  tickRender();
  clearInterval(RUN.timer);RUN.timer=setInterval(tick,1000);
  scheduleLine(true);
  if(SET.anim)greet();
  requestWakeLock();
}
function applyFocusBg(){
  const bg=document.getElementById('fsBg'),vid=document.getElementById('fsVideo');
  vid.classList.remove('on');vid.pause();
  document.getElementById('fsVeil').style.background=
    `linear-gradient(180deg,rgba(255,255,255,${0.20+FK.veil/100*0.55}),rgba(255,255,255,${0.10+FK.veil/100*0.5}) 40%,rgba(255,255,255,${0.25+FK.veil/100*0.55}))`;
  if(FK.bg==='vid'&&_userBgVid){
    vid.src=_userBgVid;vid.classList.add('on');vid.play().catch(()=>{});bg.style.background='';
  }else if(FK.bg==='img'&&_userBgImg){
    bg.style.background=`url(${_userBgImg}) center/cover no-repeat`;
  }else{
    const b=BGS.find(x=>x.k===FK.bg)||BGS[0];bg.style.background=b.g;
  }
}
function renderTicks(){
  const box=document.getElementById('fscTicks');
  box.innerHTML=Array.from({length:60},(_,i)=>
    `<i style="transform:translateX(-50%) rotate(${i*6}deg);opacity:${i%5===0?0.5:0.2}"></i>`).join('');
}
function tick(){
  if(RUN.paused)return;
  RUN.left--;
  if(RUN.phase==='focus')RUN.focusedSec++;
  if(RUN.left<=0){nextPhase();return;}
  tickRender();
}
function tickRender(){
  document.getElementById('fsTime').textContent=mmss(Math.max(0,RUN.left));
  document.getElementById('fsRound').textContent=`ROUND ${RUN.round} / ${RUN.rounds}`;
  document.getElementById('fsPhase').textContent=RUN.phase==='focus'?'FOCUS':(RUN.phase==='break'?'BREAK':'LONG BREAK');
  const C=729;
  const p=RUN.total?(RUN.total-RUN.left)/RUN.total:0;
  document.getElementById('fscFill').style.strokeDashoffset=String(C*(1-p));
}
function togglePause(){
  RUN.paused=!RUN.paused;
  if(RUN.paused)RUN.pauses++;
  const b=document.getElementById('fsPause');
  b.innerHTML=RUN.paused
    ?`<svg viewBox="0 0 24 24" class="ico"><path d="M7 4l13 8-13 8z"/></svg><span>继续</span>`
    :`<svg viewBox="0 0 24 24" class="ico"><path d="M9 5v14M15 5v14"/></svg><span>暂停</span>`;
  if(RUN.paused)stopNoise();else startNoise();
}
function nextPhase(){
  chime();
  if(RUN.phase==='focus'){
    if(RUN.round>=RUN.rounds){finishFocus(false);return;}
    const isLong=RUN.round%4===0;
    RUN.phase=isLong?'long':'break';
    RUN.total=(isLong?FK.lbrk:FK.brk)*60;RUN.left=RUN.total;
    document.getElementById('focusScreen').dataset.phase='break';
    pushLine(`这一轮结束了。休息 ${isLong?FK.lbrk:FK.brk} 分钟，我等你。`,true);
  }else{
    RUN.round++;RUN.phase='focus';RUN.total=FK.mins*60;RUN.left=RUN.total;
    document.getElementById('focusScreen').dataset.phase='focus';
    pushLine('回来了。第 '+RUN.round+' 轮，开始吧。',true);
  }
  tickRender();
}
function chime(){
  if(!document.getElementById('swChime').classList.contains('on'))return;
  try{
    if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)();
    const t=AC.currentTime;
    [880,1174.7].forEach((f,i)=>{
      const o=AC.createOscillator(),g=AC.createGain();
      o.type='sine';o.frequency.value=f;
      g.gain.setValueAtTime(0,t+i*0.16);
      g.gain.linearRampToValueAtTime(0.12,t+i*0.16+0.02);
      g.gain.exponentialRampToValueAtTime(0.0008,t+i*0.16+1.5);
      o.connect(g);g.connect(AC.destination);o.start(t+i*0.16);o.stop(t+i*0.16+1.6);
    });
  }catch(e){}
}
function requestWakeLock(){
  if(!document.getElementById('swWake').classList.contains('on'))return;
  if('wakeLock' in navigator){navigator.wakeLock.request('screen').then(l=>{RUN.wake=l;}).catch(()=>{});}
}
function releaseWake(){try{RUN.wake&&RUN.wake.release();}catch(e){}RUN.wake=null;}

/* ---- 陪伴语 ---- */
function pushLine(text,local){
  const box=document.getElementById('fsStream');
  const el=document.createElement('div');
  el.className='line';
  el.innerHTML=`<span class="line-who">${esc(RUN.char?RUN.char.name:'')}</span>${esc(text)}`;
  box.appendChild(el);
  RUN.lines.push({t:text,at:Date.now(),local:!!local});
  while(box.children.length>4){
    const first=box.firstElementChild;first.classList.add('out');
    setTimeout(()=>first.remove(),480);break;
  }
  box.scrollTop=box.scrollHeight;
}
function showTyping(){
  const box=document.getElementById('fsStream');
  const el=document.createElement('div');
  el.className='line typing';el.id='typingLine';
  el.innerHTML='<i></i><i></i><i></i>';
  box.appendChild(el);
  while(box.children.length>4){box.firstElementChild.remove();}
}
function hideTyping(){const el=document.getElementById('typingLine');if(el)el.remove();}
function scheduleLine(first){
  clearTimeout(RUN.lineTimer);
  if(FK.freq==='off')return;
  const range={rare:[420,720],normal:[180,360],often:[80,180]}[FK.freq]||[180,360];
  const wait=(first?Math.round(range[0]*0.5):range[0])+Math.random()*(range[1]-range[0]);
  RUN.lineTimer=setTimeout(async()=>{
    if(RUN.on&&!RUN.paused)await requestLine(false);
    if(RUN.on)scheduleLine(false);
  },wait*1000);
}
async function greet(){
  setTimeout(()=>{if(RUN.on)requestLine(false,true);},2600);
}
let _lineBusy=false;
async function requestLine(manual,isGreet){
  if(_lineBusy||!RUN.on||!RUN.char)return;
  _lineBusy=true;showTyping();
  const c=RUN.char;
  const elapsed=Math.round(RUN.focusedSec/60);
  const leftMin=Math.round(RUN.left/60);
  const sys=`你现在就是「${c.name}」本人，正陪着用户一起做事。你就坐在旁边，不打扰，只偶尔说一句话。
${buildCharContext(c)}
${nowContext()}
${styleRules()}`;
  const usr=`${isGreet?'用户刚刚坐下来，准备开始专注。请说一句开场的话。':
    (manual?'用户主动看向了你，想听你说点什么。':'现在是随机的一个时刻，你忽然想说一句话。')}
当前状态：${RUN.phase==='focus'?'正在专注':'正在休息'}，已经过去约 ${elapsed} 分钟，本轮还剩约 ${leftMin} 分钟，这是第 ${RUN.round} 轮（共 ${RUN.rounds} 轮）。
${RUN.plan?`用户这一轮要做的事：${RUN.plan.title}${RUN.plan.note?'（'+RUN.plan.note+'）':''}`:''}
${RUN.lines.length?`你刚才已经说过的话（不要重复意思）：${RUN.lines.slice(-4).map(l=>l.t).join(' / ')}`:''}

只说一句话，20 到 45 个字之间。要像真的在身边：可以提一句手边的动作、窗外的光、桌上的杯子、你自己在做什么，也可以只是短短一句提醒或陪伴。
不要问需要用户回答的问题，不要说教，不要写旁白说明。直接输出这一句话，不要引号。`;
  try{
    const t=await callAI(sys,usr,220,1.0);
    hideTyping();
    pushLine(stripFence(t).replace(/^["'「『]|["'」』]$/g,'').slice(0,120));
  }catch(e){
    hideTyping();
    if(manual)pushLine('（接口暂时没有回应：'+e.message+'）',true);
  }finally{_lineBusy=false;}
}

/* ---- 结束 ---- */
function askQuit(){
  document.getElementById('qsSub').textContent=
    RUN.phase==='focus'?`这一轮还剩 ${Math.ceil(RUN.left/60)} 分钟。`:'休息还没结束。';
  document.getElementById('quitSheet').classList.add('on');
}
function closeQuit(){document.getElementById('quitSheet').classList.remove('on');}
function abortFocus(){closeQuit();finishFocus(true);}
function finishEarly(){finishFocus(false);}

async function finishFocus(abort){
  clearInterval(RUN.timer);clearTimeout(RUN.lineTimer);
  RUN.on=false;stopNoise();releaseWake();
  const mins=Math.round(RUN.focusedSec/60*10)/10;
  const c=RUN.char;
  const rec={
    charId:c?c.id:null,charName:c?c.name:'',charAvatar:c?(c.avatar||''):'',
    planId:RUN.plan?RUN.plan.id:null,planTitle:RUN.plan?RUN.plan.title:'',
    mins,plannedMins:FK.mins*RUN.rounds,rounds:RUN.round,pauses:RUN.pauses,
    noise:FK.noise,bg:FK.bg,abort:!!abort,
    startAt:RUN.startAt,endAt:Date.now(),
    lines:RUN.lines.filter(l=>!l.local).map(l=>l.t).slice(-8),
    insight:'',fav:false,
  };
  if(abort&&!SET.keepAbort){
    document.getElementById('focusScreen').classList.remove('on');
    toast('已离开，这一次没有计入档案');return;
  }
  const id=await dbPut('sessions',rec);
  rec.id=id;
  SESSIONS=await dbAll('sessions');

  // 完成层
  const dl=document.getElementById('doneLayer');
  document.getElementById('doneScroll').innerHTML=doneHTML(rec,abort);
  dl.classList.add('on');
  bindDone(rec);

  const fresh=checkBadges(true);
  if(fresh.length&&SET.badgeToast)setTimeout(()=>popBadge(fresh[0],fresh.length),900);
  renderPlans();

  // 角色即时反应
  if(c)reactAndInsight(rec,abort);
}
function doneHTML(rec,abort){
  const c=rec.charName;
  return `<div class="dn-crest">
      <div class="dn-ring"><b>${Math.round(rec.mins)}</b></div>
      <div class="dn-kick">${abort?'ENDED EARLY':'COMPLETED'} · ${new Date(rec.endAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false})}</div>
      <div class="dn-t">${abort?'先到这里':'这一段走完了'}</div>
    </div>
    <div class="dn-stats">
      <div class="dn-st"><b>${Math.round(rec.mins)}</b><span>MINUTES</span></div>
      <div class="dn-st"><b>${rec.rounds}</b><span>ROUNDS</span></div>
      <div class="dn-st"><b>${rec.pauses}</b><span>PAUSES</span></div>
    </div>
    ${rec.planTitle?`<div class="dt-panel" style="margin-bottom:18px">
      <div class="dt-kv"><b>这一轮做的事</b><span>${esc(rec.planTitle)}</span></div>
      <div class="dt-kv"><b>陪你的人</b><span>${esc(c)}</span></div>
    </div>`:''}
    <div class="dn-sheet" id="dnSheet">
      <div class="dn-by"><div class="char-mini"><div class="cm-av">${rec.charAvatar?`<img src="${rec.charAvatar}" alt=""/>`:esc((c||'?')[0])}</div><div class="cm-nm">${esc(c)} 的陪伴感悟</div></div></div>
      <div class="dn-orn"><i></i><b></b><i></i></div>
      <div class="dn-body" id="dnBody"><div class="gs-box"><div class="spin"></div><div class="gs-tx">正在写…</div></div></div>
    </div>
    <div class="dn-acts">
      <button class="ghost-btn" id="dnAgain">再来一段</button>
      <button class="solid-btn" id="dnClose">回到计划</button>
    </div>
    <div class="foot-rule"><span>ASIDE</span></div>`;
}
function bindDone(rec){
  document.getElementById('dnClose').onclick=()=>{
    document.getElementById('doneLayer').classList.remove('on');
    document.getElementById('focusScreen').classList.remove('on');
    go('plan',false);renderPlans();};
  document.getElementById('dnAgain').onclick=()=>{
    document.getElementById('doneLayer').classList.remove('on');
    document.getElementById('focusScreen').classList.remove('on');
    go('focus',false);};
}
async function reactAndInsight(rec,abort){
  const c=CHARS.find(x=>x.id===rec.charId);if(!c)return;
  const body=document.getElementById('dnBody');
  if(!document.getElementById('swInsight').classList.contains('on')){
    if(body)body.innerHTML='<p>（本次未请角色写感悟。）</p>';return;
  }
  const sys=`你现在就是「${c.name}」本人。刚刚你一直陪在用户身边，看着他做完这一段。现在轮到你写下一点东西。
${buildCharContext(c)}
${nowContext()}
${styleRules()}`;
  const usr=`【这一段的事实】
开始时间：${new Date(rec.startAt).toLocaleString('zh-CN')}
结束时间：${new Date(rec.endAt).toLocaleString('zh-CN')}
实际专注：${Math.round(rec.mins)} 分钟，共 ${rec.rounds} 轮，中途暂停 ${rec.pauses} 次。
${abort?'这一次他提前离开了，没有走完原定的时间。':'这一次他把预定的时间走完了。'}
${rec.planTitle?`他这一轮要做的事是：${rec.planTitle}`:'他没有specific地标注要做什么。'}
${rec.noise&&rec.noise!=='none'?`背景里一直有${({rain:'雨声',ocean:'潮汐声',wind:'风声',fire:'炉火声',stream:'溪流声',hush:'很轻的白噪',user:'他自己选的声音'})[rec.noise]||'一点声音'}。`:'房间里很安静，没有开背景音。'}
${rec.lines.length?`你在这段时间里说过的话：${rec.lines.join(' / ')}`:''}

【要写的东西】
写一篇不少于 350 字的"陪伴感悟"，是你在这一段结束之后的独白。
要求：
1. 必须用到上面的具体事实——时长、轮次、暂停次数、是否提前结束、他做的那件事、背景声音。不要写成放之四海皆准的鼓励话。
2. 要有你自己的视角与细节：你在旁边做了什么、看到了什么、想到了什么。
3. ${abort?'他提前离开了，你的态度要符合你的人设，不要一味责备，也不要假装没发生。':'他坚持完了，你的反应要符合你的人设，不要写成千篇一律的夸奖。'}
4. 分成 3 到 5 个自然段，段与段之间空一行。
5. 直接输出正文，第一个字就是感悟的开头。`;
  try{
    let t=await callAI(sys,usr,2200,0.95);
    t=stripFence(t);
    if(t.replace(/\s/g,'').length<280){
      const more=await callAI(sys,`你刚才写的感悟太短了（只有 ${t.replace(/\s/g,'').length} 字），要求不少于 350 字。请重新完整写一遍，更长更具体，保持同样的事实与人称。以下是你刚才写的：\n\n${t}`,2400,0.95);
      const t2=stripFence(more);
      if(t2.replace(/\s/g,'').length>t.replace(/\s/g,'').length)t=t2;
    }
    rec.insight=t;rec.words=t.replace(/\s/g,'').length;
    await dbPut('sessions',rec);
    SESSIONS=await dbAll('sessions');
    if(body)body.innerHTML=t.split(/\n+/).filter(Boolean).map(p=>`<p>${esc(p)}</p>`).join('');
    checkBadges(true);
  }catch(e){
    if(body)body.innerHTML=`<div class="gs-box err"><div class="gs-tx">${esc(e.message||'感悟生成失败')}。可稍后在档案页重试。</div></div>`;
  }
}

/* ==========================================================
   档案
   ========================================================== */
function renderLog(){
  const st=computeStats();
  document.getElementById('stTotalH').textContent=(st.mins/60).toFixed(1);
  document.getElementById('stSessions').textContent=st.done;
  document.getElementById('stStreak').textContent=st.streakNow;
  document.getElementById('stBest').textContent=Math.round(st.bestSession);
  document.getElementById('stPlans').textContent=st.planDone;

  // 热力
  const heat=document.getElementById('heat');
  let h='';
  for(let i=29;i>=0;i--){
    const d=ymd(new Date(Date.now()-i*86400000));
    const m=st.byDay[d]||0;
    const lv=m===0?0:(m<15?1:(m<40?2:(m<90?3:4)));
    h+=`<i class="l${lv}" title="${d}"></i>`;
  }
  heat.innerHTML=h;

  // 角色分布
  const bars=document.getElementById('charBars');
  const ents=Object.entries(st.byChar).sort((a,b)=>b[1].m-a[1].m).slice(0,6);
  const max=ents.length?ents[0][1].m:1;
  bars.innerHTML=ents.length?ents.map(([n,v])=>`<div class="bar-i">
    <span class="bi-nm">${esc(n)}</span>
    <span class="bi-tr"><span class="bi-fl" style="width:${Math.max(4,v.m/max*100)}%"></span></span>
    <span class="bi-v">${Math.round(v.m)}分 · ${v.c}次</span></div>`).join('')
    :'<div class="mini-note">还没有记录。</div>';

  // 筛选
  const names=[...new Set(SESSIONS.map(s=>s.charName).filter(Boolean))];
  const chips=[{v:'all',n:'全部'},{v:'insight',n:'有感悟'},{v:'fav',n:'收藏'}].concat(names.map(n=>({v:'c:'+n,n})));
  const cb=document.getElementById('logChips');
  cb.innerHTML=chips.map(x=>`<button class="chip${logFilter===x.v?' on':''}" data-v="${x.v}">${esc(x.n)}</button>`).join('');
  cb.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{logFilter=b.dataset.v;renderLog();});

  let list=[...SESSIONS].sort((a,b)=>b.startAt-a.startAt);
  if(logFilter==='insight')list=list.filter(s=>s.insight);
  else if(logFilter==='fav')list=list.filter(s=>s.fav);
  else if(logFilter.startsWith('c:'))list=list.filter(s=>s.charName===logFilter.slice(2));

  const box=document.getElementById('logList');
  if(!list.length){
    box.innerHTML=`<div class="empty">
      <div class="empty-ring"><svg viewBox="0 0 24 24" class="ico"><path d="M5 4h14v16H5z"/><path d="M9 9h6M9 13h6M9 17h3"/></svg></div>
      <div class="empty-tx">档案还是空的</div>
      <div class="empty-sub">完成一次专注，这里就会留下第一条记录。</div></div>`;
    return;
  }
  box.innerHTML=list.map((s,i)=>logHTML(s,i)).join('');
  box.querySelectorAll('.log').forEach(el=>el.onclick=ev=>{
    if(ev.target.closest('.log-act'))return;
    const s=SESSIONS.find(x=>x.id===+el.dataset.id);
    if(s&&s.insight)openRead(s.id);else toast('这一条没有感悟');
  });
  box.querySelectorAll('.log-act').forEach(b=>b.onclick=async ev=>{
    ev.stopPropagation();
    const s=SESSIONS.find(x=>x.id===+b.dataset.id);if(!s)return;
    if(b.dataset.a==='fav'){s.fav=!s.fav;await dbPut('sessions',s);SESSIONS=await dbAll('sessions');renderLog();checkBadges();}
    if(b.dataset.a==='del'){await dbDel('sessions',s.id);SESSIONS=await dbAll('sessions');renderLog();toast('已删除记录');}
  });
}
function logHTML(s,i){
  const d=new Date(s.startAt);
  return `<article class="log${s.abort?' abort':''}" data-id="${s.id}" style="animation-delay:${Math.min(i*40,320)}ms">
    <div class="log-top">
      <div class="log-l">
        <div class="log-kick">${d.toLocaleDateString('zh-CN')} · ${pad(d.getHours())}:${pad(d.getMinutes())} · ${s.abort?'提前结束':'完成'}</div>
        <div class="log-t">${esc(s.planTitle||'一段专注')}</div>
      </div>
      <div class="log-min"><b>${Math.round(s.mins)}</b><span>MIN</span></div>
    </div>
    <div class="log-meta">
      <div class="char-mini"><div class="cm-av">${s.charAvatar?`<img src="${s.charAvatar}" alt=""/>`:esc((s.charName||'?')[0])}</div>
        <div class="cm-nm">${esc(s.charName||'')}</div></div>
      <span class="lm-c">${s.rounds} 轮 · 暂停 ${s.pauses} 次</span>
      <div class="log-acts" style="margin-left:auto">
        <button class="log-act${s.fav?' on':''}" data-a="fav" data-id="${s.id}">
          <svg viewBox="0 0 24 24" class="ico sm"><path d="M12 20s-6.5-4.2-6.5-9A3.5 3.5 0 0112 8.2 3.5 3.5 0 0118.5 11c0 4.8-6.5 9-6.5 9z"/></svg></button>
        <button class="log-act" data-a="del" data-id="${s.id}">
          <svg viewBox="0 0 24 24" class="ico sm"><path d="M5 7h14M10 7V5h4v2M8 7l1 12h6l1-12"/></svg></button>
      </div>
    </div>
    ${s.insight?`<div class="log-quote">${esc(s.insight.replace(/\n+/g,' '))}</div>`:''}
  </article>`;
}
function openRead(id){
  const s=SESSIONS.find(x=>x.id===id);if(!s)return;
  const paras=String(s.insight||'').split(/\n+/).filter(Boolean).map(p=>`<p>${esc(p)}</p>`).join('');
  document.getElementById('readScroll').innerHTML=`
    <div class="rd-head">
      <div class="rd-kick">${new Date(s.startAt).toLocaleDateString('zh-CN')} · ${Math.round(s.mins)} 分钟</div>
      <div class="rd-t">${esc(s.planTitle||'一段专注')}</div>
      <div class="rd-by"><div class="char-mini"><div class="cm-av">${s.charAvatar?`<img src="${s.charAvatar}" alt=""/>`:esc((s.charName||'?')[0])}</div>
        <div class="cm-nm">${esc(s.charName||'')} 执笔 · ${s.words||String(s.insight||'').replace(/\s/g,'').length} 字</div></div></div>
    </div>
    <div class="dn-orn"><i></i><b></b><i></i></div>
    <div class="rd-sheet"><div class="rd-body">${paras}</div></div>
    <div class="dt-sec"><div class="dt-sec-t">SESSION</div>
      <div class="dt-panel">
        <div class="dt-kv"><b>轮次</b><span>${s.rounds} 轮</span></div>
        <div class="dt-kv"><b>暂停</b><span>${s.pauses} 次</span></div>
        <div class="dt-kv"><b>白噪音</b><span>${esc((NOISES.find(n=>n.k===s.noise)||{n:'关闭'}).n)}</span></div>
        <div class="dt-kv"><b>状态</b><span>${s.abort?'提前结束':'完整走完'}</span></div>
      </div></div>
    ${s.lines&&s.lines.length?`<div class="dt-sec"><div class="dt-sec-t">当时说过的话</div>
      <div class="dt-panel">${s.lines.map(l=>`<div class="dt-kv"><span style="text-align:left">${esc(l)}</span></div>`).join('')}</div></div>`:''}
    <div class="dn-acts">
      <button class="ghost-btn" id="rdFav">${s.fav?'取消收藏':'收藏这篇'}</button>
      <button class="solid-btn" id="rdCopy">复制全文</button>
    </div>
    <div class="foot-rule"><span>END</span></div>`;
  go('read');
  document.getElementById('rdFav').onclick=async()=>{
    s.fav=!s.fav;await dbPut('sessions',s);SESSIONS=await dbAll('sessions');openRead(id);checkBadges();};
  document.getElementById('rdCopy').onclick=()=>{
    navigator.clipboard?.writeText(s.insight||'').then(()=>toast('全文已复制')).catch(()=>toast('复制失败'));};
}

/* ==========================================================
   徽章渲染
   ========================================================== */
let badgeFilter='all';
function renderBadges(){
  const st=computeStats();
  const got=new Set(SET.unlocked||[]);
  document.getElementById('bhNum').textContent=got.size;
  document.getElementById('bhAll').textContent='/ '+BADGES.length;
  document.getElementById('bhFill').style.strokeDashoffset=String(327*(1-got.size/BADGES.length));
  document.getElementById('bhSub').textContent=got.size
    ?`已经收下 ${got.size} 枚。还有 ${BADGES.length-got.size} 枚在前面等着。`
    :'每一次坐下来，都会留下一点痕迹。';

  const cats=['all',...new Set(BADGES.map(b=>b.c))];
  const cb=document.getElementById('badgeChips');
  cb.innerHTML=cats.map(c=>`<button class="chip${badgeFilter===c?' on':''}" data-v="${c}">${c==='all'?'全部':c}</button>`).join('');
  cb.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{badgeFilter=b.dataset.v;renderBadges();});

  const list=BADGES.filter(b=>badgeFilter==='all'||b.c===badgeFilter);
  document.getElementById('badgeGrid').innerHTML=list.map((b,i)=>{
    const v=b.f(st)||0,on=got.has(b.k);
    const pg=Math.min(1,v/b.goal);
    return `<div class="badge${on?' got':''}" style="animation-delay:${Math.min(i*35,400)}ms">
      <div class="bg-medal"><span class="bm-ring"></span><span class="bm-ring2"></span>
        <span class="bm-core">${esc(b.n[0])}</span></div>
      <div class="b-nm">${esc(b.n)}</div>
      <div class="b-dc">${esc(b.d)}</div>
      ${on?'':`<div class="b-pg"><i style="width:${pg*100}%"></i></div>`}
    </div>`;
  }).join('');
}

/* ==========================================================
   备份
   ========================================================== */
async function exportData(){
  const d={v:1,exportedAt:Date.now(),plans:PLANS,sessions:SESSIONS,settings:SET};
  const b=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);
  a.download=`aside-backup-${ymd(new Date())}.json`;a.click();URL.revokeObjectURL(a.href);
  document.getElementById('dataStatus').textContent='备份已导出。';
}

/* ==========================================================
   绑定
   ========================================================== */
function readFile(f,cb,maxMB){
  if(!f)return;
  if(f.size>(maxMB||6)*1024*1024){toast(`文件过大，请选择 ${maxMB||6}MB 以内的文件`);return;}
  const r=new FileReader();r.onload=e=>cb(e.target.result);r.readAsDataURL(f);
}
function pillGroup(id,fn){
  const box=document.getElementById(id);if(!box)return;
  box.querySelectorAll('.pill').forEach(p=>p.onclick=()=>{
    box.querySelectorAll('.pill').forEach(x=>x.classList.remove('active'));
    p.classList.add('active');fn(p.dataset.v);});
}
function bind(){
  pillGroup('qaPri',v=>qa.pri=v);
  pillGroup('qaCat',v=>qa.cat=v);
  pillGroup('qaPomo',v=>qa.pomo=+v);
  pillGroup('fkFreq',v=>FK.freq=v);
  pillGroup('fkPreset',v=>{FK.mins=+v;document.getElementById('dialNum').textContent=v;
    document.getElementById('dialRange').value=v;});
  pillGroup('sClockStyle',v=>{SET.clock=v;document.getElementById('focusScreen').dataset.clock=v;saveSettings();});

  document.getElementById('dialRange').oninput=e=>{
    FK.mins=+e.target.value;document.getElementById('dialNum').textContent=e.target.value;
    document.querySelectorAll('#fkPreset .pill').forEach(p=>p.classList.toggle('active',p.dataset.v===e.target.value));};

  document.querySelectorAll('.stepper button').forEach(b=>b.onclick=()=>{
    const t=b.dataset.t,dir=b.dataset.a==='+'?1:-1;
    const lim={brk:[1,30],lbrk:[5,60],rounds:[1,12]}[t];
    FK[t]=Math.max(lim[0],Math.min(lim[1],FK[t]+dir));
    document.getElementById({brk:'valBrk',lbrk:'valLbrk',rounds:'valRounds'}[t]).textContent=FK[t];});

  document.getElementById('qaTime').oninput=e=>{
    let v=e.target.value.replace(/[^\d]/g,'').slice(0,4);
    if(v.length>=3)v=v.slice(0,2)+':'+v.slice(2);e.target.value=v;};

  document.getElementById('qaTitle').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addPlan();}};

  document.getElementById('fkVeil').oninput=e=>{
    FK.veil=+e.target.value;document.getElementById('fkVeilVal').textContent=e.target.value+'%';
    if(RUN.on)applyFocusBg();};
  document.getElementById('noiseVol').oninput=e=>{
    document.getElementById('noiseVolVal').textContent=e.target.value+'%';
    document.getElementById('noiseVolFs').value=e.target.value;
    document.getElementById('noiseVolFsVal').textContent=e.target.value+'%';setNoiseVol(+e.target.value);};
  document.getElementById('noiseVolFs').oninput=e=>{
    document.getElementById('noiseVolFsVal').textContent=e.target.value+'%';
    document.getElementById('noiseVol').value=e.target.value;
    document.getElementById('noiseVolVal').textContent=e.target.value+'%';setNoiseVol(+e.target.value);};

  document.getElementById('bgImgFile').onchange=e=>readFile(e.target.files[0],async d=>{
    await dbPut('assets',{key:'bgimg',data:d});_userBgImg=d;FK.bg='img';renderBgRow();toast('背景图已上传');},8);
  document.getElementById('bgVidFile').onchange=async e=>{
    const f=e.target.files[0];if(!f)return;
    if(f.size>40*1024*1024){toast('视频过大，请选择 40MB 以内的文件');return;}
    await dbPut('assets',{key:'bgvid',blob:f});
    if(_userBgVid)URL.revokeObjectURL(_userBgVid);
    _userBgVid=URL.createObjectURL(f);FK.bg='vid';renderBgRow();toast('背景视频已上传');};
  document.getElementById('noiseFile').onchange=async e=>{
    const f=e.target.files[0];if(!f)return;
    if(f.size>20*1024*1024){toast('音频过大，请选择 20MB 以内的文件');return;}
    await dbPut('assets',{key:'noise',blob:f});
    if(_userNoiseUrl)URL.revokeObjectURL(_userNoiseUrl);
    _userNoiseUrl=URL.createObjectURL(f);_userAudio=null;FK.noise='user';
    renderNoiseGrid('noiseGrid');renderNoiseGrid('noiseGridFs');toast('自定义音频已上传');};

  document.getElementById('sBgFile').onchange=e=>readFile(e.target.files[0],async d=>{
    await dbPut('assets',{key:'appbg',data:d});applyAppBg();toast('背景已更新');},8);
  document.getElementById('sBgVeil').oninput=e=>{
    document.getElementById('sBgVeilVal').textContent=e.target.value+'%';SET.appBgVeil=+e.target.value;
    document.getElementById('appBgVeil').style.opacity=(SET.appBgVeil/100).toString();saveSettings();};
  document.getElementById('sBgBright').oninput=e=>{
    document.getElementById('sBgBrightVal').textContent=e.target.value+'%';SET.appBgBright=+e.target.value;
    document.getElementById('appBgLayer').style.filter=`brightness(${SET.appBgBright}%)`;saveSettings();};

  document.getElementById('impFile').onchange=e=>{
    const f=e.target.files[0];if(!f)return;
    const r=new FileReader();
    r.onload=async ev=>{
      try{
        const d=JSON.parse(ev.target.result);
        if(Array.isArray(d.plans))for(const x of d.plans){delete x.id;await dbPut('plans',x);}
        if(Array.isArray(d.sessions))for(const x of d.sessions){delete x.id;await dbPut('sessions',x);}
        PLANS=await dbAll('plans');SESSIONS=await dbAll('sessions');
        renderPlans();renderLog();checkBadges();
        document.getElementById('dataStatus').textContent='导入完成。';toast('备份已导入');
      }catch(err){document.getElementById('dataStatus').textContent='文件解析失败，请确认是 Aside 导出的备份。';}
    };r.readAsText(f);};
}
function toggleNoisePanel(){document.getElementById('noiseDrawer').classList.toggle('on');}

/* ==========================================================
   启动
   ========================================================== */
document.addEventListener('DOMContentLoaded',async()=>{
  updateTime();setInterval(updateTime,10000);
  updateBattery();applyIsland();applyGlobalFont();
  loadSettings();bind();
  updateQaDate();renderPlanChips();
  document.getElementById('valBrk').textContent=FK.brk;
  document.getElementById('valLbrk').textContent=FK.lbrk;
  document.getElementById('valRounds').textContent=FK.rounds;

  await applyAppBg();
  const bi=await dbGet('assets','bgimg');if(bi)_userBgImg=bi.data;
  const bv=await dbGet('assets','bgvid');if(bv&&bv.blob)_userBgVid=URL.createObjectURL(bv.blob);
  const nz=await dbGet('assets','noise');if(nz&&nz.blob)_userNoiseUrl=URL.createObjectURL(nz.blob);

  PLANS=await dbAll('plans');
  SESSIONS=await dbAll('sessions');
  await loadChars();
  renderPlans();renderCharGrid();renderFkPlans();renderBgRow();
  renderNoiseGrid('noiseGrid');renderNoiseGrid('noiseGridFs');
  checkBadges(true);
});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&RUN.on&&noiseNodes){/* 保持后台运行 */}
});
