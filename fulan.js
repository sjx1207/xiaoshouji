/* ══════════════════════════════════════════════════════════════════════
   浮岚 FULAN · 剧场   逻辑总表
   模块： 适配层 / 存储 / 阶位 / 文风 / 提示词 / 协议解析 / 阅读器
          织叙 / 群像 / 戏后笺 / 妆匣 / 露匣 / 阶位 / 路由
   外部对接：若页面已加载你原有的 characters.js / user.js / wallet.js /
   settings.js，浮岚会自动读取；读不到时使用本地示例数据，互不冲突。
   ══════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

/* ───────── 0. 基础工具 ───────── */
const $  = (s,r)=> (r||document).querySelector(s);
const $$ = (s,r)=> Array.from((r||document).querySelectorAll(s));
const uid= p=> (p||'id')+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const esc= s=> String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const fmt = n=> String(n).replace(/\B(?=(\d{3})+(?!\d))/g,',');
const when= t=>{const d=new Date(t),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}.${p(d.getMonth()+1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const pick = a=> a[Math.floor(Math.random()*a.length)];
const KEY = 'fulan.v1';

const DB = {
  read(){ try{ return JSON.parse(localStorage.getItem(KEY)||'{}'); }catch(e){ return {}; } },
  write(o){ try{ localStorage.setItem(KEY, JSON.stringify(o)); }catch(e){ Toast.warn('本地空间已满，旧存档可能无法写入'); } },
  get(k,d){ const o=DB.read(); return k in o ? o[k] : d; },
  set(k,v){ const o=DB.read(); o[k]=v; DB.write(o); return v; }
};
/* 背景图走 IndexedDB，避免撑爆 localStorage */
const IMG = (function(){
  let dbp=null;
  function open(){ if(dbp) return dbp; dbp=new Promise((res,rej)=>{ const r=indexedDB.open('fulan_img',1);
    r.onupgradeneeded=()=>r.result.createObjectStore('bg'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); return dbp; }
  return {
    async set(k,v){ try{ const db=await open(); return new Promise(res=>{ const t=db.transaction('bg','readwrite'); t.objectStore('bg').put(v,k); t.oncomplete=()=>res(1); t.onerror=()=>res(0); }); }catch(e){ return 0; } },
    async get(k){ try{ const db=await open(); return new Promise(res=>{ const t=db.transaction('bg','readonly'); const q=t.objectStore('bg').get(k); q.onsuccess=()=>res(q.result||null); q.onerror=()=>res(null); }); }catch(e){ return null; } },
    async del(k){ try{ const db=await open(); return new Promise(res=>{ const t=db.transaction('bg','readwrite'); t.objectStore('bg').delete(k); t.oncomplete=()=>res(1); }); }catch(e){ return 0; } }
  };
})();

/* ───────── 1. 自绘组件（不使用浏览器原生 alert/confirm/select） ───────── */
const Toast={
  push(msg,warn){ const w=$('#flToasts'); const d=document.createElement('div');
    d.className='fl-toast'+(warn?' fl-toast--warn':''); d.textContent=msg; w.appendChild(d);
    setTimeout(()=>{ d.style.transition='.3s'; d.style.opacity=0; d.style.transform='translateY(-8px)'; setTimeout(()=>d.remove(),320); },2200); },
  ok(m){ this.push(m,false); }, warn(m){ this.push(m,true); }
};
const Modal={
  open({title,body,actions,wide}){ const m=$('#flModal'); $('#flModalT').textContent=title||'';
    const b=$('#flModalB'); b.innerHTML=''; if(typeof body==='string') b.innerHTML=body; else if(body) b.appendChild(body);
    const f=$('#flModalF'); f.innerHTML='';
    /* fn 返回 false ⇒ 保留弹窗（校验没过时不该把用户填的东西一起关掉） */
    (actions||[{t:'知道了',p:1}]).forEach(a=>{ const btn=document.createElement('button');
      btn.className=a.p?'fl-solid':'fl-ghost'; btn.textContent=a.t;
      btn.onclick=()=>{ let r=true; try{ r=a.fn?a.fn():true; }catch(err){ console.error(err); }
        if(r!==false&&!a.keep) Modal.close(); }; f.appendChild(btn); });
    m.hidden=false; m.querySelector('.fl-modal__veil').onclick=()=>Modal.close(); return b; },
  close(){ $('#flModal').hidden=true; }
};
const Sheet={
  open(title,build){ const s=$('#flSheet'); $('#flSheetT').textContent=title; const b=$('#flSheetB'); b.innerHTML='';
    build&&build(b); s.hidden=false; s.querySelector('.fl-sheet__veil').onclick=()=>Sheet.close(); return b; },
  close(){ $('#flSheet').hidden=true; }
};
function confirmBox(title,text,okText,fn){ Modal.open({title,body:`<p style="text-align:center">${esc(text)}</p>`,
  actions:[{t:'再想想'},{t:okText||'确定',p:1,fn}]}); }
/* 自绘下拉：mount(容器, 选项[], 当前值, 回调, 提示) */
function Select(host,opts,val,onPick,hint){
  host.innerHTML=''; const w=document.createElement('div'); w.className='fl-sel';
  const btn=document.createElement('button'); btn.className='fl-sel__btn';
  const cur=opts.find(o=>o.v===val)||opts[0];
  btn.innerHTML=`<span>${esc(cur?cur.t:'请选择')}</span>`;
  btn.onclick=()=>Sheet.open(hint||'请选择',b=>{ const l=document.createElement('div'); l.className='fl-optlist';
    opts.forEach(o=>{ const it=document.createElement('button'); it.className='fl-opt'+(o.v===val?' is-on':'');
      it.innerHTML=`<i class="fl-opt__dot"></i><span style="flex:1"><b>${esc(o.t)}</b>${o.d?`<span>${esc(o.d)}</span>`:''}</span>`;
      it.onclick=()=>{ Sheet.close(); Select(host,opts,o.v,onPick,hint); onPick&&onPick(o.v,o); }; l.appendChild(it); });
    b.appendChild(l); });
  w.appendChild(btn); host.appendChild(w);
  if(hint){ const h=document.createElement('p'); h.className='fl-sel__hint'; h.textContent=hint; host.appendChild(h); }
  return val;
}
/* 自绘分段 */
function Seg(host,opts,val,onPick){ host.innerHTML=''; const w=document.createElement('div'); w.className='fl-seg';
  opts.forEach(o=>{ const b=document.createElement('button'); b.textContent=o.t; if(o.v===val) b.classList.add('is-on');
    b.onclick=()=>{ Seg(host,opts,o.v,onPick); onPick&&onPick(o.v); }; w.appendChild(b); }); host.appendChild(w); }
/* 自绘多选 chips */
function Chips(host,items,sel,onChange,single){ host.innerHTML='';
  items.forEach(it=>{ const b=document.createElement('button'); b.className='fl-chip'+(sel.includes(it)?' is-on':'');
    b.textContent=it; b.onclick=()=>{ if(single){ sel.length=0; sel.push(it);} else { const i=sel.indexOf(it); i<0?sel.push(it):sel.splice(i,1);}
      Chips(host,items,sel,onChange,single); onChange&&onChange(sel); }; host.appendChild(b); }); }
/* 自绘开关 */
function Switch(title,desc,on,fn){ const d=document.createElement('div'); d.className='fl-sw'+(on?' is-on':'');
  d.innerHTML=`<div class="fl-sw__t"><b>${esc(title)}</b><span>${esc(desc)}</span></div><i class="fl-sw__k"></i>`;
  d.onclick=()=>{ on=!on; d.classList.toggle('is-on',on); fn(on); }; return d; }
/* 载入遮罩：引用计数 + 60 秒保险丝。
   任何一条路径忘了 hide()，或生成中途抛异常，雾都会自己散，
   绝不会再出现「起雾中…」转到天亮的情况。 */
const Loading={
  n:0, timer:null,
  show(t,sub){
    Loading.n++;
    $('#flLoadingT').textContent=t||'起雾中…';
    $('#flLoadingS').textContent=sub||'';
    $('#flLoading').hidden=false;
    clearTimeout(Loading.timer);
    Loading.timer=setTimeout(()=>{ Loading.force(); Toast.warn('等太久了，先把雾散开。再试一次吧'); },60000);
  },
  sub(t){ const el=$('#flLoadingS'); if(el) el.textContent=t||''; },
  hide(){ Loading.n=Math.max(0,Loading.n-1); if(Loading.n===0) Loading.force(); },
  force(){ Loading.n=0; clearTimeout(Loading.timer); const el=$('#flLoading'); if(el) el.hidden=true; }
};
function popNote(t,b){ const p=$('#flPop'); $('#flPopT').textContent=t; $('#flPopB').textContent=b; p.hidden=false; p.onclick=()=>p.hidden=true; }

/* ───────── 2. 外部数据适配（characters / user / wallet / settings） ─────────
   真同步的前提是读同一份真实数据源，不是猜字段名。这套体系里角色卡、身份（user）、
   钱包账户/余额/支付密码，全部存在各自的 IndexedDB 里（characters.js / user.js /
   wallet.js 各自独立打开同一批库，互不导出全局函数），所以浮岚也照这个规矩，
   直接打开同名的库、同名的 store、同样的字段，而不是去猜 window.characters 之类
   压根不存在的全局变量——那样只会永远读到本地示例数据，表面上"在同步"，实际什么都没接上。 */
function openLunaDB(name, store, version){
  return new Promise((resolve)=>{
    try{
      const probe=indexedDB.open(name);
      probe.onsuccess=e=>{
        const db=e.target.result;
        if(db.objectStoreNames.contains(store)){ resolve(db); return; }
        const ver=db.version+1; db.close();
        const req2=indexedDB.open(name,ver);
        req2.onupgradeneeded=ev=>{ if(!ev.target.result.objectStoreNames.contains(store)) ev.target.result.createObjectStore(store,{keyPath:'id',autoIncrement:true}); };
        req2.onsuccess=ev=>resolve(ev.target.result);
        req2.onerror=()=>resolve(null);
      };
      probe.onupgradeneeded=e=>{ if(!e.target.result.objectStoreNames.contains(store)) e.target.result.createObjectStore(store,{keyPath:'id',autoIncrement:true}); };
      probe.onerror=()=>resolve(null);
    }catch(e){ resolve(null); }
  });
}
function idbGetAll(dbp,store){ return dbp.then(db=>{ if(!db) return [];
  return new Promise(res=>{ try{ const r=db.transaction(store).objectStore(store).getAll(); r.onsuccess=()=>res(r.result||[]); r.onerror=()=>res([]); }catch(e){ res([]); } }); }); }
function idbGet(dbp,store,key){ return dbp.then(db=>{ if(!db) return null;
  return new Promise(res=>{ try{ const r=db.transaction(store).objectStore(store).get(key); r.onsuccess=()=>res(r.result||null); r.onerror=()=>res(null); }catch(e){ res(null); } }); }); }

const Adapter={
  _charsCache:null, _usersCache:null,
  /* 同步读缓存：给 UI 里那些必须同步取值的地方用（选中态高亮、povDemo 这类即时预览）。
     首次一定是空数组，真正的数据由下面的异步方法在页面打开时提前拉好并写进缓存，
     之后所有同步读取都是缓存命中，不会出现"读了个空的却以为读到了真实数据"的情况。 */
  charsSync(){ return Adapter._charsCache || []; },
  usersSync(){ return Adapter._usersCache || []; },
  async preload(){ Adapter._charsCache=await Adapter.chars(); Adapter._usersCache=await Adapter.users(); return {chars:Adapter._charsCache,users:Adapter._usersCache}; },
  /* 角色卡：LunaCharDB / chars ，字段与 characters.js 的表单字段一一对应 */
  async chars(){
    try{
      const list=await idbGetAll(openLunaDB('LunaCharDB','chars'),'chars');
      if(list&&list.length){
        return list.map(o=>({
          id:o.id, name:o.name||'未命名',
          avatar:o.avatar||'', cardBg:o.cardBg||'',
          persona:[o.desc,o.appearance,o.species,o.outfit].filter(Boolean).join('\n')||o.desc||'',
          speech:o.speechStyle||'', scenario:o.scenario||o.backstory||'',
          traits:o.traits||[], catchphrases:o.catchphrases||[],
          fears:o.fears||'', likes:o.likes||[], dislikes:o.dislikes||[],
          relation:o.relation||'', callUser:o.callUser||'', relationDetail:o.relationDetail||'',
          firstMes:o.firstMes||'', boundaries:o.boundaries||'', gender:o.gender||'',
          example:'', tags:o.traits||[], bindUser:null, raw:o
        }));
      }
    }catch(e){ console.warn('[浮岚] 读取 LunaCharDB 失败，转本地示例',e); }
    return DB.get('demoChars', DEMO_CHARS);
  },
  /* 身份（user 视角）：LunaIdentityDB / identities，字段对应 user.js 的 profileInput* */
  async users(){
    try{
      const list=await idbGetAll(openLunaDB('LunaIdentityDB','identities'),'identities');
      if(list&&list.length){
        return list.map(o=>({
          id:o.id, name:o.name||'我', avatar:o.avatar||'',
          persona:[o.desc,o.personality].filter(Boolean).join('\n'),
          tags:(o.personality?String(o.personality).split(/[,，、\s]+/).filter(Boolean):[]),
          boundCharIds:o.boundCharIds||[], raw:o
        }));
      }
    }catch(e){ console.warn('[浮岚] 读取 LunaIdentityDB 失败，转本地示例',e); }
    return DB.get('demoUsers', DEMO_USERS);
  },
  /* 绑定关系存在 identity 一侧的 boundCharIds 数组里，char 记录本身并不知道自己被谁绑定了，
     所以要从 char 反查 user，就得在 users 列表里找 boundCharIds 包含该 char.id 的那个身份——
     用同步缓存版本，因为 paintCast 这类点击态渲染要求立即出结果，不能每次点选都转圈等 IndexedDB */
  boundUserIdOf(charId){
    const u=Adapter.usersSync().find(u=>Array.isArray(u.boundCharIds)&&u.boundCharIds.includes(charId));
    return u?u.id:null;
  },
  async boundUserFor(charId){
    const users=await Adapter.users();
    return users.find(u=>Array.isArray(u.boundCharIds)&&u.boundCharIds.includes(charId))||null;
  },
  /* 钱包：余额在 LunaWalletHomeDB / home（keyPath 固定 'id':'home'）；
     账户绑定在 LunaWalletAccountDB / accounts（固定 id:'main'）；
     支付密码在 LunaWalletSecurityDB / security，按身份 id 隔离存，真实货币单位是 Lune，不是本地瞎起的名字 */
  async wallet(){
    let balance=0, bound=false, account='', boundIdentityId=null, currency='Lune';
    try{ const home=await idbGet(openLunaDB('LunaWalletHomeDB','home'),'home','home'); if(home) balance=Number(home.balance||0); }catch(e){}
    try{ const acc=await idbGet(openLunaDB('LunaWalletAccountDB','accounts'),'accounts','main');
      if(acc){ bound=true; account=acc.name||acc.email||''; boundIdentityId=acc.boundIdentityId||null; } }catch(e){}
    return {balance,bound,account,boundIdentityId,currency};
  },
  /* 是否设置了支付密码：security store 按 identity_<boundIdentityId|default> 存 {enabled,pin} */
  async paySecurity(boundIdentityId){
    try{ const key='identity_'+(boundIdentityId||'default');
      const sec=await idbGet(openLunaDB('LunaWalletSecurityDB','security'),'security',key);
      return sec||{enabled:false,pin:null}; }catch(e){ return {enabled:false,pin:null}; }
  },
  /* 真实扣款：读余额→不足则失败→若启用密码则先在浮岚自绘的键盘上校验→写回余额与流水，
     与 wallet.js 的 _phoneCharge 走的是同一份数据、同一条规则，只是键盘 UI 用浮岚自己的样式画 */
  async charge(amount, txName){
    const homeDbp=openLunaDB('LunaWalletHomeDB','home');
    const home=(await idbGet(homeDbp,'home','home'))||{id:'home',balance:0,transactions:[]};
    const balance=Number(home.balance||0);
    if(balance<amount) return {ok:false,reason:'余额不足，请先去露匣充值'};
    const acc=await idbGet(openLunaDB('LunaWalletAccountDB','accounts'),'accounts','main');
    const boundIdentityId=acc&&acc.boundIdentityId||null;
    const sec=await Adapter.paySecurity(boundIdentityId);
    if(sec.enabled&&sec.pin){
      const pass=await Pay.verifyPin(sec.pin);
      if(!pass) return {ok:false,reason:'已取消支付'};
    }
    const now=Date.now();
    const txList=Array.isArray(home.transactions)?home.transactions.slice():[];
    txList.unshift({dir:'out',name:txName,ts:now,amount});
    const db=await homeDbp; if(!db) return {ok:false,reason:'钱包数据暂时读取不到，请稍后再试'};
    await new Promise(res=>{ const tx=db.transaction('home','readwrite');
      tx.objectStore('home').put({...home,id:'home',balance:balance-amount,transactions:txList});
      tx.oncomplete=()=>res(1); tx.onerror=()=>res(0); });
    return {ok:true,balance:balance-amount};
  },
  /* 文本生成接口：唯一权威来源是 settings.js 写入的 luna_api_current / luna_api_model，
     旧版这里读的是压根没人写过的 localStorage['settings']，导致永远读到空对象，
     AI.gen() 里 s.apiBase && s.apiKey 永远为假，于是每次都静默掉进 Offline 兜底——
     这就是"生成字数跟滑块选的不一致""感觉根本没调用AI"的根源。现在改成真实对接。 */
  settings(){
    let cur={}; try{ cur=JSON.parse(localStorage.getItem('luna_api_current')||'{}'); }catch(e){}
    const model=localStorage.getItem('luna_api_model')||'';
    return {
      apiBase: cur.baseUrl||'',
      apiKey:  cur.apiKey||'',
      model:   model||'gpt-4o-mini'
    };
  },
  /* 语音接口：同理，唯一权威来源是 luna_voice_current / luna_voice_model / luna_voice_region，
     旧版 TTS.speak() 只会走浏览器自带的 speechSynthesis，完全没碰过语音设置页存的 MiniMax 配置。 */
  voiceSettings(){
    let cur={}; try{ cur=JSON.parse(localStorage.getItem('luna_voice_current')||'{}'); }catch(e){}
    const model=localStorage.getItem('luna_voice_model')||'speech-2.8-hd';
    const region=localStorage.getItem('luna_voice_region')||'cn';
    const host=region==='global'?'https://api.minimax.io':'https://api.minimaxi.com';
    return { groupId:cur.groupId||'', apiKey:cur.apiKey||'', voiceId:cur.voiceId||'', model, region, host };
  }
};
/* 这两份示例数据只在真实的 LunaCharDB / LunaIdentityDB 里还没有任何记录时才会用到
   （比如刚安装、还没去「角色」App 建过卡）。同样带上 raw，保证 charCard() 全量字段读取
   在示例数据下也能正常展示，行为和真实数据一致，不会因为走了兜底分支就退化成一段糊话。 */
const DEMO_CHARS=[
  {id:'c1',name:'裴照',avatar:'',persona:'制香司少卿。表面冷淡守礼，实则记仇又护短。',speech:'短句、克制、极少用感叹号',scenario:'临水郡雨季，禁香案未结',example:'',tags:['清冷','口是心非'],bindUser:null,
   raw:{name:'裴照',gender:'男',desc:'制香司少卿。表面冷淡守礼，实则记仇又护短。厌恶被人可怜，习惯用公务口吻掩饰关心。',traits:['清冷','口是心非','护短'],speechStyle:'短句、克制、极少用感叹号，句尾常留半句不说',scenario:'临水郡雨季，禁香案未结',fears:'被人看穿在乎',likes:['安静','守时的人'],dislikes:['被可怜','失信']}},
  {id:'c2',name:'沈砚舟',avatar:'',persona:'旧唱片行老板，三十二岁。散漫，爱开玩笑，只有在讲到某个人时会突然安静。',speech:'口语化、爱用反问、偶尔文艺',scenario:'海边小城，店里总放着同一张碟',example:'',tags:['温柔','有故事'],bindUser:null,
   raw:{name:'沈砚舟',gender:'男',age:'32',desc:'旧唱片行老板。散漫，爱开玩笑，记性极好，记得每个客人点过的歌。',traits:['温柔','有故事','嘴硬心软'],speechStyle:'口语化、爱用反问、偶尔文艺',scenario:'海边小城，店里总放着同一张碟',likes:['旧唱片','雨天'],dislikes:['催促','谎话']}}
];
const DEMO_USERS=[
  {id:'u1',name:'阿檀',avatar:'',persona:'制香师，手上常年有药气。表面软，做决定时很硬。',tags:['执拗'],boundCharIds:[],
   raw:{name:'阿檀',desc:'制香师，手上常年有药气。',personality:'执拗、外软内硬'}},
  {id:'u2',name:'林迟',avatar:'',persona:'写歌不红的乐手，习惯在别人店里过夜。',tags:['懒散'],boundCharIds:[],
   raw:{name:'林迟',desc:'写歌不红的乐手，习惯在别人店里过夜。',personality:'懒散、耳根软'}}
];

/* ───────── 3. 阶位体系（50 阶 / 10 品 / 徽记） ───────── */
const TIERS=[
  {n:'初雾',en:'NASCENT MIST', c:['#F1F8F3','#A9CDB7'],
   perks:['解锁全部内置文风与基础阅读器主题','每日 1 次免费重生成','存档位 3 个']},
  {n:'微澜',en:'FAINT RIPPLE', c:['#E4F2EA','#8FC3AB'],
   perks:['自定义文风槽 +2','评论区显示阶位签','每日免费重生成 2 次']},
  {n:'拂樱',en:'PASSING BLOSSOM', c:['#FBEFF3','#E3AEBE'],
   perks:['群像剧场 95 折','阅读器主题槽 +2','戏后笺开启「悄悄话」段落']},
  {n:'叠翠',en:'LAYERED GREEN', c:['#D9EBE0','#5F9077'],
   perks:['群像剧场 9 折','戏后笺自动生成','存档位 +5']},
  {n:'浮花',en:'DRIFTING PETAL', c:['#EFE8F5','#B9A8D0'],
   perks:['解锁双线视角（user / char 交替叙述）','长图导出','自定义 CSS 槽 +2']},
  {n:'流萤',en:'FIREFLY DRIFT', c:['#FBF4DA','#E3C766'],
   perks:['群像剧场 85 折','徽记获得流光效果','分支存档 +5']},
  {n:'凝露',en:'GATHERED DEW', c:['#E6F3FA','#89BBD4'],
   perks:['单条生成上限 +50%','记忆锚点上限 +10 条','自定义 CSS 槽 +3']},
  {n:'霁色',en:'CLEARING SKY', c:['#E9EEFB','#7C93D8'],
   perks:['群像剧场 8 折','限定文风「霁色低语」','生成优先队列']},
  {n:'琉光',en:'GLAZED LIGHT', c:['#F6EFDE','#C6AC72'],
   perks:['群像剧场 75 折','动态徽记与花体署名','剧目可署名发布']},
  {n:'幻境',en:'THE MIRAGE',   c:['#EEE7F8','#8E7BC4'],
   perks:['群像剧场 7 折','存档不限量','限定主题「幻境琉璃」与创作者标识']}
];
const Rank={
  need(l){ return 100 + 60*(l-1) + 4*(l-1)*(l-1); },     // l → l+1 所需
  total(l){ let s=0; for(let i=1;i<l;i++) s+=Rank.need(i); return s; },
  levelOf(xp){ let l=1; while(l<50 && xp>=Rank.need(l)){ xp-=Rank.need(l); l++; } return {level:l, into:xp, need:l>=50?0:Rank.need(l)}; },
  tier(l){ return TIERS[Math.min(9,Math.floor((l-1)/5))]; },
  tierIx(l){ return Math.min(9,Math.floor((l-1)/5)); },
  name(l){ const t=Rank.tier(l), sub=['一','二','三','四','五'][(l-1)%5]; return t.n+'·'+sub; },
  discount(l){ const ix=Rank.tierIx(l); return [1,1,.95,.9,.9,.85,.85,.8,.75,.7][ix]; },
  freeRegen(l){ const ix=Rank.tierIx(l); return [1,2,2,3,3,4,4,5,6,8][ix]; },
  addXP(n,why){ const s=DB.get('stat',{xp:0,words:0,turns:0,spend:0,acts:0,cmts:0});
    const before=Rank.levelOf(s.xp).level; s.xp+=n; DB.set('stat',s);
    const after=Rank.levelOf(s.xp).level;
    if(after>before){ setTimeout(()=>levelUpModal(after),420); }
    Hall.paintRank(); return s.xp; },
  stat(){ return DB.get('stat',{xp:0,words:0,turns:0,spend:0,acts:0,cmts:0}); }
};
function badgeSVG(level,size){
  const ix=Rank.tierIx(level), t=TIERS[ix], id='g'+ix+'_'+Math.random().toString(36).slice(2,6);
  const star=((level-1)%5)+1;
  const shapes=[
    `<circle cx="32" cy="32" r="17" fill="none" stroke="#fff" stroke-opacity=".55"/><circle cx="32" cy="32" r="11" fill="none" stroke="#fff" stroke-opacity=".4"/>`,
    `<path d="M14 36c6-8 12 8 18 0s12-8 18 0" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2"/><path d="M14 26c6-8 12 8 18 0s12-8 18 0" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>`,
    `<path d="M32 14c8 8 8 18 0 26-8-8-8-18 0-26z" fill="#fff" fill-opacity=".5"/><path d="M20 30c10 2 16 8 12 18-10-2-16-8-12-18z" fill="#fff" fill-opacity=".3"/>`,
    `<path d="M12 44l12-18 8 11 7-12 13 19z" fill="#fff" fill-opacity=".45"/><path d="M12 44h40" stroke="#fff" stroke-opacity=".5"/>`,
    `<g fill="#fff" fill-opacity=".45"><ellipse cx="32" cy="21" rx="6" ry="10"/><ellipse cx="32" cy="43" rx="6" ry="10"/><ellipse cx="21" cy="32" rx="10" ry="6"/><ellipse cx="43" cy="32" rx="10" ry="6"/></g><circle cx="32" cy="32" r="5" fill="#fff" fill-opacity=".8"/>`,
    `<g fill="#fff"><circle cx="24" cy="26" r="3.4" fill-opacity=".85"/><circle cx="40" cy="22" r="2.4" fill-opacity=".6"/><circle cx="36" cy="40" r="4" fill-opacity=".75"/><circle cx="22" cy="42" r="2" fill-opacity=".5"/></g>`,
    `<path d="M32 14c7 11 11 16 11 22a11 11 0 01-22 0c0-6 4-11 11-22z" fill="#fff" fill-opacity=".5"/><circle cx="27" cy="34" r="3" fill="#fff" fill-opacity=".7"/>`,
    `<path d="M13 42a19 19 0 0138 0" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3"/><path d="M20 42a12 12 0 0124 0" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3"/>`,
    `<path d="M32 12l16 12-6 24H22l-6-24z" fill="#fff" fill-opacity=".38"/><path d="M32 12v36M16 24h32" stroke="#fff" stroke-opacity=".5"/>`,
    `<path d="M32 32c-6-14-22-14-18 0 3 10 12 12 18 16 6-4 15-6 18-16 4-14-12-14-18 0z" fill="#fff" fill-opacity=".45"/><circle cx="32" cy="30" r="3.6" fill="#fff" fill-opacity=".85"/>`
  ];
  let stars=''; for(let i=0;i<star;i++){ const a=-90+(i-(star-1)/2)*15, r=25.5;
    const x=32+r*Math.cos(a*Math.PI/180), y=32+r*Math.sin(a*Math.PI/180);
    stars+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.9" fill="#fff" fill-opacity=".92"/>`; }
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${t.c[0]}"/><stop offset="1" stop-color="${t.c[1]}"/></linearGradient></defs>
    <path d="M32 3l24 11v20c0 15-10 24-24 27C18 58 8 49 8 34V14z" fill="url(#${id})" stroke="rgba(255,255,255,.85)" stroke-width="1.4"/>
    <path d="M32 7l20.5 9.4V34c0 13-8.5 20.6-20.5 23.3C20 54.6 11.5 47 11.5 34V16.4z" fill="none" stroke="rgba(255,255,255,.45)"/>
    ${shapes[ix]}${stars}</svg>`;
}
function badgeEl(level,cls){ const d=document.createElement('div'); d.className='fl-badge '+(cls||'');
  d.innerHTML=badgeSVG(level)+`<b class="fl-badge__lv">${level}</b>`; return d; }
function levelUpModal(l){ const t=Rank.tier(l);
  const b=Modal.open({title:'升阶',body:'<div id="flLvBox" style="text-align:center"></div>',actions:[{t:'继续演',p:1}]});
  const box=$('#flLvBox',b); box.appendChild(badgeEl(l,'fl-badge--lg'));
  box.insertAdjacentHTML('beforeend',`<div style="margin-top:14px"><div style="font-family:var(--fl-f-display);font-size:24px;letter-spacing:.2em;color:var(--fl-moss-d)">${Rank.name(l)}</div>
   <div style="font-family:var(--fl-f-util);font-size:10px;letter-spacing:.28em;color:var(--fl-ink-3);margin-top:6px">LV.${l} · ${t.en}</div>
   <div style="margin-top:14px;text-align:left">${t.perks.map(p=>`<div class="fl-perk">${esc(p)}</div>`).join('')}</div></div>`);
}

/* ───────── 4. 文风：内置十体（含示例）＋ 自定义 ＋ 接收测试 ───────── */
const BUILTIN_STYLES=[
 {id:'s_bailu',name:'白露清叙',tag:'清淡 · 留白',
  desc:'短句为主，形容词克制，靠动作与器物说情绪。段落之间留空气，不把话说满。适合日常、暗恋、久别重逢。',
  ex:'他推门进来，肩上有雨。\n我没抬头，把炉子里的火拨小了一点。\n"还没走？"他问。\n炉子响了一声。我说，"等你把伞收好。"'},
 {id:'s_nongmo',name:'浓墨织锦',tag:'华丽 · 通感',
  desc:'长句铺陈，意象密集，色彩与气味交叠。情绪层层堆高，适合宿命感强、场面大的剧情。',
  ex:'灯烧到第三更，光把他的影子拉长，一直拖进廊下未干的水里；那水里浮着半瓣白梅，像谁没说完就咽回去的一句话，被夜色反复擦洗，越擦越亮。'},
 {id:'s_lengren',name:'冷刃纪实',tag:'冷硬 · 动词驱动',
  desc:'几乎不用形容词，只写发生了什么。短促、精确、可验证。适合悬疑、审讯、追捕、职场对峙。',
  ex:'两点十七分，他把文件推过来。\n三页。第二页折了角。\n我翻到第二页。名字被划掉，笔压很重，划穿了纸。\n"谁划的。"\n"你猜。"'},
 {id:'s_fenjing',name:'电影分镜',tag:'镜头 · 现在时',
  desc:'以景别与调度写戏，标注声音与光线，动作先于心理。适合高信息量的开场与打斗、追逐。',
  ex:'远景：长街，雨。一盏灯在积水里碎成两半。\n近景：他的手，指节泛白，攥着伞柄。\n声音：远处车铃，由远及近，又停。\n他抬眼。'},
 {id:'s_jiuxin',name:'旧信体',tag:'第二人称 · 追忆',
  desc:'像写给对方的一封信，用"你"贯穿，时间在现在与从前之间来回。适合虐、遗憾、重逢前夜。',
  ex:'你大概不记得了。那年冬天你把围巾解下来给我，说你不冷。后来我才知道你回去发了三天烧。\n我现在还留着它。它已经不暖了，可我不敢洗。'},
 {id:'s_minguo',name:'民国旧影',tag:'半文半白 · 器物',
  desc:'旧时称谓与器物入文，句式稍长，礼数与心思互相拉扯。适合年代、家族、身份差。',
  ex:'先生把怀表搁在桌上，表盖磕得轻轻一声。\n"六点了。"他说。\n我替他斟茶，水汽把镜片熏白。\n他不揭，只道："今日的茶，比昨日苦。"'},
 {id:'s_liuli',name:'童话琉璃',tag:'柔软 · 拟人',
  desc:'万物有灵，比喻柔软，情绪明亮但不幼稚。适合治愈、奇幻、轻松日常。',
  ex:'夜灯打了个哈欠，把最后一点光让给窗台上的猫。\n猫说："他还没回来。"\n夜灯说："那我们再亮一会儿。"'},
 {id:'s_diyu',name:'悬疑低语',tag:'留钩 · 信息差',
  desc:'每段末尾留一个未解的细节，视角受限，不解释。适合推理、灵异、心理惊悚。',
  ex:'门是从里面锁上的。\n可屋里只有一双鞋。\n我数了三遍。\n第三遍的时候，鞋换了方向。'},
 {id:'s_shijing',name:'市井烟火',tag:'生活流 · 密集对白',
  desc:'口语密集，细节琐碎可爱，靠日常动作推情节。适合甜、青梅竹马、慢热同居。',
  ex:'"葱花要不要？"\n"要。"\n"辣呢？"\n"要。"\n"那你昨天说胃疼——"\n"少要一点。"\n他把碗端过来，辣油浮了薄薄一层，刚好是我说的"少一点"。'},
 {id:'s_xinggui',name:'星轨科幻',tag:'冷调 · 宏大尺度',
  desc:'术语精准，情感被压在数据之下，靠尺度对比制造孤独。适合科幻、末世、AI 与人。',
  ex:'第 1,204 次唤醒。舱内温度 4.2℃，氧储 61%。\n她的名字仍在名单第七行，状态栏空白。\n我把系统时间调回她离开那天，只让它走了一秒，又调了回来。'}
];
const STYLE_MODS=['更慢的节奏','更多环境描写','更多内心戏','更密的对白','更少形容词','结尾留钩','镜头感更强','古雅用词','口语更重','情绪更克制'];
function styles(){ return DB.get('styles',[]); }
function saveStyles(a){ DB.set('styles',a); }
function styleById(id){ return BUILTIN_STYLES.find(s=>s.id===id) || styles().find(s=>s.id===id) || BUILTIN_STYLES[0]; }

/* 接收能力测试：本地量化 + AI 回声 */
async function runStyleTest(sty,host){
  host.innerHTML='<div class="fl-testout">正在让模型按此文风试写一段，并回报它理解到的特征…</div>';
  const probe=[
   {role:'system',content:'你是文风分析与仿写引擎。只输出要求的两段，不要解释、不要 markdown。'},
   {role:'user',content:`【文风名】${sty.name}\n【描述】${sty.desc}\n【用户示例】${sty.ex||'（无）'}\n\n请输出：\n第一段：以「深夜的便利店，两个人隔着货架说了三句话」为题，用该文风写 90-130 字。\n第二段：以「特征：」开头，用不超过 6 个短词列出你理解到的该文风特征，用顿号分隔。`}];
  let out='';
  try{ out=await AI.gen(probe,{max:420,label:'文风测试'}); }catch(e){ out=''; }
  const [sample,traits]=splitProbe(out||offlineStyleProbe(sty));
  const sc=scoreStyle(sty,sample);
  host.innerHTML=`
   <div class="fl-gauge">
     <div class="fl-gauge__ring">
       <svg width="74" height="74"><defs><linearGradient id="flGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A9CDB7"/><stop offset="1" stop-color="#3F6B54"/></linearGradient></defs>
       <circle class="bg" cx="37" cy="37" r="30"/><circle class="fg" cx="37" cy="37" r="30" stroke-dasharray="188.5" stroke-dashoffset="188.5"/></svg>
       <div class="fl-gauge__n">${sc.total}</div></div>
     <div class="fl-gauge__t"><b>${sc.verdict}</b><span>${esc(sc.advice)}</span></div>
   </div>
   <div class="fl-bars">
     ${bar('句长贴合',sc.len)}${bar('标点节奏',sc.punc)}${bar('用词命中',sc.word)}${bar('对白密度',sc.dlg)}${bar('禁用词规避',sc.ban)}
   </div>
   <div class="fl-testout"><b style="font-family:var(--fl-f-util);font-size:10px;letter-spacing:.2em;color:var(--fl-ink-3);display:block;margin-bottom:8px">模型试写</b>${esc(sample).replace(/\n/g,'<br>')}
   <div style="margin-top:12px;font-size:11.5px;color:var(--fl-ink-3)">模型自述理解：${esc(traits||'—')}</div></div>`;
  requestAnimationFrame(()=>{ const c=host.querySelector('.fg'); if(c) c.style.strokeDashoffset=String(188.5*(1-sc.total/100)); });
  function bar(n,v){ return `<div class="fl-bar"><span>${n}</span><i><em style="width:${v}%"></em></i><b>${v}</b></div>`; }
}
function splitProbe(t){ const i=t.indexOf('特征：')>=0?t.indexOf('特征：'):t.indexOf('特征:');
  if(i<0) return [t.trim(),'']; return [t.slice(0,i).trim(), t.slice(i+3).trim()]; }
function scoreStyle(sty,sample){
  const ref=(sty.ex||sty.desc||''), s=sample||'';
  const seg=x=>x.split(/[。！？!?\n；;]/).filter(v=>v.trim().length);
  const avg=x=>{const a=seg(x);return a.length?a.reduce((m,v)=>m+v.length,0)/a.length:0;};
  const la=avg(ref)||14, lb=avg(s)||14;
  const len=clamp(Math.round(100-Math.abs(la-lb)/Math.max(la,8)*100),18,100);
  const pd=x=>((x.match(/[，。、；：？！…—「」""]/g)||[]).length/Math.max(1,x.length))*100;
  const punc=clamp(Math.round(100-Math.abs(pd(ref)-pd(s))*4.2),20,100);
  const keys=(sty.desc+' '+(sty.keywords||'')).match(/[\u4e00-\u9fa5]{2,4}/g)||[];
  const hit=keys.filter(k=>s.includes(k)).length;
  const word=clamp(Math.round(46+hit*11),24,100);
  const dl=x=>((x.match(/[「"""]/g)||[]).length)/Math.max(1,seg(x).length)*50;
  const dlg=clamp(Math.round(100-Math.abs(dl(ref)-dl(s))*2.4),22,100);
  const bans=(sty.ban||'').split(/[、,，\s]+/).filter(Boolean);
  const bad=bans.filter(b=>s.includes(b)).length;
  const ban=bans.length?clamp(100-bad*40,10,100):96;
  const total=Math.round(len*.24+punc*.2+word*.24+dlg*.16+ban*.16);
  let verdict='可以直接开台', advice='模型对这套文风的接收良好，生成时会稳定复现。';
  if(total<52){ verdict='还接不住'; advice='描述太抽象。补两句「句子多长、爱用什么词、忌讳什么」，再写一段更长的示例。'; }
  else if(total<74){ verdict='大致能接'; advice='方向对了，但细节会飘。建议在示例里补一段对白，模型主要靠对白判断语气。'; }
  return {total,len,punc,word,dlg,ban,verdict,advice};
}
function offlineStyleProbe(sty){ return `货架把灯光切成两半。他站在泡面那一排，没回头。\n"还没吃？"\n"刚下班。"\n我把手里的关东煮递过去，汤晃出来一点，烫在指节上。他接了，说了句谢谢，声音比店里的冷气还轻。\n特征：${(sty.desc||'').slice(0,26)}`; }

/* ───────── 5. 生成协议 & 提示词 ───────── */
const PROTOCOL=`【输出协议 · 必须逐行遵守】
每行以标记开头，标记与内容之间用竖线分隔，除此之外不要输出任何东西（不要 markdown、不要代码块、不要空标题、不要解释）：
@幕|本幕小标题
@景|场景与环境
@旁|叙述
@白:角色名|台词原文（不要带引号）
@心:角色名|内心独白
@动:角色名|动作或神态
@系统|时间流逝、地点切换等提示
@注:词条|该词条的解释（读者点击才会看到）
@选项|选项一||选项二||选项三
行内可用 **文字** 标出重点，可用 [[词条]] 引用上文出现过的 @注 词条。
禁止把多种标记写在同一行；禁止连续输出两行以上纯旁白之外的空行；一行写不完就再起一行同样的标记。`;
/* 角色卡必须全量喂给模型，不能只塞进一个 persona 字符串里糊弄过去——
   characters.js 里那么多独立字段（性格、外貌、怕什么、喜欢什么、称呼、底线……）
   合并成一段话会让权重被稀释，模型更容易漏读，也更容易 OOC。
   这里逐项列出，即使某项为空也留着字段名，方便模型判断"这项角色卡里没写，按已有性格保守推断"。 */
function charCard(c){ if(!c) return '（未指定）';
  const raw=c.raw||{};
  const lines=[
    `姓名：${c.name}`,
    raw.gender?`性别：${raw.gender}`:'',
    raw.age?`年龄：${raw.age}`:'',
    raw.species?`种族/身份：${raw.species}`:'',
    raw.desc?`人设描述：${raw.desc}`:'',
    (raw.traits&&raw.traits.length)?`性格标签：${raw.traits.join('、')}`:'',
    raw.appearance?`外貌：${raw.appearance}`:'',
    raw.outfit?`常见穿着：${raw.outfit}`:'',
    raw.speechStyle?`说话方式：${raw.speechStyle}`:'（未注明，按人设推断）',
    (raw.catchphrases&&raw.catchphrases.length)?`口头禅：${raw.catchphrases.join('、')}`:'',
    raw.fears?`害怕/忌讳：${raw.fears}`:'',
    (raw.likes&&raw.likes.length)?`喜欢：${raw.likes.join('、')}`:'',
    (raw.dislikes&&raw.dislikes.length)?`厌恶：${raw.dislikes.join('、')}`:'',
    raw.backstory?`背景故事：${raw.backstory}`:'',
    (c.scenario)?`所处情境：${c.scenario}`:'（空）',
    raw.relation?`与「我」的关系设定：${raw.relation}`:'',
    raw.callUser?`如何称呼「我」：${raw.callUser}`:'',
    raw.relationDetail?`关系细节：${raw.relationDetail}`:'',
    raw.boundaries?`绝对底线（硬性禁止逾越）：${raw.boundaries}`:'',
    raw.firstMes?`开场白范例：${raw.firstMes}`:'（空）',
  ].filter(Boolean);
  return lines.join('\n');
}
function buildSystem(st){
  const c=st.char, u=st.user, sty=styleById(st.styleId);
  const povMap={first:'第一人称「我」',second:'第二人称「你」',third:'第三人称限知',omni:'第三人称全知'};
  return `你是「浮岚」剧场的演绎引擎，负责把一场戏写下去。

【一号铁律：不得 OOC】
下面这张角色卡是本场唯一的最高准则。${c?c.name:'该角色'} 的每一句话、每一个动作、每一次沉默，都必须能从卡里推导出来。
卡里没写的，按卡里已有的性格保守推断，绝不擅自加设定；卡里写了的，绝不违背。
若剧情走向与角色性格冲突，改剧情，不改角色。

【角色卡 · char（最高优先级）】
${charCard(c)}

【我方 · user（次级优先级，仅用于「我」的身份与反应；与角色卡冲突时一律以角色卡为准）】
${u?`姓名：${u.name}\n人设：${u.persona||'（空）'}`:'（本场未绑定 user，仅按角色卡与世界观推进，不要替我做出与设定无关的行动）'}
${st.bound?'（该 user 与该角色为已绑定关系，可直接使用二人既有的相处方式与称呼。）':''}

【世界观】
时代地域：${st.era||'（未设定，请自洽）'}
世界规则：${st.rule||'（未设定）'}
当下局势：${st.now||'（未设定）'}

【本场想看的戏】
一句话愿望：${st.wish||'（未填，请围绕角色关系自行铺陈）'}
题材：${(st.genres||[]).join('、')||'不限'}
关系与立场：${st.relation||'（未填）'}
开场：${st.opening||'（未填，请自拟一个能立刻起冲突的开场）'}
冲突来源：${(st.conflict||[]).join('、')||'（未填）'}
必须出现：${st.must||'（无）'}
结局倾向：${(st.ending||[]).join('、')||'不限'}
情绪配比：甜度 ${st.sweet} / 虐度 ${st.pain} / 节奏 ${st.pace} / 细节密度 ${st.detail} / 选项密度 ${st.choice}
尺度分级：${({all:'全年龄，不写任何越界内容',warm:'可有暧昧与情绪张力，点到为止',mature:'成人向暗示，止于门前，不写露骨细节'})[st.rating]||'全年龄'}

【绝对禁止（雷点，优先级仅次于铁律）】
${st.taboo||'（无）'}
以上内容一旦触及，立刻换一个方向叙述，不要提示、不要道歉、不要中断。

【镜头】
主叙述者：${({user:'以我方视角',char:'以角色视角',both:'双线交替，每幕切换一次',omni:'全知旁白'})[st.narrator]}
写我方用：${povMap[st.povUser]}；写角色用：${povMap[st.povChar]}；时态语感：${st.tense==='now'?'现在时，正在发生':'过去时，回望叙述'}
称呼方式：${st.address||'（自然处理）'}

【文风】
名称：${sty.name}
要求：${sty.desc}
范例（仿其语感，不要照抄内容）：
${sty.ex||'（无）'}
${(st.mods&&st.mods.length)?'叠加微调：'+st.mods.join('、'):''}

【篇幅与推进】
本次只写 ${st.segLen} 字上下的一段，写完在自然的停顿处收住，不要总结、不要预告下一幕。
${st.autoChoice?'末尾输出一行 @选项，给出 3 个走向不同的选择，每个不超过 18 字。':'不要输出 @选项。'}
${st.autoNote?'':''}

${PROTOCOL}`;
}
function memoryBlock(sc){
  const anchors=(sc.anchors||[]).slice(-12);
  return `【已发生的事 · 摘要】\n${sc.summary||'（本场刚开始）'}\n\n【必须记住的事实（不得与之矛盾）】\n${anchors.length?anchors.map((a,i)=>`${i+1}. ${a}`).join('\n'):'（暂无）'}`;
}

/* ───────── 6. AI 适配（外部注入 / OpenAI 兼容 / 本地离线引擎） ───────── */
const AI={
  async gen(messages,opt){
    opt=opt||{};
    if(window.FLAI&&typeof window.FLAI.generate==='function'){
      try{ return await window.FLAI.generate(messages,opt); }catch(e){ console.warn('[浮岚] 外部 AI 失败，转本地',e); }
    }
    const s=Adapter.settings();
    if(s.apiBase&&s.apiKey){
      try{
        const r=await fetch(s.apiBase.replace(/\/$/,'')+'/chat/completions',{method:'POST',
          headers:{'Content-Type':'application/json','Authorization':'Bearer '+s.apiKey},
          body:JSON.stringify({model:s.model||'gpt-4o-mini',messages,max_tokens:opt.max||900,temperature:opt.temp??0.92,stream:false})});
        if(!r.ok){
          const errBody=await r.text().catch(()=>'');
          throw new Error(`HTTP ${r.status} ${errBody.slice(0,160)}`);
        }
        const j=await r.json();
        if(j.error) throw new Error(j.error.message||JSON.stringify(j.error).slice(0,160));
        const t=j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content;
        if(t) return t;
        throw new Error('接口返回了空内容');
      }catch(e){
        console.warn('[浮岚] 接口调用失败，本次改用离线兜底',e);
        // 明确告诉用户这次是"接口失败才兜底"，而不是悄悄换一套没人知道的逻辑
        if(typeof Toast!=='undefined') Toast.warn('接口调用失败（'+String(e.message||e).slice(0,40)+'），本条先用离线草稿代替');
        return Offline.route(messages,opt);
      }
    }
    await sleep(520+Math.random()*420);
    return Offline.route(messages,opt);
  }
};
/* 本地离线引擎：无接口时保证全流程可用 */
const Offline={
  route(messages,opt){
    const tag=(opt&&opt.label)||'';
    const sys=(messages[0]&&messages[0].content)||'';
    const last=(messages[messages.length-1]&&messages[messages.length-1].content)||'';
    if(tag==='文风测试') return offlineStyleProbe({desc:'',ex:''});
    if(tag==='戏后笺') return Offline.note(sys,last);
    if(tag==='群像卡') return Offline.cast(last);
    if(tag==='群像幕') return Offline.act(last);
    if(tag==='锐评') return Offline.watch(last);
    if(tag==='评论') return Offline.comment(last);
    return Offline.scene(sys,last);
  },
  scene(sys,last){
    const cn=(sys.match(/姓名：(.+)/)||[])[1]||'他';
    const un=(sys.match(/【我方[^】]*】\n姓名：(.+)/)||[])[1]||'我';
    const act=(last.match(/我的行动：(.+)/)||[])[1]||'';
    const L=[
      `@景|雨把窗纸打得发亮，屋里只剩一盏灯，灯芯烧得有些歪。`,
      `@旁|${act?`我${act}。`:'我没有说话，先把手里的东西放下了。'}空气里有股潮气，像谁刚哭过又擦干净。`,
      `@动:${cn}|他抬眼，指节在桌沿轻轻叩了一下，又停住。`,
      `@白:${cn}|你来得比我想的**早**。`,
      `@心:${un}|他说这句话时没有看我。他不看我的时候，才是真的在意。`,
      `@白:${un}|我怕再晚一点，你就把话咽回去了。`,
      `@动:${cn}|他笑了一下，很轻，像怕被人听见。`,
      `@注:禁香|以亡者遗物为引所制之香，能唤回一段记忆，私制者按律流放。`,
      `@旁|他把袖中那支[[禁香]]推过来，推到一半又停下，指腹压着香身，没有松手。`,
      `@白:${cn}|这东西一旦点了，就收不回来。你想好了？`,
      `@选项|我伸手把香接过来||我按住他的手，不让他松||我先问他一句：你怕的是香，还是我`
    ];
    return L.join('\n');
  },
  note(sys,last){
    const cn=(sys.match(/角色：(.+)/)||[])[1]||'他';
    return `@情绪|克制的心疼\n@正文|她把香接过去的时候，指尖是凉的。我本该拦住她——按规矩，按我这些年学会的所有规矩。\n我没拦。\n我只是把手收回来，收得很慢，慢到自己都觉得可笑。\n值房的灯烧了一夜。我坐到天亮，把案卷翻了三遍，一个字也没看进去。\n@金句|我不怕那支香。我怕她点完之后，回头看我的眼神会变。\n@悄悄话|下次别把手伸得那么快。你不知道我拦你的那一瞬间，用了多大力气才让自己停下。\n@好感|+6`;
  },
  cast(theme){
    return `@人物|沈砚舟|32|旧唱片行老板|散漫、爱开玩笑，讲到某个人时会突然安静|把她点过的每首歌都记在本子上，从没告诉过她\n@人物|周雾|29|夜班电台主播|声音温柔，说话总留三分，习惯替别人做决定|她播的每期结尾曲，都是那家店里放过的那张碟\n@人物|阿棠|24|逃学来打工的女孩|直白、爱起哄，是唯一敢戳破他们的人|她其实在替姐姐还债，谁也没说\n@人物|老陈|55|隔壁修表匠|话少，手稳，看得最明白|他妻子走前最后一句话，也是在这家店说的\n@关系|沈砚舟—周雾|七年前的一次错过，谁都没提\n@关系|阿棠—沈砚舟|像哥哥，也像共犯\n@关系|老陈—所有人|沉默的见证`;
  },
  act(t){
    return `@幕|第一幕 · 打烊前十分钟\n@景|海风把卷帘门吹得响了一下。店里最后一张碟正转到 B 面，沙沙的。\n@动:沈砚舟|他伸手要按停唱机，手停在半空。\n@白:沈砚舟|再听一遍吧。反正也没人来了。\n@动:周雾|她站在门口，没进来，也没走。\n@白:周雾|我以为你早换歌了。\n@白:沈砚舟|换过。**换回来了。**\n@心:周雾|七年了。他还是不肯把话说完，还是等着我先开口。\n@旁|唱针走到划痕那里，跳了一下，又接上。像一句被打断了七年的话，终于接着往下说。\n@选项|周雾走进来关门||周雾转身离开||阿棠从后面推了她一把`;
  },
  watch(t){ return `他记了七年的歌单，却连一句「你还在听吗」都不敢问。这种人我见过——把在意藏在细节里，然后骗自己是习惯。`; },
  comment(t){ return `第三幕她关门那下我心口一紧。真的会有人为了一张碟守七年吗，会的吧。`; }
};

/* ───────── 7. 协议解析 & 渲染 ───────── */
function parseScript(raw){
  const out=[]; const notes={};
  String(raw||'').split(/\r?\n/).forEach(line=>{
    let s=line.trim(); if(!s) return;
    s=s.replace(/^```+.*$/,''); if(!s) return;
    const m=s.match(/^@([\u4e00-\u9fa5]+)(?::([^|]+))?\|([\s\S]*)$/);
    if(!m){ out.push({t:'narr',x:s}); return; }
    const k=m[1], who=(m[2]||'').trim(), x=(m[3]||'').trim();
    switch(k){
      case '幕': out.push({t:'act',x}); break;
      case '景': out.push({t:'scene',x}); break;
      case '旁': out.push({t:'narr',x}); break;
      case '白': out.push({t:'dlg',who,x}); break;
      case '心': out.push({t:'think',who,x}); break;
      case '动': out.push({t:'act2',who,x}); break;
      case '系统': out.push({t:'sys',x}); break;
      case '注': notes[who]=x; break;
      case '选项': out.push({t:'choice',list:x.split('||').map(v=>v.trim()).filter(Boolean)}); break;
      default: out.push({t:'narr',x:s.replace(/^@[^|]*\|/,'')});
    }
  });
  return {blocks:out,notes};
}
function inline(text,notes){
  let h=esc(text);
  h=h.replace(/\*\*([^*]{1,60})\*\*/g,'<em class="fl-em">$1</em>');
  h=h.replace(/\[\[([^\]]{1,24})\]\]/g,(m,w)=>`<span class="fl-note-chip" data-note="${esc(w)}">${esc(w)}</span>`);
  return h;
}
/* 朗读：优先走「语音模型」设置页配置好的 MiniMax T2A（真实音色，与 settings.js 语音测试用的是同一份
   luna_voice_current / luna_voice_model / luna_voice_region），没配置或请求失败时才退回浏览器自带的
   speechSynthesis 兜底，保证任何情况下点了朗读键都有反应，而不是"配了语音模型也听不出区别"。 */
const TTS={
  _audio:null,
  ok(){ return !!(window.speechSynthesis||window.FLTTS)||true; }, // MiniMax 路径不依赖浏览器 TTS 能力，按钮始终可点
  hasVoiceModel(){ const v=Adapter.voiceSettings(); return !!(v.groupId&&v.apiKey&&v.voiceId); },
  async speak(text,btn){
    if(!text) return;
    btn&&btn.classList.add('is-playing');
    const done=()=>btn&&btn.classList.remove('is-playing');
    if(TTS.hasVoiceModel()){
      try{ await TTS._speakMiniMax(text); done(); return; }
      catch(e){ console.warn('[浮岚] 语音模型合成失败，转浏览器朗读',e); }
    }
    TTS._speakBrowser(text,done);
  },
  async _speakMiniMax(text){
    const v=Adapter.voiceSettings();
    if(TTS._audio){ try{TTS._audio.pause();}catch(e){} }
    const resp=await fetch(`${v.host}/v1/t2a_v2?GroupId=${encodeURIComponent(v.groupId)}`,{
      method:'POST',
      headers:{'Authorization':'Bearer '+v.apiKey,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:v.model, text, stream:false,
        voice_setting:{voice_id:v.voiceId,speed:1.0,vol:1.0,pitch:0},
        audio_setting:{sample_rate:32000,bitrate:128000,format:'mp3'}
      })
    });
    if(!resp.ok) throw new Error('HTTP '+resp.status);
    const data=await resp.json();
    if(data.base_resp&&data.base_resp.status_code!==0) throw new Error(data.base_resp.status_msg||'合成失败');
    const hex=data.data&&data.data.audio;
    if(!hex) throw new Error('未返回音频数据');
    const bytes=new Uint8Array(hex.length/2);
    for(let i=0;i<bytes.length;i++) bytes[i]=parseInt(hex.substr(i*2,2),16);
    const url=URL.createObjectURL(new Blob([bytes],{type:'audio/mp3'}));
    const audio=new Audio(url); TTS._audio=audio;
    await new Promise((res,rej)=>{ audio.onended=res; audio.onerror=rej; audio.play().catch(rej); });
  },
  _speakBrowser(text,done){
    if(!window.speechSynthesis){ done(); return; }
    try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); u.lang='zh-CN'; u.rate=.96;
      u.onend=done; u.onerror=done; speechSynthesis.speak(u);
    }catch(e){ done(); }
  }
};
function ttsBtn(text){
  return `<button class="fl-tts" data-say="${esc(text)}" aria-label="朗读"><svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4zM16 8.5a5 5 0 010 7"/></svg></button>`; }
function renderBlocks(blocks,notes,opt){
  opt=opt||{}; const wrap=document.createElement('div'); wrap.className='fl-blkgroup'; wrap.style.display='grid'; wrap.style.gap='14px';
  blocks.forEach(b=>{
    const d=document.createElement('div');
    if(b.t==='act'){ d.className='fl-blk fl-blk--act-title'; d.innerHTML=`<b>${esc(b.x)}</b><i></i>`; }
    else if(b.t==='scene'){ d.className='fl-blk fl-blk--scene'; d.innerHTML=inline(b.x,notes); }
    else if(b.t==='narr'){ d.className='fl-blk fl-blk--narr'; d.innerHTML=inline(b.x,notes); }
    else if(b.t==='dlg'){ d.className='fl-blk fl-blk--dlg'+(opt.userName&&b.who===opt.userName?' is-user':'');
      d.innerHTML=`<div class="fl-blk__nm">${esc(b.who)}${ttsBtn(b.x)}</div><div class="fl-blk__say">${inline(b.x,notes)}</div>`; }
    else if(b.t==='think'){ d.className='fl-blk fl-blk--think'; d.innerHTML=inline(b.x,notes); }
    else if(b.t==='act2'){ d.className='fl-blk fl-blk--act'; d.innerHTML=inline((b.who?'':'')+b.x,notes); }
    else if(b.t==='sys'){ d.className='fl-blk fl-blk--sys'; d.innerHTML=`<span>${esc(b.x)}</span>`; }
    else return;
    wrap.appendChild(d);
  });
  wrap.addEventListener('click',e=>{
    const chip=e.target.closest('.fl-note-chip');
    if(chip){ const w=chip.dataset.note; popNote(w, notes[w]||'这一处上文没有留下注解。'); return; }
    const say=e.target.closest('.fl-tts'); if(say){ TTS.speak(say.dataset.say,say); }
  });
  return wrap;
}
async function revealIn(node,host,speed){
  host.appendChild(node);
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||speed===0) return;
  const kids=Array.from(node.children);
  kids.forEach(k=>k.style.visibility='hidden');
  for(const k of kids){ k.style.visibility='visible'; k.style.animation='flRise .45s ease both';
    host.parentElement.scrollTop=host.parentElement.scrollHeight; await sleep(speed||120); }
}

/* ───────── 8. 织叙：设定台 ───────── */
const GENRES=['现代','古代','校园','仙侠','西幻','都市异能','科幻','悬疑','年代','末世','宫廷','职场'];
const CONFLICTS=['身份对立','秘密被发现','立场之争','误会','救与被救','时间紧迫','旧账重提','外力拆散'];
const ENDINGS=['圆满收场','遗憾收场','开放结局','轮回重来','各自安好'];
const WORLD_PRESETS=['架空古代','现代都市','民国旧影','近未来','海边小城','雨季山城','末世废土','仙门宗派'];
const Studio={
  st:null, step:0,
  blank(){ return {id:uid('sc'),title:'',charId:'',userId:'',bound:false,styleId:'s_bailu',mods:[],
    era:'',rule:'',now:'',wish:'',genres:[],relation:'',opening:'',conflict:[],must:'',taboo:'',ending:[],
    sweet:60,pain:30,pace:50,detail:65,choice:55,rating:'warm',
    narrator:'user',povUser:'first',povChar:'third',tense:'now',address:'',
    segLen:600,chapters:8,memory:'rolling',autoChoice:true,autoNote:true,autoAnchor:true,strictTaboo:true}; },
  open(resume){
    Studio.st = resume || DB.get('draft',null) || Studio.blank();
    Studio.step=0; Router.go('studio');
    Loading.show('正在读取角色卡与身份…');
    Adapter.preload().then(()=>{ Loading.hide(); Studio.paint(); }).catch(()=>{ Loading.hide(); Studio.paint(); });
  },
  paint(){
    const st=Studio.st;
    $('#flSteps').innerHTML=Array.from({length:6},(_,i)=>`<i class="${i<=Studio.step?'is-on':''}"></i>`).join('');
    $$('.fl-step').forEach(s=>s.classList.toggle('is-on', +s.dataset.step===Studio.step));
    $('#flNext').textContent = Studio.step===5?'开台':'下一步';
    $('#flPrev').style.visibility = Studio.step===0?'hidden':'visible';
    if(Studio.step===0) Studio.paintCast();
    if(Studio.step===1) Studio.paintStyle();
    if(Studio.step===2) Studio.paintWorld();
    if(Studio.step===3) Studio.paintPlot();
    if(Studio.step===4) Studio.paintPov();
    if(Studio.step===5) Studio.paintLen();
  },
  paintCast(){
    const st=Studio.st, cs=Adapter.charsSync(), us=Adapter.usersSync();
    const cw=$('#flPickChar'); cw.className='fl-pick'; cw.innerHTML='';
    if(!cs.length){ cw.innerHTML='<div class="fl-empty" style="padding:20px"><span>还没有任何角色卡。请先去「角色」App 建一张，再回来开台。</span></div>'; }
    cs.forEach(c=>{ const boundUid=Adapter.boundUserIdOf(c.id);
      const b=document.createElement('button'); b.className='fl-pk'+(st.charId===c.id?' is-on':'');
      b.innerHTML=`<div class="fl-pk__av">${c.avatar?`<img src="${esc(c.avatar)}" alt="">`:esc(c.name[0]||'')}</div><b>${esc(c.name)}</b><span>${esc((c.persona||'').slice(0,14))}</span>${boundUid?'<i class="fl-pk__tag">已绑定 USER</i>':''}`;
      b.onclick=()=>{ st.charId=c.id; const bu=Adapter.boundUserIdOf(c.id); if(bu&&us.some(u=>u.id===bu)) st.userId=bu; Studio.paintCast(); };
      cw.appendChild(b); });
    const uw=$('#flPickUser'); uw.className='fl-pick'; uw.innerHTML='';
    const none=document.createElement('button'); none.className='fl-pk'+(st.userId?'':' is-on');
    none.innerHTML=`<div class="fl-pk__av">—</div><b>不带 user</b><span>只盯角色卡演</span>`;
    none.onclick=()=>{ st.userId=''; Studio.paintCast(); }; uw.appendChild(none);
    us.forEach(u=>{ const b=document.createElement('button'); b.className='fl-pk'+(st.userId===u.id?' is-on':'');
      b.innerHTML=`<div class="fl-pk__av">${u.avatar?`<img src="${esc(u.avatar)}" alt="">`:esc(u.name[0]||'')}</div><b>${esc(u.name)}</b><span>${esc((u.persona||'').slice(0,14))}</span>`;
      b.onclick=()=>{ st.userId=u.id; Studio.paintCast(); }; uw.appendChild(b); });
    const c=cs.find(x=>x.id===st.charId), u=us.find(x=>x.id===st.userId);
    st.bound = !!(c&&u&&Adapter.boundUserIdOf(c.id)===u.id);
    $('#flBindNote').innerHTML = !c ? '先选一位出场角色。生成时会把这张卡整张读进去。'
      : st.bound ? `<b>已绑定：</b>${esc(c.name)} 与 ${esc(u.name)} 之间的既有关系会被一并读入，称呼与相处方式沿用旧账。`
      : u ? `<b>未绑定：</b>${esc(u.name)} 仅作为「我」的身份参考。两卡冲突时，一律以 <b>${esc(c.name)}</b> 的角色卡为准。`
      : `<b>未带 user：</b>生成时会死盯 ${esc(c.name)} 的角色卡推进，不替你安排任何设定外的行为。`;
  },
  paintStyle(){
    const st=Studio.st, s=styleById(st.styleId);
    $('#flStyleSlot').innerHTML=`<div class="fl-sty" style="margin-bottom:12px">
      <div class="fl-sty__hd"><b class="fl-sty__nm">${esc(s.name)}</b><i class="fl-sty__kind${s.mine?' fl-sty__kind--mine':''}">${s.mine?'我的':'内置'}</i></div>
      <p class="fl-sty__ds">${esc(s.desc)}</p><div class="fl-sty__ex">${esc(s.ex||'（此文风未留示例）').replace(/\n/g,'<br>')}</div></div>`;
    Chips($('#flStyleMods'),STYLE_MODS,st.mods);
  },
  paintWorld(){
    const st=Studio.st;
    Chips($('#flWorldPresets'),WORLD_PRESETS,st.era?[st.era]:[],sel=>{ st.era=sel[0]||''; $('#flWorldEra').value=st.era; },true);
    $('#flWorldEra').value=st.era; $('#flWorldRule').value=st.rule; $('#flWorldNow').value=st.now;
    $('#flWorldEra').oninput=e=>st.era=e.target.value;
    $('#flWorldRule').oninput=e=>st.rule=e.target.value;
    $('#flWorldNow').oninput=e=>st.now=e.target.value;
  },
  paintPlot(){
    const st=Studio.st;
    $('#flPlotWish').value=st.wish; $('#flPlotWish').oninput=e=>st.wish=e.target.value;
    Chips($('#flGenres'),GENRES,st.genres);
    Chips($('#flConflict'),CONFLICTS,st.conflict);
    Chips($('#flEnding'),ENDINGS,st.ending);
    ['flRelation','flOpening','flMust','flTaboo'].forEach((id,i)=>{
      const k=['relation','opening','must','taboo'][i]; const el=$('#'+id); el.value=st[k]; el.oninput=e=>st[k]=e.target.value; });
    $$('.fl-sl',$('.fl-step[data-step="3"]')).forEach(sl=>{ const k=sl.dataset.k, inp=sl.querySelector('input'), b=sl.querySelector('b');
      inp.value=st[k]; b.textContent=st[k]; inp.oninput=()=>{ st[k]=+inp.value; b.textContent=inp.value; }; });
    Select($('#flRating'),[
      {v:'all',t:'全年龄',d:'不出现任何越界内容'},
      {v:'warm',t:'微暧昧',d:'可有情绪张力与亲密感，点到为止'},
      {v:'mature',t:'成人向暗示',d:'止于门前，不写露骨细节'}],st.rating,v=>st.rating=v,'尺度分级');
  },
  paintPov(){
    const st=Studio.st;
    Select($('#flNarrator'),[{v:'user',t:'以我方视角',d:'读者跟着「我」走，信息受限'},{v:'char',t:'以角色视角',d:'读者进入他的脑子，能看到他的隐瞒'},
      {v:'both',t:'双线交替',d:'每幕切换一次，误会与真相同时展开'},{v:'omni',t:'全知旁白',d:'像小说，两边都看得见'}],st.narrator,v=>{st.narrator=v;Studio.povDemo();},'主叙述者');
    const povs=[{v:'first',t:'第一人称「我」'},{v:'second',t:'第二人称「你」'},{v:'third',t:'第三人称限知'},{v:'omni',t:'第三人称全知'}];
    Select($('#flPovUser'),povs,st.povUser,v=>{st.povUser=v;Studio.povDemo();},'写我方时');
    Select($('#flPovChar'),povs,st.povChar,v=>{st.povChar=v;Studio.povDemo();},'写角色时');
    Seg($('#flTense'),[{v:'now',t:'现在时'},{v:'past',t:'过去时'}],st.tense,v=>{st.tense=v;Studio.povDemo();});
    $('#flAddress').value=st.address; $('#flAddress').oninput=e=>st.address=e.target.value;
    Studio.povDemo();
  },
  povDemo(){
    const st=Studio.st, c=Adapter.charsSync().find(x=>x.id===st.charId), u=Adapter.usersSync().find(x=>x.id===st.userId);
    const cn=c?c.name:'他', un=u?u.name:'我';
    const me={first:'我把伞收起来，水顺着伞骨滴在门槛上。',second:'你把伞收起来，水顺着伞骨滴在门槛上。',third:`${un}把伞收起来，水顺着伞骨滴在门槛上。`,omni:`${un}把伞收起来，心里那句话还没敢说。`}[st.povUser];
    const him={first:`我看着她进来，没说话。`,second:`你看着她进来，没说话。`,third:`${cn}看着她进来，没说话。`,omni:`${cn}看着她进来，没说话——他其实等了很久了。`}[st.povChar];
    $('#flPovDemo').innerHTML=`<b>这套镜头写出来大概是</b>${esc(me)}<br>${esc(him)}${st.tense==='past'?'<br><span style="font-size:11px;color:var(--fl-ink-3)">（过去时语感：会带"那天""后来"这类回望词）</span>':''}`;
  },
  paintLen(){
    const st=Studio.st;
    Seg($('#flSegLen'),[{v:400,t:'400 字'},{v:600,t:'600 字'},{v:900,t:'900 字'},{v:1400,t:'1400 字'}],st.segLen,v=>{st.segLen=v;Studio.budget();});
    Seg($('#flChapters'),[{v:4,t:'4 幕'},{v:8,t:'8 幕'},{v:16,t:'16 幕'},{v:0,t:'不设上限'}],st.chapters,v=>{st.chapters=v;Studio.budget();});
    Select($('#flMemory'),[
      {v:'rolling',t:'滚动摘要（推荐）',d:'保留最近 6 条原文 + 全场摘要 + 事实锚点，长文不失忆、不涨 token'},
      {v:'full',t:'全量回读',d:'把整场原文都发回去，最准，但字数一多就很贵'},
      {v:'anchor',t:'只带锚点',d:'只带角色卡与关键事实，最省，适合单元剧'}],st.memory,v=>{st.memory=v;Studio.budget();},'记忆策略');
    const sw=$('#flSwitches'); sw.innerHTML='';
    sw.appendChild(Switch('每段末尾给选项','让 AI 提三个走向，也可以自己写',st.autoChoice,v=>st.autoChoice=v));
    sw.appendChild(Switch('生成词条注解','生僻设定自动写成可点开的注解',st.autoNote,v=>st.autoNote=v));
    sw.appendChild(Switch('自动提取事实锚点','把「谁说过什么、发生过什么」记成清单，防前后矛盾',st.autoAnchor,v=>st.autoAnchor=v));
    sw.appendChild(Switch('雷点硬拦截','命中雷点的段落直接丢弃并重写',st.strictTaboo,v=>st.strictTaboo=v));
    $('#flTitle').value=st.title; $('#flTitle').oninput=e=>st.title=e.target.value;
    Studio.budget();
  },
  budget(){
    const st=Studio.st, per=Math.round(st.segLen*1.7)+700;
    const total=st.chapters? per*st.chapters*3 : per*24;
    $('#flBudget').innerHTML=`<b>预估开销</b><br>每次生成约 <b>${fmt(per)}</b> tokens（含角色卡与摘要）；
    ${st.chapters?`按 ${st.chapters} 幕、每幕 3 次推进算，整场约 <b>${fmt(total)}</b> tokens。`:'不设上限时按你推进的次数累计。'}<br>
    ${st.memory==='full'?'当前用「全量回读」，字数过万后每次开销会明显上涨。':'滚动摘要会在每 6 条后压缩一次，长跑一万字以上也不会失忆。'}`;
  },
  next(){
    const st=Studio.st;
    if(Studio.step===0&&!st.charId){ Toast.warn('先选一位出场角色'); return; }
    if(Studio.step<5){ Studio.step++; Studio.paint(); $('.fl-page[data-page="studio"] .fl-scroll').scrollTop=0; return; }
    Studio.launch();
  },
  async launch(){
    const st=Studio.st;
    const cs=Adapter.charsSync().find(c=>c.id===st.charId), us=Adapter.usersSync().find(u=>u.id===st.userId);
    const sc={ id:st.id, kind:'weave', setup:Object.assign({},st,{char:cs,user:us}),
      title:st.title|| (st.wish? st.wish.slice(0,12) : (cs?cs.name+'的一场戏':'未命名')),
      charName:cs?cs.name:'', userName:us?us.name:'', turns:[], summary:'', anchors:[],
      heat:20, favor:30, chapter:1, words:0, created:Date.now(), updated:Date.now() };
    const all=DB.get('scripts',[]); all.unshift(sc); DB.set('scripts',all); DB.set('draft',null);
    Reader.open(sc.id); Rank.addXP(20,'开台');
    Toast.ok('开台了，正在起第一幕');
    await Reader.advance('');
  }
};

/* ───────── 9. 阅读器（织叙） ───────── */
const Reader={
  sc:null, busy:false,
  scripts(){ return DB.get('scripts',[]); },
  save(){ const a=Reader.scripts(); const i=a.findIndex(s=>s.id===Reader.sc.id);
    Reader.sc.updated=Date.now(); if(i<0) a.unshift(Reader.sc); else a[i]=Reader.sc; DB.set('scripts',a); },
  open(id){
    const sc=Reader.scripts().find(s=>s.id===id); if(!sc){ Toast.warn('这份存档找不到了'); return; }
    Reader.sc=sc; Router.go('reader'); Reader.paint();
  },
  paint(){
    const sc=Reader.sc;
    $('#flReadTitle').textContent=sc.title;
    $('#flReadSub').textContent=`${sc.charName||'—'}${sc.userName?' × '+sc.userName:''} · 第 ${sc.chapter} 幕 · ${fmt(sc.words)} 字`;
    $('#flMeters').innerHTML=`
      <div class="fl-mt">好感 <i><em style="width:${sc.favor}%"></em></i> ${sc.favor}</div>
      <div class="fl-mt fl-mt--heat">张力 <i><em style="width:${sc.heat}%"></em></i> ${sc.heat}</div>
      <div class="fl-mt">文风 ${esc(styleById(sc.setup.styleId).name)}</div>
      <div class="fl-mt">锚点 ${(sc.anchors||[]).length}</div>`;
    const th=$('#flThread'); th.innerHTML='';
    sc.turns.forEach((t,ix)=>th.appendChild(Reader.turnEl(t,ix)));
    Reader.paintChoices(sc.turns.length?sc.turns[sc.turns.length-1]:null);
    setTimeout(()=>{ const s=$('#flReadScroll'); s.scrollTop=s.scrollHeight; },60);
  },
  turnEl(t,ix){
    const wrap=document.createElement('div'); wrap.dataset.ix=ix;
    if(t.role==='me'){
      const d=document.createElement('div'); d.className='fl-blk fl-blk--dlg is-user';
      d.innerHTML=`<div class="fl-blk__nm">${esc(Reader.sc.userName||'我')}</div><div class="fl-blk__say">${esc(t.text)}</div>`;
      wrap.appendChild(d); return wrap;
    }
    const p=parseScript(t.text);
    wrap.appendChild(renderBlocks(p.blocks,p.notes,{userName:Reader.sc.userName}));
    const tools=document.createElement('div'); tools.className='fl-blk__tools';
    tools.innerHTML=`<button class="fl-blk__tool" data-act="regen">重生成这条</button>
      <button class="fl-blk__tool" data-act="anchor">存为锚点</button>
      <button class="fl-blk__tool" data-act="note">写戏后笺</button>
      <button class="fl-blk__tool" data-act="copy">复制</button>`;
    tools.onclick=e=>{ const b=e.target.closest('[data-act]'); if(!b) return;
      const a=b.dataset.act;
      if(a==='regen') Reader.regen(ix);
      if(a==='copy'){ navigator.clipboard&&navigator.clipboard.writeText(t.text.replace(/^@[^|]*\|/gm,'')); Toast.ok('已复制正文'); }
      if(a==='anchor') Reader.addAnchor(t.text);
      if(a==='note') Notes.make(Reader.sc,t.text);
    };
    wrap.appendChild(tools); return wrap;
  },
  paintChoices(last){
    const box=$('#flChoices'); box.innerHTML='';
    if(!last||last.role==='me') return;
    const p=parseScript(last.text); const c=p.blocks.find(b=>b.t==='choice');
    if(!c) return;
    c.list.forEach((x,i)=>{ const b=document.createElement('button'); b.className='fl-choice'; b.dataset.ix=['壹','贰','叁','肆'][i]||(i+1);
      b.textContent=x; b.onclick=()=>Reader.advance(x); box.appendChild(b); });
    const f=document.createElement('button'); f.className='fl-choice fl-choice--free'; f.dataset.ix='他';
    f.textContent='都不选，我自己写一句'; f.onclick=()=>{ $('#flAct').focus(); }; box.appendChild(f);
  },
  addAnchor(text){
    const b=Modal.open({title:'存为锚点',body:`<textarea class="fl-in fl-in--ta" id="flAnchorIn" rows="3" placeholder="用一句话写下这里发生了什么"></textarea>
      <p style="font-size:11px;color:var(--fl-ink-3);margin-top:8px">锚点会一直跟着这场戏，模型每次生成都会读，用来防止前后矛盾。</p>`,
      actions:[{t:'取消'},{t:'记下',p:1,fn(){ const v=$('#flAnchorIn').value.trim(); if(!v){ Toast.warn('写一句再记'); return false; }
        Reader.sc.anchors=Reader.sc.anchors||[]; Reader.sc.anchors.push(v); Reader.save(); Reader.paint(); Toast.ok('锚点已记下'); }}]});
    const clean=text.replace(/^@[^|]*\|/gm,'').replace(/\n/g,' ').slice(0,40);
    setTimeout(()=>{ $('#flAnchorIn').value=clean; },30);
  },
  async advance(myLine){
    if(Reader.busy) return; const sc=Reader.sc; if(!sc) return;
    Reader.busy=true; $('#flChoices').innerHTML='';
    if(myLine){ sc.turns.push({role:'me',text:myLine,at:Date.now()}); $('#flThread').appendChild(Reader.turnEl(sc.turns[sc.turns.length-1],sc.turns.length-1)); }
    const _s=Adapter.settings();
    const _src=(window.FLAI&&window.FLAI.generate)?'外部接入':(_s.apiBase&&_s.apiKey)?_s.model:'离线兜底（未在"设置"里配置接口）';
    Loading.show('正在起雾…', `目标 ${sc.setup.segLen} 字 · 本次约 ${fmt(Reader.estTokens())} tokens · ${({rolling:'滚动摘要',full:'全量回读',anchor:'只带锚点'})[sc.setup.memory]} · 引擎：${_src}`);
    try{
      const text=await Reader.callModel(myLine);
      const clean=Reader.guard(text);
      sc.turns.push({role:'ai',text:clean,at:Date.now()});
      sc.words+=clean.replace(/^@[^|]*\|/gm,'').replace(/\s/g,'').length;
      sc.heat=clamp(sc.heat+3+Math.round(Math.random()*6),0,100);
      sc.favor=clamp(sc.favor+(myLine?2:1)+Math.round(Math.random()*4),0,100);
      if((sc.turns.filter(t=>t.role==='ai').length)%3===0) sc.chapter++;
      await Reader.compress();
      Reader.save(); Loading.hide();
      const el=Reader.turnEl(sc.turns[sc.turns.length-1],sc.turns.length-1);
      const holder=document.createElement('div'); $('#flThread').appendChild(holder);
      holder.replaceWith(el);
      const grp=el.querySelector('.fl-blkgroup');
      if(grp){ const kids=Array.from(grp.children); kids.forEach(k=>k.style.visibility='hidden');
        for(const k of kids){ k.style.visibility='visible'; $('#flReadScroll').scrollTop=$('#flReadScroll').scrollHeight; await sleep(110); } }
      Reader.paintChoices(sc.turns[sc.turns.length-1]);
      $('#flReadTitle').textContent=sc.title;
      $('#flReadSub').textContent=`${sc.charName||'—'}${sc.userName?' × '+sc.userName:''} · 第 ${sc.chapter} 幕 · ${fmt(sc.words)} 字`;
      Rank.addXP(6+Math.round(clean.length/260),'推进剧情');
      const s=Rank.stat(); s.turns++; s.words+=clean.length; DB.set('stat',s);
      if(sc.setup.autoNote&&sc.turns.filter(t=>t.role==='ai').length%3===0) Notes.make(sc,clean,true);
    }catch(e){ console.error(e); Loading.hide(); Toast.warn('这一段没能写出来，换个说法再试一次'); }
    Reader.busy=false;
  },
  /* 实时 token 预估：角色卡 + 摘要 + 锚点 + 回带原文 + 本次目标字数。
     中文按 1 字≈1.5 token 粗算，够用来给用户一个心里数。 */
  estTokens(){
    const sc=Reader.sc, st=sc.setup;
    const card=(charCard(st.char)+(st.user?st.user.persona:'')).length;
    const mem=(sc.summary||'').length+(sc.anchors||[]).join('').length;
    const keep=st.memory==='full'?sc.turns:(st.memory==='anchor'?sc.turns.slice(-2):sc.turns.slice(-6));
    const back=keep.reduce((n,t)=>n+t.text.length,0);
    return Math.round((card+mem+back+900)*1.5 + st.segLen*1.9);
  },
  async callModel(myLine,retry){
    const sc=Reader.sc, st=sc.setup;
    const sys=buildSystem(st);
    const msgs=[{role:'system',content:sys},{role:'system',content:memoryBlock(sc)}];
    const keep = st.memory==='full' ? sc.turns : (st.memory==='anchor'? sc.turns.slice(-2) : sc.turns.slice(-6));
    keep.forEach(t=>msgs.push({role:t.role==='me'?'user':'assistant',content:t.role==='me'?('我的行动：'+t.text):t.text}));
    msgs.push({role:'user',content: myLine? `我的行动：${myLine}\n请接着往下写，只写这一段。`
      : (sc.turns.length? '请接着往下写，只写这一段。' : '请写开场第一幕。')});
    return AI.gen(msgs,{max:Math.round(st.segLen*1.9)+320,temp:retry?1.02:.92});
  },
  guard(text){
    const st=Reader.sc.setup; let t=String(text||'').replace(/```[a-z]*\n?/g,'').trim();
    if(!/^@/m.test(t)) t=t.split(/\n+/).map(l=>'@旁|'+l.trim()).join('\n');
    if(st.strictTaboo&&st.taboo){
      const bans=st.taboo.split(/[、,，\s]+/).filter(w=>w.length>1);
      const hit=bans.filter(b=>t.includes(b));
      if(hit.length) t=t.split('\n').filter(l=>!hit.some(b=>l.includes(b))).join('\n')+'\n@系统|此处已按你的雷点绕开';
    }
    return t;
  },
  async compress(){
    const sc=Reader.sc; if(sc.setup.memory!=='rolling') return;
    const ai=sc.turns.filter(t=>t.role==='ai');
    if(ai.length%6!==0) return;
    try{
      const body=sc.turns.slice(-12).map(t=>t.text.replace(/^@[^|]*\|/gm,'')).join('\n').slice(0,4000);
      const r=await AI.gen([{role:'system',content:'把下面的剧情压缩成不超过 220 字的客观摘要，只保留发生了什么、关系如何变化、留下了哪些未解之事。不要评价，不要markdown。'},
        {role:'user',content:body}],{max:340,label:'摘要'});
      sc.summary=(sc.summary? sc.summary+'\n':'')+r.trim();
      if(sc.summary.length>900) sc.summary=sc.summary.slice(-900);
    }catch(e){}
  },
  async regen(ix){
    const sc=Reader.sc; if(Reader.busy) return;
    const s=Rank.stat(); const today=new Date().toDateString();
    const rg=DB.get('regen',{d:today,n:0}); if(rg.d!==today){ rg.d=today; rg.n=0; }
    const free=Rank.freeRegen(Rank.levelOf(s.xp).level);
    const cost=rg.n>=free?2:0;
    const run=async()=>{
      Reader.busy=true; Loading.show('重写这一段…');
      const cut=sc.turns.slice(0,ix); const backup=sc.turns.slice(ix);
      const myLine=(backup[0]&&backup[0].role==='me')?backup[0].text:'';
      sc.turns=cut.concat(myLine?[{role:'me',text:myLine,at:Date.now()}]:[]);
      try{ const t=Reader.guard(await Reader.callModel(myLine,true));
        sc.turns.push({role:'ai',text:t,at:Date.now()}); rg.n++; DB.set('regen',rg); Reader.save(); Reader.paint(); Toast.ok('换了一版');
      }catch(e){ sc.turns=cut.concat(backup); Toast.warn('重写失败，已保留原来那版'); }
      Loading.hide(); Reader.busy=false;
    };
    if(cost>0) Pay.charge(cost,'重生成',run); else run();
  },
  menu(){
    Sheet.open('本场设置',b=>{
      const sc=Reader.sc;
      b.innerHTML=`<div class="fl-optlist">
        <button class="fl-opt" data-m="rename"><i class="fl-opt__dot"></i><span><b>改名</b><span>当前：${esc(sc.title)}</span></span></button>
        <button class="fl-opt" data-m="branch"><i class="fl-opt__dot"></i><span><b>从这里分岔</b><span>复制成一份新存档，两条路各走各的</span></span></button>
        <button class="fl-opt" data-m="notes"><i class="fl-opt__dot"></i><span><b>本场的戏后笺</b><span>${Notes.all().filter(n=>n.scriptId===sc.id).length} 封</span></span></button>
        <button class="fl-opt" data-m="anchors"><i class="fl-opt__dot"></i><span><b>事实锚点</b><span>${(sc.anchors||[]).length} 条 · 决定模型记住什么</span></span></button>
        <button class="fl-opt" data-m="summary"><i class="fl-opt__dot"></i><span><b>剧情摘要</b><span>模型每次都会读的那段</span></span></button>
        <button class="fl-opt" data-m="theme"><i class="fl-opt__dot"></i><span><b>本场阅读样式</b><span>字号、行距、卡片主题</span></span></button>
        <button class="fl-opt" data-m="note"><i class="fl-opt__dot"></i><span><b>让他写一封戏后笺</b><span>以角色口吻写读后感</span></span></button>
        <button class="fl-opt" data-m="export"><i class="fl-opt__dot"></i><span><b>导出全文</b><span>纯文本，去掉标记</span></span></button>
        <button class="fl-opt" data-m="del"><i class="fl-opt__dot"></i><span><b>删除这场戏</b><span>不可恢复</span></span></button></div>`;
      b.onclick=e=>{ const t=e.target.closest('[data-m]'); if(!t) return; const m=t.dataset.m; Sheet.close();
        if(m==='rename') Modal.open({title:'改名',body:`<input class="fl-in" id="flRn" value="${esc(sc.title)}">`,actions:[{t:'取消'},{t:'存',p:1,fn(){ sc.title=$('#flRn').value||sc.title; Reader.save(); Reader.paint(); }}]});
        if(m==='branch') Reader.branch();
        if(m==='notes'){ DB.set('noteFilter','all'); Router.go('notes'); Notes.paint();
          const has=Notes.all().some(n=>n.scriptId===sc.id);
          if(!has) Toast.warn('这场戏还没有人写笺，去某一段下面点「写戏后笺」'); }
        if(m==='anchors') Reader.anchorSheet();
        if(m==='summary') Modal.open({title:'剧情摘要',body:`<textarea class="fl-in fl-in--ta" id="flSm" rows="8">${esc(sc.summary||'')}</textarea>`,actions:[{t:'取消'},{t:'存',p:1,fn(){ sc.summary=$('#flSm').value; Reader.save(); }}]});
        if(m==='theme') Boudoir.readerSheet(sc);
        if(m==='note') Notes.make(sc, sc.turns.filter(t=>t.role==='ai').slice(-1)[0]?.text||'');
        if(m==='export'){ const t=sc.turns.map(x=>x.text.replace(/^@[^|]*\|/gm,'')).join('\n\n');
          Modal.open({title:'导出全文',body:`<textarea class="fl-in fl-in--ta" rows="10">${esc(t)}</textarea><p style="font-size:11px;color:var(--fl-ink-3);margin-top:8px">长按全选复制。</p>`,actions:[{t:'好',p:1}]}); }
        if(m==='del') confirmBox('删除这场戏','删掉之后就找不回来了，确定吗','删掉',()=>{
          DB.set('scripts',Reader.scripts().filter(x=>x.id!==sc.id)); Router.go('archives'); Archives.paint(); Toast.ok('已删除'); });
      };
    });
  },
  /* 分支存档：把当前这场从任意一段剪断，复制成一份全新的独立存档。
     原存档一个字都不动，两条路各自往下走、各自美化、各自记锚点。 */
  branch(){
    const sc=Reader.sc; if(!sc) return;
    const pts=sc.turns.map((t,i)=>({i,t})).filter(x=>x.t.role==='ai');
    if(!pts.length){ Toast.warn('这场还没写出东西，暂时没法分岔'); return; }
    Sheet.open('从哪一段分岔',b=>{
      b.insertAdjacentHTML('beforeend','<p style="font-size:11.5px;color:var(--fl-ink-3);text-align:center;margin-bottom:14px">选中的那一段会被保留，之后的内容不带进新存档。原来这场完全不受影响。</p>');
      const list=document.createElement('div'); list.className='fl-optlist';
      pts.slice().reverse().forEach(({i,t})=>{
        const ex=t.text.replace(/^@[^|]*\|/gm,'').replace(/\n/g,' ').slice(0,38);
        const btn=document.createElement('button'); btn.className='fl-opt';
        btn.innerHTML=`<i class="fl-opt__dot"></i><span style="flex:1"><b>第 ${pts.findIndex(p=>p.i===i)+1} 段</b><span>${esc(ex)}…</span></span>`;
        btn.onclick=()=>{ Sheet.close(); Reader.doBranch(i); };
        list.appendChild(btn);
      });
      b.appendChild(list);
    });
  },
  doBranch(ix){
    const sc=Reader.sc;
    const copy=JSON.parse(JSON.stringify(sc));
    copy.id=uid('sc');
    copy.title=(sc.title||'未命名').replace(/（分支.*?）$/,'')+'（分支 '+((Reader.scripts().filter(x=>x.branchOf===sc.id).length)+1)+'）';
    copy.branchOf=sc.id; copy.branchAt=ix;
    copy.turns=sc.turns.slice(0,ix+1);
    copy.words=copy.turns.filter(t=>t.role==='ai').reduce((n,t)=>n+t.text.replace(/^@[^|]*\|/gm,'').replace(/\s/g,'').length,0);
    copy.chapter=Math.max(1,Math.ceil(copy.turns.filter(t=>t.role==='ai').length/3));
    copy.created=Date.now(); copy.updated=Date.now();
    const a=Reader.scripts(); a.unshift(copy); DB.set('scripts',a);
    Rank.addXP(10,'分支存档');
    Reader.open(copy.id); Toast.ok('已分岔成一份新存档，原来那场原样留着');
  },
  anchorSheet(){
    Sheet.open('事实锚点',b=>{ const sc=Reader.sc; const list=document.createElement('div'); list.className='fl-optlist';
      (sc.anchors||[]).forEach((a,i)=>{ const d=document.createElement('div'); d.className='fl-opt';
        d.innerHTML=`<i class="fl-opt__dot"></i><span style="flex:1"><b style="font-weight:400;font-size:12.5px">${esc(a)}</b></span><button class="fl-mini fl-mini--warn">删</button>`;
        d.querySelector('button').onclick=()=>{ sc.anchors.splice(i,1); Reader.save(); Sheet.close(); Reader.anchorSheet(); }; list.appendChild(d); });
      if(!(sc.anchors||[]).length) list.innerHTML='<p style="text-align:center;color:var(--fl-ink-3);font-size:12px;padding:20px">还没有锚点。在任意一段下面点「存为锚点」，模型就会一直记着。</p>';
      b.appendChild(list); });
  }
};

/* ───────── 10. 存档列表 ───────── */
const Archives={
  paint(){
    const box=$('#flArchList'); const a=DB.get('scripts',[]);
    if(!a.length){ box.innerHTML=`<div class="fl-empty"><b>还没有开过台</b><span>选一位角色，写下你想看的那一幕，<br>其余的交给雾。</span><button class="fl-solid" data-go="studio">去开台</button></div>`; return; }
    box.innerHTML=''; a.forEach(sc=>box.appendChild(Archives.card(sc)));
  },
  card(sc){
    const d=document.createElement('button'); d.className='fl-arch';
    sc.turns=sc.turns||[]; sc.setup=sc.setup||{}; sc.words=sc.words||0; sc.chapter=sc.chapter||1;
    const ex=(sc.turns.slice(-1)[0]?.text||'').replace(/^@[^|]*\|/gm,'').slice(0,80);
    d.innerHTML=`<div class="fl-arch__t">${esc(sc.title)}</div>
      <div class="fl-arch__meta"><span>${esc(sc.charName||'—')}</span><span>第 ${sc.chapter} 幕</span><span>${fmt(sc.words)} 字</span></div>
      <div class="fl-arch__ex">${esc(ex||'还没开始写')}</div>
      <div class="fl-arch__ft"><i class="fl-tagline">${esc(styleById(sc.setup.styleId).name)}</i>${sc.branchOf?'<i class="fl-tagline fl-tagline--br">分支</i>':''}<i class="fl-tagline">${when(sc.updated)}</i></div>`;
    d.onclick=()=>Reader.open(sc.id); return d;
  }
};

/* ───────── 11. 戏后笺 ───────── */
const Notes={
  all(){ return DB.get('notes',[]); },
  async make(sc,lastText,silent){
    if(!sc) return;
    if(!silent) Loading.show('他正在写…');
    const c=sc.setup.char;
    const sys=`你现在是「${c?c.name:'角色'}」本人，刚演完一场戏。
角色卡（必须完全贴合，绝不 OOC）：
${charCard(c)}
你要写的是只有你自己会看的东西：戏散场后的心里话。可以写没说出口的、后悔的、庆幸的、注意到但没提的细节。
不要复述剧情，不要总结，不要评价"这场戏"，就当是自己在纸上写。
严格按下面的行标记输出，除此之外什么都不要写：
@情绪|四个字以内的心情
@正文|100-260 字的第一人称心里话，可以分行
@金句|一句最戳的话，不超过 30 字
@悄悄话|一句想对${sc.userName||'对方'}说、但当时没说的话
@好感|一个带正负号的整数，范围 -10 到 +10`;
    let raw='';
    try{ raw=await AI.gen([{role:'system',content:sys},{role:'user',content:'刚刚这场：\n'+String(lastText||'').replace(/^@[^|]*\|/gm,'').slice(0,1600)}],{max:520,label:'戏后笺'}); }
    catch(e){ raw=''; }
    if(!silent) Loading.hide();
    if(!raw) { if(!silent) Toast.warn('他这次没写出来'); return; }
    const g=k=>{ const m=raw.match(new RegExp('@'+k+'\\|([\\s\\S]*?)(?=\\n@|$)')); return m?m[1].trim():''; };
    const n={ id:uid('nt'), scriptId:sc.id, scriptTitle:sc.title, char:sc.charName, user:sc.userName,
      chapter:sc.chapter, mood:g('情绪')||'难说', body:g('正文'), quote:g('金句'), whisper:g('悄悄话'),
      favor:parseInt(g('好感')||'0',10)||0, at:Date.now() };
    const a=Notes.all(); a.unshift(n); DB.set('notes',a);
    const s=Reader.scripts().find(x=>x.id===sc.id); if(s){ s.favor=clamp(s.favor+n.favor,0,100); DB.set('scripts',Reader.scripts().map(x=>x.id===s.id?s:x)); }
    Rank.addXP(12,'戏后笺');
    if(!silent){ Notes.detail(n.id); } else Toast.ok(`${sc.charName} 写了一封戏后笺`);
  },
  paint(){
    const box=$('#flNoteList'), a=Notes.all(), f=DB.get('noteFilter','all');
    const chars=Array.from(new Set(a.map(n=>n.char).filter(Boolean)));
    const tabs=$('#flNoteTabs'); tabs.innerHTML='';
    [{v:'all',t:'全部'}].concat(chars.map(c=>({v:c,t:c}))).forEach(o=>{
      const b=document.createElement('button'); b.className='fl-tab'+(f===o.v?' is-on':''); b.textContent=o.t;
      b.onclick=()=>{ DB.set('noteFilter',o.v); Notes.paint(); }; tabs.appendChild(b); });
    const list=f==='all'?a:a.filter(n=>n.char===f);
    $('#flNoteCount').textContent=list.length+' 封';
    if(!list.length){ box.innerHTML=`<div class="fl-empty" style="column-span:all"><b>还没有人写信</b><span>演完一幕之后，在那一段下面点「写戏后笺」，<br>他会用自己的口吻写下没说出口的部分。</span></div>`; return; }
    box.innerHTML=''; list.forEach(n=>box.appendChild(Notes.card(n)));
  },
  card(n){
    const b=document.createElement('button'); b.className='fl-note';
    b.innerHTML=`<div class="fl-note__who">${esc(n.char)} · 第 ${n.chapter} 幕</div>
      <div class="fl-note__q">${esc(n.quote||(n.body||'').slice(0,50)||'（这封笺是空的）')}</div>
      <span class="fl-note__mood">${esc(n.mood)}${n.favor?` · 好感 ${n.favor>0?'+':''}${n.favor}`:''}</span>
      <div class="fl-note__d">${esc(n.scriptTitle)} · ${when(n.at)}</div>`;
    b.onclick=()=>Notes.detail(n.id); return b;
  },
  detail(id){
    const n=Notes.all().find(x=>x.id===id); if(!n) return;
    Router.go('note');
    $('#flNoteDetail').innerHTML=`
      <div class="fl-letter__hd">
        <div class="fl-letter__who">${esc(n.char)}</div>
        <div class="fl-letter__sub">${esc(n.scriptTitle)} · 第 ${n.chapter} 幕 · ${esc(n.mood)}</div>
      </div>
      <div class="fl-letter__bd">${esc(n.body)}</div>
      ${n.quote?`<div class="fl-letter__q">${esc(n.quote)}</div>`:''}
      ${n.whisper?`<div class="fl-letter__whisper"><b>没敢说出口的那句</b>${esc(n.whisper)}</div>`:''}
      <div class="fl-letter__delta">
        <i class="fl-tagline">好感 ${n.favor>0?'+':''}${n.favor}</i>
        <i class="fl-tagline">${when(n.at)}</i>
      </div>
      <div class="fl-letter__seal">${esc((n.char||'岚')[0])}<br>缄</div>
      <div style="display:flex;gap:10px;margin-top:22px">
        <button class="fl-ghost" style="flex:1" id="flNoteBack">回到那场戏</button>
        <button class="fl-ghost" style="flex:0 0 88px" id="flNoteDel">删除</button>
      </div>`;
    $('#flNoteBack').onclick=()=>Reader.open(n.scriptId);
    $('#flNoteDel').onclick=()=>confirmBox('删除这封笺','删掉之后就没有了，确定吗','删掉',()=>{
      DB.set('notes',Notes.all().filter(x=>x.id!==id)); Router.go('notes'); Notes.paint(); });
    $('#flNoteShare').onclick=()=>Toast.ok('长按页面可保存截图');
  }
};

/* ───────── 12. 群像剧场（付费） ───────── */
const TROPES=['双向暗恋','久别重逢','先婚后爱','宿敌变盟友','救赎','错过与重逢','暗恋成真','互相隐瞒','年下','兄妹式共犯'];
const Ens={
  price(){ return {base:68, act:12, tryrun:38}; },
  all(){ return DB.get('ens',[]); },
  save(e){ const a=Ens.all(); const i=a.findIndex(x=>x.id===e.id); if(i<0) a.unshift(e); else a[i]=e; DB.set('ens',a); },
  paintHome(){
    const box=$('#flEnsList'), a=Ens.all();
    if(!a.length){ box.innerHTML=`<div class="fl-empty"><b>台上还空着</b><span>给一个主题，这里会长出四五个陌生人，<br>和他们没说完的话。</span><button class="fl-solid" data-go="ensembleForge">开一台</button></div>`; return; }
    box.innerHTML=''; a.forEach(e=>box.appendChild(Ens.card(e)));
  },
  card(e){
    const d=document.createElement('button'); d.className='fl-ens';
    d.innerHTML=`<div class="fl-ens__top">${e.paid?'':'<i class="fl-lock">未解锁</i>'}
        <div style="font-family:var(--fl-f-util);font-size:9px;letter-spacing:.24em;color:var(--fl-ink-3)">ENSEMBLE</div>
        <div class="fl-ens__t">${esc(e.title)}</div><div class="fl-ens__th">${esc(e.theme)}</div></div>
      <div class="fl-ens__bd"><div class="fl-ens__cast">${(e.cast||[]).slice(0,5).map(c=>`<i class="fl-ens__av">${esc(c.name[0]||'')}</i>`).join('')}</div>
        <div class="fl-ens__ft"><i class="fl-tag-pink">${e.acts.length}/${e.plan} 幕</i>
        <i class="fl-tag-pink">磕糖 ${e.sugar||0}</i><i class="fl-tag-pink">${when(e.updated)}</i></div></div>`;
    d.onclick=()=>Stage.open(e.id); return d;
  },
  paintForge(){
    const d=DB.get('ensDraft',{theme:'',era:'',tropes:[],count:4,heat:70,taboo:'',watcher:''});
    $('#flEnsTheme').value=d.theme; $('#flEnsTheme').oninput=e=>{d.theme=e.target.value;DB.set('ensDraft',d);};
    $('#flEnsEra').value=d.era; $('#flEnsEra').oninput=e=>{d.era=e.target.value;DB.set('ensDraft',d);};
    $('#flEnsTaboo').value=d.taboo; $('#flEnsTaboo').oninput=e=>{d.taboo=e.target.value;DB.set('ensDraft',d);};
    Chips($('#flEnsTropes'),TROPES,d.tropes,()=>DB.set('ensDraft',d));
    Seg($('#flEnsCount'),[{v:3,t:'3 人'},{v:4,t:'4 人'},{v:5,t:'5 人'},{v:6,t:'6 人'}],d.count,v=>{d.count=v;DB.set('ensDraft',d);Ens.paintPrice(d);});
    const sl=$('.fl-sl[data-k="ensHeat"]'); sl.querySelector('input').value=d.heat; sl.querySelector('b').textContent=d.heat;
    sl.querySelector('input').oninput=e=>{ d.heat=+e.target.value; sl.querySelector('b').textContent=d.heat; DB.set('ensDraft',d); };
    const cs=Adapter.charsSync();
    Select($('#flEnsWatcher'),[{v:'',t:'不带人看',d:'纯粹自己看戏'}].concat(cs.map(c=>({v:c.id,t:c.name,d:(c.persona||'').slice(0,20)}))),d.watcher,v=>{d.watcher=v;DB.set('ensDraft',d);},'观戏人');
    Ens.paintPrice(d);
    $('#flEnsCreate').onclick=()=>Ens.create(d);
  },
  paintPrice(d){
    const lv=Rank.levelOf(Rank.stat().xp).level, dis=Rank.discount(lv), p=Ens.price();
    const total=Math.round((p.base+p.act*(d.count>=5?2:0))*dis);
    $('#flEnsPrice').innerHTML=`<div class="fl-price__row"><span>开台费（含前 3 幕）</span><span>${p.base} 岚露</span></div>
      ${d.count>=5?`<div class="fl-price__row"><span>群像加演（5 人以上）</span><span>${p.act*2} 岚露</span></div>`:''}
      <div class="fl-price__row"><span>${Rank.name(lv)} 折扣</span><span>${dis===1?'—':Math.round(dis*100)/10+' 折'}</span></div>
      <div class="fl-price__row" style="border-top:1px solid rgba(185,113,138,.24);margin-top:8px;padding-top:8px"><span>合计</span><b>${total}</b></div>
      <p style="font-size:10.5px;color:var(--fl-ink-3);margin-top:8px">后续每解锁一幕 ${Math.round(p.act*dis)} 岚露；解锁全剧后可用你自己的 user + char 试跑一遍（${Math.round(p.tryrun*dis)} 岚露）。</p>`;
    return total;
  },
  async create(d){
    if(!d.theme.trim()){ Toast.warn('先写一句主题，哪怕只有一个画面'); return; }
    const total=Ens.paintPrice(d);
    Pay.charge(total,'开台 · 群像剧场',async()=>{
      Loading.show('正在把人一个个请上台…');
      const cast=await Ens.genCast(d);
      const e={ id:uid('en'), title:d.theme.slice(0,14), theme:d.theme, era:d.era, tropes:d.tropes.slice(),
        count:d.count, heat:d.heat, taboo:d.taboo, watcherId:d.watcher, cast, acts:[], plan:9, paid:true,
        sugar:0, hearts:{}, comments:[], created:Date.now(), updated:Date.now() };
      Ens.save(e); Loading.hide(); Rank.addXP(30,'开群像'); Stage.open(e.id); Stage.nextAct();
    });
  },
  async genCast(d){
    const sys=`你是原创群像故事的选角师。只创造**原创人物**，绝不使用任何已有作品的角色、专有名词或设定。
主题：${d.theme}
年代场域：${d.era||'自拟'}
糖点偏好：${d.tropes.join('、')||'自拟'}
情感浓度：${d.heat}/100
雷点（绝对不写）：${d.taboo||'无'}
请设计 ${d.count} 个有血有肉的人：每个人都要有一个具体的执念、一处软肋、一件没说出口的事。
严格按行输出，不要多余文字：
@人物|姓名|年龄|身份|性格（20字内）|没说出口的那件事
@关系|甲—乙|他们之间发生过什么（25字内）
关系至少 ${Math.max(2,d.count-1)} 条。`;
    let raw=''; try{ raw=await AI.gen([{role:'system',content:sys},{role:'user',content:'开始'}],{max:800,label:'群像卡'}); }catch(e){}
    if(!raw) raw=Offline.cast(d.theme);
    const cast=[],rel=[];
    raw.split(/\n/).forEach(l=>{ const p=l.split('|').map(s=>s.trim());
      if(p[0]==='@人物'&&p[1]) cast.push({name:p[1],age:p[2]||'',role:p[3]||'',trait:p[4]||'',secret:p[5]||''});
      if(p[0]==='@关系'&&p[1]) rel.push({pair:p[1],text:p[2]||''}); });
    cast.rel=rel; return cast.length?cast:[{name:'无名',age:'',role:'',trait:'',secret:''}];
  }
};
const Stage={
  e:null, busy:false, sort:'hot',
  open(id){ const e=Ens.all().find(x=>x.id===id); if(!e){ Toast.warn('这台戏找不到了'); return; }
    Stage.e=e; Router.go('stage'); Stage.paint(); },
  paint(){
    const e=Stage.e;
    $('#flStageTitle').textContent=e.title;
    $('#flStageSub').textContent=`${e.acts.length}/${e.plan} 幕 · 磕糖 ${e.sugar||0} · ${e.comments.length} 条评论`;
    $('#flCast').innerHTML=(e.cast||[]).map(c=>`<div class="fl-cst"><i class="fl-cst__av">${esc(c.name[0]||'')}</i><div><b>${esc(c.name)}</b><span>${esc(c.role||'')}</span></div></div>`).join('')
      + ((e.cast&&e.cast.rel)?e.cast.rel.map(r=>`<div class="fl-cst" style="background:rgba(255,255,255,.7)"><div><b>${esc(r.pair)}</b><span>${esc(r.text)}</span></div></div>`).join(''):'');
    const box=$('#flActs'); box.innerHTML='';
    e.acts.forEach((a,i)=>box.appendChild(Stage.actEl(a,i)));
    Stage.paintOps(); Stage.paintCmts();
  },
  actEl(a,i){
    const e=Stage.e, d=document.createElement('div'); d.className='fl-actblk';
    const p=parseScript(a.text);
    const hd=document.createElement('div'); hd.className='fl-actblk__hd';
    const t=p.blocks.find(b=>b.t==='act');
    hd.innerHTML=`<b>${esc(t?t.x:'第 '+(i+1)+' 幕')}</b><i></i>`; d.appendChild(hd);
    d.appendChild(renderBlocks(p.blocks.filter(b=>b.t!=='act'),p.notes,{}));
    if(a.watch){ const w=document.createElement('div'); w.className='fl-watch';
      w.innerHTML=`<b>${esc(a.watchName||'观戏人')} 的锐评</b><p>${esc(a.watch)}</p>`; d.appendChild(w); }
    const tools=document.createElement('div'); tools.className='fl-actblk__tools';
    const on=e.hearts&&e.hearts[i];
    tools.innerHTML=`<button class="fl-heart${on?' is-on':''}" data-h="${i}"><svg viewBox="0 0 24 24"><path d="M12 20s-7-4.6-9-8.4C1.2 8 3.3 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.7 0 5.8 3.5 4 7.1C19 15.4 12 20 12 20z"/></svg>心动 ${a.hearts||0}</button>
      <button class="fl-heart" data-c="${i}">就这段聊聊</button>`;
    tools.onclick=ev=>{ const h=ev.target.closest('[data-h]'); if(h){ Stage.heart(+h.dataset.h); }
      const c=ev.target.closest('[data-c]'); if(c){ $('#flCmtIn').focus(); $('#flCmtIn').dataset.act=c.dataset.c; $('#flCmtIn').placeholder=`就第 ${+c.dataset.c+1} 幕说点什么…`; } };
    d.appendChild(tools);
    return d;
  },
  heart(i){ const e=Stage.e; e.hearts=e.hearts||{};
    if(e.hearts[i]){ delete e.hearts[i]; e.acts[i].hearts=Math.max(0,(e.acts[i].hearts||1)-1); }
    else { e.hearts[i]=1; e.acts[i].hearts=(e.acts[i].hearts||0)+1; Rank.addXP(1,'心动'); }
    Ens.save(e); Stage.paint(); },
  paintOps(){
    const e=Stage.e, box=$('#flStageOps'); box.innerHTML='';
    const lv=Rank.levelOf(Rank.stat().xp).level, dis=Rank.discount(lv), p=Ens.price();
    if(e.acts.length===0){ const b=document.createElement('button'); b.className='fl-nextact'; b.textContent='开幕'; b.onclick=()=>Stage.nextAct(); box.appendChild(b); return; }
    if(e.acts.length<e.plan){
      const free=e.acts.length<3;
      const cost=Math.round(p.act*dis);
      const b=document.createElement('button'); b.className='fl-nextact';
      b.textContent=free?`续演第 ${e.acts.length+1} 幕`:`解锁第 ${e.acts.length+1} 幕 · ${cost} 岚露`;
      b.onclick=()=>free?Stage.nextAct():Pay.charge(cost,`群像 · 第 ${e.acts.length+1} 幕`,()=>Stage.nextAct());
      box.appendChild(b);
    } else {
      const b=document.createElement('button'); b.className='fl-nextact'; b.textContent='全剧已终 · 用我的人设试跑一遍 · '+Math.round(p.tryrun*dis)+' 岚露';
      b.onclick=()=>Stage.tryRun(Math.round(p.tryrun*dis)); box.appendChild(b);
    }
    const s=document.createElement('button'); s.className='fl-heart'; s.style.justifySelf='center';
    s.innerHTML=`投喂一颗糖 · 2 岚露（已收 ${e.sugar||0}）`;
    s.onclick=()=>Pay.charge(2,'投喂糖',()=>{ e.sugar=(e.sugar||0)+1; Ens.save(e); Stage.paint(); Rank.addXP(3,'投喂'); Toast.ok('糖已经递上去了'); });
    box.appendChild(s);
  },
  async nextAct(){
    const e=Stage.e; if(Stage.busy) return; Stage.busy=true;
    Loading.show('幕布正在拉开…');
    const castTxt=(e.cast||[]).map(c=>`${c.name}（${c.age}，${c.role}）：${c.trait}；没说出口的事：${c.secret}`).join('\n');
    const relTxt=(e.cast&&e.cast.rel||[]).map(r=>`${r.pair}：${r.text}`).join('\n');
    const prev=e.acts.slice(-2).map(a=>a.text.replace(/^@[^|]*\|/gm,'')).join('\n').slice(0,1800);
    const sys=`你在写一部**原创**群像言情连载，读者是来磕糖的。绝不使用任何已有作品的角色或设定。
主题：${e.theme}｜年代场域：${e.era||'自拟'}｜糖点：${(e.tropes||[]).join('、')||'自拟'}｜情感浓度：${e.heat}/100
绝对禁止：${e.taboo||'无'}
人物：
${castTxt}
关系：
${relTxt||'（自行建立）'}
写法要求：人物要有血有肉，每个人的选择都能从他的执念与软肋推出来；给足眼神、停顿、小动作这种可磕的细节；一幕只推进一个转折，不要收尾、不要总结。本幕 500-700 字。
${PROTOCOL}`;
    try{
      const raw=await AI.gen([{role:'system',content:sys},{role:'user',content: prev?('前情：\n'+prev+'\n\n请写第 '+(e.acts.length+1)+' 幕。'):'请写第一幕。'}],{max:1300,label:'群像幕'});
      const act={text:String(raw).replace(/```[a-z]*\n?/g,'').trim(),hearts:0,at:Date.now()};
      if(e.watcherId){
        const c=Adapter.charsSync().find(x=>x.id===e.watcherId);
        if(c){ try{ const w=await AI.gen([{role:'system',content:`你是「${c.name}」。角色卡：\n${charCard(c)}\n你正在陪人看一部与你无关的群像剧，刚看完一幕。用你自己的口吻说 1-2 句锐评，可以毒可以软，但必须像你会说的话。不要复述剧情，不要用markdown。`},
            {role:'user',content:act.text.replace(/^@[^|]*\|/gm,'').slice(0,900)}],{max:180,label:'锐评'});
          act.watch=String(w).trim(); act.watchName=c.name; }catch(err){} }
      }
      e.acts.push(act); e.updated=Date.now(); Ens.save(e);
      Loading.hide(); Stage.paint();
      const last=$('#flActs').lastElementChild;
      if(last){ const kids=Array.from(last.querySelectorAll('.fl-blk')); kids.forEach(k=>k.style.visibility='hidden');
        for(const k of kids){ k.style.visibility='visible'; k.scrollIntoView({block:'center',behavior:'smooth'}); await sleep(150); } }
      Rank.addXP(8,'看幕'); const s=Rank.stat(); s.acts++; DB.set('stat',s);
      if(Math.random()<.85) setTimeout(()=>Stage.ghostComment(),1400);
    }catch(err){ Loading.hide(); Toast.warn('这一幕没能拉开，再试一次'); }
    Stage.busy=false;
  },
  tryRun(cost){
    const cs=Adapter.charsSync(), us=Adapter.usersSync();
    Pay.charge(cost,'群像 · 试跑',()=>{
      const st=Studio.blank();
      st.title=Stage.e.title+'（试跑）';
      st.charId=(cs[0]||{}).id||''; st.userId=(us[0]||{}).id||'';
      st.era=Stage.e.era; st.wish='把这部群像里的关系，换成我和他来走一遍';
      st.rule='沿用群像剧目的场域与人物关系，但主角换成本场的 char 与 user';
      st.now=Stage.e.theme; st.genres=['现代']; st.mods=['更多内心戏'];
      Studio.st=st; Studio.step=0; Studio.paint(); Router.go('studio');
      Toast.ok('已带入这台戏的设定，挑好你的角色就能跑');
    });
  },
  paintCmts(){
    const e=Stage.e, box=$('#flCmts');
    let list=e.comments.slice();
    list.sort((a,b)=> Stage.sort==='hot' ? (b.like||0)-(a.like||0) : b.at-a.at);
    box.innerHTML=`<div class="fl-cmts__hd"><h3>戏台下</h3>
      <div class="fl-sort"><button data-s="hot" class="${Stage.sort==='hot'?'is-on':''}">最热</button><button data-s="new" class="${Stage.sort==='new'?'is-on':''}">最新</button></div></div>`;
    if(!list.length){ box.insertAdjacentHTML('beforeend','<p style="text-align:center;font-size:12px;color:var(--fl-ink-3);padding:20px">还没有人说话。第一句总是最难开口的。</p>'); }
    list.forEach(c=>{
      const lv=c.level||1;
      const d=document.createElement('div'); d.className='fl-cmt'+(c.isChar?' fl-cmt--char':'');
      d.innerHTML=`<i class="fl-cmt__av">${esc((c.name||'我')[0])}</i>
        <div class="fl-cmt__bd"><div class="fl-cmt__nm">${esc(c.name)}
          ${c.isChar?'<i class="fl-tag-pink">观戏人</i>':`<i class="fl-lvtag">LV.${lv} ${esc(Rank.name(lv))}</i>`}
          <span class="fl-cmt__fl">${c.act!=null?`第 ${c.act+1} 幕`:''}</span></div>
        <div class="fl-cmt__tx">${esc(c.text)}</div>
        <div class="fl-cmt__ft"><button data-l="${c.id}" class="${c.liked?'is-on':''}">心动 ${c.like||0}</button><span>${when(c.at)}</span></div></div>`;
      box.appendChild(d);
    });
    box.querySelector('.fl-sort').onclick=e2=>{ const b=e2.target.closest('[data-s]'); if(b){ Stage.sort=b.dataset.s; Stage.paintCmts(); } };
    box.onclick=ev=>{ const b=ev.target.closest('[data-l]'); if(!b) return;
      const c=Stage.e.comments.find(x=>x.id===b.dataset.l); if(!c) return;
      c.liked=!c.liked; c.like=(c.like||0)+(c.liked?1:-1); Ens.save(Stage.e); Stage.paintCmts(); };
  },
  send(){
    const inp=$('#flCmtIn'), t=inp.value.trim(); if(!t) return;
    const e=Stage.e, lv=Rank.levelOf(Rank.stat().xp).level;
    const me=(Adapter.usersSync()[0]||{}).name||'我';
    e.comments.unshift({id:uid('cm'),name:me,text:t,at:Date.now(),like:0,level:lv,act:inp.dataset.act?+inp.dataset.act:null});
    inp.value=''; delete inp.dataset.act; inp.placeholder='说点什么…';
    Ens.save(e); Stage.paintCmts(); Rank.addXP(4,'评论');
    const s=Rank.stat(); s.cmts++; DB.set('stat',s);
    if(e.watcherId) setTimeout(()=>Stage.charReply(t),900);
  },
  async charReply(t){
    const e=Stage.e, c=(await Adapter.chars()).find(x=>x.id===e.watcherId); if(!c) return;
    try{
      const r=await AI.gen([{role:'system',content:`你是「${c.name}」。角色卡：\n${charCard(c)}\n你和对方一起在看一部群像剧，对方刚在评论区说了一句话。用你的口吻回一句，不超过 40 字，像你会说的话。不要用markdown。`},
        {role:'user',content:t}],{max:120,label:'评论'});
      e.comments.unshift({id:uid('cm'),name:c.name,text:String(r).trim(),at:Date.now(),like:0,isChar:true});
      Ens.save(e); Stage.paintCmts();
    }catch(err){}
  },
  async ghostComment(){
    const e=Stage.e; const names=['雾里看戏的人','三点半还没睡','旧碟收藏家','只磕不写','阿棠的后援'];
    try{ const r=await AI.gen([{role:'system',content:'你是一个普通读者，在一部群像连载下面留一条 20-40 字的评论，口语、有情绪、不总结剧情。只输出评论本身。'},
      {role:'user',content:(e.acts.slice(-1)[0]||{}).text||''}],{max:100,label:'评论'});
      e.comments.push({id:uid('cm'),name:pick(names),text:String(r).trim(),at:Date.now()-Math.random()*6e5,like:Math.floor(Math.random()*9),level:Math.ceil(Math.random()*28)});
      Ens.save(e); if(Router.now==='stage') Stage.paintCmts();
    }catch(err){}
  },
  menu(){
    Sheet.open('剧目',b=>{ const e=Stage.e;
      b.innerHTML=`<div class="fl-optlist">
        <button class="fl-opt" data-m="cast"><i class="fl-opt__dot"></i><span><b>人物与关系</b><span>${(e.cast||[]).length} 人</span></span></button>
        <button class="fl-opt" data-m="theme"><i class="fl-opt__dot"></i><span><b>剧场阅读样式</b><span>与织叙阅读器分开保存</span></span></button>
        <button class="fl-opt" data-m="del"><i class="fl-opt__dot"></i><span><b>删除剧目</b><span>已付费用不退回</span></span></button></div>`;
      b.onclick=ev=>{ const t=ev.target.closest('[data-m]'); if(!t) return; Sheet.close();
        if(t.dataset.m==='cast') Modal.open({title:'人物',body:(e.cast||[]).map(c=>`<div style="padding:10px 0;border-bottom:1px solid var(--fl-line-s)"><b>${esc(c.name)}</b> <span style="font-size:11px;color:var(--fl-ink-3)">${esc(c.age)} · ${esc(c.role)}</span><br>${esc(c.trait)}<br><span style="font-size:11.5px;color:var(--fl-sakura-d)">没说出口：${esc(c.secret)}</span></div>`).join(''),actions:[{t:'好',p:1}]});
        if(t.dataset.m==='theme') Boudoir.readerSheet(null,true);
        if(t.dataset.m==='del') confirmBox('删除剧目','删掉之后评论与磕糖记录都会消失，确定吗','删掉',()=>{
          DB.set('ens',Ens.all().filter(x=>x.id!==e.id)); Router.go('ensemble'); Ens.paintHome(); });
      };
    });
  }
};

/* ───────── 13. 妆匣：主题 / 背景 / 自写 CSS / 名录 ───────── */
const PRESET_THEMES=[
  {id:'th_chuwu',name:'初雾',scope:'全局',vars:{'--fl-mist':'#F4F9F5','--fl-moss':'#5F9077','--fl-moss-d':'#3F6B54','--fl-celadon':'#A9CDB7','--fl-dlg-bg':'linear-gradient(180deg,#FFFFFF,#F2F9F4)','--fl-em':'#2C7A5B'},pv:'linear-gradient(140deg,#FFFFFF,#DFEFE6)'},
  {id:'th_qingci',name:'青瓷',scope:'全局',vars:{'--fl-mist':'#EFF6F3','--fl-moss':'#4E8C84','--fl-moss-d':'#2F675F','--fl-celadon':'#9BC9C2','--fl-dlg-bg':'linear-gradient(180deg,#FFFFFF,#EEF7F5)','--fl-em':'#2A7A70'},pv:'linear-gradient(140deg,#FFFFFF,#D5E9E5)'},
  {id:'th_yeyu',name:'夜雨',scope:'全局',vars:{'--fl-mist':'#22322B','--fl-mist2':'#1A2721','--fl-paper':'#26362E','--fl-ink':'#E6F1EA','--fl-ink-2':'#B9CFC2','--fl-ink-3':'#89A395','--fl-moss':'#8FC3AB','--fl-moss-d':'#BFE0D0','--fl-line':'rgba(160,205,183,.24)','--fl-dlg-bg':'linear-gradient(180deg,#2C3E35,#243129)','--fl-ts':'0 1px 2px rgba(0,0,0,.6), 0 0 14px rgba(0,0,0,.35)','--fl-em':'#9FDCC0','--fl-jade-1':'38,54,46','--fl-jade-2':'26,39,31','--fl-jade-ink':'8,14,11','--fl-jade-a':'.92'},pv:'linear-gradient(140deg,#2E4239,#16211C)'},
  {id:'th_zaoying',name:'早樱',scope:'群像',vars:{'--fl-sakura':'#E9B4C4','--fl-sakura-d':'#B36F89','--fl-em':'#B36F89'},pv:'linear-gradient(140deg,#FFFFFF,#F2D9E1)'},
  {id:'th_liuguang',name:'琉光',scope:'全局',vars:{'--fl-mist':'#F6F8F4','--fl-moss':'#6A8F63','--fl-moss-d':'#4A6B45','--fl-celadon':'#C3D4A8','--fl-gilt':'#C6AC72','--fl-em':'#7A8F4A'},pv:'linear-gradient(140deg,#FFFFFF,#E4EAD2)'},
  {id:'th_huanjing',name:'幻境琉璃',scope:'全局 · Lv46 解锁',lock:46,vars:{'--fl-mist':'#F3F0F9','--fl-moss':'#7E6BB5','--fl-moss-d':'#5A4A8C','--fl-celadon':'#BCAFE0','--fl-dlg-bg':'linear-gradient(180deg,#FFFFFF,#F2EEFB)','--fl-em':'#6A57A8'},pv:'linear-gradient(140deg,#FFFFFF,#DCD2F0)'}
];
const MANIFEST=[
 {g:'页面骨架',items:[
  ['.fl-page[data-page="hall"]','大厅整页。把 data-page 换成 studio / reader / stage / notes 等即可指定任意页'],
  ['.fl-page__bg','每页背景图层（上传的照片贴在这里）'],
  ['.fl-topbar','各页顶栏'],['.fl-dock','底部花坞导航'],
  ['.status-bar','状态栏（与 index / 露匣 / 妆匣等全局同一套结构，改这里会处处一起变）'],
  ['.fl-crown','状态栏下方的华彩顶饰过渡层']]},
 {g:'织叙阅读器',items:[
  ['.fl-thread','正文容器'],['.fl-blk--scene','场景描写行'],['.fl-blk--narr','旁白行'],
  ['.fl-blk--dlg','对白气泡'],['.fl-blk--dlg.is-user','我方对白气泡'],['.fl-blk__nm','说话人署名'],
  ['.fl-blk__say','台词正文（引号由 CSS 生成）'],['.fl-blk--think','心理独白'],['.fl-blk--act','动作行'],
  ['.fl-blk--sys','系统提示'],['.fl-blk--act-title','幕标题'],['.fl-em','重点标记文字'],
  ['.fl-note-chip','可点击的词条'],['.fl-tts','朗读按钮'],['.fl-choice','剧情选项卡片']]},
 {g:'群像剧场（与织叙分开）',items:[
  ['.fl-actblk','一幕的容器'],['.fl-actblk .fl-blk--dlg','群像里的对白（独立于织叙）'],
  ['.fl-watch','观戏人锐评块'],['.fl-heart','心动 / 磕糖按钮'],['.fl-cmt','一条评论'],['.fl-lvtag','评论区阶位签']]},
 {g:'卡片与存档',items:[
  ['.fl-arch','织叙存档卡（窗形）'],['.fl-ens','群像剧目卡（幕布形）'],
  ['.fl-note','戏后笺卡片'],['.fl-letter','戏后笺详情信笺'],['.fl-letter__seal','信笺印章'],
  ['.fl-badge','阶位徽记'],['.fl-card','通用卡片']]},
 {g:'可覆盖变量',items:[
  ['--fl-mist / --fl-mist2','页底两层色'],['--fl-paper','卡面色'],['--fl-moss / --fl-moss-d','主色与深主色'],
  ['--fl-celadon','点缀色'],['--fl-ink / --fl-ink-2 / --fl-ink-3','正文 / 次级 / 弱化文字'],
  ['--fl-sakura / --fl-sakura-d','群像专用色'],['--fl-ts','全局文字阴影（改深浅背景时调这个）'],
  ['--fl-dlg-bg','对白气泡背景'],['--fl-em','重点文字色'],['--fl-read-size / --fl-read-lh','正文字号与行距'],
  ['--fl-r-card','卡片圆角'],['--fl-bg-veil','背景照片上的雾罩浓度（0-1）'],
  ['--fl-jade-1 / --fl-jade-2','玉牌主色/次色（状态栏·顶栏·坞共用，rgb 三数字如 26,39,31）——换了深色背景照片但用的还是默认雾白主题时，在此处手动改深，三处会一起变'],
  ['--fl-jade-ink','玉牌暗面阴影色（rgb 三数字，取当前 --fl-ink 的近似值即可）'],
  ['--fl-jade-a','玉牌不透明度（0-1）']]}
];
const Boudoir={
  tab:'theme',
  paint(){
    const tabs=$('#flBoudoirTabs'); tabs.innerHTML='';
    [['theme','主题'],['bg','背景'],['css','自写 CSS'],['manifest','名录']].forEach(([v,t])=>{
      const b=document.createElement('button'); b.className='fl-tab'+(Boudoir.tab===v?' is-on':''); b.textContent=t;
      b.onclick=()=>{ Boudoir.tab=v; Boudoir.paint(); }; tabs.appendChild(b); });
    $$('.fl-bd').forEach(d=>d.hidden=d.dataset.bd!==Boudoir.tab);
    if(Boudoir.tab==='theme') Boudoir.paintThemes();
    if(Boudoir.tab==='bg') Boudoir.paintBg();
    if(Boudoir.tab==='css') Boudoir.paintCss();
    if(Boudoir.tab==='manifest') Boudoir.paintManifest();
  },
  themes(){ return PRESET_THEMES.concat(DB.get('themes',[])); },
  paintThemes(){
    const box=$('#flThemeList'), cur=DB.get('theme','th_chuwu'), lv=Rank.levelOf(Rank.stat().xp).level;
    box.innerHTML='';
    Boudoir.themes().forEach(t=>{
      const locked=t.lock&&lv<t.lock;
      const d=document.createElement('button'); d.className='fl-th'+(cur===t.id?' is-on':'');
      d.style.background='linear-gradient(160deg,rgba(255,255,255,.96),rgba(240,248,243,.9))';
      d.innerHTML=`<div class="fl-th__pv" style="background:${t.pv||'linear-gradient(140deg,#fff,#eee)'}"><i></i><i></i><i></i></div>
        <div class="fl-th__nm">${esc(t.name)}${locked?' · 未解锁':''}</div><div class="fl-th__id">${esc(t.id)} · ${esc(t.scope||'全局')}</div>
        <div class="fl-th__ft">${t.custom?'<i class="fl-mini">我的</i>':''}${locked?`<i class="fl-mini fl-mini--warn">Lv${t.lock}</i>`:''}</div>`;
      d.onclick=()=>{ if(locked){ Toast.warn(`到 Lv.${t.lock} 才能用这套`); return; }
        DB.set('theme',t.id); Boudoir.applyTheme(); Boudoir.paintThemes(); Toast.ok('换好了'); };
      box.appendChild(d);
    });
  },
  applyTheme(){
    const id=DB.get('theme','th_chuwu'), t=Boudoir.themes().find(x=>x.id===id);
    const r=document.documentElement; r.removeAttribute('style');
    if(t&&t.vars) Object.entries(t.vars).forEach(([k,v])=>r.style.setProperty(k,v));
    document.body.dataset.themePage=id;
    r.style.setProperty('--fl-bg-veil',DB.get('bgVeil',1));
    Boudoir.applyCss();
  },
  newTheme(){
    const base=Boudoir.themes().find(x=>x.id===DB.get('theme','th_chuwu'))||PRESET_THEMES[0];
    Modal.open({title:'新建主题',body:`<label class="fl-lb">名字<em>必须填，换主题时要靠它认</em></label><input class="fl-in" id="flThN" placeholder="例：雨夜阑珊">
      <label class="fl-lb">标识 id<em>写 CSS 时用 body[data-theme-page="这个id"] 精确命中</em></label><input class="fl-in" id="flThId" value="th_${Math.random().toString(36).slice(2,7)}">
      <label class="fl-lb">主色</label><input class="fl-in" id="flThC1" value="${base.vars['--fl-moss']||'#5F9077'}">
      <label class="fl-lb">深主色</label><input class="fl-in" id="flThC2" value="${base.vars['--fl-moss-d']||'#3F6B54'}">
      <label class="fl-lb">页底色</label><input class="fl-in" id="flThC3" value="${base.vars['--fl-mist']||'#F4F9F5'}">
      <label class="fl-lb">正文色</label><input class="fl-in" id="flThC4" value="${base.vars['--fl-ink']||'#1E3227'}">`,
      actions:[{t:'取消'},{t:'建好',p:1,fn(){
        const n=$('#flThN').value.trim(); if(!n){ Toast.warn('先给它起个名字'); return false; }
        const t={id:$('#flThId').value.trim()||uid('th'),name:n,scope:'全局',custom:true,
          pv:`linear-gradient(140deg,${$('#flThC3').value},${$('#flThC1').value})`,
          vars:{'--fl-moss':$('#flThC1').value,'--fl-moss-d':$('#flThC2').value,'--fl-mist':$('#flThC3').value,'--fl-ink':$('#flThC4').value}};
        const a=DB.get('themes',[]); a.push(t); DB.set('themes',a); DB.set('theme',t.id);
        Boudoir.applyTheme(); Boudoir.paint(); Toast.ok('已建好并启用');
      }}]});
  },
  paintBg(){
    const box=$('#flBgList');
    const pages=[['hall','大厅'],['studio','织叙设定'],['styles','文风阁'],['reader','织叙阅读器'],['archives','织叙存档'],
      ['notes','戏后笺'],['note','笺详情'],['ensemble','群像入口'],['ensembleForge','群像开台'],['stage','群像阅读器'],
      ['ensembleArchives','我的剧目'],['boudoir','妆匣'],['wallet','露匣'],['ledger','流水'],['ranks','阶位'],['guide','说明']];
    box.innerHTML=`<div class="fl-hint">每一页各存各的背景。切页时下面那一页会被完全盖住，不会透出来。若字看不清，把「雾罩」调浓一点。</div>`;
    const veil=DB.get('bgVeil',1);
    const sl=document.createElement('div'); sl.className='fl-sl fl-sl--solo';
    sl.innerHTML=`<span>雾罩</span><input type="range" min="0" max="100" value="${Math.round(veil*100)}"><b>${Math.round(veil*100)}</b>`;
    sl.querySelector('input').oninput=e=>{ const v=+e.target.value; sl.querySelector('b').textContent=v;
      DB.set('bgVeil',v/100); document.documentElement.style.setProperty('--fl-bg-veil',v/100); };
    box.appendChild(sl);
    pages.forEach(([id,name])=>{
      const d=document.createElement('div'); d.className='fl-bgi';
      d.innerHTML=`<div class="fl-bgi__pv" data-pv="${id}"></div><div class="fl-bgi__t"><b>${name}</b><span>data-page="${id}"</span>
        <div class="fl-bgi__ft"><button class="fl-mini fl-mini--go" data-up="${id}">上传照片</button><button class="fl-mini" data-clr="${id}">清除</button></div></div>`;
      box.appendChild(d);
      IMG.get('bg_'+id).then(v=>{ if(v) d.querySelector('[data-pv]').style.backgroundImage=`url(${v})`; });
    });
    box.onclick=e=>{
      const up=e.target.closest('[data-up]'); const clr=e.target.closest('[data-clr]');
      if(up) Boudoir.upload(up.dataset.up);
      if(clr){ IMG.del('bg_'+clr.dataset.clr).then(()=>{ Boudoir.applyBg(clr.dataset.clr); Boudoir.paintBg(); Toast.ok('已清除'); }); }
    };
  },
  upload(page){
    const i=document.createElement('input'); i.type='file'; i.accept='image/*';
    i.onchange=()=>{ const f=i.files[0]; if(!f) return;
      const r=new FileReader(); r.onload=()=>{
        const img=new Image(); img.onload=async()=>{
          const max=1400, sc=Math.min(1,max/Math.max(img.width,img.height));
          const cv=document.createElement('canvas'); cv.width=img.width*sc; cv.height=img.height*sc;
          cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
          const data=cv.toDataURL('image/jpeg',.82);
          await IMG.set('bg_'+page,data); Boudoir.applyBg(page); Boudoir.paintBg(); Toast.ok('背景换好了');
        }; img.src=r.result; };
      r.readAsDataURL(f); };
    i.click();
  },
  async applyBg(page){
    const el=$(`.fl-page[data-page="${page}"]`); if(!el) return;
    const bg=el.querySelector('.fl-page__bg'); const v=await IMG.get('bg_'+page);
    if(v){ bg.style.backgroundImage=`url(${v})`; el.dataset.hasBg='1'; }
    else { bg.style.backgroundImage=''; el.removeAttribute('data-has-bg'); }
  },
  async applyAllBg(){ for(const p of $$('.fl-page')) await Boudoir.applyBg(p.dataset.page);
    document.documentElement.style.setProperty('--fl-bg-veil',DB.get('bgVeil',1)); },
  paintCss(){
    const box=$('#flCssPanel'), list=DB.get('cssList',[]);
    box.innerHTML=`<div class="fl-hint">写好的 CSS 必须起名字才能保存和切换。名字对不上就换不了——所以先起名，再写。可用的类名与变量见「名录」。</div>
      <label class="fl-lb">这段样式的名字</label><input class="fl-in" id="flCssName" placeholder="例：夜雨阅读器加宽版">
      <label class="fl-lb">CSS 正文</label><textarea class="fl-cssbox" id="flCssBody" spellcheck="false" placeholder=".fl-blk--dlg{ border-radius:8px }
.fl-page[data-page=&quot;reader&quot;]{ --fl-read-size:18px }"></textarea>
      <div style="display:flex;gap:10px;margin-top:12px"><button class="fl-solid" style="flex:1" id="flCssSave">保存这段</button>
      <button class="fl-ghost" style="flex:0 0 96px" id="flCssTry">试一下</button></div>
      <div id="flCssList" style="margin-top:18px;display:grid;gap:10px"></div>`;
    const lw=$('#flCssList');
    if(!list.length) lw.innerHTML='<p style="font-size:11.5px;color:var(--fl-ink-3);text-align:center;padding:14px">还没有保存过样式。</p>';
    list.forEach((c,i)=>{
      const d=document.createElement('div'); d.className='fl-bgi';
      d.innerHTML=`<div class="fl-bgi__t"><b>${esc(c.name)}</b><span>${c.on?'使用中':'未启用'} · ${c.css.length} 字符</span>
        <div class="fl-bgi__ft"><button class="fl-mini ${c.on?'':'fl-mini--go'}" data-t="${i}">${c.on?'停用':'启用'}</button>
        <button class="fl-mini" data-e="${i}">编辑</button><button class="fl-mini fl-mini--warn" data-d="${i}">删除</button></div></div>`;
      lw.appendChild(d);
    });
    lw.onclick=e=>{
      const t=e.target.closest('[data-t]'), ed=e.target.closest('[data-e]'), dl=e.target.closest('[data-d]');
      const a=DB.get('cssList',[]);
      if(t){ a[+t.dataset.t].on=!a[+t.dataset.t].on; DB.set('cssList',a); Boudoir.applyCss(); Boudoir.paintCss(); }
      if(ed){ $('#flCssName').value=a[+ed.dataset.e].name; $('#flCssBody').value=a[+ed.dataset.e].css; $('#flCssBody').scrollIntoView({behavior:'smooth'}); }
      if(dl){ a.splice(+dl.dataset.d,1); DB.set('cssList',a); Boudoir.applyCss(); Boudoir.paintCss(); }
    };
    $('#flCssTry').onclick=()=>{ Boudoir.injectRaw($('#flCssBody').value); Toast.ok('临时生效，刷新后消失'); };
    $('#flCssSave').onclick=()=>{
      const n=$('#flCssName').value.trim(), c=$('#flCssBody').value;
      if(!n){ Toast.warn('先起个名字，不然之后找不到它'); return; }
      if(/<\s*script/i.test(c)){ Toast.warn('样式里不能写脚本'); return; }
      const a=DB.get('cssList',[]); const i=a.findIndex(x=>x.name===n);
      if(i>=0) a[i].css=c; else a.push({name:n,css:c,on:true});
      DB.set('cssList',a); Boudoir.applyCss(); Boudoir.paintCss(); Toast.ok('已保存并启用');
    };
  },
  injectRaw(css){ let s=$('#flUserCss'); if(!s){ s=document.createElement('style'); s.id='flUserCss'; document.head.appendChild(s); } s.textContent=css; },
  applyCss(){ const a=DB.get('cssList',[]).filter(c=>c.on).map(c=>`/* ${c.name} */\n${c.css}`).join('\n'); Boudoir.injectRaw(a); },
  paintManifest(){
    $('#flManifest').innerHTML=`<div class="fl-hint">复制下面的名字，写进「自写 CSS」里就能改。所有名字都是固定的，不会随版本乱变。</div>
      <div class="fl-mani">${MANIFEST.map(g=>`<div class="fl-mani__g"><b>${g.g}</b>
        ${g.items.map(([c,d])=>`<div class="fl-mani__i"><code>${esc(c)}</code><span>${esc(d)}</span></div>`).join('')}</div>`).join('')}</div>`;
  },
  readerSheet(sc,isStage){
    const key=isStage?'stageRead':'weaveRead';
    const cfg=DB.get(key,{size:16.5,lh:2.05,font:'serif'});
    Sheet.open(isStage?'群像剧场阅读样式':'织叙阅读样式',b=>{
      b.innerHTML=`<p style="font-size:11.5px;color:var(--fl-ink-3);text-align:center;margin-bottom:14px">
        ${isStage?'群像剧场':'织叙'}单独保存，改这里不会影响另一边。</p>`;
      const s1=document.createElement('div'); s1.className='fl-sl'; s1.innerHTML=`<span>字号</span><input type="range" min="13" max="22" step="0.5" value="${cfg.size}"><b>${cfg.size}</b>`;
      const s2=document.createElement('div'); s2.className='fl-sl'; s2.innerHTML=`<span>行距</span><input type="range" min="16" max="28" value="${Math.round(cfg.lh*10)}"><b>${cfg.lh}</b>`;
      const f=document.createElement('div');
      b.appendChild(s1); b.appendChild(s2); b.appendChild(f);
      Seg(f,[{v:'serif',t:'宋体感'},{v:'sans',t:'黑体感'}],cfg.font,v=>{cfg.font=v;save();});
      s1.querySelector('input').oninput=e=>{ cfg.size=+e.target.value; s1.querySelector('b').textContent=cfg.size; save(); };
      s2.querySelector('input').oninput=e=>{ cfg.lh=+e.target.value/10; s2.querySelector('b').textContent=cfg.lh; save(); };
      function save(){ DB.set(key,cfg); Boudoir.applyRead(); }
    });
  },
  applyRead(){
    const w=DB.get('weaveRead',{size:16.5,lh:2.05,font:'serif'}), s=DB.get('stageRead',{size:16.5,lh:2.05,font:'serif'});
    const r=$('.fl-page[data-page="reader"]'), t=$('.fl-page[data-page="stage"]');
    const set=(el,c)=>{ if(!el) return; el.style.setProperty('--fl-read-size',c.size+'px'); el.style.setProperty('--fl-read-lh',c.lh);
      el.style.setProperty('--fl-f-read', c.font==='sans'?'var(--fl-f-body)':'"Cormorant Garamond","Songti SC","Noto Serif SC",serif'); };
    set(r,w); set(t,s);
  }
};

/* ───────── 14. 露匣：钱包 / 支付 / 流水 ───────── */
/* 支付：余额、绑定、支付密码全部来自真实的 LunaWallet*DB（见上面的 Adapter），
   这里只负责「用浮岚自己画的键盘/弹窗 UI 去校验、去调用真实扣款」，
   不再维护一份平行的假余额——那正是之前"钱包页面数字和真实钱包对不上"的根源。
   货币单位统一为 Lune（与 wallet.js 完全一致），显示上仍可用「岚露」作为浮岚里的意译称呼，
   但数值与扣款逻辑必须是同一份。 */
const Pay={
  async w(){ return Adapter.wallet(); },
  ledger(){ return DB.get('ledger',[]); },
  log(type,amount,target,after){ const a=Pay.ledger();
    a.unshift({id:uid('lg'),type,amount,target,after,at:Date.now()}); DB.set('ledger',a.slice(0,300)); },
  /* 自绘 PIN 键盘，仅用于校验一个已存在的密码；返回 Promise<boolean> */
  verifyPin(correctPin){
    return new Promise(resolve=>{
      let buf='';
      const b=Modal.open({title:'请输入支付密码',body:`<div class="fl-pay">
        <div class="fl-pay__dots" id="flVDots">${'<i></i>'.repeat(4)}</div>
        <p class="fl-payhint" id="flVHint">用于确认这次扣款</p>
        <div class="fl-keys" id="flVKeys">${[1,2,3,4,5,6,7,8,9].map(n=>`<button data-k="${n}">${n}</button>`).join('')}
          <button class="fn" data-k="c">清空</button><button data-k="0">0</button><button class="fn" data-k="b">删除</button></div></div>`,
        actions:[{t:'取消',fn(){ resolve(false); return true; }}]});
      $('#flVKeys',b).onclick=e=>{
        const k=e.target.closest('[data-k]'); if(!k) return; const v=k.dataset.k;
        if(v==='c') buf=''; else if(v==='b') buf=buf.slice(0,-1); else if(buf.length<4) buf+=v;
        $$('#flVDots i',b).forEach((d,i)=>d.classList.toggle('on',i<buf.length));
        if(buf.length===4){ setTimeout(()=>{
          if(buf===correctPin){ Modal.close(); resolve(true); }
          else{ const h=$('#flVHint',b); if(h){ h.textContent='密码错误，请重新输入'; h.classList.add('is-err'); } buf=''; $$('#flVDots i',b).forEach(d=>d.classList.remove('on')); }
        },160); }
      };
    });
  },
  /* 统一扣款入口：真的去查真实余额、真的按需要求密码、真的写回同一份数据库。
     若还没绑定钱包账户，引导去露匣完成绑定（与 wallet.js 的首次引导是同一套 LunaWalletAccountDB）。 */
  async charge(amount,target,onOk){
    const w=await Pay.w();
    if(!w.bound){ Modal.open({title:'先绑定钱包',body:'<p style="text-align:center">还没有绑定钱包账户，去「露匣」完成绑定后才能支付。</p>',
      actions:[{t:'再说'},{t:'去露匣',p:1,fn(){ Router.go('wallet'); Pay.paint(); }}]}); return; }
    if(w.balance<amount){ Modal.open({title:'余额不够',body:`<p style="text-align:center">这次需要 ${fmt(amount)} Lune，钱包里还有 ${fmt(w.balance)}。</p>`,
      actions:[{t:'算了'},{t:'去充值',p:1,fn(){ Router.go('wallet'); Pay.paint(); }}]}); return; }
    Loading.show('正在确认支付…');
    const r=await Adapter.charge(amount,target);
    Loading.hide();
    if(!r.ok){ if(r.reason!=='已取消支付') Toast.warn(r.reason||'支付未完成'); return; }
    Pay.log('out',amount,target,r.balance);
    const s=Rank.stat(); s.spend=(s.spend||0)+amount; DB.set('stat',s);
    Rank.addXP(amount*3,'消费'); Toast.ok(`已支付 ${fmt(amount)} Lune`);
    Pay.paint(); onOk&&onOk();
  },
  paint(){
    (async()=>{
      const w=await Pay.w(), lv=Rank.levelOf(Rank.stat().xp).level;
      const acc=await idbGet(openLunaDB('LunaWalletAccountDB','accounts'),'accounts','main');
      const sec=await Adapter.paySecurity(w.boundIdentityId);
      $('#flWalletPanel').innerHTML=`
        <div class="fl-purse"><div class="fl-purse__lb">BALANCE · 钱包余额</div>
          <div class="fl-purse__n">${fmt(w.balance)}<em>${esc(w.currency)}</em></div>
          <div style="font-size:11.5px;color:var(--fl-ink-3)">${Rank.name(lv)} · 群像剧场 ${Rank.discount(lv)===1?'无折扣':Math.round(Rank.discount(lv)*100)/10+' 折'}</div>
          <div class="fl-purse__row"><button class="fl-solid" id="flGoTopup">去充值</button><button class="fl-ghost" id="flGoWalletApp">打开露匣钱包</button></div>
        </div>
        <div class="fl-bind"><div class="fl-bind__d"><b>钱包账户</b><span>${w.bound?esc(w.account||'已绑定'):'未绑定，无法支付'}</span></div>
          <i class="fl-bind__s ${w.bound?'fl-bind__s--ok':'fl-bind__s--no'}">${w.bound?'已绑定':'未绑定'}</i></div>
        <div class="fl-bind"><div class="fl-bind__d"><b>支付密码</b><span>${sec.enabled?'已在露匣设置，支付时会校验':'未设置，露匣「支付设置」里可开启'}</span></div>
          <i class="fl-bind__s ${sec.enabled?'fl-bind__s--ok':'fl-bind__s--no'}">${sec.enabled?'已设置':'未设置'}</i></div>
        <p class="fl-hint" style="margin-top:16px">充值、绑定钱包账户、设置支付密码这三件事都在系统的「钱包」App 里完成——浮岚只读取同一份数据、同一条支付规则，不会另建一套。</p>
        <div class="fl-hint">Lune 用于：解锁群像剧目与逐幕续演、投喂糖、超出免费额度的重生成、群像试跑。消费会按 1:3 折算经验，直接推动阶位。</div>`;
      $('#flGoTopup').onclick=$('#flGoWalletApp').onclick=()=>{ Toast.ok('请从桌面打开「钱包」App 完成充值 / 绑定 / 密码设置'); };
    })();
  },
  paintLedger(){
    const a=Pay.ledger(), out=a.filter(x=>x.type==='out');
    const month=new Date(); month.setDate(1); month.setHours(0,0,0,0);
    const mSpend=out.filter(x=>x.at>=month.getTime()).reduce((s,x)=>s+x.amount,0);
    const total=out.reduce((s,x)=>s+x.amount,0);
    const byType={}; out.forEach(x=>{ const k=x.target.split('·')[0].trim(); byType[k]=(byType[k]||0)+x.amount; });
    const cols=['#3F6B54','#6FA487','#A9CDB7','#B9718A','#E3AEBE','#C6AC72'];
    const keys=Object.keys(byType); const sum=keys.reduce((s,k)=>s+byType[k],0)||1;
    let off=0; const segs=keys.map((k,i)=>{ const v=byType[k]/sum*100; const s=`<circle r="27" cx="40" cy="40" fill="none" stroke="${cols[i%6]}" stroke-width="15"
      stroke-dasharray="${(v*1.696).toFixed(2)} 999" stroke-dashoffset="${-off*1.696}" transform="rotate(-90 40 40)"/>`; off+=v; return s; }).join('');
    $('#flLedger').innerHTML=`
      <div class="fl-sum"><div><b>${fmt(mSpend)}</b><span>本月支出</span></div><div><b>${fmt(total)}</b><span>累计支出</span></div><div><b>${fmt(Rank.stat().xp)}</b><span>累计经验</span></div></div>
      ${keys.length?`<div class="fl-donut"><svg width="80" height="80" viewBox="0 0 80 80">${segs}</svg>
        <div class="fl-donut__lg">${keys.map((k,i)=>`<div><i style="background:${cols[i%6]}"></i>${esc(k)} · ${byType[k]} 岚露</div>`).join('')}</div></div>`:''}
      <label class="fl-lb">明细</label>
      <div class="fl-led">${a.length?a.map(x=>`<div class="fl-ledi">
        <i class="fl-ledi__ic" style="background:${x.type==='out'?'linear-gradient(140deg,#E3AEBE,#B9718A)':'linear-gradient(140deg,#8FBFA3,#3F6B54)'}">${x.type==='out'?'支':'入'}</i>
        <div class="fl-ledi__d"><b>${esc(x.target)}</b><span>${when(x.at)} · 余额 ${fmt(x.after)}</span></div>
        <div class="fl-ledi__n ${x.type}">${x.type==='out'?'-':'+'}${x.amount}</div></div>`).join('')
        :'<p style="text-align:center;color:var(--fl-ink-3);font-size:12px;padding:24px">还没有任何流水。</p>'}</div>`;
  }
};

/* ───────── 15. 阶位页 & 说明页 ───────── */
const Ranks={
  paint(){
    const s=Rank.stat(), r=Rank.levelOf(s.xp), t=Rank.tier(r.level);
    const pct=r.need?Math.round(r.into/r.need*100):100;
    const box=$('#flRankPanel');
    box.innerHTML=`<div class="fl-rankhero" id="flRankHero"></div>
      <label class="fl-lb">这一阶的权益</label><div class="fl-perks">${t.perks.map(p=>`<div class="fl-perk">${esc(p)}</div>`).join('')}</div>
      <label class="fl-lb">经验从哪来</label>
      <div class="fl-xptable">
        ${[['消费 1 岚露','+3'],['推进一段剧情','+6 起（按字数追加）'],['解锁 / 观看一幕群像','+8'],['生成一封戏后笺','+12'],['开一场新戏','+20'],
           ['开一台群像','+30'],['发一条评论','+4'],['给一段标心动','+1'],['投喂一颗糖','+3']].map(([a,b])=>`<div class="fl-xprow"><span>${a}</span><b>${b}</b></div>`).join('')}
      </div>
      <label class="fl-lb">我的数据</label>
      <div class="fl-xptable">
        ${[['累计经验',fmt(s.xp)],['推进段数',fmt(s.turns)],['生成字数',fmt(s.words)],['观看幕数',fmt(s.acts)],['评论条数',fmt(s.cmts)],['累计消费',fmt(s.spend)+' 岚露']]
          .map(([a,b])=>`<div class="fl-xprow"><span>${a}</span><b>${b}</b></div>`).join('')}
      </div>
      <label class="fl-lb">五十阶 · 十品</label>
      <div class="fl-tierwall">${TIERS.map((tt,i)=>{
        const lo=i*5+1, hi=i*5+5, locked=r.level<lo;
        return `<div class="fl-tier${locked?' is-locked':''}">
          <div class="fl-tier__hd">${badgeSVG(hi).replace('<svg','<svg style="width:44px;height:44px;flex:0 0 auto"')}
            <div class="fl-tier__nm"><b>${tt.n}</b><span>LV.${lo}–${hi} · ${tt.en}</span></div></div>
          <div class="fl-tier__lvs">${Array.from({length:5},(_,k)=>`<i class="fl-lvchip${r.level>=lo+k?' is-done':''}">${lo+k} ${tt.n}·${['一','二','三','四','五'][k]}</i>`).join('')}</div>
          <div class="fl-perks" style="margin-top:12px">${tt.perks.map(p=>`<div class="fl-perk">${esc(p)}</div>`).join('')}</div>
        </div>`; }).join('')}</div>`;
    const hero=$('#flRankHero');
    hero.appendChild(badgeEl(r.level,'fl-badge--lg'));
    hero.insertAdjacentHTML('beforeend',`<div class="fl-rankhero__t">${Rank.name(r.level)}</div>
      <div class="fl-rankhero__s">LV.${r.level} · ${t.en}</div>
      <div class="fl-rk__bar" style="margin-top:16px"><i style="width:${pct}%"></i></div>
      <div class="fl-rk__xp">${r.need?`距 LV.${r.level+1} 还差 ${fmt(r.need-r.into)} 经验`:'已至顶阶 · 幻境·五'}</div>`);
  }
};
const GUIDE=`
<div class="fl-guide">
<div class="fl-card"><h3 style="margin-top:0">浮岚是什么</h3>
<p>浮岚是一个「有剧情的小剧场」。它不是剧本杀，没有凶手和线索卡；也不是单纯的聊天，它按幕推进，会留白、会给选项、会记住发生过的事。</p>
<p>两种玩法：<b>织叙</b>是你写设定、你的角色下场演；<b>群像剧场</b>是给一个主题，生成一整台陌生人的故事，你在台下看、磕、评。</p></div>

<div class="fl-card"><h3>不 OOC 是怎么保证的</h3>
<p>每次生成，角色卡都会被<b>整张</b>读进去，并且排在提示词最前面，标注为最高准则。若剧情走向与角色性格冲突，系统要求改剧情、不改角色。</p>
<p>若该角色<b>绑定了 user</b>，user 卡会一并读入，用于沿用二人既有的称呼与相处方式；但两卡冲突时一律以角色卡为准。若没有绑定 user，则只按角色卡与世界观推进，不会替你安排设定之外的行为。</p>
<p>此外还有三重保险：事实锚点（你手动钉住的关键事实）、滚动摘要（每 6 段压缩一次，长跑一万字也不失忆）、雷点硬拦截（命中即丢弃重写）。</p></div>

<div class="fl-card"><h3>正文由谁生成</h3>
<p>浮岚本身不内置任何 AI，正文生成用的是「设置」App 里「文本模型」页保存的接口地址与密钥（与该页「获取可用模型」用的是同一份配置）。没配置接口，或本次请求失败时，会用一段本地离线草稿顶上，保证流程不中断——每次生成开始时加载条下方会写清楚这次用的是哪个引擎，一看就知道是不是真的调用了你配的模型。</p></div>

<div class="fl-card"><h3>为什么要控 token</h3>
<p>一次生成的开销 ≈ 角色卡 + 摘要 + 最近几段原文 + 本次目标字数。默认的<b>滚动摘要</b>只回带最近 6 段原文，其余压成摘要，所以写到一万字以上，每次的开销仍然是平的。</p>
<p>「全量回读」最准但最贵，适合短篇精修；「只带锚点」最省，适合单元剧。设定台第六步会给出实时预估。</p></div>

<div class="fl-card"><h3>排版标记与朗读</h3>
<p>正文使用行标记协议：场景、旁白、对白、心理、动作、系统提示各有各的样式；<b>**重点**</b> 会被高亮，<b>[[词条]]</b> 是可以点开的注解。这些标记由系统解析，模型不会把标记本身写给你看。</p>
<p>对白行右侧的朗读按钮始终可点：若「设置 → 语音模型」里配了 MiniMax 音色（GroupId / 密钥 / VoiceId），优先用你配的那个真人声音朗读；没配或请求失败时自动退回设备自带的朗读引擎，保证任何情况下点了都有声音，不会哑火。</p></div>

<div class="fl-card"><h3>群像剧场与同人的分界</h3>
<p>群像剧场只生成<b>原创人物与原创关系网</b>，不接入任何既有作品的角色、专有名词或设定。你的 char 在这里只能是「观戏人」，负责幕间锐评与评论区搭话，不下场演。</p>
<p>解锁全剧后，可以用你自己的 user + char 人设把这套关系走一遍，那属于织叙，会开一场新的独立存档。</p></div>

<div class="fl-card"><h3>存档与美化</h3>
<p>每一场戏、每一台剧目都是<b>独立存档</b>，随时切回去，互不影响。织叙用窗形卡，群像用幕布卡，阅读样式也分开保存。</p>
<p>妆匣里可以换主题、给<b>每一页单独上传背景照片</b>、写自己的 CSS。写 CSS 前请先看「名录」——所有可用的类名与变量都列在那里，名字是固定的。保存样式必须起名字，否则之后无法切换。</p></div>

<div class="fl-card"><h3>岚露与阶位</h3>
<p>岚露是唯一货币，需绑定钱包后才能充值与支付，每次支付都会校验 6 位支付密码。所有收支都记在流水里，可按类型查看构成。</p>
<p>阶位共 50 阶，分十品：初雾、微澜、拂樱、叠翠、浮花、流萤、凝露、霁色、琉光、幻境。每品五阶，徽记的形制、色泽与星芒数各不相同。消费、跑剧情、看幕、写戏后笺、评论都会累积经验，越往后每阶所需越多。折扣与权益随品阶提升，最高七折。</p></div>
</div>`;

/* ───────── 16. 大厅 ───────── */
const Hall={
  paint(){
    Hall.paintRank();
    const rc=$('#flRecent'), a=DB.get('scripts',[]).slice(0,6);
    rc.innerHTML=''; if(!a.length){ rc.innerHTML='<div class="fl-empty" style="padding:24px"><span>还没有开过台。</span></div>'; }
    a.forEach(sc=>{ try{ rc.appendChild(Archives.card(sc)); }catch(e){ console.warn('[浮岚] 跳过一条损坏的存档',e); } });
    const nb=$('#flRecentNotes'), n=Notes.all().slice(0,6);
    nb.innerHTML=''; if(!n.length){ nb.innerHTML='<div class="fl-empty" style="padding:24px"><span>还没有人写信。</span></div>'; }
    n.forEach(x=>{ try{ nb.appendChild(Notes.card(x)); }catch(e){ console.warn('[浮岚] 跳过一封损坏的笺',e); } });
  },
  paintRank(){
    const s=Rank.stat(), r=Rank.levelOf(s.xp), t=Rank.tier(r.level);
    const pct=r.need?Math.round(r.into/r.need*100):100;
    const strip=$('#flRankStrip'); if(!strip) return;
    strip.innerHTML=`<div class="fl-rk"><div id="flRkBadge"></div>
      <div class="fl-rk__meta"><div class="fl-rk__nm">${Rank.name(r.level)}<em>LV.${r.level} · ${t.en}</em></div>
      <div class="fl-rk__bar"><i style="width:${pct}%"></i></div>
      <div class="fl-rk__xp">${r.need?`还差 ${fmt(r.need-r.into)} 经验升阶`:'顶阶 · 幻境·五'} · 钱包 <span id="flRkBal">…</span></div></div></div>`;
    $('#flRkBadge').replaceWith(badgeEl(r.level));
    const h=$('#flHeroRank'); if(h) h.textContent=Rank.name(r.level);
    /* 余额来自真实 IndexedDB，读取是异步的：先占位再补上，避免整条 paintRank 都要改成 async 波及一大串同步调用方 */
    Pay.w().then(w=>{ const el=$('#flRkBal'); if(el) el.textContent=fmt(w.balance)+' '+esc(w.currency); }).catch(()=>{ const el=$('#flRkBal'); if(el) el.textContent='—'; });
  }
};

/* ───────── 17. 文风阁页面 ───────── */
const StylePage={
  tab:'builtin',
  paint(){
    const tabs=$('#flStyleTabs'); tabs.innerHTML='';
    [['builtin','内置十体'],['mine','我的文风']].forEach(([v,t])=>{
      const b=document.createElement('button'); b.className='fl-tab'+(StylePage.tab===v?' is-on':''); b.textContent=t;
      b.onclick=()=>{ StylePage.tab=v; StylePage.paint(); }; tabs.appendChild(b); });
    const box=$('#flStyleList'); box.innerHTML='';
    const list=StylePage.tab==='builtin'?BUILTIN_STYLES:styles();
    if(!list.length){ box.innerHTML=`<div class="fl-empty"><b>还没有自己的文风</b><span>把你想要的语感写清楚，<br>再让模型试写一段看看它接不接得住。</span><button class="fl-solid" id="flNewStyle2">新建一个</button></div>`;
      $('#flNewStyle2').onclick=()=>StylePage.edit(); return; }
    list.forEach(s=>box.appendChild(StylePage.card(s)));
  },
  card(s){
    const d=document.createElement('div'); d.className='fl-sty';
    d.innerHTML=`<div class="fl-sty__hd"><b class="fl-sty__nm">${esc(s.name)}</b><i class="fl-sty__kind${s.mine?' fl-sty__kind--mine':''}">${s.mine?'我的':esc(s.tag||'内置')}</i></div>
      <p class="fl-sty__ds">${esc(s.desc)}</p>
      <div class="fl-sty__ex">${esc(s.ex||'（未留示例，模型只能靠描述猜）').replace(/\n/g,'<br>')}</div>
      <div class="fl-sty__ft"><button class="fl-mini fl-mini--go" data-a="use">用它开台</button>
        <button class="fl-mini" data-a="test">接收测试</button>
        ${s.mine?'<button class="fl-mini" data-a="edit">编辑</button><button class="fl-mini fl-mini--warn" data-a="del">删除</button>':'<button class="fl-mini" data-a="fork">复制一份来改</button>'}</div>
      <div data-test></div>`;
    d.onclick=e=>{ const b=e.target.closest('[data-a]'); if(!b) return; const a=b.dataset.a;
      if(a==='use'){ const st=DB.get('draft',null)||Studio.blank(); st.styleId=s.id; DB.set('draft',st); Studio.open(st); Studio.step=1; Studio.paint(); Toast.ok('已选为本场文风'); }
      if(a==='test') runStyleTest(s,d.querySelector('[data-test]'));
      if(a==='edit') StylePage.edit(s);
      if(a==='fork') StylePage.edit(Object.assign({},s,{id:uid('st'),name:s.name+'（我的）',mine:true}),true);
      if(a==='del') confirmBox('删除文风',`删掉「${s.name}」之后不能恢复`,'删掉',()=>{ saveStyles(styles().filter(x=>x.id!==s.id)); StylePage.paint(); });
    };
    return d;
  },
  edit(s,isNew){
    const cur=s||{id:uid('st'),name:'',desc:'',ex:'',ban:'',keywords:'',mine:true};
    Modal.open({title:s&&!isNew?'编辑文风':'新建文风',
      body:`<label class="fl-lb">名字<em>必填，之后靠它选</em></label><input class="fl-in" id="flStN" value="${esc(cur.name)}" placeholder="例：雨夜低语">
        <label class="fl-lb">描述<em>写清楚：句子多长、爱用什么词、忌讳什么</em></label><textarea class="fl-in fl-in--ta" id="flStD" rows="4" placeholder="例：短句为主，少形容词，情绪靠动作递出；每段末尾留一个未解的细节。">${esc(cur.desc)}</textarea>
        <label class="fl-lb">示例正文<em>强烈建议写，模型主要靠这个判断语感</em></label><textarea class="fl-in fl-in--ta" id="flStE" rows="5" placeholder="写一小段你心目中最标准的样子">${esc(cur.ex)}</textarea>
        <label class="fl-lb">关键词<em>希望常出现的词，顿号分隔</em></label><input class="fl-in" id="flStK" value="${esc(cur.keywords||'')}" placeholder="例：雨、灯、指节、停顿">
        <label class="fl-lb">禁用词<em>绝对不要出现的词</em></label><input class="fl-in" id="flStB" value="${esc(cur.ban||'')}" placeholder="例：忽然、仿佛、心中一暖">`,
      actions:[{t:'取消'},{t:'保存',p:1,fn(){
        const n=$('#flStN').value.trim(); if(!n){ Toast.warn('先给它起个名字'); return false; }
        const o={id:cur.id,name:n,desc:$('#flStD').value.trim(),ex:$('#flStE').value,keywords:$('#flStK').value,ban:$('#flStB').value,mine:true};
        const a=styles(); const i=a.findIndex(x=>x.id===o.id); if(i<0) a.unshift(o); else a[i]=o;
        saveStyles(a); StylePage.tab='mine'; StylePage.paint(); Toast.ok('已保存');
        setTimeout(()=>{ const card=$('#flStyleList').firstChild; if(card) runStyleTest(o,card.querySelector('[data-test]')); },200);
      }}]});
  }
};

/* ───────── 18. 路由 / 状态栏 / 启动 ───────── */
const Router={
  now:'hall', stack:[],
  go(p,noPush){
    const el=$(`.fl-page[data-page="${p}"]`); if(!el) return;
    if(!noPush&&p!==Router.now) Router.stack.push(Router.now);
    $$('.fl-page').forEach(x=>x.classList.toggle('is-active',x===el));
    Router.now=p;
    document.body.dataset.mode=['ensemble','ensembleForge','stage','ensembleArchives'].includes(p)?'ens':'weave';
    $$('.fl-dock__p').forEach(b=>b.classList.toggle('is-on',b.dataset.go===p));
    const paint={hall:Hall.paint,archives:Archives.paint,notes:Notes.paint,styles:StylePage.paint,
      ensemble:Ens.paintHome,ensembleForge:Ens.paintForge,ensembleArchives:()=>{ const b=$('#flEnsArch'); const a=Ens.all();
        b.innerHTML=''; if(!a.length){ b.innerHTML='<div class="fl-empty"><b>还没有剧目</b><span>去开一台，台上就有人了。</span></div>'; }
        a.forEach(e=>b.appendChild(Ens.card(e))); },
      boudoir:Boudoir.paint,wallet:Pay.paint,ledger:Pay.paintLedger,ranks:Ranks.paint,
      guide:()=>{ $('#flGuide').innerHTML=GUIDE; }}[p];
    paint&&paint();
    const sc=el.querySelector('.fl-scroll'); if(sc&&!['reader','stage'].includes(p)) sc.scrollTop=0;
  },
  back(){ const p=Router.stack.pop(); Router.go(p||'hall',true); }
};
/* 状态栏：不再尝试跨窗口克隆 index 的节点（本项目全程用 location.href 整页跳转，
   压根没有 parent/opener 关系，跨窗口那条路一直是走不通的死路，这也是之前「同步」
   总对不上的根源）。改成和 wallet.js / user.js 一样的正确做法：
   fulan.html 直接内置与 index.html 完全同构的 .status-bar 标记（同一套 id），
   每个页面各自本地计算真实时间、真实电量、真实灵动岛样式 —— 这样才是真的处处一致，
   而不是「运气好凑巧能读到」。 */
const Status={
  sync(){ Status.clock(); setInterval(Status.clock,20000); Status.battery(); Status.island(); },
  clock(){
    const tz=(function(){ try{ return localStorage.getItem('luna_tz')||'Asia/Shanghai'; }catch(e){ return 'Asia/Shanghai'; } })();
    const now=new Date();
    let txt;
    try{ txt=now.toLocaleTimeString('zh-CN',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false}); }
    catch(e){ txt=now.getHours()+':'+String(now.getMinutes()).padStart(2,'0'); }
    $$('#statusTime').forEach(el=>el.textContent=txt);
  },
  battery(){
    const render=pct=>{ const p=Math.round(pct);
      $$('#batPct').forEach(el=>el.textContent=p);
      $$('#batInner').forEach(el=>{ el.style.width=p+'%';
        el.style.background = p<=20 ? 'linear-gradient(90deg,#f87171,#ef4444)' : 'linear-gradient(90deg,#8FBFA3,#5F9077)'; }); };
    if('getBattery' in navigator){ navigator.getBattery().then(b=>{ render(b.level*100); b.addEventListener('levelchange',()=>render(b.level*100)); }).catch(()=>render(78)); }
    else render(78);
  },
  island(){
    /* 与 wallet.js applyIsland() 读同一份 localStorage key，保证「灵动岛」样式全局一致 */
    let enabled=false, style='minimal';
    try{ enabled=localStorage.getItem('luna_island_enabled')==='true'; style=localStorage.getItem('luna_island_style')||'minimal'; }catch(e){}
    const el=$('#statusIsland'); if(!el) return;
    if(!enabled){ el.innerHTML=''; return; }
    const map={
      minimal:`<div class="si-minimal"><div class="si-capsule"></div></div>`,
      glow:`<div class="si-glow"><div class="si-capsule"></div></div>`,
      clock:`<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="siClockText">--:--</span></div></div>`,
      pulse:`<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
      ripple:`<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
      rainbow:`<div class="si-rainbow"><div class="si-capsule"></div></div>`,
      music:`<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
      scan:`<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`
    };
    el.innerHTML=map[style]||map.minimal;
    clearInterval(window._flSiClockTimer);
    if(style==='clock'){ const tick=()=>{ const t=$('#siClockText'); if(!t) return; const n=new Date(); t.textContent=n.getHours()+':'+String(n.getMinutes()).padStart(2,'0'); };
      tick(); window._flSiClockTimer=setInterval(tick,10000); }
  }
};

/* 全局兜底：任何一处抛错都先把雾散开，绝不让遮罩盖死页面 */
window.addEventListener('error',e=>{ Loading.force();
  console.error('[浮岚] 运行时错误',e.error||e.message); });
window.addEventListener('unhandledrejection',e=>{ Loading.force();
  console.error('[浮岚] 未捕获的异步错误',e.reason); });
function fatal(msg){ const f=$('#flFatal'); if(!f) return;
  $('#flFatalT').textContent=String(msg||'未知错误'); f.hidden=false; Loading.force(); }

/* 全局字体：与 settings.js / user.js 的 applyGlobalFont() 完全同构，
   读同一个 luna_font_active_name / luna_font_active_id / luna_font_style，
   保证浮岚里显示的字体和系统设置里选的是同一份，不是另起一套字体系统 */
async function applyGlobalFont(){
  let style={}; try{ style=JSON.parse(localStorage.getItem('luna_font_style')||'{}'); }catch(e){}
  const name=localStorage.getItem('luna_font_active_name');
  const id=parseInt(localStorage.getItem('luna_font_active_id'));
  let tag=document.getElementById('luna-font-override');
  if(!tag){ tag=document.createElement('style'); tag.id='luna-font-override'; document.head.appendChild(tag); }
  /* 浮岚有自己的展示字体体系（--fl-f-display 等），全局强制覆盖会连标题字体一起吃掉，
     所以这里只覆盖正文字号与颜色，字族只作用于 body 默认字体，不动 --fl-f-display 相关的标题类 */
  const sizeRule=style.size?`font-size:${style.size}px!important;`:'';
  tag.textContent = sizeRule ? `body,.fl-page{${sizeRule}}` : '';
  if(name&&id){
    try{
      const db=await new Promise((res,rej)=>{ const req=indexedDB.open('LunaFontDB',4); req.onsuccess=e=>res(e.target.result); req.onerror=()=>rej(); });
      const all=await new Promise(res=>{ const r=db.transaction('fonts').objectStore('fonts').getAll(); r.onsuccess=()=>res(r.result||[]); r.onerror=()=>res([]); });
      const f=all.find(x=>x.id===id);
      if(f){ const face=new FontFace(name,`url(${f.data})`); await face.load(); document.fonts.add(face); }
    }catch(e){}
    document.body.style.setProperty('--fl-f-body', `'${name}', sans-serif`);
  }
}

function boot(){
  Loading.force();                       /* 起手先确认遮罩是收着的 */
  Status.sync();
  /* 提前把角色卡 / 身份缓存拉好，后面各页面（群像选观戏人、Stage 锐评等）需要同步读取时才不会读到空数组。
     Studio 开台页自己另有一次强制刷新（见 Studio.open），保证这里万一还没拉完也不会用旧数据开新台。 */
  Adapter.preload().catch(()=>{});
  Boudoir.applyTheme(); Boudoir.applyRead(); Boudoir.applyAllBg();
  applyGlobalFont();
  document.addEventListener('click',e=>{
    const go=e.target.closest('[data-go]'); if(go){ Router.go(go.dataset.go); return; }
    const bk=e.target.closest('[data-back]'); if(bk){ Router.back(); return; }
  });
  $('#flNext').onclick=()=>Studio.next();
  $('#flPrev').onclick=()=>{ if(Studio.step>0){ Studio.step--; Studio.paint(); } };
  $('#flStudioDraft').onclick=()=>{ DB.set('draft',Studio.st); Toast.ok('草稿已存，随时回来接着填'); };
  $('#flNewStyle').onclick=()=>StylePage.edit();
  $('#flThemeNew').onclick=()=>Boudoir.newTheme();
  $('#flSend').onclick=()=>{ const v=$('#flAct').value.trim(); $('#flAct').value=''; Reader.advance(v); };
  $('#flAct').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); $('#flSend').click(); } });
  $('#flCont').onclick=()=>Reader.advance('');
  $('#flRegen').onclick=()=>{ const sc=Reader.sc; if(!sc||!sc.turns.length) return;
    let i=sc.turns.length-1; while(i>0&&sc.turns[i].role!=='ai') i--; Reader.regen(i); };
  $('#flReadMenu').onclick=()=>Reader.menu();
  $('#flStageMenu').onclick=()=>Stage.menu();
  $('#flCmtSend').onclick=()=>Stage.send();
  $('#flCmtIn').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); Stage.send(); } });
  $('#flSugar').onclick=()=>Pay.charge(2,'投喂糖',()=>{ const e=Stage.e; if(!e) return; e.sugar=(e.sugar||0)+1; Ens.save(e); Stage.paint(); Rank.addXP(3,'投喂'); });
  $('.fl-gate__card--weave').onclick=()=>Studio.open();
  Router.go('hall',true);
  console.log('%c浮岚 FULAN','color:#3F6B54;font-size:14px;letter-spacing:.2em','已就绪。接入外部 AI：定义 window.FLAI.generate(messages,opt)；接入语音：window.FLTTS.speak(text)。');
}
function safeBoot(){ try{ boot(); }catch(e){ console.error(e); fatal(e&&e.message||e); } }
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',safeBoot):safeBoot();

/* 对外暴露，方便你在 index 里调用 */
window.FULAN={Router,Studio,Reader,Ens,Stage,Notes,Boudoir,Pay,Rank,DB,Adapter,MANIFEST,BUILTIN_STYLES,TIERS};
})();