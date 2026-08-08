/* ================================================================
   夜话馆 · NIGHT TALK HOUSE  —  v2
   所有内容由 AI 生成；角色来源 = 角色库 + AI 自动生成的博主
   接口源：localStorage.luna_api_current + luna_api_model
================================================================ */
(function(){
'use strict';

/* ================================================================
   0 · 语言
================================================================ */
const LANGS = [
  {c:'zh-CN', n:'简体中文 · 普通话', e:'Mandarin'},
  {c:'zh-TW', n:'繁體中文',        e:'Traditional'},
  {c:'yue',   n:'粤语 · 廣東話',   e:'Cantonese'},
  {c:'en',    n:'English',        e:'English'},
  {c:'ja',    n:'日本語',          e:'Japanese'},
  {c:'ko',    n:'한국어',          e:'Korean'},
  {c:'fr',    n:'Français',       e:'French'},
  {c:'de',    n:'Deutsch',        e:'German'},
  {c:'es',    n:'Español',        e:'Spanish'},
  {c:'pt',    n:'Português',      e:'Portuguese'},
  {c:'it',    n:'Italiano',       e:'Italian'},
  {c:'ru',    n:'Русский',        e:'Russian'},
  {c:'uk',    n:'Українська',     e:'Ukrainian'},
  {c:'pl',    n:'Polski',         e:'Polish'},
  {c:'nl',    n:'Nederlands',     e:'Dutch'},
  {c:'sv',    n:'Svenska',        e:'Swedish'},
  {c:'tr',    n:'Türkçe',         e:'Turkish'},
  {c:'ar',    n:'العربية',         e:'Arabic'},
  {c:'he',    n:'עברית',           e:'Hebrew'},
  {c:'hi',    n:'हिन्दी',            e:'Hindi'},
  {c:'th',    n:'ไทย',            e:'Thai'},
  {c:'vi',    n:'Tiếng Việt',     e:'Vietnamese'},
  {c:'id',    n:'Bahasa Indonesia',e:'Indonesian'},
  {c:'ms',    n:'Bahasa Melayu',  e:'Malay'}
];
const langName = c => (LANGS.find(l=>l.c===c)||LANGS[0]).n;
const langEn   = c => (LANGS.find(l=>l.c===c)||LANGS[0]).e;
const langShort = c => ({'zh-CN':'CN','zh-TW':'TW','yue':'YUE','en':'EN','ja':'JA','ko':'KO','fr':'FR','de':'DE','es':'ES','pt':'PT','it':'IT','ru':'RU','uk':'UK','pl':'PL','nl':'NL','sv':'SV','tr':'TR','ar':'AR','he':'HE','hi':'HI','th':'TH','vi':'VI','id':'ID','ms':'MS'}[c]||'—');

const UI = ['zh-CN','zh-TW','yue','en','ja','ko'];
const D = {
'nav.feed':['广场','廣場','廣場','Square','広場','광장'],
'nav.dm':['私语','私語','私語','Whispers','私語','귓속말'],
'nav.me':['我的','我的','我嘅','Mine','マイ','마이'],
'sub.feed':['THE SQUARE','THE SQUARE','THE SQUARE','THE SQUARE','THE SQUARE','THE SQUARE'],
'sub.dm':['WHISPERS','WHISPERS','WHISPERS','WHISPERS','WHISPERS','WHISPERS'],
'sub.me':['PROFILE','PROFILE','PROFILE','PROFILE','PROFILE','PROFILE'],
'tonight':['今夜话题','今夜話題','今晚話題','TONIGHT','今夜の話題','오늘 밤'],
'gen':['生成','生成','生成','Generate','生成','생성'],
'gen.topic':['想看点什么？主题、心情、CP 名都可以','想看點什麼？主題、心情、CP 名都可以','想睇啲乜？主題、心情、CP 名都得','A topic, a mood, a ship name…','見たいテーマ・気分・CP名','주제, 기분, 커플명…'],
'act.like':['共鸣','共鳴','共鳴','Echo','共鳴','공감'],
'act.cm':['回声','回聲','回聲','Reply','返信','댓글'],
'act.rp':['转发','轉發','轉發','Repost','転送','리포스트'],
'act.col':['收藏','收藏','收藏','Save','保存','저장'],
'follow':['关注','關注','關注','Follow','フォロー','팔로우'],
'following':['已关注','已關注','已關注','Following','フォロー中','팔로잉'],
'post':['夜话','夜話','夜話','Posts','投稿','게시물'],
'followers':['粉丝','粉絲','粉絲','Followers','フォロワー','팔로워'],
'follows':['关注','關注','關注','Following','フォロー','팔로잉'],
'views':['浏览','瀏覽','瀏覽','Views','閲覧','조회'],
'likes':['喜欢','喜歡','鍾意','Likes','いいね','좋아요'],
'saved':['收藏','收藏','收藏','Saved','保存','저장됨'],
'reposts':['转发','轉發','轉發','Reposts','転送','리포스트'],
'detail':['夜话详情','夜話詳情','夜話詳情','Post','投稿','게시물'],
'cm.gen':['让Ta们说点什么','讓他們說點什麼','等佢哋講兩句','Let them reply','返信させる','댓글 받기'],
'cm.none':['还没有回声','還沒有回聲','仲未有回聲','No replies yet','まだ返信なし','아직 댓글 없음'],
'cm.ph':['写下你的回声','寫下你的回聲','寫低你嘅回聲','Write a reply','返信を書く','댓글 쓰기'],
'cm.sub':['回复详情','回覆詳情','回覆詳情','Thread','スレッド','스레드'],
'dm.ph':['说点什么','說點什麼','講兩句','Say something','何か話す','메시지 입력'],
'dm.data':['数据中心','數據中心','數據中心','Activity','アクティビティ','활동'],
'dm.find':['有人在找你','有人喺搵你','有人喺搵你','Someone reached out','誰かが探している','누군가 찾고 있어요'],
'compose':['落笔','落筆','落筆','Compose','投稿する','작성'],
'publish':['发布','發布','發佈','Publish','公開','게시'],
'save':['保存','保存','儲存','Save','保存','저장'],
'del':['删除','刪除','刪除','Delete','削除','삭제'],
'trans':['翻译','翻譯','翻譯','Translate','翻訳','번역'],
'trans.hide':['收起译文','收起譯文','收起譯文','Hide translation','翻訳を隠す','번역 숨기기'],
'quote':['引用','引用','引用','Quote','引用','인용'],
'copy':['复制','複製','複製','Copy','コピー','복사'],
'fwd':['转发到私语','轉發到私語','轉發到私語','Forward','転送','전달'],
'revoke':['撤回','撤回','撤回','Unsend','送信取消','전송 취소'],
'reply':['让Ta回应','讓他回應','等佢回應','Ask for a reply','返信を求める','답장 요청'],
'set':['设置','設置','設定','Settings','設定','설정'],
'skin':['外观','外觀','外觀','Appearance','外観','외관'],
'set.ui':['界面语言','介面語言','介面語言','Interface language','表示言語','인터페이스 언어'],
'set.ct':['内容语言','內容語言','內容語言','Content language','生成言語','생성 언어'],
'set.tr':['翻译目标','翻譯目標','翻譯目標','Translate into','翻訳先','번역 대상'],
'edit':['编辑资料','編輯資料','編輯資料','Edit profile','プロフィール編集','프로필 편집'],
'none':['这里还是空的','這裡還是空的','呢度仲係空嘅','Nothing here yet','まだ何もありません','아직 없습니다'],
'noapi':['未配置接口，请先在设置里填好 API','未配置介面，請先喺設定填好 API','未設定介面，請先喺設定填好 API','No API configured. Add it in settings.','APIが未設定です','API가 설정되지 않았습니다'],
'nochar':['还没有可用的博主，先去「博主」里生成几个','還沒有可用的博主','仲未有博主','No authors yet.','投稿者がいません','작성자가 없습니다'],
'working':['正在落笔','正在落筆','正在落筆','Writing','執筆中','작성 중'],
'all':['全部','全部','全部','All','すべて','전체'],
'lamp':['灯火','燈火','燈火','Lamplight','灯火','등불']
};
let _ui = 'zh-CN';
function T(k){ const r=D[k]; if(!r) return k; let i=UI.indexOf(_ui); if(i<0) i=3; return r[i]||r[3]||r[0]; }

/* ================================================================
   1 · 体裁登记表（严格互斥）
================================================================ */
const TYPES = {
  essay:   { cn:'随笔',     en:'ESSAY',    field:'text',
             ai:'第一人称深夜随笔。必须有具体的时间、地点、动作或物件，有一个情绪的转折。120–240 字。' },
  moment:  { cn:'碎片',     en:'MOMENT',   field:'moment',
             ai:'一条极短的碎片瞬间。字段 moment={text:"一到两句话，25–60字，画面感强", place:"地点", clock:"时间如 02:41"}。' },
  diary:   { cn:'日记',     en:'DIARY',    field:'diary',
             ai:'一则日记。字段 diary={day:"如 04", month:"如 MARCH", weather:"如 阴 转 小雨", body:"正文 150–260字，流水账里藏一句要紧的话"}。' },
  chatlog: { cn:'对话留影', en:'CAPTURE',  field:'chat',
             ai:'分享一张与另一个人的聊天记录截图。必须给出完整 chat 数据，text 写发帖人简短的转发感想（30–70字）。' },
  cp:      { cn:'CP 现场',  en:'SHIP',     field:'chat',
             ai:'围观两个角色之间暧昧或拉扯的对话截图，发帖人是旁观者。必须给出完整 chat 数据，text 写一段旁观者锐评（40–90字）。' },
  list:    { cn:'清单体',   en:'LIST',     field:'list',
             ai:'清单体。字段 list 为 3–6 条字符串数组，每条一句话，句式不要重复。text 可写一句引子。' },
  verse:   { cn:'短诗',     en:'VERSE',    field:'verse',
             ai:'短诗。字段 verse 为 4–9 行的字符串，用 \\n 换行，不押韵也可以，忌抒情套话。' },
  ask:     { cn:'提问箱',   en:'ASK BOX',  field:'ask',
             ai:'匿名提问箱。字段 ask={q:"陌生人的提问，20–50字", a:"本人的回答，60–150字，可以答非所问"}。' },
  quote:   { cn:'夜话卡',   en:'QUOTE',    field:'quote',
             ai:'夜话卡。字段 quote={text:"一句被摘出来的话，15–40字", by:"署名"}。' },
  letter:  { cn:'未寄出的信',en:'LETTER',  field:'letter',
             ai:'一封写了不寄的信。字段 letter={to:"收信人称呼", body:"信正文 120–260字", sign:"落款"}。' },
  playlist:{ cn:'深夜歌单', en:'PLAYLIST', field:'playlist',
             ai:'深夜歌单。字段 playlist={name:"歌单名", tracks:[{title:"歌名",artist:"歌手",note:"一句听感，15–35字"}]}，3–5 首。歌名与歌手可以是虚构的。' },
  review:  { cn:'锐评',     en:'REVIEW',   field:'review',
             ai:'一段锐评。字段 review={object:"被评的东西", kind:"类别如 电影/餐厅/耳机", score:"0.0–10.0 的数字字符串", body:"评语 100–200字，有立场有细节"}。' },
  poll:    { cn:'投票',     en:'POLL',     field:'poll',
             ai:'一个投票。字段 poll={q:"问题", options:[{label:"选项",pct:数字}]}，2–4 个选项，pct 之和为 100，total 为参与人数。text 写一句发起理由。' },
  dream:   { cn:'梦境',     en:'DREAM',    field:'dream',
             ai:'一段梦境记录。字段 dream={body:"梦的内容 100–200字，逻辑可以断裂", wake:"醒来后的一句话"}。' },
  thread:  { cn:'长推',     en:'THREAD',   field:'thread',
             ai:'一条分段长推。字段 thread 为 3–6 段字符串数组，每段 40–90 字，段与段之间有推进关系。' },
  snippet: { cn:'摘抄',     en:'SNIPPET',  field:'snippet',
             ai:'一段摘抄加感想。字段 snippet={text:"被摘抄的原文 30–80字", from:"出处，书名或人名，可虚构", note:"我的感想 50–110字"}。' },
  voice:   { cn:'语音条',   en:'VOICE',    field:'voice',
             ai:'一条语音帖。字段 voice={dur:秒数 6–58, transcript:"语音转文字内容 60–160字，有口语停顿、重复、自我打断"}。' }
};
const TYPE_LIST = Object.keys(TYPES);
const CHAT_TYPES = ['chatlog','cp'];

/* 留影卡主题 */
const CC_THEMES = [
  {k:'ink',n:'墨白'},{k:'frost',n:'雾晶'},{k:'paper',n:'素笺'},{k:'silver',n:'银线'},
  {k:'mono',n:'铅字'},{k:'veil',n:'轻纱'},{k:'blush',n:'胭色'},{k:'mica',n:'云母'},{k:'dew',n:'晨露'}
];

/* ================================================================
   2 · 工具
================================================================ */
const $  = (s,r)=> (r||document).querySelector(s);
const $$ = (s,r)=> Array.from((r||document).querySelectorAll(s));
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const clamp = (n,a,b)=> Math.max(a,Math.min(b,n));
const initial = n => (String(n||'?').trim()[0]||'?').toUpperCase();
const rnd = (a,b)=> a + Math.floor(Math.random()*(b-a+1));
const pick1 = a => a[Math.floor(Math.random()*a.length)];
function nfmt(n){
  n = Number(n)||0;
  if(n>=100000000) return (n/100000000).toFixed(1).replace(/\.0$/,'')+'亿';
  if(n>=10000) return (n/10000).toFixed(1).replace(/\.0$/,'')+'w';
  if(n>=1000) return (n/1000).toFixed(1).replace(/\.0$/,'')+'k';
  return String(n);
}
function ago(ts){
  const d = Date.now()-ts, m=Math.floor(d/60000);
  if(m<1) return '刚刚';
  if(m<60) return m+' 分钟前';
  const h=Math.floor(m/60); if(h<24) return h+' 小时前';
  const dd=Math.floor(h/24); if(dd<30) return dd+' 天前';
  return new Date(ts).toLocaleDateString();
}
function hhmm(ts){ const d=new Date(ts); return d.getHours()+':'+String(d.getMinutes()).padStart(2,'0'); }
const dayKey = ts => { const d=new Date(ts||Date.now()); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); };
function dayDiff(a,b){
  const p=s=>{ const x=String(s).split('-'); return new Date(+x[0],+x[1]-1,+x[2]).getTime(); };
  return Math.round((p(b)-p(a))/86400000);
}
function pickN(arr,n){ const a=arr.slice(),o=[]; while(a.length&&o.length<n) o.push(a.splice(Math.floor(Math.random()*a.length),1)[0]); return o; }
function pickWeighted(arr,n,recentIds){
  const rec = (recentIds||[]).map(String);
  const sc = arr.map(c=>{ const i=rec.indexOf(String(c.id)); return {c, w:(i<0?100:i*6)+Math.random()*22}; });
  sc.sort((a,b)=>b.w-a.w);
  return sc.slice(0,n).map(x=>x.c);
}
function waves(n,min,max){ let s=''; for(let i=0;i<n;i++) s+='<i style="height:'+((min||3)+Math.round(Math.random()*((max||11)-(min||3))))+'px"></i>'; return s; }
function strHash(s){ let h=2166136261; s=String(s||''); for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function seededRand(seed){ let x=seed>>>0||1; return ()=>{ x^=x<<13;x>>>=0; x^=x>>17; x^=x<<5;x>>>=0; return x/4294967296; }; }
function autoGrow(el){ if(!el) return; el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,120)+'px'; }

/* ================================================================
   3 · 存储
================================================================ */
let _sdb = null;
function openStore(){
  if(_sdb) return Promise.resolve(_sdb);
  return new Promise((res,rej)=>{
    const r = indexedDB.open('YeHuaGuanDB',1);
    r.onupgradeneeded = e=>{ const db=e.target.result; if(!db.objectStoreNames.contains('kv')) db.createObjectStore('kv',{keyPath:'k'}); };
    r.onsuccess = e=>{ _sdb=e.target.result; res(_sdb); };
    r.onerror   = ()=> rej('store');
  });
}
async function kvGet(k){
  try{ const db=await openStore();
    return await new Promise(res=>{ const q=db.transaction('kv','readonly').objectStore('kv').get(k);
      q.onsuccess=()=>res(q.result?q.result.v:null); q.onerror=()=>res(null); });
  }catch(e){ return null; }
}
async function kvSet(k,v){
  try{ const db=await openStore();
    return await new Promise(res=>{ const q=db.transaction('kv','readwrite').objectStore('kv').put({k,v});
      q.onsuccess=()=>res(true); q.onerror=()=>res(false); });
  }catch(e){ return false; }
}
function openCharDB(){
  return new Promise((res,rej)=>{
    const probe = indexedDB.open('LunaCharDB');
    probe.onsuccess = e=>{
      const cur=e.target.result, ver=cur.version, has=cur.objectStoreNames.contains('chars'); cur.close();
      if(has){ const r2=indexedDB.open('LunaCharDB',ver); r2.onsuccess=e2=>res(e2.target.result); r2.onerror=()=>rej('char'); }
      else{ const r3=indexedDB.open('LunaCharDB',ver+1);
        r3.onupgradeneeded=e3=>{ const db=e3.target.result; if(!db.objectStoreNames.contains('chars')) db.createObjectStore('chars',{keyPath:'id',autoIncrement:true}); };
        r3.onsuccess=e3=>res(e3.target.result); r3.onerror=()=>rej('char'); }
    };
    probe.onerror = ()=>rej('char');
    probe.onupgradeneeded = e=>{ const db=e.target.result; if(!db.objectStoreNames.contains('chars')) db.createObjectStore('chars',{keyPath:'id',autoIncrement:true}); };
  });
}
async function loadChars(){
  try{ const db=await openCharDB();
    return await new Promise(res=>{ const q=db.transaction('chars','readonly').objectStore('chars').getAll();
      q.onsuccess=()=>res(q.result||[]); q.onerror=()=>res([]); });
  }catch(e){ return []; }
}

/* ================================================================
   4 · 外观主题（全部浅白，无深色）
================================================================ */
const SKINS = [
  {k:'porcelain', n:'素瓷', t:{
    '--ink':'#14141a','--ink-2':'#22222b','--graphite':'#3d3d49','--steel':'#666675','--ash':'#9a9aa8','--mist':'#c6c6d1',
    '--acc':'#6f6f86','--acc-2':'#a9a9c2','--paper':'#f6f6f9','--paper-2':'#eeeef3'}},
  {k:'mica', n:'云母', t:{
    '--ink':'#1a1622','--ink-2':'#28212f','--graphite':'#463c52','--steel':'#6e6280','--ash':'#a099ad','--mist':'#cdc6d6',
    '--acc':'#7d6aa4','--acc-2':'#b9abd4','--paper':'#f9f6fc','--paper-2':'#f1ecf7'}},
  {k:'blush', n:'胭霜', t:{
    '--ink':'#241a1d','--ink-2':'#312327','--graphite':'#4f3b41','--steel':'#7d626a','--ash':'#ad969c','--mist':'#d8c6ca',
    '--acc':'#a8697c','--acc-2':'#d6a9b6','--paper':'#fdf7f8','--paper-2':'#f8ecef'}},
  {k:'dew', n:'晨露', t:{
    '--ink':'#12201b','--ink-2':'#1e2e27','--graphite':'#374c43','--steel':'#5f7a6f','--ash':'#95aca3','--mist':'#c2d5cc',
    '--acc':'#5f8f7c','--acc-2':'#a5cbbc','--paper':'#f4faf7','--paper-2':'#e9f3ee'}},
  {k:'celadon', n:'天青', t:{
    '--ink':'#131c26','--ink-2':'#1f2a36','--graphite':'#374654','--steel':'#5e7186','--ash':'#93a4b5','--mist':'#c1cddb',
    '--acc':'#5c7f9e','--acc-2':'#a5c0d6','--paper':'#f4f8fc','--paper-2':'#e8f0f7'}},
  {k:'pearl', n:'珠灰', t:{
    '--ink':'#1b1b1e','--ink-2':'#28282c','--graphite':'#454549','--steel':'#71717a','--ash':'#a3a3ab','--mist':'#cbcbd2',
    '--acc':'#8a8a95','--acc-2':'#bcbcc6','--paper':'#f7f7f8','--paper-2':'#efeff1'}},
  {k:'perilla', n:'紫苏', t:{
    '--ink':'#1d1526','--ink-2':'#2a1f36','--graphite':'#463659','--steel':'#6f5b87','--ash':'#a292b4','--mist':'#cfc2dd',
    '--acc':'#8663ad','--acc-2':'#c0a8db','--paper':'#faf6fd','--paper-2':'#f2ebf9'}},
  {k:'frostmint', n:'霜青', t:{
    '--ink':'#101f21','--ink-2':'#1b2e30','--graphite':'#324c4f','--steel':'#587a7e','--ash':'#8faaad','--mist':'#bdd3d5',
    '--acc':'#54868b','--acc-2':'#a2c8cb','--paper':'#f3fafa','--paper-2':'#e7f2f3'}},
  {k:'linen', n:'月白', t:{
    '--ink':'#191920','--ink-2':'#26262e','--graphite':'#42424c','--steel':'#6c6c78','--ash':'#a0a0ac','--mist':'#c9c9d3',
    '--acc':'#7b7f9c','--acc-2':'#b3b7cd','--paper':'#f8f8fb','--paper-2':'#f0f0f5'}}
];
const SKIN_KEYS = ['--ink','--ink-2','--graphite','--steel','--ash','--mist','--acc','--acc-2','--paper','--paper-2'];
const SKIN_LABEL = {
  '--ink':'主文字','--ink-2':'正文','--graphite':'次文字','--steel':'弱文字','--ash':'标签','--mist':'极弱',
  '--acc':'强调色','--acc-2':'强调浅','--paper':'纸底','--paper-2':'纸底深'
};
const NUM_KEYS = [
  {k:'--fs',    l:'正文字号', min:12, max:19, step:.5, unit:'px'},
  {k:'--lh',    l:'行高',     min:1.5,max:2.2, step:.02,unit:''},
  {k:'--ls',    l:'字距',     min:0,  max:.09, step:.005,unit:'em'},
  {k:'--r-m',   l:'圆角',     min:6,  max:28,  step:1,  unit:'px'},
  {k:'--r-l',   l:'大圆角',   min:10, max:38,  step:1,  unit:'px'},
  {k:'--r-x',   l:'超大圆角', min:14, max:46,  step:1,  unit:'px'},
  {k:'--pad',   l:'页边距',   min:8,  max:26,  step:1,  unit:'px'},
  {k:'--op-card',l:'卡片不透明',min:.25,max:1,  step:.02,unit:''},
  {k:'--op-nav', l:'导航不透明',min:0,  max:1,  step:.02,unit:''},
  {k:'--op-top', l:'顶栏不透明',min:0,  max:1,  step:.02,unit:''},
  {k:'--wall-blur',l:'背景模糊',min:0, max:44,  step:1,  unit:'px'},
  {k:'--wall-veil',l:'背景白纱',min:0, max:1,   step:.02,unit:''},
  {k:'--wall-sat', l:'背景饱和',min:.3,max:1.8, step:.02,unit:''},
  {k:'--chat-veil',l:'私信白纱',min:0, max:1,   step:.02,unit:''},
  {k:'--txt-shadow-a',l:'文字阴影',min:0,max:1,step:.05,unit:''}
];
const FONT_SETS = [
  {k:'serif', n:'衬线', t:{'--f-cn':"'Noto Serif SC','Playfair Display',serif",'--f-body':"'Inter','Noto Sans SC',sans-serif"}},
  {k:'sans',  n:'无衬线', t:{'--f-cn':"'Noto Sans SC','Inter',sans-serif",'--f-body':"'Inter','Noto Sans SC',sans-serif"}},
  {k:'mix',   n:'混排', t:{'--f-cn':"'Playfair Display','Noto Serif SC',serif",'--f-body':"'Noto Sans SC','Inter',sans-serif"}},
  {k:'xiaowei', n:'清雅', t:{'--f-cn':"'ZCOOL XiaoWei','Noto Serif SC',serif",'--f-body':"'EB Garamond','Inter',sans-serif"}},
  {k:'brush', n:'行书', t:{'--f-cn':"'Zhi Mang Xing','Noto Serif SC',serif",'--f-body':"'Cormorant Garamond','Inter',sans-serif"}},
  {k:'cang', n:'龙藏', t:{'--f-cn':"'Long Cang','Noto Serif SC',serif",'--f-body':"'EB Garamond','Inter',sans-serif"}}
];

/* ================================================================
   5 · 文风预设
================================================================ */
const TONE_PRESETS = [
  {k:'cold',   n:'冷感克制', p:'语气冷、克制，句子短，情绪压在字底下。多用名词与动作，少用形容词。不解释情绪，只呈现事实。'},
  {k:'damp',   n:'潮湿文艺', p:'湿润、缓慢、有雾感。允许长句和逗号堆叠，意象来自天气、水、灯光、旧物。避免华丽词堆砌，重感官细节。'},
  {k:'sharp',  n:'尖锐锋利', p:'锋利、直接、带刺。善用反问和短促的判断句，敢下结论，允许刻薄但不下流。'},
  {k:'tender', n:'温柔絮语', p:'温柔、絮叨、有人味。像在耳边小声说话，会重复、会自我怀疑、会突然收住。'},
  {k:'netty',  n:'网感碎嘴', p:'口语化、跳跃、自嘲，敢用网络表达和缩写，句子长短不一，随时插入括号补充。禁止使用 emoji。'},
  {k:'classic',n:'古典雅致', p:'文白夹杂，节制典雅，用词考究，句式对仗但不做作。'},
  {k:'wry',    n:'冷幽默',   p:'表面平静，内里好笑。笑点藏在细节和落差里，绝不点破，不加解释。'},
  {k:'life',   n:'生活流',   p:'完全的生活质感：价格、品牌、路名、时间、天气、身体感受。不抒情，只记录，靠密度打动人。'},
  {k:'stream', n:'意识流',   p:'意识流动，逻辑可以断裂，时态可以跳跃，允许无标点长句和突然的停顿。'},
  {k:'film',   n:'电影感',   p:'像分镜：先给画面，再给动作，最后给一句台词。多用视觉调度，少用心理描写。'},
  {k:'diaryish',n:'日记腔',  p:'像写给自己看的日记，随手、松散、有错漏感，会写到一半跑题再拉回来。'},
  {k:'plain',  n:'白描',     p:'极简白描，不使用比喻，不使用形容词副词堆叠，只写发生了什么。'}
];

/* ================================================================
   6 · 状态
================================================================ */
const DEF = {
  profile:{ name:'', handle:'', bio:'', sign:'', avatar:null, cover:null,
            gender:'', birthday:'', location:'', link:'',
            followers:0, views:0, joined:Date.now() },
  settings:{
    uiLang:'zh-CN', contentLang:'zh-CN', transLang:'en',
    langMode:'fixed', langPool:['zh-CN','en','ja'],
    authorSource:'mix',            /* mix | chars | npc */
    wall:null, chatWall:null, meWall:null,
    ccTheme:'ink', ccCss:'',
    skin:'porcelain', tokens:{}, fontSet:'serif',
    tone:['cold'], toneCustom:'', world:'', taboo:'', persona:'',
    autoNpc:true
  },
  skinPresets:[], tonePresets:[],
  posts:[], npcs:[], cats:[], curCat:'all',
  threads:[], msgs:{}, notifs:[], lamps:{},
  follows:{ extra:[], off:[] },
  charMeta:{},
  stats:{ view:0, like:0, cm:0, rp:0, history:[] },
  topic:null, seenBoot:false, recentAuthors:[]
};
let S = JSON.parse(JSON.stringify(DEF));
let CHARS = [];
const charById = id => CHARS.find(c=>String(c.id)===String(id));
const npcById  = id => S.npcs.find(c=>String(c.id)===String(id));
/* 统一的「人」查找：角色库 / AI 博主 / 我 */
function anyById(id){
  if(id==='me'||id==null) return null;
  return charById(id) || npcById(id) || null;
}
function allAuthors(){
  const src = S.settings.authorSource;
  if(src==='chars') return CHARS.slice();
  if(src==='npc')   return S.npcs.slice();
  return CHARS.concat(S.npcs);
}

let _saveT=null;
function save(){ clearTimeout(_saveT); _saveT=setTimeout(()=>{ kvSet('state',S); },260); }
async function loadState(){
  const v = await kvGet('state');
  if(v && typeof v==='object'){
    S = Object.assign(JSON.parse(JSON.stringify(DEF)), v);
    S.settings = Object.assign({},DEF.settings,v.settings||{});
    S.profile  = Object.assign({},DEF.profile,v.profile||{});
    S.follows  = Object.assign({},DEF.follows,v.follows||{});
    S.stats    = Object.assign({},DEF.stats,v.stats||{});
    S.npcs = v.npcs||[]; S.cats = v.cats||[]; S.lamps = v.lamps||{};
    S.skinPresets = v.skinPresets||[]; S.tonePresets = v.tonePresets||[];
  }
  _ui = S.settings.uiLang || 'zh-CN';
  migratePosts();
}
/* 旧数据补全：保证每条帖子的体裁字段一定存在，老存档也不会掉格式 */
function migratePosts(){
  (S.posts||[]).forEach(p=>{
    if(!TYPE_LIST.includes(p.type)) p.type='essay';
    if(!p.lang) p.lang=S.settings.contentLang;
    if(!p.cat)  p.cat=null;
    if(CHAT_TYPES.includes(p.type)){
      if(!p.chat||!Array.isArray(p.chat.messages)||!p.chat.messages.length){ p.type='essay'; p.chat=null; }
    }else{
      p.chat=null;
      const f=TYPES[p.type].field;
      if(f!=='text' && (p[f]==null || (Array.isArray(p[f])&&!p[f].length))) p[f]=fillByType(p.type,p,p.text);
    }
    (p.comments||[]).forEach(c=>{ c.replies=c.replies||[]; if(c.uid===undefined) c.uid=c.charId!=null?c.charId:null; });
  });
}
const isFollowed = id => id==='me' ? true : !S.follows.off.includes(String(id));
function toggleFollow(id){
  const k=String(id), i=S.follows.off.indexOf(k);
  if(i>=0){ S.follows.off.splice(i,1); } else S.follows.off.push(k);
  save();
}
const followingCount = () => allAuthors().filter(c=>isFollowed(c.id)).length + (S.follows.extra?S.follows.extra.length:0);

/* ================================================================
   7 · 反馈
================================================================ */
let _toastT=null;
function toast(msg){
  const el=$('#yhToast'); if(!el) return;
  el.textContent=msg; el.classList.add('in');
  clearTimeout(_toastT); _toastT=setTimeout(()=>el.classList.remove('in'),2200);
}
function busy(on,txt){ const el=$('#yhBusy'); if(!el) return; if(txt) $('#busyTxt').textContent=txt; el.classList.toggle('in',!!on); }

/* ================================================================
   8 · AI 引擎
================================================================ */
function apiCfg(){
  let cur={};
  try{ cur=JSON.parse(localStorage.getItem('luna_api_current')||'{}'); }catch(e){}
  return { baseUrl:(cur.baseUrl||'').replace(/\/+$/,''), apiKey:cur.apiKey||'', model:localStorage.getItem('luna_api_model')||'' };
}
function hasApi(){ const c=apiCfg(); return !!(c.baseUrl && c.apiKey); }
async function aiCall(sys,user,opt){
  opt=opt||{};
  const c=apiCfg();
  if(!c.baseUrl||!c.apiKey){ toast(T('noapi')); throw new Error('NOAPI'); }
  const r = await fetch(c.baseUrl+'/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+c.apiKey},
    body: JSON.stringify({ model:c.model||'gpt-4o-mini',
      messages:[{role:'system',content:sys},{role:'user',content:user}],
      temperature: opt.temp==null?0.98:opt.temp, max_tokens: opt.max||2600 })
  });
  if(!r.ok){ let d=''; try{ d=(await r.text()).slice(0,180); }catch(e){} throw new Error('HTTP '+r.status+' '+d); }
  const j = await r.json();
  const m = j.choices && j.choices[0] && j.choices[0].message;
  let t='';
  if(m) t = typeof m.content==='string' ? m.content : (Array.isArray(m.content)? m.content.map(x=>x.text||'').join('') : '');
  return t||'';
}
function cutJson(t){
  if(!t) return null;
  let s = t.replace(/```json/gi,'```').split('```').length>1 ? t.split('```')[1] : t;
  s = s.replace(/^json\s*/i,'').trim();
  const a=s.indexOf('['), o=s.indexOf('{');
  let st=(a<0)?o:(o<0)?a:Math.min(a,o);
  if(st<0) return null;
  const open=s[st], close=open==='['?']':'}';
  let dep=0,inS=false,q='',bs=false,end=-1;
  for(let i=st;i<s.length;i++){
    const ch=s[i];
    if(bs){ bs=false; continue; }
    if(ch==='\\'){ bs=true; continue; }
    if(inS){ if(ch===q) inS=false; continue; }
    if(ch==='"'||ch==="'"){ inS=true; q=ch; continue; }
    if(ch===open) dep++;
    else if(ch===close){ dep--; if(dep===0){ end=i; break; } }
  }
  if(end<0) return null;
  try{ return JSON.parse(s.slice(st,end+1)); }
  catch(e){ try{ return JSON.parse(s.slice(st,end+1).replace(/,\s*([}\]])/g,'$1')); }catch(e2){ return null; } }
}
async function aiJson(sys,user,opt){
  const raw = await aiCall(sys+'\n\n【硬性要求】只输出合法 JSON，不要任何解释、前后缀或 markdown 代码块标记。', user, opt);
  const j = cutJson(raw);
  if(!j) throw new Error('返回格式不合法');
  return j;
}

/* ── 人物档案压缩 ── */
function charBrief(c,full){
  if(!c) return '';
  const L=[];
  L.push('#'+c.id+' 「'+(c.name||'')+'」'+(c.handle?(' @'+c.handle):''));
  if(c.role) L.push('身份：'+c.role);
  if(c.gender||c.age) L.push('性别年龄：'+(c.gender||'')+' '+(c.age||''));
  if(c.sign) L.push('签名：'+c.sign);
  if(c.desc) L.push('简介：'+String(c.desc).slice(0,full?400:150));
  if(c.traits&&c.traits.length) L.push('特质：'+c.traits.join('、'));
  if(c.speechStyle) L.push('说话风格：'+String(c.speechStyle).slice(0,180));
  if(c.catchphrases&&c.catchphrases.length) L.push('口头禅：'+c.catchphrases.join('、'));
  if(c.likes&&c.likes.length) L.push('喜欢：'+c.likes.join('、'));
  if(c.dislikes&&c.dislikes.length) L.push('讨厌：'+c.dislikes.join('、'));
  if(c.lang) L.push('惯用语言：'+langName(c.lang));
  if(full){
    if(c.appearance) L.push('外貌：'+String(c.appearance).slice(0,200));
    if(c.backstory) L.push('背景：'+String(c.backstory).slice(0,320));
    if(c.scenario) L.push('当前处境：'+String(c.scenario).slice(0,240));
    if(c.relation) L.push('与用户关系：'+c.relation);
    if(c.callUser) L.push('称呼用户：'+c.callUser);
    if(c.bio) L.push('自述：'+String(c.bio).slice(0,300));
    if(c.prompt) L.push('设定补充：'+String(c.prompt).slice(0,500));
  }
  return L.join('\n');
}
const charsBrief = (l,f)=> l.map(c=>charBrief(c,f)).join('\n---\n');
function meBrief(){
  const p=S.profile;
  const L=['用户本人：'+(p.name||'未署名的旅人')+(p.handle?(' @'+p.handle):'')];
  if(p.sign) L.push('签名：'+p.sign);
  if(p.bio) L.push('自述：'+String(p.bio).slice(0,300));
  if(p.gender) L.push('性别：'+p.gender);
  if(p.location) L.push('所在：'+p.location);
  if(S.settings.persona) L.push('用户补充设定：'+String(S.settings.persona).slice(0,400));
  return L.join('\n');
}

/* ── 用户自定义世界观 / 文风 ── */
function toneBlock(){
  const st=S.settings, L=[];
  const sel=(st.tone||[]).map(k=>(TONE_PRESETS.find(t=>t.k===k)||{}).p).filter(Boolean);
  if(sel.length) L.push('【文风要求】\n'+sel.join('\n'));
  if(st.toneCustom) L.push('【用户自定义文风（优先级最高，必须遵守）】\n'+st.toneCustom);
  if(st.world) L.push('【世界观设定（所有内容必须自洽于此，不得跳出）】\n'+st.world);
  if(st.taboo) L.push('【禁止出现】\n'+st.taboo);
  return L.join('\n\n');
}
const LANG_RULE = lang => '本条内容的正文必须完整使用【'+langName(lang)+'（'+langEn(lang)+'）】书写，不要中英混杂，人名与专有名词保持原样。';
function APP_SYS(lang){
  return `你是社交应用「夜话馆」的内容引擎。夜话馆是一个深夜树洞式社区，用户与许多博主共处一个广场，气质安静、克制、有文学性，但绝不空洞抒情——每条内容都必须有具体的生活细节、时间、地点、动作或对话。
${lang?LANG_RULE(lang):''}
基本要求：像真人半夜发的东西，允许口语、断句、自嘲、突然的沉默；禁止使用 emoji 与颜文字；禁止说教和心灵鸡汤式总结；禁止出现"作为一个AI"之类的话；禁止在正文里出现字段名或 JSON 语法。
${toneBlock()}`;
}
function bumpStats(p,k,d){ p.stats=p.stats||{like:0,cm:0,rp:0,view:0}; p.stats[k]=Math.max(0,(p.stats[k]||0)+d); }
window.__YH = { get S(){return S;}, get CHARS(){return CHARS;} };

/* ================================================================
   9 · 图标
================================================================ */
const I = {
  heart:'<svg viewBox="0 0 24 24"><path d="M12 20s-7.3-4.6-9.1-9A5 5 0 0 1 12 6.6 5 5 0 0 1 21.1 11C19.3 15.4 12 20 12 20z"/></svg>',
  cm:'<svg viewBox="0 0 24 24"><path d="M20.5 12.2c0 4-3.8 7.2-8.5 7.2a9.8 9.8 0 0 1-2.8-.4L4 20.5l1.6-3.7A6.9 6.9 0 0 1 3.5 12.2C3.5 8.2 7.3 5 12 5s8.5 3.2 8.5 7.2z"/></svg>',
  rp:'<svg viewBox="0 0 24 24"><path d="M17 3.5l3.5 3.5L17 10.5M20.5 7H8.5A4 4 0 0 0 4.5 11v1M7 20.5L3.5 17 7 13.5M3.5 17h12a4 4 0 0 0 4-4v-1"/></svg>',
  star:'<svg viewBox="0 0 24 24"><path d="M6 3.5h12v17l-6-4.2-6 4.2z"/></svg>',
  send:'<svg viewBox="0 0 24 24"><path d="M4.5 12l15.5-7-6 7 6 7z"/></svg>',
  eye:'<svg viewBox="0 0 24 24"><path d="M2.6 12S6 5.9 12 5.9 21.4 12 21.4 12 18 18.1 12 18.1 2.6 12 2.6 12z"/><circle cx="12" cy="12" r="2.6"/></svg>',
  back:'<svg viewBox="0 0 24 24"><path d="M14.5 5.5L8 12l6.5 6.5"/></svg>',
  chev:'<svg viewBox="0 0 24 24" class="chev"><path d="M9.5 5.5L16 12l-6.5 6.5"/></svg>',
  down:'<svg viewBox="0 0 24 24"><path d="M6.5 9.5L12 15l5.5-5.5"/></svg>',
  x:'<svg viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
  spark:'<svg viewBox="0 0 24 24"><path d="M12 3.4l1.7 4.6 4.6 1.7-4.6 1.7L12 16l-1.7-4.6L5.7 9.7l4.6-1.7z"/><path d="M18.6 15.4l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z"/></svg>',
  cam:'<svg viewBox="0 0 24 24"><path d="M3.5 8.5h3l1.4-2.2h7.2L16.5 8.5h4v10h-17z"/><circle cx="12" cy="13.2" r="3.1"/></svg>',
  img:'<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="2.6"/><circle cx="8.6" cy="9.8" r="1.4"/><path d="M4 16.5l4.4-4 3.4 3 2.8-2.4 5 4.4"/></svg>',
  edit:'<svg viewBox="0 0 24 24"><path d="M15.5 4.6l3.9 3.9L8.6 19.3l-4.6.7.7-4.6z"/></svg>',
  user:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8.2" r="3.7"/><path d="M4.6 20c0-3.6 3.3-5.9 7.4-5.9s7.4 2.3 7.4 5.9"/></svg>',
  globe:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.4"/><path d="M3.6 12h16.8M12 3.6c2.4 2.6 2.4 14.2 0 16.8M12 3.6c-2.4 2.6-2.4 14.2 0 16.8"/></svg>',
  chart:'<svg viewBox="0 0 24 24"><path d="M4.5 19.5V11M9.8 19.5V5.5M15.2 19.5v-6M20.5 19.5V8.5"/></svg>',
  tr:'<svg viewBox="0 0 24 24"><path d="M3.6 6.4h8M7.4 4.4v2M9.6 6.4c0 3.6-2.6 7-6 8.4M5.2 9.6c1.2 2.4 3.4 4.2 5.6 5M12.6 19.6l3.8-9.2 3.8 9.2M13.9 16.6h5.1"/></svg>',
  copy:'<svg viewBox="0 0 24 24"><rect x="8.4" y="8.4" width="11" height="11" rx="2.4"/><path d="M15.6 5.6H6.8a2.4 2.4 0 0 0-2.4 2.4v8.8"/></svg>',
  trash:'<svg viewBox="0 0 24 24"><path d="M4.6 6.6h14.8M9.4 6.6V4.4h5.2v2.2M6.4 6.6l.9 13h9.4l.9-13"/></svg>',
  quote:'<svg viewBox="0 0 24 24"><path d="M9.4 6.4C6.6 7.6 5 10 5 12.8c0 2.4 1.4 4 3.4 4s3.2-1.4 3.2-3.3-1.3-3.2-3-3.2h-.5c.2-1.4 1.1-2.6 2.4-3.3zM19.4 6.4c-2.8 1.2-4.4 3.6-4.4 6.4 0 2.4 1.4 4 3.4 4s3.2-1.4 3.2-3.3-1.3-3.2-3-3.2h-.5c.2-1.4 1.1-2.6 2.4-3.3z"/></svg>',
  bolt:'<svg viewBox="0 0 24 24"><path d="M13.4 3.5L5.5 13.4h5.2l-.8 7.1 8.1-10h-5.3z"/></svg>',
  play:'<svg viewBox="0 0 24 24"><path d="M8 5.6l10 6.4-10 6.4z"/></svg>',
  music:'<svg viewBox="0 0 24 24"><path d="M9.4 18V6.2l9.2-2v11.6"/><circle cx="6.8" cy="18" r="2.6"/><circle cx="16" cy="15.8" r="2.6"/></svg>',
  pin:'<svg viewBox="0 0 24 24"><path d="M12 21s6.4-6 6.4-10.4A6.4 6.4 0 0 0 5.6 10.6C5.6 15 12 21 12 21z"/><circle cx="12" cy="10.4" r="2.3"/></svg>',
  cake:'<svg viewBox="0 0 24 24"><path d="M4.4 19.4h15.2v-6.2H4.4zM4.4 15.6c1.6 0 1.6-1.4 3.2-1.4s1.6 1.4 3.2 1.4 1.6-1.4 3.2-1.4 1.6 1.4 3.2 1.4M8.4 10.4V8M12 10.4V7.4M15.6 10.4V8"/></svg>',
  link:'<svg viewBox="0 0 24 24"><path d="M10.4 13.6a3.6 3.6 0 0 0 5.2 0l2.8-2.8a3.6 3.6 0 0 0-5.1-5.1l-1.4 1.4M13.6 10.4a3.6 3.6 0 0 0-5.2 0l-2.8 2.8a3.6 3.6 0 0 0 5.1 5.1l1.4-1.4"/></svg>',
  cal:'<svg viewBox="0 0 24 24"><rect x="4" y="5.6" width="16" height="14" rx="2.4"/><path d="M4 10h16M8.6 3.6v3.4M15.4 3.6v3.4"/></svg>',
  layers:'<svg viewBox="0 0 24 24"><path d="M12 3.6l8.4 4.4L12 12.4 3.6 8zM3.6 12.4L12 16.8l8.4-4.4M3.6 16.4L12 20.8l8.4-4.4"/></svg>',
  bell:'<svg viewBox="0 0 24 24"><path d="M6.4 10.4a5.6 5.6 0 0 1 11.2 0c0 4 1.6 5.4 1.6 5.4H4.8s1.6-1.4 1.6-5.4z"/><path d="M10.2 19a2 2 0 0 0 3.6 0"/></svg>',
  lamp:'<svg viewBox="0 0 24 24"><path d="M12 3.2a5.4 5.4 0 0 1 3.4 9.6c-.7.6-1 1.3-1 2.1v.5H9.6v-.5c0-.8-.3-1.5-1-2.1A5.4 5.4 0 0 1 12 3.2z"/><path d="M9.9 18h4.2M10.6 20.5h2.8"/></svg>',
  plus:'<svg viewBox="0 0 24 24"><path d="M12 5.6v12.8M5.6 12h12.8"/></svg>',
  dots:'<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/></svg>',
  check:'<svg viewBox="0 0 24 24"><path d="M5 12.6l4.6 4.4L19 7"/></svg>',
  reply:'<svg viewBox="0 0 24 24"><path d="M9.5 6.5L4.5 11l5 4.5M4.5 11h9a6 6 0 0 1 6 6v1.5"/></svg>',
  wave:'<svg viewBox="0 0 24 24"><path d="M3.5 12h2.6l1.8-6 2.6 12 2.4-9 1.8 5.4 1.6-2.4h4.2"/></svg>',
  book:'<svg viewBox="0 0 24 24"><path d="M4.4 5.2h6a2.8 2.8 0 0 1 2.8 2.8v11a2.2 2.2 0 0 0-2.2-2.2H4.4zM19.6 5.2h-6A2.8 2.8 0 0 0 10.8 8v11a2.2 2.2 0 0 1 2.2-2.2h6.6z"/></svg>',
  moon:'<svg viewBox="0 0 24 24"><path d="M20 14.4A8.4 8.4 0 0 1 9.6 4 8.6 8.6 0 1 0 20 14.4z"/></svg>',
  list:'<svg viewBox="0 0 24 24"><path d="M8.4 7h11M8.4 12h11M8.4 17h11M4.6 7h.02M4.6 12h.02M4.6 17h.02"/></svg>',
  ask:'<svg viewBox="0 0 24 24"><path d="M9.4 9.2a2.7 2.7 0 1 1 3.4 2.6c-.7.2-1 .8-1 1.5v.5"/><circle cx="11.9" cy="17.2" r="1"/><circle cx="12" cy="12" r="8.4"/></svg>',
  mail:'<svg viewBox="0 0 24 24"><rect x="3.5" y="5.6" width="17" height="12.8" rx="2.4"/><path d="M4 7.4l8 5.4 8-5.4"/></svg>',
  poll:'<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="4.2" rx="2.1"/><rect x="4" y="14.8" width="10" height="4.2" rx="2.1"/></svg>',
  scroll:'<svg viewBox="0 0 24 24"><path d="M7 4.6h10a2 2 0 0 1 2 2v10.8a2 2 0 0 1-2 2H7"/><path d="M7 4.6a2 2 0 0 0-2 2v1.8h4M9 12h6M9 15.4h4"/></svg>',
  clip:'<svg viewBox="0 0 24 24"><path d="M15.6 8.4l-6 6a2.5 2.5 0 0 0 3.6 3.6l6.4-6.4a4.6 4.6 0 0 0-6.5-6.5L6.4 11.8a6.7 6.7 0 0 0 9.5 9.5"/></svg>',
  grid:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.8"/></svg>',
  sliders:'<svg viewBox="0 0 24 24"><path d="M5 6.5h14M5 12h14M5 17.5h14"/><circle cx="9.4" cy="6.5" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="17.5" r="2"/></svg>',
  tag:'<svg viewBox="0 0 24 24"><path d="M4.6 11.4V4.6h6.8l8 8-6.8 6.8z"/><circle cx="8.2" cy="8.2" r="1.2"/></svg>',
  code:'<svg viewBox="0 0 24 24"><path d="M8.6 8.4L4.6 12l4 3.6M15.4 8.4l4 3.6-4 3.6M13.4 5.6l-2.8 12.8"/></svg>'
};
const TYPE_ICON = {
  essay:I.scroll, moment:I.bolt, diary:I.cal, chatlog:I.cm, cp:I.heart, list:I.list, verse:I.moon,
  ask:I.ask, quote:I.quote, letter:I.mail, playlist:I.music, review:I.star, poll:I.poll,
  dream:I.moon, thread:I.layers, snippet:I.book, voice:I.wave
};

/* ================================================================
   10 · 外观应用
================================================================ */
function currentTokens(){
  const sk = SKINS.find(s=>s.k===S.settings.skin) || SKINS[0];
  const fs = FONT_SETS.find(f=>f.k===S.settings.fontSet) || FONT_SETS[0];
  return Object.assign({}, sk.t, fs.t, S.settings.tokens||{});
}
function tokenAlpha(hex,a){
  const h=String(hex||'#141420').replace('#','');
  const n=h.length===3?h.split('').map(x=>x+x).join(''):h;
  const r=parseInt(n.slice(0,2),16)||20,g=parseInt(n.slice(2,4),16)||20,b=parseInt(n.slice(4,6),16)||26;
  return 'rgba('+r+','+g+','+b+','+a+')';
}
function applySkin(){
  const t = currentTokens();
  const ink = t['--ink']||'#14141a', acc = t['--acc']||'#6f6f86';
  const lines = {
    '--line':   tokenAlpha(ink,.075),
    '--line-2': tokenAlpha(ink,.14),
    '--line-3': tokenAlpha(ink,.24),
    '--hair':   tokenAlpha(ink,.055),
    '--acc-soft': tokenAlpha(acc,.10),
    '--acc-glow': tokenAlpha(acc,.22)
  };
  const all = Object.assign({},t,lines);
  let css=':root{';
  Object.keys(all).forEach(k=>{
    let v=all[k];
    const nk = NUM_KEYS.find(x=>x.k===k);
    if(nk && typeof v!=='string') v = v+nk.unit;
    css += k+':'+v+';';
  });
  css+='}';
  const el=$('#yhThemeVars'); if(el) el.textContent=css;
}
function applyCss(){ const el=$('#ccUserStyle'); if(el) el.textContent=S.settings.ccCss||''; }
function applyWall(){
  const w=$('#yhWall'), app=$('#yhApp'); if(!w) return;
  if(S.settings.wall){
    w.style.backgroundImage='url('+S.settings.wall+')'; w.classList.add('on'); if(app) app.classList.add('has-wall');
    /* 首次设置背景图时，若用户还没手动调过文字阴影，给一个够用的默认值，
       避免深色背景把文字糊掉；用户在「排版与透明度」里仍可随时调回 0 */
    if(S.settings.tokens['--txt-shadow-a']==null){ S.settings.tokens['--txt-shadow-a']=.55; applySkin(); }
  }
  else { w.style.backgroundImage=''; w.classList.remove('on'); if(app) app.classList.remove('has-wall'); }
}
function applyLang(){
  _ui=S.settings.uiLang;
  $$('[data-i18n]').forEach(el=>{ el.textContent=T(el.dataset.i18n); });
  const cur=$('.nav-i.is-active'); setScreen(cur?cur.dataset.scr:'feed',true);
}

/* ================================================================
   11 · 头像
================================================================ */
function avaHtml(a,cls){
  cls = cls||'md';
  if(!a) return '<div class="ava '+cls+'">?</div>';
  if(a.avatar) return '<div class="ava '+cls+'"><img src="'+esc(a.avatar)+'" alt=""></div>';
  const h = strHash(a.name||a.id||'x');
  const hue = h%360, hue2=(hue+38)%360;
  const bg = 'linear-gradient(145deg,hsl('+hue+',26%,95%),hsl('+hue2+',22%,86%))';
  return '<div class="ava '+cls+'" style="background:'+bg+'">'+esc(initial(a.name))+'</div>';
}
function authorOf(p){
  if(p.authorId==='me'||!p.authorId) return { id:'me', name:S.profile.name||'未署名的旅人', avatar:S.profile.avatar, handle:S.profile.handle||'unsigned' };
  const c = anyById(p.authorId);
  if(c) return { id:c.id, name:c.name||p.authorName||'', avatar:c.avatar||null, handle:c.handle||'', ai:!!c.__npc };
  return { id:p.authorId, name:p.authorName||'匿名', avatar:p.authorAvatar||null, handle:'' };
}

/* ================================================================
   12 · 分类（隐藏收纳）
================================================================ */
function catById(id){ return S.cats.find(c=>c.id===id); }
function ensureCat(name){
  const nm = (name||'').trim() || '自由夜';
  let c = S.cats.find(x=>x.name===nm);
  if(!c){ c={ id:uid(), name:nm, en:'SET '+String(S.cats.length+1).padStart(2,'0'), ts:Date.now() }; S.cats.unshift(c); }
  return c;
}
const catCount = id => S.posts.filter(p=>p.cat===id).length;
function visiblePosts(){
  if(S.curCat==='all') return S.posts;
  if(S.curCat==='mine') return S.posts.filter(p=>p.authorId==='me');
  return S.posts.filter(p=>p.cat===S.curCat);
}
function renderCats(){
  const rail=$('#catRail'); if(!rail) return;
  let h = '<button class="cat-chip'+(S.curCat==='all'?' on':'')+'" data-cat="all"><b>'+esc(T('all'))+'</b><em>'+S.posts.length+'</em></button>';
  h += '<button class="cat-chip'+(S.curCat==='mine'?' on':'')+'" data-cat="mine"><b>我的</b><em>'+S.posts.filter(p=>p.authorId==='me').length+'</em></button>';
  h += S.cats.map(c=>'<button class="cat-chip'+(S.curCat===c.id?' on':'')+'" data-cat="'+c.id+'"><b>'+esc(c.name)+'</b><em>'+catCount(c.id)+'</em></button>').join('');
  h += '<button class="cat-chip ghost" data-act="mancat">管理收纳</button>';
  rail.innerHTML=h;
}

/* ================================================================
   13 · 留影卡（聊天截图）
================================================================ */
function ccAvatar(p){
  if(!p) return '<div class="cc-mini">?</div>';
  if(p.avatar) return '<div class="cc-mini"><img src="'+esc(p.avatar)+'" alt=""></div>';
  return '<div class="cc-mini">'+esc(initial(p.name))+'</div>';
}
const MIN_MSGS_PER_SHOT = 4;
function splitChatShots(chat, seedKey){
  const ms = chat.messages||[];
  if(ms.length <= 7) return [ms];
  const rand = seededRand(strHash(seedKey||'x'));
  const shots=[]; let i=0;
  while(i<ms.length){
    let n = MIN_MSGS_PER_SHOT + Math.floor(rand()*4);
    if(ms.length - (i+n) < MIN_MSGS_PER_SHOT) n = ms.length - i;
    shots.push(ms.slice(i,i+n)); i+=n;
  }
  return shots;
}
function renderChatShot(chat,msgs,opt){
  opt=opt||{};
  const th = chat.theme||S.settings.ccTheme;
  const who = s => (chat.participants||[]).find(p=>p.side===s) || (chat.participants||[])[0] || {name:''};
  let h = '<div class="cc" data-theme="'+esc(th)+'">';
  h += '<div class="cc-head">'+ccAvatar(who('left'))
     + '<div class="cc-hb"><div class="cc-tt">'+esc(chat.title||who('left').name||'对话')+'</div>'
     + (chat.clock?'<div class="cc-ck">'+esc(chat.clock)+'</div>':'')+'</div>'
     + '<div class="cc-mk">'+esc(chat.mark||'NIGHT TALK')+'</div></div>';
  h += '<div class="cc-body">';
  msgs.forEach(m=>{
    if(m.kind==='time'){ h+='<div class="cc-time">'+esc(m.text||'')+'</div>'; return; }
    if(m.kind==='sys'){ h+='<div class="cc-sys">'+esc(m.text||'')+'</div>'; return; }
    const r = m.side==='right';
    h+='<div class="cc-row'+(r?' r':'')+'">'+ccAvatar(who(m.side||'left'));
    if(m.kind==='voice'){
      h+='<div class="cc-b"><span class="cc-v"><span class="wv">'+waves(clamp(Math.round((m.dur||6)/1.5),5,16),3,11)+'</span><span class="d">'+(m.dur||6)+'"</span></span></div>';
    }else if(m.kind==='img'){
      h+='<div class="cc-img"></div>';
    }else if(m.kind==='pay'){
      h+='<div class="cc-pay"><b>'+esc(m.amount||'0.00')+'</b><span>'+esc(m.note||'TRANSFER')+'</span></div>';
    }else{
      h+='<div class="cc-b">'+(m.quote?'<span class="cc-q">'+esc(m.quote)+'</span>':'')+esc(m.text||'')+'</div>';
    }
    h+='</div>';
  });
  h+='</div>';
  h+='<div class="cc-foot"><i></i><span>'+esc(opt.foot||'夜话馆 · CAPTURE')+'</span><i></i></div>';
  h+='</div>';
  return h;
}
function renderChatCard(chat,opt){
  opt=opt||{};
  const shots = splitChatShots(chat, opt.seed||'');
  if(shots.length===1) return '<div class="cc-gal one"><div class="cc-wrap" data-ccidx="0">'+renderChatShot(chat,shots[0],opt)+'</div></div>';
  let h='<div class="cc-gal" data-ccgal="'+esc(opt.postId||'')+'">';
  shots.forEach((s,i)=>{ h+='<div class="cc-wrap" data-ccidx="'+i+'">'+renderChatShot(chat,s,opt)+'</div>'; });
  h+='</div>';
  h+='<div class="cc-pg" data-ccpg="'+esc(opt.postId||'')+'">'+shots.map((s,i)=>'<i'+(i===0?' class="on"':'')+'></i>').join('')+'</div>';
  return h;
}

/* ================================================================
   14 · 帖子正文渲染（严格按体裁，绝不串格式）
================================================================ */
function postBody(p,full){
  const t = p.type;
  let h = '';
  if(p.title && t!=='quote' && t!=='letter') h += '<div class="p-title">'+esc(p.title)+'</div>';

  if(t==='chatlog' || t==='cp'){
    if(p.text) h += '<div class="p-text'+(full?'':' clip')+'">'+esc(p.text)+'</div>';
    if(p.chat) h += renderChatCard(p.chat,{postId:p.id,seed:p.id,foot:t==='cp'?'夜话馆 · SHIP':'夜话馆 · CAPTURE'});
  }
  else if(t==='list'){
    if(p.text) h += '<div class="p-text">'+esc(p.text)+'</div>';
    h += '<ul class="b-list">'+(p.list||[]).map((x,i)=>'<li><span class="n">'+String(i+1).padStart(2,'0')+'</span><span class="t">'+esc(x)+'</span></li>').join('')+'</ul>';
  }
  else if(t==='verse'){
    h += '<div class="b-verse"><p>'+esc(p.verse||'').replace(/\n/g,'\n')+'</p></div>';
  }
  else if(t==='ask'){
    h += '<div class="b-ask"><div class="q">'+esc(p.ask.q)+'</div><div class="a">'+esc(p.ask.a)+'</div></div>';
  }
  else if(t==='quote'){
    h += '<div class="b-quote"><div class="qt">'+esc(p.quote.text)+'</div><div class="qb"><i></i><span>'+esc(p.quote.by||'—')+'</span></div></div>';
    if(p.text) h += '<div class="p-text" style="margin-top:10px">'+esc(p.text)+'</div>';
  }
  else if(t==='moment'){
    h += '<div class="b-moment"><div class="mt">'+esc(p.moment.text)+'</div><div class="mm">'
       + (p.moment.clock?'<span>'+esc(p.moment.clock)+'</span><i></i>':'')
       + '<span>'+esc(p.moment.place||'某处')+'</span></div></div>';
  }
  else if(t==='diary'){
    h += '<div class="b-diary"><div class="b-diary-h"><span class="dd">'+esc(p.diary.day||'--')+'</span>'
       + '<span class="dm">'+esc(p.diary.month||'')+'</span>'
       + '<span class="dw">'+esc(p.diary.weather||'')+'</span></div>'
       + '<div class="b-diary-b">'+esc(p.diary.body||'')+'</div></div>';
  }
  else if(t==='letter'){
    h += '<div class="b-letter"><div class="lt-to">'+esc(p.letter.to||'致 未署名的你')+'</div>'
       + '<div class="lt-b">'+esc(p.letter.body||'')+'</div>'
       + '<div class="lt-sg">'+esc(p.letter.sign||'')+'</div></div>';
  }
  else if(t==='playlist'){
    h += '<div class="b-pl"><div class="b-pl-h"><div class="cov">'+I.music+'</div>'
       + '<div style="flex:1;min-width:0"><b>'+esc(p.playlist.name||'无名歌单')+'</b><span>'+(p.playlist.tracks||[]).length+' TRACKS</span></div></div>'
       + (p.playlist.tracks||[]).map((tk,i)=>'<div class="b-pl-i"><span class="no">'+String(i+1).padStart(2,'0')+'</span>'
         + '<div class="tk"><b>'+esc(tk.title||'')+'</b><span>'+esc(tk.artist||'')+'</span>'
         + (tk.note?'<em>'+esc(tk.note)+'</em>':'')+'</div>'
         + '<div class="bars">'+waves(4,4,13)+'</div></div>').join('')
       + '</div>';
    if(p.text) h += '<div class="p-text" style="margin-top:10px">'+esc(p.text)+'</div>';
  }
  else if(t==='review'){
    const sc = parseFloat(p.review.score)||0;
    const stars = Math.round(sc/2);
    h += '<div class="b-review"><div class="b-rv-h"><div class="obj"><b>'+esc(p.review.object||'')+'</b><span>'+esc(p.review.kind||'REVIEW')+'</span></div>'
       + '<div class="b-rv-score"><b>'+esc(String(sc.toFixed(1)))+'</b><span>SCORE</span></div></div>'
       + '<div class="b-rv-stars">'+[1,2,3,4,5].map(i=>'<i'+(i<=stars?' class="on"':'')+'></i>').join('')+'</div>'
       + '<div class="b-rv-b">'+esc(p.review.body||'')+'</div></div>';
  }
  else if(t==='poll'){
    const total = p.poll.total||0;
    h += '<div class="b-poll"><div class="pq">'+esc(p.poll.q||'')+'</div>'
       + (p.poll.options||[]).map((o,i)=>'<div class="b-poll-o'+(p.poll.voted===i?' mine':'')+'" data-poll="'+i+'" data-pid="'+p.id+'">'
         + '<span class="fill" style="width:'+clamp(o.pct||0,0,100)+'%"></span>'
         + '<span class="lb">'+esc(o.label||'')+'</span><span class="pc">'+(o.pct||0)+'%</span></div>').join('')
       + '<div class="b-poll-f"><span>'+nfmt(total)+' 人已投</span>'+(p.poll.voted!=null?'<span>· 你选了 '+esc((p.poll.options[p.poll.voted]||{}).label||'')+'</span>':'<span>· 点选项参与</span>')+'</div></div>';
    if(p.text) h += '<div class="p-text" style="margin-top:10px">'+esc(p.text)+'</div>';
  }
  else if(t==='dream'){
    h += '<div class="b-dream"><div class="dl"><span>DREAM LOG</span><i></i></div>'
       + '<div class="db">'+esc(p.dream.body||'')+'</div>'
       + (p.dream.wake?'<div class="dw">'+esc(p.dream.wake)+'</div>':'')+'</div>';
  }
  else if(t==='thread'){
    h += '<div class="b-thread">'+(p.thread||[]).map((x,i)=>'<div class="b-thread-i"><div class="no">'+String(i+1)+' / '+p.thread.length+'</div><div class="tx">'+esc(x)+'</div></div>').join('')+'</div>';
  }
  else if(t==='snippet'){
    h += '<div class="b-snip"><div class="st">'+esc(p.snippet.text||'')+'</div>'
       + '<div class="sf">—— '+esc(p.snippet.from||'佚名')+'</div>'
       + (p.snippet.note?'<div class="sn">'+esc(p.snippet.note)+'</div>':'')+'</div>';
  }
  else if(t==='voice'){
    const d = p.voice.dur||12;
    h += '<div class="b-voice"><div class="b-voice-bar"><span class="pl">'+I.play+'</span>'
       + '<span class="wv">'+waves(clamp(Math.round(d/1.2),10,26),4,20)+'</span>'
       + '<span class="dur">'+d+'"</span></div>'
       + (p.voice.transcript?'<div class="b-voice-tx"><div class="lb">Transcript</div>'+esc(p.voice.transcript)+'</div>':'')
       + '</div>';
  }
  else{
    h += '<div class="p-text'+(full?'':' clip')+'">'+esc(p.text||'')+'</div>';
    if(!full && (p.text||'').length>150) h += '<span class="p-more-txt">展开全文</span>';
  }

  if(p.tags && p.tags.length) h += '<div class="p-tags">'+p.tags.map(t2=>'<span class="p-tag">'+esc(t2)+'</span>').join('')+'</div>';
  if(full && p.trans) h += '<div class="p-trans"><div class="p-trans-h">'+esc(langEn(p.trans.lang))+' · TRANSLATION</div><div class="p-trans-t">'+esc(p.trans.text)+'</div></div>';
  return h;
}

/* 评论权重预览：主评论 + 2~3 条二级 */
function cmWeight(c){ return (c.likes||0)*2 + (c.replies?c.replies.length*9:0) + (c.pinned?60:0); }
function cmPreviewHtml(p){
  const cs = (p.comments||[]).slice().sort((a,b)=>cmWeight(b)-cmWeight(a));
  if(!cs.length) return '';
  const top = cs.slice(0,2);
  let h='<div class="p-cmprev">';
  top.forEach(c=>{
    h += '<div class="cmp"><b>'+esc(c.name)+'：</b><span>'+esc(String(c.text||'').slice(0,64))+'</span></div>';
    (c.replies||[]).slice(0,2).forEach(r=>{
      h += '<div class="cmp sub"><b>'+esc(r.name)+'：</b><span>'+esc(String(r.text||'').slice(0,52))+'</span></div>';
    });
  });
  const total = cs.reduce((a,c)=>a+1+(c.replies?c.replies.length:0),0);
  if(total>3) h += '<div class="more">查看全部 '+total+' 条回声</div>';
  h += '</div>';
  return h;
}

/* ================================================================
   15 · 帖子卡
================================================================ */
function postFoot(p){
  const s=p.stats||{};
  const mine = p.authorId==='me';
  return '<div class="p-foot">'
    + '<button class="p-act heart'+(p.liked?' on':'')+'" data-act="like" data-id="'+p.id+'">'+I.heart+'<span>'+nfmt(s.like||0)+'</span></button>'
    + '<button class="p-act" data-act="open" data-id="'+p.id+'">'+I.cm+'<span>'+nfmt(s.cm||0)+'</span></button>'
    + '<button class="p-act'+(p.reposted?' on':'')+'" data-act="rp" data-id="'+p.id+'">'+I.rp+'<span>'+nfmt(s.rp||0)+'</span></button>'
    + '<button class="p-act'+(p.collected?' on':'')+'" data-act="col" data-id="'+p.id+'">'+I.star+'</button>'
    + '<button class="p-view'+(mine?' tapable':'')+'" data-act="'+(mine?'tide':'noop')+'" data-id="'+p.id+'">'+I.eye+'<span>'+nfmt(s.view||0)+'</span></button>'
    + '</div>';
}
function postCard(p,i){
  const a = authorOf(p);
  const ty = TYPES[p.type]||TYPES.essay;
  return '<article class="post rise'+(p.authorId==='me'?' mine':'')+'" style="--d:'+(i||0)+'" data-post="'+p.id+'">'
   + '<div class="p-head">'
   +   '<button data-act="profile" data-id="'+esc(String(a.id))+'">'+avaHtml(a,'md')+'</button>'
   +   '<div class="p-id"><div class="p-name">'+esc(a.name)+(a.ai?'<span class="src-tag ai">AI</span>':'')+'</div>'
   +   '<div class="p-sub"><i>'+esc(ty.en)+'</i><span class="dot"></span><i>'+esc(p.timeText||ago(p.ts))+'</i>'
   +     (p.lang&&p.lang!==S.settings.contentLang?'<span class="p-lang">'+esc(langShort(p.lang))+'</span>':'')
   +   '</div></div>'
   +   (p.authorId!=='me'
        ? '<button class="p-follow'+(isFollowed(a.id)?' on':'')+'" data-act="follow" data-id="'+esc(String(a.id))+'">'+esc(isFollowed(a.id)?T('following'):T('follow'))+'</button>'
        : '<button class="p-more" data-act="pmenu" data-id="'+p.id+'">'+I.dots+'</button>')
   + '</div>'
   + '<div data-act="open" data-id="'+p.id+'">'+postBody(p,false)+'</div>'
   + '<div data-act="open" data-id="'+p.id+'">'+cmPreviewHtml(p)+'</div>'
   + postFoot(p)
   + '</article>';
}

/* ================================================================
   16 · 广场
================================================================ */
let SEL_TYPES = ['essay','moment','chatlog'];
let TOPIC_DRAFT = '';
function renderFeed(){
  const box=$('#feedScroll'); if(!box) return;
  const list = visiblePosts();
  let h='';

  if(S.topic){
    h += '<div class="topic-card rise" style="--d:0">'
      +  '<div class="tp-kicker"><i></i><span>'+esc(T('tonight'))+'</span></div>'
      +  '<div class="tp-title">'+esc(S.topic.title)+'</div>'
      +  (S.topic.desc?'<div class="tp-desc">'+esc(S.topic.desc)+'</div>':'')
      +  '<div class="tp-foot"><span class="tp-live"><i></i>'+nfmt(S.topic.live||rnd(800,4200))+' 人正在夜谈</span>'
      +  '<button class="btn sm tp-btn" data-act="newtopic">换一个</button></div></div>';
  }else{
    h += '<div class="topic-card rise" style="--d:0"><div class="tp-kicker"><i></i><span>'+esc(T('tonight'))+'</span></div>'
      +  '<div class="tp-title">今夜还没有话题</div>'
      +  '<div class="tp-desc">先拟一个今夜话题，广场上的人会围绕它开口。</div>'
      +  '<div class="tp-foot"><button class="btn sm solid tp-btn" data-act="newtopic">拟一个话题</button></div></div>';
  }

  h += '<div class="gen-bar rise" style="--d:1">'
    +  '<div class="gen-top"><input class="inp" id="topicInput" placeholder="'+esc(T('gen.topic'))+'" value="'+esc(TOPIC_DRAFT)+'">'
    +  '<button class="gen-go" data-act="gen">'+I.spark+'</button></div>'
    +  '<div class="type-scroll">'+TYPE_LIST.map(k=>'<button class="tg'+(SEL_TYPES.includes(k)?' on':'')+'" data-ty="'+k+'">'+esc(TYPES[k].cn)+'</button>').join('')+'</div>'
    +  '<div class="gen-meta"><span class="mini">'+(S.settings.langMode==='mix'?'多语种 · '+ (S.settings.langPool||[]).map(langShort).join('/') : langShort(S.settings.contentLang)+' 单语')+'</span>'
    +  '<span class="mini">· 作者源 '+({mix:'角色库+AI博主',chars:'仅角色库',npc:'仅AI博主'}[S.settings.authorSource])+'</span>'
    +  '<button class="tg" data-act="genopt" style="margin-left:auto">生成设置</button></div>'
    +  '</div>';

  if(!list.length){
    h += '<div class="empty rise" style="--d:2"><div class="empty-mk">'+I.moon+'</div><b>'+esc(T('none'))+'</b><span>the square is quiet</span></div>';
  }else{
    h += list.map((p,i)=>postCard(p,Math.min(i+2,9))).join('');
  }
  box.innerHTML=h;
  renderCats();
  bindCcGalleryScroll();
  const ti=$('#topicInput'); if(ti) ti.oninput=e=>{ TOPIC_DRAFT=e.target.value; };
}

/* ================================================================
   17 · 归一化：体裁字段严格互斥 + 缺失兜底
   —— 无论 AI 是否守规矩，最终落地的帖子一定只有本体裁的字段，
      且该字段一定存在（缺失就用 text 合成），因此永远不会掉格式。
================================================================ */
function normChat(ch){
  const ps = (ch.participants||[]).slice(0,4).map(p=>{
    const c = p.charId!=null?anyById(p.charId):null;
    return { name: c?c.name:(p.name||''), side:p.side==='right'?'right':'left', avatar: c?c.avatar:(p.avatar||null), charId:c?c.id:null };
  });
  if(!ps.length) ps.push({name:'',side:'left',avatar:null});
  if(!ps.some(p=>p.side==='right')) ps.push({name:'我',side:'right',avatar:null});
  return {
    theme: CC_THEMES.some(t=>t.k===ch.theme)?ch.theme:S.settings.ccTheme,
    title: ch.title||'', clock: ch.clock||'', mark: ch.mark||'',
    participants: ps,
    messages:(ch.messages||[]).slice(0,40).map(m=>({
      kind:['text','voice','img','pay','sys','time'].includes(m.kind)?m.kind:'text',
      side:m.side==='right'?'right':'left',
      text:m.text||'', dur:m.dur||null, amount:m.amount||'', note:m.note||'', quote:m.quote||''
    })).filter(m=>m.kind!=='text'||m.text)
  };
}
function splitSentences(s,min){
  const arr = String(s||'').split(/[\n。！？!?；;]+/).map(x=>x.trim()).filter(Boolean);
  while(arr.length<(min||3)) arr.push(arr[arr.length-1]||'……');
  return arr;
}
/* 按体裁补全字段，保证渲染器拿到的一定是完整结构 */
function fillByType(type,raw,text){
  const t = text || raw.text || '';
  switch(type){
    case 'moment':
      return { text:(raw.moment&&raw.moment.text)||t.slice(0,80)||'——', place:(raw.moment&&raw.moment.place)||'路口', clock:(raw.moment&&raw.moment.clock)||(String(rnd(0,4)).padStart(2,'0')+':'+String(rnd(0,59)).padStart(2,'0')) };
    case 'diary':{
      const d=raw.diary||{};
      const now=new Date();
      return { day:d.day||String(now.getDate()).padStart(2,'0'),
               month:d.month||['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][now.getMonth()],
               weather:d.weather||pick1(['阴','小雨','多云转晴','夜雾','起风','闷热']),
               body:d.body||t||'今天没什么可写的。' };
    }
    case 'list':{
      let l = Array.isArray(raw.list)?raw.list.filter(x=>String(x).trim()):[];
      if(l.length<3) l = splitSentences(t,3).slice(0,5);
      return l.slice(0,6);
    }
    case 'verse':
      return (raw.verse&&String(raw.verse).trim()) || splitSentences(t,4).slice(0,6).join('\n');
    case 'ask':{
      const a=raw.ask||{};
      return { q:a.q||'想问一个不太好意思问的问题。', a:a.a||t||'我也没有答案。' };
    }
    case 'quote':{
      const q=raw.quote||{};
      return { text:q.text||splitSentences(t,1)[0]||'——', by:q.by||'' };
    }
    case 'letter':{
      const l=raw.letter||{};
      return { to:l.to||'致 那个不会看到的人', body:l.body||t||'……', sign:l.sign||'' };
    }
    case 'playlist':{
      const pl=raw.playlist||{};
      let tr=Array.isArray(pl.tracks)?pl.tracks.filter(x=>x&&x.title):[];
      if(!tr.length) tr = splitSentences(t,3).slice(0,4).map((x,i)=>({title:x.slice(0,18),artist:'—',note:''}));
      return { name:pl.name||'凌晨三点', tracks:tr.slice(0,6) };
    }
    case 'review':{
      const r=raw.review||{};
      return { object:r.object||raw.title||'某样东西', kind:r.kind||'REVIEW',
               score:String(r.score!=null?r.score:(6+Math.random()*3).toFixed(1)), body:r.body||t||'' };
    }
    case 'poll':{
      const p=raw.poll||{};
      let os = Array.isArray(p.options)?p.options.filter(o=>o&&o.label):[];
      if(os.length<2) os = [{label:'会',pct:0},{label:'不会',pct:0}];
      let sum = os.reduce((a,o)=>a+(Number(o.pct)||0),0);
      if(!sum){ let left=100; os.forEach((o,i)=>{ const v=i===os.length-1?left:rnd(10,Math.max(11,Math.floor(left/(os.length-i)+12))); o.pct=v; left-=v; }); }
      else os.forEach(o=>o.pct=Math.round((Number(o.pct)||0)*100/sum));
      return { q:p.q||raw.title||t.slice(0,40)||'你会怎么选？', options:os.slice(0,4), total:Number(p.total)||rnd(300,9000), voted:null };
    }
    case 'dream':{
      const d=raw.dream||{};
      return { body:d.body||t||'……', wake:d.wake||'' };
    }
    case 'thread':{
      let th = Array.isArray(raw.thread)?raw.thread.filter(x=>String(x).trim()):[];
      if(th.length<2) th = splitSentences(t,3).slice(0,5);
      return th.slice(0,6);
    }
    case 'snippet':{
      const s=raw.snippet||{};
      return { text:s.text||splitSentences(t,1)[0]||'——', from:s.from||'佚名', note:s.note||(s.text?t:'') };
    }
    case 'voice':{
      const v=raw.voice||{};
      return { dur:clamp(Number(v.dur)||rnd(8,46),4,59), transcript:v.transcript||t||'' };
    }
  }
  return null;
}
function normPost(raw,forced){
  forced = forced||{};
  const a = forced.author || null;
  const type = TYPE_LIST.includes(forced.type) ? forced.type
             : (TYPE_LIST.includes(raw.type)?raw.type:'essay');
  const st = raw.stats||{};
  const p = {
    id: uid(),
    authorId: a ? a.id : (raw.authorId!=null && anyById(raw.authorId) ? raw.authorId : 'me'),
    authorName: a ? a.name : (raw.authorName||''),
    authorAvatar: a ? (a.avatar||null) : null,
    type,
    lang: forced.lang || raw.lang || S.settings.contentLang,
    cat: forced.cat || S.cats[0] && S.cats[0].id || null,
    title: raw.title||'',
    text: raw.text||'',
    topic: raw.topic||'',
    tags: Array.isArray(raw.tags)?raw.tags.slice(0,4).map(x=>String(x).replace(/^#/,'')):[],
    ts: Date.now()-Math.floor(Math.random()*5400000),
    timeText: raw.timeText||'',
    stats:{ like:Number(st.like)||rnd(18,420), cm:Number(st.cm)||rnd(2,70),
            rp:Number(st.rp)||rnd(0,55), view:Number(st.view)||rnd(320,6400) },
    liked:false, collected:false, reposted:false,
    comments:[], seen:false, trans:null
  };
  /* 只保留本体裁字段 */
  if(CHAT_TYPES.includes(type)){
    p.chat = (raw.chat && Array.isArray(raw.chat.messages) && raw.chat.messages.length) ? normChat(raw.chat) : null;
    if(!p.chat){ /* 聊天数据缺失 → 降级成随笔，绝不留空壳 */
      p.type='essay'; p.text = p.text || '（这段对话没能存下来）';
    }
  }else{
    const f = fillByType(type,raw,raw.text);
    if(f!=null) p[TYPES[type].field] = f;
    if(['moment','diary','verse','ask','letter','dream','snippet','thread'].includes(type)) p.text='';
  }
  if(!p.timeText) p.timeText = ago(p.ts);
  return p;
}

/* ================================================================
   18 · AI 博主（不再只靠角色库）
================================================================ */
async function genNpcs(n,hint){
  if(!hasApi()) { toast(T('noapi')); return []; }
  n = n||3;
  busy(true,'正在捏人');
  try{
    const exist = S.npcs.slice(0,10).map(x=>x.name).join('、');
    const j = await aiJson(APP_SYS(S.settings.contentLang),
`为「夜话馆」生成 ${n} 位新的博主（不是名人，是普通夜猫子），每个人要有清晰可辨的口吻差异。
${hint?('用户希望的方向：'+hint):''}
${exist?('已有博主（不要重名、不要撞人设）：'+exist):''}

JSON 数组，每项：
{"name":"名字，2-6字，可中可外","handle":"英文小写下划线","gender":"","age":"如 24","role":"身份/职业，一句话",
 "sign":"签名，12-24字","bio":"自述，50-90字，有具体生活细节",
 "speechStyle":"说话风格，40-70字，要具体到句式和用词习惯","traits":["3-5个特质"],
 "likes":["2-3个"],"dislikes":["2-3个"],
 "lang":"这个人惯用的语言代码，从 ${(S.settings.langMode==='mix'?S.settings.langPool:[S.settings.contentLang]).join('/')} 中选",
 "followers":数字 200-90000, "scenario":"当前处境，一句话"}`,
    {max:2400,temp:1.1});
    const arr = Array.isArray(j)?j:(j.npcs||[]);
    const made = arr.map(r=>({
      id:'n_'+uid(), __npc:true,
      name:r.name||'无名', handle:r.handle||('u'+rnd(1000,9999)),
      gender:r.gender||'', age:r.age||'', role:r.role||'',
      sign:r.sign||'', bio:r.bio||'', desc:r.bio||'',
      speechStyle:r.speechStyle||'', traits:r.traits||[], likes:r.likes||[], dislikes:r.dislikes||[],
      scenario:r.scenario||'', lang:r.lang||S.settings.contentLang,
      followers:Number(r.followers)||rnd(300,20000), avatar:null, ts:Date.now()
    }));
    S.npcs = made.concat(S.npcs).slice(0,120);
    save();
    return made;
  }catch(e){ toast('生成失败：'+e.message); return []; }
  finally{ busy(false); }
}

/* ================================================================
   19 · AI：今夜话题
================================================================ */
async function genTopic(){
  if(!hasApi()) return toast(T('noapi'));
  busy(true,T('working'));
  try{
    const j = await aiJson(APP_SYS(S.settings.contentLang),
`拟一个「今夜话题」，要具体到一件小事，不要抽象大词。
JSON：{"title":"话题，14-24字，是一个能让人立刻想起某件具体小事的句子","desc":"一句引导语，24-40字","live":数字}`,
    {max:320,temp:1.12});
    S.topic = { title:j.title||'', desc:j.desc||'', live:Number(j.live)||rnd(600,5200) };
    save(); renderFeed();
  }catch(e){ toast('生成失败：'+e.message); }
  busy(false);
}

/* ================================================================
   20 · AI：生成帖子（体裁 / 语言 / 作者 全部由代码分配）
================================================================ */
function planLang(i,author){
  if(S.settings.langMode!=='mix') return S.settings.contentLang;
  const pool = (S.settings.langPool&&S.settings.langPool.length)?S.settings.langPool:[S.settings.contentLang];
  if(author && author.lang && pool.includes(author.lang)) return author.lang;
  return pool[i%pool.length];
}
async function genPosts(topicInput){
  if(!hasApi()) return toast(T('noapi'));

  /* 作者池：不够就先让 AI 捏几个博主 */
  let pool = allAuthors();
  if(pool.length < 3 && S.settings.authorSource!=='chars' && S.settings.autoNpc){
    await genNpcs(Math.max(3,4-pool.length), topicInput);
    pool = allAuthors();
  }
  if(!pool.length) return toast(T('nochar'));

  const types = SEL_TYPES.length?SEL_TYPES.slice():['essay'];
  const postCount = clamp(types.length + rnd(0,2), 3, 7);

  /* 逐条分配：作者 + 体裁 + 语言 */
  const castPool = pickWeighted(pool, Math.min(9,pool.length), S.recentAuthors);
  const plan = [];
  for(let i=0;i<postCount;i++){
    const author = castPool[i%castPool.length] || pick1(pool);
    const type = types[i%types.length];
    plan.push({ author, type, lang: planLang(i,author) });
  }
  /* 打乱体裁顺序，避免总是同一个次序 */
  plan.sort(()=>Math.random()-.5);

  const cast=[]; plan.forEach(x=>{ if(!cast.some(y=>y.id===x.author.id)) cast.push(x.author); });
  const cat = ensureCat(topicInput || (S.topic&&S.topic.title) || '自由夜');

  busy(true,T('working'));
  try{
    const spec = plan.map((x,i)=>
      '第 '+(i+1)+' 条：作者 = #'+x.author.id+'「'+x.author.name+'」｜体裁 = '+x.type+'（'+TYPES[x.type].cn+'）｜语言 = '+langName(x.lang)+
      '\n     体裁写法：'+TYPES[x.type].ai).join('\n');

    const j = await aiJson(APP_SYS(),
`在场博主人设（只能使用这些人，不要虚构新人物）：
${charsBrief(cast,true)}

${meBrief()}

今晚话题：${S.topic?S.topic.title+' —— '+S.topic.desc:'（自由）'}
用户想看：${topicInput||'（不限，贴合今晚话题即可）'}

请严格生成 ${postCount} 条帖子。每一条的作者、体裁、语言都已经由系统指定，必须逐条对应，禁止更换、禁止合并、禁止增减条数：
${spec}

统一 JSON 结构（数组，顺序与上面"第 N 条"一一对应，长度必须正好 ${postCount}）：
[{
 "type":"必须等于系统为这一条指定的体裁",
 "title":"可为空字符串",
 "text":"正文；仅 essay / chatlog / cp / list / poll / quote / playlist / review 这几种体裁会用到，其余体裁请留空字符串",
 "moment":{"text":"","place":"","clock":""},
 "diary":{"day":"","month":"","weather":"","body":""},
 "list":["…"],
 "verse":"用\\n换行",
 "ask":{"q":"","a":""},
 "quote":{"text":"","by":""},
 "letter":{"to":"","body":"","sign":""},
 "playlist":{"name":"","tracks":[{"title":"","artist":"","note":""}]},
 "review":{"object":"","kind":"","score":"8.4","body":""},
 "poll":{"q":"","options":[{"label":"","pct":40}],"total":1200},
 "dream":{"body":"","wake":""},
 "thread":["…"],
 "snippet":{"text":"","from":"","note":""},
 "voice":{"dur":24,"transcript":""},
 "chat":{
   "theme":"ink|frost|paper|silver|mono|veil|blush|mica|dew",
   "title":"截图顶部的对话名","clock":"如 02:14","mark":"如 昨夜留影",
   "participants":[{"charId":id或null,"name":"","side":"left"},{"charId":id或null,"name":"","side":"right"}],
   "messages":[{"kind":"time|sys|text|voice|img|pay","side":"left|right","text":"","dur":8,"quote":"","amount":"","note":""}]
 },
 "topic":"发布板块","tags":["1-3个不带#的标签"],"timeText":"如 3 分钟前",
 "stats":{"like":数字,"cm":数字,"rp":数字,"view":数字}
}]

【体裁纪律 · 最重要】
1. 每一条只能填写它被指定的那一个体裁字段，其余所有体裁字段一律给 null。绝对禁止在非 chatlog/cp 的帖子里出现 chat 数据。
2. 被指定的那个体裁字段必须写满、写好，不能是空对象或空数组。
3. chatlog：其中 side=right 的一方必须是发帖人本人；cp：两个说话人都不是发帖人，发帖人只是围观者。
4. chat.messages 要 8–26 条，长度必须有随机波动，节奏真实：有 time 分隔、有短句、有沉默后的追问、可以出现 voice / img / sys（如"对方撤回了一条消息"）。
5. 每一条的语言严格按系统指定，不同条可以是不同语言，同一条内不要混用语言。`,
    {max:4600,temp:1.04});

    let arr = Array.isArray(j)?j:(j.posts||[]);
    if(!arr.length) throw new Error('空结果');
    const made = plan.map((x,i)=> normPost(arr[i]||arr[arr.length-1]||{}, {author:x.author,type:x.type,lang:x.lang,cat:cat.id}));

    S.posts = made.concat(S.posts).slice(0,240);
    S.recentAuthors = Array.from(new Set(made.map(p=>String(p.authorId)).concat(S.recentAuthors))).slice(0,28);
    /* 广场活跃 → 作者与用户的数据同步往上走 */
    made.forEach(p=>{ const m=charMeta(p.authorId); m.followers+=rnd(2,40); m.views+=rnd(60,900); });
    S.profile.views += rnd(10,90);
    if(Math.random()<.7) S.profile.followers += rnd(1,5);
    S.stats.view += rnd(20,160);
    if(S.curCat!=='all' && S.curCat!=='mine') S.curCat = cat.id;
    save(); renderFeed();
    toast('落笔 '+made.length+' 条 · 收进「'+cat.name+'」');
  }catch(e){ toast('生成失败：'+e.message); }
  busy(false);
}

/* ================================================================
   21 · AI：评论（绝不让发帖人自己评论自己）
================================================================ */
function postPlain(p){
  const L=[];
  if(p.title) L.push(p.title);
  if(p.text) L.push(p.text);
  if(p.moment) L.push(p.moment.text);
  if(p.diary) L.push(p.diary.body);
  if(p.list) L.push(p.list.join('；'));
  if(p.verse) L.push(p.verse);
  if(p.ask) L.push('问：'+p.ask.q+'\n答：'+p.ask.a);
  if(p.quote) L.push('「'+p.quote.text+'」—'+p.quote.by);
  if(p.letter) L.push(p.letter.to+'\n'+p.letter.body);
  if(p.playlist) L.push('歌单《'+p.playlist.name+'》：'+(p.playlist.tracks||[]).map(t=>t.title+'-'+t.artist).join('，'));
  if(p.review) L.push('评'+p.review.object+' '+p.review.score+'分：'+p.review.body);
  if(p.poll) L.push('投票：'+p.poll.q+' → '+(p.poll.options||[]).map(o=>o.label+' '+o.pct+'%').join('，'));
  if(p.dream) L.push('梦：'+p.dream.body+' / 醒后：'+(p.dream.wake||''));
  if(p.thread) L.push(p.thread.join('\n'));
  if(p.snippet) L.push('摘抄：'+p.snippet.text+'（'+p.snippet.from+'）'+(p.snippet.note||''));
  if(p.voice) L.push('语音('+p.voice.dur+'秒)：'+p.voice.transcript);
  if(p.chat) L.push('[对话截图]\n'+(p.chat.messages||[]).map(m=>(m.side==='right'?'→ ':'← ')+(m.text||('['+m.kind+']'))).join('\n'));
  return L.filter(Boolean).join('\n');
}
/* 可评论的人：排除发帖人本人 */
function commenterPool(p,n){
  const authorKey = String(p.authorId);
  const pool = allAuthors().filter(c=>String(c.id)!==authorKey);
  return pickN(pool, Math.min(n||7, pool.length));
}
function mkCm(r,p){
  const authorKey = String(p.authorId);
  let c = (r.commenterId!=null && String(r.commenterId)!==authorKey) ? anyById(r.commenterId) : null;
  if(c && String(c.id)===authorKey) c=null;
  return {
    id:uid(), uid:c?c.id:null, name:c?c.name:(r.name||'路过的人'), avatar:c?c.avatar:null,
    text:String(r.text||'').trim(), timeText:r.timeText||'刚刚', ts:Date.now()-rnd(0,5400000),
    likes:Number(r.likes)||rnd(0,60), liked:false, lang:r.lang||p.lang, replies:[]
  };
}
async function genComments(p,extra){
  if(!hasApi()) return toast(T('noapi'));
  const cast = commenterPool(p,7);
  const aName = authorOf(p).name;
  busy(true,T('working'));
  try{
    const j = await aiJson(APP_SYS(p.lang),
`下面是「夜话馆」上的一条帖子，请生成评论区。
发帖人：${aName}（#${p.authorId}）
体裁：${TYPES[p.type].cn}
内容：
${postPlain(p)}
${extra?('\n用户（'+(S.profile.name||'我')+'）刚刚发表了评论："'+extra+'"，评论区里必须有人回应它。'):''}

可用评论者（commenterId 只能从下面这些 id 里选；也允许 2-3 个 commenterId=null 的路人，路人要自己起一个符合夜话馆气质的匿名昵称）：
${charsBrief(cast,false)}
${meBrief()}

【硬性规则】
1. 发帖人 ${aName}（#${p.authorId}）是这条帖子的作者，绝对禁止让他/她出现在评论者里，也不要冒用他/她的名字；
2. 生成 4–7 条主评论，立场不一、长度不一：有人接梗、有人抬杠、有人只发一句没头没尾的话、有人跑题；
3. 其中 2–3 条要带 replies（每条 1–3 条二级回复），二级回复里可以互相 @ 对方；
4. 评论使用与帖子相同的语言：${langName(p.lang)}；
5. 禁止 emoji、禁止说教、禁止把每条都写成同样的句式长度。

JSON：[{"commenterId":id或null,"name":"当 commenterId 为 null 时的昵称","text":"","timeText":"如 2 分钟前","likes":数字,
"replies":[{"commenterId":id或null,"name":"","text":"","timeText":"","likes":数字,"toName":"被回复者的名字，可空"}]}]`,
    {max:2600,temp:1.06});
    const arr = Array.isArray(j)?j:[];
    const made = arr.filter(r=>r&&r.text).map(r=>{
      const c = mkCm(r,p);
      c.replies = (r.replies||[]).filter(x=>x&&x.text).map(x=>{
        const rc = mkCm(x,p);
        rc.toName = x.toName||c.name;
        return rc;
      });
      return c;
    });
    p.comments = (p.comments||[]).concat(made);
    bumpStats(p,'cm',made.reduce((a,c)=>a+1+c.replies.length,0));
    save();
    if(CUR_DETAIL===p.id) paintDetail(p);
    renderFeed();
  }catch(e){ toast('生成失败：'+e.message); }
  busy(false);
}
/* 针对某一条评论生成回复（用户点了「回复」之后自动响应） */
async function genReplies(p,cm,userText){
  if(!hasApi()) return toast(T('noapi'));
  const cast = commenterPool(p,6);
  const n = rnd(1,3);
  busy(true,T('working'));
  try{
    const ctx = (cm.replies||[]).slice(-6).map(r=>r.name+'：'+r.text).join('\n');
    const j = await aiJson(APP_SYS(p.lang),
`「夜话馆」某条帖子下的一条评论正在被讨论，请生成 ${n} 条新的二级回复。

帖子（作者 ${authorOf(p).name} #${p.authorId}）：
${postPlain(p).slice(0,700)}

主评论 —— ${cm.name}：${cm.text}
${ctx?('已有回复：\n'+ctx):''}
${userText?('\n用户（'+(S.profile.name||'我')+'）刚刚回复了："'+userText+'"，这 '+n+' 条必须直接回应用户这句话，可以赞同、可以呛回去、可以顺着往下扯。'):''}

可用回复者（只能从下面选，或用 null 表示路人）：
${charsBrief(cast,false)}

【硬性规则】
1. 发帖人 ${authorOf(p).name}（#${p.authorId}）不能出现；
2. 语言：${langName(p.lang)}；
3. 每条长短不一，禁止统一句式，禁止 emoji；
4. 至少有一条要带点情绪（不耐烦 / 兴奋 / 冷淡都行）。

JSON：[{"commenterId":id或null,"name":"","text":"","timeText":"","likes":数字,"toName":"被回复者的名字"}]`,
    {max:1100,temp:1.12});
    const arr = Array.isArray(j)?j:[];
    const made = arr.filter(x=>x&&x.text).slice(0,4).map(x=>{ const r=mkCm(x,p); r.toName=x.toName||cm.name; return r; });
    cm.replies = (cm.replies||[]).concat(made);
    bumpStats(p,'cm',made.length);
    save();
    if(SUB_CM && SUB_CM.cmId===cm.id) paintSubPage();
    if(CUR_DETAIL===p.id) paintDetail(p);
  }catch(e){ toast('生成失败：'+e.message); }
  busy(false);
}

/* ================================================================
   22 · AI：翻译（只在详情页可用）
================================================================ */
async function translate(text,target){
  const j = await aiJson('你是专业译者。',
`把下面内容翻译成【${langName(target)}（${langEn(target)}）】，保持语气、断句和口语感，人名不译。
只输出 JSON：{"t":"译文"}

原文：
${text}`,{max:1400,temp:.35});
  return j.t||'';
}
async function transPost(p){
  if(p.trans){ p.trans=null; save(); paintDetail(p); return; }
  if(!hasApi()) return toast(T('noapi'));
  busy(true,T('working'));
  try{
    p.trans = { lang:S.settings.transLang, text: await translate(postPlain(p),S.settings.transLang) };
    save(); paintDetail(p);
  }catch(e){ toast('翻译失败：'+e.message); }
  busy(false);
}

/* ================================================================
   23 · 页面栈
================================================================ */
const STACK=[];
function statusBarHtml(){
  /* 每个二级页都要有一条真实的状态栏，和主壳的一样，
     不能只有主屏才有——不然切进详情页/设置页就显得"没顶"。 */
  return '<div class="status-bar">'
    + '<div class="status-time" data-statustime>9:41</div>'
    + '<div class="status-island"></div>'
    + '<div class="status-right"><div class="signal"><i></i><i></i><i></i><i></i></div>'
    + '<div class="battery"><span class="bat-pct" data-batpct>76</span>'
    + '<div class="bat-shell"><div class="bat-inner" data-batinner></div><div class="bat-nub"></div></div></div></div>'
    + '</div>';
}
function pushPage(build){
  const host=$('#pageStack');
  const el=document.createElement('div');
  el.className='page'+(build.cls?(' '+build.cls):'');
  /* chat-page 自己已经带了 chat-wall/chat-veil，避免重复叠一层 */
  const needsWall = build.cls!=='chat-page';
  el.innerHTML=(needsWall?'<div class="page-wall"></div><div class="page-veil"></div>':'')+build.html;
  /* .page-head 永远是 build.html 里的第一个真实元素（所有 pageHead() 调用点
     和手写的聊天页头部都遵守这个约定）。把它和状态栏一起塞进
     .page-head-plate，两者共用同一块半透明底，天然没有接缝——
     和主壳 .yh-head-plate 包住 .status-bar + .yh-top 是同一个写法。 */
  const head = el.querySelector('.page-head');
  const plate = document.createElement('div');
  plate.className='page-head-plate';
  plate.innerHTML=statusBarHtml();
  if(head){ head.parentNode.insertBefore(plate,head); plate.appendChild(head); }
  else { el.appendChild(plate); } /* 兜底：理论上不会走到这里，所有页面都带 .page-head */
  host.appendChild(el);
  if(needsWall){
    const w=el.querySelector('.page-wall');
    if(w && S.settings.wall) w.style.backgroundImage='url('+S.settings.wall+')';
  }
  const prev=STACK[STACK.length-1]; if(prev) prev.el.classList.add('out');
  STACK.push({el,key:build.key,data:build.data});
  requestAnimationFrame(()=>el.classList.add('in'));
  clockPage(el);
  if(build.after) build.after(el);
  return el;
}
function popPage(){
  const top=STACK.pop(); if(!top) return;
  top.el.classList.remove('in');
  setTimeout(()=>top.el.remove(),420);
  const prev=STACK[STACK.length-1]; if(prev) prev.el.classList.remove('out');
  if(top.key==='detail') CUR_DETAIL=null;
  if(top.key==='sub') SUB_CM=null;
  if(top.key==='chat') CUR_CHAT=null;
}
function topPage(){ return STACK.length?STACK[STACK.length-1]:null; }
function pageHead(title,sub,acts){
  return '<div class="page-head"><button class="page-back" data-act="back">'+I.back+'</button>'
   + '<div class="page-ttl"><b>'+esc(title)+'</b><span>'+esc(sub||'')+'</span></div>'
   + '<div class="page-acts">'+(acts||'')+'</div></div>';
}

/* ================================================================
   24 · 详情页
================================================================ */
let CUR_DETAIL=null, REPLY_TO=null;
function openDetail(id){
  const p=S.posts.find(x=>x.id===id); if(!p) return;
  CUR_DETAIL=id; REPLY_TO=null;
  if(!p.seen){ p.seen=true; bumpStats(p,'view',rnd(1,4)); }
  else bumpStats(p,'view',1);
  S.stats.view++;
  save();
  pushPage({ key:'detail', data:id,
    html: pageHead(T('detail'),TYPES[p.type].en,
        '<button class="ic-btn" data-act="trans" data-id="'+p.id+'">'+I.tr+'</button>'
      + '<button class="ic-btn" data-act="fwd" data-id="'+p.id+'">'+I.rp+'</button>')
      + '<div class="page-body" id="dtBody"></div>'
      + '<div id="dtQuote"></div>'
      + '<div class="cm-input"><textarea class="ta" id="cmIn" rows="1" placeholder="'+esc(T('cm.ph'))+'"></textarea>'
      + '<button class="cm-send" data-act="cmsend">'+I.send+'</button></div>',
    after:()=>{ paintDetail(p); const ta=$('#cmIn'); if(ta) ta.oninput=()=>autoGrow(ta); }
  });
}
function cmHtml(c,p){
  const isOP = false; /* 作者不会评论自己 */
  return '<div class="cm" data-cm="'+c.id+'">'
    + '<div class="cm-h">'+avaHtml({name:c.name,avatar:c.avatar},'sm')
    + '<span class="cm-n">'+esc(c.name)+'</span>'+(isOP?'<span class="cm-op">OP</span>':'')
    + '<span class="cm-t">'+esc(c.timeText||'')+'</span></div>'
    + '<div class="cm-x">'+esc(c.text)+'</div>'
    + '<div class="cm-f">'
    +   '<button class="cm-b'+(c.liked?' on':'')+'" data-act="cmlike" data-id="'+c.id+'">'+I.heart+'<span>'+(c.likes||0)+'</span></button>'
    +   '<button class="cm-b" data-act="cmreply" data-id="'+c.id+'">'+I.reply+'<span>回复</span></button>'
    +   '<button class="cm-b" data-act="cmopen" data-id="'+c.id+'">'+I.cm+'<span>'+((c.replies||[]).length||0)+'</span></button>'
    +   '<button class="cm-b" data-act="cmgen" data-id="'+c.id+'" style="margin-left:auto">'+I.spark+'<span>让人接话</span></button>'
    + '</div>'
    + ((c.replies&&c.replies.length)
        ? '<div class="cm-sub" data-act="cmopen" data-id="'+c.id+'">'
          + c.replies.slice(0,3).map(r=>'<div class="sub-i"><b>'+esc(r.name)+(r.toName&&r.toName!==c.name?' ▸ '+esc(r.toName):'')+'：</b><span>'+esc(r.text)+'</span></div>').join('')
          + (c.replies.length>3?'<div class="sub-more">'+I.chev+'展开全部 '+c.replies.length+' 条</div>':'')
          + '</div>' : '')
    + '</div>';
}
function paintDetail(p){
  const body=$('#dtBody'); if(!body) return;
  const a=authorOf(p);
  let h='<div class="dt-post">'
   + '<article class="post" data-post="'+p.id+'">'
   + '<div class="p-head"><button data-act="profile" data-id="'+esc(String(a.id))+'">'+avaHtml(a,'lg')+'</button>'
   + '<div class="p-id"><div class="p-name">'+esc(a.name)+(a.ai?'<span class="src-tag ai">AI</span>':'')+'</div>'
   + '<div class="p-sub"><i>'+esc(TYPES[p.type].en)+'</i><span class="dot"></span><i>'+esc(p.timeText||ago(p.ts))+'</i>'
   + '<span class="p-lang">'+esc(langShort(p.lang))+'</span></div></div>'
   + (p.authorId!=='me'?'<button class="p-follow'+(isFollowed(a.id)?' on':'')+'" data-act="follow" data-id="'+esc(String(a.id))+'">'+esc(isFollowed(a.id)?T('following'):T('follow'))+'</button>':'')
   + '</div>'
   + postBody(p,true)
   + postFoot(p)
   + '</article></div>';

  const cs=(p.comments||[]).slice().sort((x,y)=>cmWeight(y)-cmWeight(x));
  const total = cs.reduce((n,c)=>n+1+(c.replies?c.replies.length:0),0);
  h += '<div class="cm-bar"><b>'+esc(T('act.cm'))+'</b><em>'+total+'</em><i></i>'
     + '<button class="btn sm" data-act="gencm" data-id="'+p.id+'">'+I.spark+'<span>'+esc(T('cm.gen'))+'</span></button></div>';
  h += cs.length? cs.map(c=>cmHtml(c,p)).join('')
    : '<div class="empty"><div class="empty-mk">'+I.cm+'</div><b>'+esc(T('cm.none'))+'</b><span>silence</span></div>';
  body.innerHTML=h;
  bindCcGalleryScroll();
  paintReplyQuote();
}
function findCm(p,id){
  for(const c of (p.comments||[])){
    if(c.id===id) return {cm:c,parent:null};
    for(const r of (c.replies||[])) if(r.id===id) return {cm:r,parent:c};
  }
  return null;
}
function paintReplyQuote(){
  const box=$('#dtQuote'); if(!box) return;
  if(!REPLY_TO){ box.innerHTML=''; return; }
  box.innerHTML='<div class="reply-quote"><b>回复 '+esc(REPLY_TO.name)+'</b><span>'+esc(String(REPLY_TO.text||'').slice(0,40))+'</span>'
    +'<button data-act="cancelreply">'+I.x+'</button></div>';
}

/* ================================================================
   25 · 二级评论页
================================================================ */
let SUB_CM=null;
function openSubCm(postId,cmId){
  const p=S.posts.find(x=>x.id===postId); if(!p) return;
  const f=findCm(p,cmId); if(!f) return;
  const root = f.parent || f.cm;
  SUB_CM = { postId, cmId:root.id, replyTo:null };
  pushPage({ key:'sub',
    html: pageHead(T('cm.sub'),'THREAD','<button class="ic-btn" data-act="subgen">'+I.spark+'</button>')
      + '<div class="page-body" id="subBody"></div>'
      + '<div id="subQuote"></div>'
      + '<div class="cm-input"><textarea class="ta" id="subIn" rows="1" placeholder="'+esc(T('cm.ph'))+'"></textarea>'
      + '<button class="cm-send" data-act="subsend">'+I.send+'</button></div>',
    after:()=>{ paintSubPage(); const ta=$('#subIn'); if(ta) ta.oninput=()=>autoGrow(ta); }
  });
}
function paintSubPage(){
  if(!SUB_CM) return;
  const body=$('#subBody'); if(!body) return;
  const p=S.posts.find(x=>x.id===SUB_CM.postId); if(!p) return;
  const f=findCm(p,SUB_CM.cmId); if(!f) return;
  const c=f.cm;
  let h='<div class="sub-root">'
   + '<div class="cm-h">'+avaHtml({name:c.name,avatar:c.avatar},'md')
   + '<span class="cm-n">'+esc(c.name)+'</span><span class="cm-t">'+esc(c.timeText||'')+'</span></div>'
   + '<div class="cm-x">'+esc(c.text)+'</div>'
   + '<div class="cm-f">'
   +   '<button class="cm-b'+(c.liked?' on':'')+'" data-act="cmlike" data-id="'+c.id+'">'+I.heart+'<span>'+(c.likes||0)+'</span></button>'
   +   '<button class="cm-b" data-act="subreply" data-id="'+c.id+'">'+I.reply+'<span>回复 '+esc(c.name)+'</span></button>'
   + '</div></div>';
  h += '<div class="sub-line"><b>'+((c.replies||[]).length)+' replies</b><i></i></div>';
  h += '<div class="sub-host">';
  h += (c.replies||[]).length ? (c.replies||[]).map(r=>
      '<div class="sub-cm">'+avaHtml({name:r.name,avatar:r.avatar},'sm')
    + '<div class="sb"><div class="sh"><span class="sn">'+esc(r.name)+'</span>'
    + (r.toName&&r.toName!==c.name?'<span class="cm-b" style="padding:0;height:auto">▸ '+esc(r.toName)+'</span>':'')
    + '<span class="st">'+esc(r.timeText||'')+'</span></div>'
    + '<div class="cm-x">'+esc(r.text)+'</div>'
    + '<div class="cm-f"><button class="cm-b'+(r.liked?' on':'')+'" data-act="cmlike" data-id="'+r.id+'">'+I.heart+'<span>'+(r.likes||0)+'</span></button>'
    + '<button class="cm-b" data-act="subreply" data-id="'+r.id+'">'+I.reply+'<span>回复</span></button></div></div></div>').join('')
    : '<div class="empty"><div class="empty-mk">'+I.cm+'</div><b>'+esc(T('cm.none'))+'</b><span>be the first</span></div>';
  h += '</div>';
  body.innerHTML=h;
  const q=$('#subQuote');
  if(q) q.innerHTML = SUB_CM.replyTo
    ? '<div class="reply-quote"><b>回复 '+esc(SUB_CM.replyTo.name)+'</b><span>'+esc(String(SUB_CM.replyTo.text||'').slice(0,40))+'</span><button data-act="subcancel">'+I.x+'</button></div>'
    : '';
}

/* ================================================================
   26 · 灯火体系 · LAMPLIGHT
   规则完全公开，见 openLampRules()
================================================================ */
const LAMP_TIERS = [
  {t:1, min:1,   n:'微芒', en:'EMBER',     d:'刚亮起来的一点光'},
  {t:2, min:3,   n:'灯芯', en:'WICK',      d:'火苗站稳了'},
  {t:3, min:7,   n:'烛',   en:'CANDLE',    d:'一周不灭'},
  {t:4, min:14,  n:'灯',   en:'LANTERN',   d:'半月常亮'},
  {t:5, min:30,  n:'明灯', en:'BEACON',    d:'满月不熄'},
  {t:6, min:60,  n:'长明', en:'EVERLIGHT', d:'两月长明'},
  {t:7, min:100, n:'星轨', en:'ORBIT',     d:'百日成轨'},
  {t:8, min:200, n:'永夜', en:'ETERNAL',   d:'夜再长也亮着'}
];
const LAMP_ICON = {
  1:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/></svg>',
  2:'<svg viewBox="0 0 24 24"><path d="M12 4.5v12"/><circle cx="12" cy="18.4" r="2.2"/></svg>',
  3:'<svg viewBox="0 0 24 24"><path d="M12 3.4c2 2.4 3.2 4 3.2 5.8A3.2 3.2 0 0 1 12 12.4a3.2 3.2 0 0 1-3.2-3.2c0-1.8 1.2-3.4 3.2-5.8z"/><path d="M9.2 14h5.6v6.4H9.2z"/></svg>',
  4:'<svg viewBox="0 0 24 24"><path d="M12 3.2l5.4 3.2v7.2L12 20.8 6.6 17.6V6.4z"/><circle cx="12" cy="12" r="2.4"/></svg>',
  5:'<svg viewBox="0 0 24 24"><path d="M12 2.6l2.3 6.6 6.6 2.3-6.6 2.3-2.3 6.6-2.3-6.6-6.6-2.3 6.6-2.3z"/></svg>',
  6:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="1.2"/></svg>',
  7:'<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="9" ry="4.2" transform="rotate(-28 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="4.2" transform="rotate(28 12 12)"/><circle cx="12" cy="12" r="2.2"/></svg>',
  8:'<svg viewBox="0 0 24 24"><path d="M12 2.8l2 4.6 4.9.5-3.7 3.3 1.1 4.9L12 13.6l-4.3 2.5 1.1-4.9-3.7-3.3 4.9-.5z"/><path d="M6.4 19.6h11.2"/></svg>'
};
function lampTier(n){ let t=LAMP_TIERS[0]; LAMP_TIERS.forEach(x=>{ if(n>=x.min) t=x; }); return t; }
function lampOf(tid){
  const k=String(tid);
  if(!S.lamps[k]) S.lamps[k]={ n:0, last:null, best:0, marks:{} };
  return S.lamps[k];
}
/* 每天双方各至少一条消息 → 当日点亮 */
function lampTouch(tid,side){
  const L=lampOf(tid), today=dayKey();
  L.marks = L.marks||{};
  L.marks[today] = L.marks[today]||{me:false,them:false};
  L.marks[today][side]=true;
  if(L.marks[today].me && L.marks[today].them && L.last!==today){
    const gap = L.last ? dayDiff(L.last,today) : 1;
    if(gap===1 || !L.last) L.n = (L.n||0)+1;
    else if(gap<=4){ L.n = Math.max(1,Math.round((L.n||0)*0.7))+1; toast('灯火复燃 · 保留了七成灯龄'); }
    else { L.n = 1; toast('灯已熄过，重新点亮'); }
    L.last = today;
    L.best = Math.max(L.best||0,L.n);
    const tier = lampTier(L.n);
    const prev = lampTier(L.n-1);
    if(tier.t!==prev.t && L.n>1) toast('灯火进阶 · '+tier.n+' '+tier.en);
    save();
  }
  /* 清理旧标记 */
  Object.keys(L.marks).forEach(d=>{ if(dayDiff(d,today)>3) delete L.marks[d]; });
}
function lampState(tid){
  const L=lampOf(tid);
  if(!L.n) return {n:0,state:'off',tier:LAMP_TIERS[0]};
  const gap = L.last? dayDiff(L.last,dayKey()) : 99;
  if(gap<=1) return {n:L.n,state:'lit',tier:lampTier(L.n),gap};
  if(gap<=4) return {n:L.n,state:'ember',tier:lampTier(L.n),gap};
  return {n:0,state:'off',tier:LAMP_TIERS[0],gap};
}
function lampChip(tid){
  const s=lampState(tid);
  if(!s.n) return '';
  const cls = s.state==='ember' ? 'lamp ember' : 'lamp t'+s.tier.t+' lit';
  return '<span class="'+cls+'"><span class="lg">'+LAMP_ICON[s.tier.t]+'</span><b>'+s.n+'</b></span>';
}

/* ================================================================
   27 · 私语 · 会话
================================================================ */
function ensureThreads(){
  allAuthors().forEach(c=>{
    if(!S.threads.some(t=>String(t.id)===String(c.id))) S.threads.push({ id:c.id, ts:0, unread:0, pin:false });
  });
  S.threads = S.threads.filter(t=>!!anyById(t.id));
}
const threadMsgs = id => (S.msgs[String(id)] = S.msgs[String(id)] || []);
function lastPreview(id){
  const a=threadMsgs(id); if(!a.length) return '';
  const m=a[a.length-1];
  if(m.revoked) return '[已撤回]';
  if(m.kind==='voice') return '[语音 '+(m.dur||0)+'"]';
  if(m.kind==='card'){ const p=S.posts.find(x=>x.id===m.postId); return '[夜话] '+(p?(p.title||p.text||TYPES[p.type].cn):''); }
  return (m.side==='me'?'我：':'')+(m.text||'');
}
const unreadTotal = () => S.threads.reduce((a,t)=>a+(t.unread||0),0);
const notifUnread = () => S.notifs.filter(n=>!n.read).length;

function renderDM(){
  const box=$('#dmScroll'); if(!box) return;
  ensureThreads();
  const active = S.threads.filter(t=>threadMsgs(t.id).length).sort((a,b)=>(b.ts||0)-(a.ts||0));
  const idle   = S.threads.filter(t=>!threadMsgs(t.id).length);
  let h='';
  h += '<div class="dm-hero rise" style="--d:0">'
    +  '<button class="dm-tile" data-act="data"><span class="tk">'+I.chart+'</span>'
    +  '<span class="tb"><b>'+esc(T('dm.data'))+'</b><span>ACTIVITY</span></span>'
    +  '<span class="tn'+(notifUnread()?'':' zero')+'">'+notifUnread()+'</span></button>'
    +  '<button class="dm-tile" data-act="lamprule"><span class="tk">'+I.lamp+'</span>'
    +  '<span class="tb"><b>'+esc(T('lamp'))+'</b><span>LAMPLIGHT</span></span></button>'
    +  '</div>';
  h += '<button class="btn wide ghost rise" style="--d:1" data-act="npcdm">'+I.bell+'<span>'+esc(T('dm.find'))+'</span></button>';

  h += '<div class="sec-label" style="--d:2"><b>Whispers</b><i></i></div>';
  h += '<div class="th-list">';
  if(active.length){
    h += active.map((t,i)=>{
      const c=anyById(t.id); if(!c) return '';
      const ms=threadMsgs(t.id);
      return '<button class="th rise" style="--d:'+Math.min(i+3,9)+'" data-act="chat" data-id="'+esc(String(t.id))+'">'
        + avaHtml(c,'lg')
        + '<div class="th-b"><div class="th-t"><span class="th-n">'+esc(c.name)+'</span>'+lampChip(t.id)
        + '<span class="th-time">'+esc(ms.length?hhmm(ms[ms.length-1].ts):'')+'</span></div>'
        + '<div class="th-p">'+esc(lastPreview(t.id))+'</div></div>'
        + (t.unread?'<div class="th-r"><span class="th-un">'+t.unread+'</span></div>':'')
        + '</button>';
    }).join('');
  }
  if(idle.length){
    h += (active.length?'</div><div class="sec-label"><b>Not yet spoken</b><i></i></div><div class="th-list">':'');
    h += idle.slice(0,40).map((t,i)=>{
      const c=anyById(t.id); if(!c) return '';
      return '<button class="th rise" style="--d:'+Math.min(i+3,9)+'" data-act="chat" data-id="'+esc(String(t.id))+'">'
        + avaHtml(c,'lg')
        + '<div class="th-b"><div class="th-t"><span class="th-n">'+esc(c.name)+'</span>'
        + (c.__npc?'<span class="src-tag ai">AI</span>':'')+'</div>'
        + '<div class="th-p">'+esc(c.sign||c.role||c.desc||'—')+'</div></div></button>';
    }).join('');
  }
  if(!active.length&&!idle.length) h += '<div class="empty"><div class="empty-mk">'+I.cm+'</div><b>'+esc(T('nochar'))+'</b><span>no one here</span></div>';
  h += '</div>';
  box.innerHTML=h;
  const dot=$('#dmDot'); if(dot) dot.hidden = !(unreadTotal()||notifUnread());
}

/* ================================================================
   28 · 聊天页
================================================================ */
let CUR_CHAT=null, CHAT_QUOTE=null;
function openChat(id){
  const c=anyById(id); if(!c) return;
  CUR_CHAT=String(id); CHAT_QUOTE=null;
  const t=S.threads.find(x=>String(x.id)===String(id)); if(t) t.unread=0;
  save();
  const s=lampState(id);
  pushPage({ key:'chat', cls:'chat-page',
    html:'<div class="chat-wall" id="chatWall"></div><div class="chat-veil"></div>'
      + '<div class="page-head"><button class="page-back" data-act="back">'+I.back+'</button>'
      + '<button class="page-ttl" data-act="profile" data-id="'+esc(String(id))+'" style="text-align:left">'
      +   '<b>'+esc(c.name)+'</b><div class="chat-head-sub">'+(s.n?lampChip(id):'<span style="font-family:var(--f-mono);font-size:8.4px;letter-spacing:.24em;color:var(--ash)">NOT LIT</span>')+'</div></button>'
      + '<div class="page-acts"><button class="ic-btn" data-act="lamprule">'+I.lamp+'</button>'
      + '<button class="ic-btn" data-act="chatset">'+I.sliders+'</button></div></div>'
      + '<div class="chat-scroll" id="chatScroll"></div>'
      + '<div class="chat-foot">'
      +   '<div id="chatQuote"></div>'
      +   '<div class="chat-tools">'
      +     '<button class="ctool key" data-act="askreply">'+I.spark+'<span>'+esc(T('reply'))+'</span></button>'
      +     '<button class="ctool" data-act="poke">'+I.bolt+'<span>戳一下</span></button>'
      +     '<button class="ctool" data-act="sharepost">'+I.rp+'<span>转发夜话</span></button>'
      +     '<button class="ctool" data-act="trmsg">'+I.tr+'<span>'+esc(T('trans'))+'</span></button>'
      +   '</div>'
      +   '<div class="chat-in-row"><textarea class="ta" id="chatIn" rows="1" placeholder="'+esc(T('dm.ph'))+'"></textarea>'
      +   '<button class="chat-send" data-act="chatsend">'+I.send+'</button></div>'
      + '</div>',
    after:el=>{
      applyChatWall(el);
      paintChat();
      const ta=$('#chatIn',el); if(ta) ta.oninput=()=>autoGrow(ta);
    }});
}
function applyChatWall(el){
  const host = el || (topPage()&&topPage().el) || document;
  const w=$('#chatWall',host);
  const src = S.settings.chatWall || S.settings.wall;   /* 私信背景默认跟随全局，一处设置全局生效 */
  if(w) w.style.backgroundImage = src?('url('+src+')'):'';
  const pg = (el&&el.classList)?el:null;
  if(pg) pg.classList.toggle('plain',!src);
}
function msgHtml(m,c){
  const me = m.side==='me';
  const who = me?{name:S.profile.name||'我',avatar:S.profile.avatar}:c;
  if(m.kind==='sys') return '<div class="msg" data-mid="'+m.id+'"><div class="msg-col" style="max-width:100%;align-items:center;width:100%"><div class="bub sys">'+esc(m.text||'')+'</div></div></div>';
  let inner='';
  if(m.revoked){
    inner='<div class="bub rev">'+(me?'你撤回了一条消息':'对方撤回了一条消息')+'</div>';
  }else if(m.kind==='voice'){
    inner='<div class="vmsg" data-act="vplay" data-mid="'+m.id+'"><span class="vp">'+I.play+'</span>'
        + '<span class="vw">'+waves(clamp(Math.round((m.dur||8)/1.1),9,22),4,18)+'</span>'
        + '<span class="vd">'+(m.dur||8)+'"</span></div>'
        + (m.vopen&&m.text?'<div class="vtx"><div class="lb">Transcript</div>'+esc(m.text)+'</div>':'');
  }else if(m.kind==='card'){
    inner=fwdCard(m.postId);
  }else{
    inner='<div class="bub">'+(m.quote?'<span class="msg-q">'+esc(m.quote)+'</span>':'')+esc(m.text||'')+'</div>';
  }
  return '<div class="msg'+(me?' me':'')+'" data-mid="'+m.id+'">'
   + avaHtml(who,'sm')
   + '<div class="msg-col">'+inner
   + (m.trans?'<div class="msg-tr">'+esc(m.trans)+'</div>':'')
   + '<div class="msg-t">'+esc(hhmm(m.ts))+'</div></div></div>';
}
/* 转发卡：按体裁差异化渲染 */
function fwdCard(postId){
  const p=S.posts.find(x=>x.id===postId);
  if(!p) return '<div class="fw"><div class="fw-b"><div class="fw-x">这条夜话已经不在了</div></div></div>';
  const a=authorOf(p), ty=TYPES[p.type];
  let mid='';
  if(p.type==='chatlog'||p.type==='cp'){
    const ms=(p.chat.messages||[]).filter(m=>m.kind==='text').slice(0,3);
    mid='<div class="fw-mini">'+ms.map(m=>'<div class="mb'+(m.side==='right'?' r':'')+'">'+esc(String(m.text).slice(0,34))+'</div>').join('')+'</div>';
  }else if(p.type==='poll'){
    mid='<div class="fw-po">'+(p.poll.options||[]).slice(0,3).map(o=>'<i style="width:'+clamp(o.pct,8,100)+'%"></i>').join('')+'</div>';
  }else if(p.type==='review'){
    mid='<div class="fw-sc"><b>'+esc(String(p.review.score))+'</b><span>'+esc(p.review.object||'')+'</span></div>';
  }else if(p.type==='voice'){
    mid='<div class="fw-vb"><span class="wv">'+waves(16,4,13)+'</span><span class="fw-kind">'+(p.voice.dur||0)+'"</span></div>';
  }
  const summary = p.type==='verse'? p.verse
    : p.type==='quote'? p.quote.text
    : p.type==='letter'? p.letter.body
    : p.type==='moment'? p.moment.text
    : p.type==='diary'? p.diary.body
    : p.type==='dream'? p.dream.body
    : p.type==='snippet'? p.snippet.text
    : p.type==='list'? (p.list||[]).join(' / ')
    : p.type==='thread'? (p.thread||[])[0]
    : p.type==='playlist'? (p.playlist.tracks||[]).map(t=>t.title).join(' · ')
    : p.type==='ask'? p.ask.q
    : p.type==='review'? p.review.body
    : p.type==='voice'? p.voice.transcript
    : (p.text||'');
  return '<button class="fw" data-k="'+p.type+'" data-act="opencard" data-id="'+p.id+'">'
   + '<div class="fw-h">'+avaHtml(a,'sm')+'<b>'+esc(a.name)+'</b><span class="fw-kind">'+esc(ty.en)+'</span></div>'
   + mid
   + '<div class="fw-b">'+(p.title?'<div class="fw-t">'+esc(p.title)+'</div>':'')
   + '<div class="fw-x">'+esc(String(summary||'').slice(0,120))+'</div></div>'
   + '<div class="fw-f"><i></i><span>夜话馆</span><i></i></div></button>';
}
function paintChat(scroll){
  const box=$('#chatScroll'); if(!box||!CUR_CHAT) return;
  const c=anyById(CUR_CHAT);
  const ms=threadMsgs(CUR_CHAT);
  let h='', lastDay='';
  ms.forEach(m=>{
    const dk=dayKey(m.ts);
    if(dk!==lastDay){ lastDay=dk; h+='<div class="day-sep"><i></i><span>'+esc(new Date(m.ts).toLocaleDateString())+'</span><i></i></div>'; }
    h+=msgHtml(m,c);
  });
  if(!ms.length) h='<div class="empty"><div class="empty-mk">'+I.moon+'</div><b>还没有人开口</b><span>say something</span></div>';
  box.innerHTML=h;
  if(scroll!==false) box.scrollTop=box.scrollHeight;
}
function paintChatQuote(){
  const b=$('#chatQuote'); if(!b) return;
  b.innerHTML = CHAT_QUOTE
    ? '<div class="reply-quote"><b>引用</b><span>'+esc(String(CHAT_QUOTE).slice(0,40))+'</span><button data-act="unquote">'+I.x+'</button></div>' : '';
}
function pushMsg(tid,m){
  const arr=threadMsgs(tid);
  arr.push(Object.assign({id:uid(),ts:Date.now()},m));
  const t=S.threads.find(x=>String(x.id)===String(tid));
  if(t) t.ts=Date.now(); else S.threads.push({id:tid,ts:Date.now(),unread:0});
  lampTouch(tid, m.side==='me'?'me':'them');
  save();
}
function chatCtx(tid,n){
  const c=anyById(tid);
  return threadMsgs(tid).slice(-(n||24)).map(m=>{
    const who = m.side==='me'? (S.profile.name||'用户') : (c?c.name:'对方');
    let x=m.text||'';
    if(m.kind==='voice') x='[语音'+(m.dur||0)+'秒]'+x;
    if(m.kind==='card'){ const p=S.posts.find(y=>y.id===m.postId); x='[分享了一条夜话·'+(p?TYPES[p.type].cn:'')+']'+(p?postPlain(p).slice(0,110):''); }
    if(m.revoked) x='[已撤回]';
    if(m.quote) x='（引用："'+m.quote+'"）'+x;
    return who+'：'+x;
  }).join('\n');
}
/* 只有用户点了「让Ta回应」才会回复；条数随机 */
async function aiReply(tid,trigger){
  if(!hasApi()) return toast(T('noapi'));
  const c=anyById(tid); if(!c) return;
  const want = pick1([1,1,2,2,2,3,3,3,4,4,5,6]);   /* 加权随机，禁止条数统一 */
  const box=$('#chatScroll');
  if(box && CUR_CHAT===String(tid)){
    const tp=document.createElement('div');
    tp.className='msg'; tp.id='typingRow';
    tp.innerHTML=avaHtml(c,'sm')+'<div class="msg-col"><div class="bub"><span class="typing"><i></i><i></i><i></i></span></div></div>';
    box.appendChild(tp); box.scrollTop=box.scrollHeight;
  }
  try{
    const lang = c.lang || S.settings.contentLang;
    const j = await aiJson(
`${APP_SYS(lang)}
你现在扮演「${c.name}」在私信里回复用户。严格按人设说话，不要旁白，不要动作描写。
${charBrief(c,true)}

${meBrief()}

【活人感 · 硬性要求】
1. 这一次总共回 ${want} 条消息，必须正好 ${want} 条，不要多也不要少；
2. 每条长度必须明显不同：可以只有两个字，也可以是一长段；禁止每条都差不多长；
3. 允许并鼓励：先短后长、突然岔开话题、反问、答非所问、自我打断、说到一半改口、发语音、引用用户上一句、偶尔撤回一条；
4. 不要每条都有礼貌收尾，不要总结陈词，不要主动结束对话，不要连着问三个问题；
5. 禁止 emoji 与颜文字；禁止出现"（笑）""[叹气]"这类括号提示；
6. 语音消息（kind=voice）必须同时给 text 作为语音转文字内容，dur 是秒数，且语音里的话要更口语、更碎；
7. 如果用户分享了一条夜话，要针对内容本身说具体的话，不要泛泛而谈。`,
`最近的对话：
${chatCtx(tid)}

${trigger||'请自然地接着说下去。'}

输出 JSON：{"messages":[{"kind":"text|voice|sys","text":"","dur":7,"quote":"要引用的用户原话，可空","revoked":false}]}`,
    {max:1400,temp:1.1});
    let arr=(j.messages||[]).filter(m=>m&&(m.text||m.kind==='sys'));
    const rm=$('#typingRow'); if(rm) rm.remove();
    if(!arr.length) throw new Error('空回复');
    arr = arr.slice(0,6);
    for(let i=0;i<arr.length;i++){
      const m=arr[i];
      pushMsg(tid,{ side:'them', kind:['text','voice','sys'].includes(m.kind)?m.kind:'text',
                    text:m.text||'', dur:m.dur||(m.kind==='voice'?rnd(4,32):null), quote:m.quote||'', revoked:!!m.revoked });
      if(CUR_CHAT===String(tid)) paintChat();
      if(i<arr.length-1) await new Promise(r=>setTimeout(r,rnd(280,760)));
    }
    if(CUR_CHAT!==String(tid)){
      const t=S.threads.find(x=>String(x.id)===String(tid));
      if(t) t.unread=(t.unread||0)+arr.length;
    }
    save(); renderDM();
  }catch(e){
    const rm=$('#typingRow'); if(rm) rm.remove();
    toast('回应失败：'+e.message);
  }
}
function chatSend(){
  const ta=$('#chatIn'); const v=(ta.value||'').trim(); if(!v||!CUR_CHAT) return;
  pushMsg(CUR_CHAT,{side:'me',kind:'text',text:v,quote:CHAT_QUOTE||''});
  ta.value=''; ta.style.height='auto'; CHAT_QUOTE=null; paintChatQuote(); paintChat(); renderDM();
  /* 不自动回复：等用户点「让Ta回应」 */
}
/* AI 主动私信：结合用户发过的帖子与评论 */
async function genNpcDm(){
  if(!hasApi()) return toast(T('noapi'));
  let pool = allAuthors();
  if(pool.length<2 && S.settings.autoNpc){ await genNpcs(3); pool=allAuthors(); }
  if(!pool.length) return toast(T('nochar'));
  const c = pick1(pool);
  const mine = S.posts.filter(p=>p.authorId==='me').slice(0,4);
  const myCms=[];
  S.posts.forEach(p=>(p.comments||[]).forEach(cm=>{
    if(cm.uid==='me') myCms.push('在《'+(p.title||TYPES[p.type].cn)+'》下说："'+cm.text+'"');
    (cm.replies||[]).forEach(r=>{ if(r.uid==='me') myCms.push('回复 '+cm.name+'："'+r.text+'"'); });
  }));
  const seen = S.posts.filter(p=>p.liked||p.collected).slice(0,4);
  busy(true,'有人在写给你');
  try{
    const lang=c.lang||S.settings.contentLang;
    const j = await aiJson(
`${APP_SYS(lang)}
你扮演「${c.name}」，第一次主动私信用户。你是在广场上看到用户的痕迹之后才决定开口的。
${charBrief(c,true)}

${meBrief()}`,
`用户在广场上的痕迹：
${mine.length?('· Ta 发过的夜话：\n'+mine.map(p=>'  - 【'+TYPES[p.type].cn+'】'+postPlain(p).slice(0,150)).join('\n')):'· Ta 还没发过夜话'}
${myCms.length?('· Ta 的评论：\n'+myCms.slice(0,6).map(x=>'  - '+x).join('\n')):''}
${seen.length?('· Ta 收藏/共鸣过：\n'+seen.map(p=>'  - '+postPlain(p).slice(0,90)).join('\n')):''}

请写这次开场私信，总共 ${rnd(2,4)} 条，条数与长短都要自然。
要求：
1. 必须具体点出你是在哪一条内容里注意到 Ta 的，引用其中一个具体细节，不要泛泛而谈"看到你的帖子很有共鸣"；
2. 语气符合人设，第一句不要太长，可以很突兀；
3. 不要自我介绍成一份简历，最多一句带过；
4. 禁止 emoji；语言用 ${langName(lang)}。

JSON：{"messages":[{"kind":"text|voice","text":"","dur":8}]}`,
    {max:900,temp:1.12});
    const arr=(j.messages||[]).filter(m=>m&&m.text).slice(0,5);
    if(!arr.length) throw new Error('空');
    arr.forEach(m=>pushMsg(c.id,{side:'them',kind:m.kind==='voice'?'voice':'text',text:m.text,dur:m.dur||(m.kind==='voice'?rnd(5,26):null)}));
    const t=S.threads.find(x=>String(x.id)===String(c.id));
    if(t) t.unread=(t.unread||0)+arr.length;
    S.notifs.unshift({id:uid(),read:false,name:c.name,text:'给你发来了私语',ts:Date.now()});
    save(); renderDM();
    toast(c.name+' 给你发了私语');
  }catch(e){ toast('生成失败：'+e.message); }
  busy(false);
}

/* ================================================================
   29 · 个人主页（IG / X 式）
================================================================ */
function charMeta(id){
  const k=String(id);
  if(!S.charMeta[k]){
    const c=anyById(id);
    const h=strHash(k);
    S.charMeta[k]={ followers: (c&&c.followers)||(1200+h%48000), views:(3000+h%260000), joined:Date.now()-(h%900)*86400000 };
  }
  return S.charMeta[k];
}
const postsOf = id => S.posts.filter(p=>String(p.authorId)===String(id));
let PF_TAB='post';
function openProfile(id){
  if(String(id)==='me') return openMeProfile();
  const c=anyById(id); if(!c) return;
  PF_TAB='post';
  pushPage({ key:'profile', data:id,
    html: pageHead(c.name,c.handle?('@'+c.handle):'PROFILE',
      '<button class="ic-btn" data-act="chat" data-id="'+esc(String(id))+'">'+I.cm+'</button>')
      + '<div class="page-body" id="pfBody"></div>',
    after:()=>paintProfile(id,'post') });
}
function pfCell(p){
  const sum = postPlain(p).replace(/\n/g,' ').slice(0,70);
  return '<button class="pf-cell" data-act="open" data-id="'+p.id+'">'
   + '<div class="ck">'+esc(TYPES[p.type].en)+'</div>'
   + '<div class="cx">'+esc(sum)+'</div>'
   + '<div class="cn">'+I.heart+'<span>'+nfmt((p.stats||{}).like||0)+'</span></div></button>';
}
function paintProfile(id,tab){
  PF_TAB=tab||PF_TAB;
  const body=$('#pfBody'); if(!body) return;
  const c=anyById(id), m=charMeta(id), mine=postsOf(id);
  let h='<div class="pf">';
  h += '<div class="pf-cover">'+(c.cover?'<img src="'+esc(c.cover)+'" alt="">':'')+'<div class="pf-cover-orn"></div></div>';
  h += '<div class="pf-main">';
  h += '<div class="pf-row"><div class="pf-ava">'+(c.avatar?'<img src="'+esc(c.avatar)+'" alt="">':esc(initial(c.name)))+'</div>'
    +  '<div class="pf-acts">'
    +    '<button class="btn sm" data-act="chat" data-id="'+esc(String(id))+'">'+I.cm+'<span>私语</span></button>'
    +    '<button class="btn sm '+(isFollowed(id)?'':'solid')+'" data-act="follow" data-id="'+esc(String(id))+'">'+esc(isFollowed(id)?T('following'):T('follow'))+'</button>'
    +  '</div></div>';
  h += '<div class="pf-name"><b>'+esc(c.name)+'</b>'+(c.__npc?'<span class="src-tag ai">AI</span>':'<span class="pf-vf">'+I.check+'</span>')+'</div>';
  h += '<div class="pf-handle">@'+esc(c.handle||('u'+String(id).slice(-4)))+'</div>';
  if(c.sign||c.bio||c.desc) h += '<div class="pf-sign">'+esc(c.sign||c.bio||c.desc)+'</div>';
  h += '<div class="pf-meta">';
  if(c.role) h += '<span class="pf-mi">'+I.user+esc(c.role)+'</span>';
  if(c.lang) h += '<span class="pf-mi">'+I.globe+esc(langName(c.lang))+'</span>';
  h += '<span class="pf-mi">'+I.cal+'加入于 '+new Date(m.joined).toLocaleDateString()+'</span>';
  if(lampState(id).n) h += '<span class="pf-mi">'+I.lamp+'灯火 '+lampState(id).n+' 天</span>';
  h += '</div>';
  h += '<div class="pf-stats">'
    +  '<div class="pf-st"><b>'+nfmt(mine.length)+'</b><span>'+esc(T('post'))+'</span></div>'
    +  '<div class="pf-st" data-act="ptap" data-k="followers" data-id="'+esc(String(id))+'"><b>'+nfmt(m.followers)+'</b><span>'+esc(T('followers'))+'</span></div>'
    +  '<div class="pf-st"><b>'+nfmt(followingCount())+'</b><span>'+esc(T('follows'))+'</span></div>'
    +  '<div class="pf-st" data-act="ptap" data-k="views" data-id="'+esc(String(id))+'"><b>'+nfmt(m.views)+'</b><span>'+esc(T('views'))+'</span></div>'
    +  '</div>';
  h += '<div class="pf-tabs">'
    + [['post','夜话'],['chat','留影'],['likes','共鸣']].map(x=>'<button class="pf-tab'+(PF_TAB===x[0]?' on':'')+'" data-pftab="'+x[0]+'" data-id="'+esc(String(id))+'">'+esc(x[1])+'</button>').join('')
    + '</div>';
  let list = mine;
  if(PF_TAB==='chat') list = mine.filter(p=>p.chat);
  if(PF_TAB==='likes') list = S.posts.filter(p=>p.liked && String(p.authorId)===String(id));
  h += list.length
    ? '<div class="pf-grid">'+list.map(pfCell).join('')+'</div>'
    : '<div class="empty"><div class="empty-mk">'+I.moon+'</div><b>'+esc(T('none'))+'</b><span>nothing yet</span></div>';
  h += '<div style="height:16px"></div>';
  h += '<button class="btn wide ghost" data-act="genfor" data-id="'+esc(String(id))+'">'+I.spark+'<span>让 '+esc(c.name)+' 发一条夜话</span></button>';
  h += '</div></div>';
  body.innerHTML=h;
}
/* 我的主页 */
let ME_TAB='post';
function openMeProfile(){
  ME_TAB='post';
  pushPage({ key:'meprofile',
    html: pageHead(S.profile.name||'我','PROFILE','<button class="ic-btn" data-act="editme">'+I.edit+'</button>')
      + '<div class="page-body" id="mpBody"></div>',
    after:()=>paintMeProfile('post') });
}
function paintMeProfile(tab){
  ME_TAB=tab||ME_TAB;
  const body=$('#mpBody'); if(!body) return;
  const p=S.profile, mine=postsOf('me');
  const totalView = mine.reduce((a,x)=>a+((x.stats||{}).view||0),0)+p.views;
  let h='<div class="pf">';
  h += '<div class="pf-cover">'+(p.cover?'<img src="'+esc(p.cover)+'" alt="">':'')+'<div class="pf-cover-orn"></div></div>';
  h += '<div class="pf-main">';
  h += '<div class="pf-row"><div class="pf-ava">'+(p.avatar?'<img src="'+esc(p.avatar)+'" alt="">':esc(initial(p.name||'夜')))+'</div>'
    +  '<div class="pf-acts"><button class="btn sm" data-act="editme">'+I.edit+'<span>'+esc(T('edit'))+'</span></button>'
    +  '<button class="btn sm solid" data-act="tideall">'+I.bolt+'<span>夜潮</span></button></div></div>';
  h += '<div class="pf-name"><b>'+esc(p.name||'未署名的旅人')+'</b><span class="pf-vf">'+I.check+'</span></div>';
  h += '<div class="pf-handle">@'+esc(p.handle||'unsigned')+'</div>';
  h += '<div class="pf-sign">'+esc(p.sign||p.bio||'所有未说出口的，都留在这里')+'</div>';
  h += '<div class="pf-meta">';
  if(p.location) h += '<span class="pf-mi">'+I.pin+esc(p.location)+'</span>';
  if(p.birthday) h += '<span class="pf-mi">'+I.cake+esc(p.birthday)+'</span>';
  if(p.link) h += '<span class="pf-mi">'+I.link+esc(p.link)+'</span>';
  h += '<span class="pf-mi">'+I.cal+'加入于 '+new Date(p.joined||Date.now()).toLocaleDateString()+'</span></div>';
  h += '<div class="pf-stats">'
    +  '<div class="pf-st"><b>'+nfmt(mine.length)+'</b><span>'+esc(T('post'))+'</span></div>'
    +  '<div class="pf-st" data-act="metap" data-k="followers"><b id="stFol">'+nfmt(p.followers)+'</b><span>'+esc(T('followers'))+'</span><span class="up" id="upFol"></span></div>'
    +  '<div class="pf-st" data-act="folist"><b>'+nfmt(followingCount())+'</b><span>'+esc(T('follows'))+'</span></div>'
    +  '<div class="pf-st" data-act="metap" data-k="views"><b id="stView">'+nfmt(totalView)+'</b><span>'+esc(T('views'))+'</span><span class="up" id="upView"></span></div>'
    +  '</div>';
  h += '<div class="pf-tabs">'
    + [['post','夜话'],['likes',T('likes')],['saved',T('saved')],['rp',T('reposts')]].map(x=>'<button class="pf-tab'+(ME_TAB===x[0]?' on':'')+'" data-metab="'+x[0]+'">'+esc(x[1])+'</button>').join('')
    + '</div>';
  let list = mine;
  if(ME_TAB==='likes') list=S.posts.filter(x=>x.liked);
  if(ME_TAB==='saved') list=S.posts.filter(x=>x.collected);
  if(ME_TAB==='rp')    list=S.posts.filter(x=>x.reposted);
  h += list.length? '<div class="pf-grid">'+list.map(pfCell).join('')+'</div>'
    : '<div class="empty"><div class="empty-mk">'+I.moon+'</div><b>'+esc(T('none'))+'</b><span>nothing yet</span></div>';
  h += '</div></div>';
  body.innerHTML=h;
}
/* 手动推进数据：夜潮 */
function tidePost(p){
  const base = 1 + Math.log10(1+(p.stats.view||1));
  bumpStats(p,'view', rnd(8,90)*Math.round(base));
  bumpStats(p,'like', rnd(1,14));
  if(Math.random()<.45) bumpStats(p,'rp', rnd(1,4));
  if(Math.random()<.35) bumpStats(p,'cm', rnd(1,3));
  S.profile.views += rnd(6,60);
  if(Math.random()<.5) S.profile.followers += rnd(1,7);
  S.stats.view += rnd(5,40); S.stats.like += rnd(1,10);
  S.stats.history = (S.stats.history||[]).concat([{ts:Date.now(),v:p.stats.view}]).slice(-40);
  save();
}
function tideAll(){
  const mine=postsOf('me');
  if(!mine.length){ toast('你还没有发过夜话'); return; }
  mine.forEach(tidePost);
  toast('夜潮涨了 · '+mine.length+' 条数据已推进');
  renderFeed(); paintMeProfile(); renderMe();
}
function floatUp(elId,txt){
  const el=$('#'+elId); if(!el) return;
  el.textContent=txt; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
}

/* ================================================================
   30 · 我的（入口页）
================================================================ */
function renderMe(){
  const box=$('#meScroll'); if(!box) return;
  const p=S.profile, mine=postsOf('me');
  const totalView = mine.reduce((a,x)=>a+((x.stats||{}).view||0),0)+p.views;
  let h='<div class="pf rise" style="--d:0">';
  h += '<div class="pf-cover">'+(p.cover?'<img src="'+esc(p.cover)+'" alt="">':(S.settings.meWall?'<img src="'+esc(S.settings.meWall)+'" alt="">':''))+'<div class="pf-cover-orn"></div></div>';
  h += '<div class="pf-main"><div class="pf-row"><div class="pf-ava">'+(p.avatar?'<img src="'+esc(p.avatar)+'" alt="">':esc(initial(p.name||'夜')))+'</div>'
    +  '<div class="pf-acts"><button class="btn sm" data-act="editme">'+I.edit+'<span>'+esc(T('edit'))+'</span></button>'
    +  '<button class="btn sm solid" data-act="meprofile">'+I.grid+'<span>主页</span></button></div></div>';
  h += '<div class="pf-name"><b>'+esc(p.name||'未署名的旅人')+'</b><span class="pf-vf">'+I.check+'</span></div>';
  h += '<div class="pf-handle">@'+esc(p.handle||'unsigned')+'</div>';
  h += '<div class="pf-sign">'+esc(p.sign||p.bio||'所有未说出口的，都留在这里')+'</div>';
  h += '<div class="pf-stats">'
    +  '<button class="pf-st" data-act="meprofile"><b>'+nfmt(mine.length)+'</b><span>'+esc(T('post'))+'</span></button>'
    +  '<button class="pf-st" data-act="metap" data-k="followers"><b id="stFol2">'+nfmt(p.followers)+'</b><span>'+esc(T('followers'))+'</span></button>'
    +  '<button class="pf-st" data-act="folist"><b>'+nfmt(followingCount())+'</b><span>'+esc(T('follows'))+'</span></button>'
    +  '<button class="pf-st" data-act="metap" data-k="views"><b id="stView2">'+nfmt(totalView)+'</b><span>'+esc(T('views'))+'</span></button>'
    +  '</div></div></div>';

  h += '<div class="sec-label rise" style="--d:1"><b>Studio</b><i></i></div>';
  h += '<div class="menu rise" style="--d:2">'
    + '<button class="menu-i" data-act="npcman">'+I.user+'<b>博主管理</b><em>'+S.npcs.length+' 位 AI 博主</em>'+I.chev+'</button>'
    + '<button class="menu-i" data-act="mancat">'+I.layers+'<b>收纳分类</b><em>'+S.cats.length+' 组</em>'+I.chev+'</button>'
    + '<button class="menu-i" data-act="data">'+I.chart+'<b>'+esc(T('dm.data'))+'</b><em>'+notifUnread()+'</em>'+I.chev+'</button>'
    + '<button class="menu-i" data-act="tideall">'+I.bolt+'<b>推进夜潮</b><em>手动涨数据</em>'+I.chev+'</button>'
    + '</div>';
  h += '<div class="sec-label rise" style="--d:3"><b>Preferences</b><i></i></div>';
  h += '<div class="menu rise" style="--d:4">'
    + '<button class="menu-i" data-act="skin">'+I.sliders+'<b>'+esc(T('skin'))+'</b><em>'+esc((SKINS.find(s=>s.k===S.settings.skin)||SKINS[0]).n)+'</em>'+I.chev+'</button>'
    + '<button class="menu-i" data-act="tone">'+I.book+'<b>文风与世界观</b><em>'+((S.settings.tone||[]).length+(S.settings.world?1:0))+' 项</em>'+I.chev+'</button>'
    + '<button class="menu-i" data-act="langpage">'+I.globe+'<b>语言系统</b><em>'+(S.settings.langMode==='mix'?'多语种':langShort(S.settings.contentLang))+'</em>'+I.chev+'</button>'
    + '<button class="menu-i" data-act="lamprule">'+I.lamp+'<b>'+esc(T('lamp'))+'规则</b><em>LAMPLIGHT</em>'+I.chev+'</button>'
    + '<button class="menu-i" data-act="setting">'+I.cam+'<b>'+esc(T('set'))+'</b><em></em>'+I.chev+'</button>'
    + '</div>';
  box.innerHTML=h;
}

/* ================================================================
   31 · 抽屉（仅编辑资料等少数场景使用）
================================================================ */
function sheet(title,sub,bodyHtml,footHtml,after){
  const host=$('#sheetHost');
  const wrap=document.createElement('div');
  wrap.innerHTML='<div class="sheet-mask"></div><div class="sheet"><div class="sheet-grab"></div>'
    +'<div class="sheet-head"><div class="st"><b>'+esc(title)+'</b><span>'+esc(sub||'')+'</span></div>'
    +'<button class="sheet-x" data-act="closesheet">'+I.x+'</button></div>'
    +'<div class="sheet-body">'+bodyHtml+'</div>'
    +(footHtml?'<div class="sheet-foot">'+footHtml+'</div>':'')+'</div>';
  host.appendChild(wrap);
  const mask=$('.sheet-mask',wrap), sh=$('.sheet',wrap);
  requestAnimationFrame(()=>{ mask.classList.add('in'); sh.classList.add('in'); });
  mask.onclick=()=>closeSheet(wrap);
  if(after) after(wrap);
  return wrap;
}
function closeSheet(w){
  const host=$('#sheetHost');
  const wrap=w||host.lastElementChild; if(!wrap) return;
  const mask=$('.sheet-mask',wrap), sh=$('.sheet',wrap);
  if(mask) mask.classList.remove('in'); if(sh) sh.classList.remove('in');
  setTimeout(()=>wrap.remove(),420);
}
function readFile(file,cb){ const r=new FileReader(); r.onload=()=>cb(r.result); r.readAsDataURL(file); }
function pickImage(cb){
  const i=document.createElement('input'); i.type='file'; i.accept='image/*';
  i.onchange=()=>{ if(i.files&&i.files[0]) readFile(i.files[0],cb); };
  i.click();
}

/* ================================================================
   32 · 外观系统
================================================================ */
const CLASS_HELP = [
  ['.yh-app','整个应用容器'],
  ['.yh-top / .yh-brand','顶栏与品牌区'],
  ['.cat-rail / .cat-chip','隐藏分类轨与分类标签'],
  ['.yh-nav-row / .nav-i','底部导航与单个导航项'],
  ['.yh-fab','右下角发布浮钮'],
  ['.topic-card','今夜话题卡'],
  ['.gen-bar','生成条'],
  ['.post','帖子卡（.post.mine 是自己的）'],
  ['.p-head / .p-name / .p-sub','帖子头部'],
  ['.p-text / .p-title','正文与标题'],
  ['.p-foot / .p-act','底部互动条'],
  ['.p-cmprev','帖子里的评论预览'],
  ['.b-list .b-verse .b-ask','清单 / 短诗 / 提问箱'],
  ['.b-quote .b-moment .b-diary','夜话卡 / 碎片 / 日记'],
  ['.b-letter .b-pl .b-review','信 / 歌单 / 锐评'],
  ['.b-poll .b-dream .b-thread','投票 / 梦境 / 长推'],
  ['.b-snip .b-voice','摘抄 / 语音条'],
  ['.cc / .cc-b / .cc-head','留影卡、气泡、卡头'],
  ['.cm / .cm-x / .cm-sub','评论、评论正文、二级评论区'],
  ['.th / .th-n / .th-p','私语列表项'],
  ['.msg / .bub / .vmsg','聊天消息 / 气泡 / 语音条'],
  ['.fw','转发卡（.fw[data-k="体裁"] 可分别改）'],
  ['.lamp / .lamp.t1~.t8','灯火徽章与各阶'],
  ['.pf / .pf-ava / .pf-stats','个人主页各区块'],
  ['.page / .page-head','二级页面'],
  ['.btn / .inp / .ta / .tg','按钮 / 输入框 / 文本域 / 标签']
];
function openSkin(){
  pushPage({ key:'skin',
    html: pageHead(T('skin'),'APPEARANCE','<button class="ic-btn" data-act="skinreset">'+I.trash+'</button>')
      + '<div class="page-body" id="skBody"></div>',
    after:()=>paintSkin() });
}
function skSec(id,title,en,inner,open){
  return '<div class="sk-sec'+(open?' open':'')+'" data-sk="'+id+'">'
   + '<button class="sk-sec-h" data-act="sktoggle" data-id="'+id+'"><b>'+esc(title)+'</b><span>'+esc(en)+'</span>'+I.down+'</button>'
   + '<div class="sk-sec-b"><div class="sk-sec-in">'+inner+'</div></div></div>';
}
function paintSkin(){
  const body=$('#skBody'); if(!body) return;
  const t=currentTokens(), st=S.settings;
  let h='';

  h += '<div class="sec-label" style="margin-top:0"><b>Presets</b><i></i></div>';
  h += '<div class="sk-themes">'+SKINS.map(s=>'<button class="sk-th'+(st.skin===s.k?' on':'')+'" data-skin="'+s.k+'">'
     + '<div class="sk-sw"><i style="background:'+s.t['--paper']+'"></i><i style="background:'+s.t['--paper-2']+'"></i><i style="background:'+s.t['--acc-2']+'"></i><i style="background:'+s.t['--acc']+'"></i></div>'
     + '<span>'+esc(s.n)+'</span></button>').join('')+'</div>';

  h += '<div class="sec-label"><b>Fine tune</b><i></i></div>';

  /* 颜色 */
  let colors='';
  SKIN_KEYS.forEach(k=>{
    colors += '<div class="clr-row"><span class="clr"><input type="color" value="'+(t[k]||'#888888')+'" data-tok="'+k+'"></span>'
      + '<b>'+esc(SKIN_LABEL[k])+'</b><em>'+esc(k)+'</em></div>';
  });
  h += skSec('color','颜色','COLOR',colors,true);

  /* 数值 */
  let nums='';
  NUM_KEYS.forEach(n=>{
    let v = st.tokens[n.k];
    if(v==null){ const d={'--fs':15,'--lh':1.78,'--ls':.01,'--r-m':19,'--r-l':26,'--r-x':34,'--pad':16,'--op-card':.9,'--op-nav':.7,'--op-top':.62,'--wall-blur':16,'--wall-veil':.58,'--wall-sat':1.02,'--chat-veil':.72,'--txt-shadow-a':0}; v=d[n.k]; }
    nums += '<div class="rng-row"><label>'+esc(n.l)+'</label>'
      + '<input class="rng" type="range" min="'+n.min+'" max="'+n.max+'" step="'+n.step+'" value="'+v+'" data-num="'+n.k+'">'
      + '<b data-numv="'+n.k+'">'+v+'</b></div>';
  });
  h += skSec('num','排版与透明度','LAYOUT',nums);

  /* 字体 */
  h += skSec('font','字体','TYPEFACE',
    '<div class="pick-row">'+FONT_SETS.map(f=>'<button class="tg'+(st.fontSet===f.k?' on':'')+'" data-font="'+f.k+'">'+esc(f.n)+'</button>').join('')+'</div>');

  /* 背景 */
  h += skSec('wall','背景图','WALLPAPER',
    '<div class="fld"><label>全局背景</label><div class="up-row">'
    + '<button class="up-prev wide" id="upWall" style="'+(st.wall?'background-image:url('+esc(st.wall)+')':'')+'">'+(st.wall?'':I.img)+'</button>'
    + '<button class="btn sm" data-act="clearwall">'+esc(T('del'))+'</button></div>'
    + '<div class="hint">模糊度与白纱在上面「排版与透明度」里调，可以一路调到完全清晰、完全显示原图。详情页、主页、聊天页都会同步这张背景。</div></div>'
    + '<div class="fld"><label>私信背景（留空则跟随全局）</label><div class="up-row">'
    + '<button class="up-prev wide" id="upCWall" style="'+(st.chatWall?'background-image:url('+esc(st.chatWall)+')':'')+'">'+(st.chatWall?'':I.img)+'</button>'
    + '<button class="btn sm" data-act="clearcwall">'+esc(T('del'))+'</button></div></div>');

  /* 留影卡 */
  h += skSec('cc','留影卡','CAPTURE',
    '<div class="pick-row">'+CC_THEMES.map(c=>'<button class="tg'+(st.ccTheme===c.k?' on':'')+'" data-ccth="'+c.k+'">'+esc(c.n)+'</button>').join('')+'</div>');

  /* 自定义 CSS */
  h += skSec('css','自定义 CSS','CUSTOM CSS',
    '<textarea class="ta mono tall" id="skCss" placeholder=".post{ border-radius:22px; }\n.bub{ font-size:15px; }">'+esc(st.ccCss||'')+'</textarea>'
    + '<div class="hint">写完点下面的保存即时生效。可用的 CSS 变量名与上面的调节项一致（如 <code>--acc</code>、<code>--r-m</code>）。下面是常用类名速查，名字对不上是写不出效果的：</div>'
    + '<div style="height:9px"></div>'
    + '<div class="cls-table">'+CLASS_HELP.map(r=>'<div class="cls-r"><code>'+esc(r[0])+'</code><span>'+esc(r[1])+'</span></div>').join('')+'</div>'
    + '<div style="height:11px"></div><button class="btn wide solid" data-act="savecss">'+esc(T('save'))+' CSS</button>');

  /* 存档 */
  let ps = S.skinPresets.length
    ? '<div class="preset-list">'+S.skinPresets.map((p,i)=>'<div class="preset-i">'
      + '<span class="pi-sw"><i style="background:'+((p.tokens&&p.tokens['--paper'])||'#f6f6f9')+'"></i><i style="background:'+((p.tokens&&p.tokens['--acc-2'])||'#a9a9c2')+'"></i><i style="background:'+((p.tokens&&p.tokens['--acc'])||'#6f6f86')+'"></i></span>'
      + '<b>'+esc(p.name)+'</b>'
      + '<button class="btn sm" data-act="skload" data-i="'+i+'">应用</button>'
      + '<button class="pi-x" data-act="skdel" data-i="'+i+'">'+I.trash+'</button></div>').join('')+'</div>'
    : '<div class="hint">还没有存档。调好之后存下来，下次一键换回。</div>';
  ps += '<div style="height:11px"></div><div class="fld-row"><input class="inp" id="skName" placeholder="存档名字"><button class="btn solid" data-act="sksave">存档</button></div>';
  h += skSec('preset','外观存档','PRESETS',ps,true);

  body.innerHTML=h;
  bindSkinInputs();
}
function bindSkinInputs(){
  $$('[data-tok]').forEach(el=>{
    el.oninput=e=>{ S.settings.tokens[el.dataset.tok]=e.target.value; applySkin(); save(); };
  });
  $$('[data-num]').forEach(el=>{
    el.oninput=e=>{
      const k=el.dataset.num, v=parseFloat(e.target.value);
      S.settings.tokens[k]=v; applySkin(); 
      const b=$('[data-numv="'+k+'"]'); if(b) b.textContent=v;
      save();
    };
  });
  const uw=$('#upWall'); if(uw) uw.onclick=()=>pickImage(d=>{ S.settings.wall=d; save(); applyWall(); paintSkin(); });
  const uc=$('#upCWall'); if(uc) uc.onclick=()=>pickImage(d=>{ S.settings.chatWall=d; save(); paintSkin(); toast('已设置'); });
}

/* ================================================================
   33 · 文风与世界观
================================================================ */
function openTone(){
  pushPage({ key:'tone',
    html: pageHead('文风与世界观','VOICE & LORE','')
      + '<div class="page-body" id="tnBody"></div>',
    after:()=>paintTone() });
}
function paintTone(){
  const b=$('#tnBody'); if(!b) return;
  const st=S.settings;
  let h='<div class="hint" style="margin-bottom:14px">这里写的东西会进入每一次生成的系统提示词，优先级高于内置规则。写得越具体，生成越像你要的那个味道。</div>';
  h += '<div class="fld"><label>内置文风（可多选）</label><div class="pick-row">'
     + TONE_PRESETS.map(t=>'<button class="tg'+((st.tone||[]).includes(t.k)?' on':'')+'" data-tone="'+t.k+'">'+esc(t.n)+'</button>').join('')
     + '</div></div>';
  h += '<div class="fld"><label>自定义文风（最高优先级）</label>'
     + '<textarea class="ta tall" id="tnCustom" placeholder="例：句子要短，句号多，不要用比喻。人物说话时常常答非所问，重要的话都放在括号里。">'+esc(st.toneCustom||'')+'</textarea></div>';
  h += '<div class="fld"><label>世界观设定</label>'
     + '<textarea class="ta tall" id="tnWorld" placeholder="例：故事发生在一座常年下雨的旧港城，晚上十一点后地铁停运，所有人靠夜巴回家。这里没有超自然元素，但每个人都相信城南的钟楼会在凌晨敲十三下。">'+esc(st.world||'')+'</textarea></div>';
  h += '<div class="fld"><label>禁止出现</label>'
     + '<textarea class="ta" id="tnTaboo" placeholder="例：不要出现现实中的品牌名；不要出现自杀相关内容；不要写成鸡汤。">'+esc(st.taboo||'')+'</textarea></div>';
  h += '<div class="fld"><label>我的补充设定（会让角色更懂你）</label>'
     + '<textarea class="ta" id="tnPersona" placeholder="例：我是夜班护士，习惯凌晨四点下班。别人叫我阿栗。">'+esc(st.persona||'')+'</textarea></div>';
  h += '<div class="sec-label"><b>Presets</b><i></i></div>';
  h += S.tonePresets.length
    ? '<div class="preset-list">'+S.tonePresets.map((p,i)=>'<div class="preset-i"><b>'+esc(p.name)+'</b>'
      + '<button class="btn sm" data-act="tnload" data-i="'+i+'">应用</button>'
      + '<button class="pi-x" data-act="tndel" data-i="'+i+'">'+I.trash+'</button></div>').join('')+'</div>'
    : '<div class="hint">存下来的文风方案会出现在这里。</div>';
  h += '<div style="height:11px"></div><div class="fld-row"><input class="inp" id="tnName" placeholder="方案名字"><button class="btn solid" data-act="tnsave">存档</button></div>';
  h += '<div style="height:14px"></div><button class="btn wide solid" data-act="tnapply">'+esc(T('save'))+'</button>';
  b.innerHTML=h;
}

/* ================================================================
   34 · 语言系统
================================================================ */
function openLangPage(){
  pushPage({ key:'langp',
    html: pageHead('语言系统','LANGUAGE','')+'<div class="page-body" id="lgBody"></div>',
    after:()=>paintLangPage() });
}
function paintLangPage(){
  const b=$('#lgBody'); if(!b) return;
  const st=S.settings;
  let h='';
  h += '<div class="fld"><label>界面语言</label><div class="pick-row">'
     + UI.map(c=>'<button class="tg'+(st.uiLang===c?' on':'')+'" data-setlang="uiLang" data-v="'+c+'">'+esc(langName(c))+'</button>').join('')+'</div></div>';
  h += '<div class="fld"><label>生成语言模式</label><div class="pick-row">'
     + '<button class="tg'+(st.langMode==='fixed'?' on':'')+'" data-langmode="fixed">单一语言</button>'
     + '<button class="tg'+(st.langMode==='mix'?' on':'')+'" data-langmode="mix">多语种混合</button></div>'
     + '<div class="hint">选「多语种混合」后，广场上不同博主会用不同语言发帖，每条帖子会标出语种。译文只有进入详情页后才能展开，列表里保持干净。</div></div>';
  if(st.langMode==='fixed'){
    h += '<div class="fld"><label>内容语言</label>'
       + LANGS.map(l=>'<button class="lang-i'+(st.contentLang===l.c?' on':'')+'" data-setlang="contentLang" data-v="'+l.c+'"><b>'+esc(l.n)+'</b><span>'+esc(l.e)+'</span><i></i></button>').join('')+'</div>';
  }else{
    h += '<div class="fld"><label>参与混合的语言（点选，至少 1 种）</label>'
       + LANGS.map(l=>'<button class="lang-i'+((st.langPool||[]).includes(l.c)?' on':'')+'" data-poollang="'+l.c+'"><b>'+esc(l.n)+'</b><span>'+esc(l.e)+'</span><i></i></button>').join('')+'</div>';
  }
  h += '<div class="fld"><label>翻译目标（详情页展开译文时使用）</label>'
     + LANGS.map(l=>'<button class="lang-i'+(st.transLang===l.c?' on':'')+'" data-setlang="transLang" data-v="'+l.c+'"><b>'+esc(l.n)+'</b><span>'+esc(l.e)+'</span><i></i></button>').join('')+'</div>';
  b.innerHTML=h;
}

/* ================================================================
   35 · 灯火规则页
================================================================ */
function openLampRules(tid){
  const s = tid?lampState(tid):null;
  pushPage({ key:'lamp',
    html: pageHead(T('lamp'),'LAMPLIGHT','')+'<div class="page-body" id="lpBody"></div>',
    after:()=>{
      const b=$('#lpBody'); if(!b) return;
      let h='';
      if(s){
        const next = LAMP_TIERS.find(x=>x.min>s.n) || LAMP_TIERS[LAMP_TIERS.length-1];
        const prevMin = s.tier.min, span = Math.max(1,next.min-prevMin);
        const pct = clamp(Math.round((s.n-prevMin)/span*100),0,100);
        h += '<div class="lamp-card"><div class="lamp-top">'
          +  '<div class="lamp-big">'+LAMP_ICON[s.tier.t]+'</div>'
          +  '<div class="lamp-info"><b>'+esc(s.tier.n)+'</b><span>'+esc(s.tier.en)+' · '+(s.state==='ember'?'余烬中':'燃烧中')+'</span></div>'
          +  '<div class="lamp-day"><b>'+s.n+'</b><span>DAYS</span></div></div>'
          +  '<div class="lamp-bar"><i style="width:'+pct+'%"></i></div>'
          +  '<div class="lamp-next"><span>'+esc(s.tier.n)+'</span><span>还差 '+Math.max(0,next.min-s.n)+' 天到 '+esc(next.n)+'</span></div></div>';
      }
      h += '<div class="sec-label" style="margin-top:12px"><b>Rules</b><i></i></div>';
      h += '<div class="rule-list">'
        + [['当天你和对方各发出至少一条消息，这盏灯就算<b>点亮</b>，灯龄 +1。只有一方说话不算。'],
           ['连续点亮，灯龄连续增长；一天只记一次，刷屏没有用。'],
           ['断一天后进入<b>余烬</b>状态，余烬可以保留 <b>3 天</b>。在余烬期内重新点亮，灯龄按原来的 <b>70%</b> 保留并继续往上走。'],
           ['超过 3 天没有点亮，灯<b>熄灭</b>，灯龄归零，从 1 重新开始。'],
           ['灯龄决定徽章阶位，一共八阶，每一阶的图案、颜色都不一样，会显示在会话列表、聊天页头部和对方主页上。'],
           ['历史最高灯龄会被记录下来，即使熄灭也不会丢失。']]
          .map((r,i)=>'<div class="rule-i"><span class="rn">'+String(i+1).padStart(2,'0')+'</span><span class="rt">'+r[0]+'</span></div>').join('')
        + '</div>';
      h += '<div class="sec-label"><b>Tiers</b><i></i></div>';
      h += '<div class="lamp-tiers">'+LAMP_TIERS.map(t=>'<div class="lamp-tier'+(s&&s.tier.t===t.t?' cur':'')+'">'
        + '<div class="lt-ic">'+LAMP_ICON[t.t]+'</div>'
        + '<div class="lt-b"><b>'+esc(t.n)+'</b><span>'+esc(t.d)+'</span></div>'
        + '<div class="lt-d">'+t.min+'+ 天</div></div>').join('')+'</div>';
      b.innerHTML=h;
    }});
}

/* ================================================================
   36 · 收纳分类 / 博主管理
================================================================ */
function openCatMan(){
  pushPage({ key:'cat',
    html: pageHead('收纳分类','COLLECTIONS','')+'<div class="page-body" id="ctBody"></div>',
    after:()=>paintCatMan() });
}
function paintCatMan(){
  const b=$('#ctBody'); if(!b) return;
  let h='<div class="hint" style="margin-bottom:12px">每次生成都会自动收进一个分类，广场顶部点标题即可展开或收起分类轨，平时它是藏起来的，不影响观感。</div>';
  h += '<div class="fld-row" style="margin-bottom:14px"><input class="inp" id="ctNew" placeholder="新建一个收纳名"><button class="btn solid" data-act="ctadd">新建</button></div>';
  h += S.cats.length? '<div class="pick-list">'+S.cats.map(c=>'<div class="pick-i">'
      + '<div class="pb"><div class="pn">'+esc(c.name)+'<span class="pk">'+esc(c.en)+'</span></div>'
      + '<div class="pp">'+catCount(c.id)+' 条 · '+new Date(c.ts).toLocaleDateString()+'</div></div>'
      + '<button class="btn sm" data-act="ctuse" data-id="'+c.id+'">查看</button>'
      + '<button class="pg" data-act="ctdel" data-id="'+c.id+'">'+I.trash+'</button></div>').join('')+'</div>'
    : '<div class="empty"><div class="empty-mk">'+I.layers+'</div><b>还没有收纳</b><span>collections</span></div>';
  b.innerHTML=h;
}
function openNpcMan(){
  pushPage({ key:'npc',
    html: pageHead('博主管理','AUTHORS','<button class="ic-btn" data-act="npcgen">'+I.plus+'</button>')
      + '<div class="page-body" id="npBody"></div>',
    after:()=>paintNpcMan() });
}
function paintNpcMan(){
  const b=$('#npBody'); if(!b) return;
  const st=S.settings;
  let h='<div class="fld"><label>发帖作者来源</label><div class="pick-row">'
    + [['mix','角色库 + AI 博主'],['chars','仅角色库'],['npc','仅 AI 博主']].map(x=>
      '<button class="tg'+(st.authorSource===x[0]?' on':'')+'" data-authsrc="'+x[0]+'">'+esc(x[1])+'</button>').join('')
    + '</div></div>';
  h += '<div class="sw-row"><b>作者不够时自动捏人</b><span>'+(st.autoNpc?'开':'关')+'</span><span class="sw'+(st.autoNpc?' on':'')+'" data-act="toggleautonpc"></span></div>';
  h += '<div class="fld-row" style="margin:12px 0 16px"><input class="inp" id="npHint" placeholder="想要什么样的博主？如：住在潮湿南方的夜班工人">'
    + '<button class="btn solid" data-act="npcgen2">'+I.spark+'生成</button></div>';
  h += '<div class="sec-label" style="margin-top:6px"><b>AI 博主 · '+S.npcs.length+'</b><i></i></div>';
  h += S.npcs.length? S.npcs.map(c=>'<div class="npc-card">'+avaHtml(c,'lg')
      + '<div class="nb"><div class="nn">'+esc(c.name)+'<span class="src-tag ai">AI</span>'+(c.lang?'<span class="src-tag">'+esc(langShort(c.lang))+'</span>':'')+'</div>'
      + '<div class="nh">@'+esc(c.handle)+' · '+nfmt(c.followers)+' 粉丝</div>'
      + '<div class="ns">'+esc(c.sign||c.bio||'')+'</div></div>'
      + '<button class="btn sm" data-act="profile" data-id="'+esc(String(c.id))+'">主页</button>'
      + '<button class="pg" data-act="npcdel" data-id="'+esc(String(c.id))+'">'+I.trash+'</button></div>').join('')
    : '<div class="empty"><div class="empty-mk">'+I.user+'</div><b>还没有 AI 博主</b><span>make someone</span></div>';
  h += '<div class="sec-label"><b>角色库 · '+CHARS.length+'</b><i></i></div>';
  h += CHARS.length? CHARS.map(c=>'<div class="npc-card">'+avaHtml(c,'lg')
      + '<div class="nb"><div class="nn">'+esc(c.name)+'</div><div class="nh">'+esc(c.role||'')+'</div></div>'
      + '<button class="btn sm" data-act="profile" data-id="'+esc(String(c.id))+'">主页</button></div>').join('')
    : '<div class="hint">没有检测到角色库数据。</div>';
  b.innerHTML=h;
}

/* ================================================================
   37 · 数据中心
================================================================ */
function openData(){
  S.notifs.forEach(n=>n.read=true); save();
  pushPage({ key:'data',
    html: pageHead(T('dm.data'),'ACTIVITY','<button class="ic-btn" data-act="tideall">'+I.bolt+'</button>')
      + '<div class="page-body" id="dataBody"></div>',
    after:()=>paintData() });
}
function paintData(){
  const b=$('#dataBody'); if(!b) return;
  const mine=postsOf('me');
  const tv = mine.reduce((a,x)=>a+((x.stats||{}).view||0),0);
  const tl = mine.reduce((a,x)=>a+((x.stats||{}).like||0),0);
  const tc = mine.reduce((a,x)=>a+((x.stats||{}).cm||0),0);
  const tr = mine.reduce((a,x)=>a+((x.stats||{}).rp||0),0);
  const hist=(S.stats.history||[]).slice(-24);
  const max=Math.max(1,...hist.map(x=>x.v||0));
  let h='<div class="dv-grid">'
   + '<div class="dv"><div class="dk">'+I.eye+'<span>VIEWS</span></div><b>'+nfmt(tv+S.profile.views)+'</b><div class="dd">自己的夜话累计</div>'
   + '<div class="spark">'+(hist.length?hist.map(x=>'<i style="height:'+clamp(Math.round((x.v||0)/max*100),4,100)+'%"></i>').join(''):waves(14,4,26))+'</div></div>'
   + '<div class="dv"><div class="dk">'+I.heart+'<span>ECHOES</span></div><b>'+nfmt(tl)+'</b><div class="dd">共鸣</div></div>'
   + '<div class="dv"><div class="dk">'+I.cm+'<span>REPLIES</span></div><b>'+nfmt(tc)+'</b><div class="dd">回声</div></div>'
   + '<div class="dv"><div class="dk">'+I.rp+'<span>REPOSTS</span></div><b>'+nfmt(tr)+'</b><div class="dd">转发</div></div>'
   + '<div class="dv"><div class="dk">'+I.user+'<span>FOLLOWERS</span></div><b>'+nfmt(S.profile.followers)+'</b><div class="dd">粉丝</div></div>'
   + '<div class="dv"><div class="dk">'+I.lamp+'<span>LAMPS</span></div><b>'+Object.keys(S.lamps).filter(k=>lampState(k).n).length+'</b><div class="dd">正在亮着的灯</div></div>'
   + '</div>';
  h += '<div class="hint" style="margin-top:12px">数据不会自己跳。在自己的夜话上点一下浏览数，或者用「夜潮」，才会往上走。</div>';
  h += '<div class="sec-label"><b>My posts</b><i></i></div>';
  h += mine.length? '<div class="pick-list">'+mine.map(p=>'<div class="pick-i">'
     + '<div class="pb"><div class="pn">'+esc((p.title||postPlain(p)).slice(0,18))+'<span class="pk">'+esc(TYPES[p.type].en)+'</span></div>'
     + '<div class="pp">'+nfmt(p.stats.view)+' 浏览 · '+nfmt(p.stats.like)+' 共鸣 · '+nfmt(p.stats.cm)+' 回声</div></div>'
     + '<button class="btn sm" data-act="tide" data-id="'+p.id+'">'+I.bolt+'涨</button>'
     + '<button class="pg" data-act="open" data-id="'+p.id+'">'+I.chev+'</button></div>').join('')+'</div>'
    : '<div class="hint">你还没有发过夜话。</div>';
  h += '<div class="sec-label"><b>Notifications</b><i></i></div>';
  h += S.notifs.length? S.notifs.slice(0,40).map(n=>'<div class="nt"><div class="nb"><div class="nn">'+esc(n.name)+'</div>'
     + '<div class="nx">'+esc(n.text)+'</div><div class="nt-t">'+esc(ago(n.ts))+'</div></div></div>').join('')
    : '<div class="hint">暂时没有通知。</div>';
  b.innerHTML=h;
}

/* ================================================================
   38 · 创作
================================================================ */
let CP_TYPE='essay';
function openCompose(){
  CP_TYPE='essay';
  pushPage({ key:'compose',
    html: pageHead(T('compose'),'COMPOSE','<button class="ic-btn" data-act="aidraft">'+I.spark+'</button>')
      + '<div class="page-body" id="cpBody"></div>'
      + '<div class="cm-input"><button class="btn" data-act="cpai">'+I.spark+'<span>AI 代写</span></button>'
      + '<button class="btn solid" style="flex:1" data-act="cppub">'+esc(T('publish'))+'</button></div>',
    after:()=>paintCompose() });
}
function paintCompose(){
  const b=$('#cpBody'); if(!b) return;
  let h='<div class="fld"><label>体裁</label><div class="ty-grid">'
    + TYPE_LIST.filter(k=>!CHAT_TYPES.includes(k)).map(k=>'<button class="ty-c'+(CP_TYPE===k?' on':'')+'" data-cpty="'+k+'">'
      + '<div class="ti">'+TYPE_ICON[k]+'</div><b>'+esc(TYPES[k].cn)+'</b></button>').join('')
    + '</div></div>';
  h += '<div class="fld"><label>标题（可留空）</label><input class="inp" id="cpTitle" placeholder="不写也可以"></div>';
  h += '<div class="fld"><label>正文</label><textarea class="ta tall" id="cpText" placeholder="'+esc(TYPES[CP_TYPE].ai.slice(0,60))+'"></textarea>'
    + '<div class="hint">按你选的体裁写就行，发布时会自动整理成对应的样式；写不出来就点左下角让 AI 代写。</div></div>';
  h += '<div class="fld"><label>标签</label><input class="inp" id="cpTags" placeholder="用空格分隔，最多 3 个"></div>';
  h += '<div class="fld"><label>收进哪个分类</label><div class="pick-row">'
    + '<button class="tg on" data-cpcat="">默认</button>'
    + S.cats.slice(0,8).map(c=>'<button class="tg" data-cpcat="'+c.id+'">'+esc(c.name)+'</button>').join('')+'</div></div>';
  b.innerHTML=h;
}
let CP_CAT='';
function doPublish(){
  const title=($('#cpTitle')||{}).value||'';
  const text=(($('#cpText')||{}).value||'').trim();
  if(!text) return toast('还没有写内容');
  const tags=(($('#cpTags')||{}).value||'').split(/\s+/).filter(Boolean).slice(0,3);
  const cat = CP_CAT || (S.cats[0]&&S.cats[0].id) || ensureCat('我的夜话').id;
  const raw={ title, text, tags, stats:{like:0,cm:0,rp:0,view:rnd(3,20)} };
  const p=normPost(raw,{author:null,type:CP_TYPE,lang:S.settings.contentLang,cat});
  p.authorId='me'; p.ts=Date.now(); p.timeText='刚刚'; p.seen=true;
  S.posts.unshift(p); save();
  popPage(); renderFeed(); renderMe();
  toast('已发布');
}
async function aiDraft(){
  if(!hasApi()) return toast(T('noapi'));
  busy(true,T('working'));
  try{
    const j=await aiJson(APP_SYS(S.settings.contentLang),
`以用户本人的口吻写一条「${TYPES[CP_TYPE].cn}」体裁的夜话。
${TYPES[CP_TYPE].ai}
${meBrief()}
现有草稿（可为空，若有请在其基础上改写）：${(($('#cpText')||{}).value||'')}
JSON：{"title":"可为空","text":"正文；若体裁有专属结构，请把结构内容按自然语言完整写进 text 里"}`,
    {max:900,temp:1.06});
    if($('#cpTitle')&&j.title) $('#cpTitle').value=j.title;
    if($('#cpText')) $('#cpText').value=j.text||'';
  }catch(e){ toast('生成失败：'+e.message); }
  busy(false);
}
/* 让某位博主发一条 */
async function genForAuthor(id){
  const c=anyById(id); if(!c) return;
  if(!hasApi()) return toast(T('noapi'));
  const type=pick1(SEL_TYPES.length?SEL_TYPES:TYPE_LIST);
  const lang=c.lang||S.settings.contentLang;
  const cat=ensureCat(c.name+' 的夜话');
  busy(true,T('working'));
  try{
    const j=await aiJson(APP_SYS(lang),
`让「${c.name}」发一条体裁为 ${type}（${TYPES[type].cn}）的夜话。
${TYPES[type].ai}
${charBrief(c,true)}
${meBrief()}
只输出一个 JSON 对象，结构与体裁字段规则同前：只填这个体裁对应的字段，其余体裁字段一律 null。
{"type":"${type}","title":"","text":"","moment":null,"diary":null,"list":null,"verse":null,"ask":null,"quote":null,"letter":null,"playlist":null,"review":null,"poll":null,"dream":null,"thread":null,"snippet":null,"voice":null,"chat":null,"tags":[],"timeText":"刚刚","stats":{"like":0,"cm":0,"rp":0,"view":0}}`,
    {max:1600,temp:1.06});
    const p=normPost(j,{author:c,type,lang,cat:cat.id});
    S.posts.unshift(p); save(); renderFeed();
    if(topPage()&&topPage().key==='profile') paintProfile(id);
    toast(c.name+' 发了一条');
  }catch(e){ toast('生成失败：'+e.message); }
  busy(false);
}

/* ================================================================
   39 · 资料编辑 / 设置
================================================================ */
function openEditMe(){
  const p=S.profile;
  sheet(T('edit'),'PROFILE',
    '<div class="fld"><label>头像 / 封面</label><div class="up-row">'
    + '<button class="up-prev" id="upAva" style="'+(p.avatar?'background-image:url('+esc(p.avatar)+')':'')+'">'+(p.avatar?'':I.cam)+'</button>'
    + '<button class="up-prev wide" id="upCover" style="'+(p.cover?'background-image:url('+esc(p.cover)+')':'')+'">'+(p.cover?'':I.img)+'</button></div></div>'
    + '<div class="fld"><label>名字 / 用户名</label><div class="fld-row">'
    + '<input class="inp" id="edName" value="'+esc(p.name)+'" placeholder="显示名">'
    + '<input class="inp" id="edHandle" value="'+esc(p.handle)+'" placeholder="handle"></div></div>'
    + '<div class="fld"><label>签名</label><input class="inp" id="edSign" value="'+esc(p.sign)+'" placeholder="一句话"></div>'
    + '<div class="fld"><label>自述</label><textarea class="ta" id="edBio" placeholder="你想让别人知道的">'+esc(p.bio)+'</textarea></div>'
    + '<div class="fld"><label>更多</label><div class="fld-row">'
    + '<input class="inp" id="edGender" value="'+esc(p.gender)+'" placeholder="性别">'
    + '<input class="inp" id="edBirth" value="'+esc(p.birthday)+'" placeholder="生日"></div>'
    + '<div style="height:8px"></div><div class="fld-row">'
    + '<input class="inp" id="edLoc" value="'+esc(p.location)+'" placeholder="所在地">'
    + '<input class="inp" id="edLink" value="'+esc(p.link)+'" placeholder="链接"></div></div>',
    '<button class="btn" data-act="aime">'+I.spark+'<span>AI 代写</span></button>'
   +'<button class="btn solid" style="flex:1" data-act="saveme">'+esc(T('save'))+'</button>',
    w=>{
      $('#upAva',w).onclick=()=>pickImage(d=>{ S.profile.avatar=d; save(); const e=$('#upAva',w); e.style.backgroundImage='url('+d+')'; e.innerHTML=''; renderMe(); });
      $('#upCover',w).onclick=()=>pickImage(d=>{ S.profile.cover=d; save(); const e=$('#upCover',w); e.style.backgroundImage='url('+d+')'; e.innerHTML=''; renderMe(); });
    });
}
function saveMe(){
  const g=id=>{ const e=$('#'+id); return e?e.value.trim():''; };
  Object.assign(S.profile,{ name:g('edName'), handle:g('edHandle'), sign:g('edSign'), bio:g('edBio'),
    gender:g('edGender'), birthday:g('edBirth'), location:g('edLoc'), link:g('edLink') });
  save(); closeSheet(); renderMe(); renderFeed();
  if(topPage()&&topPage().key==='meprofile') paintMeProfile();
  toast('已保存');
}
async function aiMe(){
  if(!hasApi()) return toast(T('noapi'));
  busy(true,T('working'));
  try{
    const j=await aiJson(APP_SYS(S.settings.contentLang),
`为夜话馆的用户生成一套主页资料，气质克制、有具体感，不要抒情套话。
已有信息：${meBrief()}
JSON：{"name":"","handle":"英文小写下划线","sign":"一句签名，12-22字","bio":"自述，40-70字"}`,{max:420,temp:1.08});
    if($('#edName')&&!$('#edName').value) $('#edName').value=j.name||'';
    if($('#edHandle')) $('#edHandle').value=j.handle||$('#edHandle').value;
    if($('#edSign'))   $('#edSign').value=j.sign||'';
    if($('#edBio'))    $('#edBio').value=j.bio||'';
  }catch(e){ toast('生成失败：'+e.message); }
  busy(false);
}
function openSetting(){
  const api=apiCfg();
  pushPage({ key:'set',
    html: pageHead(T('set'),'SETTINGS','')
      + '<div class="page-body">'
      + '<div class="fld"><label>接口</label>'
      + '<input class="inp" id="apiBase" placeholder="https://…/v1" value="'+esc(api.baseUrl)+'">'
      + '<div style="height:8px"></div><input class="inp" id="apiKey" type="password" placeholder="sk-…" value="'+esc(api.apiKey)+'">'
      + '<div style="height:8px"></div><input class="inp" id="apiModel" placeholder="模型名" value="'+esc(api.model)+'">'
      + '<div class="hint">与 Luna OS 设置共用同一份配置。</div></div>'
      + '<div class="fld"><label>我的页封面</label><div class="up-row">'
      + '<button class="up-prev wide" id="upMeWall" style="'+(S.settings.meWall?'background-image:url('+esc(S.settings.meWall)+')':'')+'">'+(S.settings.meWall?'':I.img)+'</button>'
      + '<button class="btn sm" data-act="clearmewall">'+esc(T('del'))+'</button></div></div>'
      + '<div class="sec-label"><b>Danger</b><i></i></div>'
      + '<button class="btn wide danger" data-act="wipeposts">清空所有夜话</button>'
      + '<div style="height:9px"></div><button class="btn wide danger" data-act="wipeall">恢复出厂</button>'
      + '<div style="height:14px"></div><button class="btn wide solid" data-act="savesetting">'+esc(T('save'))+'</button>'
      + '</div>',
    after:el=>{
      const u=$('#upMeWall',el);
      if(u) u.onclick=()=>pickImage(d=>{ S.settings.meWall=d; save(); u.style.backgroundImage='url('+d+')'; u.innerHTML=''; renderMe(); });
    }});
}
/* 生成设置（作者源 / 体裁 / 语言 速调） */
function openGenOpt(){
  pushPage({ key:'genopt',
    html: pageHead('生成设置','GENERATION','')+'<div class="page-body" id="goBody"></div>',
    after:()=>paintGenOpt() });
}
function paintGenOpt(){
  const b=$('#goBody'); if(!b) return;
  const st=S.settings;
  let h='<div class="fld"><label>体裁（可多选，只生成选中的）</label><div class="ty-grid">'
    + TYPE_LIST.map(k=>'<button class="ty-c'+(SEL_TYPES.includes(k)?' on':'')+'" data-ty2="'+k+'">'
      + '<div class="ti">'+TYPE_ICON[k]+'</div><b>'+esc(TYPES[k].cn)+'</b></button>').join('')+'</div>'
    + '<div class="hint">没被选中的体裁绝对不会出现。比如你没选「对话留影」，就一条聊天截图都不会生成。</div></div>';
  h += '<div class="fld"><label>作者来源</label><div class="pick-row">'
    + [['mix','角色库 + AI 博主'],['chars','仅角色库'],['npc','仅 AI 博主']].map(x=>
      '<button class="tg'+(st.authorSource===x[0]?' on':'')+'" data-authsrc="'+x[0]+'">'+esc(x[1])+'</button>').join('')+'</div></div>';
  h += '<div class="fld"><label>语言</label><div class="pick-row">'
    + '<button class="tg'+(st.langMode==='fixed'?' on':'')+'" data-langmode="fixed">单一语言</button>'
    + '<button class="tg'+(st.langMode==='mix'?' on':'')+'" data-langmode="mix">多语种混合</button>'
    + '<button class="tg" data-act="langpage">去语言系统</button></div></div>';
  h += '<button class="btn wide" data-act="npcgen3">'+I.spark+'<span>再捏 3 位新博主</span></button>';
  b.innerHTML=h;
}
/* 转发选择页（不用弹窗） */
function openForward(postId){
  ensureThreads();
  const ths=S.threads.slice().sort((a,b)=>(b.ts||0)-(a.ts||0));
  pushPage({ key:'fwd',
    html: pageHead(T('fwd'),'FORWARD','')
      + '<div class="page-body"><div class="pick-list">'
      + (ths.length? ths.map(t=>{ const c=anyById(t.id); if(!c) return '';
          return '<button class="pick-i" data-act="dofwd" data-id="'+esc(String(t.id))+'" data-post="'+esc(postId)+'">'
          + avaHtml(c,'lg')+'<div class="pb"><div class="pn">'+esc(c.name)+lampChip(t.id)+'</div>'
          + '<div class="pp">'+esc(lastPreview(t.id)||c.sign||'—')+'</div></div>'
          + '<span class="pg">'+I.send+'</span></button>'; }).join('')
        : '<div class="empty"><div class="empty-mk">'+I.cm+'</div><b>'+esc(T('nochar'))+'</b><span>no one</span></div>')
      + '</div></div>' });
}
function doForward(tid,postId){
  pushMsg(tid,{side:'me',kind:'card',postId,text:''});
  const p=S.posts.find(x=>x.id===postId);
  if(p){ bumpStats(p,'rp',1); p.reposted=true; S.stats.rp++; }
  save(); renderDM(); renderFeed();
  toast('已转发到私语');
  if(CUR_CHAT===String(tid)) paintChat();
}
function openSharePost(){
  const list=S.posts.slice(0,60);
  pushPage({ key:'share',
    html: pageHead('转发夜话','SHARE','')
      + '<div class="page-body"><div class="pick-list">'
      + (list.length? list.map(p=>{ const a=authorOf(p);
          return '<button class="pick-i" data-act="doshare" data-id="'+p.id+'">'+avaHtml(a,'lg')
          + '<div class="pb"><div class="pn">'+esc(a.name)+'<span class="pk">'+esc(TYPES[p.type].en)+'</span></div>'
          + '<div class="pp">'+esc(postPlain(p).replace(/\n/g,' ').slice(0,70))+'</div></div>'
          + '<span class="pg">'+I.send+'</span></button>'; }).join('')
        : '<div class="empty"><div class="empty-mk">'+I.moon+'</div><b>'+esc(T('none'))+'</b><span>nothing</span></div>')
      + '</div></div>' });
}

/* ================================================================
   40 · 留影卡大图 / 相册滑动
================================================================ */
let CC_ZOOM=null;
function openCcZoom(postId,idx){
  const p=S.posts.find(x=>x.id===postId); if(!p||!p.chat) return;
  CC_ZOOM={ postId, shots:splitChatShots(p.chat,p.id), idx:idx||0 };
  const host=$('#ccZoomHost'); host.hidden=false; paintCcZoom(); bindCcZoomSwipe();
}
function closeCcZoom(){ const h=$('#ccZoomHost'); h.hidden=true; h.innerHTML=''; CC_ZOOM=null; }
function ccZoomStep(d){ if(!CC_ZOOM) return; CC_ZOOM.idx=clamp(CC_ZOOM.idx+d,0,CC_ZOOM.shots.length-1); paintCcZoom(); }
function paintCcZoom(){
  if(!CC_ZOOM) return;
  const p=S.posts.find(x=>x.id===CC_ZOOM.postId); if(!p) return closeCcZoom();
  const host=$('#ccZoomHost');
  host.innerHTML='<button class="ccz-x" data-act="cczclose">'+I.x+'</button>'
    + '<div class="ccz-in">'+renderChatShot(p.chat,CC_ZOOM.shots[CC_ZOOM.idx],{foot:'夜话馆 · CAPTURE'})
    + '<div class="ccz-bar">'
    +   '<button class="ic-btn" data-act="cczprev">'+I.back+'</button>'
    +   '<b>'+(CC_ZOOM.idx+1)+' / '+CC_ZOOM.shots.length+'</b>'
    +   '<button class="ic-btn" data-act="cccnext">'+I.chev+'</button>'
    + '</div></div>';
}
function bindCcZoomSwipe(){
  const host=$('#ccZoomHost'); let x0=null;
  host.ontouchstart=e=>{ x0=e.touches[0].clientX; };
  host.ontouchend=e=>{ if(x0==null) return; const dx=e.changedTouches[0].clientX-x0; if(Math.abs(dx)>44) ccZoomStep(dx>0?-1:1); x0=null; };
}
function bindCcGalleryScroll(){
  $$('.cc-gal[data-ccgal]').forEach(g=>{
    const id=g.dataset.ccgal;
    const pg=document.querySelector('.cc-pg[data-ccpg="'+id+'"]'); if(!pg) return;
    g.onscroll=()=>{
      const w=g.firstElementChild?g.firstElementChild.offsetWidth+10:250;
      const i=Math.round(g.scrollLeft/w);
      Array.from(pg.children).forEach((d,j)=>d.classList.toggle('on',j===i));
    };
  });
}

/* ================================================================
   41 · 消息菜单
================================================================ */
let MENU_EL=null;
function closeMenu(){ if(MENU_EL){ MENU_EL.remove(); MENU_EL=null; } }
function openMsgMenu(x,y,mid){
  closeMenu();
  const arr=threadMsgs(CUR_CHAT), m=arr.find(z=>z.id===mid); if(!m) return;
  const el=document.createElement('div');
  el.className='msg-menu';
  el.innerHTML='<button data-mm="quote">'+I.quote+esc(T('quote'))+'</button>'
    + '<button data-mm="trans">'+I.tr+esc(T('trans'))+'</button>'
    + '<button data-mm="copy">'+I.copy+esc(T('copy'))+'</button>'
    + (m.side==='me'&&!m.revoked?'<button data-mm="revoke">'+I.rp+esc(T('revoke'))+'</button>':'')
    + '<button data-mm="del" class="danger">'+I.trash+esc(T('del'))+'</button>';
  document.body.appendChild(el);
  const w=el.offsetWidth,h=el.offsetHeight;
  el.style.left=clamp(x-w/2,10,window.innerWidth-w-10)+'px';
  el.style.top =clamp(y-h-12,10,window.innerHeight-h-10)+'px';
  MENU_EL=el;
  el.addEventListener('click',async e=>{
    const b=e.target.closest('[data-mm]'); if(!b) return;
    const k=b.dataset.mm; closeMenu();
    if(k==='quote'){ CHAT_QUOTE=m.text||''; paintChatQuote(); }
    if(k==='copy'){ try{ await navigator.clipboard.writeText(m.text||''); toast('已复制'); }catch(x){} }
    if(k==='del'){ arr.splice(arr.indexOf(m),1); save(); paintChat(); renderDM(); }
    if(k==='revoke'){ m.revoked=true; save(); paintChat(); renderDM(); }
    if(k==='trans'){
      if(m.trans){ m.trans=null; save(); return paintChat(false); }
      busy(true,T('working'));
      try{ m.trans=await translate(m.text||'',S.settings.transLang); save(); paintChat(false); }
      catch(x){ toast('翻译失败'); }
      busy(false);
    }
  });
}

/* ================================================================
   42 · 屏幕切换
================================================================ */
const SCR_META={ feed:['nav.feed','sub.feed'], dm:['nav.dm','sub.dm'], me:['nav.me','sub.me'] };
function setScreen(name,silent){
  $$('.scr').forEach(s=>s.classList.toggle('is-active',s.dataset.scr===name));
  $$('.nav-i').forEach(b=>b.classList.toggle('is-active',b.dataset.scr===name));
  const m=SCR_META[name]||SCR_META.feed;
  $('#yhTitle').textContent=T(m[0]); $('#yhSub').textContent=T(m[1]);
  const chev=$('#yhBrandChev'); if(chev) chev.style.display = name==='feed'?'':'none';
  if(name!=='feed') $('#yhApp').classList.remove('cat-open');
  const fab=$('#yhFab'); if(fab) fab.style.display = name==='feed'?'':'none';
  if(!silent){
    if(name==='feed') renderFeed();
    if(name==='dm') renderDM();
    if(name==='me') renderMe();
  }
}

/* ================================================================
   43 · 全局事件
================================================================ */
function actOf(e){ return e.target.closest('[data-act]'); }
async function onTap(e){
  /* 分类轨 */
  const cat=e.target.closest('[data-cat]');
  if(cat){ S.curCat=cat.dataset.cat; save(); renderFeed(); return; }
  /* 体裁多选（广场） */
  const ty=e.target.closest('[data-ty]');
  if(ty){ const k=ty.dataset.ty; const i=SEL_TYPES.indexOf(k);
    if(i>=0){ if(SEL_TYPES.length>1) SEL_TYPES.splice(i,1); } else SEL_TYPES.push(k);
    ty.classList.toggle('on',SEL_TYPES.includes(k)); return; }
  const ty2=e.target.closest('[data-ty2]');
  if(ty2){ const k=ty2.dataset.ty2; const i=SEL_TYPES.indexOf(k);
    if(i>=0){ if(SEL_TYPES.length>1) SEL_TYPES.splice(i,1); } else SEL_TYPES.push(k);
    paintGenOpt(); return; }
  const cpty=e.target.closest('[data-cpty]'); if(cpty){ CP_TYPE=cpty.dataset.cpty; paintCompose(); return; }
  const cpcat=e.target.closest('[data-cpcat]'); if(cpcat){ CP_CAT=cpcat.dataset.cpcat; $$('[data-cpcat]').forEach(x=>x.classList.toggle('on',x===cpcat)); return; }
  /* 外观 */
  const sk=e.target.closest('[data-skin]'); if(sk){ S.settings.skin=sk.dataset.skin; S.settings.tokens={}; applySkin(); save(); paintSkin(); return; }
  const fnt=e.target.closest('[data-font]'); if(fnt){ S.settings.fontSet=fnt.dataset.font; applySkin(); save(); paintSkin(); return; }
  const cth=e.target.closest('[data-ccth]'); if(cth){ S.settings.ccTheme=cth.dataset.ccth; save(); paintSkin(); renderFeed(); return; }
  /* 文风 */
  const tn=e.target.closest('[data-tone]');
  if(tn){ const k=tn.dataset.tone; S.settings.tone=S.settings.tone||[];
    const i=S.settings.tone.indexOf(k); if(i>=0) S.settings.tone.splice(i,1); else S.settings.tone.push(k);
    tn.classList.toggle('on',S.settings.tone.includes(k)); save(); return; }
  /* 语言 */
  const sl=e.target.closest('[data-setlang]');
  if(sl){ S.settings[sl.dataset.setlang]=sl.dataset.v; save();
    if(sl.dataset.setlang==='uiLang') applyLang();
    paintLangPage(); renderFeed(); return; }
  const pl=e.target.closest('[data-poollang]');
  if(pl){ const c=pl.dataset.poollang; S.settings.langPool=S.settings.langPool||[];
    const i=S.settings.langPool.indexOf(c);
    if(i>=0){ if(S.settings.langPool.length>1) S.settings.langPool.splice(i,1); } else S.settings.langPool.push(c);
    save(); paintLangPage(); return; }
  const lm=e.target.closest('[data-langmode]');
  if(lm){ S.settings.langMode=lm.dataset.langmode; save();
    if(topPage()&&topPage().key==='langp') paintLangPage();
    if(topPage()&&topPage().key==='genopt') paintGenOpt();
    renderFeed(); return; }
  const as=e.target.closest('[data-authsrc]');
  if(as){ S.settings.authorSource=as.dataset.authsrc; save();
    if(topPage()&&topPage().key==='npc') paintNpcMan();
    if(topPage()&&topPage().key==='genopt') paintGenOpt();
    renderFeed(); return; }
  /* 标签页 */
  const pt=e.target.closest('[data-pftab]'); if(pt){ paintProfile(pt.dataset.id,pt.dataset.pftab); return; }
  const mt=e.target.closest('[data-metab]'); if(mt){ paintMeProfile(mt.dataset.metab); return; }
  /* 投票 */
  const po=e.target.closest('[data-poll]');
  if(po){
    const p=S.posts.find(x=>x.id===po.dataset.pid); if(!p||!p.poll) return;
    const i=Number(po.dataset.poll);
    if(p.poll.voted==null){ p.poll.voted=i; p.poll.total=(p.poll.total||0)+1;
      p.poll.options.forEach((o,j)=>{ o.pct=clamp(o.pct+(j===i?2:-1),1,97); });
      save(); renderFeed(); if(CUR_DETAIL===p.id) paintDetail(p); }
    return;
  }
  /* 留影卡放大 */
  const cw=e.target.closest('.cc-wrap');
  if(cw && !e.target.closest('.ccz-in')){
    const art=cw.closest('[data-post]');
    if(art){ openCcZoom(art.dataset.post,Number(cw.dataset.ccidx)||0); return; }
  }

  const b=actOf(e); if(!b) return;
  const a=b.dataset.act, id=b.dataset.id;
  const P=()=>S.posts.find(x=>x.id===id);

  switch(a){
  case 'noop': return;
  case 'back': popPage(); return;
  case 'closesheet': closeSheet(); return;

  /* 广场 */
  case 'gen': { const v=(($('#topicInput')||{}).value||'').trim(); TOPIC_DRAFT=v; genPosts(v); return; }
  case 'genopt': openGenOpt(); return;
  case 'newtopic': genTopic(); return;
  case 'open': openDetail(id); return;
  case 'opencard': openDetail(id); return;
  case 'like': { const p=P(); if(!p) return; p.liked=!p.liked; bumpStats(p,'like',p.liked?1:-1); S.stats.like+=p.liked?1:-1; save(); renderFeed(); if(CUR_DETAIL===id) paintDetail(p); return; }
  case 'rp': { const p=P(); if(!p) return; p.reposted=!p.reposted; bumpStats(p,'rp',p.reposted?1:-1); save(); renderFeed(); if(CUR_DETAIL===id) paintDetail(p); return; }
  case 'col': { const p=P(); if(!p) return; p.collected=!p.collected; save(); toast(p.collected?'已收藏':'已取消'); renderFeed(); if(CUR_DETAIL===id) paintDetail(p); return; }
  case 'tide': { const p=P(); if(!p) return; tidePost(p); toast('数据涨了'); renderFeed(); if(CUR_DETAIL===id) paintDetail(p); if(topPage()&&topPage().key==='data') paintData(); return; }
  case 'tideall': tideAll(); if(topPage()&&topPage().key==='data') paintData(); return;
  case 'pmenu': { const p=P(); if(!p) return;
      if(confirm('删除这条夜话？')){ S.posts=S.posts.filter(x=>x.id!==id); save(); renderFeed(); }
      return; }
  case 'follow': { toggleFollow(id); renderFeed();
      if(topPage()&&topPage().key==='profile') paintProfile(id);
      if(CUR_DETAIL) paintDetail(S.posts.find(x=>x.id===CUR_DETAIL)); return; }
  case 'profile': openProfile(id); return;
  case 'genfor': genForAuthor(id); return;
  case 'mancat': openCatMan(); return;
  case 'ctadd': { const v=(($('#ctNew')||{}).value||'').trim(); if(!v) return; ensureCat(v); save(); paintCatMan(); renderCats(); return; }
  case 'ctuse': { S.curCat=id; save(); popPage(); setScreen('feed'); return; }
  case 'ctdel': { S.cats=S.cats.filter(c=>c.id!==id); if(S.curCat===id) S.curCat='all'; save(); paintCatMan(); renderFeed(); return; }

  /* 详情 / 评论 */
  case 'trans': { const p=S.posts.find(x=>x.id===id); if(p) transPost(p); return; }
  case 'gencm': { const p=S.posts.find(x=>x.id===id); if(p) genComments(p); return; }
  case 'cmlike': {
      const p=S.posts.find(x=>x.id===CUR_DETAIL) || (SUB_CM&&S.posts.find(x=>x.id===SUB_CM.postId));
      if(!p) return; const f=findCm(p,id); if(!f) return;
      f.cm.liked=!f.cm.liked; f.cm.likes=Math.max(0,(f.cm.likes||0)+(f.cm.liked?1:-1)); save();
      if(SUB_CM) paintSubPage(); else paintDetail(p); return; }
  case 'cmreply': { const p=S.posts.find(x=>x.id===CUR_DETAIL); if(!p) return;
      const f=findCm(p,id); if(!f) return; REPLY_TO={id:f.cm.id,name:f.cm.name,text:f.cm.text};
      paintReplyQuote(); const ta=$('#cmIn'); if(ta) ta.focus(); return; }
  case 'cancelreply': REPLY_TO=null; paintReplyQuote(); return;
  case 'cmopen': openSubCm(CUR_DETAIL,id); return;
  case 'cmgen': { const p=S.posts.find(x=>x.id===CUR_DETAIL); if(!p) return;
      const f=findCm(p,id); if(f) genReplies(p,f.parent||f.cm,''); return; }
  case 'cmsend': {
      const p=S.posts.find(x=>x.id===CUR_DETAIL); if(!p) return;
      const ta=$('#cmIn'); const v=(ta.value||'').trim(); if(!v) return;
      ta.value=''; ta.style.height='auto';
      const me={ id:uid(), uid:'me', name:S.profile.name||'我', avatar:S.profile.avatar,
                 text:v, timeText:'刚刚', ts:Date.now(), likes:0, liked:false, lang:S.settings.contentLang, replies:[] };
      if(REPLY_TO){
        const f=findCm(p,REPLY_TO.id);
        if(f){ const root=f.parent||f.cm; me.toName=f.cm.name; root.replies=(root.replies||[]).concat([me]);
          bumpStats(p,'cm',1); const rt=REPLY_TO; REPLY_TO=null; paintReplyQuote(); save(); paintDetail(p);
          genReplies(p,root,v); return; }
      }
      p.comments=(p.comments||[]).concat([me]); bumpStats(p,'cm',1); save(); paintDetail(p);
      genComments(p,v); return; }

  /* 二级评论页 */
  case 'subreply': {
      if(!SUB_CM) return; const p=S.posts.find(x=>x.id===SUB_CM.postId); if(!p) return;
      const f=findCm(p,id); if(!f) return;
      SUB_CM.replyTo={id:f.cm.id,name:f.cm.name,text:f.cm.text}; paintSubPage();
      const ta=$('#subIn'); if(ta) ta.focus(); return; }
  case 'subcancel': if(SUB_CM){ SUB_CM.replyTo=null; paintSubPage(); } return;
  case 'subgen': {
      if(!SUB_CM) return; const p=S.posts.find(x=>x.id===SUB_CM.postId); if(!p) return;
      const f=findCm(p,SUB_CM.cmId); if(f) genReplies(p,f.cm,''); return; }
  case 'subsend': {
      if(!SUB_CM) return; const p=S.posts.find(x=>x.id===SUB_CM.postId); if(!p) return;
      const f=findCm(p,SUB_CM.cmId); if(!f) return;
      const ta=$('#subIn'); const v=(ta.value||'').trim(); if(!v) return;
      ta.value=''; ta.style.height='auto';
      const me={ id:uid(), uid:'me', name:S.profile.name||'我', avatar:S.profile.avatar,
                 text:v, timeText:'刚刚', ts:Date.now(), likes:0, liked:false,
                 toName:(SUB_CM.replyTo&&SUB_CM.replyTo.name)||f.cm.name };
      f.cm.replies=(f.cm.replies||[]).concat([me]);
      bumpStats(p,'cm',1); SUB_CM.replyTo=null; save(); paintSubPage();
      genReplies(p,f.cm,v); return; }

  /* 私语 */
  case 'chat': openChat(id); return;
  case 'data': openData(); return;
  case 'lamprule': openLampRules(CUR_CHAT); return;
  case 'npcdm': genNpcDm(); return;
  case 'chatsend': chatSend(); return;
  case 'askreply': if(CUR_CHAT) aiReply(CUR_CHAT,'请你现在回应上面的对话。'); return;
  case 'poke': if(CUR_CHAT){ pushMsg(CUR_CHAT,{side:'me',kind:'sys',text:'你戳了戳 '+(anyById(CUR_CHAT)||{}).name}); paintChat(); aiReply(CUR_CHAT,'用户戳了你一下，做出反应。'); } return;
  case 'sharepost': openSharePost(); return;
  case 'doshare': if(CUR_CHAT){ popPage(); doForward(CUR_CHAT,id); if(CUR_CHAT) paintChat(); } return;
  case 'fwd': openForward(id); return;
  case 'dofwd': popPage(); doForward(id,b.dataset.post); return;
  case 'unquote': CHAT_QUOTE=null; paintChatQuote(); return;
  case 'vplay': {
      const m=threadMsgs(CUR_CHAT).find(x=>x.id===b.dataset.mid); if(!m) return;
      m.vopen=!m.vopen; save(); paintChat(false);
      const el=document.querySelector('[data-mid="'+b.dataset.mid+'"] .vmsg');
      if(el&&m.vopen){ el.classList.add('play'); setTimeout(()=>el.classList.remove('play'),(m.dur||6)*120); }
      return; }
  case 'trmsg': {
      if(!CUR_CHAT) return;
      const arr=threadMsgs(CUR_CHAT).filter(m=>m.side==='them'&&m.text&&!m.trans).slice(-3);
      if(!arr.length) return toast('没有可翻译的消息');
      busy(true,T('working'));
      try{ for(const m of arr) m.trans=await translate(m.text,S.settings.transLang); save(); paintChat(false); }
      catch(x){ toast('翻译失败'); }
      busy(false); return; }
  case 'chatset': openSkin(); return;

  /* 我的 */
  case 'meprofile': openMeProfile(); return;
  case 'editme': openEditMe(); return;
  case 'saveme': saveMe(); return;
  case 'aime': aiMe(); return;
  case 'folist': openNpcMan(); return;
  case 'npcman': openNpcMan(); return;
  case 'npcgen': { const made=await genNpcs(3); if(made.length){ paintNpcMan(); toast('捏了 '+made.length+' 位新博主'); } return; }
  case 'npcgen2': { const hint=(($('#npHint')||{}).value||'').trim(); const made=await genNpcs(3,hint); if(made.length){ paintNpcMan(); toast('捏了 '+made.length+' 位'); } return; }
  case 'npcgen3': { const made=await genNpcs(3); if(made.length) toast('捏了 '+made.length+' 位新博主'); return; }
  case 'npcdel': { S.npcs=S.npcs.filter(c=>String(c.id)!==String(id)); save(); paintNpcMan(); renderFeed(); return; }
  case 'toggleautonpc': { S.settings.autoNpc=!S.settings.autoNpc; save(); paintNpcMan(); return; }
  case 'metap': {
      const k=b.dataset.k;
      if(k==='followers'){ const d=rnd(1,6); S.profile.followers+=d; floatUp('upFol','+'+d); }
      else { const d=rnd(5,60); S.profile.views+=d; floatUp('upView','+'+d); }
      save();
      const f1=$('#stFol'),f2=$('#stFol2'),v1=$('#stView'),v2=$('#stView2');
      const tv=postsOf('me').reduce((x,y)=>x+((y.stats||{}).view||0),0)+S.profile.views;
      if(f1) f1.textContent=nfmt(S.profile.followers); if(f2) f2.textContent=nfmt(S.profile.followers);
      if(v1) v1.textContent=nfmt(tv); if(v2) v2.textContent=nfmt(tv);
      return; }
  case 'ptap': { const m=charMeta(id); if(b.dataset.k==='followers') m.followers+=rnd(1,9); else m.views+=rnd(20,300); save(); paintProfile(id); return; }

  /* 外观 / 文风 / 语言 / 设置 */
  case 'skin': openSkin(); return;
  case 'tone': openTone(); return;
  case 'langpage': openLangPage(); return;
  case 'setting': openSetting(); return;
  case 'sktoggle': { const sec=b.closest('.sk-sec'); if(sec) sec.classList.toggle('open'); return; }
  case 'skinreset': { S.settings.tokens={}; S.settings.ccCss=''; applySkin(); applyCss(); save(); paintSkin(); toast('已还原'); return; }
  case 'savecss': { S.settings.ccCss=(($('#skCss')||{}).value||''); applyCss(); save(); toast('CSS 已生效'); return; }
  case 'sksave': { const n=(($('#skName')||{}).value||'').trim()||('存档 '+(S.skinPresets.length+1));
      S.skinPresets.unshift({ name:n, skin:S.settings.skin, fontSet:S.settings.fontSet,
        tokens:Object.assign({},currentTokens(),S.settings.tokens), css:S.settings.ccCss });
      save(); paintSkin(); toast('已存档'); return; }
  case 'skload': { const p=S.skinPresets[Number(b.dataset.i)]; if(!p) return;
      S.settings.skin=p.skin||S.settings.skin; S.settings.fontSet=p.fontSet||S.settings.fontSet;
      S.settings.tokens=Object.assign({},p.tokens||{}); S.settings.ccCss=p.css||'';
      applySkin(); applyCss(); save(); paintSkin(); toast('已应用「'+p.name+'」'); return; }
  case 'skdel': { S.skinPresets.splice(Number(b.dataset.i),1); save(); paintSkin(); return; }
  case 'tnapply': { const g=id2=>{ const e=$('#'+id2); return e?e.value:''; };
      S.settings.toneCustom=g('tnCustom'); S.settings.world=g('tnWorld');
      S.settings.taboo=g('tnTaboo'); S.settings.persona=g('tnPersona');
      save(); toast('已保存，之后的生成都会遵守'); return; }
  case 'tnsave': { const n=(($('#tnName')||{}).value||'').trim()||('方案 '+(S.tonePresets.length+1));
      const g=id2=>{ const e=$('#'+id2); return e?e.value:''; };
      S.tonePresets.unshift({ name:n, tone:(S.settings.tone||[]).slice(),
        toneCustom:g('tnCustom'), world:g('tnWorld'), taboo:g('tnTaboo'), persona:g('tnPersona') });
      save(); paintTone(); toast('已存档'); return; }
  case 'tnload': { const p=S.tonePresets[Number(b.dataset.i)]; if(!p) return;
      Object.assign(S.settings,{ tone:(p.tone||[]).slice(), toneCustom:p.toneCustom||'', world:p.world||'', taboo:p.taboo||'', persona:p.persona||'' });
      save(); paintTone(); toast('已应用「'+p.name+'」'); return; }
  case 'tndel': { S.tonePresets.splice(Number(b.dataset.i),1); save(); paintTone(); return; }
  case 'clearwall': S.settings.wall=null; save(); applyWall(); paintSkin(); return;
  case 'clearcwall': S.settings.chatWall=null; save(); paintSkin(); return;
  case 'clearmewall': S.settings.meWall=null; save(); renderMe(); popPage(); openSetting(); return;
  case 'savesetting': {
      const bu=(($('#apiBase')||{}).value||'').trim(), ke=(($('#apiKey')||{}).value||'').trim(), mo=(($('#apiModel')||{}).value||'').trim();
      if(bu||ke){ let cur={}; try{ cur=JSON.parse(localStorage.getItem('luna_api_current')||'{}'); }catch(x){}
        cur.baseUrl=bu; cur.apiKey=ke; localStorage.setItem('luna_api_current',JSON.stringify(cur));
        if(mo) localStorage.setItem('luna_api_model',mo); }
      save(); toast('已保存'); return; }
  case 'wipeposts': if(confirm('清空所有夜话？')){ S.posts=[]; save(); renderFeed(); toast('已清空'); } return;
  case 'wipeall': if(confirm('恢复出厂设置？所有数据都会消失。')){ S=JSON.parse(JSON.stringify(DEF)); save(); location.reload(); } return;

  /* 创作 */
  case 'cppub': doPublish(); return;
  case 'cpai': case 'aidraft': aiDraft(); return;

  /* 留影卡 */
  case 'cczclose': closeCcZoom(); return;
  case 'cczprev': ccZoomStep(-1); return;
  case 'cccnext': ccZoomStep(1); return;
  }
}

/* ================================================================
   44 · 静态绑定 / 时钟 / 启动
================================================================ */
function clock(){
  const d=new Date();
  const timeStr=d.getHours()+':'+String(d.getMinutes()).padStart(2,'0');
  const p=clamp(76-Math.floor((d.getHours()*60+d.getMinutes())/120),12,99);
  const t=$('#statusTime'); if(t) t.textContent=timeStr;
  const bp=$('#batPct'), bi=$('#batInner');
  if(bp) bp.textContent=p;
  if(bi) bi.style.width=p+'%';
  /* 页面栈里每一层自己的状态栏也要一起走时，不然切进详情页时间就停了 */
  $$('.page-head-plate [data-statustime]').forEach(el=>el.textContent=timeStr);
  $$('.page-head-plate [data-batpct]').forEach(el=>el.textContent=p);
  $$('.page-head-plate [data-batinner]').forEach(el=>el.style.width=p+'%');
}
function clockPage(el){
  if(!el) return;
  const d=new Date();
  const timeStr=d.getHours()+':'+String(d.getMinutes()).padStart(2,'0');
  const p=clamp(76-Math.floor((d.getHours()*60+d.getMinutes())/120),12,99);
  const t=el.querySelector('[data-statustime]'); if(t) t.textContent=timeStr;
  const bp=el.querySelector('[data-batpct]'), bi=el.querySelector('[data-batinner]');
  if(bp) bp.textContent=p;
  if(bi) bi.style.width=p+'%';
}
function bindStatic(){
  document.addEventListener('click',e=>{ closeMenu(); onTap(e); });
  $$('.nav-i').forEach(b=>b.onclick=()=>setScreen(b.dataset.scr));
  const fab=$('#yhFab'); if(fab) fab.onclick=openCompose;
  const brand=$('#yhBrand'); if(brand) brand.onclick=()=>{ $('#yhApp').classList.toggle('cat-open'); renderCats(); };
  /* 灯火 / 语言 / 外观 / 设置 已移入「我的」页 Preferences 菜单（见 renderMe），
     顶栏按钮保留隐藏节点仅为兼容旧绑定，不再需要事件 */
  /* 长按消息 */
  let lt=null;
  document.addEventListener('touchstart',e=>{
    const m=e.target.closest('.msg[data-mid]'); if(!m||!CUR_CHAT) return;
    const t=e.touches[0];
    lt=setTimeout(()=>openMsgMenu(t.clientX,t.clientY,m.dataset.mid),480);
  },{passive:true});
  document.addEventListener('touchend',()=>clearTimeout(lt),{passive:true});
  document.addEventListener('touchmove',()=>clearTimeout(lt),{passive:true});
  document.addEventListener('contextmenu',e=>{
    const m=e.target.closest('.msg[data-mid]'); if(!m||!CUR_CHAT) return;
    e.preventDefault(); openMsgMenu(e.clientX,e.clientY,m.dataset.mid);
  });
  /* 回车发送 */
  document.addEventListener('keydown',e=>{
    if(e.key!=='Enter'||e.shiftKey) return;
    if(e.target.id==='chatIn'){ e.preventDefault(); chatSend(); }
    if(e.target.id==='topicInput'){ e.preventDefault(); genPosts((e.target.value||'').trim()); }
  });
}
async function boot(){
  await loadState();
  applySkin(); applyCss(); applyWall(); 
  CHARS = (await loadChars()).map(c=>Object.assign({},c));
  ensureThreads();
  bindStatic();
  applyLang();
  clock(); setInterval(clock,20000);
  setScreen('feed');
  if(!S.seenBoot){
    S.seenBoot=true;
    if(!S.cats.length) ensureCat('自由夜');
    save();
    if(!hasApi()) toast(T('noapi'));
    else toast('先拟一个今夜话题，或直接生成');
  }
}
let _booted=false;
function bootOnce(){ if(_booted) return; _booted=true; boot(); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bootOnce);
else bootOnce();

})();