/* ==================================================================
   private.js —— 日记 App · 「私密」板块
   ------------------------------------------------------------------
   两个板块：
     · 角色（char）    —— 每个角色写在日记本之外的秘密。选中角色后
                          按日期生成，只生成该角色的内容与评论。
     · 陌生人（stranger）—— 随机 NPC 的秘密，昵称、身份、文风全部由
                          模型按用户的「文风配置」生成。

   与 Char 日记的区别（写进 prompt 的硬约定）：
     · Char 日记是写给自己的；这里是发在一个小社区里的，会被别人看到，
       因此有分寸感、有对读者的意识、有欲言又止。
     · 这里更像随笔 / 小纸条 / 深夜树洞，而不是完整的一天流水账。
     · 角色板块的内容必须大量牵涉「用户」——角色是用户创造的，
       用户是 Ta 世界的重心，秘密几乎都与之相关（若未绑定身份则依
       角色卡上的关系记忆写，绝不虚构一个具体的人）。

   所有内容（正文 / 昵称 / 评论 / 转发 / 点赞名单）一律实时调用模型生成，
   文件内不写死任何一条成品文案。
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
  function keyOf(d){ return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function dateFromKey(k){ var p = String(k).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function vibrate(ms){ if (navigator.vibrate){ try{ navigator.vibrate(ms); }catch(e){} } }
  function textLen(s){ return String(s || '').replace(/\s/g, '').length; }
  function hashStr(str){
    var h = 5381;
    str = String(str);
    for (var i = 0; i < str.length; i++){ h = ((h << 5) + h) + str.charCodeAt(i); h = h & 0xffffffff; }
    h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
    h = Math.imul(h, 3266489917); h ^= h >>> 16;
    return Math.abs(h);
  }
  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

  var WEEKDAY_CN = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
  var MONTH_CN = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
  var MONTH_EN = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];

  /* 节日表：与 Char 日记共用同一套真实日期，日历里会标出来，
     并且会真实影响生成内容（节日当天的社区氛围完全不同） */
  var HOLIDAYS = {
    '2025-01-01':'元旦','2025-01-28':'除夕','2025-01-29':'春节','2025-01-30':'春节',
    '2025-02-14':'情人节','2025-03-08':'妇女节','2025-04-04':'清明节','2025-05-01':'劳动节',
    '2025-05-31':'端午节','2025-06-01':'儿童节','2025-08-29':'七夕节','2025-09-06':'中秋节',
    '2025-09-10':'教师节','2025-10-01':'国庆节','2025-10-31':'万圣夜','2025-11-11':'双十一',
    '2025-12-24':'平安夜','2025-12-25':'圣诞节','2025-12-31':'跨年夜',
    '2026-01-01':'元旦','2026-02-14':'情人节','2026-02-16':'除夕','2026-02-17':'春节',
    '2026-02-18':'春节','2026-03-08':'妇女节','2026-04-04':'清明节','2026-04-05':'清明节',
    '2026-05-01':'劳动节','2026-05-10':'母亲节','2026-06-01':'儿童节','2026-06-19':'端午节',
    '2026-06-21':'父亲节','2026-08-19':'七夕节','2026-09-10':'教师节','2026-09-25':'中秋节',
    '2026-10-01':'国庆节','2026-10-02':'国庆节','2026-10-03':'国庆节','2026-10-31':'万圣夜',
    '2026-11-11':'双十一','2026-12-24':'平安夜','2026-12-25':'圣诞节','2026-12-31':'跨年夜',
    '2027-01-01':'元旦','2027-02-06':'除夕','2027-02-07':'春节','2027-02-08':'春节',
    '2027-02-14':'情人节','2027-04-04':'清明节','2027-05-01':'劳动节','2027-06-09':'端午节',
    '2027-08-08':'七夕节','2027-09-15':'中秋节','2027-10-01':'国庆节','2027-12-25':'圣诞节'
  };
  function holidayOf(k){ return HOLIDAYS[k] || ''; }
  function seasonOf(m){
    if (m <= 1 || m === 11) return '冬';
    if (m <= 4) return '春';
    if (m <= 7) return '夏';
    return '秋';
  }
  /* 除了法定节日，也给模型一点"日子本身的质地"：月初/月末/周末/深夜 */
  function dayTexture(d){
    var t = [];
    var day = d.getDate();
    var wd = d.getDay();
    if (day <= 3) t.push('月初');
    if (day >= 27) t.push('月末');
    if (wd === 0 || wd === 6) t.push('周末');
    if (wd === 1) t.push('周一');
    if (wd === 5) t.push('周五夜');
    return t.join(' · ');
  }

  /* ================================================================
     1 · 数据层 · IndexedDB: LunaPrivateDB
        posts  —— 一条动态（角色秘密 / 陌生人秘密）
        kv     —— 用户资料 / 文风配置 / 预设存档 / 主题 / 收藏索引
  ================================================================ */
  var DB_NAME = 'LunaPrivateDB', DB_VER = 1;
  var S_POST = 'posts', S_KV = 'kv';
  var _db = null;

  function openDB(){
    return new Promise(function(resolve, reject){
      if (_db) return resolve(_db);
      try{
        var req = indexedDB.open(DB_NAME, DB_VER);
        req.onupgradeneeded = function(e){
          var db = e.target.result;
          if (!db.objectStoreNames.contains(S_POST)){
            var st = db.createObjectStore(S_POST, { keyPath: 'id' });
            st.createIndex('board', 'board', { unique: false });
            st.createIndex('date', 'date', { unique: false });
            st.createIndex('charId', 'charId', { unique: false });
          }
          if (!db.objectStoreNames.contains(S_KV)){
            db.createObjectStore(S_KV, { keyPath: 'k' });
          }
        };
        req.onsuccess = function(e){ _db = e.target.result; resolve(_db); };
        req.onerror = function(e){ reject(e); };
      }catch(err){ reject(err); }
    });
  }

  function kvGet(k, dflt){
    return openDB().then(function(db){
      return new Promise(function(res){
        try{
          var r = db.transaction(S_KV).objectStore(S_KV).get(k);
          r.onsuccess = function(){ res(r.result ? r.result.v : dflt); };
          r.onerror = function(){ res(dflt); };
        }catch(e){ res(dflt); }
      });
    }).catch(function(){ return dflt; });
  }
  function kvSet(k, v){
    return openDB().then(function(db){
      return new Promise(function(res){
        try{
          var tx = db.transaction(S_KV, 'readwrite');
          tx.objectStore(S_KV).put({ k: k, v: v });
          tx.oncomplete = function(){ res(true); };
          tx.onerror = function(){ res(false); };
        }catch(e){ res(false); }
      });
    }).catch(function(){ return false; });
  }
  function putPost(p){
    postCache[p.id] = p;
    return openDB().then(function(db){
      return new Promise(function(res){
        try{
          var tx = db.transaction(S_POST, 'readwrite');
          tx.objectStore(S_POST).put(p);
          tx.oncomplete = function(){ res(true); };
          tx.onerror = function(){ res(false); };
        }catch(e){ res(false); }
      });
    }).catch(function(){ return false; });
  }
  function delPost(id){
    delete postCache[id];
    return openDB().then(function(db){
      return new Promise(function(res){
        try{
          var tx = db.transaction(S_POST, 'readwrite');
          tx.objectStore(S_POST).delete(id);
          tx.oncomplete = function(){ res(true); };
          tx.onerror = function(){ res(false); };
        }catch(e){ res(false); }
      });
    }).catch(function(){ return false; });
  }
  function allPosts(){
    return openDB().then(function(db){
      return new Promise(function(res){
        try{
          var r = db.transaction(S_POST).objectStore(S_POST).getAll();
          r.onsuccess = function(){ res(r.result || []); };
          r.onerror = function(){ res([]); };
        }catch(e){ res([]); }
      });
    }).catch(function(){ return []; });
  }

  var postCache = {};   /* id -> post */
  var postsLoaded = false;

  function loadAll(){
    if (postsLoaded) return Promise.resolve(Object.keys(postCache).map(function(k){ return postCache[k]; }));
    return allPosts().then(function(list){
      list.forEach(function(p){ postCache[p.id] = p; });
      postsLoaded = true;
      return list;
    });
  }
  function postsBy(filter){
    return Object.keys(postCache).map(function(k){ return postCache[k]; })
      .filter(filter)
      .sort(function(a, b){
        if (a.date === b.date) return (b.createdAt || 0) - (a.createdAt || 0);
        return a.date < b.date ? 1 : -1;
      });
  }

  /* ================================================================
     2 · 用户资料 / 文风配置 / 主题
  ================================================================ */
  var DEFAULT_PROFILE = {
    name: '', handle: '', bio: '', avatar: '', tags: [], accent: 'lilac', createdAt: 0
  };

  var DEFAULT_CFG = {
    /* —— 文笔 —— */
    voice: '细腻文艺',            /* 文笔风格 */
    voiceCustom: '',
    density: 2,                   /* 情绪浓度 1~4 */
    length: '600-900',            /* 篇幅区间 */
    person: '第一人称',           /* 人称 */
    era: '当代',                  /* 时代/背景 */
    /* —— 题材 —— */
    topics: ['深夜情绪', '都市观察'],
    topicCustom: '',
    /* —— 陌生人生成 —— */
    ageRange: '不限',
    region: '不限',
    jobStyle: '不限',
    nickStyle: '网感中文',        /* 昵称风格 */
    nickCustom: '',
    strangerCount: 3,
    /* —— 社区氛围 —— */
    commentMood: '温柔共情',
    commentCount: 4,
    allowMentionUser: true,       /* 陌生人内容里是否可能出现"用户"这个路人 */
    /* —— 自定义补充 —— */
    extra: ''
  };

  var VOICE_OPTS = ['细腻文艺','冷淡克制','锋利尖锐','幽默毒舌','口语碎碎念','古典雅致','病态浪漫','日式物哀'];
  var LEN_OPTS = ['500-700','600-900','900-1300','1300 以上'];
  var PERSON_OPTS = ['第一人称','第二人称自述','半自白半对话'];
  var ERA_OPTS = ['当代','千禧年代','八九十年代','架空未来','古典/民国','随角色设定'];
  var TOPIC_OPTS = ['深夜情绪','都市观察','恋爱暧昧','分手余震','职场','校园','旅行漂泊','宠物','家庭','病气与治愈','失眠','自我怀疑','旧友重逢','搬家与告别'];
  var AGE_OPTS = ['不限','学生（16-22）','初入社会（23-28）','而立（29-38）','中年（39-55）','年长（56+）'];
  var REGION_OPTS = ['不限','一线城市','小城/县城','海外留学','南方湿冷','北方风大','海边小镇'];
  var JOB_OPTS = ['不限','创意/设计','互联网','医护','教师','餐饮零售','自由职业','待业/间隙期','学生'];
  var NICK_OPTS = ['网感中文','文艺英文','符号系','中二热血','极简两字','拼音缩写','丧系'];
  var CMOOD_OPTS = ['温柔共情','热闹起哄','清冷疏离','毒舌互怼','文青对句','半懂不懂的关心'];

  var THEMES = [
    { id: 'moon',  name: '月白',  sub: 'MOONLIGHT' },
    { id: 'frost', name: '霜粉',  sub: 'FROSTED ROSE' },
    { id: 'mist',  name: '薄雾',  sub: 'MIST GREY' },
    { id: 'iris',  name: '鸢尾',  sub: 'IRIS BLOOM' },
    { id: 'lake',  name: '湖光',  sub: 'LAKE GLASS' }
  ];

  var state = {
    board: 'char',              /* char | stranger */
    charId: null,
    chars: [],
    dateKey: keyOf(new Date()),
    calMonth: new Date(),
    profile: null,
    cfg: null,
    presets: [],
    theme: 'moon',
    working: false,
    detailId: null,
    replyTarget: null           /* { postId, commentId, name } */
  };

  /* ================================================================
     3 · 角色 / 身份读取（只读，不改动别的库）
  ================================================================ */
  function readStore(dbName, storeName){
    return new Promise(function(resolve){
      try{
        var probe = indexedDB.open(dbName);
        probe.onupgradeneeded = function(e){
          try{ e.target.transaction.abort(); }catch(err){}
          resolve([]);
        };
        probe.onsuccess = function(e){
          var db = e.target.result;
          if (!db.objectStoreNames.contains(storeName)) return resolve([]);
          try{
            var r = db.transaction(storeName).objectStore(storeName).getAll();
            r.onsuccess = function(){ resolve(r.result || []); };
            r.onerror = function(){ resolve([]); };
          }catch(err){ resolve([]); }
        };
        probe.onerror = function(){ resolve([]); };
      }catch(err){ resolve([]); }
    });
  }
  function loadChars(){ return readStore('LunaCharDB', 'chars'); }
  function loadIdentityFor(charId){
    return readStore('LunaIdentityDB', 'identities').then(function(list){
      var cid = String(charId);
      var bound = (list || []).filter(function(it){
        var ids = it.boundCharIds || (it.boundCharId != null ? [it.boundCharId] : []);
        return ids.map(String).indexOf(cid) !== -1;
      });
      if (!bound.length) return null;
      bound.sort(function(a, b){
        return (b.isPrimary ? 2 : 0) + (b.active ? 1 : 0) - ((a.isPrimary ? 2 : 0) + (a.active ? 1 : 0));
      });
      return bound[0];
    });
  }

  /* ================================================================
     4 · 模型调用（与 Char 日记共用同一套接口配置）
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
    if (!cfg.baseUrl || !cfg.apiKey) return Promise.reject(new Error('尚未配置 API：请先到「设置 · 接口」填好地址与密钥。'));
    if (!cfg.model) return Promise.reject(new Error('尚未选择模型：请到「设置 · 接口」选择一个可用模型。'));
    return fetch(cfg.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.apiKey },
      body: JSON.stringify({
        model: cfg.model,
        messages: messages,
        temperature: opts.temperature == null ? 1.0 : opts.temperature,
        top_p: 0.95,
        max_tokens: opts.maxTokens || 8000
      })
    }).then(function(r){
      if (!r.ok) return r.text().then(function(t){ throw new Error('接口返回 ' + r.status + '：' + (t || '').slice(0, 140)); });
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
    if (a === -1 || b === -1) throw new Error('模型返回的内容不是可解析的结构，请重试。');
    var slice = t.slice(a, b + 1);
    try{ return JSON.parse(slice); }
    catch(e){
      var fixed = slice.replace(/,\s*([}\]])/g, '$1').replace(/[\u201c\u201d]/g, '"');
      return JSON.parse(fixed);
    }
  }

  /* ================================================================
     5 · 人设压缩（与 Char 日记同源，但服务于"社区发帖"的语境）
  ================================================================ */
  function personaText(c){
    var L = [];
    function put(label, val){
      if (val == null) return;
      if (Array.isArray(val)) val = val.filter(Boolean).join('、');
      val = String(val).trim();
      if (val) L.push(label + '：' + val);
    }
    put('姓名', c.name); put('身份定位', c.role); put('性别', c.gender);
    put('年龄', c.age); put('生日', c.birthday); put('种族', c.species);
    put('核心特质', c.traits); put('外貌', c.appearance); put('穿着', c.outfit);
    put('喜欢', c.likes); put('厌恶', c.dislikes); put('恐惧/软肋', c.fears);
    put('说话与行文风格', c.speechStyle); put('口头禅', c.catchphrases);
    put('使用语言', c.lang); put('背景故事', c.backstory);
    put('当前处境', c.scenario); put('人物简述', c.desc);
    return L.join('\n');
  }
  function boundaryText(c){
    var L = [];
    if (c.neverList && c.neverList.length) L.push('绝对不会做/不会说的事：' + c.neverList.filter(Boolean).join('；'));
    if (c.boundaries) L.push('情绪与行为边界：' + c.boundaries);
    if (c.firstMes) L.push('（语感参考）开场白：' + c.firstMes);
    if (c.dialogExamples && c.dialogExamples.length){
      var ex = c.dialogExamples.slice(0, 3).map(function(d){
        if (typeof d === 'string') return d;
        return [d.user ? ('对方：' + d.user) : '', d.char ? ('角色：' + d.char) : ''].filter(Boolean).join(' / ');
      }).filter(Boolean).join('\n');
      if (ex) L.push('（语感参考）对话样例：\n' + ex);
    }
    return L.join('\n');
  }
  function ageTone(c){
    var n = parseInt(String(c.age || '').replace(/[^0-9]/g, ''), 10);
    if (!n) return '按人设推断的年龄段口吻书写，用词密度与关注点必须与之相符。';
    if (n < 13) return '这是一个 ' + n + ' 岁的孩子：句子短、直给，关心眼前的小事，不会用书面成语堆砌。';
    if (n < 18) return '这是一个 ' + n + ' 岁的少年人：情绪起伏大，用词跳脱，夹杂同龄人的口语与省略。';
    if (n < 26) return '这是一个 ' + n + ' 岁的年轻人：自我审视强烈，语言有锐度也有不确定。';
    if (n < 40) return '这是一个 ' + n + ' 岁的成年人：语言克制、信息密度高，用具体的事讲情绪。';
    if (n < 60) return '这是一个 ' + n + ' 岁的中年人：句子平稳，常从旧事里取比方。';
    return '这是一位 ' + n + ' 岁的长者：语速慢，句子短而笃定，时间尺度长。';
  }
  function userProfileText(p){
    if (!p) return '';
    var L = [];
    if (p.name) L.push('昵称：' + p.name);
    if (p.handle) L.push('账号：@' + p.handle);
    if (p.bio) L.push('简介：' + p.bio);
    if (p.tags && p.tags.length) L.push('标签：' + p.tags.join('、'));
    return L.join('；');
  }

  /* 关系段：角色板块的重心——秘密必须大量与用户相关 */
  function relationText(c, id, profile){
    if (!id){
      return [
        '【关系状态】此角色尚未绑定任何用户身份数据。',
        '但请注意：这个角色是"用户"亲手创造出来的，用户是 Ta 世界的重心。',
        '因此秘密可以围绕角色卡上写明的关系设定' + (c.relation ? ('（' + c.relation + '）') : '') + '所指向的"那个人"来写，',
        '用模糊的称呼（如"那个人""Ta"或角色卡上写明的称呼）指代，',
        '不得虚构对方的姓名、职业、外貌等未被设定的具体信息，也不得平白编出一段新关系。',
        profile && profile.name ? ('社区里有一位读者昵称是「' + profile.name + '」，Ta 可能会来评论，但角色并不认识 Ta，不要在正文里点名。') : ''
      ].filter(Boolean).join('\n');
    }
    var L = ['【关系状态】此角色已与一位用户身份绑定。这是本次写作的重心：'];
    function put(label, val){
      if (!val) return;
      if (Array.isArray(val)) val = val.filter(Boolean).map(function(t){ return t.text || t; }).join('、');
      val = String(val).trim();
      if (val) L.push(label + '：' + val);
    }
    put('对方姓名', id.name); put('对方身份/职业', id.role || id.occupation);
    put('对方性别', id.gender); put('对方生日', id.birthday); put('对方所在地', id.location);
    put('对方性格', id.personality); put('对方自述', id.desc); put('对方标签', id.tags);
    put('对方的座右铭', id.motto); put('二人关系', c.relation);
    put('角色对对方的称呼', c.callUser); put('对方希望被称呼为', id.selfCall);
    put('关系细节', c.relationDetail);
    L.push('称呼必须使用上面写明的称呼，不得改口；亲疏程度必须与关系设定一致，不得擅自升温或降温。');
    L.push('这些秘密之所以没有写进日记本，多半正是因为它们与这个人有关——写下来太重、说出口太越界。');
    return L.join('\n');
  }

  /* ================================================================
     6 · 文风配置 → prompt 片段
  ================================================================ */
  function cfgText(cfg){
    var L = [];
    var voice = cfg.voiceCustom ? (cfg.voice + '，并额外满足：' + cfg.voiceCustom) : cfg.voice;
    L.push('文笔风格：' + voice);
    L.push('情绪浓度：' + ['极淡，几乎不说破','克制，情绪藏在事实下','明显，情绪推着句子走','浓烈，几乎压不住'][clamp(cfg.density, 1, 4) - 1]);
    L.push('篇幅：净字数 ' + cfg.length + ' 字区间（至少 500 字，写不够就继续写细节，不许注水重复）');
    L.push('人称：' + cfg.person);
    L.push('时代/背景底色：' + cfg.era);
    var topics = (cfg.topics || []).slice();
    if (cfg.topicCustom) topics.push(cfg.topicCustom);
    if (topics.length) L.push('题材偏好（从中取材，但不要生硬贴标签）：' + topics.join('、'));
    L.push('评论区氛围：' + cfg.commentMood);
    if (cfg.extra) L.push('用户的额外要求（优先级最高）：' + cfg.extra);
    return L.join('\n');
  }
  function nickRule(cfg){
    var style = cfg.nickCustom ? cfg.nickCustom : cfg.nickStyle;
    return [
      '【昵称规则 · 极其重要】',
      '所有出现的人（作者、评论者、转发者、点赞者）都必须使用"网名"，不能是真实姓名。',
      '风格倾向：' + style + '。',
      '好的例子形态：像真人在社交平台上会起的 ID——可以有数字后缀、可以是不完整的短句、可以是英文小写单词、可以是两三个汉字的怪组合。',
      '禁止：任何形如"张伟""李小美""王先生"的真实姓名；禁止 emoji 与颜文字；禁止过度中二到出戏的长串。',
      '每个昵称还要配一个 handle（英文/拼音/数字组成的账号名，不带 @，不超过 16 字符），彼此不能重复。'
    ].join('\n');
  }

  var BLOCK_SPEC = [
    '【正文块结构】blocks 是一个数组，每个元素是一个块。可用类型：',
    'para     : { "type":"para", "text":"段落正文" }',
    'lead     : { "type":"lead", "text":"起笔的第一段，语气要能立刻抓住人" }',
    'emph     : { "type":"emph", "text":"全篇最重的一句判断/转折，独立成段，不超过 40 字" }',
    'quote    : { "type":"quote", "text":"引用的话", "from":"出处，可省略" }',
    'list     : { "type":"list", "label":"清单名", "items":["条目一","条目二"] }',
    'fragment : { "type":"fragment", "lines":["断句一","断句二","断句三"] }',
    'aside    : { "type":"aside", "text":"括号里的自我打断，短" }',
    'secret   : { "type":"secret", "text":"这一段是全文最不敢说出口的部分，会被做成隐藏样式" }',
    'timestamp: { "type":"timestamp", "label":"03:12", "text":"这个时刻补写的内容" }',
    '',
    '【重点标记 · 必须使用】在任意块的 text 里，可以用 **双星号** 包住需要突出的短句或词，渲染时会被做成高亮标记。',
    '每篇至少出现 3 处 **重点标记**，并且至少使用 1 个 emph 块、1 个 secret 块；块类型不少于 5 种，让排版有起伏。',
    '禁止使用 markdown 标题（#）、禁止 emoji 与颜文字。'
  ].join('\n');

  /* ---- 角色板块 · 生成 prompt ---- */
  function buildCharPrompt(ctx){
    var c = ctx.char, id = ctx.identity, cfg = ctx.cfg, p = ctx.profile;
    var d = dateFromKey(ctx.dateKey);
    var sys = [
      '你在为一个"匿名秘密社区"生成内容。现在要以下面这个角色的身份，写 Ta 发布在这个社区里的一条秘密随笔。',
      '',
      '【这是什么地方】',
      '这不是日记本。日记本是 Ta 写给自己的，锁起来的；',
      '这里是一个半匿名的小社区——Ta 用一个网名在这里发帖，会被陌生人看到、评论、转发。',
      '所以：这里的文字有"被看见"的自觉，会有分寸、有留白、有故意说一半的地方，',
      '像深夜发出去又想撤回的那种东西；比日记更像随笔与小纸条，不写流水账。',
      '',
      '【角色人设 · 唯一事实来源】',
      personaText(c),
      '',
      relationText(c, id, p),
      '',
      boundaryText(c),
      '',
      '【口吻锚点】',
      ageTone(c),
      c.speechStyle ? ('行文必须与人设写明的说话风格一致：' + c.speechStyle) : '',
      c.lang ? ('主要使用语言：' + c.lang) : '',
      '',
      '【用户的写作配置（必须遵守）】',
      cfgText(cfg),
      '',
      nickRule(cfg),
      '',
      '【绝对规则】',
      '1. 禁止 OOC：性格、身份、知识边界、世界观必须与人设完全一致，人设里没有的能力与经历一律不得添加。',
      '2. 这条秘密的核心必须与"那个人"（用户/绑定身份）有关，或至少被 Ta 的存在牵动——这是角色不写进日记本的原因。',
      '3. 角色在社区里用的是网名，不是本名；但角色卡上的名字可以作为署名线索被保留（例如取其中一个字）。',
      '4. 只输出 JSON，不要任何解释、前言、markdown 代码块以外的文字。',
      '5. 严禁 emoji 与颜文字。',
      '6. 正文净字数必须 ≥ 500 字（不含标点空格）。'
    ].filter(Boolean).join('\n');

    var prior = '';
    if (ctx.prior && ctx.prior.length){
      prior = [
        '',
        '【这一天此前已经发过以下内容，这次必须换题材、换角度、换情绪落点】',
        ctx.prior.map(function(x, i){ return (i + 1) + '. 《' + (x.title || '') + '》—— ' + (x.excerpt || ''); }).join('\n')
      ].join('\n');
    }

    var user = [
      '【这一天】' + ctx.dateKey + '，' + WEEKDAY_CN[d.getDay()] + '，' + seasonOf(d.getMonth()) + '季' + (dayTexture(d) ? ('，' + dayTexture(d)) : '') + '。',
      ctx.holiday
        ? ('这一天是：' + ctx.holiday + '。节日必须真实地渗进内容与评论区——可以是热闹参与，也可以是刻意回避、错位、或因为处境而格外难熬，取决于人设，但不能只字不提。'
           + '同时社区里的其他人也会因为这个节日而有不同的说话方式。')
        : '这一天不是节日，是普通日子。请写出普通日子独有的质地，不要编造节庆。',
      '',
      '【本次要生成 ' + ctx.count + ' 条秘密】' + (ctx.count > 1 ? '多条之间发生在同一天的不同时刻，情绪要有推进或反转，标题与结构必须彼此不同。' : ''),
      '',
      BLOCK_SPEC,
      '',
      '【评论区】每条秘密要带 ' + cfg.commentCount + ' 条左右的评论：',
      '· 评论者是这个社区里的其他人（陌生网友），必须用网名，语气要符合上面设定的评论区氛围；',
      '· 评论必须扣住这一篇的具体内容说话，能看出对方真的读完了，禁止"写得真好""加油"这类万能话；',
      '· 其中 1~2 条要有互相回复的关系（用 replyTo 指向另一条评论的 index）；',
      '· 作者（也就是这个角色）必须亲自回复其中 1 条评论，标记 isAuthor:true，语气与正文一致但更松弛；',
      '· 至少一条评论要显得"没完全读懂但很关心"，这是真实社区的质感。',
      '',
      '【转发/引用】给出 1~3 条转发：别人转发这条秘密时写下的一句话（可以是共鸣、误读、或借题发挥说自己的事）。',
      '【点赞名单】给出 6~10 个点赞者的网名与 handle。',
      '',
      '【只输出如下 JSON】',
      '{',
      '  "posts": [{',
      '    "author": { "name":"角色在社区用的网名", "handle":"账号名", "bio":"一句话个性签名，不超过 20 字", "tagline":"发帖时显示的状态，如 在写给谁都不会看见的地方" },',
      '    "time": "23:41",',
      '    "title": "不超过 16 字的标题",',
      '    "mood": "calm|joy|tender|blue|storm",',
      '    "place": "发帖时人在哪儿，六字以内",',
      '    "topic": "两到四字的话题标签，如 深夜 / 旧信",',
      '    "tags": ["三到五个话题标签，每个不超过 6 字"],',
      '    "blocks": [ ... ],',
      '    "likes": 137,',
      '    "views": 2140,',
      '    "likers": [{ "name":"网名", "handle":"账号名" }],',
      '    "comments": [{ "name":"网名", "handle":"账号名", "text":"评论内容，30~80 字", "isAuthor":false, "likes":3, "replyTo":null }],',
      '    "reposts": [{ "name":"网名", "handle":"账号名", "text":"转发时写下的话，20~60 字", "likes":2 }]',
      '  }]',
      '}',
      prior
    ].filter(Boolean).join('\n');

    return [{ role: 'system', content: sys }, { role: 'user', content: user }];
  }

  /* ---- 陌生人板块 · 生成 prompt ---- */
  function buildStrangerPrompt(ctx){
    var cfg = ctx.cfg, p = ctx.profile;
    var d = dateFromKey(ctx.dateKey);
    var sys = [
      '你在为一个"匿名秘密社区"生成内容。这一次要生成的是若干个互不相识的陌生人，在同一天各自发布的秘密随笔。',
      '',
      '【这是什么地方】半匿名社区，人们用网名在这里说不敢在熟人面前说的话。',
      '文字像随笔与小纸条：有被看见的自觉，有分寸，有故意说一半的地方，不是流水账日记。',
      '',
      '【每个人都必须是一个真实可信的具体的人】',
      '· 有具体的处境（在做什么工作、和谁住、这一天经历了什么），',
      '· 有具体的物件与场景（地铁几号线、租的房子朝向、外卖凉了、医院的走廊灯），',
      '· 彼此之间人格、年龄、语言习惯、句子长度都必须明显不同，不能像同一个人换了个昵称。',
      '',
      '【用户的写作配置（必须遵守）】',
      cfgText(cfg),
      '',
      '【陌生人取样范围】',
      '年龄段：' + cfg.ageRange + '；地域：' + cfg.region + '；职业倾向：' + cfg.jobStyle + '。',
      '（"不限"意味着你要主动拉开差距，让这一批人来自完全不同的生活。）',
      '',
      nickRule(cfg),
      '',
      p && p.name && cfg.allowMentionUser
        ? ('【社区里的一位读者】昵称「' + p.name + '」' + (p.handle ? ('（@' + p.handle + '）') : '') + (p.bio ? ('，签名：' + p.bio) : '') + '。Ta 可能会出现在评论区，但陌生人们并不认识 Ta，正文里不要点名。')
        : '',
      '',
      '【绝对规则】',
      '1. 只输出 JSON，不要任何解释文字。',
      '2. 严禁 emoji 与颜文字。',
      '3. 每篇正文净字数必须 ≥ 500 字（不含标点空格）。',
      '4. 禁止把不同的人写成同一种腔调；禁止套用模板句式开头。'
    ].filter(Boolean).join('\n');

    var user = [
      '【这一天】' + ctx.dateKey + '，' + WEEKDAY_CN[d.getDay()] + '，' + seasonOf(d.getMonth()) + '季' + (dayTexture(d) ? ('，' + dayTexture(d)) : '') + '。',
      ctx.holiday
        ? ('这一天是：' + ctx.holiday + '。节日会真实地改变这一批人的处境与语气——有人在热闹里、有人被热闹排除在外、有人在加班、有人在医院。评论区的氛围也要随之改变。')
        : '这一天不是节日，是普通日子。',
      '',
      '【本次生成 ' + ctx.count + ' 位互不相识的陌生人各一条秘密】',
      '',
      BLOCK_SPEC,
      '',
      '【评论区】每条要带 ' + cfg.commentCount + ' 条左右评论，评论者是社区里的其他陌生人：',
      '· 必须扣住这一篇的具体细节说话，禁止万能夸赞；',
      '· 其中 1~2 条互相回复（replyTo 指向另一条的 index）；',
      '· 作者必须亲自回复其中 1 条，标记 isAuthor:true。',
      '【转发/引用】每条给 1~3 条转发语。【点赞名单】每条给 6~10 个点赞者网名。',
      '',
      '【只输出如下 JSON】',
      '{',
      '  "posts": [{',
      '    "author": { "name":"网名", "handle":"账号名", "bio":"个性签名，不超过 20 字", "tagline":"身份/处境的一句话，如 在三线城市开花店的第二年", "age":"年龄段", "region":"所在地" },',
      '    "time": "01:12", "title":"不超过 16 字", "mood":"calm|joy|tender|blue|storm",',
      '    "place":"六字以内", "topic":"两到四字", "tags":["标签"],',
      '    "blocks":[ ... ], "likes":86, "views":1420,',
      '    "likers":[{"name":"","handle":""}],',
      '    "comments":[{"name":"","handle":"","text":"","isAuthor":false,"likes":1,"replyTo":null}],',
      '    "reposts":[{"name":"","handle":"","text":"","likes":0}]',
      '  }]',
      '}'
    ].filter(Boolean).join('\n');

    return [{ role: 'system', content: sys }, { role: 'user', content: user }];
  }

  /* ---- 「更新数据」 · prompt ----
     这是社区活着的关键：每次更新，点赞会涨、会来新评论、
     作者会回复用户、被用户回复的人也会回来回话。 */
  function buildUpdatePrompt(post, profile, cfg, pending){
    var authorName = post.author.name;
    var plain = blocksPlain(post.blocks).slice(0, 900);
    var existing = (post.comments || []).slice(-8).map(function(c){
      return '- [' + c.id + '] ' + c.name + (c.isAuthor ? '（作者）' : '') + (c.isUser ? '（读者本人）' : '') + '：' + c.text;
    }).join('\n');

    var duties = [];
    (pending.needAuthorReply || []).forEach(function(c){
      duties.push('· 作者「' + authorName + '」必须亲自回复读者「' + c.name + '」的这条评论（id=' + c.id + '）：「' + c.text + '」。'
        + '回复要具体接住对方说的话，语气与正文一致，不能是客套。标记 isAuthor:true，replyToId 填 "' + c.id + '"。');
    });
    (pending.needPeerReply || []).forEach(function(pair){
      duties.push('· 评论者「' + pair.target.name + '」（handle: ' + pair.target.handle + '）必须回复读者「' + pair.user.name + '」的这条回复（id=' + pair.user.id + '）：「' + pair.user.text + '」。'
        + '要延续 Ta 自己原本那条评论「' + pair.target.text + '」的立场与语气，replyToId 填 "' + pair.user.id + '"，name/handle 必须与原评论者完全一致。');
    });

    var sys = [
      '你在维护一个匿名秘密社区里某一条帖子的实时动态。现在时间往前走了一段，这条帖子有了新的互动。',
      '你要生成的是"这段时间里新增的互动"，而不是重写帖子。',
      '',
      '【帖子信息】',
      '作者网名：' + authorName + '（@' + post.author.handle + '）' + (post.author.tagline ? ('，' + post.author.tagline) : ''),
      '标题：' + post.title,
      '正文（节选）：' + plain,
      '',
      '【已有评论】',
      existing || '（暂无）',
      '',
      '【读者本人】' + (userProfileText(profile) || '一位没有填写资料的读者'),
      '',
      '【本次必须完成的事】',
      duties.length ? duties.join('\n') : '· 没有待回复的读者评论，只需自然地新增一些互动。',
      '',
      '【其他要求】',
      '· 新增 1~3 条来自其他陌生人的新评论，必须扣住正文的具体内容或已有评论的话题，不要重复已有观点；',
      '· 评论区氛围：' + cfg.commentMood + '；昵称风格：' + (cfg.nickCustom || cfg.nickStyle) + '；不得与已有昵称重复；',
      '· 新增 0~2 条转发引用语；',
      '· 点赞增量要合理（几十到几百，视帖子热度），并给出 3~8 个新的点赞者网名；',
      '· 严禁 emoji 与颜文字；只输出 JSON。',
      '',
      '【只输出如下 JSON】',
      '{',
      '  "likeDelta": 42, "viewDelta": 380,',
      '  "newLikers": [{"name":"","handle":""}],',
      '  "newComments": [{"name":"","handle":"","text":"","isAuthor":false,"likes":0,"replyToId":null}],',
      '  "newReposts": [{"name":"","handle":"","text":"","likes":0}]',
      '}'
    ].join('\n');

    return [{ role: 'system', content: sys }, { role: 'user', content: '生成这一次的新增互动。' }];
  }

  /* ================================================================
     7 · 归一化 / 落库
  ================================================================ */
  var BLOCK_TYPES = ['lead','para','emph','quote','list','fragment','aside','secret','timestamp'];
  var MOODS = ['calm','joy','tender','blue','storm'];
  var MOOD_LABEL = { calm:'平静', joy:'欢喜', tender:'柔软', blue:'低落', storm:'翻涌' };

  function blocksPlain(blocks){
    var out = [];
    (blocks || []).forEach(function(b){
      if (b.text) out.push(b.text);
      (b.lines || []).forEach(function(l){ out.push(typeof l === 'string' ? l : (l.text || '')); });
      (b.items || []).forEach(function(i){ out.push(i); });
    });
    return out.join(' ').replace(/\*\*/g, '');
  }
  function countWords(blocks){ return textLen(blocksPlain(blocks)); }

  function normBlocks(raw){
    return (Array.isArray(raw) ? raw : []).map(function(b){
      var t = String(b && b.type || 'para').toLowerCase();
      if (BLOCK_TYPES.indexOf(t) === -1) t = 'para';
      var nb = { type: t };
      if (b.text) nb.text = String(b.text);
      if (b.from) nb.from = String(b.from);
      if (b.label) nb.label = String(b.label);
      if (Array.isArray(b.items)) nb.items = b.items.map(String).filter(Boolean);
      if (Array.isArray(b.lines)) nb.lines = b.lines.map(function(l){ return typeof l === 'string' ? l : String(l.text || ''); }).filter(Boolean);
      return nb;
    }).filter(function(b){ return b.text || (b.lines && b.lines.length) || (b.items && b.items.length); });
  }

  /* 网名（真名）：非 NPC 的角色作者 / 角色本人评论，昵称后要用括号带出角色卡上的真实姓名，
     保证「角色信息库」里的姓名与社区里显示的网名始终同步。 */
  function displayName(nick, charObj){
    nick = String(nick || '');
    var real = charObj && String(charObj.name || '').trim();
    if (!real || real === nick) return nick;
    return nick + '（' + real + '）';
  }

  function normPerson(x, seedBase){
    x = x || {};
    var name = String(x.name || '').trim().slice(0, 20) || '匿名的人';
    var handle = String(x.handle || '').trim().replace(/^@/, '').slice(0, 20) || ('u' + hashStr(name + seedBase) % 100000);
    return { name: name, handle: handle, seed: hashStr(name + '::' + handle) };
  }

  function normPost(raw, board, dateKey, charId){
    var id = 'p_' + uid();
    var blocks = normBlocks(raw.blocks);
    var author = normPerson(raw.author, dateKey);
    author.bio = String((raw.author && raw.author.bio) || '').slice(0, 40);
    author.tagline = String((raw.author && raw.author.tagline) || '').slice(0, 40);
    author.age = String((raw.author && raw.author.age) || '');
    author.region = String((raw.author && raw.author.region) || '');
    author.kind = board === 'char' ? 'char' : 'npc';
    author.charId = charId == null ? null : String(charId);

    var comments = (Array.isArray(raw.comments) ? raw.comments : []).map(function(c, i){
      var p = normPerson(c, dateKey + i);
      return {
        id: 'c_' + uid(),
        name: c.isAuthor ? author.name : p.name,
        handle: c.isAuthor ? author.handle : p.handle,
        seed: c.isAuthor ? author.seed : p.seed,
        text: String(c.text || '').slice(0, 300),
        isAuthor: !!c.isAuthor,
        isUser: false,
        likes: Math.max(0, parseInt(c.likes, 10) || 0),
        liked: false,
        replyIdx: (c.replyTo == null ? null : parseInt(c.replyTo, 10)),
        replyToId: null,
        ts: Date.now() - (10 - i) * 60000
      };
    }).filter(function(c){ return c.text; });
    /* index 形式的 replyTo 转成真实 id */
    comments.forEach(function(c){
      if (c.replyIdx != null && comments[c.replyIdx] && comments[c.replyIdx] !== c){
        c.replyToId = comments[c.replyIdx].id;
        c.replyToName = comments[c.replyIdx].name;
      }
      delete c.replyIdx;
    });

    var likers = (Array.isArray(raw.likers) ? raw.likers : []).map(function(l, i){ return normPerson(l, dateKey + 'L' + i); });
    var reposts = (Array.isArray(raw.reposts) ? raw.reposts : []).map(function(r, i){
      var p = normPerson(r, dateKey + 'R' + i);
      return { id: 'r_' + uid(), name: p.name, handle: p.handle, seed: p.seed,
        text: String(r.text || '').slice(0, 200), likes: Math.max(0, parseInt(r.likes, 10) || 0), liked: false,
        ts: Date.now() - (5 + i) * 90000, isUser: false };
    }).filter(function(r){ return r.text; });

    return {
      id: id,
      board: board,
      charId: charId == null ? null : String(charId),
      date: dateKey,
      createdAt: Date.now(),
      time: String(raw.time || '').slice(0, 5) || '23:0' + (hashStr(id) % 10),
      author: author,
      title: String(raw.title || '无题').slice(0, 30),
      mood: MOODS.indexOf(String(raw.mood || '').toLowerCase()) !== -1 ? String(raw.mood).toLowerCase() : MOODS[hashStr(id) % 5],
      place: String(raw.place || '').slice(0, 14),
      topic: String(raw.topic || '').slice(0, 8),
      tags: (Array.isArray(raw.tags) ? raw.tags : []).map(String).map(function(t){ return t.slice(0, 10); }).slice(0, 6),
      blocks: blocks,
      wordCount: countWords(blocks),
      excerpt: blocksPlain(blocks).slice(0, 60),
      stats: {
        likes: Math.max(0, parseInt(raw.likes, 10) || (20 + hashStr(id) % 300)),
        views: Math.max(0, parseInt(raw.views, 10) || (300 + hashStr(id + 'v') % 4000))
      },
      liked: false,
      faved: false,
      likers: likers,
      comments: comments,
      reposts: reposts,
      updates: 0,
      lastUpdate: 0,
      holiday: holidayOf(dateKey)
    };
  }

  /* 生成：不足 500 字则补写一次 */
  function generatePosts(messages, board, dateKey, charId, onStage){
    return callModel(messages, { temperature: 1.02, maxTokens: 8000 }).then(function(text){
      var data = parseJSON(text);
      var list = Array.isArray(data.posts) ? data.posts : (Array.isArray(data) ? data : []);
      if (!list.length) throw new Error('模型没有写出可用的内容，请再试一次。');
      var posts = list.map(function(raw){ return normPost(raw, board, dateKey, charId); });
      var short = posts.filter(function(p){ return p.wordCount < 500; });
      if (!short.length) return posts;
      onStage && onStage('字数不足 · 续写中');
      var fix = messages.concat([
        { role: 'assistant', content: text },
        { role: 'user', content: '以下篇目正文净字数不足 500 字：' +
          short.map(function(p){ return '《' + p.title + '》（约 ' + p.wordCount + ' 字）'; }).join('、') +
          '。请保持作者、昵称、时间、语气、已写内容完全不变，在原有 blocks 之后继续追加新的块，把没写完的细节写下去，直到每篇净字数 ≥ 500。仍然只输出同样结构的完整 JSON，包含所有篇目。' }
      ]);
      return callModel(fix, { temperature: 0.98, maxTokens: 8000 }).then(function(t2){
        try{
          var d2 = parseJSON(t2);
          var l2 = Array.isArray(d2.posts) ? d2.posts : [];
          if (l2.length) return l2.map(function(raw){ return normPost(raw, board, dateKey, charId); });
        }catch(e){}
        return posts;
      }).catch(function(){ return posts; });
    });
  }

  /* ================================================================
     8 · 更新互动（点赞 / 评论 / 转发 / 作者回复）
  ================================================================ */
  function pendingDuties(post){
    var comments = post.comments || [];
    var byId = {};
    comments.forEach(function(c){ byId[c.id] = c; });

    var needAuthorReply = [];
    var needPeerReply = [];

    comments.forEach(function(c){
      if (!c.isUser) return;
      var answeredByAuthor = comments.some(function(x){ return x.isAuthor && x.replyToId === c.id; });
      if (c.replyToId && byId[c.replyToId]){
        /* 用户回复了某条评论 → 那个人必须回话 */
        var target = byId[c.replyToId];
        var answered = comments.some(function(x){ return x.replyToId === c.id && x.handle === target.handle; });
        if (!answered) needPeerReply.push({ user: c, target: target });
        if (!answeredByAuthor && !target.isAuthor) needAuthorReply.push(c);
      } else if (!answeredByAuthor){
        needAuthorReply.push(c);
      }
    });
    return { needAuthorReply: needAuthorReply, needPeerReply: needPeerReply };
  }

  function runUpdate(post, onStage){
    var pending = pendingDuties(post);
    onStage && onStage(pending.needAuthorReply.length || pending.needPeerReply.length ? '有人正在回复你' : '正在刷新');
    var msgs = buildUpdatePrompt(post, state.profile, state.cfg, pending);
    return callModel(msgs, { temperature: 1.0, maxTokens: 3000 }).then(function(text){
      var d = parseJSON(text);
      var likeDelta = clamp(parseInt(d.likeDelta, 10) || 0, 0, 5000);
      var viewDelta = clamp(parseInt(d.viewDelta, 10) || 0, 0, 50000);
      post.stats.likes += likeDelta;
      post.stats.views += viewDelta;

      (Array.isArray(d.newLikers) ? d.newLikers : []).forEach(function(l, i){
        var p = normPerson(l, post.id + 'nl' + i);
        if (!post.likers.some(function(x){ return x.handle === p.handle; })) post.likers.unshift(p);
      });

      var added = [];
      (Array.isArray(d.newComments) ? d.newComments : []).forEach(function(c, i){
        var p = normPerson(c, post.id + 'nc' + i);
        var isAuthor = !!c.isAuthor;
        var target = c.replyToId ? (post.comments.filter(function(x){ return x.id === c.replyToId; })[0]) : null;
        var item = {
          id: 'c_' + uid(),
          name: isAuthor ? post.author.name : p.name,
          handle: isAuthor ? post.author.handle : p.handle,
          seed: isAuthor ? post.author.seed : p.seed,
          text: String(c.text || '').slice(0, 300),
          isAuthor: isAuthor, isUser: false,
          likes: Math.max(0, parseInt(c.likes, 10) || 0), liked: false,
          replyToId: target ? target.id : null,
          replyToName: target ? target.name : '',
          ts: Date.now(),
          fresh: true
        };
        if (item.text){ post.comments.push(item); added.push(item); }
      });

      (Array.isArray(d.newReposts) ? d.newReposts : []).forEach(function(r, i){
        var p = normPerson(r, post.id + 'nr' + i);
        if (!r.text) return;
        post.reposts.unshift({
          id: 'r_' + uid(), name: p.name, handle: p.handle, seed: p.seed,
          text: String(r.text).slice(0, 200), likes: Math.max(0, parseInt(r.likes, 10) || 0),
          liked: false, ts: Date.now(), isUser: false, fresh: true
        });
      });

      post.updates = (post.updates || 0) + 1;
      post.lastUpdate = Date.now();
      return putPost(post).then(function(){
        return { likeDelta: likeDelta, comments: added.length, reposts: (d.newReposts || []).length };
      });
    });
  }

  /* ================================================================
     9 · 视觉工具：头像 / 高亮 / 数字
  ================================================================ */
  function avatarHtml(person, cls){
    cls = cls || '';
    var name = (person && person.name) || '?';
    if (person && person.avatar){
      return '<span class="pv-ava ' + cls + '"><img src="' + person.avatar + '" alt="" /></span>';
    }
    if (person && person.charAvatar){
      return '<span class="pv-ava ' + cls + '"><img src="' + person.charAvatar + '" alt="" /></span>';
    }
    var seed = person && person.seed != null ? person.seed : hashStr(name);
    var h1 = seed % 360, h2 = (seed >> 3) % 360;
    var ch = String(name).trim().charAt(0) || '?';
    var style = 'background:linear-gradient(140deg,hsl(' + h1 + ',42%,92%),hsl(' + h2 + ',38%,84%));';
    return '<span class="pv-ava ' + cls + '" style="' + style + '"><i>' + esc(ch) + '</i></span>';
  }

  /* **重点** → 高亮标记；同时做转义，杜绝注入 */
  function inlineMark(str){
    var s = esc(str == null ? '' : String(str));
    return s.replace(/\*\*([^*]{1,60})\*\*/g, '<mark class="pv-hl">$1</mark>');
  }
  function nfmt(n){
    n = parseInt(n, 10) || 0;
    if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万';
    return String(n);
  }
  function relTime(ts){
    var diff = Date.now() - (ts || 0);
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    var d = new Date(ts);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  /* 正文块 → HTML（详情页用；预览用纯文本） */
  function blocksHtml(blocks){
    return (blocks || []).map(function(b){
      switch(b.type){
        case 'lead':
          return '<p class="pvb-lead">' + inlineMark(b.text) + '</p>';
        case 'emph':
          return '<p class="pvb-emph"><span class="pvb-emph-bar"></span>' + inlineMark(b.text) + '</p>';
        case 'quote':
          return '<blockquote class="pvb-quote">' + inlineMark(b.text) +
                 (b.from ? '<cite>' + esc(b.from) + '</cite>' : '') + '</blockquote>';
        case 'list':
          return '<div class="pvb-list">' + (b.label ? '<span class="pvb-list-label">' + esc(b.label) + '</span>' : '') +
                 '<ul>' + (b.items || []).map(function(i){ return '<li>' + inlineMark(i) + '</li>'; }).join('') + '</ul></div>';
        case 'fragment':
          return '<div class="pvb-frag">' + (b.lines || []).map(function(l){ return '<span>' + inlineMark(l) + '</span>'; }).join('') + '</div>';
        case 'aside':
          return '<p class="pvb-aside">' + inlineMark(b.text) + '</p>';
        case 'secret':
          return '<p class="pvb-secret" data-revealed="0"><span class="pvb-secret-veil">轻触，看清这句</span><span class="pvb-secret-text">' + inlineMark(b.text) + '</span></p>';
        case 'timestamp':
          return '<div class="pvb-stamp"><span class="pvb-stamp-label">' + esc(b.label || '') + '</span><p>' + inlineMark(b.text) + '</p></div>';
        default:
          return '<p class="pvb-para">' + inlineMark(b.text) + '</p>';
      }
    }).join('');
  }

  /* ================================================================
     10 · 自绘图标（全部线条，禁 emoji）
  ================================================================ */
  var ICON = {
    heart: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 19.5c-.3 0-.6-.1-.8-.3C7.6 16.2 4.5 13.6 4.5 10.3 4.5 7.9 6.4 6 8.8 6c1.2 0 2.4.5 3.2 1.5C12.8 6.5 14 6 15.2 6 17.6 6 19.5 7.9 19.5 10.3c0 3.3-3.1 5.9-6.7 8.9-.2.2-.5.3-.8.3Z"/></svg>',
    comment: '<svg viewBox="0 0 24 24" fill="none"><path d="M20 12.4c0 3.7-3.6 6.7-8 6.7-1 0-2-.2-2.9-.5L4.5 20l1.2-3.2C4.6 15.6 4 14.1 4 12.4 4 8.7 7.6 5.7 12 5.7s8 3 8 6.7Z"/></svg>',
    repost: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 9.5V8a3 3 0 0 1 3-3h8l-2.4-2.2M18 14.5V16a3 3 0 0 1-3 3H7l2.4 2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 4.5 14.1 9l4.9.6-3.6 3.4.95 4.9L12 15.6 7.65 17.9l.95-4.9L5 9.6 9.9 9Z" stroke-linejoin="round"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none"><rect x="4.5" y="6" width="15" height="14" rx="3"/><path d="M4.5 10.2h15"/><path d="M8.3 4.2v3.6M15.7 4.2v3.6" stroke-linecap="round"/></svg>',
    quill: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 18.5c0-5.6 4.2-10.6 9.8-11.8.9-.2 1.5.8 1 1.6-2.4 3.7-4.6 6-7.6 7.6"/><path d="M5 19.5c1.6-.6 3-1.3 4.2-2.1" opacity="0.6"/></svg>',
    palette: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3.2c-4.9 0-8.8 3.6-8.8 8 0 4 3.1 6.4 6.4 6.4 1.5 0 2.2.8 2.2 1.8 0 .8.6 1.4 1.4 1.4 4.2 0 7.6-3.5 7.6-8.2 0-5.2-3.9-9.4-8.8-9.4Z"/><circle cx="8.2" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="7.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.8" cy="10.4" r="1.1" fill="currentColor" stroke="none"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 19l.7-3.1c.1-.5.35-.95.7-1.3L15.3 5.7c.8-.8 2.1-.8 2.9 0l.1.1c.8.8.8 2.1 0 2.9l-8.9 8.9c-.35.35-.8.6-1.3.7Z"/><path d="M13.6 7.4l3 3" opacity="0.6"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none"><path d="M14.5 6.5C10.5 8.5 8 10.5 7 12c1 1.5 3.5 3.5 7.5 5.5"/><path d="M7 12h4.5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>'
  };

  /* ================================================================
     11 · 主题
  ================================================================ */
  function applyTheme(){
    var t = state.theme || 'moon';
    var root = document.getElementById('pvRoot');
    if (root) root.setAttribute('data-pv-theme', t);
    ['pvDetail','pvCalModal','pvSheet','pvWho','pvWhoCard'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.setAttribute('data-pv-theme', t);
    });
  }

  /* ================================================================
     12 · 外壳 DOM（一次性构建，挂在 .diary-app 下）
  ================================================================ */
  function statusBarHtml(prefix){
    return '' +
    '<div class="status-bar pv-status-bar">' +
      '<div class="status-time" id="' + prefix + 'Time">9:41</div>' +
      '<div class="status-island" id="' + prefix + 'Island"></div>' +
      '<div class="status-right">' +
        '<div class="signal"><i></i><i></i><i></i><i></i></div>' +
        '<div class="battery">' +
          '<span class="bat-pct" id="' + prefix + 'BatPct">76</span>' +
          '<div class="bat-shell"><div class="bat-inner" id="' + prefix + 'BatInner"></div><div class="bat-nub"></div></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  var shellBuilt = false;
  function buildShell(){
    if (shellBuilt) return;
    shellBuilt = true;
    var app = document.querySelector('.diary-app') || document.body;
    var wrap = document.createElement('div');
    wrap.innerHTML = '' +
    /* ---- 通用底部抽屉（资料 / 文风 / 主题 / 收藏 共用一层壳） ---- */
    '<div class="pv-veil" id="pvVeil"></div>' +
    '<div class="pv-sheet" id="pvSheet" aria-hidden="true">' +
      '<div class="pv-sheet-inner">' +
        '<div class="pv-sheet-handle"></div>' +
        '<div class="pv-sheet-top">' +
          '<span class="pv-sheet-mark"><i class="pv-sheet-dot"></i><span id="pvSheetTitle">我的资料</span></span>' +
          '<button class="pv-icon-btn" id="pvSheetClose" aria-label="关闭">' + ICON.close + '</button>' +
        '</div>' +
        '<div class="pv-sheet-body" id="pvSheetBody"></div>' +
      '</div>' +
    '</div>' +

    /* ---- 日历弹窗 ---- */
    '<div class="pv-veil" id="pvCalVeil"></div>' +
    '<div class="pv-cal-modal" id="pvCalModal" aria-hidden="true">' +
      '<div class="pv-cal-sheet">' +
        '<div class="pv-cal-top">' +
          '<span class="pv-sheet-mark"><i class="pv-sheet-dot"></i><span id="pvCalTitle">翻阅时光</span></span>' +
          '<button class="pv-icon-btn" id="pvCalClose" aria-label="关闭">' + ICON.close + '</button>' +
        '</div>' +
        '<div class="pv-cal-head">' +
          '<button class="pv-cal-nav" id="pvCalPrev" aria-label="上个月">' + ICON.back + '</button>' +
          '<span class="pv-cal-headtext"><b id="pvCalMonthEn">AUGUST</b><em id="pvCalMonthCn">2026 · 八月</em></span>' +
          '<button class="pv-cal-nav pv-cal-nav--next" id="pvCalNext" aria-label="下个月">' + ICON.back + '</button>' +
        '</div>' +
        '<div class="pv-cal-week"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span class="wk">六</span><span class="wk">日</span></div>' +
        '<div class="pv-cal-grid" id="pvCalGrid"></div>' +
        '<div class="pv-cal-legend">' +
          '<span><i class="lg-has"></i>已有内容</span><span><i class="lg-holiday"></i>节日</span><span><i class="lg-today"></i>今日</span>' +
        '</div>' +
        /* 生成仪式：墨章印信，非按钮造型 */
        '<div class="pv-quill" id="pvQuill" data-state="idle">' +
          '<button class="pv-quill-seal" id="pvQuillBtn" type="button" aria-label="生成这一天">' +
            '<span class="pvq-ring"></span>' +
            '<span class="pvq-face">' + ICON.quill + '<svg class="pvq-spin" viewBox="0 0 44 44" fill="none"><circle cx="22" cy="22" r="19.5"/></svg></span>' +
          '</button>' +
          '<span class="pv-quill-plate">' +
            '<em id="pvQuillEyebrow">选中一个日子</em>' +
            '<b id="pvQuillLine">看看那天有谁在说秘密</b>' +
            '<i id="pvQuillHint">按下墨章</i>' +
          '</span>' +
        '</div>' +
      '</div>' +
    '</div>' +

    /* ---- 详情页 ---- */
    '<div class="pv-detail-veil" id="pvDetailVeil"></div>' +
    '<div class="pv-detail" id="pvDetail" aria-hidden="true">' +
      statusBarHtml('pvd') +
      '<div class="pv-detail-top">' +
        '<button class="pv-icon-btn pv-detail-back" id="pvDetailBack" aria-label="返回">' + ICON.back + '</button>' +
        '<span class="pv-detail-topmark"><b id="pvDetailTopName">秘密</b><em id="pvDetailTopSub">PRIVATE NOTE</em></span>' +
        '<button class="pv-icon-btn" id="pvDetailFav" aria-label="收藏">' + ICON.star + '</button>' +
        '<span class="pv-detail-progress" id="pvDetailProgress"><i></i></span>' +
      '</div>' +
      '<div class="pv-detail-scroll" id="pvDetailScroll"><div class="pv-detail-inner" id="pvDetailInner"></div></div>' +
      /* 底部：写评论 / 引用转发 —— 输入条为一条"信笺缝隙"，发送是一枚落墨点 */
      '<div class="pv-compose" id="pvCompose">' +
        '<div class="pv-compose-reply" id="pvComposeReply" hidden>' +
          '<span id="pvComposeReplyText"></span>' +
          '<button class="pv-compose-cancel" id="pvComposeCancel" aria-label="取消回复">' + ICON.close + '</button>' +
        '</div>' +
        '<div class="pv-compose-row">' +
          '<span class="pv-compose-mode" id="pvComposeMode" data-mode="comment"><i></i><span>评论</span></span>' +
          '<input class="pv-compose-input" id="pvComposeInput" type="text" placeholder="说点什么，只有这里听得见" maxlength="180" />' +
          '<button class="pv-compose-send" id="pvComposeSend" aria-label="发送"><span class="pvs-drop"></span><span class="pvs-ring"></span></button>' +
        '</div>' +
      '</div>' +
    '</div>' +

    /* ---- 人物名片：点任意头像/昵称浮出 ---- */
    '<div class="pv-veil pv-who-veil" id="pvWhoVeil"></div>' +
    '<div class="pv-who" id="pvWho" aria-hidden="true"><div class="pv-who-card" id="pvWhoCard"></div></div>';

    while (wrap.firstChild) app.appendChild(wrap.firstChild);
    bindShell();
    applyTheme();
    startStatusSync();
  }

  /* 详情页状态栏与主状态栏保持一致 */
  function startStatusSync(){
    function tick(){
      var tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
      var t;
      try{ t = new Date().toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }); }
      catch(e){ t = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }); }
      var el = document.getElementById('pvdTime');
      if (el) el.textContent = t;
      var pct = parseInt(localStorage.getItem('luna_battery') || '76', 10);
      if (isNaN(pct)) pct = 76;
      var p = document.getElementById('pvdBatPct');
      var inner = document.getElementById('pvdBatInner');
      if (p) p.textContent = pct;
      if (inner){
        inner.style.width = pct + '%';
        inner.style.background = pct <= 20 ? 'linear-gradient(90deg,#f87171,#ef4444)' : 'linear-gradient(90deg,#6ee7b7,#34d399)';
      }
      /* 灵动岛：直接复制主状态栏当前的结构，保证观感一致 */
      var src = document.getElementById('statusIsland');
      var dst = document.getElementById('pvdIsland');
      if (src && dst && dst.innerHTML !== src.innerHTML) dst.innerHTML = src.innerHTML;
    }
    tick();
    setInterval(tick, 10000);
  }

  /* ================================================================
     13 · 主页面渲染
  ================================================================ */
  function rootEl(){ return document.getElementById('pvRoot'); }

  function renderRoot(){
    var root = rootEl();
    if (!root) return;
    root.innerHTML = '' +
      '<div class="pv-rail">' +
        '<button class="pv-me" id="pvMeBtn" type="button">' +
          avatarHtml(state.profile, 'pv-ava--me') +
          '<span class="pv-me-text">' +
            '<b id="pvMeName">' + esc(state.profile.name || '未署名的读者') + '</b>' +
            '<em id="pvMeHandle">@' + esc(state.profile.handle || 'anonymous') + '</em>' +
          '</span>' +
          '<span class="pv-me-edit">' + ICON.pen + '</span>' +
        '</button>' +
        '<div class="pv-tools">' +
          '<button class="pv-tool" data-tool="style" type="button" aria-label="文风配置"><span class="pv-tool-halo"></span>' + ICON.quill + '<em>文风</em></button>' +
          '<button class="pv-tool" data-tool="theme" type="button" aria-label="主题"><span class="pv-tool-halo"></span>' + ICON.palette + '<em>主题</em></button>' +
          '<button class="pv-tool" data-tool="fav" type="button" aria-label="收藏"><span class="pv-tool-halo"></span>' + ICON.star + '<em>收藏</em></button>' +
        '</div>' +
      '</div>' +

      '<div class="pv-switch" id="pvSwitch">' +
        '<span class="pv-switch-glider" id="pvSwitchGlider"></span>' +
        '<button class="pv-switch-btn is-active" data-board="char" type="button"><b>角色</b><em>THEIR SECRETS</em></button>' +
        '<button class="pv-switch-btn" data-board="stranger" type="button"><b>陌生人</b><em>STRANGERS</em></button>' +
      '</div>' +

      '<div class="pv-charstrip" id="pvCharStrip"></div>' +

      '<button class="pv-daterail" id="pvDateRail" type="button">' +
        '<span class="pv-daterail-dial">' + ICON.calendar + '</span>' +
        '<span class="pv-daterail-text"><b id="pvDateRailLabel">选择一个日子</b><em id="pvDateRailSub">按日期唤出那一天的秘密</em></span>' +
        '<span class="pv-daterail-arrow"></span>' +
      '</button>' +

      '<div class="pv-feed-scroll" id="pvFeedScroll"><div class="pv-feed" id="pvFeed"></div></div>';

    bindRoot();
    renderSwitch();
    renderCharStrip();
    renderDateRail();
    renderFeed();
  }

  function renderSwitch(){
    var sw = document.getElementById('pvSwitch');
    if (!sw) return;
    var btns = sw.querySelectorAll('.pv-switch-btn');
    btns.forEach(function(b){ b.classList.toggle('is-active', b.dataset.board === state.board); });
    var glider = document.getElementById('pvSwitchGlider');
    var active = sw.querySelector('.pv-switch-btn.is-active');
    if (glider && active){
      glider.style.left = active.offsetLeft + 'px';
      glider.style.width = active.offsetWidth + 'px';
    }
    var strip = document.getElementById('pvCharStrip');
    if (strip) strip.hidden = state.board !== 'char';
  }

  function renderCharStrip(){
    var strip = document.getElementById('pvCharStrip');
    if (!strip) return;
    if (state.board !== 'char'){ strip.hidden = true; return; }
    strip.hidden = false;
    if (!state.chars.length){
      strip.innerHTML = '<div class="pv-charstrip-empty">还没有角色 · 先去创建一个人</div>';
      return;
    }
    strip.innerHTML = state.chars.map(function(c){
      var active = String(c.id) === String(state.charId);
      var person = { name: c.name || '未命名', seed: hashStr(String(c.id)), charAvatar: c.avatar || '' };
      var n = postsBy(function(p){ return p.board === 'char' && p.charId === String(c.id); }).length;
      return '<button class="pv-chip' + (active ? ' is-active' : '') + '" data-char="' + esc(String(c.id)) + '" type="button">' +
        avatarHtml(person, 'pv-ava--chip') +
        '<span class="pv-chip-text"><b>' + esc(c.name || '未命名') + '</b><em>' + (n ? (n + ' 条秘密') : '尚无秘密') + '</em></span>' +
      '</button>';
    }).join('');
  }

  function renderDateRail(){
    var label = document.getElementById('pvDateRailLabel');
    var sub = document.getElementById('pvDateRailSub');
    if (!label) return;
    var d = dateFromKey(state.dateKey);
    var hol = holidayOf(state.dateKey);
    label.textContent = (d.getMonth() + 1) + '月' + d.getDate() + '日 · ' + WEEKDAY_CN[d.getDay()] + (hol ? (' · ' + hol) : '');
    var count = currentPosts().filter(function(p){ return p.date === state.dateKey; }).length;
    if (sub) sub.textContent = count ? ('这一天有 ' + count + ' 条 · 轻触翻阅或再写一条') : '这一天还没有人说话 · 轻触唤起';
  }

  function currentPosts(){
    if (state.board === 'char'){
      if (!state.charId) return [];
      return postsBy(function(p){ return p.board === 'char' && p.charId === String(state.charId); });
    }
    return postsBy(function(p){ return p.board === 'stranger'; });
  }

  function emptyFeedHtml(){
    if (state.board === 'char'){
      if (!state.chars.length){
        return '<div class="pv-empty"><span class="pv-empty-mark"></span>' +
          '<b>这里空着</b><em>先去创建一个角色，Ta 才会有说不出口的话</em></div>';
      }
      return '<div class="pv-empty"><span class="pv-empty-mark"></span>' +
        '<b>Ta 还没有在这里留下什么</b><em>选一个日子，按下墨章，看看那天 Ta 藏着什么</em></div>';
    }
    return '<div class="pv-empty"><span class="pv-empty-mark"></span>' +
      '<b>这条街还没有人经过</b><em>选一个日子，让陌生人们在那天各自说一句真心话</em></div>';
  }

  function renderFeed(){
    var feed = document.getElementById('pvFeed');
    if (!feed) return;
    var list = currentPosts();
    if (!list.length){ feed.innerHTML = emptyFeedHtml(); return; }

    var html = '';
    var lastDate = null;
    list.forEach(function(p, i){
      if (p.date !== lastDate){
        lastDate = p.date;
        var d = dateFromKey(p.date);
        var hol = holidayOf(p.date);
        html += '<div class="pv-daymark">' +
          '<span class="pv-daymark-num">' + pad2(d.getDate()) + '</span>' +
          '<span class="pv-daymark-meta"><b>' + MONTH_CN[d.getMonth()] + ' · ' + WEEKDAY_CN[d.getDay()] + '</b>' +
          (hol ? '<em class="pv-daymark-hol">' + esc(hol) + '</em>' : '') + '</span>' +
          '<span class="pv-daymark-line"></span>' +
        '</div>';
      }
      html += postCardHtml(p, i);
    });
    feed.innerHTML = html;
  }

  function postCardHtml(p, i){
    var author = p.author;
    var isChar = author.kind === 'char';
    var charObj = isChar ? state.chars.filter(function(c){ return String(c.id) === String(p.charId); })[0] : null;
    var personForAva = { name: author.name, seed: author.seed, charAvatar: charObj && charObj.avatar };
    var style = ['a','b','c'][hashStr(p.id) % 3];

    var tags = (p.tags || []).slice(0, 4).map(function(t){ return '<span class="pv-tag">' + esc(t) + '</span>'; }).join('');
    var preview = esc((p.excerpt || blocksPlain(p.blocks)).slice(0, 120));

    return '' +
    '<article class="pv-post pv-post--' + style + '" data-id="' + p.id + '" style="animation-delay:' + Math.min(i * 0.04, 0.32) + 's">' +
      '<span class="pv-post-edge" aria-hidden="true"></span>' +
      '<header class="pv-post-head">' +
        avatarHtml(personForAva, 'pv-ava--post') +
        '<span class="pv-post-who">' +
          '<b>' + esc(displayName(author.name, charObj)) + (isChar ? '<i class="pv-badge pv-badge--char">Ta</i>' : '') + '</b>' +
          '<em>@' + esc(author.handle) + ' · ' + esc(p.time) + (p.place ? (' · ' + esc(p.place)) : '') + '</em>' +
        '</span>' +
        '<span class="pv-post-mood" data-mood="' + p.mood + '"><i></i>' + (MOOD_LABEL[p.mood] || '') + '</span>' +
      '</header>' +
      (author.tagline ? '<div class="pv-post-tagline">' + esc(author.tagline) + '</div>' : '') +
      '<div class="pv-post-body" data-act="open" role="button" tabindex="0">' +
        (p.topic ? '<span class="pv-post-topic">' + esc(p.topic) + '</span>' : '') +
        '<h3 class="pv-post-title">' + esc(p.title) + '</h3>' +
        '<p class="pv-post-preview">' + preview + '</p>' +
        '<span class="pv-post-more">展开这条秘密 · ' + p.wordCount + ' 字<i></i></span>' +
      '</div>' +
      (tags ? '<div class="pv-post-tags">' + tags + '</div>' : '') +
      (p.reposts && p.reposts.length ?
        '<div class="pv-post-quote">' +
          '<span class="pv-post-quote-mark">转发</span>' +
          '<span class="pv-post-quote-text"><b>' + esc(p.reposts[0].name) + '</b>' + esc(p.reposts[0].text) + '</span>' +
        '</div>' : '') +
      (p.comments && p.comments.length ?
        '<div class="pv-post-hotc">' +
          p.comments.slice(0, 2).map(function(c){
            return '<span class="pv-hotc-line"><b>' + esc(c.isAuthor ? displayName(c.name, charObj) : c.name) + (c.isAuthor ? '<i class="pv-badge pv-badge--author">作者</i>' : (c.isUser ? '<i class="pv-badge pv-badge--me">我</i>' : '')) + '</b>' + esc(c.text.slice(0, 42)) + '</span>';
          }).join('') +
        '</div>' : '') +
      '<footer class="pv-post-bar">' +
        '<button class="pv-act' + (p.liked ? ' is-on' : '') + '" data-act="like" type="button">' + ICON.heart + '<em>' + nfmt(p.stats.likes) + '</em></button>' +
        '<button class="pv-act" data-act="open" type="button">' + ICON.comment + '<em>' + nfmt((p.comments || []).length) + '</em></button>' +
        '<button class="pv-act" data-act="open" type="button">' + ICON.repost + '<em>' + nfmt((p.reposts || []).length) + '</em></button>' +
        '<button class="pv-act' + (p.faved ? ' is-on' : '') + '" data-act="fav" type="button">' + ICON.star + '</button>' +
        /* 更新数据：一枚水纹涟漪，而不是按钮 */
        '<button class="pv-pulse" data-act="pulse" type="button" aria-label="更新动态">' +
          '<span class="pvp-r1"></span><span class="pvp-r2"></span><span class="pvp-core"></span>' +
          '<em class="pvp-label">更新</em>' +
        '</button>' +
      '</footer>' +
      '<span class="pv-post-foot"><i></i>' + nfmt(p.stats.views) + ' 次经过 · ' + (p.updates ? (p.updates + ' 次涟漪') : '尚未泛起涟漪') + '</span>' +
    '</article>';
  }

  /* ================================================================
     14 · 详情页
  ================================================================ */
  function getPost(id){ return postCache[id]; }

  /* 评论树渲染：seen 防止 AI 偶发的互相指向造成重复或死循环 */
  function commentHtml(c, post, depth, seen, charObj){
    seen = seen || {};
    if (seen[c.id]) return '';
    seen[c.id] = 1;
    var replies = (post.comments || []).filter(function(x){ return x.replyToId === c.id && !seen[x.id]; });
    var badges = (c.isAuthor ? '<i class="pv-badge pv-badge--author">作者</i>' : '') +
                 (c.isUser ? '<i class="pv-badge pv-badge--me">我</i>' : '');
    /* 只有「作者本人」的评论对应角色卡真名，其他陌生人评论者保持纯网名 */
    var shownName = c.isAuthor ? displayName(c.name, charObj) : c.name;
    return '' +
    '<div class="pv-cm' + (depth ? ' is-reply' : '') + (c.fresh ? ' is-fresh' : '') + '" data-cid="' + c.id + '">' +
      avatarHtml({ name: c.name, seed: c.seed, avatar: c.isUser ? state.profile.avatar : '' }, 'pv-ava--cm') +
      '<div class="pv-cm-main">' +
        '<div class="pv-cm-top"><b' + whoAttrs({ name: shownName, handle: c.handle, role: c.isAuthor ? '作者' : (c.isUser ? '我' : ''), seed: c.seed, avatar: c.isUser ? state.profile.avatar : '' }) + '>' + esc(shownName) + badges + '</b><em>' + relTime(c.ts) + '</em></div>' +
        (c.replyToName ? '<span class="pv-cm-to">回复 ' + esc(c.replyToName) + '</span>' : '') +
        '<p class="pv-cm-text">' + esc(c.text) + '</p>' +
        '<div class="pv-cm-acts">' +
          '<button class="pv-cm-act" data-act="creply" data-cid="' + c.id + '" type="button">回应 Ta</button>' +
          '<button class="pv-cm-like' + (c.liked ? ' is-on' : '') + '" data-act="clike" data-cid="' + c.id + '" type="button">' + ICON.heart + '<em>' + (c.likes || 0) + '</em></button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    replies.map(function(r){ return commentHtml(r, post, 1, seen, charObj); }).join('');
  }

  function commentsTreeHtml(post){
    var all = post.comments || [];
    var isChar = post.author.kind === 'char';
    var charObj = isChar ? state.chars.filter(function(c){ return String(c.id) === String(post.charId); })[0] : null;
    var ids = {};
    all.forEach(function(c){ ids[c.id] = 1; });
    var seen = {};
    var html = all.filter(function(c){ return !c.replyToId || !ids[c.replyToId]; })
                  .map(function(c){ return commentHtml(c, post, 0, seen, charObj); }).join('');
    /* 兜底：任何没被渲染到的评论（互相指向等异常），一律平铺补上 */
    html += all.filter(function(c){ return !seen[c.id]; })
               .map(function(c){ return commentHtml(c, post, 0, seen, charObj); }).join('');
    return html;
  }

  /* ---- 人物名片 ---- */
  function whoAttrs(o){
    return ' data-who="1"' +
      ' data-wname="' + esc(o.name || '') + '"' +
      ' data-whandle="' + esc(o.handle || '') + '"' +
      ' data-wbio="' + esc(o.bio || '') + '"' +
      ' data-wtag="' + esc(o.tagline || '') + '"' +
      ' data-wrole="' + esc(o.role || '') + '"' +
      ' data-wseed="' + (o.seed == null ? '' : o.seed) + '"' +
      ' data-wava="' + (o.avatar ? '1' : '') + '"';
  }
  function openWho(el){
    var post = getPost(state.detailId);
    var name = el.dataset.wname || '';
    var handle = el.dataset.whandle || '';
    var role = el.dataset.wrole || '';
    var seed = el.dataset.wseed ? Number(el.dataset.wseed) : hashStr(name);
    var useMyAva = el.dataset.wava === '1';
    var cn = 0, ln = 0;
    if (post){
      (post.comments || []).forEach(function(c){ if (c.handle === handle){ cn++; ln += (c.likes || 0); } });
    }
    var card = document.getElementById('pvWhoCard');
    if (!card) return;
    card.innerHTML =
      avatarHtml({ name: name, seed: seed, avatar: useMyAva ? state.profile.avatar : '' }, 'pv-ava--big') +
      '<b class="pv-who-name">' + esc(name) + (role ? '<i class="pv-badge pv-badge--char">' + esc(role) + '</i>' : '') + '</b>' +
      '<em class="pv-who-handle">@' + esc(handle) + '</em>' +
      (el.dataset.wbio ? '<p class="pv-who-bio">' + esc(el.dataset.wbio) + '</p>' : '') +
      (el.dataset.wtag ? '<p class="pv-who-tag">' + esc(el.dataset.wtag) + '</p>' : '') +
      '<div class="pv-who-stats"><span><b>' + cn + '</b><em>条留言</em></span><span><b>' + ln + '</b><em>被赞</em></span></div>' +
      '<div class="pv-who-note">这里的人只在这一页存在 · 轻触别处关上</div>';
    var v = document.getElementById('pvWhoVeil');
    var w = document.getElementById('pvWho');
    if (v) v.classList.add('show');
    if (w){ w.classList.add('show'); w.setAttribute('aria-hidden', 'false'); }
    vibrate(5);
  }
  function closeWho(){
    var v = document.getElementById('pvWhoVeil');
    var w = document.getElementById('pvWho');
    if (v) v.classList.remove('show');
    if (w){ w.classList.remove('show'); w.setAttribute('aria-hidden', 'true'); }
  }

  function renderDetail(){
    var post = getPost(state.detailId);
    var inner = document.getElementById('pvDetailInner');
    if (!post || !inner) return;
    var d = dateFromKey(post.date);
    var hol = holidayOf(post.date);
    var isChar = post.author.kind === 'char';
    var charObj = isChar ? state.chars.filter(function(c){ return String(c.id) === String(post.charId); })[0] : null;
    var ava = { name: post.author.name, seed: post.author.seed, charAvatar: charObj && charObj.avatar };


    inner.innerHTML = '' +
      '<div class="pvd-hero"' + whoAttrs({ name: displayName(post.author.name, charObj), handle: post.author.handle, bio: post.author.bio, tagline: post.author.tagline, role: isChar ? 'Ta' : '作者', seed: post.author.seed }) + '>' +
        '<span class="pvd-hero-aura"></span>' +
        avatarHtml(ava, 'pv-ava--hero') +
        '<div class="pvd-hero-text">' +
          '<b>' + esc(displayName(post.author.name, charObj)) + (isChar ? '<i class="pv-badge pv-badge--char">Ta</i>' : '') + '</b>' +
          '<em>@' + esc(post.author.handle) + '</em>' +
          (post.author.bio ? '<span class="pvd-hero-bio">' + esc(post.author.bio) + '</span>' : '') +
          (post.author.tagline ? '<span class="pvd-hero-tag">' + esc(post.author.tagline) + '</span>' : '') +
        '</div>' +
      '</div>' +

      '<div class="pvd-datemark">' +
        '<span class="pvd-day">' + pad2(d.getDate()) + '</span>' +
        '<span class="pvd-dmeta"><b>' + WEEKDAY_CN[d.getDay()] + '</b><em>' + MONTH_EN[d.getMonth()] + ' ' + d.getFullYear() + '</em></span>' +
        '<span class="pvd-dchips">' +
          '<i data-mood="' + post.mood + '">' + (MOOD_LABEL[post.mood] || '') + '</i>' +
          (post.place ? '<i>' + esc(post.place) + '</i>' : '') +
          (hol ? '<i class="is-hol">' + esc(hol) + '</i>' : '') +
          '<i>' + esc(post.time) + '</i>' +
        '</span>' +
      '</div>' +

      '<h1 class="pvd-title">' + esc(post.title) + '</h1>' +
      '<div class="pvd-body">' + blocksHtml(post.blocks) + '</div>' +
      (post.tags && post.tags.length ? '<div class="pvd-tags">' + post.tags.map(function(t){ return '<span class="pv-tag">' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
      '<div class="pvd-wc"><span></span>' + post.wordCount + ' 字 · ' + nfmt(post.stats.views) + ' 次经过<span></span></div>' +

      /* 互动总条：点赞 / 收藏 / 涟漪更新 */
      '<div class="pvd-actbar">' +
        '<button class="pv-act pv-act--lg' + (post.liked ? ' is-on' : '') + '" data-act="like" type="button">' + ICON.heart + '<em>' + nfmt(post.stats.likes) + '</em></button>' +
        '<button class="pv-act pv-act--lg' + (post.faved ? ' is-on' : '') + '" data-act="fav" type="button">' + ICON.star + '<em>收藏</em></button>' +
        '<button class="pv-pulse pv-pulse--lg" data-act="pulse" type="button" aria-label="更新动态">' +
          '<span class="pvp-r1"></span><span class="pvp-r2"></span><span class="pvp-core"></span>' +
          '<em class="pvp-label">轻触，让时间往前走一点</em>' +
        '</button>' +
      '</div>' +

      /* 点赞区 */
      '<section class="pvd-sect">' +
        '<div class="pvd-sect-head"><b>点赞区</b><em>' + nfmt(post.stats.likes) + ' 人按下了那颗心</em></div>' +
        '<div class="pvd-likers">' +
          (post.likers || []).slice(0, 18).map(function(l){
            return '<span class="pvd-liker"' + whoAttrs({ name: l.name, handle: l.handle, seed: l.seed }) + '>' + avatarHtml(l, 'pv-ava--sm') + '<i>' + esc(l.name) + '</i></span>';
          }).join('') +
          (post.liked ? '<span class="pvd-liker is-me">' + avatarHtml(state.profile, 'pv-ava--sm') + '<i>我</i></span>' : '') +
        '</div>' +
      '</section>' +

      /* 转发区 */
      '<section class="pvd-sect">' +
        '<div class="pvd-sect-head"><b>转发区</b><em>' + nfmt((post.reposts || []).length) + ' 次被带去别处</em></div>' +
        ((post.reposts || []).length
          ? '<div class="pvd-reposts">' + post.reposts.map(function(r){
              return '<div class="pvd-rp' + (r.fresh ? ' is-fresh' : '') + '" data-rid="' + r.id + '">' +
                avatarHtml({ name: r.name, seed: r.seed, avatar: r.isUser ? state.profile.avatar : '' }, 'pv-ava--cm') +
                '<div class="pvd-rp-main">' +
                  '<div class="pv-cm-top"><b' + whoAttrs({ name: r.name, handle: r.handle, role: r.isUser ? '我' : '', seed: r.seed, avatar: r.isUser ? state.profile.avatar : '' }) + '>' + esc(r.name) + (r.isUser ? '<i class="pv-badge pv-badge--me">我</i>' : '') + '</b><em>' + relTime(r.ts) + '</em></div>' +
                  '<p>' + esc(r.text) + '</p>' +
                  '<span class="pvd-rp-src">引用 · ' + esc(post.title) + '</span>' +
                '</div>' +
                '<button class="pv-cm-like' + (r.liked ? ' is-on' : '') + '" data-act="rlike" data-rid="' + r.id + '" type="button">' + ICON.heart + '<em>' + (r.likes || 0) + '</em></button>' +
              '</div>';
            }).join('') + '</div>'
          : '<div class="pvd-void">还没有人把它带走</div>') +
      '</section>' +

      /* 评论区 */
      '<section class="pvd-sect pvd-sect--cm">' +
        '<div class="pvd-sect-head"><b>评论区</b><em>' + (post.comments || []).length + ' 条回声</em></div>' +
        ((post.comments || []).length
          ? '<div class="pvd-cms">' + commentsTreeHtml(post) + '</div>'
          : '<div class="pvd-void">这里安静得能听见自己</div>') +
      '</section>' +
      '<div class="pvd-pad"></div>';

    var name = document.getElementById('pvDetailTopName');
    var sub = document.getElementById('pvDetailTopSub');
    if (name) name.textContent = post.author.name;
    if (sub) sub.textContent = (isChar ? '不曾写进日记的那一页' : '一个陌生人的深夜');
    var favBtn = document.getElementById('pvDetailFav');
    if (favBtn) favBtn.classList.toggle('is-on', !!post.faved);

    /* 已读进度条 */
    var scroll = document.getElementById('pvDetailScroll');
    var bar = document.querySelector('#pvDetailProgress i');
    if (scroll && bar){
      scroll.onscroll = function(){
        var max = scroll.scrollHeight - scroll.clientHeight;
        bar.style.width = (max > 0 ? clamp(scroll.scrollTop / max, 0, 1) * 100 : 0) + '%';
      };
    }
  }

  function openDetail(id){
    state.detailId = id;
    state.replyTarget = null;
    buildShell();
    renderDetail();
    updateComposeUI();
    var veil = document.getElementById('pvDetailVeil');
    var page = document.getElementById('pvDetail');
    if (veil) veil.classList.add('show');
    if (page){ page.classList.add('show'); page.setAttribute('aria-hidden', 'false'); }
    var s = document.getElementById('pvDetailScroll');
    if (s) s.scrollTop = 0;
    vibrate(6);
  }
  function closeDetail(){
    var veil = document.getElementById('pvDetailVeil');
    var page = document.getElementById('pvDetail');
    if (veil) veil.classList.remove('show');
    if (page){ page.classList.remove('show'); page.setAttribute('aria-hidden', 'true'); }
    state.detailId = null;
    renderFeed();
  }

  function updateComposeUI(){
    var wrap = document.getElementById('pvComposeReply');
    var text = document.getElementById('pvComposeReplyText');
    var mode = document.getElementById('pvComposeMode');
    if (!wrap) return;
    if (state.replyTarget){
      wrap.hidden = false;
      text.textContent = '正在回应 ' + state.replyTarget.name;
    } else {
      wrap.hidden = true;
    }
    if (mode){
      var m = mode.dataset.mode;
      mode.querySelector('span').textContent = m === 'repost' ? '引用' : '评论';
      var input = document.getElementById('pvComposeInput');
      if (input) input.placeholder = m === 'repost' ? '写下你要带走它的理由' : '说点什么，只有这里听得见';
    }
  }

  /* ================================================================
     15 · 互动写入
  ================================================================ */
  function toggleLike(post){
    post.liked = !post.liked;
    post.stats.likes += post.liked ? 1 : -1;
    if (post.stats.likes < 0) post.stats.likes = 0;
    putPost(post);
    vibrate(8);
  }
  function toggleFav(post){
    post.faved = !post.faved;
    putPost(post);
    vibrate(8);
  }
  function submitCompose(){
    var post = getPost(state.detailId);
    var input = document.getElementById('pvComposeInput');
    var mode = document.getElementById('pvComposeMode');
    if (!post || !input) return;
    var txt = input.value.trim();
    if (!txt) return;
    var me = state.profile;
    var meName = me.name || '未署名的读者';
    if (mode && mode.dataset.mode === 'repost'){
      post.reposts.unshift({
        id: 'r_' + uid(), name: meName, handle: me.handle || 'me', seed: hashStr(meName),
        text: txt, likes: 0, liked: false, ts: Date.now(), isUser: true, fresh: true
      });
    } else {
      var target = state.replyTarget;
      post.comments.push({
        id: 'c_' + uid(), name: meName, handle: me.handle || 'me', seed: hashStr(meName),
        text: txt, isAuthor: false, isUser: true, likes: 0, liked: false,
        replyToId: target ? target.id : null, replyToName: target ? target.name : '',
        ts: Date.now(), fresh: true
      });
    }
    input.value = '';
    state.replyTarget = null;
    putPost(post).then(function(){
      renderDetail();
      updateComposeUI();
      toast('已落笔 · 轻触涟漪，看看谁会回你');
    });
    vibrate(10);
  }

  var toastTimer = null;
  function toast(msg){
    var el = document.getElementById('pvToast');
    if (!el){
      el = document.createElement('div');
      el.id = 'pvToast';
      el.className = 'pv-toast';
      (document.querySelector('.diary-app') || document.body).appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ el.classList.remove('show'); }, 2600);
  }

  function doPulse(post, btn){
    if (state.working) return;
    if (btn) btn.classList.add('is-working');
    state.working = true;
    runUpdate(post, function(stage){ if (btn) btn.setAttribute('data-stage', stage); })
      .then(function(res){
        state.working = false;
        if (btn) btn.classList.remove('is-working');
        vibrate(14);
        toast('涟漪扩散 · 点赞 +' + res.likeDelta + ' · 新评论 ' + res.comments + ' 条');
        if (state.detailId === post.id) renderDetail();
        renderFeed();
      })
      .catch(function(err){
        state.working = false;
        if (btn) btn.classList.remove('is-working');
        toast((err && err.message) ? String(err.message).slice(0, 48) : '这次没能更新');
      });
  }

  /* ================================================================
     16 · 日历 + 生成仪式
  ================================================================ */
  function openCal(){
    buildShell();
    state.calMonth = dateFromKey(state.dateKey);
    renderCal();
    refreshQuill();
    var v = document.getElementById('pvCalVeil');
    var m = document.getElementById('pvCalModal');
    if (v) v.classList.add('show');
    if (m){ m.classList.add('show'); m.setAttribute('aria-hidden', 'false'); }
    var t = document.getElementById('pvCalTitle');
    if (t) t.textContent = state.board === 'char' ? '翻阅 Ta 的秘密' : '翻阅这条街';
  }
  function closeCal(){
    var v = document.getElementById('pvCalVeil');
    var m = document.getElementById('pvCalModal');
    if (v) v.classList.remove('show');
    if (m){ m.classList.remove('show'); m.setAttribute('aria-hidden', 'true'); }
  }

  function renderCal(){
    var grid = document.getElementById('pvCalGrid');
    if (!grid) return;
    var y = state.calMonth.getFullYear(), m = state.calMonth.getMonth();
    var en = document.getElementById('pvCalMonthEn');
    var cn = document.getElementById('pvCalMonthCn');
    if (en) en.textContent = MONTH_EN[m];
    if (cn) cn.textContent = y + ' · ' + MONTH_CN[m];

    var first = new Date(y, m, 1);
    var startIdx = (first.getDay() + 6) % 7;   /* 周一起始 */
    var days = new Date(y, m + 1, 0).getDate();
    var today = new Date(); today.setHours(0,0,0,0);
    var have = {};
    currentPosts().forEach(function(p){ have[p.date] = (have[p.date] || 0) + 1; });

    var html = '';
    for (var i = 0; i < startIdx; i++) html += '<span class="pv-cal-cell is-void"></span>';
    for (var dnum = 1; dnum <= days; dnum++){
      var key = y + '-' + pad2(m + 1) + '-' + pad2(dnum);
      var dt = new Date(y, m, dnum);
      var cls = 'pv-cal-cell';
      if (key === state.dateKey) cls += ' is-sel';
      if (dt.getTime() === today.getTime()) cls += ' is-today';
      if (dt > today) cls += ' is-future';
      if (holidayOf(key)) cls += ' is-holiday';
      if (have[key]) cls += ' is-has';
      html += '<button class="' + cls + '" data-key="' + key + '" type="button">' +
        '<b>' + dnum + '</b>' +
        (holidayOf(key) ? '<em>' + esc(holidayOf(key)) + '</em>' : '') +
        (have[key] ? '<i class="pv-cal-dot"></i>' : '') +
      '</button>';
    }
    grid.innerHTML = html;
  }

  function setQuill(st, eyebrow, line, hint){
    var w = document.getElementById('pvQuill');
    if (!w) return;
    w.setAttribute('data-state', st);
    var a = document.getElementById('pvQuillEyebrow');
    var b = document.getElementById('pvQuillLine');
    var c = document.getElementById('pvQuillHint');
    if (eyebrow != null && a) a.textContent = eyebrow;
    if (line != null && b) b.textContent = line;
    if (hint != null && c) c.textContent = hint;
  }
  function describeDay(k){
    var d = dateFromKey(k);
    var h = holidayOf(k);
    return MONTH_CN[d.getMonth()] + d.getDate() + '日 · ' + WEEKDAY_CN[d.getDay()] + (h ? (' · ' + h) : '');
  }
  function refreshQuill(){
    var k = state.dateKey;
    var d = dateFromKey(k);
    var today = new Date(); today.setHours(0,0,0,0);
    if (state.board === 'char' && !state.charId){
      setQuill('idle', '先选一个角色', '上面那一排里，挑一个人', '选好之后再按墨章');
      return;
    }
    if (d > today){ setQuill('future', describeDay(k), '这一天还没有到来', '未来还不能被读到'); return; }
    var n = currentPosts().filter(function(p){ return p.date === k; }).length;
    if (n){
      setQuill('done', describeDay(k), '这一天已有 ' + n + ' 条', '再按一次，会有新的人开口');
    } else {
      setQuill('idle', describeDay(k),
        state.board === 'char' ? '看看那天 Ta 藏着什么' : '看看那天谁在深夜说话',
        '按下墨章');
    }
  }

  function ensureCfgReady(){
    if (!state.cfg) state.cfg = JSON.parse(JSON.stringify(DEFAULT_CFG));
    if (!state.profile) state.profile = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
  }

  function runGenerate(){
    if (state.working) return;
    ensureCfgReady();
    var k = state.dateKey;
    var d = dateFromKey(k), today = new Date(); today.setHours(0,0,0,0);
    if (d > today){ refreshQuill(); return; }

    var char = null;
    if (state.board === 'char'){
      char = state.chars.filter(function(c){ return String(c.id) === String(state.charId); })[0];
      if (!char){ setQuill('idle', '先选一个角色', '上面那一排里，挑一个人', '选好之后再按墨章'); return; }
    }

    state.working = true;
    vibrate(12);
    setQuill('working', describeDay(k), '正在落笔', '准备中');

    var prior = currentPosts().filter(function(p){ return p.date === k; })
      .map(function(p){ return { title: p.title, excerpt: p.excerpt }; });

    var chain;
    if (state.board === 'char'){
      chain = loadIdentityFor(char.id).then(function(identity){
        setQuill('working', null, null, identity ? ('已绑定「' + (identity.name || '身份') + '」') : '未绑定身份 · 依人设书写');
        var count = 1 + (hashStr(char.id + k + prior.length) % 100 < 26 ? 1 : 0);
        var msgs = buildCharPrompt({
          char: char, identity: identity, profile: state.profile, cfg: state.cfg,
          dateKey: k, holiday: holidayOf(k), count: count, prior: prior
        });
        setQuill('working', null, null, '落笔中 · 共 ' + count + ' 条');
        return generatePosts(msgs, 'char', k, char.id, function(s){ setQuill('working', null, null, s); });
      });
    } else {
      var count = clamp(parseInt(state.cfg.strangerCount, 10) || 3, 1, 6);
      var msgs = buildStrangerPrompt({
        cfg: state.cfg, profile: state.profile, dateKey: k, holiday: holidayOf(k), count: count
      });
      setQuill('working', null, null, '这条街上 ' + count + ' 个人正在开口');
      chain = generatePosts(msgs, 'stranger', k, null, function(s){ setQuill('working', null, null, s); });
    }

    chain.then(function(posts){
      return Promise.all(posts.map(function(p){ return putPost(p); })).then(function(){ return posts; });
    }).then(function(posts){
      state.working = false;
      vibrate(16);
      setQuill('done', describeDay(k), '写好了 · 共 ' + posts.length + ' 条', '关掉日历，去读读看');
      renderCal();
      renderDateRail();
      renderFeed();
      setTimeout(function(){ closeCal(); }, 700);
    }).catch(function(err){
      state.working = false;
      setQuill('error', describeDay(k), '这一次没能写成', (err && err.message) ? String(err.message).slice(0, 46) : '请再按一次墨章');
    });
  }

  /* ================================================================
     17 · 抽屉：我的资料 / 文风配置 / 主题 / 收藏
  ================================================================ */
  function openSheet(kind){
    buildShell();
    var titleMap = { profile: '我的资料', style: '文风与生成配置', theme: '页面主题', fav: '我的收藏' };
    var t = document.getElementById('pvSheetTitle');
    if (t) t.textContent = titleMap[kind] || '';
    var body = document.getElementById('pvSheetBody');
    if (body){
      body.dataset.kind = kind;
      body.innerHTML = kind === 'profile' ? profileSheetHtml()
                     : kind === 'style'   ? styleSheetHtml()
                     : kind === 'theme'   ? themeSheetHtml()
                     : favSheetHtml();
      body.scrollTop = 0;
    }
    var v = document.getElementById('pvVeil');
    var s = document.getElementById('pvSheet');
    if (v) v.classList.add('show');
    if (s){ s.classList.add('show'); s.setAttribute('aria-hidden', 'false'); }
  }
  function closeSheet(){
    var v = document.getElementById('pvVeil');
    var s = document.getElementById('pvSheet');
    if (v) v.classList.remove('show');
    if (s){ s.classList.remove('show'); s.setAttribute('aria-hidden', 'true'); }
  }
  function refreshSheet(){
    var body = document.getElementById('pvSheetBody');
    if (!body || !body.dataset.kind) return;
    var top = body.scrollTop;
    var kind = body.dataset.kind;
    body.innerHTML = kind === 'profile' ? profileSheetHtml()
                   : kind === 'style'   ? styleSheetHtml()
                   : kind === 'theme'   ? themeSheetHtml()
                   : favSheetHtml();
    body.scrollTop = top;
  }

  function fieldHtml(label, sub, inner){
    return '<div class="pv-field"><div class="pv-field-label"><b>' + esc(label) + '</b>' +
      (sub ? '<em>' + esc(sub) + '</em>' : '') + '</div>' + inner + '</div>';
  }
  function chipsHtml(field, opts, current, multi){
    var cur = multi ? (current || []) : [current];
    return '<div class="pv-chips">' + opts.map(function(o){
      var on = cur.indexOf(o) !== -1;
      return '<button class="pv-cchip' + (on ? ' is-on' : '') + '" type="button" data-cfg="' + field + '" data-val="' + esc(o) + '" data-multi="' + (multi ? 1 : 0) + '">' + esc(o) + '</button>';
    }).join('') + '</div>';
  }

  function profileSheetHtml(){
    var p = state.profile;
    return '' +
      '<div class="pv-prof-head">' +
        '<button class="pv-prof-ava" id="pvAvaBtn" type="button">' +
          avatarHtml(p, 'pv-ava--big') +
          '<span class="pv-prof-ava-edit">' + ICON.pen + '</span>' +
        '</button>' +
        '<div class="pv-prof-hint">轻触头像更换 · 图片只存在这台设备上</div>' +
        '<input type="file" id="pvAvaInput" accept="image/*" hidden />' +
      '</div>' +
      fieldHtml('昵称', '会出现在你发出的每一条评论上',
        '<input class="pv-input" data-prof="name" type="text" maxlength="20" value="' + esc(p.name) + '" placeholder="给自己起一个网名" />') +
      fieldHtml('账号名', '@ 后面的那一串，英文或数字',
        '<input class="pv-input" data-prof="handle" type="text" maxlength="20" value="' + esc(p.handle) + '" placeholder="anonymous" />') +
      fieldHtml('个性签名', '别人点开你的名字时会看到',
        '<textarea class="pv-input pv-textarea" data-prof="bio" maxlength="60" rows="2" placeholder="一句话，说给谁听都行">' + esc(p.bio) + '</textarea>') +
      fieldHtml('标签', '用顿号或逗号分隔，最多 5 个',
        '<input class="pv-input" data-prof="tags" type="text" value="' + esc((p.tags || []).join('、')) + '" placeholder="失眠、旧唱片、总在深夜写字" />') +
      '<div class="pv-sheet-actions">' +
        '<button class="pv-ghost-btn" data-act="profReset" type="button">清空</button>' +
        '<button class="pv-main-btn" data-act="profSave" type="button"><span class="pv-main-btn-glow"></span><span>保存资料</span></button>' +
      '</div>';
  }

  function styleSheetHtml(){
    var c = state.cfg;
    var presets = state.presets || [];
    return '' +
      '<div class="pv-sect-mark"><i></i>文笔</div>' +
      fieldHtml('文笔风格', '决定句子的骨架与温度', chipsHtml('voice', VOICE_OPTS, c.voice, false) +
        '<input class="pv-input pv-input--sub" data-cfg-text="voiceCustom" type="text" maxlength="60" value="' + esc(c.voiceCustom) + '" placeholder="自定义补充：例如 像给旧友写信那样" />') +
      fieldHtml('情绪浓度', ['极淡','克制','明显','浓烈'][clamp(c.density,1,4)-1],
        '<div class="pv-slider" data-cfg-slider="density">' +
          [1,2,3,4].map(function(n){ return '<button class="pv-slider-node' + (c.density >= n ? ' is-on' : '') + '" data-val="' + n + '" type="button"><i></i></button>'; }).join('') +
          '<span class="pv-slider-track"></span>' +
        '</div>') +
      fieldHtml('篇幅', '底线永远是 500 字', chipsHtml('length', LEN_OPTS, c.length, false)) +
      fieldHtml('人称', '', chipsHtml('person', PERSON_OPTS, c.person, false)) +
      fieldHtml('时代底色', '', chipsHtml('era', ERA_OPTS, c.era, false)) +

      '<div class="pv-sect-mark"><i></i>题材</div>' +
      fieldHtml('题材偏好', '可多选，模型会从中取材', chipsHtml('topics', TOPIC_OPTS, c.topics, true) +
        '<input class="pv-input pv-input--sub" data-cfg-text="topicCustom" type="text" maxlength="40" value="' + esc(c.topicCustom) + '" placeholder="自定义题材：例如 便利店夜班" />') +

      '<div class="pv-sect-mark"><i></i>陌生人</div>' +
      fieldHtml('年龄段', '', chipsHtml('ageRange', AGE_OPTS, c.ageRange, false)) +
      fieldHtml('地域', '', chipsHtml('region', REGION_OPTS, c.region, false)) +
      fieldHtml('职业倾向', '', chipsHtml('jobStyle', JOB_OPTS, c.jobStyle, false)) +
      fieldHtml('昵称风格', '所有网名都按这个感觉生成', chipsHtml('nickStyle', NICK_OPTS, c.nickStyle, false) +
        '<input class="pv-input pv-input--sub" data-cfg-text="nickCustom" type="text" maxlength="40" value="' + esc(c.nickCustom) + '" placeholder="自定义昵称风格：例如 全部小写英文单词" />') +
      fieldHtml('一次生成几人', '', chipsHtml('strangerCount', [1,2,3,4,5,6], c.strangerCount, false)) +

      '<div class="pv-sect-mark"><i></i>社区氛围</div>' +
      fieldHtml('评论区氛围', '', chipsHtml('commentMood', CMOOD_OPTS, c.commentMood, false)) +
      fieldHtml('每条评论数', '', chipsHtml('commentCount', [3,4,5,6,8], c.commentCount, false)) +
      fieldHtml('允许提到我', '关掉后，陌生人不会知道有你这个读者',
        '<button class="pv-toggle' + (c.allowMentionUser ? ' is-on' : '') + '" data-cfg-toggle="allowMentionUser" type="button"><i></i></button>') +
      fieldHtml('额外要求', '优先级最高，直接写给模型',
        '<textarea class="pv-input pv-textarea" data-cfg-text="extra" rows="3" maxlength="400" placeholder="例如：不要出现校园题材；多写雨天；句子短一点">' + esc(c.extra) + '</textarea>') +

      '<div class="pv-sect-mark"><i></i>预设存档</div>' +
      '<div class="pv-preset-add">' +
        '<input class="pv-input" id="pvPresetName" type="text" maxlength="16" placeholder="给这套配置起个名字" />' +
        '<button class="pv-ghost-btn" data-act="presetSave" type="button">' + ICON.plus + '存档</button>' +
      '</div>' +
      (presets.length
        ? '<div class="pv-presets">' + presets.map(function(ps){
            return '<div class="pv-preset" data-pid="' + ps.id + '">' +
              '<span class="pv-preset-text"><b>' + esc(ps.name) + '</b><em>' + esc(ps.cfg.voice) + ' · ' + esc(ps.cfg.length) + ' 字</em></span>' +
              '<button class="pv-preset-use" data-act="presetUse" data-pid="' + ps.id + '" type="button">调用</button>' +
              '<button class="pv-preset-del" data-act="presetDel" data-pid="' + ps.id + '" type="button">' + ICON.close + '</button>' +
            '</div>';
          }).join('') + '</div>'
        : '<div class="pv-void-mini">还没有存档 · 调好一套就存下来，之后一键取用</div>') +

      '<div class="pv-sheet-actions">' +
        '<button class="pv-ghost-btn" data-act="cfgReset" type="button">恢复默认</button>' +
        '<button class="pv-main-btn" data-act="cfgSave" type="button"><span class="pv-main-btn-glow"></span><span>保存配置</span></button>' +
      '</div>';
  }

  function themeSheetHtml(){
    return '<div class="pv-themes">' + THEMES.map(function(t){
      return '<button class="pv-theme' + (state.theme === t.id ? ' is-on' : '') + '" data-theme="' + t.id + '" type="button">' +
        '<span class="pv-theme-swatch pv-theme-swatch--' + t.id + '"></span>' +
        '<b>' + t.name + '</b><em>' + t.sub + '</em>' +
        '<i class="pv-theme-check">' + ICON.check + '</i>' +
      '</button>';
    }).join('') + '</div>' +
    '<p class="pv-void-mini">主题会同时作用于私密页与详情页，状态栏与内容区共用同一层底色。</p>';
  }

  function favSheetHtml(){
    var favs = postsBy(function(p){ return p.faved; });
    if (!favs.length) return '<div class="pv-void-mini">还没有收藏 · 读到心里去的那条，按下那颗星</div>';
    return '<div class="pv-favs">' + favs.map(function(p){
      var d = dateFromKey(p.date);
      return '<button class="pv-fav" data-act="favOpen" data-id="' + p.id + '" type="button">' +
        '<span class="pv-fav-date"><b>' + pad2(d.getDate()) + '</b><em>' + MONTH_EN[d.getMonth()].slice(0,3) + '</em></span>' +
        '<span class="pv-fav-text"><b>' + esc(p.title) + '</b><em>' + esc(p.author.name) + ' · ' + p.wordCount + ' 字</em></span>' +
        '<span class="pv-fav-arrow"></span>' +
      '</button>';
    }).join('') + '</div>';
  }

  /* ================================================================
     18 · 事件绑定
  ================================================================ */
  function bindRoot(){
    var root = rootEl();
    if (!root || root.dataset.bound === '1') return;
    root.dataset.bound = '1';

    root.addEventListener('click', function(e){
      var t = e.target;

      var swBtn = t.closest ? t.closest('.pv-switch-btn') : null;
      if (swBtn){
        if (swBtn.dataset.board === state.board) return;
        state.board = swBtn.dataset.board;
        vibrate(6);
        renderSwitch(); renderCharStrip(); renderDateRail(); renderFeed();
        kvSet('board', state.board);
        return;
      }

      var chip = t.closest ? t.closest('.pv-chip[data-char]') : null;
      if (chip){
        state.charId = chip.dataset.char;
        kvSet('charId', state.charId);
        vibrate(6);
        renderCharStrip(); renderDateRail(); renderFeed();
        return;
      }

      if (t.closest && t.closest('#pvMeBtn')){ openSheet('profile'); return; }

      var tool = t.closest ? t.closest('.pv-tool') : null;
      if (tool){ openSheet(tool.dataset.tool); return; }

      if (t.closest && t.closest('#pvDateRail')){ openCal(); return; }

      var act = t.closest ? t.closest('[data-act]') : null;
      if (act){
        var card = act.closest('.pv-post');
        if (!card) return;
        var post = getPost(card.dataset.id);
        if (!post) return;
        var a = act.dataset.act;
        if (a === 'open'){ openDetail(post.id); return; }
        if (a === 'like'){ toggleLike(post); renderFeed(); return; }
        if (a === 'fav'){ toggleFav(post); renderFeed(); toast(post.faved ? '已收藏' : '已取消收藏'); return; }
        if (a === 'pulse'){ doPulse(post, act); return; }
      }
    });
  }

  function bindShell(){
    /* --- 抽屉 --- */
    var veil = document.getElementById('pvVeil');
    if (veil) veil.addEventListener('click', closeSheet);
    var sc = document.getElementById('pvSheetClose');
    if (sc) sc.addEventListener('click', closeSheet);

    var body = document.getElementById('pvSheetBody');
    if (body){
      body.addEventListener('click', function(e){
        var t = e.target;

        /* 头像上传 */
        if (t.closest && t.closest('#pvAvaBtn')){
          var inp = document.getElementById('pvAvaInput');
          if (inp) inp.click();
          return;
        }

        /* 配置：选项 chip */
        var cchip = t.closest ? t.closest('.pv-cchip') : null;
        if (cchip){
          var f = cchip.dataset.cfg, v = cchip.dataset.val;
          if (cchip.dataset.multi === '1'){
            var arr = (state.cfg[f] || []).slice();
            var idx = arr.indexOf(v);
            if (idx === -1) arr.push(v); else arr.splice(idx, 1);
            state.cfg[f] = arr;
          } else {
            state.cfg[f] = isNaN(Number(v)) || v === '' ? v : Number(v);
          }
          vibrate(4);
          refreshSheet();
          return;
        }

        /* 配置：浓度滑条 */
        var node = t.closest ? t.closest('.pv-slider-node') : null;
        if (node){
          state.cfg.density = parseInt(node.dataset.val, 10) || 2;
          refreshSheet();
          return;
        }

        /* 配置：开关 */
        var tg = t.closest ? t.closest('[data-cfg-toggle]') : null;
        if (tg){
          var key = tg.dataset.cfgToggle;
          state.cfg[key] = !state.cfg[key];
          refreshSheet();
          return;
        }

        /* 主题 */
        var th = t.closest ? t.closest('.pv-theme') : null;
        if (th){
          state.theme = th.dataset.theme;
          kvSet('theme', state.theme);
          applyTheme();
          vibrate(6);
          refreshSheet();
          return;
        }

        var act = t.closest ? t.closest('[data-act]') : null;
        if (!act) return;
        var a = act.dataset.act;

        if (a === 'profSave'){
          var b = document.getElementById('pvSheetBody');
          var get = function(k){ var el = b.querySelector('[data-prof="' + k + '"]'); return el ? el.value.trim() : ''; };
          state.profile.name = get('name').slice(0, 20);
          state.profile.handle = get('handle').replace(/^@/, '').slice(0, 20);
          state.profile.bio = get('bio').slice(0, 60);
          state.profile.tags = get('tags').split(/[、,，\s]+/).filter(Boolean).slice(0, 5);
          if (!state.profile.createdAt) state.profile.createdAt = Date.now();
          kvSet('profile', state.profile).then(function(){
            renderRoot();
            toast('资料已存好');
            closeSheet();
          });
          return;
        }
        if (a === 'profReset'){
          state.profile = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
          kvSet('profile', state.profile).then(function(){ refreshSheet(); renderRoot(); });
          return;
        }
        if (a === 'cfgSave'){
          kvSet('cfg', state.cfg).then(function(){ toast('配置已保存'); closeSheet(); });
          return;
        }
        if (a === 'cfgReset'){
          state.cfg = JSON.parse(JSON.stringify(DEFAULT_CFG));
          kvSet('cfg', state.cfg).then(refreshSheet);
          return;
        }
        if (a === 'presetSave'){
          var nameEl = document.getElementById('pvPresetName');
          var nm = nameEl && nameEl.value.trim();
          if (!nm){ toast('先给这套配置起个名字'); return; }
          state.presets.push({ id: 'ps_' + uid(), name: nm.slice(0, 16), cfg: JSON.parse(JSON.stringify(state.cfg)), ts: Date.now() });
          kvSet('presets', state.presets).then(function(){ refreshSheet(); toast('已存档'); });
          return;
        }
        if (a === 'presetUse'){
          var ps = state.presets.filter(function(x){ return x.id === act.dataset.pid; })[0];
          if (!ps) return;
          state.cfg = JSON.parse(JSON.stringify(ps.cfg));
          kvSet('cfg', state.cfg).then(function(){ refreshSheet(); toast('已调用「' + ps.name + '」'); });
          return;
        }
        if (a === 'presetDel'){
          state.presets = state.presets.filter(function(x){ return x.id !== act.dataset.pid; });
          kvSet('presets', state.presets).then(refreshSheet);
          return;
        }
        if (a === 'favOpen'){
          closeSheet();
          setTimeout(function(){ openDetail(act.dataset.id); }, 220);
          return;
        }
      });

      /* 文本类输入即时写入 state（避免重渲染时丢失） */
      body.addEventListener('input', function(e){
        var el = e.target;
        if (el.dataset && el.dataset.cfgText){ state.cfg[el.dataset.cfgText] = el.value; }
      });
    }

    /* 头像文件 */
    document.addEventListener('change', function(e){
      if (e.target && e.target.id === 'pvAvaInput'){
        var f = e.target.files && e.target.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function(){
          state.profile.avatar = reader.result;
          kvSet('profile', state.profile).then(function(){ refreshSheet(); renderRoot(); toast('头像已更换'); });
        };
        reader.readAsDataURL(f);
      }
    });

    /* --- 日历 --- */
    var cv = document.getElementById('pvCalVeil');
    if (cv) cv.addEventListener('click', closeCal);
    var cc = document.getElementById('pvCalClose');
    if (cc) cc.addEventListener('click', closeCal);
    var prev = document.getElementById('pvCalPrev');
    var next = document.getElementById('pvCalNext');
    if (prev) prev.addEventListener('click', function(){ state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() - 1, 1); renderCal(); });
    if (next) next.addEventListener('click', function(){ state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + 1, 1); renderCal(); });
    var grid = document.getElementById('pvCalGrid');
    if (grid) grid.addEventListener('click', function(e){
      var cell = e.target.closest && e.target.closest('.pv-cal-cell[data-key]');
      if (!cell) return;
      state.dateKey = cell.dataset.key;
      vibrate(5);
      renderCal(); refreshQuill(); renderDateRail();
    });
    var qb = document.getElementById('pvQuillBtn');
    if (qb) qb.addEventListener('click', runGenerate);

    var wv = document.getElementById('pvWhoVeil');
    if (wv) wv.addEventListener('click', closeWho);
    var wc = document.getElementById('pvWho');
    if (wc) wc.addEventListener('click', function(e){ if (e.target === wc) closeWho(); });

    /* --- 详情页 --- */
    var dv = document.getElementById('pvDetailVeil');
    if (dv) dv.addEventListener('click', closeDetail);
    var db = document.getElementById('pvDetailBack');
    if (db) db.addEventListener('click', closeDetail);
    var dfav = document.getElementById('pvDetailFav');
    if (dfav) dfav.addEventListener('click', function(){
      var p = getPost(state.detailId);
      if (!p) return;
      toggleFav(p);
      dfav.classList.toggle('is-on', !!p.faved);
      toast(p.faved ? '已收藏' : '已取消收藏');
    });

    var inner = document.getElementById('pvDetailInner');
    if (inner) inner.addEventListener('click', function(e){
      var post = getPost(state.detailId);
      if (!post) return;
      var t = e.target;

      var who = t.closest ? t.closest('[data-who]') : null;
      if (who && !(t.closest && t.closest('[data-act]'))){ openWho(who); return; }

      var sec = t.closest ? t.closest('.pvb-secret') : null;
      if (sec){ sec.dataset.revealed = sec.dataset.revealed === '1' ? '0' : '1'; return; }

      var act = t.closest ? t.closest('[data-act]') : null;
      if (!act) return;
      var a = act.dataset.act;
      if (a === 'like'){ toggleLike(post); renderDetail(); return; }
      if (a === 'fav'){ toggleFav(post); renderDetail(); return; }
      if (a === 'pulse'){ doPulse(post, act); return; }
      if (a === 'clike'){
        var c = post.comments.filter(function(x){ return x.id === act.dataset.cid; })[0];
        if (!c) return;
        c.liked = !c.liked;
        c.likes = Math.max(0, (c.likes || 0) + (c.liked ? 1 : -1));
        putPost(post).then(renderDetail);
        vibrate(5);
        return;
      }
      if (a === 'rlike'){
        var r = post.reposts.filter(function(x){ return x.id === act.dataset.rid; })[0];
        if (!r) return;
        r.liked = !r.liked;
        r.likes = Math.max(0, (r.likes || 0) + (r.liked ? 1 : -1));
        putPost(post).then(renderDetail);
        vibrate(5);
        return;
      }
      if (a === 'creply'){
        var target = post.comments.filter(function(x){ return x.id === act.dataset.cid; })[0];
        if (!target) return;
        state.replyTarget = { id: target.id, name: target.name };
        var mode = document.getElementById('pvComposeMode');
        if (mode) mode.dataset.mode = 'comment';
        updateComposeUI();
        var ipt = document.getElementById('pvComposeInput');
        if (ipt) ipt.focus();
        return;
      }
    });

    var send = document.getElementById('pvComposeSend');
    if (send) send.addEventListener('click', submitCompose);
    var cin = document.getElementById('pvComposeInput');
    if (cin) cin.addEventListener('keydown', function(e){ if (e.key === 'Enter') submitCompose(); });
    var cmode = document.getElementById('pvComposeMode');
    if (cmode) cmode.addEventListener('click', function(){
      cmode.dataset.mode = cmode.dataset.mode === 'repost' ? 'comment' : 'repost';
      if (cmode.dataset.mode === 'repost') state.replyTarget = null;
      updateComposeUI();
      vibrate(4);
    });
    var ccancel = document.getElementById('pvComposeCancel');
    if (ccancel) ccancel.addEventListener('click', function(){ state.replyTarget = null; updateComposeUI(); });
  }

  /* ================================================================
     19 · 启动
  ================================================================ */
  function init(){
    if (!document.getElementById('pvRoot')) return;
    Promise.all([
      kvGet('profile', null),
      kvGet('cfg', null),
      kvGet('presets', []),
      kvGet('theme', 'moon'),
      kvGet('board', 'char'),
      kvGet('charId', null),
      loadAll(),
      loadChars()
    ]).then(function(r){
      state.profile = r[0] || JSON.parse(JSON.stringify(DEFAULT_PROFILE));
      state.cfg = Object.assign(JSON.parse(JSON.stringify(DEFAULT_CFG)), r[1] || {});
      state.presets = r[2] || [];
      state.theme = r[3] || 'moon';
      state.board = r[4] === 'stranger' ? 'stranger' : 'char';
      state.chars = r[7] || [];
      state.charId = r[5] && state.chars.some(function(c){ return String(c.id) === String(r[5]); })
        ? String(r[5])
        : (state.chars[0] ? String(state.chars[0].id) : null);
      buildShell();
      renderRoot();
      applyTheme();
    }).catch(function(){
      ensureCfgReady();
      buildShell();
      renderRoot();
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    init();
    /* 切到私密页时重新读一次角色列表（用户可能刚创建了新角色） */
    document.querySelectorAll('.diary-tab[data-tab="private"]').forEach(function(tab){
      tab.addEventListener('click', function(){
        loadChars().then(function(list){
          state.chars = list || [];
          if (!state.charId && state.chars[0]) state.charId = String(state.chars[0].id);
          renderCharStrip(); renderDateRail(); renderFeed();
        });
      });
    });
  });

  /* 对外暴露一点点，便于其他模块联动 */
  window._LunaPrivate = {
    open: function(id){ openDetail(id); },
    refresh: function(){ renderFeed(); }
  };

})();