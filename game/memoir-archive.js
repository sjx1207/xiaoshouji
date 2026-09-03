/* ═══════════════════════════════════════════════════════════
   回想录 · MEMOIR — archive.js
   立卷向导 / 存档库 / 存档详情 / 阅读
   ═══════════════════════════════════════════════════════════ */
(function(){
'use strict';
const M=window.Memoir,$=M.$,$$=M.$$,esc=M.esc;
const A={}; M.Archive=A;

let archives=[],entries=[],chars=[],idents=[];
let W=null;          // 向导状态
let curArc=null,curEntry=null;

A.init=async function(){
  archives=await M.db.all('archives');
  entries =await M.db.all('entries');
};
A.reload=async function(){
  archives=await M.db.all('archives');
  entries =await M.db.all('entries');
};
A.all=()=>archives.slice();
A.byId=id=>archives.find(a=>a.id===id);
A.entriesOf=(aid,type)=>entries.filter(e=>e.archiveId===aid&&(!type||e.type===type))
  .sort((a,b)=>(b.updatedAt||b.createdAt)-(a.updatedAt||a.createdAt));
A.entryById=id=>entries.find(e=>e.id===id);
A.saveEntry=async function(e){ e.updatedAt=Date.now(); await M.db.put('entries',e);
  entries=await M.db.all('entries'); return e; };
A.saveArchive=async function(a){ a.updatedAt=Date.now(); await M.db.put('archives',a);
  archives=await M.db.all('archives'); return a; };

/* ═══════════ 立卷向导 ═══════════ */
const STEPS=[
  {k:'char', n:'择人', t:'择　人', d:'从角色书里选定这一卷的主角。他的全部设定会作为最高优先级传给模型。'},
  {k:'user', n:'定身', t:'定　身', d:'选定你在这个故事里的身份。若该身份绑定过此角色，会自动为你选中。'},
  {k:'pre',  n:'择料', t:'择　料', d:'挑选文风、世界观、视角与规则。不选也能开始，模型会自建一套并保持稳定。'},
  {k:'seal', n:'成卷', t:'成　卷', d:'为这一卷起名，写下从哪里开始，并挑一张背景。'},
];

A.openSetup=async function(){
  chars =await M.loadChars();
  idents=await M.loadIdentities();
  W={step:0,charId:null,userId:null,presetIds:[],bg:null,title:'',seed:'',autoBound:false};
  M.nav('setup');
  renderWizard();
};

function autoBindUser(cid){
  const b=idents.find(u=>(Array.isArray(u.boundCharIds)&&u.boundCharIds.includes(cid))||u.boundCharId===cid);
  if(b) return {id:b.id,auto:true};
  const p=idents.find(u=>u.isPrimary)||idents.find(u=>u.active!==false)||idents[0];
  return p?{id:p.id,auto:false}:null;
}

function renderRail(){
  $('#stepRail').innerHTML=STEPS.map((s,i)=>{
    const cls=i===W.step?'on':(i<W.step?'done':'');
    return `<div class="stepn ${cls}" data-step="${i}"><b>${M.cjkNum(i+1)}</b><span>${s.n}</span></div>`+
      (i<STEPS.length-1?`<div class="stepline ${i<W.step?'done':''}"><i></i></div>`:'');
  }).join('');
  $('#stepRail').onclick=e=>{
    const n=e.target.closest('.stepn'); if(!n) return;
    const i=+n.dataset.step;
    if(i>W.step && !canAdvanceTo(i)) return M.toast(gateMsg());
    W.step=i; renderWizard();
  };
}

function canAdvanceTo(i){
  if(i>=1 && !W.charId) return false;
  return true;
}
function gateMsg(){ return W.charId?'请先完成当前一步':'请先选定一位角色'; }

function renderWizard(){
  renderRail();
  const s=STEPS[W.step];
  $('#setupTitle').innerHTML='立卷<em>STEP '+(W.step+1)+' OF 4</em>';
  const body=$('#setupBody');
  body.innerHTML=`<div class="stepbody">
    <div class="step-h"><b>${esc(s.t)}</b><span>${esc(s.d)}</span></div>
    ${renderStepBody()}
  </div>`;
  bindStep();
  renderFoot();
}

function renderStepBody(){
  if(W.step===0){
    if(!chars.length) return emptyBlock('角色书是空的','请先到「角色」App 创建一位角色，回想录会自动同步。');
    return `<div class="portraits" id="wChars">${chars.map(c=>portrait(c,W.charId===c.id,false)).join('')}</div>`;
  }
  if(W.step===1){
    const c=chars.find(x=>x.id===W.charId);
    if(!idents.length) return emptyBlock('身份档是空的','可到「身份」App 创建，用于精准定义"你"在故事里的样子。也可以跳过，模型会以第二人称称呼你。');
    return `<div class="portraits" id="wUsers">${idents.map(u=>portrait(u,W.userId===u.id,true,
        W.autoBound&&W.userId===u.id?'绑定':null)).join('')}</div>`+pairbar(c,idents.find(x=>x.id===W.userId));
  }
  if(W.step===2){
    return `<div id="wPresets">${M.Preset.pickerHtml(W.presetIds)}</div>
      <div class="divider"><i></i><b></b><b></b><b></b><i></i></div>
      <div style="text-align:center;font-size:11px;letter-spacing:.16em;color:var(--ink-5)">
        已选 ${W.presetIds.length} 条</div>`;
  }
  const c=chars.find(x=>x.id===W.charId), u=idents.find(x=>x.id===W.userId);
  const title=W.title||(c?`与${c.name}的回想`:'未命名');
  return `
    <div class="field">
      <div class="field-label">卷名<em>TITLE</em></div>
      <input class="inp" id="wTitle" placeholder="${esc(c?'与'+c.name+'的回想':'例：雨季的第七天')}" value="${esc(W.title)}"/>
    </div>
    <div class="field">
      <div class="field-label">开场引导<em>OPENING · 可留空</em></div>
      <textarea class="txa" id="wSeed" placeholder="想从哪里开始？例如：深夜的便利店，她第三次出现在同一个货架前。留空则由角色的开场白与设定自动起笔。">${esc(W.seed)}</textarea>
    </div>
    <div class="field">
      <div class="field-label">背景<em>COVER</em></div>
      <div class="cover-pick ${W.bg?'has':''}" id="wBg">
        ${W.bg?`<img src="${esc(W.bg)}" alt=""/>`:''}
        <div class="brk tl"></div><div class="brk tr"></div><div class="brk bl"></div><div class="brk br"></div>
        <div class="hint">${W.bg?'轻触更换':'轻触上传一张背景图'}</div>
      </div>
    </div>
    <div class="sect"><span class="sect-cn">预览</span><i></i><span class="sect-en">PREVIEW</span></div>
    <div class="previewcard">
      <div class="previewcard-bg">${W.bg?`<img src="${esc(W.bg)}" alt=""/>`:''}</div>
      <div class="previewcard-scrim"></div>
      <div class="previewcard-in">
        <div class="arc-head">
          <div class="arc-avs">${c?M.avatarHtml(c):''}${u?M.avatarHtml(u,'round'):''}</div>
          <div class="arc-name">
            <div class="arc-t" id="wPvTitle">${esc(title)}</div>
            <div class="arc-pair">${esc(c?c.name:'')}${u?' ｜ '+esc(u.name):''}</div>
          </div>
        </div>
        <div class="arc-body" style="flex:1">${esc(W.seed||(c&&c.scenario)||'尚未开始第一段剧情')}</div>
        <div class="arc-foot">
          <span class="arc-cnt">预设 <b>${W.presetIds.length}</b></span>
          <span class="arc-cnt">剧情 <b>0</b></span>
          <span class="arc-date">即将建立</span>
        </div>
      </div>
      <div class="brk tl"></div><div class="brk tr"></div>
    </div>
    <div style="height:16px"></div>`;
}

function portrait(o,on,round,badge){
  const tags=[];
  if(o.gender) tags.push(o.gender);
  if(o.age) tags.push(o.age);
  if(o.identityType) tags.push(o.identityType);
  if(Array.isArray(o.traits)) tags.push(...o.traits.slice(0,2));
  if(Array.isArray(o.tags)) tags.push(...o.tags.slice(0,2));
  return `<div class="pt ${on?'on':''}" data-id="${esc(o.id)}">
    <div class="pt-seal">${esc(badge?badge[0]:'選')}</div>
    <div class="pt-av">${M.avatarHtml(o,'lg'+(round?' round':''))}</div>
    <div class="pt-n">${esc(o.name||'未命名')}</div>
    <div class="pt-r">${esc(o.role||o.species||o.occupation||'—')}</div>
    ${tags.length?`<div class="pt-tags">${tags.slice(0,3).map(t=>`<i>${esc(t)}</i>`).join('')}</div>`:''}
  </div>`;
}

function pairbar(c,u){
  if(!c||!u) return '';
  return `<div class="pairbar">
    ${M.avatarHtml(c)}
    <div class="pairbar-link"><i></i><b>与</b><i></i></div>
    ${M.avatarHtml(u,'round')}
    <div class="pairbar-txt">
      <div class="pairbar-t">${esc(c.name)} ｜ ${esc(u.name)}</div>
      <div class="pairbar-d">${esc(c.relation||'关系未在角色书中定义')}${c.callUser?'　称你为「'+esc(c.callUser)+'」':''}</div>
    </div>
    <div class="brk tl"></div><div class="brk br"></div>
  </div>`;
}

function emptyBlock(t,d){
  return `<div class="plate" style="padding:26px 22px">
    <div class="brk tl"></div><div class="brk tr"></div><div class="brk bl"></div><div class="brk br"></div>
    <div style="font-family:var(--song);font-size:16px;letter-spacing:.2em;color:var(--ink-2);margin-bottom:12px">${esc(t)}</div>
    <div style="font-size:12.5px;line-height:2;color:var(--ink-4)">${esc(d)}</div></div>`;
}

function bindStep(){
  if(W.step===0){
    const el=$('#wChars'); if(!el) return;
    el.onclick=e=>{
      const p=e.target.closest('.pt'); if(!p) return;
      W.charId=p.dataset.id;
      const b=autoBindUser(W.charId);
      if(b){ W.userId=b.id; W.autoBound=b.auto; }
      renderWizard();
      M.toast('已选定 '+(chars.find(x=>x.id===W.charId)||{}).name);
    };
  } else if(W.step===1){
    const el=$('#wUsers'); if(!el) return;
    el.onclick=e=>{
      const p=e.target.closest('.pt'); if(!p) return;
      if(W.userId===p.dataset.id){ W.userId=null; W.autoBound=false; }
      else { W.userId=p.dataset.id; W.autoBound=false; }
      renderWizard();
    };
  } else if(W.step===2){
    const el=$('#wPresets'); if(!el) return;
    el.onclick=e=>{
      const c=e.target.closest('.chip'); if(!c) return;
      const id=c.dataset.pid, at=W.presetIds.indexOf(id);
      at>-1?W.presetIds.splice(at,1):W.presetIds.push(id);
      renderWizard();
    };
  } else {
    $('#wTitle').oninput=e=>{ W.title=e.target.value;
      $('#wPvTitle').textContent=W.title||((chars.find(x=>x.id===W.charId)||{}).name?`与${chars.find(x=>x.id===W.charId).name}的回想`:'未命名'); };
    $('#wSeed').oninput=e=>W.seed=e.target.value;
    $('#wBg').onclick=async()=>{ const d=await M.pickImage(1400); if(d){ W.bg=d; renderWizard(); } };
  }
}

function renderFoot(){
  const last=W.step===STEPS.length-1;
  const ready=W.step===0?!!W.charId:true;
  $('#setupFoot').innerHTML=
    (W.step>0?`<div class="btn ghost" data-act="w-prev" style="flex:0 0 34%">上 一 步</div>`:'')+
    `<div class="btn dark ${ready?'':'off'}" data-act="${last?'w-done':'w-next'}">${last?'成 卷 起 笔':'下 一 步'}</div>`;
}

M.actions['w-prev']=()=>{ if(W.step>0){ W.step--; renderWizard(); } };
M.actions['w-next']=()=>{
  if(W.step===0&&!W.charId) return M.toast('请先选定一位角色');
  W.step=Math.min(STEPS.length-1,W.step+1); renderWizard();
};
M.actions['w-done']=async()=>{
  if(!W.charId) return M.toast('请先选定一位角色');
  const c=chars.find(x=>x.id===W.charId);
  const u=idents.find(x=>x.id===W.userId)||null;
  const arc={
    id:M.uid(),
    title:(W.title||'').trim()||`与${c.name||'未名'}的回想`,
    charId:c.id,char:JSON.parse(JSON.stringify(c)),
    userId:u?u.id:null,user:u?JSON.parse(JSON.stringify(u)):null,
    presetIds:W.presetIds.slice(),bg:W.bg||null,seed:W.seed||'',
    createdAt:Date.now(),updatedAt:Date.now(),
  };
  await A.saveArchive(arc);
  M.toast('已成卷');
  const scene=await A.newScene(arc,W.seed);
  M.Play.open(arc,scene,true);
};

A.newScene=async function(arc,seed){
  const idx=A.entriesOf(arc.id,'scene').length+1;
  const en={id:M.uid(),archiveId:arc.id,type:'scene',
    title:`第${M.cjkNum(idx)}段 · 未命名`,index:idx,seed:seed||'',turns:[],
    createdAt:Date.now(),updatedAt:Date.now()};
  await A.saveEntry(en);
  return en;
};

/* ═══════════ 存档库 ═══════════ */
A.renderList=function(){
  const box=$('#archiveList');
  const list=archives.slice().sort((a,b)=>b.updatedAt-a.updatedAt);
  if(!list.length){
    box.innerHTML=`<div class="empty" style="padding-top:104px">
      <div class="empty-mark"><b>卷</b></div>
      <div class="empty-t">还没有任何存档</div>
      <div class="empty-d">从一位角色开始，回想录会替你保管<br/>剧情与七种衍生读法</div>
      <div class="btn dark" style="margin-top:26px" data-act="start">立 卷</div></div>`;
    return;
  }
  box.innerHTML=list.map(a=>{
    const sc=A.entriesOf(a.id,'scene');
    const dv=entries.filter(e=>e.archiveId===a.id&&e.type!=='scene');
    const last=sc[0];
    const prev=last&&last.turns&&last.turns.length
      ? M.stripTags((last.turns[last.turns.length-1].text||'')).slice(0,76)
      : (a.seed||'尚未开始第一段剧情');
    return `<div class="arc" data-aid="${a.id}">
      <div class="arc-bg">${a.bg?`<img src="${esc(a.bg)}" alt=""/>`:''}</div>
      <div class="arc-scrim"></div>
      <div class="arc-in">
        <div class="arc-head">
          <div class="arc-avs">${M.avatarHtml(a.char)}${a.user?M.avatarHtml(a.user,'round'):''}</div>
          <div class="arc-name">
            <div class="arc-t">${esc(a.title)}</div>
            <div class="arc-pair">${esc(a.char.name||'')}${a.user?' ｜ '+esc(a.user.name||''):''}</div>
          </div>
        </div>
        <div class="arc-body">${esc(prev)}</div>
        <div class="arc-foot">
          <span class="arc-cnt">剧情 <b>${sc.length}</b></span>
          <span class="arc-cnt">衍生 <b>${dv.length}</b></span>
          <span class="arc-date">${esc(M.fmtDate(a.updatedAt))}</span>
        </div>
      </div>
      <div class="brk tl"></div><div class="brk br"></div>
    </div>`;
  }).join('');
  box.onclick=e=>{ const el=e.target.closest('.arc'); if(!el) return; A.openDetail(el.dataset.aid); };
};

/* ═══════════ 存档详情 ═══════════ */
A.openDetail=function(aid){
  curArc=A.byId(aid); if(!curArc) return;
  A.current=curArc; M.nav('archive-detail'); A.renderDetail();
};

A.renderDetail=function(){
  const a=curArc; if(!a) return;
  $('#adTitle').innerHTML=esc(a.title)+'<em>RECORD</em>';
  const scenes=A.entriesOf(a.id,'scene').sort((x,y)=>(x.index||0)-(y.index||0));
  const total=scenes.reduce((n,s)=>n+(s.turns||[]).filter(t=>t.role==='ai').length,0);
  const words=scenes.reduce((n,s)=>n+(s.turns||[]).reduce((m,t)=>m+M.stripTags(t.text||'').length,0),0);

  $('#adBody').innerHTML=`
    <div class="ad-hero">
      <div class="ad-hero-bg">${a.bg?`<img src="${esc(a.bg)}" alt=""/>`:''}</div>
      <div class="ad-hero-scrim"></div>
      <div class="ad-hero-in">
        <div class="ad-avs">${M.avatarHtml(a.char,'lg')}
          <span class="rel">${esc((a.char.relation||'与').slice(0,6))}</span>
          ${a.user?M.avatarHtml(a.user,'lg round'):''}</div>
        <div class="ad-t">${esc(a.title)}</div>
        <div class="ad-sub">${esc(a.char.name||'')}${a.user?' ｜ '+esc(a.user.name||''):''} ｜ ${esc(M.fmtDate(a.createdAt))}</div>
      </div>
    </div>

    <div class="band" style="margin-top:2px">
      <div class="stat"><div class="stat-n">${scenes.length}</div><div class="stat-l">段</div></div>
      <div class="stat"><div class="stat-n">${total}</div><div class="stat-l">回合</div></div>
      <div class="stat"><div class="stat-n">${words>9999?(words/10000).toFixed(1)+'万':words}</div><div class="stat-l">字</div></div>
      <div class="stat"><div class="stat-n">${(a.presetIds||[]).length}</div><div class="stat-l">预设</div></div>
    </div>

    <div class="sect"><span class="sect-cn">衍生</span><i></i><span class="sect-en">DERIVATIVES</span></div>
    <div class="dvgrid" id="adDerv">${Object.keys(M.DERV).map(k=>{
      const n=A.entriesOf(a.id,k).length;
      return `<div class="dv ${n?'has':''}" data-derv="${k}">
        <div class="dv-n">${esc(M.DERV[k].name)}</div><div class="dv-c">${n||'—'}</div></div>`;
    }).join('')}</div>

    <div class="sect"><span class="sect-cn">剧情</span><i></i><span class="sect-en">SCENES</span></div>
    ${scenes.length?scenes.map(s=>{
      const t=s.turns||[], lastAi=[...t].reverse().find(x=>x.role==='ai');
      return `<div class="scn" data-sid="${s.id}">
        <div class="scn-i">${M.cjkNum(s.index||1)}</div>
        <div class="scn-b">
          <div class="scn-t">${esc(s.title)}</div>
          <div class="scn-d">${esc(M.stripTags(lastAi?lastAi.text:s.seed).slice(0,86)||'尚未生成内容')}</div>
          <div class="scn-m"><span class="tagpill">${t.filter(x=>x.role==='ai').length} 回合</span>
            <span class="tagpill">${esc(M.fmtDate(s.updatedAt))}</span></div>
        </div>
      </div>`;
    }).join(''):`<div style="font-size:12px;color:var(--ink-5);line-height:2;padding:8px 4px 16px">这一卷还没有剧情段落。</div>`}

    <div class="btn wide ghost" data-act="ad-new-scene" style="margin-top:6px">新 起 一 段</div>
    <div class="divider"><i></i><b></b><b></b><b></b><i></i></div>
    <div style="text-align:center;font-size:10px;letter-spacing:.28em;color:var(--ink-5)">全部衍生内容归档于此卷之下</div>
    <div style="height:24px"></div>`;

  $('#adDerv').onclick=e=>{ const d=e.target.closest('.dv'); if(!d) return; A.showDervList(d.dataset.derv); };
  $$('#adBody .scn').forEach(el=>el.onclick=()=>{
    const s=A.entryById(el.dataset.sid); if(s) M.Play.open(a,s,false); });
};

M.actions['ad-new-scene']=async()=>{
  const s=await A.newScene(curArc,''); M.Play.open(curArc,s,true);
};

M.actions['ad-menu']=async()=>{
  const a=curArc; if(!a) return;
  const v=await M.sheet({title:'存档操作',plain:true,options:[
    {id:'rename',title:'重命名这一卷',desc:a.title},
    {id:'bg',title:'更换背景'},
    {id:'preset',title:'调整预设',desc:`当前 ${(a.presetIds||[]).length} 条`},
    {id:'resync',title:'重新同步角色与身份',desc:'从角色书 / 身份档拉取最新资料'},
    {id:'export',title:'导出为文本'},
    {id:'del',title:'删除整卷',desc:'连同其下所有剧情与衍生内容',danger:true},
  ]});
  if(!v) return;
  if(v==='rename'){
    const t=await M.prompt('重命名',{input:{value:a.title,placeholder:'卷名'}});
    if(t){ a.title=t; await A.saveArchive(a); A.renderDetail(); M.toast('已更名'); }
  }else if(v==='bg'){
    const d=await M.pickImage(1400);
    if(d){ a.bg=d; await A.saveArchive(a); A.renderDetail(); M.toast('背景已更新'); }
  }else if(v==='preset'){
    const all=M.Preset.all().filter(p=>p.enabled!==false);
    const sel=await M.sheet({title:'调整预设',desc:'可多选',multi:true,
      selected:(a.presetIds||[]).slice(),
      options:all.map(p=>({id:p.id,title:p.title,desc:p.content.slice(0,54),
        right:M.Preset.catOf(p.cat).name})),okText:'保存'});
    if(sel){ a.presetIds=sel; await A.saveArchive(a); A.renderDetail(); M.toast('预设已更新'); }
  }else if(v==='resync'){
    const cs=await M.loadChars(),us=await M.loadIdentities();
    const c=cs.find(x=>x.id===a.charId),u=us.find(x=>x.id===a.userId);
    if(c) a.char=JSON.parse(JSON.stringify(c));
    if(u) a.user=JSON.parse(JSON.stringify(u));
    await A.saveArchive(a); A.renderDetail();
    M.toast(c?'资料已同步':'角色书中已找不到该角色');
  }else if(v==='export'){ A.exportText(a); }
  else if(v==='del'){
    if(!await M.confirm('删除整卷',`「${a.title}」及其下 ${A.entriesOf(a.id).length} 条内容都会被永久移除。`,'删除')) return;
    for(const e of A.entriesOf(a.id)) await M.db.del('entries',e.id);
    await M.db.del('archives',a.id);
    await A.reload(); M.toast('已删除'); M.back(); A.renderList(); M.Home.render();
  }
};

A.exportText=function(a){
  const L=[`《${a.title}》`,`角色：${a.char.name||''}　身份：${a.user?a.user.name:'未设定'}`,
    `建立：${M.fmtDate(a.createdAt)}`,''];
  A.entriesOf(a.id,'scene').sort((x,y)=>(x.index||0)-(y.index||0)).forEach(s=>{
    L.push('—— '+s.title+' ——');
    (s.turns||[]).forEach(t=>{ L.push((t.role==='user'?'【你】':'【叙事】')+'\n'+M.stripTags(t.text)); L.push(''); });
  });
  Object.keys(M.DERV).forEach(k=>{
    const es=A.entriesOf(a.id,k); if(!es.length) return;
    L.push(`—— ${M.DERV[k].name} ——`);
    es.forEach(e=>L.push(`· ${e.title}（${M.fmtDate(e.createdAt)}）\n${e.plain||M.stripTags(e.html||'')}\n`));
  });
  const blob=new Blob([L.join('\n')],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob),el=document.createElement('a');
  el.href=url; el.download=a.title+'.txt'; el.click();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
  M.toast('已导出');
};

A.showDervList=async function(type){
  const list=A.entriesOf(curArc.id,type);
  if(!list.length){
    const go=await M.sheet({title:M.DERV[type].name,desc:M.DERV[type].d+'。这一卷还没有生成过，现在生成一份？',
      confirm:true,okText:'去生成'});
    if(go) M.Extras.start(type,curArc.id);
    return;
  }
  const v=await M.sheet({title:M.DERV[type].name,desc:`共 ${list.length} 份`,plain:true,
    options:list.map(e=>({id:e.id,title:e.title,desc:M.fmtDate(e.createdAt)}))
      .concat([{id:'__new',title:'生成新的一份'}])});
  if(!v) return;
  if(v==='__new') return M.Extras.start(type,curArc.id);
  A.openEntry(v);
};

/* ═══════════ 阅读页 ═══════════ */
A.openEntry=function(id){
  const en=A.entryById(id); if(!en) return;
  if(en.type==='vlog') return M.Extras.openVlog(en);
  if(en.type==='if'&&Array.isArray(en.turns)){
    const arc=A.byId(en.archiveId);
    if(arc) return M.Play.open(arc,en,!en.turns.length);
  }
  curEntry=en; A.currentEntry=en;
  const arc=A.byId(en.archiveId), meta=M.DERV[en.type]||{};
  $('#readerTitle').innerHTML=esc(en.title)+`<em>${esc(meta.en||'READ')}</em>`;
  $('#readerBody').innerHTML=`
    <div class="read-hero">
      <div class="read-kick">${esc(meta.en||'')}</div>
      <div class="read-t">${esc(en.title)}</div>
      <div class="read-meta">${esc(arc?arc.title:'')} ｜ ${esc(M.fmtDate(en.createdAt))}</div>
      <div class="divider" style="margin-top:18px"><i></i><b></b><b></b><b></b><i></i></div>
    </div>
    <div id="readerMount"></div><div style="height:30px"></div>`;
  const mount=$('#readerMount');
  if(en.type==='feed')        M.Extras.renderFeed(mount,en,arc);
  else if(en.type==='mind')   M.Extras.renderMind(mount,en,arc);
  else if(en.type==='chron')  M.Extras.renderChron(mount,en,arc);
  else if(en.type==='relic')  M.Extras.renderRelic(mount,en,arc);
  else if(en.html){
    const h=document.createElement('div'); h.className='aiframe';
    const m=document.createElement('div'); m.className='mount'; h.appendChild(m);
    mount.appendChild(h); M.renderFrame(m,en.html);
  }else{
    mount.innerHTML=`<div class="aiframe"><div class="airaw">${esc(en.plain||'（无内容）')}</div></div>`;
  }
  M.nav('reader');
};

M.actions['reader-menu']=async()=>{
  const en=curEntry; if(!en) return;
  const v=await M.sheet({title:'内容操作',plain:true,options:[
    {id:'rename',title:'重命名'},
    {id:'regen',title:'重新生成',desc:'使用相同来源再生成一份'},
    {id:'del',title:'删除这份内容',danger:true},
  ]});
  if(v==='rename'){
    const t=await M.prompt('重命名',{input:{value:en.title}});
    if(t){ en.title=t; await A.saveEntry(en); A.openEntry(en.id); M.toast('已更名'); }
  }else if(v==='regen'){ M.Extras.regen(en); }
  else if(v==='del'){
    if(!await M.confirm('删除这份内容',en.title,'删除')) return;
    await M.db.del('entries',en.id); await A.reload();
    M.toast('已删除'); M.back(); A.renderDetail(); M.Home.render();
  }
};

})();
