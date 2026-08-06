/* ================================================================
   dream.js — 共感梦境 · Empathic Reverie
   独立页面逻辑，与上级目录 diary.js / characters.js / settings.js
   共用同一套 localStorage / IndexedDB 数据源：

   · luna_diary_entries_mine   —— 日记条目（来自 diary.js）
   · LunaCharDB.chars          —— 角色档案（来自 characters.js），
                                   每个角色的 `prompt` 字段即完整人设系统提示词
   · luna_api_current          —— { baseUrl, apiKey }（来自 settings.js）
   · luna_api_model             —— 当前所选模型 id（来自 settings.js）
   · luna_dream_archive        —— 本页新增：{ [entryId]: [ {id, ts, topic,
                                   charId, charName, charAvatar, body, wordCount} ] }

   页面通过 URL 参数 ?entryId=xxx 接收从 diary.html 详情页跳转来的日记 id，
   若未带参数或找不到对应日记，则回退展示提示并允许直接返回。
================================================================ */

(function(){
  'use strict';

  /* ============================================================
     Part A —— 状态栏同步（与 diary.js 完全一致的逻辑，保证观感不断裂）
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
    var html = styleMap[style] || styleMap.minimal;
    if (!enabled) html = '';
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

  function applyGlobalFont(){
    var name = localStorage.getItem('luna_font_active_name');
    var id = parseInt(localStorage.getItem('luna_font_active_id'), 10);
    var finish = function(){
      var tag = document.getElementById('luna-font-override');
      if (!tag){
        tag = document.createElement('style');
        tag.id = 'luna-font-override';
        document.head.appendChild(tag);
      }
      var familyRule = name ? "font-family: '" + name + "', sans-serif !important;" : '';
      tag.textContent = '.dream-app *{ ' + familyRule + ' } .reader-sheet *{ ' + familyRule + ' }';
    };
    if (name && id){
      try{
        var req = indexedDB.open('LunaFontDB', 4);
        req.onsuccess = function(e){
          var db = e.target.result;
          try{
            var r = db.transaction('fonts').objectStore('fonts').getAll();
            r.onsuccess = function(){
              var all = r.result || [];
              var f = all.find(function(x){ return x.id === id; });
              if (f){
                var face = new FontFace(name, 'url(' + f.data + ')');
                face.load().then(function(loaded){
                  document.fonts.add(loaded);
                  finish();
                }).catch(finish);
              } else { finish(); }
            };
            r.onerror = finish;
          }catch(e2){ finish(); }
        };
        req.onerror = finish;
      }catch(e){ finish(); }
    } else {
      finish();
    }
  }

  window.addEventListener('storage', function(e){
    if (e.key === 'luna_font_update')   applyGlobalFont();
    if (e.key === 'luna_island_update') applyIsland();
    if (e.key === 'luna_tz_update')     updateTime();
    if (e.key === 'luna_battery')       updateBattery();
  });

  updateTime();
  updateBattery();
  applyIsland();
  applyGlobalFont();
  setInterval(updateTime, 10000);

  /* ============================================================
     Part B —— 背景光尘粒子生成
  ============================================================ */
  (function initDust(){
    var wrap = document.getElementById('dreamDust');
    if (!wrap) return;
    var n = 16;
    for (var i = 0; i < n; i++){
      var s = document.createElement('span');
      s.style.left = (Math.random() * 96 + 2) + '%';
      s.style.animationDuration = (9 + Math.random() * 10) + 's';
      s.style.animationDelay = (Math.random() * 12) + 's';
      wrap.appendChild(s);
    }
  })();

  /* ============================================================
     Part C —— 数据源读取：日记条目 / 角色档案 / API 配置
  ============================================================ */

  var DIARY_STORAGE_KEY = 'luna_diary_entries_mine';
  var ARCHIVE_STORAGE_KEY = 'luna_dream_archive';

  var MOOD_META = {
    calm:   { label: '平静' },
    joy:    { label: '欢喜' },
    tender: { label: '柔软' },
    blue:   { label: '低落' },
    storm:  { label: '翻涌' }
  };

  function getUrlParam(name){
    try{
      var params = new URLSearchParams(window.location.search);
      return params.get(name);
    }catch(e){ return null; }
  }

  function loadDiaryEntries(){
    try{
      var raw = localStorage.getItem(DIARY_STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch(e){ return []; }
  }

  function loadArchiveStore(){
    try{
      var raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
      var obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === 'object') ? obj : {};
    }catch(e){ return {}; }
  }
  function saveArchiveStore(store){
    try{ localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(store)); }catch(e){}
  }

  function escapeHtml(str){
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function pad2(n){ return String(n).padStart(2, '0'); }
  function fmtTime(ts){
    var d = new Date(ts);
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function fmtDate(ts){
    var d = new Date(ts);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  /* ---- 角色档案：IndexedDB LunaCharDB / chars（与 characters.js 同源） ---- */
  var _charDb = null;
  function openCharDB(){
    if (_charDb) return Promise.resolve(_charDb);
    return new Promise(function(res, rej){
      var probe = indexedDB.open('LunaCharDB');
      probe.onsuccess = function(e){
        var cur = e.target.result;
        var ver = cur.version;
        var hasChars = cur.objectStoreNames.contains('chars');
        cur.close();
        if (hasChars){
          var req2 = indexedDB.open('LunaCharDB', ver);
          req2.onsuccess = function(e2){ _charDb = e2.target.result; res(_charDb); };
          req2.onerror = function(e2){ rej(e2.target.error); };
        } else {
          var req3 = indexedDB.open('LunaCharDB', ver + 1);
          req3.onupgradeneeded = function(e3){
            var db3 = e3.target.result;
            if (!db3.objectStoreNames.contains('chars'))
              db3.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
          };
          req3.onsuccess = function(e3){ _charDb = e3.target.result; res(_charDb); };
          req3.onerror = function(e3){ rej(e3.target.error); };
        }
      };
      probe.onerror = function(e){ rej(e.target.error); };
      probe.onupgradeneeded = function(e){
        var db0 = e.target.result;
        if (!db0.objectStoreNames.contains('chars'))
          db0.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
      };
    });
  }
  function getAllChars(){
    return openCharDB().catch(function(){ return null; }).then(function(db){
      if (!db) return [];
      return new Promise(function(res){
        var req = db.transaction('chars', 'readonly').objectStore('chars').getAll();
        req.onsuccess = function(){ res(req.result || []); };
        req.onerror = function(){ res([]); };
      });
    });
  }

  /* ---- API 配置（与 settings.js 同源） ---- */
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

  async function callChatCompletion(messages, opts){
    opts = opts || {};
    var cfg = getApiConfig();
    if (!cfg.baseUrl || !cfg.apiKey || !cfg.model){
      var err = new Error('尚未在设置中配置可用的 API 连接');
      err.code = 'NO_API';
      throw err;
    }
    var resp = await fetch(cfg.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + cfg.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: messages,
        max_tokens: opts.maxTokens || 900,
        temperature: opts.temperature != null ? opts.temperature : 0.9
      })
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var data = await resp.json();
    var reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!reply) throw new Error('模型未返回有效内容');
    return reply.trim();
  }

  /* ============================================================
     Part D —— 页面状态机
  ============================================================ */

  var entryId = getUrlParam('entryId');
  var currentEntry = null;
  var allChars = [];
  var selectedChar = null;
  var selectedTopic = '';
  var currentResultRecord = null; /* 本次生成、尚未/已保存的记录 */

  var els = {}; /* 延迟到 DOMContentLoaded 后统一取值 */

  function toast(msg, ms){
    var t = els.dreamToast;
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(function(){ t.classList.remove('show'); }, ms || 2200);
  }

  function vibrate(pattern){
    if (window.navigator && window.navigator.vibrate){
      try{ window.navigator.vibrate(pattern); }catch(e){}
    }
  }

  /* ---- Stage 切换 ---- */
  var STAGE_ORDER = ['topic', 'char', 'reverie', 'archive'];
  var currentStageIndex = 0;

  function goStage(name, opts){
    opts = opts || {};
    var idx = STAGE_ORDER.indexOf(name);
    if (idx < 0) return;
    currentStageIndex = idx;

    document.querySelectorAll('.dream-stage').forEach(function(st){
      st.classList.remove('active', 'leaving');
      if (st.dataset.stage === name) st.classList.add('active');
    });

    document.querySelectorAll('.dp-step').forEach(function(step){
      var stepIdx = STAGE_ORDER.indexOf(step.dataset.step);
      step.classList.toggle('active', stepIdx === idx);
      step.classList.toggle('done', stepIdx < idx);
    });

    els.dreamStageWrap && (els.dreamStageWrap.scrollTop = 0);
    var activeStageEl = document.querySelector('.dream-stage[data-stage="' + name + '"]');
    if (activeStageEl) activeStageEl.scrollTop = 0;

    if (name === 'archive' && !opts.silent) renderArchiveList();
  }

  /* ---- 源引用卡：在各 Stage 顶部展示当前日记摘录 ---- */
  function renderSourceQuotes(){
    if (!currentEntry) return;
    var mood = MOOD_META[currentEntry.mood] || MOOD_META.calm;
    var snippet = (currentEntry.body || '').slice(0, 72);
    var html =
      '<div class="sq-label"><span class="sq-line"></span>SOURCE · 这篇日记<span class="sq-line"></span></div>' +
      '<div class="sq-title">' + escapeHtml(currentEntry.title || '无题') + ' · ' + mood.label + '</div>' +
      '<div class="sq-text">"' + escapeHtml(snippet) + (currentEntry.body && currentEntry.body.length > 72 ? '……' : '') + '"</div>';
    ['sourceQuoteTopic', 'sourceQuoteChar', 'sourceQuoteArchive'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.innerHTML = html;
    });
  }

  /* ============================================================
     Stage 1 · 话题输入
  ============================================================ */
  function wireTopicStage(){
    var input = els.topicInput;
    var count = els.topicCount;
    var nextBtn = els.toCharBtn;

    function sync(){
      var len = input.value.length;
      count.textContent = len;
      nextBtn.disabled = len === 0;
    }
    input.addEventListener('input', sync);
    sync();

    nextBtn.addEventListener('click', function(){
      selectedTopic = input.value.trim();
      if (!selectedTopic) return;
      vibrate(6);
      goStage('char');
    });

    els.aiSuggestBtn.addEventListener('click', requestAiTopicSuggestions);

    renderTopicPresets();
  }

  function renderTopicPresets(){
    var mood = currentEntry ? (MOOD_META[currentEntry.mood] || MOOD_META.calm).label : '此刻';
    var presets = [
      '这份' + mood + '，希望被怎样地理解',
      '如果 Ta 也经历过同样的时刻',
      '写下这些文字时，最想被回应的一句话',
      '这段心情背后，还没说出口的部分'
    ];
    var listEl = els.topicPresetList;
    listEl.innerHTML = presets.map(function(p, i){
      return '<button type="button" class="topic-chip" style="animation-delay:' + (i * 0.06) + 's" data-preset>' + escapeHtml(p) + '</button>';
    }).join('');
    els.topicPresets.hidden = false;

    listEl.querySelectorAll('[data-preset]').forEach(function(chip){
      chip.addEventListener('click', function(){
        els.topicInput.value = chip.textContent;
        els.topicInput.dispatchEvent(new Event('input'));
        vibrate(5);
      });
    });
  }

  async function requestAiTopicSuggestions(){
    var btn = els.aiSuggestBtn;
    var btnText = document.getElementById('aiSuggestBtnText');
    if (btn.classList.contains('loading')) return;

    var cfg = getApiConfig();
    if (!cfg.baseUrl || !cfg.apiKey || !cfg.model){
      toast('请先在设置中配置 API 连接');
      return;
    }

    btn.classList.add('loading');
    btnText.textContent = '正在构思……';

    try{
      var bodyText = (currentEntry.body || '').slice(0, 600);
      var moodLabel = (MOOD_META[currentEntry.mood] || MOOD_META.calm).label;
      var sysPrompt = '你是一个善于共情的写作助手。请阅读用户提供的一段日记原文，' +
        '从中提炼出 4 个「值得被共感回应的话题」，每个话题必须是一句简短的中文短语（12-22字），' +
        '不要写成问句，不要编号，不要引号，不要解释，只需逐行输出 4 条，用换行分隔。';
      var userPrompt = '日记心情：' + moodLabel + '\n日记原文：\n' + bodyText;

      var reply = await callChatCompletion([
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userPrompt }
      ], { maxTokens: 300, temperature: 0.85 });

      var lines = reply.split('\n')
        .map(function(l){ return l.replace(/^[\-\*\d\.\、\s]+/, '').trim(); })
        .filter(Boolean)
        .slice(0, 4);

      if (!lines.length) throw new Error('empty');

      renderAiTopicSuggestions(lines);
      toast('已为你构思了几个方向');
    }catch(e){
      toast(e && e.code === 'NO_API' ? '请先在设置中配置 API 连接' : 'AI 暂时没能想出来，换个话题试试');
    }finally{
      btn.classList.remove('loading');
      btnText.textContent = 'AI 帮我想';
    }
  }

  function renderAiTopicSuggestions(lines){
    var listEl = els.topicSuggestList;
    listEl.innerHTML = lines.map(function(t, i){
      return '<button type="button" class="topic-chip" style="animation-delay:' + (i * 0.06) + 's" data-suggest>' + escapeHtml(t) + '</button>';
    }).join('');
    listEl.hidden = false;

    listEl.querySelectorAll('[data-suggest]').forEach(function(chip){
      chip.addEventListener('click', function(){
        listEl.querySelectorAll('.topic-chip').forEach(function(c){ c.classList.remove('picked'); });
        chip.classList.add('picked');
        els.topicInput.value = chip.textContent;
        els.topicInput.dispatchEvent(new Event('input'));
        vibrate(5);
      });
    });
  }

  /* ============================================================
     Stage 2 · 角色甄选
  ============================================================ */
  async function wireCharStage(){
    allChars = await getAllChars();
    renderCharGallery();

    els.toReverieBtn.addEventListener('click', function(){
      if (!selectedChar) return;
      vibrate(6);
      goStage('reverie');
      runReverieGeneration();
    });
  }

  function charColor(idx){
    var palette = [
      ['#c9bfe0', '#e3c9d1'],
      ['#d4c49a', '#e3c9d1'],
      ['#c9bfe0', '#d4c49a'],
      ['#e3c9d1', '#c9bfe0']
    ];
    return palette[idx % palette.length];
  }

  function renderCharGallery(){
    var gallery = els.charGallery;
    var emptyState = els.charEmptyState;

    if (!allChars.length){
      gallery.innerHTML = '';
      emptyState.hidden = false;
      els.toReverieBtn.disabled = true;
      return;
    }
    emptyState.hidden = true;

    gallery.innerHTML = allChars.map(function(c, i){
      var letter = (c.name || '?')[0].toUpperCase();
      var col = charColor(i);
      var avatarHtml = c.avatar
        ? '<img src="' + c.avatar + '" alt="" />'
        : '<span class="cc-avatar-letter">' + escapeHtml(letter) + '</span>';
      return (
        '<button type="button" class="char-card" data-char-id="' + c.id + '" style="animation-delay:' + (i * 0.05) + 's">' +
          '<span class="cc-check"><svg viewBox="0 0 24 24" fill="none"><path d="M4 12.5 9 18 20 6"/></svg></span>' +
          '<div class="cc-avatar" style="background:linear-gradient(135deg,' + col[0] + ',' + col[1] + ')">' + avatarHtml + '</div>' +
          '<div class="cc-name">' + escapeHtml(c.name || '未命名') + '</div>' +
          '<div class="cc-role">' + escapeHtml(c.role || 'CHARACTER') + '</div>' +
        '</button>'
      );
    }).join('');

    gallery.querySelectorAll('.char-card').forEach(function(card){
      card.addEventListener('click', function(){
        var id = parseInt(card.dataset.charId, 10);
        selectedChar = allChars.filter(function(c){ return c.id === id; })[0] || null;
        gallery.querySelectorAll('.char-card').forEach(function(c){ c.classList.remove('selected'); });
        card.classList.add('selected');
        els.toReverieBtn.disabled = !selectedChar;
        vibrate(5);
      });
    });
  }

  /* ============================================================
     Stage 3 · 共感回响生成
  ============================================================ */
  function setLoadingStep(stepName){
    document.querySelectorAll('.rl-step').forEach(function(s){
      var order = ['read', 'embody', 'write'];
      var si = order.indexOf(s.dataset.rl);
      var ci = order.indexOf(stepName);
      s.classList.toggle('active', si === ci);
      s.classList.toggle('done', si < ci);
    });
  }

  function showReverieSection(section){
    els.reverieLoading.hidden = section !== 'loading';
    els.reverieResult.hidden = section !== 'result';
    els.reverieError.hidden = section !== 'error';
  }

  async function runReverieGeneration(){
    if (!currentEntry || !selectedChar) return;

    showReverieSection('loading');
    els.rlText.textContent = '正在织梦……';
    setLoadingStep('read');

    var MIN_LEN = 500;
    var moodLabel = (MOOD_META[currentEntry.mood] || MOOD_META.calm).label;

    var sysPrompt = selectedChar.prompt ||
      ('你将完全代入角色"' + (selectedChar.name || '该角色') + '"，以第一人称与用户对话，不跳出角色身份。');

    var DELIM_IMG = '\n===IMAGE===\n';
    var DELIM_VOICE = '\n===INNER===\n';

    var taskPrompt =
      '现在，你不是在进行普通对话，而是在为用户的一篇私人日记写一段完整的「共感回应」，由三个部分组成。\n\n' +
      '【日记原文】\n' + (currentEntry.body || '（无正文）') + '\n\n' +
      '【日记心情标记】' + moodLabel + '\n' +
      '【用户希望被共感的话题】' + selectedTopic + '\n\n' +
      '请完全代入你的角色人设与语气，依次写出以下三个部分，并严格使用指定的分隔符隔开，不要添加任何其他标题、编号或解释：\n\n' +
      '【第一部分：共感正文】\n' +
      '以第一人称、代入角色语气，真正回应日记里的具体细节与情绪，写一段真挚、贴近、能让人感到被理解的话语。\n' +
      '字数不少于 ' + MIN_LEN + ' 字（这是硬性下限，不论日记原文多短都必须写满这个篇幅），内容要有层次、有细节，不要空洞重复、不要写成口水话凑字数。\n\n' +
      '然后另起一段，输出分隔符 ===IMAGE=== ，紧接着写：\n' +
      '【第二部分：配图文字描述】\n' +
      '用 60-120 字，以画面感极强的语言描述一张能与这段共感场景相配的插画/照片——光线、色调、构图、氛围、细节，像是给画师的一段简短意象描述。不要写成对话，只写画面本身。\n\n' +
      '然后另起一段，输出分隔符 ===INNER=== ，紧接着写：\n' +
      '【第三部分：心声/内心独白】\n' +
      '用 40-90 字，写角色在说出上面那段共感正文时，心里真正想着、却没有说出口的念头或感受——更私密、更不加修饰、更真实的一层。仍用第一人称、符合角色语气。\n\n' +
      '严格要求：\n' +
      '1. 只输出这三部分内容本身（含两个分隔符），不要任何前缀说明、总标题、引号或额外解释；\n' +
      '2. 三部分语气、用词、口头禅都必须符合你的角色人设，保持第一人称；\n' +
      '3. 共感正文字数硬性不少于 ' + MIN_LEN + ' 字，请务必写够，不要偷懒缩短。';

    setTimeout(function(){ setLoadingStep('embody'); els.rlText.textContent = '正在代入 ' + (selectedChar.name || 'Ta') + ' 的视角……'; }, 700);
    setTimeout(function(){ setLoadingStep('write'); els.rlText.textContent = '正在落笔书写……'; }, 1500);

    try{
      var raw = await callChatCompletion([
        { role: 'system', content: sysPrompt },
        { role: 'user', content: taskPrompt }
      ], { maxTokens: 2200, temperature: 0.95 });

      var bodyPart = raw, imagePart = '', voicePart = '';
      var imgSplit = raw.split(/===\s*IMAGE\s*===/i);
      if (imgSplit.length > 1){
        bodyPart = imgSplit[0];
        var rest = imgSplit.slice(1).join('');
        var voiceSplit = rest.split(/===\s*INNER\s*===/i);
        imagePart = voiceSplit[0];
        voicePart = voiceSplit.slice(1).join('');
      }

      var cleanQuotes = function(s){ return (s || '').replace(/^["""'']+|["""'']+$/g, '').trim(); };
      bodyPart = cleanQuotes(bodyPart);
      imagePart = cleanQuotes(imagePart);
      voicePart = cleanQuotes(voicePart);

      /* 兜底：若正文仍不足下限（模型未遵守），追加一次续写请求 */
      if (bodyPart.length < MIN_LEN * 0.8){
        try{
          var extra = await callChatCompletion([
            { role: 'system', content: sysPrompt },
            { role: 'user', content: taskPrompt },
            { role: 'assistant', content: raw },
            { role: 'user', content: '共感正文部分字数不够，请只继续扩写「共感正文」这一部分（不要重复已写内容，紧接着往下写），补足到总共不少于 ' + MIN_LEN + ' 字，仍保持角色语气与第一人称，直接输出续写内容本身即可。' }
          ], { maxTokens: 1200, temperature: 0.95 });
          bodyPart = bodyPart + (extra ? ('\n' + cleanQuotes(extra)) : '');
        }catch(e2){ /* 续写失败则使用现有内容 */ }
      }

      currentResultRecord = {
        id: 'dream_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        ts: Date.now(),
        topic: selectedTopic,
        charId: selectedChar.id,
        charName: selectedChar.name || '未命名角色',
        charAvatar: selectedChar.avatar || null,
        body: bodyPart,
        imageCaption: imagePart,
        innerVoice: voicePart,
        wordCount: bodyPart.length
      };

      renderReverieResult(currentResultRecord, true);
      showReverieSection('result');
    }catch(e){
      els.reText.textContent = (e && e.code === 'NO_API') ? '尚未配置 API 连接' : '这次的织梦没能完成';
      els.reSub.textContent = (e && e.code === 'NO_API')
        ? '请先前往「设置 → API 配置」填写并选择模型，再回到这里唤醒共感梦境。'
        : '可能是网络波动或接口暂时无法响应，请稍后再试一次。';
      showReverieSection('error');
    }
  }

  /* ---- 逐字浮现渲染（痕迹感动画）---- */
  function renderReverieResult(record, animate){
    var mood = currentEntry ? (MOOD_META[currentEntry.mood] || MOOD_META.calm).label : '';

    els.rrAvatar.innerHTML = record.charAvatar
      ? '<img src="' + record.charAvatar + '" alt="" />'
      : '<span class="rr-avatar-letter">' + escapeHtml((record.charName || '?')[0]) + '</span>';
    els.rrCharName.textContent = record.charName;
    els.rrTopic.textContent = record.topic;
    els.rrTimestamp.textContent = fmtDate(record.ts) + ' · ' + fmtTime(record.ts);
    els.rrWordCount.textContent = record.wordCount + ' 字';

    if (record.imageCaption){
      els.rrImageCaptionText.textContent = record.imageCaption;
      els.rrImageCaption.hidden = false;
    } else {
      els.rrImageCaption.hidden = true;
    }
    if (record.innerVoice){
      els.rrInnerVoiceText.textContent = record.innerVoice;
      els.rrInnerVoice.hidden = false;
    } else {
      els.rrInnerVoice.hidden = true;
    }

    var container = els.rrBodyText;
    container.innerHTML = '';

    if (!animate){
      container.textContent = record.body;
      return;
    }

    var chars = Array.from(record.body);
    var cursor = document.createElement('span');
    cursor.className = 'rr-cursor';
    container.appendChild(cursor);

    var i = 0;
    var batchSize = 1;
    function step(){
      var frag = document.createDocumentFragment();
      for (var k = 0; k < batchSize && i < chars.length; k++, i++){
        var span = document.createElement('span');
        span.className = 'rr-char-span';
        span.style.animationDelay = '0s';
        span.textContent = chars[i];
        frag.appendChild(span);
      }
      container.insertBefore(frag, cursor);
      if (i < chars.length){
        requestAnimationFrame(function(){ setTimeout(step, 16); });
      } else {
        cursor.classList.add('hide');
      }
    }
    step();
  }

  function wireReverieStage(){
    els.rrRewriteBtn.addEventListener('click', function(){
      vibrate(6);
      runReverieGeneration();
    });

    els.rrSaveBtn.addEventListener('click', function(){
      if (!currentResultRecord) return;
      saveToArchive(currentResultRecord);
      vibrate([8, 30, 8]);
      toast('已收入梦境档案');
      updateArchiveBadge();
      setTimeout(function(){ goStage('archive'); }, 550);
    });

    els.reRetryBtn.addEventListener('click', function(){
      runReverieGeneration();
    });
  }

  /* ============================================================
     Stage 4 · 梦境档案
  ============================================================ */
  function saveToArchive(record){
    var store = loadArchiveStore();
    if (!store[entryId]) store[entryId] = [];
    store[entryId].push(record);
    saveArchiveStore(store);
  }

  function getArchiveForEntry(){
    var store = loadArchiveStore();
    return store[entryId] || [];
  }

  function updateArchiveBadge(){
    var list = getArchiveForEntry();
    els.archiveBadge.classList.toggle('show', list.length > 0);
  }

  function renderArchiveList(){
    var list = getArchiveForEntry().slice().reverse();
    var listEl = els.archiveList;
    var emptyEl = els.archiveEmptyState;
    var newBtn = els.archiveNewBtn;

    if (!list.length){
      listEl.innerHTML = '';
      emptyEl.hidden = false;
      newBtn.hidden = true;
      return;
    }
    emptyEl.hidden = true;
    newBtn.hidden = false;

    listEl.innerHTML = list.map(function(r){
      var avatarHtml = r.charAvatar
        ? '<img src="' + r.charAvatar + '" alt="" />'
        : '<span class="ai-avatar-letter">' + escapeHtml((r.charName || '?')[0]) + '</span>';
      return (
        '<div class="archive-item" data-record-id="' + r.id + '">' +
          '<div class="ai-head">' +
            '<div class="ai-avatar">' + avatarHtml + '</div>' +
            '<div class="ai-name">' + escapeHtml(r.charName) + '</div>' +
            '<div class="ai-time">' + fmtDate(r.ts) + ' ' + fmtTime(r.ts) + '</div>' +
          '</div>' +
          '<div class="ai-topic">' + escapeHtml(r.topic) + '</div>' +
          '<div class="ai-snippet">' + escapeHtml(r.body) + '</div>' +
          '<div class="ai-foot">' +
            '<span class="ai-wc">' + r.wordCount + ' 字</span>' +
            '<span class="ai-open">展开重读<svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    listEl.querySelectorAll('.archive-item').forEach(function(item){
      item.addEventListener('click', function(){
        var record = list.filter(function(r){ return r.id === item.dataset.recordId; })[0];
        if (record) openReader(record);
      });
    });
  }

  function openReader(record){
    els.readerAvatar.innerHTML = record.charAvatar
      ? '<img src="' + record.charAvatar + '" alt="" />'
      : '<span class="rr-avatar-letter">' + escapeHtml((record.charName || '?')[0]) + '</span>';
    els.readerCharName.textContent = record.charName;
    els.readerTopic.textContent = record.topic;
    els.readerBodyText.textContent = record.body;
    els.readerWordCount.textContent = record.wordCount + ' 字 · ' + fmtDate(record.ts) + ' ' + fmtTime(record.ts);

    if (record.imageCaption){
      els.readerImageCaptionText.textContent = record.imageCaption;
      els.readerImageCaption.hidden = false;
    } else {
      els.readerImageCaption.hidden = true;
    }
    if (record.innerVoice){
      els.readerInnerVoiceText.textContent = record.innerVoice;
      els.readerInnerVoice.hidden = false;
    } else {
      els.readerInnerVoice.hidden = true;
    }

    els.readerVeil.classList.add('show');
    els.readerModal.classList.add('show');
    els.readerModal.setAttribute('aria-hidden', 'false');
  }
  function closeReader(){
    els.readerVeil.classList.remove('show');
    els.readerModal.classList.remove('show');
    els.readerModal.setAttribute('aria-hidden', 'true');
  }

  function wireArchiveStage(){
    els.aeStartBtn.addEventListener('click', function(){ goStage('topic'); });
    els.archiveNewBtn.addEventListener('click', function(){
      /* 保留已选角色与话题输入，直接回到话题步开始新一轮 */
      goStage('topic');
    });
    els.readerCloseBtn.addEventListener('click', closeReader);
    els.readerVeil.addEventListener('click', closeReader);
  }

  /* ============================================================
     Part E —— 顶部工具条 / 返回逻辑
  ============================================================ */
  function wireTopbar(){
    els.backBtn.addEventListener('click', function(){
      vibrate(5);
      if (currentStageIndex > 0 && STAGE_ORDER[currentStageIndex] !== 'archive'){
        goStage(STAGE_ORDER[Math.max(0, currentStageIndex - 1)]);
        return;
      }
      goBackToDiary();
    });

    els.archiveBtn.addEventListener('click', function(){
      vibrate(5);
      goStage('archive');
    });
  }

  function goBackToDiary(){
    if (window.history.length > 1 && document.referrer.indexOf('diary.html') !== -1){
      window.history.back();
    } else {
      window.location.href = '../diary.html';
    }
  }

  /* ============================================================
     初始化
  ============================================================ */
  function collectEls(){
    [
      'topicInput','topicCount','aiSuggestBtn','topicSuggestList','topicPresets','topicPresetList','toCharBtn',
      'charGallery','charEmptyState','toReverieBtn',
      'reverieLoading','reverieResult','reverieError','rlText','rrAvatar','rrCharName','rrTopic','rrTimestamp',
      'rrBodyText','rrWordCount','rrRewriteBtn','rrSaveBtn','reText','reSub','reRetryBtn',
      'rrImageCaption','rrImageCaptionText','rrInnerVoice','rrInnerVoiceText',
      'archiveList','archiveEmptyState','aeStartBtn','archiveNewBtn',
      'readerVeil','readerModal','readerAvatar','readerCharName','readerTopic','readerBodyText','readerWordCount','readerCloseBtn',
      'readerImageCaption','readerImageCaptionText','readerInnerVoice','readerInnerVoiceText',
      'backBtn','archiveBtn','archiveBadge','dreamToast'
    ].forEach(function(id){ els[id] = document.getElementById(id); });
    els.dreamStageWrap = document.querySelector('.dream-stage-wrap');
  }

  function showMissingEntryState(){
    document.querySelectorAll('.dream-stage').forEach(function(s){ s.innerHTML = ''; });
    var stage = document.querySelector('.dream-stage[data-stage="topic"]');
    stage.classList.add('active');
    stage.innerHTML =
      '<div class="archive-empty" style="margin-top:80px;">' +
        '<div class="ae-mark"></div>' +
        '<div class="ae-text">没有找到对应的日记</div>' +
        '<div class="ae-sub">这段共感梦境，需要先有一篇日记作为起点</div>' +
        '<button class="ae-start-btn" id="backToDiaryBtn" type="button">返回日记</button>' +
      '</div>';
    document.getElementById('backToDiaryBtn').addEventListener('click', goBackToDiary);
    document.getElementById('dreamProgress').style.display = 'none';
  }

  document.addEventListener('DOMContentLoaded', function(){
    collectEls();
    wireTopbar();

    if (!entryId){
      showMissingEntryState();
      return;
    }
    var entries = loadDiaryEntries();
    currentEntry = entries.filter(function(e){ return e.id === entryId; })[0];
    if (!currentEntry){
      showMissingEntryState();
      return;
    }

    renderSourceQuotes();
    wireTopicStage();
    wireCharStage();
    wireReverieStage();
    wireArchiveStage();
    updateArchiveBadge();

    goStage('topic', { silent: true });
  });

})();