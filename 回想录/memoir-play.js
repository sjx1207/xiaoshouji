/* ═══════════════════════════════════════════════════════════
   回想录 · MEMOIR — play.js
   ═══════════════════════════════════════════════════════════ */
(function(){
'use strict';
const M=window.Memoir,$=M.$,$$=M.$$,esc=M.esc;
const P={}; M.Play=P;

let arc=null,scene=null,busy=false;
const MODES=[
  {id:'narr', name:'叙事',d:'沉浸式长文叙述，结尾停在一个悬置的瞬间'},
  {id:'inter',name:'交互',d:'叙述之后给出可点击的行动分支，仍可自由输入'},
  {id:'scene',name:'剧本',d:'偏镜头与台词的写法，节奏更快'},
  {id:'slow', name:'细描',d:'放慢时间，专注一个场景内的细节与心理'},
];
const LENS=[
  {id:'short',name:'精简',range:'约 300–500 字',tok:6000},
  {id:'std',  name:'标准',range:'约 500–900 字',tok:12000},
  {id:'long', name:'铺陈',range:'约 900–1500 字',tok:20000},
];
let mode='inter', len='std';

P.init=function(){
  const ta=$('#playInput');
  ta.addEventListener('input',()=>{ ta.style.height='auto';
    ta.style.height=Math.min(ta.scrollHeight,120)+'px'; });
  ta.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){ e.preventDefault(); send(); }});
  M.onFrameSend=txt=>{ if(busy) return; $('#playInput').value=txt; send(); };
};

P.open=function(a,s,autoStart){
  arc=a; scene=s; M.Archive.current=a;
  const isBranch=s.type==='if';
  $('#playTitle').innerHTML=esc(isBranch?s.title:a.title)+
    `<em>${esc(isBranch?'DIVERGENCE':String(s.title).replace(/^.*· /,''))}</em>`;
  $('#playModeLabel').textContent=(MODES.find(m=>m.id===mode)||MODES[1]).name;
  $('#playLenLabel').textContent=(LENS.find(l=>l.id===len)||LENS[1]).name;
  renderCast();
  M.nav('play');
  renderAll();
  if(autoStart&&(!s.turns||!s.turns.length)) setTimeout(()=>generate(null,false),300);
};

function renderCast(){
  const c=arc.char,u=arc.user;
  $('#playCast').innerHTML=
    M.avatarHtml(c)+`<span class="cast-n">${esc(c.name||'')}</span>`+
    `<div class="cast-x"></div>`+
    (u?M.avatarHtml(u,'round')+`<span class="cast-n">${esc(u.name||'')}</span>`
       :`<span class="cast-n">你</span>`)+
    `<span class="cast-r">${esc(scene.type==='if'?'歧路':'正篇')}</span>`;
}

function renderAll(){
  const box=$('#playStream'); box.innerHTML='';
  (scene.turns||[]).forEach((t,i)=>appendTurn(t,i,false));
  scrollBottom(true); updateHint();
}
function scrollBottom(instant){
  const sc=$('#playScroll');
  requestAnimationFrame(()=>sc.scrollTo({top:sc.scrollHeight,behavior:instant?'auto':'smooth'}));
}

function appendTurn(t,idx,anim){
  const box=$('#playStream');
  const w=document.createElement('div');
  w.className='turn'; w.dataset.idx=idx;
  if(!anim) w.style.animation='none';
  if(t.role==='user'){
    w.innerHTML=`<div class="uwrap"><div class="usay ${t.director?'director':''}">${esc(t.text)}</div></div>`;
  }else{
    const n=(scene.turns||[]).slice(0,idx+1).filter(x=>x.role==='ai').length;
    w.innerHTML=`
      <div class="turn-tag"><span>SCENE ${String(n).padStart(2,'0')}</span>
        <b>${esc((MODES.find(m=>m.id===t.mode)||{}).name||'')}</b><i></i></div>
      <div class="aiframe">
        <div class="mount"></div>
        <div class="aibar">
          <div class="mini" data-mini="regen" data-i="${idx}">重生成</div>
          <div class="mini" data-mini="copy" data-i="${idx}">复制</div>
          <div class="mini" data-mini="drop" data-i="${idx}">删除</div>
          <div class="sp"></div><div class="stamp">${esc(M.fmtDate(t.ts))}</div>
        </div>
        <div class="brk tl"></div><div class="brk tr"></div>
      </div>`;
    const mount=w.querySelector('.mount');
    if(t.html) M.renderFrame(mount,t.html);
    else mount.innerHTML=`<div class="airaw">${esc(t.text||'')}</div>`;
    w.querySelector('.aibar').onclick=e=>{
      const b=e.target.closest('[data-mini]'); if(!b) return;
      const i=+b.dataset.i;
      if(b.dataset.mini==='regen') regenAt(i);
      if(b.dataset.mini==='copy')  copyTurn(i);
      if(b.dataset.mini==='drop')  dropTurn(i);
    };
  }
  box.appendChild(w);
  return w;
}

function updateHint(){
  const n=(scene.turns||[]).filter(t=>t.role==='ai').length;
  const m=MODES.find(x=>x.id===mode), l=LENS.find(x=>x.id===len);
  $('#playHint').textContent=`${m.name} · ${l.name} · 第 ${n} 回合`;
}

/* ═══════════ 提示词 ═══════════ */
function systemPrompt(){
  const c=arc.char,u=arc.user;
  const ctx={char:c.name,user:u?u.name:'你',relation:c.relation||'',callUser:c.callUser||''};
  const presets=M.Preset.compose(arc.presetIds||[],ctx);
  const L=LENS.find(x=>x.id===len);
  const modeText={
    narr :`本回合以沉浸式叙述为主，篇幅 ${L.range}，结尾停在一个悬置的瞬间，把主动权交还给用户。`,
    inter:`本回合先完成叙述（${L.range}），最后给出 2 至 4 个行动分支，用 <button data-send="行动描述">…</button> 实现，点击即代表用户做出该行动。分支必须具体、彼此指向不同的后果，不要写成同义重复。同时明确保留用户自由输入的空间。`,
    scene:`本回合以剧本化写法推进：镜头式的场景提示、密集的台词、简短的动作提示，节奏偏快，篇幅 ${L.range}。`,
    slow :`本回合放慢时间，只推进很短的一段现实时间，专注于感官细节、微表情与心理层次，篇幅 ${L.range}。`,
  }[mode];

  return `你是一位极为出色的中文互动叙事作者，正在为 App「回想录」生成一段可交互的剧情内容。

===== 第一优先级：角色（CHAR）设定，必须精准还原，不得篡改 =====
${M.charBlock(c)||'（无）'}

===== 第一优先级：用户（USER）身份设定，必须精准使用，不得替其做主 =====
${u?M.userBlock(u):'（用户未设定身份档，请以"你"作为第二人称代称，不要凭空捏造用户的姓名、外貌与背景。）'}

以上两块信息的优先级高于一切其他设定。当预设、剧情走向或你的写作习惯与之冲突时，一律以上述角色与身份设定为准。
${c.callUser?`${c.name} 称呼用户时使用「${c.callUser}」。`:''}

===== 预设素材 =====
${presets||'（用户未选择预设，请依据角色设定自行建立一致的文风与世界观，并在后续保持稳定。）'}

===== 本卷 =====
卷名：${arc.title}
${arc.seed?'开场引导：'+arc.seed:''}
${scene.branch?`
===== 这是一条「歧路」（IF 线），必须遵守 =====
原本的剧情走到了这里：${scene.branch.original}
真正的分歧点：${scene.branch.pivot}
分歧发生的位置：${scene.branch.when}
而在这条线里，改变的是：${scene.branch.alternative}

· 从分歧的那一刻重新起笔，不要复述分歧之前的内容，也不要总结原线。
· 分歧之前发生过的一切依然成立，人物关系、既有事实、性格不变；只有从这一刻起，后果不同。
· 第一回合要让读者立刻感到"这里不一样了"，并让改变自然地滚出新的后果。
· 后续回合继续沿这条新线推进，绝不许绕回原线的结局。

原线素材（仅供保持事实一致，不要照抄）：
${scene.branch.summary}
`:''}
===== 叙事要求 =====
1. 以第三人称叙述，用户以第二人称"你"出现。绝对不要替用户编造其内心活动、台词与决定，只描写用户可被观察到的既成事实。
2. ${modeText}
3. 保持连贯：延续此前已发生的事实、时间、地点、在场者与情绪状态，不要重置场景。
4. 不要写任何元叙述（例如"接下来请你选择""作为AI"），不要复述用户的输入，不要总结上文。
5. 内容分级保持在成年读者可接受的文学范围内，情绪与张力可以浓烈，但不做露骨描写。

${M.STYLE_RULES}

===== 结构建议（可自由发挥，但需保持华丽考究的观感） =====
· 可用一个细字距的小标签条（时间 / 地点 / 天气）开场，而不是粗线框。
· 叙述段落用 <p>；旁白与心理可用 class="narr"；台词用 <div class="line"><span class="speaker">名字</span>正文</div>。
· 需要强调的物件、状态、线索，用 class="card" 小卡片承载。
· 交互模式下的分支按钮统一用 <button data-send="…">。

现在输出这一回合的 HTML 片段。`;
}

function historyMessages(){
  const turns=scene.turns||[];
  const keep=turns.slice(-M.cfg.depth*2);
  const aiIdx=[]; keep.forEach((t,i)=>{ if(t.role==='ai') aiIdx.push(i); });
  const full=new Set(aiIdx.slice(-M.cfg.htmlDepth));
  return keep.map((t,i)=>t.role==='user'
    ?{role:'user',content:t.text}
    :{role:'assistant',content:full.has(i)&&t.html?t.html:M.stripTags(t.text||'').slice(0,1500)});
}

/* ═══════════ 生成 ═══════════ */
async function generate(userText,isRegen){
  if(busy) return;
  const conf=M.apiConf();
  if(!conf.baseUrl||!conf.apiKey||!conf.model){
    return M.alert('尚未配置模型','请先到「设置 · AI 模型」填写接口地址与密钥并选择一个模型。回想录会自动读取那里的配置。');
  }
  busy=true; $('.send').classList.add('busy');

  if(userText){
    const t={role:'user',text:userText,ts:Date.now()};
    scene.turns.push(t); appendTurn(t,scene.turns.length-1,true); scrollBottom();
  }

  const msgs=[{role:'system',content:systemPrompt()}].concat(historyMessages());
  if(!userText&&!scene.turns.length){
    msgs.push({role:'user',content:scene.seed
      ?`请从这里开场：${scene.seed}`
      :'请生成这段故事的开场。若角色设定中存在开场白，请将其自然地融入其中。'});
  }else if(!userText&&isRegen!==true){
    msgs.push({role:'user',content:'请继续推进剧情。'});
  }

  try{
    const raw=await M.generate(msgs,{
      title:scene.type==='if'?'正在分岔':'正在回想',
      sub:'读取角色与身份',
      maxTokens:Math.max(M.cfg.maxTokens,(LENS.find(l=>l.id===len)||{}).tok||8000),
    });
    const html=M.pickHtml(raw);
    const turn={role:'ai',html,text:M.stripTags(html),ts:Date.now(),mode,len};
    scene.turns.push(turn);
    appendTurn(turn,scene.turns.length-1,true);
    await M.Archive.saveEntry(scene);
    await M.Archive.saveArchive(arc);
    scrollBottom(); updateHint();
    if(/未命名/.test(scene.title)) autoTitle();
  }catch(e){
    if(e.name==='AbortError') M.toast('已中止');
    else M.alert('生成失败',String(e.message||e).slice(0,240));
  }finally{
    busy=false; $('.send').classList.remove('busy');
  }
}

async function autoTitle(){
  try{
    const last=[...scene.turns].reverse().find(t=>t.role==='ai'); if(!last) return;
    const r=await M.chat([
      {role:'system',content:'你为一段中文故事拟一个标题。要求：4 到 10 个汉字，含蓄、有画面感，不使用书名号、引号、标点与任何符号。只输出标题本身。'},
      {role:'user',content:M.stripTags(last.text).slice(0,900)}],
      {maxTokens:60,temperature:.9,stream:false});
    const t=M.deEmoji(r).replace(/[《》""''。，、！？.\s]/g,'').slice(0,12);
    if(t){
      scene.title=scene.type==='if'?scene.title.replace(/·.*$/,'· '+t)
        :`第${M.cjkNum(scene.index||1)}段 · ${t}`;
      await M.Archive.saveEntry(scene);
      $('#playTitle').innerHTML=esc(arc.title)+`<em>${esc(t)}</em>`;
    }
  }catch(e){}
}

function send(){
  const ta=$('#playInput'), v=ta.value.trim();
  if(!v) return M.toast('写点什么再发送');
  if(busy) return M.toast('正在生成中');
  ta.value=''; ta.style.height='auto';
  generate(v,false);
}

/* ═══════════ 动作 ═══════════ */
M.actions['play-send']=()=>send();

M.actions['play-regen']=async()=>{
  if(busy) return M.toast('正在生成中');
  const turns=scene.turns||[];
  const last=[...turns].map((t,i)=>({t,i})).reverse().find(x=>x.t.role==='ai');
  if(!last) return M.toast('还没有可重生成的内容');
  if(!await M.confirm('重新生成上一回合','当前这一回合的内容会被替换。','重生成')) return;
  turns.splice(last.i,1);
  await M.Archive.saveEntry(scene); renderAll(); generate(null,true);
};

M.actions['play-undo']=async()=>{
  if(busy) return M.toast('正在生成中');
  const turns=scene.turns||[];
  if(!turns.length) return M.toast('没有可回退的内容');
  const v=await M.sheet({title:'回退',desc:'回退后的内容不可恢复',plain:true,options:[
    {id:'1',title:'退回一回合',desc:'移除最近一次生成与你的这次发言'},
    {id:'n',title:'退回到指定回合',desc:'选择一个节点，之后的内容全部移除'},
    {id:'clear',title:'清空这一段',desc:'保留存档，仅清空本段内容',danger:true},
  ]});
  if(!v) return;
  if(v==='1'){
    while(turns.length&&turns[turns.length-1].role==='ai') turns.pop();
    if(turns.length&&turns[turns.length-1].role==='user') turns.pop();
  }else if(v==='n'){
    const ai=turns.map((t,i)=>({t,i})).filter(x=>x.t.role==='ai');
    const p=await M.sheet({title:'退回到',plain:true,
      options:ai.map((x,k)=>({id:String(x.i),title:`第 ${k+1} 回合`,
        desc:M.stripTags(x.t.text).slice(0,44)}))});
    if(p==null) return;
    turns.length=+p+1;
  }else if(v==='clear'){
    if(!await M.confirm('清空这一段',scene.title,'清空')) return;
    turns.length=0;
  }
  await M.Archive.saveEntry(scene); renderAll(); updateHint(); M.toast('已回退');
};

M.actions['play-mode']=async()=>{
  const v=await M.sheet({title:'叙事模式',desc:'影响这一回合的写法与交互形式',
    options:MODES.map(m=>({id:m.id,title:m.name,desc:m.d})),selected:mode});
  if(!v) return;
  mode=v; $('#playModeLabel').textContent=MODES.find(m=>m.id===v).name;
  updateHint(); M.toast('已切换为'+MODES.find(m=>m.id===v).name+'模式');
};

M.actions['play-len']=async()=>{
  const v=await M.sheet({title:'篇幅',desc:'同时影响提示词字数要求与生成上限',
    options:LENS.map(l=>({id:l.id,title:l.name,desc:l.range,right:l.tok+''})),selected:len});
  if(!v) return;
  len=v; $('#playLenLabel').textContent=LENS.find(l=>l.id===v).name; updateHint();
};

M.actions['play-note']=async()=>{
  const v=await M.prompt('旁白引导',{
    desc:'这段文字作为导演指令传给模型，不会作为你的发言出现在故事里',
    input:{multiline:true,placeholder:'例：让她终于说出那句一直没说的话；或：把时间跳到三天后的清晨'}});
  if(!v) return;
  if(busy) return M.toast('正在生成中');
  scene.turns.push({role:'user',text:'【导演指令，不作为用户发言】'+v,ts:Date.now(),director:true});
  appendTurn(scene.turns[scene.turns.length-1],scene.turns.length-1,true);
  scrollBottom();
  generate(null,true);
};

M.actions['play-menu']=async()=>{
  const opts=[
    {id:'rename',title:'重命名这一段',desc:scene.title},
    {id:'auto',title:'让 AI 重新拟定标题'},
  ].concat(Object.keys(M.DERV).filter(k=>k!=='if'||scene.type!=='if').map(k=>
    ({id:'gen-'+k,title:'生成'+M.DERV[k].name,desc:M.DERV[k].d})))
   .concat([
    {id:'detail',title:'回到存档详情'},
    {id:'del',title:'删除这一段',danger:true},
  ]);
  const v=await M.sheet({title:'本段',plain:true,options:opts});
  if(!v) return;
  if(v==='rename'){
    const t=await M.prompt('重命名',{input:{value:scene.title}});
    if(t){ scene.title=t; await M.Archive.saveEntry(scene);
      $('#playTitle').innerHTML=esc(arc.title)+`<em>${esc(t)}</em>`; }
  }else if(v==='auto'){ M.toast('拟定中'); autoTitle(); }
  else if(v.startsWith('gen-')){ M.Extras.start(v.slice(4),arc.id,scene.id); }
  else if(v==='detail'){ M.Archive.openDetail(arc.id); }
  else if(v==='del'){
    if(!await M.confirm('删除这一段',scene.title,'删除')) return;
    await M.db.del('entries',scene.id); await M.Archive.reload();
    M.toast('已删除'); M.Archive.openDetail(arc.id);
  }
};

function copyTurn(i){
  const t=scene.turns[i]; if(!t) return;
  const txt=M.stripTags(t.text||'');
  if(navigator.clipboard) navigator.clipboard.writeText(txt)
    .then(()=>M.toast('已复制')).catch(()=>M.toast('复制失败'));
  else M.toast('当前环境不支持复制');
}
async function dropTurn(i){
  if(!await M.confirm('删除这一回合','之后的内容会保留，但上下文可能出现断裂。','删除')) return;
  scene.turns.splice(i,1); await M.Archive.saveEntry(scene); renderAll(); updateHint();
}
async function regenAt(i){
  if(busy) return M.toast('正在生成中');
  if(!await M.confirm('从这里重新生成','这一回合及其之后的所有内容都会被移除。','重生成')) return;
  scene.turns.length=i; await M.Archive.saveEntry(scene); renderAll(); generate(null,true);
}

P.getArc=()=>arc; P.getScene=()=>scene;

})();