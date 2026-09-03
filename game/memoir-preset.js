/* ═══════════════════════════════════════════════════════════
   回想录 · MEMOIR — preset.js
   ═══════════════════════════════════════════════════════════ */
(function(){
'use strict';
const M=window.Memoir,$=M.$,$$=M.$$,esc=M.esc;

const CATS=[
  {id:'style',   name:'文风',   en:'PROSE',     seal:'风',hint:'叙述语气、节奏、修辞密度、人称与时态'},
  {id:'world',   name:'世界观', en:'WORLD',     seal:'界',hint:'时代、地理、体系、规则、禁忌、社会结构'},
  {id:'charview',name:'CHAR视角',en:'CHAR VIEW',seal:'角',hint:'角色如何看待世界与用户，内心倾向与行为逻辑'},
  {id:'userview',name:'USER视角',en:'USER VIEW',seal:'我',hint:'用户在故事中的处境、立场、已知与未知'},
  {id:'plot',    name:'剧情',   en:'PLOT',      seal:'情',hint:'主线走向、阶段目标、伏笔、可触发事件'},
  {id:'rule',    name:'叙事规则',en:'RULE',     seal:'律',hint:'排版结构、每回合信息量、禁止事项、互动方式'},
  {id:'lore',    name:'补充设定',en:'LORE',     seal:'补',hint:'道具、组织、术语、配角、时间线等杂项'},
  {id:'opening', name:'开场',   en:'OPENING',   seal:'启',hint:'可复用的起笔方式与第一幕安排'},
  {id:'taboo',   name:'禁忌',   en:'TABOO',     seal:'禁',hint:'明确不希望出现的情节、写法、词汇与倾向'},
  {id:'tmpl',    name:'格式模板',en:'TEMPLATE', seal:'式',hint:'指定生成 HTML 的结构骨架与固定区块'},
];
M.PRESET_CATS=CATS;

const SEEDS=[
 {cat:'style',title:'冷调纪实',content:'第三人称限知视角，克制、精准、少形容词。用具体的物件、温度、声音与光线承载情绪，不直接写"她很难过"，而写她把杯子放回桌上时手停了半秒。段落偏短，句子有呼吸。对白简省，留白多于解释。'},
 {cat:'style',title:'细密抒情',content:'第三人称贴身视角，允许绵长的从句与通感。环境与心理互相渗透，善用季节、气味、旧物与光影。每段至少出现一次具体的感官细节。避免抒情空转，情绪必须落在动作或物件上。'},
 {cat:'style',title:'钝刀叙事',content:'语气平静到近乎冷漠，越是激烈的事越写得轻。大量使用短句与句号。不解释人物动机，只呈现行为。真正的重量藏在被省略的部分里，让读者自己补完。'},
 {cat:'rule',title:'标准叙事回合',content:'每一回合包含：场景与氛围的推进（不少于两段）、角色的具体动作与神态、至少一句台词、以及一个把主动权交还给用户的收束（一个悬置的动作、一个问题、或一个正在发生的变化）。禁止替用户决定其行为、心理与台词。禁止一次性推进过多时间。禁止元叙述。'},
 {cat:'rule',title:'交互式回合',content:'在叙事结尾提供 2 至 4 个可点击的行动选项，用 <button data-send="选项文字"> 实现；同时保留用户自由输入的可能，不要写"只能选择以下选项"。可附带一个可展开的"此刻的状态"面板，用自绘 CSS 呈现时间、地点、在场者与氛围。'},
 {cat:'rule',title:'状态面板',content:'每回合末尾附一个精致的状态卡，包含：当前时间与地点、{{char}} 的外显情绪与真实情绪（两者可以不同）、你们之间的距离感（用一句话而不是数值）、以及一条只有读者能看到的暗线提示。用 class="card" 承载，排版考究。'},
 {cat:'world',title:'当代都市',content:'现代都市背景，写字楼、地铁、便利店、雨天的车流。没有超自然要素，一切冲突来自人际关系、时间与选择。物价、交通、通讯方式均符合现实。'},
 {cat:'taboo',title:'基础禁忌',content:'不要出现：突然的第三方绑架或车祸等强行制造冲突的桥段；角色性格的无理由突变；用户替身式的完美迎合；解释性的旁白说明人物在想什么而不是让读者看出来；任何形式的读者称呼与元叙述。'},
 {cat:'opening',title:'从一个动作开始',content:'不要以环境描写或人物介绍开场。第一句必须是一个正在发生的具体动作或一句已经说到一半的话，把读者直接扔进场景中间，背景信息在后续自然渗出。'},
];

const P={}; M.Preset=P;
let list=[],curCat='style',editing=null;

P.init=async function(){
  list=await M.db.all('presets');
  if(!list.length && !localStorage.getItem('memoir_seeded_v2')){
    for(const s of SEEDS) await M.db.put('presets',{
      id:M.uid(),cat:s.cat,title:s.title,content:s.content,tags:[],
      enabled:true,weight:'normal',createdAt:Date.now(),updatedAt:Date.now()});
    localStorage.setItem('memoir_seeded_v2','1');
    list=await M.db.all('presets');
  }
  list.forEach(p=>{ if(p.enabled===undefined) p.enabled=true; if(!p.weight) p.weight='normal'; });
};
P.all=()=>list.slice();
P.byId=id=>list.find(p=>p.id===id);
P.byCat=c=>list.filter(p=>p.cat===c);
P.catOf=id=>CATS.find(c=>c.id===id)||CATS[0];

P.renderList=function(){
  const tabs=$('#presetTabs');
  tabs.innerHTML=CATS.map(c=>
    `<div class="tabh ${c.id===curCat?'on':''}" data-cat="${c.id}">${esc(c.name)}<b>${P.byCat(c.id).length}</b></div>`).join('');
  tabs.onclick=e=>{ const t=e.target.closest('.tabh'); if(!t) return;
    curCat=t.dataset.cat; P.renderList(); $('#presetList').scrollTop=0; };

  const cat=P.catOf(curCat);
  const items=P.byCat(curCat).sort((a,b)=>b.updatedAt-a.updatedAt);
  const box=$('#presetList');
  box.innerHTML=`
    <div class="sect" style="margin-top:2px"><span class="sect-cn">${esc(cat.name)}</span><i></i><span class="sect-en">${esc(cat.en)}</span></div>
    <div style="font-size:11.5px;line-height:1.9;color:var(--ink-5);margin:-6px 4px 18px">${esc(cat.hint)}</div>
    ${items.length?items.map(p=>`
      <div class="pcard ${p.enabled===false?'off':''}" data-pid="${p.id}">
        <div class="pcard-top">
          <div class="seal sm ${p.enabled===false?'open':''}">${esc(cat.seal)}</div>
          <div class="pcard-t">${esc(p.title)}</div>
          ${p.weight==='strong'?'<div class="tagpill solid">强调</div>':''}
          ${p.enabled===false?'<div class="tagpill">停用</div>':''}
        </div>
        <div class="pcard-d">${esc(p.content)}</div>
        <div class="pcard-meta">
          <span>${esc(M.fmtDate(p.updatedAt))}</span>
          ${(p.tags||[]).slice(0,3).map(t=>`<div class="tagpill">${esc(t)}</div>`).join('')}
          <span style="margin-left:auto">${p.content.length} 字</span>
        </div>
      </div>`).join('')
    :`<div class="empty"><div class="empty-mark"><b>${esc(cat.seal)}</b></div>
       <div class="empty-t">此类尚无预设</div>
       <div class="empty-d">建立一条，为生成提供更精准的素材</div></div>`}
    <div class="divider"><i></i><b></b><b></b><b></b><i></i></div>
    <div class="btn wide ghost" data-act="preset-new">新 建 ${esc(cat.name)}</div>
    <div style="height:24px"></div>`;
  box.onclick=e=>{ const c=e.target.closest('.pcard'); if(!c) return; P.openEdit(c.dataset.pid); };
};

P.openEdit=function(id){
  editing=id?P.byId(id):null;
  const cat=editing?editing.cat:curCat;
  const co=P.catOf(cat);
  $('#presetEditTitle').innerHTML=(editing?'编辑预设':'新建预设')+`<em>${esc(co.en)}</em>`;
  $('#presetEditBody').innerHTML=`
    <div class="field">
      <div class="field-label">分类<em>CATEGORY</em></div>
      <div class="chips" id="pcCats">${CATS.map(c=>
        `<div class="chip ${c.id===cat?'on':''}" data-c="${c.id}">${esc(c.name)}</div>`).join('')}</div>
    </div>
    <div class="field">
      <div class="field-label">标题<em>TITLE</em></div>
      <input class="inp" id="pcTitle" placeholder="例：冷调纪实" value="${esc(editing?editing.title:'')}"/>
    </div>
    <div class="field">
      <div class="field-label">内容<em>CONTENT</em><span class="r" id="pcCount">${editing?editing.content.length:0}</span></div>
      <textarea class="txa" id="pcContent" style="min-height:280px" placeholder="${esc(co.hint)}">${esc(editing?editing.content:'')}</textarea>
    </div>
    <div class="field">
      <div class="field-label">占位符<em>PLACEHOLDER</em></div>
      <div class="chips" id="pcVars">
        <div class="chip" data-v="{{char}}">{{char}} 角色名</div>
        <div class="chip" data-v="{{user}}">{{user}} 身份名</div>
        <div class="chip" data-v="{{relation}}">{{relation}} 关系</div>
        <div class="chip" data-v="{{callUser}}">{{callUser}} 称呼</div>
      </div>
      <div style="font-size:10.5px;line-height:1.8;color:var(--ink-5);margin:9px 4px 0">点击插入。装配提示词时会自动替换为当前这一卷的实际内容。</div>
    </div>
    <div class="field">
      <div class="field-label">关键词<em>TAGS · 逗号分隔</em></div>
      <input class="inp" id="pcTags" placeholder="克制, 第三人称, 短句" value="${esc(editing&&editing.tags?editing.tags.join(', '):'')}"/>
    </div>
    <div class="rows">
      <div class="row"><div class="row-t">启用</div><div class="switch ${!editing||editing.enabled!==false?'on':''}" id="pcOn"><i></i></div></div>
      <div class="row"><div class="row-t">强调权重</div><div class="switch ${editing&&editing.weight==='strong'?'on':''}" id="pcW"><i></i></div></div>
    </div>
    <div style="font-size:10.5px;line-height:1.8;color:var(--ink-5);margin:10px 4px 0">开启强调后，这条预设在提示词中会被单独标注为"必须严格遵守"。</div>
    ${editing?`<div class="divider"><i></i><b></b><b></b><b></b><i></i></div>
      <div class="btn wide ghost" data-act="preset-dup">复 制 一 份</div>
      <div style="height:10px"></div>
      <div class="btn wide ghost" data-act="preset-del" style="color:#8f2b2b">删 除 这 条</div>`:''}
    <div style="height:26px"></div>`;
  $('#pcCats').onclick=e=>{ const c=e.target.closest('.chip'); if(!c) return;
    $$('#pcCats .chip').forEach(x=>x.classList.remove('on')); c.classList.add('on'); };
  $('#pcVars').onclick=e=>{
    const c=e.target.closest('.chip'); if(!c) return;
    const ta=$('#pcContent'), v=c.dataset.v, s=ta.selectionStart||ta.value.length;
    ta.value=ta.value.slice(0,s)+v+ta.value.slice(ta.selectionEnd||s);
    ta.focus(); ta.selectionStart=ta.selectionEnd=s+v.length;
    $('#pcCount').textContent=ta.value.length;
  };
  $('#pcContent').oninput=e=>$('#pcCount').textContent=e.target.value.length;
  ['pcOn','pcW'].forEach(id=>$('#'+id).onclick=e=>e.currentTarget.classList.toggle('on'));
  M.nav('preset-edit');
};

M.actions['preset-new']=()=>P.openEdit(null);

M.actions['preset-save']=async()=>{
  const title=$('#pcTitle').value.trim(), content=$('#pcContent').value.trim();
  if(!title){ M.toast('请填写标题'); $('#pcTitle').focus(); return; }
  if(!content){ M.toast('请填写内容'); $('#pcContent').focus(); return; }
  const cat=$('#pcCats .chip.on').dataset.c;
  const tags=$('#pcTags').value.split(/[,，]/).map(s=>s.trim()).filter(Boolean);
  const enabled=$('#pcOn').classList.contains('on');
  const weight=$('#pcW').classList.contains('on')?'strong':'normal';
  const obj=editing
    ?Object.assign({},editing,{title,content,cat,tags,enabled,weight,updatedAt:Date.now()})
    :{id:M.uid(),title,content,cat,tags,enabled,weight,createdAt:Date.now(),updatedAt:Date.now()};
  await M.db.put('presets',obj);
  list=await M.db.all('presets'); curCat=cat;
  M.toast('预设已保存'); M.back(); P.renderList(); M.Home.render();
};

M.actions['preset-dup']=async()=>{
  if(!editing) return;
  const o=Object.assign({},editing,{id:M.uid(),title:editing.title+' 副本',
    createdAt:Date.now(),updatedAt:Date.now()});
  await M.db.put('presets',o); list=await M.db.all('presets');
  M.toast('已复制'); M.back(); P.renderList();
};

M.actions['preset-del']=async()=>{
  if(!editing) return;
  if(!await M.confirm('删除这条预设',`「${editing.title}」将被永久移除，已建立的存档不受影响。`,'删除')) return;
  await M.db.del('presets',editing.id); list=await M.db.all('presets');
  M.toast('已删除'); M.back(); P.renderList(); M.Home.render();
};

M.actions['preset-menu']=async()=>{
  const v=await M.sheet({title:'预设库',plain:true,options:[
    {id:'new',title:'新建预设'},
    {id:'export',title:'导出全部预设',desc:`共 ${list.length} 条，保存为 JSON 文件`},
    {id:'import',title:'从文件导入',desc:'追加导入，不会覆盖现有预设'},
    {id:'enableAll',title:'启用本类全部'},
    {id:'disableAll',title:'停用本类全部'},
    {id:'seed',title:'补充内置示例',desc:'重新写入一组示例预设'},
  ]});
  if(v==='new') P.openEdit(null);
  else if(v==='export') P.exportAll();
  else if(v==='import') P.importFile();
  else if(v==='enableAll'||v==='disableAll'){
    const on=v==='enableAll';
    for(const p of P.byCat(curCat)){ p.enabled=on; p.updatedAt=Date.now(); await M.db.put('presets',p); }
    list=await M.db.all('presets'); P.renderList();
    M.toast(on?'本类已全部启用':'本类已全部停用');
  }else if(v==='seed'){
    for(const s of SEEDS) await M.db.put('presets',{id:M.uid(),cat:s.cat,title:s.title,
      content:s.content,tags:[],enabled:true,weight:'normal',createdAt:Date.now(),updatedAt:Date.now()});
    list=await M.db.all('presets'); P.renderList(); M.Home.render(); M.toast('已补充示例预设');
  }
};

P.exportAll=function(){
  const blob=new Blob([JSON.stringify({app:'memoir',kind:'presets',
    exportedAt:Date.now(),items:list},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url; a.download='回想录-预设.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
  M.toast('已导出 '+list.length+' 条预设');
};

P.importFile=function(){
  const inp=document.createElement('input');
  inp.type='file'; inp.accept='application/json,.json';
  inp.onchange=async()=>{
    const f=inp.files&&inp.files[0]; if(!f) return;
    const txt=await f.text();
    let data=null; try{ data=JSON.parse(txt); }catch(e){}
    const items=Array.isArray(data)?data:(data&&Array.isArray(data.items)?data.items:null);
    if(!items) return M.alert('导入失败','这个文件不是回想录的预设导出文件。');
    let n=0;
    for(const it of items){
      if(!it||!it.title||!it.content) continue;
      await M.db.put('presets',{id:M.uid(),
        cat:CATS.some(c=>c.id===it.cat)?it.cat:'lore',
        title:String(it.title).slice(0,60),content:String(it.content),
        tags:Array.isArray(it.tags)?it.tags:[],enabled:it.enabled!==false,
        weight:it.weight==='strong'?'strong':'normal',
        createdAt:Date.now(),updatedAt:Date.now()});
      n++;
    }
    list=await M.db.all('presets'); P.renderList(); M.Home.render();
    M.toast('已导入 '+n+' 条预设');
  };
  inp.click();
};

/* 建档页选择器 */
P.pickerHtml=function(selected){
  const html=CATS.map(c=>{
    const items=P.byCat(c.id).filter(p=>p.enabled!==false);
    if(!items.length) return '';
    return `<div class="field">
      <div class="field-label">${esc(c.name)}<em>${esc(c.en)}</em>
        <span class="r">${items.filter(p=>selected.includes(p.id)).length}/${items.length}</span></div>
      <div class="chips" data-pcat="${c.id}">${items.map(p=>
        `<div class="chip ${selected.includes(p.id)?'on':''}" data-pid="${p.id}">${esc(p.title)}</div>`).join('')}</div>
    </div>`;
  }).join('');
  return html||`<div style="font-size:12.5px;line-height:2;color:var(--ink-5);padding:8px 4px">
    预设库还是空的。可以先直接开始，之后再回到预设库补充文风与世界观；模型会依据角色设定自建一套并保持稳定。</div>`;
};

/* 装配为提示词（含占位符替换与强调标注） */
P.compose=function(ids,ctx){
  const chosen=(ids||[]).map(id=>P.byId(id)).filter(p=>p&&p.enabled!==false);
  if(!chosen.length) return '';
  const fill=s=>String(s||'')
    .replace(/\{\{char\}\}/g,(ctx&&ctx.char)||'该角色')
    .replace(/\{\{user\}\}/g,(ctx&&ctx.user)||'你')
    .replace(/\{\{relation\}\}/g,(ctx&&ctx.relation)||'当前关系')
    .replace(/\{\{callUser\}\}/g,(ctx&&ctx.callUser)||'你');
  const by={};
  chosen.forEach(p=>{(by[p.cat]=by[p.cat]||[]).push(p);});
  return CATS.filter(c=>by[c.id]).map(c=>
    `【${c.name}】\n`+by[c.id].map(p=>
      `· ${p.title}${p.weight==='strong'?'（必须严格遵守）':''}：${fill(p.content)}`).join('\n')
  ).join('\n\n');
};

})();
