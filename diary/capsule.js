/* ================================================================
   capsule.js — 时空胶囊 · Time Capsule
   数据来源：
     · 日记原文  —— localStorage['luna_diary_entries_mine']（entryId 由 URL 传入）
     · 角色档案  —— IndexedDB LunaCharDB / chars（与 characters.js 同源）
     · 记忆档案  —— IndexedDB LunaMemoryDB / memories（避免人设失真）
     · 世界书    —— IndexedDB LunaWorldBookDB / entries（常驻设定）
     · API 配置  —— localStorage['luna_api_current'] + ['luna_api_model']
   归档写入：localStorage['luna_capsule_archive'] = { [entryId]: [ {…} ] }
             与 diary.js 中 fcCapsuleCount 徽标统计逻辑保持字段一致（status: 'opened'）
================================================================ */

(function(){
  'use strict';

  /* ============================================================
     Part A —— 状态栏同步（与 diary.js 完全一致的实现）
  ============================================================ */
  function updateTime(){
    var tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
    var timeStr;
    try{
      timeStr = new Date().toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
    }catch(e){
      timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    var el = document.getElementById('statusTime');
    if (el) el.textContent = timeStr;
  }

  function updateBattery(){
    var pct = parseInt(localStorage.getItem('luna_battery') || '76', 10);
    if (isNaN(pct)) pct = 76;
    var grad = pct <= 20 ? 'linear-gradient(90deg, #f87171, #ef4444)' : 'linear-gradient(90deg, #6ee7b7, #34d399)';
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
    el.innerHTML = enabled ? (styleMap[style] || styleMap.minimal) : '';
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
      tag.textContent = '.capsule-app *{ ' + familyRule + ' }';
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
                face.load().then(function(loaded){ document.fonts.add(loaded); finish(); }).catch(finish);
              } else { finish(); }
            };
            r.onerror = finish;
          }catch(e2){ finish(); }
        };
        req.onerror = finish;
      }catch(e){ finish(); }
    } else { finish(); }
  }

  window.addEventListener('storage', function(e){
    if (e.key === 'luna_font_update')   applyGlobalFont();
    if (e.key === 'luna_island_update') applyIsland();
    if (e.key === 'luna_tz_update')     updateTime();
    if (e.key === 'luna_battery')       updateBattery();
  });

  updateTime(); updateBattery(); applyIsland(); applyGlobalFont();
  setInterval(updateTime, 10000);

  /* 漂浮微光粒子的随机生成，仅视觉装饰 */
  function seedMotes(){
    var wrap = document.getElementById('capsuleMotes');
    if (!wrap) return;
    var n = 14;
    for (var i = 0; i < n; i++){
      var m = document.createElement('div');
      m.className = 'capsule-mote';
      m.style.left = (Math.random() * 100) + '%';
      m.style.top = (Math.random() * 100) + '%';
      m.style.setProperty('--ms', (3 + Math.random() * 4) + 'px');
      m.style.setProperty('--mdur', (10 + Math.random() * 10) + 's');
      m.style.setProperty('--mdel', (Math.random() * -14) + 's');
      wrap.appendChild(m);
    }
  }
  seedMotes();


  /* ============================================================
     Part B —— 读取当前日记条目
  ============================================================ */
  var STORAGE_KEY = 'luna_diary_entries_mine';

  function getEntryIdFromUrl(){
    var params = new URLSearchParams(window.location.search);
    var raw = params.get('entryId');
    if (raw == null) return null;
    var num = Number(raw);
    return isNaN(num) ? raw : num;
  }

  function loadEntries(){
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch(e){ return []; }
  }

  function findEntry(entryId){
    var list = loadEntries();
    return list.find(function(e){ return String(e.id) === String(entryId); }) || null;
  }

  var MOOD_LABEL = { calm: '平静', joy: '欢喜', tender: '柔软', blue: '低落', storm: '翻涌' };

  var _entryId = getEntryIdFromUrl();
  var _entry = _entryId != null ? findEntry(_entryId) : null;

  function renderEntryChip(){
    var chip = document.getElementById('entryChipText');
    if (!chip) return;
    if (_entry){
      chip.textContent = _entry.title || '这篇日记';
    } else {
      chip.textContent = '未找到日记';
    }
  }
  renderEntryChip();


  /* ============================================================
     Part C —— 角色档案读取（与 characters.js 同源的 IndexedDB 逻辑）
  ============================================================ */
  var COLOR_MAP = {
    ink:    { avBg:'#101012', avCol:'#c9c9cd' },
    slate:  { avBg:'#141416', avCol:'#b8bac0' },
    silver: { avBg:'#1a1a1c', avCol:'#d4d4d8' },
    frost:  { avBg:'#111316', avCol:'#c8ccd0' },
    smoke:  { avBg:'#0e0e10', avCol:'#bdbdc2' },
    pearl:  { avBg:'#1c1c1e', avCol:'#e0e0e3' },
  };

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
            if (!db3.objectStoreNames.contains('chars')) db3.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
          };
          req3.onsuccess = function(e3){ _charDb = e3.target.result; res(_charDb); };
          req3.onerror = function(e3){ rej(e3.target.error); };
        }
      };
      probe.onerror = function(e){ rej(e.target.error); };
      probe.onupgradeneeded = function(e){
        var db0 = e.target.result;
        if (!db0.objectStoreNames.contains('chars')) db0.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
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

  /* ---- 世界书（常驻条目注入，逻辑与 characters.js 的 buildWorldbookPromptForChar 一致） ---- */
  var _wbDb = null;
  function openWbDB(){
    return new Promise(function(res, rej){
      if (_wbDb) return res(_wbDb);
      var req = indexedDB.open('LunaWorldBookDB', 2);
      req.onupgradeneeded = function(e){
        if (!e.target.result.objectStoreNames.contains('entries'))
          e.target.result.createObjectStore('entries', { keyPath: 'id', autoIncrement: true });
      };
      req.onsuccess = function(e){ _wbDb = e.target.result; res(_wbDb); };
      req.onerror = function(){ rej('WB DB Error'); };
    });
  }
  function getAllWbEntries(){
    return openWbDB().catch(function(){ return null; }).then(function(db){
      if (!db) return [];
      return new Promise(function(res){
        var req = db.transaction('entries', 'readonly').objectStore('entries').getAll();
        req.onsuccess = function(){ res(req.result || []); };
        req.onerror = function(){ res([]); };
      });
    });
  }
  function buildWorldbookPromptForChar(charId){
    return getAllWbEntries().then(function(allEntries){
      var relevant = allEntries.filter(function(e){
        if (e.enabled === false) return false;
        if (e.mode !== 'constant') return false;
        var chars = Array.isArray(e.chars) ? e.chars : [];
        return chars.length === 0 || chars.indexOf(charId) !== -1;
      });
      if (!relevant.length) return '';
      relevant.sort(function(a, b){ return (b.priority || 5) - (a.priority || 5); });
      var block = '【世界设定 —— 来自关联世界书，请作为背景真实世界规则遵守】\n';
      relevant.forEach(function(e){
        block += '◆ ' + (e.title || '未命名');
        if (e.sub) block += '（' + e.sub + '）';
        block += '\n' + (e.detail || '') + '\n\n';
      });
      return block.trim();
    });
  }

  /* ---- 记忆档案（逻辑与 characters.js 的 buildMemoryPromptStandalone 一致） ---- */
  function openMemDB(){
    return new Promise(function(res, rej){
      var req = indexedDB.open('LunaMemoryDB', 1);
      req.onupgradeneeded = function(e){
        var db = e.target.result;
        if (!db.objectStoreNames.contains('memories')){
          var store = db.createObjectStore('memories', { keyPath: 'id' });
          store.createIndex('charId', 'charId', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
      };
      req.onsuccess = function(e){ res(e.target.result); };
      req.onerror = function(e){ rej(e.target.error); };
    });
  }
  function getAllMemories(){
    return openMemDB().catch(function(){ return null; }).then(function(db){
      if (!db) return [];
      return new Promise(function(res){
        if (!db.objectStoreNames.contains('memories')){ res([]); return; }
        var req = db.transaction('memories', 'readonly').objectStore('memories').getAll();
        req.onsuccess = function(){ res(req.result || []); };
        req.onerror = function(){ res([]); };
      });
    });
  }
  function memTypeLabel(type){ return { core: '核心记忆', relation: '关系', emotion: '情绪', event: '事件' }[type] || '记忆'; }
  function buildMemoryPrompt(charId){
    return getAllMemories().then(function(all){
      var mems = all.filter(function(m){ return m.charId === charId || m.charName === charId; });
      if (!mems.length) return '';
      var alwaysOn = mems.filter(function(m){ return m.alwaysOn; });
      var rest = mems.filter(function(m){ return !m.alwaysOn; });
      function byType(t){
        return rest.filter(function(m){ return (m.type || 'core') === t; })
          .sort(function(a, b){ return (b.intensity || 0) - (a.intensity || 0); });
      }
      var relationMems = byType('relation').slice(0, 3);
      var emotionMems  = byType('emotion').slice(0, 3);
      var eventMems    = byType('event').concat(byType('core')).slice(0, 5);
      var lines = ['[记忆档案注入 · ' + charId + ']'];
      if (alwaysOn.length){
        lines.push('\n【核心常驻记忆 · 每次对话必定生效，具有最高优先级】');
        alwaysOn.slice(0, 6).forEach(function(m){
          lines.push('- ' + m.title + '（' + memTypeLabel(m.type) + '）');
          if (m.prompt) lines.push('  → ' + m.prompt);
          else if (m.content) lines.push('  → ' + m.content.slice(0, 120));
        });
      }
      if (relationMems.length){
        lines.push('\n【当前关系状态 · 请据此判断称呼与亲密程度，不要回退到更早的关系阶段】');
        relationMems.forEach(function(m){ lines.push('- ' + m.title + '：' + (m.prompt || m.content || '').slice(0, 90)); });
      }
      if (emotionMems.length){
        lines.push('\n【近期情绪基调 · 情绪表达应与此保持连贯，不要无故跳变】');
        emotionMems.forEach(function(m){ lines.push('- ' + m.title + '（强度' + (m.intensity || 3) + '/5）：' + (m.prompt || m.content || '').slice(0, 70)); });
      }
      if (eventMems.length){
        lines.push('\n【背景记忆参考 · 可作为细节引用，非必须逐条复述】');
        eventMems.forEach(function(m){ lines.push('- ' + m.title + '：' + (m.prompt || m.content || '').slice(0, 70)); });
      }
      return lines.join('\n');
    });
  }

  function escHtml(s){
    return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }


  /* ============================================================
     Part D —— 角色选择（Stage 1）
  ============================================================ */
  var _chars = [];
  var _selectedCharId = null;
  var _selectedBranch = null; // 'past' | 'future'

  function renderCharPicker(){
    var grid = document.getElementById('charPickerGrid');
    var cta = document.getElementById('toBranchBtn');
    if (!grid) return;

    if (!_chars.length){
      grid.innerHTML = '';
      grid.insertAdjacentHTML('afterend',
        '<div class="char-picker-empty" id="charEmptyHint">还没有创建任何角色。<br/>先去 <a href="../characters.html">角色档案</a> 里创建一位角色，<br/>才能请 Ta 为你写这封信。</div>'
      );
      if (cta) cta.disabled = true;
      return;
    }

    grid.innerHTML = _chars.map(function(c){
      var col = COLOR_MAP[c.color] || COLOR_MAP.ink;
      var letter = (c.name || '?')[0].toUpperCase();
      var avatarInner = c.avatar
        ? '<img src="' + c.avatar + '" alt="" />'
        : '<span>' + escHtml(letter) + '</span>';
      return (
        '<div class="char-pick-card" data-id="' + c.id + '">' +
          '<div class="cpc-check"><svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
          '<div class="cpc-avatar" style="--av-bg:' + col.avBg + ';--av-col:' + col.avCol + '">' + avatarInner + '</div>' +
          '<div class="cpc-name">' + escHtml(c.name || '未命名') + '</div>' +
          '<div class="cpc-role">' + escHtml(c.role || '暂无定位') + '</div>' +
        '</div>'
      );
    }).join('');

    grid.querySelectorAll('.char-pick-card').forEach(function(card){
      card.addEventListener('click', function(){
        var id = parseInt(card.dataset.id, 10);
        _selectedCharId = id;
        grid.querySelectorAll('.char-pick-card').forEach(function(c){ c.classList.toggle('selected', parseInt(c.dataset.id, 10) === id); });
        if (cta) cta.disabled = false;
      });
    });
  }

  function getSelectedChar(){
    return _chars.find(function(c){ return c.id === _selectedCharId; }) || null;
  }

  getAllChars().then(function(list){
    _chars = list;
    renderCharPicker();
  });


  /* ============================================================
     Part E —— Stage 切换
  ============================================================ */
  var STAGES = ['stage1', 'stage2', 'stage3', 'stage4'];
  function goStage(name){
    STAGES.forEach(function(s){
      var el = document.getElementById(s);
      if (el) el.classList.toggle('active', s === name);
    });
    var scroll = document.getElementById('capsuleScroll');
    if (scroll) scroll.scrollTop = 0;
  }

  document.getElementById('toBranchBtn').addEventListener('click', function(){
    var c = getSelectedChar();
    if (!c) return;
    fillBranchStrip(c);
    goStage('stage2');
  });

  function fillBranchStrip(c){
    var col = COLOR_MAP[c.color] || COLOR_MAP.ink;
    var letter = (c.name || '?')[0].toUpperCase();
    var av = document.getElementById('bssAvatar');
    av.style.setProperty('--av-bg', col.avBg);
    av.style.setProperty('--av-col', col.avCol);
    av.innerHTML = c.avatar ? '<img src="' + c.avatar + '" alt="" />' : '<span>' + escHtml(letter) + '</span>';
    document.getElementById('bssName').textContent = c.name || '未命名角色';
    document.getElementById('bssSub').textContent = (c.role || '角色') + ' · 将以此身份读信';

    var pastDesc = document.getElementById('branchPastDesc');
    var futureDesc = document.getElementById('branchFutureDesc');
    if (pastDesc) pastDesc.textContent = '让' + (c.name || 'Ta') + '以更早、更青涩的自己，读到你今天写下的文字——带着那时候才有的天真、笨拙或未经世事的关切，回望此刻的你。';
    if (futureDesc) futureDesc.textContent = '让' + (c.name || 'Ta') + '以走得更远、更从容的自己，回头读到你今天写下的文字——带着已经和解的释然，或是尚可提醒的温柔警示。';
  }

  document.getElementById('bssChange').addEventListener('click', function(){ goStage('stage1'); });
  document.getElementById('backToCharBtn').addEventListener('click', function(){ goStage('stage1'); });
  document.getElementById('backToBranchBtn').addEventListener('click', function(){ goStage('stage2'); });

  document.getElementById('branchPastCard').addEventListener('click', function(){ startGeneration('past'); });
  document.getElementById('branchFutureCard').addEventListener('click', function(){ startGeneration('future'); });

  document.getElementById('capsuleBackBtn').addEventListener('click', function(){
    var mask = document.createElement('div');
    mask.style.cssText = 'position:fixed;inset:0;background:rgba(238,234,227,0.97);opacity:0;z-index:9999;transition:opacity 0.28s ease;pointer-events:all;';
    document.body.appendChild(mask);
    requestAnimationFrame(function(){ mask.style.opacity = '1'; });
    setTimeout(function(){
      if (_entry) window.location.href = '../diary.html';
      else window.location.href = '../diary.html';
    }, 260);
  });


  /* ============================================================
     Part F —— 人设锚点拼接 + Prompt 构建
     核心目标：绝不 OOC —— 把角色档案的每一个维度都显式喂给模型，
     并明确指令「过去/未来」分支下应如何在人设基础上做时间位移，
     而不是脱离人设凭空扮演一个「过来人」。
  ============================================================ */
  function buildPersonaBlock(c){
    var lines = [];
    lines.push('【角色档案 · 请严格依据以下设定扮演，禁止偏离人设(OOC)，禁止表现为通用AI助手】');
    lines.push('姓名：' + (c.name || '未命名'));
    if (c.role) lines.push('定位/身份：' + c.role);
    if (c.gender) lines.push('性别：' + c.gender);
    if (c.age) lines.push('年龄：' + c.age);
    if (c.species) lines.push('种族/身份类别：' + c.species);
    if (c.appearance) lines.push('外貌特征：' + c.appearance);
    if (c.outfit) lines.push('常见装扮：' + c.outfit);
    if (c.traits && c.traits.length) lines.push('性格特质：' + c.traits.join('、'));
    if (c.desc) lines.push('人物简介：' + c.desc);
    if (c.speechStyle) lines.push('说话风格：' + c.speechStyle);
    if (c.catchphrases && c.catchphrases.length) lines.push('口头禅/常用句：' + c.catchphrases.join('、'));
    if (c.fears) lines.push('恐惧/在意之事：' + c.fears);
    if (c.backstory) lines.push('背景故事：' + c.backstory);
    if (c.relation) lines.push('与用户的关系：' + c.relation);
    if (c.callUser) lines.push('对用户的称呼：' + c.callUser);
    if (c.relationDetail) lines.push('关系细节：' + c.relationDetail);
    if (c.boundaries) lines.push('行为边界：' + c.boundaries);
    if (c.neverList && c.neverList.length) lines.push('绝对禁止事项：' + c.neverList.join('；'));
    if (c.prompt) lines.push('\n【原始人设 Prompt · 最高优先级，逐字遵守】\n' + c.prompt);
    return lines.join('\n');
  }

  function buildBranchInstruction(branch, charName){
    var name = charName || '角色';
    if (branch === 'past'){
      return (
        '【时间分支 · 过去的' + name + '】\n' +
        '你现在扮演的，是「更早以前」的' + name + '——一个人设核心不变、但阅历更浅、情绪更直接、\n' +
        '尚未经历后续成长与和解的自己。你不知道后来发生的具体事，只凭当下的性格与心境去感受这篇日记。\n' +
        '你的语气可以更冲动、更笨拙、更没有修饰，但绝不能脱离人设变成一个空洞的"过来人说教者"。\n' +
        '你是在用自己此刻仅有的理解力，笨拙而真诚地，向未来写下这篇日记的那个人说话。'
      );
    }
    return (
      '【时间分支 · 未来的' + name + '】\n' +
      '你现在扮演的，是「更往后」的' + name + '——一个人设核心不变、但已经走过了更长一段路、\n' +
      '积累了更多阅历与从容感的自己。你隐约"记得"曾经历过与这篇日记相似的心绪，但不必给出具体剧透式的\n' +
      '未来情节，重点是那种历经之后才会有的语气：更松弛、更有回旋余地，或是温柔而克制的提醒。\n' +
      '你是在用未来才会有的眼光，回头凝视写下这篇日记的那个人，并写信给 Ta。'
    );
  }

  function buildDiaryBlock(entry){
    var lines = [];
    lines.push('【这篇被阅读的日记原文】');
    lines.push('标题：' + (entry.title || '无题'));
    if (entry.mood) lines.push('心情标签：' + (MOOD_LABEL[entry.mood] || entry.mood));
    if (entry.weather) lines.push('天气：' + entry.weather);
    if (entry.location) lines.push('地点：' + entry.location);
    if (entry.tags && entry.tags.length) lines.push('标签：' + entry.tags.join('、'));
    lines.push('正文：\n' + (entry.body || '（这篇日记暂无正文）'));
    return lines.join('\n');
  }

  function buildSystemPrompt(c, branch, worldPrompt, memoryPrompt){
    var parts = [];
    parts.push(buildPersonaBlock(c));
    if (worldPrompt) parts.push(worldPrompt);
    if (memoryPrompt) parts.push(memoryPrompt);
    parts.push(buildBranchInstruction(branch, c.name));
    parts.push(
      '【格式与人设锚点 · 无论任务如何都必须遵守】\n' +
      '- 全程保持第一人称的角色身份，绝不以"AI""语言模型""助手"等身份自称或跳出角色解释\n' +
      '- 这是一封写给日记作者本人的私人信件，不是通用建议文，不要写成心理咨询模板\n' +
      '- 必须体现出你确实"读过"这篇日记——自然地引用或呼应其中的具体细节、情绪、场景，\n' +
      '  而不是泛泛而谈，让人一眼看出这是针对这篇日记量身写下的\n' +
      '- 语气、用词、句式必须与角色档案中的说话风格、性格特质、口头禅高度一致，不能变成千篇一律的温柔语气\n' +
      '- 若设定了行为边界或绝对禁止事项，必须严格遵守，不能因为"写信"这个任务而破例'
    );
    return parts.join('\n\n');
  }

  function buildUserPrompt(entry, branch, c){
    var branchLabel = branch === 'past' ? '过去的自己' : '未来的自己';
    return (
      '请以「' + branchLabel + '」的身份，读完上面这篇日记后，给此刻写下这篇日记的" 我 "写一封信。\n\n' +
      '写作要求：\n' +
      '1. 字数不少于 500 字（仅指信件正文本身，不含称呼与落款），可以更多，但不能敷衍地写短\n' +
      '2. 分为 3～5 个自然段，段落之间要有情绪或视角的推进层次，不要写成一整段流水账\n' +
      '3. 开头一句要像真正的书信那样有称呼或起笔，结尾要有落款语气（不需要写具体署名，署名会由前端另行处理）\n' +
      '4. 信中至少自然地呼应一处日记原文的具体细节（一句话、一个场景、一个情绪词都可以），\n' +
      '   让人确信这封信是"读过"这篇日记之后才写出来的，而不是套话模板\n' +
      '5. 只输出信件正文内容本身，不要输出任何前言、解释、标题、markdown符号或署名行'
    );
  }


  /* ============================================================
     Part G —— API 调用
  ============================================================ */
  function getApiConfig(){
    var cur = {};
    try{ cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}'); }catch(e){}
    var model = localStorage.getItem('luna_api_model') || '';
    return { baseUrl: (cur.baseUrl || '').replace(/\/$/, ''), apiKey: cur.apiKey || '', model: model };
  }

  function callChatCompletion(systemPrompt, userPrompt){
    var cfg = getApiConfig();
    if (!cfg.baseUrl || !cfg.apiKey || !cfg.model){
      return Promise.reject(new Error('NO_API_CONFIG'));
    }
    return fetch(cfg.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + cfg.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.9,
        max_tokens: 1600
      })
    }).then(function(resp){
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.json();
    }).then(function(data){
      var reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!reply) throw new Error('EMPTY_REPLY');
      return reply.trim();
    });
  }


  /* ============================================================
     Part H —— 生成流程（Stage 3 仪式 → Stage 4 结果）
  ============================================================ */
  var RITUAL_TITLES = {
    past:   { title: '正在唤醒过去的 Ta…', line: 'Ta 正翻回记忆更浅处，用那时候才有的心境，读这篇日记。' },
    future: { title: '正在联通未来的 Ta…', line: 'Ta 正从更远的时间点回望，带着走过之后才有的从容。' }
  };

  function runRitualSteps(){
    var steps = document.querySelectorAll('.ritual-step');
    steps.forEach(function(s){ s.classList.remove('done'); });
    var i = 0;
    var timer = setInterval(function(){
      if (steps[i]) steps[i].classList.add('done');
      i++;
      if (i >= steps.length) clearInterval(timer);
    }, 650);
    return timer;
  }

  function startGeneration(branch){
    var c = getSelectedChar();
    if (!c || !_entry) return;
    _selectedBranch = branch;

    var seal = document.getElementById('ritualSeal');
    seal.className = 'ritual-seal ' + (branch === 'past' ? 'seal-past' : 'seal-future');
    document.getElementById('ritualTitle').textContent = RITUAL_TITLES[branch].title;
    document.getElementById('ritualLine').textContent = RITUAL_TITLES[branch].line;
    runRitualSteps();
    goStage('stage3');

    Promise.all([
      buildWorldbookPromptForChar(c.id),
      buildMemoryPrompt(c.id != null ? c.id : c.name)
    ]).then(function(results){
      var worldPrompt = results[0];
      var memoryPrompt = results[1];
      var systemPrompt = buildSystemPrompt(c, branch, worldPrompt, memoryPrompt);
      var userPrompt = buildDiaryBlock(_entry) + '\n\n' + buildUserPrompt(_entry, branch, c);
      return callChatCompletion(systemPrompt, userPrompt);
    }).then(function(letterText){
      renderLetter(c, branch, letterText);
      goStage('stage4');
    }).catch(function(err){
      renderLetterError(c, branch, err);
      goStage('stage4');
    });
  }

  document.getElementById('regenBtn').addEventListener('click', function(){
    if (_selectedBranch) startGeneration(_selectedBranch);
  });


  /* ============================================================
     Part I —— 信件渲染
  ============================================================ */
  var _lastLetterText = '';

  function pickQuote(entry){
    var body = (entry.body || '').trim();
    if (!body) return '';
    var sentences = body.split(/(?<=[。！？\n])/).map(function(s){ return s.trim(); }).filter(Boolean);
    var candidates = sentences.filter(function(s){ return s.length >= 6 && s.length <= 40; });
    if (!candidates.length) return sentences[0] ? sentences[0].slice(0, 40) : '';
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function renderLetter(c, branch, text){
    _lastLetterText = text;
    var col = COLOR_MAP[c.color] || COLOR_MAP.ink;
    var letter = (c.name || '?')[0].toUpperCase();
    var card = document.getElementById('letterCard');
    card.className = 'letter-card ' + (branch === 'past' ? 'lc-past' : 'lc-future');

    document.getElementById('letterBadgeText').textContent = branch === 'past' ? 'RETROSPECT · 过去来信' : 'FORESIGHT · 未来来信';
    document.getElementById('letterTimestamp').textContent = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

    var lbAv = document.getElementById('lbAvatar');
    lbAv.innerHTML = c.avatar ? '<img src="' + c.avatar + '" alt="" />' : '<span>' + escHtml(letter) + '</span>';
    document.getElementById('lbName').textContent = (branch === 'past' ? '过去的 ' : '未来的 ') + (c.name || '未命名');
    document.getElementById('lbRole').textContent = c.role || '';

    document.getElementById('letterSalutation').textContent = '致此刻正在写下这篇日记的你：';

    var paras = text.split(/\n{1,}/).map(function(p){ return p.trim(); }).filter(Boolean);
    document.getElementById('letterBodyText').innerHTML = paras.map(function(p){ return '<p class="lp">' + escHtml(p) + '</p>'; }).join('');

    document.getElementById('letterSigName').textContent = (branch === 'past' ? '过去的' : '未来的') + '　' + (c.name || '');

    var quote = pickQuote(_entry);
    var qEl = document.getElementById('letterQuoteStrip');
    if (quote){
      document.getElementById('letterQuoteText').textContent = '"' + quote + '"';
      qEl.hidden = false;
    } else {
      qEl.hidden = true;
    }

    document.getElementById('alertSlot').innerHTML = '';
    renderArchiveList();
  }

  function renderLetterError(c, branch, err){
    var slot = document.getElementById('alertSlot');
    var msg = '生成失败，请稍后重试。';
    var isConfigErr = err && err.message === 'NO_API_CONFIG';
    if (isConfigErr){
      slot.innerHTML =
        '<div class="capsule-alert">' +
          '<svg viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01M12 3l9 16H3L12 3Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '<span>还没有配置可用的 AI 接口，请先前往 <a href="../settings.html">设置 · API</a> 完成配置，再回来开启这封信。</span>' +
        '</div>';
    } else {
      slot.innerHTML =
        '<div class="capsule-alert">' +
          '<svg viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01M12 3l9 16H3L12 3Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '<span>' + msg + '（' + escHtml(err && err.message || '未知错误') + '）请点击下方"重新落笔"再试一次。</span>' +
        '</div>';
    }
    var col = COLOR_MAP[c.color] || COLOR_MAP.ink;
    var letter = (c.name || '?')[0].toUpperCase();
    var card = document.getElementById('letterCard');
    card.className = 'letter-card ' + (branch === 'past' ? 'lc-past' : 'lc-future');
    document.getElementById('letterBadgeText').textContent = branch === 'past' ? 'RETROSPECT · 过去来信' : 'FORESIGHT · 未来来信';
    document.getElementById('letterTimestamp').textContent = '—';
    var lbAv = document.getElementById('lbAvatar');
    lbAv.innerHTML = c.avatar ? '<img src="' + c.avatar + '" alt="" />' : '<span>' + escHtml(letter) + '</span>';
    document.getElementById('lbName').textContent = (branch === 'past' ? '过去的 ' : '未来的 ') + (c.name || '未命名');
    document.getElementById('lbRole').textContent = c.role || '';
    document.getElementById('letterSalutation').textContent = '这封信暂时还未能送达……';
    document.getElementById('letterBodyText').innerHTML = '';
    document.getElementById('letterSigName').textContent = '';
    document.getElementById('letterQuoteStrip').hidden = true;
    _lastLetterText = '';
  }


  /* ============================================================
     Part J —— 归档（写入 luna_capsule_archive，字段与 diary.js 徽标统计对齐）
  ============================================================ */
  function loadCapsuleArchive(){
    try{ return JSON.parse(localStorage.getItem('luna_capsule_archive') || '{}'); }catch(e){ return {}; }
  }
  function saveCapsuleArchive(store){
    try{ localStorage.setItem('luna_capsule_archive', JSON.stringify(store)); }catch(e){}
  }

  function renderArchiveList(){
    var block = document.getElementById('archiveBlock');
    var list = document.getElementById('archiveList');
    if (!_entry) { block.hidden = true; return; }
    var store = loadCapsuleArchive();
    var items = (store[_entry.id] || []).slice().sort(function(a, b){ return b.ts - a.ts; });
    if (!items.length){ block.hidden = true; list.innerHTML = ''; return; }

    block.hidden = false;
    list.innerHTML = items.map(function(it){
      var isPast = it.branch === 'past';
      var glyph = isPast
        ? '<svg viewBox="0 0 24 24" fill="none"><path d="M12 22a10 10 0 1 0-8.66-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 7v5l3.5 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
      var dateStr = new Date(it.ts).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
      return (
        '<div class="archive-item ' + (isPast ? 'branch-past' : 'branch-future') + '" data-id="' + it.id + '">' +
          '<div class="ai-mark">' + glyph + '</div>' +
          '<div class="ai-text">' +
            '<div class="ai-name">' + escHtml((isPast ? '过去的 ' : '未来的 ') + it.charName) + '</div>' +
            '<div class="ai-sub">' + dateStr + ' 封存的信</div>' +
          '</div>' +
          '<svg class="ai-arrow" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</div>'
      );
    }).join('');

    list.querySelectorAll('.archive-item').forEach(function(el){
      el.addEventListener('click', function(){
        var id = el.dataset.id;
        var item = items.find(function(x){ return String(x.id) === String(id); });
        if (!item) return;
        reopenArchivedLetter(item);
      });
    });
  }

  function reopenArchivedLetter(item){
    var c = _chars.find(function(x){ return x.id === item.charId; }) || { name: item.charName, role: item.charRole, color: item.charColor, avatar: item.charAvatar };
    _selectedBranch = item.branch;
    renderLetter(c, item.branch, item.text);
    goStage('stage4');
  }

  document.getElementById('sealBtn').addEventListener('click', function(){
    if (!_entry || !_lastLetterText || !_selectedBranch) return;
    var c = getSelectedChar();
    if (!c) return;
    var store = loadCapsuleArchive();
    if (!store[_entry.id]) store[_entry.id] = [];
    store[_entry.id].push({
      id: Date.now(),
      ts: Date.now(),
      status: 'opened',
      branch: _selectedBranch,
      charId: c.id,
      charName: c.name || '未命名',
      charRole: c.role || '',
      charColor: c.color || 'ink',
      charAvatar: c.avatar || '',
      text: _lastLetterText
    });
    saveCapsuleArchive(store);

    var btn = document.getElementById('sealBtn');
    var original = btn.innerHTML;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg><span>已收进胶囊</span>';
    setTimeout(function(){ btn.innerHTML = original; }, 1800);

    renderArchiveList();
  });


  /* ============================================================
     Part K —— 兜底：日记条目缺失时的提示
  ============================================================ */
  if (!_entry){
    document.addEventListener('DOMContentLoaded', function(){
      var scroll = document.getElementById('capsuleScroll');
      var stage1 = document.getElementById('stage1');
      if (stage1) stage1.innerHTML =
        '<div class="capsule-alert" style="margin-top:20px;">' +
          '<svg viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01M12 3l9 16H3L12 3Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '<span>没有找到对应的日记条目。请从 <a href="../diary.html">日记详情页</a> 点击「时空胶囊」功能卡片进入，才能定位到具体的一篇日记。</span>' +
        '</div>';
    });
  }

})();