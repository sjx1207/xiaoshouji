/* ==================================================================
   char-diary.js —— Char 日记 · 真实 AI 生成 / 阅读场 / 四道仪式

   本文件接管三件事：
     1) 日历弹窗底部「落笔仪式条」：按下墨章，按角色人设 + 当天日期
        （含节假日 / 星期 / 季节）真实调用模型，生成 1~3 篇日记，
        每篇不少于 800 字，且带有分块版式指令与批注。
     2) 生成结果的持久化（IndexedDB: LunaCharDiaryDB / dayEntries），
        并同步进内存缓存，供 diary.js 的日历与时间轴同步查表。
     3) 单篇详情页（.cdd-page）的渲染：多样化版式 + 批注库 +
        四道仪式（回响传送门 / 多重笔迹 / 蝴蝶效应 / 时光回流）。

   人设贴合的硬性约定（写在 prompt 里，也在此说明）：
     - 若该角色未被任何用户身份绑定 → 完全以 char 自身的人设写作，
       不得出现"你/用户"这种未定义的关系对象，不得虚构关系。
     - 若存在绑定身份 → 关系、称呼、边界一律以角色卡上的
       relation / callUser / relationDetail 为准，不得越界。
     - neverList / boundaries 为绝对禁区；口吻须匹配 age / speechStyle /
       catchphrases / lang，禁止 OOC。
================================================================== */
(function(){
  'use strict';

  /* ================================================================
     0 · 基础工具
  ================================================================ */
  function esc(str){
    var d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }
  function pad2(n){ return n < 10 ? '0' + n : String(n); }
  function keyOf(dateObj){
    return dateObj.getFullYear() + '-' + pad2(dateObj.getMonth() + 1) + '-' + pad2(dateObj.getDate());
  }
  function dateFromKey(key){
    var p = String(key).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function hashStr(str){
    var h = 5381;
    for (var i = 0; i < str.length; i++){ h = ((h << 5) + h) + str.charCodeAt(i); h = h & 0xffffffff; }
    h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
    h = Math.imul(h, 3266489917); h ^= h >>> 16;
    return Math.abs(h);
  }
  function pick(arr, seed){ return arr[hashStr(String(seed)) % arr.length]; }
  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function vibrate(ms){ if (navigator.vibrate){ try{ navigator.vibrate(ms); }catch(e){} } }
  function textLen(str){ return String(str || '').replace(/\s/g, '').length; }

  var WEEKDAY_CN = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
  var MONTH_CN = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
  var MONTH_EN = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  var CN_NUM = ['零','壹','贰','叁','肆','伍','陆','柒','捌','玖','拾'];
  var CARD_STYLES = ['polaroid','notestrip','typewriter','wax-letter','ticket'];
  var LAYOUTS = ['lay-a','lay-b','lay-c','lay-d','lay-e'];
  var MOODS = ['calm','joy','tender','blue','storm'];
  var MOOD_LABEL = { calm:'平静', joy:'欢喜', tender:'柔软', blue:'低落', storm:'翻涌' };
  var MOOD_GLYPH = {
    calm:   '<svg viewBox="0 0 24 24" fill="none"><path d="M4 14c2-2.5 4-2.5 6 0s4 2.5 6 0 4-2.5 6 0"/></svg>',
    joy:    '<svg viewBox="0 0 24 24" fill="none"><path d="M5 13c1.5 3.2 4.2 5 7 5s5.5-1.8 7-5"/><circle cx="8.5" cy="9" r="0.9" fill="currentColor" stroke="none"/><circle cx="15.5" cy="9" r="0.9" fill="currentColor" stroke="none"/></svg>',
    tender: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 19c-.3 0-.6-.1-.8-.3C7.8 15.9 5 13.4 5 10.3 5 8 6.8 6.2 9 6.2c1.1 0 2.2.5 3 1.4.8-.9 1.9-1.4 3-1.4 2.2 0 4 1.8 4 4.1 0 3.1-2.8 5.6-6.2 8.4-.2.2-.5.3-.8.3Z"/></svg>',
    blue:   '<svg viewBox="0 0 24 24" fill="none"><path d="M12 4c-4 4-7 7.4-7 10.6A7 7 0 0 0 12 21a7 7 0 0 0 7-6.4C19 11.4 16 8 12 4Z"/></svg>',
    storm:  '<svg viewBox="0 0 24 24" fill="none"><path d="M7 9a5 5 0 0 1 9.6-1.8A4 4 0 0 1 17 15H7.5a3.5 3.5 0 0 1-.5-6.9Z"/></svg>'
  };

  /* 与节气/季节相关的写作底色，交给模型作为氛围锚点而非硬性描写 */
  function seasonOf(m){
    if (m <= 1 || m === 11) return '冬';
    if (m <= 4) return '春';
    if (m <= 7) return '夏';
    return '秋';
  }

  /* ================================================================
     1 · 数据层：IndexedDB LunaCharDiaryDB / dayEntries
     记录形如 { key: 'charId::YYYY-MM-DD', charId, date, entries: [...] }
  ================================================================ */
  var DB_NAME = 'LunaCharDiaryDB';
  var STORE = 'dayEntries';
  var _db = null;

  function openDB(){
    return new Promise(function(resolve, reject){
      if (_db) return resolve(_db);
      try{
        var req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function(e){
          var db = e.target.result;
          if (!db.objectStoreNames.contains(STORE)){
            var st = db.createObjectStore(STORE, { keyPath: 'key' });
            st.createIndex('charId', 'charId', { unique: false });
          }
        };
        req.onsuccess = function(e){ _db = e.target.result; resolve(_db); };
        req.onerror = function(e){ reject(e); };
      }catch(err){ reject(err); }
    });
  }

  var cache = {};           /* charId -> { 'YYYY-MM-DD': dayRecord } */
  var cacheLoaded = {};     /* charId -> true */

  function preload(charId){
    var cid = String(charId);
    return openDB().then(function(db){
      return new Promise(function(resolve){
        try{
          var tx = db.transaction(STORE, 'readonly');
          var idx = tx.objectStore(STORE).index('charId');
          var req = idx.getAll(cid);
          req.onsuccess = function(){
            var map = {};
            (req.result || []).forEach(function(rec){ map[rec.date] = rec; });
            cache[cid] = map;
            cacheLoaded[cid] = true;
            resolve(map);
          };
          req.onerror = function(){ cache[cid] = cache[cid] || {}; resolve(cache[cid]); };
        }catch(err){ cache[cid] = cache[cid] || {}; resolve(cache[cid]); }
      });
    }).catch(function(){ cache[cid] = cache[cid] || {}; return cache[cid]; });
  }

  function getDaySync(charId, dateKey){
    var m = cache[String(charId)];
    return m ? (m[dateKey] || null) : null;
  }

  function saveDay(rec){
    var cid = String(rec.charId);
    cache[cid] = cache[cid] || {};
    cache[cid][rec.date] = rec;
    return openDB().then(function(db){
      return new Promise(function(resolve){
        try{
          var tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put(rec);
          tx.oncomplete = function(){ resolve(true); };
          tx.onerror = function(){ resolve(false); };
        }catch(err){ resolve(false); }
      });
    }).catch(function(){ return false; });
  }

  function allDaysOf(charId){
    var m = cache[String(charId)] || {};
    return Object.keys(m).sort().map(function(k){ return m[k]; });
  }

  /* ================================================================
     2 · 人设与身份：读取角色卡 + 绑定身份
  ================================================================ */
  function openIdentityDB(){
    return new Promise(function(resolve){
      try{
        var probe = indexedDB.open('LunaIdentityDB');
        probe.onsuccess = function(e){ resolve(e.target.result); };
        probe.onerror = function(){ resolve(null); };
      }catch(err){ resolve(null); }
    });
  }

  function loadBoundIdentity(charId){
    return openIdentityDB().then(function(db){
      if (!db || !db.objectStoreNames.contains('identities')) return null;
      return new Promise(function(resolve){
        try{
          var r = db.transaction('identities').objectStore('identities').getAll();
          r.onsuccess = function(){
            var list = r.result || [];
            var cid = String(charId);
            var bound = list.filter(function(it){
              var ids = it.boundCharIds || (it.boundCharId != null ? [it.boundCharId] : []);
              return ids.map(String).indexOf(cid) !== -1;
            });
            if (!bound.length) return resolve(null);
            /* 主身份 > 启用中的身份 > 最近创建 */
            bound.sort(function(a, b){
              return (b.isPrimary ? 2 : 0) + (b.active ? 1 : 0) - ((a.isPrimary ? 2 : 0) + (a.active ? 1 : 0));
            });
            resolve(bound[0]);
          };
          r.onerror = function(){ resolve(null); };
        }catch(err){ resolve(null); }
      });
    }).catch(function(){ return null; });
  }

  /* 把角色卡压成一段严谨、无歧义的人设说明 */
  function personaText(c){
    var L = [];
    function put(label, val){
      if (val == null) return;
      if (Array.isArray(val)) val = val.filter(Boolean).join('、');
      val = String(val).trim();
      if (val) L.push(label + '：' + val);
    }
    put('姓名', c.name);
    put('身份定位', c.role);
    put('性别', c.gender);
    put('年龄', c.age);
    put('生日', c.birthday);
    put('种族/species', c.species);
    put('核心特质', c.traits);
    put('外貌', c.appearance);
    put('惯常穿着', c.outfit);
    put('喜欢', c.likes);
    put('厌恶', c.dislikes);
    put('恐惧/软肋', c.fears);
    put('说话与行文风格', c.speechStyle);
    put('口头禅', c.catchphrases);
    put('使用语言', c.lang);
    put('背景故事', c.backstory);
    put('当前处境/场景', c.scenario);
    put('人物简述', c.desc);
    return L.join('\n');
  }

  function relationText(c, identity){
    if (!identity){
      return [
        '【关系状态】此角色当前没有绑定任何用户身份。',
        '因此：日记中不得出现"你""用户""主人"等未定义的第二人称关系对象，',
        '不得虚构一段与读者/用户的关系，也不得暗示有人正在读这本日记。',
        '这是角色写给自己的私密日记，一切人物、事件只能来自上面的人设、背景故事与当前处境。',
        c.relation ? ('角色卡上写有关系设定「' + c.relation + '」，但没有对应身份数据，只能作为角色内心的既有关系记忆被间接提及，不得展开为具体互动。') : ''
      ].filter(Boolean).join('\n');
    }
    var L = ['【关系状态】此角色已与一位用户身份绑定，日记中出现对方时必须严格遵守以下设定：'];
    function put(label, val){
      if (!val) return;
      if (Array.isArray(val)) val = val.filter(Boolean).map(function(t){ return t.text || t; }).join('、');
      val = String(val).trim();
      if (val) L.push(label + '：' + val);
    }
    put('对方姓名', identity.name);
    put('对方身份/职业', identity.role || identity.occupation);
    put('对方性别', identity.gender);
    put('对方生日', identity.birthday);
    put('对方所在地', identity.location);
    put('对方性格', identity.personality);
    put('对方自述', identity.desc);
    put('对方标签', identity.tags);
    put('对方的座右铭', identity.motto);
    put('二人关系', c.relation);
    put('角色对对方的称呼', c.callUser);
    put('对方希望被称呼为', identity.selfCall);
    put('关系细节', c.relationDetail);
    L.push('称呼必须使用上面写明的称呼，不得自行改口；关系的亲疏程度必须与"二人关系/关系细节"一致，不得擅自升温或降温。');
    return L.join('\n');
  }

  function boundaryText(c){
    var L = [];
    if (c.neverList && c.neverList.length) L.push('绝对不会做/不会说的事：' + c.neverList.filter(Boolean).join('；'));
    if (c.boundaries) L.push('情绪与行为边界：' + c.boundaries);
    if (c.firstMes) L.push('（参考语感）角色的开场白：' + c.firstMes);
    if (c.dialogExamples && c.dialogExamples.length){
      var ex = c.dialogExamples.slice(0, 4).map(function(d){
        if (typeof d === 'string') return d;
        return [d.user ? ('对方：' + d.user) : '', d.char ? ('角色：' + d.char) : ''].filter(Boolean).join(' / ');
      }).filter(Boolean).join('\n');
      if (ex) L.push('（参考语感）对话样例：\n' + ex);
    }
    return L.join('\n');
  }

  /* 年龄口吻锚点：让模型知道该用几岁的人的语言密度写字 */
  function ageTone(c){
    var n = parseInt(String(c.age || '').replace(/[^0-9]/g, ''), 10);
    if (!n) return '按人设推断出的年龄段口吻书写，用词密度、思考深度、关注对象都要与之相符。';
    if (n < 13) return '这是一个 ' + n + ' 岁的孩子：句子短、直给，关心眼前的小事，会有拼音式的天真联想，不会使用书面成语堆砌与哲学化表达。';
    if (n < 18) return '这是一个 ' + n + ' 岁的少年人：情绪起伏大，用词跳脱，会有夸张比喻与自我戏剧化，夹杂同龄人的口语与省略。';
    if (n < 26) return '这是一个 ' + n + ' 岁的年轻人：自我审视强烈，语言有锐度也有不确定，会在同一段里推翻自己。';
    if (n < 40) return '这是一个 ' + n + ' 岁的成年人：语言克制、信息密度高，习惯用具体的事讲情绪，而不是直接抒情。';
    if (n < 60) return '这是一个 ' + n + ' 岁的中年人：句子平稳，常从旧事里取比方，情绪藏在事实之下。';
    return '这是一位 ' + n + ' 岁的长者：语速慢，句子短而笃定，时间尺度长，习惯与过去的人事对话。';
  }

  /* ================================================================
     3 · 模型调用
  ================================================================ */
  function apiConfig(){
    var cur = {};
    try{ cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}') || {}; }catch(e){}
    return {
      baseUrl: (cur.baseUrl || '').replace(/\/+$/, ''),
      apiKey: cur.apiKey || '',
      model: localStorage.getItem('luna_api_model') || ''
    };
  }

  function callModel(messages, opts){
    opts = opts || {};
    var cfg = apiConfig();
    if (!cfg.baseUrl || !cfg.apiKey){
      return Promise.reject(new Error('尚未配置 API：请先到「设置 · 接口」填好地址与密钥，并选择模型。'));
    }
    if (!cfg.model) return Promise.reject(new Error('尚未选择模型：请到「设置 · 接口」选择一个可用模型。'));

    return fetch(cfg.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.apiKey },
      body: JSON.stringify({
        model: cfg.model,
        messages: messages,
        temperature: opts.temperature == null ? 0.95 : opts.temperature,
        top_p: 0.95,
        max_tokens: opts.maxTokens || 8000
      })
    }).then(function(r){
      if (!r.ok){
        return r.text().then(function(t){ throw new Error('接口返回 ' + r.status + '：' + (t || '').slice(0, 160)); });
      }
      return r.json();
    }).then(function(data){
      var msg = data && data.choices && data.choices[0] && data.choices[0].message;
      var content = msg && (typeof msg.content === 'string' ? msg.content
        : (Array.isArray(msg.content) ? msg.content.map(function(b){ return b.text || ''; }).join('') : ''));
      if (!content) throw new Error('模型没有返回内容，请换一个模型再试。');
      return content;
    });
  }

  function parseJSON(text){
    var t = String(text || '').trim();
    t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a === -1 || b === -1) throw new Error('模型返回的内容不是可解析的结构，请重试一次。');
    var slice = t.slice(a, b + 1);
    try{ return JSON.parse(slice); }
    catch(e){
      /* 容错：去掉结尾多余逗号 / 中文引号造成的常见毛病 */
      var fixed = slice.replace(/,\s*([}\]])/g, '$1').replace(/[\u201c\u201d]/g, '"');
      return JSON.parse(fixed);
    }
  }

  /* ================================================================
     4 · 生成 prompt
  ================================================================ */
  /* 版式指令池：每篇日记随机领到一份，逼迫模型给出结构不同的分块，
     从根上避免"每篇都长一个样" */
  var FORM_BRIEFS = [
    '以一句极短的断句开场（不超过 12 字），随后进入长段落；中途插入一段 fragment 碎句，结尾用 scrap 贴一张便签。',
    '以 timestamp 分块把一天切成三个时刻来写（如清晨/午后/深夜），每个时刻各一到两段，其中一处用 strike 划掉重写。',
    '以 quote 起手（引一句歌词式或书里的话，须是角色会知道的东西），中段安排一处 dialogue 复述当天听到的对话，末尾 aside 补一句心里话。',
    '大段叙事为主，中间嵌入一个 list（清单式的三到五条，可以是待办、可以是今天注意到的细节），随后用 pressed 记下夹进日记本的东西。',
    '从一个具体物件写起（lead 块），围绕它反复绕回，全篇不写时间线，中途两处 aside 做自我打断，结尾 fragment 收尾。',
    '写成"本来想写别的却跑题"的结构：开头 para 说要记某件事，中段被另一件事夺走注意力，用 strike 划掉原计划，末尾 scrap 一句自嘲。',
    '以 dialogue 开场（把当天最刺人的一句话直接抛出来），后面用长段落拆解它，中间穿插 timestamp 标出情绪转折的那一刻。',
    '安静叙事型：三到四个中长段落，节奏平缓，仅在中段放一处 quote 与一处 aside，结尾 pressed 收束。'
  ];

  /* 一天写几篇：由角色 + 日期 + 本次生成批次哈希决定，多数为 1 篇，偶有 2~3 篇。
     加入 revision 参与哈希，保证"重新写这一天"时篇数也可能变化，
     而不是每次都锁死同一个数字。 */
  function entryCountFor(charId, dateKey, revision){
    var r = hashStr(charId + '#' + dateKey + '#' + (revision || 0)) % 100;
    if (r < 62) return 1;
    if (r < 90) return 2;
    return 3;
  }

  function buildPrompt(ctx){
    var c = ctx.char, id = ctx.identity, d = ctx.date;
    var count = ctx.count;
    var holiday = ctx.holiday;
    var revision = ctx.revision || 0;
    var forms = [];
    for (var i = 0; i < count; i++){
      forms.push(FORM_BRIEFS[hashStr(ctx.dateKey + '@' + i + '@' + c.id + '@' + revision) % FORM_BRIEFS.length]);
    }

    /* 若这一天此前已经写过（用户点了"重新写这一天"），把旧篇目的标题/
       摘要/开场喂给模型，强制要求这一次必须是不同的取材角度、不同的
       情绪落点、不同的具体事件——避免"同一天点两次，内容却大同小异"。 */
    var priorBrief = '';
    if (ctx.priorEntries && ctx.priorEntries.length){
      priorBrief = [
        '',
        '【重要：这一天此前已经写过，以下是旧版本，这次必须重写出不同的内容】',
        '旧版本各篇的标题与摘要（仅供你避雷，不要延续或复述它们）：',
        ctx.priorEntries.map(function(e, i){
          return (i + 1) + '. 《' + (e.title || '无题') + '》' + (e.excerpt ? '——' + e.excerpt : '');
        }).join('\n'),
        '这一次重写要求：换一件当天发生的具体事、换一个切入的时刻或场景、换一种情绪落点或结论，标题也必须不同。人设、关系设定不变，但素材与写法必须与旧版本明显不同，就像人回忆同一天时，两次会想起不同的片段。'
      ].join('\n');
    }

    var sys = [
      '你是一位专写"人物私密日记"的作者。你现在要以下面这个角色的第一人称，写出 Ta 在指定某一天真实写下的日记。',
      '',
      '【角色人设 · 唯一事实来源】',
      personaText(c),
      '',
      relationText(c, id),
      '',
      boundaryText(c),
      '',
      '【口吻锚点】',
      ageTone(c),
      c.speechStyle ? ('行文必须与人设里写明的说话风格一致：' + c.speechStyle) : '',
      c.lang ? ('主要使用语言：' + c.lang) : '',
      '',
      '【绝对不可违反的规则】',
      '1. 禁止 OOC。角色的性格、身份、说话方式、知识边界、时代与世界观必须与人设完全一致；人设里没有的能力、身份、经历一律不得添加。',
      '2. 只能写日记本身。不要写任何旁白、解释、前言、后记、markdown 标题或对指令的回应。',
      '3. 日记是私人的：可以有语病、跳跃、涂改、未说完的句子，但不得出现"作为一个角色""设定"之类的出戏表述。',
      '4. 必须写到具体的人、物、地点、动作、气味、温度、声音，用细节承载情绪，禁止空洞抒情与排比堆砌。',
      '5. 每一篇正文的净字数（所有文本块相加，不含标点空格计）必须 ≥ 900 字。写不够就继续把当天的细节写下去，不许注水重复同一句意思。',
      '6. 严禁使用任何 emoji 或颜文字。',
      '7. 若与已绑定的用户身份相关，称呼与关系分寸必须严格按上面的关系设定；若没有绑定身份，则全篇不得出现第二人称的关系对象。'
    ].filter(Boolean).join('\n');

    var user = [
      '【这一天】',
      ctx.dateKey + '，' + WEEKDAY_CN[d.getDay()] + '，' + seasonOf(d.getMonth()) + '季。',
      holiday ? ('这一天是：' + holiday + '。这一天的节日属性必须真实地影响内容——可以是热闹地参与，也可以是刻意回避、无感、或因为身份处境而与节日错位，取决于人设，但不能对它只字不提。') : '这一天不是任何节日，是一个普通日子，请写出普通日子里独有的质地，不要编造节庆。',
      '',
      '【篇数】这一天角色写了 ' + count + ' 篇日记。',
      count > 1 ? '多篇之间必须发生在同一天的不同时刻，情绪要有推进或反转，后写的一篇可以推翻前一篇的判断；标题、语气、版式都必须彼此不同。' : '',
      '',
      '【每篇的版式要求（必须严格照做，让每篇长得都不一样）】',
      forms.map(function(f, i){ return '第 ' + (i + 1) + ' 篇：' + f; }).join('\n'),
      '',
      '【批注】',
      '每篇要有 2~4 处批注：批注是角色在事后（当晚更晚、第二天、或很久以后）重读时补在页边的小字，语气与正文不同——更冷静、更羞赧、或更自嘲。批注挂在某个文本块上。',
      '',
      '【只输出如下 JSON，不要任何其他文字】',
      '{',
      '  "entries": [',
      '    {',
      '      "time": "22:14",',
      '      "mood": "calm|joy|tender|blue|storm",',
      '      "title": "不超过 14 字的标题，像角色自己会写的",',
      '      "weather": "四字以内，如 薄雨转晴",',
      '      "place": "写这篇时人在哪儿，六字以内",',
      '      "excerpt": "从正文里摘一句最有质感的话，不超过 34 字",',
      '      "signature": "落款处的一句短语或署名，八字以内",',
      '      "blocks": [',
      '        { "type": "lead|para|emph|quote|fragment|list|dialogue|aside|scrap|strike|timestamp|pressed", ... }',
      '      ]',
      '    }',
      '  ]',
      '}',
      '',
      '【各种块的字段定义】',
      'lead    : { "type":"lead", "text":"起笔的第一段，可长可短" }',
      'para    : { "type":"para", "text":"正文段落，一段一个块" }',
      'emph    : { "type":"emph", "text":"全篇分量最重的一句判断或转折，独立成段，不超过 40 字，每篇最多用 1 次" }',
      'quote   : { "type":"quote", "text":"引用的话", "from":"出处或说这话的人，可省略" }',
      'fragment: { "type":"fragment", "lines":["断句一","断句二","断句三"] }',
      'list    : { "type":"list", "label":"清单的名字", "items":["条目一","条目二","条目三"] }',
      'dialogue: { "type":"dialogue", "lines":[{"who":"称呼","text":"说的话"}] }',
      'aside   : { "type":"aside", "text":"写在页边的自我打断，短" }',
      'scrap   : { "type":"scrap", "text":"贴在日记里的便签内容", "caption":"便签上的小字，可省略" }',
      'strike  : { "type":"strike", "text":"被划掉的原句", "rewrite":"改写后的句子" }',
      'timestamp:{ "type":"timestamp", "label":"03:12", "text":"这个时刻写下的内容" }',
      'pressed : { "type":"pressed", "text":"夹进日记本里的东西及其来历", "label":"票根/花瓣/纸条 等三字以内" }',
      '',
      '任意块都可以额外带一个批注字段：',
      '"note": { "mark":"①", "text":"页边批注内容" }  ——同一篇内 mark 依次为 ① ② ③ ④。',
      '',
      '【重点强调块】每篇至少用一次 emph 块，放在情绪或判断最重的那一句上，独立成段，前后不要挨着另一个 emph；不要滥用，一篇最多一次。',
      '再次强调：每篇正文净字数 ≥ 900 字，块的数量与类型必须按上面分配的版式走，禁止所有篇章使用同一种结构，且每篇至少使用 5 种不同的块类型（含 emph 与 note）以保证排版有起伏。',
      priorBrief
    ].filter(Boolean).join('\n');

    return [
      { role: 'system', content: sys },
      { role: 'user', content: user }
    ];
  }

  /* 正文净字数统计 */
  function entryWordCount(entry){
    var n = 0;
    (entry.blocks || []).forEach(function(b){
      n += textLen(b.text);
      n += textLen(b.rewrite);
      (b.lines || []).forEach(function(l){ n += textLen(typeof l === 'string' ? l : l.text); });
      (b.items || []).forEach(function(it){ n += textLen(it); });
      if (b.note) n += textLen(b.note.text);
    });
    return n;
  }

  /* 结构清洗：保证渲染层拿到的一定是干净可用的数据 */
  var BLOCK_TYPES = ['lead','para','emph','quote','fragment','list','dialogue','aside','scrap','strike','timestamp','pressed'];
  function normalizeEntry(raw, dateKey, index, charId){
    var e = raw || {};
    var blocks = (Array.isArray(e.blocks) ? e.blocks : []).map(function(b){
      var t = String(b && b.type || 'para').toLowerCase();
      if (BLOCK_TYPES.indexOf(t) === -1) t = 'para';
      var nb = { type: t };
      if (b.text) nb.text = String(b.text);
      if (b.from) nb.from = String(b.from);
      if (b.label) nb.label = String(b.label);
      if (b.caption) nb.caption = String(b.caption);
      if (b.rewrite) nb.rewrite = String(b.rewrite);
      if (Array.isArray(b.items)) nb.items = b.items.map(String).filter(Boolean);
      if (Array.isArray(b.lines)){
        nb.lines = b.lines.map(function(l){
          if (typeof l === 'string') return t === 'dialogue' ? { who: '', text: l } : l;
          return t === 'dialogue' ? { who: String(l.who || ''), text: String(l.text || '') } : String(l.text || '');
        }).filter(function(l){ return typeof l === 'string' ? l : l.text; });
      }
      if (b.note && b.note.text) nb.note = { mark: String(b.note.mark || ''), text: String(b.note.text) };
      return nb;
    }).filter(function(b){
      return b.text || (b.lines && b.lines.length) || (b.items && b.items.length) || b.rewrite;
    });

    /* 批注 mark 归一化为 ①②③④ */
    var marks = ['①','②','③','④','⑤','⑥','⑦','⑧'];
    var mi = 0;
    blocks.forEach(function(b){ if (b.note){ b.note.mark = marks[mi] || ('*' + (mi + 1)); mi++; } });

    var id = dateKey + '-' + (index + 1) + '-' + uid();
    var entry = {
      id: id,
      time: String(e.time || '').slice(0, 5) || '21:0' + (index % 10),
      mood: MOODS.indexOf(String(e.mood || '').toLowerCase()) !== -1 ? String(e.mood).toLowerCase() : pick(MOODS, id),
      title: String(e.title || '无题').slice(0, 24),
      weather: String(e.weather || '').slice(0, 8),
      place: String(e.place || '').slice(0, 12),
      excerpt: String(e.excerpt || (blocks[0] && blocks[0].text) || '').slice(0, 46),
      signature: String(e.signature || '').slice(0, 14),
      blocks: blocks,
      style: pick(CARD_STYLES, id + '::style'),
      layout: pick(LAYOUTS, id + '::layout'),
      rituals: {},
      createdAt: Date.now()
    };
    entry.wordCount = entryWordCount(entry);
    return entry;
  }

  /* ================================================================
     5 · 生成流程（含一次"字数不足则续写"的补救）
  ================================================================ */
  function generateForDay(char, dateKey, onStage){
    var d = dateFromKey(dateKey);
    var hooks = window._LunaCharDiaryHooks || {};
    var holiday = hooks.getHoliday ? hooks.getHoliday(dateKey) : '';

    /* 若这一天已经生成过，这次算作一次"重写"：revision 递增，
       篇数会重新按新的哈希抽取，且把旧内容喂给 prompt 作为"避雷"参照，
       从根上保证多次点击不会写出雷同的日记。 */
    var existing = getDaySync(String(char.id), dateKey);
    var priorEntries = (existing && existing.entries) || [];
    var revision = (existing && existing.revision ? existing.revision : 0) + 1;
    var count = entryCountFor(String(char.id), dateKey, revision);

    onStage && onStage('读取人设与关系');
    return loadBoundIdentity(char.id).then(function(identity){
      onStage && onStage(identity ? ('已绑定「' + (identity.name || '身份') + '」') : '未绑定身份 · 依人设独立书写');
      var messages = buildPrompt({
        char: char, identity: identity, date: d, dateKey: dateKey,
        count: count, holiday: holiday, revision: revision, priorEntries: priorEntries
      });
      onStage && onStage('落笔中 · 共 ' + count + ' 篇');
      /* 重写时略微调高温度，配合上面喂给模型的"旧版本避雷"提示，
         双重保证同一天多次生成不会读出雷同的内容。 */
      var temp = Math.min(1.15, 1.0 + (revision - 1) * 0.05);
      return callModel(messages, { temperature: temp, maxTokens: 8000 }).then(function(text){
        var data = parseJSON(text);
        var list = Array.isArray(data.entries) ? data.entries : (Array.isArray(data) ? data : []);
        if (!list.length) throw new Error('模型没有写出可用的日记，请再试一次。');
        var entries = list.slice(0, 3).map(function(raw, i){ return normalizeEntry(raw, dateKey, i, char.id); });

        var short = entries.filter(function(e){ return e.wordCount < 800; });
        if (!short.length) return entries;

        /* 补救：把不足 800 字的篇目交回模型续写，而不是把半截东西塞给用户 */
        onStage && onStage('字数不足 · 续写中');
        var fixMsgs = messages.concat([
          { role: 'assistant', content: text },
          { role: 'user', content: '以下篇目的正文净字数不足 900 字：' +
            short.map(function(e){ return '《' + e.title + '》（当前约 ' + e.wordCount + ' 字）'; }).join('、') +
            '。请在保持人设、时间、版式与已写内容完全一致的前提下，为这些篇目补足内容：在原有 blocks 之后继续追加新的块（可以是 para / timestamp / fragment / aside 等），把当天没写完的细节写下去，直到每篇净字数 ≥ 900。仍然只输出同样结构的完整 JSON，包含所有篇目（未补的篇目原样返回）。' }
        ]);
        return callModel(fixMsgs, { temperature: 0.95, maxTokens: 8000 }).then(function(t2){
          try{
            var d2 = parseJSON(t2);
            var l2 = Array.isArray(d2.entries) ? d2.entries : [];
            if (l2.length) return l2.slice(0, 3).map(function(raw, i){ return normalizeEntry(raw, dateKey, i, char.id); });
          }catch(e){}
          return entries;
        }).catch(function(){ return entries; });
      });
    }).then(function(entries){
      /* 重新写这一天 ≠ 覆盖：新生成的篇目追加在旧篇目之后，
         旧的每一篇依然完整保留、可以点开阅读，而不是被这次生成吃掉。
         entries 里的每篇 id 都带 uid()，天然不会与旧篇目重复。 */
      var allEntries = priorEntries.concat(entries);
      var rec = {
        key: String(char.id) + '::' + dateKey,
        charId: String(char.id),
        date: dateKey,
        holiday: holiday,
        entries: allEntries,
        revision: revision,
        updatedAt: Date.now()
      };
      return saveDay(rec).then(function(){ return rec; });
    });
  }

  /* ================================================================
     6 · 日历弹窗 · 落笔仪式条
  ================================================================ */
  var selectedKey = '';
  var working = false;

  function quillEls(){
    return {
      wrap: document.getElementById('cdhQuill'),
      btn: document.getElementById('cdhQuillBtn'),
      eyebrow: document.getElementById('cdhQuillEyebrow'),
      line: document.getElementById('cdhQuillLine'),
      hint: document.getElementById('cdhQuillHint'),
      goto: document.getElementById('cdhQuillGoto')
    };
  }

  function setQuill(state, eyebrow, line, hint){
    var q = quillEls();
    if (!q.wrap) return;
    q.wrap.setAttribute('data-state', state);
    if (eyebrow != null && q.eyebrow) q.eyebrow.textContent = eyebrow;
    if (line != null && q.line) q.line.textContent = line;
    if (hint != null && q.hint) q.hint.textContent = hint;
  }

  function describeDay(dateKey){
    var d = dateFromKey(dateKey);
    var hooks = window._LunaCharDiaryHooks || {};
    var holiday = hooks.getHoliday ? hooks.getHoliday(dateKey) : '';
    return MONTH_CN[d.getMonth()] + d.getDate() + '日 · ' + WEEKDAY_CN[d.getDay()] + (holiday ? ' · ' + holiday : '');
  }

  function refreshQuillFor(dateKey, char){
    if (!dateKey || !char){ setQuill('idle', '选中一个日子', 'Ta 会为那一天留下什么', '按下墨章，落笔'); return; }
    var day = getDaySync(char.id, dateKey);
    var d = dateFromKey(dateKey);
    var today = new Date(); today.setHours(0,0,0,0);
    if (d > today){
      setQuill('future', describeDay(dateKey), '这一天还没有到来', '未来还不能被记下');
      return;
    }
    if (day && day.entries && day.entries.length){
      setQuill('done', describeDay(dateKey), '这一天已有 ' + day.entries.length + ' 篇落笔', '再按一次，为这一天再添一篇');
    }else{
      setQuill('idle', describeDay(dateKey), (char.name || 'Ta') + ' 尚未写下这一天', '按下墨章，落笔');
    }
  }

  function onCalSelect(key, char){
    selectedKey = key;
    refreshQuillFor(key, char);
  }

  function runGeneration(){
    if (working) return;
    var hooks = window._LunaCharDiaryHooks || {};
    var char = hooks.getChar && hooks.getChar();
    if (!char) return;
    var key = selectedKey || (hooks.getSelectedKey && hooks.getSelectedKey());
    if (!key){ setQuill('idle', '先选一个日子', '在上面的日历里点一天', '按下墨章，落笔'); return; }
    var d = dateFromKey(key), today = new Date(); today.setHours(0,0,0,0);
    if (d > today){ refreshQuillFor(key, char); return; }

    working = true;
    vibrate(12);
    setQuill('working', describeDay(key), '正在落笔', '准备中');

    generateForDay(char, key, function(stage){
      var q = quillEls();
      if (q.hint) q.hint.textContent = stage;
    }).then(function(rec){
      working = false;
      vibrate(16);
      setQuill('done', describeDay(key), '写好了 · 共 ' + rec.entries.length + ' 篇', '前往这一天翻阅');
      if (hooks.refresh) hooks.refresh(dateFromKey(key));
      /* 生成后自动带用户去看：关掉日历，滚动到那一天 */
      setTimeout(function(){
        if (hooks.closeCalModal) hooks.closeCalModal();
        if (hooks.jumpToDate) hooks.jumpToDate(dateFromKey(key));
      }, 620);
    }).catch(function(err){
      working = false;
      setQuill('error', describeDay(key), '这一次没能写成', (err && err.message) ? String(err.message).slice(0, 60) : '请再按一次墨章');
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    var q = quillEls();
    if (q.btn) q.btn.addEventListener('click', runGeneration);
    if (q.goto) q.goto.addEventListener('click', function(){
      var hooks = window._LunaCharDiaryHooks || {};
      var key = selectedKey || (hooks.getSelectedKey && hooks.getSelectedKey());
      if (!key) return;
      vibrate(5);
      if (hooks.closeCalModal) hooks.closeCalModal();
      if (hooks.jumpToDate) hooks.jumpToDate(dateFromKey(key));
    });
  });

  /* ================================================================
     7 · 详情页 —— 渲染 AI 生成的分块内容
  ================================================================ */
  var detail = { charId: null, dateKey: null, entryId: null, entry: null, day: null };

  function cddEl(id){ return document.getElementById(id); }

  /* 背景与文字色完全搬运自角色专属主页，保证两页观感一致 */
  function syncSkinFromHome(){
    var home = document.getElementById('cdhPage');
    var page = cddEl('cddPage');
    if (!home || !page) return;
    var keep = ['cdd-page'];
    if (page.classList.contains('show')) keep.push('show');
    var carry = [];
    ['skin-a','skin-b','skin-c','skin-d','skin-e','skin-f','custom-bg-color','custom-bg-image','on-dark','on-light'].forEach(function(cn){
      if (home.classList.contains(cn)) carry.push(cn);
    });
    page.className = keep.concat(carry).join(' ');
    var bg = home.style.getPropertyValue('--cdh-custom-bg');
    var bgi = home.style.getPropertyValue('--cdh-custom-bg-img');
    page.style.removeProperty('--cdh-custom-bg');
    page.style.removeProperty('--cdh-custom-bg-img');
    if (bg) page.style.setProperty('--cdh-custom-bg', bg);
    if (bgi) page.style.setProperty('--cdh-custom-bg-img', bgi);
  }

  /* ---- 分块渲染 ---- */

  /* 批注标记本身：一个可点击的圆形序号徽记，不再自带气泡——
     气泡由 noteInline() 生成为独立的兄弟元素，点击时在原地"长出来"，
     宽屏下由 CSS 转为贴边侧注。 */
  function noteMark(b){
    if (!b.note) return '';
    return '<span class="cdd-note-mark" data-mark="' + esc(b.note.mark) + '" tabindex="0" role="button" aria-label="查看批注">' + esc(b.note.mark) + '</span>';
  }
  function noteInline(b){
    if (!b.note) return '';
    return '<div class="cdd-note-inline" data-mark="' + esc(b.note.mark) + '">' +
      '<div class="cdd-note-inline-body">' +
        '<span class="cdd-note-inline-mark">' + esc(b.note.mark) + '</span>' +
        '<span class="cdd-note-inline-text">' + esc(b.note.text) + '</span>' +
        '<span class="cdd-note-inline-tag">MARGINALIA</span>' +
      '</div>' +
    '</div>';
  }

  function renderBlock(b, i){
    var m = noteMark(b);
    var ni = noteInline(b);
    switch (b.type){
      case 'lead':
        return '<p class="cdd-b cdd-lead">' + esc(b.text) + m + '</p>' + ni;
      case 'emph':
        return '<p class="cdd-b cdd-emph">' + esc(b.text) + m + '</p>' + ni;
      case 'quote':
        return '<figure class="cdd-b cdd-quote"><span class="cdd-quote-hook"></span>' +
          '<blockquote>' + esc(b.text) + m + '</blockquote>' +
          (b.from ? '<figcaption>' + esc(b.from) + '</figcaption>' : '') + '</figure>' + ni;
      case 'fragment':
        return '<div class="cdd-b cdd-fragment">' +
          (b.lines || []).map(function(l, k){
            return '<span class="cdd-frag-line" style="--k:' + k + '">' + esc(l) + '</span>';
          }).join('') + m + '</div>' + ni;
      case 'list':
        return '<div class="cdd-b cdd-list">' +
          (b.label ? '<span class="cdd-list-label">' + esc(b.label) + '</span>' : '') +
          '<ul>' + (b.items || []).map(function(it, k){
            return '<li><span class="cdd-li-idx">' + (CN_NUM[k + 1] || (k + 1)) + '</span><span>' + esc(it) + '</span></li>';
          }).join('') + '</ul>' + m + '</div>' + ni;
      case 'dialogue':
        return '<div class="cdd-b cdd-dialogue">' +
          (b.lines || []).map(function(l){
            return '<p class="cdd-dlg-line">' + (l.who ? '<span class="cdd-dlg-who">' + esc(l.who) + '</span>' : '') +
              '<span class="cdd-dlg-text">' + esc(l.text) + '</span></p>';
          }).join('') + m + '</div>' + ni;
      case 'aside':
        return '<aside class="cdd-b cdd-aside"><span class="cdd-aside-tick"></span>' + esc(b.text) + m + '</aside>' + ni;
      case 'scrap':
        return '<div class="cdd-b cdd-scrap" style="--tilt:' + ((hashStr((b.text || '') + i) % 5) - 2) + 'deg">' +
          '<span class="cdd-scrap-pin"></span>' +
          '<p>' + esc(b.text) + '</p>' +
          (b.caption ? '<span class="cdd-scrap-cap">' + esc(b.caption) + '</span>' : '') + m + '</div>' + ni;
      case 'strike':
        return '<p class="cdd-b cdd-strike"><s>' + esc(b.text) + '</s>' +
          (b.rewrite ? '<span class="cdd-strike-new">' + esc(b.rewrite) + '</span>' : '') + m + '</p>' + ni;
      case 'timestamp':
        return '<div class="cdd-b cdd-timestamp"><span class="cdd-ts-label">' + esc(b.label || '') + '</span>' +
          '<p>' + esc(b.text) + m + '</p></div>' + ni;
      case 'pressed':
        return '<div class="cdd-b cdd-pressed">' +
          '<span class="cdd-pressed-tag">' + esc(b.label || '夹页') + '</span>' +
          '<p>' + esc(b.text) + m + '</p></div>' + ni;
      default:
        return '<p class="cdd-b cdd-para">' + esc(b.text) + m + '</p>' + ni;
    }
  }

  function renderDetail(entry, day){
    var d = dateFromKey(day.date);
    var page = cddEl('cddPage');
    var idxInDay = (day.entries || []).findIndex(function(e){ return e.id === entry.id; });
    if (idxInDay < 0) idxInDay = 0;

    var hooks = window._LunaCharDiaryHooks || {};
    var char = hooks.getChar && hooks.getChar();

    /* 顶栏 */
    var tn = cddEl('cddTopbarName');
    if (tn) tn.textContent = (char && char.name ? char.name : 'Ta') + ' 的日记';
    var ts = cddEl('cddTopbarSub');
    if (ts) ts.textContent = day.date.replace(/-/g, ' / ') + (day.holiday ? ' · ' + day.holiday : '');
    var ti = cddEl('cddTopbarIndex');
    if (ti) ti.innerHTML = '<span>' + (CN_NUM[idxInDay + 1] || (idxInDay + 1)) + '</span>';

    /* 抬头 */
    var head = cddEl('cddHead');
    if (head){
      head.innerHTML =
        '<div class="cdd-head-day">' +
          '<span class="cdd-head-num">' + pad2(d.getDate()) + '</span>' +
          '<span class="cdd-head-stack">' +
            '<span class="cdd-head-month">' + MONTH_EN[d.getMonth()] + ' ' + d.getFullYear() + '</span>' +
            '<span class="cdd-head-week">' + WEEKDAY_CN[d.getDay()] + (day.holiday ? ' · ' + day.holiday : '') + '</span>' +
          '</span>' +
        '</div>' +
        '<h1 class="cdd-head-title">' + esc(entry.title) + '</h1>' +
        '<div class="cdd-head-meta">' +
          '<span class="cdd-hm cdd-hm-mood" data-mood="' + entry.mood + '">' + (MOOD_GLYPH[entry.mood] || '') + '<em>' + (MOOD_LABEL[entry.mood] || '') + '</em></span>' +
          (entry.weather ? '<span class="cdd-hm">' + esc(entry.weather) + '</span>' : '') +
          (entry.place ? '<span class="cdd-hm">' + esc(entry.place) + '</span>' : '') +
          '<span class="cdd-hm">' + esc(entry.time) + ' 落笔</span>' +
          '<span class="cdd-hm">' + entry.wordCount + ' 字</span>' +
        '</div>';
    }

    /* 正文 */
    var canvas = cddEl('cddCanvas');
    var noteList = (entry.blocks || []).filter(function(b){ return b.note; }).map(function(b){ return b.note; });
    if (canvas){
      canvas.className = 'cdd-canvas cdd-' + (entry.layout || 'lay-a') + (noteList.length ? ' has-notes' : '');
      canvas.innerHTML = (entry.blocks || []).map(renderBlock).join('') +
        (entry.signature ? '<div class="cdd-sign"><span>' + esc(entry.signature) + '</span></div>' : '');
    }

    /* 批注库：汇总回顾用，点击可跳回正文对应位置并展开 */
    var notes = cddEl('cddNotes');
    if (notes){
      if (noteList.length){
        notes.hidden = false;
        notes.innerHTML =
          '<div class="cdd-notes-eyebrow"><span class="cdn-cn">批注库</span><span class="cdn-en">MARGINALIA · ' + noteList.length + '</span></div>' +
          '<div class="cdd-notes-list">' + noteList.map(function(n, i){
            return '<div class="cdd-note" data-mark="' + esc(n.mark) + '">' +
              '<span class="cdd-note-idx">' + esc(n.mark) + '</span>' +
              '<span class="cdd-note-text">' + esc(n.text) + '</span>' +
            '</div>';
          }).join('') + '</div>';
      }else{
        notes.hidden = true; notes.innerHTML = '';
      }
    }

    /* 同一天的其他篇 */
    var sib = cddEl('cddSiblings');
    if (sib){
      var others = (day.entries || []).filter(function(e){ return e.id !== entry.id; });
      if (others.length){
        sib.hidden = false;
        sib.innerHTML = '<div class="cdd-sib-eyebrow">同一天的其他落笔</div>' +
          '<div class="cdd-sib-row">' + others.map(function(e){
            return '<button type="button" class="cdd-sib" data-entry-id="' + e.id + '">' +
              '<span class="cdd-sib-time">' + esc(e.time) + '</span>' +
              '<span class="cdd-sib-title">' + esc(e.title) + '</span>' +
              '<span class="cdd-sib-ex">' + esc(e.excerpt) + '</span>' +
            '</button>';
          }).join('') + '</div>';
      }else{
        sib.hidden = true; sib.innerHTML = '';
      }
    }

    /* 四道仪式：回到收起态，并重画已有结果 */
    document.querySelectorAll('#cddRituals .cdr-item').forEach(function(it){ it.classList.remove('open'); });
    paintRitual('echo');
    paintRitual('hands');
    paintRitual('butterfly');
    paintRitual('reflux');

    if (page) page.setAttribute('data-mood', entry.mood);
    var scroll = cddEl('cddScroll');
    if (scroll) scroll.scrollTop = 0;
    updateProgress();
  }

  window.openCharEntryDetail = function(charId, dateKey, entryId){
    var day = getDaySync(charId, dateKey);
    if (!day) return;
    var entry = (day.entries || []).filter(function(e){ return e.id === entryId; })[0] || day.entries[0];
    if (!entry) return;
    detail = { charId: String(charId), dateKey: dateKey, entryId: entry.id, entry: entry, day: day };

    syncSkinFromHome();
    renderDetail(entry, day);

    var veil = cddEl('cddVeil'), page = cddEl('cddPage');
    if (veil) veil.classList.add('show');
    if (page){
      page.classList.add('show');
      page.setAttribute('aria-hidden', 'false');
    }
    document.body.style.overflow = 'hidden';
  };

  function closeDetail(){
    var veil = cddEl('cddVeil'), page = cddEl('cddPage');
    var active = document.activeElement;
    if (page && active && page.contains(active)) active.blur();
    if (veil) veil.classList.remove('show');
    if (page){
      page.classList.remove('show');
      page.setAttribute('aria-hidden', 'true');
    }
    /* 详情页关闭后回到角色主页，主页仍是滚动锁定状态 */
    document.body.style.overflow = 'hidden';
  }

  function updateProgress(){
    var scroll = cddEl('cddScroll');
    var bar = cddEl('cddProgress');
    if (!scroll || !bar) return;
    var max = scroll.scrollHeight - scroll.clientHeight;
    var p = max > 0 ? Math.min(1, scroll.scrollTop / max) : 0;
    var i = bar.querySelector('i');
    if (i) i.style.transform = 'scaleX(' + p.toFixed(4) + ')';
  }

  /* 保存当前条目（仪式结果写回） */
  function persistDetail(){
    if (!detail.day) return Promise.resolve();
    var idx = detail.day.entries.findIndex(function(e){ return e.id === detail.entry.id; });
    if (idx >= 0) detail.day.entries[idx] = detail.entry;
    detail.day.updatedAt = Date.now();
    return saveDay(detail.day);
  }

  /* ================================================================
     8 · 四道仪式
  ================================================================ */
  function ritualBox(id){ return document.getElementById(id); }
  var RITUAL_BOX = { echo: 'cdrEcho', hands: 'cdrHands', butterfly: 'cdrButterfly', reflux: 'cdrReflux' };

  function loadingHtml(text){
    return '<div class="cdr-loading"><span class="cdr-load-ink"></span><span>' + esc(text) + '</span></div>';
  }
  function errorHtml(msg){
    return '<div class="cdr-error"><span class="cdr-error-title">这一次没能完成</span>' +
      '<span class="cdr-error-msg">' + esc(msg) + '</span>' +
      '<button type="button" class="cdr-retry">再试一次</button></div>';
  }

  /* ---- 壹 · 回响传送门：在这本日记里找出与本篇共振的旧日子 ---- */
  function computeEchoes(){
    var all = allDaysOf(detail.charId);
    var cur = detail.entry;
    var curText = (cur.blocks || []).map(function(b){ return b.text || ''; }).join('');
    var grams = {};
    (curText.match(/[\u4e00-\u9fa5]{2}/g) || []).forEach(function(g){ grams[g] = 1; });

    var out = [];
    all.forEach(function(day){
      (day.entries || []).forEach(function(e){
        if (e.id === cur.id) return;
        var t = (e.blocks || []).map(function(b){ return b.text || ''; }).join('');
        var gs = t.match(/[\u4e00-\u9fa5]{2}/g) || [];
        var hit = 0, seen = {};
        gs.forEach(function(g){ if (grams[g] && !seen[g]){ seen[g] = 1; hit++; } });
        var score = hit + (e.mood === cur.mood ? 26 : 0);
        var gap = Math.abs(dateFromKey(day.date) - dateFromKey(detail.dateKey)) / 86400000;
        out.push({ day: day, entry: e, score: score, gap: Math.round(gap) });
      });
    });
    out.sort(function(a, b){ return b.score - a.score; });
    return out.slice(0, 4);
  }

  function paintEcho(){
    var box = ritualBox('cdrEcho');
    if (!box) return;
    var list = computeEchoes();
    if (!list.length){
      box.innerHTML = '<div class="cdr-empty">这本日记里暂时只有这一页。多写下几天，回响才会有落点。</div>';
      return;
    }
    box.innerHTML = '<div class="cdr-echo-intro">与这一篇共振最强的四个旧日子，按情绪与用词的重合度排。</div>' +
      '<div class="cdr-echo-list">' + list.map(function(it, i){
        var d = dateFromKey(it.day.date);
        return '<button type="button" class="cdr-echo" style="--k:' + i + '" data-date="' + it.day.date + '" data-entry="' + it.entry.id + '">' +
          '<span class="cdr-echo-ring"><span class="cdr-echo-strength" style="--s:' + Math.min(1, it.score / 80).toFixed(2) + '"></span></span>' +
          '<span class="cdr-echo-body">' +
            '<span class="cdr-echo-date">' + d.getFullYear() + ' · ' + MONTH_CN[d.getMonth()] + d.getDate() + '日</span>' +
            '<span class="cdr-echo-title">' + esc(it.entry.title) + '</span>' +
            '<span class="cdr-echo-ex">' + esc(it.entry.excerpt) + '</span>' +
          '</span>' +
          '<span class="cdr-echo-gap">' + (it.gap === 0 ? '同日' : (it.gap + ' 天前后')) + '</span>' +
        '</button>';
      }).join('') + '</div>';
  }

  /* ---- 贰 · 多重笔迹：同一段话的三种写法 ---- */
  function paintHands(){
    var box = ritualBox('cdrHands');
    if (!box) return;
    var saved = detail.entry.rituals && detail.entry.rituals.hands;
    var paras = (detail.entry.blocks || []).filter(function(b){
      return (b.type === 'para' || b.type === 'lead') && textLen(b.text) > 24;
    }).slice(0, 4);

    if (!paras.length){
      box.innerHTML = '<div class="cdr-empty">这一篇没有足够长的段落可供重写。</div>';
      return;
    }
    var chooser = '<div class="cdr-hands-pick">' +
      '<span class="cdr-mini-eyebrow">选一段，让 Ta 换一种笔迹重写</span>' +
      paras.map(function(p, i){
        return '<button type="button" class="cdr-hand-src' + (saved && saved.srcIndex === i ? ' is-on' : '') + '" data-idx="' + i + '">' +
          '<span class="cdr-hand-num">' + (CN_NUM[i + 1]) + '</span>' +
          '<span class="cdr-hand-text">' + esc(String(p.text).slice(0, 48)) + '…</span>' +
        '</button>';
      }).join('') + '</div>';

    var result = '';
    if (saved && saved.variants && saved.variants.length){
      result = '<div class="cdr-hands-out">' + saved.variants.map(function(v, i){
        return '<div class="cdr-hand-var" style="--k:' + i + '">' +
          '<span class="cdr-hand-label">' + esc(v.label) + '</span>' +
          '<p class="cdr-hand-body">' + esc(v.text) + '</p>' +
        '</div>';
      }).join('') + '</div>';
    }
    box.innerHTML = chooser + result;
  }

  function runHands(idx){
    var box = ritualBox('cdrHands');
    var paras = (detail.entry.blocks || []).filter(function(b){
      return (b.type === 'para' || b.type === 'lead') && textLen(b.text) > 24;
    }).slice(0, 4);
    var src = paras[idx];
    if (!src || !box) return;
    var hooks = window._LunaCharDiaryHooks || {};
    var char = hooks.getChar && hooks.getChar();
    if (!char) return;

    box.insertAdjacentHTML('beforeend', loadingHtml('换一种笔迹重写中'));
    loadBoundIdentity(char.id).then(function(identity){
      var msgs = [
        { role: 'system', content: '你在扮演下面这个角色，替 Ta 重写自己日记里的一段话。禁止 OOC，禁止 emoji，禁止解释。\n\n【人设】\n' + personaText(char) + '\n\n' + relationText(char, identity) + '\n\n' + boundaryText(char) + '\n\n【口吻】\n' + ageTone(char) },
        { role: 'user', content: '这是 ' + detail.dateKey + ' 那篇日记《' + detail.entry.title + '》里的一段：\n\n' + src.text +
          '\n\n请给出三种不同笔迹的重写，每种 120~200 字，内容事实一致但写法与坦白程度不同：\n' +
          '1）"更诚实的那版"——把当时压下去没写的部分写出来；\n' +
          '2）"给别人看的那版"——如果知道有人会读到，会怎么修饰；\n' +
          '3）"很久以后的那版"——多年后回头，用当时不可能有的距离感重写。\n\n' +
          '只输出 JSON：{"variants":[{"label":"更诚实的那版","text":"..."},{"label":"给别人看的那版","text":"..."},{"label":"很久以后的那版","text":"..."}]}' }
      ];
      return callModel(msgs, { temperature: 0.98, maxTokens: 2600 });
    }).then(function(t){
      var data = parseJSON(t);
      var vs = (data.variants || []).slice(0, 3).map(function(v){
        return { label: String(v.label || '另一种笔迹').slice(0, 12), text: String(v.text || '') };
      }).filter(function(v){ return v.text; });
      if (!vs.length) throw new Error('模型没有给出可用的重写。');
      detail.entry.rituals = detail.entry.rituals || {};
      detail.entry.rituals.hands = { srcIndex: idx, variants: vs };
      persistDetail();
      paintHands();
    }).catch(function(err){
      var l = box.querySelector('.cdr-loading');
      if (l) l.outerHTML = errorHtml((err && err.message) || '请稍后再试');
    });
  }

  /* ---- 叁 · 蝴蝶效应 ---- */
  function paintButterfly(){
    var box = ritualBox('cdrButterfly');
    if (!box) return;
    var saved = detail.entry.rituals && detail.entry.rituals.butterfly;
    if (!saved){
      box.innerHTML = '<div class="cdr-invite">' +
        '<p class="cdr-invite-text">如果这一天里有一件小事换了个方向，后面的日子会怎样偏移。</p>' +
        '<button type="button" class="cdr-invite-act" data-act="butterfly">推演三条支流</button>' +
      '</div>';
      return;
    }
    box.innerHTML = '<div class="cdr-bf-list">' + saved.branches.map(function(b, i){
      return '<div class="cdr-bf" style="--k:' + i + '">' +
        '<div class="cdr-bf-head"><span class="cdr-bf-idx">' + (CN_NUM[i + 1]) + '</span><span class="cdr-bf-change">' + esc(b.change) + '</span></div>' +
        '<p class="cdr-bf-immediate">' + esc(b.immediate) + '</p>' +
        '<div class="cdr-bf-ripple">' + (b.ripple || []).map(function(r, k){
          return '<div class="cdr-ripple" style="--k:' + k + '">' +
            '<span class="cdr-ripple-when">' + esc(r.when) + '</span>' +
            '<span class="cdr-ripple-what">' + esc(r.what) + '</span>' +
          '</div>';
        }).join('') + '</div>' +
      '</div>';
    }).join('') + '</div><button type="button" class="cdr-again" data-act="butterfly">换一组推演</button>';
  }

  function runButterfly(){
    var box = ritualBox('cdrButterfly');
    var hooks = window._LunaCharDiaryHooks || {};
    var char = hooks.getChar && hooks.getChar();
    if (!box || !char) return;
    box.innerHTML = loadingHtml('推演三条支流');
    var full = (detail.entry.blocks || []).map(function(b){ return b.text || (b.lines || []).map(function(l){ return l.text || l; }).join(' '); }).join('\n').slice(0, 2200);

    loadBoundIdentity(char.id).then(function(identity){
      var msgs = [
        { role: 'system', content: '你在扮演下面这个角色，为 Ta 的一篇日记做"如果当天某件小事不同"的推演。所有推演都必须由日记里真实出现过的细节出发，不得引入人设之外的人物或能力。禁止 OOC，禁止 emoji。\n\n【人设】\n' + personaText(char) + '\n\n' + relationText(char, identity) + '\n\n' + boundaryText(char) },
        { role: 'user', content: detail.dateKey + ' 的日记《' + detail.entry.title + '》正文：\n\n' + full +
          '\n\n请挑出这一天里三件真实写到过的小事，各自设想它换了一个方向，并推演涟漪。' +
          '每条的 change 不超过 20 字，immediate 60~90 字（当天立刻发生的变化，第一人称），ripple 三段分别对应"几天后""几个月后""很久以后"，每段 what 30~50 字。' +
          '\n只输出 JSON：{"branches":[{"change":"...","immediate":"...","ripple":[{"when":"几天后","what":"..."},{"when":"几个月后","what":"..."},{"when":"很久以后","what":"..."}]}]}' }
      ];
      return callModel(msgs, { temperature: 1.0, maxTokens: 3000 });
    }).then(function(t){
      var data = parseJSON(t);
      var branches = (data.branches || []).slice(0, 3).map(function(b){
        return {
          change: String(b.change || '').slice(0, 30),
          immediate: String(b.immediate || ''),
          ripple: (b.ripple || []).slice(0, 3).map(function(r){
            return { when: String(r.when || '').slice(0, 8), what: String(r.what || '') };
          })
        };
      }).filter(function(b){ return b.change && b.immediate; });
      if (!branches.length) throw new Error('模型没有给出可用的推演。');
      detail.entry.rituals = detail.entry.rituals || {};
      detail.entry.rituals.butterfly = { branches: branches, at: Date.now() };
      persistDetail();
      paintButterfly();
    }).catch(function(err){
      box.innerHTML = errorHtml((err && err.message) || '请稍后再试');
    });
  }

  /* ---- 肆 · 时光回流 ---- */
  var REFLUX_STEPS = [
    { key: 'm1', label: '一个月后', days: 30 },
    { key: 'y1', label: '一年后', days: 365 },
    { key: 'y5', label: '很多年后', days: 1825 }
  ];

  function paintReflux(){
    var box = ritualBox('cdrReflux');
    if (!box) return;
    var saved = (detail.entry.rituals && detail.entry.rituals.reflux) || {};
    var dial = '<div class="cdr-rf-dial">' + REFLUX_STEPS.map(function(s){
      return '<button type="button" class="cdr-rf-step' + (saved[s.key] ? ' has' : '') + '" data-step="' + s.key + '">' +
        '<span class="cdr-rf-dot"></span><span class="cdr-rf-label">' + s.label + '</span>' +
      '</button>';
    }).join('') + '<span class="cdr-rf-thread"></span></div>';

    var written = REFLUX_STEPS.filter(function(s){ return saved[s.key]; }).map(function(s, i){
      var rec = saved[s.key];
      var d = new Date(dateFromKey(detail.dateKey).getTime() + s.days * 86400000);
      return '<div class="cdr-rf-note" style="--k:' + i + '">' +
        '<div class="cdr-rf-note-head">' +
          '<span class="cdr-rf-when">' + s.label + '</span>' +
          '<span class="cdr-rf-date">' + d.getFullYear() + '.' + pad2(d.getMonth() + 1) + '.' + pad2(d.getDate()) + '</span>' +
        '</div>' +
        '<p class="cdr-rf-text">' + esc(rec.text) + '</p>' +
      '</div>';
    }).join('');

    box.innerHTML = '<div class="cdr-mini-eyebrow">让 Ta 在更远的地方，重读这一页</div>' + dial +
      (written || '<div class="cdr-empty">还没有任何一次回望。挑一个时间点。</div>');
  }

  function runReflux(stepKey){
    var step = REFLUX_STEPS.filter(function(s){ return s.key === stepKey; })[0];
    var box = ritualBox('cdrReflux');
    var hooks = window._LunaCharDiaryHooks || {};
    var char = hooks.getChar && hooks.getChar();
    if (!step || !box || !char) return;
    box.insertAdjacentHTML('beforeend', loadingHtml(step.label + '，Ta 正在重读'));
    var full = (detail.entry.blocks || []).map(function(b){ return b.text || ''; }).join('\n').slice(0, 2200);
    var future = new Date(dateFromKey(detail.dateKey).getTime() + step.days * 86400000);

    loadBoundIdentity(char.id).then(function(identity){
      var msgs = [
        { role: 'system', content: '你在扮演下面这个角色。禁止 OOC，禁止 emoji，禁止解释与旁白。\n\n【人设】\n' + personaText(char) + '\n\n' + relationText(char, identity) + '\n\n' + boundaryText(char) + '\n\n【口吻】\n' + ageTone(char) },
        { role: 'user', content: '角色在 ' + detail.dateKey + ' 写过这篇日记《' + detail.entry.title + '》：\n\n' + full +
          '\n\n现在是 ' + future.getFullYear() + ' 年 ' + (future.getMonth() + 1) + ' 月 ' + future.getDate() + ' 日（' + step.label + '），Ta 偶然翻回这一页重读。' +
          '请写下 Ta 补在这一页末尾的一段字：180~260 字，第一人称，要提到这段时间里发生的一个具体变化，并对当时的自己给出一个不客套的判断（可以是心软、可以是嫌弃）。' +
          '\n只输出 JSON：{"text":"..."}' }
      ];
      return callModel(msgs, { temperature: 0.98, maxTokens: 1400 });
    }).then(function(t){
      var data = parseJSON(t);
      var text = String(data.text || '').trim();
      if (!text) throw new Error('模型没有写出回望。');
      detail.entry.rituals = detail.entry.rituals || {};
      detail.entry.rituals.reflux = detail.entry.rituals.reflux || {};
      detail.entry.rituals.reflux[step.key] = { text: text, at: Date.now() };
      persistDetail();
      paintReflux();
    }).catch(function(err){
      var l = box.querySelector('.cdr-loading');
      if (l) l.outerHTML = errorHtml((err && err.message) || '请稍后再试');
    });
  }

  function paintRitual(name){
    if (!detail.entry) return;
    if (name === 'echo') paintEcho();
    else if (name === 'hands') paintHands();
    else if (name === 'butterfly') paintButterfly();
    else if (name === 'reflux') paintReflux();
  }

  /* ================================================================
     9 · 详情页事件绑定
  ================================================================ */
  document.addEventListener('DOMContentLoaded', function(){

    var back = cddEl('cddBackBtn');
    if (back) back.addEventListener('click', function(){ vibrate(5); closeDetail(); });
    var veil = cddEl('cddVeil');
    if (veil) veil.addEventListener('click', closeDetail);

    var scroll = cddEl('cddScroll');
    if (scroll) scroll.addEventListener('scroll', updateProgress, { passive: true });

    /* 正文批注标记：点击在本块正下方"长出"批注（宽屏下转为贴边侧注），
       再次点击同一枚或点击其它枚都会收起当前展开的那一条 */
    var canvas = cddEl('cddCanvas');
    function closeAllInlineNotes(exceptMark){
      if (!canvas) return;
      canvas.querySelectorAll('.cdd-note-mark.is-open').forEach(function(o){
        if (o.getAttribute('data-mark') !== exceptMark) o.classList.remove('is-open');
      });
      canvas.querySelectorAll('.cdd-note-inline.is-open').forEach(function(o){
        if (o.getAttribute('data-mark') !== exceptMark) o.classList.remove('is-open');
      });
    }
    function openInlineNote(mark){
      if (!canvas) return;
      var mk = canvas.querySelector('.cdd-note-mark[data-mark="' + mark + '"]');
      var panel = canvas.querySelector('.cdd-note-inline[data-mark="' + mark + '"]');
      closeAllInlineNotes(mark);
      if (mk) mk.classList.add('is-open');
      if (panel) panel.classList.add('is-open');
      var libTarget = document.querySelector('.cdd-note[data-mark="' + mark + '"]');
      if (libTarget){
        libTarget.classList.add('is-lit');
        setTimeout(function(){ libTarget.classList.remove('is-lit'); }, 2200);
      }
    }
    if (canvas){
      canvas.addEventListener('click', function(e){
        var mk = e.target.closest ? e.target.closest('.cdd-note-mark') : null;
        if (!mk) return;
        vibrate(4);
        var mark = mk.getAttribute('data-mark');
        var wasOpen = mk.classList.contains('is-open');
        if (wasOpen){
          closeAllInlineNotes(null);
        }else{
          openInlineNote(mark);
        }
      });
    }

    /* 批注库卡片：点击跳回正文对应位置并原地展开 */
    var notesLib = cddEl('cddNotes');
    if (notesLib){
      notesLib.addEventListener('click', function(e){
        var card = e.target.closest ? e.target.closest('.cdd-note') : null;
        if (!card) return;
        vibrate(4);
        var mark = card.getAttribute('data-mark');
        var mk = canvas && canvas.querySelector('.cdd-note-mark[data-mark="' + mark + '"]');
        if (mk){
          openInlineNote(mark);
          mk.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }

    /* 同日其他篇：原地切换 */
    var sib = cddEl('cddSiblings');
    if (sib){
      sib.addEventListener('click', function(e){
        var btn = e.target.closest ? e.target.closest('.cdd-sib') : null;
        if (!btn) return;
        vibrate(5);
        window.openCharEntryDetail(detail.charId, detail.dateKey, btn.getAttribute('data-entry-id'));
      });
    }

    /* 四道仪式：展开 / 收起 + 各自的动作 */
    var rituals = cddEl('cddRituals');
    if (rituals){
      rituals.addEventListener('click', function(e){
        var head = e.target.closest ? e.target.closest('.cdr-head') : null;
        if (head){
          var item = head.parentElement;
          var opening = !item.classList.contains('open');
          rituals.querySelectorAll('.cdr-item.open').forEach(function(it){ if (it !== item) it.classList.remove('open'); });
          item.classList.toggle('open', opening);
          vibrate(6);
          if (opening) paintRitual(item.getAttribute('data-ritual'));
          return;
        }

        var echo = e.target.closest ? e.target.closest('.cdr-echo') : null;
        if (echo){
          vibrate(6);
          window.openCharEntryDetail(detail.charId, echo.getAttribute('data-date'), echo.getAttribute('data-entry'));
          return;
        }

        var hand = e.target.closest ? e.target.closest('.cdr-hand-src') : null;
        if (hand){ vibrate(5); runHands(parseInt(hand.getAttribute('data-idx'), 10)); return; }

        var act = e.target.closest ? e.target.closest('[data-act="butterfly"]') : null;
        if (act){ vibrate(6); runButterfly(); return; }

        var step = e.target.closest ? e.target.closest('.cdr-rf-step') : null;
        if (step){ vibrate(5); runReflux(step.getAttribute('data-step')); return; }

        var retry = e.target.closest ? e.target.closest('.cdr-retry') : null;
        if (retry){
          var box = retry.closest('.cdr-body-inner');
          var item2 = retry.closest('.cdr-item');
          if (box && item2) paintRitual(item2.getAttribute('data-ritual'));
          return;
        }
      });

      rituals.addEventListener('keydown', function(e){
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var head = e.target.closest ? e.target.closest('.cdr-head') : null;
        if (!head) return;
        e.preventDefault();
        head.click();
      });
    }

    /* 详情页状态栏：时间与电量（与主页保持一致的读数） */
    function tick(){
      var t = cddEl('cddStatusTime');
      if (t){
        var now = new Date();
        var h = now.getHours(), mm = pad2(now.getMinutes());
        t.textContent = h + ':' + mm;
      }
    }
    tick();
    setInterval(tick, 20000);

    function battery(){
      var pct = cddEl('cddBatPct'), inner = cddEl('cddBatInner');
      var src = document.getElementById('cdhBatPct');
      if (!pct || !inner) return;
      var v = src ? parseInt(src.textContent, 10) : 76;
      if (!v || isNaN(v)) v = 76;
      pct.textContent = v;
      inner.style.width = Math.max(6, Math.min(100, v)) + '%';
    }
    battery();
    setInterval(battery, 30000);
  });

  /* ================================================================
     10 · 对外接口
  ================================================================ */
  /* 打开某个角色主页时：读缓存 + 把落笔仪式条复位到"今天" */
  function preloadAndReset(charId){
    return preload(charId).then(function(map){
      var hooks = window._LunaCharDiaryHooks || {};
      var key = (hooks.getSelectedKey && hooks.getSelectedKey()) || keyOf(new Date());
      selectedKey = key;
      refreshQuillFor(key, hooks.getChar && hooks.getChar());
      return map;
    });
  }

  window._LunaCharDiaryAI = {
    preload: preloadAndReset,
    getDaySync: getDaySync,
    onCalSelect: onCalSelect,
    generateForDay: generateForDay,
    allDaysOf: allDaysOf
  };

})();