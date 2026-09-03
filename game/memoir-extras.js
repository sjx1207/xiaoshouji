/* ═══════════════════════════════════════════════════════════
   回想录 · MEMOIR — extras.js
   浮光 · 叩问 · 歧路 · 回声 · 心迹 · 年谱 · 物证
   ═══════════════════════════════════════════════════════════ */
(function(){
'use strict';
const M=window.Memoir,$=M.$,$$=M.$$,esc=M.esc;
const E={}; M.Extras=E;
const D=M.DERV;

let pick=null;
E.init=function(){};

/* ═══════════ 来源选择 ═══════════ */
E.start=async function(type,archiveId,sceneId){
  await M.Archive.reload();
  const arcs=M.Archive.all();
  if(!arcs.length) return M.alert(D[type].name,'还没有任何存档。先立一卷并跑一段剧情，衍生玩法才有素材可用。');
  pick={type,
    archiveId:archiveId||arcs.slice().sort((a,b)=>b.updatedAt-a.updatedAt)[0].id,
    sceneId:sceneId||null,
    scope:(type==='if')?'one':(sceneId?'one':(type==='chron'?'all':'one')),
    opts:defOpts(type)};
  M.nav('pick'); renderPick();
};

function defOpts(t){
  return {vlog:{length:'std',voice:'film'},
          qa:{count:8,angle:'mix'},
          feed:{platform:'moments',posts:4},
          mind:{who:'char',pages:4},
          chron:{grain:'beat'},
          relic:{count:5},
          if:{}}[t]||{};
}

function renderPick(){
  const t=pick.type,meta=D[t];
  $('#pickTitle').innerHTML=esc(meta.name)+`<em>${esc(meta.en)}</em>`;
  const arcs=M.Archive.all().slice().sort((a,b)=>b.updatedAt-a.updatedAt);
  const scenes=M.Archive.entriesOf(pick.archiveId,'scene')
    .filter(s=>(s.turns||[]).some(x=>x.role==='ai'))
    .sort((a,b)=>(a.index||0)-(b.index||0));
  if(pick.scope==='one'&&!pick.sceneId&&scenes.length) pick.sceneId=scenes[scenes.length-1].id;

  $('#pickBody').innerHTML=`
    <div class="plate" style="padding:22px 20px;margin-bottom:6px">
      <div class="brk tl"></div><div class="brk tr"></div><div class="brk bl"></div><div class="brk br"></div>
      <div style="display:flex;align-items:center;gap:15px">
        <div class="seal" style="width:46px;height:46px;font-size:15px">${esc(meta.seal)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-family:var(--mono);font-size:7px;letter-spacing:.4em;color:var(--ink-5)">${esc(meta.en)}</div>
          <div style="margin-top:8px;font-family:var(--song);font-size:22px;font-weight:600;letter-spacing:.26em;color:var(--ink)">${esc(meta.name)}</div>
        </div>
      </div>
      <div style="margin-top:14px;font-size:12px;line-height:2;color:var(--ink-4)">${esc(meta.d)}。${esc(hintOf(t))}</div>
    </div>

    <div class="sect"><span class="sect-cn">取卷</span><i></i><span class="sect-en">RECORD</span></div>
    <div class="portraits" id="pkArcs">${arcs.map(a=>`
      <div class="pt ${a.id===pick.archiveId?'on':''}" data-id="${a.id}">
        <div class="pt-seal">取</div>
        <div class="pt-av">${M.avatarHtml(a.char,'lg')}</div>
        <div class="pt-n">${esc(a.title)}</div>
        <div class="pt-r">${esc(a.char.name||'')}</div>
        <div class="pt-tags"><i>${M.Archive.entriesOf(a.id,'scene').length} 段</i></div>
      </div>`).join('')}</div>

    <div class="sect"><span class="sect-cn">范围</span><i></i><span class="sect-en">SCOPE</span></div>
    ${t==='if'?`<div style="font-size:11.5px;line-height:2;color:var(--ink-5);margin:-4px 4px 14px">
      歧路只能从单独一段剧情分出，否则分歧便失去了意义。</div>`
    :`<div class="chips" id="pkScope" style="margin-bottom:16px">
        <div class="chip ${pick.scope==='one'?'on':''}" data-s="one">某一段</div>
        <div class="chip ${pick.scope==='all'?'on':''}" data-s="all">整卷</div>
      </div>`}

    ${(pick.scope==='one'||t==='if')?(scenes.length?`<div id="pkScenes">${scenes.map(s=>`
      <div class="scn ${s.id===pick.sceneId?'on':''}" data-sid="${s.id}">
        <div class="scn-i">${M.cjkNum(s.index||1)}</div>
        <div class="scn-b">
          <div class="scn-t">${esc(s.title)}</div>
          <div class="scn-d">${esc(M.stripTags(((s.turns||[]).filter(x=>x.role==='ai').pop()||{}).text||'').slice(0,80))}</div>
          <div class="scn-m"><span class="tagpill">${(s.turns||[]).filter(x=>x.role==='ai').length} 回合</span></div>
        </div>
      </div>`).join('')}</div>`
      :`<div style="font-size:12px;color:var(--ink-5);padding:8px 4px">这一卷还没有已生成内容的剧情段落。</div>`)
      :`<div style="font-size:11.5px;line-height:2;color:var(--ink-5);margin:-4px 4px 14px">
         将读取该卷下全部 ${scenes.length} 段剧情作为素材。</div>`}

    ${optsHtml(t)}
    <div style="height:14px"></div>`;

  $('#pickFoot').innerHTML=`<div class="btn dark" data-act="pick-go">开 始 生 成</div>`;

  $('#pkArcs').onclick=e=>{ const el=e.target.closest('.pt'); if(!el) return;
    pick.archiveId=el.dataset.id; pick.sceneId=null; renderPick(); };
  const sc=$('#pkScope');
  if(sc) sc.onclick=e=>{ const el=e.target.closest('.chip'); if(!el) return;
    pick.scope=el.dataset.s; renderPick(); };
  const ss=$('#pkScenes');
  if(ss) ss.onclick=e=>{ const el=e.target.closest('.scn'); if(!el) return;
    pick.sceneId=el.dataset.sid; renderPick(); };
  const op=$('#pkOpts');
  if(op) op.onclick=e=>{
    const el=e.target.closest('.chip'); if(!el) return;
    const k=el.parentElement.dataset.k;
    $$(`#pkOpts [data-k="${k}"] .chip`).forEach(x=>x.classList.remove('on'));
    el.classList.add('on');
    const v=el.dataset.v;
    pick.opts[k]=(v!==''&&!isNaN(+v))?+v:v;
  };
}

function hintOf(t){
  return {vlog:'播放时未到的帧会被锁住，播到才解锁',
    qa:'生成的是可展开收起的问答卡',
    if:'会开出一条独立的分支存档，可继续交互推进',
    feed:'评论只来自剧情与关系网络中真实存在的人',
    mind:'只写没说出口的那部分，不重复叙事已写过的内容',
    chron:'整卷视角下最有用的一种，用来回答"我们是怎么走到这一步的"',
    relic:'按博物馆藏品标签的方式列出'}[t]||'';
}

function optsHtml(t){
  const grp=(k,label,en,items)=>`
    <div class="field">
      <div class="field-label">${label}<em>${en}</em></div>
      <div class="chips" data-k="${k}">${items.map(i=>
        `<div class="chip ${String(pick.opts[k])===String(i.v)?'on':''}" data-v="${i.v}">${esc(i.t)}</div>`).join('')}</div>
    </div>`;
  let h=`<div class="sect"><span class="sect-cn">参数</span><i></i><span class="sect-en">OPTIONS</span></div><div id="pkOpts">`;
  if(t==='vlog'){
    h+=grp('length','片长','DURATION',[{v:'short',t:'短片 · 约一分钟'},{v:'std',t:'标准 · 约两分半'},{v:'long',t:'完整 · 约五分钟'}]);
    h+=grp('voice','影像语气','TONE',[{v:'film',t:'电影感'},{v:'diary',t:'私影像'},{v:'doc',t:'纪录片'}]);
  }else if(t==='qa'){
    h+=grp('count','题量','COUNT',[{v:5,t:'五题'},{v:8,t:'八题'},{v:12,t:'十二题'}]);
    h+=grp('angle','角度','ANGLE',[{v:'mix',t:'综合'},{v:'emotion',t:'情感与动机'},
      {v:'detail',t:'细节与伏笔'},{v:'char',t:'角色本人回答'}]);
  }else if(t==='feed'){
    h+=grp('platform','形态','FORM',[{v:'moments',t:'朋友圈式'},{v:'zone',t:'空间说说式'},{v:'twi',t:'推文式'}]);
    h+=grp('posts','条数','POSTS',[{v:3,t:'三条'},{v:4,t:'四条'},{v:6,t:'六条'}]);
  }else if(t==='mind'){
    h+=grp('who','视角','VOICE',[{v:'char',t:'角色的'},{v:'user',t:'你的身份的'},{v:'both',t:'两边交替'}]);
    h+=grp('pages','页数','PAGES',[{v:3,t:'三页'},{v:4,t:'四页'},{v:6,t:'六页'}]);
  }else if(t==='chron'){
    h+=grp('grain','颗粒度','GRAIN',[{v:'beat',t:'细 · 每个转折'},{v:'act',t:'中 · 每个阶段'},{v:'era',t:'粗 · 只记大事'}]);
  }else if(t==='relic'){
    h+=grp('count','件数','COUNT',[{v:4,t:'四件'},{v:5,t:'五件'},{v:8,t:'八件'}]);
  }else if(t==='if'){
    h+=`<div style="font-size:11.5px;line-height:2;color:var(--ink-5);padding:2px 4px 10px">
      流程：先勘定这一段中真正存在过的分歧瞬间，你选定其一并挑一条走向，再进入可交互的分支叙事。</div>`;
  }
  return h+'</div>';
}

/* ═══════════ 素材 ═══════════ */
function sourceText(arc,ids){
  const out=[];
  ids.forEach(sid=>{
    const s=M.Archive.entryById(sid); if(!s) return;
    out.push(`〔${s.title}〕`);
    (s.turns||[]).forEach(t=>{
      const x=M.stripTags(t.text||''); if(!x) return;
      out.push((t.role==='user'?(t.director?'［导演指令］':'［用户行动］'):'［叙事］')+x);
    });
  });
  let s=out.join('\n\n');
  const LIMIT=28000;
  if(s.length>LIMIT) s=s.slice(0,10000)+'\n\n……（中段略）……\n\n'+s.slice(-16000);
  return s;
}

function baseContext(arc){
  const ctx={char:arc.char.name,user:arc.user?arc.user.name:'你',
    relation:arc.char.relation||'',callUser:arc.char.callUser||''};
  return `===== 角色（CHAR）设定 · 最高优先级，必须精准还原 =====
${M.charBlock(arc.char)}

===== 用户（USER）身份设定 · 最高优先级 =====
${arc.user?M.userBlock(arc.user):'（用户未设定身份档，请以"你"称呼，不要捏造其姓名与背景。）'}

===== 预设素材 =====
${M.Preset.compose(arc.presetIds||[],ctx)||'（无）'}

卷名：${arc.title}`;
}

M.actions['pick-go']=async()=>{
  const arc=M.Archive.byId(pick.archiveId);
  const scenes=M.Archive.entriesOf(pick.archiveId,'scene').filter(s=>(s.turns||[]).some(x=>x.role==='ai'));
  if(!scenes.length) return M.toast('这一卷还没有可用的剧情');
  let ids;
  if(pick.scope==='one'||pick.type==='if'){
    if(!pick.sceneId) return M.toast('请选择一段剧情');
    ids=[pick.sceneId];
  }else ids=scenes.sort((a,b)=>(a.index||0)-(b.index||0)).map(s=>s.id);
  const src=sourceText(arc,ids);
  const one=M.Archive.entryById(ids[0])||{};
  const label=ids.length===1?String(one.title||'一段').replace(/^第.*段 · /,''):'全卷';
  try{
    const fn={vlog:genVlog,qa:genQA,feed:genFeed,mind:genMind,chron:genChron,relic:genRelic}[pick.type];
    if(fn) await fn(arc,src,ids,label);
    else if(pick.type==='if') await genIf(arc,src,ids[0],label);
  }catch(e){
    M.gen.close();
    if(e.name!=='AbortError') M.alert('生成失败',String(e.message||e).slice(0,240));
  }
};

E.regen=async function(en){
  const arc=M.Archive.byId(en.archiveId); if(!arc) return;
  const ids=en.sourceIds||[];
  if(!ids.length) return M.toast('缺少来源信息，请重新生成一份');
  pick={type:en.type,archiveId:arc.id,sceneId:ids[0],
    scope:ids.length===1?'one':'all',opts:en.opts||defOpts(en.type)};
  M.actions['pick-go']();
};

async function saveAndOpen(en){
  await M.Archive.saveEntry(en);
  M.Home.render();
  M.toast(D[en.type].name+'已归档');
  M.Archive.openEntry(en.id);
}

/* ═══════════════ 浮光 ═══════════════ */
async function genVlog(arc,src,ids,label){
  const dm={short:[16,24],std:[30,44],long:[56,76]};
  const [lo,hi]=dm[pick.opts.length]||dm.std;
  const tone={film:'电影感：讲究景别、光线、剪辑节奏，旁白克制',
    diary:'私影像：手持感、生活质地、旁白像自言自语',
    doc:'纪录片：冷静的观察视角，旁白带有回望的时间感'}[pick.opts.voice];

  const raw=await M.generate([
    {role:'system',content:`你是一位影像导演兼剪辑师。请把给定的中文剧情改写成一段"仿视频"的分镜脚本，供 App 逐帧播放。

${baseContext(arc)}

【输出格式】只输出一个 JSON 对象，不要解释、不要代码围栏：
{"title":"影片标题，4-10 字，不含标点","subtitle":"全大写英文副标，不超过 28 字符",
 "frames":[
  {"kind":"title","text":"标题帧文字","sub":"副标","shot":"BLACK","dur":3.5},
  {"kind":"narration","text":"旁白文字","shot":"EXT. 雨夜街道 — 远景","dur":6},
  {"kind":"dialogue","who":"角色名","side":"char","text":"台词","shot":"近景 — 侧脸","dur":4.5}]}

【规则】
1. frames 数量 ${lo} 到 ${hi} 帧。旁白帧 4–8 秒，台词帧按字数 2.5–6 秒，标题帧 3–4 秒。dur 为数字（秒），可含一位小数。
2. kind 只能是 title / narration / dialogue。
3. dialogue 必须有 who（与设定一致的说话者姓名）与 side（char 表示角色一方，user 表示用户一方，other 表示其他人）。
4. narration 是旁白：描述画面、动作、光线、声音与时间流动，不要写成台词，不出现引号。
5. shot 是镜头标注，简短，不超过 18 字符。
6. 影像语气：${tone}。
7. 忠于原剧情的事实、顺序与情绪，不得新增未发生的重大事件；可以补足合理的画面细节。
8. 开头必须是一帧 title，结尾可以是一帧留白的 narration 作为收束。
9. 严禁任何 emoji 与图形符号，全部使用中文。`},
    {role:'user',content:`【剧情素材】\n${src}`}],
    {title:'浮光生成中',sub:'正在把文字拆成一帧一帧的画面'});

  const data=M.pickJson(raw);
  if(!data||!Array.isArray(data.frames)||!data.frames.length)
    return M.alert('解析失败','模型没有返回可用的分镜数据。可以再试一次，或到生成设置里提高单次生成上限。');
  data.frames=data.frames.map(f=>({
    kind:['title','narration','dialogue'].includes(f.kind)?f.kind:'narration',
    text:M.deEmoji(String(f.text||'')),sub:M.deEmoji(String(f.sub||'')),
    who:M.deEmoji(String(f.who||'')),
    side:f.side==='user'?'user':(f.side==='other'?'other':'char'),
    shot:M.deEmoji(String(f.shot||'')).slice(0,24),
    dur:Math.max(1.6,Math.min(14,Number(f.dur)||4.5))}));

  const en={id:M.uid(),archiveId:arc.id,type:'vlog',
    title:M.deEmoji(data.title||'浮光')+' · '+label,data,sourceIds:ids,
    opts:Object.assign({},pick.opts),
    plain:data.frames.map(f=>(f.who?f.who+'：':'')+f.text).join('\n'),
    createdAt:Date.now(),updatedAt:Date.now()};
  await M.Archive.saveEntry(en); M.Home.render();
  M.toast('浮光已归档'); E.openVlog(en);
}

let V={en:null,frames:[],i:-1,playing:false,t:0,speed:1,timer:null,total:0,starts:[]};
E.openVlog=function(en){
  V.en=en; V.frames=(en.data&&en.data.frames)||[];
  V.starts=[]; let acc=0;
  V.frames.forEach(f=>{V.starts.push(acc);acc+=f.dur;});
  V.total=acc; V.t=0; V.i=-1; V.playing=false; V.speed=1;
  $('#vlogTitle').innerHTML=esc(en.title)+'<em>FLOATING LIGHT</em>';
  $('#vlogSpeed').textContent='1.0×';
  renderTrack(); M.nav('vlog'); setFrame(0); paint();
  setTimeout(()=>togglePlay(true),460);
};
function renderTrack(){
  $('#vlogTrack').innerHTML=V.frames.map((f,i)=>`
    <div class="tk locked" data-i="${i}">
      <div class="tk-t">${esc(M.fmtClock(V.starts[i]))}</div>
      <div class="tk-b">${f.kind==='dialogue'?`<div class="tk-w">${esc(f.who)}</div>`:''}${esc(f.text.slice(0,70))}</div>
    </div>`).join('');
  $('#vlogTrack').onclick=e=>{
    const el=e.target.closest('.tk'); if(!el) return;
    if(el.classList.contains('locked')) return M.toast('还没有播到这里');
    seekTo(V.starts[+el.dataset.i]+.01);
  };
}
function setFrame(i){
  const f=V.frames[i]; if(!f) return;
  V.i=i;
  $('#vlogShot').innerHTML=`<span>${esc(f.shot||(f.kind==='title'?'TITLE':'SCENE'))}</span>`;
  $('#vlogGrade').style.opacity=f.kind==='title'?'.35':'1';
  let h='';
  if(f.kind==='title') h=`<div class="cap title"><b>${esc(f.text)}</b>${f.sub?`<span>${esc(f.sub)}</span>`:''}</div>`;
  else if(f.kind==='dialogue') h=`<div class="cap line">
      <div class="cap-who ${f.side==='user'?'u':''}">${esc(f.who||'')}</div>
      <div class="cap-txt">${esc(f.text)}</div></div>`;
  else h=`<div class="cap narr">${esc(f.text)}</div>`;
  $('#vlogCaption').innerHTML=h;
  $$('#vlogTrack .tk').forEach((el,k)=>{
    el.classList.toggle('cur',k===i);
    if(k<=i){ el.classList.remove('locked'); el.classList.add('seen'); }
  });
  const cur=$('#vlogTrack .tk.cur');
  if(cur) cur.scrollIntoView({block:'nearest',behavior:'smooth'});
}
function frameAt(t){ let x=0; for(let k=0;k<V.starts.length;k++) if(t>=V.starts[k]) x=k; return x; }
function paint(){
  const p=V.total?(V.t/V.total*100):0;
  $('#vlogSeekIn').style.width=p+'%';
  $('#vlogSeekDot').style.left=p+'%';
  $('#vlogTC').textContent=`${M.fmtClock(V.t)} / ${M.fmtClock(V.total)}`;
}
function tick(){
  V.t+=0.1*V.speed;
  if(V.t>=V.total){ V.t=V.total; paint(); togglePlay(false); M.toast('播放完毕'); return; }
  const i=frameAt(V.t); if(i!==V.i) setFrame(i);
  paint();
}
function togglePlay(on){
  V.playing=on==null?!V.playing:on;
  clearInterval(V.timer);
  const b=$('#vlogToggle');
  b.dataset.svg=V.playing?'pause':'play'; b.dataset.svgDone='';
  M.paintIcons(b.parentElement);
  $('#vlogStage').classList.toggle('playing',V.playing);
  if(V.playing) V.timer=setInterval(tick,100);
}
function seekTo(t){ V.t=Math.max(0,Math.min(V.total,t)); setFrame(frameAt(V.t)); paint(); }
M.actions['vlog-toggle']=()=>togglePlay();
M.actions['vlog-prev']=()=>seekTo(V.starts[Math.max(0,V.i-1)]+.01);
M.actions['vlog-next']=()=>seekTo(V.starts[Math.min(V.frames.length-1,V.i+1)]+.01);
M.actions['vlog-speed']=()=>{
  const seq=[1,1.25,1.5,2,.75];
  V.speed=seq[(seq.indexOf(V.speed)+1)%seq.length];
  $('#vlogSpeed').textContent=V.speed.toFixed(2).replace(/0$/,'')+'×';
};
M.actions['vlog-menu']=async()=>{
  const v=await M.sheet({title:'浮光',plain:true,options:[
    {id:'restart',title:'从头播放'},
    {id:'all',title:'显示全部字幕',desc:'解除逐帧隐藏'},
    {id:'rename',title:'重命名'},
    {id:'regen',title:'重新生成'},
    {id:'del',title:'删除这份浮光',danger:true}]});
  if(v==='restart'){ seekTo(0); togglePlay(true); }
  else if(v==='all'){ $$('#vlogTrack .tk').forEach(el=>{el.classList.remove('locked');el.classList.add('seen');});
    M.toast('已展开全部'); }
  else if(v==='rename'){
    const t=await M.prompt('重命名',{input:{value:V.en.title}});
    if(t){ V.en.title=t; await M.Archive.saveEntry(V.en);
      $('#vlogTitle').innerHTML=esc(t)+'<em>FLOATING LIGHT</em>'; }
  }else if(v==='regen'){ togglePlay(false); E.regen(V.en); }
  else if(v==='del'){
    if(!await M.confirm('删除这份浮光',V.en.title,'删除')) return;
    togglePlay(false); await M.db.del('entries',V.en.id); await M.Archive.reload();
    M.toast('已删除'); M.back(); M.Archive.renderDetail(); M.Home.render();
  }
};
M.onLeave=v=>{ if(v==='vlog') togglePlay(false); };
$('#vlogSeek').addEventListener('click',e=>{
  const r=e.currentTarget.getBoundingClientRect();
  seekTo((e.clientX-r.left)/r.width*V.total);
});

/* ═══════════════ 叩问 ═══════════════ */
async function genQA(arc,src,ids,label){
  const angle={mix:'综合：既问情节与伏笔，也问情感动机与关系变化',
    emotion:'专注情感与动机：为什么这样做、当时在想什么、关系发生了什么位移',
    detail:'专注细节与伏笔：容易被忽略的物件、动作、时间线与呼应',
    char:`由 ${arc.char.name} 本人以第一人称回答，语气须完全符合其说话方式与性格`}[pick.opts.angle];
  const raw=await M.generate([
    {role:'system',content:`你要为 App「回想录」生成一份"叩问"——围绕一段中文剧情的可交互问答卡片集，输出为 HTML 片段。

${baseContext(arc)}

【内容要求】
1. 共 ${pick.opts.count} 组问答。角度：${angle}。
2. 每组包含一个问题与一个默认收起的答案。答案 120–260 字，引用剧情中真实出现过的细节，不要空泛。
3. 问题要真的值得问：指向动机、转折、伏笔、未说出口的话、关系的变化，而不是"发生了什么"这种复述题。
4. 顶部写一段 80–140 字的引言，交代这次叩问的切入点；底部给一段 60–120 字的收束。
5. 严禁编造剧情中不存在的事实。若某处确实无从判断，答案中要明说这是留白，并给出两种合理的读法。

【交互要求】
· 用 CSS 与少量 JS 实现问题的展开收起（点击问题条切换答案），动画柔和。
· 顶部提供"全部展开 / 全部收起"两个自绘控件。
· 每组带一个细字距的编号标签与一个表示角度的小标签。
· 不使用 details/summary 的默认样式，一切自绘。

${M.STYLE_RULES}`},
    {role:'user',content:`【剧情素材】\n${src}`}],
    {title:'叩问生成中',sub:'正在向这段故事提问'});
  const html=M.pickHtml(raw);
  if(!html) return M.alert('生成失败','模型没有返回可用内容，请再试一次。');
  await saveAndOpen({id:M.uid(),archiveId:arc.id,type:'qa',title:'叩问 · '+label,
    html,plain:M.stripTags(html),sourceIds:ids,opts:Object.assign({},pick.opts),
    createdAt:Date.now(),updatedAt:Date.now()});
}

/* ═══════════════ 回声 ═══════════════ */
async function genFeed(arc,src,ids,label){
  const plat={moments:'朋友圈式：文字为主，配 0 到 3 张"图片"（用文字描述画面内容代替真实图片），只有共同好友能看到彼此的评论',
    zone:'空间说说式：更外露、更长，评论区更热闹',
    twi:'推文式：短、密、锋利，允许自我回复形成串'}[pick.opts.platform];
  const c=arc.char, rels=[];
  if(c.relation) rels.push(`${c.name} 与用户：${c.relation}`);
  if(c.relationDetail) rels.push(c.relationDetail);
  if(arc.user&&Array.isArray(arc.user.linkedIdentities))
    arc.user.linkedIdentities.forEach(l=>rels.push(`${arc.user.name} 与 ${l.name||''}：${l.relation||l.type||'关系'}`));
  const wb=await M.loadWorldbook();
  const linked=wb.filter(e=>Array.isArray(e.chars)&&e.chars.includes(arc.charId))
    .map(e=>`· ${e.title||e.name||''}：${(e.content||'').slice(0,300)}`).join('\n');

  const raw=await M.generate([
    {role:'system',content:`你要为 App「回想录」生成"回声"——剧情之后，角色们发布的社交动态与彼此的评论互动。输出 JSON。

${baseContext(arc)}

===== 关系网络（用于生成评论互动） =====
${rels.join('\n')||'（未提供明确关系，请只让剧情中真实出现过的人物互动）'}
${linked?'\n===== 关联世界书 =====\n'+linked:''}

【输出格式】只输出 JSON：
{"title":"这组动态的标题，4-10 字",
 "posts":[{"author":"发布者姓名","side":"char|user|other","time":"相对时间，如 昨天 23:41",
   "text":"正文","images":["用一句话描述这张图的画面"],"likes":["点赞者姓名"],
   "comments":[{"author":"评论者","text":"评论内容",
     "replies":[{"author":"回复者","to":"被回复者","text":"回复内容"}]}]}]}

【规则】
1. 共 ${pick.opts.posts} 条动态。形态：${plat}。
2. 主角色（${c.name}）必须发布不止一条：至少 2 条，分布在剧情前后不同时间点，语气与心境要有变化。
3. 评论必须来自剧情中真实存在或关系网络中列明的人物，不要凭空捏造陌生人。评论要像真人：有梗、有试探、有心照不宣，也可以有人问错重点。
4. 评论可以有二级回复（replies），最多两层。
5. images 用文字描述画面，0 到 3 条；纯文字动态给空数组。
6. 正文长度：朋友圈式 20–90 字，空间式 40–160 字，推文式 15–60 字。
7. 严禁任何 emoji、颜文字、表情符号。要表达情绪请用文字本身或标点。
8. 所有内容必须与剧情事实一致，可以含蓄、可以只有当事人才懂，但不能矛盾。`},
    {role:'user',content:`【剧情素材】\n${src}`}],
    {title:'回声生成中',sub:'正在让角色们发出动态'});
  const data=M.pickJson(raw);
  if(!data||!Array.isArray(data.posts)||!data.posts.length)
    return M.alert('解析失败','模型没有返回可用的动态数据，请再试一次。');
  await saveAndOpen({id:M.uid(),archiveId:arc.id,type:'feed',
    title:M.deEmoji(data.title||'回声')+' · '+label,data,sourceIds:ids,
    opts:Object.assign({},pick.opts),likeState:{},
    plain:data.posts.map(p=>`${p.author}：${p.text}`).join('\n'),
    createdAt:Date.now(),updatedAt:Date.now()});
}

E.renderFeed=function(mount,en,arc){
  const posts=(en.data&&en.data.posts)||[];
  const who=s=>s==='user'?(arc&&arc.user):(s==='char'?(arc&&arc.char):null);
  mount.innerHTML=`
    <div class="feedhead">
      <div class="feedhead-in">${arc?M.avatarHtml(arc.char,'lg'):''}
        <div><div class="feedhead-n">${esc(en.data.title||'回声')}</div>
        <div class="feedhead-d">${esc(arc?arc.title:'')} ｜ ${posts.length} 条动态</div></div></div>
      <div class="brk tl light"></div><div class="brk br light"></div>
    </div>
    ${posts.map((p,pi)=>{
      const person=who(p.side)||{name:p.author};
      const imgs=Array.isArray(p.images)?p.images.filter(Boolean):[];
      const liked=en.likeState&&en.likeState[pi];
      const likes=Array.isArray(p.likes)?p.likes.filter(Boolean):[];
      return `<div class="post">
        <div class="post-top">
          ${M.avatarHtml(Object.assign({},person,{name:p.author||person.name}),'round')}
          <div class="post-n"><div class="post-name">${esc(p.author||'')}</div>
            <div class="post-time">${esc(p.time||'')}</div></div>
        </div>
        <div class="post-txt">${esc(M.deEmoji(p.text||''))}</div>
        ${imgs.length?`<div class="post-imgs ${imgs.length===1?'one':''}">${
          imgs.slice(0,6).map(t=>`<div class="post-img">${esc(t)}</div>`).join('')}</div>`:''}
        <div class="post-acts">
          <div class="pa ${liked?'on':''}" data-like="${pi}">${M.svg('heart',12)}<span>${likes.length+(liked?1:0)}</span></div>
          <div class="pa">${M.svg('cmt',12)}<span>${(p.comments||[]).length}</span></div>
          ${likes.length?`<div class="pa" style="flex:1;justify-content:flex-end">${esc(likes.slice(0,4).join(' · '))}</div>`:''}
        </div>
        ${(p.comments||[]).length?`<div class="post-cmts">${p.comments.map(cm=>`
          <div class="cmt"><b>${esc(cm.author||'')}</b>：${esc(M.deEmoji(cm.text||''))}</div>
          ${(cm.replies||[]).map(r=>`<div class="cmt reply"><b>${esc(r.author||'')}</b>${
            r.to?` <span class="to">回复 ${esc(r.to)}</span>`:''}：${esc(M.deEmoji(r.text||''))}</div>`).join('')}
        `).join('')}</div>`:''}
      </div>`;
    }).join('')}`;
  mount.onclick=async e=>{
    const l=e.target.closest('[data-like]'); if(!l) return;
    en.likeState=en.likeState||{};
    en.likeState[l.dataset.like]=!en.likeState[l.dataset.like];
    await M.Archive.saveEntry(en); E.renderFeed(mount,en,arc);
  };
};

/* ═══════════════ 心迹 ═══════════════ */
async function genMind(arc,src,ids,label){
  const who={char:`只写 ${arc.char.name} 的独白`,
    user:`只写 ${arc.user?arc.user.name:'用户'} 的独白`,
    both:`两边交替：${arc.char.name} 与 ${arc.user?arc.user.name:'用户'} 轮流，同一件事要出现两种互不知情的解读`}[pick.opts.who];
  const raw=await M.generate([
    {role:'system',content:`你要为 App「回想录」生成"心迹"——角色没说出口的那部分，写成一叠第一人称手记。输出 JSON。

${baseContext(arc)}

【输出格式】只输出 JSON：
{"title":"这叠手记的标题，4-10 字",
 "pages":[{"voice":"char|user","who":"书写者姓名","when":"时间，如 那天夜里 / 第三日 清晨",
   "mood":"两到四个字概括当下心绪，如 迟疑、逞强、松了一口气",
   "text":"独白正文","echo":"从剧情中摘出的、与这页对应的真实画面，一句话"}]}

【规则】
1. 共 ${pick.opts.pages} 页。视角：${who}。
2. 每页正文 180–360 字，第一人称，语气必须完全贴合书写者的说话方式与性格。
3. 只写没说出口的东西：隐瞒的判断、误解的部分、反复回想的那一秒、当时想说却咽回去的话。严禁复述叙事已经写过的内容。
4. echo 必须是剧情里真实发生过的画面，用来把这页锚定在时间线上。
5. mood 只能是中文词，不要标点与符号。
6. 严禁任何 emoji 与图形符号。
7. 不要写成日记流水账，每一页要有一个具体的、小的、被反复琢磨的点。`},
    {role:'user',content:`【剧情素材】\n${src}`}],
    {title:'心迹生成中',sub:'正在写下没说出口的部分'});
  const data=M.pickJson(raw);
  if(!data||!Array.isArray(data.pages)||!data.pages.length)
    return M.alert('解析失败','模型没有返回可用的手记数据，请再试一次。');
  await saveAndOpen({id:M.uid(),archiveId:arc.id,type:'mind',
    title:M.deEmoji(data.title||'心迹')+' · '+label,data,sourceIds:ids,
    opts:Object.assign({},pick.opts),
    plain:data.pages.map(p=>`${p.who}｜${p.when}\n${p.text}`).join('\n\n'),
    createdAt:Date.now(),updatedAt:Date.now()});
}

E.renderMind=function(mount,en,arc){
  const pages=(en.data&&en.data.pages)||[];
  mount.innerHTML=pages.map(p=>{
    const person=p.voice==='user'?(arc&&arc.user):(arc&&arc.char);
    return `<div class="mindpage">
      <div class="mind-top">
        ${M.avatarHtml(Object.assign({},person||{},{name:p.who||(person||{}).name}),'sm round')}
        <div style="font-size:12.5px;color:var(--ink-2);letter-spacing:.08em">${esc(p.who||'')}</div>
        <div class="mind-date">${esc(p.when||'')}</div>
        ${p.mood?`<div class="mind-mood">${esc(p.mood)}</div>`:''}
      </div>
      <div class="mind-txt">${esc(M.deEmoji(p.text||''))}</div>
      ${p.echo?`<div class="mind-cut">当时——${esc(p.echo)}</div>`:''}
      <div class="brk br"></div>
    </div>`;
  }).join('');
};

/* ═══════════════ 年谱 ═══════════════ */
async function genChron(arc,src,ids,label){
  const grain={beat:'细：每一个转折都记，包括小的情绪转向',
    act:'中：按阶段划分，只记推动关系或情节改变方向的节点',
    era:'粗：只记真正的大事，能用一句话概括整段的那种'}[pick.opts.grain];
  const raw=await M.generate([
    {role:'system',content:`你要为 App「回想录」生成"年谱"——把剧情拆成一条可展开的时间线。输出 JSON。

${baseContext(arc)}

【输出格式】只输出 JSON：
{"title":"年谱标题，4-10 字",
 "events":[{"when":"时间标记，如 初见那日 / 第七天 傍晚","title":"事件标题，4-12 字",
   "brief":"一句话概述，30-60 字","key":true,
   "detail":"当时的处境，60-120 字","present":"在场者，用顿号分隔","changed":"这件事之后改变了什么，40-80 字"}]}

【规则】
1. 事件按时间顺序排列，颗粒度：${grain}。数量由素材长度自行判断，不少于 5 条。
2. key 为 true 表示这是真正的关键节点，全部事件中至多三分之一可以为 true。
3. 所有事件必须是剧情中真实发生过的，不得虚构、不得改变顺序。
4. changed 是这条年谱最重要的字段：要具体说明关系、认知或处境发生了什么位移，不要写"两人关系更近了"这种空话。
5. 严禁任何 emoji 与图形符号。`},
    {role:'user',content:`【剧情素材】\n${src}`}],
    {title:'年谱生成中',sub:'正在把一切排成一条线'});
  const data=M.pickJson(raw);
  if(!data||!Array.isArray(data.events)||!data.events.length)
    return M.alert('解析失败','模型没有返回可用的年谱数据，请再试一次。');
  await saveAndOpen({id:M.uid(),archiveId:arc.id,type:'chron',
    title:M.deEmoji(data.title||'年谱')+' · '+label,data,sourceIds:ids,
    opts:Object.assign({},pick.opts),
    plain:data.events.map(e=>`${e.when}　${e.title}\n${e.brief}`).join('\n\n'),
    createdAt:Date.now(),updatedAt:Date.now()});
}

E.renderChron=function(mount,en){
  const evs=(en.data&&en.data.events)||[];
  mount.innerHTML=`<div class="chron">${evs.map((e,i)=>`
    <div class="ev ${e.key?'key':''}" data-i="${i}">
      <div class="ev-in">
        <div class="ev-when">${esc(e.when||'')}</div>
        <div class="ev-t">${esc(e.title||'')}</div>
        <div class="ev-d">${esc(M.deEmoji(e.brief||''))}</div>
        <div class="ev-more"><div class="ev-more-in">
          ${e.detail?`<div style="margin-bottom:9px">${esc(M.deEmoji(e.detail))}</div>`:''}
          ${e.present?`<div style="margin-bottom:9px;color:var(--ink-4)">在场　${esc(e.present)}</div>`:''}
          ${e.changed?`<div style="padding:10px 13px;border-radius:10px;background:rgba(16,16,21,.032);border-left:2px solid var(--hair-3);font-family:var(--song);font-style:italic">此后——${esc(M.deEmoji(e.changed))}</div>`:''}
        </div></div>
      </div>
    </div>`).join('')}</div>`;
  mount.onclick=e=>{ const el=e.target.closest('.ev'); if(!el) return; el.classList.toggle('open'); };
};

/* ═══════════════ 物证 ═══════════════ */
async function genRelic(arc,src,ids,label){
  const raw=await M.generate([
    {role:'system',content:`你要为 App「回想录」生成"物证"——把剧情里留下来的东西，按博物馆藏品标签的方式列出来。输出 JSON。

${baseContext(arc)}

【输出格式】只输出 JSON：
{"title":"这组物证的标题，4-10 字",
 "items":[{"name":"物件名称，2-10 字","glyph":"一个能代表它的汉字",
   "tags":["类别标签，如 衣物 / 纸片 / 一句话"],
   "desc":"来历与经过，80-160 字","quote":"从剧情中摘出的相关原话或场景，一句话",
   "weight":"这件东西为什么重要，30-60 字"}]}

【规则】
1. 共 ${pick.opts.count} 件。必须是剧情中真实出现过的东西，严禁凭空捏造。
2. "东西"可以是实物，也可以是一句被反复提起的话、一个习惯性的动作、一段固定重复的路线——这些同样算物证。
3. glyph 只能是一个汉字，用来代替图片显示在标签上。
4. desc 要具体：什么时候出现、在谁手里、经过了什么。
5. weight 要说明它如何折射关系的位置，不要写"很重要"这种空话。
6. 严禁任何 emoji 与图形符号。`},
    {role:'user',content:`【剧情素材】\n${src}`}],
    {title:'物证生成中',sub:'正在清点留下来的东西'});
  const data=M.pickJson(raw);
  if(!data||!Array.isArray(data.items)||!data.items.length)
    return M.alert('解析失败','模型没有返回可用的物证数据，请再试一次。');
  await saveAndOpen({id:M.uid(),archiveId:arc.id,type:'relic',
    title:M.deEmoji(data.title||'物证')+' · '+label,data,sourceIds:ids,
    opts:Object.assign({},pick.opts),
    plain:data.items.map(i=>`${i.name}｜${i.desc}`).join('\n\n'),
    createdAt:Date.now(),updatedAt:Date.now()});
}

E.renderRelic=function(mount,en){
  const items=(en.data&&en.data.items)||[];
  mount.innerHTML=items.map((it,i)=>`
    <div class="relic">
      <div class="relic-fig"><b>${esc((it.glyph||it.name||'物').slice(0,1))}</b></div>
      <div class="relic-b">
        <div style="font-family:var(--mono);font-size:7.5px;letter-spacing:.32em;color:var(--ink-5)">NO. ${String(i+1).padStart(2,'0')}</div>
        <div class="relic-n" style="margin-top:6px">${esc(it.name||'')}</div>
        ${Array.isArray(it.tags)&&it.tags.length?`<div class="relic-tag">${
          it.tags.slice(0,3).map(t=>`<div class="tagpill">${esc(t)}</div>`).join('')}</div>`:''}
        <div class="relic-d">${esc(M.deEmoji(it.desc||''))}</div>
        ${it.quote?`<div class="relic-q">${esc(M.deEmoji(it.quote))}</div>`:''}
        ${it.weight?`<div class="relic-d" style="color:var(--ink-3);margin-top:10px">${esc(M.deEmoji(it.weight))}</div>`:''}
      </div>
      <div class="brk tr"></div>
    </div>`).join('');
};

/* ═══════════════ 歧路 ═══════════════ */
async function genIf(arc,src,sceneId,label){
  const scene=M.Archive.entryById(sceneId);
  const raw=await M.generate([
    {role:'system',content:`你是一位叙事分析师。请从给定的中文剧情中，找出真正存在过的"分歧瞬间"——那些如果当时的选择不同，故事就会走向别处的时刻。

${baseContext(arc)}

【输出格式】只输出 JSON：
{"anchors":[{"moment":"这个瞬间的名字，4-12 字","when":"它发生在剧情中的什么位置，一句话",
  "original":"原本发生了什么，40-80 字","pivot":"真正的分歧点是什么，一句话点明",
  "alternatives":["另一种可能的走向，25-50 字","另一种可能的走向"]}]}

【规则】
1. 给出 3 到 4 个锚点，按剧情时间顺序排列。
2. 必须是剧情中真实出现过的瞬间，不得虚构。
3. 分歧点要具体到某个动作、某句话、某个犹豫，不要写成"如果他们关系更好"这种笼统假设。
4. 每个锚点给 2 个可选走向，二者必须指向明显不同的后果。
5. 严禁任何 emoji 与图形符号。`},
    {role:'user',content:`【剧情素材】\n${src}`}],
    {title:'歧路勘定中',sub:'正在寻找真正的分岔口'});
  const data=M.pickJson(raw);
  if(!data||!Array.isArray(data.anchors)||!data.anchors.length)
    return M.alert('解析失败','没能勘定出分歧点，请再试一次。');

  const ai=await M.sheet({title:'分歧点',desc:'选择一个瞬间，让故事从那里走上另一条路',
    options:data.anchors.map((a,i)=>({id:String(i),title:a.moment||`锚点 ${i+1}`,
      desc:(a.pivot||a.original||'').slice(0,64)}))});
  if(ai==null) return;
  const anchor=data.anchors[+ai];

  const alts=(anchor.alternatives||[]).map((t,i)=>({id:String(i),
    title:'走向 '+(i===0?'甲':'乙'),desc:t}));
  alts.push({id:'own',title:'我自己写一个走向',desc:'由你决定那一刻改变了什么'});
  const pa=await M.sheet({title:anchor.moment||'分歧点',
    desc:(anchor.original||'').slice(0,96),options:alts});
  if(pa==null) return;
  let alt;
  if(pa==='own'){
    alt=await M.prompt('另一种走向',{desc:'写下那一刻改变的是什么',
      input:{multiline:true,placeholder:'例：他没有转身，而是叫住了她'}});
    if(!alt) return;
  }else alt=anchor.alternatives[+pa];

  const idx=M.Archive.entriesOf(arc.id,'if').length+1;
  const en={id:M.uid(),archiveId:arc.id,type:'if',
    title:`歧路${M.cjkNum(idx)} · ${anchor.moment||label}`,index:idx,turns:[],
    sourceIds:[sceneId],anchors:data.anchors,
    branch:{moment:anchor.moment||'',when:anchor.when||'',original:anchor.original||'',
      pivot:anchor.pivot||'',alternative:alt,
      sourceTitle:scene?scene.title:'',summary:M.stripTags(src).slice(-4500)},
    createdAt:Date.now(),updatedAt:Date.now()};
  await M.Archive.saveEntry(en);
  M.Home.render(); M.toast('歧路已开辟');
  M.Play.open(arc,en,true);
}

})();
