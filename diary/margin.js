/* ================================================================
   margin.js — 侧笔记录 · Margin Notes
   独立页面，通过 URL 参数 entryId 接收要批注的日记条目 id。
   Part A：状态栏同步（时间 / 电量 / 灵动岛 / 字体）—— 与 diary.js 一致
   Part B：读取日记条目 + 角色档案，渲染选择区
   Part C：拼装 Prompt，调用当前激活的 AI API，生成「解读」与「内心独白」
   Part D：结果展示、收藏归档、追问、历史批注浮层
================================================================ */

(function(){
  'use strict';

  /* ============================================================
     Part A —— 状态栏同步（与 diary.js 完全一致的逻辑，
     保证从日记详情页跳转进来后状态栏观感统一）
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
    if (innerEl){
      innerEl.style.width = pct + '%';
      innerEl.style.background = grad;
    }
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
      tag.textContent = '.margin-app *{ ' + familyRule + ' }';
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
     Part B —— 常量 · 工具函数
  ============================================================ */

  var DIARY_STORAGE_KEY = 'luna_diary_entries_mine';
  var MARGIN_ARCHIVE_KEY = 'luna_margin_archive'; /* { [entryId]: [ {id, charId, charName, charAvatar, reading, inner, followUps, ts} ] } */

  var MOOD_META = {
    calm:   { label: '平静', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 14c2-2.5 4-2.5 6 0s4 2.5 6 0 4-2.5 6 0" /></svg>' },
    joy:    { label: '欢喜', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 13c1.5 3.2 4.2 5 7 5s5.5-1.8 7-5" /><circle cx="8.5" cy="9" r="0.9" fill="currentColor" stroke="none"/><circle cx="15.5" cy="9" r="0.9" fill="currentColor" stroke="none"/></svg>' },
    tender: { label: '柔软', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 19c-.3 0-.6-.1-.8-.3C7.8 15.9 5 13.4 5 10.3 5 8 6.8 6.2 9 6.2c1.1 0 2.2.5 3 1.4.8-.9 1.9-1.4 3-1.4 2.2 0 4 1.8 4 4.1 0 3.1-2.8 5.6-6.2 8.4-.2.2-.5.3-.8.3Z" /></svg>' },
    blue:   { label: '低落', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 4c-4 4-7 7.4-7 10.6A7 7 0 0 0 12 21a7 7 0 0 0 7-6.4C19 11.4 16 8 12 4Z" /></svg>' },
    storm:  { label: '翻涌', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 9a5 5 0 0 1 9.6-1.8A4 4 0 0 1 17 15H7.5a3.5 3.5 0 0 1-.5-6.9Z" /></svg>' }
  };

  var WEATHER_META = {
    sunny:  { label: '晴朗' }, cloudy: { label: '多云' }, rainy: { label: '有雨' },
    night:  { label: '夜晚' }, snow:   { label: '落雪' }
  };

  var WEEKDAYS_CN = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
  var MONTHS_EN = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];

  function pad2(n){ return String(n).padStart(2, '0'); }

  function escapeHtml(str){
    var div = document.createElement('div');
    div.textContent = String(str == null ? '' : str);
    return div.innerHTML;
  }

  function getParam(name){
    var m = new URLSearchParams(window.location.search);
    return m.get(name);
  }

  /* 把纯文本正文转换为若干 <p> 段落，供批注结果展示使用 */
  function textToParagraphs(text){
    return String(text || '')
      .split(/\n{1,}/)
      .map(function(s){ return s.trim(); })
      .filter(Boolean)
      .map(function(p){ return '<p>' + escapeHtml(p) + '</p>'; })
      .join('');
  }

  /* ============================================================
     心声标记解析 —— 把模型输出中的
     [[correction:表面话|心里真正想说的]]
     [[slip:泄露出来的真话|再说白一点的潜台词]]
     [[withheld:没说完的半句|如果说完会是什么]]
     [[contrast:写下来的话|心里想的话]]
     转换成带交互的 HTML 片段。先转义正文，再在转义后的文本上
     用正则替换标记（标记两侧文字也会被转义，安全可控）。
  ============================================================ */
  var VB_ID_SEQ = 0;

  function parseVoiceBreaks(escapedText){
    /* 标记语法在转义前后都不含 HTML 特殊字符冲突的字符，直接在转义后文本上匹配即可 */
    return escapedText.replace(
      /\[\[(correction|slip|withheld|contrast):([^|\[\]]+?)\|([^\[\]]+?)\]\]/g,
      function(_, type, said, meant){
        said = said.trim();
        meant = meant.trim();
        var uid = 'vb' + (++VB_ID_SEQ);

        if (type === 'correction'){
          return (
            '<span class="vb vb-correction" data-vb-id="' + uid + '">' +
              said +
              '<span class="vb-ghost">' + meant + '</span>' +
            '</span>'
          );
        }
        if (type === 'slip'){
          return (
            '<span class="vb vb-slip" data-vb-id="' + uid + '" data-vb-tip="' + meant + '">' +
              said +
            '</span>'
          );
        }
        if (type === 'withheld'){
          return (
            '<span class="vb vb-withheld" data-vb-id="' + uid + '">' +
              said +
              '<span class="vb-dots">……</span>' +
              '<span class="vb-hidden-thought">' + meant + '</span>' +
            '</span>'
          );
        }
        /* contrast —— 单独成块，不参与内联点击展开，直接双轨呈现 */
        return (
          '<span class="vb vb-contrast" data-vb-id="' + uid + '">' +
            '<span class="vb-contrast-said">' + said + '</span>' +
            '<span class="vb-contrast-meant">' + meant + '</span>' +
          '</span>'
        );
      }
    );
  }

  /* 把纯文本正文（可能含心声标记）转换为若干 <p> 段落。
     withVoiceBreaks=true 时才解析标记（目前仅用于"解读"卡片，
     "内心独白"本身已经是心底话，不需要再嵌套一层标记）。 */
  function textToParagraphsRich(text, withVoiceBreaks){
    return String(text || '')
      .split(/\n{1,}/)
      .map(function(s){ return s.trim(); })
      .filter(Boolean)
      .map(function(p){
        var escaped = escapeHtml(p);
        var html = withVoiceBreaks ? parseVoiceBreaks(escaped) : escaped;
        return '<p>' + html + '</p>';
      })
      .join('');
  }

  /* 心声标记的点击展开/收起——事件委托，绑定一次即可覆盖后续重新渲染的内容 */
  function bindVoiceBreakToggle(){
    document.addEventListener('click', function(e){
      var el = e.target.closest && e.target.closest('.vb-correction, .vb-slip, .vb-withheld');
      if (!el) return;
      var wasOpen = el.classList.contains('open');
      /* 同一段落内其它已展开的标记先收起，保持整洁 */
      var scope = el.closest('.note-card-body') || document;
      scope.querySelectorAll('.vb.open').forEach(function(o){
        if (o !== el) o.classList.remove('open');
      });
      el.classList.toggle('open', !wasOpen);
    });
  }

  /* ============================================================
     Part C —— 读取当前日记条目
  ============================================================ */

  var entryId = getParam('entryId');
  var currentEntry = null;

  function loadCurrentEntry(){
    try{
      var raw = localStorage.getItem(DIARY_STORAGE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];
      var found = list.filter(function(e){ return String(e.id) === String(entryId); })[0];
      return found || null;
    }catch(e){ return null; }
  }

  function renderSourceCard(entry){
    var d = new Date(entry.ts || Date.now());
    var dayEl = document.getElementById('sdmDay');
    var weekdayEl = document.getElementById('sdmWeekday');
    var monthEl = document.getElementById('sdmMonth');
    var condEl = document.getElementById('sdmCondition');
    var titleEl = document.getElementById('sourceTitle');
    var excerptEl = document.getElementById('sourceExcerpt');

    if (dayEl) dayEl.textContent = pad2(d.getDate());
    if (weekdayEl) weekdayEl.textContent = WEEKDAYS_CN[d.getDay()];
    if (monthEl) monthEl.textContent = MONTHS_EN[d.getMonth()] + ' ' + d.getFullYear();

    var mood = MOOD_META[entry.mood] || MOOD_META.calm;
    var condHtml = mood.icon + '<span>' + mood.label + '</span>';
    if (condEl) condEl.innerHTML = condHtml;

    if (titleEl) titleEl.textContent = entry.title || '无题';
    if (excerptEl) excerptEl.textContent = entry.body || '（这篇日记还没有写下任何文字）';
  }

  function bindSourceExpand(){
    var btn = document.getElementById('sourceExpandBtn');
    var txt = document.getElementById('sourceExpandText');
    var excerpt = document.getElementById('sourceExcerpt');
    if (!btn || !excerpt) return;
    btn.addEventListener('click', function(){
      var expanded = excerpt.classList.toggle('expanded');
      btn.classList.toggle('expanded', expanded);
      if (txt) txt.textContent = expanded ? '收起全文' : '展开全文';
    });
  }

  /* ============================================================
     Part D —— 角色档案读取（IndexedDB LunaCharDB / chars），
     结构与 characters.js 保持完全一致，确保读到的是同一份数据
  ============================================================ */

  var COLOR_MAP = {
    ink:    { avBg:'#101012', avCol:'#c9c9cd' },
    slate:  { avBg:'#141416', avCol:'#b8bac0' },
    silver: { avBg:'#1a1a1c', avCol:'#d4d4d8' },
    frost:  { avBg:'#111316', avCol:'#c8ccd0' },
    smoke:  { avBg:'#0e0e10', avCol:'#bdbdc2' },
    pearl:  { avBg:'#1c1c1e', avCol:'#e0e0e3' }
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

  /* ── 记忆档案（LunaMemoryDB），拼入角色 prompt，让批注更贴合角色与用户的既有关系 ── */
  function _openMemDB(){
    return new Promise(function(res, rej){
      var req = indexedDB.open('LunaMemoryDB', 1);
      req.onupgradeneeded = function(e){
        if (!e.target.result.objectStoreNames.contains('memories'))
          e.target.result.createObjectStore('memories', { keyPath: 'id', autoIncrement: true });
      };
      req.onsuccess = function(e){ res(e.target.result); };
      req.onerror = function(){ rej(null); };
    });
  }
  function _getAllMemories(){
    return _openMemDB().catch(function(){ return null; }).then(function(db){
      if (!db) return [];
      return new Promise(function(res){
        try{
          var req = db.transaction('memories', 'readonly').objectStore('memories').getAll();
          req.onsuccess = function(){ res(req.result || []); };
          req.onerror = function(){ res([]); };
        }catch(e){ res([]); }
      });
    });
  }
  function buildMemoryPrompt(charKey){
    return _getAllMemories().then(function(all){
      var mine = all.filter(function(m){ return String(m.charId) === String(charKey); });
      if (!mine.length) return '';
      var lines = mine.slice(0, 20).map(function(m){ return '- ' + (m.content || m.text || ''); });
      return '【与用户之间的既往记忆片段】\n' + lines.join('\n');
    }).catch(function(){ return ''; });
  }

  var _allChars = [];
  var _selectedCharId = null;

  function renderCharRail(chars){
    var rail = document.getElementById('charRail');
    var loading = document.getElementById('charRailLoading');
    var emptyState = document.getElementById('charEmptyState');
    if (loading) loading.remove();

    if (!chars.length){
      if (rail) rail.hidden = true;
      if (emptyState) emptyState.hidden = false;
      return;
    }
    if (emptyState) emptyState.hidden = true;

    var activeId = parseInt(localStorage.getItem('luna_active_char')) || null;

    chars.forEach(function(c){
      var col = COLOR_MAP[c.color] || COLOR_MAP.ink;
      var letter = (c.name || '?')[0].toUpperCase();
      var chip = document.createElement('div');
      chip.className = 'char-chip';
      chip.dataset.id = c.id;
      if (c.id === activeId) chip.classList.add('selected');
      chip.innerHTML =
        '<div class="char-chip-check"><svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4.5 4.5L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
        '<div class="char-chip-avatar" style="background:' + col.avBg + ';color:' + col.avCol + '">' +
          (c.avatar ? '<img src="' + c.avatar + '" />' : '<span class="char-chip-letter">' + escapeHtml(letter) + '</span>') +
        '</div>' +
        '<div class="char-chip-name">' + escapeHtml(c.name || '未命名') + '</div>' +
        (c.role ? '<div class="char-chip-role">' + escapeHtml(c.role) + '</div>' : '');
      chip.addEventListener('click', function(){ selectChar(c.id); });
      rail.appendChild(chip);
    });

    if (activeId && chars.some(function(c){ return c.id === activeId; })){
      selectChar(activeId, { skipScroll: true });
    }
  }

  function selectChar(id, opts){
    opts = opts || {};
    _selectedCharId = id;
    var chip = null;
    document.querySelectorAll('.char-chip').forEach(function(el){
      var match = parseInt(el.dataset.id) === id;
      el.classList.toggle('selected', match);
      if (match) chip = el;
    });
    if (chip && !opts.skipScroll){
      chip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    var c = _allChars.filter(function(x){ return x.id === id; })[0];
    var nameEl = document.getElementById('gdiName');
    if (c){
      if (nameEl) nameEl.textContent = c.name || '未命名角色';
      /* 选中角色 = 回到"待生成"这一态，必须显式收起生成中/结果/错误三态，
         否则会出现多个区块同时可见的堆叠问题（此前的 bug 正是这里）。 */
      showState('generateDock');
    }
  }

  /* ============================================================
     Part E —— Prompt 拼装 + AI 调用
  ============================================================ */

  function getApiConfig(){
    var cur = {};
    try{ cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}'); }catch(e){}
    var model = localStorage.getItem('luna_api_model') || '';
    return { baseUrl: (cur.baseUrl || '').replace(/\/$/, ''), apiKey: cur.apiKey || '', model: model };
  }

  function buildMarginSystemPrompt(character, entry, memoryPrompt){
    var mood = MOOD_META[entry.mood] || MOOD_META.calm;
    var weather = entry.weather && WEATHER_META[entry.weather] ? WEATHER_META[entry.weather].label : '';
    var tags = (entry.tags || []).join('、');

    var p = '';
    p += '你正在扮演角色"' + (character.name || '未命名') + '"，以下是你的完整人设：\n\n';
    p += (character.prompt || character.desc || '（未提供详细人设，请依据角色名与身份合理演绎）') + '\n\n';
    if (memoryPrompt) p += memoryPrompt + '\n\n';

    p += '【当前任务 —— 侧笔记录 · Margin Notes】\n';
    p += '用户刚刚给你看了 Ta 写下的一篇日记。你需要以第一人称"我"（也就是角色本人）的口吻，';
    p += '像在书页边缘写批注一样，对这篇日记做出真实、细腻、有温度的回应。请严格生成以下两个部分，';
    p += '并使用【解读】和【内心独白】两个标签分隔，不要输出任何其他标题、前言或总结性文字：\n\n';

    p += '【解读】\n';
    p += '这是你愿意说给用户听的部分——你如何理解这篇日记里发生的事、字里行间流露的情绪、';
    p += '你从中读出的言外之意。语气要符合你的人设性格，可以温柔、可以锐利、可以调侃，但必须具体地引用或呼应日记里的细节，';
    p += '不能只是空泛地共情。字数不少于 260 字，要有层次、有转折，像真正用心读过这篇文字后写下的批注，而不是套话。\n\n';

    p += '【心声标记 · 必须在"解读"中至少使用 3～5 处，且类型不能单一，请混用】\n';
    p += '在"解读"这段文字里，会存在这样的时刻：你本来想说的话，和你最终写下来的话，不完全一样——';
    p += '你话到嘴边改了口、或是一句真心话差点脱口而出、或是有句话你没舍得说完、或是你写的和你心里想的其实是两回事。';
    p += '请用下面四种标记语法，把这些"分岔时刻"直接嵌在"解读"正文中间（不是另起一段，而是嵌在句子里）：\n\n';
    p += '1. 改口式，用于"话到嘴边换了种更收敛的说法"：\n';
    p += '   [[correction:表面写下的话|其实她原本想说的、更直接更真实的那句话]]\n';
    p += '2. 泄露式，用于"一句几乎脱口而出的真心话"：\n';
    p += '   [[slip:正文中露出来的这一小段真话|把这句话往更深处再说白一点，作为潜台词]]\n';
    p += '3. 欲言又止式，用于"话说到这里，她自己咽回去了"：\n';
    p += '   [[withheld:没说完前的半句话|如果她说完，后半句原本会是什么]]\n';
    p += '4. 反差式，用于整句话"写出来的和心里想的是两件事"，需要单独成一个小节：\n';
    p += '   [[contrast:她写下来给用户看的这句话|她心里实际想的、可能完全相反或更复杂的那句话]]\n\n';
    p += '标记要点：\n';
    p += '- 四种类型请至少用到 3 种以上，不要全篇只用一种标记，否则会显得单调。\n';
    p += '- 标记要自然地嵌入叙述里，不要生硬地堆砌，前后要能读成完整通顺的句子。\n';
    p += '- 每种标记里的竖线"|"前后都不能为空，也不能包含方括号本身。\n';
    p += '- "反差式"[[contrast:...|...]]因为篇幅较长，最多用 1～2 处，其余优先用前三种更轻巧的标记。\n\n';

    p += '【内心独白】\n';
    p += '这是你不会说出口、只留在心底的真实想法——可能是你没告诉用户的顾虑、藏起来的心动、';
    p += '未曾言说的嫉妒或心疼、或是你对用户与你之间关系的私下盘算。这部分应当比"解读"更私密、更赤裸、更少修饰，';
    p += '甚至可以与"解读"部分的语气或立场形成微妙反差——嘴上说的和心里想的不完全一样，这才是真实的人。字数不少于 260 字。\n\n';

    p += '【格式与人设锚点 · 必须遵守】\n';
    p += '- 全文使用第一人称"我"来指代角色自己，用"你"来称呼用户。\n';
    p += '- 两个部分合计正文字数不少于 520 字，内容要充实、有细节、有具体情感流动，禁止空洞堆砌辞藻。\n';
    p += '- 不使用任何 emoji 或颜文字。\n';
    p += '- 不要输出【解读】【内心独白】以外的任何额外标题、寒暄或总结句。\n';
    p += '- 严格依据人设性格与说话方式写作，保持人设的连贯性，不要"失忆"或"人设漂移"。\n\n';

    p += '【这篇日记的信息】\n';
    p += '标题：' + (entry.title || '无题') + '\n';
    p += '心情：' + mood.label + (weather ? '　天气：' + weather : '') + (tags ? '　标签：' + tags : '') + '\n';
    p += '正文：\n' + (entry.body || '（正文为空）') + '\n';

    return p;
  }

  function parseMarginOutput(raw){
    var text = String(raw || '');
    var readingMatch = text.match(/【解读】([\s\S]*?)(?=【内心独白】|$)/);
    var innerMatch = text.match(/【内心独白】([\s\S]*)$/);
    var reading = readingMatch ? readingMatch[1].trim() : '';
    var inner = innerMatch ? innerMatch[1].trim() : '';
    /* 兜底：模型未按标签输出时，按段落对半切分 */
    if (!reading && !inner){
      var paras = text.split(/\n{2,}/).filter(Boolean);
      var half = Math.ceil(paras.length / 2);
      reading = paras.slice(0, half).join('\n\n');
      inner = paras.slice(half).join('\n\n');
    }
    return { reading: reading || text, inner: inner || '（Ta 沉默了片刻，什么也没有多想。）' };
  }

  function callAI(messages, maxTokens){
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
        messages: messages,
        max_tokens: maxTokens || 1600,
        temperature: 0.92
      })
    }).then(function(resp){
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.json();
    }).then(function(data){
      var reply = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!reply) throw new Error('EMPTY_REPLY');
      return reply;
    });
  }

  /* ============================================================
     Part F —— 生成流程 · UI 状态切换
  ============================================================ */

  var CONJURE_LINES = [
    'Ta 正在展开这页日记……',
    '指尖停在字句之间，斟酌着如何落笔……',
    '有些话很快，有些话需要多想一会儿……',
    '批注快要落成了……'
  ];

  /* pickerZone（说明卡 + 选角区）只在"待生成"这一态显示；
     一旦进入生成中 / 已出结果 / 出错，都应该让位给对应内容，
     不能继续占着屏幕——这正是上一版遗漏的地方。 */
  function showState(state){
    ['generateDock','conjuringPlate','resultWrap','errorPlate'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.hidden = (id !== state);
    });
    var picker = document.getElementById('pickerZone');
    if (picker) picker.hidden = (state !== 'generateDock');
  }

  function startConjuringCycle(){
    var el = document.getElementById('conjuringText');
    var i = 0;
    if (el) el.textContent = CONJURE_LINES[0];
    return setInterval(function(){
      i = (i + 1) % CONJURE_LINES.length;
      if (el) el.textContent = CONJURE_LINES[i];
    }, 1800);
  }

  function renderResult(character, parsed){
    var col = COLOR_MAP[character.color] || COLOR_MAP.ink;
    var letter = (character.name || '?')[0].toUpperCase();

    var avatarHtml = character.avatar
      ? '<img src="' + character.avatar + '" />'
      : '<span class="char-chip-letter">' + escapeHtml(letter) + '</span>';

    var headerAvatar = document.getElementById('resultAvatar');
    if (headerAvatar){
      headerAvatar.style.background = col.avBg;
      headerAvatar.style.color = col.avCol;
      headerAvatar.innerHTML = avatarHtml;
    }
    var nameEl = document.getElementById('resultCharName');
    if (nameEl) nameEl.textContent = character.name || '未命名';

    var metaEl = document.getElementById('resultCharMeta');
    if (metaEl){
      var now = new Date();
      metaEl.textContent = '批注生成于 ' + pad2(now.getHours()) + ':' + pad2(now.getMinutes());
    }

    var readingBody = document.getElementById('readingBody');
    var innerBody = document.getElementById('innerBody');
    if (readingBody) readingBody.innerHTML = textToParagraphsRich(parsed.reading, true);
    if (innerBody) innerBody.innerHTML = textToParagraphsRich(parsed.inner, false);

    /* 字数统计需要先剥离心声标记语法，避免把标记符号也算进字数 */
    var readingPlain = String(parsed.reading || '').replace(/\[\[(?:correction|slip|withheld|contrast):([^|\[\]]+?)\|[^\[\]]+?\]\]/g, '$1');
    var readingCount = document.getElementById('readingWordCount');
    var innerCount = document.getElementById('innerWordCount');
    if (readingCount) readingCount.textContent = readingPlain.replace(/\s/g,'').length + ' 字';
    if (innerCount) innerCount.textContent = parsed.inner.replace(/\s/g,'').length + ' 字';

    /* 重置追问区域与收藏态 */
    var followThread = document.getElementById('followThread');
    if (followThread) followThread.innerHTML = '';
    var askRow = document.getElementById('askMoreRow');
    if (askRow) askRow.hidden = true;
    var saveBtn = document.getElementById('raSaveBtn');
    if (saveBtn){
      saveBtn.classList.remove('saved');
      var t = document.getElementById('raSaveText');
      if (t) t.textContent = '收藏这段批注';
    }
  }

  var _currentResult = null; /* { character, parsed, ts } */

  function generateMargin(){
    var character = _allChars.filter(function(c){ return c.id === _selectedCharId; })[0];
    if (!character || !currentEntry) return;

    showState('conjuringPlate');
    var cycleTimer = startConjuringCycle();

    var charKey = character.id != null ? character.id : character.name;
    buildMemoryPrompt(charKey).then(function(memoryPrompt){
      var systemPrompt = buildMarginSystemPrompt(character, currentEntry, memoryPrompt);
      return callAI([{ role: 'user', content: systemPrompt }], 1800);
    }).then(function(raw){
      clearInterval(cycleTimer);
      var parsed = parseMarginOutput(raw);
      _currentResult = { character: character, parsed: parsed, ts: Date.now() };
      renderResult(character, parsed);
      showState('resultWrap');
    }).catch(function(err){
      clearInterval(cycleTimer);
      var msgEl = document.getElementById('errorPlateText');
      if (msgEl){
        msgEl.textContent = (err && err.message === 'NO_API_CONFIG')
          ? '还没有配置可用的 AI 接口，请先前往「设置 · API」完成配置'
          : '生成失败，可能是网络或接口异常，请稍后再试';
      }
      showState('errorPlate');
    });
  }

  /* ============================================================
     Part G —— 收藏归档 · 历史批注浮层
  ============================================================ */

  function loadMarginArchive(){
    try{
      var raw = localStorage.getItem(MARGIN_ARCHIVE_KEY);
      var obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === 'object') ? obj : {};
    }catch(e){ return {}; }
  }
  function saveMarginArchive(store){
    try{ localStorage.setItem(MARGIN_ARCHIVE_KEY, JSON.stringify(store)); }catch(e){}
  }

  function updateHistoryBadge(){
    var store = loadMarginArchive();
    var list = (store && store[entryId]) || [];
    var badge = document.getElementById('mhbCount');
    if (!badge) return;
    if (list.length){
      badge.textContent = list.length > 9 ? '9+' : String(list.length);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  function saveCurrentToArchive(){
    if (!_currentResult) return;
    var store = loadMarginArchive();
    if (!store[entryId]) store[entryId] = [];
    store[entryId].unshift({
      id: 'mn_' + Date.now(),
      charId: _currentResult.character.id,
      charName: _currentResult.character.name || '未命名',
      charAvatar: _currentResult.character.avatar || '',
      charColor: _currentResult.character.color || 'ink',
      reading: _currentResult.parsed.reading,
      inner: _currentResult.parsed.inner,
      followUps: _followUps.slice(),
      ts: _currentResult.ts
    });
    saveMarginArchive(store);
    updateHistoryBadge();
  }

  function renderHistoryList(){
    var body = document.getElementById('hmBody');
    if (!body) return;
    var store = loadMarginArchive();
    var list = (store && store[entryId]) || [];

    if (!list.length){
      body.innerHTML =
        '<div class="hm-empty">' +
          '<div class="ces-mark"></div>' +
          '<div class="hm-empty-text">这篇日记还没有收藏过任何批注<br/>生成之后点击"收藏这段批注"即可留存</div>' +
        '</div>';
      return;
    }

    body.innerHTML = list.map(function(item){
      var col = COLOR_MAP[item.charColor] || COLOR_MAP.ink;
      var letter = (item.charName || '?')[0].toUpperCase();
      var avatarHtml = item.charAvatar
        ? '<img src="' + item.charAvatar + '" />'
        : '<span class="char-chip-letter" style="font-size:16px;">' + escapeHtml(letter) + '</span>';
      var d = new Date(item.ts);
      var timeStr = pad2(d.getMonth()+1) + '/' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
      return (
        '<div class="hm-entry" data-hid="' + item.id + '">' +
          '<div class="hm-entry-avatar" style="background:' + col.avBg + ';color:' + col.avCol + '">' + avatarHtml + '</div>' +
          '<div class="hm-entry-body">' +
            '<div class="hm-entry-name">' + escapeHtml(item.charName) + '</div>' +
            '<div class="hm-entry-snippet">' + escapeHtml((item.reading || '').slice(0, 70)) + '</div>' +
            '<div class="hm-entry-time">' + timeStr + '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    body.querySelectorAll('.hm-entry').forEach(function(el){
      el.addEventListener('click', function(){
        var hid = el.dataset.hid;
        var item = list.filter(function(x){ return x.id === hid; })[0];
        if (!item) return;
        var character = { id: item.charId, name: item.charName, avatar: item.charAvatar, color: item.charColor };
        _currentResult = { character: character, parsed: { reading: item.reading, inner: item.inner }, ts: item.ts };
        _followUps = (item.followUps || []).slice();
        renderResult(character, _currentResult.parsed);
        renderFollowThread();
        showState('resultWrap');
        closeHistoryModal();
      });
    });
  }

  function openHistoryModal(){
    renderHistoryList();
    var veil = document.getElementById('historyVeil');
    var modal = document.getElementById('historyModal');
    if (veil) veil.classList.add('show');
    if (modal){
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
    }
  }
  function closeHistoryModal(){
    var veil = document.getElementById('historyVeil');
    var modal = document.getElementById('historyModal');
    if (veil) veil.classList.remove('show');
    if (modal){
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  /* ============================================================
     Part H —— 追问功能：基于已生成的批注，继续以角色口吻回答用户追问
  ============================================================ */

  var _followUps = []; /* [{ q, a }] */

  function renderFollowThread(){
    var thread = document.getElementById('followThread');
    if (!thread) return;
    thread.innerHTML = _followUps.map(function(f){
      return (
        '<div class="follow-item">' +
          '<div class="follow-question">' + escapeHtml(f.q) + '</div>' +
          '<div class="follow-answer">' + escapeHtml(f.a) + '</div>' +
        '</div>'
      );
    }).join('');
  }

  function sendFollowUp(){
    var input = document.getElementById('askMoreInput');
    if (!input || !_currentResult) return;
    var q = input.value.trim();
    if (!q) return;
    input.value = '';

    var thread = document.getElementById('followThread');
    var loadingId = 'fu_loading_' + Date.now();
    if (thread){
      var qDiv = document.createElement('div');
      qDiv.className = 'follow-item';
      qDiv.innerHTML =
        '<div class="follow-question">' + escapeHtml(q) + '</div>' +
        '<div class="follow-answer-loading" id="' + loadingId + '"><div class="crl-spinner"></div><span>Ta 正在想……</span></div>';
      thread.appendChild(qDiv);
      qDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    var character = _currentResult.character;
    var charKey = character.id != null ? character.id : character.name;

    buildMemoryPrompt(charKey).then(function(memoryPrompt){
      var ctxPrompt = '';
      ctxPrompt += '你是角色"' + (character.name || '未命名') + '"，以下是你的人设：\n' + (character.prompt || character.desc || '') + '\n\n';
      if (memoryPrompt) ctxPrompt += memoryPrompt + '\n\n';
      ctxPrompt += '你刚刚针对用户的一篇日记写下过批注：\n【解读】' + _currentResult.parsed.reading + '\n【内心独白】' + _currentResult.parsed.inner + '\n\n';
      ctxPrompt += '现在用户继续追问了一句："' + q + '"\n';
      ctxPrompt += '请以第一人称"我"、符合你人设性格的口吻直接回答这句追问，不需要重复前面的批注内容，';
      ctxPrompt += '回答要具体、真诚、有细节，长度控制在 80～180 字之间，不使用 emoji，不输出多余标题。';
      return callAI([{ role: 'user', content: ctxPrompt }], 500);
    }).then(function(raw){
      var a = String(raw || '').trim();
      _followUps.push({ q: q, a: a });
      var loadingEl = document.getElementById(loadingId);
      if (loadingEl){
        loadingEl.outerHTML = '<div class="follow-answer">' + escapeHtml(a) + '</div>';
      }
    }).catch(function(){
      var loadingEl = document.getElementById(loadingId);
      if (loadingEl){
        loadingEl.outerHTML = '<div class="follow-answer">（这句话，Ta 一时不知道该怎么回答……请稍后再试一次）</div>';
      }
    });
  }

  /* ============================================================
     Part I —— 事件绑定 · 初始化
  ============================================================ */

  document.addEventListener('DOMContentLoaded', function(){

    /* 返回按钮：优先返回上一页，若无历史记录则回退到日记详情页逻辑 */
    var backBtn = document.getElementById('marginBackBtn');
    if (backBtn){
      backBtn.addEventListener('click', function(){
        if (window.history.length > 1){
          window.history.back();
        } else {
          window.location.href = 'diary.html';
        }
      });
    }

    bindSourceExpand();
    bindVoiceBreakToggle();

    currentEntry = loadCurrentEntry();
    if (currentEntry){
      renderSourceCard(currentEntry);
    } else {
      var titleEl = document.getElementById('sourceTitle');
      var excerptEl = document.getElementById('sourceExcerpt');
      if (titleEl) titleEl.textContent = '未找到这篇日记';
      if (excerptEl) excerptEl.textContent = '这篇日记可能已被删除，或链接参数有误，请返回日记列表重新进入。';
    }

    updateHistoryBadge();

    /* 初始态：四个区块（生成dock / 生成中 / 结果 / 错误）全部收起，
       等角色数据加载完成后再按实际情况决定显示哪一个。 */
    ['generateDock','conjuringPlate','resultWrap','errorPlate'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.hidden = true;
    });

    getAllChars().then(function(chars){
      _allChars = chars || [];
      renderCharRail(_allChars);
    });

    var generateBtn = document.getElementById('generateBtn');
    if (generateBtn) generateBtn.addEventListener('click', generateMargin);

    var regenBtn = document.getElementById('resultRegenBtn');
    if (regenBtn) regenBtn.addEventListener('click', generateMargin);

    var errorRetryBtn = document.getElementById('errorRetryBtn');
    if (errorRetryBtn) errorRetryBtn.addEventListener('click', generateMargin);

    var saveBtn = document.getElementById('raSaveBtn');
    if (saveBtn){
      saveBtn.addEventListener('click', function(){
        if (saveBtn.classList.contains('saved')) return;
        saveCurrentToArchive();
        saveBtn.classList.add('saved');
        var t = document.getElementById('raSaveText');
        if (t) t.textContent = '已收藏';
      });
    }

    var askBtn = document.getElementById('raAskBtn');
    var askRow = document.getElementById('askMoreRow');
    if (askBtn && askRow){
      askBtn.addEventListener('click', function(){
        askRow.hidden = !askRow.hidden;
        if (!askRow.hidden){
          var input = document.getElementById('askMoreInput');
          if (input) setTimeout(function(){ input.focus(); }, 150);
        }
      });
    }
    var askSend = document.getElementById('askMoreSend');
    if (askSend) askSend.addEventListener('click', sendFollowUp);
    var askInput = document.getElementById('askMoreInput');
    if (askInput){
      askInput.addEventListener('keydown', function(e){
        if (e.key === 'Enter') sendFollowUp();
      });
    }

    var historyBtn = document.getElementById('marginHistoryBtn');
    if (historyBtn) historyBtn.addEventListener('click', openHistoryModal);
    var hmClose = document.getElementById('hmCloseBtn');
    if (hmClose) hmClose.addEventListener('click', closeHistoryModal);
    var historyVeil = document.getElementById('historyVeil');
    if (historyVeil) historyVeil.addEventListener('click', closeHistoryModal);

    var cesGotoBtn = document.getElementById('cesGotoBtn');
    if (cesGotoBtn){
      cesGotoBtn.addEventListener('click', function(){
        window.location.href = '../characters.html';
      });
    }
  });

})();