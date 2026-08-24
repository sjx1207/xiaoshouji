/* ================================================================
   糖罐 TANGGUAN — tg-bifang.js
   笔坊：配对 → 共创 → 文风 → 命名 → 封面 → 建圈 → 存档
================================================================ */

const tgBF = {
  chars: [], users: [], tab: 'char',
  seatA: null, seatB: null,
  aiPick: {},            // AI 共创表单选择
  aiCustom: {},          // AI 共创自定义输入
  aiResults: [], aiRound: 0, aiFeedback: '',
  style: {}, styleCustom: {}, styleName: '',
  cpName: '', nameStyles: [],
  cover: { av: null, bg: null }, circleTags: [], access: '公开',
  source: 'lib'          // lib | ai
};

/* ================================================================
   一、AI 共创表单配置 —— 每一项都带「自定义」，绝不写死
================================================================ */
const TG_AI_FIELDS = [
  { k:'relation', n:'关系动力', en:'dynamic', multi:true,
    d:'两个人之间那根最要命的线。可多选叠加，比如「宿敌 + 双向暗恋」。',
    o:['先婚后爱','双向暗恋','单箭头暗恋','宿敌相杀','青梅竹马','上下级','师徒','搭档','救赎','追妻火葬场','破镜重圆','契约关系','人外与人类','双面身份','命运纠缠','互相利用'] },
  { k:'persona', n:'性格配置', en:'temperament', multi:true,
    d:'两边的性格反差是磕点的地基。可选两侧不同项，也可以只写自定义。',
    o:['清冷×热烈','强势×更强势','温柔×偏执','天真×腹黑','话痨×寡言','病娇×治愈','疯批×清醒','老练×莽撞','高岭之花×死缠烂打','外冷内热×外热内冷','钝感×敏感','厌世×鲜活'] },
  { k:'world', n:'世界观', en:'setting', multi:false,
    d:'故事发生的土壤，会直接影响身份、冲突与场景质地。',
    o:['现代都市','民国旧梦','古风朝堂','仙侠修真','校园','娱乐圈','末世废土','西方奇幻','赛博朋克','悬疑刑侦','医疗职场','music/乐队','武侠江湖','平行宇宙'] },
  { k:'flavor', n:'情感浓度', en:'flavor', multi:true,
    d:'你今天想磕的是糖还是玻璃。可多选，比如「先虐后甜 + HE」。',
    o:['纯糖','微糖','先虐后甜','钝刀子割肉','大虐','HE','BE','开放式','be美学但he','双向奔赴','强制爱','细水长流'] },
  { k:'age', n:'年龄与体量', en:'scale', multi:false,
    d:'两人年龄差与故事体量，会影响叙事密度。',
    o:['同龄','小三岁以内','年上五岁以上','年下追','跨代（十年以上）','短篇一发完','中篇多章','长篇连载'] },
  { k:'hook', n:'磕点偏好', en:'hooks', multi:true,
    d:'那些具体到骨头缝里的小癖好，写得越细越准。',
    o:['克制的肢体接触','雨夜','共用一件衣服','失而复得','名字梗','旧物与信','沉默的守候','嫉妒','醉后失言','受伤照顾','跨越时间的等待','一个从不解释的人'] },
  { k:'avoid', n:'雷点规避', en:'avoid', multi:true, allowEmpty:true,
    d:'明确写出来的会被 AI 严格避开。',
    o:['第三者插足','原生家庭苦情','背叛','生死离别','强制情节','年龄差过大','职场潜规则','疾病绝症'] }
];
const TG_AI_TEXTAREAS = [
  { k:'must',  n:'必须出现的内容', en:'must have', ph:'例：一定要有一场没说出口的告白；要有一个只有对方听得懂的称呼。' },
  { k:'vibe',  n:'氛围与画面感', en:'atmosphere', ph:'例：像冬天没开灯的房间里那一点暖气声；克制、慢、有回音。' },
  { k:'free',  n:'其他任何补充', en:'anything else', ph:'名字倾向、职业设定、想要的结局、参考作品的气质…想到什么写什么。' }
];

function tgRenderAiForm() {
  const box = document.getElementById('tgAiForm');
  box.innerHTML = TG_AI_FIELDS.map((f, i) => `
    <div class="tg-sec ${i < 3 ? 'open' : ''}">
      <div class="tg-sec-head" onclick="tgToggleSec(this)">
        <span class="tg-sec-idx">${String(i + 1).padStart(2, '0')}</span>
        <span class="tg-sec-name">${f.n}</span>
        <span class="tg-sec-val" id="tgAiVal-${f.k}">未设定</span>
        <span class="tg-sec-caret" data-ico="caret"></span>
      </div>
      <div class="tg-sec-body"><div class="tg-sec-inner">
        <p class="tg-hint">${f.d}${f.multi ? ' · 可多选' : ' · 单选'}</p>
        <div class="tg-chips" id="tgAiChips-${f.k}">
          ${f.o.map(o => `<button class="tg-chip" onclick="tgAiTap('${f.k}',this,'${tgEsc(o)}')">${tgEsc(o)}</button>`).join('')}
          <button class="tg-chip add" onclick="tgAiAddCustom('${f.k}','${f.n}')">+ 自定义</button>
        </div>
      </div></div>
    </div>`).join('') + TG_AI_TEXTAREAS.map((t, i) => `
    <div class="tg-sec">
      <div class="tg-sec-head" onclick="tgToggleSec(this)">
        <span class="tg-sec-idx">${String(TG_AI_FIELDS.length + i + 1).padStart(2, '0')}</span>
        <span class="tg-sec-name">${t.n}</span>
        <span class="tg-sec-val">自由书写</span>
        <span class="tg-sec-caret" data-ico="caret"></span>
      </div>
      <div class="tg-sec-body"><div class="tg-sec-inner">
        <textarea class="tg-textarea" id="tgAiTa-${t.k}" placeholder="${t.ph}"></textarea>
      </div></div>
    </div>`).join('');
  tgFillIcons(box);
}

function tgAiTap(k, btn, val) {
  const f = TG_AI_FIELDS.find(x => x.k === k);
  tgBF.aiPick[k] = tgBF.aiPick[k] || [];
  const arr = tgBF.aiPick[k];
  const i = arr.indexOf(val);
  if (f.multi) {
    if (i >= 0) { arr.splice(i, 1); btn.classList.remove('on'); }
    else { arr.push(val); btn.classList.add('on'); }
  } else {
    arr.length = 0; arr.push(val);
    btn.parentNode.querySelectorAll('.tg-chip').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
  }
  const v = document.getElementById('tgAiVal-' + k);
  v.textContent = arr.length ? arr.join('、') : '未设定';
}

function tgAiAddCustom(k, name) {
  tgSheetOpen(`
    <h4>自定义 · ${tgEsc(name)}</h4>
    <p class="tg-sheet-sub">写下你自己的说法，会和预设一起作为条件送进生成。</p>
    <div class="tg-field"><input class="tg-input" id="tgCustomInput" placeholder="想到什么就写什么"></div>
    <div style="height:14px"></div>
    <button class="tg-btn tg-btn-dark" onclick="tgAiCustomSave('${k}')">加入条件</button>`);
  setTimeout(() => document.getElementById('tgCustomInput').focus(), 300);
}
function tgAiCustomSave(k) {
  const v = document.getElementById('tgCustomInput').value.trim();
  if (!v) return;
  const box = document.getElementById('tgAiChips-' + k);
  const add = box.querySelector('.tg-chip.add');
  const b = document.createElement('button');
  b.className = 'tg-chip on';
  b.textContent = v;
  b.onclick = () => tgAiTap(k, b, v);
  box.insertBefore(b, add);
  tgBF.aiPick[k] = tgBF.aiPick[k] || [];
  tgBF.aiPick[k].push(v);
  document.getElementById('tgAiVal-' + k).textContent = tgBF.aiPick[k].join('、');
  tgCloseSheet();
  tgToast('已加入自定义条件');
}

/* ================================================================
   二、AI 生成
================================================================ */
function tgAiCollect() {
  TG_AI_TEXTAREAS.forEach(t => {
    const el = document.getElementById('tgAiTa-' + t.k);
    if (el) tgBF.aiCustom[t.k] = el.value.trim();
  });
  const lines = [];
  TG_AI_FIELDS.forEach(f => {
    const v = tgBF.aiPick[f.k];
    if (v && v.length) lines.push(`${f.n}：${v.join('、')}`);
  });
  TG_AI_TEXTAREAS.forEach(t => {
    if (tgBF.aiCustom[t.k]) lines.push(`${t.n}：${tgBF.aiCustom[t.k]}`);
  });
  return lines.join('\n') || '（用户未设限，请自由发挥，但要足够有记忆点）';
}

const TG_AI_SYS = `你是一个专门为同人 CP 圈生成原创设定的策划。你的输出必须是纯 JSON 数组，不要任何解释、不要 markdown 代码块。
数组恰好包含 3 个对象，每个对象字段如下：
{
 "hook": "一句'什么什么X什么什么'格式的钩子，X 两侧各是一个凝练的四到八字短语，例如'替身演员X过气影帝'或'守灯人X沉船的鬼'",
 "cpname": "一个暂拟的 CP 名，2-4 字",
 "a": {"name":"角色A姓名","identity":"身份/职业","age":"年龄","traits":"3-5个性格关键词、顿号分隔","look":"外形关键词一句话"},
 "b": {"name":"角色B姓名","identity":"","age":"","traits":"","look":""},
 "relation": "两人的关系设定，2-3句",
 "meet": "初遇场景，具体到时间地点动作，3句以内",
 "scenes": ["名场面1","名场面2","名场面3"],
 "conflict": "核心冲突，2句",
 "ending": "结局倾向及理由，1-2句",
 "keywords": ["氛围关键词","共5个"],
 "bgm": "一个音乐意象的描述，不要写真实歌名",
 "lineA": "角色A的一句代表台词",
 "lineB": "角色B的一句代表台词"
}
要求：三对之间气质差异必须明显，不要同质化。中文输出。名字要有质感，不要用烂俗网文名。`;

async function tgAiGenerate(isRetry) {
  const cond = tgAiCollect();
  tgBF.aiRound++;
  tgGo('scr-airesult');
  document.getElementById('tgAiRound').textContent = 'ROUND ' + tgBF.aiRound;
  const out = document.getElementById('tgAiOut');
  out.innerHTML = `<div class="tg-loading"><div class="tg-orbit"><i></i><i></i><i></i></div><p>正在为你熬糖</p></div>`;

  let user = `【用户设定的条件】\n${cond}`;
  if (isRetry && tgBF.aiFeedback) {
    user = `【最高优先级 · 用户对上一轮的不满意之处，必须优先修正】\n${tgBF.aiFeedback}\n\n` +
           `【次级 · 用户原本的条件，在不与上面冲突的前提下遵守】\n${cond}\n\n` +
           `请重新生成三对全新的 CP，不要重复上一轮的人物与设定。`;
  }

  let data = null;
  try {
    const txt = await tgAI(TG_AI_SYS, user, 3600);
    data = tgParseJSON(txt);
  } catch (e) { data = null; }

  if (!Array.isArray(data) || !data.length) {
    data = tgLocalGen(cond, isRetry ? tgBF.aiFeedback : '');
    if (!localStorage.getItem('luna_api_current')) tgToast('未检测到 API，已用本地灵感库生成');
    else tgToast('接口未返回，已用本地灵感库生成');
  }
  tgBF.aiResults = data.slice(0, 3);
  tgPut('aihist', { round: tgBF.aiRound, cond, feedback: tgBF.aiFeedback, results: tgBF.aiResults });
  tgRenderAiResult();
  tgRefreshStats();
}

/* 本地灵感库兜底：按条件重组，保证没有 API 也能完整跑通 */
function tgLocalGen(cond, fb) {
  const seeds = [
    { hook:['守夜的钟表匠','被停摆的旧神'], cp:'停摆', A:{name:'沈砚',identity:'钟表修复师',age:'31',traits:'寡言、执拗、洁癖、有旧伤',look:'指节冷白，常年穿灰'},
      B:{name:'祁樾',identity:'失去神力的旧神',age:'外表约26',traits:'倨傲、天真、破碎、贪恋温度',look:'眼尾一点朱砂色的痣'},
      rel:'沈砚捡到了一具"停摆"的神。他修一切会走的东西，却修不好一个已经决定不再走下去的人。祁樾赖在他店里，用神明的耐心磨一个凡人的沉默。',
      meet:'暴雨夜，卷帘门被撞开。一个浑身湿透的人倒在他的工作台前，手里攥着一枚已经停了三百年的怀表。',
      sc:['祁樾第一次学会说"我回来了"，沈砚在里屋停下手上的活，很久没出声','停电那晚，两个人靠着数彼此的心跳判断时间','沈砚把自己的名字刻在了齿轮内侧，谁也看不见'],
      cf:'一个人修的是时间，一个人恰恰是被时间放弃的东西。留下他，就要交出自己剩下的所有年月。',
      end:'开放式偏 HE。最后一格镜头是店里两只表，走得一样慢。',
      kw:['潮湿','齿轮','沉默','神性','旧物'], bgm:'雨声里一段不断重复、始终没有解决的钢琴动机',
      la:'"你别急，坏掉的东西我都会修。"', lb:'"那我呢。"' },
    { hook:['纪录片导演','拒绝被拍的人'], cp:'反光', A:{name:'温殊',identity:'独立纪录片导演',age:'29',traits:'锋利、共情过剩、职业性冷静、不肯认输',look:'总背着一台旧机器'},
      B:{name:'陆见山',identity:'退役潜水员/灯塔看守',age:'34',traits:'钝感、笨拙的温柔、拒绝解释、深海一样的沉',look:'手背有一道很长的旧疤'},
      rel:'温殊要拍一部关于"消失"的片子，陆见山是唯一一个不肯对镜头说话的采访对象。她拍了他四十七天，只录到海浪。',
      meet:'第一天上岛，她的收音麦被风吹倒，他伸手接住，没说话，转身走了。',
      sc:['她假装关机，他才开始讲那年的事','他第一次主动看镜头，是在她要走的那天','成片首映，最后三分钟是空镜和海，没有他'],
      cf:'她的职业是让一切被看见，而他的余生都在练习不被看见。',
      end:'BE 美学但 HE。片子拿了奖，她没去领，她在岛上。',
      kw:['海雾','长镜头','缄默','咸味','退潮'], bgm:'风灌进麦克风的底噪，中间夹一声极轻的呼吸',
      la:'"你不说话，我就一直拍。"', lb:'"那你别走。"' },
    { hook:['谎话连篇的骗子','唯一信他的人'], cp:'空口', A:{name:'贺临',identity:'职业骗子/古董掮客',age:'30',traits:'油滑、聪明、习惯性说谎、其实很怕被信任',look:'笑起来像真的'},
      B:{name:'白洲',identity:'刑侦画像师',age:'32',traits:'过分认真、迟钝、记忆力好得可怕、一根筋',look:'眼镜后面永远是平静的'},
      rel:'白洲画过贺临七张脸，每一张都不一样。他一直知道贺临在骗他，也一直没戳穿。',
      meet:'审讯室，他隔着桌子给他画像。贺临故意做了三次表情，他画了三次，全部撕掉，说："你别演了，我画的是你眼睛。"',
      sc:['贺临说了一句真话，白洲愣住，问他"这次是真的吗"','白洲的画本最后一页，是一张没有任何伪装的脸','贺临逃走那晚，把画本留下了'],
      cf:'一个靠说谎活着的人，遇到了一个只相信眼睛的人。他必须选：继续骗，或者第一次让人看清。',
      end:'先虐后甜。三年后，画本被寄回来，多了一句备注。',
      kw:['铅笔灰','审讯灯','谎','素描','对视'], bgm:'笔尖摩擦纸面的沙沙声，忽然停住',
      la:'"你信我这句吗？"', lb:'"我信你眼睛。"' }
  ];
  const tail = cond.split('\n').slice(0, 3).join('；');
  return seeds.map(s => ({
    hook: `${s.hook[0]}X${s.hook[1]}`, cpname: s.cp,
    a: { name:s.A.name, identity:s.A.identity, age:s.A.age, traits:s.A.traits, look:s.A.look },
    b: { name:s.B.name, identity:s.B.identity, age:s.B.age, traits:s.B.traits, look:s.B.look },
    relation: s.rel, meet: s.meet, scenes: s.sc, conflict: s.cf, ending: s.end,
    keywords: s.kw, bgm: s.bgm, lineA: s.la, lineB: s.lb,
    _note: (fb ? `已按你的意见调整：${fb}。` : '') + (tail ? `贴合条件：${tail}` : '')
  }));
}

function tgRenderAiResult() {
  const out = document.getElementById('tgAiOut');
  out.innerHTML = tgBF.aiResults.map((r, i) => {
    const h = String(r.hook || '').split(/[Xx×]/);
    const hook = h.length >= 2 ? `${tgEsc(h[0].trim())}<em>×</em>${tgEsc(h.slice(1).join('×').trim())}` : tgEsc(r.hook);
    return `
    <div class="tg-ai-card tg-rise tg-d${i + 1}">
      <div class="tg-ai-top">
        <div class="tg-ai-idx">${String(i + 1).padStart(2, '0')}</div>
        <div class="tg-head-eyebrow">暂拟名 · ${tgEsc(r.cpname || '待定')}</div>
        <div class="tg-ai-hook" style="margin-top:8px">${hook}</div>
        ${r._note ? `<p class="tg-ai-sub">${tgEsc(r._note)}</p>` : ''}
      </div>
      <div class="tg-ai-roles">
        ${['a', 'b'].map(k => {
          const p = r[k] || {};
          return `<div class="tg-ai-role">
            <b>${tgEsc(p.name)}</b>
            <i>${tgEsc(p.identity)}${p.age ? ' · ' + tgEsc(p.age) : ''}</i>
            <p>${tgEsc(p.traits)}</p>
            <p style="color:var(--tg-mist)">${tgEsc(p.look)}</p>
          </div>`;
        }).join('')}
      </div>
      <div class="tg-ai-body">
        <div class="tg-ai-row"><h6>relation 关系设定</h6><p>${tgEsc(r.relation)}</p></div>
        <div class="tg-ai-row"><h6>first meet 初遇</h6><div class="tg-ai-scene">${tgEsc(r.meet)}</div></div>
        <div class="tg-ai-row"><h6>key scenes 名场面</h6>
          ${(r.scenes || []).map(s => `<div class="tg-ai-scene">${tgEsc(s)}</div>`).join('')}
        </div>
        <div class="tg-ai-row"><h6>conflict 核心冲突</h6><p>${tgEsc(r.conflict)}</p></div>
        <div class="tg-ai-row"><h6>ending 结局倾向</h6><p>${tgEsc(r.ending)}</p></div>
        <div class="tg-ai-row"><h6>lines 代表台词</h6>
          <div class="tg-ai-quote">${tgEsc(r.lineA)}</div>
          <div class="tg-ai-quote">${tgEsc(r.lineB)}</div>
        </div>
        <div class="tg-ai-row"><h6>bgm 意象</h6><p>${tgEsc(r.bgm)}</p></div>
        <div class="tg-ai-row"><h6>keywords 氛围</h6>
          <div class="tg-ai-kw">${(r.keywords || []).map(k => `<i>${tgEsc(k)}</i>`).join('')}</div>
        </div>
      </div>
      <div class="tg-ai-foot">
        <button class="tg-btn tg-btn-light" style="flex:0 0 38%" onclick="tgAiSaveOnly(${i})">仅存档</button>
        <button class="tg-btn tg-btn-dark" onclick="tgAiAdopt(${i})">就磕这对</button>
      </div>
    </div>`;
  }).join('') + `
    <div class="tg-divider"></div>
    <div class="tg-btn-row">
      <button class="tg-btn tg-btn-light" onclick="tgAiRetry()">都不满意 · 说出问题重生成</button>
    </div>
    <div class="tg-divider"></div>`;
  tgFillIcons(out);
}

function tgAiRetry() {
  tgSheetOpen(`
    <h4>哪里不对</h4>
    <p class="tg-sheet-sub">写得越具体越好。你写的这段会作为<b>最高优先级</b>覆盖之前的所有条件，AI 必须先满足它。</p>
    <div class="tg-field">
      <div class="tg-label">不满意的点 <small>highest priority</small></div>
      <textarea class="tg-textarea" id="tgFbInput" style="min-height:120px"
        placeholder="例：三对都太温吞了，我要更狠的权力落差；不要都市，换成古代；名字太软了；A 的身份太常见。">${tgEsc(tgBF.aiFeedback)}</textarea>
    </div>
    <div style="height:14px"></div>
    <button class="tg-btn tg-btn-dark" onclick="tgAiRetryGo()">带着这条重新生成</button>`);
  setTimeout(() => document.getElementById('tgFbInput').focus(), 300);
}
function tgAiRetryGo() {
  const v = document.getElementById('tgFbInput').value.trim();
  if (!v) { tgToast('先写一句不满意的点'); return; }
  tgBF.aiFeedback = v;
  tgCloseSheet();
  tgBF.aiResults = [];
  tgStack.pop();
  tgAiGenerate(true);
}
function tgAiSaveOnly(i) {
  tgPut('drafts', { type: 'ai', title: tgBF.aiResults[i].hook, data: tgBF.aiResults[i] });
  tgToast('已存入存档室 · 草稿');
  tgRefreshStats();
}
function tgAiAdopt(i) {
  const r = tgBF.aiResults[i];
  tgBF.source = 'ai';
  tgBF.seatA = { uid: 'ai-a', kind: 'ai', name: r.a.name, avatar: null, role: r.a.identity, tags: String(r.a.traits || '').split(/[、,，]/).slice(0, 3) };
  tgBF.seatB = { uid: 'ai-b', kind: 'ai', name: r.b.name, avatar: null, role: r.b.identity, tags: String(r.b.traits || '').split(/[、,，]/).slice(0, 3) };
  tgBF.aiAdopted = r;
  tgBF.cpName = r.cpname || '';
  tgGo('scr-style');
}

/* ================================================================
   三、角色库配对
================================================================ */
async function tgStartFromLibrary() {
  tgBF.source = 'lib';
  tgGo('scr-pick');
  if (!tgBF.chars.length && !tgBF.users.length) {
    const [c, u] = await Promise.all([tgLoadChars(), tgLoadUsers()]);
    tgBF.chars = c; tgBF.users = u;
  }
  tgRenderPick();
}
function tgPickTab(t, btn) {
  tgBF.tab = t;
  btn.parentNode.querySelectorAll('button').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  tgRenderPick();
}
function tgPickList() {
  if (tgBF.tab === 'char') return tgBF.chars;
  if (tgBF.tab === 'user') return tgBF.users;
  return tgBF.chars.concat(tgBF.users);
}
function tgAvHtml(p, cls) {
  if (p.avatar) return `<img src="${p.avatar}" alt="">`;
  return `<span class="${cls || ''}">${tgEsc((p.name || '?')[0])}</span>`;
}
function tgRenderPick() {
  const grid = document.getElementById('tgPickGrid');
  const list = tgPickList();
  if (!list.length) {
    grid.innerHTML = `<div style="grid-column:1/-1"><div class="tg-empty">
      <div class="tg-empty-mark" data-ico="pair"></div>
      <p>这里还没有可用的${tgBF.tab === 'user' ? '身份' : '角色'}。<br>先去角色书 / 身份档案里建立，再回到笔坊配对。</p>
    </div></div>`;
    tgFillIcons(grid); return;
  }
  grid.innerHTML = list.map((p, i) => {
    const seat = tgBF.seatA && tgBF.seatA.uid === p.uid ? 'A' : (tgBF.seatB && tgBF.seatB.uid === p.uid ? 'B' : '');
    return `
    <div class="tg-pcard ${seat ? 'picked' : ''} tg-rise tg-d${(i % 6) + 1}" onclick="tgTapCard('${p.uid}')">
      <div class="tg-pcard-seat">${seat}</div>
      <div class="tg-pcard-kind">${p.kind === 'char' ? 'CHAR' : 'USER'}</div>
      <div class="tg-pcard-av">${tgAvHtml(p, 'tg-pcard-letter')}</div>
      <div class="tg-pcard-name">${tgEsc(p.name)}</div>
      <div class="tg-pcard-meta">${[p.role, p.gender, p.age, p.species].filter(Boolean).join(' · ') || '—'}</div>
      <div class="tg-pcard-tags">${(p.tags || []).map(t => `<i>${tgEsc(t)}</i>`).join('')}</div>
      <div class="tg-lock" data-ico="lock"><span style="margin-left:3px">人设已加密</span></div>
    </div>`;
  }).join('');
  tgFillIcons(grid);
}
function tgFind(uid) {
  return tgBF.chars.concat(tgBF.users).find(p => p.uid === uid);
}
function tgTapCard(uid) {
  const p = tgFind(uid);
  if (!p) return;
  if (tgBF.seatA && tgBF.seatA.uid === uid) tgBF.seatA = null;
  else if (tgBF.seatB && tgBF.seatB.uid === uid) tgBF.seatB = null;
  else if (!tgBF.seatA) tgBF.seatA = p;
  else if (!tgBF.seatB) tgBF.seatB = p;
  else { tgBF.seatB = p; }
  tgRenderPick(); tgRenderSeats();
}
function tgRenderSeats() {
  [['tgSlotA', tgBF.seatA, 'SEAT A'], ['tgSlotB', tgBF.seatB, 'SEAT B']].forEach(([id, p, ph]) => {
    const el = document.getElementById(id);
    el.classList.toggle('filled', !!p);
    el.innerHTML = p
      ? `<div class="tg-pair-av">${tgAvHtml(p)}</div>
         <div class="tg-pair-txt"><b>${tgEsc(p.name)}</b><i>${p.kind === 'char' ? 'CHAR' : 'USER'}</i></div>`
      : `<span class="tg-pair-empty">${ph}</span>`;
  });
  document.getElementById('tgPickNext').disabled = !(tgBF.seatA && tgBF.seatB);
}
function tgSwapSeat() {
  const t = tgBF.seatA; tgBF.seatA = tgBF.seatB; tgBF.seatB = t;
  tgRenderPick(); tgRenderSeats();
}
function tgPickConfirm() {
  if (!(tgBF.seatA && tgBF.seatB)) return;
  tgGo('scr-style');
}

/* ================================================================
   四、文风工坊 —— 11 个维度，全部含释义 + 自定义
================================================================ */
const TG_STYLE_FIELDS = [
  { k:'pov', n:'叙事视角', en:'point of view', multi:false,
    d:'决定读者站在谁的肩膀上看这个故事。',
    o:[['第一人称','"我"来讲。代入最强，心理独白最自然，但对方的心思只能靠猜——最适合暗恋与误会。'],
       ['第三人称限知','跟着某一个人的眼睛走，只知道他知道的。克制又有距离，是同人长文最常用的稳妥选择。'],
       ['第三人称全知','两边心事都摊开给读者看。适合双向奔赴的甜文，读者会被"他们都不知道对方也这么想"急疯。'],
       ['双视角交替','按章或按节在两人之间切换。同一件事看两遍，落差就是磕点。'],
       ['第二人称','"你"。极强的贴脸感与私密感，适合短篇和情绪浓烈的片段。']] },
  { k:'genre', n:'文风流派', en:'prose style', multi:true,
    d:'整体的语言质地。可以混搭，比如"冷冽克制 + 影像化"。',
    o:[['细腻抒情','大量心理与感官描写，句子偏长，情绪缓慢渗透。'],
       ['冷冽克制','不写情绪只写动作，把话说到一半。留白越多越疼。'],
       ['浓烈华丽','意象密集、修辞繁复，像一场铺满丝绒的梦。'],
       ['白描简劲','近乎不加形容词，靠动词和细节撑住画面。干净利落。'],
       ['意识流','跟着念头跳跃，时间线松散，逻辑让位于感受。'],
       ['古典雅致','文白相间，讲究音节与对仗，适合古风与民国。'],
       ['黑色幽默','用轻佻的语气讲残忍的事，笑完之后更疼。'],
       ['影像化镜头感','像剧本一样写镜头：近景、空镜、切换。画面先行。']] },
  { k:'rhythm', n:'句式节奏', en:'rhythm', multi:false,
    d:'句子的长短决定阅读时的呼吸。',
    o:[['短句急促','三五字一断。紧张、冲突、爆发场面首选。'],
       ['长句绵密','一口气推到底，情绪层层叠加，适合独白与回忆。'],
       ['长短交错','日常用长句铺，关键处骤然收短。最耐读的一种。']] },
  { k:'rhetoric', n:'修辞密度', en:'rhetoric', multi:false,
    d:'比喻、通感、反复这类手法出现的频率。',
    o:[['低 · 近乎不用','让事实自己说话，冷静可信。'],
       ['中 · 关键处才用','大部分白描，只在情绪顶点给一个比喻，砸得响。'],
       ['高 · 通篇织就','句句有意象，文本本身就是氛围。慎用，容易腻。']] },
  { k:'focus', n:'描写侧重', en:'focus', multi:true,
    d:'笔墨主要花在哪里。可多选。',
    o:[['心理','大量内心活动与自我拉扯。'],['环境','靠场景与天气承载情绪。'],
       ['动作','用身体的细微反应代替心理描写。'],['对话','推进全靠说话，信息密度高。'],
       ['五感','气味、温度、触感、声音全部写足，沉浸感最强。']] },
  { k:'dialog', n:'对话风格', en:'dialogue', multi:false,
    d:'两个人说话的方式，是人物最直接的名片。',
    o:[['生活化','有废话、有停顿、有"嗯"和"啊"，真实。'],
       ['文学化','每句都经过打磨，像台词，有分量。'],
       ['机锋交错','言在此意在彼，互相试探，句句是刀。'],
       ['极简对白','一次不超过十个字，剩下的靠动作补。']] },
  { k:'emotion', n:'情绪浓度', en:'intensity', multi:false,
    d:'整体的情感烈度，会影响用词的激烈程度。',
    o:[['克制 · 淡','所有情绪压在水面下，靠细节泄露。'],
       ['温和 · 中','有起伏但不失控，日常向甜文的舒适区。'],
       ['浓烈 · 强','爱恨都写满，不遮不掩。'],
       ['极致 · 灼','近乎失控的表达，适合高潮章与be。']] },
  { k:'pace', n:'叙事推进', en:'pacing', multi:false,
    d:'故事往前走的速度。',
    o:[['慢热日常流','大量生活切片，感情在细节里长出来。'],
       ['稳步推进','按事件线走，每章有明确进展。'],
       ['高密度反转','信息量大、节奏快、常有意外。'],
       ['碎片拼接','非线性，靠片段与回忆拼出全貌。']] },
  { k:'length', n:'单章体量', en:'length', multi:false,
    d:'一次生成的默认篇幅。',
    o:[['微篇 300-600 字','一个瞬间、一段对话。'],['短章 800-1500 字','一个完整场景。'],
       ['标准 2000-3000 字','一章正常连载量。'],['长章 4000 字以上','大场面或情绪总爆发。']] },
  { k:'person', n:'称谓与语气习惯', en:'address', multi:true,
    d:'这些小地方最容易出戏，先定好。',
    o:[['角色互称姓名','最中性。'],['使用昵称/小名','亲密感来源。'],
       ['敬称（您/先生/大人）','距离感与身份差。'],['带口癖或固定尾音','强辨识度。'],
       ['方言词汇','地域质感。']] }
];
const TG_STYLE_TEXT = [
  { k:'ban',  n:'禁用词与避写内容', ph:'例：不要出现"心跳漏了一拍""空气仿佛凝固"；不写呕吐与血腥细节；不用网络流行语。' },
  { k:'ref',  n:'参考语感样例', ph:'贴一段你喜欢的行文（自己写的也行），AI 会模仿它的语感、句长与标点习惯，而不是抄内容。' },
  { k:'note', n:'其他文风要求', ph:'例：每章结尾必须留一个悬置的动作；对话不加"他说"；喜欢用破折号。' }
];

function tgRenderStyleForm() {
  const box = document.getElementById('tgStyleForm');
  box.innerHTML = TG_STYLE_FIELDS.map((f, i) => `
    <div class="tg-sec ${i < 2 ? 'open' : ''}">
      <div class="tg-sec-head" onclick="tgToggleSec(this)">
        <span class="tg-sec-idx">${String(i + 1).padStart(2, '0')}</span>
        <span class="tg-sec-name">${f.n}</span>
        <span class="tg-sec-val" id="tgStVal-${f.k}">未设定</span>
        <span class="tg-sec-caret" data-ico="caret"></span>
      </div>
      <div class="tg-sec-body"><div class="tg-sec-inner">
        <p class="tg-hint">${f.d}${f.multi ? ' · 可多选' : ' · 单选'}</p>
        <div id="tgStChips-${f.k}">
          ${f.o.map(([nm, de]) => `
            <div class="tg-rule" style="cursor:pointer" data-v="${tgEsc(nm)}" onclick="tgStTap('${f.k}',this,'${tgEsc(nm)}')">
              <b>${tgEsc(nm)}</b><p>${tgEsc(de)}</p>
            </div>`).join('')}
          <div style="height:10px"></div>
          <button class="tg-chip add" onclick="tgStCustom('${f.k}','${f.n}')">+ 自定义这一项</button>
        </div>
      </div></div>
    </div>`).join('') + TG_STYLE_TEXT.map((t, i) => `
    <div class="tg-sec">
      <div class="tg-sec-head" onclick="tgToggleSec(this)">
        <span class="tg-sec-idx">${String(TG_STYLE_FIELDS.length + i + 1).padStart(2, '0')}</span>
        <span class="tg-sec-name">${t.n}</span>
        <span class="tg-sec-val">自由书写</span>
        <span class="tg-sec-caret" data-ico="caret"></span>
      </div>
      <div class="tg-sec-body"><div class="tg-sec-inner">
        <textarea class="tg-textarea" id="tgStTa-${t.k}" placeholder="${t.ph}"></textarea>
      </div></div>
    </div>`).join('');
  tgFillIcons(box);
  tgPaintStyleSel();
}
function tgStTap(k, el, val) {
  const f = TG_STYLE_FIELDS.find(x => x.k === k);
  tgBF.style[k] = tgBF.style[k] || [];
  const arr = tgBF.style[k];
  const i = arr.indexOf(val);
  if (f.multi) { i >= 0 ? arr.splice(i, 1) : arr.push(val); }
  else { arr.length = 0; arr.push(val); }
  tgPaintStyleSel();
}
function tgPaintStyleSel() {
  TG_STYLE_FIELDS.forEach(f => {
    const arr = tgBF.style[f.k] || [];
    const box = document.getElementById('tgStChips-' + f.k);
    if (box) box.querySelectorAll('[data-v]').forEach(el => {
      const on = arr.includes(el.dataset.v);
      el.style.boxShadow = on
        ? '0 14px 28px -14px rgba(20,20,28,.5), inset 0 0 0 1.8px rgba(26,26,34,.86)'
        : '';
      el.style.transform = on ? 'translateY(-1px)' : '';
    });
    const v = document.getElementById('tgStVal-' + f.k);
    if (v) v.textContent = arr.length ? arr.join('、') : '未设定';
  });
}
function tgStCustom(k, name) {
  tgSheetOpen(`
    <h4>自定义 · ${tgEsc(name)}</h4>
    <p class="tg-sheet-sub">用你自己的话描述，会和预设并列成为可选项并直接选中。</p>
    <div class="tg-field"><input class="tg-input" id="tgCustomInput" placeholder="名称，如：像散文诗一样断行"></div>
    <div class="tg-field"><textarea class="tg-textarea" id="tgCustomDesc" placeholder="说明（可留空）"></textarea></div>
    <div style="height:14px"></div>
    <button class="tg-btn tg-btn-dark" onclick="tgStCustomSave('${k}')">加入并选中</button>`);
}
function tgStCustomSave(k) {
  const v = document.getElementById('tgCustomInput').value.trim();
  const d = document.getElementById('tgCustomDesc').value.trim();
  if (!v) return;
  const f = TG_STYLE_FIELDS.find(x => x.k === k);
  f.o.push([v, d || '自定义项']);
  tgBF.style[k] = tgBF.style[k] || [];
  if (f.multi) tgBF.style[k].push(v); else tgBF.style[k] = [v];
  tgCloseSheet();
  tgRenderStyleForm();
  tgToast('已加入自定义文风项');
}
function tgCollectStyle() {
  TG_STYLE_TEXT.forEach(t => {
    const el = document.getElementById('tgStTa-' + t.k);
    if (el) tgBF.styleCustom[t.k] = el.value.trim();
  });
  return { sel: JSON.parse(JSON.stringify(tgBF.style)), text: { ...tgBF.styleCustom } };
}
async function tgSaveStylePreset() {
  const data = tgCollectStyle();
  tgSheetOpen(`
    <h4>存为文风档</h4>
    <p class="tg-sheet-sub">存档后可在任意圈子里一键调用，也能在存档室里管理。</p>
    <div class="tg-field"><input class="tg-input" id="tgCustomInput" placeholder="给这份文风起个名，如：冷雨慢镜"></div>
    <div style="height:14px"></div>
    <button class="tg-btn tg-btn-dark" onclick="tgSaveStyleGo()">保存</button>`);
  window._tgStyleTmp = data;
}
async function tgSaveStyleGo() {
  const n = document.getElementById('tgCustomInput').value.trim() || ('文风档 ' + tgFmtDate());
  await tgPut('styles', { name: n, data: window._tgStyleTmp });
  tgCloseSheet(); tgToast('文风档已保存');
  tgLoadStylePresets(); tgRefreshStats();
}
async function tgLoadStylePresets() {
  const list = await tgAll('styles');
  const box = document.getElementById('tgStylePresets');
  if (!box) return;
  box.innerHTML = list.length
    ? list.map(s => `<button class="tg-chip" onclick="tgApplyStyle('${s.id}')">${tgEsc(s.name)}</button>`).join('')
    : '<span class="tg-hint" style="margin:0">还没有存档，设定好之后点下方「存为文风档」即可留存。</span>';
  window._tgStyleList = list;
}
function tgApplyStyle(id) {
  const s = (window._tgStyleList || []).find(x => x.id === id);
  if (!s) return;
  tgBF.style = JSON.parse(JSON.stringify(s.data.sel || {}));
  tgBF.styleCustom = { ...(s.data.text || {}) };
  tgRenderStyleForm();
  TG_STYLE_TEXT.forEach(t => {
    const el = document.getElementById('tgStTa-' + t.k);
    if (el) el.value = tgBF.styleCustom[t.k] || '';
  });
  tgToast('已载入「' + s.name + '」');
}
function tgStyleConfirm() {
  tgCollectStyle();
  tgGo('scr-name');
}

/* ================================================================
   五、CP 命名
================================================================ */
const TG_NAME_STYLES = [
  '甜系（软、圆、带糖感）', '古典（文言、意象、二字）', '文艺（清冷、留白）',
  '冷淡（极简、硬、无温度）', '英文/缩写', '谐音梗', '数字与符号', '意象类（自然物）',
  '拆字重组', '错位反差（甜名配虐设）'
];
function tgRenderNamePage() {
  const p = document.getElementById('tgNamePair');
  const a = tgBF.seatA, b = tgBF.seatB;
  p.innerHTML = a && b ? `${tgEsc(a.name)}<em>×</em>${tgEsc(b.name)}` : '尚未选定配对';
  const box = document.getElementById('tgNameStyles');
  box.innerHTML = TG_NAME_STYLES.map(s => `<button class="tg-chip" onclick="tgTapNameStyle(this,'${tgEsc(s)}')">${tgEsc(s)}</button>`).join('')
    + `<button class="tg-chip add" onclick="tgNameStyleCustom()">+ 自定义风格</button>`;
  const inp = document.getElementById('tgCpName');
  if (inp && tgBF.cpName) inp.value = tgBF.cpName;
}
function tgTapNameStyle(btn, s) {
  const i = tgBF.nameStyles.indexOf(s);
  if (i >= 0) { tgBF.nameStyles.splice(i, 1); btn.classList.remove('on'); }
  else { tgBF.nameStyles.push(s); btn.classList.add('on'); }
}
function tgNameStyleCustom() {
  tgSheetOpen(`<h4>自定义命名风格</h4>
    <p class="tg-sheet-sub">描述你想要的调性，AI 会照着生成。</p>
    <div class="tg-field"><input class="tg-input" id="tgCustomInput" placeholder="如：像旧唱片标签一样的名字"></div>
    <div style="height:14px"></div>
    <button class="tg-btn tg-btn-dark" onclick="tgNameStyleSave()">加入</button>`);
}
function tgNameStyleSave() {
  const v = document.getElementById('tgCustomInput').value.trim();
  if (!v) return;
  TG_NAME_STYLES.push(v); tgBF.nameStyles.push(v);
  tgCloseSheet(); tgRenderNamePage();
  document.querySelectorAll('#tgNameStyles .tg-chip').forEach(b => {
    if (tgBF.nameStyles.includes(b.textContent)) b.classList.add('on');
  });
}
async function tgGenNames() {
  const a = tgBF.seatA, b = tgBF.seatB;
  if (!a || !b) { tgToast('先选好配对'); return; }
  const out = document.getElementById('tgNameOut');
  out.innerHTML = '<span class="tg-hint" style="margin:0">正在拟名…</span>';
  const styles = tgBF.nameStyles.length ? tgBF.nameStyles.join('、') : '不限，多给几种调性';
  let names = null;
  try {
    const txt = await tgAI(
      '你为同人CP取名。只输出 JSON 数组，形如 ["名1","名2"]，不要解释。',
      `角色A：${a.name}（${a.role || ''}）\n角色B：${b.name}（${b.role || ''}）\n风格要求：${styles}\n请结合两人的名字或身份，生成 12 个 CP 名，每个 2-5 字，中英不限，风格分散不要雷同。`,
      600);
    names = tgParseJSON(txt);
  } catch (e) { names = null; }
  if (!Array.isArray(names) || !names.length) {
    const x = (a.name || '').slice(-1), y = (b.name || '').slice(0, 1);
    const xa = (a.name || '').slice(0, 1), yb = (b.name || '').slice(-1);
    names = [x + y, y + x, xa + yb, yb + xa, x + y + '记', '共' + y, x + '生', '双' + y,
             (a.name || '') + (b.name || ''), x + y + 'ing', '止于' + y, x + '与' + y];
    names = [...new Set(names.filter(n => n && n.length >= 2))];
  }
  out.innerHTML = names.slice(0, 14).map(n =>
    `<button class="tg-chip" onclick="tgUseName('${tgEsc(n)}')">${tgEsc(n)}</button>`).join('');
}
function tgUseName(n) {
  document.getElementById('tgCpName').value = n;
  tgBF.cpName = n;
  tgToast('已填入：' + n);
}
function tgNameConfirm() {
  const v = document.getElementById('tgCpName').value.trim();
  if (!v) { tgToast('先给这一对取个名字'); return; }
  tgBF.cpName = v;
  tgGo('scr-cover');
}

/* ================================================================
   六、封面与建圈
================================================================ */
const TG_CIRCLE_TAGS = ['原创CP','角色×角色','角色×自设','双男主','双女主','男女','长篇连载','短篇集','虐向','糖向','古风','现代','脑洞集散','只发图','欢迎二创'];
const TG_ACCESS = ['公开 · 任何人可见可加入','半开放 · 可见，加入需审核','私密 · 仅受邀可见'];

function tgRenderCoverPage() {
  const tb = document.getElementById('tgCircleTags');
  tb.innerHTML = TG_CIRCLE_TAGS.map(t => `<button class="tg-chip ${tgBF.circleTags.includes(t) ? 'on' : ''}" onclick="tgTapCircleTag(this,'${tgEsc(t)}')">${tgEsc(t)}</button>`).join('')
    + `<button class="tg-chip add" onclick="tgCircleTagCustom()">+ 自定义</button>`;
  const ab = document.getElementById('tgCircleAccess');
  ab.innerHTML = TG_ACCESS.map(t => `<button class="tg-chip ${tgBF.access === t ? 'on' : ''}" onclick="tgTapAccess(this,'${tgEsc(t)}')">${tgEsc(t)}</button>`).join('');
}
function tgTapCircleTag(btn, t) {
  const i = tgBF.circleTags.indexOf(t);
  if (i >= 0) { tgBF.circleTags.splice(i, 1); btn.classList.remove('on'); }
  else { tgBF.circleTags.push(t); btn.classList.add('on'); }
}
function tgCircleTagCustom() {
  tgSheetOpen(`<h4>自定义标签</h4><div class="tg-field"><input class="tg-input" id="tgCustomInput" placeholder="标签名"></div>
    <div style="height:14px"></div><button class="tg-btn tg-btn-dark" onclick="tgCircleTagSave()">加入</button>`);
}
function tgCircleTagSave() {
  const v = document.getElementById('tgCustomInput').value.trim();
  if (!v) return;
  TG_CIRCLE_TAGS.push(v); tgBF.circleTags.push(v);
  tgCloseSheet(); tgRenderCoverPage();
}
function tgTapAccess(btn, t) {
  tgBF.access = t;
  btn.parentNode.querySelectorAll('.tg-chip').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
}

/* 图片回调（core 调用） */
function tgOnImage(target, dataUrl) {
  if (target === 'bg') {
    tgBF.cover.bg = dataUrl;
    const el = document.getElementById('tgCoverBg');
    el.innerHTML = `<img src="${dataUrl}" alt="">`;
  } else if (target === 'av') {
    tgBF.cover.av = dataUrl;
    document.getElementById('tgCoverAv').innerHTML = `<img src="${dataUrl}" alt="">`;
  } else if (target === 'mebg' || target === 'meav') {
    tgProfileImage(target, dataUrl);
  }
}

function tgBuildCircleObj(isDraft) {
  return {
    type: isDraft ? 'draft' : 'circle',
    name: tgBF.cpName || '未命名圈子',
    pairA: tgBF.seatA, pairB: tgBF.seatB,
    source: tgBF.source,
    aiData: tgBF.aiAdopted || null,
    style: tgCollectStyle(),
    intro: (document.getElementById('tgCircleIntro') || {}).value || '',
    tags: [...tgBF.circleTags], access: tgBF.access,
    avatar: tgBF.cover.av, bg: tgBF.cover.bg
  };
}
async function tgSaveDraft() {
  await tgPut('drafts', { type: 'circle', title: tgBF.cpName || '未命名草稿', data: tgBuildCircleObj(true) });
  tgToast('已存为草稿，可随时回来续写');
  tgRefreshStats();
}
async function tgCreateCircle() {
  if (!tgBF.cpName) { tgToast('还没有取名'); return; }
  const obj = tgBuildCircleObj(false);
  await tgPut('circles', obj);
  document.getElementById('tgDoneName').textContent = `「${obj.name}」已建立`;
  document.getElementById('tgDoneDesc').innerHTML =
    `${tgEsc(tgBF.seatA.name)} × ${tgEsc(tgBF.seatB.name)}<br>文风设定与全部资料已一并存档，甜蜜值 +120。`;
  tgAddSweet(120);
  tgStack = ['scr-bifang', 'scr-done'];
  tgShow('scr-done', true); tgSyncNav(3);
  tgRefreshStats(); tgRenderCircleList();
  // 重置流程
  tgBF.seatA = tgBF.seatB = null; tgBF.cpName = ''; tgBF.cover = { av: null, bg: null };
  tgBF.circleTags = []; tgBF.aiAdopted = null;
}

/* ================================================================
   七、存档室 & 圈子列表
================================================================ */
let tgArcMode = 'circle';
function tgArcTab(m, btn) {
  tgArcMode = m;
  btn.parentNode.querySelectorAll('button').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  tgRenderArchive();
}
async function tgRenderArchive() {
  const box = document.getElementById('tgArcList');
  box.innerHTML = '<div class="tg-hint" style="padding:20px 0">读取中…</div>';
  const map = { circle: 'circles', draft: 'drafts', style: 'styles', ai: 'aihist' };
  const list = await tgAll(map[tgArcMode]);
  if (!list.length) {
    box.innerHTML = `<div class="tg-empty"><div class="tg-empty-mark" data-ico="box"></div>
      <p>这里还空着。<br>完成一次创建或存档后，记录会出现在这里。</p></div>`;
    tgFillIcons(box); return;
  }
  box.innerHTML = list.map(r => {
    let title = '', sub = '', av = '';
    if (tgArcMode === 'circle') {
      title = r.name; sub = `${r.pairA ? r.pairA.name : '?'} × ${r.pairB ? r.pairB.name : '?'} · ${r.tags.join('/') || '无标签'}`;
      av = r.avatar ? `<img src="${r.avatar}">` : `<span>${tgEsc((r.name || '?')[0])}</span>`;
    } else if (tgArcMode === 'draft') {
      title = r.title || '草稿'; sub = r.type === 'ai' ? 'AI 共创结果' : '未完成的建圈流程';
      av = `<span>${tgEsc((title || '?')[0])}</span>`;
    } else if (tgArcMode === 'style') {
      const sel = (r.data && r.data.sel) || {};
      title = r.name; sub = Object.values(sel).flat().slice(0, 4).join('、') || '空设定';
      av = `<span>文</span>`;
    } else {
      title = 'ROUND ' + r.round; sub = (r.results || []).map(x => x.cpname).join(' / ');
      av = `<span>AI</span>`;
    }
    return `<div class="tg-rec" onclick="tgOpenRecord('${tgArcMode}','${r.id}')">
      <div class="tg-rec-av">${av}</div>
      <div class="tg-rec-main"><b>${tgEsc(title)}</b><p>${tgEsc(sub)}</p></div>
      <div class="tg-rec-side"><i>${tgFmtDate(r.createdAt)}</i></div>
      <button class="tg-rec-del" data-ico="trash" onclick="event.stopPropagation();tgDelRecord('${map[tgArcMode]}','${r.id}')"></button>
    </div>`;
  }).join('');
  tgFillIcons(box);
  window._tgArc = list;
}
async function tgDelRecord(store, id) {
  await tgDel(store, id);
  tgRenderArchive(); tgRefreshStats(); tgRenderCircleList();
  tgToast('已删除');
}
function tgOpenRecord(mode, id) {
  const r = (window._tgArc || []).find(x => x.id === id);
  if (!r) return;
  if (mode === 'style') { tgToast('可在文风工坊一键调用'); return; }
  if (mode === 'circle') {
    tgSheetOpen(`<h4>${tgEsc(r.name)}</h4>
      <p class="tg-sheet-sub">${tgEsc(r.intro || '暂无简介')}</p>
      <div class="tg-field"><div class="tg-label">配对 <small>pair</small></div>
        <div class="tg-ai-hook" style="font-size:17px">${tgEsc(r.pairA.name)}<em>×</em>${tgEsc(r.pairB.name)}</div></div>
      <div class="tg-field"><div class="tg-label">文风 <small>style</small></div>
        <div class="tg-ai-kw">${Object.values((r.style && r.style.sel) || {}).flat().map(v => `<i>${tgEsc(v)}</i>`).join('') || '<i>未设定</i>'}</div></div>
      <div class="tg-field"><div class="tg-label">权限 <small>access</small></div>
        <p class="tg-hint" style="margin:0">${tgEsc(r.access)}</p></div>`);
    return;
  }
  tgSheetOpen(`<h4>${tgEsc(r.title || ('ROUND ' + r.round))}</h4>
    <p class="tg-sheet-sub">${tgEsc(JSON.stringify(r.data ? r.data.hook || r.data.name : (r.results || []).map(x => x.hook).join(' / ')))}</p>`);
}

async function tgRenderCircleList() {
  const box = document.getElementById('tgCircleList');
  if (!box) return;
  const list = await tgAll('circles');
  if (!list.length) {
    box.innerHTML = `<div class="tg-empty tg-rise tg-d2"><div class="tg-empty-mark" data-ico="circle"></div>
      <p>你还没有属于自己的圈。<br>去笔坊，四步就能建成第一个。</p>
      <div style="height:18px"></div>
      <button class="tg-btn tg-btn-dark" onclick="tgTab(3)">前往笔坊</button></div>`;
    tgFillIcons(box); return;
  }
  box.innerHTML = list.map((r, i) => `
    <div class="tg-rec tg-rise tg-d${(i % 6) + 1}" onclick="tgOpenCircle('${r.id}')">
      <div class="tg-rec-av">${r.avatar ? `<img src="${r.avatar}">` : `<span>${tgEsc((r.name || '?')[0])}</span>`}</div>
      <div class="tg-rec-main"><b>${tgEsc(r.name)}</b>
        <p>${tgEsc(r.pairA.name)} × ${tgEsc(r.pairB.name)}</p></div>
      <div class="tg-rec-side"><i>${tgFmtDate(r.createdAt)}</i></div>
    </div>`).join('');
  window._tgArc = list;
}
function tgOpenCircle(id) { tgOpenRecord('circle', id); }

/* ================================================================
   八、统计与入口钩子
================================================================ */
async function tgRefreshStats() {
  const [c, d, s, a] = await Promise.all([tgAll('circles'), tgAll('drafts'), tgAll('styles'), tgAll('aihist')]);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('tgStatCircle', c.length); set('tgStatDraft', d.length);
  set('tgStatStyle', s.length); set('tgStatAi', a.length);
}

function tgOnEnter(id) {
  if (id === 'scr-bifang') tgRefreshStats();
  if (id === 'scr-pick') { tgRenderSeats(); tgRenderPick(); }
  if (id === 'scr-ai' && !document.getElementById('tgAiForm').innerHTML) tgRenderAiForm();
  if (id === 'scr-style') { if (!document.getElementById('tgStyleForm').innerHTML) tgRenderStyleForm(); tgLoadStylePresets(); }
  if (id === 'scr-name') tgRenderNamePage();
  if (id === 'scr-cover') tgRenderCoverPage();
  if (id === 'scr-archive') tgRenderArchive();
  if (id === 'scr-circle') tgRenderCircleList();
  if (id === 'scr-profile') tgRenderProfile();
  if (id === 'scr-level') tgRenderLevel();
}

function tgInitBifang() {
  tgRefreshStats();
}