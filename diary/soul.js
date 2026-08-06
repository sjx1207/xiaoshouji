/* ================================================================
   soul.js — 灵魂回想 · Soul Recall
   Part A：状态栏同步（与 diary.js 一致）
   Part B：日记条目加载（读取 luna_diary_entries_mine，按 entryId 定位）
   Part C：AI 调用封装（复用 settings.js 保存的 luna_api_current / luna_api_model）
   Part D：Stage 1→4 舞台流转 —— 引言 / 玻璃瓶抽字条 / 选角色 / 结果卷轴
   Part E：存档读写（localStorage.luna_soul_archive，结构与 diary.js 徽标契约一致）
================================================================ */

(function(){
  'use strict';

  /* ============================================================
     Part A —— 状态栏同步（时间 / 电量 / 灵动岛），与主界面保持一致
  ============================================================ */
  function updateTime(){
    var tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
    var timeStr;
    try{
      timeStr = new Date().toLocaleTimeString('zh-CN', {
        timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
      });
    }catch(e){
      timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    var el = document.getElementById('statusTime');
    if (el) el.textContent = timeStr;
  }

  function updateBattery(){
    var pct = parseInt(localStorage.getItem('luna_battery') || '76', 10);
    if (isNaN(pct)) pct = 76;
    var grad = pct <= 20
      ? 'linear-gradient(90deg, #f87171, #ef4444)'
      : 'linear-gradient(90deg, #6ee7b7, #34d399)';
    var pctEl = document.getElementById('batPct');
    var innerEl = document.getElementById('batInner');
    if (pctEl) pctEl.textContent = pct;
    if (innerEl){ innerEl.style.width = pct + '%'; innerEl.style.background = grad; }
  }

  function applyIsland(){
    var enabled = localStorage.getItem('luna_island_enabled') === 'true';
    var style = localStorage.getItem('luna_island_style') || 'minimal';
    var el = document.getElementById('statusIsland');
    if (!el) return;
    var styleMap = {
      minimal: '<div class="si-minimal"><div class="si-capsule"></div></div>',
      glow:    '<div class="si-glow"><div class="si-capsule"></div></div>',
      clock:   '<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" data-si-clock-text>--:--</span></div></div>',
      pulse:   '<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>',
      ripple:  '<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>',
      rainbow: '<div class="si-rainbow"><div class="si-capsule"></div></div>',
      music:   '<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>',
      scan:    '<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>'
    };
    var html = enabled ? (styleMap[style] || styleMap.minimal) : '';
    el.innerHTML = html;
    clearInterval(window._siClockTimer);
    if (enabled && style === 'clock'){
      var tick = function(){
        var now = new Date();
        var text = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
        document.querySelectorAll('[data-si-clock-text]').forEach(function(t){ t.textContent = text; });
      };
      tick();
      window._siClockTimer = setInterval(tick, 10000);
    }
  }

  updateTime(); updateBattery(); applyIsland();
  setInterval(updateTime, 10000);
  window.addEventListener('storage', function(e){
    if (['luna_tz','luna_battery','luna_island_enabled','luna_island_style'].includes(e.key)){
      updateTime(); updateBattery(); applyIsland();
    }
  });

  /* ============================================================
     Part B —— 日记条目加载
  ============================================================ */
  var DIARY_KEY = 'luna_diary_entries_mine';
  var MOOD_META = {
    calm:   { label: '平静' }, joy: { label: '欢喜' }, tender: { label: '柔软' },
    blue:   { label: '低落' }, storm: { label: '翻涌' }
  };
  var WEATHER_META = {
    sunny: '晴朗', cloudy: '多云', rainy: '有雨', night: '夜晚', snow: '落雪'
  };

  function qs(name){
    var m = new URLSearchParams(window.location.search).get(name);
    return m;
  }

  function loadEntries(){
    try{
      var raw = localStorage.getItem(DIARY_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch(e){ return []; }
  }

  var entryId = qs('entryId');
  var entries = loadEntries();
  var currentEntry = entries.find(function(e){ return String(e.id) === String(entryId); }) || null;

  function escapeHtml(str){
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function pad2(n){ return String(n).padStart(2, '0'); }

  function renderEntryCard(){
    var card = document.getElementById('soulEntryCard');
    if (!card) return;
    if (!currentEntry){
      card.innerHTML = '<div class="sec-title">找不到这篇日记</div><div class="sec-snippet">它可能已被删除，或链接已失效。</div>';
      var summonBtn = document.getElementById('soulSummonBtn');
      if (summonBtn) summonBtn.disabled = true;
      return;
    }
    var d = new Date(currentEntry.ts);
    var mood = MOOD_META[currentEntry.mood] || MOOD_META.calm;
    var metaBits = [mood.label];
    if (currentEntry.weather && WEATHER_META[currentEntry.weather]) metaBits.push(WEATHER_META[currentEntry.weather]);
    card.innerHTML =
      '<div class="sec-date">' + (d.getMonth()+1) + '.' + pad2(d.getDate()) + ' · ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + '</div>' +
      '<div class="sec-title">' + escapeHtml(currentEntry.title || '无题') + '</div>' +
      '<div class="sec-snippet">' + escapeHtml(currentEntry.body || '') + '</div>' +
      '<div class="sec-meta">' + metaBits.map(function(m){ return '<span>' + escapeHtml(m) + '</span>'; }).join('<span>·</span>') + '</div>';
  }
  renderEntryCard();

  /* ============================================================
     Part C —— AI 调用封装
     复用 settings.js 写入的 OpenAI 兼容配置：
       luna_api_current = { baseUrl, apiKey }
       luna_api_model    = 'xxx'
  ============================================================ */
  function getApiConfig(){
    var cur = {};
    try{ cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}'); }catch(e){}
    var model = localStorage.getItem('luna_api_model') || '';
    return {
      baseUrl: (cur.baseUrl || '').replace(/\/$/, ''),
      apiKey: cur.apiKey || '',
      model: model
    };
  }

  function apiReady(){
    var cfg = getApiConfig();
    return !!(cfg.baseUrl && cfg.apiKey && cfg.model);
  }

  /* 通用对话补全调用，返回纯文本内容 */
  async function callAI(messages, opts){
    opts = opts || {};
    var cfg = getApiConfig();
    if (!cfg.baseUrl || !cfg.apiKey || !cfg.model){
      throw new Error('尚未配置 AI 接口，请先在设置中填写 API');
    }
    var body = {
      model: cfg.model,
      messages: messages,
      max_tokens: opts.maxTokens || 900,
      temperature: opts.temperature != null ? opts.temperature : 0.9
    };
    /* 每次调用都传入随机 seed + top_p 抖动：
       不少 OpenAI 兼容后端（尤其是本地/代理模型）在收到完全相同的请求体时，
       会走确定性采样或缓存命中，导致"同一角色每次生成的都一样"。
       这里显式传随机 seed，避免采样退化成固定结果；不支持 seed 的后端会直接忽略此字段，无副作用。 */
    if (opts.randomize !== false){
      body.seed = Math.floor(Math.random() * 2147483647);
      body.top_p = 0.92 + Math.random() * 0.07; // 0.92 ~ 0.99 之间轻微抖动
    }
    var resp = await fetch(cfg.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + cfg.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!resp.ok){
      var errText = '';
      try{ errText = (await resp.json()).error?.message || ''; }catch(e){}
      throw new Error('HTTP ' + resp.status + (errText ? ' · ' + errText : ''));
    }
    var data = await resp.json();
    var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) throw new Error('AI 没有返回有效内容');
    return content.trim();
  }

  /* 尝试从模型输出中提取 JSON（允许模型偶尔包一层 ```json code fence） */
  function extractJson(text){
    var cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    var start = cleaned.indexOf('[') === -1 ? cleaned.indexOf('{') : cleaned.indexOf('[');
    var endChar = cleaned.indexOf('[') === -1 ? '}' : ']';
    var end = cleaned.lastIndexOf(endChar);
    if (start === -1 || end === -1) throw new Error('未能解析关键词');
    return JSON.parse(cleaned.slice(start, end + 1));
  }

  /* ============================================================
     Part D —— 舞台流转
  ============================================================ */
  var stageWrap = document.getElementById('soulStageWrap');
  var stages = Array.prototype.slice.call(document.querySelectorAll('.soul-stage'));
  var currentStageName = 'intro';

  function goStage(name){
    stages.forEach(function(s){
      if (s.dataset.stage === name){
        s.classList.remove('leaving');
        s.classList.add('active');
      } else if (s.classList.contains('active')){
        s.classList.add('leaving');
        s.classList.remove('active');
      } else {
        s.classList.remove('leaving');
      }
    });
    currentStageName = name;
    if (stageWrap) stageWrap.scrollTop = 0;
    var activeEl = document.querySelector('.soul-stage[data-stage="' + name + '"]');
    if (activeEl) activeEl.scrollTop = 0;
  }

  /* ---- 返回按钮：按阶段回退，intro 阶段则退出页面 ---- */
  document.getElementById('soulBackBtn').addEventListener('click', function(){
    if (currentStageName === 'archdetail'){ goStage('archive'); renderArchiveTimeline(); return; }
    if (currentStageName === 'archive'){ goStage(stageBeforeArchive); return; }
    if (currentStageName === 'bottle'){ goStage('intro'); return; }
    if (currentStageName === 'character'){ goStage('bottle'); return; }
    if (currentStageName === 'result'){ goStage('character'); return; }
    window.location.href = '../diary.html';
  });

  /* ============================================================
     Stage 2 · 玻璃瓶字条生成与抽取
  ============================================================ */
  var MAX_PICK = 3;
  var pickedNotes = [];
  var allNotes = [];

  var FALLBACK_KEYWORDS = ['未说出口的话', '一点点释怀', '悬在心口的重量', '想被理解的瞬间', '悄悄藏起的期待', '某个反复回放的画面'];

  async function generateKeywords(){
    var loading = document.getElementById('soulBottleLoading');
    var field = document.getElementById('soulNotesField');
    if (loading) loading.style.display = 'flex';
    if (field) field.classList.remove('show');

    var sbl = document.getElementById('sblText');
    if (sbl) sbl.textContent = '正在读这篇日记…';

    var keywords = null;
    if (apiReady() && currentEntry){
      try{
        var sys = '你是一个洞察力细腻的情绪分析助手，为一款日记应用服务。你需要阅读用户的日记原文，提炼出 6 个最能代表这篇日记情绪与细节的关键词或短语。' +
          '每个关键词 2 到 6 个汉字，具体、有画面感、有情绪张力，避免笼统词（如"开心""难过"），要像从原文里"打捞"出来的碎片。' +
          '只输出 JSON 数组，不要任何解释文字，不要 markdown 代码块，格式如：["关键词一","关键词二",...]';
        var userMsg = '标题：' + (currentEntry.title || '无题') + '\n心情：' + (MOOD_META[currentEntry.mood] || {}).label + '\n正文：\n' + (currentEntry.body || '');
        var raw = await callAI([
          { role: 'system', content: sys },
          { role: 'user', content: userMsg }
        ], { maxTokens: 300, temperature: 0.85 });
        var parsed = extractJson(raw);
        if (Array.isArray(parsed) && parsed.length){
          keywords = parsed.filter(function(k){ return typeof k === 'string' && k.trim(); }).slice(0, 8);
        }
      }catch(e){
        console.warn('关键词生成失败，使用兜底：', e.message);
      }
    }
    if (!keywords || !keywords.length){
      keywords = FALLBACK_KEYWORDS.slice();
    }
    return keywords;
  }

  function layoutNotes(words){
    var field = document.getElementById('soulNotesField');
    if (!field) return;
    field.innerHTML = '';
    allNotes = [];

    /* 在椭圆区域内大致均匀撒开，避免重叠过度 */
    var positions = [
      { left: '6%',  top: '4%'  }, { left: '54%', top: '0%'  },
      { left: '2%',  top: '38%' }, { left: '58%', top: '34%' },
      { left: '18%', top: '68%' }, { left: '52%', top: '70%' },
      { left: '30%', top: '18%' }, { left: '36%', top: '50%' }
    ];

    words.forEach(function(word, i){
      var pos = positions[i % positions.length];
      var note = document.createElement('div');
      note.className = 'soul-note';
      note.textContent = word;
      note.style.left = pos.left;
      note.style.top = pos.top;
      note.style.setProperty('--rot', (Math.random() * 10 - 5).toFixed(1) + 'deg');
      note.style.animationDelay = (Math.random() * 2).toFixed(2) + 's';
      note.dataset.word = word;
      note.addEventListener('click', function(){ toggleNote(note, word); });
      field.appendChild(note);
      allNotes.push(note);
    });

    field.classList.add('show');
  }

  function toggleNote(el, word){
    var idx = pickedNotes.indexOf(word);
    if (idx > -1){
      pickedNotes.splice(idx, 1);
      el.classList.remove('picked');
    } else {
      if (pickedNotes.length >= MAX_PICK){
        if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(15);
        return;
      }
      pickedNotes.push(word);
      el.classList.add('picked');
    }
    if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(6);

    allNotes.forEach(function(n){
      var w = n.dataset.word;
      var isPicked = pickedNotes.indexOf(w) > -1;
      n.classList.toggle('dim', pickedNotes.length >= MAX_PICK && !isPicked);
    });

    renderPickedRow();
    var toCharBtn = document.getElementById('soulToCharBtn');
    if (toCharBtn) toCharBtn.disabled = pickedNotes.length === 0;

    var hintEl = document.getElementById('soulBottleHint');
    if (hintEl){
      hintEl.innerHTML = pickedNotes.length
        ? '已抽出 <b>' + pickedNotes.length + '</b> / ' + MAX_PICK + ' 枚字条'
        : '轻触漂浮的字条，最多选 <b>' + MAX_PICK + '</b> 枚';
    }
  }

  function renderPickedRow(){
    var row = document.getElementById('soulPickedRow');
    if (!row) return;
    if (!pickedNotes.length){ row.hidden = true; row.innerHTML = ''; return; }
    row.hidden = false;
    row.innerHTML = pickedNotes.map(function(w){
      return '<span class="soul-picked-chip">' + escapeHtml(w) + '<span class="spc-remove" data-word="' + escapeHtml(w) + '">×</span></span>';
    }).join('');
    row.querySelectorAll('.spc-remove').forEach(function(btn){
      btn.addEventListener('click', function(){
        var word = btn.dataset.word;
        var noteEl = allNotes.find(function(n){ return n.dataset.word === word; });
        if (noteEl) toggleNote(noteEl, word);
      });
    });
  }

  async function summonBottle(){
    goStage('bottle');
    var words = await generateKeywords();
    var loading = document.getElementById('soulBottleLoading');
    if (loading) loading.style.display = 'none';
    layoutNotes(words);
  }

  document.getElementById('soulSummonBtn').addEventListener('click', function(){
    if (!currentEntry) return;
    summonBottle();
  });

  document.getElementById('soulRetryBottleBtn').addEventListener('click', function(){
    pickedNotes = [];
    renderPickedRow();
    document.getElementById('soulToCharBtn').disabled = true;
    summonBottle();
  });

  document.getElementById('soulToCharBtn').addEventListener('click', function(){
    if (!pickedNotes.length) return;
    renderPickedRecap();
    renderCharGrid();
    goStage('character');
  });

  /* ============================================================
     Stage 3 · 角色选择（读取 LunaCharDB / chars）
  ============================================================ */
  function renderPickedRecap(){
    var el = document.getElementById('soulPickedRecap');
    if (!el) return;
    el.innerHTML = pickedNotes.map(function(w){ return '<span>' + escapeHtml(w) + '</span>'; }).join('');
  }

  var _charDb = null;
  function openCharDB(){
    if (_charDb) return Promise.resolve(_charDb);
    return new Promise(function(resolve, reject){
      var probe = indexedDB.open('LunaCharDB');
      probe.onsuccess = function(e){
        var cur = e.target.result;
        var ver = cur.version;
        var hasChars = cur.objectStoreNames.contains('chars');
        cur.close();
        if (hasChars){
          var req2 = indexedDB.open('LunaCharDB', ver);
          req2.onsuccess = function(e2){ _charDb = e2.target.result; resolve(_charDb); };
          req2.onerror = function(e2){ reject(e2.target.error); };
        } else {
          var req3 = indexedDB.open('LunaCharDB', ver + 1);
          req3.onupgradeneeded = function(e3){
            var db3 = e3.target.result;
            if (!db3.objectStoreNames.contains('chars')) db3.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
          };
          req3.onsuccess = function(e3){ _charDb = e3.target.result; resolve(_charDb); };
          req3.onerror = function(e3){ reject(e3.target.error); };
        }
      };
      probe.onerror = function(e){ reject(e.target.error); };
      probe.onupgradeneeded = function(e){
        var db0 = e.target.result;
        if (!db0.objectStoreNames.contains('chars')) db0.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
      };
    });
  }

  async function getAllChars(){
    try{
      var db = await openCharDB();
      return new Promise(function(resolve){
        var req = db.transaction('chars', 'readonly').objectStore('chars').getAll();
        req.onsuccess = function(){ resolve(req.result || []); };
        req.onerror = function(){ resolve([]); };
      });
    }catch(e){ return []; }
  }

  var selectedCharId = null;
  var charList = [];

  async function renderCharGrid(){
    var grid = document.getElementById('soulCharGrid');
    var emptyEl = document.getElementById('soulCharEmpty');
    if (!grid) return;
    charList = await getAllChars();

    if (!charList.length){
      grid.innerHTML = '';
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    grid.innerHTML = charList.map(function(c){
      var initial = (c.name || '?').slice(0, 1);
      var avatarStyle = c.avatar ? ('background-image:url(' + c.avatar + ')') : '';
      return '<div class="soul-char-card" data-id="' + c.id + '">' +
        '<div class="scc-avatar" style="' + avatarStyle + '">' + (c.avatar ? '' : escapeHtml(initial)) + '</div>' +
        '<div class="scc-name">' + escapeHtml(c.name || '未命名') + '</div>' +
        '<div class="scc-role">' + escapeHtml(c.role || '') + '</div>' +
      '</div>';
    }).join('');

    grid.querySelectorAll('.soul-char-card').forEach(function(card){
      card.addEventListener('click', function(){
        grid.querySelectorAll('.soul-char-card').forEach(function(c){ c.classList.remove('selected'); });
        card.classList.add('selected');
        selectedCharId = parseInt(card.dataset.id, 10);
        var genBtn = document.getElementById('soulGenerateBtn');
        if (genBtn) genBtn.disabled = false;
        if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(6);
      });
    });
  }

  document.getElementById('soulGenerateBtn').addEventListener('click', function(){
    if (selectedCharId == null) return;
    goStage('result');
    generateSoulLetter();
  });

  /* ============================================================
     Stage 4 · AI 生成回信正文
  ============================================================ */
  function charSystemPrompt(c){
    var lines = [];
    lines.push('你现在要完全代入以下角色人设，以第一人称、日记体的口吻写一篇属于你自己的日记。');
    lines.push('这不是对话，也不是写给用户看的信，而是你读完对方的日记后，作为这个角色，独自坐下来写的一篇私人日记——记录你读到这些内容后的所思所感。');
    lines.push('【角色档案】');
    if (c.name) lines.push('姓名：' + c.name);
    if (c.role) lines.push('身份/关系：' + c.role);
    if (c.gender) lines.push('性别：' + c.gender);
    if (c.age) lines.push('年龄：' + c.age);
    if (c.desc) lines.push('简介：' + c.desc);
    if (c.traits && c.traits.length) lines.push('性格特质：' + c.traits.join('、'));
    if (c.speechStyle) lines.push('说话风格：' + c.speechStyle);
    if (c.catchphrases && c.catchphrases.length) lines.push('口头禅：' + c.catchphrases.join('、'));
    if (c.backstory) lines.push('背景故事：' + c.backstory);
    if (c.relation) lines.push('与用户的关系：' + c.relation);
    if (c.callUser) lines.push('Ta 对用户的称呼：' + c.callUser);
    if (c.relationDetail) lines.push('关系细节：' + c.relationDetail);
    if (c.likes && c.likes.length) lines.push('喜欢：' + c.likes.join('、'));
    if (c.dislikes && c.dislikes.length) lines.push('不喜欢：' + c.dislikes.join('、'));
    if (c.fears) lines.push('恐惧/在意的事：' + c.fears);
    if (c.prompt) lines.push('补充设定：' + c.prompt);
    lines.push('');
    lines.push('写作要求：');
    lines.push('1. 全文必须是第一人称"我"的日记体，符合角色的说话风格与性格，不要出戏、不要自称AI。');
    lines.push('2. 日记内容要自然融入用户提供的原始日记与几个"关键词字条"，但不是逐字复述，而是用角色自己的视角重新诠释、回应或联想。');
    lines.push('3. 篇幅 220-420 字左右，情感真实、有细节、有留白，避免说教和空泛的安慰话术。');
    lines.push('4. 先输出一行标题（不加"标题："等前缀，不超过16字），空一行后再输出正文。');
    lines.push('5. 不要使用任何 emoji、表情符号或颜文字。不要使用 markdown 标记。');
    lines.push('6. 每次写作请根据 user 消息里指定的"切入角度"来组织行文，不要每次都用同一种开头套路或同一种结构；标题也要每次不同，避免用相近的措辞。');
    return lines.join('\n');
  }

  /* 随机"切入角度"库：每次生成前随机抽一个，写进 user payload，
     强制模型从不同角度切入，避免"角色设定不变→模型自己收敛到同一套模板"的问题。
     仅靠 temperature/seed 对很多模型不够——明确给一个变化的写作抓手更有效。 */
  var ENTRY_ANGLES = [
    '从一个具体的感官细节切入（一个声音、一种气味、一处光线）',
    '从一件正在做的小事切入（手上的动作、身边的物件），再慢慢引到心事',
    '从对用户某一句话/某个词的反复咀嚼切入',
    '从一个突然想起的回忆片段切入，再拉回当下',
    '从此刻的天气或环境切入，让情绪从外部渗进来',
    '直接从一句内心独白或自问切入，开门见山地表露情绪',
    '从对用户处境的一个具体猜测或担忧切入',
    '从角色自己今天做的一件小事、一个决定切入，再联系到用户的日记'
  ];
  function randomAngle(){
    return ENTRY_ANGLES[Math.floor(Math.random() * ENTRY_ANGLES.length)];
  }

  function buildUserPayload(){
    var notesText = pickedNotes.join('、');
    var moodLabel = (MOOD_META[currentEntry.mood] || {}).label || '';
    return '【用户日记原文】\n标题：' + (currentEntry.title || '无题') +
      '\n心情：' + moodLabel +
      (currentEntry.tags && currentEntry.tags.length ? '\n标签：' + currentEntry.tags.join('、') : '') +
      '\n正文：\n' + (currentEntry.body || '') +
      '\n\n【用户从瓶中抽出的字条（请让这些词自然融入你的回应）】\n' + notesText +
      '\n\n【这一次的写作切入角度（务必采用，不要重复使用你上次可能写过的开头方式）】\n' + randomAngle();
  }

  var lastResultData = null;

  async function generateSoulLetter(){
    var loadingEl = document.getElementById('soulResultLoading');
    var bodyEl = document.getElementById('soulResultBody');
    var errorEl = document.getElementById('soulResultError');
    if (loadingEl) loadingEl.hidden = false;
    if (bodyEl) bodyEl.hidden = true;
    if (errorEl) errorEl.hidden = true;

    var char = charList.find(function(c){ return c.id === selectedCharId; });
    if (!char || !currentEntry){
      showResultError('缺少角色或日记数据');
      return;
    }

    if (!apiReady()){
      showResultError('尚未配置 AI 接口，请先前往设置页填写 API Base URL / Key 并选择模型');
      return;
    }

    try{
      var raw = await callAI([
        { role: 'system', content: charSystemPrompt(char) },
        { role: 'user', content: buildUserPayload() }
      ], { maxTokens: 900, temperature: 0.95 });

      var lines = raw.split('\n').map(function(l){ return l.trim(); }).filter(function(l, i, arr){
        /* 去掉开头连续空行 */
        return true;
      });
      /* 提取标题：第一段非空行作为标题，其后内容作为正文 */
      var firstNonEmptyIdx = lines.findIndex(function(l){ return l.length > 0; });
      var title = firstNonEmptyIdx > -1 ? lines[firstNonEmptyIdx].replace(/^#+\s*/, '') : (char.name + '的日记');
      var bodyLines = lines.slice(firstNonEmptyIdx + 1);
      while (bodyLines.length && bodyLines[0] === '') bodyLines.shift();
      var body = bodyLines.join('\n').trim();
      if (!body){ body = title; title = char.name ? (char.name + '的回想') : '一篇回想'; }

      lastResultData = {
        charId: char.id,
        charName: char.name || '未命名角色',
        charRole: char.role || '',
        charAvatar: char.avatar || '',
        title: title,
        body: body,
        notes: pickedNotes.slice(),
        ts: Date.now(),
        entryId: currentEntry.id,
        entryTitle: currentEntry.title || '无题'
      };
      renderResult(lastResultData);
    }catch(e){
      showResultError(e.message || '生成失败，请稍后重试');
    }
  }

  function showResultError(msg){
    var loadingEl = document.getElementById('soulResultLoading');
    var bodyEl = document.getElementById('soulResultBody');
    var errorEl = document.getElementById('soulResultError');
    var descEl = document.getElementById('sreDesc');
    if (loadingEl) loadingEl.hidden = true;
    if (bodyEl) bodyEl.hidden = true;
    if (errorEl) errorEl.hidden = false;
    if (descEl) descEl.textContent = msg;
  }

  function renderResult(data){
    var loadingEl = document.getElementById('soulResultLoading');
    var bodyEl = document.getElementById('soulResultBody');
    var errorEl = document.getElementById('soulResultError');
    if (loadingEl) loadingEl.hidden = true;
    if (errorEl) errorEl.hidden = true;
    if (bodyEl) bodyEl.hidden = false;

    document.getElementById('srcCharName').textContent = data.charName + ' 的回想';
    var avatarEl = document.getElementById('sraAvatar');
    if (avatarEl) avatarEl.style.backgroundImage = data.charAvatar ? 'url(' + data.charAvatar + ')' : '';
    document.getElementById('sraName').textContent = data.charName;
    document.getElementById('sraRole').textContent = data.charRole || '灵魂回想 · 角色回信';

    document.getElementById('srcNotesRecap').innerHTML = data.notes.map(function(n){ return '<span>' + escapeHtml(n) + '</span>'; }).join('');

    document.getElementById('srcTitle').textContent = data.title;
    var d = new Date(data.ts);
    document.getElementById('srcMetaLine').textContent =
      '写于 ' + (d.getMonth()+1) + '.' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + '　·　回应《' + data.entryTitle + '》';

    document.getElementById('srcBody').textContent = data.body;
    document.getElementById('srcWordCount').textContent = data.body.length + ' 字';

    var signAvatar = document.getElementById('srcSignoffAvatar');
    if (signAvatar) signAvatar.style.backgroundImage = data.charAvatar ? 'url(' + data.charAvatar + ')' : '';
    var signLine = document.getElementById('srcSignoffLine');
    if (signLine) signLine.textContent = '— ' + data.charName;

    var savedToast = document.getElementById('soulSavedToast');
    if (savedToast) savedToast.classList.remove('show');
  }

  document.getElementById('soulRegenBtn').addEventListener('click', function(){
    generateSoulLetter();
  });
  document.getElementById('soulRetryResultBtn').addEventListener('click', function(){
    generateSoulLetter();
  });

  /* ============================================================
     Part E —— 存档读写
     luna_soul_archive = { [entryId]: [ {charId,charName,charRole,charAvatar,title,body,notes,ts,entryId,entryTitle,id} ] }
  ============================================================ */
  var ARCHIVE_KEY = 'luna_soul_archive';

  function loadArchiveStore(){
    try{
      var raw = localStorage.getItem(ARCHIVE_KEY);
      var obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === 'object' ? obj : {};
    }catch(e){ return {}; }
  }
  function saveArchiveStore(store){
    try{ localStorage.setItem(ARCHIVE_KEY, JSON.stringify(store)); }catch(e){}
  }

  function saveCurrentResultToArchive(){
    if (!lastResultData || !currentEntry) return;
    var store = loadArchiveStore();
    var list = store[currentEntry.id] || [];
    var record = Object.assign({}, lastResultData, { id: 'soul_' + Date.now() });
    list.unshift(record);
    store[currentEntry.id] = list;
    saveArchiveStore(store);
    updateArchiveBadge();

    var toast = document.getElementById('soulSavedToast');
    if (toast){
      toast.classList.add('show');
      clearTimeout(window._soulToastTimer);
      window._soulToastTimer = setTimeout(function(){ toast.classList.remove('show'); }, 2200);
    }
    if (window.navigator && window.navigator.vibrate) window.navigator.vibrate([8, 30, 8]);
  }

  document.getElementById('soulSaveBtn').addEventListener('click', saveCurrentResultToArchive);

  function updateArchiveBadge(){
    var countEl = document.getElementById('sabCount');
    if (!countEl || !currentEntry) return;
    var store = loadArchiveStore();
    var list = store[currentEntry.id] || [];
    if (list.length){
      countEl.textContent = list.length > 9 ? '9+' : String(list.length);
      countEl.hidden = false;
    } else {
      countEl.hidden = true;
    }
  }
  updateArchiveBadge();

  /* ---- 回想档案页（时间轴风格，独立页面而非弹层，从根本上避免状态栏接缝问题） ---- */
  var stageBeforeArchive = 'intro';
  var currentArchRecId = null;

  document.getElementById('soulArchiveBtn').addEventListener('click', function(){
    stageBeforeArchive = currentStageName === 'archive' || currentStageName === 'archdetail' ? 'intro' : currentStageName;
    renderArchiveTimeline();
    goStage('archive');
  });

  function renderArchiveTimeline(){
    var listEl = document.getElementById('archTimeline');
    var emptyEl = document.getElementById('archPageEmpty');
    var countEl = document.getElementById('archPageCount');
    if (!listEl || !currentEntry) return;
    var store = loadArchiveStore();
    var list = store[currentEntry.id] || [];

    if (countEl) countEl.textContent = list.length + ' 封回信';

    if (!list.length){
      listEl.innerHTML = '';
      listEl.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    listEl.hidden = false;
    if (emptyEl) emptyEl.hidden = true;

    listEl.innerHTML = list.map(function(rec, idx){
      var d = new Date(rec.ts);
      var avatarStyle = rec.charAvatar ? ('background-image:url(' + rec.charAvatar + ')') : '';
      return '<div class="atl-row" data-id="' + rec.id + '" style="--atl-i:' + idx + '">' +
        '<div class="atl-rail">' +
          '<span class="atl-node"></span>' +
        '</div>' +
        '<div class="atl-card">' +
          '<div class="atl-top">' +
            '<div class="atl-avatar" style="' + avatarStyle + '"></div>' +
            '<span class="atl-char">' + escapeHtml(rec.charName) + '</span>' +
            '<span class="atl-date">' + (d.getMonth()+1) + '.' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + '</span>' +
          '</div>' +
          '<div class="atl-title">' + escapeHtml(rec.title) + '</div>' +
          '<div class="atl-snippet">' + escapeHtml(rec.body) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    listEl.querySelectorAll('.atl-row').forEach(function(item){
      item.addEventListener('click', function(){
        var rec = list.find(function(r){ return r.id === item.dataset.id; });
        if (rec) openArchDetail(rec);
      });
    });
  }

  /* ---- 回想档案详情页 ---- */
  function openArchDetail(rec){
    currentArchRecId = rec.id;
    var scroll = document.getElementById('soulArchviewScroll');
    var d = new Date(rec.ts);
    var avatarStyle = rec.charAvatar ? ('background-image:url(' + rec.charAvatar + ')') : '';
    scroll.innerHTML =
      '<div class="soul-result-card">' +
        '<div class="soul-result-letterhead">' +
          '<div class="src-topline"><span class="src-dot"></span>' + escapeHtml(rec.charName) + ' 的回想</div>' +
          '<div class="soul-result-avatar-row">' +
            '<div class="sra-avatar" style="' + avatarStyle + '"></div>' +
            '<div class="sra-meta"><div class="sra-name">' + escapeHtml(rec.charName) + '</div><div class="sra-role">' + escapeHtml(rec.charRole || '') + '</div></div>' +
          '</div>' +
          '<div class="src-notes-recap">' + rec.notes.map(function(n){ return '<span>' + escapeHtml(n) + '</span>'; }).join('') + '</div>' +
        '</div>' +
        '<div class="soul-result-letter-body">' +
          '<div class="src-title-row"><span class="src-quote-mark">"</span><h1 class="src-title">' + escapeHtml(rec.title) + '</h1></div>' +
          '<div class="src-meta-line">写于 ' + (d.getMonth()+1) + '.' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + '　·　回应《' + escapeHtml(rec.entryTitle || '') + '》</div>' +
          '<div class="src-body">' + escapeHtml(rec.body) + '</div>' +
          '<div class="src-signoff"><div class="src-signoff-avatar" style="' + avatarStyle + '"></div><span class="src-signoff-line">— ' + escapeHtml(rec.charName) + '</span></div>' +
          '<div class="src-footmark"><span class="dfm-line"></span><span>' + rec.body.length + ' 字</span><span class="dfm-line"></span></div>' +
        '</div>' +
      '</div>';
    goStage('archdetail');
  }

  document.getElementById('soulArchviewDel').addEventListener('click', function(){
    if (!currentArchRecId || !currentEntry) return;
    var store = loadArchiveStore();
    var list = store[currentEntry.id] || [];
    store[currentEntry.id] = list.filter(function(r){ return r.id !== currentArchRecId; });
    saveArchiveStore(store);
    updateArchiveBadge();
    goStage('archive');
    renderArchiveTimeline();
    if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(10);
  });

  /* ============================================================
     初始态
  ============================================================ */
  if (!currentEntry){
    var summonBtn = document.getElementById('soulSummonBtn');
    if (summonBtn) summonBtn.disabled = true;
  }
  goStage('intro');

})();